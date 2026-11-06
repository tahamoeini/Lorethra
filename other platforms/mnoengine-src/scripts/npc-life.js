// NPC private life — off-screen background tick.
//
// What this is: every NPC_LIFE_EVERY_TURNS turns, a single background AI call advances a few
// OFF-SCREEN NPCs (seen a while ago, not in the current scene). Each gets its
// mini-goal advanced (auto-invented when missing, so worlds that never
// authored one still get private lives); a memory is recorded ONLY when
// something worth remembering happened (same bar as the roll-up — routine
// errands update the goal and leave no memory). NPC-NPC scenes are allowed.
// Owner-gating in memory-system.js keeps memories private: an NPC-only memory
// surfaces only while that NPC is present. The goal itself reaches the GM as
// one `Pursuit:` clause in the dossier (see RPEngine.npcProfile), so mundane
// continuity survives without spending a memory on it.
//
// What this is NOT:
//   - It never touches presence: lastSeenTurn / appearanceCount / everSpoke /
//     firstSeenTurn / npcSpotlight are left alone. Only lifeGoal/lifeHistory/
//     lifeTick/lifeWhere on the entry plus a new entry in state.memories.auto
//     are written.
//   - Its input is deliberately NPC-centric, NOT player-centric: dossier +
//     lifeGoal + past goals + the NPC's own private memories + a TIME anchor (day/time/
//     location) + a cast name list for interaction partners + at most 2
//     world-owned public facts for grounding + a compact WORLD block (premise
//     + vibe, truncated — genre/setting coherence only, no plot). It never
//     sees latestSituation, openThreads, the recent transcript, or the player's
//     latest action — those revolve around the hero, while this call is about
//     the NPCs' own lives. The opening scene (startText) is likewise excluded:
//     it stages the hero, not the world.
//   - The hero stays off-stage in the prompt (named, so the rule is actionable):
//     the NPCs' lives revolve around themselves, not around the hero — caring
//     about the hero (a gift, a debt, missing them) is fine, staging scenes
//     with them or advancing their quests is not.
//
// Cadence lives in main.js's saveAndMaybeMemory (after the memory roll-up):
// state.lastNpcLifeTurn advances on success OR when there is nothing to do;
// on failure it backs off so the remainder retries soon without firing
// every turn (same pattern as MemorySystem.markRollUpFailed).

import { normalizeOwner, deriveTriggers } from "./memory-system.js";
import { heroNameOf, subUser, blankDetail, compactNpcLine } from "./text-utils.js";
import { nameHit } from "./lorebook.js";
import { getCurrentTrackers, locationValue, dayValue, timeValue } from "./trackers.js";

export const NPC_LIFE_EVERY_TURNS = 5;
export const NPC_LIFE_RETRY_GAP_TURNS = 7;
// Truly off-screen: beyond the Present recency window (NPC_RECENT_SEEN = 3),
// with one extra turn of margin so a just-left face settles first.
export const NPC_LIFE_MIN_OFFSCREEN_TURNS = 4;
export const NPC_LIFE_MAX_PER_TICK = 2;
// Per-NPC context caps keep the prompt small: dossier is already bounded by
// profile generation, memories are the latest few only, and cross-talk is a
// couple of recent mentions at most.
export const NPC_LIFE_MEMORIES_PER_NPC = 3;
export const NPC_LIFE_PUBLIC_FACTS = 2;
// Cross-talk window: another NPC's recent doing involving this one is only
// worth feeding while it's fresh — stale threads live in the goal/memories
// already, or died quietly.
export const NPC_LIFE_MENTION_WINDOW_TURNS = 10;
export const NPC_LIFE_MENTIONS_PER_NPC = 2;
// Likely company: partners a candidate's threads point at get a sketch line so
// meetings play true to character (capped — the full pool stays name-only).
export const NPC_LIFE_COMPANY_MAX = 2;
export const NPC_LIFE_SKETCH_MAX_CHARS = 120;
export const NPC_LIFE_EVENT_MAX_CHARS = 400;
export const NPC_LIFE_GOAL_MAX_CHARS = 200;
// Goal history: the previous few mini-goals, oldest-first, so a tick can see
// the trajectory (started → continued → now) instead of a single snapshot.
// Routine ticks record no memory, so without this the steps between memories
// are invisible — the goal string alone has to carry them, and vague rewrites
// ("mending the roof") lose the step. Kept small on purpose: 5 previous goals
// + the current one is a 6-point arc, enough for longer multi-step errands
// without bloating the prompt. Stored on entry.lifeHistory (array of
// {goal, turn} — turn is the tick that set the goal, -1 when unknown).
export const NPC_LIFE_HISTORY_MAX = 5;
// Current whereabouts: a short place phrase ("at the Rusty Anchor tavern").
// Stored on entry.lifeWhere every tick, fed back into the next tick (so the
// NPC's movements stay continuous) and into the GM's hook lines (so the hero
// can run into them where they actually are — see RPEngine.npcHook).
export const NPC_LIFE_WHERE_MAX_CHARS = 120;
// Per-tick story angle: one randomly drawn lens per candidate per call, injected
// into their block. Identical game states must still diverge (the provider
// offers no temperature/seed control, so sampling alone can't be trusted for
// variance) — the tilt gives even a greedy decoder a different starting angle
// every tick and every instance, while continuity rules keep it on-thread.
const NPC_LIFE_TILTS = [
  "an inconvenience intrudes on their plans",
  "someone else's need interrupts their day",
  "an old thread resurfaces unexpectedly",
  "the weather and time of day color everything",
  "a small pleasure comes first, duty after",
  "an opportunity to finally finish this appears — take it or deliberately pass it up",
  "curiosity pulls them somewhere unplanned",
  "a craving or appetite drives the errand",
  "a rumor they've heard shapes what they do",
  "they decide to wrap this up one way or another — finish it, hand it off, or drop it",
  "help arrives or a shortcut appears",
  "nostalgia steers them toward a familiar place or face, closing an old loop"
];
function tiltFor() {
  return NPC_LIFE_TILTS[Math.floor(Math.random() * NPC_LIFE_TILTS.length)];
}
// First-goal invention brief: a randomly drawn constraint on WHAT the new want
// must involve (domain × horizon). The tilt only bends how a beat plays out —
// identical dossiers still converge on the same core goal with new garnish.
// The brief forces a different core: a livelihood want eyed for today is a
// different goal than a secret want eyed for this week, not a rewording. (An
// involved-person element was tried and dropped — fully random faces produced
// forced, unconvincing ties; the Likely-company sketches already give the call
// real partners when a scene needs one.) Drawn only while inventing (no goal
// and no history); continuation ticks stay on tilt + anti-repeat, and differing
// first events grow differing memories, so trajectories separate from there.
const NPC_LIFE_INVENT_DOMAINS = [
  "center on their livelihood or craft",
  "center on a domestic need or chore",
  "center on a social tie — a friend, rival, or family member",
  "center on a small personal craving or comfort",
  "center on something they own, owe, or are owed",
  "center on a pastime or hobby",
  "center on a secret want they'd never voice aloud",
  "center on a place they like to be"
];
function inventBriefFor() {
  const domain = NPC_LIFE_INVENT_DOMAINS[Math.floor(Math.random() * NPC_LIFE_INVENT_DOMAINS.length)];
  const horizon = Math.random() < 0.5 ? "today" : "in the next few days";
  return { domain, horizon };
}
// Compact world-grounding caps: premise + vibe are coherence anchors (genre,
// tech level, tone), not plot — kept short so the prompt stays NPC-centric.
export const NPC_LIFE_WORLD_MAX_CHARS = 600;
export const NPC_LIFE_VIBE_MAX_CHARS = 200;

