// Tavern — threaded community chat with a fully custom UI on top of
// the comments-plugin as a headless message transport.
//
// Pattern follows perchance.org/secret: one hidden plugin controller per channel
// (10px, opacity:0 — never display:none, or the plugin's IntersectionObserver lazy-load
// never fires), mounted once via `host.innerHTML = String(controller)`, driven through
// `onLoad` / `onComment` for reads and `controller.submit(text)` for writes.
//
// The hidden hosts live in a body-level div (not inside the page pane) so switching
// landing pages doesn't destroy the iframes. Message caches + controllers are
// module-level, so revisiting the page is instant.

import { chatMd } from "./rich-text.js";
import { pushBackClose } from "./back-close.js";
import { infoTipLabelHtml, hideInfoTip, initInfoTips } from "./info-tip.js";
import { switchEl, showNsfw } from "./search-bar.js";
import { tavernFabEnabled, setTavernFabEnabled } from "./app-shell.js";
import { ICON_VERIFIED, ICON_OWNER_STAR, ICON_MOD_SHIELD, ICON_BELL, ICON_EXPAND_SQ, ICON_COMPRESS_SQ, ICON_FLOAT_SQ } from "./icons.js";

// ==== OWNER-EDITABLE LISTS (edit freely — everything else below is machinery) ====
// Stickers: chibi-knight reactions + kawaii faces shipped in src/stickers (256px
// webp). A sticker is just a message whose whole body is `:name:` — add the
// file, add the name here.
const STICKERS = ["laugh", "pog", "blep", "wink", "thumbs-up", "heart-hands", "pray", "read", "sad", "panic", "stop", "would", 
  "surprised", "yes", "4k", "bonk", "bonked", "cat", "coffee", "eepy", "no", "run", "scary", "sigh",
  "sing", "wave", "angel", "ehe", "heart-eyes", "banana", "hug", "pout", "cheers", "huh", "oki", "shh",
  "angry", "bye", "grin", "peek", "jail", "knife", "sick", "up", "lmao", "fire", "water", "ded",
  "absolute-cinema", "captured", "gilded-stamp", "roar", "sus", "gun", "cuddle", "arf", "winter-watch", "wouldnt", "cookies", "delete-this",
  "pathetic", "watching", "fxxk",
  ];
const STICKER_SET = new Set(STICKERS);
// Moderator flair — PURELY VISUAL, no gating
// App userIds whose Tavern messages wear the blue name + shield
// badge, matched on the `⟦uid:…⟧` device tag.
const MOD_APP_IDS = [
  "738a6667e2b02cd9",
];
const MOD_SET = new Set(MOD_APP_IDS.map((s) => String(s || "").toLowerCase()));
// ==== end owner-editable ====

const CHANNELS = [
  { id: "guild", name: "guild", topic: "Tavern talk — anything MNO RPG Engine goes here." },
  { id: "world-craft", name: "world-craft", topic: "Making worlds — the editor, building, tips and tricks." },
  { id: "help", name: "help", topic: "Stuck? Ask here, help others." },
  { id: "share", name: "share", topic: "Show off your worlds — paste a link and it unfurls a card." },
  { id: "off-topic", name: "off-topic", topic: "Anything else you want to talk about." },
  // NSFW-gated: listed, synced and notified only while the shared Show NSFW
  // content setting is on (see visibleChannels / syncNsfwChannels).
  { id: "redacted", name: "redacted", topic: "After dark — NSFW talk goes here.", nsfw: true, sep: true },
  // bug-report + feedback ride below a separator (see paintChannels `sep`).
  { id: "bug-report", name: "bug-report", topic: "Spotted a bug? Tell us what happened and how to reproduce it.", sep: true },
  { id: "feedback", name: "feedback", topic: "Ideas, suggestions, and feedback. Keep the chatters minimum." },
];

// ---- NSFW-gated channels ----------------------------------------------------
// The `nsfw` channels above follow the shared Show NSFW content preference
// (search-bar.js — the same switch Explore uses). While it's off the channel
// is unlisted AND unmounted: no iframe, no sync, no unread, no inbox rows, no
// badge. Every CHANNELS iteration that lists, mounts, or jumps uses
// visibleChannels()/isChannelVisible() so the gate holds in one place.
function nsfwChannelsVisible() {
  try { return showNsfw(); } catch (e) { return false; }
}
function visibleChannels() {
  try { return CHANNELS.filter((c) => !c.nsfw || nsfwChannelsVisible()); } catch (e) { return CHANNELS; }
}
function isChannelVisible(id) {
  try {
    const def = CHANNELS.find((c) => c.id === id);
    if (!def) return true; // world threads etc. are unaffected
    if (!def.nsfw) return true;
    return nsfwChannelsVisible();
  } catch (e) { return true; }
}
// Stored inbox alerts survive the toggle, but hide everywhere while gated.
function alertVisible(a) {
  try {
    if (!a || typeof a.ch !== "string") return true;
    return isChannelVisible(a.ch);
  } catch (e) { return true; }
}
// Full teardown of one channel's transport + badges (no iframe, no sync, no pips).
function dropChannelBackend(id) {
  try {
    const b = backends.get(id);
    if (b && b.host) { try { b.host.remove(); } catch (e) {} }
    backends.delete(id);
  } catch (e) {}
  try { unread.delete(id); unreadReply.delete(id); } catch (e2) {}
  try { emitHot(); } catch (e3) {}
}
// Follows the Show NSFW flip both ways: off tears the gated transports down and
// parks an open gated channel back on guild; on lists them and pre-warms like
// the rest (one headless iframe each, same as boot prewarm).
function syncNsfwChannels() {
  const on = nsfwChannelsVisible();
  try {
    for (const c of CHANNELS) {
      if (!c.nsfw) continue;
      if (on) { try { ensureBackend(c.id); } catch (e) {} }
      else dropChannelBackend(c.id);
    }
  } catch (e) {}
  try { paintBell(); } catch (e2) {}
  if (!view) return;
  try {
    if (!on && view.active && !isChannelVisible(view.active)) switchChannel(CHANNELS[0].id);
    else paintChannels();
  } catch (e3) {}
  try { if (view.inbox && !view.inbox.hidden) renderInbox(); } catch (e4) {}
}

// Cold-load rendering budget: the plugin can deliver 1k+ messages on a busy
// channel, and parsing + DOM-building all of them on first open janks the
// whole panel (including the welcome nickname field). Render only the newest
// window; older messages stay in the backend map and the header button expands
// the window (fetching via the plugin only once everything loaded is shown).
const INITIAL_RENDER_LIMIT = 200;
const RENDER_GROW = 200;

// ---- comment-id ban enforcement (client-side view block) -------------------
// Ban source of truth is server state (see server-bans.js + spec). The
// plugin's `bannedUsers` transport option only refuses writes — a banned
// browser can still READ the threads. So during each panel's loading veil we
// also check the visitor's OWN transport id (`comment.user.id` on any message
// with `byCurrentUser`, same id across every channel for one browser) against
// the comment list. Match => close the panel/thread and pop a small notice.
// The same visitor is gated when EITHER their transport id OR their app
// userId is banned. Comment list stops chat; app list stops publishing
// (server) and now also gates chat + publishing UI here.
import {
  BAN_TITLE, BAN_MSG,
  normBanId, isCommentIdBanned, isAppIdBanned,
  getCommentIds, loadServerBans
} from "./server-bans.js";
// Re-exported so existing importers keep working.
export { isCommentIdBanned, isAppIdBanned };
// Own app userId (device identity, claimed or not — same value the server
// checks in index.html isAppBanned). Loaded lazily via loadClaimedName, so
// empty until the identity resolves — callers already run after it, and the
// comment-id path covers the pre-identity window.
export function isSelfAppBanned() {
  try {
    if (isAppIdBanned(deviceUserId)) return true;
    if (isAppIdBanned(claimedUserId)) return true;
  } catch (e) {}
  return false;
}
// Combined gate used by every enforcement point below: transport ban OR app ban.
export function isSelfBanned() {
  try { if (isSelfCommentBanned()) return true; } catch (e) {}
  try { if (isSelfAppBanned()) return true; } catch (e) {}
  return false;
}
const MY_CID_KEY = "mno.disc.myCommentId";
function getRememberedOwnCommentId() {
  try {
    const v = normBanId(localStorage.getItem(MY_CID_KEY) || "");
    return v || "";
  } catch (e) { return ""; }
}
function rememberOwnCommentId(id) {
  const n = normBanId(id);
  if (!n) return;
  try {
    if (localStorage.getItem(MY_CID_KEY) !== n) localStorage.setItem(MY_CID_KEY, n);
  } catch (e) {}
}
function ownTransportIdOf(comment) {
  try {
    const u = (comment && comment.user) || {};
    const raw = u.id == null ? "" : String(u.id);
    return normBanId(raw);
  } catch (e) { return ""; }
}
// Every transport id that proves to be THIS browser's: any backend message with
// `byCurrentUser`, plus the persisted one (history windows are bounded — an old
// ban-evading account's messages may have scrolled out of the loaded window).
// Scans the module backends AND the plugin's raw contexts (same data, in case a
// backend hasn't ingested yet).
function collectOwnCommentIds() {
  const out = new Set();
  try {
    const rem = getRememberedOwnCommentId();
    if (rem) out.add(rem);
  } catch (e) {}
  try {
    for (const [, b] of backends) {
      if (!b || !b.messages) continue;
      for (const [, c] of b.messages) {
        try {
          if (c && c.byCurrentUser) {
            const uid = ownTransportIdOf(c);
            if (uid) out.add(uid);
          }
        } catch (e2) {}
      }
    }
  } catch (e) {}
  try {
    const m = window.___commentsPluginIframeUniqueIdToContext;
    if (m && typeof m.values === "function") {
      for (const ctx of m.values()) {
        const arr = ctx && ctx.allComments;
        if (!arr || !arr.length) continue;
        for (const c of arr) {
          try {
            if (c && c.byCurrentUser) {
              const uid = ownTransportIdOf(c);
              if (uid) out.add(uid);
            }
          } catch (e2) {}
        }
      }
    }
  } catch (e) {}
  return [...out];
}
export function isSelfCommentBanned() {
  try {
    const ids = collectOwnCommentIds();
    for (const id of ids) if (isCommentIdBanned(id)) return true;
  } catch (e) {}
  return false;
}
function rememberOwnIdsFromList(comments) {
  if (!comments || !comments.length) return;
  try {
    for (const c of comments) {
      if (c && c.byCurrentUser) {
        const uid = ownTransportIdOf(c);
        if (uid) rememberOwnCommentId(uid);
      }
    }
  } catch (e) {}
}
// Tear down EVERY comments-plugin transport: all backend iframes, the watch
// rotation, and the unread pips. Both ban paths call this — a banned browser
// keeps no headless sync (prewarm / counts / rotation) and no open thread.
// New iframes are also refused while banned (see the ensureBackend guard),
// so this sticks until the ban entry is removed. The persisted own id keeps
// the gate closed across reloads even with zero backends mounted.
function dropAllCommentBackends() {
  try { stopWatchLoop(); } catch (e) {}
  try {
    for (const [, b] of [...backends]) {
      try { if (b && b.host) b.host.remove(); } catch (e2) {}
    }
  } catch (e) {}
  try { backends.clear(); } catch (e) {}
  try { watchHolds.clear(); } catch (e) {}
  try { watchPolled.clear(); } catch (e) {}
  try { unread.clear(); unreadReply.clear(); emitHot(); } catch (e) {}
  try {
    const root = document.getElementById("discHiddenHosts");
    if (root) root.innerHTML = "";
  } catch (e) {}
}
// Small centered notice (own overlay so it survives the panel close beneath).
// One at a time — a banned visitor opening several world threads must not stack
// popups.
let banPopupOpen = false;
function showBannedPopup(_kind) {
  if (banPopupOpen) return;
  banPopupOpen = true;
  const overlay = document.createElement("div");
  overlay.className = "popup-overlay disc-ban-overlay";
  overlay.innerHTML = `
    <div class="popup confirm-pop">
      <div class="popup-head"><span class="popup-title">${BAN_TITLE}</span><button class="popup-x" type="button" title="Close" aria-label="Close">✕</button></div>
      <div class="confirm-msg">${BAN_MSG}</div>
      <div class="popup-acts">
        <button class="mini ok disc-ban-ok">OK</button>
      </div>
    </div>`;
  let release = null;
  const done = () => {
    try { if (release) release(); else if (release !== null) {} } catch (e) {}
    try { overlay.remove(); } catch (e) {}
    banPopupOpen = false;
  };
  try { release = pushBackClose(() => done()); } catch (e) { release = null; }
  try { overlay.querySelector(".popup-x").onclick = done; } catch (e) {}
  try { overlay.querySelector(".disc-ban-ok").onclick = done; } catch (e) {}
  try { overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) done(); }); } catch (e) {}
  try { overlay.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); done(); } }); } catch (e) {}
  try { document.body.appendChild(overlay); } catch (e) { banPopupOpen = false; return; }
  try { overlay.querySelector(".disc-ban-ok").focus(); } catch (e) {}
}
// Tavern: called during the loading veil (and on every later backend load while
// the panel stands). Returns true when it closed the panel.
function maybeEnforceTavernBan() {
  try {
    if (!panel) return false;
    if (!isSelfBanned()) return false;
  } catch (e) { return false; }
  try { dropAllCommentBackends(); } catch (e) {}
  try { closeDiscussionPanel(); } catch (e) {}
  setTimeout(() => { try { showBannedPopup("tavern"); } catch (e) {} }, 60);
  return true;
}
// World thread: swap the open thread(s) on this channel for a banned notice and
// pop the small panel. Returns true when at least one thread was gated.
function maybeEnforceWorldBan(channelId) {
  let gated = false;
  try {
    if (!isSelfBanned()) return false;
  } catch (e) { return false; }
  // All transports go — including this channel's — before painting, so no
  // iframe keeps syncing behind the notice.
  try { dropAllCommentBackends(); } catch (e) {}
  try {
    const set = worldViews.get(channelId);
    if (!set || !set.size) return false;
    for (const wv of [...set]) {
      try { paintWorldBanned(wv); gated = true; } catch (e) {}
    }
  } catch (e) {}
  if (gated) setTimeout(() => { try { showBannedPopup("world"); } catch (e) {} }, 60);
  return gated;
}
function paintWorldBanned(wv) {
  if (!wv || !wv.root) return;
  try { wv.banned = true; } catch (e) {}
  try {
    if (wv.msgs) { wv.msgs.innerHTML = ""; try { wv.msgs.style.display = "none"; } catch (e2) {} }
  } catch (e) {}
  try {
    if (wv.status) {
      wv.status.hidden = false;
      wv.status.className = "disc-status is-err";
      wv.status.textContent = BAN_MSG;
    }
  } catch (e) {}
  try { if (wv.err) wv.err.hidden = true; } catch (e) {}
  try { if (wv.replybar) wv.replybar.hidden = true; } catch (e) {}
  try { if (wv.composer) wv.composer.style.display = "none"; } catch (e) {}
  try { if (wv.retry) wv.retry.hidden = true; } catch (e) {}
  try { if (wv.onCount) wv.onCount(-1); } catch (e) {}
}

// ---- per-world comments ---------------------------------------------------
// One comments-plugin channel per published world: `wd-<worldId>` (never
// collides with Tavern channels — none start with `wd-`, and `world-craft`
// is distinct from `wd-craft`). Same transport + same renderer as the Tavern,
// mounted inside the Explore detail panel. Watched world threads notify through
// the shared bell/inbox/toast (see the watch list below); unwatched ones stay
// silent.
const WORLD_CH_PREFIX = "wd-";
// Two notification prefs (migrated from the old single bell): replies/@mentions
// (sound + popup) and every-new-message (popup). Either one keeps background
// sync running; the gold badge tracks arrivals regardless of both.
const NOTIFY_REPLY_KEY = "mno.disc.notifyReply";
const NOTIFY_ALL_KEY = "mno.disc.notifyAll";
// World-comments master toggle (default off): your published worlds alert on every
// new comment, threads you joined alert on replies/@mentions to you. Gated the
// same way as the Tavern toggles — rotation runs only while this is on.
const NOTIFY_WD_KEY = "mno.disc.notifyWd";
let notifyWdOn = false;
let notifyReplyOn = false;
let notifyAllOn = false;
const WORLD_RENDER_LIMIT = 50;
const worldTitles = new Map(); // channelId -> world title (for toasts/inbox)
const worldViews = new Map(); // channelId -> Set<wv> (open detail threads)
// Persisted vertical size of the per-world comments panel (the panel's
// `resize: vertical` drag handle writes inline heights; this keeps the choice
// across tabs/panels instead of resetting to the default each mount).
const WD_COMMENTS_H_KEY = "mno.wdCommentsHeight";
const WD_COMMENTS_H_MIN = 170;
const WD_COMMENTS_H_MAX = 800;
function readWdCommentsHeight() {
  try {
    const n = parseInt(localStorage.getItem(WD_COMMENTS_H_KEY) || "", 10);
    if (Number.isFinite(n)) return Math.min(WD_COMMENTS_H_MAX, Math.max(WD_COMMENTS_H_MIN, n));
  } catch (e) {}
  return 0;
}
function saveWdCommentsHeight(h) {
  try {
    const n = Math.round(Number(h) || 0);
    if (!Number.isFinite(n)) return;
    localStorage.setItem(WD_COMMENTS_H_KEY, String(Math.min(WD_COMMENTS_H_MAX, Math.max(WD_COMMENTS_H_MIN, n))));
  } catch (e) {}
}
function worldChannelFor(worldId) {
  const slug = String(worldId || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) return null;
  return WORLD_CH_PREFIX + slug;
}
function isWorldChannel(channelId) {
  if (typeof channelId !== "string" || !channelId.startsWith(WORLD_CH_PREFIX)) return false;
  try { if (CHANNELS.some((c) => c.id === channelId)) return false; } catch (e) {}
  return /^[a-z0-9][a-z0-9-]*$/.test(channelId.slice(WORLD_CH_PREFIX.length));
}
function worldIdFromChannel(channelId) {
  if (!isWorldChannel(channelId)) return "";
  return channelId.slice(WORLD_CH_PREFIX.length);
}
function worldDisplayName(channelId) {
  try {
    const t = worldTitles.get(channelId);
    if (t) return String(t).slice(0, 60);
  } catch (e) {}
  const wid = worldIdFromChannel(channelId);
  if (wid) return `world ${wid}`;
  return String(channelId || "");
}
export function setWorldTitle(worldId, title) {
  try {
    const ch = worldChannelFor(worldId);
    if (ch && title) worldTitles.set(ch, String(title).slice(0, 80));
  } catch (e) {}
}
// ---- watched worlds (comment notifications) --------------------------------
// Implicit watch list, no manual watch/unwatch UI (the master toggle below is the
// off-ramp, and unpublished worlds auto-leave). Your published worlds watch in
// mode "all" (every new comment alerts); worlds you commented in watch in mode
// "mentions" (only replies to you and @mentions alert, same footing as the
// Tavern). Persisted as worldId -> { t, m, subAt }; channels derive
// deterministically from the id, so the reverse map rebuilds on load. (Slugs
// are one-way — the real worldId is stored here, never re-derived.)
const WATCH_KEY = "mno.disc.watch";
const WATCH_MAX = 200;
let watchMap = null; // worldId -> { t: title, m: "all"|"mentions", subAt }
let watchChMap = null; // channelId -> worldId
function loadWatch() {
  if (watchMap) return watchMap;
  watchMap = {}; watchChMap = new Map();
  try {
    const o = JSON.parse(localStorage.getItem(WATCH_KEY) || "{}") || {};
    for (const k of Object.keys(o)) {
      const e = o[k];
      if (!e || (e.m !== "all" && e.m !== "mentions")) continue;
      const wid = String(k).slice(0, 80);
      const ch = worldChannelFor(wid);
      if (!ch) continue;
      watchMap[wid] = { t: String(e.t || "").slice(0, 80), m: e.m, subAt: Number(e.subAt) || 0 };
      watchChMap.set(ch, wid);
    }
  } catch (e) {}
  return watchMap;
}
function saveWatch() {
  try { localStorage.setItem(WATCH_KEY, JSON.stringify(watchMap || {})); } catch (e) {}
}
function watchModeForChannel(channelId) {
  try {
    loadWatch();
    const wid = watchChMap.get(channelId);
    if (!wid) return null;
    const e = watchMap[wid];
    return e ? e.m : null;
  } catch (e2) { return null; }
}
function watchMetaForChannel(channelId) {
  try {
    loadWatch();
    const wid = watchChMap.get(channelId);
    if (!wid || !watchMap[wid]) return null;
    return { wid, wt: watchMap[wid].t || "", mode: watchMap[wid].m };
  } catch (e) { return null; }
}
// Insert or upgrade a watch. Never downgrades "all" (your world stays fully
// watched even after you comment in it), and baselines the channel silently —
// history already on screen is context, not news.
function putWatch(wid, title, mode) {
  wid = String(wid || "");
  if (!wid) return false;
  const ch = worldChannelFor(wid);
  if (!ch) return false;
  loadWatch();
  const prev = watchMap[wid];
  const t = String(title || (prev && prev.t) || "").slice(0, 80);
  if (prev && prev.m === "all") {
    if (t !== prev.t) { prev.t = t; saveWatch(); }
    return false;
  }
  if (prev && prev.m === mode && t === prev.t) return false;
  watchMap[wid] = { t, m: mode, subAt: (prev && prev.subAt) || Date.now() };
  watchChMap.set(ch, wid);
  try { touchSeen(ch); } catch (e) {}
  // Bound the list: threads you joined leave oldest-first; own worlds never do.
  try {
    let ids = Object.keys(watchMap);
    if (ids.length > WATCH_MAX) {
      ids.sort((a, b) => (watchMap[a].subAt || 0) - (watchMap[b].subAt || 0));
      for (const id of ids) {
        if (Object.keys(watchMap).length <= WATCH_MAX) break;
        if (watchMap[id].m === "all") continue;
        try { releaseWatchHold(worldChannelFor(id)); } catch (e2) {}
        try { watchChMap.delete(worldChannelFor(id)); } catch (e3) {}
        delete watchMap[id];
      }
      ids = Object.keys(watchMap);
      if (ids.length > WATCH_MAX) {
        ids.sort((a, b) => (watchMap[a].subAt || 0) - (watchMap[b].subAt || 0));
        for (const id of ids) {
          if (Object.keys(watchMap).length <= WATCH_MAX) break;
          try { releaseWatchHold(worldChannelFor(id)); } catch (e4) {}
          try { watchChMap.delete(worldChannelFor(id)); } catch (e5) {}
          delete watchMap[id];
        }
      }
    }
  } catch (e6) {}
  saveWatch();
  return true;
}
export function watchOwnWorld(worldId, title) { return putWatch(worldId, title, "all"); }
export function unwatchWorld(worldId) {
  const wid = String(worldId || "");
  if (!wid) return false;
  loadWatch();
  if (!watchMap[wid]) return false;
  try { releaseWatchHold(worldChannelFor(wid)); } catch (e) {}
  try { watchChMap.delete(worldChannelFor(wid)); } catch (e2) {}
  delete watchMap[wid];
  saveWatch();
  return true;
}
// A comment you just posted subscribes the thread: fully when it's your world,
// replies-and-mentions when it's someone else's (never downgrades your own).
export function noteWorldComment(worldId, title, isOwn) { return putWatch(worldId, title, isOwn ? "all" : "mentions"); }
export function listWatchedWorlds() {
  loadWatch();
  return Object.keys(watchMap).map((wid) => ({ worldId: wid, title: watchMap[wid].t, mode: watchMap[wid].m, subAt: watchMap[wid].subAt }));
}
// Rotation: at most a few watch backends (hidden iframes — the scarce resource)
// stay mounted while a slow tick cycles the whole watch list through them. A
// mounted thread owns its backend, so rotation never evicts from under an open
// panel. Everything here is gated on the World-comments toggle.
const WATCH_SLOTS = 3;
const WATCH_DWELL_MS = 60000;
const WATCH_TICK_MS = 20000;
const watchHolds = new Map(); // channelId -> heldAt
const watchPolled = new Map(); // channelId -> last hold start (fairness order)
let watchTimer = 0;
let watchBackfillDone = false;
function holdWatchChannel(ch) {
  try { if (isSelfBanned()) return false; } catch (e) {}
  try { ensureBackend(ch); } catch (e) { return false; }
  const now = Date.now();
  watchHolds.set(ch, now);
  watchPolled.set(ch, now);
  return true;
}
function releaseWatchHold(ch) {
  if (!ch || !watchHolds.has(ch)) return;
  watchHolds.delete(ch);
  try {
    const b = backends.get(ch);
    if (b && !b.loaded && !b.failed) {
      // Still initializing: yanking the iframe mid-load races the embed's own
      // setup (contentWindow errors). Reap it once it settles instead.
      const reap = (tries) => {
        try {
          const b2 = backends.get(ch);
          if (b2 && !b2.loaded && !b2.failed && tries > 0) {
            setTimeout(() => reap(tries - 1), 30000);
            return;
          }
        } catch (e3) {}
        try { maybeDropBackend(ch); } catch (e) {}
      };
      setTimeout(() => reap(1), 30000);
      return;
    }
  } catch (e2) {}
  try { maybeDropBackend(ch); } catch (e) {}
}
function watchTick() {
  if (!notifyWdOn) { stopWatchLoop(); return; }
  try { if (isSelfBanned()) { stopWatchLoop(); return; } } catch (e) {}
  if (!watchBackfillDone) { try { void backfillOwnWatches(); } catch (e) {} }
  loadWatch();
  const now = Date.now();
  for (const [ch, at] of [...watchHolds]) {
    if (now - at <= WATCH_DWELL_MS) continue;
    try { const s = worldViews.get(ch); if (s && s.size) { watchHolds.set(ch, now); continue; } } catch (e) {}
    releaseWatchHold(ch);
  }
  const ids = Object.keys(watchMap).sort((a, b) => {
    let ca = 0, cb = 0;
    try { ca = watchPolled.get(worldChannelFor(a)) || 0; } catch (e) {}
    try { cb = watchPolled.get(worldChannelFor(b)) || 0; } catch (e2) {}
    return ca - cb;
  });
  for (const wid of ids) {
    if (watchHolds.size >= WATCH_SLOTS) break;
    let ch = null;
    try { ch = worldChannelFor(wid); } catch (e) {}
    if (!ch || watchHolds.has(ch)) continue;
    try { const s = worldViews.get(ch); if (s && s.size) continue; } catch (e2) {}
    holdWatchChannel(ch);
  }
}
function ensureWatchLoop() {
  if (watchTimer || !notifyWdOn) return;
  try { if (isSelfBanned()) return; } catch (e) {}
  watchTimer = setInterval(() => { try { watchTick(); } catch (e) {} }, WATCH_TICK_MS);
  try { watchTick(); } catch (e) {}
}
function stopWatchLoop() {
  if (watchTimer) { try { clearInterval(watchTimer); } catch (e) {} watchTimer = 0; }
  for (const ch of [...watchHolds.keys()]) releaseWatchHold(ch);
}
// One-time backfill of your already-published worlds (silent baselines — their
// existing comments are history, not news). Retried each tick until the
// identity store answers.
async function backfillOwnWatches() {
  if (watchBackfillDone) return;
  let r = null;
  try {
    const m = await import("./community.js");
    r = m && m.listOwnPublishedWorlds ? await m.listOwnPublishedWorlds() : null;
  } catch (e) { r = null; }
  if (!r || !r.ready) return;
  watchBackfillDone = true;
  try {
    for (const it of (r.items || [])) {
      if (it && it.worldId) putWatch(it.worldId, it.title || "", "all");
    }
  } catch (e2) {}
}
function maybeDropBackend(channelId, mineHint) {
  try {
    const set = worldViews.get(channelId);
    if (set && set.size) return false;
    const subs = countSubs.get(channelId);
    if (subs && subs.size) return false;
    // Rotation-held watch channels stay mounted until their dwell expires.
    try { if (watchHolds.has(channelId)) return false; } catch (e) {}
    const bb = backends.get(channelId);
    if (bb) {
      try { bb.host && bb.host.remove(); } catch (e) {}
      backends.delete(channelId);
    }
    try { unread.delete(channelId); unreadReply.delete(channelId); emitHot(); } catch (e2) {}
    return true;
  } catch (e3) { return false; }
}
// Live comment counts without a mounted thread: the popularity ledger's 💬
// capsule subscribes, gets the current value (or -1 while unknown) plus every
// later change, and unsubscribing drops the prefetch backend when nothing else
// needs it. Backends emit on every ingest path (see onLoad/onLoadMore/liveComment).
const countSubs = new Map(); // channelId -> Set<{cb, mine}>
export function worldCommentCount(worldId) {
  const ch = worldChannelFor(worldId);
  if (!ch) return -1;
  const b = backends.get(ch);
  return (b && b.loaded) ? b.order.length : -1;
}
export function subscribeWorldCount(worldId, cb, opts) {
  const ch = worldChannelFor(worldId);
  if (!ch || typeof cb !== "function") return () => {};
  const mine = !!(opts && opts.mine);
  let set = countSubs.get(ch);
  if (!set) { set = new Set(); countSubs.set(ch, set); }
  const entry = { cb, mine };
  set.add(entry);
  try { cb(worldCommentCount(worldId)); } catch (e) {}
  try { ensureBackend(ch); } catch (e2) {}
  // Already-loaded backends (watched/prewarmed) answer synchronously above;
  // re-report after the ensure so a just-created backend's state wins.
  try { cb(worldCommentCount(worldId)); } catch (e3) {}
  return () => {
    try {
      set.delete(entry);
      if (!set.size) countSubs.delete(ch);
    } catch (e4) {}
    try { maybeDropBackend(ch, mine); } catch (e5) {}
  };
}
function emitWorldCount(channelId) {
  try {
    const set = countSubs.get(channelId);
    if (!set || !set.size) return;
    const b = backends.get(channelId);
    const n = (b && b.loaded) ? b.order.length : -1;
    for (const entry of [...set]) { try { entry.cb(n); } catch (e) {} }
  } catch (e2) {}
}
const NICK_KEY = "mno.disc.nick";
const LAST_CHANNEL_KEY = "mno.disc.channel";
const NOTIFY_KEY = "mno.disc.notify";
// Nickname info-tip, the single source for what the name is and which characters it
// takes. The claimed suffix is appended while an identity locks the field (see
// applyClaimedNick) — no separate note line.
const NICK_TIP_BASE = "The name shown next to your messages on this device.";
const DINGED_KEY = "mno.disc.dingedIds";
const OWN_KEY = "mno.disc.ownIds";
const LAST_SEEN_KEY = "mno.disc.lastSeen";
const ALERTS_KEY = "mno.disc.alerts";
const MAX_ALERTS = 100;

// Own-message ids per channel (persisted): backs isReplyToMe when the target isn't in the
// loaded batch (the plugin only delivers the latest window — an older message you wrote can
// fall outside it while a fresh reply to it arrives) or when byCurrentUser is stale on it.
// Only ever filled from your own messages (same connection, or — when claimed — your
// verified username + uid tag, so your other devices count too); a forged nickname on
// another device can never land here without your uid tag.
const ownIds = new Map();
try {
  const raw = localStorage.getItem(OWN_KEY);
  if (raw) {
    const o = JSON.parse(raw);
    for (const k of Object.keys(o || {})) ownIds.set(k, new Set((o[k] || []).map(String)));
  }
} catch (e) {}
function saveOwnIds() {
  try {
    const o = {};
    for (const [k, set] of ownIds) o[k] = [...set].slice(-200);
    localStorage.setItem(OWN_KEY, JSON.stringify(o));
  } catch (e) {}
}
// Identity lands after messages (async import): rescan everything loaded so far for
// your verified messages from other devices, so replies to them highlight even when
// their targets later fall outside the loaded window. Cheap — runs once per identity.
function backfillOwnIds() {
  if (!claimedName) return;
  let changed = false;
  try {
    for (const [channelId, b] of backends) {
      if (!b || !b.messages) continue;
      for (const [id, c] of b.messages) {
        try {
          if (!c || c.byCurrentUser) continue;
          if (!isMine(c)) continue;
          let set = ownIds.get(channelId);
          if (!set) { set = new Set(); ownIds.set(channelId, set); }
          if (!set.has(String(id))) { set.add(String(id)); changed = true; }
        } catch (e) {}
      }
      // Prune entries another identity earned while the network-based plugin flag
      // was trusted on its own (same-household WiFi): a stored id whose message is
      // loaded but no longer counts as mine must stop attracting highlights.
      try {
        const set = ownIds.get(channelId);
        if (set && set.size) {
          for (const sid of [...set]) {
            const m = b.messages.get(sid);
            if (m && !isMine(m)) { set.delete(sid); changed = true; }
          }
          if (!set.size) ownIds.delete(channelId);
        }
      } catch (e) {}
    }
  } catch (e) {}
  if (changed) saveOwnIds();
}

// Replies are a machine-readable header every client here writes and reads
// (`⟦reply:<commentId>⟧ body`): the plugin's programmatic submit has no option for its
// native `replyingTo`, so native thread chrome can't be sent from here — but onComment /
// onLoad DO report native `replyingTo`, and the embed's own "ding when someone replies
// to me" is mirrored here (toast + ding + browser Notification) off the header instead.
const REPLY_RE = /^⟦reply:([^⟧]+)⟧\s?/;
const EXCERPT_LEN = 140;

// (STICKERS + STICKER_SET live at the top of this file — see OWNER-EDITABLE LISTS.)
// A message body that IS a sticker (after the reply header is stripped) → its name,
// or null. The whole body must be one `:name:` token (case-insensitive), and the
// name must be in the shipped set — message content is never trusted.
function stickerOf(text) {
  const m = /^:([a-z0-9-]+):$/i.exec(String(text == null ? "" : text).trim());
  const name = m && String(m[1]).toLowerCase();
  return name && STICKER_SET.has(name) ? name : null;
}
// Emoji-only bodies render jumbo (chat-app style). Strip every emoji-capable cluster
// piece — pictographs, regional indicators (flags), keycaps, common symbol emoji, plus
// the glue (ZWJ, variation selectors, skin tones) — and whitespace; anything left means
// it isn't emoji-only. Bare digits/#/* don't match (the keycap branch needs ⃣), and the
// headers are already stripped by the caller, so a reply + emoji still counts.
const EMOJI_STRIP_RE = new RegExp(
  "\\p{Extended_Pictographic}|\\p{Regional_Indicator}|[#*0-9]\\uFE0F?\\u20E3" +
  "|[\\u00A9\\u00AE\\u203C\\u2049\\u2122\\u2139\\u2194-\\u2199\\u21A9\\u21AA\\u231A\\u231B" +
  "\\u2328\\u23CF\\u23E9-\\u23F3\\u23F8-\\u23FA\\u24C2\\u25AA\\u25AB\\u25B6\\u25C0" +
  "\\u25FB-\\u25FE\\u2600-\\u27BF\\u2B05-\\u2B07\\u2B1B\\u2B1C\\u2B50\\u2B55\\u2934\\u2935]" +
  "|\\u200D|[\\uFE0E\\uFE0F]|[\\u{1F3FB}-\\u{1F3FF}]",
  "gu"
);
function isEmojiOnly(text) {
  const t = String(text == null ? "" : text);
  if (!t.trim()) return false;
  return t.replace(EMOJI_STRIP_RE, "").replace(/\s/g, "") === "";
}

