// dragon-ui-scale.js — moved VERBATIM out of index.html (Paket A1, 25.09.2026). Classic script
// (not a module), inserted at the same point of the boot order, so globals and ordering are unchanged.
// Rollback: paste this file's body back into index.html as a plain <script> at its old place.
(function () {
  var KEY_MODE = "dragonUiScaleMode";
  var KEY_VAL = "dragonUiScaleVal";
  var MIN = 0.7, MAX = 2.0, AUTO_CAP = 1.8, REF_W = 1200, REF_H = 750;

  ;function autoCompute() {
    var vw = window.innerWidth || 1280, vh = window.innerHeight || 800;
    if (vw <= 700) return 1;                      // phones/tablets keep the tuned mobile sizes
    var s = Math.sqrt((vw * vh) / (REF_W * REF_H));
    if (!isFinite(s) || s <= 0) return 1;
    s = Math.max(1, Math.min(AUTO_CAP, s));
    return Math.round(s * 100) / 100;
  }
  ;function clamp(v) { v = Number(v); if (!isFinite(v) || v <= 0) v = 1; return Math.max(MIN, Math.min(MAX, v)); }
  ;function apply(v) {
    v = clamp(v);
    window.__dragonUiScale = v;
    try { document.documentElement.style.setProperty("--dragon-ui-scale", String(v)); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent("dragon-ui-scale-changed", { detail: { scale: v, auto: isAuto() } })); } catch (e) {}
    return v;
  }
  ;function getMode() { try { return localStorage.getItem(KEY_MODE) || "auto"; } catch (e) { return "auto"; } }
  ;function setMode(m) { try { localStorage.setItem(KEY_MODE, m); } catch (e) {} }
  ;function isAuto() { return getMode() === "auto"; }
  ;function storedVal() { var v = NaN; try { v = parseFloat(localStorage.getItem(KEY_VAL)); } catch (e) {} return isFinite(v) ? clamp(v) : null; }

  window.dragonUiScaleGet = function () { return clamp(window.__dragonUiScale); };
  window.dragonUiScaleAuto = autoCompute;
  window.dragonUiScaleMax = MAX;
  // manual move: auto turns OFF and the value sticks.
  window.dragonUiScaleSet = function (v) {
    setMode("manual");
    var val = apply(v);
    try { localStorage.setItem(KEY_VAL, String(val)); } catch (e) {}
    return val;
  };
  window.dragonUiScaleAutoOn = function () { setMode("auto"); return apply(autoCompute()); };
  // turning auto OFF = fall back to the generator's existing default sizes (1.0)
  window.dragonUiScaleAutoOff = function () { setMode("manual"); try { localStorage.setItem(KEY_VAL, "1"); } catch (e) {} return apply(1); };
  window.dragonUiScaleReset = function () { return window.dragonUiScaleAutoOff(); };

  // "One control, several places": both gallery 🎚 Sliders menus (public + private) and the
  // Settings card build their slider rows from this single factory, so every copy looks and
  // behaves identically. A row = bold label + control + caller buttons + ℹ️ info button; the
  // matching info block is returned separately so the caller can place it under the row.
  // I59: nothing here changes size on hover/click. I53: dropdowns stay centered on their anchor.
  // cfg = { label, control, buttons:[], info, infoTitle }
  window.dragonSliderRow = function (cfg) {
    cfg = cfg || {};
    var row = document.createElement("div");
    row.style.cssText = "display:flex; align-items:center; justify-content:center; gap:.3rem; flex-wrap:wrap; text-align:center; font-family:inherit;";
    var label = document.createElement("span");
    label.style.cssText = "font-family:inherit; font-size:.72rem; color:#d8c9ff; min-width:5.8rem; text-align:center; font-weight:bold; white-space:nowrap;";
    label.textContent = cfg.label || "";
    row.appendChild(label);
    if (cfg.control) row.appendChild(cfg.control);
    (cfg.buttons || []).forEach(function (b) { if (b) row.appendChild(b); });
    var infoBtn = document.createElement("button");
    infoBtn.type = "button";
    infoBtn.textContent = "\u2139\uFE0F";
    infoBtn.title = cfg.infoTitle || "Info";
    infoBtn.style.cssText = "font-size:.78rem; padding:.15rem .4rem; border:1px solid #9b6bff; background:linear-gradient(180deg,#1a1a20,#4a4a55); color:#d8c9ff; border-radius:5px; cursor:pointer; flex-shrink:0;";
    var infoBlock = document.createElement("div");
    infoBlock.style.cssText = "display:none; font-size:.7rem; color:#ccc; line-height:1.4; border-top:1px solid #3a3a48; padding-top:.3rem; max-width:17rem;";
    infoBlock.textContent = cfg.info || "";
    infoBtn.onclick = function (e) { e.stopPropagation(); infoBlock.style.display = infoBlock.style.display === "block" ? "none" : "block"; };
    row.appendChild(infoBtn);
    return { row: row, label: label, infoBlock: infoBlock, infoBtn: infoBtn };
  };

  // Standard ↺ reset button shared by all slider rows (identical in every menu).
  window.dragonSliderResetBtn = function (title, onclick) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = "\u21BA";
    b.title = title || "Reset";
    b.style.cssText = "font-size:.78rem; padding:.15rem .4rem; border:1px solid #5a5a6a; background:linear-gradient(180deg,#1a1a20,#4a4a55); color:#eee; border-radius:5px; cursor:pointer; flex-shrink:0;";
    if (onclick) b.onclick = onclick;
    return b;
  };

  // Keeps a popover/dropdown horizontally inside the viewport, centered on its anchor whenever
  // possible (I53). Kept as a thin alias of the ONE placement function below.
  //
  // in the generator from one place instead of per menu:
  //   (1) CENTERED: the dropdown's horizontal centre lines up with the horizontal centre of its own
  //       trigger button (the wrapper it hangs off), so a menu always opens in line with its button.
  //   (2) NEVER OFF-SCREEN: horizontally it is clamped inside a 6px margin; if it is wider than the
  //       screen it SHRINKS instead, so its rows take extra lines (they wrap) rather than being cut.
  //       Vertically it opens under the button, flips ABOVE it when there is no room below, and as a
  //       last resort scrolls inside itself.
  //   Names of the natural (CSS-authored) box values are cached per element, so re-placing a menu
  //   after a resize never bakes in the previous clamp.
  ;function dragonNatCss(el, prop) {
    if (!el.__dragonNat) el.__dragonNat = {};
    if (!(prop in el.__dragonNat)) el.__dragonNat[prop] = el.style[prop] || "";
    return el.__dragonNat[prop];
  }
  var dragonPlacedMenus = [];
  window.dragonRegisterMenuEl = function (el) { if (el && dragonPlacedMenus.indexOf(el) === -1) dragonPlacedMenus.push(el); };
  // Measures a string in an element's OWN font (used for fixed-size controls, I59). Canvas-based, so
  // no DOM reflow and it follows the UI scale automatically because it reads the computed font.
  window.dragonMeasureText = function (text, el) {
    try {
      var cs = getComputedStyle(el);
      var ctx = document.createElement("canvas").getContext("2d");
      ctx.font = (cs.fontWeight || "normal") + " " + (cs.fontStyle || "normal") + " " + (cs.fontSize || "12px") + " " + (cs.fontFamily || "sans-serif");
      return ctx.measureText(String(text)).width;
    } catch (e) { return 0; }
  };
  window.dragonPlaceMenu = function (el, anchor, opts) {
    if (!el || !el.style) return;
    // 📐 Egon 27.09.2026 (W-UI347) — a menu appended to <body> has no anchor of its own to centre on
    // (its parent IS the body). Such a menu remembers its button on the element itself, and that button
    // is used whenever the global re-placement pass (dragonPlaceOpenMenus) calls this with no anchor.
    anchor = anchor || (el.__dragonMenuAnchor && el.__dragonMenuAnchor.isConnected ? el.__dragonMenuAnchor : el.parentElement);
    if (!anchor) return;
    opts = opts || {};
    if (dragonPlacedMenus.indexOf(el) === -1) dragonPlacedMenus.push(el);
    el.style.width = dragonNatCss(el, "width");
    el.style.maxWidth = dragonNatCss(el, "maxWidth");
    el.style.maxHeight = dragonNatCss(el, "maxHeight");
    el.style.overflow = dragonNatCss(el, "overflow");
    el.style.marginTop = dragonNatCss(el, "marginTop");
    el.style.marginLeft = dragonNatCss(el, "marginLeft");
    el.style.position = "fixed";
    el.style.transform = "none";
    el.style.left = "0px";
    el.style.top = "0px";
    var margin = opts.margin != null ? opts.margin : 6;
    var gap = opts.gap != null ? opts.gap : 2;
    var vw = window.innerWidth || 1280, vh = window.innerHeight || 720;
    var r = anchor.getBoundingClientRect();
    var mw = el.offsetWidth, mh = el.offsetHeight;
    if (!mw && !mh) return;
    var maxW = Math.max(140, vw - margin * 2);
    if (mw > maxW) { el.style.maxWidth = maxW + "px"; el.style.width = maxW + "px"; mw = maxW; }
    var left = Math.round(Math.min(Math.max(r.left + r.width / 2 - mw / 2, margin), Math.max(margin, vw - mw - margin)));
    // written by dragonModernSel from opts.alignPop. This global pass must honour it, otherwise it
    // re-centres the popup over its trigger and undoes the menu's own placement (e.g. the ⏰ time-range
    // menu, which belongs to the RIGHT of the 🏆 Best button it is attached to).
    var _ap = (el.getAttribute ? (el.getAttribute("data-dragon-align-pop") || "") : "");
    if (_ap === "left") left = Math.round(Math.min(Math.max(r.left, margin), Math.max(margin, vw - mw - margin)));
    else if (_ap === "right") left = Math.round(Math.min(Math.max(r.right - mw, margin), Math.max(margin, vw - mw - margin)));
    var below = r.bottom + gap;
    var spaceBelow = vh - below - margin, spaceAbove = r.top - gap - margin;
    var top;
    if (mh <= spaceBelow) {
      top = below;
    } else if (mh <= spaceAbove) {
      top = r.top - gap - mh;
    } else if (spaceBelow >= spaceAbove) {
      top = below;
      el.style.maxHeight = Math.max(120, Math.round(spaceBelow)) + "px";
      el.style.overflow = "auto";
    } else {
      top = margin;
      el.style.maxHeight = Math.max(120, Math.round(spaceAbove)) + "px";
      el.style.overflow = "auto";
    }
    el.style.left = left + "px";
    el.style.top = Math.round(top) + "px";
  };
  // Re-places every dropdown that is currently OPEN. Called after any click (a click is what opens a
  // menu) and on resize, so no menu can drift away from the rule above.
  window.dragonPlaceOpenMenus = function () {
    for (var i = 0; i < dragonPlacedMenus.length; i++) {
      var m = dragonPlacedMenus[i];
      try {
        if (!m || !m.isConnected) continue;
        var d = m.style.display;
        if (!d || d === "none") continue;
        if (m.offsetWidth === 0 && m.offsetHeight === 0) continue;
        window.dragonPlaceMenu(m);
      } catch (e) {}
    }
  };
  document.addEventListener("click", function () { setTimeout(function () { try { window.dragonPlaceOpenMenus(); } catch (e) {} }, 0); }, true);
  window.addEventListener("resize", function () { try { window.dragonPlaceOpenMenus(); } catch (e) {} });
  window.dragonClampPopover = function (el, anchor) { window.dragonPlaceMenu(el, anchor); };

  // gallery's 🎚 Sliders menu and the private gallery's 🎚 Sliders menu both append
  // this SAME row, so the control is written once. Every instance talks to the one global
  // scale (dragonUiScaleSet / AutoOn / AutoOff) and re-syncs on "dragon-ui-scale-changed",
  // so all copies always show the same value and stay in lockstep.
  window.dragonUiScaleRow = function () {
    // add UI SCALE text ... should appear on the percentage button"), in the site's single
    //                          settings-button standard; tapping it shows/hides the slider
    //   [🪄 Auto: ON]       <- the info text lives INSIDE this button (tooltip + toast)
    //   [====slider====]    <- the slider is HIDDEN unless the visitor asks for it (Auto OFF opens it, Auto
    //                          site looked broken — a control that can wreck the layout must never sit out
    //                          in the open. (Rule I106.)
    // standard (font .72rem / weight 700 / white on the purple theme, 34px tall, radius 9) and it carries
    // BOTH words and the number: "🔧 UI SCALE 141%". Tapping it shows/hides the slider, so the percentage
    // is always readable on the button itself while the slider never sits out in the open unasked (I106).
    var wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; gap:.26rem; width:100%; min-width:0; box-sizing:border-box;";
    var lbl = document.createElement("button");
    lbl.type = "button";
    lbl.className = "dragon-ui-scale-btn";
    lbl.style.cssText = "font-family:inherit; font-size:.72rem; font-weight:700; letter-spacing:.01em; line-height:32px; height:34px; box-sizing:border-box; padding:0 .7rem; border-radius:9px; cursor:pointer; white-space:nowrap; text-align:center; width:100%; max-width:100%; color:#ffffff; border:1px solid #9b6bff; background:linear-gradient(180deg,#2a1a4a,#1a102e);";
    var lblTipOpen = "UI Scale (70-200%): shows the size the navbar and both gallery toolbars are drawn at. Click to show/hide the slider.";
    var lblTipDone = "UI Scale (70-200%): shows the size the navbar and both gallery toolbars are drawn at. Click to hide the slider.";
    lbl.title = lblTipOpen;
    var slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(Math.round(MIN * 100));
    slider.max = String(Math.round(MAX * 100));
    slider.step = "1";
    slider.value = String(Math.round(clamp(window.__dragonUiScale) * 100));
    slider.style.cssText = "width:100%; min-width:0; accent-color:#9b6bff; margin:0; display:block;";
    // Automatic sizing is ON by default (the slider stays hidden); pressing 🔧 UI SCALE turns automatic
    // sizing OFF and reveals the slider so the visitor can set the size; pressing it again turns automatic
    // sizing back ON and hides the slider. (Rule I106 stands: the slider never sits out in the open unless
    // the visitor asked for it — a mis-tap on mobile must not be able to wreck the layout.)
    var infoBlock = document.createElement("div");
    infoBlock.style.cssText = "display:none;";
    wrap.append(lbl, slider);
    var sliderOpen = !isAuto();
    lbl.onclick = function (e) {
      e.stopPropagation();
      var wasAuto = isAuto();
      // the screen jumps because of this. when slider is on auto, it should start from whatever % it is." Turning automatic sizing
      // OFF used to reset the scale to 1.0 (100%) BEFORE the slider was shown, so the whole site snapped
      // from e.g. 112% down to 100% the instant the button was pressed. The size on screen is now captured
      // FIRST and re-applied as the new manual value, so turning AUTO off changes nothing visually and the
      // slider opens exactly where the visitor already was.
      if (wasAuto) {
        var cur = Math.round(window.dragonUiScaleGet() * 100);
        window.dragonUiScaleAutoOff();
        window.dragonUiScaleSet(cur / 100);
      } else {
        window.dragonUiScaleAutoOn();
      }
      sliderOpen = !isAuto();                 // automatic OFF → slider open · automatic ON → slider closed (I106)
      slider.value = String(Math.round(window.dragonUiScaleGet() * 100));
      sync();
      try {
        if (window.dragonToast) dragonToast(wasAuto
          ? "🔧 UI Scale — automatic sizing is OFF; the slider is shown at " + Math.round(window.dragonUiScaleGet() * 100) + "%, set it yourself (70-200%)"
          : "🔧 UI Scale — automatic sizing is ON again; the bars size themselves to your screen");
      } catch (e2) {}
    };
    ;function sync() {
      // while automatic sizing is ON the slider FOLLOWS the automatic value, so the number on the button and
      // the slider can never disagree (and turning AUTO off starts the slider from that same place).
      if (isAuto()) slider.value = String(Math.round(window.dragonUiScaleGet() * 100));
      var pct = Number(slider.value);
      // itself, "· AUTO: OFF" the moment he presses it and the slider comes out. (I109: the word fits.)
      lbl.textContent = "🔧 UI SCALE " + pct + "% · AUTO: " + (isAuto() ? "ON" : "OFF");
      lbl.title = isAuto()
        ? "UI Scale " + pct + "% (sized automatically to fit your screen). Press to switch automatic sizing OFF and set it yourself."
        : "UI Scale " + pct + "% (you are setting it yourself). Press to go back to automatic sizing.";
      // the slider is only reachable while the visitor asked for it (a mis-tap can no longer wreck the layout)
      slider.style.display = sliderOpen ? "block" : "none";
    }
    // which made the whole screen "shake". We now (a) update the label instantly, (b) apply the scale
    // at most ONCE per animation frame (requestAnimationFrame throttle) and (c) hold a short CSS
    // transition on the resized bars while dragging, so growth/shrink animates smoothly instead of
    // snapping. Fallbacks if a browser cannot animate it: stepped detents, then +/- buttons.
    var pendVal = null, rafId = 0, transT = null;
    ;function bumpTransition() {
      try { document.documentElement.classList.add("dragon-ui-scaling"); } catch (e) {}
      if (transT) clearTimeout(transT);
      transT = setTimeout(function () {
        transT = null;
        try { document.documentElement.classList.remove("dragon-ui-scaling"); } catch (e) {}
      }, 180);
    }
    ;function flushScale() {
      rafId = 0;
      if (pendVal == null) return;
      var v = pendVal; pendVal = null;
      // under the finger); the latest value is remembered and applied as soon as the panel closes.
      if (window.__dragonUiScaleHoldAny) { window.__dragonUiScalePending = v; return; }
      bumpTransition();
      window.dragonUiScaleSet(v);
    }
    ;function queueScale() { if (!rafId) rafId = requestAnimationFrame(flushScale); }
    slider.oninput = function () {
      pendVal = Number(slider.value) / 100;
      sync();
      bumpTransition();
      queueScale();
    };
    // flush any pending frame + transition when the drag ends
    ["pointerup", "pointercancel", "change", "blur"].forEach(function (ev) {
      slider.addEventListener(ev, function () { if (pendVal != null) flushScale(); bumpTransition(); });
    });
    window.addEventListener("dragon-ui-scale-changed", function () {
      slider.value = String(Math.round(window.dragonUiScaleGet() * 100));
      sync();
    });
    sync();
    return { row: wrap, infoBlock: infoBlock };
  };

  // while any token is active dragonUiScaleSet() is not called (so the open panel never resizes under
  // the user's finger). When the last panel closes, the last value is applied in one go.
  window.dragonUiScaleHold = function (id, on) {
    window.__dragonUiScaleHolds = window.__dragonUiScaleHolds || {};
    if (on) window.__dragonUiScaleHolds[id] = true;
    else { try { delete window.__dragonUiScaleHolds[id]; } catch (e) { window.__dragonUiScaleHolds[id] = false; } }
    var any = false;
    for (var k in window.__dragonUiScaleHolds) { if (window.__dragonUiScaleHolds[k]) { any = true; break; } }
    window.__dragonUiScaleHoldAny = any;
    if (!any) {
      var p = window.__dragonUiScalePending;
      window.__dragonUiScalePending = null;
      if (p != null) { try { window.dragonUiScaleSet(p); } catch (e) {} }
    }
  };

  // init (as early as possible so the first paint is already right, no flash)
  if (isAuto()) apply(autoCompute()); else { var sv = storedVal(); apply(sv == null ? 1 : sv); }
  window.addEventListener("resize", function () { if (isAuto()) apply(autoCompute()); });

  // injected CSS — HIGHER specificity than the toolbar sources (which use 22px / .7rem
  // with !important), so the scale always wins. Public rows live in .dragon-gal-panel,
  // private rows in .dragon-vault-header-bar.
  ;function css() {
    if (document.getElementById("dragonUiScaleCss")) return;
    var S = "var(--dragon-ui-scale,1)";
    var P = ".dragon-gal-panel.dragon-gal-panel.dragon-gal-panel ";
    var V = ".dragon-vault-header-bar.dragon-vault-header-bar ";
    var rows = [".dragon-gal-row1", ".dragon-gal-row2", ".dragon-gal-row3", ".dragon-gal-row4"];
    var sel = [];
    for (var i = 0; i < rows.length; i++) {
      // wrapper) sit ONE level deeper (row>div>span>button, row>div>div>button); without these the
      // sort + content-filter controls stayed at 22px while their row-mates scaled to 31px, which
      // tripped the kiss-up check ("equal control heights").
      sel.push(
        P + rows[i] + ">button", P + rows[i] + ">select",
        P + rows[i] + ">div>button", P + rows[i] + ">span>button",
        P + rows[i] + ">div>span>button", P + rows[i] + ">div>div>button"
      );
    }
    // content-filter dropdown wrappers, and they sit one level deeper again
    // (.dragon-gal-row2 > #dragonSubRowBox > #dragonSubRow > <wrapper> > button). Without these the three
    // dropdowns stayed at 22px while the sub-channel buttons beside them scaled with the UI scale, so the
    // row was no longer uniform (kiss-up: 2.6px height spread). Our own chip buttons are direct children.
    sel.push(
      P + "#dragonSubRow>button", P + "#dragonSubRow>select",
      P + "#dragonSubRow>span>button", P + "#dragonSubRow>div>button",
      P + "#dragonSubRow>div>span>button", P + "#dragonSubRow>div>div>button",
      P + "#dragonSubRow>span>div>button"
    );
    // at every viewport, so it has to scale with the UI scale too (it did not: at 1920px, scale 1.52, the
    // expanded menu was 33px/17px while the collapsed one stayed 22px/11.2px — a different-looking control).
    sel.push(P + ".dragon-gal-collapse-bar button", P + ".dragon-gal-collapse-bar select");
    var st = document.createElement("style");
    st.id = "dragonUiScaleCss";
    st.textContent =
      sel.join(",") + "{height:calc(22px * " + S + ") !important; min-height:calc(22px * " + S + ") !important; min-width:calc(22px * " + S + ") !important; font-size:calc(.7rem * " + S + ") !important;}" +
      P + ".dragon-gal-row1 .dragon-gal-icbtn:not(.dragon-gal-toolbox-btn)," +
      P + ".dragon-gal-row1 button[title^=\"Sliders\"]," +
      P + ".dragon-gal-row1 button[title^=\"Exclude\"]{width:calc(22px * " + S + ") !important; height:calc(22px * " + S + ") !important; font-size:calc(.8rem * " + S + ") !important; flex:0 0 auto !important;}" +
      V + ".dragon-vault-row1 button," + V + ".dragon-vault-row2 button," + V + ".dragon-vault-row3 button," +
      V + ".dragon-vault-row1>select," + V + ".dragon-vault-row2>select," + V + ".dragon-vault-row3>select," +
      V + ".dragon-vault-searchrow button{height:calc(22px * " + S + ") !important; min-height:calc(22px * " + S + ") !important; min-width:calc(22px * " + S + ") !important; font-size:calc(.7rem * " + S + ") !important; box-sizing:border-box !important;}" +
      V + ".dragon-vault-searchrow input{height:calc(22px * " + S + ") !important; font-size:calc(.72rem * " + S + ") !important; box-sizing:border-box !important;}" +
      V + ".dragon-vault-counter{height:calc(22px * " + S + ") !important; font-size:calc(.7rem * " + S + ") !important;}" +
      // the resized bars animate their height/font instead of snapping every frame (fixes the "shaky" growth).
      "html.dragon-ui-scaling .dragon-navbar," +
      "html.dragon-ui-scaling .dragon-navbar .dragon-nav-item," +
      "html.dragon-ui-scaling .dragon-navbar .dragon-nav-ic," +
      "html.dragon-ui-scaling .dragon-online-circle," +
      "html.dragon-ui-scaling #dragonBotHost button," +
      "html.dragon-ui-scaling #dragonNavSpacer," +
      "html.dragon-ui-scaling .dragon-gal-panel," +
      "html.dragon-ui-scaling .dragon-gal-panel button," +
      "html.dragon-ui-scaling .dragon-gal-panel select," +
      "html.dragon-ui-scaling .dragon-vault-header-bar," +
      "html.dragon-ui-scaling .dragon-vault-header-bar button," +
      "html.dragon-ui-scaling .dragon-vault-header-bar select" +
      "{transition:height .12s ease-out,min-height .12s ease-out,min-width .12s ease-out,width .12s ease-out,font-size .12s ease-out,padding .12s ease-out !important;}";
    (document.head || document.documentElement).appendChild(st);
  }
  if (document.head) css(); else document.addEventListener("DOMContentLoaded", css);
})();
