// world.js — single-file world loader (schema + store for the "mno-world" format).
// One world = one JSON file (format: "mno-world"). `loadWorld` is the single choke point that
// turns any world text into the canonical runtime object the rest of the engine consumes, so
// everything downstream works identically no matter where the world came from (bundled default,
// imported file, or later a kv-stored user world).
// Phase 1: loader + bundled default world. Phase 2: the kv world library (WorldStore) + export.

import { normalizeLorebook } from "./lorebook.js";
import { isExpTrackerDef, EXP_DEFAULT_MAX } from "./trackers.js";
import { safeStorageRead, withStorageRetry, isStorageError } from "./storage-errors.js";

export const WORLD_FORMAT = "mno-world";
export const WORLD_VERSION = 1;
// Exported world files are still plain JSON — the distinctive extension only labels them, so the
// import picker can filter to worlds and a user can't grab an unrelated .json by mistake.
export const WORLD_EXTENSION = ".mno-world";

// The two "special" markers a world can carry, each of which owns its own FIELD — never an author
// tag — and each of which every card renders as a chip at the head of its tag row (see tag-row.js):
//
//   * `nsfw`  — the adult rating, the author-declared `meta.nsfw` BOOLEAN (this is the source of
//               truth; see README §4). `isNsfwMeta` reads it, and the chip is drawn from it.
//   * `commentsOff` — the author-owned comments toggle (`meta.commentsOff` BOOLEAN, default
//               enabled). `isCommentsOffMeta` reads it; detail panels hide the Comments tab when true.
//               No reserved-tag back-compat: the toggle is new, so only the boolean exists.
//   * `remix` — fork provenance, the `meta.remix` record written by the community Duplicate flow
//               (worldId/name/author of the original; see README §6.14). `isRemixMeta` reads it.
//
// A reserved TAG of either name in `tags` is legacy/back-compat (hand-written or older files may
// carry one): it is recognised on load, counted as evidence of the marker, and then stripped from
// the author's tag list by `normalizeWorld`/`worldToFile` — so it never counts against the 5-tag
// limit and is never re-written as an author tag. `isReservedTag` (either one) is what filters the
// author's tags; the single-marker checks are used wherever the two must not be confused (e.g. the
// editor's NSFW toggle must not flip on for a typed "remix").
export const NSFW_TAG = "nsfw";
export const REMIX_TAG = "remix";
const normTag = (t) => String(t || "").trim().toLowerCase();
export const isNsfwTag = (t) => normTag(t) === NSFW_TAG;
export const isRemixTag = (t) => normTag(t) === REMIX_TAG;
export const isReservedTag = (t) => isNsfwTag(t) || isRemixTag(t);
// Author tag limits (shared by the loader, the editor, the AI world crafter and the community publish
// flow — see README §4).
export const MAX_AUTHOR_TAGS = 8;
export const TAG_MAX_LEN = 24;
// `meta.id` is the world's immutable slug; capped at 40 chars so the community `worldId`
// (`<userId>-<meta.id>`) stays within the plan's 64-char cap (see README §6.14).
export const META_ID_MAX = 40;
// `meta.authorId` — the stable identity behind the cosmetic `meta.author` NAME: the same 16-hex
// community `userId` the catalog knows you by (`<userId>-<slug>` world ids, `meta.remix.userId`).
// It is stamped only where a world is authored on this device — create, duplicate, publish (see
// WorldStore.sign) — and an import keeps whatever the file carried, like its author name. The name
// can change (a community rename), so it is the ID that tells the app which local worlds are ours
// (README §6.9). Capped in length only so a hand-edited file can't bloat the index.
export const AUTHOR_ID_MAX = 64;
// `meta.remix` — fork provenance written by the community "Duplicate" flow, so a remix carries its
// lineage in the FILE itself (it survives Export/Import; see README §6.14).
export const REMIX_FIELDS = ["worldId", "name", "userId", "author", "at"];
// A world is NSFW when its `meta.nsfw` boolean is true, or (back-compat) when its tags still carry
// the reserved marker — matched case-insensitively, so a hand-written "NSFW" counts. Takes a world's
// `meta` (the same shape the WorldStore index and landing cards store). Note it tests the NSFW
// marker ONLY: a `remix` tag must never make a world adult.
export function isNsfwMeta(meta) {
  if (!meta) return false;
  if (meta.nsfw === true) return true;
  return (Array.isArray(meta.tags) ? meta.tags : []).some(isNsfwTag);
}
// The author's comments toggle: true means comments are OFF for this world
// (detail panels hide the Comments tab). Missing/false = enabled (every
// world published before the toggle reads as enabled).
export function isCommentsOffMeta(meta) {
  return !!meta && meta.commentsOff === true;
}

