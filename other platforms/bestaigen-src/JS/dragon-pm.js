// dragon-pm.js — private threads (end-to-end encrypted direct messages).
// Transport is a comments-plugin pair channel per two browsers; every body travels as
// secret-plugin ciphertext and only the recipient's private key opens it. The generator's own
// server never sees plaintext — it only runs the ephemeral presence roster (PM directory) so two
// browsers can find each other's names + public keys. Nothing PM-related is persisted server-side.
// Rollback: delete this file, its <script> tag in index.html, and the secret-plugin import in main.pjs.
(function () {
  if (window.__dragonPmInstalled) return;
  window.__dragonPmInstalled = true;

  function toast(m) { try { if (window.dragonToast) window.dragonToast(m); } catch (e) {} }
  function esc(s) { return String(s == null ? "" : s); }
  function plugs() { try { return window.root || {}; } catch (e) { return {}; } }
  function kvReady() { try { const r = plugs(); return !!(r.kv && r.kv.pm); } catch (e) { return false; } }

  // ---- hashing (pair-channel tags) ----
  function fnvHex(s) {
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    const str = String(s || "");
    for (let i = 0; i < str.length; i++) {
      h1 ^= str.charCodeAt(i); h1 = Math.imul(h1, 0x01000193) >>> 0;
      h2 ^= str.charCodeAt(i); h2 = Math.imul(h2, 0x01000193) >>> 0;
    }
    return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
  }
  function shaTag(pub) {
    const p = String(pub || "");
    try {
      if (window.crypto && crypto.subtle && window.isSecureContext !== false) {
        return crypto.subtle.digest("SHA-256", new TextEncoder().encode(p)).then(function (buf) {
          const b = new Uint8Array(buf);
          let s = "";
          for (let i = 0; i < 6; i++) s += b[i].toString(16).padStart(2, "0");
          return s;
        });
      }
    } catch (e) {}
    return Promise.resolve(fnvHex(p).slice(0, 12));
  }
  function pairChannel(a, b) {
    const x = String(a || ""), y = String(b || "");
    const s = [x, y].sort();
    return "pm-" + s[0] + "-" + s[1] + "+ids:channel";
  }

  // ---- identity ----
  function sysName() {
    // Egon 18.10.2026 — the chat nickname FIRST: it is the name the user actually wears in
    // chat, so PM threads show "Egon", not "Guest". (Needs no setup; falls through for lurkers.)
    try {
      const pl = myPluginId();
      if (pl && pl.nick && !/^guest$/i.test(String(pl.nick).trim())) return String(pl.nick).trim().slice(0, 24);
    } catch (eN) {}
    try { if (window.dragonCommentName) { const n = String(window.dragonCommentName() || "").trim(); if (n) return n.slice(0, 24); } } catch (e) {}
    try {
      if (window.dragonBotAPI && window.dragonBotAPI.userName) {
        const n = String(window.dragonBotAPI.userName() || "").trim();
        if (n) return n.slice(0, 24);
      }
    } catch (e) {}
    try {
      const c = JSON.parse(localStorage.dragonCloudUser || "null");
      if (c && c.u) return String(c.u).slice(0, 24);
    } catch (e) {}
    return "Guest";
  }
  var keysP = null;
  function ensureKeys() {
    if (keysP) return keysP;
    keysP = (async function () {
      const r = plugs();
      if (!r.secretPlugin || !r.secretPlugin.generateKeyPair) throw new Error("no-secret-plugin");
      if (kvReady()) {
        try {
          const saved = await r.kv.pm.get("keys");
          if (saved && saved.public && saved.private) return saved;
        } catch (e) {}
      }
      const k = r.secretPlugin.encrypt ? r.secretPlugin.generateKeyPair() : null;
      if (!k || !k.public || !k.private) throw new Error("keygen-failed");
      const pair = { public: String(k.public), private: String(k.private) };
      if (kvReady()) { try { await r.kv.pm.set("keys", pair); } catch (e) {} }
      return pair;
    })();
    keysP.catch(function () { keysP = null; });
    return keysP;
  }
  var tagP = null;
  function myTag() {
    if (tagP) return tagP;
    tagP = ensureKeys().then(function (k) { return shaTag(k.public); });
    tagP.catch(function () { tagP = null; });
    return tagP;
  }

  // ---- local stores (kv, memory fallback) ----
  var memPeers = {}, memBlocks = {};
  function peersGet() {
    if (kvReady()) return plugs().kv.pm.get("peers").then(function (v) { return v || {}; }, function () { return {}; });
    return Promise.resolve(memPeers);
  }
  function peersSet(v) {
    memPeers = v || {};
    if (kvReady()) { try { plugs().kv.pm.set("peers", memPeers).catch(function () {}); } catch (e) {} }
    return Promise.resolve();
  }
  function blocksGet() {
    if (kvReady()) return plugs().kv.pm.get("blocks").then(function (v) { return v || {}; }, function () { return {}; });
    return Promise.resolve(memBlocks);
  }
  function blocksSet(v) {
    memBlocks = v || {};
    if (kvReady()) { try { plugs().kv.pm.set("blocks", memBlocks).catch(function () {}); } catch (e) {} }
    return Promise.resolve();
  }
  function rpc(method, data) {
    try {
      if (window.dragonServerRpc) return window.dragonServerRpc(method, data);
    } catch (e) {}
    return Promise.reject(new Error("no-rpc"));
  }
  function announce() {
    return ensureKeys().then(function (k) {
      return myTag().then(function (t) {
        const o = { n: sysName(), t: t, p: k.public };
        // comments-plugin identity: lets the chatters list match EXACTLY (most chatters are
        // anonymous — nickname empty, only a visualId like "6big" — so name matching can't reach them).
        try {
          const pl = myPluginId();
          if (pl && /^[0-9a-z]{4,64}$/i.test(pl.id)) {
            o.u = pl.id;
            if (pl.nick) o.k = pl.nick.slice(0, 24);
            if (pl.vis) o.v = pl.vis.slice(0, 12);
          }
        } catch (e) {}
        return rpc("dragonPmAnnounce", JSON.stringify(o)).then(function (raw) {
          let r = null;
          try { r = JSON.parse(raw); } catch (e) { r = { ok: false }; }
          // Egon 18.10.2026 — pending first-contact mail rides the announce answer.
          try { if (r && r.ok && Array.isArray(r.mail) && r.mail.length) processMail(r.mail); } catch (eM) {}
          return r;
        });
      });
    });
  }
  // ---- comments-plugin identity (bridges chat nicks -> PM peers) ----
  // The plugin assigns every browser a stable user id and hands it to the parent page with
  // every comment. Reading our own from our most recent message lets the roster match chat
  // users EXACTLY (by plugin id) instead of by nickname.
  function myPluginId() {
    try {
      const m = window.___commentsPluginIframeUniqueIdToContext;
      if (!m) return null;
      let best = null;
      for (const ctx of m.values()) {
        let ch = "";
        try { ch = String((ctx.urlHashData || {}).channel || ""); } catch (e) {}
        if (ch.indexOf("pm-") === 0) continue;
        const arr = (ctx && ctx.allComments) || [];
        for (let i = 0; i < arr.length; i++) {
          const c = arr[i] || {};
          if (!c.byCurrentUser || !c.user || !c.user.id) continue;
          const t = c.time || 0;
          if (!best || t > best.t) best = { t: t, id: String(c.user.id), nick: String(c.user.nickname || ""), vis: String(c.user.visualId || "") };
        }
      }
      return best;
    } catch (e) { return null; }
  }
  function roster() {
    return rpc("dragonPmRoster", "").then(function (raw) {
      let d = null;
      try { d = JSON.parse(raw); } catch (e) {}
      return (d && d.ok && Array.isArray(d.r)) ? d.r : [];
    }, function () { return []; });
  }

  // ---- background presence: every open browser announces itself, inbox or not ----
  // This is what makes nick-click / Send-PM work without anyone having to open 💌 first:
  // the roster always holds whoever currently has the site open. Presence expires
  // server-side after 3 minutes, so re-announce well inside that window. Cheap
  // (one tiny RPC per ~100s) and silent — failures just mean "try again later".
  // A quick visit (open, write, close) used to miss the first announce entirely and leave
  // NO durable key behind — then nobody could ever PM that browser back. So: announce early,
  // and retry a few times when the announce fails.
  let pmAnnTries = 0;
  function bgPresence() {
    // Egon 20.10.2026 (quarantine-4429): jittered 15-60s backoff — failed announces used to retry in
    // lockstep every 15s across all browsers, one synchronized wave per interval.
    try { pmUIHook(); } catch (eH) {}
    try {
      announce().then(function (r) {
        if (r && r.ok) { pmAnnTries = 0; return; }
        if (pmAnnTries < 5) { pmAnnTries++; setTimeout(bgPresence, 15000 + Math.floor(Math.random() * 45000)); }
      }, function () {
        if (pmAnnTries < 5) { pmAnnTries++; setTimeout(bgPresence, 15000 + Math.floor(Math.random() * 45000)); }
      });
    } catch (e) {}
  }
  // The first announce often fires before the chat iframes load, so it carries no `u`
  // and row-PM clicks can't exact-match. The next own message triggers one extra announce
  // (server rate is 1 per 10s per connection; this fires once).
  let pmUIDone = false;
  function pmUIHook() {
    try {
      if (pmUIDone || window.__dragonPmUIDHook) return;
      if (typeof window.dragonChatOnComment !== "function") return;
      window.__dragonPmUIDHook = true;
      const orig = window.dragonChatOnComment;
      window.dragonChatOnComment = function (c) {
        try { orig(c); } catch (e) {}
        try {
          if (!pmUIDone && c && c.byCurrentUser && c.user && c.user.id) {
            pmUIDone = true;
            setTimeout(function () { try { announce().catch(function () {}); } catch (e2) {} }, 3000);
          }
        } catch (e3) {}
      };
    } catch (e) {}
  }
  if (!window.__dragonPmPresence) {
    window.__dragonPmPresence = true;
    setTimeout(bgPresence, 1500);
    setInterval(bgPresence, 100000);
    try {
      document.addEventListener("visibilitychange", function () {
        // Egon 18.10 — a backgrounded tab (mobile) burns its 5 announce retries on a dead socket,
        // then the return-to-tab announce gets one shot and goes silent. Reset the tries so the
        // return always has a full retry chain behind it.
        if (!document.hidden) { try { pmAnnTries = 0; } catch (eR) {} bgPresence(); }
      });
    } catch (e) {}
  }

  // ---- styles ----
  function ensureCss() {
    if (document.getElementById("dragonPmCss")) return;
    const st = document.createElement("style");
    st.id = "dragonPmCss";
    st.textContent =
      ".dragon-pm-ov{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;background:rgba(6,4,10,.72);font:16px/1.4 system-ui,sans-serif;}" +
      ".dragon-pm-card{position:relative;width:min(94vw,480px);max-height:min(86vh,640px);display:flex;flex-direction:column;background:linear-gradient(180deg,#20202a,#141419);color:#ece6ff;border:1px solid #3a3350;border-radius:14px;box-shadow:0 18px 60px rgba(0,0,0,.7);overflow:hidden;}" +
      ".dragon-pm-head{flex:0 0 auto;display:flex;align-items:center;gap:.6rem;padding:.7rem .8rem;border-bottom:1px solid #33333f;background:#191922;}" +
      ".dragon-pm-title{flex:1 1 auto;min-width:0;font-weight:800;font-size:.92rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
      ".dragon-pm-x{flex:0 0 auto;width:30px;height:30px;border-radius:50%;border:1px solid #4a4a58;background:#23232c;color:#ddd;font-size:.85rem;cursor:pointer;}" +
      ".dragon-pm-body{flex:1 1 auto;min-height:120px;overflow:auto;padding:.6rem .7rem;}" +
      ".dragon-pm-row{display:flex;align-items:center;gap:.5rem;width:100%;box-sizing:border-box;text-align:left;padding:.5rem .55rem;margin-bottom:.35rem;border-radius:9px;background:#1a1a22;border:1px solid #33333f;color:#ece6ff;cursor:pointer;font-size:.82rem;}" +
      ".dragon-pm-row:hover{border-color:#9b6bff;}" +
      ".dragon-pm-nm{font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
      ".dragon-pm-tg{font-size:.64rem;color:#8d8da0;font-family:monospace;}" +
      ".dragon-pm-un{flex:0 0 auto;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#b3261e;color:#fff;font-size:.68rem;font-weight:800;display:inline-flex;align-items:center;justify-content:center;}" +
      ".dragon-pm-del{flex:0 0 auto;width:26px;height:26px;border-radius:50%;border:1px solid #7a1f1a;background:#2a1210;color:#ff6b61;font-size:.75rem;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;}" +
      ".dragon-pm-btnrow{display:flex;gap:.5rem;margin-top:.2rem;}" +
      ".dragon-pm-btnhalf{flex:1 1 0;width:auto;margin-bottom:0;}" +
      ".dragon-pm-btn.dragon-pm-danger{border-color:#7a1f1a;background:linear-gradient(180deg,#4a1712,#2a1210);color:#ff8a80;}" +
      ".dragon-pm-msg{max-width:88%;padding:.4rem .6rem;border-radius:10px;margin-bottom:.35rem;font-size:.82rem;line-height:1.45;white-space:pre-wrap;word-break:break-word;}" +
      ".dragon-pm-mine{margin-left:auto;background:#2a1a4a;border:1px solid #6a4fc0;}" +
      ".dragon-pm-theirs{margin-right:auto;background:#1a1a22;border:1px solid #33333f;}" +
      ".dragon-pm-meta{font-size:.6rem;color:#8d8da0;margin-top:.15rem;}" +
      ".dragon-pm-foot{flex:0 0 auto;border-top:1px solid #33333f;padding:.55rem .7rem;background:#191922;display:flex;gap:.45rem;}" +
      ".dragon-pm-in{flex:1 1 auto;min-width:0;background:#0e0e13;color:#eee;border:1px solid #5a5a6a;border-radius:8px;padding:.45rem .55rem;font-size:.82rem;font-family:inherit;resize:none;}" +
      ".dragon-pm-send{flex:0 0 auto;font-weight:800;font-size:.82rem;padding:.45rem .85rem;border-radius:9px;border:1px solid #9b6bff;background:linear-gradient(180deg,#2a1a4a,#1a102e);color:#d8c9ff;cursor:pointer;}" +
      ".dragon-pm-send[disabled]{opacity:.5;cursor:default;}" +
      ".dragon-pm-btn{font-weight:800;font-size:.8rem;padding:.5rem .7rem;border-radius:9px;border:1px solid #9b6bff;background:linear-gradient(180deg,#2a1a4a,#1a102e);color:#d8c9ff;cursor:pointer;width:100%;box-sizing:border-box;margin-bottom:.4rem;}" +
      ".dragon-pm-note{font-size:.68rem;color:#8d8da0;text-align:center;padding:.3rem .4rem;}" +
      "#dragonCm .dcm-name{cursor:pointer;}" +
      "#dragonCm .dcm-name:hover{text-decoration:underline;}";
    document.head.appendChild(st);
  }

  // ---- unread badge (chat header button) ----
  var headBtn = null, headBadge = null;
  function paintBadge(n) {
    try {
      if (!headBadge) return;
      if (n > 0) { headBadge.textContent = n > 99 ? "99+" : String(n); headBadge.style.display = "inline-flex"; }
      else { headBadge.style.display = "none"; }
      if (headBtn) headBtn.title = n > 0 ? ("Private messages (" + n + " unread) — open inbox") : "Private messages — open inbox";
    } catch (e) {}
  }
  function refreshBadge() {
    peersGet().then(function (peers) {
      let n = 0;
      for (const k in peers) { if (peers[k] && peers[k].unread) n += peers[k].unread | 0; }
      paintBadge(n);
    }, function () {});
  }
  function ensureHeadBtn() {
    if (headBtn && headBtn.isConnected) return;
    const togs = document.getElementById("dragonChatHeadTogs");
    if (!togs) return;
    if (document.getElementById("dragonPmHeadBtn")) {
      headBtn = document.getElementById("dragonPmHeadBtn");
      headBadge = headBtn.querySelector(".dragon-pm-hb");
      refreshBadge();
      ensureChatBtn();
      return;
    }
    const b = document.createElement("button");
    b.type = "button"; b.id = "dragonPmHeadBtn"; b.className = "dragon-chat-btn";
    b.textContent = "💌"; b.title = "Private messages — open inbox";
    b.style.cssText = "position:relative;";
    const hb = document.createElement("span");
    hb.className = "dragon-pm-hb";
    hb.style.cssText = "position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:#b3261e;color:#fff;font-size:.6rem;font-weight:800;display:none;align-items:center;justify-content:center;";
    b.appendChild(hb);
    b.onclick = function (ev) { try { ev.stopPropagation(); } catch (e) {} openInbox(); };
    try { togs.insertBefore(b, togs.firstChild); } catch (eI) { togs.appendChild(b); }
    headBtn = b; headBadge = hb;
    refreshBadge();
    ensureChatBtn();
  }
  // 👥 chatters button, right after 💌 (Egon 17.10.2026: PM to chat nicknames — the iframe
  // itself can't carry buttons, so the people list lives here).
  // Egon 18.10.2026 — retired: the people list moved INTO the inbox. This now only removes leftovers.
  // Egon 18.10.2026 — retired: the people list moved INTO the inbox. This now only removes leftovers.
  function ensureChatBtn() {
    try { const old = document.getElementById("dragonPmChatBtn"); if (old && old.parentNode) old.parentNode.removeChild(old); } catch (e) {}
  }
  setInterval(function () { try { ensureHeadBtn(); } catch (e) {} }, 3000);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureHeadBtn);
  else setTimeout(ensureHeadBtn, 1500);
  try { ensureCss(); } catch (e) {} // nick affordance in picture comments, before any PM overlay opens

  // ---- overlay helper ----
  function overlay(title) {
    ensureCss();
    const ov = document.createElement("div");
    ov.className = "dragon-pm-ov";
    const card = document.createElement("div");
    card.className = "dragon-pm-card";
    const head = document.createElement("div");
    head.className = "dragon-pm-head";
    const t = document.createElement("div");
    t.className = "dragon-pm-title";
    t.textContent = title;
    const x = document.createElement("button");
    x.className = "dragon-pm-x"; x.textContent = "✕"; x.title = "Close";
    head.append(t, x);
    const body = document.createElement("div");
    body.className = "dragon-pm-body";
    card.append(head, body);
    ov.appendChild(card);
    document.body.appendChild(ov);
    const close = function () { try { if (ov.parentNode) ov.parentNode.removeChild(ov); } catch (e) {} };
    const api = { ov: ov, card: card, body: body, close: null, onClose: null };
    api.close = function () { close(); try { if (api.onClose) api.onClose(); } catch (e) {} };
    x.onclick = api.close;
    ov.addEventListener("keydown", function (e) { if (e.key === "Escape") api.close(); });
    try {
      if (window.dragonPopover) window.dragonPopover(ov, api.close, { modal: true });
      else ov.addEventListener("pointerdown", function (e) { if (e.target === ov) api.close(); });
    } catch (e) {}
    return api;
  }
  function dispName(n, t) {
    n = String(n || "Guest").slice(0, 24);
    if (n.toLowerCase() === "guest") return "Guest·" + String(t || "????").slice(0, 4);
    return n;
  }
  function isGuestName(n) { return !n || /^guest$/i.test(String(n).trim()); }
  // Egon 18.10.2026 — best display name from a roster row / key entry / peer: the real name
  // first, then the plugin nickname, then the short visualId everyone sees in chat ("w7tl"),
  // and only then "Guest" (which dispName renders with the tag fragment). Matching keys
  // (tag / plugin id) never go through here, so this only ever changes labels.
  function bestName(o) {
    o = o || {};
    if (!isGuestName(o.n)) return String(o.n).slice(0, 24);
    if (!isGuestName(o.k)) return String(o.k).slice(0, 24);
    if (o.v && String(o.v).trim()) return String(o.v).trim().slice(0, 24);
    return "Guest";
  }

  // ---- user popup (nick click target; enrichable later) ----
  window.dragonPmUser = function (peer) {
    if (!peer || !peer.t) { toast("💌 no user to show"); return; }
    ensureCss();
    Promise.all([blocksGet(), myTag()]).then(function (rs) {
      const blocks = rs[0] || {}, me = rs[1];
      if (peer.t === me) { toast("💌 that's you"); return; }
      const o = overlay(dispName(peer.n, peer.t));
      const tag = document.createElement("div");
      tag.className = "dragon-pm-note";
      tag.textContent = "id " + peer.t + (peer.online === false ? " · offline" : "");
      o.body.appendChild(tag);
      const locked = document.createElement("div");
      locked.className = "dragon-pm-note";
      locked.textContent = "🔒 messages are end-to-end encrypted";
      o.body.appendChild(locked);
      if (peer.keyOnly) {
        const off = document.createElement("div");
        off.className = "dragon-pm-note";
        off.textContent = "💌 " + dispName(peer.n, peer.t) + " isn't here now — your message waits in your shared private channel";
        o.body.appendChild(off);
      }
      const pm = document.createElement("button");
      pm.className = "dragon-pm-btn";
      pm.textContent = "💌 Send private message";
      pm.onclick = function () { o.close(); openThread(peer); };
      o.body.appendChild(pm);
      const bl = document.createElement("button");
      bl.className = "dragon-pm-btn";
      const isB = !!blocks[peer.t];
      bl.textContent = isB ? "🚫 Unblock" : "🚫 Block";
      bl.onclick = function () {
        blocksGet().then(function (b) {
          b = b || {};
          if (b[peer.t]) delete b[peer.t]; else b[peer.t] = 1;
          blocksSet(b).then(function () { toast(isB ? "💌 unblocked" : "🚫 blocked"); o.close(); });
        });
      };
      o.body.appendChild(bl);
    });
  };

  // ---- inbox (messages) ----
  // Egon 17.10.2026: the Online tab is gone — the 👥 People-in-chat list does that job better.
  // This window is just the conversation list now ("Messages"). The roster is still used
  // under the hood (nick-click + chatter matching); only the tab UI is removed.
  var hbTimer = 0;
  function heartbeat() {
    try { announce().catch(function () {}); } catch (e) {}
  }
  // Egon 18.10.2026 — heal stale "Guest·xxxx" labels: one roster pass per inbox open, so a
  // peer who has since announced a real name (or visualId) shows it everywhere.
  function refreshPeerNames() {
    Promise.all([peersGet(), roster()]).then(function (rs) {
      const peers = rs[0] || {}, rows = rs[1] || [];
      let changed = false;
      const byTag = {};
      for (let i = 0; i < rows.length; i++) { if (rows[i] && rows[i].t) byTag[rows[i].t] = rows[i]; }
      for (const tg in peers) {
        if (!peers[tg] || !byTag[tg]) continue;
        const bn = bestName(byTag[tg]);
        if ((!peers[tg].n || isGuestName(peers[tg].n)) && !isGuestName(bn)) { peers[tg].n = bn; changed = true; }
        if (byTag[tg].v && !peers[tg].v) { peers[tg].v = byTag[tg].v; changed = true; }
      }
      if (!changed) return;
      peersSet(peers).then(function () { try { if (window.dragonPmInboxRefresh) window.dragonPmInboxRefresh(); } catch (e) {} });
    }, function () {});
  }
    // Egon 18.10.2026 — delete-confirm + write-guard. The old X wrote back whatever
  // peersGet() returned; on a storage hiccup that resolves {} and the write wipes the
  // whole list. Now: no confirm = no write, and no write unless the key is present.
  function confirmDeleteConversation(tg, name) {
    const o = overlay("Delete conversation?");
    const msg = document.createElement("div");
    msg.className = "dragon-pm-note";
    msg.style.cssText = "font-size:.8rem;color:#ece6ff;padding:.4rem .2rem .8rem;";
    msg.textContent = "Remove \"" + name + "\" from your list? The encrypted messages stay in your shared private channel — only the list entry goes.";
    const row = document.createElement("div");
    row.className = "dragon-pm-btnrow";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "dragon-pm-btn dragon-pm-btnhalf";
    cancel.textContent = "Cancel";
    const del = document.createElement("button");
    del.type = "button";
    del.className = "dragon-pm-btn dragon-pm-btnhalf dragon-pm-danger";
    del.textContent = "Delete";
    row.append(cancel, del);
    o.body.append(msg, row);
    cancel.onclick = function () { o.close(); };
    try { cancel.focus(); } catch (e) {}
    del.onclick = function () {
      del.disabled = true;
      peersGet().then(function (peers) {
        peers = peers || {};
        if (!Object.prototype.hasOwnProperty.call(peers, tg)) { o.close(); return; }
        try { delete peers[tg]; } catch (e2) {}
        peersSet(peers).then(function () {
          try { if (openCh[tg] && openCh[tg].close) openCh[tg].close(); } catch (e1) {}
          refreshBadge();
          try { if (window.dragonPmInboxRefresh) window.dragonPmInboxRefresh(); } catch (eR) {}
          o.close(); toast("💌 conversation deleted");
        });
      });
    };
  }
window.dragonPmInbox = openInbox;
  function openInbox() {
    ensureKeys().then(function () { heartbeat(); }, function () { toast("💌 private messages unavailable right now"); });
    const o = overlay("💌 Private Message Box");
    try {
      const hx = o.card.querySelector(".dragon-pm-head .dragon-pm-x");
      const pb = document.createElement("button");
      pb.type = "button"; pb.id = "dragonPmPplBtn"; pb.className = "dragon-pm-x";
      pb.textContent = "👥"; pb.title = "People in chat — send a private message";
      pb.style.fontSize = ".8rem";
      pb.onclick = function (ev) { try { ev.stopPropagation(); } catch (e0) {} window.dragonPmChatters(); };
      if (hx && hx.parentNode) hx.parentNode.insertBefore(pb, hx);
    } catch (eP) {}
    try {
      window.dragonPmInboxRefresh = function () { try { if (o.ov.isConnected) showThreads(); } catch (e) {} };
      o.onClose = function () { try { delete window.dragonPmInboxRefresh; } catch (e) {} };
    } catch (e) {}
    const head2 = document.createElement("div");
    head2.style.cssText = "padding:.5rem .7rem 0;font-size:.72rem;font-weight:800;color:#a99ad6;";
    head2.textContent = "Messages";
    o.card.insertBefore(head2, o.body);
    const list = o.body;
    function showThreads() {
      list.innerHTML = "";
      peersGet().then(function (peers) {
        const tags = Object.keys(peers || {});
        if (!tags.length) {
          const d = document.createElement("div");
          d.className = "dragon-pm-note";
          d.textContent = "No conversations yet — tap 👥 in the 💬 chat to find someone.";
          list.appendChild(d);
          return;
        }
        tags.sort(function (a, b) { return ((peers[b] || {}).last || 0) - ((peers[a] || {}).last || 0); });
        tags.forEach(function (tg) {
          const p = peers[tg] || {};
          const r = document.createElement("button");
          r.className = "dragon-pm-row";
          const left = document.createElement("span");
          left.style.cssText = "flex:1 1 auto;min-width:0;";
          const nm = document.createElement("div");
          nm.className = "dragon-pm-nm";
          nm.textContent = dispName(p.n, tg);
          const pv = document.createElement("div");
          pv.className = "dragon-pm-tg";
          pv.textContent = esc(p.prev || "id " + tg).slice(0, 70);
          left.append(nm, pv);
          r.appendChild(left);
          if (p.unread) {
            const u = document.createElement("span");
            u.className = "dragon-pm-un";
            u.textContent = p.unread > 99 ? "99+" : String(p.unread);
            r.appendChild(u);
          }
          const d = document.createElement("span");
          d.className = "dragon-pm-del";
          d.textContent = "✕";
          d.title = "Delete conversation";
          d.onclick = function (ev) {
            try { ev.stopPropagation(); } catch (e0) {}
            confirmDeleteConversation(tg, dispName(p.n, tg));
          };
          r.appendChild(d);
          r.onclick = function () { o.close(); openThread({ t: tg, n: p.n, p: p.p }); };
          list.appendChild(r);
        });
      });
    }
    showThreads();
    refreshThreads();
    refreshPeerNames();
    // Egon 18.10.2026 — announce is 1 per 10 s per connection, so this first heartbeat can
    // come back rate-limited with no mail; one delayed retry catches the mailbox then.
    try { setTimeout(function () { try { if (o.ov.isConnected) heartbeat(); } catch (e) {} }, 11500); } catch (e) {}
    try { if (hbTimer) clearInterval(hbTimer); } catch (e) {}
    hbTimer = setInterval(function () { if (!o.ov.isConnected) { clearInterval(hbTimer); hbTimer = 0; return; } heartbeat(); }, 120000);
  }
  // one-shot background refresh: transient embeds for the most recent threads so the inbox badge is
  // real without keeping N live iframes around. Each embed is destroyed after its first load.
  function refreshThreads() {
    peersGet().then(function (peers) {
      peers = peers || {};
      const tags = Object.keys(peers).filter(function (t) { return peers[t] && peers[t].p && !openCh[t]; });
      tags.sort(function (a, b) { return ((peers[b] || {}).last || 0) - ((peers[a] || {}).last || 0); });
      tags.slice(0, 6).forEach(function (tg, ix) {
        setTimeout(function () {
          let box = null;
          try {
            const r = plugs();
            if (!r.commentsPlugin) return;
            ensureKeys().then(function (keys) {
              return myTag().then(function (me) {
                box = document.createElement("div");
                box.style.cssText = "height:2px;overflow:hidden;opacity:0.01;";
                document.body.appendChild(box);
                let done = false;
                const fin = function () {
                  if (done) return;
                  done = true;
                  try { if (box.parentNode) box.parentNode.removeChild(box); } catch (e) {}
                };
                setTimeout(fin, 12000);
                const seen = {};
                const ctl = r.commentsPlugin({
                  channel: pairChannel(me, tg),
                  replacedDuringUpdate: true,
                  width: "100%",
                  height: "120px",
                  hideDates: true,
                  commentPlaceholderText: "",
                  onLoad: function (comments) {
                    try {
                      let n = 0;
                      for (let i = 0; i < (comments || []).length; i++) {
                        const raw = String((comments[i] && comments[i].message) || "");
                        if (!raw || seen[raw]) continue;
                        seen[raw] = 1;
                        let pay = null;
                        try { pay = JSON.parse(String(r.secretPlugin.decrypt(raw, keys.private) || "")); } catch (e) { continue; }
                        if (!pay || pay.v !== 1 || typeof pay.text !== "string") continue;
                        const mine = pay.from === me;
                        if (!mine) n++;
                        else {
                          const lastPainted = String(pay.text || "").slice(0, 70);
                          peers[tg].prev = lastPainted;
                        }
                      }
                      const e = peers[tg] || {};
                      e.total = Math.max(e.total | 0, n);
                      e.unread = Math.max(0, (e.total | 0) - (e.seen | 0));
                      if (n) e.last = Date.now();
                      peersSet(peers).then(function () {
                        refreshBadge();
                        try { if (window.dragonPmInboxRefresh) window.dragonPmInboxRefresh(); } catch (e2) {}
                      });
                    } catch (e3) {}
                    fin();
                  }
                });
                box.innerHTML = ctl;
              });
            });
          } catch (e) {}
        }, ix * 700);
      });
    });
  }

  // ---- thread window (transport = one hidden comments embed) ----
  var openCh = {};
  function openThread(peer) {
    if (!peer || !peer.t) { toast("💌 no thread to open"); return; }
    if (openCh[peer.t]) { try { openCh[peer.t].ov.focus(); } catch (e) {} return; }
    ensureKeys().then(function (keys) {
      return myTag().then(function (me) {
        if (peer.t === me) { toast("💌 that's you"); return; }
        startThread(peer, keys, me);
      });
    }, function () { toast("💌 private messages unavailable right now"); });
  }
  window.dragonPmThread = openThread;
  function startThread(peer, keys, me) {
    blocksGet().then(function (blocks) {
      if (blocks && blocks[peer.t]) { toast("🚫 blocked — unblock first"); return; }
      const o = overlay("💌 " + dispName(peer.n, peer.t));
      openCh[peer.t] = o;
      const lock = document.createElement("div");
      lock.className = "dragon-pm-note";
      lock.textContent = peer.keyOnly
        ? "🔒 end-to-end encrypted — " + dispName(peer.n, peer.t) + " isn't here now, so this waits until they're back"
        : "🔒 end-to-end encrypted — nobody but you two can read this";
      o.body.appendChild(lock);
      const list = document.createElement("div");
      o.body.appendChild(list);
      const trans = document.createElement("div");
      trans.style.cssText = "height:2px;overflow:hidden;opacity:0.01;";
      o.body.appendChild(trans);
      const foot = document.createElement("div");
      foot.className = "dragon-pm-foot";
      const inp = document.createElement("textarea");
      inp.className = "dragon-pm-in";
      inp.rows = 2;
      inp.maxLength = 1500;
      inp.placeholder = "Write a private message… (Enter sends)";
      const send = document.createElement("button");
      send.className = "dragon-pm-send";
      send.textContent = "Send";
      send.disabled = true;
      send.title = "Connecting…";
      foot.append(inp, send);
      o.card.appendChild(foot);
      const ch = pairChannel(me, peer.t);
      let ctl = null, ready = false;
      const seen = {};
      function paint(text, mine, ts) {
        const d = document.createElement("div");
        d.className = "dragon-pm-msg " + (mine ? "dragon-pm-mine" : "dragon-pm-theirs");
        d.textContent = text;
        if (ts) {
          const m = document.createElement("div");
          m.className = "dragon-pm-meta";
          try { m.textContent = new Date(ts).toLocaleString(); } catch (e) { m.textContent = ""; }
          d.appendChild(m);
        }
        list.appendChild(d);
        try { o.body.scrollTop = o.body.scrollHeight; } catch (e) {}
      }
      function note(text) {
        const d = document.createElement("div");
        d.className = "dragon-pm-note";
        d.textContent = text;
        list.appendChild(d);
      }
      function decode(c) {
        const raw = String((c && c.message) || "");
        if (!raw || seen[raw]) return null;
        seen[raw] = 1;
        let pt = null;
        try { pt = plugs().secretPlugin.decrypt(raw, keys.private); } catch (e) { return null; }
        let pay = null;
        try { pay = JSON.parse(String(pt || "")); } catch (e) { return null; }
        if (!pay || pay.v !== 1 || typeof pay.text !== "string") return null;
        return { pay: pay, time: (c && c.time) || 0, mine: !!(c && c.byCurrentUser) || pay.from === me };
      }
      function ingest(arr, viewing, initial) {
        if (!arr || !arr.length) return;
        let peerTotal = 0;
        for (let i = 0; i < arr.length; i++) {
          const r = decode(arr[i]);
          if (!r) continue;
          paint(r.pay.text, r.mine, r.pay.ts || r.time);
          if (!r.mine) peerTotal++;
        }
        if (!peerTotal && list.querySelector(".dragon-pm-msg")) return;
        peersGet().then(function (peers) {
          peers = peers || {};
          const e = peers[peer.t] || {};
          e.n = peer.n || e.n || "";
          e.p = peer.p || e.p || "";
          e.last = Date.now();
          if (initial) e.total = Math.max(e.total | 0, peerTotal);
          else e.total = (e.total | 0) + peerTotal;
          if (viewing) e.seen = e.total;
          e.unread = Math.max(0, (e.total | 0) - (e.seen | 0));
          const lastPainted = list.querySelector(".dragon-pm-msg:last-of-type");
          if (lastPainted) e.prev = String(lastPainted.textContent || "").slice(0, 70);
          peers[peer.t] = e;
          peersSet(peers).then(refreshBadge);
        });
      }
      function doSend() {
        const tx = String(inp.value || "").trim().slice(0, 1500);
        if (!tx || !ctl || !ready) return;
        if (!peer.p) { toast("💌 no public key for this user — ask them to reopen their inbox"); return; }
        let enc = null, encSelf = null;
        try {
          const pay = JSON.stringify({ v: 1, from: me, name: sysName(), text: tx, ts: Date.now() });
          enc = plugs().secretPlugin.encrypt(pay, String(peer.p));
          // Egon 18.10 — own-history copy: my sends are encrypted to the PEER, so I can never
          // decrypt them back from channel history (reopen showed only incoming). A second copy
          // encrypted to MYSELF rides the same channel: the peer cannot decrypt it (skips it, like
          // old clients do), and I read it back as mine on every reopen.
          try { encSelf = plugs().secretPlugin.encrypt(pay, String(keys.public)); } catch (eS) { encSelf = null; }
        } catch (e) { toast("💌 couldn't encrypt that"); return; }
        send.disabled = true;
        // the embed only answers submit after a nickname is staged; "" keeps the pair channel unlinkable
        const go = async function () {
          try {
            if (ctl && typeof ctl.setNicknameForNextComment === "function") {
              try { await ctl.setNicknameForNextComment(""); } catch (e2) {}
            }
          } catch (e3) {}
          seen[enc] = 1;
          const c0 = ctl;
          const r = await c0.submit(enc);
          // the own-history copy follows quietly, spaced so the transport never sees rapid fire;
          // a failure here loses only my reopen-history, never the delivered message.
          if (encSelf && encSelf !== enc) {
            (async function () {
              try { seen[encSelf] = 1; } catch (e4) {}
              try { await new Promise(function (res) { setTimeout(res, 1200); }); } catch (e5) {}
              try { if (c0 && typeof c0.submit === "function") await c0.submit(encSelf); } catch (e6) {}
            })();
          }
          return r;
        };
        let p = null;
        try { p = go(); } catch (e) { p = null; }
        if (!p || typeof p.then !== "function") { send.disabled = false; toast("💌 couldn't send right now"); return; }
        p.then(function () {
          inp.value = "";
          send.disabled = false;
          paint(tx, true, Date.now());
          // Egon 18.10.2026 — first-contact ping: tells the recipient's next announce a
          // message waits (they can never discover the pair channel by polling).
          try { rpc("dragonPmPing", JSON.stringify({ to: peer.t, from: me })).catch(function () {}); } catch (eP) {}
          peersGet().then(function (peers) {
            peers = peers || {};
            const e = peers[peer.t] || {};
            e.n = peer.n || e.n || "";
            e.p = peer.p || e.p || "";
            e.last = Date.now();
            e.prev = tx.slice(0, 70);
            peers[peer.t] = e;
            peersSet(peers).then(refreshBadge);
          });
        }, function () { send.disabled = false; toast("💌 couldn't send right now"); });
      }
      send.onclick = doSend;
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); } });
      o.onClose = function () {
        try { delete openCh[peer.t]; } catch (e) {}
        try { trans.innerHTML = ""; } catch (e2) {}
        ctl = null;
      };
      o.ov.addEventListener("pointerdown", function () { refreshBadge(); });
      // one hidden transport embed for this thread; its hooks feed our own UI
      try {
        heartbeat();
        const r = plugs();
        if (!r.commentsPlugin) { note("Chat transport isn't ready — try again in a moment."); return; }
        ctl = r.commentsPlugin({
          channel: ch,
          replacedDuringUpdate: true,
          width: "100%",
          height: "120px",
          hideDates: true,
          commentPlaceholderText: "",
          onLoad: function (comments) {
            ready = true;
            try { send.disabled = false; send.title = "Send"; } catch (e) {}
            try { ingest(comments || [], true, true); } catch (e) {}
          },
          onComment: function (c) {
            try { ingest(c ? [c] : [], true, false); } catch (e) {}
          }
        });
        trans.innerHTML = ctl;
        if (!ctl || typeof ctl.submit !== "function") {
          // older host: fall back to the plugin iframe's programmatic-submit message
          const fb = function () {
            const f = trans.querySelector("iframe");
            if (!f) return false;
            try {
              f.contentWindow.postMessage({ type: "trigger_programmatic_submit", text: "", nickname: null, auth: null, channel: ch, requestId: "pm" + Date.now() }, "https://comments-plugin.perchance.org");
              return true;
            } catch (e) { return false; }
          };
          ctl = { submit: function (text) {
            return new Promise(function (res, rej) {
              if (!fb()) { rej(new Error("no-transport")); return; }
              res(true);
            });
          } };
        }
      } catch (e) { note("Chat transport isn't ready — try again in a moment."); }
    });
  }

  // ---- nick click in picture comments (#dragonCm .dcm-name) -> PM card ----
  // Picture comments carry names only (no keys), so a clicked nick is resolved against the
  // live PM roster by name. Exactly one hit opens their card; several hits get a chooser;
  // no hit means they already left the site (every open browser announces itself in the
  // background, so anyone still here is listed).
  function rosterByName(name) {
    const want = String(name || "").trim();
    if (!want || /^anon$/i.test(want)) return Promise.resolve({ hits: [], selfOnly: false });
    return Promise.all([roster(), myTag()]).then(function (rs) {
      const rows = rs[0] || [], me = rs[1];
      const hits = [];
      // visualId ("w7tl") and plugin id match FIRST — most chatters are anonymous, so the
      // display name is usually "Guest" and name matching can't reach them.
      rows.forEach(function (e) {
        if (e && e.t && e.t !== me && e.v && String(e.v) === want && hits.indexOf(e) === -1) hits.push(e);
      });
      rows.forEach(function (e) {
        if (e && e.t && e.t !== me && e.u && String(e.u).toLowerCase() === want.toLowerCase() && hits.indexOf(e) === -1) hits.push(e);
      });
      rows.forEach(function (e) {
        if (e && e.t && e.t !== me && String(e.n || "").trim() === want && hits.indexOf(e) === -1) hits.push(e);
      });
      rows.forEach(function (e) {
        if (e && e.t && e.t !== me && String(e.n || "").trim().toLowerCase() === want.toLowerCase() && hits.indexOf(e) === -1) hits.push(e);
      });
      const selfOnly = !hits.length && rows.some(function (e) {
        return e && e.t && e.t === me && (String(e.n || "").trim().toLowerCase() === want.toLowerCase() ||
          (e.v && String(e.v) === want) || (e.u && String(e.u).toLowerCase() === want.toLowerCase()));
      });
      return { hits: hits, selfOnly: selfOnly };
    }, function () { return { hits: [], selfOnly: false }; });
  }
  function openNickCard(name) {
    const nm = String(name || "").trim().slice(0, 24);
    if (!nm) return;
    rosterByName(nm).then(function (r) {
      if (r.hits.length === 1) { window.dragonPmUser({ t: r.hits[0].t, n: bestName(r.hits[0]), p: r.hits[0].p }); }
      else if (r.hits.length > 1) {
        const o = overlay("💌 " + nm);
        const note = document.createElement("div");
        note.className = "dragon-pm-note";
        note.textContent = "A few people share this name — pick one.";
        o.body.appendChild(note);
        r.hits.forEach(function (e) {
          const b = document.createElement("button");
          b.className = "dragon-pm-row";
          b.textContent = dispName(bestName(e), e.t) + " · id " + e.t;
          b.onclick = function () { o.close(); window.dragonPmUser({ t: e.t, n: bestName(e), p: e.p }); };
          o.body.appendChild(b);
        });
      }
      else keyLookup({ n: nm }).then(function (k) {
        if (k) window.dragonPmUser({ t: k.t, n: bestName(k), p: k.p, keyOnly: true });
        // Egon 18.10.2026 — anonymous chatters have no usable name (durable name is
        // "Guest"), but their chat visualId ("w7tl") IS in the directory: try it before
        // giving up, so offline people stay messageable.
        else keyLookup({ v: nm }).then(function (k2) {
          if (k2) window.dragonPmUser({ t: k2.t, n: bestName(k2), p: k2.p, keyOnly: true });
          else if (r.selfOnly) toast("💌 that's you");
          else toast("💌 " + nm + " isn't reachable yet — their browser hasn't announced; ask them to keep the page open a moment, then try again");
        });
      });
    });
  }
  window.dragonPmByName = openNickCard;
  window.dragonPmPeer = openPluginPeer; // (pluginUserId, displayName) — used by our own chat feed
  // Exact-match by comments-plugin user id (the chatters list carries it); falls back to
  // name matching when the other side runs older code that doesn't announce its plugin id.
  function keyLookup(q) {
    // durable directory: anyone EVER seen, online or not (offline PM works — the pair
    // channel is persistent, so the message waits for them).
    return rpc("dragonPmKey", JSON.stringify(q || {})).then(function (raw) {
      let d = null;
      try { d = JSON.parse(raw); } catch (e) {}
      return (d && d.ok && d.e && d.e.p) ? d.e : null;
    }, function () { return null; });
  }
  // ---- PM MAILBOX (first-contact delivery; Egon 18.10.2026): the pair channel name needs
  // BOTH tags, so a recipient can never discover a first message by polling. Instead every
  // send drops a {to, from} ping on the server, and every announce answers with the pending
  // mail for that tag. Unknown senders auto-join the inbox (public key from the durable
  // directory), their channel is checked once, and a real arrival beeps + badges + toasts.
  let memMailSeen = {};
  function mailSeenGet() {
    if (kvReady()) return plugs().kv.pm.get("mailSeen").then(function (v) { return v || {}; }, function () { return {}; });
    return Promise.resolve(memMailSeen);
  }
  function mailSeenSet(v) {
    memMailSeen = v || {};
    if (kvReady()) { try { plugs().kv.pm.set("mailSeen", memMailSeen).catch(function () {}); } catch (e) {} }
    return Promise.resolve();
  }
  function pmBeep() { try { if (typeof window.dragonChatBeep === "function") window.dragonChatBeep(); } catch (e) {} }
  function processMail(list) {
    if (!Array.isArray(list) || !list.length) return;
    Promise.all([peersGet(), mailSeenGet()]).then(function (rs) {
      const peers = rs[0] || {}, seen = rs[1] || {};
      const fresh = [];
      for (let i = 0; i < list.length; i++) {
        const tg = String(list[i] || "");
        if (!/^[0-9a-f]{12}$/.test(tg) || seen[tg]) continue;
        fresh.push(tg);
      }
      if (!fresh.length) return;
      (function next(ix) {
        if (ix >= fresh.length) return;
        const tg = fresh[ix];
        const step = function () {
          seen[tg] = Math.floor(Date.now() / 1000);
          try {
            const ks = Object.keys(seen);
            if (ks.length > 300) { ks.sort(function (a, b) { return seen[a] - seen[b]; }); for (let d = 0; d < ks.length - 300; d++) delete seen[ks[d]]; }
          } catch (eP) {}
          mailSeenSet(seen).then(function () { next(ix + 1); }, function () { next(ix + 1); });
        };
        keyLookup({ t: tg }).then(function (k) {
          if (k && k.p) {
            peers[tg] = peers[tg] || {};
            const bn = bestName(k);
            if (!peers[tg].n || (isGuestName(peers[tg].n) && !isGuestName(bn))) peers[tg].n = bn;
            if (k.v && !peers[tg].v) peers[tg].v = k.v;
            peers[tg].p = k.p;
            peers[tg].last = peers[tg].last || Date.now();
            peersSet(peers).then(function () {
              try { refreshBadge(); } catch (eB) {}
              try { if (window.dragonPmInboxRefresh) window.dragonPmInboxRefresh(); } catch (eR) {}
              checkOneChannel(tg); step();
            }, function () { checkOneChannel(tg); step(); });
          } else step();
        }, function () { step(); });
      })(0);
    }, function () {});
  }
  // one transient embed over a single pair channel (the per-tag core of refreshThreads):
  // picks up messages for a peer without keeping a live iframe. New arrivals beep + badge.
  function checkOneChannel(tg) {
    try {
      const r = plugs();
      if (!r.commentsPlugin) return;
      peersGet().then(function (peers) {
        peers = peers || {};
        if (!peers[tg] || !peers[tg].p || openCh[tg]) return;
        ensureKeys().then(function (keys) {
          return myTag().then(function (me) {
            const box = document.createElement("div");
            box.style.cssText = "height:2px;overflow:hidden;opacity:0.01;";
            document.body.appendChild(box);
            let done = false;
            const fin = function () { if (!done) { done = true; try { if (box.parentNode) box.parentNode.removeChild(box); } catch (e) {} } };
            setTimeout(fin, 15000);
            const seen = {};
            const ctl = r.commentsPlugin({
              channel: pairChannel(me, tg),
              replacedDuringUpdate: true,
              width: "100%",
              height: "120px",
              hideDates: true,
              commentPlaceholderText: "",
              onLoad: function (comments) {
                try {
                  let n = 0, lastMine = "";
                  const arr = comments || [];
                  for (let i = 0; i < arr.length; i++) {
                    const raw = String((arr[i] && arr[i].message) || "");
                    if (!raw || seen[raw]) continue;
                    seen[raw] = 1;
                    let pay = null;
                    try { pay = JSON.parse(String(r.secretPlugin.decrypt(raw, keys.private) || "")); } catch (e) { continue; }
                    if (!pay || pay.v !== 1 || typeof pay.text !== "string") continue;
                    if (pay.from === me) lastMine = String(pay.text || "").slice(0, 70);
                    else n++;
                  }
                  peersGet().then(function (pp) {
                    pp = pp || {};
                    const e = pp[tg] || {};
                    const before = e.unread | 0;
                    e.total = Math.max(e.total | 0, n);
                    e.unread = Math.max(0, (e.total | 0) - (e.seen | 0));
                    if (n) e.last = Date.now();
                    if (lastMine && !e.prev) e.prev = lastMine;
                    peersSet(pp).then(function () {
                      refreshBadge();
                      try { if (window.dragonPmInboxRefresh) window.dragonPmInboxRefresh(); } catch (e2) {}
                      if ((e.unread | 0) > before) {
                        pmBeep();
                        try { toast("💌 new private message from " + dispName(e.n, tg)); } catch (e3) {}
                      }
                    });
                  });
                } catch (e4) {}
                fin();
              }
            });
            box.innerHTML = ctl;
          });
        });
      });
    } catch (e) {}
  }
  function openPluginPeer(uid, nm) {    if (!uid) {
      if (!String(nm || "").trim()) { toast("💌 no name or id on this message — can't reach them"); return; }
      openNickCard(nm); return;
    }
    roster().then(function (rows) {
      const hit = (rows || []).filter(function (e) { return e && e.u === uid; })[0];
      if (hit) {
        myTag().then(function (me) {
          if (hit.t === me) toast("💌 that's you");
          else window.dragonPmUser({ t: hit.t, n: bestName(hit), p: hit.p });
        }, function () { window.dragonPmUser({ t: hit.t, n: bestName(hit), p: hit.p }); });
      }
      else keyLookup({ u: uid }).then(function (k) {
        if (k) window.dragonPmUser({ t: k.t, n: bestName(k), p: k.p, keyOnly: true });
        else openNickCard(nm);
      });
    }, function () { openNickCard(nm); });
  }
  if (!window.__dragonPmNickHook) {
    window.__dragonPmNickHook = true;
    document.addEventListener("click", function (ev) {
      try {
        const el = ev.target && ev.target.closest ? ev.target.closest("#dragonCm .dcm-name") : null;
        if (!el || !document.body.contains(el)) return;
        const name = String(el.textContent || "").trim();
        if (!name) return;
        openNickCard(name);
      } catch (e) {}
    }, false);
  }

  // ---- people in the 💬 chat (comments-plugin), each with a Send-PM ----
  // Chat messages live in a cross-origin iframe: no button can be placed next to a nick
  // inside it, and row positions can't be read from outside. But the plugin hands every
  // comment (with its author's nickname) to the parent page, so this panel lists the
  // recent chatters with a Send-PM each. PM pair-channel transports are skipped.
  function chatChatters() {
    const seen = new Map();
    try {
      const m = window.___commentsPluginIframeUniqueIdToContext;
      if (m) for (const ctx of m.values()) {
        let ch = "";
        try { ch = String((ctx.urlHashData || {}).channel || ""); } catch (e) {}
        if (ch.indexOf("pm-") === 0) continue;
        const arr = (ctx && ctx.allComments) || [];
        for (let i = 0; i < arr.length; i++) {
          const c = arr[i] || {}, u = c.user || {};
          const nm = String(u.nickname || "").trim().slice(0, 24) || String(u.visualId || "").trim().slice(0, 12);
          if (!nm) continue;
          if (/^ENCRYPTED_/.test(String(c.message || ""))) continue;
          const t = c.time || 0, uid = String(u.id || "");
          if (!seen.has(nm)) seen.set(nm, { n: nm, t: t, mine: !!c.byCurrentUser, u: uid });
          else { const e = seen.get(nm); if (t > e.t) { e.t = t; e.u = uid || e.u; } e.mine = e.mine || !!c.byCurrentUser; }
        }
      }
    } catch (e) {}
    return Array.from(seen.values()).sort(function (a, b) { return b.t - a.t; }).slice(0, 60);
  }
  function paintChatterRows(body, onPick) {
    const rows = chatChatters();
    if (!rows.length) {
      const d = document.createElement("div");
      d.className = "dragon-pm-note";
      d.textContent = "No chatters seen yet — open the 💬 chat first so recent messages load.";
      body.appendChild(d);
      return;
    }
    const note = document.createElement("div");
    note.className = "dragon-pm-note";
    note.textContent = "🔒 PMs are end-to-end encrypted";
    body.appendChild(note);
    rows.forEach(function (e) {
      const r = document.createElement("div");
      r.className = "dragon-pm-row dragon-pm-ppl";
      r.style.cursor = "default";
      const left = document.createElement("span");
      left.style.cssText = "flex:1 1 auto;min-width:0;";
      const nm = document.createElement("div");
      nm.className = "dragon-pm-nm";
      nm.textContent = e.n + (e.mine ? " (you)" : "");
      left.appendChild(nm);
      r.appendChild(left);
      if (!e.mine) {
        const b = document.createElement("button");
        b.className = "dragon-pm-send";
        b.textContent = "💌";
        b.title = "Send " + e.n + " a private message";
        b.onclick = function () { try { if (onPick) onPick(); } catch (x) {} openPluginPeer(e.u, e.n); };
        r.appendChild(b);
      }
      body.appendChild(r);
    });
  }
  window.dragonPmChatters = function () {
    const o = overlay("👥 People in chat");
    paintChatterRows(o.body, function () { o.close(); });
  };
  // ---- identity readout (support/debug) + self test (no durable writes anywhere) ----
  window.dragonPmMe = async function () {
    const keys = await ensureKeys();
    const t = await myTag();
    return { tag: t, pub: keys.public, name: sysName() };
  };
  window.dragonPmTest = async function () {
    const out = {};
    try {
      const r = plugs();
      out.hasSecret = !!(r.secretPlugin && r.secretPlugin.generateKeyPair && r.secretPlugin.encrypt && r.secretPlugin.decrypt);
      out.hasComments = typeof r.commentsPlugin === "function";
      out.hasRpc = typeof window.dragonServerRpc === "function";
      if (!out.hasSecret) { out.ok = false; out.err = "secret-plugin missing"; return out; }
      const k = r.secretPlugin.generateKeyPair();
      out.keyShapes = !!(k && String(k.public).indexOf("PUBLIC_") === 0 && String(k.private).indexOf("PRIVATE_") === 0);
      const probe = JSON.stringify({ v: 1, from: "t", text: "hello pm" });
      const enc = r.secretPlugin.encrypt(probe, k.public);
      out.cipherShape = String(enc).indexOf("ENCRYPTED_") === 0;
      out.roundtrip = r.secretPlugin.decrypt(enc, k.private) === probe;
      const t1 = await shaTag(k.public);
      out.tagShape = /^[0-9a-f]{12}$/.test(t1);
      out.channelSym = pairChannel("aabbcc", "ddeeff") === pairChannel("ddeeff", "aabbcc");
      out.channelShape = /^pm-[0-9a-f]{12}-[0-9a-f]{12}\+ids:channel$/.test(pairChannel(t1, "001122aabbcc"));
      const ann = await announce().catch(function (e) { return { ok: false, err: String(e && e.message || e) }; });
      out.announce = !!(ann && ann.ok);
      const rows = await roster().catch(function () { return []; });
      out.rosterOk = Array.isArray(rows);
      const me = await myTag().catch(function () { return ""; });
      out.rosterHasMe = !!me && rows.some(function (e) { return e && e.t === me; });
      out.ok = !!(out.keyShapes && out.roundtrip && out.tagShape && out.channelSym && out.announce && out.rosterOk && out.rosterHasMe);
    } catch (e) { out.ok = false; out.err = String((e && e.message) || e).slice(0, 120); }
    return out;
  };
})();
