// World creation — template picker, Craft with AI, duplicates (Batch 2: moved from main.js).
//
// Self-contained except for app state, which main.js injects once via initWorldCraft()
// (same init-with-getters pattern as scene-images.js): the world library, the two refresh
// callbacks, the editor opener + community hook (kept in main.js so their lazy-import caches
// stay single), and the image generator. Everything else is imported directly; AI calls go
// through window.genText like the rest of the app. Local esc/WORLD_IC copies keep this module
// free of main.js (Batch 1 precedent: notify/changelog/page-helpers).
//
// Callers in main.js (newWorld/duplicateWorld/freshWorldId) are unchanged — same functions,
// now imported.

import { normalizeLoreEntry, splitKeywords, LORE_TYPES } from "./lorebook.js";
import { emptyWorld, worldToFile, MAX_AUTHOR_TAGS, isReservedTag, NSFW_TAG } from "./world.js";
import { inlineMd } from "./rich-text.js";
import { TextPopup, ConfirmPopup } from "./popups.js";
import { pushBackClose } from "./back-close.js";
import { notify } from "./notify.js";
import { WORLD_TITLE_BANNED, NPC_NAME_BANNED } from "./banned-words.js";

let D = null; // injected app deps (see initWorldCraft) — null until main.js wires it
export function initWorldCraft(deps) { D = deps; }
const needD = () => { if (!D) throw new Error("world-craft: initWorldCraft() was not called"); };
const getStore = () => { needD(); return D.store(); };
const appGenImage = () => { needD(); return typeof D.genImage === "function" ? D.genImage() : D.genImage; };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const WORLD_IC = '<span class="w-ic" aria-hidden="true"></span>';
// Random world id — ids are immutable (sessions bind to them) and must not be user-chosen or
// guessable, so new worlds/duplicates get a fresh random id, guaranteed unique in the library.
function randomWorldId() {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return "w-" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
async function freshWorldId() {
  const existing = new Set((await getStore().list()).map((e) => e.id));
  let id = randomWorldId();
  while (existing.has(id)) id = randomWorldId();
  return id;
}

// Copy a world (file form) into the library under a new name + id. The original is untouched
// (id is immutable because sessions bind to it — a duplicate gets its own id).
async function duplicateWorld(fileForm) {
  const nv = await TextPopup.open({ title: "Duplicate world", value: fileForm.meta.name + " (copy)", placeholder: "New world name…" });
  if (nv === null || !nv.trim()) return;
  const copy = JSON.parse(JSON.stringify(fileForm));
  copy.meta.name = nv.trim();
  copy.meta.id = await freshWorldId();
  copy.meta.createdAt = fileForm.meta.createdAt || new Date().toISOString();
  copy.meta.updatedAt = new Date().toISOString();
  // A duplicate is a world of YOUR OWN (the original keeps its credit through `meta.remix`), so it
  // is signed here — the same rule as creating a new world (README §6.9).
  await getStore().sign(copy);
  try {
    await getStore().save(copy);
  } catch (e) {
    notify("✖ " + (e.message || e), { ms: 6200 });
    return;
  }
  await D.refreshNames();
  notify("🌍 World \"" + copy.meta.name + "\" created.");
  D.onSaved();
}

// ---- Craft with AI: build a complete world file from a plain-language description ---------------
// One generateText call produces the whole "mno-world" file (meta/vibe/lorebook/scenario/start/
// stats/trackers/npcs). The reply is recovered through the same JSON fallback ladder the lorebook
// AI-split uses (strict parse → jsonrepair), then coerced into a complete valid file form so the
// world editor always opens with something coherent even if the model omits a field.
// Core trackers a playable world always needs — appended only when the AI's reply omits them.
// (Day/time are deliberately NOT mandatory: the AI spends those slots on trackers unique to the
// world's own genre and premise instead.)
const WORLD_CORE_TRACKERS = [
  { key: "location", label: "Location", icon: "📍", type: "text", show: "header", rules: "Where the hero currently is — settlement, region or landmark. Short and specific. Update whenever the scene moves." },
  { key: "quest", label: "Quest", icon: "📜", type: "text", show: "header", rules: "The hero's single current active quest, one short phrase. Only ONE quest at a time; replace it when completed or abandoned, or leave empty." },
  { key: "level", label: "Lvl", icon: "🏅", type: "number", show: "hero", start: 1, rules: "The hero's level. Starts at 1; grant a level-up at meaningful milestones and award extra stat points." },
  { key: "exp", label: "Exp", icon: "✨", type: "number", show: "hero", max: 100, start: 0, rules: "Experience toward the next level. Award exp for completed quests, victories and breakthroughs; reset as the hero levels up." },
  { key: "hp", label: "HP", icon: "❤️", type: "number", show: "header", max: 100, start: 100, rules: "Hit points — the hero's health. Damage reduces it, healing restores it; 0 means downed or in peril." }
];

// The three trackers the engine's own features key off: `level` + `exp` drive the level-up bar and
// stat-point spending, `location` drives the map. A crafted world ALWAYS ends up with these exact
// keys in the right shape — an AI-authored one is healed in place (a wrong type/show would silently
// break the feature), a missing one is appended. Craft-only: a user is free to delete any of them
// from their own world afterwards, and templates ship their own versions. Hand-authored worlds that
// name level/exp differently are still picked up — levelTracker/expTracker match key OR label (see
// trackers.js), the same way lifeTracker matches hp / health / life and locationTracker matches
// location / place / area / region / whereabouts / etc.
const CORE_GAMEPLAY_TRACKERS = [
  { key: "location", label: "Location", hint: "Current location", icon: "📍", type: "text", show: "header", rules: "Where the hero currently is — settlement, region or landmark. Short and specific. Update whenever the scene moves." },
  { key: "level", label: "Lvl", hint: "Current level", icon: "🏅", type: "number", show: "hero", start: 1, rules: "The hero's level. Starts at 1; grant a level-up at meaningful milestones and award extra stat points." },
  { key: "exp", label: "Exp", hint: "Experience points", icon: "✨", type: "number", show: "hero", max: 100, start: 0, rules: "Experience toward the next level. Award exp for completed quests, victories and breakthroughs; reset as the hero levels up." }
];

function craftBase(desc, spine) {
  const lines = [
    "You are one world-builder on a small team designing a single text-RPG world. You write ONLY the part requested in the TASK, as strict JSON matching the required shape exactly. Other writers handle the remaining parts — stay consistent with the brief below and with THE WORLD SO FAR, and never contradict it.",
    "",
    "THE PLAYER'S WORLD DESCRIPTION:",
    String(desc || "").trim()
  ];
  if (spine) {
    lines.push(
      "",
      "THE WORLD SO FAR (canon — build on it, do not contradict it):",
      "Name: " + ((spine.meta && spine.meta.name) || ""),
      "Pitch: " + ((spine.meta && spine.meta.description) || ""),
      "Tone: " + (spine.narrativeVibe || ""),
      "Premise: " + (spine.scenario || "")
    );
  }
  return lines.join("\n");
}

function craftSpineTask() {
  return [
    "TASK — WORLD SPINE. Reply with ONLY a JSON object of exactly this shape (no other keys):",
    '{"meta":{"name":"...","description":"...","tags":["...","..."]},"narrativeVibe":"...","scenario":"...","start":"...","imageStyleTags":"...","imageNegativeTags":"low quality, bad anatomy, watermark, text"}',
    "- name: short, evocative, unique to this world (2-4 words).",
    "- IMPORTANT: do NOT use any of these overused AI title words in the name (any form, singular/plural): " + WORLD_TITLE_BANNED.join(", ") + ". If you catch yourself reaching for one, pick a concrete, specific noun from the world's own premise instead.",
    "- description: a 1-2 sentence pitch.",
    "- tags: 3-5 lowercase genre tags.",
    "- narrativeVibe: one line for the Game Master's tone and style.",
    "- scenario: the permanent premise, addressed to the hero as {{user}}, present tense, 2-4 sentences — the central tension that drives play.",
    "- start: the opening scene, 3-5 sentences, ending with a hook that invites {{user}} to act.",
    "- imageStyleTags: comma-separated art-style tags for scene images that fit the genre.",
    "Reply with ONLY the JSON object."
  ].join("\n");
}

function craftStatsTask() {
  return [
    "TASK — HERO ATTRIBUTES. Reply with ONLY a JSON object of exactly this shape (no other keys):",
    '{"stats":{"pointsPerLevel":2,"ccBudget":10,"ccFloor":1,"averageThreshold":10,"exceptionalThreshold":15,"modStep":1,"defs":[{"key":"str","label":"Strength","hint":"one-line hint","start":10,"max":50,"rules":"one short sentence on how the GM uses it"}]}}',
    "- defs: exactly 7 hero attributes fitting the genre. key = short lowercase slug (str, agi, end, int, wit, cha, luck...). start 8-12, max 40-60.",
    "- rules: ONE short sentence (max ~15 words) describing how the GM uses the attribute in play.",
    "Reply with ONLY the JSON object."
  ].join("\n");
}

function craftTrackersTask() {
  return [
    "TASK — TRACKED RESOURCES. Reply with ONLY a JSON object of exactly this shape (no other keys):",
    '{"trackers":[{"key":"hp","label":"HP","hint":"...","icon":"❤️","type":"number","show":"header","start":100,"max":100,"rules":"what it is + how high/low values affect play + when the GM updates it, one sentence"}]}',
    '- trackers: exactly 10, in this order. These five are REQUIRED and must use these exact keys: location (text), quest (text), level (number, show "hero"), exp (number with max 100, show "hero"), hp (number with a max).',
    "- The remaining five must be UNIQUE to this world's genre and premise — invent them from the fiction and never fall back on generic filler like day or time. Draw on the brief: a money/wealth tracker (gold/credits/eddies/cash), a resource bound to the premise (mana/oxygen/chrome/sanity/corruption/hunger/humanity/notoriety...), and any other quantities THIS world genuinely tracks. Every tracker should mean something specific to this world.",
    '- type is "number" or "text". show is "header" or "hero" — never "both". "header" is shared world/situation state shown on every screen (location, active threat, faction control); "hero" is personal (health, resources, reputation). A number tracker with a max renders as a bar — use max: null for trackers without one.',
    '- max/start may be a number, or max may be a STRING formula over the hero stat keys, e.g. "= end*2 + 20".',
    "- rules: ONE sentence (max ~30 words) with three jobs: WHAT the tracker is, HOW it affects play at high/low values (what it unlocks, blocks, or risks), and WHEN the GM updates it. Never write movement-only rules like \"Decreases when taking damage\" — good: \"Nero's health; at 0 he is downed and at the enemy's mercy. Lose it to enemy hits and demon-blood backlash; restore it by healing, rest, or potions.\".",
    "Reply with ONLY the JSON object."
  ].join("\n");
}

// Dynamic build plan from a plain-language description — no formatting required. Signals are
// language-level, not markup: distinct capitalized names, list items (if any), and overall length.
// Worst case of a mis-estimate is one extra AI call, never lost content.
function planCraft(desc) {
  const text = String(desc || "");
  const bullets = (text.match(/^[\s>]*(?:[-*•]|\d+[.)])\s+\S/gm) || []).length;
  const stop = new Set(("the a an and or but if then than that this those these with without from into over under for of to in on at by as is are was were be been being has have had do does did will would can could should shall may might must not no yes so very just also only more most some any each other about after before during while when where why how who whom whose which what with all both few many much own same such there here them their his her its your my our").split(" "));
  const caps = new Set();
  for (const m of text.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*/g) || []) {
    const words = m.split(/\s+/).filter((w) => !stop.has(w.toLowerCase()));
    if (words.length) caps.add(words.join(" ").toLowerCase());
  }
  const names = caps.size;
  let lore = 8 + Math.floor(names / 2) + bullets + Math.floor(text.length / 1500);
  lore = Math.max(6, Math.min(24, lore));
  const parts = [];
  let rem = lore;
  while (rem > 0) { const n = Math.min(6, rem); parts.push(n); rem -= n; }
  while (parts.length > 1 && parts[parts.length - 1] < 3) {
    const need = 3 - parts[parts.length - 1];
    const prev = parts.length - 2;
    const take = Math.min(need, parts[prev] - 3);
    if (take <= 0) break;
    parts[prev] -= take;
    parts[parts.length - 1] += take;
  }
  let npcs = 3 + Math.floor(names / 4) + (bullets >= 4 ? 1 : 0);
  npcs = Math.max(3, Math.min(7, npcs));
  return { loreParts: parts, loreTotal: parts.reduce((x, n) => x + n, 0), npcTotal: npcs };
}

