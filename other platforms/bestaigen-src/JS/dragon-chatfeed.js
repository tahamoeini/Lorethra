// dragon-chatfeed.js — OUR OWN chat message feed (v2).
// The comment-plugin chat lives in a cross-origin iframe: no button can be placed next to a
// nick inside it. But the plugin hands EVERY message to the parent page (onComment/onLoad),
// and dragon-pages keeps them in window.dragonChatMsgStore (per channel, newest last).
// This module renders that store OURSELVES: same messages, our rows, our buttons.
// v2 (Egon 17.10.2026): this feed is the DEFAULT chat view. The real plugin stays mounted
// underneath (never display:none): our feed floats above it with an L-shaped clip-path that
// leaves the bottom-right corner open, so the native settings gear stays visible and clickable
// and both corners stay aligned. Rooms, message range, emoji, Say-hi and avatars all live here.
// Reactions / tombstones / reports live on the server (CHAT region in index.html) because the
// plugin has no such feature. Replies are quote-style (the programmatic submit path drops the
// native reply target, so a quote in the text is the working reply).
// v2.1 (Egon 17.10.2026 feedback): no title row (the range button is first in the rooms row);
// actions live top-right of each row; the OWNER badge sits under the nick; quotes render in
// a grey box (native replies AND \"> @name:\" quote-text are both lifted into it); the image
// button opens the real gallery/vault/upload picker; Say hi is left of emoji.
// v2.2 (Egon 17.10.2026 feedback): feed ALWAYS fullscreen, plugin docks as the fixed corner mini
// (wide screens; narrow keeps the overlay + gear hole); toggle button gone; no user-tag chip;
// timestamp just left of reply; OWNER badge right above the nick.
// v2.3 (Egon 17.10.2026 feedback): old chat stays FULL-BODY UNDER the feed, only the native
// settings gear shows through a small hole; gear click steps the feed aside (settings mode) so the
// native popup is fully usable. OWNER badge wears a small frame directly above the nick
// (left-aligned); viewer-admins get delete-for-everyone on EVERY row.
// Rollback: delete this file + its <script> tag in index.html.
(function () {
  if (window.__dragonChatFeedInstalled) return;
  window.__dragonChatFeedInstalled = true;

  var FEED_ID = "dragonChatFeed", BTN_ID = "dragonChatFeedBtn";
  var REACTS = ["\uD83D\uDC4D", "\uD83D\uDC4E", "\u2764\uFE0F", "\uD83D\uDE04", "\uD83D\uDE21", "\uD83D\uDE2E"];
  var RANGE_OPTS = [
    { id: "day", icon: "\u2600\uFE0F", label: "Today" },
    { id: "week", icon: "\uD83D\uDDD3\uFE0F", label: "This week" },
    { id: "month", icon: "\uD83D\uDCC5", label: "This month" },
    { id: "year", icon: "\uD83D\uDCC6", label: "This year" },
    { id: "all", icon: "\u221E", label: "All messages" }
  ];
  var REPORT_REASONS = [
    { id: 1, label: "Spam" },
    { id: 2, label: "Abuse" },
    { id: 3, label: "Sexual content" },
    { id: 4, label: "Other" }
  ];
  var feedEl = null, listEl = null, roomsEl = null, rangeBtnEl = null;
  var footEl = null, inpEl = null, sendBtnEl = null;
  var timer = 0, metaTimer = 0, lastSig = "", lastMetaSig = "";
  var lastWinVisible = false;
  var metaCache = {}; // msgId -> {c:[6], mine:0..6, tomb:0/1}
  var reactBusy = {}; // msgId -> timestamp ms (double-click guard: second press would untoggle)

  function toast(m) { try { if (window.dragonToast) window.dragonToast(m); } catch (e) {} }
  function winEl() { try { return document.getElementById("dragonChatWindow"); } catch (e) { return null; } }
  function bodyEl() { try { return document.getElementById("dragonChatBody"); } catch (e) { return null; } }
  function store() { try { return window.dragonChatMsgStore || {}; } catch (e) { return {}; } }
  function activeChannel() {
    try {
      var w = winEl();
      if (!w) return "";
      var tab = w.querySelector(".tabbed-comments-plugin-channel-tab.tabbed-comments-plugin-active-tab");
      return tab ? (tab.dataset.channel || "") : "";
    } catch (e) { return ""; }
  }
  function isGeneral(ch) { return ch === "" || ch === "general"; }
  function rangeCutoff() {
    try {
      if (typeof window.dragonChatRangeState !== "function") return null;
      var s = window.dragonChatRangeState();
      if (!s || !s.cutoff) return null;
      var t = Date.parse(s.cutoff);
      return isNaN(t) ? null : t;
    } catch (e) { return null; }
  }
  function tombOf(id) {
    var m = metaCache[String(id)];
    return !!(m && m.tomb);
  }
  function feedMsgs() {
    var st = store(), ch = activeChannel(), out = [];
    var keys = isGeneral(ch) ? ["", "general"] : [ch];
    keys.forEach(function (k) {
      var arr = st[k] || [];
      for (var i = 0; i < arr.length; i++) out.push(arr[i]);
    });
    var cut = rangeCutoff();
    out = out.filter(function (c) {
      if (!c || !c.id) return false;
      if (tombOf(c.id)) return false;
      if (cut && (+c.time || 0) < cut) return false;
      return true;
    });
    out.sort(function (a, b) { return (a.time || 0) - (b.time || 0); });
    return out.slice(-200);
  }
  function dispName(c) {
    var u = (c && c.user) || {};
    var n = String(u.nickname || u.name || "").trim();
    if (n) return n.slice(0, 24);
    var v = String(u.visualId || "").trim();
    if (v) return v.slice(0, 12);
    return "anon";
  }
  function avatarUrl(c) {
    try {
      var u = (c && c.user) || {};
      var a = String(u.avatarUrl || u.avatar || u.photo || "").trim();
      if (/^https?:\/\//i.test(a)) return a;
    } catch (e) {}
    return "";
  }
  function isAdminMsg(c) { try { return !!((c && c.user && c.user.isAdmin)); } catch (e) { return false; } }
  // Egon 17.10.2026 — the viewer IS knowable as admin: our own messages carry user.isAdmin,
  // so when any byCurrentUser message says isAdmin, this viewer gets delete-for-everyone rows.
  function viewerIsAdmin() {
    try {
      var st = store();
      var keys = Object.keys(st);
      for (var k = 0; k < keys.length; k++) {
        var arr = st[keys[k]] || [];
        for (var i = 0; i < arr.length; i++) {
          var c = arr[i];
          if (c && c.byCurrentUser && c.user && c.user.isAdmin) return true;
        }
      }
    } catch (e) {}
    return false;
  }
  function nickColor(n) {
    var h = 0;
    for (var i = 0; i < n.length; i++) h = (Math.imul(h, 31) + n.charCodeAt(i)) | 0;
    return "hsl(" + (h % 360 + 360) % 360 + ",55%,72%)";
  }
  function fmtTime(t) {
    try { var d = new Date(t); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
    catch (e) { return ""; }
  }
  function ownUid() {
    try {
      var st = store();
      var keys = Object.keys(st);
      for (var k = 0; k < keys.length; k++) {
        var arr = st[keys[k]] || [];
        for (var i = arr.length - 1; i >= 0; i--) {
          var c = arr[i];
          if (c && c.byCurrentUser && c.user && c.user.id) return String(c.user.id);
        }
      }
    } catch (e) {}
    try {
      var s = localStorage.getItem("commentsPlugin.privateSelfId");
      if (s) return String(s).slice(0, 64);
    } catch (e2) {}
    return "";
  }
  function rpc(method, body) {
    return new Promise(function (res) {
      try {
        if (typeof window.dragonSharedSocket !== "function") { res(null); return; }
        window.dragonSharedSocket().then(function (s) {
          var out = null;
          try { out = s.rpc[method](JSON.stringify(body)); }
          catch (e) { res(null); return; }
          if (out && typeof out.then === "function") {
            out.then(function (raw) {
              try { res(JSON.parse(String(raw))); } catch (e2) { res(null); }
            }, function () { res(null); });
          } else {
            try { res(JSON.parse(String(out))); } catch (e3) { res(null); }
          }
        }, function () { res(null); });
      } catch (e4) { res(null); }
    });
  }

  function ensureCss() {
    if (document.getElementById("dragonChatFeedCss")) return;
    var st = document.createElement("style");
    st.id = "dragonChatFeedCss";
    st.textContent =
      "#dragonChatFeed{position:absolute;inset:0;z-index:9;display:flex;flex-direction:column;min-height:0;background:#0b141a;color:#e9edef;}" +
      "#dragonChatFeed .dcf-range{flex:0 0 auto;display:inline-flex;align-items:center;gap:.3rem;border:1px solid #9b6bff;background:linear-gradient(180deg,#2a1a4a,#1a102e);color:#fff;border-radius:999px;padding:.22rem .65rem;font-size:.7rem;font-weight:800;cursor:pointer;white-space:nowrap;}" +
      "#dragonChatFeed .dcf-range:hover{border-color:#fff;}" +
      "#dragonChatFeed .dcf-rooms{flex:0 0 auto;display:flex;gap:.3rem;overflow-x:auto;padding:.4rem .6rem;background:#14141b;border-bottom:1px solid #33333f;scrollbar-width:thin;}" +
      "#dragonChatFeed .dcf-room{flex:0 0 auto;border:1px solid #4a4a58;background:#23232c;color:#cfc4ea;border-radius:999px;padding:.22rem .65rem;font-size:.7rem;font-weight:700;cursor:pointer;white-space:nowrap;}" +
      "#dragonChatFeed .dcf-room:hover{border-color:#9b6bff;color:#fff;}" +
      "#dragonChatFeed .dcf-room.on{background:linear-gradient(180deg,#2a1a4a,#1a102e);border-color:#9b6bff;color:#fff;}" +
      "#dragonChatFeed .dcf-room.add{border-style:dashed;}" +
      "#dragonChatFeed .dcf-list{flex:1 1 auto;min-height:0;overflow-y:auto;padding:.5rem .6rem;}" +
      "#dragonChatFeed .dcf-row{display:flex;align-items:flex-start;gap:.5rem;margin:6px 10px;background:#202c33;border-radius:12px;padding:8px 10px;font-size:14px;line-height:1.45;text-align:left;}" +
      "#dragonChatFeed .dcf-row.dcf-mine{background:#2a1a4a;}" +
      "#dragonChatFeed .dcf-av{flex:0 0 auto;width:34px;height:34px;border-radius:50%;object-fit:cover;background:#31455c;}" +
      "#dragonChatFeed .dcf-avfb{flex:0 0 auto;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.95rem;color:#fff;background:#31455c;}" +
      "#dragonChatFeed .dcf-main{flex:1 1 auto;min-width:0;text-align:left;}" +
      "#dragonChatFeed .dcf-top{display:flex;align-items:baseline;gap:.35rem;min-width:0;text-align:left;}" +
      "#dragonChatFeed .dcf-nick{font-weight:800;font-size:.74rem;flex:0 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
      "#dragonChatFeed .dcf-time{font-size:.62rem;color:#8d8da0;font-weight:400;flex:0 0 auto;}" +
      "#dragonChatFeed .dcf-sp{flex:1 1 auto;min-width:.4rem;}" +
      "#dragonChatFeed .dcf-badgeRow{display:inline-block;margin:0 0 .15rem 0;padding:.05rem .4rem;border:1px solid rgba(255,215,106,.55);border-radius:6px;background:rgba(255,215,106,.08);font-size:.66rem;font-weight:800;color:#ffd76a;letter-spacing:.02em;text-align:left;}" +
      "#dragonChatFeed .dcf-q{margin-top:.3rem;background:#33363f;border-radius:8px;padding:.35rem .55rem;color:#c9cdd6;font-size:.74rem;white-space:pre-wrap;word-break:break-word;}" +
      "#dragonChatFeed .dcf-txt{white-space:pre-wrap;word-break:break-word;margin-top:.1rem;}" +
      "#dragonChatFeed .dcf-acts{display:flex;align-items:center;gap:.2rem;margin:0;flex:0 0 auto;}" +
      "#dragonChatFeed .dcf-ab{min-width:24px;height:24px;border-radius:6px;border:1px solid #4a4a58;background:#23232c;color:#e9edef;font-size:.72rem;line-height:1;padding:0 .28rem;cursor:pointer;}" +
      "#dragonChatFeed .dcf-ab:hover{border-color:#9b6bff;}" +
      "#dragonChatFeed .dcf-foot{flex:0 0 auto;display:flex;gap:.35rem;padding:.55rem .7rem;background:#191922;border-top:1px solid #33333f;align-items:flex-end;}" +
      "#dragonChatFeed .dcf-tool{flex:0 0 auto;width:34px;height:34px;border-radius:9px;border:1px solid #5b4a7d;background:linear-gradient(180deg,#2c2340,#1a1428);font-size:1rem;line-height:1;cursor:pointer;}" +
      "#dragonChatFeed .dcf-tool:hover{border-color:#9b6bff;}" +
      "#dragonChatFeed .dcf-in{flex:1 1 auto;min-width:0;background:#0e0e13;color:#eee;border:1px solid #5a5a6a;border-radius:8px;padding:.45rem .55rem;font-size:.82rem;font-family:inherit;resize:none;}" +
      "#dragonChatFeed .dcf-send{flex:0 0 auto;font-weight:800;font-size:.82rem;padding:.45rem .85rem;border-radius:9px;border:1px solid #9b6bff;background:linear-gradient(180deg,#2a1a4a,#1a102e);color:#d8c9ff;cursor:pointer;}" +
      "#dragonChatFeed .dcf-send[disabled]{opacity:.5;cursor:default;}" +
      "#dragonChatFeedBack{position:absolute;top:8px;right:8px;z-index:12;font-weight:800;font-size:.78rem;padding:.4rem .8rem;border-radius:9px;border:1px solid #9b6bff;background:linear-gradient(180deg,#2a1a4a,#1a102e);color:#fff;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.5);}" +
      ".dcf-pop{position:fixed;z-index:2147483360;background:linear-gradient(180deg,#23232e,#14141a);border:1px solid #5b4a7d;border-radius:12px;box-shadow:0 12px 34px rgba(0,0,0,.65);padding:.45rem;}" +
      ".dcf-pop .dcf-emrow{display:flex;gap:.15rem;}" +
      ".dcf-pop .dcf-em{display:flex;flex-direction:column;align-items:center;gap:.1rem;min-width:44px;border:1px solid transparent;background:transparent;border-radius:9px;padding:.3rem .15rem;cursor:pointer;color:#fff;font-size:1.15rem;}" +
      ".dcf-pop .dcf-em:hover{border-color:#9b6bff;background:rgba(155,107,255,.14);}" +
      ".dcf-pop .dcf-em.mine{border-color:#9b6bff;background:rgba(155,107,255,.2);}" +
      ".dcf-pop .dcf-em .n{font-size:.64rem;font-weight:800;color:#cfc4ea;}" +
      ".dcf-pop .dcf-mi{display:block;width:100%;text-align:left;border:none;background:transparent;color:#e9e6f2;font-size:.78rem;font-weight:600;padding:.4rem .55rem;border-radius:8px;cursor:pointer;white-space:nowrap;}" +
      ".dcf-pop .dcf-mi:hover{background:rgba(155,107,255,.18);}" +
      ".dcf-pop .dcf-mi.is-on{color:#ffd76a;}";
    try { document.head.appendChild(st); } catch (e) {}
  }

  function closePops() {
    try {
      var ps = document.querySelectorAll(".dcf-pop");
      for (var i = 0; i < ps.length; i++) ps[i].remove();
    } catch (e) {}
  }
  function openPop(anchor, build) {
    closePops();
    var pop = document.createElement("div");
    pop.className = "dcf-pop";
    build(pop);
    document.body.appendChild(pop);
    var r = null;
    try { r = anchor.getBoundingClientRect(); } catch (e) { r = { left: 8, top: window.innerHeight - 200, width: 26, height: 26, bottom: window.innerHeight - 170 }; }
    var pw = pop.offsetWidth || 280, ph = pop.offsetHeight || 120;
    var left = Math.min(Math.max(r.left, 8), Math.max(8, window.innerWidth - pw - 8));
    var top = (r.top || 0) - ph - 6;
    if (top < 8) top = Math.min((r.bottom || 0) + 6, Math.max(8, window.innerHeight - ph - 8));
    pop.style.left = Math.round(left) + "px";
    pop.style.top = Math.round(top) + "px";
    setTimeout(function () {
      var shut = function (ev) {
        if (pop.contains(ev.target)) return;
        pop.remove();
        document.removeEventListener("pointerdown", shut, true);
      };
      document.addEventListener("pointerdown", shut, true);
    }, 0);
    return pop;
  }

  function listTabs() {
    var out = [];
    try {
      var w = winEl();
      if (!w) return out;
      var tabs = w.querySelectorAll(".tabbed-comments-plugin-channel-tab");
      for (var i = 0; i < tabs.length; i++) {
        var t = tabs[i];
        var label = "";
        try {
          var cl = t.cloneNode(true);
          var xs = cl.querySelectorAll(".dragon-chat-tabx, .tabbed-comments-plugin-unseen-count");
          for (var x = 0; x < xs.length; x++) xs[x].remove();
          label = String(cl.textContent || "").trim().replace(/\s+/g, " ").replace(/\?$/, "").slice(0, 20);
        } catch (e) { label = ""; }
        out.push({ el: t, ch: t.dataset.channel || "", label: label || (t.dataset.channel || "general"), active: t.classList.contains("tabbed-comments-plugin-active-tab") });
      }
    } catch (e) {}
    return out;
  }
  function rangeState() {
    var id = "all";
    try {
      if (typeof window.dragonChatRangeState === "function") id = window.dragonChatRangeState().id || "all";
    } catch (e) {}
    for (var i = 0; i < RANGE_OPTS.length; i++) if (RANGE_OPTS[i].id === id) return RANGE_OPTS[i];
    return RANGE_OPTS[4];
  }

  function build() {
    if (feedEl && feedEl.isConnected) return feedEl;
    ensureCss();
    var body = bodyEl();
    if (!body) return null;
    var el = document.createElement("div");
    el.id = FEED_ID;
    el.hidden = true;
    roomsEl = document.createElement("div");
    roomsEl.className = "dcf-rooms";
    // Egon 17.10.2026 — no title row: the range button ("All messages" etc.) lives first in the rooms row.
    rangeBtnEl = document.createElement("button");
    rangeBtnEl.type = "button";
    rangeBtnEl.className = "dcf-range";
    rangeBtnEl.onclick = function (ev) { try { ev.stopPropagation(); } catch (e) {} openRangeMenu(rangeBtnEl); };
    roomsEl.appendChild(rangeBtnEl);
    listEl = document.createElement("div");
    listEl.className = "dcf-list";
    footEl = document.createElement("div");
    footEl.className = "dcf-foot";
    var emojiBtn = document.createElement("button");
    emojiBtn.type = "button";
    emojiBtn.className = "dcf-tool";
    emojiBtn.textContent = "\uD83D\uDE0A";
    emojiBtn.title = "Add emoji";
    emojiBtn.onclick = function (ev) { try { ev.stopPropagation(); } catch (e) {} openEmojiPicker(emojiBtn); };
    inpEl = document.createElement("textarea");
    inpEl.className = "dcf-in";
    inpEl.rows = 2;
    inpEl.maxLength = 2000;
    inpEl.placeholder = "Write a message\u2026 (Enter sends)";
    var hiBtn = document.createElement("button");
    hiBtn.type = "button";
    hiBtn.className = "dcf-tool";
    hiBtn.textContent = "\uD83D\uDC4B";
    hiBtn.title = "Say hi \u2014 post a random friendly greeting";
    hiBtn.onclick = function (ev) { try { ev.stopPropagation(); } catch (e) {} feedSayHi(); };
    var imgBtn = document.createElement("button");
    imgBtn.type = "button";
    imgBtn.className = "dcf-tool";
    imgBtn.textContent = "\uD83D\uDDBC\uFE0F";
    imgBtn.title = "Add an image from the public or private gallery";
    imgBtn.onclick = function (ev) { try { ev.stopPropagation(); } catch (e) {} openRealImagePicker(imgBtn); };
    sendBtnEl = document.createElement("button");
    sendBtnEl.className = "dcf-send";
    sendBtnEl.textContent = "Send";
    sendBtnEl.disabled = true;
    sendBtnEl.title = "Connecting\u2026";
    sendBtnEl.onclick = doSend;
    inpEl.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); } });
    // Egon 17.10.2026 — Say hi first (left of emoji), Send stays last.
    footEl.appendChild(hiBtn);
    footEl.appendChild(emojiBtn);
    footEl.appendChild(inpEl);
    footEl.appendChild(imgBtn);
    footEl.appendChild(sendBtnEl);
    el.appendChild(roomsEl);
    el.appendChild(listEl);
    el.appendChild(footEl);
    el._inp = inpEl; el._send = sendBtnEl;
    body.appendChild(el);
    feedEl = el;
    try {
      body.addEventListener("click", function (ev) {
        if (ev.target && ev.target.closest && ev.target.closest(".tabbed-comments-plugin-channel-tab")) {
          setTimeout(function () { if (feedEl && !feedEl.hidden) render(true); }, 600);
        }
      });
    } catch (e) {}
    return feedEl;
  }

  // Egon 17.10.2026 — settings mode: the native popup lives INSIDE the cross-origin
  // iframe, so it can never paint above our feed (one iframe = one layer). When the gear is
  // clicked the window blurs with the mouse over the gear hole — then the feed steps aside and
  // shows a return button.
  var settingsMode = false, backBtnEl = null, lastMouse = { x: -1, y: -1 };
  try {
    window.addEventListener("mousemove", function (ev) {
      try { lastMouse.x = ev.clientX; lastMouse.y = ev.clientY; } catch (e) {}
    }, { passive: true, capture: true });
  } catch (e0) {}
  function gearViewportRect() {
    try {
      var w = winEl(), body = bodyEl();
      if (!w || !body) return null;
      var ifr = w.querySelector(".tabbed-comments-plugin-content iframe") || w.querySelector("iframe");
      if (!ifr) return null;
      var iR = ifr.getBoundingClientRect(), bR = body.getBoundingClientRect();
      if (!iR.width) return null;
      var margin = Math.max(196, iR.width - 84);
      return { l: iR.left + margin - 12, r: iR.left + margin - 12 + 58 + 12 + 36, t: bR.bottom - 66, b: bR.bottom };
    } catch (e) { return null; }
  }
  // The native settings gear lives inside the cross-origin iframe, so it cannot move.
  // The plugin centres an 800px column, so the gear sits at that column's right end — measured
  // live from the iframe box with the same formula the username hint uses
  // (gear left = iframe left + max(196, iframe width - 84)).
  function gearGeom() {
    try {
      var w = winEl(), body = bodyEl();
      if (!w || !body) return null;
      var ifr = w.querySelector(".tabbed-comments-plugin-content iframe") || w.querySelector("iframe");
      if (!ifr) return null;
      var bR = body.getBoundingClientRect(), iR = ifr.getBoundingClientRect();
      if (!iR.width) return null;
      var margin = Math.max(196, iR.width - 84);
      var gL = (iR.left - bR.left) + margin;
      return { l: gL - 12, w: 58 + 12 + 36, h: 66 };
    } catch (e) { return null; }
  }
  function applyClip() {
    if (!feedEl) return;
    try {
      var body = bodyEl();
      var W = (body && body.clientWidth) || 400;
      var H = (body && body.clientHeight) || 400;
      // Old chat is full-body under the feed: only the gear hole stays open.
      var holeL, holeW, holeH;
      var g = gearGeom();
      holeH = 66;
      if (g && g.l > 40) { holeL = Math.round(g.l); holeW = Math.round(g.w); }
      else { holeW = W < 470 ? 112 : 154; holeL = W - holeW; }
      if (holeL < 0) holeL = 0;
      if (holeL > W - 60) holeL = W - 60;
      if (holeL + holeW > W) holeW = Math.max(60, W - holeL);
      var holeR = holeL + holeW;
      // Simple polygon around the gear rect: down the right edge, left along the bottom,
      // up around the hole, and back — everything stays except the gear rect.
      feedEl.style.clipPath = "polygon(0px 0px, " + W + "px 0px, " + W + "px " + H + "px, " +
        holeR + "px " + H + "px, " + holeR + "px " + (H - holeH) + "px, " +
        holeL + "px " + (H - holeH) + "px, " + holeL + "px " + H + "px, 0px " + H + "px)";
      // The footer only yields when the hole touches the right edge (narrow screens):
      // otherwise Send sits right of the hole on opaque feed and stays clickable.
      if (footEl) footEl.style.marginRight = (holeL + holeW >= W - 8) ? Math.max(0, W - holeL) + "px" : "0px";
    } catch (e) {}
  }

  function pluginRoot() {
    try {
      var body = bodyEl();
      if (!body) return null;
      return body.querySelector(".tabbed-comments-plugin-outer-ctn") ||
        body.querySelector(".tabbed-comments") || null;
    } catch (e) { return null; }
  }
  function toolsOverlay() {
    try { var w = winEl(); return w ? w.querySelector(".dragon-chat-tools") : null; } catch (e) { return null; }
  }
  function isOpen() { return !!(feedEl && feedEl.isConnected && !feedEl.hidden); }

  function parentTextOf(id) {
    try {
      var st = store();
      var keys = Object.keys(st);
      for (var k = 0; k < keys.length; k++) {
        var arr = st[keys[k]] || [];
        for (var i = 0; i < arr.length; i++) {
          if (arr[i] && String(arr[i].id) === String(id)) return arr[i];
        }
      }
    } catch (e) {}
    return null;
  }
  function shortBody(t) {
    t = String(t || "");
    if (/^https?:\S+\.(jpe?g|png|webp|gif)(\?\S*)?$/i.test(t.trim())) return "\uD83D\uDDBC\uFE0F image";
    return t.length > 120 ? t.slice(0, 120) + "\u2026" : t;
  }

  // YouTube IDs buried in a message (watch?v= / shorts / live / embed / youtu.be).
  // Max 2 per message so a link dump never turns into a wall of players.
  function ytIdsOf(t) {
    var out = [], seen = {}, m;
    var re = /(?:youtube\.com\/(?:watch\?[^ ]*v=|shorts\/|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/gi;
    while ((m = re.exec(String(t || ""))) && out.length < 2) { if (!seen[m[1]]) { seen[m[1]] = 1; out.push(m[1]); } }
    return out;
  }
  // Plain-text message becomes text nodes + safe links (no innerHTML: the
  // message is untrusted, so hrefs are rebuilt through URL; non-http(s) dies).
  function linkifyText(box, text) {
    var re = /(https?:\/\/[^\s<>"')\]]+)/gi, last = 0, m, has = false;
    var frag = document.createDocumentFragment();
    while ((m = re.exec(text))) {
      has = true;
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      var href = String(m[1]).replace(/[.,;:!?)\]]+$/, "");
      var ok = false, full = href;
      try {
        var u = new URL(href);
        if (u.protocol === "http:" || u.protocol === "https:") { full = u.href; ok = true; }
      } catch (e) {}
      if (ok) {
        var a = document.createElement("a");
        a.href = full; a.target = "_blank"; a.rel = "noopener noreferrer nofollow";
        a.style.cssText = "color:#7cc4ff;word-break:break-all;";
        a.textContent = href.length > 80 ? href.slice(0, 80) + "…" : href;
        frag.appendChild(a);
      } else frag.appendChild(document.createTextNode(m[1]));
      last = m.index + m[1].length;
    }
    if (!has) { box.textContent = text; return; }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    box.appendChild(frag);
  }
  // Click-to-play YouTube embed under the message (thumbnail first, so twenty
  // links don't load twenty players; nocookie domain until the press play).
  function appendYouTubeEmbeds(main, text) {
    var ids = ytIdsOf(text);
    if (!ids.length) return;
    ids.forEach(function (id) {
      var wrap = document.createElement("div");
      wrap.className = "dcf-yt";
      wrap.style.cssText = "margin:.4rem 0 0;max-width:360px;";
      var ph = document.createElement("button");
      ph.type = "button";
      ph.title = "Play YouTube video";
      ph.style.cssText = "position:relative;display:block;width:100%;padding:0;border:0;border-radius:10px;overflow:hidden;cursor:pointer;background:#000;";
      var ar = document.createElement("span");
      ar.style.cssText = "display:block;width:100%;padding-top:56.25%;";
      ph.appendChild(ar);
      var im = document.createElement("img");
      im.src = "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg";
      im.alt = "YouTube video — press to play";
      im.loading = "lazy";
      im.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;";
      im.onerror = function () { try { im.remove(); } catch (e) {} };
      ph.appendChild(im);
      var pl = document.createElement("span");
      pl.textContent = "▶";
      pl.style.cssText = "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:52px;height:52px;border-radius:50%;background:rgba(0,0,0,.65);color:#fff;font-size:22px;display:flex;align-items:center;justify-content:center;pointer-events:none;";
      ph.appendChild(pl);
      ph.onclick = function () {
        var box = document.createElement("div");
        box.style.cssText = "position:relative;width:100%;padding-top:56.25%;border-radius:10px;overflow:hidden;background:#000;";
        var f = document.createElement("iframe");
        f.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0";
        f.title = "YouTube video";
        f.allow = "accelerometer; autoplay; encrypted-media; picture-in-picture";
        f.allowFullscreen = true;
        f.loading = "lazy";
        f.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0;";
        box.appendChild(f);
        try { wrap.innerHTML = ""; wrap.appendChild(box); } catch (e) {}
      };
      wrap.appendChild(ph);
      main.appendChild(wrap);
    });
  }
  function reactSummary(id) {
    var m = metaCache[String(id)];
    if (!m || !m.c) return { emoji: "\uD83D\uDE0A", total: 0 };
    var best = -1, tot = 0;
    for (var i = 0; i < 6; i++) {
      tot += m.c[i] | 0;
      if ((m.c[i] | 0) > 0 && (best < 0 || (m.c[best] | 0) < (m.c[i] | 0))) best = i;
    }
    return { emoji: best < 0 ? "\uD83D\uDE0A" : REACTS[best], total: tot };
  }

  function render(forceScroll) {
    var el = build();
    if (!el || el.hidden || !listEl) return;
    var msgs = feedMsgs();
    var sig = msgs.length + ":" + (msgs.length ? String(msgs[msgs.length - 1].id || "") : "") + ":" + lastMetaSig;
    if (sig === lastSig && !forceScroll) return;
    lastSig = sig;
    try {
      var rs = rangeState();
      rangeBtnEl.innerHTML = "";
      var ri = document.createElement("span");
      ri.textContent = rs.icon;
      var rl = document.createElement("span");
      rl.textContent = rs.label;
      rangeBtnEl.appendChild(ri);
      rangeBtnEl.appendChild(rl);
      rangeBtnEl.title = "Message range: " + rs.label;
    } catch (e) {}
    // rooms row mirrors the plugin tabs (they stay in the DOM and stay clickable)
    try {
      roomsEl.innerHTML = "";
      if (rangeBtnEl) roomsEl.appendChild(rangeBtnEl);
      var tabs = listTabs();
      tabs.forEach(function (t) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "dcf-room" + (t.active ? " on" : "");
        b.textContent = t.label;
        b.title = t.label;
        b.onclick = (function (real) {
          return function (ev) {
            try { ev.stopPropagation(); } catch (e) {}
            try { real.click(); } catch (e2) {}
            setTimeout(function () { if (isOpen()) render(true); }, 600);
          };
        })(t.el);
        roomsEl.appendChild(b);
      });
      var w = winEl();
      var realAdd = w ? w.querySelector(".tabbed-comments-plugin-add-custom-channel") : null;
      if (realAdd) {
        var ab = document.createElement("button");
        ab.type = "button";
        ab.className = "dcf-room add";
        ab.textContent = "+";
        ab.title = "Add a room";
        ab.onclick = function (ev) { try { ev.stopPropagation(); } catch (e) {} try { realAdd.click(); } catch (e2) {} };
        roomsEl.appendChild(ab);
      }
    } catch (e2) {}
    var nearBottom = false;
    try { nearBottom = (listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight) < 120; } catch (e3) { nearBottom = true; }
    listEl.innerHTML = "";
    if (!msgs.length) {
      var d = document.createElement("div");
      d.style.cssText = "color:#8d8da0;font-size:.8rem;text-align:center;padding:1.6rem .4rem;";
      d.textContent = "No messages here yet \u2014 they appear as the chat loads.";
      listEl.appendChild(d);
      return;
    }
    var canPm = (typeof window.dragonPmPeer === "function");
    var uid = ownUid();
    msgs.forEach(function (c) {
      var text = String((c && c.message) || "");
      if (!text || /^ENCRYPTED_/.test(text)) return; // never render ciphertext bodies
      var mine = !!c.byCurrentUser;
      var who = dispName(c);
      var row = document.createElement("div");
      row.className = "dcf-row" + (mine ? " dcf-mine" : "");
      row.dataset.mid = String(c.id || "");
      var av = avatarUrl(c);
      if (av) {
        var im = document.createElement("img");
        im.className = "dcf-av";
        im.alt = "";
        im.loading = "lazy";
        im.src = av;
        im.onerror = function () {
          try {
            var fb = document.createElement("span");
            fb.className = "dcf-avfb";
            fb.textContent = (who || "?").slice(0, 1).toUpperCase();
            im.replaceWith(fb);
          } catch (e) {}
        };
        row.appendChild(im);
      } else {
        var fb0 = document.createElement("span");
        fb0.className = "dcf-avfb";
        fb0.textContent = (who || "?").slice(0, 1).toUpperCase();
        try { fb0.style.background = nickColor(who); } catch (e) {}
        row.appendChild(fb0);
      }
      var main = document.createElement("div");
      main.className = "dcf-main";
      var top = document.createElement("div");
      top.className = "dcf-top";
      var nm = document.createElement("span");
      nm.className = "dcf-nick";
      nm.textContent = who;
      try { nm.style.color = nickColor(who); } catch (e) {}
      top.appendChild(nm);
      var sp = document.createElement("span");
      sp.className = "dcf-sp";
      top.appendChild(sp);
      // Egon 17.10.2026 — timestamp sits just left of the reply button.
      var tm = document.createElement("span");
      tm.className = "dcf-time";
      tm.textContent = fmtTime(c.time);
      top.appendChild(tm);
      // Egon 17.10.2026 \u2014 actions live top-right of the row now.
      var acts = document.createElement("div");
      acts.className = "dcf-acts";
      top.appendChild(acts);
      // Egon 17.10.2026 — OWNER badge sits right above the nick.
      if (isAdminMsg(c)) {
        var bd = document.createElement("div");
        bd.className = "dcf-badgeRow";
        bd.textContent = "\uD83D\uDC51 OWNER \uD83D\uDC51";
        bd.title = "Admin";
        main.appendChild(bd);
      }
      main.appendChild(top);
      var bodyText = text;
      if (c.replyingToData || c.replyingTo) {
        var rd = c.replyingToData || {};
        var pm = null, pw = null;
        try {
          var pid = rd.messageId || c.replyingTo;
          if (pid) pm = parentTextOf(pid);
        } catch (e2) {}
        if (pm) { pw = dispName(pm); }
        else if (rd.userNickname) pw = String(rd.userNickname).slice(0, 24);
        var q = document.createElement("div");
        q.className = "dcf-q";
        q.textContent = "\u21A9 " + (pw || "message") + ": " + shortBody(pm ? pm.message : rd.message);
        main.appendChild(q);
      } else {
        // Quote-as-text replies (our composer writes \"> @name: snip\" on top): lift that
        // first line into the grey quote box so it reads as the replied-to message.
        var qm = /^> @([^:\n]{1,24}): ([^\n]{0,140})(?:\n([\s\S]*))?$/.exec(text);
        if (qm) {
          var q2 = document.createElement("div");
          q2.className = "dcf-q";
          q2.textContent = "\u21A9 " + qm[1] + ": " + qm[2];
          main.appendChild(q2);
          bodyText = String(qm[3] || "").replace(/^\n+/, "");
        }
      }
      if (bodyText) {
        var tx = document.createElement("div");
        tx.className = "dcf-txt";
        linkifyText(tx, bodyText.slice(0, 2000));
        main.appendChild(tx);
        try { appendYouTubeEmbeds(main, bodyText); } catch (eYT) {}
      }
      // reply (quote-style: fills our composer)
      (function (msg, name) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "dcf-ab";
        b.textContent = "\u21A9";
        b.title = "Reply to " + name;
        b.onclick = function (ev) {
          try { ev.stopPropagation(); } catch (e) {}
          startReply(msg, name);
        };
        acts.appendChild(b);
      })(c, who);
      // reactions (left of PM, dropdown with counts)
      (function (msg) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "dcf-ab";
        var s = reactSummary(msg.id);
        b.textContent = s.total > 0 ? (s.emoji + " " + s.total) : "\uD83D\uDE0A";
        b.title = "React";
        b.onclick = function (ev) {
          try { ev.stopPropagation(); } catch (e) {}
          openReactMenu(b, msg);
        };
        acts.appendChild(b);
      })(c);
      if (canPm && !mine) {
        (function (msg) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "dcf-ab";
          b.textContent = "\uD83D\uDC8C";
          b.title = "Send " + dispName(msg) + " a private message";
          b.onclick = function (ev) {
            try { ev.stopPropagation(); } catch (e) {}
            var u = (msg.user || {});
            window.dragonPmPeer(String(u.id || ""), dispName(msg));
          };
          acts.appendChild(b);
        })(c);
      }
      var adminView = viewerIsAdmin();
      if (mine || adminView) {
        (function (msg, forAll) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "dcf-ab";
          b.textContent = "\uD83D\uDDD1";
          b.title = forAll ? "Delete this message for everyone" : "Delete this message from the feed";
          b.onclick = function (ev) {
            try { ev.stopPropagation(); } catch (e) {}
            deleteMsg(msg);
          };
          acts.appendChild(b);
        })(c, adminView && !mine);
      } else {
        (function (msg) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "dcf-ab";
          b.textContent = "\uD83D\uDEA9";
          b.title = "Report this message";
          b.onclick = function (ev) {
            try { ev.stopPropagation(); } catch (e) {}
            openReportMenu(b, msg);
          };
          acts.appendChild(b);
        })(c);
      }
      row.appendChild(main);
      listEl.appendChild(row);
    });
    if (forceScroll || nearBottom) { try { listEl.scrollTop = listEl.scrollHeight; } catch (e) {} }
  }

  function startReply(msg, name) {
    var el = build();
    if (!el || !inpEl) return;
    var snip = shortBody(msg.message).replace(/\n/g, " ").slice(0, 90);
    var quote = "> @" + name + ": " + snip + "\n";
    try {
      if (inpEl.value.indexOf(quote) !== 0) inpEl.value = quote + inpEl.value;
      inpEl.focus();
    } catch (e) {}
  }

  function openReactMenu(anchor, msg) {
    var id = String(msg.id || "");
    var m = metaCache[id] || { c: [0, 0, 0, 0, 0, 0], mine: 0 };
    openPop(anchor, function (pop) {
      var row = document.createElement("div");
      row.className = "dcf-emrow";
      for (var i = 0; i < REACTS.length; i++) {
        (function (idx) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "dcf-em" + (m.mine === idx + 1 ? " mine" : "");
          var e = document.createElement("span");
          e.textContent = REACTS[idx];
          var n = document.createElement("span");
          n.className = "n";
          n.textContent = String((m.c && m.c[idx]) | 0);
          b.appendChild(e);
          b.appendChild(n);
          b.title = REACTS[idx];
          b.onclick = function () { vote(id, idx + 1); pop.remove(); };
          row.appendChild(b);
        })(i);
      }
      pop.appendChild(row);
    });
  }

  function vote(id, emoji) {
    id = String(id || "");
    var now = Date.now();
    if (reactBusy[id] && now - reactBusy[id] < 800) return; // double-click would untoggle
    reactBusy[id] = now;
    rpc("dragonChatReact", { m: id, e: emoji, u: ownUid() }).then(function (r) {
      if (!r || !r.ok) { toast(r && r.err === "rate" ? "\u23F3 too fast \u2014 try again" : "\u26A0\uFE0F reaction failed"); return; }
      metaCache[id] = { c: r.c, mine: r.mine | 0, tomb: tombOf(id) ? 1 : 0 };
      lastMetaSig = String(Date.now());
      render(false);
      setTimeout(function () { syncMeta(false); }, 1200);
    });
  }

  function deleteMsg(msg) {
    var id = String(msg.id || "");
    if (!id) return;
    try {
      if (!window.confirm("Delete this message from the feed?")) return;
    } catch (e) {}
    rpc("dragonChatTomb", { m: id }).then(function (r) {
      if (!r || !r.ok) { toast("\u26A0\uFE0F delete failed"); return; }
      metaCache[id] = metaCache[id] || { c: [0, 0, 0, 0, 0, 0], mine: 0 };
      metaCache[id].tomb = 1;
      lastMetaSig = String(Date.now());
      toast("\uD83D\uDDD1 deleted from the feed");
      render(false);
    });
  }

  function openReportMenu(anchor, msg) {
    var id = String(msg.id || "");
    openPop(anchor, function (pop) {
      REPORT_REASONS.forEach(function (rr) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "dcf-mi";
        b.textContent = "\uD83D\uDEA9 " + rr.label;
        b.onclick = function () {
          pop.remove();
          rpc("dragonChatReport", {
            m: id, r: rr.id, n: "",
            x: String(msg.message || "").slice(0, 200),
            c: String(msg.channel || activeChannel() || "").slice(0, 24)
          }).then(function (r) {
            toast(!r || !r.ok ? "\u26A0\uFE0F report failed" : (r.dup ? "Already reported \u2014 thanks" : "\uD83D\uDEA9 reported \u2014 thanks"));
          });
        };
        pop.appendChild(b);
      });
    });
  }

  function syncMeta(force) {
    if (!isOpen()) return;
    var msgs = feedMsgs().slice(-40);
    if (!msgs.length) return;
    var ids = msgs.map(function (c) { return String(c.id); });
    rpc("dragonChatMeta", { ids: ids, u: ownUid() }).then(function (r) {
      if (!r || !r.ok || !r.meta) return;
      var changed = !!force;
      var keys = Object.keys(r.meta);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var prev = JSON.stringify(metaCache[k] || null);
        metaCache[k] = r.meta[k];
        if (JSON.stringify(metaCache[k]) !== prev) changed = true;
      }
      if (changed) {
        lastMetaSig = String(Date.now());
        render(false);
      }
    });
  }

  function openRangeMenu(anchor) {
    openPop(anchor, function (pop) {
      var cur = rangeState().id;
      RANGE_OPTS.forEach(function (o) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "dcf-mi" + (o.id === cur ? " is-on" : "");
        b.textContent = o.icon + " " + o.label;
        b.onclick = function () {
          pop.remove();
          try { if (typeof window.dragonChatRangeSelect === "function") window.dragonChatRangeSelect(o.id); } catch (e) {}
          setTimeout(function () { if (isOpen()) render(true); }, 400);
        };
        pop.appendChild(b);
      });
    });
  }

  var EMOJIS = "\uD83D\uDE00 \uD83D\uDE03 \uD83D\uDE04 \uD83D\uDE01 \uD83D\uDE06 \uD83D\uDE05 \uD83D\uDE02 \uD83E\uDD23 \uD83D\uDE0A \uD83D\uDE07 \uD83D\uDE42 \uD83D\uDE43 \uD83D\uDE09 \uD83D\uDE0C \uD83D\uDE0D \uD83E\uDD70 \uD83D\uDE18 \uD83D\uDE17 \uD83D\uDE19 \uD83D\uDE1A \uD83D\uDE0B \uD83D\uDE1B \uD83D\uDE1C \uD83D\uDE1D \uD83E\uDD2A \uD83E\uDD28 \uD83D\uDE10 \uD83D\uDE11 \uD83D\uDE36 \uD83D\uDE44 \uD83D\uDE0F \uD83D\uDE12 \uD83D\uDE36 \uD83D\uDE14 \uD83D\uDE15 \uD83E\uDD2C \uD83D\uDE2C \uD83D\uDE0E \uD83E\uDD13 \uD83D\uDE25 \uD83D\uDE22 \uD83D\uDE2D \uD83D\uDE2A \uD83D\uDE35 \uD83D\uDE2B \uD83E\uDD14 \uD83D\uDE2F \uD83D\uDE28 \uD83D\uDE31 \uD83D\uDE30 \uD83D\uDE26 \uD83D\uDE27 \uD83D\uDE29 \uD83E\uDD2F \uD83D\uDE24 \uD83D\uDE20 \uD83D\uDE21 \uD83E\uDD2E \uD83D\uDE33 \uD83D\uDE32 \uD83E\uDD73 \uD83D\uDE08 \uD83D\uDE2E \uD83E\uDD2D \uD83D\uDE34 \uD83E\uDD24 \uD83D\uDE22 \uD83E\uDD7A \uD83D\uDC96 \uD83D\uDC95 \uD83D\uDC9E \uD83D\uDC9F \uD83D\uDC9C \uD83D\uDC94 \uD83D\uDC8B \uD83D\uDC8C \u2764\uFE0F \uD83E\uDDE1 \uD83D\uDC9B \uD83D\uDC99 \uD83D\uDC9A \uD83D\uDC9C \uD83D\uDDA4 \uD83E\uDD0D \uD83E\uDD0E \u2728 \uD83D\uDD25 \u2B50 \uD83C\uDF1F \uD83D\uDC4D \uD83D\uDC4E \uD83D\uDC4C \uD83D\uDC4F \uD83D\uDE4C \uD83E\uDD1D \uD83D\uDE4F \uD83D\uDCAA \uD83C\uDF89 \uD83C\uDF8A \uD83E\uDD73 \uD83C\uDF81 \uD83D\uDC51 \uD83C\uDF1E \uD83C\uDF08".split(" ");
  function insertIntoComposer(txt) {
    if (!inpEl) return;
    try {
      inpEl.focus();
      var s = inpEl.selectionStart | 0, e = inpEl.selectionEnd | 0;
      var v = inpEl.value || "";
      inpEl.value = v.slice(0, s) + txt + v.slice(e);
      var p = s + txt.length;
      inpEl.selectionStart = p;
      inpEl.selectionEnd = p;
    } catch (e2) {
      try { inpEl.value = (inpEl.value || "") + txt; } catch (e3) {}
    }
  }
  function openEmojiPicker(anchor) {
    openPop(anchor, function (pop) {
      pop.style.maxWidth = "320px";
      var wrap = document.createElement("div");
      wrap.style.cssText = "display:flex;flex-wrap:wrap;gap:.1rem;max-width:300px;max-height:220px;overflow-y:auto;";
      EMOJIS.forEach(function (em) {
        if (!em) return;
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = em;
        b.style.cssText = "border:none;background:transparent;font-size:1.25rem;cursor:pointer;padding:.15rem;border-radius:6px;";
        b.onmouseenter = function () { b.style.background = "rgba(155,107,255,.2)"; };
        b.onmouseleave = function () { b.style.background = "transparent"; };
        b.onclick = function () { insertIntoComposer(" " + em + " "); };
        wrap.appendChild(b);
      });
      pop.appendChild(wrap);
    });
  }

  function activeIframe() {
    try {
      var w = winEl();
      if (!w) return null;
      var content = w.querySelector(".tabbed-comments-plugin-content.tabbed-comments-plugin-active-content") ||
        w.querySelector(".tabbed-comments-plugin-content");
      var ifr = content ? content.querySelector("iframe") : null;
      if (!ifr || !ifr.contentWindow) return null;
      return { iframe: ifr, channel: (content.dataset && content.dataset.channel) || "" };
    } catch (e) { return null; }
  }
  function hiText() {
    try {
      var m = (window.root && window.root.dragonHiMessages) || null;
      if (m && m.selectOne) { var s = m.selectOne.evaluateItem; if (typeof s === "string" && s.trim()) return s.trim(); }
    } catch (e) {}
    return "\uD83D\uDC4B Hello there! Just popped in to say hi \uD83D\uDE0A";
  }
  function feedSayHi() {
    var a = activeIframe();
    if (!a) { toast("open the chat first"); return; }
    var text = hiText();
    var requestId = Math.random().toString() + Math.random().toString();
    var done = false;
    var handler = function (e) {
      if (e.origin !== "https://comments-plugin.perchance.org") return;
      if (e.data && e.data.type === "message_submit_response" && e.data.requestId === requestId) {
        window.removeEventListener("message", handler); done = true;
        toast(e.data.success ? "\uD83D\uDCAC " + text : "\u26A0\uFE0F couldn't send \u2014 try again");
      }
    };
    window.addEventListener("message", handler);
    try { a.iframe.contentWindow.postMessage({ type: "trigger_programmatic_submit", text: text, nickname: null, auth: null, channel: a.channel, requestId: requestId }, "https://comments-plugin.perchance.org"); }
    catch (err) { window.removeEventListener("message", handler); toast("\u26A0\uFE0F couldn't send"); return; }
    setTimeout(function () { if (!done) { window.removeEventListener("message", handler); toast("\u23F3 chat not ready yet"); } }, 8000);
  }

  // Egon 17.10.2026 — the REAL Add-image button: the same picker the plugin view uses
  // (public/private gallery + upload tabs), opened from our feed. No custom link popover.
  function openRealImagePicker(anchor) {
    try {
      if (typeof window.dragonChatImagePicker === "function") { window.dragonChatImagePicker(anchor); return; }
    } catch (e) {}
    toast("image picker not ready yet \u2014 try again in a moment");
  }
  // Egon 17.10.2026 — gear-only: the old chat always stays full-body under the feed
  // (only the gear hole stays open). Idempotent — safe to re-run.
  function layoutMode() {
    try { if (winEl()) winEl().classList.remove("dragon-feed-mini"); } catch (e) {}
    var root = pluginRoot();
    if (root) {
      root.style.display = "";
      root.style.position = "absolute"; root.style.inset = "0"; root.style.width = ""; root.style.height = "";
    }
    var tools = toolsOverlay();
    if (tools) tools.style.display = "none";
    return false;
  }
  function setOpen(open) {
    var el = build();
    if (!el) return false;
    if (open) {
      settingsMode = false;
      try { if (backBtnEl) backBtnEl.hidden = true; } catch (eS) {}
      // Egon 17.10.2026 — no view switching: the feed is always fullscreen and the old chat
      // always stays full-body under it (gear hole only) so the composer stays usable.
      layoutMode();
      el.hidden = false;
      applyClip();
      lastSig = "";
      render(true);
      syncBtn();
      try {
        ensureTransport(activeChannel(), function (ok) {
          try { if (feedEl && feedEl._send && !feedEl.hidden) { feedEl._send.disabled = !ok; feedEl._send.title = ok ? "Send" : "Connecting\u2026"; } } catch (e) {}
        });
      } catch (e) {}
      try { if (timer) clearInterval(timer); } catch (e2) {}
      timer = setInterval(function () { if (!isOpen()) { clearInterval(timer); timer = 0; return; } render(false); }, 4000);
      try { if (metaTimer) clearInterval(metaTimer); } catch (e3) {}
      setTimeout(function () { syncMeta(true); }, 1500);
      metaTimer = setInterval(function () { if (!isOpen()) return; syncMeta(false); }, 15000);
    } else {
      el.hidden = true;
      var tools2 = toolsOverlay();
      if (tools2) tools2.style.display = "";
      syncBtn();
      try { if (timer) clearInterval(timer); } catch (e4) {}
      timer = 0;
      try { if (metaTimer) clearInterval(metaTimer); } catch (e5) {}
      metaTimer = 0;
    }
    return true;
  }
  function syncBtn() {
    try {
      var b = document.getElementById(BTN_ID);
      if (b) { b.textContent = isOpen() ? "\uD83D\uDCAC" : "\uD83D\uDCC3"; b.title = isOpen() ? "Back to plugin chat view" : "Our chat feed \u2014 same messages, with PM buttons"; }
    } catch (e) {}
  }
  window.dragonChatFeedRefresh = function () { render(false); };

  // ---- sending: one hidden transport embed per channel (same pattern as PM threads) ----
  // Plain messages only — replies travel as quote text, so they post fine here. No optimistic
  // paint: the echo comes back through the normal onComment hook and renders exactly once.
  // nickname:null posts under the visitor's stored plugin name.
  var transBox = null, transCtl = null, transCh = null, transReady = false;
  function plugs() { try { return window.root || {}; } catch (e) { return {}; } }
  function ensureTransport(ch, cb) {
    if (transCtl && transCh === ch) { cb(transReady); return; }
    try { if (transBox && transBox.parentNode) transBox.parentNode.removeChild(transBox); } catch (e) {}
    transBox = null; transCtl = null; transReady = false; transCh = ch;
    var r = plugs();
    if (typeof r.commentsPlugin !== "function") { cb(false); return; }
    transBox = document.createElement("div");
    transBox.style.cssText = "height:2px;overflow:hidden;opacity:0.01;";
    document.body.appendChild(transBox);
    var done = false;
    var mk = function () {
      try {
        transCtl = r.commentsPlugin({
          channel: ch,
          replacedDuringUpdate: true,
          width: "100%",
          height: "120px",
          hideDates: true,
          commentPlaceholderText: "",
          onLoad: function () {
            if (done) return;
            done = true;
            clearTimeout(to); clearTimeout(shimTo);
            transReady = true;
            cb(true);
          }
        });
        transBox.innerHTML = transCtl;
      } catch (e) { clearTimeout(to); clearTimeout(shimTo); cb(false); }
    };
    var to = setTimeout(function () { if (!done) { done = true; cb(false); } }, 15000);
    // Some environments never fire IntersectionObserver (then the plugin's lazy iframe loader
    // never runs and onLoad never comes): retry once under a temporary eager shim.
    var shimTo = setTimeout(function () {
      if (done) return;
      var RealIO = null;
      try { RealIO = window.IntersectionObserver; } catch (e) {}
      if (!RealIO || RealIO.__dragonFeedShim) return;
      function ShimIO(cb2) {
        this.disconnect = function () {}; this.unobserve = function () {}; this.takeRecords = function () { return []; };
        this.observe = function (el) {
          setTimeout(function () {
            var r = { top: 0, left: 0, width: 2, height: 2 };
            try { cb2([{ isIntersecting: true, intersectionRatio: 1, target: el, boundingClientRect: r, intersectionRect: r, intersectionRect2: r, rootBounds: r, time: Date.now() }], this); } catch (e2) {}
          }, 0);
        };
      }
      ShimIO.__dragonFeedShim = true;
      try { window.IntersectionObserver = ShimIO; } catch (e) {}
      try { transBox.innerHTML = ""; } catch (e2) {}
      mk();
      setTimeout(function () { try { if (window.IntersectionObserver === ShimIO) window.IntersectionObserver = RealIO; } catch (e3) {} }, 2000);
    }, 6000);
    mk();
  }
  function doSend() {
    var el = feedEl;
    if (!el || el.hidden) return;
    var tx = String((el._inp && el._inp.value) || "").trim().slice(0, 2000);
    if (!tx) return;
    var ch = activeChannel();
    var btn = el._send;
    btn.disabled = true;
    btn.textContent = "\u2026";
    ensureTransport(ch, function (ok) {
      if (!ok || !transCtl || typeof transCtl.submit !== "function") {
        btn.disabled = false; btn.textContent = "Send"; btn.title = "Not connected \u2014 try again";
        return;
      }
      var p = null;
      try { p = transCtl.submit(tx); } catch (e) { p = null; }
      if (!p || typeof p.then !== "function") { btn.disabled = false; btn.textContent = "Send"; return; }
      // the echo arrives via onComment and renders the row; re-enable on a bounded wait
      var finished = false;
      var fin = function () {
        if (finished) return;
        finished = true;
        try { el._inp.value = ""; } catch (e) {}
        btn.disabled = false; btn.textContent = "Send"; btn.title = "Send";
      };
      p.then(function () { setTimeout(fin, 4000); }, function () { fin(); });
      setTimeout(fin, 15000);
    });
  }

  // live updates: chain the same onComment hook the notifications use
  function chainHook() {
    try {
      if (window.__dragonChatFeedHooked || typeof window.dragonChatOnComment !== "function") return;
      window.__dragonChatFeedHooked = true;
      var orig = window.dragonChatOnComment;
      window.dragonChatOnComment = function (c) {
        try { orig(c); } catch (e) {}
        try { if (isOpen()) render(false); } catch (e2) {}
      };
    } catch (e) {}
  }

  // Egon 17.10.2026 — no view switching: the toggle button is gone (feed fullscreen, old chat
  // always under it). A leftover button from before is removed; only the hook stays. The window
  // blur listener watches for gear clicks (window blurs with the mouse over the gear hole).
  var blurWired = false;
  function ensureBtn() {
    try {
      var old = document.getElementById(BTN_ID);
      if (old) old.remove();
      chainHook();
      if (!blurWired) {
        blurWired = true;
        window.addEventListener("blur", function () {
          try {
            if (!isOpen() || settingsMode) return;
            var g = gearViewportRect();
            if (!g) return;
            var pad = 10;
            if (lastMouse.x >= g.l - pad && lastMouse.x <= g.r + pad &&
              lastMouse.y >= g.t - pad && lastMouse.y <= g.b + pad) enterSettings();
          } catch (e) {}
        });
      }
    } catch (e) {}
  }
  function ensureBackBtn() {
    if (backBtnEl && backBtnEl.isConnected) return backBtnEl;
    try {
      var body = bodyEl();
      if (!body) return null;
      backBtnEl = document.createElement("button");
      backBtnEl.type = "button";
      backBtnEl.id = "dragonChatFeedBack";
      backBtnEl.textContent = "\uD83D\uDCAC Feed";
      backBtnEl.title = "Back to our chat feed";
      backBtnEl.hidden = true;
      backBtnEl.onclick = function (ev) { try { ev.stopPropagation(); } catch (e) {} exitSettings(); };
      body.appendChild(backBtnEl);
    } catch (e2) { backBtnEl = null; }
    return backBtnEl;
  }
  function enterSettings() {
    settingsMode = true;
    try { if (timer) clearInterval(timer); } catch (e) {}
    timer = 0;
    try { if (metaTimer) clearInterval(metaTimer); } catch (e2) {}
    metaTimer = 0;
    try { if (feedEl) feedEl.hidden = true; } catch (e3) {}
    try { var b = ensureBackBtn(); if (b) b.hidden = false; } catch (e4) {}
  }
  function exitSettings() {
    settingsMode = false;
    try { if (backBtnEl) backBtnEl.hidden = true; } catch (e) {}
    setOpen(true);
  }
  // Egon 17.10.2026 — the feed is ALWAYS on: whenever the chat window is visible, it stays open
  // (level-triggered: the chat body can be rebuilt under us, e.g. by the eager-loader, which drops
  // our element while the window stays visible — build() recreates it via isConnected).
  // Settings mode is the one exception: the feed stays aside until the return button is pressed.
  function watchDefault() {
    try {
      if (settingsMode) return;
      // Fallback for a missed blur: the chat iframe holds focus with the mouse over the gear hole.
      try {
        var ae = document.activeElement;
        if (ae && ae.tagName === "IFRAME" && isOpen() && winEl() && winEl().contains(ae)) {
          var g2 = gearViewportRect();
          if (g2 && lastMouse.x >= g2.l - 10 && lastMouse.x <= g2.r + 10 &&
            lastMouse.y >= g2.t - 10 && lastMouse.y <= g2.b + 10) { enterSettings(); return; }
        }
      } catch (eA) {}
      var w = winEl();
      var vis = !!(w && w.style.display !== "none");
      if (!vis) { lastWinVisible = false; return; }
      lastWinVisible = true;
      if (!isOpen()) setOpen(true);
      else { layoutMode(); applyClip(); }
    } catch (e) {}
  }
  setInterval(function () { try { ensureBtn(); watchDefault(); } catch (e) {} }, 1500);
  try { window.addEventListener("resize", function () { if (isOpen()) { layoutMode(); applyClip(); } }); } catch (e) {}
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureBtn);
  else setTimeout(ensureBtn, 1800);
})();
