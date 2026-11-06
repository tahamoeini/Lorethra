// ============================================================================
// backup.js — Data & Backup: export / import EVERYTHING.
// ----------------------------------------------------------------------------
// Loaded on demand (dynamic import from main.js) — never in the boot path. It is
// the Settings page's Data & Backup section (§6.16); the old 💾 popup that hung off
// the nav foot is gone, and the creator code rows live in that page's Identity
// section (community.js), not here.
//
// The backup is ONE plain JSON file (no encryption) containing:
//   format/version/exportedAt
//   user        — the community identity: userId + secret + a cached username hint
//   community   — links | library | cache | settings
//   rpg         — sessions + session_<id> + activeSession + savedHeroes
//   worlds      — index + every world file (keyed exactly like the kv `worlds` folder)
//   localStorage — selected machine-local UI prefs (rail layout, NSFW filter)
//
// The file carries the CREATOR CODE (the device secret), which is a master key for every world
// that identity published. The warning below is the entire protection, so it is shown every time.
//
// kv exposes no way to enumerate folder NAMES, so the export walks an explicit registry
// (KV_REGISTRY). Add a folder here when a feature introduces one.
// ============================================================================

import { readBrowserStorage, fmtBytes } from "./storage-info.js";
import { ICON_IMPORT, ICON_EXPORT } from "./icons.js";
// Sharded added-world file cache (one IndexedDB key per world): the backup FILE format is
// unchanged (`community.cache` stays `{ [worldId]: entry }`), so old backups still restore —
// the split/assemble happens at this boundary only.
import { readAllCache, listCacheIds, cacheKeyFor } from "./libcache.js";

const A = () => window.mnoApp;
const KV = () => window.kv;

const BACKUP_FORMAT = "mno-backup";
const BACKUP_VERSION = 1;
// The backup file extension — the same idea as `.mno-world` / `.mno-adv` / `.mno-lore`: the payload is
// JSON, but a custom extension keeps the import picker from offering every unrelated .json on the
// device and makes a backup recognisable at a glance. Legacy .json backups still import (the file is
// validated by its `format` field, not its name).
const BACKUP_EXTENSION = ".mno-backup";

// The known kv folders and the keys we back up. `all: true` means "every key in the folder".
// Keys are matched exactly, or by a RegExp.
const KV_REGISTRY = [
  { folder: "rpg", keys: ["sessions", "activeSession", "savedHeroes"], patterns: [/^session_/] },
  { folder: "worlds", keys: ["index"], patterns: [/./] },
  { folder: "community", keys: ["user", "links", "library", "settings", "pendingDeletes"], patterns: [] },
  // Cached world files (opt-in): sharded `cache:<worldId>` keys, one per added world.
  { folder: "community", keys: [], patterns: [/^cache:/], optional: true }
];

// Machine-local UI prefs worth carrying to a new device (chosen deliberately, not swept in).
const LS_KEYS = ["mno.showNsfw", "mno.railPref", "mno.aiProvider", "mno.scenePrefs", "mno.imageGenPrefs"];

const WARNING_HTML = `<b>⚠️ This file contains your creator code (your secret key).</b><br>
Anyone who has this file can <b>edit, overwrite or delete every world you have published</b>, not just read your saves.
Keep it private — store it somewhere safe and <b>never upload it anywhere public</b>.`;

const WARNING_TEXT = "This backup file contains your creator code (your secret key). Anyone who has it can edit, overwrite or delete every world you have published. Keep it private and never upload it anywhere public.";

/* ---------------------------------------------------------------------------
 * export
 * ------------------------------------------------------------------------- */

