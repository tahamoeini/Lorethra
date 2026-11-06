// Landing shell — the home/menu view's static DOM + pure nav-chrome behavior.
//
// Owns everything under `#landing` (nav frame, `#homeMain` mount pane) plus the global
// `#updateBanner` (top-of-page update notice, wired by update-check.js). main.js mounts these
// at the top of init() via ensureLandingShell() — index.html itself stays shell-free (splash +
// scripts + server plugin only) so a cold load never paints half-styled chrome.
//
// Rule of thumb: static markup, and behavior that touches ONLY landing DOM + localStorage,
// lives here. Anything data-driven (nav items from HOME_SECTIONS, page mounts, counts) stays
// in main.js and operates on the ids this file guarantees. This module imports only the
// dependency-free notify helper (no cycles: notify.js imports nothing).

import { notify } from "./notify.js";
import { ICON_FS_EXPAND, ICON_FS_COMPRESS, ICON_MONITOR, ICON_PHONE } from "./icons.js";

const UPDATE_BANNER_HTML = `<div id="updateBanner" hidden><span class="ub-dot"></span><span class="ub-txt">A new version is available.</span><button id="updateReloadBtn" type="button">Reload</button><button id="updateDismissBtn" type="button" title="Dismiss">✕</button></div>`;

// Byte-identical to the old index.html `#landing` inner markup (so styles.css applies unchanged),
// except the logo now carries width/height: its size used to come only from styles.css, so a cold
// load painted it gigantic before the stylesheet arrived.
const LANDING_HTML = `
  <div id="ldBg"></div>
  <div id="ldScrim"></div>
  <button id="homeNavToggle" type="button" title="Menu" aria-label="Open menu" aria-expanded="false"><span class="hn-burger"></span></button>
  <div id="homeShell">
    <nav id="homeNav" role="navigation" aria-label="Main menu">
      <div class="hn-head">
        <span class="hn-brand" id="homeNavBrand"><img src="src/images/logo.svg" alt="" class="hn-logo" width="30" height="30"><span class="hn-brandtext"></span></span>
        <button class="hn-collapse" id="homeNavCollapse" type="button" title="Collapse menu" aria-expanded="true"><span class="hn-c-out">«</span><span class="hn-c-in">»</span></button>
      </div>
      <div class="hn-list" id="homeNavList"></div>
      <div class="hn-list hn-util-list" id="homeNavUtil"></div>
      <div class="hn-foot">
        <div class="hn-foot-actions">
          <button class="hn-foot-btn hn-foot-icon" id="hnFullscreenBtn" type="button" title="Fullscreen" aria-label="Fullscreen"></button>
          <button class="hn-foot-btn hn-foot-icon" id="hnInstallBtn" type="button" title="Install as an app on your device" aria-label="Install app"><span class="hn-foot-ic" id="hnInstallIc" aria-hidden="true"></span></button>
        </div>
        <div class="hn-info">
          <div class="hn-credit"><span id="hnCreditName"></span> by mnomno</div>
          <div class="hn-stats">Last edit: <span id="lastEditEl">…</span> &nbsp;|&nbsp; Views: <span id="viewCountEl">…</span></div>
        </div>
      </div>
    </nav>
    <div id="homeNavScrim"></div>
    <main id="homeMain" tabindex="-1"></main>
  </div>`;

// Create `#updateBanner` + `#landing` unless they already exist (idempotent — safe to call twice,
// e.g. a re-init). Returns the landing element.
export function ensureLandingShell() {
  if (!document.getElementById("updateBanner")) {
    document.body.insertAdjacentHTML("afterbegin", UPDATE_BANNER_HTML);
  }
  let landing = document.getElementById("landing");
  if (!landing) {
    landing = document.createElement("div");
    landing.id = "landing";
    landing.hidden = true;
    landing.innerHTML = LANDING_HTML;
    document.body.appendChild(landing);
  }
  return landing;
}