// `meta.origin` — where the file came from, when it wasn't authored here. The scenario importer
// stamps `"imported"`; the card footer reads it (see localWorldNote in main.js) instead of an
// author tag, so it never consumes one of the 5 tag slots. Any other value normalizes to "".
export function isImportedMeta(meta) {
  return !!meta && meta.origin === "imported";
}

// A world is a REMIX when its `meta.remix` provenance record is present (written by the community
// Duplicate flow — see normalizeRemix), or (back-compat) when its tags still carry the reserved
// `remix` marker. Takes a world's `meta`, exactly like isNsfwMeta, so every card can derive the
// `remix` chip the same way it derives the `nsfw` one. A remix is a normal, fully-playable world —
// the marker only says it began life as a copy of someone else's.
export function isRemixMeta(meta) {
  if (!meta) return false;
  if (normalizeRemix(meta.remix)) return true;
  return (Array.isArray(meta.tags) ? meta.tags : []).some(isRemixTag);
}

// Normalize fork provenance into its canonical shape (all strings), or null when absent/empty.
export function normalizeRemix(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = {};
  for (const k of REMIX_FIELDS) r[k] = str(raw[k]).trim();
  if (!r.worldId && !r.name && !r.userId) return null;
  return r;
}

const str = (v) => (v === undefined || v === null ? "" : String(v));
const toNum = (v, def) => {
  if (v === undefined || v === null) return def;
  if (typeof v === "string" && v.trim() === "") return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};
const asArray = (v) => (Array.isArray(v) ? v : []);
// Normalize a tracker-key subset list (scene-image pickers): trimmed unique strings, kept only when
// they name a known def. Anything else (missing, non-array, stale keys) becomes [] = all.
const normKeyList = (v, defs) => {
  if (!Array.isArray(v)) return [];
  const known = new Set((defs || []).map((d) => d && d.key).filter(Boolean));
  const out = [];
  for (const raw of v) {
    const k = String(raw == null ? "" : raw).trim();
    if (!k || out.includes(k) || !known.has(k)) continue;
    out.push(k);
  }
  return out;
};
const DEFAULT_STATS_CFG = { pointsPerLevel: 2, ccBudget: 12, ccFloor: 5, ccCeiling: 20, averageThreshold: 10, exceptionalThreshold: 15, modStep: 5, dieSides: 20, useStatModFormula: false, statModFormula: "", checkIncludeTrackers: false, checkIncludeNpcTrackers: false, useCheckInstruction: false, checkInstruction: "" };

// A minimal world used when loading fails — the app always boots with something.
export function emptyWorld(id = "Basic RPG", name = "Basic RPG") {
  return {
    meta: { id, name, description: "", author: "", authorId: "", tags: [], nsfw: false, commentsOff: false, remix: null, cover: "", authorNotes: "", createdAt: "", updatedAt: "" },
    narrativeVibe: "",
    lorebook: [],
    scenario: "",
    start: "",
    imageStyleTags: "",
    imageNegativeTags: "",
    imageIncludeTrackers: false,
    imageIncludeNpcTrackers: false,
    imageTrackerKeys: [],
    imageNpcTrackerKeys: [],
    // Fresh key lists (never the shared DEFAULT_STATS_CFG reference): [] = all.
    statsCfg: { ...DEFAULT_STATS_CFG, checkTrackerKeys: [], checkNpcTrackerKeys: [] },
    statDefs: [],
    trackerDefs: [],
    npcTrackerDefs: [],
    npcs: []
  };
}

// Normalize one stat def (schema form) into the runtime shape {key,label,hint,start,max,rules}.
function normalizeStat(raw, key) {
  const d = { key, label: str(raw.label) || key, hint: str(raw.hint), start: undefined, max: undefined, rules: str(raw.rules) };
  const st = Number(raw.start);
  if (raw.start !== undefined && raw.start !== "" && Number.isFinite(st)) d.start = st;
  const mx = Number(raw.max);
  if (raw.max !== undefined && raw.max !== "" && Number.isFinite(mx)) d.max = mx;
  return d;
}

