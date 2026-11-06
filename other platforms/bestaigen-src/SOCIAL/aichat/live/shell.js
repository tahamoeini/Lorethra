// ============================================================================
// aichat/live/shell.js — the Ai Chat page surface (threads + session), live build 30.10.2026.
// ----------------------------------------------------------------------------
// Mounts window.dragonAiChat (engine.js in this folder) into the navbar's Ai Chat page
// (src/SOCIAL/social-page.js, page key `social`). Two panes: open chat threads on the
// left, the mounted session on the right. No People/user-chat here — that side stays
// parked (W-SOCIALCUT).
//
// DECISIONS (Egon): names as drafted; Sexa listed with NO badge and no gate; Dexa is
// ALWAYS the default view (first visit opens her thread, and an empty list reopens
// her). The left list shows ONLY threads the visitor started via the Companions window
// — one companion can own MANY threads (#Thread, #Thread 2, …). Taglines live in
// tooltips + special settings, never under names. Each thread carries an editable
// #title and a hover ✖ (confirm closes AND deletes the chat); a hover ♥ pins it to
// the top. Exposes window.dragonAiChatShell = { select, repaint, openCompanions }.
// ============================================================================
(function () {
  if (window.__dragonAiChatShell) return;
  window.__dragonAiChatShell = true;

  var LS_TID = "dragonAiChatThread";
  var state = { tid: null, handle: null };

  function AI() { try { return window.dragonAiChat || null; } catch (e) { return null; } }
  function rememberTid(tid) { try { localStorage.setItem(LS_TID, tid); } catch (e) {} }

  // Chat height: from under the navbar to 24px above the viewport bottom.
  // The wrap itself is nudged 2px upward (relative offset, see css()), and the
  // top stack above it is cut ~20px (AI-scoped padding-top rules below: page
  // 19.2px->9px, box ~17.6px->8px). Together the panel top sits ~22px closer
  // to the navbar — the 40px of whitespace above the panel is halved to ~20px
  // (title text size untouched) — while its height stays exactly what the old
  // formula produced (the removed 20px sits at the bottom instead).
  // The wrap is often built while its tab is hidden (zero rect), so a hidden
  // wrap retries until it becomes visible; the CSS clamp is the pre-JS fallback.
  // Static slack under the wrap (card/box/page padding) is zeroed by the :has
  // rules below, so the wrap bottom + 2px == the document bottom == no page
  // scrollbar. (Do NOT subtract scrollHeight slack here: the site's min-height
  // on #dragonSocialPage floors the document at ~viewport height, which would
  // read as phantom slack and shrink the panel for no reason.)
  function fitChatHeight(n) {
    try {
      var w = document.querySelector("#dragonSocialPage .aichat-wrap");
      if (!w) return;
      // Narrow screens use the stacked (column) layout — never pin a pixel height.
      try { if (window.matchMedia && window.matchMedia("(max-width:700px)").matches) { if (w.style.height) w.style.height = ""; return; } } catch (eM) {}
      var r = w.getBoundingClientRect();
      if (!r.width && !r.height) {
        if ((n || 0) < 25) setTimeout(function () { fitChatHeight((n || 0) + 1); }, 400);
        return;
      }
      var de = document.documentElement;
      var h = Math.max(480, Math.round(window.innerHeight - r.top - 25)); // -25: measured top-stack cut 21px + 2px nudge + 2px bottom gap, so the height stays identical (bottom gap 25px).
      if (w.style.height !== h + "px") w.style.height = h + "px";
      try {
        requestAnimationFrame(function () {
          try {
            var over = de.scrollHeight - window.innerHeight;
            if (over > 1 && w.isConnected) w.style.height = Math.max(300, w.offsetHeight - over) + "px";
          } catch (e2) {}
        });
      } catch (e3) {}
    } catch (e) {}
  }
  try {
    if (!window.__aichatFitBound) {
      window.__aichatFitBound = true;
      window.addEventListener("resize", function () { fitChatHeight(); });
      // Backstop: some iframes/embeds never fire window.resize on viewport
      // changes — re-fit shortly after any viewport size change is noticed.
      window.__aichatFitVW = 0; window.__aichatFitVH = 0;
      setInterval(function () {
        try {
          if (window.innerWidth !== window.__aichatFitVW || window.innerHeight !== window.__aichatFitVH) {
            window.__aichatFitVW = window.innerWidth; window.__aichatFitVH = window.innerHeight;
            fitChatHeight();
          }
        } catch (eP) {}
      }, 800);
    }
  } catch (eB) {}
  // Fit on viewport changes via the poll backstop below (kept, cheap: it only
  // calls fitChatHeight when the viewport size actually changed).

  function css() {
    if (document.getElementById("dragonAiChatShellCss")) return;
    var st = document.createElement("style");
    st.id = "dragonAiChatShellCss";
    st.textContent =
      ".aichat-wrap{display:flex; gap:.6rem; height:clamp(480px, calc(100dvh - 15rem), 780px); min-height:0; position:relative; top:-2px;}" +
      "#dragonSocialPage:has(.aichat-wrap){padding-bottom:0;}" +
      "#dragonSocialPage .dragon-social-box:has(.aichat-wrap){padding-bottom:0;}" +
      "#dragonSocialPage:has(.aichat-wrap){padding-top:7px;}" +
      "#dragonSocialPage .dragon-social-box:has(.aichat-wrap){padding-top:6px;}" +
      ".aichat-roster{flex:0 0 232px; max-width:232px; height:100%; max-height:none; display:flex; flex-direction:column; gap:.3rem; overflow-y:auto; padding:.1rem;}" +
      ".aichat-grp{font-size:.64rem; text-transform:uppercase; letter-spacing:.08em; color:var(--dt-muted,#8d86a8); padding:.3rem .3rem .05rem;}" +
      ".aichat-item{display:flex; align-items:center; gap:.5rem; width:100%; box-sizing:border-box; padding:.4rem .45rem; border:1px solid transparent; border-radius:10px; background:transparent; color:#dcd6ee; cursor:pointer; text-align:left; font:inherit;}" +
      ".aichat-item:hover{background:rgba(155,107,255,.12);}" +
      ".aichat-item.sel{background:rgba(155,107,255,.2); border-color:var(--dt-accent,#7a5cd6); color:#fff;}" +
      ".aichat-item img{width:30px; height:30px; border-radius:50%; object-fit:cover; flex:0 0 auto; border:1px solid #5b4a7d;}" +
      ".aichat-item .tx{flex:1; min-width:0;}" +
      ".aichat-item .lb{font-size:.82rem; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}" +
      ".aichat-item .th{display:inline-block; max-width:100%; font-size:.68rem; color:#9ed2ff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; cursor:text;}" +
      ".aichat-item .th:focus{outline:1px solid #7a5cd6; border-radius:4px; background:#0e0e13;}" +
      ".aichat-item .pin,.aichat-item .rm{flex:0 0 auto; visibility:hidden; border-radius:6px; cursor:pointer; padding:.05rem .35rem; font-size:.7rem;}" +
      ".aichat-item .pin{border:0; background:transparent; font-size:.85rem;}" +
      ".aichat-item .pin.on{visibility:visible;}" +
      ".aichat-item .rm{border:1px solid #7d3a48; background:#2a1018; color:#ffb3c0;}" +
      ".aichat-item:hover .pin,.aichat-item:hover .rm{visibility:visible;}" +
      "@media (hover:none){.aichat-item .pin,.aichat-item .rm{visibility:visible;}}" +
      ".aichat-new{border:1px dashed #5b4a7d !important; color:#bcb0e6 !important; justify-content:center; font-weight:700;}" +
      ".aichat-settings{justify-content:center !important; text-align:center !important; border:1px solid var(--dt-accent,#7a5cd6) !important; border-radius:10px !important; background:linear-gradient(180deg,#3a2f57,#201830) !important; color:#e6dcff !important; font-weight:800; margin-bottom:0 !important;}" +
      ".aichat-roster>.aichat-settings+.aichat-settings{margin-top:-.15rem !important;}" +
      ".aichat-pane{flex:1; min-width:0; min-height:0; display:flex; border:1px solid var(--dt-border,#4a4a58); border-radius:12px; overflow:hidden;}" +
      ".aichat-pane .dragon-ai-session{flex:1; min-width:0;}" +
      ".aichat-pane .dragon-ai-msgs{min-height:0; max-height:none;}" +
      ".aichat-empty{margin:auto; text-align:center; padding:2rem 1rem; display:flex; flex-direction:column; gap:.5rem; align-items:center;}" +
      ".aichat-empty-t{font-weight:800; font-size:1rem; color:#d8c9ff;}" +
      ".aichat-empty-s{font-size:.78rem; opacity:.7;}" +
      ".aichat-empty-b{border:1px solid var(--dt-accent,#7a5cd6); background:linear-gradient(180deg,#3a2f57,#201830); color:#e6dcff; border-radius:10px; padding:.5rem 1rem; cursor:pointer; font:inherit; font-weight:800;}" +
      ".aichat-comp-ov{position:fixed; inset:0; z-index:2147483600; display:flex; align-items:center; justify-content:center; padding:.8rem; background:rgba(8,8,12,.78); box-sizing:border-box;}" +
      ".aichat-comp-card{width:min(760px,96vw); max-height:88vh; overflow:hidden; display:flex; flex-direction:column; background:var(--dt-panel1,#16161d); color:var(--dt-fg,#eee); border:1px solid var(--dt-border,#4a4a58); border-radius:14px; box-shadow:0 18px 50px rgba(0,0,0,.8); font:13px/1.45 system-ui; text-align:left;}" +
      ".aichat-comp-h{padding:.7rem .9rem .5rem; border-bottom:1px solid var(--dt-border,#4a4a58);}" +
      ".aichat-comp-h .t{font-weight:800; color:var(--dt-accent,#9b6bff); font-size:1rem;}" +
      ".aichat-comp-h .s{font-size:.72rem; opacity:.7;}" +
      ".aichat-comp-grid{flex:1; min-height:0; overflow-y:auto; display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:.6rem; padding:.8rem .9rem;}" +
      ".aichat-comp-cell{position:relative; display:flex; flex-direction:column; align-items:stretch; gap:0; padding:0; overflow:hidden; border:1px solid var(--dt-border,#4a4a58); border-radius:12px; background:var(--dt-panel2,#101016); color:var(--dt-fg,#e9e6f2); cursor:pointer; font:inherit;}" +
      ".aichat-comp-cell:hover{border-color:var(--dt-accent,#7a5cd6);}" +
      ".aichat-comp-cell .ph{width:100%; height:150px; object-fit:cover; display:block; background:#0a0a0f;}" +
      ".aichat-comp-cell .nm{font-weight:800; font-size:.85rem; text-align:center; padding:.45rem .5rem 0;}" +
      ".aichat-comp-cell .ds{font-size:.68rem; opacity:.7; text-align:center; line-height:1.35; padding:.1rem .5rem .55rem;}" +
      ".aichat-comp-cell.mk{border-style:dashed; justify-content:center; align-items:center; min-height:12rem; gap:.3rem;}" +
      ".aichat-comp-cell.mk .plus{font-size:1.6rem; color:var(--dt-accent,#9b6bff);}" +
      ".aichat-comp-cell .cpin{position:absolute; top:.4rem; right:.4rem; width:1.8rem; height:1.8rem; display:flex; align-items:center; justify-content:center; border-radius:50%; border:0; background:rgba(10,10,14,.45); cursor:pointer; font-size:1rem;}" +
      ".aichat-comp-cell .del{position:absolute; top:.4rem; left:.4rem; width:1.8rem; height:1.8rem; display:flex; align-items:center; justify-content:center; border-radius:50%; border:1px solid #7d3a48; background:rgba(42,16,24,.8); color:#ffb3c0; cursor:pointer; font-size:.75rem;}" +
      ".aichat-comp-f{display:flex; justify-content:flex-end; padding:.6rem .9rem; border-top:1px solid var(--dt-border,#4a4a58);}" +
      ".aichat-comp-done{border:1px solid var(--dt-accent,#7a5cd6); background:linear-gradient(180deg,#3a2f57,#201830); color:#e6dcff; border-radius:9px; padding:.4rem .9rem; cursor:pointer; font:inherit; font-weight:800;}" +
      ".aichat-cf-ov{position:fixed; inset:0; z-index:2147483610; display:flex; align-items:center; justify-content:center; padding:.8rem; background:rgba(8,8,12,.8); box-sizing:border-box;}" +
      ".aichat-cf-card{width:min(420px,94vw); background:var(--dt-panel1,#16161d); color:var(--dt-fg,#eee); border:1px solid var(--dt-border,#4a4a58); border-radius:12px; padding:.9rem; font:13px/1.45 system-ui; text-align:left;}" +
      ".aichat-cf-t{font-weight:800; font-size:.95rem; margin-bottom:.3rem;}" +
      ".aichat-cf-x{font-size:.8rem; opacity:.75; margin-bottom:.7rem;}" +
      ".aichat-cf-f{display:flex; gap:.5rem; justify-content:flex-end;}" +
      ".aichat-cf-btn{border:1px solid var(--dt-border,#4a4a58); background:linear-gradient(145deg,#2a2a33,#17171c); color:var(--dt-fg,#ddd); border-radius:9px; padding:.4rem .9rem; cursor:pointer; font:inherit; font-weight:700;}" +
      ".aichat-cf-btn.danger{border-color:#7d3a48; background:#2a1018; color:#ffb3c0;}" +
      "@media (max-width:700px){" +
        ".aichat-wrap{flex-direction:column; height:auto;}" +
        ".aichat-roster{flex:0 0 auto; max-width:none; height:auto; max-height:32vh; flex-direction:row; overflow-x:auto; gap:.4rem; padding-bottom:.3rem;}" +
        ".aichat-grp{display:none;}" +
        ".aichat-roster>.aichat-settings,.aichat-roster>.aichat-settings+.aichat-settings{margin:0 !important;}" +
        ".aichat-item{flex:0 0 auto; max-width:11rem;}" +
        ".aichat-item img{width:24px; height:24px;}" +
        ".aichat-pane{min-height:70vh;}" +
        ".aichat-comp-grid{grid-template-columns:repeat(auto-fill,minmax(128px,1fr));}" +
        ".aichat-comp-cell .ph{height:110px;}" +
      "}";
    document.head.appendChild(st);
  }

  function el(tag, cls, txt) { var d = document.createElement(tag); if (cls) d.className = cls; if (txt != null) d.textContent = txt; return d; }
  function toast(m) { try { if (window.dragonToast) window.dragonToast(m); } catch (e) {} }

  // Display name/avatar/tagline with identity-card overrides applied.
  function dispBot(b) {
    var dn = b.name, da = b.avatar, dt = b.tagline || "";
    try {
      var SC = window.dragonAiChatSettings;
      if (SC) { var cc = SC._internals.card(b.id); if (cc) { if (cc.name) dn = cc.name; if (cc.tagline) dt = cc.tagline; if (cc.avatar) da = cc.avatar; } }
    } catch (e) {}
    return { name: dn, avatar: da, tagline: dt };
  }

  // Generic confirm dialog. o = {title, text, ok, onOk}.
  function confirmDlg(o) {
    o = o || {};
    try { var prev = document.querySelector(".aichat-cf-ov"); if (prev) prev.remove(); } catch (e) {}
    var ov = el("div", "aichat-cf-ov");
    var card = el("div", "aichat-cf-card");
    card.appendChild(el("div", "aichat-cf-t", o.title || "Are you sure?"));
    if (o.text) card.appendChild(el("div", "aichat-cf-x", o.text));
    var row = el("div", "aichat-cf-f");
    var no = el("button", "aichat-cf-btn", "Cancel"); no.type = "button";
    no.onclick = function () { ov.remove(); };
    var yes = el("button", "aichat-cf-btn danger", o.ok || "Delete"); yes.type = "button";
    yes.onclick = function () { ov.remove(); try { o.onOk && o.onOk(); } catch (e) {} };
    row.append(no, yes);
    card.appendChild(row);
    ov.appendChild(card);
    ov.addEventListener("mousedown", function (e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
    try { no.focus(); } catch (e) {}
  }

  // Pinned threads first (oldest pin on top), then the rest in creation order.
  function sortThreads(ts) {
    return ts.slice().sort(function (a, b) {
      var ap = a.pin ? 1 : 0, bp = b.pin ? 1 : 0;
      if (ap !== bp) return bp - ap;
      if (ap && bp) return (a.pin || 0) - (b.pin || 0);
      return (a.created || 0) - (b.created || 0);
    });
  }

  // ===== left list: open chat threads only ==================================
  function paintRoster(roster) {
    var a = AI();
    if (!a || !roster) return;
    a.loadThreads().then(function (ts) { buildRoster(roster, ts || []); });
  }

  function buildRoster(roster, threads) {
    var a = AI();
    roster.innerHTML = "";
    var st = el("button", "aichat-item aichat-settings", "⚙️ General Settings");
    st.type = "button";
    st.title = "General settings for every companion";
    st.onclick = function () { try { if (window.dragonAiChatSettings) window.dragonAiChatSettings.openGeneral(); } catch (e) {} };
    roster.appendChild(st);
    var cp = el("button", "aichat-item aichat-settings", "👥 Companions");
    cp.type = "button";
    cp.title = "Browse companions and start a chat";
    cp.onclick = function () { openCompanions(roster); };
    roster.appendChild(cp);
    roster.appendChild(el("div", "aichat-grp", "💬 Chats"));
    sortThreads(threads).forEach(function (t) {
      var b = a.info(t.bot);
      if (!b) return;
      var d = dispBot(b);
      var btn = el("button", "aichat-item" + (state.tid === t.tid ? " sel" : ""));
      btn.type = "button";
      if (d.tagline) btn.title = d.tagline; // taglines live in the tooltip now, not under names
      var im = document.createElement("img"); im.src = d.avatar; im.alt = "";
      btn.appendChild(im);
      var tx = el("div", "tx");
      tx.appendChild(el("div", "lb", d.name));
      var th = el("span", "th", t.title || "#Thread");
      th.contentEditable = "true"; th.spellcheck = false; th.title = "Click to rename this chat";
      th.addEventListener("mousedown", function (e) { e.stopPropagation(); });
      th.addEventListener("click", function (e) { e.stopPropagation(); });
      th.addEventListener("keydown", function (e) {
        e.stopPropagation();
        if (e.key === "Enter") { e.preventDefault(); try { th.blur(); } catch (x) {} }
      });
      th.addEventListener("blur", function () {
        var v = th.textContent.trim().slice(0, 40) || "#Thread";
        if (v !== t.title) { t.title = v; a.renameThread(t.tid, v).catch(function () {}); }
        if (th.textContent !== v) th.textContent = v;
      });
      tx.appendChild(th);
      btn.appendChild(tx);
      var pin = el("button", "pin" + (t.pin ? " on" : ""), t.pin ? "💗" : "🤍"); pin.type = "button";
      pin.title = t.pin ? "Unpin this chat" : "Pin this chat to the top";
      pin.onclick = function (e) {
        e.stopPropagation();
        a.pinThread(t.tid, !t.pin).then(function (next) { buildRoster(roster, next || []); });
      };
      btn.appendChild(pin);
      var rm = el("button", "rm", "✖"); rm.type = "button"; rm.title = "Close and delete this chat";
      rm.onclick = function (e) {
        e.stopPropagation();
        confirmDlg({
          title: "Close this chat?",
          text: "The conversation with " + d.name + " (" + (t.title || "#Thread") + ") will be permanently deleted.",
          ok: "Delete",
          onOk: function () {
            a.closeThread(t.tid).then(function (next) {
              next = next || [];
              if (state.tid === t.tid) {
                state.tid = null;
                if (next.length) mountSelected(nextThreadPick(next));
                else ensureDexa(function (dtid) { mountSelected(dtid); paintRoster(roster); });
              } else paintRoster(roster);
            });
          }
        });
      };
      btn.appendChild(rm);
      btn.onclick = function () { if (state.tid !== t.tid) mountSelected(t.tid); };
      roster.appendChild(btn);
    });
  }

  // Dexa is ALWAYS the default view: pick her newest thread, or open one.
  function nextThreadPick(ts) {
    var dexs = ts.filter(function (t) { return t.bot === "dexa"; });
    if (dexs.length) {
      dexs.sort(function (a, b) { return (b.created || 0) - (a.created || 0); });
      return dexs[0].tid;
    }
    return sortThreads(ts)[0].tid;
  }
  function ensureDexa(cb) {
    var a = AI();
    if (!a) return;
    a.loadThreads().then(function (ts) {
      ts = ts || [];
      for (var i = 0; i < ts.length; i++) if (ts[i].bot === "dexa") { cb(ts[i].tid); return; }
      a.ensureThread("dexa").then(function (t) { cb(t ? t.tid : null); });
    });
  }

  function emptyPane() {
    var pane = document.querySelector("#dragonSocialPage .aichat-pane");
    if (!pane) return;
    if (state.handle) { try { state.handle.destroy(); } catch (e) {} state.handle = null; }
    pane.innerHTML = "";
    var box = el("div", "aichat-empty");
    box.appendChild(el("div", "aichat-empty-t", "No open chats"));
    box.appendChild(el("div", "aichat-empty-s", "Pick a companion to start talking."));
    var b = el("button", "aichat-empty-b", "👥 Choose a companion"); b.type = "button";
    b.onclick = function () { var r = document.querySelector("#dragonSocialPage .aichat-roster"); openCompanions(r); };
    box.appendChild(b);
    pane.appendChild(box);
  }

  // Mount a thread by tid; unknown tids fall back (legacy bot id -> open, else Dexa).
  function select(tid) {
    var a = AI();
    if (!a || !tid) return;
    a.loadThreads().then(function (ts) {
      ts = ts || [];
      for (var i = 0; i < ts.length; i++) if (ts[i].tid === tid) { mountSelected(tid); return; }
      if (a.info(tid)) { // legacy: a bare bot id with no thread yet
        a.openThread(tid).then(function (t) { if (t) mountSelected(t.tid); else ensureDexa(mountSelected); });
        return;
      }
      ensureDexa(mountSelected);
    });
  }

  function mountSelected(tid) {
    var a = AI();
    if (!a || !tid) return;
    fitChatHeight();
    var th = null;
    try { th = a.thread ? a.thread(tid) : null; } catch (e) {}
    var botId = (th && th.bot) || (a.info(tid) ? tid : "dexa");
    var nm = "them";
    try { var bi = a.info(botId); if (bi) nm = dispBot(bi).name; } catch (e2) {}
    state.tid = tid;
    rememberTid(tid);
    var pane = document.querySelector("#dragonSocialPage .aichat-pane");
    if (pane) {
      if (state.handle) { try { state.handle.destroy(); } catch (e) {} state.handle = null; }
      state.handle = a.mountInto(pane, tid, { placeholder: "Write to " + nm + "…" });
    }
    var roster = document.querySelector("#dragonSocialPage .aichat-roster");
    if (roster) paintRoster(roster);
  }

  // ===== Companions window: cards with face + short features =================
  function openCompanions(roster) {
    var a = AI();
    if (!a) { toast("AI chat is still loading — try again in a moment"); return; }
    css();
    try { var old = document.querySelector(".aichat-comp-ov"); if (old) old.remove(); } catch (e) {}
    var ov = el("div", "aichat-comp-ov");
    var card = el("div", "aichat-comp-card");
    var h = el("div", "aichat-comp-h");
    h.appendChild(el("div", "t", "👥 Companions"));
    h.appendChild(el("div", "s", "Pick one to start chatting — every pick opens a fresh thread in your chat list."));
    card.appendChild(h);
    var grid = el("div", "aichat-comp-grid");
    card.appendChild(grid);
    var foot = el("div", "aichat-comp-f");
    var done = el("button", "aichat-comp-done", "Done"); done.type = "button";
    done.onclick = function () { ov.remove(); };
    foot.appendChild(done);
    card.appendChild(foot);
    ov.appendChild(card);
    ov.addEventListener("mousedown", function (e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
    buildCompGrid(grid, ov, roster);
  }

  function buildCompGrid(grid, ov, roster) {
    var a = AI();
    if (!a) return;
    Promise.all([Promise.resolve(a.list()), a.loadCompPins().catch(function () { return []; })]).then(function (r) {
      var bots = r[0] || [], pins = r[1] || [];
      grid.innerHTML = "";
      var ordered = bots.slice().sort(function (x, y) {
        var xi = pins.indexOf(x.id), yi = pins.indexOf(y.id);
        if ((xi !== -1) !== (yi !== -1)) return xi !== -1 ? -1 : 1;
        if (xi !== -1 && yi !== -1) return xi - yi;
        return 0; // keep authored order otherwise
      });
      ordered.forEach(function (b) {
        var d = dispBot(b);
        var pinned = pins.indexOf(b.id) !== -1;
        var cell = el("button", "aichat-comp-cell"); cell.type = "button";
        if (d.tagline) cell.title = d.tagline;
        var im = document.createElement("img"); im.className = "ph"; im.src = d.avatar; im.alt = "";
        cell.appendChild(im);
        cell.appendChild(el("div", "nm", d.name));
        if (d.tagline) cell.appendChild(el("div", "ds", d.tagline));
        var hp = el("button", "cpin" + (pinned ? " on" : ""), pinned ? "💗" : "🤍"); hp.type = "button";
        hp.title = pinned ? "Unpin from the top" : "Pin to the top of the list";
        hp.onclick = function (e) {
          e.stopPropagation();
          a.toggleCompPin(b.id).then(function () { buildCompGrid(grid, ov, roster); });
        };
        cell.appendChild(hp);
        if (b.custom) {
          var del = el("button", "del", "✖"); del.type = "button"; del.title = "Delete this companion";
          del.onclick = function (e) {
            e.stopPropagation();
            confirmDlg({
              title: "Delete " + d.name + "?",
              text: "The companion and its chats will be gone.",
              ok: "Delete",
              onOk: function () {
                a.removeCustom(b.id).then(function () {
                  return a.loadThreads().then(function (ts) {
                    var jobs = (ts || []).filter(function (t) { return t.bot === b.id; }).map(function (t) { return a.closeThread(t.tid); });
                    return Promise.all(jobs);
                  });
                }).then(function () {
                  if (roster) paintRoster(roster);
                  a.loadThreads().then(function (ts) {
                    ts = ts || [];
                    var mine = state.tid && ts.some(function (t) { return t.tid === state.tid; });
                    if (!mine) {
                      state.tid = null;
                      if (ts.length) mountSelected(nextThreadPick(ts));
                      else ensureDexa(mountSelected);
                    }
                  });
                  buildCompGrid(grid, ov, roster);
                });
              }
            });
          };
          cell.appendChild(del);
        }
        // Every press opens a FRESH thread, even for a companion already chatting.
        cell.onclick = function () {
          a.openThread(b.id).then(function (t) {
            ov.remove();
            if (t) mountSelected(t.tid);
            else if (roster) paintRoster(roster);
          });
        };
        grid.appendChild(cell);
      });
      var mk = el("button", "aichat-comp-cell mk"); mk.type = "button";
      mk.appendChild(el("div", "plus", "＋"));
      mk.appendChild(el("div", "nm", "Create Companion"));
      mk.appendChild(el("div", "ds", "Design a brand-new companion"));
      mk.onclick = function () {
        try {
          if (window.dragonAiChatSettings && window.dragonAiChatSettings.openCreator) {
            window.dragonAiChatSettings.openCreator(function (newId) {
              if (roster) paintRoster(roster);
              ov.remove();
              if (newId) {
                a.openThread(newId).then(function (t) { if (t) mountSelected(t.tid); });
              }
            });
            return;
          }
        } catch (e) {}
        toast("General settings are still loading — try again in a moment");
      };
      grid.appendChild(mk);
    });
  }

  function mountAI() {
    var a = AI();
    if (!a) return;
    css();
    var page = document.getElementById("dragonSocialPage");
    if (!page) return;
    // The AI tab is live now — drop the "soon" badge the placeholder wore.
    try { page.querySelectorAll(".dragon-social-soon").forEach(function (s) { s.remove(); }); } catch (e) {}
    var card = page.querySelector(".dragon-social-card");
    if (!card || card.dataset.aichat === "1") {
      if (card && card.dataset.aichat === "1" && !state.tid) {
        ensureDexa(function (dtid) { if (dtid) mountSelected(dtid); });
      }
      return;
    }
    card.dataset.aichat = "1";
    card.innerHTML = "";
    var wrap = el("div", "aichat-wrap");
    var roster = el("div", "aichat-roster");
    var pane = el("div", "aichat-pane");
    wrap.append(roster, pane);
    card.appendChild(wrap);
    paintShellTheme();
    fitChatHeight();
    state.tid = null;
    a.loadCustoms().catch(function () {}).then(function () {
      ensureDexa(function (dtid) {
        paintRoster(roster);
        if (dtid) mountSelected(dtid);
        else emptyPane();
      });
    });
  }

  // Wrap the page builder so the AI surface lands whenever Social is (re)built.
  function wrap() {
    var orig = window.dragonBuildSocialPage;
    if (typeof orig !== "function" || orig.__aichatWrapped) return false;
    var fn = function () { orig(); try { mountAI(); } catch (e) {} };
    fn.__aichatWrapped = true;
    window.dragonBuildSocialPage = fn;
    return true;
  }

  if (!wrap()) {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (wrap() || tries > 40) clearInterval(iv);
      if (window.dragonBuildSocialPage && window.dragonBuildSocialPage.__aichatWrapped) {
        try { if (document.getElementById("dragonSocialPage")) mountAI(); } catch (e) {}
      }
    }, 40);
  } else {
    try { if (document.getElementById("dragonSocialPage")) mountAI(); } catch (e) {}
  }
  // NOTE: interval above was 250ms; tightened so the surface lands faster.

  // General theme on the page chrome: the roster + pane live under
  // #dragonSocialPage, so the GENERAL accent is set there. Per-companion
  // accents override it on their own session box (engine applyTheme).
  function paintShellTheme() {
    try {
      var S = window.dragonAiChatSettings;
      if (!S || !S.themeState) return;
      var st = S.themeState(null);
      var sp = document.getElementById("dragonSocialPage");
      if (!sp) return;
      if (st && st.accent) sp.style.setProperty("--dt-accent", st.accent);
      else sp.style.removeProperty("--dt-accent");
    } catch (e) {}
  }
  try { window.addEventListener("dragonAiTheme", paintShellTheme); } catch (e2) {}

  window.dragonAiChatShell = {
    select: select,
    openCompanions: openCompanions,
    repaint: function () {
      try {
        if (state.tid) mountSelected(state.tid);
        else { var r = document.querySelector("#dragonSocialPage .aichat-roster"); if (r) paintRoster(r); }
      } catch (e) {}
    }
  };
})();
