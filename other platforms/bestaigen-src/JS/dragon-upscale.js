// dragon-upscale.js — moved VERBATIM out of index.html (Paket A1, 25.09.2026). Classic script
// (not a module), inserted at the same point of the boot order, so globals and ordering are unchanged.
// Rollback: paste this file's body back into index.html as a plain <script> at its old place.
(function () {
  // 🔍 Upscale Image — pick any image from disk and send it through the existing
  // bigger.pics upscale flow (window.dragonUpscaleImage).
  if (window.__dragonPanelReorgInstalled) return;
  window.__dragonPanelReorgInstalled = true;

  window.dragonUpscalePickFile = function () {
    try {
      var fi = document.createElement("input");
      fi.type = "file";
      fi.accept = "image/*";
      fi.style.display = "none";
      fi.onchange = function () {
        var f = fi.files && fi.files[0];
        if (!f) { fi.remove(); return; }
        var rd = new FileReader();
        rd.onload = function () {
          try {
            if (window.dragonUpscaleImage) window.dragonUpscaleImage(rd.result, { prompt: "", negativePrompt: "", seed: null });
            else if (window.dragonToast) window.dragonToast("\uD83D\uDCAB upscale is not ready yet");
          } catch (e) {}
          fi.remove();
        };
        rd.onerror = function () { fi.remove(); };
        rd.readAsDataURL(f);
      };
      document.body.appendChild(fi);
      fi.click();
    } catch (e) {}
  };

  // Move the parent-screen ⚙️ Quick bar into the Control Panel. Only the general
  // prompt controls (Cuteness / Shot-Angle) stay visible; the Character-panel
  // action buttons (randomizers / clear / premades) stay in the Character panels.
  ;function placeQuickBar() {
    var qb = document.querySelector(".dragon-parent-quickbar");
    var body = document.querySelector(".dragon-control-body");
    if (!qb || !body) return false;
    [].slice.call(qb.querySelectorAll("button")).forEach(function (b) {
      var t = (b.textContent || "").trim();
      if (/AI Random|AI Selected|Clear All/.test(t)) b.style.display = "none";
    });
    qb.style.margin = "0";
    qb.style.border = "1px solid rgba(63,143,214,.55)";
    qb.style.background = "rgba(63,143,214,.08)";
    var descRow = document.getElementById("dragonDescBtnsRow");
    var ref = descRow ? descRow.nextSibling : body.firstChild;
    if (qb.parentElement !== body) body.insertBefore(qb, ref);
    else if (descRow && qb.previousElementSibling !== descRow) body.insertBefore(qb, ref);
    return true;
  }
  window.__dragonPlaceQuickBar = placeQuickBar;

  // 🧩 Character Creation panels — red (inline !important so it beats theme CSS).
  ;function paintCharRed() {
    var heads = ".dragon-char-wrap > button, .dragon-char-wrap2 > button, .dragon-char-wrap3 > button, .dragon-char-wrap4 > button, .dragon-char-wrap5 > button";
    [].slice.call(document.querySelectorAll(heads)).forEach(function (b) {
      b.style.setProperty("border", "1px solid #c2333f", "important");
      b.style.setProperty("background", "linear-gradient(180deg,#2a0c10,#7d1620)", "important");
      b.style.setProperty("color", "#ffd4d4", "important");
      [].slice.call(b.querySelectorAll("span")).forEach(function (sp) {
        sp.style.setProperty("color", "#ff8f8f", "important");
      });
    });
    var bodies = ".dragon-char-body, .dragon-char-body2, .dragon-char-body3, .dragon-char-body4, .dragon-char-body5";
    [].slice.call(document.querySelectorAll(bodies)).forEach(function (bd) {
      bd.style.setProperty("border-color", "#7d1a22", "important");
    });
  }

  ;function applyAll() { placeQuickBar(); paintCharRed(); }
  ;function start() {
    applyAll();
    dragonTick(applyAll, 800);
    if (document.body) dragonBodyObserve(applyAll);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