const CRAFT_LORE_LENSES = [
  "FACTIONS, organizations, religions or cultures",
  "how magic / technology / the supernatural works, plus one entry on LAW",
  "HISTORY or pivotal EVENTS",
  "notable ITEMS, CREATURES, and anything else named in the description"
];
function craftLoreTask(idx, total, want, covered) {
  const lines = [
    "TASK — LOREBOOK, part " + (idx + 1) + " of " + total + ". Reply in MARKDOWN with " + want + " entry blocks" + (want > 1 ? "s" : "") + ", in this shape:",
    "\"## {short title}\" on its own line, then \"type: {exactly one of: premise, world, location, character, faction, religion, magic, law, culture, history, event, item, creature, lore, other}\" on its own line, then \"keywords: {2-8 lowercase trigger words, comma-separated — proper nouns and topic words}\" on its own line, then the canon facts in present tense on the following lines (2-3 sentences, any characters allowed — no escaping needed). One blank line between blocks."
  ];
  if (total === 1) {
    lines.push("Cover the whole description: 1 entry for the world overview and 1 for the central premise (the always-on core), then named LOCATIONS, " + CRAFT_LORE_LENSES.join("; ") + ".");
  } else if (idx === 0) {
    lines.push("Cover: 1 entry for the world overview and 1 for the central premise (the always-on core), then named LOCATIONS.");
  } else {
    const lens = CRAFT_LORE_LENSES[(idx - 1) % CRAFT_LORE_LENSES.length];
    lines.push("Cover: " + lens + ".");
    if (idx === total - 1) lines.push("Catch-all: anything named in the description that is not listed below gets an entry too — omit nothing.");
  }
  if (covered && covered.length) lines.push("Already written — do NOT duplicate or contradict these: " + covered.join("; ") + ".");
  lines.push("Use concrete proper nouns (place, faction and people names) — no generic placeholders.", "Reply with ONLY the entry blocks followed by a final line containing exactly END — no prose, no code fences, no JSON.");
  return lines.join("\n");
}

