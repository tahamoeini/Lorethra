// App (session/chat) shell — the in-chat view's static DOM + rail-tab chrome.
//
// Owns `#app` (rails, topbar, trackerbar, transcript, composer) and the `#railScrim` overlay,
// plus the rail-tab descriptors (RAIL_SECTIONS / VALID_SECS / renderRailTabs) and the shared
// section-icon helper (secIconInner — also used by the landing nav items and page headers, which
// import it from here). Mounted by main.js at the top of init() via ensureAppShell().
//
// Like landing-shell.js: static markup and behavior touching ONLY app DOM lives here;
// session-driven rendering (transcript, panels, tracker chips) stays in main.js. This module
// imports nothing and nothing in it depends on main.js (no cycles).

// Quotes MUST be escaped too: this `esc` feeds quoted attributes in renderRailTabs' template.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

import { ICON_X_SM, ICON_MENU_SM, ICON_CHEV_LEFT_SM, ICON_SQUARES } from "./icons.js";

// Byte-identical to the old index.html `#app` inner markup (so styles.css applies unchanged),
// except the brand logo now carries width/height: its size used to come only from styles.css,
// so a cold load painted it gigantic before the stylesheet arrived.
const APP_HTML = `
  <div id="layout">
    <aside id="leftRail" class="rail collapsed">
      <div class="rail-head">
        <span class="rail-title" id="leftRailTitle"></span>
        <button class="rail-toggle" id="leftRailToggle" title="Expand left panel"><span class="rt-expand">${ICON_X_SM}</span><span class="rt-collapse">${ICON_MENU_SM}</span></button>
      </div>
      <div class="rail-tabs"></div>
      <div class="rail-body" id="leftRailBody"></div>
    </aside>

    <div id="mainCol">
      <div id="topbar">
        <button class="rail-open-btn" id="openLeftBtn" type="button" title="Open panels" aria-label="Open left panels">☰</button>
        <button id="homeBtn" type="button" title="Back to main menu" aria-label="Back to main menu">${ICON_CHEV_LEFT_SM}</button>
        <span id="brand" title="Back to main menu"><img src="src/images/logo.svg" alt="" class="brand-logo" draggable="false" width="25" height="25"><span class="brand-text"></span></span>
        <span id="sessionTitleEl"></span>
        <span id="turnCountEl"></span>
        <button class="rail-open-btn" id="openRightBtn" type="button" title="Open panels" aria-label="Open right panels">${ICON_SQUARES}</button>
      </div>
      <div id="trackerbar">
        <div id="trackerbarChips"></div>
        <button id="trackerToggleBtn" type="button" aria-expanded="false" hidden></button>
        <button id="trackerNavPrev" type="button" class="trk-nav prev" aria-label="Scroll trackers left" title="Scroll trackers left" tabindex="-1" hidden>‹</button>
        <button id="trackerNavNext" type="button" class="trk-nav next" aria-label="Scroll trackers right" title="Scroll trackers right" tabindex="-1" hidden>›</button>
      </div>
      <div id="transcriptEl"></div>
      <div id="composerTip"><span class="ct-tx"><strong>💡 Tips:</strong> Type your actions in plain text. <span class="ct-q">&quot;Speak in quotes.&quot;</span></span><button type="button" class="ct-x" id="composerTipHide">Don't show this again</button></div>
      <div id="composer">
        <div id="cmdWrap">
          <button id="plusBtn" title="Commands">⋮</button>
          <div id="cmdMenu" hidden></div>
        </div>
        <button id="sceneBtn" title="Scene image">🎨</button>
        <textarea id="inputEl" rows="1"></textarea>
        <button id="sendBtn" title="Send">➤</button>
        <button id="scrollBottomBtn" type="button" title="Jump to latest" aria-label="Jump to latest" hidden>▼</button>
      </div>
    </div>

    <aside id="rightRail" class="rail collapsed">
      <div class="rail-head">
        <span class="rail-title" id="rightRailTitle"></span>
        <button class="rail-toggle" id="rightRailToggle" title="Expand right panel"><span class="rt-expand">${ICON_X_SM}</span><span class="rt-collapse">${ICON_SQUARES}</span></button>
      </div>
      <div class="rail-tabs"></div>
      <div class="rail-body" id="rightRailBody"></div>
    </aside>
  </div>`;

const RAIL_SCRIM_HTML = `<div id="railScrim"></div>`;

