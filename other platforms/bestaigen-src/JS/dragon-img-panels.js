// dragon-img-panels — moved VERBATIM out of index.html (Paket A1, 25.09.2026; was the biggest inline
// script, 76.7 KB). Same classic-script semantics, same position in the boot order. See Patchbook 2.52.2.
(function () {
  if (window.__dragonImgPanelsInstalled) return;
  window.__dragonImgPanelsInstalled = true;

  var CSS = [
    ".dragon-img-sec{width:100%;flex:0 0 auto !important;box-sizing:border-box;margin:0 0 8px;border:1px solid #3a3a4a;border-radius:10px;background:#101017;overflow:hidden;}",
    ".dragon-img-sec-head{width:100%;display:flex;align-items:center;gap:.45rem;box-sizing:border-box;padding:.42rem .6rem;border:0;border-bottom:1px solid #23232d;background:linear-gradient(180deg,#26262e,#191921);color:#e8e0f0;cursor:pointer;text-align:left;font-size:.78rem;line-height:1.25;}",
    ".dragon-img-sec:not(.dragon-img-sec-open) .dragon-img-sec-head{border-bottom:0;}",
    ".dragon-img-sec-head:hover{background:linear-gradient(180deg,#2f2f3a,#1e1e28);}",
    ".dragon-img-sec-caret{flex:0 0 auto;color:#c9b8ff;font-size:.7rem;}",
    ".dragon-img-sec-num{flex:0 0 auto;font-weight:700;font-size:.72rem;padding:.08rem .38rem;border-radius:7px;background:rgba(10,10,14,.85);color:var(--dragon-gal-num-c,#7cc4ff);border:1px solid var(--dragon-gal-num-c,#7cc4ff);}",
    ".dragon-img-sec-dupe{flex:0 0 auto;font-weight:700;font-size:.62rem;letter-spacing:.02em;padding:1px 5px;border-radius:8px;background:rgba(20,10,40,.82);color:#c9a6ff;border:1px solid rgba(150,110,255,.55);}",
    ".dragon-img-sec-prompt{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#b9b3d0;}",
    ".dragon-img-sec-folder{flex:0 0 auto;font-size:.68rem;color:#c9b8ff;white-space:nowrap;}",
    ".dragon-img-sec-body{display:none;}",
    ".dragon-img-sec-open .dragon-img-sec-body{display:block;}",
    ".dragon-img-sec-frame{position:relative;width:100%;box-sizing:border-box;background:#08080c;display:flex;align-items:center;justify-content:center;overflow:hidden;}",
    ".dragon-img-sec-frame img,.dragon-img-sec-frame video{display:block;max-width:100%;}",
    ".dragon-img-sec--cover .dragon-img-sec-frame,.dragon-img-sec--default .dragon-img-sec-frame{height:min(62vh,520px);}",
    ".dragon-img-sec--cover .dragon-img-sec-frame img,.dragon-img-sec--default .dragon-img-sec-frame img{width:100%;height:100%;object-fit:cover;}",
    ".dragon-img-sec--contain .dragon-img-sec-frame{height:min(62vh,520px);}",
    ".dragon-img-sec--contain .dragon-img-sec-frame img{width:100%;height:100%;object-fit:contain;}",
    ".dragon-img-sec--original .dragon-img-sec-frame img,.dragon-img-sec--masonry .dragon-img-sec-frame img{width:100%;height:auto;}",
    ".dragon-img-sec-badge{position:absolute;z-index:6;font-size:.62rem;font-weight:700;padding:.1rem .4rem;background:rgba(10,10,14,.85);pointer-events:none;max-width:60%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
    ".dragon-img-sec-numbadge{left:0;bottom:0;border-radius:0 7px 0 0;color:var(--dragon-gal-num-c,#7cc4ff);border:1px solid var(--dragon-gal-num-c,#7cc4ff);border-left:0;border-bottom:0;}",
    ".dragon-img-sec-folderbadge{right:0;bottom:0;border-radius:7px 0 0 0;color:#c9b8ff;border:1px solid rgba(155,107,255,.5);border-right:0;border-bottom:0;}",
    ".dragon-img-sec-dupebadge{left:4px;top:4px;color:#c9a6ff;border:1px solid rgba(150,110,255,.55);border-radius:8px;}",
    ".dragon-img-sec-actions{position:absolute;left:50%;transform:translateX(-50%);bottom:6px;z-index:8;display:flex;gap:0;opacity:.92;}",
    ".dragon-img-sec-actions button{min-width:32px;height:26px;padding:0 8px;border:1px solid #6a6a7a;border-left-width:0;background:linear-gradient(180deg,#2f2f3b,#17171d);color:#eee;font-size:14px;line-height:1;cursor:pointer;}",
    ".dragon-img-sec-actions button:first-child{border-left-width:1px;border-radius:9px 0 0 9px;}",
    ".dragon-img-sec-actions button:last-child{border-radius:0 9px 9px 0;}",
    ".dragon-img-sec-actions button:hover{background:linear-gradient(180deg,#3d3d4d,#21212a);}",
    ".dragon-img-sec-actions button.dragon-img-sec-fav{color:#ff5a7a;}",
    ".dragon-img-sec-actions button.dragon-img-sec-del{color:#ff8a8a;}",
    "@media(max-width:640px){.dragon-img-sec-actions button{min-width:28px;height:24px;font-size:13px;padding:0 6px;}}",
    "#localMediaGallery_root .dragon-vault-header-bar.dragon-vault-shrunk{gap:1px !important;padding:0 2px !important;}",
    "#localMediaGallery_root .dragon-vault-header-bar.dragon-vault-shrunk .dragon-vault-row1{display:none !important;}",
    "#localMediaGallery_root .dragon-vault-header-bar.dragon-vault-shrunk .dragon-vault-row3{display:none !important;}"
  ].join("\n");
  var st = document.createElement("style");
  st.id = "dragonImgPanelCss";
  st.textContent = CSS;
  document.head.appendChild(st);


  ;function normKey(p) {
    try { if (window.dragonNormalizePromptKey) return window.dragonNormalizePromptKey(p); } catch (e) {}
    return String(p || "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 160);
  }
  window.dragonImgPanelNormKey = normKey;



  // remove the date box. shouldn't be editable in the url. shouldn't be editable in the prompt. whatever the image's active prompt is
  // add that. no need to show the prompt in the panel. just adding an 'add prompt' button is enough. (since it's on/off
  // therefore remove the image only button) A-, A+, font selection, bold, buttons of the text area
  // place underneath. zoom buttons should be centered in the first row under settings. other settings buttons should also be appropriate
  // should be centered with placement in rows. place 'Prompt view' button next to the text panel … text area
  // should go, prompt should come to this area as non-editable. there should be an add emoji check button on the page …
  // on emoji preview page, each should be freely movable when clicked/selected … emoji
  // zoom out and zoom in - and + buttons appear (selected emoji is visible between these two buttons) … print preview
  // fit button image in the panel; whichever edge is longer, it should fit perfectly to right-left or top-bottom
  // positions to a4. also preview option for paper sizes other than a4 … text's
  // the box in preview expands and contracts on x and y axes, not moving diagonally (x+y) is annoying
  // ing. … there should be a restore original button."
  //
  // ONE RULE (unchanged): the preview IS the print. Every measurement lives in PERCENT of the sheet (text in
  // true px at 96 dpi, converted to mm for the paper), the preview is a true-scale miniature of that sheet,
  // and `dragonPrintSheet` rebuilds the very same geometry on a real mm page inside `@page{size:…;margin:0}`
  // — which is also what keeps the BROWSER's own header/footer off the paper.
  var DRAGON_PP = null;              // the open editor's state (null while closed); exposed via dragonPrintState()
  var DPP_MM_PER_PX = 25.4 / 96;     // 1 px at 96 dpi = 0.2646 mm
  var DPP_BOX_IDS = ["prompt", "date", "link", "own"];
  var DPP_SIZE0 = 12;                // default text size in px at 96 dpi (≈ 3.2 mm on paper)
  // four common POSTER sizes (30×40 / 40×60 / 50×70 / 60×90 cm), so a visitor with a large-format
  // printer can really print big. `group` becomes the <optgroup> in the picker.
  var DPP_PAPERS = [
    { id: "a6", label: "A6 · 105×148 mm", w: 105, h: 148, group: "Small" },
    { id: "a5", label: "A5 · 148×210 mm", w: 148, h: 210, group: "Small" },
    { id: "a4", label: "A4 · 210×297 mm", w: 210, h: 297, group: "Standard" },
    { id: "letter", label: "Letter · 216×279 mm", w: 215.9, h: 279.4, group: "Standard" },
    { id: "legal", label: "Legal · 216×356 mm", w: 215.9, h: 355.6, group: "Standard" },
    { id: "a3", label: "A3 · 297×420 mm", w: 297, h: 420, group: "Large" },
    { id: "tabloid", label: "Tabloid · 279×432 mm", w: 279.4, h: 431.8, group: "Large" },
    { id: "square", label: "Square · 210×210 mm", w: 210, h: 210, group: "Large" },
    { id: "a2", label: "A2 · 420×594 mm", w: 420, h: 594, group: "Poster" },
    { id: "a1", label: "A1 · 594×841 mm", w: 594, h: 841, group: "Poster" },
    { id: "a0", label: "A0 · 841×1189 mm", w: 841, h: 1189, group: "Poster" },
    { id: "p30x40", label: "Poster · 30×40 cm", w: 300, h: 400, group: "Poster" },
    { id: "p40x60", label: "Poster · 40×60 cm", w: 400, h: 600, group: "Poster" },
    { id: "p50x70", label: "Poster · 50×70 cm", w: 500, h: 700, group: "Poster" },
    { id: "p60x90", label: "Poster · 60×90 cm", w: 600, h: 900, group: "Poster" }
  ];
  // Named @page sizes (the print dialog understands these and preselects the paper); everything else
  // is sent as exact mm.
  var DPP_NAMED = { a4: "A4", a3: "A3", a5: "A5", a6: "A6", letter: "letter", legal: "legal", tabloid: "tabloid" };
  var DPP_FONTS = [
    { id: "system", label: "Default", css: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
    { id: "serif", label: "Serif", css: "Georgia, 'Times New Roman', serif" },
    { id: "rounded", label: "Rounded", css: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif" },
    { id: "mono", label: "Mono", css: "'Courier New', ui-monospace, monospace" },
    { id: "hand", label: "Handwriting", css: "'Segoe Script', 'Bradley Hand', 'Comic Sans MS', cursive" },
    { id: "poster", label: "Poster", css: "Impact, Haettenschweiler, 'Arial Black', sans-serif" }
  ];
  var DPP_EMOJIS = ["\uD83D\uDE00", "\uD83D\uDE03", "\uD83D\uDE04", "\uD83D\uDE01", "\uD83D\uDE06", "\uD83D\uDE05", "\uD83D\uDE02", "\uD83D\uDE42",
    "\uD83D\uDE09", "\uD83D\uDE0A", "\uD83D\uDE0D", "\uD83E\uDD70", "\uD83D\uDE18", "\uD83D\uDE0E", "\uD83E\uDD29", "\uD83E\uDD73",
    "\uD83E\uDD14", "\uD83D\uDE34", "\uD83D\uDE22", "\uD83D\uDE2D", "\uD83D\uDE31", "\uD83D\uDE21", "\uD83E\uDD2F", "\uD83D\uDC4D",
    "\uD83D\uDC4F", "\uD83D\uDE4F", "\uD83D\uDCAA", "\u270C\uFE0F", "\uD83E\uDD1D", "\u2764\uFE0F", "\uD83D\uDC96", "\uD83D\uDD25",
    "\u2728", "\u2B50", "\uD83C\uDF1F", "\uD83C\uDF89", "\uD83C\uDF81", "\uD83C\uDF39", "\uD83C\uDF38", "\uD83C\uDF08",
    "\u2600\uFE0F", "\uD83C\uDF19", "\u26A1", "\uD83C\uDFA8", "\uD83D\uDDBC\uFE0F", "\uD83D\uDDA8\uFE0F", "\uD83D\uDCC5", "\uD83D\uDD17",
    "\uD83D\uDCCC", "\uD83D\uDCA1", "\uD83C\uDFAF", "\uD83E\uDD8B", "\uD83D\uDC09", "\uD83C\uDF0A", "\uD83C\uDF40"];

  // look. Only the four size buttons (🔍− 🔍+ and the emoji − +) keep the older, plainer style
  var DPP_BTN = "padding:.42rem .58rem; font-size:.76rem; font-weight:bold; border-radius:9px; cursor:pointer; font-family:inherit; border:1px solid #9b6bff; background:linear-gradient(180deg,#2a1a4a,#1a102e); color:#d8c9ff;";
  var DPP_BTN_PLAIN = "padding:.42rem .58rem; font-size:.76rem; font-weight:bold; border-radius:9px; cursor:pointer; font-family:inherit; border:1px solid rgba(155,107,255,.45); background:linear-gradient(145deg,#2a2a36,#15151c); color:#d8c9ff;";
  // font dropdown's "Default" text looked nothing like the buttons. An inline `!important` colour is the
  // only thing that can beat it, so DPP_SEL carries one (same purple the buttons use).
  var DPP_SEL = "font-family:inherit; font-size:.76rem; font-weight:bold; padding:.42rem .58rem; border-radius:9px; cursor:pointer; border:1px solid #9b6bff; background:linear-gradient(180deg,#2a1a4a,#1a102e); color:#d8c9ff !important; -webkit-text-fill-color:#d8c9ff; max-width:100%;";
  ;function dppMk(tag, cls, css) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (css) el.style.cssText = css;
    return el;
  }
  ;function dppBtn(txt, title, primary, fn, ppId) {
    var b = dppMk("button", null, DPP_BTN);
    b.type = "button";
    b.textContent = txt;
    b.title = title || "";
    if (ppId) b.setAttribute("data-pp", ppId);
    b.onclick = function (e) { e.stopPropagation(); fn(); };
    return b;
  }
  ;function dppPlain(b) { if (b) b.style.cssText = DPP_BTN_PLAIN; b.style.position = "relative"; return b; }
  // click = exactly ONE step, hold = the same step repeated, starting slow and speeding up.
  // The whole site shares ONE implementation (window.dragonHoldRepeat, dragon-app-core.js).
  ;function dppHold(btn, onStep) {
    if (!btn) return btn;
    if (window.dragonHoldRepeat) return window.dragonHoldRepeat(btn, onStep);
    var timer = null, held = false, count = 0;
    ;function stop() { held = false; count = 0; if (timer) { clearTimeout(timer); timer = null; } }
    ;function chain() {
      if (!held) return;
      onStep(count);
      count++;
      timer = setTimeout(chain, Math.max(30, 200 * Math.pow(0.8, count)));
    }
    btn.addEventListener("pointerdown", function (e) {
      e.stopPropagation();
      stop();
      held = true;
      onStep(0);
      timer = setTimeout(chain, 400);
    });
    btn.addEventListener("pointerup", stop);
    btn.addEventListener("pointercancel", stop);
    btn.addEventListener("pointerleave", stop);
    return btn;
  }
  // shows "this is on the picture", and NO badge means "this adds nothing yet".
  ;function dppBadge(btn, on) {
    if (!btn) return;
    btn.style.position = "relative";
    var bg = btn.querySelector(".dpp-badge");
    if (on && !bg) {
      bg = dppMk("span", "dpp-badge", "position:absolute; top:-7px; right:-7px; width:16px; height:16px; border-radius:50%; background:linear-gradient(180deg,#4ade80,#15803d); color:#04240f; font-size:.62rem; font-weight:900; line-height:16px; text-align:center; border:1px solid #bbf7d0; box-shadow:0 2px 8px rgba(74,222,128,.65); pointer-events:none;");
      bg.textContent = "\u2713";
      btn.appendChild(bg);
    } else if (!on && bg) { try { bg.remove(); } catch (e) {} }
  }
  ;function dppChip(btn, on) { dppBadge(btn, on); }
  ;function dppPanel(title) {
    var p = dppMk("div", "dpp-panel", "background:linear-gradient(180deg,#191527,#100d18); border:1px solid #3a3350; border-radius:12px; padding:.42rem .5rem .5rem; display:flex; flex-direction:column; gap:.35rem;");
    var h = dppMk("div", null, "font-size:.67rem; font-weight:800; letter-spacing:.04em; text-transform:uppercase; color:#a99ad6; text-align:center;");
    h.textContent = title;
    p.appendChild(h);
    return p;
  }
  ;function dppRow(css) { return dppMk("div", null, "display:flex; align-items:center; gap:.32rem; flex-wrap:wrap; justify-content:center; " + (css || "")); }
  ;function dppLabel(txt, css) {
    var d = dppMk("div", null, css || "font-size:.66rem; color:#9a92b8; line-height:1.35; text-align:center;");
    d.textContent = txt;
    return d;
  }
  ;function dppTa(css, ph, val, ppId) {
    var t = dppMk("textarea", null, css + "; font-family:inherit; border:1px solid #5a5a6a; border-radius:8px; background:#0e0e13; color:#eee; resize:vertical;");
    t.value = val || "";
    t.placeholder = ph || "";
    if (ppId) t.setAttribute("data-pp", ppId);
    return t;
  }
  ;function dppPaper(st) {
    for (var i = 0; i < DPP_PAPERS.length; i++) if (DPP_PAPERS[i].id === st.paper) return DPP_PAPERS[i];
    return DPP_PAPERS[0];
  }
  ;function dppSheetMm(st) {
    var p = dppPaper(st);
    return st.landscape ? { w: p.h, h: p.w } : { w: p.w, h: p.h };
  }
  ;function dppSheetPx(st) { var m = dppSheetMm(st); return { w: m.w / DPP_MM_PER_PX, h: m.h / DPP_MM_PER_PX }; }
  ;function dppClampW(v) { return Math.max(3, Math.min(400, v)); }
  // pixels, so the fitted picture used to leave a hair-thin white seam where it should touch the paper
  // (0.35 px measured on portrait A4). Every "edge-touching" size therefore overlaps the sheet by a
  // hair (0.35 %): invisible on the picture, but there is no seam left anywhere.
  var DPP_EDGE = 1.0035;
  ;function dppWPctFor(st, vw, vh) {
    // width-percent that makes the picture come out exactly vw × vh (sheet px) — a 90°/270° turn swaps w/h
    var s = dppSheetPx(st), ratio = (st.natW > 0 && st.natH > 0) ? (st.natH / st.natW) : 1, turned = (st.rot % 180) !== 0;
    var a = turned ? ratio : 1, b = turned ? 1 : ratio;
    return 100 * Math.min(vw / (s.w * a), vh / (s.w * b)) * DPP_EDGE;
  }
  ;function dppWPctCover(st) {
    var s = dppSheetPx(st), ratio = (st.natW > 0 && st.natH > 0) ? (st.natH / st.natW) : 1, turned = (st.rot % 180) !== 0;
    var a = turned ? ratio : 1, b = turned ? 1 : ratio;
    return 100 * Math.max(1 / a, s.h / (s.w * b)) * DPP_EDGE;
  }
  ;function dppContainPct(st) { var s = dppSheetPx(st); return dppClampW(dppWPctFor(st, s.w, s.h)); }
  ;function dppFontCss(id) {
    for (var i = 0; i < DPP_FONTS.length; i++) if (DPP_FONTS[i].id === id) return DPP_FONTS[i].css;
    return DPP_FONTS[0].css;
  }
  ;function dppBoxInit() {
    return {
      prompt: { x: 6, y: 62, w: 88, color: "#333333", size: 12, bold: false, font: "system" },
      date: { x: 32, y: 88, w: 36, color: "#555555", size: 10, bold: false, font: "system" },
      link: { x: 12, y: 92.4, w: 76, color: "#7a7a7a", size: 9, bold: false, font: "system" },
      own: { x: 12, y: 26, w: 76, color: "#333333", size: 12, bold: false, font: "system" }
    };
  }
  ;function dppNewState(url, prompt, mode, onUse) {
    return {
      url: url, prompt: String(prompt || "").trim(), mode: mode || "print", onUse: onUse || null,
      // the paper until the visitor presses it (and the green tick then says it is on).
      showPrompt: false, showDate: false, showLink: false,
      paper: "a4", landscape: false, rot: 0, natW: 0, natH: 0,
      wPct: 60, cx: 50, cy: 50, touched: false, fitDone: false,
      // 💫 Upscale ⇄ ↺ Original: the editor keeps BOTH pictures and swaps between them (see dppSwapPic)
      baseUrl: url, upscaledUrl: null, showing: "base",
      date: dragonPrintSheetDate(), link: dragonPrintPageUrl(), own: "",
      emos: [], selEmo: -1, addEmoji: false,
      target: "own", panelView: "own",
      box: dppBoxInit(), init: null
    };
  }
  // the visible text of each box ("" = that box is not on the paper at all)
  ;function dppBoxText(st, id) {
    if (id === "prompt") return st.showPrompt ? st.prompt : "";
    if (id === "date") return st.showDate ? String(st.date || "").trim() : "";
    if (id === "link") return st.showLink ? String(st.link || "").trim() : "";
    return String(st.own || "");
  }
  // everything the editor can change — used for the snapshot, "restore original" and the upscale hand-off
  ;function dppMutable(st) {
    return JSON.parse(JSON.stringify({
      showPrompt: st.showPrompt, showDate: st.showDate, showLink: st.showLink,
      paper: st.paper, landscape: st.landscape, rot: st.rot,
      wPct: st.wPct, cx: st.cx, cy: st.cy, date: st.date, link: st.link, own: st.own,
      baseUrl: st.baseUrl, upscaledUrl: st.upscaledUrl, showing: st.showing,
      emos: st.emos, box: st.box
    }));
  }
  ;function dppSnapshot() {
    var o = {}, k;
    for (k in DRAGON_PP) if (Object.prototype.hasOwnProperty.call(DRAGON_PP, k) && k !== "ov" && k !== "boxEls" && k !== "txtEls" && k !== "emoEls" && k !== "actions") o[k] = DRAGON_PP[k];
    o.groups = {};
    DPP_BOX_IDS.forEach(function (id) { o.groups[id] = dppBoxText(DRAGON_PP, id); });
    return o;
  }
  ;function dppMini() {
    if (!DRAGON_PP || !DRAGON_PP.stage) return { w: 0, h: 0, k: 1 };
    var st = DRAGON_PP.stage;
    var availW = Math.max(120, st.clientWidth - 12), availH = Math.max(160, st.clientHeight - 12);
    var mm = dppSheetMm(DRAGON_PP);
    var h = availH, w = h * (mm.w / mm.h);
    if (w > availW) { w = availW; h = w * (mm.h / mm.w); }
    var sp = dppSheetPx(DRAGON_PP);
    return { w: Math.round(w), h: Math.round(h), k: (sp.h > 0 ? (h / sp.h) : 1) };
  }
  ;function dragonPrintPreviewPaint() {
    if (!DRAGON_PP || !DRAGON_PP.sheet) return;
    var st = DRAGON_PP;
    try {
      var narrow = (window.innerWidth || 1000) < 860;
      if (st.bodyEl) st.bodyEl.style.flexDirection = narrow ? "column" : "row";
      if (st.sideEl) { st.sideEl.style.width = narrow ? "100%" : "min(46vw,20rem)"; st.sideEl.style.maxHeight = narrow ? "48%" : ""; }
    } catch (e) {}
    var m = dppMini();
    if (m.w > 0) { st.sheet.style.width = m.w + "px"; st.sheet.style.height = m.h + "px"; }
    if (st.imgEl) {
      st.imgEl.style.left = st.cx + "%";
      st.imgEl.style.top = st.cy + "%";
      st.imgEl.style.width = st.wPct + "%";
      st.imgEl.style.transform = "translate(-50%,-50%) rotate(" + st.rot + "deg)";
    }
    DPP_BOX_IDS.forEach(function (id) {
      var el = st.boxEls[id];
      if (!el) return;
      var txt = dppBoxText(st, id);
      if (st.txtEls && st.txtEls[id]) st.txtEls[id].textContent = txt;
      el.style.display = txt ? "" : "none";
      var b = st.box[id];
      el.style.left = b.x + "%"; el.style.top = b.y + "%"; el.style.width = b.w + "%";
      el.style.color = b.color;
      el.style.fontSize = (b.size * m.k).toFixed(2) + "px";
      el.style.fontFamily = dppFontCss(b.font);
      el.style.fontWeight = b.bold ? "800" : "400";
    });
    (st.emoEls || []).forEach(function (el, i) {
      var e = st.emos[i];
      if (!e || !el) return;
      el.style.left = e.x + "%"; el.style.top = e.y + "%";
      el.style.fontSize = (e.size * m.k).toFixed(2) + "px";
      el.style.outline = (i === st.selEmo) ? "2px dashed rgba(155,107,255,.95)" : "none";
      el.style.outlineOffset = "3px";
    });
    var tb = st.box[st.target] || st.box.own;
    if (st.ratioBtn) st.ratioBtn.textContent = Math.round(st.wPct) + "%";
    if (st.orientBtn) st.orientBtn.textContent = st.landscape ? "🔄 Portrait" : "🔄 Landscape";
    if (st.boldBtn) st.boldBtn.style.borderColor = tb.bold ? "#c9aeff" : "rgba(155,107,255,.45)";
    if (st.fontSel) st.fontSel.value = tb.font || "system";
    if (st.colBtn) st.colBtn.value = /^#[0-9a-f]{6}$/i.test(String(tb.color || "")) ? tb.color : "#333333";
    if (st.paperSel) st.paperSel.value = st.paper;
    if (st.addPromptBtn) dppChip(st.addPromptBtn, st.showPrompt);
    if (st.dateBtn) dppChip(st.dateBtn, st.showDate);
    if (st.linkBtn) dppChip(st.linkBtn, st.showLink);
    if (st.addEmojiBtn) dppChip(st.addEmojiBtn, st.addEmoji);
    if (st.emoCtl) st.emoCtl.style.display = st.addEmoji ? "flex" : "none";
    if (st.emoPanel) st.emoPanel.style.display = st.addEmoji ? "flex" : "none";
    if (st.emoCur) st.emoCur.textContent = (st.selEmo >= 0 && st.emos[st.selEmo]) ? st.emos[st.selEmo].em : "😊";
    // 💫 Upscale ⇄ ↺ Original: one button, two states (see dppSwapPic)
    if (st.upBtn) {
      if (st.upscaledUrl) {
        var onUp = (st.showing === "up");
        // says "↺ Return to Original", on the original it says "💫 Return to Upscaled". The two symbols keep
        // meaning what they always did: ↺ = the original, 💫 = the upscaled picture.
        st.upBtn.textContent = onUp ? "↺ Return to Original" : "💫 Return to Upscaled";
        st.upBtn.title = onUp ? "You are looking at the UPSCALED picture — press to go back to the original"
                              : "You are looking at the ORIGINAL picture — press to go back to the upscaled one";
        st.upBtn.style.borderColor = "#d8b4fe";
        st.upBtn.style.boxShadow = "0 0 10px rgba(192,132,252,.55)";
      } else {
        st.upBtn.textContent = "💫 Upscale";
        st.upBtn.title = "Upscale this picture — the upscale window opens and can print the bigger version";
        st.upBtn.style.boxShadow = "";
      }
    }
    // the picture stays invisible until it has been fitted, so it never flashes in at 60 % and shifts
    if (st.imgEl) st.imgEl.style.opacity = st.fitDone ? "1" : "0";
  }
  // 💫 Upscale ⇄ ↺ Original — swap the two pictures of the SAME job, touching nothing else.
  ;function dppSwapPic(st) {
    if (!st || !st.upscaledUrl || !st.baseUrl) return;
    st.showing = (st.showing === "up") ? "base" : "up";
    st.url = (st.showing === "up") ? st.upscaledUrl : st.baseUrl;
    st.natW = 0; st.natH = 0;                    // re-measured by the <img> load handler
    st.imgEl.src = st.url;
    dragonPrintPreviewPaint();
  }
  ;function dppApplyFit(st, how) {
    if (!st || !st.imgEl || !st.sheet || !(st.natW > 0 && st.natH > 0)) return;
    var c = dppContainPct(st);
    if (how === "cover") {
      st.wPct = dppClampW(dppWPctCover(st)); st.cx = 50; st.cy = 50;
    } else if (how === "centre") {
      // Centre: keep the current size but land the picture's middle on the A4's middle,
      // shrinking only when it would stick out.
      st.wPct = dppClampW(Math.min(st.wPct, c)); st.cx = 50; st.cy = 50;
    } else {
      // Fit: the whole picture, touching the paper edge on whichever side is longer.
      st.wPct = c; st.cx = 50; st.cy = 50;
    }
  }
  ;function dppZoom(f) { if (!DRAGON_PP) return; DRAGON_PP.touched = true; DRAGON_PP.wPct = dppClampW(DRAGON_PP.wPct * f); dragonPrintPreviewPaint(); }
  ;function dppZoomStep(dir, count) {
    if (!DRAGON_PP) return;
    var pct = window.dragonHoldPct ? window.dragonHoldPct(count || 0) : 1;
    DRAGON_PP.touched = true;
    DRAGON_PP.wPct = dppClampW(DRAGON_PP.wPct * (dir > 0 ? (1 + pct / 100) : 1 / (1 + pct / 100)));
    dragonPrintPreviewPaint();
  }
  ;function dppSetTarget(st, id) {
    st.target = id;
    dragonPrintPreviewPaint();
  }
  ;function dppBuildEmos(st) {
    if (!st.emoLayer) return;
    st.emoLayer.textContent = "";
    st.emoEls = [];
    st.emos.forEach(function (e, i) {
      var el = dppMk("div", "dpp-emo", "position:absolute; transform:translate(-50%,-50%); line-height:1; cursor:move; touch-action:none; user-select:none; -webkit-user-select:none; border-radius:50%; padding:2px; pointer-events:auto;");
      el.setAttribute("data-emo", String(i));
      el.textContent = e.em;
      st.emoLayer.appendChild(el);
      st.emoEls.push(el);
    });
  }
  ;function dppAddEmoji(st, em) {
    st.emos.push({ em: em, x: 50, y: 50, size: 34 });
    st.selEmo = st.emos.length - 1;
    dppBuildEmos(st);
    dragonPrintPreviewPaint();
  }
  ;function dppEmoSize(d) {
    var st = DRAGON_PP;
    if (!st || st.selEmo < 0 || !st.emos[st.selEmo]) { try { dragonToast("👆 tap an emoji on the sheet first"); } catch (e) {} return; }
    var e = st.emos[st.selEmo];
    e.size = Math.max(8, Math.min(240, e.size + d));
    dragonPrintPreviewPaint();
  }
  ;function dppSyncPanel(st) {
    if (st.ownTa) st.ownTa.value = st.own || "";
    // prompt says so instead of showing a blank read-only box.
    if (st.promptRo) st.promptRo.textContent = st.prompt ? st.prompt : "(this picture carries no prompt — write your own text below)";
    if (st.ownWrap) st.ownWrap.style.display = (st.panelView === "own") ? "" : "none";
    if (st.promptWrap) st.promptWrap.style.display = (st.panelView === "prompt") ? "" : "none";
    if (st.viewBtn) st.viewBtn.textContent = (st.panelView === "own") ? "📝 Prompt view" : "✍️ My text";
    st.target = (st.panelView === "prompt") ? "prompt" : "own";
  }
  // (straight again, re-centred, re-fitted to the sheet). Text, colour and emoji work is NOT touched.
  ;function dppDefaultPicture(st) {
    if (!st) return;
    st.rot = 0; st.touched = false;
    dppApplyFit(st, "fit");
    dragonPrintPreviewPaint();
  }
  ;function dppBuild(st) {
    var ov = dppMk("div", null, "position:fixed; inset:0; z-index:2147483647; display:flex; flex-direction:column; gap:.45rem; padding:.55rem; background:rgba(6,4,10,.9); -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px); color:#ece6ff; font-family:system-ui,sans-serif;");
    ov.id = "dragonPrintPreview";
    var head = dppMk("div", null, "display:flex; align-items:center; justify-content:center; gap:.5rem; font-size:.84rem; font-weight:800; color:#d8c9ff;");
    head.textContent = st.mode === "share" ? "✎ Edit the picture before sharing" : "✏️ Image Editor";
    var body = dppMk("div", null, "flex:1 1 auto; min-height:0; display:flex; gap:.6rem; align-items:stretch;");
    var stage = dppMk("div", null, "flex:1 1 auto; min-width:0; min-height:0; display:flex; align-items:center; justify-content:center; background:#14121b; border:1px solid #3a3350; border-radius:12px; overflow:hidden;");
    var sheet = dppMk("div", null, "position:relative; overflow:hidden; background:#fff; box-shadow:0 12px 40px rgba(0,0,0,.7); cursor:grab; touch-action:none; flex:0 0 auto;");
    sheet.id = "dragonPrintSheet";
    var im = dppMk("img", null, "position:absolute; left:50%; top:50%; width:60%; height:auto; transform:translate(-50%,-50%); user-select:none; -webkit-user-drag:none; pointer-events:none;");
    im.id = "dragonPrintSheetImg";
    im.alt = "";
    im.draggable = false;
    sheet.appendChild(im);
    st.boxEls = {};
    st.txtEls = {};
    DPP_BOX_IDS.forEach(function (id) {
      var el = dppMk("div", "dpp-box", "position:absolute; white-space:pre-wrap; word-break:break-word; line-height:1.45; text-align:center; outline:1px dashed rgba(155,107,255,.85); outline-offset:2px; background:rgba(155,107,255,.06); border-radius:3px; padding:1px 3px; cursor:move; touch-action:none; user-select:none;");
      el.setAttribute("data-box", id);
      el.title = "Drag to move · drag the small square at the corner to make the box (and its text) bigger or smaller";
      // the text lives in its OWN span so that repainting never wipes the resize handle next to it
      var tx = dppMk("span", "dpp-txt", "display:block; width:100%;");
      tx.setAttribute("data-txt", id);
      el.appendChild(tx);
      var hd = dppMk("span", "dpp-handle", "position:absolute; right:-6px; bottom:-6px; width:14px; height:14px; background:#9b6bff; border:1px solid #fff; border-radius:3px; cursor:nwse-resize; touch-action:none;");
      hd.setAttribute("data-handle", id);
      el.appendChild(hd);
      st.boxEls[id] = el;
      st.txtEls[id] = tx;
      sheet.appendChild(el);
    });
    var emoLayer = dppMk("div", null, "position:absolute; inset:0; pointer-events:none;");
    emoLayer.id = "dragonPrintEmoLayer";
    sheet.appendChild(emoLayer);
    st.emoLayer = emoLayer;
    st.emoEls = [];
    // box's centre out to every sheet edge and the free space is printed in px where the line meets the edge
    // (left / right / top / bottom), so the visitor can centre a box by the numbers. Hidden by default.
    var guideLayer = dppMk("div", null, "position:absolute; inset:0; pointer-events:none; display:none; z-index:6;");
    guideLayer.id = "dragonPrintGuides";
    var guideH = dppMk("div", null, "position:absolute; left:0; right:0; height:0; border-top:1px dashed rgba(255,120,220,.95);");
    var guideV = dppMk("div", null, "position:absolute; top:0; bottom:0; width:0; border-left:1px dashed rgba(255,120,220,.95);");
    ;function guideLbl() {
      return dppMk("span", null, "position:absolute; font-size:10px; line-height:1.25; padding:0 3px; border-radius:4px; white-space:nowrap; background:rgba(24,12,36,.88); color:#ffd9f5; border:1px solid rgba(255,120,220,.7);");
    }
    var gLeft = guideLbl(), gRight = guideLbl(), gTop = guideLbl(), gBottom = guideLbl();
    guideLayer.append(guideH, guideV, gLeft, gRight, gTop, gBottom);
    sheet.appendChild(guideLayer);
    st.guides = { layer: guideLayer, h: guideH, v: guideV, labels: { left: gLeft, right: gRight, top: gTop, bottom: gBottom } };
    stage.appendChild(sheet);
    var side = dppMk("div", null, "flex:0 0 auto; width:min(46vw,20rem); display:flex; flex-direction:column; gap:.45rem; overflow:auto; padding-right:.1rem;");

    // ---- ⚙️ Settings (every row centred) ------------------------------------------------------
    var set = dppPanel("⚙️ Settings");
    var ratioBtn = dppBtn("60%", "Size of the picture on the paper — click to go back to the fitted size", false, function () { DRAGON_PP.touched = true; dppApplyFit(DRAGON_PP, "fit"); dragonPrintPreviewPaint(); }, "ratio");
    ratioBtn.style.minWidth = "3.1rem";
    st.ratioBtn = ratioBtn;
    // 🔍− / 🔍+ — ONE standard zoom for the whole site: 1 % per press, and holding the button keeps
    // stepping faster and faster (dppHold). These two keep the plain style, like the emoji pair.
    var zoomRow = dppRow();
    var zOut = dppPlain(dppBtn("🔍−", "Smaller — 1 % per press (hold to keep zooming out)", false, function () {}, "zoom-out"));
    var zIn = dppPlain(dppBtn("🔍+", "Bigger — 1 % per press (hold to keep zooming in)", false, function () {}, "zoom-in"));
    dppHold(zOut, function (c) { dppZoomStep(-1, c); });
    dppHold(zIn, function (c) { dppZoomStep(1, c); });
    zoomRow.append(zOut, ratioBtn, zIn);
    var fitRow = dppRow();
    fitRow.append(
      dppBtn("⤢ Fit", "Fit the whole picture: whichever side is longer lands exactly on the paper edge", false, function () { DRAGON_PP.touched = true; dppApplyFit(DRAGON_PP, "fit"); dragonPrintPreviewPaint(); }, "fit"),
      dppBtn("▣ Cover", "Cover the whole sheet with the picture (the overflowing edges get cropped)", false, function () { DRAGON_PP.touched = true; dppApplyFit(DRAGON_PP, "cover"); dragonPrintPreviewPaint(); }, "cover"),
      dppBtn("⚖ Centre", "Put the picture's middle on the middle of the paper — shrunk so nothing sticks out", false, function () { DRAGON_PP.touched = true; dppApplyFit(DRAGON_PP, "centre"); dragonPrintPreviewPaint(); }, "centre")
    );
    var orientBtn = dppBtn("🔄 Landscape", "Turn the SHEET 90°", false, function () { DRAGON_PP.landscape = !DRAGON_PP.landscape; DRAGON_PP.touched = false; dppApplyFit(DRAGON_PP, "fit"); dragonPrintPreviewPaint(); }, "rot-sheet");
    st.orientBtn = orientBtn;
    // It only straightens / re-centres / re-fits the PICTURE; the text and emoji work stays.
    var rotRow = dppRow();
    rotRow.append(
      dppBtn("↻ Image", "Turn the PICTURE by 90° (it is re-fitted afterwards)", false, function () { DRAGON_PP.rot = (DRAGON_PP.rot + 90) % 360; DRAGON_PP.touched = false; dppApplyFit(DRAGON_PP, "fit"); dragonPrintPreviewPaint(); }, "rot-img"),
      dppBtn("↺ Default", "Put the picture back the way it looked when this editor opened — straight, centred and fitted (your text, colour and emoji are kept)", false, function () { dppDefaultPicture(DRAGON_PP); }, "default"),
      orientBtn
    );
    var paperSel = document.createElement("select");
    if (window.dragonStyleSelect) window.dragonStyleSelect(paperSel);
    paperSel.setAttribute("data-pp", "paper");
    paperSel.title = "Paper size (A6 … A0 and poster sizes) — the preview and the printed page both follow it";
    paperSel.style.cssText = DPP_SEL;
    var _pgrp = null, _pog = null;
    DPP_PAPERS.forEach(function (p) {
      if (p.group !== _pgrp) { _pgrp = p.group; _pog = document.createElement("optgroup"); _pog.label = p.group; paperSel.appendChild(_pog); }
      var o = document.createElement("option");
      o.value = p.id; o.textContent = p.label; if (p.id === st.paper) o.selected = true;
      _pog.appendChild(o);
    });
    paperSel.onchange = function () { DRAGON_PP.paper = paperSel.value; DRAGON_PP.touched = false; dppApplyFit(DRAGON_PP, "fit"); dragonPrintPreviewPaint(); };
    st.paperSel = paperSel;
    // 💫 Upscale / ↺ Original / 💫 Upscaled — ONE button. Before an upscale it opens the upscale window;
    // once the upscaled picture is in the editor the SAME button flips between the original and the
    // upscaled picture (touching no other setting).
    var upBtn = dppBtn("💫 Upscale", "Upscale this picture — the upscale window opens and can print the bigger version", false, function () {
      var s2 = DRAGON_PP;
      if (!s2) return;
      if (s2.upscaledUrl) { dppSwapPic(s2); return; }
      var snap = dppMutable(s2), pr = s2.prompt, u = s2.url;
      window.__dragonPrintRestore = { state: snap, prompt: pr, origUrl: u };
      dragonPrintPreviewClose();
      if (typeof window.dragonUpscaleImage === "function") window.dragonUpscaleImage(u, { prompt: pr });
      else dragonToast("💫 upscale is not available right now");
    }, "upscale");
    st.upBtn = upBtn;
    upBtn.style.width = "100%";
    var paperRow = dppRow();
    paperRow.append(paperSel, upBtn);
    // on the very picture this sheet is showing and hands the result straight back here, so the visitor's
    // text, emoji, paper size and zoom all survive the retouch.
    var brushRow = dppRow();
        var brushTried = false;
    var brushGo = function () {
      var s3 = DRAGON_PP;
      if (!s3 || !s3.url) return;
      if (!window.dragonBrushOpen) {
        // ⚡ W-PERF129 — the brush module is part of the DEFERRED BOOT: the first press fetches it and then runs
        // this very handler again (it used to be a plain "not available" toast).
        if (!brushTried && window.dragonLazyReady) { brushTried = true; window.dragonLazyReady(brushGo); return; }
        dragonToast("🖌️ the brush is not available right now"); return;
      }
      var wasUp3 = (s3.showing === "up");
      var target3 = s3.url;
      ;function back() { try { if (DRAGON_PP && DRAGON_PP.ov) DRAGON_PP.ov.style.visibility = ""; } catch (e) {} }
      try { s3.ov.style.visibility = "hidden"; } catch (e) {}
      window.dragonBrushOpen(target3, s3.prompt, function (newUrl) {
        var s4 = DRAGON_PP;
        if (!s4 || !newUrl) return;
        if (wasUp3) s4.upscaledUrl = newUrl; else s4.baseUrl = newUrl;
        s4.url = newUrl;
        s4.natW = 0; s4.natH = 0; s4.fitDone = false; s4.touched = false;
        if (s4.imgEl) s4.imgEl.src = newUrl;
        dragonPrintPreviewPaint();
      }, back);

    };
    brushRow.append(dppBtn("🖌️ Retouch Brush", "Open the retouch brush on THIS picture — 🖌 paint with a colour or 🩹 clone a clean patch over a watermark / blemish (RIGHT-click samples a clean spot, LEFT-click paints it); ✔ Done comes straight back to this editor", false, brushGo, "brush"));
    // inside the editor … you went and put it in the public gallery toolbar … collage is essentially about
    // close, it must stay underneath", and "the picture in the lightbox must be SELECTED BY DEFAULT". So the
    // editor is no longer hidden (the collage overlay now sits above it, at z-index 2147483648) and THIS
    // picture is handed to the picker as the main image, ticked in its ☑ Use main image box.
    var colRow = dppRow();
        var colTried = false;
    var colGo = function () {
      if (!window.dragonCollageOpen) {
        // ⚡ W-PERF129 — the collage module is part of the DEFERRED BOOT: the first press fetches it and then runs
        // this very handler again (it used to be a plain "not available" toast).
        if (!colTried && window.dragonLazyReady) { colTried = true; window.dragonLazyReady(colGo); return; }
        dragonToast("\uD83E\uDDE9 the collage editor is not available right now"); return;
      }
      var s5 = DRAGON_PP;
      var main = (s5 && s5.url) ? { url: s5.url, prompt: String(s5.prompt || "") } : null;
      window.dragonCollageOpen({ main: main });

    };
    colRow.append(dppBtn("\uD83E\uDDE9 Collage", "Build a collage from your own saved pictures \u2014 pick up to 100 of them, lay them out with one of six patterns, then download the PNG, save it into a \u201CCollages\u201D folder, print it or send it back to the editor", false, colGo, "collage"));
    set.append(zoomRow, fitRow, rotRow, brushRow, colRow, paperRow,
      dppLabel("Drag the picture to crop · wheel = zoom · drag a striped box (or its left/right square) to move / widen it."));

    // ---- ➕ Add to picture -------------------------------------------------------------------
    var add = dppPanel("➕ Add to picture");
    // the prompt window below (that window never appeared before, which is why it looked broken).
    var addPromptBtn = dppBtn("📝 Add prompt", "Put the picture's own prompt on the paper — press again to take it off", false, function () {
      DRAGON_PP.showPrompt = !DRAGON_PP.showPrompt;
      // cannot change that text anyway and can already see it on the sheet.
      dragonPrintPreviewPaint();
    }, "add-prompt");
    st.addPromptBtn = addPromptBtn;
    var dateBtn = dppBtn("📅 date", "Put today's date on the paper — it is filled in automatically", false, function () { DRAGON_PP.showDate = !DRAGON_PP.showDate; dragonPrintPreviewPaint(); }, "date");
    st.dateBtn = dateBtn;
    var linkBtn = dppBtn("🔗 page link", "Put this page's link on the paper", false, function () { DRAGON_PP.showLink = !DRAGON_PP.showLink; dragonPrintPreviewPaint(); }, "link");
    st.linkBtn = linkBtn;
    var tglRow = dppRow();
    tglRow.append(addPromptBtn, dateBtn, linkBtn);

    // the text panel: either YOUR text (editable) or the PROMPT (read-only "prompt view")
    var viewBtn = dppBtn("📝 Prompt view", "Show the picture's prompt here instead — it can be styled but not typed over", false, function () {
      DRAGON_PP.panelView = (DRAGON_PP.panelView === "own") ? "prompt" : "own";
      dppSyncPanel(DRAGON_PP);
      dragonPrintPreviewPaint();
    }, "prompt-view");
    st.viewBtn = viewBtn;
    var viewRow = dppRow();
    viewRow.append(viewBtn);
    var ownTa = dppTa("width:100%; box-sizing:border-box; padding:.4rem .5rem; font-size:.74rem; min-height:3.2rem;", "Your own text on the paper — Enter makes a new line…", st.own, "own-text");
    ownTa.onfocus = function () { DRAGON_PP.panelView = "own"; dppSyncPanel(DRAGON_PP); };
    ownTa.oninput = function () { DRAGON_PP.own = ownTa.value; dragonPrintPreviewPaint(); };
    st.ownTa = ownTa;
    var promptRo = dppMk("div", null, "width:100%; box-sizing:border-box; padding:.4rem .5rem; font-size:.72rem; min-height:3.2rem; border:1px dashed #5a5a6a; border-radius:8px; background:#0b0b10; color:#c9c2e0; white-space:pre-wrap; word-break:break-word; text-align:left; cursor:default;");
    promptRo.setAttribute("data-pp", "prompt-view-text");
    promptRo.title = "The picture's prompt — read only";
    st.promptRo = promptRo;
    var ownWrap = dppMk("div", null, "display:flex; flex-direction:column; gap:.35rem;");
    ownWrap.appendChild(ownTa);
    var promptWrap = dppMk("div", null, "display:none; flex-direction:column; gap:.35rem;");
    promptWrap.append(dppLabel("The picture's prompt (read-only)"), promptRo);
    st.ownWrap = ownWrap; st.promptWrap = promptWrap;

    // text style controls — directly UNDER the writing area (they act on whatever the panel shows).
    // own text (each box keeps its own colour).
    var fontSel = document.createElement("select");
    if (window.dragonStyleSelect) window.dragonStyleSelect(fontSel);
    fontSel.setAttribute("data-pp", "font");
    fontSel.title = "Text style / font";
    fontSel.style.cssText = DPP_SEL;
    DPP_FONTS.forEach(function (f) {
      var o = document.createElement("option");
      o.value = f.id; o.textContent = f.label; if (f.id === (st.box[st.target] || {}).font) o.selected = true;
      // (Chrome and Firefox paint option styles; Safari falls back to the plain label).
      o.style.fontFamily = f.css; o.style.fontSize = ".95rem";
      fontSel.appendChild(o);
    });
    fontSel.style.fontFamily = dppFontCss((st.box[st.target] || {}).font);
    fontSel.onchange = function () { DRAGON_PP.box[DRAGON_PP.target].font = fontSel.value; fontSel.style.fontFamily = dppFontCss(fontSel.value); dragonPrintPreviewPaint(); };
    st.fontSel = fontSel;
    var boldBtn = dppBtn("𝗕 Bold", "Bold text", false, function () {
      var b = DRAGON_PP.box[DRAGON_PP.target];
      b.bold = !b.bold;
      dragonPrintPreviewPaint();
    }, "bold");
    st.boldBtn = boldBtn;
    var colBtn = document.createElement("input");
    colBtn.type = "color";
    colBtn.setAttribute("data-pp", "text-colour");
    colBtn.title = "Text colour — colours the prompt / your own text on the paper";
    colBtn.style.cssText = "width:2.4rem; height:2rem; padding:0; border-radius:9px; border:1px solid #9b6bff; background:linear-gradient(180deg,#2a1a4a,#1a102e); cursor:pointer;";
    colBtn.oninput = function () { DRAGON_PP.box[DRAGON_PP.target].color = colBtn.value; dragonPrintPreviewPaint(); };
    st.colBtn = colBtn;
    var styleRow = dppRow();
    styleRow.append(
      fontSel,
      dppBtn("A−", "Smaller text", false, function () { var b = DRAGON_PP.box[DRAGON_PP.target]; b.size = Math.max(6, b.size - 1); dragonPrintPreviewPaint(); }, "size-down"),
      dppBtn("A+", "Bigger text", false, function () { var b = DRAGON_PP.box[DRAGON_PP.target]; b.size = Math.min(96, b.size + 1); dragonPrintPreviewPaint(); }, "size-up"),
      boldBtn,
      colBtn
    );

    // the button is never greyed out: pressing it is what reveals the two rows below it.
    var addEmojiBtn = dppBtn("😊 Add emoji", "Press this and the size buttons and the emoji table appear right below", false, function () { DRAGON_PP.addEmoji = !DRAGON_PP.addEmoji; dragonPrintPreviewPaint(); }, "emoji");
    st.addEmojiBtn = addEmojiBtn;
    var emoCtl = dppMk("div", null, "display:none; align-items:center; gap:.35rem; justify-content:center;");
    var emoCurEl = dppMk("span", null, "min-width:1.7rem; text-align:center; font-size:1.15rem; line-height:1.2;");
    emoCurEl.setAttribute("data-pp", "emo-cur");
    emoCurEl.textContent = "😊";
    st.emoCur = emoCurEl;
    emoCtl.append(
      dppPlain(dppBtn("−", "Smaller emoji", false, function () {}, "emo-down")),
      emoCurEl,
      dppPlain(dppBtn("+", "Bigger emoji", false, function () {}, "emo-up"))
    );
    // holding − / + grows / shrinks the selected emoji faster and faster (same rule as the zoom pair)
    dppHold(emoCtl.children[0], function () { dppEmoSize(-4); });
    dppHold(emoCtl.children[2], function () { dppEmoSize(4); });
    st.emoCtl = emoCtl;
    var emojiWrap = dppMk("div", null, "display:none; flex-wrap:wrap; gap:2px; padding:.3rem; background:#0e0e13; border:1px solid #3a3350; border-radius:8px; max-height:6.4rem; overflow:auto; justify-content:center;");
    emojiWrap.setAttribute("data-pp", "emoji-panel");
    DPP_EMOJIS.forEach(function (em) {
      var b = dppMk("button", null, "font-size:1rem; line-height:1; padding:2px 3px; background:transparent; border:none; cursor:pointer; border-radius:5px;");
      b.type = "button";
      b.textContent = em;
      b.onmouseenter = function () { b.style.background = "#2a2a35"; };
      b.onmouseleave = function () { b.style.background = "transparent"; };
      b.onclick = function (e) { e.stopPropagation(); dppAddEmoji(DRAGON_PP, em); };
      emojiWrap.appendChild(b);
    });
    st.emoPanel = emojiWrap;
    var emoRow = dppRow();
    emoRow.append(addEmojiBtn);
    add.append(tglRow, viewRow, promptWrap, ownWrap, styleRow, emoRow, emoCtl, emojiWrap);

    // ---- action row: Print / Cancel — CENTRED in its row ---------------------------------------
    // "↺ Default" in the Settings row and by the 💫 Upscale ⇄ ↺ Original toggle.)
    var actRow = dppRow("margin-top:.1rem;");
    var primary = (st.mode === "share")
      ? dppBtn("✔ Use this picture", "Put this edited picture back into the share window", true, function () { dppUseForShare(); }, "use")
      : dppBtn("🖨️ Print", "Send this sheet to the printer", true, function () { var o = dppSnapshot(); dragonPrintSheet(o.url, o.prompt, o); }, "print");
    var cancelBtn = dppBtn("✖ Cancel", st.mode === "share" ? "Close the editor" : "Close without printing", false, function () { dragonPrintPreviewClose(); }, "cancel");
    // and puts the sheet back the way it looked when the editor opened. A 💫 upscaled picture is NOT an
    // edit, so it is kept (the ⇄ button keeps working afterwards).
    var resetBtn = dppBtn("↺ Reset", "Undo everything you added in this editor — size, position, text, colours and emoji go back to how the editor opened. A 💫 upscaled picture is kept.", false, function () { dppResetAll(DRAGON_PP); }, "reset-all");
    actRow.append(primary, resetBtn, cancelBtn);
    st.actions = { primary: primary, cancel: cancelBtn };
    var info = dppMk("div", null, "font-size:.64rem; color:#8f86a8; line-height:1.4; text-align:center;");
    info.textContent = "ⓘ The browser's own header/footer (\"perchance\" + a date at the top) belongs to the print dialog, not to a web page — we print a margin-less sheet, which keeps it off the paper in almost every browser, and we print our own date/link at the bottom instead. If yours still adds one: switch \"Headers and footers\" off in the print window.";
    side.append(set, add, actRow, info);
    body.append(stage, side);
    ov.append(head, body);
    ov.onclick = function (e) { if (e.target === ov) dragonPrintPreviewClose(); };
    st.ov = ov; st.sheet = sheet; st.imgEl = im; st.stage = stage; st.bodyEl = body; st.sideEl = side;
    return ov;
  }
  // distances (box edge → sheet edge) in px, printed where each line meets the sheet edge.
  ;function dppGuidesShow(st, id) {
    if (!st || !st.guides || !st.sheet || !st.boxEls || !st.boxEls[id]) return;
    var g = st.guides, el = st.boxEls[id];
    var sr = st.sheet.getBoundingClientRect();
    var r = el.getBoundingClientRect();
    if (!sr.width || !sr.height) return;
    var left = Math.round(r.left - sr.left), right = Math.round(sr.right - r.right);
    var top = Math.round(r.top - sr.top), bottom = Math.round(sr.bottom - r.bottom);
    var cx = Math.round(r.left + r.width / 2 - sr.left), cy = Math.round(r.top + r.height / 2 - sr.top);
    g.layer.style.display = "block";
    g.h.style.top = cy + "px";
    g.v.style.left = cx + "px";
    g.labels.left.textContent = left + "px";
    g.labels.right.textContent = right + "px";
    g.labels.top.textContent = top + "px";
    g.labels.bottom.textContent = bottom + "px";
    g.labels.left.style.left = "2px"; g.labels.left.style.top = (cy + 3) + "px";
    g.labels.right.style.right = "2px"; g.labels.right.style.top = (cy + 3) + "px";
    g.labels.top.style.left = (cx + 4) + "px"; g.labels.top.style.top = "2px";
    g.labels.bottom.style.left = (cx + 4) + "px"; g.labels.bottom.style.bottom = "2px";
  }
  ;function dppGuidesHide(st) {
    try { if (st && st.guides) st.guides.layer.style.display = "none"; } catch (e) {}
  }
  // opened. The 💫 upscaled picture is NOT an edit, so it survives and the ⇄ button still works.
  ;function dppResetAll(st) {
    if (!st) return;
    var keepUp = st.upscaledUrl || null;
    var keepBase = st.baseUrl || st.url;
    if (st.init) {
      Object.keys(st.init).forEach(function (k) { try { st[k] = JSON.parse(JSON.stringify(st.init[k])); } catch (e) {} });
    }
    st.upscaledUrl = keepUp;
    st.baseUrl = keepBase;
    st.showing = "base";
    st.url = keepBase;
    st.rot = 0; st.touched = false; st.selEmo = -1;
    dppGuidesHide(st);
    dppBuildEmos(st);
    dppSyncPanel(st);
    if (st.imgEl) { st.natW = 0; st.natH = 0; st.fitDone = false; st.imgEl.src = st.url; }
    dragonPrintPreviewPaint();
    try {
      if (window.dragonToast) dragonToast("↺ Reset — the editor is back to how it opened" + (keepUp ? " (your 💫 upscaled picture is kept)" : ""));
    } catch (e) {}
  }
  ;function dppWireSheetDrag(st) {
    var drag = null;
    st.sheet.addEventListener("pointerdown", function (e) {
      var handle = (e.target && e.target.getAttribute) ? e.target.getAttribute("data-handle") : null;
      var boxEl = (e.target && e.target.closest) ? e.target.closest(".dpp-box") : null;
      var emoEl = (e.target && e.target.closest) ? e.target.closest(".dpp-emo") : null;
      try { st.sheet.setPointerCapture(e.pointerId); } catch (e2) {}
      var m0 = dppMini();
      if (boxEl) {
        var id = boxEl.getAttribute("data-box");
        e.preventDefault();
        e.stopPropagation();
        if (handle) {
          // AND keeps the text proportional to the box ("text size should be proportional to window"), so a
          // diagonal pull is a zoom of that text block and a sideways pull just changes its width.
          drag = { kind: "resize", id: id, x: e.clientX, y: e.clientY, b: { w: st.box[id].w, size: st.box[id].size }, k: m0 };
          return;
        }
        drag = { kind: "move", id: id, x: e.clientX, y: e.clientY, b: { x: st.box[id].x, y: st.box[id].y, w: st.box[id].w }, k: m0 };
        return;
      }
      if (emoEl) {
        e.preventDefault();
        e.stopPropagation();
        st.selEmo = parseInt(emoEl.getAttribute("data-emo"), 10);
        var ee = st.emos[st.selEmo];
        drag = { kind: "emo", idx: st.selEmo, x: e.clientX, y: e.clientY, ex: ee.x, ey: ee.y, k: m0 };
        dragonPrintPreviewPaint();
        return;
      }
      st.selEmo = -1;
      drag = { kind: "img", x: e.clientX, y: e.clientY, cx: st.cx, cy: st.cy, k: m0 };
      st.sheet.style.cursor = "grabbing";
      e.preventDefault();
    });
    st.sheet.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var m = drag.k;
      if (!(m.w > 0) || !(m.h > 0)) return;
      if (drag.kind === "img") {
        st.touched = true;
        st.cx = Math.max(-120, Math.min(220, drag.cx + (e.clientX - drag.x) / m.w * 100));
        st.cy = Math.max(-120, Math.min(220, drag.cy + (e.clientY - drag.y) / m.h * 100));
      } else if (drag.kind === "move") {
        var b = st.box[drag.id];
        b.x = Math.max(-20, Math.min(120, drag.b.x + (e.clientX - drag.x) / m.w * 100));
        b.y = Math.max(-20, Math.min(120, drag.b.y + (e.clientY - drag.y) / m.h * 100));
      } else if (drag.kind === "emo") {
        var ee = st.emos[drag.idx];
        ee.x = Math.max(-10, Math.min(110, drag.ex + (e.clientX - drag.x) / m.w * 100));
        ee.y = Math.max(-10, Math.min(110, drag.ey + (e.clientY - drag.y) / m.h * 100));
      } else {
        var bx = st.box[drag.id];
        var dw = (e.clientX - drag.x) / m.w * 100;
        var dh = (e.clientY - drag.y) / m.h * 100;
        var grow = (dw + dh) / 2;                       // a diagonal pull counts both ways
        bx.w = Math.max(6, Math.min(140, drag.b.w + grow));
        // if they're pulling it, they probably want to enlarge that text"); the A−/A+ buttons still let them fine-tune it.
        bx.size = Math.max(6, Math.min(96, Math.round(drag.b.size * (bx.w / Math.max(1, drag.b.w)))));
      }
      if (drag.kind === "move") dppGuidesShow(st, drag.id); else dppGuidesHide(st);
      dragonPrintPreviewPaint();
    });
    ;function endDrag() { drag = null; dppGuidesHide(st); try { st.sheet.style.cursor = "grab"; } catch (e) {} }
    st.sheet.addEventListener("pointerup", endDrag);
    st.sheet.addEventListener("pointercancel", endDrag);
    st.sheet.addEventListener("wheel", function (e) { e.preventDefault(); dppZoom(e.deltaY < 0 ? 1.08 : 0.93); }, { passive: false });
  }
  ;function dragonPrintPreviewOpen(url, prompt, opt) {
    opt = opt || {};
    try { var oldP = document.getElementById("dragonPrintPreview"); if (oldP && oldP.parentNode) oldP.parentNode.removeChild(oldP); } catch (e) {}
    if (!document.getElementById("dragonPrintPreviewCss")) {
      var cssEl = document.createElement("style");
      cssEl.id = "dragonPrintPreviewCss";
      cssEl.textContent = "#dragonPrintPreview .dpp-box:hover{outline-color:#c9aeff !important;} #dragonPrintPreview .dpp-panel select option{background:#14121b;color:#eee;}";
      document.head.appendChild(cssEl);
    }
    var st = dppNewState(url, prompt, opt.mode, opt.onUse);
    if (opt.withPrompt === false) st.showPrompt = false;
    if (opt.prompt !== undefined && opt.prompt !== null && String(opt.prompt).trim() !== "") st.prompt = String(opt.prompt).trim();
    if (opt.restore && opt.restore.state) {
      // hand-off from the upscale window: the visitor's text / emoji / layout work must survive
      var rs = opt.restore.state;
      Object.keys(rs).forEach(function (k) { st[k] = JSON.parse(JSON.stringify(rs[k])); });
      st.fitDone = true; st.touched = true;
      if (opt.restore.link) st.url = opt.restore.link;
      // the upscaled one it was opened with. The 💫 button flips between them without touching anything.
      st.baseUrl = opt.restore.origUrl || rs.baseUrl || st.url;
      st.upscaledUrl = url;
      st.url = url;
      st.showing = "up";
    }
    DRAGON_PP = st;
    dppBuild(st);
    document.body.appendChild(st.ov);
    setTimeout(function () { try { var fs = st.ov.querySelector("[data-pp='font']"); if (fs) { fs.style.setProperty("color", "#d8c9ff", "important"); fs.style.setProperty("border-color", "#9b6bff", "important"); } } catch (e) {} }, 0);
    dppSyncPanel(st);
    dppBuildEmos(st);
    window.addEventListener("resize", function onResize() {
      if (!document.getElementById("dragonPrintPreview")) { window.removeEventListener("resize", onResize); return; }
      if (DRAGON_PP === st) dragonPrintPreviewPaint();
    });
    dragonPrintPreviewPaint();
    st.imgEl.onload = function () {
      st.natW = st.imgEl.naturalWidth || 0;
      st.natH = st.imgEl.naturalHeight || 0;
      // the picture may finish loading AFTER the visitor started cropping — their work must survive that
      if (!st.fitDone) {
        st.fitDone = true;
        if (!st.touched) dppApplyFit(st, "fit");
        st.init = dppMutable(st);       // "↺ Original" returns to exactly this
      }
      dragonPrintPreviewPaint();
    };
    st.imgEl.onerror = function () { dragonPrintPreviewPaint(); };
    st.imgEl.src = url;
    dppWireSheetDrag(st);
    return st;
  }
  ;function dragonPrintPreviewClose() {
    try { var p = document.getElementById("dragonPrintPreview"); if (p && p.parentNode) p.parentNode.removeChild(p); } catch (e) {}
    DRAGON_PP = null;
  }
  // share mode: rasterise exactly what the sheet shows (same percent geometry, same fonts) and hand it back
  ;function dppRasterise(st) {
    return new Promise(function (resolve, reject) {
      var mm = dppSheetMm(st);
      var cv = document.createElement("canvas");
      cv.width = Math.round((mm.w / 25.4) * 150);
      cv.height = Math.round((mm.h / 25.4) * 150);
      var ctx = cv.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, cv.width, cv.height);
      var pxPerMM = cv.width / mm.w;
      var i2 = new Image();
      i2.crossOrigin = "anonymous";
      i2.onload = function () {
        var ratio = i2.naturalHeight / i2.naturalWidth;
        var turned = (st.rot % 180) !== 0;
        var iw = (st.wPct / 100) * cv.width * (turned ? ratio : 1);
        var ih = (st.wPct / 100) * cv.width * (turned ? 1 : ratio);
        ctx.save();
        ctx.translate(st.cx / 100 * cv.width, st.cy / 100 * cv.height);
        ctx.rotate(st.rot * Math.PI / 180);
        ctx.drawImage(i2, -iw / 2, -ih / 2, iw, ih);
        ctx.restore();
        DPP_BOX_IDS.forEach(function (id) {
          var txt = dppBoxText(st, id);
          if (!txt) return;
          var b = st.box[id];
          var fs = b.size * DPP_MM_PER_PX * pxPerMM;
          ctx.fillStyle = b.color;
          ctx.font = (b.bold ? "800 " : "400 ") + fs.toFixed(1) + "px " + dppFontCss(b.font);
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          var maxW = b.w / 100 * cv.width;
          var lines = [];
          String(txt).split(/\r?\n/).forEach(function (para) {
            var pieces = para.split(/(\s+)/), line = "";
            pieces.forEach(function (wd) {
              var test = line + wd;
              if (line !== "" && ctx.measureText(test).width > maxW) { lines.push(line.replace(/\s+$/, "")); line = wd.replace(/^\s+/, ""); }
              else line = test;
            });
            lines.push(line);
          });
          var x = b.x / 100 * cv.width + maxW / 2;
          var y = b.y / 100 * cv.height;
          lines.forEach(function (ln, i) { ctx.fillText(ln, x, y + i * fs * 1.45); });
        });
        (st.emos || []).forEach(function (e) {
          var fs = e.size * DPP_MM_PER_PX * pxPerMM;
          ctx.font = fs.toFixed(1) + "px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(e.em, e.x / 100 * cv.width, e.y / 100 * cv.height);
        });
        cv.toBlob(function (blob) { blob ? resolve({ blob: blob, canvas: cv }) : reject(new Error("no blob")); }, "image/png");
      };
      i2.onerror = function () { reject(new Error("image blocked for editing")); };
      i2.src = st.url;
    });
  }
  ;function dppUseForShare() {
    if (!DRAGON_PP || !DRAGON_PP.onUse) { dragonPrintPreviewClose(); return; }
    var st = DRAGON_PP, b = st.actions.primary, old = b.textContent;
    b.disabled = true; b.textContent = "⏳ Building…";
    dppRasterise(st).then(function (r) {
      var localUrl = null;
      try { localUrl = URL.createObjectURL(r.blob); } catch (e) {}
      ;function send(url) { try { st.onUse(url, localUrl || url); } catch (e) {} dragonPrintPreviewClose(); }
      if (window.root && root.uploadPlugin) {
        return root.uploadPlugin(r.blob, { expires: Date.now() + 1000 * 60 * 60 * 24 * 365 }).then(function (res) {
          if (res && res.url) send(res.url);
          else { dragonToast("⚠️ could not upload the edited picture"); dragonPrintPreviewClose(); }
        }).catch(function () { dragonToast("⚠️ could not upload the edited picture"); dragonPrintPreviewClose(); });
      }
      send(localUrl);
    }).catch(function () {
      b.disabled = false; b.textContent = old;
      dragonToast("⚠️ this picture can't be edited (its host blocks canvas editing)");
    });
  }
  ;function dragonPrintSheetDate() {
    try {
      var d = new Date();
      ;function p(n) { return (n < 10 ? "0" : "") + n; }
      return p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear();
    } catch (e) { return ""; }
  }
  ;function dragonPrintPageUrl() {
    try { return "https://perchance.org/" + (window.generatorName || "bestaigen"); } catch (e) { return ""; }
  }
  // The actual printing step: rebuilds the VISITOR'S SHEET at true paper size and prints only it. Accepts the
  // editor's snapshot (which carries `groups`, `box`, `emos`), the legacy boolean form, or a hand-made object.
  ;function dragonPrintSheet(url, capTxt, opt) {
    try {
      var o = (opt && typeof opt === "object") ? opt : { showPrompt: !!opt, wPct: 0, cx: 50, cy: 50 };
      var groups = o.groups || {
        prompt: o.showPrompt ? String(capTxt || "").trim() : "",
        date: (o.showDate === false) ? "" : ((o.date !== undefined && o.date !== null) ? String(o.date) : dragonPrintSheetDate()),
        link: (o.showLink === false) ? "" : ((o.link !== undefined && o.link !== null) ? String(o.link) : dragonPrintPageUrl()),
        own: String(o.own || "")
      };
      var box = o.box || dppBoxInit();
      var emos = o.emos || [];
      var st0 = { paper: o.paper || "a4", landscape: !!o.landscape };
      var mm = dppSheetMm(st0);
      var paperCss, nm = DPP_NAMED[st0.paper];
      if (nm) paperCss = nm + " " + (st0.landscape ? "landscape" : "portrait");
      else paperCss = mm.w + "mm " + mm.h + "mm";
      var old = document.getElementById("dragonPrintCtn"); if (old && old.parentNode) old.parentNode.removeChild(old);
      var oldCss = document.getElementById("dragonPrintCss"); if (oldCss && oldCss.parentNode) oldCss.parentNode.removeChild(oldCss);
      var ctn = document.createElement("div");
      ctn.id = "dragonPrintCtn";
      ctn.setAttribute("aria-hidden", "true");
      var sh = document.createElement("div");
      sh.className = "dragon-print-sheet";
      sh.style.width = mm.w + "mm";
      sh.style.height = mm.h + "mm";
      var im = document.createElement("img");
      im.alt = "";
      im.style.left = o.cx + "%";
      im.style.top = o.cy + "%";
      im.style.width = o.wPct + "%";
      im.style.transform = "translate(-50%,-50%) rotate(" + (o.rot || 0) + "deg)";
      sh.appendChild(im);
      DPP_BOX_IDS.forEach(function (id) {
        var txt = groups[id];
        if (!txt) return;
        var el = document.createElement("div");
        el.className = "dragon-print-box dragon-print-" + id;
        el.setAttribute("data-print-box", id);
        el.textContent = txt;
        var b = box[id] || dppBoxInit()[id];
        el.style.left = b.x + "%"; el.style.top = b.y + "%";
        el.style.width = b.w + "%";
        el.style.color = b.color;
        el.style.fontSize = (b.size * DPP_MM_PER_PX).toFixed(3) + "mm";   // true size: px-at-96dpi → mm
        el.style.fontFamily = dppFontCss(b.font);
        el.style.fontWeight = b.bold ? "800" : "400";
        sh.appendChild(el);
      });
      emos.forEach(function (e) {
        if (!e || !e.em) return;
        var el = document.createElement("div");
        el.className = "dragon-print-emo";
        el.setAttribute("data-print-emo", "1");
        el.textContent = e.em;
        el.style.left = e.x + "%"; el.style.top = e.y + "%";
        el.style.fontSize = (e.size * DPP_MM_PER_PX).toFixed(3) + "mm";
        sh.appendChild(el);
      });
      ctn.appendChild(sh);
      var st = document.createElement("style");
      st.id = "dragonPrintCss";
      st.textContent =
        "@page{size:" + paperCss + ";margin:0;}" +
        "#dragonPrintCtn{display:none;}" +
        "@media print{" +
        "html,body{background:#fff !important;margin:0 !important;padding:0 !important;text-align:center !important;color:#111 !important;}" +
        "body>*:not(#dragonPrintCtn){display:none !important;}" +
        "*{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}" +
        "#dragonPrintCtn{display:block !important;position:static !important;}" +
        "#dragonPrintCtn .dragon-print-sheet{position:relative; overflow:hidden; background:#fff; margin:0 auto;}" +
        "#dragonPrintCtn .dragon-print-sheet img{position:absolute; height:auto; page-break-inside:avoid;}" +
        "#dragonPrintCtn .dragon-print-box{position:absolute; white-space:pre-wrap; word-break:break-word; line-height:1.45; text-align:center; padding:0.26mm 0.79mm;}" +
        "#dragonPrintCtn .dragon-print-emo{position:absolute; transform:translate(-50%,-50%); line-height:1; font-family:system-ui,'Apple Color Emoji','Segoe UI Emoji',sans-serif;}" +
        "}";
      document.head.appendChild(st);
      document.body.appendChild(ctn);
      var done = false, prevTitle = null;
      try { prevTitle = document.title; document.title = "BestAiGen"; } catch (e) {}
      ;function cleanup() {
        if (done) return;
        done = true;
        try { if (ctn.parentNode) ctn.parentNode.removeChild(ctn); } catch (e) {}
        try { if (st.parentNode) st.parentNode.removeChild(st); } catch (e) {}
        try { if (prevTitle !== null) document.title = prevTitle; } catch (e) {}
        try { window.removeEventListener("afterprint", cleanup); } catch (e) {}
      }
      try { window.addEventListener("afterprint", cleanup); } catch (e) {}
      im.onload = function () {
        setTimeout(function () {
          try { window.print(); } catch (e) { try { dragonToast("🖨️ printing is not available in this browser"); } catch (e2) {} }
          setTimeout(cleanup, 4000);
        }, 80);
      };
      im.onerror = function () {
        cleanup();
        dragonToast("🖨️ could not load the image for printing");
      };
      im.src = url;
    } catch (e) {}
  }
  window.dragonPrintSheetDate = dragonPrintSheetDate;
  window.dragonPrintPageUrl = dragonPrintPageUrl;
  window.dragonPrintSheet = dragonPrintSheet;
  window.dragonPrintPreview = function (url, prompt, withPrompt) {
    if (!url) { dragonToast("🖨️ wait for the image to load"); return null; }
    return dragonPrintPreviewOpen(url, prompt, { withPrompt: withPrompt !== false, mode: "print" });
  };
  window.dragonPrintEditor = function (o) {
    o = o || {};
    if (!o.url) { dragonToast("🖨️ wait for the image to load"); return null; }
    return dragonPrintPreviewOpen(o.url, o.prompt, { mode: o.mode || "print", onUse: o.onUse || null, withPrompt: o.withPrompt !== false, restore: o.restore || null });
  };
  window.dragonPrintImage = function (url, caption) {
    if (!url) { dragonToast("🖨️ wait for the image to load"); return; }
    dragonPrintPreviewOpen(url, String(caption || "").trim(), { withPrompt: true, mode: "print" });
  };
  window.dragonPrintState = function () { return DRAGON_PP ? dppSnapshot() : null; };
  window.dragonPrintPreviewClose = dragonPrintPreviewClose;



;
})();