function craftNpcTrackersTask(npcNames) {
  const lines = [
    "TASK — PER-CHARACTER TRACKERS. Every NPC in this world carries their own copy of these trackers. Reply with ONLY a JSON object of exactly this shape (no other keys):",
    '{"trackers":[{"key":"trust","label":"Trust","icon":"❤️","type":"number","start":50,"max":100,"rules":"what it is + how high/low values affect play + when the GM updates it, one sentence"}]}',
    "- trackers: exactly 3, tailored to THIS world's premise — a romance tracks different things than a dungeon crawl. One of them must capture the character's stance toward the hero (trust, loyalty, fear, rivalry...).",
    '- key: short lowercase slug. icon: one emoji shown beside the value. type is "number" or "text". A number tracker with a max renders as a bar — use max: null for trackers without one.',
    "- max/start may be a number, or max may be a STRING formula over the hero stat keys.",
    "- rules: ONE sentence (max ~30 words) with three jobs: WHAT the tracker is, HOW it affects play at high/low values (what it unlocks, blocks, or risks), and WHEN the GM updates it. Never write movement-only rules.",
    "- Use exactly these keys per tracker (key, label, icon, type, start, max, rules) — no other fields."
  ];
  if (npcNames && npcNames.length) lines.push("The standing cast (track what matters for people like them): " + npcNames.join("; ") + ".");
  lines.push("Reply with ONLY the JSON object.");
  return lines.join("\n");
}

function craftCastTask(loreTitles, want) {
  const lines = [
    "TASK — CAST. Reply in MARKDOWN with " + want + " character blocks" + (want === 1 ? "" : "s") + ", in this shape:",
    "\"## {full name}\" on its own line, then one field per line — age:, gender:, race:, job: (role in the world), appearance: (1-2 sentences), persona: (1-2 vivid sentences of personality and manner), secrets: (one hook the GM knows but the player does not), extra: (other canon detail). Any characters allowed, no escaping needed. One blank line between blocks.",
    "These are members of the world's standing cast who matter to its premise — each with real wants and a secret that creates story hooks. Names must be unique and must not reuse the names of locations or factions above.",
    "IMPORTANT: do NOT use any of these overused AI names (or close variants/spellings) for any character: " + NPC_NAME_BANNED.join(", ") + ". Invent fresh names fitting the world's own culture instead."
  ];
  if (loreTitles && loreTitles.length) lines.push("People, places and factions already defined (stay consistent with them): " + loreTitles.join("; ") + ".");
  lines.push("Reply with ONLY the character blocks followed by a final line containing exactly END — no prose, no code fences, no JSON.");
  return lines.join("\n");
}

