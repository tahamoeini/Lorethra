// libcache.js — the added-world file cache: ONE IndexedDB key per world.
//
// Was a single `community/cache` object holding every added world's file; once that blob
// outgrew what the browser could read back (Chrome's "Failed to read large IndexedDB value",
// much sooner in incognito / best-effort storage) EVERY cache read failed and took
// Explore/Worlds detail panels, remove, and backup restore down with it. Sharded keys
// (`cache:<worldId>` -> { jsonHash, text, bytes, cachedAt }) keep one world's file from ever
// poisoning the rest: single-world reads/writes/deletes are one small transaction, and a
// corrupt or oversized entry only affects its own world.
//
// No dependencies (the kv folder object is passed in), so boot-path code (main.js) and
// backup.js can import this without pulling in community.js.

export const CACHE_KEY_PREFIX = "cache:";
export const LEGACY_CACHE_KEY = "cache";
export const cacheKeyFor = (worldId) => CACHE_KEY_PREFIX + String(worldId || "");

// One-shot migration of the legacy monolith, then it never runs again: the promise is cached
// per page load, and across loads the presence of shard keys short-circuits the legacy read.
let _migration = null;
export function ensureCacheMigrated(folder) {
  if (!_migration) _migration = _migrateCache(folder);
  return _migration;
}

async function _migrateCache(folder) {
  // { legacy } — entries that could NOT be sharded (quota stopped us); reads fall back to it.
  // { legacyUnreadable } — the old key exists but can't be read (the incognito case); nothing
  // to migrate, and the dead key is left for the remove-all recovery (deleting user data, even
  // inaccessible data, shouldn't happen silently inside a migration).
  const state = { legacy: null, legacyUnreadable: false };
  let legacy = null, legacyFailed = false;
  try { legacy = await folder.get(LEGACY_CACHE_KEY); }
  catch (e) { legacyFailed = true; }
  if (legacyFailed) {
    console.warn("[libcache] legacy cache unreadable, starting empty (old key left in place)");
    state.legacyUnreadable = true;
    return state;
  }
  const haveLegacy = (legacy && typeof legacy === "object") ? Object.entries(legacy) : [];
  if (!haveLegacy.length) {
    try { await folder.delete(LEGACY_CACHE_KEY); } catch (e) {}
    return state;
  }
  let ids = [];
  try { ids = await listCacheIds(folder); } catch (e) { ids = []; }
  const idSet = new Set(ids);
  for (const [wid, entry] of haveLegacy) {
    if (idSet.has(wid)) continue;
    try { await folder.set(cacheKeyFor(wid), entry); idSet.add(wid); }
    catch (e) { console.warn("[libcache] could not shard cached world", wid, (e && e.message) || e); }
  }
  const remaining = haveLegacy.filter(([wid]) => !idSet.has(wid));
  if (!remaining.length) {
    try { await folder.delete(LEGACY_CACHE_KEY); } catch (e) {}
  } else {
    // Partial (quota stopped us): the readable remainder stays as a read fallback. New writes
    // go to shards only, so the legacy never grows; a later run with free space shards the rest.
    state.legacy = Object.fromEntries(remaining);
  }
  return state;
}

// Every key in this folder holding one world's file.
export async function listCacheIds(folder) {
  let keys = [];
  try { keys = await folder.keys(); }
  catch (e) { console.warn("[libcache] keys unreadable:", (e && e.message) || e); return []; }
  return keys
    .filter((k) => typeof k === "string" && k.startsWith(CACHE_KEY_PREFIX))
    .map((k) => k.slice(CACHE_KEY_PREFIX.length));
}

// One world's saved copy, or null. Never throws: an unreadable entry reads as missing (the
// detail panel then offers Retry) instead of tripping the storage warning on every click.
export async function getCacheEntry(folder, worldId) {
  let st = null;
  try { st = await ensureCacheMigrated(folder); } catch (e) { st = null; }
  try {
    const e = await folder.get(cacheKeyFor(worldId));
    if (e) return e;
  } catch (e) { console.warn("[libcache] cached world unreadable:", worldId, (e && e.message) || e); }
  if (st && st.legacy && st.legacy[worldId]) return st.legacy[worldId];
  return null;
}

// Write or delete one world's saved copy. Deletes one key — never a read-modify-write of a
// monolith, so a single remove can no longer wipe every other world. Writes propagate storage
// errors (callers notify); the migration itself is awaited but guarded.
export async function setCacheEntry(folder, worldId, entry) {
  try { await ensureCacheMigrated(folder); } catch (e) {}
  if (entry == null) await folder.delete(cacheKeyFor(worldId));
  else await folder.set(cacheKeyFor(worldId), entry);
}

// Several worlds' saved copies at once ({ [worldId]: entry }). Bulk first (one transaction),
// per-key salvage on failure, legacy fallback for gaps. Never throws.
export async function readCacheEntries(folder, ids) {
  const out = {};
  const wanted = [...new Set((ids || []).filter(Boolean))];
  if (!wanted.length) return out;
  let st = null;
  try { st = await ensureCacheMigrated(folder); } catch (e) { st = null; }
  const keys = wanted.map(cacheKeyFor);
  try {
    const vals = await folder.getMany(keys);
    wanted.forEach((wid, i) => { if (vals[i]) out[wid] = vals[i]; });
  } catch (e) {
    console.warn("[libcache] bulk read failed, salvaging per key:", (e && e.message) || e);
    for (let i = 0; i < wanted.length; i++) {
      try { const v = await folder.get(keys[i]); if (v) out[wanted[i]] = v; }
      catch (e2) { console.warn("[libcache] cached world unreadable:", wanted[i], (e2 && e2.message) || e2); }
    }
  }
  if (st && st.legacy) {
    for (const wid of wanted) if (!out[wid] && st.legacy[wid]) out[wid] = st.legacy[wid];
  }
  return out;
}

// Every saved copy ({ [worldId]: entry }), for backup export. Never throws.
export async function readAllCache(folder) {
  let ids = [];
  try { ids = await listCacheIds(folder); } catch (e) { ids = []; }
  const out = await readCacheEntries(folder, ids);
  // A kept legacy remainder (partial migration) has no shard keys, so listCacheIds misses it.
  try {
    const st = await ensureCacheMigrated(folder);
    if (st && st.legacy) for (const [wid, e] of Object.entries(st.legacy)) if (!out[wid]) out[wid] = e;
  } catch (e) {}
  return out;
}

// Drop every saved copy plus any legacy remnant (the remove-all recovery). Best-effort and
// never throws; returns how many keys went away.
export async function clearCache(folder) {
  let keys = [];
  try { keys = await folder.keys(); } catch (e) { return 0; }
  let n = 0;
  for (const k of keys) {
    if (k !== LEGACY_CACHE_KEY && !(typeof k === "string" && k.startsWith(CACHE_KEY_PREFIX))) continue;
    try { await folder.delete(k); n++; } catch (e) {}
  }
  return n;
}
