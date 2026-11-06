// dragon-panels-v2.js — moved VERBATIM out of index.html (Paket A1, 25.09.2026). Classic script
// (not a module), inserted at the same point of the boot order, so globals and ordering are unchanged.
// Rollback: paste this file's body back into index.html as a plain <script> at its old place.
// Display / Seed / Shape / Count panels. Kept ALONGSIDE the v1 panels (row2) for approval; if v2 is
// liked, v1 can be parked later. Selecting an option writes straight into the native select/input.
(function () {
  if (window.__dragonRow2V2) return; window.__dragonRow2V2 = true;
  ;function ready(fn) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn); else fn(); }
  ;function toast(m) { try { if (window.dragonToast) window.dragonToast(m); } catch (e) {} }
  var CONTROLS = [
    { name: "gscale", label: "\u2699\uFE0F CFG", kind: "select" },
    { name: "panels", label: "\uD83E\uDDE9 Panels", kind: "select" },
    { name: "negative", label: "\uD83D\uDEAB Negatives", kind: "text", multiline: true, placeholder: "things you don't want to see (comma separated)" },
    { name: "display", label: "\uD83D\uDDBC\uFE0F Display", kind: "select" },
    { name: "seed", label: "\uD83C\uDFB2 Seed", kind: "text", inputType: "number", placeholder: "seed (empty = random)" },
    { name: "shape", label: "\uD83D\uDCD0 Shape", kind: "select" },
    { name: "numImages", label: "\uD83D\uDD22 Count", kind: "select" }
  ];
  var built = null, pop = null;
  ;function sel(name) { return document.querySelector('[data-name="' + name + '"]'); }
  ;function build() {
    if (built && built.isConnected) return built;
    var body = document.querySelector(".dragon-control-body");
    if (!body) return null;
    var row = document.createElement("div");
    row.className = "dragon-row2-v2";
    row.style.cssText = "display:flex; flex-wrap:wrap; gap:.35rem; align-items:center; justify-content:center; width:100%; margin-top:.35rem; padding:.35rem .4rem .45rem; border:1px solid rgba(107,91,255,.45); border-radius:10px; background:rgba(107,91,255,.07); box-sizing:border-box;";
    // 🧹 Egon 26.09.2026 — "Cp'deki ⚙️ Quick Bar ve ✨ Quick Controls ifadelerini sil." The "✨ Quick
    // Controls" caption is REMOVED (the row itself — Display/Seed/Shape/Count — stays exactly as it was).
    // PARKED: var h = document.createElement("span"); h.textContent = "✨ Quick Controls"; row.appendChild(h);
    pop = document.createElement("div");
    pop.className = "dragon-v2-pop";
    pop.style.cssText = "position:fixed; z-index:2147483002; display:none; flex-direction:column; gap:2px; background:#1b1b22; border:1px solid #6a6a78; border-radius:10px; padding:6px; box-shadow:0 8px 24px rgba(0,0,0,.6); min-width:180px; max-width:70vw; max-height:60vh; overflow:auto;";
    document.body.appendChild(pop);
    // opened while the page scrolled (it looked detached from its button). It now follows the button it
    // belongs to on every scroll/resize frame, and closes itself once the button leaves the viewport.
    var curAnchor = null, placeRaf = 0;
    ;function placePop() {
      if (!curAnchor || pop.style.display === "none") return;
      var r = curAnchor.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) { closePop(); return; }
      var left = Math.min(window.innerWidth - (pop.offsetWidth || 190) - 6, Math.max(6, r.left));
      var top = r.bottom + 6;
      if (top + pop.offsetHeight > window.innerHeight) top = Math.max(6, r.top - pop.offsetHeight - 6);
      pop.style.left = left + "px"; pop.style.top = top + "px";
    }
    ;function trackPop() {
      if (!curAnchor || pop.style.display === "none") { placeRaf = 0; return; }
      placePop();
      placeRaf = requestAnimationFrame(trackPop);
    }
    window.addEventListener("scroll", placePop, true);
    window.addEventListener("resize", placePop);
    ;function closePop() { pop.style.display = "none"; curAnchor = null; if (placeRaf) { cancelAnimationFrame(placeRaf); placeRaf = 0; } }
    document.addEventListener("pointerdown", function (e) { if (pop.style.display === "none") return; if (pop.contains(e.target)) return; closePop(); }, true);
    var btns = {};
    ;function labelText(cfg) {
      var el = sel(cfg.name), v = "";
      if (el) {
        if (el.tagName === "SELECT") v = (el.options && el.selectedIndex >= 0) ? el.options[el.selectedIndex].textContent.trim() : el.value;
        else v = el.value || "";
      }
      // long free-text values (a negative prompt can be hundreds of characters) are shortened so the pill
      // keeps its shape — the full text is in the tooltip.
      if (v.length > 24) v = v.slice(0, 23) + "\u2026";
      return cfg.label + ": " + (v || "\u2014");
    }
    ;function refresh() { CONTROLS.forEach(function (c) { if (btns[c.name]) { btns[c.name].textContent = labelText(c); btns[c.name].title = c.label + " \u2014 " + (String((sel(c.name) || {}).value || "") || "click to set"); } }); }
    ;function apply(name, val) {
      var el = sel(name); if (!el) return;
      el.value = val;
      try { el.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) {}
      try { el.dispatchEvent(new Event("change", { bubbles: true })); } catch (e) {}
      try { if (el.onchange) el.onchange({}); } catch (e) {}
      refresh();
    }
    ;function openFor(c, anchor) {
      pop.innerHTML = "";
      pop.style.minWidth = c.multiline ? Math.min(340, Math.max(200, window.innerWidth - 40)) + "px" : "180px";
      var el = sel(c.name);
      if (c.kind === "select" && el && el.tagName === "SELECT") {
        for (var i = 0; i < el.options.length; i++) {
          (function (o) {
            var ob = document.createElement("button"); ob.type = "button"; ob.textContent = o.textContent.trim();
            var on = o.selected;
            ob.style.cssText = "text-align:left; font-size:.75rem; padding:.32rem .55rem; border:none; background:" + (on ? "linear-gradient(180deg,#2a1f4a,#14101f)" : "transparent") + "; color:" + (on ? "#d8c9ff" : "#eee") + "; cursor:pointer; border-radius:6px; white-space:nowrap;";
            ob.onmouseenter = function () { ob.style.background = "#3a3a48"; };
            ob.onmouseleave = function () { ob.style.background = on ? "linear-gradient(180deg,#2a1f4a,#14101f)" : "transparent"; };
            ob.onclick = function () { apply(c.name, o.value); closePop(); toast(c.label + ": " + o.textContent.trim()); };
            pop.appendChild(ob);
          })(el.options[i]);
        }
      } else {
        // NUMBER box ("seed (empty = random)"), so a negative prompt could not be typed at all — that is the
        // "Negative Prompt is broken" report. Each control now declares how it wants to be edited.
        var inp;
        if (c.multiline) {
          inp = document.createElement("textarea");
          inp.rows = 3;
          inp.style.cssText = "padding:.3rem .45rem; font-size:.78rem; border:1px solid #5a5a6a; border-radius:6px; background:#111; color:#eee; width:100%; box-sizing:border-box; resize:vertical; font-family:inherit; line-height:1.35;";
        } else {
          inp = document.createElement("input");
          inp.type = c.inputType || "text";
          inp.style.cssText = "padding:.3rem .45rem; font-size:.78rem; border:1px solid #5a5a6a; border-radius:6px; background:#111; color:#eee; width:100%; box-sizing:border-box;";
        }
        inp.value = el ? el.value : "";
        inp.placeholder = c.placeholder || String(c.label).replace(/^[^A-Za-z0-9]+/, "");
        var sb = document.createElement("button"); sb.textContent = "Set"; sb.style.cssText = "margin-top:4px; padding:.3rem .5rem; font-size:.74rem; font-weight:bold; border:1px solid #4ade80; background:linear-gradient(180deg,#14532d,#052e16); color:#bbf7d0; border-radius:6px; cursor:pointer;";
        sb.onclick = function () { apply(c.name, inp.value); closePop(); toast(c.label + ": " + (inp.value || "cleared")); };
        var cb = document.createElement("button"); cb.textContent = "Clear"; cb.style.cssText = "margin-top:4px; padding:.3rem .5rem; font-size:.74rem; font-weight:bold; border:1px solid #c81e2e; background:linear-gradient(180deg,#3a1010,#1c0808); color:#ffb3b3; border-radius:6px; cursor:pointer;";
        cb.onclick = function () { apply(c.name, ""); closePop(); toast(c.label + ": cleared"); };
        pop.append(inp, sb, cb);
      }
      curAnchor = anchor;
      pop.style.display = "flex";
      placePop();
      if (!placeRaf) placeRaf = requestAnimationFrame(trackPop);
    }
    CONTROLS.forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button"; b.dataset.v2 = c.name;
      b.style.cssText = "padding:.3rem .7rem; font-size:.74rem; font-weight:bold; border:1px solid #6a5a9a; background:linear-gradient(180deg,#2a2a36,#15151c); color:#e6dfff; border-radius:999px; cursor:pointer; white-space:nowrap;";
      b.title = "v2 quick control \u2014 click to choose";
      b.onclick = function (e) { e.stopPropagation(); openFor(c, b); };
      btns[c.name] = b; row.appendChild(b);
    });
    var v1 = body.querySelector(".dragon-row2");
    if (v1 && v1.parentElement) {
      // (hidden, PARKED — never deleted) so only the Quick Controls row shows.
      try { v1.style.setProperty("display", "none", "important"); } catch (e) { v1.style.display = "none"; }
      v1.parentElement.insertBefore(row, v1.nextSibling);
    }
    else body.appendChild(row);
    refresh();
    CONTROLS.forEach(function (c) { var el = sel(c.name); if (el) { el.addEventListener("change", refresh); el.addEventListener("input", refresh); } });
    built = row;
    return row;
  }
  ;function scan() { try { build(); } catch (e) {} }
  ready(function () { scan(); if (window.dragonTick) window.dragonTick(scan, 1500); else setInterval(scan, 1500); });
  window.__dragonBuildRow2V2 = scan;
})();