// Remove the boot splash once a real view (landing or session) is showing.
// Gated on styles.css actually being applied: main.js is a deferred module doing async boot
// work (kv reads, world loads), and on a slow/cold load it can finish BEFORE the stylesheet
// arrives — removing the splash then flashes unstyled content for a frame (unstyled toolbar
// buttons + a giant search magnifier: svg.hm-bic has no width/height attributes, its 15px size
// comes only from styles.css, so unstyled it defaults to 300px). So removal waits until every
// stylesheet link has a loaded sheet (a cross-origin sheet that throws on cssRules counts as
// loaded), with a 4s cap so a failed stylesheet can't hang the app on the splash forever.
// A double-rAF then lets the styled first frame paint underneath before the splash goes away.
// Returns a promise; callers need not await (removal is visual-only).
let bootSplashDismissed = false;
export function dismissBootSplash() {
  if (bootSplashDismissed) return Promise.resolve();
  bootSplashDismissed = true;
  const remove = () => {
    const splash = document.getElementById("bootSplash");
    if (splash) splash.remove();
  };
  const cssReady = () => {
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    if (!links.length) return true;
    for (const l of links) {
      try {
        if (!l.sheet) return false;
        try { void l.sheet.cssRules; } catch (e) { continue; } // cross-origin loaded sheet
      } catch (e) { return false; }
    }
    return true;
  };
  return new Promise((resolve) => {
    const done = () => {
      requestAnimationFrame(() => requestAnimationFrame(() => { remove(); resolve(); }));
    };
    if (cssReady()) { done(); return; }
    let finished = false;
    const finish = () => { if (!finished) { finished = true; clearTimeout(timer); done(); } };
    const timer = setTimeout(finish, 4000);
    try {
      for (const l of document.querySelectorAll('link[rel="stylesheet"]')) {
        l.addEventListener("load", () => { if (cssReady()) finish(); }, { once: true });
        l.addEventListener("error", finish, { once: true });
      }
    } catch (e) {}
    const poll = () => {
      if (finished) return;
      if (cssReady()) { finish(); return; }
      setTimeout(poll, 50);
    };
    setTimeout(poll, 50);
  });
}

// Fill the brand-dependent names from the generator title (rename-safe: no hard-coded copy).
// The footer credit repeats the brand, so it reads the same title rather than a second hard-coded
// copy of it — rename the generator and both lines move together.
export function setLandingBrand(title) {
  const brandText = document.getElementById("homeNavBrand")?.querySelector(".hn-brandtext");
  if (brandText) brandText.textContent = title;
  const creditName = document.getElementById("hnCreditName");
  if (creditName) creditName.textContent = title;
}

const $ = (id) => document.getElementById(id);

const HOME_NAV_PREF_KEY = "mno.homeNav";
// The rail is a drawer — not a pinned strip — on phones AND tablets (≤900px): there is no separate
// tablet layout. Used to decide whether the drawer's transient state may be persisted, and to force
// the drawer open (its collapse toggle is hidden there).
function isDrawerMode() { return window.matchMedia("(max-width: 900px)").matches; }

function homeNavPref() {
  try {
    const raw = localStorage.getItem(HOME_NAV_PREF_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p.collapsed === "boolean") return p.collapsed;
    }
  } catch (e) {}
  return false;
}

function persistHomeNav() {
  if (isDrawerMode()) return; // the drawer is transient — never persist its state
  try { localStorage.setItem(HOME_NAV_PREF_KEY, JSON.stringify({ collapsed: $("homeNav").classList.contains("collapsed") })); } catch (e) {}
}