// channelId -> { controller, host, loaded, failed, messages: Map<id, comment>, order: [ids] }
const backends = new Map();
// channelId -> unread count (messages that arrived while another channel was open)
const unread = new Map();
// channelId -> unread count of those that reply to you (subset of unread — gold badge)
const unreadReply = new Map();
// Hot-unread subscribers: the app's own chrome (home-nav row, Main Menu cell, floating
// button) wears a pip when replies/@mentions wait, even with the panel closed. Backends
// live in this module whether the panel stands open or not, so the count is right
// whenever any channel has synced at least once (before the first sync it is 0).
const hotListeners = new Set();
export function hotUnreadCount() {
  let n = 0;
  try { for (const v of unreadReply.values()) n += v || 0; } catch (e) {}
  return n;
}
export function onHotUnread(fn) {
  if (typeof fn === "function") hotListeners.add(fn);
  return () => { try { hotListeners.delete(fn); } catch (e) {} };
}
function emitHot() {
  const n = hotUnreadCount();
  for (const fn of [...hotListeners]) { try { fn(n); } catch (e) {} }
}
// ---- reply/mention inbox ----------------------------------------------------
// Unread badges used to die on reload (unread/unreadReply are memory-only and only
// live arrivals bump them). Two small persisted stores fix that with no new
// transport, polling, or timers:
// - lastSeen: per-channel timestamps. Memory-first (live views update the map);
//   storage flushes on channel switch and panel close — never per message. A full
//   history load badges anything newer that is a reply to you or an @-mention.
//   First sync seeds instead of flooding: history is context, not news.
// - alerts: the inbox itself — newest-first, capped, persisted. Live arrivals add
//   while you look elsewhere; the catch-up pass adds silently (no ding/toast).
//   Entries clear only via Clear-all (or cap eviction): opening a row jumps to
//   the message but keeps the entry. Scans are O(loaded window) on full loads
//   only; per-message cost is one Map set.
const lastSeenMem = new Map();
let lastSeenLoaded = false;
let lastSeenDirty = false;
function loadLastSeen() {
  if (lastSeenLoaded) return;
  lastSeenLoaded = true;
  try {
    const o = JSON.parse(localStorage.getItem(LAST_SEEN_KEY) || "{}") || {};
    for (const k of Object.keys(o)) {
      const t = Number(o[k]);
      if (k && Number.isFinite(t) && t > 0) lastSeenMem.set(k, t);
    }
  } catch (e) {}
}
function flushLastSeen() {
  if (!lastSeenDirty) return;
  lastSeenDirty = false;
  try {
    const o = {};
    for (const [k, t] of lastSeenMem) o[k] = t;
    localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(o));
  } catch (e) {}
}
// Viewing = seen (the messages are on screen).
function touchSeen(channelId) {
  loadLastSeen();
  const now = Date.now();
  if ((lastSeenMem.get(channelId) || 0) < now) { lastSeenMem.set(channelId, now); lastSeenDirty = true; }
  flushLastSeen();
}
// Live arrivals on the open channel are seen too — memory only, flushed later
// (per-message storage writes would churn on busy channels).
function noteSeenLive(channelId, ts) {
  loadLastSeen();
  const t = Number(ts) || Date.now();
  if ((lastSeenMem.get(channelId) || 0) < t) { lastSeenMem.set(channelId, t); lastSeenDirty = true; }
}
let alerts = [];
const alertIds = new Set();
let alertsLoaded = false;
// Bell badge = unread inbox count (clears on open, restarts at 1 on next alert).
// Persisted separately from the inbox list so the rows survive the badge clearing.
const BELL_UNREAD_KEY = "mno.disc.bellUnread";
let bellUnread = 0;
let bellUnreadLoaded = false;
function loadBellUnread() {
  if (bellUnreadLoaded) return;
  bellUnreadLoaded = true;
  loadAlerts();
  try {
    const raw = localStorage.getItem(BELL_UNREAD_KEY);
    if (raw == null) bellUnread = alerts.length; // migrate: old badge was the whole list
    else bellUnread = Math.max(0, Math.min(alerts.length, parseInt(raw, 10) || 0));
  } catch (e) { bellUnread = alerts.length; }
}
function saveBellUnread() {
  try { localStorage.setItem(BELL_UNREAD_KEY, String(bellUnread)); } catch (e) {}
}
function loadAlerts() {
  if (alertsLoaded) return;
  alertsLoaded = true;
  try {
    const arr = JSON.parse(localStorage.getItem(ALERTS_KEY) || "[]");
    if (Array.isArray(arr)) {
      for (const a of arr) {
        if (!a || typeof a.ch !== "string" || typeof a.id !== "string" || !a.id) continue;
        const kind = a.kind === "mention" ? "mention" : a.kind === "world" ? "world" : "reply";
        if (alertIds.has(a.id)) continue;
        alertIds.add(a.id);
        const entry = { ch: a.ch, id: a.id, by: String(a.by || "anon").slice(0, 40), text: String(a.text || "").slice(0, 200), ts: Number(a.ts) || 0, kind };
        if (kind === "world") { entry.wid = String(a.wid || ""); entry.wt = String(a.wt || "").slice(0, 80); }
        alerts.push(entry);
        if (alerts.length >= MAX_ALERTS) break;
      }
    }
    // Stored order used to follow channel load-completion, not time — repair it.
    try { alerts.sort((x, y) => y.ts - x.ts); } catch (e2) {}
  } catch (e) { alerts = []; alertIds.clear(); }
}
function saveAlerts() {
  try { localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts.slice(0, MAX_ALERTS))); } catch (e) {}
}
// Which half (if any) a comment qualifies for. Same notify-worthy test the live
// badges use — own messages never qualify.
function alertKindOf(channelId, comment) {
  if (!comment || isMine(comment)) return null;
  if (isReplyToMeFromOther(channelId, comment)) return "reply";
  if (mentionsMe(comment)) return "mention";
  return null;
}
// Newest-first insert with dedup + cap. No persistence here — callers batch it
// (rare event anyway: only your own replies/mentions, never per-message).
function pushAlert(channelId, comment, kind, meta) {
  loadAlerts();
  const id = commentId(comment, "");
  if (!id || alertIds.has(id)) return false;
  alertIds.add(id);
  const wk = kind === "world" ? "world" : kind === "mention" ? "mention" : "reply";
  const entry = { ch: channelId, id, by: commentAuthor(comment) || "anon", text: excerptOf(comment, 80) || "(empty message)", ts: commentTime(comment) || Date.now(), kind: wk };
  if (wk === "world") {
    entry.wid = (meta && meta.wid) || "";
    entry.wt = (meta && meta.wt) || "";
    // Toasts and inbox rows name the world by its real title, not the channel slug.
    if (entry.wt) { try { worldTitles.set(channelId, entry.wt); } catch (e) {} }
  }
  // Newest-first insert: cross-channel catch-up finishes staggered, so a plain
  // unshift would group rows by channel instead of time (and evict the wrong
  // end when the cap bites).
  let at = 0;
  while (at < alerts.length && alerts[at].ts >= entry.ts) at++;
  alerts.splice(at, 0, entry);
  if (alerts.length > MAX_ALERTS) { const drop = alerts.pop(); if (drop) alertIds.delete(drop.id); }
  return true;
}
function addAlert(channelId, comment, kind, meta) {
  if (!pushAlert(channelId, comment, kind, meta)) return;
  loadBellUnread();
  bellUnread = Math.min(alerts.length, bellUnread + 1);
  saveAlerts();
  saveBellUnread();
  paintBell();
  if (view && view.inbox && !view.inbox.hidden) { try { renderInbox(); } catch (e) {} }
}
// Watch-list qualification for a world comment: own worlds alert on every new
// comment; threads you joined alert on replies to you and @mentions only (same
// footing as the Tavern). Your own messages never qualify.
function watchAlertKind(channelId, comment) {
  if (!comment || isMine(comment)) return null;
  const mode = watchModeForChannel(channelId);
  if (!mode) return null;
  if (mode === "all") return "world";
  if (isReplyToMeFromOther(channelId, comment)) return "reply";
  if (mentionsMe(comment)) return "mention";
  return null;
}
// Record a qualifying watched-world arrival in the inbox (the record — the bell
// follows it). Ding/toast stay with the live path (maybeNotify), never catch-up.
function addWorldAlert(channelId, comment) {
  const kind = watchAlertKind(channelId, comment);
  if (!kind) return false;
  addAlert(channelId, comment, kind, watchMetaForChannel(channelId));
  return true;
}
// Catch-up: after a full history load, badge what arrived since you last looked.
// Silent (no ding/toast — those are for live arrivals); the inbox carries it.
// Full loads only — backfill pages ("load more") are older by definition.
function catchUpAlerts(channelId, opts) {
  const b = backends.get(channelId);
  if (!b || !b.order.length) return;
  // Unwatched world threads never alert; watched ones badge through the same
  // silent path (rotation polls land here — ding/toast stay live-only).
  const watching = isWorldChannel(channelId) ? watchModeForChannel(channelId) : "";
  if (isWorldChannel(channelId) && !watching) return;
  if (!myNick() && !hasOwnIds()) return; // nothing can qualify without an identity
  loadLastSeen();
  loadAlerts();
  // A backfill chain passes its frozen baseline plus the span it fetched (the
  // cold-load window then needs no scan of its own — the chain took over).
  const onlyIds = opts && opts.onlyIds;
  const skipPips = !!(opts && opts.noUnread);
  const seen = (opts && opts.since != null) ? opts.since : lastSeenMem.get(channelId);
  if (seen == null) {
    let newest = 0;
    for (const id of b.order) {
      const t = commentTime(b.messages.get(id));
      if (t > newest) newest = t;
    }
    lastSeenMem.set(channelId, newest || Date.now());
    lastSeenDirty = true; flushLastSeen();
    return;
  }
  let added = 0;
  for (const id of b.order) {
    if (onlyIds && !onlyIds.has(id)) continue;
    if (alertIds.has(id)) continue;
    const c = b.messages.get(id);
    if (!c) continue;
    if (!(commentTime(c) > seen)) continue;
    const kind = isWorldChannel(channelId) ? watchAlertKind(channelId, c) : alertKindOf(channelId, c);
    if (!kind) continue;
    // The identity rescan (noUnread) records inbox + bell only — channel pips
    // were already settled by the live path meanwhile, so they stay untouched.
    if (!skipPips) {
      unread.set(channelId, (unread.get(channelId) || 0) + 1);
      unreadReply.set(channelId, (unreadReply.get(channelId) || 0) + 1);
    }
    if (pushAlert(channelId, c, kind, isWorldChannel(channelId) ? watchMetaForChannel(channelId) : null)) added++;
  }
  if (added) { loadBellUnread(); bellUnread = Math.min(alerts.length, bellUnread + added); saveAlerts(); saveBellUnread(); paintBell(); emitHot(); }
}
// Catch-up backfill page budget: each extra page is ~200 older messages fetched
// render-free (fetchManual=false, so the visible window never widens and nothing
// parses). Same spend class as one ghost-reply backfill chain.
const CATCHUP_BACKFILL_PAGES = 6;
// Oldest message time currently held for the channel (b.order is time-sorted),
// or null when nothing is held yet.
function oldestLoadedTime(channelId) {
  const b = backends.get(channelId);
  if (!b || !b.order.length) return null;
  try {
    let t = Infinity;
    for (const id of b.order) {
      const c = b.messages.get(id);
      const ts = c ? commentTime(c) : 0;
      if (ts && ts < t) t = ts;
    }
    return t === Infinity ? null : t;
  } catch (e) { return null; }
}
// Frozen baseline for a backfill chain, or null when no chain is needed: no
// identity (nothing can qualify), unwatched world thread (never alerts), first
// sighting (baseline path — older history predates you by definition), or the
// loaded window already reaching back past your last sighting.
function catchupBaseline(channelId) {
  try {
    if (!myNick() && !hasOwnIds()) return null;
    const watching = isWorldChannel(channelId) ? watchModeForChannel(channelId) : "";
    if (isWorldChannel(channelId) && !watching) return null;
    loadLastSeen();
    const seen = lastSeenMem.get(channelId);
    if (seen == null) return null;
    const oldest = oldestLoadedTime(channelId);
    if (oldest == null || !(oldest > seen)) return null;
    return seen;
  } catch (e) { return null; }
}
// Returns true when a backfill chain is now in flight (the chain-end scan covers
// only the fetched span — the cold-load window was already scanned by the
// immediate catch-up, so nothing is ever double-counted).
function maybeStartCatchupBackfill(channelId) {
  const b = backends.get(channelId);
  if (!b || b.loadingMore) return false;
  const seen = catchupBaseline(channelId);
  if (seen == null) return false;
  const btn = b.loadMoreBtn;
  if (!btn || (btn.style && btn.style.display === "none") || btn.disabled) return false;
  b.catchupSeen = seen;
  b.catchupKnown = new Set(b.order);
  b.catchupTries = 0;
  return catchupFetchOlder(channelId);
}
function catchupFetchOlder(channelId) {
  const b = backends.get(channelId);
  if (!b || !b.catchupKnown || b.loadingMore) return false;
  if ((b.catchupTries || 0) >= CATCHUP_BACKFILL_PAGES) { finishCatchupBackfill(channelId); return false; }
  const btn = b.loadMoreBtn;
  if (!btn || (btn.style && btn.style.display === "none") || btn.disabled) {
    if (!btn || (btn.style && btn.style.display === "none")) b.historyExhausted = true;
    finishCatchupBackfill(channelId);
    return false;
  }
  const oldest = oldestLoadedTime(channelId);
  if (oldest == null || !(oldest > b.catchupSeen)) { finishCatchupBackfill(channelId); return false; }
  try { captureHistoryAnchor(channelId); } catch (e) {}
  b.loadingMore = true;
  b.fetchManual = false;
  b.catchupTries = (b.catchupTries || 0) + 1;
  try { btn.click(); } catch (e) { b.loadingMore = false; b.historyAnchor = null; finishCatchupBackfill(channelId); return false; }
  return true;
}
// Chain continuation for onLoadMore (after the reply-target chains — those serve
// something on screen, so they keep priority). No-op unless a chain is in flight.
function continueCatchupBackfill(channelId) {
  const b = backends.get(channelId);
  if (!b || !b.catchupKnown || b.loadingMore) return;
  catchupFetchOlder(channelId);
}
function finishCatchupBackfill(channelId) {
  const b = backends.get(channelId);
  if (!b || !b.catchupKnown) return;
  const known = b.catchupKnown;
  const seen = b.catchupSeen;
  b.catchupKnown = null; b.catchupSeen = null; b.catchupTries = 0;
  if (seen == null) return;
  // Only the backfilled span is new to the scan — the cold-load window was
  // already covered by the immediate catch-up at load, so restrict to ids
  // outside the chain-start snapshot. (A live arrival landing mid-chain can
  // double-count one badge — it clears when the channel opens, same as the
  // existing live/catch-up races.)
  let fresh = null;
  try {
    fresh = new Set();
    for (const id of b.order) if (!known.has(id)) fresh.add(id);
  } catch (e) { fresh = null; }
  if (fresh && fresh.size === 0) return;
  try { catchUpAlerts(channelId, { since: seen, onlyIds: fresh }); } catch (e) {}
}
// Identity lands after messages (boot prewarm beats the lazy claimed-name /
// nick load): loads that synced identity-blind badge replies (persisted own
// ids) but can never match @mentions, and their touchSeen already stamped.
// Once any nickname is known, re-scan exactly those loads against their frozen
// load-time baseline — inbox + bell only (channel pips were already settled by
// the live path meanwhile, so they stay untouched). Idempotent: alertIds
// dedupes and each load clears its flag after the first pass.
function rescanAlertsAfterIdentity() {
  if (!myNick() && !hasOwnIds()) return;
  try {
    for (const [channelId, b] of backends) {
      if (!b || !b.loaded || !b.identityBlind) continue;
      b.identityBlind = false;
      if (b.seenAtLoad == null) continue; // first sync seeded by design
      try { catchUpAlerts(channelId, { since: b.seenAtLoad, noUnread: true }); } catch (e) {}
    }
  } catch (e) {}
}
function hasOwnIds() {
  try { for (const s of ownIds.values()) if (s && s.size) return true; } catch (e) {}
  return false;
}
// Rows deliberately do NOT clear on open — entries leave only via per-row ✕,
// Clear-all (or 100-cap eviction). Opening a row just jumps to the message.
function clearAlerts() {
  loadAlerts();
  loadBellUnread();
  alerts = []; alertIds.clear();
  bellUnread = 0;
  saveAlerts();
  saveBellUnread();
  paintBell();
  if (view && view.inbox && !view.inbox.hidden) { try { renderInbox(); } catch (e) {} }
}
// Dismiss one inbox row (the small ✕). The list keeps everything else; the badge
// drops only when the dismissed row was still counted as unread (newest-first,
// so the first `bellUnread` rows are the unread ones).
function removeAlert(id) {
  loadAlerts();
  loadBellUnread();
  const at = alerts.findIndex((a) => a && a.id === id);
  if (at < 0) return;
  alerts.splice(at, 1);
  alertIds.delete(id);
  if (at < bellUnread) bellUnread = Math.max(0, bellUnread - 1);
  bellUnread = Math.min(bellUnread, alerts.length);
  saveAlerts();
  saveBellUnread();
  paintBell();
  if (view && view.inbox && !view.inbox.hidden) { try { renderInbox(); } catch (e) {} }
}
// ---- saved messages (local bookmarks) ---------------------------------------
// Same shape + discipline as the alerts inbox above (newest-first, capped,
// persisted), but filled only by hand: the ☆ Save button on each Tavern message
// (see msgEl). No badge, no notifications — just a Saved tab in the inbox panel.
const SAVED_KEY = "mno.disc.saved";
const MAX_SAVED = 100;
let savedItems = [];
const savedIdSet = new Set();
let savedLoaded = false;
function loadSaved() {
  if (savedLoaded) return;
  savedLoaded = true;
  try {
    const arr = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
    if (Array.isArray(arr)) {
      for (const a of arr) {
        if (!a || typeof a.ch !== "string" || typeof a.id !== "string" || !a.id) continue;
        if (savedIdSet.has(a.id)) continue;
        savedIdSet.add(a.id);
        savedItems.push({ ch: a.ch, id: a.id, by: String(a.by || "anon").slice(0, 40), text: String(a.text || "").slice(0, 200), ts: Number(a.ts) || 0 });
        if (savedItems.length >= MAX_SAVED) break;
      }
    }
    try { savedItems.sort((x, y) => y.ts - x.ts); } catch (e2) {}
  } catch (e) { savedItems = []; savedIdSet.clear(); }
}
function saveSaved() {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(savedItems.slice(0, MAX_SAVED))); } catch (e) {}
}
function isSaved(id) {
  loadSaved();
  try { return savedIdSet.has(String(id)); } catch (e) { return false; }
}
// Toggle one message in/out. Returns the new state (true = saved).
function toggleSaved(channelId, comment, msgId) {
  loadSaved();
  const id = String(msgId || commentId(comment, "") || "");
  if (!id) return false;
  if (savedIdSet.has(id)) { removeSaved(id); return false; }
  savedIdSet.add(id);
  savedItems.unshift({ ch: channelId, id, by: commentAuthor(comment) || "anon", text: excerptOf(comment, 80) || "(empty message)", ts: commentTime(comment) || Date.now() });
  if (savedItems.length > MAX_SAVED) { const drop = savedItems.pop(); if (drop) savedIdSet.delete(drop.id); }
  saveSaved();
  if (view && view.inbox && !view.inbox.hidden) { try { renderInbox(); } catch (e) {} }
  return true;
}
function removeSaved(id) {
  loadSaved();
  const at = savedItems.findIndex((a) => a && a.id === id);
  if (at < 0) return;
  savedItems.splice(at, 1);
  savedIdSet.delete(id);
  saveSaved();
  paintSaveButtons();
  if (view && view.inbox && !view.inbox.hidden) { try { renderInbox(); } catch (e) {} }
}
function clearSaved() {
  loadSaved();
  savedItems = []; savedIdSet.clear();
  saveSaved();
  paintSaveButtons();
  if (view && view.inbox && !view.inbox.hidden) { try { renderInbox(); } catch (e) {} }
}
// Store-side removals (inbox ✕ / Clear) don't re-render the message list, so
// sync the visible ☆ buttons or they'd lie until the next render.
function paintSaveButtons() {
  if (!view || !view.msgs) return;
  try {
    for (const btn of view.msgs.querySelectorAll(".disc-savebtn")) {
      const wrap = btn.closest(".disc-msg");
      const s = !!(wrap && wrap.dataset.mid && isSaved(wrap.dataset.mid));
      btn.textContent = s ? "★ Saved" : "☆ Save";
      btn.title = s ? "Remove from saved messages" : "Save this message locally";
      btn.setAttribute("aria-label", s ? "Remove from saved messages" : "Save this message locally");
      btn.setAttribute("aria-pressed", s ? "true" : "false");
    }
  } catch (e) {}
}
// Headless pre-warm: open every Tavern channel's backend, and start the world
// rotation (what enabling notifications does), so arrivals stream while the
// user reads other pages. Nothing renders — liveComment just feeds the unread
// maps, which is exactly what the pips read.
export function prewarmDiscussionBackends() {
  try { if (isSelfBanned()) return; } catch (e) {}
  try { for (const ch of visibleChannels()) ensureBackend(ch.id); } catch (e) {}
  try { if (notifyWdOn) ensureWatchLoop(); } catch (e2) {}
}
// channelId -> pending unsent composer text (kept across panel closes, so an accidental
// scrim-click never eats what you typed; cleared on send)
const textDrafts = new Map();
// channelId -> pending reply target commentId (per-channel drafts, like chat threads)
const drafts = new Map();
// Jump hook installed by main.js (it owns setHomePage): requestJump switches channels
// live, or navigates to Discussion first when the page isn't mounted.
let jumpHandler = null;
export function setJumpHandler(fn) { jumpHandler = typeof fn === "function" ? fn : null; }
export function requestJump(channelId) {
  if (isWorldChannel(channelId)) { requestWorldJump(channelId); return; }
  if (view) { switchChannel(channelId); return; }
  if (jumpHandler) { try { jumpHandler(channelId); } catch (e) {} return; }
  try { location.hash = "#discussion"; } catch (e) {}
  setTimeout(() => { if (view) switchChannel(channelId); }, 1500);
}
// A Tavern toast/inbox row for a world thread: open that world's detail panel,
// then jump to the message once its thread mounted (with retries — the panel
// fetches the record first).
function requestWorldJump(channelId, msgId) {
  // Prefer the stored catalog id (channel slugs are one-way and don't resolve).
  try {
    const meta = watchMetaForChannel(channelId);
    if (meta && meta.wid) { requestWorldJumpById(meta.wid, msgId); return; }
  } catch (e) {}
  const wid = worldIdFromChannel(channelId);
  if (!wid) return;
  const go = async () => {
    try {
      const m = await import("./community.js");
      const st = await m.openLinkedWorld(wid);
      if (st !== "ok") return;
      if (msgId) setTimeout(() => jumpToWorldMessageSoon(channelId, msgId), 300);
    } catch (e) {}
  };
  // From inside the Tavern panel the details paint over it; otherwise just open.
  try { go(); } catch (e) {}
}
// World jump by real catalog id: opens the detail panel on its Comments tab,
// then jumps to the message once its thread mounted (with retries — the panel
// fetches the record first). A world the catalog no longer has auto-leaves the
// watch list instead of nagging forever.
function requestWorldJumpById(worldId, msgId) {
  const wid = String(worldId || "");
  if (!wid) return;
  let ch = null;
  try { ch = worldChannelFor(wid); } catch (e) {}
  const go = async () => {
    try {
      const m = await import("./community.js");
      try {
        if (m.focusWorldComments && m.focusWorldComments(wid)) {
          if (msgId && ch) setTimeout(() => jumpToWorldMessageSoon(ch, msgId), 300);
          return;
        }
      } catch (e2) {}
      const st = await m.openLinkedWorld(wid, { openComments: true });
      if (st === "not_found" || st === "removed" || st === "bad_id") { try { unwatchWorld(wid); } catch (e3) {} return; }
      if (st !== "ok") return;
      if (msgId && ch) setTimeout(() => jumpToWorldMessageSoon(ch, msgId), 300);
    } catch (e4) {}
  };
  // From inside the Tavern panel the details paint over it; otherwise just open.
  try { go(); } catch (e5) {}
}
function jumpToWorldMessageSoon(channelId, msgId, tries = 12) {
  if (!msgId) return;
  try {
    const set = worldViews.get(channelId);
    if (set) for (const wv of set) { if (wv.msgEls && wv.msgEls.get(msgId)) { jumpToWorldMessage(wv, msgId); return; } }
  } catch (e) {}
  if (tries <= 0) return;
  setTimeout(() => jumpToWorldMessageSoon(channelId, msgId, tries - 1), 500);
}
export function jumpToChannel(channelId) { if (view) switchChannel(channelId); }
// The app bridge main.js exposes (popups, notify, goUser, …) — same one community.js uses.
const mnoApp = () => { try { return window.mnoApp || null; } catch (e) { return null; } };
// Nickname → profile page. A full-size panel would cover the profile, so it
// closes first; a compact floater doesn't (the profile page stays fully
// visible beside it), so compact leaves the Tavern standing.
function openAuthorProfile(nick) {
  const n = String(nick || "").trim();
  if (!n) return;
  let keepOpen = false;
  try { keepOpen = !!(panel && getWinMode(panel.overlay) === "compact"); } catch (e) {}
  if (!keepOpen) {
  // A profile opened from a name takes over from the panel: surrender the panel's Back
  // entry WITHOUT popping it (same handoff the world-details panel uses). A plain close
  // schedules a history.back() whose delayed traversal lands after the profile mounts
  // and tears the navigation back down (panel reopens over the profile, or the profile
  // never lands — whichever the race gives you).
  try { takeoverDiscussionPanel(); } catch (e) { try { closeDiscussionPanel(); } catch (e2) {} }
  }
  try {
    const app = mnoApp();
    if (app && app.goUser) { app.goUser("", n); return; }
  } catch (e) {}
  try { location.hash = `#user/${encodeURIComponent(n)}`; } catch (e2) {}
}
// Active view handles (cleared on unmount)
let view = null;
// Bell state (module-level so toasts keep working after the page unmounts).
// Either sub-toggle keeps background sync alive; the badge tracks regardless.
let notifyOn = false;
function readNotifyPref(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function loadNotifyPrefs() {
  const r = readNotifyPref(NOTIFY_REPLY_KEY);
  const a = readNotifyPref(NOTIFY_ALL_KEY);
  const old = readNotifyPref(NOTIFY_KEY);
  notifyReplyOn = r !== null ? r === "1" : old === "1";
  notifyAllOn = a !== null ? a === "1" : old === "1";
  notifyWdOn = readNotifyPref(NOTIFY_WD_KEY) === "1";
  notifyOn = notifyReplyOn || notifyAllOn;
}
loadNotifyPrefs();

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function loadNick() {
  try { return localStorage.getItem(NICK_KEY) || ""; } catch (e) { return ""; }
}
function saveNick(v) {
  try { localStorage.setItem(NICK_KEY, v); } catch (e) {}
}

// Claimed MNO username (community identity): the Tavern speaks with the same name your
// published worlds are signed with. Read with identityOrNull() — the device identity
// itself is minted on first send (see submitBody), so even unregistered chatters carry
// a stable app userId tag. Loaded lazily (see loadClaimedName); empty until it
// resolves, which is also the unclaimed state.
let claimedName = "";
// Your app userId (stable across renames, devices and networks — unlike the nickname and
// unlike the plugin's per-network id). Every send tags it onto its message (see
// submitBody) — claimed or not; receivers verify the tag against the server (see
// verifiedFor), which only succeeds for claimed identities with a matching nickname.
let claimedUserId = "";
// Device userId even when unclaimed (same value as claimedUserId once claimed).
// This is what unregistered sends tag — it never verifies (no server username),
// but it gives moderation a stable per-device key alongside the plugin's network id.
let deviceUserId = "";
// Admin-only ID inspector (see adminIdBtn): mirrors community.js isAdmin(). Flips
// live via onAdminChange so signing in while the Tavern stands open reveals it.
let isAdminView = false;
let adminUnsub = null;
// Your own server avatar (https only). Renders on your messages locally — never sent.
let claimedAvatarUrl = "";
const normNick = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().toLowerCase();
// Server-verified identity tags: app userId -> "pending" | {username, avatar} | null.
// A tag proves nothing on its own (userIds travel in RPC traffic, so a determined
// impersonator could paste someone's tag) — it only counts when the server says the
// tagged id's username matches the message's nickname (see verifiedFor). That stops
// casual name-copying cold; targeted spoofing stays possible, same as ever. Hits and
// misses are cached per session; the open channel re-renders once per batch.
// Batching: verifiedFor() runs synchronously per message during a render, so each
// cache miss only enqueues its uid — the flush collects the whole render's burst
// (all channels' backends, one microtask later) into 64-id getUsers calls. One RPC
// returns username + avatar together (publicUser), so no second getProfile round-trip.
const uidCache = new Map();
const uidPending = new Set();
let uidFlushScheduled = false;
function resolveUidTag(userId) {
  const key = String(userId || "").toLowerCase();
  if (!key || uidCache.has(key)) return uidCache.get(key) || null;
  uidCache.set(key, "pending");
  uidPending.add(key);
  if (!uidFlushScheduled) {
    uidFlushScheduled = true;
    Promise.resolve().then(() => flushUidBatch().catch(() => {}));
  }
  return null;
}
async function flushUidBatch() {
  uidFlushScheduled = false;
  if (!uidPending.size) return;
  const ids = [...uidPending];
  uidPending.clear();
  try {
    const m = await import("./community.js");
    const byId = new Map();
    for (let i = 0; i < ids.length; i += 64) {
      const chunk = ids.slice(i, i + 64);
      let users = null;
      try {
        users = m.getUsersByIds
          ? await m.getUsersByIds(chunk)
          : await Promise.all(chunk.map((id) => m.getProfileUser(id).catch(() => null)));
      } catch (e) { users = null; }
      if (!users) {
        // Transport failure: drop back to unknown so the next render retries.
        for (const id of chunk) if (uidCache.get(id) === "pending") uidCache.delete(id);
        continue;
      }
      for (let k = 0; k < chunk.length; k++) byId.set(chunk[k], users[k]);
    }
    for (const id of ids) {
      if (uidCache.get(id) !== "pending") continue;
      const u = byId.get(id);
      const username = u && u.username ? String(u.username) : "";
      if (!username) { uidCache.set(id, null); continue; }
      const rawAv = u && u.avatar ? String(u.avatar) : "";
      uidCache.set(id, { username, avatar: /^https:\/\//i.test(rawAv) ? rawAv : "" });
    }
  } catch (e) {
    for (const id of ids) if (uidCache.get(id) === "pending") uidCache.delete(id);
  }
  try { scheduleRender(); } catch (e2) {}
}
// The verified identity behind a message, or null. Two paths: your own messages under
// your claimed name are ownership-verified locally (the plugin flags them itself — no
// tag or lookup needed — plus a synchronous tag match so your other devices count
// too); anyone else's must carry a `⟦uid:…⟧` tag whose app userId the
// server maps back to the SAME nickname. Untagged, unknown or mismatched → null: just
// a nickname, letter avatar and plain text.
function verifiedFor(comment) {
  const nick = nickOf(comment);
  if (!nick) return null;
  if (claimedName && nick === claimedName) {
    if (comment && comment.byCurrentUser)
      return { username: claimedName, avatar: claimedAvatarUrl };
    // Same verified user, other browser/network: the uid tag is yours, so no
    // server round-trip is needed for the seal (the async path below agrees).
    try {
      const tag = parseReply(comment && comment.message).tagUid;
      if (tag && claimedUserId && String(tag).toLowerCase() === String(claimedUserId).toLowerCase())
        return { username: claimedName, avatar: claimedAvatarUrl };
    } catch (e) {}
  }
  let tagUid = null;
  try { tagUid = parseReply(comment && comment.message).tagUid; } catch (e) { tagUid = null; }
  if (!tagUid) return null;
  const hit = uidCache.get(String(tagUid).toLowerCase());
  if (hit === undefined) { resolveUidTag(tagUid); return null; }
  if (!hit || normNick(hit.username) !== normNick(nick)) return null;
  return hit;
}
async function loadClaimedName() {
  try {
    const m = await import("./community.js");
    const id = await m.api.identityOrNull();
    deviceUserId = (id && id.userId) ? String(id.userId) : "";
    const name = id && id.username ? String(id.username).trim() : "";
    if (name) {
      claimedName = name;
      claimedUserId = (id && id.userId) ? String(id.userId) : "";
      try { backfillOwnIds(); } catch (e) {}
      applyClaimedNick();
    }
    else { claimedName = ""; claimedUserId = ""; releaseNick(); }
    if (id && id.userId) {
      m.getProfileContent(id.userId).then((p) => {
        const a = p && p.avatar ? String(p.avatar) : "";
        if (/^https:\/\//i.test(a)) {
          claimedAvatarUrl = a;
          try { scheduleRender(); } catch (e2) {}
        }
      }).catch(() => {});
    }
  } catch (e) { if (!claimedName) { claimedUserId = ""; releaseNick(); } }
  try { refreshAdminFlag(); } catch (e2) {}
  // A name just landed (claim, rename, or the lazy first read): re-scan loads
  // that synced before it for while-away @mentions (no-op when everything
  // already scanned with identity, or when there is still none).
  try { rescanAlertsAfterIdentity(); } catch (e3) {}
}
// Privileged flag mirrors community.js isMod() (admin inherits). Subscribed once; re-renders the open
// channel so the per-message id buttons appear/disappear with sign-in/out.
async function refreshAdminFlag() {
  try {
    const m = await import("./community.js");
    const now = !!((m.api && m.api.isMod && m.api.isMod()) || (m.api && m.api.isAdmin && m.api.isAdmin()));
    if (now !== isAdminView) { isAdminView = now; try { scheduleRender(); } catch (e) {} }
    if (!adminUnsub && m.api && m.api.onAdminChange) {
      try {
        adminUnsub = m.api.onAdminChange(() => {
          try {
            const v = !!((m.api.isMod && m.api.isMod()) || (m.api.isAdmin && m.api.isAdmin()));
            if (v !== isAdminView) { isAdminView = v; scheduleRender(); }
          } catch (e2) {}
        });
      } catch (e3) {}
    }
  } catch (e) {}
}
// No claimed identity: the nick field is yours to type in (it starts disabled while
// the identity check above is in flight, so a slow first import never leaves a window
// where a claimed user could type + send under a different name).
function releaseNick() {
  if (claimedName || !view || !view.nick) return;
  try {
    view.nick.disabled = false;
    if (view.save) view.save.hidden = false;
    // Back to a free nickname: the tooltip drops the claimed suffix.
    try {
      const tip = view.cfg && view.cfg.querySelector(".disc-cfg-nickkey .info-tip");
      if (tip) tip.setAttribute("data-tip", NICK_TIP_BASE);
    } catch (e) {}
  } catch (e) {}
}
// A username claimed (or renamed) while the Tavern stands open — community.js fires
// this from the claim popup's success path. Instant: no import round-trip needed.
// A username claimed (or renamed) while the Tavern stands open — community.js fires
// this from the claim popup's success path. Re-reads the identity (cheap local read)
// so the fresh userId lands alongside the name — sends need it for the uid tag.
try {
  window.addEventListener("mno:identity", () => { loadClaimedName().catch(() => {}); });
} catch (e) {}
// A claimed name locks the nick field to it (change it in Settings → Identity) and
// re-renders, since the highlight bridge and your own messages' names follow it.
function applyClaimedNick() {
  if (!claimedName || !view) return;
  try {
    view.nick.value = claimedName;
    view.nick.disabled = true;
    if (view.save) view.save.hidden = true;
    // Locked to the identity: the tooltip carries it (no separate note line),
    // since the input + Save give no other signal for why they won't take a new name.
    try {
      const tip = view.cfg && view.cfg.querySelector(".disc-cfg-nickkey .info-tip");
      if (tip) tip.setAttribute("data-tip", `${NICK_TIP_BASE} You're signed in with your MNO identity: ${claimedName}. Change it in Settings → Identity.`);
    } catch (e) {}
  } catch (e) {}
  try { scheduleRender(); } catch (e) {}
}
function loadLastChannel() {
  try {
    const s = localStorage.getItem(LAST_CHANNEL_KEY) || "";
    if (s && CHANNELS.some((c) => c.id === s) && isChannelVisible(s)) return s;
  } catch (e) {}
  return CHANNELS[0].id;
}
function saveLastChannel(id) {
  try { localStorage.setItem(LAST_CHANNEL_KEY, id); } catch (e) {}
}

function hiddenRoot() {
  let el = document.getElementById("discHiddenHosts");
  if (!el) {
    el = document.createElement("div");
    el.id = "discHiddenHosts";
    el.setAttribute("aria-hidden", "true");
    // Off-screen but laid out: display:none would stop the plugin's
    // IntersectionObserver from ever lazy-loading the iframe. The hosts inside
    // overlap at the parent's origin (see ensureBackend) so none of them is
    // ever clipped — a clipped element never intersects, and its iframe would
    // never load ("Connecting…" forever).
    el.style.cssText = "position:fixed;left:0;top:0;width:10px;opacity:0;pointer-events:none;z-index:-1;";
    document.body.appendChild(el);
  }
  return el;
}

function commentId(c, i) {
  const raw = c ? (c.id ?? c._id) : null;
  // String-normalized: a numeric id and its header/native text form must hit the same Map key.
  return raw !== null && raw !== undefined ? String(raw) : `t${c && c.time ? c.time : 0}-${i}`;
}
function commentTime(c) {
  const t = c && (c.time ?? c.date ?? c.createdAt ?? c.timestamp);
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
// Split a message's author into its display parts: the nickname and the 4-char
// network-id discriminator (bare id, worn inside its own `.disc-disc` badge pill;
// empty when there is nothing to disambiguate, or when there is no nickname —
// a nameless message shows ONLY the badge).
// commentAuthor() is the plain-text form (notifications, titles — keeps `#`,
// since there is no pill there to delimit the id); paintAuthorName() is
// the DOM form, which wears the discriminator in its own muted color.
function authorParts(c) {
  const u = (c && c.user) || {};
  const nick = String(u.nickname || "").trim();
  const vis = String(u.visualId || "").trim();
  if (!nick) {
    if (vis) return { nick: "", disc: vis, text: vis };
    return { nick: "anon", disc: "", text: "anon" };
  }
  // A verified name stays clean: your own messages sent under your claimed username,
  // on any device/network (see isMine). Everything else carries the 4-char network
  // id — nicknames are free text, so "bob" on another network is a different person
  // until proven otherwise.
  if (claimedName && c && nick === claimedName && isMine(c)) return { nick, disc: "", text: nick };
  if (!vis) return { nick, disc: "", text: nick };
  return { nick, disc: vis, text: `${nick} #${vis}` };
}
function commentAuthor(c) {
  return authorParts(c).text;
}
// Render a name into an element: nickname text + discriminator in its own span
// (`.disc-disc`, muted). DOM-built with text nodes — nicknames are other people's input.
// Verified identities (see verifiedFor) also wear the seal: a static trusted SVG
// string, never user input, so insertAdjacentHTML is safe for that piece.
const VERIFIED_BADGE = ICON_VERIFIED;
// The engine author's star uses the verified seal as its base: same 16-unit badge
// and metrics, with the check replaced by an edge-touching sparkle. Same static-markup
// deal — the name beside it stays a text node.
const OWNER_STAR = ICON_OWNER_STAR;
// (MOD_APP_IDS + MOD_SET live at the top of this file — see OWNER-EDITABLE LISTS.)
// The mod tag behind a message, or "" — tag match only (see note above).
function modTagFor(comment) {
  try {
    const t = parseReply(comment && comment.message).tagUid;
    const k = String(t || "").toLowerCase();
    return k && MOD_SET.has(k) ? k : "";
  } catch (e) { return ""; }
}
const MOD_BADGE = ICON_MOD_SHIELD;
// Engine-owner check, borrowed from community.js (single source: its MNO_USER_ID)
// once the import lands. Null until then — ownerFor just answers false, and the
// finally below re-renders so crowns pop in with everything else.
let isEngineAuthorCheck = null;
async function ensureEngineAuthorCheck() {
  if (isEngineAuthorCheck) return isEngineAuthorCheck;
  try {
    const m = await import("./community.js");
    if (m && typeof m.isEngineAuthorId === "function") isEngineAuthorCheck = m.isEngineAuthorId;
  } catch (e) { isEngineAuthorCheck = null; }
  try { scheduleRender(); } catch (e) {}
  return isEngineAuthorCheck;
}
// The engine author behind a message, or false. Verified identities only: your
// own messages when the claimed identity IS the author's (server-backed userId),
// or anyone else's with a server-verified uid tag for the author's id. A bare
// "mnomno" nickname with no proof stays plain — names are free text.
function ownerFor(comment) {
  if (!isEngineAuthorCheck) return false;
  const nick = nickOf(comment);
  if (!nick) return false;
  if (claimedName && nick && normNick(nick) === normNick(claimedName) && isMine(comment)) {
    try { return !!claimedUserId && isEngineAuthorCheck(claimedUserId); } catch (e) { return false; }
  }
  let tagUid = null;
  try { tagUid = parseReply(comment && comment.message).tagUid; } catch (e) { tagUid = null; }
  if (!tagUid) return false;
  try {
    if (!verifiedFor(comment)) return false;
    return isEngineAuthorCheck(tagUid);
  } catch (e) { return false; }
}
function paintAuthorName(el, c, prefix) {
  el.innerHTML = "";
  // Verified identity (your own claimed messages, or a server-confirmed uid tag) wears
  // `is-user` so styles can color it apart from plain nicknames, plus the seal right
  // after the nickname — unless it's the engine author, who wears `is-owner` gold
  // and the star instead. Moderators wear `is-mod` blue and the shield instead
  // (tag match only — see MOD_APP_IDS). Same cached check the head runs — no extra
  // lookups.
  // (Removed first: reply-bar/toast elements are reused across paints, so a stale
  // class would stick to the next name.)
  el.classList.remove("is-user");
  el.classList.remove("is-owner");
  el.classList.remove("is-mod");
  let verified = false, owner = false, mod = false;
  try { verified = !!verifiedFor(c); } catch (e) {}
  try { owner = verified && ownerFor(c); } catch (e2) { owner = false; }
  try { mod = !owner && !!modTagFor(c); } catch (e3) { mod = false; }
  if (owner) el.classList.add("is-owner");
  else if (mod) el.classList.add("is-mod");
  else if (verified) el.classList.add("is-user");
  const { nick, disc } = authorParts(c);
  if (prefix) el.append(document.createTextNode(prefix));
  if (nick) el.append(document.createTextNode(nick));
  if (nick) {
    if (owner) el.insertAdjacentHTML("beforeend", OWNER_STAR);
    else if (mod) el.insertAdjacentHTML("beforeend", MOD_BADGE);
    else if (verified) el.insertAdjacentHTML("beforeend", VERIFIED_BADGE);
  }
  if (disc) {
    const s = document.createElement("span");
    s.className = "disc-disc" + (nick ? "" : " solo");
    s.textContent = disc;
    el.append(s);
  }
}
function authorHue(name) {
  let h = 0;
  const s = String(name || "?");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}
function fmtTime(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (sameDay) return `${hh}:${mm}`;
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${hh}:${mm}`;
}

function ensureBackend(channelId) {
  let b = backends.get(channelId);
  if (b) return b;
  // Banned browsers mount no transports — no iframe, no sync. Callers already
  // handle a controller-less stub (sends fail closed, views paint the ban).
  // The stub is NOT stored: backends stays empty so iframe count is zero.
  try {
    if (isSelfBanned()) {
      return { controller: null, host: null, loaded: false, failed: "banned", messages: new Map(), order: [],
        loadMoreBtn: null, loadingMore: false, pendingTargets: new Map(),
        historyExhausted: true, historyAnchor: null, renderLimit: INITIAL_RENDER_LIMIT, fetchManual: false };
    }
  } catch (e) {}
  // NSFW-gated channels mount nothing while the content setting is off — no
  // iframe, no sync. The stub is NOT stored (same as the ban path). Callers
  // can't reach this for a visible channel; the guard is the backstop for the
  // headless paths (prewarm, notify wake, rotation) racing a settings flip.
  try {
    const def = CHANNELS.find((c) => c.id === channelId);
    if (def && def.nsfw && !nsfwChannelsVisible()) {
      return { controller: null, host: null, loaded: false, failed: "nsfw-hidden", messages: new Map(), order: [],
        loadMoreBtn: null, loadingMore: false, pendingTargets: new Map(),
        historyExhausted: true, historyAnchor: null, renderLimit: INITIAL_RENDER_LIMIT, fetchManual: false };
    }
  } catch (e) {}
  b = { controller: null, host: null, loaded: false, failed: "", messages: new Map(), order: [],
    loadMoreBtn: null, loadingMore: false, pendingTargets: new Map(),
    historyExhausted: false, historyAnchor: null, renderLimit: INITIAL_RENDER_LIMIT, fetchManual: false };
  backends.set(channelId, b);
  try {
    const host = document.createElement("div");
    host.dataset.channel = channelId;
    // Absolute at the parent's origin: every channel's host overlaps in the same
    // 10px box instead of stacking, so no host is ever clipped by a sibling and
    // every channel's lazy-load observer fires.
    host.style.cssText = "position:absolute;left:0;top:0;width:10px;height:10px;overflow:hidden;";
    hiddenRoot().appendChild(host);
    b.host = host;
    const controller = window.commentsPlugin({
      channel: channelId,
      channelLabel: isWorldChannel(channelId) ? `World ${worldDisplayName(channelId)}` : `Tavern ${channelId}`,
      width: 10,
      height: 10,
      // Chat transport ban list (server-bans.js, from getBans). Empty
      // most of the time: the plugin's bannedUsers option only accepts a list,
      // so pass nothing when nobody is banned.
      ...(() => { try { const ids = getCommentIds(); return ids.length ? { bannedUsers: ids } : {}; } catch (e) { return {}; } })(),
      // NOTE: no `hideComments` here on purpose. The embed reports "no more
      // history" via `loadMoreBtn.offsetHeight === 0`, and with hideComments the
      // list container is display:none — so the button always measures 0, EVERY
      // channel permanently reports no-more-history, and load-more clicks are
      // ignored too (same gate). The 10px clipped host keeps the list invisible.
      hideSettingsButton: true,
      hideFullscreenButton: true,
      forceColorScheme: "dark",
      replacedDuringUpdate: true,
      containerStyle: "position:relative; width:10px; height:10px; opacity:0; pointer-events:none; overflow:hidden;",
      onLoad(comments, extra) {
        b.loaded = true;
        b.failed = "";
        // A fresh full load supersedes any in-flight history fetch's anchor.
        b.historyAnchor = null;
        // The plugin's "load more" button (older history): each click fetches the
        // next 200 older messages. Kept for reply backfill (see queueTargetLoad)
        // AND the manual "load older" header (see loadOlderMessages).
        if (extra && extra.loadMoreButton) b.loadMoreBtn = extra.loadMoreButton;
        ingest(channelId, Array.isArray(comments) ? comments : []);
        try { rememberOwnIdsFromList(Array.isArray(comments) ? comments : []); } catch (e) {}
        // Ban gate during the loading veil: own transport id vs the ban list.
        // World threads gate their own views; Tavern gates the whole panel.
        try {
          if (isWorldChannel(channelId)) {
            if (isSelfBanned()) maybeEnforceWorldBan(channelId);
          } else {
            if (isSelfBanned()) maybeEnforceTavernBan();
          }
        } catch (e) {}
        b.historyAnchor = null;
        // Badge what arrived since you last looked (silent — the inbox carries it).
        // A loud channel may have moved more than this load covers: the backfill
        // chain pages older history (render-free) until your last sighting is
        // covered, then scans the fetched span on top of this immediate scan.
        // Freeze this load's baseline and whether it scans identity-blind (boot
        // prewarm beats the lazy identity load): with no nickname known, replies
        // can still match but @mentions can't, while touchSeen below stamps
        // anyway — rescanAlertsAfterIdentity re-scans these loads once a name
        // lands, so while-away mentions aren't swallowed.
        try {
          loadLastSeen();
          b.seenAtLoad = lastSeenMem.get(channelId); // undefined on first sync
          b.identityBlind = !myNick();
        } catch (e) {}
        try { catchUpAlerts(channelId); } catch (e) {}
        try { maybeStartCatchupBackfill(channelId); } catch (e2) {}
        // First sight of this load's messages: catch-up ran against the stored
        // baseline first, so marking seen now can't swallow while-away mentions.
        // (Identity-guarded like the catch-up itself — without an identity nothing
        // can qualify, so there's nothing to mark seen yet.)
        try { if (myNick() || hasOwnIds()) touchSeen(channelId); } catch (e2) {}
        // Cold load renders only the newest window (see INITIAL_RENDER_LIMIT) —
        // renderLimit stays put here so a 1k+ initial batch doesn't all parse.
        if (!b.loadMoreBtn || (b.loadMoreBtn.style && b.loadMoreBtn.style.display === "none")) b.historyExhausted = true;
          // World threads render into their own detail-panel views (no Tavern view needed).
          try { renderWorldViews(channelId); } catch (e) {}
          try { paintWorldStatus(channelId); } catch (e2) {}
          try { emitWorldCount(channelId); } catch (e4) {}
          try {
            const ws = worldViews.get(channelId);
            if (ws && ws.size) { try { touchSeen(channelId); } catch (e3) {} }
        } catch (e3) {}
        // No DOM work while the welcome gate stands (nickname typing stays smooth)
        // — startChat renders once on Enter. Otherwise paint + windowed render.
        if (view && view.chatStarted && !(view.welcome && view.welcome.isConnected)) {
          paintStatus(channelId); renderMessages(channelId);
        } else if (view) {
          try { paintStatus(channelId); } catch (e) {}
        }
        try { hideBootVeilIfReady(); } catch (e) {}
        try { scheduleOtherBackends(); } catch (e2) {}
      },
      onLoadMore(comments) {
        const b2 = backends.get(channelId);
        if (b2) b2.loadingMore = false;
        const added = ingest(channelId, Array.isArray(comments) ? comments : []);
        try { rememberOwnIdsFromList(Array.isArray(comments) ? comments : []); } catch (e) {}
        try {
          if (isSelfBanned()) {
            if (isWorldChannel(channelId)) maybeEnforceWorldBan(channelId);
            else maybeEnforceTavernBan();
          }
        } catch (e) {}
        const b3 = backends.get(channelId);
        const wasManual = !!(b3 && b3.fetchManual);
        // Only a user-initiated fetch (header button / infinite scroll) widens the
        // visible window. Auto-backfill for ghost reply previews lands in the
        // backend map (so previews resolve) but stays outside the 200-row window —
        // otherwise a busy channel's backfill chain would grow the cold-load parse
        // back to 1k+ on its own.
        if (b3 && added && wasManual) b3.renderLimit = Math.min(b3.order.length, (b3.renderLimit || INITIAL_RENDER_LIMIT) + added);
        if (b3) b3.fetchManual = false;
        if (b3 && (!b3.loadMoreBtn || (b3.loadMoreBtn.style && b3.loadMoreBtn.style.display === "none"))) b3.historyExhausted = true;
        // World threads share the fetch gate but keep their own window: a manual
        // world fetch widens every open thread on that channel.
        try {
          if (wasManual && added) {
            const wset = worldViews.get(channelId);
            if (wset && wset.size) for (const wv of wset) {
              try { wv.limit = Math.min(b3.order.length, (wv.limit || WORLD_RENDER_LIMIT) + added); } catch (e2) {}
            }
          }
        } catch (e3) {}
          try { renderWorldViews(channelId, { hold: true }); } catch (e) {}
          if (view && view.active === channelId && view.chatStarted && !(view.welcome && view.welcome.isConnected)) renderMessages(channelId, { hold: true });
          retryPendingLoads(channelId);
          // Catch-up backfill continuation (no-op unless a chain is in flight).
          try { continueCatchupBackfill(channelId); } catch (e5) {}
          try { emitWorldCount(channelId); } catch (e4) {}
        // A backfill chain ending at exhaustion should still flip the header to
        // its "beginning" state even when no reply target was waiting on it.
        if (b3 && b3.historyExhausted && view && view.active === channelId && view.chatStarted && !(view.welcome && view.welcome.isConnected)) renderMessages(channelId, { hold: true });
      },
      onComment(comment) {
        if (comment) liveComment(channelId, comment);
      },
    });
    b.controller = controller;
    host.innerHTML = String(controller || "");
  } catch (e) {
    b.failed = (e && e.message) || String(e);
    if (view) paintStatus(channelId);
    try { hideBootVeilIfReady(); } catch (e2) {}
  }
  return b;
}

function ingest(channelId, comments) {
  const b = backends.get(channelId);
  if (!b) return 0;
  let added = 0;
  let ownChanged = false;
  comments.forEach((c, i) => {
    if (!c || typeof c.message !== "string") return;
    const id = commentId(c, `${b.order.length}-${i}`);
    if (b.messages.has(id)) return;
    b.messages.set(id, c);
    b.order.push(id);
    added++;
    if (isMine(c)) {
      let set = ownIds.get(channelId);
      if (!set) { set = new Set(); ownIds.set(channelId, set); }
      if (!set.has(id)) { set.add(id); ownChanged = true; }
    }
    try {
      if (c && c.byCurrentUser) {
        const uid = ownTransportIdOf(c);
        if (uid) rememberOwnCommentId(uid);
      }
    } catch (e) {}
  });
  if (added) {
    b.order.sort((a, c2) => commentTime(b.messages.get(a)) - commentTime(b.messages.get(c2)));
  }
  if (ownChanged) saveOwnIds();
  return added;
}

// Layout shifts above/below the list (reply bar toggling, composer autogrow,
// keyboard closing) resize its viewport without scrolling it — a follower would
// be stranded just off the tail. Re-pin instead; readers mid-list are untouched.
function repinIfFollowing() {
  try { if (view && view.pinBottom && view.msgs) view.msgs.scrollTop = view.msgs.scrollHeight; } catch (e) {}
}

// "New messages" pill counter (see mount: shown while unfollowed as live messages
// arrive, hidden the moment the user is back at the bottom or changes channel).
function bumpNewPill() {
  if (!view || !view.newPill) return;
  view.newCount = (view.newCount || 0) + 1;
  try {
    view.newPill.hidden = false;
    view.newPill.textContent = `${view.newCount} new message${view.newCount === 1 ? "" : "s"}`;
  } catch (e) {}
}
function hideNewPill() {
  if (!view) return;
  view.newCount = 0;
  try { if (view.newPill) view.newPill.hidden = true; } catch (e) {}
}

// Live arrival fast path: the common case is one strictly-newest message landing at
// the bottom. Appending that single node — instead of the full innerHTML rebuild
// renderMessages does — keeps a history reader's scroll position byte-stable (no
// position math at all, no race with in-flight history anchors) and is far less
// jank on phones. Anything else (a backfill in flight, an out-of-order/late
// message) falls back to the full render. Returns true when it handled the arrival.
function appendLiveMessage(channelId, comment) {
  if (!view || !view.msgs || !view.msgEls) return false;
  const b = backends.get(channelId);
  if (!b || b.loadingMore || b.historyAnchor) return false;
  const n = b.order.length;
  if (!n || b.messages.get(b.order[n - 1]) !== comment) return false;
  const prev = n > 1 ? b.messages.get(b.order[n - 2]) || null : null;
  let el = null;
  try { el = msgEl(comment, channelId, b.order[n - 1], prev); } catch (e) { return false; }
  if (!el) return false;
  // Stickiness is decided BEFORE the append changes the geometry: following the
  // tail means follow, anything else means don't touch the scroll — appending
  // below the viewport never moves what you're looking at on its own. pinBottom
  // carries the user's intent (upward scrolls disengage it at once, see onScroll),
  // but there is no tolerance: only the true bottom (or a pill glide in flight)
  // follows. The gap ceiling only guards geometry shifts no scroll event saw.
  const gap = view.msgs.scrollHeight - view.msgs.scrollTop - view.msgs.clientHeight;
  const follow = !!view.glide || gap < 2 || isMine(comment) || (view.pinBottom && gap < 24);
  // The sticky pill stays the final child — new messages slot in before it.
  try {
    if (view.newPill && view.newPill.parentNode === view.msgs) view.msgs.insertBefore(el, view.newPill);
    else view.msgs.appendChild(el);
  } catch (e) { try { view.msgs.appendChild(el); } catch (e2) { return false; } }
  view.msgEls.set(b.order[n - 1], el);
  // Windowed rendering (see INITIAL_RENDER_LIMIT): a follower's DOM stays bounded
  // by dropping the oldest rendered node once the window slides past it. An
  // unfollowed history reader keeps the extra node (no shift under their eyes —
  // the next full render re-windows with its scroll anchor and settles it).
  try {
    const limit = b.renderLimit || INITIAL_RENDER_LIMIT;
    if (follow && view.msgEls.size > limit) {
      const dropId = b.order[n - limit - 1];
      const dropEl = dropId && view.msgEls.get(dropId);
      if (dropEl && dropEl.parentNode === view.msgs) {
        dropEl.remove();
        view.msgEls.delete(dropId);
      }
    }
  } catch (e) {}
  if (follow) { try { view.msgs.scrollTop = view.msgs.scrollHeight; } catch (e) {} }
  try { view.pinBottom = view.msgs.scrollHeight - view.msgs.scrollTop - view.msgs.clientHeight < 2; } catch (e) {}
  return true;
}

// Live arrival path (a reply/message pushed by the plugin after load, on any device).
function liveComment(channelId, comment) {
  const added = ingest(channelId, [comment]);
  if (!added) return; // duplicate delivery (iframe reload / catch-up overlap) — stay silent
  try { if (comment && comment.byCurrentUser) rememberOwnCommentId(ownTransportIdOf(comment)); } catch (e) {}
  // Late-discovered ban (e.g. own message arrives after the veil lifted):
  // gate the same way as the loading check.
  try {
    if (isSelfBanned()) {
      if (isWorldChannel(channelId)) maybeEnforceWorldBan(channelId);
      else maybeEnforceTavernBan();
      return;
    }
  } catch (e) {}
  const mine = isMine(comment);
  // World threads render even while the Tavern welcome gate stands (separate views).
  const hasWorldView = (() => { try { const s = worldViews.get(channelId); return !!(s && s.size); } catch (e) { return false; } })();
  // No DOM work while the welcome gate stands — the backend map still grows so
  // Enter renders with everything, but typing the nickname never competes.
  if (view && (!view.chatStarted || (view.welcome && view.welcome.isConnected)) && !hasWorldView) return;
  // An open world thread always renders live (it is the channel on screen).
  if (hasWorldView) {
    try { appendWorldLiveMessage(channelId, comment) || renderWorldViews(channelId, mine ? { mine: true } : null); } catch (e) {}
    try { paintWorldStatus(channelId); } catch (e2) {}
    // Looking right at it counts as seen. Qualifying watched arrivals still join
    // the inbox (the record — same as the Tavern), silently: the message is
    // already on screen, so no ding or toast.
    try { addWorldAlert(channelId, comment); } catch (e5) {}
    try { if (mine) { unread.delete(channelId); unreadReply.delete(channelId); emitHot(); } else noteSeenLive(channelId, commentTime(comment)); } catch (e4) {}
  }
  if (view) {
    if (view.active === channelId) {
      paintStatus(channelId);
      // An anchor with no fetch outstanding is orphaned (its batch already
      // rendered or never answered) — drop it so neither the fast path nor a
      // later hold render can spend it. Anchors are only ever minted beside
      // loadingMore=true, synchronously, so a false flag means no batch is coming.
      try {
        const b0 = backends.get(channelId);
        if (b0 && !b0.loadingMore) b0.historyAnchor = null;
      } catch (e) {}
      if (!appendLiveMessage(channelId, comment)) renderMessages(channelId, { mine });
      // Unfollowed arrivals pile onto the pill instead of moving the scroll.
      if (view.pinBottom) hideNewPill(); else bumpNewPill();
      flashIfReplyToMe(channelId, comment);
      // Replies/mentions to you land in the inbox even while you're looking at
      // the channel — you're reading the flow, but the inbox is the record.
      try { const k = alertKindOf(channelId, comment); if (k) addAlert(channelId, comment, k); } catch (e) {}
      try { noteSeenLive(channelId, commentTime(comment)); } catch (e) {}
    }
      else if (!hasWorldView && !isWorldChannel(channelId)) {
        unread.set(channelId, (unread.get(channelId) || 0) + 1);
        const kind = alertKindOf(channelId, comment);
        if (kind) {
          unreadReply.set(channelId, (unreadReply.get(channelId) || 0) + 1);
          addAlert(channelId, comment, kind);
        }
        emitHot();
        paintChannels();
      } else if (!hasWorldView && isWorldChannel(channelId)) {
        // Watched world thread syncing in the background: badge arrivals, record
        // qualifying ones in the inbox (ding/toast arrive via maybeNotify below).
        unread.set(channelId, (unread.get(channelId) || 0) + 1);
        try {
          if (watchAlertKind(channelId, comment)) {
            unreadReply.set(channelId, (unreadReply.get(channelId) || 0) + 1);
            addWorldAlert(channelId, comment);
          }
        } catch (e6) {}
        emitHot();
      } else {
        // World thread open elsewhere (detail panel): the thread above already
        // rendered + recorded the inbox; only the hot pip needs a nudge.
        try { emitHot(); } catch (e) {}
      }
  } else if (!hasWorldView && isWorldChannel(channelId)) {
    unread.set(channelId, (unread.get(channelId) || 0) + 1);
    try {
      if (watchAlertKind(channelId, comment)) {
        unreadReply.set(channelId, (unreadReply.get(channelId) || 0) + 1);
        addWorldAlert(channelId, comment);
      }
    } catch (e7) {}
    emitHot();
  } else if (!hasWorldView && !isWorldChannel(channelId)) {
    unread.set(channelId, (unread.get(channelId) || 0) + 1);
    const kind = alertKindOf(channelId, comment);
    if (kind) {
      unreadReply.set(channelId, (unreadReply.get(channelId) || 0) + 1);
      addAlert(channelId, comment, kind);
    }
    emitHot();
  }
  try { emitWorldCount(channelId); } catch (e5) {}
  maybeNotify(channelId, comment);
}

// Older-history backfill: the plugin only delivers the latest window, so a reply to an
// older message points at a target we never loaded (ghost preview, no tint). Each channel's
// "load more" button fetches the next older batch — pull it (bounded) until the target
// arrives or the history is exhausted, then re-render so the preview resolves and the
// highlight applies. One flight at a time per channel; silent when no button remains.
const LOAD_MORE_CAP = 6;
function targetPresent(channelId, targetId) {
  const b = backends.get(channelId);
  return !!(b && b.messages.get(targetId));
}
// Remember where the user was before an older-history fetch so the post-load
// re-render can hold the same visual position instead of jumping to the top.
function captureHistoryAnchor(channelId) {
  const b = backends.get(channelId);
  if (!b) return;
  try {
    if (view && view.active === channelId && view.msgs) {
      // Never capture mid-render: msgEl chains queueTargetLoad for ghost reply
      // targets DURING the rebuild, when the list is wiped and scrollTop reads 0.
      // Storing that collapsed geometry would fling a history reader to the
      // bottom when the batch lands — keep the previous anchor instead (or none;
      // the hold render then anchors off the live position, which stays correct).
      if (!view.msgs.querySelector(".disc-msg")) return;
      b.historyAnchor = { height: view.msgs.scrollHeight, top: view.msgs.scrollTop, at: Date.now() };
    } else b.historyAnchor = null;
  } catch (e) { b.historyAnchor = null; }
}
// Manual older-history loader: one "load more" page (200 older messages) per call.
// Shares the single-flight `loadingMore` gate with the reply backfill above, so a
// backfill in flight blocks a manual load and vice versa. Returns true when a fetch started.
function loadOlderMessages(channelId) {
  const b = backends.get(channelId);
  if (!b || !b.loaded || b.loadingMore) return false;
  // Windowed rendering first: reveal more of what's already loaded before paying
  // for another plugin fetch. Cold load shows only the newest 200; each tap here
  // (or infinite-scroll trip) widens the window by 200 until everything loaded
  // is on screen, and only then does it fetch older history.
  const limit = b.renderLimit || INITIAL_RENDER_LIMIT;
  if (b.order.length > limit) {
    b.renderLimit = Math.min(b.order.length, limit + RENDER_GROW);
    if (view && view.active === channelId) renderMessages(channelId, { hold: true });
    return true;
  }
  if (b.historyExhausted) return false;
  const btn = b.loadMoreBtn;
  if (!btn || (btn.style && btn.style.display === "none") || btn.disabled) {
    if (!btn || (btn.style && btn.style.display === "none")) {
      b.historyExhausted = true;
      if (view && view.active === channelId) renderMessages(channelId);
    }
    return false;
  }
  captureHistoryAnchor(channelId);
  b.loadingMore = true;
  b.fetchManual = true;
  // Flip the header to its spinner state now (no full re-render — that would drop
  // the scroll anchor we just captured before the new batch arrives).
  try {
    if (view && view.active === channelId && view.msgs) {
      const h = view.msgs.querySelector(".disc-history");
      if (h) {
        h.classList.add("is-loading");
        const btnEl = h.querySelector(".disc-history-btn");
        if (btnEl) { btnEl.disabled = true; btnEl.textContent = "Loading older messages…"; }
      }
    }
  } catch (e) {}
  try { btn.click(); } catch (e) { b.loadingMore = false; b.historyAnchor = null; b.fetchManual = false; return false; }
  return true;
}
// Header row pinned to the top of the message list: load-older button, loading
// spinner, or the "beginning of history" end-state. Null when nothing to show.
function historyHeaderEl(channelId) {
  const b = backends.get(channelId);
  if (!b || !b.loaded || b.failed || !b.order.length) return null;
  const wrap = document.createElement("div");
  const limit = b.renderLimit || INITIAL_RENDER_LIMIT;
  // More loaded than shown: the button widens the window (no fetch). Only once
  // everything loaded is visible does the button fetch older history (or the
  // end-state shows when the plugin reports exhaustion).
  if (b.order.length > limit) {
    const hidden = b.order.length - limit;
    wrap.className = "disc-history" + (b.loadingMore ? " is-loading" : "");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "disc-history-btn";
    btn.disabled = !!b.loadingMore;
    btn.textContent = b.loadingMore ? "Loading older messages…" : `↑ Show older messages · showing ${limit} of ${b.order.length}`;
    btn.title = `${hidden} more loaded messages`;
    btn.onclick = () => { loadOlderMessages(channelId); };
    wrap.appendChild(btn);
    return wrap;
  }
  if (b.historyExhausted || !b.loadMoreBtn || (b.loadMoreBtn.style && b.loadMoreBtn.style.display === "none")) {
    wrap.className = "disc-history is-end";
    wrap.textContent = `Beginning of #${channelId} history · ${b.order.length} messages`;
    return wrap;
  }
  wrap.className = "disc-history" + (b.loadingMore ? " is-loading" : "");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "disc-history-btn";
  btn.disabled = !!b.loadingMore;
  btn.textContent = b.loadingMore ? "Loading older messages…" : `↑ Load older messages · showing ${b.order.length}`;
  btn.onclick = () => { loadOlderMessages(channelId); };
  wrap.appendChild(btn);
  return wrap;
}
function queueTargetLoad(channelId, targetId) {
  if (!targetId) return;
  const b = backends.get(channelId);
  if (!b || b.loadingMore) return;
  if (targetPresent(channelId, targetId)) return;
  const tries = b.pendingTargets.get(targetId) || 0;
  if (tries >= LOAD_MORE_CAP) return;
  const btn = b.loadMoreBtn;
  if (!btn || btn.style.display === "none" || btn.disabled) return;
  captureHistoryAnchor(channelId);
  b.loadingMore = true;
  b.fetchManual = false;
  b.pendingTargets.set(targetId, tries + 1);
  try { btn.click(); } catch (e) { b.loadingMore = false; b.historyAnchor = null; }
}
function retryPendingLoads(channelId) {
  const b = backends.get(channelId);
  if (!b || !b.pendingTargets.size) return;
  for (const tid of [...b.pendingTargets.keys()]) {
    if (targetPresent(channelId, tid)) { b.pendingTargets.delete(tid); continue; }
    const tries = b.pendingTargets.get(tid) || 0;
    if (tries >= LOAD_MORE_CAP) { b.pendingTargets.delete(tid); continue; }
    const btn = b.loadMoreBtn;
    if (!btn || btn.style.display === "none" || btn.disabled) {
      if (!btn || btn.style.display === "none") {
        b.historyExhausted = true;
        if (view && view.active === channelId) renderMessages(channelId);
      }
      b.pendingTargets.delete(tid); continue;
    }
    queueTargetLoad(channelId, tid); // loadingMore is false here — chains the next batch
    if (b.loadingMore) break; // one flight at a time; onLoadMore continues the chain
  }
}

// Split a raw message into its reply reference (if any) and its display body.
// Claimed senders also tag their stable app userId (`⟦uid:<16-hex>⟧`, either order —
// see submitBody); receivers verify it against the server (see verifiedFor). Both
// headers are machine data and are always stripped — verified or not, so a forged tag
// never shows up as text.
const UID_RE = /^⟦uid:([0-9a-fA-F]{16})⟧\s?/;
function parseReply(text) {
  let s = String(text == null ? "" : text);
  let targetId = null, tagUid = null;
  for (let i = 0; i < 2; i++) {
    let m = REPLY_RE.exec(s);
    if (m) {
      if (targetId) break; // a second reply header stays body text, as before
      targetId = m[1]; s = s.slice(m[0].length); continue;
    }
    m = UID_RE.exec(s);
    if (!m) break;
    if (!tagUid) tagUid = m[1].toLowerCase();
    s = s.slice(m[0].length);
  }
  return { targetId, tagUid, body: s };
}
// Plain-text excerpt for previews and notifications (never HTML — comment.message is unsafe).
function excerptOf(comment, len = EXCERPT_LEN) {
  const { body } = parseReply(comment && comment.message);
  const stk = stickerOf(body);
  if (stk) return `:${stk}:`;
  const s = String(body).replace(/\s+/g, " ").trim();
  return s.length > len ? s.slice(0, len - 1) + "…" : s;
}

// ---- notifications ----------------------------------------------------------
// In-app toast stack (clickable — jumps to the channel), plus the browser
// Notification API when notifications are on and permission is granted. Only live
// arrivals (onComment) ever notify; the initial onLoad batch and your own
// messages stay silent.
function toastRoot() {
  let el = document.getElementById("discToasts");
  if (!el) {
    el = document.createElement("div");
    el.id = "discToasts";
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  return el;
}

function showToast(channelId, comment, opts) {
  const root = toastRoot();
  while (root.children.length >= 3) root.firstChild.remove();
  const reply = !!(opts && opts.reply);
  const mention = !!(opts && opts.mention);
  const hot = reply || mention;
  const msgId = opts && opts.msgId;
  const label = isWorldChannel(channelId) ? worldDisplayName(channelId) : String(channelId);
  const t = document.createElement("button");
  t.type = "button";
  t.className = "disc-toast" + (hot ? " is-reply" : "");
  const ch = document.createElement("span");
  ch.className = "disc-toast-ch";
  ch.textContent = label;
  const who = document.createElement("span");
  who.className = "disc-toast-who";
  paintAuthorName(who, comment);
  if (reply) who.append(document.createTextNode(" replied to you"));
  else if (mention) who.append(document.createTextNode(" mentioned you"));
  const tx = document.createElement("span");
  tx.className = "disc-toast-tx";
  tx.textContent = excerptOf(comment) || "(empty message)";
  const x = document.createElement("span");
  x.className = "disc-toast-x";
  x.textContent = "✕";
  x.title = "Dismiss";
  t.append(ch, who, tx, x);
  const go = () => {
    t.remove();
    if (isWorldChannel(channelId)) { requestWorldJump(channelId, hot && msgId ? msgId : null); return; }
    requestJump(channelId);
    // Delayed: from another page the Discussion view (and its backend) only exists
    // after navigation + load — jumpToMessageSoon retries until then.
    if (hot && msgId) setTimeout(() => jumpToMessageSoon(msgId), 200);
  };
  t.onclick = (e) => { if (e.target === x) { e.stopPropagation(); t.remove(); return; } go(); };
  root.appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, hot ? 9000 : 6000);
}

function browserNotify(channelId, comment, opts) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return false;
    const reply = !!(opts && opts.reply);
    const mention = !!(opts && opts.mention);
    const verb = reply ? "replied to you" : mention ? "mentioned you" : null;
    const label = isWorldChannel(channelId) ? worldDisplayName(channelId) : String(channelId);
    const n = new Notification(
      verb ? `${label} · ${commentAuthor(comment)} ${verb}` : `${label} · ${commentAuthor(comment)}`,
      {
        body: excerptOf(comment) || "(empty message)",
        tag: reply ? `disc-reply-${channelId}` : mention ? `disc-mention-${channelId}` : `disc-${channelId}`,
      }
    );
    n.onclick = () => {
      try { window.focus(); } catch (e) {}
      if (isWorldChannel(channelId)) requestWorldJump(channelId);
      else requestJump(channelId);
      n.close();
    };
    return true;
  } catch (e) { return false; }
}

// A message's reply target: our `⟦reply:id⟧` header first, then the plugin's native
// `replyingTo` (another client — e.g. the raw embed UI — can only set the latter,
// and its context shouldn't be silently dropped here).
function replyTargetOf(comment) {
  const { targetId } = parseReply(comment && comment.message);
  if (targetId) return targetId;
  const nat = comment && comment.replyingTo;
  if (nat === null || nat === undefined || nat === "") return null;
  return String(nat);
}
// Nicknames wear the username character set (letters/numbers, with space, _ - . in
// the middle), so a nickname can never smuggle markup, a forged discriminator (#), or a
// fake @mention into the chat. Same 3–20 characters as usernames (see validateUsername
// in community.js) — every message carries a real name.
function nickError(n) {
  const t = String(n || "").trim();
  if (t.length < 3 || t.length > 20) return "Nicknames are 3–20 characters.";
  if (!/^[\p{L}\p{N}](?:[\p{L}\p{N} _.\-]*[\p{L}\p{N}])?$/u.test(t)) {
    return "Nicknames are letters and numbers, with space, _ - or . in the middle — same as usernames.";
  }
  return "";
}

// Your current nickname — the claimed MNO username when you have one, else the
// saved nickname. The config field can hold an unsaved draft, so sends never read
// it directly; only Save may promote a validated value into storage.
function myNick() {
  if (claimedName) return claimedName;
  try {
    return String(loadNick() || "").trim();
  } catch (e) { return ""; }
}
// World comment threads are gated to chatters: a claimed MNO username (whose
// messages show verified) or a saved Tavern nickname. Same predicate the Tavern
// welcome gate uses (maybeShowTavernWelcome) — the name your sends would carry.
// Async only because a claimed identity resolves from storage on first read;
// nothing is minted (identityOrNull inside loadClaimedName never creates one).
export async function ensureCommentIdentity() {
  try { await loadClaimedName(); } catch (e) {}
  return myNick();
}
function nickOf(comment) {
  try {
    const u = (comment && comment.user) || {};
    return String(u.nickname == null ? "" : u.nickname).trim();
  } catch (e) { return ""; }
}
// Your own message on ANY device/network — not just this connection. The plugin's
// byCurrentUser is per-connection (same browser, same network), so a verified identity
// also matches by username: your nick is your unique MNO username and claimed sends
// carry your stable app userId tag. Nick alone is never enough (free text — anyone
// can type it), the tag (or a server-verified tag) must agree. Unclaimed users have
// no username, so only byCurrentUser counts for them.
function isMine(comment) {
  if (!comment) return false;
  // The plugin flag is network-based, not device-based: a different identity on
  // the same network (same household WiFi) shares it. Unclaimed users have no
  // better identity, so the flag alone counts — but a claimed identity must also
  // see its own nickname (claimed sends always carry it). Otherwise the other
  // device's messages count as mine and replies to them highlight here.
  if (comment.byCurrentUser) {
    if (!claimedName) return true;
    try {
      const nick = nickOf(comment);
      if (nick && normNick(nick) === normNick(claimedName)) return true;
    } catch (e) {}
    // Different (or empty) nickname under a claimed identity: not mine on the
    // flag's word — fall through to the uid-tag / verified checks below, which
    // fail for another identity's messages.
  }
  if (!claimedName) return false;
  const nick = nickOf(comment);
  if (!nick || normNick(nick) !== normNick(claimedName)) return false;
  try {
    const tag = parseReply(comment && comment.message).tagUid;
    if (tag && claimedUserId && String(tag).toLowerCase() === String(claimedUserId).toLowerCase()) return true;
  } catch (e) {}
  try {
    const v = verifiedFor(comment);
    if (v && normNick(v.username) === normNick(claimedName)) return true;
  } catch (e) {}
  return false;
}
// ---- @mentions --------------------------------------------------------------
// Two forms: single-token `@name` (no spaces) and quoted multi-word
// `@"First Last"` for nicknames with spaces (same charset as nicknames — the
// closing quote is an explicit terminator). Rendered sync as bold
// `.disc-mention` spans via a text-node walk (never regexed HTML — code chips and
// spoiler interiors are skipped), then upgraded in place: a token the catalog confirms
// (getUserByName, cached per session) becomes a profile button; anything else stays a
// span. Same name-exists caveat as the world-text @mentions: a match proves the NAME
// exists, not that the sender meant that person.
const MENTION_TOKEN = "[\\p{L}\\p{N}](?:[\\p{L}\\p{N}_.\\-]{0,18}[\\p{L}\\p{N}])?";
// The MENTION_RE_SRC predecessor excludes `/` so `/@user` inside a URL stays URL
// text for the external-link pass below (and never pings a notification).
const MENTION_QUOTED = "\"([\\p{L}\\p{N}](?:[\\p{L}\\p{N} _.\\-]{0,18}[\\p{L}\\p{N}])?)\"";
const MENTION_RE_SRC = `(^|[^\\p{L}\\p{N}_.\\-/@])@(?:${MENTION_QUOTED}(?![\\p{L}\\p{N}])|(${MENTION_TOKEN})(?![\\p{L}\\p{N}_.\\-]))`;
const mentionCache = new Map(); // norm token -> "pending" | username | null
async function resolveMentionToken(token) {
  const key = normNick(token);
  if (!key || mentionCache.has(key)) return mentionCache.get(key) || null;
  mentionCache.set(key, "pending");
  try {
    const m = await import("./community.js");
    const u = await m.getUserByName(String(token).trim());
    mentionCache.set(key, (u && u.username) || null);
  } catch (e) { mentionCache.set(key, null); }
  txtRev++;
  try { scheduleRender(); } catch (e2) {}
  return mentionCache.get(key) || null;
}
function mentionTokensOf(text) {
  const out = [];
  const re = new RegExp(MENTION_RE_SRC, "gu");
  for (const m of String(text == null ? "" : text).matchAll(re)) {
    const tok = m[2] != null ? m[2] : m[3];
    if (tok && !out.some((t) => normNick(t) === normNick(tok))) out.push(tok);
  }
  return out;
}
// Wrap @tokens in a rendered message body with mention spans (upgrading confirmed ones
// to profile buttons). `found` collects tokens still needing verification.
function paintMentions(txt, found) {
  let walker = null;
  try {
    walker = document.createTreeWalker(txt, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || node.nodeValue.indexOf("@") === -1) return NodeFilter.FILTER_REJECT;
        const p = node.parentElement;
        if (p && p.closest("code, pre, .spoiler")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
  } catch (e) { return; }
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const frag = mentionFrag(node.nodeValue, found);
    if (frag) node.replaceWith(frag);
  }
}
function mentionFrag(text, found) {
  const re = new RegExp(MENTION_RE_SRC, "gu");
  let m, last = 0, frag = null;
  while ((m = re.exec(text))) {
    const tok = m[2] != null ? m[2] : m[3];
    const at = m.index + m[1].length;
    if (!frag) frag = document.createDocumentFragment();
    if (at > last) frag.append(document.createTextNode(text.slice(last, at)));
    const hit = mentionCache.get(normNick(tok));
    let el;
    if (hit && hit !== "pending") {
      el = document.createElement("button");
      el.type = "button";
      el.className = "disc-mention is-user";
      el.title = `Open @${hit}'s profile`;
      el.setAttribute("aria-label", `Open profile of ${hit}`);
      el.onclick = () => openAuthorProfile(hit);
    } else {
      el = document.createElement("span");
      el.className = "disc-mention";
      if (found) found.add(tok);
    }
    el.textContent = "@" + tok;
    el.dataset.mention = tok;
    frag.append(el);
    last = at + (m[0].length - m[1].length);
  }
  if (!frag) return null;
  if (last < text.length) frag.append(document.createTextNode(text.slice(last)));
  return frag;
}
// ---- @ autocomplete + : sticker autocomplete (both composers) ------------------
// Typing @ pops a roster list above the composer (same popover chrome as the
// sticker picker): recent channel nicknames filtered by prefix. Accepting
// inserts the canonical mention — @"First Last" for spaced names, @name
// otherwise — so spaced names never need hand-typed quotes. Typing : pops the
// same list filtered over the shipped sticker set (query of 1+ chars — bare
// colons are everywhere, and times/URLs/smileys must never trigger); accepting
// inserts the full :name: token exactly as if typed by hand.
// Shared by the Tavern composer (view) and every world-thread composer (wv):
// each function takes its target and reads that target's channel + popup refs.
const AC_MAX_ROWS = 8;
function acChannelOf(t) {
  try {
    if (!t) return "";
    if (t.active) return t.active;
    if (t.channelId) return t.channelId;
  } catch (e) {}
  return "";
}
function acRoster(t) {
  const found = new Map(); // normNick -> { name, hue, avatar, at }
  const ch = acChannelOf(t);
  if (!ch) return [];
  try {
    const b = backends.get(ch);
    if (!b || !b.order || !b.messages) return [];
    const ids = b.order;
    // Newest-first, capped: the name/hue come from each nick's latest message,
    // but the avatar is taken from its latest VERIFIED one — the tail of a
    // busy channel is often untagged (other clients don't mint the uid tag),
    // while an older message from the same nick still identifies them.
    const scanned = Math.min(ids.length, 500);
    for (let i = ids.length - 1; i >= ids.length - scanned; i--) {
      let c = null;
      try { c = b.messages.get(ids[i]); } catch (e) {}
      const name = nickOf(c);
      if (!name) continue;
      const k = normNick(name);
      if (!k) continue;
      let e2 = found.get(k);
      if (!e2) {
        if (found.size >= 60) continue;
        const u = (c && c.user) || {};
        let hue = 40;
        try { hue = authorHue([u.nickname, u.visualId, u.id].filter(Boolean).join("|") || name); } catch (e) {}
        e2 = { name, hue, avatar: "", at: i };
        found.set(k, e2);
      }
      if (!e2.avatar) {
        try {
          const v = verifiedFor(c);
          const a = v && v.avatar ? String(v.avatar) : "";
          if (/^https:\/\//i.test(a)) e2.avatar = a;
        } catch (e) {}
      }
    }
  } catch (e) {}
  return [...found.values()]
    .sort((a, b2) => b2.at - a.at)
    .slice(0, 60)
    .map(({ name, hue, avatar }) => ({ name, hue, avatar }));
}
// The mention- or sticker-in-progress under the caret: the @ plus following
// word chars (a typed opening quote rides along and is swapped out on accept),
// or a : plus 1+ sticker chars (bare colons, times, URLs and smileys never
// match). Null when the caret isn't inside a candidate. The two are mutually
// exclusive in practice — a mention query can't contain ':'.
function acTokenAt(input) {
  if (!input) return null;
  let caret = null;
  try { caret = input.selectionStart; } catch (e) { return null; }
  if (caret == null) return null;
  const before = String(input.value || "").slice(0, caret);
  let m = before.match(/(^|[^\p{L}\p{N}_.@-])@(["\p{L}\p{N} _.\-]{0,24})$/u);
  if (m) return { start: caret - (m[0].length - m[1].length), query: m[2], kind: "mention" };
  m = before.match(/(^|[^\p{L}\p{N}_.@:-]):([a-z0-9-]{1,24})$/iu);
  if (m) return { start: caret - (m[0].length - m[1].length), query: m[2], kind: "sticker" };
  return null;
}
function acRowsFor(t, query, kind) {
  if (kind === "sticker") {
    const q = String(query || "").toLowerCase();
    if (!q) return [];
    return STICKERS.filter((n) => n.startsWith(q)).slice(0, AC_MAX_ROWS)
      .map((name) => ({ kind: "sticker", sticker: name }));
  }
  const q = normNick(String(query || "").replace(/"/g, ""));
  const roster = acRoster(t);
  if (!q) return roster.slice(0, AC_MAX_ROWS).map((r) => ({ kind: "mention", ...r }));
  return roster.filter((r) => normNick(r.name).startsWith(q)).slice(0, AC_MAX_ROWS)
    .map((r) => ({ kind: "mention", ...r }));
}
function acUpdate(t) {
  if (!t || !t.input || !t.acPicker || !t.acList) return;
  const tok = acTokenAt(t.input);
  if (!tok) { acClose(t); return; }
  const rows = acRowsFor(t, tok.query, tok.kind);
  if (!rows.length) { acClose(t); return; }
  try { t.acList.setAttribute("aria-label", tok.kind === "sticker" ? "Insert a sticker" : "Mention someone"); } catch (e) {}
  t.acToken = tok;
  t.acRows = rows;
  if (t.acActive == null || t.acActive >= rows.length) t.acActive = 0;
  acPaint(t);
  t.acPicker.hidden = false;
}
function acPaint(t) {
  if (!t || !t.acList) return;
  const list = t.acList;
  list.innerHTML = "";
  (t.acRows || []).forEach((r, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "disc-acrow" + (r.kind === "sticker" ? " is-stk" : "") + (i === t.acActive ? " on" : "");
    b.setAttribute("role", "option");
    b.setAttribute("aria-selected", i === t.acActive ? "true" : "false");
    const av = document.createElement("span");
    av.className = "disc-acav" + (r.kind === "sticker" ? " is-stk" : "");
    if (r.kind === "sticker") {
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.draggable = false;
      img.src = `src/stickers/${r.sticker}.webp`;
      img.onerror = () => { try { img.remove(); } catch (e) {} };
      av.appendChild(img);
    } else {
      // Letter stays behind as the fallback (same as .disc-av): if the remote
      // image fails it is removed and the letter shows through.
      av.textContent = (String(r.name).trim().charAt(0) || "?").toUpperCase();
      if (r.avatar) {
        const img = document.createElement("img");
        img.alt = "";
        img.loading = "lazy";
        img.referrerPolicy = "no-referrer";
        img.draggable = false;
        img.src = r.avatar;
        img.onerror = () => { try { img.remove(); } catch (e) {} };
        av.appendChild(img);
      }
      try { av.style.setProperty("--av-hue", String(r.hue)); } catch (e) {}
    }
    const nm = document.createElement("span");
    nm.className = "disc-acname";
    nm.textContent = r.kind === "sticker" ? `:${r.sticker}:` : r.name;
    b.append(av, nm);
    // pointerdown (not click) + preventDefault: the tap inserts without ever
    // blurring the textarea, so the mobile keyboard stays up.
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); acAccept(t, i); });
    list.appendChild(b);
  });
}
function acMove(t, d) {
  if (!t || !t.acRows || !t.acRows.length) return;
  t.acActive = (((t.acActive || 0) + d) % t.acRows.length + t.acRows.length) % t.acRows.length;
  acPaint(t);
  try {
    const el = t.acList && t.acList.children[t.acActive];
    if (el) el.scrollIntoView({ block: "nearest" });
  } catch (e) {}
}
function acAccept(t, i) {
  if (!t || !t.input || !t.acToken) return;
  const rows = t.acRows || [];
  const r = rows[i] != null ? rows[i] : rows[t.acActive || 0];
  if (!r) { acClose(t); return; }
  const insert = r.kind === "sticker" ? `:${r.sticker}: `
    : (r.name.indexOf(" ") !== -1 ? `@"${r.name}"` : `@${r.name}`) + " ";
  const el = t.input;
  let caret = 0;
  try { caret = el.selectionStart; } catch (e) {}
  el.value = el.value.slice(0, t.acToken.start) + insert + el.value.slice(caret);
  const pos = t.acToken.start + insert.length;
  try { el.selectionStart = el.selectionEnd = pos; } catch (e) {}
  acClose(t);
  if (t === view) {
    autosizeComposer(view);
    try { textDrafts.set(t.active, el.value); } catch (e) {}
    updateComposerSendState(view);
  } else {
    autosizeComposer(t);
    try { textDrafts.set(t.channelId, el.value); } catch (e) {}
    updateComposerSendState(t);
  }
  try { el.focus({ preventScroll: true }); } catch (e) {}
}
function acClose(t) {
  if (!t) return;
  t.acToken = null;
  t.acRows = null;
  t.acActive = 0;
  try { if (t.acPicker) t.acPicker.hidden = true; } catch (e) {}
}
// ---- #channel tags ----------------------------------------------------------
// A `#channel` token naming a real channel becomes a button that opens it —
// same text-node walk as mentions, so code chips, spoiler interiors, links and
// already-built buttons never convert. Unknown names stay plain text.
function paintChannelTags(txt) {
  let walker = null;
  try {
    walker = document.createTreeWalker(txt, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || node.nodeValue.indexOf("#") === -1) return NodeFilter.FILTER_REJECT;
        const p = node.parentElement;
        if (p && p.closest("code, pre, .spoiler, a, button")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
  } catch (e) { return; }
  const nodes = [];
  try { while (walker.nextNode()) nodes.push(walker.currentNode); } catch (e) { return; }
  // Canonical id -> id, so `#World-Craft` still finds `world-craft`.
  let byId = null;
  try {
    byId = new Map(visibleChannels().map((c) => [String(c.id).toLowerCase(), c.id]));
  } catch (e) { return; }
  const re = /(^|[^\p{L}\p{N}_.\-/#@])#([A-Za-z0-9][A-Za-z0-9-]*)(?![\p{L}\p{N}_.\-])/gu;
  for (const node of nodes) {
    const text = node.nodeValue;
    let m, last = 0, frag = null;
    re.lastIndex = 0;
    while ((m = re.exec(text))) {
      const id = byId.get(m[2].toLowerCase());
      if (!id) continue;
      const at = m.index + m[1].length;
      if (!frag) frag = document.createDocumentFragment();
      if (at > last) frag.append(document.createTextNode(text.slice(last, at)));
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "disc-chantag";
      btn.dataset.channel = id;
      btn.title = `Open #${id}`;
      btn.setAttribute("aria-label", `Open channel ${id}`);
      btn.textContent = "#" + m[2];
      btn.onclick = () => { if (view && view.active !== id) switchChannel(id); };
      frag.append(btn);
      last = at + 1 + m[2].length;
    }
    if (frag) {
      if (last < text.length) frag.append(document.createTextNode(text.slice(last)));
      node.replaceWith(frag);
    }
  }
}
// Typed `:name:` tokens inside longer text render as small inline stickers (the
// picker's `:name:` titles already teach the spelling, and quoted excerpts read that
// way too). Text-node walk like mentions — code, spoilers and links never convert.
function paintInlineStickers(txt) {
  let walker = null;
  try {
    walker = document.createTreeWalker(txt, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || node.nodeValue.indexOf(":") === -1) return NodeFilter.FILTER_REJECT;
        const p = node.parentElement;
        if (p && p.closest("code, pre, .spoiler, a")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
  } catch (e) { return; }
  const nodes = [];
  try { while (walker.nextNode()) nodes.push(walker.currentNode); } catch (e) { return; }
  for (const node of nodes) {
    const frag = stickerFrag(node.nodeValue);
    if (frag) node.replaceWith(frag);
  }
}
function stickerFrag(text) {
  const re = /:([a-z0-9-]+):/gi;
  let m, last = 0, frag = null;
  while ((m = re.exec(text))) {
    const name = String(m[1] || "").toLowerCase();
    // Unknown names stay plain text (lastIndex already advanced — no stall).
    if (!STICKER_SET.has(name)) continue;
    if (!frag) frag = document.createDocumentFragment();
    if (m.index > last) frag.append(document.createTextNode(text.slice(last, m.index)));
    const img = document.createElement("img");
    img.className = "disc-sticker-inline";
    img.src = `src/stickers/${name}.webp`;
    img.alt = `:${name}:`;
    img.title = `:${name}:`;
    img.loading = "lazy";
    img.draggable = false;
    frag.append(img);
    last = m.index + m[0].length;
  }
  if (!frag) return null;
  if (last < text.length) frag.append(document.createTextNode(text.slice(last)));
  return frag;
}
// True when someone else's message @-mentions you (your claimed name, else your current
// nickname — same convenience bridge as the reply nickname match, not an identity proof).
function mentionsMe(comment) {
  if (!comment || isMine(comment)) return false;
  const me = normNick(myNick());
  if (!me) return false;
  const { body } = parseReply(comment && comment.message);
  for (const tok of mentionTokensOf(body)) {
    if (normNick(tok) === me) return true;
  }
  return false;
}
// ---- world link cards -------------------------------------------------------
// A shared world link (`https://perchance.org/<gen>#explore/<id>`, or the bare
// `#explore/<id>` fragment) renders as a mini world card under the message text.
// World ids are `[a-z0-9][a-z0-9-]` (see openLinkedWorld's gate), so trailing
// punctuation never sticks to the match — one trailing sentence punct (`.,;:!?)`)
// Redacted cards hide themselves while the reader's Show NSFW is off (title and
// description redacted as █ blocks, no cover image) and warn before opening.
const WCARD_RE = /(?:https?:\/\/perchance\.org\/[^\s"'<>]*?#explore\/|#explore\/)([a-z0-9][a-z0-9-]{2,79})[.,;:!?)]?/gi;
const wcardCache = new Map(); // worldId -> "pending" | card data | null (known miss)
async function resolveWorldCard(worldId) {
  const key = String(worldId || "");
  if (!key || wcardCache.has(key)) return wcardCache.get(key) || null;
  wcardCache.set(key, "pending");
  try {
    const m = await import("./community.js");
    wcardCache.set(key, await m.fetchWorldCard(key));
  } catch (e) { wcardCache.set(key, null); }
  txtRev++;
  try { scheduleRender(); } catch (e2) {}
  return wcardCache.get(key) || null;
}
function worldIdsOf(txt) {
  const out = [];
  const walker = document.createTreeWalker(txt, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || node.nodeValue.indexOf("#explore/") === -1) return NodeFilter.FILTER_REJECT;
      const p = node.parentElement;
      if (p && p.closest("code, pre, .spoiler, a")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes = [];
  try { while (walker.nextNode()) nodes.push(walker.currentNode); } catch (e) { return out; }
  for (const node of nodes) {
    // Fresh regex per node (a shared /g regex carries lastIndex state).
    const re = new RegExp(WCARD_RE.source, "gi");
    if (!re.test(node.nodeValue)) continue;
    // Strip the link from the text — the card below says it all. Collapse the gap
    // so "try this <link>!" doesn't leave a double space behind.
    re.lastIndex = 0;
    node.nodeValue = node.nodeValue.replace(re, (m0, id) => {
      if (id && !out.includes(id) && out.length < 3) out.push(id);
      return "";
    }).replace(/[ \t]{2,}/g, " ");
  }
  return out;
}
// The link is stripped from the text and the card is the embed (chat-app style: the
// URL itself never doubles up next to its own preview).
function paintWorldCards(txt) {
  const ids = worldIdsOf(txt);
  if (!ids.length) return;
  const strip = document.createElement("div");
  strip.className = "disc-wcards";
  for (const id of ids) strip.append(worldCardEl(id));
  txt.append(strip);
  // Link-only message: no text left to show, so the text goes away entirely.
  try {
    const w = document.createTreeWalker(txt, NodeFilter.SHOW_TEXT);
    let n, left = false;
    while ((n = w.nextNode())) {
      if (n.parentElement && n.parentElement.closest(".disc-wcards")) continue;
      if (n.nodeValue.trim()) { left = true; break; }
    }
    if (!left) txt.replaceChildren(strip);
  } catch (e) {}
}
// ---- external links (confirm-first) ------------------------------------------
// Bare http(s) URLs — anything but world-card links, which paintWorldCards
// strips first — become buttons: tapping one pops a leaving-the-app confirm,
// and only an explicit Open leaves (new tab, noopener). Same text-node walk
// discipline as mentions/channel tags, so code chips, spoiler interiors and
// already-built links/buttons never convert — including the world cards
// appended just above, whose titles could contain a URL of their own.
const EXTLINK_RE = /\bhttps?:\/\/[^\s"'<>\]]+/gi;
function extUrlOk(u) {
  try {
    const p = new URL(String(u || ""));
    return p.protocol === "http:" || p.protocol === "https:";
  } catch (e) { return false; }
}
function paintExtLinks(txt) {
  ensureExtLinkWired();
  let walker = null;
  try {
    walker = document.createTreeWalker(txt, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || node.nodeValue.indexOf("://") === -1) return NodeFilter.FILTER_REJECT;
        const p = node.parentElement;
        if (p && p.closest("code, pre, .spoiler, a, button, .disc-wcards")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
  } catch (e) { return; }
  const nodes = [];
  try { while (walker.nextNode()) nodes.push(walker.currentNode); } catch (e) { return; }
  for (const node of nodes) {
    const text = node.nodeValue;
    // Fresh regex per node (a shared /g regex carries lastIndex state).
    const re = new RegExp(EXTLINK_RE.source, "gi");
    let m, last = 0, frag = null;
    while ((m = re.exec(text))) {
      let url = m[0];
      // Trailing sentence punctuation is prose, not address; a trailing ")"
      // only sticks when it closes a paren inside the URL (Wikipedia titles).
      url = url.replace(/[.,;:!?'"}\]]+$/, "");
      let opens = 0, closes = 0;
      for (const ch of url) {
        if (ch === "(") opens++;
        else if (ch === ")") closes++;
      }
      while (closes > opens && url.endsWith(")")) { url = url.slice(0, -1); closes--; }
      const tail = m[0].slice(url.length);
      if (!url || !extUrlOk(url)) continue;
      if (!frag) frag = document.createDocumentFragment();
      if (m.index > last) frag.append(document.createTextNode(text.slice(last, m.index)));
      const b = document.createElement("button");
      b.type = "button";
      b.className = "disc-extlink";
      b.dataset.url = url;
      b.title = url;
      b.setAttribute("aria-label", `Open external link ${url} — asks first`);
      b.textContent = url;
      frag.append(b);
      last = m.index + m[0].length;
      if (tail) frag.append(document.createTextNode(tail));
    }
    if (!frag) continue;
    if (last < text.length) frag.append(document.createTextNode(text.slice(last)));
    try { node.parentNode.replaceChild(frag, node); } catch (e) {}
  }
}
let extLinkWired = false;
function ensureExtLinkWired() {
  if (extLinkWired) return;
  extLinkWired = true;
  // One document-level listener covers the Tavern, every world thread, and any
  // future surface that renders msgEl HTML — the buttons carry their URL along.
  try {
    document.addEventListener("click", (e) => {
      const b = e.target && e.target.closest ? e.target.closest(".disc-extlink") : null;
      if (!b || !b.dataset) return;
      const url = b.dataset.url || "";
      if (!extUrlOk(url)) return;
      e.preventDefault();
      e.stopPropagation();
      showExtLinkConfirm(url);
    });
  } catch (e) {}
}
let extLinkOpen = false;
function showExtLinkConfirm(url) {
  if (extLinkOpen) return;
  extLinkOpen = true;
  const overlay = document.createElement("div");
  overlay.className = "popup-overlay disc-extlink-overlay";
  overlay.innerHTML = `
    <div class="popup confirm-pop">
      <div class="popup-head"><span class="popup-title">Open external link?</span><button class="popup-x" type="button" title="Close" aria-label="Close">✕</button></div>
      <div class="confirm-msg"><span>You're leaving the app — this link goes to a site outside MNO RPG Engine. Only open it if you trust the sender.</span><div class="disc-exturl"></div></div>
      <div class="popup-acts">
        <button class="mini popup-cancel">Cancel</button>
        <a class="mini ok disc-extlink-open" target="_blank" rel="noopener noreferrer">Open in new tab</a>
      </div>
    </div>`;
  try { overlay.querySelector(".disc-exturl").textContent = url; } catch (e) {}
  try { overlay.querySelector(".disc-extlink-open").setAttribute("href", url); } catch (e) {}
  const done = () => {
    try { if (release) release(); } catch (e) {}
    try { overlay.remove(); } catch (e) {}
    extLinkOpen = false;
  };
  let release = null;
  try { release = pushBackClose(() => done()); } catch (e) { release = null; }
  try { overlay.querySelector(".popup-x").onclick = done; } catch (e) {}
  try { overlay.querySelector(".popup-cancel").onclick = done; } catch (e) {}
  // A real anchor (not window.open): the user's own click is the navigation, so
  // blockers and sandboxed frames treat it like any normal link. Closing the
  // popup here doesn't cancel the new tab — the default action still runs.
  try { overlay.querySelector(".disc-extlink-open").addEventListener("click", () => done()); } catch (e) {}
  try { overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) done(); }); } catch (e) {}
  try { overlay.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); done(); } }); } catch (e) {}
  try { document.body.appendChild(overlay); } catch (e) { extLinkOpen = false; return; }
  try { overlay.querySelector(".popup-cancel").focus(); } catch (e) {}
}
function worldCardEl(worldId) {
  const hit = wcardCache.get(worldId);
  if (hit === undefined) resolveWorldCard(worldId);
  if (hit && hit !== "pending") return filledWorldCard(hit);
  if (hit === null) {
    const miss = document.createElement("div");
    miss.className = "disc-wcard is-miss";
    miss.textContent = "🔗 World link (no preview — it may be unpublished)";
    return miss;
  }
  const loading = document.createElement("button");
  loading.type = "button";
  loading.className = "disc-wcard is-loading";
  loading.disabled = true;
  loading.textContent = "◇ Loading world…";
  return loading;
}
function filledWorldCard(c) {
  // Redacted while the reader keeps Show NSFW off: the title and description
  // render REDACTED (█ blocks) with no cover image — tapping the card warns
  // first instead of opening the world.
  const redacted = !!c.nsfw && !showNsfw();
  // Redact body text while keeping its shape (spaces stay spaces), so the card
  // keeps its layout but leaks no readable content.
  const redact = (s) => String(s || "").replace(/[^\s]/g, "█");
  const card = document.createElement("button");
  card.type = "button";
  card.className = "disc-wcard" + (redacted ? " is-redacted" : "");
  if (redacted) {
    card.title = "NSFW World"
    card.setAttribute("aria-label", "NSFW world, content redacted. Activate for a warning and the option to open it.");
  } else {
    card.title = `Open "${c.title}"`;
    card.setAttribute("aria-label", `Open world ${c.title}`);
  }
  card.onclick = async () => {
    if (c.nsfw) {
      try { if (!showNsfw()) { showRedactedCardWarning(c, card); return; } } catch (e) {}
    }
    openWorldCardDetails(card, c.worldId);
  };
  const cover = document.createElement("span");
  cover.className = "disc-wcard-cover";
  if (redacted) {
    // Redacted: letter tile only, no cover image.
    cover.append(document.createTextNode(String(c.title || "?").trim().charAt(0).toUpperCase() || "?"));
  } else {
    // Full preview (Show NSFW on, or a non-NSFW world): the cover image when
    // the catalog has one, letter tile behind it as the fallback.
    if (c.coverUrl && /^https:\/\//i.test(c.coverUrl)) {
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      img.src = c.coverUrl;
      img.onerror = () => { try { img.remove(); } catch (e) {} };
      cover.append(img);
    }
    cover.append(document.createTextNode(String(c.title || "?").trim().charAt(0).toUpperCase() || "?"));
  }
  cover.style.setProperty("--av-hue", String(authorHue(c.worldId)));
  const bodyBox = document.createElement("span");
  bodyBox.className = "disc-wcard-body";
  const title = document.createElement("span");
  title.className = "disc-wcard-title";
  title.textContent = (c.nsfw ? "🔞 " : "") + (redacted ? redact(c.title) : c.title) + (c.hidden ? " (hidden)" : "");
  const meta = document.createElement("span");
  meta.className = "disc-wcard-meta";
  meta.textContent = `@${c.authorName} · ♥ ${c.likes} · ↓ ${c.downloads}`;
  bodyBox.append(title, meta);
  // Description excerpt when the catalog has one (plain text node — DOM-safe).
  const blurb = String(c.description || "").replace(/\s+/g, " ").trim().slice(0, 220);
  if (blurb) {
    const desc = document.createElement("span");
    desc.className = "disc-wcard-desc";
    desc.textContent = redacted ? redact(blurb) : blurb;
    bodyBox.append(desc);
  }
  card.append(cover, bodyBox);
  return card;
}
// The details-open half of a world-card tap, shared by the direct open and the
// Redacted warning's Open-anyway button.
async function openWorldCardDetails(card, worldId) {
  // The panel stays open underneath — the details paint over it. Details sit
  // at .cc-overlay z 60, UNDER this panel's .popup-overlay z 90 (which must
  // stay high: confirms like Report render at 90 too), so this tap yields the
  // panel's slot while its details are up, and takes it back when they close.
  // Back still unwinds top-first (details, then the panel).
  const slot = card.closest(".popup-overlay");
  try {
    const m = await import("./community.js");
    const st = await m.openLinkedWorld(worldId);
    if (st === "ok" && slot && document.querySelector(".cc-overlay .ex-detail")) {
      slot.classList.add("is-beneath-detail");
      const obs = new MutationObserver(() => {
        if (!document.querySelector(".cc-overlay .ex-detail")) {
          try { slot.classList.remove("is-beneath-detail"); } catch (e) {}
          try { obs.disconnect(); } catch (e2) {}
        }
      });
      try { obs.observe(document.body, { childList: true }); } catch (e) {}
    }
  } catch (e) {}
}
// One-shot warning before opening a redacted world while Show NSFW is off. Cancel
// (focused by default, Back-safe) backs out; Open anyway opens this world once
// without flipping the reader's standing preference.
let redactedCardWarnOpen = false;
function showRedactedCardWarning(c, card) {
  if (redactedCardWarnOpen) return;
  redactedCardWarnOpen = true;
  const overlay = document.createElement("div");
  overlay.className = "popup-overlay disc-redacted-overlay";
  overlay.innerHTML = `
    <div class="popup confirm-pop">
      <div class="popup-head"><span class="popup-title">Redacted</span><button class="popup-x" type="button" title="Close" aria-label="Close">✕</button></div>
      <div class="confirm-msg"><span>This world is marked NSFW, and doesn't fit with your content preferences. So its title and description are redacted.</span><div class="disc-redacted-note">Open it anyway? You can change your preferences in Settings → Content settings.</div></div>
      <div class="popup-acts">
        <button class="mini popup-cancel">Cancel</button>
        <button class="mini ok disc-redacted-open">Open anyway</button>
      </div>
    </div>`;
  const done = (open) => {
    try { if (release) release(); } catch (e) {}
    try { overlay.remove(); } catch (e) {}
    redactedCardWarnOpen = false;
    if (open) openWorldCardDetails(card, c.worldId);
  };
  let release = null;
  try { release = pushBackClose(() => done(false)); } catch (e) { release = null; }
  try { overlay.querySelector(".popup-x").onclick = () => done(false); } catch (e) {}
  try { overlay.querySelector(".popup-cancel").onclick = () => done(false); } catch (e) {}
  try { overlay.querySelector(".disc-redacted-open").onclick = () => done(true); } catch (e) {}
  try { overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) done(false); }); } catch (e) {}
  try { overlay.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); done(false); } }); } catch (e) {}
  try { document.body.appendChild(overlay); } catch (e) { redactedCardWarnOpen = false; return; }
  try { overlay.querySelector(".popup-cancel").focus(); } catch (e) {}
}
// The shared Show-NSFW preference can flip under an open Tavern (toolbar ⊘,
// Settings → Content settings, or another tab) — redacted cards must swap
// between placeholder and full preview without waiting for a new message.
// Cards rebuild every render (never cached), so bumping the text revision and
// re-rendering is the whole fix.
let redactedPrefWired = false;
if (!redactedPrefWired) {
  redactedPrefWired = true;
  const repaintRedactedCards = () => { txtRev++; try { scheduleRender(); } catch (e) {} };
  try { window.addEventListener("mno:nsfw", repaintRedactedCards); } catch (e) {}
  try { window.addEventListener("mno:nsfw", syncNsfwChannels); } catch (e) {}
  try { window.addEventListener("storage", (e) => { if (e && e.key === "mno.showNsfw") repaintRedactedCards(); }); } catch (e2) {}
  try { window.addEventListener("storage", (e) => { if (e && e.key === "mno.showNsfw") syncNsfwChannels(); }); } catch (e3) {}
}
// True when the message's reply target points at one of your messages.
function isReplyToMe(channelId, comment) {
  const targetId = replyTargetOf(comment);
  if (!targetId) return false;
  const b = backends.get(channelId);
  const target = b && b.messages.get(targetId);
  // Backend lookup first; the persisted own-id set covers targets outside the loaded
  // batch (or with a stale flag) — both only ever hold your own messages, on any
  // device when claimed (see isMine).
  if (target && isMine(target)) return true;
  const own = ownIds.get(channelId);
  if (own && own.has(String(targetId))) return true;
  // Same human, other browser: the plugin id differs there, but the nickname matches.
  // Needs the target loaded and non-empty nicks on both sides — anonymous messages
  // never match, and anyone can type your nickname, so this is a convenience bridge,
  // not an identity proof.
  if (target) {
    const mine = myNick(), theirs = nickOf(target);
    if (mine && theirs && mine.toLowerCase() === theirs.toLowerCase()) return true;
  }
  return false;
}
// Replies from someone else to one of your messages — the notify-worthy case. Your own
// self-replies keep their preview context but never tint, badge or alert (you wrote them,
// on any device when claimed; the plugin's own reply-ding skips them the same way).
// "You" is your own messages (see isMine) plus your current nickname for your other
// devices' pre-tag history — nicknames are free text, so the nickname bridge is a
// convenience, not a proof.
function isReplyToMeFromOther(channelId, comment) {
  return !!(comment && !isMine(comment) && isReplyToMe(channelId, comment));
}
// @-mention of you from someone else — same notify-worthy footing as a reply (gold wash,
// flash, ding, toast); mentionsMe already excludes your own messages.
function isMentionOfMeFromOther(comment) {
  return mentionsMe(comment);
}

// Already-dinged guard (the iframe can redeliver after a self-reload): same bounded
// trailing-list shape as the plugin embed's own guard.
function alreadyDinged(id) {
  try {
    const seen = localStorage.getItem(DINGED_KEY) || ",";
    return !!id && seen.includes(`,${id},`);
  } catch (e) { return false; }
}
function markDinged(id) {
  if (!id) return;
  try {
    let seen = localStorage.getItem(DINGED_KEY) || ",";
    seen += `${id},`;
    if (seen.length > 2000) seen = "," + seen.split(",").filter(Boolean).slice(-10).join(",") + ",";
    localStorage.setItem(DINGED_KEY, seen);
  } catch (e) {}
}

// Two-oscillator "ding" (880/1320 Hz) — the same shape as the plugin embed's reply ding.
// One shared AudioContext: a fresh context per ding would leak contexts on busy channels.
let dingCtx = null;
function playDing() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    dingCtx = dingCtx || new AC();
    if (dingCtx.state === "suspended") dingCtx.resume().catch(() => {});
    const audio = dingCtx, gain = audio.createGain();
    const first = audio.createOscillator(), second = audio.createOscillator();
    first.frequency.value = 880; second.frequency.value = 1320;
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, audio.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.18);
    first.connect(gain); second.connect(gain); gain.connect(audio.destination);
    first.start(); second.start(audio.currentTime + 0.045);
    first.stop(audio.currentTime + 0.16); second.stop(audio.currentTime + 0.2);
    return true;
  } catch (e) { return false; }
}

