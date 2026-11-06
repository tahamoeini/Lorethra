// Server-state bans — runtime cache (replaces hardcoded ban-list.js).
// Source of truth is server `state` (getBans). Refresh-required: fetched once
// per page load, before the first comments embed mounts.

export const BAN_TITLE = "Banned";
export const BAN_MSG = "You are banned from the Tavern and world comments. You can still use the app, but you can't publish or comment.";

export function normBanId(id) {
  return String(id == null ? "" : id).trim().toLowerCase().split("-").pop().trim();
}
export function normAppId(id) {
  return String(id == null ? "" : id).trim().toLowerCase();
}

let loaded = false;
let loadPromise = null;
// Freshness window: a cached list younger than this is reused as-is; once it
// ages past, the next non-force load fetches a new one. One constant — 5
// minutes keeps ban enforcement tight while repeated Tavern opens (and the
// publish gate) skip the RPC. Force loads always fetch.
export const BAN_CACHE_MS = 5 * 60_000;
let fetchedAt = 0;
// Negative cache: a failed fetch stamps lastFailedAt instead of fetchedAt, so
// 1006/unreachable users don't re-attempt the socket on every Tavern open.
// loadServerBans returns the stale (fail-open) snapshot until this elapses.
export const BAN_FAIL_COOLDOWN_MS = 60_000;
// Per-stage ceiling: fail-open fast instead of hanging the Tavern veil on a
// dead socket (open and rpc each get this long — worst case ~2x).
const BAN_FETCH_TIMEOUT_MS = 4000;
// force=true (panel re-open) still respects a short retry floor so spam-opens
// can't hammer a down server.
const BAN_FORCE_RETRY_MS = 15_000;
let lastFailedAt = 0;
// The cache is memory-only: a reload re-evaluates this module, so fetchedAt
// restarts at 0 and the first load after boot always fetches. Back-forward
// cache restores are the one exception (JS memory survives them) — invalidate
// there too, so a restored page refetches instead of trusting a stale stamp.
try {
  window.addEventListener("pageshow", (e) => { if (e && e.persisted) { fetchedAt = 0; lastFailedAt = 0; } });
} catch (e) {}
// How old the cache is (Infinity when nothing ever loaded — e.g. every fetch
// failed so far, which fail-open leaves as an empty list with no stamp).
export function banCacheAge() { return loaded && fetchedAt ? Date.now() - fetchedAt : Infinity; }
export function isBansFresh() { return banCacheAge() < BAN_CACHE_MS; }
function failCooldownLeft() {
  if (!lastFailedAt) return 0;
  const left = BAN_FAIL_COOLDOWN_MS - (Date.now() - lastFailedAt);
  return left > 0 ? left : 0;
}
let commentIds = [];
let appIds = [];
let commentSet = new Set();
let appSet = new Set();

function applyLists(c, a) {
  commentIds = (c || []).map(normBanId).filter(Boolean);
  appIds = (a || []).map(normAppId).filter(Boolean);
  commentSet = new Set(commentIds);
  appSet = new Set(appIds);
  loaded = true;
}

export async function loadServerBans(force = false) {
  if (!force && isBansFresh()) return { commentIds, appIds };
  // Recent failure: serve the fail-open snapshot without touching the network.
  // force=true still waits out a short floor (spam-open protection).
  try {
    const cool = failCooldownLeft();
    if (cool > 0) {
      if (!force) return { commentIds, appIds };
      if (Date.now() - lastFailedAt < BAN_FORCE_RETRY_MS) return { commentIds, appIds };
    }
  } catch (e) {}
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    let s = null;
    try {
      s = window.createServerSocket();
      const openP = Promise.resolve().then(() => s.opened);
      await new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error("ban fetch timeout")), BAN_FETCH_TIMEOUT_MS);
        openP.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); });
      });
      const rpcP = Promise.resolve().then(() => s.rpc.getBans(JSON.stringify({})));
      const raw = await new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error("ban fetch timeout")), BAN_FETCH_TIMEOUT_MS);
        rpcP.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); });
      });
      try { s.close(1000, "done"); } catch (e) {}
      const o = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (o && o.ok) { applyLists(o.commentIds, o.appIds); fetchedAt = Date.now(); lastFailedAt = 0; }
      else if (!loaded) applyLists([], []);
      // Non-ok without an exception (shouldn't happen — the server answers
      // ok:true/false): treat like a failure for cooldown purposes, but keep
      // serving the stale snapshot fail-open.
      else { try { lastFailedAt = Date.now(); } catch (e) {} }
    } catch (e) {
      // Fail-open for reads (see spec §6): Tavern still opens, server catalog
      // writes remain authoritative. Stamp the failure so the next load
      // inside the cooldown reuses the snapshot instead of re-dialing.
      try { lastFailedAt = Date.now(); } catch (e2) {}
      try { if (s) s.close(1000, "done"); } catch (e3) {}
      if (!loaded) applyLists([], []);
    }
    return { commentIds, appIds };
  })();
  const out = await loadPromise;
  loadPromise = null;
  return out;
}

export function getCommentIds() { return commentIds.slice(); }
export function getAppIds() { return appIds.slice(); }
export function isBansLoaded() { return loaded; }

export function isCommentIdBanned(id) {
  const n = normBanId(id);
  return !!n && commentSet.has(n);
}
export function isAppIdBanned(id) {
  const n = normAppId(id);
  return !!n && appSet.has(n);
}
