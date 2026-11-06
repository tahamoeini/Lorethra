// dragon-fast-tips.js — moved VERBATIM out of index.html (Paket A1, 25.09.2026). Classic script
// (not a module), inserted at the same point of the boot order, so globals and ordering are unchanged.
// Rollback: paste this file's body back into index.html as a plain <script> at its old place.
// was coming with operating system latency). When this layer reaches an element with a cursor, the title
// temporarily moves to data-dragon-tip (silences native) and after ~140ms a small one fitting the theme
// shows a box. When the mouse leaves, the title is rewritten. Disabled on touch.
// A titled element INSIDE another titled element (day 🧹 inside the day heading, a gallery
// button inside a collapse bar) used to show TWO tips — ours plus the parent's native one —
// so the hovered element's ANCESTORS are silenced too while our tip is armed, then restored.
(function () {
  if (window.__dragonFastTips) return;
  try { if (window.matchMedia && !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return; } catch (e) {}
  window.__dragonFastTips = true;
  var tip = null, showTimer = null, curBtn = null, curTitle = "", curData = null, moved = false;
  var ancMoved = [];
  ;function silenceAncestors(b) {
    ancMoved = [];
    try {
      var p = b ? b.parentElement : null, n = 0;
      while (p && n < 8 && p !== document.body) {
        if (p.getAttribute && p.hasAttribute("title")) {
          ancMoved.push({ el: p, title: p.getAttribute("title") });
          p.removeAttribute("title");
        }
        p = p.parentElement; n++;
      }
    } catch (e) {}
  }
  ;function restoreAncestors() {
    for (var i = 0; i < ancMoved.length; i++) {
      try {
        var a = ancMoved[i];
        if (a.el && a.el.isConnected && !a.el.hasAttribute("title")) a.el.setAttribute("title", a.title);
      } catch (e) {}
    }
    ancMoved = [];
  }
  var lastX = 0, lastY = 0, lastW = 0, lastH = 0;
  ;function ensure() {
    if (tip) return tip;
    tip = document.createElement("div");
    tip.id = "dragonFastTip";
    tip.style.cssText = "position:fixed; left:0; top:0; z-index:2147483648; max-width:280px; padding:.34rem .5rem; border-radius:7px; background:rgba(20,16,28,.97); color:#e8e0ff; font-family:system-ui; font-size:.72rem; line-height:1.35; border:1px solid rgba(155,107,255,.6); box-shadow:0 6px 22px rgba(0,0,0,.6); pointer-events:none; opacity:0; transition:opacity .1s ease; white-space:pre-line; text-align:center; box-sizing:border-box;";
    (document.body || document.documentElement).appendChild(tip);
    return tip;
  }
  ;function place() {
    if (!tip) return;
    var left = lastX + 14, top = lastY + 16;
    if (left + lastW > window.innerWidth - 8) left = Math.max(6, window.innerWidth - 8 - lastW);
    if (top + lastH > window.innerHeight - 8) top = Math.max(6, lastY - lastH - 12);
    tip.style.left = left + "px";
    tip.style.top = top + "px";
  }
  ;function hide() {
    if (showTimer) { clearTimeout(showTimer); showTimer = null; }
    if (tip) tip.style.opacity = "0";
    try { restoreAncestors(); } catch (eA) {}
    if (curBtn) {
      try {
        if (curData != null && moved) {
          if (!curBtn.hasAttribute("title")) curBtn.setAttribute("title", curTitle);
        }
        // only an element whose title WE moved gets it taken back: an element that carries its tip in
        // `data-dragon-tip` of its own accord (the ⭐ count chip) keeps it, so the themed layer can read it
        if (moved) curBtn.removeAttribute("data-dragon-tip");
      } catch (e) {}
      curBtn = null; curData = null; moved = false;
    }
  }
  try { window.dragonFastTipHide = hide; } catch (e) {}
  ;function show() {
    var el = ensure();
    el.textContent = curTitle;
    el.style.opacity = "0";
    lastW = el.offsetWidth; lastH = el.offsetHeight;
    place();
    el.style.opacity = "1";
  }
  ;function pick(ev) {
    var t = ev.target;
    if (!t || t.nodeType !== 1) return null;
    return t.closest ? t.closest("button,[title],[data-dragon-tip]") : null;
  }
  document.addEventListener("mousemove", function (e) {
    lastX = e.clientX; lastY = e.clientY;
    // the hovered control may have been removed from the DOM (e.g. a panel closed under the cursor) —
    // mouseout never fires then, so clear the tooltip ourselves instead of leaving it stuck to the mouse.
    if (curBtn && !curBtn.isConnected) { hide(); return; }
    if (curBtn && tip && tip.style.opacity === "1") place();
  }, true);
  document.addEventListener("mouseover", function (e) {
    var b = pick(e);
    if (b === curBtn) return;
    hide();
    if (!b) return;
    var own = b.getAttribute("data-dragon-tip");
    var title = b.getAttribute("title") || own;
    if (!title) return;
    lastX = e.clientX; lastY = e.clientY;
    curTitle = title; curData = title; curBtn = b; moved = !own;
    if (moved) { b.setAttribute("data-dragon-tip", title); b.removeAttribute("title"); }
    silenceAncestors(b);
    showTimer = setTimeout(function () { showTimer = null; if (curBtn) show(); }, 140);
  }, true);
  document.addEventListener("mouseout", function (e) {
    var b = pick(e);
    if (!b || b !== curBtn) return;
    if (e.relatedTarget && b.contains(e.relatedTarget)) return;
    hide();
  }, true);
})();
