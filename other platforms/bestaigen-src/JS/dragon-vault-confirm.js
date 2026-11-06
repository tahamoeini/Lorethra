// dragon-vault-confirm.js — moved VERBATIM out of index.html (Paket A1, 25.09.2026). Classic script
// (not a module), inserted at the same point of the boot order, so globals and ordering are unchanged.
// Rollback: paste this file's body back into index.html as a plain <script> at its old place.
// replaced with our dark-theme modal. Since the plugin is an `import`, its source cannot be changed; therefore
// the click is captured in the CAPTURE phase, our modal is shown, and window.confirm/prompt is temporarily
// stubbed before the button is clicked again (the plugin then performs its own save/delete process normally).
(function () {
  var bypass = false;
  ;function ask(opts) {
    if (window.dragonVaultConfirm) return window.dragonVaultConfirm(opts);
    return Promise.resolve({ ok: false, value: null });
  }
  ;function infoModal() {
    var cands = document.querySelectorAll("div");
    var best = null, bestN = 1e9;
    for (var i = 0; i < cands.length; i++) {
      var el = cands[i];
      if (!el.querySelector || !el.querySelectorAll("input,textarea").length) continue;
      if ((el.textContent || "").indexOf("\u2139\uFE0F file info") === -1) continue;
      var n = el.querySelectorAll("*").length;
      if (n < bestN) { bestN = n; best = el; }
    }
    return best;
  }
  var infoSnapshot = null;
  ;function snapInfo() {
    var m = infoModal();
    infoSnapshot = m ? [].map.call(m.querySelectorAll("input,textarea"), function (el) { return el.value; }) : null;
  }
  ;function infoChanged() {
    var m = infoModal();
    if (!m || !infoSnapshot) return true;
    var cur = [].map.call(m.querySelectorAll("input,textarea"), function (el) { return el.value; });
    if (cur.length !== infoSnapshot.length) return true;
    for (var i = 0; i < cur.length; i++) if (cur[i] !== infoSnapshot[i]) return true;
    return false;
  }
  ;function reClick(btn, stubKey, stubVal) {
    bypass = true;
    var orig = window[stubKey];
    window[stubKey] = function () { return stubVal; };
    try { btn.click(); } finally {
      setTimeout(function () { bypass = false; window[stubKey] = orig; }, 0);
    }
  }
  document.addEventListener("click", function (e) {
    if (bypass) return;
    var t = e.target;
    if (!t || !t.closest) return;
    var btn = t.closest("button");
    if (!btn) return;
    var title = btn.getAttribute("title") || "";
    if (title === "edit info") { setTimeout(snapInfo, 60); return; }
    if (title === "Delete item") {
      e.stopImmediatePropagation(); e.preventDefault();
      ask({ title: "\uD83D\uDDD1\uFE0F Delete image", body: "Delete this image from your gallery? This cannot be undone.", confirmText: "\uD83D\uDDD1\uFE0F Delete", danger: true }).then(function (r) { if (r.ok) reClick(btn, "confirm", true); });
      return;
    }
    if (title === "move to another folder") {
      e.stopImmediatePropagation(); e.preventDefault();
      ask({ title: "\uD83D\uDCC1 Move to folder", body: "Folder name to move this image into:", input: { placeholder: "folder name" }, confirmText: "Move" }).then(function (r) { if (r.ok && String(r.value || "").trim()) reClick(btn, "prompt", String(r.value).trim()); });
      return;
    }
    if (title === "rate item") {
      e.stopImmediatePropagation(); e.preventDefault();
      ask({ title: "\u2B50 Rate image", body: "Numeric rating/score (used for sorting):", input: { placeholder: "0" }, confirmText: "Save" }).then(function (r) { if (r.ok) reClick(btn, "prompt", String(r.value || "")); });
      return;
    }
    if (btn.textContent && btn.textContent.trim() === "\u2716\uFE0F" && btn.parentElement && (btn.parentElement.textContent || "").indexOf("\u2139\uFE0F file info") !== -1) {
      if (!infoChanged()) return;
      e.stopImmediatePropagation(); e.preventDefault();
      ask({ title: "\u2757 Discard changes?", body: "You have unsaved changes to this file's info. Discard them?", confirmText: "Discard", cancelText: "Keep editing", danger: true }).then(function (r) { if (r.ok) reClick(btn, "confirm", true); });
      return;
    }
  }, true);
})();