// Create `#app` + `#railScrim` unless they already exist (idempotent). Returns the app element.
export function ensureAppShell() {
  let app = document.getElementById("app");
  if (!app) {
    app = document.createElement("div");
    app.id = "app";
    app.hidden = true;
    app.innerHTML = APP_HTML;
    document.body.appendChild(app);
  }
  if (!document.getElementById("railScrim")) {
    document.body.insertAdjacentHTML("beforeend", RAIL_SCRIM_HTML);
  }
  return app;
}

// Floating Tavern button — a draggable FAB over every page (replaces the old static 💬
// topbar button) wearing the Tavern's board-sign mark. Pure DOM: no main.js dependency,
// so it lives here with the rest of the app shell. It hangs off document.body (NOT #app,
// which hides on the landing), so it survives landing ↔ session switches; visibility is
// the per-browser `tavernFabOn` pref (on by default). Position persists per browser; a
// press that moves is a drag, never a click. Opt-in (off by default) via the
// `tavernFabOn` pref — toggled from the Tavern config panel or Settings →
// Interface. Click wiring is main.js's (it owns the panel).
const TAVERN_FAB_POS_KEY = "tavernFabPos";
const TAVERN_FAB_ON_KEY = "tavernFabOn";
export function tavernFabEnabled() {
  try { return localStorage.getItem(TAVERN_FAB_ON_KEY) === "1"; } catch (e) { return false; }
}
export function setTavernFabEnabled(on) {
  const v = !!on;
  try { localStorage.setItem(TAVERN_FAB_ON_KEY, v ? "1" : "0"); } catch (e) {}
  try { const fab = document.getElementById("tavernFab"); if (fab) fab.hidden = !v; } catch (e) {}
  return v;
}
export function ensureTavernFab() {
  let fab = document.getElementById("tavernFab");
  if (fab) { try { fab.hidden = !tavernFabEnabled(); } catch (e) {} return fab; }
  // On document.body so it shows over landing pages too (fixed positioning is
  // still viewport-relative); the pref decides whether it starts visible.
  const host = document.body;
  fab = document.createElement("button");
  fab.id = "tavernFab";
  fab.type = "button";
  fab.title = "Tavern";
  fab.setAttribute("aria-label", "Open tavern");
  try { fab.hidden = !tavernFabEnabled(); } catch (e) {}
  // NOTE: this url() is written relative to src/styles.css, NOT this file or the page:
  // --sec-ic is consumed by a mask: rule in styles.css, so the platform resolves it against
  // the stylesheet (→ https://perchance.org/src/images/…). Prefixing src/ here double-resolves
  // to /src/src/… and breaks every mask icon. Same rule for all iconImg paths.
  fab.innerHTML = `<span class="sec-ic" style="--sec-ic:url('images/icon-board.png')" aria-hidden="true"></span><span class="fab-pip" hidden></span>`;
  const S = 48, M = 12; // button size + viewport margin
  const place = (x, y) => {
    x = Math.min(Math.max(M, x), Math.max(M, window.innerWidth - S - M));
    y = Math.min(Math.max(M, y), Math.max(M, window.innerHeight - S - M));
    fab.style.left = x + "px";
    fab.style.top = y + "px";
    return { x, y };
  };
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(TAVERN_FAB_POS_KEY) || "null"); } catch (e) {}
  let cur = (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y))
    ? place(saved.x, saved.y)
    : place(window.innerWidth - S - 16, window.innerHeight - S - 110);
  host.appendChild(fab);
  window.addEventListener("resize", () => { cur = place(cur.x, cur.y); });
  let pid = null, sx = 0, sy = 0, ox = 0, oy = 0, dragged = false;
  fab.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    try { delete fab.dataset.dragged; } catch (err) {}
    pid = e.pointerId; sx = e.clientX; sy = e.clientY; ox = cur.x; oy = cur.y; dragged = false;
    try { fab.setPointerCapture(pid); } catch (err) {}
  });
  fab.addEventListener("pointermove", (e) => {
    if (e.pointerId !== pid) return;
    if (!dragged && Math.hypot(e.clientX - sx, e.clientY - sy) < 6) return;
    dragged = true;
    cur = place(ox + e.clientX - sx, oy + e.clientY - sy);
  });
  fab.addEventListener("pointerup", (e) => {
    if (e.pointerId !== pid) return;
    pid = null;
    if (dragged) {
      try { localStorage.setItem(TAVERN_FAB_POS_KEY, JSON.stringify(cur)); } catch (err) {}
      // A press that moved is a drag, not a click — swallow the click that follows it
      // (cleared in the capture-phase click handler below, or on the next press).
      try { fab.dataset.dragged = "1"; } catch (err) {}
    }
  });
  fab.addEventListener("pointercancel", () => { pid = null; });
  fab.addEventListener("click", (e) => {
    if (fab.dataset.dragged) {
      e.stopPropagation();
      e.preventDefault();
      try { delete fab.dataset.dragged; } catch (err) {}
    }
  }, true);
  return fab;
}