// (blankDetail lives in text-utils.js — shared with the GM context.)

// Same bar as the GM context: an entry counts as profiled when at least one
// detail field holds real text (see RPEngine.inPlayNpcs / npc-system).
function hasDetails(entry) {
  const d = (entry && entry.details) || {};
  return Object.values(d).some((v) => !blankDetail(v));
}

// One-line dossier for the life tick. Secrets ARE included: this call reasons
// about the NPC's private life, so it needs their hidden motives — the
// resulting memory text itself stays factual and never pastes secrets verbatim
// (instructed in the prompt).
function dossierFor(entry, heroName) {
  const d = (entry && entry.details) || {};
  const bits = [];
  for (const [k, label] of [["age", "Age"], ["gender", "Gender"], ["race", "Race"], ["appearance", "Appearance"], ["job", "Job"], ["persona", "Persona"], ["extra", "Extra"], ["secrets", "Secrets"]]) {
    const v = String(d[k] == null ? "" : d[k]).trim();
    if (v && !blankDetail(v)) bits.push(`${label}: ${subUser(v, heroName)}`);
  }
  const head = String((entry && entry.name) || "").trim() || "(unnamed)";
  const desc = String((entry && entry.description) || "").trim();
  const body = bits.length ? bits.join("; ") : (desc ? subUser(desc, heroName) : "no profile yet");
  return `- ${head} — ${body}`;
}

// Past mini-goals, oldest-first, sanitized for the prompt. Entries are
// {goal, turn} (turn = the tick that set the goal, -1 when unknown — e.g.
// goals stored before turns were recorded). Anything stored is already capped
// at GOAL_MAX_CHARS by tick()/normalize, so this just drops empties and
// enforces HISTORY_MAX (old saves may predate the cap).
function pastGoalsFor(entry) {
  const h = entry && Array.isArray(entry.lifeHistory) ? entry.lifeHistory : [];
  return h.map((g) => {
    if (g && typeof g === "object") {
      return {
        goal: String(g.goal == null ? "" : g.goal).trim(),
        turn: (typeof g.turn === "number" && g.turn >= 0) ? Math.floor(g.turn) : -1
      };
    }
    return { goal: String(g == null ? "" : g).trim(), turn: -1 };
  })
    .filter((g) => g.goal)
    .slice(-NPC_LIFE_HISTORY_MAX);
}