async function readFolder(folder, includeCache) {
  const out = {};
  const reg = KV_REGISTRY.filter((r) => r.folder === folder);
  if (!reg.length) return out;
  let folderObj;
  try { folderObj = KV()[folder]; } catch (e) { return out; }
  for (const part of reg) {
    if (part.only === "cache" && !includeCache) continue;
    // A `only`-marked registry entry targets exactly one key.
    let entries;
    try { entries = await folderObj.entries(); } catch (e) { entries = []; }
    // One unreadable large value (e.g. community `cache` outgrowing incognito's limit —
    // Chrome throws "Failed to read large IndexedDB value") makes `entries()` reject for the
    // WHOLE folder. Salvage per key instead of losing everything: readable keys still back up.
    if (!entries.length) {
      let keys = [];
      try { keys = await folderObj.keys(); } catch (e) { keys = []; }
      if (keys.length) {
        for (const k of keys) {
          try { entries.push([k, await folderObj.get(k)]); }
          catch (e) { console.warn("[backup] read failed, leaving " + folder + "/" + k + " out of the backup:", (e && e.message) || e); }
        }
      }
    }
    for (const [k, v] of entries) {
      if (part.only) { if (k === part.only) out[k] = v; continue; }
      if (part.keys.includes(k) || part.patterns.some((re) => re.test(k))) out[k] = v;
    }
  }
  return out;
}

async function safeKvGet(folder, key) {
  try { return (await KV()[folder].get(key)) || null; }
  catch (e) { console.warn("[backup] read failed, leaving " + folder + "/" + key + " out of the backup:", (e && e.message) || e); return null; }
}

export async function buildBackup({ includeCache = true, includeUser = true } = {}) {
  let identity = null;
  try {
    const communityMod = await import("./community.js");
    // Never mint an identity here: a backup for a visitor with none yet simply carries no user.
    // Wrapped: when storage itself is failing (the emergency-download case) the identity read
    // is the first thing to throw — a partial backup without identity still beats no backup.
    identity = await communityMod.api.identityOrNull();
  } catch (e) { console.warn("[backup] identity unreadable, backing up without it:", (e && e.message) || e); identity = null; }
  const community = {};
  for (const key of ["links", "library", "settings", "pendingDeletes"]) community[key] = await safeKvGet("community", key);
  // Reassembled into the same `{ [worldId]: entry }` shape the backup file has always carried.
  if (includeCache) community.cache = await readAllCache(KV().community).catch(() => ({}));
  const rpg = await readFolder("rpg");
  const worlds = await readFolder("worlds");
  const localStorage_ = {};
  for (const k of LS_KEYS) { try { const v = localStorage.getItem(k); if (v != null) localStorage_[k] = v; } catch (e) {} }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    user: includeUser && identity
      ? { userId: identity.userId, secret: identity.secret, username: identity.username || "", createdAt: identity.createdAt || 0 }
      : null,
    community,
    rpg,
    worlds,
    localStorage: localStorage_
  };
}

// A backup has no name of its own, so the date is it — the same `<name><extension>` shape the other
// exported files use, and it sorts a folder of backups chronologically.
export function backupFilename() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}${BACKUP_EXTENSION}`;
}

/* ---------------------------------------------------------------------------
 * restore
 * ------------------------------------------------------------------------- */

function migrateBackup(obj) {
  if (!obj || typeof obj !== "object") throw new Error("That file isn't a backup.");
  if (obj.format !== BACKUP_FORMAT) throw new Error(`That file isn't an MNO backup (${BACKUP_EXTENSION}).`);
  if (Number(obj.version) > BACKUP_VERSION) throw new Error("That backup was made by a newer version of the app.");
  return obj;
}

