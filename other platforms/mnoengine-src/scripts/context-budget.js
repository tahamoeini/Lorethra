// context-budget.js — the World Editor's "Context" tab.
// Estimates what one turn of play costs, in ai-text tokens, with the world currently being edited.
// It reuses the REAL engine builders (RPEngine.buildContext, the tracker/stats builders) and the
// plugin's own tokenizer (genText({getMetaObject:true}).countTokens), so the numbers track a live
// session instead of drifting from a hand-maintained estimate.
//
// This file is off the play path — only the world editor imports it. It never calls the AI: the
// engine methods it reuses are handed a mock genText so they build (and hand back) the exact
// instruction they would send, without spending a generation.

import { loadWorld } from "./world.js";
import { RPEngine } from "./rp-engine.js";
import { MemorySystem, MEMORY_EVERY_TURNS, MEMORY_FEED_CAP, MEMORY_NAME_FEED_CAP } from "./memory-system.js";
import { LORE_FEED_CAP, STOPWORDS } from "./lorebook.js";
import { initialTrackers, initialNpcTrackers, buildTrackerValuesContext, locationTracker, heroTrackerOutputCap, npcTrackerOutputCap, NPC_TRACKER_CAP } from "./trackers.js";
import { normalizeLoc } from "./map-system.js";

// Quotes are escaped too (not just &<>): these rows feed quoted attributes (title="…") below.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const HERO = "Kael";
const IDEAL_FALLBACK = 6000;
const ACTION = "I move cautiously along the fen path, one hand on my sword, watching the treeline for riders.";
// Realistic worst-case player input: two short paragraphs. No real player types the 5k-token
// keyword salad the heavy probe feeds the matcher (see below) — the mode bar must be measured
// with this, never with the probe.
const HEAVY_ACTION = "I move cautiously along the fen path, one hand on my sword, watching the treeline for riders. I signal the others to stay low and keep quiet.\n\nAt the bend I stop, listen for hoofbeats, and study the lantern light ahead — deciding whether to call out, hide, or cut across the marsh.";

/* ---------- tokenizer (the plugin's own counter, cached) ---------- */
let tokenMetaCache = null;
function tokenMeta() {
  if (!tokenMetaCache) {
    let meta = null;
    try { meta = window.genText && window.genText({ getMetaObject: true }); } catch (e) {}
    const count = meta && typeof meta.countTokens === "function"
      ? (t) => meta.countTokens(String(t == null ? "" : t))
      : (t) => Math.ceil(String(t == null ? "" : t).length / 3.8);
    const ideal = meta && Number.isFinite(meta.idealMaxContextTokens) ? meta.idealMaxContextTokens : IDEAL_FALLBACK;
    tokenMetaCache = { count, ideal };
  }
  return tokenMetaCache;
}

/* ---------- the shared narrator prompt (same file main.js loads) ---------- */
let promptPromise = null;
function loadPromptText() {
  if (!promptPromise) {
    promptPromise = fetch("src/scripts/narrator-prompt.md")
      .then((r) => (r.ok ? r.text() : ""))
      .catch(() => "")
      .then((t) => t || "");
  }
  return promptPromise;
}

/* ---------- realistic filler prose (so the tokenizer sees normal language, not "SSSSS") ---------- */
const PROSE = "The wind howls across the moor as you step beyond the worn stone marker, its runes smoothed by centuries of rain and frost. Somewhere ahead, lantern light flickers behind the crooked shutters of a leaning inn, and the smell of woodsmoke drifts toward you on the cold air. A hooded figure leans against the fence and watches you without a word. Follow the road north and the hills give way to a drowned valley where old walls stand half-submerged in black water. ";
const filler = (n) => { let s = ""; while (s.length < n) s += PROSE; return s.slice(0, n); };
// Sample replies used for the (uncapped) GM output estimate — a couple of narration paragraphs, an
// NPC line and a short inner thought, which is what the narrator prompt asks for.
const REPLY_TYPICAL = filler(950);
const REPLY_HEAVY = filler(1700);

