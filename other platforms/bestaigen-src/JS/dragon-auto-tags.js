// 🎛️ AUTOMATIC PROMPT ADD-ONS (Egon 26.09.2026)
// Two mini toggle buttons in the Control Panel's mini-button row that switch OFF the text this generator
// injects on its own. A visitor in the chat asked why extra text always lands in the prompt even with
// "No style" selected — that extra text is our quality tags.
//   · Quality tags OFF → the prompt is exactly what the visitor typed plus the chosen art style's own
//     prompt addition (no quality tags at all).
//   · Negatives OFF    → the negative prompt is exactly what the visitor typed (no injected negatives).
// main.pjs assembles both at generate time and reads these same two localStorage keys
// (autoQualityTagsOn / autoNegativesOn), so a flip applies to the very next generate with no reload.
// These toggles are the MASTER switch for every automatic addition: with both OFF the prompt
// and the negative prompt are exactly what the visitor typed, plus the art style's own addition.
// Default: ON for both. State is told by colour and brightness only — never by size (I59/Designbook §4.8).
(function () {
  if (window.__dragonAutoTagsInstalled) return;
  window.__dragonAutoTagsInstalled = true;

  var KQ = "dragonAutoQualityTags";
  var KN = "dragonAutoNegatives";
  var STASH = "dragonNegativesStash";
  var GLYPH = { q: "\uD83C\uDFF7\uFE0F", n: "\uD83D\uDEAB" };

  function isOn(key) { try { return localStorage.getItem(key) !== "0"; } catch (e) { return true; } }
  function setOn(key, v) { try { localStorage.setItem(key, v ? "1" : "0"); } catch (e) {} }
  window.dragonAutoQualityTagsOn = function () { return isOn(KQ); };
  window.dragonAutoNegativesOn = function () { return isOn(KN); };

  function titleOf(kind, on) {
    if (kind === "q") {
      return "Automatic Quality Tags: " + (on ? "ON" : "OFF") + " \u2014 " + (on
        ? "the generator adds its quality tags to every prompt; click to leave the prompt exactly as you wrote it"
        : "the prompt goes exactly as you wrote it, plus your art style's addition; click to add the quality tags again");
    }
    return "Automatic Negative Prompt: " + (on ? "ON" : "OFF") + " \u2014 " + (on
      ? "the generator adds its own negatives to every generate; click to use only your own negatives"
      : "only the negatives you wrote are used; click to add the generator's negatives again");
  }

  // Egon 01.10.2026 — switching the auto negatives OFF empties the Negatives box (stale
  // assembled lists otherwise linger there and keep shaping the image). The previous content is
  // stashed, and switching back ON restores it — but only into an untouched (still empty) box,
  // so text typed while OFF is never clobbered.
  function negBoxEl() { try { return document.querySelector('[data-name="negative"]'); } catch (e) { return null; } }
  function negBoxOnToggle(on) {
    var box = negBoxEl();
    if (!box) return;
    try {
      if (!on) {
        var cur = String(box.value || "");
        if (cur.trim() !== "") { try { localStorage.setItem(STASH, cur); } catch (e2) {} }
        box.value = "";
        box.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        if (String(box.value || "").trim() !== "") return;
        var st = null;
        try { st = localStorage.getItem(STASH); } catch (e3) {}
        if (st) {
          box.value = st;
          box.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
    } catch (e) {}
  }
  function paint(btn, kind, on) {
    if (!btn) return;
    var g = GLYPH[kind];
    if (btn.textContent !== g) btn.textContent = g;
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    try { if (window.dragonSetTip) window.dragonSetTip(btn, titleOf(kind, on)); else btn.title = titleOf(kind, on); } catch (e) { btn.title = titleOf(kind, on); }
    try {
      if (on) {
        btn.style.setProperty("border-color", "#2fae6b", "important");
        btn.style.setProperty("color", "#8bf0b4", "important");
        btn.style.setProperty("background", "rgba(47,174,107,.14)", "important");
        btn.style.setProperty("opacity", "1", "important");
      } else {
        btn.style.setProperty("border-color", "#55555f", "important");
        btn.style.setProperty("color", "#8d8d99", "important");
        btn.style.setProperty("background", "rgba(255,255,255,.03)", "important");
        btn.style.setProperty("opacity", ".75", "important");
      }
    } catch (e) {}
  }

  function toggle(kind) {
    var key = kind === "q" ? KQ : KN;
    var v = !isOn(key);
    setOn(key, v);
    if (kind === "n") negBoxOnToggle(v);
    mount();
    if (window.dragonToast) {
      window.dragonToast(kind === "q"
        ? (v ? "\uD83C\uDFF7\uFE0F quality tags ON \u2014 added to every prompt" : "\uD83C\uDFF7\uFE0F quality tags OFF \u2014 your prompt goes exactly as written")
        : (v ? "\uD83D\uDEAB auto negatives ON \u2014 the generator adds its own negatives" : "\uD83D\uDEAB auto negatives OFF \u2014 only your own negatives are used"));
    }
    return window.dragonAutoTagsTest();
  }

  // One button per switch, created once and never re-seated (the 🖐 Arrange Buttons pool owns its position
  // after the first build — a rebuild must not yank it back, that is the W-UI116 lesson).
  function ensure(kind) {
    var key = kind === "q" ? "q" : "n";
    var sel = '[data-d="' + (key === "q" ? "autotags" : "autoneg") + '"]';
    var btn = document.querySelector(sel);
    if (btn) return btn;
    var row = document.getElementById("dragonDescBtnsRow");
    if (!row) return null;
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dragon-desc-mini";
    btn.dataset.d = key === "q" ? "autotags" : "autoneg";
    btn.setAttribute("aria-label", titleOf(key, true));
    btn.onclick = function (e) { e.stopPropagation(); toggle(key); };
    row.appendChild(btn);
    return btn;
  }

  function mount() {
    var q = ensure("q");
    var n = ensure("n");
    paint(q, "q", isOn(KQ));
    paint(n, "n", isOn(KN));
    return !!(q && n);
  }
  window.dragonAutoTagsMount = mount;

  window.dragonAutoTagsTest = function () {
    var q = document.querySelector('[data-d="autotags"]');
    var n = document.querySelector('[data-d="autoneg"]');
    var qr = q ? q.getBoundingClientRect() : null;
    var nr = n ? n.getBoundingClientRect() : null;
    return {
      row: !!document.getElementById("dragonDescBtnsRow"),
      mounted: !!(q && n),
      qOn: isOn(KQ),
      nOn: isOn(KN),
      qGlyph: q ? q.textContent : "",
      nGlyph: n ? n.textContent : "",
      qSize: qr ? [Math.round(qr.width), Math.round(qr.height)] : null,
      nSize: nr ? [Math.round(nr.width), Math.round(nr.height)] : null,
      qPressed: q ? q.getAttribute("aria-pressed") : null,
      sameSize: !!(qr && nr && Math.abs(qr.width - nr.width) < 0.51 && Math.abs(qr.height - nr.height) < 0.51)
    };
  };
  window.dragonAutoTagsToggle = function (kind) { return toggle(kind === "n" ? "n" : "q"); };

  if (window.dragonBodyObserve) window.dragonBodyObserve(mount);
  if (window.dragonTick) window.dragonTick(mount, 1200);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
