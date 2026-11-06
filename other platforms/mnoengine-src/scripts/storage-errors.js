// storage-errors.js — one place that knows what "local storage is unavailable" looks like.
//
// The kv-plugin is a thin wrapper over IndexedDB (idb-keyval). On a device that is low on
// space — or when the browser is evicting/closing the database — every kv call can reject with
// errors like:
//
//   InvalidStateError: Failed to execute 'transaction' on 'IDBDatabase':
//     The database connection is closing.
//
// That error used to surface as an unhandled rejection ("An error has occurred somewhere in
// your code...") and aborted whatever the player was doing (e.g. starting a new adventure).
//
// The stores (world.js / storage.js) use the helpers here so that:
//   * reads retry once (a closing connection is often transient) and then fall back to an
//     empty result instead of throwing, so the app can keep running on bundled content;
//   * writes retry once and then throw a friendly Error tagged with
//     `isStorageUnavailable = true`, so callers can toast one human sentence instead of the
//     raw IDB jargon.
//
// Callers that touch storage directly (main.js) use `isStorageError` / `notifyStorageError`
// for the same reason: never let a storage failure become an unhandled rejection.

const TRANSIENT_DELAY_MS = 200;

// Degraded mode: any PROVEN storage failure (a read that fell back, or a write that threw)
// marks storage degraded for a window. While degraded, an EMPTY list read is suspect — it may
// be the read fallback, not the truth — so the session/hero stores refuse index overwrites
// derived from it (see storage.js). A non-empty list can only come from a successful read, so
// it is always safe to write back. The window expires on its own; genuine recovery just works,
// and a brand-new user with a truthfully empty library is blocked for at most one window on
// the rare chance their very first save lands inside it (retrying succeeds).
let _degradedUntil = 0;
const DEGRADED_WINDOW_MS = 120000;
export function markStorageDegraded() {
  try { _degradedUntil = Date.now() + DEGRADED_WINDOW_MS; } catch (e) {}
}
// A read that SUCCEEDS proves storage is answering right now, so it lifts the degraded flag —
// but note the session/hero stores sample the flag at the moment their read resolves, so a
// fallback they already received stays suspect even if storage recovers a millisecond later.
export function markStorageHealthy() {
  try { _degradedUntil = 0; } catch (e) {}
}
export function isStorageDegraded() {
  try { return Date.now() < _degradedUntil; } catch (e) { return false; }
}

// Throttled user-facing toast. Storage failures tend to come in bursts (one per kv call), and a
// toast per call would stack — so only the first one in a window is shown. The app passes its
// own `notify` in; when none is available yet (very early boot) this just logs.
// Critical failures ALSO raise a popup panel (see below): a toast is easy to miss, and an
// unsaved session is lost when the tab closes — so the first failure in a window pops a panel
// with a one-click ⭳ Download everything (the same full backup as Settings › Data & Backup).
// Debugging note: this ONLY fires for `isStorageError` cases (IDB closing / quota). Anything
// else still throws and still trips the engine's error popup, so real bugs stay loud. Every
// swallow also leaves `window.__mnoLastStorageError` (message + time) and a console.warn with
// the ORIGINAL error, so DevTools still shows what happened.
let _lastToastAt = 0;
let _lastPopupAt = 0;
let _popupOpen = false;
// One panel per window: bursts (every background save failing at once) must not stack panels.
const POPUP_THROTTLE_MS = 30000;

function popupConfirm() {
  try { if (window.mnoApp && window.mnoApp.ConfirmPopup) return window.mnoApp.ConfirmPopup; } catch (e) {}
  return null;
}

function popupNotify(msg, opts) {
  try {
    if (window.mnoApp && typeof window.mnoApp.notify === "function") { window.mnoApp.notify(msg, opts); return; }
  } catch (e) {}
  try { console.warn("[storage]", msg); } catch (e2) {}
}

