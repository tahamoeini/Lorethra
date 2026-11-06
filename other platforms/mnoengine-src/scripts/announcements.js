// Announcements banners — dev-editable notice bars on the Worlds, Adventures and Explore pages.
//
// Source: `src/announcements.md` (fetched once per page load, then reused). The file holds one or
// more notices. A line like `[pages: worlds]` starts a new notice shown only on those pages:
//
//   [pages: all]                  → Worlds + Adventures + Explore
//   [pages: worlds]               → only Worlds
//   [pages: adventures, explore]  → only those two
//
// Text before the first `[pages: ...]` line shows on ALL pages. A notice's ✕ hides only that notice
// for a day (a machine-local localStorage pref keyed by the notice's content hash, so the same text
// stays hidden across reloads for 24 h, while edited text shows again as a new notice). A notice is
// retired for good by deleting its text (and its `[pages: ...]` line, if it has one); an empty /
// comments-only / missing file means no banner anywhere.
//
// Rendering reuses the shared `inlineMd` marks (**bold**, *italic*, `code`) plus links:
// `[label](https://…)` opens a site in a new tab (http/https only), while internal actions open
// app screens directly — `[label](settings/identity)` jumps to a Settings section (`settings`,
// `settings/identity|content|interface|imagegen|aimodel|backup|admin`), `[label](explore)` (or
// `worlds`/`adventures`) switches home page, `[label](changelog)` opens the release notes,
// `[label](tavern)` opens the Tavern panel (`tavern/<channel>` jumps straight into that
// channel — e.g. `tavern/guild`, `tavern/help`). `discussion` works as an alias of `tavern`.
// Everything is escaped first, so the file can never inject markup. Internal actions are dispatched
// through a handler main.js registers (this module can't import main.js back — it is imported BY it).
import { inlineMd } from "./rich-text.js";

// The home pages a notice can target (page ids from main.js's HOME_SECTIONS).
export const ANNOUNCE_PAGES = ["worlds", "adventures", "explore"];

// Settings sections openable via `[label](settings/<section>)` (main.js's openSettingsPanel).
const SETTINGS_SECTIONS = ["identity", "content", "interface", "imagegen", "aimodel", "backup", "admin"];

let actionHandler = null; // registered by main.js: (act) => void
export function setAnnouncementActionHandler(fn) {
  actionHandler = typeof fn === "function" ? fn : null;
}

// Dismissals persist a day per notice (machine-local localStorage, `mno.announce.dismissed`):
// `{ <noticeId>: <dismissedAtMs> }`. The id is a hash of the notice's pages + text, so the same
// text stays hidden across reloads while edited text returns as a new notice. Entries older than
// DAY_MS are pruned on read and never block. Deliberately outside backup.js's LS_KEYS (like the
// welcome banner): a short-lived snooze, not a pref worth carrying to a new device.
const DISMISS_KEY = "mno.announce.dismissed";
const DAY_MS = 24 * 3600 * 1000;
let dismissed = null; // Map<noticeId, dismissedAtMs> — lazy-loaded so module import never touches storage
function loadDismissed() {
  if (dismissed) return dismissed;
  dismissed = new Map();
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return dismissed;
    const obj = JSON.parse(raw) || {};
    const now = Date.now();
    for (const k of Object.keys(obj)) {
      const ts = Number(obj[k]);
      if (Number.isFinite(ts) && now - ts < DAY_MS) dismissed.set(k, ts);
    }
    if (Object.keys(obj).length !== dismissed.size) saveDismissed();
  } catch (e) {}
  return dismissed;
}
function saveDismissed() {
  try {
    const obj = {};
    for (const [k, v] of dismissed) obj[k] = v;
    localStorage.setItem(DISMISS_KEY, JSON.stringify(obj));
  } catch (e) {}
}
function isDismissed(id) {
  const map = loadDismissed();
  const ts = map.get(id);
  if (ts == null) return false;
  if (Date.now() - ts >= DAY_MS) {
    map.delete(id);
    saveDismissed();
    return false;
  }
  return true;
}
function dismissNotice(id) {
  const map = loadDismissed();
  map.set(id, Date.now());
  saveDismissed();
}
// Stable per-notice id: FNV-1a over the sorted page list + raw text. Index-based ids would shift
// whenever a notice is added/removed above, unhiding (or wrongly hiding) unrelated notices.
function noticeId(pages, text) {
  const s = pages.slice().sort().join(",") + "\n" + String(text);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ("0000000" + h.toString(16)).slice(-8);
}
let cached = undefined;      // undefined = not fetched yet, null = no notices, else [{ id, pages, html }]
let fetching = null;

const LINK_MARK = "\u0001";

// A `[pages: ...]` directive line (case-insensitive). Anything else is notice text.
const DIRECTIVE_RE = /^\s*\[\s*pages\s*:\s*([^\]]+?)\s*\]\s*$/i;

// Split the directive's target list into known page ids. `all` (or `*`) expands to every page.
// Returns [] when nothing valid remains (the block is then skipped, with a console warning).
function parseTargets(raw) {
  const out = [];
  for (const tok of String(raw || "").toLowerCase().split(/[,\s]+/)) {
    if (!tok) continue;
    if (tok === "all" || tok === "*") return ANNOUNCE_PAGES.slice();
    if (ANNOUNCE_PAGES.indexOf(tok) !== -1) {
      if (out.indexOf(tok) === -1) out.push(tok);
    } else {
      console.warn("[announce] unknown page in [pages: ...]:", tok);
    }
  }
  return out;
}