function maybeNotify(channelId, comment) {
  if (!comment || isMine(comment)) return;
  if (isWorldChannel(channelId)) {
    // Watched world threads: live arrivals ding + toast while the toggle is on.
    // An open thread already rendered the message — its inbox record (added by
    // liveComment) is enough, no ding.
    try { const s = worldViews.get(channelId); if (s && s.size) return; } catch (e) {}
    if (!notifyWdOn) return;
    const wk = watchAlertKind(channelId, comment);
    if (!wk) return;
    const id = commentId(comment, "");
    if (alreadyDinged(id)) return;
    markDinged(id);
    playDing();
    const meta = watchMetaForChannel(channelId);
    if (meta && meta.wt) { try { worldTitles.set(channelId, meta.wt); } catch (e2) {} }
    if (wk === "reply") {
      showToast(channelId, comment, { reply: true, msgId: id });
      if (document.hidden || !view) browserNotify(channelId, comment, { reply: true });
    } else if (wk === "mention") {
      showToast(channelId, comment, { mention: true, msgId: id });
      if (document.hidden || !view) browserNotify(channelId, comment, { mention: true });
    } else {
      showToast(channelId, comment, { msgId: id });
      if (document.hidden || !view) browserNotify(channelId, comment);
    }
    return;
  }
  const id = commentId(comment, "");
  const reply = isReplyToMe(channelId, comment);
  const mention = !reply && mentionsMe(comment);
  if (reply || mention) {
    // Replies/@mentions alert while reply alerts are on — even when you're looking at
    // the channel — with a ding and a distinct toast (+ a browser notification when
    // you're not looking at it, so the OS doesn't nag while you're reading).
    if (!notifyReplyOn) return;
    if (alreadyDinged(id)) return;
    markDinged(id);
    playDing();
    showToast(channelId, comment, reply ? { reply: true, msgId: id } : { mention: true, msgId: id });
    if (document.hidden || !view || view.active !== channelId) browserNotify(channelId, comment, reply ? { reply: true } : { mention: true });
    return;
  }
  // Every other message pops up only while new-message alerts are on. The gold
  // badge (liveComment's unread maps) tracks arrivals regardless of both toggles.
  if (!notifyAllOn) return;
  const active = view && view.active === channelId && !document.hidden;
  if (active) return; // looking right at it — unread badges don't apply either
  showToast(channelId, comment);
  if (document.hidden || !view || view.active !== channelId) browserNotify(channelId, comment);
}