// Normalize one tracker def (schema form) into the runtime shape, splitting literal vs stat-derived
// max/start exactly like the old trackers.md parser did.
function normalizeTracker(raw, key) {
  const type = raw.type === "number" ? "number" : "text";
  const show = ["header", "hero", "both", "hidden"].includes(raw.show) ? raw.show : "both";
  const d = {
    key, label: str(raw.label), hint: str(raw.hint), icon: str(raw.icon), color: str(raw.color),
    type, show, rules: str(raw.rules),
    max: undefined, maxFormula: undefined, start: undefined, startFormula: undefined
  };
  const split = (v) => {
    if (v === undefined || v === null) return {};
    if (typeof v === "number" && Number.isFinite(v)) return { literal: v };
    if (typeof v === "string") {
      const t = v.trim();
      if (t.startsWith("=")) { const f = t.replace(/^=\s*/, "").trim(); return f ? { formula: f } : {}; }
      if (t === "") return {};
      if (type === "number") { const n = Number(t); return Number.isFinite(n) ? { literal: n } : { literal: t }; }
      return { literal: t };
    }
    return {};
  };
  const maxs = split(raw.max);
  if (maxs.formula !== undefined) d.maxFormula = maxs.formula;
  else if (maxs.literal !== undefined) d.max = maxs.literal;
  // An experience tracker with no cap at all (neither literal nor formula) defaults to
  // EXP_DEFAULT_MAX so the hero panel's level bar always has a denominator to render
  // ("0/100" rather than "0/undefined"). A literal max, or any `= formula` cap, is left alone.
  if (d.type === "number" && d.max === undefined && d.maxFormula === undefined && isExpTrackerDef(d)) d.max = EXP_DEFAULT_MAX;
  const starts = split(raw.start);
  if (starts.formula !== undefined) d.startFormula = starts.formula;
  else if (starts.literal !== undefined) d.start = starts.literal;
  return d;
}

// Normalize one NPC tracker def. Same shape as a hero tracker def, but `show` is
// "profile" (on the NPC profile) or "hidden" (tracked silently) — never in the header bar.
function normalizeNpcTracker(raw, key) {
  const d = normalizeTracker(raw, key);
  d.show = ["profile", "hidden"].includes(raw.show) ? raw.show : "profile";
  return d;
}

// A world NPC's optional per-character starting values (`{ "trust": 60 }`), merged over the world
// defaults when that character's session entry is created (see initialNpcTrackers in trackers.js).
// Kept as a plain key→value map here; the seeding step coerces each value for its def's type and
// ignores keys that aren't defs.
function normalizeNpcTrackerOverrides(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    const key = String(k || "").trim();
    if (!key || v === undefined || v === null) continue;
    if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") out[key] = v;
  }
  return out;
}

// Normalize a world's `meta` into its canonical shape. Author tags are trimmed, capped at
// MAX_AUTHOR_TAGS × TAG_MAX_LEN and de-duplicated; the reserved marker tags are folded into their
// fields — `nsfw` into the `meta.nsfw` boolean (the source of truth), `remix` into the
// `meta.remix` provenance record — and never kept in `tags`. `meta.remix` is preserved through
// round-trips, as is `meta.authorId` (the stable id behind the cosmetic author name).
// `meta.commentsOff` (the author-owned comments toggle) passes through untouched.
function normalizeMeta(meta, id, name, warnings) {
  const rawTags = asArray(meta.tags).map((t) => str(t).trim()).filter(Boolean);
  const authorTags = [];
  for (const t of rawTags) {
    if (isReservedTag(t)) continue;
    const clean = t.slice(0, TAG_MAX_LEN);
    if (authorTags.some((x) => x.toLowerCase() === clean.toLowerCase())) continue;
    authorTags.push(clean);
  }
  if (authorTags.length > MAX_AUTHOR_TAGS) {
    warnings.push(`Too many tags (${authorTags.length}) — keeping the first ${MAX_AUTHOR_TAGS}.`);
    authorTags.length = MAX_AUTHOR_TAGS;
  }
  const nsfw = meta.nsfw === true || rawTags.some(isNsfwTag);
  return {
    id,
    name,
    description: str(meta.description),
    author: str(meta.author).trim(),
    authorId: str(meta.authorId).trim().slice(0, AUTHOR_ID_MAX),
    tags: authorTags,
    nsfw,
    // Author-owned comments toggle (world file's source of truth, like the rating).
    commentsOff: meta.commentsOff === true,
    remix: normalizeRemix(meta.remix),
    origin: meta.origin === "imported" ? "imported" : "",
    cover: str(meta.cover),
    // Author's notes: free-form Markdown (changelog/tutorial/whatever). Draft text before
    // publishing, the hosted URL after (same dataURL→URL replacement cover does) — see notes.js.
    // Never capped here: the text lives in its own upload blob, the server keeps only its 32-char ID.
    authorNotes: str(meta.authorNotes),
    createdAt: str(meta.createdAt),
    updatedAt: str(meta.updatedAt)
  };
}

