// MNO RPG ENGINE — main app. Boots the UI, drives the chat loop, sessions, memory, and panels.
import { SessionStore, HeroStore, exportState, parseImported, SAVE_EXTENSION } from "./storage.js";
import { MemorySystem, MEMORY_EVERY_TURNS, MANUAL_ENABLED_CAP, manualEnabledCount, normalizeMemories, ownerLabel } from "./memory-system.js";
import { NpcLifeSystem, NPC_LIFE_EVERY_TURNS, NPC_LIFE_MAX_PER_TICK, NPC_LIFE_MIN_OFFSCREEN_TURNS, NPC_LIFE_HISTORY_MAX, NPC_LIFE_GOAL_MAX_CHARS, NPC_LIFE_WHERE_MAX_CHARS } from "./npc-life.js";
import { NpcSystem, mergePersona, npcLinkRuleFor } from "./npc-system.js";
import { RPEngine } from "./rp-engine.js";
import { defaultCharacter } from "./character.js";
import { initialTrackers, getCurrentTrackers as deriveCurrentTrackers, parseTrackerBlock, extractTrackers, stripBlockForDisplay, groupByRow, liveMax, isDead, lifeTracker, levelTracker, expTracker, locationTracker, locationValue, isQuestTrackerDef, foldNpcTrackers, initialNpcTrackers, purgeNpcTrackerKeys, purgeNpcTrackerHistory, extractNpcTrackers, parseNpcTrackerBlock, npcTrackerBlockText, applyLevelUpBackstop } from "./trackers.js";
import { ensureStats, clampStat, statTier, checkMod, resolveCheck } from "./stats.js";
import { loadWorld, emptyWorld, WorldStore, exportWorld, worldToFile, WORLD_EXTENSION, isNsfwMeta, isCommentsOffMeta, isRemixMeta, isImportedMeta, isReservedTag, NSFW_TAG, REMIX_TAG, MAX_AUTHOR_TAGS } from "./world.js";
import { tagChipsHtml, scheduleTagFit } from "./tag-row.js";
import { MapSystem, formatDistance, compassDir, normalizeLoc, locDetail, matchPoi, DEFAULT_ICON, mapScale, inferScaleFromPois, roundCoord } from "./map-system.js";
import { lorebookToText, normalizeLoreEntry, splitKeywords, resolveNpcName, LORE_TYPES, loreDocText } from "./lorebook.js";
import { memoryDocText } from "./memory-system.js";
import { warmupSessionVectors, sweepVectorsIfDue, warmupTexts } from "./embeddings.js";
import { npcSemanticFields } from "./rp-engine.js";
import { subUser, USER_PLACEHOLDER } from "./text-utils.js";
import { inlineMd, richText, richTextWithMentions } from "./rich-text.js";
import { notesIdFromValue, isNotesPointer, notesUrlForId, fetchNotesText } from "./notes.js";
import { fileToAvatarDataUrl, pickImageFile, sceneImageToWebp, genImageSafe, withTimeout, IMAGE_PROMPT_TIMEOUT_MS } from "./image-utils.js";
import { pushBackClose } from "./back-close.js";
import { initLightbox } from "./lightbox.js";
import { initInfoTips, infoTipHtml, infoTipLabelHtml } from "./info-tip.js";
import { TextPopup, ConfirmPopup } from "./popups.js";
import { initSceneImages, runSceneCommand, quickSceneImage, imageMsgEl, editImagePrompt, rerollImagesWithConfirm, deleteMessageWithConfirm, renderGalleryBody, allGalleryImages, scenePrefs, persistScenePrefs } from "./scene-images.js";
import {
  syncHomeHash, isStaleHomeHashEcho, reassertHomeHash,
  homeRouteFromHash as parseHomeRoute, hashChangeTraversed,
  pushLandingHistory as pushLandingEntry, pushSessionEntry, pushUserEntry,
  forgetEntry, popEntry, shouldDeferToUserBridge, shouldDeferToMenuBridge,
  bridgeReturnInProgress, isDeadSessionHash,
} from "./nav-history.js";
import { initViewCount } from "./view-count.js";
import { initLastEdit } from "./last-edit.js";
import { initUpdateCheck } from "./update-check.js";
// Sharded added-world file cache (one IndexedDB key per world): single-world reads are one
// small transaction with no community-module import, so the boot/home paths stay cheap.
import { getCacheEntry, readCacheEntries } from "./libcache.js";
import { searchControl, searchBar, switchEl, closeSearchPop, showNsfw, setShowNsfw, ICON_SEARCH } from "./search-bar.js";
import { ICON_FS_EXPAND, ICON_FS_COMPRESS, ICON_BACK_CHEV, ICON_ED_NARRATIVE, ICON_ED_TRACKERS, ICON_ED_NPC, ICON_IMPORT, ICON_EXPORT, ICON_DOWNLOAD, ICON_HEART, ICON_COMMENT, ICON_NOTE_DOC, ICON_OVERVIEW } from "./icons.js";
import { routedGenText, aiModelSection, aiModelLabel } from "./ai-provider.js";
    import { routedGenImage, imageProviderControls, imageModelLabel } from "./image-provider.js";
import { aiCloseBlocker } from "./ai-provider.js";
import { imageCloseBlocker } from "./image-provider.js";
import { getAiConfig, saveAiConfig } from "./ai-provider.js";
import { saveImageConfig } from "./image-provider.js";
import { initCtxMeter, refreshCtxMeter } from "./ctx-meter.js";
import { imageGuidance } from "./image-gen-prefs.js";
import { maybeShowAnnouncement, setAnnouncementActionHandler } from "./announcements.js";
import { ensureLandingShell, setLandingBrand, dismissBootSplash, bindHomeNav, closeHomeNav, applyHomeNavPref, applyRailTips, bindHnFootActions } from "./landing-shell.js";
import { ensureAppShell, ensureTavernFab, tavernFabEnabled, setTavernFabEnabled, setAppBrand, secIconInner, RAIL_SECTIONS, VALID_SECS, renderRailTabs, IS_MOBILE, INPUT_PLACEHOLDER } from "./app-shell.js";
import { notify, notifyLevelUp, setBusy, clearBusy } from "./notify.js";
import { openChangelog } from "./changelog.js";
import { renderIncremental, flipFilter, emptyStateEl, optionEl, renderActivePills } from "./page-helpers.js";
import { initWorldCraft, freshWorldId, duplicateWorld, newWorld } from "./world-craft.js";
import { initScenarioImport, importWorldFile, checkInboundShare } from "./scenario-import-panel.js";
import { isStorageError, notifyStorageError } from "./storage-errors.js";

// Last-resort net: a storage failure that still escapes a caught path (low space closing the IDB
// connection mid-transaction) must toast one human sentence — never the engine's raw
// "An error has occurred somewhere in your code" popup with IDB jargon. Non-storage errors are
// left alone so real bugs still surface loudly.
window.addEventListener("unhandledrejection", (ev) => {
  try {
    if (isStorageError(ev && ev.reason)) {
      ev.preventDefault();
      console.warn("[storage] unhandled storage rejection swallowed:", (ev.reason && ev.reason.message) || ev.reason);
      notifyStorageError((m, o) => { try { notify(m, o); } catch (toastErr) {} }, "reading", ev.reason);
    }
  } catch (e) { /* the net itself must never throw */ }
});
window.addEventListener("error", (ev) => {
  try {
    const err = (ev && ev.error) || (ev && ev.message);
    if (isStorageError(err)) {
      try { ev.preventDefault(); } catch (preventErr) {}
      console.warn("[storage] unhandled storage error swallowed:", (err && err.message) || err);
      notifyStorageError((m, o) => { try { notify(m, o); } catch (toastErr) {} }, "reading", err);
    }
  } catch (e) { /* ignore */ }
});

// Announcement `[label](settings/…|explore|…|changelog|tavern)` buttons land here: internal app screens the
// md file can link to. Page switches push history, exactly like the nav rail's own clicks.
setAnnouncementActionHandler((act) => {
  if (act === "changelog") { openChangelog(); return; }
  if (act === "tavern" || act === "discussion") { openDiscussionPanel().catch(() => {}); return; }
  if (act.startsWith("tavern/") || act.startsWith("discussion/")) {
    openDiscussionPanel(act.slice(act.indexOf("/") + 1)).catch(() => {});
    return;
  }
  if (act === "settings" || act.startsWith("settings/")) {
    openSettingsPanel(act === "settings" ? null : act.slice(9));
    return;
  }
  if (HOME_MOUNTS[act]) setHomePage(act, { push: true });
});

const $ = (id) => document.getElementById(id);
window.genText = routedGenText;
window.genImage = routedGenImage;
const genText = window.genText;
const genImage = window.genImage;

let state = null;
let store, heroStore, memory, npcLife, npcSys, engine, mapSys;
let worldStore = null; // kv world library (user worlds)
let bundledWorlds = []; // every bundled world under src/game/worlds/ (manifest.json), in order
let defaultWorld = null; // the bundled world flagged `default` in the manifest — universal fallback
let currentWorldId = null; // which world's content is loaded into the globals/engine right now
let currentWorldName = ""; // its display name, so a session can remember the world it was built in
let engineImagePrompt = ""; // the engine's default scene-image prompt (image-prompt.md) — the fallback for worlds without imagePrompt
let worldNameCache = {}; // worldId -> display name, for session rows (refreshed with the library)
let gameTitle = "MNO RPG ENGINE"; // the page title from $meta (the chat topbar brand + the nav brand)
const MNO_USER_ID = "3490f80401886d12";
const isMnoAuthor = (userId, name) => String(userId || "").trim().toLowerCase() === MNO_USER_ID || String(name || "").trim().replace(/^@+/, "").toLowerCase() === "mnomno";
// The profile an author name links to: the catalog id when known, else the engine author's own id
// for official worlds (bundled worlds carry `author: "mnomno"` with no id) — "" when unknown.
const authorUid = (userId, name) => String(userId || "").trim() || (isMnoAuthor("", name) ? MNO_USER_ID : "");
const mnoBadgeCover = `<div class="ld-wcover-chips"><span class="ld-wbadge ld-wbadge-cover" title="Official world by mnomno">✦ MNO</span></div>`;
const mnoBadgeHead = `<span class="ld-wbadge wd-badge" title="Official world by mnomno">✦ MNO</span>`;
const linkLive = (link) => !!(link && link.status !== "removed");
const libRecLive = (rec) => !rec || !rec.status || (rec.status !== "removed" && rec.status !== "unknown");
let promptText = "", vibeText = "", scenarioText = "", startText = "", imagePromptText = "", imageStyleTags = "", imageNegativeTags = "";
let imageIncludeTrackers = false; // world opt-in: append hero tracker values to the scene-image PLAYER CHARACTER line
let imageIncludeNpcTrackers = false; // world opt-in: append NPC tracker values to the scene-image CHARACTERS PRESENT lines
let imageTrackerKeys = []; // world opt-in subset: explicit hero tracker keys for the scene-image prompt ([] = all)
let imageNpcTrackerKeys = []; // world opt-in subset: explicit NPC tracker keys for the scene-image prompt ([] = all)
let trackerDefs = []; // from the loaded world — the AI-tracked state/resources
let npcTrackerDefs = []; // from the loaded world — per-NPC tracked values (see README §6.3.1)
let statDefs = []; // from the loaded world — the player-owned hero attributes
let statCfg = {}; // world stats config (thresholds, modStep…) — used by skill checks
let statPointsPerLevel = 2; // stat points granted per level-up (world stats `pointsPerLevel`)
let ccBudget = 12; // creation-wizard starting points to spend (world stats `ccBudget`)
let ccFloor = 5; // creation-wizard floor a starting stat can be reduced to (world stats `ccFloor`)
let ccCeiling; // creation-wizard cap a starting stat can be raised to (world stats `ccCeiling`; undefined = capped only by each stat's max)
let statAvgT = 10; // stat value below this renders red (world stats `averageThreshold`)
let statExcT = 15; // stat value above this renders gold (world stats `exceptionalThreshold`)
let heroTab = "stats"; // which Hero-panel tab is open ("stats" | "bio")
let memTab = "manual"; // which Memory-panel sub-tab is open ("manual" | "auto" | "situation" | "threads")
let generating = false;
let activeStreamBubble = null; // the in-flight GM stream bubble (kept across re-renders — see render())
let mapGenBusy = false; // one surroundings-map generation at a time
let mapBusyToken = null; // which build owns `mapGenBusy` (an abandoned build must not clear it)
let pendingMapRefresh = false; // a ↻/map request arrived while the GM was writing — run it after the turn
let mapHighlight = -1; // index of the currently highlighted map POI (row ⇄ marker hover)
let leftSec = null; // active section in the left rail ('menu' | 'session' | 'memory' | 'settings')
let rightSec = null; // active section in the right rail ('character' | 'npc' | 'gallery')
let editing = null; // { turnIdx, which: 'action' | 'gm' }
let sessionBackRelease = null; // release() for the session's Back-button history entry (null when on the landing)
let trackerOpen = false; // mobile bottom drawer: expanded to show all trackers?
const AUTO_SCROLL_EPS = 40;
// Transcript windowing: only the last RENDER_INITIAL turns are built into the DOM; scrolling up
// loads RENDER_CHUNK more at a time (see loadOlderTurns/onTranscriptScroll). Keeps a very long
// story's chat cheap to render and its scrollbar usable.
const RENDER_INITIAL = 10;
const RENDER_CHUNK = 10;
let renderWindowStart = 0; // index into groupTurns(...) of the first turn actually in the DOM
let renderFollowTail = true; // true → the window snaps to the last RENDER_INITIAL turns on render
let bubbleRemoveAnchor = null;
let clickPin = null; // one-shot scroll pin for re-roll / version-nav clicks (consumed by next render)
let autoLoadArmed = true; // guards against a scroll-triggered load looping at the top
// The floating jump-to-latest button needs to be scrolled this far from the bottom before it shows,
// so a tiny scroll-up doesn't pop it immediately; it hides again within AUTO_SCROLL_EPS of the bottom
// (hysteresis via scrollBtnVisible).
const SCROLL_BTN_SHOW_PX = 160;
let scrollBtnVisible = false;

/* ---------- helpers ---------- */
// Quotes MUST be escaped too: this `esc` feeds quoted attributes (title="…", value="…",
// data-uid="…") in ~20 spots below, and an unescaped `"` closes the attribute early and spills
// the rest of the text into the element as bogus attributes (stored XSS via world/trackers/NPC names).
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// The always-on lorebook entries, rendered for the map/NPC subsystem prompts (they don't need the
// per-turn trigger logic — a fixed canon digest fits their one-shot calls best). Map POIs are
// geography, so the world/location entries matter most.
const MAP_LORE_TYPES = ["world", "location"];
function loreDigestFor(world, types = null, capChars = 0) {
  return lorebookToText(world.lorebook, { types: types || null, capChars });
}
function fmtWhen(ts) {
  if (!ts) return "never";
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + " min ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + " h ago";
  const days = Math.floor(h / 24);
  if (days < 7) return days === 1 ? "yesterday" : days + " days ago";
  return new Date(ts).toLocaleDateString();
}
// The detail popups' meta capsule — `v1 · 142 KB · updated 1d ago` — shared by the Worlds panel and
// Explore's. Kept local (community.js is lazily imported, so main.js can't pull it in at boot), but
// these two formatters deliberately match community.js's `fmtBytes`/`fmtRel` so the same world reads
// identically whichever panel you open it from.
function fmtBytes(n) {
  const b = Number(n) || 0;
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return (b / 1024).toFixed(b < 10 * 1024 ? 1 : 0) + " KB";
  return (b / (1024 * 1024)).toFixed(1) + " MB";
}
function fmtAgo(ts) {
  const t = Number(ts) || 0;
  if (!t) return "";
  const d = Date.now() - t;
  if (d < 60e3) return "just now";
  if (d < 3600e3) return Math.floor(d / 60e3) + "m ago";
  if (d < 86400e3) return Math.floor(d / 3600e3) + "h ago";
  if (d < 30 * 86400e3) return Math.floor(d / 86400e3) + "d ago";
  return new Date(t).toLocaleDateString();
}
// The local world file's own byte size — what an export/upload would carry. Used as the `bytes`
// fallback when the catalog's own `jsonBytes` isn't on hand (an unpublished world, or a library
// record written before that field existed).
function localWorldBytes(world) {
  try { return new TextEncoder().encode(JSON.stringify(worldToFile(world))).length; } catch (e) { return 0; }
}
// Build the capsule's contents from whichever of the three facts the caller knows; an unknown fact is
// simply left out, so an unpublished world shows size/updated without a fabricated version. The `·`
// separators are drawn by CSS (`.ex-meta`), exactly as in Explore's panel.
function worldMetaRow(m) {
  if (!m) return "";
  const bits = [];
  if (m.version) bits.push(`<span>v${esc(String(m.version))}</span>`);
  if (m.bytes) bits.push(`<span>${esc(fmtBytes(m.bytes))}</span>`);
  if (m.updatedAt) bits.push(`<span>updated ${esc(fmtAgo(m.updatedAt))}</span>`);
  return bits.join("");
}
// The transcript's text renderer — `richText` (rich-text.js) plus the same inline marks every other
// panel uses, so dialogue, a world's description and the changelog all read the same way.
function renderText(s) {
  return richText(s);
}
// The world detail views' renderer — descriptions and author's notes, where `@username` mentions
// link to that user's profile like the author line does. Spaced names need the catalog to tell
// the name from the sentence, so this upgrades the sync rendering in place (cached per session,
// never throws — offline it simply keeps the sync HTML).
async function enrichDescHtml(source) {
  try {
    const m = await communityModule();
    if (m && m.api && m.api.enrichMentionsHtml) return await m.api.enrichMentionsHtml(source);
  } catch (e) {}
  return richTextWithMentions(source);
}



function newSession(id, worldId) {
  const character = initCharacterStats(defaultCharacter());
  return {
    version: 2,
    id: id || Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    worldId: worldId || currentWorldId || defaultWorld.meta.id,
    // The world's display name, snapshotted while the world is still here. A world can be removed
    // from the library (or arrive with a backup on a device that never had it), and this is the only
    // thing about it the save can still name — see `chooseWorldForUnbound`.
    worldName: currentWorldName || "",
    name: "Adventure · " + new Date().toLocaleDateString(),
    character,
    messages: [],
    npcs: {},
    npcLinkRules: {}, // 🔗-menu overrides: { [displayLower]: {mode:"unlink"} | {mode:"link",target} }
    memories: { auto: [], manual: [], digest: "" },
    initialTrackers: initialTrackers(trackerDefs, character.stats),
    latestSituation: "", // one-line present-tense snapshot (refreshed each memory roll-up, always fed to the GM as LATEST SITUATION)
    latestSituationTurn: 0, // session turn the situation was last (re)written — roll-up or hand-edit; ages the GM's LATEST SITUATION line without touching the roll-up cadence
    openThreads: [], // one-line "what is in motion right now" items, refreshed by each memory roll-up and always fed to the GM
    map: null,       // { loc, status: 'loading'|'ready'|'error', pois, hero, scale, at } — surroundings of current location (scale: indoor|local|outdoor)
    mapCache: {},    // per-region POI cache: { [regionKey]: { pois, hero, scale } }
    surroundingsLoc: null, // last region whose SURROUNDINGS were fed to the GM (avoids re-feeding)
    surroundingsPos: null, // hero position (map units) when SURROUNDINGS were last fed (avoids re-feeding after small moves)
    turn: 0,
    messageCount: 0,
    lastAutoMemoryAt: 0,
    lastAutoMemoryTurn: 0,
    lastNpcLifeTurn: 0, // background off-screen NPC life cursor (see npc-life.js) — engine-level, not user-configurable
    settings: { showInnerThoughts: false, rollChecks: true, simNpcLife: true, showTrackerChanges: true }
  };
}


/* ---------- hero stats (player-owned attributes + level-up points) ---------- */
// Ensure a character has every configured stat (filled from `start`, clamped to max), a spendable
// stat-points pool, and a record of the hero level at which points were last granted (defaults to
// the session's starting level so a brand-new hero doesn't get retroactive points).
function initCharacterStats(c) {
  c.stats = ensureStats(c.stats, statDefs);
  for (const k of ["age", "gender", "race", "appearance", "job", "persona", "extra"]) if (typeof c[k] !== "string") c[k] = "";
  if (typeof c.statPoints !== "number" || !Number.isFinite(c.statPoints)) c.statPoints = 0;
  if (c.statFloors === undefined || typeof c.statFloors !== "object") c.statFloors = { ...c.stats };
  if (typeof c.statCommitted !== "boolean") c.statCommitted = false;
  if (c.statsAwardedLevel === undefined) {
    const init = initialTrackers(trackerDefs, c.stats);
    const lvlDef = levelTracker(trackerDefs);
    c.statsAwardedLevel = lvlDef && typeof init[lvlDef.key] === "number" ? init[lvlDef.key] : 1;
  }
  return c;
}

// After a GM turn completes, grant stat points if the hero leveled up (level is an AI-tracked
// resource; points are the player's to spend). `statsAwardedLevel` never moves backwards, so a
// re-roll that re-levels to a level already paid out grants nothing, and deleting turns doesn't
// claw points back. Each grant opens a fresh level-up window: it resets `statCommitted` and
// records the current stat values as the `statFloors` (the floor − can't go below).
// Returns the number of points granted (0 = none).
function grantLevelUpPoints() {
  if (!state || !statDefs.length) return 0;
  const c = state.character;
  const lvlDef = levelTracker(trackerDefs);
  const cur = lvlDef ? Number(currentTrackers()[lvlDef.key]) || 0 : 0;
  const awarded = typeof c.statsAwardedLevel === "number" ? c.statsAwardedLevel : 0;
  if (cur > awarded) {
    // Grant ONE level's worth per call and advance `statsAwardedLevel` by exactly 1, so a
    // tracker jump that skips levels (1 → 3) pays out one level per turn — never a burst of
    // several levels' worth at once. Each level-up is exactly `pointsPerLevel` points.
    const gained = statPointsPerLevel;
    c.statPoints = (typeof c.statPoints === "number" ? c.statPoints : 0) + gained;
    c.statsAwardedLevel = awarded + 1;
    c.statCommitted = false;
    c.statFloors = { ...c.stats };
    return gained;
  }
  return 0;
}

// Grant post-turn level-up points and celebrate (juiced toast + Hero rail glow). Shared by normal
// GM turns and hand-edited replies so both pay through the same high-water mark.
function grantAndAnnounceLevelUp() {
  const gained = grantLevelUpPoints();
  if (!gained) return 0;
  const lvlDef = levelTracker(trackerDefs);
  notifyLevelUp(lvlDef ? Number(currentTrackers()[lvlDef.key]) || 0 : 0, gained);
  refreshRailIfOpen("right");
  return gained;
}

// True while a "level-up window" is open for the current hero: unspent stat points OR an
// un-committed allocation (any stat sitting above its baseline). Drives the glowing indicators.
function levelUpWindowOpen() {
  const c = state && state.character;
  if (!c) return false;
  const pts = typeof c.statPoints === "number" ? c.statPoints : 0;
  const floors = (c.statFloors && typeof c.statFloors === "object") ? c.statFloors : {};
  return pts > 0 || Object.keys(floors).some((k) => (c.stats[k] ?? 0) > (floors[k] ?? 0));
}

// Reflect "level-up window open" on the Hero rail tab (pulsing gold dot). The Stats tab glow is
// set directly in renderCharacterPanel's template. Called from renderCharacterPanel and
// refreshRailIfOpen so the dot appears even when the right rail is collapsed or on another tab.
function updateLvlIndicators() {
  const heroTab = document.querySelector('#rightRail .rail-tab[data-sec="character"]');
  if (heroTab) heroTab.classList.toggle("lvl-open", levelUpWindowOpen());
}

/* ---------- boot ---------- */
async function init() {
  // Shells are JS-mounted (index.html is shell-free): create them before anything queries their ids.
  ensureLandingShell();
  ensureAppShell();
  store = new SessionStore(window.kv);
  heroStore = new HeroStore(window.kv);
  worldStore = new WorldStore(window.kv);
  try {
    await worldStore.refreshIndex(); // keep the card index current (e.g. add cover to older entries)
  } catch (e) {
    // Storage reads already fall back internally; this is only the paranoid net so a low-space
    // device still boots to the landing instead of dying before first paint.
    if (isStorageError(e) || (e && e.isStorageUnavailable)) console.warn("[boot] world index refresh skipped:", (e && e.message) || e);
    else console.warn("[boot] world index refresh failed:", e);
  }
  initWorldCraft({
    store: () => worldStore,
    refreshNames: () => refreshWorldNameCache(),
    onSaved: () => refreshLanding(),
    openEditor: (f, opts) => openWorldEditor(f, opts),
    communityHook: () => communityEditorHook(),
    genImage: () => genImage,
  });
  initScenarioImport({
    store: () => worldStore,
    refreshNames: () => refreshWorldNameCache(),
    onSaved: () => refreshLanding(),
    isBundled: (id) => bundledWorldForId(id),
    openBackupSection: () => openSettingsPanel("backup"),
  });
  await reconcileWorldAuthors(); // bring the worlds WE authored up to date with this identity — never fatal
  memory = new MemorySystem(genText);
  npcLife = new NpcLifeSystem(genText);
  initViewCount(); // fire-and-forget: fills the landing footer's exact view count
  initLastEdit();
  initUpdateCheck(); // polls lastEditTime, shows the reload banner on new publishes
  initLightbox({ getItems: allGalleryImages }); // fullscreen scene-image viewer (see lightbox.js)
  initInfoTips(); // shared tap-friendly ⓘ tooltips (see info-tip.js) — delegated, no per-render wiring
  initSceneImages({
    getState: () => state,
    store,
    render,
    notify,
    isGenerating: () => generating,
    genText,
    genImage,
    getEngine: () => engine,
    currentLocation,
    styleTags: () => imageStyleTags,
    negativeTags: () => imageNegativeTags,
    promptText: () => imagePromptText,
    imageIncludeTrackers: () => imageIncludeTrackers,
    imageIncludeNpcTrackers: () => imageIncludeNpcTrackers,
    imageTrackerKeys: () => imageTrackerKeys,
    imageNpcTrackerKeys: () => imageNpcTrackerKeys,
    setBusy,
    clearBusy,
    clampMemoryCursor,
    refreshGallery: () => { if (isRailOpen("right") && rightSec === "gallery") syncRail("right"); },
    stickOnLoad: () => {
      const sc = document.getElementById("transcriptEl");
      if (!sc) return;
      if (renderFollowTail || sc.scrollTop + sc.clientHeight >= sc.scrollHeight - AUTO_SCROLL_EPS - 4) sc.scrollTop = sc.scrollHeight;
      updateScrollBottomBtn();
    },
    openRailSection,
  }); // scene images (modal, generation, thumbnails, gallery — see scene-images.js)
  // Same-tab admin/mod reload resume — only when a password was remembered (a sign-in during
  // this tab's life). Fire-and-forget: the import + one auth call run beside boot, never block it,
  // and everyone else never pays for the community module here.
  try {
    if (sessionStorage.getItem("mno.adminPw") || sessionStorage.getItem("mno.modPw")) {
      communityModule().then((m) => m.api.resumeAdmin().catch(() => false)).catch(() => {});
    }
  } catch (e) {}

  const [p, ip] = await Promise.all([
    fetch("src/scripts/narrator-prompt.md").then((r) => r.text()).catch(() => "You are the Game Master of a text-based RPG."),
    fetch("src/scripts/image-prompt.md").then((r) => r.text()).catch(() => "")
  ]);
  promptText = p;
  engineImagePrompt = ip;
  defaultWorld = (await loadBundledWorlds()) || emptyWorld();
  applyWorld(defaultWorld);

  const sessions = await store.list();

  renderRailTabs();
  bindEvents();
  applyRailPref();
  // Text and image providers share keys, so a save on either side can flip the
  // other's active fallback — repaint both story-panel rows on both events.
  const paintStoryProviderRows = () => {
    const a = $("sAiModelName");
    if (a) a.textContent = "AI Provider: " + aiModelLabel();
    const g = $("sImgModelName");
    if (g) g.textContent = "Image Gen: " + imageModelLabel();
  };
  window.addEventListener("mno:aimodel-changed", paintStoryProviderRows);
  window.addEventListener("mno:imagegen-changed", paintStoryProviderRows);
  const metaTitle = window.root && window.root.$meta && window.root.$meta.title;
  gameTitle = metaTitle ? metaTitle.evaluateItem : "MNO RPG ENGINE";
  setAppBrand(gameTitle);
  setLandingBrand(gameTitle);
  bindHomeNav();
  bindHnFootActions();

  const activeId = await store.getActive();
  let active = null;
  try { active = activeId ? await store.load(activeId) : null; }
  catch (e) {
    if (isStorageError(e) || (e && e.isStorageUnavailable)) {
      console.warn("[boot] active session unreadable (storage unavailable):", (e && e.message) || e);
      notifyStorageError(notify, "reading", e);
    } else throw e;
  }
  if (active) {
    let wid = null;
    try { wid = await chooseWorldForUnbound(active.worldId, active.worldName); }
    catch (e) {
      if (isStorageError(e) || (e && e.isStorageUnavailable)) {
        console.warn("[boot] world check skipped (storage unavailable):", (e && e.message) || e);
        wid = active.worldId || (defaultWorld && defaultWorld.meta.id);
      } else throw e;
    }
    if (wid) {
      if (wid !== active.worldId) {
        active.worldId = wid;
        try { await store.save(active, { touch: false }); }
        catch (e) {
          if (isStorageError(e) || (e && e.isStorageUnavailable)) notifyStorageError(notify, "saving", e);
          else throw e;
        }
      }
      try { await enterSession(active); }
      catch (e) {
        if (isStorageError(e) || (e && e.isStorageUnavailable)) {
          console.warn("[boot] session resume failed (storage unavailable):", (e && e.message) || e);
          notifyStorageError(notify, "reading", e);
          await renderLanding(sessions);
        } else throw e;
      }
    } else {
      try { await store.setActive(null); } catch (e) {}
      await renderLanding(sessions);
    }
  } else {
    if (activeId) { try { await store.setActive(null); } catch (e) {} }
    await renderLanding(sessions);
  }
}

// Bring the author line of the worlds that are OURS in step with this device's community identity.
// The author became automatic when the world editor stopped asking for it (README §6.9), and it is
// stamped where a world is AUTHORED — create, duplicate, publish. This pass is the reconciliation,
// and it is deliberately narrow: it never touches a world we didn't author, so an imported world
// keeps the author it came with.
//
// Ownership is decided by `meta.authorId` (the stable community id), never by the name, so a rename
// propagates exactly. Two cases need a decision on top of that:
//   * `authorId` matches ours  → refresh the name (a community rename lands here, as does the id
//     stamped on a world we published).
//   * no `authorId` at all     → ADOPT it here, once. A world signed before the id existed gives us
//     only two local signals, and either is enough: the author line matching our current name, or a
//     published listing of its own, because the catalog's world id begins with our `<userId>-`. An
//     uncredited file (an import that arrived with no author) is NOT adopted — nothing about it says
//     we made it, and guessing would take credit for someone else's world.
// Idempotent, and silent when there is nothing to do. Runs at boot before the landing paints so the
// cards never flash a stale author, and again right after a username claim/rename.
async function reconcileWorldAuthors() {
  try {
    await worldStore.ready;
    await worldStore.loadIdentity(); // after a rename the store's copy of the identity is stale
    const name = worldStore.authorName || "";
    const uid = String(worldStore.authorId || "").trim();
    if (!uid) return; // no identity: there is no id to own anything by, so never guess from a name
    const idx = await worldStore.list();
    if (!idx.length) return;
    // Our own published listings are provably ours: the catalog's world id is `<userId>-<slug>`.
    const published = new Set();
    try {
      const links = (await worldStore.kv.community.get("links")) || {};
      for (const [metaId, rec] of Object.entries(links)) {
        const wid = rec && rec.worldId ? String(rec.worldId) : "";
        if (wid.slice(0, uid.length + 1) === uid + "-") published.add(metaId);
      }
    } catch (e) { /* no links written yet — the name match alone is enough */ }
    const fix = [];
    for (const e of idx) {
      const stored = String(e.authorId || "").trim();
      if (stored === uid) { if (String(e.author || "") !== name) fix.push(e.id); }
      else if (!stored && ((name && String(e.author || "") === name) || published.has(e.id))) fix.push(e.id);
    }
    if (!fix.length) return;
    for (const id of fix) {
      try {
        const f = await worldStore.getRaw(id);
        if (!f || !f.meta) continue;
        f.meta.authorId = uid;
        if (name) f.meta.author = name;
        delete f.meta.origin; // a legacy marker from the retired ⭱ Imported facet
        // Written directly (not through save()) so this pass can't recurse, then the index is rebuilt
        // once at the end rather than per world.
        await worldStore.worlds.set(id, f);
      } catch (e) {
        if (isStorageError(e) || (e && e.isStorageUnavailable)) {
          console.warn("[world] authorship fix skipped (storage unavailable):", id);
          return;
        }
        console.warn("[world] authorship fix failed:", id, e);
      }
    }
    await worldStore.refreshIndex();
    console.log(`[world] authorship brought up to date for ${fix.length} world(s) → @${name || uid}`);
    if (homePage) repaintWorldsPage(); // only when the shell is already up (a re-run, not boot)
  } catch (e) {
    // Authorship is cosmetic provenance — a low-space device skips it and still boots/plays.
    if (isStorageError(e) || (e && e.isStorageUnavailable)) console.warn("[world] authorship skipped (storage unavailable):", (e && e.message) || e);
    else console.warn("[world] authorship failed:", e);
  }
}

/* ---------- lazily-imported feature modules ---------- */
// The community layer (Explore / publishing / the added-world library) and the backup utility are
// dynamic imports — NOT boot-path imports — so the landing page and the chat loop never pay for
// them. Nothing here opens a socket or makes a network call before the home shell has painted.
let communityMod = null;
async function communityModule() {
  if (!communityMod) {
    communityMod = await import("./community.js");
    try {
      communityMod.api.onAdminChange(() => {
        ctxAdminAuthed = communityMod.api.isAdmin();
        refreshCtxMeter();
      });
    } catch (e) {}
  }
  return communityMod;
}
const communityEditorHook = () => ({ open: (metaId) => communityModule().then((m) => m.api.openCommunityMenu(metaId)) });
let backupMod = null;
// The backup utility is imported on demand too — since the nav foot's 💾 button went away it is loaded
// by the Settings page (and only by it), so a visitor who never opens Settings never fetches it.
async function backupModule() {
  if (!backupMod) backupMod = await import("./backup.js");
  return backupMod;
}
let discussionMod = null;
let discussionHotWired = false;
// Discussion is a dynamic import too — the comments-plugin backend + chat UI only load when the
// Discussion page is opened, never on the boot path.
async function discussionModule() {
  if (!discussionMod) discussionMod = await import("./discussion.js");
  if (!discussionHotWired) {
    discussionHotWired = true;
    try { discussionMod.onHotUnread(() => refreshTavernPips()); } catch (e) {}
  }
  refreshTavernPips();
  return discussionMod;
}
// Hot-unread pips (replies/@mentions waiting in the Tavern) on the app's own chrome: the
// home-nav Tavern row, the Main Menu Tavern cell and the floating button. The discussion
// module owns the counts (it feeds them headless once any channel has synced); this just
// paints whatever is in the DOM. Before the module's first load there is nothing to show.
function refreshTavernPips() {
  let n = 0;
  try { n = discussionMod ? discussionMod.hotUnreadCount() : 0; } catch (e) { n = 0; }
  const show = n > 0;
  const tip = show ? `${n} unread ${n === 1 ? "reply/mention" : "replies/mentions"} in Tavern` : "";
  const nav = document.querySelector('#homeNav .hn-item[data-page="discussion"] .hn-pip');
  if (nav) { nav.hidden = !show; if (show) nav.title = tip; }
  const cell = document.querySelector('.menu-cell[data-cell="discussion"] .menu-pip');
  if (cell) { cell.hidden = !show; if (show) cell.title = tip; }
  const fab = document.getElementById("tavernFab");
  const pip = fab && fab.querySelector(".fab-pip");
  if (pip) {
    pip.hidden = !show;
    if (!fab) return;
    try { fab.setAttribute("aria-label", show ? `Open tavern — ${tip}` : "Open tavern"); } catch (e) {}
    if (show) pip.title = tip;
  }
}
// Floating Tavern button across landing + sessions: ensured + wired once (the node
// lives on document.body and the wire guard survives, so repeat calls are free), the
// pref inside ensureTavernFab decides visibility, then pips repaint over it.
function mountTavernFab() {
  const fab = ensureTavernFab();
  if (!fab.dataset.wired) { fab.dataset.wired = "1"; fab.addEventListener("click", () => openDiscussionPanel().catch(() => {})); }
  refreshTavernPips();
}
// The world editor is the heaviest non-boot import (its overlay, plus `context-budget.js` and
// `chip-input.js`, which nothing on the boot path uses), and it is needed only when the user opens
// it. So it is a dynamic import too — but it is the likely next action after the landing, so it is
// preloaded once the page goes idle (see scheduleWorldEditorPreload) instead of waiting for the
// first click to start the download.
let worldEditorMod = null;
async function worldEditorModule() {
  if (!worldEditorMod) worldEditorMod = await import("./world-editor.js");
  return worldEditorMod;
}
const openWorldEditor = (fileForm, opts) => worldEditorModule().then((m) => m.openWorldEditor(fileForm, opts));
let editorPreloaded = false;
function scheduleWorldEditorPreload() {
  if (editorPreloaded) return;
  editorPreloaded = true;
  const run = () => worldEditorModule().catch(() => {});
  if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 1200);
}
// Ban-list warmup: one tiny getBans fetch once the page goes idle, so the first
// Tavern open usually gates on a fresh cache instead of fetching behind the
// veil. Same idle pattern as the preloads above; fail-open, fire-and-forget.
let bansWarmed = false;
function scheduleBanWarmup() {
  if (bansWarmed) return;
  bansWarmed = true;
  const run = () => { import("./server-bans.js").then((sb) => sb.loadServerBans().catch(() => {})).catch(() => {}); };
  if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 5000 });
  else setTimeout(run, 2000);
}
// Hero-creation's non-AI "🎲 Randomize" needs `bio-words.js` — a large word-pool table nothing else
// touches — so it rides along with the first press of that button rather than with boot.
let bioWordsMod = null;
async function bioWordsModule() {
  if (!bioWordsMod) bioWordsMod = await import("./bio-words.js");
  return bioWordsMod;
}
// Tavern pips without opening the Tavern: when the notification bell is on, pre-warm the
// chat backends past first paint (same idle pattern as the deferred community work), so
// reply/@mention arrivals feed the pip counts while the user reads other pages. Bell off
// means no backends and no pips — nothing syncing, nothing to show.
let discussionPrewarmed = false;
function scheduleDiscussionPrewarm() {
  if (discussionPrewarmed) return;
  discussionPrewarmed = true;
  let bellOld = null, bellR = null, bellA = null;
  try { bellOld = localStorage.getItem("mno.disc.notify"); bellR = localStorage.getItem("mno.disc.notifyReply"); bellA = localStorage.getItem("mno.disc.notifyAll"); } catch (e) {}
  let bellW = null;
  try { bellW = localStorage.getItem("mno.disc.notifyWd"); } catch (e2) {}
  // Either sub-toggle (or the legacy single bell, when neither was ever set) warms —
  // and the World-comments toggle warms the watch rotation on its own.
  if (bellR !== "1" && bellA !== "1" && bellW !== "1" && !((bellR === null || bellA === null) && bellOld === "1")) return; // mirror of discussion.js loadNotifyPrefs
  const run = () => { discussionModule().then((m) => { try { m.prewarmDiscussionBackends(); } catch (e) {} }).catch(() => {}); };
  if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 1500);
}
// Deferred community work: read the added-world library (so the Worlds page can show the "Added"
// facet and the nav can badge its count) and run the throttled once-per-visit library update check.
// Both are deferred past first paint — the home shell boots with no community import and no socket.
let communityDeferred = false;
function scheduleCommunityDeferredWork() {
  const run = async () => {
    try {
      homeCommunity = await communityModule();
      await refreshAddedWorlds();
      // The throttled once-per-visit staleness check only runs when there is a library to check — an empty library would only pay for a socket for nothing.
      if (homeAdded.items.length) homeCommunity.api.maybeAutoUpdateCheck();
    } catch (e) { console.warn("[community] deferred work failed", e); }
  };
  if (communityDeferred) { run(); return; } // already imported — a re-render is cheap
  communityDeferred = true;
  if (window.requestIdleCallback) requestIdleCallback(() => run(), { timeout: 2500 });
  else setTimeout(run, 400);
}

/* ---------- world binding ---------- */
// Load one world's content into the engine + all the module globals that consume it (tracker/
// stat defs, config, story strings, image tags). Rebuilds the engine/npc/map systems so every
// AI subsystem sees the new world's lore/scenario/art style. Used at boot for the default world
// and whenever a session (or a new-adventure world pick) binds a different one.
function applyWorld(world) {
  currentWorldId = world.meta.id;
  currentWorldName = world.meta.name || "";
  vibeText = world.narrativeVibe.trim();
  scenarioText = world.scenario;
  startText = world.start;
  imagePromptText = engineImagePrompt; // scene images always follow the engine's image-prompt.md
  imageStyleTags = world.imageStyleTags.trim();
  imageNegativeTags = world.imageNegativeTags.trim();
  imageIncludeTrackers = world.imageIncludeTrackers === true;
  imageIncludeNpcTrackers = world.imageIncludeNpcTrackers === true;
  imageTrackerKeys = Array.isArray(world.imageTrackerKeys) ? world.imageTrackerKeys.filter((k) => typeof k === "string") : [];
  imageNpcTrackerKeys = Array.isArray(world.imageNpcTrackerKeys) ? world.imageNpcTrackerKeys.filter((k) => typeof k === "string") : [];
  trackerDefs = world.trackerDefs;
  npcTrackerDefs = world.npcTrackerDefs || [];
  statDefs = world.statDefs;
  statCfg = world.statsCfg;
  statPointsPerLevel = world.statsCfg.pointsPerLevel;
  ccBudget = world.statsCfg.ccBudget;
  ccFloor = world.statsCfg.ccFloor;
  ccCeiling = world.statsCfg.ccCeiling;
  statAvgT = world.statsCfg.averageThreshold;
  statExcT = world.statsCfg.exceptionalThreshold;
  npcSys = new NpcSystem(genText, genImage, { loreEntries: world.lorebook, scenarioText: world.scenario, startText: world.start, styleTags: world.imageStyleTags, negativeTags: world.imageNegativeTags, worldNpcs: world.npcs || [], npcTrackerDefs: world.npcTrackerDefs || [] });
  engine = new RPEngine({ genText, promptText, loreEntries: world.lorebook, scenarioText: world.scenario, startText: world.start, vibeText: world.narrativeVibe, trackerDefs: world.trackerDefs, npcTrackerDefs: world.npcTrackerDefs || [], statDefs: world.statDefs, worldNpcs: world.npcs || [], checkIncludeTrackers: world.statsCfg.checkIncludeTrackers, checkIncludeNpcTrackers: world.statsCfg.checkIncludeNpcTrackers, checkTrackerKeys: world.statsCfg.checkTrackerKeys, checkNpcTrackerKeys: world.statsCfg.checkNpcTrackerKeys, useCheckInstruction: world.statsCfg.useCheckInstruction, checkInstruction: world.statsCfg.checkInstruction });
  mapSys = new MapSystem(genText, { lore: loreDigestFor(world, MAP_LORE_TYPES, 1500), loreEntries: world.lorebook });
}

// Load every bundled world under src/game/worlds/ (listed in manifest.json — a static site can't
// enumerate a directory at runtime). Each entry is `{ file, default? }`; `default` flags the
// universal fallback world (otherwise the first entry wins). Returns the canonical default World,
// or null when none loaded (the caller falls back to emptyWorld()).
async function loadBundledWorlds() {
  bundledWorlds = [];
  let manifest = [];
  try {
    manifest = JSON.parse(await fetch("src/game/worlds/manifest.json").then((r) => r.text()));
  } catch (e) {
    console.warn("[world] Bundled world manifest missing/invalid:", e);
  }
  if (!Array.isArray(manifest)) manifest = [];
  let defaultIdx = -1;
  for (const entry of manifest) {
    const file = typeof entry === "string" ? entry : entry && entry.file;
    if (!file) continue;
    try {
      const text = await fetch("src/game/worlds/" + file).then((r) => r.text());
      const { world, warnings, errors } = loadWorld(text);
      if (!world) { console.warn(`[world] Bundled world "${file}" failed to load:`, errors); continue; }
      if (warnings.length) console.warn(`[world] Bundled world "${file}" warnings:`, warnings);
      if (typeof entry === "object" && entry.default && defaultIdx < 0) defaultIdx = bundledWorlds.length;
      bundledWorlds.push(world);
    } catch (e) {
      console.warn(`[world] Bundled world "${file}" fetch failed:`, e);
    }
  }
  return bundledWorlds[defaultIdx >= 0 ? defaultIdx : 0] || null;
}

// One of the bundled worlds by id (null if it isn't bundled).
function bundledWorldForId(id) {
  return bundledWorlds.find((w) => w.meta.id === id) || null;
}

// ---- community (added) worlds --------------------------------------------------------------
// A world added from the community catalog is a read-only cached copy in the community module's
// kv folder — deliberately NOT a WorldStore world (no editable local file, and no local meta.id
// to collide). A session bound to one carries the id prefixed "lib:" so it can never be mistaken
// for a local world id, and resolution below goes straight to that cached copy. See community.js.
const LIB_WORLD_PREFIX = "lib:";
// The prefixed id a session uses to point at a cached catalog world.
const libId = (worldId) => LIB_WORLD_PREFIX + worldId;

async function communityKv(key) {
  try { return await window.kv.community.get(key); } catch (e) { return null; }
}
// Resolve "lib:<worldId>" to a canonical World built from the saved copy (null when there's no
// usable cache, in which case the caller falls back like any other missing world).
async function loadLibraryWorld(id) {
  const worldId = id.slice(LIB_WORLD_PREFIX.length);
  // One sharded key, never the whole cache — and it never throws (unreadable reads as missing).
  const entry = await getCacheEntry(window.kv.community, worldId);
  if (!entry || !entry.text) return null;
  const { world, errors } = loadWorld(entry.text);
  if (!world) { console.warn("[community] saved copy failed to load:", errors); return null; }
  world.meta.id = id; // keep the binding id stable for this session
  return world;
}

// Fetch a full canonical World by id: a bundled world, else the kv library, else (missing/
// invalid) the default + a toast. Never returns null.
async function loadWorldById(id) {
  const wid = id || defaultWorld.meta.id;
  const b = bundledWorldForId(wid);
  if (b) return b;
  if (wid.startsWith(LIB_WORLD_PREFIX)) {
    const lw = await loadLibraryWorld(wid);
    if (lw) return lw;
    notify("🌐 That added world's saved copy is missing — using the default world.", { ms: 4200 });
    return defaultWorld;
  }
  const w = await worldStore.get(wid);
  if (w) return w;
  console.warn(`[world] Session world "${wid}" not found in library — using default.`);
  notify("🌍 That world isn't in your library any more — using the default world.", { ms: 4200 });
  return defaultWorld;
}

// Make sure `id`'s world content is the one currently loaded — re-loads from the library on every
// call so edits made in the world editor show up the next time a session in that world is entered
// (the store is the source of truth; nothing is cached in memory).
async function ensureWorldBound(id) {
  const wid = id || defaultWorld.meta.id;
  const world = await loadWorldById(wid);
  applyWorld(world);
}

// Display name of a world id, from a bundled world or the library cache ("" if unknown).
function worldNameForId(id) {
  const wid = id || defaultWorld.meta.id;
  const b = bundledWorldForId(wid);
  if (b) return b.meta.name;
  return worldNameCache[wid] || "";
}

// True when `id`'s world is installed (a bundled world or a library world).
// A storage failure reads as "not installed" only for user worlds — bundled worlds still match,
// so a low-space device can always play its built-ins.
async function worldIsInstalled(id) {
  const wid = id || defaultWorld.meta.id;
  if (bundledWorldForId(wid)) return true;
  if (wid.startsWith(LIB_WORLD_PREFIX)) {
    const lib = (await communityKv("library")) || {};
    return !!lib[wid.slice(LIB_WORLD_PREFIX.length)];
  }
  try {
    const idx = await worldStore.list();
    return idx.some((e) => e.id === wid);
  } catch (e) {
    console.warn("[world] install check skipped (storage unavailable):", (e && e.message) || e);
    return false;
  }
}

// When a session's bound world isn't installed, first look for it in the public worlds — a
// deleted local world may be a published one (re-adding it keeps the adventure in the world
// it was built for), or an added world may simply not be on this device yet. Only when
// nothing public matches (or the search can't run) does the player pick a different world
// from their library — rebinding an adventure that way may break the game, since its hero,
// stats, trackers and story were built for the original. Returns the chosen world id, or
// null if the player cancelled. Returns `wid` unchanged when it's already installed.
async function chooseWorldForUnbound(wid, nameHint = "") {
  const cur = wid || defaultWorld.meta.id;
  if (await worldIsInstalled(cur)) return cur;
  const wname = nameHint || worldNameForId(cur);
  // The public-world search runs before anything else. A transport failure (offline, server
  // hiccup) is NOT an error here — it just falls back to the local-only flow below.
  let found = null;
  let searched = false;
  try {
    const m = await communityModule();
    if (m && m.findPublicWorldMatches) {
      found = await m.findPublicWorldMatches({
        catalogId: cur.startsWith(LIB_WORLD_PREFIX) ? cur.slice(LIB_WORLD_PREFIX.length) : "",
        title: wname,
      });
      searched = true;
    }
  } catch (e) { found = null; }
  if (found && (found.exact || found.matches.length)) {
    const picked = await showPublicWorldMatches(wname, found);
    if (picked && picked !== "library") return picked; // freshly added (or already installed) public world
    if (!picked) return null; // cancelled — stay where we were
    // "library" falls through to the different-world picker below.
  }
  const ok = await ConfirmPopup.open({
    title: "World not installed",
    message: wname
      ? `This adventure belongs to the world "${wname}", which isn't in your library.${searched ? " It wasn't found in public worlds either." : ""} Choose a world to continue in.`
      : "The world this adventure belongs to isn't in your library any more. Choose a world to continue in.",
    warning: "Binding an existing adventure to a different world may break the game — its hero, stats, trackers and story were built for the original world and may not line up.",
    confirmText: "Choose world"
  });
  if (!ok) return null;
  const chosen = await showWorldPicker();
  return chosen ? chosen.meta.id : null;
}

// Offer the public-world matches for an unbound adventure: one row per candidate with an
// Add & play button (or Play in this world when the candidate is already installed — e.g.
// the public copy of a deleted local world sitting in the library under another id).
// Resolves to the world id to bind, "library" to fall through to the local picker, or null
// on cancel. A failed add keeps the popup open so another match (or the picker) can be tried.
async function showPublicWorldMatches(wname, found) {
  const m = await communityModule();
  const cands = found.exact ? [found.exact] : found.matches;
  // Which candidates are already playable without downloading: your own world reclaimed
  // locally (binds its meta id), or anyone else's added + cached (binds lib:<id>).
  const me = (m.api && m.api.myUserId && m.api.myUserId()) || "";
  const lib = await communityKv("library");
  const rows = [];
  for (const rec of cands) {
    let installedAs = "";
    if (me && rec.userId && rec.userId === me) {
      const links = await communityKv("links");
      const mid = Object.keys(links || {}).find((k) => links[k] && links[k].worldId === rec.worldId) || "";
      if (mid) {
        try { if (await worldStore.getRaw(mid)) installedAs = mid; } catch (e) {}
      }
    } else {
      const entry = (lib || {})[rec.worldId];
      if (entry) {
        try { if (await m.api.getCachedWorld(rec.worldId)) installedAs = LIB_WORLD_PREFIX + rec.worldId; } catch (e) {}
      }
    }
    rows.push({ rec, installedAs });
  }
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "cc-overlay";
    const head = found.exact
      ? `This adventure belongs to "${wname || found.exact.title}", which isn't in your library — but it's still published. Add it back to play on:`
      : `This adventure belongs to "${wname}", which isn't in your library. ${cands.length === 1 ? "This public world looks like it:" : "These public worlds look like it:"}`;
    overlay.innerHTML = `
      <div class="cc-panel wp-panel" tabindex="-1">
        <div class="cc-head">
          <span class="cc-title">🌐 World found</span>
          <button class="popup-x wp-cancel" title="Close">✕</button>
        </div>
        <div class="cc-body">
          <p class="cc-hint">${esc(head)}</p>
          <div class="wp-list"></div>
        </div>
        <div class="cc-foot">
          <span class="cc-err"></span>
          <button class="mini wp-lib">Choose another world…</button>
          <button class="mini wp-cancel">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const release = pushBackClose(() => done(null));
    let closed = false;
    const done = (v) => { if (closed) return; closed = true; release(); overlay.remove(); resolve(v); };
    const list = overlay.querySelector(".wp-list");
    for (const { rec, installedAs } of rows) {
      const card = document.createElement("div");
      card.className = "wp-card";
      const fmtN = (n) => { n = Number(n) || 0; if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k"; return String(n); };
      const stats = [`v${rec.version || 1}`, `${ICON_DOWNLOAD} ${fmtN(rec.downloads)}`, `${ICON_HEART} ${fmtN(rec.likes)}`].join(" · ");
      card.innerHTML = `
        ${rec.coverUrl ? `<img class="wp-thumb" src="${esc(rec.coverUrl)}" alt="" loading="lazy">` : `<div class="wp-thumb wp-thumb-ph">${esc(String((rec.title || "?").charAt(0).toUpperCase()))}</div>`}
        <div class="wp-main">
          <div class="ld-whead"><span class="ld-wname">${esc(rec.title || "Untitled world")}</span>${rec.nsfw ? `<span class="ld-wbadge">nsfw</span>` : ""}</div>
          <div class="wd-author">${rec.authorName ? `by @${esc(rec.authorName)} · ` : ""}${stats}</div>
          ${rec.description ? `<div class="ld-wdesc">${esc(String(rec.description).slice(0, 220))}</div>` : ""}
        </div>
        <button class="mini ok wp-pick">${installedAs ? "Play in this world" : "Add & play"}</button>`;
      const btn = card.querySelector(".wp-pick");
      btn.onclick = async () => {
        if (installedAs) { done(installedAs); return; }
        btn.disabled = true;
        btn.innerHTML = '<span class="spin spin-sm"></span> Adding…';
        try {
          const bindId = await m.addPublicWorldAndBindId(rec);
          if (bindId) { done(bindId); return; }
          btn.disabled = false;
          btn.textContent = "Add & play";
        } catch (e) {
          btn.disabled = false;
          btn.textContent = "Add & play";
        }
      };
      list.appendChild(card);
    }
    overlay.querySelector(".wp-lib").onclick = () => done("library");
    overlay.querySelectorAll(".wp-cancel").forEach((b) => (b.onclick = () => done(null)));
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) done(null); });
    overlay.addEventListener("keydown", (e) => { if (e.key === "Escape") done(null); });
  });
}

// Rebuild the worldId -> name cache from the library index (called wherever sessions render).
// Storage failures keep the old cache (bundled names still resolve) instead of throwing.
async function refreshWorldNameCache() {
  try {
    const idx = await worldStore.list();
    worldNameCache = {};
    for (const e of idx) worldNameCache[e.id] = e.name;
  } catch (e) {
    console.warn("[home] world name cache skipped (storage unavailable):", (e && e.message) || e);
  }
  // Added (community) worlds live outside the world store; their names come from the catalog
  // snapshot in the community library, so sessions bound to one can still be labelled.
  try {
    const lib = (await communityKv("library")) || {};
    for (const rec of Object.values(lib)) if (rec && rec.worldId) worldNameCache[libId(rec.worldId)] = rec.title || "";
  } catch (e) { /* library names are a nicety */ }
}

/* ---------- home shell: nav + page routing ---------- */
// The home screen (the old "landing") is a left nav rail (`#homeNav`) plus a scrolling content pane
// (`#homeMain`). Each nav entry mounts one page into the pane; switching pages releases the previous
// page's DOM. Everything is config-driven — a new page is one HOME_SECTIONS entry plus a mount
// function. Only the nav's collapsed state persists (`mno.homeNav`); the active page is always
// Worlds on open, but it is mirrored into the URL hash so a deep link (#explore) opens that page and
// Back from a chat returns to the page you left from.
// `zone` splits the nav into the two-zone layout: the primary pages, then an account/util
// cluster pinned to the bottom (Tavern sits at its top, set off from Settings by its own
// divider — the chat stays one tap away). (No row is a `future` placeholder.)
//
// A section with `opens` is NOT a page: clicking it runs something (Settings is a popup panel — §6.16)
// and it never becomes `homePage`, so it never takes the active treatment or a nav count.
// Primary pages carry a monochrome PNG (`iconImg`, white on transparent) instead of an emoji. The
// image is drawn as a `currentColor`-tinted CSS mask (see `.sec-ic` in styles.css) so it follows the
// item's muted / active-accent colour. The nav foot's Changelog item uses the same treatment.
// `iconImg` is STYLESHEET-relative (`images/...`, not `src/images/...`): the path rides through a CSS
// custom property into a declaration in styles.css, so it resolves against that file's directory.
// Pages without an `iconImg` keep their emoji.
const HOME_SECTIONS = [
  { id: "worlds", label: "Worlds", iconImg: "images/icon-worlds.png", zone: "primary", accent: "--accent", rgb: "139,154,110",
    title: "Worlds", sub: "Your local worlds library — ready to play." },
  { id: "adventures", label: "Adventures", iconImg: "images/icon-adventures.png", zone: "primary", accent: "--accent-gold", rgb: "194,162,90",
    title: "Adventures", sub: "Your saved journeys — pick up where you left off." },
  { id: "explore", label: "Explore", iconImg: "images/icon-explore.png", zone: "primary", accent: "--accent-arcane", rgb: "176,115,91",
    title: "Explore Worlds", sub: "Community worlds — published by players." },
  { id: "discussion", label: "Tavern", iconImg: "images/icon-board.png", zone: "util", accent: "--accent-arcane", rgb: "176,115,91",
    title: "Tavern", sub: "Community chat — talk worlds, lore and help.",
    opens: () => openDiscussionPanel() },
  { id: "user", label: "User", icon: "👤", zone: "primary", accent: "--accent-arcane", rgb: "176,115,91",
    title: "User profile", sub: "A player's profile and published worlds.", hidden: true },
  { id: "settings", label: "Settings", iconImg: "images/icon-settings.png", zone: "util", accent: "--accent", rgb: "139,154,110",
    opens: () => openSettingsPanel() }
];
// Only the sections that are PAGES take part in routing (URL hash → page).
const HOME_PAGE_IDS = HOME_SECTIONS.filter((s) => !s.opens).map((s) => s.id);
function homeSec(id) { return HOME_SECTIONS.find((s) => s.id === id) || HOME_SECTIONS[0]; }

// Rows in the util zone that run something instead of switching page — they sit below the section
// items and look the same. Changelog lives here: a release-notes popup is somewhere you *go*, the same
// as a page, and the foot is the app's own
// colophon (the credit and the last-edit/views line). It is rendered by `renderHomeNav` rather than
// living in index.html because that list is rebuilt from scratch on every render.
const HN_ACTIONS = [
  { id: "ldChangelogBtn", label: "Changelog", iconImg: "images/icon-changelog.png", run: openChangelog }
];

// page id -> mount(pane, ctx) -> optional unmount(). The mounts are function declarations below, so
// this map can reference them before their definitions (hoisting).
const HOME_MOUNTS = {
  worlds: mountWorldsPage,
  adventures: mountAdventuresPage,
  explore: mountExplorePage,
  user: mountUserPage
};

let homePage = null;             // the page id currently mounted in #homeMain
let homeUnmount = null;          // teardown for the mounted page (releases its scroll listener)
let homeSessions = [];           // the session index (nav counts + the Adventures page)
let homeUserWorlds = [];         // the kv world-store index (Worlds cards)
let homeLinks = {};              // the community link records (published worlds), keyed by meta.id
let homeWorldsRerender = null;   // the mounted Worlds page's re-render hook (used by deferred loads)
let homeCommunity = null;        // the community module, once lazily imported
let homeInstalledIds = new Set(); // every installed world id (sync unbound-world checks)

// Community-added ("library") worlds, read straight from the community kv folder so the Worlds page
// and the nav count never need the community module. Their cards still come from community.js (they
// carry the read-only card menu + refresh actions).
const homeAdded = { loaded: false, items: [] };


// Transient per-visit page state (search/facets/sort/scroll). Never persisted: leaving a page and
// coming back within the same visit restores it; a reload starts clean.
// Explore's scroll also carries `at` (stamped when leaving the page): older than
// EXPLORE_SCROLL_TTL_MS it resets to 0, matching community.js's grid-cache TTL — a fresh
// grid must start at the top, not at a stale offset into different content.
const EXPLORE_SCROLL_TTL_MS = 15 * 60 * 1000;
const homeUI = {
  worlds: { q: "", sources: [], sourcesNot: [], tags: [], tagsNot: [], author: null, sort: "recent", scroll: 0 },
  adventures: { q: "", sort: "recent", worlds: [], worldsNot: [], group: false, scroll: 0 },
  explore: { scroll: 0, at: 0 },
  user: { scroll: 0 }
};
let homeUserTarget = "";
let homeUserFallback = "";
let homeUserRerender = null;
let userBackRelease = null;
let userBackFrom = "worlds";
// A session id to re-enter when the profile's Back entry pops: profiles opened from the chat's
// Menu are a peek at the author, so Back returns to that chat instead of the landing. Set only
// on the chat → profile path; cleared by any deliberate landing navigation or session entry.
let userBackSession = null;
// A session id to re-enter when a Menu-grid landing's entry pops: grid exits keep the session
// entry standing behind the landing (rewritten to the new page's URL), so Back returns to that
// chat instead of the entry before it. Set only on the chat → grid path; cleared by returning
// (Back), by opening another session from that landing, or by leaving via goToLanding. In-landing
// navigation (setHomePage) deliberately preserves it, so Worlds → Explore → Back walks the landing
// history first and the final Back still resumes the chat.
let menuReturnSession = null;
let homeMountSeq = 0;

// Landing history lives in nav-history.js (the common navigation module): UI page switches push
// an entry so Back walks Worlds ↔ Adventures ↔ Explore, tracked while a Menu-grid bridge is
// pending, plain otherwise — then setHomePage's syncHomeHash rewrites it to the new page
// (push-then-replace, since only replaceState reaches the host bar). `bridged` is true while
// the session entry is still standing behind the landing (menuReturnSession + sessionBackRelease).
function pushLandingHistory() {
  pushLandingEntry(!!(menuReturnSession && sessionBackRelease));
}


// Build the nav list from HOME_SECTIONS. The active item takes its page's accent, matching the page
// header band — that colour pairing is the strongest "where am I" cue. Two-zone layout: the
// primary pages in #homeNavList, then the account/util cluster in #homeNavUtil.

// The inline "world" mark — the same `icon-worlds.png` mask as the Worlds nav item and page emblem,
// sized and aligned to sit inside a run of text (`.w-ic` in styles.css), used wherever a world's name
// is shown in a list: session rows (both the Adventures page and the in-session sessions panel),
// adventure group headers and the Adventures page's world filter chips. It replaces the 🌍 emoji,
// which is a different picture on every OS and can't take the surrounding text's colour.
const WORLD_IC = '<span class="w-ic" aria-hidden="true"></span>';

// The same mark again, but sized for the Worlds page's empty state (`.hm-empty-mark`), where there is
// no run of text to scale against. Like `WORLD_IC` it is a mask, so it takes the block's muted colour.
const EMPTY_WORLD_MARK = '<span class="hm-empty-mark" aria-hidden="true"></span>';

// Explore's mark for a run of text (`.ex-ic`, `icon-explore.png` — the picture the Explore rail item and
// page header wear): the same inline block as `WORLD_IC`, for the places on the WORLDS page that are
// talking about Explore — a world you added from it. The source facet's `Public` and every card note
// that says `Public` wear this instead of the 🌐 emoji, which is a full-width colour glyph from the
// reader's OS that can't take the surrounding text's colour (the Explore page's empty state uses the
// larger `hm-empty-mark-ex` of the same PNG).
const EXPLORE_IC = '<span class="ex-ic" aria-hidden="true"></span>';

// The world detail popup's fullscreen toggle (bottom-right of the cover) — drawn rather than typed,
// because the ⛶/⤢ glyphs are a different picture on every OS and can't take the button's colour. The
// four corner arrows point out to expand, in to compress; both are stroked in `currentColor`.
const WD_FS_EXPAND_IC = ICON_FS_EXPAND;
const WD_FS_COMPRESS_IC = ICON_FS_COMPRESS;

// ...and the Adventures page's own: the same `.hm-empty-mark` mask pointed at that page's emblem,
// `icon-adventures.png` — the very same picture the rail item and the page header wear (through
// `secIconInner`), so "nothing here" wears the page's own picture rather than Worlds' — the way
// Explore's does (community.js's EXPLORE_MARK). All three pages' empty states are then one block, one
// mark and one line of text, differing only in which emblem the mark is cut from.
const EMPTY_ADV_MARK = '<span class="hm-empty-mark hm-empty-mark-adv" aria-hidden="true"></span>';

function hnItemEl(sec) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "hn-item";
  b.dataset.page = sec.id;
  b.style.setProperty("--hn-accent", `var(${sec.accent})`);
  b.style.setProperty("--hn-accent-rgb", sec.rgb);
  // Tooltip name, read by `applyRailTips` — only surfaced while the rail shows no labels.
  b.dataset.tip = sec.label;
  b.innerHTML = `<span class="hn-ic">${secIconInner(sec)}</span><span class="hn-lbl">${esc(sec.label)}</span><span class="hn-count" hidden></span><span class="hn-pip" hidden></span>`;
  b.onclick = () => {
    closeHomeNav();
    if (sec.opens) { sec.opens(); return; }
    // The Explore row always lands on the plain grid: closing a leftover world-detail panel first,
    // since a same-page click early-returns in `setHomePage` and would otherwise leave it open.
    if (sec.id === "explore" && homeCommunity && homeCommunity.api.closeWorldDetail) {
      try { homeCommunity.api.closeWorldDetail(); } catch (e) {}
    }
    // UI page switch: push history so Back walks Worlds ↔ Adventures ↔ Explore.
    setHomePage(sec.id, { push: true });
  };
  return b;
}

// An action row: the same shape as a section item, minus the page (no `data-page`, so `paintHomeNav`
// never marks it active and `updateHomeNavCounts` has no count to fill).
function hnActionEl(act) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "hn-item";
  b.id = act.id;
  b.dataset.tip = act.label;
  b.setAttribute("aria-label", act.label);
  b.innerHTML = `<span class="hn-ic">${secIconInner(act)}</span><span class="hn-lbl">${esc(act.label)}</span>`;
  b.onclick = () => { closeHomeNav(); act.run(); };
  return b;
}

function renderHomeNav() {
  const primary = $("homeNavList");
  const util = $("homeNavUtil");
  primary.innerHTML = "";
  if (util) util.innerHTML = "";
  for (const sec of HOME_SECTIONS) {
    if (sec.hidden) continue;
    if (sec.zone === "util") {
      if (!util) continue;
      util.appendChild(hnItemEl(sec));
      // Divider between the Tavern row and the rest of the util cluster — its
      // own element, so every nav button keeps the same `.hn-item` shape.
      if (sec.id === "discussion") {
        const sep = document.createElement("div");
        sep.className = "hn-sep";
        sep.setAttribute("aria-hidden", "true");
        util.appendChild(sep);
      }
    }
    else primary.appendChild(hnItemEl(sec));
  }
  // The util zone's actions come after its sections, so Changelog sits under Settings.
  if (util) for (const act of HN_ACTIONS) util.appendChild(hnActionEl(act));
  paintHomeNav();
  updateHomeNavCounts();
  applyRailTips();
  refreshTavernPips();
}

function paintHomeNav() {
  const nav = $("homeNav");
  if (!nav) return;
  const sec = homeSec(homePage || "worlds");
  nav.style.setProperty("--hn-active", `var(${sec.accent})`);
  nav.style.setProperty("--hn-active-rgb", sec.rgb);
  nav.querySelectorAll(".hn-item").forEach((b) => {
    const on = b.dataset.page === homePage;
    b.classList.toggle("active", on);
    if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
}

function updateHomeNavCounts() {
  const counts = { worlds: homeWorldCount(), adventures: homeSessions.length, explore: null, settings: null };
  const items = document.querySelectorAll("#homeNav .hn-item");
  items.forEach((b) => {
    const c = b.querySelector(".hn-count");
    if (!c) return;
    const n = counts[b.dataset.page];
    if (typeof n === "number" && n > 0) { c.hidden = false; c.textContent = n > 999 ? "999+" : String(n); }
    else c.hidden = true;
  });
}

function homeWorldCount() {
  let n = bundledWorlds.length;
  for (const e of homeUserWorlds) if (!bundledWorldForId(e.id)) n++;
  return n + homeAdded.items.length;
}

// Every installed world id, kept in a Set so an Adventures row can flag an unbound world without an
// async lookup per row. Rebuilt whenever a page mounts or the world set changes.
function rebuildInstalledIds() {
  const s = new Set();
  for (const w of bundledWorlds) s.add(w.meta.id);
  for (const e of homeUserWorlds) s.add(e.id);
  for (const it of homeAdded.items) s.add(libId(it.rec.worldId));
  homeInstalledIds = s;
}

// Read the catalog link records (published / unpublished worlds) straight from the community kv
// folder, like the added-world library above: the Worlds page's footer says `· Published` /
// `· Hidden` from these, and it must never need the community module (or a socket) to draw a card.
async function loadHomeLinks() {
  homeLinks = (await communityKv("links")) || {};
}

// Read the community library (added worlds) + its cached world files + the link records. Pure kv
// reads — no community module import, so it is cheap enough to run at boot.
async function loadAddedWorlds(force = false) {
  if (homeAdded.loaded && !force) return;
  await loadHomeLinks();
  try {
    const lib = (await communityKv("library")) || {};
    const recs = Object.values(lib).filter((r) => r && r.worldId);
    recs.sort((a, b) => (b.lastPlayedAt || b.addedAt || 0) - (a.lastPlayedAt || a.addedAt || 0));
    // Only the worlds actually in the library are read, one small key each (never the whole
    // cache). Unreadable entries read as missing, so one bad file can't break the whole list.
    const cacheMap = await readCacheEntries(window.kv.community, recs.map((r) => r.worldId));
    homeAdded.items = recs.map((rec) => ({ rec, entry: cacheMap[rec.worldId] || null }));
    homeAdded.loaded = true;
  } catch (e) { console.warn("[home] added-worlds read failed", e); }
}

// Re-read the added-world library and repaint whoever shows it (the nav count + the Worlds page's
// `Public` source facet). Called by community.js whenever the library changes, and by the deferred pass.
async function refreshAddedWorlds() {
  await loadAddedWorlds(true);
  rebuildInstalledIds();
  updateHomeNavCounts();
  if (homePage === "worlds" && homeWorldsRerender) homeWorldsRerender();
}

// Re-read the world index + the catalog link records and repaint the Worlds page — the cheap
// repaint community.js asks for after any publish / re-publish / unpublish / appeal, or after a
// local listing edit changed a card's title, author or cover. Unlike refreshLanding() it does not
// teardown the mounted page (or any other page); it only refreshes what the cards are drawn from.
// Storage failures keep the old cards instead of throwing.
async function repaintWorldsPage() {
  try { await loadHomeLinks(); } catch (e) {}
  try { homeUserWorlds = await worldStore.list(); }
  catch (e) {
    console.warn("[home] worlds repaint skipped (storage unavailable):", (e && e.message) || e);
    return;
  }
  try { await refreshWorldNameCache(); } catch (e) {}
  updateHomeNavCounts();
  if (homePage === "worlds" && homeWorldsRerender) homeWorldsRerender();
}

// ---- routing --------------------------------------------------------------------------------
// Route parsing + hash mirroring live in nav-history.js (the common navigation module) — thin
// wrappers here only bind the page list. See nav-history.js for the platform-bridge contract
// (replaceState-only mirroring, same-URL posts, stale-echo log).
function homeRouteFromHash(hash = location.hash) {
  return parseHomeRoute(hash, HOME_PAGE_IDS);
}
function homePageFromHash() { return homeRouteFromHash().page; }

// Run a hash route's deep link: make sure its page is mounted (Explore's module state backs the
// panel) and open the world the target names. Fire-and-forget, so the shell paints immediately.
//
// The live `#explore/<worldId>` in the address bar is owned by the PANEL while it is open — it sets
// the id on open and drops it on close (see community.js's `openWorldDetail`), which is what makes the
// bar the world's own share link. This route only seeds the id on the way in, so the URL already reads
// right during the async catalog lookup; a target the catalog can't resolve is cleared again, so a
// dead link doesn't re-fire on every reload (a transport failure keeps it — a retry should still reach
// the world once the catalog is back).
async function applyHomeRoute(route) {
  if (!route || !route.target) return;
  if (route.page === "user") {
    homeUserTarget = route.target;
    homeUserFallback = "";
    if (homePage !== "user") await setHomePage("user");
    else if (homeUserRerender) await homeUserRerender(homeUserTarget, "");
    return;
  }
  if (route.page !== "explore") return;
  if (homePage !== "explore") await setHomePage("explore");
  syncHomeHash("explore", route.target); // reflect the link (replaceState: no extra history entry)
  let m;
  try { m = await communityModule(); } catch (e) { return; }
  let res = "offline";
  try { res = await m.api.openLinkedWorld(route.target); }
  catch (e) { console.warn("[home] deep link failed", e); }
  if (res !== "ok" && res !== "offline") syncHomeHash("explore");
}

window.addEventListener("hashchange", async () => {
  if (!homePage) return;
  if ($("landing") && $("landing").hidden) return;
  // A stale platform echo (our own superseded write forwarded back, with no traversal behind it)
  // must not drive the route — it would reopen a panel we just closed. Repair the bar instead.
  if (!hashChangeTraversed() && isStaleHomeHashEcho(location.hash)) { reassertHomeHash(); return; }
  // Author-peek bridge return (chat → profile): popstate's userBackClose owns the re-entry —
  // mounting the landing URL here as well would double-mount (see nav-history.js). Let popstate
  // own it.
  if (hashChangeTraversed() && userBackSession) {
    try { if (shouldDeferToUserBridge({ userPending: true, historyState: history.state })) return; } catch (e) {}
  }
  // Menu-grid bridge return: popstate's sessionBackClose owns the re-entry (see nav-history.js).
  // Intermediate landing walks while the bridge is pending land on session/tracked states, never
  // plain, so plain + flag + traversal unambiguously means "returning". Let popstate own it.
  if (hashChangeTraversed() && menuReturnSession) {
    try { if (shouldDeferToMenuBridge({ menuPending: true, historyState: history.state })) return; } catch (e) {}
  }
  const route = homeRouteFromHash();
  if (!route.page) {
    // Legacy `#discussion` links (and toast fallbacks) open the panel — Discussion
    // used to be a page; now it floats over whatever is showing.
    if (/^#discussion\b/.test(location.hash)) { openDiscussionPanel().catch(() => {}); return; }
    // A bridge return in progress (popstate re-entering the chat) also reads `#session` here —
    // stand down and let it own the navigation instead of mounting a landing behind the chat.
    if (bridgeReturnInProgress({ menuPending: menuReturnSession, userPending: userBackSession })) return;
    // A dead session entry with no return flag (e.g. an old bridge entry left behind after
    // opening a different session from a Menu-grid landing): the bar names `#session` but no
    // chat owns it. Heal it to the landing instead of stranding the shell on a route-less hash.
    if (isDeadSessionHash(location.hash)) {
      await setHomePage("worlds");
    }
    return;
  }
  if (route.page !== homePage) await setHomePage(route.page);
  if (route.target) await applyHomeRoute(route);
});

// The platform forwards a top-level hash change into this iframe as a `changeHash` postMessage, and its
// own handler applies it with `window.location.hash = …`. That write cannot be relied on inside a
// generator: perchance injects a <base> pointing at the TOP-LEVEL page, so a fragment-only relative URL
// resolves CROSS-ORIGIN, and the navigation bounces — a stray history event fires and the hash snaps
// back — instead of landing. (That is the whole reason the platform also wraps `history.replaceState`,
// which resolves against our own url; see `syncHomeHash`.) So we apply a forwarded hash ourselves: it
// makes editing the URL, or opening a second `#explore/…` link, behave while a panel is open, and doing
// it first pre-empts the platform's write — by the time its handler runs, the hash already matches.
function applyForwardedHash(hash) {
  if (!homePage) return; // not the home shell (a chat is showing) — the shell isn't ours to route
  if (location.hash === hash) return; // nothing forwarded we don't already show
  if (isStaleHomeHashEcho(hash)) { reassertHomeHash(); return; } // our own older write echoed back
  const route = homeRouteFromHash(hash);
  if (!route.page) return; // not ours (e.g. `#edit`)
  syncHomeHash(route.page, route.target, { force: true });
  if (route.page !== homePage) setHomePage(route.page);
  if (route.target) applyHomeRoute(route);
}
window.addEventListener("message", (e) => {
  if (e.source !== window.parent && e.origin !== "https://perchance.org") return;
  const d = e.data;
  if (!d || d.type !== "changeHash" || typeof d.hash !== "string") return;
  try { applyForwardedHash(d.hash); } catch (err) { console.warn("[home] forwarded hash failed", err); }
});

async function unmountHomePage() {
  const u = homeUnmount;
  homeUnmount = null;
  homeWorldsRerender = null;
  const scroller = $("homeMain");
  if (homePage && homeUI[homePage] && scroller) homeUI[homePage].scroll = scroller.scrollTop || 0;
  if (homePage === "explore") homeUI.explore.at = Date.now();
  if (u) { try { await u(); } catch (e) { console.warn("[home] page unmount failed", e); } }
}

// Mount one page into #homeMain: a page header band — `.hm-bar` (the identity group: emblem + title +
// the 👤 identity chip's slot) beside `.hm-hacts` (the page's action buttons) — and the page body the
// mount owns. On a phone the bar becomes the sticky top bar and the actions stay behind it, in the
// flow (see the drawer band in styles.css); the description leaves the bar there, so the title wears
// a mobile-only ⓘ (`.hm-sub-tip`) that opens it as an info-tip instead of a boxed standfirst.
// Unmounts whatever was there first (releasing its DOM + listeners).
async function setHomePage(id, { force = false, push = false } = {}) {
  if (!HOME_MOUNTS[id]) id = "worlds";
  if (id === homePage && !force) return;
  // A deliberate landing navigation drops any pending chat return (e.g. profile → nav row after
  // a Menu peek: Back from there must not re-enter the old chat).
  if (id !== "user") { releaseUserBack(); userBackSession = null; }
  // UI page switches push a history entry so Back walks the landing pages. History mounts
  // (Back/forward, deep links, initial render) and same-page force remounts (filter shortcuts)
  // only replace. The push is push-then-replace: pushBackClose/plain-push creates the entry with
  // the old URL and the sync below rewrites it to the new page (replaceState is the only call the
  // platform bridges to the host bar).
  if (push && id !== homePage) pushLandingHistory();
  // Two callers can race here — a Back press runs the popped entry's close (popstate) AND the
  // shell's hash listener (hashchange) at once. The loser must stop after the teardown instead of
  // wiping the winner's fresh pane (or double-mounting a module that early-returns while mounted).
  const seq = ++homeMountSeq;
  await unmountHomePage();
  if (seq !== homeMountSeq) return;
  homePage = id;
  // Force the write: a Back traversal restores the iframe fragment on its own, so a non-force
  // replace would early-return and leave the host bar on the stale hash (which then echoes back
  // as a forwarded hash and fights the navigation).
  syncHomeHash(id, "", { force: true });
  const main = $("homeMain");
  main.innerHTML = "";
  const sec = homeSec(id);
  const pageEl = document.createElement("div");
  pageEl.className = "hm-page";
  pageEl.dataset.page = id;
  pageEl.style.setProperty("--page-accent", `var(${sec.accent})`);
  pageEl.style.setProperty("--page-accent-rgb", sec.rgb);
  const head = document.createElement("div");
  if (id === "user") {
    head.className = "hm-head hm-head-empty";
    head.setAttribute("aria-hidden", "true");
    head.innerHTML = `<div class="hm-bar"></div>`;
  } else {
    head.className = "hm-head";
    head.innerHTML = `
    <div class="hm-bar">
      <div class="hm-emblem">${secIconInner(sec)}</div>
      <div class="hm-headtext">
        <h2 class="hm-title">${esc(sec.title)}</h2>${infoTipHtml(sec.sub, { title: sec.title, cls: "hm-sub-tip" })}
        <div class="hm-sub">${esc(sec.sub)}</div>
      </div>
      <div class="hm-id"></div>
    </div>
    <div class="hm-hacts"></div>`;
  }
  pageEl.appendChild(head);
  const pane = document.createElement("div");
  pane.className = "hm-body";
  pageEl.appendChild(pane);
  main.appendChild(pageEl);
  // Dev-editable notice bars (src/announcements.md) below the page header on Worlds/Adventures/Explore.
  // Fire-and-forget: the md fetch must never delay the page mount.
  maybeShowAnnouncement(pageEl, id);
  paintHomeNav();
  const ctx = { actionsEl: head.querySelector(".hm-hacts"), idEl: head.querySelector(".hm-id"), pageEl, main };
  let unmount = null;
  try { unmount = await HOME_MOUNTS[id](pane, ctx); }
  catch (e) {
    console.warn("[home] page mount failed", e);
    pane.innerHTML = `<div class="hm-empty">✖ Couldn't load this page: ${esc(e.message || e)}</div>`;
  }
  homeUnmount = typeof unmount === "function" ? unmount : null;
  // A stale Explore return re-queries page 1 (see community.js's cache TTL), so drop the saved
  // offset with it — restoring it would land mid-page on different content.
  if (id === "explore" && homeUI.explore.at && Date.now() - homeUI.explore.at > EXPLORE_SCROLL_TTL_MS) {
    homeUI.explore.scroll = 0;
  }
  main.scrollTop = (homeUI[id] && homeUI[id].scroll) || 0;
}

// ---- shell entry ----------------------------------------------------------------------------
async function renderLanding(sessions) {
  collapseRails();
  $("app").hidden = true;
  $("landing").hidden = false;
  try {
    homeSessions = sessions || await store.list();
  } catch (e) {
    if (isStorageError(e) || (e && e.isStorageUnavailable)) {
      console.warn("[home] session list unreadable (storage unavailable):", (e && e.message) || e);
      homeSessions = sessions || [];
      notifyStorageError(notify, "reading", e);
    } else throw e;
  }
  try { await refreshWorldNameCache(); } catch (e) { console.warn("[home] world names skipped:", (e && e.message) || e); }
  try { homeUserWorlds = await worldStore.list(); }
  catch (e) {
    if (isStorageError(e) || (e && e.isStorageUnavailable)) {
      console.warn("[home] world list unreadable (storage unavailable):", (e && e.message) || e);
      homeUserWorlds = [];
    } else throw e;
  }
  await loadHomeLinks();
  await loadAddedWorlds(false); // cached kv read; the deferred pass refreshes it after first paint
  rebuildInstalledIds();
  renderHomeNav();
  applyHomeNavPref();
  // Read the route BEFORE mounting: setHomePage mirrors the page into the hash, which drops any
  // target, so the deep-link payload has to be captured first and re-applied after the mount.
  const route = homeRouteFromHash();
  await setHomePage(route.page || "worlds", { force: true });
  if (route.target) applyHomeRoute(route);
  if (/^#discussion\b/.test(location.hash)) openDiscussionPanel().catch(() => {});
  checkInboundShare(); // ?importdata= return path — fire and forget (it notifies/pops up on its own)
  scheduleCommunityDeferredWork();
  scheduleWorldEditorPreload();
  try { mountTavernFab(); } catch (e) {}
  scheduleDiscussionPrewarm();
  try { scheduleBanWarmup(); } catch (e) {}
  dismissBootSplash();
}

async function refreshLanding() {
  let sessions = [];
  try { sessions = await store.list(); }
  catch (e) {
    if (isStorageError(e) || (e && e.isStorageUnavailable)) {
      console.warn("[home] refresh skipped (storage unavailable):", (e && e.message) || e);
      notifyStorageError(notify, "reading", e);
      return;
    }
    throw e;
  }
  await renderLanding(sessions);
}


/* ---------- Adventures page data bits ---------- */
const ADVENTURE_SORTS = [
  { id: "recent", label: "Recently played" },
  { id: "oldest", label: "Oldest first" },
  { id: "name", label: "Name A–Z" },
  { id: "turns", label: "Longest" }
];

// The world a session belongs to, as a filter value: the world's id, or `UNBOUND_KEY` when it is bound to
// nothing installed — a world that was deleted or unpublished, or a save carrying no world at all. That is
// the same condition as the row's ⚠ unbound badge, so every adventure lands in exactly one bucket and no
// adventure can be unreachable by the filter. The key can never collide with a real world id.
const UNBOUND_KEY = "@unbound";

// Group-by-world is a view preference, so it outlives the visit — persisted like the rail's collapsed
// state (`mno.homeNav`) and the Worlds page's ⊘ NSFW preference. The search/sort/filter state stays
// per-visit, like every other page's.
const ADV_GROUP_PREF_KEY = "mno.adventures.group";
function advGroupPref() { try { return localStorage.getItem(ADV_GROUP_PREF_KEY) === "1"; } catch (e) { return false; } }
function persistAdvGroup(v) { try { localStorage.setItem(ADV_GROUP_PREF_KEY, v ? "1" : "0"); } catch (e) {} }




/* ---------- Worlds page ---------- */
const WORLD_SORTS = [
  { id: "recent", label: "Recently used" },
  { id: "updated", label: "Recently updated" },
  { id: "name", label: "Name A–Z" },
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "adventures", label: "Most adventures" }
];
// The one wording for a world you added from Explore, shared by every place that says it on the Worlds
// page: the source facet below (as `Public` beside the ✎/✦ rows), the card's own provenance note, and
// community.js's added-card note (which reaches main.js's `publicNote`/`worldNote` through mnoApp, so
// the two cards can't drift). It is a bare word on purpose: the Explore emblem that leads it is what
// carries the meaning, and it wears the reader's accent colour rather than the OS's 🌐 globe.
const PUBLIC_LABEL = "Public";
// The source facet. `label` is what the chip, its tooltips and the applied pill say, so it stays plain
// text; `icon` is the mark that leads it, and only Explore's `Public` has one — the bundled,
// your-own and imported rows open with a text glyph (✦ / ✎), plus the import icon, exactly as they do on the cards,
// because those three have no emblem of their own to wear.
const WORLD_SOURCES = [
  { value: "bundled", label: "✦ Bundled", icon: "" },
  { value: "mine", label: "✎ My World", icon: "" },
  { value: "imported", label: "Imported", icon: "" },
  { value: "added", label: PUBLIC_LABEL, icon: EXPLORE_IC }
];
// The two markers that lead the tag list in the Filters panel — in the same order they lead a card's
// own tag row (tag-row.js). Neither is an author tag: each is a world FIELD (world.js), so the panel
// offers them and `matches()` tests them structurally rather than against `tags`.
const SPECIAL_TAGS = [NSFW_TAG, REMIX_TAG];

// A foreign import: the file arrived via import (`meta.origin`, see isImportedMeta in world.js) AND
// isn't stamped with this device's community id — an import you adopted and published reads "My
// World" (see localWorldNote), so it stays "mine". Mirrors the card footer exactly, so the Imported
// filter selects precisely the worlds whose footer says Imported.
function isForeignImport(meta) {
  if (!isImportedMeta(meta)) return false;
  const myId = (worldStore && worldStore.authorId) || "";
  return !(myId && meta && meta.authorId && String(meta.authorId) === String(myId));
}

// Every world the player can see, tagged with its source (bundled | mine | imported | added). A
// foreign import is its own source (see isForeignImport); a fork stays "mine" and carries
// `meta.remix`. `link` is the catalog link record for a published world (null when it has never
// been published), which the card's footer reads to say `· Published` / `· Hidden`.
function worldRecords() {
  const recs = [];
  for (const w of bundledWorlds) recs.push({ id: w.meta.id, meta: w.meta, bundled: w, source: "bundled", link: null });
  for (const e of homeUserWorlds) {
    if (bundledWorldForId(e.id)) continue; // a bundled world is listed above
    recs.push({ id: e.id, meta: e, bundled: null, source: isForeignImport(e) ? "imported" : "mine", link: homeLinks[e.id] || null });
  }
  for (const it of homeAdded.items) {
    recs.push({ id: libId(it.rec.worldId), meta: addedMeta(it.rec, it.entry), bundled: null, source: "added", added: it, link: null });
  }
  return recs;
}

// A community library record viewed as a card `meta` (the two shapes differ slightly). The record
// snapshots the catalog listing; the downloaded world file is the fallback for records written
// before the listing fields were kept (and the truth for what will actually be played).
function addedMeta(rec, entry) {
  const wm = cachedWorldMeta(entry);
  const pick = (a, b) => (a === undefined || a === null || a === "" ? b : a);
  const tags = (Array.isArray(rec.tags) && rec.tags.length) ? rec.tags : ((wm && wm.tags) || []);
  return {
    id: libId(rec.worldId),
    name: pick(rec.title, wm && wm.name) || rec.worldId,
    description: pick(rec.description, wm && wm.description) || "",
    author: pick(rec.authorName, wm && wm.author) || "",
    authorId: rec.userId || (wm && wm.authorId) || "",
    tags: Array.isArray(tags) ? tags : [],
    nsfw: rec.nsfw === true || !!(wm && wm.nsfw),
    cover: pick(rec.coverUrl, wm && wm.cover) || "",
    // Fork provenance (the `remix` chip): the downloaded file's `meta.remix` is the truth, with the
    // catalog record's own fork fields as the fallback for a copy that hasn't landed yet.
    remix: (wm && wm.remix) || remixFromRec(rec),
    createdAt: (wm && wm.createdAt) || "",
    // Catalog listing time (ms epoch) first — it's what Explore's own "updated X ago" reads — then
    // the downloaded file's date. Without these every added world sorts as epoch 0 and clumps by
    // source under any date sort.
    updatedAt: (Number(rec.updatedAt) > 0 ? new Date(Number(rec.updatedAt)).toISOString() : "") || (wm && wm.updatedAt) || ""
  };
}

// An added world's cached file parsed into its meta, memoized by content hash — the card, the
// search index and the tag/NSFW filters all read it, and the grid rerenders on every keystroke.
const cachedMetaByHash = new Map();
function cachedWorldMeta(entry) {
  if (!entry || !entry.text) return null;
  const key = entry.jsonHash || entry.text;
  if (cachedMetaByHash.has(key)) return cachedMetaByHash.get(key);
  let m = null;
  try { const { world } = loadWorld(entry.text); m = world ? world.meta : null; } catch (e) { m = null; }
  cachedMetaByHash.set(key, m);
  return m;
}

// Fallback card for an added world when community.js hasn't loaded (or failed to): cover, title and
// author, no actions beyond play/retry. community.js's own card carries the full read-only menu.
function simpleAddedCard(it) {
  const rec = it.rec;
  const meta = addedMeta(rec, it.entry);
  const card = document.createElement("div");
  card.className = "ld-wcard ex-added-card";
  const cover = meta.cover
    ? `<img class="ld-wcover-img" src="${esc(meta.cover)}" alt="" loading="lazy">`
    : `<div class="ld-wcover-ph">${esc(String(meta.name || "?").charAt(0).toUpperCase())}</div>`;
  card.innerHTML = `
    <div class="ld-wcover">
      ${cover}
      ${isMnoAuthor(rec.userId, rec.authorName || meta.author) && libRecLive(rec) ? mnoBadgeCover : ""}
    </div>
    <div class="ld-wbody">
      <div class="ld-whead"><span class="ld-wname" title="${esc(meta.name)}">${esc(meta.name)}</span></div>
      ${worldMeta(meta)}
      <div class="ld-wdesc">${inlineMd(meta.description || "")}</div>
      ${worldTags(meta)}
      ${addedNote(rec, it.entry)}
    </div>`;
  card.addEventListener("click", () => openLibWorldDetail(rec.worldId));
  wireCardAuthorLink(card, meta.author);
  // The actionable footer notes behave like their community-card ⋮ rows (which this fallback
  // card doesn't have): an available update refreshes, a failed download retries. Look and
  // layout are untouched — only a pointer cursor and a click. The card click itself still opens.
  const noteEl = card.querySelector(".ld-wnote");
  if (noteEl && (rec.stale || !it.entry)) {
    noteEl.style.cursor = "pointer";
    noteEl.setAttribute("role", "button");
    noteEl.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        const m = await communityModule();
        if (rec.stale) await m.api.refreshLibraryWorld(rec.worldId);
        else await m.api.retryLibrary(rec.worldId);
      } catch (_) { openLibWorldDetail(rec.worldId); }
    });
  }
  return card;
}

// The welcome banner is a one-time orientation, so "Don't show this again" has to outlive the visit —
// the same machine-local localStorage pattern as the rail's collapsed state (`mno.homeNav`) and the
// Adventures page's grouping (`mno.adventures.group`). Settings → Interface is the way back, which is
// why it is a preference rather than a "seen it" flag nothing could ever clear.
const WELCOME_PREF_KEY = "mno.worlds.welcome";
function welcomeHidden() { try { return localStorage.getItem(WELCOME_PREF_KEY) === "1"; } catch (e) { return false; } }
function persistWelcomeHidden(v) { try { localStorage.setItem(WELCOME_PREF_KEY, v ? "1" : "0"); } catch (e) {} }

// The Worlds page's privacy footer is the same one-time-orientation pattern as the
// welcome banner: a machine-local localStorage pref (`mno.privacy.footer`), dismissed by
// the quiet link inside it, with Settings → Interface as the way back.
const PRIVACY_FOOTER_PREF_KEY = "mno.privacy.footer";
function privacyFooterHidden() { try { return localStorage.getItem(PRIVACY_FOOTER_PREF_KEY) === "1"; } catch (e) { return false; } }
function persistPrivacyFooterHidden(v) { try { localStorage.setItem(PRIVACY_FOOTER_PREF_KEY, v ? "1" : "0"); } catch (e) {} }

// The composer input tip is the same one-time-orientation pattern as the welcome banner: a
// machine-local localStorage pref (`mno.composer.tip`), dismissed by the quiet link inside it,
// with Settings → Interface as the way back.
// The Context Meter (the in-chat token counter) is opt-in per device, default off —
// Settings → Interface → Context Debug. Admins always see the meter; the toggle is what
// reveals it to everyone else. Prompt TEXT stays admin-only regardless (see ctx-meter.js).
const CTX_DEBUG_KEY = "mno.ctx.debug";
function ctxDebugEnabled() { try { return localStorage.getItem(CTX_DEBUG_KEY) === "1"; } catch (e) { return false; } }
function persistCtxDebug(v) { try { localStorage.setItem(CTX_DEBUG_KEY, v ? "1" : "0"); } catch (e) {} }

const COMPOSER_TIP_KEY = "mno.composer.tip";
function composerTipHidden() { try { return localStorage.getItem(COMPOSER_TIP_KEY) === "1"; } catch (e) { return false; } }
function persistComposerTipHidden(v) { try { localStorage.setItem(COMPOSER_TIP_KEY, v ? "1" : "0"); } catch (e) {} }

function applyComposerTipPref() {
  const tip = document.getElementById("composerTip");
  if (tip) tip.hidden = composerTipHidden();
}

// The in-chat token counter pip is admin-only (see ctx-meter.js): it shows whenever the current
// connection is signed in as admin (Settings → Admin) and hides otherwise, following the live
// `admin` event (sign-in, sign-out, dropped connection).
let ctxAdminAuthed = false;

// The Worlds page's welcome banner — the page's branding (the logo and the `gameTitle` the rail head and
// the topbar already wear) over a one-line description of the engine, the three ways in, and a quiet way to
// stop showing it. mountWorldsPage puts it between the page header and the toolbar, so the header keeps
// owning the actions: the banner has no ⚔ Begin button of its own, and its only button-shaped control is
// the dismiss — a welcome that offered the same buttons as the header would be one screen competing with
// itself.
//
// The three steps read as DIRECTIONS to those controls (⚔ Begin Your Adventure in the header, ＋ Create
// world beside it, Explore in the rail), which is why each label is the control's own name: the reader is
// being told where to go. Each label is also a LINK that takes you there (`.hm-welcome-go` buttons, styled
// as text — accent, dotted underline, no button chrome), so the direction can be acted on where it is read
// without the banner growing a second toolbar. The links call exactly what those controls call
// (`beginNewAdventure` / `newWorld` / `setHomePage("explore")`), so a change there needs no change here.
//
// It opens with a greeting (the "Welcome to" line above the name). The tagline under it names the parts a
// player will actually meet in play, and the three steps give one sentence each, introduced by a colon
// rather than an em dash — this is orientation, not documentation.
//
// Every clause has to stay true of the code, since this is the first thing a new player reads: the header
// actions are ⚔ Begin Your Adventure / ＋ Create world, and picking a world leads to the character wizard,
// which is why "create your character" is the word here and not a dice metaphor; the tagline's promise is
// the engine's real parts (`engine.determineCheck` for skill checks, the hero's stats, the world-defined
// trackers, the mapmaker's location entries and the NPC cast); the world wizard's scenario, lorebook and
// NPCs are what the reader defines in step two, and a rules overlay is where custom rules go; publishing
// lives in a world's ⋮ menu; Explore is where an added world comes from, which is why the third row leads
// with the Explore mark (`EXPLORE_IC`) and ends on the payoff — playing the world you just added; and
// Data & Backup is a section of the Settings panel (§6.16), which is what the footer line says.
function welcomeBannerEl() {
  const el = document.createElement("section");
  el.className = "hm-welcome";
  el.setAttribute("aria-label", `Welcome to ${gameTitle}`);
  el.innerHTML = `
    <div class="hm-welcome-top">
      <img class="hm-welcome-logo" src="src/images/logo.svg" alt="">
      <div class="hm-welcome-head">
        <div class="hm-welcome-hi">Welcome to</div>
        <div class="hm-welcome-name">${esc(gameTitle)}</div>
        <div class="hm-welcome-tag">An AI game master for RPG, complete with skill checks, stats, trackers, a map, and a cast of NPCs.</div>
      </div>
    </div>
    <div class="hm-welcome-steps">
      <div class="hm-welcome-step"><span class="hm-welcome-ic">⚔</span><div class="hm-welcome-tx"><button type="button" class="hm-welcome-go" data-go="begin">Begin your adventure</button>: pick a world, create your character, and start roleplaying.</div></div>
      <div class="hm-welcome-step"><span class="hm-welcome-ic">＋</span><div class="hm-welcome-tx"><button type="button" class="hm-welcome-go" data-go="create">Create world</button>: define the scenario, lore, NPCs, and set your own rules.</div></div>
      <div class="hm-welcome-step"><span class="hm-welcome-ic">${EXPLORE_IC}</span><div class="hm-welcome-tx"><button type="button" class="hm-welcome-go" data-go="explore">Explore</button>: browse worlds the community has published, and add the ones you want to play.</div></div>
    </div>
    <div class="hm-welcome-foot">
      <span class="hm-welcome-note">Adventures, worlds, and saves are stored in this browser. Access your data and backup from Settings.</span>
      <button type="button" class="hm-welcome-x">Don't show this again</button>
    </div>`;
  // The three step links do what the step says: the same calls the header's ⚔ Begin / ＋ Create world and
  // the rail's Explore make. (They fire-and-forget; each opens its own panel/wizard, which covers the
  // banner while it is open, so a second click can't stack two of them.)
  const GO = { begin: () => beginNewAdventure(), create: () => newWorld(), explore: () => setHomePage("explore") };
  el.querySelectorAll(".hm-welcome-go").forEach((b) => { b.onclick = GO[b.dataset.go]; });
  el.querySelector(".hm-welcome-x").onclick = () => {
    persistWelcomeHidden(true);
    el.remove();
  };
  return el;
}

// The Worlds and Adventures pages' privacy box — a quiet dark-grey card pinned to the bottom of the
// page: the local-only promise (worlds and adventures stay private in this browser), a link into
// Settings → Data & Backup, and the same "Don't show this again" dismiss the welcome
// banner wears. Mounted by mountWorldsPage / mountAdventuresPage after the count foot; Settings →
// Interface is the way back. One shared preference: dismissing it on either page hides it on both.
// When the browser reports best-effort storage (`persisted === false` — e.g. incognito), a
// warning is appended in place once the check resolves, so the footer also says the data may
// be cleared when space runs low. Checked once per load; unknown/unsupported stays silent.
let _persistCheck = null;
function persistedState() {
  if (!_persistCheck) {
    _persistCheck = import("./storage-info.js").then((m) => m.readBrowserStorage()).catch(() => ({ unsupported: true }));
  }
  return _persistCheck;
}
function privacyFooterEl() {
  const el = document.createElement("div");
  el.className = "hm-privacy";
  el.setAttribute("aria-label", "Privacy notice");
  el.innerHTML = `
    <span class="hm-privacy-tx">🔒 Your private worlds and adventures are stored locally in this browser. Manage them in <button type="button" class="hm-privacy-go">Data &amp; Backup</button>.</span>
    <button type="button" class="hm-privacy-x">Don't show this again</button>`;
  el.querySelector(".hm-privacy-go").onclick = () => openSettingsPanel("backup");
  el.querySelector(".hm-privacy-x").onclick = () => {
    persistPrivacyFooterHidden(true);
    el.remove();
  };
  persistedState().then((info) => {
    if (!el.isConnected) return;
    if (!info || info.persisted !== false) return;
    const tx = el.querySelector(".hm-privacy-tx");
    if (!tx || tx.querySelector(".hm-privacy-warn")) return;
    const w = document.createElement("span");
    w.className = "hm-privacy-warn-line";
    w.appendChild(document.createTextNode("⚠️ "));
    const r = document.createElement("span");
    r.className = "hm-privacy-warn";
    r.textContent = "Persistent storage is off in this browser";
    w.appendChild(r);
    w.appendChild(document.createTextNode(", so it may clear this data when space runs low — back up often. Try a regular (non-incognito) window or a different browser with persistent storage allowed for this site."));
    tx.appendChild(w);
  });
  return el;
}

async function mountWorldsPage(pane, ctx) {
  const ui = homeUI.worlds;

  // Header actions ⚔ Begin / ＋ Create / ⭱ Import (Data & Backup is a Settings section, §6.16). There
  // is no hero block above the grid — a big centered logo/title/tagline never looked right tucked under
  // the page header (the branding lives in the welcome banner, README §6.10), so the ⚔ Begin Your
  // Adventure CTA leads these actions: it shows the world picker when more than one
  // world is installed, then the character wizard.
  const beginBtn = document.createElement("button");
  beginBtn.type = "button";
  beginBtn.className = "hm-act hm-act-primary";
  beginBtn.innerHTML = `<span class="hm-act-full">⚔ Begin Your Adventure</span><span class="hm-act-short">⚔ Begin Adventure</span><span class="hm-act-short-narrow">⚔ Begin</span>`;
  beginBtn.title = "Start a new adventure";
  beginBtn.onclick = () => beginNewAdventure();

  const newBtn = document.createElement("button");
  newBtn.type = "button";
  newBtn.className = "hm-act";
  newBtn.innerHTML = `<span class="hm-act-full">＋ Create world</span><span class="hm-act-short">＋ Create</span>`;
  newBtn.title = "Create a new world from a blank template";
  newBtn.onclick = () => newWorld();
  const impLabel = document.createElement("label");
  impLabel.className = "hm-act filebtn";
  impLabel.title = "Import a world file (.mno-world)";
  impLabel.innerHTML = `<span class="hm-act-full">${ICON_IMPORT} Import World</span><span class="hm-act-short">${ICON_IMPORT} Import</span><input type="file" accept=".mno-world" hidden>`;
  impLabel.querySelector("input").onchange = (e) => importWorldFile(e.target.files[0], e.target);

  // The section-level "Check for updates" is an ICON on the toolbar now (between ⇅ sort and
  // ⊘ NSFW — `actions:` in search-bar.js) instead of a fourth labelled button in the page header. The
  // header is for making things (⚔ Begin / ＋ Create world / ⭱ Import World), and with the check gone
  // it reads as one right-aligned group again — ⭱ Import World last, exactly where the Adventures page
  // keeps its own ⭱ Import Save. Only offered once something has been added from the catalog; ⟳ is the
  // flat symbol the cards themselves use for a stale copy. Silent-ish: it reports its own result via
  // toast, then the ⟳ badges on the cards repaint through refreshAddedWorlds().
  const updBtn = document.createElement("button");
  updBtn.type = "button";
  updBtn.className = "hm-btn hm-updcheck";
  updBtn.title = "Check whether any world you added has a newer version";
  updBtn.setAttribute("aria-label", "Check for updates");
  updBtn.innerHTML = '<span class="hm-upd">⟳</span>';
  updBtn.hidden = !homeAdded.items.length || IS_MOBILE || window.matchMedia("(max-width: 640px)").matches;
  updBtn.onclick = async () => {
    if (updBtn.disabled) return;
    updBtn.disabled = true;
    updBtn.classList.add("hm-busy"); // the glyph spins while the check is in the air
    updBtn.title = "Checking for updates…";
    try {
      const m = await communityModule();
      await m.api.checkLibraryUpdates();
      await refreshAddedWorlds();
    } catch (e) { notify("✖ Couldn't check for updates: " + (e.message || e)); }
    finally {
      updBtn.classList.remove("hm-busy");
      updBtn.title = "Check whether any world you added has a newer version";
      updBtn.disabled = false;
    }
  };
  ctx.actionsEl.append(beginBtn, newBtn, impLabel);

  // ---- toolbar -----------------------------------------------------------------------------
  // The shared search bar (search-bar.js): a search field, ONE ⚙ Filters disclosure, a quiet sort
  // control and the ⊘ NSFW switch. The source facets and the tag cloud live inside the Filters popover
  // as labelled sections (a segmented control and up to 25 chips in the open read as a wall of controls
  // on the landing page), and whatever IS applied shows as removable pills under the bar. The default
  // state is a search box and a button.
  //
  // Inside the popover every entry offers BOTH directions: clicking the value REQUIRES it, clicking
  // the ✕ on its right EXCLUDES it. A filter is therefore three-valued (`off · require · exclude`),
  // which is what lets `⊘ nsfw` mean "hide the adult ones" beside `remix` meaning "only the forks".
  const activeBar = document.createElement("div");
  activeBar.className = "hm-activebar";
  activeBar.hidden = true;
  const grid = document.createElement("div");
  grid.className = "hm-grid";
  const foot = document.createElement("div");
  foot.className = "hm-foot";

  // ⊘ NSFW closes the bar at the far right, apart from the search and the two disclosures: it is not
  // a filter on the list but a per-browser decision about what EXISTS, and keeping it on the bar (not
  // in a menu) means a visitor can see at a glance whether adult worlds are showing.
  //
  // Turning it OFF clears the `nsfw` REQUIRE filter: with adult worlds hidden again, "only the adult
  // ones" can never match anything, and the chip that would explain why is itself gone with the
  // switch — so leaving it set would trap the list in an unexplained empty state. An EXCLUSION
  // (`✕ nsfw`) is left alone: it only says what the switch already says.
  const barApi = searchBar({
    placeholder: "Search worlds…",
    query: ui.q,
    onQuery: (v) => { ui.q = v; rerender(); },
    sort: {
      options: WORLD_SORTS,
      value: () => ui.sort,
      onPick: (id) => { ui.sort = id; rerender(); }
    },
    filters: {
      title: "Filter worlds by source and tag",
      count: activeCount,
      body: renderOptionPanels,
      clearAll: () => clearFilters()
    },
    nsfw: {
      onChange: () => {
        if (!showNsfw()) ui.tags = ui.tags.filter((t) => String(t).toLowerCase() !== NSFW_TAG);
        rerender();
      }
    },
    actions: [updBtn]
  });
  const bar = barApi.el;
  // The update-all banner sits directly below the search bar and only while at least one added
  // world has a newer catalog version. It names the count and updates everything in one go —
  // the per-card ⟳ notes stay for single updates. Repainted by rerender() from homeAdded.items,
  // which refreshAddedWorlds() keeps fresh on every library change (including each refresh below,
  // so the count ticks down as worlds land).
  const updBar = document.createElement("div");
  updBar.className = "hm-updbar";
  updBar.hidden = true;
  const updBarTx = document.createElement("span");
  updBarTx.className = "hm-updbar-tx";
  const updAllBtn = document.createElement("button");
  updAllBtn.type = "button";
  updAllBtn.className = "mini";
  updAllBtn.textContent = "Update all";
  const updDismissBtn = document.createElement("button");
  updDismissBtn.type = "button";
  updDismissBtn.className = "hm-updbar-x";
  updDismissBtn.textContent = "✕";
  updDismissBtn.title = "Dismiss";
  updDismissBtn.setAttribute("aria-label", "Dismiss update notification");
  updBar.append(updBarTx, updAllBtn, updDismissBtn);
  let updatingAll = false;
  let updateProgress = null;
  // Dismissed stale set (sorted worldIds). Hiding the bar remembers WHAT was dismissed, so a
  // newly-stale world still shows the bar again — dismiss only silences the current set.
  let updDismissedKey = null;
  const staleKey = () => homeAdded.items.filter((it) => it.rec && it.rec.stale).map((it) => it.rec.worldId).sort().join(",");
  updDismissBtn.onclick = () => {
    updDismissedKey = staleKey();
    updBar.hidden = true;
  };
  const paintUpdBar = () => {
    if (updatingAll && updateProgress) {
      updDismissBtn.hidden = true;
      updBar.hidden = false;
      updBarTx.textContent = `Updating ${updateProgress.done}/${updateProgress.total}…`;
      return;
    }
    updDismissBtn.hidden = false;
    const n = homeAdded.items.filter((it) => it.rec && it.rec.stale).length;
    if (!n) {
      updDismissedKey = null;
      updBar.hidden = true;
      updBarTx.textContent = "";
      return;
    }
    // A different stale set than the dismissed one means something new arrived — show again.
    if (updDismissedKey && updDismissedKey !== staleKey()) updDismissedKey = null;
    if (updDismissedKey) {
      updBar.hidden = true;
      return;
    }
    updBar.hidden = false;
    updBarTx.textContent = n === 1 ? "1 world update available" : `${n} worlds update available`;
  };
  updAllBtn.onclick = async () => {
    if (updatingAll) return;
    updatingAll = true;
    updateProgress = { done: 0, total: 0 };
    updAllBtn.disabled = true;
    paintUpdBar();
    try {
      const m = await communityModule();
      const res = await m.api.refreshAllStaleWorlds({
        onProgress: (done, total) => { updateProgress = { done, total }; paintUpdBar(); }
      });
      await refreshAddedWorlds();
      if (!res.total) notify("✓ Everything is already up to date.");
      else if (!res.failed.length) notify(`⟳ Updated ${res.updated} world${res.updated === 1 ? "" : "s"}.`);
      else notify(`⟳ Updated ${res.updated}/${res.total} worlds — ${res.failed.length} couldn't update.`, { ms: 5200 });
    } catch (e) { notify("✖ Couldn't update (" + (e.message || e) + ").", { ms: 5200 }); }
    finally {
      updatingAll = false;
      updateProgress = null;
      updAllBtn.disabled = false;
      paintUpdBar();
    }
  };
  // The welcome banner leads the page on a first visit (README §6.10); everything else is unchanged.
  const welcome = welcomeHidden() ? null : welcomeBannerEl();
  const privacyFoot = privacyFooterHidden() ? null : privacyFooterEl();
  pane.append(...(welcome ? [welcome] : []), bar, updBar, activeBar, grid, foot, ...(privacyFoot ? [privacyFoot] : []));

  let release = null;

  const SRC_LABEL = new Map(WORLD_SOURCES.map((o) => [o.value, o.label]));
  // …and each source's mark, so the pill an applied source leaves under the bar wears the same picture
  // the chip in the panel does (only `Public` has one).
  const SRC_ICON = new Map(WORLD_SOURCES.map((o) => [o.value, o.icon]));
  // Sources and tags each hold TWO sets, and the two are mutually exclusive per value: the REQUIRED
  // ones (a world must match EVERY one — the accent chip) and the EXCLUDED ones (a world must match
  // NONE — the dashed, struck-through chip). Clicking a value toggles required; clicking the ✕ on its
  // right toggles excluded. Picking one side always clears the other, so a value can never be both.
  const toggleSource = (v) => { flipFilter(ui.sources, ui.sourcesNot, v); rerender(); };
  const toggleSourceNot = (v) => { flipFilter(ui.sourcesNot, ui.sources, v); rerender(); };
  const toggleTag = (t) => { flipFilter(ui.tags, ui.tagsNot, t); rerender(); };
  const toggleTagNot = (t) => { flipFilter(ui.tagsNot, ui.tags, t); rerender(); };
  const clearFilters = () => { resetWorldFilters(); rerender(); };

  // The `by @name` filter — set from a world panel's author line (Explore's `more`, copied here), which
  // is why it has no chips of its own in the panel. A world carries its author as a NAME with the
  // community id behind it only when the file knows one, so the id decides when both sides have it (a
  // renamed author's worlds still group together) and the name is the fallback — a bundled or imported
  // world usually has only a name.
  const inAuthor = (rec) => {
    const a = ui.author;
    if (!a) return true;
    const id = String(rec.meta.authorId || "").trim();
    if (a.id && id) return a.id === id;
    return String(rec.meta.author || "").trim().toLowerCase() === String(a.name || "").toLowerCase();
  };
  const authorLabel = () => `by @${ui.author.name || ui.author.id}`;

  // Does this world carry `t`? The two special markers are world FIELDS (world.js), not author tags,
  // so they are matched structurally — `remix` against the fork-provenance record, `nsfw` against the
  // adult rating — and only everything else goes to the tag list. Both are offered in the panel
  // because that is where a visitor looks for "only the ones forked from something else" and "only
  // the adult ones".
  const carries = (rec, t) => {
    const s = String(t).toLowerCase();
    if (s === NSFW_TAG) return isNsfwMeta(rec.meta);
    if (s === REMIX_TAG) return isRemixMeta(rec.meta);
    return (rec.meta.tags || []).some((x) => String(x).toLowerCase() === s);
  };

  // The worlds a COUNT is measured against: everything the ⊘ switch leaves, with the other active
  // filters applied — the dimension a count belongs to is skipped, so a chip's number answers "what
  // would this choice leave me with" instead of collapsing to 0 as soon as it is picked, and it holds
  // steady while you type in the search box. `keepNot` lifts one exclusion, which is how an excluded
  // entry can say how many worlds it is hiding.
  const pool = (opts = {}) => worldRecords().filter((r) => {
    if (nsfwHidden(r.meta)) return false;
    if (!inAuthor(r)) return false;
    if (!opts.skipSources) {
      if (ui.sources.length && !ui.sources.includes(r.source)) return false;
      if (ui.sourcesNot.includes(r.source)) return false;
    }
    if (!opts.skipRequire && ui.tags.length && !ui.tags.every((t) => carries(r, t))) return false;
    for (const t of ui.tagsNot) {
      if (opts.keepNot === t) continue;
      if (carries(r, t)) return false;
    }
    return true;
  });

  // Sources are multi-select, like tags: an EMPTY selection means "all sources" (which is why there
  // is no `All` option to pick — picking nothing is the same thing, without a special case). An
  // excluded source is the mirror image: every source except that one.
  const matches = (rec) => {
    if (nsfwHidden(rec.meta)) return false;
    if (!inAuthor(rec)) return false;
    if (ui.sources.length && !ui.sources.includes(rec.source)) return false;
    if (ui.sourcesNot.includes(rec.source)) return false;
    if (ui.tags.length && !ui.tags.every((t) => carries(rec, t))) return false;
    if (ui.tagsNot.some((t) => carries(rec, t))) return false;
    if (ui.q) {
      const hay = (rec.meta.name + " " + (rec.meta.description || "") + " " + (rec.meta.author || "")).toLowerCase();
      if (!hay.includes(ui.q.toLowerCase())) return false;
    }
    return true;
  };

  const counts = () => {
    const c = new Map();
    for (const s of homeSessions) {
      const k = s.worldId || defaultWorld.meta.id;
      c.set(k, (c.get(k) || 0) + 1);
    }
    return c;
  };

  const sortRecs = (list) => {
    const last = new Map();
    for (const s of homeSessions) {
      const k = s.worldId || defaultWorld.meta.id;
      last.set(k, Math.max(last.get(k) || 0, s.lastUpdated || 0));
    }
    const byName = (a, b) => String(a.meta.name || "").localeCompare(String(b.meta.name || ""));
    const at = (r) => Date.parse(r.meta.createdAt || "") || 0;
    const up = (r) => Date.parse(r.meta.updatedAt || "") || 0;
    const cnt = counts();
    const cmp = {
      recent: (a, b) => (last.get(b.id) || up(b)) - (last.get(a.id) || up(a)) || byName(a, b),
      updated: (a, b) => up(b) - up(a) || byName(a, b),
      name: byName,
      newest: (a, b) => at(b) - at(a) || byName(a, b),
      oldest: (a, b) => at(a) - at(b) || byName(a, b),
      adventures: (a, b) => (cnt.get(b.id) || 0) - (cnt.get(a.id) || 0) || byName(a, b)
    };
    return list.slice().sort(cmp[ui.sort] || cmp.recent);
  };

  // How many filters are applied: the ⚙ button's badge, and whether the pill row exists at all. An
  // `nsfw` REQUIRE counts like any other filter, and so does the author filter (which has no chip).
  function activeCount() {
    return ui.sources.length + ui.sourcesNot.length + ui.tags.length + ui.tagsNot.length + (ui.author ? 1 : 0);
  }

  // The Filters panel's body: the SOURCE section then the TAG cloud. Rebuilt from scratch whenever the
  // panel opens (and again while it is open, if a filter changes), which is why the chips read straight
  // from `ui` — there is no panel state to keep in sync. `ctn` is the panel's scrolling body (search-bar.js).
  function renderOptionPanels(ctn) {
    ctn.innerHTML = `
      <div class="hm-psec"><div class="hm-psech">Source</div><div class="hm-popts" data-slot="source"></div></div>
      <div class="hm-psec"><div class="hm-psech">Tags</div><div class="hm-popts" data-slot="tags"></div></div>`;
    const srcSlot = ctn.querySelector('[data-slot="source"]');
    const tagSlot = ctn.querySelector('[data-slot="tags"]');

    // Each source shows how many worlds it offers under the TAG filters (the pool skips the source
    // dimension, so requiring one never zeroes the others out).
    const bySource = pool({ skipSources: true });
    const srcCount = (v) => bySource.filter((r) => r.source === v).length;
    for (const o of WORLD_SOURCES) {
      const state = ui.sources.includes(o.value) ? "on" : ui.sourcesNot.includes(o.value) ? "ex" : "";
      srcSlot.appendChild(optionEl(o.label, srcCount(o.value), state,
        () => toggleSource(o.value), () => toggleSourceNot(o.value),
        { main: `Only worlds from ${o.label}`, x: `Exclude ${o.label}` }, "", o.icon));
    }

    // Tags are tallied from the worlds the SOURCE filters and the EXCLUDED entries leave (not from the
    // search hits), so the counts hold steady while you type and every offered tag can actually yield
    // a result. A world contributes its two special markers alongside its author tags. Capped at 24.
    const tally = new Map();
    for (const r of pool({ skipRequire: true })) {
      for (const t of r.meta.tags || []) tally.set(String(t), (tally.get(String(t)) || 0) + 1);
      if (isNsfwMeta(r.meta)) tally.set(NSFW_TAG, (tally.get(NSFW_TAG) || 0) + 1);
      if (isRemixMeta(r.meta)) tally.set(REMIX_TAG, (tally.get(REMIX_TAG) || 0) + 1);
    }
    // An active entry is ALWAYS listed, even at 0: requiring a tag hides every world without it (so
    // its own count would read 0), and an excluded tag hides its own worlds, which would take away
    // the very chip you'd use to undo it.
    for (const t of [...ui.tags, ...ui.tagsNot]) if (!tally.has(t)) tally.set(t, 0);
    // An EXCLUDED tag's number is what lifting that one exclusion alone would bring back, so the chip
    // says how much it is hiding rather than the 0 it currently contributes.
    for (const t of ui.tagsNot) tally.set(t, pool({ keepNot: t }).filter((r) => carries(r, t)).length);
    // The two special markers lead, in the same order they lead a card's own tag row (tag-row.js:
    // `nsfw`, then `remix`); the author tags follow, by how many worlds carry them.
    const rank = (t) => { const i = SPECIAL_TAGS.indexOf(String(t).toLowerCase()); return i < 0 ? SPECIAL_TAGS.length : i; };
    const top = [...tally.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 24);
    tagSlot.innerHTML = "";
    if (!top.length) {
      const none = document.createElement("span");
      none.className = "hm-pnone";
      none.textContent = "No tags to filter.";
      tagSlot.appendChild(none);
    }
    for (const [tag, n] of top) {
      const key = String(tag).toLowerCase();
      const state = ui.tags.includes(tag) ? "on" : ui.tagsNot.includes(tag) ? "ex" : "";
      // Every tag is worded the same, markers included: the chip's colour and its place at the head
      // of the list already say which kind it is. (`nsfw` is offered only while the ⊘ switch is on —
      // with adult worlds hidden there is nothing to narrow to.)
      const tips = { main: `Only worlds tagged “${tag}”`, x: `Exclude worlds tagged “${tag}”` };
      tagSlot.appendChild(optionEl(tag, n, state, () => toggleTag(tag), () => toggleTagNot(tag), tips,
        key === NSFW_TAG ? " hm-popt-nsfw" : key === REMIX_TAG ? " hm-popt-special" : ""));
    }
  }

  // One repaint for the whole toolbar state: the bar's own repaint — the count badge, the sort button's
  // label, and the Filters panel's chips when it happens to be open (search-bar.js's `refresh()`) — plus
  // the removable pills row under the bar. Called from rerender() (so a search keystroke or a sort change
  // keeps it honest) and once when the page mounts.
  const renderFilterState = () => {
    barApi.refresh();
    // The `by @name` pill leads the row: it is the one applied filter with no chip in the panel (it is
    // set from a world panel's author line), so the pill is where it is named — and removed.
    const entries = [];
    if (ui.author) entries.push({ label: authorLabel(), remove: () => { ui.author = null; rerender(); } });
    for (const s of ui.sources) entries.push({ label: SRC_LABEL.get(s) || s, icon: SRC_ICON.get(s) || "", remove: () => toggleSource(s) });
    for (const t of ui.tags) entries.push({ label: t, remove: () => toggleTag(t) });
    for (const s of ui.sourcesNot) entries.push({ label: SRC_LABEL.get(s) || s, icon: SRC_ICON.get(s) || "", excluded: true, remove: () => toggleSourceNot(s) });
    for (const t of ui.tagsNot) entries.push({ label: t, excluded: true, remove: () => toggleTagNot(t) });
    renderActivePills(activeBar, entries, entries.length ? clearFilters : null);
  };

  const cardFor = (rec) => {
    if (rec.source === "added") {
      if (homeCommunity && homeCommunity.api && homeCommunity.api.addedCard) {
        const c = homeCommunity.api.addedCard(rec.added.rec, rec.added.entry, rec.meta);
        if (c) return c;
      }
      return simpleAddedCard(rec.added);
    }
    return worldCard(rec.meta, rec.bundled, { source: rec.source, link: rec.link });
  };

  function rerender() {
    renderFilterState();
    updBtn.hidden = !homeAdded.items.length;
    paintUpdBar();
    if (release) { release(); release = null; }
    const list = sortRecs(worldRecords().filter(matches));
    if (!list.length) {
      // No actions: the page header directly above carries ＋ Create world / ⭱ Import World, and when
      // the list is empty because of filters the pill row just above is how you get back — so the block
      // is a mark and one line, nothing else (see emptyStateEl).
      grid.innerHTML = "";
      grid.style.display = "block";
      grid.appendChild(emptyStateEl(EMPTY_WORLD_MARK, homeAdded.loaded ? "No worlds match those filters." : "No worlds yet."));
      foot.textContent = "";
      return;
    }
    grid.style.display = "";
    const cnt = counts();
    release = renderIncremental(ctx.main, grid, list.map((rec) => () => cardFor(rec)), { chunk: 24, moreLabel: "Show more worlds" });
    foot.textContent = `${list.length} world${list.length === 1 ? "" : "s"}`;
    scheduleTagFit(); // clip each card's tag row to its `…` chip once the grid has its columns
  }

  homeWorldsRerender = rerender;
  rerender();
  // Once per visit to this page, ask the community about our own listings — right where the ⋮
  // menus whose labels describe them live. A world the community no longer has (taken down from
  // another device, or removed outright) is folded onto its link record as a tombstone, so the menu
  // offers 🌐 Publish instead of a dead-end ⛔ Unpublish and the publish panel stops answering "You
  // have no unpublished changes". Fire-and-forget, well past this page's first paint, and it
  // returns before opening a socket when we have nothing published.
  communityModule().then((m) => m.api.checkOwnListings()).catch(() => {});
  return () => { if (release) release(); closeSearchPop(); };
}

/* ---------- Adventures page ---------- */

// An adventure row's face, at the left of the entry. The portrait comes from the session INDEX's cached
// thumbnail (`s.avatar` — see storage.js), never from the save: a save can be megabytes and the list
// must not open one per row. A hero with no avatar of their own (or the stock placeholder) gets a
// monogram instead of the same stock face on every row — it still tells two heroes apart at a glance.
// Sized to the row's three-line text block (a title plus the two fact lines) so the face reads as the
// row's anchor rather than a badge beside it; the monogram scales with it.
const A_FACE_PX = 52;
function heroFaceHtml(portrait, name, size = A_FACE_PX) {
  const style = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.44)}px`;
  const p = String(portrait || "");
  if (!p || /portrait-placeholder/i.test(p)) {
    const ch = String(name || "").trim().charAt(0).toUpperCase() || "?";
    return `<div class="npc-portrait a-face-init" style="${style}">${esc(ch)}</div>`;
  }
  if (/^(data:|https?:|blob:)/i.test(p) || /\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i.test(p)) {
    return `<img class="npc-portrait" src="${esc(p)}" alt="" style="${style}">`;
  }
  return `<div class="npc-portrait" style="${style}">${esc(p)}</div>`;
}

// One adventure row, shared by every list of adventures — the Adventures page, the in-session panel
// (the rail's ⚔ Adventures) and a world popup's "Adventures in this world". `opts.current` marks the
// one you are in, `opts.onChange` re-renders the list after an action, and `opts.onDelete` overrides
// what a delete does (the panel has to leave a chat whose adventure was just removed); `onChange` is
// the fallback for both. `opts.face: false` drops the hero's portrait: the rail panel is ~300px at
// every window size, so the face there crowds the facts (and the monogram on a hero with no portrait
// was the louder half of the row) — the page and a world's popup keep it, where there is room.
function adventureRow(s, opts = {}) {
  const row = document.createElement("div");
  row.className = "sessionrow a-row" + (opts.current ? " current" : "");
  const face = opts.face !== false;
  const turns = s.turn || 0;
  const wname = s.worldName || worldNameForId(s.worldId);
  const unbound = !!s.worldId && !homeInstalledIds.has(s.worldId);
  const badges = [];
  if (s.gameOver) badges.push(`<span class="a-badge a-badge-dead" title="This adventure ended">☠ game over</span>`);
  if (unbound) badges.push(`<span class="a-badge a-badge-warn" title="The world this adventure was bound to isn't installed">⚠ unbound</span>`);
  row.innerHTML = `
    ${face ? `<div class="a-face" data-id="${esc(s.id)}">${heroFaceHtml(s.avatar, s.charName)}</div>` : ""}
    <div class="sess-name">
      <div class="sess-title">${esc(s.name || "Untitled adventure")}${badges.length ? " " + badges.join(" ") : ""}</div>
      <div class="sess-meta"><b>${esc(s.charName || "Unnamed")}</b>${turns ? ` · ${turns} turn${turns === 1 ? "" : "s"}` : " · new"}</div>
      <div class="sess-meta sess-meta-where">${wname ? `${WORLD_IC} ${esc(wname)} · ` : ""}${esc(fmtWhen(s.lastUpdated))}</div>
    </div>
    <button class="ld-wmore" title="Adventure actions">⋮</button>
    <div class="ld-wmenu" hidden>
      ${worldMenuItem("rename", "✎", "Rename")}
      ${worldMenuItem("dupe", "⧉", "Duplicate")}
      ${worldMenuItem("switch", "⇄", "Switch World")}
      ${worldMenuItem("export", ICON_EXPORT, "Download")}
      <div class="ld-wsep"></div>
      ${worldMenuItem("del", "✖", "Delete", { cls: "warn" })}
    </div>`;
  const doLoad = async () => {
    if (generating) { notify("⏳ The GM is still writing…"); return; }
    let loaded = null;
    try { loaded = await store.load(s.id); }
    catch (e) {
      if (isStorageError(e) || (e && e.isStorageUnavailable)) { notifyStorageError(notify, "reading", e); return; }
      throw e;
    }
    if (!loaded) return;
    let wid = null;
    try { wid = await chooseWorldForUnbound(loaded.worldId, loaded.worldName); }
    catch (e) {
      if (isStorageError(e) || (e && e.isStorageUnavailable)) { notifyStorageError(notify, "reading", e); return; }
      throw e;
    }
    if (!wid) return;
    if (wid !== loaded.worldId) {
      loaded.worldId = wid;
      try { await store.save(loaded, { touch: false }); }
      catch (e) {
        if (isStorageError(e) || (e && e.isStorageUnavailable)) notifyStorageError(notify, "saving", e);
        else throw e;
      }
    }
    // Floating (as before — nobody awaits a row click), then refresh the host panel if it asked:
    // the Menu's Adventures-in-this-world list re-renders so Currently Playing follows the switch.
    enterSession(loaded).then(() => { try { if (opts.onLoad) opts.onLoad(); } catch (e) {} })
      .catch((e) => {
        if (isStorageError(e) || (e && e.isStorageUnavailable)) notifyStorageError(notify, "reading", e);
        else { console.error("[adventure] open failed:", e); notify("✖ Couldn't open that adventure: " + (e.message || e), { ms: 5200 }); }
      });
  };
  row.addEventListener("click", doLoad);
  // ⋮ action menu (Rename / Duplicate / Switch World / Download / Delete) — the same control as a world
  // card's ⋮ menu, sharing its single-open tracker so only one menu is open at a time.
 const moreBtn = row.querySelector(".ld-wmore");
 const menu = row.querySelector(".ld-wmenu");
  const menuClose = () => { menu.hidden = true; try { menu.classList.remove("up"); } catch (e) {} if (openWorldMenu === menu) openWorldMenu = null; };
 moreBtn.addEventListener("click", (e) => {
   e.stopPropagation();
   if (!menu.hidden) { menuClose(); return; }
   closeWorldMenu();
   menu.hidden = false;
   openWorldMenu = menu;
    placeWorldMenu(menu);
 });
  menu.addEventListener("click", (e) => e.stopPropagation()); // never loads the adventure
  menu.querySelector('[data-act="rename"]').addEventListener("click", (e) => { e.stopPropagation(); menuClose(); renameSession(s.id, () => opts.onChange && opts.onChange()); });
  menu.querySelector('[data-act="export"]').addEventListener("click", async (e) => {
    e.stopPropagation(); menuClose();
    const full = await store.load(s.id);
    if (full) exportState(full);
  });
  menu.querySelector('[data-act="dupe"]').addEventListener("click", (e) => { e.stopPropagation(); menuClose(); duplicateSession(s.id, () => opts.onChange && opts.onChange()); });
  menu.querySelector('[data-act="switch"]').addEventListener("click", (e) => { e.stopPropagation(); menuClose(); switchSessionWorld(s.id, () => opts.onChange && opts.onChange()); });
  menu.querySelector('[data-act="del"]').addEventListener("click", async (e) => {
    e.stopPropagation(); menuClose();
    const ok = await ConfirmPopup.open({ title: "Delete Adventure", message: `Delete adventure '${s.name}'? This cannot be undone.`, confirmText: "Delete", danger: true });
    if (!ok) return;
    try { await store.remove(s.id); }
    catch (err) {
      if (isStorageError(err) || (err && err.isStorageUnavailable)) { notifyStorageError(notify, "deleting", err); return; }
      notify("✖ Couldn't delete that adventure: " + (err.message || err), { ms: 5200 });
      return;
    }
    const after = opts.onDelete || opts.onChange;
    if (after) after();
  });
  return row;
}

function worldGroupHeader(name, n) {
  const h = document.createElement("div");
  h.className = "a-group";
  h.innerHTML = `<span class="a-group-name">${WORLD_IC} ${esc(name || "Unknown world")}</span><span class="a-group-n">${n} adventure${n === 1 ? "" : "s"}</span>`;
  return h;
}

async function mountAdventuresPage(pane, ctx) {
  const ui = homeUI.adventures;
  // Group-by-world is a view preference, so it is read back from the last visit; the search, sort and
  // world filters stay per-visit like every other page's transient state.
  ui.group = advGroupPref();

  // ⚔ New Adventure — the same action as the Worlds page's ⚔ Begin Your Adventure (world picker when
  // more than one world is installed, then the character wizard), because this is the page you are on
  // when you want one more. The header is where it belongs. ⭱ Import Save stays the LAST button of the
  // row, the same
  // place the Worlds page keeps its ⭱ Import World.
  const newAdvBtn = document.createElement("button");
  newAdvBtn.type = "button";
  newAdvBtn.className = "hm-act hm-act-primary";
  newAdvBtn.textContent = "⚔ New Adventure";
  newAdvBtn.title = "Start a new adventure";
  newAdvBtn.onclick = () => beginNewAdventure();

  const impLabel = document.createElement("label");
  impLabel.className = "hm-act filebtn";
  impLabel.title = `Import a saved adventure (${SAVE_EXTENSION})`;
  impLabel.innerHTML = `${ICON_IMPORT} Import Save<input type="file" accept="${SAVE_EXTENSION}" hidden>`;
  impLabel.querySelector("input").onchange = (e) => doImport(e.target.files[0], e.target);
  ctx.actionsEl.append(newAdvBtn, impLabel);

  // The same toolbar every card page wears (search-bar.js). The page's one filter dimension is the
  // WORLD an adventure is bound to — it lives in the ⚙ panel with the same three-valued chips Worlds'
  // source/tag sections use. There is no state segment: an adventure's state is a badge on its row, not
  // a way anyone browses a shelf. Group by world is a switch of the page's own — right where the
  // ⊘ NSFW switch sits on Worlds.
  const barApi = searchBar({
    placeholder: "Search adventures…",
    query: ui.q,
    onQuery: (v) => { ui.q = v; rerender(); },
    sort: {
      options: ADVENTURE_SORTS,
      value: () => ui.sort,
      onPick: (id) => { ui.sort = id; rerender(); }
    },
    filters: {
      title: "Filter adventures by world",
      count: activeCount,
      body: renderWorldFilters,
      clearAll: () => clearWorldFilters()
    },
    toggles: [{
      label: "Group by world",
      short: "Group",
      plain: true,
      on: () => ui.group,
      set: (v) => { ui.group = v; persistAdvGroup(v); },
      onChange: () => rerender(),
      titleOn: "Grouped by world — click to list them flat",
      titleOff: "Listed flat — click to group by world"
    }]
  });
  const activeBar = document.createElement("div");
  activeBar.className = "hm-activebar";
  activeBar.hidden = true;
  const listWrap = document.createElement("div");
  listWrap.className = "hm-list";
  const foot = document.createElement("div");
  foot.className = "hm-foot";
  // The same privacy box the Worlds page ends with — one shared preference, so "Don't show this
  // again" on either page hides it on both; Settings → Interface is the way back.
  const privacyFoot = privacyFooterHidden() ? null : privacyFooterEl();
  pane.append(barApi.el, activeBar, listWrap, foot, ...(privacyFoot ? [privacyFoot] : []));

  let release = null;

  // Which world bucket an adventure belongs to, and what that bucket is called. An adventure whose world
  // isn't installed (deleted, unpublished, or a save with no world) is "Unbound" — the row already wears
  // the ⚠ badge for it, so the filter and the row agree.
  const keyOf = (s) => { const wid = s.worldId || ""; return homeInstalledIds.has(wid) ? wid : UNBOUND_KEY; };
  const labelOf = (k) => (k === UNBOUND_KEY ? "Unbound" : (worldNameForId(k) || k));

  function activeCount() { return ui.worlds.length + ui.worldsNot.length; }
  function clearWorldFilters() { ui.worlds = []; ui.worldsNot = []; rerender(); }

  // The ⚙ panel's body: one section, one entry per world that has adventures (plus Unbound). An ACTIVE
  // entry is always listed, even at 0 — requiring one world hides every other adventure and excluding one
  // hides its own, which would otherwise take away the very chip you'd use to undo it.
  function renderWorldFilters(ctn) {
    ctn.innerHTML = '<div class="hm-psec"><div class="hm-psech">World</div><div class="hm-popts" data-slot="worlds"></div></div>';
    const slot = ctn.querySelector('[data-slot="worlds"]');
    const tally = new Map();
    for (const s of homeSessions) { const k = keyOf(s); tally.set(k, (tally.get(k) || 0) + 1); }
    for (const k of [...ui.worlds, ...ui.worldsNot]) if (!tally.has(k)) tally.set(k, 0);
    const rank = (k) => (k === UNBOUND_KEY ? 0 : 1);
    const rows = [...tally.entries()]
      .sort((a, b) => rank(a[0]) - rank(b[0]) || b[1] - a[1] || labelOf(a[0]).localeCompare(labelOf(b[0])));
    if (!rows.length) {
      const none = document.createElement("span");
      none.className = "hm-pnone";
      none.textContent = "No adventures yet.";
      slot.appendChild(none);
    }
    for (const [k, n] of rows) {
      const label = labelOf(k);
      const state = ui.worlds.includes(k) ? "on" : ui.worldsNot.includes(k) ? "ex" : "";
      const tips = k === UNBOUND_KEY
        ? { main: "Only the adventures whose world isn't installed", x: "Hide the unbound adventures" }
        : { main: `Only adventures in ${label}`, x: `Exclude ${label}` };
      slot.appendChild(optionEl(label, n, state,
        () => { flipFilter(ui.worlds, ui.worldsNot, k); rerender(); },
        () => { flipFilter(ui.worldsNot, ui.worlds, k); rerender(); }, tips));
    }
  }

  // The applied world filters as removable pills under the bar — Worlds' row, same grammar.
  const renderFilterState = () => {
    barApi.refresh();
    const entries = [];
    for (const k of ui.worlds) entries.push({ label: labelOf(k), remove: () => { flipFilter(ui.worlds, ui.worldsNot, k); rerender(); } });
    for (const k of ui.worldsNot) entries.push({ label: labelOf(k), excluded: true, remove: () => { flipFilter(ui.worldsNot, ui.worlds, k); rerender(); } });
    renderActivePills(activeBar, entries, entries.length ? clearWorldFilters : null);
  };

  const filtered = () => {
    let list = homeSessions.slice();
    if (ui.worlds.length || ui.worldsNot.length) {
      list = list.filter((s) => {
        const k = keyOf(s);
        if (ui.worlds.length && !ui.worlds.includes(k)) return false;
        return !ui.worldsNot.includes(k);
      });
    }
    const q = ui.q.toLowerCase();
    if (q) list = list.filter((s) => {
      const hay = (String(s.name || "") + " " + String(s.worldName || worldNameForId(s.worldId) || "") + " " + String(s.charName || "")).toLowerCase();
      return hay.includes(q);
    });
    const byName = (a, b) => String(a.name || "").localeCompare(String(b.name || ""));
    const cmp = {
      recent: (a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0),
      oldest: (a, b) => (a.lastUpdated || 0) - (b.lastUpdated || 0),
      name: byName,
      turns: (a, b) => (b.turn || 0) - (a.turn || 0) || byName(a, b)
    };
    return list.sort(cmp[ui.sort] || cmp.recent);
  };

  const reloadSessions = async () => {
    homeSessions = await store.list();
    rebuildInstalledIds();
    updateHomeNavCounts();
    rerender();
  };

  function rerender() {
    renderFilterState();
    if (release) { release(); release = null; }
    const list = filtered();
    if (!list.length) {
      listWrap.innerHTML = "";
      // The same "nothing here" block as Worlds and Explore: this page's own emblem over one plain
      // line (the mark is what EMPTY_ADV_MARK cuts out of `icon-adventures.png`), directly on the page
      // rather than in a box — an empty shelf is an ordinary state. No action buttons: both of this
      // page's actions (⚔ New Adventure, ⭱ Import Save) are a few pixels above it in the header, so
      // repeating them here would be two buttons for one action, and that is exactly what Worlds and
      // Explore do — their headers carry the actions and the block says its one line.
      listWrap.appendChild(emptyStateEl(EMPTY_ADV_MARK, homeSessions.length ? "No adventures match those filters." : "No adventures yet."));
      foot.textContent = "";
      return;
    }
    const builders = [];
    if (ui.group) {
      // Grouped by the same bucket the filter offers (an installed world, or Unbound), so the header a
      // row sits under is exactly the chip that would show it. The buckets are walked in the order their
      // most relevant adventure holds in the current sort (so "Recently played" puts the world you just
      // played first) and each bucket's rows keep that same order — a bucket is CONTIGUOUS, which is the
      // whole point of grouping. (Before, a header was emitted whenever the world changed in the sorted
      // list, so any sort but a world-ordered one produced the same world's header over and over.)
      const buckets = new Map();
      for (const s of list) {
        const k = keyOf(s);
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k).push(s);
      }
      const order = new Map(list.map((s, i) => [s, i]));
      for (const [k, items] of [...buckets.entries()].sort((a, b) => order.get(a[1][0]) - order.get(b[1][0]))) {
        builders.push(() => worldGroupHeader(labelOf(k), items.length));
        for (const s of items) builders.push(() => adventureRow(s, { onChange: reloadSessions }));
      }
    } else {
      for (const s of list) builders.push(() => adventureRow(s, { onChange: reloadSessions }));
    }
    release = renderIncremental(ctx.main, listWrap, builders, { chunk: 40, moreLabel: "Show more adventures" });
    foot.textContent = `${list.length} adventure${list.length === 1 ? "" : "s"}`;
  }

  rerender();
  // Saves written before the index cached a face have no thumbnail (storage.js), so fill those in one
  // at a time in the background — the list has already painted with monograms, and each row swaps to its
  // real face as its thumbnail lands. Bounded per visit by `backfillAvatars`, and silent on failure: a
  // missing face is a cosmetic loss, never an error to shout about.
  store.backfillAvatars(homeSessions, (s, avatar) => {
    const el = listWrap.querySelector(`.a-face[data-id="${s.id}"]`);
    if (el) el.innerHTML = heroFaceHtml(avatar, s.charName);
  }).catch((e) => console.warn("[adventures] could not backfill faces:", e));
  return () => { if (release) release(); };
}

/* ---------- Explore page (community module owns the content) ---------- */
async function mountUserPage(pane, ctx) {
  const m = await import("./user-profile.js");
  const initial = homeUserTarget || homeRouteFromHash().target || "";
  const fallback = homeUserFallback || "";
  homeUserTarget = initial;
  homeUserRerender = (uid, fb) => m.showUserProfile(uid, fb !== undefined ? fb : homeUserFallback);
  if (initial && !userBackRelease) userBackRelease = pushUserEntry(userBackClose);
  syncHomeHash("user", initial, { force: true });
  await m.mountUserProfile(pane, ctx, initial, fallback);
  return () => { homeUserRerender = null; homeUserFallback = ""; try { m.closeUserProfile(); } catch (e) {} };
}

// Repaint the user page behind the Settings panel after the Identity section saves the public
// profile there, so going back shows the edit without a revisit.
function refreshUserPage() {
  if (homePage === "user" && homeUserRerender) homeUserRerender(homeUserTarget, homeUserFallback);
}
async function goUser(userId, username) {
  const uid = String(userId || "").replace(/^@+/, "").trim();
  // The username rides along as the fallback when the id no longer resolves (a stale forkOfUserId
  // on an old remix, a cleared identity, …): the profile page tries the id first, then this name.
  let fb = String(username || "").replace(/^@+/, "").trim();
  if (!fb || fb === uid) fb = "";
  homeUserFallback = fb;
  // A name-only link (no id on hand) resolves by name — the profile page already handles that path.
  if (!uid && fb) homeUserTarget = fb;
  else homeUserTarget = uid || fb;
  // From a session (a Tavern username tap, a detail panel's author button, an @mention — all
  // raised over the chat): the landing is hidden, so a direct setHomePage would mount the
  // profile invisibly behind the chat while the bar still moves — the "still in session" dead
  // end. Leave for the landing first (forget bridge: the session entry is given up without
  // popping, so Back from the profile re-enters this chat), exactly like the session's own
  // author and mention buttons used to do by hand. Refuses while the GM is writing, like
  // every other session exit.
  if (state) {
    const sid = state.id;
    if (!(await goToLanding({ forgetSession: true }))) return;
    userBackSession = sid;
  }
  if (homePage && homePage !== "user") userBackFrom = homePage;
  if (homePage !== "user") {
    // A forgotten world-detail entry may still be standing on top with the panel's `#explore/<id>`
    // URL (the panel gave it up without popping when the profile took over). Rewrite it to the
    // profile URL first, so a later Back never traverses onto the dead panel's link and reopens it.
    // The address names the user (`#user/SaucyMans`); the id stays the internal target.
    syncHomeHash("user", fb || uid);
    if (!userBackRelease) userBackRelease = pushUserEntry(userBackClose);
    setHomePage("user");
  }
  else if (homeUserRerender) homeUserRerender(homeUserTarget, homeUserFallback);
}

// Back from a profile returns to the page it was opened from (like leaving a chat returns to the
// landing) — or to the chat itself when the profile was a peek from the Menu (userBackSession).
// The history entry is already popped when this runs, so this only navigates. The bar moves to
// `#session` FIRST: the browser's own hashchange for this traversal is still queued behind the
// pop, and reading `#session` (no landing route) there makes the shell stand down instead of
// mounting the entry URL's page behind the chat.
async function userBackClose() {
  if (userBackSession) {
    // Keep userBackSession set until enterSession (or the gone-session fallback) resolves, so a
    // queued hashchange for this same pop can tell "bridge return in progress, popstate owns it".
    const sid = userBackSession;
    userBackRelease = null;
    syncHomeHash("session", "", { force: true });
    const sess = await store.load(sid);
    if (sess) { await enterSession(sess); return; }
    // The session is gone (deleted elsewhere) — fall through to the page return.
    userBackSession = null;
  }
  const dest = userBackFrom && userBackFrom !== "user" ? userBackFrom : "worlds";
  userBackRelease = null;
  setHomePage(dest);
}

// Consume the profile's history entry on a programmatic leave (nav row, another goUser target page).
// Goes through nav-history.js's forgetEntry: the shell's hash router owns page switches, and a
// traversal here would land on whatever entry is beneath (possibly the panel's forgotten one) and
// fight the navigation already underway. Safe to call when there is none.
function releaseUserBack() {
  userBackRelease = forgetEntry(userBackRelease);
}

/* ---------- Explore page (community module owns the content) ---------- */
async function mountExplorePage(pane, ctx) {
  const m = await communityModule();
  homeCommunity = m;
  await m.api.mountExplore(pane, { actionsEl: ctx.actionsEl, idEl: ctx.idEl });
  return () => { try { m.api.closeExplore(); } catch (e) { console.warn("[community] close failed", e); } };
}

// Discussion is a floating PANEL (popup), not a page: the nav row and the in-chat
// floating Tavern button open it over whatever is showing, like Settings and the Changelog. Toasts /
// browser notifications route back through the jump hook, so a reply toast opens the
// panel straight into its channel from anywhere.
async function openDiscussionPanel(channelId) {
  const m = await discussionModule();
  // Toasts / browser notifications can fire while another page (or a chat) is showing:
  // this hook routes their click back here first, then into the channel.
  m.setJumpHandler((ch) => {
    openDiscussionPanel(ch).catch(() => {});
  });
  await m.openDiscussionPanel(channelId);
}

/* ---------- Settings panel (identity + content settings + data & backup) ---------- */
// Settings is a POPUP, not a page (§6.16). It holds no content of its own: each section is drawn by
// the module that already implements it — the community layer's Identity and Content settings, and
// the backup module's Data & Backup (§6.15, moved here from the nav foot's 💾 button) — and every
// section arrives as a finished `<section>` element, so this panel only *arranges* them. Moving an
// element between the panel and back never rebuilds its contents or re-wires its controls.
//
// It is a popup rather than a page because of how it is reached: from the nav rail's util cluster, and
// from the Explore header's identity chip. Both are things you do *while* reading a page, and as a
// page Settings cost a navigation, a page header and a URL hash for a modal's worth of content, and it
// threw away the page you were on. As a popup it opens over that page and leaves it exactly where it
// was — which is also why it never touches `homePage` or the hash.
//
// The arrangement inside is unchanged: a master/detail — a rail of section names beside the selected
// section's card, one section on screen at a time. Below 760px the rail becomes a row of tabs above the
// card, and the popup's own body is the scroller (so the rail sticks within it, not within the page).
// Compared with stacking all three cards, the sections no longer compete for the eye — the Data &
// Backup card in particular stops looming over the two short ones — and the height stays that of one
// section rather than the sum of three.
//
// Deliberately four sections rather than one merged blob: Identity is what your published worlds are
// signed with, Content settings is what you'd rather not see, backup is what moves your data — three
// different jobs that happen to all live on this device — and Admin is a fourth thing entirely, an
// owner-only moderation tool that happens to be a device-local secret too (§6.16). What the first three
// shared is consolidated: the creator code and the restore-a-code flow exist once, in Identity.
let settingsPanel = null; // { select(id), close() } while the panel is open, else null

// Open the Settings popup at `section` ("identity" | "content" | "interface" | "imagegen" | "aimodel" | "backup" | "admin"). If it is already open,
// just switch to that section — so a second click on the nav row, or the Explore chip, is never a
// no-op. The popup is modal: Back (and Escape / the ✕ / a click on the scrim) closes it.
// Settings → Interface: how the app itself looks, kept per device. Today it is one row — the Worlds
// page's welcome banner, dismissed by the faded link inside it (`mno.worlds.welcome`), which would
// otherwise be a one-way door: once hidden, nothing on any page could bring it back. It lives in
// main.js rather than community.js's settings sections because the banner is main.js's; a future
// look-and-feel preference belongs in this section's shape.
// Settings → Interface: how the app itself looks, kept per device. Four rows — the Worlds
// page's welcome banner, the chat input tip, the Worlds page's privacy footer (each dismissed
// by the faded link inside it (`mno.worlds.welcome` / `mno.composer.tip` / `mno.privacy.footer`),
// which would otherwise be a one-way door: once hidden, nothing on any page could bring it back —
// and the scene image's instant button.
// They live in main.js rather than community.js's settings sections because all three are
// main.js's; a future look-and-feel preference belongs in this section's shape.
function interfaceSection() {  const sec = document.createElement("section");
  sec.className = "pf-sec pf-interface";
  sec.innerHTML = `
    <h3 class="pf-sec-title">Interface</h3>
    <p class="pf-hint">Preferences for how the app itself looks. They're saved in this browser.</p>
    <div class="pf-kv"><span class="pf-k">${infoTipLabelHtml("Fullscreen", "Whether the app fills the whole screen. Uses your browser's fullscreen mode — press Esc to exit.")}</span></div>
    <div class="pf-kv"><span class="pf-k">${infoTipLabelHtml("Welcome Banner", "Whether the welcome banner shows at the top of the Worlds page.")}</span></div>
    <div class="pf-kv"><span class="pf-k">${infoTipLabelHtml("Privacy notice", "Whether the privacy notice shows at the bottom of the Worlds and Adventures pages.")}</span></div>
    <div class="pf-kv"><span class="pf-k">${infoTipLabelHtml("Input Tip", "Whether the tip shows above the chat input.")}</span></div>
    <div class="pf-kv"><span class="pf-k">${infoTipLabelHtml("Instant Scene Image", "When on, the 🎨 button beside the chat input generates a scene image right away. When off, it opens the Scene Image panel instead. The ⋮ menu entry always opens the panel.")}</span></div>
    <div class="pf-kv"><span class="pf-k">${infoTipLabelHtml("Context Debug", "Whether the token counter shows in the top header of the chat — how much of the context the last turn spent.")}</span></div>`;
    // Same switch as the Tavern config panel's Floating-button row (same pref, same
    // helper): a second point of access where it belongs — with the other app look-and-feel prefs.
    sec.insertAdjacentHTML("beforeend",
      `<div class="pf-kv"><span class="pf-k">${infoTipLabelHtml("Floating Tavern Button", "Show the draggable Tavern button over every page, so the chat is one tap away anywhere.")}</span></div>`);
  // Fullscreen is live browser state, not a saved pref — the top row. The switch
  // follows `document.fullscreenElement` (so Esc exiting updates it too) via the
  // fullscreenchange listener, which removes itself once the panel is gone.
  const isFs = () => !!document.fullscreenElement;
  const fsSw = switchEl({
    on: isFs,
    set: (on) => {
      try {
        if (on) {
          if (document.fullscreenElement) return;
          const el = document.documentElement;
          const req = el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen ? el.webkitRequestFullscreen() : null;
          if (req && req.catch) req.then(() => notify("Fullscreen on. Press Esc to exit.")).catch(() => notify("✖ Couldn't enter fullscreen."));
          else if (!req) notify("Fullscreen on. Press Esc to exit.");
        } else {
          if (!document.fullscreenElement) return;
          const p = document.exitFullscreen ? document.exitFullscreen() : null;
          if (p && p.catch) p.then(() => notify("Fullscreen off.")).catch(() => notify("✖ Couldn't exit fullscreen."));
          else notify("Fullscreen off.");
        }
      } catch (e) { notify("✖ Fullscreen isn't available here."); }
    },
    text: isFs() ? "On" : "Off",
    plain: true,
    onChange: () => { fsSw.setLabel(isFs() ? "On" : "Off"); },
  });
  sec.querySelectorAll(".pf-kv")[0].appendChild(fsSw.el);
  const syncFsSw = () => {
    if (!sec.isConnected) { document.removeEventListener("fullscreenchange", syncFsSw); return; }
    try { fsSw.paint(); fsSw.setLabel(isFs() ? "On" : "Off"); } catch (e) {}
  };
  document.addEventListener("fullscreenchange", syncFsSw);
  const sw = switchEl({
    on: () => !welcomeHidden(),
    set: (on) => persistWelcomeHidden(!on),
    text: welcomeHidden() ? "Off" : "On",
    plain: true,
    // Tooltip policy (same as the Story panel): the label's static info-tip is the single source,
    // so every switch here stays titleless.
    onChange: () => {
      const hidden = welcomeHidden();
      sw.setLabel(hidden ? "Off" : "On");
      notify(hidden ? "Welcome banner hidden." : "Welcome banner is back on the Worlds page.");
      // The preference only changes what the Worlds page draws, and the page reads it as it mounts — so
      // if that page is the one showing (the popup floats over it), redraw it underneath.
      if (homePage === "worlds") setHomePage("worlds", { force: true });
    }
  });
  sec.querySelectorAll(".pf-kv")[1].appendChild(sw.el);
  const tipSw = switchEl({
    on: () => !composerTipHidden(),
    set: (on) => { persistComposerTipHidden(!on); applyComposerTipPref(); },
    text: composerTipHidden() ? "Off" : "On",
    plain: true,
    onChange: () => {
      const hidden = composerTipHidden();
      tipSw.setLabel(hidden ? "Off" : "On");
      notify(hidden ? "Input tip hidden." : "Input tip is back above the chat input.");
    }
  });
  sec.querySelectorAll(".pf-kv")[3].appendChild(tipSw.el);
  // Whether the 🎨 button beside the chat input generates immediately (on) or opens the Scene
  // Image panel (off). The ⋮ menu entry always opens the panel. Same global pref the panel's
  // amount/aspect use — this row just owns the one key the panel no longer shows.
  const instantSw = switchEl({
    on: () => scenePrefs().instant !== false,
    set: (on) => persistScenePrefs({ instant: on }),
    text: scenePrefs().instant !== false ? "On" : "Off",
    plain: true,
    onChange: () => {
      const instant = scenePrefs().instant !== false;
      instantSw.setLabel(instant ? "On" : "Off");
      notify(instant ? "Instant scene button on." : "The 🎨 button now opens the Scene Image panel.");
    }
  });
  sec.querySelectorAll(".pf-kv")[4].appendChild(instantSw.el);
  const privSw = switchEl({
    on: () => !privacyFooterHidden(),
    set: (on) => persistPrivacyFooterHidden(!on),
    text: privacyFooterHidden() ? "Off" : "On",
    plain: true,
    onChange: () => {
      const hidden = privacyFooterHidden();
      privSw.setLabel(hidden ? "Off" : "On");
      notify(hidden ? "Privacy notice hidden." : "Privacy notice is back at the bottom of the Worlds and Adventures pages.");
      // Same as the welcome banner: the page reads the pref as it mounts, so redraw it underneath.
      if (homePage === "worlds" || homePage === "adventures") setHomePage(homePage, { force: true });
    }
  });
  sec.querySelectorAll(".pf-kv")[2].appendChild(privSw.el);
  const ctxSw = switchEl({
    on: () => ctxDebugEnabled(),
    set: (on) => { persistCtxDebug(on); refreshCtxMeter(); },
    text: ctxDebugEnabled() ? "On" : "Off",
    plain: true,
    onChange: () => {
      ctxSw.setLabel(ctxDebugEnabled() ? "On" : "Off");
      notify(ctxDebugEnabled() ? "Context Debug on — the token counter is showing." : "Context Debug off.");
    }
  });
  sec.querySelectorAll(".pf-kv")[5].appendChild(ctxSw.el);
  // Floating button: same switch as the Tavern config panel's row (same pref,
  // same helper) — a second point of access with the other look-and-feel prefs.
  // (The Tavern's own Reply/New-message alert toggles live only in its config
  // panel.)
  const fabSw = switchEl({
    on: () => tavernFabEnabled(),
    set: (v) => { setTavernFabEnabled(v); },
    text: tavernFabEnabled() ? "On" : "Off",
    plain: true,
    onChange: () => {
      fabSw.setLabel(tavernFabEnabled() ? "On" : "Off");
      notify(tavernFabEnabled() ? "Floating Tavern button on." : "Floating Tavern button off.");
    }
  });
  sec.querySelectorAll(".pf-kv")[6].appendChild(fabSw.el);
  return sec;
}

// Settings → Image Gen: global image-generation preferences, kept per device.
// The rows live in image-provider.js's `imageProviderControls()` (provider switch,
// Perchance guidance, remote key/model); they are spread straight into the section
// so each is a direct `.pf-sec` flex item with the same gaps as AI Model.
function imageGenSection() {
  const sec = document.createElement("section");
  sec.className = "pf-sec";
  sec.innerHTML = `
    <h3 class="pf-sec-title">Image Gen</h3>
    <p class="pf-hint">Global image-generation settings. Apply to every image this app generates. Perchance is the basic free model.</p>`;
  sec.append(...imageProviderControls({ notify }).childNodes);
  return sec;
}

// `section` is the section to open on, or null/omitted for "no particular one". Both land on the same
// place on desktop (the first section, Identity, as before); on a phone the difference is the whole
// point — a named section opens its card, no section leaves you on the section list to choose from
// (see the drill-down below). Only the home nav's Settings item opens without one.
function openSettingsPanel(section = null) {
  if (settingsPanel) { settingsPanel.select(section); return; }

  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";
  overlay.innerHTML = `
    <div class="popup settings-pop" tabindex="-1">
      <div class="popup-head">
        <span class="popup-title">Settings</span>
        <button class="popup-x" title="Close" aria-label="Close">✕</button>
      </div>
      <div class="set-body">
        <div class="pf-md">
          <nav class="pf-md-nav" aria-label="Settings sections"></nav>
          <button type="button" class="mini pf-md-back">${ICON_BACK_CHEV} Back</button>
          <div class="pf-md-panel"><div class="set-loading"><span class="spin spin-sm"></span> Loading…</div></div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const box = overlay.querySelector(".settings-pop");
  const scroller = overlay.querySelector(".set-body");
  const nav = overlay.querySelector(".pf-md-nav");
  const panel = overlay.querySelector(".pf-md-panel");

  // Below the rail breakpoint the sections are a one-pane drill-down, like the world editor's split
  // (README §6.9): the LIST fills the panel, tapping a section opens it behind the compact `‹ Back`
  // pill (the world editor's own control, `.pf-md-back`), and the two panes are never on screen
  // together — so `.set-body` stays the only scroller.
  // The panel is raised on the list unless a section was actually asked for. `listScroll` remembers the
  // list's offset so Back returns to it. Above the breakpoint the class is inert and both panes show
  // (see the `max-width: 759.98px` block in styles.css).
  const mdBox = overlay.querySelector(".pf-md");
  const backToNav = () => { mdBox.classList.remove("pf-md-drill"); scroller.scrollTop = listScroll; };
  let listScroll = 0;
  const showSection = () => {
    // Only remember the list's offset when we are actually leaving it.
    if (!mdBox.classList.contains("pf-md-drill")) listScroll = scroller.scrollTop;
    mdBox.classList.add("pf-md-drill");
    scroller.scrollTop = 0; // a section always opens at its own top
  };
  overlay.querySelector(".pf-md-back").onclick = backToNav;

  let closed = false;
  // AI Model / Image Gen persist on every input (no Save step); the only gate is
  // here: a keyless remote provider blocks closing until a key is entered or
  // Perchance is re-picked. Jumps to the offending section so the key field is
  // right there. Back-close re-pushes while this returns false (see back-close.js).
  const guardProviderClose = async () => {
    let block = null;
    let sectionId = null;
    try { block = aiCloseBlocker(); if (block) sectionId = "aimodel"; } catch (e) {}
    if (!block) { try { block = imageCloseBlocker(); if (block) sectionId = "imagegen"; } catch (e) {} }
    if (!block) return true;
    try { if (applySelect) await applySelect(sectionId); } catch (e) {}
    // Blocking info must not be a toast (too easy to miss): a modal popup over
    // the panel, with a one-click way out that reverts to Perchance AI.
    const usePerchance = await ConfirmPopup.open({
      title: "API key missing",
      message: "You selected " + block.label + " for " + block.section + ", but no API key is saved for it. Without a key the app would silently keep using Perchance AI.",
      confirmText: "Use Perchance AI instead"
    });
    if (usePerchance) {
      try {
        if (sectionId === "aimodel") {
          const cur = getAiConfig();
          saveAiConfig({ provider: "perchance", allowReasoning: cur.allowReasoning, thinkingBudget: cur.thinkingBudget, customParams: cur.customParams });
          try { window.dispatchEvent(new Event("mno:aimodel-changed")); } catch (e) {}
        } else {
          saveImageConfig({ provider: "perchance" });
          try { window.dispatchEvent(new Event("mno:imagegen-changed")); } catch (e) {}
        }
      } catch (e) {}
      return true;
    }
    try {
      const keyEl = panel.querySelector(sectionId === "aimodel" ? ".pf-ai-key" : ".pf-img-key");
      if (keyEl) { keyEl.focus({ preventScroll: true }); keyEl.scrollIntoView({ block: "nearest" }); }
    } catch (e) {}
    return false;
  };
  const tryClose = async () => {
    if (closed) return true;
    if (!(await guardProviderClose())) return false;
    close();
  };
  const tryForget = async () => {
    if (closed) return true;
    if (!(await guardProviderClose())) return false;
    closeForget();
  };
  const release = pushBackClose(() => tryClose());
  const close = () => {
    if (closed) return;
    closed = true;
    release();
    overlay.remove();
    settingsPanel = null;
    for (const s of secsBuilt) s.dispose?.(); // e.g. the Admin section drops the closed panel's repaint hook (the session itself survives)
  };
  let applySelect = null; // set once the sections have been built (below)
  let wanted = section;   // the section asked for before then
  const secsBuilt = [];   // the built section descriptors (so close() can run their dispose)
  // Take the panel down giving its history entry up WITHOUT popping it — for a control inside the
  // panel that navigates away (Identity's Visit profile): a plain close() would schedule a
  // history.back() whose delayed traversal lands after the new page mounts and tears it down.
  const closeForget = () => {
    if (closed) return;
    closed = true;
    release.forget();
    overlay.remove();
    settingsPanel = null;
    for (const s of secsBuilt) s.dispose?.();
  };
  const select = (id) => { if (!id) return; wanted = id; if (applySelect) applySelect(id); };

  overlay.querySelector(".popup-x").onclick = () => { tryClose(); };
  overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) tryClose(); });
  overlay.addEventListener("keydown", (e) => { if (e.key === "Escape") tryClose(); });
  settingsPanel = { select, close: tryClose, forget: tryForget };
  box.focus();

  // Sections load lazily: the nav draws immediately so every section stays reachable while a
  // slow one (Identity reads the profile over the network) still loads. Only the panel shows a
  // spinner — never the whole popup.
  let modCache = null;
  const getMods = () => (modCache || (modCache = Promise.all([communityModule(), backupModule()]).then(([m, b]) => ({ m, b }))));
  getMods().catch(() => {});
  const secs = [
    { id: "identity", title: "Identity", load: (mods) => mods.m.api.identitySection() },
    { id: "content", title: "Content settings", load: (mods) => mods.m.api.contentSettingsSection() },
    // Chrome preferences need no module of their own: the section is main.js's.
    { id: "interface", title: "Interface", load: () => interfaceSection() },
    { id: "aimodel", title: "AI Model", load: () => aiModelSection() },
    { id: "imagegen", title: "Image Gen", load: () => imageGenSection() },
    { id: "backup", title: "Data & Backup", load: (mods) => mods.b.backupSection() },
    // Admin is the one section you cannot simply switch to: `ensure` is the password gate, and the
    // rail button goes through it like every other way in. Declining the password leaves the panel
    // on the section it was already showing.
    { id: "admin", title: "Admin", faded: true, load: (mods) => mods.m.api.adminSection(),
      ensure: (mods) => mods.m.api.adminEnsure(), dispose: () => modsRef?.m.api.adminSectionClosed() },
  ];
  secsBuilt.push(...secs);
  let modsRef = null;
  getMods().then((mods) => { modsRef = mods; }).catch(() => {});
  const btns = new Map();
  let selectToken = 0;
  // `drill` is only ever false for the open-without-a-section case below: a tap on the list, the
  // identity chip and Admin's gate all ask for a section and so open it.
  applySelect = async (id, drill = true) => {
    const sec = secs.find((s) => s.id === id) || secs[0];
    const my = ++selectToken;
    if (sec.ensure) {
      // A section may gate itself (Admin's password). A gate that fails or throws must leave the panel
      // exactly as it was — never a blank card and never an unhandled rejection.
      let ok = false;
      try { ok = await sec.ensure(modsRef || await getMods()); }
      catch (e) { console.warn("[settings] section gate failed", e); notify("✖ " + (e.message || e)); }
      if (!ok || closed || my !== selectToken) return;
    }
    if (closed || my !== selectToken) return; // the panel was closed while the gate was up
    for (const [sid, btn] of btns) {
      const on = sid === sec.id;
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-current", on ? "true" : "false");
    }
    if (sec.el) {
      panel.replaceChildren(sec.el);
    } else {
      // Slow section still loading: spinner in the panel only — the nav stays usable.
      panel.innerHTML = `<div class="set-loading"><span class="spin spin-sm"></span> Loading…</div>`;
      if (!sec.loading) {
        sec.loading = (async () => {
          const el = await sec.load(await getMods());
          sec.el = el;
          return el;
        })().catch((e) => {
          sec.loading = null;
          throw e;
        });
      }
      try {
        const el = await sec.loading;
        if (closed || my !== selectToken) return;
        panel.replaceChildren(el);
      } catch (e) {
        console.warn("[settings] section failed to build", e);
        if (!closed && my === selectToken) panel.innerHTML = `<div class="hm-empty">✖ Couldn't load ${esc(sec.title)}: ${esc(e.message || e)}</div>`;
        return;
      }
    }
    // Reached only once a section's gate (Admin's password) has passed, so a declined gate leaves
    // the list on screen instead of drilling into a card that never opened.
    if (drill) showSection();
    else scroller.scrollTop = 0; // no section asked for: stay on the list, at its top
  };
  for (const s of secs) {
    const btn = document.createElement("button");
    btn.type = "button";
    // `faded` (Admin): a quiet rail entry for the owner-only tool behind the password gate, so it
    // never competes with the everyday sections (§6.16).
    btn.className = "pf-md-btn" + (s.faded ? " pf-md-faded" : "");
    btn.textContent = s.title;
    btn.addEventListener("click", () => applySelect(s.id));
    nav.appendChild(btn);
    btns.set(s.id, btn);
  }
  applySelect(wanted, !!wanted);
}

// Take the Settings panel down giving its entry up WITHOUT popping it — the bridge for a control
// inside the panel that navigates away (Identity's Visit profile opens the user page).
function closeSettingsPanel() {
  try { if (settingsPanel && settingsPanel.forget) settingsPanel.forget(); } catch (e) {}
}

async function goToLanding({ forgetSession = false, keepSession = false } = {}) {
  if (generating) { notify("⏳ The GM is still writing…"); return false; }
  if (state) {
    try { await store.save(state, { touch: false }); }
    catch (e) {
      if (isStorageError(e) || (e && e.isStorageUnavailable)) {
        console.warn("[adventure] exit autosave failed:", (e && e.message) || e);
        notifyStorageError(notify, "saving", e);
      } else throw e;
    }
  }
  collapseRails();
  cancelMapBuild();
  state = null;
  try { await store.setActive(null); } catch (e) { /* pointer is a nicety */ }
  // `forgetSession` is the bridge for the Menu's author → profile peek: the session entry is
  // given up WITHOUT popping it, so no programmatic back() can race the profile's own push —
  // Back from the profile lands back on the session entry. `keepSession` is the Menu grid's
  // bridge: the session entry is left standing (neither popped nor forgotten) behind the
  // landing, rewritten to the new page's URL by the mount — Back pops it and re-enters the
  // chat. A plain pop would restore the chat-opener page's URL and the hash router would mount
  // THAT over the requested page. Everywhere else the entry is consumed as before. Leaving via
  // goToLanding while a grid bridge is pending cancels it (the entry is forgotten, not popped,
  // so we stay on the landing instead of traversing away).
  if (keepSession) {
    // Leave the session entry standing behind the landing; the caller stashes the return id.
  } else if (menuReturnSession) {
    menuReturnSession = null;
    sessionBackRelease = forgetEntry(sessionBackRelease);
  } else if (forgetSession) {
    sessionBackRelease = forgetEntry(sessionBackRelease);
  } else releaseSessionBack();
  let sessions = [];
  try { sessions = await store.list(); }
  catch (e) {
    if (isStorageError(e) || (e && e.isStorageUnavailable)) {
      console.warn("[home] session list unreadable (storage unavailable):", (e && e.message) || e);
      notifyStorageError(notify, "reading", e);
    } else throw e;
  }
  await renderLanding(sessions);
  return true;
}

// The session's Back-button handler. In an open chat it returns to the landing — except while
// the GM is mid-write (goToLanding returns false, so the helper keeps the entry and Back stays
// "armed"). On a Menu-grid landing (state null, grid bridge pending) the popped entry IS the
// session's own, so re-enter the stashed chat instead: the bar moves to `#session` FIRST, for
// the same queued-hashchange reason as the profile return (see userBackClose).
async function sessionBackClose() {
  if (!state && menuReturnSession) {
    // Keep menuReturnSession set until enterSession (or the gone-session fallback) resolves, so a
    // queued hashchange for this same pop can tell "bridge return in progress, popstate owns it"
    // and stand down instead of double-mounting behind the chat.
    const sid = menuReturnSession;
    sessionBackRelease = null; // our entry was popped
    syncHomeHash("session", "", { force: true });
    let sess = null;
    try { sess = await store.load(sid); }
    catch (e) {
      if (isStorageError(e) || (e && e.isStorageUnavailable)) { notifyStorageError(notify, "reading", e); return goToLanding(); }
      throw e;
    }
    if (sess) {
      try { await enterSession(sess); return; }
      catch (e) {
        if (isStorageError(e) || (e && e.isStorageUnavailable)) { notifyStorageError(notify, "reading", e); return goToLanding(); }
        throw e;
      }
    }
    // The session is gone (deleted elsewhere) — fall through to a plain landing.
    return goToLanding();
  }
  return goToLanding();
}

// Consume the session's history entry (programmatic leave — brand click, Back, "Back to World
// Selection"). Goes through nav-history.js's popEntry. Safe to call when no session entry exists.
function releaseSessionBack() {
  sessionBackRelease = popEntry(sessionBackRelease);
}

async function enterSession(sess) {
  try {
    await ensureWorldBound(sess.worldId || defaultWorld.meta.id);
  } catch (e) {
    if (isStorageError(e) || (e && e.isStorageUnavailable)) {
      console.warn("[session] world bind skipped (storage unavailable):", (e && e.message) || e);
      applyWorld(defaultWorld);
    } else throw e;
  }
  cancelMapBuild();
  state = normalize(sess);
  // The world it belongs to, by name, is kept on the session from here on: a world can be removed
  // from the library later, and this is the only thing about it the save can still name (it is what
  // `chooseWorldForUnbound` shows). Saves written before this field existed pick it up here.
  let dirty = false;
  if (currentWorldName && state.worldName !== currentWorldName) { state.worldName = currentWorldName; dirty = true; }
  // A save written before lazy archives stores each never-re-rolled reply twice — drop those
  // archives on open and persist the shrink once, so an existing file actually gets smaller.
  if (compactVersionArchives(state)) dirty = true;
  if (dirty) {
    try { await store.save(state, { touch: false }); }
    catch (e) {
      if (isStorageError(e) || (e && e.isStorageUnavailable)) {
        console.warn("[session] open autosave failed (storage unavailable):", (e && e.message) || e);
        notifyStorageError(notify, "saving", e);
      } else throw e;
    }
  }
  // A world's NPC tracker defs can change between sessions (a key renamed or removed in the editor).
  // One idempotent pass drops values whose def no longer exists, so a re-added key starts clean
  // instead of resurrecting stale numbers — see README §6.3.1.
  purgeNpcTrackerKeys(state, npcTrackerDefs);
  try { await store.setActive(state.id); }
  catch (e) { /* pointer is a nicety — a low-space device still plays, it just won't auto-resume */ }
  // Opening a session from a Menu-grid landing consumes that bridge: the old entry (which owns
  // the landing URL) is forgotten so this chat pushes fresh — Back returns to the landing, not
  // the older chat. (Back-driven returns null the flag before calling, so this only runs for
  // UI-driven opens.)
  if (menuReturnSession) {
    menuReturnSession = null;
    sessionBackRelease = forgetEntry(sessionBackRelease);
  }
  if (!sessionBackRelease) {
    sessionBackRelease = pushSessionEntry(sessionBackClose);
  }
  const active = state;
  renderFollowTail = true;
  renderWindowStart = 0;
  // Repair sightings corrupted by the old bump-all path (edits/version-switches stamped every NPC
  // with the latest turn, feeding wrong Present dossiers). Recomputes from the shown transcript
  // only; hidden-version-only speakers demote to -1 (not in shown story). Silent on open (no
  // toasts); persists without touching last-edit time. Runs before first render so the panel and
  // the next GM context start correct. Async profile/portrait builds for newly created visible
  // cast entries report through the same backfill-style callback below.
  try {
    const rep = npcSys.rebuildSightings(state, () => {
      if (state !== active) return;
      render();
      refreshRailIfOpen("right");
      store.save(state, { touch: false }).catch((e) => {
        if (isStorageError(e) || (e && e.isStorageUnavailable)) notifyStorageError(notify, "saving", e);
        else console.warn("[npc] background save failed:", e);
      });
    });
    if ((rep.created && rep.created.length) || (rep.demoted && rep.demoted.length)) dirty = true;
  } catch (e) { console.warn("[npc] rebuild on open failed", e); }
  if (dirty) {
    try { await store.save(state, { touch: false }); }
    catch (e) {
      if (isStorageError(e) || (e && e.isStorageUnavailable)) notifyStorageError(notify, "saving", e);
      else throw e;
    }
  }
  applyRailPref();
  $("landing").hidden = true;
  $("app").hidden = false;
  // The chat owns the bar while open (`#session` carries no landing route, so deep links and the
  // hash router ignore it — and a reload still boots the active session). A session return is
  // consumed by arriving here. No home page is current while chatting (`homePage = null`): the
  // shell's guards read it (hash routing, forwarded hashes, per-page hash syncs), so a late
  // landing write — e.g. an in-flight profile resolving its username — can't repaint the bar
  // or mount into the hidden pane behind the chat.
  userBackSession = null;
  menuReturnSession = null;
  homePage = null;
  syncHomeHash("session");
  render();
  dismissBootSplash();
  if (state.messages.length) maybeRefreshMap();
  npcSys.backfill(state, () => {
    if (state !== active) return;
    render();
    refreshRailIfOpen("right");
    store.save(state, { touch: false }).catch((e) => {
      if (isStorageError(e) || (e && e.isStorageUnavailable)) notifyStorageError(notify, "saving", e);
      else console.warn("[npc] backfill save failed:", e);
    });
  });
  if (!state.messages.length) await startNewSession();
  refreshCtxMeter();
  // Semantic retrieval warmup (never blocks entering): embed this session's
  // working set in the background so later turns rank hybrid BM25+cosine;
  // early turns simply run BM25 until vectors land. The weekly vector sweep
  // rides along here too (LRU-cap + age + stale-model eviction).
  try {
    const loreTexts = (engine && engine.loreEntries ? engine.loreEntries : []).map((e) => loreDocText(e));
    const memTexts = [...(state.memories?.manual || []), ...(state.memories?.auto || [])].map((m) => memoryDocText(m, state.character?.name || ""));
    const npcTexts = [
      ...Object.values(state.npcs || {}).flatMap((n) => npcSemanticFields(n)),
      ...((engine && engine.worldNpcs ? engine.worldNpcs : []).flatMap((n) => npcSemanticFields(n)))
    ];
    warmupSessionVectors({ lore: loreTexts, memories: memTexts, npcs: npcTexts });
    sweepVectorsIfDue();
  } catch (e) { /* warmup never breaks entering */ }
}

/* ---------- NSFW filter (Worlds page + world picker) ---------- */
// Worlds tagged `nsfw` (see world.js) are hidden unless the reader turns the toolbar's ⊘ switch on.
// That switch, and the single per-device preference behind it, belong to the shared toolbar
// (search-bar.js's `showNsfw`/`setShowNsfw`) — Worlds, Explore and the world picker below all read the
// same one, so the answer never differs from page to page. Default OFF.

// Does the NSFW filter hide this world? (Takes the card/`meta` shape, bundled or from the store.)
function nsfwHidden(meta) { return !showNsfw() && isNsfwMeta(meta); }

// The ⊘ preference can also be flipped from Settings → Content settings (community.js's section),
// where there is no toolbar standing by to repaint itself. This is Worlds' half of that fix-up: with
// the adult worlds hidden again, a `nsfw` REQUIRE filter can never match anything, so it is dropped
// (the same rule the toolbar's own switch applies); then, if Worlds is the page behind the popup, it
// is remounted so its ⊘ switch and grid show the new answer. Explore's half lives in community.js.
function applyNsfwPref() {
  if (!showNsfw()) homeUI.worlds.tags = homeUI.worlds.tags.filter((t) => String(t).toLowerCase() !== NSFW_TAG);
  if (homePage === "worlds") setHomePage("worlds", { force: true });
}

// A tag chip in a world detail panel is a shortcut into the Worlds page's own tag filter: clicking it
// asks for "worlds tagged X". The filter is set FRESH — sources, exclusions, the author and the search
// box cleared, the tag REQUIRED — so the result is exactly that tag's worlds and never an empty list the
// clicker can't explain (a leftover `✎ My World` filter would hide a public world's own tag). The two
// markers are part of the same gesture: an `nsfw` chip turns the ⊘ switch on (they just asked to see an
// adult world), which is also what makes requiring `nsfw` mean anything (see mountWorldsPage).
function filterWorldsByTag(tag) {
  const t = String(tag || "").trim();
  if (!t) return;
  if (String(t).toLowerCase() === NSFW_TAG) setShowNsfw(true);
  resetWorldFilters();
  homeUI.worlds.tags = [t];
  setHomePage("worlds", { force: true });
}

// The author line's `more` (copied from Explore, where it's the 👤 chip) is the same kind of shortcut:
// "worlds by @ann". Also FRESH, for the same reason — and the author is remembered as BOTH the name and
// the id behind it, so the filter can match a renamed author exactly (see `inAuthor`).
function filterWorldsByAuthor(name, id) {
  const n = String(name || "").trim();
  const i = String(id || "").trim();
  if (!n && !i) return;
  resetWorldFilters();
  homeUI.worlds.author = { name: n, id: i };
  setHomePage("worlds", { force: true });
}

// Clear every Worlds filter (the shortcuts above start from nothing rather than stacking onto whatever
// was applied, so a click always lands on results). "Clear all" in the toolbar calls this too.
function resetWorldFilters() {
  const ui = homeUI.worlds;
  ui.q = ""; ui.scroll = 0;
  ui.sources = []; ui.sourcesNot = [];
  ui.tags = []; ui.tagsNot = [];
  ui.author = null;
}

// One landing world card. `meta` is a world's meta; `bundled` is the canonical World for a
// bundled world (shown ✦ MNO, never editable in place) or null for a user library world (whose
// full content is loaded lazily, only when an action needs it).
// Clicking the thumbnail opens the world detail popup; the ⋮ menu on the cover holds Edit /
// Duplicate / Download / Share / Delete.
let openWorldMenu = null; // the currently open ⋮ menu (.ld-wmenu), if any
function closeWorldMenu() {
  if (openWorldMenu) {
    openWorldMenu.hidden = true;
    try { openWorldMenu.classList.remove("up"); } catch (e) {}
    openWorldMenu = null;
  }
}
// After unhiding a ⋮ menu, flip it upward only when that actually clips LESS. On a short host
// (an adventure row) the flipped menu grows up into visible space; on a tall host (a world card,
// whose menu already sits inside the card) flipping re-anchors to the card's bottom edge, which is
// FURTHER down — so a world card at the bottom keeps its dropped-down menu. The `.up` rule
// re-anchors the menu to the host's bottom edge; this keeps whichever of the two positions spills
// less past the viewport (ties keep the dropped-down default).
function placeWorldMenu(menu) {
  try {
    menu.classList.remove("up");
    const vh = window.innerHeight || 0, m = 8;
    const spill = (r) => Math.max(0, r.bottom - (vh - m)) + Math.max(0, m - r.top);
    const down = spill(menu.getBoundingClientRect());
    if (down <= 0) return; // fits dropping down — leave it
    menu.classList.add("up");
    const up = spill(menu.getBoundingClientRect());
    if (up >= down) menu.classList.remove("up"); // flipped is no better — keep it dropped down
  } catch (e) {}
}
document.addEventListener("click", (e) => {
  if (openWorldMenu && !e.target.closest(".ld-wmenu") && !e.target.closest(".ld-wmore")) closeWorldMenu();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeWorldMenu(); });

// Tag chips — the special markers first (the dark-red `nsfw` rating, the dark-purple `remix`
// provenance), then the author's own tags; the row's one-line clip can never hide the markers
// because they lead it. The rendering itself is shared with Explore in tag-row.js (so a world reads
// identically on every card); `remixTitle` lets a caller pass the richer "remix of X by @Y" tooltip
// when it knows the original, and `clickable` makes each chip a tag-filter shortcut (the world detail
// panel, whose chips jump into the Worlds page's filters — see filterWorldsByTag).
function tagChips(tags, nsfw, remix, remixTitle, clickable) {
  return tagChipsHtml(tags, { nsfw, remix, remixTitle, clickable });
}

// The tooltip for a card's `remix` chip when the provenance is on hand (a local world's
// `meta.remix`), e.g. `Remix of "The Sunken Crown" by @Lyrra Voss`.
function remixTip(remix) {
  if (!remix) return "";
  const who = remix.author ? ` by @${remix.author}` : "";
  return remix.name ? `Remix of "${remix.name}"${who}` : "";
}

// Fork provenance in the card meta's `remix` shape, built from a catalog/library record's own fork
// fields (`forkOf*`, set when the world was published as a fork of another) — the fallback for a
// world whose downloaded file isn't available. Null when the record isn't a fork.
function remixFromRec(rec) {
  if (!rec || !rec.forkOfWorldId) return null;
  return { worldId: rec.forkOfWorldId, name: rec.forkOfTitle || "", userId: rec.forkOfUserId || "", author: rec.forkOfAuthor || "", at: "" };
}

// One world card. `meta` is a world's meta; `bundled` is the canonical World for a bundled world
// (shown ✦ MNO, never editable in place) or null for a user library world (whose full content is
// loaded lazily, only when an action needs it).
// `opts.source` (bundled|mine|imported|added) drives the provenance line at the very bottom of the card (the
// footer), and `opts.link` is that world's catalog link record (if it has ever been published), so
// the footer can also say whether it's currently live. The whole card opens the world detail popup
// (Play / Continue + this world's adventures); the ⋮ menu on the cover holds Edit, Duplicate, the
// world's community entry (see `worldMenuCommunityEntries`), Download, Share (External) and Delete.
// The title row holds the name and nothing else — the card is narrow, so a chip beside the title
// steals width from it. Where a world came from (and what needs attention about a saved copy) rides
// on ONE quiet ruled-off line at the very bottom of the card instead (see `worldNote`), and the fork
// provenance / catalog version / saved-adventure count live only in the details popup.
// `opts.icon` is optional markup that leads the line — a page mark (`.w-ic` / `.ex-ic`), e.g. the Explore
// emblem on a note that says `Public` — inserted raw while the text stays escaped.
function worldNote(text, opts = {}) {
  const cls = opts.kind ? ` ld-wnote-${opts.kind}` : "";
  return `<div class="ld-wnote${cls}"${opts.title ? ` title="${esc(opts.title)}"` : ""}>${opts.icon || ""}${text ? `<span class="ld-wnote-tx">${esc(text)}</span>` : ""}</div>`;
}

// A world card's provenance line (the bottom line). Always emitted — an empty box when there's
// nothing to say — so the description and tag row above it land at the same offset on every card of
// a grid row (see `.ld-wnote`).
//
// The wording says plainly where the world came from, and for one of your own that has been
// published it also states the catalog's view of it. Deliberately no icon on the status half: the
// source half already wears one, and a second glyph beside it read as clutter (and as a different
// kind of badge). The world's catalog id is never printed — it's an implementation detail, and the
// listing is named by its title everywhere else in the UI.
function sourceNote(source, link, meta) {
  if (source === "bundled") return worldNote("✦ Bundled", { title: "Ships with the engine" });
  if (source === "added") return worldNote(PUBLIC_LABEL, { icon: EXPLORE_IC, title: "A public world you added — you play your saved copy" });
  if (source === "mine" || source === "imported") return localWorldNote(link, meta);
  return worldNote("");
}

// One row of a world's ⋮ menu. The icon gets its OWN fixed-width column rather than living inside the
// label's text: emoji glyphs vary in width (⧉ is a narrow text glyph, 🌐/⛔ are full-width colour
// emoji), so a plain "✏️ Edit" text node leaves every row's label starting at a slightly different x.
// With `.ld-wicon` as a fixed 18px column the icon glyphs centre on one x and every `.ld-wtx` label
// starts on another (see styles.css). Every ⋮ menu goes through here — this file's card menu AND
// community.js's added-world menu (which reaches it through `mnoApp`) — so both line up identically.
// `opts.cls` adds a button class (`warn` for destructive rows); `opts.hidden` starts a row hidden
// (the added-card menu's Retry/Update rows only apply to some records).
function worldMenuItem(act, icon, text, opts = {}) {
  const cls = opts.cls ? ` class="${opts.cls}"` : "";
  const hidden = opts.hidden ? " hidden" : "";
  return `<button data-act="${act}"${cls}${hidden}><span class="ld-wicon">${icon}</span><span class="ld-wtx">${text}</span></button>`;
}

// The ⋮ menu's community entries for one of your own worlds, labelled for what would actually happen
// to it — 🌐 Publish while it isn't out yet, 🌐 Publish Changes when it's live and has moved on since
// the last push, ⛔ Unpublish while it's live, and ⚑ Appeal only when the COMMUNITY has hidden it after
// reports (a moderator's hide isn't the author's to reverse) — reading ⚑ Appeal Pending while that
// appeal is still counting down. Each entry opens the panel for ITS own action: the publish panel
// (`openCommunityMenu` — the explanation, the version and the confirmation), the unpublish panel, or
// the appeal panel. 🔗 Copy link rides here too — only a LIVE world has a catalog id to make a link
// from (community.js's `copyWorldLink`). Order: publish changes, appeal, unpublish, copy link.
function worldMenuCommunityEntries(meta, link) {
  const live = !!(link && link.status !== "removed");
  const hidden = live && (link.hidden === true || link.status === "hidden");
  const appealable = hidden && String((link && link.hiddenReason) || "reports") !== "admin";
  const appealPending = appealable && Number(link.reinstatesAt) > Date.now();
  // The label has to be decided while the card is being built, so it leans on the cheap signal rather
  // than the real diff: every save stamps `meta.updatedAt` and every push stamps the link's own
  // `updatedAt`, so a live world saved after its last push is the only one that *can* have something
  // waiting. The panel runs the comparison for real, and says so if there turns out to be nothing.
  const savedSincePush = live && (Date.parse(meta.updatedAt || "") || 0) > (Number(link.updatedAt) || 0);
  const items = [];
  if (!live) items.push(["publish", "🌐", "Publish"]);
  else {
    if (savedSincePush) items.push(["publish", "🌐", "Publish Changes"]);
    if (appealable) items.push(["appeal", "⚑", appealPending ? "Appeal Pending" : "Appeal (unhide)"]);
    items.push(["unpublish", "⛔", "Unpublish"]);
    items.push(["share", "🔗", "Copy link"]);
  }
  return items.map(([act, icon, text]) => `        ${worldMenuItem(act, icon, text)}`).join("\n");
}

// The footer line for a world of your own: where it came from (made here — "My World" — or
// imported as a file — "Imported", via `meta.origin`), plus — once it has been published —
// published — what the catalog currently thinks of it. One short line only; the explanation lives
// in the tooltip and the management flows behind the ⋮ menu's community entry.
function localWorldNote(link, meta) {
  // Authorship wins over import provenance: a world stamped with this device's community id
  // (created, duplicated or published here — see WorldStore.sign / signForPublish in community.js)
  // reads "My World" even if the file originally arrived via import. So a scenario you adopt and
  // publish follows you across devices as yours (restore the same identity there and the id still
  // matches); a foreign import never matches, so it can never be mistaken for your own.
  const myId = (worldStore && worldStore.authorId) || "";
  const authoredHere = !!(myId && meta && meta.authorId && String(meta.authorId) === String(myId));
  const imported = isImportedMeta(meta) && !authoredHere;
  const srcTx = imported ? "Imported" : "✎ My World";
  const srcIcon = imported ? ICON_IMPORT : "";
  const made = imported ? "A world you imported" : "A world you made";
  if (!link || link.status === "removed") return worldNote(srcTx, { icon: srcIcon, title: link ? `${made} — not published right now; publish it again from ⋮ → 🌐 Publish` : made });
  if (link.hidden === true || link.status === "hidden") {
    if (String(link.hiddenReason || "reports") === "admin") return worldNote(`${srcTx} · Hidden`, { icon: srcIcon, kind: "warn", title: "Hidden from Explore by a moderator — publishing changes won't put it back" });
    const at = Number(link.reinstatesAt) || 0;
    if (at > Date.now()) return worldNote(`${srcTx} · Appeal Pending`, { icon: srcIcon, kind: "warn", title: `Hidden after reports — your appeal returns it to Explore on ${new Date(at).toLocaleDateString()}` });
    return worldNote(`${srcTx} · Hidden`, { icon: srcIcon, kind: "warn", title: "Hidden from Explore after reports — you can appeal from ⋮ → ⚑ Appeal (unhide)" });
  }
  return worldNote(`${srcTx} · Published`, { icon: srcIcon, title: "Published — manage it from the ⋮ menu (⛔ Unpublish, 🌐 Publish Changes)" });
}

// The bottom line of an added (community-library) card: what the saved copy is, or — when something
// about it needs the player's attention — the one thing that does. Only ever one short line (the
// card is far too narrow for a sentence), with the full explanation in the tooltip and the details
// popup. Mirrors community.js's own added-card note; this copy serves the fallback card used when
// community.js hasn't loaded.
function addedNote(rec, entry) {
  if (rec.stale) return worldNote("⟳ Update Available", { kind: "upd", title: "A newer version exists — click to update to it." });
  if (rec.status === "unknown" || rec.status === "removed") return worldNote("⚠ No Longer Public", { kind: "warn", title: "The original is no longer published — you're playing your saved copy." });
  if (rec.status === "hidden") return worldNote("⚑ Hidden After Reports", { kind: "warn", title: "Hidden after reports — still playable from your saved copy." });
  if (!entry) return worldNote("⚠ Download Failed", { kind: "warn", title: "The world file couldn't be downloaded yet — click to retry." });
  return worldNote(PUBLIC_LABEL, { icon: EXPLORE_IC, title: "A public world you added — you're playing your saved copy." });
}

// The one meta line every card shares (world cards, added cards, explore cards and the picker), so a
// world reads identically everywhere. Bits are separated by a muted `·`; the line wraps as a whole
// when the card is too narrow for all of them.
function metaLine(bits) {
  // Always emitted, even with no bits: the meta row's height is reserved (see .ld-meta) so every
  // card's description / tag / note rows sit at the same offset — a world with no author can't pull
  // its own description a line higher than its neighbours'.
  const parts = bits.filter(Boolean);
  return `<div class="ld-meta">${parts.join("")}</div>`;
}

// The author line shared by the world cards (bundled, mine, imported and added) — `@name` in the
// explore card's accent colour, and nothing else. The catalog content version, the fork provenance
// and the saved-adventure count are deliberately NOT here: they all belong to the details popup, so
// the card's one meta line stays short enough to sit on a single row. The row is still emitted even
// with no author (see `metaLine`), so an uncredited world keeps its description at the same offset
// as its neighbours'.
function worldMeta(meta, linkable = true) {
  const author = String(meta.author || "").trim();
  const uid = authorUid(meta.authorId, author);
  const bit = !author ? ""
    : (uid && linkable
      ? `<button class="ex-author ex-author-link" data-uid="${esc(uid)}" title="Open this author's profile">@${esc(author)}</button>`
      : `<span class="ex-author">@${esc(author)}</span>`);
  return metaLine(bit ? [bit] : []);
}

// An author's name on a card opens their public profile — wired per card (not delegated: the card
// itself opens the detail panel on click, so this has to stopPropagation like Explore's does).
function wireCardAuthorLink(card, name) {
  const b = card.querySelector(".ex-author-link");
  if (b) b.onclick = (e) => { e.stopPropagation(); if (b.dataset.uid) goUser(b.dataset.uid, name); };
}

// The author's tag row — always emitted, even when empty: the tags row is a fixed-height slot (see
// .ld-wtags), so a world with only reserved markers still lines its description up with its
// neighbours instead of pulling it a row higher. A row whose chips don't fit gets its `…` overflow
// chip from tag-row.js's fit pass once it's in the document (a card can't know its own width here).
function worldTags(meta) {
  return `<div class="ld-wtags">${tagChips(meta.tags, isNsfwMeta(meta), isRemixMeta(meta), remixTip(meta.remix))}</div>`;
}

function worldCard(meta, bundled, opts = {}) {
  const builtin = !!bundled;
  const source = opts.source || (builtin ? "bundled" : "mine");
  const card = document.createElement("div");
  card.className = "ld-wcard";
  const cover = meta.cover
    ? `<img class="ld-wcover-img" src="${esc(meta.cover)}" alt="" loading="lazy">`
    : `<div class="ld-wcover-ph">${esc(String((meta.name || "?")).charAt(0).toUpperCase())}</div>`;
  card.innerHTML = `
    <div class="ld-wcover">
      ${cover}
      ${builtin ? `<div class="ld-wcover-chips"><span class="ld-wbadge ld-wbadge-cover" title="Ships with the engine">✦ MNO</span></div>` : (isMnoAuthor(meta.authorId, meta.author) && linkLive(opts.link) ? mnoBadgeCover : "")}
      ${builtin ? "" : `<button class="ld-wmore" title="World actions">⋮</button>`}
    </div>
    <div class="ld-wbody">
      <div class="ld-whead"><span class="ld-wname" title="${esc(meta.name)}">${esc(meta.name)}</span></div>
      ${worldMeta(meta)}
      <div class="ld-wdesc">${inlineMd(meta.description || "")}</div>
      ${worldTags(meta)}
      ${sourceNote(source, opts.link, meta)}
    </div>
    ${builtin ? "" : `<div class="ld-wmenu" hidden>
      ${worldMenuItem("edit", "✏️", "Edit")}
      ${worldMenuItem("dupe", "⧉", "Duplicate")}
      ${worldMenuItem("export", ICON_EXPORT, "Download")}
      <div class="ld-wsep"></div>
${worldMenuCommunityEntries(meta, opts.link)}
      <div class="ld-wsep"></div>
      ${worldMenuItem("shareto", "↗", "Share (External)")}
      <div class="ld-wsep"></div>
      ${worldMenuItem("del", "✖", "Delete", { cls: "warn" })}
    </div>`}`;
  const loadFile = async () => (builtin ? worldToFile(bundled) : await worldStore.getRaw(meta.id));
  const open = async (e) => {
    if (e) e.stopPropagation();
    let f = await loadFile();
    if (!f) return;
    if (builtin) { // the built-in is never edited in place — duplicate-then-open
      const nv = await TextPopup.open({ title: "Duplicate world to edit", value: meta.name + " (copy)", placeholder: "New world name…", rows: 1 });
      if (nv === null || !nv.trim()) return;
      const copy = JSON.parse(JSON.stringify(f));
      copy.meta.name = nv.trim();
      copy.meta.id = await freshWorldId();
      copy.meta.createdAt = new Date().toISOString();
      copy.meta.updatedAt = new Date().toISOString();
      f = copy;
    }
    openWorldEditor(f, { worldStore, onSaved: refreshLanding, notify, ConfirmPopup, genImage, community: communityEditorHook() });
  };
  card.addEventListener("click", () => openWorldDetail(meta, bundled));
  wireCardAuthorLink(card, meta.author);
 // ⋮ action menu (Edit / Duplicate / Download / Share (External) / Delete) — user library worlds only.
 if (!builtin) {
   const moreBtn = card.querySelector(".ld-wmore");
   const menu = card.querySelector(".ld-wmenu");
    const menuClose = () => { menu.hidden = true; try { menu.classList.remove("up"); } catch (e) {} if (openWorldMenu === menu) openWorldMenu = null; };
   moreBtn.addEventListener("click", (e) => {
     e.stopPropagation();
     if (!menu.hidden) { menuClose(); return; }
     closeWorldMenu();
     menu.hidden = false;
     openWorldMenu = menu;
      placeWorldMenu(menu);
   });
    menu.addEventListener("click", (e) => e.stopPropagation()); // never bubbles to the card
    menu.querySelector('[data-act="edit"]').onclick = async (e) => {
      e.stopPropagation();
      menuClose();
      await open(e);
    };
    menu.querySelector('[data-act="dupe"]').onclick = async (e) => {
      e.stopPropagation(); menuClose();
      const f = await loadFile();
      if (f) duplicateWorld(f);
    };
    // The ⋮ menu's community entries: each one opens the panel for its own action — the
    // publish panel, the unpublish panel, or the appeal panel. All three live in the community
    // module, so the import happens on the click (and only for a world that has a community action
    // to offer).
    const communityAction = (act, fn) => {
      const b = menu.querySelector(`[data-act="${act}"]`);
      if (b) b.onclick = async (e) => {
        e.stopPropagation(); menuClose();
        const m = await communityModule();
        await fn(m.api);
      };
    };
    communityAction("publish", (api) => api.openCommunityMenu(meta.id));
    communityAction("unpublish", (api) => api.unpublishWorld(meta.id));
    communityAction("appeal", (api) => api.appealWorld(meta.id));
    // 🔗 Copy link — the ⋮ entry only exists while the world is live, so `opts.link.worldId` is there.
    communityAction("share", (api) => api.copyWorldLink(opts.link && opts.link.worldId));
    menu.querySelector('[data-act="export"]').onclick = async (e) => {
      e.stopPropagation(); menuClose();
      const f = await loadFile();
      if (f) exportWorld(f);
    };
    // ↗ Share (External) — the ⋮ entry above Delete. Opens the destination picker (third-party
    // libraries, starting with the Unseen Scribe Library), which uploads a fresh
    // `.gz` of this world and builds the handoff link. Lazy-imported like the
    // community actions so the share code only loads when it's used.
    menu.querySelector('[data-act="shareto"]').onclick = async (e) => {
      e.stopPropagation(); menuClose();
      const { openSharePanel } = await import("./share-external.js");
      // onPublish is the card's own ⋮ → Publish flow, so the panel's engine
      // publish button and the menu's Publish entry are literally one flow.
      await openSharePanel(meta, loadFile, { onPublish: () => communityModule().then((m) => m.api.openCommunityMenu(meta.id)) });
    };
    const del = menu.querySelector('[data-act="del"]');
    if (del) del.onclick = async (e) => {
      e.stopPropagation(); menuClose();
      // A published world is live in Explore, so deleting the local copy has to take the listing
      // down with it — otherwise it would stay in Explore, unmanageable, pointing at a world
      // nobody has any more. One confirmation covers both, and the unpublish happens FIRST: if the
      // server can't be reached we don't delete the world and leave a zombie listing behind.
      const link = ((await communityKv("links")) || {})[meta.id];
      const published = !!(link && link.status !== "removed");
      const ok = await ConfirmPopup.open({
        title: published ? "Delete Published World" : "Delete World",
        message: published
          ? `Delete the world '${meta.name}'? It's live in Explore, so deleting it also takes it down from the community. People who already added it keep their saved copy. Adventures bound to it will be unbound, and they might stop working correctly.`
          : `Delete the world '${meta.name}'? Adventures bound to it will be unbound, and they might stop working correctly.`,
        confirmText: "Delete", danger: true
      });
      if (!ok) return;
      if (published) {
        const m = await communityModule();
        const down = await m.api.unpublishWorld(meta.id, { confirm: false, note: false });
        if (!down) { notify("✖ The world wasn't deleted — it's still published. Check your connection and try again.", { ms: 5200 }); return; }
      }
      try {
        await worldStore.remove(meta.id);
      } catch (e) {
        if (isStorageError(e) || (e && e.isStorageUnavailable)) { notifyStorageError(notify, "deleting", e); return; }
        notify("✖ Couldn't delete that world: " + (e.message || e), { ms: 5200 });
        return;
      }
      await refreshWorldNameCache();
      if (published) notify("✖ World deleted and unpublished.");
      refreshLanding();
    };
  }
  return card;
}

// Open the world detail popup for a library or bundled world (by its meta).
async function openWorldDetail(meta, bundled) {
  const world = bundled || await worldStore.get(meta.id);
  if (!world) return;
  // A world of yours that's live in Explore reads its capsule straight off the catalog link record —
  // the version that's out there, the bytes that were uploaded and when it last changed — so it shows
  // exactly what Explore shows for it. An unpublished world (or a bundled one) has no catalog facts:
  // it falls back to the local file's own size and the world's `updatedAt`.
  const link = bundled ? null : ((await communityKv("links")) || {})[meta.id];
  const live = link && link.status !== "removed" ? link : null;
  openWorldPanel(world, {
    builtin: !!bundled,
    // 🔗 Copy link — only a LIVE listing has a catalog id to make one from (community.js's
    // `copyWorldLink`). An unpublished world has no catalog entry, so there is nothing to link to.
    share: live ? live.worldId : "",
    mno: !bundled && !!live && isMnoAuthor(world.meta.authorId, world.meta.author),
    meta: {
      version: live ? live.version : "",
      bytes: (live && live.jsonBytes) || localWorldBytes(world),
      updatedAt: (live && live.updatedAt) || Date.parse(world.meta.updatedAt) || 0
    }
  });
}

// The catalog listing is fresher than the downloaded file for listing-only publishes
// (e.g. a new cover with no content/version change — `checkLibraryUpdates` refreshes the
// library snapshot without re-downloading the file). `addedMeta` (cards) already prefers the
// listing; any view that reads the cached file must overlay the same snapshot or it shows the
// stale cover. Shared by the added-world detail panel and the chat Session tab's Currently
// Playing block, so the two never disagree.
function overlayLibraryListing(world, lib, fallbackId = "") {
  if (!world || !world.meta || !lib || !lib.worldId) return world;
  const pick = (a, b) => (a === undefined || a === null || a === "" ? b : a);
  world.meta.name = pick(lib.title, world.meta.name) || fallbackId;
  world.meta.description = pick(lib.description, world.meta.description) || "";
  world.meta.author = pick(lib.authorName, world.meta.author) || "";
  world.meta.authorId = lib.userId || world.meta.authorId || "";
  if (Array.isArray(lib.tags) && lib.tags.length) world.meta.tags = lib.tags.slice();
  if (lib.nsfw === true) world.meta.nsfw = true;
  world.meta.cover = pick(lib.coverUrl, world.meta.cover) || "";
  // Author's notes: the listing's notesId is fresher than whatever the cached file carries (a
  // notes-only push never re-uploads the file), so a present ID wins as the fetch URL.
  const libNotesId = notesIdFromValue(lib.notesId);
  if (libNotesId) world.meta.authorNotes = notesUrlForId(libNotesId);
  if (!world.meta.remix) {
    const fr = remixFromRec(lib);
    if (fr) world.meta.remix = fr;
  }
  return world;
}

// Open an added (community-library) world's detail popup. Its content lives in the community
// cache, not the world store, and its adventures are bound to a `lib:`-prefixed id (see
// community.js's playLibraryWorld) — so the panel lists that world's sessions and its Play starts
// a new adventure from the cached copy (no network). With no cached copy it kicks off the download.
async function openLibWorldDetail(worldId) {
  const m = await communityModule();
  const world = await m.api.getCachedWorld(worldId);
  if (!world) { await m.api.retryLibrary(worldId); return; }
  const lib = (await m.api.library())[worldId] || {};
  // The card is drawn from `addedMeta` (catalog listing first, cached file as fallback), so a
  // listing-only publish (e.g. a new cover with no content/version change) shows the fresh cover
  // on the card via `checkLibraryUpdates`. The panel below reads the cached file — overlay the same
  // listing snapshot here so the two never disagree.
  overlayLibraryListing(world, lib, worldId);
  // 🔗 Copy link — an added world has a stable catalog id, so a link to it always resolves. Not
  // offered once the original is gone (`unknown`/`removed`): the link would only say so.
  const shareable = lib.status !== "unknown" && lib.status !== "removed";
  openWorldPanel(world, {
    sessionId: libId(worldId),
    share: shareable ? worldId : "",
    mno: libRecLive(lib) && (isMnoAuthor(world.meta.authorId, world.meta.author) || isMnoAuthor(lib.userId, lib.authorName)),
    // The library record behind this copy: the panel's reader actions (Update / Report / Mute)
    // and the live-vs-stale version read straight off it.
    libRec: lib,
    meta: {
      version: lib.version,
      bytes: lib.jsonBytes || localWorldBytes(world),
      updatedAt: lib.updatedAt || Date.parse(world.meta.updatedAt) || 0
    },
    startNew: (beforeOpen) => m.api.playLibraryWorld(worldId, beforeOpen)
  });
}

// The Play/Continue block every world detail panel ends with: the world's primary action, its
// `✦ New adventure` companion once it has saved adventures, and the list of them. `sessionId` is the
// id that world's adventures are bound to — the world's own `meta.id`, or `lib:<worldId>` for a
// world played from a downloaded copy.
// One implementation serves all of them: this file's Worlds panel, and Explore's panel (its own
// listing and an added world), which reaches it through `mnoApp.mountWorldSessions` — so a world
// offers exactly the same thing wherever you open it.
// `opts.beforeStart` closes the panel this block lives in. It is NOT called here: it is handed down
// to whatever builds the next screen — `beginNewAdventure`'s `opts.beforeOpen`, or the argument
// `opts.startNew` is called with — so the panel stays up until that screen exists and the dim never
// lifts in between (see `startNew`). `opts.startNew` overrides how a NEW adventure begins (added
// worlds go through the community cache) and defaults to a fresh adventure in `opts.world`.
// Renaming or deleting a row re-renders the block in place.
async function mountWorldSessions(dyn, sessionId, opts = {}) {
  const sessions = (await store.list())
    .filter((s) => (s.worldId || defaultWorld.meta.id) === sessionId)
    .sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
  const rerender = () => mountWorldSessions(dyn, sessionId, opts);
  // Close the panel at the moment the next screen is built, never at the click. Removing it first
  // leaves the page with no overlay at all for as long as the launch takes — one frame, or hundreds on
  // a slow library read — which the player sees as the screen flashing dim → bright → dim. That is
  // exactly why a bundled world never flashed and a world of your own did: a bundled world is already
  // in memory (a microtask, nothing can paint in between), while a library world is read out of kv (a
  // real task, and the browser paints anything it likes in the gap).
  const startNew = () => {
    if (opts.startNew) opts.startNew(opts.beforeStart);
    else beginNewAdventure(opts.world, { beforeOpen: opts.beforeStart });
  };
  const continueSess = async () => {
    const s = await store.load(sessions[0].id);
    if (!s) { if (opts.beforeStart) opts.beforeStart(); return; }
    const wid = await chooseWorldForUnbound(s.worldId, s.worldName);
    if (!wid) { if (opts.beforeStart) opts.beforeStart(); return; }
    if (wid !== s.worldId) { s.worldId = wid; await store.save(s, { touch: false }); }
    // Nothing to close on the way in: `enterSession` swaps the landing for the chat, and the panel
    // takes itself down the instant it sees that (`openWorldPanel`'s observer watches the landing's
    // `hidden`) — the same frame. Closing here would instead leave the page undimmed for as long as
    // entering takes, because `enterSession` re-reads the world FIRST, and a library read is a task
    // the browser can paint in.
    enterSession(s);
  };
  const parts = [];
  if (sessions.length) {
    parts.push(`<button class="btn big wd-primary">▶ Continue</button>`);
    parts.push(`<button class="btn wd-secondary">✦ New adventure</button>`);
    parts.push(`<div class="wd-sess-head">Adventures in this world<span class="wd-sess-n">(${esc(String(sessions.length))})</span></div>`);
  } else {
    parts.push(`<button class="btn big wd-primary">▶ Play</button>`);
  }
  dyn.innerHTML = parts.join("");
  const primary = dyn.querySelector(".wd-primary");
  if (primary) primary.onclick = sessions.length ? continueSess : startNew;
  const secondary = dyn.querySelector(".wd-secondary");
  if (secondary) secondary.onclick = startNew;
  if (sessions.length) {
    const list = document.createElement("div");
    list.className = "wd-sess-list";
    for (const s of sessions) list.appendChild(adventureRow(s, { onChange: rerender }));
    dyn.appendChild(list);
  }
}

// Add the cover's fullscreen toggle to a world detail panel: a small button in the cover's
// bottom-right corner (the counterpart of the ✕ at its top-right — both inset 10px, so they read as
// one column of controls), and the whole cover is the toggle as well (the title included). It drops
// everything but the cover and its title (`.wd-full` in styles.css) so the cover fills the panel's
// frame; the panel's own size never changes. Closing the popup undoes it for free: the class lives on
// the panel, which goes with the overlay.
//
// The button is CREATED here rather than written into each panel's markup, and the caller keeps the
// state in an object it owns (`{full}`, defaulted for a panel built once): community.js rebuilds its
// panel's HTML on every repaint (a like, a download finishing), so it passes the same object back in
// and the panel comes back exactly as the reader left it.
function mountCoverFullscreen(overlay, state = { full: false }) {
  const panel = overlay.querySelector(".cc-panel");
  const hdr = overlay.querySelector(".wd-hdr");
  if (!panel || !hdr) return;
  hdr.querySelectorAll(".wd-fs").forEach((b) => b.remove()); // idempotent: a re-mount never doubles up
  const btn = document.createElement("button");
  btn.className = "wd-fs";
  hdr.appendChild(btn);
  const apply = () => {
    panel.classList.toggle("wd-full", state.full);
    btn.innerHTML = state.full ? WD_FS_COMPRESS_IC : WD_FS_EXPAND_IC;
    btn.title = state.full ? "Exit fullscreen" : "Fullscreen";
    btn.setAttribute("aria-pressed", state.full ? "true" : "false");
  };
  const toggle = () => { state.full = !state.full; apply(); };
  // The button's own click stops propagating: without that it would toggle here AND again on the
  // cover it sits in, landing back on the state it started in.
  btn.onclick = (e) => { e.stopPropagation(); toggle(); };
  hdr.addEventListener("click", () => toggle());
  apply();
}

// The shared world detail popup: cover, title, author, full description and tags, then Play (or
// Continue when the world already has saved adventures) plus the list of that world's sessions.
// `world` is a canonical World; `opts.sessionId` is the id its adventures are bound to (the
// world's own id, or `lib:<worldId>` for an added world) and `opts.startNew` overrides how a new
// adventure is started (added worlds must go through the community cache). `opts.meta` is the
// `{ version, bytes, updatedAt }` capsule shown under the author line — filled by each caller from
// the catalog link record, the library record, or the local file (see `worldMetaRow`); any field it
// omits is simply not shown. It is shown HERE and nowhere else, alongside the `⧉ fork of …`
// provenance: the browse cards deliberately leave both to this popup.
// `opts.share` is the world's catalog worldId when one exists (a live listing of your own, or an
// added world still public) — it draws the same 🔗 Copy link capsule Explore's panel wears, so a
// world that can be linked offers the same control wherever you read it. Absent/empty = no button.
function openWorldPanel(world, opts = {}) {
  const builtin = !!opts.builtin;
  // The `v · size · updated` capsule (the same one Explore's panel wears). `opts.meta` carries
  // whichever of the three facts the caller knows — the catalog link/library record, else the file.
  const metaRow = worldMetaRow(opts.meta);
  // The popularity ledger (like + downloads + 🔗 Copy link) is network-only: the counts come
  // from the catalog (links/library snapshots carry none), and a copied link can't be opened
  // offline anyway — so the row starts as a loading placeholder and is swapped for the full
  // ledger once the catalog answers (same builder Explore paints with, so no drift). No
  // share-first capsule: offline it would be useless, and on a gone listing it would be dead.
  // A failed fill removes the row instead of leaving either behind.
  const share = String(opts.share || "").trim();
  const catalogId = share;
  // An added world's library record, when this panel shows one: the reader actions below (Update /
  // Report / Mute) read straight off it. Own worlds never get these — reporting or muting yourself
  // is nonsense, and updating means publishing, which lives in the card's ⋮ menu.
  const libRec = (opts.libRec && typeof opts.libRec === "object") ? opts.libRec : null;
  // Fully offline at open: no spinner that can never resolve and no fetch that can only fail —
  // the row stays hidden until the connection returns (see the fill below), then fills normally.
  const offlineAtOpen = (typeof navigator !== "undefined" && navigator.onLine === false);
  const shareRow = share
    ? `<div class="ex-facts" data-wd-facts${offlineAtOpen ? " hidden" : ""}><span class="ex-cnt ex-pip" data-wd-loading title="Loading likes and downloads…"><span class="ex-spinner"></span></span></div>`
    : "";
  // Reader actions for an added world with a live listing — the same Update / Report / Mute the
  // Explore panel offers (same classes, same order it lists them in).
  const libUserId = libRec ? String(libRec.userId || "") : "";
  const libAuthor = libRec ? String(libRec.authorName || world.meta.author || "") : "";
  const showReaderActs = !!(libRec && catalogId);
  const updateLabel = (libRec && libRec.latestVersion) ? `⟳ Update to v${esc(String(libRec.latestVersion))}` : "⟳ Update";
  const actsHtml = showReaderActs ? [
    (libRec.stale ? `<button class="btn big wd-act-update" type="button" title="Download the newest published version">${updateLabel}</button>` : ""),
    `<button class="btn wd-act-report" type="button" title="Report this world">⚑ Report</button>`,
    (libUserId ? `<button class="btn wd-act-mute" type="button" title="Hide this author's worlds from Explore">⦸ Mute @${esc(libAuthor || "unknown")}</button>` : "")
  ].filter(Boolean).join("") : "";
  const sessionId = opts.sessionId || world.meta.id;
  // Profile targets for the two credited names (the author, and the original author on a remix).
  // Falls back to the engine author's own id for official worlds (bundled files name mnomno only).
  const authorProfileUid = authorUid(world.meta.authorId, world.meta.author);
  const remixProfileUid = world.meta.remix ? authorUid(world.meta.remix.userId, world.meta.remix.author) : "";
  const tags = tagChips(world.meta.tags, isNsfwMeta(world.meta), isRemixMeta(world.meta), remixTip(world.meta.remix), true);
  const cover = world.meta.cover
    ? `<img class="wd-hdr-bg" src="${esc(world.meta.cover)}" alt="">`
    : `<div class="wd-hdr-bg wd-hdr-ph">${esc(String((world.meta.name || "?")).charAt(0).toUpperCase())}</div>`;
 // Author's notes: draft text renders inline; a published pointer lazy-loads from the upload host.
  const notesVal = String(world.meta.authorNotes == null ? "" : world.meta.authorNotes).trim();
  const notesIsPtr = !!notesVal && isNotesPointer(notesVal);
  // The notes toggle (a pill beside the version capsule) swaps the description area between the
  // description and the notes. Draft text is already here; a pointer lazy-loads once, then caches.
  const hasNotes = !!notesVal;
  // @mentions render as profile buttons (rich-text.js); the async upgrade below resolves spaced
  // names against the catalog once the popup is up.
  const descHtml = world.meta.description ? richTextWithMentions(world.meta.description) : "";
  // Tabs: Overview (desc and/or tags, if either), Author's notes (if any),
  // Comments (the public listing only, unless the author turned them off in
  // the editor — the local file answers instantly, no catalog round-trip).
  // One pane → no bar, just the pane.
  const wdShowComments = !!share && !isCommentsOffMeta(world.meta);
  const hasOverviewWd = !!(descHtml || tags);
  const wdTabDefault = hasOverviewWd ? "desc" : (hasNotes ? "notes" : "comments");
  const wdTabDefs = [
    hasOverviewWd ? { id: "desc", label: "Overview", icon: ICON_OVERVIEW } : null,
    hasNotes ? { id: "notes", label: "Author's notes", icon: ICON_NOTE_DOC } : null,
    wdShowComments ? { id: "comments", label: "Comments", count: true, icon: ICON_COMMENT } : null,
  ].filter(Boolean);
  const hasWdTabs = wdTabDefs.length > 1;
  const wdTabsHtml = `
    ${hasWdTabs ? `<div class="wd-tabs" role="tablist" data-wd-tabs>${wdTabDefs.map((t) => `<button class="wd-tab" role="tab" data-wtab="${t.id}" aria-selected="${wdTabDefault === t.id ? "true" : "false"}" type="button">${t.icon || ""}${esc(t.label)}${t.count ? `<span class="wd-tab-n" data-wd-tabcount></span>` : ""}</button>`).join("")}</div>` : ""}
    ${hasOverviewWd ? `<div class="wd-tabpane wd-desc" role="tabpanel" data-pane="desc"${wdTabDefault !== "desc" ? " hidden" : ""}><span data-desc-tx>${descHtml}</span>${tags ? `<div class="ld-wtags wd-tags">${tags}</div>` : ""}</div>` : ""}
    ${hasNotes ? `<div class="wd-tabpane wd-desc" role="tabpanel" data-pane="notes"${wdTabDefault !== "notes" ? " hidden" : ""}>${notesIsPtr ? `<span class="wd-notes-loading">Loading author&rsquo;s notes…</span>` : richTextWithMentions(notesVal)}</div>` : ""}
    ${wdShowComments ? `<div class="wd-tabpane" role="tabpanel" data-pane="comments"${wdTabDefault !== "comments" ? " hidden" : ""}>
      <div class="wd-comments-wrap" data-comments-wrap></div>
    </div>` : ""}`;
  const overlay = document.createElement("div");
  overlay.className = "cc-overlay";
  overlay.innerHTML = `
    <div class="cc-panel wd-panel" tabindex="-1">
      <button class="popup-x wd-cancel" title="Close">✕</button>
      <div class="wd-hdr">
        ${cover}
        <div class="wd-hdr-scrim">
          <div class="wd-headrow">
            <span class="wd-name">${esc(world.meta.name)}</span>
          </div>
        </div>
        ${builtin ? `<span class="ld-wbadge wd-badge" title="Ships with the engine">✦ MNO</span>` : (opts.mno ? mnoBadgeHead : "")}
      </div>
      <div class="cc-body wd-body">
        <div class="wd-side">
          ${world.meta.author ? `<div class="wd-author">by ${authorProfileUid ? `<button class="wd-author-profile" data-uid="${esc(authorProfileUid)}" title="Open this author's profile">@${esc(world.meta.author)}</button>` : `<b>@${esc(world.meta.author)}</b>`} <button class="ex-link wd-author-more">more</button></div>` : ""}
          ${world.meta.remix ? `<div class="wd-remix">⧉ remix of ${world.meta.remix.worldId ? `<button class="wd-remix-world" data-world="${esc(world.meta.remix.worldId)}" title="Open original world">${esc(world.meta.remix.name || "")}</button>` : `<b>${esc(world.meta.remix.name || "")}</b>`} by ${(remixProfileUid || world.meta.remix.author) ? `<button class="wd-remix-profile" data-uid="${esc(remixProfileUid)}" data-name="${esc(world.meta.remix.author || "")}" title="Open this author's profile">@${esc(world.meta.remix.author || "?")}</button>` : `<b>@${esc(world.meta.remix.author || "?")}</b>`}</div>` : ""}
          ${shareRow}
          ${metaRow ? `<div class="wd-meta-row"><div class="ex-pip ex-meta wd-meta">${metaRow}</div></div>` : ""}
          ${wdTabsHtml}
          <div class="wd-dyn"></div>
          ${actsHtml ? `<div class="ex-actions">${actsHtml}</div>` : ""}
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const dyn = overlay.querySelector(".wd-dyn");
  // The device/browser Back button closes this popup (see back-close.js).
  const release = pushBackClose(() => cancel());
  let closed = false;
  // A profile opened from the author name takes over from the panel: the panel gives its history
  // entry up WITHOUT popping it (see the `wd-author-profile` branch below). A plain cancel() would
  // schedule a history.back() whose delayed traversal lands after the profile has mounted and tears
  // it back down — the same bounce Explore's panel had.
  let takingOver = false;
  // Cleanup for the offline wait below (a one-time `online` listener when the panel opens
  // offline): closing the panel first must not leave it dangling.
  let stopOfflineWait = null;
  // Live comment-count subscription for the Comments tab (see fillFacts) — dropped on close.
  let cmtUnsub = null;
  // Inline comments state: the Comments tab mounts a thread right in this
  // panel (no Explore handoff). `mineWd` mirrors Explore's `mine` for watch
  // semantics: your own worlds auto-watch, added/builtin ones don't.
  const mineWd = !libRec && !builtin && !opts.mno;
  let cmtUnmountWd = null;
  // Tab state replaces the old open/close: panes swap in place, no toggle.
  // `wdTabDefault` (computed with the template above) is the landing pane.
  let wdTabWd = wdTabDefault;
  // Paints the Comments tab's count — shared by the count subscription and the
  // mounted thread's onCount.
  const paintN = (n) => {
    try {
      const t = overlay.querySelector("[data-wd-tabcount]");
      if (t) t.textContent = (typeof n === "number" && n >= 0) ? ` (${n})` : "";
    } catch (_) {}
  };
  // Close whenever the landing screen is left — e.g. a session row in the popup started an
  // adventure (the row's own load path doesn't notify this popup). This observer is also what takes
  // the popup down for a **▶ Continue**: `mountWorldSessions` deliberately doesn't close it, because
  // `enterSession` re-reads the world BEFORE it swaps the landing for the chat, and closing any
  // earlier leaves the page undimmed for exactly that read (see README §7's handoff rule).
  const obs = new MutationObserver(() => { if ($("landing").hidden) cancel(); });
  const cancel = () => {
    if (closed) return;
    closed = true;
    if (stopOfflineWait) { try { stopOfflineWait(); } catch (_) {} stopOfflineWait = null; }
    if (cmtUnsub) { try { cmtUnsub(); } catch (_) {} cmtUnsub = null; }
    if (cmtUnmountWd) { try { cmtUnmountWd(); } catch (_) {} cmtUnmountWd = null; }
    obs.disconnect();
    overlay.remove();
    if (takingOver) release.forget();
    else release();
  };
  obs.observe($("landing"), { attributes: true, attributeFilter: ["hidden"] });
  overlay.querySelectorAll(".wd-cancel").forEach((b) => (b.onclick = cancel));
  mountCoverFullscreen(overlay);
  // Inline comments wiring (pane markup is in the panel HTML above): the
  // Comments tab mounts the thread. Selecting a tab never scrolls.
  const mountWd = async () => {
    if (cmtUnmountWd || closed || !overlay.isConnected) return;
    const wrap = overlay.querySelector("[data-comments-wrap]");
    if (!wrap) return;
    try {
      const dm = await import("./discussion.js");
      if (!wrap.isConnected || closed) return;
      // Chatters only: a claimed MNO username or a saved Tavern nickname (the
      // same gate as the Tavern welcome). Anyone else gets the note + a way
      // into the Tavern instead of the thread — no backend mounts for them.
      let nick = "";
      try { nick = await dm.ensureCommentIdentity(); } catch (_) { nick = ""; }
      if (!wrap.isConnected || closed) return;
      if (!nick) {
        wrap.innerHTML = `<div class="wd-gate"><div class="wd-gate-t">Join the discussion</div><div class="wd-gate-d">Comments need a name. Set a nickname in the Tavern — it takes a few seconds.</div><button type="button" class="mini ok" data-wd-gate-tavern>Open Tavern</button></div>`;
        const gateBtn = wrap.querySelector("[data-wd-gate-tavern]");
        if (gateBtn) gateBtn.onclick = () => { openDiscussionPanel().catch(() => {}); };
        return;
      }
      cmtUnmountWd = dm.mountWorldComments(wrap, catalogId, {
        title: world.meta.name, mine: mineWd,
        onCount: (n) => { paintN(n); },
      });
    } catch (_) {
      try {
        wrap.innerHTML = `<div class="disc-status is-err">Couldn't load comments. Check your connection and reopen this panel.</div>`;
      } catch (_) {}
    }
  };
  const selectWdTabWd = (id) => {
    if (closed || !overlay.isConnected) return;
    if (id !== "desc" && id !== "notes" && id !== "comments") return;
    wdTabWd = id;
    try {
      overlay.querySelectorAll("[data-wtab]").forEach((b) => b.setAttribute("aria-selected", b.dataset.wtab === id ? "true" : "false"));
      overlay.querySelectorAll("[data-pane]").forEach((p) => { p.hidden = p.dataset.pane !== id; });
      // The bar scrolls horizontally on narrow screens instead of wrapping — keep
      // the just-selected tab fully in view (row's own scroll only, never the page).
      const bar = overlay.querySelector("[data-wd-tabs]");
      const btn = bar && bar.querySelector(`[data-wtab="${id}"]`);
      if (bar && btn) {
        const b = btn.getBoundingClientRect(), r = bar.getBoundingClientRect();
        if (b.right > r.right) bar.scrollLeft += b.right - r.right;
        else if (b.left < r.left) bar.scrollLeft -= r.left - b.left;
      }
    } catch (_) {}
    // Mount on first selection; panes swap in place, no scrolling.
    if (id === "comments") {
      mountWd();
    }
  };
  overlay.querySelectorAll("[data-wtab]").forEach((b) => { b.onclick = () => selectWdTabWd(b.dataset.wtab); });
  // Author's notes pane: draft text is already inline; a pointer lazy-loads once
  // (cached in notes.js), then fills the pane.
  const notesPaneWd = overlay.querySelector('[data-pane="notes"]');
  if (hasNotes && notesPaneWd && notesIsPtr) {
    const loadNotes = async () => {
      try { return await enrichDescHtml(await fetchNotesText(notesIdFromValue(notesVal))); }
      catch (e) { return `<span class="wd-notes-fail">Couldn&rsquo;t load the author&rsquo;s notes — check your connection and reopen this panel.</span>`; }
    };
    loadNotes().then((h) => { if (!closed && notesPaneWd.isConnected) notesPaneWd.innerHTML = h; });
  }
  // Spaced-username upgrade for the description's @mentions: the text span
  // already shows the sync single-token rendering, and this swaps in the
  // resolved one. Only the span is touched — the tags sharing the pane stay
  // put. Guarded against a close.
  const descTxWd = overlay.querySelector('[data-pane="desc"] [data-desc-tx]');
  if (world.meta.description && descTxWd) {
    const box = descTxWd;
    enrichDescHtml(world.meta.description).then((h) => {
      if (!closed && box.isConnected && h !== box.innerHTML) box.innerHTML = h;
    }).catch(() => {});
  }
  overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) cancel(); });
  overlay.addEventListener("keydown", (e) => { if (e.key === "Escape") cancel(); });
  // A tag chip in the row, and the author's `more`, are shortcuts into the Worlds page's own filters
  // (that tag; "worlds by @name"). Delegated on the OVERLAY, not the row: the one-line fit pass rewrites
  // a tag row's HTML (tag-row.js), which would take per-chip listeners with it.
  overlay.addEventListener("click", async (e) => {
    // @mentions in the description / author's notes open that user's profile — the same
    // destination as the author button above them. A name-only hop: the profile page tries
    // the username itself and shows its "No user named @…" state when nothing claims it.
    const mention = e.target.closest("[data-mention]");
    if (mention) {
      const name = String(mention.dataset.mention || "").replace(/^@+/, "").trim();
      if (!name) return;
      takingOver = true;
      try { cancel(); } finally { takingOver = false; }
      goUser("", name);
      return;
    }
    const prof = e.target.closest(".wd-author-profile");
    if (prof) {
      takingOver = true;
      try { cancel(); } finally { takingOver = false; }
      if (authorProfileUid) goUser(authorProfileUid, world.meta.author);
      return;
    }
    const rworld = e.target.closest(".wd-remix-world");
    if (rworld) {
      const wid = rworld.dataset.world || (world.meta.remix && world.meta.remix.worldId);
      if (!wid) return;
      // One panel at a time: this panel hands its Back entry to the original's panel
      // (`reuseEntry` rewrites this entry's slot instead of pushing on top), so Back closes
      // the original straight onto the page. A dead/missing original only says so via
      // openLinkedWorld's own notice.
      rworld.disabled = true;
      takingOver = true;
      try { cancel(); } finally { takingOver = false; }
      try { await (await communityModule()).api.openLinkedWorld(wid, { reuseEntry: true }); }
      catch (err) { try { A().notify("✖ " + (err.message || err), { ms: 5200 }); } catch (_) {} }
      rworld.disabled = false;
      return;
    }
    const rprof = e.target.closest(".wd-remix-profile");
    if (rprof) {
      takingOver = true;
      try { cancel(); } finally { takingOver = false; }
      // The stored remix userId may be stale (or missing on old copies): goUser tries the id
      // first and the username second, so a dead id still lands on the renamed account.
      const rUid = rprof.dataset.uid || remixProfileUid;
      const rName = rprof.dataset.name || (world.meta.remix && world.meta.remix.author);
      if (rUid || rName) goUser(rUid, rName);
      return;
    }
    const tag = e.target.closest(".wd-tags [data-tag]");
    const by = e.target.closest(".wd-author-more");
    if (!tag && !by) return;
    cancel();
    if (tag) filterWorldsByTag(tag.dataset.tag);
    else filterWorldsByAuthor(world.meta.author, world.meta.authorId);
  });
  // Like + download + copy-link capsules for a published world — the same ledger Explore's
  // panel wears (see `factsRowHtml` in community.js). The row above holds a loading placeholder;
  // once the catalog answers, the whole row is replaced by the shared builder and every button
  // rewired. A gone listing or an exhausted transient failure removes the row: a dead link and a
  // stuck spinner are both worse than nothing. The fill retries transient failures (a blip at
  // open time shouldn't permanently degrade the panel), but a `not_found` means the listing is
  // genuinely gone — no retry. An offline open waits for the connection instead of fetching.
  if (catalogId) {
    const dropFactsRow = () => {
      if (cmtUnsub) { try { cmtUnsub(); } catch (_) {} cmtUnsub = null; }
      try { overlay.querySelector("[data-wd-facts]")?.remove(); } catch (_) {}
    };
    const fillFacts = async (attempt) => {
      try {
        const m = await communityModule();
        const capi = m.api;
        // The liked set is only paint (♡ vs ♥): a storage failure here must not kill the ledger.
        try { if (capi.ensureLiked) await capi.ensureLiked(); }
        catch (e) { try { console.warn("[world-panel] liked set unavailable:", e); } catch (_) {} }
        let rec = null;
        try { rec = await capi.getWorldRecord(catalogId); }
        catch (e) {
          if (e && e.code === "not_found") {
            try { console.warn("[world-panel] no catalog record for", catalogId); } catch (_) {}
            if (!closed && overlay.isConnected) dropFactsRow();
            return;
          }
          throw e;
        }
        if (closed || !overlay.isConnected) return;
        const box = overlay.querySelector("[data-wd-facts]");
        if (!rec || !box || !capi.factsRowHtml) { dropFactsRow(); return; }
        const base = { worldId: rec.worldId || catalogId, likes: Number(rec.likes) || 0, downloads: Number(rec.downloads) || 0 };
        box.outerHTML = capi.factsRowHtml(base, { share: catalogId, shareCls: "wd-share" });
        const likeBtn = overlay.querySelector(".ex-like[data-wid]");
        if (likeBtn && capi.toggleLike) likeBtn.onclick = async () => {
          try { await capi.toggleLike(base); }
          catch (e) { try { notify("✖ " + (e.message || e), { ms: 5200 }); } catch (_) {} }
        };
        // 🔗 Copy link. The copy itself lives in community.js (`copyWorldLink` — the public URL
        // plus the `#explore/<worldId>` deep link, with the clipboard fallbacks and the "copied"
        // toast), and this module only ever reaches community.js through a dynamic import.
        const shareBtn2 = overlay.querySelector(".wd-share");
        if (shareBtn2) shareBtn2.onclick = async () => {
          const mm = await communityModule();
          mm.api.copyWorldLink(catalogId);
        };
        try {
          if (cmtUnsub) { try { cmtUnsub(); } catch (_) {} cmtUnsub = null; }
          const dm = await import("./discussion.js");
          if (!closed && overlay.isConnected && wdShowComments) cmtUnsub = dm.subscribeWorldCount(rec.worldId || catalogId, paintN, { mine: mineWd });
        } catch (_) {}
      } catch (e) {
        try { console.warn("[world-panel] facts fill failed (attempt " + attempt + "):", e); } catch (_) {}
        if (attempt < 2 && !closed && overlay.isConnected) {
          await new Promise((r) => setTimeout(r, 2500));
          if (!closed && overlay.isConnected) return fillFacts(attempt + 1);
        }
        if (!closed && overlay.isConnected) dropFactsRow();
      }
    };
    if (offlineAtOpen) {
      const onOnline = () => {
        window.removeEventListener("online", onOnline);
        stopOfflineWait = null;
        if (closed || !overlay.isConnected) return;
        try { overlay.querySelector("[data-wd-facts]")?.removeAttribute("hidden"); } catch (_) {}
        fillFacts(1);
      };
      stopOfflineWait = () => window.removeEventListener("online", onOnline);
      window.addEventListener("online", onOnline);
    } else fillFacts(1);
  }
  // Reader actions for an added world: Update pulls the newest published file (then reopens this
  // panel fresh, so cover/title/version all agree), Report runs community's shared flow, and Mute
  // hides the author from Explore. The panel stays open for Report/Mute; Update reopens it.
  const updBtn = overlay.querySelector(".wd-act-update");
  if (updBtn && catalogId) updBtn.onclick = async () => {
    const t = updBtn.textContent;
    updBtn.disabled = true; updBtn.textContent = "⟳ Updating…";
    try {
      const mm = await communityModule();
      if (await mm.api.refreshLibraryWorld(catalogId)) {
        if (!closed) { cancel(); openLibWorldDetail(catalogId); }
        return;
      }
    } catch (e) {}
    if (!closed && updBtn.isConnected) { updBtn.disabled = false; updBtn.textContent = t; }
  };
  const repBtn = overlay.querySelector(".wd-act-report");
  if (repBtn && catalogId) repBtn.onclick = async () => {
    try {
      const mm = await communityModule();
      const st = await mm.api.reportWorldFlow({ worldId: catalogId, title: world.meta.name });
      if ((st === "reported" || st === "already") && !closed && repBtn.isConnected) {
        repBtn.disabled = true; repBtn.textContent = "⚑ Reported";
      }
    } catch (e) { try { notify("✖ " + (e.message || e), { ms: 5200 }); } catch (_) {} }
  };
  const muteBtn = overlay.querySelector(".wd-act-mute");
  if (muteBtn && libUserId) muteBtn.onclick = async () => {
    try {
      const mm = await communityModule();
      const r = await mm.api.muteAuthor({ userId: libUserId, authorName: libAuthor });
      if (!closed && muteBtn.isConnected) {
        muteBtn.disabled = true; muteBtn.textContent = "⦸ Muted";
        notify(r && r.already
          ? `@${libAuthor || "unknown"} is already muted.`
          : `⦸ Muted @${libAuthor || "unknown"} — their worlds are now hidden from Explore.`, { ms: 4200 });
      }
    } catch (e) { try { notify("✖ " + (e.message || e), { ms: 5200 }); } catch (_) {} }
  };
  overlay.querySelector(".cc-panel").focus();

  const renderDyn = () => mountWorldSessions(dyn, sessionId, { world, beforeStart: cancel, startNew: opts.startNew });
  renderDyn();
}

// Full-screen world picker shown when starting a new adventure and more than one world exists.
// Everything playable is offered — the bundled worlds, your own local worlds, and the public worlds
// you've added from Explore. An added world has no local World file: its card is built from the
// catalog record (with the downloaded copy's meta as the fallback) and its `lib:` id is all the
// caller needs, since `loadWorldById` resolves that prefix out of the community cache.
//
// Resolves with the chosen world (or null if cancelled). The list draws in chunks as you scroll —
// a player with hundreds of added worlds shouldn't wait on every card before the picker appears —
// and the search box filters across all of them, not just what's been drawn.
const WP_CHUNK = 24;
function showWorldPicker() {
  return new Promise(async (resolve) => {
    await loadAddedWorlds(false);
    let userWorlds = [];
    try {
      userWorlds = (await worldStore.all()).filter((w) => !bundledWorldForId(w.meta.id) && !nsfwHidden(w.meta));
    } catch (e) {
      console.warn("[picker] user worlds unreadable (storage unavailable):", (e && e.message) || e);
      userWorlds = [];
    }
    const addedWorlds = homeAdded.items
      .map((it) => ({ meta: addedMeta(it.rec, it.entry), published: libRecLive(it.rec) }))
      .filter((w) => !nsfwHidden(w.meta));
    // Respect the library's NSFW filter: a hidden world shouldn't be offered when starting a
    // new adventure either. (The bundled default is never NSFW, so the list is never empty.)
    const all = [...bundledWorlds, ...userWorlds, ...addedWorlds].filter((w) => !nsfwHidden(w.meta));
    const overlay = document.createElement("div");
    overlay.className = "cc-overlay";
    overlay.innerHTML = `
      <div class="cc-panel wp-panel" tabindex="-1">
        <div class="cc-head">
          <span class="cc-title">${WORLD_IC} Choose World</span>
          <button class="popup-x wp-cancel" title="Close">✕</button>
        </div>
        <div class="cc-body">
          <label class="hm-searchwrap wp-searchrow"></label>
          <p class="cc-hint">A world is a complete setting — its own scenario, lore, stats, and trackers. Once you begin, the adventure stays bound to this world.</p>
          <div class="wp-list"></div>
          <div class="wp-empty" hidden></div>
        </div>
        <div class="cc-foot">
          <span class="cc-err"></span>
          <button class="mini ok wp-create">＋ Create world</button>
          <button class="mini wp-cancel">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const release = pushBackClose(() => done(null));
    const list = overlay.querySelector(".wp-list");
    const emptyEl = overlay.querySelector(".wp-empty");
    const bodyEl = overlay.querySelector(".cc-body");
    const done = (w) => {
      bodyEl.removeEventListener("scroll", nudge);
      bodyEl.removeEventListener("wheel", nudge);
      bodyEl.removeEventListener("touchmove", nudge);
      overlay.removeEventListener("keydown", onKey);
      release();
      overlay.remove();
      resolve(w);
    };
    // One card, built from a canonical World or from an added world's stand-in `{ meta }`.
    const cardFor = (w) => {
      const card = document.createElement("div");
      card.className = "wp-card";
      // Every tag (specials first — the rating and fork provenance are chips at the head of the row,
      // not tags): the picker row is wide, and the fit pass adds a `…` chip if they still overflow.
      const tags = tagChips(w.meta.tags || [], isNsfwMeta(w.meta), isRemixMeta(w.meta), remixTip(w.meta.remix));
      const thumb = w.meta.cover
        ? `<img class="wp-thumb" src="${esc(w.meta.cover)}" alt="" loading="lazy">`
        : `<div class="wp-thumb wp-thumb-ph">${esc(String((w.meta.name || "?").charAt(0).toUpperCase()))}</div>`;
      const wpBundled = !!bundledWorldForId(w.meta.id);
      let wpPublished = wpBundled || !!w.published;
      if (!wpPublished) {
        if (String(w.meta.id || "").startsWith(LIB_WORLD_PREFIX)) {
          const hit = homeAdded.items.find((x) => libId(x.rec.worldId) === w.meta.id);
          wpPublished = libRecLive(hit && hit.rec);
        } else {
          wpPublished = linkLive(homeLinks[w.meta.id]);
        }
      }
      card.innerHTML = `
        ${thumb}
        <div class="wp-main">
          <div class="ld-whead"><span class="ld-wname">${esc(w.meta.name)}</span>${(wpBundled || (wpPublished && isMnoAuthor(w.meta.authorId, w.meta.author))) ? `<span class="ld-wbadge">✦ MNO</span>` : ""}</div>
          ${worldMeta(w.meta, false)}
          ${w.meta.description ? `<div class="ld-wdesc">${inlineMd(w.meta.description)}</div>` : ""}
          ${tags ? `<div class="ld-wtags">${tags}</div>` : ""}
        </div>
        <button class="mini ok wp-pick">Use this world</button>`;
      card.querySelector(".wp-pick").onclick = () => done(w);
      card.onclick = () => done(w);
      return card;
    };
    // The search's result set, and the cursor into it that the list is drawn from.
    let shown = all;
    let next = 0;
    // Draw the next chunk. There is no IntersectionObserver trigger here on purpose: it never fires
    // inside the preview's iframe (and the published page runs in the same one), so the load is
    // driven by the input events that mean "I'm scrolling" — a wheel over the list, a touch drag, a
    // PageDown/End key, or the body's own scroll event. `fill` also tops the list up on its own until
    // the box is full, which is what carries a tall screen past the first chunk when there is nothing
    // to scroll yet (a short list leaves the panel shorter than its max height).
    function fill() {
      if (next >= shown.length) return;
      const end = Math.min(next + WP_CHUNK, shown.length);
      const frag = document.createDocumentFragment();
      for (; next < end; next++) frag.appendChild(cardFor(shown[next]));
      list.appendChild(frag);
      if (next < shown.length && bodyEl.scrollHeight <= bodyEl.clientHeight + 40) {
        requestAnimationFrame(() => { if (overlay.isConnected) fill(); });
      }
    }
    function paint() {
      list.innerHTML = "";
      next = 0;
      emptyEl.hidden = true;
      if (!shown.length) {
        emptyEl.hidden = false;
        emptyEl.textContent = all.length ? "No worlds match that search." : "No worlds yet.";
        return;
      }
      fill();
    }
    const nudge = () => { if (bodyEl.scrollTop + bodyEl.clientHeight >= bodyEl.scrollHeight - 240) fill(); };
    bodyEl.addEventListener("scroll", nudge, { passive: true });
    bodyEl.addEventListener("wheel", nudge, { passive: true });
    bodyEl.addEventListener("touchmove", nudge, { passive: true });
    const onKey = (e) => { if (["PageDown", "PageUp", "ArrowDown", "ArrowUp", "End", "Home"].includes(e.key)) nudge(); };
    overlay.addEventListener("keydown", onKey);
    // The search box: name, author and description, case-insensitive. `searchControl` owns the debounce.
    const searchRow = overlay.querySelector(".wp-searchrow");
    searchRow.innerHTML = ICON_SEARCH;
    const input = searchControl("", "Search worlds…", (q) => {
      const s = q.toLowerCase();
      shown = !s ? all : all.filter((w) => (w.meta.name + " " + (w.meta.description || "") + " " + (w.meta.author || "")).toLowerCase().includes(s));
      paint();
    });
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "hm-searchclear";
    clear.title = "Clear search";
    clear.setAttribute("aria-label", "Clear search");
    clear.textContent = "✕";
    clear.hidden = true;
    clear.onclick = (e) => {
      e.preventDefault();
      input.value = "";
      clear.hidden = true;
      shown = all;
      paint();
      input.focus();
    };
    input.addEventListener("input", () => { clear.hidden = !input.value; });
    searchRow.append(input, clear);
    paint();
    overlay.querySelector(".cc-panel").focus();
    const cancel = () => done(null);
    overlay.querySelectorAll(".wp-cancel").forEach((b) => (b.onclick = cancel));
    overlay.querySelector(".wp-create").onclick = () => { done(null); newWorld(); };
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) cancel(); });
    overlay.addEventListener("keydown", (e) => { if (e.key === "Escape") cancel(); });
  });
}

// World creation (Craft with AI, template picker, duplicates) lives in world-craft.js;
// scenario import (+ inbound shares) lives in scenario-import-panel.js (Batch 2). Both are
// wired in init() via initWorldCraft / initScenarioImport above — callers below are unchanged
// (same function names, now imported).

async function beginNewAdventure(preWorld = null, opts = {}) {
  if (generating) { notify("⏳ The GM is still writing…"); return; }
  try {
    if (state) await store.save(state, { touch: false });
  } catch (e) {
    if (isStorageError(e) || (e && e.isStorageUnavailable)) {
      console.warn("[adventure] autosave before new adventure failed:", (e && e.message) || e);
      notifyStorageError(notify, "saving", e);
      // Continue — the in-memory session is intact and the new adventure can still start.
    } else throw e;
  }
  const prev = state;
  // preWorld may arrive from a click handler (a MouseEvent) — only trust a real world object.
  let world = (preWorld && typeof preWorld === "object" && preWorld.meta && preWorld.meta.id) ? preWorld : null;
  if (!world) {
    // More than one world installed (bundled, your own, or added from Explore) → let the player
    // pick; otherwise go straight in. Storage failures fall back to bundled-only so starting
    // still works on a low-space device (this is the path that used to throw the raw
    // "database connection is closing" rejection).
    try {
      await loadAddedWorlds(false);
      const userCount = (await worldStore.list()).filter((e) => !bundledWorldForId(e.id)).length;
      if (bundledWorlds.length + userCount + homeAdded.items.length > 1) {
        world = await showWorldPicker();
        if (!world) return; // cancelled — stay where we were
      } else {
        world = bundledWorlds[0] || defaultWorld;
      }
    } catch (e) {
      if (isStorageError(e) || (e && e.isStorageUnavailable)) {
        console.warn("[adventure] world list unreadable (storage unavailable):", (e && e.message) || e);
        notifyStorageError(notify, "reading", e);
        world = bundledWorlds[0] || defaultWorld;
      } else throw e;
    }
  }
  try {
    await ensureWorldBound(world.meta.id);
  } catch (e) {
    if (isStorageError(e) || (e && e.isStorageUnavailable)) {
      console.warn("[adventure] world bind skipped (storage unavailable):", (e && e.message) || e);
      applyWorld(bundledWorlds[0] || defaultWorld);
      world = bundledWorlds[0] || defaultWorld;
    } else throw e;
  }
  const s = newSession(undefined, world.meta.id); // NOT persisted yet — the wizard only saves on
  // finalize, so canceling (or abandoning) the wizard leaves no unfinished session behind.
  // The character-creation wizard runs BEFORE the first message: the player forges the hero, then
  // finalizing enters the session (which generates the opening turn). Cancel deletes the session
  // and returns to wherever the player was.
  //
  // `opts.beforeOpen` closes the panel that launched us, and it runs HERE — one statement before the
  // wizard's overlay is built — so the two overlays swap inside a single task and the screen never
  // goes undimmed in between (see mountWorldSessions's `startNew`).
  if (opts.beforeOpen) opts.beforeOpen();
  openCharacterCreation(s, async () => {
    try { await enterSession(s); }
    catch (e) {
      if (isStorageError(e) || (e && e.isStorageUnavailable)) {
        console.warn("[adventure] session start failed (storage unavailable):", (e && e.message) || e);
        notifyStorageError(notify, "saving", e);
      } else { console.error("[adventure] session start failed:", e); notify("✖ Couldn't start that adventure: " + (e.message || e), { ms: 5200 }); }
    }
  }, async () => {
    // Nothing was saved, so there's normally nothing to clean up — the best-effort remove below
    // just guards against a stale blob with this id (e.g. from an earlier abandoned wizard).
    await store.remove(s.id).catch(() => {});
    state = prev;
    try {
      if (prev) await store.setActive(prev.id);
      else await store.setActive(null);
    } catch (e) { /* pointer is a nicety on cancel */ }
    if (prev) {
      try { await enterSession(prev); }
      catch (e) {
        if (isStorageError(e) || (e && e.isStorageUnavailable)) notifyStorageError(notify, "reading", e);
        else notify("✖ Couldn't return to the previous adventure: " + (e.message || e), { ms: 5200 });
      }
    }
    // No previous session means we came from the home shell, which is still mounted underneath —
    // the abandoned wizard saved nothing, so there is nothing to refresh. (Re-rendering landing
    // here force-remounted the page below and flashed e.g. a profile through "Loading profile…".)
  });
}

async function doImport(file, inputEl) {
  if (!file) return;
  try {
    const data = parseImported(await file.text());
    // Same-id collision: an earlier import (or a backup restore) already uses this id.
    // Ask before touching it — Replace overwrites, Duplicate imports as a copy with a new id.
    let sessions = [];
    try { sessions = await store.list(); } catch (e) { sessions = []; }
    let existing = sessions.find((s) => s && s.id === data.id) || null;
    if (!existing) {
      try {
        const full = await store.load(data.id);
        if (full) existing = { id: full.id, name: full.name };
      } catch (e) { /* index miss + no blob = genuinely new */ }
    }
    if (existing) {
      const existingName = String(existing.name || data.name || data.id);
      const incomingName = String(data.name || data.id);
      const choice = await ConfirmPopup.choose({
        title: "Adventure already exists",
        message: existingName === incomingName
          ? `An adventure named "${existingName}" with this id already exists. Replace it, or keep both by importing a copy?`
          : `An adventure with this id already exists ("${existingName}"). The file you're importing is "${incomingName}". Replace the existing adventure, or keep both by importing a copy?`,
        options: [
          { label: "Duplicate", value: "duplicate", kind: "ok" },
          { label: "Replace", value: "replace", kind: "warn" }
        ],
        cancelText: "Cancel"
      });
      if (!choice) { if (inputEl) inputEl.value = ""; return; }
      if (choice === "duplicate") {
        const takenIds = new Set(sessions.map((s) => s && s.id).filter(Boolean));
        let nid = "";
        do { nid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); } while (takenIds.has(nid));
        data.id = nid;
        // Mark the copy in its name, keeping it unique against the shelf.
        const takenNames = new Set(sessions.map((s) => String((s && s.name) || "").trim().toLowerCase()));
        const root = String(data.name || "Adventure").trim().replace(/\s*\(copy( \d+)?\)\s*$/i, "") || "Adventure";
        let cand = `${root} (copy)`;
        for (let n = 2; takenNames.has(cand.toLowerCase()); n++) cand = `${root} (copy ${n})`;
        data.name = cand;
      }
      // "replace" keeps data.id, so store.save below overwrites the existing adventure.
    }
    const wid = await chooseWorldForUnbound(data.worldId || defaultWorld.meta.id, data.worldName);
    if (!wid) {
      // Cancelled the world picker — keep the import as unbound (its original worldId) instead of
      // discarding it. Stay on the list rather than entering: entering now would run the default
      // world's content under a mismatched binding and clobber the worldName snapshot, and the
      // ⚠ row's own open flow brings the picker back when the adventure is actually opened.
      const s = normalize(data);
      compactVersionArchives(s);
      try { await store.save(s); }
      catch (e) {
        if (isStorageError(e) || (e && e.isStorageUnavailable)) notifyStorageError(notify, "saving", e);
        else throw e;
      }
      if (inputEl) inputEl.value = "";
      notify(`Adventure "${s.name || "Untitled adventure"}" imported — its world isn't installed, so it stays unbound until you choose one.`);
      refreshLanding();
      return;
    }
    data.worldId = wid;
    await ensureWorldBound(wid);
    const s = normalize(data);
    compactVersionArchives(s);
    try { await store.save(s); }
    catch (e) {
      if (isStorageError(e) || (e && e.isStorageUnavailable)) notifyStorageError(notify, "saving", e);
      else throw e;
    }
    if (inputEl) inputEl.value = "";
    try { await enterSession(s); }
    catch (e) {
      if (isStorageError(e) || (e && e.isStorageUnavailable)) notifyStorageError(notify, "reading", e);
      else throw e;
    }
  } catch (err) {
    // A storage failure already toasted its friendly sentence above — don't also pop an "Import
    // failed" dialog with IDB jargon for the same event.
    if (isStorageError(err) || (err && err.isStorageUnavailable)) {
      console.warn("[import] failed (storage unavailable):", (err && err.message) || err);
      if (inputEl) inputEl.value = "";
      return;
    }
    // The classic mix-up: a full backup dropped on ⭱ Import Save. Offer the restore flow
    // directly instead of a dead-end error.
    if (err && err.isBackupFile) {
      const go = await ConfirmPopup.choose({
        title: "That's a backup file",
        message: err.message,
        options: [{ label: "Open Data & Backup", value: "backup", kind: "ok" }],
        cancelText: "Close"
      });
      if (go === "backup") { try { openSettingsPanel("backup"); } catch (e) {} }
      if (inputEl) inputEl.value = "";
      return;
    }
    await ConfirmPopup.open({ title: "Import failed", message: err.message, confirmText: "OK" });
    if (inputEl) inputEl.value = "";
  }
}

/* ---------- chat flow ---------- */
function autoGrowInput() {
  const el = $("inputEl");
  el.style.height = "auto";
  const max = Math.round(window.innerHeight * 0.5);
  el.style.height = Math.min(el.scrollHeight, max) + "px";
}

async function send() {
  if (generating) return;
  if (isGameOver()) { notify("☠ Your story has ended — delete or re-roll the fatal turn to undo fate."); return; }
  // Mobile: drop focus on send so the on-screen keyboard dismisses for the read-back phase.
  // The input itself stays enabled (see setLoading) — this only affects the keyboard.
  if (IS_MOBILE) $("inputEl").blur();
  const text = $("inputEl").value.trim();
  $("inputEl").value = "";
  autoGrowInput();
  if (text) {
    await submitAction(text);
  } else {
    // Empty send with the transcript ending on an unanswered player action (its reply was
    // deleted) retries that action instead of stacking a new idle turn on top of it — the
    // anchor is already counted, so only the reply is regenerated, like a re-roll.
    const msgs = state.messages || [];
    const last = msgs.length ? msgs[msgs.length - 1] : null;
    if (last && (last.role === "action" || last.role === "direct")) {
      const kind = last.kind || (last.role === "direct" ? "direct" : "action");
      const actionText = String(last.text || "").trim() || null;
      const history = msgs.slice(0, msgs.length - 1);
      await runGmTurn({ history, actionText, kind, opening: false });
      await saveAndMaybeMemory();
    } else {
      // empty send → the hero waits. This anchors its OWN turn (an empty-text `Waiting`
      // bubble, `role:"action" kind:"idle"`) so the reply stands alone and the turn can be
      // deleted/re-rolled like any other — the turn counter advances exactly as below.
      const history = state.messages.slice();
      state.messages.push({ role: "action", kind: "idle", text: "", ts: Date.now() });
      state.messageCount++;
      state.turn++;
      render();
      await runGmTurn({ history, actionText: null, kind: "idle", opening: false });
      await saveAndMaybeMemory();
    }
  }
}

// Submit a player action as the anchor of a new turn — the shared path behind the composer's send
// (button/Enter) AND the CYOA choice buttons (partEl). A clicked option is therefore indistinguishable
// from a typed action: it lands in the transcript as a normal right-aligned action bubble and the
// GM responds to it exactly as usual.
async function submitAction(rawText) {
  const text = String(rawText || "").trim();
  if (!text || generating) return;
  if (isGameOver()) { notify("☠ Your story has ended — delete or re-roll the fatal turn to undo fate."); return; }
  state.messages.push({ role: "action", text, ts: Date.now() });
  state.messageCount++;
  state.turn++;
  render();
  const history = state.messages.slice(0, state.messages.length - 1);
  await runGmTurn({ history, actionText: text });
  await saveAndMaybeMemory();
}

async function startNewSession() {
  await runGmTurn({ history: [], actionText: null, opening: true });
  state.openingRerolls = {};
  state.openingRerollIndex = 0;
  try { await store.save(state); }
  catch (e) {
    if (isStorageError(e) || (e && e.isStorageUnavailable)) {
      console.warn("[session] opening save failed (storage unavailable):", (e && e.message) || e);
      notifyStorageError(notify, "saving", e);
      // Continue — the opening is in memory and playable; it just isn't persisted yet.
    } else throw e;
  }
}

/* ---------- commands (the ⋮ menu next to the input) ---------- */
const COMMANDS = [
  {
    id: "direct",
    name: "⚡ Direct",
    desc: "Steer the scene — weave your direction into the story",
    run: runDirectCommand
  },
  {
    id: "advance",
    name: "⏩ Advance",
    desc: "Conclude the current scene and start the next one",
    run: runAdvanceCommand
  },
  {
    id: "scene",
    name: "🎨 Scene Image",
    desc: "Generate an image of the current scene",
    run: runSceneCommand
  }
];


/* ---------- map panel ---------- */

// Current location from the derived tracker state (falls back to "" before any GM reply).
function currentLocation() {
  return locationValue(trackerDefs, deriveCurrentTrackers(state, trackerDefs));
}

// Canonical map region for the current tracker location (normalizeLoc lowercases and strips the
// em/en-dash detail suffix, so "Thornwood — Guild hall" and "Thornwood — Wilted Flagon" are the
// same map region — small in-fiction moves don't trigger pointless rebuilds or re-feeds).
function currentLocKey() {
  return normalizeLoc(currentLocation());
}

// Is there any GM narration yet? The mapmaker reads recent narration as canon — a map built
// before the opening turn has landed has no story to map, so auto-builds are deferred until then.
function hasNarrative() {
  return (state.messages || []).some((m) => m.role === "narrator" && m.text);
}

// Regenerate the surroundings map when the Location region changed (or on first entry). Uses a
// dedicated non-narrator AI call (MapSystem) and caches POIs per region so returning to a place
// is instant and consistent.
async function maybeRefreshMap() {
  if (!state || mapGenBusy) return;
  // Don't race a GM reply that's still streaming: a map built mid-turn has no (or partial) story
  // context, so places the opening/turn introduces would be missing. Defer and let the post-turn
  // maybeRefreshMap build it once the reply has landed.
  if (generating) { pendingMapRefresh = true; return; }
  // Brand-new adventure with no narration yet (the opening hasn't been written — this can happen
  // because the map panel renders during session setup, before the GM starts writing): a map built
  // now has no story context. Defer the same way; the post-turn maybeRefreshMap builds it with the
  // opening as canon.
  if (!hasNarrative()) { pendingMapRefresh = true; return; }
  const key = currentLocKey();
  if (!key) return;
  // A ready or failed map for this region — don't rebuild (or burn quota re-trying an error)
  // unless the user explicitly force-refreshes.
  if (state.map && state.map.loc === key && (state.map.status === "ready" || state.map.status === "error")) return;
  await buildMapForLoc(currentLocation(), false);
}

// Actions that hint the hero is moving around / cares about the surroundings — the GM needs the
// map even mid-location. Heuristic, not exhaustive: if in doubt, include (cheap, one turn only).
const TRAVEL_RE = /(\bgo(?:ing)?\b|\bhead(?:ed|ing)?\b|\bwalk(?:ed|ing)?\b|\bride\b|\btravel(?:led|ling)?\b|\bjourney(?:ed)?\b|\bset out\b|\bdepart(?:ed|ing)?\b|\bleave\b|\breturn(?:ed|ing)?\b|\bapproach(?:ed|ing)?\b|\bwander(?:ed|ing)?\b|\bstroll(?:ed|ing)?\b|\bvisit(?:ed|ing)?\b|\bfollow(?:ed|ing)?\b|\bexplore(?:d|ing)?\b|\bscout(?:ed|ing)?\b|\bmake (?:our|my) way\b|\blook(?:ing)? around\b|\bnorth\b|\bsouth\b|\beast\b|\bwest\b|\bnearby\b|\baround here\b|\bin the area\b|\btoward\w*\b)/i;

// Decide whether this turn's GM context should include the SURROUNDINGS map section, and which
// location's map. Returns the region key to feed (or null to skip). Fed when the hero is in a
// region the GM hasn't seen yet (state.surroundingsLoc), when the hero moved to a NEW spot within
// the region (state.surroundingsPos — so the GM's distances are current), on scene transitions
// (advance), or when the action sounds like travel/exploration.
function surroundingsToFeed(state, actionText, kind) {
  const key = currentLocKey();
  if (!key) return null;
  const map = state.map;
  if (!map || map.status !== "ready" || !map.pois || !map.pois.length || map.loc !== key) return null;
  if (key !== normalizeLoc(state.surroundingsLoc)) return key;
  if (state.surroundingsPos) {
    const hx = (map.hero && map.hero.x) || 0, hy = (map.hero && map.hero.y) || 0;
    // Re-feed once the hero has genuinely moved WITHIN the region — the threshold is the map's own
    // scale (30 m outdoors, 5 km on a regional map, ...), so a space map isn't re-fed on noise.
    const moveT = mapScale(map.scale || "outdoor").move;
    if (Math.hypot(hx - state.surroundingsPos.x, hy - state.surroundingsPos.y) > moveT) return key;
  }
  if (kind === "travel" || kind === "advance") return key;
  if (actionText && TRAVEL_RE.test(actionText)) return key;
  return null;
}
async function forceMapRefresh() {
  if (!state || mapGenBusy) return;
  // Same race guard as maybeRefreshMap: defer an explicit refresh until the current GM reply lands.
  if (generating) { pendingMapRefresh = true; return; }
  const loc = currentLocation();
  if (!normalizeLoc(loc)) return;
  // Intentionally do NOT delete the cache: if the rebuild fails we keep showing the old map.
  await buildMapForLoc(loc, true);
}

// Position the hero in the current region's map, in the map's own unit (region center = 0,0). POIs carry
// their own absolute local coords (their dx/dy from center), so if the location label's dash-detail
// names one of them (fuzzy) the hero snaps to that spot; if it only matches by type ("Thornwood —
// tavern" when the map has "The Wilted Flagon" tavern) the hero snaps to that; otherwise the label
// names a spot that isn't on the map yet — a same-region move like "Thornwood — Guild hall" →
// "Thornwood — tavern" — so the spot is added as a POI (a short walk from the hero's previous
// position) and the hero is placed there. Returns { pois, hero }.
function positionHeroInRegion(pois, fallbackHero, scaleKey) {
  const loc = currentLocation();
  const detail = locDetail(loc);
  const prev = fallbackHero || { x: 0, y: 0 };
  if (!detail) return { pois, hero: prev, added: null };
  const m = matchPoi(detail, pois);
  if (m) return { pois, hero: { x: m.dx, y: m.dy }, added: null };
  const np = makeLocalPoi(detail, prev, pois, scaleKey);
  pois.push(np);
  return { pois, hero: { x: np.dx, y: np.dy }, added: np };
}

// Build a POI for a same-region spot the map doesn't have yet. The type/icon can't be known without
// the (deliberately non-fixed) mapmaker vocabulary, so it stays generic here — the mapmaker assigns
// a real type and icon when this region's map is next (re)built. The spot is placed a short walk
// from the hero's previous position, in a direction that keeps it clear of the existing POIs and
// inside the local map's span.
function makeLocalPoi(name, prev, pois, scaleKey) {
  const clean = String(name || "").trim().replace(/\s+/g, " ").slice(0, 60);
  const type = "poi";
  const sc = mapScale(scaleKey);
  const W = sc.walk[0], MAX = sc.walk[1], LIM = sc.band[1] * 1.2;
  let best = null, bestScore = -Infinity;
  for (let a = 0; a < 32; a++) {
    const ang = (a / 32) * Math.PI * 2 + Math.random() * (Math.PI / 32);
    const dist = W + Math.random() * (MAX - W);
    const x = roundCoord(scaleKey, (prev.x || 0) + Math.cos(ang) * dist);
    const y = roundCoord(scaleKey, (prev.y || 0) + Math.sin(ang) * dist);
    const dClosest = pois.reduce((m, p) => Math.min(m, Math.hypot((p.dx || 0) - x, (p.dy || 0) - y)), Infinity);
    const score = (Math.abs(x) <= LIM && Math.abs(y) <= LIM ? 0 : -1e6) + Math.min(dClosest, LIM);
    if (score > bestScore) { bestScore = score; best = { x, y }; }
  }
  if (!best) best = { x: prev.x || 0, y: prev.y || 0 };
  // Stub: just the place's name as text. `needsBrief` marks it for the background POI enricher,
  // which fills in the real type/icon/description without blocking the move.
  return { name: clean, type, dx: best.x, dy: best.y, desc: clean, icon: DEFAULT_ICON, needsBrief: true };
}

// Read a region's cache entry, tolerating the legacy array shape ({pois} migrated to {pois, hero}).
function cacheEntry(key) {
  const e = (state.mapCache || {})[key];
  if (!e) return null;
  return Array.isArray(e) ? { pois: e, hero: null, scale: null } : { pois: e.pois || [], hero: e.hero || null, scale: e.scale || null };
}

// After the location tracker changes (a turn, delete, re-roll, etc.), re-derive the hero's position
// within the SAME region from the new label and re-render the map panel if it shifted. A label that
// names a spot not on the map yet adds it (positionHeroInRegion). Region changes are handled by
// buildMapForLoc itself.
function refreshHeroPos() {
  if (!state || !state.map || state.map.status !== "ready") return;
  const key = currentLocKey();
  if (!key || state.map.loc !== key) return;
  const pois = state.map.pois || [];
  const prev = state.map.hero || { x: 0, y: 0 };
  const scaleKey = state.map.scale || inferScaleFromPois(pois, prev);
  const r = positionHeroInRegion(pois, prev, scaleKey);
  const added = !!r.added;
  const changed = added || !state.map.hero || r.hero.x !== prev.x || r.hero.y !== prev.y;
  state.map.hero = r.hero;
  state.map.scale = scaleKey;
  state.mapCache = state.mapCache || {};
  state.mapCache[key] = { pois: r.pois, hero: r.hero, scale: scaleKey };
  if (added) queuePoiEnrich(key);
  if (changed && rightSec === "map" && isRailOpen("right")) syncRail("right");
}

// Background POI enricher: fills in engine-added stub POIs (`needsBrief`, or the legacy shape of
// type "poi" with the name as its whole description) one small AI call at a time, without ever
// blocking movement or map rendering. Serialised through a chain so concurrent triggers can't
// interleave saves; silent on failure (the stub stays, retry after a cooldown).
let poiEnrichChain = Promise.resolve();
const poiEnrichInflight = new Set();
const POI_ENRICH_RETRY_MS = 5 * 60 * 1000;

function poiNeedsBrief(p) {
  if (!p || typeof p.name !== "string" || !p.name) return false;
  if (p.needsBrief) return true;
  return p.type === "poi" && p.desc === p.name;
}

function poiEnrichDue(p) {
  return poiNeedsBrief(p) && !poiEnrichInflight.has(p) &&
    (!p.enrichTriedAt || Date.now() - p.enrichTriedAt > POI_ENRICH_RETRY_MS);
}

function queuePoiEnrich(regionKey) {
  if (!regionKey || !mapSys) return;
  poiEnrichChain = poiEnrichChain.then(() => enrichPoisInRegion(regionKey)).catch((e) => console.error("poi enrich failed:", e));
}

function livePoi(st, regionKey, poi) {
  const e = (st.mapCache || {})[regionKey];
  const arr = Array.isArray(e) ? e : (e && e.pois);
  if (Array.isArray(arr) && arr.includes(poi)) return poi;
  if (st.map && st.map.loc === regionKey && (st.map.pois || []).includes(poi)) return poi;
  return null;
}

async function enrichPoisInRegion(regionKey) {
  for (;;) {
    const st = state;
    if (!st || !mapSys) return;
    const e = (st.mapCache || {})[regionKey];
    const arr = Array.isArray(e) ? e : (e && e.pois);
    if (!Array.isArray(arr)) return;
    const scaleKey = (e && e.scale) || (st.map && st.map.loc === regionKey && st.map.scale) || inferScaleFromPois(arr, null);
    const poi = arr.find(poiEnrichDue);
    if (!poi) return;
    poiEnrichInflight.add(poi);
    try {
      const filled = await mapSys.describePoi(st, regionKey, poi.name, scaleKey);
      if (state !== st) return;
      const live = livePoi(st, regionKey, poi);
      if (!live) continue;
      if (!filled) { live.enrichTriedAt = Date.now(); continue; }
      live.name = filled.name;
      live.type = filled.type;
      live.icon = filled.icon;
      live.desc = filled.desc;
      delete live.needsBrief;
      delete live.enrichTriedAt;
      try { await store.save(st); }
      catch (e) {
        if (isStorageError(e) || (e && e.isStorageUnavailable)) notifyStorageError(notify, "saving", e);
        else throw e;
      }
      if (rightSec === "map" && isRailOpen("right")) syncRail("right");
    } finally {
      poiEnrichInflight.delete(poi);
    }
  }
}

// Drop any in-flight map build's claim on `mapGenBusy`. Called when the open session is torn down
// (leaving for the landing, deleting the session you're in): the abandoned build can't be cancelled
// mid-AI-call, and it self-aborts on its identity check — but it must not keep the NEXT session's
// map panel stuck on "Mapping the surroundings…" while it finishes, and its late completion must
// not clear a newer build's busy flag (hence the token).
function cancelMapBuild() {
  mapBusyToken = null;
  mapGenBusy = false;
  pendingMapRefresh = false;
}

async function buildMapForLoc(loc, force) {
  const key = normalizeLoc(loc);
  if (!key || !state) return;
  // Everything below runs across an awaited AI call, so it must be robust against the user leaving
  // the adventure (or deleting it) mid-build: `state` is nulled by goToLanding/delete-while-open.
  // We therefore work on the captured session object and bail the moment it stops being the live
  // one (`alive()`), so a stale build never writes to a dead/other session (or throws on null).
  const st = state;
  const alive = () => state === st;
  const token = {};
  mapBusyToken = token;
  mapGenBusy = true;
  try {
    const cached = cacheEntry(key);
    if (!force && cached && cached.pois && cached.pois.length) {
      // Returning to a known region: reuse its POIs AND the hero's last position there (the
      // current label may snap the hero to a POI, or add a new one if it names an unmapped spot).
      const scaleKey = cached.scale || inferScaleFromPois(cached.pois, cached.hero);
      const r0 = positionHeroInRegion(cached.pois, cached.hero, scaleKey);
      st.map = { loc: key, status: "ready", pois: r0.pois, at: st.turn, hero: r0.hero, scale: scaleKey };
      st.mapCache[key] = { pois: r0.pois, hero: r0.hero, scale: scaleKey };
      queuePoiEnrich(key);
    } else {
      // The hero arrived from another region — hand the AI the previous map (including where the
      // hero stood, so the place they came from is always kept) so it can keep landmarks/POIs that
      // plausibly span the boundary. Not fed on a same-region ↻ refresh (that would just make the
      // AI regenerate its own map).
      const prevMap = (st.map && st.map.loc !== key && st.map.status === "ready" && st.map.pois && st.map.pois.length)
        ? { loc: st.map.loc, pois: st.map.pois, hero: st.map.hero || { x: 0, y: 0 }, scale: st.map.scale || null } : null;
      st.map = { loc: key, status: "loading", pois: null, at: st.turn };
      if (rightSec === "map" && isRailOpen("right")) syncRail("right");
      const built = await mapSys.buildPois(st, loc, prevMap);
      // The session was closed/replaced while the mapmaker was running — drop the result.
      if (!alive()) return;
      const pois = (built && built.pois) || [];
      const scaleKey = (built && built.scale) || inferScaleFromPois(pois, null);
      if (pois.length) {
        // A fresh build recenters the world on the hero: position 0,0 — unless the label names a
        // (possibly preserved) POI, which snaps the hero to it (e.g. arriving through a gate).
        const r1 = positionHeroInRegion(pois, null, scaleKey);
        st.map = { loc: key, status: "ready", pois: r1.pois, at: st.turn, hero: r1.hero, scale: scaleKey };
        st.mapCache = st.mapCache || {};
        st.mapCache[key] = { pois: r1.pois, hero: r1.hero, scale: scaleKey };
        const keys = Object.keys(st.mapCache);
        if (keys.length > 12) for (const k of keys.slice(0, keys.length - 12)) delete st.mapCache[k];
        queuePoiEnrich(key);
      } else if (cached && cached.pois && cached.pois.length) {
        // The AI call came back empty but we already have a good map for this region — keep it.
        const cachedScale = cached.scale || inferScaleFromPois(cached.pois, cached.hero);
        const r2 = positionHeroInRegion(cached.pois, cached.hero, cachedScale);
        st.map = { loc: key, status: "ready", pois: r2.pois, at: st.turn, hero: r2.hero, scale: cachedScale };
        st.mapCache[key] = { pois: r2.pois, hero: r2.hero, scale: cachedScale };
        queuePoiEnrich(key);
      } else {
        // Legitimately nothing nearby (or an unparseable reply) — distinct "nothing" state.
        st.map = { loc: key, status: "ready", pois: [], at: st.turn, hero: { x: 0, y: 0 }, scale: scaleKey };
      }
    }
    try { await store.save(st); }
    catch (e) {
      if (isStorageError(e) || (e && e.isStorageUnavailable)) notifyStorageError(notify, "saving", e);
      else if (alive()) throw e;
    }
    if (rightSec === "map" && isRailOpen("right")) syncRail("right");
  } catch (e) {
    // A stale build's failure is expected noise (the session went away); only report a live one.
    if (alive()) console.error("map build failed:", e);
    if (!alive()) return;
    const cached = cacheEntry(key);
    if (cached && cached.pois && cached.pois.length) {
      const scaleKey = cached.scale || inferScaleFromPois(cached.pois, cached.hero);
      const r3 = positionHeroInRegion(cached.pois, cached.hero, scaleKey);
      st.map = { loc: key, status: "ready", pois: r3.pois, at: st.turn, hero: r3.hero, scale: scaleKey };
      st.mapCache[key] = { pois: r3.pois, hero: r3.hero, scale: scaleKey };
      queuePoiEnrich(key);
    } else {
      st.map = { loc: key, status: "error", pois: null, at: st.turn };
    }
    try { await store.save(st); }
    catch (saveErr) {
      if (isStorageError(saveErr) || (saveErr && saveErr.isStorageUnavailable)) notifyStorageError(notify, "saving", saveErr);
      else if (alive()) throw saveErr;
    }
    if (rightSec === "map" && isRailOpen("right")) syncRail("right");
  } finally {
    // Only release the busy flag if this build still owns it — a build abandoned by a session
    // teardown (cancelMapBuild) has already handed it to whatever came next.
    if (mapBusyToken === token) {
      mapBusyToken = null;
      mapGenBusy = false;
      // The hero may have moved on while we were generating — catch up if so.
      if (alive()) {
        const nowKey = currentLocKey();
        if (nowKey && st.map && st.map.loc !== nowKey) setTimeout(() => maybeRefreshMap(), 0);
      }
    }
  }
}

function renderMapPanel(body) {
  const loc = currentLocation();
  if (!loc) {
    body.innerHTML = locationTracker(trackerDefs)
      ? `<div class="map-state">No location yet.<br>The map will appear once your adventure begins.</div>`
      : `<div class="map-state">This world has no location tracker.<br>It's required to enable the map feature.</div>`;
    return;
  }
  const ctn = document.createElement("div");
  ctn.className = "map-content";
  body.innerHTML = "";
  body.appendChild(ctn);
  renderLocalPanel(ctn);
}

// The hero's live surroundings map for the current region.
function renderLocalPanel(ctn) {
  ctn.innerHTML = "";
  const loc = currentLocation();
  const key = normalizeLoc(loc);
  // No map built for this region yet — kick one off. (Not a retry loop: once a build has been
  // attempted — success, empty, or failure — state.map.loc matches this key and this branch stops
  // firing.) A "loading" marker with no build actually in flight is stale — the session was torn
  // down mid-build, or the tab was reloaded while mapping — so it's rebuilt here instead of
  // leaving the panel spinning forever.
  const staleLoading = state.map && state.map.status === "loading" && !mapBusyToken;
  if (!state.map || state.map.loc !== key || staleLoading) {
    ctn.innerHTML = `<div class="map-state"><div class="spin"></div>Mapping the surroundings…</div>`;
    maybeRefreshMap();
    return;
  }
  if (state.map.status === "loading") {
    ctn.innerHTML = `<div class="map-state"><div class="spin"></div>Mapping the surroundings…</div>`;
    return;
  }
  if (state.map.status === "error") {
    ctn.innerHTML = `<div class="map-state">⚠ The map failed to generate.</div>
      <div class="map-state-cta"><button class="mini ok" id="mapRetry">Try again</button></div>`;
    ctn.querySelector("#mapRetry").onclick = () => forceMapRefresh();
    return;
  }
  const pois = state.map.pois || [];
  if (!pois.length) {
    ctn.innerHTML = `<div class="map-state">Nothing of note nearby — the map came back empty.</div>
      <div class="map-state-cta"><button class="mini ok" id="mapRetry">Try again</button></div>`;
    ctn.querySelector("#mapRetry").onclick = () => forceMapRefresh();
    return;
  }
  const hero = state.map.hero || { x: 0, y: 0 };
  if ((pois || []).some(poiEnrichDue)) queuePoiEnrich(key);
  const head = document.createElement("div");  head.className = "map-head";
  head.innerHTML = `<span class="loc">📍 ${esc(loc)}</span>
    <button class="mini" id="mapRefresh" title="Regenerate the surrounding points of interest">↻</button>`;
  ctn.appendChild(head);
  // Nearest-first: the list and the map both read from the same arranged array, so a marker's
  // data-idx still lines up with its list row (row ⇄ marker hover highlight).
  const ordered = sortPoisByDistance(pois, hero);
  const scaleKey = state.map.scale || inferScaleFromPois(pois, hero);
  ctn.appendChild(buildMapSvg(ordered, hero, scaleKey));
  ctn.appendChild(buildMapList(ordered, hero, scaleKey));
  ctn.querySelector("#mapRefresh").onclick = () => forceMapRefresh();
}

// Distance from the hero to a POI, in the map's own unit (meters, km, AU or ly).
function poiDistance(p, hero) {
  return Math.hypot((p.dx || 0) - ((hero && hero.x) || 0), (p.dy || 0) - ((hero && hero.y) || 0));
}

// A copy of the POIs ordered nearest → furthest from the hero (the "here" POI, at distance 0, sits
// on top). Sorted by distance from the HERO (not the map center), since the hero can stand off-center.
function sortPoisByDistance(pois, hero) {
  return (pois || []).slice().sort((a, b) => poiDistance(a, hero) - poiDistance(b, hero));
}

// Pick a view half-extent (in the map's own unit) that fits the POIs with a little margin — snapped
// to a "nice" 1-1.5-2-3-4-6-8 × 10ⁿ value so the rings and scale bar read clean. This is what lets a
// 15 m kitchen, a 900 m landmark and a 3 ly star lane all render at a sensible zoom: the span follows
// the actual spread of the map at whatever magnitude it lives at.
const NICE_STEPS = [1, 1.5, 2, 3, 4, 6, 8];
function niceMapSpan(reach) {
  const need = Math.max(Number(reach) || 0, 1e-9) * 1.08;
  const mag = Math.pow(10, Math.floor(Math.log10(need)));
  for (const s of NICE_STEPS) { const v = s * mag; if (v >= need) return v; }
  return 10 * mag;
}

function buildMapSvg(pois, hero, scaleKey) {
  const S = 320, C = S / 2;
  const hx = (hero && hero.x) || 0, hy = (hero && hero.y) || 0;
  let reach = 0;
  for (const p of pois) reach = Math.max(reach, Math.abs((p.dx || 0) - hx), Math.abs((p.dy || 0) - hy));
  const SPAN = niceMapSpan(reach);
  const GRID = SPAN / 4;
  const RINGS = [SPAN * 0.25, SPAN * 0.5, SPAN * 0.75];
  const SCALE = SPAN / 2, SCALE_LABEL = formatDistance(SCALE, scaleKey);
  const PPM = C / SPAN;
  const px = (m) => C + m * PPM;
  const py = (m) => C - m * PPM;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${S} ${S}`);
  svg.setAttribute("class", "map-svg");

  for (let g = -SPAN; g <= SPAN; g += GRID) {
    if (g === 0) continue;
    const v = document.createElementNS(ns, "line");
    v.setAttribute("x1", px(g)); v.setAttribute("y1", 0); v.setAttribute("x2", px(g)); v.setAttribute("y2", S);
    v.setAttribute("class", "grid");
    svg.appendChild(v);
    const h = document.createElementNS(ns, "line");
    h.setAttribute("x1", 0); h.setAttribute("y1", py(g)); h.setAttribute("x2", S); h.setAttribute("y2", py(g));
    h.setAttribute("class", "grid");
    svg.appendChild(h);
  }
  for (const r of RINGS) {
    const ring = document.createElementNS(ns, "circle");
    ring.setAttribute("cx", C); ring.setAttribute("cy", C); ring.setAttribute("r", r * PPM);
    ring.setAttribute("class", "ring");
    svg.appendChild(ring);
  }

  const clampPoi = (p) => {
    const ex = (p.dx || 0) - hx, ey = (p.dy || 0) - hy;
    const lim = SPAN * 0.94, m = Math.max(Math.abs(ex), Math.abs(ey));
    if (m <= lim) return { dx: ex, dy: ey };
    const k = lim / m;
    return { dx: ex * k, dy: ey * k };
  };
  const spots = pois.map((p) => {
    const { dx, dy } = clampPoi(p);
    return { p, x: px(dx), y: py(dy) };
  });
  // Readability guard: the hero marker pulses at the center, so any POI dot that would land on top
  // of it (other than the hero's own current-place POI, which sits at the center by design) is
  // nudged outward along its bearing until it clears the halo. The list rows stay the source of
  // truth for exact distances — this only keeps the map itself legible.
  const MIN_R = 28;
  let nearestIdx = -1, nd = Infinity;
  spots.forEach((s, i) => {
    const d = Math.hypot(s.x - C, s.y - C);
    if (d < nd) { nd = d; nearestIdx = i; }
  });
  spots.forEach((s, i) => {
    if (i === nearestIdx) return;
    const d = Math.hypot(s.x - C, s.y - C);
    if (d < MIN_R) {
      const a = Math.atan2(s.y - C, s.x - C);
      s.x = C + Math.cos(a) * MIN_R;
      s.y = C + Math.sin(a) * MIN_R;
    }
  });
  // Simple label de-collision: greedy stack of the name labels below their dots so crowded
  // clusters don't pile names on top of each other.
  const labelRects = [];
  // Reserve the center "here" zone (the pulse + its tag) so labels stack clear of it.
  labelRects.push({ cx: C, w: 40, ty: C + 15 });
  const labelAt = (x, y, name, hidden) => {
    const label = name.length > 16 ? name.slice(0, 15) + "…" : name;
    const w = Math.min(label.length, 16) * 5.8 + 8;
    let lx = Math.min(Math.max(x, w / 2 + 2), S - w / 2 - 2);
    let ly = y + 24;
    const collides = (tx, ty) => {
      for (const r of labelRects) {
        if (Math.abs(r.cx - tx) < (r.w + w) / 2 - 2 && ty < r.ty + 12 && ty + 12 > r.ty - 1) return true;
      }
      return false;
    };
    while (collides(lx, ly) && ly < 300) ly += 13;
    if (!hidden) labelRects.push({ cx: lx, w, ty: ly });
    return { label, lx, ly };
  };
  spots.forEach(({ p, x, y }, i) => {
    const { label, lx, ly } = labelAt(x, y, p.name);
    const g = document.createElementNS(ns, "g");
    g.setAttribute("class", "map-poi");
    g.dataset.idx = i;
    const dot = document.createElementNS(ns, "circle");
    dot.setAttribute("cx", x); dot.setAttribute("cy", y); dot.setAttribute("r", 11);
    dot.setAttribute("class", "dot");
    g.appendChild(dot);
    const ic = document.createElementNS(ns, "text");
    ic.setAttribute("x", x); ic.setAttribute("y", y + 4.5);
    ic.setAttribute("text-anchor", "middle"); ic.setAttribute("font-size", 12);
    ic.textContent = p.icon;
    g.appendChild(ic);
    const nm = document.createElementNS(ns, "text");
    nm.setAttribute("x", lx); nm.setAttribute("y", ly);
    nm.setAttribute("text-anchor", "middle"); nm.setAttribute("class", "nm");
    nm.textContent = label;
    g.appendChild(nm);
    g.addEventListener("mouseenter", () => highlightMapPoi(i));
    g.addEventListener("mouseleave", clearMapHighlight);
    svg.appendChild(g);
  });

  const you = document.createElementNS(ns, "g");
  you.setAttribute("class", "map-you");
  const halo = document.createElementNS(ns, "circle");
  halo.setAttribute("cx", C); halo.setAttribute("cy", C); halo.setAttribute("r", 14);
  halo.setAttribute("class", "you-halo");
  you.appendChild(halo);
  const pulse = document.createElementNS(ns, "circle");
  pulse.setAttribute("cx", C); pulse.setAttribute("cy", C); pulse.setAttribute("r", 8);
  pulse.setAttribute("class", "ring-pulse");
  you.appendChild(pulse);
  const core = document.createElementNS(ns, "circle");
  core.setAttribute("cx", C); core.setAttribute("cy", C); core.setAttribute("r", 7);
  core.setAttribute("class", "core");
  you.appendChild(core);
  const tag = document.createElementNS(ns, "text");
  tag.setAttribute("x", C); tag.setAttribute("y", C + 26);
  tag.setAttribute("text-anchor", "middle"); tag.setAttribute("class", "you-tag");
  tag.textContent = "here";
  you.appendChild(tag);
  svg.appendChild(you);

  const comp = document.createElementNS(ns, "g");
  comp.setAttribute("class", "map-compass");
  const tri = document.createElementNS(ns, "path");
  tri.setAttribute("d", `M ${S - 24} 12 L ${S - 18} 22 L ${S - 30} 22 Z`);
  tri.setAttribute("class", "compass-tri");
  comp.appendChild(tri);
  const n = document.createElementNS(ns, "text");
  n.setAttribute("x", S - 24); n.setAttribute("y", 34); n.setAttribute("text-anchor", "middle");
  n.setAttribute("class", "compass-n");
  n.textContent = "N";
  comp.appendChild(n);
  svg.appendChild(comp);

  const sb = document.createElementNS(ns, "g");
  sb.setAttribute("class", "map-scale");
  const sln = document.createElementNS(ns, "line");
  sln.setAttribute("x1", 12); sln.setAttribute("y1", S - 16); sln.setAttribute("x2", 12 + SCALE * PPM); sln.setAttribute("y2", S - 16);
  sb.appendChild(sln);
  const st = document.createElementNS(ns, "text");
  st.setAttribute("x", 12); st.setAttribute("y", S - 4);
  st.textContent = SCALE_LABEL;
  sb.appendChild(st);
  svg.appendChild(sb);
  return svg;
}

function buildMapList(pois, hero, scaleKey) {
  const list = document.createElement("div");
  list.className = "map-list";
  const hx = (hero && hero.x) || 0, hy = (hero && hero.y) || 0;
  // "here" = the hero is literally standing on this POI (the label snapped them onto it). The radius
  // is the scale's own — tiny on a meter map (a 10 m kitchen still reads "10 m"), a fraction of the
  // band on a km/AU/ly map so the current place reads "here" without swallowing real distances.
  const hereT = mapScale(scaleKey).here;
  const distTxt = (d) => formatDistance(d, scaleKey);
  pois.forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "map-row";
    row.dataset.idx = i;
    const ex = (p.dx || 0) - hx, ey = (p.dy || 0) - hy;
    const d = Math.hypot(ex, ey);
    const here = d < hereT;
    if (here) row.classList.add("here");
    const side = here
      ? `<div class="dist here">here</div>`
      : `<div class="dist">${distTxt(d)}</div><div class="dir">${compassDir(ex, ey)}</div>
         <button class="mini trvl" type="button" title="Travel to ${esc(p.name)}">Travel</button>`;
    row.innerHTML = `<div class="ic">${p.icon}</div>
      <div class="mid"><div class="nm">${esc(p.name)}</div><div class="ds">${esc(p.desc)}</div></div>
      <div class="side">${side}</div>`;
    row.addEventListener("mouseenter", () => highlightMapPoi(i));
    row.addEventListener("mouseleave", clearMapHighlight);
    const btn = row.querySelector(".trvl");
    if (btn) btn.addEventListener("click", (e) => { e.stopPropagation(); travelToPoi(p); });
    list.appendChild(row);
  });
  return list;
}

function highlightMapPoi(i) {
  clearMapHighlight();
  mapHighlight = i;
  const mk = document.querySelector(`#rightRailBody .map-poi[data-idx="${i}"]`);
  if (mk) mk.classList.add("hot");
  const row = document.querySelector(`#rightRailBody .map-row[data-idx="${i}"]`);
  if (row) row.classList.add("hot");
}

function clearMapHighlight() {
  if (mapHighlight < 0) return;
  document.querySelectorAll("#rightRailBody .map-poi.hot, #rightRailBody .map-row.hot").forEach((e) => e.classList.remove("hot"));
  mapHighlight = -1;
}

// The 🗺 map rows' "Travel" button — sends a normal player action to the GM, but tagged so the
// GM knows to wrap up the scene, cover the journey, and advance time for the distance. The action
// text itself carries the POI's name/type/distance/bearing so the GM is never in the dark even if
// the SURROUNDINGS map isn't fed this turn.
async function travelToPoi(p) {
  if (generating) { notify("⏳ The GM is still writing…"); return; }
  if (!state || !state.map || state.map.status !== "ready") return;
  const hero = state.map.hero || { x: 0, y: 0 };
  const scaleKey = state.map.scale || inferScaleFromPois(state.map.pois || [], hero);
  const ex = (p.dx || 0) - (hero.x || 0), ey = (p.dy || 0) - (hero.y || 0);
  const distTxt = formatDistance(Math.hypot(ex, ey), scaleKey);
  const dirTxt = compassDir(ex, ey);
  const ok = await ConfirmPopup.open({
    title: "Travel",
    message: `Set out for ${p.name} — ${distTxt} ${dirTxt} from here? The current scene will be wrapped up and the journey narrated.`,
    confirmText: "Travel"
  });
  if (!ok) return;
  const regionLabel = String(currentLocation()).trim().split(/[—–]/)[0].trim() || "the area";
  const actionText = `I set out to travel to ${p.name} (${p.type}, ${distTxt} ${dirTxt} from here). ${p.desc}`;
  state.messages.push({ role: "action", text: actionText, kind: "travel", travelRegion: regionLabel, travelBearing: dirTxt, ts: Date.now() });
  state.messageCount++;
  state.turn++;
  render();
  const history = state.messages.slice(0, state.messages.length - 1);
  await runGmTurn({ history, actionText, kind: "travel" });
  await saveAndMaybeMemory();
}

// After a travel turn the tracker usually records the destination as just the place name
// ("Old Stone Bridge"), which the map would treat as a brand-new region and rebuild around it.
// If the destination is genuinely a POI on the current region's map, keep the region prefix
// ("Thornwood — Old Stone Bridge") so the existing map is kept and the hero snaps onto it. But if
// the new location names a spot the current map doesn't cover (the GM moved the story elsewhere, or
// the destination lies beyond the map), the location stands as the tracker wrote it — so the hero
// CAN leave the region, and a fresh map is built around the new place.
function keepTravelLocationInRegion() {
  if (!state || !state.map || state.map.status !== "ready") return;
  let region = null;
  for (let i = state.messages.length - 1; i >= 0; i--) {
    const m = state.messages[i];
    if (m && m.role === "action" && m.travelRegion) { region = m.travelRegion; break; }
  }
  if (!region) return;
  const locDef = locationTracker(trackerDefs);
  if (!locDef) return;
  const snap = deriveCurrentTrackers(state, trackerDefs);
  const loc = String(snap[locDef.key] || "").trim();
  if (!loc || normalizeLoc(loc) === state.map.loc) return;
  const detail = locDetail(loc);
  if (!detail || !matchPoi(detail, state.map.pois || [])) return;
  const fixed = region + " — " + detail;
  snap[locDef.key] = fixed;
  for (let i = state.messages.length - 1; i >= 0; i--) {
    const m = state.messages[i];
    if (m && m.afterTrackers) { m.afterTrackers[locDef.key] = fixed; break; }
  }
}

// ⏩ Advance: conclude the current scene and open the next one. It anchors its OWN turn — a
// `kind:"advance"` direct marker rendered as a wide centered box — so the player can delete or
// re-roll just the advance turn. The `kind` lives on the anchor, so re-rolling feeds the engine
// the SCENE TRANSITION instruction again rather than a normal action reply.
async function runAdvanceCommand() {
  if (generating) { notify("⏳ The GM is still writing…"); return; }
  if (isGameOver()) { notify("☠ Your story has ended — delete or re-roll the fatal turn to undo fate."); return; }
  const history = state.messages.slice();
  state.turn++;
  state.messages.push({ role: "direct", kind: "advance", text: "", ts: Date.now() });
  state.messageCount++;
  render();
  await runGmTurn({ history, actionText: null, kind: "advance" });
  await saveAndMaybeMemory();
}

async function runDirectCommand() {
  if (generating) { notify("⏳ The GM is still writing…"); return; }
  const text = await TextPopup.open({
    title: "⚡ Direct the scene",
    placeholder: "Type how you want to direct the story",
    rows: 3
  });
  if (!text || !text.trim()) return;
  await sendDirect(text.trim());
}

async function sendDirect(text) {
  if (generating) return;
  if (isGameOver()) { notify("☠ Your story has ended — delete or re-roll the fatal turn to undo fate."); return; }
  state.messages.push({ role: "direct", text, ts: Date.now() });
  state.messageCount++;
  state.turn++;
  render();
  const history = state.messages.slice(0, state.messages.length - 1);
  await runGmTurn({ history, actionText: text, kind: "direct" });
  await saveAndMaybeMemory();
}

async function runPruneCommand() {
  if (generating) { notify("⏳ The GM is still writing…"); return; }
  const turns = groupTurns(state.messages);
  let pruned = 0;
  for (const turn of turns) {
    // Prune keeps only the version currently shown. Under the lazy-archive scheme that means
    // dropping the archive entirely — the shown version already lives in `messages`.
    if (turn.action) {
      const rl = turn.action.rerolls || [];
      if (rl.length > 1) pruned += rl.length - 1;
      if (rl.length) { delete turn.action.rerolls; turn.action.rerollIndex = 0; }
    } else {
      const list = openingVersions(turn.start);
      if (list.length > 1) pruned += list.length - 1;
      if (list.length) delete state.openingRerolls[turn.start];
    }
  }
  state.openingRerollIndex = 0;
  if (!pruned) { notify("🧹 Nothing to prune — no unused re-rolls."); return; }
  const ok = await ConfirmPopup.open({
    title: "Prune re-rolls",
    message: `Drop ${pruned} unused re-roll version${pruned > 1 ? "s" : ""}? Only the reply shown in each turn will be kept — the others are discarded permanently.`,
    confirmText: "Prune",
    danger: true
  });
  if (!ok) return;
  render();
  try { await store.save(state); }
  catch (e) {
    if (isStorageError(e) || (e && e.isStorageUnavailable)) notifyStorageError(notify, "saving", e);
    else throw e;
  }
  notify("🧹 Pruned " + pruned + " unused re-roll" + (pruned > 1 ? "s" : "") + ".");
}

async function runGmTurn({ history, actionText, opening = false, insertIndex = null, kind = "action" }) {
  engine.clearStop(); // clear any stop left over from a previous turn before this one begins
  generating = true;
  setLoading(true);
  // Any throw below (a failed AI call, a bad tracker value, a render error) must still release the
  // generation lock — otherwise send / re-roll stay dead and the composer stays a ■ until reload.
  try {
  // Whether the hero was already dead BEFORE this turn — used to fire the death scene only on an
  // alive → dead transition (see the game-over block after the reply lands).
  const wasDead = isDead(trackerDefs, currentTrackers());
  if (insertIndex === null) {
    renderFollowTail = true;
    const t = $("transcriptEl");
    if (t) t.scrollTop = t.scrollHeight;
  }
  const bubble = makeStreamBubble();
  const surrLoc = surroundingsToFeed(state, actionText, kind);
  // Skill check (regular in-world actions only): a small AI call decides whether the action
  // warrants a roll — picks the stat + difficulty — then we roll d20 and show the pip above the
  // GM's stream. The result is fed into the GM context so it narrates success/failure faithfully.
  let check = null;
  if (kind === "action" && actionText && statDefs.length && state.character && state.settings.rollChecks !== false) {
    const decision = await engine.determineCheck(state, actionText);
    if (decision) {
      check = resolveCheck(decision, state.character.stats || {}, statDefs, statCfg);
      bubble.wrap.insertBefore(checkPipEl(check, { animate: true }), bubble.row);
    }
  }
  // NPCs this reply introduces are registered as entries BEFORE the NPC tracker call (the callback
  // fires inside generateGmReply, just before its parallel tracker calls), so the call can pre-fill
  // their tracked values on the turn they first appear instead of leaving them on their seed until
  // the next turn. Improvised NPCs — the ones with no world-cast profile — are the main
  // beneficiaries (see README §6.3.1). Only the ENTRY is created here: the
  // profile/portrait build still happens in noteNpcs below, exactly as before.
  const preNpcs = [];
  const messages = await engine.generateGmReply(state, history, actionText, (acc) => bubble.update(stripBlockForDisplay(acc)), kind, opening, {
    includeSurroundings: !!surrLoc,
    check,
    registerReplyNpcs: (replyMsgs) => { const created = npcSys.registerNew(replyMsgs, state); preNpcs.push(...created); return created; }
  });
  removeStreamBubble();
  // The reply call failed (not a user stop — that also yields no messages): nothing was saved, so
  // say so in a toast instead of leaving the player staring at a turn with no reply.
  if (!messages.length && !engine._aborted && engine.lastError) {
    notify("⚠ Generation failed — no reply was written: " + String(engine.lastError).slice(0, 300), { ms: 8000 });
  }
  if (check) messages.unshift({ role: "check", check, text: `${(check.statLabel || check.stat || "?").toUpperCase()} check: ${check.passed ? "success" : "failure"}`, ts: Date.now() });
  if (insertIndex === null) {
    for (const m of messages) { m.ts = Date.now(); state.messages.push(m); state.messageCount++; }
  } else {
    for (const m of messages) m.ts = Date.now();
    state.messages.splice(insertIndex, 0, ...messages);
    state.messageCount += messages.length;
  }
  // Death: the dedicated tracker call above may have driven the hero's life tracker to 0. When that
  // happens — and the hero was alive before this turn — run one final GM call to conclude the scene
  // and narrate the death, then tag those messages as the game-over point so the transcript renders
  // the badge below them. Firing only on the alive → dead transition means a re-roll that keeps the
  // hero alive drops the badge with the messages, and a later turn can never re-trigger it.
  let deathMsgs = null;
  if (!wasDead && isDead(trackerDefs, currentTrackers())) {
    render(); // show the fatal reply before the death scene streams in beneath it
    const snap = currentTrackers();
    const deathBubble = makeStreamBubble();
    deathMsgs = await engine.generateDeathScene(state, state.messages.slice(), (acc) => deathBubble.update(stripBlockForDisplay(acc)));
    removeStreamBubble();
    if (!deathMsgs.length && !engine._aborted && engine.lastError) {
      notify("⚠ The death scene could not be written: " + String(engine.lastError).slice(0, 300), { ms: 8000 });
    }
    for (const m of deathMsgs) { m.ts = Date.now(); m.afterTrackers = snap; m.gameOver = true; }
    if (insertIndex === null) {
      for (const m of deathMsgs) { state.messages.push(m); state.messageCount++; }
    } else {
      state.messages.splice(insertIndex + messages.length, 0, ...deathMsgs);
      state.messageCount += deathMsgs.length;
    }
  }
  // The returned reply bundles the death scene with the fatal turn's reply (so re-roll/version
  // archives keep them together) and carries every [[NPC: ...]] promotion from both calls.
  const replyMsgs = deathMsgs ? messages.concat(deathMsgs) : messages;
  if (deathMsgs) {
    replyMsgs.npcPromotes = [...(messages.npcPromotes || []), ...(deathMsgs.npcPromotes || [])];
    // ...along with their `[[NPC: Name | excerpt]]` notes, so a character introduced by the death
    // scene still gets the GM's own description as its FIRST APPEARANCE (see npc-notes / SPEC).
    replyMsgs.npcNotes = { ...(messages.npcNotes || {}), ...(deathMsgs.npcNotes || {}) };
  }
  // The GM now knows this location's surroundings — don't re-feed them until the hero moves on
  // (or a later action asks for travel/exploration info again).
  if (surrLoc) {
    state.surroundingsLoc = surrLoc;
    state.surroundingsPos = { x: (state.map && state.map.hero && state.map.hero.x) || 0, y: (state.map && state.map.hero && state.map.hero.y) || 0 };
  }
  // Release the generation lock BEFORE the final render: render() hides [[CHOICE: ...]] buttons
  // while `generating` is true (so a player can never click an option mid-stream). Rendering the
  // finished turn with the flag still set is what left choices invisible until the next
  // reload/edit-triggered render. Clearing first also lets the post-turn maybeRefreshMap run
  // immediately instead of deferring via pendingMapRefresh.
  generating = false;
  setLoading(false);
  render();
  grantAndAnnounceLevelUp();
  noteNpcs(replyMsgs, preNpcs);
  if (kind === "travel") keepTravelLocationInRegion();
  maybeRefreshMap();
  // A map request that arrived while the GM was writing runs now. maybeRefreshMap above already
  // handled a plain "no map yet" build for the current region — only a still-missing/force case
  // needs the extra pass.
  if (pendingMapRefresh) {
    pendingMapRefresh = false;
    const key = currentLocKey();
    const fresh = state.map && state.map.loc === key && state.map.status === "ready" && state.map.at === state.turn;
    if (!fresh) forceMapRefresh();
  }
  // The hero may have moved within the same region — re-derive their on-map position (region
  // changes were just handled by buildMapForLoc above).
  refreshHeroPos();
  refreshCtxMeter();
  return replyMsgs;
  } finally {
    generating = false;
    setLoading(false);
  }
}

// Live preview of the GM's reply as it streams. The raw output is re-parsed on every chunk and
// rendered through the same builders as the finished turn (narration prose, NPC bubbles, thoughts,
// scene breaks), so what the player watches take shape is the actual final format — not a plain
// text blob with [Name] markup showing. A trailing line still being typed is held back if it would
// flash as raw markup (an unclosed [Name tag, the tracker header, a forming ✦ ✦ ✦ break); the
// animated dots mark the spot until it completes.
function liveStreamMsgs(text) {
  let src = String(text || "");
  if (src && !/\n$/.test(src)) {
    const nl = src.lastIndexOf("\n");
    const tail = nl >= 0 ? src.slice(nl + 1) : src;
    // A `[[`-opened tail with fewer than two closers is a tag still being typed (including a
    // spaced `] ]` closer whose second bracket hasn't streamed in) — hold it back the same way.
    const unfinishedTag = /^\s*\[[^\]\n]*$/.test(tail) || /^\s*\[TRACKER/i.test(tail) ||
      (/^\s*\[\[/.test(tail) && (tail.match(/\]/g) || []).length < 2);
    const ornament = /^[✦✧*—–…\s]+$/.test(tail) && /[✦✧*—–]/.test(tail);
    if (unfinishedTag || ornament) src = src.slice(0, nl + 1);
  }
  const msgs = src.trim() ? engine.parseGmOutput(src) : [];
  // Choice buttons are held back from the live stream: they must only appear once the WHOLE turn is
  // finished (the GM reply AND the dedicated tracker-update call that follows it), so a player can
  // never click an option mid-generation. The finished reply's renderTurn shows them (latest turn).
  const shown = msgs.filter((m) => m.role !== "choice");
  return state.settings && state.settings.showInnerThoughts === false
    ? shown.filter((m) => m.role !== "thought")
    : shown;
}

function makeStreamBubble() {
  const wrap = document.createElement("div");
  wrap.className = "turn streaming";
  const row = document.createElement("div");
  row.className = "gm-row";
  wrap.appendChild(row);
  const api = {
    update(acc) {
      const t = $("transcriptEl");
      const stick = t.scrollTop + t.clientHeight >= t.scrollHeight - AUTO_SCROLL_EPS;
      if (!wrap.isConnected) t.appendChild(wrap);
      row.innerHTML = "";
      try {
        for (const m of liveStreamMsgs(acc)) row.appendChild(partEl(m));
      } catch (err) {
        // Never let one unparseable message blank the stream — fall back to plain text.
        console.error("stream part render failed:", err);
        const f = document.createElement("div");
        f.className = "narration";
        f.innerHTML = renderText(acc);
        row.appendChild(f);
      }
      const dots = document.createElement("div");
      dots.className = "typing";
      dots.innerHTML = "<span></span><span></span><span></span>";
      row.appendChild(dots);
      if (stick) t.scrollTop = t.scrollHeight;
      updateScrollBottomBtn();
    }
  };
  api.update("");
  api.wrap = wrap;
  api.row = row;
  activeStreamBubble = api;
  return api;
}
function removeStreamBubble() {
  const t = $("transcriptEl");
  const s = t.querySelector(".streaming");
  if (s) {
    const keepTop = t.scrollTop;
    const keepH = t.scrollHeight;
    s.remove();
    bubbleRemoveAnchor = { top: keepTop, h: keepH };
    if (t.scrollTop < keepTop) t.scrollTop = Math.min(keepTop, Math.max(0, t.scrollHeight - t.clientHeight));
  }
  activeStreamBubble = null;
}
function setLoading(on) {
  const btn = $("sendBtn");
  // While the GM is writing, the send button STAYS clickable — it doubles as a STOP control (a red
  // square) that aborts the in-flight generation (see onSendBtn/stopGmTurn). Outside a turn it is
  // the normal send button; the game-over lock is applied separately (updateComposerForGameOver).
  btn.disabled = false;
  btn.classList.toggle("stopping", on);
  btn.textContent = on ? "■" : "➤";
  btn.title = on ? "Stop generating" : "Send";
  // NOTE: the input deliberately stays enabled + focused while the GM writes. Every actual send
  // path is already gated on the `generating` flag (send(), travel, re-roll/edit/delete, commands,
  // and CHOICE buttons all refuse while it is set), so disabling the textarea buys no safety — it
  // would only blur the input and dismiss the mobile keyboard every turn. Typed text is preserved:
  // Enter mid-stream hits send()'s early return after preventDefault, so nothing is sent or lost.
  // The game-over lock is untouched (updateComposerForGameOver owns it via render()).
  // Safety net: if focus was lost some other way mid-turn (touch tap on send, alt-tab, ...),
  // hand it back — this only acts when focus sits on the page body or the send button, so it
  // never steals focus from a panel field or message editor.
  if (!on) restoreComposerFocus();
}

// Focus safety net for the composer (see setLoading): hand focus back to the input when it is
// free-floating on the page body or the send button (e.g. after a touch tap on send).
// Desktop only: re-focusing on mobile would pop the keyboard. And never steal focus the
// user has since moved elsewhere (a rail panel field, a message editor, ...).
function restoreComposerFocus() {
  if (IS_MOBILE) return;
  const inp = $("inputEl");
  if (!inp || inp.disabled) return;
  const app = $("app");
  if (!app || app.hidden) return;
  if (typeof isGameOver === "function" && isGameOver()) return;
  const ae = document.activeElement;
  if (ae && ae !== document.body && ae !== $("sendBtn")) return;
  try { inp.focus({ preventScroll: true }); } catch (_) { try { inp.focus(); } catch (_2) {} }
}

// The composer's send button: normally it sends your action; while the GM is writing it stops the
// generation instead. Stopping aborts the in-flight AI call — whatever has streamed in is kept,
// and the turn's follow-up AI calls (tracker update, skill check, death scene) are skipped.
function onSendBtn() {
  if (generating) { stopGmTurn(); return; }
  send();
}

function stopGmTurn() {
  if (!generating || !engine) return;
  engine.stop();
  notify("⏹ Stopped.");
}

/* ---------- NPC system ---------- */
function noteNpcs(messages, preSeen) {
  const st = state;
  const fresh = npcSys.update(messages, st, () => {
    if (state !== st) return;
    render();
    refreshRailIfOpen("right");
    store.save(st).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
  });
  // `preSeen` are the entries registered early — before the tracker call — so the NPC tracker could
  // fill their values in on their introduction turn. They are already in state.npcs by now, so the
  // normal pass does not report them; announce them here instead (see runGmTurn).
  const created = [...new Set([...(preSeen || []), ...fresh])];
  if (created.length) {
    notify("👤 New acquaintance" + (created.length > 1 ? "s" : "") + ": " + created.join(", "));
    render();
    refreshRailIfOpen("right");
    store.save(st).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
  }
  // No auto-prune: entries are never forgotten automatically. The player manages the catalogue
  // by hand (Remove button); pinning only sorts to the top of the UI list.
}

// Recompute NPC sightings from the SHOWN transcript only. Used after any history rewrite
// (edit, re-roll, version switch, delete) so lastSeen/appearance reflect what is actually
// visible — never archived versions, never NPCs that didn't speak that turn. Silently demotes
// hidden-version-only NPCs to -1 (not in shown story, excluded from Present dossiers via
// inPlayNpcs); only newly created cast entries toast (same copy as noteNpcs). Returns rebuild
// result {created, demoted}.
function reconcileNpcsAfterRewrite() {
  const st = state;
  const res = npcSys.rebuildSightings(st, () => {
    if (state !== st) return;
    render();
    refreshRailIfOpen("right");
    store.save(st).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
  });
  if (res.created.length) {
    notify("👤 New acquaintance" + (res.created.length > 1 ? "s" : "") + ": " + res.created.join(", "));
  }
  return res;
}

/* ---------- turn model ---------- */
function groupTurns(msgs) {
  const turns = [];
  let cur = null;
  msgs.forEach((m, i) => {
    if (m.role === "action" || m.role === "direct") {
      if (cur) { cur.end = i - 1; turns.push(cur); }
      cur = { action: m, parts: [], start: i, end: i };
    } else if (m.role === "image") {
      if (cur) { cur.end = i - 1; turns.push(cur); cur = null; }
      turns.push({ image: m, start: i, end: i });
    } else if (m.role === "meta") {
      if (cur) { cur.parts.push(m); cur.end = i; }
      else { cur = { action: null, parts: [m], start: i, end: i }; }
    } else {
      if (!cur) cur = { action: null, parts: [], start: i, end: i };
      cur.parts.push(m);
      cur.end = i;
    }
  });
  if (cur) turns.push(cur);
  return turns;
}

/* ---------- rendering ---------- */
function currentTrackers() {
  return deriveCurrentTrackers(state, trackerDefs);
}

// info-tip anchor for a tracker chip/row/bar: the whole element opens the shared bubble —
// no icon is added (the chip's own `cursor: help` is the affordance). Hint-only: without a
// world-written `hint` the bubble would just echo the visible label, so no hook is added.
// Returns [classSuffix, attrString]: `<div class="trk${t[0]}"${t[1]}>`.
function trkTip(d) {
  if (!d || !d.hint) return ["", ""];
  return [" info-tip", ` data-tip="${esc(d.hint)}" data-tip-title="${esc(d.label || d.key)}"`];
}

// The tracker bar above the transcript — one chip per defined tracker, drawn from the live
// (message-derived) tracked state. Number-with-max trackers render as a health-style bar; the
// max is the live one (`key.max`, may have been changed by the AI mid-game) falling back to the
// config's static max. The whole chip opens the shared info-tip (`hint`, headed with the label);
// `rules` is only for the AI. `color` (optional) overrides the bar fill color.
function trackerChip(d, v, curMax) {
  const [tc, ta] = trkTip(d);
  const label = d.label ? `<span class="trk-l">${esc(d.label.toUpperCase())}</span>` : "";
  const ic = d.icon ? `<span class="trk-ic">${esc(d.icon)}</span>` : "";
  if (d.type === "number" && curMax) {
    const num = clampNum(v, 0, 0, curMax);
    const pct = curMax > 0 ? Math.round((num / curMax) * 100) : 0;
    const fillStyle = `width:${pct}%` + (d.color ? `;background:${esc(d.color)}` : "");
    return `<div class="trk hp${tc}"${ta}>${ic}${label}<span class="trk-bar"><span class="trk-fill" style="${fillStyle}"></span></span>
      <span class="trk-v">${num}/${curMax}</span></div>`;
  }
  const val = (v === undefined || v === null || v === "") ? (d.type === "number" ? "0" : "—") : (d.type === "number" ? String(Math.round(Number(v))) : String(v));
  return `<div class="trk${tc}"${ta}>${ic}${label}<span class="trk-v">${esc(val)}</span></div>`;
}

function renderTrackerBar() {
  const chips = $("trackerbarChips");
  if (!chips) return;
  const cur = currentTrackers();
  const stats = (state.character && state.character.stats) || {};
  const chip = (d) => trackerChip(d, cur[d.key], liveMax(d, cur, stats));
  // only trackers whose `show` setting includes the header appear here (see the world's trackers)
  const shown = trackerDefs.filter((d) => d.show === "header" || d.show === "both");
  // no header trackers -> collapse the whole bar so it doesn't leave an empty gap above the transcript
  const bar = $("trackerbar");
  if (bar) bar.hidden = !shown.length;
  // rebuilding the chips resets the strip's scroll to the start — keep the player's
  // horizontal position across re-renders (clamps automatically when the strip shrinks)
  const keepX = chips.scrollLeft || 0;
  // one <div class="trkrow"> per configured group (`row` field in the world's trackers)
  chips.innerHTML = groupByRow(shown)
    .map((g) => `<div class="trkrow">${g.defs.map(chip).join("")}</div>`)
    .join("");
  if (keepX) chips.scrollLeft = keepX;
  // mobile: small round button below the chip strip expands it to show all trackers
  const btn = $("trackerToggleBtn");
  if (btn) {
    btn.hidden = !shown.length;
    btn.textContent = trackerOpen ? "▲" : "▼";
    btn.title = trackerOpen ? "Show fewer trackers" : `Show all trackers (${shown.length})`;
    btn.setAttribute("aria-label", btn.title);
    btn.setAttribute("aria-expanded", String(trackerOpen));
  }
  paintTrackerNav();
}

// Scroll cues for the collapsed mobile chip strip — same fade + chevron pattern as the world
// editor's tab bar (see paintTabNav): one cue per edge that still has off-screen chips.
// Repainted on every bar render plus the strip's scroll/resize (wired in init).
function paintTrackerNav() {
  const bar = $("trackerbar"), chips = $("trackerbarChips");
  const prev = $("trackerNavPrev"), next = $("trackerNavNext");
  if (!bar || !chips || !prev || !next) return;
  if (bar.hidden || bar.classList.contains("open") || chips.scrollWidth <= chips.clientWidth + 4) {
    prev.hidden = true; next.hidden = true; return;
  }
  prev.hidden = !(chips.scrollLeft > 4);
  next.hidden = !(chips.scrollLeft + chips.clientWidth < chips.scrollWidth - 4);
}
function stepTrackerNav(d) {
  const chips = $("trackerbarChips");
  if (!chips) return;
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  chips.scrollBy({ left: d * Math.max(120, Math.round(chips.clientWidth * 0.6)), behavior: reduce ? "auto" : "smooth" });
}

/* ---------- death / game over ---------- */
// The hero is game-over once any message in the transcript carries the death flag (set on the
// messages of the final death scene by runGmTurn). Derived from the messages — like all tracked
// state — so re-rolling or deleting the fatal turn revives the hero and clears the badge.
function isGameOver() {
  return !!(state && state.messages && state.messages.some((m) => m && m.gameOver));
}

// The terminal badge rendered at the bottom of the death scene.
function gameOverBadgeEl() {
  const d = lifeTracker(trackerDefs) || {};
  const name = (state.character && state.character.name) || "";
  const w = document.createElement("div");
  w.className = "gameover";
  w.innerHTML = `<div class="go-frame">
    <div class="go-icon">${esc(d.icon || "☠")}</div>
    <div class="go-title">YOU HAVE DIED</div>
    <div class="go-sub">${name ? esc(name) + "'s" : "Your"} tale ends here</div>
    <div class="go-hint">Re-roll or delete the fatal turn above to undo fate</div>
  </div>`;
  return w;
}

// While the hero is dead the composer is locked (the story has ended). The transcript's edit /
// re-roll / delete controls stay live, so the player can still undo the fatal turn.
function updateComposerForGameOver() {
  const inp = $("inputEl");
  const btn = $("sendBtn");
  if (!inp || !btn || generating) return;
  if (isGameOver()) {
    inp.disabled = true;
    btn.disabled = true;
    inp.placeholder = "☠ Your story has ended.";
  } else {
    inp.disabled = false;
    btn.disabled = false;
    inp.placeholder = INPUT_PLACEHOLDER;
  }
}

// Pin the transcript scroll to the clicked re-roll control across the next render() — the same
// pin-where-you-click the edit toggle uses. Records the control row's screen position before the
// DOM rebuild; render() shifts scrollTop by the delta after. One-shot: consumed by the next
// render, so streaming / editing / image / background renders are unaffected.
function requestRerollScrollPin(btn, region) {
  try {
    const t = $("transcriptEl");
    if (!t || !btn || !btn.isConnected) return;
    const turnEl = btn.closest(".turn");
    if (!turnEl) return;
    const turnEls = t.querySelectorAll(":scope > .turn");
    const ti = Array.prototype.indexOf.call(turnEls, turnEl);
    if (ti < 0) return;
    let y;
    if (region === "action") {
      const bits = turnEl.querySelectorAll(".msg.action, .msg.system, .action-ctrl");
      const ref = bits.length ? bits[bits.length - 1] : turnEl;
      y = ref.getBoundingClientRect().bottom;
    } else {
      const ctrl = btn.closest(".turn-ctrl") || btn;
      y = ctrl.getBoundingClientRect().bottom;
    }
    clickPin = { ti, y, region };
  } catch (_) { /* never break the click for scroll math */ }
}

function render(opts = {}) {
  if (!state) return;
  closeNpcLinkMenu(); // a rebuild orphans the floating menu's anchor — never leave it hovering
  const t = $("transcriptEl");
  const prevTop = bubbleRemoveAnchor ? bubbleRemoveAnchor.top : t.scrollTop;
  const prevH = bubbleRemoveAnchor ? bubbleRemoveAnchor.h : t.scrollHeight;
  bubbleRemoveAnchor = null;
  const wasAtBottom = prevTop + t.clientHeight >= prevH - AUTO_SCROLL_EPS;
  const turns = groupTurns(state.messages);
  // An edit render must never move the viewport: freeze the tail window while an editor is
  // open (or opening), and pin the EDITOR's bottom edge (the editbar with the switch the user
  // just clicked) to its screen position across the rebuild. The bottom edge is the right anchor:
  // the turn's top can't always be kept (when the editor shrinks near the page bottom there is
  // no valid scroll position for it), while the bottom edge always has one — everything below it
  // is byte-identical content. So opening, toggling, saving or cancelling keeps the controls
  // under the cursor instead of yanking the reader elsewhere. Without the freeze, a
  // tail-following window would snap away from an old turn being edited.
  const prevTurnEls = t.querySelectorAll(":scope > .turn");
  const prevEd = t.querySelector(":scope .editor");
  // Images (scene art, portraits) reload asynchronously on every rebuild: between innerHTML=""
  // and their load they contribute zero height, so any scroll math done in that gap measures a
  // shorter page, clamps wrong, and then jumps again as each image pops in. Reserve each image's
  // current rendered size and re-apply it to the rebuilt node until its own load event lands.
  const imgSizes = {};
  t.querySelectorAll("img").forEach((im) => {
    if (im.src && im.clientWidth > 0 && im.clientHeight > 0) imgSizes[im.src] = [im.clientWidth, im.clientHeight];
  });
  let anchor = null;
  // The end of a turn's ACTION region (bubble + controls) — the action editor replaces exactly
  // this slice at the TOP of the turn, so entering/saving an action edit must pin THIS edge,
  // not the turn's bottom edge (which sits a whole GM reply further down).
  const actionRegionEl = (turnEl) => {
    const bits = turnEl.querySelectorAll(".msg.action, .msg.system, .action-ctrl");
    return bits.length ? bits[bits.length - 1] : turnEl;
  };
  const clickPinReq = clickPin;
  clickPin = null;
  if (clickPinReq && clickPinReq.ti >= 0 && clickPinReq.y != null) {
    // Re-roll / version-nav pin (◀/▶/⟳): same pin-where-you-click as the edit toggle — keep
    // the clicked controls under the cursor across the rebuild. Takes priority over the edit
    // anchor (it's the latest click) and over the tail-follow snap for this one render only;
    // every other render (streaming, images, background) never sets it so is untouched.
    // renderFollowTail is deliberately left alone so tail-following resumes naturally after.
    t.style.overflowAnchor = "none";
    anchor = { ti: clickPinReq.ti, y: clickPinReq.y, region: clickPinReq.region || "ctrl" };
  } else if (prevEd || editing) {
    renderFollowTail = false;
    t.style.overflowAnchor = "none";
    let ti = -1, y = null, region = null;
    if (prevEd) {
      const turnEl = prevEd.closest(".turn");
      ti = Array.prototype.indexOf.call(prevTurnEls, turnEl);
      if (turnEl) {
        region = prevEd.closest(".gm-row") ? "gm" : "action";
        y = prevEd.getBoundingClientRect().bottom;
      }
    } else if (editing) {
      ti = editing.turnIdx - renderWindowStart;
      if (ti >= 0 && ti < prevTurnEls.length) {
        region = editing.which;
        y = (region === "action" ? actionRegionEl(prevTurnEls[ti]) : prevTurnEls[ti]).getBoundingClientRect().bottom;
      }
      else ti = -1;
    }
    if (ti >= 0 && y != null) anchor = { ti, y, region };
  } else {
    t.style.overflowAnchor = "";
  }
  // Only the last RENDER_INITIAL turns are built into the DOM; older ones load on demand as the
  // player scrolls up. The window stays anchored while the player reads history; when following
  // the tail it snaps back to the last N (bounded DOM + usable scrollbar on very long stories).
  if (renderFollowTail) renderWindowStart = Math.max(0, turns.length - RENDER_INITIAL);
  renderWindowStart = Math.max(0, Math.min(renderWindowStart, Math.max(0, turns.length - 1)));
  t.innerHTML = "";
  if (renderWindowStart > 0) {
    const lo = document.createElement("button");
    lo.id = "loadOlderEl";
    lo.type = "button";
    lo.className = "load-older";
    const n = Math.min(RENDER_CHUNK, renderWindowStart);
    lo.textContent = `▲ Load ${n} earlier turn${n === 1 ? "" : "s"} (${renderWindowStart} hidden)`;
    lo.onclick = () => loadOlderTurns();
    t.appendChild(lo);
  }
  // The latest GM reply is the last turn that shows GM content — only there do the re-roll and
  // version-nav (◀/▶) controls appear, so past replies can only be edited/deleted, not re-rolled.
  let lastGmIdx = -1;
  turns.forEach((turn, idx) => {
    const hasParts = Array.isArray(turn.parts) && turn.parts.some((m) => !(m.role === "thought" && !state.settings.showInnerThoughts));
    if (hasParts) lastGmIdx = idx;
  });
  // CYOA choice buttons are live only on the newest GM reply AND only while no newer player turn
  // exists — so the moment an option is clicked (which anchors a new action turn) the old buttons
  // retire. A trailing scene-image turn is player-only and keeps them live; an in-flight generation
  // disables them.
  let choicesIdx = -1;
  if (lastGmIdx >= 0 && !generating && turns.slice(lastGmIdx + 1).every((t) => t.image)) choicesIdx = lastGmIdx;
  let editedWrap = null;
  for (let idx = renderWindowStart; idx < turns.length; idx++) {
    const w = renderTurn(turns[idx], idx, idx === lastGmIdx, idx === choicesIdx);
    t.appendChild(w);
    if (editing && editing.turnIdx === idx) editedWrap = w;
  }
  // An in-flight GM stream isn't part of state, so the rebuild above wiped it from the DOM.
  // Re-attach it at the tail (with its live check pip and typing dots) so a background re-render —
  // an async NPC profile/portrait finishing, a map build — can't make the reply look stalled.
  if (activeStreamBubble && !activeStreamBubble.wrap.isConnected) t.appendChild(activeStreamBubble.wrap);
  // Hold each rebuilt image at its pre-rebuild size until it finishes loading, so the page
  // height (and the anchor math below) doesn't breathe as images pop back in.
  t.querySelectorAll("img").forEach((im) => {
    const s = imgSizes[im.src];
    if (s && !im.complete) {
      im.style.width = s[0] + "px";
      im.style.height = s[1] + "px";
      const free = () => { im.style.width = ""; im.style.height = ""; };
      im.addEventListener("load", free, { once: true });
      im.addEventListener("error", free, { once: true });
    }
  });
  if (anchor) {
    // Keep the editor's bottom edge (or the region's, once the editor is gone) exactly where it
    // was on screen — the button the user just pressed stays under the cursor.
    const newTurnEls = t.querySelectorAll(":scope > .turn");
    const nt = newTurnEls[anchor.ti];
    if (nt) {
      // Size the new textareas BEFORE measuring: fresh fields start near-zero height and only
      // reach full height in a later grow pass — measuring first would pin a too-small editor
      // and the bottom edge would fly downward as each field grows.
      const newEd = nt.querySelector(":scope .editor");
      if (newEd) newEd.querySelectorAll("textarea").forEach(edGrow);
      let ref;
      if (newEd) ref = newEd;
      else if (anchor.region === "action") ref = actionRegionEl(nt);
      // The version-nav row (◀/▶ + ⟳) survives its own rebuild, so pin it directly; the
      // re-roll clear wipes the reply (and its row), so fall back to the turn itself.
      else if (anchor.region === "ctrl") ref = nt.querySelector(":scope .gm-row > .turn-ctrl") || nt;
      else ref = nt;
      t.scrollTop += ref.getBoundingClientRect().bottom - anchor.y;
    }
  } else if (opts.preserveScroll) {
    // Keep the same content pinned under the viewport after prepending older turns.
    t.scrollTop = opts.preserveScroll.prevTop + (t.scrollHeight - opts.preserveScroll.prevH);
  } else if (wasAtBottom && renderFollowTail) {
    t.scrollTop = t.scrollHeight;
  } else {
    // a background re-render (e.g. a late NPC portrait) shouldn't yank a reader scrolled up
    t.scrollTop = Math.min(prevTop, Math.max(0, t.scrollHeight - t.clientHeight));
  }
  renderTrackerBar();
  refreshHeroTrackerRow();
  refreshNpcTrackerRow();
  updateComposerForGameOver();
  $("sessionTitleEl").textContent = state.name;
  const turnN = (state.messages || []).filter((m) => m.role === "action" || m.role === "direct").length;
  $("turnCountEl").hidden = turnN === 0;
  $("turnCountEl").textContent = turnN ? `Turn ${turnN}` : "";
  updateLvlIndicators();
  updateScrollBottomBtn();
}

// The floating "jump to latest" button appears once the transcript is scrolled a little way up
// (SCROLL_BTN_SHOW_PX from the bottom) and hides again near the bottom — hysteresis so a small
// scroll nudge doesn't flash it. Kept out of render()'s hot path otherwise.
function updateScrollBottomBtn() {
  const t = $("transcriptEl");
  const b = $("scrollBottomBtn");
  if (!b) return;
  const distFromBottom = t.scrollHeight - (t.scrollTop + t.clientHeight);
  if (scrollBtnVisible) {
    if (distFromBottom <= AUTO_SCROLL_EPS) scrollBtnVisible = false;
  } else if (distFromBottom > SCROLL_BTN_SHOW_PX) {
    scrollBtnVisible = true;
  }
  b.hidden = !scrollBtnVisible;
}
function scrollTranscriptToBottom() {
  const t = $("transcriptEl");
  renderFollowTail = true;
  t.scrollTo({ top: t.scrollHeight, behavior: "smooth" });
  updateScrollBottomBtn();
}
// Prepend the next older chunk of turns, preserving the reading position. Called by the
// scroll-up lazy-load and by the "load earlier" button at the top of the transcript.
function loadOlderTurns() {
  if (!state) return;
  const t = $("transcriptEl");
  if (renderWindowStart <= 0) return;
  const prevH = t.scrollHeight;
  const prevTop = t.scrollTop;
  renderWindowStart = Math.max(0, renderWindowStart - RENDER_CHUNK);
  renderFollowTail = false;
  render({ preserveScroll: { prevH, prevTop } });
}
function onTranscriptScroll() {
  const t = $("transcriptEl");
  updateScrollBottomBtn();
  if (t.scrollTop > 240) autoLoadArmed = true; // re-arm once the player is away from the top
  if (autoLoadArmed && t.scrollTop < 80 && renderWindowStart > 0) {
    autoLoadArmed = false;
    loadOlderTurns();
  }
  // Back at the bottom → resume trimming to the tail window on the next render.
  // Scrolled away → stop following, so the finish render preserves reading position.
  if (t.scrollTop + t.clientHeight >= t.scrollHeight - AUTO_SCROLL_EPS) renderFollowTail = true;
  else renderFollowTail = false;
}

function startEdit(turnIdx, which) {
  let pref = "lines";
  try { if (localStorage.getItem("mno.editMode") === "full") pref = "full"; } catch (_) {}
  editing = { turnIdx, which, mode: pref, pending: null };
  render();
}

function edGrow(ta) {
  // Never measure a hidden textarea: scrollHeight reads 0 inside a hidden tab pane and the
  // row would be pinned to ~2px when its tab opens (the "narrative lines gone" bug).
  if (!ta || !ta.isConnected || ta.offsetParent === null) return;
  const sc = $("transcriptEl");
  const keep = sc ? sc.scrollTop : 0;
  ta.style.height = "auto";
  ta.style.height = (ta.scrollHeight + 2) + "px";
  if (sc && sc.scrollTop < keep) sc.scrollTop = Math.min(keep, Math.max(0, sc.scrollHeight - sc.clientHeight));
}

function edBindGrow(ta) {
  edGrow(ta);
  ta.addEventListener("input", () => edGrow(ta));
}

function edAvatarHtml(av) {
  return /^(data:|https?:|blob:)|\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i.test(av || "") ? `<img src="${av}">` : `<span>${esc(av || "?")}</span>`;
}

function gmOriginalFull(turn) {
  const snap = (turn.parts[turn.parts.length - 1] && turn.parts[turn.parts.length - 1].afterTrackers) || currentTrackers();
  const blockTxt = trackerDefs.length
    ? "\n\n[TRACKERS]\n" + trackerDefs.map((d) => {
      let v = snap[d.key] ?? "";
      const qo = snap[d.key + ".outcome"];
      if (isQuestTrackerDef(d) && (qo === "completed" || qo === "failed")) v = `${v} [!${qo}]`;
      return `${d.key}: ${v}`;
    }).join("\n")
    : "";
  const npcBlockTxt = npcTrackerBlockForEdit(turn);
  const choiceTxt = turn.parts.filter((m) => m.role === "choice").flatMap((m) => (Array.isArray(m.options) ? m.options : [])).map((o) => `[[CHOICE: ${o}]]`).join("\n");
  return turn.parts.filter((m) => m.role !== "check" && m.role !== "choice").map((m) => m.role === "npc" ? `[${m.name}] ${m.text}` : m.role === "thought" ? `[${m.name} inner] ${m.text}` : m.text).join("\n\n") + (choiceTxt ? "\n\n" + choiceTxt : "") + blockTxt + npcBlockTxt;
}

function edItemsFromTurn(turn) {
  const items = [];
  for (const m of turn.parts) {
    if (m.role === "check") continue;
    if (m.role === "choice") {
      for (const o of (Array.isArray(m.options) ? m.options : [])) items.push({ kind: "choice", text: o || "" });
    } else if (m.role === "npc") items.push({ kind: "npc", name: m.name || "", text: m.text || "" });
    else if (m.role === "thought") items.push({ kind: "thought", name: m.name || "", text: m.text || "" });
    else if (m.role === "meta") items.push({ kind: "meta", text: m.text || "" });
    else items.push({ kind: "narr", text: m.text || "" });
  }
  const snap = (turn.parts[turn.parts.length - 1] && turn.parts[turn.parts.length - 1].afterTrackers) || currentTrackers();
  const trk = trackerDefs.length
    ? "[TRACKERS]\n" + trackerDefs.map((d) => {
      let v = snap[d.key] ?? "";
      const qo = snap[d.key + ".outcome"];
      if (isQuestTrackerDef(d) && (qo === "completed" || qo === "failed")) v = `${v} [!${qo}]`;
      return `${d.key}: ${v}`;
    }).join("\n")
    : "";
  const npc = (npcTrackerBlockForEdit(turn) || "").replace(/^\s+/, "");
  return { items, trk, npc };
}

function edItemsFromFull(full) {
  const src = String(full || "");
  const noNpc = extractNpcTrackers(src);
  const noTrk = extractTrackers(noNpc.text);
  const parsed = engine.parseGmOutput(noTrk.text);
  const items = [];
  for (const m of parsed) {
    if (m.role === "check") continue;
    if (m.role === "choice") {
      for (const o of (Array.isArray(m.options) ? m.options : [])) items.push({ kind: "choice", text: o || "" });
    } else if (m.role === "npc") items.push({ kind: "npc", name: m.name || "", text: m.text || "" });
    else if (m.role === "thought") items.push({ kind: "thought", name: m.name || "", text: m.text || "" });
    else if (m.role === "meta") items.push({ kind: "meta", text: m.text || "" });
    else items.push({ kind: "narr", text: m.text || "" });
  }
  return { items, trk: (noTrk.block || "").trim(), npc: (noNpc.block || "").trim() };
}

function edRow(kind, name, text) {
  const row = document.createElement("div");
  row.className = "ed-line";
  row.dataset.kind = kind;
  if (kind === "npc") {
    const hero = isHeroSpeaker(name);
    const npc = hero ? {} : (npcForSpeaker(name) || {});
    const av = hero
      ? ((state.character && state.character.portrait) || "src/images/portrait-placeholder.webp")
      : (npc.portrait || "src/images/portrait-placeholder.webp");
    row.classList.add("msg", "npc");
    row.innerHTML = `<div class="avatar">${edAvatarHtml(av)}</div><div class="bubble npc"><input class="ed-name" value="${esc(name)}" placeholder="Name" aria-label="Speaker name"><textarea class="ed-plain ed-line-ta" rows="1">${esc(text)}</textarea></div><button class="mini ed-del" title="Delete line">✕</button>`;
  } else if (kind === "thought") {
    row.classList.add("msg", "thought");
    row.innerHTML = `<div class="thought-ico">💭</div><div class="thought-bubble"><div class="ed-thought-head"><input class="ed-name" value="${esc(name)}" placeholder="Name" aria-label="Speaker name"><span class="dim">(inner)</span></div><textarea class="ed-plain ed-line-ta" rows="1">${esc(text)}</textarea></div><button class="mini ed-del" title="Delete line">✕</button>`;
  } else if (kind === "meta") {
    row.classList.add("ed-meta");
    row.innerHTML = `<input class="ed-plain ed-line-ta ed-meta-in" value="${esc(text)}" placeholder="✦ ✦ ✦" aria-label="Scene break"><button class="mini ed-del" title="Delete line">✕</button>`;
  } else if (kind === "choice") {
    row.classList.add("ed-choice");
    row.innerHTML = `<span class="ed-choice-arrow">▸</span><textarea class="ed-plain ed-line-ta" rows="1">${esc(text)}</textarea><button class="mini ed-del" title="Delete option">✕</button>`;
  } else {
    row.classList.add("ed-narr");
    row.innerHTML = `<textarea class="ed-plain ed-line-ta" rows="1">${esc(text)}</textarea><button class="mini ed-del" title="Delete line">✕</button>`;
  }
  const ta = row.querySelector(".ed-line-ta");
  if (ta && ta.tagName === "TEXTAREA") edBindGrow(ta);
  row.querySelector(".ed-del").onclick = () => row.remove();
  return row;
}

// ---------- structured tracker editing (GM-reply editor tabs) ----------
// The Trackers / NPC trackers tabs show one row per def: the label is display-only and only
// the value (+ max, + quest outcome) is editable. Rows serialize back to the same
// `[TRACKERS]` / `[NPC TRACKERS]` block text the save path already parses, so save logic is untouched.

// Display rows for every hero def from a snapshot: [{d, value, max, outcome}]. Max comes from
// the snapshot (the block text omits it), so a cap this turn changed survives the save.
function edHeroRowsData(snap) {
  const stats = (state.character && state.character.stats) || {};
  const cur = snap || {};
  return trackerDefs.map((d) => {
    const raw = cur[d.key];
    const value = raw === undefined || raw === null ? "" : String(raw);
    let max;
    if (d.type === "number") {
      // A formula cap is derived (the save path ignores any hand-written /max for it), so the
      // live value is shown read-only; a stored cap is freely editable.
      const lm = liveMax(d, cur, stats);
      // Non-quest trackers get `outcome: undefined` (no select); quest trackers get "" untagged.
      const qof = isQuestTrackerDef(d) ? cur[d.key + ".outcome"] : undefined;
      const outf = qof === undefined ? undefined : (qof === "completed" || qof === "failed" ? qof : "");
      if (d.maxFormula) return { d, value, max: lm !== undefined ? String(lm) : "", fixed: true, outcome: outf };
      const sm = cur[d.key + ".max"];
      max = sm !== undefined ? String(sm) : (lm !== undefined ? String(lm) : "");
    }
    const qo = isQuestTrackerDef(d) ? cur[d.key + ".outcome"] : undefined;
    return { d, value, max, fixed: false, outcome: qo === undefined ? undefined : (qo === "completed" || qo === "failed" ? qo : "") };
  });
}

// Display sections from an NPC value map: [{name, rows, extra: []}].
function edNpcSecsData(vals) {
  const stats = (state.character && state.character.stats) || {};
  return Object.keys(vals || {}).map((name) => ({
    name,
    rows: npcTrackerDefs.map((d) => {
      const cur = vals[name] || {};
      const raw = cur[d.key];
      const value = raw === undefined || raw === null ? "" : String(raw);
      let max;
      if (d.type === "number") {
        const lm = liveMax(d, cur, stats);
        if (d.maxFormula) return { d, value, max: lm !== undefined ? String(lm) : "", fixed: true, outcome: undefined };
        const sm = cur[d.key + ".max"];
        max = sm !== undefined ? String(sm) : (lm !== undefined ? String(lm) : "");
      }
      return { d, value, max, fixed: false, outcome: undefined };
    }),
    extra: []
  }));
}

// One editable row: uneditable label, editable value (+ max for capped numbers, + outcome
// select for quest trackers). `outcome === undefined` means no select (NPC rows — the save
// path drops NPC outcome tags, so none is offered).
function edTrackerRowEl(d, value, max, outcome, fixed) {
  const row = document.createElement("div");
  row.className = "ed-trk-row";
  row.dataset.key = d.key;
  const label = d.label || d.key;
  let tail = "";
  // The max box only shows when the tracker actually has a cap — a max-less number stays a
  // single value field (a cap is world config, hand-added via the world editor, not the reply).
  if (d.type === "number" && max !== undefined && max !== "") {
    tail += fixed
      ? `<span class="ed-trk-sep" aria-hidden="true">/</span><span class="ed-trk-maxro" title="Derived max — fixed by the world"> ${esc(max)}</span>`
      : `<span class="ed-trk-sep" aria-hidden="true">/</span><input class="ed-plain ed-trk-max" value="${esc(max)}" aria-label="${esc(label)} max" title="Max">`;
  }
  if (outcome !== undefined) {
    const sel = (v, t) => `<option value="${v}"${outcome === v ? " selected" : ""}>${t}</option>`;
    tail += `<select class="ed-trk-out" aria-label="${esc(label)} outcome" title="Quest outcome">${sel("", "—")}${sel("completed", "✓ completed")}${sel("failed", "✗ failed")}</select>`;
  }
  // Hidden trackers ride along as normal rows (excluding them would wipe this turn's
  // hidden values on save) — the tag marks why they're invisible everywhere else.
  const hid = d.show === "hidden" ? `<span class="ed-trk-hid" title="Hidden tracker — tracked by the AI but shown nowhere else">hidden</span>` : "";
  row.innerHTML = `<span class="ed-trk-key">${esc(String(label).toUpperCase())}</span><input class="ed-plain ed-trk-val" value="${esc(value)}" aria-label="${esc(label)}">${tail}${hid}`;
  return row;
}

// One NPC section: uneditable name + per-def rows + a remove button (removing the section
// means "unchanged by this turn", exactly like deleting it from the raw block).
function edNpcSecEl(name, rowsData, onRemove) {
  const sec = document.createElement("div");
  sec.className = "ed-npc-sec";
  sec.dataset.name = name;
  sec._extra = [];
  const head = document.createElement("div");
  head.className = "ed-npc-head";
  head.innerHTML = `<span class="ed-npc-name">${esc(name)}</span>`;
  const del = document.createElement("button");
  del.type = "button";
  del.className = "mini ed-npc-del";
  del.textContent = "✕";
  del.title = `Remove ${name} (leaves their values untouched)`;
  del.onclick = () => { sec.remove(); if (onRemove) onRemove(); };
  head.appendChild(del);
  const rows = document.createElement("div");
  rows.className = "ed-npc-rows";
  for (const r of rowsData) rows.appendChild(edTrackerRowEl(r.d, r.value, r.max, r.outcome, r.fixed));
  sec.appendChild(head);
  sec.appendChild(rows);
  return sec;
}

function edFillHeroRows(box, rowsData, extra) {
  box.innerHTML = "";
  for (const r of rowsData) box.appendChild(edTrackerRowEl(r.d, r.value, r.max, r.outcome, r.fixed));
  box._extra = extra || [];
}

function edFillNpcSecs(box, secsData, extra, onRemove) {
  box.innerHTML = "";
  for (const s of secsData) {
    const sec = edNpcSecEl(s.name, s.rows, onRemove);
    sec._extra = s.extra || [];
    box.appendChild(sec);
  }
  box._extra = extra || [];
}

// Parse `[TRACKERS]`-style `key: value` lines back into rows (full-mode → tabs flip).
// Unknown lines ride along verbatim so flipping never loses text the save path ignores anyway.
// `keepTags` (NPC blocks) leaves `[!completed]`-style tags inside the value instead of
// splitting them into an outcome select the NPC save path would drop.
function edParseRowLines(text, defs, keepTags) {
  const rows = [];
  const extra = [];
  const byKey = {};
  for (const d of defs) byKey[d.key] = d;
  for (const ln of String(text || "").split("\n")) {
    if (!ln.trim()) continue;
    if (/^\s*\[[^\]]*\]\s*$/.test(ln) && ln.indexOf(":") < 0) continue; // the header
    const m = ln.match(/^\s*([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    const d = m ? byKey[m[1]] : null;
    if (!d) { extra.push(ln); continue; }
    let rest = m[2].trim();
    let value = rest, max = "", outcome;
    if (d.type === "number") {
      const sl = rest.match(/^\s*([+-]?[\d.]+)\s*\/\s*([+-]?[\d.]+)\s*$/);
      if (sl) { value = sl[1]; max = sl[2]; }
    } else if (isQuestTrackerDef(d) && !keepTags) {
      const tag = (s) => {
        const t = s.match(/\[\s*!?\s*(completed|complete|failed|fail)\s*\]/i);
        if (!t) return null;
        const w = t[1].toLowerCase();
        return w === "failed" || w === "fail" ? "failed" : "completed";
      };
      const trail = rest.match(/\s*\[\s*!?\s*(completed|complete|failed|fail)\s*\]\s*$/i);
      if (trail) {
        outcome = tag(trail[0]);
        rest = rest.slice(0, trail.index).trim();
      } else {
        const lead = rest.match(/^\s*\[\s*!?\s*(completed|complete|failed|fail)\s*\]\s*/i);
        if (lead) {
          outcome = tag(lead[0]);
          rest = rest.slice(lead[0].length).trim();
        } else outcome = "";
      }
      value = rest;
    }
    rows.push({ d, value, max, outcome, fixed: !!d.maxFormula });
  }
  return { rows, extra };
}

// Parse an `[NPC TRACKERS]` block into per-character sections. Sections for uncatalogued
// names ride along verbatim (same reason as hero extras).
function edParseNpcBlock(text) {
  const secs = [];
  const extra = [];
  const keySet = new Set(npcTrackerDefs.map((d) => String(d.key).toLowerCase()));
  const catalog = state.npcs || {};
  const resolveSec = (label) => {
    if (catalog[label]) return label;
    const low = label.toLowerCase();
    for (const n of Object.keys(catalog)) if (n.toLowerCase() === low) return n;
    return null;
  };
  let cur = null;
  const flush = () => {
    if (!cur) return;
    if (cur.known) {
      const p = edParseRowLines(cur.lines.join("\n"), npcTrackerDefs, true);
      secs.push({ name: cur.name, rows: p.rows, extra: p.extra });
    } else {
      for (const l of cur.raw) extra.push(l);
    }
    cur = null;
  };
  for (const ln of String(text || "").split("\n")) {
    if (/^\s*\[[^\]]*\]\s*$/.test(ln) && ln.indexOf(":") < 0) continue; // the header
    const head = ln.match(/^\s*(.+?)\s*:\s*$/);
    const label = head ? head[1].trim() : null;
    if (label !== null && !keySet.has(label.toLowerCase())) {
      flush();
      const name = resolveSec(label);
      if (name) cur = { known: true, name, lines: [] };
      else extra.push(ln);
      continue;
    }
    if (cur) cur.lines.push(ln);
    else if (ln.trim()) extra.push(ln);
  }
  flush();
  return { secs, extra };
}

function edSerializeRowLine(row, defs) {
  const d = defs.find((x) => x.key === row.dataset.key);
  if (!d) return null;
  const valEl = row.querySelector(":scope .ed-trk-val");
  const v = valEl ? String(valEl.value).trim() : "";
  if (d.type === "number") {
    const mxEl = row.querySelector(":scope .ed-trk-max");
    const m = mxEl ? String(mxEl.value).trim() : "";
    return m !== "" ? `${d.key}: ${v}/${m}` : `${d.key}: ${v}`;
  }
  const osEl = row.querySelector(":scope .ed-trk-out");
  const o = osEl && (osEl.value === "completed" || osEl.value === "failed") ? ` [!${osEl.value}]` : "";
  return `${d.key}: ${v}${o}`;
}

function edSerializeHeroBlock(w) {
  if (!trackerDefs.length) return "";
  const box = w.querySelector("#edTrkRows");
  if (!box) return "";
  const lines = [];
  for (const row of box.querySelectorAll(":scope > .ed-trk-row")) {
    const ln = edSerializeRowLine(row, trackerDefs);
    if (ln !== null) lines.push(ln);
  }
  for (const x of (box._extra || [])) lines.push(x);
  if (!lines.length) return "";
  return "[TRACKERS]\n" + lines.join("\n");
}

function edSerializeNpcBlock(w) {
  if (!npcTrackerDefs.length) return "";
  const box = w.querySelector("#edNpcSecs");
  if (!box) return "";
  const secs = [];
  for (const sec of box.querySelectorAll(":scope > .ed-npc-sec")) {
    const lines = [`${sec.dataset.name}:`];
    for (const row of sec.querySelectorAll(":scope .ed-npc-rows > .ed-trk-row")) {
      const ln = edSerializeRowLine(row, npcTrackerDefs);
      if (ln !== null) lines.push(ln);
    }
    for (const x of (sec._extra || [])) lines.push(x);
    secs.push(lines.join("\n"));
  }
  const extra = box._extra || [];
  if (!secs.length && !extra.length) return "";
  return "[NPC TRACKERS]\n" + [...secs, ...extra].join("\n\n");
}

function edBuildGmFull(w) {
  const bits = [];
  const choices = [];
  for (const row of w.querySelectorAll("#edLines .ed-line")) {
    const kind = row.dataset.kind;
    const ta = row.querySelector(".ed-line-ta");
    const txt = ta ? ta.value : "";
    if (kind === "choice") { if (txt.trim()) choices.push(txt.trim()); continue; }
    if (kind === "npc") {
      const nm = (row.querySelector(".ed-name") || {}).value || "";
      bits.push(`[${txt.trim() ? (nm.trim() || "Someone") : (nm.trim() || "Someone")}] ${txt}`);
    } else if (kind === "thought") {
      const nm = (row.querySelector(".ed-name") || {}).value || "";
      bits.push(`[${nm.trim() || "Someone"} inner] ${txt}`);
    } else if (kind === "meta") {
      bits.push(txt.trim() || "✦ ✦ ✦");
    } else {
      bits.push(txt);
    }
  }
  let full = bits.join("\n\n");
  if (choices.length) full += (full ? "\n\n" : "") + choices.map((o) => `[[CHOICE: ${o}]]`).join("\n");
  const trk = edSerializeHeroBlock(w);
  if (trk) full += "\n\n" + trk;
  const npc = edSerializeNpcBlock(w);
  if (npc) full += "\n\n" + npc;
  return full;
}

function saveActionText(turn, txt) {
  const rw = rewindMemoryForRegion(turn.start);
  turn.action.text = txt;
  memory.rewindFromTurn(state, rw.k, rw.baked);
  editing = null;
  render();
  store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
}

function saveGmFull(turn, full) {
  const rw = rewindMemoryForRegion(turn.action ? turn.start + 1 : turn.start);
  const gmNoNpc = extractNpcTrackers(full);
  const gmParts = extractTrackers(gmNoNpc.text);
  const parsed = engine.parseGmOutput(gmParts.text);
  // [[NPC: ...]] tags in the edited text (parsed.promotes/notes) would be lost on splice —
  // keep them so the promote entries can be created with the EDITED turn's ordinal below.
  const editedPromotes = [...(parsed.npcPromotes || [])];
  const editedNotes = { ...(parsed.npcNotes || {}) };
  if (trackerDefs.length) {
    const heroStats = (state.character && state.character.stats) || {};
    let prevSnap = (state && state.initialTrackers) || null;
    for (let i = turn.start - 1; i >= 0; i--) {
      const m = state.messages[i];
      if (m && m.afterTrackers && typeof m.afterTrackers === "object") { prevSnap = m.afterTrackers; break; }
    }
    // Parse against the PRE-turn snapshot (not the live state): the quest [!completed]/[!failed]
    // tag logic compares the edited value to the value going INTO the turn (prev), so parsing
    // against the live/after values wipes the new quest text (raw === current → "") and drops
    // the tag on empty completions (prev looks empty). Same basis the AI path uses.
    // An emptied tracker block means "leave values untouched" — keep this turn's own snapshot.
    const trackers = gmParts.block
      ? parseTrackerBlock(gmParts.block, trackerDefs, prevSnap, heroStats)
      : { ...((turn.parts[turn.parts.length - 1] && turn.parts[turn.parts.length - 1].afterTrackers) || prevSnap || {}) };
    // Level-up backstop, same as the AI path (see RPEngine.enforceLevelUp): a hand-edit that pins
    // exp at its cap without raising the level would otherwise leave the bar stuck full forever —
    // the exact failure the backstop exists to fix. `prev` is this turn's predecessor snapshot
    // (not the live state, which may include later turns), so an already-raised level is topped
    // up, never double-leveled. Never undoes anything the edit granted.
    const fixed = applyLevelUpBackstop(trackers, prevSnap, trackerDefs, heroStats);
    for (const m of parsed) m.afterTrackers = fixed;
  }
  applyEditedNpcTrackerBlock(turn, parsed, gmNoNpc.block);
  const checks = turn.parts.filter((m) => m.role === "check");
  const newParts = [...checks, ...parsed.map((m) => ({ ...m, ts: Date.now() }))];
  const keepStart = turn.action ? turn.start + 1 : turn.start;
  const next = [];
  for (let i = 0; i < keepStart; i++) next.push(state.messages[i]);
  for (const m of newParts) next.push(m);
  for (let i = turn.end + 1; i < state.messages.length; i++) next.push(state.messages[i]);
  state.messages = next;
  if (turn.action) {
    const rl = turn.action.rerolls;
    if (rl && rl.length) rl[turn.action.rerollIndex || 0] = newParts;
  } else {
    normalizeOpeningRerolls();
    const list = state.openingRerolls[turn.start];
    if (list && list.length) list[state.openingRerollIndex || 0] = newParts;
  }
  memory.rewindFromTurn(state, rw.k, rw.baked);
  editing = null;
  // The edited turn's anchored ordinal (NOT state.turn): newcomers/promotes edited into an old
  // turn must be stamped with that turn, and sightings must reflect visible ordinals throughout.
  const editedOrdinal = anchoredUpTo(state.messages, keepStart);
  const st = state;
  const onBuild = () => {
    if (state !== st) return;
    render();
    refreshRailIfOpen("right");
    store.save(st).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
  };
  const promoted = editedPromotes.length ? npcSys.registerPromoteTags(editedPromotes, editedNotes, st, editedOrdinal, onBuild) : [];
  const res = reconcileNpcsAfterRewrite();
  const created = [...new Set([...promoted, ...res.created])];
  render();
  grantAndAnnounceLevelUp();
  refreshHeroPos();
  maybeRefreshMap();
  store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
  if (created.length) {
    // reconcile already toasted res.created; only toast here when promotes added entries that
    // rebuild preserved silently (promote-only, no dialogue tally).
    const silent = created.filter((n) => !res.created.includes(n));
    if (silent.length) notify("👤 New acquaintance" + (silent.length > 1 ? "s" : "") + ": " + silent.join(", "));
  }
}

function expLevelUpGain(prevSnap, snap, expDef, lvlDef, stats) {
  const pv = prevSnap ? prevSnap[expDef.key] : undefined;
  const nv = snap ? snap[expDef.key] : undefined;
  const pl = prevSnap ? prevSnap[lvlDef.key] : undefined;
  const nl = snap ? snap[lvlDef.key] : undefined;
  if (typeof pv !== "number" || typeof nv !== "number") return null;
  if (typeof pl !== "number" || typeof nl !== "number" || !(nl > pl)) return null;
  const levels = Math.floor(nl - pl);
  if (!(levels >= 1)) return null;
  const capAt = (level, useSnap) => {
    const base = useSnap ? { ...(prevSnap || {}), ...(snap || {}) } : { ...(prevSnap || {}) };
    base[lvlDef.key] = level;
    const c = liveMax(expDef, base, stats);
    return typeof c === "number" && isFinite(c) && c > 0 ? Math.round(c) : null;
  };
  const cap0 = capAt(pl, false) ?? capAt(pl, true);
  if (cap0 === null) return null;
  let gain = (cap0 - pv) + nv;
  for (let i = 1; i < levels; i++) {
    const c = capAt(pl + i, true) ?? cap0;
    gain += c;
  }
  return gain;
}

function trackerDeltas(turn) {
  if (!turn.parts || !turn.parts.length) return [];
  const last = turn.parts[turn.parts.length - 1];
  const snap = (last && last.afterTrackers) || currentTrackers();
  let prev = (state && state.initialTrackers) || initialTrackers(trackerDefs);
  for (let i = turn.start - 1; i >= 0; i--) {
    const m = state.messages[i];
    if (m && m.afterTrackers && typeof m.afterTrackers === "object") { prev = m.afterTrackers; break; }
  }
  const out = [];
  const heroStats = (state && state.character && state.character.stats) || {};
  const lvlDef = levelTracker(trackerDefs);
  const expDef = expTracker(trackerDefs);
  for (const d of trackerDefs) {
    if (d.show === "hidden") continue; // hidden trackers leave no change chips
    const nv = snap[d.key];
    const pv = prev[d.key];
    const qo = isQuestTrackerDef(d) ? snap[d.key + ".outcome"] : undefined;
    let outcome = qo === "completed" || qo === "failed" ? qo : undefined;
    if (outcome) {
      const pvEmpty = pv == null || String(pv).trim() === "" || String(pv).trim() === "—" || String(pv).trim() === "-";
      if (pvEmpty) outcome = undefined;
    }
    if (d.type === "number") {
      if (typeof nv !== "number" || typeof pv !== "number" || nv === pv) continue;
    } else if (nv === pv && !outcome) {
      continue; // text tracker — only a chip when the value actually changed (or a quest resolved)
    }
    const entry = { d, prev: pv, value: nv, outcome };
    if (d.type === "number" && expDef && d === expDef && lvlDef) {
      const g = expLevelUpGain(prev, snap, expDef, lvlDef, heroStats);
      if (g !== null) entry.delta = g;
    }
    out.push(entry);
  }
  return out;
}

// Per-NPC change chips for a reply (README §6.3.1). Same idea as trackerDeltas, with one
// real difference: "previous" is PER CHARACTER, not turn-to-turn. For each character in this turn's
// snapshot we walk back for the newest earlier message whose snapshot contains THAT character — else
// their entry seed — so a character who sat out five turns still compares against their last known
// value when they return. Only values that actually moved produce a chip.
function npcTrackerDeltas(turn) {
  if (!npcTrackerDefs.length || !turn.parts || !turn.parts.length) return [];
  const last = turn.parts[turn.parts.length - 1];
  const snap = last && last.afterNpcTrackers;
  if (!snap || typeof snap !== "object") return [];
  const stats = (state.character && state.character.stats) || {};
  const prevFor = (name) => {
    for (let i = turn.start - 1; i >= 0; i--) {
      const m = state.messages[i];
      const s = m && m.afterNpcTrackers;
      const v = s && typeof s === "object" ? s[name] : null;
      if (v && typeof v === "object" && Object.keys(v).length) return v;
    }
    const entry = (state.npcs || {})[name];
    if (entry && entry.trackers && Object.keys(entry.trackers).length) return entry.trackers;
    return initialNpcTrackers(npcTrackerDefs, stats);
  };
  const out = [];
  const npcLvlDef = levelTracker(npcTrackerDefs);
  const npcExpDef = expTracker(npcTrackerDefs);
  // Off-screen bookkeeping suppression: names the tracker call changed from banked happenings
  // (stamped on the message beside the snapshot) leave no chips — the player never saw it happen.
  // Exception: a marked character who speaks in THIS turn is present, so their chips are contextual.
  const muted = new Set(Array.isArray(last.afterNpcTrackersOffscreen) ? last.afterNpcTrackersOffscreen.map(String) : []);
  const speakers = new Set();
  for (const p of (turn.parts || [])) {
    if (p && (p.role === "npc" || p.role === "thought")) {
      const k = p.npcKey || p.name;
      if (k) { speakers.add(String(k)); speakers.add(String(k).toLowerCase()); }
    }
  }
  for (const [name, vals] of Object.entries(snap)) {
    if (!vals || typeof vals !== "object") continue;
    if (!(state.npcs || {})[name]) continue; // a snapshot for a character no longer catalogued
    if (muted.has(name) && !speakers.has(name) && !speakers.has(String(name).toLowerCase())) continue;
    const prev = prevFor(name);
    for (const d of npcTrackerDefs) {
      if (d.show === "hidden") continue; // hidden trackers leave no change chips
      const nv = vals[d.key];
      const pv = prev[d.key];
      if (d.type === "number") {
        if (typeof nv !== "number" || typeof pv !== "number" || nv === pv) continue;
      } else if ((nv == null ? "" : String(nv)) === (pv == null ? "" : String(pv))) {
        continue; // text tracker — only a chip when the value actually changed
      }
      const entry = { name, d, prev: pv, value: nv };
      if (d.type === "number" && npcExpDef && d === npcExpDef && npcLvlDef) {
        const g = expLevelUpGain(prev, vals, npcExpDef, npcLvlDef, stats);
        if (g !== null) entry.delta = g;
      }
      out.push(entry);
    }
  }
  return out;
}

function renderTurn(turn, idx, isLatest = false, choicesLive = false) {
  const wrap = document.createElement("div");
  wrap.className = "turn";
  if (turn.image) {
    const m = turn.image;
    // The re-roll button only shows once the batch is fully generated (has finished images and
    // no pending/failed placeholders) — it replaces those images using the same stored prompt.
    const done = (m.images || []).length > 0 && !m.pending && !m.failed;
    const ctrl = document.createElement("div");
    ctrl.className = "action-ctrl img-ctrl";
    ctrl.innerHTML = (done ? `<button class="c-btn reroll" title="Re-roll image(s) with same prompt">⟳</button>` : "") +
      `<button class="c-btn edit" title="Edit prompt & regenerate">✎</button><button class="c-btn del" title="Delete all images">✖</button>`;
    const rb = ctrl.querySelector(".reroll");
    if (rb) rb.onclick = () => rerollImagesWithConfirm(m);
    ctrl.querySelector(".edit").onclick = () => editImagePrompt(m);
    ctrl.querySelector(".del").onclick = () => deleteMessageWithConfirm(m);
    const imgMsg = imageMsgEl(turn.image);
    imgMsg.appendChild(ctrl);
    wrap.appendChild(imgMsg);
    return wrap;
  }
  const isEditing = editing && editing.turnIdx === idx;
  // CYOA option buttons only render on the LATEST GM reply (older turns' choices are hidden — a
  // choice anchors a new turn, so past options are no longer live), and never on a game-over turn
  // (the composer is locked then). Inner thoughts stay gated by the Settings toggle.
  const turnOver = turn.parts.some((m) => m.gameOver);
  // CYOA choice messages are held out of the normal part flow and appended AFTER the tracker
  // change chips below, so the option buttons sit at the very bottom of the reply.
  const choiceMsg = (choicesLive && !turnOver) ? turn.parts.find((m) => m.role === "choice") : null;
  const visible = turn.parts.filter((m) =>
    m.role !== "choice" &&
    !(m.role === "thought" && !state.settings.showInnerThoughts));

  if (turn.action) {
    const isDirect = turn.action.role === "direct";
    const isAdvance = isDirect && turn.action.kind === "advance";
    if (isAdvance) {
      // An ⏩ Advance turn: its own wide centered box — "Advance" header over the ✦ ✦ ✦
      // divider, no icon or accent (deliberately distinct from the Direct/Travel system
      // boxes). There is no action text to edit. The reply controls below carry
      // edit/re-roll/delete-reply; this row's ✖ deletes the whole advance turn. Re-roll
      // re-runs the scene transition (kind is kept on the marker), and the ◀/▶ version
      // list works exactly like a normal turn's.
      const md = document.createElement("div");
      md.className = "msg system";
      md.innerHTML = `<div class="bubble system one-line"><div class="sys-side"><span class="sys-ico">⏭︎</span></div><div class="sys-main"><div class="name">✦ ✦ ✦</div></div></div>`;
      const actCtrl = document.createElement("div");
      actCtrl.className = "action-ctrl";
      actCtrl.innerHTML = `<button class="c-btn" title="Delete advance turn">✖</button>`;
      actCtrl.querySelector("button").onclick = () => deleteTurnWithConfirm(turn);
      md.appendChild(actCtrl);
      wrap.appendChild(md);
    } else if (isEditing && editing.which === "action") {
      wrap.appendChild(editEl(turn, idx, "action"));
    } else {
      // ⚡ Direct and registered engine-generated kinds (🧭 Travel, ◷ Waiting, ...) share one
      // system bubble; everything else renders as the ordinary player action bubble.
      const sysDef = systemActionDef(turn.action);
      const msgEl = sysDef ? systemEl(turn.action, sysDef) : actionEl(turn.action);
      const actCtrl = document.createElement("div");
      actCtrl.className = "action-ctrl";
      const del = `<button class="c-btn" title="Delete turn">✖</button>`;
      if (sysDef && sysDef.noEdit) {
        // No player text on this anchor (an idle wait) — nothing to edit, just delete.
        actCtrl.innerHTML = del;
        actCtrl.querySelector("button").onclick = () => deleteTurnWithConfirm(turn);
      } else {
        const edit = `<button class="c-btn" title="${sysDef ? sysDef.editLabel : "Edit your action"}">✎</button>`;
        actCtrl.innerHTML = edit + del;
        actCtrl.querySelectorAll("button")[0].onclick = () => startEdit(idx, "action");
        actCtrl.querySelectorAll("button")[1].onclick = () => deleteTurnWithConfirm(turn);
      }
      msgEl.appendChild(actCtrl);
      wrap.appendChild(msgEl);
    }
  }
  const gmWrap = document.createElement("div");
  gmWrap.className = "gm-row";
  if (isEditing && editing.which === "gm") {
    gmWrap.appendChild(editEl(turn, idx, "gm"));
  } else {
    for (const m of visible) gmWrap.appendChild(partEl(m));
    // Tracker change chips are display-only (snapshots stay intact) and gated by the
    // Story panel's "Show tracker changes" toggle — same pattern as inner thoughts.
    const showTrk = !state.settings || state.settings.showTrackerChanges !== false;
    const deltas = (turn.action && showTrk) ? trackerDeltas(turn) : []; // no change chips for openings
    if (deltas.length) {
      const dd = document.createElement("div");
      dd.className = "trk-deltas";
      dd.innerHTML = deltas.map(({ d, prev, value, outcome, delta }) => {
        const [tc, ta] = trkTip(d);
        const ic = d.icon ? `<span class="trk-ic">${esc(d.icon)}</span>` : "";
        const label = d.label ? `<span class="trk-l">${esc(d.label.toUpperCase())}</span>` : "";
        const chip = (body) => `<span class="trk trk-delta${tc}"${ta}>${ic}${label}<span class="trk-v">${body}</span></span>`;
        if (d.type === "number") {
          const deltaV = typeof delta === "number" ? delta : value - prev;
          const dTxt = (deltaV > 0 ? "+" : "−") + Math.abs(deltaV);
          return chip(`${value} <span class="trk-d${deltaV >= 0 ? "p" : "n"}">(${dTxt})</span>`);
        }
        const p = (prev === "" || prev == null) ? "—" : prev;
        const v = (value === "" || value == null) ? "—" : value;
        const newQuestChip = (val) => `<span class="trk trk-delta${tc}"${ta}>${ic}<span class="trk-l">NEW ${esc((d.label || d.key).toUpperCase())}</span><span class="trk-v">${esc(val)}</span></span>`;
        if (outcome) {
          const doneCls = outcome === "completed" ? "trk-qdone" : "trk-qfail";
          const doneWord = outcome === "completed" ? "COMPLETED" : "FAILED";
          const doneMark = outcome === "completed" ? "✓" : "✗";
          const done = `<span class="trk trk-delta ${doneCls}${tc}"${ta}>${ic}${label}<span class="trk-l">${doneWord}</span><span class="trk-qmark">${doneMark}</span><span class="trk-v">${esc(String(p))}</span></span>`;
          const nv = String(value ?? "");
          if (nv === "" || nv === String(prev ?? "")) return done;
          return done + newQuestChip(nv);
        }
        if (isQuestTrackerDef(d)) {
          if (prev === "" || prev == null) return newQuestChip(String(v));
          return `<span class="trk trk-delta${tc}"${ta}>${ic}<span class="trk-l">NEW ${esc((d.label || d.key).toUpperCase())}</span><span class="trk-v"><span class="trk-dprev">${esc(String(p))}</span><span class="trk-arrow"> → </span><span class="trk-dnext">${esc(String(v))}</span></span></span>`;
        }
        return chip(`<span class="trk-dprev">${esc(String(p))}</span><span class="trk-arrow"> → </span><span class="trk-dnext">${esc(String(v))}</span>`);
      }).join("");
      gmWrap.appendChild(dd);
    }
    const npcDeltas = (turn.action && showTrk) ? npcTrackerDeltas(turn) : []; // no change chips for openings
    if (npcDeltas.length) {
      const nd = document.createElement("div");
      nd.className = "trk-deltas npc-deltas";
      nd.innerHTML = npcDeltas.map(({ name, d, prev, value, delta }) => {
        const [tc, ta] = trkTip(d);
        const ic = d.icon ? `<span class="trk-ic">${esc(d.icon)}</span>` : "";
        const label = d.label ? `<span class="trk-l">${esc(d.label.toUpperCase())}</span>` : "";
        let body;
        if (d.type === "number") {
          const deltaV = typeof delta === "number" ? delta : value - prev;
          const dTxt = (deltaV > 0 ? "+" : "−") + Math.abs(deltaV);
          body = `${value} <span class="trk-d${deltaV >= 0 ? "p" : "n"}">(${dTxt})</span>`;
        } else {
          const p = (prev === "" || prev == null) ? "—" : prev;
          const v = (value === "" || value == null) ? "—" : value;
          body = `<span class="trk-dprev">${esc(String(p))}</span><span class="trk-arrow"> → </span><span class="trk-dnext">${esc(String(v))}</span>`;
        }
        const who = `<span class="trk-npc">${esc(String(name).toUpperCase())} · </span>`;
        return `<span class="trk trk-delta${tc}"${ta}>${who}${ic}${label}<span class="trk-v">${body}</span></span>`;
      }).join("");
      gmWrap.appendChild(nd);
    }
    if (choiceMsg) gmWrap.appendChild(partEl(choiceMsg, true));
  }
  wrap.appendChild(gmWrap);

  if ((visible.length || choiceMsg) && !(isEditing && editing.which === "gm")) {
    const ctrl = document.createElement("div");
    ctrl.className = "turn-ctrl";
    const nVersions = turn.action ? ((turn.action.rerolls || []).length || 1) : (openingVersions(turn.start).length || 1);
    // Re-roll + version nav are offered only on the latest GM reply (isLatest); older replies can
    // still be edited or deleted.
    let nav = "";
    if (isLatest && nVersions > 1) {
      const cur = turn.action ? (turn.action.rerollIndex || 0) : (state.openingRerollIndex || 0);
      nav = `<button class="c-btn nav" data-nav="-1" title="Previous re-roll">◀</button>
        <span class="reroll-count">${cur + 1}/${nVersions}</span>
        <button class="c-btn nav" data-nav="1" title="Next re-roll">▶</button>`;
    }
    const edit = `<button class="c-btn edit" title="Edit this reply">✎</button>`;
    const reroll = isLatest ? `<button class="c-btn reroll" title="Re-roll reply">⟳</button>` : "";
    const del = `<button class="c-btn del" title="Delete reply">✖</button>`;
    ctrl.innerHTML = nav + edit + reroll + del;
    ctrl.querySelectorAll("button.nav").forEach((b) => b.onclick = (e) => navReroll(turn, +b.dataset.nav, e.currentTarget));
    ctrl.querySelector("button.edit").onclick = () => startEdit(idx, "gm");
    const rerollBtn = ctrl.querySelector("button.reroll");
    if (rerollBtn) rerollBtn.onclick = (e) => rerollTurn(turn, e.currentTarget);
    ctrl.querySelector("button.del").onclick = () => deleteGmReplyWithConfirm(turn);
    gmWrap.appendChild(ctrl);
  }
  // The game-over badge caps the turn that carried the hero's death (its messages are flagged by
  // runGmTurn) — rendered after everything else so it reads as the end of the story.
  if (turn.parts.some((m) => m.gameOver)) wrap.appendChild(gameOverBadgeEl());
  return wrap;
}

// ---- System-bubble turns -----------------------------------------------------------------------
// A turn's anchor is usually the player's own typed action. Two other kinds of anchor are NOT in-world
// player actions and wear the same left-aligned SYSTEM bubble instead: ⚡ Direct (an OOC instruction to
// the GM — a `role`, not a `kind`) and engine-generated actions such as 🧭 Travel, whose text is written
// by the app rather than typed (more will follow — fast travel, rest, craft, ...). Both are described by
// one registry entry here, so the bubble's badge and labels have a single home — add an entry for a new
// engine action and it just works. Fields:
//   icon      the badge shown where a player avatar would sit
//   label     the bubble's accent name row
//   editLabel the text-editor's heading
// Anything not registered falls through to the ordinary player bubble.
const SYSTEM_ACTIONS = {
  travel: { icon: "🧭", label: "Travel", editLabel: "Edit this travel" },
  direct: { icon: "⚡", label: "Direct", editLabel: "Edit your direction" },
  // Empty-send waits anchor their own turn (see send) and render through this same bubble
  // as a one-line header (empty text triggers systemEl's one-line layout). `noEdit` drops
  // the ✎ control — there is no player text to edit — leaving just delete, like Advance.
  idle: { icon: "◷", label: "✦ ✦ ✦", noEdit: true }
};

// The registry entry for a turn's anchor, or null for an ordinary player action. `direct` is a role
// (the OOC command); an ⏩ Advance marker is also `role:"direct"` but renders as a scene-break divider
// elsewhere, so it never reaches here.
function systemActionDef(m) {
  if (!m) return null;
  if (m.role === "direct") return m.kind === "advance" ? null : SYSTEM_ACTIONS.direct;
  return SYSTEM_ACTIONS[m.kind] || null;
}

function systemEl(m, def) {
  const w = document.createElement("div");
  w.className = "msg system";
  // Textless anchors (an idle wait) collapse to the one-line header layout.
  const oneLine = String(m.text || "").trim() ? "" : " one-line";
  w.innerHTML = `<div class="bubble system${oneLine}"><div class="sys-side"><span class="sys-ico">${def.icon || "⚙"}</span></div><div class="sys-main"><div class="name">${esc(def.label || m.kind || "System")}</div><div class="text">${renderText(m.text)}</div></div></div>`;
  return w;
}

function actionEl(m) {
  const c = state.character || {};
  const av = c.portrait || "src/images/portrait-placeholder.webp";
  const avHtml = /^(data:|https?:|blob:)|\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i.test(av) ? `<img src="${av}">` : `<span>${av}</span>`;
  const name = c.name || "You";
  const w = document.createElement("div");
  w.className = "msg action";
  w.innerHTML = `<div class="bubble action"><div class="name">${esc(name)}</div><div class="text">${renderText(m.text)}</div></div>
    <div class="avatar">${avHtml}</div>`;
  return w;
}

function checkPipHtml(c, live = false) {
  const label = String(c.statLabel || c.stat || "?").toUpperCase();
  const sides = Math.max(2, Math.floor(Number(c.sides)) || 20);
  const modTxt = (c.mod >= 0 ? "+" : "−") + Math.abs(c.mod);
  const crit = c.crit;
  const resultWord = crit === "pass" ? "CRITICAL SUCCESS" : crit === "fail" ? "CRITICAL FAILURE" : c.passed ? "SUCCESS" : "FAILURE";
  const rev = live ? "" : " revealed";
  return `<span class="check-pip ${c.passed ? "pass" : "fail"}${live ? " live" : ""}">
    <span class="cp-line cp-top">
      <span class="cp-lead"><span class="cp-dice">🎲</span><span class="cp-stat">${label}</span><span class="cp-die-type">d${sides}</span></span>
      <span class="cp-target">Target <b>${c.dc}</b></span>
    </span>
    <span class="cp-line cp-bottom">
      <span class="cp-calc"><span class="cp-roll">Roll <b class="die">${c.die}</b></span><span class="cp-mod${rev}">${modTxt}</span><span class="cp-eq${rev}">= <b>${c.total}</b></span></span>
      <span class="cp-result ${c.passed ? "pass" : "fail"}${crit ? " crit" : ""}${rev}">${resultWord}</span>
    </span>
  </span>`;
}

function checkPipEl(c, { animate = false } = {}) {
  const w = document.createElement("div");
  w.className = "msg check";
  w.innerHTML = checkPipHtml(c, animate);
  if (!animate) return w;
  // live roll: flash random 1-20 (fast → slow), then land on the real value and reveal
  // the mod, then the total, then the SUCCESS/FAILURE badge.
  const die = w.querySelector(".die");
  const modEl = w.querySelector(".cp-mod");
  const eqEl = w.querySelector(".cp-eq");
  const resEl = w.querySelector(".cp-result");
  const pip = w.querySelector(".check-pip");
  const STOP_MS = 1600, HOLD_MS = 90;
  die.classList.add("rolling");
  const sides = Math.max(2, Math.floor(Number(c.sides)) || 20);
  let t = 0, step = 46;
  const frames = [];
  while (t < STOP_MS) { frames.push([t, 1 + Math.floor(Math.random() * sides)]); t += step; step += 8; }
  frames.push([STOP_MS + HOLD_MS, c.die]);
  for (const [at, v] of frames) setTimeout(() => { die.textContent = v; }, at);
  setTimeout(() => { die.classList.remove("rolling"); pip.classList.add("landed"); }, STOP_MS + HOLD_MS);
  setTimeout(() => modEl.classList.add("revealed"), STOP_MS + HOLD_MS + 260);
  setTimeout(() => eqEl.classList.add("revealed"), STOP_MS + HOLD_MS + 520);
  setTimeout(() => resEl.classList.add("revealed"), STOP_MS + HOLD_MS + 820);
  return w;
}

// Is this bubble's speaker the HERO themself? The GM is told to voice NPCs, but it sometimes writes a
// line for the player ("[Rowan] \"…\"" or "[Rowan inner] …"). The parse is deliberately left alone —
// the message is exactly what the GM wrote — so this is purely how it renders: the hero's own portrait
// instead of the placeholder, and a click that opens the Hero panel instead of treating the hero as an
// unknown NPC and offering to generate a profile for them. Matched case-insensitively, also accepting
// the {{user}} token or a bare "You" in case the GM echoes one of those.
function isHeroSpeaker(name) {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return false;
  const hero = String(((state && state.character) || {}).name || "").trim().toLowerCase();
  return (!!hero && n === hero) || n === USER_PLACEHOLDER || n === "you";
}

// The catalogue entry for a chat speaker. Linked lines (`m.npcKey`) win outright — the bubble
// keeps the GM's spelling ("Garreth") while the avatar/popup follow the canonical entry
// ("Captain Garreth"). Unlinked lines (legacy saves, generic speakers) fall back to the old
// exact-then-unique-subset lookup, so a variant still finds its profile when the key is absent.
// Ambiguous variants match nothing. Descriptors that never linked ("Maya's friend" for "Maya")
// match nothing either — they are a different person, not a variant.
// `unlinked` is the per-line flag (`m.npcUnlinked` from the 🔗 menu): exact-or-nothing, same as a
// ruled-separate spelling. Without it an unlinked bubble would still wear the profile's avatar.
function npcForSpeaker(name, npcKey, unlinked) {
  const npcs = (state && state.npcs) || {};
  if (!unlinked && npcKey && npcs[npcKey]) return npcs[npcKey];
  // Player overrides from the 🔗 menu outrank the automatic resolver (see npcLinkRuleFor).
  const rule = npcLinkRuleFor(state, name);
  if (!unlinked && rule && rule.mode === "link" && npcs[rule.target]) return npcs[rule.target];
  if (unlinked || (rule && rule.mode === "unlink")) { // separate: exact only, never a variant
    if (npcs[name]) return npcs[name];
    const lt = String(name || "").trim().toLowerCase();
    for (const k of Object.keys(npcs)) if (k.toLowerCase() === lt) return npcs[k];
    return null;
  }
  if (npcs[name]) return npcs[name];
  const t = String(name || "").trim();
  if (!t || !Object.keys(npcs).length) return null;
  const lt = t.toLowerCase();
  for (const k of Object.keys(npcs)) if (k.toLowerCase() === lt) return npcs[k];
  const hit = resolveNpcName(t, Object.keys(npcs));
  return hit ? npcs[hit] : null;
}

// The roster entry a bubble is effectively linked to, when that differs from its printed label —
// the thing the faded 🔗 stands for. Key first (stored linkage), then a pinned "link" rule, then
// the automatic fuzzy fallback (legacy lines without a key). Null when the bubble speaks for
// itself (exact, generic, or ruled separate).
export function linkedCanonFor(m) {
  if (!m || !m.name || isHeroSpeaker(m.name)) return null;
  const npcs = (state && state.npcs) || {};
  const display = String(m.name || "").trim();
  if (!display) return null;
  if (m.npcUnlinked) return null;
  if (m.npcKey && npcs[m.npcKey] && m.npcKey !== display) return npcs[m.npcKey];
  const rule = npcLinkRuleFor(state, display);
  if (rule && rule.mode === "unlink") return null;
  if (rule && rule.mode === "link" && npcs[rule.target] && rule.target !== display) return npcs[rule.target];
  const hit = npcForSpeaker(display, null);
  if (hit && hit.name && hit.name !== display) return hit;
  return null;
}

// What the automatic resolver WOULD link this spelling to, ignoring the player's overrides —
// used to label the "link it back" action. Null when automatic itself says separate.
function autoCanonFor(display) {
  const npcs = (state && state.npcs) || {};
  const t = String(display || "").trim();
  if (!t || !Object.keys(npcs).length) return null;
  if (npcs[t]) return null; // exact speaks for itself — not a link
  const lt = t.toLowerCase();
  for (const k of Object.keys(npcs)) if (k.toLowerCase() === lt) return null;
  const hit = resolveNpcName(t, Object.keys(npcs));
  return hit ? npcs[hit] : null;
}

// One bubble's link state for the icon + menu: "linked" (faded 🔗, points at canon), "unlinked"
// (cut 🔗 — a flag/rule holds it apart, with what automatic would do attached), or "none" (no
// icon; exact, generic, or hero). The menu is reachable in the first two, and for "none" through
// the name/avatar click's create-or-link choices.
export function linkStateFor(m) {
  if (!m || !m.name || isHeroSpeaker(m.name)) return { kind: "none" };
  const display = String(m.name || "").trim();
  if (!display) return { kind: "none" };
  const linked = linkedCanonFor(m);
  if (linked) return { kind: "linked", canon: linked, display };
  const rule = npcLinkRuleFor(state, display);
  if (m.npcUnlinked || rule) {
    const auto = autoCanonFor(display);
    return { kind: "unlinked", auto, rule: rule || null, display };
  }
  return { kind: "none", display };
}

// The icon HTML for one bubble: faded 🔗 when linked, a dimmer cut 🔗 when a flag/rule holds it
// apart (the way back to the menu), nothing otherwise. Generic scenery stays clean — its
// name/avatar click already offers generate-or-link.
function npcLinkIconHtml(m) {
  const st = linkStateFor(m);
  if (st.kind === "linked") return `<button class="npc-link" type="button" title="Linked to ${esc(st.canon.name)} — change">🔗</button>`;
  if (st.kind === "unlinked" && (st.auto || st.rule)) return `<button class="npc-link off" type="button" title="Unlinked — change">🔗</button>`;
  return "";
}

function partEl(m, interactive = false) {
  if (m.role === "choice") {
    // Choose-your-own-adventure options — a column of buttons emitted by the GM (see MAX_CHOICES in
    // rp-engine.js; a world opts in by putting the `[[CHOICE: ...]]` instruction in its scenario).
    // `interactive` is true only for the latest GM reply; a click submits that option's text as the
    // player's action (submitAction), exactly as if they had typed it.
    const opts = Array.isArray(m.options) ? m.options : [];
    const w = document.createElement("div");
    w.className = "msg choices";
    w.innerHTML = `<div class="choices-label">What do you do?</div><div class="choices-row">` +
      opts.map((o, i) => `<button class="choice-btn" data-i="${i}"><span class="choice-arrow">▸</span><span class="choice-txt">${renderText(o)}</span></button>`).join("") +
      `</div>`;
    if (interactive) {
      w.querySelectorAll(".choice-btn").forEach((b) => { b.onclick = () => submitAction(opts[Number(b.dataset.i)] || ""); });
    } else {
      w.querySelectorAll(".choice-btn").forEach((b) => { b.disabled = true; });
    }
    return w;
  }
  if (m.role === "meta") {
    const w = document.createElement("div");
    w.className = "msg meta";
    w.textContent = m.text;
    return w;
  }
  if (m.role === "npc") {
    // The hero voicing their own line (the GM wrote it) wears the hero's portrait and opens the Hero
    // panel on click; a real NPC wears its catalogue portrait and opens its profile. The bubble
    // label is always the GM's own spelling — only the avatar/link follow the canonical key.
    const heroSpeaker = isHeroSpeaker(m.name);
    // Unlinked lines wear the placeholder even when they would otherwise resolve (that is the
    // point of unlinking); the 🔗/cut icon still offers the way back.
    const npc = heroSpeaker ? {} : (npcForSpeaker(m.name, m.npcKey, m.npcUnlinked) || {});
    const av = heroSpeaker
      ? ((state.character && state.character.portrait) || "src/images/portrait-placeholder.webp")
      : (npc.portrait || "src/images/portrait-placeholder.webp");
    const avHtml = /^(data:|https?:|blob:)|\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i.test(av) ? `<img src="${av}">` : `<span>${av}</span>`;
    // Linked bubbles point at the canonical profile, so the tooltip names it ("Garreth" →
    // "Open Captain Garreth's profile") while the bubble label keeps the GM's spelling.
    const title = heroSpeaker ? "Open your Hero panel" : `Open ${esc((npc && npc.name) || m.name)}'s profile`;
    const w = document.createElement("div");
    w.className = "msg npc";
    w.innerHTML = `<div class="avatar npc-avatar" title="${title}">${avHtml}</div>
      <div class="bubble npc"><div class="name npc-name" title="${title}">${esc(m.name)}${!heroSpeaker ? npcLinkIconHtml(m) : ""}</div><div class="text">${renderText(m.text)}</div></div>`;
    w.querySelector(".npc-avatar").onclick = (e) => openSpeakerFromChat(m, e.currentTarget);
    w.querySelector(".npc-name").onclick = (e) => openSpeakerFromChat(m, e.currentTarget);
    const linkBtn = w.querySelector(".npc-link");
    if (linkBtn) linkBtn.onclick = (e) => { e.stopPropagation(); openNpcLinkMenu(linkBtn, m); };
    return w;
  }
  if (m.role === "thought") {
    const heroSpeaker = isHeroSpeaker(m.name);
    const linked = heroSpeaker ? null : (npcForSpeaker(m.name, m.npcKey, m.npcUnlinked) || null);
    const title = heroSpeaker ? "Open your Hero panel" : `Open ${esc((linked && linked.name) || m.name)}'s profile`;
    const w = document.createElement("div");
    w.className = "msg thought";
    w.innerHTML = `<div class="thought-ico">💭</div>
      <div class="thought-bubble"><div class="name npc-name" title="${title}">${esc(m.name)}${!heroSpeaker ? npcLinkIconHtml(m) : ""} <span class="dim">(inner)</span></div><div class="text">${renderText(m.text)}</div></div>`;
    w.querySelector(".npc-name").onclick = (e) => openSpeakerFromChat(m, e.currentTarget);
    const linkBtn = w.querySelector(".npc-link");
    if (linkBtn) linkBtn.onclick = (e) => { e.stopPropagation(); openNpcLinkMenu(linkBtn, m); };
    return w;
  }
  if (m.role === "check") {
    const w = document.createElement("div");
    w.className = "msg check";
    w.innerHTML = checkPipHtml(m.check);
    return w;
  }
  // narration: not a bubble — plain prose, distinct color
  const w = document.createElement("div");
  w.className = "narration";
  w.innerHTML = renderText(m.text);
  return w;
}

// Count the anchored player turns (actions + directs) among messages[0 .. endExclusive) — the
// same 1-based "turn" numbering the roll-up tags memories with (GM-only continuation messages
// fold into the turn they extend, so this is groupTurns' notion of a turn).
function anchoredUpTo(msgs, endExclusive) {
  let n = 0;
  const lim = Math.max(0, Math.min(endExclusive, msgs.length));
  for (let i = 0; i < lim; i++) {
    const m = msgs[i];
    if (m && (m.role === "action" || m.role === "direct")) n++;
  }
  return n;
}

// Snapshot what a memory rewind needs to know BEFORE the transcript's past is rewritten (a region
// starting at `regionStart` is about to be replaced or deleted — an action edited, a GM reply
// edited/re-rolled/switched to another version, a whole turn deleted): `k` = the anchored turn
// ordinal of the first message in that region (the auto memories baked from that turn onward may
// now contradict the transcript and must be dropped + re-baked), and `baked` = how many anchored
// turns the roll-up cursor had already baked. Call memory.rewindFromTurn(state, k, baked) right
// AFTER the mutation (it re-derives the cursor position from the mutated transcript itself).
function rewindMemoryForRegion(regionStart) {
  const msgs = state.messages;
  const a = Math.max(0, Math.min(regionStart, msgs.length));
  const m = msgs[a];
  const anchoredHere = !!m && (m.role === "action" || m.role === "direct");
  const k = anchoredUpTo(msgs, a) + (anchoredHere ? 1 : 0);
  const baked = anchoredUpTo(msgs, Math.max(0, Math.min(state.lastAutoMemoryAt || 0, msgs.length)));
  return { k, baked };
}

// Snap the roll-up cursor back into range after the transcript shrank in ways that don't change
// the story (image rows deleted) — a cursor past the end used to stall roll-ups forever.
function clampMemoryCursor() {
  if (state.lastAutoMemoryAt > state.messages.length) state.lastAutoMemoryAt = state.messages.length;
}

function editEl(turn, idx, which) {
  const mode = (editing && editing.mode) || "lines";
  const w = document.createElement("div");
  w.className = "editor";
  const paneL = document.createElement("div");
  paneL.className = "ed-pane";
  const paneF = document.createElement("div");
  paneF.className = "ed-pane";
  const editbar = document.createElement("div");
  editbar.className = "editbar split";
  editbar.innerHTML = `<label class="ed-switch"><input type="checkbox" id="edMode"><span class="ed-track"><span class="ed-knob"></span></span><span class="ed-switch-label">Full Editor</span></label><span class="ed-tabwrap" role="tablist" aria-label="Edit sections"><button type="button" data-edtab="gm" class="mini ed-tab on" aria-selected="true" title="Narrative" aria-label="Narrative">${ICON_ED_NARRATIVE}</button><button type="button" data-edtab="trk" class="mini ed-tab" aria-selected="false"${trackerDefs.length ? "" : " hidden"} title="Trackers" aria-label="Trackers">${ICON_ED_TRACKERS}</button><button type="button" data-edtab="npc" class="mini ed-tab" aria-selected="false"${npcTrackerDefs.length ? "" : " hidden"} title="NPC trackers" aria-label="NPC trackers">${ICON_ED_NPC}</button></span><span><button id="edCancel" class="mini">✕</button> <button id="edSave" class="mini ok">Save</button></span>`;
  let fullTa, linesBox, heroBox, npcBox;
  const joinActionLines = () => [...linesBox.querySelectorAll(".ed-action-line")].map((t) => t.value).join("\n");
  const addActionLine = (v) => {
    const line = document.createElement("div");
    line.className = "ed-act-line";
    line.innerHTML = `<textarea class="ed-plain ed-line-ta ed-action-line" rows="1">${esc(v)}</textarea>`;
    edBindGrow(line.querySelector("textarea"));
    linesBox.appendChild(line);
  };
  const rebuildActionLines = (txt) => {
    linesBox.innerHTML = "";
    (String(txt).split("\n").length ? String(txt).split("\n") : [""]).forEach(addActionLine);
  };
  // Assigned in the GM branch below (the action editor has no tabs); flipTo only calls it
  // for GM replies, mirroring how the old builder touched GM-only textareas.
  let rebuildGmLines;
  // Scroll offsets snap to whole pixels: a raw fractional pin always loses its fraction
  // (the bar then sits up to 1px low after every flip). Round the target so the residual
  // is at most half a pixel either way.
  const edPinScroll = (t, delta) => { t.scrollTop = Math.round(t.scrollTop + delta); };
  // Keep the row the user just touched (tabs row / full-editor switch) on screen after a
  // pane switch: the delta pin preserves position, but async layout drift between
  // interactions or scroll clamping can strand the editor off-screen — then the newly
  // shown pane reads as "gone". The row was just clicked, so it was visible: if it still
  // isn't after the pin, bring it back.
  const edKeepRowVisible = (rowEl, yWant) => {
    const t = $("transcriptEl");
    if (!rowEl || !t) return;
    // Compare in the transcript's on-screen frame (not raw viewport: the transcript box
    // itself may start below the site header). A mismatched frame misfires the heal and
    // yanks the view on every switch.
    const tr = t.getBoundingClientRect();
    const y1 = rowEl.getBoundingClientRect().top;
    if (y1 < tr.top || y1 > tr.bottom - 60) edPinScroll(t, y1 - Math.min(Math.max(yWant, tr.top + 8), tr.bottom - 60));
  };
  // GM-reply section icons (Narrative / Trackers / NPC) live in the editbar between the
  // Full Editor switch and Save/✕. Flipping modes must not re-flow that bar: removing the
  // middle flex item collapses it (wrap vs no-wrap, space-between), so on narrow screens
  // the toggle sits on row 1 in lines mode and row 2 in full mode while Save jumps the
  // other way — the "toggle shift" (live has no icons, so its bar never re-flows).
  // visibility:hidden keeps the exact geometry (same wrap, same slots) while hiding the
  // icons; unlike display:none it cannot move the switch or the buttons at any width.
  const edShowTabs = (show) => {
    const tw = editbar.querySelector(".ed-tabwrap");
    if (!tw) return;
    tw.style.visibility = show ? "" : "hidden";
    if (show) tw.removeAttribute("aria-hidden");
    else tw.setAttribute("aria-hidden", "true");
  };
  if (which === "action") {
    editbar.querySelector(".ed-tabwrap").hidden = true; // section icons are GM-reply only
    const sys = systemActionDef(turn.action);
    const edLabel = sys ? sys.editLabel : "Edit your action";
    const init = (editing.pending != null ? editing.pending : turn.action.text);
    if (sys) {
      paneL.innerHTML = `<label class="ed-label">${edLabel}</label><div class="msg system"><div class="bubble system"><div class="sys-side"><span class="sys-ico">${sys.icon || "⚙"}</span></div><div class="sys-main"><div class="name">${esc(sys.label || turn.action.kind || "System")}</div><div class="ed-act-lines" id="edActionLines"></div></div></div></div>`;
    } else {
      const hero = state.character || {};
      const av = hero.portrait || "src/images/portrait-placeholder.webp";
      paneL.innerHTML = `<label class="ed-label">${edLabel}</label><div class="msg action"><div class="bubble action"><div class="name">${esc(hero.name || "You")}</div><div class="ed-act-lines" id="edActionLines"></div></div><div class="avatar">${edAvatarHtml(av)}</div></div>`;
    }
    paneF.innerHTML = `<label class="ed-label">${edLabel}</label>\n      <textarea id="edActionFull" class="edit-ta ed-full-ta" rows="1">${esc(init)}</textarea>`;
    linesBox = paneL.querySelector("#edActionLines");
    fullTa = paneF.querySelector("#edActionFull");
    edBindGrow(fullTa);
    rebuildActionLines(init);
  } else {
    // Tabbed lines mode: Narrative rows, then structured tracker rows, then per-character NPC rows.
    // The section icons sit in the editbar after the Full Editor switch; Narrative is always
    // open first. Tracker tabs hide when the world defines no such trackers.
    const init = editing.pending != null ? edItemsFromFull(editing.pending) : edItemsFromTurn(turn);
    const fullInit = editing.pending != null ? editing.pending : gmOriginalFull(turn);
    paneL.innerHTML = `<label class="ed-label">Edit message line by line — click any text to edit it.</label><div class="ed-lines" id="edLines" data-edpane="gm"></div>
      <div class="ed-tabpane" id="edPaneTrk" data-edpane="trk" hidden><div id="edTrkRows"></div></div>
      <div class="ed-tabpane" id="edPaneNpc" data-edpane="npc" hidden><div id="edNpcSecs"></div>
        <div class="ed-addbar" id="edNpcAdd" hidden><select class="ed-trk-out" id="edNpcAddSel" aria-label="Add character"></select><button class="mini" id="edNpcAddBtn" type="button">+ Add character</button></div></div>`;
    paneF.innerHTML = `<label class="ed-label">Edit message with full control.</label>\n      <textarea id="edGm" class="edit-ta ed-full-ta" rows="8">${esc(fullInit)}</textarea>`;
    linesBox = paneL.querySelector("#edLines");
    heroBox = paneL.querySelector("#edTrkRows");
    npcBox = paneL.querySelector("#edNpcSecs");
    fullTa = paneF.querySelector("#edGm");
    edBindGrow(fullTa);
    for (const it of (init.items.length ? init.items : [{ kind: "narr", text: "" }])) linesBox.appendChild(edRow(it.kind, it.name || "", it.text || ""));
    // The add-character row offers every catalogued NPC not already sectioned (a new section
    // starts from their pre-turn values, so saving untouched adds nothing — sparse snapshots).
    const refreshNpcAdd = () => {
      const add = paneL.querySelector("#edNpcAdd");
      const sel = paneL.querySelector("#edNpcAddSel");
      if (!add || !sel) return;
      const have = new Set([...npcBox.querySelectorAll(":scope > .ed-npc-sec")].map((s) => s.dataset.name));
      const cands = Object.keys(state.npcs || {}).filter((n) => !have.has(n));
      if (!npcTrackerDefs.length || !cands.length) { add.hidden = true; return; }
      add.hidden = false;
      const keep = sel.value;
      sel.innerHTML = cands.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
      if (cands.includes(keep)) sel.value = keep;
    };
    const addBtn = paneL.querySelector("#edNpcAddBtn");
    if (addBtn) addBtn.onclick = () => {
      const name = paneL.querySelector("#edNpcAddSel").value;
      if (!name || !(state.npcs || {})[name]) return;
      const dup = [...npcBox.querySelectorAll(":scope > .ed-npc-sec")].some((s) => s.dataset.name === name);
      if (dup) return;
      const one = edNpcSecsData({ [name]: npcTrackersBefore(turn.start - 1, name) });
      if (!one.length) return;
      const sec = edNpcSecEl(one[0].name, one[0].rows, refreshNpcAdd);
      sec._extra = [];
      npcBox.appendChild(sec);
      refreshNpcAdd();
    };
    editbar.querySelectorAll(".ed-tabwrap [data-edtab]").forEach((b) => {
      b.onclick = () => {
        const id = b.dataset.edtab;
        const y0 = b.getBoundingClientRect().bottom;
        // Full mode hides the icons (visibility placeholder, so not clickable there);
        // this branch only matters if a pane is somehow shown while full is on.
        if (!paneF.hidden) flipTo("lines");
        w.querySelectorAll(".ed-tabwrap [data-edtab]").forEach((x) => {
          const on = x === b;
          x.classList.toggle("on", on);
          x.setAttribute("aria-selected", on ? "true" : "false");
        });
        paneL.querySelectorAll(":scope [data-edpane]").forEach((p) => { p.hidden = p.dataset.edpane !== id; });
        // Rows (re)built while hidden never got a real height (see edGrow) — grow what's visible now.
        paneL.querySelectorAll(":scope [data-edpane]:not([hidden]) textarea").forEach(edGrow);
        // Pin the clicked icon: the panes sit above it, so a switch would carry the button
        // the user just pressed hundreds of px away. Plain pin only (same as the Full
        // Editor flip) — no fallback, no heal; those over-correct and were the toggle shift.
        const t = $("transcriptEl");
        if (t) edPinScroll(t, b.getBoundingClientRect().bottom - y0);
      };
    });
    // Initial rows: from the live snapshots (max included), or by parsing the pending full
    // text when returning from full mode.
    if (editing.pending != null) {
      const hp = edParseRowLines(init.trk, trackerDefs, false);
      edFillHeroRows(heroBox, hp.rows, hp.extra);
      const np = edParseNpcBlock(init.npc);
      edFillNpcSecs(npcBox, np.secs, np.extra, refreshNpcAdd);
    } else {
      const heroSnap = (turn.parts[turn.parts.length - 1] && turn.parts[turn.parts.length - 1].afterTrackers) || currentTrackers();
      edFillHeroRows(heroBox, edHeroRowsData(heroSnap), []);
      const vals = npcTrackerEditVals(turn);
      edFillNpcSecs(npcBox, vals ? edNpcSecsData(vals) : [], [], refreshNpcAdd);
    }
    refreshNpcAdd();
    rebuildGmLines = (full) => {
      const p = edItemsFromFull(full);
      linesBox.innerHTML = "";
      for (const it of (p.items.length ? p.items : [{ kind: "narr", text: "" }])) linesBox.appendChild(edRow(it.kind, it.name || "", it.text || ""));
      const hp = edParseRowLines(p.trk, trackerDefs, false);
      edFillHeroRows(heroBox, hp.rows, hp.extra);
      const np = edParseNpcBlock(p.npc);
      edFillNpcSecs(npcBox, np.secs, np.extra, refreshNpcAdd);
      refreshNpcAdd();
    };
  }
  const flipTo = (m) => {
    const sw = w.querySelector(".ed-switch");
    const y0 = sw.getBoundingClientRect().bottom;
    const yTop = sw.getBoundingClientRect().top;
    if (which === "action") {
      if (m === "full") fullTa.value = joinActionLines();
      else rebuildActionLines(fullTa.value);
    } else {
      if (m === "full") fullTa.value = edBuildGmFull(w);
      else rebuildGmLines(fullTa.value);
    }
    const full = m === "full";
    paneL.hidden = full;
    paneF.hidden = !full;
    w.classList.toggle("ed-lines-mode", !full);
    w.querySelector("#edMode").checked = full;
    try { localStorage.setItem("mno.editMode", m); } catch (_) {}
    if (editing) { editing.mode = m; editing.pending = fullTa.value; }
    w.querySelectorAll(".ed-pane:not([hidden]) textarea").forEach(edGrow);
    if (which !== "action") edShowTabs(!full); // icons hide in full mode but keep their slot (no bar re-flow)
    const t = $("transcriptEl");
    if (t) {
      edPinScroll(t, sw.getBoundingClientRect().bottom - y0);
      if (Math.abs(sw.getBoundingClientRect().bottom - y0) > 2) {
        // The pin clamped (the new pane is much shorter — content shrank under us): land the
        // newly shown pane at the top instead of leaving the editor stranded off-screen.
        const shown = full ? paneF : paneL;
        edPinScroll(t, shown.getBoundingClientRect().top - 8);
        edKeepRowVisible(sw, yTop);
      }
      // No heal when the pin held: the switch was just clicked, so it was on screen, and
      // the pin puts it back on the same pixel. Healing anyway misfires at the transcript's
      // bottom edge (the switch legitimately sits within 60px of it on the latest reply)
      // and drags the whole view ~25px on every flip — the "toggle shift".
    }
  };
  w.append(paneL, paneF, editbar);
  const full = mode === "full";
  paneL.hidden = full;
  paneF.hidden = !full;
  if (!full) w.classList.add("ed-lines-mode");
  w.querySelector("#edMode").checked = full;
  if (which !== "action") edShowTabs(!full); // opening straight into full mode keeps the icon slot reserved
  w.querySelector("#edMode").onchange = (e) => flipTo(e.target.checked ? "full" : "lines");
  w.querySelector("#edSave").onclick = () => {
    if (which === "action") saveActionText(turn, paneF.hidden ? joinActionLines() : fullTa.value);
    else saveGmFull(turn, paneF.hidden ? edBuildGmFull(w) : fullTa.value);
  };
  w.querySelector("#edCancel").onclick = () => { editing = null; render(); };
  w.addEventListener("focusin", (e) => {
    const f = e.target && e.target.closest ? e.target.closest(".ed-line-ta, .ed-name, .ed-block-ta, .ed-trk-out") : null;
    if (f && w.contains(f)) f.classList.add("ed-focus");
  });
  w.addEventListener("focusout", (e) => {
    const f = e.target && e.target.closest ? e.target.closest(".ed-line-ta, .ed-name, .ed-block-ta, .ed-trk-out") : null;
    if (f && w.contains(f)) f.classList.remove("ed-focus");
  });
  const growAll = () => { if (w.isConnected) w.querySelectorAll("textarea.ed-line-ta, textarea.ed-block-ta, textarea.ed-full-ta").forEach(edGrow); };
  requestAnimationFrame(growAll);
  setTimeout(growAll, 120);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => growAll());
  return w;
}


// Deleting a turn / reply is destructive and previously one stray tap away (especially on phones,
// where the action bar is easy to hit) — the chat ✖ buttons route through the shared confirm dialog.
async function deleteTurnWithConfirm(turn) {
  const isAdvance = turn.action && turn.action.role === "direct" && turn.action.kind === "advance";
  const ok = await ConfirmPopup.open({
    title: isAdvance ? "Delete scene break" : "Delete turn",
    message: isAdvance
      ? "Delete this scene break and the narrator's reply? This cannot be undone."
      : "Delete this action and the narrator's reply? This cannot be undone.",
    confirmText: "Delete",
    danger: true,
  });
  if (ok) deleteTurn(turn);
}

async function deleteGmReplyWithConfirm(turn) {
  const ok = await ConfirmPopup.open({
    title: "Delete reply",
    message: "Delete the narrator's reply? This cannot be undone.",
    confirmText: "Delete",
    danger: true,
  });
  if (ok) deleteGmReply(turn);
}

function deleteTurn(turn) {
  const rw = rewindMemoryForRegion(turn.start);
  state.messages.splice(turn.start, turn.end - turn.start + 1);
  if (!turn.image && turn.action && (turn.action.role === "action" || turn.action.role === "direct")) {
    state.turn = Math.max(0, (state.turn || 0) - 1);
    if ((state.lastAutoMemoryTurn || 0) > state.turn) state.lastAutoMemoryTurn = state.turn;
  }
  // The whole turn is gone — auto memories baked from it onward describe events that no longer
  // happened; drop them so the next roll-up re-bakes from the surviving transcript.
  memory.rewindFromTurn(state, rw.k, rw.baked);
  editing = null;
  // Deleting rewrites history: recompute sightings from what is shown so removed speakers stop
  // counting as recently seen (their dossiers must not be fed).
  reconcileNpcsAfterRewrite();
  render();
  refreshHeroPos();
  maybeRefreshMap();
  store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
}

function deleteGmReply(turn) {
  const start = turn.action ? turn.start + 1 : turn.start;
  if (start <= turn.end) {
    const rw = rewindMemoryForRegion(start);
    state.messages.splice(start, turn.end - start + 1);
    // The reply and its whole re-roll archive are gone — drop the turn's stored versions so a
    // later regenerate can't resurrect stale re-rolls (the action itself is kept, so re-rolling
    // this turn writes a fresh reply back into it as version 1/1).
    if (turn.action) {
      delete turn.action.rerolls;
      turn.action.rerollIndex = 0;
    } else {
      normalizeOpeningRerolls();
      delete state.openingRerolls[turn.start];
      state.openingRerollIndex = 0;
    }
    // This turn's world-reply content is gone — re-bake its memories (and anything later) from
    // the surviving transcript on the next roll-up.
    memory.rewindFromTurn(state, rw.k, rw.baked);
    editing = null;
    // Deleting rewrites history: recompute sightings from what is shown so removed speakers stop
    // counting as recently seen.
    reconcileNpcsAfterRewrite();
    render();
    refreshHeroPos();
    maybeRefreshMap();
    store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
  }
}

async function rerollTurn(turn, btn) {
  if (generating) return;
  // Pin the action's bottom edge (it survives the reply wipe) so the click point stays put.
  if (btn) requestRerollScrollPin(btn, turn.action ? "action" : "ctrl");
  const anchor = turn.action;
  let insertIndex;
  if (anchor) {
    // Materialise the archive on the first re-roll: it must hold every version, the pre-re-roll
    // reply included (that copy is what ◀/▶ restores). `cur` is forced to 0 when no archive exists,
    // so a stale index can never seed a sparse array.
    const had = !!(anchor.rerolls && anchor.rerolls.length);
    const cur = had ? (anchor.rerollIndex || 0) : 0;
    anchor.rerolls = had ? anchor.rerolls.slice(0, cur + 1) : [];
    anchor.rerolls[cur] = turn.parts;
    anchor.rerollIndex = anchor.rerolls.length - 1;
    const rw = rewindMemoryForRegion(turn.start + 1);
    state.messages.splice(turn.start + 1, turn.end - turn.start);
    // The old reply is replaced by a fresh one — its baked memories (and anything later) are
    // suspect until the new text is in; re-bake happens on the next roll-up cadence.
    memory.rewindFromTurn(state, rw.k, rw.baked);
    insertIndex = turn.start + 1;
  } else {
    normalizeOpeningRerolls();
    const prev = state.openingRerolls[turn.start];
    const had = !!(prev && prev.length);
    const cur = had ? (state.openingRerollIndex || 0) : 0;
    const list = had ? prev.slice(0, cur + 1) : [];
    list[cur] = turn.parts;
    state.openingRerolls[turn.start] = list;
    state.openingRerollIndex = list.length - 1;
    const rw = rewindMemoryForRegion(turn.start);
    state.messages.splice(turn.start, turn.end - turn.start + 1);
    memory.rewindFromTurn(state, rw.k, rw.baked);
    insertIndex = turn.start;
  }
  render();
  const history = state.messages.slice(0, insertIndex);
  const reply = await runGmTurn({
    history,
    actionText: anchor ? anchor.text : null,
    opening: !anchor,
    insertIndex,
    kind: anchor ? (anchor.kind || (anchor.role === "direct" ? "direct" : "action")) : "action"
  });
  if (anchor) { anchor.rerolls.push(reply); anchor.rerollIndex = anchor.rerolls.length - 1; }
  else {
    normalizeOpeningRerolls();
    state.openingRerolls[turn.start].push(reply);
    state.openingRerollIndex = state.openingRerolls[turn.start].length - 1;
  }
  // The new reply replaced an archived version: NPCs unique to the archived version must stop
  // counting as recently seen. Recompute from the shown transcript (the incremental noteNpcs
  // inside runGmTurn already handled the new reply's own speakers correctly).
  reconcileNpcsAfterRewrite();
  render();
  try { await store.save(state); }
  catch (e) {
    if (isStorageError(e) || (e && e.isStorageUnavailable)) notifyStorageError(notify, "saving", e);
    else throw e;
  }
}

function normalizeOpeningRerolls() {
  if (!state.openingRerolls) state.openingRerolls = {};
  else if (Array.isArray(state.openingRerolls)) {
    // legacy format: openingRerolls = [replyMessages] — migrate to { turnStart: [version, ...] }
    const first = state.openingRerolls[0];
    state.openingRerolls = { 0: first ? [first] : [] };
  }
}

function openingVersions(start) {
  normalizeOpeningRerolls();
  return state.openingRerolls[start] || [];
}

function navReroll(turn, dir, btn) {
  const anchor = turn.action;
  const list = anchor ? (anchor.rerolls || []) : openingVersions(turn.start);
  if (list.length < 2) return;
  const cur = anchor ? (anchor.rerollIndex || 0) : (state.openingRerollIndex || 0);
  const idx = cur + dir;
  if (idx < 0 || idx >= list.length) return;
  // Pin the version-nav row itself (it survives the rebuild) — same as the edit toggle.
  if (btn) requestRerollScrollPin(btn, "ctrl");
  const version = list[idx];
  const rw = rewindMemoryForRegion(anchor ? turn.start + 1 : turn.start);
  if (anchor) {
    anchor.rerollIndex = idx;
    state.messages.splice(turn.start + 1, turn.end - turn.start, ...version);
  } else {
    state.openingRerollIndex = idx;
    state.messages.splice(turn.start, turn.end - turn.start + 1, ...version);
  }
  // Switching to another archived version rewrites this turn's content — drop its baked
  // memories (and anything later) so the next roll-up re-bakes from the version now shown.
  memory.rewindFromTurn(state, rw.k, rw.baked);
  // Switching versions rewrites this turn: recompute sightings from the version now shown so
  // NPCs unique to the hidden version stop counting as recently seen (and their dossiers stop
  // being fed). Uses anchored ordinals, never state.turn, so switching an old turn never stamps
  // its speakers with the latest turn.
  reconcileNpcsAfterRewrite();
  render();
  refreshHeroPos();
  maybeRefreshMap();
  store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
}

/* ---------- events ---------- */
function bindEvents() {
  applyComposerTipPref();
  const tipHide = $("composerTipHide");
  if (tipHide) tipHide.addEventListener("click", () => {
    persistComposerTipHidden(true);
    applyComposerTipPref();
  });
  $("sendBtn").addEventListener("click", onSendBtn);
  // A mouse press on send would move focus to the button; keep it in the input instead
  // (the click still fires — preventing mousedown default only skips the focus change).
  $("sendBtn").addEventListener("mousedown", (e) => { e.preventDefault(); });
  $("sceneBtn").addEventListener("click", () => {
    // The 🎨 shortcut obeys the panel's Instant button toggle: instant generation, or this panel.
    if (scenePrefs().instant !== false) quickSceneImage();
    else runSceneCommand();
  });
  $("inputEl").placeholder = INPUT_PLACEHOLDER;
  $("inputEl").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !IS_MOBILE) { e.preventDefault(); send(); }
  });
  autoGrowInput();
  $("inputEl").addEventListener("input", autoGrowInput);
  window.addEventListener("resize", autoGrowInput);
  // Mobile browsers can leave the chat visually frozen after the on-screen keyboard or the
  // browser chrome changes the viewport: the layout viewport resizes (or pans) out from under
  // the fixed-height chat, so the transcript won't scroll and fixed layers (like the rail
  // scrim) sit misplaced — while taps still work. Switching apps resyncs the viewports, which
  // is why that clears it; do the same work here without leaving the page.
  if (window.visualViewport) {
    let vvT = 0;
    window.visualViewport.addEventListener("resize", () => {
      clearTimeout(vvT);
      vvT = setTimeout(() => { autoGrowInput(); updateScrollBottomBtn(); }, 120);
    });
  }
  $("inputEl").addEventListener("blur", () => {
    // iOS sometimes leaves the page panned after keyboard dismissal with a stuck scroll
    // container — resetting the window offset resyncs it (same effect as switching tabs).
    try { window.scrollTo(0, 0); } catch (_) {}
    requestAnimationFrame(() => { autoGrowInput(); updateScrollBottomBtn(); });
  });

  // transcript lazy-loading + the floating "jump to latest" button
  $("transcriptEl").addEventListener("scroll", onTranscriptScroll, { passive: true });
  const sbBtn = $("scrollBottomBtn");
  if (sbBtn) sbBtn.addEventListener("click", scrollTranscriptToBottom);

  // Per-message controls (✎/⟳/✖/◀▶) are hidden with opacity:0 + pointer-events:none until the turn
  // is hovered — on touch, a tap reveals them. pointer-events:none blocks a plain tap, but a touch
  // browser resolves the CLICK target after the tap has applied :hover (i.e. after the row became
  // pointer-events:auto), so the very tap that reveals a turn's buttons can still press one of them.
  // So only honour a control click when that gesture's pointerdown actually landed on that button:
  // the revealing tap can never press a control, while a deliberate tap on a visible one works.
  // The gesture is keyed STABLY (turn position + control row + button index), not by element
  // identity: a background render (an NPC portrait or the map finishing) can rebuild the transcript
  // between pointerdown and click, and the rebuilt button is a different element for the same
  // logical control — identity comparison would eat that tap (the button flashes, nothing fires)
  // while the key still matches. Keep the two (this guard and the CSS above) together when
  // changing either.
  let pressKey = null; // stable key of the control button the current gesture went down on
  const ctrlKeyFrom = (t) => {
    const btn = (t && t.closest) ? t.closest(".action-ctrl button, .turn-ctrl button") : null;
    if (!btn) return null;
    const scope = $("transcriptEl");
    const turns = scope ? scope.querySelectorAll(":scope > .turn") : [];
    const ti = btn.closest(".turn") ? Array.prototype.indexOf.call(turns, btn.closest(".turn")) : -1;
    const row = btn.closest(".action-ctrl, .turn-ctrl");
    const bi = row ? Array.prototype.indexOf.call(row.querySelectorAll("button"), btn) : -1;
    if (ti < 0 || bi < 0 || !row) return null;
    return ti + ":" + (row.classList.contains("action-ctrl") ? "a" : "g") + ":" + bi;
  };
  $("transcriptEl").addEventListener(window.PointerEvent ? "pointerdown" : "touchstart", (e) => {
    pressKey = ctrlKeyFrom(e.target);
  }, true);
  // A cancelled gesture (the browser took over for a scroll) owns no click — never honour one.
  if (window.PointerEvent) $("transcriptEl").addEventListener("pointercancel", () => { pressKey = null; }, true);
  $("transcriptEl").addEventListener("click", (e) => {
    if (e.detail === 0) return; // keyboard/programmatic activation — no gesture to verify
    const key = ctrlKeyFrom(e.target);
    if (key && key !== pressKey) { e.stopPropagation(); e.preventDefault(); }
  }, true);

  // The topbar brand leads back to the landing, and it must answer on the LOGO too — the logo is the
  // part people aim at, and an `<img>` is draggable by default, so a click that slips a pixel becomes a
  // native image drag and the click never reaches the span at all. `draggable="false"` on the logo (both
  // here and in the markup main.js re-emits, see `init()`) is what keeps the whole brand one target.
  $("brand").addEventListener("click", goToLanding);
  $("homeBtn").addEventListener("click", goToLanding);
  // The floating Tavern button (draggable, over every page) opens the panel — mount
  // (ensure on body + wire once).
  try {
    mountTavernFab();
    scheduleDiscussionPrewarm();
    scheduleBanWarmup();
  } catch (e) {}
  $("sessionTitleEl").addEventListener("click", () => renameSession(state.id));
  $("sessionTitleEl").title = "Click to rename adventure";

  // collapsible side rails — clicking a tab opens its section (or collapses the rail if the
  // section is already open); the rail-toggle (☰ / ✕) expands/collapses the whole rail.
  document.querySelectorAll(".rail-tab").forEach((b) => {
    b.addEventListener("click", () => {
      const side = b.dataset.side, sec = b.dataset.sec;
      if (railSec(side) === sec && isRailOpen(side)) { collapseRail(side); persistRailState(); }
      else openRailSection(side, sec);
    });
  });
  $("leftRailToggle").addEventListener("click", () => toggleRail("left"));
  $("rightRailToggle").addEventListener("click", () => toggleRail("right"));
  $("openLeftBtn").addEventListener("click", () => toggleRail("left"));
  $("openRightBtn").addEventListener("click", () => toggleRail("right"));
  initCtxMeter({
    getSnapshot: () => {
      try { if (communityMod) ctxAdminAuthed = !!communityMod.api.isAdmin(); } catch (e) {}
      // Turn count matches the visible "N turns" counter (player actions + directives).
      let turn = 0;
      try { turn = state && state.messages ? state.messages.filter((m) => m.role === "action" || m.role === "direct").length : 0; } catch (e) {}
      return { admin: ctxAdminAuthed, ctxDebug: ctxDebugEnabled(), adventureId: state && state.id, turn, instruction: engine && engine.lastInstruction, trackerInstruction: engine && engine.lastTrackerInstruction, npcTrackerInstruction: engine && engine.lastNpcTrackerInstruction, checkInstruction: engine && engine.lastCheckInstruction, lifeCall: npcLife && npcLife.lastLifeCall || null, rollupCalls: memory && memory.lastRollUpCalls || null, appHidden: $("app").hidden };
    },
    notify, esc
  });
  $("railScrim").addEventListener("click", () => { collapseRails(); persistRailState(); });
  window.addEventListener("resize", applyRailPref);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const lb = document.getElementById("lightbox");
    if (lb && lb.classList.contains("open")) return; // the lightbox owns Escape
    if (isRailOpen("left") || isRailOpen("right")) { collapseRails(); persistRailState(); }
  });

  // mobile: the small button at the bottom of the tracker bar expands/collapses it
  const tgl = $("trackerToggleBtn");
  if (tgl) tgl.addEventListener("click", () => {
    trackerOpen = !trackerOpen;
    $("trackerbar").classList.toggle("open", trackerOpen);
    $("trackerbar").setAttribute("aria-expanded", String(trackerOpen));
    renderTrackerBar();
  });
  // mobile: fade + chevron cues on the collapsed chip strip's scrollable edges (same
  // pattern as the world editor's tab bar) — the strip's own scroll repaints them
  const trkChips = $("trackerbarChips");
  if (trkChips) trkChips.addEventListener("scroll", paintTrackerNav, { passive: true });
  const trkPrev = $("trackerNavPrev"), trkNext = $("trackerNavNext");
  if (trkPrev) trkPrev.onclick = () => stepTrackerNav(-1);
  if (trkNext) trkNext.onclick = () => stepTrackerNav(1);
  if (window.ResizeObserver && trkChips) {
    // rAF-coalesced (same reason as the Tavern channel strip in discussion.js): cue
    // painting writes layout, and doing it synchronously inside RO delivery trips the
    // browser's "ResizeObserver loop" guard during resize/rotation storms.
    let trkRaf = 0;
    new ResizeObserver(() => {
      if (trkRaf) return;
      trkRaf = requestAnimationFrame(() => { trkRaf = 0; paintTrackerNav(); });
    }).observe(trkChips);
  } else {
    window.addEventListener("resize", paintTrackerNav);
  }
  requestAnimationFrame(paintTrackerNav);
  setTimeout(paintTrackerNav, 300); // once fonts settle layout

  const cmdMenu = $("cmdMenu");
  COMMANDS.forEach((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cmd-item";
    b.innerHTML = `<span class="cmd-name">${c.name}</span><span class="cmd-desc">${c.desc}</span>`;
    b.addEventListener("click", () => { cmdMenu.hidden = true; c.run(); });
    cmdMenu.appendChild(b);
  });
  $("plusBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    cmdMenu.hidden = !cmdMenu.hidden;
  });
  document.addEventListener("click", (e) => {
    if (!cmdMenu.hidden && !cmdMenu.contains(e.target) && e.target !== $("plusBtn")) cmdMenu.hidden = true;
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") cmdMenu.hidden = true; });
}


function railEl(side) { return $(side === "left" ? "leftRail" : "rightRail"); }
function railBodyEl(side) { return $(side === "left" ? "leftRailBody" : "rightRailBody"); }
function railSec(side) { return side === "left" ? leftSec : rightSec; }
function setRailSec(side, sec) { if (side === "left") leftSec = sec; else rightSec = sec; }
function isRailOpen(side) { return !railEl(side).classList.contains("collapsed"); }

// The Menu panel: square quick-nav grid for the home shell. Worlds / Adventures / Explore leave
// the chat and land on that page (via goToLanding's keep bridge, which refuses while the GM is
// writing — the session entry stays behind the landing, so Back returns to the chat; a plain
// pop would restore the previous page's URL and the hash router would mount THAT over the
// requested page); Settings and Changelog just raise their popups over the chat. The session's
// own shelf — Currently Playing + Adventures in this world — lives in the Session tab next door
// (`renderSessionPanel`).
//
// Leave the chat for a landing page, keeping the session entry behind it so Back returns here
// (the keep bridge — refuses while the GM is writing, like every Menu exit).
async function exitToHomePage(id) {
  const sid = state && state.id;
  if (!(await goToLanding({ keepSession: true }))) return;
  menuReturnSession = sid && sessionBackRelease ? sid : null;
  await setHomePage(id, { force: true });
}
function renderMenuPanel(body) {
  body.innerHTML = `<div class="s-sec">Main Menu</div>
    <div class="menu-grid"></div>`;
  const grid = body.querySelector(".menu-grid");
  for (const id of ["worlds", "adventures", "explore"]) {
    const sec = homeSec(id);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "menu-cell";
    b.style.setProperty("--m-accent", `var(${sec.accent})`);
    b.innerHTML = `<span class="menu-ic">${secIconInner(sec)}</span><span class="menu-label">${esc(sec.label)}</span>`;
    b.title = `Open ${sec.label}`;
    // Kept, not popped: the session entry stays behind the landing (rewritten to the new
    // page's URL), so Back pops it and re-enters this chat. Popping would restore the
    // chat-opener page's URL and the hash router would mount THAT over this destination.
    b.onclick = () => exitToHomePage(id);
    grid.appendChild(b);
  }
  // Settings, Discussion and Changelog are popups OVER the chat — no navigation, no history change.
  const settingsSec = homeSec("settings");
  const discussionSec = homeSec("discussion");
  const popupCells = [
    { sec: discussionSec, run: () => openDiscussionPanel().catch(() => {}), title: "Open Tavern" },
    { sec: settingsSec, run: () => openSettingsPanel(), title: "Open Settings" },
  ];
  const changelogAct = HN_ACTIONS.find((a) => a.id === "ldChangelogBtn");
  if (changelogAct) popupCells.push({ sec: changelogAct, run: () => openChangelog(), title: "Open Changelog" });
  for (const cell of popupCells) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "menu-cell";
    b.dataset.cell = cell.sec.id;
    b.style.setProperty("--m-accent", `var(${cell.sec.accent || "--accent"})`);
    b.innerHTML = `<span class="menu-ic">${secIconInner(cell.sec)}</span><span class="menu-label">${esc(cell.sec.label)}</span>`;
    b.title = cell.title;
    if (cell.sec.id === "discussion") {
      const pip = document.createElement("span");
      pip.className = "menu-pip";
      pip.hidden = true;
      b.appendChild(pip);
    }
    b.onclick = () => cell.run();
    grid.appendChild(b);
  }
  refreshTavernPips();
  // Fill the last row with faded placeholders so the grid reads as room to grow — a future
  // entry takes a placeholder's slot.
  const MENU_COLS = 3;
  const fill = (MENU_COLS - (grid.children.length % MENU_COLS)) % MENU_COLS;
  for (let i = 0; i < fill; i++) {
    const ph = document.createElement("div");
    ph.className = "menu-empty";
    ph.setAttribute("aria-hidden", "true");
    grid.appendChild(ph);
  }
}

// The Session tab: this chat's own shelf. Currently Playing shows the bound world's
// cover/title/author plus the detail popup's own Overview / Author's notes tabs (rail-sized,
// wearing the popup's `.wd-*` classes so it reads as one thing), and Adventures in this world lists every save bound to
// it — the retired Adventures tab's rows, minus the world-hopping (the Menu grid covers that).
// Both re-resolve from the store on every open (edits land on next visit — the store is the
// source of truth, nothing cached), and the session token guards a slow load against leaving.
function renderSessionPanel(body) {
  // Overlapping renders share one body element: switching adventures fires
  // applyRailPref's syncRail AND the row's onLoad (plus rename/dupe fire
  // refreshRailIfOpen AND onChange), so two async fills can be in flight with
  // the SAME sessId. The sessId guard can't tell them apart — the stale one
  // would then append a second `.adv-other` button. The generation counter
  // invalidates every render but the newest.
  const myGen = (Number(body.dataset.sessGen) || 0) + 1;
  body.dataset.sessGen = String(myGen);
  body.innerHTML = `<div class="s-sec">Currently Playing</div>
    <div class="cp-wrap"><div class="cp-loading"><span class="spin spin-sm"></span></div></div>
    <div class="s-sec">Adventures in this world</div>
    <button class="btn adv-new" type="button" title="Start a new adventure in this world">✦ New adventure</button>
    <div class="memlist adv-world-list"><div class="dim"><span class="spin spin-sm"></span></div></div>`;
  const wrap = body.querySelector(".cp-wrap");
  const advWrap = body.querySelector(".adv-world-list");
  const sessId = state && state.id;
  const wid = state && state.worldId;
  body.querySelector(".adv-new").onclick = async () => {
    const world = await loadWorldById(state && state.worldId);
    beginNewAdventure(world);
  };
  loadWorldById(wid).then(async (world) => {
    if (!state || state.id !== sessId || !body.isConnected) return;
    if (body.dataset.sessGen !== String(myGen) || !wrap.isConnected) return;
    // Added worlds read the cached file, whose cover goes stale on a listing-only publish
    // (new cover, no content/version change) — the detail panel overlays the library's fresh
    // listing snapshot for exactly this reason. Do the same here so the rail never disagrees.
    if (world && wid && wid.startsWith(LIB_WORLD_PREFIX)) {
      try {
        const libRec = ((await communityKv("library")) || {})[wid.slice(LIB_WORLD_PREFIX.length)];
        if (libRec && libRec.worldId) overlayLibraryListing(world, libRec, libRec.worldId);
      } catch (e) {}
    }
    paintCurrentWorld(wrap, world);
  }).catch(() => {
    if (!body.isConnected || body.dataset.sessGen !== String(myGen) || !wrap.isConnected) return;
    wrap.innerHTML = `<div class="cp-empty">Couldn't load this world.</div>`;
  });
  // Rows are the Adventures page's own `adventureRow` (switch / rename / export / delete);
  // switching rows re-renders this panel once the new chat is up (see `onLoad`).
  (async () => {
    let sessions = [];
    try {
      sessions = (await store.list()).sort((a, b) => b.lastUpdated - a.lastUpdated);
      await refreshWorldNameCache();
      await loadAddedWorlds(false);
      homeUserWorlds = await worldStore.list();
      rebuildInstalledIds();
    } catch (e) { /* the list just stays empty */ }
    if (!state || state.id !== sessId || !body.isConnected) return;
    if (body.dataset.sessGen !== String(myGen) || !advWrap.isConnected) return;
    advWrap.innerHTML = "";
    const mine = sessions.filter((s) => (s.worldId || "") === (wid || ""));
    if (!mine.length) {
      advWrap.innerHTML = `<div class="dim">No adventures in this world yet.</div>`;
    }
    else for (const s of mine) advWrap.appendChild(adventureRow(s, {
      current: !!(state && s.id === state.id),
      // Faces on, like the Adventures page — the rail's wrapped `.a-row` layout keeps the
      // actions on their own line under the text, so the portrait fits.
      face: true,
      onLoad: () => { if (body.isConnected) renderSessionPanel(body); },
      onChange: () => { if (body.isConnected) renderSessionPanel(body); },
      // Deleting the adventure you are in cannot leave you inside it: drop the chat, and go
      // back to the landing through the same path ⬅ Back to World Selection takes.
      onDelete: async () => {
        if (state && s.id === state.id) { cancelMapBuild(); state = null; releaseSessionBack(); collapseRail("left"); await renderLanding(await store.list()); }
        else if (body.isConnected) renderSessionPanel(body);
      },
    }));
    // The foot button rides in WITH the list — appended synchronously it flashes above the
    // spinner while the world/list loads, then jumps down when they land. Same destination as
    // the grid's Adventures button, same keep bridge back.
    const advSec = homeSec("adventures");
    const otherBtn = document.createElement("button");
    otherBtn.type = "button";
    otherBtn.className = "btn adv-other";
    otherBtn.innerHTML = `${secIconInner(advSec)}<span>Other Adventures</span>`;
    otherBtn.title = "Open all adventures";
    otherBtn.onclick = () => exitToHomePage("adventures");
    // Defensive: a stale fill that slipped past the generation guard must never
    // double the foot button — there is exactly one per panel.
    if (body.dataset.sessGen !== String(myGen) || !advWrap.isConnected) return;
    body.querySelectorAll(".adv-other").forEach((b) => b.remove());
    body.appendChild(otherBtn);
  })();
}

// Currently Playing block: cover (click to expand), title, author, then the world detail
// popup's own Overview / Author's notes tabs (`openWorldPanel`), rail-sized. Same panes, same
// order, no Comments (that belongs to the public listing, not this chat): Overview holds the
// description, Author's notes holds the notes. One pane → no tab bar, just the pane.
// Class names mirror `openWorldPanel` where sizes allow, so the shared `.wd-*` styles apply.
function paintCurrentWorld(wrap, world) {
  const meta = world.meta || {};
  const hasCover = !!meta.cover;
  const authorProfileUid = authorUid(meta.authorId, meta.author);
  const cover = hasCover
    ? `<img src="${esc(meta.cover)}" alt="">`
    : `<div class="cp-cover-ph" aria-hidden="true">${esc(String(meta.name || "?").charAt(0).toUpperCase())}</div>`;
  // Author's notes: draft text renders inline; a published pointer lazy-loads once, then caches (notes.js).
  const notesVal = String(meta.authorNotes == null ? "" : meta.authorNotes).trim();
  const hasNotes = !!notesVal;
  const notesIsPtr = hasNotes && isNotesPointer(notesVal);
  const descHtml = meta.description ? richTextWithMentions(meta.description) : "";
  const hasOverview = !!descHtml;
  const tabDefs = [
    hasOverview ? { id: "desc", label: "Overview", icon: ICON_OVERVIEW } : null,
    hasNotes ? { id: "notes", label: "Author's notes", icon: ICON_NOTE_DOC } : null,
  ].filter(Boolean);
  const defaultTab = hasOverview ? "desc" : "notes";
  const tabsHtml = tabDefs.length > 1
    ? `<div class="wd-tabs" role="tablist" data-cptabs>${tabDefs.map((t) => `<button class="wd-tab" role="tab" data-wtab="${t.id}" aria-selected="${defaultTab === t.id ? "true" : "false"}" type="button">${t.icon || ""}${esc(t.label)}</button>`).join("")}</div>`
    : "";
  const overviewHtml = hasOverview
    ? `<div class="wd-tabpane" role="tabpanel" data-pane="desc"${defaultTab !== "desc" ? " hidden" : ""}><div class="cp-desc wd-desc clamped"><span data-desc-tx>${descHtml}</span></div>
    <button class="mini cp-more" type="button" hidden>Show more</button></div>`
    : "";
  const notesHtml = hasNotes
    ? `<div class="wd-tabpane wd-desc" role="tabpanel" data-pane="notes"${defaultTab !== "notes" ? " hidden" : ""}>${notesIsPtr ? `<span class="wd-notes-loading">Loading author&rsquo;s notes…</span>` : richTextWithMentions(notesVal)}</div>`
    : "";
  wrap.innerHTML = `
    <div class="cp-cover">${cover}${hasCover ? `<button class="cp-expand" type="button" aria-label="Expand cover">${WD_FS_EXPAND_IC}</button>` : ""}</div>
    <div class="cp-name">${esc(meta.name || "Untitled world")}</div>
    ${meta.author ? `<div class="wd-author">by ${authorProfileUid ? `<button class="wd-author-profile" data-uid="${esc(authorProfileUid)}" title="Open this author's profile">@${esc(meta.author)}</button>` : `<b>@${esc(meta.author)}</b>`}</div>` : ""}
    ${(hasOverview || hasNotes) ? `${tabsHtml}${overviewHtml}${notesHtml}` : ""}`;
  const coverEl = wrap.querySelector(".cp-cover");
  const expandBtn = wrap.querySelector(".cp-expand");
  // Animated expand/collapse on explicit px heights (the detail popup's `.wd-hdr` curve): the
  // open target is measured from the image's own ratio (capped), and the shut height is fixed —
  // `auto` can't interpolate, so both ends are px and the image (`height: 100%` in both states)
  // rides the container instead of jumping to a new crop first.
  const COVER_SHUT_H = 120, COVER_OPEN_MAX = 420;
  const fullCoverH = () => {
    const img = coverEl.querySelector("img");
    if (img && img.naturalWidth) {
      return Math.min(COVER_OPEN_MAX, Math.round(coverEl.clientWidth * img.naturalHeight / img.naturalWidth));
    }
    return COVER_OPEN_MAX;
  };
  const toggleCover = () => {
    const willOpen = !wrap.classList.contains("cp-open");
    const from = Math.round(coverEl.getBoundingClientRect().height);
    const to = willOpen ? fullCoverH() : COVER_SHUT_H;
    if (from === to) { wrap.classList.toggle("cp-open", willOpen); return; }
    wrap.classList.toggle("cp-open", willOpen);
    coverEl.style.height = from + "px";
    void coverEl.offsetHeight; // reflow so the height change animates instead of jumping
    coverEl.style.height = to + "px";
    if (expandBtn) {
      expandBtn.innerHTML = willOpen ? WD_FS_COMPRESS_IC : WD_FS_EXPAND_IC;
      expandBtn.setAttribute("aria-label", willOpen ? "Shrink cover" : "Expand cover");
    }
  };
  if (expandBtn) {
    // The button's own click stops propagating: without that it would toggle here AND again on
    // the cover it sits in, landing back on the state it started in.
    expandBtn.onclick = (e) => { e.stopPropagation(); toggleCover(); };
    coverEl.addEventListener("click", toggleCover);
  } else {
    coverEl.style.cursor = "default";
  }
  const authorBtn = wrap.querySelector(".wd-author-profile");
  if (authorBtn) {
    // Same destination as the detail popup's author button — goUser routes via the landing
    // (so a mid-write GM refuses first like every other Menu exit) and remembers this chat
    // as a session return: Back from the profile re-enters it (see userBackClose).
    authorBtn.onclick = () => { goUser(authorProfileUid, meta.author); };
  }
  const desc = wrap.querySelector(".cp-desc");
  const more = wrap.querySelector(".cp-more");
  const notesPane = wrap.querySelector('[data-pane="notes"]');
  // Show more only measures the Overview text: it appears only when the clamped text actually
  // overflows. Hidden panes measure 0, so re-measure after every tab switch and async fill.
  const updateMore = () => {
    if (!desc || !more || !wrap.isConnected) return;
    if (desc.closest("[data-pane]") && desc.closest("[data-pane]").hidden) return;
    more.hidden = !(desc.scrollHeight > desc.clientHeight + 1);
  };
  if (desc && more) {
    // Measure now AND after the rail's open transition. Width sets the line count, and a panel
    // re-rendered with the rail already open measures correctly on the spot — waiting the full
    // transition every time is what kept Show more arriving late.
    updateMore();
    setTimeout(updateMore, 350);
    more.onclick = () => {
      const clamped = desc.classList.toggle("clamped");
      more.textContent = clamped ? "Show more" : "Show less";
    };
    // Starts clamped (collapsed), so the first press expands it.
    more.textContent = "Show more";
  }
  // Tabs swap panes in place, like the detail panels — selecting a tab never scrolls.
  const selectCpTab = (id) => {
    if (id !== "desc" && id !== "notes") return;
    try {
      wrap.querySelectorAll("[data-wtab]").forEach((b) => b.setAttribute("aria-selected", b.dataset.wtab === id ? "true" : "false"));
      wrap.querySelectorAll("[data-pane]").forEach((p) => { p.hidden = p.dataset.pane !== id; });
      const bar = wrap.querySelector("[data-cptabs]");
      const btn = bar && bar.querySelector(`[data-wtab="${id}"]`);
      if (bar && btn) {
        const b = btn.getBoundingClientRect(), r = bar.getBoundingClientRect();
        if (b.right > r.right) bar.scrollLeft += b.right - r.right;
        else if (b.left < r.left) bar.scrollLeft -= r.left - b.left;
      }
    } catch (_) {}
    if (id === "desc") updateMore();
  };
  wrap.querySelectorAll("[data-wtab]").forEach((b) => { b.onclick = () => selectCpTab(b.dataset.wtab); });
  // @mentions in the description / notes open that user's profile like the author button above
  // (goUser routes via the landing, so a mid-write GM refuses first — Back then re-enters this chat).
  // Delegated on the block: both panes share it and neither re-render takes listeners with it.
  wrap.addEventListener("click", (e) => {
    const b = e.target.closest("[data-mention]");
    if (!b || !wrap.contains(b)) return;
    const name = String(b.dataset.mention || "").replace(/^@+/, "").trim();
    if (!name) return;
    goUser("", name);
  });
  // Author's notes pane: draft text is already inline; a pointer lazy-loads once (cached in
  // notes.js), then fills the pane.
  if (hasNotes && notesPane && notesIsPtr) {
    const loadNotes = async () => {
      try { return await enrichDescHtml(await fetchNotesText(notesIdFromValue(notesVal))); }
      catch (e) { return `<span class="wd-notes-fail">Couldn&rsquo;t load the author&rsquo;s notes.</span>`; }
    };
    loadNotes().then((h) => { if (wrap.isConnected && notesPane.isConnected) notesPane.innerHTML = h; });
  }
  // Spaced-username upgrade for the description's @mentions (see enrichDescHtml): the text
  // already shows the sync single-token rendering, and this swaps in the resolved one — then
  // re-measures, since longer links can change whether Show more overflows.
  if (meta.description && desc) {
    const box = desc.querySelector("[data-desc-tx]") || desc;
    enrichDescHtml(meta.description).then((h) => {
      if (wrap.isConnected && box.isConnected && h !== box.innerHTML) {
        box.innerHTML = h;
        updateMore();
      }
    }).catch(() => {});
  }
}

// Render one section's content into a rail's body (used by syncRail and the callbacks that
// re-render a panel after data changes, e.g. NPC backfill completing mid-stream).
function renderRailSection(side, sec) {
  releaseMemChunks(); // a lazy memory list may be holding a scroll listener on this body
  const body = railBodyEl(side);
  body.innerHTML = "";
  if (!state) return; // no session open yet — panels need session state
  if (sec === "menu") renderMenuPanel(body);
  else if (sec === "session") renderSessionPanel(body);
  else if (sec === "memory") renderMemoryPanel(body);
  else if (sec === "settings") renderSettingsPanel(body);
  else if (sec === "character") renderCharacterPanel(body);
  else if (sec === "map") renderMapPanel(body);
  else if (sec === "npc") renderNpcPanel(body);
  else if (sec === "gallery") renderGalleryBody(body);
}

function syncRail(side) {
  const sec = railSec(side);
  const rail = railEl(side);
  const t = sec ? RAIL_SECTIONS[sec] : null;
  rail.querySelector(".rail-title").innerHTML = t ? secIconInner(t) + " " + esc(t.label) : "";
  rail.querySelectorAll(".rail-tab").forEach((b) => b.classList.toggle("active", b.dataset.sec === sec));
  if (!rail.classList.contains("collapsed")) renderRailSection(side, sec);
  updateRailScrim();
}

function openRailSection(side, sec) {
  // On small screens the rails overlay the content — keep only one open at a time.
  const other = side === "left" ? "right" : "left";
  if (isNarrow() && isRailOpen(other)) collapseRail(other);
  setRailSec(side, sec);
  railEl(side).classList.remove("collapsed");
  updateRailToggle(side);
  syncRail(side);
  persistRailState();
}

function collapseRail(side) {
  railEl(side).classList.add("collapsed");
  // Free the memory panel's rendered rows (and its lazy-list scroll listener) while it's hidden: the
  // panel is rebuilt whenever the rail opens again, and a full auto list is thousands of nodes and
  // tens of thousands of pixels of content that would otherwise sit in the document costing memory,
  // style recalc and paint on a phone for nothing.
  if (railSec(side) === "memory") { releaseMemChunks(); railBodyEl(side).innerHTML = ""; }
  updateRailToggle(side);
  updateRailScrim();
}

// The rail-toggle is a burger (☰) when its rail is collapsed and an ✕ when expanded.
function updateRailToggle(side) {
  const btn = $(side === "left" ? "leftRailToggle" : "rightRailToggle");
  if (!btn) return;
  const open = isRailOpen(side);
  btn.title = `${open ? "Collapse" : "Expand"} ${side} panel`;
  btn.setAttribute("aria-expanded", String(open));
}

function collapseRails() {
  collapseRail("left");
  collapseRail("right");
}

function toggleRail(side) {
  if (isRailOpen(side)) { collapseRail(side); persistRailState(); }
  else openRailSection(side, railSec(side) || defaultSec(side));
}

function refreshRailIfOpen(side) {
  if (isRailOpen(side) && railSec(side)) syncRail(side);
  updateLvlIndicators();
}

function updateRailScrim() {
  const sc = $("railScrim");
  if (sc) sc.classList.toggle("show", isRailOpen("left") || isRailOpen("right"));
}

/* ---------- rail open/closed state + active-tab persistence ---------- */
const RAIL_PREF_KEY = "mno.railPref";

// The session rails are drawers below 901px (phones and tablets alike — there is no separate tablet
// layout): they start collapsed and open over the content.
function isNarrow() { return window.matchMedia("(max-width: 900px)").matches; }

// Rails open by default on desktop-sized screens; phones/tablets start collapsed (and on phones
// the collapsed strips are hidden entirely, so the chat gets full width).
function railDefaultOpen() { return window.matchMedia("(min-width: 1024px)").matches; }

function defaultSec(side) { return side === "left" ? "menu" : "character"; }

function validSec(side, sec) { return VALID_SECS[side].includes(sec) ? sec : defaultSec(side); }

function railPref() {
  try {
    const raw = localStorage.getItem(RAIL_PREF_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p.left === "boolean" && typeof p.right === "boolean") {
        return { left: p.left, right: p.right, leftSec: validSec("left", p.leftSec), rightSec: validSec("right", p.rightSec) };
      }
    }
  } catch (e) {}
  const open = railDefaultOpen();
  return { left: open, right: open, leftSec: defaultSec("left"), rightSec: defaultSec("right") };
}

function persistRailState() {
  if (isNarrow()) return; // mobile drawers are transient — never persist their state
  try {
    localStorage.setItem(RAIL_PREF_KEY, JSON.stringify({
      left: isRailOpen("left"), right: isRailOpen("right"),
      leftSec: railSec("left") || defaultSec("left"),
      rightSec: railSec("right") || defaultSec("right"),
    }));
  } catch (e) {}
}

// Apply the saved (or default) open/closed state and active tab — on boot, when entering a
// session, and when the window crosses the mobile breakpoint.
function applyRailPref() {
  if (isNarrow()) { collapseRails(); return; }
  const p = railPref();
  ["left", "right"].forEach((side) => {
    const open = p[side];
    railEl(side).classList.toggle("collapsed", !open);
    if (open) setRailSec(side, p[side + "Sec"]);
    updateRailToggle(side);
  });
  updateRailScrim();
  syncRail("left");
  syncRail("right");
}

/* ---------- memory panel ---------- */
// Compact info line under a memory's text: who knows it, which turn it happened on, and the
// trigger words that recall it. Hero-owned entries read as "you" for the player.
function memMetaLine(m) {
  const heroName = state.character && state.character.name;
  const bits = [];
  const who = ownerLabel(m.owner, heroName).split(",").map((p) => (p === heroName ? "you" : p.trim())).join(", ");
  if (who && who !== "known to all") bits.push(who);
  if (typeof m.turn === "number" && m.turn >= 0) bits.push("turn " + m.turn);
  const trigs = Array.isArray(m.triggers) ? m.triggers.filter(Boolean) : [];
  if (trigs.length) bits.push("recalls: " + trigs.slice(0, 8).join(", "));
  if (!bits.length) bits.push("known to all");
  return bits.join(" · ");
}

// Full-field editor for a memory entry — text plus every piece of metadata the entry carries
// (owner, triggers, and for auto entries also turn and pinned). Resolves with a patch object,
// or null when cancelled. Manual notes keep their always-pinned / undated nature, so those
// two fields aren't shown for them.
function memoryEditPopup(m, opts = {}) {
  return new Promise((resolve) => {
    const heroName = ((state.character || {}).name || "").trim() || "the hero";
    const attrEsc = (s) => esc(s).replace(/"/g, "&quot;");
    const trigs = (Array.isArray(m.triggers) ? m.triggers : []).join(", ");
    let pinned = !!m.pinned;
    // Add mode reuses this form with a blank template + preset fields: the title and the
    // confirm button say so, everything else (pin toggle, turn field, live onPin) works as-is.
    const title = opts.title || "Edit memory";
    const confirmText = opts.confirmText || "Save";
    const pinBtn = opts.allowTurn
      ? `<button class="mini mem-pin" title="Pinned memories sort first — they still need a trigger + owner match to reach the GM">${pinned ? "Unpin" : "📌 Pin"}</button>`
      : "";
    const turnField = opts.allowTurn
      ? `<label>Turn (blank = undated)<input class="f-turn" type="number" min="0" step="1" value="${typeof m.turn === "number" && m.turn >= 0 ? m.turn : ""}" placeholder="no turn"></label>`
      : "";
    const overlay = document.createElement("div");
    overlay.className = "popup-overlay";
    overlay.innerHTML = `<div class="popup mem-edit">
        <div class="popup-head"><span class="popup-title">${esc(title)}</span><div class="npcpop-acts">${pinBtn}<button class="popup-x" title="Close">✕</button></div></div>
        <div class="popup-body">
          <label>Memory<textarea class="f-text">${esc(m.text)}</textarea></label>
          <label>Who knows it<input class="f-owner" type="text" value="${attrEsc(m.owner)}" spellcheck="false"></label>
          <div class="dim">"world" = public knowledge. Otherwise the names of the character(s) who know it, separated by commas — e.g. ${esc(heroName)}, Lysandra. A memory can belong to the hero, an NPC, or several characters at once.</div>
          <label>Triggers (recall keywords, comma separated)<input class="f-trigs" type="text" value="${attrEsc(trigs)}" spellcheck="false" placeholder="guild, oath, lysandra"></label>
          ${turnField}
        </div>
        <div class="popup-acts">
          <button class="mini popup-cancel">Cancel</button>
          <button class="mini ok popup-save">${esc(confirmText)}</button>
        </div>
      </div>`;
    const release = pushBackClose(() => done(null));
    const done = (val) => { release(); overlay.remove(); resolve(val); };
    overlay.querySelector(".popup-x").onclick = () => done(null);
    overlay.querySelector(".popup-cancel").onclick = () => done(null);
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) done(null); });
    const pinEl = overlay.querySelector(".mem-pin");
    if (pinEl) pinEl.onclick = () => {
      pinned = !pinned;
      pinEl.textContent = pinned ? "Unpin" : "📌 Pin";
      if (opts.onPin) opts.onPin(pinned);
    };
    const textTa = overlay.querySelector(".f-text");
    const save = () => {
      const patch = {
        text: textTa.value,
        owner: overlay.querySelector(".f-owner").value.trim(),
        triggers: overlay.querySelector(".f-trigs").value
      };
      if (!patch.text.trim()) { textTa.focus(); return; }
      if (opts.allowTurn) {
        const tv = overlay.querySelector(".f-turn").value.trim();
        patch.turn = tv === "" ? null : Number(tv);
        patch.pinned = pinned;
      }
      done(patch);
    };
    overlay.querySelector(".popup-save").onclick = save;
    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") done(null);
      else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save();
    });
    document.body.appendChild(overlay);
    // On-screen keyboard shrinks the visual viewport (or overlays it on iOS) — after it
    // animates in, bring the focused field back into view inside the scrollable popup-body.
    const keepVisible = (el) => {
      setTimeout(() => { try { el.scrollIntoView({ block: "center" }); } catch (_) {} }, 300);
    };
    overlay.querySelectorAll(".f-text, .f-owner, .f-trigs, .f-turn").forEach((el) => {
      el.addEventListener("focus", () => keepVisible(el));
    });
    textTa.focus();
    textTa.select();
  });
}

// Read-only view of the AI-maintained latest situation (state.latestSituation) — a single present-tense
// sentence the roll-up rewrites each cycle and the GM always receives, so the player can see the
// engine's current picture of the story at a glance. Appends into the Memory panel's body (the
// sub-tab bar is already there — this must not clear it).
function renderSituationPanel(body) {
  const h = document.createElement("div");
  h.className = "p-sec";
  h.innerHTML = `<div class="p-label">Latest situation</div>
    <div class="dim npc-hint mem-hint">A one-line snapshot of where the story stands. Refreshed by each memory roll-up and always shown to the GM.</div>`;
  body.appendChild(h);

  const txt = String(state.latestSituation || "").trim();
  const row = document.createElement("div");
  row.className = "memrow";
  row.innerHTML = txt
    ? `<span class="mem-body"><span class="memtxt">${esc(txt)}</span></span><span class="acts-btns"><button class="mini" data-act="edit" title="Edit">✎</button><button class="mini" data-act="del" title="Delete">✖</button></span>`
    : `<span class="mem-body"><span class="dim">Nothing recorded yet</span></span><span class="acts-btns"><button class="mini" data-act="edit" title="Edit">✎</button></span>`;
  const editBtn = row.querySelector('[data-act="edit"]');
  if (editBtn) editBtn.onclick = async () => {
    const v = await TextPopup.open({ title: "Edit latest situation", value: String(state.latestSituation || ""), placeholder: "Where does the story stand…", rows: 3, confirmText: "Save" });
    if (v === null) return;
    state.latestSituation = String(v || "").trim().slice(0, 500);
    state.latestSituationTurn = state.turn || 0; // a hand-written line is fresh now (cadence marker untouched — the next roll-up still fires on schedule)
    store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
    renderMemoryPanel(body);
  };
  const delBtn = row.querySelector('[data-act="del"]');
  if (delBtn) delBtn.onclick = async () => {
    const ok = await ConfirmPopup.open({ title: "Delete latest situation", message: "Remove the latest situation? The next roll-up may write a new one, but this one is gone.", confirmText: "Delete", danger: true });
    if (!ok) return;
    state.latestSituation = "";
    state.latestSituationTurn = 0;
    store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
    renderMemoryPanel(body);
  };
  body.appendChild(row);
}

// The roll-up's live objective list (state.openThreads): what's in motion right now — quests,
// unresolved promises, grudges and threats. Always fed to the GM, so the player can see the
// threads the story is currently tracking. Appends into the Memory panel's body (sub-tab bar is
// already there — must not clear it).
function renderThreadsPanel(body) {
  const h = document.createElement("div");
  h.className = "p-sec";
  h.innerHTML = `<div class="p-label">Open threads</div>
    <div class="dim npc-hint mem-hint">What's in motion right now. Your edits stick until the next memory roll-up refreshes the list.</div>`;
  body.appendChild(h);

  const addBtn = document.createElement("button");
  addBtn.className = "btn panel-topbtn";
  addBtn.textContent = "＋ Add thread";
  addBtn.onclick = async () => {
    if ((state.openThreads || []).length >= 8) { notify("⚠ Max 8 open threads — delete one to make room."); return; }
    const v = await TextPopup.open({ title: "Add thread", placeholder: "What's in motion…", rows: 2, confirmText: "Add", cancelText: "Cancel" });
    if (v === null || !String(v).trim()) return;
    if (!Array.isArray(state.openThreads)) state.openThreads = [];
    state.openThreads.push(String(v).trim().slice(0, 160));
    store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
    renderMemoryPanel(body);
  };
  body.appendChild(addBtn);

  const threads = (Array.isArray(state.openThreads) ? state.openThreads : [])
    .map((t) => String(t || "").trim()).filter(Boolean);
  const wrap = document.createElement("div");
  wrap.className = "memlist";
  if (threads.length) {
    threads.forEach((t, i) => {
      const row = document.createElement("div");
      row.className = "memrow";
      row.innerHTML = `<span class="mem-body"><span class="memtxt">${i + 1}. ${esc(t)}</span></span>
        <span class="acts-btns"><button class="mini" data-act="edit" title="Edit">✎</button><button class="mini" data-act="del" title="Delete">✖</button></span>`;
      row.querySelector('[data-act="edit"]').onclick = async () => {
        const v = await TextPopup.open({ title: "Edit thread", value: t, rows: 2, confirmText: "Save" });
        if (v === null || !String(v).trim() || String(v).trim() === t) return;
        const idx = (state.openThreads || []).findIndex((x) => String(x || "").trim() === t);
        if (idx < 0) { renderMemoryPanel(body); return; }
        state.openThreads[idx] = String(v).trim().slice(0, 160);
        store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
        renderMemoryPanel(body);
      };
      row.querySelector('[data-act="del"]').onclick = async () => {
        const ok = await ConfirmPopup.open({ title: "Delete thread", message: "Remove this open thread? The next roll-up may add new ones, but this one is gone.", confirmText: "Delete", danger: true });
        if (!ok) return;
        const idx = (state.openThreads || []).findIndex((x) => String(x || "").trim() === t);
        if (idx >= 0) state.openThreads.splice(idx, 1);
        store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
        renderMemoryPanel(body);
      };
      wrap.appendChild(row);
    });
  }
  body.appendChild(wrap);
}

function renderMemoryPanel(body) {
  releaseMemChunks(); // the previous sub-tab's lazy list (if any) is going away
  body.innerHTML = "";
  const tabs = [
    ["manual", "Manual"],
    ["auto", "Auto"],
    ["situation", "Latest"],
    ["threads", "Threads"]
  ];
  const bar = document.createElement("div");
  bar.className = "seg mem-tabs";
  bar.innerHTML = tabs.map(([k, label]) =>
    `<button type="button" class="seg-btn${memTab === k ? " on" : ""}" data-mtab="${k}">${label}</button>`).join("");
  body.appendChild(bar);
  bar.querySelectorAll(".seg-btn").forEach((b) => (b.onclick = () => { memTab = b.dataset.mtab; renderMemoryPanel(body); }));

  if (memTab === "situation") renderSituationPanel(body);
  else if (memTab === "threads") renderThreadsPanel(body);
  else if (memTab === "manual") renderManualMemories(body);
  else renderAutoMemories(body);
}

/* ---------- memory panel: lazily-built rows ---------- */
// The memory sub-tabs build their rows in small chunks instead of all at once. Auto memories are
// uncapped and manual notes are uncapped, and one full list is a single big layout
// pass (~7ms for 200 rows on a fast desktop — several frames' worth on a slow phone). Appending
// MEM_ROW_CHUNK at a time keeps the first paint small; the rest follow as the rail body is scrolled
// near its bottom, or via the "Show more" button. A plain scroll listener is used rather than
// IntersectionObserver, which isn't dependable inside the preview iframe.
const MEM_ROW_CHUNK = 40;
let memChunksDetach = null; // scroll listener of the currently rendered lazy list, if any
let memRevealLast = false; // one-shot: build the whole (manual) list and jump to its end — set when a note is added

// Drop the current lazy list's scroll listener (called before the body is cleared/re-rendered).
function releaseMemChunks() {
  if (!memChunksDetach) return;
  const detach = memChunksDetach;
  memChunksDetach = null;
  detach();
}

// Append `builders` (row factories) into `ctn` in chunks, watching `scroller` for the next batch.
// `revealLast` builds the whole list in one go and scrolls to its end (used when a note was just
// added: the new row is the last one, and a lazily-hidden row would look like a lost note).
function renderChunked(ctn, scroller, builders, { revealLast = false } = {}) {
  releaseMemChunks();
  let shown = 0;
  const more = document.createElement("button");
  more.type = "button";
  more.className = "btn mem-more";
  const step = () => {
    if (shown >= builders.length) { more.remove(); releaseMemChunks(); return; }
    const end = Math.min(shown + (revealLast ? builders.length : MEM_ROW_CHUNK), builders.length);
    const frag = document.createDocumentFragment();
    for (let k = shown; k < end; k++) frag.appendChild(builders[k]());
    ctn.insertBefore(frag, more);
    shown = end;
    const left = builders.length - shown;
    if (left) more.textContent = `Show ${Math.min(MEM_ROW_CHUNK, left)} more`;
    else { more.remove(); releaseMemChunks(); }
    if (revealLast) { scroller.scrollTop = scroller.scrollHeight; revealLast = false; }
  };
  const onScroll = () => {
    if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 400) step();
  };
  more.onclick = step;
  ctn.appendChild(more);
  scroller.addEventListener("scroll", onScroll);
  memChunksDetach = () => scroller.removeEventListener("scroll", onScroll);
  step();
}

// Store index of an entry, resolved when an action fires (by identity, not captured up front): the
// lazy list outlives deletes, and a delete shifts every later index by one.
function memIndex(list, m) { return list.indexOf(m); }

// One automatic-memory row: the pin control (📌/○) and ✎/✖ sit ABOVE the text. Every action redraws
// just this row — a full panel rebuild would discard the lazily-built chunks and the scroll place.
function autoMemRow(m, body, updateCap, opts = {}) {
  // `opts` lets a host other than the Memory panel (the NPC profile's Memory tab) reroute the
  // "entry no longer exists" fallback and get told about an edit that its own view must re-filter;
  // both default to the panel's behaviour.
  const refresh = opts.refresh || (() => renderMemoryPanel(body));
  const afterEdit = opts.afterEdit || null;
  const row = document.createElement("div");
  row.className = "memrow stacked auto-mem" + (m.pinned ? " pinned" : "");
  row.innerHTML = `<span class="acts">
      <span class="pin" data-act="pin" role="button" tabindex="0" title="Pin or unpin — pinned memories sort first; they still need a trigger + owner match to be fed to the GM">${m.pinned ? "📌" : "○"}</span>
      <span class="acts-btns">
        <button class="mini" data-act="edit" title="Edit">✎</button>
        <button class="mini" data-act="del" title="Delete">✖</button>
      </span>
    </span>
    <span class="mem-body"><span class="memtxt">${esc(m.text)}</span><span class="memmeta">${esc(memMetaLine(m))}</span></span>`;
  const paint = () => {
    row.className = "memrow stacked auto-mem" + (m.pinned ? " pinned" : "");
    row.querySelector('[data-act="pin"]').textContent = m.pinned ? "📌" : "○";
    row.querySelector(".memtxt").textContent = m.text;
    row.querySelector(".memmeta").textContent = memMetaLine(m);
  };
  const doPin = () => {
    const i = memIndex(state.memories.auto, m);
    if (i < 0) { refresh(); return; }
    memory.togglePin(state, i);
    store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
    refresh(); // re-sort so the (un)pinned row floats/sinks immediately in both hosts
  };
  const pinEl = row.querySelector('[data-act="pin"]');
  pinEl.onclick = doPin;
  pinEl.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); doPin(); } };
  row.querySelector('[data-act="edit"]').onclick = async () => {
    const turnBefore = m.turn;
    const patch = await memoryEditPopup(m, {
      allowTurn: true,
      onPin: (pinned) => {
        const j = memIndex(state.memories.auto, m);
        if (j < 0) { refresh(); return; }
        state.memories.auto[j].pinned = pinned;
        paint();
        updateCap();
        store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
        if (afterEdit) afterEdit();
      }
    });
    if (!patch) return;
    const i = memIndex(state.memories.auto, m);
    if (i < 0) { refresh(); return; }
    memory.updateAuto(state, i, patch);
    // The list is ordered by turn, so a turn change needs a re-sort (and with it a fresh list);
    // anything else — text, owner, triggers, pin — is drawn back into this row in place.
    if (m.turn !== turnBefore) refresh();
    else { paint(); updateCap(); }
    store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
  };
  row.querySelector('[data-act="del"]').onclick = async () => {
    const ok = await ConfirmPopup.open({
      title: "Delete memory",
      message: "Delete this automatic memory? This cannot be undone.",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    const i = memIndex(state.memories.auto, m);
    if (i < 0) return;
    memory.removeAuto(state, i);
    row.remove(); // only this row leaves the DOM — the rest of the lazy list stays as it is
    updateCap();
    store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
  };
  return row;
}

// One manual-note row: the enable switch sits left of ✎/✖, above the note's text. Same in-place
// update rules as auto entries (no pin, no dated meta — undated, and fed to the GM only while on).
// A switched-ON note gets the same green outline as a pinned auto entry: both mark a row that is
// currently "live" (sorted-first / always fed).
function manualSwTitle(enabled) {
  return enabled
    ? "On — this note is always sent to the GM. Click to switch it off (the note is kept, but never sent)."
    : "Off — this note is not sent to the GM. Click to switch it on.";
}
function manualMemRow(m, body, updateCap, opts = {}) {
  // Same host hooks as `autoMemRow` — plus `afterEdit`, because an edited note is only repainted in
  // place here (its own view may care that its text or owner changed).
  const refresh = opts.refresh || (() => renderMemoryPanel(body));
  const afterEdit = opts.afterEdit || null;
  const row = document.createElement("div");
  const enabled0 = m.enabled !== false;
  row.className = "memrow stacked" + (enabled0 ? " note-on" : " off");
  row.innerHTML = `<span class="acts">
      <button class="ui-sw${enabled0 ? " on" : ""}" data-act="toggle" role="switch" aria-checked="${enabled0}" title="${manualSwTitle(enabled0)}">
        <span class="sw-track"><span class="sw-knob"></span></span>
        <span class="sw-text">${enabled0 ? "On" : "Off"}</span>
      </button>
      <span class="acts-btns">
        <button class="mini" data-act="edit" title="Edit">✎</button>
        <button class="mini" data-act="del" title="Delete">✖</button>
      </span>
    </span>
    <span class="mem-body"><span class="memtxt">${esc(m.text)}</span></span>`;
  const paint = () => {
    const enabled = m.enabled !== false;
    row.className = "memrow stacked" + (enabled ? " note-on" : " off");
    const sw = row.querySelector('[data-act="toggle"]');
    sw.classList.toggle("on", enabled);
    sw.setAttribute("aria-checked", String(enabled));
    sw.title = manualSwTitle(enabled);
    sw.querySelector(".sw-text").textContent = enabled ? "On" : "Off";
    row.querySelector(".memtxt").textContent = m.text;
  };
  row.querySelector('[data-act="toggle"]').onclick = () => {
    const i = memIndex(state.memories.manual, m);
    if (i < 0) { refresh(); return; }
    if (memory.toggleManualEnabled(state, i) === "capped") {
      notify(`⚠ ${MANUAL_ENABLED_CAP} memories are already switched on — switch one off to make room for this one.`);
      return;
    }
    paint();
    updateCap();
    store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
  };
  row.querySelector('[data-act="edit"]').onclick = async () => {
    const patch = await memoryEditPopup(m, { allowTurn: false });
    if (!patch) return;
    const i = memIndex(state.memories.manual, m);
    if (i < 0) { refresh(); return; }
    memory.updateManual(state, i, patch);
    paint();
    if (afterEdit) afterEdit();
    store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
  };
  row.querySelector('[data-act="del"]').onclick = async () => {
    const ok = await ConfirmPopup.open({
      title: "Delete memory",
      message: "Delete this note? This cannot be undone.",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    const i = memIndex(state.memories.manual, m);
    if (i < 0) return;
    memory.removeManual(state, i);
    row.remove();
    updateCap();
    store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
  };
  return row;
}

// The roll-up's automatic entries, plus (when present) the legacy "distant past" digest.
function renderAutoMemories(body) {
  const h = document.createElement("div");
  h.className = "p-sec";
  h.innerHTML = `<div class="p-label">Automatic memories</div>
    <div class="dim npc-hint mem-hint">The engine periodically records events worth remembering.</div>`;
  body.appendChild(h);

  const cap = document.createElement("div");
  cap.className = "mem-cap";
  cap.title = "Automatic entries are kept without cap — curate by hand (pin, edit, delete). Pinned entries sort first.";
  const updateCap = () => {
    const autoList = state.memories.auto || [];
    const pinnedCount = autoList.filter((m) => m.pinned).length;
    cap.innerHTML = `<b>${autoList.length - pinnedCount}</b> entries${pinnedCount ? ` · <b>${pinnedCount}</b> pinned` : ""}`;
  };
  updateCap();
  body.appendChild(cap);

  const autoWrap = document.createElement("div");
  autoWrap.className = "memlist";
  // Pinned on top (like the NPC list), then newest: event turn (then record time) descending.
  const orderedAuto = (state.memories.auto || [])
    .slice()
    .sort((a, b) => (((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))) || ((b.turn ?? -1) - (a.turn ?? -1)) || ((b.ts || 0) - (a.ts || 0)));
  if (!orderedAuto.length) autoWrap.innerHTML = `<div class="dim">No auto-memories yet.</div>`;
  // The wrap is attached BEFORE the first chunk is built: the row builders scroll the rail body to a
  // row's position (the manual add case), which needs the list to already be in the document.
  body.appendChild(autoWrap);
  if (orderedAuto.length) renderChunked(autoWrap, body, orderedAuto.map((m) => () => autoMemRow(m, body, updateCap)));

  const digestTxt = String(((state.memories || {}).digest) || "").trim();
  if (digestTxt) {
    const hd = document.createElement("div");
    hd.className = "p-sec";
    hd.innerHTML = `<div class="p-label">Distant past</div>
      <div class="dim npc-hint mem-hint">Compressed public history that fell off the automatic list as it filled up — known to everyone and always before the GM.</div>
      <div class="memrow"><span class="mem-body"><span class="memmeta">${esc(digestTxt)}</span></span>
        <button class="mini" data-act="digest-clear" title="Erase the distant-past digest — its facts will never reach the GM again">✖</button></div>`;
    hd.querySelector('[data-act="digest-clear"]').onclick = async () => {
      const ok = await ConfirmPopup.open({
        title: "Clear distant past",
        message: "Erase the distant-past digest? Its facts will never reach the GM again. This cannot be undone.",
        confirmText: "Erase",
        danger: true,
      });
      if (!ok) return;
      state.memories.digest = "";
      renderMemoryPanel(body);
      store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
    };
    body.appendChild(hd);
  }
}

// Player-authored notes — always fed to the GM and never pruned.
function renderManualMemories(body) {
  const h2 = document.createElement("div");
  h2.className = "p-sec";
  h2.innerHTML = `<div class="p-label">Manual memories</div>
    <div class="dim npc-hint mem-hint">Your own notes. Switch on or off to control which memories the GM is given for what's happening right now.</div>`;
  body.appendChild(h2);

  const manCap = document.createElement("div");
  manCap.className = "mem-cap";
  manCap.title = "Total notes you've written (never pruned). Up to " + MANUAL_ENABLED_CAP + " can be switched on at once — on notes are always fed to the GM, off notes are kept here but never sent.";
  const updateCap = () => {
    manCap.innerHTML = `<b>${(state.memories.manual || []).length}</b> entries · <b>${manualEnabledCount(state)}</b>/${MANUAL_ENABLED_CAP} enabled`;
  };
  updateCap();
  body.appendChild(manCap);

  // The add control sits ABOVE the list (a full-width button, like the sessions panel's world
  // switcher) and opens a roomy popup so a longer note is easy to type — no cramped inline field.
  const addBtn = document.createElement("button");
  addBtn.className = "btn panel-topbtn";
  addBtn.id = "memAddBtn";
  addBtn.textContent = "＋ Add memory";
  addBtn.onclick = async () => {
    const v = await TextPopup.open({
      title: "Add memory",
      placeholder: "Remember something important…",
      rows: 5,
      confirmText: "Add",
      cancelText: "Cancel",
    });
    if (v === null || !v.trim()) return;
    const entry = memory.addManual(state, v);
    if (entry && !entry.enabled) notify(`⚠ ${MANUAL_ENABLED_CAP} memories are already enabled — the new note was added switched off (no memory was lost).`);
    renderMemoryPanel(body);
    store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
  };
  body.appendChild(addBtn);

  const manWrap = document.createElement("div");
  manWrap.className = "memlist";
  // Newest first: record time descending (reverse insertion breaks ties for legacy notes without ts).
  const orderedManual = (state.memories.manual || [])
    .map((m, i) => ({ m, i }))
    .sort((a, b) => ((b.m.ts || 0) - (a.m.ts || 0)) || (b.i - a.i))
    .map((e) => e.m);
  memRevealLast = false; // newest lands on top in the first chunk — no jump to the end needed
  body.appendChild(manWrap); // attached first — the list needs to already be in the document
  if (orderedManual.length) renderChunked(manWrap, body, orderedManual.map((m) => () => manualMemRow(m, body, updateCap)));
}

/* ---------- in-session adventures panel ---------- */
async function renameSession(id, after) {
  let loaded = null;
  try { loaded = state && id === state.id ? state : await store.load(id); }
  catch (e) {
    if (isStorageError(e) || (e && e.isStorageUnavailable)) { notifyStorageError(notify, "reading", e); return; }
    throw e;
  }
  if (!loaded) return;
  const nv = await TextPopup.open({ title: "Rename adventure", value: loaded.name || "", placeholder: "Adventure name…" });
  if (nv === null || !nv.trim() || nv.trim() === loaded.name) return;
  loaded.name = nv.trim();
  try { await store.save(loaded); }
  catch (e) {
    if (isStorageError(e) || (e && e.isStorageUnavailable)) { notifyStorageError(notify, "saving", e); return; }
    throw e;
  }
  if (state && id === state.id) {
    render();
    notify("✏️ Adventure renamed to \"" + loaded.name + "\"");
  }
  refreshRailIfOpen("left");  if (after) after();
}

// "Name" → "Name (copy)", "Name (copy)" → "Name (copy 2)", "Name (copy 2)" → "Name (copy 3)", …
function adventureCopyName(name) {
  const base = String(name || "").trim() || "Untitled adventure";
  const m = base.match(/^(.*)\s\(copy(?:\s(\d+))?\)$/);
  if (!m) return `${base} (copy)`;
  const stem = m[1].trim() || "Untitled adventure";
  const n = m[2] ? parseInt(m[2], 10) + 1 : 2;
  return `${stem} (copy ${n})`;
}

// Deep-clone an adventure under a fresh id. Cloning the open adventure reads the live `state`
// (which may hold turns not yet saved, e.g. mid-GM-write) instead of the stored blob; any other
// adventure is loaded from the store. The copy keeps its world binding, hero, transcript,
// memories/NPCs/settings/map — only the id, the name and the timestamp are fresh. The ctx-meter
// cache is deliberately NOT copied (keyed per adventure id): the clone recomputes it on its
// next turn. Stays in the current chat — the caller re-renders its own list via `after`.
async function duplicateSession(id, after) {
  try {
    const src = (state && id === state.id) ? state : await store.load(id);
    if (!src) { notify("Couldn't load that adventure."); return; }
    const nv = await TextPopup.open({ title: "Duplicate adventure", value: adventureCopyName(src.name), placeholder: "Adventure name…", rows: 1 });
    if (nv === null || !nv.trim()) return;
    const copy = (typeof structuredClone === "function") ? structuredClone(src) : JSON.parse(JSON.stringify(src));
    const taken = new Set((await store.list()).map((s) => s.id));
    let nid;
    do { nid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); } while (taken.has(nid));
    copy.id = nid;
    copy.name = nv.trim();
    await store.save(copy);
    notify(`⧉ Duplicated as "${copy.name}"`);
    refreshRailIfOpen("left"); if (after) after();
  } catch (e) {
    if (isStorageError(e) || (e && e.isStorageUnavailable)) {
      console.warn("[adventures] duplicate failed (storage unavailable):", (e && e.message) || e);
      notifyStorageError(notify, "saving", e);
      return;
    }
    console.warn("[adventures] duplicate failed:", e);
    notify("Couldn't duplicate that adventure.");
  }
}

// Move an adventure to a different world: confirm first (the rebind can break the game —
// the same warning the unbound-world flow shows), then the world picker, then the rebind.
// The hero, transcript, memories and settings travel untouched — only the world binding
// changes. When the adventure being moved is the open one, the live chat rebinds to the new
// world in place (the same bind + stale-key purge entering a session does) instead of
// playing on with the old world's systems.
async function switchSessionWorld(id, after) {
  let adv = null;
  try { adv = (state && id === state.id) ? state : await store.load(id); }
  catch (e) {
    if (isStorageError(e) || (e && e.isStorageUnavailable)) { notifyStorageError(notify, "reading", e); return; }
    throw e;
  }
  if (!adv) return;
  if (generating && state && id === state.id) { notify("⏳ The GM is still writing — wait for it to finish first."); return; }
  const curName = adv.worldName || worldNameForId(adv.worldId) || "its world";
  const ok = await ConfirmPopup.open({
    title: "Switch World",
    message: `Move '${adv.name || "Untitled adventure"}' from "${curName}" to a different world? Its hero, story and settings stay as they are — only the world binding changes.`,
    warning: "Binding an existing adventure to a different world may break the game — its hero, stats, trackers and story were built for the original world and may not line up.",
    confirmText: "Choose world"
  });
  if (!ok) return;
  const world = await showWorldPicker();
  if (!world) return; // cancelled — stay where we were
  if (world.meta.id === adv.worldId) { notify("That's the world it's already in."); return; }
  adv.worldId = world.meta.id;
  adv.worldName = world.meta.name || "";
  try { await store.save(adv); }
  catch (e) {
    if (isStorageError(e) || (e && e.isStorageUnavailable)) { notifyStorageError(notify, "saving", e); return; }
    throw e;
  }
  if (state && id === state.id) {
    try { await ensureWorldBound(adv.worldId); }
    catch (e) {
      if (isStorageError(e) || (e && e.isStorageUnavailable)) notifyStorageError(notify, "reading", e);
      else throw e;
    }
    try { purgeNpcTrackerKeys(state, npcTrackerDefs); } catch (e) {}
    render();
  }
  notify(`⇄ Moved to "${adv.worldName || "the new world"}"`);
  refreshRailIfOpen("left"); if (after) after();
}

// (The old in-chat Adventures panel lived here — its rows now live in the Menu's
// Adventures-in-this-world list; the grid covers world-hopping.)

/* ---------- re-roll archives (lazy) ---------- */
// A turn with only ONE version stores NO archive: its single version is the live transcript tail
// itself, so a reply that was never re-rolled isn't stored twice. An archive (`action.rerolls` /
// `state.openingRerolls[start]`, with `rerollIndex` selecting the version) is materialised by the
// first re-roll, which stashes the pre-re-roll reply as version 0 (see rerollTurn).
//
// This drops any single-version archive a save still carries (the old eager format), reclaiming
// roughly half the GM text in an existing file. Archives holding 2+ versions are real re-roll
// history and are left alone. Returns true when something changed, so the caller can persist the
// shrink.
//
// TODO: remove once every live save has been compacted (see README §6.11) — after that this is dead
// weight, and "archive absent" already means "one version" everywhere.
function compactVersionArchives(d) {
  let changed = false;
  for (const m of d.messages || []) {
    if ((m.role === "action" || m.role === "direct") && Array.isArray(m.rerolls) && m.rerolls.length <= 1) {
      delete m.rerolls;
      m.rerollIndex = 0;
      changed = true;
    }
  }
  if (Array.isArray(d.openingRerolls)) {
    // legacy shape ([replyMessages]) — always a single version; normalizeOpeningRerolls migrates it
    if (d.openingRerolls.length) { d.openingRerolls = {}; changed = true; }
  } else if (d.openingRerolls && typeof d.openingRerolls === "object") {
    for (const k of Object.keys(d.openingRerolls)) {
      const list = d.openingRerolls[k];
      if (Array.isArray(list) && list.length <= 1) {
        delete d.openingRerolls[k];
        changed = true;
      }
    }
  }
  return changed;
}

function normalize(d) {
  d.worldId = d.worldId || (defaultWorld && defaultWorld.meta.id) || "eryndor"; // save schema v2 — migrate v1 sessions to the default world
  if (!d.worldName) d.worldName = ""; // the world's name as it was when this save last saw it
  d.messages = d.messages || [];
  for (const m of d.messages) {
    // Generation tasks don't survive a reload. A re-roll in flight never cleared the old images,
    // so dropping its partial buffer recovers the message as the old images (see finishImageReplace).
    if (m.role === "image") { m.pending = 0; m.failed = 0; m.cancelled = 0; delete m.replacing; }
  }
  d.memories = normalizeMemories(d.memories, (d.character && d.character.name) || "");
  // 🔗-menu link overrides (see npcLinkRuleFor in npc-system.js). Sanitized, never trusted blind:
  // only well-formed rules survive a load, so a stale hand-edit can't redirect lookups anywhere odd.
  if (!d.npcLinkRules || typeof d.npcLinkRules !== "object" || Array.isArray(d.npcLinkRules)) d.npcLinkRules = {};
  else for (const [k, r] of Object.entries(d.npcLinkRules)) {
    if (!r || typeof r !== "object") { delete d.npcLinkRules[k]; continue; }
    if (r.mode === "unlink") { d.npcLinkRules[k] = { mode: "unlink" }; continue; }
    if (r.mode === "link" && typeof r.target === "string" && r.target.trim()) { d.npcLinkRules[k] = { mode: "link", target: r.target.trim() }; continue; }
    delete d.npcLinkRules[k];
  }
  // Drop provably-void link rules: they resolve nothing but still paint the 🔗 icon on every
  // bubble of that spelling. Self-pins (spelling already matches its target — exact lookup
  // resolves identically), dead targets (entry gone — e.g. renamed away), and "always
  // separate" rules for a spelling that IS a roster entry (exact/case-insensitive resolution
  // agrees with or without them — see dropVoidLinkRules). Unlink rules for genuine variant
  // spellings are explicit user intent and always survive — clear those from the 🔗 menu
  // itself ("Forget remembered rule").
  dropVoidLinkRules(d);
  if (!d.npcs) {
    d.npcs = {};
    const old = d.npcRegistry || {};
    for (const [name, e] of Object.entries(old)) {
      const det = mergePersona(e.details || {});
      d.npcs[name] = {
        name,
        portrait: e.portrait || e.avatar || "src/images/portrait-placeholder.webp",
        description: e.description || "",
        details: det && Object.keys(det).length ? det : null,
        importance: e.importance || (det && Object.keys(det).length ? "medium" : null),
        appearanceCount: typeof e.appearanceCount === "number" ? e.appearanceCount : 1,
        firstSeenTurn: typeof e.firstSeenTurn === "number" ? e.firstSeenTurn : (e.firstSeen || 0),
        lastSeenTurn: typeof e.lastSeenTurn === "number" ? e.lastSeenTurn : (e.firstSeenTurn || e.firstSeen || 0),
        everSpoke: !!e.everSpoke,
        pinned: !!e.pinned
      };
    }
  } else {
    for (const [name, e] of Object.entries(d.npcs)) {
      if (!e.name) e.name = name;
      e.portrait = (e.portrait === "🧙" || !e.portrait) ? "src/images/portrait-placeholder.webp" : e.portrait;
      e.details = e.details ? mergePersona(e.details) : null;
      e.importance = e.importance || (e.details && Object.keys(e.details).some((k) => e.details[k]) ? "medium" : null);
      // 0 and -1 are meaningful (no visible appearances / not in shown story) — only fill when
      // the field is missing entirely, never coerce them back to 1/0.
      if (typeof e.appearanceCount !== "number") e.appearanceCount = 1;
      if (typeof e.firstSeenTurn !== "number") e.firstSeenTurn = 0;
      if (typeof e.lastSeenTurn !== "number") e.lastSeenTurn = 0;
      if (typeof e.everSpoke !== "boolean") e.everSpoke = !!e.everSpoke;
      e.pinned = !!e.pinned;
      if (!e.trackers || typeof e.trackers !== "object") e.trackers = null; // seeded by npcSys.backfill (worlds that define NPC trackers)
    }
  }
  d.character = initCharacterStats(d.character || defaultCharacter());
  if (!d.initialTrackers) d.initialTrackers = null; // derive from tracker config / messages
  d.settings = d.settings || { showInnerThoughts: false, rollChecks: true, simNpcLife: true, showTrackerChanges: true };
  delete d.settings.autoMemoryEvery; // memory cadence is engine-level (MEMORY_EVERY_TURNS) — not user-configurable
  if (d.settings.showInnerThoughts === undefined) d.settings.showInnerThoughts = false;
  if (d.settings.showTrackerChanges === undefined) d.settings.showTrackerChanges = true;
  if (d.settings.rollChecks === undefined) d.settings.rollChecks = true;
  if (d.settings.simNpcLife === undefined) d.settings.simNpcLife = true;
  delete d.settings.sceneAmt; // scene prefs went global (`mno.scenePrefs`) — per-adventure copies are dead weight
  delete d.settings.sceneAspect;
  if (!d.lastAutoMemoryTurn) d.lastAutoMemoryTurn = 0;
  // `worldSummary` was renamed to `latestSituation` (same one-line snapshot, same semantics) —
  // carry existing sessions over, then drop the old key.
  if (typeof d.latestSituation !== "string") d.latestSituation = typeof d.worldSummary === "string" ? d.worldSummary : "";
  delete d.worldSummary;
  // Age marker for the GM's LATEST SITUATION line — old saves stamp their last roll-up cycle.
  if (typeof d.latestSituationTurn !== "number" || d.latestSituationTurn < 0) d.latestSituationTurn = d.lastAutoMemoryTurn || 0;
  if (d.latestSituationTurn > d.turn) d.latestSituationTurn = d.turn;
  if (typeof d.lastAutoMemoryAt !== "number" || d.lastAutoMemoryAt < 0) d.lastAutoMemoryAt = 0;
  else if (d.lastAutoMemoryAt > d.messages.length) d.lastAutoMemoryAt = d.messages.length; // a deleted tail must never leave the cursor past the transcript (that used to stall roll-ups forever)
  const anchors = (d.messages || []).filter((m) => m && (m.role === "action" || m.role === "direct")).length;
  if ((d.turn || 0) > anchors) d.turn = anchors;
  if ((d.lastAutoMemoryTurn || 0) > d.turn) d.lastAutoMemoryTurn = d.turn;
  // Off-screen NPC life cursor (see npc-life.js). Engine-level like the memory
  // cadence — never user-configurable. Clamp a future cursor the same way.
  if (typeof d.lastNpcLifeTurn !== "number" || d.lastNpcLifeTurn < 0) d.lastNpcLifeTurn = 0;
  if ((d.lastNpcLifeTurn || 0) > d.turn) d.lastNpcLifeTurn = d.turn;
  // Per-NPC private-life state: a mini-goal of their own, current whereabouts,
  // and the turn both last advanced. Forward-looking only (never rewound with
  // the transcript), so a missing field simply starts empty — old saves gain
  // private lives on the next tick without any migration of existing memories.
  for (const e of Object.values(d.npcs || {})) {
    if (!e || typeof e !== "object") continue;
    if (typeof e.lifeGoal !== "string") e.lifeGoal = "";
    else e.lifeGoal = e.lifeGoal.slice(0, 200);
    if (!Array.isArray(e.lifeHistory)) e.lifeHistory = [];
    // Entries are {goal, turn}; pre-turn string entries migrate to turn -1 (shown without a turn tag).
    else e.lifeHistory = e.lifeHistory.map((h) => {
      if (h && typeof h === "object") return { goal: String(h.goal == null ? "" : h.goal).trim().slice(0, 200), turn: (typeof h.turn === "number" && h.turn >= 0) ? Math.floor(h.turn) : -1 };
      return { goal: String(h == null ? "" : h).trim().slice(0, 200), turn: -1 };
    }).filter((h) => h.goal).slice(-NPC_LIFE_HISTORY_MAX);
    if (typeof e.lifeWhere !== "string") e.lifeWhere = "";
    else e.lifeWhere = e.lifeWhere.slice(0, 120);
    if (typeof e.lifeTick !== "number" || e.lifeTick < 0) e.lifeTick = -1;
  }
  // open threads survive as plain strings; older sessions simply have none until the next roll-up
  if (!Array.isArray(d.openThreads)) d.openThreads = [];
  else d.openThreads = d.openThreads.map((t) => String(t && (t.text || t) || "").trim()).filter(Boolean).slice(0, 8).map((t) => t.slice(0, 160));
  if (!d.map) d.map = null;
  if (!d.mapCache || typeof d.mapCache !== "object") d.mapCache = {};
  delete d.worldMap;
  if (typeof d.surroundingsLoc === "undefined") d.surroundingsLoc = null;
  if (typeof d.surroundingsPos === "undefined") d.surroundingsPos = null;
  return d;
}

/* ---------- character panel ---------- */
// A Hero-panel tracker row. Bar-type trackers (number + max) render as a full-width row; others
// fall back to the compact chip. The whole row opens the shared info-tip (`hint`, headed with
// the label) — same convention as the tracker bar; `rules` is GM-only.
function heroTrackerHtml(d, curTrk) {
  const curMax = liveMax(d, curTrk, (state.character && state.character.stats) || {});
  if (d.type === "number" && curMax) {
    const [tc, ta] = trkTip(d);
    const ic = d.icon ? `<span class="trk-ic">${esc(d.icon)}</span>` : "";
    const label = d.label ? `<span class="trk-l">${esc(d.label.toUpperCase())}</span>` : "";
    const num = clampNum(curTrk[d.key], 0, 0, curMax);
    const pct = curMax > 0 ? Math.round((num / curMax) * 100) : 0;
    const fillStyle = `width:${pct}%` + (d.color ? `;background:${esc(d.color)}` : "");
    return `<div class="trk hbar${tc}"${ta}>${ic}${label}<span class="trk-bar"><span class="trk-fill" style="${fillStyle}"></span></span><span class="trk-v">${num}/${curMax}</span></div>`;
  }
  return trackerChip(d, curTrk[d.key], curMax);
}

// The Hero panel's tracker rows: the combined level+exp bar, then the remaining hero-shown
// trackers (level/exp are handled by the bar, so they're not repeated). Built from the live
// tracked state so a chat-side tracker update can repaint just this strip (refreshHeroTrackerRow)
// without rebuilding the whole panel. Level/exp are resolved by KEY OR LABEL (levelTracker /
// expTracker), and excluded by DEF REFERENCE so a world that names them lvl / xp still works.
// Level WITHOUT exp is a compact pip (no `hbar`, so it wraps with the other chips); WITH exp it
// keeps the full-width combined bar, exactly as before.
function heroTrackerRowsHtml(curTrk) {
  const lvlRaw = levelTracker(trackerDefs);
  const expRaw = expTracker(trackerDefs);
  const lvlDef = lvlRaw && lvlRaw.show !== "hidden" ? lvlRaw : null;
  const expDef = expRaw && expRaw.show !== "hidden" ? expRaw : null;
  const heroStats = (state.character && state.character.stats) || {};
  const lvlVal = lvlDef ? Number(curTrk[lvlDef.key]) || 0 : 0;
  const expVal = expDef ? Number(curTrk[expDef.key]) || 0 : 0;
  const expMax = expDef ? liveMax(expDef, curTrk, heroStats) : 0;
  const expPct = expMax > 0 ? Math.max(0, Math.min(100, Math.round((expVal / expMax) * 100))) : 0;
  // The combined bar's fill follows the exp color first, then level's; when neither is set
  // there is no inline background, so the default (`.trk.hbar.lvlbar .trk-fill`) applies.
  const lvlFillColor = (expDef && expDef.color) || (lvlDef && lvlDef.color) || "";
  const lvlFillStyle = `width:${expPct}%` + (lvlFillColor ? `;background:${esc(lvlFillColor)}` : "");
  const lvlCls = expDef ? "trk hbar lvlbar" : "trk lvlbar";
  // The bar's tip is the level hint when it has one, else the exp hint (whichever def carries
  // one wins; with neither there is no hook — the bar's own numbers already say everything).
  const [lc, la] = trkTip(lvlDef && lvlDef.hint ? lvlDef : expDef);
  const lvlHtml = lvlDef
    ? `<div class="${lvlCls}${lc}"${la}>
        <span class="trk-ic">${lvlDef.icon ? esc(lvlDef.icon) : "🏅"}</span>
        <span class="lb-lv">Lv <b>${lvlVal}</b></span>
        ${expDef ? `<span class="trk-bar"><span class="trk-fill" style="${lvlFillStyle}"></span></span><span class="trk-v">${expVal}/${expMax}</span>` : ""}
      </div>`
    : "";
  const statusDefs = trackerDefs.filter((d) => (d.show === "hero" || d.show === "both") && d !== lvlDef && d !== expDef);
  return [lvlHtml, ...statusDefs.map((d) => heroTrackerHtml(d, curTrk))].filter(Boolean);
}

// Repaint the Hero panel's tracker strip from the live tracked state, in place. Called from
// render() so a tracker update (a GM turn, a delete, a re-roll) shows up in the Hero panel even
// when it's the panel the player already has open — a full re-render would reset its scroll and
// any in-progress stat allocation.
function refreshHeroTrackerRow() {
  const el = $("heroTrkRow");
  if (!el) return;
  const rows = heroTrackerRowsHtml(currentTrackers());
  el.hidden = !rows.length;
  el.innerHTML = rows.join("");
}

/* ---------- NPC trackers (per-NPC tracked values — see README §6.3.1) ---------- */
// One character's live values: the newest message snapshot that mentions them, else their entry
// seed, else the world defaults (the same fold the GM's context and the tracker call use).
function npcTrackersFor(name) {
  return foldNpcTrackers(state, name, npcTrackerDefs, (state.character && state.character.stats) || {});
}

// One `.trk` per def for `name`, reusing the hero panel's markup/classes: icon, label, value, and a
// bar when the tracker has a max. Full-width rows (`.trk.hbar`) — the flavour the NPC profile popup
// wants. Read-only: values are hand-edited through the GM-reply editor's `[NPC TRACKERS]` block
// (§6.3.1), not from these rows.
function npcTrackerValuesHtml(name) {
  const stats = (state.character && state.character.stats) || {};
  const cur = npcTrackersFor(name);
  return npcTrackerDefs.filter((d) => d.show !== "hidden").map((d) => {
    const [tc, ta] = trkTip(d);
    const curMax = d.type === "number" ? liveMax(d, cur, stats) : undefined;
    const ic = d.icon ? `<span class="trk-ic">${esc(d.icon)}</span>` : "";
    const label = d.label ? `<span class="trk-l">${esc(d.label.toUpperCase())}</span>` : "";
    let body;
    let cls = "trk";
    if (d.type === "number" && curMax) {
      const num = clampNum(cur[d.key], 0, 0, curMax);
      const pct = curMax > 0 ? Math.round((num / curMax) * 100) : 0;
      const fillStyle = `width:${pct}%` + (d.color ? `;background:${esc(d.color)}` : "");
      cls = "trk hbar";
      body = `<span class="trk-bar"><span class="trk-fill" style="${fillStyle}"></span></span><span class="trk-v">${num}/${curMax}</span>`;
    } else if (d.type === "number") {
      cls = "trk trk-num";
      body = `<span class="trk-v">${clampNum(cur[d.key], 0, 0, Infinity) || 0}</span>`;
    } else {
      const v = (cur[d.key] === undefined || cur[d.key] === null || cur[d.key] === "") ? "—" : String(cur[d.key]);
      cls = "trk trk-num";
      body = `<span class="trk-v">${esc(v)}</span>`;
    }
    return `<span class="${cls}${tc}"${ta}>${ic}${label}${body}</span>`;
  }).join("");
}

// The strip wrapper — the thing refreshNpcTrackerRow() finds and repaints. Empty string when the
// world defines no NPC trackers (or the character has no entry), so callers can concatenate freely.
function npcTrackerStripHtml(name) {
  if (!npcTrackerDefs.length || !(state.npcs || {})[name]) return "";
  return `<span class="npctrk-strip" data-npc-trackers="${esc(name)}">${npcTrackerValuesHtml(name)}</span>`;
}

// Escape a value for use inside a quoted attribute selector (a character name may contain quotes).
function cssAttrEsc(s) {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(String(s));
  return String(s).replace(/["\\\]]/g, "\\$&");
}

// Repaint one character's strip in place (or every strip when `name` is omitted) — the popup's
// tracker rows — so a tracker update or a hand-edit lands without rebuilding an open popup and
// losing its scroll (mirrors refreshHeroTrackerRow). Called from render() and after a hand-edit.
function refreshNpcTrackerRow(name) {
  if (!npcTrackerDefs.length) return;
  const sel = name ? `.npctrk-strip[data-npc-trackers="${cssAttrEsc(name)}"]` : ".npctrk-strip";
  for (const el of document.querySelectorAll(sel)) {
    const n = el.dataset.npcTrackers;
    if (!(state.npcs || {})[n]) continue;
    el.innerHTML = npcTrackerValuesHtml(n);
  }
}

// The turn's own NPC snapshot — every part of a reply carries the same object, so the last part is
// the turn's. Null when this turn moved nobody (afterNpcTrackers is sparse: absent = unchanged).
function turnNpcSnapshot(turn) {
  const parts = (turn && turn.parts) || [];
  const snap = parts.length ? parts[parts.length - 1].afterNpcTrackers : null;
  return snap && typeof snap === "object" && Object.keys(snap).length ? snap : null;
}

// The characters a reply is hand-edited for: everyone who SPEAKS in it — a `[Name]` dialogue line or
// a `[Name inner]` thought — plus anyone this turn's sparse snapshot moved (a change the narrator
// described without giving the character a line). Speakers come first, so the block reads in play
// order. Only catalogued characters carry trackers, so unknown names are skipped.
function npcTrackerEditNames(turn) {
  const names = [];
  const seen = new Set();
  const add = (n) => { if (n && !seen.has(n)) { seen.add(n); names.push(n); } };
  for (const m of (turn && turn.parts) || []) {
    if ((m.role === "npc" || m.role === "thought") && m.name) add(m.name);
  }
  const snap = turnNpcSnapshot(turn);
  if (snap) for (const name of Object.keys(snap)) add(name);
  return names;
}

// One character's values as of just BEFORE message index `beforeIndex`: the newest earlier message
// whose snapshot mentions them, else their entry seed, else fresh defaults. The live fold
// (`npcTrackersFor`) reads from the END of the transcript, so editing an OLD turn with it would show
// — and then store — later turns' values; this walks back the turn being edited instead.
function npcTrackersBefore(beforeIndex, name) {
  for (let i = beforeIndex; i >= 0; i--) {
    const m = state.messages[i];
    const s = m && m.afterNpcTrackers;
    const v = s && typeof s === "object" ? s[name] : null;
    if (v && typeof v === "object" && Object.keys(v).length) return { ...v };
  }
  const entry = (state.npcs || {})[name];
  if (entry && entry.trackers && Object.keys(entry.trackers).length) return { ...entry.trackers };
  return initialNpcTrackers(npcTrackerDefs, (state.character && state.character.stats) || {});
}

// The `[NPC TRACKERS]` block a GM reply is hand-edited with — ALWAYS one COMPLETE section per
// character who speaks in this turn, whether or not the turn moved them, so their values are always
// at hand; plus anyone this turn's snapshot moved (so a narrator-described change with no dialogue
// line stays hand-fixable). A section left out still means "unchanged by this turn". A character the
// turn changed shows this turn's own values (its snapshot); a speaker it didn't shows the value they
// held going into the turn. Returns "" when the world defines no NPC trackers or the turn has no
// tracked character in it.
function npcTrackerBlockForEdit(turn) {
  const vals = npcTrackerEditVals(turn);
  if (!vals) return "";
  const stats = (state.character && state.character.stats) || {};
  return "\n\n[NPC TRACKERS]\n" + npcTrackerBlockText(npcTrackerDefs, vals, stats);
}

// The per-character value map behind npcTrackerBlockForEdit, shared with the editor's
// NPC trackers tab so both show the same values.
function npcTrackerEditVals(turn) {
  if (!npcTrackerDefs.length) return null;
  const snap = turnNpcSnapshot(turn) || {};
  const vals = {};
  for (const name of npcTrackerEditNames(turn)) {
    if (!(state.npcs || {})[name]) continue;
    vals[name] = snap[name] ? { ...snap[name] } : npcTrackersBefore(turn.start - 1, name);
  }
  return Object.keys(vals).length ? vals : null;
}

// Apply the edited `[NPC TRACKERS]` block back onto the turn's messages: one complete value set per
// character section, written to the same sparse snapshot map the tracker call writes. So the fold
// reads the hand-fixed values back, and deleting/re-rolling that turn still reverts them (D7).
// Sections are compared against the values each character held going INTO the turn
// (`npcTrackersBefore` — NOT the turn's own snapshot, which holds the changed value), so the
// snapshot stays genuinely sparse: an untouched speaker merely echoing their pre-turn value is a
// no-op and is dropped, while a player's edit — a new value, a revert to the pre-turn value, or a
// section added for someone this turn didn't move — lands. A section the player deleted is absent =
// "unchanged by this turn"; numbers are clamped exactly as a parsed value is; unknown names are
// ignored. Clearing every section is honoured (the turn's snapshot is dropped entirely).
function applyEditedNpcTrackerBlock(turn, parsed, block) {
  if (!npcTrackerDefs.length) return;
  const stats = (state.character && state.character.stats) || {};
  const roster = Object.keys(state.npcs || {});
  const prevByName = {};
  for (const name of roster) prevByName[name] = npcTrackersBefore(turn.start - 1, name);
  const next = parseNpcTrackerBlock(block, npcTrackerDefs, prevByName, stats, roster, { sparse: true });
  // Keep the off-screen mute marker across a hand-edit (see npcTrackerDeltas): opening the editor
  // and saving a dialogue-only change must not unsuppress absent-NPC bookkeeping chips. Filtered
  // to names surviving in the edited snapshot, so reverting a muted change clears its mute too.
  let prevMuted = null;
  for (const m of (turn.parts || [])) {
    if (m && Array.isArray(m.afterNpcTrackersOffscreen)) { prevMuted = m.afterNpcTrackersOffscreen; break; }
  }
  const keptMuted = (prevMuted || []).filter((n) => next && Object.prototype.hasOwnProperty.call(next, n));
  for (const m of parsed) {
    if (Object.keys(next).length) m.afterNpcTrackers = next;
    else delete m.afterNpcTrackers;
    if (keptMuted.length) m.afterNpcTrackersOffscreen = [...keptMuted];
    else delete m.afterNpcTrackersOffscreen;
  }
}

// Upload a local image as an avatar (downscaled + JPEG-encoded data URL — the same inline
// encoding generated avatars use) onto `obj[key]`. Returns true on success. Used by the NPC
// detail popup, the Hero panel, and the creation wizard.
async function uploadAvatarTo(obj, key = "portrait") {
  let file;
  try { file = await pickImageFile(); } catch (e) { return false; }
  if (!file) return false;
  try {
    obj[key] = await fileToAvatarDataUrl(file);
    return true;
  } catch (e) {
    notify("⚠ " + ((e && e.message) || "Couldn't load that image."));
    return false;
  }
}

// Regenerate the hero's portrait, mirroring NPC portrait generation: prompt from the hero's bio
// (name, gender, age, appearance) + the current scene's backdrop + the project's art style.
// Regenerate a hero portrait, mirroring NPC portrait generation: prompt from the hero's bio
// (name, gender, race, age, appearance) + the current scene's backdrop + the project's art style.
// `c`/`st` default to the active session's hero/state (the Hero-panel regen button); the creation
// wizard passes the in-progress session so generation works before the session is live.
async function genHeroPortrait(c = state.character, st = state) {
  // sceneBackground already falls back on failure/timeout; the image step throws on timeout or an
  // empty result (genImageSafe) — false means "failed", and the caller notifies + clears its spinner.
  const bg = await npcSys.sceneBackground(st);
  const identity = [c.gender, c.race || "", c.age ? `age ${c.age} years old` : ""].filter(Boolean).join(", ");
  const bits = [identity, c.appearance || "", bg].filter(Boolean);
  const style = imageStyleTags ? `, (${imageStyleTags})` : "";
  const prompt = `Half body portrait of ${c.name || "the hero"}, ${bits.join(", ")}${style}.`;
  try {
    const r = await genImageSafe(genImage, prompt, { route: "portraits", negativePrompt: imageNegativeTags, guidanceScale: imageGuidance() });
    c.portrait = r.dataUrl;
  } catch (e) {
    console.error("Hero portrait generation failed:", e);
    return false;
  }
  if (st === state && state) store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
  return true;
}

/* ---------- character creation wizard ---------- */
// Starting stat points a new hero can distribute in the creation wizard (step 3), the floor a
// starting stat can be reduced to and the ceiling it can be raised to (point-buy: − refunds
// points, + spends them) come from the loaded world's stats (`ccBudget`, `ccFloor`, `ccCeiling`)
// — defaults here are only fallbacks.

// Bio fields shown in wizard step 1 — mirrored by the Hero panel's Profile tab (renderCharacterPanel).
// Tuples are [key, label, type, placeholder, rows, half]: `half` fields (name/gender/race/age) render
// in a two-column grid, everything else is a full-width row of its own.
const CC_BIO_FIELDS = [
  ["name", "Name", "input", "Hero name (required)", "", true],
  ["gender", "Gender", "input", "e.g. male, female, nonbinary…", "", true],
  ["race", "Race", "input", "e.g. human, elf, dwarf…", "", true],
  ["age", "Age", "input", "e.g. 25", "", true],
  ["job", "Job", "input", "e.g. sellsword, apothecary, scholar…"],
  ["appearance", "Appearance", "textarea", "Build, hair, eyes, scars, clothing…", 3],
  ["persona", "Persona", "textarea", "How they come across — core personality, mannerisms, how they speak…", 3],
  ["extra", "Extra details", "textarea", "Anything else the world should know about them", 3]
];

// Recover a single JSON object from an LLM reply — strict parse, then the vendored jsonrepair.
async function parseAiJson(t) {
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
  const rep = await import("../vendor/jsonrepair.mjs").then((m) => m.jsonrepair);
  for (const ch of chunks) { try { return JSON.parse(rep(ch)); } catch (_) {} }
  throw new Error("The AI reply wasn't valid JSON.");
}

// Ask the AI for a fresh, coherent hero bio (name included) and write it into `c`.
// `dir` is an optional player direction ("a retired pirate…") honored above all else.
async function randomizeBioWithAI(c, dir = "") {
  const inst = [
    "You are designing a hero for a text-based AI roleplaying game. Create one coherent, memorable character — every field must be consistent with the others and with the world.",
    scenarioText ? "World premise: " + scenarioText : "",
    vibeText ? "Narrative vibe: " + vibeText : "",
    dir ? "The player's direction — honor it above all else: " + dir : "",
    "Invent a fitting name too — the name is replaced along with every other field.",
    'Return a single JSON object with exactly these keys: "name", "gender", "race", "age", "job", "appearance", "persona", "extra".',
    "appearance: 1–2 sentences focused on physical and facial traits first — build, face shape, eyes, hair, skin, distinguishing marks like scars or tattoos — ending with a brief note on what they wear.",
    "persona: 1–2 sentences — core personality, mannerisms, how they speak.",
    "extra: one distinctive background detail, skill, or quirk.",
    "Be creative.",
    'Reply with ONLY the JSON object — no prose, no code fence. Strict valid JSON: double quotes, no trailing commas. Example: {"name": "Elara", "gender": "female", "race": "half-elf", "age": "24", "job": "…", "appearance": "…", "persona": "…", "extra": "…"}'
  ].filter(Boolean).join("\n\n");
  const res = await genText({ instruction: subUser(inst, c.name), route: "other", maxTokens: 700 });
  const txt = String((res && res.text) || res || "").trim();
  const obj = await parseAiJson(txt);
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error("not an object");
  let wrote = false;
  for (const [k] of CC_BIO_FIELDS) {
    if (typeof obj[k] === "string" && obj[k].trim()) { c[k] = obj[k].trim(); wrote = true; }
  }
  if (!wrote) throw new Error("no fields in reply");
  return true;
}

// The portion of a character that survives across worlds: bio + portrait. Stats are
// per-adventure and deliberately excluded.
function bioFromChar(c) {
  return { name: c.name || "", gender: c.gender || "", race: c.race || "", age: c.age || "", appearance: c.appearance || "", job: c.job || "", persona: c.persona || "", extra: c.extra || "", portrait: c.portrait || "" };
}
function applyBioToChar(c, bio) {
  for (const k of ["name", "gender", "race", "age", "appearance", "job", "persona", "extra"]) c[k] = (bio && bio[k]) ? String(bio[k]) : "";
  if (bio && bio.portrait) c.portrait = bio.portrait;
}

// Ask for a save-slot name (defaults to the hero's name, but editable), confirm overwriting if a
// slot with that name already exists, then persist bio+avatar to the global hero library.
async function promptSaveHero(c) {
  const label = await TextPopup.open({ title: "💾 Save Hero", value: c.name || "", placeholder: "Save name…", rows: 1 });
  if (label === null) return false;
  const lab = label.trim();
  if (!lab) return false;
  const existing = await heroStore.findByLabel(lab);
  if (existing) {
    const ok = await ConfirmPopup.open({ title: "Replace save?", message: `A saved hero named "${esc(lab)}" already exists — replace it?`, confirmText: "Replace", danger: true });
    if (!ok) return false;
  }
  try {
    await heroStore.save(bioFromChar(c), lab, existing ? existing.id : undefined);
  } catch (e) {
    if (isStorageError(e) || (e && e.isStorageUnavailable)) { notifyStorageError(notify, "saving", e); return false; }
    notify("✖ Couldn't save that hero: " + (e.message || e), { ms: 5200 });
    return false;
  }
  notify(`💾 Hero "${lab}" saved`);
  return true;
}

// Saved-hero library popup. Resolves with the picked hero (or null if closed).
function openSavedHeroesPopup() {
  return new Promise(async (resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "cc-overlay";
    overlay.innerHTML = `
      <div class="cc-panel sh-panel" tabindex="-1">
        <div class="cc-head">
          <span class="cc-title">📂 Saved Heroes</span>
          <span class="sh-count" id="shCount"></span>
          <button class="popup-x" title="Close">✕</button>
        </div>
        <div class="sh-body" id="shList"></div>
      </div>`;
    document.body.appendChild(overlay);
    const release = pushBackClose(() => close(null));
    overlay.querySelector(".cc-panel").focus();
    let done = false;
    const close = (v) => { if (done) return; done = true; release(); overlay.remove(); resolve(v); };
    overlay.querySelector(".popup-x").onclick = () => close(null);
    overlay.addEventListener("keydown", (e) => { if (e.key === "Escape") close(null); });
    const listEl = overlay.querySelector("#shList");
    const countEl = overlay.querySelector("#shCount");
    const renderList = async () => {
      const list = await heroStore.list();
      countEl.textContent = list.length ? `${list.length} saved` : "";
      if (!list.length) {
        listEl.innerHTML = `<div class="sh-empty">No saved heroes yet.<br><span class="dim">Save one from the hero wizard — bio and avatar are kept here, shared across all worlds (stats stay per-world).</span></div>`;
        return;
      }
      listEl.innerHTML = list.map((h, i) => {
        const summary = [h.race, h.age, h.job].filter(Boolean).join(" · ");
        return `<div class="sh-card">
          <div class="sh-thumb">${portraitHtml(h, 52)}</div>
          <div class="sh-main">
            <span class="sh-name">${esc(h.label || h.name || "Unnamed")}</span>
            ${summary ? `<span class="sh-sum">${esc(summary)}</span>` : ""}
            <span class="sh-when">Saved ${fmtWhen(h.savedAt)}</span>
          </div>
          <button class="mini ok sh-load" data-i="${i}">Load</button>
          <button class="mini warn sh-del" data-i="${i}" title="Delete">✖</button>
        </div>`;
      }).join("");
      listEl.querySelectorAll(".sh-load").forEach((b) => (b.onclick = async () => {
        const l = await heroStore.list();
        const h = l[Number(b.dataset.i)];
        if (h) close(h);
      }));
      listEl.querySelectorAll(".sh-del").forEach((b) => (b.onclick = async () => {
        const l = await heroStore.list();
        const h = l[Number(b.dataset.i)];
        if (!h) return;
        const ok = await ConfirmPopup.open({ title: "Delete hero", message: `Delete "${h.label || h.name || "Unnamed"}"? This cannot be undone.`, confirmText: "Delete", danger: true });
        if (!ok) return;
        await heroStore.remove(h.id);
        renderList();
      }));
    };
    renderList();
  });
}

// The label beside a hero stat (hero panel + creation wizard): the whole label opens the
// shared info-tip (tap on mobile, hover on desktop), marked only by a faint ⓘ. Carries the
// world's `hint` plus the live skill-check modifier. Plain text when there is nothing beyond
// the label itself to say. `rules` is deliberately never shown — it is GM-only context.
function statInfoTip(d, val) {
  const mod = checkMod(val, statCfg);
  const modTxt = mod === 0 ? "" : `${mod >= 0 ? "+" : ""}${mod} to rolls`;
  const body = d.hint ? (modTxt ? `${d.hint} (${modTxt})` : d.hint) : modTxt;
  return infoTipLabelHtml(d.label || d.key, body);
}

// Full-screen 3-step wizard (Bio → Avatar → Stats) shown when a brand-new adventure begins, before
// the first message is generated. `s` is the new (already-saved) session being forged; `onDone`
// runs once the player finalizes; `onCancel` runs if they back out (session is deleted).
function openCharacterCreation(s, onDone, onCancel) {
  const c = s.character;
  const overlay = document.createElement("div");
  overlay.className = "cc-overlay";
  const renderBio = () => {
    const cell = ([k, label, type, ph, rows]) => {
      const val = esc(c[k] ?? "");
      const tag = type === "textarea"
        ? `<textarea class="popup-ta" id="cc_${k}" rows="${rows}" placeholder="${esc(ph)}">${val}</textarea>`
        : `<input class="popup-in" id="cc_${k}" placeholder="${esc(ph)}" value="${val}" autocomplete="off">`;
      return `<div class="cc-field"><label for="cc_${k}">${label}</label>${tag}</div>`;
    };
    // Runs of `half` fields pair up into a two-column row; full-width fields get their own line.
    let html = "";
    let half = [];
    const flush = () => { if (half.length) { html += `<div class="cc-row2">${half.map(cell).join("")}</div>`; half = []; } };
    for (const f of CC_BIO_FIELDS) { if (f[5]) half.push(f); else { flush(); html += cell(f); } }
    flush();
    overlay.querySelector("#ccFields").innerHTML = html;
  };
  overlay.innerHTML = `
    <div class="cc-panel cc-wizard" tabindex="-1">
      <div class="ce-hdr cc-hdr">
        <span class="ce-ic" aria-hidden="true"></span>
        <div class="ce-head">
          <span class="ce-title">Forge Your Hero</span>
          <button class="popup-x cc-cancel" type="button" title="Cancel" aria-label="Cancel">✕</button>
        </div>
        <div class="ce-sub"><span class="cc-world">${esc(s.worldName || worldNameForId(s.worldId))}</span></div>
        <div class="ce-tabs-wrap">
          <div class="ce-tabs" role="tablist" aria-label="Hero creation steps">
            <button class="ce-tab on" role="tab" aria-selected="true" data-st="0" type="button">Bio</button>
            <button class="ce-tab" role="tab" aria-selected="false" data-st="1" type="button">Avatar</button>
            <button class="ce-tab" role="tab" aria-selected="false" data-st="2" type="button">Stats</button>
            <button class="ce-tab" role="tab" aria-selected="false" data-st="3" type="button">Review</button>
          </div>
        </div>
      </div>
      <div class="cc-body">
        <div class="cc-view" data-view="0">
          <p class="cc-hint">Who are you in this world? You can go back and change any of this before finalizing — the GM only sees what you fill in. Save a hero to reuse their bio &amp; avatar in any world.</p>
          <div class="cc-tools">
            <button class="btn" id="ccRandomPlain" title="Fill in a random hero using this world's genre — no AI needed">🎲 Randomize</button>
            <button class="btn" id="ccGenBio" title="Let the AI write a whole new hero for this world — name and all">✨ Generate</button>
            <button class="btn" id="ccSaveHero">💾 Save Hero</button>
            <button class="btn" id="ccLoadHero">📂 Load Hero</button>
          </div>
          <div class="cc-genwrap" id="ccGenWrap" hidden>
            <div class="cc-field"><label for="ccGenDir">Direction for the AI</label>
            <textarea class="popup-ta" id="ccGenDir" rows="3" placeholder="e.g. A retired pirate-turned-baker haunted by his past… (blank = surprise me)"></textarea></div>
            <div class="cc-genbar"><button class="btn ok" id="ccGenRun" type="button">✨ Generate Hero</button><span class="cc-genstatus dim" id="ccGenStatus"></span></div>
          </div>
          <div class="cc-fields" id="ccFields"></div>
        </div>
        <div class="cc-view" data-view="1" hidden>
          <p class="cc-hint">Generate an avatar from your bio, or upload your own image. Generate as many times as you like — every result is kept below so you can pick your favorite.</p>
          <div class="cc-av-wrap">${portraitHtml(c, 240)}</div>
          <div class="cc-av-acts">
            <button class="btn ok cc-genav" id="ccGenAv">✨ Generate Avatar</button>
            <button class="btn cc-upav" id="ccUpAv">⬆ Upload Image</button>
          </div>
          <div class="cc-avhist" id="ccAvHist" hidden></div>
        </div>
        <div class="cc-view" data-view="2" hidden>
          <p class="cc-hint" id="ccStatsHint">Allocate <b>${ccBudget}</b> starting points across your stats. Reduce one stat (min ${ccFloor}${ccCeiling !== undefined ? `, max ${ccCeiling}` : ""}) to free points for another — nothing is final until you begin.</p>
          <div class="cc-ptrow" id="ccPtRow">
            <span class="cc-pts" id="ccPts"></span>
            <span class="cc-ptbtns">
              <button class="mini" id="ccResetStats" type="button" title="Restore every stat to its starting value">↺ Reset</button>
              <button class="mini" id="ccRollStats" type="button" title="Randomly distribute your points (raises some stats, lowers others)">🎲 Randomize</button>
            </span>
          </div>
          <div class="cc-stats" id="ccStats"></div>
        </div>
        <div class="cc-view" data-view="3" hidden>
          <p class="cc-hint">Look your hero over before you begin. Anything can still be changed — jump back to a step, or begin when they're ready.</p>
          <div id="ccReview"></div>
        </div>
      </div>
      <div class="cc-foot">
        <button class="mini cc-prev" hidden>← Previous</button>
        <span class="cc-err" id="ccErr"></span>
        <button class="mini ok cc-next">Next →</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const release = pushBackClose(() => cancel());
  const cancel = () => { clearDraft(); release(); overlay.remove(); onCancel(); };
  renderBio();
  overlay.querySelector(".cc-panel").focus(); // so Escape (keydown) bubbles to the overlay handler reliably

  const ccStats = { ...c.stats };
  let ccRemaining = ccBudget;
  let step = 0;

  /* ---------- wizard draft autosave ---------- */
  // An unfinished hero survives refreshes, crashes, and accidental closes: bio +
  // portrait + point-buy state persist per world under `wizard-draft:<worldId>`.
  // Explicit cancel or a successful Begin deletes it (cancel = deliberate discard).
  // Avatar *history* stays in-memory only — past portraits are data URLs and would
  // bloat the draft several times over; the current one is all a restore needs.
  const ccDraftKey = `wizard-draft:${s.worldId}`;
  const ccDraftKv = () => { try { return window.kv && window.kv.rpg; } catch (e) { return null; } };
  // A "real" portrait is a data:/http:/blob: URL (generated or uploaded). The stock
  // placeholder path (or empty) doesn't count — otherwise every fresh wizard would
  // look "touched" and its empty state would overwrite a saved draft on open.
  const ccIsImg = (u) => /^(data:|https?:|blob:)/i.test(u || "");
  let ccDraftTimer = 0;
  function saveDraft() {
    try {
      readBio();
      const bio = Object.fromEntries(CC_BIO_FIELDS.map(([k]) => [k, c[k] ?? ""]));
      const touched = Object.values(bio).some((v) => (v || "").trim()) || ccIsImg(c.portrait) || ccRemaining !== ccBudget;
      const f = ccDraftKv();
      if (!touched || !f) return;
      f.set(ccDraftKey, { bio, portrait: c.portrait || "", ccStats: { ...ccStats }, ccRemaining, savedAt: Date.now() }).catch(() => {});
    } catch (e) {}
  }
  function saveDraftSoon() { clearTimeout(ccDraftTimer); ccDraftTimer = setTimeout(saveDraft, 800); }
  function clearDraft() { try { const f = ccDraftKv(); if (f) f.delete(ccDraftKey).catch(() => {}); } catch (e) {} }
  async function restoreDraft() {
    try {
      const f = ccDraftKv();
      if (!f) return;
      const d = await f.get(ccDraftKey);
      if (!d || typeof d !== "object") return;
      if (d.savedAt && Date.now() - d.savedAt > 30 * 24 * 3600 * 1000) { f.delete(ccDraftKey).catch(() => {}); return; }
      const has = (d.bio && Object.values(d.bio).some((v) => (v || "").trim())) || ccIsImg(d.portrait) || (d.ccStats && Object.keys(d.ccStats).length);
      if (!has) return;
      if (d.bio) for (const [k] of CC_BIO_FIELDS) if (d.bio[k] != null) c[k] = d.bio[k];
      if (d.portrait) c.portrait = d.portrait;
      if (d.ccStats) for (const k of Object.keys(d.ccStats)) ccStats[k] = d.ccStats[k];
      if (typeof d.ccRemaining === "number") ccRemaining = Math.max(0, Math.min(d.ccRemaining, ccBudget));
      renderBio();
      overlay.querySelector(".cc-av-wrap").innerHTML = portraitHtml(c, 240);
      noteAvatar(c.portrait);
      renderStats();
      notify("📝 Restored your unfinished hero draft.");
    } catch (e) {}
  }

  /* ---------- avatar history ---------- */
  // Every generated/uploaded/loaded portrait is kept (newest first, max 8) as
  // selectable thumbnails, so regenerating never destroys a result you preferred.
  // The strip always shows at least the current portrait — even the stock
  // placeholder, which renders as a real <img> here (portraitHtml would show its
  // path as text, which is only sensible in the large main view).
  let ccAvHistory = [];
  function noteAvatar(url) {
    if (!url || ccAvHistory[0] === url) { renderAvHist(); return; }
    ccAvHistory = [url, ...ccAvHistory.filter((u) => u !== url)].slice(0, 8);
    renderAvHist();
  }
  function setPortrait(url) {
    c.portrait = url;
    overlay.querySelector(".cc-av-wrap").innerHTML = portraitHtml(c, 240);
    noteAvatar(url);
    saveDraft();
  }
  function renderAvHist() {
    const el = overlay.querySelector("#ccAvHist");
    if (!el) return;
    if (!ccAvHistory.length) { el.hidden = true; el.innerHTML = ""; return; }
    el.hidden = false;
    // Every entry is a displayable image (generated/uploaded data URLs, remote URLs,
    // or the stock placeholder path), so thumbs render their own <img> with no fixed
    // pixel size — the grid, not inline styles, decides their width.
    el.innerHTML = `<span class="cc-avhist-label">History — Tap to reuse</span><span class="cc-avgrid">` + ccAvHistory.map((u, i) =>
      `<button type="button" class="cc-avpick${u === c.portrait ? " on" : ""}" data-i="${i}" title="Use this avatar" aria-label="Use avatar ${i + 1}"><img class="cc-avthumb" src="${esc(u)}" alt=""></button>`
    ).join("") + `</span>`;
    el.querySelectorAll(".cc-avpick").forEach((b) => (b.onclick = () => setPortrait(ccAvHistory[Number(b.dataset.i)])));
  }

  /* ---------- review step ---------- */
  // A last look before the adventure starts: identity, filled-in bio, and final
  // stats with roll modifiers. Warnings (no name, unspent points) are advisory —
  // Begin stays available, matching the existing tab-jump behavior.
  function renderReview() {
    readBio();
    const filled = CC_BIO_FIELDS.filter(([k]) => ((c[k] || "").trim()));
    const warn = [];
    if (!((c.name || "").trim())) warn.push("Your hero has no name yet — add one in the Bio step.");
    if (ccRemaining > 0 && statDefs.length) warn.push(`${ccRemaining} starting point${ccRemaining === 1 ? "" : "s"} still unspent — spend ${ccRemaining === 1 ? "it" : "them"} in Stats, or begin anyway.`);
    const stats = statDefs.map((d) => {
      const v = Math.min(clampStat(ccStats[d.key] ?? d.start, d), ccHi(d));
      const mod = checkMod(v, statCfg);
      return `<div class="cc-rev-stat"><span>${esc(d.label || d.key)}</span><b class="stat-val ${valClass(v)}">${v}${mod ? ` <span class="dim">(${mod > 0 ? "+" : ""}${mod})</span>` : ""}</b></div>`;
    }).join("");
    overlay.querySelector("#ccReview").innerHTML = `
      <div class="cc-rev-head">${portraitHtml(c, 88)}
        <div><div class="cc-rev-name">${esc(c.name || "Unnamed hero")}</div>
        <div class="cc-rev-job">${esc([c.job, [c.race, c.age].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || "—")}</div></div>
      </div>
      ${filled.length ? `<div class="cc-rev-sec">Bio</div>` + filled.map(([k, label]) => `<div class="cc-rev-row"><span>${esc(label)}</span><span>${esc(c[k])}</span></div>`).join("") : ""}
      ${statDefs.length ? `<div class="cc-rev-sec">Stats</div><div class="cc-rev-stats">${stats}</div>` : ""}
      ${warn.map((w) => `<div class="cc-rev-warn">⚠ ${esc(w)}</div>`).join("")}`;
  }

  const showErr = (m) => { overlay.querySelector("#ccErr").textContent = m || ""; };
  // The wizard's world (for genre detection in the non-AI randomizer) — fetched once, on first use.
  let ccWorld = null, ccWorldLoaded = false;
  const wizardWorld = async () => {
    if (ccWorldLoaded) return ccWorld;
    ccWorldLoaded = true;
    try { ccWorld = await loadWorldById(s.worldId); } catch (e) { console.warn("[wizard] World lookup failed:", e); ccWorld = null; }
    return ccWorld;
  };
  const readBio = () => { for (const [k] of CC_BIO_FIELDS) c[k] = $(`cc_${k}`).value.trim(); };
  const valClass = (val) => statTier(val, { averageThreshold: statAvgT, exceptionalThreshold: statExcT });
  // Highest a starting stat may reach in the wizard: the stat's own `max` (when it has one) and
  // the world-wide creation ceiling (when the world sets one) — whichever is lower.
  const ccHi = (d) => Math.min(d.max !== undefined ? d.max : Infinity, ccCeiling !== undefined ? ccCeiling : Infinity);

  function renderStats() {
    const hasStats = statDefs.length > 0;
    overlay.querySelector("#ccStatsHint").hidden = !hasStats;
    overlay.querySelector("#ccPtRow").hidden = !hasStats;
    if (!hasStats) {
      overlay.querySelector("#ccStats").innerHTML = `<div class="cc-empty">This world doesn't have any stats.<br>Your hero needs no attribute allocation — just begin your adventure.</div>`;
      return;
    }
    const rows = statDefs.map((d) => {
      const val = Math.min(ccStats[d.key] ?? clampStat(c.stats[d.key], d), ccHi(d));
      const atMax = val >= ccHi(d);
      const atFloor = val <= ccFloor;
      return `<div class="statrow">
        ${statInfoTip(d, val)}
        <span class="stat-ctrl">
          <button type="button" class="mini stat-dec" data-k="${esc(d.key)}" ${atFloor ? "disabled" : ""} title="Reduce (refunds a point)">−</button>
          <span class="stat-val ${valClass(val)}">${val}</span>
          <button type="button" class="mini ok stat-inc" data-k="${esc(d.key)}" ${(atMax || ccRemaining <= 0) ? "disabled" : ""} title="Increase (spends a point)">+</button>
        </span>
      </div>`;
    }).join("");
    overlay.querySelector("#ccStats").innerHTML = rows;
    overlay.querySelector("#ccPts").innerHTML = `Points to spend: <b>${ccRemaining}</b>`;
    overlay.querySelectorAll("#ccStats .stat-inc").forEach((b) => (b.onclick = () => bump(b.dataset.k, +1)));
    overlay.querySelectorAll("#ccStats .stat-dec").forEach((b) => (b.onclick = () => bump(b.dataset.k, -1)));
    saveDraft();
  }

  function bump(key, delta) {
    const d = statDefs.find((x) => x.key === key);
    if (!d) return;
    const cur = clampStat(ccStats[key], d);
    if (delta > 0) {
      if (ccRemaining <= 0 || cur >= ccHi(d)) return;
      ccStats[key] = cur + 1;
      ccRemaining--;
    } else {
      if (cur <= ccFloor) return;
      ccStats[key] = cur - 1;
      ccRemaining++;
    }
    renderStats();
  }

  // Restore every stat to its starting value and refund the whole budget.
  function resetStats() {
    if (!statDefs.length) return;
    for (const d of statDefs) ccStats[d.key] = clampStat(d.start, d);
    ccRemaining = ccBudget;
    renderStats();
  }

  // Randomly distribute the point-buy pool: reset every stat to its starting value, then lower a
  // random selection of stats (down to ccFloor, freeing points) before raising random stats (up to
  // each `max`) until the whole budget is spent. Because each decrement frees exactly one more point
  // of headroom, the pool can always be fully spent as long as the total `max` headroom ≥ ccBudget.
  function randomizeStats() {
    if (!statDefs.length) return;
    const cur = (d) => clampStat(ccStats[d.key], d);
    const hi = (d) => ccHi(d);

    for (const d of statDefs) ccStats[d.key] = clampStat(d.start, d);

    // Give some stats up (never below the floor) so others can rise above their starting values.
    const decreasePotential = statDefs.reduce((s, d) => s + Math.max(0, cur(d) - ccFloor), 0);
    let decreases = Math.floor(Math.random() * (decreasePotential + 1));
    while (decreases > 0) {
      const cands = statDefs.filter((d) => cur(d) > ccFloor);
      if (!cands.length) break;
      const d = cands[Math.floor(Math.random() * cands.length)];
      ccStats[d.key] = cur(d) - 1;
      decreases--;
    }

    // Spend the whole budget (ccBudget + whatever we freed) on random stats that have headroom.
    let remaining = ccBudget - statDefs.reduce((s, d) => s + (cur(d) - clampStat(d.start, d)), 0);
    let guard = 0;
    while (remaining > 0 && guard++ < 100000) {
      const cands = statDefs.filter((d) => cur(d) < hi(d));
      if (!cands.length) break;
      const d = cands[Math.floor(Math.random() * cands.length)];
      ccStats[d.key] = cur(d) + 1;
      remaining--;
    }
    ccRemaining = Math.max(0, remaining);
    renderStats();
  }

  function showStep(n) {
    step = n;
    overlay.querySelectorAll(".cc-view").forEach((v, i) => (v.hidden = i !== n));
    overlay.querySelectorAll(".ce-tab").forEach((el, i) => {
      const on = i === n;
      el.classList.toggle("on", on);
      el.setAttribute("aria-selected", on ? "true" : "false");
    });
    overlay.querySelector(".cc-prev").hidden = n === 0;
    const next = overlay.querySelector(".cc-next");
    next.textContent = n === 3 ? "⚔ Begin Adventure" : "Next →";
    showErr("");
    if (n === 2) renderStats();
    if (n === 3) renderReview();
    saveDraft();
  }

  function finalize() {
    readBio();
    for (const d of statDefs) ccStats[d.key] = Math.min(clampStat(ccStats[d.key] ?? d.start, d), ccHi(d));
    c.stats = ensureStats(ccStats, statDefs);
    c.statPoints = 0;
    c.statCommitted = false;
    c.statFloors = { ...c.stats };
    // Recompute the session's starting tracker values now that the hero's FINAL stats are known,
    // so any stat-derived starts/maxs (world trackers `start = = expr` / `max = = expr`) begin correct.
    s.initialTrackers = initialTrackers(trackerDefs, c.stats);
    store.save(s).then(() => {
      clearDraft();
      release();
      overlay.remove();
      onDone();
    }).catch((e) => {
      if (isStorageError(e) || (e && e.isStorageUnavailable)) {
        console.warn("[wizard] save failed (storage unavailable):", (e && e.message) || e);
        notifyStorageError(notify, "saving", e);
        // Still finish the wizard — the session is in memory and playable.
        try { clearDraft(); release(); overlay.remove(); onDone(); } catch (finishErr) {}
      } else { console.error("[wizard] save failed:", e); notify("✖ Couldn't save that hero: " + (e.message || e), { ms: 5200 }); }
    });
  }

  overlay.querySelector(".cc-next").onclick = () => {
    if (step === 0) readBio();
    if (step === 3) {
      readBio();
      if (!((c.name || "").trim())) { showStep(0); showErr("Give your hero a name to begin."); return; }
      finalize();
      return;
    }
    showStep(step + 1);
  };
  overlay.querySelector(".cc-prev").onclick = () => showStep(step - 1);
  overlay.querySelectorAll(".ce-tab").forEach((t) => (t.onclick = () => showStep(Number(t.dataset.st))));
  overlay.querySelector(".cc-cancel").onclick = cancel;
  overlay.querySelector("#ccRandomPlain").onclick = async () => {
    readBio();
    showErr("");
    const { rollBio } = await bioWordsModule();
    rollBio(c, await wizardWorld());
    renderBio();
    saveDraft();
  };
  // ✨ Generate toggles an inline direction box (same pattern as the world editor's
  // NPC generator) — the run button inside it feeds the textarea to the AI.
  overlay.querySelector("#ccGenBio").onclick = () => {
    const wrap = overlay.querySelector("#ccGenWrap");
    wrap.hidden = !wrap.hidden;
    if (!wrap.hidden) overlay.querySelector("#ccGenDir").focus();
  };
  overlay.querySelector("#ccGenRun").onclick = async () => {
    readBio();
    const btn = overlay.querySelector("#ccGenRun");
    const status = overlay.querySelector("#ccGenStatus");
    const dir = overlay.querySelector("#ccGenDir").value.trim();
    setBusy(btn, "Generating…");
    status.textContent = dir ? "Dreaming up your hero…" : "Dreaming up a hero…";
    showErr("");
    try {
      await randomizeBioWithAI(c, dir);
      renderBio();
      saveDraft();
      status.textContent = "Done — tweak the direction and run it again, or keep what you like.";
    } catch (e) {
      console.error("Bio randomization failed:", e);
      status.textContent = "";
      showErr("⚠ Couldn't generate the hero — try again.");
    } finally {
      clearBusy(btn);
    }
  };
  overlay.querySelector("#ccResetStats").onclick = () => resetStats();
  overlay.querySelector("#ccRollStats").onclick = () => randomizeStats();
  overlay.querySelector("#ccSaveHero").onclick = async () => {
    readBio();
    showErr("");
    saveDraft();
    await promptSaveHero(c);
  };
  overlay.querySelector("#ccLoadHero").onclick = async () => {
    const h = await openSavedHeroesPopup();
    if (!h) return;
    applyBioToChar(c, h);
    renderBio();
    setPortrait(c.portrait);
    showErr("");
    notify(`📂 Loaded "${h.label || h.name || "hero"}"`);
  };
  overlay.querySelector("#ccGenAv").onclick = async () => {
    readBio();
    const btn = overlay.querySelector("#ccGenAv");
    setBusy(btn, "Generating…");
    showErr("");
    try {
      const ok = await genHeroPortrait(c, s);
      if (!ok) throw new Error("no dataUrl");
      setPortrait(c.portrait);
    } catch (e) {
      console.error("Avatar generation failed:", e);
      showErr("⚠ Couldn't generate an avatar — try again.");
    } finally {
      clearBusy(btn);
    }
  };
  overlay.querySelector("#ccUpAv").onclick = async () => {
    showErr("");
    const ok = await uploadAvatarTo(c, "portrait");
    if (!ok) return;
    setPortrait(c.portrait);
  };
  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cancel();
  });
  // Typing in any bio field autosaves (debounced) — a refresh mid-sentence loses nothing.
  overlay.querySelector("#ccFields").addEventListener("input", saveDraftSoon);
  showStep(0);
  noteAvatar(c.portrait);
  restoreDraft();
}

function renderCharacterPanel(body) {
  const c = state.character;
  const pts = typeof c.statPoints === "number" ? c.statPoints : 0;
  const curTrk = currentTrackers();
  const floors = (c.statFloors && typeof c.statFloors === "object") ? c.statFloors : {};
  // A "level-up window" is open while there are unspent points OR an un-committed allocation
  // (any stat sitting above its baseline). Nothing is ever locked until Save is pressed.
  const windowOpen = levelUpWindowOpen();

  // Level + exp, combined into one bar below the name. Level is a plain number chip elsewhere;
  // here it sits beside a full-width exp progress bar. Both trackers are resolved by key OR label
  // (levelTracker / expTracker), so a world that calls them lvl / xp still drives the bar.
  const lvlDef = levelTracker(trackerDefs);
  // The tracker strip (level/exp bar + the other hero-shown trackers) is built by
  // heroTrackerRowsHtml so render() can repaint it in place when a chat-side tracker update lands.
  const heroRows = heroTrackerRowsHtml(curTrk);
  const statusHtml = `<div class="trkrow hstat" id="heroTrkRow" style="justify-content:flex-start"${heroRows.length ? "" : " hidden"}>${heroRows.join("")}</div>`;

  // Stats are read-only during play. A level-up grants points that open a spend window (−/+
  // appear). Nothing locks until Save: Save re-baselines each stat to its current value, so the
  // spent allocation can no longer be refunded — but any remaining points stay spendable and
  // movable until the next Save. `hint` shows through the ⓘ info-tip beside the label (same
  // convention as trackers); `rules` is only ever for the GM (CHARACTER SHEET context),
  // never shown in the UI.
  const statsHtml = statDefs.map((d) => {
    const val = clampStat(c.stats[d.key], d);
    const atMax = d.max !== undefined && val >= d.max;
    const floor = typeof floors[d.key] === "number" ? floors[d.key] : 0;
    const canDec = val > floor && val > 0;
    const vc = statTier(val, { averageThreshold: statAvgT, exceptionalThreshold: statExcT });
    const ctrl = windowOpen
      ? `<button type="button" class="mini stat-dec" data-k="${esc(d.key)}" ${canDec ? "" : "disabled"} title="Refund a point">−</button>
         <span class="stat-val ${vc}">${val}</span>
         <button type="button" class="mini ok stat-inc" data-k="${esc(d.key)}" ${(atMax || pts <= 0) ? "disabled" : ""} title="Spend a point">+</button>`
      : `<span class="stat-val ${vc}">${val}</span>`;
    return `<div class="statrow">
      ${statInfoTip(d, val)}
      <span class="stat-ctrl">${ctrl}</span>
    </div>`;
  }).join("");
  // Stat-points banner follows the level tracker's icon (so if the dev changes the level icon in
  // the world's trackers, this banner follows) — falls back to a diamond ◆ if the level tracker has no icon.
  const ptsIcon = (lvlDef && lvlDef.icon) ? lvlDef.icon : "◆";
  const banner = windowOpen
    ? `<div class="pts-avail has">${esc(ptsIcon)} available stat points: <b>${pts}</b> — spend them below (＋), refund with −; Save locks your allocation</div>`
    : `<div class="pts-avail">${esc(ptsIcon)} available stat points: <b>${pts}</b></div>`;
  // Save appears only while a level-up window is open (points to allocate or an allocation to lock).
  const showSave = windowOpen;

  // Hero panel tab key stays "bio" (and the NPC popup's keys stay "profile"/"memory"); only the
  // visible label changed to "Profile" so the hero panel matches the NPC popup's Profile tab.
  // Bio fields render like the NPC profile: short fields as compact label/value rows, then the
  // paragraph fields as prose blocks beneath them (the shared `bioLayoutHtml`), each with a ✎ edit
  // icon (TextPopup on click). Same for the name, shown prominently at the top.
  const bioFields = [
    ["cAge", "age", "Age", 1],
    ["cGender", "gender", "Gender", 1],
    ["cRace", "race", "Race", 1],
    ["cAppearance", "appearance", "Appearance", 4],
    ["cJob", "job", "Job", 1],
    ["cPersona", "persona", "Persona", 4],
    ["cExtra", "extra", "Extra details", 4]
  ];
  const bioHtml = bioLayoutHtml(bioFields.map(([, k, label]) => [k, label]), (k) => c[k], "k");

  // Worlds without stats have no Stats tab — the tab bar shows Profile alone.
  const hasStats = statDefs.length > 0;
  const activeTab = hasStats ? heroTab : "bio";
  body.innerHTML = `
    <div class="hero-avatar">${portraitHtml(c, 150)}</div>
    <div class="hero-name">
      <span class="hero-name-v">${esc(c.name) || "Unnamed"}</span>
      <button type="button" class="npc-edit hero-name-edit" title="Edit name">✎</button>
    </div>
    ${statusHtml}
    <div class="hero-tabs">
      ${hasStats ? `<button type="button" class="seg-btn${activeTab === "stats" ? " on" : ""}${windowOpen ? " lvl-open" : ""}" data-htab="stats">Stats</button>` : ""}
      <button type="button" class="seg-btn${activeTab === "bio" ? " on" : ""}" data-htab="bio">Profile</button>
    </div>
    ${hasStats ? `<div class="hero-tab-body" data-tab="stats" ${activeTab === "stats" ? "" : "hidden"}>
      ${banner}${statsHtml}
      ${showSave ? `<button class="btn ok" id="cSave">Save</button>` : ""}
    </div>` : ""}
    <div class="hero-tab-body" data-tab="bio" ${activeTab === "bio" ? "" : "hidden"}>
      ${bioHtml}
      <div class="hero-av-acts">
        <button class="btn hero-regen" id="cRegenAvatar">⟳ Regenerate avatar</button>
        <button class="btn hero-upload" id="cUploadAvatar">⬆ Upload image</button>
      </div>
    </div>`;

  body.querySelector(".hero-name-edit").onclick = async () => {
    const nv = await TextPopup.open({ title: "Edit name", value: c.name, placeholder: "Hero name", rows: 1, note: "Not recommended mid-session — the story and saved references use this name, and renaming can break the game." });
    if (nv !== null && nv.trim()) {
      c.name = nv.trim();
      store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
      renderCharacterPanel(body);
    }
  };
  for (const [id, k, label, rows] of bioFields) {
    body.querySelector(`.npc-field[data-k="${k}"] .npc-edit`).onclick = async () => {
      const nv = await TextPopup.open({ title: "Edit " + label, value: c[k] ?? "", placeholder: label + "...", rows });
      if (nv !== null) {
        c[k] = nv.trim();
        store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
        renderCharacterPanel(body);
      }
    };
  }
  body.querySelectorAll(".hero-tabs .seg-btn").forEach((b) => (b.onclick = () => {
    heroTab = b.dataset.htab;
    renderCharacterPanel(body);
  }));
  if (showSave) {
    body.querySelector("#cSave").onclick = () => {
      c.statFloors = { ...c.stats }; // lock the current allocation — refunds can't dip below this
      c.statCommitted = true;
      store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
      notify("🛡 Allocation saved");
      renderCharacterPanel(body);
    };
  }
  body.querySelectorAll(".stat-inc").forEach((b) => (b.onclick = () => spendStat(body, c, b.dataset.k, +1)));
  body.querySelectorAll(".stat-dec").forEach((b) => (b.onclick = () => spendStat(body, c, b.dataset.k, -1)));
  const regen = body.querySelector("#cRegenAvatar");
  if (regen) regen.onclick = async () => {
    const st = state;
    setBusy(regen, "Generating…");
    try {
      const ok = await genHeroPortrait();
      if (!ok) notify("⚠ Couldn't generate avatar — try again.");
    } catch (e) {
      console.error("Hero portrait generation failed:", e);
      notify("⚠ Couldn't generate avatar — try again.");
    } finally {
      clearBusy(regen);
    }
    if (state === st) {
      store.save(st).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
      renderCharacterPanel(body);
      render(); // refresh chat bubbles that show the hero's portrait
      refreshRailIfOpen("right");
    }
  };
  const upAv = body.querySelector("#cUploadAvatar");
  if (upAv) upAv.onclick = async () => {
    const ok = await uploadAvatarTo(c, "portrait");
    if (!ok) return;
    store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
    renderCharacterPanel(body);
    render(); // refresh chat bubbles that show the hero's portrait
    refreshRailIfOpen("right");
  };
  updateLvlIndicators();
}

// +/− stat buttons: spend a level-up point (＋) or refund one (−). − can never drop a stat
// below its `statFloor` (its value when this level-up window opened, or at the last Save).
// Spending/refunding mutates the character and persists immediately; the panel's Save button
// locks the current allocation (re-baselines the floors) so it can't be refunded afterward.
function spendStat(body, c, key, delta) {
  const d = statDefs.find((x) => x.key === key);
  if (!d) return;
  const cur = clampStat(c.stats[key], d);
  if (delta > 0) {
    if (c.statPoints <= 0 || (d.max !== undefined && cur >= d.max)) return;
    c.stats[key] = cur + 1;
    c.statPoints--;
  } else {
    const floors = (c.statFloors && typeof c.statFloors === "object") ? c.statFloors : {};
    const floor = typeof floors[key] === "number" ? floors[key] : 0;
    if (cur <= 0 || cur <= floor) return; // can't drop below the current window's baseline
    c.stats[key] = cur - 1;
    c.statPoints++;
  }
  store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); }); // persist the working allocation — a reload must not lose spent points
  renderCharacterPanel(body);
}
const clampNum = (v, d, lo = 1, hi = 10) => { const n = parseInt(v, 10); return Number.isNaN(n) ? d : Math.max(lo, Math.min(hi, n)); };

/* ---------- settings panel ---------- */
// Display toggles (tracker chips, inner thoughts) change transcript height on every turn, so a
// plain render() would yank the reader: the same pixel scrollTop shows different content after
// chips appear/disappear above the viewport. Pin the first visible turn at its screen offset
// across the rebuild instead. At the bottom render()'s own tail-follow already glues us there.
function renderWithTranscriptAnchor() {
  const t = $("transcriptEl");
  if (!t || !t.isConnected || !state) { render(); return; }
  if (t.scrollTop + t.clientHeight >= t.scrollHeight - AUTO_SCROLL_EPS) { render(); return; }
  const turns = t.querySelectorAll(":scope > .turn");
  const top = t.getBoundingClientRect().top;
  let absIdx = -1, off = 0;
  for (let i = 0; i < turns.length; i++) {
    const r = turns[i].getBoundingClientRect();
    if (r.bottom > top + 1) { absIdx = renderWindowStart + i; off = r.top - top; break; }
  }
  render();
  if (absIdx < 0) return;
  const fresh = t.querySelectorAll(":scope > .turn");
  const ni = absIdx - renderWindowStart;
  if (ni < 0 || ni >= fresh.length) return;
  t.scrollTop += fresh[ni].getBoundingClientRect().top - top - off;
}
function renderSettingsPanel(body) {
  const s = state.settings;
  body.innerHTML = `
    <div class="s-sec">Tools</div>
    <div class="check s-airow"><button class="btn" id="sAiModel" title="Change AI model"><span id="sAiModelName">AI Provider: ${esc(aiModelLabel())}</span></button><button class="btn" id="sImgModel" title="Change image generation provider"><span id="sImgModelName">Image Gen: ${esc(imageModelLabel())}</span></button><button class="btn" id="sPrune" title="Drop all unused re-rolls — keep only the version shown in each turn">🧹 Prune unused re-rolls</button></div>
    <div class="s-sec">Preferences</div>
    <div class="check s-kv">${infoTipLabelHtml("Simulate NPC life", "Off-screen life simulation — unseen NPCs pursue their own mini-goals between turns. When off, they stay frozen (stored goals and memories are kept).")}<span class="s-sw"></span></div>
    <div class="check s-kv">${infoTipLabelHtml("Stat check", "Whether uncertain outcomes are decided with stat rolls.")}<span class="s-sw"></span></div>
    <div class="check s-kv">${infoTipLabelHtml("Show tracker changes", "Tracker change chips under each GM reply. The tracker bar always shows current values.")}<span class="s-sw"></span></div>
    <div class="check s-kv">${infoTipLabelHtml("Show NPC inner thoughts", "Whether NPC inner thoughts show in the story.")}<span class="s-sw"></span></div>`;
  body.querySelector("#sAiModel").onclick = () => openSettingsPanel("aimodel");
  body.querySelector("#sImgModel").onclick = () => openSettingsPanel("imagegen");
  body.querySelector("#sPrune").onclick = () => runPruneCommand();
  // The switch itself carries no tooltip — the label's static info-tip is the single source,
  // on or off. (switchEl only sets a title when titleOn/titleOff are passed.)
  const mkToggle = (box, get, set, anchor = false) => {
    const sw = switchEl({
      on: get,
      set,
      text: get() ? "On" : "Off",
      plain: true,
      onChange: () => {
        sw.setLabel(get() ? "On" : "Off");
        store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
        if (anchor) renderWithTranscriptAnchor();
        else render();
      }
    });
    box.appendChild(sw.el);
  };
  const boxes = body.querySelectorAll(".s-sw");
  mkToggle(boxes[0],
    () => s.simNpcLife !== false,
    (on) => { s.simNpcLife = on; });
  mkToggle(boxes[1],
    () => s.rollChecks !== false,
    (on) => { s.rollChecks = on; });
  mkToggle(boxes[2],
    () => s.showTrackerChanges !== false,
    (on) => { s.showTrackerChanges = on; },
    true);
  mkToggle(boxes[3],
    () => !!s.showInnerThoughts,
    (on) => { s.showInnerThoughts = on; },
    true);
}

/* ---------- NPC panel ---------- */
const NPC_FIELDS = [
  ["age", "Age"],
  ["gender", "Gender"],
  ["race", "Race"],
  ["appearance", "Appearance"],
  ["job", "Job"],
  ["persona", "Persona"],
  ["extra", "Extra details"]
];
// Fields holding a paragraph rather than a short value — the bio layout below gives these a prose
// block instead of a compact label/value row.
const PROSE_FIELDS = ["appearance", "persona", "extra"];

// The bio layout shared by the NPC profile popup and the Hero panel's Profile tab: the short fields as
// compact label/value rows, then the paragraph fields (`PROSE_FIELDS`) below them as prose blocks
// (label + ✎ on one line, value beneath). `fields` is [[key, label], …]; `value(key)` reads the
// current text; `attr` is the dataset attribute the caller's own edit handler reads ("field" for
// NPCs, "k" for the hero). One renderer, so the two bios can never drift apart.
function bioLayoutHtml(fields, value, attr = "field") {
  const cell = ([k, label], prose) => {
    const v = esc(value(k) || "") || "—";
    const edit = `<button class="npc-edit" data-${attr}="${k}" title="Edit ${label}">✎</button>`;
    const head = prose ? `<div class="npc-prose-head"><span class="k">${label}</span>${edit}</div>` : `<span class="k">${label}</span>`;
    return `
      <div class="npc-field${prose ? " npc-field-prose" : ""}" data-${attr}="${k}">
        ${head}
        <span class="v"><span class="v-text">${v}</span></span>${prose ? "" : edit}
      </div>`;
  };
  return fields.filter(([k]) => !PROSE_FIELDS.includes(k)).map((f) => cell(f, false)).join("") +
    fields.filter(([k]) => PROSE_FIELDS.includes(k)).map((f) => cell(f, true)).join("");
}

function portraitHtml(npc, size) {
  const isImg = /^(data:|https?:|blob:)|\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i.test(npc.portrait || "");
  const style = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.47)}px`;
  return isImg
    ? `<img class="npc-portrait" src="${npc.portrait}" alt="" style="${style}">`
    : `<div class="npc-portrait" style="${style}">${esc(npc.portrait || "src/images/portrait-placeholder.webp")}</div>`;
}

function importanceTag(npc) {
  if (npc.importance === "high") return `<span class="npc-imp high npc-cast" title="World's cast NPC"><span class="w-ic" aria-hidden="true"></span></span>`;
  if (npc.importance === "medium") return `<span class="npc-gen-sq" title="Generated NPC"></span>`;
  return "";
}

// Last-seen line for the popup + roster sort helper. lastSeen/firstSeen of -1 means "no visible
// appearance in the shown transcript" (edited/deleted/rerolled away) — never present via recency,
// sorts last, displays as "not in shown story".
function npcSeenLine(npc) {
  const first = npc.firstSeenTurn;
  const last = npc.lastSeenTurn;
  if ((first != null && first < 0) || (last != null && last < 0)) {
    return `Not in the shown story`;
  }
  const ago = Math.max(0, (state.turn || 0) - (last || 0));
  return `First seen turn ${first || 0} · last seen ${ago} turn${ago === 1 ? "" : "s"} ago`;
}

function renderNpcPanel(body) {
  body.innerHTML = "";
  const list = Object.values(state.npcs || {})
    .filter((n) => npcSys.isImportant(n))
    .sort((a, b) => (b.pinned - a.pinned) || ((b.lastSeenTurn ?? 0) - (a.lastSeenTurn ?? 0)));
  const title = `Encounters · ${list.length} NPC${list.length === 1 ? "" : "s"}`;
  if (!list.length) {
    body.innerHTML = `<div class="p-label">${title}</div>
      <button class="btn npc-add" id="addNpcBtn">➕ Add NPC</button>`;
    body.querySelector("#addNpcBtn").onclick = createNpc;
    return;
  }
  const h = document.createElement("div");
  h.className = "p-sec";
  h.innerHTML = `<div class="p-label">${title}</div>
    <button class="btn npc-add" id="addNpcBtn">➕ Add NPC</button>`;
  body.appendChild(h);
  body.querySelector("#addNpcBtn").onclick = createNpc;
  const wrap = document.createElement("div");
  wrap.className = "npclist";
  for (const npc of list) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "npcrow" + (npc.pinned ? " pinned" : "");
    row.innerHTML = `
      <div class="npc-portrait-wrap">${portraitHtml(npc, 48)}</div>
      <span class="npcrow-name">${esc(npc.name)}</span>
      <span class="npcrow-meta">${npc.pinned ? "<span class=\"dim\">📌</span>" : ""}${importanceTag(npc)}</span>
      <span class="npcrow-arrow">›</span>`;
    row.onclick = () => openNpcPopup(npc);
    wrap.appendChild(row);
  }
  body.appendChild(wrap);
}

/* ---------- create NPC from the list ---------- */
function promptNewNpc() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "popup-overlay";
    overlay.innerHTML = `
      <div class="popup">
        <div class="popup-head"><span class="popup-title">➕ New NPC</span><button class="popup-x" title="Close">✕</button></div>
        <div style="padding: 12px 14px; display: flex; flex-direction: column; gap: 10px;">
          <input class="popup-in" id="newNpcName" placeholder="Name (required)" autocomplete="off">
          <textarea class="popup-ta" id="newNpcDesc" rows="3" placeholder="What you know about them — role, looks, how you met (optional)"></textarea>
        </div>
        <div class="popup-acts">
          <button class="mini popup-cancel">Cancel</button>
          <button class="mini ok popup-save">Create</button>
        </div>
      </div>`;
    const nameEl = overlay.querySelector("#newNpcName");
    const descEl = overlay.querySelector("#newNpcDesc");
    const grab = () => ({ name: nameEl.value.trim(), desc: descEl.value.trim() });
    const release = pushBackClose(() => done(null));
    const done = (v) => { release(); overlay.remove(); resolve(v); };
    overlay.querySelector(".popup-x").onclick = () => done(null);
    overlay.querySelector(".popup-cancel").onclick = () => done(null);
    overlay.querySelector(".popup-save").onclick = () => done(grab());
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) done(null); });
    nameEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); done(grab()); }
      else if (e.key === "Escape") done(null);
    });
    descEl.addEventListener("keydown", (e) => { if (e.key === "Escape") done(null); });
    document.body.appendChild(overlay);
    nameEl.focus();
  });
}

async function createNpc() {
  const data = await promptNewNpc();
  if (!data || !data.name) return;
  const name = data.name;
  const dup = state.npcs[name] || npcForSpeaker(name);
  if (dup) {
    notify("⚠ Already catalogued" + (dup.name && dup.name !== name ? " as " + dup.name : "") + ": " + (dup.name || name));
    return;
  }
  state.npcs[name] = {
    name,
    portrait: "src/images/portrait-placeholder.webp",
    description: data.desc,
    details: null,
    importance: "medium",
    appearanceCount: 1,
    firstSeenTurn: state.turn || 0,
    lastSeenTurn: state.turn || 0,
    everSpoke: false,
    pinned: false
  };
  store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
  refreshRailIfOpen("right");
  notify("👤 Created " + name + " — building profile & portrait…");
  const st = state;
  npcSys.ensureProfiled(st.npcs[name], st, () => {
    if (state !== st) return;
    render();
    refreshRailIfOpen("right");
    store.save(st).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
  });
}

/* ---------- NPC memories (profile → Memory tab) ---------- */
// Does one of a memory's owner names match this NPC? Compared against the human owner label
// (hero aliases resolved, public "known to all" owners dropped), with the same token-run leniency
// the GM's roster match uses — so "Orin" still finds an entry owned by "Captain Orin".
function memoryOwnerMatches(owner, nameLower, heroName) {
  return ownerLabel(owner, heroName).split(",").some((part) => {
    const t = part.trim().toLowerCase();
    if (!t || t === "known to all") return false;
    if (t === nameLower) return true;
    const a = t.split(/\s+/);
    const b = nameLower.split(/\s+/);
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    if (!short.some((x) => x.length >= 4)) return false; // never match on a particle/stopword alone
    for (let i = 0; i + short.length <= long.length; i++) {
      let hit = true;
      for (let j = 0; j < short.length; j++) if (short[j] !== long[i + j]) { hit = false; break; }
      if (hit) return true;
    }
    return false;
  });
}

// The memories shown in an NPC's Memory tab: only the entries this NPC is listed as an owner of —
// both auto entries (same ownership filter as the GM's feed) and the player's manual notes, which
// are owner-filtered the same way. A SHORTCUT view only: entries are shared references, never
// moved, copied, or removed from the Memory panel. World facts ("known to all") and the hero's own
// entries are not owned by an NPC; a memory shared with the hero (or another NPC) does show up in
// each owner's tab — add an NPC via ✎ in the Memory panel to include them in a note.
function npcOwnedMemories(npcName) {
  const name = String(npcName || "").trim().toLowerCase();
  const heroName = ((state.character || {}).name || "").trim();
  if (!name) return { manual: [], auto: [] };
  const manual = (state.memories.manual || []).filter((m) => m && memoryOwnerMatches(m.owner, name, heroName))
    .sort((a, b) => ((b.ts || 0) - (a.ts || 0)));
  // Pinned float to the top (like the NPC list), then newest: event turn, then record time.
  const pinnedFirst = (a, b) => (((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)));
  const auto = (state.memories.auto || [])
    .filter((m) => m && memoryOwnerMatches(m.owner, name, heroName))
    .sort((a, b) => pinnedFirst(a, b) || ((b.turn ?? -1) - (a.turn ?? -1)) || ((b.ts || 0) - (a.ts || 0)));
  return { manual, auto };
}

// Renders an NPC's owned memories into `ctn` using the Memory panel's OWN row builders — same markup
// and same controls (pin / on-off switch / ✎ / ✖), so this tab is a working shortcut rather than a
// second, read-only implementation. `refresh` is called after any change that alters the row: the
// list here is just one character's entries, so rebuilding it in place is cheaper and simpler than
// patching individual rows, and it keeps the group dividers and the tab's counter honest when an
// edit moves an entry into or out of what this character owns. Rebuilding only this container (never
// the whole popup) means the portrait isn't re-created on every toggle.
function npcMemRowsInto(ctn, groups, refresh) {
  const { manual, auto } = groups;
  if (!manual.length && !auto.length) {
    ctn.innerHTML = `<div class="dim npc-gen">No memories list this character as an owner yet. Automatic memories that name them — things they saw or told you — show up here, as do your manual notes that include them as an owner.</div>`;
    return;
  }
  const autoOpts = { refresh };
  const manualOpts = { refresh, afterEdit: refresh };
  // No group titles — manual notes sit above a quiet rule, autos below. The rule only
  // shows when both halves exist (a lone group needs no divider).
  const listInto = (rows, listFor) => {
    const list = document.createElement("div");
    list.className = "memlist";
    for (const m of rows) list.appendChild(listFor(m));
    ctn.appendChild(list);
  };
  if (manual.length) listInto(manual, (m) => manualMemRow(m, null, refresh, manualOpts));
  if (manual.length && auto.length) {
    const sep = document.createElement("div");
    sep.className = "npcmem-sep";
    ctn.appendChild(sep);
  }
  if (auto.length) listInto(auto, (m) => autoMemRow(m, null, refresh, autoOpts));
}

/* ---------- NPC private-life debug info (profile → Life tab) ---------- */
// Shared readout for the off-screen life tick (see npc-life.js): why this NPC is
// (or isn't) eligible, what anchor it would be fed, plus the editable life fields.
function npcLifeDebugInfo(npc) {
  const turnNow = (state && state.turn) || 0;
  const ls = npc && typeof npc.lastSeenTurn === "number" ? npc.lastSeenTurn : 0;
  const lt = npc && typeof npc.lifeTick === "number" ? npc.lifeTick : -1;
  const offscreen = ls < 0 ? null : turnNow - ls;
  const d = (npc && npc.details) || {};
  const profiled = Object.values(d).some((v) => String(v == null ? "" : v).trim() && !/^[\s\u2014\u2013\-\u2012\u00b7\u2022_.\u2026]+$/.test(String(v).trim()));
  let eligible = true, reason = "eligible \u2014 picked oldest-simulated-first";
  if (!profiled) { eligible = false; reason = "no profile details yet"; }
  else if (ls < 0) { eligible = false; reason = "not in shown story (edited/rerolled away)"; }
  else if (offscreen < NPC_LIFE_MIN_OFFSCREEN_TURNS) { eligible = false; reason = `seen ${offscreen} turn${offscreen === 1 ? "" : "s"} \u2014 needs \u2265${NPC_LIFE_MIN_OFFSCREEN_TURNS} off-screen`; }
  const since = (lt >= 0 && lt >= ls) ? `simulated at turn ${lt}` : "never simulated since last seen";
  return { turnNow, ls, lt, offscreen, profiled, eligible, reason, since,
    goal: String((npc && npc.lifeGoal) || ""),
    history: (npc && Array.isArray(npc.lifeHistory) ? npc.lifeHistory : []).map((h) => {
      if (h && typeof h === "object") return { goal: String(h.goal == null ? "" : h.goal).trim(), turn: (typeof h.turn === "number" && h.turn >= 0) ? Math.floor(h.turn) : -1 };
      return { goal: String(h == null ? "" : h).trim(), turn: -1 };
    }).filter((h) => h.goal),
    where: String((npc && npc.lifeWhere) || ""),
    globalLast: (state && typeof state.lastNpcLifeTurn === "number") ? state.lastNpcLifeTurn : 0 };
}

/* ---------- NPC private-life (profile → Life tab) ---------- */
// Editable view for the off-screen life tick (see npc-life.js): mini-goal,
// whereabouts and activity history. Edits write straight to the session entry
// (lifeGoal / lifeWhere / lifeHistory) and save — presence fields are never touched.
// Two-field editor for one activity entry: goal text + turn number (blank = undated).
// Only the turn NUMBER is stored per entry (no day/time — those are reconstructed from
// tracker snapshots when the tick builds its time anchor, see npc-life.js snapshotAtTurn).
function lifeActivityPopup(cur, opts = {}) {
  return new Promise((resolve) => {
    const c = (cur && typeof cur === "object") ? cur : { goal: String(cur == null ? "" : cur), turn: -1 };
    const g0 = String(c.goal == null ? "" : c.goal);
    const t0 = (typeof c.turn === "number" && c.turn >= 0) ? Math.floor(c.turn) : "";
    const overlay = document.createElement("div");
    overlay.className = "popup-overlay";
    overlay.innerHTML = `<div class="popup mem-edit">
        <div class="popup-head"><span class="popup-title">${esc(opts.title || "Edit activity")}</span><button class="popup-x" title="Close">✕</button></div>
        <div class="popup-body">
          <label>Activity<textarea class="f-text" rows="2" maxlength="${NPC_LIFE_GOAL_MAX_CHARS}" placeholder="What did they do…">${esc(g0)}</textarea></label>
          <label>Turn (blank = undated)<input class="f-turn" type="number" min="0" step="1" value="${t0}" placeholder="no turn"></label>
        </div>
        <div class="popup-acts">
          <button class="mini popup-cancel">Cancel</button>
          <button class="mini ok popup-save">${esc(opts.confirmText || "Save")}</button>
        </div>
      </div>`;
    const release = pushBackClose(() => done(null));
    const done = (val) => { release(); overlay.remove(); resolve(val); };
    overlay.querySelector(".popup-x").onclick = () => done(null);
    overlay.querySelector(".popup-cancel").onclick = () => done(null);
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) done(null); });
    const textTa = overlay.querySelector(".f-text");
    const turnIn = overlay.querySelector(".f-turn");
    const save = () => {
      const g = String(textTa.value || "").trim().slice(0, NPC_LIFE_GOAL_MAX_CHARS);
      if (!g) { textTa.focus(); return; }
      const tv = String(turnIn.value || "").trim();
      let t = -1;
      if (tv !== "") { const n = Math.floor(Number(tv)); if (Number.isFinite(n) && n >= 0) t = n; }
      done({ goal: g, turn: t });
    };
    overlay.querySelector(".popup-save").onclick = save;
    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") done(null);
      else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save();
    });
    document.body.appendChild(overlay);
    textTa.focus();
    textTa.select();
  });
}

function renderNpcLifeBody(body, npc, popup) {
  const info = npcLifeDebugInfo(npc);
  const row = (k, v) => `<div class="npc-field"><span class="k">${esc(k)}</span><span class="v"><span class="v-text">${v}</span></span></div>`;
  const ago = (t) => (typeof t === "number" && t >= 0 ? `turn ${t}` : "—");
  // Relative age ("3 turns ago") for last-sim stamps — the absolute turn rides
  // in the title attribute so it stays inspectable.
  const agoRel = (t) => {
    if (typeof t !== "number" || t < 0) return "—";
    const diff = Math.max(0, (info.turnNow || 0) - t);
    if (diff <= 0) return "this turn";
    return `${diff} turn${diff === 1 ? "" : "s"} ago`;
  };
  // Debug block is admin-only (same gate as the context meter's prompt text): live in
  // `ctxAdminAuthed`, refreshed from the community module when it loads / admin flips.
  let isAdmin = false;
  try { isAdmin = !!ctxAdminAuthed; } catch (e) {}
  if (!isAdmin) { try { if (communityMod && communityMod.api) isAdmin = !!communityMod.api.isAdmin(); } catch (e) {} }
  // Activity renders newest-first, one row per line — no bullets. The turn rides up front
  // as a left-column tag. The store caps history at NPC_LIFE_HISTORY_MAX, so a full
  // list may have rolled older entries off — the trailing … says so. Each row carries its
  // STORAGE index (data-idx) so edit/delete hit the right entry even when empties exist.
  const rawHist = Array.isArray(npc.lifeHistory) ? npc.lifeHistory : [];
  const rowHtml = [];
  for (let i = rawHist.length - 1; i >= 0; i--) {
    const h = rawHist[i];
    const g = (h && typeof h === "object" ? String(h.goal == null ? "" : h.goal) : String(h == null ? "" : h)).trim();
    if (!g) continue;
    const t = (h && typeof h === "object" && typeof h.turn === "number" && h.turn >= 0) ? Math.floor(h.turn) : -1;
    rowHtml.push(`<div class="npclife-row"><span class="npclife-turn"${t >= 0 ? ` title="turn ${t}"` : ""}>${t >= 0 ? `turn ${t}` : "—"}</span><span class="npclife-txt">${esc(g)}</span><span class="npclife-acts"><button class="npc-edit" data-life="hist-edit" data-idx="${i}" title="Edit this entry">✎</button><button class="npc-edit" data-life="hist-del" data-idx="${i}" title="Delete this entry">✖</button></span></div>`);
  }
  const histRows = rowHtml.length
    ? rowHtml.join("")
      + (info.history.length >= NPC_LIFE_HISTORY_MAX ? `<div class="npclife-more" title="Older activity has rolled off — only the last ${NPC_LIFE_HISTORY_MAX} are kept">…</div>` : "")
    : `<div class="dim">no activity yet</div>`;
  body.innerHTML = `
    <div class="npc-field"><span class="k">Mini-goal</span><span class="v"><span class="v-text">${info.goal ? esc(info.goal) : "—"}</span></span><button class="npc-edit" data-life="goal" title="Edit mini-goal">✎</button></div>
    <div class="npc-field"><span class="k">Whereabouts</span><span class="v"><span class="v-text">${info.where ? esc(info.where) : "unknown"}</span></span><button class="npc-edit" data-life="where" title="Edit whereabouts">✎</button></div>
    <div class="npc-field npclife-activity-field"><span class="k">Activity</span><span class="v"><div class="npclife-hist">${histRows}</div><button class="btn npclife-add" data-life="hist-add">＋ Add activity</button></span></div>
    <div class="npc-field"><span class="k">Last sim</span><span class="v"><span class="v-text"${info.lt >= 0 ? ` title="turn ${info.lt}"` : ""}>${esc(agoRel(info.lt))}</span></span></div>
    ${isAdmin ? `<div class="npclife-debug">
      <div class="p-label">Debug</div>
      ${row("Last seen", ago(info.ls))}
      ${row("Off-screen for", info.offscreen == null ? "—" : esc(String(info.offscreen) + " turn" + (info.offscreen === 1 ? "" : "s")))}
      ${row("Status", esc(info.since + " · " + info.reason))}
      ${row("Tick", esc(`every ${NPC_LIFE_EVERY_TURNS} turns · max ${NPC_LIFE_MAX_PER_TICK} NPCs · global last ${agoRel(info.globalLast)}`))}
      <div class="npcpop-actions">
        <button class="btn npclife-run">▶ Run life tick now</button>
      </div>
      <div class="dim npclife-note">Runs the real tick for every eligible NPC (not just this one), then saves. Presence fields are never touched.</div>
      <details class="npclife-prompt"><summary>Prompt preview (this NPC's block)</summary><pre class="npclife-pre"></pre></details>
    </div>` : ""}`;
  const goalBtn = body.querySelector('[data-life="goal"]');
  if (goalBtn) goalBtn.onclick = async () => {
    const nv = await TextPopup.open({ title: "Edit mini-goal", value: String(npc.lifeGoal || ""), placeholder: "What are they pursuing off-screen…", rows: 2, maxLength: NPC_LIFE_GOAL_MAX_CHARS, confirmText: "Save" });
    if (nv !== null) {
      npc.lifeGoal = String(nv).trim().slice(0, NPC_LIFE_GOAL_MAX_CHARS);
      store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
      popup.render();
    }
  };
  const whereBtn = body.querySelector('[data-life="where"]');
  if (whereBtn) whereBtn.onclick = async () => {
    const nv = await TextPopup.open({ title: "Edit whereabouts", value: String(npc.lifeWhere || ""), placeholder: "Where are they now…", rows: 1, maxLength: NPC_LIFE_WHERE_MAX_CHARS, confirmText: "Save" });
    if (nv !== null) {
      npc.lifeWhere = String(nv).trim().slice(0, NPC_LIFE_WHERE_MAX_CHARS);
      store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
      popup.render();
    }
  };
  const addBtn = body.querySelector('[data-life="hist-add"]');
  if (addBtn) addBtn.onclick = async () => {
    const res = await lifeActivityPopup({ goal: "", turn: (typeof state !== "undefined" && state && typeof state.turn === "number" && state.turn >= 0) ? Math.floor(state.turn) : -1 }, { title: `Add past activity for ${npc.name}`, confirmText: "Add" });
    if (!res) return;
    if (!Array.isArray(npc.lifeHistory)) npc.lifeHistory = [];
    npc.lifeHistory.push(res);
    if (npc.lifeHistory.length > NPC_LIFE_HISTORY_MAX) npc.lifeHistory = npc.lifeHistory.slice(-NPC_LIFE_HISTORY_MAX);
    store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
    popup.render();
  };
  body.querySelectorAll('[data-life="hist-edit"]').forEach((b) => {
    b.onclick = async () => {
      const idx = Number(b.dataset.idx);
      if (!Array.isArray(npc.lifeHistory) || !npc.lifeHistory[idx]) return;
      const res = await lifeActivityPopup(npc.lifeHistory[idx], { title: "Edit activity", confirmText: "Save" });
      if (!res) return;
      npc.lifeHistory[idx] = res;
      store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
      popup.render();
    };
  });
  body.querySelectorAll('[data-life="hist-del"]').forEach((b) => {
    b.onclick = async () => {
      const idx = Number(b.dataset.idx);
      if (!Array.isArray(npc.lifeHistory) || !npc.lifeHistory[idx]) return;
      const ok = await ConfirmPopup.open({ title: "Delete activity", message: "Delete this activity entry? This cannot be undone.", confirmText: "Delete", danger: true });
      if (!ok) return;
      npc.lifeHistory.splice(idx, 1);
      store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
      popup.render();
    };
  });
  const pre = body.querySelector(".npclife-pre");
  if (pre) {
    try {
      const instr = npcLife.buildInstruction(state, [npc], { trackerDefs, scenarioText, vibeText });
      const i = instr.indexOf("OFF-SCREEN NPCS:");
      pre.textContent = i >= 0 ? instr.slice(i).slice(0, 2000) : instr.slice(0, 2000);
    } catch (e) { pre.textContent = "Preview unavailable: " + String(e && e.message || e); }
  }
  const run = body.querySelector(".npclife-run");
  if (run) run.onclick = async () => {
    setBusy(run, "Simulating…");
    try {
      const added = await npcLife.tick(state, { trackerDefs, scenarioText, vibeText });
      try { await store.save(state); }
      catch (e) {
        if (isStorageError(e) || (e && e.isStorageUnavailable)) { notifyStorageError(notify, "saving", e); return; }
        throw e;
      }
      if (added > 0) notify(`🌙 Private life: ${added} new memor${added === 1 ? "y" : "ies"}.`);
      popup.render();
      render();
      refreshRailIfOpen("left");
      refreshRailIfOpen("right");
    } catch (e) {
      console.error("[npc-life] manual tick failed:", e);
    } finally {
      clearBusy(run);
    }
  };
}

/* ---------- NPC rename ---------- */
// Session-owned NPCs (generated, promoted, or hand-made — anything whose entry is NOT
// world-cast) can be renamed from the profile popup. World-cast names are canon and locked.
// Only exact machine references move: the catalogue key, speaker tags ([Name] / [Name inner]
// bubbles via msg.name), memory owners (whole owner tokens only), message links (npcKey),
// [[NPC: Name]] promotion flags, 🔗-menu link rules, off-screen mute markers, NPC tracker
// snapshot keys (`afterNpcTrackers`, incl. re-roll archives — the entry seed travels with the
// re-key), and re-roll archives. Story prose — narration, dialogue mentions, memory/digest text, profiles,
// threads, situation — is NEVER touched, so promoting a "guard" to a proper name can't
// corrupt the narrative (old prose simply keeps the old name).
export function npcRenameError(oldName, want) {
  const next = String(want || "").trim().replace(/\s+/g, " ");
  if (!next) return "Enter a name.";
  if (next === oldName) return "That's already their name.";
  if (next.toLowerCase() === oldName.toLowerCase()) return "Only the capitalization differs — pick a clearly different name.";
  if (next.length > 40) return "Keep it under 40 characters.";
  if (/[\[\]|,+]/.test(next)) return "Names can't contain [ ] | , or + (they'd break tags and owner lists).";
  const npcs = (typeof state !== "undefined" && state && state.npcs) || {};
  const lower = next.toLowerCase();
  for (const k of Object.keys(npcs)) {
    if (k === oldName) continue;
    if (k.toLowerCase() === lower) return `"${next}" is already in use.`;
  }
  try {
    if (typeof npcSys !== "undefined" && npcSys && npcSys.castMatch(next)) return `"${next}" is a world-cast name — pick a different one.`;
  } catch (e) {}
  const hero = (typeof state !== "undefined" && state && state.character && state.character.name ? String(state.character.name) : "").trim().toLowerCase();
  if ((hero && lower === hero) || lower === "you") return "That's the hero's name.";
  try {
    if (typeof npcSys !== "undefined" && npcSys && npcSys.busy && npcSys.busy.has(oldName)) return "Their profile is still generating — try again in a moment.";
  } catch (e) {}
  return null;
}

// Validated entry point: pass the ALREADY-TRIMMED new name. Pure over the passed state
// object (no UI, no saves) so it stays testable — returns per-area counts for the toast.
export function applyNpcRename(s, oldName, newName) {
  const counts = { speakers: 0, owners: 0, links: 0, flags: 0, rules: 0, muted: 0, cleared: 0, trackers: 0 };
  const npcs = (s && s.npcs) || {};
  const entry = npcs[oldName];
  if (!entry || oldName === newName) return counts;
  delete npcs[oldName];
  entry.name = newName;
  npcs[newName] = entry;
  const escRe = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // The lookahead tolerates the spaced `] ]` closer the GM sometimes emits (see parseGmOutput).
  const flagRe = new RegExp("\\[\\[NPC:\\s*" + escRe(oldName) + "(?=\\s*(?:\\||\\]\\s*\\]))", "g");
  const oldLower = oldName.toLowerCase();
  const renameMsgs = (list) => {
    if (!Array.isArray(list)) return;
    for (const m of list) {
      if (!m || typeof m !== "object") continue;
      const wasLinked = m.npcKey === oldName;
      if (wasLinked) { m.npcKey = newName; counts.links++; }
      // Speaker tags move only when the line actually resolves to this NPC: a linked line
      // with the canonical spelling, or a plain line with the exact spelling. Unlinked lines
      // (deliberately separated spellings) and variant spellings linked elsewhere keep theirs.
      if (m.name === oldName && (wasLinked || (!m.npcKey && !m.npcUnlinked))) { m.name = newName; counts.speakers++; }
      if (typeof m.text === "string" && m.text.includes("[[NPC:")) {
        const nt = m.text.replace(flagRe, "[[NPC: " + newName);
        if (nt !== m.text) { m.text = nt; counts.flags++; }
      }
      if (Array.isArray(m.afterNpcTrackersOffscreen)) {
        m.afterNpcTrackersOffscreen = m.afterNpcTrackersOffscreen.map((n) => {
          if (String(n) === oldName) { counts.muted++; return newName; }
          return n;
        });
      }
      // Tracker snapshots are keyed by NPC name (foldNpcTrackers reads them newest-first) —
      // without this the renamed NPC falls back to seeds/defaults and loses its values.
      // The entry seed (`entry.trackers`) travels with the re-key above, so only snapshots
      // move here. Same-turn collision with a stale new-spelling key can't happen for live
      // entries (the collision guard), and the live lineage wins if it ever does.
      const snap = m.afterNpcTrackers;
      if (snap && typeof snap === "object" && !Array.isArray(snap) && Object.hasOwn(snap, oldName)) {
        snap[newName] = snap[oldName];
        delete snap[oldName];
        counts.trackers++;
      }
      if (Array.isArray(m.rerolls)) renameMsgs(m.rerolls);
    }
  };
  renameMsgs(s.messages);
  if (s.openingRerolls && typeof s.openingRerolls === "object") {
    for (const k of Object.keys(s.openingRerolls)) {
      if (Array.isArray(s.openingRerolls[k])) renameMsgs(s.openingRerolls[k]);
    }
  }
  const renameOwner = (m) => {
    if (!m || typeof m.owner !== "string") return;
    const parts = m.owner.split(/[,+]/);
    let hit = false;
    const out = parts.map((t) => {
      if (t.trim().toLowerCase() === oldLower) { hit = true; return newName; }
      return t;
    });
    if (hit) { m.owner = out.map((t) => t.trim()).filter(Boolean).join(", "); counts.owners++; }
  };
  for (const m of (((s.memories || {}).auto) || [])) renameOwner(m);
  for (const m of (((s.memories || {}).manual) || [])) renameOwner(m);
  const rules = s.npcLinkRules;
  if (rules && typeof rules === "object" && !Array.isArray(rules)) {
    // Retarget ONLY: other spellings pinned to this entry follow the rename. Never re-key
    // the old spelling's rule onto the new name — the new spelling matches the catalogue
    // exactly and needs no rule, and any carried rule paints a bogus 🔗 on every bubble
    // (linkStateFor shows the icon whenever a rule exists for the display spelling, even a
    // self-pin). Leftover old-spelling lines keep their old rule, exactly as before.
    // A rule on the NEW spelling itself (e.g. an old "keep separate" from before the rename)
    // now fights the entry it names — a link rule pointing at a *third* entry is left alone
    // deliberately (real user intent for that spelling, however ambiguous); everything
    // provably void is swept below.
    for (const r of Object.values(rules)) {
      if (r && r.mode === "link" && r.target === oldName) { r.target = newName; counts.rules++; }
    }
    // Sweep immediately so the save never sits with void rules until the next load: the
    // retarget above can mint a self-pin, and a pre-existing new-spelling rule (unlink, or a
    // link whose target died earlier) would wear a cut 🔗 on every renamed bubble.
    counts.cleared = dropVoidLinkRules(s) || 0;
  }
  return counts;
}

// Exported for testing (pure over the passed save object). Returns the number cleared.
export function dropVoidLinkRules(d) {
  const rules = d && d.npcLinkRules;
  if (!rules || typeof rules !== "object" || Array.isArray(rules)) return 0;
  const owner = (d.npcs && typeof d.npcs === "object" && !Array.isArray(d.npcs) && d.npcs) || d.npcRegistry || {};
  const keys = new Set(Object.keys(owner));
  const lowerKeys = new Set(Object.keys(owner).map((k) => String(k).toLowerCase()));
  let cleared = 0;
  for (const [k, r] of Object.entries(rules)) {
    if (!r || typeof r !== "object") continue; // normalize prunes these; not ours to count
    if (r.mode === "unlink") {
      // An "always separate" rule for a spelling that IS a roster entry (any case) can never
      // fire: exact and case-insensitive-exact resolution land on the entry with or without
      // the rule (npcForSpeaker, update, rebuildSightings all agree). It only paints a cut 🔗
      // on the entry's own bubbles — typically a leftover from a spelling that later became
      // an entry via rename. Genuine variant rules ("May" vs "Maya") never match this and stay.
      if (lowerKeys.has(String(k).toLowerCase())) { delete rules[k]; cleared++; }
      continue;
    }
    if (r.mode !== "link") continue;
    if (String(r.target || "").toLowerCase() === String(k).toLowerCase() || !keys.has(r.target)) { delete rules[k]; cleared++; }
  }
  return cleared;
}

// Validated removal: pure over the passed state object (no UI, no saves) so it stays
// testable — returns per-area counts for the toast. Soft delete by design: only machine
// state that is provably stale without an entry goes. Deliberately kept: owned memories
// (the owner gate fades them once the name leaves the story, and they re-attach on
// re-encounter), story prose (history), per-line keys/flags (degrade gracefully through
// guarded lookups and re-link correctly on re-meet), and unlink rules keyed by the
// spelling (standing user intent).
export function removeNpcFromState(s, name) {
  const counts = { snapshots: 0, rules: 0, muted: 0 };
  const npcs = (s && s.npcs) || {};
  if (!name || !npcs[name]) return counts;
  delete npcs[name];
  // Tracker snapshots for a name with no entry can never resurface through the fold
  // (this is the eager half — the re-meet purge in _newEntry is the other half).
  try { counts.snapshots = purgeNpcTrackerHistory(s, name) || 0; } catch (e) {}
  // Nested archives are inert to the fold but shouldn't carry the dead weight either.
  try {
    const sweepNested = (list) => {
      if (!Array.isArray(list)) return;
      for (const m of list) {
        if (!m || typeof m !== "object") continue;
        const snap = m.afterNpcTrackers;
        if (snap && typeof snap === "object" && !Array.isArray(snap) && Object.hasOwn(snap, name)) {
          delete snap[name];
          counts.snapshots++;
          if (!Object.keys(snap).length) delete m.afterNpcTrackers;
        }
        if (Array.isArray(m.rerolls)) sweepNested(m.rerolls);
      }
    };
    for (const m of (s.messages || [])) if (m && typeof m === "object" && Array.isArray(m.rerolls)) sweepNested(m.rerolls);
    if (s.openingRerolls && typeof s.openingRerolls === "object") {
      for (const k of Object.keys(s.openingRerolls)) sweepNested(s.openingRerolls[k]);
    }
  } catch (e) {}
  // Rules left pointing at the deleted entry would paint phantom 🔗 icons until the next
  // load's sanitize — sweep them now.
  try { counts.rules = dropVoidLinkRules(s) || 0; } catch (e) {}
  // Mute markers name names, not entries — filter the deleted one (chips already skip
  // non-roster names, so this is hygiene only).
  try {
    for (const m of (s.messages || [])) {
      if (m && Array.isArray(m.afterNpcTrackersOffscreen) && m.afterNpcTrackersOffscreen.includes(name)) {
        m.afterNpcTrackersOffscreen = m.afterNpcTrackersOffscreen.filter((n) => n !== name);
        if (!m.afterNpcTrackersOffscreen.length) delete m.afterNpcTrackersOffscreen;
        counts.muted++;
      }
    }
  } catch (e) {}
  return counts;
}

function doRenameNpc(oldName, want) {
  const next = String(want || "").trim().replace(/\s+/g, " ");
  const err = npcRenameError(oldName, next);
  if (err) { notify("⚠ " + err); return false; }
  const counts = applyNpcRename(state, oldName, next);
  try { reconcileNpcsAfterRewrite(); } catch (e) {}
  try { store.save(state); } catch (e) {}
  try { render(); } catch (e) {}
  try { refreshRailIfOpen("left"); refreshRailIfOpen("right"); } catch (e) {}
  const bits = [];
  if (counts.speakers) bits.push(counts.speakers + " speaker tag" + (counts.speakers > 1 ? "s" : ""));
  if (counts.owners) bits.push(counts.owners + " memor" + (counts.owners > 1 ? "ies" : "y") + " re-owned");
  if (counts.trackers) bits.push(counts.trackers + " tracker snapshot" + (counts.trackers > 1 ? "s" : "") + " re-keyed");
  if (counts.links + counts.flags + counts.rules + counts.muted + counts.cleared) bits.push((counts.links + counts.flags + counts.rules + counts.muted + counts.cleared) + " link" + (counts.links + counts.flags + counts.rules + counts.muted + counts.cleared > 1 ? "s" : "") + " updated");
  notify(bits.length ? `Renamed to ${next} — ${bits.join(", ")}.` : `Renamed to ${next}.`);
  return true;
}

/* ---------- NPC detail popup ---------- */
class NpcPopup {
  static open(npc) {
    return new NpcPopup(npc);
  }

  constructor(npc) {
    this.npc = npc;
    this.tab = "profile"; // "profile" | "memory" | "life" — kept on the instance so in-place re-renders keep it
    this.overlay = document.createElement("div");
    this.overlay.className = "popup-overlay npcpop-overlay";
    document.body.appendChild(this.overlay);
    this._release = pushBackClose(() => this.close());
    this.render();
    this.overlay.addEventListener("mousedown", (e) => { if (e.target === this.overlay) this.close(); });
  }

  close() {
    if (this._closed) return;
    this._closed = true;
    if (this._release) this._release();
    this.overlay.remove();
  }

  render() {
    // Tab switches rebuild the whole overlay — on narrow screens the portrait stacks above the
    // tabs, so without this the panel's scroller resets to the top (portrait) on every switch.
    const scroller = this.overlay.querySelector(".npcpop-body");
    const prevScroll = scroller ? scroller.scrollTop : 0;
    const npc = this.npc;
    const d = npc.details || {};
    const missing = !npc.details || !NPC_FIELDS.some(([k]) => npc.details[k]);
    const busy = npcSys.busy.has(npc.name);
    const noProfile = `<div class="dim npc-gen">${busy ? "Profile &amp; portrait are being generated…" : "No profile yet."}</div>`;
    const strip = npcTrackerStripHtml(npc.name);
    const showLife = !state.settings || state.settings.simNpcLife !== false;
    const tab = this.tab === "memory" ? "memory" : (this.tab === "life" && showLife) ? "life" : "profile";
    const owned = npcOwnedMemories(npc.name);
    const memCount = owned.manual.length + owned.auto.length;
    // Rename rides right of the name — session-owned NPCs only (generated, promoted, or
    // hand-made). World-cast entries carry entry.cast and stay locked: their name is canon.
    const sessEntry = npc && state.npcs ? state.npcs[npc.name] : null;
    const canRename = !!sessEntry && !sessEntry.cast;
    const tabBar = `<div class="hero-tabs npc-tabs">
        <button type="button" class="seg-btn${tab === "profile" ? " on" : ""}" data-ntab="profile">Profile</button>
        <button type="button" class="seg-btn${tab === "memory" ? " on" : ""}" data-ntab="memory">Memory${memCount ? ` (${memCount})` : ""}</button>${showLife ? `
        <button type="button" class="seg-btn${tab === "life" ? " on" : ""}" data-ntab="life">Life</button>` : ""}
      </div>`;
    const rightPanel = tab === "memory"
      ? `<div class="npcpop-band-head">
          <span class="p-label">Memories owned</span>
        </div>
        <div class="npcpop-mem-body"></div>`
      : tab === "life"
      ? `<div class="npcpop-band-head">
          <span class="p-label">Private life</span>
        </div>
        <div class="npcpop-life-body"></div>`
      : `<div class="npcpop-band-head">
          <span class="p-label">Profile</span>
        </div>
        ${missing ? noProfile : bioLayoutHtml(NPC_FIELDS, (k) => d[k])}
        <div class="npcpop-actions npcpop-prof-acts">
          <button class="btn npcpop-reprofile${busy ? " is-loading" : ""}"${busy ? " disabled" : ""}>${busy ? '<span class="spin spin-sm"></span> Generating…' : "⟳ Regenerate profile"}</button>
        </div>`;
    this.overlay.innerHTML = `
      <div class="npcpop">
        <div class="popup-head">
          <span class="popup-title">${importanceTag(npc)}${esc(npc.name)}${canRename ? ` <button class="npcpop-rename" title="Rename this NPC" aria-label="Rename this NPC">✎</button>` : ""}</span>
          <div class="npcpop-acts">
            <button class="mini npcpop-pin" title="Pin to keep at the top of the NPC list">${npc.pinned ? "Unpin" : "📌 Pin"}</button>
            <button class="mini warn npcpop-del">🗑️ Remove</button>
            <button class="popup-x" title="Close">✕</button>
          </div>
        </div>
        <div class="npcpop-body">
          <div class="npcpop-cols">
            <div class="npcpop-left">
              <div class="npcpop-portrait-wrap">${portraitHtml(npc, 240)}</div>
              ${strip ? `<div class="npcpop-trackband">${strip}</div>` : ""}
              <div class="npcpop-actions">
                <button class="btn npcpop-regen">⟳ Regenerate portrait</button>
                <button class="btn npcpop-upload">⬆ Upload image</button>
              </div>
              <div class="dim npcpop-seen">${esc(npcSeenLine(npc))}</div>
            </div>
            <div class="npcpop-right">
              ${tabBar}
              ${rightPanel}
            </div>
          </div>
        </div>
      </div>`;
    const freshScroller = this.overlay.querySelector(".npcpop-body");
    const x = this.overlay.querySelector(".popup-x");
    if (x) x.onclick = () => this.close();
    this.overlay.querySelectorAll(".npc-tabs .seg-btn").forEach((b) => {
      b.onclick = () => {
        // Record where the tabs row sits in the scroller's viewport at tap time;
        // render() below puts it back in exactly that spot after the rebuild.
        const sc = this.overlay.querySelector(".npcpop-body");
        const bar = this.overlay.querySelector(".npc-tabs");
        if (sc && bar) {
          this._tabAnchorViewTop = bar.getBoundingClientRect().top - sc.getBoundingClientRect().top;
        }
        this.tab = b.dataset.ntab;
        this.render();
      };
    });
    const memBody = this.overlay.querySelector(".npcpop-mem-body");
    if (memBody) {
      // Rebuild only the rows container after a change — never the whole popup, so the portrait
      // (and any in-flight async work on it) survives a pin/switch/edit/delete — and keep the tab's
      // counter in step with what's currently owned.
      const refresh = () => {
        const fresh = npcOwnedMemories(npc.name);
        memBody.innerHTML = "";
        npcMemRowsInto(memBody, fresh, refresh);
        const btn = this.overlay.querySelector('.npc-tabs [data-ntab="memory"]');
        const n = fresh.manual.length + fresh.auto.length;
        if (btn) btn.textContent = "Memory" + (n ? ` (${n})` : "");
        // "＋ Add memory" rides INSIDE the rebuilt body, directly above the auto list —
        // a full-field form like auto ✎ (owner + turn pre-filled) writing a real auto
        // entry, never a manual note.
        const addBtn = document.createElement("button");
        addBtn.className = "btn panel-topbtn npcmem-add";
        addBtn.textContent = "＋ Add memory";
        addBtn.onclick = async () => {
          const template = {
            text: "",
            owner: npc.name,
            triggers: [],
            turn: (typeof state.turn === "number" && state.turn >= 0 ? state.turn : null),
            pinned: false,
          };
          const patch = await memoryEditPopup(template, { allowTurn: true, title: `Add memory for ${npc.name}`, confirmText: "Add" });
          if (!patch || !String(patch.text || "").trim()) return;
          memory.addAuto(state, { text: patch.text, owner: patch.owner, triggers: patch.triggers, turn: patch.turn, pinned: patch.pinned });
          refresh();
          store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
        };
        const lists = Array.from(memBody.children).filter((el) => el.classList && el.classList.contains("memlist"));
        if (fresh.auto.length && lists.length) memBody.insertBefore(addBtn, lists[lists.length - 1]);
        else memBody.appendChild(addBtn);
      };
      refresh();
    }
    const lifeBody = this.overlay.querySelector(".npcpop-life-body");
    if (lifeBody) renderNpcLifeBody(lifeBody, npc, this);
    const regen = this.overlay.querySelector(".npcpop-regen");
    if (regen) regen.onclick = async () => {
      const st = state;
      setBusy(regen, "Generating…");
      try {
        const ok = await npcSys.regeneratePortrait(npc, st);
        if (!ok) notify("⚠ Couldn't generate portrait — try again.");
        if (state !== st) return;
        store.save(st).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
        this.render();
        render(); // refresh chat bubbles that show this NPC's portrait
        refreshRailIfOpen("right");
      } catch (e) {
        console.error("NPC portrait regeneration failed:", e);
        notify("⚠ Couldn't generate portrait — try again.");
      } finally {
        clearBusy(regen);
      }
    };
    const up = this.overlay.querySelector(".npcpop-upload");
    if (up) up.onclick = async () => {
      const ok = await uploadAvatarTo(npc, "portrait");
      if (!ok) return;
      store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
      this.render();
      render(); // refresh chat bubbles that show this NPC's portrait
      refreshRailIfOpen("right");
    };
    const reprofile = this.overlay.querySelector(".npcpop-reprofile");
    if (reprofile) reprofile.onclick = () => {
      if (npcSys.busy.has(npc.name)) return;
      const st = state;
      npcSys.regenerateProfile(npc, st, () => {
        if (state !== st) return;
        store.save(st).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
        this.render();
        render();
        refreshRailIfOpen("right");
      });
      this.render();
      refreshRailIfOpen("right");
    };
    const renameBtn = this.overlay.querySelector(".npcpop-rename");
    if (renameBtn) renameBtn.onclick = () => this.renameFlow();
    const pin = this.overlay.querySelector(".npcpop-pin");
    if (pin) pin.onclick = () => {
      npc.pinned = !npc.pinned;
      store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
      this.render();
      refreshRailIfOpen("right");
    };
    const del = this.overlay.querySelector(".npcpop-del");
    if (del) del.onclick = async () => {
      const ok = await ConfirmPopup.open({ title: "Remove NPC", message: `Remove ${npc.name} from your catalogue? They may be re-encountered later.`, confirmText: "Remove", danger: true });
      if (ok) {
        const dead = npc.name;
        const counts = removeNpcFromState(state, dead);
        store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
        const bits = [];
        if (counts.snapshots) bits.push(counts.snapshots + " tracker snapshot" + (counts.snapshots > 1 ? "s" : ""));
        if (counts.rules) bits.push(counts.rules + " stale link rule" + (counts.rules > 1 ? "s" : ""));
        notify("✖ Removed " + dead + (bits.length ? " (" + bits.join(", ") + " cleared)." : "."));
        this.close();
        render();
        refreshRailIfOpen("right");
      }
    };
    this.overlay.querySelectorAll(".npc-edit").forEach((b) => {
      if (b.dataset.life) return; // Life-tab buttons wire their own editors in renderNpcLifeBody
      b.onclick = async () => {
        const k = b.dataset.field;
        const nv = await TextPopup.open({ title: "Edit " + k, value: d[k] || "", placeholder: k + "..." });
        if (nv !== null) {
          if (!npc.details) npc.details = {};
          npc.details[k] = nv.trim();
          store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
          this.render();
        }
      };
    });
    // Tracker hand-edit (D7) is handled by ONE delegated listener in the NPC-tracker block above:
    // the strip is repainted in place on every update, so per-button handlers would go stale.
    // Restore the scroll LAST — the Memory/Life tab bodies are filled in above (rows render
    // into the fresh DOM after innerHTML), so restoring any earlier measures against an
    // empty panel and clamps to the wrong position. A tab switch pins the tabs row where
    // it was tapped (the chrome above the tabs is identical on every tab, so this holds
    // the panel visually still); same-tab re-renders just keep the position.
    if (freshScroller) {
      if (this._tabAnchorViewTop != null) {
        const bar = freshScroller.querySelector(".npc-tabs");
        if (bar) {
          const scR = freshScroller.getBoundingClientRect();
          const contentTop = bar.getBoundingClientRect().top - scR.top + freshScroller.scrollTop;
          const want = contentTop - this._tabAnchorViewTop;
          let max = Math.max(0, freshScroller.scrollHeight - freshScroller.clientHeight);
          if (want > max) {
            // The target tab is too short to hold the anchor — pad the panel so
            // it reaches instead of clamping (which would yank the tabs row).
            // Monotonic per popup opening: never shrinks, so no later switch
            // can be yanked by a shrinking panel either.
            const cols = freshScroller.querySelector(".npcpop-cols");
            if (cols) {
              const pad = want + freshScroller.clientHeight - (freshScroller.scrollHeight - cols.getBoundingClientRect().height);
              this._padH = Math.max(this._padH || 0, Math.ceil(pad));
              cols.style.minHeight = this._padH + "px";
              max = Math.max(0, freshScroller.scrollHeight - freshScroller.clientHeight);
            }
          }
          freshScroller.scrollTop = Math.max(0, Math.min(max, want));
        }
        this._tabAnchorViewTop = null;
      } else if (prevScroll) {
        freshScroller.scrollTop = prevScroll;
      }
    }
  }

  // Rename through the shared text popup (same panel as every other profile edit),
  // with the scope note inside. this.npc is the live session entry, so a successful rename
  // mutates it in place and a plain re-render shows the new name. Validation errors notify
  // and reopen with the attempted text kept, so it can be fixed instead of retyped.
  async renameFlow() {
    const oldName = this.npc.name;
    let val = oldName;
    for (;;) {
      const nv = await TextPopup.open({
        title: `Rename ${oldName}`, value: val, placeholder: "New name…", rows: 1,
        confirmText: "Rename", maxLength: 40,
        note: "Best for newly introduced NPCs — only speaker tags, memory owners and NPC links are renamed; story prose is never touched."
      });
      if (nv === null) return;
      if (doRenameNpc(oldName, nv)) { this.render(); return; }
      val = nv;
    }
  }
}

function openNpcPopup(npc) {
  NpcPopup.open(npc);
}

// Clicking a talker's name/portrait in chat, routed by WHO is speaking. The hero voicing their own
// line (the GM wrote it — see isHeroSpeaker) opens the Hero panel; a real NPC opens their profile, or
// gets the "no profile yet — generate one?" prompt. One place, so every bubble routes identically.
// Takes the message (for its key + unlink flag) and the clicked element (to anchor the menu).
function openSpeakerFromChat(msg, anchor) {
  if (isHeroSpeaker(msg.name)) { openRailSection("right", "character"); return; }
  openNpcFromChat(msg, anchor);
}

// Clicking an NPC's name/portrait in chat. Opens the profile popup if the NPC has one;
// otherwise explains there's no profile yet and offers to generate one on the spot.
// Linked bubbles (variant spelling with `npcKey`) open the canonical profile; the prompt and any
// hand-created entry still use the bubble's own spelling, so a descriptor ("Maya's friend")
// never offers to build "Maya".
// An unlinked bubble resolves exact-only (its flag travels with the click), so it never borrows a
// profile it was separated from. A bubble with nothing catalogued gets the create-or-link menu —
// generate a fresh profile for the spelling, or pin it to an existing entry.
function openNpcFromChat(msg, anchor) {
  const name = String(msg.name || "").trim();
  const npcKey = msg.npcKey;
  const unlinked = !!msg.npcUnlinked;
  let npc = npcForSpeaker(name, npcKey, unlinked) || state.npcs[name];
  const busyKey = (npc && npc.name) || (!unlinked && npcKey) || name;
  const busy = npcSys.busy.has(busyKey) || npcSys.busy.has(name);
  if (npc && (npcSys.hasDetails(npc) || busy)) {
    openNpcPopup(npc);
    return;
  }
  if (!npc && anchor) {
    openNpcLinkMenu(anchor, msg);
    return;
  }
  // Only thin catalogue entries reach this confirm (unknown names go to the link menu above, and
  // full profiles open directly). A medium/high-importance entry without details is a stalled or
  // failed build — say so. A lightweight entry is a background character by design.
  const stalled = !!npc && (npc.importance === "high" || npc.importance === "medium");
  const prompt = stalled
    ? `${name} is in your catalogue, but their profile was never finished. Generate the full profile and portrait now?`
    : npc
      ? `${name} doesn't have a profile yet — a background character so far. Generate a full profile and portrait?`
      : `${name} isn't in your catalogue yet. Generate a full profile and portrait?`;
  ConfirmPopup.open({
    title: "No profile yet",
    message: prompt,
    confirmText: "Generate profile",
    danger: false
  }).then(async (ok) => {
    if (!ok) return;
    if (!npc) {
      npc = {
        name,
        portrait: "src/images/portrait-placeholder.webp",
        description: "",
        details: null,
        importance: "medium",
        appearanceCount: 1,
        firstSeenTurn: state.turn || 0,
        lastSeenTurn: state.turn || 0,
        everSpoke: false,
        pinned: false
      };
      state.npcs[name] = npc;
    }
    const popup = NpcPopup.open(npc);
    notify("👤 Building profile for " + name + "…");
    const st = state;
    npcSys.ensureProfiled(npc, st, () => {
      if (state !== st) return;
      store.save(st).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
      popup.render();
      render();
      refreshRailIfOpen("right");
    });
    popup.render();
  });
}

// The shared "build it new" flow behind both the legacy confirm and the link menu's generate item.
function generateNpcProfileFor(display) {
  const name = String(display || "").trim();
  if (!name) return;
  let npc = state.npcs[name] || null;
  if (!npc) {
    npc = {
      name,
      portrait: "src/images/portrait-placeholder.webp",
      description: "",
      details: null,
      importance: "medium",
      appearanceCount: 1,
      firstSeenTurn: state.turn || 0,
      lastSeenTurn: state.turn || 0,
      everSpoke: false,
      pinned: false
    };
    state.npcs[name] = npc;
  }
  const popup = NpcPopup.open(npc);
  notify("👤 Building profile for " + name + "…");
  const st = state;
  npcSys.ensureProfiled(npc, st, () => {
    if (state !== st) return;
    store.save(st).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
    popup.render();
    render();
    refreshRailIfOpen("right");
  });
  popup.render();
}

// The faded 🔗 after a linked speaker's name ("Garreth" → Captain Garreth): which profile this
// bubble points at, and the fix when the resolver guessed wrong. Corrections come in two widths:
// this line only (`npcUnlinked` on the message) or every line with this spelling (`npcLinkRules`
// in the save, read by NpcSystem.update and npcForSpeaker so roster and chat can never disagree).
// Counts are deliberately left alone by corrections — an off-by-one appearance is negligible, and
// rewriting history's numbers here would be its own kind of wrong (history rewrites via
// edit/re-roll/version-switch/delete recompute sightings separately in rebuildSightings).
function closeNpcLinkMenu() {
  const m = document.getElementById("npcLinkMenu");
  if (m) m.remove();
  document.removeEventListener("mousedown", npcLinkMenuOutside, true);
  document.removeEventListener("keydown", npcLinkMenuKey);
}
function npcLinkMenuOutside(e) {
  const m = document.getElementById("npcLinkMenu");
  if (m && !m.contains(e.target)) closeNpcLinkMenu();
}
function npcLinkMenuKey(e) {
  if (e.key === "Escape") closeNpcLinkMenu();
}
function placeNpcLinkMenu(menu, anchor) {
  const r = anchor.getBoundingClientRect();
  const mw = menu.offsetWidth || 260, mh = menu.offsetHeight || 200;
  let left = Math.max(8, Math.min(r.left, window.innerWidth - mw - 8));
  let top = r.bottom + 6;
  if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6);
  menu.style.left = left + "px";
  menu.style.top = top + "px";
}
// `labelHtml` is HTML: callers escape dynamic names with esc() and may wrap them in <b>.
function npcLinkMenuBtn(menu, labelHtml, sub, fn, cls) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "nlm-item" + (cls ? " " + cls : "");
  b.innerHTML = `<span class="nlm-label">${labelHtml}</span>` + (sub ? `<span class="nlm-sub">${esc(sub)}</span>` : "");
  b.onclick = fn;
  menu.appendChild(b);
  return b;
}
function npcLinkMenuSep(menu) {
  const s = document.createElement("div");
  s.className = "nlm-sep";
  s.setAttribute("aria-hidden", "true");
  menu.appendChild(s);
  return s;
}
// Re-resolve one bubble without side-effects: the create-only pass sets/clears its key but never
// bumps counts or builds — used after a rule change so the bubble immediately shows the new outcome.
function relinkLine(msg) {
  try { npcSys.update([msg], state, null, { createOnly: true }); } catch (e) { /* resolver-only; ignore */ }
}
// The searchable roster picker shared by every "link to…" section. A fixed list can't fit a long
// catalogue, so typing filters by substring and only 4 show at a time with an overflow count.
// `exclude` is the entry the bubble already points at. Roster rows get the plain `nlm-pick`
// look so they never read as action buttons.
function npcLinkPicker(menu, display, key, msg, exclude) {
  const rosterNames = Object.keys(state.npcs || {}).filter((n) => n !== exclude).sort((a, b) => (a < b ? -1 : 1));
  if (!rosterNames.length) return;
  const wrap = document.createElement("div");
  wrap.className = "nlm-subhead";
  wrap.textContent = "Link instead to…";
  menu.appendChild(wrap);
  const search = document.createElement("input");
  search.type = "text";
  search.className = "nlm-search";
  search.placeholder = "Type a name…";
  search.setAttribute("aria-label", "Filter NPCs");
  search.autocomplete = "off";
  menu.appendChild(search);
  const list = document.createElement("div");
  list.className = "nlm-list";
  menu.appendChild(list);
  const pick = (n) => {
    if (!state.npcLinkRules || typeof state.npcLinkRules !== "object") state.npcLinkRules = {};
    state.npcLinkRules[key] = { mode: "link", target: n };
    delete msg.npcUnlinked;
    if (n !== display) msg.npcKey = n;
    else delete msg.npcKey;
    store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
    closeNpcLinkMenu();
    render();
    notify(`🔗 "${display}" now points at ${n}.`);
  };
  const drawList = () => {
    list.innerHTML = "";
    const q = search.value.trim().toLowerCase();
    const hits = q ? rosterNames.filter((n) => n.toLowerCase().includes(q)) : rosterNames;
    if (!hits.length) {
      const empty = document.createElement("div");
      empty.className = "nlm-empty";
      empty.textContent = q ? "No matching NPC." : "No other NPCs.";
      list.appendChild(empty);
      return;
    }
    for (const n of hits.slice(0, 4)) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "nlm-item nlm-pick";
      b.innerHTML = `<span class="nlm-label">${esc(n)}</span>`;
      b.onclick = () => pick(n);
      list.appendChild(b);
    }
    if (hits.length > 4) {
      const more = document.createElement("div");
      more.className = "nlm-empty";
      more.textContent = `…and ${hits.length - 4} more.`;
      list.appendChild(more);
    }
  };
  search.addEventListener("input", drawList);
  // Typing stays in the menu: keep keystrokes away from global handlers, but let Escape
  // close the menu as everywhere else.
  search.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeNpcLinkMenu(); return; }
    e.stopPropagation();
  });
  drawList();
}
// The link menu behind the 🔗/cut icon and the create-or-link click. Three states:
// linked ("Garreth" → Captain Garreth): open, unlink, always-separate, link-instead, forget rule;
// unlinked (a flag/rule holds it apart): link back to what automatic says, link instead, generate
// new, forget rule; none (generic scenery, nothing to point at yet): generate new, link to existing.
// "Forget remembered rule" lives here in every state that has a rule — reachable via the icon in
// the linked and unlinked states, and via the name/avatar click in the none state.
export function openNpcLinkMenu(anchor, msg) {
  closeNpcLinkMenu();
  const st = linkStateFor(msg);
  if (st.kind === "none" && !st.display) return;
  const display = st.display || String(msg.name || "").trim();
  const key = display.toLowerCase();
  const menu = document.createElement("div");
  menu.className = "npc-link-menu";
  menu.id = "npcLinkMenu";
  const head = document.createElement("div");
  head.className = "nlm-head";
  menu.appendChild(head);
  const rule = npcLinkRuleFor(state, display);
  // Actions sit grouped up top; the searchable roster ("Link instead to…") always comes last.
  const forgetRule = () => {
    npcLinkMenuBtn(menu, "Forget remembered rule", "back to automatic", () => {
      delete state.npcLinkRules[key];
      delete msg.npcUnlinked;
      relinkLine(msg);
      store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
      closeNpcLinkMenu();
      render();
    });
  };
  // Hairline between the action group and the picker — only when the picker will show rows.
  const sepBeforePicker = (exclude) => {
    if (Object.keys(state.npcs || {}).some((n) => n !== exclude)) npcLinkMenuSep(menu);
  };
  if (st.kind === "linked") {
    head.textContent = `"${display}" → ${st.canon.name}`;
    npcLinkMenuBtn(menu, "Unlink this line", "bubble keeps its name, points nowhere", () => {
      msg.npcUnlinked = true;
      delete msg.npcKey;
      store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
      closeNpcLinkMenu();
      render();
      notify("🔗 Unlinked this line.");
    });
    npcLinkMenuBtn(menu, `Always keep <b>${esc(display)}</b> separate`, "never auto-links again", () => {
      if (!state.npcLinkRules || typeof state.npcLinkRules !== "object") state.npcLinkRules = {};
      state.npcLinkRules[key] = { mode: "unlink" };
      msg.npcUnlinked = true;
      delete msg.npcKey;
      store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
      closeNpcLinkMenu();
      render();
      notify(`🔗 "${display}" will stay separate.`);
    });
    if (rule) forgetRule();
    sepBeforePicker(st.canon.name);
    npcLinkPicker(menu, display, key, msg, st.canon.name);
  } else if (st.kind === "unlinked") {
    head.textContent = `"${display}" (unlinked)`;
    if (st.auto) {
      npcLinkMenuBtn(menu, `🔗 Link to <b>${esc(st.auto.name)}</b>`, "automatic detection", () => {
        delete state.npcLinkRules[key];
        delete msg.npcUnlinked;
        relinkLine(msg);
        store.save(state).catch((e) => { if (typeof isStorageError === "function" && (isStorageError(e) || (e && e.isStorageUnavailable))) { try { notifyStorageError(notify, "saving", e); } catch (_) {} } else console.warn("[session] background save failed:", e); });
        closeNpcLinkMenu();
        render();
        notify(`🔗 "${display}" now points at ${st.auto.name}.`);
      });
    }
    npcLinkMenuBtn(menu, `➕ Create a new profile for <b>${esc(display)}</b>`, "profile them as someone new", () => {
      closeNpcLinkMenu();
      generateNpcProfileFor(display);
    });
    if (rule) forgetRule();
    sepBeforePicker(display);
    npcLinkPicker(menu, display, key, msg, display);
  } else {
    head.textContent = `"${display}" (no profile yet)`;
    npcLinkMenuBtn(menu, `➕ Create a new profile for <b>${esc(display)}</b>`, "profile them as someone new", () => {
      closeNpcLinkMenu();
      generateNpcProfileFor(display);
    });
    if (rule) forgetRule();
    sepBeforePicker(display);
    npcLinkPicker(menu, display, key, msg, display);
  }
  document.body.appendChild(menu);
  placeNpcLinkMenu(menu, anchor);
  document.addEventListener("mousedown", npcLinkMenuOutside, true);
  document.addEventListener("keydown", npcLinkMenuKey);
}

async function saveAndMaybeMemory() {
  try {
    await store.save(state);
  } catch (e) {
    if (isStorageError(e) || (e && e.isStorageUnavailable)) {
      console.warn("[session] turn save failed (storage unavailable):", (e && e.message) || e);
      notifyStorageError(notify, "saving", e);
      return; // the turn is in memory and playable — skip the memory roll-up, which needs saves
    }
    throw e;
  }
  if ((state.turn - (state.lastAutoMemoryTurn || 0)) >= MEMORY_EVERY_TURNS) {
    const added = await memory.rollUp(state);
    try { await store.save(state); } // roll-up advances its cursor even when nothing new was added
    catch (e) {
      if (isStorageError(e) || (e && e.isStorageUnavailable)) { notifyStorageError(notify, "saving", e); return; }
      throw e;
    }
    // Report what the roll-up actually did: new memories recorded, obsolete ones resolved away,
    // and knowledge spreads (a secret told / discovery shared) — plus the retry-pending case.
    const rep = memory.lastRollUpReport;
    if (rep && (rep.added || rep.resolved || rep.spread)) {
      const bits = [];
      if (rep.added) bits.push(rep.added + " new");
      if (rep.resolved) bits.push(rep.resolved + " superseded");
      if (rep.spread) bits.push(rep.spread + " knowledge spread");
      notify("🧠 Memory roll-up: " + bits.join(" · "), { ms: 3600 });
    } else if (added > 0) {
      notify("🧠 A new memory was recorded.");
    }
    // The situation/threads/memory panels all read from what the roll-up just wrote — refresh the
    // left rail so an open tab updates live instead of showing pre-roll-up content.
    refreshRailIfOpen("left");
    // New/changed memories get vectors in the background (per-turn ranking
    // queues misses anyway — this just covers them sooner).
    try { warmupTexts((state.memories?.auto || []).map((m) => memoryDocText(m, state.character?.name || ""))); } catch (e) {}
  }
  // Off-screen NPC private life: one background call every NPC_LIFE_EVERY_TURNS
  // turns advances a few NPCs the hero hasn't seen in a while. It writes only
  // NPC-owned auto memories + lifeGoal/lifeHistory/lifeTick/lifeWhere — never presence
  // (lastSeenTurn / appearanceCount / everSpoke untouched) — and its input is
  // NPC-centric (dossier + own memories + clock/place + compact premise/vibe +
  // last whereabouts), never latestSituation / openThreads / transcript / player
  // action. Silent: no toast, just a rail refresh when something landed so the
  // NPC Memory tab updates live.
  try {
    if (npcLife && state.settings.simNpcLife !== false && ((state.turn - (state.lastNpcLifeTurn || 0)) >= NPC_LIFE_EVERY_TURNS)) {
      const lifeAdded = await npcLife.tick(state, { trackerDefs, scenarioText, vibeText });
      if (lifeAdded > 0) {
        try { await store.save(state); }
        catch (e) {
          if (isStorageError(e) || (e && e.isStorageUnavailable)) notifyStorageError(notify, "saving", e);
          else throw e;
        }
        refreshRailIfOpen("left");
        try { warmupTexts((state.memories?.auto || []).slice(-lifeAdded).map((m) => memoryDocText(m, state.character?.name || ""))); } catch (e) {}
      } else {
        // tick() advances its cursor even when nothing was recorded — persist it
        // so a no-op / failed tick doesn't re-fire every turn.
        try { await store.save(state); }
        catch (e) {
          if (!(isStorageError(e) || (e && e.isStorageUnavailable))) throw e;
          // cursor persistence is a nicety on a full disk — the next turn retries
        }
      }
    }
  } catch (e) { console.error("[npc-life] background tick failed:", e); }
}

// The small bridge the lazily-imported community/backup modules use to talk back to the app:
// popups, toasts, playing a world, and minting ids. community.js owns everything community-related;
// this is only the handful of app primitives it cannot reach itself.
window.mnoApp = {
  notify,
  ConfirmPopup,
  TextPopup,
  pushBackClose,
  esc,
  refreshLanding,
  refreshAddedWorlds,
  repaintWorldsPage,
  refreshUserPage,
  beginNewAdventure,
  freshWorldId,
  openWorldEditor,
  openLibWorldDetail,
  overlayLibraryListing,
  genImage,
  worldMenuItem,
  // The cover's fullscreen toggle is written once here and mounted by whichever panel is showing a
  // world (this file's and community.js's Explore panel, which rebuilds its HTML per repaint and so
  // passes its own state object back in).
  mountCoverFullscreen,
 // The ⋮ world menu is a single open-at-a-time menu owned by this module (outside-click and Escape
 // both close it), and community.js draws its own copy of it on the Added cards, so it toggles and
 // closes through these to behave exactly like the ones on your own worlds' cards.
 closeWorldMenu,
  setOpenWorldMenu: (menu) => { closeWorldMenu(); openWorldMenu = menu; placeWorldMenu(menu); },
  placeWorldMenu,
  mountWorldSessions,
  // The `Public` provenance note for a world added from Explore, so community.js's added-card says
  // exactly what main.js's own card says (same wording, same Explore mark) — one place to change it.
  publicNote: (title) => worldNote(PUBLIC_LABEL, { icon: EXPLORE_IC, title }),
  // Re-run the authorship reconciliation after a username claim/rename, so the worlds we made wear
  // the new name immediately (community.js calls this — see README §6.9).
  reconcileWorldAuthors,
  emptyStateEl,
  // The home shell can navigate to another page (`setHomePage`), and Settings can be raised as a
  // popup over whatever page is showing (`openSettingsPanel`) — the Explore header's identity chip
  // uses the latter, so it opens the Identity section without leaving Explore (§6.16).
  setHomePage,
  openSettingsPanel,
  closeSettingsPanel,
  // The Explore detail panel lives in community.js, but the address bar is the shell's to own: the
  // panel calls this to put `#explore/<worldId>` up while a world is open and `#explore` back when it
  // closes, so an open panel's URL IS its share link. It routes through `syncHomeHash` (forced) because
  // that is the only write the platform mirrors to the visible host-page URL. Guarded to Explore — the
  // panel is only ever raised from that page, and a stray call elsewhere must not hijack the URL.
  syncExploreHash: (target = "") => { if (homePage === "explore") syncHomeHash("explore", target, { force: true }); },
  syncUserHash: (target = "") => { if (homePage === "user") syncHomeHash("user", target, { force: true }); },
  goUser,
  // Dismiss the Tavern popup if it is open (a no-op otherwise). A world detail raised from a
  // Tavern card starts Play over the chat, and the hero-creation wizard (.cc-overlay, z 60)
  // would land underneath the Tavern (.popup-overlay, z 90) — so the launch hook brings the
  // Tavern down with the detail. Cached-module only: the Tavern can only exist once the
  // discussion module has loaded, so an unset cache already means "nothing to close".
  closeDiscussionPanel: () => { try { if (discussionMod) discussionMod.closeDiscussionPanel(); } catch (e) {} },
  // True while a session chat is showing (the landing is hidden) — popups raised over the chat
  // (Tavern, world details) route their page-bound taps through the landing first when set.
  inSession: () => !!state,
  // Leave the chat for a landing page, keeping the session entry behind it so Back returns
  // here (the keep bridge — refuses while the GM is writing, like every Menu exit).
  exitToHomePage,
  // Re-issue the CURRENT hash (whatever route it is) purely to mirror it up to the host page's address
  // bar. The platform only reflects a `replaceState` write, and a browser Back moves just the iframe, so
  // after a Back the bar is stale until something re-writes the hash — this is that "something".
  mirrorCurrentHash: () => { const r = homeRouteFromHash(); if (r.page) syncHomeHash(r.page, r.target, { force: true }); },
  // Apply a hash an outside caller hands us (`#adventures`, `#explore/<worldId>`). The platform's
  // `changeHash` message lands here (see the listener below), and it is also the console entry point for
  // driving a route without touching `location.hash` — which a generator must never do (see
  // `applyForwardedHash`).
  applyForwardedHash,
  // The Settings panel's Show-NSFW switch lives in community.js, so flipping it needs Worlds
  // (main.js's page) repainted from over there — see `applyNsfwPref`.
  applyNsfwPref,
  worldStore: () => worldStore,
  store: () => store,
  // The public profile page (`#user/...`) shows the engine author's bundled worlds alongside the
  // catalog listings — same cards as Worlds, opening the same detail popup (user-profile.js).
  bundledWorlds: () => bundledWorlds.slice(),
  bundledWorldCard: (world) => worldCard(world.meta, world, { source: "bundled", link: null })
};

init().catch((e) => console.error("Boot failed:", e));
