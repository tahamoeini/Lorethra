// Session persistence over the kv-plugin (IndexedDB-backed, per-browser, survives reloads).
// Supports multiple sessions + export/import JSON backup.

import { portraitThumb, portraitSig } from "./image-utils.js";
import { safeStorageRead, withStorageRetry, isStorageError, isStorageDegraded, isFallbackList, markFallbackList } from "./storage-errors.js";

// The index (`sessions`) is what the Adventures page reads, so each entry carries a small cached copy of
// the hero's face — `avatar`, a ~2–4 KB data URL (or a path/URL/emoji verbatim) beside the real portrait
// living in the save. Without it, drawing the row's 52px face would mean loading a whole save per row
// (an adventure can be megabytes), which is a read storm to paint a list. `portraitSig` is the
// fingerprint of the portrait the thumb was made from, so a save can skip re-encoding when the hero's
// avatar hasn't changed (and `avatar === undefined` means "never looked" — see `backfillAvatars`).
export class SessionStore {
  constructor(kv) {
    this.kv = kv;
    this.rpg = kv.rpg; // the plugin's "rpg" folder
  }

  // Reads never reject with a raw storage error: a low-space device gets an empty result so the
  // app can keep running (bundled content still plays) instead of an unhandled rejection.
  // A fallback [] is tagged (see `isFallbackList`) so writers can tell "truthfully empty"
  // apart from "storage failed" — overwriting the index from the latter orphans everything.
  async list() {
    let fellBack = false;
    const v = await safeStorageRead(() => this.rpg.get("sessions"), [], "[sessions]", () => { fellBack = true; });
    const out = v || [];
    return fellBack ? markFallbackList(out) : out;
  }

  // Writes retry once, then throw a friendly tagged Error (never the raw IDB jargon) so the
  // caller can toast one human sentence.
  friendlyWriteError(action) {
    const err = new Error(`Couldn't ${action} — this device may be low on space. Free up space, then try again. Nothing was deleted.`);
    err.isStorageUnavailable = true;
    return err;
  }

  async save(state, { touch = true } = {}) {
    if (!state || !state.id) return;
    const list = await this.list();
    // While storage is degraded an EMPTY list is suspect: it may be the read fallback, not the
    // truth (a failed `sessions` read returns []). Overwriting the index from it would orphan
    // every other adventure the moment the write succeeds — the classic "I lost everything".
    // `isFallbackList` tags THAT read's result (airtight); the degraded-window check is
    // belt-and-braces for paths that can't thread the marker. So the per-adventure blob (keyed
    // by id, can't clobber anything else) is still written, but the index is left alone and a
    // tagged error is thrown so the UI raises the backup panel.
    const indexSuspect = isFallbackList(list) || (list.length === 0 && isStorageDegraded());
    const existing = list.find((s) => s.id === state.id);
    const portrait = (state.character && state.character.portrait) || "";
    const sig = portraitSig(portrait);
    // The thumbnail is only re-derived when the hero's avatar actually changed — this runs on every
    // turn's save, and a canvas decode per turn would be pure waste.
    const avatar = existing && typeof existing.avatar === "string" && existing.portraitSig === sig
      ? existing.avatar
      : await portraitThumb(portrait);
    const meta = {
      id: state.id,
      name: state.name,
      charName: (state.character && state.character.name) || "Unnamed",
      worldId: state.worldId || "eryndor",
      worldName: state.worldName || "",
      turn: state.turn || 0,
      lastUpdated: touch ? Date.now() : (existing ? existing.lastUpdated : Date.now()),
      avatar,
      portraitSig: sig
    };
    const idx = list.findIndex((s) => s.id === state.id);
    if (idx >= 0) list[idx] = meta;
    else list.push(meta);
    try {
      await withStorageRetry(() => this.rpg.set("session_" + state.id, state), { retries: 1 });
    } catch (e) {
      if (isStorageError(e) || e.isStorageUnavailable) throw this.friendlyWriteError("save that adventure");
      throw e;
    }
    if (indexSuspect) throw this.friendlyWriteError("record that adventure in the list");
    try {
      await withStorageRetry(() => this.rpg.set("sessions", list), { retries: 1 });
    } catch (e) {
      if (isStorageError(e) || e.isStorageUnavailable) throw this.friendlyWriteError("save that adventure");
      throw e;
    }
  }

