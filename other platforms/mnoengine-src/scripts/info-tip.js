// info-tip.js — tap-friendly inline info tooltip (ⓘ), the shared helper for every
// "hover on desktop, tap on mobile" explanation affordance.
//
// Why this exists: native `title="…"` tooltips never appear on touch devices (no hover),
// and CSS-only `:hover` bubbles can't be opened by tap at all. This module gives every
// consumer the same robust behaviour through one tiny API:
//
//   import { initInfoTips, infoTipHtml } from "./info-tip.js";
//   initInfoTips(); // once, at boot — installs the delegated listeners (idempotent)
//   rowHtml = `<label>${esc(d.label)}${infoTipHtml(d.hint, { title: d.label })}</label>`;
//
// Behaviour contract (same for every consumer):
// - Desktop: hovering or keyboard-focusing the ⓘ shows the bubble; leaving / blurring hides it.
// - Touch: tapping the ⓘ pins the bubble open; tapping it again, tapping anywhere else,
//   scrolling it out of view, or pressing Escape dismisses it.
// Three anchor shapes (all delegated — pick what fits the surface, behaviour is identical):
// - `infoTipHtml()` — a standalone ⓘ icon button (one-off explanations).
// - `infoTipLabelHtml()` — the label text itself is the button, with a faint ⓘ marker
//   on touch devices only (dense rows like hero stats: no added chrome column, no underline).
// - bare container — just `class="info-tip"` + `data-tip`/`data-tip-title` on an existing
//   element (tracker chips/rows/bars): zero markup added, the element's own styling and
//   cursor are untouched, no icon at all.
// - Exactly one bubble exists (a single shared `div` appended to `document.body`), so an open
//   tip never multiplies, never clips inside a scrollable panel (`position: fixed`), and flips
//   above the icon when there is no room below (clamped to the viewport horizontally).
// - Accessible: the icon is a real `<button>` (`aria-expanded` tracks the bubble, `aria-label`
//   defaults to "About <title>" / "More info"), the bubble has `role="tooltip"`, and Escape closes it.
// - Zero per-render wiring: all listeners are delegated on `document`, so content that re-renders
//   (hero panel +/−, wizard point-buy) works without re-initialising. If the anchor icon is removed
//   by a re-render while open, the bubble hides itself.
//
// Content model: plain text by default (`data-tip` / `data-tip-title`). Pass `{ html: true }`
// (or the `data-tip-html` attribute) only for trusted markup the caller built itself — never for
// world/author text, which must stay escaped.

const escA = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let installed = false;
let bubble = null;   // the single shared tooltip node (created lazily, child of body)
let current = null;  // the anchor icon the bubble is currently shown for (null = hidden)
let pinned = false;  // true once the bubble was opened by tap/click (ignores hover-leave)
let placeQueued = false;

// Inline ⓘ button as an HTML string, for template-string renderers (hero panel, wizard).
// Returns "" when there is nothing to say, so callers can interpolate unconditionally.
// `tip` is plain text unless `opts.html` is true (then it must be trusted, pre-escaped markup).
function infoTipHtml(tip, opts = {}) {
  const t = String(tip ?? "");
  if (!t) return "";
  const title = String(opts.title ?? "");
  const label = String(opts.label ?? (title ? `About ${title}` : "More info"));
  const cls = opts.cls ? ` ${String(opts.cls)}` : "";
  const bodyAttr = opts.html ? `data-tip-html="${escA(t)}"` : `data-tip="${escA(t)}"`;
  return `<button type="button" class="info-tip info-tip-icon${cls}" ${bodyAttr}${title ? ` data-tip-title="${escA(title)}"` : ""} aria-label="${escA(label)}" aria-expanded="false">ⓘ</button>`;
}

// Same, as a DOM node (for DOM-building callers). Returns null when there is nothing to say.
function createInfoTip(tip, opts = {}) {
  const wrap = document.createElement("span");
  wrap.innerHTML = infoTipHtml(tip, opts);
  return wrap.firstElementChild;
}
// Full-label trigger (pattern A with a whisper of C): the label text itself opens the tip,
// with only a faint ⓘ on touch devices marking which labels have one — no underline,
// no per-row chrome column. The button is the anchor (class `info-tip`, so all delegated behaviour applies unmodified)
// and the arrow points at the label's centre. Plain escaped text when there is no tip.
function infoTipLabelHtml(label, tip, opts = {}) {
  const t = String(tip ?? "");
  const lab = String(label ?? "");
  if (!t) return `<span>${escA(lab)}</span>`;
  const title = String(opts.title ?? lab);
  const aLabel = String(opts.label ?? (title ? `About ${title}` : "More info"));
  const bodyAttr = opts.html ? `data-tip-html="${escA(t)}"` : `data-tip="${escA(t)}"`;
  return `<button type="button" class="info-tip info-tip-label" ${bodyAttr} data-tip-title="${escA(title)}" aria-label="${escA(aLabel)}" aria-expanded="false"><span>${escA(lab)}</span><span class="info-tip-glyph" aria-hidden="true">ⓘ</span></button>`;
}

function ensureBubble() {
  if (bubble) {
    // Re-attach if something pulled the node out from under us (nothing in the app does —
    // this only ever triggers in tests that clean the DOM between runs).
    if (!bubble.isConnected) document.body.appendChild(bubble);
    return bubble;
  }
  bubble = document.createElement("div");
  bubble.className = "info-tip-bubble";
  bubble.setAttribute("role", "tooltip");
  bubble.hidden = true;
  document.body.appendChild(bubble);
  return bubble;
}

