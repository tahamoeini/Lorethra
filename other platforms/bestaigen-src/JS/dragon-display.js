/* ============================================================================
   🖼️ DISPLAY-MODE CONTROL — ONE definition, ONE builder, TWO panels.
   (Egon 23.09.2026, rule "büyük bardaklardaki su kuralı" / the big-cup rule.)

   WHY THIS FILE EXISTS: the public gallery and the private (vault) gallery each
   had their OWN display-mode button + dropdown, and the two menus had drifted
   apart (6 rows on the public side, 7 on the private side, different fallbacks).
   Two cups, same water. This file is the BIG CUP: the 11 modes, their labels, the
   default mode and the button/dropdown itself are defined ONCE here, and each
   gallery only pours in its own `onPick` callback (the one thing that really must
   differ, because the two galleries are different DOM trees).

   The 11 modes (identical rows, identical order, in BOTH panels):
     justified — equal-height rows, filled edge to edge, nothing cropped
     default   — stock look: equal-height rows at each picture's own width,
                 so the right edge is ragged (nothing stretched, nothing cropped)
     pinterest — TRUE masonry (round-robin columns, left-to-right order, no gaps)
     puzzle    — perfect equal-height rows, mirrored (first row right-to-left),
                 each row closing exactly; the order is relaxed to close a row
     mosaic    — the same perfect fill, but the order is a seeded RANDOM shuffle
     mixed     — Packery/Muuri-style block grid (1x1 / 2x1 / 1x2 / 2x2), no holes
     masonry   — CSS multi-column: every picture keeps its shape, top-to-bottom
     original  — the picture at its own ratio in the fixed tile columns
     cover     — fill the square tile (cropped)  (DEFAULT)
     contain   — the whole picture inside the square tile
     stretch   — fill the tile even if it distorts

   The four modes marked WALL (pinterest / puzzle / mosaic / mixed) are
   packed in JS by the shared engine in src/dragon-layouts.js and drawn with absolute
   rectangles, so the DOM order — and therefore the lightbox order, the tile numbers
   and the lazy load — never changes. WALL_MODES below is the one list both galleries
   ask before they touch a tile.

   Every gallery gets the control through window.dragonDisplayBuild({getMode,
   onPick, zIndex}) which returns {wrap, btn, menu, sync, close}.
   Adding/renaming a mode is now a ONE-LINE change here — the two panels can never
   drift apart again (the `display-twin` check-up test asserts the menus match this
   table row for row, and `tile-walls` measures the four wall modes on the live wall).
   ========================================================================== */
