// notes.js — Author's notes shared helpers.
//
// A world's Author's notes act like its cover: the TEXT lives in its own upload-plugin blob
// (unlimited length, Markdown), and the catalog server keeps only the blob's 32-hex upload ID
// (`notesId`, exactly 32 chars — no prefix, no extension, so it costs one tiny trailing slot
// field instead of an 800-byte inline copy). The world file's `meta.authorNotes` always keeps the
// local draft text (never rewritten to the URL — unlike the cover), so the editor never needs to
// fetch anything to edit. Pointers (a blob URL or bare ID) only ever come from live listing records
// — added worlds, whose panels resolve them with the fetch below.
//
// Upload-host shape: a text upload today comes back as
// `https://user.uploads.dev/file/<32hex>.txt`. We store only the `<32hex>` and fetch `<id>.txt`
// first, falling back to the bare extensionless `<id>` — so if the host ever drops the extension,
// the same stored IDs keep working with one extra 404 in between.

export const NOTES_HOST = "https://user.uploads.dev/file";
export const NOTES_ID_RE = /^[0-9a-f]{32}$/i;

// The bare 32-hex upload ID inside any notes reference (a bare ID or a hosted URL), or "".
export function notesIdFromValue(v) {
  const m = String(v == null ? "" : v).match(/([0-9a-f]{32})/i);
  return m ? m[1].toLowerCase() : "";
}

// True when the value is already a pointer (a bare 32-hex ID, or an https URL on the upload
// host carrying one) rather than draft text an author typed.
export function isNotesPointer(v) {
  const s = String(v == null ? "" : v).trim();
  if (!s) return false;
  if (NOTES_ID_RE.test(s)) return true;
  if (!/^https:\/\//i.test(s)) return false;
  const host = s.slice(8).split(/[/?#]/)[0].toLowerCase();
  if (host !== "user.uploads.dev" && host !== "editable.uploads.dev") return false;
  return /[0-9a-f]{32}/i.test(s);
}

export const notesUrlForId = (id) => NOTES_HOST + "/" + String(id || "").toLowerCase();

// Fetch + cache. Successes are cached (detail panels repaint on every like); failures are not,
// so reopening the panel retries. In-flight fetches are shared, so a repaint mid-fetch joins it.
const notesTextCache = new Map();
const notesFlight = new Map();
export function fetchNotesText(id, { timeoutMs = 20000 } = {}) {
  id = String(id || "").toLowerCase();
  if (!NOTES_ID_RE.test(id)) return Promise.reject(new Error("bad notes id"));
  if (notesTextCache.has(id)) return Promise.resolve(notesTextCache.get(id));
  if (notesFlight.has(id)) return notesFlight.get(id);
  const p = (async () => {
    const urls = [NOTES_HOST + "/" + id + ".txt", NOTES_HOST + "/" + id];
    let lastErr = null;
    for (const u of urls) {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), timeoutMs);
      try {
        const res = await fetch(u, { signal: ctl.signal });
        if (!res.ok) { lastErr = new Error("notes_fetch_" + res.status); continue; }
        const text = await res.text();
        notesTextCache.set(id, text);
        return text;
      } catch (e) {
        lastErr = e;
      } finally {
        clearTimeout(t);
      }
    }
    throw lastErr || new Error("notes_fetch_failed");
  })();
  notesFlight.set(id, p);
  p.catch(() => {}).finally(() => notesFlight.delete(id));
  return p;
}

// Section shell rendered into a world detail panel when notes exist (id to lazy-load, or inline
// draft text). The caller fills it via fillNotesSection (async so the panel itself paints fast).
// `renderFn` is the panel's own markdown renderer (both panels use rich-text.js's richText).
export function notesSectionShell() {
  return `<div class="wd-notes" data-notes><div class="wd-notes-head">📝 Author&rsquo;s notes</div><div class="wd-notes-body" data-notes-body><span class="wd-notes-loading">Loading author&rsquo;s notes…</span></div></div>`;
}
export async function fillNotesSection(container, { id = "", text = null } = {}, renderFn) {
  if (!container) return;
  const body = container.querySelector("[data-notes-body]") || container;
  const render = typeof renderFn === "function" ? renderFn : (s) => String(s == null ? "" : s);
  try {
    if (text == null) {
      if (!NOTES_ID_RE.test(String(id || "").toLowerCase())) { container.remove(); return; }
      text = await fetchNotesText(id);
    }
    if (!String(text || "").trim()) { container.remove(); return; }
    body.innerHTML = render(String(text));
  } catch (e) {
    body.innerHTML = `<span class="wd-notes-fail">Couldn&rsquo;t load the author&rsquo;s notes — check your connection and reopen this panel.</span>`;
  }
}
