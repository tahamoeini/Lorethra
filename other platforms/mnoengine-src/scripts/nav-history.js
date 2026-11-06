// nav-history.js — the ONE place for landing/session/profile navigation history.
//
// Every view that owns a URL or a Back-button entry must go through here (never raw
// history.pushState / history.replaceState / location.hash for a home route). That is the rule
// that keeps Back working: the platform only bridges `replaceState` to the host address bar,
// same-URL writes break the previous link in the preview, and bridged pushes must stay tracked
// or the next Back misfires as a session return. See each helper for its contract.
//
// Views covered:
//   - landing pages (worlds/adventures/explore/user) — syncHomeHash + pushLandingHistory
//   - session chat entry (__mno:"session") — pushSessionEntry + bridge-return guards
//   - profile entry (__mno:"user") — pushUserEntry + bridge-return guards
//   - Explore detail panel — owns `#explore/<worldId>` on its own entry (see community.js;
//     it calls back into the shell's syncExploreHash, which routes through syncHomeHash here)

import { pushBackClose, lastPopStateAt } from "./back-close.js";

export const NAV_MARKERS = { LANDING: "landing", SESSION: "session", USER: "user" };

// ---- hash log (stale platform-echo detection) -------------------------------------------
// Every hash this app writes (only through `syncHomeHash`) is logged, so a stale platform echo
// can be recognised: the host mirrors our writes into its own bar and may forward an older one
// back as `changeHash` after we have already moved on. The classic case is panel → profile →
// Explore, where the panel's own `#explore/<worldId>` echo arrives late and reopens the panel on
// top of the grid. A forwarded hash that is one of our own SUPERSEDED writes is dropped, provided
// it is fresh (a mirror echo arrives within seconds; an old entry means a genuine revisit, which
// is applied). Anything else (a hand-edited URL, a followed link, a genuine Back/Forward
// traversal, whose native events still fire) is applied.
const homeHashLog = [];
const HOME_HASH_FRESH_MS = 15000;
export function noteHomeHash(hash) {
  homeHashLog.push({ hash, at: Date.now() });
  if (homeHashLog.length > 12) homeHashLog.splice(0, homeHashLog.length - 12);
}
export function isStaleHomeHashEcho(hash) {
  if (!homeHashLog.length) return false;
  if (hash === homeHashLog[homeHashLog.length - 1].hash) return false;
  const e = homeHashLog.find((x) => x.hash === hash);
  return !!e && Date.now() - e.at < HOME_HASH_FRESH_MS;
}
// Put the bar back on the last hash we wrote ourselves. Dropping a stale echo must also repair
// the address: the echo already rewrote it (plus a junk history entry), so without this the bar
// shows a route we are not on. When the iframe already shows the latest hash, only the host bar
// is stale — post it directly instead of a same-URL replaceState (which breaks the previous
// history link).
export function reassertHomeHash() {
  if (!homeHashLog.length) return;
  const want = homeHashLog[homeHashLog.length - 1].hash;
  if (location.hash === want) { postHostHash(); return; }
  replaceHomeHash(want);
}

// ---- host bar ---------------------------------------------------------------
// Tell the host address bar to follow the iframe hash WITHOUT touching iframe history. Used
// when the iframe already shows the right hash (Back restored it) but the host bar is stale —
// a same-URL replaceState would fix the host too, but it breaks the previous history link here.
export function postHostHash() {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "changeUrl", search: window.location.search, hash: window.location.hash }, "https://perchance.org");
    }
  } catch (e) {}
}

