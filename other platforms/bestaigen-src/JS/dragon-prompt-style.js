// 🎨 Description-box typography (Egon 24.09.2026)
// Egon in the chat: "Better visible readable text in ai generator for image?" → after a short exchange he
// settled on adding a FONT + TEXT COLOUR picker for the prompt box, plus a background colour (the visitor
// in the chat wanted black-on-white because white-on-dark is hard on the eyes).
//
// This module puts ONE mini button into the description panel's control row — a plain 36px mini button,
// i.e. it joins the SAME movable pool as the other mini buttons (arrange mode can drag it anywhere). The
// button opens a small window with:
//   · Font       — the SAME six fonts the picture editor offers (Default / Serif / Rounded / Mono /
//                  Handwriting / Poster), every row drawn in its OWN face so the list previews itself
//   · A− / A+    — the editor's size step (1 px at a time, with a live readout)
//   · B Bold     — the editor's bold toggle
//   · Colour     — a text swatch and a background swatch
//   · ↺ Default  — wipes every choice and hands the box back to index.html's own styling
// Choices are remembered per browser (localStorage.dragonPromptStyle) and re-applied on every load. The
// prompt box belongs to the t2i framework plugin and can be rebuilt, so a cheap MutationObserver re-applies
// the style whenever the box NODE changes (not on every mutation — that would thrash on a busy gallery).
//
// 🎨 Egon 25.09.2026 — the open window is now painted from the generator's own theme tokens (--dt-*), the
// same ones every other control uses (Designbook §3/§4): before this it carried its own gold-on-navy
// design that had nothing to do with the generator's default look.
(function () {
  if (window.__dragonPromptStyleInstalled) return;
  window.__dragonPromptStyleInstalled = true;

  var LS = "dragonPromptStyle";
  // mirrors DPP_FONTS in index.html (the picture editor's list) so both pickers offer the same faces
  var FONTS = [
    { id: "system", label: "Default", css: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
    { id: "serif", label: "Serif", css: "Georgia, 'Times New Roman', serif" },
    { id: "rounded", label: "Rounded", css: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif" },
    { id: "mono", label: "Mono", css: "'Courier New', ui-monospace, monospace" },
    { id: "hand", label: "Handwriting", css: "'Segoe Script', 'Bradley Hand', 'Comic Sans MS', cursive" },
    { id: "poster", label: "Poster", css: "Impact, Haettenschweiler, 'Arial Black', sans-serif" }
  ];
  var SIZE_STEP = 1, SIZE_MIN = 10, SIZE_MAX = 34;
  var DEFAULTS = { font: "", size: 0, color: "", bg: "", bold: 0 };
  var PROPS = ["font-family", "font-size", "font-weight", "color", "background-color"];

  // every colour below comes from the theme tokens, so the window follows the visitor's theme (Designbook §3)
  var PANEL = "var(--dt-panel1, #0e0e12)";
  var EDGE = "var(--dt-chipbd, #5a5a6a)";
  var FG = "var(--dt-fg, #eeeeee)";
  var ACCENT = "var(--dt-accent, #9b6bff)";
  var CTL = "background:linear-gradient(180deg,var(--dt-btn1,#1a1a20),var(--dt-btn2,#4a4a55));" +
    "border:1px solid " + EDGE + ";color:" + FG + ";";
  // a SELECT on this page cannot carry its own gradient: the generator forces
  // `select{background:var(--dt-bg2)!important}`, so the flat themed panel colour wins anyway (the editor's
  // own dropdowns end up the same way) — keep the border and the text colour only.
  var SELCTL = "border:1px solid " + EDGE + ";color:" + FG + ";";;
  var ON = "border-color:var(--dt-chiponbd,#ffd76a);" +
    "background:linear-gradient(180deg,var(--dt-chipon1,#4a3a1a),var(--dt-chipon2,#6a5a2a));" +
    "color:var(--dt-chiponfg,#ffe9a8);";

  function read() {
    var o = {}, k;
    for (k in DEFAULTS) if (Object.prototype.hasOwnProperty.call(DEFAULTS, k)) o[k] = DEFAULTS[k];
    try {
      var raw = localStorage.getItem(LS);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && typeof p === "object") {
          if (typeof p.font === "string") o.font = p.font;
          if (typeof p.size === "number") o.size = Math.max(0, Math.round(p.size));
          if (typeof p.color === "string") o.color = p.color;
          if (typeof p.bg === "string") o.bg = p.bg;
          o.bold = p.bold ? 1 : 0;
        }
      }
    } catch (e) {}
    return o;
  }
  function write(o) { try { localStorage.setItem(LS, JSON.stringify(o)); } catch (e) {} }
  function fontCss(id) {
    for (var i = 0; i < FONTS.length; i++) if (FONTS[i].id === id) return FONTS[i].css;
    return "";
  }

  // the prompt box lives inside the description panel, which dragon-pages.js marks with .dragon-desc-ctn;
  // the fallback (first visible textarea) only matters if that class ever moves.
  function findBox() {
    var dc = document.querySelector(".dragon-desc-ctn");
    var ta = dc ? dc.querySelector("textarea") : null;
    if (!ta) {
      var all = document.querySelectorAll("textarea");
      for (var i = 0; i < all.length; i++) { if (all[i].offsetParent !== null) { ta = all[i]; break; } }
    }
    return ta || null;
  }

  function paint(o) {
    var ta = findBox();
    if (!ta) return null;
    var st = ta.style;
    function set(prop, val) {
      try { if (val) st.setProperty(prop, val, "important"); else st.removeProperty(prop); } catch (e) {}
    }
    set("font-family", o.font ? fontCss(o.font) : "");
    set("font-size", o.size ? (o.size + "px") : "");
    set("font-weight", o.bold ? "bold" : "");
    set("color", o.color || "");
    set("background-color", o.bg || "");
    return ta;
  }
  window.dragonPromptStyleApply = function () { lastBox = paint(read()); };
  var lastBox = null;

  /* ------------------------------------------------------------------ the window */
  function buildControl() {
    var pop = document.createElement("div");
    pop.style.cssText = "position:fixed; z-index:2147483000; display:none; flex-direction:column; gap:4px; " +
      "background:" + PANEL + "; border:1px solid " + EDGE + "; border-radius:10px; padding:7px; " +
      "width:16.5rem; max-width:calc(100vw - 16px); box-sizing:border-box; box-shadow:0 12px 30px rgba(0,0,0,.72); " +
      "color:" + FG + ";";
    (document.body || document.documentElement).appendChild(pop);
    // 📐 Egon 27.09.2026 (W-UI347) — registered in the generator's central dropdown registry, so opening
    // this window closes every other menu (I105) and the global re-placement pass keeps it centered under
    // the 🎨 button instead of letting it drift (I88).
    try { if (window.dragonRegisterMenuEl) window.dragonRegisterMenuEl(pop); } catch (e) {}
    try { window.dragonHookOutside(pop, close); } catch (e) {}
    try { if (window.dragonRegisterDropdown) window.dragonRegisterDropdown(pop, close); } catch (e) {}

    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "dragonPromptStyleBtn";
    btn.className = "dragon-desc-mini";
    btn.textContent = "\uD83C\uDFA8";
    btn.title = "Text & colour for the prompt box \u2014 font, size, bold, text colour and background colour";

    function row(label) {
      var r = document.createElement("div");
      r.style.cssText = "display:flex; align-items:center; gap:5px;";
      if (label) {
        var l = document.createElement("span");
        l.textContent = label;
        l.style.cssText = "flex:0 0 4.2rem; font-size:.66rem; color:" + ACCENT + ";";
        r.appendChild(l);
      }
      pop.appendChild(r);
      return r;
    }
    var SEL = "flex:1 1 auto; min-width:0; font-size:.72rem; font-weight:bold; padding:.24rem .35rem; " +
      "border-radius:8px; cursor:pointer; " + SELCTL + " background-color:var(--dt-bg2,#1b1b21);";
    var BTN = "padding:.24rem .5rem; font-size:.72rem; font-weight:bold; border-radius:8px; cursor:pointer; " + CTL;
    var SWATCH = "width:2rem; height:1.6rem; padding:0; border-radius:8px; border:1px solid " + EDGE + "; background:transparent; cursor:pointer;";
    var CAP = "font-size:.64rem; color:" + FG + "; opacity:.65;";

    function build() {
      pop.innerHTML = "";
      var o = read();
      var head = document.createElement("div");
      head.textContent = "\uD83C\uDFA8 Description Style";
      head.style.cssText = "font-size:.72rem; font-weight:bold; color:" + ACCENT + "; padding:.1rem .1rem .25rem;";
      pop.appendChild(head);

      var fRow = row("Font");
      var sel = document.createElement("select");
      if (window.dragonStyleSelect) window.dragonStyleSelect(sel);
      sel.setAttribute("data-ps", "font");
      sel.style.cssText = SEL;
      FONTS.forEach(function (f) {
        var op = document.createElement("option");
        op.value = f.id;
        op.textContent = f.label;
        // 🔤 the row previews the face it selects (Chrome/Firefox paint option styles; Safari falls back
        // to the plain label, which is why the closed select is set to the same family below).
        op.style.fontFamily = f.css;
        op.style.fontSize = ".95rem";
        if ((o.font || "system") === f.id) op.selected = true;
        sel.appendChild(op);
      });
      sel.style.fontFamily = fontCss(o.font) || FONTS[0].css;
      sel.onchange = function () {
        var n = read();
        n.font = (sel.value === "system") ? "" : sel.value;
        write(n); lastBox = paint(n);
        sel.style.fontFamily = fontCss(n.font) || FONTS[0].css;
      };
      fRow.appendChild(sel);

      var sRow = row("Size");
      var minus = document.createElement("button");
      minus.type = "button";
      minus.textContent = "A\u2212";
      minus.title = "Smaller text";
      minus.setAttribute("data-ps", "size-down");
      minus.style.cssText = BTN;
      var cur = document.createElement("span");
      cur.textContent = o.size ? (o.size + "px") : "auto";
      cur.setAttribute("data-ps", "size-now");
      cur.style.cssText = "flex:0 0 3.1rem; text-align:center; font-size:.68rem; color:" + FG + "; opacity:.72;";
      var plus = document.createElement("button");
      plus.type = "button";
      plus.textContent = "A+";
      plus.title = "Bigger text";
      plus.setAttribute("data-ps", "size-up");
      plus.style.cssText = BTN;
      function step(d) {
        var n = read();
        var box = findBox();
        var base = n.size || Math.round(parseFloat((box ? getComputedStyle(box).fontSize : "16px")) || 16);
        n.size = Math.max(SIZE_MIN, Math.min(SIZE_MAX, base + d * SIZE_STEP));
        write(n); lastBox = paint(n); build();
      }
      minus.onclick = function () { step(-1); };
      plus.onclick = function () { step(1); };
      sRow.append(minus, cur, plus);

      var bRow = row("Style");
      var bold = document.createElement("button");
      bold.type = "button";
      bold.setAttribute("data-ps", "bold");
      bold.textContent = "B Bold";
      bold.title = "Bold text";
      bold.style.cssText = BTN + "font-weight:900;" + (o.bold ? ON : "");
      bold.onclick = function () { var n = read(); n.bold = n.bold ? 0 : 1; write(n); lastBox = paint(n); build(); };
      bRow.appendChild(bold);

      var cRow = row("Colour");
      var colLbl = document.createElement("span");
      colLbl.textContent = "text";
      colLbl.style.cssText = CAP;
      var col = document.createElement("input");
      col.type = "color";
      col.setAttribute("data-ps", "color");
      col.value = o.color || "#eeeeee";
      col.title = "Text colour of the prompt box";
      col.style.cssText = SWATCH;
      col.oninput = function () { var n = read(); n.color = col.value; write(n); lastBox = paint(n); };
      var bgLbl = document.createElement("span");
      bgLbl.textContent = "bg";
      bgLbl.style.cssText = CAP + " margin-left:.25rem;";
      var bg = document.createElement("input");
      bg.type = "color";
      bg.setAttribute("data-ps", "bg");
      bg.value = o.bg || "#1b1b21";
      bg.title = "Background colour of the prompt box";
      bg.style.cssText = SWATCH;
      bg.oninput = function () { var n = read(); n.bg = bg.value; write(n); lastBox = paint(n); };
      cRow.append(colLbl, col, bgLbl, bg);

      var rRow = row("");
      var reset = document.createElement("button");
      reset.type = "button";
      reset.setAttribute("data-ps", "reset");
      reset.textContent = "\u21BA Default";
      reset.title = "Put the prompt box back to index.html's own styling";
      reset.style.cssText = BTN + "flex:1 1 auto;";
      reset.onclick = function () {
        try { localStorage.removeItem(LS); } catch (e) {}
        var ta = findBox();
        if (ta) PROPS.forEach(function (p) { try { ta.style.removeProperty(p); } catch (e) {} });
        lastBox = null;
        build();
        if (window.dragonToast) window.dragonToast("\uD83C\uDFA8 Description Style \u2014 back to the default look");
      };
      rRow.appendChild(reset);

      var hint = document.createElement("div");
      hint.textContent = "These colours and fonts belong to the prompt box itself and are remembered in this browser.";
      hint.style.cssText = "font-size:.6rem; color:" + FG + "; opacity:.55; padding:.15rem .1rem .05rem; line-height:1.25;";
      pop.appendChild(hint);
    }

    function close() { pop.style.display = "none"; document.removeEventListener("pointerdown", out, true); }
    function out(e) { if (!pop.contains(e.target) && e.target !== btn) close(); }
    btn.onclick = function (e) {
      e.stopPropagation();
      if (pop.style.display === "flex") { close(); return; }
      build();
      pop.style.display = "flex";
      // one placement rule for the whole generator (centered under the button, clamped, flips up)
      var placed = false;
      try { pop.__dragonMenuAnchor = btn; if (window.dragonPlaceMenu) { window.dragonPlaceMenu(pop, btn); placed = true; } } catch (e) {}
      if (!placed) {
        var r = btn.getBoundingClientRect();
        var pw = pop.offsetWidth, ph = pop.offsetHeight;
        var vw = window.innerWidth || 360, vh = window.innerHeight || 600;
        pop.style.left = Math.max(8, Math.min(r.left + r.width / 2 - pw / 2, vw - pw - 8)) + "px";
        var below = r.bottom + 4;
        pop.style.top = (below + ph > vh - 8 ? Math.max(8, r.top - ph - 4) : below) + "px";
      }
      try { window.dragonCloseOtherDropdowns(close); } catch (e) {}
      setTimeout(function () { document.addEventListener("pointerdown", out, true); }, 0);
    };
    return btn;
  }

  /* ------------------------------------------------------------------ mounting */
  var mounted = false, btnEl = null, scheduled = 0;
  function mount() {
    if (mounted) return true;
    var zone = document.getElementById("dragonDescBtnsRow") || document.querySelector(".dragon-desc-ctn .random-input-btn-ctn");
    if (!zone) return false;
    if (!btnEl) btnEl = buildControl();
    if (!btnEl.parentNode) zone.appendChild(btnEl);
    mounted = true;
    return true;
  }
  function tick() {
    scheduled = 0;
    try {
      if (!mounted) mount();
      var box = findBox();
      if (box !== lastBox) lastBox = paint(read());
    } catch (e) {}
  }
  function schedule() { if (scheduled) return; scheduled = 1; setTimeout(tick, 250); }

  var tries = 0;
  function boot() {
    tick();
    if (mounted) return;
    if (tries++ > 60) return;
    setTimeout(boot, 250);
  }
  try {
    if (window.dragonBodyObserve) window.dragonBodyObserve(schedule);
    else { var mo = new MutationObserver(schedule); mo.observe(document.documentElement, { childList: true, subtree: true }); }
  } catch (e) {}
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