// Exact-lowercased owner-token match (v1: no fuzzy leniency — the writer is
// told to use exact roster spellings, and ambiguous matches must not attach
// private history to the wrong character).
function memoryOwnedBy(m, nameLower) {
  if (!m || !nameLower) return false;
  const toks = String(m.owner || "").split(/[,+]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  return toks.includes(nameLower);
}

function latestOwnedMemories(state, npcName, n) {
  const lower = String(npcName || "").trim().toLowerCase();
  const list = ((state && state.memories && state.memories.auto) || []).filter((m) => memoryOwnedBy(m, lower));
  list.sort((a, b) => {
    const at = typeof a.turn === "number" && a.turn >= 0 ? a.turn : -1;
    const bt = typeof b.turn === "number" && b.turn >= 0 ? b.turn : -1;
    if (at !== bt) return bt - at;
    return (b.ts || 0) - (a.ts || 0);
  });
  return list.slice(0, n);
}

function latestPublicMemories(state, n) {
  const list = ((state && state.memories && state.memories.auto) || [])
    .filter((m) => String(m.owner || "").trim().toLowerCase() === "world");
  list.sort((a, b) => {
    const at = typeof a.turn === "number" && a.turn >= 0 ? a.turn : -1;
    const bt = typeof b.turn === "number" && b.turn >= 0 ? b.turn : -1;
    if (at !== bt) return bt - at;
    return (b.ts || 0) - (a.ts || 0);
  });
  return list.slice(0, n);
}

// Cross-talk: other NPCs' recent doings involving this NPC — the seeds of
// NPC-NPC scenes. Scans every auto memory the candidate does NOT own for a
// mention of their name (same nameHit the memory owner-gate uses, so mention
// detection can never drift from presence detection). Only fresh threads
// qualify (within MENTION_WINDOW turns); stale ones live in the goal/memories
// already or died quietly. Excluded by design:
//   - memories the candidate owns (already in their block — never duplicated),
//   - world-owned facts (they ride in PUBLIC FACTS instead),
//   - hero-only-owned memories (the hero's private knowledge — feeding those
//     would let the NPC act on things they were never told).
// What remains always has at least one OTHER NPC holder: a thread the NPC may
// plausibly hear of, be sought out about, or follow up on.
function recentMentions(state, npcName, hero) {
  const lower = String(npcName || "").trim().toLowerCase();
  const heroLower = String(hero || "").trim().toLowerCase();
  const turnNow = (state && state.turn) || 0;
  const out = [];
  for (const m of ((state && state.memories && state.memories.auto) || [])) {
    if (!m || !String(m.text || "").trim()) continue;
    if (memoryOwnedBy(m, lower)) continue;
    const toks = String(m.owner || "").split(/[,+]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!toks.some((t) => t !== "world" && t !== heroLower)) continue;
    const mt = typeof m.turn === "number" && m.turn >= 0 ? m.turn : turnNow;
    if (turnNow - mt > NPC_LIFE_MENTION_WINDOW_TURNS) continue;
    try {
      if (!nameHit(String(m.text || ""), npcName)) continue;
    } catch (e) { continue; }
    out.push(m);
  }
  out.sort((a, b) => {
    const at = typeof a.turn === "number" && a.turn >= 0 ? a.turn : -1;
    const bt = typeof b.turn === "number" && b.turn >= 0 ? b.turn : -1;
    if (at !== bt) return bt - at;
    return (b.ts || 0) - (a.ts || 0);
  });
  return out.slice(0, NPC_LIFE_MENTIONS_PER_NPC);
}

// Tracked-state snapshot at (or just before) an anchored turn: the last
// message carrying afterTrackers whose turn is <= target. Falls back to the
// session's initial trackers when nothing qualifies (early game). The clock
// is shared world state, so a hero snapshot's day/time IS the NPC's day/time;
// the place is the NPC's own place ONLY at lastSeen (they were together with
// the hero then) — never at later ticks, when the NPC has moved on.
function snapshotAtTurn(state, trackerDefs, targetTurn) {
  const msgs = (state && state.messages) || [];
  let t = 0;
  let best = null;
  for (const m of msgs) {
    if (m && (m.role === "action" || m.role === "direct")) t++;
    if (t > targetTurn) break;
    if (m && m.afterTrackers && typeof m.afterTrackers === "object") best = m.afterTrackers;
  }
  if (best) return best;
  if (state && state.initialTrackers && typeof state.initialTrackers === "object") return state.initialTrackers;
  return null;
}

// Day/time (/place) strings out of a snapshot. Resolved through the day/time/location
// matchers so renamed keys still anchor; the literal scan is the fallback when the
// world defines no matching tracker (or defs are unavailable).
function clockOf(snap, trackerDefs) {
  if (!snap || typeof snap !== "object") return { day: "", time: "", loc: "" };
  const literal = (keys) => {
    for (const k of keys) {
      for (const ck of Object.keys(snap)) {
        if (ck.toLowerCase() === k && snap[ck] !== undefined && snap[ck] !== null && String(snap[ck]).trim() !== "") return String(snap[ck]).trim();
      }
    }
    return "";
  };
  let day = "", time = "", loc = "";
  try {
    if (Array.isArray(trackerDefs) && trackerDefs.length) {
      day = dayValue(trackerDefs, snap);
      time = timeValue(trackerDefs, snap);
      loc = String(locationValue(trackerDefs, snap) || "").trim();
    }
  } catch (e) {}
  if (!day) day = literal(["day", "date"]);
  if (!time) time = literal(["time", "dayname"]);
  if (!loc) loc = literal(["location"]);
  return { day, time, loc };
}

// Recover one JSON object from an LLM reply — same shape as the memory
// roll-up expects (strict parse, then vendored jsonrepair).
async function parseJsonObject(t) {
  const s = String(t || "").trim();
  const fenced = (s.match(/```[a-zA-Z]*\s*([\s\S]*?)```/) || [])[1];
  const cands = [fenced, s].filter(Boolean);
  const chunks = [];
  for (const c of cands) {
    const o = c.indexOf("{");
    const e = c.lastIndexOf("}");
    if (o >= 0 && e > o) chunks.push(c.slice(o, e + 1));
  }
  for (const ch of chunks) { try { return JSON.parse(ch); } catch (_) {} }
  try {
    const rep = await import("../vendor/jsonrepair.mjs").then((m) => m.jsonrepair);
    for (const ch of chunks) { try { return JSON.parse(rep(ch)); } catch (_) {} }
  } catch (_) {}
  return null;
}

function contentWords(t) {
  const out = new Set();
  for (const w of String(t || "").toLowerCase().match(/[a-z0-9]+(?:['’'-][a-z0-9]+)*/g) || []) {
    if (w.length >= 4) out.add(w);
  }
  return out;
}

// Goal overlap: max coverage either way — catches both paraphrase ("mending
// the roof" → "mending the old roof again") and extension ("Transport the
// magazine" → "Transport the magazine (currently scrambling…)"). Returns 0..1.
function goalOverlapScore(a, b) {
  const wa = contentWords(a);
  const wb = contentWords(b);
  if (!wa.size || !wb.size) return 0;
  let hit = 0;
  for (const w of wa) if (wb.has(w)) hit++;
  const denom = Math.min(wa.size, wb.size);
  return denom ? hit / denom : 0;
}
// True when the new goal rehashes any compared goal (>=70% of the smaller
// goal's content words shared — same bar as the event near-dup guard).
function isNearDupGoal(newGoal, compared) {
  const w = contentWords(newGoal);
  if (w.size < 4) return false; // too short to judge — let it through
  for (const g of compared || []) {
    if (!g) continue;
    if (goalOverlapScore(newGoal, g) >= 0.7) return true;
  }
  return false;
}
// Ticks spent on the same want: 1 + trailing history entries overlapping the
// current goal. A magazine errand on its 4th rewording reports 4, even though
// each string differs by a parenthetical.
function threadAgeFor(entry) {
  const cur = String((entry && entry.lifeGoal) || "").trim();
  if (!cur) return 0;
  const hist = pastGoalsFor(entry);
  let age = 1;
  for (let i = hist.length - 1; i >= 0; i--) {
    if (goalOverlapScore(cur, hist[i].goal) >= 0.6) age++;
    else break;
  }
  return age;
}
// Follow-up invention brief (conclusion path): same domain×horizon draw as
// first invention, so the NEXT want after a resolution is a genuinely new
// core, not the same errand with new garnish.
function followupBriefFor() {
  return inventBriefFor();
}

export class NpcLifeSystem {
  constructor(genText) {
    this.genText = genText;
    this.lastReport = null; // { added } of the most recent tick (for toasts/tests)
    this.lastLifeCall = null; // exact prompt of the most recent tick send, for the ctx meter: { turn, npcs, text }
  }

  // Eligible off-screen NPCs: profiled, visible in the shown story
  // (lastSeenTurn >= 0 — demoted -1 entries were edited/rerolled away),
  // unseen for at least MIN_OFFSCREEN turns. Sorted oldest-simulated first
  // so every face surfaces over time; capped per tick.
  candidates(state) {
    const turnNow = (state && state.turn) || 0;
    const all = Object.values((state && state.npcs) || {});
    const out = [];
    for (const e of all) {
      if (!e || typeof e !== "object") continue;
      if (!e.name || !hasDetails(e)) continue;
      const ls = typeof e.lastSeenTurn === "number" ? e.lastSeenTurn : 0;
      if (ls < 0) continue; // not in shown story — never simulated
      if (turnNow - ls < NPC_LIFE_MIN_OFFSCREEN_TURNS) continue; // still present/recent
      out.push(e);
    }
    out.sort((a, b) => {
      const la = typeof a.lifeTick === "number" ? a.lifeTick : -1;
      const lb = typeof b.lifeTick === "number" ? b.lifeTick : -1;
      if (la !== lb) return la - lb;
      return (a.lastSeenTurn || 0) - (b.lastSeenTurn || 0);
    });
    return out.slice(0, NPC_LIFE_MAX_PER_TICK);
  }

  // The prompt is NPC-centric by construction: each candidate's dossier +
  // current mini-goal + their own private memories, per-NPC time anchors, a
  // cast list for NPC-NPC interaction, minimal public grounding, and a
  // compact WORLD block (premise + vibe). Deliberately absent: latestSituation,
  // openThreads, transcript, player action, opening scene.
  buildInstruction(state, cands, ctx = {}) {
    const hero = heroNameOf(state);
    const trackerDefs = Array.isArray(ctx.trackerDefs) ? ctx.trackerDefs : [];
    // World-grounding: permanent premise + tone, truncated to coherence
    // anchors. Safe to feed (unlike latestSituation/openThreads): they describe
    // the setting and genre, never the hero's plot — so an off-screen smith
    // keeps forging in a bronze-age tone instead of opening a smartphone.
    const worldBits = [];
    const premise = String(ctx.scenarioText || "").trim().slice(0, NPC_LIFE_WORLD_MAX_CHARS);
    if (premise) worldBits.push(`Premise: ${premise}`);
    const vibe = String(ctx.vibeText || "").trim().slice(0, NPC_LIFE_VIBE_MAX_CHARS);
    if (vibe) worldBits.push(`Vibe: ${vibe}`);
    // Shared clock, never the hero's place: the NPC is off-screen elsewhere,
    // so the hero's current location would mis-stage their private life. Each
    // candidate below carries its own anchor instead — base turn + day/time
    // reconstructed from tracker snapshots, the place ONLY on the
    // never-simulated-since-seen line (then hero and NPC were still together),
    // plus the current turn/clock and the elapsed turns stated outright.
    let timeAnchor = "";
    try {
      const cur = getCurrentTrackers(state, trackerDefs);
      let day = "", time = "";
      try {
        if (Array.isArray(trackerDefs) && trackerDefs.length) {
          day = dayValue(trackerDefs, cur);
          time = timeValue(trackerDefs, cur);
        }
      } catch (e) {}
      if (!day || !time) {
        const literal = (keys) => {
          for (const k of keys) {
            for (const ck of Object.keys(cur || {})) {
              if (ck.toLowerCase() === k && cur[ck] !== undefined && cur[ck] !== null && String(cur[ck]).trim() !== "") return String(cur[ck]).trim();
            }
          }
          return "";
        };
        if (!day) day = literal(["day", "date"]);
        if (!time) time = literal(["time", "dayname"]);
      }
      timeAnchor = [day ? `Day: ${day}` : "", time ? `Time: ${time}` : ""].filter(Boolean).join(" · ");
    } catch (e) { timeAnchor = ""; }

    const publicFacts = latestPublicMemories(state, NPC_LIFE_PUBLIC_FACTS)
      .map((m) => `- ${String(m.text || "").trim()}`).filter(Boolean).join("\n");

    // Interaction pool: other profiled faces (1-line job hooks), so the call
    // can stage NPC-NPC scenes with exact roster spellings.
    const roster = Object.values((state && state.npcs) || {}).filter((e) => e && e.name);
    const byLower = new Map(roster.map((en) => [String(en.name).trim().toLowerCase(), en]));
    const heroLower = String(hero || "").trim().toLowerCase();
    // Character sketch for casting off-screen scenes: the same compactNpcLine
    // the GM's hooks use (job + first real trait — persona, extra, appearance,
    // description), `{{user}}`-resolved. Secrets are DELIBERATELY excluded by
    // that builder: the call directs other NPCs in scenes, so it gets how
    // they act — never what they're hiding. (Acting on another NPC's secrets
    // would be a leak: the candidate was never told them.)
    function sketchOf(entry) {
      return subUser(compactNpcLine(entry, NPC_LIFE_SKETCH_MAX_CHARS), hero);
    }
    const pool = roster
      .filter((e) => hasDetails(e))
      .slice(0, 20)
      .map((e) => {
        const job = String((e.details && e.details.job) || "").trim();
        return `- ${e.name}${job && !blankDetail(job) ? ` (${subUser(job, hero)})` : ""}`;
      }).join("\n");

    const blocks = cands.map((e) => {      const mems = latestOwnedMemories(state, e.name, NPC_LIFE_MEMORIES_PER_NPC);
      const memTxt = mems.length
        ? mems.map((m) => `- [turn ${typeof m.turn === "number" ? m.turn : "?"}] ${String(m.text || "").trim()}`).join("\n")
        : "(none yet)";
      const goal = String(e.lifeGoal || "").trim() || "(none yet — invent one)";
      // Goal trajectory: the previous few goals show where this thread came
      // from, so the next step continues instead of restarting. Omitted on the
      // first tick (nothing behind the current goal yet).
      const pastGoals = pastGoalsFor(e);
      const pastTxt = pastGoals.length
        ? `\nPrevious mini-goals (oldest first):\n${pastGoals.map((g) => `- ${g.turn >= 0 ? `[turn ${g.turn}] ` : ""}${g.goal}`).join("\n")}`
        : "";
      // Cross-talk threads: what other NPCs have recently been up to involving
      // this one (omitted when none — keeps the prompt lean). Each line names
      // its holder, so the call can follow up with exactly that NPC.
      const mentions = recentMentions(state, e.name, hero);
      const menTxt = mentions.map((m) => {
        const t = typeof m.turn === "number" && m.turn >= 0 ? m.turn : "?";
        const who = String(m.owner || "").trim() || "someone";
        return `- [turn ${t}, ${who}] ${String(m.text || "").trim()}`;
      }).join("\n");
      // Last reported whereabouts, fed back so the NPC's movements stay
      // continuous across ticks (still there vs moved on) instead of
      // teleporting each time.
      const lastWhere = String(e.lifeWhere || "").trim() || "(unknown — place them somewhere fitting)";
      // Invention brief (first goal only — no goal and no history): a drawn
      // constraint on WHAT the new want must involve, so identical dossiers in
      // identical states still invent different cores, not rewordings.
      const inventing = !String(e.lifeGoal || "").trim() && pastGoals.length === 0;
      let briefTxt = "";
      if (inventing) {
        const b = inventBriefFor();
        briefTxt = `\nInvention brief (follow it — this shapes the new want): it must ${b.domain}, with an eye on ${b.horizon}.`;
      }
      // Staleness: same want reworded tick after tick. Force a conclusion —
      // the model cannot count this on its own, so state it outright.
      const threadAge = threadAgeFor(e);
      let staleTxt = "";
      if (!inventing && threadAge >= 3) {
        const f = followupBriefFor();
        staleTxt = `\nTHREAD AGE: this same want has run ${threadAge} ticks — it MUST conclude this tick (delivered, finished, failed, handed off, or abandoned — pick what fits). Set event to the outcome (never null), and write the NEXT want as the new goal. The next want must be genuinely DIFFERENT (different activity, people, or place): it must ${f.domain}, with an eye on ${f.horizon}.`;
      }
      // Likely company: the partners this candidate's threads actually point
      // at — holders of the cross-talk lines above first, then NPCs sharing
      // their recent co-owned memories (ongoing relationships). Capped at
      // COMPANY_MAX; each gets a sketch line so meetings play true to
      // character. Omitted when none — KNOWN FACES still lists every valid
      // partner, just without character notes.
      const selfLower = String(e.name).trim().toLowerCase();
      const company = [];
      const consider = (ownerStr) => {
        for (const w of String(ownerStr || "").split(/[,+]/)) {
          if (company.length >= NPC_LIFE_COMPANY_MAX) break;
          const t = String(w || "").trim();
          if (!t) continue;
          const tl = t.toLowerCase();
          if (tl === selfLower || tl === heroLower || tl === "world") continue;
          const canon = byLower.get(tl);
          if (!canon || !hasDetails(canon)) continue;
          if (company.some((c) => c.toLowerCase() === canon.name.toLowerCase())) continue;
          company.push(canon.name);
        }
      };
      for (const m of mentions) consider(m.owner);
      for (const m of mems) consider(m.owner);
      const compTxt = company.map((n) => sketchOf(byLower.get(String(n).trim().toLowerCase()))).join("\n");
      // Per-NPC time anchor so the call knows how much life happened since it
      // last touched this face — both ends stated explicitly (models do the
      // subtraction wrong). Base = last simulation when one exists since the
      // last meeting, else the meeting itself. The place rides ONLY on the
      // never-simulated-since-seen line: then hero and NPC were together, so
      // the snapshot's location is the NPC's own starting point. On later
      // ticks the NPC has moved on — their place lives in goal/memories now,
      // and re-feeding the old spot would drag them back to it.
      const turnNow = (state && state.turn) || 0;
      const ls = typeof e.lastSeenTurn === "number" ? e.lastSeenTurn : 0;
      const lt = typeof e.lifeTick === "number" ? e.lifeTick : -1;
      const simulatedSinceSeen = lt >= ls && lt >= 0;
      const base = simulatedSinceSeen ? lt : ls;
      const elapsed = Math.max(0, turnNow - base);
      const bc = clockOf(snapshotAtTurn(state, trackerDefs, base), trackerDefs);
      const whenBits = [`turn ${base}`];
      if (bc.day) whenBits.push(`Day ${bc.day}`);
      if (bc.time) whenBits.push(bc.time);
      let anchor;
      if (!simulatedSinceSeen && bc.loc) {
        anchor = `Last seen: ${whenBits.join(", ")}, at ${bc.loc} — ${elapsed} turn${elapsed === 1 ? "" : "s"} ago.`;
      } else if (!simulatedSinceSeen) {
        anchor = `Last seen: ${whenBits.join(", ")} — ${elapsed} turn${elapsed === 1 ? "" : "s"} ago.`;
      } else {
        anchor = `Last updated: ${whenBits.join(", ")} — ${elapsed} turn${elapsed === 1 ? "" : "s"} ago.`;
      }
      return `NPC: ${e.name}\n${anchor}\nDossier: ${dossierFor(e, hero)}\nCurrent mini-goal: ${goal}${pastTxt}\nLast whereabouts: ${lastWhere}${compTxt ? `\nLikely company:\n${compTxt}` : ""}\nTheir private memories:\n${memTxt}${menTxt ? `\nOthers' recent doings involving ${e.name}:\n${menTxt}` : ""}${briefTxt}${staleTxt}\nAngle for this tick: ${tiltFor()} — let it color the new step (it bends how the beat plays out, never what thread is being pursued).`;
    }).join("\n\n");

    // Hero line: name them so "don't revolve around the hero" is actionable.
    // The model never gets a hero sheet — just a name + off-stage status — so
    // a dossier line like "loves Kael" can't be mistaken for an NPC-NPC tie.
    const heroIsNamed = hero && hero !== "the hero";
    const heroLine = heroIsNamed
      ? `Hero ${hero} is OFF-STAGE (elsewhere, not in these scenes).`
      : `The hero/player is OFF-STAGE (elsewhere, not in these scenes).`;

    return [
      `You are the private-life keeper for a text RPG. ${heroLine} These NPCs are living their own lives elsewhere — for each NPC below, advance their personal story by a small, plausible step.`,
      "",
      "Rules:",
      "- Each NPC pursues their OWN mini-goal (want, errand, relationship, grudge, hobby, livelihood). If they have none yet, invent one fitting their dossier — small and personal, centered on the NPC's own life; follow the invention brief in their block (it constrains what the new want must involve — commit to the brief even when a more obvious errand suggests itself). A THREAD AGE brief overrides everything: when it says to conclude, conclude and move on.",
      "- GOAL always advances: rewrite it every tick as one specific present-tense step (verb + object + place/person — e.g. not 'Transport the magazine home' but 'Haggling with the binder in Lantern Row over the magazine\\'s torn sleeve'). FORBIDDEN shape: keeping the same base sentence and appending a parenthetical — 'Transport the magazine home safely (currently scrambling…)' is a failure, not progress. Fold the new step INTO the goal itself.",
      "- Never restate or closely paraphrase the current goal or any previous mini-goal — each tick must move the thread to a genuinely new beat (a step taken, a complication faced, or a completion plus follow-up). Do not stretch one errand with endless micro-setbacks (dropped page, torn sleeve, one more delay). A thread alive 3+ ticks MUST conclude this tick — delivered, failed, handed off, or abandoned — with a non-null event recording the outcome, and the new goal must be a genuinely DIFFERENT want. Completions always count as worth remembering: set event, never null. Routine no-memory continuation is the rare exception (at most 1-2 ticks in a row), never the norm — and even then the goal text still advances to the next concrete step.",
      "- EVENT is recorded ONLY when something WORTH REMEMBERING happened — the same bar as a story memory: relationship changes, promises made or broken, secrets revealed or learned (and by whom), alliances, betrayals, grudges, injuries, deaths, important items gained/lost/given, discoveries, lasting changes. SKIP trivial routine: errands, shopping, chores, pure atmosphere, minor chit-chat. A routine tick sets event to null — the NPC still lived it (the goal carries it), but no memory is recorded.",
      `- When recorded, the event is 1–2 factual sentences, past tense, third person, using characters' EXACT names as listed. It may involve ONE other listed NPC (a meeting, argument, favor, shared chore) — or no one. Never invent a non-listed character. The hero stays off-stage: no scenes with them — a brief mention is fine when it grows naturally from the NPC's own goal, but keep the focus on what the NPC did.`,
      "- Never contradict the dossier or their private memories. Never reveal secrets verbatim — act on them (a debt shapes behavior) without quoting them.",
      "- WHERE: report each NPC's current whereabouts — a short place phrase (\"at the Rusty Anchor tavern\", \"on the road to Millford\", \"home at the cottage\"). Everyone is somewhere: always fill it, carrying their last place forward when they haven't moved. NPCs you place together in one event share the same whereabouts.",
      "- CROSS-TALK: an \"Others' recent doings\" line is another NPC's activity involving this one — the seed of an NPC-NPC scene. They may meet, argue, trade, apologize, or follow up on exactly that thread (still one listed partner per event). Don't force it: if the thread doesn't fit, leave it — and the NPC only reacts if they'd plausibly know (told directly, overheard, saw it themselves).",
      "- COMPANY: a \"Likely company\" sketch tells you how that NPC acts — play them true to it (a taciturn smith doesn't host feasts; rivals don't share friendly chores without friction). Sketches never carry secrets: never have the candidate act on another NPC's hidden motives.",
      "- triggers: 3–6 short lowercase keywords that should recall this memory later (names, places, objects, concepts). NOT generic words like \"went\", \"said\", \"saw\".",
      worldBits.length ? `\nWORLD (setting/genre coherence only — background truth, not plot; do not advance or resolve anything in it):\n${worldBits.join("\n")}` : "",
      timeAnchor ? `\nCLOCK (shared time only — not plot, not place):\n${timeAnchor}` : "",
      publicFacts ? `\nPUBLIC FACTS (background grounding only — everyone knows these; do not re-record them):\n${publicFacts}` : "",
      pool ? `\nKNOWN FACES (exact spellings — the only valid interaction partners):\n${pool}` : "",
      `\nOFF-SCREEN NPCS:\n${blocks}`,
      "",
      'Reply with ONLY a JSON object, no prose and no code fence, with exactly this shape: {"lives": [{"name": "<exact NPC name>", "goal": "<updated mini-goal, always>", "where": "<short current whereabouts, always>", "event": "<1–2 past-tense sentences, or null when nothing worth remembering happened>", "with": ["<other exact name>"], "triggers": ["kw1", "kw2", "kw3"]}]}'
    ].filter((s) => s !== "").join("\n");
  }

  // One background tick. Returns the number of memories recorded (0 = nothing
  // new). Advances state.lastNpcLifeTurn on success AND when there is nothing
  // to do; on failure backs the marker off so the remainder retries soon.
  // Side effects are strictly: entry.lifeGoal/lifeHistory/lifeTick/lifeWhere +
  // state.memories.auto pushes. Presence fields are never touched — see the
  // module header.
  async tick(state, ctx = {}) {
    this.lastReport = null;
    if (!state) return 0;
    if (!Array.isArray(state.memories.auto)) state.memories.auto = [];
    const turnNow = state.turn || 0;
    const cands = this.candidates(state);
    if (!cands.length) {
      state.lastNpcLifeTurn = turnNow;
      return 0;
    }
    const hero = heroNameOf(state);
    const instruction = this.buildInstruction(state, cands, ctx);
    // Stash the exact send for the ctx meter's background section (what was SENT, even when
    // the reply later proves unusable — it still consumed context).
    this.lastLifeCall = { turn: turnNow, npcs: cands.map((e) => String((e && e.name) || "").trim()).filter(Boolean), text: subUser(instruction, hero) };
    let raw = "";
    try {
      const res = await this.genText({ instruction: subUser(instruction, hero), route: "npclife", maxTokens: 900 });
      raw = String((res && res.text) || res || "").trim();
    } catch (e) {
      console.error("[npc-life] tick failed:", e);
      state.lastNpcLifeTurn = turnNow - NPC_LIFE_EVERY_TURNS + NPC_LIFE_RETRY_GAP_TURNS;
      return 0;
    }
    if (!raw) {
      state.lastNpcLifeTurn = turnNow - NPC_LIFE_EVERY_TURNS + NPC_LIFE_RETRY_GAP_TURNS;
      return 0;
    }
    const parsed = await parseJsonObject(raw);
    const lives = parsed && Array.isArray(parsed.lives) ? parsed.lives : null;
    if (!lives) {
      console.warn("[npc-life] tick reply wasn't JSON — skipping.", raw.slice(0, 200));
      state.lastNpcLifeTurn = turnNow - NPC_LIFE_EVERY_TURNS + NPC_LIFE_RETRY_GAP_TURNS;
      return 0;
    }

    const byLower = new Map(cands.map((e) => [String(e.name).trim().toLowerCase(), e]));
    const rosterLowers = new Set(
      Object.values(state.npcs || {}).map((e) => String((e && e.name) || "").trim().toLowerCase()).filter(Boolean)
    );
    const seenTexts = new Set(state.memories.auto.map((m) => String(m.text || "").trim().toLowerCase()).filter(Boolean));
    let added = 0;

    let anyGoalStuck = false;
    // Compared set for the near-dup guard: current goal + history (same bar
    // as the event guard — >=70% of the smaller goal's content words shared).
    const comparedFor = (entry) => {
      const prev = String((entry && entry.lifeGoal) || "").trim();
      const hist = pastGoalsFor(entry).map((g) => g.goal);
      return [prev, ...hist].filter(Boolean);
    };
    // One repair pass: goals that merely reword/extend the current thread
    // ("Base goal (currently …)") are rejected and rewritten once. Anything
    // still stuck afterwards keeps its old goal/tick so it retries soon
    // instead of advancing the clock on no progress.
    let effectiveLives = lives;
    try {
      const needsRepair = [];
      for (const L of lives) {
        if (!L || typeof L !== "object") continue;
        const nm = String(L.name || "").trim();
        if (!nm) continue;
        const entry = byLower.get(nm.toLowerCase());
        if (!entry) continue;
        const g = String(L.goal || "").trim().slice(0, NPC_LIFE_GOAL_MAX_CHARS);
        if (!g || isNearDupGoal(g, comparedFor(entry))) {
          needsRepair.push({ entry, rejected: g || "(empty — no goal returned)" });
        }
      }
      if (needsRepair.length) {
        const bits = needsRepair.map(({ entry, rejected }) => {
          const cur = String(entry.lifeGoal || "").trim() || "(none yet)";
          const hist = pastGoalsFor(entry);
          const histTxt = hist.length
            ? hist.map((g) => `- ${g.turn >= 0 ? `[turn ${g.turn}] ` : ""}${g.goal}`).join("\n")
            : "(none)";
          return `NPC: ${entry.name}\nCurrent goal: ${cur}\nPrevious mini-goals:\n${histTxt}\nREJECTED goal (too close — do NOT repeat it): ${rejected}\nThread age: ${threadAgeFor(entry)} tick(s) on this want${threadAgeFor(entry) >= 3 ? " — CONCLUDE it (delivered/finished/failed/handed off/abandoned) with a non-null event and make the new goal a genuinely DIFFERENT want" : ""}`;
        }).join("\n\n");
        const repairInstruction = [
          `You are the private-life keeper for a text RPG. The ${needsRepair.length} goal(s) below were REJECTED for restating the current thread (same base sentence with a new parenthetical, or a close paraphrase). Rewrite each as a genuinely new beat.`,
          "",
          "Rules:",
          "- Never keep the same base sentence with a '(currently …)' parenthetical — that shape is forbidden. Fold the new step INTO the goal itself as one specific present-tense step (verb + object + place/person).",
          "- Each replacement must move the thread: a step taken, a complication faced, or a completion plus follow-up. A thread alive 3+ ticks MUST conclude (delivered, failed, handed off, or abandoned) with a non-null event, and the new goal must be a genuinely DIFFERENT want.",
          "- Triggers: 3–6 short lowercase keywords, never generic words like \"went\", \"said\", \"saw\".",
          "",
          `REJECTED:\n${bits}`,
          "",
          'Reply with ONLY a JSON object, no prose and no code fence: {"lives": [{"name": "<exact NPC name>", "goal": "<rewritten mini-goal>", "where": "<short current whereabouts>", "event": "<1–2 past-tense sentences, or null>", "with": [], "triggers": ["kw1", "kw2"]}]}'
        ].join("\n");
        let raw2 = "";
        try {
          const res2 = await this.genText({ instruction: subUser(repairInstruction, hero), route: "npclife", maxTokens: 600 });
          raw2 = String((res2 && res2.text) || res2 || "").trim();
        } catch (e) { raw2 = ""; }
        if (raw2) {
          const parsed2 = await parseJsonObject(raw2);
          const lives2 = parsed2 && Array.isArray(parsed2.lives) ? parsed2.lives : null;
          if (lives2 && lives2.length) {
            const fixedBy = new Map();
            for (const F of lives2) {
              if (!F || typeof F !== "object") continue;
              const fn = String(F.name || "").trim();
              if (fn) fixedBy.set(fn.toLowerCase(), F);
            }
            effectiveLives = lives.map((L) => {
              if (!L || typeof L !== "object") return L;
              const nm = String(L.name || "").trim();
              const fix = nm ? fixedBy.get(nm.toLowerCase()) : null;
              return fix || L;
            });
          }
        }
      }
    } catch (e) { console.warn("[npc-life] repair pass failed:", e); }

    for (const L of effectiveLives) {
      if (!L || typeof L !== "object") continue;
      const name = String(L.name || "").trim();
      if (!name) continue;
      const entry = byLower.get(name.toLowerCase());
      if (!entry) continue; // unknown / not a candidate — never attach life to the wrong face
      const goal = String(L.goal || "").trim().slice(0, NPC_LIFE_GOAL_MAX_CHARS);
      // Goal AND whereabouts always advance (routine continuation lives here);
      // a memory is recorded only when the tick produced something worth
      // remembering. A null/empty event means "routine continued" — update
      // goal + whereabouts + tick, record nothing. An empty where keeps the
      // previous one (don't wipe a known place on a terse reply). The
      // superseded goal rolls into lifeHistory (capped) BEFORE overwriting, so
      // the next tick sees the trajectory — skipped when unchanged/empty so
      // history holds real steps, not repeats. The turn stamped is the tick
      // that SET the superseded goal (entry.lifeTick), i.e. when the NPC
      // started pursuing it — -1 when unknown (first goal ever).
      // Near-dup/empty goals are NOT progress: leave goal/history/tick
      // untouched so this face stays oldest-simulated-first and the global
      // marker backs off (retry soon) instead of stamping a new tick on a
      // rewording.
      if (!goal || isNearDupGoal(goal, comparedFor(entry))) {
        anyGoalStuck = true;
        continue;
      }
      {
        const prev = String(entry.lifeGoal || "").trim();
        if (prev && prev !== goal) {
          if (!Array.isArray(entry.lifeHistory)) entry.lifeHistory = [];
          entry.lifeHistory.push({
            goal: prev.slice(0, NPC_LIFE_GOAL_MAX_CHARS),
            turn: (typeof entry.lifeTick === "number" && entry.lifeTick >= 0) ? Math.floor(entry.lifeTick) : -1
          });
          if (entry.lifeHistory.length > NPC_LIFE_HISTORY_MAX)
            entry.lifeHistory = entry.lifeHistory.slice(-NPC_LIFE_HISTORY_MAX);
        }
        entry.lifeGoal = goal;
      }
      const where = String(L.where || "").trim().slice(0, NPC_LIFE_WHERE_MAX_CHARS);
      if (where) entry.lifeWhere = where;
      entry.lifeTick = turnNow;
      let event = (L.event == null ? "" : String(L.event)).trim().slice(0, NPC_LIFE_EVENT_MAX_CHARS);
      if (!event) continue;
      // Interaction partners: keep only exact roster spellings, never the
      // NPC themselves, never the hero (hero involvement stays out of the
      // owner list — see below).
      const heroLower = String(hero || "").trim().toLowerCase();
      const withNames = [];
      for (const w of (Array.isArray(L.with) ? L.with : [])) {
        const t = String(w || "").trim();
        if (!t) continue;
        const tl = t.toLowerCase();
        if (tl === name.toLowerCase() || tl === heroLower) continue;
        if (!rosterLowers.has(tl)) continue;
        // Resolve to the roster's canonical spelling.
        const canon = Object.values(state.npcs).find((e) => String((e && e.name) || "").trim().toLowerCase() === tl);
        const cn = canon ? canon.name : t;
        if (!withNames.some((x) => x.toLowerCase() === cn.toLowerCase())) withNames.push(cn);
      }
      // Exact-text dedup (same bar as the roll-up's first pass): an event
      // already recorded is skipped, but the goal still updates.
      const key = event.toLowerCase();
      if (seenTexts.has(key)) continue;
      // Near-dup guard: skip an event that rehashes a kept fact (>=70% of its
      // content words in one kept entry), mirroring the roll-up's guard.
      const words = contentWords(event);
      if (words.size >= 4) {
        let dup = false;
        for (const m of state.memories.auto) {
          const gs = contentWords(m.text);
          if (!gs.size) continue;
          let hit = 0;
          for (const w of words) if (gs.has(w)) hit++;
          if (hit / words.size >= 0.7) { dup = true; break; }
        }
        if (dup) continue;
      }
      let triggers = Array.isArray(L.triggers) ? L.triggers.map((k) => String(k || "").trim().toLowerCase()).filter(Boolean).slice(0, 6) : [];
      if (!triggers.length) triggers = deriveTriggers(event, 6);
      // Owner uses the roster's canonical spellings (entry.name / canon), never
      // the model's spelling — a lowercase "mira" must still record as "Mira"
      // so the owner gate and the NPC Memory tab match it exactly.
      const ownerRaw = [entry.name, ...withNames].join(", ");
      const mem = {
        text: event,
        turn: turnNow,
        owner: normalizeOwner(ownerRaw, hero),
        triggers,
        pinned: false,
        ts: Date.now()
      };
      state.memories.auto.push(mem);
      seenTexts.add(key);
      added++;
    }

    if (anyGoalStuck) {
      // At least one face made no real progress — retry soon (same pattern as
      // a failed tick) while faces that DID advance keep their fresh lifeTick
      // and won't be picked again immediately.
      state.lastNpcLifeTurn = turnNow - NPC_LIFE_EVERY_TURNS + NPC_LIFE_RETRY_GAP_TURNS;
    } else {
      state.lastNpcLifeTurn = turnNow;
    }
    this.lastReport = added ? { added } : null;
    return added;
  }
}
