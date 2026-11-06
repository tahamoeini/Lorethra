// dragon-prompt-tools.js — moved VERBATIM out of index.html (Paket A1, 25.09.2026). Classic script
// (not a module), inserted at the same point of the boot order, so globals and ordering are unchanged.
// Rollback: paste this file's body back into index.html as a plain <script> at its old place.
// Self-contained & easy to remove: delete this entire <script> block; nothing else depends on it.
(function () {
  if (window.__dragonPromptTools) return; window.__dragonPromptTools = true;

  // ---------- A) PROMPT HISTORY (Ctrl+Z = undo, Ctrl+Y / Ctrl+Shift+Z = redo) on the Description box ----------
  // Captures the value BEFORE each change (typing AND chip clicks, which set the textarea
  // programmatically) so undo works uniformly across the whole prompt.
  ;function attachHistory(ta) {
    if (!ta || ta.__dragonPromptHist) return;
    ta.__dragonPromptHist = true;
    var history = [ta.value], idx = 0, t = null, applying = false;
    ;function commit(v) {
      if (v === history[idx]) return;
      history = history.slice(0, idx + 1);
      history.push(v);
      if (history.length > 150) history.shift();
      idx = history.length - 1;
    }
    ;function onInput() {
      if (applying) return;
      clearTimeout(t);
      t = setTimeout(function () { commit(ta.value); }, 300);
    }
    ;function go(delta) {
      clearTimeout(t);
      commit(ta.value);
      var ni = idx + delta;
      if (ni < 0 || ni >= history.length) return false; // nothing to undo/redo → let the browser handle it
      idx = ni;
      applying = true;
      ta.value = history[idx];
      try { ta.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) {}
      applying = false;
      return true;
    }
    ta.addEventListener("input", onInput);
    ta.addEventListener("keydown", function (e) {
      var mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      var k = (e.key || "").toLowerCase();
      if (k === "z" && !e.shiftKey) { if (go(-1)) { e.preventDefault(); e.stopPropagation(); } }
      else if (k === "y" || (k === "z" && e.shiftKey)) { if (go(1)) { e.preventDefault(); e.stopPropagation(); } }
    }, true);
  }

  // ---------- B) DRAG-TO-REORDER selected chips ----------
  // Dragging one ACTIVE (selected) chip onto another swaps their two phrases in the prompt text,
  // changing the order/token priority without touching anything else. Mouse only (touch keeps tapping).
  ;function findSpan(text, phrase) {
    if (!phrase) return null;
    var i = text.toLowerCase().indexOf(phrase.toLowerCase());
    return i === -1 ? null : [i, i + phrase.length];
  }
  ;function swapPhrases(text, a, b) {
    if (!a || !b || a.toLowerCase() === b.toLowerCase()) return text;
    var sa = findSpan(text, a), sb = findSpan(text, b);
    if (!sa || !sb) return text;
    if (sa[0] > sb[0]) { var tmp = sa; sa = sb; sb = tmp; var tp = a; a = b; b = tp; }
    if (sa[1] > sb[0]) return text; // overlapping spans → leave untouched
    return text.slice(0, sa[0]) + b + text.slice(sa[1], sb[0]) + a + text.slice(sb[1]);
  }
  var dragging = null, dragPhrase = "", sx = 0, sy = 0, moved = false, suppressClick = false;
  document.addEventListener("pointerdown", function (e) {
    if (e.pointerType && e.pointerType !== "mouse") { dragging = null; return; }
    var chip = e.target && e.target.closest ? e.target.closest("[data-phrase]") : null;
    if (!chip || chip.dataset.on !== "1" || !chip.dataset.phrase) { dragging = null; return; }
    if (chip.closest("input,select,textarea")) { dragging = null; return; }
    dragging = chip; dragPhrase = chip.dataset.phrase; sx = e.clientX; sy = e.clientY; moved = false;
  }, true);
  document.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    if (!moved && (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 9)) {
      moved = true;
      try { dragging.style.opacity = ".45"; dragging.style.outline = "2px dashed #9b6bff"; } catch (er) {}
    }
    if (moved) { try { e.preventDefault(); } catch (er) {} }
  }, true);
  document.addEventListener("pointerup", function (e) {
    if (!dragging) return;
    var src = dragging, ph = dragPhrase, didMove = moved;
    dragging = null; dragPhrase = ""; moved = false;
    try { src.style.opacity = ""; src.style.outline = ""; } catch (er) {}
    if (!didMove) return;
    suppressClick = true;
    setTimeout(function () { suppressClick = false; }, 500);
    var over = document.elementFromPoint(e.clientX, e.clientY);
    var tgt = over && over.closest ? over.closest("[data-phrase]") : null;
    if (!tgt || tgt === src || !tgt.dataset.phrase || tgt.dataset.on !== "1") return;
    var ta = document.querySelector('textarea[data-name="description"]');
    if (!ta) return;
    var nv = swapPhrases(String(ta.value || ""), ph, tgt.dataset.phrase);
    if (nv !== ta.value) {
      ta.value = nv;
      try { ta.dispatchEvent(new Event("input", { bubbles: true })); } catch (er) {}
      if (window.dragonToast) window.dragonToast("\u2195 reordered: " + ph + " \u21C4 " + tgt.dataset.phrase);
    }
  }, true);
  document.addEventListener("click", function (e) {
    if (suppressClick) { e.stopPropagation(); e.preventDefault(); }
  }, true);

  ;function attachEnterGen(ta) {
    if (!ta || ta.__dragonEnterGen) return;
    ta.__dragonEnterGen = true;
    ta.addEventListener("keydown", function (e) {
      if (!e || e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.isComposing) return;
      try { e.preventDefault(); } catch (eP) {}
      try { e.stopPropagation(); } catch (eS) {}
      try { if (e.stopImmediatePropagation) e.stopImmediatePropagation(); } catch (eI) {}
      try { if (window.dragonTriggerGen) window.dragonTriggerGen(); } catch (eG) {}
    });
  }
  ;function scan() {
    var tas = document.querySelectorAll('textarea[data-name="description"]');
    for (var i = 0; i < tas.length; i++) { attachHistory(tas[i]); attachEnterGen(tas[i]); }
  }
  ;function ready(fn) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn); else fn(); }
  ready(function () { scan(); if (window.dragonTick) window.dragonTick(scan, 1500); else setInterval(scan, 1500); });
  window.dragonSwapPromptPhrases = swapPhrases; // exposed for quick testing
  window.dragonPromptHistoryUndo = function (ta) { ta = ta || document.querySelector('textarea[data-name="description"]'); if (ta) { try { ta.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })); } catch (e) {} } };
})();