function setNotifyReply(on) {
  notifyReplyOn = !!on;
  try { localStorage.setItem(NOTIFY_REPLY_KEY, notifyReplyOn ? "1" : "0"); } catch (e) {}
  syncNotifyBackends();
}
function setNotifyAll(on) {
  notifyAllOn = !!on;
  try { localStorage.setItem(NOTIFY_ALL_KEY, notifyAllOn ? "1" : "0"); } catch (e) {}
  syncNotifyBackends();
}
function setNotifyWd(on) {
  notifyWdOn = !!on;
  try { localStorage.setItem(NOTIFY_WD_KEY, notifyWdOn ? "1" : "0"); } catch (e) {}
  if (view) paintNotifySws();
  if (notifyWdOn) {
    try {
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
    } catch (e) {}
    ensureWatchLoop();
  } else {
    stopWatchLoop();
  }
}
// Either sub-toggle keeps background sync alive. The legacy single key is kept
// as an either-mirror so the boot prewarm (which reads storage before this
// module loads) sees one value.
function syncNotifyBackends() {
  notifyOn = notifyReplyOn || notifyAllOn;
  try { localStorage.setItem(NOTIFY_KEY, notifyOn ? "1" : "0"); } catch (e) {}
  if (notifyOn) {
    // Wakes every channel's backend (headless — no view needed) so arrivals keep
    // streaming while you read other pages.
    for (const ch of visibleChannels()) { try { ensureBackend(ch.id); } catch (e) {} }
    try {
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
    } catch (e) {}
  } else if (!view) {
    // Off with the panel closed: tear the headless backends down so nothing
    // keeps polling in the background (the on-boot prewarm checks the stored
    // pref, so a reload stays quiet too). With the panel open the view owns
    // the backends — leave them alone, the user is actively chatting. Open
    // world threads keep their own backends (the user explicitly opened them).
    try {
      const keep = new Set();
      try { for (const [ch, set] of worldViews) if (set && set.size) keep.add(ch); } catch (e2) {}
      // ...and rotation-held watch channels keep theirs (their own toggle governs them).
      try { for (const ch of watchHolds.keys()) keep.add(ch); } catch (e3) {}
      for (const [id, bb] of [...backends]) {
        if (keep.has(id)) continue;
        try { bb.host && bb.host.remove(); } catch (e2) {}
        backends.delete(id);
      }
      for (const [k] of [...unread]) if (!keep.has(k)) unread.delete(k);
      for (const [k] of [...unreadReply]) if (!keep.has(k)) unreadReply.delete(k);
      emitHot();
    } catch (e) {}
  }
  if (view) paintNotifySws();
}
// The Tavern config panel owns these toggles, so the live values and the
// setters are public: the panel switches apply through here so the pips and
// the backends follow without a reload.
export function getTavernNotify() { return notifyOn; }
export function getTavernNotifyReply() { return notifyReplyOn; }
export function getTavernNotifyAll() { return notifyAllOn; }
export function setTavernNotifyReply(on) { setNotifyReply(on); }
export function setTavernNotifyAll(on) { setNotifyAll(on); }
export function getTavernNotifyWd() { return notifyWdOn; }
export function setTavernNotifyWd(on) { setNotifyWd(on); }