/* ---------- section splitter: attribute the built prompt to its makers ---------- */
// Ordered so the more specific headers win. Each built section begins with one of these strings at
// the start of a joined part; bodies may contain blank lines (world prose), so we walk the "\n\n"
// chunks and fold continuation chunks into the section that is already open.
const HEADER_MAP = [
  ["GM INSTRUCTIONS", "prompt", "System prompt (narrator)"],
  ["NARRATIVE VIBE", "vibe", "Narrative vibe"],
  ["WORLD PREMISE", "scenario", "World premise (scenario)"],
  ["STARTING SCENARIO", "start", "Starting scenario (start)"],
  ["CHARACTER SHEET", "sheet", "Character sheet + stats"],
  ["TRACKED STATE", "trackers", "Tracked state"],
  ["WORLD LORE", "lore", "World lore (selected entries)"],
  ["LATEST SITUATION", "summary", "Latest situation"],
  ["CURRENT SITUATION", "summary", "Latest situation"],
  ["CURRENT WORLD STATE:", "summary", "Latest situation"],
  ["OPEN THREADS", "threads", "Open threads"],
  ["MEMORIES", "memories", "Memories"],
  ["DISTANT PAST", "memories", "Memories"],
  ["NPC PROFILES", "npcs", "NPC dossiers + rosters"],
  ["NPC TRACKED STATE", "npcTrackers", "NPC tracked-state rules"],
  ["SURROUNDINGS", "surroundings", "Surroundings (map)"],
  ["RECENT EVENTS", "recent", "Recent events (transcript)"],
  ["TRAVEL ACTION:", "mode", "Latest action / turn mode"],
  ["SCENE TRANSITION:", "mode", "Latest action / turn mode"],
  ["THE HERO IS DEAD:", "mode", "Latest action / turn mode"],
  ["NARRATION DIRECTIVE", "mode", "Latest action / turn mode"],
  ["LATEST ACTION:", "mode", "Latest action / turn mode"],
  ["The adventure is just beginning", "mode", "Latest action / turn mode"],
  ["The hero is idle", "mode", "Latest action / turn mode"],
  ["SKILL CHECK", "check", "Skill-check result"],
  ["Now write your reply:", "footer", "Output instructions"]
];
const sectionKey = (chunk) => {
  // Headers can arrive with a leading newline when the previous part ends in one
  // ("...\n" + "\n\n" + "NARRATIVE VIBE..." splits into "\nNARRATIVE VIBE..."),
  // which used to fold the vibe into the system prompt. Match on the trimmed start.
  const t = String(chunk).trimStart();
  for (const [prefix, key] of HEADER_MAP) if (t.startsWith(prefix)) return key;
  return null;
};
export const SECTION_LABEL = {};
for (const [, key, label] of HEADER_MAP) SECTION_LABEL[key] = label;
// The canonical order every scenario reports its bars in — so the three views line up, and a
// section a scenario doesn't reach shows as a 0-token bar instead of vanishing (which would make a
// lighter turn look like it had fewer parts, not cheaper ones).
const SECTION_ORDER = [];
for (const [, key] of HEADER_MAP) if (!SECTION_ORDER.includes(key)) SECTION_ORDER.push(key);
// Split a built prompt into one [{key,label,tokens}] row per canonical section, summing (modulo the
// small inter-part "\n\n" separators, absorbed by scaleSections) to the full token count. A section
// the prompt doesn't contain is reported with 0 tokens so its bar is still drawn.
export function splitSections(text, count) {
  const acc = new Map();
  let cur = null;
  for (const raw of String(text || "").split("\n\n")) {
    // Skip whitespace-only artifacts from triple newlines ("...\n" + "\n\n" leaves
    // a bare "\n" that would otherwise pad the open section with empty separators).
    if (!String(raw).trim()) continue;
    // Store the chunk trimmed of edge whitespace so a header that arrived as
    // "\nNARRATIVE VIBE..." doesn't carry its stray newline into the token count.
    const chunk = String(raw).trim();
    const key = sectionKey(chunk);
    if (key) { cur = key; acc.set(key, (acc.get(key) || "") + (acc.get(key) ? "\n\n" : "") + chunk); }
    else if (cur) acc.set(cur, acc.get(cur) + "\n\n" + chunk);
  }
  return SECTION_ORDER.map((key) => ({ key, label: SECTION_LABEL[key] || key, tokens: acc.has(key) ? count(acc.get(key)) : 0, text: acc.get(key) || "" }));
}
// Token counts aren't additive (count(a)+count(b) ≠ count(a+b)), so nudge the section values to sum
// exactly to the measured total — otherwise a reader adding them up sees a small mismatch.
export function scaleSections(sections, target) {
  const sum = sections.reduce((a, s) => a + s.tokens, 0);
  if (!sum || !target) return sections;
  const out = sections.map((s) => ({ ...s, tokens: Math.round((s.tokens * target) / sum) }));
  const drift = target - out.reduce((a, s) => a + s.tokens, 0);
  if (drift && out.length) {
    let bi = 0;
    for (let i = 1; i < out.length; i++) if (out[i].tokens > out[bi].tokens) bi = i;
    out[bi].tokens += drift;
  }
  return out;
}

