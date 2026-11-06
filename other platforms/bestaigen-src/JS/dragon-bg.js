// dragon-bg.js — moved VERBATIM out of index.html (Paket A1, 25.09.2026). Classic script
// (not a module), inserted at the same point of the boot order, so globals and ordering are unchanged.
// Rollback: paste this file's body back into index.html as a plain <script> at its old place.
(function () {
  "use strict";
  var STORE_KEY = "dragonBgId";
  var BASE_BG = "#131516";
  var escFn = null;

  ;function parseList() {
    var arr = [], out = [], seen = {}, raw = null;
    try { raw = (window.root && root.dragonBackgrounds) || null; } catch (e) { raw = null; }
    try {
      if (raw && raw.selectAll) {
        for (var i = 0; i < raw.selectAll.length; i++) { try { arr.push(raw.selectAll[i].evaluateItem); } catch (e) {} }
      } else if (Object.prototype.toString.call(raw) === "[object Array]") {
        arr = raw;
      } else if (raw != null) {
        arr = [raw];
      }
    } catch (e) { arr = []; }
    if (!arr.length) arr = ["No background|"];
    for (var j = 0; j < arr.length; j++) {
      var s = String(arr[j] == null ? "" : arr[j]);
      var parts = s.split("|");
      var name = String(parts[0] || "").trim();
      var url = String(parts[1] || "").trim();
      // used to tint the Settings button for that background.
      var acc = String(parts[2] || "").trim();
      if (!name) continue;
      var id = j === 0 ? "none" : "bg" + j;
      if (seen[id]) continue;
      seen[id] = 1;
      out.push({ id: id, name: id === "none" ? "No background" : name, url: /^https?:\/\//i.test(url) ? url : "", accent: /^#[0-9a-f]{6}$/i.test(acc) ? acc : "" });
    }
    if (!out.length || out[0].id !== "none") out.unshift({ id: "none", name: "No background", url: "", accent: "" });
    return out;
  }
  ;function byId(id) {
    var a = parseList();
    for (var i = 0; i < a.length; i++) { if (a[i].id === id) return a[i]; }
    return null;
  }
  ;function get() { var v = ""; try { v = String(localStorage.getItem(STORE_KEY) || ""); } catch (e) {} return v; }
  ;function set(v) { try { localStorage.setItem(STORE_KEY, String(v || "")); } catch (e) {} }
  ;function storedRaw() { try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; } }
  ;function defaultId() {
    var a = parseList();
    for (var i = 0; i < a.length; i++) { if (a[i].url && /^nebula$/i.test(a[i].name)) return a[i].id; }
    for (var j = 0; j < a.length; j++) { if (a[j].url) return a[j].id; }
    return "";
  }
  ;function chooseId() { var r = storedRaw(); return r === null ? defaultId() : String(r || ""); }

  /* The veil = the ACTIVE THEME's own page colour turned semi-transparent, so a picture never makes text
     unreadable and each of the 22 themes keeps its character. Light colours get a slightly heavier veil. */
  ;function toRgb(v) {
    v = String(v || "").trim();
    var m = v.match(/^#([0-9a-f]{3})$/i);
    if (m) { var h = m[1]; return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)]; }
    m = v.match(/^#([0-9a-f]{6})$/i);
    if (m) { var s = m[1]; return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]; }
    m = v.match(/^rgba?\(([^)]+)\)$/i);
    if (m) {
      var p = m[1].split(/[\s,\/]+/).filter(function (x) { return x !== ""; });
      if (p.length >= 3) return [Math.round(parseFloat(p[0])), Math.round(parseFloat(p[1])), Math.round(parseFloat(p[2]))];
    }
    return null;
  }
  ;function veil() {
    var raw = "";
    try { raw = getComputedStyle(document.documentElement).getPropertyValue("--dt-bg") || ""; } catch (e) {}
    var rgb = toRgb(raw) || toRgb(BASE_BG);
    var lum = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
    var a = lum > 0.55 ? 0.62 : 0.52;
    return "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + a + ")";
  }
  ;function layer() {
    var el = document.getElementById("dragonBgLayer");
    if (!el) { el = document.createElement("div"); el.id = "dragonBgLayer"; document.body.appendChild(el); }
    return el;
  }
  ;function removeLayer() {
    var el = document.getElementById("dragonBgLayer");
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }
  ;function apply() {
    var rootEl = document.documentElement;
    var entry = byId(chooseId());
    if (!entry || !entry.url) {
      rootEl.removeAttribute("data-dragon-bg");
      rootEl.style.removeProperty("--dragon-bg-url");
      rootEl.style.removeProperty("--dragon-bg-veil");
      removeLayer();
      return;
    }
    var col = veil();
    var g = "linear-gradient(" + col + "," + col + ")";
    rootEl.style.setProperty("--dragon-bg-veil", g);
    rootEl.style.setProperty("--dragon-bg-url", 'url("' + entry.url + '")');
    rootEl.setAttribute("data-dragon-bg", entry.id);
    layer();
  }
  window.dragonBgApply = apply;
  window.dragonBgList = parseList;
  window.dragonBgVeil = veil;
  window.dragonBgGet = function () { var e = byId(chooseId()); return e && e.url ? e.id : "none"; };
  window.dragonBgSet = function (id) {
    var e = byId(id);
    if (!e) return false;
    set(e.url ? e.id : "");
    apply();
    syncBtn();
    syncTiles();
    try { if (window.dragonToast) dragonToast("\uD83D\uDDBC\uFE0F Background: " + e.name); } catch (er) {}
    return true;
  };

  ;function syncTiles() {
    var box = document.getElementById("dragonBgGrid");
    if (!box) return;
    var cur = window.dragonBgGet();
    var tiles = box.querySelectorAll(".dragon-bg-tile");
    for (var i = 0; i < tiles.length; i++) {
      tiles[i].setAttribute("data-on", tiles[i].getAttribute("data-value") === cur ? "1" : "0");
    }
  }
  ;function closePick() {
    var ov = document.getElementById("dragonBgPick");
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    if (escFn) { document.removeEventListener("keydown", escFn); escFn = null; }
  }
  window.dragonBgOpen = function () {
    closePick();
    var ov = document.createElement("div");
    ov.id = "dragonBgPick";
    var card = document.createElement("div");
    card.className = "dragon-bg-card";
    var head = document.createElement("div");
    head.className = "dragon-bg-head";
    var ttl = document.createElement("div");
    ttl.className = "dragon-bg-title";
    ttl.textContent = "\uD83D\uDDBC\uFE0F Background";
    var x = document.createElement("button");
    x.type = "button"; x.className = "dragon-bg-x"; x.textContent = "\u2715"; x.title = "Close";
    head.appendChild(ttl); head.appendChild(x);
    var hint = document.createElement("div");
    hint.className = "dragon-bg-hint";
    hint.textContent = "Pick a picture to sit behind the whole site \u2014 Nebula comes on by default.";
    var grid = document.createElement("div");
    grid.className = "dragon-bg-grid";
    grid.id = "dragonBgGrid";
    var items = parseList();
    var cur = window.dragonBgGet();
    items.forEach(function (it) {
      var t = document.createElement("button");
      t.type = "button";
      t.className = "dragon-bg-tile";
      t.setAttribute("data-value", it.id);
      t.setAttribute("data-on", it.id === cur ? "1" : "0");
      t.title = it.url ? "Use this picture as the site background" : "No background \u2014 the site's plain look";
      var th = document.createElement("span");
      th.className = "dragon-bg-thumb" + (it.url ? "" : " dragon-bg-nonethumb");
      if (it.url) th.style.backgroundImage = 'url("' + it.url + '")'; else th.textContent = "\uD83D\uDEAB";
      var cap = document.createElement("span");
      cap.className = "dragon-bg-cap";
      cap.textContent = it.name;
      var tick = document.createElement("span");
      tick.className = "dragon-bg-tick";
      tick.textContent = "\u2713";
      t.appendChild(th); t.appendChild(cap); t.appendChild(tick);
      t.onclick = function (e) { e.stopPropagation(); window.dragonBgSet(it.id); };
      grid.appendChild(t);
    });
    card.appendChild(head); card.appendChild(hint); card.appendChild(grid);
    ov.appendChild(card);
    x.onclick = function (e) { e.stopPropagation(); closePick(); };
    ov.onclick = function (e) { if (e.target === ov) closePick(); };
    escFn = function (ev) { if (ev.key === "Escape" || ev.keyCode === 27) closePick(); };
    document.addEventListener("keydown", escFn);
    document.body.appendChild(ov);
    syncTiles();
  };

  /* ---- the Settings button (it lives in the "🖼 UI & Display" card) ---- */
  var btn = null;
  ;function syncBtn() {
    if (!btn) return;
    var e = byId(chooseId());
    var on = !!(e && e.url);
    btn.textContent = "\uD83D\uDDBC\uFE0F Background: " + (on ? e.name : "None");
    btn.setAttribute("data-on", on ? "1" : "0");
    // its own accent (3rd field of the dragonBackgrounds entries), so Nebula tints it violet, Aurora
    // teal, Embers orange, and "No background" keeps the neutral purple.
    var acc = (on && e && e.accent) ? e.accent : "";
    if (acc) {
      btn.style.borderColor = acc;
      btn.style.background = "linear-gradient(145deg," + acc + "33,#15151c)";
      btn.style.color = acc;
      btn.style.boxShadow = "0 0 8px " + acc + "66";
      btn.style.textShadow = "none";
    } else {
      btn.style.borderColor = "rgba(155,107,255,.5)";
      btn.style.background = "linear-gradient(145deg,#2a2a36,#15151c)";
      btn.style.color = "#d8c9ff";
      btn.style.boxShadow = "none";
    }
  }
  window.dragonSyncBgBtn = syncBtn;
  window.dragonBuildBgControl = function () {
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dragon-optbtn";
    btn.style.cssText = "padding:.45rem .7rem; font-size:.76rem; font-weight:bold; border-radius:9px; cursor:pointer; border:1px solid rgba(155,107,255,.5); background:linear-gradient(145deg,#2a2a36,#15151c); color:#d8c9ff;";
    btn.title = "Put one of the " + Math.max(0, parseList().length - 1) + " pictures behind the whole site, or none. Nebula is on by default";
    btn.onclick = function (e) { e.stopPropagation(); window.dragonBgOpen(); };
    syncBtn();
    return btn;
  };

  /* ---- boot + keep the veil in step with the theme ---- */
  ;function boot() {
    apply();
    syncBtn();
    try {
      if (window.MutationObserver) {
        new MutationObserver(function () { apply(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-dragon-theme"] });
      }
    } catch (e) {}
  }
  if (document.readyState !== "loading") boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