// Merge: keep what we already have on conflict, add what's missing. Replace: wipe first.
async function applyBackup(data, mode) {
  const writes = []; // [{ folder, key, value, delete? }]
  const pushFolder = (folder, obj) => {
    for (const [k, v] of Object.entries(obj || {})) writes.push({ folder, key: k, value: v });
  };

  const cur = {
    rpg: await readFolder("rpg", true),
    worlds: await readFolder("worlds", true)
  };

  if (mode === "replace") {
    // Wipe every key we own in these folders, then write the backup's contents.
    for (const folder of ["rpg", "worlds", "community"]) {
      let keys = [];
      try { keys = await KV()[folder].keys(); } catch (e) { keys = []; }
      for (const k of keys) writes.push({ folder, key: k, value: undefined, remove: true });
    }
    pushFolder("rpg", data.rpg);
    pushFolder("worlds", data.worlds);
    // The file carries the cache as one object; the store holds it sharded, so split it here.
    // (The wipe above already cleared old `cache:*` keys and any legacy `cache` monolith.)
    const { cache: repCache, ...restCommunity } = data.community || {};
    pushFolder("community", restCommunity);
    for (const [wid, entry] of Object.entries(repCache || {})) writes.push({ folder: "community", key: cacheKeyFor(wid), value: entry });
  } else {
    const rpgIn = data.rpg || {};
    const worldsIn = data.worlds || {};
    const merge = (existing, incoming, keyOf) => {
      const out = Array.isArray(existing) ? existing.slice() : [];
      const seen = new Set(out.map((x) => keyOf(x)));
      for (const x of incoming || []) if (!seen.has(keyOf(x))) out.push(x);
      return out;
    };
    writes.push({ folder: "rpg", key: "sessions", value: merge(cur.rpg.sessions, rpgIn.sessions, (s) => s && s.id) });
    writes.push({ folder: "rpg", key: "savedHeroes", value: merge(cur.rpg.savedHeroes, rpgIn.savedHeroes, (h) => h && h.id) });
    for (const [k, v] of Object.entries(rpgIn)) {
      if (k === "sessions" || k === "savedHeroes") continue;
      writes.push({ folder: "rpg", key: k, value: v });
    }
    // Worlds: add missing ids (never overwrite a world you already have of the same id).
    for (const [k, v] of Object.entries(worldsIn)) {
      if (k === "index") continue;
      if (!(k in cur.worlds)) writes.push({ folder: "worlds", key: k, value: v });
    }
    const idxCur = Array.isArray(cur.worlds.index) ? cur.worlds.index : [];
    const idxIn = Array.isArray(worldsIn.index) ? worldsIn.index : [];
    writes.push({ folder: "worlds", key: "index", value: merge(idxCur, idxIn, (e) => e && e.id) });
    // Community maps: same rule (add missing, keep ours).
    const c = data.community || {};
    const cCur = {
      // Direct gets (not readFolder) so one unreadable large value can't abort the restore —
      // each falls back to {} and the per-key write loop below still lands everything readable.
      links: await safeKvGet("community", "links") || {},
      library: await safeKvGet("community", "library") || {},
      cacheIds: await listCacheIds(KV().community).catch(() => [])
    };
    writes.push({ folder: "community", key: "links", value: Object.assign({}, c.links || {}, cCur.links) });
    writes.push({ folder: "community", key: "library", value: Object.assign({}, c.library || {}, cCur.library) });
    // Saved copies merge per world (add missing, keep ours) — one key per world, so one bad
    // entry can never block the rest.
    if (c.cache) for (const [wid, entry] of Object.entries(c.cache)) {
      if (!cCur.cacheIds.includes(wid)) writes.push({ folder: "community", key: cacheKeyFor(wid), value: entry });
    }
    if (c.pendingDeletes && c.pendingDeletes.length) writes.push({ folder: "community", key: "pendingDeletes", value: c.pendingDeletes });
    if (c.settings) writes.push({ folder: "community", key: "settings", value: Object.assign({}, c.settings, await safeKvGet("community", "settings") || {}) });
  }

  // The identity (creator code) always comes from the backup when present — that's the point of it.
  if (data.user && data.user.secret && data.user.userId) {
    writes.push({ folder: "community", key: "user", value: { userId: data.user.userId, secret: data.user.secret, createdAt: data.user.createdAt || Date.now(), formatVersion: 1, username: data.user.username || undefined, usernameClaimedAt: data.user.username ? Date.now() : undefined } });
  }

  let done = 0;
  for (const w of writes) {
    try {
      if (w.remove) await KV()[w.folder].delete(w.key);
      else await KV()[w.folder].set(w.key, w.value);
      done++;
    } catch (e) { console.warn("[backup] write failed", w.folder, w.key, e); }
  }
  for (const k of LS_KEYS) {
    const v = (data.localStorage || {})[k];
    if (typeof v === "string") { try { localStorage.setItem(k, v); } catch (e) {} }
  }
  return done;
}