/* ---------- sample hero/session ---------- */
function sampleStats(defs) {
  const o = {};
  for (const d of defs || []) {
    const n = Number(d.start);
    o[d.key] = Number.isFinite(n) ? n : 12;
  }
  return o;
}
function npcDetails(n) {
  const d = {};
  for (const k of ["age", "gender", "race", "appearance", "job", "persona", "extra", "secrets"]) {
    const v = n && n[k];
    if (v !== undefined && v !== null && String(v).trim()) d[k] = String(v).trim();
  }
  if (!Object.keys(d).length) d.persona = "A minor figure in this world.";
  return d;
}
// Stand-in cast for worlds that ship NO standing cast. The GM invents NPCs on the fly
// ([[NPC: Name]] → generated profile), so a mid-campaign turn of a cast-less world still
// carries dossiers — measuring with an empty roster would show 0 for NPC PROFILES and
// under-report the real per-turn cost. Four entries: typical plays 2, worst case plays 4
// (the dossier cap). Names avoid every PROSE content word so they only match via the
// synthetic history below, never the filler transcript. Details are sized like a real
// generated profile (appearance / persona / secrets all filled).
const SYNTH_NPCS = [
  {
    name: "Mara Vess", age: "34 years old", gender: "female", race: "human",
    appearance: "Tall and weatherworn, dark hair tied back, a scar across her left cheek, patched leather coat over a faded uniform.",
    job: "Roadside innkeeper and former scout",
    persona: "Dry-witted and watchful; speaks little but misses nothing, deals plainly and keeps every promise.",
    extra: "Keeps a crossbow behind the bar; knows the fen paths by heart.",
    secrets: "Hides a deserter's brand under her sleeve and owes money to riders in the north."
  },
  {
    name: "Tobin Hale", age: "early forties", gender: "male", race: "human",
    appearance: "Stocky and balding, gray-flecked beard, ink-stained fingers, heavy wool cloak over patched clothes.",
    job: "Traveling tinker and mender",
    persona: "Cheerful and talkative, bargains over everything, remembers every face on the road.",
    extra: "Cart full of patched kettles and odd charms; whistles off-key when nervous.",
    secrets: "Once sold word of a caravan ambush and has regretted it ever since."
  },
  {
    name: "Sera Quill", age: "27 years old", gender: "female", race: "human",
    appearance: "Slight and sharp-eyed, black hair cut short, a satchel of letters with a brass spyglass at her belt.",
    job: "Courier and message-runner",
    persona: "Brisk and impatient, blunt with strangers but fiercely loyal once trusted.",
    extra: "Runs night routes through the valley; carries no blade but outruns trouble.",
    secrets: "Carries an unopened letter she was paid never to deliver."
  },
  {
    name: "Dain Mercer", age: "late fifties", gender: "male", race: "human",
    appearance: "Broad-shouldered and gray-bearded, limps on his left leg, dented breastplate worn over furs.",
    job: "Retired sellsword turned ferryman",
    persona: "Gruff and slow to warm, tells long stories when drunk, protective of travelers.",
    extra: "Poles a flatboat across the black water; charges in favors more than coin.",
    secrets: "Abandoned his company on the eve of a battle and answers to a false name."
  }
];
function makeHistory(turns, npcNames, extras = []) {
  const h = [];
  for (let i = 0; i < turns; i++) {
    const nm = npcNames[i % npcNames.length] || "A stranger";
    h.push({ role: "action", text: ACTION });
    h.push({ role: "narrator", text: filler(850) });
    h.push({ role: "npc", name: nm, text: "\"We should not linger here,\" they whisper, glancing back the way we came." });
    h.push({ role: "thought", name: nm, text: filler(110) });
  }
  for (const e of extras) h.push(e);
  return h;
}
// Build one session snapshot for buildContext. `opts` controls how much is "in play" so the same
// world can be measured at its floor (opening), a steady mid-campaign turn, and a heavy turn.
function makeSession(world, stats, opts) {
  const turn = opts.turn;
  const init = initialTrackers(world.trackerDefs, stats);
  // Seed a location so SURROUNDINGS/lore have something real. Prefer the world's OWN starting
  // location (what a real first turn actually has), and only fall back to a neutral placeholder.
  // Never use a name carrying a common word like "the": the engine's name matcher treats any
  // 3+ char token of a cast name as a hit, so "The Moor" would spuriously promote every cast member
  // whose name contains "the" to a full dossier and inflate the sample.
  const locDef = locationTracker(world.trackerDefs);
  let loc = "A small village";
  if (locDef) {
    const seeded = String(init[locDef.key] ?? "").trim();
    if (seeded) loc = seeded; else init[locDef.key] = loc;
  }
  const state = {
    turn,
    character: { name: HERO, stats },
    initialTrackers: init,
    messages: [],
    latestSituation: opts.summary ? filler(300) : "",
    openThreads: Array.from({ length: opts.threads }, () => "Keep the promise made beneath the old bridge before the season turns."),
    npcs: {},
    memories: { manual: [], auto: [], digest: opts.digest ? filler(500) : "" }
  };
  // Worlds with no standing cast still meet GM-invented NPCs on the fly — measure those
  // dossiers instead of an empty roster. `npcCount: 0` (opening) stays empty either way.
  const castSource = (world.npcs && world.npcs.length) ? world.npcs : SYNTH_NPCS;
  const chosen = castSource.slice(0, opts.npcCount);
  for (const n of chosen) {
    state.npcs[n.name] = {
      name: n.name, details: npcDetails(n), lastSeenTurn: turn, pinned: true,
      // Their live tracked values (folded from the seed when no message carries a snapshot) — the
      // dossier's `Tracked:` clause and the NPC change chips are measured from these.
      trackers: initialNpcTrackers(world.npcTrackerDefs, stats, n.trackers)
    };
  }
  if (opts.manual) state.memories.manual = ["A standing note the player wrote down to remember across the whole campaign."];
  // Topic-matched auto memories (PROSE contains their trigger words) — the MEMORY_FEED_CAP tier.
  // Turn is set well before the RECENT EVENTS window's floor so they aren't skipped as redundant.
  state.memories.auto = Array.from({ length: opts.memAuto }, () => ({
    text: filler(150), owner: "world", turn: Math.max(1, turn - 40), triggers: ["moor", "wind", "inn"], pinned: false
  }));
  // Name-only auto memories (the owner's own name IS the trigger) — the reserved
  // MEMORY_NAME_FEED_CAP tier. The owner is a cast member (or a synthetic on-the-fly NPC for a
  // cast-less world), so a name in the transcript selects them.
  if (opts.memName && castSource.length) {
    for (let i = 0; i < opts.memName; i++) {
      const nm = castSource[i % castSource.length].name;
      state.memories.auto.push({ text: filler(140), owner: nm, turn: Math.max(1, turn - 44), triggers: [nm.toLowerCase()], pinned: false });
    }
  }
  if (opts.map && locationTracker(world.trackerDefs)) {
    state.map = {
      status: "ready", scale: "outdoor", hero: { x: 0, y: 0 },
      loc: normalizeLoc(loc),
      pois: Array.from({ length: opts.map }, (_, i) => ({
        name: "A landmark " + (i + 1), type: "site", dx: 6 + i * 9, dy: 4 + i * 7, desc: filler(140)
      }))
    };
  }
  return state;
}