// Coerce whatever the model returned into a complete, valid world file form (all keys present,
// right types, unique slug keys, core trackers present) so the editor never sees a broken world.
function coerceWorldFile(raw) {
  const o = (raw && typeof raw === "object" && !Array.isArray(raw)) ? raw : {};
  const s = (v) => (v === undefined || v === null ? "" : String(v));
  const numOr = (v, d) => { if (v === undefined || v === null) return d; if (typeof v === "string" && v.trim() === "") return d; const n = Number(v); return Number.isFinite(n) ? n : d; };
  const slug = (v, fb) => { const x = s(v).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24); return x || fb; };
  const meta = (o.meta && typeof o.meta === "object") ? o.meta : {};
  const stats = (o.stats && typeof o.stats === "object") ? o.stats : {};
  const tags = Array.isArray(meta.tags)
    ? meta.tags.map((t) => s(t).trim().toLowerCase()).filter((t) => t && !isReservedTag(t)).filter((t, i, a) => a.indexOf(t) === i).slice(0, MAX_AUTHOR_TAGS)
    : [];
  const nsfw = meta.nsfw === true || (Array.isArray(meta.tags) && meta.tags.some((t) => s(t).trim().toLowerCase() === NSFW_TAG));
  const lorebook = (Array.isArray(o.lorebook) ? o.lorebook : []).map((e) => normalizeLoreEntry(e)).filter(Boolean).slice(0, 40);
  const statDefs = [];
  const stSeen = new Set();
  for (const d of (Array.isArray(stats.defs) ? stats.defs : [])) {
    if (!d || typeof d !== "object") continue;
    let key = slug(d.key, "stat" + (statDefs.length + 1));
    if (stSeen.has(key)) key = key + "-" + (statDefs.length + 1);
    stSeen.add(key);
    const def = { key, label: s(d.label).trim() || key, hint: s(d.hint).trim(), rules: s(d.rules).trim() };
    const st = Number(d.start); if (Number.isFinite(st)) def.start = st;
    const mx = Number(d.max); if (Number.isFinite(mx)) def.max = mx;
    statDefs.push(def);
  }
  const trackers = [];
  const trSeen = new Set();
  for (const d of (Array.isArray(o.trackers) ? o.trackers : [])) {
    if (!d || typeof d !== "object") continue;
    const key = slug(d.key, "");
    if (!key || trSeen.has(key)) continue;
    trSeen.add(key);
    const type = d.type === "number" ? "number" : "text";
    const show = ["header", "hero", "both", "hidden"].includes(d.show) ? d.show : "both";
    const t = { key, label: s(d.label).trim(), hint: s(d.hint).trim(), icon: s(d.icon).trim(), type, show, rules: s(d.rules).trim() };
    const put = (field, v) => {
      if (v === undefined || v === null || v === "") return;
      if (typeof v === "number" && Number.isFinite(v)) { t[field] = v; return; }
      const strv = s(v).trim();
      if (!strv) return;
      if (strv.startsWith("=")) { if (type === "number") t[field] = strv; return; }
      if (type === "number") { const n = Number(strv); if (Number.isFinite(n)) t[field] = n; return; }
      t[field] = strv;
    };
    put("max", d.max);
    put("start", d.start);
    trackers.push(t);
  }
  // Per-character tracker defs (one set per world; every NPC carries their own values).
  // Same def shape as hero trackers, but `show` is "profile"/"hidden" (default "profile").
  const npcTrackers = [];
  const ntrSeen = new Set();
  for (const d of (Array.isArray(o.npcTrackers) ? o.npcTrackers : [])) {
    if (!d || typeof d !== "object") continue;
    const key = slug(d.key || d.label, "");
    if (!key || ntrSeen.has(key)) continue;
    ntrSeen.add(key);
    const type = d.type === "number" ? "number" : "text";
    const nd = { key, label: s(d.label).trim() || key, type, show: ["profile", "hidden"].includes(d.show) ? d.show : "profile", rules: s(d.rules).trim() };
    if (d.icon !== undefined) nd.icon = s(d.icon).trim();
    const putN = (field, v) => {
      if (v === undefined || v === null || v === "") return;
      if (typeof v === "number" && Number.isFinite(v)) { nd[field] = v; return; }
      const strv = s(v).trim();
      if (!strv || strv === "-") return;
      if (type === "number") { const n = Number(strv); if (Number.isFinite(n)) nd[field] = n; return; }
      nd[field] = strv;
    };
    putN("max", d.max);
    putN("start", d.start);
    if (nd.rules) npcTrackers.push(nd);
  }
  for (const core of WORLD_CORE_TRACKERS) {
    if (!trSeen.has(core.key)) { trackers.push({ ...core }); trSeen.add(core.key); }
  }
  // Force the three feature-critical trackers to the shape the engine expects, whether the AI
  // omitted them (append) or returned a malformed one (heal in place, keeping its label/icon/rules).
  for (const core of CORE_GAMEPLAY_TRACKERS) {
    const existing = trackers.find((t) => t.key === core.key);
    if (!existing) { trackers.push({ ...core }); trSeen.add(core.key); continue; }
    existing.type = core.type;
    existing.show = core.show;
    if (!existing.label) existing.label = core.label;
    if (!existing.icon) existing.icon = core.icon;
    if (core.type === "number" && !Number.isFinite(Number(existing.start))) existing.start = core.start;
    if (core.max !== undefined && !Number.isFinite(Number(existing.max))) existing.max = core.max;
  }
  const npcs = [];
  const npcSeen = new Set();
  for (const n of (Array.isArray(o.npcs) ? o.npcs : [])) {
    if (!n || typeof n !== "object") continue;
    const name = s(n.name).trim();
    if (!name || npcSeen.has(name.toLowerCase())) continue;
    npcSeen.add(name.toLowerCase());
    let persona = s(n.persona).trim();
    if (!persona) persona = [s(n.personality), s(n.mannerisms)].map((x) => x.trim()).filter(Boolean).join(" ");
    npcs.push({
      name, age: s(n.age).trim(), gender: s(n.gender).trim(), race: s(n.race).trim(),
      appearance: s(n.appearance).trim(), job: s(n.job).trim(), persona,
      secrets: s(n.secrets).trim(), extra: s(n.extra).trim()
    });
  }
  return {
    format: "mno-world",
    version: 1,
    // The author is never taken from the model: it is left blank here and the create flow signs the
    // file with the player's own identity (WorldStore.sign → `author` + `authorId`, README §6.9), so
    // an AI-authored world can't claim someone else's name.
    meta: { id: "", name: s(meta.name).trim().slice(0, 60), description: s(meta.description).trim(), author: "", authorId: "", tags, nsfw, cover: "", createdAt: "", updatedAt: "" },
    narrativeVibe: s(o.narrativeVibe).trim(),
    lorebook,
    scenario: s(o.scenario).trim(),
    start: s(o.start).trim(),
    imageStyleTags: s(o.imageStyleTags).trim(),
    imageNegativeTags: s(o.imageNegativeTags).trim(),
    stats: {
      pointsPerLevel: numOr(stats.pointsPerLevel, 2), ccBudget: numOr(stats.ccBudget, 10), ccFloor: numOr(stats.ccFloor, 1),
      averageThreshold: numOr(stats.averageThreshold, 10), exceptionalThreshold: numOr(stats.exceptionalThreshold, 15), modStep: numOr(stats.modStep, 1),
      dieSides: Math.min(1000, Math.max(2, Math.round(numOr(stats.dieSides, 20)))),
      useStatModFormula: stats.useStatModFormula === true,
      statModFormula: s(stats.statModFormula).replace(/^=\s*/, "").trim(),
      defs: statDefs
    },
    trackers,
    npcTrackers,
    npcs
  };
}