/* ---------------------------------------------------------------------------
 * Data & Backup UI
 * ------------------------------------------------------------------------- */

function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
export function downloadText(filename, text, mime = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
}
async function pickFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve((input.files && input.files[0]) || null);
    input.click();
  });
}

// The browser's own storage answer, as stat rows — the figures it hands over, with nothing derived from
// them beyond the units and the wording. Two rows rather than one because a stats row is label-left /
// value-right and has to stay on one line (the Value column is only ~200px at the 2-column breakpoint);
// the durability flag is a separate fact about the same storage anyway. Never rejects: a browser that
// can't answer says so in the row, which is more honest than a blank.
async function browserReportRows() {
  const info = await readBrowserStorage().catch(() => ({ unsupported: true }));
  if (info.unsupported) return [["Browser report", "not available in this browser"]];
  const used = Number.isFinite(info.usage) ? fmtBytes(info.usage) : "?";
  const of = Number.isFinite(info.quota) && info.quota > 0 ? ` of ${fmtBytes(info.quota)}` : "";
  const persisted = info.persisted === true
    ? ["On", "The browser granted persistent storage: it won't clear this data automatically when the device runs low on space."]
    : info.persisted === false
      ? ["Off", "Best-effort storage: the browser may clear this data if the device runs low on space."]
      : ["Unknown", "This browser doesn't report whether storage is persistent."];
  return [
    ["Browser report", `${used}${of} used`],
    ["Persistent storage", persisted[0], persisted[1]]
  ];
}