// Distinctive content words from the N longest keyword-tier lore entries (up to `wordsEach`
// each) — see the heavy scenario below for why the probe feeds them to the query.
function longestEntryWords(lorebook, entries = 4, wordsEach = 12) {
  const kw = (lorebook || []).filter((e) => e && String(e.activation || "").toLowerCase() === "keywords" && String(e.content || "").trim());
  kw.sort((a, b) => String(b.content).length - String(a.content).length);
  const out = [];
  for (const e of kw.slice(0, Math.max(1, entries))) {
    const seen = new Set();
    for (const m of String(e.content).toLowerCase().match(/[a-z0-9]+/g) || []) {
      if (m.length < 3 || STOPWORDS.has(m) || seen.has(m)) continue;
      seen.add(m);
      out.push(m);
      if (seen.size >= wordsEach) break;
    }
  }
  return out.join(" ");
}

/* ---------- per-call measurement ---------- */
// Reuses the engine's own methods with a capturing mock genText, so we record exactly what each
// call would send. Nothing is generated.
async function captureCall(makeEngine, fn) {
  let captured = null;
  const engine = makeEngine(async (o) => { captured = o; return { text: "" }; });
  try { await fn(engine); } catch (e) { /* a world shape that can't complete the call — report nothing */ }
  return captured;
}
function makeEngineFactory(world, promptText) {
  return (genText) => new RPEngine({
    genText, promptText,
    loreEntries: world.lorebook, scenarioText: world.scenario, startText: world.start,
    vibeText: world.narrativeVibe, trackerDefs: world.trackerDefs, npcTrackerDefs: world.npcTrackerDefs,
    statDefs: world.statDefs, worldNpcs: world.npcs,
    checkIncludeTrackers: world.statsCfg && world.statsCfg.checkIncludeTrackers,
    checkIncludeNpcTrackers: world.statsCfg && world.statsCfg.checkIncludeNpcTrackers,
    checkTrackerKeys: world.statsCfg && world.statsCfg.checkTrackerKeys,
    checkNpcTrackerKeys: world.statsCfg && world.statsCfg.checkNpcTrackerKeys,
    useCheckInstruction: world.statsCfg && world.statsCfg.useCheckInstruction,
    checkInstruction: world.statsCfg && world.statsCfg.checkInstruction
  });
}
async function measureCalls(world, promptText, stats) {
  const { count, ideal } = tokenMeta();
  const calls = { tracker: null, npcTracker: null, check: null, rollup: null };
  const factory = makeEngineFactory(world, promptText);
  const init = initialTrackers(world.trackerDefs, stats);
  // The NPC tracker call runs in PARALLEL with the hero tracker call, covering the in-play roster
  // (capped at NPC_TRACKER_CAP). Measured with a busy scene: every cast member pinned and present —
  // or the synthetic on-the-fly cast when the world ships none (else the roster is empty and the
  // call measures nothing, while real play still tracks invented NPCs).
  if (world.npcTrackerDefs && world.npcTrackerDefs.length) {
    const opts = await captureCall(factory, (engine) => {
      const msgs = [];
      for (let i = 0; i < 2; i++) { msgs.push({ role: "action", text: ACTION }); msgs.push({ role: "narrator", text: filler(850) }); }
      msgs.push({ role: "action", text: ACTION });
      const busyCount = (world.npcs && world.npcs.length) ? world.npcs.length : SYNTH_NPCS.length;
      const st = makeSession(world, stats, { turn: 12, npcCount: busyCount });
      st.messages = msgs;
      st.initialTrackers = init;
      return engine.updateNpcTrackers(st, filler(850), ACTION);
    });
    if (opts) calls.npcTracker = { input: count(opts.instruction), maxOut: npcTrackerOutputCap(world.npcTrackerDefs, NPC_TRACKER_CAP) };
  }

  if (world.trackerDefs.length) {
    const opts = await captureCall(factory, (engine) => {
      const msgs = [];
      for (let i = 0; i < 4; i++) { msgs.push({ role: "action", text: ACTION }); msgs.push({ role: "narrator", text: filler(850), afterTrackers: { ...init } }); }
      msgs.push({ role: "action", text: ACTION });
      return engine.updateTrackers({ turn: 12, character: { name: HERO, stats }, initialTrackers: init, messages: msgs }, filler(850), ACTION, { levelUpBackstop: false });
    });
    if (opts) calls.tracker = { input: count(opts.instruction), maxOut: heroTrackerOutputCap(world.trackerDefs) };
  }
  if (world.statDefs.length) {
    const opts = await captureCall(factory, (engine) =>
      engine.determineCheck({ turn: 12, character: { name: HERO, stats }, initialTrackers: init, messages: [] }, ACTION)
    );
    if (opts) calls.check = { input: count(opts.instruction), maxOut: 120 };
  }
  // Memory roll-up runs every MEMORY_EVERY_TURNS turns — report it amortized per turn. The
  // fixture holds exactly one cadence of actions (baking MEMORY_EVERY_TURNS turns in a single
  // call) so it measures normal steady-state play; backlog chunking only fires on overgrown
  // windows and is not part of the per-turn budget.
  {
    let captured = null;
    const mem = new MemorySystem(async (o) => {
      captured = o;
      return { text: '{"situation":"x","memories":[],"resolve":[],"ownerUpdates":[],"openThreads":[]}' };
    });
    const msgs = [];
    for (let i = 0; i < MEMORY_EVERY_TURNS + 2; i++) { msgs.push({ role: "action", text: ACTION }); msgs.push({ role: "narrator", text: filler(850) }); }
    try {
      await mem.rollUp({
        turn: MEMORY_EVERY_TURNS + 2, character: { name: HERO }, messages: msgs, lastAutoMemoryAt: 0,
        latestSituation: filler(160), openThreads: ["Keep the promise made beneath the old bridge."],
        memories: { manual: ["A standing note."], digest: filler(400), auto: Array.from({ length: 40 }, () => ({ text: filler(140), owner: "world", turn: 3, triggers: ["moor"], pinned: false })) }
      });
    } catch (e) { /* ignore — rollup is reported only when it captured an instruction */ }
    if (captured) {
      const input = count(captured.instruction);
      calls.rollup = { input, maxOut: 2200, amortized: Math.round((input + 2200) / MEMORY_EVERY_TURNS) };
    }
  }
  return { calls, ideal };
}