// Close a truncated JSON string: terminate an open string, drop a dangling key/comma, and append
// the missing closers from a brace/bracket stack. Lets us salvage a reply cut off by the token cap.
function closeTruncatedJson(s) {
  let inStr = false, esc = false;
  const stack = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{" || c === "[") stack.push(c === "{" ? "}" : "]");
    else if (c === "}" || c === "]") stack.pop();
  }
  let out = s;
  if (inStr) out += '"';
  out = out.replace(/,\s*$/, "").replace(/:\s*$/, ": null");
  while (stack.length) out += stack.pop();
  return out;
}

// Recover any JSON value from an LLM reply: strip code fences, slice from the first { or [, then try
// strict parse → jsonrepair → truncated-JSON closing (a reply cut off by the ~1024-token output cap).
async function extractAiValue(text) {
  const t = String(text || "").trim();
  const fenced = [...t.matchAll(/```[a-zA-Z]*\s*([\s\S]*?)```/g)].map((m) => m[1]);
  const cands = [...new Set([...fenced, t].filter(Boolean))];
  const repair = await import("../vendor/jsonrepair.mjs").then((m) => m.jsonrepair);
  const tryParse = (s) => {
    try { return JSON.parse(s); } catch (e) { /* repair next */ }
    try { return JSON.parse(repair(s)); } catch (e) { return undefined; }
  };
  for (const c of cands) {
    const brace = c.indexOf("{"), brack = c.indexOf("[");
    const a = Math.min(brace < 0 ? Infinity : brace, brack < 0 ? Infinity : brack);
    if (!Number.isFinite(a)) continue;
    const b = Math.max(c.lastIndexOf("}"), c.lastIndexOf("]"));
    const tries = [];
    if (b > a) tries.push(c.slice(a, b + 1));
    tries.push(c.slice(a));
    for (const s of tries) {
      const v1 = tryParse(s);
      if (v1 !== undefined) return v1;
      const v2 = tryParse(closeTruncatedJson(s));
      if (v2 !== undefined) return v2;
    }
  }
  return undefined;
}

function pickArray(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") for (const k of Object.keys(v)) if (Array.isArray(v[k])) return v[k];
  return null;
}
function pickObject(v) {
  if (v && typeof v === "object" && !Array.isArray(v)) return v;
  if (Array.isArray(v)) return v.find((x) => x && typeof x === "object" && !Array.isArray(x)) || null;
  return null;
}