  async load(id) {
    // A storage failure reads as "missing" so open flows fall back gracefully.
    return await safeStorageRead(() => this.rpg.get("session_" + id), null, "[sessions]");
  }

  // Fill in the face for entries that predate the cached thumbnail. Saves written before `avatar`
  // existed have no thumb, and the only place the portrait lives is inside the save — so this walks them
  // one at a time IN THE BACKGROUND (the list has already painted with monograms), hands each thumbnail
  // to `onFace(entry, avatar)` so the row can be patched in place, and stores it for next time. Bounded
  // per call so a huge library can't turn one page visit into a long read.
  async backfillAvatars(entries, onFace = () => {}, { max = 24 } = {}) {
    const todo = (entries || []).filter((s) => s && s.avatar === undefined).slice(0, max);
    for (const s of todo) {
      const full = await this.load(s.id);
      const portrait = (full && full.character && full.character.portrait) || "";
      s.avatar = await portraitThumb(portrait);
      s.portraitSig = portraitSig(portrait);
      onFace(s, s.avatar);
      // Persist at once, in a transaction, merging only the two fields this owns — a `get`/`set` pair
      // here could drop a session saved (or started) by another path while the walk was in flight.
      try {
        await this.rpg.update("sessions", (cur) => {
          const t = (cur || []).find((x) => x.id === s.id);
          if (t) { t.avatar = s.avatar; t.portraitSig = s.portraitSig; }
          return cur;
        });
      } catch (e) { /* the thumbnail is a nicety — a failed write is retried next visit */ }
    }
    return todo.length;
  }

  async remove(id) {
    // Read BEFORE deleting: while degraded an empty list is suspect (see save()), and writing
    // the filtered (empty) index back would orphan every other adventure.
    const list = await this.list();
    if (isFallbackList(list) || (list.length === 0 && isStorageDegraded())) throw this.friendlyWriteError("delete that adventure");
    try { await withStorageRetry(() => this.rpg.delete("ctxmeter_" + id), { retries: 1 }); } catch (e) { /* meter cache is a nicety */ }
    try {
      await withStorageRetry(() => this.rpg.delete("session_" + id), { retries: 1 });
      const next = list.filter((s) => s.id !== id);
      await withStorageRetry(() => this.rpg.set("sessions", next), { retries: 1 });
    } catch (e) {
      if (isStorageError(e) || e.isStorageUnavailable) throw this.friendlyWriteError("delete that adventure");
      throw e;
    }
    try {
      if ((await this.getActive()) === id) await this.setActive(null);
    } catch (e) { /* active-session pointer is a nicety */ }
  }

  // Remember which session (if any) the user last had open, so a reload/return
  // can drop them straight back into it instead of the landing page.
  async getActive() {
    return (await safeStorageRead(() => this.rpg.get("activeSession"), null, "[sessions]")) || null;
  }

  async setActive(id) {
    try {
      await withStorageRetry(() => this.rpg.set("activeSession", id || null), { retries: 1 });
    } catch (e) {
      if (isStorageError(e) || e.isStorageUnavailable) {
        // The active-session pointer is a convenience, not the save itself — log and continue so
        // a low-space device can still play; the landing just won't auto-resume.
        console.warn("[sessions] setActive failed (storage unavailable):", (e && e.message) || e);
        return;
      }
      throw e;
    }
  }
}

// Global hero library — bio + avatar only. Stats are per-world, so they're deliberately NOT
// stored here. Lives in the generator's kv "rpg" folder, so it's shared across all worlds and
// sessions (not bound to any world).
const MAX_SAVED_HEROES = 40;

export class HeroStore {
  constructor(kv) {
    this.kv = kv;
    this.rpg = kv.rpg;
  }

  async list() {
    let fellBack = false;
    const v = await safeStorageRead(() => this.rpg.get("savedHeroes"), [], "[heroes]", () => { fellBack = true; });
    const out = v || [];
    return fellBack ? markFallbackList(out) : out;
  }

  // Find a saved hero by its slot label (case-insensitive) — used to detect name collisions
  // before saving so the UI can ask for an overwrite confirmation.
  async findByLabel(label) {
    const list = await this.list();
    const l = String(label || "").trim().toLowerCase();
    return list.find((h) => String(h.label || h.name || "").trim().toLowerCase() === l) || null;
  }