// ---- view -----------------------------------------------------------------

function paintChannels() {
  if (!view) return;
  view.chanList.innerHTML = "";
  for (const ch of visibleChannels()) {
    // Support channels sit below a divider (the `sep` flag on the first of them).
    if (ch.sep) {
      const sep = document.createElement("div");
      sep.className = "disc-chansep";
      sep.setAttribute("role", "separator");
      view.chanList.appendChild(sep);
    }
    const b = document.createElement("button");
    b.type = "button";
    b.className = "disc-chan" + (view.active === ch.id ? " active" : "");
    b.dataset.channel = ch.id;
    const n = unread.get(ch.id) || 0;
    const r = unreadReply.get(ch.id) || 0;
    b.innerHTML = `<span class="disc-chan-name">${esc(ch.name)}${ch.nsfw ? ` <span class="disc-channsfw" aria-hidden="true" title="NSFW">🔞</span>` : ""}</span>${n ? `<span class="disc-unread${r ? " is-reply" : ""}"${r ? ` title="${r} ${r === 1 ? "reply" : "replies"} to you"` : ""}>${n > 99 ? "99+" : n}</span>` : ""}`;
    b.setAttribute("aria-current", view.active === ch.id ? "true" : "false");
    b.onclick = () => switchChannel(ch.id);
    view.chanList.appendChild(b);
  }
  // House-rules shortcut pinned to the sidebar bottom via margin-top: auto
  // (rebuilt with the list every paint, since the list above is wiped). Re-shows
  // the welcome screen on demand — same copy as first run, Enter just dismisses
  // (see showRules).
  // Divider between the channels and the house-rules shortcut below it.
  const rulesSep = document.createElement("div");
  rulesSep.className = "disc-chansep disc-rulessep";
  rulesSep.setAttribute("role", "separator");
  view.chanList.appendChild(rulesSep);
  const rules = document.createElement("button");
  rules.type = "button";
  rules.className = "disc-rulesbtn";
  rules.setAttribute("aria-label", "Show the Tavern house rules");
  rules.textContent = "Tavern Rules";
  rules.onclick = () => { try { showRules(); } catch (e) {} };
  view.chanList.appendChild(rules);
  // Keep the active channel visible in the strip: a toast/pip jump can target a
  // channel that's scrolled out of view. Manual math (not scrollIntoView) so no
  // ancestor ever scrolls — only the strip moves. Same reason the world editor
  // scrolls its active tab into view on select.
  try {
    const act = view.chanList.querySelector(".disc-chan.active");
    if (act) {
      const l = view.chanList, x = act.offsetLeft, w = act.offsetWidth;
      // Land flush with the strip's own padding: the first chip's offsetLeft IS
      // that padding, so subtract it — otherwise jumping home stops 6px short
      // with the prev cue wrongly showing.
      const first = l.querySelector(".disc-chan");
      const base = first ? first.offsetLeft : 0;
      if (x < l.scrollLeft + base) l.scrollTo({ left: Math.max(0, x - base), behavior: "auto" });
      else if (x + w > l.scrollLeft + l.clientWidth - base) l.scrollTo({ left: x + w - l.clientWidth + base, behavior: "auto" });
    }
  } catch (e) {}
  paintChanNav();
}

// Scroll cues for the channel strip — same fade + chevron pattern as the world
// editor's tab bar (see paintTabNav): one cue pinned to each edge that still has
// off-screen channels. They only ever show on narrow screens (the desktop list is
// vertical, so both stay hidden); the CSS keeps them mobile-only too.
function paintChanNav() {
  if (!view || !view.chanList) return;
  const list = view.chanList;
  // Same padding-relative dead zone as the reveal above, so the cues agree with
  // where the strip actually rests.
  const first = list.querySelector(".disc-chan");
  const base = first ? first.offsetLeft : 0;
  const canL = list.scrollLeft > base + 2;
  const canR = list.scrollLeft + list.clientWidth < list.scrollWidth - base - 2;
  if (view.chanPrev) view.chanPrev.hidden = !canL;
  if (view.chanNext) view.chanNext.hidden = !canR;
}

// Channel topic strip pinned above the messages (the header now just says TAVERN).
function paintTopicBar() {
  if (!view || !view.topicBar) return;
  const ch = CHANNELS.find((c) => c.id === view.active) || CHANNELS[0];
  view.topicBar.innerHTML = "";
  const tag = document.createElement("span");
  tag.className = "disc-topic-ch";
  tag.textContent = `#${ch.name}`;
  const tx = document.createElement("span");
  tx.className = "disc-topic-tx";
  tx.textContent = ch.topic;
  view.topicBar.append(tag, tx);
}

// Header config panel (nickname + notifications). Save validates before writing
// storage; the send path re-checks the stored nickname as a final gate.
function toggleConfigPanel() {
  if (!view || !view.cfg) return;
  if (view.cfg.hidden) {
    try { closeInbox(); } catch (e) {}
    try { if (view.cfgErr) view.cfgErr.hidden = true; } catch (e) {}
    if (!claimedName) { try { view.nick.value = loadNick(); } catch (e) {} }
    try { paintNotifySws(); } catch (e) {}
    try { if (view.fabSw) paintFabSw(); } catch (e) {}
    view.cfg.hidden = false;
    try { view.cfgBtn.setAttribute("aria-expanded", "true"); } catch (e) {}
    if (!claimedName && !coarsePtr()) { try { view.nick.focus({ preventScroll: true }); } catch (e) {} }
  } else closeConfigPanel();
}
function closeConfigPanel() {
  if (!view || !view.cfg) return;
  view.cfg.hidden = true;
  // Abandon any unsaved draft: the field is only an editor, never the nickname
  // itself, so closing without Save restores the last saved value.
  if (!claimedName && view.nick) { try { view.nick.value = loadNick(); } catch (e) {} }
  // The info-tip bubble lives on document.body, so hiding the panel would
  // otherwise leave it floating without its anchor.
  try { hideInfoTip(); } catch (e) {}
  try { view.cfgBtn.setAttribute("aria-expanded", "false"); } catch (e) {}
}
// Replies/mentions inbox (the bell). Same popover chrome as the config panel;
// opening one closes the other so they never overlap. Opening clears the badge
// but keeps the rows — the badge then restarts at 1 on the next new alert.
function toggleInbox() {
  if (!view || !view.inbox) return;
  if (view.inbox.hidden) {
    try { closeConfigPanel(); } catch (e) {}
    try { renderInbox(); } catch (e2) {}
    view.inbox.hidden = false;
    try { view.bellBtn.setAttribute("aria-expanded", "true"); } catch (e) {}
    try {
      loadBellUnread();
      if (bellUnread) { bellUnread = 0; saveBellUnread(); paintBell(); }
    } catch (e3) {}
  } else closeInbox();
}
function closeInbox() {
  if (!view || !view.inbox) return;
  view.inbox.hidden = true;
  try { view.bellBtn.setAttribute("aria-expanded", "false"); } catch (e) {}
}
// Tavern window modes (desktop only — the phone layout is already full-bleed).
// One button cycles normal → maximized → compact → normal. Compact is a
// phone-sized floater: draggable by its head, natively resizable, no scrim so
// the page behind stays clickable. The classes ride the overlay (padding,
// background, pointer-events) as well as the popup, like is-max does.
// Mode persists in `mno.disc.winmode` (`mno.disc.max` is kept as a legacy mirror);
// compact geometry persists in `mno.disc.compactgeo`.
function getWinMode(overlay) {
  const pop = overlay && overlay.querySelector(".disc-pop");
  if (!pop) return "";
  if (pop.classList.contains("is-compact")) return "compact";
  if (pop.classList.contains("is-max")) return "max";
  return "";
}
function setWinMode(overlay, mode) {
  const pop = overlay && overlay.querySelector(".disc-pop");
  if (!pop) return;
  pop.classList.toggle("is-max", mode === "max");
  pop.classList.toggle("is-compact", mode === "compact");
  try { overlay.classList.toggle("is-max", mode === "max"); } catch (e) {}
  try { overlay.classList.toggle("is-compact", mode === "compact"); } catch (e) {}
  if (mode === "compact") { watchCompactResize(overlay); applyCompactGeo(pop); }
  else clearCompactGeo(pop);
  try { localStorage.setItem("mno.disc.winmode", mode); } catch (e) {}
  try { localStorage.setItem("mno.disc.max", mode === "max" ? "1" : "0"); } catch (e) {}
  const btn = overlay.querySelector(".disc-maxbtn");
  try {
    const sel = overlay.querySelector(".disc-winmodesel");
    if (sel && sel.value !== mode) sel.value = mode;
  } catch (e) {}
  if (!btn) return;
  btn.title = mode === "max" ? "Compact mode" : mode === "compact" ? "Restore" : "Maximize";
  btn.setAttribute("aria-label", btn.title);
  btn.setAttribute("aria-expanded", mode === "" ? "false" : "true");
  btn.innerHTML = mode === "max" ? ICON_FLOAT_SQ : mode === "compact" ? ICON_COMPRESS_SQ : ICON_EXPAND_SQ;
}
function cycleWinMode(overlay) {
  const cur = getWinMode(overlay);
  setWinMode(overlay, cur === "" ? "max" : cur === "max" ? "compact" : "");
}
// Compact geometry (viewport-px). Restored on entry, clamped to the current
// viewport so a smaller window never strands the floater off-screen.
const COMPACT_W = 390, COMPACT_H = 700;
function readCompactGeo() {
  try {
    const g = JSON.parse(localStorage.getItem("mno.disc.compactgeo") || "null");
    if (g && Number.isFinite(g.w) && Number.isFinite(g.h)) return g;
  } catch (e) {}
  return null;
}
function saveCompactGeo(pop) {
  if (!pop || !pop.classList.contains("is-compact")) return;
  try {
    const r = pop.getBoundingClientRect();
    if (r.width < 50 || r.height < 50) return;
    localStorage.setItem("mno.disc.compactgeo", JSON.stringify({
      x: Math.round(r.left), y: Math.round(r.top),
      w: Math.round(r.width), h: Math.round(r.height)
    }));
  } catch (e) {}
}
function applyCompactGeo(pop) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const g = readCompactGeo();
  let w = Math.min(g ? g.w : COMPACT_W, vw - 16);
  let h = Math.min(g ? g.h : Math.min(COMPACT_H, vh - 32), vh - 16);
  w = Math.max(300, w); h = Math.max(440, h);
  let x = g ? g.x : Math.round((vw - w) / 2);
  let y = g ? g.y : Math.max(16, Math.round((vh - h) / 2));
  x = Math.max(80 - w, Math.min(vw - 80, x));
  y = Math.max(0, Math.min(vh - 60, y));
  pop.style.width = w + "px"; pop.style.height = h + "px";
  pop.style.left = x + "px"; pop.style.top = y + "px";
}
function clearCompactGeo(pop) {
  pop.style.width = pop.style.height = pop.style.left = pop.style.top = "";
}
// Native resize has no end event — a ResizeObserver trails it and persists the
// size (position persists on drag-end below). Idle while not compact.
function watchCompactResize(overlay) {
  const pop = overlay.querySelector(".disc-pop");
  if (!pop || overlay._compactRO || typeof ResizeObserver === "undefined") return;
  let t = 0;
  const ro = new ResizeObserver(() => {
    if (!pop.classList.contains("is-compact") || !pop.isConnected) return;
    clearTimeout(t);
    t = setTimeout(() => saveCompactGeo(pop), 250);
  });
  ro.observe(pop);
  overlay._compactRO = ro;
}
// Compact drag: the head is a grab handle (drags starting on a button are
// ignored so every control still clicks). Clamped so the floater can't leave
// the viewport entirely.
function wireCompactDrag(overlay) {
  const pop = overlay.querySelector(".disc-pop");
  const head = overlay.querySelector(".disc-head");
  if (!pop || !head || head._compactDrag) return;
  head._compactDrag = true;
  head.addEventListener("pointerdown", (e) => {
    if (!pop.classList.contains("is-compact")) return;
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest("button, input, a, textarea, select")) return;
    e.preventDefault();
    const r = pop.getBoundingClientRect();
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    head.classList.add("dragging");
    const move = (ev) => {
      let x = ev.clientX - dx, y = ev.clientY - dy;
      x = Math.max(80 - r.width, Math.min(window.innerWidth - 80, x));
      y = Math.max(0, Math.min(window.innerHeight - 60, y));
      pop.style.left = x + "px"; pop.style.top = y + "px";
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      head.classList.remove("dragging");
      saveCompactGeo(pop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  });
}
function paintBell() {
  loadAlerts();
  loadBellUnread();
  if (!view || !view.bellN) return;
  const n = bellUnread;
  try {
    view.bellN.hidden = !n;
    view.bellN.textContent = n > 99 ? "99+" : String(n);
    if (view.bellBtn) view.bellBtn.title = n ? `${n} unread notifications` : "Notifications";
  } catch (e) {}
}
function channelNameOf(id) {
  try { const c = CHANNELS.find((x) => x.id === id); if (c && c.name) return c.name; } catch (e) {}
  try { if (isWorldChannel(id)) return worldDisplayName(id); } catch (e2) {}
  return String(id || "");
}
// Inbox tabs: Notifications (alerts, badge-backed) and Saved (local bookmarks).
// Memory-only selection — the panel always opens on Notifications.
let inboxTab = "alerts";
// One row builder for both tabs: jump affordance + dismiss ✕, same as toasts.
function jumpToEntry(a) {
  closeInbox();
  const isW = a.kind === "world";
  if (isW && a.wid) { requestWorldJumpById(a.wid, a.id); return; }
  if (isWorldChannel(a.ch)) { requestWorldJump(a.ch, a.id); return; }
  requestJump(a.ch);
  if (a.id) setTimeout(() => jumpToMessageSoon(a.id), 200);
}
function entryRow(a, glyph, glyphCls, chLabel, onDismiss, dismissLabel) {
  const row = document.createElement("div");
  row.className = "disc-inrow";
  const jump = document.createElement("button");
  jump.type = "button";
  jump.className = "disc-in-jump";
  const kind = document.createElement("span");
  kind.className = "disc-in-kind" + glyphCls;
  kind.textContent = glyph;
  const main = document.createElement("div");
  main.className = "disc-in-main";
  const top = document.createElement("div");
  top.className = "disc-in-top";
  const who = document.createElement("span");
  who.className = "disc-in-who";
  who.textContent = a.by || "anon";
  const ch = document.createElement("span");
  ch.className = "disc-in-ch";
  ch.textContent = chLabel;
  const time = document.createElement("span");
  time.className = "disc-in-time";
  time.textContent = a.ts ? fmtTime(a.ts) : "";
  top.append(who, ch, time);
  const tx = document.createElement("div");
  tx.className = "disc-in-tx";
  tx.textContent = a.text || "(empty message)";
  main.append(top, tx);
  jump.append(kind, main);
  jump.onclick = () => jumpToEntry(a);
  const x = document.createElement("button");
  x.type = "button";
  x.className = "disc-in-x";
  x.textContent = "✕";
  x.title = dismissLabel;
  x.setAttribute("aria-label", dismissLabel);
  x.onclick = (e) => { e.stopPropagation(); onDismiss(a.id); };
  row.append(jump, x);
  return row;
}
function renderInbox() {
  if (!view || !view.inbox) return;
  loadAlerts();
  loadSaved();
  const box = view.inbox;
  box.innerHTML = "";
  const head = document.createElement("div");
  head.className = "disc-inhead";
  const tabs = document.createElement("div");
  tabs.className = "disc-intabs";
  tabs.setAttribute("role", "tablist");
  for (const [key, label] of [["alerts", "Notifications"], ["saved", "Saved"]]) {
    const tb = document.createElement("button");
    tb.type = "button";
    tb.className = "disc-intab" + (inboxTab === key ? " on" : "");
    tb.textContent = label;
    tb.setAttribute("role", "tab");
    tb.setAttribute("aria-selected", inboxTab === key ? "true" : "false");
    tb.onclick = (e) => { e.stopPropagation(); inboxTab = key; renderInbox(); };
    tabs.appendChild(tb);
  }
  head.appendChild(tabs);
  const list = inboxTab === "saved" ? savedItems : alerts;
  if (list.length) {
    const clr = document.createElement("button");
    clr.type = "button";
    clr.className = "disc-inclear";
    clr.textContent = "Clear";
    clr.onclick = (e) => { e.stopPropagation(); if (inboxTab === "saved") clearSaved(); else clearAlerts(); };
    head.appendChild(clr);
  }
  box.appendChild(head);
  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "disc-inempty";
    empty.textContent = inboxTab === "saved" ? "No saved messages yet — hover a message and hit ☆ Save." : "Empty";
    box.appendChild(empty);
    return;
  }
  for (const a of list.slice(0, MAX_ALERTS)) {
    const isW = a.kind === "world";
    const glyph = inboxTab === "saved" ? "☆" : a.kind === "mention" ? "@" : isW ? "💬" : "↩";
    const glyphCls = inboxTab === "saved" ? " is-saved" : a.kind === "mention" ? " is-mention" : isW ? " is-world" : "";
    const chLabel = inboxTab === "saved" ? "#" + channelNameOf(a.ch) : isW ? (a.wt || channelNameOf(a.ch)) : "#" + channelNameOf(a.ch);
    box.appendChild(entryRow(a, glyph, glyphCls, chLabel, inboxTab === "saved" ? removeSaved : removeAlert, inboxTab === "saved" ? "Remove from saved messages" : "Dismiss notification"));
  }
}
function saveConfigPanel() {
  if (!view || !view.nick) return;
  if (claimedName) { closeConfigPanel(); return; }
  const v = view.nick.value.trim();
  const bad = nickError(v);
  if (bad) {
    try {
      view.cfgErr.hidden = false;
      view.cfgErr.textContent = bad;
      view.nick.focus({ preventScroll: true });
    } catch (e) {}
    return;
  }
  saveNick(v);
  try { rescanAlertsAfterIdentity(); } catch (e) {}
  try { view.cfgErr.hidden = true; } catch (e) {}
  closeConfigPanel();
  // The nickname decides whose mentions light up — repaint under the new name.
  try { renderMessages(view.active); } catch (e) {}
}
// Notifications switches paint — the shared `.ui-sw` pills (On/Off, like the Settings
// toggles) are the single source for their state, the way paintTopicBar is for the strip.
function paintNotifySws() {
  if (!view) return;
  try {
    if (view.notifyReplySw) { view.notifyReplySw.paint(); view.notifyReplySw.setLabel(notifyReplyOn ? "On" : "Off"); }
    if (view.notifyAllSw) { view.notifyAllSw.paint(); view.notifyAllSw.setLabel(notifyAllOn ? "On" : "Off"); }
    if (view.notifyWdSw) { view.notifyWdSw.paint(); view.notifyWdSw.setLabel(notifyWdOn ? "On" : "Off"); }
  } catch (e) {}
}
// Floating-button switch paint — same shared pill, its own pref.
function paintFabSw() {
  if (!view || !view.fabSw) return;
  try {
    const on = tavernFabEnabled();
    view.fabSw.paint();
    view.fabSw.setLabel(on ? "On" : "Off");
  } catch (e) {}
}

function paintStatus(channelId) {
  if (!view || view.active !== channelId) return;
  const b = backends.get(channelId);
  if (!b) return;
  if (b.failed && !b.loaded) {
    view.status.hidden = false;
    view.status.className = "disc-status is-err";
    view.status.textContent = `Couldn't connect to chat: ${b.failed}`;
    view.retry.hidden = false;
  } else if (!b.loaded) {
    view.status.hidden = false;
    view.status.className = "disc-status is-loading";
    view.status.innerHTML = `<span class="disc-spinner"></span> Connecting to ${esc(channelId)}…`;
    view.retry.hidden = true;
  } else {
    view.retry.hidden = true;
    if (!b.order.length) {
      view.status.hidden = false;
      view.status.className = "disc-status is-empty";
      view.status.textContent = "No messages yet — say hello! Be kind, no spam.";
    } else {
      view.status.hidden = true;
    }
  }
}

// A tap that focused the message (see the msgs pointerdown handler) must not
// also fire the reply button it just revealed — the tap-up would otherwise land
// on a button the user never aimed at. Only the revealing gesture is eaten; a
// deliberate later tap works normally.
function consumeTapFocus(wrap) {
  try {
    const t = Number((wrap && wrap.dataset && wrap.dataset.tapFocus) || 0);
    delete wrap.dataset.tapFocus;
    if (t && Date.now() - t < 500) return true;
  } catch (e) {}
  return false;
}
// Follow-up grouping: consecutive messages from the same sender inside a short
// window render as message-only continuations — no second avatar, name, flair or
// timestamp. A reply reference always starts a fresh header, so quoted threads keep
// their context; missing or out-of-order timestamps never group.
const GROUP_WINDOW_MS = 3 * 60 * 1000;
function groupKeyFor(comment) {
  const u = (comment && comment.user) || {};
  const nick = normNick(nickOf(comment));
  const headId = verifiedFor(comment);
  const admin = (comment && comment.user && comment.user.isAdmin) ? "1" : "0";
  if (headId) {
    let uid = null;
    try { uid = parseReply(comment && comment.message).tagUid; } catch (e) { uid = null; }
    if (!uid && isMine(comment) && claimedName && nick === normNick(claimedName) && claimedUserId) uid = claimedUserId;
    if (uid) return `uid:${String(uid).toLowerCase()}|${admin}`;
    const nm = normNick((headId && headId.username) || nick);
    if (nm) return `verified:${nm}|${admin}`;
    return "";
  }
  const pid = String(u.id || "").trim().toLowerCase();
  const vis = String(u.visualId || "").trim().toLowerCase();
  const mine = isMine(comment) ? "1" : "0";
  if (!pid && !vis && !nick) return "";
  return `raw:${mine}|${nick}|${vis}|${pid}|${admin}`;
}
function followsUp(prev, curr) {
  if (!prev || !curr) return false;
  try { if (replyTargetOf(curr)) return false; } catch (e) {}
  const pt = commentTime(prev), ct = commentTime(curr);
  if (!pt || !ct || ct < pt || (ct - pt) > GROUP_WINDOW_MS) return false;
  const a = groupKeyFor(prev), b = groupKeyFor(curr);
  return !!a && a === b;
}

