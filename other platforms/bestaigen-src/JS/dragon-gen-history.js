// dragon-gen-history.js — moved VERBATIM out of index.html (Paket A1, 25.09.2026). Classic script
// (not a module), inserted at the same point of the boot order, so globals and ordering are unchanged.
// Rollback: paste this file's body back into index.html as a plain <script> at its old place.
// ===== Incremental re-apply from 1.3.0 — Item 4: Gen History (thumbnails) + capture =====
(function () {
  if (window.__dragonGenHistInstalled) return;
  window.__dragonGenHistInstalled = true;

  ;function toast(m) { try { if (window.dragonToast) window.dragonToast(m); } catch (e) {} }
    ;function dhash(s) { s = String(s); var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
    ;function kvReady() { return !!(window.root && window.root.kv); }
  ;function setDescFB2(v) { try { return window.setDescFB ? window.setDescFB(v) : (function(){ var ta = document.querySelector('textarea[data-name="description"]'); if (!ta) return false; ta.value = String(v); ta.dispatchEvent(new Event("input", { bubbles: true })); return true; })(); } catch (e) { return false; } }
  var dragonSetDesc = window.dragonSetDesc || setDescFB2;
  var dragonLockSeed = window.dragonLockSeed || function () {};
  var dragonTriggerGen = window.dragonTriggerGen || function () { toast("\u26A0\uFE0F Direct generation arrives in the next step \u2014 for now, use the main Generate button."); };
  var modalShell = window.modalShell;

    var pvMap = {};
    // Preview thumbnails stay mapped to their prompts even after a reload (pvMap used to be write-only).
    try {
      if (kvReady() && window.root.kv.dragonPvSnap) {
        window.root.kv.dragonPvSnap.get("list").then(function (list) {
          if (Array.isArray(list)) list.forEach(function (rec) { if (rec && rec.p && rec.t) pvMap[dhash(rec.p)] = rec.t; });
        }).catch(function () {});
      }
    } catch (e) {}
    var histArr = [];
    var histFullMem = {};
    var histFullIds = [];
    try { var hs = localStorage.dragonGenHist; if (hs) histArr = JSON.parse(hs) || []; } catch (e) {}
    try { histFullIds = JSON.parse(localStorage.dragonGenHistFullIds || "[]"); if (!Array.isArray(histFullIds)) histFullIds = []; } catch (e) { histFullIds = []; }
    window.dragonPvGet = function (prompt) { try { return pvMap[dhash(prompt)] || ""; } catch (e) { return ""; } };
    window.dragonPvSet = function (prompt, thumb) {
      if (!thumb) return;
      try {
        var k = dhash(prompt);
        pvMap[k] = thumb;
        var ks = Object.keys(pvMap);
        if (ks.length > 300) delete pvMap[ks[0]];
        if (kvReady()) window.root.kv.dragonPv.set(k, thumb).catch(function () {});
        // Also keep a durable prompt→thumb snapshot (bounded) for cross-reload preview hydration.
        try {
          if (kvReady() && window.root.kv.dragonPvSnap) {
            var np = String(prompt).slice(0, 300);
            window.root.kv.dragonPvSnap.get("list").then(function (list) {
              list = Array.isArray(list) ? list : [];
              list = list.filter(function (x) { return x && x.p !== np; });
              list.unshift({ p: np, t: thumb });
              if (list.length > 200) list = list.slice(0, 200);
              window.root.kv.dragonPvSnap.set("list", list).catch(function () {});
            }).catch(function () {});
          }
        } catch (e2) {}
      } catch (e) {}
    };
    // generated preview separately (in memory, bounded) so enlarging it in the lightbox is sharp;
    // the durable kv snapshot still stores only the small thumb (too big otherwise).
    var pvFullMap = {};
    var pvFullOrder = [];
    ;function _pvFullMem(k, url) {
      if (!pvFullMap[k]) pvFullOrder.push(k);
      pvFullMap[k] = url;
      while (pvFullOrder.length > 30) { var o = pvFullOrder.shift(); if (o !== k) delete pvFullMap[o]; }
    }
    // Why necessary: (a) clicking the image should show ACTUAL pixels in the lightbox (re-encoded
    // 256px thumb is blurry), (b) the public gallery submission API matches the image by FULL HASH —
    // a re-encoded thumb would get "image_expired" and fail silently. Storing the original
    // ensures both a sharp lightbox and successful submission; it also persists after reload.
    // Egon 12.10.2026 — SEED-SCOPED slots: one prompt produces MANY siblings (a batch shares
    // the prompt, seeds differ), and the old single prompt-keyed slot let the LAST finisher
    // overwrite the others — the 📮 send then uploaded a SIBLING of the tapped image. The store
    // now also keeps a (prompt+seed) slot; readers prefer it and fall back to the legacy slot
    // (seed-less callers behave exactly as before). The durable kv copy keeps the legacy key:
    // after a reload nothing is sendable anyway (freshness is per page load), so no double
    // storage for the same bytes.
    ;function _pvFullSeedStr(seed) { try { var s = (seed != null) ? String(seed) : ""; return (s && s !== "null" && s !== "undefined") ? s : ""; } catch (e) { return ""; } }
    ;function _pvFullKey(prompt, seed) {
      try {
        var p = String(prompt == null ? "" : prompt);
        var s = _pvFullSeedStr(seed);
        return dhash(s ? (p + "\nseed:" + s) : p);
      } catch (e) { return ""; }
    }
    window.dragonPvFullSet = function (prompt, url, seed) {
      if (!url) return;
      var k = "", ks = "";
      try { k = dhash(String(prompt == null ? "" : prompt)); } catch (e) { return; }
      try { ks = _pvFullSeedStr(seed) ? _pvFullKey(prompt, seed) : ""; } catch (e2) {}
      try { if (ks && ks !== k) _pvFullMem(ks, url); } catch (e) {}
      try { _pvFullMem(k, url); } catch (e) {}
      try {
        if (kvReady() && window.root.kv.dragonPvFull) {
          window.root.kv.dragonPvFull.set(k, url).catch(function () {});
          window.root.kv.dragonPvFull.get("__order").then(function (ord) {
            ord = Array.isArray(ord) ? ord.filter(function (x) { return x !== k; }) : [];
            ord.push(k);
            while (ord.length > 80) { var old = ord.shift(); if (old !== k) window.root.kv.dragonPvFull.delete(old).catch(function () {}); }
            window.root.kv.dragonPvFull.set("__order", ord).catch(function () {});
          }).catch(function () {});
        }
      } catch (e2) {}
    };
    window.dragonPvFullGet = function (prompt, seed) {
      try {
        var ks = _pvFullSeedStr(seed) ? _pvFullKey(prompt, seed) : "";
        if (ks && pvFullMap[ks]) return pvFullMap[ks];
        return pvFullMap[dhash(prompt)] || "";
      } catch (e) { return ""; }
    };
    // Async variant: falls back to the durable kv copy so enlarged previews stay sharp and the
    // public-gallery upload sends the exact original bytes even after a reload.
    window.dragonPvFullGetAsync = function (prompt, seed) {
      var k = "", ks = "";
      try { k = dhash(prompt); ks = _pvFullSeedStr(seed) ? _pvFullKey(prompt, seed) : ""; }
      catch (e) { return Promise.resolve(""); }
      if (ks && pvFullMap[ks]) return Promise.resolve(pvFullMap[ks]);
      if (pvFullMap[k]) return Promise.resolve(pvFullMap[k]);
      try {
        if (kvReady() && window.root.kv.dragonPvFull) {
          return window.root.kv.dragonPvFull.get(k).then(function (v) {
            if (v) { try { _pvFullMem(k, v); } catch (e) {} }
            return v || "";
          }).catch(function () { return ""; });
        }
      } catch (e) {}
      return Promise.resolve("");
    };
    ;function histPersistable(en) {
      var o = {};
      for (var k in en) {
        if (k === "full") continue;
        var v = null;
        try { v = en[k]; } catch (eG) { continue; }
        try { if (typeof Node !== "undefined" && v instanceof Node) continue; } catch (eN) {}
        o[k] = v;
      }
      return o;
    }
    ;function persistHist() {
      var clean = [];
      try { clean = histArr.map(histPersistable); } catch (eM) { clean = []; }
      try { localStorage.dragonGenHist = JSON.stringify(clean); } catch (e) {}
      try { if (kvReady()) window.root.kv.dragonGenHist.set("h", clean).catch(function () {}); } catch (e2) {}
    }
    // ---------- storage settings + permanent purge (Egon 28.09.2026) ----------
    // A deleted entry must NEVER come back: the old delete removed the list row but left the
    // full blob (kv), the id list (localStorage) and the recovery "done" set untouched, so the
    // boot recovery resurrected every deleted image. histPurgeBlobs is the ONE place that kills
    // all three, and every removal path (single delete, day delete, clear-all, limit trim) uses it.
    ;function histSetNum(key, fb) {
      try {
        var v = localStorage.getItem(key);
        if (v === "inf") return Infinity;
        var n = parseInt(v, 10);
        if (isFinite(n) && n > 0) return n;
      } catch (e) {}
      return fb;
    }
    ;function histFullLimit() { return histSetNum("dragonHistFullKeep", 200); }
    ;function histTotalLimit() { return histSetNum("dragonHistTotalKeep", 2000); }
    window.dragonHistFullLimit = histFullLimit;
    window.dragonHistTotalLimit = histTotalLimit;
    window.dragonHistRecordOff = function () {
      try { return localStorage.getItem("dragonHistRecord") === "off"; } catch (e) { return false; }
    };
    window.dragonHistRecordSet = function (off) {
      try { localStorage.setItem("dragonHistRecord", off ? "off" : "on"); } catch (e) {}
    };
    var histFullSizes = {};
    try { histFullSizes = JSON.parse(localStorage.dragonHistFullSizes || "{}") || {}; } catch (eSZ) { histFullSizes = {}; }
    ;function histSizeSave() { try { localStorage.dragonHistFullSizes = JSON.stringify(histFullSizes); } catch (e) {} }
    ;function histMarkDone(ids) {
      try {
        var done = {};
        try { (JSON.parse(localStorage.dragonGenHistRecovered || "[]") || []).forEach(function (x) { done[String(x)] = true; }); } catch (eD) {}
        (ids || []).forEach(function (id) { if (id) done[String(id)] = true; });
        localStorage.dragonGenHistRecovered = JSON.stringify(Object.keys(done).slice(-500));
      } catch (e) {}
    }
    ;function histPurgeBlobs(ids) {
      ids = ids || [];
      var dropped = {};
      ids.forEach(function (id) { if (id) dropped[String(id)] = true; });
      ids.forEach(function (id) {
        if (!id) return;
        try { delete histFullMem[id]; } catch (e) {}
        try { delete medMem[id]; } catch (e) {}
        try { delete histFullSizes[String(id)]; } catch (eS) {}
      });
      try { medPrune(ids); } catch (e) {}
      try { if (kvReady() && window.root.kv.dragonGenHistFull) { ids.forEach(function (id) { if (id) window.root.kv.dragonGenHistFull.delete(String(id)).catch(function () {}); }); } } catch (e2) {}
      try {
        histFullIds = histFullIds.filter(function (x) { return !dropped[String(x)]; });
        try { localStorage.dragonGenHistFullIds = JSON.stringify(histFullIds); } catch (eS) {}
      } catch (e3) {}
      try { histSizeSave(); } catch (e4) {}
      histMarkDone(ids);
    }
    window.dragonHistPurgeBlobs = histPurgeBlobs;
    // Enforce the toolbar's storage settings right now (used when the visitor LOWERS a limit).
    window.dragonHistApplyLimits = function () {
      try {
        var tl = histTotalLimit();
        if (histArr.length > tl) {
          var drop = histArr.slice(tl).map(function (h) { return h && h.id; });
          histArr.length = tl;
          histPurgeBlobs(drop);
        }
        var fl = histFullLimit();
        while (histFullIds.length > fl) histPurgeBlobs([histFullIds.shift()]);
        persistHist();
        return true;
      } catch (e) { return false; }
    };
    // Slowly learn the byte size of older fulls (for the toolbar "~Y MB" line): a few kv reads
    // per call, so there is never jank. Sizes of new fulls are noted at capture time.
    window.dragonHistBackfillSizes = function (n) {
      try {
        n = Math.max(1, Math.min(50, n || 8));
        var ids = [];
        for (var i = 0; i < histFullIds.length && ids.length < n; i++) {
          var id = String(histFullIds[i]);
          if (!histFullSizes[id]) ids.push(id);
        }
        if (!ids.length) return "done";
        if (!kvReady() || !window.root.kv.dragonGenHistFull) return "not-ready";
        var store = window.root.kv.dragonGenHistFull;
        (function step(k) {
          if (k >= ids.length) { try { histSizeSave(); } catch (e) {} return; }
          try {
            store.get(ids[k]).then(function (v) {
              try { if (v) histFullSizes[ids[k]] = String(v).length; } catch (e) {}
              step(k + 1);
            }).catch(function () { step(k + 1); });
          } catch (e) { step(k + 1); }
        })(0);
        return "running";
      } catch (e) { return "error"; }
    };
    // Note a freshly resolved full's size (called by the tile upgrade path).
    window.dragonHistNoteFullSize = function (id, url) {
      try {
        id = String(id || "");
        if (!id || !url) return;
        if (!histFullSizes[id]) { histFullSizes[id] = String(url).length; histSizeSave(); }
      } catch (e) {}
    };    // Exact full count + approximate MB (base64 length x 0.75) for the toolbar usage line.
    window.dragonHistStorageStats = function () {
      var n = 0, bytes = 0;
      try {
        for (var k in histFullSizes) { n++; bytes += (+histFullSizes[k] || 0); }
        if (!n && histFullIds.length) n = histFullIds.length;
      } catch (e) { try { n = histFullIds.length; } catch (e2) {} }
      return { fulls: n, mb: bytes > 0 ? (bytes * 0.75 / 1048576) : 0 };
    };
    ;function addHistory(en, forcePs) {
      try { if (window.dragonHistRecordOff && window.dragonHistRecordOff()) return; } catch (eR) {}
      try { window.__dbgAH = {t: Date.now(), hasThumb: !!(en && en.thumb), arr: Array.isArray(histArr), len: (histArr && histArr.length), frozen: (function(){ try { return Object.isFrozen(histArr); } catch(eF){ return "e"; } })(), unshiftType: (function(){ try { return typeof histArr.unshift; } catch(eU){ return "e"; } })(), protoOk: (function(){ try { return histArr.unshift === Array.prototype.unshift; } catch(eP){ return "e"; } })()}; } catch (eDA) {}
      if (!en || !en.thumb) return;
      try { en.__ps = (forcePs !== undefined) ? forcePs : (window.__dragonProdSession || 0); } catch (e) {}
      try { window.__dragonForceSeed = null; } catch (e) {}
      try {
        if (en.full) {
          histFullMem[en.id] = en.full;
          try { histFullSizes[String(en.id)] = String(en.full).length; histSizeSave(); } catch (eSZ) {}
          histFullIds.push(en.id);
          var _fl = histFullLimit();
          while (histFullIds.length > _fl) {
            var old = histFullIds.shift();
            histPurgeBlobs([old]);
          }
          try { localStorage.dragonGenHistFullIds = JSON.stringify(histFullIds); } catch (e) {}
          try { if (kvReady() && window.root.kv.dragonGenHistFull) window.root.kv.dragonGenHistFull.set(String(en.id), en.full).catch(function () {}); } catch (e) {}
        }
        var meta = {};
        for (var kk in en) { if (kk !== "full") meta[kk] = en[kk]; }
        histArr.unshift(meta);
        try { window.__dbgAH.m3 = histArr.length; } catch (eM3) {}
        var _tl = histTotalLimit();
        if (histArr.length > _tl) {
          var _drop = histArr.slice(_tl).map(function (h) { return h && h.id; });
          histArr.length = _tl;
          histPurgeBlobs(_drop);
        }
        persistHist();
        try { window.__dbgAH.post = JSON.parse(localStorage.getItem("dragonGenHist") || "[]").length; } catch (eDP) {}
      } catch (e) {}
    }
    ;function makeThumb(dataUrl, side, cb, q) {
      try {
        var im = new Image();
        im.onload = function () {
          try {
            var s = Math.min(1, side / Math.max(im.width, im.height));
            var w = Math.max(1, Math.round(im.width * s)), h = Math.max(1, Math.round(im.height * s));
            var cv = document.createElement("canvas"); cv.width = w; cv.height = h;
            cv.getContext("2d").drawImage(im, 0, 0, w, h);
            cb(cv.toDataURL("image/jpeg", q || 0.6));
          } catch (e) { cb(null); }
        };
        im.onerror = function () { cb(null); };
        im.src = dataUrl;
      } catch (e) { cb(null); }
    }
    // ═══════════════ 🟢 THE STANDARD "generating…" BAR ═══════════════
    // ONE implementation for every production path: the bar covers the bottom 45% of the IMAGE (measured from
    // the plugin's own iframe, so it follows the real picture, not the tile's buttons), spans the image's full
    // width so its two ends meet the picture's edges, carries a small live timer, and removes itself the
    // moment the image lands. Its height, track and label scale with that 45% - no fixed pixel size.
    window.dragonGenBar = function (tile) {
      if (!tile) return null;
      try { if (getComputedStyle(tile).position === "static") tile.style.position = "relative"; } catch (e) {}
      var wrap = document.createElement("div");
      wrap.className = "dragon-genbar dragon-keep";
      wrap.style.cssText = "position:absolute; z-index:6; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:.3rem; pointer-events:none; background:linear-gradient(180deg, rgba(10,10,14,0) 0%, rgba(10,10,14,.46) 44%, rgba(10,10,14,.78) 100%); border-radius:0; padding:.25rem 0; box-sizing:border-box;";
      var track = document.createElement("div");
      track.style.cssText = "width:100%; max-width:100%; height:9px; border-radius:8px; background:rgba(255,255,255,.15); overflow:hidden; box-shadow:inset 0 1px 2px rgba(0,0,0,.55),0 0 8px rgba(74,222,128,.32);";
      var fill = document.createElement("div");
      fill.style.cssText = "height:100%; width:34%; background:linear-gradient(90deg,#16a34a,#4ade80,#16a34a);";
      track.appendChild(fill);
      var lbl = document.createElement("div");
      // The label never spills outside the picture: it is capped to the bar's own width and its type is
      // scaled down to fit (place() re-computes both from the image's real box on every tick).
      lbl.style.cssText = "font-size:.72rem; font-weight:800; color:#dbf7e4; text-shadow:0 1px 3px #000; white-space:nowrap; max-width:100%; overflow:hidden; text-overflow:clip; box-sizing:border-box;";
      lbl.textContent = "\u23F3 0.0s";
      wrap.append(track, lbl);
      tile.appendChild(wrap);
      var anim = null;
      try { anim = fill.animate([{ transform: "translateX(-130%)" }, { transform: "translateX(300%)" }], { duration: 1400, iterations: Infinity, easing: "ease-in-out" }); } catch (e) {}
      var t0 = Date.now(), done = false;
      ;function fmt(ms) {
        var s = ms / 1000;
        return s < 60 ? (s.toFixed(1) + "s") : (Math.floor(s / 60) + "m " + Math.floor(s % 60) + "s");
      }
      // The bottom 45% of the IMAGE: measured against the plugin's iframe (the picture), falling back to the
      // whole tile while the iframe still has no box. Nothing here is a fixed pixel size, so the bar follows
      // the Control Panel's Display setting (the tile's own width/height).
      ;function place() {
        var ir = null, q = 0.45, LIFT = 0;
        try { var f = tile.querySelector("iframe"); if (f) ir = f.getBoundingClientRect(); } catch (e) {}
        var tr = tile.getBoundingClientRect();
        if (ir && ir.height > 40 && ir.width > 40) {
          var h = ir.height * q;
          // Egon 27.09.2026 — the bar's darkened bottom edge must MEET the picture's own bottom edge: the
          // 20px lift of the previous build left an unpainted strip under the gradient, so LIFT is 0 now
          // and the box is still clamped so it can never leave the picture's own area.
          var topIn = Math.max(ir.top - tr.top, ir.bottom - tr.top - h - LIFT);
          wrap.style.left = (Math.floor(ir.left - tr.left) - 1) + "px";
          wrap.style.width = (Math.ceil(ir.width) + 2) + "px";
          wrap.style.height = (Math.ceil(h) + 1) + "px";
          wrap.style.top = topIn + "px";
          wrap.style.bottom = "auto";
          track.style.height = Math.max(4, Math.min(14, h * 0.09)).toFixed(1) + "px";
          // the label's type follows the image's display size, but is also capped by the image's WIDTH so
          // "\u23F3 Generating\u2026 123.4s" always fits inside the picture (never overflows).
          var fitW = ir.width / 12;
          lbl.style.fontSize = Math.max(8, Math.min(17, Math.min(h * 0.2, fitW))).toFixed(2) + "px";
        } else {
          wrap.style.left = "0px"; wrap.style.width = "100%";
          wrap.style.height = "45%"; wrap.style.top = "auto"; wrap.style.bottom = (LIFT > 0 ? LIFT + "px" : "0px");
        }
      }
      place();
      var retryB = null;
      var iv = setInterval(function () {
        place();
        var _el = Date.now() - t0;
        lbl.textContent = "\u23F3 " + fmt(_el);
        if (!done && _el > 480000 && !retryB && !tile.__dragonRetried && tile && tile.isConnected) {
          retryB = document.createElement("button");
          retryB.type = "button";
          retryB.textContent = "\u21BB Restart this image (starts over!)";
          retryB.title = "Restarts THIS picture from zero \u2014 only use if truly stuck; while the queue is slow this just begins the wait again";
          retryB.style.cssText = "pointer-events:auto;cursor:pointer;max-width:100%;box-sizing:border-box;font-size:.72rem;font-weight:800;color:#fff;border:1px solid #4ade80;background:linear-gradient(180deg,#1f6b3a,#0d3a1f);border-radius:999px;padding:.3rem .9rem;font-family:inherit;";
          retryB.onclick = function (e) {
            try { e.stopPropagation(); } catch (e2) {}
            retryB.disabled = true; retryB.textContent = "\u21BB restarting from zero\u2026";
            try { tile.__dragonRetried = true; } catch (eR) {}
            try { toast("\u21BB restarting this image from zero\u2026"); } catch (eT) {}
            var reset = function () { t0 = Date.now(); try { if (retryB && retryB.parentNode) retryB.remove(); } catch (e3) {} retryB = null; };
            try {
              if (window.dragonTileRefresh) { window.dragonTileRefresh(tile, "same", true, true).then(function () { reset(); }).catch(function () { reset(); }); }
              else { try { var f = tile.querySelector("iframe"); if (f) { var u = f.src; f.src = ""; setTimeout(function () { try { f.src = u; } catch (e4) {} }, 850); } } catch (e5) {} reset(); }
            } catch (e6) { reset(); }
          };
          wrap.appendChild(retryB);
        }
      }, 200);
      return {
        el: wrap,
        set: function (pct, text) { if (text != null) lbl.textContent = text; },
        done: function () {
          if (done) return; done = true;
          clearInterval(iv);
          try { if (anim) anim.cancel(); } catch (e) {}
          try { wrap.remove(); } catch (e) {}
        }
      };
    };

    ;function setupCapture() {
      var oa = document.getElementById("outputAreaEl");
      if (!oa) return false;
      var scan = function () {
        var cs = oa.querySelectorAll(".t2i-image-ctn");
        for (var i = 0; i < cs.length; i++) (function (c) {
          if (c.__dragonCap) return;
          c.__dragonCap = true;
          try { if (c.__dragonSeq == null && window.dragonSeqOf) window.dragonSeqOf(c); } catch (eSQ) {}
          try { c.__dragonCapAt = Date.now(); } catch (eCA) {}
          // The standard "generating…" bar (bottom 45% of the image, its own live timer). It is used by EVERY
          // production path that ends in a .t2i-image-ctn in #outputAreaEl — Generate, Character Creation,
          // Premade characters, ⚗️ Test Multiple Styles and 🧪 Prompt Tag Lab.
          // (Egon 28.09.2026 (W-UI361): the Default Panel custom mix paints no bar of ours —
          // original boxes only — but the history record is mode-independent and always runs.)
          var _defPanel = false;
          try { _defPanel = window.dragonViewMode && window.dragonViewMode() === "custom" && window.dragonViewCustomGet && window.dragonViewCustomGet().layout === "default"; } catch (eDP) {}
          var prog = null;
          try { if (window.dragonGenBar && !_defPanel) prog = window.dragonGenBar(c); } catch (e) {}
          (function () {
            var tries = 0;
            var iv = setInterval(function () {
              tries++;
              // A tile taken off the page (Reset policy, a cleared stage) is done being watched: its
              // late finish must not record, swap a card, or leave a bar behind.
              if (!c.isConnected || c.__dragonAborted) { clearInterval(iv); if (prog) { try { prog.done(); } catch (ePD) {} } return; }
              try {
                var f = c.querySelector("iframe");
                var o = f && f.textToImagePluginOutput;
                if (o && o.dataUrl) {
                  try { window.__dbgBranch = (window.__dbgBranch || 0) + 1; } catch (eDB) {}
                  clearInterval(iv);
                  if (prog) { try { prog.done(); } catch (e) {} }
                  try { if (window.dragonProdSwapTile) window.dragonProdSwapTile(c); } catch (eSW) {}
                  try { if (window.dragonMarkFreshImage) window.dragonMarkFreshImage(o.dataUrl); } catch (eMK) {}
                  var ins = o.inputs || {};
                  var prompt = String(ins.prompt || "");
                  if (prompt.length < 3) prompt = "generated image";
                  var hid = "h" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
                  // generated image was stored as 96px @0.6 (blurry in a 108px box).
                  // Now the small 96px thumb stays EXACTLY as is for history (to avoid localStorage bloating) but
                  // a SEPARATE 256px @0.72 quality thumb is produced for previews (dragonPvSet).
                  // (The image produced when clicking the Preview button was already sharp at 256px @0.7.)
                  makeThumb(o.dataUrl, 96, function (thumb) {
                    try { window.__dbgThumb = (window.__dbgThumb || 0) + 1; window.__dbgThumbNull = thumb ? 0 : ((window.__dbgThumbNull || 0) + 1); } catch (eDT) {}
                    if (thumb) {
                      // Egon 12.10.2026 — gallery meta stamp: the plugin's evaluated inputs carry the
                      // saveTitle / saveDescription that were sent with this generation, so the history
                      // entry keeps the upload TITLE + DESCRIPTION + parsed date for display.
                      var _st = "", _sd = "", _sdt = "";
                      try {
                        if (ins.saveTitle != null) _st = String((ins.saveTitle && ins.saveTitle.evaluateItem !== undefined) ? ins.saveTitle.evaluateItem : ins.saveTitle);
                        if (ins.saveDescription != null) _sd = String((ins.saveDescription && ins.saveDescription.evaluateItem !== undefined) ? ins.saveDescription.evaluateItem : ins.saveDescription);
                        if (_sd && window.dragonUpMetaParseDesc) _sdt = window.dragonUpMetaParseDesc(_sd).date || "";
                      } catch (eUM) {}
                      addHistory({ t: Date.now(), p: prompt, seed: (o.seedUsed != null ? String(o.seedUsed) : (ins.seed != null ? String(ins.seed) : "")), res: ins.resolution || "", neg: ins.negativePrompt != null ? String(ins.negativePrompt) : "", gs: ins.guidanceScale != null ? String(ins.guidanceScale) : "", thumb: thumb, full: o.dataUrl, id: hid, stitle: _st, sdesc: _sd, sdate: _sdt, desc: (function () { try { var _ta = document.querySelector('textarea[data-name="description"]'); return String((_ta && _ta.value) || "").replace(/\(seed:::\s*\d+\)/g, "").trim(); } catch (e) { return ""; } })() });
                      try { if (window.dragonHistRerender) window.dragonHistRerender(); } catch (eR) {}
                    }
                  });
                  makeThumb(o.dataUrl, 256, function (pvThumb) {
                    if (!pvThumb) return;
                    window.dragonPvSet(prompt, pvThumb);
                    // lightbox opens sharp + submission to public gallery actually works since hashes match.
                    // Egon 12.10.2026 — the seed travels too: batch siblings share this prompt, so the
                    // full-original slot is seed-scoped (else the last finisher shadows the others and
                    // the 📮 send uploads a sibling of the tapped image).
                    try { if (window.dragonPvFullSet) window.dragonPvFullSet(prompt, o.dataUrl, (o.seedUsed != null ? o.seedUsed : ins.seed)); } catch (e) {}
                    try {
                      var ta0 = document.querySelector('textarea[data-name="description"]');
                      if (ta0) {
                        var rawDesc = String(ta0.value || "").replace(/\(seed:::\s*\d+\)/g, "").trim();
                        if (rawDesc.length >= 3) { window.dragonPvSet(rawDesc, pvThumb); try { if (window.dragonPvFullSet) window.dragonPvFullSet(rawDesc, o.dataUrl, (o.seedUsed != null ? o.seedUsed : ins.seed)); } catch (e3) {} }
                      }
                    } catch (e) {}
                  }, 0.72);
                  // Medium (~1000px) JPEG cached in IndexedDB so the History thumbnail can open LARGE
                  // even after a reload / when root.kv is unavailable (editor preview).
                  makeThumb(o.dataUrl, 1000, function (med) { if (med) { medMem[hid] = med; medPut(hid, med); } });
                } else if (tries > 5000) {
                  clearInterval(iv);
                  try {
                    var f2 = c.querySelector("iframe");
                    var o2 = f2 && f2.textToImagePluginOutput;
                    if (o2 && o2.dataUrl && window.dragonHistAddImage) {
                      window.dragonHistAddImage({ dataUrl: o2.dataUrl, inputs: o2.inputs || {}, seed: (o2.seedUsed != null ? o2.seedUsed : null) });
                    }
                  } catch (eL) {}
                  if (prog) { try { prog.done(); } catch (e) {} }
                }
              } catch (e) { clearInterval(iv); if (prog) { try { prog.done(); } catch (e2) {} } }
            }, 250);
          })();
        })(cs.item(i));
      };
      new MutationObserver(scan).observe(oa, { childList: true, subtree: true });
      scan();
      return true;
    }
    window.dragonHistoryPanel = window.dragonGenHistoryPanel = function () {
      if (document.querySelector(".dragon-genhist-modal")) return;
      var session = (window.dragonGetSessionHistory && window.dragonGetSessionHistory()) || [];
      var merged = histArr.slice();
      session.forEach(function (s) {
        var dup = merged.some(function (h) {
          return String(h.p || "") === String(s.prompt || "") && String(h.seed || "") === String(s.seed != null ? s.seed : "");
        });
        if (!dup) merged.push({ t: s.ts || Date.now(), p: s.prompt || "", seed: s.seed != null ? String(s.seed) : "", res: s.resolution || "", thumb: s.url || "", _session: true, _e: s });
      });
      merged.sort(function (a, b) { return (b.t || 0) - (a.t || 0); });
      var m = modalShell("dragon-genhist-modal", "min(620px,96vw)", "86vh", "\uD83D\uDD50 History");
      var bar = document.createElement("div");
      bar.style.cssText = "display:flex; gap:.4rem; flex-wrap:wrap;";
      var btnRecent = document.createElement("button");
      btnRecent.textContent = "\uD83D\uDDBC\uFE0F Recent Created Images";
      var btnCmd = document.createElement("button");
      btnCmd.textContent = "\uD83E\uDDED Click Navigation";
      btnCmd.title = "Open Click Navigation \u2014 jump to any page or panel (Ctrl+K / \u2318K)";
      btnCmd.onclick = function (ev) { ev.stopPropagation(); if (window.dragonOpenCommandPalette) window.dragonOpenCommandPalette(); };
      bar.append(btnRecent, btnCmd);
      m.box.appendChild(bar);
      var list = document.createElement("div");
      list.style.cssText = "flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:.4rem;";
      ;function fmt(t) {
        var d = Date.now() - (t || 0);
        if (d < 60000) return "just now";
        if (d < 3600000) return Math.floor(d / 60000) + "m ago";
        if (d < 86400000) return Math.floor(d / 3600000) + "h ago";
        return Math.floor(d / 86400000) + "d ago";
      }
      ;function row(en) {
        var r = document.createElement("div");
        r.style.cssText = "display:flex; gap:.5rem; align-items:center; border:1px solid #3a3a48; border-radius:10px; padding:.4rem .5rem; background:#0f0f15;";
        var th = document.createElement("img");
        th.src = en.thumb || "";
        th.style.cssText = "flex:0 0 44px; width:44px; height:44px; object-fit:cover; border-radius:6px; border:1px solid #2e2e3a; cursor:zoom-in;";
        th.title = "Click To Enlarge";
        th.onclick = function (ev) {
          ev.stopPropagation();
          var li = merged.indexOf(en);
          ;function lbList() {
            return merged.map(function (x) {
              return { url: x.full || (x.id && histFullMem[x.id]) || x.thumb || "", prompt: x.p || "", desc: (x.desc || "") };
            });
          }
          var open = function (url) {
            if (!url) return;
            var arr = lbList();
            if (li >= 0 && li < arr.length) arr[li] = { url: url, prompt: en.p || "", desc: (en.desc || "") };
            // of the image to switch to the previous/next history image WORKS (standard lightbox behavior).
            if (window.dragonZoomLightbox) window.dragonZoomLightbox({ url: url, prompt: en.p || "", desc: (en.desc || "") }, null, (arr.length > 1 ? arr : null), (li >= 0 ? li : 0), null, { pushPublic: true });
            else if (window.dragonLightbox) dragonLightbox({ url: url, prompt: en.p || "", desc: (en.desc || "") });
            else window.open(url, "_blank");
          };
          var full = en.full || (en.id && histFullMem[en.id]);
          if (full) { open(full); return; }
          if (en.id && kvReady() && window.root && window.root.kv && window.root.kv.dragonGenHistFull) {
            window.root.kv.dragonGenHistFull.get(String(en.id)).then(function (v) { open(v || en.thumb || ""); }).catch(function () { open(en.thumb || ""); });
          } else {
            open(en.thumb || "");
          }
        };
        var col = document.createElement("div");
        col.style.cssText = "flex:1; min-width:0; display:flex; flex-direction:column; gap:.15rem;";
        // examined with the 📋 Prompt Info button in the lightbox). DEPOT — not deleted.
        // var tx = document.createElement("div");
        // tx.textContent = en.p;
        // tx.style.cssText = "font-size:.72rem; color:#e8e6ee; word-break:break-word; line-height:1.3; max-height:2.6rem; overflow:hidden;";
        var meta = document.createElement("div");
        meta.textContent = fmt(en.t) + (en.seed ? " \u00B7 seed " + en.seed : "") + (en.res ? " \u00B7 " + en.res : "") + (en._session ? " \u00B7 this session" : "") + (en.sdate ? " \u00B7 \uD83D\uDCC5 " + en.sdate : "");
        meta.style.cssText = "font-size:.62rem; color:#8a8a9a;";
        // Egon 12.10.2026 — gallery meta display: the upload title stamped at generation time
        // (full description kept in the tooltip).
        if (en.stitle) {
          var ttl = document.createElement("div");
          ttl.textContent = en.stitle;
          ttl.title = en.sdesc || en.stitle;
          ttl.style.cssText = "font-size:.72rem; font-weight:bold; color:#e8e6ee; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%;";
          col.append(ttl);
        }
        col.append(meta);
        ;function mb(t, fn) { var b = document.createElement("button"); b.textContent = t; b.style.cssText = "font-size:.62rem; padding:.16rem .45rem; border:1px solid #6a6a78; background:linear-gradient(145deg,#24242d,#131318); color:#ccc; border-radius:6px; cursor:pointer;"; b.onclick = fn; return b; }
        var u = mb("\uD83D\uDCDD Use", function () { if (dragonSetDesc(en.p)) toast("\uD83D\uDCDD prompt loaded"); });
        var g = mb("\u2728 Generate", function () {
          dragonSetDesc(en.p);
          if (en.seed && window.dragonForceSeed) window.dragonForceSeed(en.seed); else if (en.seed) dragonLockSeed(String(en.seed).replace(/\D/g, ""));
          dragonTriggerGen();
          toast("\u2728 generating\u2026");
        });
        var d = mb("\uD83D\uDDD1\uFE0F", function () {
          if (en._session && window.dragonGetSessionHistory) {
            var s = window.dragonGetSessionHistory();
            var i = s.indexOf(en._e);
            if (i !== -1) s.splice(i, 1);
          } else {
            var i2 = histArr.indexOf(en);
            if (i2 !== -1) histArr.splice(i2, 1);
            persistHist();
          }
          r.remove();
        });
        r.append(th, col, u, g, d);
        return r;
      }
      ;function render() {
        list.innerHTML = "";
        if (!merged.length) {
          var em = document.createElement("div");
          em.textContent = "No history yet \u2014 generate a few images and they'll show up here with thumbnails.";
          em.style.cssText = "color:#aaa; font-size:.82rem; text-align:center; padding:1.5rem;";
          list.appendChild(em);
          return;
        }
        for (var i = 0; i < merged.length; i++) list.appendChild(row(merged[i]));
      }
      var foot = document.createElement("div");
      foot.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap:.5rem;";
      var clearB = document.createElement("button");
      clearB.textContent = "\uD83E\uDDF9 Clear all";
      clearB.style.cssText = "padding:.3rem .7rem; border:1px solid #c81e2e; background:linear-gradient(145deg,#3a1418,#170708); color:#ff9aa3; border-radius:7px; cursor:pointer; font-size:.75rem;";
      clearB.onclick = function () {
        histArr = [];
        histFullMem = {};
        histFullIds = [];
        try { localStorage.dragonGenHist = JSON.stringify(histArr); } catch (e) {}
        try { localStorage.dragonGenHistFullIds = "[]"; } catch (e) {}
        if (kvReady() && window.root.kv.dragonGenHistFull) window.root.kv.dragonGenHistFull.clear().catch(function () {});
        if (kvReady()) window.root.kv.dragonGenHist.set("h", histArr).catch(function () {});
        if (window.dragonSessionClear) window.dragonSessionClear();
        merged = [];
        render();
      };
      foot.appendChild(clearB);
      ;function styleBtns(active) {
        var on = "flex:1 1 auto; padding:.42rem .6rem; border:1px solid #9b6bff; border-radius:9px; background:linear-gradient(180deg,#5a3fa0,#2a1d52); color:#fff; cursor:pointer; font-weight:bold; font-size:.8rem; box-shadow:0 0 12px rgba(155,107,255,.45);";
        var off = "flex:1 1 auto; padding:.42rem .6rem; border:1px solid #5a5a6a; border-radius:9px; background:linear-gradient(145deg,#2a2a33,#17171c); color:#ddd; cursor:pointer; font-weight:bold; font-size:.8rem;";
        btnRecent.style.cssText = active === "recent" ? on : off;
      }
      btnRecent.onclick = function () { styleBtns("recent"); foot.style.display = "flex"; render(); };
      styleBtns("recent");
      m.box.appendChild(list);
      m.box.appendChild(foot);
      render();
    };

  // The nav History now renders as a real full-screen PAGE (built in the pages script). These
  // exports let that page read the merged history, resolve a full/medium image, delete one or
  // clear all — without duplicating this closure's private state. A medium (~1000px) JPEG per
  // entry is cached in IndexedDB so a clicked thumbnail opens LARGE even after a reload, when
  // root.kv is unavailable (editor preview) and localStorage can't hold full images.
  var medMem = {};
  var _histDb = null;
  ;function histDB() {
    return new Promise(function (res) {
      if (_histDb) return res(_histDb);
      try {
        if (!window.indexedDB) return res(null);
        var rq = indexedDB.open("dragonHistDB", 1);
        rq.onupgradeneeded = function () { try { rq.result.createObjectStore("med"); } catch (e) {} };
        rq.onsuccess = function () { _histDb = rq.result; res(_histDb); };
        rq.onerror = function () { res(null); };
      } catch (e) { res(null); }
    });
  }
  ;function medPut(id, val) { if (!id || !val) return; histDB().then(function (db) { if (!db) return; try { db.transaction("med", "readwrite").objectStore("med").put(val, String(id)); } catch (e) {} }); }
  ;function medGet(id) {
    if (!id) return Promise.resolve("");
    if (medMem[id]) return Promise.resolve(medMem[id]);
    return histDB().then(function (db) {
      return new Promise(function (res) {
        if (!db) return res("");
        try {
          var rq = db.transaction("med", "readonly").objectStore("med").get(String(id));
          rq.onsuccess = function () { var v = rq.result || ""; if (v) medMem[id] = v; res(v); };
          rq.onerror = function () { res(""); };
        } catch (e) { res(""); }
      });
    });
  }
  ;function medPrune(ids) { histDB().then(function (db) { if (!db) return; try { var st = db.transaction("med", "readwrite").objectStore("med"); ids.forEach(function (id) { st.delete(String(id)); }); } catch (e) {} }); }
  window.dragonHistGetMerged = function () {
    var session = (window.dragonGetSessionHistory && window.dragonGetSessionHistory()) || [];
    var merged = histArr.slice();
    session.forEach(function (s) {
      var dup = merged.some(function (h) { return String(h.p || "") === String(s.prompt || "") && String(h.seed || "") === String(s.seed != null ? s.seed : ""); });
      if (!dup) merged.push({ t: s.ts || Date.now(), p: s.prompt || "", seed: s.seed != null ? String(s.seed) : "", res: s.resolution || "", thumb: s.url || "", _session: true, _e: s });
    });
    try {
      var ps = window.__dragonProdSession || 0;
      if (ps) merged = merged.filter(function (h) { return !(h.__ps && h.__ps === ps); });
    } catch (e) {}
    merged.sort(function (a, b) { return (b.t || 0) - (a.t || 0); });
    return merged;
  };
  window.dragonHistGetAll = function () {
    var session = (window.dragonGetSessionHistory && window.dragonGetSessionHistory()) || [];
    var merged = histArr.slice();
    session.forEach(function (s) {
      var dup = merged.some(function (h) { return String(h.p || "") === String(s.prompt || "") && String(h.seed || "") === String(s.seed != null ? s.seed : ""); });
      if (!dup) merged.push({ t: s.ts || Date.now(), p: s.prompt || "", seed: s.seed != null ? String(s.seed) : "", res: s.resolution || "", thumb: s.url || "", _session: true, _e: s });
    });
    merged.sort(function (a, b) { return (b.t || 0) - (a.t || 0); });
    return merged;
  };
  // 🔄 Egon 27.09.2026 (WP-UI005) — a picture produced OUTSIDE the normal Generate flow (our isolated
  // embed refresh of an old history image, or an in-place refresh of a live tile) must land in the
  // SAME history, with the same thumbnails/medium/full pipeline. This is the ONE entry point for that.
  window.dragonHistAddImage = function (o) {
    try {
      if (window.dragonHistRecordOff && window.dragonHistRecordOff()) return "off";
      if (!o || !o.dataUrl) return "";
      var ins = o.inputs || {};
      var prompt = String(o.prompt != null ? o.prompt : (ins.prompt || ""));
      if (prompt.length < 3) prompt = "generated image";
      var hid = "h" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
      try { if (window.dragonMarkFreshImage) window.dragonMarkFreshImage(o.dataUrl); } catch (eMK) {}
      makeThumb(o.dataUrl, 96, function (thumb) {
        if (!thumb) return;
        var _st2 = "", _sd2 = "", _sdt2 = "";
        try {
          if (ins.saveTitle != null) _st2 = String((ins.saveTitle && ins.saveTitle.evaluateItem !== undefined) ? ins.saveTitle.evaluateItem : ins.saveTitle);
          if (ins.saveDescription != null) _sd2 = String((ins.saveDescription && ins.saveDescription.evaluateItem !== undefined) ? ins.saveDescription.evaluateItem : ins.saveDescription);
          if (_sd2 && window.dragonUpMetaParseDesc) _sdt2 = window.dragonUpMetaParseDesc(_sd2).date || "";
        } catch (eUM2) {}
        addHistory({
          t: (o.t != null ? o.t : Date.now()),
          p: prompt,
          seed: ins.seed != null ? String(ins.seed) : (o.seed != null && o.seed !== "" ? String(o.seed) : ""),
          res: o.resolution || ins.resolution || "",
          neg: o.neg != null ? String(o.neg) : (ins.negativePrompt != null ? String(ins.negativePrompt) : ""),
          gs: o.gs != null ? String(o.gs) : (ins.guidanceScale != null ? String(ins.guidanceScale) : ""),
          thumb: thumb,
          full: o.dataUrl,
          id: hid,
          stitle: _st2, sdesc: _sd2, sdate: _sdt2,
          desc: (o.desc || "")
        }, 0);
        makeThumb(o.dataUrl, 256, function (pv) {
          if (!pv) return;
          window.dragonPvSet(prompt, pv);
          // Egon 12.10.2026 — seed-scoped (see above): batch siblings share the prompt.
          try { if (window.dragonPvFullSet) window.dragonPvFullSet(prompt, o.dataUrl, (ins.seed != null ? ins.seed : o.seed)); } catch (e3) {}
        }, 0.72);
        makeThumb(o.dataUrl, 1000, function (med) { if (med) { medMem[hid] = med; medPut(hid, med); } });
        try { if (window.dragonHistRerender) window.dragonHistRerender(); } catch (e4) {}
      });
      return hid;
    } catch (e) { return ""; }
  };
  // Best available render size: full (kv/mem) → medium (IndexedDB) → thumb.
  window.dragonHistResolveImage = function (en, cb) {
    if (!en) return cb("");
    var full = en.full || (en.id && histFullMem[en.id]);
    if (full) { try { if (en.id && window.dragonHistNoteFullSize) window.dragonHistNoteFullSize(en.id, full); } catch (e) {} return cb(full); }
    var fallback = function () { medGet(en.id).then(function (m) { cb(m || en.thumb || ""); }); };
    if (en.id && kvReady() && window.root && window.root.kv && window.root.kv.dragonGenHistFull) {
      window.root.kv.dragonGenHistFull.get(String(en.id)).then(function (v) { if (v) { try { if (window.dragonHistNoteFullSize) window.dragonHistNoteFullSize(en.id, v); } catch (e2) {} cb(v); } else fallback(); }).catch(fallback);
      return;
    }
    fallback();
  };
  window.dragonHistDelete = function (en) {
    try {
      if (en._session && window.dragonGetSessionHistory) {
        var s = window.dragonGetSessionHistory();
        var i = s.indexOf(en._e);
        if (i !== -1) s.splice(i, 1);
      } else {
        var i2 = histArr.indexOf(en);
        if (i2 !== -1) histArr.splice(i2, 1);
        persistHist();
      }
      if (en.id) histPurgeBlobs([en.id]);
    } catch (e) {}
  };
  // restored with one tap, and (b) DEFERS the irreversible blob/medium purge until the undo toast
  // expires WITHOUT being tapped. The list is hidden immediately (whole point of "clear"), but the
  // underlying entries survive in storage for the 7s undo window, so nothing is lost by accident.
  window.dragonHistClearAll = function () {
    var _snap = {
      arr: histArr.slice(),
      fullMem: {}, fullIds: histFullIds.slice(), fullSizes: {},
      lsFull: localStorage.dragonGenHistFullIds,
      session: (window.dragonGetSessionHistory ? window.dragonGetSessionHistory().slice() : [])
    };
    try { for (var _sk in histFullSizes) _snap.fullSizes[_sk] = histFullSizes[_sk]; } catch (eSN) {}
    for (var _k in histFullMem) _snap.fullMem[_k] = histFullMem[_k];
    // irreversible purge — runs only if the undo toast expires untouched
    ;function _purgeBlobs() {
      try { if (kvReady() && window.root.kv.dragonGenHistFull) window.root.kv.dragonGenHistFull.clear().catch(function () {}); } catch (e) {}
      for (var k in medMem) delete medMem[k];
      histDB().then(function (db) { if (!db) return; try { db.transaction("med", "readwrite").objectStore("med").clear(); } catch (e) {} });
    }
    ;function _restore() {
      histArr = _snap.arr; histFullMem = _snap.fullMem; histFullIds = _snap.fullIds;
      try { histFullSizes = _snap.fullSizes || {}; histSizeSave(); } catch (eRS) {}
      persistHist();
      try { localStorage.dragonGenHistFullIds = _snap.lsFull || "[]"; } catch (e) {}
      if (window.dragonGetSessionHistory) {
        var live = window.dragonGetSessionHistory();
        live.length = 0;
        for (var i = 0; i < _snap.session.length; i++) live.push(_snap.session[i]);
      }
      if (window.dragonHistRerender) window.dragonHistRerender();
      if (window.dragonToast) window.dragonToast("\u21A9\uFE0F history restored");
    }
    histArr = []; histFullMem = {}; histFullIds = [];
    try { localStorage.dragonGenHist = JSON.stringify(histArr); } catch (e) {}
    try { localStorage.dragonGenHistFullIds = "[]"; } catch (e) {}
    try { histFullSizes = {}; histSizeSave(); } catch (eSZ) {}
    try { histMarkDone(_snap.fullIds); } catch (eMD) {}
    if (kvReady()) window.root.kv.dragonGenHist.set("h", histArr).catch(function () {});
    if (window.dragonSessionClear) window.dragonSessionClear();
    if (window.dragonToastAction) window.dragonToastAction("\uD83E\uDDF9 history cleared", "Undo", _restore, 8000, _purgeBlobs);
    else _purgeBlobs();
  };

  // Egon 29.10.2026 (gercek silme) — Prompt History Clear All is a REAL delete, like the
  // Image History one: entries leave the lists immediately (prompts AND their image records,
  // they share the same entries), the blob/medium purge waits for the 8s Undo window.
  window.dragonHistClearPrompts = function () {
    var _snap = {
      arr: histArr.slice(),
      fullMem: {}, fullIds: histFullIds.slice(), fullSizes: {},
      lsFull: localStorage.dragonGenHistFullIds,
      session: (window.dragonGetSessionHistory ? window.dragonGetSessionHistory().slice() : [])
    };
    try { for (var _sk in histFullSizes) _snap.fullSizes[_sk] = histFullSizes[_sk]; } catch (eSN) {}
    for (var _k in histFullMem) _snap.fullMem[_k] = histFullMem[_k];
    // the old cutoff-hiding key is retired: nothing hides anymore, entries are really gone.
    try { delete localStorage.dragonPromptHistClearedAt; } catch (eDC) {}
    try { if (window.dragonSessionClear) window.dragonSessionClear(); } catch (eC) {}
    ;function _purgeBlobs() {
      try { if (kvReady() && window.root.kv.dragonGenHistFull) window.root.kv.dragonGenHistFull.clear().catch(function () {}); } catch (e) {}
      for (var k in medMem) delete medMem[k];
      histDB().then(function (db) { if (!db) return; try { db.transaction("med", "readwrite").objectStore("med").clear(); } catch (e) {} });
    }
    ;function _restore() {
      histArr = _snap.arr; histFullMem = _snap.fullMem; histFullIds = _snap.fullIds;
      try { histFullSizes = _snap.fullSizes || {}; histSizeSave(); } catch (eRS) {}
      persistHist();
      try { localStorage.dragonGenHistFullIds = _snap.lsFull || "[]"; } catch (e) {}
      if (window.dragonGetSessionHistory) {
        var live = window.dragonGetSessionHistory();
        live.length = 0;
        for (var i = 0; i < _snap.session.length; i++) live.push(_snap.session[i]);
      }
      if (window.dragonHistRerender) window.dragonHistRerender();
      if (window.dragonToast) window.dragonToast("\u21A9\uFE0F prompts restored");
    }
    histArr = []; histFullMem = {}; histFullIds = [];
    try { localStorage.dragonGenHist = JSON.stringify(histArr); } catch (e) {}
    try { localStorage.dragonGenHistFullIds = "[]"; } catch (e) {}
    try { histFullSizes = {}; histSizeSave(); } catch (eSZ) {}
    try { histMarkDone(_snap.fullIds); } catch (eMD) {}
    if (kvReady()) window.root.kv.dragonGenHist.set("h", histArr).catch(function () {});
    try { if (window.dragonHistRerender) window.dragonHistRerender(); } catch (eR) {}
    if (window.dragonToastAction) window.dragonToastAction("\uD83E\uDDF9 prompts deleted", "Undo", _restore, 8000, _purgeBlobs);
    else _purgeBlobs();
  };
  // Egon 29.10.2026 (A10) — single-delete WITH Undo: entries leave the lists immediately, but
  // the irreversible blob purge waits for the 8s toast window. Undo restores the rows (prompt +
  // thumbnail); only an un-undone delete purges the stored full/medium copies.
  window.dragonHistDeleteEntriesUndoable = function (entries) {
    entries = (entries || []).slice();
    if (!entries.length) return false;
    var snapArr = histArr.slice();
    var snapSession = [];
    try { snapSession = (window.dragonGetSessionHistory ? window.dragonGetSessionHistory().slice() : []); } catch (eSS) {}
    var ids = [];
    entries.forEach(function (en) {
      try {
        if (en._session && window.dragonGetSessionHistory) {
          var s = window.dragonGetSessionHistory();
          var ix = s.indexOf(en._e);
          if (ix !== -1) s.splice(ix, 1);
        } else {
          var jx = histArr.indexOf(en);
          if (jx !== -1) histArr.splice(jx, 1);
        }
        if (en.id) ids.push(String(en.id));
      } catch (e) {}
    });
    try { persistHist(); } catch (eP) {}
    try { if (window.dragonHistRerender) window.dragonHistRerender(); } catch (eR2) {}
    var done = false;
    var purge = function () {
      if (done) return; done = true;
      try { if (ids.length) histPurgeBlobs(ids); } catch (e1) {}
    };
    var timer = setTimeout(purge, 8000);
    var undo = function () {
      if (done) return; done = true;
      try { clearTimeout(timer); } catch (eC2) {}
      histArr = snapArr;
      try {
        if (window.dragonGetSessionHistory) {
          var live = window.dragonGetSessionHistory();
          live.length = 0;
          for (var k = 0; k < snapSession.length; k++) live.push(snapSession[k]);
        }
      } catch (eS2) {}
      try { persistHist(); } catch (eP2) {}
      try { if (window.dragonHistRerender) window.dragonHistRerender(); } catch (eR3) {}
      try { if (window.dragonToast) window.dragonToast("\u21A9\uFE0F prompt restored"); } catch (eT) {}
    };
    if (window.dragonToastAction) window.dragonToastAction("\uD83D\uDDD1 prompt deleted", "Undo", undo, 8000, purge);
    else purge();
    return true;
  };
  // ---------- lost-entry recovery (orphaned fulls) ----------
  // The persist bug is fixed above, but entries created while it was live never reached histArr —
  // their full-size copies usually DID reach kv (dragonGenHistFull, keyed by entry id) because that
  // write carries a plain string. Once per boot this re-attaches those orphans as new history
  // entries (prompt unknown → "recovered image"; the original timestamp is parsed from the id).
  // Bounded (120), idempotent (processed ids are remembered), adds only, never deletes.
  ;function dragonHistRecoverLost() {
    try {
      try { if (window.dragonHistRecordOff && window.dragonHistRecordOff()) return "off"; } catch (eRO) {}
      var ids = [];
      try { ids = JSON.parse(localStorage.dragonGenHistFullIds || "[]"); if (!Array.isArray(ids)) ids = []; } catch (eI) { ids = []; }
      if (!ids.length || !kvReady() || !window.dragonHistAddImage) return "not-ready";
      var have = {};
      try { histArr.forEach(function (h) { if (h && h.id) have[String(h.id)] = true; }); } catch (eH) {}
      var done = {};
      try { (JSON.parse(localStorage.dragonGenHistRecovered || "[]") || []).forEach(function (x) { done[String(x)] = true; }); } catch (eD) {}
      var week = Date.now() - 7 * 86400000;
      var pending = [];
      for (var i = 0; i < ids.length; i++) {
        var id = String(ids[i] || "");
        if (!id || have[id] || done[id]) continue;
        var t = 0;
        try { var m = id.match(/^h(\d+)_/); if (m) t = Number(m[1]); } catch (eT) {}
        if (t < week) { done[id] = true; continue; }
        pending.push({ id: id, t: t });
      }
      try { localStorage.dragonGenHistRecovered = JSON.stringify(Object.keys(done).slice(-500)); } catch (eW) {}
      if (!pending.length) return "nothing";
      pending = pending.slice(-120);
      var got = 0;
      ;function mark(id) { try { done[String(id)] = true; localStorage.dragonGenHistRecovered = JSON.stringify(Object.keys(done).slice(-500)); } catch (e) {} }
      ;function step(i) {
        if (i >= pending.length) {
          if (got > 0) {
            try { if (window.dragonHistRerender) window.dragonHistRerender(); } catch (eR) {}
            toast("recovered " + got + " image" + (got === 1 ? "" : "s") + " from this browser");
          }
          return;
        }
        var cur = pending[i];
        try {
          window.root.kv.dragonGenHistFull.get(cur.id).then(function (v) {
            try { if (v && window.dragonHistAddImage) { window.dragonHistAddImage({ dataUrl: v, prompt: "recovered image", t: cur.t }); got++; } } catch (eA) {}
            mark(cur.id);
            step(i + 1);
          }).catch(function () { mark(cur.id); step(i + 1); });
        } catch (eO) { mark(cur.id); step(i + 1); }
      }
      step(0);
      return "running";
    } catch (e) { return "error"; }
  }
  window.dragonHistRecoverLost = dragonHistRecoverLost;
  setTimeout(function () { try { dragonHistRecoverLost(); } catch (e) {} }, 8000);

  // ---------- capture start (no recurring interval; retries until outputArea exists) ----------
  ;function startCapture() {
    var oa = document.getElementById("outputAreaEl");
    if (!oa) { setTimeout(startCapture, 600); return; }
    try { setupCapture(); } catch (e) {}
  }
  startCapture();
})();
