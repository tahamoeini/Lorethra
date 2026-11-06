// dragon-art-styles.js — moved VERBATIM out of index.html (Paket A1, 25.09.2026). Classic script
// (not a module), inserted at the same point of the boot order, so globals and ordering are unchanged.
// Rollback: paste this file's body back into index.html as a plain <script> at its old place.
// Pick MANY art styles (searchable, grouped, multi-select) and generate the SAME prompt in
// every selected style side by side, so they can be compared at a glance. The launcher button
// lives right under the 🎨 Art Style dropdown.
(function () {
  if (window.__dragonStyleTesterInstalled) return;
  window.__dragonStyleTesterInstalled = true;

  ;function toast(m) { try { if (window.dragonToast) window.dragonToast(m); } catch (e) {} }
  ;function getArtSelect() { return document.querySelector('select[data-name="artStyle"]'); }

  // Walk the (already emoji/category-enhanced) artStyle <select> and return
  // [{sym, name, styles:[{name,label,sym}]}] — category headers split the groups.
  ;function collectGroups() {
    var sel = getArtSelect();
    if (!sel) return null;
    var groups = [], cur = null;
    for (var i = 0; i < sel.options.length; i++) {
      var o = sel.options[i];
      var raw = o.dataset.dragonOrig || o.text;
      if (o.disabled) {
        if (raw.indexOf("\u2500\u2500") !== -1) {
          cur = { sym: o.dataset.dragonCatSym || "", name: raw.replace(/\u2500+/g, "").trim(), styles: [] };
          groups.push(cur);
        }
        continue;
      }
      if (!cur) { cur = { sym: "", name: "", styles: [] }; groups.push(cur); }
      var name = o.value.indexOf("ref:optionKeyName:") === 0 ? o.value.slice("ref:optionKeyName:".length) : o.value;
      cur.styles.push({ name: name, label: String(raw).replace(/\s+/g, " ").trim(), sym: cur.sym });
    }
    return groups.filter(function (g) { return g.styles.length; });
  }

  ;function openTester(host) {
    var groups = collectGroups();
    if (!groups) { toast("\uD83E\uDDEA style list isn't ready yet \u2014 try again in a second"); return; }
    // ⚗️ Egon 26.09.2026 — the tester also renders INLINE: pass an element and it opens inside it
    // (the 📝 Prompt Panel's "⚗️ Test Multiple Styles" tab does exactly that).
    var m = window.modalShell("dragon-tester-modal", "min(920px,96vw)", "92vh", "\u2697\uFE0F Multiple Style Tester", host);
    if (!m) { toast("couldn't open the style tester"); return; }

    var wrap = document.createElement("div");
    wrap.style.cssText = "flex:1; min-height:0; display:flex; flex-direction:column; gap:.55rem;";

    // ---- toolbar
    var bar = document.createElement("div");
    bar.style.cssText = "display:flex; flex-wrap:wrap; align-items:center; gap:.45rem;";
    var search = document.createElement("input");
    search.type = "text";
    search.placeholder = "\uD83D\uDD0E filter styles\u2026";
    search.style.cssText = "flex:1 1 12rem; min-width:8rem; padding:.4rem .55rem; border:1px solid #4a4a58; border-radius:8px; background:#0f0f15; color:#e8e6ee; font-size:.8rem;";
    var mkMini = function (b) { b.type = "button"; b.style.cssText = "padding:.4rem .6rem; border:1px solid #5a5a6a; background:linear-gradient(145deg,#2a2a33,#17171c); color:#ddd; border-radius:8px; cursor:pointer; font-size:.76rem;"; return b; };
    var btnAll = mkMini(document.createElement("button"));
    btnAll.textContent = "\u2705 Select all";
    var btnNone = mkMini(document.createElement("button"));
    btnNone.textContent = "\u2716 Clear";
    var countEl = document.createElement("span");
    countEl.style.cssText = "font-size:.74rem; color:#9d9ab5; white-space:nowrap;";
    bar.append(search, btnAll, btnNone, countEl);

    // ---- scrollable style list (grouped checkbox grid)
    var list = document.createElement("div");
    list.style.cssText = "flex:1; min-height:8rem; overflow:auto; border:1px solid #2c2c36; border-radius:10px; padding:.4rem .55rem; background:rgba(0,0,0,.25);";
    var rowInputs = [], allSections = [];
    groups.forEach(function (g) {
      var sec = document.createElement("div");
      var gh = document.createElement("div");
      gh.textContent = (g.name || "Featured styles").toUpperCase();
      gh.style.cssText = "font-size:.72rem; font-weight:bold; letter-spacing:.04em; color:#b9a6ff; margin:.5rem 0 .2rem; padding-bottom:.15rem; border-bottom:1px solid rgba(155,107,255,.25);";
      sec.appendChild(gh);
      var grid = document.createElement("div");
      grid.style.cssText = "display:grid; grid-template-columns:repeat(auto-fill,minmax(12.5rem,1fr)); gap:.1rem .5rem;";
      g.styles.forEach(function (st) {
        var row = document.createElement("label");
        row.style.cssText = "display:flex; align-items:center; gap:.4rem; padding:.2rem .35rem; border-radius:6px; cursor:pointer; font-size:.78rem; color:#e6e2f2;";
        row.onmouseenter = function () { row.style.background = "rgba(155,107,255,.14)"; };
        row.onmouseleave = function () { row.style.background = ""; };
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = st.name;
        cb.style.cssText = "flex:0 0 auto; cursor:pointer;";
        var sp = document.createElement("span");
        sp.textContent = st.label;
        sp.title = st.name;
        row.append(cb, sp);
        grid.appendChild(row);
        rowInputs.push({ row: row, cb: cb, hay: (st.label + " " + g.name + " " + (st.sym || "")).toLowerCase(), group: sec });
      });
      sec.appendChild(grid);
      list.appendChild(sec);
      allSections.push(sec);
    });

    // ---- footer: prompt / negative / options / generate
    var foot = document.createElement("div");
    foot.style.cssText = "display:flex; flex-direction:column; gap:.45rem; border-top:1px solid rgba(255,255,255,.08); padding-top:.5rem;";
    var prow = document.createElement("div");
    prow.style.cssText = "display:flex; gap:.5rem; flex-wrap:wrap;";
    var pta = document.createElement("textarea");
    pta.placeholder = "Description to test\u2026";
    pta.style.cssText = "flex:2 1 18rem; min-width:12rem; height:3.4rem; resize:vertical; padding:.4rem .5rem; border:1px solid #4a4a58; border-radius:8px; background:#0f0f15; color:#e8e6ee; font-size:.8rem;";
    var nta = document.createElement("textarea");
    nta.placeholder = "Negative prompt (optional)\u2026";
    nta.style.cssText = "flex:1 1 12rem; min-width:9rem; height:3.4rem; resize:vertical; padding:.4rem .5rem; border:1px solid #4a4a58; border-radius:8px; background:#0f0f15; color:#e8e6ee; font-size:.8rem;";
    prow.append(pta, nta);
    try { var dta = document.querySelector('textarea[data-name="description"]'); pta.value = (window.input && window.input.description) || (dta ? dta.value : "") || ""; } catch (e) {}
    try { nta.value = (window.input && window.input.negative) || ""; } catch (e) {}

    var orow = document.createElement("div");
    orow.style.cssText = "display:flex; flex-wrap:wrap; align-items:center; gap:.6rem;";
    var seedWrap = document.createElement("label");
    seedWrap.style.cssText = "display:flex; align-items:center; gap:.35rem; font-size:.76rem; color:#cfc8e6; cursor:pointer;";
    var seedCb = document.createElement("input");
    seedCb.type = "checkbox";
    seedCb.checked = true;
    seedWrap.append(seedCb, document.createTextNode("\uD83D\uDD12 same seed for all styles (fair comparison)"));
    var go = document.createElement("button");
    go.type = "button";
    go.style.cssText = "margin-left:auto; padding:.55rem 1.1rem; border:1px solid #22c55e; background:linear-gradient(145deg,#14532d,#052e16); color:#bbf7d0; border-radius:10px; cursor:pointer; font-size:.9rem; font-weight:bold;";
    orow.append(seedWrap, go);

    foot.append(prow, orow);
    wrap.append(bar, list, foot);
    m.box.appendChild(wrap);

    // preselect the current art style
    try {
      var sel = getArtSelect();
      var cur = sel && window.input && window.input.artStyle && window.input.artStyle.getName;
      if (cur) for (var ri = 0; ri < rowInputs.length; ri++) if (rowInputs[ri].cb.value === cur) rowInputs[ri].cb.checked = true;
    } catch (e) {}

    ;function applyFilter() {
      var q = search.value.trim().toLowerCase();
      for (var i = 0; i < rowInputs.length; i++) {
        rowInputs[i].row.style.display = (!q || rowInputs[i].hay.indexOf(q) !== -1) ? "" : "none";
      }
      for (var s = 0; s < allSections.length; s++) {
        var rows = allSections[s].querySelectorAll("label");
        var any = false;
        for (var k = 0; k < rows.length; k++) if (rows[k].style.display !== "none") { any = true; break; }
        allSections[s].style.display = any ? "" : "none";
      }
    }
    ;function visibleRows() {
      var out = [];
      for (var i = 0; i < rowInputs.length; i++) if (rowInputs[i].row.style.display !== "none") out.push(rowInputs[i]);
      return out;
    }
    ;function selected() {
      var out = [];
      for (var i = 0; i < rowInputs.length; i++) if (rowInputs[i].cb.checked) out.push(rowInputs[i].cb.value);
      return out;
    }
    ;function updateCount() {
      var n = selected().length;
      countEl.textContent = n + " selected";
      go.textContent = "\u26A1 Generate " + n + " style" + (n === 1 ? "" : "s");
    }
    search.addEventListener("input", applyFilter);
    list.addEventListener("change", updateCount);
    btnAll.onclick = function () { visibleRows().forEach(function (r) { r.cb.checked = true; }); updateCount(); };
    btnNone.onclick = function () { for (var i = 0; i < rowInputs.length; i++) rowInputs[i].cb.checked = false; updateCount(); };

    go.onclick = function () {
      var names = selected();
      if (!names.length) { toast("\uD83E\uDDEA pick at least one style first"); return; }
      var desc = pta.value.trim();
      if (!desc) { toast("\u270F\uFE0F type a description to test first"); pta.focus(); return; }
      if (names.length > 24) {
        window.dragonVaultConfirm({ title: "\uD83E\uDDEA Generate " + names.length + " images?", body: names.length + " styles will generate " + names.length + " images at once. Continue?", confirmText: "Continue" }).then(function (r) { if (!r.ok) return; var neg = nta.value; m.close(); runTest(names, desc, neg, seedCb.checked); });
        return;
      }
      var neg = nta.value;
      m.close();
      runTest(names, desc, neg, seedCb.checked);
    };

    applyFilter();
    updateCount();
    setTimeout(function () { try { pta.focus(); } catch (e) {} }, 50);
  }

  // Generate the same prompt once per style into #outputAreaEl. Each image is a normal
  // .t2i-image-ctn so the framework adds the usual action buttons (zoom/star/upscale…).
  ;function runTest(names, desc, neg, lockSeed) {
    var s = window.___userSettings746291937;
    if (!s || !s.userInputs || !s.userInputs.artStyle) { toast("style tester isn't ready yet"); return; }
    var art = s.userInputs.artStyle;
    var compiled = art.compiledOptions || {};
    var valid = [];
    var skipped = [];
    for (var _vi = 0; _vi < names.length; _vi++) {
      if (compiled[names[_vi]] === undefined) skipped.push(names[_vi]);
      else valid.push(names[_vi]);
    }
    if (skipped.length) toast("⚠️ unknown styles skipped: " + skipped.join(", "));
    if (!valid.length) { toast("⚠️ couldn't start the style test"); return; }
    var oa = document.getElementById("outputAreaEl");
    if (!oa) { toast("⚠️ the output area isn't ready"); return; }
    var tilePx = "450px";
    try {
      if (window.dragonProdTilePx) tilePx = String(window.dragonProdTilePx());
      else { var _tv = getComputedStyle(document.documentElement).getPropertyValue("--dragon-prod-tile").trim(); if (_tv) tilePx = _tv; }
    } catch (eT) {}
    if (tilePx !== "100%" && !/^\d+px$/.test(tilePx)) tilePx = "450px";

    if (window.input) { try { window.input.description = desc; window.input.negative = neg; } catch (e) {} }

    var prevStyle = window.input ? window.input.artStyle : undefined;
    var seed = (typeof lockSeed === "number" && lockSeed >= 0 && lockSeed <= 2147483647) ? Math.floor(lockSeed) : (lockSeed ? Math.floor(Math.random() * 2147483647) : null);

    oa.innerHTML = "";
    var msg = document.createElement("div");
    msg.style.cssText = "flex:0 0 100%; width:100%; text-align:center; padding:.35rem .5rem .6rem; font-size:.82rem; color:#c9b8ff;";
    msg.textContent = "\u2697\uFE0F style test \u2014 " + valid.length + " style" + (valid.length === 1 ? "" : "s") + ", same prompt" + (seed !== null ? " \u00B7 seed " + seed : "");
    try { var _bv = (typeof root !== "undefined" && root.buildVersion) ? String(root.buildVersion).replace(/["']/g, "") : ""; if (_bv) msg.textContent += " \u00B7 build " + _bv; } catch (eB) {}
    oa.appendChild(msg);

    var made = 0;
    valid.forEach(function (styleName) {
      var val = compiled[styleName];
      if (val === undefined) return;
      try { if (window.input) window.input.artStyle = val; } catch (e) { return; }
      var io = s.imageOptions;
      var clone;
      try {
        clone = io.createClone;
        clone.prompt = io.prompt.evaluateItem;
        clone.negativePrompt = io.negativePrompt.evaluateItem;
        if (io.saveTitle) clone.saveTitle = io.saveTitle.evaluateItem;
        if (seed !== null) clone.seed = seed;
      } catch (e) { return; }
      var html;
      try { html = String(window.___textToImagePlugin746291937(clone)); } catch (e) { html = null; }
      if (!html) return;
      made++;
      var ctn = document.createElement("div");
      ctn.className = "t2i-image-ctn dragon-tester-ctn";
      ctn.style.cssText = "margin:0.25rem; margin-bottom:0.6rem; position:relative; width:" + tilePx + "; max-width:100%; border:1px solid rgba(155,107,255,.35); border-radius:10px; overflow:hidden; background:rgba(20,16,32,.5);";
      var lab = document.createElement("div");
      lab.className = "dragon-tester-label";
      lab.textContent = styleName;
      lab.style.cssText = "display:block; width:100%; box-sizing:border-box; text-align:center; margin-bottom:.3rem; padding:.15rem .5rem; font-size:.72rem; font-weight:bold; color:#d8c9ff; background:rgba(155,107,255,.14); border:1px solid rgba(155,107,255,.35); border-radius:8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;";
      ctn.appendChild(lab);
      ctn.insertAdjacentHTML("beforeend", html);
      try { var _hif = ctn.querySelector("iframe"); if (_hif) _hif.style.setProperty("width", "100%", "important"); } catch (eHW) {}
      var under = document.createElement("div");
      under.className = "t2i-under-each-image-ctn";
      ctn.appendChild(under);
      oa.appendChild(ctn);
      try { if (window.dragonTesterTileReady) window.dragonTesterTileReady(ctn); } catch (eTR) {}
    });

    try { if (window.input) window.input.artStyle = prevStyle; } catch (e) {}
    if (!made) toast("\u26A0\uFE0F couldn't start the style test");
    try { oa.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {}
  }

  // The ⚗️ Test Multiple Styles launcher button under the Art Style dropdown is gone: the tester opens inside
  // the 📝 Prompt Panel's own tab now (window.dragonStyleTester is unchanged). The button's production is in
  // the Librarybook DEPO.
  ;function installButton() {
    return true;
  }
  // Any button built by an earlier build is removed from the page.
  try { var _oldTesterBtns = document.querySelectorAll(".dragon-tester-open"); for (var _otb = 0; _otb < _oldTesterBtns.length; _otb++) { try { _oldTesterBtns[_otb].parentNode.removeChild(_oldTesterBtns[_otb]); } catch (e) {} } } catch (e) {}
  window.dragonStyleTester = openTester;
  // Egon 27.09.2026 (W-FEAT313) — the comparison runner is exposed: the 🎨 Art Style panel's
  // "Test Multiple Styles" mode renders the same one-image-per-style comparison straight from the panel.
  window.dragonStyleTestRun = runTest;

  var pending = false;
  ;function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(function () { pending = false; installButton(); }, 300);
  }
  ;function start() {
    installButton();
    if (document.body) dragonBodyObserve(schedule);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
