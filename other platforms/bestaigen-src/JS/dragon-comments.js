// ============================================================================
// 💬 PICTURE COMMENTS (dragon-comments) — Egon 23.09.2026
// ----------------------------------------------------------------------------
// Egon: "independent of chat but visible to everyone, written comment logs are kept on server, can't we
// create a new comment system? i don't like this broken primitive system." — so this is OUR OWN comment
// system: nothing to do with comments-plugin / the chat, our own UI, and the records live in the
// generator's durable server state (see the PICTURE COMMENTS region in the server script inside
// index.html). The server hashes every image id before storing it, so no raw ids are kept per comment.
//
// What this file provides (all on `window`, so the lightbox and the pages can use them):
//   dragonCommentsOpen(item)        open the comment panel for a picture (item = {imageId,url,prompt})
//   dragonCommentsBadges(scopeEl)   (re)draw the 💬 count badge on every gallery tile in `scopeEl`
//   dragonCommentsKey(item)         the stable key for a picture (imageId, else its url)
//   dragonSharedSocket()            the ONE lazily-opened server socket this module reuses
//   dragonPopover(el, close)        register a popup/menu so ANY outside pointerdown closes it
//                                    (Egon: "all ... menus ... should close when clicking outside")
// ============================================================================
(function () {
  var sock = null, sockP = null, sockDown = false, downUntil = 0, sockDownWhy = "";

  function t(msg) { try { if (window.dragonToast) window.dragonToast(msg); } catch (e) {} }

  // ---- one shared socket for comment traffic ------------------------------------------------
  window.dragonSharedSocket = function () {
    if (sock && sock.readyState === 1) return Promise.resolve(sock);
    if (sockP) return sockP;
    if (sockDown && Date.now() < downUntil) return Promise.reject(new Error("server-down" + (sockDownWhy ? ":" + sockDownWhy : "")));
    sockP = new Promise(function (res, rej) {
      var s;
      try {
        if (!window.root || typeof root.createServerSocket !== "function") throw new Error("no-server");
        s = root.createServerSocket();
        try { if (window.dragonIdentifySocket) window.dragonIdentifySocket(s); } catch (e2) {}
      } catch (e) { sockP = null; rej(e); return; }
      // ONE router for every pub/sub frame: each incoming message is parsed once and handed to the
      // handlers registered for its topic (see dragonSharedTopic below) — the comment panel keeps its own
      // listener, so nothing about the existing behaviour changes (rule I104: one socket, one story).
      try { s.addEventListener("message", routeMessage); } catch (e) {}
      var done = false;
      var timer = setTimeout(function () {
        if (done) return; done = true; sockP = null; sockDown = true; downUntil = Date.now() + 20000 + Math.floor(Math.random() * 10000); sockDownWhy = "timeout";
        try { s.close(1000, "timeout"); } catch (e) {}
        rej(new Error("timeout"));
      }, 12000);
      s.addEventListener("open", function () {
        if (done) return; done = true; clearTimeout(timer); sock = s; sockP = null; sockDown = false; sockDownWhy = ""; res(s);
      });
      s.addEventListener("error", function () { /* the close handler takes over */ });
      s.addEventListener("close", function (ev) {
        var code = ev && ev.code;
        sock = null; sockP = null;
        // 4403 = the page is not on perchance.org / permanently refused; 1011 = the server code failed
        // to start. Both are permanent-ish, so stop hammering the server (the comments UI says so).
        if (code === 4403) { sockDown = true; downUntil = Date.now() + 3600000; sockDownWhy = "refused-4403"; }
        else if (code === 1011) { sockDown = true; downUntil = Date.now() + 120000 + Math.floor(Math.random() * 60000); sockDownWhy = "server-boot-1011"; }
        // 4429 = the platform QUARANTINED this generator's server (repeated handler timeouts, memory-limit
        // failures or crashes). The reason carries the retry delay; reconnecting earlier only adds load to
        // a server that is already in trouble, so wait it out (capped at 30 min so a session recovers).
        else if (code === 4429) {
          sockDownWhy = "quarantine-4429";
          var wait = 60000;
          var rm = String(ev && ev.reason || "").match(/retry after\s+(\d+)/i);
          if (rm) wait = Math.min(1800000, Math.max(5000, parseInt(rm[1], 10)));
          // Egon 17.10.2026 (quarantine-4429): jitter so hundreds of browsers do not reconnect in the same second after a shared quarantine
          // Egon 20.10.2026: widened 15s to 60s — the whole herd still returned inside one Liked wave and re-quarantined on every fence lift
          sockDown = true; downUntil = Date.now() + wait + Math.floor(Math.random() * 60000);
        }
        if (!done) { done = true; clearTimeout(timer); rej(new Error("closed " + code)); }
      });
    });
    return sockP;
  };

  function rpc(method, data) {
    return window.dragonSharedSocket().then(function (s) {
      var call;
      try { call = s.rpc[method](data === undefined ? "" : data); }
      catch (e) { return Promise.reject(e); }
      // No built-in RPC timeout exists, so a call into a restarting server would hang the UI forever —
      // bound it and let the caller retry or fail honestly instead.
      return Promise.race([call, new Promise(function (_, rej) {
        setTimeout(function () { rej(new Error("rpc-timeout")); }, 25000);
      })]);
    }).then(function (v) {
      scheduleIdleClose();
      return v;
    }, function (e) {
      scheduleIdleClose();
      throw e;
    });
  }
  // ONE rpc path for every module that talks to the server (the ⭐ like counter uses this too), so there
  // is a single socket, a single reconnect story and a single idle-close timer (rule I104).
  window.dragonServerRpc = rpc;
  window.dragonSharedSocketInfo = function () {
    var left = (sockDown && Date.now() < downUntil) ? (downUntil - Date.now()) : 0;
    return { open: !!(sock && sock.readyState === 1), pending: !!sockP, downMs: left, why: left > 0 ? sockDownWhy : "" };
  };
  window.dragonSharedSocketReset = function () {
    if (sockDownWhy === "timeout" || !(sockDown && Date.now() < downUntil)) { sockDown = false; downUntil = 0; sockDownWhy = ""; return true; }
    return false;
  };

  // ---- PUB/SUB on the ONE socket (Egon 23.09.2026) -----------------------------------------------
  // Any module can watch a server topic without opening its own connection: `dragonSharedTopic(topic,
  // cb)` registers a handler and returns the function that releases it. While at least one handler is
  // registered the socket is HELD OPEN (the idle close below waits), so a module that wants live pushes
  // simply keeps its handle — and the moment it lets go, the socket idles out exactly as before.
  var topicHandlers = {};   // topic -> [handler]
  var topicHolds = 0;       // how many live subscriptions are keeping the socket open
  function routeMessage(ev) {
    if (!ev || typeof ev.data !== "string") return;
    var m = null;
    try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (!m || !m.topic) return;
    var hs = topicHandlers[m.topic];
    if (!hs) return;
    for (var i = 0; i < hs.length; i++) { try { hs[i](m); } catch (e) {} }
  }
  window.dragonSharedTopic = function (topic, cb) {
    var t = String(topic || "");
    if (!t || typeof cb !== "function") return function () {};
    var hs = topicHandlers[t] || (topicHandlers[t] = []);
    hs.push(cb);
    topicHolds++;
    // make sure a socket exists right away (the caller wants live traffic, not a lazy one)
    window.dragonSharedSocket().then(function () {}, function () {});
    var released = false;
    return function () {
      if (released) return;
      released = true;
      var arr = topicHandlers[t];
      if (arr) { var i = arr.indexOf(cb); if (i !== -1) arr.splice(i, 1); }
      topicHolds = Math.max(0, topicHolds - 1);
      if (!topicHolds && !openPanel) scheduleIdleClose();
    };
  };

  // The comment socket is NOT kept open forever: a visitor who never opens a comment panel adds no
  // connection to the server at all (the "online" figure counts connections, and this generator already
  // opens more than one socket per visitor). 30 s after the last comment traffic — and never while the
  // panel is on screen — the socket closes; the next badge fetch or panel open simply makes a new one.
  var idleTimer = null;
  function scheduleIdleClose() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (openPanel || topicHolds > 0) { scheduleIdleClose(); return; }
      try { if (sock) sock.close(1000, "idle"); } catch (e) {}
      sock = null; sockP = null;
    }, 30000);
  }

  // ---- helpers ------------------------------------------------------------------------------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[<>&"']/g, function (m) {
      return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }
  function keyOf(item) {
    if (!item) return "";
    if (typeof item === "string") return item;
    return String(item.imageId || item.vid || item.url || "");
  }
  window.dragonCommentsKey = keyOf;

  function timeAgo(ts) {
    var s = Math.max(0, Math.floor(Date.now() / 1000) - (ts || 0));
    if (s < 45) return "just now";
    if (s < 3600) return Math.round(s / 60) + "m ago";
    if (s < 86400) return Math.round(s / 3600) + "h ago";
    if (s < 2592000) return Math.round(s / 86400) + "d ago";
    try { return new Date((ts || 0) * 1000).toLocaleDateString(); } catch (e) { return ""; }
  }
  function nameColor(n) {
    var h = 0, s = String(n || "?");
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return "hsl(" + (h % 360) + " 65% 68%)";
  }
  // ---- WHO IS COMMENTING (Egon 23.09.2026) ------------------------------------------------------
  // "new lightbox comment button functions: Name should not be editable. Use system name instead.
  // also each user should only be able to enter 1 comment. they can change their comment if they want."
  // So there is no name box any more: the name is the one the SYSTEM already knows for this visitor —
  // the site-wide name they told the chat/Dexa (localStorage.dragonBotUserName, the same value the Dexa
  // bubbles greet them with), else their cloud account name, else "Guest". Nothing is typed per comment,
  // so nobody can post under a made-up name either.
  function sysName() {
    try {
      if (window.dragonBotAPI && window.dragonBotAPI.userName) {
        var n = String(window.dragonBotAPI.userName() || "").trim();
        if (n) return n.slice(0, 24);
      }
    } catch (e) {}
    try {
      var c = JSON.parse(localStorage.dragonCloudUser || "null");
      if (c && c.u) return String(c.u).slice(0, 24);
    } catch (e) {}
    return "Guest";
  }
  window.dragonCommentName = sysName;
  // The IDENTITY the server enforces "one comment per visitor" with: a random value that stays on this
  // browser. It is sent to the server, HASHED THERE (exactly like an image id), and only the hash is ever
  // stored — no raw visitor id lives in the durable region.
  function myUid() {
    try {
      var v = localStorage.dragonCommentUid;
      if (typeof v === "string" && v.length >= 16) return v;
    } catch (e) {}
    var s = "";
    try {
      if (window.crypto && crypto.getRandomValues) {
        var b = new Uint8Array(16);
        crypto.getRandomValues(b);
        for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? "0" : "") + b[i].toString(16);
      }
    } catch (e) {}
    if (!s) s = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    try { localStorage.dragonCommentUid = s; } catch (e) {}
    return s;
  }
  window.dragonCommentUid = myUid;

  // ---- the panel ----------------------------------------------------------------------------
  var openPanel = null;
  window.dragonCommentsOpen = function (item) {
    var key = keyOf(item);
    if (!key) { t("💬 this picture has no id to comment on"); return; }
    var it = (item && typeof item === "object") ? item : { url: "" };
    // the visitor's identity for this panel: their SYSTEM name (read-only) and their stable uid
    var nmSys = sysName();
    var myKeyHex = "";
    try { if (openPanel && openPanel.parentNode) openPanel.remove(); } catch (e) {}
    try { document.getElementById("dragonCmCss").remove(); } catch (e) {}
    var st = document.createElement("style");
    st.id = "dragonCmCss";
    st.textContent =
      "#dragonCm .dcm-row{padding:.45rem .55rem;border-radius:9px;background:#1a1a22;border:1px solid #33333f;}" +
      "#dragonCm .dcm-row+.dcm-row{margin-top:.35rem;}" +
      "#dragonCm .dcm-name{font-weight:800;font-size:.78rem;}" +
      "#dragonCm .dcm-meta{font-size:.62rem;color:#8d8da0;}" +
      "#dragonCm .dcm-txt{font-size:.82rem;line-height:1.45;white-space:pre-wrap;word-break:break-word;color:#eae6f6;margin-top:.15rem;}" +
      "#dragonCm textarea,#dragonCm input{font-family:inherit;background:#0e0e13;color:#eee;border:1px solid #5a5a6a;border-radius:8px;padding:.4rem .5rem;font-size:.8rem;box-sizing:border-box;}" +
      "#dragonCm textarea:focus,#dragonCm input:focus{outline:none;border-color:#9b6bff;}" +
      "#dragonCm button{font-family:inherit;cursor:pointer;}" +
      "#dragonCm .dcm-pm{flex:0 0 auto;width:24px;height:24px;border-radius:6px;border:1px solid #4a4a58;background:#23232c;font-size:.72rem;line-height:1;padding:0;}" +
      "#dragonCm .dcm-pm:hover{border-color:#9b6bff;}";
      "#dragonCm .dcm-send{font-weight:800;font-size:.82rem;padding:.45rem .85rem;border-radius:9px;border:1px solid #9b6bff;background:linear-gradient(180deg,#2a1a4a,#1a102e);color:#d8c9ff;}" +
      "#dragonCm .dcm-send[disabled]{opacity:.5;cursor:default;}";
    document.head.appendChild(st);

    var ov = document.createElement("div");
    ov.id = "dragonCm";
    ov.style.cssText = "position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;background:rgba(6,4,10,.72);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);font:16px/1.4 system-ui,sans-serif;";
    ov.tabIndex = 0;
    var card = document.createElement("div");
    card.style.cssText = "position:relative;width:min(94vw,520px);max-height:min(86vh,680px);display:flex;flex-direction:column;background:linear-gradient(180deg,#20202a,#141419);color:#ece6ff;border:1px solid #3a3350;border-radius:14px;box-shadow:0 18px 60px rgba(0,0,0,.7);overflow:hidden;";

    var head = document.createElement("div");
    head.style.cssText = "flex:0 0 auto;display:flex;align-items:center;gap:.6rem;padding:.7rem .8rem;border-bottom:1px solid #33333f;background:#191922;";
    var thumb = document.createElement("div");
    thumb.style.cssText = "width:44px;height:44px;border-radius:8px;overflow:hidden;flex:0 0 auto;background:#0e0e13;border:1px solid #3a3350;";
    if (it.url) { var th = document.createElement("img"); th.src = it.url; th.alt = ""; th.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;"; thumb.appendChild(th); }
    var htxt = document.createElement("div");
    htxt.style.cssText = "flex:1 1 auto;min-width:0;";
    htxt.innerHTML = "<div style='font-weight:800;font-size:.92rem;'>💬 Comments <span id='dragonCmCount' style='color:#a99ad6;font-weight:600;'></span></div><div style='font-size:.66rem;color:#8d8da0;'>Kept on this generator's own server — open to everyone, no account needed. You post under your own name, and you can edit what you wrote.</div>";
    var closeB = document.createElement("button");
    closeB.textContent = "✖";
    closeB.title = "Close";
    closeB.style.cssText = "flex:0 0 auto;width:30px;height:30px;border-radius:50%;border:1px solid #4a4a58;background:#23232c;color:#ddd;font-size:.85rem;";
    head.append(thumb, htxt, closeB);

    var list = document.createElement("div");
    list.style.cssText = "flex:1 1 auto;min-height:120px;overflow:auto;padding:.6rem .7rem;";
    list.innerHTML = "<div id='dragonCmEmpty' style='color:#8d8da0;font-size:.8rem;text-align:center;padding:1.6rem .4rem;'>Loading\u2026</div>";

    var foot = document.createElement("div");
    foot.style.cssText = "flex:0 0 auto;border-top:1px solid #33333f;padding:.55rem .7rem;background:#191922;display:flex;flex-direction:column;gap:.4rem;";
    // 🪪 NO NAME BOX (Egon 23.09.2026): the visitor's SYSTEM name is used, shown here as a fact.
    var nameRow = document.createElement("div");
    nameRow.style.cssText = "display:flex;align-items:center;gap:.4rem;font-size:.66rem;color:#a99ad6;";
    var whoChip = document.createElement("span");
    whoChip.style.cssText = "font-weight:800;";
    whoChip.textContent = "🪪 " + nmSys;
    nameRow.appendChild(whoChip);
    var oneNote = document.createElement("span");
    oneNote.style.cssText = "color:#8d8da0;font-size:.62rem;";
    oneNote.textContent = "· one comment per picture — you can edit yours any time";
    nameRow.appendChild(oneNote);
    var ta = document.createElement("textarea");
    ta.rows = 2;
    ta.maxLength = 600;
    ta.placeholder = "Write a comment… (Enter sends, Shift+Enter makes a new line)";
    ta.style.cssText = "width:100%;resize:vertical;";
    var sendRow = document.createElement("div");
    sendRow.style.cssText = "display:flex;align-items:center;gap:.5rem;justify-content:flex-end;";
    var hint = document.createElement("span");
    hint.style.cssText = "font-size:.62rem;color:#8d8da0;flex:1 1 auto;";
    hint.textContent = "Be kind — comments are public.";
    var sendB = document.createElement("button");
    sendB.className = "dcm-send";
    sendB.textContent = "Send";
    sendRow.append(hint, sendB);
    foot.append(nameRow, ta, sendRow);
    card.append(head, list, foot);
    ov.appendChild(card);
    document.body.appendChild(ov);
    openPanel = ov;
    clearTimeout(idleTimer);
    ov.focus();

    // EVERY popup closes on an outside pointerdown (Egon asked for this globally) — the panel joins
    // the same registry the menus use.
    window.dragonPopover(ov, function () { window.dragonCommentsClose(); }, { modal: true });
    window.dragonCommentsClose = function () {
      try { if (ov.parentNode) ov.parentNode.removeChild(ov); } catch (e) {}
      if (openPanel === ov) openPanel = null;
      if (mySub) { try { mySub.unsub(); } catch (e) {} mySub = null; }
      scheduleIdleClose();
    };
    closeB.onclick = window.dragonCommentsClose;
    ov.addEventListener("keydown", function (e) { if (e.key === "Escape") window.dragonCommentsClose(); });

    var mySub = null;
    var myText = "";
    var lastArr = [];
    ;function syncComposer() {
      // Your own comment is loaded INTO the box, so changing it is one click — and the button says what
      // it will do. (Egon: "each user should only be able to enter 1 comment. they can change their comment if they want.")
      if (myText && !String(ta.value || "").trim()) ta.value = myText;
      if (!sendB.disabled) sendB.textContent = myText ? "\uD83D\uDCBE Update my comment" : "Send";
      hint.textContent = myText ? "You already commented \u2014 saving replaces it." : "Be kind \u2014 comments are public.";
    }
    function draw(arr) {
      lastArr = arr || [];
      var c = document.getElementById("dragonCmCount");
      if (c) c.textContent = arr && arr.length ? "(" + arr.length + ")" : "";
      list.innerHTML = "";
      if (!arr || !arr.length) {
        myText = "";
        list.innerHTML = "<div style='color:#8d8da0;font-size:.8rem;text-align:center;padding:1.6rem .4rem;'>No comments yet — be the first ✍️</div>";
        syncComposer();
        return;
      }
      var mine = null;
      arr.forEach(function (c2) {
        // "mine" comes from the server's flag when this list was fetched for me, and from the hashed
        // visitor tag otherwise (a pub/sub push has no per-connection flags).
        var isMine = !!c2.m || (!!myKeyHex && c2.k === myKeyHex);
        if (isMine) mine = c2;
        var row = document.createElement("div");
        row.className = "dcm-row";
        if (isMine) { row.style.borderColor = "#9b6bff"; row.style.background = "#221a34"; }
        var nm = document.createElement("span");
        nm.className = "dcm-name";
        nm.style.color = nameColor(c2.n);
        nm.textContent = c2.n || "anon";
        var meta = document.createElement("span");
        meta.className = "dcm-meta";
        meta.textContent = "  ·  " + timeAgo(c2.ts) + (c2.e ? "  ·  edited" : "") + (isMine ? "  ·  yours" : "");
        var top = document.createElement("div");
        top.style.display = "flex";
        top.style.alignItems = "center";
        top.style.gap = ".35rem";
        if (!isMine && window.dragonPmByName) {
          // 💌 Send-PM shortcut, left of the nick (Egon 17.10.2026). Resolves by name against
          // the live PM roster — whoever is still on the site is listed, no inbox visit needed.
          (function (who) {
            var pmB = document.createElement("button");
            pmB.type = "button";
            pmB.className = "dcm-pm";
            pmB.textContent = "💌";
            pmB.title = "Send " + String(who || "anon").slice(0, 24) + " a private message";
            pmB.onclick = function (ev) { try { ev.stopPropagation(); } catch (e) {} window.dragonPmByName(who); };
            top.appendChild(pmB);
          })(c2.n || "anon");
        }
        top.append(nm, meta);
        var txt = document.createElement("div");
        txt.className = "dcm-txt";
        txt.textContent = c2.t || "";
        row.append(top, txt);
        list.appendChild(row);
      });
      myText = mine ? String(mine.t || "") : "";
      syncComposer();
    }

    function load() {
      rpc("dragonCommentList", JSON.stringify({ i: key, u: myUid() })).then(function (raw) {
        var d = null;
        try { d = JSON.parse(raw); } catch (e) { d = null; }
        if (!d || !d.ok) { list.innerHTML = "<div style='color:#ff9aa5;font-size:.8rem;text-align:center;padding:1.4rem;'>Couldn't load comments right now.</div>"; return; }
        myKeyHex = d.k || "";
        draw(d.c || []);
        if (d.topic) {
          mySub = { unsub: function () {} };
          window.dragonSharedSocket().then(function (s) {
            function onMsg(ev) {
              if (!ev || typeof ev.data !== "string") return;
              try {
                var m = JSON.parse(ev.data);
                if (m && m.c && m.topic === d.topic) draw(m.c);
              } catch (e) {}
            }
            s.addEventListener("message", onMsg);
            mySub.unsub = function () { try { s.removeEventListener("message", onMsg); } catch (e) {} };
          }).catch(function () {});
        }
      }).catch(function () {
        list.innerHTML = "<div style='color:#ff9aa5;font-size:.8rem;text-align:center;padding:1.4rem;'>Comments are unavailable right now (the comment server could not be reached).</div>";
      });
    }
    load();

    function submit() {
      var tx = String(ta.value || "").trim();
      if (!tx) return;
      // NO name box: the SYSTEM name goes with the comment, and the browser's own uid travels as the
      // identity so the server can enforce "one comment per visitor" (it hashes it — see cmtAdd).
      var wasUpdate = !!myText;
      sendB.disabled = true;
      sendB.textContent = "⏳";
      var payload = JSON.stringify({ i: key, n: nmSys, t: tx, u: myUid() });
      rpc("dragonCommentAdd", payload).then(function (raw) {
        var d = null;
        try { d = JSON.parse(raw); } catch (e) { d = null; }
        sendB.disabled = false;
        if (!d || !d.ok) {
          sendB.textContent = wasUpdate ? "\uD83D\uDCBE Update my comment" : "Send";
          if (d && d.err === "rate") t("\uD83D\uDCAC easy there — a short pause between comments");
          else if (d && d.err === "full") t("\uD83D\uDCAC the comment store is full right now");
          else t("\uD83D\uDCAC the comment could not be saved");
          return;
        }
        draw(d.c || []);
        counts[key] = (d.c || []).length;
        countsAt[key] = Date.now();
        repaintKey(key);
        t(wasUpdate ? "\uD83D\uDCAC your comment was updated" : "\uD83D\uDCAC comment posted as " + nmSys);
        // Single-symbol process display (Egon): ✅ lands on success, then the real label
        // comes back — draw()/syncComposer above already restored it, so re-apply after them.
        sendB.textContent = "✅";
        setTimeout(function () { try { if (sendB.isConnected && !sendB.disabled) sendB.textContent = wasUpdate ? "💾 Update my comment" : "Send"; } catch (e) {} }, 1200);
        // 💬🔥 Egon 24.09.2026 — a NEW comment is a trending signal for the picture that received it (an
        // edit of your own comment is not a new signal, so `wasUpdate` skips it). One map write, no request.
      }).catch(function () {
        sendB.disabled = false;
        sendB.textContent = wasUpdate ? "\uD83D\uDCBE Update my comment" : "Send";
        t("\uD83D\uDCAC the comment could not be sent (no connection to the comment server)");
      });
    }
    sendB.onclick = submit;
    ta.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
    });
  };

  // Close whatever panel is open (used by the popover registry and by the lightbox).
  window.dragonCommentsClose = function () {
    try { if (openPanel && openPanel.parentNode) openPanel.remove(); } catch (e) {}
    openPanel = null;
  };

  // ---- the 💬 badge on gallery tiles --------------------------------------------------------
  // "if an image received a comment, it should show this on the image tile, centred at the bottom. it should be always visible."
  var counts = {};
  var countsAt = {};
  var fetchTok = 0;
  var BADGE_TTL = 60000;
  // ---- count lookups for the gallery's 💬 Commented image sort --------------------------------
  // The public gallery's "Commented" mode asks these two questions per tile: "is this picture's count
  // already known?" (0 = unknown, -1 = no comments cached as 0) and "please fetch these counts now".
  // They share the badge cache above (60 s TTL), so a gallery that shows badges pays nothing extra.
  window.dragonCommentsCountOf = function (k) {
    var v = counts[String(k || "")];
    return (v === undefined) ? -1 : (v | 0);
  };
  window.dragonCommentsPrefetch = function (ids) {
    var want = [], now = Date.now();
    for (var i = 0; i < (ids || []).length; i++) {
      var k = String(ids[i] || "");
      if (!k) continue;
      if (countsAt[k] !== undefined && now - countsAt[k] <= BADGE_TTL) continue;
      if (want.indexOf(k) === -1) want.push(k);
    }
    if (!want.length) return Promise.resolve();
    if (want.length > 300) want = want.slice(0, 300);
    return rpc("dragonCommentCounts", want.join(",")).then(function (raw) {
      var d = null;
      try { d = JSON.parse(raw); } catch (e) { d = null; }
      want.forEach(function (k) { counts[k] = (d && d[k]) ? (d[k] | 0) : 0; countsAt[k] = Date.now(); });
    }, function () {
      // a failed lookup must not hang the gallery: cache 0, so the tile is simply not shown in this mode
      want.forEach(function (k) { counts[k] = 0; countsAt[k] = Date.now(); });
    });
  };
  // ---- the WHOLE comment index in one frame: the 💬 Commented sort's fast path ----------------------
  // Egon 23.09.2026 ("madde ikideki sistemi bununla uygula"). The server never stores a raw picture id,
  // only an 8-char tag = the first 8 characters of this exact FNV-1a pair, so the client can hash a tile's
  // id the SAME way and test membership in a Set — a purely local filter, NO round trip per row (the old
  // path asked for counts a slice at a time while it walked the listing). The index is fetched once a
  // minute; a failure caches an EMPTY map, so the mode fails closed and can never loop.
  function cHash32(str, seed) {
    var h = seed >>> 0;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  window.dragonCommentTag = function (str) {
    var s = String(str || "");
    var t = (cHash32(s, 0x811c9dc5) >>> 0).toString(16) + "." + (cHash32(s, 0x1000193) >>> 0).toString(16);
    t = t.slice(0, 8);
    while (t.length < 8) t += "\u0000";   // the server stores exactly 8 bytes (a short hash is zero-padded)
    return t;
  };
  var keyCounts = null, keyCountsAt = 0, keyFetch = null;
  window.dragonCommentsKeySet = function () {
    return (keyCounts && Date.now() - keyCountsAt <= BADGE_TTL) ? keyCounts : null;
  };
  window.dragonCommentsKeysFetch = function () {
    if (keyCounts && Date.now() - keyCountsAt <= BADGE_TTL) return Promise.resolve(keyCounts);
    if (keyFetch) return keyFetch;
    keyFetch = rpc("dragonCommentKeys", "").then(function (raw) {
      var d = null;
      try { d = JSON.parse(raw); } catch (e) { d = null; }
      var m = new Map();
      if (d && d.ok && d.t) {
        var parts = String(d.t).split(",");
        for (var i = 0; i < parts.length; i++) {
          if (!parts[i]) continue;
          var j = parts[i].lastIndexOf(":");
          if (j > 0) m.set(parts[i].slice(0, j), (parts[i].slice(j + 1) | 0));
        }
      }
      keyCounts = m; keyCountsAt = Date.now(); keyFetch = null;
      return m;
    }, function () {
      keyCounts = new Map(); keyCountsAt = Date.now(); keyFetch = null;
      return keyCounts;
    });
    return keyFetch;
  };
  // Let the gallery write a count it already knows (from the index) into the shared cache, so the badge
  // and dragonCommentsCountOf() answer for that picture without a second query.
  window.dragonCommentsSeed = function (k, n) {
    var key = String(k || "");
    if (!key) return;
    counts[key] = n | 0; countsAt[key] = Date.now();
  };

  function paintBadge(tile) {
    var k = tile.getAttribute("data-cmt-key");
    if (!k) return;
    var n = counts[k] | 0;
    var b = tile.querySelector(".dcm-badge");
    if (!n) { if (b) b.remove(); return; }
    if (!b) {
      b = document.createElement("span");
      b.className = "dcm-badge";
      b.style.cssText = "position:absolute;left:50%;bottom:6px;top:auto;transform:translateX(-50%);z-index:4;display:inline-flex;align-items:center;gap:.2rem;font-size:.66rem;font-weight:800;line-height:1.3;padding:.12rem .42rem;border-radius:999px;background:rgba(10,10,14,.86);color:#d8c9ff;border:1px solid rgba(155,107,255,.6);pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.45);";
      tile.appendChild(b);
    }
    try { b.style.left = "50%"; b.style.top = "auto"; b.style.bottom = "6px"; b.style.transform = "translateX(-50%)"; } catch (eP) {}
    b.textContent = "💬 " + n;
  }
  // Repaint every tile that shows this picture (used right after posting a comment, so the badge the
  // visitor just earned is on screen immediately).
  function repaintKey(k) {
    var all = document.querySelectorAll('.dragon-gal-tile[data-cmt-key="' + String(k).replace(/"/g, '\\"') + '"]');
    for (var i = 0; i < all.length; i++) paintBadge(all[i]);
    try { if (window.__dragonAdminScanBadges) window.__dragonAdminScanBadges(); } catch (eA) {}
  }
  window.dragonCommentsRepaint = repaintKey;
  var pending = null;
  window.dragonCommentsBadges = function (scopeEl) {
    var root2 = scopeEl || document;
    var tiles = root2.querySelectorAll(".dragon-gal-tile");
    var ids = [];
    var now = Date.now();
    for (var i = 0; i < tiles.length; i++) {
      var k = tiles[i].getAttribute("data-cmt-key");
      if (!k) continue;
      paintBadge(tiles[i]);
      // refresh the cached count when it is unknown or older than a minute, so a picture that just got
      // its first comment grows its badge without a page reload
      if ((countsAt[k] === undefined || now - countsAt[k] > BADGE_TTL) && ids.indexOf(k) === -1) ids.push(k);
    }
    if (!ids.length) return;
    if (ids.length > 200) ids = ids.slice(0, 200);
    clearTimeout(pending);
    pending = setTimeout(function () {
      var tok = ++fetchTok;
      rpc("dragonCommentCounts", ids.join(",")).then(function (raw) {
        if (tok !== fetchTok) return;
        var d = null;
        try { d = JSON.parse(raw); } catch (e) { return; }
        if (!d) return;
        ids.forEach(function (k) { counts[k] = d[k] | 0; countsAt[k] = Date.now(); });
        var all = document.querySelectorAll(".dragon-gal-tile");
        for (var j = 0; j < all.length; j++) paintBadge(all[j]);
      }).catch(function () {});
    }, 350);
  };

  function bootBadges() {
    var scheduled = false;
    var onChange = function () {
      if (scheduled) return;
      scheduled = true;
      setTimeout(function () {
        scheduled = false;
        try { window.dragonCommentsBadges(document); } catch (e) {}
      }, 500);
    };
    if (window.dragonBodyObserve) { window.dragonBodyObserve(onChange); return; }
    if (!window.MutationObserver) return;
    var mo = new MutationObserver(onChange);
    try { mo.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootBadges);
  else bootBadges();

  // ---- popovers: ANY outside pointerdown closes the open popup ------------------------------
  // Egon: "including the chat we will add, all emoji windows/even all dropdowns in the generator
  // selection menus/open menus should close when clicking outside the menu/window."
  // One registry + ONE capture-phase listener, so a menu only has to announce itself.
  var pops = [];
  window.dragonPopover = function (el, close, opt) {
    if (!el || typeof close !== "function") return;
    opt = opt || {};
    // modal popovers (like the comment panel) swallow clicks on themselves
    if (!opt.modal) {
      el.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    }
    pops.push({ el: el, close: close });
    var clean = function () {
      for (var i = pops.length - 1; i >= 0; i--) if (pops[i].el === el) pops.splice(i, 1);
      try { if (el.parentNode) el.parentNode.removeChild(el); } catch (e) {}
    };
    var origClose = close;
    pops[pops.length - 1].close = function () { clean(); try { origClose(); } catch (e) {} };
    return pops[pops.length - 1].close;
  };
  document.addEventListener("pointerdown", function (e) {
    if (!pops.length) return;
    for (var i = pops.length - 1; i >= 0; i--) {
      var p = pops[i];
      if (!p.el || !p.el.parentNode) { pops.splice(i, 1); continue; }
      if (p.el.contains(e.target)) continue;
      var cl = p.close;
      pops.splice(i, 1);
      try { cl(); } catch (e2) {}
    }
  }, true);
})();


// ============================================================================
// 💤 CHAT CHANNEL APP PARKING (Paket C4, W-UI295) — 25.09.2026
// The tabbed comments plugin builds EVERY channel's iframe up front and keeps them running — each one is a
// whole app with its own socket and timers — even while its pane is display:none and after the chat window
// is closed (measured: 6 live comment apps for a closed chat). Only the channel whose TAB is active stays
// alive (that is the one which polls for the unread badge); every other pane is parked on about:blank and is
// restored the moment its tab is activated.
//   dragonCommentsPark()        park every non-active pane now (returns how many panes were parked)
//   dragonCommentsParkSoon(ms)  the same, debounced — call it after the chat opens or closes
//   dragonCommentsParkState()   read-only counters (the check-up reads this)
// ============================================================================
(function () {
  var parked = 0, wakes = 0, timer = 0, timer2 = 0;

  function panes() { return document.querySelectorAll(".tabbed-comments-plugin-content"); }
  function activePane() {
    var tabs = document.querySelectorAll(".tabbed-comments-plugin-channel-tab");
    var ps = panes();
    for (var i = 0; i < tabs.length; i++) { if (/tabbed-comments-plugin-active-tab/.test(tabs[i].className)) return ps[i] || null; }
    return ps[0] || null;
  }
  function wakePane(pane) {
    var f = pane && pane.querySelector("iframe");
    if (!f) return false;
    var src = f.getAttribute("data-dragon-parked");
    if (!src) return false;
    if (f.getAttribute("src") !== "about:blank") { f.removeAttribute("data-dragon-parked"); return false; }   // the plugin reloaded it itself
    try { f.removeAttribute("data-dragon-parked"); f.src = src; wakes++; } catch (e) { return false; }
    return true;
  }
  function park() {
    var act = activePane(), n = 0;
    var cs = document.querySelectorAll(".comments-plugin-ctn");
    for (var i = 0; i < cs.length; i++) {
      var pane = cs[i].closest ? cs[i].closest(".tabbed-comments-plugin-content") : null;
      var f = cs[i].querySelector("iframe");
      if (!f || !pane) continue;
      if (pane === act) { wakePane(pane); continue; }
      var src = f.getAttribute("src") || "";
      if (!src || src === "about:blank") continue;
      try { f.setAttribute("data-dragon-parked", src); f.src = "about:blank"; } catch (e) { continue; }
      n++; parked++;
    }
    return n;
  }
  window.dragonCommentsPark = park;
  // Two passes: the plugin builds the channel panes a moment AFTER the chat opens, so a single late pass
  // would miss them. The second pass is a no-op when everything is already parked.
  window.dragonCommentsParkSoon = function (ms) {
    clearTimeout(timer); clearTimeout(timer2);
    var d = ms || 400;
    timer = setTimeout(function () { try { park(); } catch (e) {} }, d);
    timer2 = setTimeout(function () { try { park(); } catch (e) {} }, d + 2500);
  };
  window.dragonCommentsParkState = function () { return { parked: parked, wakes: wakes }; };
  document.addEventListener("click", function (ev) {
    var el = ev.target;
    var tab = el && el.closest ? el.closest(".tabbed-comments-plugin-tab") : null;
    if (tab) window.dragonCommentsParkSoon(80);
  }, true);
  setTimeout(function () { try { park(); } catch (e) {} }, 6000);   // covers the invisible background preload too
})();