// Admin-only per-message ID inspector (left of Reply). Shows the stable app userId
// tag (device id, tagged on every send) + the comments-plugin transport ids.
// Read-only for now — the actual ban/moderation actions land later.
function adminIdBtn(comment) {
  if (!isAdminView) return null;
  const b = document.createElement("button");
  b.type = "button";
  b.className = "disc-idbtn";
  b.textContent = "id";
  b.title = "Show user IDs";
  b.setAttribute("aria-label", "Show user IDs");
  b.onclick = (e) => { e.stopPropagation(); showIdPop(b, comment); };
  return b;
}
function idPopRows(comment) {
  let tagUid = "";
  try { tagUid = parseReply(comment && comment.message).tagUid || ""; } catch (e) { tagUid = ""; }
  const cu = (comment && comment.user) || {};
  return {
    nick: nickOf(comment) || "(anon)",
    appUid: tagUid || "(no tag)",
    commentsId: String(cu.id || "") || "(none)",
    visualId: String(cu.visualId || "") || "(none)",
  };
}
function closeIdPop() {
  try { document.getElementById("discIdPop")?.remove(); } catch (e) {}
}
// Viewport-clamped card placement for the small fixed popups (ID card, history):
// beside the anchor when there's room, flipped above it at the bottom of the
// feed, pinned inside the viewport on short screens. The card scrolls internally
// past max-height (see styles.css), so measure after content is final.
function placePopCard(pop, anchor) {
  try {
    const rc = anchor.getBoundingClientRect();
    const maxH = Math.max(160, window.innerHeight - 16);
    try { pop.style.maxHeight = maxH + "px"; } catch (e2) {}
    const pw = pop.offsetWidth || 300;
    const ph = pop.offsetHeight || 160;
    let x = Math.min(Math.max(8, rc.left - pw + rc.width), window.innerWidth - pw - 8);
    if (!Number.isFinite(x)) x = 8;
    let y = rc.bottom + 6;
    if (y + ph > window.innerHeight - 8) y = rc.top - ph - 6;
    // Still taller than the viewport (short landscape phones): pin to the
    // viewport instead of running off either edge.
    if (ph >= window.innerHeight - 16) y = 8;
    else y = Math.min(Math.max(8, y), window.innerHeight - ph - 8);
    pop.style.left = x + "px";
    pop.style.top = y + "px";
  } catch (e) {}
}
function showIdPop(anchor, comment) {
  closeIdPop();
  const r = idPopRows(comment);
  const pop = document.createElement("div");
  pop.id = "discIdPop";
  pop.className = "disc-idpop";
  pop.innerHTML = `
    <div class="disc-idpop-head"><span>User IDs</span><button type="button" class="disc-idpop-x" title="Close">✕</button></div>
    <div class="disc-idpop-row"><span class="disc-idpop-k">nick</span><code></code></div>
    <div class="disc-idpop-row"><span class="disc-idpop-k">app uid</span><code></code></div>
    <div class="disc-idpop-row"><span class="disc-idpop-k">comments id</span><code></code></div>
    <div class="disc-idpop-row"><span class="disc-idpop-k">visual</span><code></code></div>
    <div class="disc-idpop-banbox" hidden>
      <div class="disc-idpop-row"><span class="disc-idpop-k">ban</span><span class="disc-idpop-banstat">checking…</span></div>
      <div class="disc-idpop-row"><span class="disc-idpop-k">scope</span><span class="disc-idpop-scope" role="radiogroup" aria-label="Ban scope"><button type="button" class="disc-scopebtn on" data-scope="both" role="radio" aria-checked="true">both</button><button type="button" class="disc-scopebtn" data-scope="comment" role="radio" aria-checked="false">comment</button><button type="button" class="disc-scopebtn" data-scope="app" role="radio" aria-checked="false">app</button></span></div>
      <div class="disc-idpop-row"><span class="disc-idpop-k">dur</span><select class="popup-in disc-idpop-dur"><option value="3600000">1 hour</option><option value="86400000">1 day</option><option value="604800000">7 days</option><option value="2592000000">30 days</option><option value="31536000000">1 year</option><option value="0" selected>Permanent</option></select></div>
      <div class="disc-idpop-row"><span class="disc-idpop-k">note</span><input class="disc-nickinput disc-idpop-note" maxlength="48" placeholder="optional"></div>
      <div class="disc-idpop-row"><span class="disc-idpop-k"></span><span class="disc-idpop-acts"><button type="button" class="mini warn disc-idpop-banbtn">Ban</button> <button type="button" class="mini disc-idpop-unban">Unban</button> <button type="button" class="mini disc-idpop-hist">History</button></span></div>
      <div class="disc-idpop-banmsg"></div>
    </div>`;
  const codes = pop.querySelectorAll("code");
  codes[0].textContent = r.nick;
  codes[1].textContent = r.appUid;
  codes[2].textContent = r.commentsId;
  codes[3].textContent = r.visualId;
  document.body.appendChild(pop);
  const placePop = () => placePopCard(pop, anchor);
  placePop();
  pop.querySelector(".disc-idpop-x").onclick = (e) => { e.stopPropagation(); closeIdPop(); };
  pop.querySelector(".disc-idpop-hist").onclick = (e) => {
    e.stopPropagation();
    showIdHistory(anchor, r.nick, r.appUid, r.commentsId);
  };
  try {
    const banBox = pop.querySelector(".disc-idpop-banbox");
    if (banBox && isAdminView) {
      banBox.hidden = false;
      // The ban section roughly doubles the card height — re-clamp now that
      // the full height is known, otherwise bottom-of-feed popups clip.
      placePop();
      const stat = pop.querySelector(".disc-idpop-banstat");
      const msg = pop.querySelector(".disc-idpop-banmsg");
      const appId = (r.appUid || "").toLowerCase();
      const cId = normBanId(r.commentsId || "");
      const paint = () => {
        try {
          const a = appId && !appId.startsWith("(") ? isAppIdBanned(appId) : false;
          const c = cId ? isCommentIdBanned(cId) : false;
          if (stat) stat.textContent = "comment " + (c ? "✓" : "—") + " · app " + (a ? "✓" : "—");
        } catch (e) { if (stat) stat.textContent = ""; }
      };
      paint();
      // Scope is a segmented toggle (same quiet voice as the inbox tabs), not
      // native radios — one state var, buttons repaint it.
      let scope = "both";
      const scopeBtns = [...pop.querySelectorAll(".disc-scopebtn")];
      const paintScope = () => {
        for (const b of scopeBtns) {
          const on = b.dataset.scope === scope;
          b.classList.toggle("on", on);
          b.setAttribute("aria-checked", on ? "true" : "false");
        }
      };
      scopeBtns.forEach((b) => {
        b.onclick = (e) => { e.stopPropagation(); scope = b.dataset.scope || "both"; paintScope(); };
      });
      const scopeBox = pop.querySelector(".disc-idpop-scope");
      if (scopeBox) scopeBox.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const order = ["both", "comment", "app"];
        let at = order.indexOf(scope);
        at = (at + (e.key === "ArrowRight" ? 1 : order.length - 1)) % order.length;
        scope = order[at];
        paintScope();
        try { scopeBox.querySelector(`[data-scope="${scope}"]`).focus(); } catch (e2) {}
      });
      const scopeOf = () => scope;
      const durOf = () => { try { return Number(pop.querySelector(".disc-idpop-dur").value); } catch (e) { return 0; } };
      const noteOf = () => { try { return pop.querySelector(".disc-idpop-note").value || ""; } catch (e) { return ""; } };
      const setMsg = (t) => { if (msg) msg.textContent = t || ""; };
      // Buttons only: the box itself must never trigger a ban. (The old code
      // matched the box's own class here, so any click on status/scope/dur/
      // note bubbled into a ban.)
      const banBtn = pop.querySelector(".disc-idpop-banbtn");
      const unbanBtn = pop.querySelector(".disc-idpop-unban");
      const onAct = async (e, isUnban) => {
        e.stopPropagation();
        const btn = isUnban ? unbanBtn : banBtn;
        const scope = scopeOf();
        const kinds = scope === "both" ? [1, 2] : scope === "app" ? [2] : [1];
        setMsg(isUnban ? "Unbanning…" : "Banning…");
        if (banBtn) banBtn.disabled = true;
        if (unbanBtn) unbanBtn.disabled = true;
        try {
          const m = await import("./community.js");
          let me = "";
          try { const ident = await m.api.identityOrNull(); me = (ident && ident.username) || ""; } catch (ee) {}
          for (const kind of kinds) {
            const id = kind === 2 ? appId : cId;
            if (!id || id.startsWith("(")) continue;
            if (isUnban) await m.api.banRemove(kind, id);
            else {
              const dur = durOf();
              await m.api.banSet(kind, id, { permanent: dur === 0, durationMs: dur === 0 ? 0 : dur, note: noteOf().slice(0, 48), nick: String(r.nick || "").slice(0, 40), by: (me || "").slice(0, 20) });
            }
          }
          try { const sb = await import("./server-bans.js"); await sb.loadServerBans(true); } catch (ee) {}
          paint();
          setMsg(isUnban ? "Unbanned. They must refresh." : "Banned. Takes effect after they refresh.");
        } catch (err) { setMsg("✖ " + ((err && (err.message || err.code)) || "failed")); }
        if (banBtn) banBtn.disabled = false;
        if (unbanBtn) unbanBtn.disabled = false;
      };
      if (banBtn) banBtn.onclick = (e) => { void onAct(e, false); };
      if (unbanBtn) unbanBtn.onclick = (e) => { void onAct(e, true); };
    }
  } catch (e) {}
  // Outside-tap + Escape dismiss (stopPropagation so Escape doesn't close the panel).
  setTimeout(() => {
    const outside = (e) => {
      if (!document.getElementById("discIdPop")) { document.removeEventListener("pointerdown", outside, true); return; }
      if (pop.contains(e.target) || (anchor && anchor.contains(e.target))) return;
      closeIdPop();
      document.removeEventListener("pointerdown", outside, true);
    };
    document.addEventListener("pointerdown", outside, true);
  }, 0);
  pop.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeIdPop(); }
  });
}

// Per-user Tavern history: every loaded message from this app uid or comments id,
// across all Tavern channels. Plain rows only (channel + time + text — no avatar,
// no name coloring); clicking a row jumps to the message in its channel.
const ID_HIST_LIMIT = 200;
function closeIdHist() {
  try { document.getElementById("discIdHist")?.remove(); } catch (e) {}
}
function showIdHistory(anchor, nick, appUidRaw, commentsIdRaw) {
  closeIdPop();
  closeIdHist();
  const appLow = String(appUidRaw || "").toLowerCase();
  const appOk = !!appLow && !appLow.startsWith("(");
  const cId = normBanId(commentsIdRaw || "");
  const collectHist = () => {
    const entries = [];
    try {
      for (const c of CHANNELS) {
        const b = backends.get(c.id);
        if (!b || !b.messages) continue;
        for (const [id, cm] of b.messages) {
          let hit = false;
          try {
            const u = (cm && cm.user) || {};
            if (cId && normBanId(u.id || "") === cId) hit = true;
            if (!hit && appOk) {
              let t = null;
              try { t = parseReply(cm && cm.message).tagUid; } catch (e) {}
              if (t && String(t).toLowerCase() === appLow) hit = true;
            }
          } catch (e) {}
          if (!hit) continue;
          entries.push({
            ch: c.id, id,
            ts: commentTime(cm) || 0,
            by: commentAuthor(cm) || "anon",
            text: excerptOf(cm, 140) || "(empty message)",
          });
        }
      }
    } catch (e) {}
    entries.sort((a, b) => a.ts - b.ts);
    return entries;
  };
  const pop = document.createElement("div");
  pop.id = "discIdHist";
  pop.className = "disc-idpop disc-idhist";
  const head = document.createElement("div");
  head.className = "disc-idpop-head";
  const title = document.createElement("span");
  title.textContent = `History · ${nick || "anon"}`;
  const x = document.createElement("button");
  x.type = "button";
  x.className = "disc-idpop-x";
  x.title = "Close";
  x.setAttribute("aria-label", "Close");
  x.textContent = "✕";
  head.append(title, x);
  pop.append(head);
  const sub = document.createElement("div");
  sub.className = "pf-none disc-idhist-sub";
  sub.textContent = "Loaded messages from this user — click a row to jump.";
  pop.append(sub);
  const listEl = document.createElement("div");
  listEl.className = "disc-idhist-list";
  const moreBtn = document.createElement("button");
  moreBtn.type = "button";
  moreBtn.className = "mini disc-idhist-more";
  moreBtn.textContent = "Load older messages";
  let histLoading = false;
  const rowEl = (e) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "disc-idhist-row";
    const meta = document.createElement("div");
    meta.className = "disc-idhist-meta";
    const ch = document.createElement("span");
    try { ch.textContent = "#" + channelNameOf(e.ch); } catch (e2) { ch.textContent = "#" + e.ch; }
    const who = document.createElement("span");
    who.textContent = e.by;
    const time = document.createElement("span");
    try { time.textContent = e.ts ? fmtTime(e.ts) : ""; } catch (e3) {}
    meta.append(ch, who, time);
    const tx = document.createElement("div");
    tx.className = "disc-idhist-tx";
    tx.textContent = e.text;
    row.append(meta, tx);
    row.onclick = (ev) => {
      ev.stopPropagation();
      closeIdHist();
      try { requestJump(e.ch); } catch (e4) {}
      if (e.id) setTimeout(() => { try { jumpToMessageSoon(e.id, 24); } catch (e5) {} }, 200);
    };
    return row;
  };
  // Whether any Tavern channel still has older history to give: an unsynced or
  // loading backend, a render window narrower than what's loaded, or a live
  // plugin load-more button (same readiness the chat's own header uses).
  const histHasMore = () => {
    try {
      for (const c of CHANNELS) {
        const b = backends.get(c.id);
        if (!b || !b.loaded || b.failed) return true;
        if (b.loadingMore) return true;
        const limit = b.renderLimit || INITIAL_RENDER_LIMIT;
        if (b.order.length > limit) return true;
        if (!b.historyExhausted && b.loadMoreBtn && !(b.loadMoreBtn.style && b.loadMoreBtn.style.display === "none") && !b.loadMoreBtn.disabled) return true;
      }
    } catch (e) {}
    return false;
  };
  const paintHist = () => {
    const all = collectHist();
    const shown = all.slice(-ID_HIST_LIMIT);
    try { title.textContent = `History · ${nick || "anon"} (${all.length})`; } catch (e) {}
    try {
      sub.textContent = all.length > shown.length
        ? `Latest ${shown.length} of ${all.length} loaded messages — click a row to jump.`
        : "Loaded messages from this user — click a row to jump.";
    } catch (e) {}
    try {
      listEl.innerHTML = "";
      if (!shown.length) {
        const none = document.createElement("div");
        none.className = "pf-none";
        none.textContent = "No loaded messages from this user.";
        listEl.append(none);
      }
      for (const e of shown) listEl.append(rowEl(e));
    } catch (e) {}
    try {
      if (histLoading) {
        moreBtn.hidden = false;
        moreBtn.disabled = true;
        moreBtn.textContent = "Loading older messages…";
      } else {
        moreBtn.disabled = false;
        moreBtn.textContent = "Load older messages";
        moreBtn.hidden = !histHasMore();
      }
    } catch (e) {}
  };
  moreBtn.onclick = (ev) => {
    ev.stopPropagation();
    if (histLoading) return;
    histLoading = true;
    paintHist();
    // One page per channel (same unit as the chat's own "load older" button):
    // widen the render window where possible, otherwise fetch one older batch.
    // Completion lands in the backends async — poll until every channel settles,
    // then repaint from the enlarged pool.
    try {
      for (const c of CHANNELS) {
        try { ensureBackend(c.id); } catch (e) {}
        try { loadOlderMessages(c.id); } catch (e) {}
      }
    } catch (e) {}
    let tries = 0;
    const tick = () => {
      if (!document.getElementById("discIdHist")) return;
      tries++;
      let busy = false;
      try {
        for (const c of CHANNELS) {
          const b = backends.get(c.id);
          if (b && b.loadingMore) { busy = true; break; }
        }
      } catch (e) {}
      if (busy && tries < 50) { setTimeout(tick, 400); return; }
      histLoading = false;
      paintHist();
    };
    setTimeout(tick, 600);
  };
  paintHist();
  pop.append(listEl);
  pop.append(moreBtn);
  document.body.appendChild(pop);
  placePopCard(pop, anchor);
  x.onclick = (e) => { e.stopPropagation(); closeIdHist(); };
  setTimeout(() => {
    const outside = (e) => {
      if (!document.getElementById("discIdHist")) { document.removeEventListener("pointerdown", outside, true); return; }
      if (pop.contains(e.target) || (anchor && anchor.contains(e.target))) return;
      closeIdHist();
      document.removeEventListener("pointerdown", outside, true);
    };
    document.addEventListener("pointerdown", outside, true);
  }, 0);
  pop.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeIdHist(); }
  });
}

// Admin-panel entry: the ban list's per-row History button. Same panel, anchored
// to the row's button — backends come from the headless pre-warm, so it works
// even when the Tavern was never opened (the pool may just start empty, and the
// panel's own Load-older button pages it in from there).
export function openUserHistory(anchorEl, ids) {
  try {
    const o = ids || {};
    showIdHistory(anchorEl, o.nick || "", o.appUid || "", o.commentsId || "");
  } catch (e) {}
}
function msgEl(comment, channelId, msgId, prev, ctx) {
  const onReply = ctx && ctx.onReply;
  const onJump = ctx && ctx.onJump;
  const wrap = document.createElement("div");
  const mine = isMine(comment);
  wrap.className = "disc-msg" + (mine ? " mine" : "") + ((isReplyToMeFromOther(channelId, comment) || isMentionOfMeFromOther(comment)) ? " reply-to-me" : "");
  const follow = followsUp(prev, comment);
  if (follow) wrap.classList.add("is-followup");
  wrap.dataset.mid = msgId;
  // Tap-to-reveal on touch: the wrapper takes focus on tap (never in Tab order),
  // so :focus-within can show just that message's reply button.
  wrap.tabIndex = -1;
  const name = commentAuthor(comment);
  const admin = !!(comment.user && comment.user.isAdmin);
  const { body } = parseReply(comment.message);
  const targetId = replyTargetOf(comment);
  const av = document.createElement("div");
  av.className = "disc-av";
  if (follow) {
    // A continuation keeps the avatar gutter only as alignment: no letter, no
    // image, hidden from assistive tech (the text carries a silent author line).
    av.setAttribute("aria-hidden", "true");
  } else {
    av.textContent = (name || "?").trim().charAt(0).toUpperCase() || "?";
    // Avatar by VERIFIED identity only (see verifiedFor): your own messages under your
    // claimed name, or a message whose `⟦uid:…⟧` tag the server maps back to its nickname.
    // Anything else — untagged, unknown or mismatched — is just a nickname and keeps the
    // letter. The plugin-transported avatarUrl is deliberately ignored (keyed by network
    // id, so it can't identify anyone across networks). Remote URLs only, and https
    // only — never data:/javascript:.
    const headId = verifiedFor(comment);
    const avUrl = (headId && headId.avatar) ? String(headId.avatar) : "";
    if (/^https:\/\//i.test(avUrl)) {
      const img = document.createElement("img");
      img.className = "disc-av-img";
      img.alt = "";
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      img.src = avUrl;
      img.onerror = () => { try { img.remove(); } catch (e) {} };
      av.appendChild(img);
    }
    // Per-author color: nickname first, so different names stay different colors even on
    // the same network (where everyone shares one network id); the stable network id breaks
    // ties between identical nicknames. Deterministic, not random — a sender keeps its color.
    const cu = (comment && comment.user) || {};
    const hueKey = [cu.nickname, cu.visualId, cu.id].filter(Boolean).join("|") || name;
    av.style.setProperty("--av-hue", String(authorHue(hueKey)));
  }
  const mbox = document.createElement("div");
  mbox.className = "disc-msgbody";
  // Reply reference: a thread-style preview ABOVE the avatar row (the avatar stays
  // glued to the username — the elbow connector in styles.css threads avatar → up →
  // quote). Clicking jumps to the target.
  let refEl = null;
  if (targetId) {
    const b = backends.get(channelId);
    const target = b && b.messages.get(targetId);
    const quote = document.createElement("button");
    quote.type = "button";
    quote.className = "disc-ref";
    if (target) {
      const at = document.createElement("span");
      at.className = "disc-ref-at";
      paintAuthorName(at, target, "@");
      const ex = document.createElement("span");
      ex.className = "disc-ref-ex";
      ex.textContent = excerptOf(target, 90) || "(empty message)";
      quote.append(at, document.createTextNode(" "), ex);
      quote.title = "Jump to replied message";
      quote.onclick = () => { if (onJump) onJump(targetId); else jumpToMessage(targetId); };
    } else {
      quote.classList.add("ghost");
      quote.disabled = true;
      quote.textContent = "↩ replied to an earlier message";
      queueTargetLoad(channelId, targetId);
    }
    refEl = quote;
  }
  const headNick = nickOf(comment);
  const headId = verifiedFor(comment);
  const head = document.createElement("div");
  head.className = "disc-msghead";
  // Hover/focus reply action (always reachable by keyboard — no hover on touch).
  const rb = document.createElement("button");
  rb.type = "button";
  rb.className = "disc-replybtn";
  // Admin ID inspector (if enabled) — joins rb in the floating action row.
  let idBtn = null;
  if (follow) {
    rb.textContent = "↩ Reply";
    rb.title = `Reply to @${name}`;
    rb.onclick = () => { if (consumeTapFocus(wrap)) return; if (onReply) onReply(msgId); else startReply(msgId); };
  } else {
    // Only a server-verified identity opens that user's profile (same name-only route the
    // @mention links use — the profile page handles misses). Unverified nicks stay plain
    // spans: nothing to open.
    const nm = document.createElement(headId ? "button" : "span");
    nm.className = "disc-name" + (headId ? " is-link" : "");
    if (headId) {
      const canon = (headId && headId.username) || headNick;
      nm.type = "button";
      nm.title = `Open @${canon}'s profile`;
      nm.setAttribute("aria-label", `Open profile of ${canon}`);
      nm.onclick = () => openAuthorProfile(canon);
    }
    paintAuthorName(nm, comment);
    head.appendChild(nm);
    if (admin) {
      const fl = document.createElement("span");
      fl.className = "disc-flair";
      fl.textContent = "MOD";
      head.appendChild(fl);
    }
    const ts = document.createElement("span");
    ts.className = "disc-time";
    ts.textContent = fmtTime(commentTime(comment));
    head.appendChild(ts);
    idBtn = adminIdBtn(comment);
    rb.textContent = "↩ Reply";
    rb.title = `Reply to @${name}`;
    rb.onclick = () => { if (consumeTapFocus(wrap)) return; if (onReply) onReply(msgId); else startReply(msgId); };
  }
  const txt = document.createElement("div");
  txt.className = "disc-text";
  const stk = stickerOf(body);
  if (stk) {
    const img = document.createElement("img");
    img.className = "disc-sticker";
    img.src = `src/stickers/${stk}.webp`;
    img.alt = `:${stk}:`;
    img.title = `:${stk}:`;
    img.loading = "lazy";
    img.draggable = false;
    txt.append(img);
  } else {
    // Chat markdown (rich-text.js, escape-first — other players' messages
    // can never inject markup). Spoilers reveal through the delegated toggle below.
    // Emoji-only bodies go jumbo, chat-app style (headers already stripped, so a
    // reply + emoji still counts). Repeat renders reuse the cached text HTML
    // (see txtHtmlCache) unless it carries live buttons.
    const cached = txtCacheGet(channelId, msgId);
    if (cached !== null) {
      txt.innerHTML = cached;
    } else {
      txt.innerHTML = chatMd(String(body == null ? "" : body));
      // @mentions render + upgrade (profile links for catalog-confirmed names).
      const needVerify = new Set();
      paintMentions(txt, needVerify);
      for (const tok of needVerify) resolveMentionToken(tok);
      // #channel tags become channel buttons (same text-node walk discipline as
      // mentions — code, spoilers and existing buttons/links never convert).
      paintChannelTags(txt);
      // Typed `:name:` renders as small inline stickers (a whole-message `:name:`
      // renders big via stickerOf above).
      paintInlineStickers(txt);
      // Shared world links unfurl into mini cards below the text.
      paintWorldCards(txt);
      // Bare http(s) URLs become confirm-first buttons (leaving-the-app
      // confirm, then a new tab) — world-card links were stripped just above.
      paintExtLinks(txt);
      if (!txt.querySelector("button")) txtCacheSet(channelId, msgId, txt.innerHTML);
    }
    if (isEmojiOnly(body)) txt.classList.add("has-jumbo");
  }
  if (follow) {
    // Visual message-only, but screen readers still get the author + time first.
    const sr = document.createElement("span");
    sr.className = "disc-sr";
    const when = fmtTime(commentTime(comment));
    sr.textContent = `${name || "anon"}${when ? `, ${when}` : ""}: `;
    txt.prepend(sr);
    mbox.appendChild(txt);
    idBtn = adminIdBtn(comment);
  } else {
    mbox.appendChild(head);
    mbox.appendChild(txt);
  }
  if (refEl) {
    wrap.classList.add("has-ref");
    const row = document.createElement("div");
    row.className = "disc-msgrow";
    row.append(av, mbox);
    wrap.append(refEl, row);
  } else {
    wrap.append(av, mbox);
  }
  // One floating action row for every message (named or follow-up): the reply
  // button and the admin ID inspector live here — future per-message buttons
  // join this row. Absolutely positioned by CSS, so it paints above instead
  // of shifting rows.
  const acts = document.createElement("div");
  acts.className = "disc-msgactions";
  if (idBtn) acts.appendChild(idBtn);
  // Local bookmark (Tavern only — world threads mount msgEl with a ctx).
  // Toggles instantly on its own button; the inbox's Saved tab (if open)
  // re-renders through the store's refresh call.
  if (!ctx) {
    const sv = document.createElement("button");
    sv.type = "button";
    sv.className = "disc-replybtn disc-savebtn";
    const paintSv = () => {
      const s = isSaved(msgId);
      sv.textContent = s ? "★ Saved" : "☆ Save";
      sv.title = s ? "Remove from saved messages" : "Save this message locally";
      sv.setAttribute("aria-label", s ? "Remove from saved messages" : "Save this message locally");
      sv.setAttribute("aria-pressed", s ? "true" : "false");
    };
    paintSv();
    sv.onclick = () => { if (consumeTapFocus(wrap)) return; toggleSaved(channelId, comment, msgId); paintSv(); };
    acts.appendChild(sv);
  }
  acts.appendChild(rb);
  wrap.appendChild(acts);
  return wrap;
}

// Scroll a message into view with a flash highlight (reply-preview jumps).
// Jump target that survives async-resolution re-renders (verified names/avatars
// landing after a channel opens re-render and drop flashed nodes — the render
// below re-applies the flash to the fresh node; expires after 15s).
let pendingFlashId = null;
let pendingFlashTs = 0;
function jumpToMessage(msgId) {
  if (!view) return;
  // Windowed rendering: the target may be loaded but outside the visible slice.
  // Widen the window to include it first so the jump lands instead of no-oping.
  try {
    const b = backends.get(view.active);
    if (b && msgId && b.messages.get(msgId) && (!view.msgEls || !view.msgEls.get(msgId))) {
      const idx = b.order.indexOf(msgId);
      if (idx >= 0) {
        const need = b.order.length - idx;
        const limit = b.renderLimit || INITIAL_RENDER_LIMIT;
        if (need > limit) {
          b.renderLimit = Math.min(b.order.length, need);
          try { renderMessages(view.active, { hold: true }); } catch (e) {}
        }
      }
    }
  } catch (e) {}
  const el = view.msgEls && view.msgEls.get(msgId);
  if (!el) return;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.classList.remove("disc-flash");
  void el.offsetWidth;
  el.classList.add("disc-flash");
  pendingFlashId = msgId; pendingFlashTs = Date.now();
  setTimeout(() => el.classList.remove("disc-flash"), 1600);
}

// Flash a live reply-to-you (or @-mention of you) without yanking scroll
// (renderMessages already decided that).
function flashIfReplyToMe(channelId, comment) {
  if (!view || (!isReplyToMeFromOther(channelId, comment) && !isMentionOfMeFromOther(comment))) return;
  const id = commentId(comment, "");
  const el = id && view.msgEls && view.msgEls.get(id);
  if (!el) return;
  el.classList.remove("disc-flash");
  void el.offsetWidth;
  el.classList.add("disc-flash");
}

// Toast clicks land on the channel first, then on the message — with retries, since the
// view may not exist yet (toast fired from another page) or the backend may still load.
function jumpToMessageSoon(msgId, tries = 8) {
  if (!msgId) return;
  const el = view && view.msgEls && view.msgEls.get(msgId);
  if (el) { jumpToMessage(msgId); return; }
  if (tries <= 0) return;
  setTimeout(() => jumpToMessageSoon(msgId, tries - 1), 500);
}

// Arm the composer as a reply to one of the visible messages.
function startReply(msgId) {
  if (!view) return;
  const b = backends.get(view.active);
  const target = b && b.messages.get(msgId);
  if (!target) return;
  drafts.set(view.active, msgId);
  paintReplyBar();
  view.input.focus({ preventScroll: true });
}

function clearReply() {
  if (!view) return;
  drafts.delete(view.active);
  paintReplyBar();
}

function paintReplyBar() {
  if (!view) return;
  const targetId = drafts.get(view.active);
  const b = backends.get(view.active);
  const target = targetId && b ? b.messages.get(targetId) : null;
  if (!target) {
    if (targetId) drafts.delete(view.active);
    view.replybar.hidden = true;
    repinIfFollowing();
    return;
  }
  view.replybar.hidden = false;
  paintAuthorName(view.replyWho, target, "@");
  view.replyEx.textContent = excerptOf(target, 90) || "(empty message)";
  repinIfFollowing();
}

// Decoration resolutions (verified names/avatars, @mentions, world cards) land in
// a burst on cold open — one completion per distinct user, mention and link. A
// synchronous full-list rebuild for each would jank cold scrolling, so coalesce
// them: at most one extra render per frame, however many resolve at once.
const pendingPaints = new Set();
function scheduleRender() {
  // World threads resolve too (verified names, @mentions, world cards) — repaint
  // every open world thread alongside the Tavern view.
  try {
    for (const [ch] of worldViews) {
      if (pendingPaints.has("w:" + ch)) continue;
      pendingPaints.add("w:" + ch);
      requestAnimationFrame(((c) => () => {
        pendingPaints.delete("w:" + c);
        try { renderWorldViews(c); } catch (e) {}
      })(ch));
    }
  } catch (e) {}
  if (!view || !view.active) return;
  const channelId = view.active;
  if (pendingPaints.has(channelId)) return;
  pendingPaints.add(channelId);
  requestAnimationFrame(() => {
    pendingPaints.delete(channelId);
    try { if (view && view.active === channelId) renderMessages(channelId); } catch (e) {}
  });
}

// Parsed-message cache: a message's text HTML depends only on its (immutable) body
// plus the mention/world-card resolutions in flight when it was built. Caching it
// skips the markdown parse and all five TreeWalker upgrade passes on repeat renders.
// Entries holding live buttons (confirmed @mention links, world cards, #channel tags)
// are never cached — innerHTML serialization would drop their click handlers, so
// those (rare) messages just rebuild every time. `txtRev` retires entries built
// under older resolutions; headers stay fresh-built, so names, seals and avatars
// always resolve live.
let txtRev = 0;
const txtHtmlCache = new Map();
function txtCacheGet(channelId, msgId) {
  const e = txtHtmlCache.get(channelId + ":" + msgId);
  return (e && e.rev === txtRev) ? e.html : null;
}
function txtCacheSet(channelId, msgId, html) {
  txtHtmlCache.set(channelId + ":" + msgId, { rev: txtRev, html });
  if (txtHtmlCache.size > 8000) txtHtmlCache.clear();
}

function renderMessages(channelId, opts) {  if (!view || view.active !== channelId) return;
  paintStatus(channelId);
  const b = backends.get(channelId);
  // Scroll anchoring: the wipe below collapses scrollHeight and clamps scrollTop
  // to 0, so capture where we are FIRST. Measuring after the wipe always reads
  // top 0 with a tiny gap, which forces follow=true — every background re-render
  // (verified-name/avatar/mention/world-card resolutions, history backfills)
  // would then yank a history reader back to the bottom.
  const oldHeight = view.msgs.scrollHeight;
  const oldTop = view.msgs.scrollTop;
  const gap = oldHeight - oldTop - view.msgs.clientHeight;
  const follow = !!((opts && opts.bottom) || view.glide || gap < 2 || (opts && opts.mine) || (view.pinBottom && gap < 24));
  view.msgs.innerHTML = "";
  view.msgEls = new Map();
  if (!b || !b.loaded || !b.order.length) return;
  const frag = document.createDocumentFragment();
  // Follow only at the true bottom (a hairline gap no matter what, or
  // pinBottom intent plus a small ceiling), or while a pill glide is in flight —
  // otherwise hold the same visual position. A live arrival while reading history
  // must not yank you to the bottom, and an older-history prepend must not move
  // what you're looking at. opts.bottom forces the tail (channel switch);
  // opts.hold spends a pending history anchor; opts.mine force-follows (your
  // own echo always lands you at the tail).
  const hist = historyHeaderEl(channelId);
  if (hist) frag.appendChild(hist);
  // Cold-load window: render only the newest slice so a 1k+ channel parses 200
  // on open. Older rows render as the header button widens the window (see
  // loadOlderMessages) — the backend map still holds everything for replies.
  const limit = b.renderLimit || INITIAL_RENDER_LIMIT;
  const ids = b.order.length > limit ? b.order.slice(b.order.length - limit) : b.order;
  let prev = null;
  for (const id of ids) {
    const c = b.messages.get(id);
    if (!c) continue;
    const el = msgEl(c, channelId, id, prev);
    view.msgEls.set(id, el);
    frag.appendChild(el);
    prev = c;
  }
  // A jump target flashed just before an async-resolution re-render loses its
  // flash with the old nodes — re-apply it to the fresh node instead.
  if (pendingFlashId && view.msgEls.get(pendingFlashId)) {
    const f = view.msgEls.get(pendingFlashId);
    try {
      f.classList.remove("disc-flash");
      void f.offsetWidth;
      f.classList.add("disc-flash");
      setTimeout(() => { try { f.classList.remove("disc-flash"); } catch (e) {} }, 1600);
    } catch (e) {}
    pendingFlashId = null; pendingFlashTs = 0;
  } else if (pendingFlashTs && Date.now() - pendingFlashTs > 15000) {
    pendingFlashId = null; pendingFlashTs = 0;
  }
  view.msgs.appendChild(frag);
  // innerHTML above wiped the sticky "new messages" pill (it lives last in the
  // list) — re-attach it so it stays the final child.
  try { if (view.newPill) view.msgs.appendChild(view.newPill); } catch (e) {}
  if (follow) view.msgs.scrollTop = view.msgs.scrollHeight;
  else {
    // A pending history fetch owns its anchor (consumed only by the hold:true
    // render its batch triggers). A plain re-render must never spend someone
    // else's anchor — a stale one would teleport the scroll — so it anchors off
    // the position captured above.
    let anchor = null;
    if (opts && opts.hold && b.historyAnchor) {
      anchor = b.historyAnchor;
      b.historyAnchor = null;
      // A fetch that never answered leaves its anchor behind forever; anything
      // older than a minute is too stale to trust.
      if (anchor && anchor.at && Date.now() - anchor.at > 60000) anchor = null;
      // The anchor is the position at fetch start, but the user may have scrolled
      // since (a fetch started before the scroll, arriving before the scroll
      // event refreshed it). The live position captured above is then fresher —
      // trust it instead of flinging back to a stale spot (usually the bottom,
      // which then sticks every later render via gap<2).
      if (anchor && Math.abs(oldTop - anchor.top) > 4) anchor = null;
    }
    if (!anchor) anchor = { height: oldHeight, top: oldTop };
    try { view.msgs.scrollTop = view.msgs.scrollHeight - anchor.height + anchor.top; } catch (e) {}
  }
  // Recompute from the final geometry against the tight engage line, so a hold
  // that landed at the bottom still counts as following.
  try { view.pinBottom = view.msgs.scrollHeight - view.msgs.scrollTop - view.msgs.clientHeight < 2; } catch (e) {}
}

function switchChannel(id) {
  if (!view) return;
  if (!isChannelVisible(id)) return;
  acClose(view);
  view.active = id;
  view.pinBottom = true;
  view.glide = false;
  hideNewPill();
  unread.set(id, 0);
  unreadReply.set(id, 0);
  // Seen only once the messages are actually on screen. A not-yet-loaded backend
  // resolves its baseline at load completion (catch-up first, then seen) — an
  // early touch would move the baseline past while-away mentions on the landing
  // channel before its first load ever runs.
  try { const bb = backends.get(id); if (bb && bb.loaded) touchSeen(id); } catch (e) {}
  emitHot();
  saveLastChannel(id);
  // Before startChat (welcome gate or pre-identity deep link) don't spin up
  // transports — the nickname field stays jank-free. startChat (on Enter, or
  // immediately when no welcome is due) ensures the backend for the pending channel.
  if (!view.chatStarted || (view.welcome && view.welcome.isConnected)) {
    paintChannels();
    paintTopicBar();
    paintReplyBar();
    view.input.placeholder = `Message ${id}…`;
    autosizeComposer(view);
    updateComposerSendState(view);
    return;
  }
  ensureBackend(id);
  paintChannels();
  paintTopicBar();
  paintReplyBar();
  view.input.placeholder = `Message ${id}…`;
  paintStatus(id);
  renderMessages(id, { bottom: true });
  autosizeComposer(view);
  updateComposerSendState(view);
  focusComposer();
  // Cached backend (revisit): the onLoad that lifts the veil won't fire again.
  try { hideBootVeilIfReady(); } catch (e) {}
}

// ---- cold-load sequencing ---------------------------------------------------
// The welcome nickname field must stay smooth, so no chat transport starts while
// the welcome gate stands. mountDiscussion paints an empty shell behind a loading
// veil; startChat (on Enter, or immediately when no welcome is due) ensures only
// the active channel, and the rest pre-warm one-by-one after first paint.
function showBootVeil(text) {
  if (!view || !view.boot || !view.boot.isConnected) return;
  try {
    view.boot.innerHTML = "";
    const spin = document.createElement("span");
    spin.className = "disc-spinner";
    const tx = document.createElement("span");
    tx.textContent = text || "Loading Tavern…";
    view.boot.append(spin, tx);
  } catch (e) {}
}
function hideBootVeilIfReady() {
  if (!view || !view.chatStarted) return;
  let b = null;
  try { b = backends.get(view.active); } catch (e) {}
  // Keep the veil until the active channel answers (or fails — then the error +
  // retry need to be visible, so the veil still lifts).
  if (!b || (!b.loaded && !b.failed)) return;
  try { if (view.boot) view.boot.remove(); } catch (e) {}
  try { if (view) view.boot = null; } catch (e2) {}
}
function startChat(requestedChannel) {
  if (!view) return;
  try {
    if (isSelfBanned()) { try { maybeEnforceTavernBan(); } catch (e) {} return; }
  } catch (e) {}
  if (requestedChannel && isChannelVisible(requestedChannel)) view.active = requestedChannel;
  if (view.chatStarted) {
    if (requestedChannel) switchChannel(view.active);
    return;
  }
  view.chatStarted = true;
  view._otherWarmed = false;
  showBootVeil();
  paintChannels();
  paintTopicBar();
  paintReplyBar();
  // Restore unsent text kept across panel closes (cheap — no transport needed).
  try {
    const draft = textDrafts.get(view.active) || "";
    if (draft) {
      view.input.value = draft;
      updateComposerSendState(view);
    }
    autosizeComposer(view);
  } catch (e) {}
  switchChannel(view.active);
}
// Staggered pre-warm of the non-active channels so unread badges work while you
// read one — one backend per beat after first paint, never 7-at-once on cold load.
function scheduleOtherBackends() {
  if (!view || !view.chatStarted || view._otherWarmed) return;
  const active = view.active;
  const b = backends.get(active);
  if (!b || !b.loaded) return;
  view._otherWarmed = true;
  const rest = visibleChannels().map((c) => c.id).filter((id) => id !== active);
  let i = 0;
  const step = () => {
    if (!view || !view.chatStarted) return;
    if (i >= rest.length) return;
    try { ensureBackend(rest[i]); } catch (e) {}
    i++;
    setTimeout(step, 800);
  };
  setTimeout(step, 800);
}

