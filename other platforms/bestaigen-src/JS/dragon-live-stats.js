
(function() {
  // ===== LIVE STATS PANEL (top-left) =====
  // Shows: online now, total users, total images generated, gallery image count.
  // Online/totals come from the server-plugin socket ("dragon-stats"); the gallery
  // count is fetched from the image-generation gallery page (paginated) and cached.
  var statsEl = null, onlineEl = null, usersEl = null, genEl = null, galsEl = null, recEl = null, collapsible = true;
  var onlineBtnEl = null, mirrorEl = null, onlineElM = null, usersElM = null, genElM = null, galsElM = null, recElM = null;
  var socket = null, reconnectTimer = null;
  var statsSocketPermanentDown = false, statsReconnectAttempts = 0;
  // 🔌 Egon 25.09.2026 — ZOMBIE-SOCKET WATCHDOG (the reason a tab could sit on an old build for hours
  // without the "new version" notice ever arriving). A phone that is backgrounded for a long time can come
  // back with a socket that is DEAD but never fired `close`: the connection is gone, the JS object is still
  // there, and every `rpc.getStats()` promise simply never settles. The client then holds that corpse —
  // `socket` is truthy, so the wake handler and the minute heartbeat both keep asking the corpse — and
  // hears nothing at all.
  // So: every stats payload stamps `lastStatsAt`, and anything that talks to a link that has been quiet for
  // STATS_STALE_MS throws it away and reconnects. `statsGen` orphans the old socket's handlers, so a late
  // `close` can never null out (or double-schedule a reconnect for) its replacement.
  var statsGen = 0, lastStatsAt = 0, socketOpenedAt = 0;
  var STATS_STALE_MS = 90000;      // about two missed heartbeats — the link is dead, not merely quiet
  var STATS_FIRST_MS = 25000;      // a brand-new socket gets this long to answer before we doubt it
  var browserId = "";
  try { browserId = localStorage.dragonStatsBrowserId || ""; } catch (e) {}
  if (!browserId) {
    browserId = "b" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    try { localStorage.dragonStatsBrowserId = browserId; } catch (e) {}
  }
  var reportedVisit = false;
  try { reportedVisit = localStorage.dragonStatsVisit === "1"; } catch (e) {}
  // Egon 19.09.2026 — 👥 visitor kind (first-time vs returning): reported ONCE PER BROWSER SESSION. The
  // browser itself knows whether it has ever been here before (`localStorage.dragonVkEver`), so it tells
  // the server "new" (its first ever visit) or "ret" (a return visit). This is what feeds the stacked
  // green/red chart under the 📊 board — see the VISITOR KIND block in the server script.
  //
  // 🔍 Egon 23.09.2026 — "first time vs returning how healthy is it? returning stays at 1/4, impossible
  // like." The metric counts BROWSER SESSIONS, not people, so two things had to be repaired:
  //   (1) TWO durable markers, not one. `dragonStatsVisit` (written by the older visit report, snapshotted
  //       here BEFORE anything in this load can write it) and `dragonVkEver` both mean "this browser has
  //       been here before". Whichever survived makes the session a RETURN visit, so a half-cleared storage
  //       can no longer turn a returning visitor into a "first-time".
  //   (2) A REFUSED report must stay uncounted AND un-flagged. The server drops a report when the same
  //       rough network reported within 20 s (best-effort anti-spam); the old code still wrote
  //       `dragonVkEver` on that refusal, which silently burned the visitor's one and only "first-time"
  //       report and made every later session of theirs a "returning" — the opposite of the truth.
  var wasHereBefore = reportedVisit;
  try { if (localStorage.dragonVkEver === "1") wasHereBefore = true; } catch (e) {}
  var vkSent = false;
  try { vkSent = sessionStorage.getItem("dragonVkSent") === "1"; } catch (e) {}
  var vkTries = 0;
  ;function dragonReportVisitKind() {
    if (vkSent) return;
    if (vkTries >= 4) return;                       // bounded: never hammer the socket for this
    var o = window.__dragonStatsSockets ? window.__dragonStatsSockets() : null;
    var sk = o && o.socket;
    if (!sk || !sk.rpc || !sk.rpc.dragonVisitKind) return;
    vkSent = true; // one attempt at a time; cleared again if the send itself fails OR the server refuses
    vkTries++;
    var isNew = !wasHereBefore;
    // One id per tab session: the server dedupes on it, so retries and sibling sockets never double-count.
    var vkSid = "";
    try {
      vkSid = sessionStorage.getItem("dragonVkSid") || "";
      if (!vkSid) { vkSid = "s" + Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem("dragonVkSid", vkSid); }
    } catch (e) { vkSid = "s" + Math.random().toString(36).slice(2); }
    var done = function () {
      wasHereBefore = true;
      try { localStorage.dragonVkEver = "1"; } catch (e) {}
      try { sessionStorage.setItem("dragonVkSent", "1"); } catch (e) {}
    };
    var retry = function () {
      vkSent = false;
      // A refusal is the server's 20 s / network guard, so come back later in this same session: the
      // visitor's report is then still delivered (and if this was their first visit it still counts).
      if (vkTries < 4) setTimeout(function () { try { dragonReportVisitKind(); } catch (e) {} }, 22000);
    };
    try {
      sk.rpc.dragonVisitKind((isNew ? "new" : "ret") + "|" + browserId + "|" + vkSid).then(function (raw) {
        var r = null;
        try { r = JSON.parse(raw); } catch (e) {}
        if (r && r.ok === 0) { retry(); return; }
        done();
      }).catch(function () { vkSent = false; });
    } catch (e) { vkSent = false; }
  }
  try { window.dragonReportVisitKind = dragonReportVisitKind; } catch (e) {}
  // Egon 17.09.2026 — "Listed Galleries" = how many galleries the PUBLIC gallery selector lists right now
  // (live, straight from dragonGalList() — no network, no heavy work).
  ;function dragonStatsListedGalleries() {
    var n = 0;
    try { if (window.dragonGalList) n = window.dragonGalList().length; } catch (e) {}
    if (galsEl) setVal(galsEl, n);
    if (galsElM) setVal(galsElM, n);
    return n;
  }
  window.dragonStatsListedGalleries = dragonStatsListedGalleries;
  ;function statsPanelHtml() {
    return "<div class='dragon-stats-head'><span class='dragon-stats-dot'></span>&#x1F464;<b id='dragonStatsOnline'>&bull;</b><button id='dragonStatsToggleBtn' title='collapse / expand'>&#x25BE;</button></div>" +
      "<div class='dragon-stats-total'>Total</div>" +
      "<div class='dragon-stats-row dragon-stats-row--rec'><span>&#x1F3C6; Online Record</span><b id='dragonStatsRec'>&bull;</b></div>" +
      "<div class='dragon-stats-row'><span>&#x1F465; Visited</span><b id='dragonStatsUsers'>&bull;</b></div>" +
      "<div class='dragon-stats-row'><span>&#x1F5C2;&#xFE0F; Listed Galleries</span><b id='dragonStatsGals'>&bull;</b></div>" +
      "<div class='dragon-stats-row'><span>&#x1F3A8; Image Generated</span><b id='dragonStatsGen'>&bull;</b></div>";
  }
  ;function statsMirrorHtml() {
    return "<div class='dragon-stats-head'><span class='dragon-stats-dot'></span>&#x1F464;<b id='dragonStatsOnlineM'>&bull;</b></div>" +
      "<div class='dragon-stats-total'>Total</div>" +
      "<div class='dragon-stats-row dragon-stats-row--rec'><span>&#x1F3C6; Online Record</span><b id='dragonStatsRecM'>&bull;</b></div>" +
      "<div class='dragon-stats-row'><span>&#x1F465; Visited</span><b id='dragonStatsUsersM'>&bull;</b></div>" +
      "<div class='dragon-stats-row'><span>&#x1F5C2;&#xFE0F; Listed Galleries</span><b id='dragonStatsGalsM'>&bull;</b></div>" +
      "<div class='dragon-stats-row'><span>&#x1F3A8; Image Generated</span><b id='dragonStatsGenM'>&bull;</b></div>";
  }
  // Parent-screen mirror: a green circle button (bottom-left, above History) that shows the live
  // online count as a number, and toggles a mirror of the live-stats table when clicked.
  ;function makeOnlineButton() {
    if (document.querySelector(".dragon-online-circle")) return;
    var btn = document.createElement("button");
    btn.className = "dragon-online-circle";
    btn.title = "Live stats \u2014 click to open";
    btn.textContent = "\u2022";
    onlineBtnEl = btn;
    var mirror = document.createElement("div");
    mirror.className = "dragon-stats-mirror";
    mirror.innerHTML = statsMirrorHtml();
    mirror.style.display = "none";
    document.body.appendChild(btn);
    document.body.appendChild(mirror);
    mirrorEl = mirror;
    onlineElM = document.getElementById("dragonStatsOnlineM");
    usersElM = document.getElementById("dragonStatsUsersM");
    genElM = document.getElementById("dragonStatsGenM");
    galsElM = document.getElementById("dragonStatsGalsM");
    recElM = document.getElementById("dragonStatsRecM");
    dragonStatsListedGalleries();
    ;function isOpen() { return mirror.style.display === "block"; }
    ;function toggle(force) {
      var show = (force === undefined) ? !isOpen() : !!force;
      mirror.style.display = show ? "block" : "none";
      btn.classList.toggle("dragon-online-circle-active", show);
      if (show) dragonStatsListedGalleries();
    }
    window.dragonToggleLiveStats = toggle;
    btn.onclick = function (e) { e.stopPropagation(); toggle(); };
    mirror.addEventListener("pointerdown", function (e) {
      if (e.target.closest && e.target.closest("button")) return;
      e.stopPropagation();
    });
    // Egon 17.09.2026 — the table must close on ANY outside click. Several of the generator's own
    // handlers call stopPropagation(), so the old bubbling document listener never fired (e.g. tapping
    // the navbar left the table open). We now listen in the CAPTURE phase on the window, which always
    // runs before any of those handlers.
    var closeOutside = function (e) {
      if (!isOpen()) return;
      var t = e.target;
      if (t && t.closest && (t.closest(".dragon-online-circle") || t.closest(".dragon-stats-mirror"))) return;
      toggle(false);
    };
    window.addEventListener("pointerdown", closeOutside, true);
    window.addEventListener("click", closeOutside, true);
    window.addEventListener("keydown", function (e) { if (e.key === "Escape") toggle(false); });
  }
  ;function makeStatsPanel() {
    if (document.querySelector(".dragon-live-stats")) return true;
    statsEl = document.createElement("div");
    statsEl.className = "dragon-live-stats";
    statsEl.innerHTML = statsPanelHtml();
    statsEl.style.display = "none";
    document.body.appendChild(statsEl);
    onlineEl = document.getElementById("dragonStatsOnline");
    usersEl = document.getElementById("dragonStatsUsers");
    genEl = document.getElementById("dragonStatsGen");
    galsEl = document.getElementById("dragonStatsGals");
    recEl = document.getElementById("dragonStatsRec");
    dragonStatsListedGalleries();
    try { collapsible = localStorage.dragonStatsCollapsed === "0"; } catch (e) {}
    if (window.innerWidth <= 760) {
      try {
        if (localStorage.dragonStatsCollapsed === undefined) collapsible = false;
      } catch (e) {}
    }
    var tog = document.getElementById("dragonStatsToggleBtn");
    if (tog) tog.onclick = function () {
      collapsible = !collapsible;
      try { localStorage.dragonStatsCollapsed = collapsible ? "0" : "1"; } catch (e) {}
      applyCollapse();
    };
    applyCollapse();
    statsEl.addEventListener("pointerdown", function (e) {
      if (e.target.closest && e.target.closest("button")) return;
      e.stopPropagation();
    });
    // DEPOT (Egon 13.09.2026, old behavior): stats table used to be embedded at the START of the
    // Likes toolbar row. No longer needed — live stats are in .dragon-stats-mirror in the navbar.
    // Element is kept HIDDEN on <body> so that .dragon-stats-* IDs/applyStats flow isn't disrupted.
    dragonBodyObserve(function () {
      if (statsEl && statsEl.parentElement !== document.body) document.body.appendChild(statsEl);
      if (statsEl) statsEl.style.display = "none";
    });
    return true;
  }
  ;function applyCollapse() {
    if (!statsEl) return;
    var body = statsEl.querySelector(".dragon-stats-total");
    var rows = statsEl.querySelectorAll(".dragon-stats-row");
    for (var i = 0; i < rows.length; i++) rows[i].style.display = collapsible ? "" : "none";
    if (body) body.style.display = collapsible ? "" : "none";
    if (collapsible) statsEl.classList.remove("dragon-stats-collapsed");
    else statsEl.classList.add("dragon-stats-collapsed");
    var tog = document.getElementById("dragonStatsToggleBtn");
    if (tog) tog.textContent = collapsible ? "\u25BE" : "\u25B8";
  }
  ;function setVal(el, v) { if (el) el.textContent = String(v); }
  // Is the live link usable? No socket, or one that has gone silent for too long, means "reconnect".
  ;function statsLinkStale() {
    if (!socket) return true;
    var now = Date.now();
    if (!lastStatsAt) return (now - socketOpenedAt) > STATS_FIRST_MS;
    return (now - lastStatsAt) > STATS_STALE_MS;
  }
  // Drop the current link (dead, or suspected dead) and open a fresh one. Bumping `statsGen` first orphans
  // the old socket's handlers, so nothing it does later can touch the new connection.
  ;function dragonStatsReconnect() {
    var old = socket;
    statsGen++;
    socket = null;
    lastStatsAt = 0;
    try { clearTimeout(reconnectTimer); } catch (e) {}
    try { if (old && old.close) old.close(); } catch (e) {}
    connectStats();
  }
  window.dragonStatsReconnect = dragonStatsReconnect;
  window.dragonStatsLinkStale = statsLinkStale;
  ;function connectStats() {
    if (statsSocketPermanentDown) return;
    var gen = ++statsGen;
    var sk;
    try { sk = root.createServerSocket(); } catch (e) { return; }
    socket = sk;
    socketOpenedAt = Date.now();
    sk.addEventListener("open", function () {
      if (gen !== statsGen) return;
      socketOpenedAt = Date.now();
      statsReconnectAttempts = 0;
      try { socket.rpc.getStats("").then(function (s) { try { applyStats(JSON.parse(s)); } catch (e) {} }).catch(function () {}); } catch (e) {}
      if (!reportedVisit) {
        try { socket.rpc.visit(browserId).then(function (s) { try { applyStats(JSON.parse(s)); } catch (e) {} }).catch(function () {}); } catch (e) {}
        reportedVisit = true;
        try { localStorage.dragonStatsVisit = "1"; } catch (e) {}
      }
      // 🌐 The country/device report is now sent by the ONE wrapper that identifies EVERY socket this client
      // opens (see dragonIdentifySocket) — so there is no separate call here: one report per connection.
      try { dragonIdentifySocket(socket); } catch (e) {}
      dragonReportVisitKind();
    });
    sk.addEventListener("message", function (ev) {
      if (gen !== statsGen) return;
      try { applyStats(typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data); } catch (e) {}
    });
    // Egon 12.09.2026 — 🛡️ socket protections: swallow the error event (so it's not unhandled), close is already
    // caught in every case → NEVER enter an infinite wait (reconnect with backoff).
    sk.addEventListener("error", function () { /* swallow silently; close handler takes over */ });
    sk.addEventListener("close", function (ev) {
      // A socket we already replaced (watchdog) is not allowed to touch the new one.
      if (gen !== statsGen) return;
      var code = ev && ev.code;
      socket = null;
      clearTimeout(reconnectTimer);
      // 4403 = permanently banned → stop retrying completely.
      if (code === 4403) { statsSocketPermanentDown = true; return; }
      // 1011 = server code could not be started (init timeout / error). Instead of aggressive reconnecting,
      // apply a long backoff and write a clear warning to the console (so the user can see the reason).
      if (code === 1011) {
        try { console.warn("[dragon-stats] server code failed to initialize (1011) \u2014 backing off"); } catch (e) {}
        statsReconnectAttempts = Math.max(statsReconnectAttempts, 3);
      }
      // 4429 = the platform QUARANTINED this generator's server (repeated handler timeouts, memory-limit
      // failures or crashes). The close reason carries the retry delay, and reconnecting before it only
      // adds load to a server that is already in trouble — so honour it instead of hammering.
      if (code === 4429) {
        try { console.warn("[dragon-stats] server is quarantined (4429) \u2014 " + String(ev && ev.reason || "")); } catch (e) {}
        var wait = 60000;
        var rm = String(ev && ev.reason || "").match(/retry after\s+(\d+)/i);
        if (rm) wait = Math.min(1800000, Math.max(5000, parseInt(rm[1], 10)));
        wait += Math.floor(Math.random() * 60000); // Egon 17.10.2026 (quarantine-4429): jitter so hundreds of browsers do not reconnect in the same second after a shared quarantine (Egon 20.10.2026: widened 15s to 60s — the herd re-quarantined on every fence lift)
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connectStats, wait);
        return;
      }
      statsReconnectAttempts++;
      var delay = Math.min(45000, 3000 * statsReconnectAttempts) + Math.floor(Math.random() * 1000);
      reconnectTimer = setTimeout(connectStats, delay);
    });
  }
 ;function applyStats(d) {
  // Egon 03.10.2026 — 1-SECOND RULE: the scrolling online ticker must always show the count from
  // 1 second before it becomes visible (never the live value at render time). Every stats payload
  // leaves a timestamped sample here so the banner can look the count up as it was ~1000 ms ago.
  var _dragonOnlineHist = [];
  try { window.__dragonOnlineHist = _dragonOnlineHist; } catch (e) {}
  ;function dragonOnlineSample(n) {
    try {
      _dragonOnlineHist.push({ t: Date.now(), n: n });
      var cut = Date.now() - 15000;
      while (_dragonOnlineHist.length > 40 || (_dragonOnlineHist.length > 1 && _dragonOnlineHist[0].t < cut)) _dragonOnlineHist.shift();
    } catch (e) {}
  }
  ;function dragonOnlineAt(delayMs) {
    try {
      var target = Date.now() - (delayMs || 0), i, best = 0;
      for (i = 0; i < _dragonOnlineHist.length; i++) {
        if (_dragonOnlineHist[i].t <= target) best = _dragonOnlineHist[i].n;
        else break;
      }
      if (best > 0) return best;
      if (_dragonOnlineHist.length) return _dragonOnlineHist[0].n;
      return Number(window.__dragonLastOnline) || 0;
    } catch (e) { return 0; }
  }
  window.dragonOnlineAt = dragonOnlineAt;
    if (!d) return;
    lastStatsAt = Date.now();   // the link just proved it is alive (see the zombie-socket watchdog above)
    if (typeof d.online === "number") {
      setVal(onlineEl, d.online); setVal(onlineElM, d.online); if (onlineBtnEl) setVal(onlineBtnEl, d.online);
      window.__dragonLastOnline = d.online; dragonOnlineSample(d.online); dragonMilestoneCheck(d.online);
      // Egon 20.09.2026 — the Settings "🌐 Visitors" card title carries this number, so refresh it on
      // every online update (the function itself is a no-op when nothing actually changed).
      if (window.dragonRefreshVisitorsPanel) { try { window.dragonRefreshVisitorsPanel(); } catch (e) {} }
    }
    // Egon 18.09.2026 — 🏆 Online Record (all-time max simultaneous online), tracked server-side.
    if (typeof d.onlineRecord === "number") { setVal(recEl, d.onlineRecord); setVal(recElM, d.onlineRecord); try { window.__dragonLastRecord = d.onlineRecord; } catch (e) {} dragonRecordCheck(d.onlineRecord); }
    if (typeof d.totalUsers === "number") { setVal(usersEl, d.totalUsers); setVal(usersElM, d.totalUsers); }
    if (typeof d.totalImages === "number") { setVal(genEl, d.totalImages); setVal(genElM, d.totalImages); }
    // 18.09.2026 — 🌐 Visitors: live online breakdown by country (Settings > Visitors panel).
    if (d.onlineUsers && Array.isArray(d.onlineUsers)) { try { window.__dragonOnlineUsers = d.onlineUsers.slice(0, 200); } catch (e) {} }
    if (d.countries && typeof d.countries === "object") {
      window.__dragonVisitorCountries = d.countries;
      window.__dragonOnlineUnknown = Number(d.onlineUnknown) || 0;
      if (window.dragonRefreshVisitorsPanel) window.dragonRefreshVisitorsPanel();
    }
    // 📱💻 Egon 24.09.2026 (W-UX271) — the live mobile/desktop split for the same panel is BACK (W-CLEAN218 had
    // parked it). Phones and tablets share one bucket; a connection that has not answered yet is "unknown".
    if (d.devices && typeof d.devices === "object") {
      window.__dragonVisitorDevices = { mobile: Number(d.devices.mobile) || 0, desktop: Number(d.devices.desktop) || 0, unknown: Number(d.deviceUnknown) || 0 };
      if (window.dragonRefreshVisitorsPanel) window.dragonRefreshVisitorsPanel();
    }
    // Report our own kind once per browser session (cheap, purely local detection — see dragonDetectDevice).
    try { dragonReportDevice(); } catch (e) {}
    // 📊 Visitor Stats board: refreshes itself at most once every 30s, and only while it is on screen.
    if (window.dragonRefreshStatsCard) { try { window.dragonRefreshStatsCard(); } catch (e) {} }
    // Egon 14.09.2026 — About rating totals (global, live).
    if (d.ratings && window.dragonRefreshRateUI) { try { window.dragonRefreshRateUI(d.ratings); } catch (e) {} }
    // Egon 18.09.2026 — 🔄 LIVE "NEW VERSION" NOTICE: the server reports the build of the deployed code;
    // a connected tab that is still running an OLDER build gets a reload prompt (see the block below).
    if (d.build) { try { dragonVersionCheck(d.build); } catch (e) {} }
    // 🆕 Egon 25.09.2026 (W-EFOR282) — the number of the popup that is LIVE right now. The popup module only
    // ever shows its own number, so this one line is what makes a tab running an older build harmless.
    if (d.popupMmm != null && window.dragonPopupServerMmm) { try { window.dragonPopupServerMmm(Number(d.popupMmm) || 0); } catch (e) {} }
  }
  // Egon 23.09.2026 — 📶 COMING BACK TO THE TAB IS A STATS EVENT. A backgrounded tab is frozen and its
  // once-a-minute heartbeat is SKIPPED while hidden, so after returning the visitor could sit on a stale
  // build for a whole minute — and a tab whose socket died while it was away waits out a reconnect backoff
  // (up to 45 s) before it hears anything. So the moment the tab is visible again (visibility, focus, a
  // bfcache restore, or the network coming back) we ask for ONE stats payload right away, and if the
  // socket is gone we reconnect NOW instead of waiting. That fresh payload carries the deployed build, so
  // the reload notice (dragonVersionCheck) appears the instant the visitor actually looks at the tab.
  var _wakeLast = 0;
  ;function dragonStatsWake() {
    if (statsSocketPermanentDown) return false;
    if (document.visibilityState && document.visibilityState !== "visible") return false;
    if (Date.now() - _wakeLast < 1500) return false;   // visibility + focus + pageshow all fire on one return
    _wakeLast = Date.now();
    if (socket && !statsLinkStale()) {
      try { socket.rpc.dragonPresencePing(dragonPresencePack()).then(function (s) { try { applyStats(JSON.parse(s)); } catch (e) {} }).catch(function () {}); } catch (e) {}
      try { dragonStatsListedGalleries(); } catch (e) {}
      return true;
    }
    // No socket at all, or one that has gone SILENT (the phone was asleep for hours): reconnect at once
    // instead of asking a corpse — that is the difference between "nothing ever arrives" and the notice.
    try { dragonStatsReconnect(); } catch (e) {}
    return true;
  }
  window.dragonStatsWake = dragonStatsWake;
  // ===== Egon 18.09.2026 — 🔄 LIVE "NEW VERSION" NOTICE ===== see changelog [353] / update notes [U183].
  // WHY: saving a generator updates the FILES, but a browser never reloads itself — every already-open
  // tab (and every visitor who loaded the page five minutes ago) keeps running the OLD code, so it never
  // sees the new news ticker, the Update Notes, or anything else that was just shipped. The news ticker
  // itself is parsed from this document at load time, so it CANNOT be pushed live.
  // HOW: the perchance server script ships with the same save, so it knows the deployed build; it reports
  // it in every stats payload (already flowing over the existing socket every few seconds and on every
  // connect/reconnect — a save restarts the server, which drops the sockets and forces exactly such a
  // reconnect). A client whose own `buildVersion` is LOWER than the reported one scrolls a short
  // "reload to see what's changed" marquee below the navbar, then settles into a compact click-to-reload
  // pill. It is shown once per release per browser session, and it NEVER reloads by itself — the visitor
  // decides. Tabs running code older than the build that introduced this feature cannot be reached (they
  // are running JS that predates it), so this takes effect from this build onward.
  // THRESHOLD (Egon 18.09.2026): the build number is xxx.yyy.zzz and the LAST field (z) is the routine
  // patch field — most saves only bump it. Announcing every one of those would pester visitors for nothing,
  // so ONLY a change in the leading x or y raises the notice; z-only changes stay SILENT (no bar, no prompt,
  // no Dexa). A y bump (a genuinely NEW feature) shows the bar AND has Dexa announce it; an x bump (a HUGE
  // change, or yyy overflowing 999) shows everything and styles the bar as the big one.
  // FIELDS: z = routine patch (silent), y = new usable feature (announce), x = huge change (announce big).
  // VISIBILITY (Egon 23.09.2026): a HIDDEN tab parks the notice — nothing is spent on an unseen screen —
  // and dragonStatsWake() asks for a fresh stats payload the instant the tab is looked at again, so the
  // bar shows up when the visitor is actually there to see it.
  // ===== 🎞️ SHARED MARQUEE LANE + GESTURES (Egon 20.09.2026) =====
  // “If there's blue scrolling text, dexa's scrolling text will be delayed and vice versa. they will wait for each other. first
  // once it starts, the other will start when it finishes.” — only ONE scrolling banner runs at a time; every banner
  // (the news ticker, the reload notice, the milestone banner) requests the lane and RELEASES it when its
  // scroll is over or it is dismissed, and the next waiter then starts.
  var _mqActive = false, _mqQueue = [], _mqLastEnd = 0, _mqTimer = null;
  // Egon 23.09.2026 — FLOOD CONTROL: no announcement may follow another one straight away. Between the
  // moment one banner or Dexa bubble leaves the screen and the next one starts there must be AT LEAST
  // 2 minutes, and the marquee is a single slot, so nothing can ever sit on top of anything else. A
  // visitor who lands on the page therefore gets ONE message, then silence, then (at most) one more.
  var MQ_MIN_GAP_MS = 120000;
  ;function _mqGapLeft() { var left = (_mqLastEnd + MQ_MIN_GAP_MS) - Date.now(); return left > 0 ? left : 0; }
  ;function _mqNext() {
    if (_mqActive || !_mqQueue.length) return;
    var wait = _mqGapLeft();
    // Egon 29.09.2026 — PRIORITY: a record celebration jumps the queue AND skips the 2-minute gap (it is
    // news that rots in minutes), but it never paints over a banner that is literally on screen — it runs
    // the moment the current one is released. Ordinary announcements are untouched by this.
    var prio = !!(_mqQueue[0] && _mqQueue[0].__dragonPriority);
    if (wait > 0 && !prio) {
      if (!_mqTimer) _mqTimer = setTimeout(function () { _mqTimer = null; _mqNext(); }, wait);
      return;
    }
    var run = _mqQueue.shift();
    _mqActive = true;
    try { run(); } catch (e) { _mqActive = false; _mqNext(); }
  }
  window.dragonMarquee = {
    busy: function () { return _mqActive || _mqQueue.length > 0; },
    queued: function () { return _mqQueue.length; },
    gapLeftMs: function () { return _mqGapLeft(); },
    minGapMs: MQ_MIN_GAP_MS,
    request: function (run, opts) {
      if (typeof run !== "function") return false;
      // Egon 29.09.2026 — {priority:true} unshifts to the FRONT (see _mqNext: it also skips the gap).
      var prio = !!(opts && opts.priority);
      if (prio) { try { run.__dragonPriority = true; } catch (e) {} }
      if (_mqActive || _mqQueue.length || _mqGapLeft() > 0) {
        if (prio) _mqQueue.unshift(run); else _mqQueue.push(run);
        _mqNext(); return false;
      }
      _mqActive = true;
      try { run(); } catch (e) { _mqActive = false; _mqNext(); }
      return true;
    },
    release: function () { if (!_mqActive) return; _mqActive = false; _mqLastEnd = Date.now(); try { setTimeout(_mqNext, 0); } catch (e) { _mqNext(); } },
    // 🧪 test hooks (used by the check-up): `onScreen()` tells whether a banner is painted RIGHT NOW;
    // `_resetGap()` drops ONLY the cooldown so the next waiter starts at once (the queue is kept);
    // `_clear()` is the check-up's clean slate (drops the cooldown AND every waiter).
    onScreen: function () { return _mqActive; },
    _resetGap: function () { _mqLastEnd = 0; if (_mqTimer) { clearTimeout(_mqTimer); _mqTimer = null; } _mqNext(); },
    _clear: function () { _mqQueue.length = 0; _mqLastEnd = 0; if (_mqTimer) { clearTimeout(_mqTimer); _mqTimer = null; } }
  };
  // 🖱️ Gestures — the same on every scrolling banner:
  //   desktop : 1 left click = STOPS the scroll (another click resumes it) · 2 left clicks = the banner's
  //             action (reload / open Update Notes) · right click = destroys the banner
  //   touch   : 1 tap = stops/resumes · 2 taps = destroys · 3 taps = the action
  //   (a banner that has settled into its static pill has nothing to stop, so ONE click runs its action.)
  window.dragonMarqueeGestures = function (el, opt) {
    if (!el) return null;
    opt = opt || {};
    var n = 0, tmr = null, paused = false, before = false, touch = false;
    ;function setPaused(on) {
      paused = !!on;
      try { var a = el.__dragonAnim; if (a) { if (paused) { if (a.pause) a.pause(); } else if (a.play) a.play(); } } catch (e) {}
      try { el.setAttribute("data-dragon-paused", paused ? "1" : "0"); } catch (e) {}
    }
    ;function act() { try { if (opt.action) opt.action(); } catch (e) {} }
    ;function dis() { try { if (opt.dismiss) opt.dismiss(); } catch (e) {} }
    el.addEventListener("pointerdown", function (e) { try { touch = !!(e && e.pointerType && e.pointerType !== "mouse"); } catch (er) {} }, true);
    el.addEventListener("touchstart", function () { touch = true; }, true);
    el.addEventListener("contextmenu", function (e) { if (touch) return; e.preventDefault(); dis(); });
    el.addEventListener("click", function (e) {
      try { if (e.target && e.target.closest && e.target.closest("[data-dragon-gesture-skip]")) return; } catch (er) {}
      n++;
      clearTimeout(tmr);
      if (n === 1) {
        if (el.__dragonPill) { act(); n = 0; return; }
        before = paused;
        setPaused(!paused);
      } else if (n === 2) {
        setPaused(before);
        if (touch) dis(); else act();
      } else if (touch) {
        setPaused(before);
        act();
      }
      tmr = setTimeout(function () { n = 0; }, 420);
    });
    try { el.style.touchAction = "manipulation"; } catch (e) {}
    try { el.style.webkitUserSelect = "none"; el.style.userSelect = "none"; } catch (e) {}
    return { paused: function () { return paused; } };
  };
  // 🐉 → 🐲 Egon 20.09.2026: the scrolling banners show Dexa's own HEAD PICTURE instead of the green
  // dragon emoji, so every dragon glyph is stripped from a banner text at render time.
  var DRAGON_HEAD_IMG = "https://user.uploads.dev/file/b113225d7dd4df887890c5b33ed65f7f.jpg";
  window.dragonMarqueeText = function (t) {
    return String(t == null ? "" : t).replace(/\uD83D\uDC09/g, "").replace(/\s{2,}/g, " ").replace(/^[\s·•]+/, "").trim();
  };
  window.dragonMarqueeHead = function (size) {
    var im = document.createElement("img");
    im.src = DRAGON_HEAD_IMG;
    im.alt = "Dexa";
    im.className = "dragon-marquee-head";
    im.style.cssText = "width:" + (size || 20) + "px;height:" + (size || 20) + "px;border-radius:50%;object-fit:cover;flex:0 0 auto;border:1px solid rgba(255,255,255,.55);box-shadow:0 0 6px rgba(0,0,0,.45);";
    return im;
  };
  var VN_TEXT = {
    en: { m: "\uD83D\uDD04 BestAiGen was just updated \u2014 press F5 (or reload) to see what's changed! \u2728", p: "\uD83D\uDD04 New version \u2014 reload" },
    tr: { m: "\uD83D\uDD04 BestAiGen az \u00F6nce g\u00FCncellendi \u2014 de\u011Fi\u015Fiklikleri g\u00F6rmek i\u00E7in F5'e bas (ya da sayfay\u0131 yenile)! \u2728", p: "\uD83D\uDD04 Yeni s\u00FCr\u00FCm \u2014 yenile" },
    de: { m: "\uD83D\uDD04 BestAiGen wurde gerade aktualisiert \u2014 dr\u00FCcke F5 (oder lade neu), um die \u00C4nderungen zu sehen! \u2728", p: "\uD83D\uDD04 Neue Version \u2014 neu laden" },
    fr: { m: "\uD83D\uDD04 BestAiGen vient d'\u00EAtre mis \u00E0 jour \u2014 appuie sur F5 (ou recharge) pour voir les nouveaut\u00E9s ! \u2728", p: "\uD83D\uDD04 Nouvelle version \u2014 recharger" },
    es: { m: "\uD83D\uDD04 BestAiGen se acaba de actualizar \u2014 \u00A1pulsa F5 (o recarga) para ver los cambios! \u2728", p: "\uD83D\uDD04 Nueva versi\u00F3n \u2014 recargar" },
    it: { m: "\uD83D\uDD04 BestAiGen \u00E8 appena stato aggiornato \u2014 premi F5 (o ricarica) per vedere le novit\u00E0! \u2728", p: "\uD83D\uDD04 Nuova versione \u2014 ricarica" },
    ru: { m: "\uD83D\uDD04 BestAiGen \u0442\u043E\u043B\u044C\u043A\u043E \u0447\u0442\u043E \u043E\u0431\u043D\u043E\u0432\u0438\u043B\u0441\u044F \u2014 \u043D\u0430\u0436\u043C\u0438 F5 (\u0438\u043B\u0438 \u043F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u0438), \u0447\u0442\u043E\u0431\u044B \u0443\u0432\u0438\u0434\u0435\u0442\u044C \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F! \u2728", p: "\uD83D\uDD04 \u041D\u043E\u0432\u0430\u044F \u0432\u0435\u0440\u0441\u0438\u044F \u2014 \u043F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C" },
    pt: { m: "\uD83D\uDD04 O BestAiGen acabou de ser atualizado \u2014 pressiona F5 (ou recarrega) para ver as novidades! \u2728", p: "\uD83D\uDD04 Nova vers\u00E3o \u2014 recarregar" },
    ar: { m: "\uD83D\uDD04 \u062A\u0645 \u062A\u062D\u062F\u064A\u062B BestAiGen \u0644\u0644\u062A\u0648 \u2014 \u0627\u0636\u063A\u0637 F5 (\u0623\u0648 \u0623\u0639\u062F \u0627\u0644\u062A\u062D\u0645\u064A\u0644) \u0644\u0631\u0624\u064A\u0629 \u0627\u0644\u062A\u063A\u064A\u064A\u0631\u0627\u062A! \u2728", p: "\uD83D\uDD04 \u0625\u0635\u062F\u0627\u0631 \u062C\u062F\u064A\u062F \u2014 \u0623\u0639\u062F \u0627\u0644\u062A\u062D\u0645\u064A\u0644" },
    nl: { m: "\uD83D\uDD04 BestAiGen is net bijgewerkt \u2014 druk op F5 (of herlaad) om de wijzigingen te zien! \u2728", p: "\uD83D\uDD04 Nieuwe versie \u2014 herladen" },
    pl: { m: "\uD83D\uDD04 BestAiGen zosta\u0142 w\u0142a\u015Bnie zaktualizowany \u2014 naci\u015Bnij F5 (lub od\u015Bwie\u017C), aby zobaczy\u0107 zmiany! \u2728", p: "\uD83D\uDD04 Nowa wersja \u2014 od\u015Bwie\u017C" },
    ja: { m: "\uD83D\uDD04 BestAiGen \u304C\u66F4\u65B0\u3055\u308C\u307E\u3057\u305F \u2014 F5\uFF08\u307E\u305F\u306F\u518D\u8AAD\u307F\u8FBC\u307F\uFF09\u3067\u65B0\u6A5F\u80FD\u3092\u30C1\u30A7\u30C3\u30AF\uFF01\u2728", p: "\uD83D\uDD04 \u65B0\u3057\u3044\u30D0\u30FC\u30B8\u30E7\u30F3 \u2014 \u518D\u8AAD\u307F\u8FBC\u307F" },
    zh: { m: "\uD83D\uDD04 BestAiGen \u521A\u521A\u66F4\u65B0 \u2014 \u6309 F5\uFF08\u6216\u5237\u65B0\uFF09\u770B\u770B\u6709\u4EC0\u4E48\u65B0\u53D8\u5316\uFF01\u2728", p: "\uD83D\uDD04 \u65B0\u7248\u672C \u2014 \u5237\u65B0" },
    ko: { m: "\uD83D\uDD04 BestAiGen\uC774 \uBC29\uAE08 \uC5C5\uB370\uC774\uD2B8\uB418\uC5C8\uC5B4\uC694 \u2014 F5(\uB610\uB294 \uC0C8\uB85C\uACE0\uCE68)\uB97C \uB20C\uB7EC \uBCC0\uACBD \uC0AC\uD56D\uC744 \uD655\uC778\uD558\uC138\uC694! \u2728", p: "\uD83D\uDD04 \uC0C8 \uBC84\uC804 \u2014 \uC0C8\uB85C\uACE0\uCE68" }
  };
  var vnShownFor = "";
  // NOTE: `root.buildVersion` arrives quoted (it reads back as "\"2.4.4\""), so the parser strips every
  // non-digit/non-dot character before comparing — otherwise the server build would always look "newer".
  ;function vnNums(v) { return String(v == null ? "" : v).replace(/[^0-9.]/g, "").split("."); }
  ;function vnCmp(a, b) {
    var pa = vnNums(a), pb = vnNums(b);
    var n = Math.max(pa.length, pb.length);
    for (var i = 0; i < n; i++) {
      var x = parseInt(pa[i] || "0", 10) || 0, y = parseInt(pb[i] || "0", 10) || 0;
      if (x !== y) return x < y ? -1 : 1;
    }
    return 0;
  }
  // ANNOUNCE THRESHOLD (Egon 18.09.2026): x.y.z -> only the LEADING "x.y" decides whether the notice is
  // worth showing. A z-only bump (e.g. 2.4.4 -> 2.4.5) is silent for already-open tabs; they simply pick
  // the new code up on their next reload. This is what keeps visitors from being nagged on every save.
  ;function vnKey(v) {
    var p = vnNums(v);
    return (parseInt(p[0] || "0", 10) || 0) + "." + (parseInt(p[1] || "0", 10) || 0);
  }
  ;function vnField(v, i) {
    var p = vnNums(v);
    return parseInt(p[i] || "0", 10) || 0;
  }
  ;function vnMine() { try { return String((window.root && window.root.buildVersion) || ""); } catch (e) { return ""; } }
  ;function dragonVersionCheck(serverBuild) {
    var mine = vnMine();
    if (!mine) return;
    var key = vnKey(serverBuild);
    if (vnCmp(key, vnKey(mine)) <= 0) return;               // no x.y jump — a z-only patch is NOT announced
    if (vnShownFor === key) return;                          // already handled in this page life
    try { if (sessionStorage.getItem("dragonVerNotice") === key) return; } catch (e) {}
    vnShownFor = key;
    try { sessionStorage.setItem("dragonVerNotice", key); } catch (e) {}
    var major = vnField(serverBuild, 0) > vnField(mine, 0);  // x changed -> the HUGE kind
    dragonVersionNotice(serverBuild, major);
  }
  // Egon 23.09.2026 — a HIDDEN tab must not spend its ONE notice on a screen nobody is looking at (and
  // mobile browsers FREEZE background tabs, so the visitor would come back to a banner that had already
  // scrolled by unseen): while the document is hidden the notice is PARKED, and it fires the moment the
  // tab is looked at again. This is the second half of the fix whose first half is dragonStatsWake()
  // below — the wake asks for a fresh stats payload, and its build reaches this function on a VISIBLE tab.
  var _vnPending = null, _vnVisBound = false;
  window.dragonVersionPending = function () { return _vnPending ? String(_vnPending.b) : null; };
  // The parked notice is replayed by this ONE named action, so the check-up can drive the resume without
  // faking a browser event (a synthetic visibilitychange would fire every other module's listener too).
  // Returns whether something was actually waiting.
  ;function dragonVersionResume() {
    var p = _vnPending;
    _vnPending = null;
    if (p) { try { dragonVersionNotice(p.b, p.m); } catch (e) {} }
    return !!p;
  }
  window.dragonVersionResume = dragonVersionResume;
  ;function dragonVersionNotice(serverBuild, major) {
    if (document.visibilityState && document.visibilityState !== "visible") {
      _vnPending = { b: serverBuild, m: !!major };
      // One PERSISTENT listener (not one per park) replays whatever is waiting once the tab is visible.
      if (!_vnVisBound) {
        _vnVisBound = true;
        try {
          document.addEventListener("visibilitychange", function () {
            if (document.visibilityState !== "visible") return;
            dragonVersionResume();
          });
        } catch (e) { _vnVisBound = false; }
      }
      return;
    }
    if (document.getElementById("dragonVersionBar")) return;
    var run = function () { renderVersionBar(serverBuild, major); };
    // 🎞️ the reload notice is a MARQUEE, so it asks the shared lane first (the news ticker waits for it
    // and vice versa) — Egon 20.09.2026.
    if (window.dragonMarquee) { window.dragonMarquee.request(run); return; }
    run();
  }
  // 🟣 Egon 20.09.2026 — PURPLE scrolling reload notice ("generator reload notice as scrolling text"
  // should be. Purple color"): left DOUBLE click reloads the page (on touch: TRIPLE tap), a single left click
  // stops the scroll (again = continue), a right click destroys it, and Dexa's head picture rides on the left.
  ;function renderVersionBar(serverBuild, major) {
    if (document.getElementById("dragonVersionBar")) { try { window.dragonMarquee.release(); } catch (e) {} return; }
    var lang = "en";
    try { lang = (dragonVisitorLang && dragonVisitorLang()) || "en"; } catch (e) {}
    var T = VN_TEXT[lang] || VN_TEXT.en;
    // Do not cover the news ticker / milestone banner: drop below whatever is already shown up there.
    var extra = 0;
    try {
      var nt = document.getElementById("dragonNewsTicker");
      if (nt && getComputedStyle(nt).display !== "none") extra += Math.round(nt.getBoundingClientRect().height) || 26;
      var mb = document.getElementById("dragonMilestoneBanner");
      if (mb) extra += Math.round(mb.getBoundingClientRect().height) || 30;
    } catch (e) {}
    var bar = document.createElement("div");
    bar.id = "dragonVersionBar";
    bar.title = T.m;
    // The HUGE (x) update keeps its hotter gold treatment; the normal NEW FEATURE (y) notice is PURPLE now.
    var skin = major
      ? "background:linear-gradient(90deg,#2a0b03,#7a2a00,#b8860b,#7a2a00,#2a0b03); border-bottom:1px solid #ffcf4d; color:#fff4d6;"
      : "background:linear-gradient(90deg,#1c0b33,#3d1b6b,#6a3fc0,#3d1b6b,#1c0b33); border-bottom:1px solid #a97bff; color:#f0e6ff;";
    bar.style.cssText =
      "position:fixed; left:0; right:0; top:calc(var(--dragon-nav-h,36px) + " + extra + "px); height:30px; box-sizing:border-box;" +
      "z-index:2147482200; display:flex; align-items:center; gap:.4rem; padding:0 .5rem; overflow:hidden; cursor:pointer;" +
      skin +
      "box-shadow:0 4px 16px rgba(0,0,0,.6); font-size:.8rem; font-weight:700; letter-spacing:.02em;" +
      "font-variant-numeric:tabular-nums; -webkit-user-select:none; user-select:none;";
    var clip = document.createElement("div");
    clip.style.cssText = "flex:1 1 auto; overflow:hidden; position:relative; height:100%;";
    var track = document.createElement("div");
    track.style.cssText = "position:absolute; left:0; top:0; height:100%; display:flex; align-items:center; will-change:transform;";
    var mqText = window.dragonMarqueeText ? window.dragonMarqueeText(T.m) : T.m;
    var unit = mqText + "\u00A0\u00A0\u00A0\u2022\u00A0\u00A0\u00A0";
    for (var i = 0; i < 2; i++) { var sp = document.createElement("span"); sp.textContent = unit; sp.style.cssText = "display:inline-block; white-space:nowrap;"; track.appendChild(sp); }
    clip.appendChild(track);
    var pill = document.createElement("span");
    pill.textContent = T.p;
    pill.style.cssText = "display:none; white-space:nowrap;";
    var x = document.createElement("button");
    x.type = "button";
    x.textContent = "\u2715";
    x.title = "Close";
    x.style.cssText = "flex:0 0 auto; background:transparent; border:0; color:" + (major ? "#fff4d6" : "#f0e6ff") + "; font-size:.8rem; cursor:pointer; padding:0 .15rem;";
    ;function dismiss() {
      try { if (window.dragonFastTipHide) window.dragonFastTipHide(); } catch (e) {}
      try { var el = bar; if (el.parentNode) el.parentNode.removeChild(el); } catch (e) {}
      try { window.dragonMarquee.release(); } catch (e) {}
    }
    ;function reload() { try { location.reload(); } catch (e) {} }
    x.onclick = function (e) { e.stopPropagation(); dismiss(); };
    x.setAttribute("data-dragon-gesture-skip", "");
    bar.appendChild(window.dragonMarqueeHead ? window.dragonMarqueeHead(20) : document.createTextNode(""));
    bar.appendChild(clip);
    bar.appendChild(pill);
    bar.appendChild(x);
    document.body.appendChild(bar);
    if (window.dragonMarqueeGestures) window.dragonMarqueeGestures(bar, { action: reload, dismiss: dismiss });
    // Egon 18.09.2026 — the live notice is raised ONLY for a NEW FEATURE (y) or a HUGE change (x); have Dexa
    // announce it in a bubble too (alongside the bar, once per release). z-only patches never reach here.
    try {
      if (window.dragonDexaUpdate) window.dragonDexaUpdate(String(serverBuild == null ? "" : serverBuild).replace(/[^0-9.]/g, ""), !!major);
    } catch (e) {}
    // Scroll ~3 loops, then shrink into a compact pill that stays until used or dismissed.
    requestAnimationFrame(function () {
      ;function toPill() {
        try {
          if (!bar.parentNode) { window.dragonMarquee.release(); return; }
          clip.style.display = "none";
          pill.style.display = "";
          bar.style.left = "auto";
          bar.style.height = "22px";
          bar.style.borderRadius = "0 0 10px 10px";
          bar.style.fontSize = ".74rem";
          bar.style.opacity = ".94";
          bar.__dragonPill = true;   // nothing left to stop → one click now runs the action (reload)
        } catch (e) {}
        try { window.dragonMarquee.release(); } catch (e) {}   // the scrolling is over: the lane is free
      }
      try {
        var w = track.firstChild.getBoundingClientRect().width || 1100;
        var speed = 95;
        var loopMs = Math.max(4500, Math.round((w / speed) * 1000));
        var loops = Math.max(2, Math.min(4, Math.round(30000 / loopMs)));
        var anim = track.animate(
          [{ transform: "translateX(0px)" }, { transform: "translateX(-" + w + "px)" }],
          { duration: loopMs, iterations: loops, easing: "linear" }
        );
        bar.__dragonAnim = anim;   // the gesture helper pauses/resumes THIS
        anim.onfinish = toPill;
      } catch (e) { setTimeout(toPill, 25000); }
    });
  }
  window.dragonVersionNotice = dragonVersionNotice;
  window.dragonVersionCheck = dragonVersionCheck;
  window.dragonVersionKey = vnKey;
  // ===== Egon 17.09.2026 (rule I70) — ONLINE MILESTONE CELEBRATION ===== see changelog [334].
  // When the live online counter crosses a multiple of 100 a festive scrolling banner ("scrolling text",
  // built with the Web Animations API exactly like the news ticker) drops in below the navbar and Dexa
  // celebrates in a speech bubble; multiples of 1000 get an EXTRAVAGANT version. The current hundred
  // band is tracked per browser session: the first value only records it (no banner on arrival) and a
  // celebration fires only when the counter CROSSES into a HIGHER hundred (Egon 18.09.2026 fix), so the
  // ~10s stats ticks can never repeat it and a visitor who lands at 170 never sees a "100 people" banner.
  // message lines. hi/big are the plain hundred / thousand celebrations and never claim a record; rec is
  // used ONLY when the server confirms that the all-time record has really been beaten; tick is the live
  // online-count ticker that scrolls by 30 seconds after arrival and again at the top of every hour.
  var MS_TEXT = {
    en: { hi: "🐉 {N} people are creating with BestAiGen right now — thanks for being here! ✨", big: "🔥🐉 {N} PEOPLE ONLINE — BestAiGen is busy right now! Thank you, legends! 🎊✨", rec: "🏆 {N} people are creating at the same time — a new BestAiGen record! 🐉✨", tick: "🐉 Right now {N} people just like you are using BestAiGen!" },
    tr: { hi: "🐉 Şu an BestAiGen'de {N} kişi üretiyor — burada olduğun için teşekkürler! ✨", big: "🔥🐉 Şu an {N} KİŞİ ONLINE — BestAiGen çok hareketli! Teşekkürler efsaneler! 🎊✨", rec: "🏆 Aynı anda {N} kişi üretiyor — yeni bir BestAiGen rekoru! 🐉✨", tick: "🐉 Şu an senin gibi {N} kişi BestAiGen kullanıyor!" },
    de: { hi: "🐉 Gerade erstellen {N} Leute mit BestAiGen — danke, dass du da bist! ✨", big: "🔥🐉 {N} LEUTE ONLINE — bei BestAiGen ist viel los! Danke, Legenden! 🎊✨", rec: "🏆 {N} Leute erstellen gleichzeitig — ein neuer BestAiGen-Rekord! 🐉✨", tick: "🐉 Gerade nutzen {N} Leute wie du BestAiGen!" },
    fr: { hi: "🐉 En ce moment, {N} personnes créent avec BestAiGen — merci d'être là ! ✨", big: "🔥🐉 {N} PERSONNES EN LIGNE — BestAiGen est très occupé ! Merci, légendes ! 🎊✨", rec: "🏆 {N} personnes créent en même temps — un nouveau record BestAiGen ! 🐉✨", tick: "🐉 En ce moment, {N} personnes comme toi utilisent BestAiGen !" },
    es: { hi: "🐉 Ahora mismo {N} personas crean con BestAiGen — ¡gracias por estar aquí! ✨", big: "🔥🐉 {N} PERSONAS EN LÍNEA — ¡BestAiGen está muy activo! ¡Gracias, leyendas! 🎊✨", rec: "🏆 {N} personas creando a la vez — ¡un nuevo récord de BestAiGen! 🐉✨", tick: "🐉 ¡Ahora mismo {N} personas como tú usan BestAiGen!" },
    it: { hi: "🐉 Proprio ora {N} persone stanno creando con BestAiGen — grazie di essere qui! ✨", big: "🔥🐉 {N} PERSONE ONLINE — BestAiGen è pieno di attività! Grazie, leggende! 🎊✨", rec: "🏆 {N} persone creano insieme — un nuovo record di BestAiGen! 🐉✨", tick: "🐉 Proprio ora {N} persone come te usano BestAiGen!" },
    ru: { hi: "🐉 Прямо сейчас {N} человек создают в BestAiGen — спасибо, что ты здесь! ✨", big: "🔥🐉 {N} ЧЕЛОВЕК ОНЛАЙН — в BestAiGen сейчас оживлённо! Спасибо, легенды! 🎊✨", rec: "🏆 {N} человек создают одновременно — новый рекорд BestAiGen! 🐉✨", tick: "🐉 Прямо сейчас {N} человек, таких как ты, используют BestAiGen!" },
    pt: { hi: "🐉 Agora mesmo {N} pessoas estão criando com o BestAiGen — obrigado por estares aqui! ✨", big: "🔥🐉 {N} PESSOAS ONLINE — o BestAiGen está cheio de atividade! Obrigado, lendas! 🎊✨", rec: "🏆 {N} pessoas a criar ao mesmo tempo — um novo recorde do BestAiGen! 🐉✨", tick: "🐉 Agora mesmo {N} pessoas como tu usam o BestAiGen!" },
    ar: { hi: "🐉 الآن {N} شخصًا يبدعون مع BestAiGen — شكرًا لوجودك هنا! ✨", big: "🔥🐉 {N} متصلون الآن — BestAiGen مليء بالنشاط! شكرًا أيها الأساطير! 🎊✨", rec: "🏆 {N} شخصًا يبدعون في الوقت نفسه — رقم قياسي جديد في BestAiGen! 🐉✨", tick: "🐉 الآن {N} أشخاص مثلك يستخدمون BestAiGen!" },
    nl: { hi: "🐉 Nu zijn {N} mensen aan het maken met BestAiGen — bedankt dat je er bent! ✨", big: "🔥🐉 {N} MENSEN ONLINE — het is druk bij BestAiGen! Bedankt, legendes! 🎊✨", rec: "🏆 {N} mensen maken tegelijk — een nieuw BestAiGen-record! 🐉✨", tick: "🐉 Nu gebruiken {N} mensen zoals jij BestAiGen!" },
    pl: { hi: "🐉 Właśnie teraz {N} osób tworzy w BestAiGen — dzięki, że jesteś! ✨", big: "🔥🐉 {N} OSÓB ONLINE — w BestAiGen jest gwarno! Dziękujemy, legendy! 🎊✨", rec: "🏆 {N} osób tworzy jednocześnie — nowy rekord BestAiGen! 🐉✨", tick: "🐉 Właśnie teraz {N} osób takich jak ty korzysta z BestAiGen!" },
    ja: { hi: "🐉 今 BestAiGen では {N} 人が制作中 — 来てくれてありがとう！✨", big: "🔥🐉 今 {N} 人がオンライン — BestAiGen は大賑わい！伝説たち、ありがとう！🎊✨", rec: "🏆 同時に {N} 人が制作中 — BestAiGen の新記録！🐉✨", tick: "🐉 今、あなたと同じように {N} 人が BestAiGen を使っています！" },
    zh: { hi: "🐉 现在有 {N} 人正在用 BestAiGen 创作 — 谢谢你的到来！✨", big: "🔥🐉 现在有 {N} 人在线 — BestAiGen 非常热闹！谢谢你们，传奇们！🎊✨", rec: "🏆 同时有 {N} 人在创作 — BestAiGen 新纪录！🐉✨", tick: "🐉 现在有 {N} 位像你一样的人正在使用 BestAiGen！" },
    ko: { hi: "🐉 지금 BestAiGen에서 {N}명이 만들고 있어요 — 와 주셔서 고마워요! ✨", big: "🔥🐉 지금 {N}명 온라인 — BestAiGen이 북적이고 있어요! 전설들, 고마워요! 🎊✨", rec: "🏆 동시에 {N}명이 만들고 있어요 — BestAiGen 신기록! 🐉✨", tick: "🐉 지금 당신처럼 {N}명이 BestAiGen을 사용하고 있어요!" }
  };
  ;function milestoneLang() {
    var L = "en";
    try { L = (window.dragonBotAPI && window.dragonBotAPI.lang && window.dragonBotAPI.lang()) || "en"; } catch (e) {}
    return L;
  }
  ;function milestoneText(key, n) {
    var pool = MS_TEXT[milestoneLang()] || MS_TEXT.en;
    return String(pool[key] || pool.hi || "").replace(/\{N\}/g, String(n));
  }
  ;function dragonMilestoneBanner(text, big, opts) {
    // 🎞️ this banner scrolls like the others, so it waits for the shared marquee lane too.
    // Egon 29.09.2026 — FRESH NUMBERS: when `opts.key` is given the text is (re)built at RENDER time, not
    // at queue time, so a banner that waited behind the lane never shows a stale count: the tick reads
    // the counter as it was 1 s before paint (Egon 03.10.2026 1-second rule — see dragonOnlineAt), a
    // peak it celebrates, or fresher when still climbing), and a record takes the latest server record.
    var run = function () {
      var t = text, n = (opts && opts.n) | 0;
      if (opts && opts.key) {
        var live = 0, rec = 0;
        try { live = Number(window.__dragonLastOnline) || 0; } catch (e) {}
        try { rec = Number(window.__dragonLastRecord) || 0; } catch (e) {}
        // Egon 03.10.2026 — 1-SECOND RULE: the tick shows the count from 1 s before it paints.
        if (opts.key === "tick") { var d1 = dragonOnlineAt(1000); n = d1 > 0 ? d1 : (live > 0 ? live : n); }
        else if (opts.key === "rec") n = rec > 0 ? rec : n;
        else if (live > n) n = live;
        t = milestoneText(opts.key, n);
      }
      renderMilestoneBanner(t, big, opts && opts.loops);
    };
    if (window.dragonMarquee) { window.dragonMarquee.request(run, opts && opts.priority ? { priority: true } : null); return; }
    run();
  }
  ;function renderMilestoneBanner(text, big, loopsOverride) {
    try { var old = document.getElementById("dragonMilestoneBanner"); if (old) old.remove(); } catch (e) {}
    var bar = document.createElement("div");
    bar.id = "dragonMilestoneBanner";
    bar.style.cssText =
      "position:fixed; left:0; right:0; top:var(--dragon-nav-h,36px); height:" + (big ? 42 : 30) + "px; box-sizing:border-box;" +
      "z-index:2147482100; display:flex; align-items:center; gap:.4rem; padding:0 .5rem; overflow:hidden; pointer-events:auto;" +
      "background:" + (big ? "linear-gradient(90deg,#3a1d6e,#b8860b,#7a4ddb,#b8860b,#3a1d6e)" : "linear-gradient(180deg,#3a1d6e,#1a0f33)") + ";" +
      "border-bottom:1px solid " + (big ? "#ffd24a" : "#9b6bff") + "; box-shadow:0 4px 18px rgba(0,0,0,.6);" +
      "color:" + (big ? "#ffe9a8" : "#e2d4ff") + "; font-weight:" + (big ? "900" : "800") + ";" +
      "font-size:" + (big ? "1.02rem" : ".8rem") + "; letter-spacing:.02em; text-shadow:0 1px 6px rgba(0,0,0,.6);";
    var clip = document.createElement("div");
    clip.style.cssText = "flex:1 1 auto; overflow:hidden; position:relative; height:100%;";
    var track = document.createElement("div");
    track.style.cssText = "position:absolute; left:0; top:0; height:100%; display:flex; align-items:center; will-change:transform;";
    // 🎞️ Egon 20.09.2026 — Dexa's head picture instead of the green dragon emoji: the 🐉 glyphs are
    // stripped from the (14-language) text and the avatar rides on the left of the bar.
    var mqText = window.dragonMarqueeText ? window.dragonMarqueeText(text) : text;
    var unit = mqText + "\u00A0\u00A0\u00A0✨\u00A0\u00A0\u00A0";
    for (var i = 0; i < 2; i++) { var s = document.createElement("span"); s.textContent = unit; s.style.cssText = "display:inline-block; white-space:nowrap;"; track.appendChild(s); }
    clip.appendChild(track);
    bar.appendChild(window.dragonMarqueeHead ? window.dragonMarqueeHead(big ? 26 : 20) : document.createTextNode(""));
    bar.appendChild(clip);
    document.body.appendChild(bar);
    ;function mqDismiss() {
      try { bar.style.transition = "opacity .35s ease"; bar.style.opacity = "0"; setTimeout(function () { try { bar.remove(); } catch (e) {} }, 400); } catch (e) {}
      try { window.dragonMarquee.release(); } catch (e) {}
    }
    if (window.dragonMarqueeGestures) window.dragonMarqueeGestures(bar, { dismiss: mqDismiss });
    requestAnimationFrame(function () {
      try {
        var w = track.firstChild.getBoundingClientRect().width || 900;
        var speed = big ? 130 : 95;
        var loopMs = Math.max(4000, Math.round((w / speed) * 1000));
        // Egon 29.09.2026 — the entry online-tick passes loops:1 so its line scrolls by exactly ONCE.
        var loops = loopsOverride > 0 ? loopsOverride : Math.max(2, Math.min(big ? 7 : 4, Math.round((big ? 45000 : 26000) / loopMs)));
        var anim = track.animate(
          [{ transform: "translateX(0px)" }, { transform: "translateX(-" + w + "px)" }],
          { duration: loopMs, iterations: loops, easing: "linear" }
        );
        bar.__dragonAnim = anim;   // the gesture helper pauses/resumes THIS
        anim.onfinish = function () {
          try { bar.style.transition = "opacity .4s ease"; bar.style.opacity = "0"; setTimeout(function () { try { bar.remove(); } catch (e) {} }, 450); } catch (e) {}
          try { window.dragonMarquee.release(); } catch (e) {}
        };
      } catch (e) { setTimeout(function () { try { bar.remove(); } catch (e2) {} try { window.dragonMarquee.release(); } catch (e3) {} }, 26000); }
    });
  }
  ;function dragonMilestoneConfetti() {
    var emo = ["🎉", "✨", "🐉", "🎊", "⭐", "💎", "🥳", "🎈"];
    for (var i = 0; i < 46; i++) {
      (function () {
        var s = document.createElement("div");
        s.textContent = emo[i % emo.length];
        s.style.cssText = "position:fixed; top:-8vh; left:" + (Math.random() * 100).toFixed(2) + "vw; z-index:2147482099; pointer-events:none; font-size:" + (14 + Math.random() * 22).toFixed(1) + "px; will-change:transform,opacity;";
        document.body.appendChild(s);
        try {
          var anim = s.animate([
            { transform: "translateY(0) rotate(0deg)", opacity: 1 },
            { transform: "translateY(" + (92 + Math.random() * 30).toFixed(1) + "vh) rotate(" + (Math.random() * 720 - 360).toFixed(0) + "deg)", opacity: 0 }
          ], { duration: 2600 + Math.random() * 2800, delay: Math.random() * 1300, easing: "cubic-bezier(.3,.6,.5,1)", fill: "forwards" });
          anim.onfinish = function () { try { s.remove(); } catch (e) {} };
        } catch (e) { setTimeout(function () { try { s.remove(); } catch (e2) {} }, 6000); }
      })();
    }
  }
  ;function dragonMilestoneCelebrate(n, opts) {
    opts = opts || {};
    var big = !!(opts.big || (n % 1000 === 0));
    var key = opts.record ? "rec" : (big ? "big" : "hi");
    var raw = milestoneText(key, n);
    // Egon 29.09.2026 — a RECORD jumps the lane (priority) so it is news while it is still true; the
    // 1-minute throttle in dragonRecordCheck still caps it.
    try { dragonMilestoneBanner(raw, big, { key: key, n: n, priority: !!opts.record }); } catch (e) {}
    if (big) { try { dragonMilestoneConfetti(); } catch (e) {} }
    try { if (window.dragonDexaMilestone) window.dragonDexaMilestone(n, big); } catch (e) {}
  }
  // Egon 18.09.2026 — FIX: the old version used Math.floor(n/100)*100, i.e. the HUNDRED BAND the
  // visitor happened to be in (170 → 100), and sessionStorage was empty in every fresh tab — so every
  // new visitor / F5 got a stale "🎉 100 people are creating…" banner even though the counter read 170.
  // Now the FIRST online value of a session only REMEMBERS the current band (no celebration on arrival),
  // and a banner fires only when the counter CROSSES into a HIGHER hundred during the session. The
  // banner always shows the LIVE count at that moment (not the band floor).
  ;function dragonMilestoneCheck(n) {
    // Hundred-band milestone celebrations are disabled: crossing into a higher
    // hundred shows no banner and fires no Dexa bubble. Genuine new records
    // still celebrate through dragonRecordCheck.
    return;
    if (!(n >= 100)) return;
    var band = Math.floor(n / 100) * 100;
    var seenBand = 0;
    try { seenBand = Number(sessionStorage.dragonMilestoneBand) || 0; } catch (e) {}
    if (!seenBand) { try { sessionStorage.dragonMilestoneBand = String(band); } catch (e) {} return; }
    if (band <= seenBand) { _dragonMsPendingBand = 0; return; }
    // Egon 29.09.2026 — CONFIRMATION: a single stats tick can carry a phantom spike (a reconnect briefly
    // counts a browser twice). The new band must be reported on TWO consecutive ticks before it is
    // celebrated; the second sighting celebrates with the freshest number.
    if (_dragonMsPendingBand === band) {
      _dragonMsPendingBand = 0;
      try { sessionStorage.dragonMilestoneBand = String(band); } catch (e) {}
      dragonMilestoneCelebrate(n, { big: band % 1000 === 0 });
    } else {
      _dragonMsPendingBand = band;
    }
  }
  var _dragonMsPendingBand = 0;
  window.dragonMilestoneCheck = dragonMilestoneCheck;
  window.dragonMilestoneCelebrate = dragonMilestoneCelebrate;
  // Egon 18.09.2026 — 🏆 ONLINE RECORD celebration. The record itself is tracked authoritatively by the
  // server (it only ever grows), so the client simply watches for it being BEATEN while this browser is
  // watching. The first value seen in a session is only remembered (no celebration on arrival), and a
  // new record celebrates at most once a minute so a growth spurt cannot spam the banner.
  var _dragonRecLastParty = 0, _dragonRecPending = 0;
  ;function dragonRecordCheck(rec) {
    if (!(rec > 0)) return;
    var prev = 0;
    try { prev = Number(sessionStorage.dragonRecordSeen) || 0; } catch (e) {}
    if (!prev) { try { sessionStorage.dragonRecordSeen = String(rec); } catch (e) {} return; }
    // Egon 29.09.2026 — CONFIRMATION: one tick's phantom spike must never become a "record" banner. The
    // new high is celebrated only if it is still there on the NEXT payload (or climbing); still at most
    // once a minute.
    if (rec > prev || (_dragonRecPending && rec >= _dragonRecPending)) {
      try { if (rec > prev) sessionStorage.dragonRecordSeen = String(rec); } catch (e) {}
      var confirmed = !!(_dragonRecPending && rec >= _dragonRecPending);
      _dragonRecPending = rec;
      if (confirmed && (Date.now() - _dragonRecLastParty) > 60000) {
        _dragonRecPending = 0;
        _dragonRecLastParty = Date.now();
        dragonMilestoneCelebrate(rec, { record: true });
      }
    } else {
      _dragonRecPending = 0;
    }
  }
  window.dragonRecordCheck = dragonRecordCheck;
  // Egon 19.09.2026 — 🐉 ONLINE-COUNT TICKER. The live count scrolls by once, 30 seconds after the visitor
  // arrives, and then again at the TOP OF EVERY HOUR for everyone who has the page open. It reads the last
  // count the stats socket delivered (window.__dragonLastOnline) and reuses the celebration bar's look, so it
  // can never stack with a milestone banner.
  ;function dragonOnlineTick(once) {
    return false;
    // DEPOT (Egon 08.10.2026) — the online-count ticker is parked: the lines below scrolled the live
    // count 30s after arrival + hourly. Record banners (dragonRecordCheck) still celebrate as before.
    var n = 0;
    try { n = Number(window.__dragonLastOnline) || 0; } catch (e) { n = 0; }
    if (!(n > 0)) return false;
    if (document.visibilityState && document.visibilityState !== "visible") {
      if (!dragonOnlineTick.__waiting) {
        dragonOnlineTick.__waiting = true;
        var onVis = function () {
          if (document.visibilityState !== "visible") return;
          document.removeEventListener("visibilitychange", onVis);
          dragonOnlineTick.__waiting = false;
          dragonOnlineTick(once);
        };
        try { document.addEventListener("visibilitychange", onVis); } catch (e) { dragonOnlineTick.__waiting = false; }
      }
      return false;
    }
    var raw = milestoneText("tick", n);
    if (!raw) return false;
    // Egon 29.09.2026 — the ENTRY tick scrolls its line exactly ONCE (loops:1); the hourly one keeps the
    // normal loops. The number is refreshed at render time to the count from 1 s before paint (key:"tick",
    // Egon 03.10.2026 1-second rule), so a queued tick can never show a stale count next to the live counter.
    try { dragonMilestoneBanner(raw, false, { key: "tick", n: n, loops: once ? 1 : 0 }); } catch (e) { return false; }
    return true;
  }
  window.dragonOnlineTick = dragonOnlineTick;
  // DEPOT (Egon 08.10.2026) — online-tick schedule parked (30s entry tick + hourly tick).
  (function dragonOnlineTickSchedule() {
    return;
    setTimeout(function () { dragonOnlineTick(true); }, 30000);
    (function nextHour() {
      var now = new Date();
      var next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
      setTimeout(function () { dragonOnlineTick(); nextHour(); }, Math.max(1000, next.getTime() - Date.now()));
    })();
  })();
  // Egon 14.09.2026 — About "Did you like this generator?" vote (star 1..5). Server dedupes by rough
  // network; the client just sends and reflects the authoritative totals it gets back.
  window.dragonRateVote = function (star) {
    var n = parseInt(star, 10);
    if (!(n >= 1 && n <= 5)) return;
    try { localStorage.dragonRated = "1"; } catch (e) {}
    if (socket) {
      try { socket.rpc.dragonRate(String(n)).then(function (s) { try { window.dragonRefreshRateUI(JSON.parse(s)); } catch (e) {} }).catch(function () {}); } catch (e) {}
    } else if (window.dragonRefreshRateUI) {
      window.dragonRefreshRateUI(window.__dragonLastRatings || null);
    }
  };
  // DEPOT (Egon 17.09.2026) — the old paginated PUBLIC-gallery image counter (`countGallery`, wrote to
  // localStorage.dragonStatsGalCache and the "Image in Gallery" row) and the PRIVATE "Image in Private"
  // counter were removed at Egon's request. Their full source is parked in the internal dev library
  // (Librarybook → "## PARKED CODE (DEPO)") and can be restored from there if ever needed.
  // ===== 🌐 VISITORS — where the people online come from (Settings > Visitors panel) =====
  // This browser's own country is looked up (result cached in sessionStorage + a 24h localStorage cache) from a
  // CORS-enabled geo API, then reported to the stats server. The server groups the live connections by country
  // and broadcasts that map; the panel below renders it A→Z as compact flag + count chips.
  var visitorCC = "";
  var DRAGON_CC_TTL = 24 * 3600000;
  try {
    visitorCC = String(sessionStorage.dragonVisitorCC || "").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 2);
    if (visitorCC.length !== 2) {
      var _ccL = String(localStorage.dragonVisitorCC || "").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 2);
      var _ccTs = Number(localStorage.dragonVisitorCCts) || 0;
      visitorCC = (_ccL.length === 2 && Date.now() - _ccTs < DRAGON_CC_TTL) ? _ccL : "";
      if (visitorCC) { try { sessionStorage.dragonVisitorCC = visitorCC; } catch (e) {} }
    }
  } catch (e) { visitorCC = ""; }
  ;function dragonVisitorLang() {
    var l = "en";
    try { l = (window.dragonBotAPI && window.dragonBotAPI.lang && window.dragonBotAPI.lang()) || "en"; } catch (e) {}
    return /^[a-z]{2}$/i.test(l) ? l.toLowerCase() : "en";
  }
  var _dragonRegionNames = null, _dragonRegionLang = "";
  // Official-name overrides applied AFTER localization so EVERY interface language shows the same name.
  // TR's official name is "Türkiye" — older English CLDR still says "Turkey", so force it everywhere.
  var DRAGON_NAME_OVERRIDE = { TR: "T\u00FCrkiye" };
  ;function dragonCountryName(cc) {
    var up = String(cc || "").toUpperCase();
    if (!/^[A-Z]{2}$/.test(up)) return up || "?";
    if (DRAGON_NAME_OVERRIDE[up]) return DRAGON_NAME_OVERRIDE[up];
    try {
      var lang = dragonVisitorLang();
      if (!_dragonRegionNames || _dragonRegionLang !== lang) {
        _dragonRegionNames = new Intl.DisplayNames([lang, "en"], { type: "region" });
        _dragonRegionLang = lang;
      }
      var nm = _dragonRegionNames.of(up);
      if (nm && nm.toUpperCase() !== up) return nm;
    } catch (e) {}
    return up;
  }
  ;function dragonFlagEmoji(cc) {
    var s = String(cc || "").toUpperCase();
    if (!/^[A-Z]{2}$/.test(s)) return "\uD83C\uDF10"; // 🌐
    var A = 0x1F1E6;
    return String.fromCodePoint(A + s.charCodeAt(0) - 65, A + s.charCodeAt(1) - 65);
  }
  var _dragonRegionNamesEn = null;
  // English region name (always "en"), used ONLY for sorting the visitor chips regardless of UI language.
  ;function dragonCountryNameEn(cc) {
    var up = String(cc || "").toUpperCase();
    if (!/^[A-Z]{2}$/.test(up)) return up || "?";
    if (DRAGON_NAME_OVERRIDE[up]) return DRAGON_NAME_OVERRIDE[up];
    try {
      if (!_dragonRegionNamesEn) _dragonRegionNamesEn = new Intl.DisplayNames(["en"], { type: "region" });
      var nm = _dragonRegionNamesEn.of(up);
      if (nm && nm.toUpperCase() !== up) return nm;
    } catch (e) {}
    return up;
  }
  // A real flag IMAGE (flagcdn PNG, 2x for retina). Windows renders regional-indicator emoji as plain letters
  // ("DE"/"US"/"BR"), so an image is the only way to guarantee a flag on every platform; on load error we fall
  // back to the emoji (correct on macOS/iOS/Android, letters on Windows — still better than nothing).
  ;function dragonFlagImg(cc) {
    var img = document.createElement("img");
    img.className = "dragon-visitors-flag-img";
    var lc = String(cc || "").toLowerCase();
    img.src = "https://flagcdn.com/w20/" + lc + ".png";
    img.srcset = "https://flagcdn.com/w40/" + lc + ".png 2x";
    img.alt = String(cc || "").toUpperCase();
    img.loading = "eager";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.addEventListener("error", function () {
      var sp = document.createElement("span"); sp.className = "dragon-visitors-flag"; sp.textContent = dragonFlagEmoji(cc);
      if (img.parentNode) img.parentNode.replaceChild(sp, img);
    });
    return img;
  }
  ;function dragonReportCountry() {
    // 🌐 Egon 26.09.2026 — reporting now goes through dragonIdentifySocket(), which covers EVERY socket this
    // client opens (stats · chat · cloud) and waits for the geo answer itself. This named
    // seam is kept because the rest of the module calls it, and re-arming is idempotent.
    try { if (socket) dragonIdentifySocket(socket); } catch (e) {}
  }
  ;function dragonDetectCountry() {
    if (visitorCC) { dragonReportCountry(); return; }
    if (!window.fetch) return;
    var done = false;
    // Every provider is fired AT ONCE and the first valid answer wins (the old version tried them one after
    // another with a 9s timeout each, so slow lookups made the numbers trickle in for up to ~18s).
    ;function finish(cc) {
      if (done) return;
      cc = String(cc || "").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 2);
      if (cc.length !== 2) return;
      done = true;
      visitorCC = cc;
      try { sessionStorage.dragonVisitorCC = cc; } catch (e) {}
      try { localStorage.dragonVisitorCC = cc; localStorage.dragonVisitorCCts = String(Date.now()); } catch (e) {}
      dragonReportCountry();
      dragonIdentifyFlush();   // 🌐 every other socket this client holds learns the country too
      if (window.dragonRefreshVisitorsPanel) window.dragonRefreshVisitorsPanel();
    }
    var providers = [
      function () { return fetch("https://api.country.is/", { mode: "cors", cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) { return j && j.country; }); },
      function () { return fetch("https://get.geojs.io/v1/ip/country.json", { mode: "cors", cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) { return j && j.country; }); },
      function () { return fetch("https://ipwho.is/", { mode: "cors", cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) { return j && j.country_code; }); },
      function () { return fetch("https://api.myip.com", { mode: "cors", cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) { return j && j.cc; }); },
      function () { return fetch("https://ipapi.co/country/", { mode: "cors", cache: "no-store" }).then(function (r) { return r.text(); }); },
      // 🌐 Egon 26.09.2026 — one more independent answer, so a visitor is not left as "unknown" just
      // because the first five were rate-limited or blocked by their network.
      function () { return fetch("https://ifconfig.co/country-iso", { mode: "cors", cache: "no-store" }).then(function (r) { return r.text(); }); },
      // Four more independent answers (verified CORS-reachable 08.10.2026, raced in parallel like the rest —
      // every provider has its own per-IP quota, so more providers means fewer "unknown" visitors).
      function () { return fetch("https://freeipapi.com/api/json", { mode: "cors", cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) { return j && j.countryCode; }); },
      function () { return fetch("https://api.ip.sb/geoip", { mode: "cors", cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) { return j && j.country_code; }); },
      function () { return fetch("https://www.cloudflare.com/cdn-cgi/trace", { mode: "cors", cache: "no-store" }).then(function (r) { return r.text(); }).then(function (t) { var m = String(t || "").match(/^loc=(.+)$/m); return m && m[1]; }); },
      function () { return fetch("https://ipinfo.io/json", { mode: "cors", cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) { return j && j.country; }); }
    ];
    for (var i = 0; i < providers.length; i++) {
      (function (fn) { Promise.resolve().then(fn).then(function (cc) { finish(cc); }).catch(function () {}); })(providers[i]);
    }
  }
  // 🌐 Egon 26.09.2026 — EVERY SOCKET WE OPEN REPORTS WHICH COUNTRY IT IS IN.
  // WHY: one visitor opens MORE THAN ONE socket (live stats · chat · cloud sync) and only
  // the live-stats socket used to report a country, so the Visitors panel counted all the other connections
  // as "unknown" and showed globes instead of flags ("bayraklı gösterim geri gelsin"). This helper is called
  // for EVERY socket the factory hands out (see the wrapper right below): the moment we know the country —
  // now, or later when the geo lookup answers — that socket reports it, together with its device kind.
  var _dragonIdSocks = [];
  ;function dragonPresencePack() {
    var u = "";
    try {
      var saved = JSON.parse(localStorage.getItem("dragonCloudUser") || "null");
      if (saved && saved.u) u = String(saved.u).trim().toLowerCase();
    } catch (e) {}
    if (u && !/^[a-z0-9_-]{3,24}$/.test(u)) u = "";
    return browserId + (u ? "|" + u : "");
  }
  window.dragonPresencePack = dragonPresencePack;
  window.dragonPresenceReport = function () {
    try {
      var o = window.__dragonStatsSockets ? window.__dragonStatsSockets() : null;
      var sk = o && o.socket;
      if (!sk || !sk.rpc || !sk.rpc.dragonPresencePing) return false;
      sk.rpc.dragonPresencePing(dragonPresencePack()).then(function (s) { try { applyStats(JSON.parse(s)); } catch (e) {} }).catch(function () {});
      return true;
    } catch (e) { return false; }
  };
  ;function dragonBindPresence(sk) {
    if (!sk || sk.__dragonPresMark) return;
    sk.__dragonPresMark = true;
    function bind() {
      try {
        if (sk.readyState != null && sk.readyState !== 1) return;
        if (sk.rpc && sk.rpc.dragonPresence) sk.rpc.dragonPresence(dragonPresencePack()).then(function (s) { try { applyStats(JSON.parse(s)); } catch (e) {} }).catch(function () {});
      } catch (e) {}
    }
    try {
      if (sk.readyState === 1) bind();
      else sk.addEventListener("open", bind);
    } catch (e) {}
  }
  ;function dragonIdentifySocket(sk) {
    if (!sk || sk.__dragonIdMark) return;
    sk.__dragonIdMark = true;
    // Every socket this client opens (stats, gallery, chat, cloud) binds to the one per-browser id,
    // so the server can count browsers and share the country between sibling sockets. Heartbeat stays
    // on the stats socket only.
    try { dragonBindPresence(sk); } catch (e) {}
    var sent = false;
    ;function send() {
      if (sent) return;
      if (!visitorCC) return;   // the geo answer is not in yet — dragonIdentifyFlush() calls us again
      // Not open yet? Leave it armed: the "open" listener (or the next flush) will come back to us.
      try { if (sk.readyState != null && sk.readyState !== 1) return; } catch (e) {}
      sent = true;
      try { var i = _dragonIdSocks.indexOf(send); if (i !== -1) _dragonIdSocks.splice(i, 1); } catch (e) {}
      try { sk.rpc.dragonSetCountry(visitorCC).then(function (s) { try { applyStats(JSON.parse(s)); } catch (e) {} }).catch(function () {}); } catch (e) {}
      try { var k = dragonDetectDevice(); sk.rpc.dragonSetDevice(k).catch(function () {}); } catch (e) {}
    }
    try {
      if (sk.readyState === 1) send();
      else sk.addEventListener("open", send);
    } catch (e) {}
    if (!sent) _dragonIdSocks.push(send);
  }
  ;function dragonIdentifyFlush() {
    var fns = _dragonIdSocks.slice(0);
    for (var i = 0; i < fns.length; i++) { try { fns[i](); } catch (e) {} }
  }
  window.dragonIdentifySocket = dragonIdentifySocket;
  // NO monkey-patch of root.createServerSocket: `root` is the engine's PROXY and reading one of its
  // properties hands out a fresh wrapper function every time (measured 26.09.2026: the identity of
  // root.createServerSocket changes on every single read), so a patch installed there is never seen by the
  // modules that call it. Instead every place that opens a socket asks this helper to identify it — the
  // live-stats socket (connectStats) plus the two other sockets of the site:
  //   · src/dragon-comments.js    (the chat / comments channel)
  //   · src/dragon-cloud.js       (cloud save sync)
  // The server ALSO hands the country to every connection that shares the reporting connection's network
  // fingerprint (dragonSetCountry), so a socket that can never speak still shows its flag.
  window.dragonVisitorsSelf = function () { return visitorCC; };
  // Renders the compact chip row: one chip per country = small flag + live count, A→Z by localized name.
  // While some connections have not reported yet, a dim dashed globe chip with that count is appended so the
  // visible numbers stay explainable against the navbar's online total. Country names live in the tooltip.
  // ===== 📱💻 VISITOR DEVICE (mobile vs desktop) — restored 24.09.2026 (W-UX271; W-CLEAN218 had parked it) =====
  // One cheap, purely local pass — no request, no library, no cost. "mobile" covers phones AND tablets (a
  // phone/tablet is one bucket); everything else counts as "desktop". Reported ONCE per browser session,
  // exactly like the country report above; presence is ephemeral, so nothing is persisted here.
  ;function dragonDetectDevice() {
    var nav = (typeof navigator !== "undefined") ? navigator : {};
    var ua = String(nav.userAgent || "");
    try { if (nav.userAgentData && typeof nav.userAgentData.mobile === "boolean") return nav.userAgentData.mobile ? "mobile" : "desktop"; } catch (e) {}
    if (/iPad|Tablet|PlayBook|Silk|Windows Phone|IEMobile|Opera Mini|Mobile|iPhone|iPod/i.test(ua)) return "mobile";
    if (/Android/i.test(ua)) return "mobile";
    var touch = (Number(nav.maxTouchPoints) > 0) || (Number(nav.msMaxTouchPoints) > 0);
    var coarse = false;
    try { coarse = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches); } catch (e) {}
    if (touch && coarse) return "mobile";
    return "desktop";
  }
  ;function dragonReportDevice() {
    if (!socket || !socket.rpc) return;
    var kind = dragonDetectDevice();
    if (window.__dragonDeviceReported === kind) return;
    window.__dragonDeviceReported = kind;
    try {
      socket.rpc.dragonSetDevice(kind).then(function (s) {
        try { applyStats(JSON.parse(s)); } catch (e) {}
      }).catch(function () { window.__dragonDeviceReported = ""; });
    } catch (e) { window.__dragonDeviceReported = ""; }
  }
  window.dragonDetectDevice = dragonDetectDevice;
  window.dragonReportDevice = dragonReportDevice;
  // 🖥️/📱 The symbol is a plain emoji here (Egon 24.09.2026: "change the emoji/symbol") — the previous
  // 20x14 line-art SVG pair was thrown away with the parked block, so nothing is carried over verbatim.
  ;function dragonDeviceIcon(kind) {
    var box = document.createElement("span");
    box.className = "dragon-visitors-devicon-box";
    var ic = document.createElement("span");
    ic.className = "dragon-visitors-devicon";
    ic.setAttribute("aria-hidden", "true");
    ic.textContent = (kind === "desktop") ? "\uD83D\uDDA5\uFE0F" : "\uD83D\uDCF1";
    box.appendChild(ic);
    return box;
  }
  ;function renderVisitorDevices(el) {
    if (!el) return;
    var dv = window.__dragonVisitorDevices || { mobile: 0, desktop: 0, unknown: 0 };
    var m = Number(dv.mobile) || 0, d = Number(dv.desktop) || 0, u = Number(dv.unknown) || 0;
    var sig = m + "|" + d + "|" + u;
    if (el.__dragonSig === sig) return;
    el.__dragonSig = sig;
    el.textContent = "";
    if (!m && !d) { el.hidden = true; return; }
    el.hidden = false;
    ;function devChip(kind, num, label) {
      var chip = document.createElement("span");
      chip.className = "dragon-visitors-chip dragon-visitors-device";
      // Plain, human tooltip — Egon 24.09.2026: "no weird code-like things in the tooltip", so the title is
      // a short sentence and never carries markup or escape sequences.
      chip.title = label + " online: " + num + (u > 0 ? " (" + u + " not reported yet)" : "");
      chip.appendChild(dragonDeviceIcon(kind));
      var c = document.createElement("b"); c.className = "dragon-visitors-count"; c.textContent = String(num);
      chip.appendChild(c);
      return chip;
    }
    if (m > 0) el.appendChild(devChip("mobile", m, "Phone / tablet"));
    if (d > 0) el.appendChild(devChip("desktop", d, "Computer"));
  }
  window.dragonRefreshVisitorsPanel = function () {
    // Egon 20.09.2026 — the card's title line carries the LIVE online count next to "🌐 Visitors".
    try {
      var hd = document.getElementById("dragonVisitorsHdrCount");
      if (hd) {
        var n = window.__dragonLastOnline;
        hd.textContent = (typeof n === "number") ? "\u00B7 " + n + " online now" : "";
      }
    } catch (e) {}
    var host = document.getElementById("dragonVisitorsList");
    if (!host) return;
    // 📱💻 W-UX271: the device pair is PINNED — its own container, created once, always kept as the FIRST
    // child, so the country rebuild below can never move it, re-sort it or wipe it.
    var devHost = document.getElementById("dragonVisitorsDevices");
    if (!devHost) {
      devHost = document.createElement("span");
      devHost.id = "dragonVisitorsDevices";
      devHost.className = "dragon-visitors-devices";
      host.appendChild(devHost);
    }
    if (host.firstChild !== devHost) host.insertBefore(devHost, host.firstChild);
    renderVisitorDevices(devHost);
    var counts = (window.__dragonVisitorCountries && typeof window.__dragonVisitorCountries === "object") ? window.__dragonVisitorCountries : {};
    var unknown = Number(window.__dragonOnlineUnknown) || 0;
    var rows = [];
    for (var cc in counts) {
      if (!Object.prototype.hasOwnProperty.call(counts, cc)) continue;
      var n = Number(counts[cc]) || 0;
      if (n <= 0) continue;
      rows.push({ cc: cc, n: n, name: dragonCountryName(cc), nameEn: dragonCountryNameEn(cc), unknown: false });
    }
    // The "unknown" bucket counts like any other country (owner: 95 unknown must rank #1 today).
    if (unknown > 0) rows.push({ cc: "", n: unknown, nameEn: "", unknown: true });
    // Count DESC (most visited first — per owner request); equal counts tiebreak by ENGLISH name
    // (language-independent), then country code, so the order is stable between renders. The globe
    // "unknown" row sorts after known countries on an equal count.
    rows.sort(function (a, b) {
      if (a.n !== b.n) return b.n - a.n;
      if (a.unknown !== b.unknown) return a.unknown ? 1 : -1;
      if (a.nameEn !== b.nameEn) return a.nameEn < b.nameEn ? -1 : 1;
      return a.cc < b.cc ? -1 : a.cc > b.cc ? 1 : 0;
    });
    for (var ui = 0; ui < rows.length; ui++) {
      if (rows[ui].unknown) { rows.unshift(rows.splice(ui, 1)[0]); break; }
    }
    // Skip the rebuild when nothing changed. The panel re-renders on every stats broadcast, and
    // swapping the chips out from under a hovering mouse removed/re-added the node, which made the
    // fast tooltip flicker (owner report). A new host element has no signature, so it renders once.
    var sig = rows.map(function (r) { return r.cc + ":" + r.n; }).join(",");
    if (host.__dragonSig === sig) return;
    host.__dragonSig = sig;
    // Clear the country chips only — the pinned device pair (devHost) stays untouched (W-UX271).
    while (devHost.nextSibling) host.removeChild(devHost.nextSibling);
    // Compact chip = flag IMAGE + live count. An empty/globe chip is the "unknown" bucket.
    ;function chip(cc, num, cls, title, globe) {
      var el = document.createElement("span");
      el.className = "dragon-visitors-chip" + (cls ? " " + cls : "");
      if (title) el.title = title;
      var f;
      if (globe || !/^[A-Za-z]{2}$/.test(String(cc))) {
        f = document.createElement("span"); f.className = "dragon-visitors-flag"; f.textContent = "\uD83C\uDF10";
      } else {
        f = dragonFlagImg(cc);
      }
      var c = document.createElement("b"); c.className = "dragon-visitors-count"; c.textContent = String(num);
      el.append(f, c);
      return el;
    }
    if (!rows.length) {
      if (!devHost.childElementCount) {
        var empty = document.createElement("div");
        empty.className = "dragon-visitors-empty";
        empty.textContent = "No visitors online right now.";
        host.appendChild(empty);
      }
      return;
    }
    // Chip tooltips use the LOCALIZED country name (the VIEWER's own browser language), exactly as the
    // panel has always done — it reflects the viewer, never the owner. Sorting still uses the English name.
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.unknown) host.appendChild(chip("", r.n, "dragon-visitors-unknown", r.n + " connection(s) have not reported a country yet", true));
      else host.appendChild(chip(r.cc, r.n, "", r.name + " \u2014 " + r.n + " online"));
    }
  };
  // 🌐 Visitors — Egon 23.09.2026 (W-UI224): "merge visitors panel with visitor stats panel, underneath
  // koy." The stand-alone 🌐 Visitors card is RETIRED; the SAME content (header + live count + country
  // chips) now sits at the BOTTOM of the 📊 Visitor Stats board (appended by
  // dragonBuildStatsCard below), so Settings carries ONE combined panel instead of two. `dragonBuildVisitorsCard`
  // is kept for the caller in dragon-pages.js and returns null; the retired markup is parked in the internal
  // library (Librarybook DEPO).
  ;function dragonVisitorsBlock() {
    var box = document.createElement("div");
    box.className = "dragon-visitors-block";
    // Egon 20.09.2026 — "🌐 Visitors" is followed by the live count of people online right now.
    var h = document.createElement("div");
    h.className = "dragon-set-h";
    h.style.marginTop = ".7rem";
    h.textContent = "🌐 Visitors";
    var hc = document.createElement("span");
    hc.id = "dragonVisitorsHdrCount";
    hc.style.cssText = "margin-left:.45rem; font-size:.78rem; color:#6ef0a0; font-weight:700; white-space:nowrap;";
    hc.textContent = "";
    h.appendChild(hc);
    var list = document.createElement("div");
    list.id = "dragonVisitorsList";
    list.className = "dragon-visitors-list";
    list.textContent = "…";
    box.append(h, list);
    return box;
  }
  window.dragonVisitorsBlock = dragonVisitorsBlock;
  window.dragonBuildVisitorsCard = function () { return null; };
  // ===== 📊 VISITOR STATS board (Settings) — how many people were online, last 24 hours / last 7 days =====
  // Data comes from the server's durable online-history rings (rpc.dragonOnlineHistory; see the ONLINE
  // HISTORY block in the server script). It is fetched ONLY when the board is built, when a view button or
  // ⟳ is pressed, and at most once every 30s while the card is actually on screen — and it is drawn into a
  // plain canvas with no animation loop, so the generator's frame budget and the socket stay untouched
  // while the board is closed.
  var statsData = null;   // { nowMin, nowHour, min[], hour[] } — null until the first fetch lands
  var statsFetching = false;
  var statsFetchStart = 0;   // when the in-flight fetch started (8 s after this it may be superseded)
  var statsCbQueue = [];     // callbacks that arrived while a fetch was in flight — they are never dropped
  var statsFail = false;     // last fetch could not reach the server (the board says so instead of "Loading…")
  var statsView = "24h";  // "24h" | "7d" | "30d" | "months"
  var statsAt = 0;        // when statsData arrived
  var statsLastW = 0;     // width of the last draw (a resize forces a redraw)
  var statsBox = null;
  var statsHl = null; // hovered slice {i, k} — the only slice ever drawn (see statsHover)    // last draw's geometry, used to hit-test the hover tooltip
  ;function statsPad2(n) { return (n < 10 ? "0" : "") + n; }
  ;function statsRing(arr, idx) { var n = arr.length, i = idx % n; if (i < 0) i += n; return arr[i]; }
  ;function statsCanvasWrap() { return document.getElementById("dragonStatsCanvasWrap"); }
  ;function statsWrapWidth() { var w = statsCanvasWrap(); return w ? Math.floor(w.clientWidth || 0) : 0; }
  ;function statsCardVisible() {
    var card = document.getElementById("dragonStatsCard");
    return !!(card && card.offsetParent !== null);
  }
  ;function statsFetch(force, cb) {
    var o = window.__dragonStatsSockets ? window.__dragonStatsSockets() : null;
    var sk = o && o.socket;
    if (!force && statsData && Date.now() - statsAt < 30000) { if (cb) cb(); return; }
    if (!sk) { if (cb) cb(); return; }
    // 🐛 Egon 22.09.2026 — ROOT CAUSE of the board that looked "stupidly small": `statsFetching` was a bare
    // latch with `if (statsFetching) return;` on top. An rpc that never settles (a restarted unsaved-
    // preview server, a dropped connection) left it TRUE for the rest of the session, so no fetch ever ran
    // again, `statsDraw` was never called, and the canvas stayed at the browser's DEFAULT 300x150 with
    // "Loading…" printed under it. A fetch is now superseded after 8 s, queued callbacks always run, and
    // the raced promise can never leave the latch stuck.
    var now = Date.now();
    if (statsFetching && (now - statsFetchStart) < 8000) { if (cb) statsCbQueue.push(cb); return; }
    statsFetching = true; statsFetchStart = now;
    var queued = statsCbQueue.slice();
    statsCbQueue.length = 0;
    if (cb) queued.push(cb);
    ;function finish() {
      statsFetching = false;
      var extra = statsCbQueue.slice();
      statsCbQueue.length = 0;
      for (var i = 0; i < queued.length + extra.length; i++) {
        var fn = (i < queued.length) ? queued[i] : extra[i - queued.length];
        try { if (fn) fn(); } catch (e) {}
      }
    }
    var settled = false;
    var timer = setTimeout(function () { if (settled) return; settled = true; if (!statsData) statsFail = true; finish(); }, 12000);
    try {
      sk.rpc.dragonOnlineHistory("").then(function (res) {
        if (settled) return; settled = true; clearTimeout(timer);
        try { var d = JSON.parse(res); if (d && d.min && d.hour) { statsData = d; statsAt = Date.now(); statsFail = false; } } catch (e) {}
        if (!statsData) statsFail = true;
        finish();
      }).catch(function () { if (settled) return; settled = true; clearTimeout(timer); if (!statsData) statsFail = true; finish(); });
    } catch (e) { if (!settled) { settled = true; clearTimeout(timer); finish(); } }
  }
  // Turns the rings into BAR DATA for the active view.
  //   24h -> 24 bars, one per local hour; each bar carries its 60 minute values (null = unsampled).
  //    7d ->  7 bars, one per local day;  each bar carries its 24 hour values (null = unsampled).
  // `peak` is the highest value inside the bar and decides the bar's height.
  // How many day-bars a non-hourly view shows (7d = a week, 30d = the whole month ring: the durable hour
  // ring holds 744 h = 31 days, so a month is the largest window that actually exists — see ONLINE_HOUR_CAP).
  ;function statsDayCount(view) { return view === "30d" ? 31 : 7; }
  ;function statsViewLabel(view) { return view === "months" ? "By month" : (view === "24h" ? "Last 24 hours" : (view === "30d" ? "Last 30 days" : "Last 7 days")); }
  // 🗓️ Egon 26.09.2026 — "visitor stats tarihi neden yanlış?" The bars are labelled with the weekday
  // only (a phone/desktop board cannot fit 30 date lines), so the summary line now ALSO names the exact
  // window the board covers ("Last 7 days (20 Sep – 26 Sep)"). Nothing about the bars changed: they were
  // always the local days ending TODAY — the missing range is what made the right edge look off-date.
  ;function statsRangeLabel(view) {
    if (!statsData || view === "24h") return "";
    try {
      if (view === "months") {
        var mf = function (d) { return d.toLocaleDateString(undefined, { month: "short", year: "numeric" }); };
        var hOld = statsData.nowHour - statsData.hour.length + 1;
        return mf(new Date(hOld * 3600000)) + " \u2013 " + mf(new Date(statsData.nowHour * 3600000));
      }
      var today = new Date(statsData.nowHour * 3600000);
      today.setHours(0, 0, 0, 0);
      var from = new Date(today.getTime());
      from.setDate(from.getDate() - (statsDayCount(view) - 1));
      var f = function (d) { return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }); };
      return f(from) + " \u2013 " + f(today);
    } catch (e) { return ""; }
  }
  ;function statsBuildBars(view) {
    var out = [];
    if (!statsData) return out;
    var i, k;
    if (view === "24h") {
      var minOldest = statsData.nowMin - statsData.min.length + 1;
      var nowH = Math.floor(statsData.nowMin / 60);
      for (i = 23; i >= 0; i--) {
        var h = nowH - i, vals = [], peak = 0;
        for (k = 0; k < 60; k++) {
          var m = h * 60 + k;
          if (m > statsData.nowMin || m < minOldest) { vals.push(null); continue; }
          var v = statsRing(statsData.min, m);
          vals.push(v); if (v > peak) peak = v;
        }
        out.push({ h: h, localHour: new Date(h * 3600000).getHours(), vals: vals, peak: peak });
      }
    } else if (view === "months") {
      var hOldestM = statsData.nowHour - statsData.hour.length + 1;
      var byMon = {}, monOrder = [], mi;
      for (mi = hOldestM; mi <= statsData.nowHour; mi++) {
        var dtM = new Date(mi * 3600000);
        var mk = dtM.getFullYear() + "-" + dtM.getMonth();
        var gm = byMon[mk];
        if (!gm) {
          gm = byMon[mk] = { month: new Date(dtM.getFullYear(), dtM.getMonth(), 1),
            days: new Date(dtM.getFullYear(), dtM.getMonth() + 1, 0).getDate(), peak: 0, dayPeak: {} };
          monOrder.push(mk);
        }
        var vM = statsRing(statsData.hour, mi);
        var dkM = dtM.getDate();
        if (vM > (gm.dayPeak[dkM] || 0)) gm.dayPeak[dkM] = vM;
        if (vM > gm.peak) gm.peak = vM;
      }
      for (mi = 0; mi < monOrder.length; mi++) {
        var gg = byMon[monOrder[mi]], valsM = [], dd;
        for (dd = 1; dd <= gg.days; dd++) valsM.push(gg.dayPeak[dd] != null ? gg.dayPeak[dd] : null);
        out.push({ month: gg.month, vals: valsM, peak: gg.peak });
      }
    } else {
      var hOldest = statsData.nowHour - statsData.hour.length + 1;
      var today = new Date(statsData.nowHour * 3600000);
      today.setHours(0, 0, 0, 0);
      var days = statsDayCount(view);
      for (i = days - 1; i >= 0; i--) {
        var d0 = new Date(today.getTime());
        d0.setDate(d0.getDate() - i);
        var vals2 = [], peak2 = 0;
        for (k = 0; k < 24; k++) {
          var dt = new Date(d0.getTime());
          dt.setHours(k, 0, 0, 0);
          var hIdx = Math.round(dt.getTime() / 3600000);
          if (hIdx > statsData.nowHour || hIdx < hOldest) { vals2.push(null); continue; }
          var v2 = statsRing(statsData.hour, hIdx);
          vals2.push(v2); if (v2 > peak2) peak2 = v2;
        }
        out.push({ day: d0, vals: vals2, peak: peak2 });
      }
    }
    return out;
  }
  ;function statsBarLabel(b, view) {
    if (view === "24h") return statsPad2(b.localHour);
    if (view === "months") { try { return b.month.toLocaleDateString(undefined, { month: "short" }); } catch (e) { return ""; } }
    try { return b.day.toLocaleDateString(undefined, { weekday: "short" }); } catch (e) { return ""; }
  }
  ;function statsBarSubLabel(b, view) {
    if (view === "24h") return "";
    if (view === "months") { try { return String(b.month.getFullYear()); } catch (e) { return ""; } }
    return b.day.getDate() + "/" + (b.day.getMonth() + 1);
  }
  ;function statsBarTitle(b, view) {
    if (view === "24h") return statsPad2(b.localHour) + ":00";
    if (view === "months") { try { return b.month.toLocaleDateString(undefined, { month: "long", year: "numeric" }); } catch (e) { return ""; } }
    try { return b.day.toLocaleDateString(undefined, { weekday: "short" }) + " " + b.day.getDate() + "/" + (b.day.getMonth() + 1); } catch (e) { return ""; }
  }
  // ============================================================
  //  👥 FIRST-TIME vs RETURNING (Egon 19.09.2026)
  //  The durable visitor-kind rings (server `vk`) split every sampled visit into FIRST-TIME (green) and
  //  RETURNING (red). statsBuildVkBars buckets them into the SAME shape the online board uses (24 hourly
  //  bars for Last 24h, one bar per day for Last 7d / Last 30d) and statsVkTotals sums a bucket list. The
  //  board itself draws them as ONE right-most stacked bar (see statsDraw), inside the SAME visitor stats
  //  card — the separate second chart that used to live under it was removed on 19.09.2026.
  // ============================================================
  ;function statsBuildVkBars(view) {
    var out = [];
    if (!statsData || !statsData.vk) return out;
    var vk = statsData.vk, i, k;
    if (view === "24h") {
      var minOldest = statsData.nowMin - vk.newMin.length + 1;
      var nowH = Math.floor(statsData.nowMin / 60);
      for (i = 23; i >= 0; i--) {
        var h = nowH - i, nn = 0, rr = 0, vals = [];
        for (k = 0; k < 60; k++) {
          var m = h * 60 + k;
          if (m > statsData.nowMin || m < minOldest) { vals.push(null); continue; }
          var a = statsRing(vk.newMin, m), b2 = statsRing(vk.retMin, m);
          vals.push({ n: a, r: b2 }); nn += a; rr += b2;
        }
        out.push({ h: h, localHour: new Date(h * 3600000).getHours(), vals: vals, n: nn, r: rr });
      }
    } else if (view === "months") {
      var hOldestV = statsData.nowHour - vk.newHour.length + 1;
      var byV = {}, ordV = [], vi;
      for (vi = hOldestV; vi <= statsData.nowHour; vi++) {
        var dtV = new Date(vi * 3600000);
        var kk = dtV.getFullYear() + "-" + dtV.getMonth();
        var gv = byV[kk];
        if (!gv) {
          gv = byV[kk] = { month: new Date(dtV.getFullYear(), dtV.getMonth(), 1),
            days: new Date(dtV.getFullYear(), dtV.getMonth() + 1, 0).getDate(), n: 0, r: 0, dayN: {}, dayR: {} };
          ordV.push(kk);
        }
        var aV = statsRing(vk.newHour, vi), bV = statsRing(vk.retHour, vi), dkV = dtV.getDate();
        gv.dayN[dkV] = (gv.dayN[dkV] || 0) + aV;
        gv.dayR[dkV] = (gv.dayR[dkV] || 0) + bV;
        gv.n += aV; gv.r += bV;
      }
      for (vi = 0; vi < ordV.length; vi++) {
        var ggv = byV[ordV[vi]], valsV = [], dv;
        for (dv = 1; dv <= ggv.days; dv++) {
          valsV.push((ggv.dayN[dv] != null || ggv.dayR[dv] != null) ? { n: ggv.dayN[dv] || 0, r: ggv.dayR[dv] || 0 } : null);
        }
        out.push({ month: ggv.month, vals: valsV, n: ggv.n, r: ggv.r });
      }
    } else {
      var hOldest = statsData.nowHour - vk.newHour.length + 1;
      var today = new Date(statsData.nowHour * 3600000);
      today.setHours(0, 0, 0, 0);
      var days = statsDayCount(view);
      for (i = days - 1; i >= 0; i--) {
        var d0 = new Date(today.getTime()); d0.setDate(d0.getDate() - i);
        var vals2 = [], n2 = 0, r2 = 0;
        for (k = 0; k < 24; k++) {
          var dt = new Date(d0.getTime()); dt.setHours(k, 0, 0, 0);
          var hIdx = Math.round(dt.getTime() / 3600000);
          if (hIdx > statsData.nowHour || hIdx < hOldest) { vals2.push(null); continue; }
          var a2 = statsRing(vk.newHour, hIdx), b3 = statsRing(vk.retHour, hIdx);
          vals2.push({ n: a2, r: b3 }); n2 += a2; r2 += b3;
        }
        out.push({ day: d0, vals: vals2, n: n2, r: r2 });
      }
    }
    return out;
  }
  ;function statsVkTotals(bars) { var nn = 0, rr = 0; for (var i = 0; i < bars.length; i++) { nn += bars[i].n; rr += bars[i].r; } return { n: nn, r: rr }; }
  ;function statsDraw() {
    var wrap = statsCanvasWrap();
    var canvas = document.getElementById("dragonStatsCanvas");
    var sumEl = document.getElementById("dragonStatsSummary");
    if (!wrap || !canvas) return;
    statsHideTip(); // a redraw invalidates whatever the tooltip was describing
    var bars = statsBuildBars(statsView);
    var W = Math.max(240, statsWrapWidth() || 320);
    // Egon 22.09.2026 — "why do visitor stats look stupidly small?": the card spans the whole
    // Settings board (measured 1053 px wide on a laptop) while the chart was a FIXED 168 px tall, so the
    // board read as a squashed strip instead of a chart. The height now follows the width (30 %, clamped
    // to 168–320 px), and the axis labels grow with it — a phone keeps the small board, a desktop gets one
    // that actually uses the card it was given.
    var H = Math.max(168, Math.min(320, Math.round(W * 0.30)));
    var fsLbl = W > 620 ? 11 : 10;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    var ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    statsLastW = W;
    var padL = 32, padR = 8, padT = 10, padB = 26;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var peak = 0, i;
    for (i = 0; i < bars.length; i++) if (bars[i].peak > peak) peak = bars[i].peak;
    // The tallest bar is the scale (owner: "bar height is relative to the max users"), with a little
    // headroom, snapped to a readable step so the four gridline labels are always whole round numbers
    // (a raw max of 75 would otherwise label the axis 0/22/45/67/89).
    var STEPS = [1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000, 2500, 5000, 10000];
    var axStep = 1;
    if (peak > 0) {
      var need = Math.ceil(peak * 1.12 / 4);
      for (var si = 0; si < STEPS.length; si++) { axStep = STEPS[si]; if (STEPS[si] >= need) break; }
    }
    var axisMax = peak > 0 ? axStep * 4 : 1;
    ctx.fillStyle = "rgba(9,9,14,.7)";
    ctx.fillRect(padL, padT, plotW, plotH);
    // grid + y labels
    var lastLbl = null;
    for (var g = 0; g <= 4; g++) {
      var gy = Math.round(padT + plotH - (plotH * g / 4)) + .5;
      ctx.strokeStyle = "rgba(155,107,255,.15)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(padL + plotW, gy); ctx.stroke();
      var lbl = String(Math.round(axisMax * g / 4));
      if (lbl === lastLbl) continue; // never print the same number twice on the axis
      lastLbl = lbl;
      ctx.fillStyle = "#8f86a8"; ctx.font = fsLbl + "px system-ui,sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.fillText(lbl, padL - 6, gy);
    }
    // 👥 Egon 19.09.2026 — the visitor-kind bar claims exactly ONE extra slot at the FAR RIGHT of the
    // board; every online bar stays on its left, always. It carries the selected period's first-time vs
    // returning split (green / red) and its own scale is the period's visits (the same axis would be
    // meaningless: that one counts concurrent people, this one counts visits).
    var vkTotals = null, vkBarsForTip = null;
    if (statsData && statsData.vk) {
      try { var _vb = statsBuildVkBars(statsView); vkBarsForTip = _vb; if (_vb.length) vkTotals = statsVkTotals(_vb); } catch (e) {}
    }
    var vkOn = !!(vkTotals && (vkTotals.n + vkTotals.r) > 0);
    var slots = bars.length + (vkOn ? 1 : 0);
    var n = Math.max(1, slots);
    var slotW = plotW / n;
    var barW = Math.max(3, Math.min(38, slotW - (n > 14 ? 3 : 8)));
    var thin = slotW < 26 ? (slotW < 15 ? 3 : 2) : 1; // 24 bars in a narrow card: label every 2nd/3rd hour
    for (i = 0; i < bars.length; i++) {
      var b = bars[i];
      var cx = padL + slotW * i + slotW / 2;
      var x = cx - barW / 2;
      var hgt = peak > 0 ? Math.round(plotH * (b.peak / axisMax)) : 0;
      var y = padT + plotH - hgt;
      var isNow = (i === bars.length - 1);
      if (hgt >= 2) {
        // One smooth gradient per bar — the minute/hour slices stay invisible until the
        // pointer rests on the bar, and then only the hovered slice is drawn (statsHl).
        var grad = ctx.createLinearGradient(0, y, 0, padT + plotH);
        grad.addColorStop(0, isNow ? "#ffd76a" : "#a98cff");
        grad.addColorStop(1, isNow ? "#6b5218" : "#3a2b73");
        ctx.fillStyle = grad;
        var r = Math.min(3, hgt / 2);
        ctx.beginPath();
        ctx.moveTo(x, padT + plotH);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.lineTo(x + barW - r, y);
        ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
        ctx.lineTo(x + barW, padT + plotH);
        ctx.closePath();
        ctx.fill();
        try {
          if (statsHl && statsHl.i === i && b.vals && b.vals.length > 1) {
            var hn = b.vals.length, hk = Math.max(0, Math.min(hn - 1, statsHl.k | 0));
            var hsTop = y + hgt * (hn - 1 - hk) / hn, hsBot = y + hgt * (hn - hk) / hn;
            var hx = x + 1, hw = Math.max(1, barW - 2);
            var hy = hsTop + 0.5, hh = Math.max(2, hsBot - hsTop - 1);
            ctx.fillStyle = "rgba(255,255,255,.16)";
            ctx.fillRect(hx, hy, hw, hh);
            ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = 1.5;
            ctx.strokeRect(hx, hy, hw, hh);
          }
        } catch (eHl) {}
      } else {
        // A zero bar still shows its place as a small track, so an almost-empty board reads as
        // "quiet" rather than "not drawn yet".
        ctx.fillStyle = "rgba(155,107,255,.42)";
        ctx.fillRect(x, padT + plotH - 3, barW, 3);
      }
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      // Egon 19.09.2026 — on a narrow board (24 hourly slots on a phone) the right-most 👥 bar anchors its
      // label to the plot edge, so the LAST hour's own label steps aside rather than colliding with it.
      // Egon 26.09.2026 — the last bar's label is NEVER skipped any more. It used to step aside for the
      // 👥 label on a narrow board, which left the "today" bar UNLABELLED: the nearest printed label
      // belonged to another day, so the board read as if it showed a wrong date (owner report). The label
      // now always stays and only slides a few pixels left when it would touch the 👥 one, and on the day
      // views the LAST bar prints its DATE (26/9) instead of the weekday, so the right edge is explicit.
      var narrowVk = vkOn && slotW < 26;
      var isNowDay = isNow && (statsView === "7d" || statsView === "30d");
      var sub = statsBarSubLabel(b, statsView);
      if (i % thin === 0 || isNow) {
        ctx.fillStyle = isNow ? "#ffd76a" : "#9a91b3"; ctx.font = fsLbl + "px system-ui,sans-serif";
        var mainLbl = statsBarLabel(b, statsView);
        if (isNowDay && sub) mainLbl = sub;
        ctx.fillText(mainLbl, cx - ((isNow && narrowVk) ? 6 : 0), padT + plotH + 4);
        // The date line only when the bars are wide enough to hold it; on a phone the weekday alone
        // is the readable label (the tooltip always shows the full date).
        if (sub && slotW >= 34 && !isNowDay) { ctx.fillStyle = "#6f6790"; ctx.fillText(sub, cx, padT + plotH + 14); }
      }
    }
    // ── 👥 the visitor-kind bar: the right-most bar of the board, visually the twin of the online bars ──
    if (vkOn) {
      // Egon 20.09.2026 — the dashed separator was removed: the 👥 bar is visually distinct on its own
      // (its own colours + its own label), so the line was just noise.
      var vkTotalVisits = vkTotals.n + vkTotals.r;
      var vkCx = padL + slotW * bars.length + slotW / 2;
      var vkX = vkCx - barW / 2;
      var vkBase = padT + plotH;
      var vkN = Math.round(plotH * (vkTotals.n / vkTotalVisits));
      var vkR = plotH - vkN;
      (function drawVkPart(x, y, w, h, roundTop, c0, c1) {
        if (h <= 0) return;
        var r = Math.min(3, h / 2, w / 2);
        var gr = ctx.createLinearGradient(0, y, 0, y + h);
        gr.addColorStop(0, c0); gr.addColorStop(1, c1);
        ctx.fillStyle = gr;
        ctx.beginPath();
        if (roundTop) {
          ctx.moveTo(x, y + h); ctx.lineTo(x, y + r);
          ctx.quadraticCurveTo(x, y, x + r, y);
          ctx.lineTo(x + w - r, y);
          ctx.quadraticCurveTo(x + w, y, x + w, y + r);
          ctx.lineTo(x + w, y + h);
        } else {
          ctx.moveTo(x, y); ctx.lineTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y);
        }
        ctx.closePath(); ctx.fill();
      })(vkX, vkBase - vkN, barW, vkN, vkR <= 0, "#6ef0a0", "#1f7a45");
      (function drawVkPart2(x, y, w, h, roundTop, c0, c1) {
        if (h <= 0) return;
        var r = Math.min(3, h / 2, w / 2);
        var gr = ctx.createLinearGradient(0, y, 0, y + h);
        gr.addColorStop(0, c0); gr.addColorStop(1, c1);
        ctx.fillStyle = gr;
        ctx.beginPath();
        if (roundTop) {
          ctx.moveTo(x, y + h); ctx.lineTo(x, y + r);
          ctx.quadraticCurveTo(x, y, x + r, y);
          ctx.lineTo(x + w - r, y);
          ctx.quadraticCurveTo(x + w, y, x + w, y + r);
          ctx.lineTo(x + w, y + h);
        } else {
          ctx.moveTo(x, y); ctx.lineTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y);
        }
        ctx.closePath(); ctx.fill();
      })(vkX, padT, barW, vkR, true, "#ff8d97", "#b3202f");
      ctx.textBaseline = "top";
      ctx.fillStyle = "#ffd76a"; ctx.font = fsLbl + "px system-ui,sans-serif";
      // A centred 👥 would collide with the last hour's label and spill past the plot on a narrow board;
      // there it is anchored to the plot's right edge instead (the bar itself is still centred).
      var vkNarrow = slotW < 26;
      ctx.textAlign = vkNarrow ? "right" : "center";
      ctx.fillText("\uD83D\uDC65", vkNarrow ? (padL + plotW - 1) : vkCx, padT + plotH + 4);
      if (slotW >= 34) { ctx.textAlign = "center"; ctx.fillStyle = "#6f6790"; ctx.fillText(statsView === "24h" ? "24h" : (statsView === "30d" ? "30d" : "7d"), vkCx, padT + plotH + 14); }
    }
    if (!statsData) {
      ctx.fillStyle = "#9a91b3"; ctx.font = "12px system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      // Egon 22.09.2026 — never leave an unreachable stats server as an eternal "Loading…": say what
      // happened and what to press.
      ctx.fillText(statsFail ? "Could not reach the visitor-stats server \u2014 press \u27F3 to retry." : "Loading visitor history…", padL + plotW / 2, padT + plotH / 2);
    } else if (peak === 0) {
      ctx.fillStyle = "#9a91b3"; ctx.font = "12px system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(statsView === "24h" ? "No visitors recorded in the last 24 hours yet." : (statsView === "months" ? "No visits recorded in these months yet." : ("No visitors recorded in the " + statsViewLabel(statsView).replace("Last ", "last ") + " yet.")), padL + plotW / 2, padT + plotH / 2);
    }
    statsBox = { bars: bars, view: statsView, padL: padL, padT: padT, plotW: plotW, plotH: plotH, slotW: slotW, peak: peak, axisMax: axisMax, barW: barW,
      vk: vkOn ? { totals: vkTotals } : null, vkBars: vkBarsForTip };
    if (sumEl) {
      // Egon 19.09.2026 — the period's first-time / returning split now lives on this ONE summary line
      // (the separate second chart and its split bar were removed): same numbers, one line, no duplicate UI.
      var vkLine = "";
      if (statsData && vkTotals) {
        var vkSum = vkTotals.n + vkTotals.r;
        vkLine = vkSum > 0
          ? " \u00B7 \uD83D\uDC65 first-time " + vkTotals.n + " \u00B7 returning " + vkTotals.r
            + " \u00B7 all time " + statsData.vk.newEver + "/" + statsData.vk.retEver
          : " \u00B7 \uD83D\uDC65 no visits in this window yet";
      }
      if (!statsData) { sumEl.textContent = statsFail ? "Could not reach the visitor-stats server — press ⟳ to retry." : "Loading…"; }
      else if (peak === 0 && !vkLine) { sumEl.textContent = "The board fills in as visitors come online."; }
      else {
        var live = window.__dragonLastOnline;
        var _rg = statsRangeLabel(statsView);
        sumEl.textContent = statsViewLabel(statsView) + (_rg ? " (" + _rg + ")" : "") + " · max " + peak + " online"
          + (typeof live === "number" ? " · now " + live + " online" : "")
          + (peak > 0 && peak < 5 ? " · still filling in" : "")
          + vkLine;
      }
    }
  }
  ;function statsHideTip() {
    var tip = document.getElementById("dragonStatsTip");
    if (tip) tip.style.display = "none";
  }
  // Egon 20.09.2026, revised 23.09.2026 (W-UI224) — places the fixed info panel from the pointer's CLIENT
  // coordinates, but NEVER under the finger/cursor. TOUCH: the panel's BOTTOM edge starts a little ABOVE the
  // touched point, horizontally centred on it (before it opened under the finger and could not be read).
  // MOUSE: the pointer sits at the panel's TOP-RIGHT corner — it opens down-and-left, so the cursor stays
  // clear and the panel cannot run off the right edge. Only the viewport edges limit it, so it can never be
  // pushed out of sight.
  ;function statsPlaceTip(tip, clientX, clientY, isTouch) {
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    var vw = window.innerWidth || 0, vh = window.innerHeight || 0;
    tip.style.transform = "none";
    if (isTouch) {
      var leftT = clientX - tw / 2;
      if (leftT < 6) leftT = 6;
      if (leftT + tw > vw - 6) leftT = Math.max(6, vw - 6 - tw);
      var topT = clientY - th - 18;
      if (topT < 6) topT = clientY + 18;                     // no room above → fall back under the finger
      if (topT + th > vh - 6) topT = Math.max(6, vh - 6 - th);
      tip.style.left = Math.round(leftT) + "px";
      tip.style.top = Math.round(topT) + "px";
      return;
    }
    var left = clientX - tw - 14;                            // the mouse sits at the panel's TOP-RIGHT
    if (left < 6) left = clientX + 14;
    if (left + tw > vw - 6) left = Math.max(6, vw - 6 - tw);
    var top = clientY + 14;
    if (top + th > vh - 6) top = Math.max(6, vh - 6 - th);
    if (top < 6) top = 6;
    tip.style.left = Math.round(left) + "px";
    tip.style.top = Math.round(top) + "px";
  }
  ;function statsHover(clientX, clientY, ptype) {
    var isTouch = (ptype === "touch");
    var canvas = document.getElementById("dragonStatsCanvas");
    var tip = document.getElementById("dragonStatsTip");
    var wrap = statsCanvasWrap();
    if (!canvas || !tip || !wrap || !statsBox || !statsBox.bars || !statsBox.bars.length) { statsHideTip(); return; }
    var B = statsBox;
    var rect = canvas.getBoundingClientRect();
    var x = clientX - rect.left, y = clientY - rect.top;
    // The panel tracks the pointer while it is over the chart itself (the last bar keeps answering for the
    // small strip below the plot, so the reading never blanks out just because the pointer dropped a pixel).
    if (x < 0 || x > rect.width || y < 0 || y > rect.height + 24) {
      if (statsHl) { statsHl = null; try { statsDraw(); } catch (eD2) {} }
      statsHideTip(); return;
    }
    var i = Math.floor((x - B.padL) / B.slotW);
    if (i < 0) i = 0;
    if (i > B.bars.length) i = B.bars.length;
    if (i === B.bars.length && B.vk) { if (statsHl) { statsHl = null; try { statsDraw(); } catch (eD3) {} }
      // 👥 the right-most bar: the period's first-time vs returning split (see statsDraw)
      tip.innerHTML = "<b style='display:block; color:#fff;'>\uD83D\uDC65 First-time vs Returning</b>"
        + "<span style='display:block; opacity:.82;'>" + statsViewLabel(B.view) + "</span>"
        + "<span style='display:block; color:#6ef0a0;'>first-time " + B.vk.totals.n + "</span>"
        + "<span style='display:block; color:#ff8d97;'>returning " + B.vk.totals.r + "</span>"
        + "<span style='display:block; color:#ffd76a;'>total " + (B.vk.totals.n + B.vk.totals.r) + " visits</span>";
      tip.style.display = "block";
      statsPlaceTip(tip, clientX, clientY, isTouch);
      return;
    }
    if (i >= B.bars.length) i = B.bars.length - 1;
    var b = B.bars[i];
    if (!b || !b.vals || !b.vals.length) { statsHideTip(); return; }
    // The slice comes from the VERTICAL position inside the bar: oldest slice at the
    // bottom, newest on top. Above the bar reads as the newest slice, below as oldest.
    var bhgt = (B.peak > 0 && B.axisMax > 0) ? Math.round(B.plotH * (b.peak / B.axisMax)) : 0;
    var brel = bhgt > 0 ? ((B.padT + B.plotH) - y) / bhgt : 0;
    if (brel < 0) brel = 0;
    var k = Math.floor(brel * b.vals.length);
    if (k >= b.vals.length) k = b.vals.length - 1;
    if (k < 0) k = 0;
    if (!statsHl || statsHl.i !== i || statsHl.k !== k) {
      statsHl = { i: i, k: k };
      try { statsDraw(); } catch (eD4) {}
    }
    var v = b.vals[k];
    // The bar's own height is its peak; the point under the cursor is the minute (24h) / hour (7d) there.
    var pointLabel = (B.view === "24h") ? statsPad2(b.localHour) + ":" + statsPad2(k) : (B.view === "months" ? ((k + 1) + " " + statsBarLabel(b, B.view)) : statsPad2(k) + ":00");
    // 📊 Egon 20.09.2026 — on the 7d / 30d bars the reading under the pointer was meaningless to him
    // ("doesn't say how many are online at a certain hour"), so a day bar now reports what he actually asked for:
    // the day's TOTAL VISITS (first-time + returning), straight from the durable visitor-kind rings.
    var vkDay = null;
    try { if (B.vkBars && B.vkBars[i]) vkDay = (B.view === "months") ? B.vkBars[i].vals[k] : B.vkBars[i]; } catch (e) {}
    var vkDayLine = (B.view !== "24h" && vkDay)
      ? "<span style='display:block; color:#ffe600;'>" + (vkDay.n + vkDay.r) + " visits that day</span>"
        + "<span style='display:block; color:#6ef0a0;'>first-time " + vkDay.n + "</span>"
        + "<span style='display:block; color:#ff8d97;'>returning " + vkDay.r + "</span>"
      : "";
    var vkMonthLine = "";
    try {
      if (B.view === "months" && B.vkBars && B.vkBars[i]) {
        var mb = B.vkBars[i];
        vkMonthLine = "<span style='display:block; color:#ffe600;'>" + (mb.n + mb.r) + " visits in " + statsBarLabel(b, B.view) + "</span>"
          + "<span style='display:block; color:#6ef0a0;'>first-time " + mb.n + "</span>"
          + "<span style='display:block; color:#ff8d97;'>returning " + mb.r + "</span>";
      }
    } catch (e) {}
    tip.innerHTML = "<b style='display:block; color:#fff;'>" + statsBarTitle(b, B.view) + "</b>"
      + vkMonthLine
      + "<span style='display:block; opacity:.82;'>" + (B.view === "24h" ? "hour peak " : (B.view === "months" ? "month peak " : "day peak ")) + b.peak + " online</span>"
      + "<span style='display:block; color:#ffd76a;'>" + pointLabel + " · " + (v === null ? "no data" : v + " online") + "</span>"
      + vkDayLine;
    tip.style.display = "block";
    // Egon 23.09.2026 (W-UI224) — never under the finger/cursor; see statsPlaceTip.
    statsPlaceTip(tip, clientX, clientY, isTouch);
  }
  window.dragonRefreshStatsCard = function () {
    if (!statsCardVisible() || document.visibilityState === "hidden") return;
    if (statsData && Date.now() - statsAt < 30000 && statsWrapWidth() === statsLastW) return;
    statsFetch(false, statsDraw);
  };
  // Debug seam: draw a synthetic payload without touching the server (used by hand and by the check-up
  // while developing the board). The normal flow never calls it — the board always reads the live rings.
  window.dragonStatsDebugSet = function (nowMin, minArr, hourArr, vk) {
    statsData = { nowMin: nowMin, nowHour: Math.floor(nowMin / 60), min: minArr, hour: hourArr };
    if (vk) statsData.vk = vk; // optional: lets a test draw the 👥 split bar without touching the server
    statsAt = Date.now();
    statsDraw();
  };
  // 🗂️ Egon 22.09.2026 — "they're disappearing, how will I find them again? at least save the db in settings
  // falan tutulsun?" — the ⚙️ Settings twin of the two 🗂️ Gallery-Management lists. Every block now
  // carries the moment it was made, and this card is the place the owner can always return to: every
  // blocked uploader and picture, NEWEST FIRST, with the exact date+time and a ✖ that puts it back into
  // every gallery. (The blocks themselves are local to this device, like the rest of the vault.)
  window.dragonBlockedCardSync = function (cardEl) {
    // `cardEl` is passed while the card is still DETACHED (dragonBuildBlockedCard builds and fills it in one
    // go, before the Settings board has adopted it) — an id lookup would find nothing there and every list
    // would stay empty until the next Account open.
    var card = cardEl || document.getElementById("dragonBlockedCard");
    if (!card) return;
    var h = card.querySelector(".dragon-set-h");
    var uList = card.querySelector("#dragonBlockedUserList");
    var iList = card.querySelector("#dragonBlockedImageList");
    if (!uList || !iList) return;
    var uinfo = (window.dragonBlockedUserInfoGet ? window.dragonBlockedUserInfoGet() : {}) || {};
    var iinfo = (window.dragonBlockedImageInfoGet ? window.dragonBlockedImageInfoGet() : {}) || {};
    var uids = window.dragonBlockedSortNewest(window.dragonBlockedList ? window.dragonBlockedList() : [], window.dragonBlockedUserInfoGet);
    var iids = window.dragonBlockedSortNewest(window.dragonBlockedImages ? window.dragonBlockedImages() : [], window.dragonBlockedImageInfoGet);
    if (h) {
      var _txt = "\uD83D\uDEAB Blocked \u2014 " + uids.length + " uploader" + (uids.length === 1 ? "" : "s")
        + " \u00B7 " + iids.length + " picture" + (iids.length === 1 ? "" : "s");
      var hText = card.querySelector("#dragonBlockedHeadText");
      if (hText) hText.textContent = _txt; else h.textContent = _txt;
    }
    ;function empty(el, txt) {
      el.innerHTML = "";
      var d = document.createElement("div");
      d.textContent = txt;
      d.style.cssText = "font-size:.68rem; opacity:.7; padding:.15rem .2rem;";
      el.appendChild(d);
    }
    ;function afterUnblock() {
      try { window.dragonBlockedCardSync(); } catch (e) {}
      try { if (window.dragonGalSyncOrderUI) window.dragonGalSyncOrderUI(); } catch (e) {}
      try { if (window.dragonGalBlockReload) window.dragonGalBlockReload(); } catch (e) {}
    }
    ;function unblockBtn(what, fn) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = "\u2716";
      b.title = "Unblock this " + what + " \u2014 it comes back in every gallery";
      b.style.cssText = "flex:0 0 auto; font-size:.7rem; padding:.1rem .35rem; border:1px solid #6a6a78; background:#2a2a35; color:#eee; border-radius:5px; cursor:pointer;";
      b.onclick = function (e) { e.stopPropagation(); fn(); };
      return b;
    }
    ;function stampLine(text) {
      var s = document.createElement("span");
      s.textContent = text;
      s.style.cssText = "font-size:.6rem; color:#ff9aa4; opacity:.88; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;";
      return s;
    }
    ;function row(thumbUrl, label, sub, what, onUnblock, title) {
      var r = document.createElement("div");
      r.style.cssText = "display:flex; align-items:center; gap:.4rem; justify-content:space-between; padding:.18rem .2rem; border-top:1px solid rgba(155,107,255,.14);";
      var left = document.createElement("div");
      left.style.cssText = "display:flex; align-items:center; gap:.4rem; min-width:0;";
      if (thumbUrl) {
        var th = document.createElement("img");
        th.src = thumbUrl; th.alt = ""; th.loading = "lazy";
        th.style.cssText = "width:34px; height:34px; object-fit:cover; border-radius:5px; border:1px solid #6a6a78; flex:0 0 auto; background:#000;";
        left.appendChild(th);
      }
      var col = document.createElement("div");
      col.style.cssText = "display:flex; flex-direction:column; min-width:0;";
      var nm = document.createElement("span");
      nm.textContent = label;
      nm.title = title || label;
      nm.style.cssText = "font-size:.68rem; color:#ddd; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:16rem;";
      col.append(nm, stampLine(sub));
      left.appendChild(col);
      r.append(left, unblockBtn(what, onUnblock));
      return r;
    }
    if (!uids.length) empty(uList, "no blocked uploaders on this device");
    else {
      uList.innerHTML = "";
      uids.forEach(function (uid) {
        var m = uinfo[uid] || {};
        uList.appendChild(row("", (window.dragonBlockedShortLabel ? window.dragonBlockedShortLabel(uid, m) : (m.h || uid)), "\uD83D\uDD52 blocked " + window.dragonBlockedStamp(m.t) + (m.n != null ? (" \u00B7 hid " + m.n + " picture" + (m.n === 1 ? "" : "s")) : ""),
          "uploader", function () {
            window.dragonBlockedRemove(uid);
            try { if (window.dragonToast) dragonToast("\uD83D\uDC4B uploader unblocked \u2014 their pictures come back"); } catch (e) {}
            afterUnblock();
          }, uid + (m.n != null ? ("\n" + m.n + " picture(s) hidden when blocked") : "") + (Number(m.t || 0) > 0 ? "" : "\n(the date was not recorded — this block is older than the log; the row is still in block order, newest first)")));
      });
    }
    if (!iids.length) empty(iList, "no blocked pictures on this device");
    else {
      iList.innerHTML = "";
      iids.forEach(function (iid) {
        var m = iinfo[iid] || {};
        iList.appendChild(row(m.u || "", (m.p ? m.p : String(iid).slice(0, 14) + "\u2026"), "\uD83D\uDD52 blocked " + window.dragonBlockedStamp(m.t),
          "picture", function () {
            window.dragonBlockedImageRemove(iid);
            window.dragonBlockedImageInfoDel(iid);
            try { if (window.dragonToast) dragonToast("\uD83D\uDC4B picture unblocked \u2014 it comes back in every gallery"); } catch (e) {}
            afterUnblock();
          }, "image id: " + iid + (m.p ? ("\nprompt: " + m.p) : "")));
      });
    }
  };
  window.dragonBuildBlockedCard = function () {
    var card = document.createElement("div");
    card.className = "dragon-set-card dragon-set-wide";
    card.id = "dragonBlockedCard";
    var h = document.createElement("div");
    h.className = "dragon-set-h";
    h.id = "dragonBlockedHead";
    // 🚫 Egon 20.09.2026 — "🚫 Blocked — the panel should open and close with a button. it's taking up space unnecessarily
    // taking up". The card is now an ACCORDION: collapsed by default (the header still counts what is
    // blocked), opened with a tap on the header, and the state is remembered per device. The header text
    // itself is written by dragonBlockedCardSync() into #dragonBlockedHeadText, so the ▸/▾ marker and the
    // count can live in the same row.
    h.style.cssText = "cursor:pointer; user-select:none; display:flex; align-items:center; justify-content:center; gap:.4rem;";
    var chev = document.createElement("span");
    chev.id = "dragonBlockedChev";
    chev.textContent = "\u25B8";
    chev.style.cssText = "flex:0 0 auto; color:#b79dff; font-size:.8rem;";
    var hText = document.createElement("span");
    hText.id = "dragonBlockedHeadText";
    h.append(chev, hText);
    var body = document.createElement("div");
    body.className = "dragon-set-body";
    ;function blockedOpenGet() { try { return localStorage.getItem("dragonBlockedCardOpen") === "1"; } catch (e) { return false; } }
    ;function blockedOpenApply(on) {
      body.style.display = on ? "" : "none";
      chev.textContent = on ? "\u25BE" : "\u25B8";
      h.title = on ? "Collapse the block list" : "Expand \u2014 every blocked uploader and picture, newest first";
    }
    h.onclick = function () {
      var on = (body.style.display === "none");
      try { localStorage.setItem("dragonBlockedCardOpen", on ? "1" : "0"); } catch (e) {}
      blockedOpenApply(on);
    };
    h.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); h.onclick(); } };
    h.tabIndex = 0;
    var hint = document.createElement("div");
    hint.textContent = "Blocks live on this device only, and a blocked uploader or picture is never drawn in any gallery. Everything you blocked is listed here with the date and time it was blocked \u2014 press \u2716 to bring one back. (The same two lists also live in \uD83D\uDDC2\uFE0F Gallery Management.)";
    hint.style.cssText = "font-size:.66rem; color:#9a91b3; line-height:1.35; margin-bottom:.5rem;";
    var uTitle = document.createElement("div");
    uTitle.textContent = "\uD83D\uDC64 Blocked uploaders";
    uTitle.style.cssText = "font-size:.72rem; font-weight:bold; color:#ff9aa4; margin:.2rem 0 .1rem; text-align:left;";
    var uList = document.createElement("div");
    uList.id = "dragonBlockedUserList";
    uList.style.cssText = "display:flex; flex-direction:column; max-height:11rem; overflow:auto; text-align:left;";
    var iTitle = document.createElement("div");
    iTitle.textContent = "\uD83D\uDDBC\uFE0F Blocked pictures";
    iTitle.style.cssText = "font-size:.72rem; font-weight:bold; color:#ff9aa4; margin:.55rem 0 .1rem; text-align:left;";
    var iList = document.createElement("div");
    iList.id = "dragonBlockedImageList";
    iList.style.cssText = "display:flex; flex-direction:column; max-height:14rem; overflow:auto; text-align:left;";
    // 🔓 ONE door back for the whole list — useful after a test session where a pile of blocks was made in a
    // hurry (Egon 22.09.2026: "banned 3 users for testing ... I think I blocked an innocent one too").
    var allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.id = "dragonBlockedUnblockAll";
    allBtn.textContent = "\uD83D\uDD13 Unblock everything";
    allBtn.title = "Remove every block on this device (uploaders and pictures) — they all come back in every gallery";
    allBtn.style.cssText = "margin-top:.55rem; padding:.34rem .7rem; font-size:.7rem; font-weight:bold; border-radius:9px; cursor:pointer; border:1px solid rgba(255,138,150,.6); background:linear-gradient(145deg,#3a2026,#1a1013); color:#ffd6da;";
    allBtn.onclick = function (e) {
      e.stopPropagation();
      var uN = (window.dragonBlockedList ? window.dragonBlockedList().length : 0);
      var iN = (window.dragonBlockedImages ? window.dragonBlockedImages().length : 0);
      if (!uN && !iN) return;
      try {
        window.dragonBlockedList().forEach(function (uid) { window.dragonBlockedRemove(uid); });
        window.dragonBlockedImages().forEach(function (iid) { window.dragonBlockedImageRemove(iid); window.dragonBlockedImageInfoDel(iid); });
      } catch (err) {}
      try { if (window.dragonToast) dragonToast("\uD83D\uDC4B unblocked everything \u2014 " + uN + " uploader(s) and " + iN + " picture(s) are back"); } catch (err) {}
      afterUnblock();
    };
    body.append(hint, uTitle, uList, iTitle, iList, allBtn);
    card.append(h, body);
    try { blockedOpenApply(blockedOpenGet()); } catch (e) {}
    try { window.dragonBlockedCardSync(card); } catch (e) {}
    return card;
  };
  window.dragonBuildStatsCard = function () {
    var card = document.createElement("div");
    card.className = "dragon-set-card dragon-set-wide";
    card.id = "dragonStatsCard";
    var h = document.createElement("div");
    h.className = "dragon-set-h";
    h.textContent = "\uD83D\uDCCA Visitor Stats";
    var body = document.createElement("div");
    body.className = "dragon-set-body";
    var row = document.createElement("div");
    row.style.cssText = "display:flex; flex-wrap:wrap; gap:.35rem; justify-content:center; align-items:center; margin-bottom:.4rem;";
    ;function viewBtn(label, view, title) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "dragon-set-stdbtn"; b.textContent = label; b.title = title || label;
      b.style.whiteSpace = "nowrap";
      b.addEventListener("click", function () {
        statsView = view;
        syncBtns();
        statsFetch(true, statsDraw);
      });
      return b;
    }
    var b24 = viewBtn("Last 24h", "24h", "Last 24 hours — one bar per hour; hover a bar to see that minute's count");
    var b7 = viewBtn("Last 7d", "7d", "Last 7 days — one bar per day; hover a bar to see that hour's count");
    var b30 = viewBtn("Last 30d", "30d", "Last 30 days — one bar per day. The durable hour ring is 31 days long, so a month is the longest window that exists; hover a bar to see that hour's count");
    var bMo = viewBtn("Months", "months", "By month — one bar per calendar month; hover a bar to see that day's count");
    var bRe = document.createElement("button");
    bRe.type = "button"; bRe.className = "dragon-set-stdbtn"; bRe.textContent = "\u27F3"; bRe.title = "refresh";
    bRe.style.whiteSpace = "nowrap";
    bRe.addEventListener("click", function () { statsFetch(true, statsDraw); });
    ;function syncBtns() {
      // NOTE: `.dragon-set-stdbtn` sets its border/colour with !important, so a plain inline style loses —
      // the active view has to be applied as an important inline declaration.
      setActive(b24, statsView === "24h");
      setActive(b7, statsView === "7d");
      setActive(b30, statsView === "30d");
      setActive(bMo, statsView === "months");
    }
    ;function setActive(b, on) {
      b.style.setProperty("border-color", on ? "#ffd76a" : "", "important");
      b.style.setProperty("color", on ? "#ffe9a8" : "", "important");
    }
    row.append(b24, b7, b30, bMo, bRe);
    var wrap = document.createElement("div");
    wrap.id = "dragonStatsCanvasWrap";
    wrap.style.cssText = "position:relative; width:100%; display:flex; justify-content:center;";
    var canvas = document.createElement("canvas");
    canvas.id = "dragonStatsCanvas";
    canvas.style.cssText = "display:block; border-radius:8px;";
    // Egon 20.09.2026 — the info panel is now a FIXED layer on <body>, positioned straight from the
    // pointer's viewport coordinates. It used to be an absolutely-positioned child of the chart box,
    // clamped inside the canvas, so it could not travel below a certain line and it jumped when the clamp
    // kicked in. Fixed + viewport coordinates = it follows the pointer 1:1, freely.
    try { var _oldTip = document.getElementById("dragonStatsTip"); if (_oldTip && _oldTip.parentNode) _oldTip.parentNode.removeChild(_oldTip); } catch (e) {}
    var tip = document.createElement("div");
    tip.id = "dragonStatsTip";
    tip.style.cssText = "position:fixed; display:none; pointer-events:none; z-index:100000; padding:.28rem .45rem; border:1px solid rgba(155,107,255,.55); border-radius:8px; background:rgba(12,12,18,.96); color:#e8e2ff; text-align:center; line-height:1.35; white-space:nowrap; box-shadow:0 6px 18px rgba(0,0,0,.6); transform:translateX(-50%); will-change:left,top;";
    tip.style.fontSize = "11px";
    document.body.appendChild(tip);
    wrap.append(canvas);
    var sum = document.createElement("div");
    sum.id = "dragonStatsSummary";
    sum.style.cssText = "margin-top:.3rem; font-size:.72rem; color:#9a91b3; text-align:center;";
    sum.textContent = "Loading…";
    body.append(row, wrap, sum);
    // 🌐 the merged Visitors block sits at the BOTTOM of this card (Egon 23.09.2026, W-UI224)
    try { body.appendChild(dragonVisitorsBlock()); } catch (e) {}
    card.append(h, body);
    canvas.addEventListener("pointermove", function (ev) { statsHover(ev.clientX, ev.clientY, ev.pointerType); });
    canvas.addEventListener("pointerdown", function (ev) { statsHover(ev.clientX, ev.clientY, ev.pointerType); });
    canvas.addEventListener("pointerleave", statsHideTip);
    // Egon 19.09.2026 — on a phone, dragging a finger over the board must move the INFO PANEL, not scroll
    // the page (before, the page usually scrolled instead of showing the tooltip). The canvas claims the
    // gesture for itself: touch-action:none + a non-passive touchmove that is prevented. Scrolling the
    // page still works everywhere else on the card, so the panel can never trap the user.
    canvas.style.touchAction = "none";
    canvas.style.webkitTouchCallout = "none";
    canvas.style.userSelect = "none";
    ;function statsTouch(ev) {
      try { ev.preventDefault(); } catch (e) {}
      var t = ev.touches && ev.touches[0];
      if (t) statsHover(t.clientX, t.clientY, "touch");
    }
    canvas.addEventListener("touchstart", statsTouch, { passive: false });
    canvas.addEventListener("touchmove", statsTouch, { passive: false });
    canvas.addEventListener("touchend", function () { setTimeout(statsHideTip, 1400); }, { passive: true });
    if (!window.__dragonStatsResizeHooked) {
      window.__dragonStatsResizeHooked = true;
      window.addEventListener("resize", function () { try { if (statsCardVisible()) statsDraw(); } catch (e) {} });
    }
    syncBtns();
    statsFetch(true, function () { statsDraw(); });
    // Egon 22.09.2026 — draw the board AT ONCE (an empty frame is still a correctly sized chart) and again
    // over the next frames: the card is built while its panel can still be hidden (width 0), and a moment
    // later it has its real width. This is what stops the canvas from ever sitting at the browser's
    // default 300x150 square — the "stupidly small" look.
    try { statsDraw(); } catch (e) {}
    try {
      requestAnimationFrame(function () { try { if (statsCardVisible()) statsDraw(); } catch (e) {} });
      setTimeout(function () { try { if (statsCardVisible()) statsDraw(); } catch (e) {} }, 60);
      setTimeout(function () { try { if (statsCardVisible() && statsWrapWidth() !== statsLastW) statsDraw(); } catch (e) {} }, 420);
    } catch (e) {}
    return card;
  };
  ;function bootStats() {
    makeOnlineButton();
    if (makeStatsPanel()) { connectStats(); dragonStatsListedGalleries(); }
    dragonDetectCountry();
    var statsHbTimer = null;
    function statsHbJitter(ms) { return Math.round(ms * (0.85 + Math.random() * 0.3)); }
    function statsHeartbeat() {
      if (statsHbTimer) { try { clearTimeout(statsHbTimer); } catch (e) {} }
      statsHbTimer = null;
      try { dragonStatsListedGalleries(); } catch (e) {}
      // One lightweight presence heartbeat per browser. Visible tabs beat every 40 s, hidden tabs
      // every 70 s (background throttling allows ~1 wake per minute); the 180 s server window absorbs
      // throttling plus one missed beat, with jitter so the fleet never beats in lockstep.
      var hidden = false;
      try { hidden = (document.visibilityState === "hidden"); } catch (e) {}
      try {
        // The heartbeat is also the watchdog: if the link has been quiet for three beats, it is dead
        // (a suspended phone can leave a socket that never fires `close`), so replace it and start over.
        if (statsLinkStale()) { try { dragonStatsReconnect(); } catch (e) {} }
        else if (socket && socket.rpc && socket.rpc.dragonPresencePing) {
          socket.rpc.dragonPresencePing(dragonPresencePack()).then(function (s) { try { applyStats(JSON.parse(s)); } catch (e) {} }).catch(function () {});
        }
      } catch (e) {}
      statsHbTimer = setTimeout(statsHeartbeat, statsHbJitter(hidden ? 70000 : 40000));
    }
    statsHbTimer = setTimeout(statsHeartbeat, statsHbJitter(40000));
    // Egon 23.09.2026 — the moment the tab is looked at again, refresh at once (see dragonStatsWake).
    try {
      document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") dragonStatsWake(); });
      window.addEventListener("focus", dragonStatsWake);
      window.addEventListener("pageshow", dragonStatsWake);
      window.addEventListener("online", dragonStatsWake);
      // Best-effort leave notice on tab close; the server-side window expiry covers it when lost.
      try { window.addEventListener("pagehide", function () { try { if (socket && socket.rpc && socket.rpc.dragonPresenceLeave) { try { socket.rpc.dragonPresenceLeave(dragonPresencePack()); } catch (e) {} } } catch (e) {} }); } catch (e) {}
    } catch (e) {}
    window.dragonStatsImageGenerated = function () {
      if (socket) { try { socket.rpc.imageGenerated("").then(function (s) { try { applyStats(JSON.parse(s)); } catch (e) {} }).catch(function () {}); } catch (e) {} }
    };
    window.__dragonStatsSockets = function () { return { socket: socket }; };
  }
  if (document.body) bootStats();
  else window.addEventListener("DOMContentLoaded", bootStats);
})();