// Markdown lore parser (same block shape the lorebook splitter uses): "## {title}", optional
// "type:"/"keywords:" lines, then free-form content. Truncation-resilient — a cut-off tail still
// yields every complete entry — and quoted text can't poison the parse the way one unescaped JSON
// quote could.
function parseCraftLoreMarkdown(text) {
  const out = [];
  let cur = null;
  const flush = () => {
    if (!cur) return;
    const content = cur.body.join("\n").trim();
    if (content) {
      let keywords = splitKeywords(cur.keywords.join(","));
      if (!keywords.length && cur.type !== "premise") {
        keywords = splitKeywords(cur.title);
        if (!keywords.length) keywords = splitKeywords(content.split(/\s+/).slice(0, 8).join(" "));
      }
      const e = normalizeLoreEntry({
        title: cur.title,
        type: cur.type,
        activation: cur.type === "premise" ? "always" : "keywords",
        keywords, content
      });
      if (e && e.content && e.content.trim()) out.push(e);
    }
    cur = null;
  };
  for (const rawLine of String(text || "").split(/\n/)) {
    const line = rawLine.replace(/\r$/, "");
    const head = line.match(/^##\s+(.{1,120}?)\s*$/);
    if (head) { flush(); cur = { title: head[1].replace(/\*\*/g, "").trim(), type: "lore", keywords: [], body: [] }; continue; }
    if (!cur) continue;
    const tm = line.match(/^\s*type\s*:\s*(.+?)\s*$/i);
    if (tm && !cur.body.length) {
      const ty = tm[1].trim().toLowerCase();
      cur.type = LORE_TYPES.includes(ty) ? ty : "lore";
      continue;
    }
    const km = line.match(/^\s*(keywords?|triggers?)\s*:\s*(.*?)\s*$/i);
    if (km && !cur.body.length) {
      if (!/^-+\s*$/.test(km[2])) cur.keywords.push(km[2]);
      continue;
    }
    if (/^\s*END\s*$/.test(line)) continue;
    cur.body.push(rawLine);
  }
  flush();
  return out;
}

// Markdown cast parser: "## {name}" then labeled field lines. Stray lines land in extra so no
// model output is silently dropped; coerceWorldFile's npc pass then dedupes by name as usual.
const CRAFT_NPC_FIELDS = ["age", "gender", "race", "job", "appearance", "persona", "secrets", "extra"];
function parseCraftCastMarkdown(text) {
  const out = [];
  let cur = null;
  const flush = () => {
    if (!cur) return;
    if (cur.name) {
      const o = { name: cur.name };
      for (const f of CRAFT_NPC_FIELDS) o[f] = (cur.fields[f] || []).join(" ").trim();
      if (cur.stray.length) o.extra = (o.extra ? o.extra + " " : "") + cur.stray.join(" ").trim();
      out.push(o);
    }
    cur = null;
  };
  for (const rawLine of String(text || "").split(/\n/)) {
    const line = rawLine.replace(/\r$/, "");
    const head = line.match(/^##\s+(.{1,80}?)\s*$/);
    if (head) { flush(); cur = { name: head[1].replace(/\*\*/g, "").trim(), fields: {}, stray: [] }; continue; }
    if (!cur) continue;
    if (/^\s*END\s*$/.test(line)) continue;
    const fm = line.match(/^\s*(age|gender|race|job|appearance|persona|secrets|extra)\s*:\s*(.*?)\s*$/i);
    if (fm) {
      const k = fm[1].toLowerCase();
      (cur.fields[k] = cur.fields[k] || []).push(fm[2]);
    } else if (line.trim()) {
      cur.stray.push(line.trim());
    }
  }
  flush();
  return out;
}

// Markdown NPC-tracker parser: "## {label}" then key:/type:/start:/max:/rules: lines. Same
// shape as hero tracker defs minus show (the loader strips it anyway); rules follow the same
// what/how/when sentence the hero-tracker prompt now demands.
function parseCraftNpcTrackerMarkdown(text) {
  const out = [];
  const seen = new Set();
  let cur = null;
  const flush = () => {
    if (!cur) return;
    const label = cur.label.trim();
    let key = cur.key.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);
    if (!key && label) key = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);
    const rules = cur.rules.join(" ").trim();
    if (key && label && rules && !seen.has(key)) {
      seen.add(key);
      const d = { key, label, type: cur.type === "number" ? "number" : "text", rules };
      if (cur.icon) d.icon = cur.icon;
      if (cur.start) d.start = cur.start;
      if (cur.max && cur.max !== "-") d.max = cur.max;
      out.push(d);
    }
    cur = null;
  };
  for (const rawLine of String(text || "").split(/\n/)) {
    const line = rawLine.replace(/\r$/, "");
    const head = line.match(/^##\s+(.{1,60}?)\s*$/);
    if (head) { flush(); cur = { label: head[1].replace(/\*\*/g, "").trim(), key: "", type: "text", start: "", max: "", rules: [] }; continue; }
    if (!cur) continue;
    if (/^\s*END\s*$/.test(line)) continue;
    const fm = line.match(/^\s*(key|label|icon|type|start|max|rules)\s*:\s*(.*?)\s*$/i);
    if (fm) {
      const k = fm[1].toLowerCase();
      if (k === "rules") { if (fm[2]) cur.rules.push(fm[2]); }
      else if (k === "type") cur.type = fm[2].trim().toLowerCase();
      else if (k === "key") cur.key = fm[2];
      else if (k === "label") cur.label = fm[2];
      else if (k === "icon") cur.icon = fm[2].trim();
      else if (k === "start") cur.start = fm[2].trim();
      else if (k === "max") cur.max = fm[2].trim();
    } else if (line.trim()) {
      cur.rules.push(line.trim());
    }
  }
  flush();
  return out;
}

// Entry point for lore/cast stage replies: markdown first (the current prompt format), legacy
// JSON second (a model that answered in JSON anyway).
async function extractCraftEntries(out, kind) {
  const txt = String(out || "").trim();
  const noFence = txt.replace(/```[a-zA-Z]*\s*([\s\S]*?)```/g, "$1").trim();
  if (/^##\s+/m.test(noFence)) {
    const entries = kind === "cast" ? parseCraftCastMarkdown(noFence)
      : kind === "npctrackers" ? parseCraftNpcTrackerMarkdown(noFence)
      : parseCraftLoreMarkdown(noFence);
    if (entries.length) return entries;
  }
  const val = await extractAiValue(txt);
  const arr = pickArray(val);
  return arr || null;
}

// Run one craft stage: one generateText call, recovered/parsed. Array stages (lore, cast) pass
// expectMin and get one extra attempt when short — the lorebook splitter showed a cut-off reply
// otherwise silently yields a thin world. Returns { val, short } where short is how many items
// short the best attempt fell (0 = met quota); optional stages still degrade to null rather than
// failing the whole craft.
async function aiCraftStage(instruction, pick, opts = {}) {
  const attempts = (opts.required ? 2 : 1) + (opts.expectMin ? 1 : 0);
  let best = null;
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await window.genText({ instruction, route: "other" });
      const out = String((res && res.text) || res || "");
      let picked = null;
      if (opts.markdown) picked = await extractCraftEntries(out, opts.markdown);
      else {
        const val = await extractAiValue(out);
        picked = val === undefined ? null : pick(val);
      }
      if (picked !== null) {
        if (!opts.expectMin || picked.length >= opts.expectMin) return { val: picked, short: 0 };
        if (!best || picked.length > best.length) best = picked;
        lastErr = new Error("short reply (" + picked.length + "/" + opts.expectMin + ")");
      } else {
        lastErr = new Error("unparseable reply");
      }
    } catch (e) { lastErr = e; }
  }
  if (best && best.length) {
    console.warn("[craft] stage short:", opts.label, lastErr && lastErr.message);
    return { val: best, short: (opts.expectMin || best.length) - best.length };
  }
  if (opts.required) throw new Error("Couldn't generate the " + (opts.label || "world") + " — try again.");
  console.warn("[craft] stage failed:", opts.label, lastErr && lastErr.message);
  return { val: null, short: 0, failed: true };
}
// A whole world from a plain-language description, built in stages (one shared cached prefix per
// stage) because the model caps each reply at ~1024 output tokens. Returns the world file JSON text.
async function craftWorldWithAI(desc, onStage = () => {}) {
  if (!window.genText) throw new Error("No text AI is available right now.");
  const warnings = [];
  const plan = planCraft(desc);
  onStage("Sketching your world…");
  const spineStage = await aiCraftStage(craftBase(desc, null) + "\n\n" + craftSpineTask(), pickObject, { required: true, label: "world spine" });
  const spine = spineStage.val;
  const base = craftBase(desc, spine);

  onStage("Designing hero attributes…");
  const statsStage = await aiCraftStage(base + "\n\n" + craftStatsTask(), pickObject, { label: "attributes" });
  if (statsStage.failed) warnings.push("hero attributes fell back to defaults");

  onStage("Setting up tracked resources…");
  const trackersStage = await aiCraftStage(base + "\n\n" + craftTrackersTask(), pickObject, { label: "trackers" });
  if (trackersStage.failed) warnings.push("tracked resources fell back to defaults");

  const loreAll = [];
  const titles = [];
  for (let i = 0; i < plan.loreParts.length; i++) {
    const want = plan.loreParts[i];
    onStage("Writing the lorebook (" + (i + 1) + "/" + plan.loreParts.length + ")…");
    const st = await aiCraftStage(base + "\n\n" + craftLoreTask(i, plan.loreParts.length, want, titles), pickArray, { label: "lorebook", markdown: "lore", expectMin: want });
    const got = st.val || [];
    if (st.failed) warnings.push("lorebook part " + (i + 1) + " failed — some lore missing");
    else if (st.short > 0) warnings.push("lorebook part " + (i + 1) + " came back short (" + got.length + "/" + want + ")");
    loreAll.push(...got);
    for (const e of got) {
      const name = (e && (e.title || e.content)) || "";
      if (name) titles.push(String(name).slice(0, 60));
    }
  }

  onStage("Casting the characters…");
  const npcStage = await aiCraftStage(base + "\n\n" + craftCastTask(titles, plan.npcTotal), pickArray, { label: "cast", markdown: "cast", expectMin: plan.npcTotal });
  const npcs = npcStage.val || [];
  if (npcStage.failed) warnings.push("cast failed — no starting characters");
  else if (npcStage.short > 0) warnings.push("cast came back short (" + npcs.length + "/" + plan.npcTotal + ")");

  onStage("Giving the cast memories…");
  const npcNames = npcs.map((n) => (n && n.name) || "").filter(Boolean);
  const npcTrStage = await aiCraftStage(base + "\n\n" + craftNpcTrackersTask(npcNames), pickArray, { label: "npc trackers", markdown: "npctrackers", expectMin: 3 });
  const npcTrackers = npcTrStage.val || [];
  if (npcTrStage.failed) warnings.push("npc trackers failed — characters share no per-character values");
  else if (npcTrStage.short > 0) warnings.push("npc trackers came back short (" + npcTrackers.length + "/3)");

  onStage("Assembling the world…");
  const file = coerceWorldFile({
    meta: spine.meta,
    narrativeVibe: spine.narrativeVibe,
    scenario: spine.scenario,
    start: spine.start,
    imageStyleTags: spine.imageStyleTags,
    imageNegativeTags: spine.imageNegativeTags,
    stats: statsStage.val && (statsStage.val.stats || statsStage.val),
    trackers: trackersStage.val && (trackersStage.val.trackers || trackersStage.val),
    lorebook: loreAll,
    npcs,
    npcTrackers
  });
  if (!file.lorebook.length && !file.scenario && !file.start) throw new Error("The AI didn't return usable world content — try again with a clearer description.");
  return { text: JSON.stringify(file, null, 2), warnings };
}