// The Settings panel's Data & Backup section (§6.16). Returns a fresh `<section>` element; the caller
// (main.js's openSettingsPanel) places it and owns teardown, and everything wired here is scoped to
// that element. This is the one home for backup/restore.
//
// It carries no creator-code rows: those belong to the Identity section, which this section points at
// (the note under Import says so). What is left is exactly the data side: one file out, one file in,
// and an honest readout of what's here.
export function backupSection() {
  const sec = el("section", "pf-sec pf-backup");
  sec.innerHTML = `
    <h3 class="pf-sec-title">Data &amp; Backup</h3>
    <p class="pf-hint">Everything lives in this browser. Back it up before clearing site data or moving to another device.</p>
    <div class="pf-warn">${WARNING_HTML}</div>

    <div class="pf-sub">
      <div class="pf-sub-title">${ICON_EXPORT} Back up</div>
      <label class="ex-sw"><input class="pf-incl-cache" type="checkbox" checked> Include saved copies of added community worlds</label>
      <div class="pf-row">
        <button class="btn ok pf-export">${ICON_EXPORT} Download full backup</button>
      </div>
    </div>

    <div class="pf-sub">
      <div class="pf-sub-title">${ICON_IMPORT} Restore from a backup file</div>
      <div class="pf-row">
        <button class="btn pf-merge">${ICON_IMPORT} Import (merge)</button>
        <button class="btn pf-replace">${ICON_IMPORT} Import (replace all)</button>
      </div>
      <div class="pf-note"><b>Merge</b> keeps what's already here and adds what's missing; <b>replace</b> wipes local data first. Either way the app reloads afterwards so every store re-initialises cleanly.</div>
      <div class="pf-note">Everything in the file comes back: your adventures, worlds, community library and prefs — and your <b>identity</b>, because the file carries your creator code. Importing is therefore also a sign-in, and the worlds you published are yours again. A <b>creator code</b> on its own does just that last part: paste it under <b>Identity</b> to become you on a device with no backup file.</div>
    </div>

    <div class="pf-sub">
      <div class="pf-sub-title">💾 Storage</div>
      <div class="pf-stats">…</div>
      <div class="pf-note">Everything up to <b>Total</b> is counted from the app's own saved data. The last two rows are the browser's own word on that same storage: how much of the quota it reports as used — the quota being roughly a share of the device's free space, a rough ceiling rather than a promise — and whether the data is <b>persistent</b>, i.e. kept rather than cleared automatically when the device runs low on space. The browser also counts the small things it keeps beside our data and updates its figures lazily, so its number won't match the <b>Total</b> exactly.</div>
    </div>
    <div class="pf-err"></div>`;
  const errEl = sec.querySelector(".pf-err");
  const say = (m) => { errEl.textContent = m || ""; };

  // The creator-code warning is only for claimed identities (nothing published yet without one).
  // Hidden first so unclaimed visitors never see it flash; shown once the check confirms a username.
  const warnEl = sec.querySelector(".pf-warn");
  warnEl.hidden = true;
  import("./community.js").then((m) => m.api.identityOrNull()).then((id) => {
    if (id && id.username) warnEl.hidden = false;
  }).catch(() => {});

  // ---- storage (an itemised readout, then the browser's own report) ----
  // Two answers, kept apart on purpose (the note above them says the same in the player's words): every
  // row up to Total is OUR count — the JSON bytes of every record the app keeps — and the last row is the
  // browser's own answer for the origin, reported as-is via storage-info.js's `readBrowserStorage()`. The
  // browser's `usage` is never folded into our count: it refreshes lazily (a 5 MB write once moved it by
  // ~235 kB) and covers the little extras it keeps beside our data, so it is a different number, not a
  // truer one.
  //
  // What OUR count deliberately leaves out (all of it visible in the Browser report row, or too small to
  // itemise):
  //   • EMPTY INDEXEDDB SHELLS. The kv-plugin is a Proxy, so reading ANY property off it runs
  //     `indexedDB.open("<prop>-db-kv-plugin")` — and an IndexedDB database never goes away once created.
  //     A stray read (`kv.keys`, `kv.get`, destructuring, `await kv`) or a folder RENAME therefore leaves
  //     an empty database behind forever. Only rpg / worlds / community are real folders: verified on a
  //     live page by deleting every other (empty) database and reloading — exactly those three came back.
  //   • localStorage: a handful of per-device UI prefs (rail layout, NSFW filter, the Worlds welcome
  //     banner, the Adventures grouping, nav state) — a few hundred bytes, and only LS_KEYS ride in the
  //     backup.
  //   • The platform's own service worker registration (~11 kB) that serves the generator's src/ files,
  //     and its Cache Storage (empty in practice).
  (async () => {
    const stats = sec.querySelector(".pf-stats");
    const reportP = browserReportRows(); // starts now, read while the kv folders are being walked
    let rows = [];
    try {
      const sizeOf = (v) => new Blob([JSON.stringify(v == null ? null : v)]).size;
      const folderBytes = (obj) => Object.values(obj || {}).reduce((a, v) => a + sizeOf(v), 0);
      const rpg = await readFolder("rpg", false);
      const worlds = await readFolder("worlds", false);
      const comm = await readFolder("community", true);
      // One formatter for the whole group (storage-info.js's SI units), so no two rows can show one byte
      // count in two different unit systems.
      const fmt = fmtBytes;
      // An adventure is TWO keys: the small row in the `sessions` index (name, turn, cached face) and
      // the `session_<id>` blob holding the whole transcript and portrait — the blobs are where the
      // megabytes are. Counting the index alone reported ~45 KB for ~9 MB of adventures — the bug that
      // started all this. Count both.
      const sessions = rpg.sessions || [];
      const advBytes = sizeOf(sessions) + Object.entries(rpg).reduce((a, [k, v]) => (k.startsWith("session_") ? a + sizeOf(v) : a), 0);
      rows.push(["Adventures", sessions.length + " · " + fmt(advBytes)]);
      rows.push(["World library", Object.keys(worlds).filter((k) => k !== "index").length + " · " + fmt(folderBytes(worlds))]);
      rows.push(["Saved heroes", (rpg.savedHeroes || []).length + " · " + fmt(sizeOf(rpg.savedHeroes || []))]);
      rows.push(["Published worlds", Object.keys(comm.links || {}).length + " (with a community link)"]);
      // Saved copies are sharded (`cache:<worldId>` keys, one per added world) — sum those keys.
      const cacheBytes = Object.entries(comm).reduce((a, [k, v]) => (k.startsWith("cache:") ? a + sizeOf(v) : a), 0);
      rows.push(["Added worlds", Object.keys(comm.library || {}).length + " (saved copies: " + fmt(cacheBytes) + ")"]);
      const total = folderBytes(rpg) + folderBytes(worlds) + folderBytes(comm);
      rows.push(["Total", fmt(total)]);
    } catch (e) {
      rows = [["Total", "—"]]; // kv wouldn't answer; the browser's row below still can
    }
    rows.push(...(await reportP));
    // A row may carry a third element: a tooltip, for the rows whose value needs a sentence of context.
    stats.innerHTML = rows.map(([k, v, title]) => `<div class="pf-stat"${title ? ` title="${esc(title)}"` : ""}><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("");
  })();

  // ---- export ----
  sec.querySelector(".pf-export").onclick = async () => {
    say("");
    const inclCache = sec.querySelector(".pf-incl-cache").checked;
    // No creator-code warning without a claimed username — and no identity is minted to check:
    // the export itself must not create one either (see buildBackup).
    let claimed = false;
    try {
      const m = await import("./community.js");
      const id = await m.api.identityOrNull();
      claimed = !!(id && id.username);
    } catch (e) {}
    // The popup says two different things on purpose: what is being handed to you, and what it would
    // mean if it leaked (the second only when there's a published identity to protect).
    const ok = await A().ConfirmPopup.open({
      title: "Download your backup?",
      message: "Everything in this browser — your adventures, worlds, community library and prefs — in one file you can import back on any device.",
      warning: claimed ? WARNING_TEXT : "",
      confirmText: "Download"
    });
    if (!ok) return;
    try {
      const data = await buildBackup({ includeCache: inclCache });
      const json = JSON.stringify(data, null, 2);
      downloadText(backupFilename(), json, "application/octet-stream");
      A().notify("Backup downloaded (" + (json.length / 1024).toFixed(0) + " KB). Keep it private!");
    } catch (e) { say("Backup failed: " + (e.message || e)); }
  };

  // ---- import ----
  const doImport = async (mode) => {
    say("");
    const f = await pickFile(BACKUP_EXTENSION);
    if (!f) return;
    let data;
    try { data = migrateBackup(JSON.parse(await f.text())); }
    catch (e) { say("Import failed: " + (e.message || e)); return; }
    const counts = {
      sessions: Object.keys(data.rpg || {}).filter((k) => k.startsWith("session_")).length,
      worlds: Object.keys(data.worlds || {}).filter((k) => k !== "index").length,
      added: Object.keys((data.community || {}).library || {}).length,
      identity: data.user && data.user.userId ? data.user.userId : "none"
    };
    const ok = await A().ConfirmPopup.open({
      title: mode === "replace" ? "Replace everything?" : "Merge this backup?",
      message: `Found ${counts.sessions} adventure(s), ${counts.worlds} world(s), ${counts.added} added community world(s), identity ${String(counts.identity).slice(0, 16)}.`,
      warning: mode === "replace"
        ? "REPLACE wipes your local adventures, worlds, library and community data first, then writes the backup's. This cannot be undone."
        : "Merge adds anything missing and keeps what you already have.",
      confirmText: mode === "replace" ? "Replace everything" : "Merge",
      danger: mode === "replace"
    });
    if (!ok) return;
    const btn = sec.querySelector(mode === "replace" ? ".pf-replace" : ".pf-merge");
    btn.disabled = true;
    try {
      const n = await applyBackup(data, mode);
      A().notify("Restored " + n + " item(s). Reloading…");
      setTimeout(() => location.reload(), 900);
    } catch (e) {
      btn.disabled = false;
      say("Import failed: " + (e.message || e));
    }
  };
  sec.querySelector(".pf-merge").onclick = () => doImport("merge");
  sec.querySelector(".pf-replace").onclick = () => doImport("replace");

  return sec;
}
