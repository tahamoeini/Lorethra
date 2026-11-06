// dragon-mobile-art-picker.js — moved VERBATIM out of index.html (Paket A1, 25.09.2026). Classic script
// (not a module), inserted at the same point of the boot order, so globals and ordering are unchanged.
// Rollback: paste this file's body back into index.html as a plain <script> at its old place.
(function () {
  if (window.__dragonMobileArtPicker) return;
  window.__dragonMobileArtPicker = true;
  ;function isMobile() {
    try { return window.innerWidth <= 600 || (window.matchMedia && window.matchMedia("(pointer:coarse)").matches); }
    catch (e) { return window.innerWidth <= 600; }
  }
  ;function getSelect() { return document.querySelector('select[data-name="artStyle"]'); }
  var sel = null, root = null, listEl = null, searchEl = null;
  ;function markSelect() {
    var s = getSelect();
    if (!s) return;
    if (s !== sel) { sel = s; }
    // Only intercept the tap on touch/phone screens; on desktop the native select stays fully usable.
    try {
      var want = isMobile() ? "none" : "";
      if (s.style.pointerEvents !== want) s.style.pointerEvents = want;
    } catch (e) {}
  }
  ;function groups() {
    if (!sel) return [];
    var out = [], cur = null;
    for (var i = 0; i < sel.options.length; i++) {
      var o = sel.options[i];
      var raw = o.dataset.dragonOrig || o.text;
      if (o.disabled) {
        if (raw.indexOf("\u2500\u2500") !== -1) {
          // Header text is "── <emoji> <Name> ──" — keep the header's OWN emoji and split it off the
          // name so we never double the symbol (the emoji may be multi-codepoint, e.g. 🕹️).
          var clean = raw.replace(/\u2500+/g, "").trim();
          var sp = clean.indexOf(" ");
          var sym = sp > 0 ? clean.slice(0, sp) : "";
          var nm = sp > 0 ? clean.slice(sp + 1).trim() : clean;
          cur = { sym: sym, name: nm, items: [] };
          out.push(cur);
        }
        continue;
      }
      if (!cur) { cur = { sym: "", name: "", items: [] }; out.push(cur); }
      cur.items.push({ value: o.value, label: String(raw).replace(/\s+/g, " ").trim(), sym: cur.sym });
    }
    return out.filter(function (g) { return g.items.length; });
  }
  ;function build() {
    if (root) return;
    root = document.createElement("div");
    root.id = "dragonArtPicker";
    var card = document.createElement("div");
    card.className = "dragon-ap-card";
    var head = document.createElement("div");
    head.className = "dragon-ap-head";
    var title = document.createElement("span");
    title.className = "dragon-ap-title";
    title.textContent = "\uD83C\uDFA8 Art Style";
    var x = document.createElement("button");
    x.type = "button";
    x.className = "dragon-ap-x";
    x.textContent = "\u2715";
    x.setAttribute("aria-label", "Close");
    x.onclick = close;
    head.append(title, x);
    searchEl = document.createElement("input");
    searchEl.type = "text";
    searchEl.className = "dragon-ap-search";
    searchEl.placeholder = "\uD83D\uDD0E filter styles...";
    searchEl.addEventListener("input", filter);
    listEl = document.createElement("div");
    listEl.className = "dragon-ap-list";
    card.append(head, searchEl, listEl);
    root.appendChild(card);
    document.body.appendChild(root);
    root.addEventListener("click", function (e) { if (e.target === root) close(); });
  }
  ;function filter() {
    var q = String(searchEl.value || "").trim().toLowerCase();
    var kids = listEl.children;
    for (var i = 0; i < kids.length; i++) {
      var el = kids[i];
      if (el.classList.contains("dragon-ap-cat")) continue;
      var inner = el.querySelectorAll(".dragon-ap-item");
      var any = false;
      for (var j = 0; j < inner.length; j++) {
        var hit = !q || inner[j].textContent.toLowerCase().indexOf(q) !== -1;
        inner[j].style.display = hit ? "" : "none";
        if (hit) any = true;
      }
      el.style.display = any ? "" : "none";
    }
  }
  ;function render() {
    listEl.innerHTML = "";
    var gs = groups();
    var curVal = sel ? sel.value : "";
    var currentItem = null;
    gs.forEach(function (g) {
      var sec = document.createElement("div");
      var h = document.createElement("div");
      h.className = "dragon-ap-cat";
      h.textContent = ((g.sym ? g.sym + " " : "") + (g.name || "Styles"));
      sec.appendChild(h);
      g.items.forEach(function (it) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "dragon-ap-item" + (it.value === curVal ? " sel" : "");
        b.textContent = (it.sym ? it.sym + " " : "") + it.label;
        b.dataset.value = it.value;
        if (it.value === curVal) currentItem = b;
        b.addEventListener("click", function () { choose(it.value); });
        sec.appendChild(b);
      });
      listEl.appendChild(sec);
    });
    return currentItem;
  }
  ;function choose(val) {
    if (!sel) return;
    try { sel.value = val; } catch (e) {}
    try { if (window.input) window.input.artStyle = val; } catch (e) {}
    try { sel.dispatchEvent(new Event("change", { bubbles: true })); } catch (e) {}
    close();
  }
  ;function open() {
    build();
    if (!sel) return;
    markSelect();
    searchEl.value = "";
    var cur = render();
    root.classList.add("open");
    try { if (cur) cur.scrollIntoView({ block: "center" }); } catch (e) {}
    try { setTimeout(function () { try { searchEl.focus(); } catch (e) {} }, 60); } catch (e) {}
  }
  ;function close() { try { if (root) root.classList.remove("open"); } catch (e) {} }
  // The select has pointer-events:none, so a tap over its area never opens the OS popup — we catch it
  // at the document capture phase, hit-test the rect, and open our own panel instead.
  document.addEventListener("click", function (e) {
    if (!isMobile()) return;
    markSelect();
    if (!sel || !sel.isConnected) return;
    if (root && root.classList.contains("open")) return;
    var r = sel.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
      try { e.preventDefault(); e.stopPropagation(); } catch (er) {}
      open();
    }
  }, true);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  window.addEventListener("resize", function () {
    if (root && root.classList.contains("open") && !isMobile()) close();
    markSelect();
  });
  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    markSelect();
    if (tries > 400) clearInterval(iv);
  }, 300);
})();
