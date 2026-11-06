// scenario-import.js — import third-party "scenario" files as playable mno-worlds.
//
// HOW TO ADD ANOTHER FORMAT (the whole extensibility contract):
//   1. Write a `detect(obj)` (parsed JSON → boolean) and a `convert(obj)` (parsed JSON → world
//      in FILE form, throwing a player-facing Error on failure). Story-only formats build the
//      file form via `makeImportedFileForm` (blank rules — the import panel applies a template).
//      A format that already carries its complete rules layer returns it verbatim instead (see
//      `convertUnseenScribeMnoToWorld`) and flags its entry `complete: true`.
//   2. Register one entry in `SCENARIO_FORMATS` below: `{ format, source, extensions, detect,
//      convert }` (+ `complete: true` when the converted world needs no template). That's it —
//      the import flow, panel, template match, footer and failure message all read the registry.
//      `complete` entries skip the AI template panel in `importWorldFile` (main.js) and validate
//      like a direct import instead.
// The import flow (`importWorldFile` in main.js), the import panel, the AI template match, the
// card footer (`meta.origin`), and `importFailureMessage` all iterate the registry, so a new entry
// automatically flows through every path. Converters MUST stay minimal: carry the file's own words
// over verbatim and invent nothing (no genre guesses, no stats, no trackers, no cast) — the rules
// layer comes from the template the player picks in the panel.
//
// `convertScenarioFile(text)` is the entry point the import flow uses: it parses the text,
// dispatches to the first matching registry entry, and returns a world in FILE form
// (format/version/stats/trackers — exactly what an exported `.mno-world` contains), with
// `meta.id` slugged from the title (the import flow re-mints a fresh random id from it, since
// sessions bind to the id).

import { MAX_AUTHOR_TAGS } from "./world.js";

export const UNSEEN_SCRIBE_FORMAT = "unseen-scribe-library-scenario-v1";
// The Library's MNO-backed envelope: the same scenario prose plus the complete original
// world in `mnoWorld` (their `scenario-mno-document.js` builds it from an mno-world upload).
export const UNSEEN_SCRIBE_MNO_FORMAT = "unseen-scribe-library-scenario-mno-v1";
// Display name of the source a scenario file came from (shown in the import panel).
export const UNSEEN_SCRIBE_SOURCE = "Unseen Scribe Library";

// Registry of every supported third-party scenario format. Order = dispatch priority (first
// `detect` match wins). Keep entries small: identity + file hints + two pure functions. Everything
// downstream reads this list — see listSupportedScenarioFormats / scenarioSourceLabel /
// convertScenarioFile / importFailureMessage.
export const SCENARIO_FORMATS = [
  {
    format: UNSEEN_SCRIBE_MNO_FORMAT,
    source: UNSEEN_SCRIBE_SOURCE,
    extensions: [".scenario.json"],
    // Complete restore: the file embeds the full mno-world, so the import flow skips the
    // AI template panel for it (see importWorldFile in main.js).
    complete: true,
    detect: (obj) => isUnseenScribeMnoScenario(obj),
    convert: (obj) => convertUnseenScribeMnoToWorld(obj),
  },
  {
    format: UNSEEN_SCRIBE_FORMAT,
    source: UNSEEN_SCRIBE_SOURCE,
    // File-name hints only (the picker currently filters to `.mno-world`; the branch is
    // content-based so these are documentation for a future picker + error text).
    extensions: [".scenario.json"],
    detect: (obj) => isUnseenScribeScenario(obj),
    convert: (obj) => convertUnseenScribeToWorld(obj),
  },
];

// Every registered format id (e.g. `["unseen-scribe-library-scenario-v1"]`). Pure.
export function listSupportedScenarioFormats() {
  return SCENARIO_FORMATS.map((e) => e.format);
}

// Find the registry entry whose `detect` matches a parsed object, or null. Pure.
export function findScenarioFormat(obj) {
  for (const e of SCENARIO_FORMATS) {
    try { if (e && typeof e.detect === "function" && e.detect(obj)) return e; }
    catch (err) {}
  }
  return null;
}

// One-line hint naming every supported scenario source (used by the failure popup). Pure.
export function supportedScenarioHint() {
  const names = [...new Set(SCENARIO_FORMATS.map((e) => e.source).filter(Boolean))];
  if (!names.length) return "Import an .mno-world file.";
  return `Import an .mno-world file or a supported scenario file (${names.join(", ")}).`;
}