// Validate + normalize a parsed world object into the canonical runtime World.
// Returns { world, warnings, errors } — errors reject, warnings are recoverable.
export function normalizeWorld(obj) {
  const warnings = [];
  const errors = [];
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    errors.push("World is not a JSON object.");
    return { world: null, warnings, errors };
  }
  if (obj.format !== WORLD_FORMAT) errors.push(`Unsupported world format: ${JSON.stringify(obj.format)} (expected "${WORLD_FORMAT}").`);
  if (obj.version !== WORLD_VERSION) errors.push(`Unsupported world version: ${JSON.stringify(obj.version)} (expected ${WORLD_VERSION}).`);
  const meta = obj.meta && typeof obj.meta === "object" ? obj.meta : {};
  const id = String(meta.id || "").trim();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) errors.push("meta.id must be a slug (lowercase letters, digits, hyphens).");
  else if (id.length > META_ID_MAX) errors.push(`meta.id must be at most ${META_ID_MAX} characters (got ${id.length}).`);
  const name = String(meta.name || "").trim();
  if (!name) errors.push("meta.name is required.");
  if (errors.length) return { world: null, warnings, errors };

  const statsRaw = obj.stats && typeof obj.stats === "object" ? obj.stats : {};
  const statModFormula = str(statsRaw.statModFormula).trim().replace(/^=\s*/, "");
  // Die size is clamped to [2, 1000] so a bad config can never make the die degenerate; a blank or
  // non-numeric value falls back to the default (20).
  const sidesRaw = statsRaw.dieSides;
  const dieSides = (sidesRaw === undefined || sidesRaw === null || sidesRaw === "" || !Number.isFinite(Number(sidesRaw)))
    ? DEFAULT_STATS_CFG.dieSides
    : Math.min(1000, Math.max(2, Math.round(Number(sidesRaw))));
  const useStatModFormula = statsRaw.useStatModFormula === true && !!statModFormula;
  if (statsRaw.useStatModFormula === true && !statModFormula) {
    warnings.push("stats.useStatModFormula is on but stats.statModFormula is empty — using the built-in modifier.");
  }
  const checkInstruction = str(statsRaw.checkInstruction);
  const useCheckInstruction = statsRaw.useCheckInstruction === true && !!checkInstruction.trim();
  if (statsRaw.useCheckInstruction === true && !checkInstruction.trim()) {
    warnings.push("stats.useCheckInstruction is on but stats.checkInstruction is empty — nothing is appended to the referee prompt.");
  }
  const statsCfg = {
    pointsPerLevel: toNum(statsRaw.pointsPerLevel, DEFAULT_STATS_CFG.pointsPerLevel),
    ccBudget: toNum(statsRaw.ccBudget, DEFAULT_STATS_CFG.ccBudget),
    ccFloor: toNum(statsRaw.ccFloor, DEFAULT_STATS_CFG.ccFloor),
    ccCeiling: toNum(statsRaw.ccCeiling, DEFAULT_STATS_CFG.ccCeiling),
    averageThreshold: toNum(statsRaw.averageThreshold, DEFAULT_STATS_CFG.averageThreshold),
    exceptionalThreshold: toNum(statsRaw.exceptionalThreshold, DEFAULT_STATS_CFG.exceptionalThreshold),
    modStep: toNum(statsRaw.modStep, DEFAULT_STATS_CFG.modStep),
    dieSides,
    useStatModFormula,
    statModFormula,
    checkIncludeTrackers: statsRaw.checkIncludeTrackers === true,
    checkIncludeNpcTrackers: statsRaw.checkIncludeNpcTrackers === true,
    checkTrackerKeys: [],
    checkNpcTrackerKeys: [],
    useCheckInstruction,
    checkInstruction
  };
  const statDefs = [];
  for (const raw of asArray(statsRaw.defs)) {
    if (!raw || typeof raw !== "object") continue;
    const key = String(raw.key || "").trim();
    if (!key) { warnings.push("Skipped a stat def with no key."); continue; }
    if (statDefs.some((d) => d.key === key)) { warnings.push(`Duplicate stat key "${key}" — keeping the first.`); continue; }
    statDefs.push(normalizeStat(raw, key));
  }
  const trackerDefs = [];
  for (const raw of asArray(obj.trackers)) {
    if (!raw || typeof raw !== "object") continue;
    const key = String(raw.key || "").trim();
    if (!key) { warnings.push("Skipped a tracker def with no key."); continue; }
    if (trackerDefs.some((d) => d.key === key)) { warnings.push(`Duplicate tracker key "${key}" — keeping the first.`); continue; }
    trackerDefs.push(normalizeTracker(raw, key));
  }
  // Per-NPC tracked values — the same concept as `trackers`, but each in-play character carries
  // their own copy (see README §6.3.1). One def set per world; `show` is "profile"/"hidden".
  const npcTrackerDefs = [];
  for (const raw of asArray(obj.npcTrackers)) {
    if (!raw || typeof raw !== "object") continue;
    const key = String(raw.key || "").trim();
    if (!key) { warnings.push("Skipped an NPC tracker def with no key."); continue; }
    if (npcTrackerDefs.some((d) => d.key === key)) { warnings.push(`Duplicate NPC tracker key "${key}" — keeping the first.`); continue; }
    npcTrackerDefs.push(normalizeNpcTracker(raw, key));
  }
  // The world's standing NPC cast — people who exist in this world. Each is a flat profile (same
  // fields as a session NPC's `details`), canon for the GM; sessions only catalogue them after the
  // hero actually meets them.
  const npcs = [];
  for (const raw of asArray(obj.npcs)) {
    if (!raw || typeof raw !== "object") continue;
    const name = str(raw.name).trim();
    if (!name) { warnings.push("Skipped a world NPC with no name."); continue; }
    if (npcs.some((n) => n.name.toLowerCase() === name.toLowerCase())) { warnings.push(`Duplicate world NPC "${name}" — keeping the first.`); continue; }
    npcs.push({
      name,
      age: str(raw.age), gender: str(raw.gender), race: str(raw.race),
      appearance: str(raw.appearance), job: str(raw.job), persona: str(raw.persona),
      secrets: str(raw.secrets), extra: str(raw.extra),
      avatar: str(raw.avatar),
      trackers: normalizeNpcTrackerOverrides(raw.trackers)
    });
  }
  // Referee tracker pickers (same convention as the scene-image ones, independent of them):
  // explicit key subsets, empty = all. Filtered here — after the defs are built — so a
  // renamed/removed tracker can't leave a stale key behind.
  statsCfg.checkTrackerKeys = normKeyList(statsRaw.checkTrackerKeys, trackerDefs);
  statsCfg.checkNpcTrackerKeys = normKeyList(statsRaw.checkNpcTrackerKeys, npcTrackerDefs);
  const world = {
    meta: normalizeMeta(meta, id, name, warnings),
    narrativeVibe: str(obj.narrativeVibe),
    lorebook: normalizeLorebook(obj.lorebook),
    scenario: str(obj.scenario),
    start: str(obj.start),
    imageStyleTags: str(obj.imageStyleTags),
    imageNegativeTags: str(obj.imageNegativeTags),
    imageIncludeTrackers: obj.imageIncludeTrackers === true,
    imageIncludeNpcTrackers: obj.imageIncludeNpcTrackers === true,
    // Scene-image tracker pickers: explicit key subsets, empty = all. Filtered to known keys so a
    // renamed/removed tracker can't leave a stale key behind.
    imageTrackerKeys: normKeyList(obj.imageTrackerKeys, trackerDefs),
    imageNpcTrackerKeys: normKeyList(obj.imageNpcTrackerKeys, npcTrackerDefs),
    statsCfg,
    statDefs,
    trackerDefs,
    npcTrackerDefs,
    npcs
  };
  return { world, warnings, errors };
}

