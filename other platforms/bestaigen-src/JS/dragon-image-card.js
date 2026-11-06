// dragon-image-card.js — THE PER-IMAGE CONTROL OVERLAY, ISOLATED SINGLE-IMAGE REGENERATION,
// the plugin ADAPTER (with a canary + safe fallback) and the 🚩 REPORT FLOW.
// Classic script (not a module). Added 27.09.2026 (WP-UI005).
//
// WHAT IT OWNS
//  1. window.dragonImageOverlay(host, opts) — the round buttons painted ON the picture:
//       ℹ️ top-left · ⭐ top-right · 📮 bottom-left · 🔄 new seed bottom-right · ♻️ same seed above it.
//     Used for BOTH a live output tile (host = .t2i-image-ctn) and a history card
//     (host = .dragon-hist-shot). ⭐/📮/ℹ️ are the SAME functions the lightbox already had.
//  2. window.dragonTileRefresh(tile, mode) — regenerate ONE live tile in place (the verified
//     "clear src → set the new embed URL" reload; the tile's own iframe, no page-wide Generate).
//  3. window.dragonEmbedGenerate(opts) — an ISOLATED hidden embed iframe (our own, appended offscreen).
//     This is the only way to regenerate an OLD history image: the framework destroys every tile +
//     iframe on each generation, so an old history image has no live iframe of its own.
//  4. window.dragonHistoryRefresh(en, mode) — regenerate a history image; the result becomes a NEW
//     history entry (Egon 27.09.2026: "a refresh of a history card creates a new history entry").
//  5. window.dragonReportImage(item) — the report flow: the lightbox "..." menu row opens a report
//     window that shows the picture's OWN default public-gallery card (its real pixels + prompt +
//     uploader — NEVER a re-generation) with a reason picker; sending files the report to the server
//     inbox the owner reviews on the admin page (#closecodeadmin → 🚩 Reports).
//  6. window.dragonT2IRead(tile) + the canary — every plugin-specific read goes through ONE adapter
//     with multi-path resolution; if a generation finishes but no image can be read from any path,
//     the adapter flips to "mismatch": it tears our overlays down and leaves Perchance's native
//     boxes alone, once, with one warning and a console marker.
//
// The three plugin facts this file depends on (see Notebook):
//   (a) postMessage contract: {type:"readyForData",id} → reply {type:"originNotify",frameId}
//       and {type:"finished",id,dataUrl,seedUsed}. There is NO report command.
//   (b) the embed hash fields (saveChannel/saveTitle/saveDescription/prompt/seed/resolution/
//       guidanceScale/negativePrompt/requestId/iframeId/referenceImage).
//   (c) iframe.textToImagePluginOutput (= new String(dataUrl) with .dataUrl/.inputs/.seedUsed).
(function () {
  if (window.__dragonImageCardInstalled) return;
  window.__dragonImageCardInstalled = true;

  var SRV = "https://image-generation.perchance.org";
  var PLUGIN = SRV + "/embed#";

  ;function toast(m) { try { if (window.dragonToast) window.dragonToast(m); } catch (e) {} }
  ;function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  ;function logw(e) { try { console.warn("[dragonImageCard]", e); } catch (e2) {} }
  ;function num(v) { var s = String(v == null ? "" : v).replace(/\D/g, ""); return s === "" ? null : Number(s); }

  // ═══════════════════════════════════════ CSS ═══════════════════════════════════════════
  ;function ensureCss() {
    if (document.getElementById("dragonImageCardCss")) return;
    var s = document.createElement("style");
    s.id = "dragonImageCardCss";
    s.textContent =
      "#dragonMonitorPanel{width:100%;box-sizing:border-box;display:block;background:transparent;border:0;margin:0;padding:0;}" +
      ".dragon-seedbadge{position:absolute;top:6px;left:50%;transform:translateX(-50%);z-index:9;pointer-events:none;font:700 .68rem ui-monospace,Menlo,Consolas,monospace;color:#ffe9a8;background:rgba(10,10,14,.80);border:1px solid rgba(255,215,106,.55);border-radius:999px;padding:.1rem .55rem;white-space:nowrap;}" +
      "@keyframes dragonImgSpin{to{transform:rotate(360deg)}}" +
      ".dragon-imgov{position:absolute;inset:0;z-index:7;pointer-events:none;}" +
      ".dragon-imgov-btn{position:absolute;pointer-events:auto;width:2.15rem;height:2.15rem;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;border:1px solid rgba(255,255,255,.22);background:rgba(12,12,18,.62);color:#fff;font-size:.98rem;line-height:1;padding:0;cursor:pointer;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);box-shadow:0 2px 8px rgba(0,0,0,.45);}" +
      ".dragon-imgov-btn:hover{background:rgba(40,40,56,.88);}" +
      ".dragon-imgov-btn:disabled{opacity:.42;cursor:not-allowed;}" +
      ".dragon-imgov-btn.is-tl{top:6px;left:6px;}" +
      ".dragon-imgov-btn.is-tr{top:6px;right:6px;}" +
      ".dragon-imgov-btn.is-bl{bottom:6px;left:6px;}" +
      ".dragon-imgov-btn.is-br{bottom:6px;right:6px;}" +
      ".dragon-imgov-btn.is-br2{bottom:calc(6px + 2.15rem + 6px);right:6px;}" +
      ".dragon-imgov-btn.is-new{background:rgba(30,80,180,.74);}" +
      ".dragon-imgov-btn.is-same{background:rgba(180,40,40,.74);}" +
      ".dragon-imgov-btn.is-star.is-on{border-color:#ffd76a;box-shadow:0 0 9px rgba(255,215,106,.65);}" +
      ".dragon-imgov-btn.is-push.is-ok{border-color:#3ddc84;background:rgba(20,90,50,.85);}" +
      ".dragon-imgov-busy{position:absolute;inset:0;z-index:8;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.45rem;background:transparent;border-radius:inherit;pointer-events:none;}" +
      ".dragon-imgov-ring{width:36px;height:36px;border-radius:50%;border:4px solid rgba(255,255,255,.18);border-top-color:#4ade80;animation:dragonImgSpin 900ms linear infinite;}" +
      ".dragon-imgov-lbl{font:800 .74rem system-ui,sans-serif;color:#dbf7e4;text-shadow:0 1px 3px #000;}" +
      "@media (max-width:560px){.dragon-imgov-btn{width:1.85rem;height:1.85rem;font-size:.86rem;}.dragon-imgov-btn.is-br2{bottom:calc(6px + 1.85rem + 5px);}}" +
      ".dragon-report-embed{width:100%;height:100%;border:0;background:transparent;display:block;}" +
      ".dragon-report-note::placeholder{color:#8a8a9a;opacity:1;}" +
      "#outputAreaEl{justify-content:center !important;}" +
      "html[data-dragon-cout=\"small\"] #outputAreaEl .t2i-image-ctn{flex:0 0 auto !important;width:180px !important;max-width:180px !important;}" +
      "html[data-dragon-cout=\"small\"] #outputAreaEl .t2i-image-ctn iframe{width:100% !important;}" +
      "html[data-dragon-cout=\"small\"] #outputAreaEl .t2i-under-each-image-ctn{display:none !important;}" +
      "html[data-dragon-cout=\"small\"] #outputAreaEl .dragon-img-actions{display:none !important;}" +
      "html[data-dragon-view=\"modern\"] #outputAreaEl .t2i-under-each-image-ctn{display:none !important;}" +
      "html[data-dragon-view=\"modern\"] #outputAreaEl .t2i-image-ctn{flex:0 0 auto !important;width:var(--dragon-prod-tile,450px) !important;max-width:100% !important;margin:0 !important;overflow:hidden !important;}" +
      "html[data-dragon-view=\"modern\"] #outputAreaEl .t2i-image-ctn iframe{width:100% !important;display:block !important;}" +
      "html[data-dragon-view=\"modern\"] #outputAreaEl .dragon-img-actions{display:none !important;}" +
      "html[data-dragon-cout=\"display\"] #outputAreaEl .t2i-image-ctn{flex:0 0 auto !important;width:var(--dragon-prod-tile,450px) !important;max-width:100% !important;}" +
      "html[data-dragon-cout=\"display\"] #outputAreaEl .t2i-image-ctn iframe{width:100% !important;}" +
      "html[data-dragon-view=\"default\"] #dragonProdRow{display:none !important;}" +
      "#dragonProdRow{width:100%;box-sizing:border-box;display:flex;flex-wrap:wrap;gap:.7rem;justify-content:center;align-items:flex-start;margin:.6rem auto;}" +
      "#dragonProdRow:empty{display:none;}" +
      ".dragon-prod-card{position:relative;display:flex;flex-direction:column;width:var(--dragon-prod-tile,450px);max-width:100%;border:1px solid #33333d;border-radius:10px;overflow:hidden;background:transparent;}" +
      ".dragon-prod-shot{position:relative;display:block;overflow:hidden;background:#0d0d11;}" +
      ".dragon-prod-shot img{width:100%;height:auto;object-fit:contain;display:block;cursor:zoom-in;background:#0d0d11;}" +
      ".dragon-prod-acts{display:flex;flex-wrap:wrap;justify-content:center;gap:.28rem;padding:.32rem .4rem .42rem;background:transparent;}" +
      ".dragon-prod-acts button{flex:0 0 auto;width:2.15rem;height:2.15rem;min-width:0;padding:0;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:.98rem;font-weight:700;line-height:1;cursor:pointer;white-space:nowrap;border:1px solid #6a6a78;background:linear-gradient(145deg,#24242d,#131318);color:#ccc;}" +
      ".dragon-prod-acts button:hover{border-color:#9a9aa8;color:#fff;}" +
      ".dragon-prod-acts button.dragon-prod-del{border-color:#c81e2e;background:linear-gradient(145deg,#3a1418,#170708);color:#ff9aa3;}" +
      "#dragonProductionBody .dragon-prod-acts{display:none !important;}" +
      "html[data-dragon-view=\"custom\"] #dragonProductionBody .dragon-prod-acts.dragon-keep,html[data-dragon-view=\"custom\"] #dragonProcessBody .dragon-prod-acts.dragon-keep{display:flex !important;}" +
      "@media (max-width:560px){.dragon-prod-acts button{width:1.85rem;height:1.85rem;font-size:.86rem;}}" +
      "#dragonProcessPanel{width:100%;max-width:1000px;margin:.5rem auto 0;box-sizing:border-box;}" +
      "#dragonProcessHead{width:100%;box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:.45rem;flex-wrap:wrap;min-height:30px;line-height:1;margin:0;font-size:.85rem;font-weight:bold;padding:.35rem .4rem;border-radius:8px;cursor:pointer;border:1px solid #6d5aa8;background:linear-gradient(160deg,#1d1530,#35265a);color:#e8e1ff;}" +
      "#dragonProcessBody{width:100%;box-sizing:border-box;margin:.4rem auto 0;padding:.5rem .55rem;border:1px solid rgba(155,107,255,.28);border-radius:14px;background:linear-gradient(180deg,#14141b,#0d0d12);}" +
      "#dragonProcessBody[hidden]{display:none !important;}" +
      "#dragonProcessPanel[hidden]{display:none !important;}" +
      "#dragonProductionPanel{width:100%;max-width:1000px;margin:0 auto;box-sizing:border-box;}" +
      "#dragonProductionPanel[hidden]{display:none !important;}" +
      "#dragonProductionHead{width:100%;box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:.45rem;flex-wrap:wrap;min-height:30px;line-height:1;margin:0;font-size:.85rem;font-weight:bold;padding:.35rem .4rem;border-radius:8px;cursor:pointer;border:1px solid #3d8a5f;background:linear-gradient(160deg,#0f2b1c,#1e5a38);color:#dfffe9;}" +
      "#dragonProductionBody{width:100%;box-sizing:border-box;margin:0 auto;padding:.5rem .55rem;border:1px solid rgba(61,220,132,.30);border-radius:14px;background:linear-gradient(180deg,#121a15,#0c100d);}" +
      "#dragonProductionBody[hidden]{display:none !important;}" +
      "#dragonProductionBody #dragonProdRow{margin:0 !important;}" +
      "#dragonProductionEmpty{text-align:center;color:#8a8a9a;font-size:.82rem;padding:1.1rem .5rem;}" +
      "html #mainColumnEl85394739 .dragon-control-panel{margin-bottom:0 !important;}" +
      "html #mainColumnEl85394739 .dragon-control-body{margin-top:0 !important;margin-bottom:0 !important;}" +
      "html #mainColumnEl85394739 #dragonHistoryPanel{margin-top:0 !important;margin-bottom:0 !important;}" +
      "html #mainColumnEl85394739 #dragonHistoryPanel .dragon-history-body{margin-top:0 !important;margin-bottom:0 !important;}" +
      "html #mainColumnEl85394739 #dragonArtPanel{margin-top:0 !important;margin-bottom:0 !important;}" +
      "html #mainColumnEl85394739 #dragonArtPanelHead{margin-bottom:0 !important;}" +
      "html #mainColumnEl85394739 .dragon-art-body{margin-top:0 !important;margin-bottom:0 !important;}" +
      "html #mainColumnEl85394739 .dragon-gen-row{margin-top:0 !important;margin-bottom:0 !important;}" +
      "html #dragonProcessPanel{margin-top:0 !important;}" +
      "html #dragonProcessBody{margin-top:0 !important;}" +
      "html #dragonImageHistHead{margin-top:0 !important;margin-bottom:0 !important;}" +
      ".dragon-proc-mini{height:34px !important;min-height:34px !important;max-height:34px !important;box-sizing:border-box !important;width:100% !important;font-family:inherit !important;font-size:.72rem !important;font-weight:700 !important;letter-spacing:.01em !important;line-height:32px !important;padding:0 .55rem !important;border-radius:9px !important;margin:0 !important;text-shadow:none !important;white-space:nowrap !important;overflow:hidden !important;text-overflow:ellipsis !important;text-align:center !important;color:#ffffff !important;border:1px solid #9b6bff !important;background:linear-gradient(180deg,#2a1a4a,#1a102e) !important;box-shadow:none !important;}" +
      "#generateButtonEl{display:none !important;}";
    document.head.appendChild(s);
  }

  // ═══════════════════════════ THE PLUGIN ADAPTER + CANARY ═══════════════════════════
  // ONE place that knows how to read a generated image out of a tile, with several paths,
  // so a plugin change cannot silently break every button.
  window.__dragonT2IOk = true;
  window.dragonT2IRead = function (tile) {
    if (!tile) return null;
    try {
      var f = tile.querySelector("iframe");
      var o = f && f.textToImagePluginOutput;
      if (o && o.dataUrl) return { url: o.dataUrl, inputs: o.inputs || {}, via: "output" };
    } catch (e) {}
    try {
      var im = tile.querySelector("img.dragon-t2i-img, img");
      if (im && im.src) return { url: im.src, inputs: {}, via: "img" };
    } catch (e) {}
    try {
      var cv = tile.querySelector("canvas");
      if (cv && cv.toDataURL) { var u = cv.toDataURL("image/png"); if (u) return { url: u, inputs: {}, via: "canvas" }; }
    } catch (e) {}
    try {
      var bg = getComputedStyle(tile).backgroundImage || "";
      var m = /url\(["']?(.+?)["']?\)/.exec(bg);
      if (m && m[1]) return { url: m[1], inputs: {}, via: "bg" };
    } catch (e) {}
    return null;
  };
  // The canary: called when a generation FINISHED (the plugin said so) but no read path produced
  // an image. We then tear our overlay layer down and leave Perchance's native boxes in charge.
  window.dragonT2IMismatch = function (why) {
    if (window.__dragonT2IMismatch) return;
    window.__dragonT2IMismatch = true;
    window.__dragonT2IOk = false;
    try { console.warn("[dragonImageCard] t2i adapter mismatch — falling back to the native boxes:", why); } catch (e) {}
    try { var ovs = document.querySelectorAll(".dragon-imgov"); for (var i = 0; i < ovs.length; i++) ovs[i].remove(); } catch (e) {}
    try { document.documentElement.setAttribute("data-dragon-t2i", "native"); } catch (e) {}
    toast("\u26A0\uFE0F Image controls fell back to the standard boxes (the image plugin changed)");
  };

  // ═════════════════════════════ ISOLATED EMBED GENERATION ═════════════════════════════
  // Our OWN hidden embed iframe. Exactly the message contract the plugin uses, so nothing about
  // the generator's output area / numImages / Generate button is touched.
  var _embedHost = null;
  ;function embedHost() {
    if (_embedHost && _embedHost.isConnected) return _embedHost;
    _embedHost = document.getElementById("dragonEmbedHost");
    if (!_embedHost) {
      _embedHost = document.createElement("div");
      _embedHost.id = "dragonEmbedHost";
      _embedHost.className = "dragon-keep";
      _embedHost.style.cssText = "position:fixed;left:-12000px;top:0;width:512px;height:768px;overflow:hidden;pointer-events:none;";
      (document.body || document.documentElement).appendChild(_embedHost);
    }
    return _embedHost;
  }
  ;function baseOptions() {
    var b = {};
    try { if (window.___getImageOptions746291937) b = window.___getImageOptions746291937() || {}; } catch (e) { b = {}; }
    return b;
  }
  // one-off hidden generation
  window.dragonEmbedGenerate = function (opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var base = baseOptions();
      var id = "id" + Math.random().toString().replace(".", "");
      var data = {
        saveChannel: window.generatorName,
        saveTitle: base.saveTitle != null ? base.saveTitle : "",
        saveDescription: base.saveDescription != null ? base.saveDescription : "",
        prompt: String(opts.prompt || ""),
        seed: (num(opts.seed) != null ? num(opts.seed) : num(base.seed)),
        resolution: opts.resolution || base.resolution,
        guidanceScale: opts.guidanceScale != null ? opts.guidanceScale : base.guidanceScale,
        defaultGuidanceScale: base.defaultGuidanceScale,
        negativePrompt: opts.negativePrompt != null ? String(opts.negativePrompt) : (base.negativePrompt || ""),
        requestId: Math.random().toString(),
        iframeId: id,
        referenceImage: null
      };
      if (data.seed == null) delete data.seed;
      if (data.resolution == null) delete data.resolution;

      var f = document.createElement("iframe");
      f.className = "dragon-keep dragon-report-embed";
      f.setAttribute("data-dragon-embed", "1");
      f.style.cssText = "border:0;background:transparent;width:100%;height:100%;display:block;";
      f.src = "about:blank";
      var host = opts.container || embedHost();
      host.appendChild(f);

      var finished = false;
      ;function cleanup() {
        try { window.removeEventListener("message", onMsg); } catch (e) {}
        try { clearTimeout(timer); } catch (e) {}
      }
      ;function finish(res) {
        if (finished) return; finished = true;
        cleanup();
        if (!opts.keepFrame) { try { f.remove(); } catch (e) {} }
        if (res && res.dataUrl && window.dragonMarkFreshImage) { try { window.dragonMarkFreshImage(res.dataUrl); } catch (e) {} }
        resolve(res);
      }
      ;function onMsg(ev) {
        try {
          if (ev.origin !== SRV) return;
          var d = ev.data;
          if (!d || typeof d !== "object" || d.id !== id) return;
          if (d.type === "readyForData") {
            try { f.contentWindow.postMessage({ type: "originNotify", frameId: id }, SRV); } catch (e) {}
          } else if (d.type === "finished") {
            var u = d.dataUrl || (d.data && d.data.dataUrl) || "";
            if (!u) { finish({ ok: false, error: "finished_without_image" }); return; }
            finish({ ok: true, dataUrl: u, seedUsed: d.seedUsed });
          }
        } catch (e) { logw(e); }
      }
      window.addEventListener("message", onMsg);
      var timer = setTimeout(function () { finish({ ok: false, error: "timeout" }); }, opts.timeoutMs || 150000);
      setTimeout(function () { try { f.src = PLUGIN + encodeURIComponent(JSON.stringify(data)); } catch (e) { finish({ ok: false, error: "url" }); } }, 60);
    });
  };

  // ═══════════════════════🔴🔄 LIVE TILE: REFRESH ONE PICTURE IN PLACE ═══════════════════════
  // Changing only the hash of an iframe src is a SAME-DOCUMENT navigation: the embed never re-runs.
  // Clearing src first forces a real reload; then we set the (new) URL. Verified live 27.09.2026.
  ;function parseHash(f) {
    var u = (f && f.src) || (f && f.dataset && f.dataset.src) || "";
    try { return JSON.parse(decodeURIComponent((u.split("#")[1] || ""))); } catch (e) { return null; }
  }
  ;function dragonAnyNormalPending(except) {
    try {
      var oa = document.getElementById("outputAreaEl");
      if (!oa) return false;
      var ts = oa.querySelectorAll(".t2i-image-ctn");
      for (var i = 0; i < ts.length; i++) {
        var t = ts[i];
        if (!t || !t.isConnected || t === except || t.__dragonRefreshing) continue;
        var f = null;
        try { f = t.querySelector("iframe"); } catch (eF) {}
        var o = null;
        try { o = f && f.textToImagePluginOutput; } catch (eO) {}
        if (!o || !o.dataUrl) return true;
      }
    } catch (e) {}
    return false;
  }
  window.dragonTileRefresh = function (tile, mode, silent, force) {
    return new Promise(function (resolve) {
      if (!tile) { resolve({ ok: false, error: "no_tile" }); return; }
      var f = null;
      try { f = tile.querySelector("iframe"); } catch (e) {}
      if (!f) { resolve({ ok: false, error: "no_iframe" }); return; }
      var obj = parseHash(f);
      if (!obj) { resolve({ ok: false, error: "no_hash" }); return; }
      var outBefore = null;
      try { outBefore = f.textToImagePluginOutput || null; } catch (eOB) {}
      var hasOut = false;
      try { hasOut = !!(outBefore && outBefore.dataUrl); } catch (eHO) {}
      var forceOn = (force === true) || (force && force.force === true);
      var before = null;
      try { var o0 = outBefore; before = o0 && o0.dataUrl ? window.dragonStarHash(o0.dataUrl) : null; } catch (e) {}
      var newSeed = (mode === "new") ? (Math.floor(Math.random() * 900000000) + 100000000) : null;
      if (mode !== "new") {
        var liveSeed = null;
        try {
          var oL = f.textToImagePluginOutput;
          if (oL) liveSeed = (oL.seedUsed != null ? oL.seedUsed : (oL.inputs && oL.inputs.seed != null ? oL.inputs.seed : null));
        } catch (eLS) {}
        if (liveSeed == null) liveSeed = num(obj.seed);
        if (liveSeed != null) { obj.seed = liveSeed; newSeed = null; }
      }
      obj.requestId = Math.random().toString();
      if (newSeed != null) obj.seed = newSeed;
      var oldCard = null, oldUrl = null, oldSeed = null, oldPrompt = "", oldNeg = "", oldGs = null, oldRes = "";
      try {
        var pcSnap = tile.__dragonCard;
        if (pcSnap && pcSnap.isConnected) {
          oldCard = pcSnap;
          var imSnap = pcSnap.querySelector(".dragon-prod-shot img");
          if (imSnap) oldUrl = imSnap.getAttribute("src") || imSnap.src || null;
          var oiSnap = pcSnap.__dragonInfo || {};
          oldSeed = oiSnap.seed; oldPrompt = oiSnap.prompt || ""; oldNeg = oiSnap.neg || ""; oldGs = oiSnap.gs; oldRes = oiSnap.res || "";
        }
      } catch (eSnap) {}
      var url = PLUGIN + encodeURIComponent(JSON.stringify(obj));
      try { if (window.dragonProcessToggle) window.dragonProcessToggle(true); } catch (eP) {}
      try { if (window.dragonProdForceShow) window.dragonProdForceShow(); } catch (ePF) {}
      var cardBusy = null;
      try {
        var pc0 = tile.__dragonCard;
        if (pc0 && pc0.isConnected) {
          var shot0 = pc0.querySelector(".dragon-prod-shot");
          if (shot0) cardBusy = overlayBusy(shot0, mode);
        }
        var cs0 = null;
        try { cs0 = getComputedStyle(tile).display; } catch (eC) {}
        if (cs0 === "none") { try { tile.style.removeProperty("display"); tile.style.display = ""; } catch (eU) {} }
      } catch (eV) {}
      var spin = silent ? null : overlayBusy(tile, mode);
      try { f.dataset.src = url; } catch (e) {}
      f.src = "";
      sleep(850).then(function () { try { f.src = url; } catch (e) {} });
      var waited = 0;
      (function poll() {
        if (waited > 95000) { done({ ok: false, error: "timeout" }); return; }
        var o = null;
        try { o = f.textToImagePluginOutput; } catch (e) {}
        var u = o && o.dataUrl;
        var h = u ? window.dragonStarHash(u) : null;
        if (u && o && (o !== outBefore || (h && h !== before))) { done({ ok: true, dataUrl: u, inputs: o.inputs || {} }); return; }
        waited += 500;
        setTimeout(poll, 500);
      })();
      ;function done(res) {
        try { delete tile.__dragonRefreshing; } catch (e) {}
        try { clearTimeout(tile.__dragonRefreshWatch); } catch (eW3) {}
        if (spin) { try { spin.remove(); } catch (e) {} }
        if (cardBusy) { try { cardBusy.remove(); } catch (e) {} }
        try {
          var seedShown = (mode === "new") ? newSeed : (liveSeed != null ? liveSeed : null);
          var srcCard = (oldCard && oldCard.isConnected) ? oldCard : null;
          if (!srcCard) { try { var pc2x = tile.__dragonCard; if (pc2x && pc2x.isConnected) srcCard = pc2x; } catch (eX) {} }
          if (srcCard) {
            try { tile.style.setProperty("display", "none", "important"); } catch (eH) {}
            try {
              var imOld = srcCard.querySelector(".dragon-prod-shot img");
              if (imOld && oldUrl && imOld.getAttribute("src") !== oldUrl) imOld.src = oldUrl;
              if (oldUrl) srcCard.__dragonInfo = { url: oldUrl, prompt: oldPrompt, neg: oldNeg, seed: oldSeed, gs: oldGs, res: oldRes };
              srcCard.__dragonTile = null;
              var shotOld = srcCard.querySelector(".dragon-prod-shot");
              if (shotOld && res.ok !== false) window.dragonSeedBadge(shotOld, oldSeed);
            } catch (eOK) {}
            if (res.ok) {
              var newCard = null;
              try { tile.__dragonCard = null; } catch (eU) {}
              try { newCard = buildProdCard(tile, srcCard); } catch (eB) { newCard = null; }
              if (!newCard || !newCard.querySelector) {
                newCard = null;
                try { tile.__dragonCard = srcCard; srcCard.__dragonTile = tile; } catch (eR) {}
              }
              try {
                var seedNew = (res.inputs && res.inputs.seed != null) ? res.inputs.seed : seedShown;
                if (newCard) { var shotNew = newCard.querySelector(".dragon-prod-shot"); if (shotNew) window.dragonSeedBadge(shotNew, seedNew); }
                else { var shotO2 = srcCard.querySelector(".dragon-prod-shot"); if (shotO2) window.dragonSeedBadge(shotO2, seedNew); }
              } catch (eSB) {}
            }
          } else if (res.ok) {
            try {
              var seedT = (res.inputs && res.inputs.seed != null) ? res.inputs.seed : seedShown;
              window.dragonSeedBadge(tile, seedT);
            } catch (eT) {}
          }
        } catch (eI) {}
        if (res.ok && !silent && window.dragonHistAddImage) {
          try { window.dragonHistAddImage({ dataUrl: res.dataUrl, inputs: res.inputs, tile: tile }); } catch (e) {}
        }
        if (!silent && !res.ok && res.error === "timeout") toast("\u26A0\uFE0F refresh timed out \u2014 try again");
        resolve(res);
      }
    });
  };

  // ═════════════════════ HISTORY CARD: REGENERATE AN OLD IMAGE (new entry) ═════════════════════
  window.dragonHistoryRefresh = function (en, mode) {
    en = en || {};
    var card = en.__card || null;
    var shotEl = card ? (card.querySelector(".dragon-hist-shot") || card) : null;
    var spin = card ? overlayBusy(shotEl || card, mode) : null;
    try { if (shotEl && en.seed != null && String(en.seed) !== "") window.dragonSeedBadge(shotEl, en.seed); } catch (eSB0) {}
    try { if (window.dragonProcessToggle) window.dragonProcessToggle(true); } catch (eP2) {}
    try { if (window.dragonProdForceShow) window.dragonProdForceShow(); } catch (ePF2) {}
    var procNote = null;
    try {
      var pb9 = document.getElementById("dragonProcessBody");
      if (pb9 && pb9.isConnected) {
        procNote = document.createElement("div");
        procNote.className = "dragon-keep";
        procNote.textContent = mode === "same" ? "\uD83D\uDD04 refreshing (same seed)\u2026" : "\uD83D\uDD04 new variation generating\u2026";
        procNote.style.cssText = "text-align:center;color:#dbf7e4;font-size:.8rem;font-weight:700;padding:.3rem;";
        pb9.insertBefore(procNote, pb9.firstChild);
      }
    } catch (eN) {}
    var seed = (mode === "same") ? num(en.seed) : (Math.floor(Math.random() * 900000000) + 100000000);
    return window.dragonEmbedGenerate({
      prompt: en.p,
      seed: seed,
      resolution: en.res,
      negativePrompt: en.neg,
      guidanceScale: en.gs
    }).then(function (res) {
      try { delete en.__refreshing; } catch (e) {}
      if (spin) { try { spin.remove(); } catch (e) {} }
      if (procNote) { try { procNote.remove(); } catch (e) {} }
      if (!res || !res.ok) {
        if (res && res.error === "timeout") toast("\u26A0\uFE0F refresh timed out \u2014 try again");
        else toast("\u26A0\uFE0F couldn't refresh this image");
        return res;
      }
      if (window.dragonHistAddImage) {
        var newSeed = (res.seedUsed != null ? res.seedUsed : seed);
        var hid = "";
        var payload = {
          t: Date.now() + 1,
          dataUrl: res.dataUrl,
          prompt: en.p,
          seed: newSeed,
          resolution: en.res,
          negativePrompt: en.neg,
          guidanceScale: en.gs
        };
        try { hid = window.dragonHistAddImage(payload); } catch (eA) { hid = ""; }
        try {
          var tries = 0;
          var iv = setInterval(function () {
            tries++;
            var done = false;
            try {
              var grid = document.querySelector("#dragonImageHistInline .dragon-hist-grid");
              if (grid && grid.__dragonCards && hid && grid.__dragonCards[String(hid)]) {
                var nc = grid.__dragonCards[String(hid)];
                var ns = nc.querySelector(".dragon-hist-shot");
                if (ns) window.dragonSeedBadge(ns, newSeed);
                done = true;
              } else if (grid && hid) {
                var cards = grid.querySelectorAll(".dragon-hist-card");
                for (var ci = 0; ci < cards.length; ci++) {
                  var ce = cards[ci].__dragonEn;
                  if (ce && String(ce.id || "") === String(hid)) {
                    var sh = cards[ci].querySelector(".dragon-hist-shot");
                    if (sh) window.dragonSeedBadge(sh, newSeed);
                    done = true;
                    break;
                  }
                }
              }
            } catch (eP) {}
            if (done || tries > 40) { try { clearInterval(iv); } catch (eC) {} }
          }, 500);
        } catch (ePoll) {}
      }
      toast(mode === "same" ? "\uD83D\uDD04 refreshed (same seed)" : "\uD83D\uDD04 new variation ready");
      return res;
    }).catch(function (e) { logw(e); try { delete en.__refreshing; } catch (e2) {} if (spin) spin.remove(); if (procNote) { try { procNote.remove(); } catch (e3) {} } return { ok: false, error: "fail" }; });
  };

  ;function overlayBusy(host, mode) {
    if (!host) return null;
    var el = document.createElement("div");
    el.className = "dragon-imgov-busy dragon-keep";
    var lbl = document.createElement("div");
    lbl.className = "dragon-imgov-lbl";
    lbl.textContent = (mode === "new" ? "\uD83D\uDD04 new variation\u2026" : "\uD83D\uDD04 refreshing\u2026");
    lbl.style.position = "absolute";
    lbl.style.left = "0";
    lbl.style.right = "0";
    lbl.style.bottom = "46%";
    lbl.style.textAlign = "center";
    lbl.style.zIndex = "9";
    lbl.style.pointerEvents = "none";
    el.append(lbl);
    try { if (getComputedStyle(host).position === "static") host.style.position = "relative"; } catch (e) {}
    host.appendChild(el);
    return el;
  }

  // ═════════════════════ SEED BADGE: 1-minute seed pill, top-center ═════════════════════
  // Shown on BOTH the source picture and the new picture of a refresh. Re-calling it on the
  // same host restarts the minute. The badge is a plain node, so list reconciles (which only
  // MOVE nodes) keep it until the timer removes it.
  window.dragonSeedBadge = function (host, seed) {
    if (!host || seed == null || String(seed) === "") return null;
    try {
      var olds = host.querySelectorAll(".dragon-seedbadge");
      for (var i = 0; i < olds.length; i++) {
        if (olds[i].parentElement !== host) continue;
        try { clearTimeout(olds[i].__dragonT); } catch (e) {}
        try { olds[i].remove(); } catch (e2) {}
      }
      try { if (getComputedStyle(host).position === "static") host.style.position = "relative"; } catch (e3) {}
      var b = document.createElement("div");
      b.className = "dragon-seedbadge dragon-keep";
      b.textContent = "seed " + String(seed);
      host.appendChild(b);
      b.__dragonT = setTimeout(function () { try { b.remove(); } catch (e) {} }, 60000);
      return b;
    } catch (e) { return null; }
  };

  // ═════════════════════════════════ THE OVERLAY ═════════════════════════════════
  ;function mkBtn(emoji, title, cls, fn) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "dragon-imgov-btn dragon-keep " + cls;
    b.textContent = emoji;
    b.title = title;
    b.setAttribute("aria-label", title);
    b.addEventListener("click", function (e) {
      e.stopPropagation(); e.preventDefault();
      try { fn(b); } catch (err) { logw(err); }
    });
    // never let the tile's own click-to-zoom overlay steal the press
    b.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    return b;
  }

  ;function starIsOn(url, isFlagged) {
    try {
      var h = window.dragonStarHash(url);
      if (!h) return false;
      if (window.dragonHashSavedAnywhere) return !!window.dragonHashSavedAnywhere(h);
      return window.dragonStarHasHash ? window.dragonStarHasHash(h, window.dragonStarTargetFolder(isFlagged)) : false;
    } catch (e) { return false; }
  }
  ;function starPaint(btn, it) {
    if (!btn || !it || !it.url) { if (btn) btn.disabled = true; return; }
    btn.disabled = false;
    btn.classList.toggle("is-on", starIsOn(it.url, it.isFlagged));
    btn.title = starIsOn(it.url, it.isFlagged) ? "Saved To Likes \u2014 click to remove" : "Save To Likes";
  }
  ;function starToggle(btn, it) {
    if (!it || !it.url) { toast("\u2B50 wait for the image first"); return; }
    var h = window.dragonStarHash(it.url);
    var isFlagged = !!it.isFlagged;
    if (starIsOn(it.url, isFlagged)) {
      if (window.dragonUnstarHashEverywhere) window.dragonUnstarHashEverywhere(h, function () { starPaint(btn, it); });
      else if (window.dragonStarRemoveHash) { window.dragonStarRemoveHash(h, window.dragonStarTargetFolder(isFlagged)); starPaint(btn, it); }
      return;
    }
    if (window.dragonFlyToSave) { try { window.dragonFlyToSave(btn); } catch (e) {} }
    if (window.dragonSaveToFolder) {
      window.dragonSaveToFolder(it.url, it.prompt || "", function (ok) { starPaint(btn, it); }, isFlagged);
    } else toast("\u2B50 saving is not available right now");
  }
  ;function infoShow(it) {
    if (!it || !it.url) { toast("\u2139\uFE0F wait for the image first"); return; }
    if (!window.dragonPromptInfo) { toast("\u2139\uFE0F prompt info is not available right now"); return; }
    window.dragonPromptInfo({ prompt: it.prompt || "", neg: it.neg || "", seed: it.seed != null ? it.seed : null, gs: it.gs != null ? it.gs : null, desc: (it.desc || it.description || ""), title: (it.title || it.stitle || ""), date: (it.date || it.sdate || "") });
  }
  ;function pushSend(btn, it) {
    if (!it || !it.url) { toast("\uD83D\uDCEE wait for the image first"); return; }
    if (btn && btn.__dragonPushOk !== true) { toast("\uD83D\uDCEE this image can't be sent \u2014 generate a fresh one"); return; }
    // Egon 12.10.2026 — the seed travels too: batch siblings share the prompt, and the
    // full-original lookup is seed-scoped (else a sibling gets uploaded instead of this one).
    if (window.dragonSendToPublicGallery) window.dragonSendToPublicGallery(it.url, "BestAiGen", it.prompt || "", btn, undefined, it.seed);
    else toast("\uD83D\uDCEE sending is not available right now");
  }

  // host  = the element the buttons are painted over (its own box = the picture's box)
  // opts.getInfo()  -> { url, prompt, neg, seed, gs, res, isFlagged, tile, entry }
  // opts.onRefresh(mode) -> optional override; default: live tile reload / history embed
  // opts.labels -> optional { star, push, info } tooltips
  window.dragonImageOverlay = function (host, opts) {
    if (!host || !opts) return null;
    if (host.__dragonImgOv && host.__dragonImgOv.isConnected) return host.__dragonImgOv;
    ensureCss();
    var get = opts.getInfo || function () { return null; };
    var ov = document.createElement("div");
    ov.className = "dragon-imgov dragon-keep";

    var infoB = mkBtn("\u2139\uFE0F", "Prompt Info \u2014 the prompt, negative prompt, seed and guidance scale of this picture", "is-tl", function () { infoShow(get()); });
    var starB = mkBtn("\u2B50", "Save To Likes", "is-tr is-star", function (b) { starToggle(b, get()); });
    var pushB = mkBtn("\uD83D\uDCEE", "Send to Public Gallery", "is-bl is-push", function (b) { pushSend(b, get()); });
    var newB = mkBtn("\uD83D\uDD04", "Refresh this image with a NEW SEED", "is-br is-new", function () { doRefresh("new"); });
    var sameB = mkBtn("\u267B\uFE0F", "Refresh with SAME SEED", "is-br2 is-same", function () { doRefresh("same"); });
    ov.append(infoB, starB, pushB, newB, sameB);

    ;function doRefresh(mode) {
      var run = null;
      if (opts.onRefresh) run = function () { opts.onRefresh(mode); };
      else if (opts.tile) run = function () { window.dragonTileRefresh(opts.tile, mode); };
      else if (opts.entry) run = function () { window.dragonHistoryRefresh(opts.entry, mode); };
      if (!run) return;
      try {
        var r = run();
        if (r && r.then) r.then(function (res) { if (res && !res.ok && res.error === "busy") toast("🔄 still generating — it will accept a new refresh when done"); });
      } catch (e) {}
    }

    // The ⭐/📮 buttons reflect real state, but we never hash 200 pictures at once: the state is
    // resolved the first time the card is looked at (pointer/keyboard focus) and after a change.
    var primed = false;
    ;function prime() {
      var it = get();
      starPaint(starB, it);
      if (it && it.url && window.dragonRefreshPushState) { try { window.dragonRefreshPushState(pushB, it.url, it.prompt || "", it.seed); } catch (e) {} }
      primed = true;
    }
    host.addEventListener("pointerenter", function () { if (!primed) prime(); });
    host.addEventListener("focusin", function () { if (!primed) prime(); });
    ov.__prime = prime;

    try { if (getComputedStyle(host).position === "static") host.style.position = "relative"; } catch (e) {}
    host.appendChild(ov);
    host.__dragonImgOv = ov;

    // For a LIVE tile the picture is the iframe (the tile also carries the action row below), so the
    // overlay must sit exactly over the iframe's box — recomputed a few times while it settles.
    if (opts.tile) {
      var fit = function () {
        try {
          var tr = host.getBoundingClientRect();
          var f = host.querySelector("iframe");
          if (!f) return;
          var fr = f.getBoundingClientRect();
          if (fr.width < 20 || fr.height < 20) return;
          ov.style.left = (fr.left - tr.left) + "px";
          ov.style.top = (fr.top - tr.top) + "px";
          ov.style.width = fr.width + "px";
          ov.style.height = fr.height + "px";
          ov.style.inset = "auto";
        } catch (e) {}
      };
      fit();
      var n = 0;
      var iv = setInterval(function () { fit(); if (++n > 12) clearInterval(iv); }, 400);
      try { if (!window.__dragonImgOvFit) { window.__dragonImgOvFit = true; window.addEventListener("resize", function () { var a = document.querySelectorAll(".dragon-imgov"); for (var i = 0; i < a.length; i++) { var h = a[i].parentElement; if (h) { try { h.__dragonImgOv.__fit && h.__dragonImgOv.__fit(); } catch (e) {} } } }); } } catch (e) {}
      ov.__fit = fit;
    }
    // first eight cards also resolve their state eagerly so the top of the list looks right
    if (opts.eager) setTimeout(prime, 120);
    return ov;
  };

  // ═══════════════════════⏱️ AUTO-ATTACH ON OUTPUT TILES ═══════════════════════
  ;function attachTile(tile) {
    if (!tile || tile.__dragonOvAttached) return;
    if (window.__dragonT2IOk === false) return;
    try { if (!(tile.classList && tile.classList.contains("dragon-tester-ctn")) && window.dragonTileOverlayOn && !window.dragonTileOverlayOn()) return; } catch (e) {}
    var o = window.dragonT2IRead(tile);
    if (!o || !o.url) return;
    tile.__dragonOvAttached = true;
    window.dragonImageOverlay(tile, {
      tile: tile,
      eager: true,
      getInfo: function () {
        var r = window.dragonT2IRead(tile);
        if (!r) return null;
        var ins = r.inputs || {};
        return {
          url: r.url,
          prompt: ins.prompt != null ? String(ins.prompt) : "",
          neg: ins.negativePrompt != null ? String(ins.negativePrompt) : "",
          seed: ins.seed,
          gs: ins.guidanceScale,
          res: ins.resolution || "",
          isFlagged: false,
          tile: tile
        };
      }
    });
  }
  ;function testerTileReady(tile) {
    var n = 0;
    var iv = setInterval(function () {
      var ok = false;
      try {
        if (tile && tile.isConnected === false) { clearInterval(iv); return; }
        var r = window.dragonT2IRead(tile);
        if (r && r.url) { try { attachTile(tile); } catch (eA) {} ok = !!(tile && tile.__dragonOvAttached); }
      } catch (e2) {}
      if (ok || ++n > 360) clearInterval(iv);
    }, 2000);
  }
  window.dragonTesterTileReady = testerTileReady;
  ;function scanTiles() {
    var oa = document.getElementById("outputAreaEl");
    if (!oa) return;
    var cs = oa.querySelectorAll(".t2i-image-ctn");
    for (var i = 0; i < cs.length; i++) attachTile(cs[i]);
  }
  ;function installTileWatch() {
    if (window.__dragonOvWatch) { scanTiles(); return; }
    window.__dragonOvWatch = true;
    var bind = function () {
      var oa = document.getElementById("outputAreaEl");
      if (!oa || oa.__dragonOvObs) return;
      oa.__dragonOvObs = true;
      try { new MutationObserver(function () { setTimeout(scanTiles, 40); }).observe(oa, { childList: true, subtree: true }); } catch (e) {}
    };
    bind();
    setInterval(function () { if (document.hidden) return; bind(); }, 3000);
    // a tile that is still generating has no readable image yet: retry a bounded number of times
    var tries = 0;
    var iv = setInterval(function () {
      scanTiles();
      if (++tries > 60) clearInterval(iv);
    }, 1500);
  }

  // ═════════════════════════════════ REPORT FLOW ═════════════════════════════════
  // The report window shows the picture's OWN default public-gallery card — its real pixels, its
  // prompt, its uploader — and files the report (with a reason) to the server inbox the owner
  // reviews on the admin page. There is deliberately NO re-generation here: regenerating a gallery
  // picture is slow, burns a generation, and can show a DIFFERENT picture than the reported one.
  var DRAGON_REPORT_REASONS = [
    [1, "Sexual content where it does not belong"],
    [2, "\uD83E\uDDD2 Child-safety concern"],
    [3, "\uD83D\uDDD1 Spam / advertisement"],
    [4, "\uD83D\uDD13 Private / stolen picture"],
    [5, "\uD83E\uDDE9 Broken image"],
    [6, "\u2710 Other"]
  ];
  function dragonReportReasonLabel(r) {
    for (var i = 0; i < DRAGON_REPORT_REASONS.length; i++) if (DRAGON_REPORT_REASONS[i][0] === r) return DRAGON_REPORT_REASONS[i][1];
    return "";
  }
  window.dragonReportReasonLabel = dragonReportReasonLabel;
  function dragonReportedIds() { try { return JSON.parse(localStorage.getItem("dragonReportedIds") || "[]"); } catch (e) { return []; } }
  function dragonReportedMark(id) {
    try {
      var l = dragonReportedIds();
      if (l.indexOf(id) === -1) { l.push(id); if (l.length > 200) l = l.slice(l.length - 200); }
      localStorage.setItem("dragonReportedIds", JSON.stringify(l));
    } catch (e) {}
  }
  // The ORIGINAL default-gallery card (Egon 02.10.2026): a reported picture also stands, untouched,
  // in the default public gallery (image-generation.perchance.org/gallery) — not just its pixels but its
  // real card (hover buttons, votes, user tag, title). The gallery page is server-rendered, so the card
  // is fetched as HTML through the CORS-free proxy, picked out by data-image-id and transplanted here
  // with the gallery's own CSS (scoped to .dragon-origal) and icon sprites. Gallery-only behaviours
  // (voting, hiding, blocking) are stripped: this card IDENTIFIES the picture; our own buttons act on
  // it. Resolves null when the picture is not on the gallery's first page — callers keep their static
  // card then. Flagged cards are always shown (moderation must see what was reported).
  var dragonOrigHtmlCache = {};
  function dragonOrigScopeCss(css, scope) {
    function scopeSel(s) {
      return String(s).split(",").map(function (p) {
        p = p.trim();
        if (!p || p.charAt(0) === "@") return p;
        if (/^(html|body|:root)\b/.test(p)) return scope;
        return scope + " " + p;
      }).join(", ");
    }
    var out = "", i = 0, n = css.length;
    while (i < n) {
      var brace = css.indexOf("{", i);
      if (brace === -1) break;
      var at = css.indexOf("@media", i);
      if (at !== -1 && at < brace) {
        var open = css.indexOf("{", at), depth = 1, k = open + 1;
        while (k < n && depth > 0) { if (css[k] === "{") depth++; else if (css[k] === "}") depth--; k++; }
        var innerOut = "", segs = css.slice(open + 1, k - 1).split("}");
        for (var q = 0; q < segs.length; q++) {
          var bi = segs[q].indexOf("{");
          if (bi === -1) continue;
          innerOut += scopeSel(segs[q].slice(0, bi)) + "{" + segs[q].slice(bi + 1) + "}";
        }
        out += css.slice(at, open + 1) + innerOut + "}";
        i = k;
      } else {
        var d2 = 1, k2 = brace + 1;
        while (k2 < n && d2 > 0) { if (css[k2] === "{") d2++; else if (css[k2] === "}") d2--; k2++; }
        out += scopeSel(css.slice(i, brace)) + css.slice(brace, k2);
        i = k2;
      }
    }
    return out;
  }
  window.dragonOriginalGalleryCard = function (opts) {
    opts = opts || {};
    var imageId = String(opts.imageId || "");
    var channel = String(opts.channel || window.generatorName || "bestaigen");
    var sub = String(opts.sub || "public");
    if (!imageId) return Promise.resolve(null);
    function finish(html) {
      var doc = null;
      try { doc = new DOMParser().parseFromString(html, "text/html"); } catch (e) { return null; }
      if (!doc) return null;
      dragonOrigEnsureAssets(doc);
      var found = null;
      try {
        var all = doc.querySelectorAll(".imageCtn");
        for (var i = 0; i < all.length; i++) if (all[i].getAttribute("data-image-id") === imageId) { found = all[i]; break; }
      } catch (e4) { return null; }
      if (!found) return null;
      return window.dragonTransplantGalleryCard(found, { stripButtons: !!(opts && opts.stripButtons) });
    }
    function findIn(html) {
      try { return finish(html); } catch (e) { return null; }
    }
    function galUrl(sort, range, skip) {
      var u = "https://image-generation.perchance.org/gallery?channel=" + encodeURIComponent(channel) +
        "&subChannel=" + encodeURIComponent(sub) + "&sort=" + sort + "&timeRange=" + range + "&contentFilter=none" +
        "&userIsOver" + "18=1&userUnblurredAll=1&userUnblurredAllShocking=1&userUnblurredAllPg13Soft=1";
      if (skip > 0) u += "&imageElementsHtmlOnly=false&skip=" + skip;
      return u;
    }
    function getHtml(url) {
      try {
        if (typeof root !== "undefined" && root && typeof root.superFetch === "function")
          return Promise.resolve().then(function () { return root.superFetch(url); }).then(function (r) {
            if (!r) throw new Error("no response");
            return (typeof r.text === "function") ? r.text() : String(r);
          });
      } catch (e6) {}
      return fetch(url).then(function (r) { return r.text(); });
    }
    // Recent first, then recent pages 2-3 (skip=200/400 — Egon 02.10.2026: reported pictures can sit thousands of cards deep, so recent pages are walked until a hit or a short (exhausted) page, capped at skip 2200, then top/all-time
    // (reported pictures are often popular ones). Each page is cached separately for the session, and
    // simultaneous callers share one fetch per page (the admin window asks per reported picture).
    // Every in-flight entry resolves with the page HTML string — never undefined — so followers can
    // always parse it the same way.
    function attempt(sort, range, skip) {
      skip = skip || 0;
      var k2 = channel + "/" + sub + "/" + sort + "/s" + skip;
      function parse(html) {
        html = String(html || "");
        if (html.length < 1000) return { el: null, miss: true, exhausted: true };
        var f = findIn(html);
        if (f) return { el: f, miss: false };
        var n = html.split('<div class="imageCtn').length - 1;
        return { el: null, miss: true, exhausted: n < 100 };
      }
      var c2 = dragonOrigHtmlCache[k2];
      if (c2 && Date.now() - c2.at < 15 * 60 * 1000) return Promise.resolve(parse(c2.html));
      var p;
      if (dragonOrigInflight[k2]) p = dragonOrigInflight[k2];
      else {
        p = getHtml(galUrl(sort, range, skip)).then(function (html) {
          html = String(html || "");
          if (html.length > 1000) dragonOrigHtmlCache[k2] = { at: Date.now(), html: html };
          return html;
        }).catch(function () { return ""; });
        dragonOrigInflight[k2] = p;
        p.then(function () { if (dragonOrigInflight[k2] === p) delete dragonOrigInflight[k2]; },
              function () { if (dragonOrigInflight[k2] === p) delete dragonOrigInflight[k2]; });
      }
      return p.then(parse);
    }
    var SKIP_STEP = 200, SKIP_MAX = 2200;
    function chainRecent(skip) {
      return attempt("recent", "all-time", skip).then(function (r) {
        if (!r.miss) return r.el;
        if (r.exhausted || skip >= SKIP_MAX) {
          return attempt("top", "all-time", 0).then(function (rt) { return rt.el; });
        }
        try { if (opts && typeof opts.onPage === "function") opts.onPage(skip + SKIP_STEP); } catch (eP) {}
        return chainRecent(skip + SKIP_STEP);
      });
    }
    try {
      var pool = [];
      try {
        var oks = dragonOrigHtmlCache ? Object.keys(dragonOrigHtmlCache) : [];
        for (var oki = 0; oki < oks.length; oki++) {
          var ok = oks[oki];
          if (ok.indexOf(channel + "/" + sub + "/") !== 0) continue;
          var oh = dragonOrigHtmlCache[ok] && dragonOrigHtmlCache[ok].html;
          if (oh) pool.push(oh);
        }
      } catch (eOC) {}
      if (window.dragonGalFilterPages) {
        var pks = Object.keys(window.dragonGalFilterPages);
        for (var ppi = 0; ppi < pks.length; ppi++) {
          var pk = pks[ppi];
          if (pk.indexOf("channel=" + encodeURIComponent(channel)) === -1) continue;
          if (pk.indexOf("subChannel=" + encodeURIComponent(sub)) === -1 && pk.indexOf("subChannel=" + sub) === -1) continue;
          var ph = window.dragonGalFilterPages[pk] && window.dragonGalFilterPages[pk].html;
          if (ph) pool.push(ph);
        }
      }
      if (window.dragonGalLastPage && window.dragonGalLastPage.html) pool.push(window.dragonGalLastPage.html);
      for (var pqi = 0; pqi < pool.length; pqi++) {
        var phit = null;
        try { phit = findIn(String(pool[pqi])); } catch (ePQ) {}
        if (phit) return Promise.resolve(phit);
      }
    } catch (ePool) {}
    return chainRecent(0);
  };
  var dragonOrigInflight = {};
  // Fire-and-forget cache fill so a later Report opens instantly: called when the lightbox opens
  // (the "..." menu lives one tap away) and when the admin Reports window opens. Never throws.
  window.dragonOriginalGalleryWarm = function (channel, sub) {
    try {
      channel = String(channel || window.generatorName || "bestaigen");
      sub = String(sub || "public");
      var k = channel + "/" + sub + "/recent/s0";
      var c = dragonOrigHtmlCache[k];
      if ((c && Date.now() - c.at < 15 * 60 * 1000) || dragonOrigInflight[k]) return;
      var url = "https://image-generation.perchance.org/gallery?channel=" + encodeURIComponent(channel) +
        "&subChannel=" + encodeURIComponent(sub) + "&sort=recent&timeRange=all-time&contentFilter=none" +
        "&userIsOver" + "18=1&userUnblurredAll=1&userUnblurredAllShocking=1&userUnblurredAllPg13Soft=1";
      function got(html) {
        html = String(html || "");
        if (html.length > 1000) dragonOrigHtmlCache[k] = { at: Date.now(), html: html };
        if (dragonOrigInflight[k] === wp) delete dragonOrigInflight[k];
        return html;
      }
      function gotErr() { if (dragonOrigInflight[k] === wp) delete dragonOrigInflight[k]; return ""; }
      function go() {
        try {
          if (typeof root !== "undefined" && root && typeof root.superFetch === "function")
            return Promise.resolve().then(function () { return root.superFetch(url); }).then(function (r) {
              if (!r) throw new Error("no response");
              return (typeof r.text === "function") ? r.text() : String(r);
            });
        } catch (eW) {}
        return fetch(url).then(function (r) { return r.text(); });
      }
      var wp = null;
      dragonOrigInflight[k] = wp = go().then(got, gotErr);
    } catch (eW2) {}
  };
  function dragonOrigEnsureAssets(doc) {
    if (!document.getElementById("dragonOrigCardCss")) {
            try {
              var css = "", styles = doc.querySelectorAll("style");
              for (var s = 0; s < styles.length; s++) css += "\n" + styles[s].textContent;
              var st = document.createElement("style");
              st.id = "dragonOrigCardCss";
              st.textContent = dragonOrigScopeCss(css.replace(/\/\*[\s\S]*?\*\//g, ""), ".dragon-origal");
              document.head.appendChild(st);
            } catch (e2) {}
          }
          try {
            ["upvoteButtonSvg", "infoButtonSvg", "hideButtonSvg", "downloadButtonSvg", "blockButtonSvg"].forEach(function (id) {
              if (document.getElementById(id)) return;
              var src = doc.getElementById(id);
              if (src) document.body.appendChild(src.cloneNode(true));
            });
          } catch (e3) {}
  }
  window.dragonTransplantGalleryCard = function (found, opts) {
    var card = found.cloneNode(true);
    try {
      if (opts && opts.stripButtons) {
        var _keepTag = card.querySelector(".user-tag");
        var _keepCap = card.querySelector(".image-title-desc-ctn");
        var _sb = card.querySelectorAll(".imageButtonEl, .vote-ctn, .image-hover-ctn, .left-ctn");
        for (var _sbi = 0; _sbi < _sb.length; _sbi++) _sb[_sbi].remove();
        if (_keepCap) { _keepCap.style.visibility = ""; _keepCap.style.position = "static"; _keepCap.style.opacity = "1"; card.appendChild(_keepCap); }
        if (_keepTag) card.appendChild(_keepTag);
      }
    } catch (eSB) {} try { var _del = card.querySelectorAll(".deleteButtonEl"); for (var _di = 0; _di < _del.length; _di++) _del[_di].remove(); } catch (eDel) {}
          try {
            var acts = card.querySelectorAll("[onclick]");
            for (var a = 0; a < acts.length; a++) acts[a].removeAttribute("onclick");
            function dtoast(m) { try { if (window.dragonToast) window.dragonToast(m); } catch (eT) {} }
            function cardImg() { return card.querySelector(".imageWrapperInner img") || card.querySelector("img"); }
            function wireBtn(sel, fn) {
              var b = card.querySelector(sel);
              if (!b) return;
              b.addEventListener("click", function (ev) { ev.stopPropagation(); ev.preventDefault(); try { fn(b); } catch (eW) {} });
            }
            // The card's own buttons, rewired to working equivalents (the transplant carries no gallery
            // JS, so nothing here may stay dead): download opens the full picture, prompt info shows the
            // prompt, hide/show covers the picture like in the gallery, block hides this uploader on this
            // device. Gallery-wide voting lives in the public gallery — the arrows say so when pressed.
            wireBtn(".downloadButtonEl", function () {
              var im = cardImg();
              var u = im ? (im.currentSrc || im.src) : "";
              if (u) window.open(u, "_blank");
            });
            wireBtn(".promptInfoButtonEl", function () {
              var p = card.getAttribute("data-prompt") || "";
              if (p && typeof window.dragonPromptInfo === "function") window.dragonPromptInfo({ prompt: p });
              else if (p) dtoast(p.slice(0, 120));
            });
            wireBtn(".hideShowButtonEl", function () {
              if (card.getAttribute("data-show-hide-state") === "hidden") card.removeAttribute("data-show-hide-state");
              else card.setAttribute("data-show-hide-state", "hidden");
            });
            wireBtn(".blockUserButtonEl", function () {
              var uid = card.getAttribute("data-user-id") || "";
              if (uid && typeof window.dragonBlockedAdd === "function") {
                window.dragonBlockedAdd(uid);
                dtoast("user blocked on this device");
              }
            });
            ["voteUpButtonEl", "voteDownButtonEl", ".customButtonEl", ".customButton2El"].forEach(function (s) {
              wireBtn("." + s.replace(/^\./, ""), function () { dtoast("voting lives in the public gallery"); });
            });
            // Report windows show the picture unblurred like any normal picture (Egon 02.10.2026: the
            // reporter has already seen it, so no gate here): every gallery blur cover goes away and
            // the picture filter clears. The "show all" checkbox rows are gallery-wide and meaningless
            // on one card, so they go away too.
            ["n"+"sfwBlur", "pg13SoftBlur", "shockingBlur"].forEach(function (bc) {
              var ovs = card.querySelectorAll("." + bc);
              for (var o = ovs.length - 1; o >= 0; o--) { try { ovs[o].remove(); } catch (eR) {} }
            });
            try {
              var _cimgs = card.querySelectorAll("img");
              for (var _ci = 0; _ci < _cimgs.length; _ci++) _cimgs[_ci].style.filter = "";
            } catch (eCF) {}
            // The overlay buttons stand visible on the card (no hover hunt, touch included) — the same
            // sight the gallery gives on touch devices, where the vote column never hides.
            try {
              var _all = card.querySelectorAll("*");
              for (var _ai = 0; _ai < _all.length; _ai++) {
                var _ae = _all[_ai];
                if (_ae.tagName === "IMG") continue;
                try { if (_ae.closest(".imageWrapperInner")) continue; } catch (eC) {}
                var _p = "";
                try { _p = getComputedStyle(_ae).position; } catch (eP) {}
                if (_p === "absolute" || _p === "fixed") {
                  _ae.style.position = "static";
                  _ae.style.top = "auto"; _ae.style.left = "auto"; _ae.style.right = "auto"; _ae.style.bottom = "auto";
                  _ae.style.width = "auto"; _ae.style.height = "auto";
                }
                try { _ae.style.opacity = "1"; _ae.style.visibility = "visible"; } catch (eV) {}
              }
              try {
                var _hov2 = card.querySelector(".image-hover-ctn");
                if (_hov2) { _hov2.style.position = "static"; _hov2.style.width = "auto"; _hov2.style.height = "auto"; card.appendChild(_hov2); }
              } catch (eH) {}
            } catch (eOv) {}
            try { var _bds = card.querySelectorAll(".image-backdrop-shadow"); for (var _bi = 0; _bi < _bds.length; _bi++) _bds[_bi].style.display = "none"; } catch (eBd) {}
            try {
              card.style.width = ""; card.style.maxWidth = "100%"; card.style.minWidth = ""; card.style.aspectRatio = ""; card.style.minHeight = "";
              var _wos = card.querySelectorAll(".imageWrapper");
              for (var _wi = 0; _wi < _wos.length; _wi++) _wos[_wi].style.height = "";
              var _sz = card.querySelectorAll(".imageWrapperInner img");
              for (var _si = 0; _si < _sz.length; _si++) { _sz[_si].style.aspectRatio = ""; _sz[_si].style.width = ""; _sz[_si].style.maxWidth = ""; _sz[_si].style.height = ""; _sz[_si].style.objectFit = ""; }
            } catch (eSz) {}
            var im = cardImg();
            if (im) { im.loading = "eager"; }
          } catch (e5) {}
          var wrap = document.createElement("div");
          wrap.className = "dragon-origal";
          wrap.style.cssText = "--button-gap:0.25rem;--custom-button-display:none;--custom-button-2-display:none;--n"+"sfw-image-display:block;width:max-content;max-width:100%;";
          wrap.appendChild(card);
          return wrap;
  };
  function dragonScanGalUrl(channel, sub, sort, skip, cf, range) {
    var rg = String(range || "all-time");
    if (["all-time", "1-day", "3-day", "1-week", "1-month", "1-year"].indexOf(rg) === -1) rg = "all-time";
    var u = "https://image-generation.perchance.org/gallery?channel=" + encodeURIComponent(channel) +
      "&subChannel=" + encodeURIComponent(sub) + "&sort=" + encodeURIComponent(sort) + "&timeRange=" + encodeURIComponent(rg) + "&contentFilter=" + (cf === "g" || cf === "pg13" ? cf : "none") +
      "&userIsOver" + "18=1&userUnblurredAll=1&userUnblurredAllShocking=1&userUnblurredAllPg13Soft=1";
    if (skip > 0) u += "&skip=" + skip;
    return u;
  }
  window.dragonGalleryScanCards = function (opts) {
    opts = opts || {};
    var channel = String(opts.channel || window.generatorName || "bestaigen");
    var sub = String(opts.sub || "public");
    var sort = String(opts.sort || "recent");
    var skip = Number(opts.skip) || 0;
    var _cf = String(opts.filter || "none");
    var url = dragonScanGalUrl(channel, sub, sort, skip, _cf, opts.range);
    function got(u) {
      try {
        if (typeof root !== "undefined" && root && typeof root.superFetch === "function")
          return Promise.resolve().then(function () { return root.superFetch(u); }).then(function (r) {
            if (!r) throw new Error("no response");
            return (typeof r.text === "function") ? r.text() : String(r);
          });
      } catch (eW) {}
      return fetch(u).then(function (r) { return r.text(); });
    }
    return got(url).then(function (html) {
      html = String(html || "");
      if (html.length < 1000) return { cards: [], total: 0, exhausted: true };
      var doc = null;
      try { doc = new DOMParser().parseFromString(html, "text/html"); } catch (e) { return { cards: [], total: 0, exhausted: true }; }
      if (!doc) return { cards: [], total: 0, exhausted: true };
      dragonOrigEnsureAssets(doc);
      var out = [];
      var all = doc.querySelectorAll(".imageCtn");
      for (var i = 0; i < all.length; i++) {
        try {
          var w = window.dragonTransplantGalleryCard(all[i]);
          if (w) out.push({ imageId: all[i].getAttribute("data-image-id") || "", userId: all[i].getAttribute("data-user-id") || "", el: w });
        } catch (e2) {}
      }
      return { cards: out, total: out.length, exhausted: out.length < 100 };
    }).catch(function () { return { cards: [], total: 0, exhausted: true }; });
  };
  window.dragonReportImage = function (item) {
    item = item || {};
    if (document.querySelector(".dragon-report-ov")) return;
    ensureCss();
    var imageId = String(item.imageId || "");
    var url = String(item.url || "");
    var prompt = String(item.prompt || "");
    var uploader = String(item.userId || "");
    var channel = "", sub = "";
    try {
      if (window.__dragonGalSearchData) { var g = window.__dragonGalSearchData(); if (g) { channel = String(g.channel || ""); sub = String(g.sub || ""); } }
    } catch (e) {}
    var key = imageId || url;
    var ov = document.createElement("div");
    ov.className = "dragon-report-ov dragon-keep";
    ov.style.cssText = "position:fixed;inset:0;z-index:2147483645;background:rgba(6,6,10,.92);display:flex;align-items:center;justify-content:center;padding:1rem;box-sizing:border-box;font-family:system-ui,sans-serif;";
    var box = document.createElement("div");
    box.style.cssText = "width:min(46rem,96vw);max-height:94vh;display:flex;flex-direction:column;overflow:hidden;border:1px solid #5a4a7d;border-radius:14px;background:linear-gradient(180deg,#181822,#0e0e14);color:#e9e6f2;box-shadow:0 24px 70px rgba(0,0,0,.8);text-align:center;";
    var head = document.createElement("div");
    head.style.cssText = "padding:.7rem .9rem;border-bottom:1px solid rgba(255,255,255,.08);font-weight:800;color:#d8c9ff;";
    head.textContent = "\uD83D\uDEA9 Report this image";
    var scroll = document.createElement("div");
    scroll.style.cssText = "flex:1 1 auto;overflow-y:auto;min-height:0;";
    // ---- the picture's own default public-gallery card + the dual-system tip beside it ----
    // Egon 02.10.2026: the empty space right of the picture carries a short English note explaining
    // the two systems side by side (Perchance block on the picture + the bestaigen report below).
    // The tip lives OUTSIDE `card`, so the original-card swap never touches it; flex-wrap drops it
    // under the picture on narrow screens.
    var topRow = document.createElement("div");
    topRow.style.cssText = "display:flex;flex-wrap:wrap;align-items:stretch;gap:0;";
    var card = document.createElement("div");
    card.style.cssText = "flex:1 1 15rem;min-width:0;margin:.7rem 0 0 .9rem;border:1px solid #4a4a58;border-radius:10px;overflow:hidden;background:#1b1b21;text-align:left;align-self:flex-start;";
    var imTop = null;
    var imgWrap = document.createElement("div");
    imgWrap.style.cssText = "position:relative;max-height:60vh;overflow:hidden;background:#0d0d11;display:flex;align-items:center;justify-content:center;";
    if (/^https:\/\//.test(url)) {
      var im = document.createElement("img");
      im.src = url;
      im.alt = "";
      im.style.cssText = "width:100%;height:auto;max-height:60vh;object-fit:contain;display:block;background:#0d0d11;";
      imgWrap.appendChild(im);
      imTop = im;
    } else {
      imgWrap.style.cssText += "min-height:6rem;";
      var noIm = document.createElement("div");
      noIm.style.cssText = "font-size:.8rem;opacity:.7;padding:1rem;";
      noIm.textContent = "The picture itself cannot be shown here, but your report is still filed with its prompt below.";
      imgWrap.appendChild(noIm);
    }
    var cap = document.createElement("div");
    cap.style.cssText = "padding:.45rem .6rem;font-size:.72rem;line-height:1.5;color:#b4b4c8;border-top:1px solid rgba(255,255,255,.07);";
    var capBits = [];
    if (channel) capBits.push("\uD83D\uDDBC " + channel + (sub && sub !== "public" ? " / " + sub : ""));
    if (item.date) capBits.push("\uD83D\uDCC5 " + String(item.date).slice(0, 10));
    if (uploader) {
      var tag = "";
      try { tag = window.dragonUserTag ? window.dragonUserTag(uploader) : ""; } catch (e2) {}
      capBits.push("\uD83D\uDC64 " + (tag ? tag + " · " : "") + uploader.slice(0, 12) + (uploader.length > 12 ? "…" : ""));
    }
    if (imageId) capBits.push("#" + imageId.slice(0, 12) + (imageId.length > 12 ? "…" : ""));
    cap.textContent = capBits.join("   ·   ") || "Gallery picture";
    card.append(imgWrap, cap);
    var tip = document.createElement("div");
    tip.style.cssText = "flex:1 1 auto;align-self:stretch;margin:0;padding:.55rem .65rem;border:1px solid rgba(155,107,255,.35);border-radius:10px;background:linear-gradient(180deg,#1c1830,#12121a);color:#d9d2f2;font-size:.72rem;line-height:1.55;text-align:left;";
    tip.innerHTML = "\uD83D\uDEA9 <b>For the fastest result, use both systems together.</b><br><br>1. Click <span style='display:inline-block;transform:rotate(180deg);background:#000;color:#fff;border:1px solid #fff;border-radius:6px;padding:.05rem .45rem;font-weight:700;white-space:nowrap;'>\uD83D\uDEAB\uFE0E </span> \u201CBlock this user\u201D on this picture's card in the public gallery to report this image through Perchance's own block system. Enough Perchance default reports will get the image banned automatically.<br><br>2. Send the bestaigen report below so our admins and moderators are notified. A bestaigen report needs a manual moderation review. Used together, they are faster and more effective.";
    var rightCol = document.createElement("div");
    rightCol.style.cssText = "flex:1 1 15rem;min-width:min(100%,17rem);display:flex;flex-direction:column;align-items:stretch;margin:.7rem .9rem 0 .6rem;";
    rightCol.appendChild(tip);
    topRow.append(card, rightCol);
    scroll.appendChild(topRow);
    var note = document.createElement("input");
    note.type = "text";
    note.className = "dragon-report-note";
    note.placeholder = "Type your reasons";
    note.maxLength = 60;
    note.hidden = true;
    note.style.cssText = "margin:.55rem 0 0;width:100%;box-sizing:border-box;background:#0d0d12;border:1px solid rgba(255,255,255,.14);border-radius:8px;color:#eee;font-size:.78rem;padding:.4rem .55rem;font-family:inherit;";
    rightCol.appendChild(note);
    // ---- reason picker ----
    var why = document.createElement("div");
    why.style.cssText = "margin:.6rem 0 0;text-align:left;font-size:.8rem;display:flex;flex-direction:column;gap:.28rem;";
    var picked = 0;
    var radios = [];
    DRAGON_REPORT_REASONS.forEach(function (rr) {
      var lab = document.createElement("label");
      lab.style.cssText = "display:flex;align-items:center;gap:.45rem;padding:.32rem .5rem;border:1px solid rgba(255,255,255,.1);border-radius:8px;cursor:pointer;";
      var r = document.createElement("input");
      r.type = "radio"; r.name = "dragon-report-reason"; r.value = String(rr[0]);
      r.style.cssText = "accent-color:#e0244c;";
      r.onchange = function () { picked = rr[0]; try { note.hidden = (rr[0] !== 6); } catch (eN) {} };
      var sp = document.createElement("span");
      sp.textContent = rr[1];
      lab.append(r, sp);
      lab.onclick = function () { try { r.checked = true; } catch (e) {} picked = rr[0]; try { note.hidden = (rr[0] !== 6); } catch (eN2) {} };
      why.appendChild(lab);
      radios.push(lab);
    });
    rightCol.appendChild(why);

    var msg = document.createElement("div");
    msg.style.cssText = "min-height:1.2rem;margin:.4rem .9rem 0;font-size:.76rem;color:#ffb4b4;";
    scroll.appendChild(msg);
    var foot = document.createElement("div");
    foot.style.cssText = "display:flex;justify-content:center;gap:.6rem;padding:.6rem .9rem .85rem;";
    var cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    cancel.style.cssText = "border:1px solid #6a6a78;background:transparent;color:#cfc9e6;border-radius:9px;padding:.45rem 1.2rem;font-size:.9rem;cursor:pointer;";
    var send = document.createElement("button");
    send.type = "button";
    send.textContent = "\uD83D\uDEA9 Send report";
    send.style.cssText = "border:1px solid #e0244c;background:linear-gradient(180deg,#5a1620,#2a0a0e);color:#fff;border-radius:9px;padding:.45rem 1.2rem;font-size:.9rem;font-weight:700;cursor:pointer;";
    foot.append(cancel, send);
    box.append(head, scroll, foot);
    ov.appendChild(box);
    document.body.appendChild(ov);
    try { cancel.focus(); } catch (e) {}
    if (key && dragonReportedIds().indexOf(key) !== -1) {
      msg.style.color = "#9fe6b8";
      msg.textContent = "\u2705 You already reported this picture — thank you.";
      send.disabled = true;
      send.style.opacity = ".45";
    }
    send.onclick = function () {
      if (!picked) { msg.textContent = "Please pick a reason above."; return; }
      if (typeof window.dragonServerRpc !== "function") { msg.textContent = "The server link is not available right now — try again later."; return; }
      send.disabled = true;
      send.style.opacity = ".55";
      msg.style.color = "#cfc9e6";
      msg.textContent = "\u23F3 sending…";
      var payload = { r: picked, i: imageId, u: (/^https:\/\//.test(url) ? url : ""), o: uploader, c: channel, s: sub, p: prompt.slice(0, 200), n: (note.hidden ? "" : note.value.slice(0, 60)) };
      window.dragonServerRpc("dragonReportSend", JSON.stringify(payload)).then(function (raw) {
        var d = null;
        try { d = JSON.parse(raw); } catch (e) {}
        if (!d || d.ok !== true) {
          send.disabled = false;
          send.style.opacity = "";
          msg.style.color = "#ffb4b4";
          msg.textContent = (d && d.err === "slow") ? "Too fast — wait a moment and try again." : "Could not send the report. Try again later.";
          return;
        }
        if (key) dragonReportedMark(key);
        scroll.innerHTML = "";
        var done = document.createElement("div");
        done.style.cssText = "padding:1.6rem 1rem;font-size:.88rem;line-height:1.6;color:#9fe6b8;";
        done.textContent = "\u2705 Report sent — thank you. The gallery owner will review this picture.";
        scroll.appendChild(done);
        foot.innerHTML = "";
        var ok2 = document.createElement("button");
        ok2.type = "button";
        ok2.textContent = "OK";
        ok2.style.cssText = "border:1px solid #9b6bff;background:linear-gradient(180deg,#4a3a8a,#2a1d52);color:#fff;border-radius:9px;padding:.45rem 1.4rem;font-size:.9rem;font-weight:700;cursor:pointer;";
        ok2.onclick = function () { close(); };
        foot.appendChild(ok2);
        try { ok2.focus(); } catch (e) {}
      }, function () {
        send.disabled = false;
        send.style.opacity = "";
        msg.style.color = "#ffb4b4";
        msg.textContent = "Could not reach the server. Try again later.";
      });
    };
    ;function close() {
      try { window.removeEventListener("keydown", onKey); } catch (e) {}
      try { ov.remove(); } catch (e) {}
    }
    ;function onKey(e) { if (e.key === "Escape") close(); }
    cancel.addEventListener("click", close);
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    window.addEventListener("keydown", onKey);
  };

  ;function nativeFlag() { try { return localStorage.getItem("dragonT2INative") === "1"; } catch (e) { return false; } }
  window.dragonT2IUseNative = function (on) {
    if (on === undefined) return nativeFlag();
    try {
      if (on) localStorage.setItem("dragonT2INative", "1");
      else localStorage.removeItem("dragonT2INative");
    } catch (e) {}
    if (on) {
      window.__dragonT2IOk = false;
      try { var ovs = document.querySelectorAll(".dragon-imgov"); for (var i = 0; i < ovs.length; i++) ovs[i].remove(); } catch (e2) {}
      try { document.documentElement.setAttribute("data-dragon-t2i", "native"); } catch (e3) {}
    } else {
      try { document.documentElement.removeAttribute("data-dragon-t2i"); } catch (e4) {}
      if (!window.__dragonT2IMismatch) window.__dragonT2IOk = true;
    }
    try { if (window.dragonImgHistRender) window.dragonImgHistRender(true); } catch (e5) {}
    return nativeFlag();
  };
  ;function paintCpNativeBtn(b) {
    var on = false;
    try { on = window.dragonViewMode ? (window.dragonViewMode() === "default") : window.dragonT2IUseNative(); } catch (e) {}
    try {
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.style.setProperty("border-color", on ? "#ffd76a" : "", "important");
      b.style.setProperty("box-shadow", on ? "0 0 9px rgba(255,215,106,.65)" : "", "important");
    } catch (e2) {}
  }
  ;function ensureCpNativeBtn() {
    return;
    var panel = document.getElementById("dragonProcessBody") || document.querySelector(".dragon-control-panel");
    if (!panel) return;
    var headBtn = null;
    try {
      var kids = panel.children;
      for (var k = 0; k < kids.length; k++) {
        if (kids[k].tagName === "BUTTON") { headBtn = kids[k]; break; }
      }
    } catch (e0) {}
    var wrap = document.getElementById("dragonCpNativeWrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "dragonCpNativeWrap";
      wrap.className = "dragon-keep";
      wrap.style.cssText = "margin:.3rem auto;display:flex;justify-content:center;";
      try {
        if (headBtn && headBtn.nextSibling) panel.insertBefore(wrap, headBtn.nextSibling);
        else panel.appendChild(wrap);
      } catch (e1) { return; }
    }
    if (wrap.parentElement !== panel) { try { panel.appendChild(wrap); } catch (e2) {} }
    try {
      var dead = document.querySelector(".dragon-cp-tools-row #dragonCpNativeBtn");
      if (dead) dead.remove();
    } catch (e3) {}
    var b = document.getElementById("dragonCpNativeBtn");
    if (!b) {
      b = document.createElement("button");
      b.type = "button";
      b.id = "dragonCpNativeBtn";
      b.className = "dragon-shortcut-tool dragon-keep";
      b.textContent = "🖼️ Original boxes";
      b.title = "Use the original generation boxes (no overlay buttons)";
      b.setAttribute("aria-label", "Use the original generation boxes");
      b.addEventListener("click", function () {
        try { window.dragonViewMode(window.dragonViewMode() === "default" ? "seperated" : "default"); } catch (e) {}
        paintCpNativeBtn(b);
      });
      try { wrap.appendChild(b); } catch (e2) { return; }
    }
    if (b.parentElement !== wrap) { try { wrap.appendChild(b); } catch (e3) {} }
    paintCpNativeBtn(b);
  }
  window.dragonCheckT2IAdapter = function () {
    var hasRead = (typeof window.dragonT2IRead === "function");
    var hasOverlay = (typeof window.dragonImageOverlay === "function");
    var hasTileRefresh = (typeof window.dragonTileRefresh === "function");
    var hasEmbed = (typeof window.dragonEmbedGenerate === "function");
    var hasHistRefresh = (typeof window.dragonHistoryRefresh === "function");
    var native = nativeFlag();
    var overlays = 0;
    try { overlays = document.querySelectorAll(".dragon-imgov, .dragon-imgov-btn").length; } catch (e) {}
    if (!hasRead || !hasOverlay || !hasTileRefresh || !hasEmbed || !hasHistRefresh)
      return "FAIL: adapter API incomplete (read=" + hasRead + " overlay=" + hasOverlay + " tile=" + hasTileRefresh + " embed=" + hasEmbed + " hist=" + hasHistRefresh + ")";
    if (window.__dragonT2IMismatch && !native)
      return "FAIL: mismatch flag set but native mode not engaged";
    if (native) return "OK: native mode on by choice, adapter API complete (" + overlays + " overlay nodes parked)";
    return "OK: adapter API complete, " + overlays + " overlay node(s) live, mismatch=" + (!!window.__dragonT2IMismatch);
  };

  // ════════════════════ OUTPUT ALWAYS SMALL + PROD SIZE MEMORY (Parca A) ════════════════════
  // Display only changes the tile's CSS width (generation resolution is fixed): the output row
  // is forced Small via CSS above, while the visitor's own display choice is remembered here
  // for the production cards (Parca B) and mirrored into --dragon-prod-tile so they react live.
  ;function prodChoice() {
    try {
      var v = localStorage.getItem("dragonProdDisplay");
      if (v) return v;
    } catch (e) {}
    try {
      var s = document.querySelector('select[data-name="display"]');
      if (s && s.value) return String(s.value);
    } catch (e2) {}
    return "450";
  }
  window.dragonProdDisplay = function () { return prodChoice(); };
  window.dragonProdTilePx = function () {
    var v = prodChoice();
    if (v.indexOf("%") !== -1) return "100%";
    var n = parseInt(v, 10);
    if (!(n > 0)) n = 450;
    return n + "px";
  };
  ;function prodSyncVar() {
    try { document.documentElement.style.setProperty("--dragon-prod-tile", window.dragonProdTilePx()); } catch (e) {}
  }
  ;function prodWatch() {
    try {
      var s = document.querySelector('select[data-name="display"]');
      try {
        var _sizes = [["90", "Tiny"], ["120", "Mini"]];
        for (var _zi = _sizes.length - 1; _zi >= 0; _zi--) {
          if (s && !s.querySelector('option[value="' + _sizes[_zi][0] + '"]')) {
            var _nopt = document.createElement("option");
            _nopt.value = _sizes[_zi][0]; _nopt.textContent = _sizes[_zi][1];
            if (s.firstChild) s.insertBefore(_nopt, s.firstChild);
            else s.appendChild(_nopt);
          }
        }
        try { var _micro = s && s.querySelector('option[value="60"]'); if (_micro) _micro.remove(); } catch (eM2) {}
      } catch (eM) {}
      if (s && !s.__dragonProdWatch) {
        s.__dragonProdWatch = true;
        s.addEventListener("change", function () {
          var v = String(s.value || "");
          if (v) { try { localStorage.setItem("dragonProdDisplay", v); } catch (e) {} }
          prodSyncVar();
        });
      }
    } catch (e) {}
  }
  // ════════════════════ PRODUCTION ROW: swap ready tiles for display-size cards (Parca B) ════════════════════
  // Row 1 (outputAreaEl) stays Small; when a tile's image is ready the tile hides and a card at
  // the visitor's display size (--dragon-prod-tile) is prepended in row 2 (#dragonProdRow, newest
  // first). The card's overlay stays bound to its hidden source tile, so per-image refresh keeps
  // working; a watcher keeps the card picture following the tile while the tile is alive.
  ;function prodRow() {
    var m = "modern";
    try { if (window.dragonViewMode) m = window.dragonViewMode(); } catch (eM) {}
    var wantProc = false;
    if (m === "modern") wantProc = true;
    else if (m === "custom") {
      var cc = null;
      try { cc = window.dragonViewCustomGet ? window.dragonViewCustomGet() : null; } catch (eC) {}
      wantProc = !cc || cc.cardsIn !== "product" || !cc.product;
    }
    var panel = wantProc ? dragonProcessPanelEnsure() : dragonProductionEnsure();
    if (!panel) panel = dragonProductionEnsure();
    if (!panel || !panel.parentElement) return null;
    var monR = null;
    try { monR = dragonMonitorEnsure(); } catch (eMR) { monR = null; }
    var host = (monR && monR.parentElement) ? monR.parentElement : panel.parentElement;
    var body = panel.querySelector(wantProc ? "#dragonProcessBody" : "#dragonProductionBody") || panel.querySelector("#dragonProductionBody") || panel.querySelector("#dragonProcessBody");
    var row = document.getElementById("dragonProdRow");
    if (!row) {
      row = document.createElement("div");
      row.id = "dragonProdRow";
      row.className = "dragon-keep";
    }
    if (body && row.parentElement !== body) { try { body.insertBefore(row, body.firstChild); } catch (e) { return null; } }
    if (!row.isConnected) return null;
    var head = document.getElementById("dragonImageHistHead");
    var box = document.getElementById("dragonImageHistInline");
    var histAnchor = (monR && monR.parentElement === host) ? monR : panel;
    if (head && head.parentElement === host && head.previousElementSibling !== histAnchor) {
      try { host.insertBefore(head, histAnchor.nextSibling); } catch (e3) {}
    }
    if (box && box.parentElement === host && head && box.previousElementSibling !== head) {
      try { host.insertBefore(box, head.nextSibling); } catch (e4) {}
    }
    return row;
  }
  ;function dragonCCTailSync() {
    try {
      if ((window.dragonPage || "") !== "character") return;
      try {
        var _oa = document.getElementById("outputAreaEl");
        if (_oa) {
          var _ts = _oa.querySelectorAll(".t2i-image-ctn");
          for (var _qi = 0; _qi < _ts.length; _qi++) {
            var _qt = _ts[_qi];
            var _qf = null;
            try { _qf = _qt.querySelector("iframe"); } catch (eQF) {}
            var _qo = null;
            try { _qo = _qf && _qf.textToImagePluginOutput; } catch (eQO) {}
            if ((!_qo || !_qo.dataUrl) && _qt.isConnected) return;
          }
        }
      } catch (eQ) {}
      var gr = document.querySelector(".dragon-gen-row");
      if (!gr) return;
      var mon = null;
      try { mon = window.dragonMonitorEnsure ? window.dragonMonitorEnsure() : document.getElementById("dragonMonitorPanel"); } catch (eM) { mon = null; }
      var els = [];
      if (mon) els.push(mon);
      var ph = document.querySelector(".dragon-placeholder");
      if (ph) els.push(ph);
      var hh = document.getElementById("dragonImageHistHead");
      var hb = document.getElementById("dragonImageHistInline");
      if (hh) els.push(hh);
      if (hb) els.push(hb);
      if (!els.length) return;
      for (var i = 0; i < els.length; i++) {
        try { if (els[i].parentElement !== gr) gr.appendChild(els[i]); } catch (eM2) {}
      }
    } catch (e) {}
  }
  window.dragonCCTailSync = dragonCCTailSync;
  ;function prodAct(label, title, cls, fn) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.title = title;
    b.setAttribute("aria-label", title);
    if (cls) b.className = cls;
    b.addEventListener("click", function (e) { e.stopPropagation(); e.preventDefault(); try { fn(); } catch (er) {} });
    return b;
  }
  ;function prodTileInfo(tile) {
    var r = window.dragonT2IRead(tile);
    if (!r || !r.url) return null;
    var ins = r.inputs || {};
    return {
      url: r.url,
      prompt: ins.prompt != null ? String(ins.prompt) : "",
      neg: ins.negativePrompt != null ? String(ins.negativePrompt) : "",
      seed: ins.seed,
      gs: ins.guidanceScale,
      res: ins.resolution || "",
      tile: tile
    };
  }
  ;function prodOpenZoom(tile) {
    var it = prodTileInfo(tile);
    if (!it) { toast("image still generating …"); return; }
    if (window.dragonZoomLightbox) { try { window.dragonZoomLightbox({ url: it.url, prompt: it.prompt }, null, null, 0, null, { pushPublic: true }); return; } catch (e) {} }
    if (window.t2i_zoomImage) { try { window.t2i_zoomImage(tile); return; } catch (e2) {} }
    try { window.open(it.url, "_blank"); } catch (e3) {}
  }
  ;function prodInlineNow() { try { return window.dragonViewMode ? window.dragonViewMode() === "modern" : false; } catch (e) { return false; } }
  ;function prodAllCards() {
    var out = [];
    try {
      var row = document.getElementById("dragonProdRow");
      var a = row ? row.querySelectorAll(".dragon-prod-card") : [];
      for (var i = 0; i < a.length; i++) out.push(a[i]);
      var oa = document.getElementById("outputAreaEl");
      var b = oa ? oa.querySelectorAll(".dragon-prod-card") : [];
      for (var j = 0; j < b.length; j++) { if (out.indexOf(b[j]) === -1) out.push(b[j]); }
    } catch (e) {}
    return out;
  }
  ;function buildProdCard(tile, beforeEl) {
    var inline = prodInlineNow();
    var row = inline ? null : prodRow();
    var it = prodTileInfo(tile);
    if ((!row && !inline) || !it) return false;
    try {
      if (window.__dragonProdPendingClear) {
        window.__dragonProdPendingClear = false;
        var _rc = prodAllCards();
        for (var _ri = 0; _ri < _rc.length; _ri++) {
          try {
            var _rt = _rc[_ri].__dragonTile;
            _rc[_ri].remove();
            if (_rt && _rt.isConnected && _rt.parentElement && _rt.parentElement.id === "outputAreaEl") { try { _rt.remove(); } catch (eRT) {} }
          } catch (eR) {}
        }
        try { var _st = document.getElementById("dragonProdStash"); if (_st) { var _sc = _st.querySelectorAll(".dragon-prod-card"); for (var _si = 0; _si < _sc.length; _si++) { try { _sc[_si].remove(); } catch (eSR) {} } } } catch (eSC) {}
      }
    } catch (ePC) {}
    tile.__dragonSwapped = true;
    try { tile.style.setProperty("display", "none", "important"); } catch (e) { try { tile.style.display = "none"; } catch (e2) {} }
    var card = document.createElement("div");
    card.className = "dragon-prod-card dragon-keep";
    card.__dragonTile = tile;
    tile.__dragonCard = card;
    var shot = document.createElement("div");
    shot.className = "dragon-prod-shot";
    var img = document.createElement("img");
    img.src = it.url;
    img.alt = "";
    img.title = "Click To View Full Image";
    img.addEventListener("click", function () { prodOpenZoom(tile); });
    shot.appendChild(img);
    card.appendChild(shot);
    card.__dragonInfo = it;
    try {
      if (tile.classList && tile.classList.contains("dragon-tester-ctn")) {
        var _tl = tile.querySelector(".dragon-tester-label");
        if (_tl && _tl.textContent) {
          var _lc = document.createElement("div");
          _lc.className = "dragon-tester-label";
          _lc.textContent = _tl.textContent;
          _lc.style.cssText = "display:block;width:100%;box-sizing:border-box;text-align:center;padding:.3rem .5rem;font-size:.72rem;font-weight:bold;color:#d8c9ff;background:rgba(155,107,255,.14);border-bottom:1px solid rgba(155,107,255,.35);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
          card.insertBefore(_lc, card.firstChild);
        }
      }
    } catch (eL) {}
    var _noOv = false, _underRow = false;
    try {
      var _vm = window.dragonViewMode ? window.dragonViewMode() : "seperated";
      if (_vm === "custom") {
        var _cc = window.dragonViewCustomGet ? window.dragonViewCustomGet() : null;
        _noOv = !!(_cc && _cc.btns === "under");
        _underRow = !!(_cc && _cc.btns !== "on");
      }
    } catch (eOv) {}
    if (!_noOv) {
    try {
      window.dragonImageOverlay(shot, {
        tile: tile,
        getInfo: function () {
          var live = prodTileInfo(tile);
          if (live) return live;
          return card.__dragonInfo || null;
        },
        onRefresh: function (mode) {
          var tl = card.__dragonTile;
          if (tl && tl.isConnected && window.dragonTileRefresh) { window.dragonTileRefresh(tl, mode); return; }
          var en = card.__dragonInfo;
          if (en && window.dragonHistoryRefresh) {
            window.dragonHistoryRefresh({ t: Date.now(), p: en.prompt || "", seed: en.seed, res: en.res || "", neg: en.neg || "", gs: en.gs }, mode);
            return;
          }
          toast("the source picture is gone — see Image History");
        }
      });
    } catch (e3) {}
    }
    if (_underRow) {
      try {
        var urow = document.createElement("div");
        urow.className = "dragon-prod-acts dragon-keep";
        urow.style.cssText = "display:flex !important;flex-wrap:wrap;justify-content:center;gap:.28rem;padding:.32rem .4rem .42rem;background:transparent;";
        ;function uBtn(txt, title, fn) {
          var ub = document.createElement("button");
          ub.type = "button"; ub.textContent = txt; ub.title = title;
          ub.setAttribute("aria-label", title);
          ub.style.cssText = "flex:0 0 auto;width:2.15rem;height:2.15rem;min-width:0;padding:0;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:.98rem;font-weight:700;line-height:1;cursor:pointer;white-space:nowrap;border:1px solid #6a6a78;background:linear-gradient(145deg,#24242d,#131318);color:#ccc;";
          ub.addEventListener("click", function (e) { e.stopPropagation(); e.preventDefault(); try { fn(); } catch (er) {} });
          return ub;
        }
        ;function uInfo() {
          var live = prodTileInfo(tile);
          if (live) return live;
          return card.__dragonInfo || null;
        }
        urow.appendChild(uBtn("⬇️", "Download Image", function () {
          var inf = uInfo();
          if (inf && inf.url && window.dragonDownloadImage) window.dragonDownloadImage(inf.url);
        }));
        urow.appendChild(uBtn("ℹ️", "Prompt Info", function () {
          var inf = uInfo();
          if (inf && window.dragonPromptInfo) window.dragonPromptInfo({ prompt: inf.prompt, neg: inf.neg, seed: inf.seed, gs: inf.gs, desc: (inf.desc || inf.description || ""), title: (inf.title || inf.stitle || ""), date: (inf.date || inf.sdate || "") });
        }));
        urow.appendChild(uBtn("📌", "Save To Prompt Bank", function () {
          var inf = uInfo();
          if (inf && window.dragonBankSendFromGallery) window.dragonBankSendFromGallery(inf);
        }));
        card.appendChild(urow);
      } catch (eU) {}
    }
    try { card.__dragonSeq = dragonSeqOf(tile); } catch (eS) {}
    if (inline) {
      try {
        try { card.classList.add("dragon-prod-inline"); } catch (eC) {}
        if (tile.parentElement) tile.parentElement.insertBefore(card, tile.nextSibling);
        else { var oaI = document.getElementById("outputAreaEl"); if (oaI) oaI.appendChild(card); else return false; }
      } catch (e4i) { return false; }
    } else {
      try {
        if (beforeEl && beforeEl.parentElement === row) row.insertBefore(card, beforeEl);
        else { var ipos = dragonCardInsertPos(row, dragonSeqOf(card)); if (ipos) row.insertBefore(card, ipos); else row.appendChild(card); }
      } catch (e4b) { try { row.appendChild(card); } catch (e5) { return false; } }
      try { window.dragonProductionOpen(true); } catch (eP) {}
      try { dragonProductionPaint(); } catch (eP2) {}
    }
    try { prodVisibilitySync(); } catch (eP3) {}
    return card;
  }
  ;function prodSwapTile(tile) {
    try {
      if (!tile || tile.__dragonSwapped) return false;
      if (tile.classList && tile.classList.contains("dragon-tester-ctn")) { try { if (!prodInlineNow()) return false; } catch (eI) { return false; } }
      if (!tile.isConnected) return false;
      if (window.__dragonT2IOk === false) return false;
      try { if (window.dragonProdCardsOn && !window.dragonProdCardsOn()) return false; } catch (e) {}
      var r = window.dragonT2IRead(tile);
      if (!r || !r.url) return false;
      return buildProdCard(tile);
    } catch (e2) { return false; }
  }
  window.dragonProdSwapTile = prodSwapTile;
  ;function prodHideTile(tile) {
    if (!tile || tile.__dragonHidden) return;
    tile.__dragonHidden = true;
    try { tile.style.setProperty("display", "none", "important"); } catch (e) { try { tile.style.display = "none"; } catch (e2) {} }
  }
  ;function prodInstantHide(tile) {
    if (!tile || tile.__dragonSwapped) return false;
    if (tile.classList && tile.classList.contains("dragon-tester-ctn")) { try { if (!prodInlineNow()) return false; } catch (eI2) { return false; } }
    if (!tile.isConnected) return false;
    try { if (window.dragonProdCardsOn && !window.dragonProdCardsOn()) return false; } catch (e) {}
    prodHideTile(tile);
    var n = 0;
    var iv = setInterval(function () {
      var ok = false;
      try { ok = prodSwapTile(tile); } catch (e2) {}
      if (ok || ++n > 12) clearInterval(iv);
    }, 60);
    return true;
  }
  ;function prodFinishListen() {
    if (window.__dragonProdFinishListen) return;
    window.__dragonProdFinishListen = true;
    window.addEventListener("message", function (ev) {
      try {
        if (!ev || ev.origin !== SRV) return;
        var d = ev.data;
        if (!d || typeof d !== "object" || d.type !== "finished") return;
        if (!d.dataUrl && !(d.data && d.data.dataUrl)) return;
        if (!d.id) return;
        var oa = document.getElementById("outputAreaEl");
        if (!oa) return;
        var tiles = oa.querySelectorAll(".t2i-image-ctn");
        for (var i = 0; i < tiles.length; i++) {
          (function (tile) {
            try {
              if (!tile || tile.__dragonSwapped) return;
              var f = tile.querySelector("iframe");
              if (!f) return;
              var hit = false;
              try { if (f.className && f.className.indexOf(d.id) !== -1) hit = true; } catch (e0) {}
              if (!hit) {
                try {
                  var src = f.src || f.getAttribute("data-src") || "";
                  var h = src.split("#")[1] || "";
                  if (h && decodeURIComponent(h).indexOf(d.id) !== -1) hit = true;
                } catch (e1) {}
              }
              if (hit) {
                if (tile.classList && tile.classList.contains("dragon-tester-ctn")) { try { testerTileReady(tile); } catch (eT) {} }
                else prodInstantHide(tile);
              }
            } catch (e2) {}
          })(tiles[i]);
        }
      } catch (e3) {}
    });
  }
  ;function prodSwapScan() {
    if (window.__dragonT2IOk === false) return;
    try { if (window.dragonProdCardsOn && !window.dragonProdCardsOn()) return; } catch (e) {}
    var oa = document.getElementById("outputAreaEl");
    if (!oa) return;
    var tiles = oa.querySelectorAll(".t2i-image-ctn");
    for (var i = 0; i < tiles.length; i++) { try { prodSwapTile(tiles[i]); } catch (e2) {} }
  }
  ;function prodFollowScan() {
    var cards = prodAllCards();
    for (var i = 0; i < cards.length; i++) {
      (function (card) {
        try {
          var tile = card.__dragonTile;
          if (!tile || !tile.isConnected) return;
          var img = card.querySelector(".dragon-prod-shot img");
          if (!img) return;
          var r = window.dragonT2IRead(tile);
          if (r && r.url && img.getAttribute("src") !== r.url) img.src = r.url;
          var ins = (r && r.inputs) || {};
          card.__dragonInfo = {
            url: r.url,
            prompt: ins.prompt != null ? String(ins.prompt) : "",
            neg: ins.negativePrompt != null ? String(ins.negativePrompt) : "",
            seed: ins.seed,
            gs: ins.guidanceScale,
            res: ins.resolution || ""
          };
        } catch (e) {}
      })(cards[i]);
    }
  }
  ;function prodClear() {
    var cards = prodAllCards();
    for (var i = 0; i < cards.length; i++) { try { cards[i].remove(); } catch (e) {} }
  }
  window.dragonProdClear = prodClear;
  window.dragonProdArchive = function () {
    try {
      var cards = prodAllCards();
      var known = null;
      try { known = window.dragonHistGetAll ? window.dragonHistGetAll() : null; } catch (eK) {}
      for (var i = 0; i < cards.length; i++) {
        try {
          var inf = cards[i].__dragonInfo;
          if (!inf || !inf.url) continue;
          var dup = false;
          if (known) {
            for (var j = 0; j < known.length; j++) {
              if (String(known[j].p || "") === String(inf.prompt || "") && String(known[j].seed || "") === String(inf.seed != null ? inf.seed : "")) { dup = true; break; }
            }
          }
          if (!dup && window.dragonHistAddImage) window.dragonHistAddImage({ dataUrl: inf.url, prompt: inf.prompt || "", seed: inf.seed, resolution: inf.res || "", neg: inf.neg || "", gs: inf.gs, desc: (inf.desc || "") });
        } catch (eC) {}
      }
    } catch (e) {}
  };
  window.dragonProdArchiveFinished = function () {
    try {
      var known = null;
      try { known = window.dragonHistGetAll ? window.dragonHistGetAll() : null; } catch (eK) {}
      var isDup = function (prompt, seed) {
        if (!known) return false;
        for (var j = 0; j < known.length; j++) {
          if (String(known[j].p || "") === String(prompt || "") && String(known[j].seed || "") === String(seed != null ? seed : "")) return true;
        }
        return false;
      };
      var pushHist = function (inf) {
        if (!inf || !inf.url) return;
        if (isDup(inf.prompt, inf.seed)) return;
        try { if (window.dragonHistAddImage) window.dragonHistAddImage({ dataUrl: inf.url, prompt: inf.prompt || "", seed: inf.seed, resolution: inf.res || "", neg: inf.neg || "", gs: inf.gs, desc: (inf.desc || "") }); } catch (e) {}
        try { known = window.dragonHistGetAll ? window.dragonHistGetAll() : known; } catch (e2) {}
      };
      var cards = prodAllCards();
      for (var i = 0; i < cards.length; i++) {
        try {
          var inf = cards[i].__dragonInfo;
          if (!inf || !inf.url) continue;
          pushHist(inf);
          try {
            var _ct = cards[i].__dragonTile;
            cards[i].remove();
            if (_ct && _ct.isConnected && _ct.parentElement && _ct.parentElement.id === "outputAreaEl") { try { _ct.remove(); } catch (eTR2) {} }
          } catch (eR) {}
        } catch (eC) {}
      }
      var oa = document.getElementById("outputAreaEl");
      var tiles = oa ? oa.querySelectorAll(".t2i-image-ctn") : [];
      for (var k = 0; k < tiles.length; k++) {
        try {
          var t = tiles[k];
          if (t.__dragonAborted) continue;
          var r = null;
          try { r = window.dragonT2IRead ? window.dragonT2IRead(t) : null; } catch (eR2) { r = null; }
          if (!r || !r.url) {
            try { var f = t.querySelector("iframe"); var o = f && f.textToImagePluginOutput; if (o && o.dataUrl) r = { url: o.dataUrl, inputs: o.inputs || {} }; } catch (eF) {}
          }
          if (!r || !r.url) continue;
          var ins = (r && r.inputs) || {};
          pushHist({ url: r.url, prompt: ins.prompt != null ? String(ins.prompt) : "", neg: ins.negativePrompt != null ? String(ins.negativePrompt) : "", seed: ins.seed, gs: ins.guidanceScale, res: ins.resolution || "" });
          try {
            var card = t.__dragonCard;
            if (card && card.isConnected) { try { card.remove(); } catch (eCR) {} }
          } catch (eCC) {}
          try { t.remove(); } catch (eTR) {}
        } catch (eT) {}
      }
    } catch (e) {}
  };
  window.dragonProdArchiveAndClear = function () {
    try { window.dragonProdArchive(); } catch (eA) {}
    try { if (window.dragonProdNewSession) window.dragonProdNewSession(); } catch (eS) {}
    try { window.__dragonProdPendingClear = true; } catch (eF) {}
  };
  window.dragonProdBeginGeneration = function () {
    var now = Date.now();
    try { if (window.__dragonProdBeginAt && (now - window.__dragonProdBeginAt < 2000)) return window.__dragonProdSession; } catch (eG) {}
    try { window.__dragonProdBeginAt = now; } catch (eT) {}
    try { window.dragonProdArchiveAndClear(); } catch (eA2) {}
    try { if (window.dragonProdForceShow) window.dragonProdForceShow(); } catch (eF2) {}
    return window.__dragonProdSession;
  };
  window.__dragonProdSession = Date.now();
  window.dragonProdNewSession = function () {
    window.__dragonProdSession = Date.now();
    return window.__dragonProdSession;
  };

  // ════════════════════ VIEW MODE: default / modern / seperated / custom ════════════════════
  // (Egon 28.09.2026 (W-UI356): Classic→Modern, Modern→Seperated. Stored prefs migrate silently.)
  // default = the original generation boxes at native size with our under-image action row
  //           (Process panel only, no finished-image cards).
  // modern  = the original boxes at native size; when a tile finishes it is swapped
  //           in place for our card (no separate row or panel).
  // seperated = small output row + display-size finished cards in their own panel (DEFAULT).
  // custom  = the visitor's own mix from the Custom Monitor popup (remembered on this device).
  window.dragonViewCustomGet = function () {
    try {
      var c = JSON.parse(localStorage.getItem("dragonViewCustom") || "null");
      if (c && typeof c === "object") {
        return {
          // Egon 28.09.2026 (W-UI361): layout "default" = the Default Panel choice — original boxes,
          // no extras of ours. Old stored prefs backfill to "panels".
          layout: (c.layout === "default") ? "default" : "panels",
          process: c.process !== false,
          product: c.product === true,
          out: (c.out === "display" || c.out === "native") ? c.out : "small",
          cardsIn: c.cardsIn === "product" ? "product" : "process",
          btns: (c.btns === "under" || c.btns === "both") ? c.btns : "on"
        };
      }
    } catch (e) {}
    return { layout: "panels", process: true, product: true, out: "small", cardsIn: "product", btns: "on" };
  };
  window.dragonViewCustomSet = function (c) {
    try { localStorage.setItem("dragonViewCustom", JSON.stringify(c)); } catch (e) {}
    return window.dragonViewCustomGet();
  };
  window.dragonViewMode = function (set) {
    if (set === undefined) {
      try {
        var v = localStorage.getItem("dragonViewMode");
        if (v === "native") return "default";
        // W-UI356 migration, ONE TIME (flagged): pre-rename Classic→Modern, pre-rename Modern→Seperated.
        // After the flag is set a stored "modern" is the visitor's own live choice and must stick.
        try {
          if (!localStorage.getItem("dragonViewModeMig")) {
            if (v === "classic" || v === "modern") {
              var _migTo = (v === "classic") ? "modern" : "seperated";
              try { localStorage.setItem("dragonViewMode", _migTo); } catch (eM) {}
              v = _migTo;
            }
            try { localStorage.setItem("dragonViewModeMig", "1"); } catch (eM2) {}
          }
        } catch (eMM) {}
        if (v === "default" || v === "custom" || v === "seperated" || v === "modern") return v;
      } catch (e) {}
      return "modern";
    }
    try {
      if (set === "modern") localStorage.removeItem("dragonViewMode");
      else localStorage.setItem("dragonViewMode", set);
    } catch (e) {}
    applyViewMode();
    return set;
  };
  ;function viewModeCur() { try { return window.dragonViewMode(); } catch (e) { return "modern"; } }
  window.dragonProdCardsOn = function () {
    var m = viewModeCur();
    if (m === "seperated" || m === "modern") return true;
    if (m === "custom") {
      var c = window.dragonViewCustomGet();
      if (c.layout === "default") return false;
      return !!(c.process || c.product);
    }
    return false;
  };
  window.dragonTileOverlayOn = function () {
    var m = viewModeCur();
    if (m === "modern") return true;
    if (m === "custom") {
      var c = window.dragonViewCustomGet();
      if (c.layout === "default") return false;
      return c.btns !== "under";
    }
    return false;
  };
  // A cards-off mode must not EAT the finished cards: the source tiles stay __dragonSwapped, so a
  // removed card would never be rebuilt on the way back. Stash them instead (hidden, order kept) and
  // restore them when a cards-on mode returns.
  ;function prodStashBox() {
    var s = document.getElementById("dragonProdStash");
    if (!s) {
      s = document.createElement("div");
      s.id = "dragonProdStash";
      s.className = "dragon-keep";
      s.style.cssText = "display:none !important;";
      document.body.appendChild(s);
    }
    return s;
  }
  ;function stashProdCards() {
    var cs = prodAllCards(), n = 0;
    if (!cs.length) return 0;
    var st = prodStashBox();
    for (var i = 0; i < cs.length; i++) { try { st.appendChild(cs[i]); n++; } catch (e) {} }
    return n;
  }
  ;function restoreProdCards() {
    var st = document.getElementById("dragonProdStash");
    if (!st) return 0;
    var modernBack = prodInlineNow();
    var row = null;
    if (!modernBack) {
      try { row = prodRow(); } catch (e) { row = document.getElementById("dragonProdRow"); }
      if (!row) return 0;
    }
    var cs = st.querySelectorAll(".dragon-prod-card"), n = 0;
    for (var i = 0; i < cs.length; i++) {
      try {
        if (modernBack) {
          var t = cs[i].__dragonTile;
          if (t && t.isConnected && t.parentElement) t.parentElement.insertBefore(cs[i], t.nextSibling);
          else { var oaR = document.getElementById("outputAreaEl"); if (oaR) oaR.appendChild(cs[i]); else continue; }
        } else row.appendChild(cs[i]);
        n++;
      } catch (e2) {}
    }
    return n;
  }
  ;function prodRelocateForMode(m) {
    try {
      if (m === "modern") {
        var row = document.getElementById("dragonProdRow");
        var cs = row ? row.querySelectorAll(".dragon-prod-card") : [];
        var oa = document.getElementById("outputAreaEl");
        for (var i = 0; i < cs.length; i++) {
          (function (card) {
            try {
              var t = card.__dragonTile;
              if (t && t.isConnected && t.parentElement) t.parentElement.insertBefore(card, t.nextSibling);
              else if (oa && oa.isConnected) oa.appendChild(card);
            } catch (e) {}
          })(cs[i]);
        }
      } else if (m === "seperated" || m === "custom") {
        var all = [];
        try {
          var oa2 = document.getElementById("outputAreaEl");
          var ib = oa2 ? oa2.querySelectorAll(".dragon-prod-card") : [];
          for (var j = 0; j < ib.length; j++) all.push(ib[j]);
        } catch (e2) {}
        if (all.length) {
          var dst = null;
          try { dst = prodRow(); } catch (e3) { dst = document.getElementById("dragonProdRow"); }
          if (dst) { for (var k = 0; k < all.length; k++) { try { dst.appendChild(all[k]); } catch (e4) {} } }
        }
      }
    } catch (e5) {}
  }
  ;function applyViewMode() {
    var m = viewModeCur();
    try {
      if (m === "seperated") document.documentElement.removeAttribute("data-dragon-view");
      else document.documentElement.setAttribute("data-dragon-view", m);
    } catch (e) {}
    var cout = "small";
    if (m === "default") cout = "native";
    else if (m === "modern") cout = "native";
    else if (m === "custom") { try { var _cc0 = window.dragonViewCustomGet(); cout = (_cc0.layout === "default") ? "native" : (_cc0.out || "small"); } catch (eC) { cout = "small"; } }
    try {
      if (cout === "small") document.documentElement.setAttribute("data-dragon-cout", "small");
      else if (cout === "display") document.documentElement.setAttribute("data-dragon-cout", "display");
      else document.documentElement.removeAttribute("data-dragon-cout");
    } catch (e2) {}
    try {
      if (m === "default" || (m === "custom" && (function () { try { return window.dragonViewCustomGet().layout === "default"; } catch (eL) { return false; } })())) { if (!window.dragonT2IUseNative()) window.dragonT2IUseNative(true); }
      else if (window.dragonT2IUseNative && window.dragonT2IUseNative()) window.dragonT2IUseNative(false);
    } catch (e3) {}
    if (!window.dragonProdCardsOn()) {
      try { stashProdCards(); } catch (e4) {}
      try {
        var oa = document.getElementById("outputAreaEl");
        if (oa) {
          var ts = oa.querySelectorAll(".t2i-image-ctn");
          for (var j = 0; j < ts.length; j++) { try { ts[j].style.removeProperty("display"); } catch (e5) {} }
        }
      } catch (e6) {}
    } else {
      try {
        var row2 = document.getElementById("dragonProdRow");
        if (row2 && row2.parentElement) {
          var wantSel = (m === "modern") ? "#dragonProcessBody" : null;
          if (m === "custom") {
            var cc = window.dragonViewCustomGet();
            wantSel = (cc.layout !== "default" && cc.cardsIn === "product" && cc.product) ? "#dragonProductionBody" : "#dragonProcessBody";
          } else if (m === "seperated") wantSel = "#dragonProductionBody";
          if (wantSel) {
            var wantBody = document.querySelector(wantSel);
            if (wantBody && row2.parentElement !== wantBody) wantBody.insertBefore(row2, wantBody.firstChild);
          }
        }
      } catch (e7) {}
    }
    try { if (window.dragonProdCardsOn()) { prodRelocateForMode(m); restoreProdCards(); } } catch (eR) {}
    try { if (window.dragonSortApply) window.dragonSortApply(); } catch (eS) {}
    try { if (window.dragonProdVisibilitySync) window.dragonProdVisibilitySync(); } catch (e8) {}
    paintViewToggle();
    try { var b = document.getElementById("dragonCpNativeBtn"); if (b) paintCpNativeBtn(b); } catch (e9) {}
  }
  window.dragonApplyViewMode = applyViewMode;
  ;function viewLabel(m) { return m === "default" ? "Default" : (m === "modern" ? "Modern" : (m === "custom" ? "Custom Monitor" : "Seperated")); }
  ;function paintViewToggle() {
    try {
      var m = viewModeCur();
      var bs = document.querySelectorAll("#dragonViewModeBtn, #dragonViewCpBtn");
      for (var i = 0; i < bs.length; i++) {
        bs[i].textContent = "🖼 Image Generation Monitor: " + viewLabel(m);
        try { bs[i].removeAttribute("aria-pressed"); } catch (eA) {}
      }
    } catch (e) {}
  }
  window.dragonViewMenuToggle = function () {
    var old = document.getElementById("dragonViewMenu");
    if (old) { try { old.remove(); } catch (eR) {} try { document.removeEventListener("pointerdown", window.__dragonViewMenuOut, true); } catch (eR2) {} window.__dragonViewMenuOut = null; try { var _ab = document.getElementById("dragonViewCpBtn"); if (_ab) _ab.setAttribute("aria-expanded", "false"); var _ab2 = document.getElementById("dragonViewModeBtn"); if (_ab2) _ab2.setAttribute("aria-expanded", "false"); } catch (eAB) {} return; }
    var btn = document.getElementById("dragonViewCpBtn");
    var cur = viewModeCur();
    var menu = document.createElement("div");
    menu.id = "dragonViewMenu";
    menu.className = "dragon-keep";
    menu.style.cssText = "position:fixed;z-index:999999;box-sizing:border-box;min-width:220px;max-width:min(92vw,320px);padding:.35rem;border:1px solid #c2333f;border-radius:10px;background:linear-gradient(180deg,#2a0c10,#170708);box-shadow:0 12px 34px rgba(0,0,0,.65);display:flex;flex-direction:column;gap:.25rem;";
    var opts = [
      ["default", "Default", "Original boxes + action buttons"],
      ["modern", "Modern", "Original boxes, finished image in our card"],
      ["seperated", "Seperated", "Small output row + finished cards"],
      ["custom", "Custom Monitor", "Your own mix…"]
    ];
    opts.forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button";
      var on = (cur === o[0]);
      b.style.cssText = "display:flex;align-items:center;gap:.5rem;width:100%;box-sizing:border-box;padding:.42rem .6rem;font-size:.78rem;font-weight:700;text-align:left;border-radius:8px;cursor:pointer;border:1px solid " + (on ? "#ffd4d4" : "#c2333f") + ";background:" + (on ? "linear-gradient(180deg,#7d1620,#4a0d13)" : "linear-gradient(180deg,#2a0c10,#1c0808)") + ";color:#ffd4d4;";
      var dot = document.createElement("span");
      dot.textContent = on ? "●" : "○";
      dot.style.cssText = "flex:0 0 auto;";
      var tx = document.createElement("span");
      tx.style.cssText = "flex:1 1 auto;";
      tx.appendChild(document.createTextNode(o[1]));
      var h = document.createElement("span");
      h.textContent = o[2];
      h.style.cssText = "display:block;font-weight:400;font-size:.66rem;opacity:.78;";
      tx.appendChild(h);
      b.append(dot, tx);
      b.addEventListener("click", function (e) {
        e.stopPropagation(); e.preventDefault();
        try { window.dragonViewMenuToggle(); } catch (eC) {}
        if (o[0] === "custom") { try { window.dragonViewCustomOpen(); } catch (eO) {} return; }
        try { window.dragonViewMode(o[0]); } catch (eS) {}
      });
      menu.appendChild(b);
    });
    try {
      var host = (btn && btn.parentElement) ? btn.parentElement : null;
      if (host && host !== document.body) {
        try { if (getComputedStyle(host).position === "static") host.style.position = "relative"; } catch (eH) {}
        var bw2 = btn.offsetWidth || 220;
        var w2 = Math.max(220, Math.min(bw2, 320));
        menu.style.position = "absolute";
        menu.style.width = w2 + "px";
        menu.style.left = Math.max(0, ((btn.offsetLeft || 0) + (bw2 - w2) / 2)) + "px";
        menu.style.top = ((btn.offsetTop || 0) + (btn.offsetHeight || 0) + 4) + "px";
        menu.style.transform = "";
        host.appendChild(menu);
      } else {
        var r = btn ? btn.getBoundingClientRect() : null;
        if (r && r.width > 0) {
          var w = Math.max(220, Math.min(r.width, 320));
          menu.style.width = w + "px";
          menu.style.left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8)) + "px";
          menu.style.top = (r.bottom + 4) + "px";
          menu.style.transform = "";
        } else {
          menu.style.left = "50%"; menu.style.top = "30%"; menu.style.transform = "translateX(-50%)";
        }
        document.body.appendChild(menu);
      }
    } catch (eP) { try { document.body.appendChild(menu); } catch (eP2) {} }
    try { var _ao = document.getElementById("dragonViewCpBtn"); if (_ao) _ao.setAttribute("aria-expanded", "true"); var _ao2 = document.getElementById("dragonViewModeBtn"); if (_ao2) _ao2.setAttribute("aria-expanded", "true"); } catch (eAO) {}
    window.__dragonViewMenuOut = function (e) {
      var m2 = document.getElementById("dragonViewMenu");
      if (!m2) return;
      var t = e && e.target;
      if (t && (t.closest("#dragonViewMenu") || t.closest("#dragonViewCpBtn"))) return;
      try { window.dragonViewMenuToggle(); } catch (eC2) {}
    };
    try { document.addEventListener("pointerdown", window.__dragonViewMenuOut, true); } catch (eL) {}
    try {
      if (!window.__dragonViewMenuEsc) {
        window.__dragonViewMenuEsc = true;
        document.addEventListener("keydown", function (e) { if (e && e.key === "Escape") { try { var m3 = document.getElementById("dragonViewMenu"); if (m3) window.dragonViewMenuToggle(); } catch (eE) {} } });
      }
    } catch (eK) {}
  };
  window.dragonViewCycle = function () {
    try { window.dragonViewMenuToggle(); } catch (e) {}
  };
  window.dragonSortNew = function (set) {
    if (set === "top" || set === "bottom") { try { localStorage.setItem("dragonSortNew", set); } catch (e) {} return set; }
    try { var v = localStorage.getItem("dragonSortNew"); if (v === "top" || v === "bottom") return v; } catch (e) {}
    return "bottom";
  };
  window.dragonSortProc = function (set) {
    if (set === "top" || set === "bottom") { try { localStorage.setItem("dragonSortProc", set); } catch (e) {} return set; }
    try { var v = localStorage.getItem("dragonSortProc"); if (v === "top" || v === "bottom") return v; } catch (e) {}
    return "top";
  };
  window.dragonSortMode = function (set) {
    if (set === "default" || set === "custom") { try { localStorage.setItem("dragonSortMode", set); } catch (e) {} return set; }
    try { var m = localStorage.getItem("dragonSortMode"); if (m === "default" || m === "custom") return m; } catch (e) {}
    return "default";
  };
  window.__dragonSeqN = window.__dragonSeqN || 0;
  ;function dragonSeqOf(el) {
    try {
      if (el.__dragonSeq == null) { window.__dragonSeqN++; el.__dragonSeq = window.__dragonSeqN; }
      return el.__dragonSeq;
    } catch (e) { return 0; }
  }
  window.dragonSeqOf = dragonSeqOf;
  ;function dragonCardInsertPos(row, seq) {
    try { if (window.dragonSortMode && window.dragonSortMode() === "default") return null; } catch (eM) {}
    try {
      var top = window.dragonSortNew() === "top";
      var cards = row.querySelectorAll(".dragon-prod-card");
      for (var i = 0; i < cards.length; i++) {
        var s = dragonSeqOf(cards[i]);
        if (top ? (s < seq) : (s > seq)) return cards[i];
      }
    } catch (e) {}
    return null;
  }
  ;function dragonSortCards(row) {
    try { if (window.dragonSortMode && window.dragonSortMode() === "default") return; } catch (eM) {}
    try {
      if (!row) return;
      var cards = row.querySelectorAll(".dragon-prod-card");
      if (cards.length < 2) return;
      var arr = [];
      for (var i = 0; i < cards.length; i++) { dragonSeqOf(cards[i]); arr.push(cards[i]); }
      var top = window.dragonSortNew() === "top";
      arr.sort(function (a, b) { return top ? (dragonSeqOf(b) - dragonSeqOf(a)) : (dragonSeqOf(a) - dragonSeqOf(b)); });
      var same = true;
      for (var j = 0; j < arr.length; j++) { if (cards[j] !== arr[j]) { same = false; break; } }
      if (!same) { for (var k = 0; k < arr.length; k++) { try { row.appendChild(arr[k]); } catch (e) {} } }
    } catch (e) {}
  }
  window.dragonSortApply = function () {
    var custom = true;
    try { custom = !window.dragonSortMode || window.dragonSortMode() === "custom"; } catch (eM) { custom = true; }
    if (custom) { try { dragonSortCards(document.getElementById("dragonProdRow")); } catch (e) {} }
    var procTop = true;
    try { procTop = custom ? window.dragonSortProc() !== "bottom" : true; } catch (e) {}
    try {
      var m = viewModeCur();
      if (m === "default" && !custom) return;
      if (m === "modern") {
        var oaM = document.getElementById("outputAreaEl");
        if (oaM) {
          var topM = false;
          try { topM = window.dragonSortNew() === "top"; } catch (eT) {}
          var units = [], seenM = [];
          for (var ci = 0; ci < oaM.children.length; ci++) {
            var ch = oaM.children[ci];
            if (!ch || !ch.classList) continue;
            if (ch.classList.contains("t2i-image-ctn")) {
              if (seenM.indexOf(ch) !== -1) continue;
              var cd = (ch.__dragonCard && ch.__dragonCard.isConnected) ? ch.__dragonCard : null;
              var sq = 0; try { sq = dragonSeqOf(ch); } catch (eSQ) {}
              units.push({ t: ch, card: cd, seq: sq });
              if (cd) seenM.push(cd);
            } else if (ch.classList.contains("dragon-prod-card")) {
              if (seenM.indexOf(ch) !== -1) continue;
              var sq2 = 0; try { sq2 = dragonSeqOf(ch); } catch (eSQ2) {}
              units.push({ t: null, card: ch, seq: sq2 });
            }
          }
          if (units.length > 1) {
            var finM = [], proM = [];
            for (var ui = 0; ui < units.length; ui++) {
              var doneU = !!units[ui].card;
              if (!doneU && units[ui].t) { try { var rr = window.dragonT2IRead(units[ui].t); doneU = !!(rr && rr.url); } catch (eRR) {} }
              (doneU ? finM : proM).push(units[ui]);
            }
            var byS = function (a, b) { return topM ? (b.seq - a.seq) : (a.seq - b.seq); };
            finM.sort(byS); proM.sort(byS);
            var wantM = procTop ? proM.concat(finM) : finM.concat(proM);
            for (var qi = 0; qi < wantM.length; qi++) {
              try { if (wantM[qi].t) oaM.appendChild(wantM[qi].t); } catch (eA) {}
              try { if (wantM[qi].card) oaM.appendChild(wantM[qi].card); } catch (eB) {}
            }
          }
        }
        return;
      }
      if (m === "default") {
        var oa = document.getElementById("outputAreaEl");
        if (oa) {
          var tiles = [];
          for (var i = 0; i < oa.children.length; i++) {
            var c = oa.children[i];
            if (c && c.classList && c.classList.contains("t2i-image-ctn")) { dragonSeqOf(c); tiles.push(c); }
          }
          if (tiles.length > 1) {
            var top = window.dragonSortNew() === "top";
            var fin = [], pro = [];
            for (var j = 0; j < tiles.length; j++) {
              var r = null;
              try { r = window.dragonT2IRead(tiles[j]); } catch (e) {}
              if (r && r.url) fin.push(tiles[j]); else pro.push(tiles[j]);
            }
            fin.sort(function (a, b) { return top ? (dragonSeqOf(b) - dragonSeqOf(a)) : (dragonSeqOf(a) - dragonSeqOf(b)); });
            var want = procTop ? pro.concat(fin) : fin.concat(pro);
            var same = want.length === tiles.length;
            if (same) { for (var k = 0; k < want.length; k++) { if (tiles[k] !== want[k]) { same = false; break; } } }
            if (!same) { for (var q = 0; q < want.length; q++) { try { oa.appendChild(want[q]); } catch (e) {} } }
          }
        }
        return;
      }
      var proc = document.getElementById("dragonProcessPanel"), prod = document.getElementById("dragonProductionPanel");
      if (proc && prod && proc.parentElement && proc.parentElement === prod.parentElement) {
        try {
          if (procTop) { if (proc.nextElementSibling !== prod || prod.previousElementSibling !== proc) proc.parentElement.insertBefore(proc, prod); }
          else if (prod.nextElementSibling !== proc || proc.previousElementSibling !== prod) proc.parentElement.insertBefore(prod, proc);
        } catch (e) {}
      }
      var oa2 = document.getElementById("outputAreaEl"), prow = document.getElementById("dragonProdRow");
      if (oa2 && prow && oa2.parentElement && oa2.parentElement === prow.parentElement) {
        try {
          if (procTop) { if (oa2.nextElementSibling !== prow) oa2.parentElement.insertBefore(oa2, prow); }
          else if (prow.nextElementSibling !== oa2) oa2.parentElement.insertBefore(prow, oa2);
        } catch (e) {}
      }
    } catch (e) {}
  };
  window.dragonSortMenuToggle = function () {
    var old = document.getElementById("dragonSortMenu");
    if (old) { try { old.remove(); } catch (eR) {} try { document.removeEventListener("pointerdown", window.__dragonSortMenuOut, true); } catch (eR2) {} window.__dragonSortMenuOut = null; return; }
    var btn = document.getElementById("dragonSortBtn");
    var menu = document.createElement("div");
    menu.id = "dragonSortMenu";
    menu.className = "dragon-keep";
    menu.style.cssText = "position:fixed;z-index:999999;box-sizing:border-box;min-width:220px;max-width:min(92vw,320px);padding:.35rem;border:1px solid #c2333f;border-radius:10px;background:linear-gradient(180deg,#2a0c10,#170708);box-shadow:0 12px 34px rgba(0,0,0,.65);display:flex;flex-direction:column;gap:.25rem;";
    var sortMode = "default";
    try { sortMode = window.dragonSortMode ? window.dragonSortMode() : "default"; } catch (eM) {}
    if (sortMode !== "custom") sortMode = "default";
    var rows = [
      ["dflt", "", "Default order"],
      ["sep", "", ""],
      ["new", "top", "New images on top"],
      ["new", "bottom", "New images on bottom"],
      ["sep", "", ""],
      ["proc", "top", "Processing images on top"],
      ["proc", "bottom", "Processing images on bottom"]
    ];
    rows.forEach(function (o) {
      if (o[0] === "sep") {
        var hr = document.createElement("div");
        hr.style.cssText = "border-top:1px solid #c2333f;margin:.15rem .4rem;opacity:.7;";
        menu.appendChild(hr);
        return;
      }
      var isDflt = (o[0] === "dflt");
      var cur = isDflt ? sortMode : (o[0] === "new" ? window.dragonSortNew() : window.dragonSortProc());
      var b = document.createElement("button");
      b.type = "button";
      var on = isDflt ? (sortMode === "default") : (sortMode === "custom" && cur === o[1]);
      var off = isDflt ? (sortMode !== "default") : (sortMode === "default");
      b.style.cssText = "display:flex;align-items:center;gap:.5rem;width:100%;box-sizing:border-box;padding:.42rem .6rem;font-size:.78rem;font-weight:700;text-align:left;border-radius:8px;cursor:pointer;border:1px solid " + (on ? "#ffd4d4" : (off ? "#7a6a6d" : "#c2333f")) + ";background:" + (on ? "linear-gradient(180deg,#7d1620,#4a0d13)" : (off ? "linear-gradient(180deg,#241a1c,#171114)" : "linear-gradient(180deg,#2a0c10,#1c0808)")) + ";color:" + (off ? "#a89a9d" : "#ffd4d4") + ";";
      var dot = document.createElement("span");
      dot.textContent = on ? "●" : "○";
      dot.style.cssText = "flex:0 0 auto;";
      var tx = document.createElement("span");
      tx.style.cssText = "flex:1 1 auto;";
      tx.textContent = o[2];
      b.append(dot, tx);
      b.addEventListener("click", function (e) {
        e.stopPropagation(); e.preventDefault();
        try {
          if (isDflt) window.dragonSortMode("default");
          else { if (o[0] === "new") window.dragonSortNew(o[1]); else window.dragonSortProc(o[1]); window.dragonSortMode("custom"); }
        } catch (eS) {}
        try { window.dragonSortApply(); } catch (eA) {}
        try { window.dragonSortMenuToggle(); window.dragonSortMenuToggle(); } catch (eR) {}
      });
      menu.appendChild(b);
    });
    try {
      var host = (btn && btn.parentElement) ? btn.parentElement : null;
      if (host && host !== document.body) {
        try { if (getComputedStyle(host).position === "static") host.style.position = "relative"; } catch (eH) {}
        var bw = btn.offsetWidth || 220;
        var sw = Math.max(220, Math.min(bw, 320));
        menu.style.position = "absolute";
        menu.style.width = sw + "px";
        menu.style.left = Math.max(0, ((btn.offsetLeft || 0) + (bw - sw) / 2)) + "px";
        menu.style.top = ((btn.offsetTop || 0) + (btn.offsetHeight || 0) + 4) + "px";
        menu.style.transform = "";
        host.appendChild(menu);
      } else {
        var r = btn ? btn.getBoundingClientRect() : null;
        if (r && r.width > 0) {
          var w = Math.max(220, Math.min(r.width, 320));
          menu.style.width = w + "px";
          var top = r.bottom + 4;
          if (top + 220 > window.innerHeight) top = Math.max(8, r.top - 224);
          var cx = r.left + r.width / 2 - w / 2;
          menu.style.left = Math.max(8, Math.min(cx, window.innerWidth - w - 8)) + "px";
          menu.style.top = top + "px";
        } else {
          menu.style.left = "50%"; menu.style.top = "30%"; menu.style.transform = "translateX(-50%)";
        }
        document.body.appendChild(menu);
      }
    } catch (eP) { try { document.body.appendChild(menu); } catch (eP2) {} }
    window.__dragonSortMenuOut = function (e) {
      var m2 = document.getElementById("dragonSortMenu");
      if (!m2) return;
      var tg = e && e.target;
      if (tg && (tg.closest("#dragonSortMenu") || tg.closest("#dragonSortBtn"))) return;
      try { window.dragonSortMenuToggle(); } catch (eC2) {}
    };
    try { document.addEventListener("pointerdown", window.__dragonSortMenuOut, true); } catch (eL) {}
  };
  ;function ensureViewToggle() {
    try {
      var old = document.getElementById("dragonViewModeBtn");
      if (old && old.closest && old.closest(".dragon-set-card")) {
        var w = old.parentElement;
        try { old.remove(); } catch (eR) {}
        try { if (w && w.classList && w.classList.contains("dragon-set-row") && !w.children.length) w.remove(); } catch (eR2) {}
      }
    } catch (e) {}
    try { if (window.dragonViewCpEnsure) window.dragonViewCpEnsure(); } catch (e2) {}
    paintViewToggle();
  }
  window.dragonViewCpEnsure = function () {
    var body = null;
    try {
      var cp = document.querySelector(".dragon-control-panel .dragon-control-body");
      if (cp) body = cp;
    } catch (e) {}
    if (!body) return false;
    var btn = document.getElementById("dragonViewCpBtn");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.id = "dragonViewCpBtn";
      btn.className = "dragon-keep";
      btn.title = "Image Generation Monitor — the generated-image look: Default (original boxes + action buttons) / Modern (tiles and cards in one box) / Seperated (output row + finished cards) / Custom Monitor (your own mix)";
      btn.setAttribute("aria-label", "Image Generation Monitor: switch the generated-image look");
      btn.setAttribute("aria-haspopup", "menu");
      btn.setAttribute("aria-expanded", "false");
      btn.style.cssText = "width:100%; max-width:100%; box-sizing:border-box; padding:.24rem .6rem; font-size:.76rem; font-weight:bold; border:1px solid #c2333f; background:linear-gradient(180deg,#2a0c10,#7d1620); color:#ffd4d4; border-radius:7px; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:.15rem;";
      btn.addEventListener("click", function (e) { e.stopPropagation(); try { window.dragonViewMenuToggle(); } catch (er) {} });
      try { if (window.dragonSortBtnEnsure) window.dragonSortBtnEnsure(); } catch (eSB) {}
      try {
        var r2 = body.querySelector(".dragon-row2");
        if (r2 && r2.nextSibling) body.insertBefore(btn, r2.nextSibling);
        else body.appendChild(btn);
      } catch (e3) { try { body.appendChild(btn); } catch (e4) { return false; } }
    } else if (!btn.isConnected) {
      try {
        var r2b = body.querySelector(".dragon-row2");
        if (r2b && r2b.nextSibling) body.insertBefore(btn, r2b.nextSibling);
        else body.appendChild(btn);
      } catch (e5) {}
    }
    try {
      if (btn && !btn.__dragonRedMenu) {
        btn.__dragonRedMenu = true;
        btn.style.setProperty("border", "1px solid #c2333f", "important");
        btn.style.setProperty("background", "linear-gradient(180deg,#2a0c10,#7d1620)", "important");
        btn.style.setProperty("color", "#ffd4d4", "important");
      }
    } catch (e6) {}
    paintViewToggle();
    return true;
  };

  // ════════════════════ IMAGE SORT BUTTON ════════════════════
  window.dragonSortBtnEnsure = function () {
    try {
      var body = document.querySelector(".dragon-control-panel .dragon-control-body");
      if (!body) return false;
      var vbtn = document.getElementById("dragonViewCpBtn");
      if (!vbtn || !vbtn.isConnected) return false;
      var sbtn = document.getElementById("dragonSortBtn");
      if (!sbtn) {
        sbtn = document.createElement("button");
        sbtn.type = "button";
        sbtn.id = "dragonSortBtn";
        sbtn.className = "dragon-keep";
        sbtn.textContent = "\u2195 Image Sort";
        sbtn.title = "Image Sort — new and processing image order (applies to Default and Modern; in Seperated it also swaps the panels)";
        sbtn.setAttribute("aria-label", "Image Sort: new and processing image order");
        sbtn.style.cssText = "width:100%; max-width:100%; box-sizing:border-box; padding:.24rem .6rem; font-size:.76rem; font-weight:bold; border:1px solid #c2333f; background:linear-gradient(180deg,#2a0c10,#7d1620); color:#ffd4d4; border-radius:7px; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:.15rem;";
        sbtn.addEventListener("click", function (e) { e.stopPropagation(); try { window.dragonSortMenuToggle(); } catch (er) {} });
      }
      if (sbtn.parentElement !== body || sbtn.previousElementSibling !== vbtn) {
        try { if (vbtn.nextSibling) body.insertBefore(sbtn, vbtn.nextSibling); else body.appendChild(sbtn); } catch (e) {}
      }
      return true;
    } catch (e) { return false; }
  };

  // CUSTOM MONITOR POPUP (Egon 28.09.2026 (W-UI361): was "Custom View") ════════════════════
  window.dragonViewCustomOpen = function () {
    var prev = viewModeCur();
    var draft = window.dragonViewCustomGet();
    var hasSaved = false;
    try { hasSaved = !!localStorage.getItem("dragonViewCustom"); } catch (eS) {}
    if (!hasSaved) {
      if (prev === "modern") draft = { layout: "panels", process: true, product: false, out: "display", cardsIn: "process", btns: "on" };
      else if (prev === "default") draft = { layout: "default", process: false, product: false, out: "native", cardsIn: "process", btns: "under" };
      else if (prev === "seperated") draft = { layout: "panels", process: true, product: true, out: "small", cardsIn: "product", btns: "on" };
    }
    if (!draft.layout) draft.layout = (prev === "default") ? "default" : "panels";
    var step = 0;
    var ov = document.createElement("div");
    ov.className = "dragon-keep";
    ov.style.cssText = "position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;background:rgba(5,5,10,.72);padding:.8rem;box-sizing:border-box;";
    var card = document.createElement("div");
    card.style.cssText = "width:100%;max-width:430px;max-height:92vh;overflow-y:auto;box-sizing:border-box;padding:.7rem .8rem .8rem;border:1px solid rgba(155,107,255,.45);border-radius:14px;background:linear-gradient(180deg,#14141b,#0d0d12);color:#e8e1ff;font-size:.8rem;";
    ov.appendChild(card);
    var title = document.createElement("div");
    title.style.cssText = "text-align:center;font-weight:800;font-size:.9rem;margin-bottom:.15rem;";
    title.textContent = "🖼 Custom Monitor";
    var dots = document.createElement("div");
    dots.style.cssText = "text-align:center;font-size:.7rem;letter-spacing:.3em;color:#9b8fd0;margin-bottom:.5rem;";
    var q = document.createElement("div");
    q.style.cssText = "text-align:center;font-weight:700;color:#c9b8ff;margin-bottom:.45rem;min-height:1.2em;";
    var cbody = document.createElement("div");
    cbody.style.cssText = "display:flex;flex-direction:column;gap:.4rem;align-items:stretch;";
    var nav = document.createElement("div");
    nav.style.cssText = "display:flex;gap:.4rem;justify-content:space-between;margin-top:.6rem;";
    var backB = document.createElement("button");
    backB.type = "button"; backB.textContent = "Back";
    var nextB = document.createElement("button");
    nextB.type = "button"; nextB.textContent = "Next";
    var saveB = document.createElement("button");
    saveB.type = "button"; saveB.textContent = "Save";
    var cancelB = document.createElement("button");
    cancelB.type = "button"; cancelB.textContent = "Cancel";
    [backB, nextB, saveB, cancelB].forEach(function (b) {
      b.style.cssText = "flex:1 1 0;padding:.4rem .5rem;font-size:.76rem;font-weight:bold;border:1px solid #5a789a;background:linear-gradient(180deg,#1a2632,#2c3f52);color:#cfe3ff;border-radius:7px;cursor:pointer;white-space:nowrap;";
    });
    saveB.style.borderColor = "#3ddc84";
    nav.append(backB, cancelB, nextB, saveB);
    card.append(title, dots, q, cbody, nav);
    ;function cOpt(label, hint, on, fn) {
      var b = document.createElement("button");
      b.type = "button";
      b.style.cssText = "display:flex;align-items:center;gap:.5rem;width:100%;box-sizing:border-box;padding:.42rem .6rem;font-size:.78rem;font-weight:700;text-align:left;border-radius:9px;cursor:pointer;border:1px solid " + (on ? "#3ddc84" : "#5a789a") + ";background:" + (on ? "linear-gradient(180deg,#0f2b1c,#1e5a38)" : "linear-gradient(180deg,#1a2632,#2c3f52)") + ";color:" + (on ? "#dfffe9" : "#cfe3ff") + ";";
      var box = document.createElement("span");
      box.textContent = on ? "☑" : "☐";
      box.style.cssText = "flex:0 0 auto;font-size:.95rem;";
      var tx = document.createElement("span");
      tx.style.cssText = "flex:1 1 auto;";
      tx.appendChild(document.createTextNode(label));
      if (hint) {
        var h = document.createElement("span");
        h.textContent = hint;
        h.style.cssText = "display:block;font-weight:400;font-size:.68rem;opacity:.75;";
        tx.appendChild(h);
      }
      b.append(box, tx);
      b.addEventListener("click", function (e) { e.stopPropagation(); fn(); render(); });
      return b;
    }
    ;function cSeg(options, cur, fn) {
      var w = document.createElement("div");
      w.style.cssText = "display:flex;flex-direction:column;gap:.35rem;";
      options.forEach(function (o) {
        w.appendChild(cOpt((o[0] === cur ? "● " : "○ ") + o[1], o[2], o[0] === cur, function () { fn(o[0]); }));
      });
      return w;
    }
    ;function cDrop(options, cur, fn) {
      var s = document.createElement("select");
      if (window.dragonStyleSelect) window.dragonStyleSelect(s);
      s.style.cssText = "width:100%;box-sizing:border-box;padding:.42rem .6rem;font-size:.78rem;font-weight:700;border-radius:9px;border:1px solid #5a789a;background:#1a2632;color:#cfe3ff;cursor:pointer;";
      options.forEach(function (o) {
        var op = document.createElement("option");
        op.value = o[0]; op.textContent = o[1];
        if (o[0] === cur) op.selected = true;
        s.appendChild(op);
      });
      s.addEventListener("change", function () { fn(s.value); render(); });
      return s;
    }
    ;function close() { try { ov.remove(); } catch (e) {} try { document.removeEventListener("keydown", onKey); } catch (e2) {} }
    ;function onKey(e) { if (e && e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    backB.addEventListener("click", function () { if (step > 0) { step--; render(); } });
    nextB.addEventListener("click", function () { if (step < 2) { step++; render(); } });
    cancelB.addEventListener("click", function () { close(); });
    saveB.addEventListener("click", function () {
      // Egon 28.09.2026 (W-UI361): the Default Panel choice needs no panel at all — it IS the
      // original boxes with nothing of ours. Any other mix still needs at least one panel.
      if (draft.layout !== "default" && !draft.process && !draft.product) { try { if (window.dragonToast) window.dragonToast("Keep at least one panel on"); } catch (e) {} return; }
      if (draft.cardsIn === "product" && !draft.product) draft.cardsIn = "process";
      if (draft.cardsIn === "process" && !draft.process) draft.cardsIn = "product";
      window.dragonViewCustomSet(draft);
      close();
      window.dragonViewMode("custom");
    });
    ;function render() {
      dots.textContent = ("●".repeat(step + 1) + "○".repeat(2 - step)).split("").join(" ");
      cbody.innerHTML = "";
      backB.style.visibility = step === 0 ? "hidden" : "visible";
      nextB.style.display = step === 2 ? "none" : "";
      saveB.style.display = step === 2 ? "" : "none";
      if (step === 0) {
        q.textContent = "Step 1 of 3 — Which panels stay on the page?";
        // Egon 28.09.2026 (W-UI361): the 3rd choice — Default Panel — drops the whole Process/
        // Product distinction: original boxes, nothing of ours. It is exclusive with the panels.
        cbody.appendChild(cOpt("Process Panel", "The output boxes while generating", draft.process && draft.layout !== "default", function () {
          draft.process = !draft.process; if (draft.process) draft.layout = "panels";
        }));
        cbody.appendChild(cOpt("Product Panel", "The finished-image cards", draft.product && draft.layout !== "default", function () {
          draft.product = !draft.product; if (draft.product) draft.layout = "panels";
        }));
        cbody.appendChild(cOpt("Default Panel", "Original boxes only — no extras of ours", draft.layout === "default", function () {
          if (draft.layout === "default") { draft.layout = "panels"; draft.process = true; }
          else { draft.layout = "default"; draft.process = false; draft.product = false; draft.out = "native"; draft.btns = "under"; draft.cardsIn = "process"; }
        }));
      } else if (step === 1) {
        if (draft.layout === "default") {
          q.textContent = "Step 2 of 3 — Default Panel needs nothing here";
          var dn = document.createElement("div");
          dn.style.cssText = "text-align:center;color:#c9b8ff;font-size:.76rem;line-height:1.5;padding:.4rem .2rem;";
          dn.textContent = "The Default Panel is the original boxes, exactly as perchance draws them. There is nothing to size — press Next.";
          cbody.appendChild(dn);
        } else {
        q.textContent = "Step 2 of 3 — How big are the output tiles?";
        cbody.appendChild(cSeg([
          ["small", "Small row", "Compact 180px row, like Seperated"],
          ["display", "Display size", "Tiles at your Display setting size"],
          ["native", "Native boxes", "Original boxes, full action row below"]
        ], draft.out, function (v) {
          draft.out = v;
          // smart: native boxes carry their own full row, so on-image buttons make no sense there.
          if (v === "native" && draft.btns !== "under") draft.btns = "under";
        }));
        }
      } else {
        if (draft.layout === "default") {
          q.textContent = "Step 3 of 3 — Default Panel needs nothing here";
          var dn2 = document.createElement("div");
          dn2.style.cssText = "text-align:center;color:#c9b8ff;font-size:.76rem;line-height:1.5;padding:.4rem .2rem;";
          dn2.textContent = "No finished cards, no extra buttons — press Save to use the original boxes.";
          cbody.appendChild(dn2);
        } else {
        q.textContent = "Step 3 of 3 — Where do the finished cards live?";
        var locOpts = [];
        if (draft.process) locOpts.push(["process", "In the Process panel"]);
        if (draft.product) locOpts.push(["product", "In the Product panel"]);
        if (!locOpts.length) locOpts.push(["process", "In the Process panel"]);
        if (locOpts.length === 1) draft.cardsIn = locOpts[0][0];
        cbody.appendChild(cDrop(locOpts, draft.cardsIn, function (v) { draft.cardsIn = v; }));
        var bl = document.createElement("div");
        bl.style.cssText = "text-align:center;font-weight:700;color:#c9b8ff;margin-top:.25rem;";
        bl.textContent = "Buttons on the finished cards:";
        cbody.appendChild(bl);
        cbody.appendChild(cSeg([
          ["on", "On the image", "Round buttons over the picture"],
          ["under", "Under the image", "A button row below the picture"],
          ["both", "Both", "Over the picture and below it"]
        ], draft.btns, function (v) { draft.btns = v; }));
        }
      }
    }
    render();
    document.body.appendChild(ov);
  };

  // ════════════════════ IMAGE GENERATION MONITOR (invisible twin parent) ════════════════════
  // ONE node shared by the Generate and Character pages (the mode store in localStorage is
  // already global, so both pages always render the same mode). It carries the Process and
  // Production panels and sits between the Prompt Panel and Image History, with no chrome of
  // its own — invisible, only an ordering guarantee. The history panels stay OUTSIDE it: the
  // history is a record surface fed by both pages and must not depend on a display mode.
  ;function dragonMonitorEnsure() {
    ensureCss();
    var row = document.querySelector(".dragon-gen-row");
    var mon = document.getElementById("dragonMonitorPanel");
    if (!mon) {
      mon = document.createElement("div");
      mon.id = "dragonMonitorPanel";
      mon.className = "dragon-keep";
      mon.setAttribute("aria-label", "Image Generation Monitor");
    }
    if (row && mon.parentElement !== row) { try { row.appendChild(mon); } catch (e) { return null; } }
    if (!mon.parentElement) return null;
    var proc = document.getElementById("dragonProcessPanel");
    var prod = document.getElementById("dragonProductionPanel");
    if (proc && proc.parentElement !== mon) { try { mon.appendChild(proc); } catch (e2) {} }
    if (prod) {
      try {
        if (proc && proc.parentElement === mon) { if (prod.previousElementSibling !== proc) mon.insertBefore(prod, proc.nextSibling); }
        else if (prod.parentElement !== mon) mon.appendChild(prod);
      } catch (e3) {}
    }
    try {
      var host = mon.parentElement;
      var hh = document.getElementById("dragonImageHistHead");
      if (host && hh && hh.parentElement === host && mon.nextSibling !== hh) host.insertBefore(mon, hh);
    } catch (e4) {}
    return mon;
  }
  window.dragonMonitorEnsure = dragonMonitorEnsure;

  // ════════════════════ PROCESS PANEL ════════════════════
  window.dragonProcessOpen = function (set) {
    if (set !== undefined) { try { localStorage.setItem("dragonProcessOpen", set ? "1" : "0"); } catch (e) {} }
    try { return localStorage.getItem("dragonProcessOpen") !== "0"; } catch (e2) { return true; }
  };
  window.dragonProcessToggle = function (open) {
    var panel = dragonProcessPanelEnsure();
    if (!panel) return false;
    var want = (open == null) ? !window.dragonProcessOpen() : !!open;
    window.dragonProcessOpen(want);
    dragonProcessPaint();
    return want;
  };
  ;function dragonProcessPaint() {
    var panel = document.getElementById("dragonProcessPanel");
    if (!panel) return;
    var open = window.dragonProcessOpen();
    var body = panel.querySelector("#dragonProcessBody");
    if (body) body.hidden = !open;
    var ars = panel.__arrows || [];
    for (var i = 0; i < ars.length; i++) ars[i].textContent = open ? "\u25B4" : "\u25BE";
    var head = panel.querySelector("#dragonProcessHead");
    if (head) head.setAttribute("aria-expanded", open ? "true" : "false");
    try { if (window.dragonSyncOpenCards) window.dragonSyncOpenCards(); } catch (eS) {}
  }
  ;function genBtnKill() {
    try {
      var gb = document.getElementById("generateButtonEl");
      if (gb && !gb.__dragonProcNeutral) {
        gb.__dragonProcNeutral = true;
        try { gb.removeAttribute("onclick"); gb.onclick = function (e) { try { e.preventDefault(); } catch (e2) {} window.dragonProcessToggle(); }; gb.style.display = "none"; } catch (e3) {}
      }
    } catch (e) {}
  }
  ;function dragonProcessPanelEnsure() {
    ensureCss();
    var row = document.querySelector(".dragon-gen-row");
    if (!row) return null;
    var panel = document.getElementById("dragonProcessPanel");
    if (!panel || !panel.isConnected) {
      if (panel && !panel.isConnected) { try { panel.remove(); } catch (e) {} panel = null; }
      panel = document.createElement("div");
      panel.id = "dragonProcessPanel";
      panel.className = "dragon-keep";
      var head = document.createElement("button");
      head.type = "button"; head.id = "dragonProcessHead"; head.className = "dragon-keep";
      head.title = "Process Panel \u2014 the output boxes (click to show or hide)";
      var mk = function (t) { var s = document.createElement("span"); s.textContent = t; return s; };
      var i1 = mk("\uD83D\uDCBB\uFE0F"), a1 = mk("\u25BE"), lb = mk("Process Panel"), a2 = mk("\u25BE"), i2 = mk("\uD83D\uDCBB\uFE0F");
      a1.style.cssText = a2.style.cssText = "font-size:1.1rem;line-height:1;";
      head.append(i1, a1, lb, a2, i2);
      head.addEventListener("click", function () { window.dragonProcessToggle(); });
      var body = document.createElement("div");
      body.id = "dragonProcessBody"; body.className = "dragon-keep";
      panel.append(head, body);
      panel.__arrows = [a1, a2];
      try { panel.hidden = true; } catch (eH) {}
      try { var _monP = dragonMonitorEnsure() || row; _monP.appendChild(panel); } catch (e2) { return null; }
    }
    genBtnKill();
    var body2 = panel.querySelector("#dragonProcessBody");
    try {
      var _empty = document.getElementById("dragonProcessEmpty");
      if (!_empty) {
        _empty = document.createElement("div");
        _empty.id = "dragonProcessEmpty";
        _empty.className = "dragon-keep";
        _empty.textContent = "Generate some images to see their process.";
        _empty.style.cssText = "text-align:center;color:#8a8a9a;font-size:.82rem;padding:1.1rem .5rem;";
      }
      var _oa2 = document.getElementById("outputAreaEl");
      var _has = false;
      try { _has = !!(_oa2 && _oa2.querySelector(".t2i-image-ctn")); } catch (eE) {}
      if (!_has && _empty.parentElement !== body2) { try { body2.appendChild(_empty); } catch (eE2) {} }
      if (_has && _empty.parentElement) { try { _empty.remove(); } catch (eE3) {} }
    } catch (eE4) {}
    var oa = document.getElementById("outputAreaEl");
    if (oa && body2 && oa.parentElement !== body2) { try { body2.insertBefore(oa, body2.firstChild); } catch (e4) {} }
    try { ensureCpNativeBtn(); } catch (e5) {}
    var nb = document.getElementById("dragonCpNativeBtn");
    if (nb && !nb.classList.contains("dragon-proc-mini")) { try { nb.classList.add("dragon-proc-mini"); } catch (e6) {} }
    dragonProcessPaint();
    return panel;
  }
  window.dragonProcessPanelEnsure = dragonProcessPanelEnsure;

  // ════════════════════ PRODUCTION PANEL ════════════════════
  // The finished-image cards (#dragonProdRow) live inside this panel's body, between the
  // Process Panel and Image History. Same head geometry as every other panel; the head
  // never changes shape, only its arrows flip. The whole panel hides while no visual
  // production is at stake (see prodVisibilitySync).
  window.dragonProductionOpen = function (set) {
    if (set !== undefined) { try { localStorage.setItem("dragonProductionOpen", set ? "1" : "0"); } catch (e) {} }
    try { return localStorage.getItem("dragonProductionOpen") !== "0"; } catch (e2) { return true; }
  };
  window.dragonProductionToggle = function (open) {
    var panel = dragonProductionEnsure();
    if (!panel) return false;
    var want = (open == null) ? !window.dragonProductionOpen() : !!open;
    window.dragonProductionOpen(want);
    dragonProductionPaint();
    return want;
  };
  ;function dragonProductionPaint() {
    var panel = document.getElementById("dragonProductionPanel");
    if (!panel) return;
    var open = window.dragonProductionOpen();
    var body = panel.querySelector("#dragonProductionBody");
    if (body) body.hidden = !open;
    var ars = panel.__arrows || [];
    for (var i = 0; i < ars.length; i++) ars[i].textContent = open ? "\u25B4" : "\u25BE";
    var head = panel.querySelector("#dragonProductionHead");
    if (head) head.setAttribute("aria-expanded", open ? "true" : "false");
    try { if (window.dragonSyncOpenCards) window.dragonSyncOpenCards(); } catch (eS) {}
  }
  ;function dragonProductionEnsure() {
    ensureCss();
    var row = document.querySelector(".dragon-gen-row");
    if (!row) return null;
    var panel = document.getElementById("dragonProductionPanel");
    if (!panel || !panel.isConnected) {
      if (panel && !panel.isConnected) { try { panel.remove(); } catch (e) {} panel = null; }
      panel = document.createElement("div");
      panel.id = "dragonProductionPanel";
      panel.className = "dragon-keep";
      var head = document.createElement("button");
      head.type = "button"; head.id = "dragonProductionHead"; head.className = "dragon-keep";
      head.title = "Production Panel \u2014 your finished images (click to show or hide)";
      var mk = function (t) { var s = document.createElement("span"); s.textContent = t; return s; };
      var i1 = mk("\uD83C\uDFED"), a1 = mk("\u25BE"), lb = mk("Production Panel"), a2 = mk("\u25BE"), i2 = mk("\uD83C\uDFED");
      a1.style.cssText = a2.style.cssText = "font-size:1.1rem;line-height:1;";
      head.append(i1, a1, lb, a2, i2);
      head.addEventListener("click", function () { window.dragonProductionToggle(); });
      var body = document.createElement("div");
      body.id = "dragonProductionBody"; body.className = "dragon-keep";
      var prow = document.getElementById("dragonProdRow");
      if (prow) { try { body.appendChild(prow); } catch (eB) {} }
      panel.append(head, body);
      panel.__arrows = [a1, a2];
      try { panel.hidden = true; } catch (eH) {}
    }
    var mon0 = null;
    try { mon0 = dragonMonitorEnsure() || row; } catch (eM0) { mon0 = row; }
    var proc = document.getElementById("dragonProcessPanel");
    if (proc && mon0 && proc.parentElement === mon0) {
      if (panel.previousElementSibling !== proc) { try { mon0.insertBefore(panel, proc.nextSibling); } catch (e2) {} }
    } else if (!panel.isConnected) {
      try { (mon0 || row).appendChild(panel); } catch (e3) {}
    }
    try {
      var pbody = panel.querySelector("#dragonProductionBody");
      var prow2 = document.getElementById("dragonProdRow");
      var hasCards = !!(prow2 && prow2.querySelector(".dragon-prod-card"));
      var note = document.getElementById("dragonProductionEmpty");
      if (!hasCards) {
        if (!note) {
          note = document.createElement("div");
          note.id = "dragonProductionEmpty";
          note.className = "dragon-keep";
          note.textContent = "Finished images appear here as they complete.";
        }
        if (pbody && note.parentElement !== pbody) { try { pbody.appendChild(note); } catch (eN) {} }
      } else if (note && note.parentElement) { try { note.remove(); } catch (eN2) {} }
    } catch (eE) {}
    dragonProductionPaint();
    return panel;
  }
  window.dragonProductionPanelEnsure = dragonProductionEnsure;

  // Process + Production show only while visual production is at stake: live tiles that have
  // not swapped yet, a tile being refreshed, or any busy spinner on the page keep the Process
  // Panel up; finished cards keep the Production Panel up. Otherwise both roots hide.
  ;function prodViewCardsInProduct() {
    try {
      var m = window.dragonViewMode ? window.dragonViewMode() : "seperated";
      if (m === "seperated") return true;
      if (m === "custom") { var c = window.dragonViewCustomGet ? window.dragonViewCustomGet() : null; return !!(c && c.product && c.cardsIn === "product"); }
    } catch (e) {}
    return false;
  }
  ;function prodHasCards() {
    try {
      var inl = null;
      try { inl = document.querySelectorAll("#outputAreaEl .dragon-prod-card"); } catch (eI) {}
      for (var k = 0; k < (inl ? inl.length : 0); k++) {
        try { if (inl[k].isConnected && getComputedStyle(inl[k]).display !== "none") return true; } catch (eV) {}
      }
      var r = document.getElementById("dragonProdRow");
      if (!r || !r.isConnected) return false;
      var cs = null; try { cs = getComputedStyle(r).display; } catch (eC) {}
      if (cs === "none") return false;
      return !!r.querySelector(".dragon-prod-card");
    } catch (e) { return false; }
  }
  ;function prodHasLiveWork() {
    try {
      if (document.querySelector(".dragon-imgov-busy")) return true;
      var oa = document.getElementById("outputAreaEl");
      if (!oa) return false;
      var ts = oa.querySelectorAll(".t2i-image-ctn");
      for (var i = 0; i < ts.length; i++) {
        var t = ts[i];
        if (!t || !t.isConnected) continue;
        if (t.__dragonRefreshing) return true;
        if (!t.__dragonSwapped) return true;
      }
    } catch (e) {}
    return false;
  }
  var __dragonPvCalmProc = 3, __dragonPvCalmProd = 3;
  ;function prodVisibilitySync() {
    try {
      var live = prodHasLiveWork();
      try { if (!live && window.__dragonProdForceAt && (Date.now() - window.__dragonProdForceAt < 6000)) live = true; } catch (eG) {}
      var cards = prodHasCards();
      var m = "seperated";
      try { if (window.dragonViewMode) m = window.dragonViewMode(); } catch (eM) {}
      var showProc = live, showProd = false;
      if (m === "seperated") { showProc = live; showProd = cards || live; }
      else if (m === "modern") { showProc = live || cards; showProd = false; }
      else if (m === "default") { showProc = live; showProd = false; }
      else if (m === "custom") {
        var c = null;
        try { c = window.dragonViewCustomGet ? window.dragonViewCustomGet() : null; } catch (eC) {}
        if (!c) { showProc = live; showProd = cards || live; }
        else {
          var cardsInProc = (c.cardsIn !== "product") || !c.product;
          showProc = !!c.process && (live || (cardsInProc && cards));
          showProd = !!c.product && (cards || (live && c.cardsIn === "product"));
          if (!c.process && !c.product) { showProc = live || cards; showProd = false; }
        }
      }
      var proc = document.getElementById("dragonProcessPanel");
      if (showProc) { __dragonPvCalmProc = 0; if (proc) proc.hidden = false; }
      else if (++__dragonPvCalmProc >= 3) { if (proc) proc.hidden = true; }
      var prod = document.getElementById("dragonProductionPanel");
      if (showProd) { __dragonPvCalmProd = 0; if (prod) prod.hidden = false; }
      else if (++__dragonPvCalmProd >= 3) { if (prod) prod.hidden = true; }
      try {
        var _sig = (proc && proc.hidden ? "0" : "1") + (prod && prod.hidden ? "0" : "1");
        if (window.__dragonKissSig !== _sig) { window.__dragonKissSig = _sig; genKiss(); }
      } catch (eK) {}
    } catch (e) {}
  }
  window.dragonProdVisibilitySync = prodVisibilitySync;
  ;function genKiss() {
    try {
      var pp = document.getElementById("dragonHistoryPanel");
      var proc = document.getElementById("dragonProcessPanel");
      var prod = document.getElementById("dragonProductionPanel");
      var ihh = document.getElementById("dragonImageHistHead");
      var all = [proc, prod, ihh];
      for (var ci = 0; ci < all.length; ci++) { try { if (all[ci]) all[ci].style.removeProperty("margin-top"); } catch (eC) {} }
      if (!pp || !pp.isConnected) return;
      try {
        var _pr = pp.getBoundingClientRect();
        if (!_pr || _pr.height <= 1 || _pr.width <= 1) return;
      } catch (eR) { return; }
      var order = [];
      if (proc && !proc.hidden && proc.isConnected) order.push(proc);
      if (prod && !prod.hidden && prod.isConnected) order.push(prod);
      if (ihh && !ihh.hidden && ihh.isConnected) order.push(ihh);
      if (!order.length) return;
      var first = order[0];
      var sib = first.previousElementSibling;
      while (sib) {
        try { if (sib.getBoundingClientRect().height > 1) return; } catch (eS) {}
        sib = sib.previousElementSibling;
      }
      var gap = Math.round(first.getBoundingClientRect().top - pp.getBoundingClientRect().bottom);
      if (gap > 0) { try { first.style.setProperty("margin-top", (-gap) + "px", "important"); } catch (eM) {} }
    } catch (e) {}
  }
  window.dragonGenKiss = genKiss;
  window.dragonProdForceShow = function () {
    try { window.__dragonProdForceAt = Date.now(); } catch (eT) {}
    try {
      var proc = document.getElementById("dragonProcessPanel") || dragonProcessPanelEnsure();
      if (proc) proc.hidden = false;
      var prod = document.getElementById("dragonProductionPanel") || dragonProductionEnsure();
      if (prod) prod.hidden = false;
    } catch (e) {}
    try { if (window.dragonProcessToggle) window.dragonProcessToggle(true); } catch (e2) {}
    try { if (window.dragonProductionToggle) window.dragonProductionToggle(true); } catch (e3) {}
  };

  window.dragonGoMonitor = function () {
    try { if (window.__dragonCollapseActiveCharPanel) window.__dragonCollapseActiveCharPanel(); } catch (e0) {}
    try { if (window.dragonClosePremadeMenu) window.dragonClosePremadeMenu(); } catch (e1) {}
    try { if (window.dragonApplyViewMode) window.dragonApplyViewMode(); } catch (e2) {}
    try {
      var mon = null;
      try { mon = window.dragonMonitorEnsure ? window.dragonMonitorEnsure() : null; } catch (eM) {}
      var tgt = (mon && mon.isConnected) ? mon : (document.getElementById("dragonProcessPanel") || document.getElementById("dragonProductionPanel") || document.getElementById("outputAreaEl"));
      if (tgt) {
        var navH = 42;
        try { navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--dragon-nav-h")) || 42; } catch (eN) {}
        var y = tgt.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop || 0) - navH - 4;
        window.scrollTo({ top: Math.max(0, y), behavior: "auto" });
      }
    } catch (eS) {}
  };
  // ═════════════════════════════════ BOOT ═════════════════════════════════
  ensureCss();
  if (nativeFlag()) { try { window.dragonT2IUseNative(true); } catch (e) {} }
  try { setInterval(function () { if (document.hidden) return; try { ensureCpNativeBtn(); } catch (e) {} }, 3000); } catch (e2) {}
  try { applyViewMode(); } catch (e2b) {}
  try { setInterval(function () { if (document.hidden) return; try { ensureViewToggle(); } catch (e) {} }, 2500); } catch (e2c) {}
  try { prodSyncVar(); prodWatch(); setInterval(function () { if (document.hidden) return; try { prodWatch(); } catch (e) {} }, 3000); } catch (e3) {}
  ;function prodTileFit() {
    try {
      if (!prodInlineNow()) return;
      var oa = document.getElementById("outputAreaEl");
      if (!oa) return;
      var tiles = oa.querySelectorAll(".t2i-image-ctn");
      for (var i = 0; i < tiles.length; i++) {
        try {
          var t = tiles[i];
          if (!t || !t.isConnected) continue;
          var f = t.querySelector("iframe");
          if (!f) continue;
          try { f.style.setProperty("width", "100%", "important"); } catch (eW0) {}
          var w = parseInt(f.getAttribute("width") || "0", 10), h = parseInt(f.getAttribute("height") || "0", 10);
          if (!(w > 0) || !(h > 0)) {
            var rs = "";
            try {
              var o = f.textToImagePluginOutput;
              rs = String((o && o.inputs && o.inputs.resolution) || "");
            } catch (eO) { rs = ""; }
            var m = /(\d+)\s*x\s*(\d+)/i.exec(rs);
            if (m) { w = parseInt(m[1], 10); h = parseInt(m[2], 10); }
          }
          if (!(w > 0) || !(h > 0)) continue;
          var tw = t.getBoundingClientRect().width;
          if (!(tw > 0)) continue;
          var want = Math.round(tw * h / w);
          if (parseInt(f.style.height || "0", 10) !== want) f.style.height = want + "px";
          try { if (f.style.getPropertyValue("width") !== "100%" || f.style.getPropertyPriority("width") !== "important") f.style.setProperty("width", "100%", "important"); } catch (eW) {}
        } catch (eT) {}
      }
    } catch (e) {}
  }
  try { prodRow(); prodSwapScan(); prodVisibilitySync(); setInterval(function () { if (document.hidden) return; try { prodRow(); } catch (e0) {} prodSwapScan(); prodFollowScan(); prodTileFit(); try { prodVisibilitySync(); } catch (eV) {} try { dragonCCTailSync(); } catch (eT) {} }, 1500); } catch (e4) {}
  try { prodFinishListen(); } catch (e4b) {}
  try { ensureCpNativeBtn(); } catch (e5) {}
  try { genBtnKill(); } catch (e6b) {}
  try { dragonProcessPanelEnsure(); } catch (e7) {}
  try { setInterval(function () { if (document.hidden) return; try { genBtnKill(); dragonProcessPanelEnsure(); } catch (e) {} }, 3000); } catch (e8) {}
  try { var _deadNat = document.getElementById("dragonCpNativeBtn"); if (_deadNat) _deadNat.remove(); } catch (e5b) {}
  try { var _deadNatW = document.getElementById("dragonCpNativeWrap"); if (_deadNatW && !_deadNatW.children.length) _deadNatW.remove(); } catch (e5c) {}
  try { dragonProductionEnsure(); } catch (e9) {}
  try { setInterval(function () { if (document.hidden) return; try { dragonProductionEnsure(); } catch (e) {} }, 3000); } catch (e10) {}
  try { prodVisibilitySync(); } catch (e11) {}
  try {
    var _pvT = null;
    var _pvSoon = function () { if (_pvT) return; _pvT = setTimeout(function () { _pvT = null; try { prodVisibilitySync(); } catch (e) {} }, 200); };
    var _pvBind = function () {
      try {
        var oa = document.getElementById("outputAreaEl");
        if (oa && !oa.__dragonPvObs) { oa.__dragonPvObs = true; new MutationObserver(_pvSoon).observe(oa, { childList: true, subtree: true }); }
        var pr = document.getElementById("dragonProdRow");
        if (pr && !pr.__dragonPvObs) { pr.__dragonPvObs = true; new MutationObserver(_pvSoon).observe(pr, { childList: true }); }
      } catch (e) {}
    };
    _pvBind(); setInterval(function () { if (document.hidden) return; _pvBind(); }, 3000);
    try {
      var _kzT = null;
      window.addEventListener("resize", function () {
        if (_kzT) return;
        _kzT = setTimeout(function () { _kzT = null; try { genKiss(); } catch (e) {} }, 300);
      });
    } catch (eR) {}
    try { setTimeout(function () { try { genKiss(); } catch (e) {} }, 4000); } catch (eB) {}
  } catch (e12) {}
  try { ensureViewToggle(); } catch (e6) {}
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installTileWatch);
  else installTileWatch();
})();
