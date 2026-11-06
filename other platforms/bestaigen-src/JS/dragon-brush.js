// 🖌️ RETOUCH BRUSH (Egon 23.09.2026) — a small, canvas-based local retouch tool.
// Verbatim ask: "Brush? I'm splitting it into two: local retouch brush (canvas-based cover/copy brush)
// possible and cheap okay let this be. do it. let's add this." Scored 8/10 (colour + clone stamp on a real
// canvas, one self-contained file, no ML, works offline): it removes a watermark, a stray detail or a
// small blemish by painting over it or by copying a clean patch of the SAME picture onto it.
// (The other half of Egon's idea — a generative/AI retouch — is emphatically NOT this; that would
// mean generateText/generateImage per stroke and is not "cheap".)
//
// WHERE IT LIVES (Egon 23.09.2026): inside the ✏️ IMAGE EDITOR. The lightbox row was moved here —
// the editor's ⚙️ Settings panel has a "🖌️ Retouch Brush" button, and ✔ Done hands the retouched
// picture straight back to the editor (never to the viewer), so the sheet keeps the visitor's text,
// emoji, paper size and zoom.
//
// HOW THE CLONE STAMP WORKS (Egon 23.09.2026): RIGHT-click (or long-press with a pen) sets the SAMPLE
// point on a clean patch of the picture; every right-click takes a NEW sample. LEFT-click / drag then
// paints that patch over the blemish. A left-click BEFORE any sample does nothing but show a toast
// telling the visitor to right-click first.
//
// PUBLIC API
//   window.dragonBrushOpen(url, prompt, onDone)   -> opens the editor
//   onDone(newUrl, localUrl)                      -> the visitor pressed ✔ Done (newUrl is hosted)
// The tool never writes anything by itself: it hands the finished picture back to the caller.
(function () {
  "use strict";
  var Z = 2147483646;

  ;function mk(tag, css, txt) {
    var el = document.createElement(tag);
    if (css) el.style.cssText = css;
    if (txt !== undefined) el.textContent = txt;
    return el;
  }
  ;function toast(t) { try { if (window.dragonToast) dragonToast(t); } catch (e) {} }

  ;function btn(txt, title, primary, fn) {
    var b = mk("button", "padding:.4rem .6rem; font-size:.76rem; font-weight:bold; border-radius:9px; cursor:pointer; font-family:inherit; border:1px solid " +
      (primary ? "#9b6bff" : "rgba(155,107,255,.45)") + "; background:linear-gradient(" + (primary ? "180deg,#2a1a4a,#1a102e" : "145deg,#2a2a36,#15151c") + "); color:#d8c9ff;", txt);
    b.type = "button";
    b.title = title || "";
    b.onclick = function (e) { e.stopPropagation(); fn(); };
    return b;
  }

  window.dragonBrushOpen = function (url, prompt, onDone, onClose) {
    if (!url) { toast("🖌️ wait for the picture to load"); return; }
    if (!window.root || !root.uploadPlugin) { toast("🖌️ the brush needs the upload tool — try again in a moment"); return; }
    try { var old = document.getElementById("dragonBrushOv"); if (old && old.parentNode) old.parentNode.removeChild(old); } catch (e) {}

    var ov = mk("div", "position:fixed; inset:0; z-index:" + Z + "; display:flex; flex-direction:column; gap:.45rem; padding:.55rem; background:rgba(6,4,10,.94); color:#ece6ff; font-family:system-ui,sans-serif;", "");
    ov.id = "dragonBrushOv";
    var bar = mk("div", "display:flex; align-items:center; justify-content:center; gap:.4rem; flex-wrap:wrap; padding:.4rem .5rem; border:1px solid #3a3350; border-radius:12px; background:linear-gradient(180deg,#191527,#100d18);", "");
    var stage = mk("div", "flex:1 1 auto; min-height:0; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden;", "");
    var cv = document.createElement("canvas");
    // the ring IS the cursor, so the native crosshair is switched off (it used to sit at the pointer
    // while a second, unrelated circle floated near the canvas's top-left corner — Egon 23.09.2026)
    cv.style.cssText = "max-width:96%; max-height:calc(100vh - 7.5rem); border-radius:8px; box-shadow:0 12px 40px rgba(0,0,0,.75); touch-action:none; cursor:none;";
    stage.appendChild(cv);
    var ring = mk("div", "position:absolute; border:2px solid rgba(255,255,255,.95); border-radius:50%; pointer-events:none; box-shadow:0 0 0 1px rgba(0,0,0,.65) inset; display:none; align-items:center; justify-content:center; color:#fff; font-weight:700; text-shadow:0 0 3px #000;", "+");
    stage.appendChild(ring);
    // the SAMPLE point of the clone stamp, drawn where the visitor right-clicked
    var srcDot = mk("div", "position:absolute; border:2px dashed rgba(255,120,220,.95); border-radius:50%; pointer-events:none; display:none;", "");
    stage.appendChild(srcDot);
    var hint = mk("div", "font-size:.68rem; color:#9a92b8; text-align:center;", "🖌 Paint draws with the chosen colour · 🩹 Clone copies a clean patch of the same picture: RIGHT-click a clean spot to take a sample (every right-click takes a new one), then LEFT-click / drag over the blemish · Ctrl/⌘+Z or ↶ Undo steps back · ✔ Done hands the retouched picture back to the editor.");
    ov.append(bar, stage, hint);
    document.body.appendChild(ov);

    var ctx = cv.getContext("2d");
    var size = 28, mode = "paint", colour = "#ffffff", SRC = null, undo = [], init = null, drawing = false, last = null, saved = false;

    var closedOnce = false;
    ;function close() {
      if (closedOnce) return;
      closedOnce = true;
      try { document.removeEventListener("keydown", onKey, true); } catch (e) {}
      try { ov.remove(); } catch (e) {}
      // the caller may have hidden itself while the brush was up (that is how the ✏️ Image Editor keeps
      // its own panel from sitting on top of the brush) — this is where it comes back into view
      try { if (onClose) onClose(); } catch (e) {}
    }
    ;function snapshot() {
      try {
        var d = ctx.getImageData(0, 0, cv.width, cv.height);
        undo.push(d);
        if (undo.length > 6) undo.shift();
      } catch (e) {}
    }
    ;function undoOne() {
      if (!undo.length) { toast("🖌️ nothing to undo"); return; }
      var d = undo.pop();
      try { ctx.putImageData(d, 0, 0); } catch (e) {}
    }
    ;function resetAll() {
      if (!init) return;
      try { ctx.putImageData(init, 0, 0); undo = []; toast("🖌️ back to the original picture"); } catch (e) {}
    }

    var img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () {
      cv.width = img.naturalWidth;
      cv.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      try { init = ctx.getImageData(0, 0, cv.width, cv.height); } catch (e) { toast("⚠️ this picture can't be edited (its host blocks canvas editing)"); }
    };
    img.onerror = function () { toast("🖌️ could not load the picture"); close(); };
    img.src = url;

    // ---- toolbar -------------------------------------------------------------------------------
    var paintB = btn("🖌 Paint", "Paint with the colour", true, function () { mode = "paint"; syncBar(); });
    var cloneB = btn("🩹 Clone", "Copy a clean patch of the same picture over the blemish — RIGHT-click the clean spot first, then LEFT-click the blemish", false, function () { mode = "clone"; syncBar(); });
    var colIn = document.createElement("input");
    colIn.type = "color";
    colIn.value = "#ffffff";
    colIn.title = "Brush colour (paint mode)";
    colIn.style.cssText = "width:2.4rem; height:2rem; padding:0; border-radius:9px; border:1px solid #9b6bff; background:linear-gradient(180deg,#2a1a4a,#1a102e); cursor:pointer;";
    colIn.oninput = function () { colour = colIn.value; mode = "paint"; syncBar(); };
    var sizeIn = document.createElement("input");
    sizeIn.type = "range";
    sizeIn.min = "4";
    sizeIn.max = "200";
    sizeIn.value = String(size);
    sizeIn.title = "Brush size";
    sizeIn.style.cssText = "width:8rem; accent-color:#9b6bff;";
    var sizeLbl = mk("span", "font-size:.72rem; color:#d8c9ff; font-weight:bold; min-width:3.4rem; text-align:center;", "");
    sizeIn.oninput = function () { size = Number(sizeIn.value); syncBar(); drawSource(); };
    var undoB = btn("↶ Undo", "Undo the last stroke", false, undoOne);
    var resetB = btn("↺ Reset", "Back to the original picture", false, resetAll);
    var doneB = btn("✔ Done", "Keep the retouched picture — it goes back into the editor", true, function () {
      if (saved) return;
      saved = true;
      doneB.disabled = true;
      var old = doneB.textContent;
      doneB.textContent = "⏳ Saving…";
      cv.toBlob(function (blob) {
        if (!blob) { saved = false; doneB.disabled = false; doneB.textContent = old; toast("⚠️ this picture can't be edited"); return; }
        var localUrl = null;
        try { localUrl = URL.createObjectURL(blob); } catch (e) {}
        ;function send(u) { try { if (onDone) onDone(u, localUrl || u); } catch (e) {} close(); toast("🖌️ retouched — the picture is back in the editor"); }
        root.uploadPlugin(blob, { expires: Date.now() + 1000 * 60 * 60 * 24 * 365 }).then(function (res) {
          if (res && res.url) send(res.url);
          else { saved = false; doneB.disabled = false; doneB.textContent = old; toast("⚠️ could not upload the retouched picture"); }
        }).catch(function () { saved = false; doneB.disabled = false; doneB.textContent = old; toast("⚠️ could not upload the retouched picture"); });
      }, "image/png");
    });
    var xB = btn("✖ Close", "Close without keeping the changes", false, close);
    bar.append(paintB, cloneB, colIn, sizeIn, sizeLbl, undoB, resetB, doneB, xB);

    ;function syncBar() {
      sizeLbl.textContent = size + " px";
      paintB.style.borderColor = mode === "paint" ? "#9b6bff" : "rgba(155,107,255,.45)";
      cloneB.style.borderColor = mode === "clone" ? "#9b6bff" : "rgba(155,107,255,.45)";
      colIn.style.opacity = mode === "paint" ? "1" : ".45";
      srcDot.style.display = (mode === "clone" && SRC) ? "block" : "none";
      drawSource();
    }
    syncBar();

    // ---- geometry ------------------------------------------------------------------------------
    // Everything is measured against the STAGE (the ring's own positioning context). Measuring against
    // the canvas instead put the ring half a canvas away from the pointer, which is the stray circle
    // Egon saw near the top-left corner (Egon 23.09.2026).
    ;function pos(e) {
      var r = cv.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (cv.width / r.width), y: (e.clientY - r.top) * (cv.height / r.height) };
    }
    ;function stagePos(e) {
      var s = stage.getBoundingClientRect();
      return { x: e.clientX - s.left, y: e.clientY - s.top };
    }
    ;function drawSource() {
      if (!SRC || mode !== "clone") { srcDot.style.display = "none"; return; }
      var r = cv.getBoundingClientRect(), s = stage.getBoundingClientRect();
      if (!cv.width || !r.width) { srcDot.style.display = "none"; return; }
      var sc = r.width / cv.width;
      var d = Math.max(8, size * sc);
      srcDot.style.display = "block";
      srcDot.style.width = srcDot.style.height = d + "px";
      srcDot.style.left = ((r.left - s.left) + SRC.x * sc - d / 2) + "px";
      srcDot.style.top = ((r.top - s.top) + SRC.y * sc - d / 2) + "px";
    }
    ;function setSource(e) {
      SRC = pos(e);
      mode = "clone";
      syncBar();
      toast("🩹 sample taken — now LEFT-click (or drag) over the blemish to paint it away");
    }

    // ---- drawing ------------------------------------------------------------------------------
    ;function strokeTo(p) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = size;
      ctx.strokeStyle = colour;
      ctx.globalCompositeOperation = "source-over";
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
    }
    ;function cloneTo(p) {
      // classic clone stamp: the SOURCE patch stays aligned to the picture, so it follows the pointer
      // at a fixed offset (set when the stroke starts) — sample a clean patch, then paint the blemish
      var r = size / 2;
      if (!cloneOff) return;
      var sx = p.x + cloneOff.x, sy = p.y + cloneOff.y;
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(cv, sx - r, sy - r, r * 2, r * 2, p.x - r, p.y - r, r * 2, r * 2);
      ctx.restore();
    }
    var cloneOff = null;
    cv.addEventListener("contextmenu", function (e) { e.preventDefault(); setSource(e); });
    cv.addEventListener("pointerdown", function (e) {
      if (e.button === 2) { e.preventDefault(); setSource(e); return; }   // right button = take a sample
      if (e.button !== 0 && e.pointerType === "mouse") return;
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (er) {}
      var p = pos(e);
      if (mode === "clone" && !SRC) {
        toast("🩹 RIGHT-click a clean patch first — that is the spot the brush copies FROM");
        return;
      }
      snapshot();
      drawing = true;
      last = p;
      if (mode === "paint") strokeTo(p);
      else { cloneOff = { x: SRC.x - p.x, y: SRC.y - p.y }; cloneTo(p); }
    });
    cv.addEventListener("pointermove", function (e) {
      var r = cv.getBoundingClientRect();
      var sc = r.width / (cv.width || 1);
      var d = Math.max(6, size * sc);
      var sp = stagePos(e);
      ring.style.display = "flex";
      ring.style.fontSize = Math.max(9, Math.round(d * 0.55)) + "px";
      ring.style.width = ring.style.height = d + "px";
      ring.style.left = (sp.x - d / 2) + "px";
      ring.style.top = (sp.y - d / 2) + "px";
      if (!drawing) return;
      var p = pos(e);
      if (mode === "paint") strokeTo(p); else cloneTo(p);
    });
    ;function endStroke() { drawing = false; }
    cv.addEventListener("pointerup", endStroke);
    cv.addEventListener("pointercancel", endStroke);
    cv.addEventListener("pointerleave", function () { ring.style.display = "none"; endStroke(); });
    window.addEventListener("resize", drawSource);

    ;function onKey(e) {
      if (!document.body || !document.body.contains(ov)) { try { document.removeEventListener("keydown", onKey, true); } catch (er) {} return; }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
      else if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === "z") { e.preventDefault(); undoOne(); }
    }
    document.addEventListener("keydown", onKey, true);
    ov.onclick = function (e) { if (e.target === ov) close(); };
  };
})();