  // Save under a caller-chosen `label` (the save-slot name, which may repeat across heroes).
  // Pass `existingId` to overwrite a specific slot (keeps its id so reloads/orders stay stable);
  // otherwise a fresh slot is appended. Multiple heroes may share a label — each gets its own id.
  async save(hero, label, existingId) {
    const list = await this.list();
    // Same suspect-empty rule as SessionStore.save: overwriting `savedHeroes` from a fallback
    // [] would wipe every saved hero the moment the write succeeds.
    if (isFallbackList(list) || (list.length === 0 && isStorageDegraded())) {
      const err = new Error("Couldn't save that hero — this device may be low on space. Free up space, then try again. Nothing was deleted.");
      err.isStorageUnavailable = true;
      throw err;
    }
    const lab = String(label || "").trim() || hero.name || "Unnamed";
    const rec = {
      ...hero,
      id: existingId || "h_" + Math.random().toString(36).slice(2, 10),
      label: lab,
      savedAt: Date.now()
    };
    const idx = list.findIndex((h) => h.id === rec.id);
    if (idx >= 0) list[idx] = rec;
    else list.push(rec);
    while (list.length > MAX_SAVED_HEROES) list.shift();
    try {
      await withStorageRetry(() => this.rpg.set("savedHeroes", list), { retries: 1 });
    } catch (e) {
      if (isStorageError(e) || e.isStorageUnavailable) {
        const err = new Error("Couldn't save that hero — this device may be low on space. Free up space, then try again. Nothing was deleted.");
        err.isStorageUnavailable = true; err.cause = e;
        throw err;
      }
      throw e;
    }
    return rec;
  }

  async remove(id) {
    const list = await this.list();
    // Suspect-empty (see save()): writing a filtered fallback [] back would wipe every hero.
    // remove() never throws for storage trouble (callers treat it as best-effort), so skip the
    // write and leave storage alone.
    if (isFallbackList(list) || (list.length === 0 && isStorageDegraded())) {
      try { console.warn("[heroes] remove skipped (storage degraded, list unreadable)"); } catch (e) {}
      return;
    }
    const next = list.filter((h) => h.id !== id);
    try {
      await withStorageRetry(() => this.rpg.set("savedHeroes", next), { retries: 1 });
    } catch (e) {
      if (isStorageError(e) || e.isStorageUnavailable) {
        console.warn("[heroes] remove failed (storage unavailable):", (e && e.message) || e);
        return;
      }
      throw e;
    }
  }
}

// The adventure save file extension. Saves are JSON — the custom extension keeps the import
// picker from offering unrelated .json files, so a world file and a save file never look alike.
export const SAVE_EXTENSION = ".mno-adv";

// Download the active session as a save file (JSON payload, .mno-adv extension).
export function exportState(state) {
  const json = JSON.stringify({ version: 2, ...state }, null, 2);
  const blob = new Blob([json], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (state.name || "adventure").replace(/[^a-z0-9]+/gi, "_") + SAVE_EXTENSION;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
}

// Validate + restore an imported JSON state object. Accepts v1 (pre-worldId) and v2 (worldId).
// Wrong-file-type mix-ups throw TAGGED errors (isBackupFile / isWorldFile) carrying redirect
// copy, so the importer can offer the right button instead of "Unsupported save version."
// (a backup HAS version:1 and a world HAS version:1 — without these checks both fall through
// to the confusing "Missing session id.").
export function parseImported(raw) {
  const data = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!data || typeof data !== "object") throw new Error("Not a valid save file.");
  if (data.format === "mno-backup") {
    const err = new Error("This file is a FULL BACKUP of everything in this browser — adventures, worlds, library and settings — not a single adventure, so it can't be imported here.\n\nTo restore it: Settings › Data & Backup › Import (merge adds what's missing, replace wipes first).");
    err.isBackupFile = true;
    throw err;
  }
  if (data.format === "mno-world") {
    const err = new Error("This file is a world, not an adventure save. Import it from the Worlds page (Import World) instead.");
    err.isWorldFile = true;
    throw err;
  }
  if (data.version !== 1 && data.version !== 2) throw new Error("Unsupported save version.");
  if (!data.id) throw new Error("Missing session id.");
  return data;
}