(function () {
  "use strict";

  // [ id, label shown in the dropdown ] — order is the menu order in both panels.
  var MODES = [
    ["justified", "Justified \u2014 Equal-Height Rows (no crop, no gaps)"],
    ["default",   "Default \u2014 Stock Look (natural rows, ragged edge)"],
    ["pinterest", "Pinterest \u2014 True Column Packing (left-to-right order)"],
    ["puzzle",    "Puzzle \u2014 Perfect Rows, Right-to-Left (no gaps)"],
    ["mosaic",    "Mosaic \u2014 Random Perfect Fill (no gaps)"],
    ["mixed",     "Mixed \u2014 Big & Small Blocks (aligned, cropped)"],
    ["masonry",   "Columns \u2014 CSS Columns, Top-to-Bottom Order"],
    ["original",  "Original \u2014 True Native Pixel Size (never upscaled)"],
    ["cover",     "Crop \u2014 Fill The Square Tile (Cropped) \u00B7 DEFAULT"],
    ["contain",   "Fit \u2014 Show The Whole Image"],
    ["stretch",   "Stretch \u2014 Fill The Tile (may distort)"]
  ];
  var LABELS = {
    justified: "Justified", default: "Default", pinterest: "Pinterest", puzzle: "Puzzle",
    mosaic: "Mosaic", mixed: "Mixed", masonry: "Columns",
    original: "Original", cover: "Crop", contain: "Fit", stretch: "Stretch"
  };
  // 🧩 Egon 23.09.2026 — the five WALL modes whose geometry comes from the shared
  // packer (src/dragon-layouts.js) instead of CSS. Both galleries ask this list
  // before they touch a tile, so neither can half-support a mode.
  var WALL_MODES = ["pinterest", "puzzle", "mosaic", "mixed"];
  // 🖼️ Egon 23.09.2026 — Justified ships as the default look ("because it's more modern").
  var DEFAULT_MODE = "cover";

  ;function isMode(v) {
    for (var i = 0; i < MODES.length; i++) { if (MODES[i][0] === v) return true; }
    return false;
  }
  ;function label(v) { return LABELS[v] || LABELS[DEFAULT_MODE]; }
  ;function modeIds() { return MODES.map(function (m) { return m[0]; }); }

  // The button + dropdown. Both panels call this; only `onPick` differs.
  ;function build(opts) {
    opts = opts || {};
    var wrap = document.createElement("span");
    wrap.style.cssText = "position:relative; display:inline-flex; align-items:center;";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.title = "Image Display Mode";
    // 22x22 square, teal — the standard box of the buttons beside it in both toolbars.
    btn.style.cssText = "width:22px; height:22px; padding:0; box-sizing:border-box; border:1px solid #3ec9b0; background:linear-gradient(180deg,#0e2522,#081411); color:#6fe0cf; border-radius:7px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; font-size:.85rem; flex:0 0 auto;";
    var menu = document.createElement("div");
    menu.className = "dragon-menu-card dragon-menu-scroll";
    menu.style.cssText = "position:absolute; top:100%; left:50%; transform:translateX(-50%); margin-top:2px; z-index:" + (opts.zIndex || 99) + "; display:none; flex-direction:column; gap:2px; background:#10131a; border:1px solid #5a5a6a; border-radius:6px; padding:3px; min-width:10.5rem; box-shadow:0 6px 18px rgba(0,0,0,.55);";
    var rows = [];
    MODES.forEach(function (m) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = m[1];
      b.dataset.disp = m[0];
      b.style.cssText = "display:flex; align-items:center; justify-content:flex-start; gap:.35rem; font-size:.72rem; padding:.2rem .5rem; border:1px solid transparent; background:transparent; color:#eee; border-radius:5px; cursor:pointer; white-space:normal; text-align:left;";
      b.onmouseenter = function () { if (!b.classList.contains("dragon-menu-on")) b.style.background = "#2a2a35"; };
      b.onmouseleave = function () { if (!b.classList.contains("dragon-menu-on")) b.style.background = "transparent"; };
      b.onclick = function (e) {
        e.stopPropagation();
        close();
        try { opts.onPick(m[0]); } catch (e2) {}
        sync();
      };
      menu.appendChild(b);
      rows.push(b);
    });
    ;function sync() {
      var cur = "";
      try { cur = opts.getMode(); } catch (e) {}
      if (!isMode(cur)) cur = DEFAULT_MODE;
      btn.textContent = "\uD83D\uDDBC\uFE0F";
      btn.title = "Image Display Mode \u2014 " + label(cur);
      for (var i = 0; i < rows.length; i++) {
        try { rows[i].classList.toggle("dragon-menu-on", rows[i].dataset.disp === cur); } catch (e) {}
      }
    }
    ;function close() { menu.style.display = "none"; }
    // The opening button of one menu closes every other registered dropdown (the app registers
    // its own dropdowns with dragonRegisterDropdown); menus never stack on top of each other.
    ;function openMenu() {
      var show = (menu.style.display !== "flex");
      try { if (typeof window.dragonCloseOtherDropdowns === "function") window.dragonCloseOtherDropdowns(close); } catch (e) {}
      menu.style.display = show ? "flex" : "none";
      if (show) sync();
    }
    btn.onclick = function (e) { e.stopPropagation(); openMenu(); };
    document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) close(); });
    wrap.append(btn, menu);
    sync();
    return { wrap: wrap, btn: btn, menu: menu, sync: sync, close: close, open: openMenu, rows: rows };
  }

  // 🖼️ ONE SELECTION FOR BOTH GALLERIES (Egon 26.09.2026, W-UI172 reopened by FEED-39). Each toolbar used to
  // keep its OWN key (public: dragonGalDisplay, private: dragonVaultDisplay), so picking Fit in one gallery
  // left the other one on its old look — the two menus carried the same rows but the choice was per gallery.
  // Both galleries now read and write through here: one pick moves both, and the two legacy keys stay in
  // lockstep because other code (and the check-up) still reads them directly.
  var SHARED_KEY = "dragonGalDisplayShared";
  var subs = [];
  ;function sharedGet() {
    try {
      var v = localStorage.getItem(SHARED_KEY);
      if (isMode(v)) return v;
      var p = localStorage.getItem("dragonGalDisplay");          // migration: the public key came first
      if (isMode(p)) return p;
      var q = localStorage.getItem("dragonVaultDisplay");
      if (isMode(q)) return q;
    } catch (e) {}
    return DEFAULT_MODE;
  }
  ;function sharedSet(v) {
    if (!isMode(v)) v = DEFAULT_MODE;
    try {
      localStorage.setItem(SHARED_KEY, v);
      localStorage.setItem("dragonGalDisplay", v);
      localStorage.setItem("dragonVaultDisplay", v);
    } catch (e) {}
    return v;
  }
  window.dragonDisplaySharedGet = sharedGet;
  window.dragonDisplaySharedSet = sharedSet;
  // A gallery subscribes once; every pick is emitted to the OTHER galleries in this document, and each
  // subscriber ignores the value it already shows, so one pick can never bounce back and forth.
  window.dragonDisplaySubscribe = function (fn) { if (typeof fn === "function" && subs.indexOf(fn) === -1) subs.push(fn); return fn; };
  window.dragonDisplayEmit = function (v) {
    for (var i = 0; i < subs.length; i++) { try { subs[i](v); } catch (e) {} }
    return v;
  };
  window.dragonDisplaySharedSetAndEmit = function (v) { return window.dragonDisplayEmit(sharedSet(v)); };

  var ZOOM_KEY = "dragonZoomShared", TILE_KEY = "dragonTileShared", TILE_MODE_KEY = "dragonTileMode", ZOOM_MODE_KEY = "dragonZoomMode";
  var ZOOM_MIN = 50, ZOOM_MAX = 200, ZOOM_DEF = 100;
  var TILE_MIN = 100, TILE_MAX = 800;
  function zoomNum(v) { v = Number(v); if (!isFinite(v)) return ZOOM_DEF; return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(v))); }
  function tileDeviceDef() { try { return (window.innerWidth || 1280) <= 760 ? 380 : 340; } catch (e) { return 340; } }
  function tileNum(v) { v = Number(v); if (!isFinite(v) || v <= 0) return tileDeviceDef(); return Math.max(TILE_MIN, Math.min(TILE_MAX, Math.round(v))); }
  function tileColsTarget() { try { return (window.innerWidth || 1280) <= 760 ? 2 : 4; } catch (e) { return 4; } }
  function tileAutoPx(w) {
    try {
      w = Number(w);
      if (!(w > 60)) w = window.innerWidth || 1280;
      return Math.max(TILE_MIN, Math.min(TILE_MAX, Math.round((w / tileColsTarget() - 8) / 10) * 10));
    } catch (e) { return tileDeviceDef(); }
  }
  function zoomGet() {
    try {
      if (localStorage.getItem(ZOOM_MODE_KEY) !== "manual") return ZOOM_DEF;
      var v = localStorage.getItem(ZOOM_KEY);
      if (v != null && v !== "") return zoomNum(v);
      var g = localStorage.getItem("dragonVaultGridZoom");
      if (g != null && g !== "") return zoomNum(g);
    } catch (e) {}
    return ZOOM_DEF;
  }
  var zoomSubs = {};
  function zoomEmit(v) { for (var k in zoomSubs) { try { zoomSubs[k](v); } catch (e) {} } return v; }
  function zoomModeGet() { try { return localStorage.getItem(ZOOM_MODE_KEY) === "manual" ? "manual" : "auto"; } catch (e) { return "auto"; } }
  function zoomSet(v) {
    v = zoomNum(v);
    try { localStorage.setItem(ZOOM_MODE_KEY, "manual"); localStorage.setItem(ZOOM_KEY, String(v)); localStorage.setItem("dragonVaultGridZoom", String(v)); } catch (e) {}
    return zoomEmit(v);
  }
  function zoomAuto() {
    try { localStorage.setItem(ZOOM_MODE_KEY, "auto"); } catch (e) {}
    return zoomEmit(ZOOM_DEF);
  }
  function tileModeGet() { try { return localStorage.getItem(TILE_MODE_KEY) === "manual" ? "manual" : "auto"; } catch (e) { return "auto"; } }
  function tilePxGet() { try { var v = localStorage.getItem(TILE_KEY); if (v != null && v !== "") return tileNum(v); } catch (e) {} return tileDeviceDef(); }
  var tileSubs = {};
  function tileEmit(st) { for (var k in tileSubs) { try { tileSubs[k](st); } catch (e) {} } return st; }
  function tileSetManual(px) {
    px = tileNum(px);
    try { localStorage.setItem(TILE_MODE_KEY, "manual"); localStorage.setItem(TILE_KEY, String(px)); } catch (e) {}
    return tileEmit({ mode: "manual", px: px });
  }
  function tileSetAuto() {
    try { localStorage.setItem(TILE_MODE_KEY, "auto"); } catch (e) {}
    return tileEmit({ mode: "auto", px: tilePxGet() });
  }
  window.dragonZoomSharedGet = zoomGet;
  window.dragonZoomSharedSet = zoomSet;
  window.dragonZoomSharedMode = zoomModeGet;
  window.dragonZoomAuto = zoomAuto;
  window.dragonZoomSubscribe = function (id, fn) { zoomSubs[id] = fn; };
  window.dragonZoomUnsubscribe = function (id) { try { delete zoomSubs[id]; } catch (e) {} };
  window.dragonTileSharedMode = tileModeGet;
  window.dragonTileSharedPx = tilePxGet;
  window.dragonTileSharedAutoPx = tileAutoPx;
  window.dragonTileSharedMin = TILE_MIN;
  window.dragonTileSharedMax = TILE_MAX;
  window.dragonTileSharedDef = tileDeviceDef;
  window.dragonTileManual = tileSetManual;
  window.dragonTileAuto = tileSetAuto;
  window.dragonTileSubscribe = function (id, fn) { tileSubs[id] = fn; };
  window.dragonTileUnsubscribe = function (id) { try { delete tileSubs[id]; } catch (e) {} };
  function tileVaultH(w) {
    try {
      if (tileModeGet() === "manual") return tileNum(tilePxGet());
      return tileAutoPx(w);
    } catch (e) { return tileDeviceDef(); }
  }
  window.dragonTileVaultH = tileVaultH;
  function autoBadge(el, main, isAuto) {
    try {
      if (!el) return;
      var b = el.__dragonAutoB;
      if (!b || !b.isConnected) {
        el.textContent = "";
        var m = document.createElement("span");
        b = document.createElement("span");
        b.textContent = "\u00B7 AUTO";
        b.style.cssText = "display:inline-block;min-width:3.4em;text-align:left;";
        var p1 = document.createElement("span");
        p1.textContent = "|";
        p1.style.cssText = "visibility:hidden;";
        var p2 = document.createElement("span");
        p2.textContent = "|";
        p2.style.cssText = "visibility:hidden;";
        el.append(m, document.createTextNode(" "), p1, document.createTextNode(" "), b, document.createTextNode(" "), p2);
        el.__dragonAutoB = b; el.__dragonAutoM = m;
      }
      el.__dragonAutoM.textContent = main;
      el.__dragonAutoB.style.visibility = isAuto ? "visible" : "hidden";
    } catch (e) { try { el.textContent = main; } catch (e2) {} }
  }
  window.dragonAutoBadge = autoBadge;
  function dragonSetTip(el, text) {
    try {
      if (!el) return;
      el.setAttribute("data-dragon-tip", text);
      el.removeAttribute("title");
    } catch (e) {}
  }
  window.dragonSetTip = dragonSetTip;
  function dragonStyleAllSelects(root) {
    try { (root || document).querySelectorAll("select").forEach(function (s) { dragonStyleSelect(s); }); } catch (e) {}
  }
  window.dragonStyleAllSelects = dragonStyleAllSelects;
  function dragonStyleSelect(s) {
    try {
      if (!s) return s;
      var st = s.style;
      st.appearance = "none";
      st.webkitAppearance = "none";
      try { s.className = (s.className ? s.className + " " : "") + "dragon-sel-themed"; } catch (eC) {}
      st.backgroundColor = "#23232f";
      var chev = "url(\"data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23ffd76a' stroke-width='1.8' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";
      try {
        st.setProperty("background-image", chev, "important");
        st.setProperty("background-repeat", "no-repeat", "important");
        st.setProperty("background-position", "right .5rem center", "important");
      } catch (eBg) {}
      st.border = "1px solid #7a6ab5";
      st.borderRadius = "8px";
      st.color = "#e8e0f0";
      st.cursor = "pointer";
      try { st.setProperty("padding-right", "1.7rem", "important"); } catch (eP) { st.paddingRight = "1.7rem"; }
    } catch (e) {}
    return s;
  }
  window.dragonStyleSelect = dragonStyleSelect;
  try {
    dragonStyleAllSelects(document);
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var ad = muts[i].addedNodes;
        for (var j = 0; j < ad.length; j++) {
          var n = ad[j];
          if (!n || n.nodeType !== 1) continue;
          if (n.tagName === "SELECT") dragonStyleSelect(n);
          else if (n.querySelectorAll) n.querySelectorAll("select").forEach(function (s) { dragonStyleSelect(s); });
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (eObs) {}
  window.dragonDisplayModes = MODES;
  window.dragonDisplayLabels = LABELS;
  window.dragonDisplayDefault = DEFAULT_MODE;
  window.dragonDisplayModeIds = modeIds;
  window.dragonDisplayIsMode = isMode;
  window.dragonDisplayLabel = label;
  window.dragonDisplayBuild = build;
  window.dragonDisplayWallModes = WALL_MODES;
  window.dragonDisplayIsWall = function (v) { return WALL_MODES.indexOf(v) !== -1; };
})();