// Human-readable source label for scenario FILE TEXT, or null when it isn't a supported
// scenario. Pure (no AI call).
export function scenarioSourceLabel(text) {
  try {
    const entry = findScenarioFormat(JSON.parse(String(text || "")));
    return entry ? entry.source : null;
  } catch (e) {}
  return null;
}

// Wrong-file-type detectors for the importers. A full backup dropped on Import World / Import
// Save is the classic mix-up (same file picker habit, similar filename), and world ⇄ adventure
// swaps happen too. Pure (JSON sniff only, no UI) — callers turn these into redirect popups.
export function isBackupFileText(text) {
  try {
    const o = JSON.parse(String(text || ""));
    return !!o && typeof o === "object" && !Array.isArray(o) && o.format === "mno-backup";
  } catch (e) { return false; }
}
export function isAdventureFileText(text) {
  try {
    const o = JSON.parse(String(text || ""));
    return !!o && typeof o === "object" && !Array.isArray(o) &&
      (o.version === 1 || o.version === 2) && typeof o.id === "string" && !!o.id;
  } catch (e) { return false; }
}
export function isWorldFileText(text) {
  try {
    const o = JSON.parse(String(text || ""));
    return !!o && typeof o === "object" && !Array.isArray(o) && o.format === "mno-world";
  } catch (e) { return false; }
}

// Mechanical stat-config defaults (no stat DEFS — these numbers only matter if the author adds
// defs later in the editor). Same values as the loader's own fallbacks (see world.js).
const EMPTY_STATS_CFG = {
  pointsPerLevel: 2, ccBudget: 12, ccFloor: 5, ccCeiling: 20,
  averageThreshold: 10, exceptionalThreshold: 15, modStep: 5, dieSides: 20,
  useStatModFormula: false, statModFormula: "",
  checkIncludeTrackers: false, checkIncludeNpcTrackers: false,
  checkTrackerKeys: [], checkNpcTrackerKeys: [],
  useCheckInstruction: false, checkInstruction: ""
};

// True when the parsed object is the Library's MNO-backed scenario envelope: the
// `unseen-scribe-library-scenario-mno-v1` format carrying the complete original world in
// `mnoWorld` alongside the scenario prose.
export function isUnseenScribeMnoScenario(obj) {
  return !!obj && typeof obj === "object" && !Array.isArray(obj) &&
    obj.format === UNSEEN_SCRIBE_MNO_FORMAT &&
    !!obj.mnoWorld && typeof obj.mnoWorld === "object" && !Array.isArray(obj.mnoWorld);
}

// Convert a Library MNO envelope into a world in FILE form — a full-fidelity restore, not
// a story-only import: the embedded world already carries its complete rules layer (stat
// config + defs, trackers, NPC trackers, standing cast with avatars, lorebook, vibe, image
// tags), so everything rides over verbatim and there is nothing for a template to add. The
// one stamp is `meta.origin: "imported"` (provenance for the card footer — authorship still
// wins there, so your own world still reads "My World"). The embedded id is kept, so the
// import flow's usual collision handling (bundled-id + existing-world Replace) applies
// exactly as for a direct .mno-world import. Structural check only — the loader itself
// validates the result in the import flow. Throws a player-facing Error otherwise.
export function convertUnseenScribeMnoToWorld(raw) {
  const inner = raw && typeof raw === "object" && !Array.isArray(raw) ? raw.mnoWorld : null;
  if (!inner || typeof inner !== "object" || Array.isArray(inner) || inner.format !== "mno-world") {
    throw new Error("This Library file doesn't contain an MNO world to import.");
  }
  let fileForm;
  try {
    fileForm = JSON.parse(JSON.stringify(inner));
  } catch (e) {
    throw new Error("This Library file couldn't be read (" + (e && e.message ? e.message : "unknown error") + ").");
  }
  if (!fileForm.meta || typeof fileForm.meta !== "object" || Array.isArray(fileForm.meta)) fileForm.meta = {};
  fileForm.meta.origin = "imported";
  return fileForm;
}

// True when the parsed object looks like an unseen-scribe library scenario.
export function isUnseenScribeScenario(obj) {
  return !!obj && typeof obj === "object" && !Array.isArray(obj) &&
    obj.format === UNSEEN_SCRIBE_FORMAT && typeof obj.title === "string" && !!obj.title.trim();
}