// The canonical URL of a landing page. Worlds is the home page, so it owns the clean URL (no
// hash); Adventures/Explore keep theirs. `#worlds` is still PARSED as worlds (old links keep
// working) but never WRITTEN. Every transition between landing pages still changes the URL
// ("" ↔ "#adventures" ↔ "#explore"), so Back still fires hashchange and the router still walks.
export function homeHashFor(id, target = "") {
  if (id === "worlds" && !target) return "";
  return "#" + id + (target ? "/" + encodeURIComponent(target) : "");
}
// Replace the URL without touching history (the only write the platform mirrors to the host
// bar). Clearing to the clean home URL must pass pathname+search — a "" URL would resolve to
// the current URL WITH its fragment and leave the old hash standing.
function replaceHomeHash(want) {
  try { history.replaceState(history.state, "", want || location.pathname + location.search); } catch (e) {}
}
// Mirror the active page into the URL. This is the ONLY way the app may change the VISIBLE
// address bar. The app runs in a cross-origin iframe; the platform bridges the gap by wrapping
// `history.replaceState` inside the iframe so that, when the iframe is served on its perchance
// subdomain, a hash change is posted to the host page as a `changeUrl` message and the host
// page's URL follows (that is how a share link's `#explore/…` shows up). Two consequences: the
// hash must move through `replaceState` (a bare `location.hash =` is not wrapped, and `pushState`
// is not wrapped either), and `force` exists because a browser Back moves only the IFRAME's
// history — the host page's bar keeps the stale hash — so the path that follows a Back must
// re-issue the write even when our own fragment already reads `want`.
export function syncHomeHash(id, target = "", { force = false } = {}) {
  const want = homeHashFor(id, target);
  if (location.hash === want) {
    // Already there (a Back traversal restores the iframe fragment on its own). A same-URL
    // replaceState here breaks the previous link in this preview (the next Back becomes a
    // silent no-op), so never touch iframe history for it — just tell the host bar to catch
    // up (it still shows the pre-Back hash) and log the return so superseded echoes stay stale.
    if (force) postHostHash();
    noteHomeHash(want);
    return;
  }
  replaceHomeHash(want);
  noteHomeHash(want);
}

