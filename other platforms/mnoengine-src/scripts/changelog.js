// Changelog popup — the nav rail's Changelog item.
//
// Parses src/CHANGELOG.md (README §9 format) and shows it in a popup. Fetched once per page
// load, then reused. Needs pushBackClose (Back-button dismissal) and inlineMd (shared text
// renderer); the tiny esc is local so this module stays free of main.js.

import { pushBackClose } from "./back-close.js";
import { inlineMd } from "./rich-text.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- changelog popup (the nav rail's Changelog item) ---------- */
let changelogGroups = null; // parsed CHANGELOG.md; fetched once per page load, then reused
// Minimal parser (README §9): `## ` headings are dates, `- `/`* ` lines are entries. Extra
// non-empty lines under a bullet continue that entry (joined with \n, rendered as breaks);
// blank lines, `#` lines, and everything else are ignored.
function parseChangelog(md) {
  const groups = [];
  let cur = null;
  for (const raw of String(md || "").split(/\r?\n/)) {
    const h = raw.match(/^##\s+(\S.*)$/);
    if (h) { cur = { date: h[1].trim(), items: [] }; groups.push(cur); continue; }
    if (!cur) continue;
    const b = raw.match(/^\s*[-*]\s+(.+)$/);
    if (b) { cur.items.push(b[1].trim()); continue; }
    if (/^\s*#/.test(raw) || raw.trim() === "") continue;
    if (cur.items.length) cur.items[cur.items.length - 1] += "\n" + raw.trim();
  }
  return groups.filter((g) => g.items.length);
}
function changelogHtml(groups) {
  if (!groups.length) return `<div class="cl-empty">No release notes yet.</div>`;
  // Entries are escaped and inline-marked by the shared renderer (rich-text.js) — `code`, **bold** and
  // *italic* — so release notes read exactly like the prose elsewhere in the app. Continuation
  // lines (joined with \n by the parser) each render as a spaced `.cl-sub` block — a plain <br>
  // can't take the spacing (Blink ignores vertical margins on <br>).
  return groups.map((g) =>
    `<div class="cl-date">${esc(g.date)}</div><ul class="cl-list">` +
    g.items.map((it) => {
      const [first, ...rest] = String(it).split("\n");
      return `<li>${inlineMd(first)}${rest.map((ln) => `<span class="cl-sub">${inlineMd(ln)}</span>`).join("")}</li>`;
    }).join("") +
    `</ul>`).join("");
}
async function openChangelog() {
  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";
  overlay.innerHTML = `
    <div class="popup cl-panel" tabindex="-1">
      <div class="popup-head"><span class="popup-title">Changelog</span><button class="popup-x" title="Close">✕</button></div>
      <div class="cl-body">${changelogGroups ? changelogHtml(changelogGroups) : `<div class="cl-empty">Loading…</div>`}</div>
    </div>`;
  document.body.appendChild(overlay);
  const release = pushBackClose(() => close());
  let closed = false;
  const close = () => { if (closed) return; closed = true; release(); overlay.remove(); };
  overlay.querySelector(".popup-x").onclick = close;
  overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
  overlay.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  overlay.querySelector(".cl-panel").focus();
  if (changelogGroups) return;
  const body = overlay.querySelector(".cl-body");
  try {
    changelogGroups = parseChangelog(await fetch("src/CHANGELOG.md").then((r) => r.text()));
  } catch (e) {
    if (!closed) body.innerHTML = `<div class="cl-empty">Couldn't load the release notes.</div>`;
    return;
  }
  if (!closed) body.innerHTML = changelogHtml(changelogGroups);
}

export { openChangelog };