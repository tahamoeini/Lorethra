// dragon-gen-hooks.js — moved VERBATIM out of index.html (Paket A1, 25.09.2026). Classic script
// (not a module), inserted at the same point of the boot order, so globals and ordering are unchanged.
// Rollback: paste this file's body back into index.html as a plain <script> at its old place.
// ===== Incremental re-apply from 1.3.0 — Item 6: Generate hooks + ⚡ Generate button =====
(function () {
  if (window.__dragonGenHooksInstalled) return;
  window.__dragonGenHooksInstalled = true;

  ;function toast(m) { try { if (window.dragonToast) window.dragonToast(m); } catch (e) {} }

  ;function dragonSetDesc(v) {
    try {
      var val = String(v == null ? "" : v);
      var ta = document.querySelector('textarea[data-name="description"]');
      if (ta) ta.value = val;
      if (window.input) { try { window.input.description = val; } catch (e) {} }
      try { var spec = window.___userSettings746291937 && window.___userSettings746291937.userInputs && window.___userSettings746291937.userInputs.description; if (spec) spec.value = val; } catch (e) {}
      if (ta) ta.dispatchEvent(new Event("input", { bubbles: true }));
      return !!ta;
    } catch (e) { return false; }
  }
  ;function dragonLockSeed(n) {
    try {
      var si = document.querySelector('[data-name="seed"]');
      if (si) { si.value = String(n); si.dispatchEvent(new Event("input", { bubbles: true })); si.dispatchEvent(new Event("change", { bubbles: true })); }
      if (window.input) window.input.seed = String(n);
    } catch (e) {}
  }
  // It must NOT write into the seed <input> (that flips the user's seed-lock button on). The seed
  // injector appends " (seed:::N)" to the prompt for this generation only, then the capture clears it.
  window.dragonForceSeed = function (n) {
    var v = String(n == null ? "" : n).replace(/\D/g, "");
    if (!v) return;
    window.__dragonForceSeed = v;
    try { clearTimeout(window.__dragonForceSeedT); } catch (e) {}
    window.__dragonForceSeedT = setTimeout(function () { window.__dragonForceSeed = null; }, 5000);
  };
  ;function dragonGenPolicyGone() {
    try { var b = document.getElementById("dragonGenPolicyBtn"); if (b) b.remove(); } catch (e) {}
    try { localStorage.removeItem("dragonGenPolicy"); } catch (e2) {}
  }
  // area sits directly below it, so a history/gallery "Generate" jumps straight there (no scroll-dance).
  ;function dragonAlignOutputTop() {
    var navH = 42;
    try { navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--dragon-nav-h")) || 42; } catch (e) {}
    var gb = document.querySelector("#generateButtonEl");
    if (!gb) return;
    var y = gb.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop || 0) - navH - 4;
    try { window.scrollTo({ top: Math.max(0, y), behavior: "auto" }); } catch (e) { try { window.scrollTo(0, Math.max(0, y)); } catch (e2) {} }
  }
  ;function dragonGenScroll() {
    try { if (window.dragonGoMonitor) { window.dragonGoMonitor(); return; } } catch (e) {}
    dragonAlignOutputTop();
  }
  ;function dragonTriggerGen() {
    try { if (window.dragonProdBeginGeneration) window.dragonProdBeginGeneration(); } catch (eB) {}
    try { var _ph = document.querySelector(".dragon-placeholder"); if (_ph) _ph.remove(); } catch (eP) {}
    try {
      if (window.___generateButtonClickEvent746291937) window.___generateButtonClickEvent746291937();
      else { var gb = document.querySelector("#generateButtonEl"); if (gb) gb.click(); }
    } catch (e) { try { var gb2 = document.querySelector("#generateButtonEl"); if (gb2) gb2.click(); } catch (e2) {} }
    dragonGenScroll();
    setTimeout(function () {
      try { if (window.dragonGoMonitor) window.dragonGoMonitor(); } catch (eS2) {}
    }, 600);
  }
  ;function dragonGenFromPrompt(p) {
    // (same flow as the History page's Generate button), not just run while another page is showing.
    if (window.dragonGoPage) { try { window.dragonGoPage("generate"); } catch (e) {} }
    dragonSetDesc(p);
    dragonTriggerGen();
    toast("⚡ generating\u2026");
  }
  window.dragonSetDesc = dragonSetDesc;
  window.dragonLockSeed = dragonLockSeed;
  window.dragonTriggerGen = dragonTriggerGen;
  window.dragonGenFromPrompt = dragonGenFromPrompt;

  ;function findVisibleDescTa() {
    var tas = document.querySelectorAll('textarea[data-name="description"]');
    for (var i = 0; i < tas.length; i++) {
      var r = tas[i].getBoundingClientRect();
      if (r.width > 0 && getComputedStyle(tas[i]).display !== "none") return tas[i];
    }
    return null;
  }
  ;function dragonGenBtnPlace() {
    // Egon 29.10.2026 — the big purple button sits INSIDE the description area, right under
    // the text box (in the textarea's own cell, next to the right button column — the old place).
    try {
      var b = document.querySelector(".dragon-gen-btn");
      if (!b || !b.isConnected) return false;
      var ta = findVisibleDescTa();
      if (!ta || !ta.parentElement) return false;
      var cell = ta.parentElement;
      var ctn = ta.closest ? ta.closest(".input-ctn") : null;
      // cleanup of the 2.85.3–2.85.4 full-width row experiment (flex line under the panel).
      if (ctn && ctn.style.flexWrap === "wrap") { try { ctn.style.removeProperty("flex-wrap"); } catch (eW) {} }
      b.style.display = "block";
      b.style.width = "100%";
      b.style.maxWidth = "none";
      b.style.flex = "";
      b.style.margin = "6px 0 0";
      b.style.boxSizing = "border-box";
      if (b.parentElement === cell && b.previousElementSibling === ta) return true;
      cell.insertBefore(b, ta.nextSibling);
      return true;
    } catch (e) { return false; }
  }
  window.dragonGenBtnPlace = dragonGenBtnPlace;
  ;function installGenBtn() {
    var exist = document.querySelector(".dragon-gen-btn");
    if (exist && exist.isConnected) { dragonGenBtnPlace(); return; }
    var ta = findVisibleDescTa();
    if (!ta || !ta.parentElement) return;
    var holder = ta.parentElement;
    var b = document.createElement("button");
    b.className = "dragon-gen-btn";
    b.type = "button";
    b.innerHTML = "<span class='dragon-spark-em'>\u2728</span> Generate <span class='dragon-spark-em dragon-spark-em-r'>\u2728</span>";
    b.title = "Generate now \u2014 uses the current description";
    // so it keeps the dark unity of the panel.
    b.style.cssText = "display:block; width:100%; max-width:none; margin:6px 0 0; padding:.42rem .6rem; font-size:.78rem; font-weight:bold; color:#fff; background:linear-gradient(180deg,#0a0a0c 0%,#5b32c9 48%,#7a4dff 100%); border:1px solid #c9a8ff; border-radius:8px; cursor:pointer; box-sizing:border-box;";
    b.onclick = function () {
      // are queued, so do NOT show the "description is empty" warning — fire the queue (twin of the main
      // Generate button's behaviour).
      if (window.__dragonPQ && window.__dragonPQ.active()) { try { window.__dragonPQ.run(); } catch (e) {} return; }
      var ta2 = findVisibleDescTa();
      var v = ta2 ? String(ta2.value || "") : "";
      if (!v.trim()) { toast("description is empty \u2014 type something first"); return; }
      dragonGenFromPrompt(v);
    };
    var realGen = document.getElementById("generateButtonEl");
    if (realGen) {
      try {
        new MutationObserver(function () {
          if (realGen.disabled) { b.style.opacity = ".45"; b.style.pointerEvents = "none"; }
          else { b.style.opacity = "1"; b.style.pointerEvents = "auto"; }
        }).observe(realGen, { attributes: true });
      } catch (e) {}
    }
    try { holder.insertBefore(b, ta.nextSibling); } catch (eA) { return; }
    // Egon 29.10.2026 — settle it under the text box; retry briefly if built early.
    if (!dragonGenBtnPlace()) {
      var _tries = 0;
      var _iv = setInterval(function () {
        _tries++;
        try { if (dragonGenBtnPlace() || _tries > 20) clearInterval(_iv); } catch (eI) { try { clearInterval(_iv); } catch (eC) {} }
      }, 500);
    }
  }
  // cycle, so its sparkles are re-dressed each time it returns to the idle label: small, flanking the
  // text, and the right one mirrored — the same treatment the Home Character-Creation dancers use.
  ;function installGenSparkles() {
    var gb = document.getElementById("generateButtonEl");
    if (!gb || gb.__dragonSparkHook) return;
    gb.__dragonSparkHook = true;
    var dress = function () {
      try {
        if (gb.querySelector(".dragon-spark-em")) return;
        var t = gb.textContent || "";
        if (t.indexOf("\u2728") === -1 || /generating/i.test(t)) return;
        gb.innerHTML = gb.innerHTML.replace(/\u2728/g, "<span class='dragon-spark-em'>\u2728</span>");
      } catch (e) {}
    };
    dress();
    new MutationObserver(dress).observe(gb, { childList: true, subtree: true, characterData: true });
  }
  ;function boot() {
    try { installGenBtn(); } catch (e) {}
    try { installGenSparkles(); } catch (e) {}
    try { dragonGenPolicyGone(); } catch (eP) {}
    dragonBodyObserve(function () { try { installGenBtn(); } catch (e) {} try { installGenSparkles(); } catch (e) {} try { dragonGenPolicyGone(); } catch (eP2) {} });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