// Slugify a title into a valid `meta.id` (lowercase letters, digits, hyphens — see world.js).
function slugify(title) {
  const s = String(title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return /^[a-z0-9][a-z0-9-]*$/.test(s) ? s : "imported-scenario";
}

// Shared file-form builder every converter reuses: a blank-rules mno-world carrying only the
// given story text. No vibe, no lorebook, no stat defs (so character creation skips stats and no
// skill checks ever fire), no trackers, no NPCs — exactly like a blank template. The one addition
// is `meta.origin: "imported"` — provenance for the card footer (see isImportedMeta in world.js),
// never an author tag. Pure.
export function makeImportedFileForm({ title, description, scenario, start }) {
  const now = new Date().toISOString();
  const name = String(title || "").trim() || "Imported scenario";
  return {
    format: "mno-world",
    version: 1,
    meta: {
      id: slugify(name), // the import flow re-mints a fresh random id (sessions bind to it)
      name,
      description: String(description || "").trim(),
      author: "",
      authorId: "",
      tags: [],
      nsfw: false,
      origin: "imported", // provenance for the card footer (see isImportedMeta in world.js)
      cover: "",
      createdAt: now,
      updatedAt: now
    },
    narrativeVibe: "",
    lorebook: [],
    scenario: String(scenario || ""),
    start: String(start || ""),
    imageStyleTags: "",
    imageNegativeTags: "",
    imageIncludeTrackers: false,
    imageIncludeNpcTrackers: false,
    imageTrackerKeys: [],
    imageNpcTrackerKeys: [],
    stats: { ...EMPTY_STATS_CFG, defs: [] },
    trackers: [],
    npcTrackers: [],
    npcs: []
  };
}

// Convert a parsed + validated unseen-scribe scenario object into a world in FILE form.
// Mapping (verbatim, nothing invented):
//   * `title`            → `meta.name`
//   * `shortDescription` → `meta.description`
//   * `premise`          → `scenario` (byte-identical)
//   * `openingScene` (else `starters[0]`, else empty) → `start` (byte-identical)
// Throws a player-facing Error when the object isn't a supported scenario or has no premise.
export function convertUnseenScribeToWorld(raw) {
  if (!isUnseenScribeScenario(raw)) {
    const fmt = raw && typeof raw === "object" ? JSON.stringify(raw.format) : String(raw);
    const want = listSupportedScenarioFormats().map((f) => `"${f}"`).join(" or ");
    throw new Error(`Not a supported scenario file (format: ${fmt || "unknown"} — expected ${want}).`);
  }
  const premise = String(raw.premise || "").trim();
  if (!premise) throw new Error("This scenario has no premise to build a world from.");
  const start = String(raw.openingScene || (Array.isArray(raw.starters) && raw.starters[0]) || "").trim();
  return makeImportedFileForm({
    title: String(raw.title).trim(),
    description: String(raw.shortDescription || "").trim(),
    scenario: premise,
    start,
  });
}

// Build the player-facing message for a file that is NEITHER a valid mno-world (directErrors
// from the loader) NOR a convertible scenario (convErr from the converter). A foreign format gets
// ONE line naming it — never the loader's version/meta cascade, which only describes why a
// foreign file isn't an mno-world. A file that CLAIMS the mno-world format keeps the loader's
// specific errors, and unparseable text keeps the JSON error. Pure (no AI call, no UI).
export function importFailureMessage(text, directErrors, convErr) {
  let parsed = null;
  try { parsed = JSON.parse(String(text || "")); } catch (e) { parsed = null; }
  const isObj = !!parsed && typeof parsed === "object" && !Array.isArray(parsed);
  // Wrong-file-type mix-ups get a redirect, not a format lecture. (A backup also gets a
  // dedicated popup with an "Open Data & Backup" button in importWorldFile; this text covers
  // the inbound-share path, which has no settings to open over.)
  if (isObj && parsed.format === "mno-backup") {
    return "That's a FULL BACKUP of everything in this browser (adventures, worlds, library and settings), not a single world — it can't be imported here. Restore it under Settings › Data & Backup › Import.";
  }
  if (isObj && (parsed.version === 1 || parsed.version === 2) && typeof parsed.id === "string" && parsed.id) {
    return "That's an adventure save, not a world. Import it from the Adventures page (Import Save) instead.";
  }
  const fmt = isObj ? parsed.format : undefined;
  if (isObj && fmt !== "mno-world") {
    // A supported scenario fails conversion only for a specific reason (e.g. no premise) — say
    // that; anything else is just a format we don't read.
    if (findScenarioFormat(parsed)) return String((convErr && convErr.message) || "Couldn't convert this scenario.");
    const hint = supportedScenarioHint();
    if (typeof fmt === "string" && fmt) return `Unsupported file format: ${JSON.stringify(fmt)}. ${hint}`;
    return `This isn't a supported world or scenario file. ${hint}`;
  }
  const errs = Array.isArray(directErrors) ? directErrors.filter(Boolean) : [];
  if (errs.length) return errs.join("\n");
  return String((convErr && convErr.message) || "Import failed.");
}

// Parse scenario FILE TEXT (any supported third-party format) into a world in file form.
// Dispatches via the SCENARIO_FORMATS registry (first `detect` match wins); throws a
// player-facing Error otherwise. Pure (no AI call).
export function convertScenarioFile(text) {
  let obj;
  try { obj = JSON.parse(String(text || "")); }
  catch (e) { throw new Error(`Not JSON: ${e.message}`); }
  const entry = findScenarioFormat(obj);
  if (!entry) {
    const fmt = obj && typeof obj === "object" ? JSON.stringify(obj.format) : String(obj);
    const want = listSupportedScenarioFormats().map((f) => `"${f}"`).join(" or ");
    throw new Error(`Not a supported scenario file (format: ${fmt || "unknown"} — expected ${want}).`);
  }
  return entry.convert(obj);
}

// ---------------------------------------------------------------------------
// Inbound share (the return path: others link INTO this engine to import).
// ---------------------------------------------------------------------------
// URL contract (ours to define — the sender appends one query parameter):
//   https://perchance.org/<generator>?importdata=[<name>~]<32hex>.gz
// `<name>` is a cosmetic prefix the sender may add (same `~` convention as the outbound
// handoff); the token is the bare upload-plugin filename, fetched ONLY from INBOUND_HOST
// below — never an arbitrary URL. Pure parsers; the network half lives in main.js.
export const INBOUND_PARAM = "importdata";
export const INBOUND_HOST = "https://user.uploads.dev/file";
const INBOUND_TOKEN_RE = /^[0-9a-f]{32}\.gz$/;

// Parse an `?importdata=` value into `{ name, token }`, or null when absent/malformed.
// Accepts a bare token or a `<name>~<token>` reference (split on the LAST `~`, mirroring
// the outbound link). Pure.
export function parseInboundReference(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const cut = raw.lastIndexOf("~");
  const token = (cut === -1 ? raw : raw.slice(cut + 1)).trim();
  if (!INBOUND_TOKEN_RE.test(token)) return null;
  const name = cut === -1 ? "" : raw.slice(0, cut).trim();
  return { name, token };
}

// Read the `?importdata=` reference from a query string (default: this page's). Pure.
export function inboundReferenceFromSearch(search) {
  let params;
  try {
    params = new URLSearchParams(typeof search === "string" ? search : window.location.search);
  } catch (e) { return null; }
  return parseInboundReference(params.get(INBOUND_PARAM));
}

// The one URL an inbound token may be fetched from. Returns "" for a malformed token so
// a caller can never build a fetch out of anything but a validated reference.
export function inboundFileUrl(token) {
  const t = String(token || "").trim();
  if (!INBOUND_TOKEN_RE.test(t)) return "";
  return `${INBOUND_HOST}/${t}`;
}

// ---------------------------------------------------------------------------
// Rules-template matching (the import panel asks the AI which template fits).
// ---------------------------------------------------------------------------

// Stat-config keys a template file may carry (see world.js). Anything else on `stats` is ignored.
const TEMPLATE_CFG_KEYS = [
  "pointsPerLevel", "ccBudget", "ccFloor", "ccCeiling",
  "averageThreshold", "exceptionalThreshold", "modStep", "dieSides",
  "useStatModFormula", "statModFormula",
  "checkIncludeTrackers", "checkIncludeNpcTrackers",
  "checkTrackerKeys", "checkNpcTrackerKeys",
  "useCheckInstruction", "checkInstruction"
];

// Build the instruction that asks the AI to pick the best-fitting rules template.
// `templates` = [{ file, name, desc }] — the live template catalog, so the choice stays valid as
// templates are added/renamed. Pure (no AI call) so it can be tested without spending quota.
export function buildTemplateChoiceInstruction(scenarioTitle, scenarioPremise, templates) {
  let premise = String(scenarioPremise || "").trim();
  if (premise.length > 3000) premise = premise.slice(0, 3000).trimEnd() + "\n…(truncated)";
  const lines = (Array.isArray(templates) ? templates : []).map((t) =>
    `- "${t.name}" (${t.file}): ${t.desc || "no description"}`);
  return [
    "You are matching a third-party story scenario to the best-fitting RULES template for a text RPG. The scenario's own words (title, premise, opening) are kept untouched — you only choose which template's stats, trackers, tone and image style should back it.",
    "",
    "SCENARIO TITLE:",
    String(scenarioTitle || "(untitled)"),
    "",
    "SCENARIO PREMISE:",
    premise || "(none)",
    "",
    "TEMPLATES:",
    ...lines,
    "",
    "TASK: reply with ONLY a JSON object of exactly this shape, nothing else:",
    '{"template": "<file>", "reason": "<one sentence>"}',
    'where <file> is one of the (file) ids above — the template whose stats and trackers best fit the scenario\'s genre and the activities it describes (travel, combat, magic, investigation, survival, social intrigue, …). Choose "blank" only when no template fits at all.'
  ].join("\n");
}

// Resolve an AI-parsed value to a catalog file id, or null when it names nothing usable. Accepts
// { template } / { file } / { name } objects or a bare string (file id or display name).
export function parseTemplateChoice(value, templates) {
  const catalog = Array.isArray(templates) ? templates : [];
  let want = "";
  if (typeof value === "string") want = value.trim();
  else if (value && typeof value === "object") {
    want = String(value.template || value.file || value.name || "").trim();
  }
  if (!want) return null;
  const low = want.toLowerCase();
  for (const t of catalog) {
    if (String(t.file || "").toLowerCase() === low) return t.file;
    if (String(t.name || "").toLowerCase() === low) return t.file;
  }
  return null;
}

// Apply a template FILE object onto a converted scenario world: the template supplies the rules
// layer (stat config + defs, trackers, npc trackers, vibe, image tags, genre tags) while the
// scenario keeps its title, description, premise and opening. Returns a NEW file form.
export function applyTemplateToWorld(fileForm, templateFile) {
  const f = JSON.parse(JSON.stringify(fileForm));
  const t = (templateFile && typeof templateFile === "object" && !Array.isArray(templateFile)) ? templateFile : {};
  f.narrativeVibe = typeof t.narrativeVibe === "string" ? t.narrativeVibe : "";
  f.imageStyleTags = typeof t.imageStyleTags === "string" ? t.imageStyleTags : "";
  f.imageNegativeTags = typeof t.imageNegativeTags === "string" ? t.imageNegativeTags : "";
  f.imageIncludeTrackers = t.imageIncludeTrackers === true;
  f.imageIncludeNpcTrackers = t.imageIncludeNpcTrackers === true;
  const keyList = (v) => Array.isArray(v) ? [...new Set(v.map((k) => String(k == null ? "" : k).trim()).filter(Boolean))] : [];
  f.imageTrackerKeys = keyList(t.imageTrackerKeys);
  f.imageNpcTrackerKeys = keyList(t.imageNpcTrackerKeys);
  const stats = (t.stats && typeof t.stats === "object" && !Array.isArray(t.stats)) ? t.stats : {};
  const cfg = { ...EMPTY_STATS_CFG };
  for (const k of TEMPLATE_CFG_KEYS) if (stats[k] !== undefined) cfg[k] = stats[k];
  cfg.defs = Array.isArray(stats.defs)
    ? stats.defs.filter((d) => d && typeof d === "object").map((d) => ({ ...d }))
    : [];
  f.stats = cfg;
  f.trackers = Array.isArray(t.trackers)
    ? t.trackers.filter((d) => d && typeof d === "object").map((d) => ({ ...d }))
    : [];
  f.npcTrackers = Array.isArray(t.npcTrackers)
    ? t.npcTrackers.filter((d) => d && typeof d === "object").map((d) => ({ ...d }))
    : [];
  // Genre tags come straight from the template; provenance rides on `meta.origin`
  // (the card footer), never as a tag, so all author-tag slots stay free.
  const seen = new Set();
  const tags = [];
  for (const raw of (t.meta && Array.isArray(t.meta.tags) ? t.meta.tags : [])) {
    const v = String(raw || "").trim();
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    tags.push(v);
    if (tags.length >= MAX_AUTHOR_TAGS) break;
  }
  if (!f.meta) f.meta = {};
  f.meta.tags = tags;
  f.meta.updatedAt = new Date().toISOString();
  return f;
}