// Split the file into blocks: each `[pages: ...]` line starts a new block for those pages; text
// before the first directive belongs to ALL pages (so a plain one-notice file keeps working).
function parseBlocks(md) {
  const noComments = String(md || "").replace(/<!--[\s\S]*?-->/g, "");
  const blocks = [];
  let cur = { pages: ANNOUNCE_PAGES.slice(), lines: [] };
  const push = () => {
    const text = cur.lines.join("\n").trim();
    if (text) blocks.push({ pages: cur.pages, text });
  };
  for (const line of noComments.split(/\r?\n/)) {
    const dm = line.match(DIRECTIVE_RE);
    if (dm) {
      push();
      cur = { pages: parseTargets(dm[1]), lines: [] };
      continue;
    }
    cur.lines.push(line);
  }
  push();
  // Drop blocks whose directive named no valid page (already warned in parseTargets).
  return blocks.filter((b) => b.pages.length > 0);
}

// `inlineMd` plus links (`<br>` line breaks): external `[label](https://…)` links (http/https only,
// new tab) and internal `[label](settings/identity|…)` / `(explore|…)` / `(changelog)` / `(tavern)`
// actions, which render as buttons the mount wires to main.js's handler. Unknown targets render
// as plain text. Tavern also accepts a channel (`tavern/guild`, `discussion/help`, …) — the
// channel is validated where the panel opens, so anything unknown just lands on the last channel.
function renderNotice(text) {
  const links = [];
  const masked = String(text).replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_, label, target) => {
    links.push({ label, target });
    return LINK_MARK + (links.length - 1) + LINK_MARK;
  });
  let out = inlineMd(masked).replace(/\n/g, "<br>");
  out = out.replace(new RegExp(LINK_MARK + "(\\d+)" + LINK_MARK, "g"), (_, i) => {
    const l = links[+i];
    if (!l) return "";
    const label = inlineMd(l.label);
    const target = String(l.target).replace(/["<>\s]/g, "");
    if (/^https?:\/\//i.test(target)) {
      return `<a href="${target}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    }
    const act = target.toLowerCase();
    const known =
      act === "settings" || act === "changelog" ||
      act === "tavern" || act === "discussion" ||
      act.startsWith("tavern/") || act.startsWith("discussion/") ||
      ANNOUNCE_PAGES.indexOf(act) !== -1 ||
      (act.startsWith("settings/") && SETTINGS_SECTIONS.indexOf(act.slice(9)) !== -1);
    if (!known) {
      console.warn("[announce] unknown link target:", l.target);
      return label;
    }
    return `<button type="button" class="hm-announce-act" data-act="${act}">${label}</button>`;
  });
  return out;
}

async function loadNotices() {
  if (cached !== undefined) return cached;
  if (!fetching) {
    fetching = fetch("src/announcements.md")
      .then((r) => (r.ok ? r.text() : ""))
      .then((md) => {
        const blocks = parseBlocks(md);
        cached = blocks.length
          ? blocks.map((b, i) => ({ index: i, id: noticeId(b.pages, b.text), pages: b.pages, html: renderNotice(b.text) }))
          : null;
        return cached;
      })
      .catch(() => {
        cached = null;
        return null;
      });
  }
  return fetching;
}

export function dismissAnnouncements() {
  if (Array.isArray(cached)) for (const n of cached) dismissNotice(n.id);
  document.querySelectorAll(".hm-announce").forEach((n) => n.remove());
}

export function isAnnouncementsDismissed() {
  const map = loadDismissed();
  const now = Date.now();
  let pruned = false;
  for (const [k, ts] of map) {
    if (now - ts >= DAY_MS) { map.delete(k); pruned = true; }
  }
  if (pruned) saveDismissed();
  return map.size > 0;
}

// Insert this page's notices directly BELOW the page header (never inside it: on phones the header
// bar sticks, and the accent wash is positioned off the header — a banner above it shifts both).
// Fire-and-forget: the md fetch must never delay the page mount. The `isConnected` guard drops late
// arrivals after the user has already switched page (the element left with the old page).
export async function maybeShowAnnouncement(pageEl, pageId) {
  if (!pageEl || ANNOUNCE_PAGES.indexOf(pageId) === -1) return;
  const notices = await loadNotices();
  if (!notices) return;
  const visible = notices.filter(
    (n) => !isDismissed(n.id) && n.pages.indexOf(pageId) !== -1
  );
  if (!visible.length) return;
  if (!pageEl.isConnected) return;
  if (pageEl.querySelector(":scope > .hm-announce")) return;
  const head = pageEl.querySelector(":scope > .hm-head");
  if (!head) return;
  const frag = document.createDocumentFragment();
  for (const n of visible) {
    const bar = document.createElement("div");
    bar.className = "hm-announce";
    bar.dataset.notice = n.id;
    bar.setAttribute("role", "status");
    bar.innerHTML = `<span class="hm-announce-dot" aria-hidden="true"></span><span class="hm-announce-tx"></span><button type="button" class="hm-announce-x" title="Hide for a day" aria-label="Hide announcement for a day">✕</button>`;
    bar.querySelector(".hm-announce-tx").innerHTML = n.html;
    bar.querySelectorAll(".hm-announce-act").forEach((b) => {
      b.onclick = () => { if (actionHandler) actionHandler(b.dataset.act); };
    });
    bar.querySelector(".hm-announce-x").onclick = () => {
      dismissNotice(n.id);
      bar.remove();
    };
    frag.appendChild(bar);
  }
  head.after(frag);
}