/* ---------- the report ---------- */
export async function measureContextBudget(fileForm) {
  const { world } = loadWorld(JSON.stringify(fileForm || {}));
  if (!world) return null;
  const { count, ideal } = tokenMeta();
  const promptText = await loadPromptText();
  const stats = sampleStats(world.statDefs);
  const warnings = [];
  if (!promptText) warnings.push("Couldn't load the narrator prompt — its cost is shown as 0.");
  if (!world.statDefs.length) warnings.push("This world has no stats — the skill-check call never runs.");
  if (!world.trackerDefs.length) warnings.push("This world has no trackers — the tracker-update call never runs.");

  const engine = makeEngineFactory(world, promptText)(async () => ({ text: "" }));
  const npcNames = (world.npcs || []).map((n) => n.name);
  const hasCast = npcNames.length > 0;
  const synthNames = SYNTH_NPCS.map((n) => n.name);
  const allKeywords = (world.lorebook || []).flatMap((e) => e.keywords || []).join(" ") + " " + (hasCast ? npcNames : synthNames).join(" ");
  // The two cast members the "steady" scenario has in play. Both scenarios build their transcript
  // from THIS name list so the RECENT EVENTS window is identical between them — otherwise the
  // window's incidental NPC names differ and the tokenizer can count the "worst case" transcript a
  // few tokens LOWER than typical (it must never measure lower; see the scenario blocks below).
  // A world with no standing cast still has company by mid-campaign: the GM invents NPCs on the
  // fly, so play the synthetic stand-ins instead of measuring an empty roster (0 NPC tokens).
  const inPlayNames = hasCast ? npcNames.slice(0, Math.min(2, npcNames.length)) : synthNames.slice(0, 2);
  const heavyNpcCount = hasCast ? npcNames.length : SYNTH_NPCS.length;
  const heavyNote = hasCast
    ? `Full transcript window, every triggered lore entry (capped at ${LORE_FEED_CAP}/turn), the whole cast met (10 NPC entries total), a full memory feed, map fed in.`
    : `Full transcript window, every triggered lore entry (capped at ${LORE_FEED_CAP}/turn), ${SYNTH_NPCS.length} on-the-fly NPCs met, a full memory feed, map fed in.`;

  const scenarios = {};
  // Opening — the first turn: no history yet, all the STARTING SCENARIO still being injected.
  // `npcCount: 0` — a fresh session enters play with an EMPTY roster (`state.npcs = {}`), so no cast
  // member has been met: they ride as NPC PROFILES hook lines (relevance + rotation), never as
  // full dossiers — and a cast-less world has met no-one at all yet, so its opening stays empty
  // either way. Letting the count default here would register the whole standing cast
  // as already-met, inflating the opening with a dossier for every one of them.
  {
    const state = makeSession(world, stats, { turn: 0, threads: 0, npcCount: 0 });
    const ctx = engine.buildContext(state, [], null, "action", true, {});
    const gmInput = count(ctx);
    scenarios.opening = { label: "Opening", note: "The first turn — no history yet.", gmInput, sections: scaleSections(splitSections(ctx, count), gmInput) };
  }
  // Typical — a steady mid-campaign turn, past the starting-scenario window (turn 20). Only the
  // in-play cast speaks in the recent window, so the rest of the standing cast still shows as
  // NPC PROFILES hook lines rather than full dossiers — the whole-cast dossier cost belongs to the
  // heavy scenario below, and typical must never out-measure it (see makeHistory callers). A
  // cast-less world plays 2 synthetic on-the-fly NPCs here (see inPlayNames).
  {
    const state = makeSession(world, stats, { turn: 26, summary: true, threads: 2, manual: true, memAuto: 5, memName: 2, digest: true, npcCount: inPlayNames.length });
    const ctx = engine.buildContext(state, makeHistory(20, inPlayNames), ACTION, "action", false, { includeSurroundings: !!state.map, check: world.statDefs.length ? sampleCheck() : undefined });
    const gmInput = count(ctx);
    scenarios.typical = { label: "Typical", note: hasCast ? "A steady mid-campaign turn (turn 26)." : "A steady mid-campaign turn (turn 26) — 2 on-the-fly NPCs in play.", gmInput, sections: scaleSections(splitSections(ctx, count), gmInput) };
  }
  // Worst case — full transcript window, every lore entry triggered (the keyword tier is capped per
  // turn — see loreForTurn), the whole cast met (dossiers capped at 4, overflow hooks at 4,
  // then 2 relevance + 2 rotation, 10 NPC entries total per NPC_TOTAL_CAP), a full memory feed (MEMORY_FEED_CAP topic-matched +
  // MEMORY_NAME_FEED_CAP name-only) and the map fed in.
  // Lore note: the tier is capped (4 entries / 3600 chars), so stuffing keywords alone can rank
  // SHORT entries first and measure LOWER than typical. Appending the longest entries' own
  // content words ranks them top instead — the closest the real builder gets to max.
  {
    // Probe action (never shown, never counted): stuffing every keyword forces the lore / memory /
    // NPC matchers to their caps, which is what "worst case" means for those sections. It is NOT a
    // realistic player turn — counting it in the mode bar put 5k+ tokens of probe payload on the
    // report for lore-heavy worlds. The mode bar below is re-measured with HEAVY_ACTION instead.
    const probeAction = [allKeywords, longestEntryWords(world.lorebook), ACTION].filter(Boolean).join(" ");
    const state = makeSession(world, stats, { turn: 46, summary: true, threads: 5, manual: true, memAuto: 14, memName: MEMORY_NAME_FEED_CAP, digest: true, npcCount: heavyNpcCount, map: 10 });
    // The probe action is passed as the LATEST ACTION (the `action` arg) — appending it to
    // the history too would let it anchor a phantom trailing turn, which the RECENT EVENTS window
    // would then count as one of its turns and push a real turn out (making the "worst case"
    // transcript shorter than typical). Keep the history to real turns, built from the same names
    // as typical's so RECENT EVENTS measures identically in both scenarios.
    const ctx = engine.buildContext(state, makeHistory(30, inPlayNames), probeAction, "action", false, {
      includeSurroundings: !!state.map, check: world.statDefs.length ? sampleCheck() : undefined
    });
    const probeInput = count(ctx);
    const sections = scaleSections(splitSections(ctx, count), probeInput);
    // Swap the probe payload back out of the mode bar: report what a real heavy turn's action
    // costs (two short paragraphs), keeping the probe-triggered lore / memory / NPC sections as
    // the worst-case caps. Adjust the total by the same delta so the bars still sum to it.
    const realisticModeText = "LATEST ACTION: " + HEAVY_ACTION;
    const realisticModeTokens = count(realisticModeText);
    let gmInput = probeInput;
    const mi = sections.findIndex((s) => s.key === "mode");
    if (mi >= 0) {
      gmInput = probeInput - (sections[mi].tokens - realisticModeTokens);
      sections[mi] = { ...sections[mi], tokens: realisticModeTokens, text: realisticModeText };
    }
    scenarios.heavy = { label: "Worst case", note: heavyNote, gmInput, sections };
  }

  const { calls } = await measureCalls(world, promptText, stats);
  return {
    ideal, promptLoaded: !!promptText, warnings, scenarios, calls,
    output: { typical: count(REPLY_TYPICAL), heavy: count(REPLY_HEAVY) },
    counts: { lore: (world.lorebook || []).length, npcs: npcNames.length, stats: world.statDefs.length, trackers: world.trackerDefs.length, npcTrackers: (world.npcTrackerDefs || []).length }
  };
}
function sampleCheck() {
  return { stat: "str", statLabel: "Strength", mod: 3, die: 12, total: 15, dc: 12, passed: true, margin: 3, crit: null };
}