// Load a world from its raw JSON text — the single choke point for every world source.
export function loadWorld(jsonText) {
  let obj;
  try { obj = JSON.parse(String(jsonText || "")); }
  catch (e) { return { world: null, warnings: [], errors: [`Invalid JSON: ${e.message}`] }; }
  return normalizeWorld(obj);
}

// Download a world as a .mno-world file (JSON payload). `fileForm` is the raw file-shaped object
// (format/version/stats/trackers — exactly what an exported world file contains); worldToFile
// produces it from a canonical World when only the canonical form exists (the built-in default).
export function exportWorld(fileForm) {
  const json = JSON.stringify(fileForm, null, 2);
  const blob = new Blob([json], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  // Named after the world, not its id — the same rule the adventure export follows (storage.js's
  // exportState), so a downloaded file reads as the thing the player called it.
  a.download = ((fileForm.meta && fileForm.meta.name) || "world").replace(/[^a-z0-9]+/gi, "_") + WORLD_EXTENSION;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
}

// Serialize a canonical World back into the file form (the "mno-world" schema), so
// anything that must be a portable file (export, duplicating the built-in default) can be.
export function worldToFile(world) {
  const stats = world.statsCfg || {};
  const t = (d, withShow = true) => {
    const o = { key: d.key, label: d.label, hint: d.hint, icon: d.icon, color: d.color, type: d.type };
    if (withShow) o.show = d.show;
    o.rules = d.rules;
    if (d.max !== undefined) o.max = d.max;
    else if (d.maxFormula !== undefined) o.max = "= " + d.maxFormula;
    if (d.start !== undefined) o.start = d.start;
    else if (d.startFormula !== undefined) o.start = "= " + d.startFormula;
    return o;
  };
  const meta = world.meta || {};
  const fileMeta = {
    id: meta.id,
    name: meta.name,
    description: meta.description || "",
    author: meta.author || "",
    authorId: meta.authorId || "",
    tags: (Array.isArray(meta.tags) ? meta.tags : []).filter((t) => !isReservedTag(t)).slice(0, MAX_AUTHOR_TAGS),
    nsfw: meta.nsfw === true,
    commentsOff: meta.commentsOff === true,
    origin: meta.origin === "imported" ? "imported" : "",
    cover: meta.cover || "",
    authorNotes: meta.authorNotes || "",
    createdAt: meta.createdAt || "",
    updatedAt: meta.updatedAt || ""
  };
  const remix = normalizeRemix(meta.remix);
  if (remix) fileMeta.remix = remix;
  return {
    format: WORLD_FORMAT,
    version: WORLD_VERSION,
    meta: fileMeta,
    narrativeVibe: world.narrativeVibe,
    lorebook: (world.lorebook || []).map((e) => ({
      title: e.title || "", type: e.type || "lore", activation: e.activation || "always",
      keywords: e.keywords || [], content: e.content || ""
    })),
    scenario: world.scenario,
    start: world.start,
    imageStyleTags: world.imageStyleTags,
    imageNegativeTags: world.imageNegativeTags,
    imageIncludeTrackers: world.imageIncludeTrackers === true,
    imageIncludeNpcTrackers: world.imageIncludeNpcTrackers === true,
    imageTrackerKeys: normKeyList(world.imageTrackerKeys, world.trackerDefs),
    imageNpcTrackerKeys: normKeyList(world.imageNpcTrackerKeys, world.npcTrackerDefs),
    stats: {
      pointsPerLevel: stats.pointsPerLevel, ccBudget: stats.ccBudget, ccFloor: stats.ccFloor,
      ccCeiling: stats.ccCeiling,
      averageThreshold: stats.averageThreshold, exceptionalThreshold: stats.exceptionalThreshold,
      modStep: stats.modStep,
      dieSides: stats.dieSides, useStatModFormula: stats.useStatModFormula, statModFormula: stats.statModFormula,
      checkIncludeTrackers: stats.checkIncludeTrackers === true,
      checkIncludeNpcTrackers: stats.checkIncludeNpcTrackers === true,
      checkTrackerKeys: normKeyList(stats.checkTrackerKeys, world.trackerDefs),
      checkNpcTrackerKeys: normKeyList(stats.checkNpcTrackerKeys, world.npcTrackerDefs),
      useCheckInstruction: stats.useCheckInstruction === true, checkInstruction: stats.checkInstruction || "",
      defs: (world.statDefs || []).map((d) => ({ key: d.key, label: d.label, hint: d.hint, start: d.start, max: d.max, rules: d.rules }))
    },
    trackers: (world.trackerDefs || []).map((d) => t(d)),
    npcTrackers: (world.npcTrackerDefs || []).map((d) => t(d)),
    npcs: (world.npcs || []).map((n) => {
      const o = {
        name: n.name, age: n.age, gender: n.gender, race: n.race,
        appearance: n.appearance, job: n.job, persona: n.persona, secrets: n.secrets, extra: n.extra,
        avatar: n.avatar
      };
      if (n.trackers && Object.keys(n.trackers).length) o.trackers = { ...n.trackers };
      return o;
    })
  };
}

// The user's world library over the kv-plugin: folder "worlds", key = world meta.id, value = the
// world in FILE form (format/version/stats/trackers — byte-equivalent to its exported .json, so
// everything round-trips through the loader), plus an index at "worlds/index" =
// [{id,name,description,tags,updatedAt}] so the library list never loads full worlds just to
// render cards. The bundled worlds (src/game/worlds/, listed in its manifest.json) are NOT stored
// here — the app always shows them separately from the bundled set (the manifest's `default`
// world is the universal fallback). Read is the only normalization point: get()/all() return the
// canonical World via the loader; the kv never holds the canonical form.
export class WorldStore {
  constructor(kv) {
    this.kv = kv;
    this.worlds = kv.worlds; // the plugin's "worlds" folder
    // This device's community identity: the username (the cosmetic `meta.author` NAME every card
    // shows) and the stable `userId` behind it (the `meta.authorId` that says a world is OURS), both
    // read once from the record the community layer writes to `community/user` (README §6.9).
    // Neither is typed by hand: the create/duplicate/publish flows sign a world with them (`sign`),
    // and because the id never changes, a community rename stays exact — no guessing by name.
    this.authorName = "";
    this.authorId = "";
    this.ready = this.loadIdentity();
  }

  // Read the identity. Both fields stay "" on a device that has never published/claimed a name.
  // A storage failure (low space closing the IDB connection) also leaves them "" — the world is
  // still playable, it just isn't signed as ours until storage answers again.
  async loadIdentity() {
    try {
      const u = await withStorageRetry(() => this.kv.community.get("user"), { retries: 1 });
      this.authorName = (u && u.username) || "";
      this.authorId = (u && u.userId) || "";
    } catch (e) {
      if (!isStorageError(e)) console.warn("[world] identity read failed:", e);
      else console.warn("[world] identity read failed (storage unavailable):", (e && e.message) || e);
      this.authorName = ""; this.authorId = "";
    }
    return this.authorName;
  }

  // Claim a world file as this device's own: stamp the current username AND the stable userId. Called
  // from exactly the flows that AUTHOR a world — create, duplicate, publish — never on an import (an
  // imported world keeps the author it came with) and never on a plain save (editing someone's
  // imported world must not quietly take credit for it). A no-op while we have no identity yet: the
  // author is cosmetic provenance, never authoritative, so an unsigned local file is perfectly valid.
  async sign(fileForm) {
    await this.ready;
    if (!fileForm || !fileForm.meta) return fileForm;
    if (this.authorName) fileForm.meta.author = this.authorName;
    if (this.authorId) fileForm.meta.authorId = this.authorId;
    return fileForm;
  }

  // The cheap card list (no full world objects). Never rejects with a raw storage error: a
  // low-space device gets [] (bundled worlds still play) instead of an unhandled rejection.
  async list() {
    const v = await safeStorageRead(() => this.worlds.get("index"), [], "[world]");
    return v || [];
  }

  async saveIndex(idx) {
    try {
      await withStorageRetry(() => this.worlds.set("index", idx), { retries: 1 });
    } catch (e) {
      if (isStorageError(e)) {
        const err = new Error("Couldn't save the world list — this device may be low on space. Free up space, then try again. Nothing was deleted.");
        err.isStorageUnavailable = true; err.cause = e;
        throw err;
      }
      throw e;
    }
  }

  // The raw stored file form by id (null if missing) — for export/duplicate round-trips.
  // Storage failures read as "missing" so callers fall back to the default world.
  async getRaw(id) {
    return await safeStorageRead(async () => {
      const raw = await this.worlds.get(id);
      return (raw === undefined || raw === null) ? null : raw;
    }, null, "[world]");
  }

  // Load + normalize one stored world by id (null if missing/invalid).
  async get(id) {
    const raw = await this.getRaw(id);
    if (!raw) return null;
    const { world, warnings, errors } = normalizeWorld(raw);
    if (!world) { console.warn(`[world] Stored world "${id}" failed to normalize:`, errors); return null; }
    if (warnings.length) console.warn(`[world] Stored world "${id}" warnings:`, warnings);
    return world;
  }

  // Every user world as a full canonical World (default world NOT included).
  async all() {
    const idx = await this.list();
    const out = [];
    for (const e of idx) {
      const w = await this.get(e.id);
      if (w) out.push(w);
    }
    return out;
  }

  // Save a world's file form. Existing worlds are overwritten in place (meta.id is the key). The
  // author line is only ever refreshed for a world that is ALREADY ours and signed (`authorId`
  // matches this device's id), so a community rename follows through the next time you edit it —
  // saving never claims a world, and never overwrites the author of one that isn't ours. Claiming is
  // `sign`'s job, called from the create/duplicate flows (README §6.9).
  // Storage failures throw a friendly tagged Error (never the raw IDB jargon) so the caller can
  // toast one human sentence instead of tripping the engine's unhandled-rejection popup.
  async save(fileForm) {
    await this.ready;
    const meta = fileForm && fileForm.meta;
    if (meta && this.authorId && String(meta.authorId || "").trim() === this.authorId && this.authorName) {
      meta.author = this.authorName;
    }
    try {
      await withStorageRetry(() => this.worlds.set(meta.id, fileForm), { retries: 1 });
    } catch (e) {
      if (isStorageError(e)) {
        const err = new Error("Couldn't save that world — this device may be low on space. Free up space, then try again. Nothing was deleted.");
        err.isStorageUnavailable = true; err.cause = e;
        throw err;
      }
      throw e;
    }
    try {
      await this.refreshIndex();
    } catch (e) {
      // The world itself is stored; only the card index failed. Surface the same friendly error
      // so the UI says why the card may look stale, without losing the save.
      if (isStorageError(e) || e.isStorageUnavailable) {
        const err = new Error("World saved, but the library list couldn't be updated — this device may be low on space. Reload after freeing space if the card looks stale.");
        err.isStorageUnavailable = true; err.cause = e;
        throw err;
      }
      throw e;
    }
  }

  async remove(id) {
    try {
      await withStorageRetry(() => this.worlds.delete(id), { retries: 1 });
    } catch (e) {
      if (isStorageError(e)) {
        const err = new Error("Couldn't delete that world — this device may be low on space. Try again after freeing space.");
        err.isStorageUnavailable = true; err.cause = e;
        throw err;
      }
      throw e;
    }
    try {
      await this.refreshIndex();
    } catch (e) {
      if (isStorageError(e) || e.isStorageUnavailable) {
        console.warn("[world] index refresh after delete failed:", (e && e.message) || e);
        return;
      }
      throw e;
    }
  }

  // Rebuild the cheap card index from the stored worlds. A storage failure leaves the old index
  // alone (and logs) instead of rejecting — the cards may look stale until storage recovers.
  async refreshIndex() {
    let entries;
    try {
      entries = await withStorageRetry(() => this.worlds.entries(), { retries: 1 });
    } catch (e) {
      if (isStorageError(e)) {
        console.warn("[world] index refresh skipped (storage unavailable):", (e && e.message) || e);
        return;
      }
      throw e;
    }
    const idx = [];
    for (const [key, value] of entries) {
      if (key === "index") continue;
      const { world, errors } = normalizeWorld(value);
      if (!world) { console.warn(`[world] Skipping invalid stored world "${key}":`, errors); continue; }
      idx.push({ id: world.meta.id, name: world.meta.name, description: world.meta.description, tags: world.meta.tags, nsfw: world.meta.nsfw === true, author: world.meta.author, authorId: world.meta.authorId || "", remix: world.meta.remix || null, origin: world.meta.origin || "", cover: world.meta.cover, createdAt: world.meta.createdAt || "", updatedAt: world.meta.updatedAt });
    }
    idx.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    try {
      await this.saveIndex(idx);
    } catch (e) {
      if (isStorageError(e) || e.isStorageUnavailable) {
        console.warn("[world] index write skipped (storage unavailable):", (e && e.message) || e);
        return;
      }
      throw e;
    }
  }
}