// Template picker shown when creating a world — fetches the template manifest + files from
// src/game/templates/, and offers "Craft with AI" at the top. Resolves with the raw JSON text of
// the chosen template (or the AI-crafted world), or null if cancelled.
function showTemplatePicker() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "cc-overlay";
    overlay.innerHTML = `
      <div class="cc-panel tp-panel" tabindex="-1">
        <div class="cc-head">
          <span class="cc-title">${WORLD_IC} New World</span>
          <button class="popup-x tp-cancel" title="Close">✕</button>
        </div>
        <div class="cc-body">
          <div class="tp-view-list">
            <p class="cc-hint">Pick a starting point. The template sets up your world's stats and trackers — you can change everything afterwards in the World Editor.</p>
            <div class="wp-card tp-card tp-ai-card" id="tpAiCard">
              <div class="tp-thumb tp-thumb-ai">✨</div>
              <div class="wp-main">
                <div class="ld-whead"><span class="ld-wname">Craft with AI</span><span class="ld-wtag">AI</span></div>
                <div class="ld-wdesc">Describe any world in your own words — the AI builds the lore, cast, stats, trackers and opening scene for you.</div>
                <div class="tp-meta">full world · built by AI</div>
              </div>
              <button class="mini ok tp-pick">✨ Craft</button>
            </div>
            <div class="tp-list" id="tpList"><div class="dim">Loading templates…</div></div>
          </div>
          <div class="tp-view-ai" hidden>
            <p class="cc-hint">Describe the world you want to play in. It can be a genre, a premise, a tone, a twist — anything. The AI weaves it into a <b>complete world</b> with lore, a standing cast, stats, tracked resources and an opening scene, which you can then fine-tune in the editor.</p>
            <textarea id="tpAiInput" class="popup-ta tp-ai-input" rows="8" placeholder="e.g. A rain-soaked megacity where memories are currency, ruled by three rival AI gods — I'm a courier who just found a dead god's last dream…"></textarea>
            <div class="tp-ai-status" id="tpAiStatus"></div>
          </div>
        </div>
        <div class="cc-foot" hidden>
          <span class="cc-err"></span>
          <div class="tp-ai-acts">
            <button type="button" class="mini tp-ai-back">← Back</button>
            <button type="button" class="mini ok tp-ai-go">✨ Craft World</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const release = pushBackClose(() => done(null));
    const list = overlay.querySelector("#tpList");
    const listView = overlay.querySelector(".tp-view-list");
    const aiView = overlay.querySelector(".tp-view-ai");
    const aiInput = overlay.querySelector("#tpAiInput");
    const aiStatus = overlay.querySelector("#tpAiStatus");
    const aiGo = overlay.querySelector(".tp-ai-go");
    const foot = overlay.querySelector(".cc-foot");
    const done = (t, autoName, warnings) => { release(); overlay.remove(); resolve(t === null ? null : { text: t, autoName: !!autoName, warnings: warnings || [] }); };
    const cancel = () => done(null);
    const setAiStatus = (msg, bad, html) => {
      if (html) aiStatus.innerHTML = msg; else aiStatus.textContent = msg || "";
      aiStatus.classList.toggle("bad", !!bad);
    };
    const showAi = (on) => {
      listView.hidden = on;
      aiView.hidden = !on;
      foot.hidden = !on;
      if (on) setTimeout(() => aiInput.focus(), 0);
    };
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) cancel(); });
    overlay.addEventListener("keydown", (e) => { if (e.key === "Escape") cancel(); });
    overlay.querySelector(".cc-head .tp-cancel").onclick = cancel;
    overlay.querySelector(".cc-panel").focus();
    overlay.querySelector("#tpAiCard").onclick = () => showAi(true);
    overlay.querySelector(".tp-ai-back").onclick = () => { setAiStatus("", false); showAi(false); };
    aiGo.onclick = async () => {
      const desc = aiInput.value.trim();
      if (!desc) { setAiStatus("✋ Describe your world first.", true); aiInput.focus(); return; }
      aiGo.disabled = true;
      const orig = aiGo.textContent;
      aiGo.textContent = "⟳ Weaving…";
      const stage = (label) => setAiStatus('<span class="spin"></span> ' + label + " <span class=\"dim\">(the world is built in several AI passes — this can take a few minutes)</span>", false, true);
      stage("Sketching your world…");
      try {
        const crafted = await craftWorldWithAI(desc, stage);
        done(crafted.text, true, crafted.warnings);
      } catch (err) {
        console.error("craft world failed:", err);
        setAiStatus("⚠ " + ((err && err.message) ? err.message : "The AI call failed."), true);
        aiGo.disabled = false;
        aiGo.textContent = orig;
      }
    };
    (async () => {
      try {
        const manifest = JSON.parse(await fetch("src/game/templates/manifest.json").then((r) => r.text()));
        list.innerHTML = "";
        for (const m of manifest) {
          const text = await fetch("src/game/templates/" + m.file).then((r) => r.text());
          const parsed = JSON.parse(text);
          const stats = (parsed.stats && parsed.stats.defs) || [];
          const trackers = parsed.trackers || [];
          const card = document.createElement("div");
          card.className = "wp-card tp-card";
          card.innerHTML = `
            <div class="tp-thumb">${esc(m.icon || "📄")}</div>
            <div class="wp-main">
              <div class="ld-whead"><span class="ld-wname">${esc(m.name)}</span><span class="ld-wtag">${esc(m.tag || "")}</span></div>
              ${m.desc ? `<div class="ld-wdesc">${inlineMd(m.desc)}</div>` : ""}
              <div class="tp-meta">${stats.length} stats · ${trackers.length} trackers</div>
            </div>
            <button class="mini ok tp-pick">Use template</button>`;
          card.querySelector(".tp-pick").onclick = (e) => { e.stopPropagation(); done(text); };
          card.onclick = () => done(text);
          list.appendChild(card);
        }
      } catch (e) {
        list.innerHTML = `<div class="dim">Couldn't load templates — use Craft with AI above, or start from a blank world.</div>`;
        const blank = JSON.stringify({ format: "mno-world", version: 1, meta: { id: "", name: "", description: "", author: "", authorId: "", cover: "", tags: [], createdAt: "", updatedAt: "" }, narrativeVibe: "", lorebook: [], scenario: "", start: "", imageStyleTags: "", imageNegativeTags: "", stats: { pointsPerLevel: 2, ccBudget: 10, ccFloor: 1, averageThreshold: 10, exceptionalThreshold: 15, modStep: 1, defs: [] }, trackers: [], npcTrackers: [], npcs: [] });
        const card = document.createElement("div");
        card.className = "wp-card tp-card";
        card.innerHTML = `<div class="tp-thumb">📄</div><div class="wp-main"><div class="ld-whead"><span class="ld-wname">Blank</span></div><div class="tp-meta">0 stats · 0 trackers</div></div><button class="mini ok tp-pick">Start blank</button>`;
        card.querySelector(".tp-pick").onclick = (e) => { e.stopPropagation(); done(blank); };
        card.onclick = () => done(blank);
        list.appendChild(card);
      }
    })();
  });
}