// Textarea autoresize (border-box: scrollHeight covers content + padding, so the 1px
// top/bottom borders go back on; capped at the CSS max-height). Synced on mount,
// channel switch and every keystroke — never only on first input — so the box height
// can't jump mid-typing.
// ---- shared composer behavior (Tavern view + world threads) -----------------
// One copy of the bits both composers need: input autosizing, send-button
// gating, and the sticker-grid build. The per-target differences (height caps,
// Tavern's follow-repin, Tavern's transport-ready gate) live here as explicit
// branches so the two copies can never drift apart again.
function autosizeComposer(t) {
  if (!t || !t.input) return;
  try {
    t.input.style.height = "auto";
    // The +2 absorbs subpixel rounding: without it a line of text is a
    // fraction of a pixel taller than its box and a scrollbar appears.
    const cap = t === view ? 122 : 120;
    let h = t.input.scrollHeight + 2;
    if (t !== view) h = Math.max(36, h);
    t.input.style.height = Math.min(h, cap) + "px";
  } catch (e) {}
  if (t === view) repinIfFollowing();
}
function updateComposerSendState(t) {
  if (!t || !t.send || !t.input) return;
  let ready = !t.sending;
  if (t === view) {
    // Tavern gates the button on transport readiness; world threads gate only
    // on text (their submit re-checks the controller and reports failure).
    const b = backends.get(t.active);
    ready = ready && !!(b && b.controller);
  }
  t.send.disabled = !ready || !t.input.value.trim();
}
function buildStickerGrid(grid, onPick) {
  if (!grid || typeof onPick !== "function") return;
  for (const name of STICKERS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "disc-stk";
    b.title = `:${name}:`;
    b.setAttribute("aria-label", `Send sticker :${name}:`);
    const img = document.createElement("img");
    img.src = `src/stickers/${name}.webp`;
    img.alt = "";
    img.loading = "lazy";
    img.draggable = false;
    b.append(img);
    b.onclick = () => onPick(name);
    grid.append(b);
  }
}

// Mobile keyboard (same approach as the main app's composer/popups — no height pinning):
// the layout viewport doesn't shrink when the keyboard opens on the default
// `width=device-width, initial-scale=1` viewport (only the visual one does), so while the
// input is focused we pad the composer by the keyboard height and scroll it into view after
// the keyboard animation (the delayed scrollIntoView popups.js / the RP engine use). With a
// shrinking-layout keyboard (resizes-content) the delta is ~0 and this is a no-op next to the
// browser's own pan; the focused-input guard keeps desktop pinch-zoom a no-op. Clears on
// blur / keyboard close.
function keyboardHeight() {
  try {
    if (!window.visualViewport) return 0;
    const kb = window.innerHeight - window.visualViewport.height;
    return kb > 120 ? kb : 0;
  } catch (e) { return 0; }
}
function keepComposerVisible() {
  if (!view) return;
  setTimeout(() => {
    if (!view || document.activeElement !== view.input) return;
    const kb = keyboardHeight();
    try {
      view.composer.style.paddingBottom = kb ? `calc(${kb + 14}px + env(safe-area-inset-bottom, 0px))` : "";
    } catch (e) {}
    if (kb) {
      try { view.composer.scrollIntoView({ block: "end" }); } catch (e) {}
      if (view.pinBottom) { try { view.msgs.scrollTop = view.msgs.scrollHeight; } catch (e) {} }
    }
  }, 300);
}
function clearKbPad() {
  if (!view) return;
  try { view.composer.style.paddingBottom = ""; } catch (e) {}
}
// The main app never steals focus on touch devices (Enter is newline there); match that —
// focusing the composer on every channel switch pops the keyboard while just browsing.
function focusComposer() {
  if (!view) return;
  let coarse = false;
  try { coarse = window.matchMedia("(pointer: coarse)").matches; } catch (e) {}
  if (!coarse) view.input.focus({ preventScroll: true });
}

function coarsePtr() { try { return !!window.matchMedia("(pointer: coarse)").matches; } catch (e) { return false; } }

// Shared submit path: nickname gate, reply header, plugin submit, post-send cleanup.
// `body` is the message after any reply header; `clearInput` empties the composer (text
// sends), stickers never touch the input.
async function submitBody(body, opts) {
  if (!view || view.sending) return false;
  try {
    if (isSelfBanned()) {
      try {
        view.err.hidden = false;
        view.err.textContent = BAN_MSG;
      } catch (e) {}
      try { maybeEnforceTavernBan(); } catch (e2) {}
      return false;
    }
  } catch (e) {}
  const b = backends.get(view.active) || ensureBackend(view.active);
  if (!b.controller) return false;
  // A claimed username speaks for itself — the nick field is locked to it (see
  // applyClaimedNick). Everyone else sends with the saved nickname. Save is the
  // only path that writes storage, and the send re-checks that stored value so an
  // older invalid nickname cannot slip through.
  const nick = myNick();
  if (!claimedName) {
    const bad = nickError(nick);
    if (bad) {
      try {
        view.err.hidden = false;
        view.err.textContent = `Fix your nickname before sending: ${bad}`;
      } catch (e) {}
      try {
        if (view.cfg && view.cfg.hidden) toggleConfigPanel();
        if (view.nick) view.nick.value = nick;
        if (view.cfgErr) {
          view.cfgErr.hidden = false;
          view.cfgErr.textContent = bad;
        }
        if (!coarsePtr() && view.nick) view.nick.focus({ preventScroll: true });
      } catch (e2) {}
      return false;
    }
  }
  // A pending reply rides along as the machine-readable header every client parses —
  // plus your stable app userId (claimed or not — unregistered tags never verify,
  // see verifiedFor, but they give moderation a stable per-device key), so receivers
  // can check the name is really yours when claimed.
  const targetId = drafts.get(view.active);
  const target = targetId && b.messages.get(targetId);
  // Mint the device identity on first send so even a never-claimed chatter tags a
  // stable id (identityOrNull above deliberately does not create one for lurkers).
  let uid = deviceUserId || claimedUserId;
  if (!uid) {
    try {
      const m = await import("./community.js");
      const ident = await m.api.identity();
      uid = (ident && ident.userId) ? String(ident.userId) : "";
      if (uid) deviceUserId = uid;
    } catch (e) {}
  }
  const tag = uid ? `⟦uid:${uid}⟧ ` : "";
  const payload = (target ? `⟦reply:${targetId}⟧ ` : "") + tag + body;
  view.sending = true;
  updateComposerSendState(view);
  view.err.hidden = true;
  try {
    if (nick && typeof b.controller.setNicknameForNextComment === "function") {
      try { await b.controller.setNicknameForNextComment(nick); } catch (e) {}
    }
    // Nicknames ride the transport; avatars don't. Your own profile avatar renders
    // locally on your messages (see msgEl) — nothing is converted or re-uploaded, and
    // a send can never fail on a picture.
    await b.controller.submit(payload, { timeoutMs: 60000 });
    if (opts && opts.clearInput) {
      view.input.value = "";
      view.input.style.height = "auto";
      try { textDrafts.delete(view.active); } catch (e) {}
    }
    view.pinBottom = true;
    // Your own send always lands you at the live tail — jump now (the echo
    // re-pins via force-follow below if anything lands in between).
    try { if (view.msgs) view.msgs.scrollTop = view.msgs.scrollHeight; } catch (e) {}
    if (target) drafts.delete(view.active);
    paintReplyBar();
    return true;
  } catch (e) {
    view.err.hidden = false;
    view.err.textContent = `Couldn't send: ${(e && e.message) || e}. Try again.`;
    return false;
  } finally {
    view.sending = false;
    updateComposerSendState(view);
    if (!coarsePtr()) view.input.focus({ preventScroll: true });
  }
}

async function sendCurrent() {
  if (!view || view.sending) return;
  acClose(view);
  const text = view.input.value.trim();
  if (!text) return;
  await submitBody(text, { clearInput: true });
}

// Stickers send through the same gate + transport as text (nickname, reply header,
// avatar) — the body is just the `:name:` text, picker or typed alike.
function sendSticker(name) {
  if (!view || view.sending || !STICKER_SET.has(name)) return;
  closeStickerPicker();
  submitBody(`:${name}:`, {}).catch(() => {});
}
function closeStickerPicker() {
  if (!view || !view.stkPicker) return;
  view.stkPicker.hidden = true;
  try { view.stkBtn.setAttribute("aria-expanded", "false"); } catch (e) {}
}
function toggleStickerPicker() {
  if (!view || !view.stkPicker) return;
  if (!view.stkPicker.hidden) { closeStickerPicker(); return; }
  if (!view.stkBuilt) {
    view.stkBuilt = true;
    buildStickerGrid(view.stkGrid, sendSticker);
  }
  view.stkPicker.hidden = false;
  try { view.stkBtn.setAttribute("aria-expanded", "true"); } catch (e) {}
}

// ---- per-world threads (detail-panel comments) ----------------------------
// Same transport (backends) + same renderer (msgEl/chatMd/mentions/stickers/
// world-cards) as the Tavern, but mounted inside an Explore detail panel.
// Each thread owns its own view object (wv); several can exist but in practice
// one panel is open at a time. Notifications reuse the Tavern inbox/toast path.
function paintWorldStatus(channelId) {
  const set = worldViews.get(channelId);
  if (!set || !set.size) return;
  // Ban gate: loading veil ("Loading comments…") doubles as the check point —
  // a banned visitor never sees the thread, only the banned notice.
  try {
    if (isSelfBanned()) {
      for (const wv of [...set]) { try { paintWorldBanned(wv); } catch (e) {} }
      return;
    }
  } catch (e) {}
  const b = backends.get(channelId);
  for (const wv of set) {
    try {
      if (!wv.status) continue;
      if (wv.banned) { try { paintWorldBanned(wv); } catch (e2) {} continue; }
      if (b && b.failed && !b.loaded) {
        wv.status.hidden = false;
        wv.status.className = "disc-status is-err";
        wv.status.textContent = `Couldn't load comments: ${b.failed}`;
        if (wv.retry) wv.retry.hidden = false;
      } else if (!b || !b.loaded) {
        wv.status.hidden = false;
        wv.status.className = "disc-status is-loading";
        wv.status.innerHTML = `<span class="disc-spinner"></span> Loading comments…`;
        if (wv.retry) wv.retry.hidden = true;
      } else {
        if (wv.retry) wv.retry.hidden = true;
        if (!b.order.length) {
          wv.status.hidden = false;
          wv.status.className = "disc-status is-empty";
          wv.status.textContent = "No comments yet — be the first! Be kind, no spam.";
        } else {
          wv.status.hidden = true;
        }
      }
    } catch (e) {}
  }
}
function worldHistoryHeaderEl(wv) {
  const b = backends.get(wv.channelId);
  if (!b || !b.loaded || b.failed || !b.order.length) return null;
  const limit = wv.limit || WORLD_RENDER_LIMIT;
  if (b.order.length > limit) {
    const wrap = document.createElement("div");
    wrap.className = "disc-history" + (b.loadingMore ? " is-loading" : "");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "disc-history-btn";
    btn.disabled = !!b.loadingMore;
    btn.textContent = b.loadingMore ? "Loading older comments…" : `↑ Show older comments · showing ${limit} of ${b.order.length}`;
    btn.onclick = () => { loadOlderWorldMessages(wv); };
    wrap.appendChild(btn);
    return wrap;
  }
  if (b.historyExhausted || !b.loadMoreBtn || (b.loadMoreBtn.style && b.loadMoreBtn.style.display === "none")) {
    if (b.order.length <= 5) return null;
    const wrap = document.createElement("div");
    wrap.className = "disc-history is-end";
    wrap.textContent = `Beginning of comments · ${b.order.length} messages`;
    return wrap;
  }
  const wrap = document.createElement("div");
  wrap.className = "disc-history" + (b.loadingMore ? " is-loading" : "");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "disc-history-btn";
  btn.disabled = !!b.loadingMore;
  btn.textContent = b.loadingMore ? "Loading older comments…" : `↑ Load older comments · showing ${b.order.length}`;
  btn.onclick = () => { loadOlderWorldMessages(wv); };
  wrap.appendChild(btn);
  return wrap;
}
function loadOlderWorldMessages(wv) {
  try { if ((wv && wv.banned) || isSelfBanned()) return false; } catch (e) {}
  const b = backends.get(wv.channelId);
  if (!b || !b.loaded || b.loadingMore) return false;
  const limit = wv.limit || WORLD_RENDER_LIMIT;
  if (b.order.length > limit) {
    wv.limit = Math.min(b.order.length, limit + WORLD_RENDER_LIMIT);
    renderWorldMessages(wv, { hold: true });
    return true;
  }
  if (b.historyExhausted) return false;
  const btn = b.loadMoreBtn;
  if (!btn || (btn.style && btn.style.display === "none") || btn.disabled) {
    if (!btn || (btn.style && btn.style.display === "none")) {
      b.historyExhausted = true;
      renderWorldMessages(wv, { hold: true });
    }
    return false;
  }
  try { wv.histAnchor = wv.msgs ? { height: wv.msgs.scrollHeight, top: wv.msgs.scrollTop, at: Date.now() } : null; } catch (e) { wv.histAnchor = null; }
  b.loadingMore = true;
  b.fetchManual = true;
  try { paintWorldStatus(wv.channelId); } catch (e) {}
  try { btn.click(); } catch (e) { b.loadingMore = false; wv.histAnchor = null; b.fetchManual = false; return false; }
  return true;
}
function renderWorldViews(channelId, opts) {
  const set = worldViews.get(channelId);
  if (!set || !set.size) return;
  for (const wv of [...set]) {
    try { renderWorldMessages(wv, opts); } catch (e) {}
    try { paintWorldStatus(channelId); } catch (e2) {}
  }
}
function renderWorldMessages(wv, opts) {
  if (!wv || !wv.msgs) return;
  try {
    if (wv.banned || isSelfBanned()) {
      try { paintWorldBanned(wv); } catch (e) {}
      return;
    }
  } catch (e) {}
  const b = backends.get(wv.channelId);
  const oldHeight = wv.msgs.scrollHeight;
  const oldTop = wv.msgs.scrollTop;
  const gap = oldHeight - oldTop - wv.msgs.clientHeight;
  const follow = !!((opts && opts.bottom) || (opts && opts.mine) || wv.pinBottom && gap < 24 || gap < 2);
  wv.msgs.innerHTML = "";
  wv.msgEls = new Map();
  if (!b || !b.loaded || !b.order.length) {
    try { if (wv.onCount) wv.onCount(b && b.loaded ? 0 : -1); } catch (e) {}
    return;
  }
  const frag = document.createDocumentFragment();
  const hist = worldHistoryHeaderEl(wv);
  if (hist) frag.appendChild(hist);
  const limit = wv.limit || WORLD_RENDER_LIMIT;
  const ids = b.order.length > limit ? b.order.slice(b.order.length - limit) : b.order;
  let prev = null;
  const ctx = { onReply: (id) => startWorldReply(wv, id), onJump: (id) => jumpToWorldMessage(wv, id) };
  for (const id of ids) {
    const c = b.messages.get(id);
    if (!c) continue;
    const elx = msgEl(c, wv.channelId, id, prev, ctx);
    wv.msgEls.set(id, elx);
    frag.appendChild(elx);
    prev = c;
  }
  wv.msgs.appendChild(frag);
  if (follow) { try { wv.msgs.scrollTop = wv.msgs.scrollHeight; } catch (e) {} }
  else {
    let anchor = null;
    if (opts && opts.hold && wv.histAnchor) {
      anchor = wv.histAnchor;
      wv.histAnchor = null;
      if (anchor && anchor.at && Date.now() - anchor.at > 60000) anchor = null;
      if (anchor && Math.abs(oldTop - anchor.top) > 4) anchor = null;
    }
    // Ghost-reply backfill mints a backend-level anchor (queueTargetLoad), not a
    // per-thread one — spend it here so the position still holds.
    if (!anchor && opts && opts.hold && b.historyAnchor) {
      anchor = b.historyAnchor;
      b.historyAnchor = null;
      if (anchor && anchor.at && Date.now() - anchor.at > 60000) anchor = null;
    }
    if (!anchor) anchor = { height: oldHeight, top: oldTop };
    try { wv.msgs.scrollTop = wv.msgs.scrollHeight - anchor.height + anchor.top; } catch (e) {}
  }
  try { wv.pinBottom = wv.msgs.scrollHeight - wv.msgs.scrollTop - wv.msgs.clientHeight < 2; } catch (e) {}
  try { if (wv.onCount) wv.onCount(b.order.length); } catch (e2) {}
}
function appendWorldLiveMessage(channelId, comment) {
  const set = worldViews.get(channelId);
  if (!set || !set.size) return false;
  let handled = false;
  for (const wv of set) {
    try {
      const b = backends.get(channelId);
      if (!b || b.loadingMore || wv.histAnchor) continue;
      const n = b.order.length;
      if (!n || b.messages.get(b.order[n - 1]) !== comment) continue;
      const prev = n > 1 ? b.messages.get(b.order[n - 2]) || null : null;
      const ctx = { onReply: (id) => startWorldReply(wv, id), onJump: (id) => jumpToWorldMessage(wv, id) };
      const elx = msgEl(comment, channelId, b.order[n - 1], prev, ctx);
      if (!elx) continue;
      const gap = wv.msgs.scrollHeight - wv.msgs.scrollTop - wv.msgs.clientHeight;
      const follow = gap < 2 || isMine(comment) || (wv.pinBottom && gap < 24);
      wv.msgs.appendChild(elx);
      wv.msgEls.set(b.order[n - 1], elx);
      try {
        if (follow && wv.msgEls.size > (wv.limit || WORLD_RENDER_LIMIT)) {
          const dropId = b.order[n - (wv.limit || WORLD_RENDER_LIMIT) - 1];
          const dropEl = dropId && wv.msgEls.get(dropId);
          if (dropEl && dropEl.parentNode === wv.msgs) { dropEl.remove(); wv.msgEls.delete(dropId); }
        }
      } catch (e) {}
      if (follow) { try { wv.msgs.scrollTop = wv.msgs.scrollHeight; } catch (e2) {} }
      try { wv.pinBottom = wv.msgs.scrollHeight - wv.msgs.scrollTop - wv.msgs.clientHeight < 2; } catch (e3) {}
      try { if (wv.onCount) wv.onCount(b.order.length); } catch (e4) {}
      handled = true;
    } catch (e) {}
  }
  return handled;
}
function jumpToWorldMessage(wv, msgId) {
  if (!wv || !msgId) return;
  try {
    const b = backends.get(wv.channelId);
    if (b && msgId && b.messages.get(msgId) && (!wv.msgEls || !wv.msgEls.get(msgId))) {
      const idx = b.order.indexOf(msgId);
      if (idx >= 0) {
        const need = b.order.length - idx;
        if (need > (wv.limit || WORLD_RENDER_LIMIT)) {
          wv.limit = Math.min(b.order.length, need);
          renderWorldMessages(wv, { hold: true });
        }
      }
    }
  } catch (e) {}
  const elx = wv.msgEls && wv.msgEls.get(msgId);
  if (!elx) return;
  try { elx.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) { try { elx.scrollIntoView({ block: "center" }); } catch (e2) {} }
  try { elx.classList.remove("disc-flash"); void elx.offsetWidth; elx.classList.add("disc-flash"); setTimeout(() => { try { elx.classList.remove("disc-flash"); } catch (e3) {} }, 1600); } catch (e4) {}
}
function startWorldReply(wv, msgId) {
  if (!wv) return;
  const b = backends.get(wv.channelId);
  const target = b && b.messages.get(msgId);
  if (!target) return;
  drafts.set(wv.channelId, msgId);
  paintWorldReplyBar(wv);
  try { wv.input.focus({ preventScroll: true }); } catch (e) {}
}
function clearWorldReply(wv) {
  if (!wv) return;
  drafts.delete(wv.channelId);
  paintWorldReplyBar(wv);
}
function paintWorldReplyBar(wv) {
  if (!wv || !wv.replybar) return;
  const targetId = drafts.get(wv.channelId);
  const b = backends.get(wv.channelId);
  const target = targetId && b ? b.messages.get(targetId) : null;
  if (!target) {
    if (targetId) drafts.delete(wv.channelId);
    wv.replybar.hidden = true;
    return;
  }
  wv.replybar.hidden = false;
  try { paintAuthorName(wv.replyWho, target, "@"); } catch (e) {}
  try { wv.replyEx.textContent = excerptOf(target, 90) || "(empty message)"; } catch (e2) {}
}

async function submitWorldBody(wv, body, opts) {
  if (!wv || wv.sending) return false;
  try {
    if (isSelfBanned()) {
      try { dropAllCommentBackends(); } catch (e3) {}
      try { paintWorldBanned(wv); } catch (e) {}
      try { showBannedPopup("world"); } catch (e2) {}
      return false;
    }
  } catch (e) {}
  const b = backends.get(wv.channelId) || ensureBackend(wv.channelId);
  if (!b.controller) return false;
  const nick = myNick();
  if (!claimedName) {
    const bad = nickError(nick);
    if (bad) {
      try { wv.err.hidden = false; wv.err.textContent = `Fix your nickname before commenting: ${bad} (set it in the Tavern).`; } catch (e) {}
      return false;
    }
  }
  const targetId = drafts.get(wv.channelId);
  const target = targetId && b.messages.get(targetId);
  let uid = deviceUserId || claimedUserId;
  if (!uid) {
    try {
      const m = await import("./community.js");
      const ident = await m.api.identity();
      uid = (ident && ident.userId) ? String(ident.userId) : "";
      if (uid) deviceUserId = uid;
    } catch (e) {}
  }
  const tag = uid ? `⟦uid:${uid}⟧ ` : "";
  const payload = (target ? `⟦reply:${targetId}⟧ ` : "") + tag + body;
  wv.sending = true;
  updateComposerSendState(wv);
  try { wv.err.hidden = true; } catch (e) {}
  try {
    if (nick && typeof b.controller.setNicknameForNextComment === "function") {
      try { await b.controller.setNicknameForNextComment(nick); } catch (e) {}
    }
    await b.controller.submit(payload, { timeoutMs: 60000 });
    if (opts && opts.clearInput) {
      wv.input.value = "";
      wv.input.style.height = "auto";
      try { textDrafts.delete(wv.channelId); } catch (e) {}
    }
    wv.pinBottom = true;
    try { wv.msgs.scrollTop = wv.msgs.scrollHeight; } catch (e2) {}
    if (target) drafts.delete(wv.channelId);
    paintWorldReplyBar(wv);
    // Joining the thread watches it: fully for your own worlds, replies and
    // @mentions for everyone else's. Baselines silently — your own message and
    // everything already here are history, not news.
    try { noteWorldComment(wv.worldId, wv.title, !!wv.mine); } catch (e3) {}
    return true;
  } catch (e) {
    try { wv.err.hidden = false; wv.err.textContent = `Couldn't send: ${(e && e.message) || e}. Try again.`; } catch (e2) {}
    return false;
  } finally {
    wv.sending = false;
    updateComposerSendState(wv);
  }
}
export function mountWorldComments(container, worldId, opts) {
  const channelId = worldChannelFor(worldId);
  if (!channelId || !container) return () => {};
  try { loadServerBans().then(() => { try { if (isSelfBanned()) { const set = worldViews.get(channelId); if (set && set.size) maybeEnforceWorldBan(channelId); } } catch (e) {} }); } catch (e) {}
  const title = opts && opts.title ? String(opts.title).slice(0, 80) : "";
  if (title) { try { worldTitles.set(channelId, title); } catch (e) {} }
  const onCount = opts && typeof opts.onCount === "function" ? opts.onCount : null;
  const mine = !!(opts && opts.mine);
  const root = document.createElement("div");
  root.className = "wd-comments-disc";
  root.innerHTML = `
    <div class="disc-msgs wd-comments-msgs" role="log" aria-live="polite" aria-label="World comments"></div>
    <div class="disc-status" hidden></div>
    <div class="disc-err" hidden></div>
    <div class="disc-replybar" hidden>
      <span class="disc-replyto">Replying to <b class="disc-replywho"></b></span>
      <span class="disc-replyex"></span>
      <button type="button" class="disc-replyx" title="Cancel reply">✕</button>
    </div>
    <div class="disc-composer">
      <button type="button" class="disc-retry" hidden>↻ Retry</button>
      <button type="button" class="disc-stkbtn" title="Stickers (or type :name: in chat)" aria-label="Send a sticker" aria-expanded="false"><span class="disc-stk-ic" aria-hidden="true"></span></button>
      <textarea class="disc-input" rows="1" maxlength="1000" placeholder="Leave a comment..."></textarea>
      <button type="button" class="disc-send" disabled>Send</button>
      <div class="disc-stkpicker" hidden><div class="disc-stkgrid" role="list"></div></div>
      <div class="disc-acpicker" hidden><div class="disc-aclist" role="listbox" aria-label="Mention someone"></div></div>
    </div>`;
  container.appendChild(root);
  const wv = {
    channelId, worldId: String(worldId || ""), title, mine,
    root, msgs: root.querySelector(".disc-msgs"),
    status: root.querySelector(".disc-status"), err: root.querySelector(".disc-err"),
    replybar: root.querySelector(".disc-replybar"), replyWho: root.querySelector(".disc-replywho"), replyEx: root.querySelector(".disc-replyex"),
    input: root.querySelector(".disc-input"), send: root.querySelector(".disc-send"),
    stkBtn: root.querySelector(".disc-stkbtn"), stkPicker: root.querySelector(".disc-stkpicker"), stkGrid: root.querySelector(".disc-stkgrid"),
    stkBuilt: false, retry: root.querySelector(".disc-retry"), composer: root.querySelector(".disc-composer"),
    acPicker: root.querySelector(".disc-acpicker"), acList: root.querySelector(".disc-aclist"),
    acToken: null, acRows: null, acActive: 0,
    msgEls: new Map(), sending: false, pinBottom: true, lastTop: null,
    limit: WORLD_RENDER_LIMIT, histAnchor: null, onCount,
  };
  // Restore the reader's last panel height (native `resize: vertical` handle on
  // `.wd-comments-disc`); the drag writes an inline height, this replays it.
  try {
    const savedH = readWdCommentsHeight();
    if (savedH) wv.root.style.height = savedH + "px";
  } catch (e) {}
  // Persist drags (debounced — ResizeObserver fires every frame of a drag).
  try {
    let hT = 0;
    const ro = new ResizeObserver(() => {
      try { clearTimeout(hT); } catch (e) {}
      hT = setTimeout(() => {
        try {
          const h = wv.root ? wv.root.getBoundingClientRect().height : 0;
          if (h >= WD_COMMENTS_H_MIN - 1) saveWdCommentsHeight(h);
        } catch (e) {}
      }, 250);
    });
    ro.observe(wv.root);
    wv.panelResizeObs = ro;
    wv.panelResizeT = () => hT;
  } catch (e) {}
  let set = worldViews.get(channelId);
  if (!set) { set = new Set(); worldViews.set(channelId, set); }
  set.add(wv);
  // Detail-panel scroll must not fight the inner list: only the messages box scrolls.
  paintWorldReplyBar(wv);
  try {
    const draft = textDrafts.get(channelId) || "";
    if (draft) { wv.input.value = draft; autosizeComposer(wv); }
    updateComposerSendState(wv);
  } catch (e) {}
  const onScroll = () => {
    try {
      const top = wv.msgs.scrollTop;
      if (wv.lastTop != null && top < wv.lastTop - 4) wv.pinBottom = false;
      wv.lastTop = top;
      const gap = wv.msgs.scrollHeight - top - wv.msgs.clientHeight;
      if (gap < 2) wv.pinBottom = true;
      else if (gap > 120) wv.pinBottom = false;
      try {
        const bb = backends.get(channelId);
        if (bb && bb.loadingMore) wv.histAnchor = { height: wv.msgs.scrollHeight, top, at: Date.now() };
      } catch (e2) {}
      if (top < 120) loadOlderWorldMessages(wv);
    } catch (e) {}
  };
  wv.onScroll = onScroll;
  try { wv.msgs.addEventListener("scroll", onScroll, { passive: true }); } catch (e) {}
  const onSpoilerClick = (e) => {
    const sp = e.target && e.target.closest ? e.target.closest(".spoiler") : null;
    if (sp && wv.msgs.contains(sp)) sp.classList.toggle("open");
  };
  const onSpoilerKey = (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target && e.target.classList && e.target.classList.contains("spoiler")) {
      e.preventDefault();
      e.target.classList.toggle("open");
    }
  };
  wv.onSpoilerClick = onSpoilerClick; wv.onSpoilerKey = onSpoilerKey;
  try { wv.msgs.addEventListener("click", onSpoilerClick); } catch (e) {}
  try { wv.msgs.addEventListener("keydown", onSpoilerKey); } catch (e) {}
  wv.msgs.addEventListener("pointerdown", (e) => {
    const t = e.target;
    if (!t || !t.closest) return;
    if (t.closest("button, a, input, textarea, select, .spoiler")) return;
    const m = t.closest(".disc-msg");
    if (m && wv.msgs.contains(m)) { try { m.focus({ preventScroll: true }); } catch (e2) {} try { m.dataset.tapFocus = String(Date.now()); } catch (e3) {} }
  });
  root.querySelector(".disc-replyx").onclick = () => clearWorldReply(wv);
  wv.input.addEventListener("input", () => { autosizeComposer(wv); try { textDrafts.set(channelId, wv.input.value); } catch (e) {} updateComposerSendState(wv); acUpdate(wv); });
  // Caret moves without typing can enter or leave a mention candidate —
  // same re-evaluation as the Tavern composer.
  wv.input.addEventListener("click", () => { acUpdate(wv); });
  wv.input.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home" || e.key === "End") acUpdate(wv);
  });
  wv.input.addEventListener("keydown", (e) => {
    if (wv.acPicker && !wv.acPicker.hidden) {
      if (e.key === "ArrowDown") { e.preventDefault(); acMove(wv, 1); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); acMove(wv, -1); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); e.stopPropagation(); acAccept(wv, wv.acActive || 0); return; }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); acClose(wv); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendWorldCurrent(wv); }
    else if (e.key === "Escape" && wv.stkPicker && !wv.stkPicker.hidden) { e.preventDefault(); e.stopPropagation(); closeWorldStickers(wv); }
    else if (e.key === "Escape" && drafts.get(channelId)) { e.preventDefault(); e.stopPropagation(); clearWorldReply(wv); }
  });
  wv.send.onclick = () => sendWorldCurrent(wv);
  wv.stkBtn.onclick = (ev) => { ev.stopPropagation(); toggleWorldStickers(wv); };
  wv.onStkOutside = (e) => {
    if (!wv.stkPicker || wv.stkPicker.hidden) return;
    if (wv.stkPicker.contains(e.target) || (wv.stkBtn && wv.stkBtn.contains(e.target))) return;
    closeWorldStickers(wv);
  };
  try { document.addEventListener("pointerdown", wv.onStkOutside, true); } catch (e) {}
  // Same outside-tap dismissal for the @ autocomplete popup (Tavern parity).
  wv.onAcOutside = (e) => {
    if (!wv || !wv.acPicker || wv.acPicker.hidden) return;
    if (wv.acPicker.contains(e.target)) return;
    acClose(wv);
  };
  try { document.addEventListener("pointerdown", wv.onAcOutside, true); } catch (e) {}
  wv.retry.onclick = () => {
    const old = backends.get(channelId);
    if (old && old.host) { try { old.host.remove(); } catch (e) {} backends.delete(channelId); }
    ensureBackend(channelId);
    paintWorldStatus(channelId);
    renderWorldViews(channelId);
  };
  // Opening the thread marks it seen.
  try { touchSeen(channelId); } catch (e3) {}
  if (!window.commentsPlugin) {
    try { wv.status.hidden = false; wv.status.className = "disc-status is-err"; wv.status.textContent = "Comments backend didn't load (comments plugin missing). Reload the page."; } catch (e) {}
    return () => { try { unmountWorldComments(wv); } catch (e2) {} };
  }
  ensureBackend(channelId);
  paintWorldStatus(channelId);
  renderWorldViews(channelId, { bottom: true });
  // Ban gate during the loading veil ("Loading comments…"): a banned visitor
  // never sees the thread — notice inline + small popup, same as the Tavern.
  // All transports go too (see dropAllCommentBackends).
  try {
    if (isSelfBanned()) {
      try { dropAllCommentBackends(); } catch (e3) {}
      try { paintWorldBanned(wv); } catch (e) {}
      setTimeout(() => { try { showBannedPopup("world"); } catch (e2) {} }, 60);
    }
  } catch (e) {}
  // Keep the stored title fresh for inbox jumps to older alerts.
  try { loadClaimedName(); } catch (e) {}
  return () => { unmountWorldComments(wv); };
}
function unmountWorldComments(wv) {
  if (!wv) return;
  try { if (wv.panelResizeObs) wv.panelResizeObs.disconnect(); } catch (e) {}
  try { if (wv.panelResizeT) clearTimeout(wv.panelResizeT()); } catch (e) {}
  try {
    const set = worldViews.get(wv.channelId);
    if (set) { set.delete(wv); if (!set.size) worldViews.delete(wv.channelId); }
  } catch (e) {}
  try { if (wv.channelId) textDrafts.set(wv.channelId, wv.input ? wv.input.value : ""); } catch (e) {}
  try { if (wv.msgs && wv.onScroll) wv.msgs.removeEventListener("scroll", wv.onScroll); } catch (e) {}
  try { if (wv.msgs && wv.onSpoilerClick) wv.msgs.removeEventListener("click", wv.onSpoilerClick); } catch (e) {}
  try { if (wv.msgs && wv.onSpoilerKey) wv.msgs.removeEventListener("keydown", wv.onSpoilerKey); } catch (e) {}
  try { if (wv.onStkOutside) document.removeEventListener("pointerdown", wv.onStkOutside, true); } catch (e) {}
  try { if (wv.onAcOutside) document.removeEventListener("pointerdown", wv.onAcOutside, true); } catch (e) {}
  // No open threads left: drop the headless backend (count subscribers hold
  // it the same way). Otherwise browsing many worlds would stack an iframe
  // per world.
  try {
    const still = worldViews.get(wv.channelId);
    if ((!still || !still.size) && wv.channelId) {
      try { maybeDropBackend(wv.channelId, wv.mine); } catch (e2) {}
    }
  } catch (e5) {}
  try { flushLastSeen(); } catch (e2) {}
  try { wv.root.remove(); } catch (e3) {}
}
async function sendWorldCurrent(wv) {
  if (!wv || wv.sending) return;
  acClose(wv);
  const text = wv.input.value.trim();
  if (!text) return;
  await submitWorldBody(wv, text, { clearInput: true });
}
function closeWorldStickers(wv) {
  if (!wv || !wv.stkPicker) return;
  wv.stkPicker.hidden = true;
  try { wv.stkBtn.setAttribute("aria-expanded", "false"); } catch (e) {}
}
function toggleWorldStickers(wv) {
  if (!wv || !wv.stkPicker) return;
  if (!wv.stkPicker.hidden) { closeWorldStickers(wv); return; }
  if (!wv.stkBuilt) {
    wv.stkBuilt = true;
    buildStickerGrid(wv.stkGrid, (name) => { closeWorldStickers(wv); submitWorldBody(wv, `:${name}:`, {}).catch(() => {}); });
  }
  wv.stkPicker.hidden = false;
  try { wv.stkBtn.setAttribute("aria-expanded", "true"); } catch (e) {}
}