/* ---------- rendering ---------- */
const ratioClass = (used, budget) => (used <= budget ? "cb-under" : used <= budget * 1.5 ? "cb-near" : "cb-over");
// Whole-turn total (all the calls a single player message fires), for one scenario.
export function turnTotal(rep, mode) {
  const sc = rep.scenarios[mode] || rep.scenarios.typical;
  let t = sc.gmInput + (mode === "heavy" ? rep.output.heavy : rep.output.typical);
  if (rep.calls.tracker) t += rep.calls.tracker.input + rep.calls.tracker.maxOut;
  if (rep.calls.npcTracker) t += rep.calls.npcTracker.input + rep.calls.npcTracker.maxOut;
  if (rep.calls.check) t += rep.calls.check.input + rep.calls.check.maxOut;
  if (rep.calls.rollup) t += rep.calls.rollup.amortized;
  return t;
}
function rowHtml(label, tokens, max) {
  const pct = tokens > 0 && max > 0 ? Math.max(2, Math.round((tokens / max) * 100)) : 0;
  return `<div class="cb-row"><span class="cb-rl">${esc(label)}</span>` +
    `<span class="cb-rbar"><span class="cb-rfill" style="width:${pct}%"></span></span>` +
    `<span class="cb-rv">${tokens.toLocaleString()}</span></div>`;
}