// Wire the nav chrome (collapse toggle, phone drawer, scrim, arrow keys). Called once from init().
function bindHomeNav() {
  const nav = $("homeNav");
  const toggle = $("homeNavCollapse");
  const burger = $("homeNavToggle");
  const scrim = $("homeNavScrim");
  if (toggle) toggle.onclick = () => { nav.classList.toggle("collapsed"); updateHomeNavCollapseBtn(); applyRailTips(); persistHomeNav(); };
  if (burger) burger.onclick = () => { nav.classList.contains("open") ? closeHomeNav() : openHomeNav(); };
  if (scrim) scrim.onclick = closeHomeNav;
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("open")) { closeHomeNav(); if (burger) burger.focus(); }
  });
  // Arrow keys / Home / End walk the nav items. Works across both zones — the list is read in DOM
  // order (primary pages, then the util cluster, which holds Settings and the Changelog action).
  nav.addEventListener("keydown", (e) => {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const items = [...nav.querySelectorAll(".hn-item")];
    if (!items.length) return;
    const cur = items.indexOf(document.activeElement);
    let next;
    if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else if (e.key === "ArrowDown") next = cur < 0 ? 0 : Math.min(cur + 1, items.length - 1);
    else next = cur < 0 ? items.length - 1 : Math.max(cur - 1, 0);
    e.preventDefault();
    items[next].focus();
  });
  // The phone drawer is modal-ish: keep Tab inside it while it is open.
  nav.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || !nav.classList.contains("open")) return;
    const f = [...nav.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")]
      .filter((el) => !el.hidden && el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || !nav.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  // Crossing the drawer breakpoint must never leave a drawer open over the desktop layout, and the
  // drawer is always fully labelled (its collapse toggle is hidden), so entering it drops a stale
  // desktop "collapsed" state and leaving it restores the saved preference.
  if (window.matchMedia) {
    const mq = window.matchMedia("(max-width: 900px)");
    const on = () => {
      if (mq.matches) nav.classList.remove("collapsed");
      else { closeHomeNav(); nav.classList.toggle("collapsed", homeNavPref()); }
      updateHomeNavCollapseBtn();
      applyRailTips();
    };
    if (mq.addEventListener) mq.addEventListener("change", on);
    else if (mq.addListener) mq.addListener(on);
  }
  applyRailTips(); // every nav row carries data-tip (the Changelog action is rendered by renderHomeNav)
}

function openHomeNav() {
  const nav = $("homeNav");
  nav.classList.add("open");
  $("homeNavScrim").classList.add("show");
  $("homeNavToggle").setAttribute("aria-expanded", "true");
  const first = nav.querySelector(".hn-item");
  if (first) first.focus();
}

function closeHomeNav() {
  const nav = $("homeNav");
  if (!nav || !nav.classList.contains("open")) return;
  const burger = $("homeNavToggle");
  const inside = nav.contains(document.activeElement);
  nav.classList.remove("open");
  $("homeNavScrim").classList.remove("show");
  burger.setAttribute("aria-expanded", "false");
  if (inside && burger) burger.focus();
}

function updateHomeNavCollapseBtn() {
  const btn = $("homeNavCollapse");
  if (!btn) return;
  const collapsed = $("homeNav").classList.contains("collapsed");
  btn.title = collapsed ? "Expand menu" : "Collapse menu";
  btn.setAttribute("aria-expanded", String(!collapsed));
}

// Rail tooltips. Every rail item carries `data-tip` — its own name. The tooltip is shown ONLY while
// the rail has no labels (the icons are all you can see, so the name is the thing you can't read);
// when the labels are on screen the item explains itself and there is no tooltip at all.
//
// "Collapsed" is read off the label itself rather than the class, so the rule holds wherever the
// labels happen to be hidden (see `#homeNav .hn-lbl` in styles.css).
function railLabelsVisible() {
  const lbl = $("homeNav") && $("homeNav").querySelector(".hn-item .hn-lbl");
  return !!lbl && getComputedStyle(lbl).display !== "none";
}

function applyRailTips() {
  const nav = $("homeNav");
  if (!nav) return;
  const bare = !railLabelsVisible();
  nav.querySelectorAll("[data-tip]").forEach((el) => {
    if (bare) el.title = el.getAttribute("data-tip");
    else el.removeAttribute("title");
  });
}

function applyHomeNavPref() {
  // The drawer (≤900px) is always expanded — its collapse toggle is hidden — so a saved desktop
  // "collapsed" preference must not follow you into a phone/tablet drawer.
  $("homeNav").classList.toggle("collapsed", !isDrawerMode() && homeNavPref());
  closeHomeNav();
  updateHomeNavCollapseBtn();
  applyRailTips();
}

// Footer buttons (fullscreen + install-app). The install button and colophon ride inside `.hn-foot`
// and only ever show when the nav is expanded; the icon-only fullscreen toggle stays visible in
// both modes (collapsed: alone at the bottom under the foot's separator).
//
// The expand/compress glyphs mirror WD_FS_EXPAND_IC / WD_FS_COMPRESS_IC in main.js (drawn SVG,
// imported from icons.js).
const HN_FS_EXPAND_IC = ICON_FS_EXPAND;
const HN_FS_COMPRESS_IC = ICON_FS_COMPRESS;
// Install-button device glyphs: flat stroke icons in the same 15px style — a monitor on devices
// with a fine pointer, a smartphone on touch-only devices (imported from icons.js).
const HN_INSTALL_MONITOR_IC = ICON_MONITOR;
const HN_INSTALL_PHONE_IC = ICON_PHONE;
function bindHnFootActions() {
  const fsBtn = $("hnFullscreenBtn");
  if (fsBtn) {
    const sync = () => {
      const on = !!document.fullscreenElement;
      fsBtn.innerHTML = on ? HN_FS_COMPRESS_IC : HN_FS_EXPAND_IC;
      fsBtn.setAttribute("aria-pressed", String(on));
      fsBtn.setAttribute("aria-label", on ? "Exit fullscreen" : "Fullscreen");
      fsBtn.title = on ? "Exit fullscreen" : "Fullscreen";
    };
    fsBtn.onclick = async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen().catch(() => {});
      } catch (e) {}
    };
    document.addEventListener("fullscreenchange", () => { if (fsBtn.isConnected) sync(); });
    sync();
  }
  const instBtn = $("hnInstallBtn");
  if (instBtn) {
    // Device glyph: monitor vs smartphone, swapped live if the pointer profile changes.
    const instIc = $("hnInstallIc");
    const paintInstIc = () => {
      const touchOnly = window.matchMedia("(pointer: coarse)").matches
        && window.matchMedia("(hover: none)").matches;
      if (instIc) instIc.innerHTML = touchOnly ? HN_INSTALL_PHONE_IC : HN_INSTALL_MONITOR_IC;
    };
    paintInstIc();
    if (window.matchMedia) {
      const mq = window.matchMedia("(pointer: coarse)");
      const onMq = () => paintInstIc();
      if (mq.addEventListener) mq.addEventListener("change", onMq);
      else if (mq.addListener) mq.addListener(onMq);
    }
    // Same pattern as perchance.org/installable-app-demo — with one difference forced by the
    // platform: the generator runs inside a cross-origin iframe, and `beforeinstallprompt` only
    // ever fires on the top-level page, so waiting for it here would hide the button forever.
    // The button is always shown instead: when the browser does offer a prompt we use it,
    // otherwise we point at the browser menu's own Install / Add-to-Home-Screen entry.
    const isApp = () => window.matchMedia("(display-mode: standalone)").matches
      || window.matchMedia("(display-mode: fullscreen)").matches
      || window.navigator.standalone === true;
    if (isApp()) {
      instBtn.hidden = true;
    } else {
      // Prefer the event stashed by boot.js (it listens from parse time, so it never loses the
      // platform's one-shot re-dispatch); fall back to a late listener in case this ever runs
      // before boot.js, e.g. under tooling that reorders scripts.
      let deferred = window.__mnoInstallEvent || null;
      window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault();
        if (isApp()) return;
        deferred = e;
        window.__mnoInstallEvent = e;
      });
      instBtn.onclick = async () => {
        if (deferred) {
          try { await deferred.prompt(); } catch (e) {}
          deferred = null;
          window.__mnoInstallEvent = null;
          return;
        }
        notify("To install: open the browser menu (⋮) → Install / Add to Home Screen (iPhone: Share → Add to Home Screen).");
      };
      window.addEventListener("appinstalled", () => { deferred = null; instBtn.hidden = true; });
    }
  }
}

export { bindHomeNav, openHomeNav, closeHomeNav, applyHomeNavPref, applyRailTips, bindHnFootActions };