export async function mountDiscussion(pane, ctx) {
  const start = loadLastChannel();
  const active = isChannelVisible(start) ? start : CHANNELS[0].id;

  const root = document.createElement("div");
  root.className = "disc";
  root.innerHTML = `
    <div class="disc-boot" aria-label="Loading Tavern"><span class="disc-spinner"></span><span>Loading Tavern…</span></div>
    <div class="disc-side">
      <div class="disc-sidehead">Channels</div>
      <div class="disc-chans" role="list"></div>
      <button type="button" class="disc-channav prev" aria-label="Scroll channels left" title="Scroll channels left" tabindex="-1" hidden>‹</button>
      <button type="button" class="disc-channav next" aria-label="Scroll channels right" title="Scroll channels right" tabindex="-1" hidden>›</button>
    </div>
    <div class="disc-main">
      <div class="disc-topicbar" aria-label="Channel topic"></div>
      <div class="disc-msgs" role="log" aria-live="polite" aria-label="Messages"><button type="button" class="disc-newpill" hidden></button></div>
      <div class="disc-status" hidden></div>
      <div class="disc-err" hidden></div>
      <div class="disc-replybar" hidden>
        <span class="disc-replyto">Replying to <b class="disc-replywho"></b></span>
        <span class="disc-replyex"></span>
        <button type="button" class="disc-replyx" title="Cancel reply">✕</button>
      </div>
      <div class="disc-composer">
        <button type="button" class="disc-retry" hidden>↻ Retry</button>
        <button type="button" class="disc-stkbtn" title="Stickers (or type :name: in chat)" aria-label="Send a sticker" aria-expanded="false"><span class="disc-stk-ic" aria-hidden="true"></span></button>
        <textarea class="disc-input" rows="1" maxlength="1000" placeholder="Message guild…"></textarea>
        <button type="button" class="disc-send" disabled>Send</button>
        <div class="disc-stkpicker" hidden>
          <div class="disc-stkgrid" role="list"></div>
        </div>
        <div class="disc-acpicker" hidden>
          <div class="disc-aclist" role="listbox" aria-label="Mention someone"></div>
        </div>
      </div>
    </div>`;
  pane.appendChild(root);
  // Ban refresh never blocks mount — fire-and-forget on the cached snapshot.
  // openDiscussionPanel enforces async when the fresh list lands; a slow or
  // failing (1006) fetch just leaves the fail-open snapshot in place.
  try { loadServerBans().catch(() => {}); } catch (e) {}

  view = {
    root,
    boot: root.querySelector(".disc-boot"),
    chanList: root.querySelector(".disc-chans"),
    topicBar: root.querySelector(".disc-topicbar"),
    // Config chrome (nickname, notifications) lives in the panel head — wired by
    // openDiscussionPanel after mount (same module, refs assigned before first paint).
    cfg: null,
    cfgBtn: null,
    cfgErr: null,
    notifyReplySw: null,
    notifyAllSw: null,
    notifyWdSw: null,
    fabSw: null,
    welcome: null,
    welcomeHost: null,
    msgs: root.querySelector(".disc-msgs"),
    status: root.querySelector(".disc-status"),
    err: root.querySelector(".disc-err"),
    replybar: root.querySelector(".disc-replybar"),
    replyWho: root.querySelector(".disc-replywho"),
    replyEx: root.querySelector(".disc-replyex"),
    input: root.querySelector(".disc-input"),
    send: root.querySelector(".disc-send"),
    stkBtn: root.querySelector(".disc-stkbtn"),
    stkPicker: root.querySelector(".disc-stkpicker"),
    stkGrid: root.querySelector(".disc-stkgrid"),
    stkBuilt: false,
    acPicker: root.querySelector(".disc-acpicker"),
    acList: root.querySelector(".disc-aclist"),
    acToken: null,
    acRows: null,
    acActive: 0,
    retry: root.querySelector(".disc-retry"),
    nick: null,
    composer: root.querySelector(".disc-composer"),
    active,
    sending: false,
    pinBottom: true,
    glide: false,
    lastTop: null,
    newPill: root.querySelector(".disc-newpill"),
    newCount: 0,
    msgEls: new Map(),
    onScroll: null,
    chanPrev: root.querySelector(".disc-channav.prev"),
    chanNext: root.querySelector(".disc-channav.next"),
    onChanScroll: null,
    chanRO: null,
    page: pane.closest ? pane.closest(".hm-page") : null,
    onVvResize: null,
    onInputFocus: null,
    onInputBlur: null,
    chatStarted: false,
    _otherWarmed: false,
  };
  // Config panel chrome is wired by openDiscussionPanel once the panel head exists.
  root.querySelector(".disc-replyx").onclick = clearReply;
  view.input.placeholder = `Message ${active}…`;

  view.onScroll = () => {
    const m = view.msgs;
    const top = m.scrollTop;
    // Deliberate upward movement disengages follow at once (and cancels a pill
    // glide — the user took over). This is what stops the "fight": the moment you
    // start scrolling up, arrivals can no longer yank you back down. We never move
    // the scroll upward ourselves (follow jumps go down, anchor restores hold or
    // move down), so with a few px of slop any upward motion is the user.
    if (view.lastTop != null && top < view.lastTop - 4) {
      view.pinBottom = false;
      view.glide = false;
    }
    view.lastTop = top;
    const gap = m.scrollHeight - top - m.clientHeight;
    // No tolerance: (re)engage only at the true bottom, release once clearly away.
    // Anything in between holds its current state — no flapping near the edge.
    if (gap < 2) {
      view.pinBottom = true;
      view.glide = false;
      hideNewPill();
    } else if (gap > 120) {
      view.pinBottom = false;
    }
    // Keep a pending history anchor fresh: if the user keeps scrolling while an
    // older batch is in flight, the batch render must hold where they ARE when
    // it lands, not where they were when the fetch started.
    try {
      const b = backends.get(view.active);
      if (b && b.loadingMore) b.historyAnchor = { height: m.scrollHeight, top, at: Date.now() };
    } catch (e) {}
    // Infinite scroll-up: reaching the top pulls the next older page (same 200/msg
    // fetch as the header button). Single-flight gate inside loadOlderMessages
    // debounces this naturally — it stays true until the batch lands.
    try {
      if (top < 250) loadOlderMessages(view.active);
    } catch (e) {}
  };
  view.msgs.addEventListener("scroll", view.onScroll, { passive: true });
  // "New messages" pill: while unfollowed, arrivals pile a count here instead of
  // moving the scroll. Tapping jumps to the live tail (scroll events re-engage).
  // Sets the glide flag so an arrival mid-glide follows instead of freezing it.
  if (view.newPill) view.newPill.onclick = () => {
    if (!view || !view.msgs) return;
    view.glide = true;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try { view.msgs.scrollTo({ top: view.msgs.scrollHeight, behavior: reduce ? "auto" : "smooth" }); } catch (e) {
      try { view.msgs.scrollTop = view.msgs.scrollHeight; } catch (e2) {}
    }
  };

  // Mobile channel-strip cues (see paintChanNav): repaint on scroll/resize, step
  // the strip by ~60% of its width per tap. Elements die with the view; the
  // observer is disconnected in release().
  view.onChanScroll = () => { paintChanNav(); };
  view.chanList.addEventListener("scroll", view.onChanScroll, { passive: true });
  const stepChanNav = (d) => {
    if (!view || !view.chanList) return;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try { view.chanList.scrollBy({ left: d * Math.max(120, Math.round(view.chanList.clientWidth * 0.6)), behavior: reduce ? "auto" : "smooth" }); } catch (e) {}
  };
  if (view.chanPrev) view.chanPrev.onclick = () => stepChanNav(-1);
  if (view.chanNext) view.chanNext.onclick = () => stepChanNav(1);
  if (window.ResizeObserver) {
    try {
      // Coalesced onto the next frame: painting the cues writes layout, and doing that
      // synchronously inside RO delivery is what trips the browser's "ResizeObserver loop"
      // guard (a rotation storm keeps every frame's delivery over budget). One paint per
      // frame is plenty for edge cues. paintChanNav no-ops once the view is released.
      let chanRaf = 0;
      view.chanRO = new ResizeObserver(() => {
        if (chanRaf) return;
        chanRaf = requestAnimationFrame(() => { chanRaf = 0; paintChanNav(); });
      });
      view.chanRO.observe(view.chanList);
    } catch (e) { view.chanRO = null; }
  }
  requestAnimationFrame(() => { paintChanNav(); });
  setTimeout(() => { paintChanNav(); }, 300);
  // Admin ID inspector gate (see refreshAdminFlag) — no-ops for non-admins.
  try { refreshAdminFlag(); } catch (e) {}

  // Spoiler reveal: one delegated toggle for every message (click, or Enter/Space
  // when a spoiler is focused) — no per-message listeners to leak on re-render.
  view.onSpoilerClick = (e) => {
    const sp = e.target && e.target.closest ? e.target.closest(".spoiler") : null;
    if (sp && view.msgs.contains(sp)) sp.classList.toggle("open");
  };
  view.onSpoilerKey = (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target && e.target.classList && e.target.classList.contains("spoiler")) {
      e.preventDefault();
      e.target.classList.toggle("open");
    }
  };
  view.msgs.addEventListener("click", view.onSpoilerClick);
  view.msgs.addEventListener("keydown", view.onSpoilerKey);
  // Tap-to-reveal (touch has no hover): tapping a message's text focuses its
  // wrapper so :focus-within shows just that message's reply button. Interactive
  // children (links, buttons, spoilers) keep their own taps — never stolen.
  // The focus timestamp lets a reply button ignore the tap that revealed it:
  // without this, the button materializes under the finger mid-tap and the tap-up
  // fires a reply the user never aimed at (see consumeTapFocus).
  view.msgs.addEventListener("pointerdown", (e) => {
    const t = e.target;
    if (!t || !t.closest) return;
    if (t.closest("button, a, input, textarea, select, .spoiler")) return;
    const m = t.closest(".disc-msg");
    if (m && view.msgs.contains(m)) {
      try { m.focus({ preventScroll: true }); } catch (e2) {}
      try { m.dataset.tapFocus = String(Date.now()); } catch (e3) {}
    }
  });

  view.input.addEventListener("input", () => {
    autosizeComposer(view);
    try { textDrafts.set(view.active, view.input.value); } catch (e) {}
    updateComposerSendState(view);
    acUpdate(view);
  });
  // Caret moves without typing (arrows/home/end/mouse) can enter or leave a
  // mention candidate — re-evaluate the popup position.
  view.input.addEventListener("click", () => { acUpdate(view); });
  view.input.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home" || e.key === "End") acUpdate(view);
  });
  view.input.addEventListener("keydown", (e) => {
    if (view.acPicker && !view.acPicker.hidden) {
      if (e.key === "ArrowDown") { e.preventDefault(); acMove(view, 1); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); acMove(view, -1); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); e.stopPropagation(); acAccept(view, view.acActive || 0); return; }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); acClose(view); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendCurrent(); }
    else if (e.key === "Escape" && view.stkPicker && !view.stkPicker.hidden) { e.preventDefault(); e.stopPropagation(); closeStickerPicker(); }
    else if (e.key === "Escape" && drafts.get(view.active)) { e.preventDefault(); e.stopPropagation(); clearReply(); }
  });
  view.send.onclick = sendCurrent;
  view.stkBtn.onclick = (e) => { e.stopPropagation(); toggleStickerPicker(); };
  // Tapping anywhere outside the picker dismisses it (capture: the Msgs pane and the
  // panel scrim both swallow their own pointer events).
  view.onStkOutside = (e) => {
    if (!view || !view.stkPicker || view.stkPicker.hidden) return;
    if (view.stkPicker.contains(e.target) || (view.stkBtn && view.stkBtn.contains(e.target))) return;
    closeStickerPicker();
  };
  document.addEventListener("pointerdown", view.onStkOutside, true);
  // Dismissing the header config panel on outside-tap (same capture pattern as the
  // sticker picker above).
  view.onCfgOutside = (e) => {
    if (!view || !view.cfg || view.cfg.hidden) return;
    if (view.cfg.contains(e.target) || (view.cfgBtn && view.cfgBtn.contains(e.target))) return;
    closeConfigPanel();
  };
  document.addEventListener("pointerdown", view.onCfgOutside, true);
  // Same outside-tap dismissal for the replies/mentions inbox.
  view.onInboxOutside = (e) => {
    if (!view || !view.inbox || view.inbox.hidden) return;
    if (view.inbox.contains(e.target) || (view.bellBtn && view.bellBtn.contains(e.target))) return;
    closeInbox();
  };
  document.addEventListener("pointerdown", view.onInboxOutside, true);
  // Same outside-tap dismissal for the @ autocomplete popup.
  view.onAcOutside = (e) => {
    if (!view || !view.acPicker || view.acPicker.hidden) return;
    if (view.acPicker.contains(e.target)) return;
    acClose(view);
  };
  document.addEventListener("pointerdown", view.onAcOutside, true);
  // Main-app parity: while the input is focused, a visual-viewport shrink means the
  // overlay keyboard is open — re-pad + re-scroll (keyboard height can change mid-session,
  // e.g. language/autocomplete rows). On blur resync like the main chat (iOS stuck-pan fix).
  view.onVvResize = () => {
    if (!view) return;
    if (document.activeElement === view.input) keepComposerVisible();
    else clearKbPad();
  };
  view.onInputFocus = () => keepComposerVisible();
  view.onInputBlur = () => {
    setTimeout(() => {
      clearKbPad();
      try { window.scrollTo(0, 0); } catch (e) {}
      repinIfFollowing();
    }, 120);
  };
  if (window.visualViewport) {
    try { window.visualViewport.addEventListener("resize", view.onVvResize); } catch (e) {}
  }
  view.input.addEventListener("focus", view.onInputFocus);
  view.input.addEventListener("blur", view.onInputBlur);
  view.retry.onclick = () => {
    const id = view.active;
    const old = backends.get(id);
    if (old && old.host) { try { old.host.remove(); } catch (e) {} backends.delete(id); }
    unread.set(id, 0);
    unreadReply.set(id, 0);
    emitHot();
    ensureBackend(id);
    paintStatus(id);
  };

  if (!window.commentsPlugin) {
    view.status.hidden = false;
    view.status.className = "disc-status is-err";
    view.status.textContent = "Chat backend didn't load (comments plugin missing). Reload the page.";
    try { if (view.boot) view.boot.remove(); } catch (e) {}
    return release;
  }

  // Cold-load sequencing: paint the empty shell behind the loading veil, but
  // start NO transports yet. openDiscussionPanel decides after the identity
  // check whether the welcome gate stands — welcome first (typing stays smooth),
  // chat only on Enter; otherwise startChat() immediately below.
  paintChannels();
  paintTopicBar();
  paintReplyBar();
  view.input.placeholder = `Message ${active}…`;
  // Restore unsent text kept across panel closes (cheap — no transport needed).
  try {
    const draft = textDrafts.get(active) || "";
    if (draft) {
      view.input.value = draft;
      updateComposerSendState(view);
    }
    autosizeComposer(view);
  } catch (e) {}
  return release;
}

function release() {
  try { closeIdPop(); } catch (e) {}
  if (view) {
    try { view.msgs.removeEventListener("scroll", view.onScroll); } catch (e) {}
    try { if (view.chanList && view.onChanScroll) view.chanList.removeEventListener("scroll", view.onChanScroll); } catch (e) {}
    try { if (view.chanRO) view.chanRO.disconnect(); } catch (e) {}
    try { view.msgs.removeEventListener("click", view.onSpoilerClick); } catch (e) {}
    try { view.msgs.removeEventListener("keydown", view.onSpoilerKey); } catch (e) {}
    try { if (window.visualViewport && view.onVvResize) window.visualViewport.removeEventListener("resize", view.onVvResize); } catch (e) {}
    try { if (view.input && view.onInputFocus) view.input.removeEventListener("focus", view.onInputFocus); } catch (e) {}
    try { if (view.input && view.onInputBlur) view.input.removeEventListener("blur", view.onInputBlur); } catch (e) {}
    try { if (view.onStkOutside) document.removeEventListener("pointerdown", view.onStkOutside, true); } catch (e) {}
    try { if (view.onCfgOutside) document.removeEventListener("pointerdown", view.onCfgOutside, true); } catch (e) {}
    try { if (view.onInboxOutside) document.removeEventListener("pointerdown", view.onInboxOutside, true); } catch (e) {}
    try { if (view.onAcOutside) document.removeEventListener("pointerdown", view.onAcOutside, true); } catch (e) {}
    try { if (view.composer) view.composer.style.paddingBottom = ""; } catch (e) {}
    try { view.root.remove(); } catch (e) {}
  }
  view = null;
  try { flushLastSeen(); } catch (e) {}
}

export function closeDiscussion() {
  release();
}

// ---- floating panel ---------------------------------------------------------
// Welcome: a hello + the house rules over the chat, shown once per device no matter
// whether the visitor has a name — at least once. Centered, with the thumbs-up
// sticker; visitors with no name see it EVERY visit (with a nickname row, Enter
// disabled until one is saved), while
// visitors who already have a name just see "Chatting as X." with Enter ready,
// once ever. Only the Enter button marks it seen — Escape, ✕ and scrim-taps merely
// close the whole panel, so the welcome comes back next visit. Renders after the
// identity check (so it knows whether a name exists).
// The key is versioned: bump the suffix to greet everyone again (e.g. when the
// rules change) — old "seen" marks simply stop matching.
const WELCOMED_KEY = "mno.disc.welcomed.v2";
function markWelcomed() {
  try { localStorage.setItem(WELCOMED_KEY, "1"); } catch (e) {}
}
function maybeShowTavernWelcome() {
  if (!view || !view.welcomeHost || view.welcome) return false;
  let saved = "";
  try { saved = loadNick(); } catch (e) {}
  const name = claimedName || saved;
  // A name on board earns the once-ever treatment; the nameless always get the
  // welcome (until saving lifts the gate) no matter the flag.
  if (name) { try { if (localStorage.getItem(WELCOMED_KEY) === "1") return false; } catch (e) {} }
  const box = document.createElement("div");
  box.className = "disc-welcome";
  box.innerHTML = `
    <img class="disc-wstick" src="src/stickers/thumbs-up.webp" alt="Thumbs up">
    <div class="disc-wtitle">Welcome to the Tavern</div>
    <p class="disc-wsub">The MNO RPG Engine community chat. Just chill, talk worlds, and help each other.</p>
    <ul class="disc-wrules">
      <li>You must be <b>18 or older</b> to hang out here.</li>
      <li>Be <b>nice</b>, be <b>kind</b>, no doxx, no harassment, no spam.</li>
      <li>Nicknames are public. Messages from a real MNO username show verified ${VERIFIED_BADGE}.</li>
    </ul>
    ${name
      ? `<div class="disc-wnick"><div class="disc-wme">Chatting as <b>${esc(name)}</b>${claimedName ? " — your MNO identity." : "."}</div></div>`
      : `<div class="disc-wnick">
      <span class="disc-cfglabel">Nickname</span>
      <div class="disc-nickrow">
        <input class="disc-nickinput disc-wnickinput" aria-label="Nickname" maxlength="20" placeholder="Pick a nickname" autocomplete="off" spellcheck="false">
        <button type="button" class="disc-send disc-wsave">Save</button>
      </div>
      <div class="disc-cfgerr disc-werr" hidden></div>
    </div>`}
    <div class="disc-wacts">
      <button type="button" class="disc-send disc-wenter"${name ? "" : " disabled"}>Enter the Tavern</button>
    </div>`;
  view.welcomeHost.appendChild(box);
  view.welcome = box;
  // No name, no entry: the button unlocks in save() below. A name on arrival
  // means no gate at all.
  const enterBtn = box.querySelector(".disc-wenter");
  // Only Enter counts as passing the welcome — everything else (Escape, ✕,
  // scrim) is a cancel and leaves it for next visit. Enter also starts the chat
  // transports — nothing loads until this tap, so the nickname field stays smooth.
  enterBtn.onclick = () => { if (enterBtn.disabled) return; markWelcomed(); enterTavernFromWelcome(); };
  if (name) return true;
  const input = box.querySelector(".disc-wnickinput");
  const err = box.querySelector(".disc-werr");
  const save = () => {
    const v = input.value.trim();
    const bad = nickError(v);
    if (bad) {
      err.hidden = false;
      err.textContent = bad;
      try { input.focus({ preventScroll: true }); } catch (e2) {}
      return;
    }
    saveNick(v);
    try { rescanAlertsAfterIdentity(); } catch (e3) {}
    err.hidden = true;
    // Keep the panel chrome in agreement — the composer sends this name.
    try { if (view && view.nick) view.nick.value = v; } catch (e2) {}
    const wrap = box.querySelector(".disc-wnick");
    if (wrap) {
      wrap.innerHTML = "";
      const me = document.createElement("div");
      me.className = "disc-wme";
      const b = document.createElement("b");
      b.textContent = v;
      me.append("Chatting as ", b, ".");
      wrap.appendChild(me);
    }
    // The gate lifts: entry is allowed from here, so hand keyboard users the button.
    enterBtn.disabled = false;
    try { enterBtn.focus({ preventScroll: true }); } catch (e2) {}
  };
  box.querySelector(".disc-wsave").onclick = save;
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); save(); } });
  input.addEventListener("input", () => { err.hidden = true; });
  if (!coarsePtr()) { try { input.focus({ preventScroll: true }); } catch (e) {} }
  return true;
}
// Welcome's Enter: dismiss the gate, raise the loading veil so the first parse
// can't be felt as jank, then start the chat transports.
function enterTavernFromWelcome() {
  closeTavernWelcome();
  try { showBootVeil(); } catch (e) {}
  try { startChat(); } catch (e) {}
}
function closeTavernWelcome() {
  try { if (view && view.welcome) view.welcome.remove(); } catch (e) {}
  try { if (view) view.welcome = null; } catch (e) {}
}
// Rules button (bottom of the channel list): put the welcome screen back up on
// demand. Forgets the seen-mark first so named visitors — who only get the
// welcome once ever — see it too; Enter re-marks and just dismisses (startChat
// is idempotent, the boot veil is long gone). Already showing: no-op.
function showRules() {
  if (!view || view.welcome) return;
  try { localStorage.removeItem(WELCOMED_KEY); } catch (e) {}
  try { maybeShowTavernWelcome(); } catch (e) {}
}
// The Tavern opens as a popup — like Settings and the Changelog — over whatever page
// or chat is showing, instead of being a page of its own. Back (pushBackClose), the ✕,
// a scrim click and Escape all close it; the toast jump hook routes here too, so a reply
// toast opens the panel straight into its channel from anywhere.
let panel = null; // { overlay, close } while the panel is open, else null
export async function openDiscussionPanel(channelId) {
  if (panel) {
    // Re-open with the panel already up: refresh the ban list in the background so
    // bans made since the app loaded still take effect without a full refresh.
    // Fail-open — a failed fetch just keeps the old list — then re-run the gate
    // in case this browser was banned meanwhile.
    try {
      loadServerBans(true).then(() => { try { maybeEnforceTavernBan(); } catch (e) {} }).catch(() => {});
    } catch (e) {}
    if (channelId) jumpToChannel(channelId);
    return;
  }
  // Fresh open: the shell (and mountDiscussion's boot veil) paints FIRST so the
  // tap feels instant; the ban refresh runs underneath it. The gate below
  // awaits the same promise, so it still decides on the latest list, not the
  // app-load snapshot. Fail-open throughout.
  const overlay = document.createElement("div");
  overlay.className = "popup-overlay disc-overlay";
  overlay.innerHTML = `
    <div class="popup disc-pop">
      <div class="popup-head disc-head">
        <span class="sec-ic disc-title-ic" style="--sec-ic:url('images/icon-board.png')" aria-hidden="true"></span>
        <div class="disc-head-title">TAVERN</div>
        <button type="button" class="disc-cfgbtn disc-bellbtn" title="Notifications" aria-label="Notifications" aria-expanded="false">${ICON_BELL}<span class="disc-unread disc-belln" hidden></span></button>
        <button type="button" class="disc-cfgbtn disc-setbtn" title="Chat settings" aria-label="Chat settings" aria-expanded="false"><span class="sec-ic" style="--sec-ic:url('images/icon-settings.png')" aria-hidden="true"></span></button>
        <button type="button" class="disc-cfgbtn disc-maxbtn" title="Maximize" aria-label="Maximize" aria-expanded="false">${ICON_EXPAND_SQ}</button>
        <button class="popup-x" type="button" title="Close" aria-label="Close">✕</button>
        <div class="disc-cfg" hidden>
          <span class="disc-cfglabel disc-cfg-nickkey">${infoTipLabelHtml("Nickname", NICK_TIP_BASE)}</span>
          <div class="disc-nickrow">
            <input id="discNickInput" class="disc-nickinput" aria-label="Nickname" maxlength="20" placeholder="Pick a nickname" autocomplete="off" spellcheck="false">
            <button type="button" class="disc-send disc-cfgsave">Save</button>
          </div>
          <div class="disc-cfgerr" hidden></div>
          <div class="disc-cfgsep"></div>
          <div class="disc-cfglabel">Notifications</div>
          <div class="disc-cfgrow"><span class="disc-cfglabel">${infoTipLabelHtml("Replies & mentions", "Replies to you and @mentions play a sound and pop up, even while you're on another page.")}</span><span class="disc-cfgsw" data-nsw="reply"></span></div>
          <div class="disc-cfgrow"><span class="disc-cfglabel">${infoTipLabelHtml("New messages", "Every new message pops up, even while you're on another page. The gold badge tracks arrivals either way.")}</span><span class="disc-cfgsw" data-nsw="all"></span></div>
          <div class="disc-cfgrow"><span class="disc-cfglabel">${infoTipLabelHtml("World comments", "New comments in worlds you published, plus replies and @mentions to you in threads you joined. Checked in rotation, a few worlds at a time.")}</span><span class="disc-cfgsw" data-nsw="wd"></span></div>
          <div class="disc-cfgsep"></div>
          <div class="disc-cfgrow"><span class="disc-cfglabel">${infoTipLabelHtml("Floating button", "Show the draggable Tavern button over every page, so the chat is one tap away anywhere.")}</span><span class="disc-cfgfabsw"></span></div>
          <div class="disc-cfgsep disc-cfgwsep"></div>
          <div class="disc-cfgrow disc-cfgwrow"><span class="disc-cfglabel">${infoTipLabelHtml("Window mode", "Normal, maximized, or the compact floater — the same modes the square button in the header cycles through.")}</span><select class="popup-in disc-winmodesel" aria-label="Window mode"><option value="">Normal</option><option value="max">Maximized</option><option value="compact">Compact</option></select></div>
        </div>
        <div class="disc-cfg disc-inbox" hidden></div>
      </div>
      <div class="disc-pop-body"></div>
    </div>`;
  document.body.appendChild(overlay);
  const bodyEl = overlay.querySelector(".disc-pop-body");
  let releaseView = null;
  let closed = false;
  // A profile hop surrenders the Back entry instead of popping it — see
  // takeoverDiscussionPanel / openAuthorProfile.
  let forgetBack = false;
  const releaseBack = pushBackClose(() => close());
  function close() {
    if (closed) return;
    closed = true;
    try { if (forgetBack) releaseBack.forget(); else releaseBack(); } catch (e) {}
    // Keep the unsent text: the scrim is easy to hit by accident (reply drafts already persist).
    try { if (view && view.active) textDrafts.set(view.active, view.input.value); } catch (e) {}
    try { if (releaseView) releaseView(); } catch (e) { try { closeDiscussion(); } catch (e2) {} }
    try { hideInfoTip(); } catch (e) {}
    try { if (overlay._compactRO) overlay._compactRO.disconnect(); } catch (e) {}
    try { overlay.remove(); } catch (e) {}
    if (panel && panel.overlay === overlay) panel = null;
  }
  overlay.querySelector(".popup-x").onclick = close;
  overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
  overlay.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    // An open config panel gets first refusal — it dismisses instead of the panel.
    if (view && view.cfg && !view.cfg.hidden) { e.stopPropagation(); closeConfigPanel(); return; }
    // A welcome takes the whole panel with it — Escape never lands you in chat,
    // gated or not. Only the Enter button passes the welcome (see markWelcomed).
    if (view && view.welcome && view.welcome.isConnected) {
      e.stopPropagation();
      close(); return;
    }
    close();
  });
  panel = { overlay, close, takeover() { forgetBack = true; close(); } };
  // Background ban refresh — never blocks paint/start. Cooldown-aware: a fresh
  // cache (or a recent failure) skips the RPC entirely; the gate below starts
  // on the snapshot and only enforces when the fresh list lands.
  const banRefresh = loadServerBans().catch(() => {});
  try {
    releaseView = await mountDiscussion(bodyEl);
    if (closed) { try { releaseView(); } catch (e) {} return; }
    // Wire the panel head chrome to the view, then paint it.
    if (view) {
      view.cfg = overlay.querySelector(".disc-cfg");
      view.cfgBtn = overlay.querySelector(".disc-setbtn");
      view.cfgErr = overlay.querySelector(".disc-cfgerr");
      view.nick = overlay.querySelector(".disc-nickinput");
      view.save = overlay.querySelector(".disc-cfgsave");
      // Both alert prefs ride the shared pill switches (same On/Off as the Settings
      // toggles) — titleless, since each row label's info-tip is the single source.
      view.notifyReplySw = switchEl({
        on: () => notifyReplyOn,
        set: (v) => setNotifyReply(v),
        text: notifyReplyOn ? "On" : "Off",
        plain: true,
        onChange: () => { paintNotifySws(); },
      });
      view.notifyAllSw = switchEl({
        on: () => notifyAllOn,
        set: (v) => setNotifyAll(v),
        text: notifyAllOn ? "On" : "Off",
        plain: true,
        onChange: () => { paintNotifySws(); },
      });
      overlay.querySelector('.disc-cfgsw[data-nsw="reply"]').appendChild(view.notifyReplySw.el);
      overlay.querySelector('.disc-cfgsw[data-nsw="all"]').appendChild(view.notifyAllSw.el);
      view.notifyWdSw = switchEl({
        on: () => notifyWdOn,
        set: (v) => setNotifyWd(v),
        text: notifyWdOn ? "On" : "Off",
        plain: true,
        onChange: () => { paintNotifySws(); },
      });
      overlay.querySelector('.disc-cfgsw[data-nsw="wd"]').appendChild(view.notifyWdSw.el);
      // Floating-button toggle — same shared pill, its own per-browser pref.
      view.fabSw = switchEl({
        on: () => tavernFabEnabled(),
        set: (v) => { setTavernFabEnabled(v); },
        text: tavernFabEnabled() ? "On" : "Off",
        plain: true,
        onChange: () => { paintFabSw(); },
      });
      overlay.querySelector(".disc-cfgfabsw").appendChild(view.fabSw.el);
      // Window-mode dropdown (desktop only — hidden on phones, which are
      // fullscreen regardless). setWinMode keeps it in sync when the header's
      // cycle button is used instead.
      view.winModeSel = overlay.querySelector(".disc-winmodesel");
      if (view.winModeSel) {
        try { view.winModeSel.value = getWinMode(overlay); } catch (e) {}
        view.winModeSel.onchange = () => { setWinMode(overlay, view.winModeSel.value); };
      }
      view.nick.value = loadNick();
      // The field starts locked while the identity check runs — otherwise a slow first
      // import leaves a window where a claimed user could type + send under another
      // name. releaseNick() (via loadClaimedName) frees it when there is no identity.
      view.nick.disabled = true;
      if (claimedName) applyClaimedNick();
      view.nick.addEventListener("input", () => { if (view && view.cfgErr) view.cfgErr.hidden = true; });
      view.cfgBtn.onclick = (e) => { e.stopPropagation(); toggleConfigPanel(); };
      view.bellBtn = overlay.querySelector(".disc-bellbtn");
      view.bellN = overlay.querySelector(".disc-belln");
      view.inbox = overlay.querySelector(".disc-inbox");
      if (view.bellBtn) view.bellBtn.onclick = (e) => { e.stopPropagation(); toggleInbox(); };
      const maxBtn = overlay.querySelector(".disc-maxbtn");
      if (maxBtn) maxBtn.onclick = (e) => { e.stopPropagation(); cycleWinMode(overlay); };
      wireCompactDrag(overlay);
      // Desktop remembers its window mode (phones are fullscreen regardless, and
      // the mode button hides there). Legacy `mno.disc.max` honored when no mode
      // was ever saved.
      try {
        const narrow = window.matchMedia("(max-width: 700px)").matches;
        let wm = "";
        try { wm = localStorage.getItem("mno.disc.winmode") || ""; } catch (e) {}
        if (!wm && !narrow) { try { if (localStorage.getItem("mno.disc.max") === "1") wm = "max"; } catch (e) {} }
        if ((wm === "max" || wm === "compact") && !narrow) setWinMode(overlay, wm);
      } catch (e) {}
      paintBell();
      overlay.querySelector(".disc-cfgsave").onclick = saveConfigPanel;
      paintTopicBar();
      paintNotifySws();
      paintFabSw();
      initInfoTips();
      view.welcomeHost = bodyEl;
      // Pick up the claimed username (if any) — locks the nick field — then decide
      // the welcome (needs the identity answer). No welcome due: start the chat at
      // once behind the loading veil. Welcome due: lift the veil for a smooth
      // nickname field and start nothing until Enter (see enterTavernFromWelcome).
      // The engine-author check rides the same import (single source, no id copy).
      try { ensureEngineAuthorCheck().catch(() => {}); } catch (e) {}
      // Grace wait for the fresh ban list: long enough that a healthy fetch
      // (usually well under a second; warm cache is 0ms) lands before first
      // paint, so real bans never flash the room. A slow/1006 fetch times out
      // here and we start on the snapshot instead — the banRefresh.then below
      // still enforces when it lands.
      const BAN_GATE_WAIT_MS = 1200;
      loadClaimedName().catch(() => {}).finally(async () => {
        if (!view || closed) return;
        try {
          await Promise.race([
            banRefresh.catch(() => {}),
            new Promise((r) => setTimeout(r, BAN_GATE_WAIT_MS)),
          ]);
        } catch (e) {}
        if (!view || closed) return;
        try {
          if (isSelfBanned()) {
            try { dropAllCommentBackends(); } catch (e4) {}
            try { close(); } catch (e2) {}
            setTimeout(() => { try { showBannedPopup("tavern"); } catch (e3) {} }, 60);
            return;
          }
        } catch (e) {}
        let welcomed = false;
        try { welcomed = !!maybeShowTavernWelcome(); } catch (e) { welcomed = false; }
        if (!welcomed) {
          try { startChat(); } catch (e2) {}
        }
        banRefresh.then(() => {
          if (!view || closed) return;
          try {
            if (isSelfBanned()) {
              try { dropAllCommentBackends(); } catch (e4) {}
              try { close(); } catch (e2) {}
              setTimeout(() => { try { showBannedPopup("tavern"); } catch (e3) {} }, 60);
            }
          } catch (e) {}
        });
        // Welcome due: the veil stays behind the welcome (same spinner it wore on
        // mount) and Enter starts the transports — nothing loads until then, so
        // the nickname field types jank-free.
      });
    }
    if (channelId) jumpToChannel(channelId);
  } catch (e) {
    close();
    throw e;
  }
}
export function closeDiscussionPanel() { if (panel) panel.close(); }
// Profile-hop teardown: same as closing, but the panel's Back entry is surrendered, not
// popped — the profile navigation replaces it (see openAuthorProfile).
export function takeoverDiscussionPanel() { if (panel && panel.takeover) panel.takeover(); else closeDiscussionPanel(); }
export function isDiscussionPanelOpen() { return !!panel; }

export const api = { mountDiscussion, closeDiscussion, CHANNELS, ownerFor, openUserHistory };
