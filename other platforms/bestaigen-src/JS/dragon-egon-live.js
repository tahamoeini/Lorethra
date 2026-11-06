(function () {
  if (window.__dragonEgonLiveInstalled) return;
  window.__dragonEgonLiveInstalled = true;

  var CHANNEL = "bestaigen";
  var TWITCH_URL = "https://www.twitch.tv/" + CHANNEL;
  var AVATAR = "src/IMG/egon-live.jpg";
  var CHECK_MS = 1 * 60 * 1000;

  var btn = null, panel = null, playerEl = null, player = null, liveDot = null, liveLabel = null;
  var isLive = true, panelOpen = false, embedLoading = false, playerReady = false;

  function showBlockedNote() {
    if (!panel || !playerEl || document.getElementById("dragonEgonLiveBlocked")) return;
    var d = document.createElement("div");
    d.id = "dragonEgonLiveBlocked";
    d.style.cssText = "padding:.6rem .8rem;font-size:.75rem;color:#ffe9a8;background:rgba(60,30,0,.5);border-bottom:1px solid rgba(255,200,100,.35);";
    d.textContent = "The stream is blocked here — usually an ad-blocker stopping player.twitch.tv. Allow it for this site, or use Watch on Twitch below.";
    playerEl.parentNode.insertBefore(d, playerEl);
  }

  function css() {
    if (document.getElementById("dragonEgonLiveCss")) return;
    var s = document.createElement("style");
    s.id = "dragonEgonLiveCss";
    s.textContent =
      "#dragonEgonLiveBtn{position:fixed;right:0;top:0;z-index:2147482000;display:flex;flex-direction:column;align-items:center;gap:4px;background:none;border:0;padding:12px 12px 0 0;cursor:pointer;touch-action:none;}" +
      "#dragonEgonLiveBtn:focus{outline:none;}" +
      "#dragonEgonLiveBtn::-moz-focus-inner{border:0;}" +
      "#dragonEgonLiveBtn:hover{box-shadow:none !important;filter:none !important;}" +
      "#dragonEgonLiveBar button:hover{box-shadow:none !important;filter:none !important;}" +
      "#dragonEgonLiveHead .x:hover{box-shadow:none !important;filter:none !important;}" +
      "#dragonEgonLiveBtn img{width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid #9b6bff;display:block;animation:dragonAura 2.8s ease-in-out infinite;-webkit-tap-highlight-color:transparent;}" +
      "#dragonEgonLiveBtn.offline img{filter:grayscale(1);border-color:#5a5a6a;box-shadow:none;animation:none;}" +
      "#dragonEgonLiveTag{display:inline-flex;align-items:center;gap:5px;font-size:.68rem;font-weight:800;white-space:nowrap;color:#fff;background:rgba(10,10,14,.85);border:1px solid #9b6bff;border-radius:999px;padding:.15rem .55rem;animation:dragonAuraTag 2.8s ease-in-out infinite;}" +
      "@keyframes dragonAura{0%,100%{box-shadow:0 0 12px 3px rgba(155,107,255,.55);}50%{box-shadow:0 0 34px 12px rgba(155,107,255,.95);}}" +
      "@keyframes dragonAuraTag{0%,100%{box-shadow:0 0 8px 2px rgba(155,107,255,.45);}50%{box-shadow:0 0 22px 8px rgba(155,107,255,.9);}}" +
      "#dragonEgonLiveDot{width:8px;height:8px;border-radius:50%;background:#2eff7b;box-shadow:0 0 8px rgba(46,255,123,.9);flex:none;}" +
      "#dragonEgonLiveBtn.offline #dragonEgonLiveDot{background:#5a5a6a;box-shadow:none;}" +
      "#dragonEgonLivePanel{position:fixed;right:0;top:0;z-index:2147482001;width:min(380px,calc(100vw - 24px));background:#16161d;border:1px solid #5a5a7a;border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.8);overflow:hidden;resize:both;min-width:240px;min-height:180px;max-width:min(94vw,960px);font-size:16px;}" +
      "#dragonEgonLivePanel:fullscreen{width:100%!important;height:100%!important;border-radius:0;display:flex;flex-direction:column;resize:none;}" +
      "#dragonEgonLivePanel:fullscreen #dragonEgonLivePlayer{flex:1;aspect-ratio:auto;min-height:0;}" +
      "#dragonEgonLiveHead{display:flex;align-items:center;gap:.5em;padding:.55em .875em;font-weight:800;font-size:.8em;color:#d8c9ff;border-bottom:1px solid rgba(255,255,255,.08);cursor:move;touch-action:none;}" +
      "#dragonEgonLiveHead .hdot{width:8px;height:8px;border-radius:50%;background:#2eff7b;box-shadow:0 0 8px rgba(46,255,123,.9);flex:none;}" +
      "#dragonEgonLiveHead img.hp{width:2.1em;height:2.1em;border-radius:8px;object-fit:cover;flex:none;}" +
      "#dragonEgonLiveHead .hgrp{margin-left:auto;display:inline-flex;align-items:center;gap:.45em;background:#1a1a20;border:1px solid #5a5a6a;border-radius:8px;padding:.2em .6em;flex:none;}" +
      "#dragonEgonLiveHead .hlab{white-space:nowrap;flex:none;}" +
      "#dragonEgonLiveHead a.sub{font-size:.72em;font-weight:700;color:#9b6bff;text-decoration:none;white-space:nowrap;display:inline-flex;align-items:center;gap:.3em;}" +
      "#dragonEgonLiveHead .hdiv{color:#5a5a6a;font-size:.72em;}" +
      "#dragonEgonLiveHead a.sub svg{width:1em;height:1em;}" +
      "#dragonEgonLiveHead .x{margin-left:.3rem;background:none;border:0;color:#d8c9ff;font-size:1.2em;cursor:pointer;padding:0 .2rem;}" +
      "#dragonEgonLivePlayer{width:100%;aspect-ratio:16/9;background:#000;position:relative;}" +
      "#dragonEgonLivePlayer iframe{width:100%;height:100%;border:0;display:block;}" +
      "#dragonEgonLiveBar{display:flex;align-items:center;gap:.4rem;padding:.45rem .7rem;flex-wrap:wrap;}" +
      "#dragonEgonLiveBar button{background:#1a1a20;border:1px solid #5a5a6a;color:#eee;border-radius:8px;font-size:.75em;font-weight:700;padding:.25rem .6rem;cursor:pointer;min-width:8.5em;box-sizing:border-box;white-space:nowrap;flex:none;}" +
      "#dragonEgonLiveBar a{margin-left:auto;font-size:.75em;font-weight:700;color:#9b6bff;text-decoration:none;background:#1a1a20;border:1px solid #5a5a6a;border-radius:8px;padding:.25em .6em;white-space:nowrap;flex:none;}" +
      "#dragonEgonLiveBar input[type=range]{width:5em;accent-color:#9b6bff;flex:none;cursor:pointer;}" +
      "#dragonEgonLiveFallback{padding:.8rem;font-size:.78em;color:#eee;text-align:center;}";
    document.head.appendChild(s);
  }

  function setLive(live) {
    isLive = !!live;
    if (!btn) return;
    btn.classList.toggle("live", isLive);
    btn.classList.toggle("offline", !isLive);
    if (liveLabel) liveLabel.textContent = isLive ? "Egon Live" : "Egon";
    try { btn.style.display = isLive ? "" : "none"; } catch (eD) {}
  }

  function checkLive() {
    var done = function (live) { setLive(live); };
    try {
      var sf = (window.root && window.root.superFetch) || null;
      var p = sf ? sf("https://decapi.me/twitch/uptime/" + CHANNEL).then(function (r) { return r.text(); }) : fetch("https://decapi.me/twitch/uptime/" + CHANNEL).then(function (r) { return r.text(); });
      p.then(function (t) {
        done(!/offline/i.test(String(t || "")));
      }).catch(function () { done(true); });
    } catch (e) { done(true); }
  }

  function loadEmbedJs(cb) {
    if (window.Twitch && window.Twitch.Player) { cb(); return; }
    if (embedLoading) {
      var iv = setInterval(function () {
        if (window.Twitch && window.Twitch.Player) { clearInterval(iv); cb(); }
      }, 300);
      return;
    }
    embedLoading = true;
    var sc = document.createElement("script");
    sc.src = "https://player.twitch.tv/js/embed/v1.js";
    sc.onload = function () { embedLoading = false; cb(); };
    sc.onerror = function () { embedLoading = false; cb(); };
    document.head.appendChild(sc);
  }

  function parentList() {
    var list = [];
    try { if (window.location.hostname) list.push(window.location.hostname); } catch (e) {}
    try {
      var ao = window.location.ancestorOrigins;
      if (ao) for (var i = 0; i < ao.length; i++) {
        var a = document.createElement("a");
        a.href = ao[i];
        if (a.hostname && list.indexOf(a.hostname) === -1) list.push(a.hostname);
      }
    } catch (eA) {}
    return list.length ? list : [window.location.hostname];
  }

  function showFallback(msg, retry) {
    if (!playerEl) return;
    playerEl.innerHTML = '<div id="dragonEgonLiveFallback"></div>';
    var wrap = document.getElementById("dragonEgonLiveFallback");
    var t = document.createElement("div");
    t.style.marginBottom = ".2rem";
    t.textContent = msg;
    wrap.appendChild(t);
    if (retry) {
      var rb = document.createElement("button");
      rb.textContent = "↻ Retry";
      rb.style.cssText = "margin:.5rem .25rem 0;background:#1a1a20;border:1px solid #5a5a6a;color:#eee;border-radius:8px;font-size:.75em;font-weight:700;padding:.25rem .8rem;cursor:pointer;";
      rb.onclick = function () { player = null; playerReady = false; playerEl.innerHTML = ""; loadEmbedJs(makePlayer); };
      wrap.appendChild(rb);
    }
    var a = document.createElement("a");
    a.href = TWITCH_URL;
    a.target = "_blank";
    a.rel = "noopener";
    a.style.cssText = "display:inline-block;margin:.5rem .25rem 0;color:#9b6bff;font-weight:800;";
    a.textContent = "Watch on Twitch";
    wrap.appendChild(a);
  }

  function makePlayer() {
    if (player || !playerEl) return;
    var parents = parentList();
    var parent = parents[0] || "";
    try { parent = window.location.hostname || parent; } catch (e) {}
    if (!parent) {
      showFallback("Stream is only playable on the live site.", false);
      return;
    }
    if (!(window.Twitch && window.Twitch.Player)) {
      showFallback("The Twitch player could not load here — usually an ad-blocker stopping player.twitch.tv. Allow it, then retry.", true);
      return;
    }
    try {
      player = new window.Twitch.Player(playerEl, {
        channel: CHANNEL, parent: parents, autoplay: true, muted: true, width: "100%", height: "100%",
        controls: false
      });
      playerReady = false;
      try {
        player.addEventListener(window.Twitch.Player.ONLINE, function () { setLive(true); });
      } catch (eOn) {}
      try {
        player.addEventListener(window.Twitch.Player.OFFLINE, function () { setLive(false); });
      } catch (eOff) {}
      try {
        player.addEventListener(window.Twitch.Player.READY, function () {
          playerReady = true;
          try {
            var f = playerEl.querySelector("iframe");
            if (f) f.removeAttribute("title");
          } catch (eS) {}
        });
      } catch (eL) {}
    } catch (e) {
      showFallback("The player failed to start.", true);
      player = null;
    }
  }

  function buildPanel() {
    if (panel) return;
    panel = document.createElement("div");
    panel.id = "dragonEgonLivePanel";
    panel.hidden = true;
    var head = document.createElement("div");
    head.id = "dragonEgonLiveHead";
    var hpic = document.createElement("img");
    hpic.className = "hp";
    hpic.src = AVATAR;
    hpic.alt = "";
    var hdot = document.createElement("span");
    hdot.className = "hdot";
    var hlabel = document.createElement("span");
    hlabel.className = "hlab";
    hlabel.textContent = "Egon Live";
    head.appendChild(hpic);
    head.appendChild(hdot);
    head.appendChild(hlabel);
    var subTop = document.createElement("a");
    subTop.className = "sub";
    subTop.href = "https://www.twitch.tv/subs/" + CHANNEL;
    subTop.target = "_blank";
    subTop.rel = "noopener";
    subTop.textContent = "★ Subscribe";
    var hgrp = document.createElement("span");
    hgrp.className = "hgrp";
    hgrp.appendChild(subTop);
    var hdiv = document.createElement("span");
    hdiv.className = "hdiv";
    hdiv.textContent = "|";
    hgrp.appendChild(hdiv);
    var folTop = document.createElement("a");
    folTop.className = "sub follow";
    folTop.href = TWITCH_URL;
    folTop.target = "_blank";
    folTop.rel = "noopener";
    folTop.innerHTML = '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="#BF94FF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21C7 16.5 3 13 3 8.8 3 6 5.2 4 7.8 4c1.7 0 3.2.9 4.2 2.3C13 4.9 14.5 4 16.2 4 18.8 4 21 6 21 8.8c0 4.2-4 7.7-9 12.2z"/></svg> Follow';
    hgrp.appendChild(folTop);
    head.appendChild(hgrp);
    var x = document.createElement("button");
    x.className = "x";
    x.textContent = "✕";
    x.title = "Close";
    x.onclick = function () { closePanel(); };
    head.appendChild(x);
    playerEl = document.createElement("div");
    playerEl.id = "dragonEgonLivePlayer";
    var bar = document.createElement("div");
    bar.id = "dragonEgonLiveBar";
    var mute = document.createElement("button");
    mute.textContent = "🔊 Unmute";
    mute.title = "Turn stream sound on/off";
    mute.onclick = function () {
      try {
        if (!player) return;
        var m = player.getMuted();
        player.setMuted(!m);
        try {
          if (m) { player.setVolume(0.1); vol.value = "10"; vol.style.display = ""; }
          else vol.style.display = "none";
        } catch (eV) {}
        mute.textContent = m ? "🔇 Mute" : "🔊 Unmute";
        if (m) setTimeout(function () {
          try {
            if (player.getMuted()) { player.setMuted(false); player.setVolume(0.1); }
          } catch (eR) {}
        }, 800);
      } catch (e) {}
    };
    var fs = document.createElement("button");
    fs.textContent = "⛶ Fullscreen";
    fs.title = "Fullscreen";
    fs.onclick = function () {
      try {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (panel.requestFullscreen) {
          var pr = panel.requestFullscreen();
          if (pr && pr.catch) pr.catch(function () {});
        }
      } catch (e) {}
    };
    var vol = document.createElement("input");
    vol.type = "range";
    vol.min = "0";
    vol.max = "100";
    vol.value = "100";
    vol.title = "Volume";
    vol.style.display = "none";
    vol.oninput = function () {
      try {
        if (!player) return;
        var v = Math.max(0, Math.min(100, +vol.value || 0)) / 100;
        player.setVolume(v);
        if (v > 0 && player.getMuted()) {
          player.setMuted(false);
          mute.textContent = "🔇 Mute";
        }
        if (v <= 0 && !player.getMuted()) {
          player.setMuted(true);
          mute.textContent = "🔊 Unmute";
          vol.style.display = "none";
        }
      } catch (e) {}
    };
    var link = document.createElement("a");
    link.href = TWITCH_URL;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Watch on Twitch";
    bar.appendChild(mute);
    bar.appendChild(vol);
    bar.appendChild(fs);
    bar.appendChild(link);
    panel.appendChild(head);
    panel.appendChild(playerEl);
    panel.appendChild(bar);
    document.body.appendChild(panel);
    if (geom.panel) {
      try {
        var w0 = window.innerWidth || 800, h0 = window.innerHeight || 600;
        if (geom.panel.w) panel.style.width = Math.max(240, Math.min(geom.panel.w, w0 - 24)) + "px";
        if (geom.panel.h) panel.style.height = Math.max(180, Math.min(geom.panel.h, h0 - 24)) + "px";
        placeEl(panel, geom.panel);
      } catch (eG) {}
    }
    dragify(panel, head, "panel", true);
    try {
      var lastFs = "";
      var roQueued = false;
      new ResizeObserver(function () {
        if (roQueued) return;
        roQueued = true;
        setTimeout(function () {
          roQueued = false;
          if (!panel || document.fullscreenElement) return;
          var w = panel.clientWidth || 380;
          var fs = (Math.min(1.9, Math.max(0.55, w / 380)) * 16).toFixed(1) + "px";
          if (fs !== lastFs) { lastFs = fs; panel.style.fontSize = fs; }
          clearTimeout(geomT);
          geomT = setTimeout(saveGeom, 800);
        }, 0);
      }).observe(panel);
    } catch (eR) {}
  }

  var watchIv = null;
  function watchPing(on) {
    try {
      if (typeof window.dragonServerRpc !== "function") return;
      window.dragonServerRpc("dragonWatchPing", on ? "1" : "0").catch(function () {});
    } catch (e) {}
  }
  function watchStart() {
    watchPing(true);
    try {
      if (watchIv) clearInterval(watchIv);
      watchIv = setInterval(function () { if (panelOpen) watchPing(true); }, 60000);
    } catch (e) {}
  }
  function watchStop() {
    try { if (watchIv) { clearInterval(watchIv); watchIv = null; } } catch (e) {}
    watchPing(false);
  }
  try { window.addEventListener("pagehide", function () { watchPing(false); }); } catch (eP) {}
  function openPanel() {
    buildPanel();
    if (!geom.panel && btn) {
      try {
        panel.style.right = "0px";
        panel.style.top = "0px";
        panel.style.left = "auto";
        panel.style.bottom = "auto";
        panel.style.width = "";
        panel.style.height = "";
        panel.style.borderRadius = "12px 0 0 12px";
      } catch (eP) {}
    }
    try { var old = document.getElementById("dragonEgonLiveBlocked"); if (old) old.remove(); } catch (e) {}
    playerReady = false;
    panel.hidden = false;
    panelOpen = true;
    watchStart();
    loadEmbedJs(makePlayer);
  }

  function closePanel() {
    panelOpen = false;
    watchStop();
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (eF) {}
    if (panel) panel.hidden = true;
  }

  function buildBtn() {
    if (btn) return;
    css();
    btn = document.createElement("button");
    btn.id = "dragonEgonLiveBtn";
    btn.title = "Egon Live on Twitch";
    var img = document.createElement("img");
    img.src = AVATAR;
    img.alt = "Egon";
    var tag = document.createElement("span");
    tag.id = "dragonEgonLiveTag";
    liveDot = document.createElement("span");
    liveDot.id = "dragonEgonLiveDot";
    liveLabel = document.createElement("span");
    liveLabel.textContent = "Egon Live";
    tag.appendChild(liveDot);
    tag.appendChild(liveLabel);
    btn.appendChild(img);
    btn.appendChild(tag);
    btn.onclick = function () { if (suppressClick) { suppressClick = false; return; } if (panelOpen) closePanel(); else openPanel(); };
    document.body.appendChild(btn);
    placeEl(btn, geom.btn);
    dragify(btn, btn, "btn", false);
    setLive(isLive);
  }

  var GEOM_KEY = "dragonEgonLiveGeomV5";
  var suppressClick = false;
  var geomT = null;
  function loadGeom() {
    try { return JSON.parse(localStorage.getItem(GEOM_KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }
  var geom = loadGeom();
  function saveGeom() {
    try {
      if (panel && !panel.hidden && !document.fullscreenElement) {
        var r = panel.getBoundingClientRect();
        geom.panel = { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
      }
      localStorage.setItem(GEOM_KEY, JSON.stringify(geom));
    } catch (e) {}
  }
  function placeEl(el, p) {
    if (!el || !p) return;
    var w = window.innerWidth || 800, h = window.innerHeight || 600;
    var l = Math.min(Math.max(0, p.l || 0), Math.max(0, w - 80));
    var t = Math.min(Math.max(0, p.t || 0), Math.max(0, h - 60));
    el.style.left = l + "px";
    el.style.top = t + "px";
    el.style.right = "auto";
    el.style.bottom = "auto";
  }
  function dragify(el, handle, key, filter) {
    var sx = 0, sy = 0, sl = 0, st = 0, dragging = false, pid = null;
    handle.addEventListener("pointerdown", function (e) {
      suppressClick = false;
      try {
        if (filter && e.target && e.target.closest && e.target.closest("a,button,iframe")) return;
      } catch (eF) {}
      if (document.fullscreenElement) return;
      if (e.pointerType === "mouse" && e.button !== undefined && e.button !== 0) return;
      var r = el.getBoundingClientRect();
      el.style.left = r.left + "px";
      el.style.top = r.top + "px";
      el.style.right = "auto";
      el.style.bottom = "auto";
      sx = e.clientX; sy = e.clientY; sl = r.left; st = r.top;
      dragging = false;
      pid = (e.pointerId === undefined ? 0 : e.pointerId);
    });
    handle.addEventListener("pointermove", function (e) {
      if (pid === null) return;
      if (e.pointerId !== undefined && e.pointerId !== pid) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (!dragging && Math.abs(dx) + Math.abs(dy) > 6) { dragging = true; suppressClick = true; }
      if (!dragging) return;
      if (key === "panel") { try { el.style.borderRadius = "12px"; } catch (eB) {} }
      var w = window.innerWidth || 800, h = window.innerHeight || 600;
      var r = el.getBoundingClientRect();
      var nl = Math.min(Math.max(0, sl + dx), Math.max(0, w - Math.min(r.width, 120)));
      var nt = Math.min(Math.max(0, st + dy), Math.max(0, h - 40));
      el.style.left = nl + "px";
      el.style.top = nt + "px";
    });
    function up(e) {
      if (pid === null) return;
      if (e.pointerId !== undefined && e.pointerId !== pid) return;
      pid = null;
      if (dragging) {
        var r = el.getBoundingClientRect();
        geom[key] = { l: Math.round(r.left), t: Math.round(r.top) };
        saveGeom();
      }
      dragging = false;
    }
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", function () { pid = null; dragging = false; });
  }

  function boot() {
    buildBtn();
    checkLive();
    setInterval(checkLive, CHECK_MS);
  }

  window.dragonEgonLive = {
    open: openPanel, close: closePanel,
    toggle: function () { if (panelOpen) closePanel(); else openPanel(); },
    state: function () { return { open: panelOpen, live: isLive, hasPlayer: !!player }; },
    audio: function () {
      try {
        if (!player) return { hasPlayer: false };
        return { hasPlayer: true, ready: playerReady, muted: player.getMuted(), volume: player.getVolume() };
      } catch (e) { return { hasPlayer: !!player, error: String(e && e.message || e) }; }
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 0); });
  else setTimeout(boot, 600);
})();