// Same file as Settings › Data & Backup downloads (buildBackup + backupFilename + downloadText),
// but resilient: when storage itself is failing the reads it needs may throw, so every read is
// optional and a partial backup still downloads rather than aborting. Never throws.
async function downloadEmergencyBackup() {
  popupNotify("Preparing your backup…", { ms: 4000 });
  try {
    const mod = await import("./backup.js");
    if (mod && typeof mod.buildBackup === "function" && typeof mod.downloadText === "function") {
      const data = await mod.buildBackup({ includeCache: true });
      const json = JSON.stringify(data, null, 2);
      const name = typeof mod.backupFilename === "function" ? mod.backupFilename() : ("backup.mno-backup");
      mod.downloadText(name, json, "application/octet-stream");
      popupNotify("Backup downloaded (" + (json.length / 1024).toFixed(0) + " KB). Keep it private — it holds your creator code!", { ms: 8000 });
      return;
    }
  } catch (e) {
    console.warn("[storage] full backup module failed, falling back to raw dump:", (e && e.message) || e);
  }
  // Last resort: dump whatever kv answers key-by-key, same importable shape, minus identity.
  try {
    const KV = () => window.kv;
    const dumpFolder = async (folder) => {
      const out = {};
      try {
        const entries = await KV()[folder].entries();
        for (const [k, v] of entries) { try { out[k] = v; } catch (e2) {} }
      } catch (e3) {}
      return out;
    };
    const data = {
      format: "mno-backup", version: 1, exportedAt: Date.now(), user: null,
      community: await dumpFolder("community"), rpg: await dumpFolder("rpg"), worlds: await dumpFolder("worlds"),
      localStorage: {}
    };
    try {
      for (const k of ["mno.showNsfw", "mno.railPref", "mno.aiProvider", "mno.scenePrefs", "mno.imageGenPrefs"]) {
        try { const v = localStorage.getItem(k); if (v != null) data.localStorage[k] = v; } catch (e4) {}
      }
    } catch (e5) {}
    const json = JSON.stringify(data, null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: "application/octet-stream" }));
    const a = document.createElement("a");
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    a.href = url;
    a.download = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.mno-backup`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
    popupNotify("Backup downloaded (" + (json.length / 1024).toFixed(0) + " KB). Keep it private!", { ms: 8000 });
  } catch (e6) {
    console.warn("[storage] emergency backup failed:", (e6 && e6.message) || e6);
    popupNotify("⚠️ Backup download failed too — copy anything on screen now before closing the tab.", { ms: 8000 });
  }
}

// "reading" | "saving" | "deleting" → "read" | "save" | "delete", so user-facing
// sentences say "Couldn't save your data", never "Couldn't saving your saved data".
function actionVerb(action) {
  return action === "saving" ? "save" : action === "deleting" ? "delete" : "read";
}

// Fire-and-forget: never awaited by callers, never throws, never stacks.
async function showStoragePopup(action) {
  if (_popupOpen) return;
  const now = Date.now();
  if (now - _lastPopupAt < POPUP_THROTTLE_MS) return;
  let CP = popupConfirm();
  if (!CP) {
    try {
      if (!document || !document.body) return;
      const m = await import("./popups.js");
      CP = m && m.ConfirmPopup ? m.ConfirmPopup : null;
    } catch (e) { return; }
  }
  if (!CP) return;
  _popupOpen = true;
  _lastPopupAt = now;
  try {
    // The toast (z-index above the overlay) would sit on top of this panel's buttons — and on a
    // phone it covers them outright. The panel carries the same message plus the download, so
    // get the toast out of the way the moment the panel opens.
    try { document.querySelector("#toastEl")?.classList.remove("show"); } catch (e) {}
    const verb = actionVerb(action);
    const ok = await CP.open({
      title: "Storage unavailable — download a backup?",
      message: `Couldn't ${verb} your data — this device or browser is low on space, or is blocking site storage. We haven't deleted anything, but new progress is NOT being saved.\n\n⚠️ DO NOT CLOSE OR RELOAD THIS TAB — anything not saved yet could be lost, and when space is this low the browser itself can clear stored data at any time.\n\nFree up space, then try again. Download everything now as a safety copy (you can also do this anytime under Settings › Data & Backup).`,
      warning: "The backup file contains your creator code (your secret key). Anyone who has it can edit, overwrite or delete every world you published. Keep it private and never upload it anywhere public.",
      confirmText: "Download everything"
    });
    if (ok) await downloadEmergencyBackup();
  } catch (e) { /* panel must never throw */ }
  finally { _popupOpen = false; }
}

export function notifyStorageError(notifyFn, action = "reading", detail = null) {
  const now = Date.now();
  try {
    if (detail) {
      try { window.__mnoLastStorageError = { message: String((detail && detail.message) || detail), name: (detail && detail.name) || "", at: new Date().toISOString() }; } catch (recErr) {}
      console.warn("[storage] storage failure:", (detail && detail.message) || detail);
    }
  } catch (e) { /* recording must never throw */ }
  if (now - _lastToastAt < 8000) return;
  _lastToastAt = now;
  try {
    const fn = typeof notifyFn === "function" ? notifyFn : null;
    const extra = action === "saving" || action === "deleting"
      ? " A backup panel is open — Download everything to keep a file copy, then free up space."
      : " A backup panel is open with a Download everything safety copy.";
    const msg = `⚠️ Couldn't ${actionVerb(action)} your data — this device may be low on space. We haven't deleted anything, but anything not saved yet could be lost, so don't close the tab.${extra}`;
    if (fn) fn(msg, { ms: 8000 });
    else console.warn("[storage]", msg);
  } catch (e) { /* toast must never throw */ }
  try { showStoragePopup(action); } catch (e) { /* panel must never throw */ }
}

