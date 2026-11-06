// ============================================================================
// tag-row.js — a world's tag row: the chips, and the one-line fit.
// ----------------------------------------------------------------------------
// Every card in the app (library, added-from-catalog, Explore, the world picker, the world detail
// popups) draws a world's tags as one fixed-height row of chips. That row is shared code, in one
// place, because it has two rules that must agree everywhere:
//
//   1. ORDER — the world's "special" markers lead the row, before the author's own tags: the adult
//      rating (`nsfw`, dark red) and fork provenance (`remix`, dark purple). Both are derived from a
//      world FIELD via world.js's isNsfwMeta/isRemixMeta — never from an author tag — and because
//      they lead they can never be the chips the one-line clip hides.
//
//   2. FIT — the row is a single visible line (`.ld-wtags` is a fixed-height, overflow-hidden
//      flex-wrap strip; a second line would change the card's height, so it's clipped). Chips that
//      don't fit are therefore invisible unless something says so, which `fitTagRow` does: it
//      measures the row after layout and, when the chips wrap, drops the tail and appends one `…`
//      chip whose tooltip lists the hidden tags. `fitTagRows` runs the pass over a document, a rAF
//      coalesces a whole render batch into one pass, and the MutationObserver picks up rows as cards
//      are appended (cards are emitted as HTML strings, so the DOM is the only record of a new row).
//
// The `.ld-wtag` classes live in styles.css next to the row itself.
// ============================================================================

import { isReservedTag } from "./world.js";

// Chips and their tooltips are emitted as HTML strings. Tooltips quote the source world's title
// ("Remix of \"Neon Rain\" by @ann"), so quotes MUST be escaped too — an unescaped `"` closes the
// title attribute early and spills the rest of the words into the element as bogus attributes.
const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/* ---------------------------------------------------------------------------
 * chips
 * ------------------------------------------------------------------------- */

// One chip's HTML. `tag` (when given) turns the chip into a tag-filter SHORTCUT: it becomes a real
// <button> carrying `data-tag`, so a panel can delegate clicks on the row (main.js's
// filterWorldsByTag, community.js's Explore facets). Delegation, not a listener per chip: the
// one-line fit pass rewrites a row's HTML, which would take per-chip listeners with it.
function chipHtml(cls, label, title, tag) {
  const t = title ? ` title="${esc(title)}"` : "";
  if (!tag) return `<span class="ld-wtag${cls}"${t}>${esc(label)}</span>`;
  return `<button type="button" class="ld-wtag ld-wtag-btn${cls}" data-tag="${esc(tag)}"${t}>${esc(label)}</button>`;
}

// One special marker chip. `kind` is "nsfw" (the adult rating) or "remix" (fork provenance); the
// label is the marker's own name, so it reads the same as the reserved tag it stands for. `title` is
// the tooltip — callers pass the richer wording when they know it (who the original remix is by).
// `clickable` makes it a shortcut into that marker's filter, like any other tag chip.
export function specialChipHtml(kind, title, clickable) {
  const nsfw = kind === "nsfw";
  const cls = nsfw ? " ld-wtag-nsfw" : " ld-wtag-remix";
  const tip = title || (nsfw ? "Adult content" : "A remix — an editable copy forked from another world");
  return chipHtml(cls, nsfw ? "nsfw" : "remix", tip, clickable ? (nsfw ? "nsfw" : "remix") : "");
}

// The whole chip list, as HTML: specials first (nsfw, then remix), then the author's tags. `opts` is
// `{ nsfw, remix, remixTitle, clickable }` — the two marker booleans (computed by the caller from the
// world's meta via isNsfwMeta/isRemixMeta), an optional tooltip for the remix chip, and `clickable`
// to make every chip a tag-filter shortcut. A reserved marker tag still sitting in `tags` (a
// legacy/hand-written file) is skipped here: the field owns it, and drawing it twice is exactly what
// the reserved-tag filter exists to prevent.
export function tagChipsHtml(tags, opts = {}) {
  const out = [];
  if (opts.nsfw) out.push(specialChipHtml("nsfw", "", opts.clickable));
  if (opts.remix) out.push(specialChipHtml("remix", opts.remixTitle, opts.clickable));
  for (const t of tags || []) {
    if (isReservedTag(t)) continue;
    out.push(chipHtml("", t, opts.clickable ? `Only worlds tagged “${t}”` : "", opts.clickable ? t : ""));
  }
  return out.join("");
}

/* ---------------------------------------------------------------------------
 * one-line fit
 * ------------------------------------------------------------------------- */