// Fill the topbar brand from the generator title. The logo is the part people aim at, and an
// `<img>` is draggable by default, so `draggable="false"` keeps the whole brand one click target
// (a click that slips a pixel would otherwise become a native image drag).
export function setAppBrand(title) {
  const brand = document.getElementById("brand");
  if (brand) brand.innerHTML = '<img src="src/images/logo.svg" alt="" class="brand-logo" draggable="false" width="25" height="25"><span class="brand-text">' + esc(title) + "</span>";
}

// The icon markup for a section: a mask-tinted PNG when the page ships an `iconImg`, else the emoji.
// Shared by the nav item and the page-header emblem so both stay in sync.
function secIconInner(sec) {
  return sec.iconImg
    ? `<span class="sec-ic" style="--sec-ic:url('${sec.iconImg}')"></span>`
    : esc(sec.icon);
}
/* ---------- collapsible side rails ---------- */
// Each rail panel's header title: `{ label, iconImg }` with the section's monochrome page mark (a PNG
// drawn through `.sec-ic`, exactly like `HOME_SECTIONS`), so the title goes through the same
// `secIconInner` the nav items and page emblems use. Every rail section now has a drawn mark, and it is
// the same picture on the tab, in the rail panel title, in the menu and on the page. (`secIconInner`
// still supports an `icon` emoji fallback for the menu's not-yet-drawn pages.)
const RAIL_SECTIONS = {
  menu: { label: "Menu", iconImg: "images/icon-logo.png" },
  session: { label: "Session", iconImg: "images/icon-session.png" },
  memory: { label: "Memories", iconImg: "images/icon-memory.png" },
  settings: { label: "Story", iconImg: "images/icon-chat.png" },
  character: { label: "Hero", iconImg: "images/icon-hero.png" },
  map: { label: "Map", iconImg: "images/icon-map.png" },
  npc: { label: "NPCs", iconImg: "images/icon-npc.png" },
  gallery: { label: "Gallery", iconImg: "images/icon-gallery.png" }
};
function renderRailTabs() {
  for (const side of ["left", "right"]) {
    const wrap = document.querySelector("#" + side + "Rail .rail-tabs");
    if (!wrap) continue;
    wrap.innerHTML = "";
    for (const sec of VALID_SECS[side]) {
      const t = RAIL_SECTIONS[sec];
      if (!t) continue;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rail-tab";
      b.dataset.side = side;
      b.dataset.sec = sec;
      b.title = t.label;
      b.innerHTML = `<span class="rt-ic">${secIconInner(t)}</span><span class="rt-label">${esc(t.label)}</span>`;
      wrap.appendChild(b);
    }
  }
}
// The old Adventures tab is gone from the left rail (it duplicated the Menu grid's Adventures
// button): the Menu's Adventures-in-this-world list is the in-chat shelf now. Stored prefs still
// naming `sessions` fall through `validSec` to the default, so nobody's rail breaks on update.
// The Session tab sits between Menu and Memories: the current chat's own shelf (the world it
// plays in, plus that world's saves). Stored prefs naming a retired tab (`sessions`) fall through
// `validSec` to the default, so nobody's rail breaks on update.
const VALID_SECS = { left: ["menu", "session", "memory", "settings"], right: ["character", "map", "npc", "gallery"] };

export { secIconInner, RAIL_SECTIONS, VALID_SECS, renderRailTabs };

// Enter sends on desktop, but on mobile Enter just inserts a newline (the keyboard's return key),
// so the hint differs by device. Single source of truth for the composer placeholder.
export const IS_MOBILE = window.matchMedia("(pointer: coarse)").matches;
export const INPUT_PLACEHOLDER = IS_MOBILE
  ? "What do you do?"
  : "What do you do? (Enter to send, Shift+Enter for newline)";