// Create a fresh world from a chosen template / AI craft and open it in the editor. Templates wait
// for a name via a prompt (prefilled with the template's suggestion); an AI-crafted world takes the
// AI's suggested name automatically and is saved to the library at once. The id is derived (unique)
// because sessions bind to it.
async function newWorld() {
  const pick = await showTemplatePicker();
  if (pick === null) return;
  let f = null;
  try { f = JSON.parse(pick.text); } catch (e) { f = null; }
  if (!f || !f.meta) f = worldToFile(emptyWorld("world", ""));
  const now = new Date().toISOString();
  if (pick.autoName) {
    f.meta.name = String(f.meta.name || "").trim() || "Untitled World";
    f.meta.id = await freshWorldId();
    f.meta.createdAt = f.meta.createdAt || now;
    f.meta.updatedAt = now;
    // A world made here is YOURS: sign it with your own username + id. Templates ship no author of
    // their own (and the AI is never allowed to claim one) — see WorldStore.sign / README §6.9.
    await getStore().sign(f);
    try {
      await getStore().save(f);
    } catch (e) {
      notify("✖ " + (e.message || e), { ms: 6200 });
      return;
    }
    await D.refreshNames();
    notify("🌍 World \"" + f.meta.name + "\" crafted and saved." + ((pick.warnings && pick.warnings.length) ? " ⚠ " + pick.warnings.join("; ") + "." : ""));
    D.onSaved();
  } else {
    const suggested = String(f.meta.name || "").trim();
    const name = await TextPopup.open({ title: suggested ? "Name your world" : "New world", value: suggested, placeholder: "World name…", rows: 1 });
    if (name === null || !name.trim()) return;
    f.meta.name = name.trim();
    f.meta.id = await freshWorldId();
    f.meta.createdAt = f.meta.createdAt || now;
    f.meta.updatedAt = now;
    // Sign before the editor opens: the editor's own save never claims a world (it only keeps the
    // author line of a world that is already ours), so this is where a brand-new world gets its
    // author.
    await getStore().sign(f);
  }
  D.openEditor(f, { worldStore: getStore(), onSaved: () => D.onSaved(), notify, ConfirmPopup, genImage: appGenImage(), community: D.communityHook() });
}
export { randomWorldId, freshWorldId, duplicateWorld, craftWorldWithAI, showTemplatePicker, newWorld, extractAiValue, pickArray, pickObject, planCraft, coerceWorldFile };
