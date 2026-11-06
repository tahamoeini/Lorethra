// ============================================================================
// community.js — the community layer (Explore catalog, publishing, added-world library).
// ----------------------------------------------------------------------------
// Loaded ONLY on first need (dynamic `import()` from main.js) so the landing page and the chat
// loop never pay for it: no socket is opened, no catalog call is made, and no network work
// happens before the home shell has painted.
//
// What lives here:
//   * device identity + the derived tokens
//   * the socket lifecycle (Explore keeps one open; short-lived for the staleness check, and held open
//     while an admin is signed in — the server authorizes admin per connection)
//   * publish / update-content / edit-listing / unpublish / re-publish flows
//   * add-to-library (fetch + verify + cache at add time) and play-from-cache
//   * duplicate → attributed fork
//   * the Explore page UI, its detail popup, and the reader-side filters
//   * the owner's moderation tools: the mod log (§6.16) and the admin hide / unhide / unpublish
//     controls Explore's cards and popup wear while signed in (§6.14)
//
// Everything the server stores is metadata only; world content lives in immutable upload-plugin
// blobs. The catalog's server code is in index.html (`<script type="text/x-server-plugin">`).
//
// kv layout (folder `community`):  user | links | library | cache | settings | pendingDeletes | firstPublishBackupSeen
// ============================================================================

import { loadWorld, worldToFile, isNsfwMeta, isCommentsOffMeta, isRemixMeta, isImportedMeta, isReservedTag, MAX_AUTHOR_TAGS, META_ID_MAX, NSFW_TAG, REMIX_TAG, WorldStore } from "./world.js";
import { tagChipsHtml, scheduleTagFit } from "./tag-row.js";
import { pickImageFile } from "./image-utils.js";
import { pushBackClose } from "./back-close.js";
import { inlineMd, richTextWithMentions, mentionCandidates, renderWithResolvedMentions } from "./rich-text.js";
import { createChipInput } from "./chip-input.js";
import { utf8ByteTrunc } from "./popups.js"; // bio is a byte cap server-side (emoji = up to 4)
import { infoTipLabelHtml } from "./info-tip.js";
import { ICON_DOWNLOAD, ICON_HEART, ICON_HEART_OUTLINE, ICON_EXPORT, ICON_IMPORT, ICON_COMMENT, ICON_NOTE_DOC, ICON_OVERVIEW } from "./icons.js";
import { searchBar, switchEl, showNsfw, setShowNsfw, adoptStoredNsfw } from "./search-bar.js";
// Sharded added-world file cache (one IndexedDB key per world — see libcache.js). Single-world
// reads/writes/deletes are one small transaction, so one world's file can never poison the rest.
import { getCacheEntry as libGetCacheEntry, setCacheEntry as libSetCacheEntry, clearCache as libClearCache } from "./libcache.js";
// The cover's size/quality caps are shared with the world editor (which encodes the author's own
// cover) so publishing can never downscale a cover below what the author sees on their own card.
// Hosted covers upload as Blobs (never base64): fileToWebpBlob / dataUrlToWebpBlob /
// blobToWebpBlob all re-encode through canvas, so EXIF/XMP is stripped and the host only
// ever stores WebP (JPEG fallback where WebP encoding is unavailable).
import { COVER_MAX_DIM, COVER_WEBP_QUALITY, fileToWebpBlob, dataUrlToWebpBlob, blobToWebpBlob, PROFILE_AVATAR_MAX_DIM } from "./image-utils.js";
// Author's notes live in their own upload blob with only a 32-char ID on the server (see notes.js).
import { notesIdFromValue, isNotesPointer, notesUrlForId, fetchNotesText } from "./notes.js";

const A = () => window.mnoApp; // the small bridge main.js exposes (popups, notify, play, …)
const KVC = () => window.kv.community; // kv folder "community"
const worldStore = new WorldStore(window.kv);

/* ---------------------------------------------------------------------------
 * constants
 * ------------------------------------------------------------------------- */

const PAGE_SIZE = 24;
const UPDATE_CHECK_MS = 6 * 3600 * 1000; // throttle for the automatic library check
const JSON_WARN_BYTES = 12 * 1024 * 1024; // above this we warn; gzip usually makes it a non-issue
const JSON_MAX_BYTES = 24 * 1024 * 1024; // hard cap (the server enforces the same one)
const TAG_MAX_LEN = 24; // mirrors world.js TAG_MAX_LEN (kept local so an import rename can't break us)
const MAX_BLOCKED_TAGS = 60; // a reader's own blocklist — generous, but not unbounded
// Publishing gate: how much description a world must carry before it may go to Explore (see
// `descTooShort`). The description is the listing's pitch, and a one-liner reads as an unfinished
// listing next to everyone else's. Measured in UTF-8 bytes like every other listing cap, so it
// agrees with the world editor's byte counter.
const MIN_DESC_CHARS = 140;
// Publishing gate: how many author tags a world must carry before it may go to Explore (see
// `tagsTooFew`). Tags are how Explore filters and how readers find the world, and an untagged
// listing is effectively invisible next to everyone else's.
const MIN_TAGS = 3;
// How long our own catalog writes are ignored by the live-nudge listener (pub/sub echoes them back).
const NUDGE_SELF_MS = 4000;

// jsonUrl/coverUrl must live on the platform's own upload host (server enforces this too).
const ALLOWED_UPLOAD_HOSTS = ["user.uploads.dev", "editable.uploads.dev"];

function hasLink(text) {
  const s = String(text || "");
  const l = s.toLowerCase();
  if (s.indexOf("://") !== -1) return true;
  if (l.indexOf("hxxp") !== -1) return true;
  if (l.indexOf("www.") !== -1) return true;
  if (s.indexOf("[.]") !== -1 || s.indexOf("(.)") !== -1) return true;
  if (/(^|[\s\(\[{\"'“‘])(([A-Za-z0-9-]+\.)+[A-Za-z]{2,})(\/[^\s]*)?/.test(s)) return true;
  return false;
}

const MNO_USER_ID = "3490f80401886d12";
const isMnoAuthor = (userId, name) => String(userId || "").trim().toLowerCase() === MNO_USER_ID || String(name || "").trim().replace(/^@+/, "").toLowerCase() === "mnomno";
const authorUid = (userId, name) => String(userId || "").trim() || (isMnoAuthor("", name) ? MNO_USER_ID : "");
// The profile page uses this to also list the worlds that ship with the engine.
export function isEngineAuthorId(userId) { return String(userId || "").trim().toLowerCase() === MNO_USER_ID; }

// Profile-page content filtering: the same standing rules as Explore — the reader's blocked tags,
// muted authors and Show-NSFW preference all apply to every profile's world list.
export async function profileFilter() {
  const s = await getSettings();
  return {
    tags: (s.blockedTags || []).map((t) => String(t).toLowerCase()),
    users: s.mutedUsers || [],
    showNsfw: showNsfw(),
  };
}
export function profileWorldPasses(rec, f) {
  if (!f) return true;
  if (!f.showNsfw && rec.nsfw) return false;
  return passesBlocklists(rec, f);
}
export { isNsfwMeta };
export async function setUserMuted(userId, name, muted) {
  userId = String(userId || "");
  const s = await getSettings();
  const ids = (s.mutedUsers || []).slice();
  const names = Object.assign({}, s.mutedNames || {});
  const i = ids.indexOf(userId);
  if (muted && i === -1) ids.push(userId);
  if (!muted && i !== -1) ids.splice(i, 1);
  if (muted) { if (name) names[userId] = name; }
  else delete names[userId];
  await saveSettings({ mutedUsers: ids, mutedNames: names });
  return muted;
}
const mnoBadgeCover = `<div class="ld-wcover-chips"><span class="ld-wbadge ld-wbadge-cover" title="Official world by mnomno">✦ MNO</span></div>`;
const mnoBadgeHead = `<span class="ld-wbadge wd-badge" title="Official world by mnomno">✦ MNO</span>`;
const libRecLive = (rec) => !rec || !rec.status || (rec.status !== "removed" && rec.status !== "unknown");

const DEFAULT_SETTINGS = {
  blockedTags: [],
  mutedUsers: [],
  // Display names for the muted ids, so the Settings panel's list reads "@someone" instead of a hex id.
  // Ids are the only thing filtering ever uses (a rename can't break a mute); this is a name sidecar,
  // filled when you mute and backfilled from the local library where it can be.
  mutedNames: {},
  likedWorlds: [],
  // Worlds this device has reported. Permanent per-device block (stricter than the server's 72 h
  // window): one device can never report the same world twice, even after old reports age out.
  // The server still enforces its own dedupe + 10/day (5/day on proxy) rate limit.
  reportedWorlds: [],
  sort: "updated",
  defaultTags: [],
  lastUpdateCheckAt: 0
};

// Coded server errors → player-facing text. Anything unmapped falls through to the raw code so a
// new server error is still visible rather than silently swallowed.
const ERR_TEXT = {
  rate_limited: "You've reached today's limit for this action — it resets daily. Try again later.",
  catalog_full: "The community is full right now, so new worlds can't be published. Your world is safe on this device.",
  registry_full: "The username registry is full right now — new identities can't be claimed yet.",
  username_taken: "That username is taken. Try another.",
  username_invalid: "Usernames are 3–20 letters/numbers plus space, _ - or .",
  username_reserved: "That username is reserved.",
  rename_too_soon: "You can only rename once every 7 days.",
  username_required: "Claim a username before publishing.",
  userToken_invalid: "That device's identity didn't match — try again, or restore your creator code.",
  editToken_invalid: "This device can't edit that world (it wasn't published with this creator code).",
  world_exists: "A world with that id is already published.",
  bad_world_id: "That world id can't be published (its id must be a short slug).",
  bad_url_host: "Files must be hosted on the platform's upload host.",
  bad_notes_id: "The author's notes link looked wrong — try publishing again.",
  bad_json_hash: "The world file couldn't be verified — try publishing again.",
  bad_json_bytes: "The world file size looked wrong — try publishing again.",
  bad_edit_token: "Internal token error — please try again.",
  bad_link: "World listings can't include links or URLs.",
  not_found: "That world isn't published any more.",
  banned: "This device has been blocked from community writing — chat and publishing are off, but single-player still works.",
  appeal_too_soon: "You can appeal once every 30 days.",
  not_hidden: "That world isn't hidden — there's nothing to appeal.",
  report_pool_full: "Too many reports right now — try again later.",
  unauthorized: "Not authorised.",
  bad_request: "That request wasn't accepted."
};

/* ---------------------------------------------------------------------------
 * tiny utilities
 * ------------------------------------------------------------------------- */

// The catalog's appeal rule (index.html's APPEAL_DELAY_MS / APPEAL_DELAY_DAYS). The server owns the
// decision; the UI only has to state the rule honestly and count down to the date it hands back.
const APPEAL_DELAY_MS = 3 * 24 * 3600 * 1000;
const APPEAL_DELAY_DAYS = 3;
const daysUntil = (at) => Math.max(1, Math.ceil((at - Date.now()) / (24 * 3600 * 1000)));
const plural = (n, word) => n + " " + word + (n === 1 ? "" : "s");

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}
// Copy `text` to the clipboard. The copy itself goes through the platform's own copy-text-plugin
// (`copyTextPlugin`, imported in main.pjs) — the blessed mechanism, which wraps
// `navigator.clipboard.writeText` with a textarea/`execCommand("copy")` fallback for when the Clipboard
// API is missing entirely.
//
// The plugin is fire-and-forget, though: a refused write only reaches the console, so it can neither
// tell us whether the copy landed nor report it to the player. That matters in a generator, which runs
// in a CROSS-ORIGIN iframe whose `clipboard-write` grant depends on the host page (production grants it;
// the editor/preview frame does not). So we run our own attempt beneath it purely for the signal and the
// feedback: on success a toast, and when the clipboard is refused outright the text is shown in a
// read-only, pre-selected popup to be copied by hand. A "copy" that silently does nothing is the one
// outcome worth the extra lines.
function copyToClipboard(text, { okMsg = "📋 Copied.", title = "Copy", failMsg = "Couldn't reach the clipboard — press Ctrl/Cmd+C to copy." } = {}) {
  const legacy = () => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed; top:-1000px; left:-1000px; opacity:0;";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand("copy");
      ta.remove();
      return !!ok;
    } catch (e) { return false; }
  };
  const fail = () => {
    A().notify("✋ " + failMsg, { ms: 6000 });
    A().TextPopup.open({ title, value: text, rows: 1, readonly: true, cancelText: "Close" });
  };
  const done = (ok) => { ok ? A().notify(okMsg) : fail(); };
  // A refused write can be as simple as the frame not being focused (`writeText` rejects with
  // "Document is not focused"), which a click usually settles but a programmatic open may not.
  try { window.focus(); } catch (e) {}
  try { if (root.copyTextPlugin) root.copyTextPlugin(text); } catch (e) {}
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => done(true), () => done(legacy()));
      return;
    }
  } catch (e) { /* fall through to the legacy path */ }
  done(legacy());
}
function hex(bytes) {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += b.toString(16).padStart(2, "0");
  return s;
}
function hexToBytes(h) {
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
  return out;
}
function b64url(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64url(str) {
  const s = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
  return atob(s + "=".repeat((4 - (s.length % 4)) % 4));
}
function debounce(fn, ms) {
  let t = 0;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
function fmtBytes(n) {
  const b = Number(n) || 0;
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return (b / 1024).toFixed(b < 10 * 1024 ? 1 : 0) + " KB";
  return (b / (1024 * 1024)).toFixed(1) + " MB";
}
function fmtRel(ts) {
  const d = Date.now() - (Number(ts) || 0);
  if (!ts) return "";
  if (d < 60e3) return "just now";
  if (d < 3600e3) return Math.floor(d / 60e3) + "m ago";
  if (d < 86400e3) return Math.floor(d / 3600e3) + "h ago";
  if (d < 30 * 86400e3) return Math.floor(d / 86400e3) + "d ago";
  return new Date(Number(ts)).toLocaleDateString();
}
function errText(code) {
  return ERR_TEXT[code] || "That request wasn't accepted (" + code + ").";
}
// Publishing UI gate: server-state bans (server-bans.js, from getBans). The server
// still enforces it authoritatively — this only fails fast BEFORE any
// cover/notes/world uploads, with the same unified copy as the chat ban popup.
async function isPublishingBanned(userId) {
  try {
    const sb = await import("./server-bans.js");
    try { await sb.loadServerBans(); } catch (e) {}
    if (sb && typeof sb.isAppIdBanned === "function") return sb.isAppIdBanned(userId);
  } catch (e) {}
  return false;
}
async function blockIfPublishingBanned(userId) {
  let banned = false;
  try { banned = await isPublishingBanned(userId); } catch (e) { banned = false; }
  if (!banned) return false;
  try { A().notify("✖ " + ERR_TEXT.banned, { ms: 6000 }); } catch (e) {}
  try {
    await A().ConfirmPopup.open({
      title: "Banned",
      message: "You are banned from the Tavern and world comments. You can still use the app, but you can't publish or comment.",
      confirmText: "OK", cancelText: "Close"
    }).catch(() => {});
  } catch (e) {}
  return true;
}
function slugId(raw) {
  const s = String(raw || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return s.slice(0, META_ID_MAX) || "world";
}
function downloadText(filename, text, mime = "application/octet-stream") {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
}
function hostAllowed(url) {
  const s = String(url || "");
  if (!/^https:\/\//i.test(s)) return false;
  const host = s.slice(8).split(/[/?#]/)[0].toLowerCase();
  return ALLOWED_UPLOAD_HOSTS.indexOf(host) !== -1;
}

/* ---------------------------------------------------------------------------
 * identity
 * ------------------------------------------------------------------------- */

let identity = null; // { userId, secret, createdAt, formatVersion, username?, usernameClaimedAt? }
let hmacKey = null; // cached CryptoKey for the device secret

// Read (or mint, on first use) the device identity. The secret is 32 random bytes stored as hex;
// it never leaves the device.
async function getIdentity({ create = false } = {}) {
  if (identity) return identity;
  let u = await KVC().get("user");
  if (!u && create) {
    const secret = hex(crypto.getRandomValues(new Uint8Array(32)));
    u = { userId: (await sha256Hex(secret)).slice(0, 16), secret, createdAt: Date.now(), formatVersion: 1 };
    await KVC().set("user", u);
  }
  identity = u || null;
  return identity;
}
async function setIdentity(u) {
  identity = u;
  hmacKey = null;
  await KVC().set("user", u);
}

async function sha256Hex(text) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text))));
}
async function sha256HexBytes(bytes) {
  return hex(await crypto.subtle.digest("SHA-256", bytes));
}
async function hmacHex(msg) {
  if (!hmacKey) {
    const id = await getIdentity({ create: true });
    hmacKey = await crypto.subtle.importKey("raw", hexToBytes(id.secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  }
  return hex(await crypto.subtle.sign("HMAC", hmacKey, new TextEncoder().encode(msg)));
}
const userTokenFor = (userId) => hmacHex("mno-user:v1:" + userId);
const editTokenFor = (worldId) => hmacHex("mno-world-edit:v1:" + worldId);

// ---- creator code -------------------------------------------------
// `MNO1-<base64url({v,s,u,c})>` — the secret plus the userId (for validation) and a short
// checksum, so a truncated/edited code is rejected instead of silently minting a wrong identity.
async function creatorCode(id) {
  const payload = { v: 1, s: id.secret, u: id.userId };
  payload.c = (await sha256Hex(payload.s + "|" + payload.u)).slice(0, 8);
  return "MNO1-" + b64url(JSON.stringify(payload));
}
async function readCreatorCode(code) {
  const raw = String(code || "").trim().replace(/\s+/g, "");
  if (!raw.startsWith("MNO1-")) throw new Error("That doesn't look like a creator code (it should start with MNO1-).");
  let obj;
  try { obj = JSON.parse(unb64url(raw.slice(5))); } catch (e) { throw new Error("That creator code is damaged — please copy it again."); }
  if (!obj || obj.v !== 1 || !obj.s || !obj.u) throw new Error("That creator code is missing data.");
  const sum = (await sha256Hex(obj.s + "|" + obj.u)).slice(0, 8);
  if (sum !== obj.c) throw new Error("That creator code failed its checksum — please copy it again.");
  if ((await sha256Hex(obj.s)).slice(0, 16) !== obj.u) throw new Error("That creator code doesn't match its own identity.");
  return obj;
}

/* ---------------------------------------------------------------------------
 * kv-backed state (links / library / cache / settings / pendingDeletes)
 * ------------------------------------------------------------------------- */

let settingsCache = null;
let linksCache = null;
let libraryCache = null;
// True when the last library read hit a storage failure and returned a fallback empty
// (see getLibrary). While set, the setter refuses read-modify-write: rebuilding the
// monolith from `{}` would wipe every entry, which is worse than refusing one update.
// (The file cache needs no such flag: it is sharded per world — see libcache.js — so
// single-world writes are always safe.)
let libraryReadFailed = false;

async function getSettings() {
  if (!settingsCache) {
    let stored = {};
    try { stored = (await KVC().get("settings")) || {}; }
    catch (e) { console.warn("[community] settings unreadable, using defaults:", (e && e.message) || e); stored = {}; }
    settingsCache = Object.assign({}, DEFAULT_SETTINGS, stored);
    // Migration: `showNsfw` used to live in these settings. It now belongs to the toolbar's one
    // per-device preference (search-bar.js), shared with Worlds — so adopt an old value ONCE (only if
    // this browser has never made that choice elsewhere) and then drop the field, so a stale copy can
    // never argue with the switch.
    if ("showNsfw" in stored) {
      adoptStoredNsfw(stored.showNsfw === true);
      delete settingsCache.showNsfw;
      try { await KVC().set("settings", settingsCache); } catch (e) { /* best-effort migration */ }
    }
  }
  return settingsCache;
}
async function saveSettings(patch) {
  const s = Object.assign(await getSettings(), patch || {});
  settingsCache = s;
  await KVC().set("settings", s);
  return s;
}

// The worlds YOU have liked, as a Set so a card can test it synchronously while rendering.
// It's persisted in settings (per device, like the other reader prefs) and re-hydrated whenever the
// Explore page loads settings; the server owns the count, this only owns your ♥/♡ state.
let likedSet = new Set();
let likedHydrated = false;
const hydrateLiked = (s) => { likedSet = new Set((s && s.likedWorlds) || []); likedHydrated = true; };
// Profile cards share Explore's like control but can render (and toggle) without Explore ever having
// mounted — and a fresh module starts with an EMPTY set. Hydrating lazily on first need keeps a
// profile-page like from overwriting the stored list with just the one world.
export async function ensureLiked() {
  if (likedHydrated) return;
  try { hydrateLiked(await getSettings()); }
  catch (e) { likedHydrated = true; }
}
// Worlds THIS device has reported. Permanent per-device block, persisted in settings like likes.
// Checked before the RPC so a second tap never spends the daily report allowance, and written
// after any server-reported outcome (reported / alreadyReported / hidden) so a device that
// reported from another tab still can't re-report.
let reportedSet = new Set();
let reportedHydrated = false;
const hydrateReported = (s) => { reportedSet = new Set((s && s.reportedWorlds) || []); reportedHydrated = true; };
export async function ensureReported() {
  if (reportedHydrated) return;
  try { hydrateReported(await getSettings()); }
  catch (e) { reportedHydrated = true; }
}
async function markReportedLocally(worldId) {
  try {
    await ensureReported();
    if (reportedSet.has(worldId)) return;
    reportedSet.add(worldId);
    await saveSettings({ reportedWorlds: [...reportedSet] });
  } catch (e) {}
}
async function getLinks() {
  if (!linksCache) {
    try { linksCache = (await KVC().get("links")) || {}; }
    catch (e) { console.warn("[community] links unreadable, using empty:", (e && e.message) || e); linksCache = {}; }
  }
  return linksCache;
}
async function setLink(metaId, rec) {
  const all = await getLinks();
  if (rec === null) delete all[metaId];
  else all[metaId] = rec;
  await KVC().set("links", all);
}
// Watch-list backfill source: this device's published worlds. Link records carry
// the worldId (minted as `<userId>-<slug>`, so the prefix proves authorship) and
// the title — everything the watch list needs, no catalog round-trip.
// Always `ready` once the identity store answers (even empty — no identity means
// no published worlds); `ready:false` only on a storage failure, so the caller
// retries instead of treating it as "nothing to watch".
export async function listOwnPublishedWorlds() {
  try {
    const id = await getIdentity({ create: false });
    if (!id || !id.userId) return { ready: true, items: [] };
    const links = await getLinks();
    const items = [];
    for (const l of Object.values(links || {})) {
      if (!l || l.status !== "published" || !l.worldId) continue;
      if (String(l.worldId).indexOf(id.userId + "-") !== 0) continue;
      items.push({ worldId: String(l.worldId), title: String(l.title || "Untitled") });
    }
    return { ready: true, items };
  } catch (e) { return { ready: false, items: [] }; }
}

// First-publish backup nudge: shown once, after the identity's first world goes live, as a
// reminder to back up the creator code (Settings → Identity). Stored per identity so a second
// identity on the same device still gets its own reminder, while a legacy global `true` (should
// one ever exist) counts as seen for everyone.
async function firstPublishBackupSeen(userId) {
  try {
    const v = await KVC().get("firstPublishBackupSeen");
    if (v === true) return true;
    if (v && typeof v === "object" && userId && v[userId]) return true;
    return false;
  } catch (e) { return false; }
}
async function markFirstPublishBackupSeen(userId) {
  try {
    const v = await KVC().get("firstPublishBackupSeen");
    if (v === true) return;
    const obj = (v && typeof v === "object") ? v : {};
    if (userId) obj[userId] = true;
    else obj.__global = true;
    await KVC().set("firstPublishBackupSeen", obj);
  } catch (e) {}
}
// Show the backup reminder after a fresh publish when this is the identity's first live world.
// Marks seen first so concurrent publishes can't double-show, and veterans (2+ live links)
// are marked silently without a popup.
async function maybeShowFirstPublishBackupNudge(userId) {
  if (await firstPublishBackupSeen(userId)) return;
  await markFirstPublishBackupSeen(userId);
  let publishedCount = 0;
  try {
    const links = await getLinks();
    for (const k of Object.keys(links)) {
      if (links[k] && links[k].status === "published") publishedCount++;
    }
  } catch (e) {}
  if (publishedCount !== 1) return;
  let pick = null;
  try {
    pick = await choosePopup({
      title: "🎉 First world published!",
      message: `Congratulations! Your world is live in Explore.<br><br>⚠️ <b>Back up your creator code now</b> — it's the only way to edit or update your worlds on a new device or browser.<br><br>You can find it any time in <b>Settings → Identity</b>.`,
      options: [
        { label: "Later", value: null },
        { label: "Open Settings → Identity", value: "identity", kind: "ok" }
      ]
    });
  } catch (e) { pick = null; }
  if (pick === "identity") {
    try { A().openSettingsPanel("identity"); } catch (e) {}
  }
}
async function getLibrary() {
  // Resilient: the library is one kv value, so a single unreadable value (e.g. Chrome's
  // "Failed to read large IndexedDB value" once the cache/blob outgrows incognito) must read
  // as empty — never throw into Explore/Worlds detail panels or remove flows. Failures are NOT
  // cached, so a transient close retries on the next call.
  // `libraryReadFailed` marks a FALLBACK empty (see below): the value couldn't be read, so a
  // read-modify-write from this `{}` would wipe every entry. Setters refuse while it is set.
  if (!libraryCache) {
    try { libraryCache = (await KVC().get("library")) || {}; libraryReadFailed = false; }
    catch (e) { console.warn("[community] library unreadable, using empty:", (e && e.message) || e); libraryReadFailed = true; return {}; }
  }
  return libraryCache;
}
async function setLibraryRec(worldId, rec) {
  if (libraryReadFailed && !libraryCache) {
    const err = new Error("Couldn't update the added-worlds list — the saved list can't be read in this browser right now (often incognito's smaller storage once many worlds are saved). Nothing was deleted.");
    err.isStorageUnavailable = true;
    throw err;
  }
  const all = await getLibrary();
  if (rec === null) delete all[worldId];
  else all[worldId] = Object.assign({}, all[worldId], rec);
  await KVC().set("library", all);
  emit("library");
  return all[worldId];
}
// One world's saved copy (see libcache.js — sharded per world, so an unreadable entry reads
// as missing instead of failing every Explore/Worlds/remove flow, and deleting one key can
// never wipe the rest). Reads never throw; writes propagate storage errors to the caller.
async function getCache(worldId) {
  return await libGetCacheEntry(KVC(), worldId);
}
async function setCacheEntry(worldId, entry) {
  await libSetCacheEntry(KVC(), worldId, entry);
}
// Best-effort blob deletion. Failures inside the 3-day window are queued for a later retry.
async function tryDeleteBlob(deletionUrl, ctx) {
  if (!deletionUrl) return true;
  try {
    const r = await fetch(deletionUrl).then((x) => x.json());
    if (r && r.success) return true;
  } catch (e) { /* fall through to the queue */ }
  await queuePendingDelete(Object.assign({ deletionUrl }, ctx || {}));
  return false;
}
async function queuePendingDelete(entry) {
  const list = (await KVC().get("pendingDeletes")) || [];
  list.push(Object.assign({ uploadedAt: Date.now() }, entry));
  await KVC().set("pendingDeletes", list);
}
// Retried when the community module loads (never at synchronous boot). Past the 3-day window the
// deletion is impossible, so the entry is simply dropped.
async function retryPendingDeletes() {
  const list = (await KVC().get("pendingDeletes")) || [];
  if (!list.length) return;
  const keep = [];
  for (const e of list) {
    const age = Date.now() - (Number(e.uploadedAt) || 0);
    if (age > 3 * 24 * 3600 * 1000) continue; // window closed — nothing can be done
    let ok = false;
    try { const r = await fetch(e.deletionUrl).then((x) => x.json()); ok = !!(r && r.success); } catch (err) { ok = false; }
    if (!ok) keep.push(e);
  }
  await KVC().set("pendingDeletes", keep);
}

// A tiny event bus so the Explore page, the landing "Added" section, and the library badge stay
// in sync without any of them owning the others.
const listeners = new Set();
function emit(type, detail) { for (const fn of [...listeners]) { try { fn(type, detail); } catch (e) {} } }
function onEvent(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/* ---------------------------------------------------------------------------
 * gzip (CompressionStream) + upload-plugin helpers
 * ------------------------------------------------------------------------- */

function gzipAvailable() {
  return typeof CompressionStream === "function" && typeof DecompressionStream === "function";
}
async function gzipBlob(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return await new Response(stream).blob();
}
async function readWorldBlob(url, encoding) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("download_failed");
  const buf = await res.arrayBuffer();
  if (encoding === "gzip") {
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
    return await new Response(stream).text();
  }
  return new TextDecoder().decode(buf);
}
// Is the world file the catalog points at still on the upload host? Publishing trusts the URL it was
// handed and nothing re-checks it afterwards, while `unpublishWorld` deletes the blob and a revive (or
// a listing push from a device whose link record is stale) keeps the stored URL — so a live listing
// can point at a file that no longer exists, and every reader's download fails (§6.14). A push is the
// author's one chance to heal that, so it verifies first. Only a definite 404/410 counts as missing:
// offline, blocked, a CORS refusal or a host hiccup all answer "still there", so a bad connection can
// never trigger a needless re-upload.
async function blobMissing(url) {
  const raw = String(url || "").trim();
  if (!raw) return true;
  const probe = async (method) => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    try {
      const res = await fetch(raw, { method, signal: ctl.signal, headers: method === "GET" ? { Range: "bytes=0-0" } : undefined });
      return res.status === 404 || res.status === 410;
    } catch (e) {
      return false; // unknown — assume the file is still there
    } finally { clearTimeout(t); }
  };
  if (await probe("HEAD")) return true;
  return await probe("GET"); // a host that won't answer HEAD still has to answer a ranged GET
}
// Verify a just-uploaded world blob actually landed before the catalog is pointed at it.
// The upload plugin can report success for a URL that then 404s / truncates for every reader
// (host glitch, propagation delay), and the server only checks host/format/size — so without
// this, publish succeeds with a dead jsonUrl and nobody can download until the next content push.
// Fetches the URL back and compares its SHA-256 against the bytes we sent. A hash mismatch fails
// fast (re-fetching the same URL can't fix wrong bytes); a fetch failure retries a few times to
// tolerate propagation delay. Throws a player-facing Error on failure.
async function verifyUploadedBlob(url, encoding, expectedHash, onBusy = () => {}) {
  const TRIES = 3;
  let lastErr = null;
  for (let attempt = 1; attempt <= TRIES; attempt++) {
    try {
      const text = await readWorldBlob(url, encoding);
      const got = await sha256Hex(text);
      if (got !== expectedHash) throw new Error("hash_mismatch");
      return;
    } catch (e) {
      lastErr = e;
      if (e && e.message === "hash_mismatch") {
        throw new Error("The upload came back with the wrong contents (checksum mismatch) — try publishing again. Your world is safe on this device.");
      }
      if (attempt < TRIES) {
        onBusy("Verifying upload (retry " + (attempt + 1) + "/" + TRIES + ")…");
        await new Promise((r) => setTimeout(r, 1200 * attempt));
        continue;
      }
      throw new Error("The upload didn't land on the download host (" + downloadFailText((lastErr && lastErr.message) || "download_failed") + ") — try publishing again. Your world is safe on this device.");
    }
  }
}
// The tail of the upload queue. Never null once an upload has been attempted.
let uploadChain = Promise.resolve();
async function uploadBlob(data, name) {
  // The upload host handles one anon upload at a time per page: a second concurrent upload fails
  // with `another_upload_in_progress` (surfaced by the plugin as its own red toast). Serialize all
  // blob uploads through this chain so a double-clicked Publish (or cover+world racing) queues
  // instead of colliding. The chain is never left broken by a failure.
  const task = uploadChain.then(() => uploadBlobInner(data));
  uploadChain = task.catch(() => {});
  return task;
}
async function uploadBlobInner(data) {
  const MAX_TRIES = 6;
  for (let attempt = 1; ; attempt++) {
    const r = await window.uploadPlugin(data);
    if (r && !r.error) {
      // `String(...)` is not cosmetic: the upload plugin hands its `url`/`deletionUrl` back as String
      // OBJECTS, and a String object never `===` an identical plain string — which silently broke the
      // cover comparison in the change detection and anything else that compared a stored URL.
      return { url: String(r.url || ""), size: Number(r.size) || 0, deletionUrl: r.deletionUrl ? String(r.deletionUrl) : "" };
    }
    const code = String((r && r.error) || "failed");
    if (isUploadBusyError(code) && attempt < MAX_TRIES) {
      // Another upload (this tab's, or another tab's) still holds the host lock. Back off and retry —
      // the queued upload usually lands once the in-flight one finishes.
      await new Promise((res) => setTimeout(res, 700 * attempt + Math.random() * 400));
      continue;
    }
    throw new Error(friendlyUploadError(code));
  }
}
function isUploadBusyError(code) {
  const c = String(code || "").toLowerCase();
  return c.indexOf("another") !== -1 && c.indexOf("progress") !== -1
    || c.indexOf("already") !== -1 && c.indexOf("upload") !== -1
    || c === "upload_in_progress" || c === "busy" || c === "rate_limited";
}
// The plugin's raw codes (e.g. `another_upload_in_progress`) mean nothing to a player, so map the
// ones a publish can hit to a sentence. Unknown codes keep their text, without the `upload:` prefix.
function friendlyUploadError(code) {
  const c = String(code || "failed");
  if (isUploadBusyError(c)) return "Another upload is still finishing — wait a few seconds and try again. Your world is safe on this device.";
  if (c === "file_too_big" || c === "over_daily_allowance") return "That upload was refused (" + c.replaceAll("_", " ") + ") — try a smaller cover, or try again tomorrow.";
  return "Couldn't upload the world file (" + c.replaceAll("_", " ") + ") — check your connection and try again. Your world is safe on this device.";
}
// Best-effort NSFW check on a cover image (upload-host files only). Failure = no signal, never a
// blocked publish.
async function coverLooksNsfw(url) {
  if (!url) return false;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    const info = await fetch("https://upload.perchance.org/api/fileInfo?url=" + encodeURIComponent(url), { signal: ctl.signal })
      .then((r) => r.json()).finally(() => clearTimeout(t));
    return !!(info && Array.isArray(info.tags) && info.tags.indexOf("nsfw") !== -1);
  } catch (e) { return false; }
}

/* ---------------------------------------------------------------------------
 * socket lifecycle
 * ------------------------------------------------------------------------- */

let socket = null; // the live socket, or null
let connPromise = null; // in-flight connection attempt
let socketClosedInfo = null; // { code, reason } for the UI banner
let keepaliveTimer = null; // 20s ping while a long-lived socket is wanted (Explore / admin)
const KEEPALIVE_MS = 20000;

// Permanent close codes: retrying (or pinging) can never help, so don't.
function isPermanentCloseCode(code) {
  return code === 4403 || code === 4429;
}

// True while something wants a long-lived socket: Explore on screen, or an admin/mod session
// (whose server flag lives on the connection). Short-lived RPCs must never start the timer.
function keepaliveWanted() {
  try {
    if (adminAuthed || modAuthed) return true;
  } catch (e) {}
  try {
    if (!ex.open || !ex.el || !ex.el.isConnected) return false;
    // Paused for play (grid behind the wizard): no idle socket is kept while a session is on.
    if (A() && A().inSession && A().inSession()) return false;
    return true;
  } catch (e) { return false; }
}

function stopKeepalive() {
  if (keepaliveTimer) { clearInterval(keepaliveTimer); keepaliveTimer = null; }
}

function maybeStopKeepalive() {
  let wanted = false;
  try { wanted = keepaliveWanted(); } catch (e) { wanted = false; }
  if (!wanted) stopKeepalive();
}

// Re-subscribe the live catalog feed. Subscriptions die with the socket, so any (re)connect
// while Explore is open must re-watch or live nudges silently stop.
async function ensureWatch() {
  try {
    if (!ex.open) return;
    if (!socket || socket.readyState !== 1) return;
    await socket.rpc.watchCatalog(JSON.stringify({}));
  } catch (e) { /* next tick or next rpc retries */ }
}

function ensureKeepalive() {
  let wanted = false;
  try { wanted = keepaliveWanted(); } catch (e) { wanted = false; }
  if (!wanted || keepaliveTimer) return;
  keepaliveTimer = setInterval(async () => {
    let w = false;
    try { w = keepaliveWanted(); } catch (e) { w = false; }
    if (!w) { stopKeepalive(); return; }
    if (connPromise) return; // a connect is already in flight
    try {
      await rpc("ping", {});
      await ensureWatch();
    } catch (e) {
      // rpc() already retried once; if we're still down the next tick tries again.
    }
  }, KEEPALIVE_MS);
}

function onSocketClose(ev) {
  socket = null;
  socketClosedInfo = { code: (ev && ev.code) || 0, reason: (ev && ev.reason) || "" };
  // The server authorizes admin/mod PER CONNECTION, so a socket that
  // drops takes the session with it. Drop the flags and say so — leaving 🔑 controls on screen after
  // the authorization is gone would only offer buttons that can't work.
  if (adminAuthed || modAuthed) {
    adminAuthed = false;
    modAuthed = false;
    A().notify("🔑 Signed out — the connection dropped.", { ms: 4600 });
    emit("admin");
  }
  emit("socket", socketClosedInfo);
  // A drop while Explore/admin still wants the socket restarts the timer so the tick reconnects
  // proactively; after an intentional disconnect this is a no-op.
  try { ensureKeepalive(); } catch (e) {}
}
async function connect() {
  if (socket && socket.readyState === 1) { ensureKeepalive(); return socket; }
  if (connPromise) return connPromise;
  socketClosedInfo = null;
  connPromise = (async () => {
    const s = window.createServerSocket();
    s.addEventListener("close", onSocketClose);
    // Live catalog nudges arrive as ordinary socket messages (server-plugin pub/sub).
    s.addEventListener("message", (ev) => onCatalogMessage(ev.data));
    await s.opened; // rejects when the initial connection fails
    socket = s;
    ensureKeepalive();
    return s;
  })().finally(() => { connPromise = null; });
  return connPromise;
}
function disconnect() {
  // A signed-in admin/mod session NEEDS its connection — the server flag lives on it, and
  // closing the socket would silently sign out. So the ordinary "nobody needs this socket"
  // path refuses while signed in; the Sign out button (`adminDispose`) clears the flag first and then
  // gets to close it.
  if (adminAuthed || modAuthed) { try { ensureKeepalive(); } catch (e) {} return; }
  if (socket) {
    try { socket.close(1000, "leaving"); } catch (e) {}
    socket = null;
  }
  maybeStopKeepalive();
}
function transportError(e) {
  const err = new Error(transportMsg(e));
  err.transport = true;
  err.code = (socketClosedInfo && socketClosedInfo.code) || (e && (e.code || e.status)) || 0;
  return err;
}
function isTransportFailure(e) {
  // The server always answers {ok:true/false}; a rejection is transport (close mid-flight,
  // InvalidStateError, opened rejection). Application refusals resolve with ok:false and throw
  // an err.code above — never retried here.
  if (!e || e.transport) return true;
  if (e.name === "InvalidStateError" || e.name === "NetworkError") return true;
  const m = String((e && e.message) || "");
  if (/InvalidStateError|not open|closed|close|network|failed to connect|socket/i.test(m)) return true;
  return false;
}
async function rpc(method, payload) {
  // One transparent retry on transport failure (e.g. an idle-killed socket showing 1006): reconnect
  // once and re-issue. Application refusals (ok:false) and permanent closes (4403/4429) never retry.
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    let s;
    try {
      s = await connect();
    } catch (e) {
      lastErr = transportError(e);
      if (isPermanentCloseCode(socketClosedInfo && socketClosedInfo.code)) break;
      socket = null; connPromise = null;
      continue;
    }
    try {
      const raw = await s.rpc[method](JSON.stringify(payload || {}));
      let out;
      try {
        out = JSON.parse(raw);
      } catch (e) {
        lastErr = transportError(e);
        if (isPermanentCloseCode(socketClosedInfo && socketClosedInfo.code)) break;
        try { try { s.close(); } catch (_) {} } catch (_) {}
        if (socket === s) socket = null;
        connPromise = null;
        continue;
      }
      if (!out || out.ok !== true) {
        const err = new Error(errText((out && out.error) || "bad_request"));
        err.code = (out && out.error) || "bad_request";
        throw err;
      }
      if (attempt > 0 && method !== "watchCatalog") ensureWatch();
      return out;
    } catch (e) {
      if (e && e.code && !e.transport) throw e; // application refusal — never retry
      lastErr = (e && e.transport) ? e : transportError(e);
      if (isPermanentCloseCode(socketClosedInfo && socketClosedInfo.code)) break;
      try { try { s.close(); } catch (_) {} } catch (_) {}
      if (socket === s) socket = null;
      connPromise = null;
    }
  }
  throw lastErr || transportError(null);
}
// Like rpc(), but transparently recovers from `username_required`: the catalog has no claim for
// this identity when a creator code was restored onto a device whose catalog never saw it, or
// after a server-side reset. Re-claim the same name and retry once rather than dead-ending on a
// failure the player can't fix themselves. Used by every catalog write.
async function rpcClaiming(method, payload) {
  try { return await rpc(method, payload); }
  catch (e) {
    if (e.code !== "username_required") throw e;
    const id = await getIdentity({ create: false });
    // The recovery popup has to be usable even when this call came from a flow that already has its
    // busy overlay up (the popup sits above it in z-index, and the overlay's text explains the wait).
    if (activeBusy) activeBusy.lend("Waiting for a username…", "You need a username before this can go live.");
    let claimed;
    try { claimed = await claimUsernamePopup({ required: true, current: (id && id.username) || "" }); }
    finally { if (activeBusy) activeBusy.unlend(); }
    if (!claimed) throw Object.assign(new Error("Cancelled."), { cancelled: true });
    return await rpc(method, payload);
  }
}
// Human-readable message for a transport failure (close code included when we have one).
function transportMsg(e) {
  const code = socketClosedInfo && socketClosedInfo.code;
  if (code === 1011) return "The community server failed to start. Please retry in a moment.";
  if (code === 4403) return "Community features only work on perchance.org (this page is embedded elsewhere).";
  if (code === 4429) return "Community features are temporarily paused (too many errors). Try again later.";
  if (code === 1006) return "The community connection dropped (code 1006 — usually a transient network hiccup).";
  return "Couldn't reach the community" + (code ? " (connection closed, code " + code + ")" : "") + ". Check your connection and retry.";
}

/* ---------------------------------------------------------------------------
 * username claim / rename
 * ------------------------------------------------------------------------- */

// Local, offline pre-validation (mirrors the server's rules so we can fail fast).
function validateUsername(name) {
  const n = String(name || "").trim();
  if (n.length < 3 || n.length > 20) return "Usernames are 3–20 characters.";
  if (!/^[\p{L}\p{N}][\p{L}\p{N} _.\\-]*[\p{L}\p{N}]$/u.test(n)) return "Letters and numbers only, plus space, _ - or . in the middle.";
  return "";
}

// Ask for a username (with a live availability check) and claim it. Resolves with the username, or
// null when the player cancels. `required` shows the "needed to publish" framing.
function claimUsernamePopup({ required = false, current = "" } = {}) {
  return new Promise(async (resolve) => {
    // `ex-user-ov` lifts this above the busy overlay — a username claim can interrupt a
    // publish in flight (the `username_required` recovery), and it must stay clickable there.
    const overlay = el("div", "cc-overlay ex-user-ov");
    overlay.innerHTML = `
      <div class="cc-panel ex-user-panel" tabindex="-1">
        <div class="cc-head">
          <span class="cc-title">${required ? "👤 Choose a username" : "👤 Your username"}</span>
          <button class="popup-x ex-user-cancel" title="Close">✕</button>
        </div>
        <div class="cc-body">
          <p class="cc-hint">${required
            ? "Published worlds are signed with a unique username. Pick one now — it's how other players will see you."
            : "Your unique display name on published worlds. You can rename once every 7 days; the old name is freed for others to use."}</p>
          <div class="cc-row">
            <input class="ex-user-input" type="text" maxlength="20" placeholder="e.g. Aria the Grey" value="${esc(current)}" autocomplete="off">
            <span class="ex-user-state"></span>
          </div>
          <div class="ex-user-msg cc-err"></div>
        </div>
        <div class="cc-foot">
          <button class="mini ex-user-cancel">Cancel</button>
          <button class="mini ok ex-user-ok">${required ? "Claim & continue" : "Save"}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const release = pushBackClose(() => done(null));
    overlay.querySelector(".cc-panel").focus();
    const input = overlay.querySelector(".ex-user-input");
    const state = overlay.querySelector(".ex-user-state");
    const msg = overlay.querySelector(".ex-user-msg");
    const okBtn = overlay.querySelector(".ex-user-ok");
    let available = null; // null = unknown, true/false = last server answer
    let closed = false;
    const done = (v) => { if (closed) return; closed = true; release(); overlay.remove(); resolve(v); };

    const check = debounce(async () => {
      const name = input.value.trim();
      available = null;
      state.textContent = "";
      state.className = "ex-user-state";
      const local = validateUsername(name);
      if (local) { msg.textContent = local; return; }
      msg.textContent = "";
      // The name you already hold comes back from the registry as "taken" — taken by YOU. That is not
      // an error (the popup opens on it, prefilled), so answer it locally instead of letting the check
      // report a collision with yourself.
      if (current && name.toLowerCase() === current.toLowerCase()) {
        available = true;
        state.textContent = "✓ current";
        state.className = "ex-user-state ok";
        return;
      }
      state.textContent = "…";
      try {
        const r = await rpc("checkUsername", { username: name });
        available = !!r.available;
        state.textContent = r.available ? "✓ free" : "✕ taken";
        state.className = "ex-user-state" + (r.available ? " ok" : " bad");
        if (!r.available) msg.textContent = ERR_TEXT[r.reason] || "That username isn't available.";
      } catch (e) {
        state.textContent = "";
        msg.textContent = e.message;
      }
    }, 320);
    input.addEventListener("input", check);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
    overlay.querySelectorAll(".ex-user-cancel").forEach((b) => (b.onclick = () => done(null)));
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) done(null); });
    overlay.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); done(null); } });
    input.focus();

    async function submit() {
      const name = input.value.trim();
      const local = validateUsername(name);
      if (local) { msg.textContent = local; return; }
      // Keeping the name you already have is not a rename — nothing to ask the registry, and the name
      // is not given up. Close with it as it stands (also saves a rename from eating the 7-day cooldown).
      if (current && name.toLowerCase() === current.toLowerCase()) { done(current); return; }
      if (available === false) { msg.textContent = "That username is taken."; return; }
      okBtn.disabled = true;
      okBtn.textContent = "…";
      try {
        const id = await getIdentity({ create: true });
        const token = await userTokenFor(id.userId);
        const r = await rpc("claimUsername", { userId: id.userId, token, username: name });
        const renamed = !!id.username && id.username !== r.username;
        await setIdentity(Object.assign({}, id, { username: r.username, usernameLower: r.username.toLowerCase(), usernameClaimedAt: Date.now() }));
        // A rename must follow through to the local worlds we made, whose author line is a snapshot of
        // this name (README §6.9). They are found by the stable `meta.authorId`, so this is exact —
        // and it is why renaming doesn't have to guess by string-matching an old name.
        if (renamed) await A().reconcileWorldAuthors?.();
        // The Tavern locks its nick field to the claimed name — tell it, so a claim/rename
        // made while the panel stands open applies instantly (discussion.js listens).
        try { window.dispatchEvent(new CustomEvent("mno:identity", { detail: { username: r.username } })); } catch (e2) {}
        done(r.username);
      } catch (e) {
        msg.textContent = e.message;
        okBtn.disabled = false;
        okBtn.textContent = required ? "Claim & continue" : "Save";
      }
    }
    okBtn.onclick = submit;
    if (current) check();
  });
}

// Ensure an identity + claimed username exist (used by every publish path). The catalog is the
// authority on the claim, so this also *confirms* it with one cheap read: a creator-code restore onto
// a fresh device, or a server-side reset, leaves the local record saying "claimed" while the catalog
// has never heard of this identity — and then the claim popup must come up HERE, before the writing
// starts, not as a recovery in the middle of an upload.
async function ensureIdentityAndName() {
  const id = await getIdentity({ create: true });
  if (id.username && id.usernameClaimedAt) {
    let server = null;
    try { server = (await rpc("getUser", { userId: id.userId })).user || null; }
    catch (e) { if (e.code !== "not_found") throw e; }
    if (server && server.username) {
      if (server.username === id.username) return id;
      // The claim lives on, but under a different name (renamed from another device): take the
      // catalog's word for it so the published listing is signed with the name that actually exists.
      const fresh = Object.assign({}, id, {
        username: server.username, usernameLower: server.username.toLowerCase(),
        usernameClaimedAt: server.claimedAt || id.usernameClaimedAt
      });
      await setIdentity(fresh);
      // Our local worlds carry that old name as a snapshot, so bring them in step too (§6.9).
      await A().reconcileWorldAuthors?.();
      return fresh;
    }
  }
  const name = await claimUsernamePopup({ required: true, current: id.username || "" });
  if (!name) throw Object.assign(new Error("Cancelled."), { cancelled: true });
  return await getIdentity();
}

/* ---------------------------------------------------------------------------
 * cover pre-flight
 * ------------------------------------------------------------------------- */

// Generic multi-option popup (ConfirmPopup only offers OK/Cancel, and the cover gate needs three).
function choosePopup({ title, message, options }) {
  return new Promise((resolve) => {
    const overlay = el("div", "cc-overlay");
    overlay.innerHTML = `
      <div class="cc-panel ex-choose" tabindex="-1">
        <div class="cc-head"><span class="cc-title">${esc(title)}</span><button class="popup-x ex-ch-cancel" title="Close">✕</button></div>
        <div class="cc-body"><p class="cc-hint">${message}</p></div>
        <div class="cc-foot">
          ${options.map((o, i) => `<button class="mini${o.kind === "ok" ? " ok" : ""}${o.kind === "warn" ? " warn" : ""}" data-i="${i}">${esc(o.label)}</button>`).join("")}
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const release = pushBackClose(() => done(null));
    overlay.querySelector(".cc-panel").focus();
    let closed = false;
    const done = (v) => { if (closed) return; closed = true; release(); overlay.remove(); resolve(v); };
    overlay.querySelectorAll("[data-i]").forEach((b) => (b.onclick = () => done(options[Number(b.dataset.i)].value)));
    overlay.querySelector(".ex-ch-cancel").onclick = () => done(null);
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) done(null); });
    overlay.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); done(null); } });
  });
}

// Cover data-URL → upload Blob (see image-utils.js dataUrlToWebpBlob): an editor-made WebP
// within the cap converts straight to bytes with no second-generation re-encode (canvas WebP
// carries no EXIF, so there is nothing to strip); anything else re-encodes through canvas,
// which strips metadata and outputs WebP. Returns a Blob and never touches base64 in JS
// (fetch() decodes it natively, createImageBitmap decodes off the main thread, toBlob encodes
// async). Named ...ToBlob because the old downscaleDataUrl name lied about the return type.
async function downscaleToWebpBlob(dataUrl, maxDim = COVER_MAX_DIM, quality = COVER_WEBP_QUALITY) {
  try {
    return await dataUrlToWebpBlob(dataUrl, { maxDim, quality });
  } catch (e) {
    throw new Error("Couldn't process that cover image.");
  }
}

// Prepare the world file's `meta.cover` for the catalog WITHOUT touching the network: either it is
// already a catalog-legal hosted URL, or a local image is picked/downscaled and handed back as a
// blob for `commitCover` to upload. Every interactive decision lives here — the foreign-host gate and
// the file picker — so it all happens before the publishing overlay exists (checks before
// uploads). Returns { url } | { pending: {blob, label} } | { cancel: true }.
async function prepareCover(meta) {
  const raw = String((meta && meta.cover) || "").trim();
  if (!raw) {
    const pick = await choosePopup({
      title: "A cover image is required",
      message: "Worlds can't be published without a cover image. Upload one to continue.",
      options: [
        { label: "⬆ Upload a cover image", value: "upload", kind: "ok" },
        { label: "Cancel", value: null }
      ]
    });
    if (pick !== "upload") return { cancel: true };
    const { pickImageFile } = await import("./image-utils.js");
    const f = await pickImageFile();
    if (!f) return { cancel: true };
    // Blob-direct: File → createImageBitmap (off-thread decode) → canvas → toBlob. Always
    // re-encodes to WebP, so EXIF/XMP is stripped; no base64 round-trip anywhere.
    const { fileToWebpBlob } = await import("./image-utils.js");
    const blob = await fileToWebpBlob(f, { maxDim: COVER_MAX_DIM, quality: COVER_WEBP_QUALITY });
    return { pending: { blob, label: "cover.webp" } };
  }
  if (hostAllowed(raw)) return { url: raw };
  if (/^data:/i.test(raw)) {
    const blob = await downscaleToWebpBlob(raw);
    return { pending: { blob, label: "cover.webp" } };
  }
  if (/^https?:\/\//i.test(raw)) {
    try {
      const res = await fetch(raw);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      if (!blob || !blob.size || blob.size > 15 * 1024 * 1024) throw new Error("too big");
      if (blob.type && blob.type.toLowerCase().indexOf("image/") !== 0) throw new Error("not an image");
      // Blob-direct: no FileReader base64 step — decode the fetched bytes straight to a
      // downscaled WebP Blob (re-encode strips any metadata from the foreign host).
      const small = await blobToWebpBlob(blob, { maxDim: COVER_MAX_DIM, quality: COVER_WEBP_QUALITY });
      return { pending: { blob: small, label: "cover.webp" } };
    } catch (e) {}
  }
  const choice = await choosePopup({
    title: "Cover image isn't on the upload host",
    message: `Published covers must be hosted on the platform's own upload host (<b>user.uploads.dev</b>), but this world's cover points at <b>${esc(raw.slice(0, 90))}</b>.<br><br>Upload a copy of your own image to continue.`,
    options: [
      { label: "⬆ Upload a cover image", value: "upload", kind: "ok" },
      { label: "Cancel", value: null }
    ]
  });
  if (choice === "upload") {
    const { pickImageFile } = await import("./image-utils.js");
    const f = await pickImageFile();
    if (!f) return { cancel: true };
    const { fileToWebpBlob } = await import("./image-utils.js");
    const blob = await fileToWebpBlob(f, { maxDim: COVER_MAX_DIM, quality: COVER_WEBP_QUALITY });
    return { pending: { blob, label: "cover.webp" } };
  }
  return { cancel: true };
}

// The only network step of the cover gate: upload a prepared local image, and screen the resolved
// URL for a NSFW tag (best effort — a failure is never a blocked publish).
async function commitCover(prepared, onBusy = () => {}) {
  if (!prepared.pending) {
    const url = prepared.url || "";
    return { url, nsfw: url ? await coverLooksNsfw(url) : false };
  }
  onBusy("Uploading cover…");
  const up = await uploadBlob(prepared.pending.blob, prepared.pending.label);
  const nsfw = await coverLooksNsfw(up.url);
  return { url: up.url, nsfw, uploaded: up };
}

// Author's notes, prepared WITHOUT touching the network (mirrors prepareCover's shape, minus the
// interactive picker — notes are typed in the world editor, and they're optional, so "" is a
// valid answer, not a gate). Returns { none } | { url } | { pending: { text } }.
function prepareNotes(meta) {
  const raw = String((meta && meta.authorNotes) == null ? "" : meta.authorNotes);
  if (!raw.trim()) return { none: true, url: "" };
  if (isNotesPointer(raw)) {
    const id = notesIdFromValue(raw);
    // A bare ID normalises to its full hosted URL; a hosted URL passes through as-is.
    return { url: id ? notesUrlForId(id) : raw.trim() };
  }
  return { pending: { text: raw } };
}

// Upload prepared notes text to the upload host. The server keeps only the blob's 32-hex ID
// (notesId) — while the world file keeps its local draft (unlike the cover, which the file
// remembers as a URL). Returns { id, url, uploaded? } with id "" when there are no notes at all.
async function commitNotes(prepared, onBusy = () => {}, known = null) {
  if (!prepared.pending) {
    const id = prepared.url ? notesIdFromValue(prepared.url) : "";
    return { id, url: prepared.url || "" };
  }
  // The draft is byte-identical to what the last push already uploaded — reuse that blob instead
  // of minting an orphan upload on every push (a title-only update shouldn't re-upload the notes).
  if (known && known.notesDigest && known.link && known.link.notesUrl
      && known.notesDigest === known.link.notesDigest) {
    const url = String(known.link.notesUrl);
    return { id: notesIdFromValue(url), url };
  }
  onBusy("Uploading author\u2019s notes…");
  const up = await uploadBlob(prepared.pending.text);
  const id = notesIdFromValue(up.url);
  if (!id) throw new Error("Couldn't publish the author's notes (the upload came back without a file id) — try again. Your world is safe on this device.");
  return { id, url: notesUrlForId(id), uploaded: up };
}

/* ---------------------------------------------------------------------------
 * publish / update flows
 * ------------------------------------------------------------------------- */

// Build the canonical file-form JSON text for a world file, guaranteeing it round-trips through
// the loader (so a published world always loads). Throws a player-facing Error on failure.
function buildFileJson(fileForm) {
  const text0 = JSON.stringify(fileForm);
  const { world, errors } = loadWorld(text0);
  if (!world) throw new Error("This world file doesn't load: " + (errors[0] || "unknown error"));
  return JSON.stringify(worldToFile(world), null, 2);
}
// Strip/normalize the author's tags for the catalog: ≤8, ≤24 chars each, no reserved marker tag
// ("nsfw" — the server derives the rating from the boolean — or "remix", which is provenance).
function catalogTags(meta) {
  const out = [];
  for (const t of (meta && meta.tags) || []) {
    const v = String(t || "").trim().slice(0, TAG_MAX_LEN);
    if (!v || isReservedTag(v)) continue;
    if (out.some((x) => x.toLowerCase() === v.toLowerCase())) continue;
    if (out.length >= MAX_AUTHOR_TAGS) break;
    out.push(v);
  }
  return out;
}

// ---- publishing a copy of someone else's world → a remix --------------------------------
// A file that came from a published world carries both halves of that world's identity: the slug as
// `meta.id` and its author's stable id as `meta.authorId`. Together they ARE the original's listing
// id (`<userId>-<slug>`), so one read answers "is this a copy of something the community has?".
//
// Deliberately asked at PUBLISH time and nowhere else — importing stays a purely local action that
// never touches the network. `openCommunityMenu` may ask early so the panel can say what is
// about to happen; a positive answer is cached for the session, so the publish that follows asks
// nothing.
//
// Four guards, and each one is a case where the answer must be "no":
//   * no `meta.authorId`  → a file that predates ids (or a hand-made one) can't be looked up;
//   * already a fork      → its own recorded lineage wins (a fork of a fork points at its real parent);
//   * `authorId` is ours  → that is OUR listing; the link record's update/revive path owns it, and
//                           calling it a remix of itself would be nonsense;
//   * gone / unreachable  → a tombstoned record isn't reachable to link to, and an offline read must
//                           never block a publish.
// Returns the remix record's fields, or null (`{ worldId, title, userId, author }`).
const remixOriginCache = new Map(); // listing id -> record (positive answers only, one read per session)
async function detectRemixOrigin(fileForm) {
  const meta = (fileForm && fileForm.meta) || {};
  const storedId = String(meta.authorId || "").trim();
  if (!storedId) return null;
  if (isRemixMeta(meta)) return null;
  const me = await getIdentity({ create: false });
  if (me && me.userId === storedId) return null;
  const originId = storedId + "-" + String(meta.id || "");
  if (remixOriginCache.has(originId)) return remixOriginCache.get(originId);
  try {
    const r = await rpc("getWorld", { worldId: originId });
    const rec = r && r.world;
    const origin = (rec && rec.status !== "removed")
      ? {
        worldId: rec.worldId, title: rec.title || "",
        userId: rec.userId || storedId, author: rec.authorName || String(meta.author || "")
      }
      : null;
    // A POSITIVE answer is cached for the session (the panel and the publish that follows share one
    // read). A "no" never is: the original may not be published yet, or may come back, and the panel
    // asking again is cheap — while a sticky "no" would quietly stop linking a copy that later can be.
    if (origin) remixOriginCache.set(originId, origin);
    return origin;
  } catch (e) {
    return null; // offline / connection gone: try again next time, never cache a failure
  }
}

// Write a detected origin onto the world file as its remix record — the same
// `{worldId, name, userId, author, at}` shape the Duplicate flow writes, so the local card
// wears the ⧉ chip, the lineage survives an export, and the publish payload's `forkOf*` fields are
// read straight off it. Returns true when it wrote (so the caller can rebuild the upload text).
function applyRemixRecord(fileForm, origin) {
  const m = fileForm && fileForm.meta;
  if (!m || !origin || !origin.worldId) return false;
  m.remix = {
    worldId: origin.worldId, name: origin.title || "",
    userId: origin.userId || "", author: origin.author || "", at: new Date().toISOString()
  };
  return true;
}

// The `forkOf*` fields a write sends, read off the file's own remix record. Shared by the
// content and the listing payloads so both carry the lineage — an empty object when there is none.
function remixFields(meta) {
  const r = (meta && meta.remix) || null;
  if (!r || !r.worldId) return {};
  return {
    forkOfWorldId: String(r.worldId || ""), forkOfUserId: String(r.userId || ""),
    forkOfTitle: String(r.name || ""), forkOfAuthor: String(r.author || "")
  };
}

/* ---------------------------------------------------------------------------
 * change detection — what needs pushing?
 * ------------------------------------------------------------------------- */

// A cheap, stable 32-bit digest (FNV-1a) of a string. Used only to notice that the world file's
// LOCAL cover image was swapped for a different one: a data: URL is far too big to keep inside a
// fingerprint string, and it is not a secret, so a fast non-cryptographic hash is exactly right.
function quickHash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16);
}

// The digest of a local cover image ("" when the file's cover isn't a local one). Stored on the link
// record so the token below survives the file's cover being rewritten to the uploaded URL.
function localCoverDigest(cover) {
  const c = String(cover || "").trim();
  return /^data:/i.test(c) ? quickHash(c) + ":" + c.length : "";
}

// The cover as the LISTING fingerprint sees it. `publishFlow` writes the resolved cover URL back into
// the world file, so "the image in the file" and "the URL it was uploaded to" must compare EQUAL —
// otherwise every single push would look like a fresh cover change. A local image (the `data:` URL,
// or the hosted URL it went to) is therefore represented by its own digest, which still notices a
// *different* local image. A pasted hosted URL is compared literally.
function coverToken(cover, link) {
  const c = String(cover || "").trim();
  if (!c) return "";
  if (/^data:/i.test(c)) return "local:" + quickHash(c) + ":" + c.length;
  // `String(...)` on the stored side too: a record written before uploadBlob() normalised its URLs
  // may hold the upload plugin's String object, which would never `===` the file's plain string.
  const stored = (link && link.coverUrl) ? String(link.coverUrl).trim() : "";
  if (link && link.coverUploaded && stored && c === stored) return "local:" + (link.coverDigest || "");
  return c;
}

// The Author's notes as the LISTING fingerprint sees them — the same local-vs-hosted mapping as
// the cover, so publishing rewrites the file's draft text to its uploaded URL without looking
// like a fresh change every push. Draft text is a digest (unlimited length, never stored); a
// pointer to the uploaded blob maps back to the stored digest, exactly like coverToken.
function localNotesDigest(notes) {
  const t = String(notes == null ? "" : notes);
  if (!t.trim() || isNotesPointer(t)) return "";
  return quickHash(t) + ":" + t.length;
}
function notesToken(notes, link) {
  const t = String(notes == null ? "" : notes).trim();
  if (!t) return "";
  if (!isNotesPointer(t)) return "local:" + quickHash(t) + ":" + t.length;
  const stored = (link && link.notesUrl) ? String(link.notesUrl).trim() : "";
  if (link && stored && t === stored) return "local:" + (link.notesDigest || "");
  return t;
}

// The front-facing LISTING as one stable string: exactly what a `mode:"listing"` push sends —
// title, description, the tags the catalog will store, the rating, the comments toggle, and the cover.
function listingFingerprint(meta, link) {
  const m = meta || {};
  return JSON.stringify([
    String(m.name || "").trim(),
    String(m.description || "").trim(),
    catalogTags(m),
    isNsfwMeta(m),
    m.commentsOff === true,
    coverToken(m.cover, link),
    notesToken(m.authorNotes, link)
  ]);
}

// The world file's CONTENT — everything except (a) the meta fields the listing owns (title,
// description, tags, rating, comments toggle, cover), (b) the author line the app signs (`author` and the stable
// `authorId` behind it), and (c) `updatedAt`, which every save bumps. What remains is the world
// itself: its id and `createdAt` (so a re-created file still reads as different), the narrative vibe,
// lorebook, scenario, start, art tags, stats, tracker defs and the cast. So "content changed" means
// the world really changed — editing the title alone never triggers a re-upload, and neither does a
// rename putting your new username on the file.
function contentView(jsonText) {
  const obj = JSON.parse(jsonText);
  if (obj && obj.meta) obj.meta = { id: obj.meta.id, createdAt: obj.meta.createdAt };
  return JSON.stringify(obj);
}
async function contentSigOf(jsonText) {
  return await sha256Hex(contentView(jsonText));
}

// What would a push actually do? Compares the local file with the link record's memory of the last
// push. Pure computation — never touches the network.
//   `contentChanged` — the world's content differs from the uploaded blob. A record written before
//     change detection existed carries no `contentSig`, so it falls back to the blob hash it does
//     have (a conservative one-off: a local-image cover makes those differ, so the first push after
//     this update re-uploads once and then settles).
//   `listingChanged` — title / description / tags / rating / comments toggle / cover differ from the
//     last push. A legacy record has no fingerprint, so it reads as changed once, then settles.
// Both digests come from the SAME canonical text `buildFileJson` produces, so this is also the exact
// text the content upload sends.
async function detectChanges(link, fileForm, jsonText) {
  jsonText = jsonText || buildFileJson(fileForm);
  const contentSig = await contentSigOf(jsonText);
  const contentChanged = (link && link.contentSig)
    ? contentSig !== link.contentSig
    : (await sha256Hex(jsonText)) !== ((link && link.jsonHash) || "");
  const listingChanged = !(link && link.listingFingerprint)
    || listingFingerprint(fileForm.meta, link) !== link.listingFingerprint;
  return { contentSig, contentChanged, listingChanged };
}

// The publish gate on a world's description: trimmed, it must clear `MIN_DESC_CHARS`. Checked FIRST —
// before the size/id/link checks and before the username claim and the cover decision — so a world
// that can't go up anyway never walks the player through those interactive steps. Notifies and returns
// true (caller cancels) when it fails.
function descTooShort(fileForm) {
  // Bytes, like the max gates and the editor counter — so a world the editor calls long enough
  // is never refused here (bytes >= chars for any text, and multibyte clears it even faster).
  const n = new TextEncoder().encode(String((fileForm.meta || {}).description || "").trim()).length;
  if (n >= MIN_DESC_CHARS) return false;
  A().notify(`✖ A world needs at least ${MIN_DESC_CHARS} bytes of description before it can be published — this one has ${n}. Write it in the world editor's Basics tab.`, { ms: 7000 });
  return true;
}
const MAX_DESC_CHARS = 800;
const MAX_TITLE_CHARS = 80;
function titleTooLong(fileForm) {
  // Byte cap (not chars): the catalog slot stores UTF-8 bytes, so this measures what publishing
  // actually writes — matching the world editor's save gate.
  const n = new TextEncoder().encode(String((fileForm.meta || {}).name || "").trim()).length;
  if (n <= MAX_TITLE_CHARS) return false;
  A().notify(`✖ That title is ${n} bytes — Explore listings hold ${MAX_TITLE_CHARS}. Trim ${n - MAX_TITLE_CHARS} bytes in the world editor's Basics tab so nothing gets cut off.`, { ms: 7000 });
  return true;
}
function descTooLong(fileForm) {
  const n = new TextEncoder().encode(String((fileForm.meta || {}).description || "").trim()).length;
  if (n <= MAX_DESC_CHARS) return false;
  A().notify(`✖ That description is ${n} bytes — Explore listings hold ${MAX_DESC_CHARS}. Trim ${n - MAX_DESC_CHARS} bytes in the world editor's Basics tab so nothing gets cut off.`, { ms: 7000 });
  return true;
}
// The publish gate on a world's tags: at least `MIN_TAGS` author tags. Checked alongside the
// description gate (see `descTooShort`) — same shape, same toast style. Reserved markers never
// live in `meta.tags` (the loader folds them into fields), so this counts author tags only.
// Notifies and returns true (caller cancels) when it fails.
function tagsTooFew(fileForm) {
  const tags = ((fileForm.meta || {}).tags || []).filter((t) => String(t == null ? "" : t).trim());
  if (tags.length >= MIN_TAGS) return false;
  A().notify(`✖ A world needs at least ${MIN_TAGS} tags before it can be published — this one has ${tags.length}. Add them in the world editor's Basics tab.`, { ms: 7000 });
  return true;
}

// One publish per world at a time: a second click while the first is still uploading used to start a
// second upload against the first and fail with the host's `another_upload_in_progress`. The wrapper
// below refuses the duplicate up front instead.
const publishInflight = new Set();
export async function publishFlow(fileForm, opts = {}) {
  const key = String((fileForm && fileForm.meta && fileForm.meta.id) || "__noid");
  if (publishInflight.has(key)) {
    A().notify("ℹ️ Publishing is already in progress — give it a moment to finish.", { ms: 4200 });
    return;
  }
  publishInflight.add(key);
  try {
    return await publishFlowInner(fileForm, opts);
  } finally {
    publishInflight.delete(key);
  }
}

// The publish/update entry point. `fileForm` is the world file (file form) to publish. If the
// world already has a link record this is an update: listing-only when `mode === "listing"`,
// full content upload when `mode === "content"`, and otherwise decided by `detectChanges` —
// the caller never has to know which kind of change it made.
async function publishFlowInner(fileForm, opts = {}) {
  const world = fileForm;
  const metaId = String(world.meta.id || "");
  if (!metaId) { A().notify("✖ This world has no id — open it in the editor and save once first."); return; }

  const links = await getLinks();
  const existing = links[metaId] || null;
  let mode = opts.mode || null;
  // A caller that already ran the detection (the 🌐 panel, to label its own button) hands
  // it in here so the world isn't hashed twice.
  let changes = opts.detected || null;
  let jsonText0 = null;

  // The world file's author snapshot — written BEFORE the text is hashed, diffed or uploaded, because
  // the exact bytes we send are what every downloaded copy shows as its author (§6.9). It is signed
  // once with the identity we already have, and then again with the one the catalog confirms, since a
  // first publish claims a username in a popup and a rename can land between the two. Rules:
  //   * the file is ours already (`authorId` is our id) or uncredited → the author line is set to the
  //     confirmed name (so a stale cached name can never survive into the file or the upload);
  //   * `authorId` is recorded once, the first time the name is ours;
  //   * an imported world keeps the author it arrived with — its id isn't ours, so we touch nothing.
  // Returns true when it changed the file (so the caller can rebuild the text it will upload).
  const signForPublish = (id) => {
    const m = world.meta;
    if (!m || !id || !id.username) return false;
    let changed = false;
    if ((m.authorId && m.authorId === id.userId) || !m.author) {
      if (m.author !== id.username) { m.author = id.username; changed = true; }
    }
    if (!m.authorId && id.userId && m.author === id.username) { m.authorId = id.userId; changed = true; }
    return changed;
  };
  signForPublish(await getIdentity({ create: false }));

  if (!mode) {
    // Only a live record minted by OUR identity can be diffed against (a fork/restored-identity
    // record has to be published afresh). Anything else, and a tombstone, is a plain publish.
    const id0 = await getIdentity({ create: false });
    const comparable = !!(existing && existing.status !== "removed" && id0 && existing.worldId
      && existing.worldId.indexOf(id0.userId + "-") === 0);
    if (!comparable) {
      mode = "publish";
    } else {
      if (!changes) {
        try { jsonText0 = buildFileJson(world); }
        catch (e) {
          await A().ConfirmPopup.open({ title: "Can't publish this world", message: "This world file doesn't load: " + (e.message || e), confirmText: "OK", cancelText: "Close" }).catch(() => {});
          return;
        }
        changes = await detectChanges(existing, world, jsonText0);
      }
      if (!changes.contentChanged && !changes.listingChanged) {
        // Nothing in the file moved — but the blob the catalog already points at may be gone, and a
        // push is the author's only way to repair that (the check just below decides).
        mode = "none";
      } else {
        // A content upload carries the whole listing with it, so it wins when both moved.
        mode = changes.contentChanged ? "content" : "listing";
      }
    }
  }

  // Heal a listing whose file has come off the host. A listing-only push (or a "nothing to publish")
  // keeps the catalog pointing at the URL it already has — which is exactly the thing that can be
  // dead, because `unpublishWorld` deletes the blob and reviving the record (the ⋮ menu's Publish on
  // a tombstone, or a listing push from a device with a stale link record) keeps that deleted URL. So
  // either of them becomes a content push: the same file, re-uploaded, which repairs the record.
  // `version` bumps as a result, which is honest — the bytes at the link are new.
  if ((mode === "none" || mode === "listing") && existing && await blobMissing(existing.jsonUrl)) {
    A().notify("ℹ️ This world's file is missing from the download host — re-uploading it.", { ms: 5600 });
    mode = "content";
  }
  if (mode === "none") {
    A().notify("✓ Nothing to publish — your world is already up to date.");
    return { ok: true, mode: "none", worldId: existing.worldId };
  }

  // ---- Pre-flight: every check, the username claim and every interactive cover decision happen
  // here, BEFORE the publishing overlay exists and before anything is uploaded. The busy
  // overlay outranks the other popups (z-index 80 vs 60), so creating it first would bury the
  // "Choose a username" panel behind a spinner the player can't click through.
  let busy = null;
  try {
    // The description gate comes before every other check — see `descTooShort`.
    if (descTooShort(world)) return;
    if (descTooLong(world)) return;
    if (titleTooLong(world)) return;
    if (tagsTooFew(world)) return;
    let jsonText = jsonText0 || buildFileJson(world);
    if (new TextEncoder().encode(jsonText).length > JSON_MAX_BYTES) throw new Error("This world is too large to publish (over 24 MB of JSON).");
    if (metaId.length > META_ID_MAX) throw new Error("This world's id is too long to publish.");

    const desc = String(world.meta.description || "");
    if (hasLink(String(world.meta.name || "")) || hasLink(desc) || hasLink((world.meta.tags || []).join("\n"))) throw new Error(ERR_TEXT.bad_link);
    // Author's notes ride the same anti-spam rule as the other listing text (no links/URLs) —
    // checked here on the draft text, since the server only ever sees the upload ID, never the words.
    // An already-published pointer is our own upload-host URL, not author prose, so it's exempt.
    const notesDraft = String(world.meta.authorNotes == null ? "" : world.meta.authorNotes);
    if (notesDraft.trim() && !isNotesPointer(notesDraft) && hasLink(notesDraft)) throw new Error(ERR_TEXT.bad_link);

    // Identity + username: the last thing standing between the file and the catalog, and the one
    // step that needs the player (it opens its own popup, with no overlay in front of it).
    const id = await ensureIdentityAndName();
    // App-id ban: fail fast before any upload (server enforces too). Same
    // unified copy as the chat ban.
    try { if (await blockIfPublishingBanned(id && id.userId)) return; } catch (e) {}
    // A first publish (or a rename confirmed by the catalog) gives us the name this world must be
    // signed with — rebuild the text if the file changed, since the rebuilt text is what gets sent.
    if (signForPublish(id)) jsonText = buildFileJson(world);

    // Is this world a copy of one the community already has? If so it goes up as a REMIX of it, so
    // the original's author keeps the credit and readers can walk back to the original. The
    // lookup happens here — at publish, never at import — and its answer rides on the file's own
    // `meta.remix`, which the payload and the uploaded text both read, so the copy a reader downloads
    // carries the lineage too. Offline, or nothing found: the world simply publishes as planned.
    const remixOrigin = await detectRemixOrigin(world);
    if (remixOrigin) {
      applyRemixRecord(world, remixOrigin);
      jsonText = buildFileJson(world);
    }

    // Cover gate: the author decides (and any picked image is downscaled) now, but nothing is
    // uploaded until `commitCover` below.
    const preparedCover = await prepareCover(world.meta);
    if (preparedCover.cancel) return;
    if (!preparedCover.url && !preparedCover.pending) {
      A().notify("✖ Worlds can't be published without a cover image — add one and try again.", { ms: 6000 });
      return;
    }
    // Read while the file still holds the LOCAL image: the link record keeps this digest so the
    // listing fingerprint survives the file's cover being rewritten to the uploaded URL below.
    const coverDigest = localCoverDigest(world.meta.cover);
    // Same for the Author's notes: the digest of the draft text, so the rewrite to its blob URL settles.
    const preparedNotes = prepareNotes(world.meta);
    const notesDigest = localNotesDigest(world.meta.authorNotes);
    // The listing half of the change detection, computed from the file exactly as the catalog will
    // see it (the cover token maps the uploaded URL back to the local image — and the notes token
    // maps the uploaded notes URL back to the local draft — via the stored digests).
    const listingSigFor = (url, notesUrl) => listingFingerprint(world.meta, { coverUploaded: !!cover.uploaded, coverUrl: url || "", coverDigest, notesUrl: notesUrl || "", notesDigest });

    // A link only belongs to us if its worldId carries our current identity's prefix. A
    // creator-code restore can swap the identity out from under existing links, and a record whose
    // worldId was minted by another identity can never be updated *or* re-published under that id
    // (the server keys worldIds by userId), so treat such a link as a fresh publish rather than
    // dead-ending on `bad_world_id`. The final setLink() then self-heals the stale record.
    const ours = !!(existing && existing.worldId && existing.worldId.indexOf(id.userId + "-") === 0);
    const active = !!(existing && existing.status !== "removed" && ours);
    const worldId = active ? existing.worldId : id.userId + "-" + slugId(metaId);
    const editToken = await editTokenFor(worldId);
    const userToken = await userTokenFor(id.userId);

    // ---- Everything passed. Only now does the overlay appear and the writing begin.
    busy = makeBusyPopup("Publishing…");
    const cover = await commitCover(preparedCover, (m) => busy.say(m));
    if (!cover.url) {
      busy.close();
      A().notify("✖ Worlds can't be published without a cover image — add one and try again.", { ms: 6000 });
      return;
    }
    // `existing` is passed so an unchanged draft reuses its last blob (see commitNotes) — the
    // world file itself is never rewritten to the URL; it keeps the editable draft.
    const notes = await commitNotes(preparedNotes, (m) => busy.say(m), { notesDigest, link: existing });
    const nsfw = isNsfwMeta(world.meta) || !!cover.nsfw;
    const commentsOff = world.meta.commentsOff === true;

    if (mode === "listing") {
      busy.say("Updating your world's details…");
      let r;
      try {
        r = await rpc("updateWorld", {
          worldId, editToken, title: world.meta.name || "", description: desc,
          tags: catalogTags(world.meta), nsfw, commentsOff, coverUrl: cover.url || null,
          notesId: notes.id || "",
          ...remixFields(world.meta) // the lineage, when this copy of a published world has one
        });
      } catch (e) {
        if (e.code === "not_found") {
          // The catalog record vanished — publish it afresh instead of failing.
          busy.close();
          A().notify("ℹ️ That listing was gone — publishing this world fresh.", { ms: 4200 });
          return await publishFlowInner(world, { mode: "publish" });
        }
        throw e;
      }
      // Keep the local file's listing in sync (so a later export re-publish carries it).
      if (cover.url) world.meta.cover = cover.url;
      // Author's notes stay a local draft in the file (never rewritten to the blob URL): the
      // editor keeps editable text, exports stay self-contained, and the link record below
      // remembers the pointer the catalog holds.
      await saveLocalWorld(world);
      await setLink(metaId, Object.assign({}, existing, {
        title: world.meta.name || "", authorName: id.username || "", coverUrl: cover.url || "",
        nsfw, updatedAt: Date.now(), version: r.version, status: "published",
        // Remember exactly what the catalog now holds, so the next push can tell what changed.
        // A listing-only push leaves `contentSig` alone — the content it would describe is not what
        // this push sent — unless the caller had already *proved* the content matches (the
        // auto-detect path), in which case recording it settles a record written before change
        // detection existed.
        listingFingerprint: listingSigFor(cover.url, notes.url),
        coverUploaded: !!cover.uploaded, coverDigest,
        notesUrl: notes.url || "", notesDigest,
        ...((changes && !changes.contentChanged) ? { contentSig: changes.contentSig } : {})
      }));
      busy.close();
      A().notify("🌐 Your world's details are updated.");
      nudgeSuppressUntil = Date.now() + NUDGE_SELF_MS;
      emit("links");
      await A().repaintWorldsPage?.();
      return { ok: true, mode, worldId };
    }

    // Content path: gzip + upload the world file.
    busy.say("Compressing world…");
    const gzip = gzipAvailable();
    let blob = new Blob([jsonText], { type: "application/json" });
    let encoding = "identity";
    if (gzip) { blob = await gzipBlob(jsonText); encoding = "gzip"; }
    if (blob.size > JSON_MAX_BYTES) throw new Error("This world is too large to publish even compressed.");
    if (new TextEncoder().encode(jsonText).length > JSON_WARN_BYTES) A().notify("ℹ️ This world is large — publishing may take a moment.", { ms: 4000 });

    busy.say("Uploading world (" + fmtBytes(blob.size) + ")…");
    let up = await uploadBlob(blob, "world.json");
    const jsonHash = await sha256Hex(jsonText);

    // The catalog never fetches the blob — it trusts this URL — so a phantom success (plugin says
    // ok, host 404s for everyone) would go live as an undownloadable world. Verify the bytes landed
    // and hash-match before pointing the record at them; one fresh re-upload heals a transient miss.
    busy.say("Verifying upload…");
    try {
      await verifyUploadedBlob(up.url, encoding, jsonHash, (m) => busy.say(m));
    } catch (verr) {
      busy.say("Upload didn't land — retrying upload…");
      try { await tryDeleteBlob(up.deletionUrl, { worldId, reason: "verify_failed" }); } catch (e) {}
      up = await uploadBlob(blob, "world.json");
      busy.say("Verifying upload…");
      try {
        await verifyUploadedBlob(up.url, encoding, jsonHash, (m) => busy.say(m));
      } catch (verr2) {
        try { await tryDeleteBlob(up.deletionUrl, { worldId, reason: "verify_failed" }); } catch (e) {}
        if (cover.uploaded && !existing) try { await tryDeleteBlob(cover.uploaded.deletionUrl, { worldId, reason: "failed_publish_cover" }); } catch (e) {}
        if (notes.uploaded) try { await tryDeleteBlob(notes.uploaded.deletionUrl, { worldId, reason: "failed_publish_notes" }); } catch (e) {}
        throw verr2;
      }
    }

    busy.say("Publishing…");
    const payload = {
      worldId, userId: id.userId, userToken, editToken,
      title: world.meta.name || "", description: desc, tags: catalogTags(world.meta),
      nsfw, commentsOff: world.meta.commentsOff === true, coverUrl: cover.url || "", notesId: notes.id || "",
      jsonUrl: up.url, jsonBytes: up.size, jsonHash, jsonEncoding: encoding
    };
    // Fork provenance rides along when the world file carries `meta.remix` — either the record
    // the Duplicate flow wrote, or the origin this copy of someone's published world was just linked
    // to in the pre-flight above.
    Object.assign(payload, remixFields(world.meta));
    // A world we already have a link record for is UPDATED (which also revives an unpublished
    // record). A brand-new world is published. `not_found` means the link record is stale (the
    // server record never existed, or is gone), so we fall back to a fresh publish.
    const cleanupUploads = async () => {
      await tryDeleteBlob(up.deletionUrl, { worldId, reason: "failed_publish" });
      if (cover.uploaded && !existing) await tryDeleteBlob(cover.uploaded.deletionUrl, { worldId, reason: "failed_publish_cover" });
      if (notes.uploaded) await tryDeleteBlob(notes.uploaded.deletionUrl, { worldId, reason: "failed_publish_notes" });
    };
    // One failed publish must clean up the orphan blob we just uploaded — exactly
    // once, wherever the failure happened. `rpcClaiming` applies the `username_required` recovery
    // to every catalog write, not just the first attempt.
    let res;
    try {
      res = await rpcClaiming(active ? "updateWorld" : "publishWorld", payload);
    } catch (e) {
      // Either direction can be wrong about what the catalog holds, so each one falls back to the
      // other instead of dead-ending: `not_found` on an update means the record is gone (the link
      // was stale — publish it fresh), and `world_exists` on a publish means the record is still
      // there, as a tombstone this device never heard about (update it, which revives it).
      // Both land on the same worldId either way, so share links and other people's copies keep
      // working whichever way it went.
      const retry = active && e.code === "not_found" ? "publishWorld"
        : !active && e.code === "world_exists" ? "updateWorld"
        : null;
      if (!retry) { await cleanupUploads(); throw e; }
      try { res = await rpcClaiming(retry, payload); }
      catch (e2) { await cleanupUploads(); throw e2; }
    }

    // The world file keeps a cosmetic `meta.author` snapshot — written above, before the
    // bytes were uploaded, so the copy people download carries it too — and the resolved cover URL.
    // (Author's notes are the exception: the file keeps its draft, not the blob URL.)
    if (cover.url) world.meta.cover = cover.url;
    await saveLocalWorld(world);

    await setLink(metaId, {
      kind: "published", worldId, jsonUrl: up.url, deletionUrl: up.deletionUrl, jsonHash,
      jsonBytes: up.size, jsonEncoding: encoding, version: res.version, publishedAt: (existing && existing.publishedAt) || Date.now(),
      updatedAt: Date.now(), lastUploadBytes: up.size, status: "published", title: world.meta.name || "",
      coverUrl: cover.url || "", nsfw, authorName: id.username || "",
      // What the catalog now holds, so the next push can tell what changed: the content
      // signature of the file we just uploaded, and the listing fingerprint of what it carried. A
      // hidden-after-reports state survives a content update (the catalog keeps its own rating of the
      // world; the Explore sync refreshes this either way).
      contentSig: changes ? changes.contentSig : await contentSigOf(jsonText),
      listingFingerprint: listingSigFor(cover.url, notes.url),
      coverUploaded: !!cover.uploaded, coverDigest,
      notesUrl: notes.url || "", notesDigest,
      hidden: !!(existing && existing.hidden)
    });
    busy.close();
    A().notify(remixOrigin
      ? `🌐 Published as a remix of "${remixOrigin.title}"${remixOrigin.author ? " by @" + remixOrigin.author : ""}.`
      : (active ? "🌐 Your world is updated." : "🌐 World published! It's now in Explore."));
    // Publishing watches your world: every new comment alerts (baselined silently —
    // its existing comments are history, not news).
    try { const dm = await import("./discussion.js"); if (dm && dm.watchOwnWorld) dm.watchOwnWorld(worldId, world.meta.name || ""); } catch (e) {}
    nudgeSuppressUntil = Date.now() + NUDGE_SELF_MS;
    emit("links");
    await A().repaintWorldsPage?.();
    if (!active) {
      try { await maybeShowFirstPublishBackupNudge(id && id.userId); } catch (e) {}
    }
    return { ok: true, mode: "content", worldId };
  } catch (e) {
    if (busy) busy.close();
    if (e && e.cancelled) return;
    await A().ConfirmPopup.open({ title: "Publish failed", message: e.message || String(e), confirmText: "OK", cancelText: "Close" }).catch(() => {});
    return;
  }
}

// Save a world file back into the local library (used after publishing, to persist the auto-filled
// author / resolved cover / listing fields).
async function saveLocalWorld(fileForm) {
  try { await worldStore.save(fileForm); } catch (e) { console.warn("[community] local save failed", e); }
}

// Unpublish: tombstone the record, best-effort delete the current blob, keep the link.
// `confirm:false` / `note:false` are for the delete-a-world flow (main.js), which folds the
// unpublish into its own confirmation and success message.
export async function unpublishWorld(metaId, { confirm = true, note = true } = {}) {
  const links = await getLinks();
  const link = links[metaId];
  if (!link) return false;
  if (confirm) {
    const ok = await A().ConfirmPopup.open({
      title: "⛔ Unpublish",
      message: `Remove "${link.title || metaId}" from the community? It disappears from Explore, and people who already added it keep playing their saved copy.`,
      warning: "You can publish it again later — the same link keeps working.",
      confirmText: "Unpublish", danger: true
    });
    if (!ok) return false;
  }
  const busy = makeBusyPopup("Unpublishing…");
  try {
    const editToken = await editTokenFor(link.worldId);
    try {
      await rpc("deleteWorld", { worldId: link.worldId, editToken });
    } catch (e) {
      // `not_found` means the record is already gone (the community forgot it, or another device
      // removed it): there's nothing live to take down, so the unpublish has still done its job and
      // only the best-effort blob delete is left. Any other failure is real.
      if (e.code !== "not_found") throw e;
    }
    await tryDeleteBlob(link.deletionUrl, { worldId: link.worldId, reason: "unpublish" });
    await setLink(metaId, Object.assign({}, link, { status: "removed", deletionUrl: null, updatedAt: Date.now() }));
    busy.close();
    if (note) A().notify("🌐 World unpublished.");
    // Unpublished worlds leave the watch list — there is nothing left to alert on.
    try { const dm = await import("./discussion.js"); if (dm && dm.unwatchWorld) dm.unwatchWorld(link.worldId); } catch (e) {}
    nudgeSuppressUntil = Date.now() + NUDGE_SELF_MS;
    emit("links");
    await A().repaintWorldsPage?.();
    return true;
  } catch (e) {
    busy.close();
    A().notify("✖ " + e.message, { ms: 5200 });
    return false;
  }
}

// Publish again after an unpublish: reuses the same worldId (the tombstone reserved it), so
// old links and other people's caches keep working.
export async function republishWorld(fileForm) {
  const metaId = String(fileForm.meta.id || "");
  if (publishInflight.has(metaId)) {
    A().notify("ℹ️ Publishing is already in progress — give it a moment to finish.", { ms: 4200 });
    return false;
  }
  publishInflight.add(metaId);
  try {
    return await republishWorldInner(fileForm);
  } finally {
    publishInflight.delete(metaId);
  }
}
async function republishWorldInner(fileForm) {
  const metaId = String(fileForm.meta.id || "");
  const link = (await getLinks())[metaId];
  if (!link || link.status !== "removed") return false;
  // Same rule as publishFlow: identity and every check first, overlay only once the writing
  // actually starts — so the "Choose a username" popup is never buried behind a spinner.
  let busy = null;
  try {
    if (descTooShort(fileForm)) return false;
    if (descTooLong(fileForm)) return false;
    if (titleTooLong(fileForm)) return false;
    if (tagsTooFew(fileForm)) return false;
    const id = await ensureIdentityAndName();
    try { if (await blockIfPublishingBanned(id && id.userId)) return false; } catch (e) {}
    const editToken = await editTokenFor(link.worldId);
    // Reviving only re-pushes the listing — unless the world itself moved on since it was published,
    // in which case a full content update is the honest path (it also revives the record
    // server-side). `detectChanges` answers that the same way a push does.
    const changes = await detectChanges(link, fileForm);
    if (changes.contentChanged) {
      A().notify("ℹ️ This world changed since it was published — pushing the new content.", { ms: 4200 });
      return await publishFlowInner(fileForm, { mode: "content" });
    }
    // Unpublishing DELETED the world file from the upload host, so a listing-only revive would put the
    // world back into Explore with nothing behind it to download — the exact way a live listing ends up
    // 404ing for every reader. Re-upload instead whenever the stored file is really gone. It may not
    // be: the delete is best-effort, so a blob that outlived it makes the cheap revive correct.
    if (await blobMissing(link.jsonUrl)) {
      A().notify("ℹ️ This world's file was removed when it was unpublished — re-uploading it.", { ms: 4800 });
      return await publishFlowInner(fileForm, { mode: "content" });
    }
    busy = makeBusyPopup("Publishing again…");
    busy.say("Publishing again…");
    // Notes upload like a push (draft text first, or the last blob when unchanged); the file keeps
    // its draft either way. An empty file sends "" (cleared) — last-writer-wins, the same rule
    // title/description follow.
    const notesDraftDigest = localNotesDigest(fileForm.meta.authorNotes);
    const notes = await commitNotes(prepareNotes(fileForm.meta), (m) => busy.say(m), { notesDigest: notesDraftDigest, link });
    if (!String(fileForm.meta.authorNotes == null ? "" : fileForm.meta.authorNotes).trim()) fileForm.meta.authorNotes = "";
    const r = await rpcClaiming("updateWorld", {
      worldId: link.worldId, editToken, title: fileForm.meta.name || "", description: String(fileForm.meta.description || ""),
      tags: catalogTags(fileForm.meta), nsfw: isNsfwMeta(fileForm.meta), commentsOff: fileForm.meta.commentsOff === true, coverUrl: link.coverUrl || null,
      notesId: notes.id || "",
      ...remixFields(fileForm.meta) // a revive keeps whatever lineage the file carries
    });
    await setLink(metaId, Object.assign({}, link, {
      status: "published", updatedAt: Date.now(), version: r.version,
      // The listing we just re-pushed (and the cover it kept) is now what the catalog holds.
      title: fileForm.meta.name || "", listingFingerprint: listingFingerprint(fileForm.meta, link),
      notesUrl: notes.url || "", notesDigest: notesDraftDigest
    }));
    busy.close();
    A().notify("🌐 World is live again.");
    // Re-published worlds watch again, same as fresh publishes.
    try { const dm = await import("./discussion.js"); if (dm && dm.watchOwnWorld) dm.watchOwnWorld(link.worldId, fileForm.meta.name || ""); } catch (e) {}
    nudgeSuppressUntil = Date.now() + NUDGE_SELF_MS;
    emit("links");
    await A().repaintWorldsPage?.();
    try { await maybeShowFirstPublishBackupNudge(id && id.userId); } catch (e) {}
    return true;
  } catch (e) {
    if (busy) busy.close();
    if (e && e.cancelled) return false;
    // The record is gone, or its worldId was minted by a previous identity → publish it fresh,
    // which re-mints the id under the current identity and self-heals the stale link.
    if (e.code === "not_found" || e.code === "bad_world_id") return await publishFlowInner(fileForm, { mode: "publish" });
    A().notify("✖ " + e.message, { ms: 5200 });
    return false;
  }
}

// Appeal the catalog's report-driven hide. An appeal is a REQUEST: the catalog records it and
// puts the world back into Explore once its delay has run, so a hidden world can't be talked back into
// Explore the moment it goes down. This is the panel behind the Worlds card's ⋮ menu's ⚑ Appeal entry —
// the publish panel offers it too, when the community has hidden the world — and it is only ever
// reachable for a listing the catalog told us is hidden.
async function appealWorld(metaId) {
  const link = (await getLinks())[metaId];
  if (!link) { A().notify("✖ That world isn't published."); return false; }
  // An appeal already in flight: say when it lands instead of asking again (the server would answer
  // with the same date; this only skips a pointless question).
  const due = Number(link.reinstatesAt) || 0;
  const waiting = due > Date.now() ? daysUntil(due) : 0;
  const ok = await A().ConfirmPopup.open({
    title: waiting ? "⚑ Appeal Pending" : "⚑ Appeal",
    message: waiting
      ? `"${link.title || metaId}" is hidden after reports. Your appeal is already in — it returns to Explore in ${plural(waiting, "day")}.`
      : `Appeal the hide on "${link.title || metaId}"? It returns to Explore ${APPEAL_DELAY_DAYS} days from now — a hide should mean something — and you can appeal once every 30 days.`,
    confirmText: waiting ? "OK" : "Appeal"
  });
  if (!ok) return false;
  if (waiting) return true;
  const busy = makeBusyPopup("Appealing…");
  try {
    const editToken = await editTokenFor(link.worldId);
    const r = await rpcClaiming("appealWorld", { worldId: link.worldId, editToken });
    const at = Number(r && r.reinstatesAt) || Date.now() + APPEAL_DELAY_MS;
    await setLink(metaId, Object.assign({}, link, { hidden: true, reinstatesAt: at, updatedAt: Date.now() }));
    busy.close();
    A().notify(r && r.pending
      ? `⚑ Appeal already pending — back in Explore in ${plural(daysUntil(at), "day")}.`
      : `⚑ Appeal received — the world returns to Explore in ${plural(daysUntil(at), "day")}.`);
    nudgeSuppressUntil = Date.now() + NUDGE_SELF_MS;
    emit("links");
    await A().repaintWorldsPage?.();
    return true;
  } catch (e) {
    busy.close();
    // The catalog says it isn't hidden — it was appealed from another device, or a moderator put it
    // back. Trust that over the stale local record rather than leaving a card offering the impossible.
    if (e.code === "not_hidden") {
      await setLink(metaId, Object.assign({}, link, { hidden: false, reinstatesAt: 0, updatedAt: Date.now() }));
      A().notify("⚑ That world is already in Explore.");
      emit("links");
      await A().repaintWorldsPage?.();
      return true;
    }
    A().notify("✖ " + e.message, { ms: 5200 });
    return false;
  }
}

/* ---------------------------------------------------------------------------
 * added-world library: add / retry / play / remove / fork
 * ------------------------------------------------------------------------- */

// Fetch a catalog world's blob, verify it against the record's hash, and cache the text.
async function fetchAndCache(rec) {
  const text = await readWorldBlob(rec.jsonUrl, rec.jsonEncoding);
  const got = await sha256Hex(text);
  if (rec.jsonHash && got !== rec.jsonHash) throw new Error("hash_mismatch");
  const { world, errors } = loadWorld(text);
  if (!world) throw new Error("invalid_world" + (errors[0] ? ": " + errors[0] : ""));
  const bytes = new TextEncoder().encode(text).length;
  await setCacheEntry(rec.worldId, { jsonHash: got, text, bytes, cachedAt: Date.now() });
  return { text, world };
}

// Reclaim one of YOUR published worlds back into the local world library (the Worlds page).
// Used after a creator-code restore onto a device with no local copy, and when opening your own
// listing that isn't installed. Downloads the catalog blob, verifies it, saves it as a local
// world and rebuilds the publish link so future updates work. Never overwrites a local world.
export async function reclaimSingleWorld(worldId, { rec = null } = {}) {
  const id = await getIdentity({ create: false });
  if (!id || !id.userId) throw new Error("No identity on this device.");
  if (!rec) rec = (await rpc("getWorld", { worldId: String(worldId || "") })).world;
  if (!rec || !rec.worldId) throw new Error("That world isn't published any more.");
  if (rec.userId !== id.userId) throw new Error("That world belongs to a different identity.");
  if (rec.status === "removed" || rec.status === "unknown") throw new Error("That world isn't published any more.");
  const text = await readWorldBlob(rec.jsonUrl, rec.jsonEncoding);
  const got = await sha256Hex(text);
  if (rec.jsonHash && got !== rec.jsonHash) throw new Error("hash_mismatch");
  let fileForm;
  try { fileForm = JSON.parse(text); } catch (e) { throw new Error("invalid_world: not JSON"); }
  const { world, errors } = loadWorld(text);
  if (!world) throw new Error("invalid_world" + (errors[0] ? ": " + errors[0] : ""));
  const metaId = String((fileForm.meta && fileForm.meta.id) || world.meta.id || "");
  if (!metaId) throw new Error("invalid_world: missing id");
  if ((await worldStore.getRaw(metaId))) return { ok: true, metaId, kept: true };
  await worldStore.ready;
  try { await worldStore.loadIdentity(); } catch (e) {}
  fileForm.meta.authorId = id.userId;
  if (id.username) fileForm.meta.author = id.username;
  await worldStore.save(fileForm);
  const jsonText = JSON.stringify(fileForm);
  let contentSig = "";
  try { contentSig = await contentSigOf(jsonText); } catch (e) { contentSig = ""; }
  let listingFp = "";
  try { listingFp = listingFingerprint(fileForm.meta, { coverUploaded: false, coverUrl: String(fileForm.meta.cover || rec.coverUrl || ""), coverDigest: "", notesUrl: String((fileForm.meta && isNotesPointer(fileForm.meta.authorNotes) && fileForm.meta.authorNotes) || (rec.notesId ? notesUrlForId(rec.notesId) : "")), notesDigest: "" }); } catch (e) { listingFp = ""; }
  const hidden = rec.status === "hidden";
  await setLink(metaId, {
    kind: "published", worldId: rec.worldId, jsonUrl: rec.jsonUrl, deletionUrl: null,
    jsonHash: rec.jsonHash, jsonBytes: Number(rec.jsonBytes) || 0, jsonEncoding: rec.jsonEncoding || "identity",
    version: Number(rec.version) || 1, publishedAt: Number(rec.createdAt) || Date.now(),
    updatedAt: Date.now(), lastUploadBytes: Number(rec.jsonBytes) || 0, status: "published",
    title: rec.title || fileForm.meta.name || "", coverUrl: rec.coverUrl || "",
    notesUrl: (fileForm.meta && isNotesPointer(fileForm.meta.authorNotes) && fileForm.meta.authorNotes) || (rec.notesId ? notesUrlForId(rec.notesId) : ""), notesDigest: "",
    nsfw: rec.nsfw === true, authorName: id.username || "",
    contentSig, listingFingerprint: listingFp, coverUploaded: false, coverDigest: "",
    hidden, hiddenReason: hidden ? String(rec.hiddenReason || "reports") : "", reinstatesAt: Number(rec.reinstatesAt) || 0
  });
  emit("links");
  try { await A().repaintWorldsPage?.(); } catch (e) {}
  return { ok: true, metaId, kept: false };
}

// Reclaim ALL of this identity's published worlds. Skips worlds already installed locally,
// continues past individual failures, and reports counts. Offline or auth failure throws.
export async function reclaimMyWorlds({ onProgress = () => {} } = {}) {
  const id = await getIdentity({ create: false });
  if (!id || !id.userId) throw new Error("No identity on this device.");
  let items = null;
  try {
    const token = await userTokenFor(id.userId);
    const r = await rpc("listOwnWorlds", { userId: id.userId, userToken: token });
    items = r.items || [];
  } catch (e) {
    if (e && (e.code === "bad_request" || /not a function|is not a function/.test(e.message || ""))) items = null;
    else if (e && e.code === "username_required") throw new Error("The community has no username for this identity — claim one first.");
    else if (e && e.code === "userToken_invalid") throw e;
    else throw e;
  }
  if (!items) {
    const r = await listAuthorWorlds(id.userId);
    items = r.worlds || [];
  }
  const links = await getLinks();
  const ownedWorldIds = new Set(Object.values(links || {}).filter(Boolean).map((l) => l.worldId));
  let restored = 0, kept = 0;
  const failed = [];
  let done = 0;
  for (const rec of items) {
    done++;
    try { onProgress(done, items.length, rec.title || rec.worldId); } catch (e) {}
    if (ownedWorldIds.has(rec.worldId)) { kept++; continue; }
    try {
      const r = await reclaimSingleWorld(rec.worldId, { rec });
      if (r.kept) kept++;
      else { restored++; ownedWorldIds.add(rec.worldId); }
    } catch (e) { failed.push({ worldId: rec.worldId, title: rec.title || "", error: e.message || String(e) }); }
  }
  try { await A().repaintWorldsPage?.(); } catch (e) {}
  return { total: items.length, restored, kept, failed };
}

// ➕ Add to Library. Fetches/verifies/caches FIRST, then writes the reference — so a failed
// first add leaves nothing behind (no unplayable stub). A world already in the library keeps
// its entry and only gets an unavailable/Retry flag on failure.
export async function addToLibrary(rec, { onState = () => {} } = {}) {
  const id = await getIdentity();
  const mine = id && rec.userId === id.userId;
  if (mine) {
    const localId = await metaIdFor(rec.worldId);
    const hasLocal = localId ? !!(await worldStore.getRaw(localId)) : false;
    if (hasLocal) { A().notify("ℹ️ That's your own world — you play it from your library."); return; }
    onState("downloading");
    try {
      await reclaimSingleWorld(rec.worldId, { rec });
      onState("done");
      A().notify("Restored \"" + (rec.title || rec.worldId) + "\" to your world library.");
    } catch (e) {
      onState("failed");
      A().notify("✖ Couldn't restore your world: " + (e.message || e), { ms: 6200 });
    }
    emit("library");
    return;
  }
  const preExisting = (await getLibrary())[rec.worldId] || null;
  onState("downloading");
  try {
    await fetchAndCache(rec);
  } catch (e) {
    onState("failed");
    if (!preExisting) {
      // First-time add with no working copy: leave nothing behind so an undownloadable world
      // never looks installed. fetchAndCache writes the cache only on success, but clear
      // defensively in case a stub raced in from another tab.
      try { await setLibraryRec(rec.worldId, null); } catch (err) {}
      try { await setCacheEntry(rec.worldId, null); } catch (err) {}
      A().notify("✖ Couldn't download \"" + (rec.title || rec.worldId) + "\": " + downloadFailText(e.message) + ". Nothing was added to your library.", { ms: 6200 });
    } else {
      await setLibraryRec(rec.worldId, { unavailable: true, failReason: e.message });
      A().notify("⚠️ Couldn't download \"" + (rec.title || rec.worldId) + "\": " + downloadFailText(e.message) + ". Use Retry on the card.", { ms: 6200 });
    }
    emit("library");
    return;
  }
  await setLibraryRec(rec.worldId, {
    kind: "library", worldId: rec.worldId, userId: rec.userId, authorName: rec.authorName || "",
    title: rec.title || "", coverUrl: rec.coverUrl || "", jsonUrl: rec.jsonUrl, jsonEncoding: rec.jsonEncoding,
    version: rec.version, jsonHash: rec.jsonHash, addedAt: (preExisting && preExisting.addedAt) || Date.now(), lastPlayedAt: (preExisting && preExisting.lastPlayedAt) || 0,
    // `version` is the DOWNLOADED content version; `latestVersion` is what the catalog last
    // reported. The staleness check only ever moves `latestVersion` — bumping `version` without
    // landing the file is exactly what used to clear the ⟳ badge on the next check.
    latestVersion: rec.version, latestJsonHash: rec.jsonHash || "",
    // The catalog's own size/stamp, so the Worlds panel's meta capsule can show the same facts Explore
    // does for this world without a lookup (they're a snapshot; `refreshLibraryWorld` refreshes them).
    jsonBytes: Number(rec.jsonBytes) || 0, updatedAt: Number(rec.updatedAt) || 0,
    // The catalog's listing facets, snapshotted so the local Worlds page can search/NSFW-filter and
    // show an added world without a network round-trip (the cached world file backs them up). Fork
    // provenance rides along so the card can draw its `remix` chip even before the file lands.
    description: String(rec.description || "").slice(0, 800),
    tags: Array.isArray(rec.tags) ? rec.tags.slice(0, 12) : [], nsfw: rec.nsfw === true,
    notesId: notesIdFromValue(rec.notesId) || "",
    forkOfWorldId: rec.forkOfWorldId || "", forkOfTitle: rec.forkOfTitle || "", forkOfAuthor: rec.forkOfAuthor || "",
    status: rec.status || "published", stale: false, unavailable: false, failReason: ""
  });
  onState("done");
  A().notify("Added \"" + (rec.title || rec.worldId) + "\" to your library.");
  // Best-effort download count, only for a file that actually landed. The server counts at most
  // one download per network group for a given world (abuse resistance), so this can legitimately
  // come back `counts:false` — but it still returns the authoritative total, which we fold back
  // into the record so the card's download count reflects reality instead of showing a stale number.
  try {
    const r = await rpc("incrementDownload", { worldId: rec.worldId });
    if (r && typeof r.downloads === "number") rec.downloads = r.downloads;
  } catch (e) {}
  emit("library");
}

// ---------------------------------------------------------------------------
// Unbound-adventure recovery — find the missing world in the public catalog
// ---------------------------------------------------------------------------
// An adventure whose world isn't installed any more (deleted locally, or added on another
// device) may still exist as a PUBLIC world: re-adding it beats rebinding the adventure to
// a different world. main.js's `chooseWorldForUnbound` calls this BEFORE offering the local
// world picker. `catalogId` is the bare catalog id when the adventure is bound to a removed
// `lib:<id>` entry (exact lookup — no guessing); `title` is the adventure's remembered world
// name (title search, exact-title-first). Only `published` records come back: hidden/removed
// ones are skipped, and listWorlds never returns them anyway. Throws on transport failure so
// the caller can fall back to the local-only flow.
export async function findPublicWorldMatches({ catalogId = "", title = "" } = {}) {
  const t = String(title || "").trim();
  if (catalogId) {
    let exact = null;
    try {
      const r = await rpc("getWorld", { worldId: String(catalogId) });
      if (r && r.world && r.world.status === "published") exact = r.world;
    } catch (e) {
      if (!e || e.code !== "not_found") throw e;
    }
    // An exact hit IS the adventure's world — no need to search further.
    if (exact) return { exact, matches: [] };
  }
  if (!t) return { exact: null, matches: [] };
  const r = await rpc("listWorlds", { q: t, pageSize: 10, showNsfw: true });
  const items = ((r && r.items) || []).filter((rec) => rec && rec.status === "published");
  // The catalog sorts by recency, not relevance — rank exact title matches first. `showNsfw`
  // is on purpose: the player already has an adventure in this world, so hiding an adult
  // original would miss exactly what they are looking for (matches still wear their nsfw chip).
  const lc = t.toLowerCase();
  const rank = (rec) => {
    const rt = String(rec.title || "").toLowerCase();
    return rt === lc ? 0 : rt.indexOf(lc) === 0 ? 1 : 2;
  };
  items.sort((a, b) => rank(a) - rank(b));
  return { exact: null, matches: items.slice(0, 5) };
}

// Add a public world to the library and answer the id a session should bind to: the local
// meta id for your OWN world (reclaimed into the world library), `lib:<worldId>` for anyone
// else's (added + cached). Returns null when the add failed — the failure was already
// notified (a half-added reference keeps its Retry on its card), so the caller should treat
// it as "not added" rather than bind to something unplayable.
export async function addPublicWorldAndBindId(rec) {
  await addToLibrary(rec);
  const id = await getIdentity({ create: false });
  if (id && rec.userId && rec.userId === id.userId) {
    const mid = await metaIdFor(rec.worldId);
    if (mid) {
      try { if (await worldStore.getRaw(mid)) return mid; } catch (e) {}
    }
    return null;
  }
  const lib = (await getLibrary())[rec.worldId];
  if (!lib) return null;
  if (!(await getCachedWorld(rec.worldId))) return null;
  return "lib:" + rec.worldId;
}

// Why a download failed, in the player's own terms. The raw reasons are internal codes
// (`download_failed`, `hash_mismatch`, an exception from DecompressionStream, …) that say nothing to
// a reader, so every surface that reports a failure — the toast, the card's tooltip — goes through
// here.
export function downloadFailText(reason) {
  const m = String(reason || "");
  if (m === "download_failed") return "Missing link (the author's upload has expired or been removed)";
  if (m === "hash_mismatch") return "the file that came back doesn't match the catalog's checksum";
  if (/^invalid_world/.test(m)) return "the file that came back isn't a valid world" + (m.indexOf(": ") !== -1 ? m.slice(m.indexOf(": ")) : "");
  if (/not_found/.test(m)) return "the community no longer has this world";
  if (/Failed to fetch|Load failed|NetworkError|network/i.test(m)) return "the download couldn't be reached — check your connection";
  return m || "unknown error";
}

// Retry a failed add (or a missing cache) — the same fetch/verify/cache step, but it re-resolves the
// record from the catalog FIRST: the library record is a snapshot taken when the world was added, and
// the snapshot's download link is exactly the thing that tends to rot (the author published a new
// version, or the blob it points at came off the host). Re-fetching a dead URL could never succeed,
// so the catalog is asked what the world is *now* and that record is what gets downloaded — with the
// snapshot kept as the fallback for when the catalog can't be reached at all.
export async function retryLibrary(worldId, { onState = () => {} } = {}) {
  const lib = (await getLibrary())[worldId];
  if (!lib) return false;
  onState("downloading");
  let rec = lib;
  let usedFresh = false;
  let pendingStale = !!lib.stale;
  try {
    const r = await rpc("getWorld", { worldId });
    const cur = r && r.world;
    if (!cur || cur.status === "removed") throw Object.assign(new Error("not_found"), { code: "not_found" });
    rec = Object.assign({}, lib, cur, { worldId });
    usedFresh = true;
    // Record what the catalog says, but keep the DOWNLOADED fields (`version`/`jsonHash`/
    // `jsonUrl`/…) until the new file actually lands — overwriting them here would look current
    // even when the download below fails. The full write happens on success, like refreshLibraryWorld.
    pendingStale = Number(cur.version) > Number(lib.version || 0)
      || (!!cur.jsonHash && !!lib.jsonHash && cur.jsonHash !== lib.jsonHash);
    await setLibraryRec(worldId, {
      latestVersion: Number(cur.version) || 0, latestJsonHash: cur.jsonHash || "",
      title: cur.title || lib.title, coverUrl: cur.coverUrl || "", authorName: cur.authorName || lib.authorName,
      status: cur.status || "published",
      description: String(cur.description || "").slice(0, 800),
      tags: Array.isArray(cur.tags) ? cur.tags.slice(0, 12) : lib.tags, nsfw: cur.nsfw === true,
      notesId: notesIdFromValue(cur.notesId) || "",
      forkOfWorldId: cur.forkOfWorldId || "", forkOfTitle: cur.forkOfTitle || "", forkOfAuthor: cur.forkOfAuthor || "",
      stale: pendingStale
    });
  } catch (e) {
    if (e && e.code === "not_found") {
      // The original is gone from the community: nothing can be downloaded, and saying "still
      // couldn't" would keep the player retrying a dead end. The listing state itself is left to
      // checkLibraryUpdates (which owns stale/gone) — a retry is about the file.
      await setLibraryRec(worldId, { unavailable: true, failReason: "not_found" });
      onState("gone");
      A().notify("⚠️ \"" + (lib.title || worldId) + "\" is no longer in the community, so there's nothing left to download.", { ms: 6200 });
      emit("library");
      return false;
    }
    // Offline, or the catalog server is down: retry the stored link anyway (the fall-through below).
  }
  try {
    await fetchAndCache(rec);
    if (usedFresh) {
      await setLibraryRec(worldId, {
        version: rec.version, jsonHash: rec.jsonHash, jsonUrl: rec.jsonUrl, jsonEncoding: rec.jsonEncoding,
        jsonBytes: Number(rec.jsonBytes) || 0, updatedAt: Number(rec.updatedAt) || 0,
        latestVersion: Number(rec.version) || 0, latestJsonHash: rec.jsonHash || "",
        stale: false, unavailable: false, failReason: ""
      });
    } else {
      await setLibraryRec(worldId, { unavailable: false, failReason: "" });
    }
    onState("done");
    emit("library");
    A().notify("Downloaded \"" + (rec.title || lib.title || worldId) + "\".");
    return true;
  } catch (e) {
    if (usedFresh) await setLibraryRec(worldId, { unavailable: true, failReason: e.message, stale: pendingStale });
    else await setLibraryRec(worldId, { unavailable: true, failReason: e.message });
    onState("failed");
    emit("library");
    A().notify("✖ Still couldn't download it: " + downloadFailText(e.message) + ".", { ms: 6200 });
    return false;
  }
}

// Refresh a library world to the catalog's current version (explicit user action only).
export async function refreshLibraryWorld(worldId, { quiet = false } = {}) {
  const lib = (await getLibrary())[worldId];
  if (!lib) return false;
  try {
    const r = await rpc("getWorld", { worldId });
    const rec = r.world;
    if (!rec || rec.status === "removed") throw new Error("not_found");
    await fetchAndCache(rec);
    await setLibraryRec(worldId, {
      version: rec.version, jsonHash: rec.jsonHash, jsonUrl: rec.jsonUrl, jsonEncoding: rec.jsonEncoding,
      jsonBytes: Number(rec.jsonBytes) || 0, updatedAt: Number(rec.updatedAt) || 0,
      latestVersion: Number(rec.version) || 0, latestJsonHash: rec.jsonHash || "",
      title: rec.title, coverUrl: rec.coverUrl, authorName: rec.authorName, status: rec.status,
      description: String(rec.description || "").slice(0, 800),
      tags: Array.isArray(rec.tags) ? rec.tags.slice(0, 12) : [], nsfw: rec.nsfw === true,
      notesId: notesIdFromValue(rec.notesId) || "",
      forkOfWorldId: rec.forkOfWorldId || "", forkOfTitle: rec.forkOfTitle || "", forkOfAuthor: rec.forkOfAuthor || "",
      stale: false, unavailable: false, failReason: ""
    });
    if (!quiet) A().notify("⟳ \"" + (rec.title || worldId) + "\" updated to v" + rec.version + ".");
    emit("library");
    return true;
  } catch (e) {
    if (!quiet) A().notify("✖ Couldn't update (" + e.message + ").", { ms: 5200 });
    return false;
  }
}

// Refresh every library world flagged stale (explicit user action only — the Worlds page's
// Update-all banner). Sequential: each refresh holds the socket briefly, and one failure never
// stops the rest. `onProgress(done, total)` reports after each world for the banner's counter.
export async function refreshAllStaleWorlds({ onProgress = () => {} } = {}) {
  const lib = await getLibrary();
  const ids = Object.keys(lib).filter((w) => lib[w] && lib[w].worldId && lib[w].stale);
  let updated = 0;
  const failed = [];
  for (let i = 0; i < ids.length; i++) {
    if (await refreshLibraryWorld(ids[i], { quiet: true })) updated++;
    else failed.push(ids[i]);
    onProgress(i + 1, ids.length);
  }
  return { total: ids.length, updated, failed };
}

export async function removeFromLibrary(worldId) {
  let lib = (await getLibrary())[worldId];
  // A failed read can also be transient (the "connection is closing" blip retries fine), so one
  // retry before treating it as the persistent large-value case — otherwise a momentary hiccup
  // would offer the nuclear option below.
  if (!lib && libraryReadFailed) {
    try { await new Promise((r) => setTimeout(r, 300)); } catch (e) {}
    lib = (await getLibrary())[worldId];
  }
  // The list itself is unreadable while the file cache is sharded per world, so single-world
  // cache deletes are always safe — this branch only covers the small `library` monolith. The
  // recovery drops the whole unreadable added-worlds data (library + every saved copy, plus
  // any legacy pre-sharding remnant) by key deletion, which never needs to read it.
  if (!lib && libraryReadFailed) {
    const ok = await A().ConfirmPopup.open({
      title: "Saved data unreadable",
      message: `This browser can't read your added-worlds data right now (often incognito's smaller storage limit once many worlds are saved). Remove ALL added worlds and their saved copies so you can start fresh? Your published worlds, local worlds and adventures are untouched.`,
      confirmText: "Remove all added worlds", danger: true
    });
    if (!ok) return;
    try {
      await libClearCache(KVC());
      await KVC().delete("library");
    } catch (e) { A().notify("✖ " + (e.message || e), { ms: 6200 }); return; }
    libraryCache = null; libraryReadFailed = false;
    emit("library");
    A().notify("✕ Removed all added worlds from this browser.");
    return;
  }
  if (!lib) return;
  const ok = await A().ConfirmPopup.open({
    title: "Remove from library",
    message: `Remove "${lib.title || worldId}" and its saved copy from your library? You can add it again from Explore.`,
    confirmText: "Remove", danger: true
  });
  if (!ok) return;
  try {
    await setCacheEntry(worldId, null);
    await setLibraryRec(worldId, null);
  } catch (e) {
    A().notify("✖ " + (e.message || e), { ms: 6200 });
    return;
  }
  A().notify("✕ Removed from your library.");
}

// The canonical World for a library-added world (parsed from its cached copy), or null when there's
// no downloaded copy yet. main.js's world-detail panel uses this so clicking an added card opens
// the same popup as any other world (Play / Continue + that world's adventures) rather than
// playing it immediately.
export async function getCachedWorld(worldId) {
  const entry = await getCache(worldId);
  if (!entry) return null;
  try {
    const { world } = loadWorld(entry.text);
    return world || null;
  } catch (e) { return null; }
}

// Pause Explore without tearing it down: used when the player leaves the page to start an
// adventure, so the grid they were reading stays on screen (behind the character-creation wizard)
// and backing out of the wizard lands them back on it instead of a blank pane. Only the socket is
// released — `closeExplore()` still does the full teardown when the shell truly switches pages —
// and not even that while an admin session is signed in, whose connection must survive (see
// `disconnect`).
function pauseExplore() {
  disconnect(); // no idle socket is kept while a session is on
}

// ▶ Play from the cached copy — no network at play time. `beforeOpen` is the detail panel's own close
// hook, handed down by main.js's `mountWorldSessions`: it runs at the moment the wizard's overlay is
// built, not at the click, so the dim never lifts while this copy is read out of kv (a real task, and
// the browser paints the un-screened page in any gap that big). Every bail-out below simply doesn't
// call it — leaving the panel the player clicked from exactly where it was.
export async function playLibraryWorld(worldId, beforeOpen) {
  const lib = (await getLibrary())[worldId];
  if (!lib) return;
  let entry = await getCache(worldId);
  if (!entry) {
    const ok = await retryLibrary(worldId);
    if (!ok) return;
    entry = await getCache(worldId);
    if (!entry) return;
  }
  const { world } = loadWorld(entry.text);
  if (!world) { A().notify("✖ That saved copy is damaged."); return; }
  // Bind the session to a `lib:`-prefixed id so it can never collide with a local world id and so
  // the app can always resolve it back to this cached copy (see main.js loadWorldById).
  world.meta.id = "lib:" + worldId;
  await setLibraryRec(worldId, { lastPlayedAt: Date.now() });
  pauseExplore();
  A().beginNewAdventure(world, { beforeOpen });
}

// ▶ Play your OWN published world from Explore: it plays the local copy in your library (the same
// world the Worlds page opens in the editor), never a downloaded one — your own listing is not in
// your added-world library. Explore is a reader's shelf, so this is the only thing it offers you on
// your own world; publishing it is managed from the Worlds page's ⋮ menu's community entries.
async function playOwnWorldFromExplore(worldId, beforeOpen) {
  const mid = await metaIdFor(worldId);
  if (!mid) { A().notify("✖ That world isn't in your local library any more."); return false; }
  const world = await worldStore.get(mid);
  if (!world) { A().notify("✖ Couldn't load your local copy of that world."); return false; }
  pauseExplore();
  A().beginNewAdventure(world, { beforeOpen });
  return true;
}

// The shared core of every duplicate: `fileForm` is the parsed world file, `name` the new
// title. A fork is YOUR world: clear the original's author so the copy is signed with your own
// identity rather than left wearing the original author's name on a world you now own. The
// original is still credited through `meta.remix` (which owns its own name/author fields) —
// and it is `sign` (not a bare blank) that fills in your username + id, the same as creating
// a new world (README §6.9). With no claimed username yet the copy simply goes uncredited,
// like any other. Returns true on success.
async function saveDuplicateCopy({ worldId, title, userId, authorName, fileForm, name }) {
  const copy = JSON.parse(JSON.stringify(fileForm));
  copy.meta.name = name;
  copy.meta.id = await A().freshWorldId();
  copy.meta.createdAt = new Date().toISOString();
  copy.meta.updatedAt = copy.meta.createdAt;
  copy.meta.author = "";
  copy.meta.authorId = "";
  await worldStore.sign(copy);
  copy.meta.remix = {
    worldId,
    name: title || "",
    userId: userId || "",
    author: authorName || "",
    at: new Date().toISOString()
  };
  try {
    await worldStore.save(copy);
  } catch (e) {
    A().notify("✖ " + (e.message || e), { ms: 6200 });
    return false;
  }
  await A().repaintWorldsPage?.();
  return true;
}

// ⧉ Duplicate → an ordinary local world carrying `meta.remix`.
export async function duplicateLibraryWorld(worldId, { name = null } = {}) {
  const lib = (await getLibrary())[worldId];
  if (!lib) return;
  let entry = await getCache(worldId);
  if (!entry) {
    const ok = await retryLibrary(worldId);
    if (!ok) return;
    entry = await getCache(worldId);
    if (!entry) return;
  }
  let fileForm;
  try { fileForm = JSON.parse(entry.text); } catch (e) { A().notify("✖ That saved copy is damaged."); return; }
  const nv = name != null ? name : await A().TextPopup.open({ title: "Duplicate world", value: (lib.title || "world") + " (copy)", placeholder: "New world name…", rows: 1 });
  if (nv === null || !nv.trim()) return;
  const done = await saveDuplicateCopy({
    worldId: lib.worldId, title: lib.title, userId: lib.userId, authorName: lib.authorName,
    fileForm, name: nv.trim()
  });
  if (done) A().notify("⧉ Duplicated — you now own an editable copy (with credits to the original).");
}

/* ---------------------------------------------------------------------------
 * staleness check — metadata only, batched, never at boot
 * ------------------------------------------------------------------------- */

// Check every eligible library world for a newer catalog version. `silent` skips the "nothing new"
// toast (used by the automatic checks).
export async function checkLibraryUpdates({ silent = false } = {}) {
  const lib = await getLibrary();
  const id = await getIdentity();
  const ids = Object.keys(lib).filter((w) => lib[w] && lib[w].worldId && (!id || lib[w].userId !== id.userId));
  if (!ids.length) { if (!silent) A().notify("📚 Nothing added yet — add worlds from Explore first."); return { checked: 0, stale: 0 }; }
  const fresh = [];
  try {
    for (let i = 0; i < ids.length; i += 64) {
      const chunk = ids.slice(i, i + 64);
      const r = await rpc("getWorlds", { worldIds: chunk });
      fresh.push(...(r.items || []));
    }
  } catch (e) {
    // Offline / socket gone: skip silently and keep playing from cache — never claim an update we
    // don't know about.
    if (!silent) A().notify("📡 Couldn't check for updates — playing your saved copies.", { ms: 4200 });
    return { checked: 0, stale: 0, offline: true };
  }
  let stale = 0;
  for (const rec of fresh) {
    const cur = lib[rec.worldId];
    if (!cur) continue;
    if (rec.status === "unknown") {
      await setLibraryRec(rec.worldId, { status: "unknown", gone: true });
      continue;
    }
    // `version` is the DOWNLOADED content version and must not move here — an earlier build
    // overwrote it with the catalog version on every check, so the SECOND check saw equal
    // versions and cleared the ⟳ badge before the new file ever landed (notably on opening
    // Explore, which re-runs this check). Only `latestVersion` moves here; the download itself
    // moves `version` via refreshLibraryWorld/retryLibrary.
    // Migration for records the old code already bumped: a record still flagged stale had its
    // downloaded version baked over with the catalog one, so roll it back one to keep the badge
    // until a real refresh lands. Records that never had `latestVersion` and aren't stale simply
    // adopt their (correct) version as the last-seen one.
    let downloaded = Number(cur.version || 0);
    let latest = cur.latestVersion == null ? NaN : Number(cur.latestVersion);
    let migrated = false;
    if (Number.isNaN(latest)) {
      migrated = true;
      if (cur.stale) {
        latest = Number(rec.version) || 0;
        downloaded = Math.max(0, latest - 1);
      } else {
        latest = downloaded;
      }
    }
    const catalogVer = Number(rec.version) || 0;
    if (catalogVer > latest) latest = catalogVer;
    let isStale = latest > downloaded;
    if (!isStale && rec.jsonHash && cur.jsonHash && rec.jsonHash !== cur.jsonHash) isStale = true;
    if (isStale) stale++;
    const write = {
      title: rec.title, coverUrl: rec.coverUrl, authorName: rec.authorName,
      description: String(rec.description || cur.description || "").slice(0, 800),
      tags: Array.isArray(rec.tags) ? rec.tags.slice(0, 12) : (cur.tags || []),
      notesId: rec.notesId || "",
      latestVersion: latest, latestJsonHash: rec.jsonHash || "",
      status: rec.status, stale: isStale, gone: false
    };
    if (migrated && cur.stale) write.version = downloaded;
    await setLibraryRec(rec.worldId, write);
  }
  await saveSettings({ lastUpdateCheckAt: Date.now() });
  emit("library");
  if (!silent && stale) A().notify("⟳ " + stale + " added world" + (stale > 1 ? "s have" : " has") + " an update available.");
  return { checked: fresh.length, stale };
}

// The throttled, deferred check that runs once per visit when the Worlds page mounts with a
// non-empty library. Opens a short-lived socket and closes it as soon as the batch lands.
export async function maybeAutoUpdateCheck() {
  const lib = await getLibrary();
  if (!Object.keys(lib).length) return;
  const s = await getSettings();
  if (Date.now() - (s.lastUpdateCheckAt || 0) < UPDATE_CHECK_MS) return;
  try {
    await checkLibraryUpdates({ silent: true });
    // A world whose saved copy exists but whose live record vanished gets the "saved copy" badge.
    for (const [wid, rec] of Object.entries(await getLibrary())) {
      if (rec.gone && !rec.stale) await setLibraryRec(wid, { stale: false });
    }
  } catch (e) { /* offline — nothing to do */ }
  // The check opened the socket only for this batch — unless Explore is open and wants it kept.
  if (!ex.open) disconnect();
}

/* ---------------------------------------------------------------------------
 * small busy/toast popup used by the publish flows
 * ------------------------------------------------------------------------- */

// The publishing overlay a flow is currently showing, if any. A popup that has to interrupt a flow
// (the `username_required` recovery) uses this to step in front of it instead of fighting it.
let activeBusy = null;

function makeBusyPopup(title, { zIndex = 0 } = {}) {
  const overlay = el("div", "cc-overlay ex-busy");
  if (zIndex) overlay.style.zIndex = String(zIndex);
  overlay.innerHTML = `
    <div class="cc-panel ex-busy-panel">
      <div class="ex-busy-head"><span class="ex-spinner"></span><span class="ex-busy-title">${esc(title)}</span></div>
      <div class="ex-busy-sub"></div>
    </div>`;
  document.body.appendChild(overlay);
  const sub = overlay.querySelector(".ex-busy-sub");
  const head = overlay.querySelector(".ex-busy-title");
  const initialTitle = head.textContent;
  let lastSay = "";
  let released = false;
  const rl = pushBackClose(() => false); // Back must not dismiss a publish in flight
  const release = () => { if (!released) { released = true; rl(); } };
  const api = {
    say(msg) { lastSay = msg || ""; sub.textContent = lastSay; },
    setTitle(t) { head.textContent = t; },
    // Hand the overlay's text to an interrupting popup, and take it back afterwards.
    lend(t, msg) { head.textContent = t; sub.textContent = msg || ""; },
    unlend() { head.textContent = initialTitle; sub.textContent = lastSay; },
    close() { release(); overlay.remove(); if (activeBusy === api) activeBusy = null; }
  };
  activeBusy = api;
  return api;
}

/* ===========================================================================
 * Explore page (mounts into #homeMain)
 * ========================================================================= */

// Compact popularity counts, exactly as the profile header formats them: 999 stays "999",
// 1000 becomes "1k", 1500 becomes "1.5k", 12000 becomes "12k". Used by every like/download
// counter on cards and detail panels (which share `likeCountHtml`), so they all read alike.
function num(v) { v = Number(v) || 0; if (v >= 1000) return (v / 1000).toFixed(v >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k"; return String(v); }

const ex = {
  open: false,
  q: "",
  // The three-valued tag filter, exactly as Worlds' panel has it: `tags` are REQUIREMENTS (a world
  // must carry every one) and `tagsNot` are EXCLUSIONS (a world must carry none). Both are sent to
  // the server, so pagination totals stay honest.
  tags: [],
  tagsNot: [],
  sort: "updated",
  randomSeed: "",
  // Explore's reader-local filter: the worlds YOU have liked. It is a chip like the tags — click the
  // value to require it, click its ✕ to exclude it (hide the worlds you've liked) — but unlike a tag it
  // is not a catalog facet (the catalog knows only like *counts*, never who hearted what), so the
  // reader's own per-device `likedWorlds` ids ride the query as a `worldIds` / `worldIdsNot` allow/deny
  // list (see `filterRecords` in index.html) and the paging totals stay honest. Not persisted across
  // visits, like the tag filters — it is a thing you switch on for this search.
  liked: false,
  likedNot: false,
  // Explore's reader-local filter: the worlds YOU have added to your library. A chip like Liked —
  // click the value to require it, click its ✕ to exclude it (hide the worlds you've added) — and
  // like Liked its ids ride the query as a `worldIds` / `worldIdsNot` allow/deny list (the catalog
  // knows only listings, never whose library holds what). Not persisted, like the other filters.
  added: false,
  addedNot: false,
  // Explore's reader-local filter: your own published worlds, the same three-valued chip as
  // Liked/Added — click the value to require it (only your listings, via the query's `userId`),
  // click its ✕ to exclude it (hide your listings, via the query's `userIdNot`). Not persisted,
  // like the other search filters.
  mine: false,
  mineNot: false,
  // Mirrors of the reader settings the toolbar reads synchronously: the ⚙ panel's rows are built from
  // these, and every write goes back through saveSettings. The ⊘ NSFW switch is NOT mirrored
  // here: it is the toolbar's own shared preference (search-bar.js), the same one Worlds' library shows.
  blockedTags: [],
  mutedUsers: [],
  authorId: null,
  authorName: "",
  page: 1,
  items: [], // visible (client-filtered) items accumulated so far
  serverIds: new Set(),
  serverTotal: 0,
  facets: null,
  loading: false,
  error: null,
  done: false,
  nudge: 0, // unseen live catalog changes while Explore is open
  el: null,
  host: null,   // the shell pane Explore was mounted into
  bar: null,    // the shared search bar (search-bar.js)
  activeBar: null, // the removable pill row under the bar (applied tag/author filters)
  idBtn: null,  // the identity chip, in the shell's page-header actions
  unsub: null,
};

// The two markers that lead the tag list in the ⚙ panel — in the same order they lead a card's own
// tag row (tag-row.js), and the same order Worlds' panel uses. Neither is an author tag: each is a
// catalog FIELD (`nsfw` from the rating, `remix` from the fork provenance), so the server matches
// them structurally rather than against the record's `tags`.
const SPECIAL_TAGS = [NSFW_TAG, REMIX_TAG];

// The Explore page's empty-state mark: the same `.hm-empty-mark` mask Worlds uses, but pointed at the
// Explore nav item's own emblem (`icon-explore.png`, the 📖 on the rail), so "nothing here" wears the
// page's own picture. A mask takes the block's muted colour rather than the PNG's own.
const EXPLORE_MARK = '<span class="hm-empty-mark hm-empty-mark-ex" aria-hidden="true"></span>';

// Explore's sort orders, in the shape the shared bar's menu wants. It stays a themed menu rather than a
// native <select> for the same reason Worlds' does: the OS paints a native dropdown in the system's own
// colours, so it was the one control on the page that couldn't wear the theme.
const EX_SORTS = [
  { id: "updated", label: "Recently updated" },
  { id: "newest", label: "Newest" },
  { id: "downloads", label: "Most downloaded" },
  { id: "likes", label: "Most liked" },
  { id: "name", label: "Name A–Z" },
  { id: "random", label: "Random" }
];

function newRandomSeed() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

// The catalog topic echoes our own writes back to us (pub/sub includes the sender). Every local
// publish/unpublish stamps this so its echo doesn't badge the UI we just updated ourselves.
let nudgeSuppressUntil = 0;

// Show/hide the "Explore updated" pill and label it with how many changes we've coalesced.
function setNudge(n) {
  if (!ex.el) return;
  const box = ex.el.querySelector(".ex-nudge");
  if (!box) return;
  if (!n || !ex.open) { box.hidden = true; return; }
  box.hidden = false;
  box.querySelector(".ex-nudge-btn").textContent = n === 1 ? "⟳ Explore updated — refresh" : `⟳ ${n} changes in Explore — refresh`;
}

// A catalog nudge arrived on the open Explore socket: coalesce it into the pill rather than
// yanking the grid out from under whoever is reading it.
function onCatalogMessage(data) {
  if (typeof data !== "string" || data.charCodeAt(0) !== 123 /* "{" */) return;
  let msg;
  try { msg = JSON.parse(data); } catch (e) { return; }
  if (!msg || !msg.type) return;
  if (Date.now() < nudgeSuppressUntil) return;
  if (!ex.open) return;
  ex.nudge += 1;
  setNudge(ex.nudge);
}

export function myUserId() { return identity ? identity.userId : ""; }

// Non-creating identity read for pages that must know who the reader is without minting one
// (the user-profile page: `myUserId()` is empty until something has read the identity this load).
export function ensureIdentity() { return getIdentity({ create: false }); }

// The author dimension of the catalog query: the Mine filter wins over the `by @name` filter,
// and with no identity yet it resolves to an id that matches nothing (so the grid reads empty
// instead of silently showing everyone).
function exploreUserId() {
  if (ex.mine) return myUserId() || "__none__";
  return ex.authorId || "";
}
// The exclusion side of the same dimension: hides your own worlds. With no identity yet there
// is nothing to hide, so it resolves to no filter (unlike the require side, which must match nothing).
function exploreUserIdNot() {
  if (ex.mineNot) return myUserId() || "";
  return "";
}

// Private reader-side blocklists — never sent to the server; applied after each page.
async function blockedSet() {
  const s = await getSettings();
  return {
    tags: (s.blockedTags || []).map((t) => String(t).toLowerCase()),
    users: s.mutedUsers || []
  };
}
function passesBlocklists(rec, blocked) {
  if (blocked.users.indexOf(rec.userId) !== -1) return false;
  const tags = (rec.tags || []).map((t) => String(t).toLowerCase());
  return !blocked.tags.some((t) => tags.indexOf(t) !== -1);
}

function exploreHost() {
  return document.getElementById("homeMain");
}

// Explore's grid cache: what you were reading when you left the page, so coming back (browser
// Back) restores the grid instead of re-querying page 1 — and the shell's scroll restore lands,
// because the saved offset only exists when the cached height is back. The cache is valid only
// while the query itself is unchanged (search, tags, sort, author/mine/liked/added dimensions,
// NSFW, blocklists): anything else re-queries fresh. Like counts and library badges are already
// kept live on the cached records (`toggleLike` syncs counts into `ex.items`, badge/library
// events repaint), so a restored grid reads current until your next explicit refresh.
// The query signature — everything that decides grid MEMBERSHIP. Deliberately not the records
// themselves: count/order drift is tolerated like the Worlds page's staleness, while a filter
// change (e.g. a tag shortcut from a detail panel while Explore was closed) correctly misses.
// The snapshot also carries `at` (see closeExplore): restores older than EXPLORE_CACHE_TTL_MS
// count as a miss, so a return after ~15 min away re-queries fresh. Keep in sync with
// EXPLORE_SCROLL_TTL_MS in main.js (the shell's saved scroll offset expires on the same clock,
// or a fresh grid would restore a stale offset).
const EXPLORE_CACHE_TTL_MS = 15 * 60 * 1000;
let exCache = null; // { query, seed, items, page, done, serverTotal, serverIds, facets, at } | null
function exploreQuery() {
  const sorted = (a) => (Array.isArray(a) ? a.map((t) => String(t).toLowerCase()).sort() : []);
  return {
    q: String(ex.q || "").trim().toLowerCase(),
    tags: sorted(ex.tags), tagsNot: sorted(ex.tagsNot),
    sort: ex.sort, author: String(ex.authorId || ""),
    mine: !!ex.mine, mineNot: !!ex.mineNot,
    liked: !!ex.liked, likedNot: !!ex.likedNot, added: !!ex.added, addedNot: !!ex.addedNot,
    nsfw: showNsfw(),
    blocked: sorted(ex.blockedTags).join("\n"),
    muted: (ex.mutedUsers || []).map((u) => String(u).toLowerCase()).sort().join("\n")
  };
}
// Paint the cached grid when the query still matches. Synchronous — the full height exists
// before the mount resolves, which is what the shell's scroll restore needs. Returns whether
// the mount can skip its fetch.
function restoreExploreCache() {
  if (!exCache || !exCache.items || !exCache.items.length) return false;
  // Stale snapshot: the catalog has had 15 min to move on — drop it so the mount re-queries.
  if (!exCache.at || Date.now() - exCache.at > EXPLORE_CACHE_TTL_MS) { exCache = null; return false; }
  if (JSON.stringify(exCache.query) !== JSON.stringify(exploreQuery())) return false;
  if (ex.sort === "random") ex.randomSeed = exCache.seed || "";
  ex.items = exCache.items;
  ex.page = exCache.page;
  ex.done = exCache.done;
  ex.serverTotal = exCache.serverTotal;
  ex.serverIds = new Set(exCache.serverIds);
  ex.facets = exCache.facets;
  ex.nudge = 0; ex.error = null; ex.loading = false;
  renderExploreFilterState();
  if (ex.bar) ex.bar.refresh();
  renderExploreGrid();
  const more = ex.el.querySelector(".ex-more");
  if (more) more.hidden = !!ex.done;
  syncOwnLinkStatuses(ex.items).catch(() => {});
  return true;
}

// Mount the Explore page into the home shell's content pane (`#homeMain` → the pane main.js passes)
// and put the identity chip into the page-header actions. Explore no longer owns a screen of its
// own: the shell's nav is the way out, its page header carries the title, and the socket's lifetime
// is tied to this mount (opened on the first mount, closed on unmount). Called by main.js's
// mountExplorePage.
export async function mountExplore(host, { actionsEl = null, idEl = null } = {}) {
  // A newer navigation may have started while an older mount was still fetching: the orphaned mount
  // then completes into detached DOM. It must neither block the live mount nor pose as live state —
  // attachment is synchronous ground truth, so a detached page can never count as open.
  if (ex.open && ex.el && ex.el.isConnected) return;
  ex.open = false;
  ex.el = null;
  host = host || exploreHost();
  if (!host) return;
  await getIdentity({ create: false }); // so `myUserId()` can mark your own worlds
  ex.open = true;
  ex.host = host;
  const page = el("div", "ex-page");
  page.innerHTML = `
    <div class="ex-banner" hidden></div>
    <div class="ex-nudge" hidden><button class="mini ok ex-nudge-btn" type="button">⟳ Explore updated — refresh</button></div>
    <div class="ex-grid"></div>
    <div class="ex-foot">
      <span class="ex-count"></span>
      <button class="mini ok ex-more" type="button" hidden>Load more</button>
      <button class="mini ex-seed" type="button" hidden title="Editor-only: fill this preview with mock worlds">🧪 Seed mock worlds</button>
    </div>`;
  host.appendChild(page);
  ex.el = page;
  // The chip goes in the page header's own identity slot (`.hm-id`), not in the actions row: it is
  // part of "which page am I on / who am I", so on a phone it rides the sticky top bar with the title
  // (see the drawer band in styles.css). The slot sits inside the bar either way, so the desktop
  // layout is unchanged: there the bar has no box of its own and the chip lands where the actions are.
  const idSlot = idEl || actionsEl;
  if (idSlot) {
    const idBtn = el("button", "ex-identity", "");
    idBtn.type = "button";
    idBtn.title = "Your identity & settings";
    idBtn.onclick = () => {
      const id = identity;
      if (id && id.userId && id.username) A().goUser(id.userId, id.username);
      else A().openSettingsPanel("identity");
    };
    idSlot.appendChild(idBtn);
    ex.idBtn = idBtn;
    // (There is no 📜 Log button here: the moderation log is owner-only, behind the Settings panel's
    // Admin section, and the server refuses it to anyone who hasn't signed in. See `adminSection`.)
  }

  const s = await getSettings();
  hydrateLiked(s);
  ex.sort = s.sort || "updated";
  // No random seed here: reshuffling now would invalidate a cached random-order grid before it
  // can be compared — the restore-or-refresh below owns the seed.
  ex.blockedTags = (s.blockedTags || []).slice();
  ex.mutedUsers = (s.mutedUsers || []).slice();

  // The toolbar is the SAME one Worlds wears (search-bar.js): a search field with a drawn magnifier and
  // its own ✕, one ⚙ Filters disclosure, the ⇅ sort menu, and the ⊘ NSFW switch — which moves NSFW out
  // of the panel, because
  // it isn't a filter on the list but the one thing that decides what EXISTS.
  const barApi = searchBar({
    placeholder: "Search worlds…",
    query: ex.q,
    onQuery: (v) => { ex.q = v; refreshExplore(); },
    sort: {
      options: EX_SORTS,
      value: () => ex.sort,
      onPick: (id) => { ex.sort = id; if (id === "random") ex.randomSeed = newRandomSeed(); saveSettings({ sort: id }); refreshExplore(); }
    },
    filters: {
      label: "Filters",
      title: "Filter worlds by tag, and the ones only you see",
      count: exploreFilterCount,
      body: renderExploreFilters,
      clearAll: () => clearExploreFilters()
    },
    nsfw: {
      onChange: () => {
        // The same rule as Worlds: with adult worlds hidden again, "only the nsfw ones" can never match
        // anything — so drop that tag rather than leave the grid empty behind a tag you set from a chip.
        if (!showNsfw()) {
          ex.tags = ex.tags.filter((t) => String(t).toLowerCase() !== NSFW_TAG);
          ex.tagsNot = ex.tagsNot.filter((t) => String(t).toLowerCase() !== NSFW_TAG);
        }
        refreshExplore(true);
      }
    }
  });
  page.prepend(barApi.el);
  ex.bar = barApi;

  // The applied filters, as removable pills below the bar — the same row Worlds has, so an applied tag
  // is visible (and one click from removal) without opening the panel.
  const activeBar = el("div", "hm-activebar");
  activeBar.hidden = true;
  barApi.el.after(activeBar);
  ex.activeBar = activeBar;

  page.querySelector(".ex-more").onclick = () => loadExplorePage({ append: true });
  page.querySelector(".ex-nudge-btn").onclick = () => { ex.nudge = 0; setNudge(0); refreshExplore(); };
  // Dev-only: the editor's server is an ephemeral emulator that starts empty on every load, so give
  // ourselves a way to fill it. Never shown once the generator is saved (a real catalog is shared).
  const seedBtn = page.querySelector(".ex-seed");
  if (window.generatorIsUnsaved) {
    seedBtn.hidden = false;
    seedBtn.onclick = () => runMockSeed(seedBtn);
  }
  paintIdentityButton();
  if (ex.bar) ex.bar.refresh();

  // Live catalog changes while Explore is open (a pub/sub nudge, or a local library change).
  ex.unsub = onEvent((type) => {
    if (!ex.open) return;
    // A library change only repaints the ✓ badges — unless the Added filter is engaged, in which
    // case the grid's membership just changed and the query has to run again.
    if (type === "library") { if (ex.added || ex.addedNot) refreshExplore(); else renderExploreGrid(); }
    // "links" means *we* just changed a catalog record (publish/update/unpublish): re-read the
    // catalog so Explore shows the truth immediately.
    else if (type === "links") refreshExplore();
    // The admin flag moved (signed in, signed out, or the connection carrying it dropped): the 🔑
    // controls exist only while it is true, so the grid has to be redrawn either way.
    else if (type === "admin") renderExploreGrid();
  });

  // Back-navigation restores the cached grid (scroll included); anything else re-queries fresh.
  if (!restoreExploreCache()) {
    if (ex.sort === "random") ex.randomSeed = newRandomSeed();
    await refreshExplore();
  }
  // The mount may have lost its race while fetching (a newer navigation wiped our pane): never
  // commit live state from a detached page — clear only our own artifacts and stand down, so the
  // live mount's flags, socket and watchers are untouched.
  if (!host.isConnected) {
    if (ex.el === page) { ex.el = null; ex.open = false; }
    return () => {};
  }
  // The socket is already open here, so the staleness batch is essentially free.
  checkLibraryUpdates({ silent: true }).then(() => renderExploreGrid()).catch(() => {});
  // Watch the catalog for the rest of this visit, so publishes/moderation show up without polling.
  rpc("watchCatalog", {}).catch(() => {});
  ensureKeepalive(); // 20s ping keeps this long-lived socket past NAT idle timeouts
}

// Tear the Explore page down. The shell discards its pane anyway; this releases the socket, the
// catalog watcher, the pub/sub subscription, the identity chip and the 📜 Log button, and snapshots
// the grid (with `at`) for a later return within EXPLORE_CACHE_TTL_MS.
export function closeExplore() {
  if (!ex.open) return;
  // A details panel outlives the pane it was raised from (it lives on <body>), so take it down with the
  // page. Its history entry is given up, never popped: the shell is already on its way to another
  // page's URL, and a pop here would fight that navigation.
  if (openDetailClose) { takingOverDetail = true; try { openDetailClose(); } catch (e) {} takingOverDetail = false; }
  // Snapshot the grid for a later return (see exCache): items, paging cursor and totals, so Back
  // restores what you were reading instead of re-querying page 1.
  exCache = ex.items && ex.items.length
    ? {
        query: exploreQuery(), seed: ex.randomSeed, items: ex.items, page: ex.page,
        done: ex.done, serverTotal: ex.serverTotal, serverIds: [...ex.serverIds], facets: ex.facets,
        at: Date.now()
      }
    : null;
  ex.open = false;
  if (ex.unsub) { ex.unsub(); ex.unsub = null; }
  if (ex.idBtn) { ex.idBtn.remove(); ex.idBtn = null; }
  if (ex.el) ex.el.remove();
  ex.bar = null;
  ex.el = null;
  ex.activeBar = null;
  ex.host = null;
  ex.items = [];
  ex.serverIds = new Set();
  ex.nudge = 0;
  disconnect(); // no idle socket is kept while the player is elsewhere
}

// Editor-only helper behind the 🧪 button. Publishes the mock catalog through the normal RPC
// surface, then re-reads Explore so the new worlds appear. See src/scripts/mock-seed.js.
async function runMockSeed(btn) {
  if (btn.disabled) return;
  btn.disabled = true;
  const label = btn.textContent;
  try {
    const { seedMockCatalog } = await import("./mock-seed.js");
    const res = await seedMockCatalog({ onProgress: (m) => { btn.textContent = "🧪 " + m; } });
    console.log("[mock-seed]", res);
    let msg;
    if (res.published) {
      msg = "🧪 Seeded " + res.published + " world" + (res.published === 1 ? "" : "s") + ".";
      if (res.hitLimit) msg += " Editor cap reached — reload the preview to add more.";
    } else if (res.skippedPresent) {
      msg = "🧪 Already seeded (" + res.skippedPresent + " world" + (res.skippedPresent === 1 ? "" : "s") + " already there).";
    } else {
      msg = "🧪 Nothing to seed.";
    }
    A().notify(msg, { ms: 6500 });
    await refreshExplore(true);
  } catch (e) {
    console.error("[mock-seed]", e);
    A().notify("✖ Seed failed: " + e.message, { ms: 5200 });
  } finally {
    btn.textContent = label;
    btn.disabled = false;
  }
}

async function refreshExplore(hard = false) {
  if (!ex.open) return;
  hydrateLiked(await getSettings());
  if (ex.sort === "random" && !ex.randomSeed) ex.randomSeed = newRandomSeed();
  if (hard) {
    const s = await getSettings();
    // The bar's rows read these mirrors, so they always show what's actually in force.
    ex.blockedTags = (s.blockedTags || []).slice();
    ex.mutedUsers = (s.mutedUsers || []).slice();
  }
  if (ex.bar) ex.bar.refresh();
  renderExploreFilterState();
  ex.page = 1;
  ex.items = [];
  ex.serverIds = new Set();
  ex.serverTotal = 0;
  ex.done = false;
  ex.error = null;
  ex.nudge = 0;
  setNudge(0);
  renderExploreGrid(true);
  await loadExplorePage({ append: false });
  await loadFacets();
}

function setBanner(html, kind) {
  const b = ex.el && ex.el.querySelector(".ex-banner");
  if (!b) return;
  if (!html) { b.hidden = true; return; }
  b.hidden = false;
  b.className = "ex-banner" + (kind ? " " + kind : "");
  b.innerHTML = html;
}

// The reader-local id filters (♥ Liked, ✓ Added) ride the query as one allow-list and one
// deny-list: each engaged REQUIRE contributes its ids to the allow-list (two at once intersect —
// a world must be both liked AND added), each EXCLUDE contributes to the deny-list (union).
async function idFilterLists() {
  let allow = null;
  const deny = new Set();
  if (ex.liked) allow = new Set(likedSet);
  if (ex.likedNot) for (const id of likedSet) deny.add(id);
  if (ex.added || ex.addedNot) {
    let lib = {};
    try { lib = await getLibrary(); } catch (e) {}
    const ids = Object.keys(lib);
    if (ex.added) {
      const a = new Set(ids);
      allow = allow ? new Set([...allow].filter((id) => a.has(id))) : a;
    }
    if (ex.addedNot) for (const id of ids) deny.add(id);
  }
  return { allow: allow ? [...allow] : undefined, deny: deny.size ? [...deny] : undefined };
}

// Fetch one server page and append the client-visible items. When private blocklists are active we
// over-fetch: walk subsequent server pages (bounded) until the visible page fills.
async function loadExplorePage({ append }) {
  if (!ex.open || ex.loading) return;
  ex.loading = true;
  ex.error = null;
  if (!append) setBanner("");
  const more = ex.el.querySelector(".ex-more");
  more.hidden = true;
  renderExploreGrid();
  const blocked = await blockedSet();
  const ids = await idFilterLists();
  const blocklistsActive = blocked.tags.length > 0 || blocked.users.length > 0;
  const wanted = PAGE_SIZE;
  const startLen = ex.items.length;
  let extra = 0;
  try {
    while (true) {
      const r = await rpc("listWorlds", {
        q: ex.q, tags: ex.tags, tagsNot: ex.tagsNot, sort: ex.sort, randomSeed: ex.sort === "random" ? ex.randomSeed : undefined, userId: exploreUserId(), userIdNot: exploreUserIdNot(),
        page: ex.page, pageSize: PAGE_SIZE,
        showNsfw: showNsfw(),
        worldIds: ids.allow,
        worldIdsNot: ids.deny
      });
      ex.serverTotal = r.total;
      for (const rec of r.items) {
        if (ex.serverIds.has(rec.worldId)) continue;
        ex.serverIds.add(rec.worldId);
        if (!passesBlocklists(rec, blocked)) continue;
        ex.items.push(rec);
      }
      ex.page += 1;
      const gotFull = r.items.length === PAGE_SIZE;
      if (!gotFull) { ex.done = true; break; }
      if (!blocklistsActive) break;
      if (ex.items.length - startLen >= wanted) break; // the visible page is full
      if (++extra >= 5) break; // bounded over-fetch
    }
  } catch (e) {
    ex.error = e;
    setBanner(`⚠️ ${esc(e.message)} <button class="mini ex-retry">Retry</button>`, "bad");
    const btn = ex.el.querySelector(".ex-retry");
    if (btn) btn.onclick = () => loadExplorePage({ append });
  } finally {
    ex.loading = false;
  }
  renderExploreGrid();
  if (ex.error) return;
  syncOwnLinkStatuses(ex.items).catch(() => {});
  if (!ex.done) more.hidden = false;
}

async function loadFacets() {
  if (!ex.open) return;
  try {
    // The catalog's tag vocabulary for the current query (the server ignores the tag dimension, so a
    // count says "what is out there for this tag", never 0 just because you picked it).
    const ids = await idFilterLists();
    const r = await rpc("listFacets", { q: ex.q, userId: exploreUserId(), userIdNot: exploreUserIdNot(), showNsfw: showNsfw(), worldIds: ids.allow, worldIdsNot: ids.deny });
    ex.facets = r.tags || [];
  } catch (e) { ex.facets = null; }
  // The panel's tag chips carry the counts, so repaint it when it happens to be open.
  if (ex.bar) ex.bar.refresh();
}

// A tag chip in the world detail panel is a shortcut into Explore's own tag filter (the same panel
// Worlds has): a FRESH filter on that one tag, so the reader lands on exactly that tag's worlds rather
// than on an empty list a leftover filter would have to explain. An `nsfw` chip also turns the
// toolbar's Show-NSFW preference on — they just asked to see an adult world.
async function applyTagFilter(tag) {
  const t = String(tag || "").trim();
  if (!t) return;
  ex.tagsNot = [];
  ex.tags = [t];
  if (String(t).toLowerCase() === NSFW_TAG && !showNsfw()) {
    setShowNsfw(true);
    if (ex.bar) ex.bar.refresh();
    refreshExplore(true);
    return;
  }
  refreshExplore();
}

// Toggle one tag's direction on the panel, exactly like Worlds' source/tag chips: clicking the value
// REQUIRES it, clicking the ✕ on its right EXCLUDES it, and the two sides are mutually exclusive per
// value (a value can never be both). Every change re-runs the query, so the grid and the totals are
// always the truth behind the chips.
function toggleTag(t) {
  ex.tagsNot = ex.tagsNot.filter((x) => String(x).toLowerCase() !== String(t).toLowerCase());
  const i = ex.tags.findIndex((x) => String(x).toLowerCase() === String(t).toLowerCase());
  if (i >= 0) ex.tags.splice(i, 1); else ex.tags.push(t);
  afterTagChange();
}
function toggleTagNot(t) {
  ex.tags = ex.tags.filter((x) => String(x).toLowerCase() !== String(t).toLowerCase());
  const i = ex.tagsNot.findIndex((x) => String(x).toLowerCase() === String(t).toLowerCase());
  if (i >= 0) ex.tagsNot.splice(i, 1); else ex.tagsNot.push(t);
  afterTagChange();
}
function afterTagChange() {
  renderExploreFilterState(); // the pill row answers the click immediately…
  refreshExplore();           // …and the catalog query follows
}

// The applied filters, as removable pills under the bar — Worlds' row, with Worlds' grammar: a required
// tag is a plain accent pill, an excluded one is dashed, struck through and red (a plain `nsfw` beside
// `⊘ nsfw` would otherwise read alike), and the `by @name` filter leads because it is the one applied
// filter with no chip in the panel. "Clear all" is the last pill.
function renderExploreFilterState() {
  if (!ex.activeBar) return;
  if (ex.bar) ex.bar.refresh();
  ex.activeBar.innerHTML = "";
  const pill = (label, onRemove, excluded) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "hm-apill" + (excluded ? " hm-apill-ex" : "");
    b.title = excluded ? "Stop excluding this" : "Remove this filter";
    b.innerHTML = excluded
      ? `<span class="hm-strike">⊘ ${esc(label)}</span> <span class="hm-x">✕</span>`
      : `${esc(label)} <span class="hm-x">✕</span>`;
    b.onclick = onRemove;
    ex.activeBar.appendChild(b);
  };
  if (ex.liked) pill("♥ Liked", () => { ex.liked = false; afterTagChange(); }, false);
  if (ex.likedNot) pill("♥ Liked", () => { ex.likedNot = false; afterTagChange(); }, true);
  if (ex.added) pill("✓ Added", () => { ex.added = false; afterTagChange(); }, false);
  if (ex.addedNot) pill("✓ Added", () => { ex.addedNot = false; afterTagChange(); }, true);
  if (ex.mine) pill("✎ My World", () => { ex.mine = false; afterTagChange(); }, false);
  if (ex.mineNot) pill("✎ My World", () => { ex.mineNot = false; afterTagChange(); }, true);
  for (const t of ex.tags) pill(t, () => toggleTag(t), false);
  for (const t of ex.tagsNot) pill(t, () => toggleTagNot(t), true);
  if (ex.authorId) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "hm-apill";
    b.title = "Remove this author filter";
    b.innerHTML = `${esc(`by @${ex.authorName || ex.authorId}`)} <span class="hm-x">✕</span>`;
    b.onclick = () => { ex.authorId = null; ex.authorName = ""; ex.mine = false; afterTagChange(); };
    ex.activeBar.prepend(b);
  }
  const n = exploreFilterCount();
  ex.activeBar.hidden = !n;
  if (!n) return;
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "hm-plink";
  clear.textContent = "Clear all";
  clear.onclick = () => clearExploreFilters();
  ex.activeBar.appendChild(clear);
}

// One entry in the ⚙ panel: the value on the left (click = REQUIRE it) and an ✕ on its right (click =
// EXCLUDE it), byte-identical to Worlds' `optionEl` so the two panels read as one control. The wrapper
// paints the state — nothing, `.on` (required) or `.ex` (excluded) — and `extra` is the marker's own
// tint for the two special tags, which `.ex` overrides when it applies.
function optionEl(label, count, state, onMain, onX, tips, extra = "") {
  const el = document.createElement("span");
  el.className = "hm-popt" + (state === "on" ? " on" : state === "ex" ? " ex" : "") + extra;
  const main = document.createElement("button");
  main.type = "button";
  main.className = "hm-opt-main";
  main.title = state === "on" ? "Remove this requirement" : tips.main;
  main.innerHTML = `<span class="hm-opt-lb">${esc(label)}</span>${count ? `<span class="hm-tag-n">${count}</span>` : ""}`;
  main.onclick = onMain;
  const x = document.createElement("button");
  x.type = "button";
  x.className = "hm-opt-x";
  x.title = state === "ex" ? "Remove this exclusion" : tips.x;
  x.setAttribute("aria-label", x.title);
  x.textContent = "✕";
  x.onclick = onX;
  el.append(main, x);
  return el;
}

// The chip's avatar, cached so a repaint doesn't re-fetch the profile doc each time. Reset
// whenever the avatar is saved (identitySection does that) or the identity changes.
let idAvatarUid = "";
let idAvatarUrl = "";
function paintIdentityButton() {
  const b = ex.idBtn || (ex.el && ex.el.querySelector(".ex-identity"));
  if (!b) return;
  const id = identity;
  const uid = (id && id.userId) || "";
  const name = id && id.username;
  // No username yet → no chip at all (claimed identities are unchanged).
  if (!name) {
    b.hidden = true;
    if (!uid) { idAvatarUid = ""; idAvatarUrl = ""; }
    return;
  }
  b.hidden = false;
  // The glyph and the name are separate spans so a phone's top bar can drop the name: down there the
  // bar also carries the ☰'s inset, the emblem and the page's title, and there is room for the avatar
  // button beside the title but not for "@you" as well (see `.ex-id-name` in styles.css).
  const draw = (avatar) => {
    const face = avatar
      ? `<img class="ex-id-avatar" src="${esc(avatar)}" alt="">`
      : name
        ? `<img class="ex-id-avatar" src="src/images/portrait-placeholder.webp" alt="">`
        : `<span class="ex-id-ic">👤</span>`;
    b.innerHTML = `${face}<span class="ex-id-name"> ${name ? "@" + esc(name) : "Claim a username"}</span>`;
    b.classList.toggle("pending", !name);
    b.title = name ? "Your profile" : "Your identity & settings";
  };
  if (!uid) { idAvatarUid = ""; idAvatarUrl = ""; draw(""); return; }
  draw(uid === idAvatarUid ? idAvatarUrl : "");
  if (uid !== idAvatarUid) {
    getProfileContent(uid).then((c) => {
      idAvatarUid = uid;
      idAvatarUrl = (c && c.avatar) || "";
      if (identity === id) draw(idAvatarUrl);
    }).catch(() => {});
  }
}

// Like / unlike a catalog world — your OWN listing included (a self-like is a legitimate bookmark, and
// it is what the ⚙ panel's **Liked** filter reads; the server has no guard, so it just works). The
// server dedupes likes per network group, so `counted` can be false even on a fresh like — but the
// returned `likes` is the authoritative total either way, and the local ♥ state is what the button
// toggles. The Explore grid is re-rendered so the heart and the count change the instant you click,
// rather than waiting for the next catalog reload.
async function toggleLike(rec) {
  await ensureLiked();
  const wasLiked = likedSet.has(rec.worldId);
  try {
    const r = await rpc(wasLiked ? "unlikeWorld" : "likeWorld", { worldId: rec.worldId });
    if (r && typeof r.likes === "number") {
      rec.likes = r.likes;
      // Explore may hold a different object for the same world — keep its count in sync so
      // coming back to the grid doesn't show a stale total before the next catalog reload.
      try {
        for (const it of (ex.items || [])) if (it && it.worldId === rec.worldId) it.likes = r.likes;
      } catch (e) {}
    }
    if (wasLiked) likedSet.delete(rec.worldId); else likedSet.add(rec.worldId);
    await saveSettings({ likedWorlds: [...likedSet] });
    if (!wasLiked && r && r.counted === false) {
      A().notify("♥ Liked — but this network already counted a like for this world, so the public total didn't move.", { ms: 5200 });
    }
  } catch (e) {
    A().notify("✖ " + e.message, { ms: 5200 });
  }
  // Repaint every visible heart for this world in place — Explore cards, profile cards and the
  // details popup all render the same `likeCountHtml` control. (The old code only re-rendered the
  // Explore grid, so a heart clicked on a user-profile card never flipped.)
  repaintLikeButtons(rec);
  // With a Liked filter engaged the world we just unliked may no longer belong in the grid at all, so
  // re-run the query; otherwise a repaint is enough.
  if (ex.el) { if (ex.liked || ex.likedNot) refreshExplore(); else renderExploreGrid(); }
}

// Bring every rendered like button for `rec.worldId` up to date without rebuilding any grid —
// the profile page reuses Explore's card but owns no `ex.el`, so only an in-place update reaches it.
// Rebuilding `innerHTML` is safe here: the click handler lives on the `<button>` itself.
function repaintLikeButtons(rec) {
  const liked = likedSet.has(rec.worldId);
  const tip = liked ? "You liked this — click to remove it" : "Like this world";
  const html = `<span class="ex-heart">${liked ? ICON_HEART : ICON_HEART_OUTLINE}</span> ${num(rec.likes)}`;
  let sel = null;
  try { sel = document.querySelectorAll(`.ex-like[data-wid="${CSS.escape(String(rec.worldId))}"]`); }
  catch (e) { sel = null; }
  if (!sel || !sel.length) {
    // Fallback for very old markup without data-wid (or no CSS.escape): refresh the Explore grid
    // when it's mounted; profile cards from the current code always carry data-wid.
    return;
  }
  sel.forEach((btn) => {
    btn.classList.toggle("on", liked);
    btn.title = tip;
    btn.innerHTML = html;
  });
}

// The like counter as a CONTROL — shared by the Explore card's footer and the details popup's facts row
// so the two read identically. Outlined ♡ when you haven't liked the world, filled accent ♥ when you
// have — including on your own listing, where the heart is still a real toggle (it is what puts the
// world into the ⚙ panel's Liked filter). The heart glyph rides in its own span so it can be drawn
// larger than the number beside it (`.ex-heart`) without growing the row it sits on.
// `pip` draws it as a standalone rounded capsule (the details popup's facts row) instead of the card
// footer's inline `·`-separated pair — the two contexts want the same control, different furniture.
function likeCountHtml(rec, pip = false) {
  const liked = likedSet.has(rec.worldId);
  const tip = liked ? "You liked this — click to remove it" : "Like this world";
  return `<button class="ex-cnt ex-like${pip ? " ex-pip" : ""}${liked ? " on" : ""}" data-wid="${esc(rec.worldId)}" type="button" title="${tip}"><span class="ex-heart">${liked ? ICON_HEART : ICON_HEART_OUTLINE}</span> ${num(rec.likes)}</button>`;
}

// The popularity ledger every world detail panel wears: the like control, the download count
// and the copy-link capsule, in that order. One builder so panels can't drift apart — the Explore panel
// renders its catalog record through this, and the Worlds panel (whose counts arrive separately
// from the catalog) renders its fetched record through the same call. `share` is the catalog
// worldId to link to ("" = no copy button); `shareCls` is the caller's wiring hook — Explore's
// `ex-act-share`, the Worlds panel's `wd-share` — since each panel wires its own buttons.
export function factsRowHtml(rec, { share = "", shareCls = "ex-act-share" } = {}) {
  const wid = String((rec && rec.worldId) || "");
  const like = likeCountHtml({ worldId: wid, likes: Number(rec && rec.likes) || 0 }, true);
  const dl = `<span class="ex-cnt ex-pip" title="Downloads"><span class="ex-dl">${ICON_DOWNLOAD}</span> ${num(rec && rec.downloads)}</span>`;
  const sh = (wid && share)
    ? `<button class="ex-cnt ex-pip ex-pipbtn ${shareCls}" type="button" title="Copy a link to this world">🔗 Copy link</button>`
    : "";
  return `<div class="ex-facts">${like}${dl}${sh}</div>`;
}

// Report a catalog world — the whole flow: already-reported guard, confirmation, the RPC and the
// toast. Shared by the Explore panel and the Worlds panel's added-world view so the wording and the
// quorum explanation live in exactly one place. Returns "reported" when a report landed (or was
// already on record), "cancelled" when backed out of, and throws when the report itself failed.
export async function reportWorldFlow({ worldId, title } = {}) {
  const wid = String(worldId || "");
  if (!wid) throw new Error("That world can't be reported.");
  await ensureReported();
  if (reportedSet.has(wid)) { A().notify("You already reported this world."); return "reported"; }
  const ok = await A().ConfirmPopup.open({ title: "Report world", message: `Report "${title}"? Reports from enough different players hide it from Explore, and it stays down until its author appeals. No reason is needed or stored.`, confirmText: "Report" });
  if (!ok) return "cancelled";
  const r = await rpc("reportWorld", { worldId: wid });
  await markReportedLocally(wid);
  A().notify(r.alreadyHidden ? "⚑ That world is already hidden — it stays down until its author appeals." : r.hidden ? "⚑ Reported — that's the quorum, so it's now hidden until its author appeals." : r.alreadyReported ? "You already reported this world." : "⚑ Reported. Thanks.");
  return "reported";
}

// Mute an author (the reader-side blocklist): persisted in settings and mirrored onto Explore's live
// filter state. Returns { already } — each caller owns its feedback: Explore closes onto its grid
// (where the world vanishes), while the Worlds panel stays open and says so in place.
export async function muteAuthor({ userId, authorName } = {}) {
  const uid = String(userId || "");
  if (!uid) throw new Error("That author can't be muted.");
  const s = await getSettings();
  const muted = (s.mutedUsers || []).slice();
  const names = Object.assign({}, s.mutedNames || {});
  const already = muted.indexOf(uid) !== -1;
  if (!already) muted.push(uid);
  // Keep the display name alongside the id (we're looking straight at it here), so the Settings
  // page's Muted authors list can say `@someone` instead of a hex id.
  if (authorName) names[uid] = authorName;
  await saveSettings({ mutedUsers: muted, mutedNames: names });
  try {
    ex.mutedUsers = (await getSettings()).mutedUsers || [];
    if (ex.bar) ex.bar.refresh();
  } catch (e) {}
  return { already };
}

/* ---------------------------------------------------------------------------
 * admin world controls (only for a signed-in admin)
 * ------------------------------------------------------------------------- */

// What an admin can do to one catalog world, in the words the rest of the app already uses: `Unpublish`
// wears the ⛔ the author's own ⋮ entry wears, and the unpublish/revive pair stays honest — an admin
// unpublish writes the same tombstone the author's does, so the author can publish the world again.
// `Hide` is the sticky one: it is a moderation outcome, no appeal touches it, and an update can't lift
// it. The rating toggle (Mark/Unmark NSFW) is sticky in the same way — a moderation mark on the world's
// `nsfw` field, not the author's own rating — and flips to whichever action undoes the state the card is
// in. Only the list of applicable actions lives here; the server's `moderate` RPC is the guard.
export function adminWorldActs(rec) {
  const isModOnly = !adminAuthed && modAuthed;
  const acts = [];
  if (!isModOnly) {
    if (rec.status === "hidden") acts.push(["unhide", "♻", "Unhide", "put it back into Explore"]);
    else acts.push(["hide", "🚫", "Hide", "take it out of Explore — only an admin can undo this"]);
  }
  // The rating, as a moderation control: marking a world adult drops it out of every reader's Explore
  // unless they have ⊘ Show NSFW on, and the mark is locked so the author's next update can't lift it.
  // Whichever way it reads now is the way the toggle undoes it.
  if (rec.nsfw) acts.push(["sfw", "🔞", "Unmark NSFW", "clear its adult rating and let it back into the default Explore view"]);
  else acts.push(["nsfw", "🔞", "Mark NSFW", "rate it adult — hidden from Explore unless a reader shows NSFW, and the author can't undo it"]);
  if (!isModOnly) acts.push(["unpublish", "⛔", "Unpublish", "remove it from the catalog — its author can publish it again"]);
  return acts;
}

// Run one, behind a confirmation that names the action. Every path that acts on a record has to survive
// a connection that lost its authorization (the flag lives on the socket): the server answers
// `unauthorized`, so drop the flag — which takes the 🔑 controls off every card — and say so.
// Returns "cancelled" (nothing asked for, so a caller holding a panel should leave it up), "failed" or
// "done".
async function runAdminWorldAct(rec, action) {
  const act = adminWorldActs(rec).find((a) => a[0] === action);
  if (!act) return "failed";
  const ok = await A().ConfirmPopup.open({
    title: "Admin: " + act[2].toLowerCase(),
    // ConfirmPopup renders plain text (it escapes its message), so no markup here.
    message: `${act[2]} "${rec.title || rec.worldId}"? This will ${act[3]}.`,
    confirmText: act[2], danger: action !== "unhide"
  });
  if (!ok) return "cancelled";
  try {
    await rpc("moderate", { worldId: rec.worldId, action });
    A().notify("🔑 " + act[2] + " applied.");
    // Re-read the catalog: a hidden or unpublished world has to LEAVE the grid, and a mere repaint
    // would keep drawing it out of the page we already have. A no-op while Explore isn't mounted.
    refreshExplore();
    return "done";
  } catch (e) {
    if (e.code === "unauthorized") {
      adminAuthed = false;
      modAuthed = false;
      A().notify("🔑 Your session ended — sign in again.", { ms: 4400 });
      // The 🔑 controls exist only while the flag is set, so every card has to be redrawn.
      emit("admin");
    } else {
      A().notify("✖ " + e.message, { ms: 5200 });
    }
    return "failed";
  }
}

// The card's corner control (🔑), plus the menu it drops — the same markup and behaviour as a Worlds
// card's ⋮ (`addedCard`), so an admin action reads the same wherever it is offered. Returns "" for
// anyone who isn't signed in: `adminAuthed`/`modAuthed` mirror the server's per-connection flags,
// so an ordinary reader's card never grows a moderation control, and the server refuses `moderate` regardless.
function adminCardHtml(rec) {
  if (!adminAuthed && !modAuthed) return "";
  return `<button class="ex-amore" type="button" title="Admin actions">🔑</button>
    <div class="ex-amenu" hidden>${adminWorldActs(rec).map((a) =>
      `<button type="button" data-adm="${a[0]}"${a[0] === "unpublish" ? ' class="warn"' : ""}><span class="ld-wicon">${a[1]}</span><span class="ld-wtx">${a[2]}</span></button>`
    ).join("")}</div>`;
}

// Wire the control `adminCardHtml` rendered. Kept out of the markup so the card's own click (which
// opens the world) and the menu's buttons can't both fire: every handle stops the event.
function mountAdminCard(rec, card) {
 const more = card.querySelector(".ex-amore");
 if (!more) return;
 const menu = card.querySelector(".ex-amenu");
  const closeMenu = () => { menu.hidden = true; try { menu.classList.remove("up"); } catch (e) {} };
 more.addEventListener("click", (e) => {
   e.stopPropagation();
   document.querySelectorAll(".ex-amenu").forEach((m) => { if (m !== menu) m.hidden = true; });
   menu.hidden = !menu.hidden;
   if (!menu.hidden) {
      // Same flip rule as the ⋮ menus (shared helper: flips only when it clips less).
      try { if (A().placeWorldMenu) A().placeWorldMenu(menu); } catch (e) {}
   }
 });
  menu.addEventListener("click", (e) => e.stopPropagation());
  menu.querySelectorAll("[data-adm]").forEach((b) => {
    b.addEventListener("click", async (e) => { e.stopPropagation(); closeMenu(); await runAdminWorldAct(rec, b.dataset.adm); });
  });
}

export function exCard(rec) {
  const card = el("div", "ex-card");
  const cover = rec.coverUrl
    ? `<img class="ex-cover-img" src="${esc(rec.coverUrl)}" alt="" loading="lazy">`
    : `<div class="ex-cover-ph">${esc(String(rec.title || "?").charAt(0).toUpperCase())}</div>`;
  // Specials first (rating, fork provenance), then the listing's tags — the fit pass clips the row
  // to a `…` chip if the card is too narrow for them all.
  const tags = tagChipHtml(rec.tags, rec.nsfw, !!rec.forkOfWorldId, remixTipFrom(rec));
  // The popularity counters ride on the card's FOOTER, below the tags — the meta line above is the
  // author's alone. The freshness stamp deliberately does NOT appear here: it lives in the details
  // popup (`.ex-facts`), so the card's one narrow row stays short enough to read.
  // Popularity, always shown — even at zero — so a card with no engagement yet says so (0 likes · 0 downloads)
  // instead of leaving the footer blank. The heart is the LIKE CONTROL: clicking it likes/unlikes
  // without opening the world, so it carries the state (filled ♥ + accent when liked), your own
  // listing included. The count comes straight from the catalog record; `toggleLike` refreshes it in
  // place so it moves the moment you act, not on the next Explore reload. The download mark is the
  // SAME wide-headed arrow the Add to Library button wears (ICON_DOWNLOAD), in its own span so the wide
  // glyph can be sized independently of the number beside it (`.ex-dl`).
  const cnts = [
    likeCountHtml(rec),
    `<span class="ex-cnt" title="Downloads"><span class="ex-dl">${ICON_DOWNLOAD}</span> ${num(rec.downloads)}</span>`
  ];
  // The card's bottom line is about YOUR relationship to the listing, never about the world (the fork
  // provenance and the catalog version live in the details popup only): the counters (or, when there
  // is something to say, the one warning that takes their place) on the left, then the in-library icon
  // on the right — filled in below from the local library (a ✎ pencil on your own worlds, a ✓ on
  // downloaded ones). Always emitted, so every card of a grid row lines its description and tag row
  // up with its neighbours.
  const note = `<div class="ld-wnote">${
    rec.status === "hidden"
      ? `<span class="ld-wnote-tx ld-wnote-warn" title="Hidden after reports — its author can appeal.">⚑ hidden after reports</span>`
      : `<span class="ld-wnote-tx ex-cnts">${cnts.join("")}</span>`
  }<span class="ex-lib"></span></div>`;
  // The meta line is the author's line and nothing else — popularity moved to the footer, freshness
  // lives in the details popup — so a long `@name` has the whole row to itself.
  const bits = [`<button class="ex-author ex-author-link" data-uid="${esc(authorUid(rec.userId, rec.authorName))}" title="Open this author's profile">@${esc(rec.authorName || "unknown")}</button>`];
  card.innerHTML = `
    <div class="ex-cover">
      ${cover}${isMnoAuthor(rec.userId, rec.authorName) ? mnoBadgeCover : ""}${adminCardHtml(rec)}
    </div>
    <div class="ex-body">
      <div class="ex-name" title="${esc(rec.title || "(untitled)")}">${esc(rec.title || "(untitled)")}</div>
      <div class="ld-meta">${bits.join("")}</div>
      <div class="ex-desc">${inlineMd(rec.description || "")}</div>
      <div class="ld-wtags ex-tags">${tags}</div>
      ${note}
    </div>`;
  card.onclick = () => openWorldDetail(rec);
  const authorBtn = card.querySelector(".ex-author-link");
  if (authorBtn) authorBtn.onclick = (e) => { e.stopPropagation(); const uid = authorUid(rec.userId, rec.authorName); if (uid && A().goUser) A().goUser(uid, rec.authorName); };
  mountAdminCard(rec, card);
  const likeBtn = card.querySelector(".ex-like");
  if (likeBtn) likeBtn.onclick = (e) => { e.stopPropagation(); toggleLike(rec); };
  return card;
}

function renderExploreGrid(skeleton = false) {
  if (!ex.el) return;
  const grid = ex.el.querySelector(".ex-grid");
  if (skeleton) {
    grid.innerHTML = Array.from({ length: 6 }, () => `<div class="ex-card ex-skel"><div class="ex-cover"></div><div class="ex-body"><div class="ex-skel-line"></div><div class="ex-skel-line short"></div></div></div>`).join("");
    ex.el.querySelector(".ex-count").textContent = "Loading…";
    return;
  }
  const blockedCnt = ex.serverTotal;
  const filtered = ex.items.length !== ex.serverIds.size;
  grid.innerHTML = "";
  if (!ex.items.length && !ex.loading) {
    // The same "nothing here" block the Worlds page ends on (emptyStateEl): the 📖 Explore emblem over
    // one plain line, directly on the page — not a box, because an empty shelf is an ordinary state.
    const blocked = (ex.blockedTags || []).length + (ex.mutedUsers || []).length;
    const text = ex.error ? "Couldn't load worlds."
      : (ex.q || ex.tags.length || ex.tagsNot.length || ex.authorId || ex.liked || ex.likedNot || ex.added || ex.addedNot || ex.mine || ex.mineNot || blocked)
        ? "No worlds match those filters."
        : "No worlds published yet.";
    grid.appendChild(A().emptyStateEl(EXPLORE_MARK, text));
  }
  for (const rec of ex.items) grid.appendChild(exCard(rec));
  scheduleTagFit(); // clip each card's tag row to its `…` chip now that the grid has its columns
  const count = ex.el.querySelector(".ex-count");
  count.textContent = ex.items.length
    ? `Showing ${ex.items.length} of ${blockedCnt}${filtered ? " (filtered)" : ""}`
    : "";
  // Library badges are drawn from local data (no per-card network). A world of your own counts as
  // "already added" too — playing it uses the copy in your own library — so it gets the same ✓ with
  // its own tooltip (Explore never downloads your own listing).
  paintLibraryBadges(grid, ex.items);
}

// The in-library ✓ + outline on cards (Explore's grid and profile pages alike): `recs[i]` must be
// the record for `grid`'s i-th `.ex-card` child. Cards without a record (e.g. bundled worlds
// appended on a profile) are simply left alone.
export function paintLibraryBadges(grid, recs) {
  if (!grid) return;
  getLibrary().then((lib) => {
    if (!grid.isConnected) return;
    for (const card of grid.querySelectorAll(".ex-card")) card.classList.remove("ex-inlib");
    (recs || []).forEach((rec, idx) => {
      const own = !!(myUserId() && rec.userId === myUserId());
      const inLib = !!lib[rec.worldId] || own;
      if (!inLib) return;
      const node = grid.children[idx];
      if (!node || !node.classList || !node.classList.contains("ex-card")) return;
      node.classList.add("ex-inlib");
      // The footer's right end: a rounded icon (the explanation rides in its tooltip) — a ✎ pencil
      // on your own worlds, a ✓ on downloaded ones.
      const slot = node.querySelector(".ex-lib");
      if (slot && !slot.firstChild) {
        slot.innerHTML = own
          ? '<span class="ex-lib-ic" title="Your own world — it plays your local copy">✎</span>'
          : '<span class="ex-lib-ic" title="A downloaded copy of this world is in your library">✓</span>';
      }
    });
  });
}

// The ⚙ Filters panel's body: a **Yours** row (the reader-local **♥ Liked** and **✓ Added**
// chips, plus **✎ My World**) over the **TAGS** cloud. The tags are catalog filters — they go to the server, so they
// mean the same thing for everyone — while Liked and Added are the two reader-local narrowings
// that still belong to a *search* (the catalog knows only like counts and listings, never who
// hearted what or whose library holds what), so their ids are sent as allow/deny lists and the
// panel's "Clear all" resets them like any other filter. The reader's own blocklists (blocked tags, muted authors)
// are different in kind and live on the Settings panel's **Content settings** section (§6.16): they never
// leave this device, they apply to every page rather than to the search you're in the middle of, so
// "Clear all" resetting them would be wrong. NSFW is in NEITHER: it isn't a filter on the list but the
// switch that decides what EXISTS, so it rides the bar. There is no panel state to keep in sync — the
// chips read `ex.tags`/`ex.tagsNot` and `ex.liked`/`ex.likedNot`/`ex.added`/`ex.addedNot`/`ex.mine`/`ex.mineNot`, and the counts come from the last
// `listFacets` reply — and the panel body is rebuilt each time it opens (search-bar.js), so `ctn` is
// always fresh.
function exploreFilterCount() {
  return ex.tags.length + ex.tagsNot.length + (ex.authorId ? 1 : 0) + (ex.liked ? 1 : 0) + (ex.likedNot ? 1 : 0) + (ex.added ? 1 : 0) + (ex.addedNot ? 1 : 0) + (ex.mine ? 1 : 0) + (ex.mineNot ? 1 : 0);
}

function renderExploreFilters(ctn) {
  ctn.innerHTML = `
    <div class="hm-psec">
      <div class="hm-psech">Yours</div>
      <div class="hm-popts" data-slot="yours"></div>
    </div>
    <div class="hm-psec">
      <div class="hm-psech">Tags</div>
      <div class="hm-popts" data-slot="tags"></div>
    </div>`;

  // The reader-local filter: **Liked**, drawn with the SAME three-valued chip as the tags so the panel
  // reads as one control (click the value to require it, click its ✕ to exclude it — hide what you've
  // liked). It carries no count: a tag chip's number is what the CATALOG says is out there, and the
  // catalog never knows who liked what — these ids are this device's own, and they only leave it while
  // this filter is engaged.
  const likedState = ex.liked ? "on" : ex.likedNot ? "ex" : "";
  const yours = ctn.querySelector('[data-slot="yours"]');
  yours.appendChild(optionEl(
    "♥ Liked", 0, likedState,
    () => { ex.liked = !ex.liked; ex.likedNot = false; afterTagChange(); },
    () => { ex.likedNot = !ex.likedNot; ex.liked = false; afterTagChange(); },
    { main: "Only the worlds you've liked", x: "Hide the worlds you've liked" }));

  // The reader-local filter: **Added**, the same three-valued chip as Liked (click the value to
  // require it — only worlds in your library — click its ✕ to exclude them). It carries no count
  // for the same reason Liked doesn't: the catalog never knows whose library holds what.
  const addedState = ex.added ? "on" : ex.addedNot ? "ex" : "";
  yours.appendChild(optionEl(
    "✓ Added", 0, addedState,
    () => { ex.added = !ex.added; ex.addedNot = false; afterTagChange(); },
    () => { ex.addedNot = !ex.addedNot; ex.added = false; afterTagChange(); },
    { main: "Only worlds in your library", x: "Hide worlds in your library" }));

  // The reader-local filter: **My worlds**, the same three-valued chip as Liked/Added (click the
  // value to require it — only your published worlds — click its ✕ to exclude them). The require
  // side clears the `by @name` author filter, which it replaces; the exclude side leaves it alone.
  const mineState = ex.mine ? "on" : ex.mineNot ? "ex" : "";
  yours.appendChild(optionEl(
    "✎ My World", 0, mineState,
    () => { ex.mine = !ex.mine; if (ex.mine) { ex.mineNot = false; ex.authorId = null; ex.authorName = ""; } afterTagChange(); },
    () => { ex.mineNot = !ex.mineNot; ex.mine = false; afterTagChange(); },
    { main: "Only worlds you've published", x: "Hide worlds you've published" }));

  // The tag chips: the same three-valued control Worlds' panel draws (click the value to REQUIRE it,
  // click its ✕ to EXCLUDE it). The vocabulary is the catalog's facets — the server computes them with
  // the tag dimension ignored, so a count is "what is out there carrying this tag", which never drops
  // to 0 just because the tag is picked and holds steady while you type. An ACTIVE entry is always
  // listed, even at 0: requiring a tag hides every world without it and excluding one hides its own
  // worlds, which would otherwise take away the very chip you'd use to undo it.
  const slot = ctn.querySelector('[data-slot="tags"]');
  const list = new Map();
  for (const f of ex.facets || []) list.set(String(f.tag).toLowerCase(), { tag: String(f.tag), count: f.count });
  for (const t of [...ex.tags, ...ex.tagsNot]) {
    const k = String(t).toLowerCase();
    if (!list.has(k)) list.set(k, { tag: k, count: 0 });
  }
  const rank = (t) => { const i = SPECIAL_TAGS.indexOf(String(t).toLowerCase()); return i < 0 ? SPECIAL_TAGS.length : i; };
  const top = [...list.values()]
    .sort((a, b) => rank(a.tag) - rank(b.tag) || b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, 24);
  if (!top.length) {
    const none = document.createElement("span");
    none.className = "hm-pnone";
    none.textContent = "No tags to filter.";
    slot.appendChild(none);
  }
  for (const { tag, count } of top) {
    const key = String(tag).toLowerCase();
    const state = ex.tags.some((t) => String(t).toLowerCase() === key) ? "on"
      : ex.tagsNot.some((t) => String(t).toLowerCase() === key) ? "ex" : "";
    const tips = { main: `Only worlds tagged “${tag}”`, x: `Exclude worlds tagged “${tag}”` };
    slot.appendChild(optionEl(tag, count, state, () => toggleTag(tag), () => toggleTagNot(tag), tips,
      key === NSFW_TAG ? " hm-popt-nsfw" : key === REMIX_TAG ? " hm-popt-special" : ""));
  }
}

// Clear all (the panel's footer link): every catalog filter back to its default — the tags and the
// author filter — silently, in place. It deliberately does NOT touch the reader's blocklists any more:
// those aren't filters you switched on for this search, they're standing preferences, and they now live
// on the Settings panel (§6.16) where a filter panel's "Clear all" can't reach them.
function clearExploreFilters() {
  ex.tags = [];
  ex.tagsNot = [];
  ex.liked = false;
  ex.likedNot = false;
  ex.added = false;
  ex.addedNot = false;
  ex.mine = false;
  ex.mineNot = false;
  ex.authorId = null;
  ex.authorName = "";
  refreshExplore(true);
}

/* ---------------------------------------------------------------------------
 * world detail popup
 * ------------------------------------------------------------------------- */

// The details panel currently on screen (its close function), so opening another one takes it down
// instead of stacking — see `openWorldDetail`.
let openDetailClose = null;
let openDetailId = ""; // the worldId the open panel shows — a repeat open of it is a no-op
// True only while a NEW panel is taking an open one down (or Explore is unmounting): the outgoing panel
// then gives its history entry UP without popping it — see `close` and `pushBackClose({reuse})`.
let takingOverDetail = false;

// May a Back dismiss the details panel right now? Only when the URL no longer names a world. That
// guards the `closeOnPop` contract below: a stray popstate from a fragment write leaves the URL naming a
// world (so the panel survives it), while a real Back lands on the bare `#explore` (so it closes).
function mayCloseDetailOnPop() {
  return !/^#explore\/.+/.test(location.hash || "");
}

export async function openWorldDetail(rec, { reuseEntry = false, openComments = false } = {}) {
  // A deep link and the shell's own route can both fire for a single navigation, so re-opening the world
  // already on screen is a no-op rather than a swap of its entry for itself.
  if (openDetailClose && openDetailId && rec.worldId && openDetailId === rec.worldId) return;
  // One details panel at a time. A click on a card can't stack them (the overlay covers the grid),
  // but a URL deep link can arrive while one is already open — a hash change between two `#explore/`
  // targets, or Back/Forward onto another link — so a fresh panel takes the old one down first.
  const swapping = !!openDetailClose;
  if (swapping) { takingOverDetail = true; try { openDetailClose(); } catch (e) {} takingOverDetail = false; }
  const overlay = el("div", "cc-overlay");
  document.body.appendChild(overlay);
  let closed = false;
  let release = () => {};
  let landingObs = null;
  // The URL this panel owns — used by `close` to tell "still showing our world" from "the bar has
  // already moved on".
  const myHash = rec.worldId ? "#explore/" + encodeURIComponent(rec.worldId) : "";
  // The overlay's close. Registered with pushBackClose (so the device Back button closes the panel
  // too) and called by every path — ✕, backdrop, Escape, Back. Registering `close` itself (rather
  // than a bare `overlay.remove`) keeps the `closed` flag honest when the Back button closes it.
  // It also drops the world id the panel put in the URL (see below) — done BEFORE the entry pops, so
  // the address bar and the screen can't disagree, and Back can't land on a world id that would
  // re-fire the deep-link route and reopen the panel.
  const close = () => {
    if (closed) return true;
    closed = true;
    try { if (unmountComments) unmountComments(); } catch (e) {}
    unmountComments = null;
    try { if (cmtUnsub) cmtUnsub(); } catch (e2) {}
    cmtUnsub = null;
    if (landingObs) { landingObs.disconnect(); landingObs = null; }
    if (openDetailClose === close) openDetailClose = null;
    if (openDetailId === (rec.worldId || "")) openDetailId = "";
    // Give the history entry up without popping when a replacement is taking over (it rewrites the URL).
    if (takingOverDetail) { release.forget(); }
    else {
      // Otherwise fix the address bar for the entry that is about to pop: rewrite to the bare `#explore`
      // when it still shows OUR world, and merely re-issue the hash when it has already moved on to
      // another route (a close triggered by navigating away must not clobber the incoming hash, and a
      // Back needs the re-issue to reach the host page's bar at all — see `mirrorCurrentHash`).
      if (location.hash === myHash) A().syncExploreHash("");
      else A().mirrorCurrentHash();
      release();
    }
    overlay.remove();
    return true;
  };
  openDetailClose = close;
  openDetailId = rec.worldId || "";
  // Leaving the landing takes this panel with it. Starting or continuing an adventure (`enterSession`)
  // swaps the landing for the chat, and that path does NOT run `beforeStart`/`close` on the way in —
  // deliberately, because it re-reads the world first and closing earlier would leave the page
  // undimmed for that read. So watch the landing itself and close when it goes, exactly as the Worlds
  // panel does (`openWorldPanel` in main.js). Without this the panel sat on top of the chat after a
  // **▶ Continue**.
  const landingEl = document.getElementById("landing");
  if (landingEl) {
    landingObs = new MutationObserver(() => { if (landingEl.hidden) close(); });
    landingObs.observe(landingEl, { attributes: true, attributeFilter: ["hidden"] });
  }
  // The open panel's URL is the world's share link (§6.14): `#explore/<worldId>`, so the browser's own
  // Copy-address/share works and a reload reopens the world. The id is set on the history entry
  // pushBackClose pushes, NOT on the Explore entry beneath it — a deep link arrives with the id already
  // on the CURRENT entry, so normalise that one back to a bare `#explore` first, push, and only then
  // name the world. That order is what makes closing safe: the pop lands on a clean `#explore` instead
  // of the world id again. A panel replacing another reuses its entry (`reuse`) rather than stacking a
  // second, so a run of deep links leaves one entry behind, not one per world. A caller from
  // another panel kind (the Worlds page's `wd-remix-world` link) hands its own entry over the
  // same way via `reuseEntry`: it forgets its entry first, and this panel rewrites that slot
  // instead of pushing on top of it — so Back closes this panel onto the page, never onto a
  // dead entry.
  A().syncExploreHash("");
  release = pushBackClose(close, { reuse: swapping || reuseEntry, closeOnPop: mayCloseDetailOnPop });
  if (rec.worldId) A().syncExploreHash(rec.worldId);
  // Whether the reader has the cover fullscreen — the panel's own memory of it, since `paint()`
  // rebuilds the panel's HTML and would otherwise drop them back to the compact view on a like.
  const fsState = { full: false };
  // Per-world comments state — same reason: paint() rebuilds the HTML on every
  // like/add/refresh, so the tab + count + unmount live outside it.
  // `mine` is fixed for the panel (it only depends on the record), so it lives
  // here too — the count prefetch needs it before paint.
  const mine = !!(myUserId() && rec.userId === myUserId());
  let commentsCount = -1;
  // Tab state replaces the old open/close: 'desc' | 'notes' | 'comments'. The
  // thread mounts on first selection of the comments tab and stays mounted
  // while the panel is up. Selecting a tab never scrolls — panes swap in
  // place and the reader stays where they are.
  let wdTab = openComments && !isCommentsOffMeta(rec) ? "comments" : (rec.description ? "desc" : (String(rec.notesId || "").trim() ? "notes" : "comments"));
  let wdTabSettled = false;
  let unmountComments = null;
  let cmtUnsub = null;
  let discMod = null;
  // Panel-level painters (the prefetch below calls them before first paint, and
  // paint() re-calls them after every rebuild — all guards survive a missing DOM).
  // Live count for the Comments tab: subscribing prefetches the thread backend
  // (no mounted thread needed), so it fills in on its own. Unsubscribed on
  // close (see `close`).
  function paintCmtCount(n) {
    commentsCount = n;
    try {
      const tn = overlay.querySelector("[data-wd-tabcount]");
      if (tn) tn.textContent = (typeof n === "number" && n >= 0) ? ` (${n})` : "";
    } catch (e2) {}
  }
  // Comment-count prefetch: subscribing warms the thread backend (no mounted
  // thread needed), so the Comments tab count fills in on its own.
  // Unsubscribed on close (see `close`).
  import("./discussion.js").then((m) => {
    discMod = m;
    if (closed || isCommentsOffMeta(rec)) return;
    try {
      cmtUnsub = m.subscribeWorldCount(rec.worldId, (n) => { commentsCount = n; paintCmtCount(n); }, { mine });
    } catch (e) {}
  }).catch(() => {});
  // A tag chip in the panel jumps into Explore's own tag filter (applyTagFilter). Delegated on the
  // OVERLAY, not the row: paint() rewrites the panel's HTML, and the one-line fit pass rewrites each
  // row's — per-chip listeners wouldn't survive either. From a session the landing comes first
  // (keep bridge, Back returns to the chat); on the landing this is just close + filter.
  overlay.addEventListener("click", async (e) => {
    const b = e.target.closest(".wd-tags [data-tag]");
    if (!b) return;
    close();
    if (A().inSession && A().inSession()) await A().exitToHomePage("explore");
    applyTagFilter(b.dataset.tag);
  });
  // @mentions in the description / author's notes open that user's profile — the same
  // destination as the author line. A name-only hop: the profile page tries the username
  // itself and shows its "No user named @…" state when nothing claims it.
  overlay.addEventListener("click", (e) => {
    const b = e.target.closest("[data-mention]");
    if (!b) return;
    const name = String(b.dataset.mention || "").replace(/^@+/, "").trim();
    if (!name) return;
    takingOverDetail = true;
    try { close(); } finally { takingOverDetail = false; }
    if (A().goUser) A().goUser("", name);
  });

  async function paint() {
    const lib = (await getLibrary())[rec.worldId] || null;
    const cache = (await getCache(rec.worldId)) || null;
    // Can this world be played right now — is there a copy of it on this device? Your own listing
    // plays the copy in your own library (the same world the Worlds page opens in the editor); a
    // public world plays the copy you downloaded when you added it. When there is one, the panel
    // ends with the same Play/Continue + adventures block the Worlds panel ends with, bound to the
    // same id its adventures are saved under (`lib:<worldId>` for a downloaded copy) — so a world
    // offers the same thing wherever you open it.
    const localId = mine
      ? await metaIdFor(rec.worldId)
      : (lib && cache ? "lib:" + rec.worldId : "");
    const playable = localId ? (mine ? (await A().worldStore().list()).some((e) => e.id === localId) : true) : false;
    const cover = rec.coverUrl
      ? `<img class="wd-hdr-bg" src="${esc(rec.coverUrl)}" alt="">`
      : `<div class="wd-hdr-bg wd-hdr-ph">${esc(String(rec.title || "?").charAt(0).toUpperCase())}</div>`;
    const tags = tagChipHtml(rec.tags, rec.nsfw, !!rec.forkOfWorldId, remixTipFrom(rec), true);
    const forkUid = authorUid(rec.forkOfUserId, rec.forkOfAuthor);
    const acts = [];
    if (mine) {
      // Explore is a reader's shelf: your own world plays your local copy and nothing else —
      // publishing, editing and unpublishing live on the Worlds page's ⋮ menu. While that
      // copy is still installed the Play/Continue block at the foot of the panel is the control; if
      // it's gone (e.g. after a creator-code restore onto a fresh device), offer to restore it.
      if (!playable) acts.push(`<button class="btn big ex-act-restore">${ICON_DOWNLOAD} Restore to my worlds</button>`);
    } else {
      if (!lib) acts.push(`<button class="btn big ex-act-add">${ICON_DOWNLOAD} Add to Library</button>`);
      else if (!cache) acts.push(`<button class="btn big ex-act-retry">${ICON_DOWNLOAD} Retry download</button>`);
      // (a world whose copy is downloaded plays from the block at the foot of the panel, not here)
      if (lib && lib.stale) acts.push(`<button class="btn big ex-act-refresh">⟳ Update to v${rec.version}</button>`);
      acts.push(`<button class="btn ex-act-report">⚑ Report</button>`);
      if (rec.authorName) acts.push(`<button class="btn ex-act-mute">⦸ Mute @${esc(rec.authorName)}</button>`);
      if (rec.authorId) acts.push(`<button class="btn ex-act-author">👤 More by this author</button>`);
    }
    // Share. Any live world has a stable catalog id, so a link to it always resolves — including one
    // the reader's own filters would hide, and one hidden after reports (the panel says so). Offered
    // on your own listing too: a link to your world is exactly what you'd paste to a friend. It is not
    // an action button: it rides in the popularity ledger as a third capsule beside the two counters
    // (see `factsRowHtml` — this panel renders its record through the same builder the Worlds panel uses).
    const shareTarget = rec.worldId && rec.status !== "removed" ? rec.worldId : "";
    // Author's notes live in their own tab (fetched once, then cached in notes.js).
    const hasNotes = !!String(rec.notesId || "").trim();
    // Author's comments toggle (server record; pre-toggle records read as enabled).
    const commentsOff = isCommentsOffMeta(rec);
    // @mentions render as profile buttons (rich-text.js); the async upgrade after
    // the tabs wiring resolves spaced names against the catalog once the panel is up.
    const descHtml = rec.description ? richTextWithMentions(rec.description) : "";
    const hasOverview = !!(descHtml || tags);
    // Tabs: Overview (desc and/or tags, if either), Author's notes (if any),
    // Comments (unless the author turned them off). One pane → no bar, just the pane.
    const wdTabDefs = [
      hasOverview ? { id: "desc", label: "Overview", icon: ICON_OVERVIEW } : null,
      hasNotes ? { id: "notes", label: "Author's notes", icon: ICON_NOTE_DOC } : null,
      !commentsOff ? { id: "comments", label: "Comments", count: true, icon: ICON_COMMENT } : null,
    ].filter(Boolean);
    // First paint only: land on a tab that actually exists (a tags-only
    // listing has an Overview pane but no description to key the tab off).
    if (!wdTabSettled) {
      wdTabSettled = true;
      if (!wdTabDefs.some((t) => t.id === wdTab)) wdTab = wdTabDefs[0].id;
    }
    const hasWdTabs = wdTabDefs.length > 1;
    const wdTabsHtml = `
      ${hasWdTabs ? `<div class="wd-tabs" role="tablist" data-wd-tabs>${wdTabDefs.map((t) => `<button class="wd-tab" role="tab" data-wtab="${t.id}" aria-selected="${wdTab === t.id ? "true" : "false"}" type="button">${t.icon || ""}${esc(t.label)}${t.count ? `<span class="wd-tab-n" data-wd-tabcount>${commentsCount >= 0 ? ` (${commentsCount})` : ""}</span>` : ""}</button>`).join("")}</div>` : ""}
      ${hasOverview ? `<div class="wd-tabpane wd-desc" role="tabpanel" data-pane="desc"${wdTab !== "desc" ? " hidden" : ""}><span data-desc-tx>${descHtml}</span>${tags ? `<div class="ld-wtags wd-tags">${tags}</div>` : ""}</div>` : ""}
      ${hasNotes ? `<div class="wd-tabpane wd-desc" role="tabpanel" data-pane="notes"${wdTab !== "notes" ? " hidden" : ""}><span class="wd-notes-loading">Loading author&rsquo;s notes…</span></div>` : ""}
      ${!commentsOff ? `<div class="wd-tabpane" role="tabpanel" data-pane="comments"${wdTab !== "comments" ? " hidden" : ""}>
        <div class="wd-comments-wrap" data-comments-wrap></div>
      </div>` : ""}`;
    // Admin controls, last and under their own label so they can never be mistaken for something a
    // reader can do — the same actions the mod log applies, for the world actually in front of you.
    // Only for a signed-in admin, and never on your own listing (that one has its own publishing
    // controls on the Worlds page).
    if (adminAuthed && !mine) {
      acts.push(`<div class="ex-adm-head">Admin</div>`);
      for (const a of adminWorldActs(rec)) {
        acts.push(`<button class="btn ex-act-adm${a[0] === "unpublish" ? " warn" : ""}" data-adm="${a[0]}" title="Admin: ${esc(a[3])}">${a[1]} ${a[2]}</button>`);
      }
    }
    overlay.innerHTML = `
      <div class="cc-panel wd-panel ex-detail" tabindex="-1">
        <button class="popup-x wd-cancel" title="Close">✕</button>
        <div class="wd-hdr">
          ${cover}
          <div class="wd-hdr-scrim"><div class="wd-headrow"><span class="wd-name">${esc(rec.title || "(untitled)")}</span></div></div>
          ${isMnoAuthor(rec.userId, rec.authorName) ? mnoBadgeHead : ""}
        </div>
        <div class="cc-body wd-body">
          <div class="wd-side">
            ${rec.status === "hidden" ? `<div class="ex-warn">⚑ Hidden after reports — out of Explore until its author appeals. Still reachable by direct link.</div>` : ""}
            <div class="wd-author">by <button class="ex-act-profile2" title="Open this author's profile">@${esc(rec.authorName || "unknown")}</button>${rec.userId ? ` <button class="ex-link ex-act-author2">more</button>` : ""}</div>
            ${rec.forkOfTitle ? `<div class="ex-remix">⧉ remix of ${rec.forkOfWorldId ? `<button class="ex-remix-world" data-world="${esc(rec.forkOfWorldId)}" title="Open original world">${esc(rec.forkOfTitle)}</button>` : `<b>${esc(rec.forkOfTitle)}</b>`} by ${(forkUid || rec.forkOfAuthor) ? `<button class="ex-remix-profile" data-uid="${esc(forkUid)}" data-name="${esc(rec.forkOfAuthor || "")}" title="Open this author's profile">@${esc(rec.forkOfAuthor || "?")}</button>` : `<b>@${esc(rec.forkOfAuthor || "?")}</b>`}</div>` : ""}
            ${factsRowHtml(rec, { share: shareTarget })}
            <div class="wd-meta-row"><div class="ex-pip ex-meta"><span>v${esc(String(rec.version))}</span><span>${esc(fmtBytes(rec.jsonBytes))}</span><span>updated ${esc(fmtRel(rec.updatedAt))}</span></div></div>
            ${wdTabsHtml}
            ${mine ? `<div class="ex-own-note">This is your world. Playing it here plays your local copy — manage it (publish, update, unpublish) from the Worlds page.</div>` : ""}
            ${playable ? `<div class="wd-dyn"></div>` : ""}
            ${acts.length ? `<div class="ex-actions">${acts.join("")}</div>` : ""}
          </div>
        </div>
      </div>`;
    // Tabs: `wdTab` lives outside paint() so a like/repaint keeps the pane;
    // paint() tears the DOM down first, so it unmounts before rebuild.
    try {
      if (unmountComments) { try { unmountComments(); } catch (e) {} unmountComments = null; }
    } catch (e2) {}
    const cmtWrap = overlay.querySelector("[data-comments-wrap]");
    paintCmtCount(commentsCount);
    const mountCmt = async () => {
      if (unmountComments || !cmtWrap) return;
      try {
        const m = await import("./discussion.js");
        if (!discMod) discMod = m;
        if (!cmtWrap.isConnected) return;
        // Chatters only: a claimed MNO username or a saved Tavern nickname (the
        // same gate as the Tavern welcome). Anyone else gets the note + a way
        // into the Tavern instead of the thread — no backend mounts for them.
        let nick = "";
        try { nick = await m.ensureCommentIdentity(); } catch (e) { nick = ""; }
        if (!cmtWrap.isConnected) return;
        if (!nick) {
          cmtWrap.innerHTML = `<div class="wd-gate"><div class="wd-gate-t">Join the discussion</div><div class="wd-gate-d">Comments need a name. Set a nickname in the Tavern — it takes a few seconds.</div><button type="button" class="mini ok" data-wd-gate-tavern>Open Tavern</button></div>`;
          const gateBtn = cmtWrap.querySelector("[data-wd-gate-tavern]");
          if (gateBtn) gateBtn.onclick = () => { m.openDiscussionPanel().catch(() => {}); };
          return;
        }
        unmountComments = m.mountWorldComments(cmtWrap, rec.worldId, {
          title: rec.title, mine,
          // Count only: selecting a tab never scrolls.
          onCount: (n) => {
            commentsCount = n; paintCmtCount(n);
          },
        });
      } catch (e) {
        try {
          cmtWrap.innerHTML = `<div class="disc-status is-err">Couldn't load comments. Check your connection and reopen this panel.</div>`;
        } catch (e2) {}
      }
    };
    const selectWdTab = (id) => {
      if (id !== "desc" && id !== "notes" && id !== "comments") return;
      wdTab = id;
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
      } catch (e5) {}
      // Mount on first selection; panes swap in place, no scrolling.
      if (id === "comments") {
        mountCmt().catch(() => {});
      }
    };
    overlay.querySelectorAll("[data-wtab]").forEach((b) => { b.onclick = () => selectWdTab(b.dataset.wtab); });
    // Deep link (or a repaint while the comments tab is up): remount into the
    // rebuilt DOM. No scrolling — the reader stays where they are.
    if (wdTab === "comments") mountCmt().catch(() => {});
    overlay.querySelector(".wd-cancel").onclick = close;
    // The cover's fullscreen toggle: the same control as the Worlds page's panel (main.js owns the
    // button and its wiring). `fsState` is ours so the reader's choice survives this panel's repaints.
    A().mountCoverFullscreen(overlay, fsState);
    // Author's notes pane: fills once (fetch cached in notes.js), then stays.
    const notesPane = overlay.querySelector('[data-pane="notes"]');
    if (hasNotes && notesPane) {
      let notesHtml = null;
      const loadNotes = async () => {
        if (notesHtml != null) return notesHtml;
        try { notesHtml = await enrichMentionsHtml(await fetchNotesText(rec.notesId)); }
        catch (e) { notesHtml = `<span class="wd-notes-fail">Couldn&rsquo;t load the author&rsquo;s notes — check your connection and reopen this panel.</span>`; }
        return notesHtml;
      };
      loadNotes().then((h) => { if (!closed && notesPane.isConnected) notesPane.innerHTML = h; });
    }
    // Spaced-username upgrade for the description's @mentions (see enrichMentionsHtml): the text
    // span already shows the sync single-token rendering, and this swaps in the resolved one. Only
    // the span is touched — the tags sharing the pane stay put. Guarded against a repaint (like)
    // that replaced the pane, and a close.
    const descTx = overlay.querySelector('[data-pane="desc"] [data-desc-tx]');
    if (rec.description && descTx) {
      const box = descTx;
      enrichMentionsHtml(rec.description).then((h) => {
        if (!closed && box.isConnected && h !== box.innerHTML) box.innerHTML = h;
      }).catch(() => {});
    }
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
    overlay.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } });
    overlay.querySelector(".cc-panel").focus();

    const on = async (sel, fn) => { const b = overlay.querySelector(sel); if (b) b.onclick = async () => { try { await fn(b); } catch (e) { A().notify("✖ " + e.message, { ms: 5200 }); } }; };
    await on(".ex-facts .ex-like", async () => { await toggleLike(rec); await paint(); });
    await on(".ex-act-add", async (b) => {
      b.disabled = true; b.textContent = "Downloading…";
      await addToLibrary(rec, { onState: (st) => { if (st === "failed") b.textContent = "Retry download"; } });
      await paint();
    });
    await on(".ex-act-retry", async (b) => { b.disabled = true; b.textContent = "Downloading…"; await retryLibrary(rec.worldId); await paint(); });
    await on(".ex-act-restore", async (b) => {
      b.disabled = true; b.textContent = "Restoring…";
      try {
        await reclaimSingleWorld(rec.worldId, { rec });
        A().notify("Restored \"" + (rec.title || rec.worldId) + "\" to your world library.");
      } catch (e) { A().notify("✖ Couldn't restore your world: " + (e.message || e), { ms: 6200 }); }
      await paint();
    });
    await on(".ex-act-playown", async () => { await playOwnWorldFromExplore(rec.worldId); });
    await on(".ex-act-refresh", async () => { await refreshLibraryWorld(rec.worldId); await paint(); });
    await on(".ex-act-report", async () => { await reportWorldFlow({ worldId: rec.worldId, title: rec.title }); await paint(); });
    await on(".ex-act-mute", async () => {
      await muteAuthor({ userId: rec.userId, authorName: rec.authorName });
      close();
      refreshExplore();
    });
    await on(".ex-act-share", () => { copyWorldLink(rec.worldId); });
    const byAuthor = async () => { ex.authorId = rec.userId; ex.authorName = rec.authorName; ex.mine = false; if (rec.userId && rec.userId === myUserId()) ex.mineNot = false; ex.q = ""; close(); if (A().inSession && A().inSession()) await A().exitToHomePage("explore"); refreshExplore(); };
    // A profile PAGE takes over from the panel (like a replacing panel, or Explore unmounting): the
    // outgoing panel gives its history entry up WITHOUT popping it. A plain close() would schedule a
    // history.back() whose delayed traversal lands after the profile has mounted and yanks the shell
    // back to `#explore` — the page flashes for a frame or two, then bounces.
    const toProfile = (uid, name) => {
      uid = authorUid(uid || rec.userId, name || rec.authorName);
      takingOverDetail = true;
      try { close(); } finally { takingOverDetail = false; }
      if (uid && A().goUser) A().goUser(uid, name || rec.authorName);
    };
    await on(".ex-act-author", byAuthor);
    await on(".ex-act-author2", byAuthor);
    await on(".ex-act-profile2", () => toProfile(rec.userId, rec.authorName));
    // Remix original: never fall back to THIS world's author when the stored forkOfUserId is
    // missing — the name hint goes straight to goUser, whose profile page tries the id first
    // and the username second.
    await on(".ex-remix-profile", (b) => {
      const uid = authorUid(b.dataset.uid || rec.forkOfUserId, b.dataset.name || rec.forkOfAuthor);
      const name = b.dataset.name || rec.forkOfAuthor;
      takingOverDetail = true;
      try { close(); } finally { takingOverDetail = false; }
      if ((uid || name) && A().goUser) A().goUser(uid, name);
    });
    // Remix original world: swap this panel for the original's own panel (which reuses the same
    // history entry). A missing/dead original just says so via openLinkedWorld's own notice.
    await on(".ex-remix-world", (b) => {
      const wid = b.dataset.world || rec.forkOfWorldId;
      if (wid) return openLinkedWorld(wid);
    });
    // Admin controls. The panel comes down once the action has actually run: hiding or unpublishing the
    // world we're looking at takes it out of Explore (and `runAdminWorldAct` repaints the grid off the
    // flag), so leaving the panel up would show a world that may no longer be there. Backing out of the
    // confirmation leaves the panel exactly as it was.
    overlay.querySelectorAll("[data-adm]").forEach((b) => {
      b.onclick = async () => { if (await runAdminWorldAct(rec, b.dataset.adm) !== "cancelled") close(); };
    });
    // The foot of the panel: the same Play/Continue + adventures block the Worlds panel ends with,
    // for any world whose copy is on this device (see `playable` above). Both readers below receive
    // the panel's own close hook and pass it down to the call that builds the next screen, so the
    // panel can't sit on top of the adventure it began and the dim never lifts in between (see
    // main.js's `mountWorldSessions`). Play/✦ New adventure open the hero-creation wizard
    // (.cc-overlay, z 60) — UNDER the Tavern (.popup-overlay, z 90) when this panel was raised
    // from a Tavern card — so the launch hook brings the Tavern down with the panel. A panel
    // raised from Explore has no Tavern standing, and the call is a no-op there.
    const dyn = overlay.querySelector(".wd-dyn");
    if (dyn) await A().mountWorldSessions(dyn, localId, {
      beforeStart: () => { try { close(); } finally { try { A().closeDiscussionPanel(); } catch (e) {} } },
      startNew: mine
        ? (beforeOpen) => playOwnWorldFromExplore(rec.worldId, beforeOpen)
        : (beforeOpen) => playLibraryWorld(rec.worldId, beforeOpen)
    });
  }
  await paint();
}

// The shareable link to a published world: the generator's PUBLIC top-level URL plus the Explore deep
// link (`#explore/<worldId>`, main.js's routing) that reopens this very panel on load. Built from
// `window.generatorName` at runtime — a fork or a rename keeps working, and a bare `location.href`
// would point at the iframe's subdomain, which can't be navigated to directly.
// The public user profile page (`#user/<username>`) reads through these: the catalog owns the
// username + the world's list, so one place answers "who is this + what did they publish". An old
// `#user/<userId>` link still resolves — the page falls back to the id when the name lookup misses.
export async function getProfileUser(userId) {
  return (await rpc("getUser", { userId: String(userId || "") })).user;
}
export async function getUserByName(username) {
  return (await rpc("getUserByName", { username: String(username || "") })).user;
}
// Batched uid -> publicUser (username + avatar + bio, same shape as getUser).
// Server caps at 64 ids per call; unknown ids come back as {userId, username:""} placeholders.
export async function getUsersByIds(userIds) {
  const ids = (Array.isArray(userIds) ? userIds : []).map((s) => String(s || "")).filter(Boolean).slice(0, 64);
  if (!ids.length) return [];
  return (await rpc("getUsers", { userIds: ids })).users || [];
}

// ---------------------------------------------------------------------------
// @mentions in world text — resolve + render (see rich-text.js for the passes)
// ---------------------------------------------------------------------------
// The detail panels paint descriptions synchronously with `richTextWithMentions` (single-token
// `@name` links, no network), then upgrade in place with this: each greedy candidate shrinks
// word by word until the catalog confirms a prefix, so a spaced username links in full while
// the sentence around it stays plain. Results are cached per session (lowercased, whitespace
// collapsed — the same normalization the server looks up by), so reopening a panel with the
// same mentions costs nothing. Never throws: offline or unknown, the caller keeps the sync HTML.
const mentionResolveCache = new Map(); // normalized name -> canonical username | null
async function lookupMentionUser(name) {
  const key = String(name || "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!key) return null;
  if (mentionResolveCache.has(key)) return mentionResolveCache.get(key);
  let hit = null;
  try {
    const u = await getUserByName(key);
    hit = (u && u.username) || null;
  } catch (e) { hit = null; }
  mentionResolveCache.set(key, hit);
  return hit;
}
export async function enrichMentionsHtml(source) {
  try {
    const text = String(source == null ? "" : source);
    if (text.indexOf("@") === -1) return richTextWithMentions(text);
    const cands = mentionCandidates(text);
    if (!cands.length) return richTextWithMentions(text);
    const spans = [];
    for (const c of cands) {
      // Longest prefix first: when both "Aria" and "Aria the Grey" exist, the mention means
      // the longer one. Single-word hits resolve too, for the catalog's canonical casing
      // ("@winter" renders "@Winter", like the author line does).
      const words = c.text.split(/\s+/);
      for (let n = words.length; n >= 1; n--) {
        const t = words.slice(0, n).join(" ");
        if (t.length < 3) break;
        const hit = await lookupMentionUser(t);
        if (hit) { spans.push({ start: c.index, end: c.index + 1 + t.length, name: hit }); break; }
      }
    }
    if (!spans.length) return richTextWithMentions(text);
    return renderWithResolvedMentions(text, spans);
  } catch (e) {
    return richTextWithMentions(source);
  }
}

// The public profile content (picture + bio) behind a user page, and its editor backing store.
// Server-owned: bio + avatar URL live in the catalog's profile slots (index.html), auth'd by the
// same derived userToken worlds use — so a creator-code recovery keeps edit access (there is no
// editKey to lose). The server is the source of truth; there is no local fallback. Avatar is
// URL-only: uploads go to the upload host as webp, and only the URL is stored.
export const PROFILE_BIO_MAX = 200; // BYTES, not chars (server enforces; the editor counts UTF-8 bytes live)
export const SOCIAL_FIELDS = ["reddit", "discord"];
export const SOCIAL_LABELS = { reddit: "Reddit", discord: "Discord" };
export const SOCIAL_PLACEHOLDERS = {
  reddit: "https://www.reddit.com/user/you/",
  discord: "username or https://discord.gg/your-invite"
};
export const SOCIAL_MAX = 128;
function emptySocials() { return { reddit: "", discord: "" }; }
function pickSocials(v) {
  const src = (v && typeof v === "object") ? v : {};
  const out = emptySocials();
  for (const k of SOCIAL_FIELDS) out[k] = String(src[k] == null ? "" : src[k]).slice(0, SOCIAL_MAX * 4);
  return out;
}
// Light client mirror of the server's per-network host rules, so a typo fails fast with a
// field-specific message instead of a generic server rejection. Discord also takes a bare
// username (stored without a leading @), not just an invite link.
function discordHandleOk(s) {
  const h = String(s == null ? "" : s).trim().replace(/^@/, "");
  return /^[A-Za-z0-9_.]{2,32}(#[0-9]{1,4})?$/.test(h);
}
function socialUrlOk(kind, url) {
  const s = String(url || "").trim();
  if (!s) return true;
  if (kind === "discord" && !/^https:\/\//i.test(s)) return discordHandleOk(s);
  if (!/^https:\/\//i.test(s)) return false;
  const host = s.slice(8).split(/[/?#]/)[0].toLowerCase();
  if (!host || host.indexOf("@") !== -1) return false;
  const apex = (h, base) => h === base || h.slice(-base.length - 1) === "." + base;
  if (kind === "reddit") return apex(host, "reddit.com") || apex(host, "redd.it");
  if (kind === "discord") return apex(host, "discord.com") || apex(host, "discord.gg");
  return false;
}
function avatarUrlOk(url) {
  const s = String(url || "");
  if (!s) return true;
  if (!/^https:\/\//i.test(s)) return false;
  const host = s.slice(8).split(/[/?#]/)[0].toLowerCase();
  return ALLOWED_UPLOAD_HOSTS.indexOf(host) !== -1;
}
// A downscaled image Blob -> uploaded URL. The Blob already went through the canvas
// (fileToWebpBlob / dataUrlToWebpBlob), so it is WebP at the profile cap with metadata
// stripped. Throws with a human message on failure.
async function uploadAvatarBlob(blob) {
  if (!blob || !blob.size) throw new Error("Couldn't read that image.");
  let up = null;
  try { up = await uploadBlob(blob); }
  catch (e) { throw new Error("Couldn't upload the avatar — check your connection and try again."); }
  const url = String((up && up.url) || "");
  if (!url || !avatarUrlOk(url)) throw new Error("Couldn't upload the avatar — check your connection and try again.");
  return url;
}
// Legacy path: a data-URL avatar from pre-Blob storage (or a pasted data URL) -> resized,
// re-encoded WebP Blob at the profile cap -> uploaded URL. Always re-encodes, so old
// JPEG/PNG data URLs lose their metadata on the way up too.
async function uploadAvatarDataUrl(dataUrl) {
  let blob = null;
  try {
    const { dataUrlToWebpBlob } = await import("./image-utils.js");
    blob = await dataUrlToWebpBlob(dataUrl, { maxDim: PROFILE_AVATAR_MAX_DIM, quality: COVER_WEBP_QUALITY });
  } catch (e) { throw new Error("Couldn't read that image."); }
  return uploadAvatarBlob(blob);
}
export async function getProfileContent(userId) {
  userId = String(userId || "");
  if (!userId) return { bio: "", avatar: "", updatedAt: 0, socials: emptySocials() };
  const r = await rpc("getProfile", { userId });
  return {
    bio: utf8ByteTrunc(String((r && r.bio) || ""), PROFILE_BIO_MAX),
    avatar: String((r && r.avatar) || ""),
    updatedAt: Number((r && r.updatedAt) || 0) || 0,
    socials: pickSocials(r && r.socials),
  };
}
export async function saveProfileContent(userId, { bio = "", avatar = "", socials } = {}) {
  userId = String(userId || "");
  bio = utf8ByteTrunc(String(bio), PROFILE_BIO_MAX);
  // New callers pass a Blob (already downscaled + re-encoded); legacy callers pass a data URL.
  if (avatar instanceof Blob) avatar = await uploadAvatarBlob(avatar);
  else { avatar = String(avatar || ""); if (avatar.startsWith("data:")) avatar = await uploadAvatarDataUrl(avatar); }
  if (avatar && !avatarUrlOk(avatar)) throw new Error("That avatar URL isn't allowed.");
  let soc = null;
  if (socials !== undefined) {
    soc = emptySocials();
    for (const k of SOCIAL_FIELDS) {
      const v = String((socials && socials[k]) || "").trim().slice(0, SOCIAL_MAX * 2);
      if (v && !socialUrlOk(k, v)) throw new Error(k === "discord" ? "Enter your Discord username or a full https:// invite link." : "That " + SOCIAL_LABELS[k] + " link isn't valid — paste the full https:// link.");
      soc[k] = v;
    }
  }
  const id = await getIdentity({ create: false });
  if (!id || !id.userId || id.userId !== userId) throw new Error("That identity isn't on this device.");
  const userToken = await userTokenFor(id.userId);
  const payload = soc ? { userId, userToken, bio, avatar, socials: soc } : { userId, userToken, bio, avatar };
  const r = await rpcClaiming("setProfile", payload);
  return { stored: "server", bio: String((r && r.bio) || bio), avatar: String((r && r.avatar) || avatar), updatedAt: Number((r && r.updatedAt) || 0) || Date.now(), socials: pickSocials((r && r.socials) || soc) };
}
// Delete the pre-server viewer cache (profile pages read fresh now). Idempotent.
export async function dropProfileCache() {
  try { await KVC().delete("profileCache"); } catch (e) {}
}
// One-time rescue for pre-server profiles (editable file + device-local copy). Reads the legacy
// sources once and pushes them to the server (uploading a data-URL avatar). After a successful push
// — or when there is nothing to rescue — the legacy kv keys are deleted so no old copy lingers.
// Viewers never call this: profile pages read the server only.
export async function migrateLegacyProfileIfNeeded(userId) {
  userId = String(userId || "");
  if (!userId) return false;
  let server = null;
  try { server = await getProfileContent(userId); }
  catch (e) { return false; }
  const dropLegacyKeys = async () => {
    try { await KVC().delete("localProfiles"); } catch (e) {}
    try { await KVC().delete("profileKeys"); } catch (e) {}
    try { await KVC().delete("profileCache"); } catch (e) {}
  };
  if (server && (server.bio || server.avatar || (server.socials && SOCIAL_FIELDS.some((k) => server.socials[k])))) { await dropLegacyKeys(); return false; }
  let legacy = null;
  try {
    let doc = null;
    try {
      const text = await window.uploadPlugin.editable.get("mno-profile-" + userId.toLowerCase());
      if (text) { const d = JSON.parse(text); if (d && typeof d === "object") doc = d; }
    } catch (e) { doc = null; }
    let local = null;
    try { local = ((await KVC().get("localProfiles")) || {})[userId] || null; } catch (e) { local = null; }
    const bio = utf8ByteTrunc(String((doc && doc.bio) || (local && local.bio) || ""), PROFILE_BIO_MAX);
    const avatar = String((doc && doc.avatar) || (local && local.avatar) || "");
    if (bio || avatar) legacy = { bio, avatar };
  } catch (e) { legacy = null; }
  if (!legacy) { await dropLegacyKeys(); return false; }
  await saveProfileContent(userId, legacy);
  await dropLegacyKeys();
  return true;
}
export async function listAuthorWorlds(userId, { sort = "updated" } = {}) {
  const worlds = [];
  let page = 1, total = 0;
  for (let i = 0; i < 10; i++) {
    const r = await rpc("listWorlds", { userId: String(userId || ""), sort, page, pageSize: 48, showNsfw: true });
    total = r.total || 0;
    const items = r.items || [];
    worlds.push(...items);
    if (worlds.length >= total || !items.length) break;
    page++;
  }
  return { worlds, total };
}

export function worldShareUrl(worldId) {
  return "https://perchance.org/" + window.generatorName + "#explore/" + encodeURIComponent(worldId);
}

// Mini world-card data for Tavern link previews: the catalog record trimmed to what the
// card renders, or null when the world isn't public (never throws — a miss renders as a
// plain note, never a broken card).
export async function fetchWorldCard(worldId) {
  const id = String(worldId || "").trim();
  if (!/^[a-z0-9][a-z0-9-]{2,79}$/i.test(id)) return null;
  try {
    const rec = (await rpc("getWorld", { worldId: id })).world;
    if (!rec || rec.status === "removed") return null;
    return {
      worldId: rec.worldId || id,
      title: String(rec.title || "(untitled)"),
      authorName: String(rec.authorName || "unknown"),
      coverUrl: String(rec.coverUrl || ""),
      description: String(rec.description || "").replace(/\s+/g, " ").trim().slice(0, 220),
      likes: Number(rec.likes) || 0,
      downloads: Number(rec.downloads) || 0,
      nsfw: !!rec.nsfw,
      hidden: rec.status === "hidden",
    };
  } catch (e) { return null; }
}

// Copy that link. On failure the URL is handed over in the toast anyway (clipboard permission is
// commonly refused), so the link is never lost.
// Clipboard for module importers (the profile page's Discord-handle circle): the same path
// as copyToClipboard — platform plugin + Clipboard API, readonly-popup fallback.
export function copyText(text, opts) { copyToClipboard(text, opts); }

export function copyWorldLink(worldId) {
  if (!worldId) return;
  copyToClipboard(worldShareUrl(worldId), { okMsg: "🔗 Link copied — opening it lands on this world.", title: "Copy world link" });
}

// Close the open world-detail panel, if any, without touching the Explore page itself. The nav
// rail's Explore row calls this: clicking it must always land on the plain `#explore` grid, and a
// same-page click otherwise early-returns in `setHomePage` and would leave a leftover panel up.
export function closeWorldDetail() {
  if (!openDetailClose) return false;
  const c = openDetailClose;
  try { c(); } catch (e) {}
  return true;
}
// A notification jump lands here when its world panel is already open: switch that
// panel to its Comments tab instead of reopening it (the opener no-ops on the
// same world). False when no panel, another world, or no Comments tab is up.
export function focusWorldComments(worldId) {
  try {
    if (!openDetailClose || openDetailId !== String(worldId || "")) return false;
    const tab = document.querySelector(".cc-overlay .ex-detail [data-wtab=\"comments\"]");
    if (!tab || tab.getAttribute("aria-selected") === "true") return !!tab;
    tab.click();
    return true;
  } catch (e) { return false; }
}
// Open the details panel for the world named by a URL deep link (main.js's `#explore/<worldId>`). The
// catalog is the authority: `getWorld` answers for a hidden world too (a direct link is the one way to
// a world Explore itself is hiding), and only a world that was never published, or was unpublished,
// has nothing to open. Returns a status so the caller can drop a dead target from the URL while
// keeping one that merely failed to reach the catalog (see main.js's `applyHomeRoute`).
export async function openLinkedWorld(worldId, opts = {}) {
  const id = String(worldId || "").trim();
  if (!/^[a-z0-9][a-z0-9-]{2,79}$/i.test(id)) { A().notify("✖ That isn't a valid world link.", { ms: 5200 }); return "bad_id"; }
  let rec = null;
  try { rec = (await rpc("getWorld", { worldId: id })).world; }
  catch (e) {
    if (e && e.code === "not_found") { A().notify("✖ That world isn't in the community any more.", { ms: 5200 }); return "not_found"; }
    A().notify("✖ Couldn't reach the community — check your connection, then reopen the link.", { ms: 5200 });
    return "offline";
  }
  if (!rec || rec.status === "removed") { A().notify("✖ That world is no longer public.", { ms: 5200 }); return "removed"; }
  await openWorldDetail(rec, opts);
  return "ok";
}

// Map a catalog worldId back to the local world meta.id (via the link records).
async function metaIdFor(worldId) {
  const links = await getLinks();
  for (const [mid, rec] of Object.entries(links)) if (rec && rec.worldId === worldId) return mid;
  return "";
}

// Own listings carry the catalog's own view of them — the `hidden` state after a report quorum, WHY it
// was hidden (reports vs a moderator), and when a pending appeal lifts it. Fold all three onto the
// local link record so the Worlds page can say `· Published` / `· Hidden` / `· Appeal Pending` and
// offer the appeal without ever querying the catalog for it. The write happens only when a
// record's state actually differs, so a normal Explore load stays completely silent.
async function syncOwnLinkStatuses(recs) {
  const me = myUserId();
  if (!me) return;
  const links = await getLinks();
  const byWorldId = {};
  for (const [mid, l] of Object.entries(links)) if (l && l.worldId) byWorldId[l.worldId] = mid;
  let changed = 0;
  for (const r of recs) {
    if (!r || r.userId !== me) continue;
    const mid = byWorldId[r.worldId];
    if (!mid) continue;
    const l = links[mid];
    const hidden = r.status === "hidden";
    const hiddenReason = hidden ? String(r.hiddenReason || "") : "";
    const reinstatesAt = Number(r.reinstatesAt) || 0;
    if (l.hidden === hidden && String(l.hiddenReason || "") === hiddenReason && (Number(l.reinstatesAt) || 0) === reinstatesAt) continue;
    l.hidden = hidden; l.hiddenReason = hiddenReason; l.reinstatesAt = reinstatesAt;
    changed++;
  }
  if (!changed) return;
  await KVC().set("links", links);
  emit("links");
  await A().repaintWorldsPage?.();
}

/* ---------------------------------------------------------------------------
 * own listings the community no longer has
 * ------------------------------------------------------------------------- */

// A world can leave the community without THIS device ever unpublishing it: it was taken down from
// another device (whose own link is tombstoned, while this device's still says `published`).
// That stale local link would keep claiming the world is live — and
// that is the one state with no way out, because the ⋮ menu's labels are decided from local data
// alone: it offers ⛔ Unpublish and no 🌐 Publish, and the publish panel finds nothing changed and
// answers "You have no unpublished changes". Folding the catalog's explicit tombstone back onto
// the link as OUR OWN tombstone puts the world straight back onto the path that works — a fresh
// publish, which reuses the tombstoned worldId, so share links and other people's saved copies
// keep working. An "unknown" answer never folds: it only means this catalog never saw the id
// (the editor's emulator, a wipe), not that the world is gone.
// Two callers only: `openCommunityMenu`, at the moment the player is about to act on one world, and
// the Worlds page, which sweeps them all in one batch per visit (`checkOwnListings`). Never a card.

// Fold "the community no longer has this listing" onto one link record. Returns true when the
// record actually changed. The worldId is deliberately KEPT: it is what a later publish reuses.
async function markLinkRemoved(mid) {
  const links = await getLinks();
  const l = links[mid];
  if (!l || l.status === "removed") return false;
  Object.assign(l, { status: "removed", deletionUrl: null, hidden: false, hiddenReason: "", reinstatesAt: 0, updatedAt: Date.now() });
  await KVC().set("links", links);
  emit("links");
  await A().repaintWorldsPage?.();
  return true;
}

// Ask the catalog about our own listings in one request (its `getWorlds` answers per worldId: the
// real record, a tombstone left by another device's unpublish, or `unknown` for an id it has never
// had). Every listing we still believe is live but the catalog answers `removed` for is folded to
// `removed` — see above. Unreachable catalog = nothing changes: an offline device must never tombstone a live
// world. The raw per-listing answer is handed back too (`status`, keyed by meta id), because the
// publish panel has to know which allowance a re-publish would spend: a tombstone is revived with an
// update, a world the catalog has forgotten is published afresh.
// `keep` leaves the socket open for a caller that is about to make another call itself (the panel
// asks for this batch and the quota together).
export async function checkOwnListings({ keep = false } = {}) {
  // `myUserId()` only answers once THIS page load has read the identity (see `mountExplore`, which
  // reads it for exactly this reason), and the Worlds page never does — so read it here, or the sweep
  // would silently do nothing on the one page it exists for. No identity means no links of ours either
  // (every link came from a publish, and a publish mints one), so `create: false` is right: never mint
  // an identity just to look at listings.
  const id = await getIdentity({ create: false });
  if (!id || !id.userId) return { checked: 0, gone: [], status: {} };
  const links = await getLinks();
  const mids = Object.keys(links).filter((mid) => links[mid] && links[mid].worldId);
  if (!mids.length) return { checked: 0, gone: [], status: {} };
  let items = [];
  try {
    for (let i = 0; i < mids.length; i += 64) {
      const r = await rpc("getWorlds", { worldIds: mids.slice(i, i + 64).map((mid) => links[mid].worldId) });
      items.push(...(r.items || []));
    }
  } catch (e) {
    return { checked: 0, gone: [], status: {}, offline: true };
  }
  const status = {};
  for (const mid of mids) status[mid] = "unknown";
  for (const r of items) {
    const mid = mids.find((m) => links[m].worldId === r.worldId);
    if (mid) status[mid] = r.status || "unknown";
  }
  const gone = [];
  for (const mid of mids) {
    if (links[mid].status === "removed") continue;
    // Only an explicit tombstone folds back. "unknown" is inconclusive — the editor's ephemeral
    // emulator starts empty on every load, and a wiped catalog answers the same way — and
    // tombstoning on it stranded live worlds (card lost `· Published`, menu fell back to plain
    // Publish). A record the catalog truly forgot still heals on next publish (publishFlow's
    // not_found → publish-fresh fallback).
    if (status[mid] !== "removed") continue;
    if (await markLinkRemoved(mid)) gone.push(mid);
  }
  if (!keep) closeSocketIfIdle();
  return { checked: items.length, gone, status };
}

// The connection's daily allowance, as the catalog counts it — read before a publish panel is
// drawn so the player can see where they stand before they click. `null` when the catalog can't be
// reached: the panel then simply leaves the line out rather than guessing at a number.
async function readQuota({ keep = false } = {}) {
  try {
    const q = await rpc("getQuota", {});
    const one = (x) => ({ used: Math.max(0, Number(x && x.used) || 0), limit: Math.max(0, Number(x && x.limit) || 0) });
    const quota = { publish: one(q.publish), update: one(q.update), enforced: q.enforced !== false, resetsAt: Number(q.resetsAt) || 0 };
    if (!keep) closeSocketIfIdle();
    return quota;
  } catch (e) {
    if (!keep) closeSocketIfIdle();
    return null;
  }
}

// The socket is opened on demand by every one of these small reads and closed again when nobody else
// wants it — never while Explore is open, which keeps its own.
function closeSocketIfIdle() { if (!ex.open) disconnect(); }

// Is the allowance this action would spend actually used up? Only ever true when the server is
// ENFORCING the limit — a full allowance that refuses nothing must never make the panel hide a button,
// which is exactly what `RL_ENFORCED = false` (a deliberate testing pass) would report (see the flag in
// the server plugin at the bottom of index.html).
function quotaFull(quota, kind) {
  const q = quota && quota[kind];
  return !!(quota && quota.enforced && q && q.limit > 0 && q.used >= q.limit);
}

// What the panel says when the allowance is spent: the action button is gone, so this sentence is the
// only way the player can find out why.
function quotaBlockedHtml(quota, kind) {
  if (!quotaFull(quota, kind)) return "";
  const limit = quota[kind].limit;
  return `<br><br>⚠️ You've used today's ${limit} ${kind === "publish" ? "publishes" : "updates"}, so this can't go up until the allowance resets.`;
}

// The quota line that closes every publish panel: the allowance the panel's OWN action would spend,
// so the number always means what the button above it does — publishing a new world spends the
// publish allowance, updating one (or putting an unpublished world back) spends the update one.
function quotaLineHtml(quota, kind) {
  if (!quota || !quota[kind]) return "";
  const { used, limit } = quota[kind];
  const full = quotaFull(quota, kind);
  const name = kind === "publish" ? "Publish quota" : "Update quota";
  const what = kind === "publish" ? "publishing new worlds" : "updating worlds you've published";
  const tip = full
    ? `You've used today's ${limit}. It resets 24 hours after your first one of the day.`
    : `Your daily allowance for ${what}. It resets 24 hours after your first one of the day.`;
  return `<span class="cc-quota${full ? " cc-quota-warn" : ""}" title="${esc(tip)}">${esc(name)} ${used}/${limit} · resets daily</span>`;
}

/* ---------------------------------------------------------------------------
 * programmatic content update (the menu's own push auto-detects)
 * ------------------------------------------------------------------------- */

// Force a full content re-upload of a local world (skips the change detection). The menu
// never needs it (its own publish already auto-detects), so this is the programmatic/explicit path.
export async function updateContentFromExplore(metaId) {
  const fileForm = await worldStore.getRaw(metaId);
  if (!fileForm) { A().notify("✖ That world isn't in your local library."); return; }
  await publishFlow(fileForm, { mode: "content" });
  refreshExplore();
  await A().repaintWorldsPage?.();
}

/* ---------------------------------------------------------------------------
 * the Settings panel's Admin section — moderation log + actions (§6.16)
 * ------------------------------------------------------------------------- */

// The moderation log is OWNER-ONLY. It lives in the Settings panel's **Admin** section, behind the
// admin password, not in a public popup in the Explore header — the log is not meant to be readable by
// everyone. The server enforces it too: `getModLog` answers `unauthorized` to a connection that hasn't
// authenticated (index.html), so this is not just a hidden button.
//
// The password is only ever handed to the server, which hashes it (a pure-JS SHA-256 inside the server
// script) and compares against the hash embedded there — the PUBLIC script holds no plaintext, and
// neither does this file. Authorization is per CONNECTION (the server tracks `conn.id`), which is why a
// connection that drops ends the session: this module keeps `adminAuthed` in step with it (see
// `onSocketClose`), and an `unauthorized` reply means "ask again" rather than a dead end.
//
// The session deliberately OUTLIVES the Settings panel. It used to end when the panel closed, which
// made the Admin tools unusable — you couldn't sign in and then go look at the world you wanted to act
// on. Signing out is now the Sign out button's job (or a reload), and the only other way it ends is a
// dropped connection, since the server's flag lives on the socket: while signed in, `disconnect()`
// refuses to release it.
let adminAuthed = false; // is the current connection signed in? (mirrors the server's flag)
let modAuthed = false; // mod session (ban + nsfw/sfw + overview only)
let adminLoadFn = null;  // the live Admin section's own load(), so ⟳ and the sign-in path can repaint it

// Reload persistence for the admin session. The server authorizes per CONNECTION, so a reload
// always starts signed out — nothing server-side could survive it. What survives is the PASSWORD,
// kept in sessionStorage (per-tab, gone when the tab closes): a reload in the same tab silently
// re-authenticates, a fresh tab asks again. Plaintext in page JS storage is the trade-off — the
// alternative is typing it every reload. Explicit sign-out forgets it.
const ADMIN_PW_KEY = "mno.adminPw";
function rememberAdminPw(pw) { try { sessionStorage.setItem(ADMIN_PW_KEY, pw); } catch (e) {} }
function forgetAdminPw() { try { sessionStorage.removeItem(ADMIN_PW_KEY); } catch (e) {} }
function storedAdminPw() { try { return sessionStorage.getItem(ADMIN_PW_KEY) || ""; } catch (e) { return ""; } }
const MOD_PW_KEY = "mno.modPw";
function rememberModPw(pw) { try { sessionStorage.setItem(MOD_PW_KEY, pw); } catch (e) {} }
function forgetModPw() { try { sessionStorage.removeItem(MOD_PW_KEY); } catch (e) {} }
function storedModPw() { try { return sessionStorage.getItem(MOD_PW_KEY) || ""; } catch (e) { return ""; } }

// Resolve true when the Admin section may be shown, asking for the password if we don't have it.
// Called on EVERY entry into the section (the rail button, `openSettingsPanel("admin")`, or coming
// back to it), which is also what refreshes the log — it's the kind of thing you want current when
// you look at it. Returns false when the prompt is dismissed or the password is wrong, and the panel
// then stays on the section it was already showing.
export async function adminEnsure() {
  if (!adminAuthed && !modAuthed) {
    const pw = await A().TextPopup.open({
      title: "Admin / mod password", placeholder: "Password…", password: true, rows: 1, confirmText: "Sign in"
    });
    if (pw === null || pw === undefined || pw === "") return false;
    try {
      await rpc("authenticateAdmin", pw);
      adminAuthed = true;
      rememberAdminPw(pw);
      try { ensureKeepalive(); } catch (e) {}
      emit("admin");
      A().notify("🔑 Signed in to admin.");
    } catch (e1) {
      if (e1 && e1.code === "rate_limited") { A().notify("⏳ Too many attempts — try again in a while.", { ms: 4400 }); return false; }
      try {
        await rpc("authenticateMod", pw);
      } catch (e2) {
        A().notify(e2 && e2.code === "rate_limited" ? "⏳ Too many attempts — try again in a while." : "🔒 Wrong password.", { ms: 4400 });
        return false;
      }
      modAuthed = true;
      rememberModPw(pw);
      try { ensureKeepalive(); } catch (e) {}
      emit("admin");
      A().notify("🔑 Signed in as mod.");
    }
  }
  if (adminLoadFn) await adminLoadFn();
  return true;
}

// Silent re-authentication after a same-tab reload, using the remembered password. Best-effort:
// no stored password (or an already-live session) means false with no network touched. A wrong
// password means the secret changed — forget it so we never retry a stale one; anything else
// (rate limit, offline) keeps it for the next reload.
export async function resumeAdmin() {
  if (adminAuthed || modAuthed) return true;
  const pw = storedAdminPw();
  if (pw) {
    try {
      await rpc("authenticateAdmin", pw);
      adminAuthed = true;
      try { ensureKeepalive(); } catch (e) {}
      emit("admin");
      A().notify("🔑 Admin session restored.");
      return true;
    } catch (e) {
      if (e && e.code !== "rate_limited") forgetAdminPw();
      else return false;
    }
  }
  const mpw = storedModPw();
  if (!mpw) return false;
  try {
    await rpc("authenticateMod", mpw);
  } catch (e) {
    if (e && e.code !== "rate_limited") forgetModPw();
    return false;
  }
  modAuthed = true;
  try { ensureKeepalive(); } catch (e) {}
  emit("admin");
  A().notify("🔑 Mod session restored.");
  return true;
}

// End the admin/mod session — the Sign out button's job (and the only way out, besides a reload or a
// dropped connection). Drops the server's flag for this connection, so `moderate` really is refused
// from here on, then releases the socket unless Explore is still holding it open.
//
// `adminLoadFn` is deliberately NOT cleared here: the section element is still on screen when the Sign
// out button runs this, and its own **Sign in** button has to be able to repaint it. The next
// `adminSection()` (the next time the panel opens) overwrites it.
export async function adminDispose() {
  forgetAdminPw();
  forgetModPw();
  if (!adminAuthed && !modAuthed) return;
  const wasAdmin = adminAuthed;
  adminAuthed = false;
  modAuthed = false;
  if (socket && socket.readyState === 1) {
    try { if (wasAdmin) await rpc("signOutAdmin", {}); else await rpc("signOutMod", {}); } catch (e) { /* the connection is already gone */ }
  }
  if (!ex.open) disconnect(); // Explore keeps its own socket; nobody else wants this one
  emit("admin");
}

// The Settings panel closed — NOT a sign-out. The panel owns the section elements it built and
// discards them, so the closed panel's repaint hook goes with it; the admin session itself survives
// (that is the whole point of the change above). Called from the panel's teardown in main.js.
export function adminSectionClosed() {
  adminLoadFn = null;
}

// The Admin section: the moderation log, with the buttons that act on a world. Like the panel's other
// sections it returns a finished `<section>` and wires everything to it; unlike them it is only ever
// reached through `adminEnsure()` above, so by the time it is placed we are signed in. The signed-out
// state exists for one real case — the connection dropped and took the authorization with it (see
// `load`) — and offers a sign-in button rather than an empty card.
// The log's action names in the words this card shows (`index.html`'s MODLOG_ACTIONS, which is an
// append-only encoding). Everything else — publishing, updating, claiming a name — is deliberately
// not logged at all, so an unknown action here means a row written by a different version.
const MODLOG_LABELS = {
  report_hidden: "hidden after reports",
  report_reinstated: "reinstated (legacy)",
  appeal_requested: "appeal requested",
  appeal_unhidden: "appeal returned it",
  admin_hide: "hidden by admin",
  admin_unhide: "restored by admin",
  admin_remove: "unpublished by admin",
  admin_unpublish: "unpublished by admin",
  admin_nsfw: "marked NSFW by admin",
  admin_sfw: "NSFW rating cleared by admin",
  admin_delete_user: "identity deleted by admin",
  unpublish: "unpublished by author"
};

export function adminSection() {
  const sec = el("section", "pf-sec pf-admin");
  sec.innerHTML = `
    <h3 class="pf-sec-title">Admin</h3>
    <p class="pf-hint">Moderation for the catalog's owner. The log records the events that matter — worlds hidden after reports, appeals, and admin actions — and the buttons act on one. You stay signed in until you sign out.</p>
    <div class="pf-adm-bar"></div>
    <div class="seg adm-tabs" role="tablist">
      <button class="seg-btn on" type="button" data-tab="overview" role="tab">Overview</button>
      <button class="seg-btn" type="button" data-tab="bans" role="tab">Ban list</button>
      <button class="seg-btn" type="button" data-tab="log" role="tab">Mod log</button>
      <button class="seg-btn" type="button" data-tab="delete" role="tab">Delete identity</button>
    </div>
    <div class="adm-pane" data-pane="overview"><div class="pf-adm-stats"></div></div>
    <div class="adm-pane" data-pane="bans" hidden>
      <h4 class="pf-sec-sub">Bans <span class="pf-none ban-count"></span></h4>
      <p class="pf-hint">Server-state bans (comment transport id + app device id). Takes effect after the other side refreshes.</p>
      <div class="pf-adm-banform">
        <select class="popup-in ban-kind"><option value="1">comment id</option><option value="2">app id</option></select>
        <input class="ban-id" type="text" spellcheck="false" autocomplete="off" placeholder="id (hex)">
        <input class="ban-nick" type="text" spellcheck="false" autocomplete="off" maxlength="40" placeholder="nick (optional)">
        <select class="popup-in ban-dur"><option value="3600000">1 hour</option><option value="86400000">1 day</option><option value="604800000">7 days</option><option value="2592000000">30 days</option><option value="31536000000">1 year</option><option value="0" selected>Permanent</option></select>
        <input class="ban-note" type="text" maxlength="48" placeholder="note (optional)">
        <button class="mini warn ban-go" type="button">Ban</button>
      </div>
      <div class="pf-none ban-msg"></div>
      <div class="ban-list ex-ml-list"></div>
    </div>
    <div class="adm-pane" data-pane="log" hidden><div class="ex-ml-list"></div></div>
    <div class="adm-pane" data-pane="delete" hidden>
    <h4 class="pf-sec-sub">Delete an identity</h4>
    <p class="pf-hint">Erase a registered user permanently, by their id. Their username is <b>released</b> — claimable again immediately, exactly like the name a rename gives up — and every world they published is unpublished. This cannot be undone.</p>
    <div class="pf-adm-del">
      <input class="adm-del-id" type="text" spellcheck="false" autocomplete="off" placeholder="user id (16–64 hex)">
      <button class="mini adm-del-look" type="button">Look up</button>
      <button class="mini warn adm-del-go" type="button" disabled>Delete user…</button>
    </div>
    <div class="pf-none adm-del-info"></div>
    </div>`;
  const bar = sec.querySelector(".pf-adm-bar");
  const statsEl = sec.querySelector(".pf-adm-stats");
  const list = sec.querySelector(".ex-ml-list");
  const delId = sec.querySelector(".adm-del-id");
  const delLook = sec.querySelector(".adm-del-look");
  const delGo = sec.querySelector(".adm-del-go");
  const delInfo = sec.querySelector(".adm-del-info");
  let items = null;
  let stats = null;
  let bans = null;
  let banCap = 1000;
  let loading = false;
  let delUser = null; // { userId, username } — set by a successful Look up, required to delete
  const banPane = sec.querySelector('[data-pane="bans"]');
  const banListEl = sec.querySelector(".ban-list");
  const banMsg = sec.querySelector(".ban-msg");
  const banCount = sec.querySelector(".ban-count");
  const banKindSel = sec.querySelector(".ban-kind");
  const banIdInput = sec.querySelector(".ban-id");
  const banNickInput = sec.querySelector(".ban-nick");
  const banDurSel = sec.querySelector(".ban-dur");
  const banNoteInput = sec.querySelector(".ban-note");
  const banGoBtn = sec.querySelector(".ban-go");

  // Tabs: one pane visible at a time. The bar (session line) stays above them; everything
  // below is per-pane. Wired here so it also works signed-out (the panes just show their
  // signed-out states). Mods see overview + bans only; log + delete are admin-only.
  const panes = [...sec.querySelectorAll(".adm-pane")];
  const tabBtns = [...sec.querySelectorAll(".adm-tabs .seg-btn")];
  const logTabBtn = sec.querySelector('.adm-tabs [data-tab="log"]');
  const delTabBtn = sec.querySelector('.adm-tabs [data-tab="delete"]');
  const showTab = (name) => {
    tabBtns.forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
    panes.forEach((p) => { p.hidden = p.dataset.pane !== name; });
  };
  tabBtns.forEach((b) => { b.onclick = () => showTab(b.dataset.tab); });
  const paintTabs = () => {
    const modOnly = !adminAuthed && modAuthed;
    if (logTabBtn) logTabBtn.hidden = !!modOnly;
    if (delTabBtn) delTabBtn.hidden = !!modOnly;
    const logPane = sec.querySelector('[data-pane="log"]');
    const delPane = sec.querySelector('[data-pane="delete"]');
    if (modOnly) {
      if (logPane && !logPane.hidden) showTab("overview");
      else if (delPane && !delPane.hidden) showTab("overview");
    }
  };
  const paintBans = () => {
    const authed = !!(adminAuthed || modAuthed);
    if (banCount) banCount.textContent = bans ? `(${(bans || []).length} / ${banCap})` : "";
    if (!authed) {
      if (banListEl) banListEl.innerHTML = `<div class="pf-none">Sign in as admin or mod to manage bans.</div>`;
      if (banGoBtn) banGoBtn.disabled = true;
      return;
    }
    if (banGoBtn) banGoBtn.disabled = false;
    if (loading) { if (banListEl) banListEl.innerHTML = `<div class="pf-none"><span class="spin spin-sm"></span> Loading…</div>`; return; }
    if (!bans) { if (banListEl) banListEl.innerHTML = `<div class="pf-none">Couldn't load bans.</div>`; return; }
    if (!bans.length) { if (banListEl) banListEl.innerHTML = `<div class="pf-none">No bans.</div>`; return; }
    if (banListEl) {
      banListEl.innerHTML = bans.map((b, i) => {
        const kind = b.kind === 2 ? "app" : "comment";
        const exp = !b.expiresAt ? "Permanent" : new Date(b.expiresAt).toLocaleString();
        const when = (() => { try { return b.bannedAt ? new Date(b.bannedAt).toLocaleString() : ""; } catch (e) { return ""; } })();
        const by = (b.byKind === 2 ? "mod" : "admin") + (b.by ? " " + b.by : "");
        const nick = (b.nick || "").trim();
        const meta = [by, b.note ? b.note : ""].filter(Boolean).join(" · ");
        return `<div class="ex-ml-row is-ban" data-bi="${i}">`
          + `<span class="ex-ml-when">${esc(when)}</span>`
          + `<span class="ex-ml-act">${kind} · ${esc(exp)}</span>`
          + `<span class="ex-ml-world" title="${esc(b.id)}">${nick ? `${esc(nick)} ` : ""}<code>${esc(b.id)}</code>${meta ? `<span class="ex-ml-sub">${esc(meta)}</span>` : ""}</span>`
          + `<span class="ex-ml-tools"><button class="mini" data-hist type="button">History</button><button class="mini" data-unban type="button">Unban</button></span></div>`;
      }).join("");
      banListEl.querySelectorAll("[data-hist]").forEach((btn) => {
        btn.onclick = async () => {
          const row = btn.closest("[data-bi]");
          const b = bans[Number(row.dataset.bi)];
          if (!b) return;
          try {
            const dm = await import("./discussion.js");
            if (dm && dm.openUserHistory) dm.openUserHistory(btn, {
              nick: (b.nick || "").trim(),
              appUid: b.kind === 2 ? b.id : "",
              commentsId: b.kind === 1 ? b.id : "",
            });
          } catch (e) {}
        };
      });
      banListEl.querySelectorAll("[data-unban]").forEach((btn) => {
        btn.onclick = async () => {
          const row = btn.closest("[data-bi]");
          const b = bans[Number(row.dataset.bi)];
          if (!b) return;
          btn.disabled = true;
          try {
            await rpc("banRemove", { kind: b.kind, id: b.id });
            A().notify("🔑 Unbanned " + b.id + ". Takes effect after they refresh.");
            await load();
          } catch (e) {
            A().notify("✖ " + (e.message || e.code || "failed"), { ms: 4600 });
            btn.disabled = false;
          }
        };
      });
    }
  };
  if (banGoBtn) banGoBtn.onclick = async () => {
    const kind = Number(banKindSel.value);
    const id = (banIdInput.value || "").trim().toLowerCase();
    if (!id || !/^[0-9a-f-]{4,80}$/.test(id)) { if (banMsg) { banMsg.className = "ban-msg"; banMsg.textContent = "Enter a hex id (comment or app)."; } return; }
    const dur = Number(banDurSel.value);
    banGoBtn.disabled = true;
    try {
      let me = "";
      try { const ident = await getIdentity({ create: false }); me = (ident && ident.username) || ""; } catch (e) {}
      await rpc("banSet", { kind, id, permanent: dur === 0, durationMs: dur === 0 ? 0 : dur, note: (banNoteInput.value || "").slice(0, 48), nick: ((banNickInput && banNickInput.value) || "").slice(0, 40), by: (me || "").slice(0, 20) });
      if (banMsg) { banMsg.className = "ban-msg"; banMsg.textContent = ""; }
      banIdInput.value = ""; if (banNickInput) banNickInput.value = ""; banNoteInput.value = "";
      A().notify("🔑 Banned. Takes effect after they refresh.");
      await load();
      try { const sb = await import("./server-bans.js"); await sb.loadServerBans(true); } catch (e) {}
    } catch (e) {
      if (banMsg) { banMsg.className = "ban-msg"; banMsg.textContent = "✖ " + (e.message || e.code || "failed"); }
      else A().notify("✖ " + (e.message || e.code || "failed"), { ms: 4600 });
    } finally { banGoBtn.disabled = false; }
  };

  // Reset the delete row. A changed id invalidates a previous look-up, and the server also requires
  // the username to still match, so a stale look-up can never erase a name that has since changed.
  const resetDel = (msg, cls) => {
    delUser = null;
    delGo.disabled = true;
    delInfo.className = cls || "pf-none adm-del-info";
    delInfo.textContent = msg || "";
  };
  const paintDel = () => { delLook.disabled = !adminAuthed; delGo.disabled = !adminAuthed || !delUser; };
  delId.addEventListener("input", () => resetDel());
  delLook.onclick = async () => {
    const id = delId.value.trim().toLowerCase();
    if (!/^[0-9a-f]{16,64}$/.test(id)) { resetDel("That doesn't look like a user id — 16–64 hex characters."); return; }
    delUser = null; delGo.disabled = true;
    delInfo.className = "pf-none adm-del-info"; delInfo.textContent = "Looking up…";
    delLook.disabled = true;
    try {
      const r = await rpc("getUser", { userId: id });
      const u = r.user || {};
      if (!u.username) { resetDel("That id is registered but carries no username."); return; }
      delUser = { userId: u.userId, username: u.username };
      delInfo.className = "adm-del-info";
      delInfo.textContent = "Registered as: " + u.username;
    } catch (e) {
      resetDel(e.code === "not_found" ? "No identity with that id." : "✖ " + e.message);
    } finally { paintDel(); }
  };
  delGo.onclick = async () => {
    if (!delUser) return;
    const u = delUser;
    const sure = await A().ConfirmPopup.open({
      title: "Admin: delete identity",
      message: `Delete the identity "${u.username}" (${u.userId})? Its username is released and can be claimed again, and every world it published is unpublished.`,
      warning: "This erases the identity on the server permanently — it cannot be undone.",
      confirmText: "Delete identity", danger: true
    });
    if (!sure) return;
    delGo.disabled = true;
    try {
      const r = await rpc("deleteUser", { userId: u.userId, confirmUsername: u.username });
      A().notify("🔑 Deleted \"" + r.username + "\" — " + plural(r.unpublished, "world") + " unpublished.", { ms: 6500 });
      delId.value = "";
      resetDel("Deleted \"" + r.username + "\".");
      await load();
    } catch (e) {
      if (e.code === "confirm_mismatch") { resetDel("That name changed since you looked it up — look it up again."); return; }
      A().notify("✖ " + e.message, { ms: 4600 });
      delGo.disabled = !delUser;
    } finally { paintDel(); }
  };

  const paintBar = () => {
    paintTabs();
    if (!adminAuthed && !modAuthed) {
      bar.innerHTML = `<span class="pf-none">Signed out.</span><button class="mini ok pf-adm-in" type="button">🔑 Sign in</button>`;
      bar.querySelector(".pf-adm-in").onclick = () => { adminEnsure(); };
      paintDel();
      return;
    }
    const role = adminAuthed ? "Admin" : "Mod";
    bar.innerHTML = `<span class="pf-adm-badge">🔑 Signed in (${role})</span>
      <button class="mini pf-adm-refresh" type="button" title="Reload counters and log">⟳ Refresh</button>
      <button class="mini pf-adm-out" type="button" title="End the session">Sign out</button>`;
    bar.querySelector(".pf-adm-refresh").onclick = () => load();
    const out = bar.querySelector(".pf-adm-out");
    out.onclick = async () => {
      out.disabled = true;
      await adminDispose();
      paintBar();
      paintStats();
      paintList();
      paintBans();
      A().notify("🔑 Signed out.");
    };
    paintDel();
  };

  // Overview: the catalog counters, then the storage / profile / activity lines as grouped
  // stat rows (same `.pf-stat` look as the counters above, not plain text), so the whole tab reads
  // as one ledger.
  const statRow = (label, value, title) => `<div class="pf-stat"${title ? ` title="${esc(title)}"` : ""}><span>${label}</span><b>${value}</b></div>`;
  const paintStats = () => {
    if (!adminAuthed && !modAuthed) { statsEl.innerHTML = ""; return; }
    if (loading) { statsEl.innerHTML = `<div class="pf-none"><span class="spin spin-sm"></span> Loading…</div>`; return; }
    if (!stats) { statsEl.innerHTML = `<div class="pf-none">Couldn't load counters.</div>`; return; }
    const st = stats.storage || {}, pf = stats.profiles || {}, ac = stats.activity || {};
    let html = `<div class="pf-stats">`
      + statRow("Worlds published", esc(String(stats.worlds)))
      + statRow("Hidden", esc(String(stats.hidden)))
      + statRow("Removed", esc(String(stats.removed)))
      + statRow("Registered users", esc(String(stats.users)) + (st.stateBytes ? ` / ${esc(String(stats.usersCap))}` : ""))
      + `</div>`;
    if (st.stateBytes) {
      const used = st.stateBytes - (st.freeBytes || 0);
      html += `<h4 class="pf-sec-sub">Storage</h4><div class="pf-stats">`
        + statRow("Store", `${esc(fmtBytes(used))} of ${esc(fmtBytes(st.stateBytes))} · ${esc(fmtBytes(st.freeBytes || 0))} free`)
        + statRow("Report pool", `${esc(String(st.poolUsed))} / ${esc(String(st.poolRows))} rows`)
        + statRow("Bans", `${esc(String(st.banUsed != null ? st.banUsed : "?"))} / ${esc(String(st.banCap != null ? st.banCap : 1000))}`)
        + `</div>`;
    }
    if (pf.bioBuckets) {
      const tot = stats.users || 1;
      html += `<h4 class="pf-sec-sub">Profiles</h4><div class="pf-stats">`
        + statRow("Empty bios", `${esc(String(pf.bioBuckets[0]))} / ${esc(String(tot))}`)
        + statRow("Average bio", `${Math.round((pf.bioBytes || 0) / tot)} B`)
        + statRow("Avatars", esc(String(pf.avatars || 0)));
      for (const s of (pf.socials || [])) html += statRow(esc(String(s.field)), esc(String(s.filled)));
      html += statRow("Bio length (bytes)",
        `0:${esc(String(pf.bioBuckets[0]))} · 1–64:${esc(String(pf.bioBuckets[1]))} · 65–200:${esc(String(pf.bioBuckets[2]))} · 201–400:${esc(String(pf.bioBuckets[3]))} · 401+:${esc(String(pf.bioBuckets[4]))}`,
        "How many profiles fall in each bio-size bucket, measured in UTF-8 bytes (the 200 B cap)")
        + `</div>`;
    }
    if (ac.active90d != null) {
      html += `<h4 class="pf-sec-sub">Activity</h4><div class="pf-stats">`
        + statRow("Active · 7 days", esc(String(ac.active7d)))
        + statRow("Active · 30 days", esc(String(ac.active30d)))
        + statRow("Active · 90 days", esc(String(ac.active90d)))
        + statRow("Stale, never published (90d+)", esc(String(ac.staleNeverPublished90d)))
        + `</div>`;
    }
    statsEl.innerHTML = html;
  };

  // Per-row world details for the log: fetched on demand through the admin-only `getWorldAdmin`
  // (the public `getWorld` carries no report count on purpose), cached for the section's lifetime,
  // and kept across log reloads so acting on a world doesn't collapse what you were reading.
  const detailsCache = new Map(); // worldId -> { ok:true, world, reports, quorum, windowMs } | { ok:false }
  const expanded = new Set();     // worldIds whose details are open
  const fetching = new Set();     // worldIds with a details request in flight

  const detailWhen = (at) => { try { return new Date(at).toLocaleString(); } catch (e) { return ""; } };

  function detailHtml(w) {
    if (fetching.has(w)) return `<div class="pf-none"><span class="spin spin-sm"></span> Loading world…</div>`;
    const d = detailsCache.get(w);
    if (!d) return "";
    if (!d.ok) return `<div class="pf-none">Couldn't load this world (it may be gone).</div>`;
    const r = d.world;
    const winH = Math.max(1, Math.round((d.windowMs || 0) / 3600000));
    const statusBits = [r.status];
    if (r.hiddenReason) statusBits.push("· " + r.hiddenReason);
    if (r.nsfw) statusBits.push("· nsfw");
    const tags = (r.tags || []).map((t) => `<span class="ex-ml-tag">${esc(t)}</span>`).join("");
    return (r.coverUrl ? `<img class="ex-ml-cover" src="${esc(r.coverUrl)}" alt="" loading="lazy">` : "")
      + `<div class="ex-ml-dgrid">`
      + `<span class="ex-ml-k">Status</span><span><b>${esc(statusBits.join(" "))}</b>${r.status === "hidden" && r.hiddenReason === "reports" && r.reinstatesAt ? ` — appeal in flight, returns ${esc(detailWhen(r.reinstatesAt))}` : ""}</span>`
      + `<span class="ex-ml-k">Reports</span><span>${esc(String(d.reports))} / ${esc(String(d.quorum))} in the last ${esc(String(winH))}h</span>`
      + `<span class="ex-ml-k">Author</span><span>${esc(r.authorName || "(no name)")}<br><code>${esc(r.userId || "")}</code></span>`
      + (r.description ? `<span class="ex-ml-k">About</span><span class="ex-ml-desc">${esc(r.description)}</span>` : "")
      + (tags ? `<span class="ex-ml-k">Tags</span><span>${tags}</span>` : "")
      + `<span class="ex-ml-k">Stats</span><span>${ICON_HEART} ${esc(String(r.likes))} · ${ICON_DOWNLOAD} ${esc(String(r.downloads))} · v${esc(String(r.version))} · ${esc(fmtBytes(r.jsonBytes))}</span>`
      + `<span class="ex-ml-k">Dates</span><span>created ${esc(detailWhen(r.createdAt))}<br>updated ${esc(detailWhen(r.updatedAt))}${r.hiddenAt ? `<br>hidden ${esc(detailWhen(r.hiddenAt))}` : ""}</span>`
      + `</div>`;
  }

  // One row's admin actions, behind a ⋯ menu (same dropdown as the cards). Before details load each
  // action shows in the menu; after, only the applicable ones. Acting never requires expanding first.
  function rowActionsHtml(w) {
    const d = detailsCache.get(w);
    const rec = d && d.ok ? d.world : null;
    const acts = rec ? adminWorldActs(rec) : [
      ["hide", "🚫", "Hide"], ["unhide", "♻", "Unhide"], ["unpublish", "⛔", "Unpublish"],
      ["nsfw", "🔞", "Mark NSFW"], ["sfw", "🔞", "Unmark NSFW"]
    ];
    const btn = (a) => `<button type="button" data-act="${a[0]}"${a[0] === "unpublish" ? ' class="warn"' : ""}><span class="ld-wicon">${a[1]}</span><span class="ld-wtx">${esc(a[2].toLowerCase())}</span></button>`;
    const vis = acts.filter((a) => a[0] === "hide" || a[0] === "unhide");
    const rate = acts.filter((a) => a[0] === "nsfw" || a[0] === "sfw");
    const unp = acts.filter((a) => a[0] === "unpublish");
    const groups = [vis, rate, unp].filter((g) => g.length);
    return `<span class="ex-ml-menuwrap"><button class="mini" data-more type="button" title="Admin actions">⋯</button>`
      + `<span class="ex-amenu" hidden>`
      + `<button type="button" data-openmenu><span class="ld-wicon">↗</span><span class="ld-wtx">open</span></button>`
      + `<button type="button" data-inspect><span class="ld-wicon">🔍</span><span class="ld-wtx">inspect copy</span></button>`
      + `<span class="ld-wsep"></span>${groups.map((g) => g.map(btn).join("")).join('<span class="ld-wsep"></span>')}</span></span>`;
  }

  // 🔍 Inspect copy — the manual "add to library, then duplicate" flow in one click: the world's
  // file downloads straight into the cache (no library entry, no download counted) and an
  // editable "(inspect)" duplicate lands in the library. For a fast look inside a reported world.
  const inspectCopyWorld = async (w) => {
    const logged = items.find((x) => x.worldId === w) || {};
    let d = detailsCache.get(w);
    if (!d || !d.ok) {
      await fetchDetails(w, null);
      d = detailsCache.get(w);
    }
    const rec = d && d.ok ? d.world : null;
    if (!rec) { A().notify("✖ Couldn't load this world (it may be gone)."); return; }
    const title = rec.title || logged.title || w;
    let fileForm;
    try {
      const { text } = await fetchAndCache(rec);
      fileForm = JSON.parse(text);
    } catch (e) {
      A().notify("✖ Couldn't download \"" + title + "\": " + downloadFailText(e.message), { ms: 6200 });
      return;
    }
    const done = await saveDuplicateCopy({
      worldId: rec.worldId || w, title, userId: rec.userId || "", authorName: rec.authorName || "",
      fileForm, name: title + " (inspect)"
    });
    if (done) A().notify("🔍 Inspect copy saved — open it from the Worlds page.");
  };

  const fetchDetails = async (w, repaint) => {
    fetching.add(w);
    if (repaint) repaint();
    try {
      const r = await rpc("getWorldAdmin", { worldId: w });
      detailsCache.set(w, { ok: true, world: r.world, reports: r.reports, quorum: r.quorum, windowMs: r.windowMs });
    } catch (e) {
      detailsCache.set(w, { ok: false });
      if (e && e.code === "unauthorized" && (adminAuthed || modAuthed)) {
        adminAuthed = false;
        modAuthed = false;
        emit("admin");
        A().notify("🔑 Your session ended — sign in again.", { ms: 4000 });
      }
    } finally { fetching.delete(w); }
    if (repaint) repaint();
  };

  const onAdminAct = async (action, w, btn) => {
    const d = detailsCache.get(w);
    const logged = items.find((x) => x.worldId === w) || {};
    const name = (d && d.ok && (d.world.title || d.world.worldId)) || logged.title || logged.worldId || w;
    // The rating actions read as words (a confirm that says `nsfw "…"?` explains nothing); every
    // other action already reads as its own verb.
    const word = action === "nsfw" ? "Mark NSFW" : action === "sfw" ? "Unmark NSFW" : action;
    const ok = await A().ConfirmPopup.open({
      title: "Admin: " + word,
      message: `${word} "${name}"?`,
      confirmText: word, danger: action !== "unhide"
    });
    if (!ok) return;
    if (btn) btn.disabled = true;
    try {
      await rpc("moderate", { worldId: w, action });
      A().notify("🔑 " + word + " applied.");
      detailsCache.delete(w);
      await load();
    } catch (e) {
      if (e && e.code === "unauthorized" && (adminAuthed || modAuthed)) {
        adminAuthed = false;
        modAuthed = false;
        emit("admin");
        A().notify("🔑 Your session ended — sign in again.", { ms: 4400 });
      } else A().notify("✖ " + e.message, { ms: 4200 });
      if (btn) btn.disabled = false;
    }
  };

  const paintList = () => {
    if (logTabBtn) logTabBtn.textContent = items && items.length ? `Mod log (${items.length})` : "Mod log";
    if (!adminAuthed) { list.innerHTML = `<div class="pf-none">The log is owner-only — sign in as admin to read it.</div>`; return; }
    if (loading) { list.innerHTML = `<div class="pf-none"><span class="spin spin-sm"></span> Loading…</div>`; return; }
    if (!items) { list.innerHTML = `<div class="pf-none">Couldn't load the log.</div>`; return; }
    if (!items.length) { list.innerHTML = `<div class="pf-none">Nothing logged yet.</div>`; return; }
    list.innerHTML = items.map((e) => {
      const who = e.title || e.worldId || "";
      const w = e.worldId || "";
      return `<div class="ex-ml-row"${w ? ` data-wrow="${esc(w)}"` : ""}>
        <span class="ex-ml-when">${esc(new Date(e.at).toLocaleString())}</span>
        <span class="ex-ml-act">${esc(MODLOG_LABELS[e.action] || String(e.action || "").replace(/_/g, " "))}</span>
        <span class="ex-ml-world" title="${esc(who)}">${esc(who)}</span>
        ${w ? `<span class="ex-ml-tools">
          <button class="mini" data-detail type="button">${expanded.has(w) ? "▾ details" : "▸ details"}</button>
          <span data-acts></span>
        </span>
        <div class="ex-ml-detail" data-detailbox></div>` : ""}
      </div>`;
    }).join("");
    list.querySelectorAll(".ex-ml-row[data-wrow]").forEach((row) => {
      const w = row.dataset.wrow;
      const box = row.querySelector("[data-detailbox]");
      const acts = row.querySelector("[data-acts]");
      const paintRow = () => {
        row.querySelector("[data-detail]").textContent = expanded.has(w) ? "▾ details" : "▸ details";
        box.innerHTML = expanded.has(w) ? detailHtml(w) : "";
        acts.innerHTML = rowActionsHtml(w);
        const more = acts.querySelector("[data-more]");
        const menu = acts.querySelector(".ex-amenu");
        if (more && menu) {
          more.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll(".ex-amenu").forEach((m) => { if (m !== menu) m.hidden = true; });
            menu.hidden = !menu.hidden;
            if (!menu.hidden) { try { if (A().placeWorldMenu) A().placeWorldMenu(menu); } catch (e2) {} }
          };
          menu.onclick = (e) => e.stopPropagation();
          menu.querySelector("[data-openmenu]").onclick = () => { menu.hidden = true; openLinkedWorld(w); };
          menu.querySelector("[data-inspect]").onclick = () => { menu.hidden = true; inspectCopyWorld(w); };
          menu.querySelectorAll("[data-act]").forEach((b) => {
            b.onclick = () => { menu.hidden = true; onAdminAct(b.dataset.act, w, b); };
          });
        }
      };
      row.querySelector("[data-detail]").onclick = () => {
        if (expanded.has(w)) expanded.delete(w);
        else {
          expanded.add(w);
          if (!detailsCache.has(w) && !fetching.has(w)) fetchDetails(w, paintRow);
        }
        paintRow();
      };
      if (expanded.has(w) && !detailsCache.has(w) && !fetching.has(w)) fetchDetails(w, paintRow);
      paintRow();
    });
  };

  const load = async () => {
    const authed = !!(adminAuthed || modAuthed);
    if (!authed) { paintBar(); paintStats(); paintList(); paintBans(); return; }
    loading = true;
    paintBar();
    paintStats();
    paintList();
    paintBans();
    let signedOut = false;
    if (adminAuthed) {
      try {
        const r = await rpc("getModLog", { pageSize: 40 });
        items = r.items || [];
      } catch (e) {
        items = null;
        if (e.code === "unauthorized") signedOut = true;
      }
    } else { items = []; }
    try {
      stats = await rpc("getStats", {});
    } catch (e) {
      stats = null;
      if (e.code === "unauthorized") signedOut = true;
    }
    try {
      const b = await rpc("getBanAudit", { includeExpired: false });
      bans = (b && b.bans) || [];
      banCap = (b && b.cap) || 1000;
    } catch (e) {
      bans = null;
      if (e.code === "unauthorized") signedOut = true;
    }
    if (signedOut && (adminAuthed || modAuthed)) {
      adminAuthed = false;
      modAuthed = false;
      emit("admin");
      A().notify("🔑 Your session ended — sign in again.", { ms: 4000 });
    }
    loading = false;
    paintBar();
    paintStats();
    paintList();
    paintBans();
  };

  adminLoadFn = load;
  // The section only ever mounts after `adminEnsure()` passed, so a first paint with no data would sit
  // on the error states until ⟳ — fetch straight away instead. (This also fixes the log's first
  // paint, which had the same wait-for-refresh.) Re-entry reuses the panel's cached element.
  if (adminAuthed || modAuthed) load();
  else { paintBar(); paintStats(); paintList(); paintBans(); }
  return sec;
}

/* ---------------------------------------------------------------------------
 * Settings panel → the Identity section (§6.16)
 * ------------------------------------------------------------------------- */

// The Settings panel's identity section: username (claim / rename), user id, the public profile
// (picture + bio, as shown on the author's user page), the creator code, and the restore-a-code
// flow. This is where the contents of the old 👤 identity popup live now — the Explore header's
// identity chip raises the panel on this section, so there is exactly one place that shows
// this and exactly one place that reveals the code.
//
// Returns a fresh `<section>` element (the caller places it and owns teardown); everything it wires is
// scoped to that element, so discarding it leaves nothing behind.
export async function identitySection() {
  const sec = el("section", "pf-sec pf-ident");
  sec.innerHTML = `
    <h3 class="pf-sec-title">Identity</h3>
    <p class="pf-hint">Your identity is a random secret kept in this browser. It's what proves you own the worlds you publish. Claim a username to get a public profile — avatar, bio and link editing need one.</p>
    <div class="pf-kv pf-r-username"><span class="pf-k">Username</span><span class="pf-v pf-name-v"></span><button class="mini pf-name-btn"></button></div>
    <div class="pf-kv pf-r-uid"><span class="pf-k">User id</span><span class="pf-v mono pf-uid"></span><button class="mini pf-visit">Visit profile</button></div>
    <div class="pf-kv pf-r-avatar"><span class="pf-k">Avatar</span><span class="pf-v pf-avatar-v"></span><button class="mini pf-avatar-btn">Upload</button></div>
    <div class="pf-kv pf-r-bio"><span class="pf-k">Bio</span><span class="pf-v pf-bio-v"></span><button class="mini pf-bio-btn">Edit</button></div>
    <div class="pf-kv pf-r-reddit"><span class="pf-k">Reddit</span><span class="pf-v pf-link-v" data-net="reddit"></span><button class="mini pf-link-btn" data-net="reddit">Edit</button></div>
    <div class="pf-kv pf-r-discord"><span class="pf-k">Discord</span><span class="pf-v pf-link-v" data-net="discord"></span><button class="mini pf-link-btn" data-net="discord">Edit</button></div>
    <div class="pf-kv pf-r-creator"><span class="pf-k">Creator code</span><span class="pf-v"><button class="mini pf-reveal">Reveal</button></span></div>
    <div class="pf-code" hidden></div>
    <div class="pf-warn pf-r-creator-warn">⚠️ Your creator code is a <b>master key</b>: anyone who has it can edit, overwrite, or delete every world you've published. Never post it publicly.</div>
    <div class="pf-kv pf-r-restore"><span class="pf-k">Restore identity</span><span class="pf-v"><button class="mini pf-restore">Restore using creator code</button></span></div>
    <div class="pf-kv pf-r-reclaim"><span class="pf-k">My worlds</span><span class="pf-v"><button class="mini pf-reclaim">Restore my published worlds</button></span></div>`;

  const gatedRows = () => [...sec.querySelectorAll(".pf-r-uid, .pf-r-avatar, .pf-r-bio, .pf-r-reddit, .pf-r-discord, .pf-r-creator, .pf-r-reclaim")];
  const creatorWarn = sec.querySelector(".pf-r-creator-warn");

  const nameV = sec.querySelector(".pf-name-v");
  const nameBtn = sec.querySelector(".pf-name-btn");
  const uidEl = sec.querySelector(".pf-uid");
  const revealBtn = sec.querySelector(".pf-reveal");
  const codeBox = sec.querySelector(".pf-code");

  // Repaint the two data rows. Called on mount and after a claim/rename/restore: a rename repaints
  // here, re-runs the authorship reconciliation (claimUsernamePopup does that) and — because the
  // Explore chip is only painted while Explore is mounted — the chip is correct again by the time you
  // go back to Explore.
  const paint = async () => {
    const id = await getIdentity({ create: false });
    const name = (id && id.username) || "";
    nameV.innerHTML = name ? esc("@" + name) : "<i>not claimed yet</i>";
    nameBtn.textContent = name ? "Rename" : "Claim";
    uidEl.textContent = (id && id.userId) || "—";
    // Until a username is claimed the section shows only Claim + restore-a-code: every other
    // row (user id, avatar, bio, links, creator code, my worlds) stays hidden.
    for (const row of gatedRows()) row.hidden = !name;
    if (creatorWarn) creatorWarn.hidden = !name;
    // The creator code only matters once the identity owns something (a username) — and showing
    // the master key to someone who hasn't even claimed yet is all risk, no use. Gate the button
    // on the claim; if a restore lands an unclaimed identity, put the code away again.
    revealBtn.disabled = !name;
    revealBtn.title = name ? "" : "Claim a username first";
    if (!name && !codeBox.hidden) {
      codeBox.hidden = true;
      codeBox.innerHTML = "";
      revealBtn.textContent = "Reveal";
    }
  };
  await paint();

  nameBtn.onclick = async () => {
    const id = await getIdentity({ create: false });
    const name = await claimUsernamePopup({ current: (id && id.username) || "" });
    if (!name) return;
    await paint();
    paintIdentityButton();
    myUid = ((await getIdentity({ create: false })) || {}).userId || "";
    prof = await paintProfile(myUid);
  };

  // The public profile (picture + bio) shown on the author's user page — edited here, in Settings,
  // instead of on the page itself (one button there opens this section). Reads and writes through
  // the same profile-content store the page reads, and asks the shell to repaint the page behind
  // this panel so going back shows the edit.
  const avatarV = sec.querySelector(".pf-avatar-v");
  const avatarBtn = sec.querySelector(".pf-avatar-btn");
  const bioV = sec.querySelector(".pf-bio-v");
  const bioBtn = sec.querySelector(".pf-bio-btn");
  const linkVs = [...sec.querySelectorAll(".pf-link-v")];
  const paintProfile = async (uid) => {
    let c = { bio: "", avatar: "", socials: emptySocials() };
    if (uid) { try { c = await getProfileContent(uid); } catch (e) {} }
    if (!c.socials) c.socials = emptySocials();
    avatarV.innerHTML = c.avatar
      ? `<img class="pf-avatar-img" src="${esc(c.avatar)}" alt=""><button class="mini pf-avatar-rm" title="Remove the avatar">✕</button>`
      : `<img class="pf-avatar-img" src="src/images/portrait-placeholder.webp" alt="" title="No avatar yet — upload one">`;
    const rm = avatarV.querySelector(".pf-avatar-rm");
    if (rm) rm.onclick = () => saveProfile({ avatar: "" });
    bioV.innerHTML = c.bio ? esc(c.bio) : `<span class="pf-none">A line or two about yourself…</span>`;
    for (const v of linkVs) {
      const net = v.dataset.net;
      const url = String((c.socials && c.socials[net]) || "");
      v.innerHTML = url ? esc(url.replace(/^https:\/\//i, "")) : `<span class="pf-none">No link yet</span>`;
      v.title = url || "";
    }
    return c;
  };
  const needName = async () => {
    const id = await getIdentity({ create: false });
    if (!id || !id.userId || !id.username) { A().notify("✖ Claim a username first — avatar, bio and links need a public profile.", { ms: 4200 }); return null; }
    return id;
  };
  let myUid = ((await getIdentity({ create: false })) || {}).userId || "";
  // One-time rescue: a pre-server bio/avatar (editable file or device copy) moves to the server
  // the first time Identity opens. Best-effort — a failure just leaves the server copy empty.
  if (myUid) { try { await migrateLegacyProfileIfNeeded(myUid); } catch (e) {} }
  let prof = await paintProfile(myUid);
  let savingProfile = false;
  const saveProfile = async (patch) => {
    if (savingProfile) return;
    const id = await needName();
    if (!id) return;
    myUid = id.userId;
    const next = { bio: prof.bio, avatar: prof.avatar, socials: Object.assign(emptySocials(), prof.socials), ...patch };
    const isAvatar = patch && Object.prototype.hasOwnProperty.call(patch, "avatar");
    const isRemove = isAvatar && !patch.avatar;
    savingProfile = true;
    avatarBtn.disabled = true; bioBtn.disabled = true;
    const linkBtns = [...sec.querySelectorAll(".pf-link-btn")];
    linkBtns.forEach((b) => (b.disabled = true));
    const rmBtn = avatarV.querySelector(".pf-avatar-rm");
    if (rmBtn) rmBtn.disabled = true;
    // Avatar uploads hit the upload host + the catalog, which can take several
    // seconds with no visible change — hold a busy panel so it doesn't look stuck.
    // The settings panel is a `.popup-overlay` (z 90), above the default busy
    // level (z 80) — so this instance opts above it, still below toasts (100).
    const busy = makeBusyPopup(isAvatar ? (isRemove ? "Removing avatar…" : "Uploading avatar…") : "Saving profile…", { zIndex: 95 });
    if (isAvatar && !isRemove) busy.say("Uploading image… please wait.");
    try {
      const r = await saveProfileContent(myUid, next);
      A().notify("👤 Profile saved.");
      prof = await paintProfile(myUid);
      idAvatarUid = myUid;
      idAvatarUrl = (r && r.avatar) || next.avatar || "";
      paintIdentityButton();
      try { if (A().refreshUserPage) A().refreshUserPage(); } catch (e) {}
    } catch (e) {
      A().notify("✖ Couldn't save the profile: " + (e.message || e), { ms: 5200 });
    } finally {
      busy.close();
      savingProfile = false;
      avatarBtn.disabled = false; bioBtn.disabled = false;
      linkBtns.forEach((b) => (b.disabled = false));
    }
  };
  avatarBtn.onclick = async () => {
    if (!(await needName())) return;
    let file;
    try { file = await pickImageFile(); } catch (e) { return; }
    if (!file) return;
    // Blob-direct: File → createImageBitmap (off-thread decode) → canvas → WebP Blob, then
    // upload before saving, so no base64 data URL ever exists on this path. Always re-encodes
    // (strips EXIF) at the unified quality. saveProfile() then stores the hosted URL only.
    // The resize itself can take a beat on large phone photos, so the busy panel goes up
    // BEFORE it — otherwise the click looks dead until the upload stage.
    avatarBtn.disabled = true;
    const earlyBusy = makeBusyPopup("Uploading avatar…", { zIndex: 95 });
    earlyBusy.say("Resizing image…");
    let blob;
    try {
      const { fileToWebpBlob } = await import("./image-utils.js");
      blob = await fileToWebpBlob(file, { maxDim: PROFILE_AVATAR_MAX_DIM, quality: COVER_WEBP_QUALITY });
    }
    catch (e) { earlyBusy.close(); avatarBtn.disabled = false; A().notify("✖ " + (e.message || e), { ms: 4200 }); return; }
    earlyBusy.say("Uploading image… please wait.");
    let url;
    try { url = await uploadAvatarBlob(blob); }
    catch (e) { earlyBusy.close(); avatarBtn.disabled = false; A().notify("✖ " + (e.message || e), { ms: 4200 }); return; }
    earlyBusy.close();
    avatarBtn.disabled = false;
    await saveProfile({ avatar: url });
  };
  bioBtn.onclick = async () => {
    if (!(await needName())) return;
    const v = await A().TextPopup.open({ title: "Edit bio", value: prof.bio || "", placeholder: "A line or two about yourself…", rows: 4, confirmText: "Save", maxBytes: PROFILE_BIO_MAX, note: "Limit: 200 bytes — emoji count as up to 4." });
    if (v == null) return;
    await saveProfile({ bio: utf8ByteTrunc(String(v).trim(), PROFILE_BIO_MAX) });
  };
  sec.querySelectorAll(".pf-link-btn").forEach((btn) => {
    btn.onclick = async () => {
      if (!(await needName())) return;
      const net = btn.dataset.net;
      const cur = String((prof.socials && prof.socials[net]) || "");
      const v = await A().TextPopup.open({ title: net === "discord" ? "Discord" : SOCIAL_LABELS[net] + " link", value: cur, placeholder: SOCIAL_PLACEHOLDERS[net], rows: 1, confirmText: "Save", maxLength: SOCIAL_MAX * 2 });
      if (v == null) return;
      const url = String(v).trim();
      if (url && !socialUrlOk(net, url)) { A().notify(net === "discord" ? "Enter your Discord username or a full https:// invite link." : "That link is not valid — paste the full https:// link for " + SOCIAL_LABELS[net] + ".", { ms: 5200 }); return; }
      await saveProfile({ socials: Object.assign(emptySocials(), prof.socials, { [net]: url }) });
    };
  });

  // The creator code is revealed in place and the button toggles back to "Reveal" (clearing the
  // textarea on hide, so the master key isn't left sitting in the DOM). No confirm popup: the warning
  // is on the page directly above the button, and a second click puts the code away again.
  // The button is disabled until a username is claimed (see paint); the guard below covers the
  // gap if the identity changes without a repaint.
  revealBtn.onclick = async () => {
    if (!codeBox.hidden) {
      codeBox.hidden = true;
      codeBox.innerHTML = "";
      revealBtn.textContent = "Reveal";
      return;
    }
    const id0 = await getIdentity({ create: false });
    if (!id0 || !id0.username) { A().notify("✖ Claim a username first — the creator code unlocks once your identity owns something.", { ms: 4200 }); await paint(); return; }
    const i = await getIdentity({ create: true });
    const code = await creatorCode(i);
    codeBox.innerHTML = `<textarea class="pf-code-ta" rows="4" readonly>${esc(code)}</textarea>
      <div class="pf-row"><button class="mini pf-copy">Copy</button><button class="mini pf-dl">${ICON_EXPORT} Save as file</button><span class="pf-note">Keep this private — it is the whole key.</span></div>`;
    codeBox.hidden = false;
    revealBtn.textContent = "Hide";
    codeBox.querySelector(".pf-copy").onclick = () => {
      copyToClipboard(code, { okMsg: "📋 Creator code copied. Keep it private!", title: "Copy creator code", failMsg: "Copy failed — press Ctrl/Cmd+C to copy it." });
    };
    codeBox.querySelector(".pf-dl").onclick = () => downloadText("mno-creator-code.txt", code, "text/plain");
  };

  sec.querySelector(".pf-restore").onclick = async () => {
    if (await promptRestoreCreatorCode()) await paint();
  };
  sec.querySelector(".pf-reclaim").onclick = async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const busy = makeBusyPopup("Restoring your worlds…");
    try {
      busy.say("Asking the community for your published worlds…");
      const s = await reclaimMyWorlds({ onProgress: (done, total, name) => busy.say(`Restoring ${done}/${total}… ${name || ""}`.trim()) });
      busy.close();
      if (!s.total) A().notify("ℹ️ No published worlds found for this identity.");
      else if (s.restored > 0) A().notify(`Restored ${s.restored} world${s.restored === 1 ? "" : "s"} to your library${s.failed.length ? ` (${s.failed.length} failed)` : ""}.`);
      else if (s.failed.length) A().notify(`✖ Couldn't restore your worlds: ${s.failed[0].error}`, { ms: 6200 });
      else A().notify("✓ Your published worlds are already in your library.");
    } catch (err) { busy.close(); A().notify("✖ Couldn't reach the community: " + (err.message || err), { ms: 6200 }); }
    btn.disabled = false;
  };
  sec.querySelector(".pf-visit").onclick = async () => {
    const id = await getIdentity({ create: false });
    if (!id || !id.userId || !id.username) { A().notify("✖ Claim a username first — there's no public profile to visit yet.", { ms: 4200 }); return; }
    A().closeSettingsPanel();
    A().goUser(id.userId, id.username || "");
  };
  return sec;
}

// Ask for a creator code and, on confirmation, replace this device's identity with the one it carries.
// Shared by the Identity section and — before the two were consolidated — by Data & Backup, which had
// its own copy of this flow. One wording, one confirmation, one place (§6.16).
//
// It reloads when it succeeds (the panel's version always did): the identity is read into several
// in-memory places at boot — the community module's `identity`, the world store's author copy, the
// lands' ownership checks — and a restored code changes who owns what, so re-initialising everything
// is the only honest way to land. Returns false when the player cancels or the code is bad.
export async function promptRestoreCreatorCode() {
  const code = await A().TextPopup.open({ title: "Restore from creator code", value: "", placeholder: "MNO1-…", rows: 3, confirmText: "Restore" });
  if (!code) return false;
  try { await readCreatorCode(code); } catch (e) { A().notify("✖ " + e.message, { ms: 5200 }); return false; }
  const ok = await A().ConfirmPopup.open({
    title: "Replace this browser's identity?",
    message: "Your current identity on this device will be replaced by the one in the creator code. Worlds published with the current identity would no longer be editable from here.",
    warning: "Restore only your own creator code.",
    confirmText: "Restore", danger: true
  });
  if (!ok) return false;
  await restoreCreatorCode(code);
  const busy = makeBusyPopup("Restoring your worlds…");
  let summary = null, reclaimErr = "";
  try {
    busy.say("Asking the community for your published worlds…");
    summary = await reclaimMyWorlds({ onProgress: (done, total, name) => busy.say(`Restoring ${done}/${total}… ${name || ""}`.trim()) });
  } catch (e) { reclaimErr = e.message || String(e); }
  busy.close();
  if (summary && summary.restored > 0) A().notify(`👤 Identity restored — ${summary.restored} world${summary.restored === 1 ? "" : "s"} restored to your library. Reloading…`);
  else if (summary && summary.total === 0) A().notify("👤 Identity restored (no published worlds found). Reloading…");
  else if (reclaimErr) A().notify("👤 Identity restored, but your worlds couldn't be fetched (" + reclaimErr + "). Reloading — retry from Settings → Identity.");
  else A().notify("👤 Identity restored. Reloading…");
  setTimeout(() => location.reload(), 1100);
  return true;
}

/* ---------------------------------------------------------------------------
 * Settings panel → the Content settings section (§6.16)
 * ------------------------------------------------------------------------- */

// The local library's author ids → names, as far as this device knows them (every added community
// world records who wrote it). Used only to LABEL a muted id the settings can't name themselves — a
// mute made on another device, or before names were recorded.
async function localAuthorNames() {
  const out = {};
  try {
    const lib = (await getLibrary()) || {};
    for (const rec of Object.values(lib)) {
      if (rec && rec.userId && rec.authorName) out[rec.userId] = rec.authorName;
    }
  } catch (e) { /* an unreadable library just means fewer names — never an error */ }
  return out;
}

// The reader's own blocklists: the tags you never want to see, and the authors you've muted. They have
// never been catalog filters — they stay on this device, they're applied after every page, and
// they hide worlds from you alone while the catalog goes on being the catalog. That is why they live
// here rather than in Explore's ⚙ Filters panel (§6.16): a filter panel narrows the search you're in
// the middle of, while these are standing decisions about what you want to see at all, and they apply
// on every page.
//
// Blocked tags are edited as a comma-separated list — the same shape the old panel used, because a
// list of tags is a list of tags. Muted authors are stored as ids ONLY: the catalog keys everything by
// id, so a rename can't break a mute. The names are a display sidecar (`mutedNames`, filled at mute
// time), with `localAuthorNames()` filling what it can, and an id we can't name at all falls back to
// its first eight characters rather than inventing who it is.
//
// **Show NSFW** leads the section because it is the one switch here that every page obeys: it is the
// shared per-device preference behind the toolbar's ⊘ (search-bar.js), and hiding the adult worlds is
// the same kind of standing decision as a blocklist — this is where a reader who wants it out of the
// way once, rather than on every toolbar they meet, comes to set it. Flipping it here repaints
// whichever card page is open (Explore below; Worlds through main.js's `applyNsfwPref`).
export async function contentSettingsSection() {
  const sec = el("section", "pf-sec pf-content");
  const s = await getSettings();
  sec.innerHTML = `
    <h3 class="pf-sec-title">Content settings</h3>
    <p class="pf-hint">What you'd rather not see in Explore. These stay in this browser — nothing about them is sent anywhere — and they only change what <b>you</b> are shown.</p>
    <div class="pf-kv pf-nsfw-row">
      <span class="pf-k">${infoTipLabelHtml("Show NSFW", "Whether worlds tagged NSFW are shown in Explore. They stay hidden unless this is on.")}</span>
    </div>
    <div class="pf-kv">
      <span class="pf-k">Blocked tags</span>
      <span class="pf-v pf-blocked"></span>
    </div>
    <div class="pf-kv">
      <span class="pf-k">Muted authors</span>
      <span class="pf-v pf-muted"></span>
    </div>
    <p class="pf-note">Mute an author with <b>⦸ Mute button.</b> The ones you've muted are listed here — click to unmute.</p>`;

  // Show NSFW — the toolbar's ⊘ preference, worn here as an On/Off switch. Turning it OFF drops the
  // `nsfw` REQUIRE filter on Explore, exactly as the toolbar's own switch does (with the adult worlds
  // hidden again it can never match, and the chip that would explain the empty grid is gone with the
  // switch); an EXCLUSION is left alone, since it only says what the switch already says.
  // Titleless: the label's static info-tip is the single source (same policy as the Story panel).
  const nsfwSw = switchEl({
    on: showNsfw,
    set: setShowNsfw,
    text: showNsfw() ? "On" : "Off",
    plain: true,
    danger: true,
    onChange: () => {
      nsfwSw.setLabel(showNsfw() ? "On" : "Off");
      if (!showNsfw()) {
        ex.tags = ex.tags.filter((t) => String(t).toLowerCase() !== NSFW_TAG);
        ex.tagsNot = ex.tagsNot.filter((t) => String(t).toLowerCase() !== NSFW_TAG);
      }
      // Explore is this module's: repaint its bar (whose ⊘ shows the same preference) and its grid.
      if (ex.open) refreshExplore(true);
      // Worlds (with its ⊘ switch) is main.js's — it drops the same stale filter and repaints itself.
      A().applyNsfwPref();
    }
  });
  sec.querySelector(".pf-nsfw-row").appendChild(nsfwSw.el);

  // Blocked tags use the same tag control as the world editor's `tags` field (chip-input.js), so a tag
  // is added with Enter or `,` and removed with ✕ or Backspace, rather than hand-editing a comma list.
  const blockedWrap = sec.querySelector(".pf-blocked");
  const blocked = () => s.blockedTags || [];
  blockedWrap.appendChild(createChipInput({
    list: blocked,
    max: MAX_BLOCKED_TAGS,
    placeholder: "type a tag, Enter to add",
    fullText: `max ${MAX_BLOCKED_TAGS} tags — remove one to add another`,
    removeTitle: "Unblock tag",
    commit: (t) => { (s.blockedTags = blocked()).push(t); return true; },
    remove: (t) => { s.blockedTags = blocked().filter((x) => x !== t); },
    onChange: () => {
      const tags = (s.blockedTags || []).slice();
      saveSettings({ blockedTags: tags }).catch((e) => console.warn("[settings] saving blocked tags failed", e));
      A().notify(tags.length ? "⊘ Blocking " + tags.length + " tag" + (tags.length === 1 ? "" : "s") + "." : "⊘ Blocked tags cleared.");
    }
  }).el);

  const wrap = sec.querySelector(".pf-muted");
  const paintMuted = async () => {
    const st = await getSettings();
    const ids = st.mutedUsers || [];
    if (!ids.length) { wrap.innerHTML = '<i class="pf-none">none yet</i>'; return; }
    const names = Object.assign({}, await localAuthorNames(), st.mutedNames || {});
    wrap.innerHTML = ids.map((id) => {
      const name = names[id] || "";
      const label = name ? "@" + name : id.slice(0, 8) + "…";
      return `<button type="button" class="pf-chip" data-mute="${esc(id)}" title="Unmute ${esc(name ? "@" + name : id)}">${esc(label)} <span class="pf-chip-x">✕</span></button>`;
    }).join("");
    wrap.querySelectorAll("[data-mute]").forEach((b) => {
      b.onclick = async () => {
        const cur = await getSettings();
        const id = b.dataset.mute;
        const nextNames = Object.assign({}, cur.mutedNames || {});
        delete nextNames[id];
        await saveSettings({ mutedUsers: (cur.mutedUsers || []).filter((x) => x !== id), mutedNames: nextNames });
        A().notify("⦸ Unmuted.");
        paintMuted();
      };
    });
  };
  await paintMuted();
  return sec;
}

// Restore an identity from a creator code — shared by the Profile page's Identity section and the
// public `api` (console: `await community.restoreCreatorCode(code)`).
// The code carries the secret (+ userId + checksum); the username is resolved from the server
// (never carried in the code), so a rename follows you automatically.
export async function restoreCreatorCode(code) {
  const payload = await readCreatorCode(code);
  await setIdentity({ userId: payload.u, secret: payload.s, createdAt: Date.now(), formatVersion: 1 });
  try {
    const r = await rpc("getUser", { userId: payload.u });
    if (r.user && r.user.username) {
      const cur = await getIdentity();
      await setIdentity(Object.assign({}, cur, { username: r.user.username, usernameLower: r.user.username.toLowerCase(), usernameClaimedAt: r.user.claimedAt || Date.now() }));
    }
  } catch (e) { /* offline — the local identity still works and the name resolves on the next connect */ }
  return true;
}

/* ---------------------------------------------------------------------------
 * added-world cards (rendered by the Worlds page's 🌐 Added source facet)
 * ------------------------------------------------------------------------- */

// The front-facing fields for an added world. The library record snapshots the catalog listing, but
// records written before the listing fields were kept carry only the download details — so the
// cached world file (parsed once per content hash) fills in whatever the record lacks. `meta` is
// passed in by main.js when it has already resolved it (its Worlds-page filters read the same
// fields), and computed here otherwise.
const metaByHash = new Map();
function cachedMetaFromEntry(entry) {
  if (!entry || !entry.text) return null;
  const key = entry.jsonHash || entry.text;
  if (metaByHash.has(key)) return metaByHash.get(key);
  let m = null;
  try { const { world } = loadWorld(entry.text); m = world ? world.meta : null; } catch (e) { m = null; }
  metaByHash.set(key, m);
  return m;
}

export function addedMetaFrom(rec, entry) {
  const wm = cachedMetaFromEntry(entry);
  const pick = (a, b) => (a === undefined || a === null || a === "" ? b : a);
  const tags = (Array.isArray(rec.tags) && rec.tags.length) ? rec.tags : ((wm && wm.tags) || []);
  return {
    name: pick(rec.title, wm && wm.name) || rec.worldId,
    description: pick(rec.description, wm && wm.description) || "",
    author: pick(rec.authorName, wm && wm.author) || "",
    tags: Array.isArray(tags) ? tags : [],
    nsfw: rec.nsfw === true || !!(wm && wm.nsfw),
    cover: pick(rec.coverUrl, wm && wm.cover) || "",
    // Fork provenance (the `remix` chip): the saved world file's `meta.remix`, or the catalog
    // record's own `forkOf*` fields when the copy isn't downloaded yet.
    remix: (wm && wm.remix) || (rec.forkOfWorldId ? {
      worldId: rec.forkOfWorldId, name: rec.forkOfTitle || "", userId: rec.forkOfUserId || "",
      author: rec.forkOfAuthor || "", at: ""
    } : null)
  };
}

// Tag chips — the special markers first (the dark-red `nsfw` rating, the dark-purple `remix`
// provenance), then the author's own tags. The rendering is shared with the library cards in
// tag-row.js, so a world reads identically on Explore and in the library; `remixTitle` carries the
// richer "remix of X by @Y" tooltip where the record knows the original, and `clickable` makes each
// chip a shortcut into Explore's own tag filter (the panel passes it; see applyTagFilter).
function tagChipHtml(tags, nsfw, remix, remixTitle, clickable) {
  return tagChipsHtml(tags, { nsfw, remix, remixTitle, clickable });
}

// The `remix` chip's tooltip, from whichever provenance shape the caller holds: an Explore record's
// `forkOf*` fields (the catalog's publish payload), or a card meta's `meta.remix` record. It never
// falls back to the object's OWN title/author — those belong to the remix, not to its original.
function remixTipFrom(src) {
  if (!src) return "";
  const remix = src.remix || {};
  const title = src.forkOfTitle || remix.name || "";
  const author = src.forkOfAuthor || remix.author || "";
  const who = author ? ` by @${author}` : "";
  return title ? `Remix of "${title}"${who}` : "";
}

// The bottom line of a browse card: what this card means for *you* (its provenance, or the one
// thing about a saved copy that needs attention). It is always emitted — an empty box when there is
// nothing to say — so the description and tag row above it land at the same offset on every card of
// a grid row, and it is clipped to a single line because the card is far too narrow for a sentence;
// the full wording rides in the title tooltip (and the details popup). The text sits in a
// `.ld-wnote-tx` span — the footer is a flex row (text left, an optional right-hand slot), so the
// span is what ellipsises inside it.
function noteLine(text, kind, title) {
  const cls = kind ? " ld-wnote-" + kind : "";
  return '<div class="ld-wnote' + cls + '"' + (title ? ' title="' + esc(title) + '"' : "") + ">"
    + (text ? '<span class="ld-wnote-tx">' + esc(text) + "</span>" : "") + "</div>";
}

// An added world's note: provenance at rest, or the single thing that needs the player's attention
// when there is one (a newer catalog version, a failed download, a hidden or delisted original).
// Mirrors main.js's addedNote (which serves the fallback card when this module failed to load); the
// last line isn't mirrored by hand — it comes from main.js's own `publicNote` through mnoApp, so the
// two cards say `Public` the same way and wear the same Explore mark.
function addedNoteLine(rec, entry) {
  if (rec.stale) return noteLine("⟳ Update Available", "upd", "A newer version exists — click to update to it.");
  if (rec.status === "unknown" || rec.status === "removed") return noteLine("⚠ No Longer Public", "warn", "The original is no longer published — you're playing your saved copy.");
  if (rec.status === "hidden") return noteLine("⚑ Hidden After Reports", "warn", "Hidden after reports — still playable from your saved copy.");
  if (!entry) return noteLine("⚠ Download Failed", "warn", "The world file couldn't be downloaded yet — click to retry." + (rec.failReason ? " " + downloadFailText(rec.failReason) + "." : ""));
  return A().publicNote("A public world you added — you're playing your saved copy.");
}

// One "added from the community" card — read-only: retry a failed download, refresh to a newer
// catalog version, fork via Duplicate, or remove. Playing is the card itself (clicking it opens the
// world, whose popup carries ▶ Play) and reporting belongs to Explore, the reader's shelf, so neither
// is in this ⋮ menu (main.js's fallback simpleAddedCard mirrors that). Called by main.js's Worlds
// page (the shell owns the page; this owns the card). `entry` is the cached world file
// ({ text, bytes, jsonHash }) or null when the download hasn't succeeded yet.
export function addedCard(rec, entry, meta) {
  meta = meta || addedMetaFrom(rec, entry);
  const card = el("div", "ld-wcard ex-added-card");
  const cover = meta.cover
    ? `<img class="ld-wcover-img" src="${esc(meta.cover)}" alt="" loading="lazy">`
    : `<div class="ld-wcover-ph">${esc(String(meta.name || "?").charAt(0).toUpperCase())}</div>`;
  const bits = [];
  if (meta.author) bits.push(authorUid(rec.userId, meta.author)
    ? `<button class="ex-author ex-author-link" data-uid="${esc(authorUid(rec.userId, meta.author))}" title="Open this author's profile">@${esc(meta.author)}</button>`
    : `<span class="ex-author">@${esc(meta.author)}</span>`);
  // Just `@author` — the saved-adventure count and the catalog version live in the details popup — and
  // the row is always emitted (even with no author) so an uncredited world keeps its description at
  // the same offset as its neighbours'.
  const metaHtml = `<div class="ld-meta">${bits.join("")}</div>`;
  const tagHtml = tagChipHtml(meta.tags, meta.nsfw, isRemixMeta(meta), remixTipFrom(meta));
  const note = addedNoteLine(rec, entry);
  card.innerHTML = `
    <div class="ld-wcover">
      ${cover}
      ${isMnoAuthor(rec.userId, rec.authorName || meta.author) && libRecLive(rec) ? mnoBadgeCover : ""}
      <button class="ld-wmore" title="World actions">⋮</button>
    </div>
    <div class="ld-wbody">
      <div class="ld-whead"><span class="ld-wname" title="${esc(meta.name)}">${esc(meta.name)}</span></div>
      ${metaHtml}
      <div class="ld-wdesc">${inlineMd(meta.description || "")}</div>
      <div class="ld-wtags">${tagHtml}</div>
      ${note}
    </div>
    <div class="ld-wmenu" hidden>
      ${A().worldMenuItem("retry", ICON_DOWNLOAD, "Retry download", { hidden: !!entry })}
      ${A().worldMenuItem("refresh", "⟳", "Update", { hidden: !rec.stale })}
      ${A().worldMenuItem("dupe", "⧉", "Duplicate (Remix)")}
      <div class="ld-wsep"></div>
      ${A().worldMenuItem("remove", "✕", "Remove from library", { cls: "warn" })}
    </div>`;
  card.addEventListener("click", () => A().openLibWorldDetail(rec.worldId));
  const addedAuthorBtn = card.querySelector(".ex-author-link");
  if (addedAuthorBtn) addedAuthorBtn.onclick = (e) => { e.stopPropagation(); const uid = authorUid(rec.userId, meta.author); if (uid && A().goUser) A().goUser(uid, meta.author); };
 const moreBtn = card.querySelector(".ld-wmore");
 const menu = card.querySelector(".ld-wmenu");
  const closeMenu = () => { menu.hidden = true; try { menu.classList.remove("up"); } catch (e) {} A().closeWorldMenu(); };
 moreBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    // The menu is registered with main.js's single-open-menu tracker, so clicking anywhere else (or
    // Escape) closes it — the same rules the ⋮ on your own worlds' cards follows.
    const wasOpen = !menu.hidden;
    closeMenu();
    if (!wasOpen) { menu.hidden = false; A().setOpenWorldMenu(menu); }
  });
  menu.addEventListener("click", (e) => e.stopPropagation());
  const doRefresh = () => refreshLibraryWorld(rec.worldId);
  const doRetry = async () => {
    // The menu is gone the instant it is clicked, so the card itself has to say something is
    // happening: without this the retry is a silent multi-second nothing, and a *successful* retry
    // was indistinguishable from a dead button (the repaint only arrives when the fetch settles).
    const noteEl = card.querySelector(".ld-wnote");
    if (noteEl) noteEl.innerHTML = `<span class="ld-wnote-tx">${ICON_DOWNLOAD} Downloading…</span>`;
    const ok = await retryLibrary(rec.worldId);
    // retryLibrary emits on both outcomes, which repaints this card through refreshAddedWorlds — but
    // that only repaints the Worlds page, and this same card is also drawn on the landing's Added
    // section, so restore the note in place (from the freshly written record) as well.
    if (noteEl && noteEl.isConnected) {
      const fresh = (await getLibrary())[rec.worldId] || rec;
      const tmp = document.createElement("div");
      tmp.innerHTML = addedNoteLine(fresh, ok ? { text: "" } : null);
      const nn = tmp.firstChild;
      wireNoteClick(nn, fresh, ok ? { text: "" } : null);
      noteEl.replaceWith(nn);
    }
  };
  // The actionable footer notes (an available update, a failed download) trigger the same flows
  // as their ⋮ menu rows. Look and layout are untouched — only a pointer cursor and a click.
  const wireNoteClick = (noteEl, r, e) => {
    if (!noteEl) return;
    if (r.stale) {
      noteEl.style.cursor = "pointer";
      noteEl.setAttribute("role", "button");
      noteEl.addEventListener("click", (ev) => { ev.stopPropagation(); doRefresh(); });
    } else if (!e) {
      noteEl.style.cursor = "pointer";
      noteEl.setAttribute("role", "button");
      noteEl.addEventListener("click", (ev) => { ev.stopPropagation(); doRetry(); });
    }
  };
  wireNoteClick(card.querySelector(".ld-wnote"), rec, entry);
  const act = (name, fn) => { const b = menu.querySelector(`[data-act="${name}"]`); if (b) b.onclick = async (e) => { e.stopPropagation(); closeMenu(); await fn(); }; };
  act("retry", doRetry);
  act("refresh", doRefresh);
  act("dupe", () => duplicateLibraryWorld(rec.worldId));
  act("remove", () => removeFromLibrary(rec.worldId));
  return card;
}

/* ---------------------------------------------------------------------------
 * public API (main.js talks to this module only through `api`, and always via a
 * dynamic import so nothing here is in the boot path)
 * ------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
 * 🌐 The publish panel — Publish / Publish Changes / Published. It is the entry point behind
 * the world card's ⋮ menu's publish entry (whose label is picked by the world's state — see
 * main.js's `worldMenuCommunityEntries`) and the world editor's 🌐 Community button. It
 * figures out which flows apply to this world. Unpublishing and appealing have their own
 * entries in the ⋮ menu and their own panels, so they are not offered here.
 * ------------------------------------------------------------------------- */

export async function openCommunityMenu(metaId) {
  const fileForm = await worldStore.getRaw(metaId);
  if (!fileForm) { A().notify("✖ That world isn't in your local library."); return; }
  let link = (await getLinks())[metaId] || null;
  const name = fileForm.meta.name || metaId;

  // A listing can leave the community without this device ever unpublishing it (it was taken down
  // from another device, or the catalog lost the record), and the ⋮ menu's label for it is picked
  // from local data alone — so it may well have offered ⛔ Unpublish while the truth is that there
  // is nothing live to take down. This panel is where the player comes to fix that, so it asks the
  // catalog about our listings right here, and a world the community no longer has is folded onto
  // its link record as our own tombstone, which turns the panel below into the plain Publish one.
  // Offline, nothing changes and the local record is trusted.
  //
  // The quota rides along in the same breath: it is what the panel's own action would spend,
  // and the player should see it before they decide — so no panel in this function ever opens
  // without both answers in hand, and neither call has to be repeated once the busy overlay is up.
  const [check, quota] = await Promise.all([
    link ? checkOwnListings({ keep: true }) : Promise.resolve(null),
    readQuota({ keep: true })
  ]);
  closeSocketIfIdle();
  if (check && check.gone.length) link = (await getLinks())[metaId] || link;
  const vanished = !!(check && check.gone.indexOf(metaId) !== -1);

  // Never published, or unpublished again: one plain "Publish" panel. Nothing technical in the text —
  // the player just needs to know what publishing does and that it can be undone.
  if (!link || link.status === "removed") {
    // Which allowance would "Publish" spend? A world the community still remembers — a tombstone left
    // by an unpublish, here or elsewhere — comes back as an UPDATE (the record is revived under the
    // same worldId), while one the catalog has never heard of is published afresh. Only the catalog
    // knows which, and `check` just asked it, so the line under the button is never a guess.
    const kind = (check && check.status && check.status[metaId] === "removed") ? "update" : "publish";
    const full = quotaFull(quota, kind);
    const options = [{ label: "Cancel", value: null }];
    if (!full) options.push({ label: "Publish", value: "publish", kind: "ok" });
    // A fresh publish of a COPY of a world the community already has goes up as a remix of it,
    // so the player is told before they click — it changes what Explore shows (a ⧉ remix and the
    // original's credit). Asked only for a world with no record yet: a tombstone revive re-pushes the
    // listing as it stands, and its lineage is whatever the file already carries. Nothing here can
    // fail the panel — an unreachable community just answers "no".
    // A file that already carries `meta.remix` (the Duplicate flow, or a tombstone revive) is a
    // remix too, so it gets the same guidance even when there is no fresh origin to detect.
    const origin = !link ? await detectRemixOrigin(fileForm) : null;
    closeSocketIfIdle();
    const filedRemix = (fileForm.meta && fileForm.meta.remix) || null;
    const REMIX_GUIDE = `<span class="cc-remix-warn">⧉ A remix is not a repost! Only publish it if it's significantly different from the original. Think like musical remix.</span>`;
    let remixNote = "";
    if (origin) {
      remixNote = `<br><br>This world is a <b>remix</b> of <b>${esc(origin.title)}</b>${origin.author ? " by @" + esc(origin.author) : ""}.<br><br>${REMIX_GUIDE}`;
    } else if (filedRemix && filedRemix.worldId) {
      remixNote = `<br><br>This world is a <b>remix</b> of <b>${esc(filedRemix.name || "")}</b>${filedRemix.author ? " by @" + esc(filedRemix.author) : ""}.<br><br>${REMIX_GUIDE}`;
    }
    // An imported world didn't start here — remind the player to only share what they may share.
    const importedNote = isImportedMeta(fileForm.meta)
      ? `<br><br>${ICON_IMPORT} This is an imported world — make sure you have the right to publish it.`
      : "";
    const pick = await choosePopup({
      title: "🌐 Publish",
      message: (vanished
        ? `"<b>${esc(name)}</b>" isn't in the community any more. Publishing it again puts it back in Explore.<br><br>It's the same world people know, so everyone who already added it keeps their copy.`
        : link
          ? `Publish "<b>${esc(name)}</b>" to the community again?<br><br>Everyone who already added it keeps their copy, and it stays the same world people know.`
          : `Publish "<b>${esc(name)}</b>" to the community?<br><br>Other players will be able to find it in Explore, play it and make their own copy of it. You can unpublish it at any time.`)
        + remixNote + importedNote + quotaBlockedHtml(quota, kind) + quotaLineHtml(quota, kind),
      options
    });
    if (pick === "publish") await (link ? republishWorld(fileForm) : publishFlow(fileForm, { mode: "publish" }));
    return;
  }

  const hidden = link.hidden === true || link.status === "hidden";
  // What would publishing actually do? Worked out locally, with no network, so the panel
  // knows whether there are changes to publish before the player picks anything.
  let changes = null;
  try { changes = await detectChanges(link, fileForm); } catch (e) { changes = null; }
  const pushable = !!(changes && (changes.contentChanged || changes.listingChanged));
  // The live version, shown beside the world's name. A content push renumbers the world in the
  // community (the server bumps `version` on upload), a details-only push leaves it where it is — so
  // the panel only promises "→ next" when the world itself is what's going up.
  const ver = Number(link.version) || 1;
  const verTag = (pushable && changes.contentChanged) ? `v${ver} → v${ver + 1}` : `v${ver}`;
  // Cancel first, then this panel's own action — the same order as every other confirmation in the
  // app (ConfirmPopup is Cancel-then-confirm). Unpublishing is deliberately NOT here: it has its own
  // entry in the card's ⋮ menu and its own panel, so this panel is only ever about what publishing
  // would do.
  const options = [{ label: "Cancel", value: null }];
  // An appeal is offered only for a hide the COMMUNITY caused — a moderator's hide is that person's
  // decision to reverse (and `appealWorld` refuses it anyway). While an appeal is in flight the entry
  // says so instead of inviting a second one.
  const hiddenBy = hidden ? String(link.hiddenReason || "reports") : "";
  const appealable = hidden && hiddenBy !== "admin";
  const appealDays = appealable && Number(link.reinstatesAt) > Date.now() ? daysUntil(Number(link.reinstatesAt)) : 0;
  if (appealable) options.push({ label: appealDays ? "⚑ Appeal Pending" : "⚑ Appeal (unhide)", value: "appeal", kind: "ok" });
  // A live world's writes are always updates, so this panel — with changes waiting or without —
  // carries the update allowance. Nothing to change, nothing to spend: the quota line is
  // still shown, because it is the allowance the player's next edit would come out of.
  const updateFull = quotaFull(quota, "update");
  if (pushable && !updateFull) options.push({ label: "Publish Changes", value: "publish", kind: "ok" });
  // A live world that is itself a remix carries the same guidance: a remix is not a repost.
  const liveRemix = (fileForm.meta && fileForm.meta.remix) || null;
  const liveRemixNote = (liveRemix && liveRemix.worldId)
    ? `<br><br>This world is a <b>remix</b> of <b>${esc(liveRemix.name || "")}</b>${liveRemix.author ? " by @" + esc(liveRemix.author) : ""}.<br><br><span class="cc-remix-warn">⧉ A remix is not a repost: only publish it if it's significantly different from the original.</span>`
    : "";
  // Same imported-world reminder as the first-publish panel above.
  const liveImportedNote = isImportedMeta(fileForm.meta)
    ? `<br><br>${ICON_IMPORT} This is an imported world — make sure you have the right to publish it.`
    : "";
  const pick = await choosePopup({
    // The catalog id is deliberately not shown: it's an implementation detail, and a player knows
    // their own world by its title (which is the popup's own heading).
    title: pushable ? "🌐 Publish Changes" : "🌐 Published",
    message: `<b>${esc(name)}</b> <span class="cc-ver">${verTag}</span><br><br>`
      + (hidden
          ? (hiddenBy === "admin"
              ? "⚠️ This world is <b>hidden from Explore</b> by a moderator. Publishing changes won't put it back.<br><br>"
              : appealDays
                ? `⚠️ This world is <b>hidden from Explore</b> after player reports — your appeal is in, and it returns in ${plural(appealDays, "day")}.<br><br>`
                : "⚠️ This world is <b>hidden from Explore</b> after player reports — an appeal returns it 3 days later.<br><br>")
          : "")
      + (!changes
          ? "Couldn't check this world against the community just now. Try again in a moment."
          : pushable
            ? "You have unpublished changes. " + (changes.contentChanged
                ? "Your edits to the world itself are published, so everyone who added it can play the new version."
                : "Only the details changed, so the world itself isn't sent again.")
            : "You have no unpublished changes.")
      + liveRemixNote + liveImportedNote
      + (pushable ? quotaBlockedHtml(quota, "update") : "") + quotaLineHtml(quota, "update"),
    options
  });
  if (pick === "publish") await publishFlow(fileForm, { detected: changes });
  else if (pick === "appeal") await appealWorld(metaId);
}

export const api = {
  mountExplore,
  openCommunityMenu,
  // URL deep links (`#explore/<worldId>`): main.js resolves one to this panel, and the panel's own
  // 🔗 button (plus the Worlds ⋮ menu) makes one with `copyWorldLink`.
  openLinkedWorld,
  copyWorldLink,
  closeWorldDetail,
  getProfileUser,
  // @mention upgrade for the world detail panels' descriptions + notes (main.js's own panel
  // and Currently Playing block share it, so spaced usernames resolve the same everywhere).
  enrichMentionsHtml,
  listAuthorWorlds,
  myUserId,
  ensureIdentity,
  // Like controls for the Worlds page's own detail panel: the same capsules Explore wears, fed by
  // the same catalog record. `getWorldRecord` is the authority (links/library snapshots carry no
  // counts); `factsRowHtml` renders the whole ledger (like + downloads + copy-link) so both
  // panels can't drift; `toggleLike` flips the heart. Reader actions for added worlds live here too
  // (`reportWorldFlow`, `muteAuthor`, and the already-exported `refreshLibraryWorld`) so their
  // wording and guards exist in exactly one place.
  ensureLiked,
  toggleLike,
  factsRowHtml,
  reportWorldFlow,
  muteAuthor,
  getWorldRecord: async (worldId) => (await rpc("getWorld", { worldId: String(worldId || "") })).world,
  // Ask the community about our own listings and fold back the ones it no longer has — the Worlds
  // page runs it once per visit, so the ⋮ menus' own community labels stay truthful.
  checkOwnListings,
  closeExplore,
  addedCard,
  getCachedWorld,
  playLibraryWorld,
  retryLibrary,
  refreshLibraryWorld,
  refreshAllStaleWorlds,
  maybeAutoUpdateCheck,
  checkLibraryUpdates,
  publishFlow,
  unpublishWorld,
  republishWorld,
  // The appeal flow used by the ⋮ menu's ⚑ Appeal (unhide) entry — the entry opens this panel itself
  // rather than the publish panel.
  appealWorld,
  updateContentFromExplore,
  identitySection,
  contentSettingsSection,
  promptRestoreCreatorCode,
  // The Settings panel's Admin section (§6.16). `adminSection` draws it, `adminEnsure` is the password
  // gate the panel runs before showing it, and `adminDispose` ends the session when the panel closes.
  adminSection,
  adminEnsure,
  adminDispose,
  adminSectionClosed,
  // The admin world controls Explore draws (§6.14) — read by nothing else, exported so the console can
  // ask what the current session can do: `community.adminWorldActs(rec)`.
  adminWorldActs,
  // Identity + creator code — used by the Settings panel's Identity section (§6.16). `identity()`
  // creates one on demand (claim flow, publishing); `identityOrNull()` never does — the backup
  // export uses it so downloading a backup doesn't mint a secret for a visitor who has none yet.
  identity: () => getIdentity({ create: true }),
  identityOrNull: () => getIdentity({ create: false }),
  creatorCode: async () => {
    const id = await getIdentity({ create: false });
    return id ? creatorCode(id) : "";
  },
  restoreCreatorCode,
  readCreatorCode,
  reclaimMyWorlds,
  reclaimSingleWorld,
  linkFor: async (metaId) => (await getLinks())[metaId] || null,
  links: getLinks,
  // Diagnostics: what a push would do for one of your local worlds — the same computation the
  // 🌐 panel runs to label its button, so `await community.pendingChanges("my-world")`
  // answers "why does it want to re-upload?" without touching the catalog.
  pendingChanges: async (metaId) => {    const fileForm = await worldStore.getRaw(metaId);
    const link = (await getLinks())[metaId];
    if (!fileForm || !link) return null;
    const { contentSig, contentChanged, listingChanged } = await detectChanges(link, fileForm);
    return { contentChanged, listingChanged, contentSig, storedContentSig: link.contentSig || "", storedListingFingerprint: link.listingFingerprint || "", listingFingerprint: listingFingerprint(fileForm.meta, link) };
  },
  library: getLibrary,
  settings: getSettings,
  saveSettings,
  // Optional delegated moderation — for the owner or a volunteer they trust with the admin
  // password. `adminLogin` authorizes THIS socket connection; `adminModerate` then acts on a world.
  // Handy from the console: `await community.adminLogin("…"); await community.adminModerate("id","hide")`.
  adminLogin: (password) => rpc("authenticateAdmin", password),
  modLogin: (password) => rpc("authenticateMod", password),
  adminModerate: (worldId, action) => rpcClaiming("moderate", { worldId, action }),
  // Whether this connection is signed in as admin/mod, and a change feed for it — the chat's token
  // pip is admin-only and draws off these, appearing the moment we're in.
  isAdmin: () => adminAuthed,
  isMod: () => !!(modAuthed || adminAuthed),
  onAdminChange: (fn) => onEvent((type) => { if (type === "admin") { try { fn(); } catch (e) {} } }),
  // Same-tab reload resume (see resumeAdmin above) — main.js fires it once at boot, guarded so the
  // community module is only imported when a password was actually remembered.
  resumeAdmin,
  // Bans (server-state, mod+admin). getBans is public; audit + set/remove need mod+.
  getBans: () => rpc("getBans", {}),
  getBanAudit: (includeExpired) => rpc("getBanAudit", { includeExpired: !!includeExpired }),
  banSet: (kind, id, opts) => rpc("banSet", Object.assign({ kind, id }, opts || {})),
  banRemove: (kind, id) => rpc("banRemove", { kind, id }),
  // Permanently delete a registered identity by its userId (frees its username, unpublishes its
  // worlds). Owner-only, and requires the identity's current name as confirmation. From the console:
  // `await community.adminLogin("…"); await community.adminDeleteUser("01a2…08", "GrimTide")`.
  adminDeleteUser: (userId, confirmUsername) => rpc("deleteUser", { userId, confirmUsername })
};

// Handy for debugging from the console (`community.links()`), and for the backup module.
window.community = api;

// Tell the home shell's Worlds page to re-read the added-world library whenever it changes (add /
// remove / refresh / fork), so the `Public` source facet and the nav's count stay truthful.
onEvent((type) => {
  if (type !== "library") return;
  try { if (A().refreshAddedWorlds) A().refreshAddedWorlds(); } catch (e) {}
});

// Deferred, best-effort housekeeping: retry any queued blob deletions while still inside the
// 3-day window. Never at synchronous boot — this module is only loaded on first need.
setTimeout(() => { retryPendingDeletes().catch(() => {}); }, 1500);