// What we remember about a row: its full chip list (HTML + labels, captured from the DOM the first
// time we see the row — the callers emit rows as HTML strings, so there's nowhere else to read it
// from) and the width it was last fitted at, so an unchanged row is never rewritten.
const rowState = new WeakMap();

// Fires when a row's own box changes size — the ONE trigger a window `resize` listener can't see.
// Collapsing the nav rail (or a scrollbar appearing) reflows every card without the viewport
// changing, so a row fitted at the old width would keep a stale `…`. Assigned below; a row is
// observed the first time `fitTagRow` sees it, and unobserved when its subtree leaves the document.
let rowObserver = null;
const unobserveRow = (row) => { rowObserver?.unobserve(row); rowState.delete(row); };

const overflowing = (row) => row.scrollHeight - row.clientHeight > 1;

// The chip that stands in for everything that didn't fit; its tooltip lists the hidden tags.
function moreChipHtml(hidden) {
  return `<span class="ld-wtag ld-wtag-more" title="Also tagged: ${esc(hidden.join(", "))}">…</span>`;
}

// Fit ONE tag row to its single visible line. Idempotent: the row is rebuilt from the full list and
// re-measured whenever its width changes (a resize reflows every card), and left alone otherwise.
export function fitTagRow(row) {
  if (!row || !row.children) return;
  if (row.classList.contains("wd-tags")) {
    const st = rowState.get(row);
    if (st) {
      row.innerHTML = st.full.join("");
      rowState.delete(row);
    }
    unobserveRow(row);
    return;
  }
  let st = rowState.get(row);
  if (!st) {
    const kids = [...row.children];
    if (!kids.length) return;
    st = { full: kids.map((c) => c.outerHTML), labels: kids.map((c) => (c.textContent || "").trim()) };
    rowState.set(row, st);
    rowObserver?.observe(row);
  }
  const width = row.clientWidth;
  if (!width) return; // not laid out (hidden page/pane) — leave it for a later pass
  if (st.fitted && st.width === width) return;
  st.width = width;
  st.fitted = true;
  row.innerHTML = st.full.join("");
  if (!overflowing(row)) return;
  // Drop the tail one chip at a time until what's left — plus the `…` chip — fits on the line.
  for (let keep = st.full.length - 1; keep >= 1; keep--) {
    row.innerHTML = st.full.slice(0, keep).join("") + moreChipHtml(st.labels.slice(keep));
    if (!overflowing(row)) return;
  }
  row.innerHTML = moreChipHtml(st.labels);
}

// Fit every tag row under `root` (the whole document by default). Reads only — a row already fitted
// at its current width is skipped without touching the DOM.
export function fitTagRows(root = document) {
  if (!root || !root.querySelectorAll) return;
  for (const row of root.querySelectorAll(".ld-wtags:not(.wd-tags)")) fitTagRow(row);
}

// Coalesce any number of "a row may need fitting" signals into one pass on the next frame, so a
// batch of 24 freshly-appended cards is measured once, after the grid has its final column widths.
let scheduled = false;
export function scheduleTagFit() {
  if (scheduled) return;
  scheduled = true;
  const run = () => { scheduled = false; fitTagRows(); };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
  else setTimeout(run, 0);
}

// Watch for rows entering the document (any render path, including the grid's incremental "Show
// more"), re-fit a row whose own box changes size (a reflow that isn't a window resize), un-observe
// rows as their subtree leaves the document, and re-fit everything after a window resize. The
// observer filters hard: only an added/or removed element that IS a tag row or contains one is
// acted on, so the chat's constant DOM churn never triggers a sweep. Rows the fit itself rewrites
// are plain chips — not rows — so no loop.
if (typeof MutationObserver === "function" && typeof document !== "undefined") {
  const touchesRows = (node) => node.nodeType === 1 && (node.classList.contains("ld-wtags") || !!node.querySelector(".ld-wtags"));
  const obs = new MutationObserver((records) => {
    for (const r of records) {
      for (const node of r.addedNodes) {
        if (touchesRows(node)) { scheduleTagFit(); return; }
      }
      for (const node of r.removedNodes) {
        if (!touchesRows(node)) continue;
        if (node.classList.contains("ld-wtags")) unobserveRow(node);
        else for (const el of node.querySelectorAll(".ld-wtags")) unobserveRow(el);
      }
    }
  });
  obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
  if (typeof ResizeObserver === "function") {
    rowObserver = new ResizeObserver((entries) => {
      for (const e of entries) if (e.target.isConnected) fitTagRow(e.target);
    });
    // Rows rendered before this module hooked in (none in practice — the import runs first) still get
    // observed on the next pass.
    scheduleTagFit();
  }
  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(scheduleTagFit, 150);
  });
}