function readTip(anchor) {
  const html = anchor.getAttribute("data-tip-html");
  if (html !== null && html !== "") return { html };
  return { text: anchor.getAttribute("data-tip") || "", title: anchor.getAttribute("data-tip-title") || "" };
}

// Position the visible bubble against `current`: below the icon, flipping above when there is
// no room, clamped into the viewport. Runs synchronously after unhiding so no frame ever
// paints the bubble at the wrong spot.
function place() {
  if (!bubble || bubble.hidden || !current) return;
  if (!current.isConnected) { hideInfoTip(); return; }
  const r = current.getBoundingClientRect();
  const gap = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const bw = bubble.offsetWidth;
  const bh = bubble.offsetHeight;
  let top = r.bottom + gap;
  let placement = "below";
  if (top + bh > vh - 8 && r.top - gap - bh >= 8) { top = r.top - gap - bh; placement = "above"; } // flip above
  top = Math.max(8, Math.min(top, Math.max(8, vh - bh - 8)));
  const left = Math.max(8, Math.min(r.left + r.width / 2 - bw / 2, Math.max(8, vw - bw - 8)));
  bubble.style.top = `${Math.round(top)}px`;
  bubble.style.left = `${Math.round(left)}px`;
  bubble.dataset.placement = placement;
  // Arrow spot: the icon's centre relative to the bubble, kept off the rounded corners.
  const ax = Math.max(14, Math.min(r.left + r.width / 2 - left, Math.max(14, bw - 14)));
  bubble.style.setProperty("--tip-arrow-x", `${Math.round(ax)}px`);
}

function schedulePlace() {
  if (placeQueued) return;
  placeQueued = true;
  requestAnimationFrame(() => { placeQueued = false; place(); });
}

function show(anchor, { pin = false } = {}) {
  const b = ensureBubble();
  const tip = readTip(anchor);
  if (!tip.text && !tip.html) return false;
  if (tip.html) b.innerHTML = tip.html;
  else {
    b.textContent = "";
    if (tip.title) {
      const h = document.createElement("div");
      h.className = "info-tip-title";
      h.textContent = tip.title;
      b.appendChild(h);
    }
    const p = document.createElement("div");
    p.className = "info-tip-body";
    p.textContent = tip.text;
    b.appendChild(p);
  }
  if (current && current !== anchor) current.setAttribute("aria-expanded", "false");
  current = anchor;
  pinned = pin;
  anchor.setAttribute("aria-expanded", "true");
  b.hidden = false;
  place();
  return true;
}

function hideInfoTip() {
  if (current) current.setAttribute("aria-expanded", "false");
  current = null;
  pinned = false;
  if (bubble && !bubble.hidden) bubble.hidden = true;
}

function anchorOf(e) {
  const t = e.target;
  if (!t || typeof t.closest !== "function") return null;
  return t.closest(".info-tip");
}

// Install the delegated listeners. Safe to call more than once (only the first call binds).
function initInfoTips() {
  if (installed) return;
  installed = true;
  const hoverable = () => window.matchMedia && window.matchMedia("(hover: hover)").matches;

  // Desktop hover: open on entry, close on leave — hover-capable pointers only, so touch
  // taps never fight the pinned state through emulated mouse events.
  document.addEventListener("mouseover", (e) => {
    if (!hoverable() || pinned) return;
    const a = anchorOf(e);
    if (!a || a === current) return;
    if (e.relatedTarget && a.contains(e.relatedTarget)) return;
    show(a);
  });
  document.addEventListener("mouseout", (e) => {
    if (pinned || !current) return;
    const a = anchorOf(e);
    if (!a || a !== current) return;
    if (e.relatedTarget && a.contains(e.relatedTarget)) return;
    hideInfoTip();
  });

  // Keyboard: focus shows, blur hides (unless pinned open by a click in between).
  document.addEventListener("focusin", (e) => {
    if (pinned) return;
    const a = anchorOf(e);
    if (a && a !== current) show(a);
  });
  document.addEventListener("focusout", (e) => {
    if (pinned || !current) return;
    const a = anchorOf(e);
    if (a && a === current) hideInfoTip();
  });

  // Tap / click: toggle the pinned state. This is THE mobile path (no hover there).
  document.addEventListener("click", (e) => {
    const a = anchorOf(e);
    if (!a) return;
    if (current === a && pinned) hideInfoTip();
    else show(a, { pin: true });
  });

  // Dismiss: outside tap, Escape, or the anchor scrolling away / being re-rendered.
  document.addEventListener("pointerdown", (e) => {
    if (!current) return;
    const t = e.target;
    if (current.contains(t)) return;
    if (bubble && bubble.contains(t)) return;
    hideInfoTip();
  }, true);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && current) hideInfoTip();
  });
  document.addEventListener("scroll", () => { if (current) schedulePlace(); }, { capture: true, passive: true });
  window.addEventListener("resize", () => { if (current) schedulePlace(); }, { passive: true });
  // Re-renders replace the anchor node (hero +/−, wizard point-buy): never point at a dead node.
  new MutationObserver(() => { if (current && !current.isConnected) hideInfoTip(); })
    .observe(document.body, { childList: true, subtree: true });
}

export { initInfoTips, infoTipHtml, infoTipLabelHtml, createInfoTip, hideInfoTip };