// True when `e` looks like IndexedDB / quota / connection-closing failure rather than a real bug.
export function isStorageError(e) {
  if (!e) return false;
  if (e.isStorageUnavailable === true) return true;
  const name = String((e && e.name) || "");
  const msg = String((e && (e.message || e)) || "").toLowerCase();
  // The exact failure from the bug report — match it even if the DOMException name is missing.
  if (msg.includes("database connection is closing")) return true;
  if (msg.includes("failed to execute 'transaction' on 'idbdatabase'")) return true;
  if (msg.includes("failed to execute \"transaction\" on \"idbdatabase\"")) return true;
  // Chrome's IndexedDB large-value failure ("Failed to read large IndexedDB value") — thrown
  // when a single stored value (e.g. the community world's cache blob holding every added
  // world) grows past what the browser can read back in this profile (much sooner in
  // incognito / best-effort storage). Match it by message alone: its `name` is a plain
  // Error/UnknownError, so the name-gated check below would miss it and it would surface as
  // the engine's raw "unhandled promise rejection" popup instead of the storage warning.
  if (msg.includes("failed to read large")) return true;
  if (msg.includes("large indexeddb")) return true;
  // Generic IndexedDB / idb-keyval signatures — true no matter the error name, so future
  // browser wordings of the same failure are still recognised as "storage is unavailable"
  // rather than a bug in our code.
  if (msg.includes("indexeddb")) return true;
  if (msg.includes("idbkeyval")) return true;
  if (msg.includes("idbdatabase")) return true;
  if (msg.includes("quota")) return true;
  const idbNames = new Set([
    "InvalidStateError", "QuotaExceededError", "UnknownError", "AbortError",
    "VersionError", "TransactionInactiveError", "DataError", "ConstraintError"
  ]);
  if (!idbNames.has(name)) return false;
  // An IDB-named error is only "storage unavailable" when it smells like storage, not logic.
  return (
    msg.includes("transaction") || msg.includes("idb") || msg.includes("indexeddb") ||
    msg.includes("database") || msg.includes("quota") || msg.includes("storage") ||
    msg.includes("disk") || msg.includes("space") || msg.includes("closing") ||
    msg.includes("abort") || msg.includes("inactive") || msg === ""
  );
}

// True when the failure is specifically "out of room" (quota) rather than a transient close.
export function isQuotaError(e) {
  if (!e) return false;
  const name = String((e && e.name) || "");
  const msg = String((e && (e.message || e)) || "").toLowerCase();
  return name === "QuotaExceededError" || msg.includes("quota") || msg.includes("disk full") || msg.includes("low on space");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Run `fn` once, retrying a single time after a short pause when the failure looks like a
// transient storage hiccup (the "connection is closing" case often succeeds on the next tick
// once the plugin re-opens the database). Non-storage errors are never retried. On final
// failure the original error is re-thrown, tagged so callers can recognise it without
// string-matching.
export async function withStorageRetry(fn, { retries = 1, delayMs = TRANSIENT_DELAY_MS } = {}) {
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!isStorageError(e) || attempt >= retries) break;
      try { await sleep(delayMs); } catch (sleepErr) { /* ignore */ }
    }
  }
  try { if (lastErr) lastErr.isStorageUnavailable = true; } catch (tagErr) { /* ignore */ }
  try {
    if (lastErr && isStorageError(lastErr)) {
      window.__mnoLastStorageError = { message: String((lastErr && lastErr.message) || lastErr), name: (lastErr && lastErr.name) || "", at: new Date().toISOString() };
      markStorageDegraded();
    }
  } catch (recErr) { /* ignore */ }
  throw lastErr;
}

// Wrap an async kv read so it never rejects with a raw storage error: retry once, then fall
// back to `fallback` (usually [] or null) so the caller can keep running on bundled content.
// Non-storage errors still throw — those are real bugs, not a full disk.
// `onFallback` (optional) fires only when the fallback is used, so a caller can mark THAT
// read's result as suspect — airtight per-call, unlike sampling the time-window flag later (a
// concurrent successful read could clear it in between). Lists use it to tag the returned array
// (non-enumerable, so JSON/spread/.length never see it); see `isFallbackList`.
export async function safeStorageRead(fn, fallback, logTag = "[storage]", onFallback = null) {
  try {
    const v = await withStorageRetry(fn, { retries: 1 });
    markStorageHealthy();
    return v;
  } catch (e) {
    if (isStorageError(e)) {
      try { console.warn(logTag, "storage read failed — using fallback:", (e && e.message) || e); } catch (logErr) {}
      markStorageDegraded();
      try { if (typeof onFallback === "function") onFallback(); } catch (cbErr) {}
      return fallback;
    }
    throw e;
  }
}

// True when `list` is a read-fallback array (see SessionStore.list / HeroStore.list), i.e. it may
// be [] while the real stored list is non-empty. Never true for genuine storage content.
export function isFallbackList(list) {
  try { return !!(list && list._storageFallback === true); } catch (e) { return false; }
}

// Tag an array as a read fallback. Non-enumerable: invisible to JSON.stringify, spread,
// Object.keys and .length — it only answers `isFallbackList`.
export function markFallbackList(arr) {
  try {
    if (Array.isArray(arr)) Object.defineProperty(arr, "_storageFallback", { value: true, enumerable: false, writable: false });
  } catch (e) {}
  return arr;
}