// ---- route parsing ----------------------------------------------------------
// A hash route is `#<pageId>` or `#<pageId>/<target>`. The target is a per-page deep-link
// payload — Explore's worldId (`#explore/<worldId>`) or a profile's userId (`#user/<userId>`).
// The separator is `/`, not another `-`, because a catalog worldId is itself hyphenated
// (`<userId>-<slug>`); the target is URL-encoded so a future payload need not be slug-safe.
export function homeRouteFromHash(hash = location.hash, validIds = null) {
  const h = String(hash || "").replace(/^#/, "");
  // The home page owns the clean URL: no hash IS the Worlds route. `#worlds` still parses
  // (old links), but nothing writes it anymore — see homeHashFor.
  if (!h) return { page: !validIds || validIds.includes("worlds") ? "worlds" : null, target: "" };
  const i = h.indexOf("/");
  const page = i === -1 ? h : h.slice(0, i);
  const raw = i === -1 ? "" : h.slice(i + 1);
  let target = "";
  if (raw) { try { target = decodeURIComponent(raw); } catch (e) { target = raw; } }
  const ok = !validIds || validIds.includes(page);
  return { page: ok && page ? page : null, target };
}

// True when this hash change rode in on a real back/forward traversal (popstate fires just
// ahead of the hashchange). A bare fragment assignment — the platform's echo of a forwarded
// hash, a pasted link, a hand edit — fires hashchange with NO popstate.
export function hashChangeTraversed() {
  try { return Date.now() - lastPopStateAt() < 250; } catch (e) { return true; }
}

// ---- landing history --------------------------------------------------------
// UI page switches push a history entry so Back walks Worlds ↔ Adventures ↔ Explore
// (previously every switch was a replaceState, so Back skipped to whatever stale entry was
// beneath). A push must be followed by a replaceState — the platform only bridges replaceState
// to the host address bar (pushState alone never updates it), so push-then-replace yields one
// new entry WITH the new URL (the caller does the replace via syncHomeHash right after).
// While a Menu-grid bridge is pending the session entry is still on the back-close stack
// beneath us: a plain push there would make the next Back misfire as a session return (onPop
// sees the session top + a non-session current and re-enters the chat instead of mounting the
// previous landing page, especially at depth > 1). So bridged pushes are tracked (pushBackClose
// with a no-op close — the hashchange router does the actual mount, the entry just keeps onPop
// honest); pure-landing pushes stay plain. Both are consumed by Back (pop) with no programmatic
// release, so they never leave dead entries.
function landingBackNoop() {}
export function pushLandingHistory(bridged) {
  if (bridged) {
    try { pushBackClose(landingBackNoop, { state: { __mno: NAV_MARKERS.LANDING } }); } catch (e) {}
  } else {
    try { history.pushState(null, "", location.href); } catch (e) {}
  }
}

// ---- Back-button entries ----------------------------------------------------
// One history entry backs the whole open chat. `adopt` reuses the entry we reloaded on, so
// reloading inside an adventure doesn't pile up duplicate entries.
export function pushSessionEntry(close) {
  return pushBackClose(close, { state: { __mno: NAV_MARKERS.SESSION }, adopt: true });
}
// Profiles get the same treatment: one entry per open profile, adopted across reloads.
export function pushUserEntry(close) {
  return pushBackClose(close, { state: { __mno: NAV_MARKERS.USER }, adopt: true });
}
// Give up an entry WITHOUT popping it — for a programmatic leave where the router already owns
// the navigation (nav row, another target, bridge cancel). A plain release() would schedule a
// history.back() whose delayed traversal lands after the new page mounts and tears it down.
// Safe to call with null (returns null so callers can assign through).
export function forgetEntry(handle) {
  if (!handle) return null;
  try { if (handle.forget) handle.forget(); else handle(); } catch (e) {}
  return null;
}
// Consume an entry WITH a pop — for a programmatic leave that should behave like Back
// (closing a chat via a button). Only pops when our entry is still current (pushBackClose's
// release already guards that). Safe to call with null.
export function popEntry(handle) {
  if (!handle) return null;
  try { handle(); } catch (e) {}
  return null;
}

// ---- bridge-return guards (hashchange defers to popstate) -------------------
// A history state is "plain" when it carries none of our markers — the pre-session landing
// entry a Menu-grid bridge return lands on.
export function isPlainEntry(s) {
  return !s || (!s.__mno && !s.__bid && !s.__overlay);
}
export function isSessionMarker(s) {
  return !!(s && s.__mno === NAV_MARKERS.SESSION);
}
// Author-peek bridge return (chat → profile): Back pops the profile entry onto the rewritten
// session entry (a dead `__mno:session` state showing a landing URL). popstate's close
// re-enters the chat for that pop — the hashchange side must stand down or it double-mounts
// (worlds flash, then session overwrites: the mobile "reload twice").
export function shouldDeferToUserBridge({ userPending, historyState }) {
  return !!(userPending && isSessionMarker(historyState));
}
// Menu-grid bridge return: Back pops the reused session entry (rewritten to a landing URL)
// onto the plain pre-session landing entry. popstate's close re-enters the chat for that pop.
// Intermediate landing walks while the bridge is pending land on session/tracked states, never
// plain, so plain + flag + traversal unambiguously means "returning".
export function shouldDeferToMenuBridge({ menuPending, historyState }) {
  return !!(menuPending && isPlainEntry(historyState));
}
// A bridge return in progress (popstate re-entering the chat) reads `#session` in hashchange —
// stand down and let it own the navigation instead of mounting a landing behind the chat.
export function bridgeReturnInProgress({ menuPending, userPending }) {
  return !!(menuPending || userPending);
}
// A dead session entry with no return flag (e.g. an old bridge entry left behind after opening
// a different session from a Menu-grid landing): the bar names `#session` but no chat owns it.
// Heal it to the landing instead of stranding the shell on a route-less hash.
export function isDeadSessionHash(hash = location.hash) {
  return /^#session\b/.test(String(hash || ""));
}