export function renderContextTab(container, fileForm, { onReport } = {}) {
  container.innerHTML = `<div class="cb-loading"><span class="spin spin-sm"></span> Measuring this world's context…</div>`;
  measureContextBudget(fileForm).then((rep) => {
    if (!container.isConnected) return;
    if (!rep) {
      container.innerHTML = `<div class="ce-sec-note dim">Couldn't measure this world — save it first, then reopen this tab.</div>`;
      return;
    }
    paintReport(container, rep);
    if (onReport) onReport(rep);
  }).catch((e) => {
    if (!container.isConnected) return;
    container.innerHTML = `<div class="ce-sec-note dim">Measurement failed: ${esc((e && e.message) || e)}</div>`;
  });
}

function paintReport(container, rep) {
  let mode = rep.scenarios.typical ? "typical" : "opening";
  container.innerHTML = `
    <div class="ce-sec">Context budget <span class="ce-note">estimated tokens per turn with this world</span></div>
    <div class="cb-seg">
      ${["opening", "typical", "heavy"].map((m) => rep.scenarios[m] ? `<button type="button" class="mini cb-segb" data-m="${m}">${esc(rep.scenarios[m].label)}</button>` : "").join("")}
    </div>
    <div class="cb-hero" id="cbHero"></div>
    <div class="cb-note">The budget line is the Perchance ai-text plugin's recommended context window (${rep.ideal.toLocaleString()} tokens) — a target, not a hard limit. Sections are measured from the real prompt this world builds; the transcript window holds the engine's last 10 turns, and outputs use sample replies since the GM call isn't length-capped.</div>
    <div class="ce-sec">Where the GM prompt goes</div>
    <div class="cb-rows" id="cbRows"></div>
    <div class="ce-sec">Every call in a turn <span class="ce-note">input + max output</span></div>
    <div class="cb-calls">
      <div class="cb-call"><span class="cb-cl">GM narration</span><span class="cb-cv" id="cbCallGm"></span></div>
      ${rep.calls.check ? `<div class="cb-call"><span class="cb-cl">Skill-check referee</span><span class="cb-cv">${rep.calls.check.input.toLocaleString()} + ≤${rep.calls.check.maxOut}</span></div>` : ""}
      ${rep.calls.tracker ? `<div class="cb-call"><span class="cb-cl">Tracker update</span><span class="cb-cv">${rep.calls.tracker.input.toLocaleString()} + ≤${rep.calls.tracker.maxOut}</span></div>` : ""}
      ${rep.calls.npcTracker ? `<div class="cb-call"><span class="cb-cl">NPC tracker update</span><span class="cb-cv">${rep.calls.npcTracker.input.toLocaleString()} + ≤${rep.calls.npcTracker.maxOut}</span></div>` : ""}
      ${rep.calls.rollup ? `<div class="cb-call"><span class="cb-cl">Memory roll-up <span class="cb-cn">every ${MEMORY_EVERY_TURNS} turns</span></span><span class="cb-cv">${rep.calls.rollup.input.toLocaleString()} + ≤${rep.calls.rollup.maxOut} <span class="cb-cn">≈${rep.calls.rollup.amortized}/turn</span></span></div>` : ""}
    </div>
    <div class="cb-total" id="cbTotal"></div>
    ${rep.warnings.length ? `<div class="cb-warn">${rep.warnings.map((w) => "• " + esc(w)).join("<br>")}</div>` : ""}
  `;

  const heroEl = container.querySelector("#cbHero");
  const rowsEl = container.querySelector("#cbRows");
  const totalEl = container.querySelector("#cbTotal");
  const gmCallEl = container.querySelector("#cbCallGm");
  const segs = [...container.querySelectorAll(".cb-segb")];

  const draw = () => {
    const sc = rep.scenarios[mode];
    const cls = ratioClass(sc.gmInput, rep.ideal);
    const pct = Math.min(100, Math.round((sc.gmInput / rep.ideal) * 100));
    const over = sc.gmInput > rep.ideal ? ` <b class="${cls}">+${(sc.gmInput - rep.ideal).toLocaleString()} over</b>` : "";
    heroEl.innerHTML =
      `<div class="cb-hero-top"><span class="cb-hero-lbl">GM narration call</span>` +
      `<span class="cb-hero-num ${cls}">${sc.gmInput.toLocaleString()}<span class="cb-hero-div"> / ${rep.ideal.toLocaleString()}</span>${over}</span></div>` +
      `<div class="cb-bar"><span class="cb-fill ${cls}" style="width:${pct}%"></span></div>` +
      `<div class="cb-hero-sub">${esc(sc.note)}</div>`;

    const sections = sc.sections || [];
    const maxTok = Math.max(1, ...sections.map((s) => s.tokens));
    rowsEl.innerHTML = sections.map((s) => rowHtml(s.label, s.tokens, maxTok)).join("") ||
      `<div class="cb-row cb-row-dim"><span class="cb-rl">No session content yet — just the opening prompt.</span></div>`;

    const outTok = mode === "heavy" ? rep.output.heavy : rep.output.typical;
    gmCallEl.textContent = `${sc.gmInput.toLocaleString()} + ≈${outTok}`;
    const total = turnTotal(rep, mode);
    // No ratio coloring here: the budget line is a PER-CALL window, while this total sums
    // several separate calls — judging it against that window would be misleading.
    totalEl.innerHTML = `<span>Whole turn, all calls:</span> <b>≈${total.toLocaleString()} tokens</b>`;

    segs.forEach((b) => b.classList.toggle("on", b.dataset.m === mode));
  };
  segs.forEach((b) => { b.onclick = () => { mode = b.dataset.m; draw(); }; });
  draw();
}
