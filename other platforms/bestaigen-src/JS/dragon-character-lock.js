// dragon-character-lock.js — moved VERBATIM out of index.html (Paket A1, 25.09.2026). Classic script
// (not a module), inserted at the same point of the boot order, so globals and ordering are unchanged.
// Rollback: paste this file's body back into index.html as a plain <script> at its old place.
// ===== Incremental re-apply from 1.3.0 — Item 9: 🎭 Character Lock =====
(function () {
  if (window.__dragonCharLockInstalled) return;
  window.__dragonCharLockInstalled = true;

  ;function toast(m) { try { if (window.dragonToast) window.dragonToast(m); } catch (e) {} }

  var charLock = { on: false, char: "", seed: null };
  try { var cs = localStorage.dragonCharLock; if (cs) charLock = JSON.parse(cs) || charLock; } catch (e) {}
  window.dragonCharLock = charLock;
  ;function saveCharLock() { try { localStorage.dragonCharLock = JSON.stringify(charLock); } catch (e) {} }
  ;function updateCharLockBtn() {
    var b = document.querySelector('[data-d="charlock"]');
    if (!b) return;
    if (charLock.on) {
      b.style.setProperty("background", "linear-gradient(180deg,#b3232f,#6b0f17)", "important");
      b.style.setProperty("borderColor", "#e04a5a", "important");
      b.style.setProperty("color", "#fff", "important");
      b.title = "Character Lock ON — “" + charLock.char.slice(0, 24) + "” click to unlock";
    } else {
      b.style.setProperty("background", "linear-gradient(180deg,#1d5c3a,#0f3320)", "important");
      b.style.setProperty("borderColor", "#2fae6b", "important");
      b.style.setProperty("color", "#fff", "important");
      b.title = "Character Lock — keep the same character/face across generations";
    }
  }
  window.dragonUpdateCharLockBtn = updateCharLockBtn;
  window.dragonCharLockToggle = function () {
    if (charLock.on) {
      charLock.on = false;
      toast("🎭 Character Lock OFF");
    } else {
      var ta = document.querySelector('textarea[data-name="description"]');
      var desc = ta ? String(ta.value || "") : "";
      if (!desc || desc.trim().length < 3) { toast("⚠️ type a character description first, then press 🎭"); return; }
      charLock.char = desc.trim();
      charLock.seed = Math.floor(Math.random() * 1e9);
      charLock.on = true;
      toast("🎭 Character locked — same face & seed kept. Describe only the scene/pose now.");
    }
    saveCharLock();
    updateCharLockBtn();
  };
  ;function installCharLock() {
    var cur = window.___getImageOptions746291937;
    if (!cur || cur.__dragonCharLock) return false;
    var w = function () {
      var o = cur();
      if (charLock.on && charLock.char) {
        try {
          var p = String((o && o.prompt) || "");
          p = p.replace(/\(seed:::\s*\d+\)/g, "");
          if (p.indexOf(charLock.char) !== 0) p = charLock.char + ", " + p;
          if (charLock.seed != null) p += " (seed:::" + charLock.seed + ")";
          o = Object.assign({}, o, { prompt: p });
        } catch (e) {}
      }
      return o;
    };
    w.__dragonCharLock = true;
    window.___getImageOptions746291937 = w;
    return true;
  }
  installCharLock();
  // bounded poll: stop once patched or after ~30 tries (60s) — never runs forever
  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    if (installCharLock() || tries > 30) clearInterval(iv);
  }, 2000);
  // keep the 🎭 button state in sync once it appears (bounded)
  var tries2 = 0;
  var iv2 = setInterval(function () {
    tries2++;
    updateCharLockBtn();
    if (tries2 > 30) clearInterval(iv2);
  }, 3000);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(updateCharLockBtn, 500); });
  else setTimeout(updateCharLockBtn, 500);
})();
