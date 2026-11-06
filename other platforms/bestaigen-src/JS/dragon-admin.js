/* ============================================================================
   BestAiGen — #closecodeadmin : the ADMIN PAGE (W-UI222)
   ----------------------------------------------------------------------------
   Egon 25.09.2026 (this file is the correction of the first attempt):
     • it is a PAGE, not a window — full-area, scrollable, its own header row,
       no centred dialog, no overlay card, nothing to "close" like a popup;
     • it asks for a USERNAME **and** a PASSWORD (one more layer than a single
       field, and the pair is what the server checks);
     • the lock is SERVER-SIDE. The browser never decides whether you may come
       in: the pair goes over the shared rpc socket to the server script
       (index.html, "ADMIN LOCK (W-UI222)"), which hashes it, compares it to the
       embedded hashes and remembers THAT connection. Every privileged handler
       re-checks the connection, so hiding UI is never the authorization.
     • no wall of explanatory text, no oversized password box, and nothing on
       screen hints at the shape or length of the credential.
   The page is reached ONLY by the address hash `#closecodeadmin`. It is NOT in
   the app's page router and never shows up in the navbar: the address is the
   door, and inside is a full page built to host a dashboard (site management,
   server-region management and the moderator layer will land here).
============================================================================ */
(function () {
  var HASH_NAME = "#closecodeadmin";
  var PAGE_ID = "dragonAdminPage";
  var open = null;          // { el, body, backHash, authed }
  var authKnown = null;     // last answer from the server about THIS connection
  var adminGalPageEl = null; // the hidden admin page element while gallery mode is on
  function exitAdminGallery() {
    try { window.__dragonAdminGallery = false; } catch (e) {}
    try { var _bb = document.getElementById("dragonAdminGalBack"); if (_bb) _bb.remove(); } catch (eBB2) {}
    try { if (window.dragonAdminGalChip) window.dragonAdminGalChip(false); } catch (e2) {}
    try {
      var bars = document.querySelectorAll('[data-admin-bar="1"]');
      for (var i = 0; i < bars.length; i++) {
        try { var b = bars[i].querySelector(".dragon-admin-bar"); if (b) b.remove(); } catch (eB) {}
        try { bars[i].removeAttribute("data-admin-bar"); } catch (eB2) {}
      }
    } catch (e3) {}
    try {
      if (adminGalPageEl && adminGalPageEl.isConnected) {
        adminGalPageEl.hidden = false;
        try { document.body.style.overflow = "hidden"; } catch (eO) {}
      } else if (window.dragonAdminOpen) window.dragonAdminOpen();
    } catch (e4) {}
    adminGalPageEl = null;
  }
  window.dragonAdminGalChip = function (show) {
    try {
      var old = document.getElementById("dragonAdminGalChip");
      if (old) old.remove();
      if (!show) return;
      var c = document.createElement("button");
      c.id = "dragonAdminGalChip"; c.type = "button";
      c.textContent = "🛡 Admin";
      c.title = "Back to the admin panel (leaves gallery mode)";
      c.style.cssText = "position:fixed;left:.5rem;bottom:.5rem;z-index:2147483646;padding:.45rem .8rem;border-radius:10px;border:1px solid #9b6bff;background:linear-gradient(180deg,#2b2140,#14101f);color:#e8e0ff;font-size:.78rem;font-weight:800;cursor:pointer;box-shadow:0 6px 22px rgba(0,0,0,.6);";
      c.onclick = function () { try { exitAdminGallery(); } catch (e) {} };
      document.body.appendChild(c);
    } catch (e) {}
  };
  var localTries = 0;       // cosmetic only — the real limiter lives on the server
  var adminTok = "";             // session token from dragonAdminLogin; attached to every privileged call
  var ADMIN_TOK_KEY = "dragonAdminTokV1";
  function adminTokSave() { try { if (/^[0-9a-f]{32}$/.test(adminTok)) localStorage.setItem(ADMIN_TOK_KEY, adminTok); } catch (e) {} }
  function adminTokClear() { try { localStorage.removeItem(ADMIN_TOK_KEY); } catch (e) {} }
  function adminTokLoad() { try { var t = String(localStorage.getItem(ADMIN_TOK_KEY) || ""); if (/^[0-9a-f]{32}$/.test(t)) return t; } catch (e) {} return ""; }
  function atok(data) {
    var o = null;
    try { o = data ? JSON.parse(data) : {}; } catch (e) { o = {}; }
    if (!o || typeof o !== "object") o = {};
    if (adminTok) o.tok = adminTok;
    return JSON.stringify(o);
  }
  function arpc(method, data, tries) {
    var left = (tries == null ? 2 : tries);
    function info() { try { return window.dragonSharedSocketInfo ? window.dragonSharedSocketInfo() : null; } catch (e) { return null; } }
    function attempt(n) {
      // Every admin call is idempotent (ban to=1/0, report set to 2/3, reads, independent logins), so a
      // transport-level retry is safe — it can never double-apply. Fail fast while the backoff is long.
      var si = info();
      if (si && si.downMs > 6000) return Promise.reject(new Error("server restarting — retry in " + Math.max(1, Math.ceil(si.downMs / 1000)) + "s"));
      return window.dragonServerRpc(method, atok(data)).then(function (raw) {
        // The server forgot our session (a restart/hibernation wiped it before durable sessions
        // existed): drop back to the sign-in form instead of failing every button one by one.
        try {
          var d = JSON.parse(raw);
          if (d && d.err === "unauthorized" && open && open.authed) wentUnauth();
        } catch (eP) {}
        return raw;
      }, function (e) {
        if (n + 1 >= left) throw e;
        return new Promise(function (res, rej) { setTimeout(function () { attempt(n + 1).then(res, rej); }, 1200); });
      });
    }
    return attempt(0);
  }
  try { window.dragonAdminRpc = arpc; } catch (eAR) {}

  // The server no longer knows this session (expired or signed out elsewhere): clear the token and show
  // the sign-in form at once, so the next attempt starts from login instead of failing button by button.
  function wentUnauth() {
    adminTok = "";
    adminTokClear();
    authKnown = false;
    try { if (open) { open.authed = false; renderInto(open); } } catch (e) {}
    try { if (window.dragonToast) window.dragonToast("Admin session expired — please sign in again."); } catch (e2) {}
  }

  function say(m) { try { console.warn("dragon-admin: " + m); } catch (e) {} }
  function el(tag, cls, txt) { var d = document.createElement(tag); if (cls) d.className = cls; if (txt != null) d.textContent = txt; return d; }
  function visible() {
    try { if (document.visibilityState && document.visibilityState !== "visible") return false; } catch (e) {}
    return true;
  }

  // ---- the page surface --------------------------------------------------------------------------------
  function ensureCss() {
    try { if (window.dragonUIEnsureCss) window.dragonUIEnsureCss(); } catch (e) {}
    if (document.getElementById("dragonAdminCss")) return;
    var st = document.createElement("style");
    st.id = "dragonAdminCss";
    st.textContent = [
      // A page: it owns the whole viewport, scrolls, and is painted from the theme tokens so it follows
      // whatever theme the visitor picked (I113-a). Radii are 8-12px — the generator has no sharp corners.
      "#" + PAGE_ID + "{position:fixed;inset:0;z-index:2147483000;overflow:auto;box-sizing:border-box;text-align:left;" +
        "background:var(--dt-bg,#131516);color:var(--dt-fg,#eee);font-family:system-ui,sans-serif;}",
      "#" + PAGE_ID + " .da-wrap{max-width:1100px;margin:0 auto;padding:.9rem .95rem 4rem;}",
      "#" + PAGE_ID + " .da-head{display:flex;align-items:center;gap:.45rem;flex-wrap:wrap;padding:0 0 .7rem;" +
        "margin:0 0 .9rem;border-bottom:1px solid var(--dt-border,#4a4a58);}",
      "#" + PAGE_ID + " .da-title{flex:1 1 auto;font-weight:800;font-size:1.05rem;letter-spacing:.01em;color:var(--dt-accent,#9b6bff);}",
      "#" + PAGE_ID + " .da-btn{display:inline-flex;align-items:center;justify-content:center;height:34px;box-sizing:border-box;" +
        "padding:0 .85rem;font-size:.72rem;font-weight:700;letter-spacing:.01em;white-space:nowrap;border-radius:9px;cursor:pointer;" +
        "border:1px solid var(--dt-chipbd,#5a5a6a);background:linear-gradient(180deg,var(--dt-btn1,#1a1a20),var(--dt-btn2,#4a4a55));" +
        "color:var(--dt-fg,#eee);}",
      "#" + PAGE_ID + " .da-btn:hover{border-color:var(--dt-accent,#9b6bff);}",
      "#" + PAGE_ID + " .da-btn.is-primary{border-color:var(--dt-accent,#9b6bff);color:#fff;}",
      "#" + PAGE_ID + " .da-btn[disabled]{opacity:.55;cursor:default;}",
      "#" + PAGE_ID + " .da-form{max-width:26rem;margin:9vh auto 0;border:1px solid var(--dt-border,#4a4a58);border-radius:12px;" +
        "background:var(--dt-panel1,#0e0e12);padding:.85rem .9rem;box-sizing:border-box;}",
      "#" + PAGE_ID + " .da-field{margin:0 0 .6rem;}",
      "#" + PAGE_ID + " .da-lbl{display:block;font-size:.72rem;opacity:.75;margin:0 0 .25rem;}",
      "#" + PAGE_ID + " .da-input{width:100%;box-sizing:border-box;height:34px;border-radius:9px;padding:0 .6rem;font-size:.85rem;outline:none;" +
        "border:1px solid var(--dt-border,#4a4a58);background:var(--dt-panel1,#0e0e12);color:var(--dt-fg,#eee);}",
      "#" + PAGE_ID + " .da-input:focus{border-color:var(--dt-accent,#9b6bff);box-shadow:0 0 0 2px rgba(155,107,255,.22);}",
      "#" + PAGE_ID + " .da-msg{font-size:.76rem;min-height:1.1em;margin:.5rem 0 .1rem;color:#ff9aa5;}",
      "#" + PAGE_ID + " .da-msg.is-ok{color:#8aff9e;}",
      "#" + PAGE_ID + " .da-note{font-size:.72rem;opacity:.72;margin:.25rem 0 .65rem;}",
      "#" + PAGE_ID + " .da-row{display:flex;align-items:center;gap:.45rem;flex-wrap:wrap;margin:0 0 .6rem;}",
      "#" + PAGE_ID + " .dg-admin-kpis{display:flex;flex-wrap:wrap;gap:.4rem;margin:.15rem 0 .75rem;}",
      "#" + PAGE_ID + " .dg-kpi{min-width:7.2rem;border:1px solid var(--dt-border,#4a4a58);border-radius:10px;" +
        "background:var(--dt-panel1,#0e0e12);padding:.45rem .6rem;}",
      "#" + PAGE_ID + " .dg-kpi-n{font-size:1.05rem;font-weight:800;color:var(--dt-accent,#9b6bff);line-height:1.1;}",
      "#" + PAGE_ID + " .dg-kpi-l{font-size:.68rem;opacity:.72;margin-top:.15rem;}",
      "#" + PAGE_ID + " .dg-admin-block{border:1px solid var(--dt-border,#4a4a58);border-radius:12px;" +
        "background:var(--dt-panel1,#0e0e12);padding:.6rem .65rem;margin:0 0 .6rem;}",
      "#" + PAGE_ID + " .dg-admin-block h4{margin:0 0 .45rem;font-size:.82rem;font-weight:800;color:var(--dt-accent,#9b6bff);}",
      "#" + PAGE_ID + " .dg-admin-t{width:100%;border-collapse:collapse;font-size:.78rem;}",
      "#" + PAGE_ID + " .dg-admin-t th,#" + PAGE_ID + " .dg-admin-t td{border-bottom:1px solid var(--dt-border,#4a4a58);" +
        "padding:.26rem .45rem;text-align:left;vertical-align:top;}",
      "#" + PAGE_ID + " .dg-admin-t th{font-size:.7rem;font-weight:700;opacity:.75;text-transform:uppercase;letter-spacing:.03em;}",
      "#" + PAGE_ID + " .dg-admin-t td.n{text-align:right;white-space:nowrap;font-weight:700;color:var(--dt-chiponbd,#ffd76a);}",
      "#" + PAGE_ID + " .dg-admin-t td.p{text-align:right;white-space:nowrap;color:var(--dt-accent,#9b6bff);}",
      "#" + PAGE_ID + " .dg-admin-bar{display:inline-block;height:7px;border-radius:4px;min-width:2px;vertical-align:middle;" +
        "background:linear-gradient(90deg,var(--dt-accent,#9b6bff),var(--dt-chiponbd,#ffd76a));}",
      "#" + PAGE_ID + " .dg-admin-empty{font-size:.8rem;opacity:.8;padding:.4rem 0;}",
      "#" + PAGE_ID + " .dg-admin-note{font-size:.72rem;opacity:.72;margin:.3rem 0 .6rem;}",
      "@media (max-width:520px){#" + PAGE_ID + " .da-wrap{padding:.7rem .6rem 3rem;}}"
    ].join("\n");
    (document.head || document.documentElement).appendChild(st);
  }

  function buildPage() {
    ensureCss();
    var page = el("div", "da-page");
    page.id = PAGE_ID;
    var wrap = el("div", "da-wrap");
    var head = el("div", "da-head");
    var title = el("div", "da-title", "\uD83D\uDC51 Admin");
    var back = el("button", "da-btn", "\u2190 Back");
    back.type = "button";
    back.onclick = function () { close(); };
    head.append(title, back);
    var body = el("div", null);
    wrap.append(head, body);
    page.appendChild(wrap);
    document.body.appendChild(page);
    var o = { el: page, body: body, head: head, backHash: "", authed: false, onKey: null };
    o.onKey = function (e) { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    document.addEventListener("keydown", o.onKey, true);
    open = o;
    return o;
  }

  function addLogout(o) {
    if (o.el.querySelector("[data-dragon-admin-logout]")) return;
    var b = el("button", "da-btn", "Log Out");
    b.type = "button";
    b.setAttribute("data-dragon-admin-logout", "1");
    b.onclick = async function () {
      try { await arpc("dragonAdminLogout", ""); } catch (e) {}
      adminTok = "";
      adminTokClear();
      authKnown = false;
      if (o) { o.authed = false; }
      renderInto(o);
    };
    o.head.appendChild(b);
  }

  // ---- the credential form -----------------------------------------------------------------------------
  function renderInto(o) {
    o.body.textContent = "";
    var oldLogout = o.el.querySelector("[data-dragon-admin-logout]");
    if (oldLogout) oldLogout.remove();
    if (o.authed) { addLogout(o); buildNav(o); buildServerData(o); } else { buildLogin(o); }
  }

  function buildLogin(o) {
    var form = el("div", "da-form");
    var uField = el("div", "da-field");
    uField.appendChild(el("label", "da-lbl", "Username"));
    var uInp = el("input", "da-input");
    uInp.type = "text";
    uInp.setAttribute("data-dragon-admin-user", "1");
    uInp.autocomplete = "off";
    uInp.spellcheck = false;
    uField.appendChild(uInp);
    var pField = el("div", "da-field");
    pField.appendChild(el("label", "da-lbl", "Password"));
    var pInp = el("input", "da-input");
    // Deliberately NOT `type="password"`: a native password input makes the browser offer to save/autofill
    // the credential on every sign-in attempt. A masked text field looks and reads the same, keeps the
    // caret behaviour, and never triggers the password manager.
    var canMask = false;
    try { canMask = ("webkitTextSecurity" in pInp.style); } catch (e) { canMask = false; }
    if (canMask) { pInp.type = "text"; pInp.style.webkitTextSecurity = "disc"; }
    else { pInp.type = "password"; }
    pInp.setAttribute("data-dragon-admin-pw", "1");
    pInp.autocomplete = "off";
    pField.appendChild(pInp);
    var row = el("div", "da-row");
    var go = el("button", "da-btn is-primary", "Sign In");
    go.type = "button";
    go.setAttribute("data-dragon-admin-signin", "1");
    row.appendChild(go);
    var rmRow = el("div", "da-row");
    var rmBox = document.createElement("input");
    rmBox.type = "checkbox";
    rmBox.checked = true;
    rmBox.setAttribute("data-dragon-admin-remember", "1");
    rmBox.style.cssText = "width:1rem;height:1rem;accent-color:#9b6bff;cursor:pointer;";
    var rmLab = el("label", "da-note", "Beni hatırla (şifre değil, süreli oturum anahtarı saklanır)");
    rmLab.style.cssText = "cursor:pointer;margin:0;";
    rmLab.appendChild(document.createTextNode(" "));
    rmRow.append(rmBox, rmLab);
    try { rmLab.onclick = function () { rmBox.checked = !rmBox.checked; }; } catch (eL) {}
    var msg = el("div", "da-msg", "");
    msg.setAttribute("data-dragon-admin-msg", "1");
    form.append(uField, pField, row, rmRow, msg);
    o.body.appendChild(form);

    function note(t, ok) { msg.textContent = t || ""; msg.className = "da-msg" + (ok ? " is-ok" : ""); }

    // `synthetic` = a check-up attempt: it runs the REAL credential check but never touches the fields
    // (no focus, no clearing), so a sweep cannot disturb whatever the admin typed.
    async function doAttempt(u, p, synthetic) {
      u = String(u == null ? "" : u).trim();
      p = String(p == null ? "" : p);
      if (!u || !p) { note("Both fields are required."); return { ok: false, msg: msg.textContent }; }
      if (typeof window.dragonServerRpc !== "function") { note("The server link is not available here."); return { ok: false, msg: msg.textContent }; }
      go.disabled = true;
      var raw = null, lastErr = "";
      for (var att = 0; att < 3 && raw === null; att++) {
        try {
          var siA = window.dragonSharedSocketInfo ? window.dragonSharedSocketInfo() : null;
          if (siA && siA.downMs > 0) {
            var clA = false;
            try { clA = window.dragonSharedSocketReset ? !!window.dragonSharedSocketReset() : false; } catch (eCA) {}
            if (!clA) { lastErr = "server backoff (" + (siA.why || "wait") + ", " + Math.max(1, Math.ceil(siA.downMs / 1000)) + "s left)"; break; }
          }
        } catch (eSA) {}
        if (att > 0) {
          note("connecting… (try " + (att + 1) + "/3)", true);
          await new Promise(function (r) { setTimeout(r, 2000 * att); });
        } else note("checking\u2026", true);
        try { raw = await window.dragonServerRpc("dragonAdminLogin", JSON.stringify({ u: u, p: p })); }
        catch (eR) { raw = null; try { lastErr = String((eR && eR.message) || eR).slice(0, 80); } catch (eE) { lastErr = ""; } }
      }
      var rpcDown = (raw === null);
      go.disabled = false;
      var data = null;
      try { data = JSON.parse(raw); } catch (e) { data = null; }
     if (!data || data.ok !== true) {
       localTries++;
        // Egon 29.10.2026 (A1, fail-closed) — a refused pair marks THIS page: a later
        // background state poll may still report an authed connection (the owner's own
        // remembered session), but this page must never silently unlock after a refusal.
        try { o.failedAttempts = (o.failedAttempts || 0) + 1; say("pair refused (" + (synthetic ? "check-up" : "typed") + ")" + (data && data.err ? " err=" + data.err : (rpcDown ? " (server unreachable)" : "")) + " — this page will not auto-unlock afterwards"); } catch (eFA) {}
       var why = rpcDown ? ("Server unreachable" + (lastErr ? " (" + lastErr + ")" : "") + " \u2014 try again.") : (data && data.err === "locked" ? "Too many attempts. Try again later." : "Wrong credentials.");
        note(why);
        if (!synthetic) { try { pInp.value = ""; pInp.focus(); } catch (e) {} }
        return { ok: false, msg: msg.textContent };
      }
      localTries = 0;
      try { if (data && data.tok) adminTok = String(data.tok); } catch (eT) {}
      try { if (rmBox && rmBox.checked) adminTokSave(); else adminTokClear(); } catch (eR) {}
      authKnown = true;
      o.authed = true;
      renderInto(o);
      return { ok: true, msg: msg.textContent };
    }
    function attempt() { return doAttempt(uInp.value, pInp.value, false); }
    o.attempt = doAttempt;
    go.onclick = function () { attempt(); };
    uInp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); pInp.focus(); } });
    pInp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); attempt(); } });
    try { uInp.focus(); } catch (e) {}
  }

  // ---- the report --------------------------------------------------------------------------------------
  function fmtPct(n, of) { if (!of) return "0%"; return (Math.round((n / of) * 1000) / 10) + "%"; }
  function kpi(label, value) {
    var k = el("div", "dg-kpi");
    k.appendChild(el("div", "dg-kpi-n", String(value)));
    k.appendChild(el("div", "dg-kpi-l", label));
    return k;
  }
  function fmtBytes(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + " B";
    var u = ["KiB", "MiB", "GiB", "TiB"], i = -1;
    do { n = n / 1024; i++; } while (n >= 1024 && i < u.length - 1);
    return (Math.round(n * 10) / 10).toLocaleString(undefined, { maximumFractionDigits: 1 }) + " " + u[i];
  }
  function fmtInt(n) { n = Number(n) || 0; return n.toLocaleString(); }
  function section(title, note) {
    var b = el("div", "dg-admin-block");
    b.appendChild(el("h4", null, title));
    if (note) b.appendChild(el("div", "dg-admin-note", note));
    return b;
  }
  function fillCell(used, size) {
    var td = el("td", "p");
    var pct = size ? Math.round((used / size) * 1000) / 10 : 0;
    var bar = el("span", "dg-admin-bar");
    bar.style.width = Math.max(2, Math.round(Math.min(1, size ? used / size : 0) * 70)) + "px";
    td.appendChild(bar);
    td.appendChild(document.createTextNode("  " + pct + "%"));
    return td;
  }

  // ---- 🖥 SERVER DATA: the admin DASHBOARD (Egon, 25.09.2026) -------------------------------------------
  // #closecodeadmin now lands on THIS, not on the popups report. Everything an admin needs in one page: the
  // durable 50 MiB state with EVERY region's occupancy and free space, the durable counters, the src/ asset
  // tree measured against the platform quota, and the live payload. One read-only RPC (dragonServerData) plus
  // one static manifest — nothing here writes, polls, or does expensive work; the panel is built only when an
  // admin opens the page, and every number it shows comes from a pointer or a file size, never from a scan.
  function buildNav(o) {
    var row = el("div", "da-row");
    row.setAttribute("data-dragon-admin-nav", "1");
    var sd = el("button", "da-btn is-primary", "\uD83D\uDDA5 Server Data");
    sd.type = "button";
    sd.setAttribute("data-dragon-admin-tab", "data");
    var pz = el("button", "da-btn", "\uD83D\uDCE3 Popups");
    pz.type = "button";
    pz.setAttribute("data-dragon-admin-tab", "popups");
    pz.onclick = function () { window.dragonAdminPopupsWindow(); };
    // 📋 W-UI313 / W-UI314: the two record panels (feedback + open work items), each its own window.
    var fb = el("button", "da-btn", "\uD83D\uDCCB Feedback");
    fb.type = "button";
    fb.setAttribute("data-dragon-admin-tab", "feed");
    fb.onclick = function () { window.dragonAdminFeedbackWindow(); };
    var wl = el("button", "da-btn", "\uD83D\uDCCB Work list");
    wl.type = "button";
    wl.setAttribute("data-dragon-admin-tab", "work");
    wl.onclick = function () { window.dragonAdminWorklistWindow(); };
    var pk = el("button", "da-btn", "\uD83D\uDCE6 Packages");
    pk.type = "button";
    pk.setAttribute("data-dragon-admin-tab", "packages");
    pk.onclick = function () { window.dragonAdminPackagesWindow(); };
    var rp = el("button", "da-btn", "\uD83D\uDEE1 BAN");
    rp.type = "button";
    rp.setAttribute("data-dragon-admin-tab", "reports");
    rp.onclick = function () { window.dragonAdminReportsWindow(); };
    var rf = el("button", "da-btn", "\u21BB Refresh");
    rf.type = "button";
    rf.setAttribute("data-dragon-admin-refresh", "1");
    rf.onclick = function () { renderInto(o); };
    var lk = el("button", "da-btn", "Liked");
    lk.type = "button";
    lk.setAttribute("data-dragon-admin-tab", "liked");
    lk.onclick = function () { window.dragonAdminLikedWindow(); };
    var iw = el("button", "da-btn", "\uD83D\uDD0D Inspect");
    iw.type = "button";
    iw.setAttribute("data-dragon-admin-tab", "inspect");
    iw.onclick = function () { window.dragonAdminInspectWindow(); };
    var gm = el("button", "da-btn", "\uD83C\uDFC1 Games");
    gm.type = "button";
    gm.setAttribute("data-dragon-admin-tab", "games");
    gm.onclick = function () { window.dragonAdminGamesWindow(); };
    row.append(sd, pz, fb, wl, pk, rp, lk, iw, gm, rf);
    o.body.appendChild(row);
    return row;
  }
  function buildServerData(o, fake, fakeManifest) {
    var host = el("div", null);
    host.setAttribute("data-dragon-admin-data", "1");
    var kpis = el("div", "dg-admin-kpis");
    host.appendChild(kpis);
    var body = el("div", null);
    host.appendChild(body);
    o.body.appendChild(host);

    function paint(d) {
      kpis.textContent = ""; body.textContent = "";
      var map = (d && d.map) || { rows: [] };
      var t = (d && d.totals) || map.totals || {};
      var n = (d && d.numbers) || {};
      var st = (d && d.stats) || {};
      kpis.append(
        kpi("durable state", fmtBytes(map.stateLen)),
        kpi("in use", fmtBytes(t.usedSum) + (t.pct != null ? " \u00b7 " + t.pct + "%" : "")),
        kpi("free space", fmtBytes(t.freeSum)),
        kpi("unallocated", fmtBytes(t.gap)),
        kpi("high-water mark", fmtInt(t.highWater) + " B"),
        kpi("online now", fmtInt(st.online)),
        kpi("live widget watchers", "…"),
        kpi("online record", fmtInt(st.onlineRecord)),
        kpi("images generated", fmtInt(st.totalImages)),
        kpi("users ever", fmtInt(st.totalUsers)),
        kpi("build", st.buildFull || st.build || "?")
      );
      try {
        var _wk = null;
        var _ks = kpis.querySelectorAll(".dg-kpi");
        for (var _ki = 0; _ki < _ks.length; _ki++) {
          var _lb = _ks[_ki].querySelector(".dg-kpi-l");
          if (_lb && _lb.textContent === "live widget watchers") { _wk = _ks[_ki].querySelector(".dg-kpi-n"); break; }
        }
        if (_wk) {
          arpc("dragonWatchCount", "").then(function (raw) {
            var n = null;
            try { var d = JSON.parse(raw); if (d && d.ok === true && d.watchers != null) n = d.watchers; } catch (e) {}
            _wk.textContent = (n == null ? "?" : String(n));
          }).catch(function () { _wk.textContent = "?"; });
        }
      } catch (e) {}
      if (!(map.rows && map.rows.length)) {
        body.appendChild(el("div", "dg-admin-empty", "The server did not answer with a region map (it may be unreachable in this preview)."));
        return;
      }
      // 1) THE DURABLE REGIONS, capacity vs occupancy.
      var rs = section("\uD83D\uDDC4 Durable regions \u2014 the 50 MiB server state",
        fmtBytes(t.usedSum) + " in use of " + fmtBytes(t.capSum) + " allocated \u00b7 " + fmtBytes(t.freeSum) + " free \u00b7 " +
        "\u00b7 highest byte reached by a growing region " + fmtInt(t.highWater) + " of " + fmtInt(map.stateLen) + " \u00b7 " +
        "unallocated tail " + fmtBytes(t.gap) + " \u00b7 " +
        "no two regions overlap: " + (map.overlaps && map.overlaps.length ? map.overlaps.join(", ") : "confirmed"));
      var rt = el("table", "dg-admin-t");
      var rh = el("tr");
      ["region", "base", "size", "used", "free", "fill"].forEach(function (h) { rh.appendChild(el("th", null, h)); });
      rt.appendChild(rh);
      var rows = map.rows.slice().sort(function (a, b) { return a.base - b.base; });
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        var tr = el("tr");
        tr.appendChild(el("td", null, r.name + (r.fits ? "" : " (DOES NOT FIT)")));
        tr.appendChild(el("td", "p", fmtInt(r.base)));
        tr.appendChild(el("td", "n", fmtBytes(r.size)));
        tr.appendChild(el("td", "n", fmtBytes(r.used)));
        tr.appendChild(el("td", "p", fmtBytes(Math.max(0, r.size - r.used))));
        tr.appendChild(fillCell(r.used, r.size));
        rt.appendChild(tr);
      }
      rs.appendChild(rt);
      body.appendChild(rs);
      // 2) THE DURABLE COUNTERS.
      var cs = section("\uD83D\uDCCA Durable counters");
      var ck = el("div", "dg-admin-kpis");
      ck.append(
        kpi("picture comments", fmtInt(n.comments)),
        kpi("like votes (pairs)", fmtInt(n.likePairs)),
        kpi("popups published", fmtInt(n.popups)),
        kpi("survey submissions", fmtInt(n.surveySubmissions)),
        kpi("survey slots", fmtInt(n.surveySlots)),
        kpi("star votes (1-5)", (n.rateVotes || []).join(" \u00b7 "))
      );
      cs.appendChild(ck);
      body.appendChild(cs);
      // 3) THE src/ ASSET TREE AGAINST THE PLATFORM QUOTA.
      var as = el("div", "dg-admin-block");
      as.setAttribute("data-dragon-admin-assets", "1");
      as.appendChild(el("h4", null, "\uD83D\uDCE6 src/ assets \u2014 the generator's own files"));
      var ab = el("div", null);
      ab.appendChild(el("div", "dg-admin-note", "reading the manifest\u2026"));
      as.appendChild(ab);
      body.appendChild(as);
      paintAssets(ab, fakeManifest);
      // 4) THE LIVE PAYLOAD (what this browser actually downloaded).
      var ps = section("\uD83D\uDCE1 Live payload");
      var pb = el("div", "dg-admin-kpis");
      pb.setAttribute("data-dragon-admin-payload", "1");
      ps.appendChild(pb);
      body.appendChild(ps);
      paintPayload(pb, d);
    }
    function paintAssets(ab, fakeM) {
      ab.textContent = "";
      window.__dragonAdminManifest = null;
      if (fakeM) { renderAssets(ab, fakeM); return; }
      try {
        fetch("src/DATA/asset-manifest.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (m) {
          if (!m || !m.files) { ab.appendChild(el("div", "dg-admin-empty", "No manifest (src/DATA/asset-manifest.json) available \u2014 the src tree cannot be counted here.")); return; }
          renderAssets(ab, m);
        }).catch(function () { ab.textContent = ""; ab.appendChild(el("div", "dg-admin-empty", "The src manifest could not be read here.")); });
      } catch (e) { ab.textContent = ""; ab.appendChild(el("div", "dg-admin-empty", "The src manifest could not be read here.")); }
    }
    function renderAssets(ab, m) {
      window.__dragonAdminManifest = m;
      ab.textContent = "";
      var q = m.quota || { bytes: 2 * 1024 * 1024 * 1024, files: 10000, perFile: 100 * 1024 * 1024 };
      var s = m.sum || {};
      var per = Math.round((s.bytes / q.bytes) * 10000) / 100;
      var kk = el("div", "dg-admin-kpis");
      kk.append(
        kpi("src files", fmtInt(s.files) + " / " + fmtInt(q.files)),
        kpi("src total", fmtBytes(s.bytes)),
        kpi("of the 2 GiB quota", per + "%"),
        kpi("files left", fmtInt(Math.max(0, q.files - (s.files || 0)))),
        kpi("index.html", fmtBytes((m.index || {}).b)),
        kpi("main.pjs", fmtBytes((m.main || {}).b)),
        kpi("generator total", fmtBytes(((m.index || {}).b || 0) + ((m.main || {}).b || 0) + (s.bytes || 0)))
      );
      ab.appendChild(kk);
      var cats = s.byCat || {};
      var ct = el("table", "dg-admin-t");
      var ch = el("tr");
      ["kind", "files", "size", "share"].forEach(function (h) { ch.appendChild(el("th", null, h)); });
      ct.appendChild(ch);
      Object.keys(cats).sort(function (a, b) { return cats[b][1] - cats[a][1]; }).forEach(function (k) {
        var tr = el("tr");
        tr.appendChild(el("td", null, k));
        tr.appendChild(el("td", "n", fmtInt(cats[k][0])));
        tr.appendChild(el("td", "n", fmtBytes(cats[k][1])));
        tr.appendChild(fillCell(cats[k][1], s.bytes || 1));
        ct.appendChild(tr);
      });
      ab.appendChild(ct);
      var big = m.files.slice().sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10);
      ab.appendChild(el("div", "dg-admin-note", "the ten biggest files:"));
      var bt = el("table", "dg-admin-t");
      var bh = el("tr");
      ["file", "size"].forEach(function (h) { bh.appendChild(el("th", null, h)); });
      bt.appendChild(bh);
      big.forEach(function (f) {
        var tr = el("tr");
        tr.appendChild(el("td", null, f[0]));
        tr.appendChild(el("td", "n", fmtBytes(f[1])));
        bt.appendChild(tr);
      });
      ab.appendChild(bt);
      ab.appendChild(el("div", "dg-admin-note", "manifest build " + (m.build || "?") + " \u00b7 " + (m.at || "?") + " \u00b7 refreshed by hand whenever src/ changes (recipe: Devbook, ASSET MANIFEST)."));
    }
    function paintPayload(h, d) {
      h.textContent = "";
      var loaded = 0, bytes = 0, seen = {};
      try {
        var list = performance.getEntriesByType("resource") || [];
        for (var i = 0; i < list.length; i++) {
          var nm = String(list[i].name || "");
          if (!/\/src\/[^\/]*\.js(\?|$)/.test(nm)) continue;
          if (seen[nm]) continue;
          seen[nm] = 1;
          loaded++;
          bytes += (list[i].decodedBodySize || list[i].transferSize || 0);
        }
      } catch (e) {}
      h.append(
        kpi("src modules loaded", fmtInt(loaded)),
        kpi("their real size", fmtBytes(bytes)),
        kpi("script tags", fmtInt(document.querySelectorAll("script").length)),
        kpi("DOM nodes", fmtInt(document.getElementsByTagName("*").length))
      );
    }
    async function load() {
      if (fake) { paint(fake); return; }
      kpis.textContent = "";
      kpis.appendChild(kpi("durable state", "loading\u2026"));
      var raw = null;
      try { raw = await window.dragonServerRpc("dragonServerData", ""); } catch (e) { raw = null; }
      var data = null;
      try { data = JSON.parse(raw); } catch (e) { data = null; }
      if (!data || data.ok !== true) { kpis.textContent = ""; body.textContent = ""; body.appendChild(el("div", "dg-admin-empty", "No answer from the server (the connection may still be starting, or this preview has no durable server).")); return; }
      paint(data);
    }
    load();
    return host;
  }
  // ONE renderer for the popup report (I104): the KPIs + one block per popup number. The in-page report
  // view and the Popups window both draw THIS, so a label/column can never drift between them.
  function reportContent(rows, emptyText) {
    var host = el("div", null);
    var views = 0, answered = 0;
    for (var i = 0; i < rows.length; i++) { views += rows[i].v | 0; answered += rows[i].a | 0; }
    var kpis = el("div", "dg-admin-kpis");
    kpis.append(kpi("popups reported", rows.length), kpi("total shown", views), kpi("total answered", answered), kpi("answer rate", fmtPct(answered, views)));
    host.appendChild(kpis);
    if (!rows.length) { host.appendChild(el("div", "dg-admin-empty", emptyText || "No popup has been reported yet \u2014 nobody has been shown one.")); return host; }
    for (var r = 0; r < rows.length; r++) host.appendChild(buildPopupBlock(rows[r]));
    return host;
  }
  function buildReport(o, fakeRows) {
    var host = el("div", null);
    var top = el("div", "da-row");
    var note = el("div", "dg-admin-note", "\u201cShown\u201d counts the visitors the popup was painted for, \u201cAnswered\u201d the ones who pressed Send; both are deduped per visitor and per network.");
    note.style.flex = "1 1 auto";
    // 🗔 THE "Popups" BUTTON (W-UI309): opens the historical popup statistics as their own window.
    var pb = el("button", "da-btn is-primary", "\uD83D\uDCE3 Popups");
    pb.type = "button";
    pb.setAttribute("data-dragon-popups-open", "1");
    pb.onclick = function () { window.dragonAdminPopupsWindow(); };
    var rf = el("button", "da-btn", "\u21BB Refresh");
    rf.type = "button";
    rf.setAttribute("data-dragon-admin-refresh", "1");
    top.append(note, pb, rf);
    host.appendChild(top);
    var body = el("div", null);
    host.appendChild(body);
    o.body.appendChild(host);

    function paint(rows) {
      body.textContent = "";
      body.appendChild(reportContent(rows));
    }

    async function load() {
      if (fakeRows) { paint(fakeRows.slice().sort(function (a, b) { return b.m - a.m; })); return; }
      body.textContent = "";
      body.appendChild(el("div", "dg-admin-empty", "loading\u2026"));
      var raw = null;
      try { raw = await arpc("dragonPopupReport", ""); } catch (e) { raw = null; }
      var data = null;
      try { data = JSON.parse(raw); } catch (e) { data = null; }
      if (!data || data.ok !== true || !data.l) {
        body.textContent = "";
        body.appendChild(el("div", "dg-admin-empty", "The server refused the report request \u2014 the connection is not authorized (or the POPUP region is unreachable in this preview)."));
        return;
      }
      paint(data.l.slice().sort(function (a, b) { return b.m - a.m; }));
    }
    rf.onclick = function () { load(); };
    load();
    return host;
  }
  function buildPopupBlock(row) {
    var lab = null;
    try { if (window.dragonPopupLabels) lab = window.dragonPopupLabels(row.m); } catch (e) {}
    var blk = el("div", "dg-admin-block");
    var head = el("h4", null, "#" + row.m + (lab && lab.title ? " \u00b7 " + lab.title : " \u00b7 (labels not kept)"));
    blk.appendChild(head);
    var kpis = el("div", "dg-admin-kpis");
    kpis.append(kpi("shown", row.v | 0), kpi("answered", row.a | 0), kpi("answer rate", fmtPct(row.a | 0, row.v | 0)));
    if (row.l) kpis.appendChild(kpi("last report", new Date((row.l | 0) * 1000).toLocaleString()));
    blk.appendChild(kpis);
    var cells = {};
    for (var i = 0; i < (row.c || []).length; i++) {
      var idx = row.c[i][0] | 0, n = row.c[i][1] | 0;
      var qi = Math.floor(idx / 8), oi = idx % 8;
      if (!cells[qi]) cells[qi] = {};
      cells[qi][oi] = n;
    }
    var qLabels = (lab && lab.questions) || null;
    var qKeys = Object.keys(cells).map(Number).sort(function (a, b) { return a - b; });
    if (!qKeys.length) { blk.appendChild(el("div", "dg-admin-empty", "Nobody picked an answer yet.")); return blk; }
    var totalAnswered = row.a | 0;
    for (var k = 0; k < qKeys.length; k++) {
      var qi2 = qKeys[k];
      var q = qLabels && qLabels[qi2] ? qLabels[qi2] : null;
      var t = el("table", "dg-admin-t");
      var thead = el("thead");
      var trh = el("tr");
      trh.append(el("th", null, "Q" + (qi2 + 1) + (q && q.label ? " \u00b7 " + q.label : "")), el("th", null, "n"), el("th", null, "share"));
      thead.appendChild(trh);
      t.appendChild(thead);
      var tb = el("tbody");
      var oKeys = Object.keys(cells[qi2]).map(Number).sort(function (a, b) { return cells[qi2][b] - cells[qi2][a] || a - b; });
      var qTotal = 0;
      for (var j = 0; j < oKeys.length; j++) qTotal += cells[qi2][oKeys[j]];
      for (var j2 = 0; j2 < oKeys.length; j2++) {
        var oi2 = oKeys[j2];
        var n2 = cells[qi2][oi2];
        var oLabel = (q && q.options && q.options[oi2]) ? q.options[oi2].label : ("option " + (oi2 + 1));
        var tr = el("tr");
        var td0 = el("td", null, oLabel);
        var bar = el("span", "dg-admin-bar");
        bar.style.width = (qTotal ? Math.max(2, Math.round((n2 / qTotal) * 90)) : 2) + "px";
        td0.appendChild(document.createTextNode("  "));
        td0.appendChild(bar);
        var td1 = el("td", "n", String(n2));
        var td2 = el("td", "p", fmtPct(n2, qTotal) + " of answers \u00b7 " + fmtPct(n2, totalAnswered) + " of visitors");
        tr.append(td0, td1, td2);
        tb.appendChild(tr);
      }
      t.appendChild(tb);
      blk.appendChild(t);
    }
    return blk;
  }

  // ---- the DEDICATED POPUPS WINDOW (W-UI309) ----------------------------------------------------------
  // Egon asked for a "Popups" button on #closecodeadmin that shows the HISTORICAL popup statistics as their
  // own window — one block per popup number, newest first. It reuses buildPopupBlock (one renderer, I104) and
  // the same dragonPopupReport RPC, so there is no second data path and nothing new to keep in sync.
  function buildPopupsWindow(o, rows) {
    var win = el("div", "da-popups");
    win.setAttribute("data-dragon-popups-win", "1");
    win.style.cssText = "position:fixed;left:0;right:0;top:0;bottom:0;z-index:2147483640;display:flex;flex-direction:column;" +
      "border:0;border-radius:0;background:var(--dt-bg,#131516);overflow:hidden;";
    var head = el("div", "da-head");
    head.style.cssText = "margin:0;padding:.55rem .7rem;";
    head.appendChild(el("div", "da-title", "\uD83D\uDCE3 Popups"));
    var rf = el("button", "da-btn", "\u21BB Refresh");
    rf.type = "button";
    rf.setAttribute("data-dragon-popups-refresh", "1");
    var cl = el("button", "da-btn", "\u2715 Close");
    cl.type = "button";
    cl.setAttribute("data-dragon-popups-close", "1");
    cl.onclick = function () { try { win.remove(); } catch (e) {} };
    head.append(rf, cl);
    var body = el("div", null);
    body.style.cssText = "flex:1 1 auto;overflow:auto;min-height:0;padding:.6rem .7rem;text-align:left;";
    win.append(head, body);
    o.el.appendChild(win);

    function paint(list) {
      body.textContent = "";
      body.appendChild(reportContent(list, "No popup has ever been reported."));
    }
    function load() {
      if (rows) { paint(rows.slice().sort(function (a, b) { return b.m - a.m; })); return; }
      body.textContent = "";
      body.appendChild(el("div", "dg-admin-empty", "loading\u2026"));
      arpc("dragonPopupReport", "").then(function (raw) {
        var data = null; try { data = JSON.parse(raw); } catch (e) { data = null; }
        if (!data || data.ok !== true || !data.l) { body.textContent = ""; body.appendChild(el("div", "dg-admin-empty", "The server refused the report request \u2014 the connection is not authorized, or the POPUP region is unreachable in this preview.")); return; }
        paint(data.l.slice().sort(function (a, b) { return b.m - a.m; }));
      }).catch(function () { body.textContent = ""; body.appendChild(el("div", "dg-admin-empty", "No answer from the server.")); });
    }
    rf.onclick = load;
    load();
    return win;
  }
  window.dragonAdminPopupsWindow = function (rows) {
    if (!open) openPage(false);
    if (!open) return null;
    var had = open.el.querySelector("[data-dragon-popups-win]");
    if (had) { try { had.remove(); } catch (e) {} }
    return buildPopupsWindow(open, rows || null);
  };
  // ---- 🏁 GAMES (Egon 26.10.2026): in-admin test window for shipped mini-games ----------------------
  // Each game lives in its own folder under src/games/<name>/ as a standalone page and is loaded
  // here in an iframe, so games never touch the generator's own scripts or styles.
  var DRAGON_ADMIN_GAMES = [
    { id: "racer", title: "Steel Racer", file: "src/games/racer/index.html", note: "2D top-down steel-track racer · 3 laps vs 3 AI · arrows/WASD + touch" }
  ];
  function buildGamesWindow(o) {
    var win = el("div", "da-games");
    win.setAttribute("data-dragon-games-win", "1");
    win.style.cssText = "position:fixed;left:0;right:0;top:0;bottom:0;z-index:2147483640;display:flex;flex-direction:column;" +
      "border:0;border-radius:0;background:var(--dt-bg,#131516);overflow:hidden;";
    var head = el("div", "da-head");
    head.style.cssText = "margin:0;padding:.55rem .7rem;flex:0 0 auto;";
    head.appendChild(el("div", "da-title", "\uD83C\uDFC1 Games"));
    var rf = el("button", "da-btn", "\u21BB Reload");
    rf.type = "button";
    rf.setAttribute("data-dragon-games-reload", "1");
    var cl = el("button", "da-btn", "\u2715 Close");
    cl.type = "button";
    cl.setAttribute("data-dragon-games-close", "1");
    cl.onclick = function () { try { win.remove(); } catch (e) {} };
    head.append(rf, cl);
    var body = el("div", null);
    body.style.cssText = "flex:1 1 auto;overflow:auto;min-height:0;padding:.6rem .7rem;text-align:left;";
    win.append(head, body);
    o.el.appendChild(win);
    var frame = null;
    function paint() {
      body.textContent = "";
      DRAGON_ADMIN_GAMES.forEach(function (gm) {
        var blk = el("div", "dg-admin-block");
        var h = el("h4", null, "\uD83C\uDFC1 " + gm.title);
        blk.appendChild(h);
        blk.appendChild(el("div", "dg-admin-note", gm.note + " · " + gm.file));
        var rowB = el("div", "da-row");
        var play = el("button", "da-btn is-primary", "▶ Play test");
        play.type = "button";
        play.onclick = function () {
          try { if (frame) frame.remove(); } catch (e) {}
          frame = document.createElement("iframe");
          frame.setAttribute("title", gm.title);
          frame.style.cssText = "width:100%;height:min(72vh,640px);border:1px solid #3a414b;border-radius:10px;background:#0b0d10;";
          frame.setAttribute("allow", "autoplay");
          frame.src = gm.file;
          blk.appendChild(frame);
          try { frame.scrollIntoView({ block: "nearest" }); } catch (e2) {}
        };
        var tab = el("a", "da-btn", "↗ new tab");
        tab.href = gm.file;
        tab.target = "_blank";
        tab.rel = "noopener";
        tab.style.textDecoration = "none";
        rowB.append(play, tab);
        blk.appendChild(rowB);
        body.appendChild(blk);
      });
    }
    rf.onclick = function () { try { if (frame) frame.remove(); } catch (e) {} frame = null; paint(); };
    paint();
    return win;
  }
  window.dragonAdminGamesWindow = function () {
    if (!open) openPage(false);
    if (!open) return null;
    var had = open.el.querySelector("[data-dragon-games-win]");
    if (had) { try { had.remove(); } catch (e) {} }
    return buildGamesWindow(open);
  };
  // ---- 🚩 IMAGE REPORTS (Egon 02.10.2026): the lightbox report inbox --------------------------------
  // Visitors file reports from the lightbox ("..." → 🚩 Report Image); each row carries the picture's
  // own gallery card data (thumbnail url, prompt excerpt, uploader, channel). Groups share one picture.
  // Actions run in the owner's own browser through the existing local blocklists, then the group is
  // marked handled on the server so the queue stays clean.
  function dragonReportReasonName(r) {
    try { if (window.dragonReportReasonLabel) return window.dragonReportReasonLabel(r); } catch (e) {}
    return "reason " + r;
  }
  function dragonReportStamp(t) {
    try { if (window.dragonBlockedStamp) return window.dragonBlockedStamp(Number(t) * 1000); } catch (e) {}
    try { return new Date(Number(t) * 1000).toLocaleString(); } catch (e2) { return ""; }
  }
  function buildReportsWindow(o, rows) {
    var win = el("div", "da-reports");
    win.setAttribute("data-dragon-reports-win", "1");
    win.style.cssText = "position:fixed;left:0;right:0;top:0;bottom:0;z-index:2147483640;display:flex;flex-direction:column;" +
      "border:0;border-radius:0;background:var(--dt-bg,#131516);overflow:hidden;";
    var head = el("div", "da-head");
    head.style.cssText = "margin:0;padding:.55rem .7rem;flex:0 0 auto;";
    head.appendChild(el("div", "da-title", "\uD83D\uDEE1 BAN"));
    var rf = el("button", "da-btn", "\u21BB Refresh");
    rf.type = "button";
    rf.setAttribute("data-dragon-reports-refresh", "1");
    var cl = el("button", "da-btn", "\u2715 Close");
    cl.type = "button";
    cl.setAttribute("data-dragon-reports-close", "1");
    cl.onclick = function () { try { win.remove(); } catch (e) {} };
    head.append(rf, cl);
    var body = el("div", null);
    body.style.cssText = "flex:1 1 auto;overflow:auto;min-height:0;padding:.6rem .7rem;text-align:left;";
    win.append(head, body);
    o.el.appendChild(win);
    function groupRows(list) {
      var g = {}, order = [];
      (list || []).forEach(function (r) {
        var k = String(r.i || r.u || ("id" + r.id));
        if (!g[k]) { g[k] = { key: k, ids: [], reasons: {}, notes: [], first: r.t, last: r.t, i: r.i, u: r.u, o: r.o, c: r.c, s: r.s, p: r.p }; order.push(k); }
        var G = g[k];
        G.ids.push(r.id);
        G.reasons[r.r] = (G.reasons[r.r] || 0) + 1;
        if (r.n) G.notes.push(r.n);
        if (r.t < G.first) G.first = r.t;
        if (r.t > G.last) G.last = r.t;
        if (!G.p && r.p) G.p = r.p;
        if (!G.o && r.o) G.o = r.o;
      });
      order.sort(function (a, b) { return g[b].last - g[a].last; });
      return order.map(function (k) { return g[k]; });
    }
    function setGroup(G, to, then) {
      var left = G.ids.length;
      if (!left) { load(); return; }
      G.ids.forEach(function (id) {
        arpc("dragonReportSet", JSON.stringify({ id: id, to: to })).then(function () {
          if (--left <= 0) { if (then) then(); load(); }
        }, function () {
          if (--left <= 0) { if (then) then(); load(); }
        });
      });
    }
    function paint(list) {
      body.textContent = "";
      var groups = groupRows(list);
      if (!groups.length) { body.appendChild(el("div", "dg-admin-empty", "No open image reports. When a visitor reports a picture from the lightbox, it lands here.")); return; }
      body.appendChild(el("div", "dg-admin-note", groups.length + " reported picture(s) · newest first"));
      groups.forEach(function (G) {
        var b = el("div", "dg-admin-block");
        var row = el("div", null);
        row.style.cssText = "display:flex;flex-wrap:wrap;gap:.6rem;align-items:flex-start;";
        // The picture as a DEFAULT gallery card (Egon 02.10.2026): the same `.t2i-image-ctn` tile
        // chrome the galleries use — the image plus the small under-image caption row — never a
        // re-generation, never our custom card, and no plugin actions (this tile has no live embed).
        if (G.u) {
          var tile = document.createElement("div");
          tile.className = "t2i-image-ctn";
          tile.style.cssText = "margin:0.25rem;margin-bottom:0.6rem;position:relative;flex:0 0 auto;width:auto;min-width:300px;max-width:100%;";
          if (G.i) tile.setAttribute("data-image-id", G.i);
          if (G.o) tile.setAttribute("data-user-id", G.o);
          if (G.p) tile.setAttribute("data-prompt", String(G.p).slice(0, 200));
          var im = document.createElement("img");
          im.src = G.u; im.alt = "";
          im.style.cssText = "width:100%;height:auto;display:block;background:#0d0d11;border-radius:6px;";
          im.onerror = function () { try { tile.remove(); } catch (e) {} };
          try {
            var sizeTile = function () {
              try {
                if (im.naturalWidth && im.naturalHeight && tile.isConnected) {
                  var portrait = im.naturalHeight > im.naturalWidth;
                  tile.style.width = portrait ? "300px" : "450px";
                }
              } catch (eS) {}
            };
            if (im.complete && im.naturalWidth) sizeTile();
            else im.addEventListener("load", sizeTile);
          } catch (eL) {}
          tile.appendChild(im);
          var under = el("div", "t2i-under-each-image-ctn");
          var uw = document.createElement("div");
          uw.style.cssText = "padding:.15rem 0 0;font-size:.68rem;opacity:.85;word-break:break-word;";
          var uwBits = [];
          if (G.c) uwBits.push(G.c + (G.s && G.s !== "public" ? " / " + G.s : ""));
          if (G.o) uwBits.push("uploader " + String(G.o).slice(0, 12) + (String(G.o).length > 12 ? "…" : ""));
          uw.textContent = uwBits.join(" · ") || "Gallery picture";
          under.appendChild(uw);
          tile.appendChild(under);
          row.appendChild(tile);
          // Egon 02.10.2026 — then the ORIGINAL default-gallery card takes the tile's place when it
          // arrives (same picture, its real gallery card); the static tile stays for pictures the
          // gallery's first page does not carry.
          try {
            if (typeof window.dragonOriginalGalleryCard === "function" && G.i)
              window.dragonOriginalGalleryCard({ imageId: G.i, channel: G.c, sub: G.s }).then(function (orig) {
                if (orig && tile.isConnected) {
                  tile.textContent = "";
                  tile.style.cssText = "margin:0.25rem;margin-bottom:0.6rem;position:relative;flex:0 0 auto;width:auto;min-width:300px;max-width:100%;";
                  tile.appendChild(orig);
                }
              });
          } catch (eO) {}
        }
        var info = el("div", null);
        info.style.cssText = "flex:1 1 auto;min-width:0;";
        var reasons = Object.keys(G.reasons).map(function (r) { return dragonReportReasonName(Number(r)) + " ×" + G.reasons[r]; }).join(" · ");
        var meta = [];
        if (G.c) meta.push(G.c + (G.s && G.s !== "public" ? " / " + G.s : ""));
        if (G.o) meta.push("uploader " + String(G.o).slice(0, 12) + (String(G.o).length > 12 ? "…" : ""));
        if (G.i) meta.push("#" + String(G.i).slice(0, 12) + (String(G.i).length > 12 ? "…" : ""));
        meta.push("first " + dragonReportStamp(G.first));
        info.appendChild(el("h4", null, G.ids.length + " report(s) — " + reasons));
        if (G.p) info.appendChild(el("div", "dg-admin-note", "“" + String(G.p).slice(0, 140) + "”"));
        info.appendChild(el("div", "dg-admin-note", meta.join(" · ")));
        G.notes.slice(0, 3).forEach(function (n) { info.appendChild(el("div", "dg-admin-note", "✎ " + String(n).slice(0, 140))); });
        row.appendChild(info);
        b.appendChild(row);
        var acts = el("div", "da-row");
        acts.style.cssText = "margin-top:.45rem;display:flex;flex-wrap:wrap;gap:.35rem;";
        function ab(t, fn) {
          var x = el("button", "da-btn", t);
          x.type = "button";
          x.onclick = fn;
          acts.appendChild(x);
          return x;
        }
        // Generator-wide bans (Egon 02.10.2026): the button bans for EVERY visitor through the
        // server BAN region, and keeps the local block too so the picture vanishes on this device at
        // once even if the server call fails (e.g. unsaved preview without a live server link).
        function banEverywhere(kind, id, localFn, label, btn, unlocalFn) {
          var already = banState(kind, id);
          if (!already) { try { localFn(); } catch (e) {} }
          if (typeof window.dragonServerRpc === "function" && id) {
            try { banTick(btn); } catch (eB) {}
            arpc("dragonBanSet", JSON.stringify({ kind: kind, id: id, to: already ? 0 : 1 })).then(function (raw) {
              var d = null;
              try { d = JSON.parse(raw); } catch (e2) { d = null; }
              if (d && d.ok === true) {
                try { if (window.dragonGlobalBanRefresh) window.dragonGlobalBanRefresh(true); } catch (e3) {}
                try { listsLoaded[kind === "img" ? "imgs" : "users"] = false; } catch (eL) {}
                if (already) { try { if (unlocalFn) unlocalFn(); } catch (eU) {} }
                try { if (window.dragonToast) window.dragonToast(label + (already ? " unbanned for everyone" : " banned for everyone")); } catch (e4) {}
                try { banPaint(btn, !already); } catch (eB2) {}
              } else {
                if (!already) { try { if (unlocalFn) unlocalFn(); } catch (eU2) {} }
                var errCode2 = (d && d.err) || "server error";
                if (errCode2 === "full") errCode2 = "ban list is full" + (d && d.limit ? " (" + d.limit + " pictures)" : "") + " — press Archive to vault on the Banned images tab, then retry";
                banUntick(btn, label + (already ? " unban" : " ban") + " FAILED (" + errCode2 + ") — NOT " + (already ? "unbanned" : "banned") + ". Sign in again and retry.");
                try { banPaint(btn, banState(kind, id)); } catch (eB3) {}
              }
              setGroup(G, 3);
            }, function (e) {
              var why = "";
              try { why = String((e && e.message) || "").slice(0, 60); } catch (eW) {}
              if (!already) { try { if (unlocalFn) unlocalFn(); } catch (eU3) {} }
              banUntick(btn, label + (already ? " unban" : " ban") + " FAILED (" + (why || "no server answer") + ") — NOT " + (already ? "unbanned" : "banned") + ". Retry.");
              try { banPaint(btn, banState(kind, id)); } catch (eB4) {}
              setGroup(G, 3);
            });
          } else {
            try { if (window.dragonToast) window.dragonToast(label + " blocked on this device only (no server link or id)"); } catch (e7) {}
            setGroup(G, 3);
          }
        }
        var banUbtn = ab("\uD83D\uDEAB Ban user", function () {
          banEverywhere("user", G.o, function () {
            if (window.dragonBlockedAdd) window.dragonBlockedAdd(G.o);
            try { if (window.dragonBlockedUserInfoSet) window.dragonBlockedUserInfoSet(G.o, { img: G.i, imgu: G.u }); } catch (eUI) {}
          }, "User", banUbtn, function () {
            try { if (window.dragonBlockedRemove) window.dragonBlockedRemove(G.o); } catch (eUR) {}
          });
        });
        var imgKey = G.i || "";
        try { if (!imgKey && G.u && window.dragonImgHashKey) imgKey = window.dragonImgHashKey(G.u); } catch (eHK) { imgKey = G.i || ""; }
        var banIbtn = ab("🚫 Ban image" + ((!G.i && imgKey) ? " (hash)" : ""), function () {
          banEverywhere("img", imgKey, function () {
            if (window.dragonBlockedImageAdd) window.dragonBlockedImageAdd(imgKey);
            if (window.dragonBlockedImageInfoSet) window.dragonBlockedImageInfoSet(imgKey, { u: G.u, p: G.p, t: Date.now() });
          }, "Image", banIbtn, function () {
            try { if (window.dragonBlockedImageRemove) window.dragonBlockedImageRemove(imgKey); } catch (eIR) {}
          });
        });
        try { banPaint(banUbtn, banState("user", G.o)); } catch (eP1) {}
        try { if (imgKey) banPaint(banIbtn, banState("img", imgKey)); } catch (eP2) {}
        if (!imgKey) { try { banIbtn.disabled = true; banIbtn.title = "No picture id and no url on this report — nothing to ban"; } catch (eBD) {} }
        ab("✔ Dismiss", function () { setGroup(G, 2); });
        b.appendChild(acts);
        body.appendChild(b);
      });
    }
    function load() {
      if (rows) { paint(rows); return; }
      try { if (typeof window.dragonOriginalGalleryWarm === "function") window.dragonOriginalGalleryWarm(); } catch (eW) {}
      body.textContent = "";
      body.appendChild(el("div", "dg-admin-empty", "loading…"));
      arpc("dragonReportList", "").then(function (raw) {
        var data = null; try { data = JSON.parse(raw); } catch (e) { data = null; }
        if (!data || data.ok !== true || !data.reports) { body.textContent = ""; var whyR = (data && data.err === "unauthorized") ? "Your admin sign-in has expired (server restarts drop sessions) — please sign out and sign in again, then reopen Reports." : "The server refused the report request — the connection is not authorized, or the region is unreachable in this preview."; body.appendChild(el("div", "dg-admin-empty", whyR)); return; }
        paint(data.reports);
      }).catch(function () { body.textContent = ""; body.appendChild(el("div", "dg-admin-empty", "No answer from the server.")); });
    }
    rf.onclick = function () {
      if (typeof currentTab !== "undefined" && (currentTab === "users" || currentTab === "imgs")) { listsLoaded[currentTab] = false; loadBans(currentTab); }
      else if (typeof currentTab === "undefined" || currentTab === "reports") load();
    };
    load();
    var tabRow = el("div", null);
    tabRow.style.cssText = "display:flex;flex-wrap:wrap;gap:.3rem;margin:0;padding:.45rem .7rem 0;flex:0 0 auto;";
    win.insertBefore(tabRow, body);
    var currentTab = "reports";
    var tabBtns = {};
    function showTab(name) {
      currentTab = name;
      body.hidden = (name !== "reports");
      scanView.hidden = (name !== "scan");
      usersView.hidden = (name !== "users");
      imgsView.hidden = (name !== "imgs");
      Object.keys(tabBtns).forEach(function (k) { try { tabBtns[k].style.borderColor = (k === name) ? "#9b6bff" : ""; } catch (e) {} });
      if ((name === "users" || name === "imgs") && !listsLoaded[name]) loadBans(name);
    }
    [["reports", "\uD83D\uDEA9 Reports"], ["scan", "\uD83D\uDD0D Gallery scan"], ["gallery", "\uD83D\uDDBC\uFE0F Gallery"], ["users", "\uD83D\uDEAB Banned users"], ["imgs", "\uD83D\uDDBC Banned images"]].forEach(function (td) {
      var b = el("button", "da-btn", td[1]);
      b.type = "button";
      b.onclick = (function (n) {
        return function () {
          if (n === "gallery") {
            if (!o.authed) { try { if (window.dragonToast) window.dragonToast("Sign in first — the gallery opens with ban buttons once you are signed in."); } catch (eT) {} return; }
            enterAdminGallery();
            return;
          }
          showTab(n);
        };
      })(td[0]);
      if (td[0] === "scan") b.setAttribute("data-dragon-scan-toggle", "1");
      if (td[0] === "gallery") b.setAttribute("data-dragon-gallery-toggle", "1");
      tabRow.appendChild(b);
      tabBtns[td[0]] = b;
    });
    var scanView = el("div", null);
    scanView.style.cssText = "flex:1 1 auto;overflow:auto;min-height:0;padding:.6rem .7rem;text-align:left;";
    scanView.hidden = true;
    win.appendChild(scanView);
    var scRow = el("div", null);
    scRow.style.cssText = "display:flex;flex-wrap:wrap;gap:.35rem;align-items:center;margin-bottom:.5rem;position:sticky;top:0;background:var(--dt-bg,#131516);padding:.2rem 0;z-index:2;";
    function scInput(val, w, ph) {
      var i = document.createElement("input");
      i.type = "text"; i.value = val; i.placeholder = ph;
      i.style.cssText = "width:" + w + ";background:#0d0d12;border:1px solid rgba(255,255,255,.14);border-radius:8px;color:#eee;font-size:.76rem;padding:.35rem .5rem;font-family:inherit;";
      scRow.appendChild(i);
      return i;
    }
    var chInput = scInput(window.generatorName || "bestaigen", "9rem", "channel");
    var subInput = scInput("public", "6rem", "sub-gallery");
    var sortSel = document.createElement("select");
    sortSel.style.cssText = "background:#0d0d12;border:1px solid rgba(255,255,255,.14);border-radius:8px;color:#eee;font-size:.76rem;padding:.35rem .5rem;font-family:inherit;";
    [["top", "🏆 Best"], ["recent", "🔜 Recent"], ["trending", "🔥 Trending"], ["commented", "💬 Commented"], ["liked", "⭐ Liked"]].forEach(function (s) { var o = document.createElement("option"); o.value = s[0]; o.textContent = s[1]; sortSel.appendChild(o); });
    scRow.appendChild(sortSel);
    var cfSel = document.createElement("select");
    cfSel.style.cssText = sortSel.style.cssText;
    [["none", "all ratings"], ["g", "g"], ["pg13", "pg13"]].forEach(function (p) { var o = document.createElement("option"); o.value = p[0]; o.textContent = p[1]; cfSel.appendChild(o); });
    scRow.appendChild(cfSel);
    function scMkSel(pairs, val, tip) {
      var s = document.createElement("select");
      s.style.cssText = sortSel.style.cssText;
      pairs.forEach(function (p) { var o = document.createElement("option"); o.value = p[0]; o.textContent = p[1]; s.appendChild(o); });
      try { s.value = val; } catch (eV) {}
      if (tip) s.title = tip;
      scRow.appendChild(s);
      return s;
    }
    var rangeSel = scMkSel([["all-time", "⏰ All Time"], ["1-day", "⏰ Past 24h"], ["3-day", "⏰ Past 3d"], ["1-week", "⏰ Past 7d"], ["1-month", "⏰ Past 30d"], ["1-year", "⏰ Past 365d"]], "all-time", "Time Range — the Best order's window");
    function syncScanSortVis() {
      var so = "recent";
      try { so = sortSel.value || "recent"; } catch (eSV) {}
      try { rangeSel.style.display = (so === "top") ? "" : "none"; } catch (eR) {}
    }
    sortSel.onchange = function () { syncScanSortVis(); };
    rangeSel.onchange = function () { if ((sortSel.value || "") === "top") loadScan(false); };
    syncScanSortVis();
    var loadBtn = el("button", "da-btn", "Load");
    loadBtn.type = "button";
    scRow.appendChild(loadBtn);
    var searchBtn = el("button", "da-btn", "🔍 Search");
    searchBtn.type = "button";
    searchBtn.title = "Open the image search with the admin sweep presets";
    searchBtn.onclick = function () {
      try { window.__dragonAdminSearch = true; } catch (eF6) {}
      try {
        if (window.__dragonAdminScanSnapshot && window.__dragonAdminScanLoad) {
          var _sn = window.__dragonAdminScanSnapshot();
          if (!_sn || !_sn.items || !_sn.items.length) window.__dragonAdminScanLoad();
        }
      } catch (eAL) {}
      try { if (window.dragonSearchOpen) window.dragonSearchOpen("public"); } catch (eS6) {}
    };
    scRow.appendChild(searchBtn);
    scanView.appendChild(scRow);
    var scStatus = el("div", "dg-admin-note", "Pick a gallery and press Load. Bans here apply to THIS generator for every visitor.");
    scanView.appendChild(scStatus);
    var scGrid = el("div", null);
    scGrid.style.cssText = "display:flex;flex-wrap:wrap;gap:.6rem;margin-top:.4rem;align-content:flex-start;";
    scanView.appendChild(scGrid);
    var moreBtn = el("button", "da-btn", "Load more");
    moreBtn.type = "button";
    moreBtn.style.cssText += "margin:.6rem auto 0;";
    moreBtn.hidden = true;
    scanView.appendChild(moreBtn);
    var deepBtn = el("button", "da-btn", "⛏ Deep walk");
    deepBtn.type = "button";
    deepBtn.style.cssText += "margin:.6rem auto 0;";
    deepBtn.title = "Walks the listing page by page on its own (up to 25 pages, ~5000 pictures) and keeps every match — the only way to reach pictures buried deep, which one Load can never see. Press again to stop.";
    deepBtn.hidden = true;
    scanView.appendChild(deepBtn);
    var scDeep = false, scDeepPages = 0;
    deepBtn.onclick = function () {
      if (scDeep) { scDeep = false; deepBtn.textContent = "⛏ Deep walk"; scStatus.textContent += " · walk stopped"; return; }
      if (scBusy) return;
      scDeep = true; scDeepPages = 0;
      deepBtn.textContent = "⏹ Stop walk";
      loadScan(true);
    };
    var scSkip = 0, scBusy = false, scDone = false;
    function scanBan(kind, id, localFn, tile, btns, btn, unlocalFn) {
      if (!id) return;
      var already = banState(kind, id);
      if (!already) { try { localFn(); } catch (e) {} }
      if (typeof window.dragonServerRpc === "function") {
        btns.forEach(function (b) { b.disabled = true; });
        try { banTick(btn); } catch (eB) {}
      }
      function mark(msg, ok) {
        var n = el("div", "dg-admin-note", msg);
        if (ok) n.style.cssText += "color:#9fe6b8;";
        tile.appendChild(n);
      }
      function said(m) { try { if (window.dragonToast) window.dragonToast(m); } catch (eT) {} }
      if (typeof window.dragonServerRpc === "function") {
        arpc("dragonBanSet", JSON.stringify({ kind: kind, id: id, to: already ? 0 : 1 })).then(function (raw) {
          var d = null;
          try { d = JSON.parse(raw); } catch (e2) { d = null; }
          if (d && d.ok === true) {
            try { if (window.dragonGlobalBanRefresh) window.dragonGlobalBanRefresh(true); } catch (e3) {}
            if (already) { try { if (unlocalFn) unlocalFn(); } catch (eU) {} }
            said((kind === "user" ? "User" : "Image") + (already ? " unbanned for everyone" : " banned for everyone"));
            try { listsLoaded[kind === "img" ? "imgs" : "users"] = false; } catch (eL) {}
            btns.forEach(function (b) { b.disabled = false; });
            banPaint(btn, !already);
            mark(already ? "\u2705 unbanned for everyone" : "\u2705 banned for everyone", true);
          } else {
            if (!already) { try { if (unlocalFn) unlocalFn(); } catch (eU2) {} }
            var errCode = (d && d.err) || "server error";
            if (errCode === "full") errCode = "ban list is full" + (d && d.limit ? " (" + d.limit + " pictures)" : "") + " — press Archive to vault on the Banned images tab, then retry";
            banUntick(btn, (already ? "Unban" : "Ban") + " FAILED (" + errCode + ") — NOT " + (already ? "unbanned" : "banned") + ". Retry.");
            btns.forEach(function (b) { b.disabled = false; });
            try { banPaint(btn, banState(kind, id)); } catch (eB3) {}
            mark("\u274C server refused (" + errCode + ") — NOT " + (already ? "unbanned" : "banned"), false);
          }
        }, function (e) { var whyS = ""; try { whyS = String((e && e.message) || "").slice(0, 60); } catch (eW) {} var w2 = whyS || "no server answer"; if (!already) { try { if (unlocalFn) unlocalFn(); } catch (eU3) {} } banUntick(btn, (already ? "Unban" : "Ban") + " FAILED (" + w2 + ") — NOT " + (already ? "unbanned" : "banned") + ". Retry."); try { btns.forEach(function (b) { b.disabled = false; }); } catch (eB5) {} try { banPaint(btn, banState(kind, id)); } catch (eB4) {} mark("\u274C " + w2 + " — NOT " + (already ? "unbanned" : "banned"), false); });
      } else { said("blocked on this device only"); mark("blocked on this device only", false); }
    }
    function scanTile(entry) {
      var tile = el("div", null);
      tile.style.cssText = "flex:0 0 auto;width:auto;min-width:300px;max-width:100%;border:1px solid #4a4a58;border-radius:10px;overflow:hidden;background:#1b1b21;";
      tile.appendChild(entry.el);
      var badges = el("div", null);
      badges.style.cssText = "display:flex;flex-wrap:wrap;gap:.3rem;padding:.4rem .35rem 0;align-items:center;";
      badges.setAttribute("data-scan-badges", "1");
      try { badges.setAttribute("data-scan-url", scanEntryUrl(entry)); } catch (eSU0) {}
      try { if (entry.imageId) badges.setAttribute("data-scan-image-id", String(entry.imageId)); } catch (eSI0) {}
      var bw = el("span", null, "reactions loading…");
      bw.style.cssText = "font-size:.68rem;opacity:.55;";
      badges.appendChild(bw);
      tile.appendChild(badges);
      try {
        var _simg = entry.el.querySelector(".imageWrapperInner img") || entry.el.querySelector("img");
        if (_simg) { _simg.style.cursor = "zoom-in"; _simg.title = "Open full image"; }
        entry.el.addEventListener("click", function (ev) {
          try { if (ev.target.closest("button")) return; } catch (eC) {}
          var im2 = entry.el.querySelector(".imageWrapperInner img") || entry.el.querySelector("img");
          var uu = im2 ? (im2.currentSrc || im2.src) : "";
          if (uu) window.open(uu, "_blank");
        });
      } catch (eC2) {}
      var row = el("div", null);
      row.style.cssText = "display:flex;gap:.3rem;padding:.35rem;";
      function ab(tt, fn) { var x = el("button", "da-btn", tt); x.type = "button"; x.style.cssText += "flex:1 1 auto;font-size:.68rem;padding:.3rem .2rem;"; x.onclick = fn; row.appendChild(x); return x; }
      var bu = ab("\uD83D\uDEAB Ban user", function () {
        var su = "";
        try { var si = entry.el.querySelector(".imageWrapperInner img") || entry.el.querySelector("img"); if (si) su = si.currentSrc || si.src || ""; } catch (eSU) {}
        scanBan("user", entry.userId, function () {
          if (window.dragonBlockedAdd) window.dragonBlockedAdd(entry.userId);
          try { if (window.dragonBlockedUserInfoSet) window.dragonBlockedUserInfoSet(entry.userId, { img: entry.imageId, imgu: su }); } catch (eUI2) {}
        }, tile, [bu, bi], bu, function () {
          try { if (window.dragonBlockedRemove) window.dragonBlockedRemove(entry.userId); } catch (eUR2) {}
        });
      });
      var bi = ab("\uD83D\uDEAB Ban image", function () {
        scanBan("img", imgKey, function () {
          var u = "", p = "";
          try { var im = entry.el.querySelector("img"); if (im) u = im.currentSrc || im.src || ""; } catch (e1) {}
          try { var cd = entry.el.querySelector(".imageCtn"); if (cd) p = String(cd.getAttribute("data-prompt") || "").slice(0, 96); } catch (e2) {}
          if (window.dragonBlockedImageAdd) window.dragonBlockedImageAdd(imgKey);
          if (window.dragonBlockedImageInfoSet) window.dragonBlockedImageInfoSet(imgKey, { u: u, p: p, t: Date.now() });
        }, tile, [bu, bi], bi, function () {
          try { if (window.dragonBlockedImageRemove) window.dragonBlockedImageRemove(imgKey); } catch (eIR2) {}
        });
      });
      var imgKey = entry.imageId || scanImgHash(entry);
      if (!entry.userId) bu.disabled = true;
      if (!imgKey) bi.disabled = true;
      try { if (entry.userId) banPaint(bu, banState("user", entry.userId)); } catch (eP3) {}
      try { if (imgKey) banPaint(bi, banState("img", imgKey)); } catch (eP4) {}
      try { if (!entry.imageId && imgKey) { bi.textContent += " (hash)"; bi.title = "No id on this picture - bans its url hash instead"; if (bi.__banOrg) bi.__banOrg.t = bi.textContent; } } catch (eHT) {}
      tile.appendChild(row);
      return tile;
    }
    function banTick(btn) {
      try {
        if (btn && !btn.__banOrg) btn.__banOrg = { t: btn.textContent, s: btn.style.cssText };
        btn.textContent = "\u2705 Banned";
        btn.style.cssText += "border-color:#3ddc84;color:#9fe6b8;";
        btn.disabled = true;
      } catch (e) {}
    }
    function banUntick(btn, why) {
      try {
        if (btn && btn.__banOrg) { btn.textContent = btn.__banOrg.t; btn.style.cssText = btn.__banOrg.s; }
        if (btn) btn.disabled = false;
      } catch (e) {}
      try { if (window.dragonToast) window.dragonToast(why || "Ban FAILED on the server — NOT banned. Try again."); } catch (e2) {}
    }
    function banState(kind, id) {
      try {
        id = String(id || "");
        if (!id) return false;
        if (kind === "img") {
          if (window.dragonBlockedImageHas && window.dragonBlockedImageHas(id)) return true;
          if (window.dragonGlobalBanImgHas && window.dragonGlobalBanImgHas(id)) return true;
        } else {
          if (window.dragonBlockedHas && window.dragonBlockedHas(id)) return true;
          if (window.dragonGlobalBanUserHas && window.dragonGlobalBanUserHas(id)) return true;
        }
      } catch (e) {}
      return false;
    }
    function banPaint(btn, banned) {
      try {
        if (!btn) return;
        if (!btn.__banOrg) btn.__banOrg = { t: btn.textContent, s: btn.style.cssText };
        if (banned) {
          btn.textContent = "\u2705 Banned \u2014 tap to unban";
          btn.style.cssText += "border-color:#3ddc84;color:#9fe6b8;";
        } else {
          btn.textContent = btn.__banOrg.t;
          btn.style.cssText = btn.__banOrg.s;
        }
        btn.disabled = false;
      } catch (e) {}
    }
    function adminGalBar(tile, t) {
      try {
        if (!window.__dragonAdminGallery) return;
        if (!tile || tile.getAttribute("data-admin-bar")) return;
        var pg = "";
        try { pg = document.documentElement.getAttribute("data-dragon-page") || ""; } catch (eP) {}
        if (pg !== "gallery") return;
        t = t || tile._t || {};
        var imageId = String(t.imageId || ""), userId = String(t.userId || "");
        var url = String(t.url || ""), prompt = String(t.prompt || "");
        var imgKey = imageId;
        try { if (!imgKey && url && window.dragonImgHashKey) imgKey = window.dragonImgHashKey(url); } catch (eHK) { imgKey = imageId; }
        if (!imgKey && !userId) return;
        tile.setAttribute("data-admin-bar", "1");
        var bar = document.createElement("div");
        bar.className = "dragon-admin-bar";
        bar.style.cssText = "display:flex;gap:.3rem;padding:.35rem;";
        var bu = el("button", "da-btn", "\uD83D\uDEAB Ban user");
        bu.type = "button";
        bu.style.cssText += "flex:1 1 auto;font-size:.68rem;padding:.3rem .2rem;";
        var bi = el("button", "da-btn", "\uD83D\uDEAB Ban image");
        bi.type = "button";
        bi.style.cssText += "flex:1 1 auto;font-size:.68rem;padding:.3rem .2rem;";
        bar.append(bu, bi);
        tile.appendChild(bar);
        if (userId) {
          try { banPaint(bu, banState("user", userId)); } catch (eP3) {}
          bu.onclick = function () {
            scanBan("user", userId, function () {
              if (window.dragonBlockedAdd) window.dragonBlockedAdd(userId);
              try { if (window.dragonBlockedUserInfoSet) window.dragonBlockedUserInfoSet(userId, { img: imageId, imgu: url }); } catch (eUI) {}
            }, tile, [bu, bi], bu, function () {
              try { if (window.dragonBlockedRemove) window.dragonBlockedRemove(userId); } catch (eUR) {}
            });
          };
        } else bu.disabled = true;
        if (imgKey) {
          try { banPaint(bi, banState("img", imgKey)); } catch (eP4) {}
          try { if (!imageId) { bi.textContent += " (hash)"; bi.title = "No id on this picture - bans its url hash instead"; if (bi.__banOrg) bi.__banOrg.t = bi.textContent; } } catch (eHT2) {}
          bi.onclick = function () {
            scanBan("img", imgKey, function () {
              if (window.dragonBlockedImageAdd) window.dragonBlockedImageAdd(imgKey);
              if (window.dragonBlockedImageInfoSet) window.dragonBlockedImageInfoSet(imgKey, { u: url, p: prompt.slice(0, 96), t: Date.now() });
            }, tile, [bu, bi], bi, function () {
              try { if (window.dragonBlockedImageRemove) window.dragonBlockedImageRemove(imgKey); } catch (eIR) {}
            });
          };
        } else bi.disabled = true;
      } catch (e) {}
    }
    try { window.dragonAdminTileBar = adminGalBar; } catch (eAB) {}
    function enterAdminGallery() {
      try { window.__dragonAdminGallery = true; } catch (eF) {}
      try { adminGalPageEl = (o && o.el) ? o.el : null; } catch (ePE) {}
      try { if (o && o.el) o.el.hidden = true; } catch (eH) {}
      try { document.body.style.overflow = ""; } catch (eO) {}
      Object.keys(tabBtns).forEach(function (k) { try { tabBtns[k].style.borderColor = (k === "gallery") ? "#9b6bff" : ""; } catch (eB) {} });
      try { if (window.dragonAdminGalChip) window.dragonAdminGalChip(true); } catch (eC) {}
      function decorate() {
        try {
          if (!window.__dragonAdminGallery || !window.dragonAdminTileBar) return;
          var ex = document.querySelectorAll(".dragon-gal-tile");
          for (var i = 0; i < ex.length; i++) { try { window.dragonAdminTileBar(ex[i], ex[i]._t); } catch (eD) {} }
        } catch (e) {}
      }
      try { if (window.dragonGoPage) window.dragonGoPage("gallery"); } catch (eG) {}
      try {
        if (!document.getElementById("dragonAdminGalBack")) {
          var bb = document.createElement("button");
          bb.id = "dragonAdminGalBack"; bb.type = "button";
          bb.textContent = "\u2190 Back to admin";
          bb.title = "Leave gallery mode and return to the admin panel";
          bb.style.cssText = "position:fixed;left:.5rem;top:.5rem;z-index:2147483646;padding:.45rem .8rem;border-radius:10px;border:1px solid #9b6bff;background:linear-gradient(180deg,#2b2140,#14101f);color:#e8e0ff;font-size:.78rem;font-weight:800;cursor:pointer;box-shadow:0 6px 22px rgba(0,0,0,.6);";
          bb.onclick = function () { try { exitAdminGallery(); } catch (e) {} };
          document.body.appendChild(bb);
        }
      } catch (eBB) {}
      try { setTimeout(decorate, 800); } catch (eT1) {}
      try { setTimeout(decorate, 2500); } catch (eT2) {}
    }
    try { window.dragonAdminGalleryEnter = enterAdminGallery; } catch (eAE) {}
    function scanEntryUrl(en) {
      try {
        var im = en.el.querySelector(".imageWrapperInner img") || en.el.querySelector("img");
        return im ? (im.currentSrc || im.src || "") : "";
      } catch (e) { return ""; }
    }
    function scanImgHash(entry) {
      try {
        var u = scanEntryUrl(entry);
        if (u && window.dragonImgHashKey) return window.dragonImgHashKey(u);
      } catch (e) {}
      return "";
    }
    function scanLocalSort(mode, cards) {
      if (mode === "commented" && window.dragonCommentsKeysFetch && window.dragonCommentsKeySet) {
        return window.dragonCommentsKeysFetch().then(function () {
          var set = null;
          try { set = window.dragonCommentsKeySet(); } catch (e) { set = null; }
          if (!set) return cards;
          return cards.filter(function (en) {
            var k = String(en.imageId || scanEntryUrl(en) || "");
            try { return !!set.get(window.dragonCommentTag ? window.dragonCommentTag(k) : k); }
            catch (e2) { return false; }
          });
        });
      }
      if (mode === "liked" && window.dragonLikePrefetch && window.dragonLikeCountOf) {
        var urls = [];
        cards.forEach(function (en) { var u = scanEntryUrl(en); if (u && urls.indexOf(u) === -1) urls.push(u); });
        return window.dragonLikePrefetch(urls).then(function () {
          var kept = cards.filter(function (en) {
            try { return (window.dragonLikeCountOf(scanEntryUrl(en)) | 0) > 0; }
            catch (e3) { return true; }
          });
          kept.sort(function (a, b) {
            return ((window.dragonLikeCountOf(scanEntryUrl(b)) | 0) - (window.dragonLikeCountOf(scanEntryUrl(a)) | 0));
          });
          return kept;
        });
      }
      return Promise.resolve(cards);
    }
    var scCountsReady = false, scCountsFlight = null;
    function scanChip(txt, tip, accent) {
      var c = el("span", null, txt);
      c.style.cssText = "display:inline-flex;align-items:center;font-size:.66rem;font-weight:800;line-height:1.3;padding:.12rem .42rem;border-radius:999px;background:rgba(10,10,14,.86);" + accent;
      if (tip) { try { c.setAttribute("data-dragon-tip", tip); } catch (eT2) {} }
      return c;
    }
    function paintScanBadges() {
      if (!scGrid.isConnected) return;
      var strips = scGrid.querySelectorAll("[data-scan-badges]");
      for (var i = 0; i < strips.length; i++) {
        (function (s) {
          var url = s.getAttribute("data-scan-url") || "";
          var ck = s.getAttribute("data-scan-image-id") || url;
          var lk = 0, cm = 0;
          try { if (window.dragonLikeCountOf) lk = window.dragonLikeCountOf(url) | 0; } catch (eLC) {}
          try { if (window.dragonCommentsCountOf) cm = window.dragonCommentsCountOf(ck) | 0; } catch (eCC) {}
          s.textContent = "";
          var any = false;
          if (lk > 0) { s.appendChild(scanChip("⭐ " + lk, "This image got " + lk + " Like" + (lk === 1 ? "" : "s") + "!", "color:#ffe9a8;border:1px solid rgba(212,175,55,.65);")); any = true; }
          if (cm > 0) { s.appendChild(scanChip("💬 " + cm, "💬 " + cm + (cm === 1 ? " comment" : " comments"), "color:#d8c9ff;border:1px solid rgba(155,107,255,.6);")); any = true; }
          if (!any) {
            var n = el("span", null, scCountsReady ? "no reactions yet" : "reactions loading…");
            n.style.cssText = "font-size:.68rem;opacity:.55;";
            s.appendChild(n);
          }
        })(strips[i]);
      }
    }
    function ensureScanCounts() {
      paintScanBadges();
      if (scCountsFlight) return scCountsFlight;
      var urls = [], cks = [];
      try {
        var strips = scGrid.querySelectorAll("[data-scan-badges]");
        for (var i = 0; i < strips.length; i++) {
          var u = strips[i].getAttribute("data-scan-url") || "";
          var k = strips[i].getAttribute("data-scan-image-id") || u;
          if (u && urls.indexOf(u) === -1) urls.push(u);
          if (k && cks.indexOf(k) === -1) cks.push(k);
        }
      } catch (eG) {}
      var jobs = [];
      try { if (window.dragonLikePrefetch && urls.length) jobs.push(window.dragonLikePrefetch(urls).then(function () {}, function () {})); } catch (eJ2) {}
      try {
        if (window.dragonCommentsKeysFetch) {
          jobs.push(window.dragonCommentsKeysFetch().then(function (set) {
            if (!set) return;
            for (var j = 0; j < cks.length; j++) {
              var n = 0;
              try { n = set.get(window.dragonCommentTag ? window.dragonCommentTag(cks[j]) : cks[j]) | 0; } catch (eN) {}
              if (n > 0 && window.dragonCommentsSeed) { try { window.dragonCommentsSeed(cks[j], n); } catch (eS) {} }
            }
          }, function () {}));
        } else if (window.dragonCommentsPrefetch && cks.length) {
          jobs.push(window.dragonCommentsPrefetch(cks).then(function () {}, function () {}));
        }
      } catch (eJ3) {}
      scCountsFlight = Promise.all(jobs).then(function () { scCountsFlight = null; scCountsReady = true; paintScanBadges(); });
      return scCountsFlight;
    }
    try { window.__dragonAdminScanBadges = paintScanBadges; } catch (eH) {}
    function loadScan(more) {
      if (scBusy) return;
      if (typeof window.dragonGalleryScanCards !== "function") { scStatus.textContent = "Gallery scan is unavailable in this build."; return; }
      scBusy = true;      try { if (window.dragonGlobalBanRefresh) window.dragonGlobalBanRefresh(true); } catch (eR) {}
      var ch = String(chInput.value || window.generatorName || "bestaigen").trim() || "bestaigen";
      var sb = String(subInput.value || "public").trim() || "public";
      var so = sortSel.value || "recent";
      var apiSo = (so === "commented" || so === "liked") ? "recent" : so;
      var cf = (cfSel && (cfSel.value === "g" || cfSel.value === "pg13")) ? cfSel.value : "none";
      var scRange = "all-time";
      try { if (so === "top" && rangeSel) scRange = String(rangeSel.value || "all-time"); } catch (eRG) {}
      var soNote = so;
      try {
        if (so === "top" && rangeSel) soNote += " " + String(rangeSel.options[rangeSel.selectedIndex].textContent || "").replace("⏰ ", "");
      } catch (eSN) {}
      if (!more) { scGrid.textContent = ""; scSkip = 0; scDone = false; scCountsReady = false; }
      if (!more && scDeep) { scDeep = false; try { deepBtn.textContent = "⛏ Deep walk"; } catch (eDS) {} }
      scStatus.textContent = "loading " + ch + (sb !== "public" ? " / " + sb : "") + " \u00B7 " + soNote + " \u00B7 " + cf + " \u00B7 page " + (scSkip / 200 + 1) + "\u2026";
      moreBtn.hidden = true;
      window.dragonGalleryScanCards({ channel: ch, sub: sb, sort: apiSo, skip: scSkip, filter: cf, range: scRange }).then(function (res) {
        scBusy = false;
        res = res || { cards: [], total: 0, exhausted: true };
        function paintScan(cards, note) {
          var hid = 0;
          var drop = (res.cards || []).length - (cards || []).length;
          (cards || []).forEach(function (en) {
            try {
              var _bk = en.imageId || "";
              try { if (!_bk && window.dragonImgHashKey) _bk = window.dragonImgHashKey(scanEntryUrl(en)); } catch (eBH) {}
              if (_bk && banState("img", _bk)) { hid++; return; }
              if (en.userId && banState("user", en.userId)) { hid++; return; }
            } catch (eF) {}
            scGrid.appendChild(scanTile(en));
          });
          scSkip += res.total;
          scDone = !!res.exhausted;
          scStatus.textContent = scGrid.children.length + " pictures \u00B7 " + ch + (sb !== "public" ? " / " + sb : "") + " \u00B7 " + soNote + (drop > 0 ? " \u00B7 " + drop + " without " + so + " signal" : "") + (hid ? " \u00B7 " + hid + " banned hidden" : "") + (note ? " \u00B7 " + note : "") + (scDone ? " \u00B7 end of gallery" : "");
          moreBtn.hidden = scDone || !scGrid.children.length;
          try { deepBtn.hidden = scDone || !scGrid.children.length; } catch (eDH) {}
          try { ensureScanCounts(); } catch (eBC) {}
          if (scDeep) {
            if (!scDone && scDeepPages < 25) {
              scDeepPages++;
              scStatus.textContent += " · deep walk " + scDeepPages + "/25…";
              loadScan(true);
            } else {
              scDeep = false;
              try { deepBtn.textContent = "⛏ Deep walk"; } catch (eDE) {}
              scStatus.textContent += scDone ? " · walk reached the end" : " · walk stopped at 25 pages";
            }
          }
        }
        if (so === "commented" || so === "liked") {
          scanLocalSort(so, res.cards || []).then(function (cards) { paintScan(cards); }, function () { paintScan(res.cards || [], "index unavailable"); });
        } else paintScan(res.cards || []);
      }).catch(function () { scBusy = false; scStatus.textContent = "Could not load the gallery \u2014 check the channel name and try again."; });
    }
    loadBtn.onclick = function () { loadScan(false); };
    try { window.__dragonAdminScanLoad = function () { loadScan(false); }; } catch (eSL) {}
    window.__dragonAdminScanSnapshot = function () {
      var items = [];
      try {
        var rows = scGrid.querySelectorAll(".imageCtn");
        for (var i = 0; i < rows.length; i++) {
          var c = rows[i];
          var im = null;
          try { im = c.querySelector(".imageWrapperInner img") || c.querySelector("img"); } catch (eI) {}
          var src = im ? (im.currentSrc || im.src || "") : "";
          if (!src) continue;
          items.push({ url: src, prompt: c.getAttribute("data-prompt") || "", isFlagged: c.getAttribute("data-is-n"+"sfw") === "true", date: "", userId: c.getAttribute("data-user-id") || "", imageId: c.getAttribute("data-image-id") || "" });
        }
      } catch (e) {}
      var ch = "bestaigen", sb = "public";
      try { ch = String(chInput.value || window.generatorName || "bestaigen").trim() || "bestaigen"; } catch (eC) {}
      try { sb = String(subInput.value || "public").trim() || "public"; } catch (eS) {}
      return { items: items, channel: ch, sub: sb, allMode: "off" };
    };
    moreBtn.onclick = function () { loadScan(true); };
    function banView() {
      var v = el("div", null);
      v.style.cssText = "flex:1 1 auto;overflow:auto;padding:.6rem .7rem;text-align:left;";
      v.hidden = true;
      var st = el("div", "dg-admin-note", "");
      st.setAttribute("data-ban-status", "1");
      var li = el("div", null);
      li.setAttribute("data-ban-list", "1");
      li.style.cssText = "margin-top:.4rem;";
      v.append(st, li);
      win.appendChild(v);
      return v;
    }
    var usersView = banView();
    var imgsView = banView();
    addVaultArchive(imgsView);
    addVaultBrowser(imgsView);
    var listsLoaded = {};
    function loadBans(which) {
      var isU = which === "users";
      var view = isU ? usersView : imgsView;
      var status = view.querySelector("[data-ban-status]");
      var list = view.querySelector("[data-ban-list]");
      status.textContent = "loading\u2026";
      list.textContent = "";
      arpc("dragonBanList", "").then(function (raw) {
        var d = null;
        try { d = JSON.parse(raw); } catch (e) { d = null; }
        if (!d || d.ok !== true) { status.textContent = "The server refused \u2014 sign in again and reopen."; return; }
        var arr = (isU ? (d.users || []) : (d.imgs || [])).slice().reverse();
        listsLoaded[which] = true;
        status.textContent = arr.length + (isU ? " banned user(s)" : " banned image(s)");
        if (!arr.length) { list.appendChild(el("div", "dg-admin-empty", "Nothing banned yet.")); return; }
        var infoMap = {};
        try { if (!isU && window.dragonBlockedImageInfoGet) infoMap = window.dragonBlockedImageInfoGet() || {}; } catch (eM) {}
        var uinfoMap = {};
        try { if (window.dragonBlockedUserInfoGet) uinfoMap = window.dragonBlockedUserInfoGet() || {}; } catch (eUM) {}
        arr.forEach(function (id) {
          var rowB = el("div", null);
          rowB.style.cssText = "display:flex;align-items:center;gap:.5rem;padding:.3rem .4rem;border:1px solid rgba(255,255,255,.08);border-radius:8px;margin-bottom:.3rem;";
          if (!isU) {
            var inf0 = infoMap[String(id)] || {};
            var full0 = inf0.u || "";
            var tw = el("div", null);
            tw.style.cssText = "flex:0 0 auto;width:120px;max-width:32vw;min-height:40px;background:#0d0d11;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;";
            if (full0) {
              var th0 = document.createElement("img");
              th0.src = full0; th0.alt = ""; th0.loading = "lazy";
              th0.style.cssText = "width:100%;height:auto;display:block;cursor:zoom-in;";
              th0.onclick = (function (u) { return function () { try { window.open(u, "_blank"); } catch (eO) {} }; })(full0);
              th0.onerror = function () { try { tw.textContent = "no preview"; } catch (eE) {} };
              tw.appendChild(th0);
            } else if (/^hx[0-9a-z]+$/.test(String(id))) {
              tw.appendChild(el("div", "dg-admin-note", "no preview (hash ban)"));
            } else {
              tw.appendChild(el("div", "dg-admin-note", "fetching preview…"));
              try {
                if (typeof window.dragonOriginalGalleryCard === "function") {
                  window.dragonOriginalGalleryCard({ imageId: String(id) }).then(function (card) {
                    if (!card || !tw.isConnected) return;
                    var im = card.querySelector(".imageWrapperInner img") || card.querySelector("img");
                    var src = im ? (im.currentSrc || im.src || "") : "";
                    tw.textContent = "";
                    if (src) {
                      var th2 = document.createElement("img");
                      th2.src = src; th2.alt = ""; th2.loading = "lazy";
                      th2.style.cssText = "width:100%;height:auto;display:block;cursor:zoom-in;";
                      th2.onclick = (function (u) { return function () { try { window.open(u, "_blank"); } catch (eO2) {} }; })(src);
                      tw.appendChild(th2);
                    } else tw.appendChild(el("div", "dg-admin-note", "no preview"));
                  });
                } else tw.textContent = "";
              } catch (eF) { try { tw.textContent = ""; } catch (eF2) {} }
            }
            rowB.appendChild(tw);
          }
          if (isU) {
            var um = uinfoMap[String(id)] || {};
            var uw = el("div", null);
            uw.style.cssText = "flex:0 0 auto;width:120px;max-width:32vw;min-height:40px;background:#0d0d11;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;";
            var usrc = um.imgu || "";
            if (usrc) {
              var uth = document.createElement("img");
              uth.src = usrc; uth.alt = ""; uth.loading = "lazy";
              uth.style.cssText = "width:100%;height:auto;display:block;cursor:zoom-in;";
              uth.onclick = (function (u) { return function () { try { window.open(u, "_blank"); } catch (eOU) {} }; })(usrc);
              uth.onerror = function () { try { uw.textContent = "no picture"; } catch (eEU) {} };
              uw.appendChild(uth);
            } else if (um.img && typeof window.dragonOriginalGalleryCard === "function") {
              uw.appendChild(el("div", "dg-admin-note", "fetching picture…"));
              try {
                window.dragonOriginalGalleryCard({ imageId: String(um.img) }).then(function (card) {
                  if (!card || !uw.isConnected) return;
                  var im = card.querySelector(".imageWrapperInner img") || card.querySelector("img");
                  var src = im ? (im.currentSrc || im.src || "") : "";
                  uw.textContent = "";
                  if (src) {
                    var uth2 = document.createElement("img");
                    uth2.src = src; uth2.alt = ""; uth2.loading = "lazy";
                    uth2.style.cssText = "width:100%;height:auto;display:block;cursor:zoom-in;";
                    uth2.onclick = (function (u) { return function () { try { window.open(u, "_blank"); } catch (eOU2) {} }; })(src);
                    uw.appendChild(uth2);
                  } else uw.appendChild(el("div", "dg-admin-note", "no picture"));
                });
              } catch (eFU) { try { uw.textContent = "no picture"; } catch (eFU2) {} }
            } else uw.appendChild(el("div", "dg-admin-note", "no picture"));
            rowB.appendChild(uw);
          }
          var mid = el("div", null);
          mid.style.cssText = "flex:1 1 auto;min-width:0;font-size:.72rem;word-break:break-word;";
          if (isU) {
            var um2 = uinfoMap[String(id)] || {};
            var shortL = String(id);
            try { shortL = window.dragonBlockedShortLabel ? window.dragonBlockedShortLabel(String(id), um2) : shortL; } catch (eSL) {}
            var nm = el("div", null, shortL);
            nm.style.cssText = "font-weight:800;font-size:.8rem;";
            mid.appendChild(nm);
            try {
              var dt = um2.t ? (window.dragonBlockedStamp ? window.dragonBlockedStamp(Number(um2.t) || 0) : "") : "";
              if (dt) mid.appendChild(el("div", "dg-admin-note", "banned " + dt));
            } catch (eDT) {}
          }
          if (!isU) {
            var inf2 = infoMap[String(id)] || {};
            if (inf2.p) mid.appendChild(el("div", null, "\u201c" + String(inf2.p).slice(0, 120) + "\u201d"));
          }
          var lab = el("div", null, (/^hx[0-9a-z]+$/.test(String(id)) ? String(id).slice(0, 64) + "  (url hash - picture without id)" : String(id).slice(0, 64)));
          lab.style.cssText = "opacity:.75;word-break:break-all;";
          mid.appendChild(lab);
          var un = el("button", "da-btn", "Unban");
          un.type = "button";
          un.onclick = function () {
            un.disabled = true;
            arpc("dragonBanSet", JSON.stringify({ kind: isU ? "user" : "img", id: id, to: 0 })).then(function () {
              try {
                if (isU) { if (window.dragonBlockedRemove) window.dragonBlockedRemove(id); }
                else { if (window.dragonBlockedImageRemove) window.dragonBlockedImageRemove(id); }
              } catch (eL) {}
              try { if (window.dragonGlobalBanRefresh) window.dragonGlobalBanRefresh(true); } catch (e2) {}
              try { if (window.dragonToast) window.dragonToast("Unbanned"); } catch (e3) {}
              listsLoaded[which] = false;
              loadBans(which);
            }, function () { un.disabled = false; });
          };
          rowB.append(mid, un);
          list.appendChild(rowB);
        });
      }).catch(function () { status.textContent = "No answer from the server."; });
    }
    var VAULT_NAME = "bannedvault";
    function vaultUrl() {
      try { return "https://editable.uploads.dev/file/" + (window.generatorName || "bestaigen") + "/" + VAULT_NAME; } catch (e) { return ""; }
    }
    function vaultEditable() {
      try { if (window.root && window.root.uploadPlugin && window.root.uploadPlugin.editable) return window.root.uploadPlugin.editable; } catch (e) {}
      return null;
    }
    var VAULT_KEY_LS = "dragonVaultKeyV1";
    function vaultKeyLoad() {
      try {
        var raw = localStorage.getItem(VAULT_KEY_LS);
        if (!raw) return "";
        var o = null;
        try { o = JSON.parse(raw); } catch (eJ) { return ""; }
        var g = "";
        try { g = window.generatorName || ""; } catch (eG) {}
        if (!o || typeof o.k !== "string" || !o.k || o.k.length > 256) return "";
        if (o.g && g && o.g !== g) return "";
        return o.k;
      } catch (e) { return ""; }
    }
    function vaultKeySave(k) {
      try {
        var g = "";
        try { g = window.generatorName || ""; } catch (eG) {}
        localStorage.setItem(VAULT_KEY_LS, JSON.stringify({ g: g, k: String(k || "") }));
      } catch (e) {}
    }
    function vaultKeyForget() { try { localStorage.removeItem(VAULT_KEY_LS); } catch (e) {} }
    function vaultUniq(a) {
      var out = [], seen = {};
      (Array.isArray(a) ? a : []).forEach(function (x) { x = String(x == null ? "" : x); if (x && !seen[x]) { seen[x] = 1; out.push(x); } });
      return out;
    }
    function vaultStamp(ms) {
      try { var d = new Date(+ms || 0); if (!d.getTime()) return "never"; return d.toISOString().slice(0, 16).replace("T", " ") + " UTC"; } catch (e) { return ""; }
    }
    function vaultRead() {
      var ed = vaultEditable();
      if (!ed) return Promise.reject(new Error("the upload plugin is not ready in this preview"));
      return Promise.resolve(ed.get(VAULT_NAME)).then(function (txt) {
        if (txt == null) return null;
        var o = JSON.parse(txt);
        return { images: vaultUniq(o && o.images), users: vaultUniq(o && o.users), updatedAt: (o && +o.updatedAt) || 0 };
      });
    }
    function vaultModal(title) {
      var ov = el("div", null);
      ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:1rem;";
      var card = el("div", null);
      card.style.cssText = "width:min(92vw,430px);max-height:86vh;overflow:auto;background:#1b1b21;border:1px solid #6a5a9b;border-radius:12px;padding:.9rem;text-align:left;";
      var h = el("div", null, title);
      h.style.cssText = "font-weight:800;color:#d8c9ff;margin-bottom:.5rem;";
      var body = el("div", null);
      card.append(h, body);
      ov.appendChild(card);
      ov.addEventListener("mousedown", function (e) { if (e.target === ov) { try { ov.remove(); } catch (e2) {} } });
      document.body.appendChild(ov);
      return { ov: ov, body: body, close: function () { try { ov.remove(); } catch (e) {} } };
    }
    function vaultBar(host) {
      var wrap = el("div", null);
      wrap.style.cssText = "background:#0d0d11;border-radius:8px;overflow:hidden;margin:.4rem 0;";
      var fill = el("div", null);
      fill.style.cssText = "height:.7rem;width:0%;background:linear-gradient(90deg,#6a5a9b,#9b6bff);transition:width .15s;";
      wrap.appendChild(fill);
      var lab = el("div", "dg-admin-note", "");
      host.append(wrap, lab);
      return { set: function (f, txt) { try { fill.style.width = Math.max(0, Math.min(100, Math.round(f * 100))) + "%"; } catch (e) {} lab.textContent = txt || ""; } };
    }
    function vaultDsLists() {
      return arpc("dragonBanList", "").then(function (raw) {
        var d = null;
        try { d = JSON.parse(raw); } catch (e) { d = null; }
        if (!d || d.ok !== true) throw new Error((d && d.err) || "server refused");
        return { images: vaultUniq(d.imgs), users: vaultUniq(d.users) };
      });
    }
    function vaultPayload(ds, old) {
      return JSON.stringify({ v: 1, updatedAt: Date.now(), images: vaultUniq((old ? old.images : []).concat(ds.images)), users: vaultUniq((old ? old.users : []).concat(ds.users)) });
    }
    function refreshVaultStatus(vstat, btn) {
      vstat.textContent = "vault file: checking…";
      vaultRead().then(function (v) {
        if (!v) vstat.textContent = "vault file: not created yet — the first archive creates it.";
        else vstat.textContent = "vault file: " + v.images.length + " image(s) + " + v.users.length + " user(s) archived" + (v.updatedAt ? " · updated " + vaultStamp(v.updatedAt) : "") + ".";
        try { if (btn) btn.disabled = false; } catch (e) {}
      }, function (e) {
        var m = ""; try { m = String((e && e.message) || e || ""); } catch (e2) {}
        vstat.textContent = "vault file: unreadable right now (" + m.slice(0, 80) + ").";
        try { if (btn) btn.disabled = false; } catch (e3) {}
      });
    }
    function addVaultArchive(view) {
      var box = el("div", null);
      box.style.cssText = "border:1px solid #6a5a9b;border-radius:10px;padding:.5rem .6rem;margin-bottom:.5rem;background:#17141f;";
      var title = el("div", null, "Vault archive — moves EVERY DS ban (images + users) into the editable vault file, then empties the DS tables.");
      title.style.cssText = "font-size:.74rem;font-weight:800;color:#d8c9ff;margin-bottom:.15rem;";
      var sub = el("div", "dg-admin-note", "The vault file is public-readable by URL (like the ban list itself), but only this panel ever writes to it — and only with the edit key you type in. The key is never stored anywhere except this browser, and only if you tick the remember box.");
      var vstat = el("div", "dg-admin-note", "vault file: checking…");
      var btn = el("button", "da-btn", "Archive ALL DS bans to vault");
      btn.type = "button";
      btn.style.cssText += "margin-top:.4rem;";
      box.append(title, sub, vstat, btn);
      view.insertBefore(box, view.firstChild);
      refreshVaultStatus(vstat, btn);
      btn.onclick = function () { vaultTransfer(vstat, btn); };
    }
    // ---- Vault file browser with Unban (Egon 17.10.2026) ----
    // The archived bans live in the public editable vault file (hashes only). This section lists
    // every entry WITH its picture (full-hash bans resolve to a thumbnail; hx url-hash bans cannot
    // be turned back into an image) and unbans straight from here: vault file + DS table +
    // this browser, then a global refresh. Needs the vault edit key (asked once, remembered on
    // this device like the archive flow).
    var VAULT_BROWSER_PAGE = 120;
    function vaultIsFullHash(id) { try { return /^[0-9a-f]{64}$/i.test(String(id || "")); } catch (eF) { return false; } }
    function vaultThumbUrl(id) {
      if (!vaultIsFullHash(id)) return "";
      try { return "https://aigc.uploads.dev/image/" + String(id) + ".jpeg"; } catch (eT) { return ""; }
    }
    function vaultWithoutPayload(txt, id, isU) {
      var o = null;
      try { o = JSON.parse(txt); } catch (eJ) { return null; }
      if (!o || (!o.images && !o.users)) return null;
      var sid = String(id == null ? "" : id);
      var imgs = vaultUniq(o.images), usrs = vaultUniq(o.users);
      if (isU) usrs = usrs.filter(function (x) { return x !== sid; });
      else imgs = imgs.filter(function (x) { return x !== sid; });
      return JSON.stringify({ v: 1, updatedAt: Date.now(), images: imgs, users: usrs });
    }
    try { window.dragonVaultWithout = vaultWithoutPayload; } catch (eW) {}
    function addVaultBrowser(view, rowsOverride) {
      var box = el("div", null);
      box.style.cssText = "border:1px solid #6a5a9b;border-radius:10px;padding:.5rem .6rem;margin-bottom:.5rem;background:#17141f;";
      box.setAttribute("data-dragon-vault-box", "1");
      var title = el("div", null, "Vault file — banned pictures with Unban");
      title.style.cssText = "font-size:.74rem;font-weight:800;color:#d8c9ff;margin-bottom:.15rem;";
      var sub = el("div", "dg-admin-note", "Every archived ban, with its picture. Unban removes it from the vault file, the server list and this browser. Hash bans (hx…) have no picture — a hash cannot be turned back into an image.");
      var stat = el("div", "dg-admin-note", "vault file: checking…");
      stat.setAttribute("data-dragon-vault-stat", "1");
      var ctrls = el("div", null);
      ctrls.style.cssText = "display:flex;align-items:center;gap:.4rem;margin:.35rem 0;flex-wrap:wrap;";
      var filter = document.createElement("input");
      filter.type = "text";
      filter.placeholder = "filter by hash…";
      filter.setAttribute("data-dragon-vault-filter", "1");
      filter.style.cssText = "flex:1 1 140px;box-sizing:border-box;background:#0d0d12;border:1px solid rgba(255,255,255,.2);border-radius:8px;color:#eee;font-size:.78rem;padding:.35rem .5rem;font-family:inherit;";
      var rf = el("button", "da-btn", "Refresh");
      rf.type = "button";
      var grid = el("div", null);
      grid.setAttribute("data-dragon-vault-grid", "1");
      grid.style.cssText = "margin-top:.4rem;";
      var more = el("button", "da-btn", "Show more");
      more.type = "button";
      more.style.cssText += "margin:.5rem auto;display:block;";
      more.hidden = true;
      ctrls.append(filter, rf);
      box.append(title, sub, stat, ctrls, grid, more);
      try { view.insertBefore(box, view.firstChild); } catch (eI) { try { view.appendChild(box); } catch (eI2) {} }
      var data = { images: [], users: [], dsImgs: {}, updatedAt: 0 };
      var shown = VAULT_BROWSER_PAGE;
      function updateStat() {
        var t = "vault file: " + data.images.length + " image(s) + " + data.users.length + " user(s)";
        try { if (data.updatedAt) t += " · updated " + vaultStamp(data.updatedAt); } catch (eS) {}
        stat.textContent = t;
      }
      function dropRow(id) {
        try {
          var rows = grid.querySelectorAll("[data-dragon-vault-row]");
          for (var i = 0; i < rows.length; i++) {
            try { if (rows[i].getAttribute("data-dragon-vault-row") === id) rows[i].remove(); } catch (eR) {}
          }
        } catch (eQ) {}
      }
      function buildRow(id, isU) {
        var sid = String(id);
        var rowB = el("div", null);
        rowB.style.cssText = "display:flex;align-items:center;gap:.5rem;padding:.3rem .4rem;border:1px solid rgba(255,255,255,.08);border-radius:8px;margin-bottom:.3rem;";
        rowB.setAttribute("data-dragon-vault-row", sid);
        var tw = el("div", null);
        tw.style.cssText = "flex:0 0 auto;width:120px;max-width:32vw;min-height:40px;background:#0d0d11;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;";
        if (!isU) {
          var tu = vaultThumbUrl(sid);
          if (tu) {
            var th = document.createElement("img");
            th.src = tu; th.alt = ""; th.loading = "lazy";
            th.style.cssText = "width:100%;height:auto;display:block;cursor:zoom-in;";
            th.onclick = (function (u) { return function () { try { window.open(u, "_blank"); } catch (eO) {} }; })(tu);
            th.onerror = function () {
              try {
                if (!th.getAttribute("data-fb")) { th.setAttribute("data-fb", "1"); th.src = String(tu).replace(/\.jpeg$/, ".webp"); return; }
              } catch (eF2) {}
              try { tw.textContent = "no picture"; } catch (eE) {}
            };
            tw.appendChild(th);
          } else tw.appendChild(el("div", "dg-admin-note", "hash ban — no picture"));
        } else tw.appendChild(el("div", "dg-admin-note", "user ban"));
        var mid = el("div", null);
        mid.style.cssText = "flex:1 1 auto;min-width:0;font-size:.72rem;word-break:break-word;";
        var lab = el("div", null, sid.slice(0, 64));
        lab.style.cssText = "opacity:.75;word-break:break-all;";
        mid.appendChild(lab);
        var bl = [];
        try { if (data.dsImgs[sid]) bl.push("also in DS"); } catch (eB) {}
        try { if (!isU && window.dragonBlockedImageHas && window.dragonBlockedImageHas(sid)) bl.push("blocked in this browser"); } catch (eB2) {}
        if (bl.length) mid.appendChild(el("div", "dg-admin-note", bl.join(" · ")));
        var un = el("button", "da-btn", "Unban");
        un.type = "button";
        un.onclick = function () { vaultUnbanRow(sid, !!isU, un); };
        rowB.append(tw, mid, un);
        return rowB;
      }
      function matchQ(id) {
        var q = "";
        try { q = String(filter.value || "").trim().toLowerCase(); } catch (eQ2) {}
        return !q || String(id).toLowerCase().indexOf(q) !== -1;
      }
      function render(reset) {
        if (reset) shown = VAULT_BROWSER_PAGE;
        updateStat();
        grid.textContent = "";
        var imgs = data.images.filter(matchQ);
        var usrs = data.users.filter(matchQ);
        var list = imgs.slice(0, shown);
        var i;
        for (i = 0; i < list.length; i++) { try { grid.appendChild(buildRow(list[i], false)); } catch (eR2) {} }
        for (i = 0; i < usrs.length; i++) { try { grid.appendChild(buildRow(usrs[i], true)); } catch (eR3) {} }
        var left = imgs.length - list.length;
        if (left > 0) { more.hidden = false; more.textContent = "Show more (" + left + " left)"; }
        else more.hidden = true;
        if (!imgs.length && !usrs.length) grid.appendChild(el("div", "dg-admin-empty", (data.images.length || data.users.length) ? "No match for this filter." : "Vault file is empty."));
      }
      function finishUnban(id, isU) {
        try {
          if (isU) { if (window.dragonBlockedRemove) window.dragonBlockedRemove(id); }
          else {
            if (window.dragonBlockedImageRemove) window.dragonBlockedImageRemove(id);
            if (window.dragonBlockedImageInfoDel) window.dragonBlockedImageInfoDel(id);
          }
        } catch (eL) {}
        try { if (window.dragonGlobalBanRefresh) window.dragonGlobalBanRefresh(true); } catch (eG) {}
        try {
          if (isU) data.users = data.users.filter(function (x) { return x !== id; });
          else data.images = data.images.filter(function (x) { return x !== id; });
        } catch (eF3) {}
        dropRow(id);
        render(false);
        try { if (window.dragonToast) window.dragonToast("Unbanned"); } catch (eT2) {}
      }
      function vaultUnbanRow(id, isU, btn) {
        var cf = true;
        try { cf = window.confirm ? window.confirm("Remove this ban from the vault file, the server list and this browser?") : true; } catch (eC) { cf = true; }
        if (!cf) return;
        var m = vaultModal(isU ? "Unban user from vault" : "Unban picture from vault");
        var st = el("div", "dg-admin-note", "Preparing…");
        m.body.appendChild(st);
        var savedKey = "";
        try { savedKey = vaultKeyLoad(); } catch (eK) {}
        var inp = document.createElement("input");
        inp.type = "password"; inp.autocomplete = "off"; inp.placeholder = "vault edit key";
        inp.style.cssText = "width:100%;box-sizing:border-box;background:#0d0d12;border:1px solid rgba(255,255,255,.2);border-radius:8px;color:#eee;font-size:.8rem;padding:.4rem .5rem;font-family:inherit;margin:.35rem 0;";
        if (savedKey) { try { inp.value = savedKey; } catch (eV) {} }
        var remRow = el("div", null);
        remRow.style.cssText = "display:flex;align-items:center;gap:.4rem;margin:.1rem 0 .35rem;font-size:.74rem;color:#bdb2dd;";
        var rem = document.createElement("input");
        rem.type = "checkbox";
        try { rem.checked = !!savedKey; } catch (eR4) {}
        remRow.appendChild(rem);
        remRow.appendChild(el("span", null, savedKey ? "Key filled in from this device" : "Remember the key on this device"));
        var go = el("button", "da-btn", "Unban now");
        go.type = "button";
        var cancel = el("button", "da-btn", "Cancel");
        cancel.type = "button";
        cancel.style.cssText += "margin-left:.4rem;";
        m.body.append(inp, remRow, go, cancel);
        try { inp.focus(); } catch (eF4) {}
        cancel.onclick = function () { m.close(); };
        go.onclick = function () {
          var key = String(inp.value || "");
          if (!key) { try { if (window.dragonToast) window.dragonToast("Type the vault edit key first."); } catch (eT3) {} return; }
          try { if (rem.checked) vaultKeySave(key); else vaultKeyForget(); } catch (eR5) {}
          try { inp.value = ""; } catch (eI3) {}
          try { go.disabled = true; } catch (eD) {}
          st.textContent = "Reading the vault file…";
          vaultRead().then(function (v) {
            if (!v) { st.textContent = "Vault file unreadable — nothing changed."; try { go.disabled = false; } catch (eD2) {} return; }
            var payload = vaultWithoutPayload(JSON.stringify({ v: 1, updatedAt: v.updatedAt, images: v.images, users: v.users }), id, isU);
            if (!payload) { st.textContent = "Vault file unreadable — nothing changed."; try { go.disabled = false; } catch (eD3) {} return; }
            var ed = vaultEditable();
            if (!ed) { st.textContent = "The upload plugin is not ready in this preview."; try { go.disabled = false; } catch (eD4) {} return; }
            st.textContent = "Writing the vault file…";
            Promise.resolve(ed.set(VAULT_NAME, payload, { editKey: key })).then(function (res) {
              if (!res || res.error) { st.textContent = "Vault write failed (" + String((res && res.error) || "no answer").slice(0, 120) + ") — nothing changed. (Wrong key is the usual cause.)"; try { go.disabled = false; } catch (eD5) {} return; }
              if (res.superseded) { st.textContent = "Write superseded by a newer one — close and retry."; try { go.disabled = false; } catch (eD6) {} return; }
              st.textContent = "Verifying…";
              vaultRead().then(function (v2) {
                var arr = v2 ? (isU ? v2.users : v2.images) : null;
                if (!arr || arr.indexOf(id) !== -1) { st.textContent = "Verify failed — still listed. Nothing else changed."; try { go.disabled = false; } catch (eD7) {} return; }
                st.textContent = "Vault cleared. Removing from the server list…";
                arpc("dragonBanSet", JSON.stringify({ kind: isU ? "user" : "img", id: id, to: 0 })).then(function () {
                  m.close();
                  finishUnban(id, isU);
                }, function () {
                  st.textContent = "Vault cleared, but the server refused (signed out?). The entry is out of the vault; reopen to retry the server part.";
                  try { go.disabled = false; } catch (eD8) {}
                  finishUnban(id, isU);
                });
              }, function () { st.textContent = "Verify failed — could not read the vault back. Nothing else changed."; try { go.disabled = false; } catch (eD9) {} });
            }, function (eS2) {
              var em = ""; try { em = String((eS2 && eS2.message) || eS2 || ""); } catch (eE2) {}
              st.textContent = "Vault write failed (" + em.slice(0, 120) + ") — nothing changed.";
              try { go.disabled = false; } catch (eD10) {}
            });
          }, function () { st.textContent = "Vault file unreadable — nothing changed."; try { go.disabled = false; } catch (eD11) {} });
        };
      }
      function load() {
        if (rowsOverride) {
          try {
            data.images = (rowsOverride.images || []).slice().reverse();
            data.users = (rowsOverride.users || []).slice();
            data.updatedAt = rowsOverride.updatedAt || 0;
          } catch (eO) {}
          try { data.dsImgs = rowsOverride.ds || {}; } catch (eO2) {}
          render(true);
          return;
        }
        doLoadVault(0);
      }
      function doLoadVault(att) {
        stat.textContent = att ? ("vault file: retrying (" + att + ")…") : "vault file: reading…";
        grid.textContent = "";
        more.hidden = true;
        vaultRead().then(function (v) {
          if (!v) { stat.textContent = "vault file: not created yet."; render(true); return; }
          data.images = v.images.slice().reverse();
          data.users = v.users.slice();
          data.updatedAt = v.updatedAt;
          vaultDsLists().then(function (ds) {
            var s = {}, i;
            for (i = 0; i < ds.images.length; i++) s[String(ds.images[i])] = 1;
            data.dsImgs = s;
            render(true);
          }, function () { data.dsImgs = {}; render(true); });
        }, function () {
          if (att < 4) { try { setTimeout(function () { try { if (box.isConnected) doLoadVault(att + 1); } catch (eC) {} }, 2000); } catch (eT) {} return; }
          stat.textContent = "vault file: unreadable right now.";
        });
      }
      more.onclick = function () { shown += VAULT_BROWSER_PAGE; render(false); };
      filter.oninput = function () { render(true); };
      rf.onclick = function () { load(); };
      load();
      return box;
    }
    try { window.dragonBuildVaultBrowser = addVaultBrowser; } catch (eBV) {}
    function vaultTransfer(vstat, btn) {
      try { btn.disabled = true; } catch (e) {}
      var m = vaultModal("Archive DS bans to vault");
      var bar = vaultBar(m.body);
      bar.set(0.02, "Reading the DS ban lists…");
      vaultDsLists().then(function (ds) {
        if (!ds.images.length && !ds.users.length) { bar.set(1, "Nothing to archive — both DS tables are already empty."); try { btn.disabled = false; } catch (e) {} return; }
        bar.set(0.1, "Found " + ds.images.length + " image(s) + " + ds.users.length + " user(s). Reading the vault file…");
        vaultRead().then(function (old) { startWithKey(ds, old); }, function (e) {
          var em = ""; try { em = String((e && e.message) || e || ""); } catch (e2) {}
          bar.set(1, "Vault file unreadable (" + em.slice(0, 100) + ") — transfer stopped, DS untouched.");
          try { btn.disabled = false; } catch (e3) {}
        });
      }, function (e) {
        var em = ""; try { em = String((e && e.message) || e || ""); } catch (e2) {}
        bar.set(1, "DS lists unreadable (" + em.slice(0, 100) + ") — transfer stopped.");
        try { btn.disabled = false; } catch (e3) {}
      });
      function startWithKey(ds, old) {
        if (!old) { createFirst(ds); return; }
        var savedKey = vaultKeyLoad();
        var p = el("div", "dg-admin-note", "The vault already holds " + old.images.length + " image(s) + " + old.users.length + " user(s) — new bans are merged in, nothing is overwritten. The key is sent to the file server for this write only.");
        var inp = document.createElement("input");
        inp.type = "password"; inp.autocomplete = "off"; inp.placeholder = "vault edit key";
        inp.style.cssText = "width:100%;box-sizing:border-box;background:#0d0d12;border:1px solid rgba(255,255,255,.2);border-radius:8px;color:#eee;font-size:.8rem;padding:.4rem .5rem;font-family:inherit;margin:.35rem 0;";
        if (savedKey) { try { inp.value = savedKey; } catch (eV) {} }
        var remRow = el("div", null);
        remRow.style.cssText = "display:flex;align-items:center;gap:.4rem;margin:.1rem 0 .35rem;font-size:.74rem;color:#bdb2dd;";
        var rem = document.createElement("input");
        rem.type = "checkbox";
        try { rem.checked = !!savedKey; } catch (eC) {}
        remRow.appendChild(rem);
        var remLab = el("span", null, savedKey ? "Key filled in from this device" : "Remember the key on this device");
        remRow.appendChild(remLab);
        var go = el("button", "da-btn", "Start transfer");
        go.type = "button";
        var forget = el("button", "da-btn", "Forget device key");
        forget.type = "button";
        forget.style.cssText += "margin-left:.4rem;";
        if (!savedKey) { try { forget.style.display = "none"; } catch (eH) {} }
        var cancel = el("button", "da-btn", "Cancel");
        cancel.type = "button";
        cancel.style.cssText += "margin-left:.4rem;";
        var doneBtn = el("button", "da-btn", "Done");
        doneBtn.type = "button";
        doneBtn.title = "Close this window (same as Cancel — nothing is cleared by closing)";
        doneBtn.style.cssText += "margin-left:.4rem;";
        m.body.append(p, inp, remRow, go, forget, cancel, doneBtn);
        try { inp.focus(); } catch (e) {}
        cancel.onclick = function () { m.close(); try { btn.disabled = false; } catch (e) {} };
        doneBtn.onclick = function () { m.close(); try { btn.disabled = false; } catch (e) {} };
        forget.onclick = function () {
          vaultKeyForget();
          try { inp.value = ""; } catch (eI) {}
          try { rem.checked = false; } catch (eR) {}
          remLab.textContent = "Remember the key on this device";
          try { forget.style.display = "none"; } catch (eH2) {}
          try { if (window.dragonToast) window.dragonToast("Device key forgotten."); } catch (eT) {}
        };
        var done = false;
        go.onclick = function () {
          if (done) return;
          var key = String(inp.value || "");
          if (!key) { try { if (window.dragonToast) window.dragonToast("Type the vault edit key first."); } catch (e) {} return; }
          var wantRem = false;
          try { wantRem = !!rem.checked; } catch (eR2) {}
          if (wantRem) vaultKeySave(key); else vaultKeyForget();
          done = true;
          try { inp.value = ""; } catch (e) {}
          writeVault(ds, old, key);
        };
      }
      function createFirst(ds) {
        bar.set(0.2, "No vault file yet — creating it (the server issues the edit key)…");
        var ed = vaultEditable();
        if (!ed) { bar.set(1, "The upload plugin is not ready in this preview."); try { btn.disabled = false; } catch (e) {} return; }
        Promise.resolve(ed.set(VAULT_NAME, vaultPayload(ds, null))).then(function (res) {
          if (!res || res.error) {
            var em = (res && res.error) || "no answer";
            if (em === "editable_requires_saved_generator") em = "use the saved generator page, not an unsaved draft";
            bar.set(1, "Vault creation failed (" + String(em).slice(0, 120) + ") — DS untouched.");
            try { btn.disabled = false; } catch (e) {}
            return;
          }
          var key = String((res && res.editKey) || "");
          bar.set(0.55, "Vault created. Verifying…");
          vaultRead().then(function (v) {
            if (!v || v.images.length !== ds.images.length || v.users.length !== ds.users.length) {
              bar.set(1, "Verify failed — the vault does not hold the full archive. DS untouched, nothing was cleared.");
              try { btn.disabled = false; } catch (e) {}
              return;
            }
            showFirstKey(ds, key);
          }, function () {
            bar.set(1, "Verify failed — could not read the vault back. DS untouched, nothing was cleared.");
            try { btn.disabled = false; } catch (e) {}
          });
        }, function (e) {
          var em = ""; try { em = String((e && e.message) || e || ""); } catch (e2) {}
          bar.set(1, "Vault creation failed (" + em.slice(0, 120) + ") — DS untouched.");
          try { btn.disabled = false; } catch (e3) {}
        });
      }
      function showFirstKey(ds, key) {
        bar.set(0.6, "Vault created and verified.");
        var p = el("div", "dg-admin-note", "ONE-TIME vault edit key — save it somewhere private NOW. It is shown only here and now, it is not written anywhere, and without it the vault can never be written again:");
        var k = el("div", null, key || "(the server did not return a key — check the vault status and retry)");
        k.style.cssText = "font-family:monospace;word-break:break-all;background:#0d0d12;border:1px dashed #9b6bff;border-radius:8px;padding:.45rem .55rem;margin:.35rem 0;user-select:all;";
        var remRow = el("div", null);
        remRow.style.cssText = "display:flex;align-items:center;gap:.4rem;margin:.1rem 0 .35rem;font-size:.74rem;color:#bdb2dd;";
        var rem = document.createElement("input");
        rem.type = "checkbox";
        remRow.appendChild(rem);
        remRow.appendChild(el("span", null, "Remember this key on this device"));
        var ok = el("button", "da-btn", "I saved it — clear the DS tables");
        ok.type = "button";
        var doneBtn2 = el("button", "da-btn", "Done");
        doneBtn2.type = "button";
        doneBtn2.title = "Close this window without clearing (keep the DS tables as they are)";
        doneBtn2.style.cssText += "margin-left:.4rem;";
        m.body.append(p, k, remRow, ok, doneBtn2);
        doneBtn2.onclick = function () { m.close(); try { btn.disabled = false; } catch (e) {} };
        ok.onclick = function () {
          var wantRem = false;
          try { wantRem = !!rem.checked; } catch (eR) {}
          if (wantRem && key) vaultKeySave(key);
          try { ok.disabled = true; } catch (e) {} clearDs(ds);
        };
      }
      function writeVault(ds, old, key) {
        var expI = vaultUniq(old.images.concat(ds.images)), expU = vaultUniq(old.users.concat(ds.users));
        bar.set(0.25, "Uploading the merged archive (" + expI.length + " image(s) + " + expU.length + " user(s))…");
        var ed = vaultEditable();
        if (!ed) { bar.set(1, "The upload plugin is not ready in this preview."); try { btn.disabled = false; } catch (e) {} return; }
        Promise.resolve(ed.set(VAULT_NAME, vaultPayload(ds, old), { editKey: key })).then(function (res) {
          if (!res || res.error) {
            bar.set(1, "Vault write failed (" + String((res && res.error) || "no answer").slice(0, 120) + ") — DS untouched, nothing was cleared. (Wrong key is the usual cause.)");
            try { btn.disabled = false; } catch (e) {}
            return;
          }
          if (res.superseded) { bar.set(1, "Write was superseded by a newer one — check the vault status and retry if needed. DS untouched."); try { btn.disabled = false; } catch (e) {} return; }
          bar.set(0.6, "Written. Verifying…");
          vaultRead().then(function (v) {
            if (!v || v.images.length < expI.length || v.users.length < expU.length) {
              bar.set(1, "Verify failed — the vault does not hold the full archive yet. DS untouched, nothing was cleared.");
              try { btn.disabled = false; } catch (e) {}
              return;
            }
            bar.set(0.7, "Archive verified. Clearing the DS tables…");
            clearDs(ds);
          }, function () {
            bar.set(1, "Verify failed — could not read the vault back. DS untouched, nothing was cleared.");
            try { btn.disabled = false; } catch (e) {}
          });
        }, function (e) {
          var em = ""; try { em = String((e && e.message) || e || ""); } catch (e2) {}
          bar.set(1, "Vault write failed (" + em.slice(0, 120) + ") — DS untouched, nothing was cleared.");
          try { btn.disabled = false; } catch (e3) {}
        });
      }
      var cancelled = false;
      function clearDs(ds) {
        var queue = ds.images.map(function (id) { return { kind: "img", id: id }; }).concat(ds.users.map(function (id) { return { kind: "user", id: id }; }));
        var total = queue.length, doneN = 0, failed = 0;
        cancelled = false;
        var cbtn = el("button", "da-btn", "Stop (the vault already holds everything)");
        cbtn.type = "button";
        m.body.appendChild(cbtn);
        cbtn.onclick = function () { cancelled = true; try { cbtn.disabled = true; } catch (e) {} };
        bar.set(0.7, "Clearing 0/" + total + "…");
        (function next() {
          if (cancelled) { finish(true); return; }
          if (!queue.length) { finish(false); return; }
          var job = queue.shift();
          arpc("dragonBanSet", JSON.stringify({ kind: job.kind, id: job.id, to: 0 })).then(function () {
            doneN++;
            bar.set(0.7 + 0.3 * (doneN / total), "Clearing " + doneN + "/" + total + "…");
            next();
          }, function () {
            failed++; doneN++;
            bar.set(0.7 + 0.3 * (doneN / total), "Clearing " + doneN + "/" + total + " (" + failed + " failed, kept)…");
            next();
          });
        })();
        function finish(stopped) {
          try { if (window.dragonGlobalBanRefresh) window.dragonGlobalBanRefresh(true); } catch (e) {}
          try { listsLoaded.users = false; listsLoaded.imgs = false; loadBans("users"); loadBans("imgs"); } catch (e2) {}
          refreshVaultStatus(vstat, btn);
          try { btn.disabled = false; } catch (e3) {}
          if (stopped) bar.set(1, "Stopped — " + doneN + "/" + total + " cleared. The vault holds everything, so re-running finishes the rest.");
          else if (failed) bar.set(1, "Done with " + failed + " failure(s) — " + (total - failed) + "/" + total + " cleared. Re-run to retry the rest (the vault already holds them).");
          else bar.set(1, "Done — all " + total + " DS ban(s) archived to the vault and cleared.");
          try { if (window.dragonToast) window.dragonToast(stopped ? "Archive stopped." : (failed ? "Archive done with " + failed + " failure(s)." : "Archive complete.")); } catch (e4) {}
        }
      }
    }
    return win;
  }
  // ---- Liked sort curation (Egon 17.10.2026) ----
  // Manual placement for the liked-sort review list: eyeball first, then move. The review list is
  // the server's G-slot top per gallery (diag gTop carries tag/votes/rating/ctx/url) — the mistag
  // class lives in G, so G is what gets reviewed. Each row moves through dragonGallerySeatAdmin
  // (admin-authed RPC, both directions; the server overwrites both placement bytes and re-seats).
  function likedSeatOf(e) {
    var r = (e && e.r) | 0, x = (e && e.x) | 0;
    if (r === 1) return 1;
    return Math.max(r, x);
  }
  var LIKED_SEAT_NAMES = ["G", "PG13", "none"];
  function buildLikedWindow(o, rowsOverride) {
    var had = o.el.querySelector("[data-dragon-liked-win]");
    if (had) { try { had.remove(); } catch (eH) {} }
    // Separate page (reports-window pattern): a fixed full-screen overlay with its own head and
    // scroll body — not a block under Server Data.
    var win = el("div", "da-reports");
    win.setAttribute("data-dragon-liked-win", "1");
    win.style.cssText = "position:fixed;left:0;right:0;top:0;bottom:0;z-index:2147483639;display:flex;flex-direction:column;" +
      "border:0;border-radius:0;background:var(--dt-bg,#131516);overflow:hidden;";
    var head = el("div", "da-head");
    head.style.cssText = "margin:0;padding:.55rem .7rem;flex:0 0 auto;";
    head.appendChild(el("div", "da-title", "Liked sort review"));
    var gsel = document.createElement("select");
    gsel.setAttribute("data-dragon-liked-gallery", "1");
    var rsel = document.createElement("select");
    rsel.setAttribute("data-dragon-liked-rating", "1");
    rsel.title = "Rating slot to review";
    for (var rs = 0; rs < 3; rs++) { var ro = document.createElement("option"); ro.value = String(rs); ro.textContent = LIKED_SEAT_NAMES[rs]; rsel.appendChild(ro); }
    try { rsel.value = "0"; } catch (eRS) {}
    var rf = el("button", "da-btn", "Refresh");
    rf.type = "button";
    rf.setAttribute("data-dragon-liked-refresh", "1");
    var cls = el("button", "da-btn", "Close");
    cls.type = "button";
    cls.setAttribute("data-dragon-liked-close", "1");
    cls.onclick = function () { try { lbClose(); } catch (eL) {} try { win.remove(); } catch (e) {} };
    head.append(gsel, rsel, rf, cls);
    var note = el("div", "dg-admin-note",
      "Full G-list review per gallery: look at each picture, pick its seat, Apply. " +
      "Scrolling loads the whole list in pages. A move away from G removes the row (it left the snapshot).");
    note.style.cssText = "padding:.45rem .7rem 0;flex:0 0 auto;";
    var ctrls = el("div", "da-row");
    ctrls.style.cssText += "flex:0 0 auto;";
    var msg = el("span", "da-msg");
    var counters = el("span", null);
    counters.style.cssText = "font-size:.72rem;opacity:.75;";
    ctrls.append(counters, msg);
    var body = el("div", null);
    body.style.cssText = "flex:1 1 auto;overflow:auto;min-height:0;padding:.6rem .7rem;text-align:left;";
    body.setAttribute("data-dragon-liked-body", "1");
    var grid = el("div", null);
    grid.style.cssText = "display:flex;flex-wrap:wrap;gap:.5rem;";
    grid.setAttribute("data-dragon-liked-grid", "1");
    var moreBtn = el("button", "da-btn", "Load more");
    moreBtn.type = "button";
    moreBtn.style.cssText += "margin:.7rem auto;display:block;";
    moreBtn.setAttribute("data-dragon-liked-more", "1");
    body.append(grid, moreBtn);
    win.append(head, note, ctrls, body);
    o.el.appendChild(win);
    var all = [];
    // Full-list paging over the G slot (100/page, infinite scroll + Load more). Rows carry
    // tag/votes/seat from the server page entries — no per-picture lookup.
    var pgNext = 0, pgTotal = 0, pgLoading = false, pgDone = false, pgGen = "", pgSlot = 0;
    var lbIdx = -1, lbOv = null, lbEsc = null;
    function seatName(s) { return LIKED_SEAT_NAMES[s] || "?"; }
    function setGalleries(names, sel) {
      var cur = sel || "";
      try { cur = String(gsel.value || cur || ""); } catch (eG) {}
      gsel.textContent = "";
      if (!names || !names.length) names = ["bestaigen"];
      for (var i = 0; i < names.length; i++) { var op = document.createElement("option"); op.value = names[i]; op.textContent = names[i]; gsel.appendChild(op); }
      try {
        if (names.indexOf(cur) >= 0) gsel.value = cur;
        else if (names.indexOf("bestaigen") >= 0) gsel.value = "bestaigen";
        else gsel.value = names[0];
      } catch (eS) {}
    }
    function refreshShowing() {
      try {
        if (pgDone) { moreBtn.hidden = all.length <= 0; moreBtn.textContent = "done (" + all.length + ")"; }
        else { moreBtn.hidden = false; moreBtn.textContent = "Load more (" + all.length + "/" + pgTotal + ")"; }
      } catch (e) {}
    }
    function lbClose() {
      try { if (lbOv) lbOv.remove(); } catch (e) {}
      lbOv = null; lbIdx = -1;
      if (lbEsc) { try { document.removeEventListener("keydown", lbEsc); } catch (e2) {} lbEsc = null; }
    }
    function lbShow(i) {
      if (!all.length) return;
      i = ((i % all.length) + all.length) % all.length;
      var e = all[i], u = String((e && e.u) || "");
      if (!/^https?:\/\//.test(u)) return;
      lbClose();
      lbIdx = i;
      var ov = document.createElement("div");
      ov.style.cssText = "position:fixed;inset:0;background:rgba(8,8,12,.96);z-index:2147483645;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:.5rem;padding:1rem;";
      ov.setAttribute("data-dragon-liked-lb", "1");
      var im = document.createElement("img");
      im.src = u;
      im.style.cssText = "max-width:94vw;max-height:80vh;border-radius:8px;";
      var cap = el("div", null, "tag " + String(e.t || "?") + " · " + (e.c | 0) + " votes · seat " + seatName(likedSeatOf(e)) + " (" + (i + 1) + "/" + all.length + ")");
      cap.style.cssText = "font-size:.75rem;opacity:.85;";
      var bar = el("div", null);
      bar.style.cssText = "display:flex;gap:.5rem;";
      var bb = function (t, fn) { var b = el("button", "da-btn", t); b.type = "button"; b.onclick = function (ev) { try { ev.stopPropagation(); } catch (x) {} fn(); }; bar.appendChild(b); return b; };
      bb("Prev", function () { lbShow(lbIdx - 1); });
      bb("Close", lbClose);
      bb("Next", function () { lbShow(lbIdx + 1); });
      ov.append(im, cap, bar);
      ov.onclick = function (ev) { if (ev.target === ov) lbClose(); };
      lbEsc = function (ev) { if (ev && ev.key === "Escape") lbClose(); };
      document.addEventListener("keydown", lbEsc);
      document.body.appendChild(ov);
      lbOv = ov;
    }
    function rowTile(e) {
      var tile = el("div", null);
      tile.style.cssText = "flex:0 0 auto;width:190px;border:1px solid #4a4a58;border-radius:10px;overflow:hidden;background:#1b1b21;";
      // Egon 20.10.2026 — server page entries carry the picture URL in `u` (no `thumb`
      // field); read it first so the tile shows the picture instead of meta-only.
      var u = String(e.u || e.thumb || "");
      if (/^https?:\/\//.test(u)) {
        var im = document.createElement("img");
        im.src = u; im.loading = "lazy";
        im.style.cssText = "display:block;width:100%;height:130px;object-fit:cover;cursor:zoom-in;background:#000;";
        im.onclick = function () { try { lbShow(all.indexOf(e)); } catch (x) {} };
        tile.appendChild(im);
      }
      var meta = el("div", null);
      meta.style.cssText = "padding:.35rem;font-size:.7rem;";
      var tag = el("div", null, "tag " + String(e.t || "?"));
      tag.style.cssText = "font-family:monospace;";
      meta.appendChild(tag);
      var badges = el("div", null);
      badges.style.cssText = "display:flex;gap:.3rem;flex-wrap:wrap;margin:.2rem 0;align-items:center;";
      var paintBadges = function () {
        badges.textContent = "";
        badges.appendChild(el("span", null, String(e.c | 0) + " votes"));
        if ((e.r | 0) < 0 || (e.x | 0) < 0) badges.appendChild(el("span", null, "r?/x?"));
        else badges.appendChild(el("span", null, "r" + (e.r | 0) + "/x" + (e.x | 0)));
        badges.appendChild(el("b", null, "seat: " + seatName(likedSeatOf(e))));
      };
      paintBadges();
      meta.appendChild(badges);
      var row2 = el("div", null);
      row2.style.cssText = "display:flex;gap:.3rem;";
      var sel = document.createElement("select");
      sel.style.cssText = "flex:1 1 auto;min-width:0;";
      for (var s = 0; s < 3; s++) { var oo = document.createElement("option"); oo.value = String(s); oo.textContent = LIKED_SEAT_NAMES[s]; sel.appendChild(oo); }
      try { sel.value = String(likedSeatOf(e) > 2 || likedSeatOf(e) < 0 ? 0 : likedSeatOf(e)); } catch (eSV) {}
      var ab = el("button", "da-btn", "Apply");
      ab.type = "button";
      ab.style.cssText += "flex:0 0 auto;font-size:.68rem;padding:.3rem .4rem;";
      ab.onclick = function () {
        var s2 = parseInt(sel.value, 10);
        if (!(s2 >= 0 && s2 <= 2) || !e.t) return;
        ab.disabled = true;
        msg.textContent = "moving " + String(e.t || "?") + "…";
        msg.className = "da-msg";
        arpc("dragonGallerySeatAdmin", JSON.stringify({ t: String(e.t || ""), s: s2 })).then(function (raw) {
          var d = null;
          try { d = JSON.parse(raw); } catch (x) {}
          ab.disabled = false;
          if (d && d.ok) {
            e.r = s2; e.x = s2;
            try { sel.value = String(likedSeatOf(e)); } catch (x2) {}
            paintBadges();
            msg.textContent = "moved " + String(e.t || "?") + " to " + LIKED_SEAT_NAMES[s2] + (d.noop ? " (already there)" : "") + ".";
            msg.className = "da-msg is-ok";
            if (s2 !== pgSlot) {
              // It left this slot's snapshot — drop the row so the review stays truthful.
              try {
                var ix = all.indexOf(e);
                if (ix >= 0) all.splice(ix, 1);
                tile.remove();
              } catch (x3) {}
              refreshShowing();
            }
          } else {
            msg.textContent = "move failed: " + String((d && d.err) || "error") + ".";
            msg.className = "da-msg";
          }
        }, function (err) {
          ab.disabled = false;
          msg.textContent = "move failed: " + String((err && err.message) || err || "error") + ".";
          msg.className = "da-msg";
        });
      };
      row2.append(sel, ab);
      meta.appendChild(row2);
      tile.appendChild(meta);
      return tile;
    }
    function appendRows(list) {
      for (var i = 0; i < (list || []).length; i++) {
        all.push(list[i]);
        try { grid.appendChild(rowTile(list[i])); } catch (eA) {}
      }
      refreshShowing();
    }
    function fetchPage() {
      if (pgLoading || pgDone) return;
      if (typeof window.dragonGalleryTopPage !== "function") { msg.textContent = "likes layer too old — save the generator to update it."; return; }
      pgLoading = true;
      moreBtn.textContent = "loading…";
      moreBtn.hidden = false;
      window.dragonGalleryTopPage(pgGen, pgSlot, pgNext, 100).then(function (env) {
        pgLoading = false;
        if (!env || !env.slot) { pgDone = true; moreBtn.hidden = true; msg.textContent = "gallery has no " + seatName(pgSlot) + " list (never registered)."; return; }
        pgNext = (env.next | 0); pgTotal = (env.total | 0);
        appendRows(env.list || []);
        msg.textContent = "";
        if (pgNext >= pgTotal) { pgDone = true; moreBtn.hidden = true; }
        refreshShowing();
      }, function (err) {
        pgLoading = false;
        if (err && err.message === "warming") {
          msg.textContent = "server warming — retrying…";
          setTimeout(function () { try { if (win.isConnected) fetchPage(); } catch (eW) {} }, 8000);
          return;
        }
        msg.textContent = "page failed to load.";
        moreBtn.hidden = false; moreBtn.textContent = "Retry";
      });
    }
    function paintCounters(cnt) {
      try {
        if (!cnt) return;
        counters.textContent = (counters.textContent ? counters.textContent + " · " : "") +
          "dissent " + (cnt.dissent | 0) + " · sticky-PG13 " + (cnt.stickyPg13 | 0) +
          " · ctx-mismatch " + (cnt.ctxMismatch | 0) + " · unlisted " + (cnt.unlisted | 0);
      } catch (eC) {}
    }
    function load() {
      if (rowsOverride) {   // test path: static rows, no paging
        var rows = rowsOverride.rows || rowsOverride;
        all = []; grid.textContent = "";
        lbClose();
        var nm = {}, i;
        for (i = 0; i < rows.length; i++) nm[String((rows[i] && rows[i].g) || "")] = 1;
        setGalleries(Object.keys(nm).sort());
        pgTotal = rows.length; pgNext = rows.length; pgDone = true; moreBtn.hidden = true;
        appendRows(rows);
        return;
      }
      all = []; grid.textContent = "";
      lbClose();
      pgNext = 0; pgTotal = 0; pgDone = false; pgLoading = false;
      try { pgSlot = parseInt(rsel.value, 10); if (!(pgSlot >= 0 && pgSlot <= 2)) pgSlot = 0; } catch (eRS2) { pgSlot = 0; }
      try {
        note.textContent = "Full " + seatName(pgSlot) + "-list review per gallery: look at each picture, pick its seat, Apply. " +
          "Scrolling loads the whole list in pages. A move away from " + seatName(pgSlot) + " removes the row (it left the snapshot).";
      } catch (eNT) {}
      moreBtn.hidden = false; moreBtn.textContent = "Load more";
      msg.textContent = "loading review list…";
      msg.className = "da-msg";
      counters.textContent = "";
      var gen0 = "";
      try { gen0 = String(gsel.value || "") || "bestaigen"; } catch (eG0) { gen0 = "bestaigen"; }
      var start = function (gen, cnt) {
        pgGen = gen;
        try { if (String(gsel.value || "") !== gen) gsel.value = gen; } catch (eSV2) {}
        paintCounters(cnt);
        msg.textContent = "";
        fetchPage();
      };
      try {
        if (typeof window.dragonLikesDiag !== "function") { setGalleries([gen0], gen0); start(gen0, null); return; }
        window.dragonLikesDiag().then(function (d) {
          var T = (d && d.top) || {};
          var gens = {}, gl = T.gTop || [], i;
          for (i = 0; i < gl.length; i++) gens[String(gl[i].g || "")] = 1;
          var names = Object.keys(gens).sort();
          if (!names.length) names = [gen0];
          setGalleries(names);
          start(String(gsel.value || names[0]), T);
        }, function () { setGalleries([gen0], gen0); start(gen0, null); });
      } catch (e) { try { setGalleries([gen0], gen0); } catch (e2) {} start(gen0, null); }
    }
    gsel.onchange = function () { load(); };
    rsel.onchange = function () { load(); };
    rf.onclick = function () { load(); };
    moreBtn.onclick = function () { fetchPage(); };
    var scrollT = 0;
    body.addEventListener("scroll", function () {
      var now = Date.now();
      if (now - scrollT < 400) return;
      scrollT = now;
      try {
        if (body.scrollTop + body.clientHeight > body.scrollHeight - 900) fetchPage();
      } catch (e) {}
    });
    window.__dragonAdminLikedSnapshot = function () {
      return { rows: all.length, total: pgTotal, done: pgDone, gallery: pgGen, slot: pgSlot };
    };
    load();
    return win;
  }
  // ---- Watcher inspect review (Egon 17.10.2026) ----
  // The upload-time vision inspector files an entry per UNDECIDED image (pedo-unsure /
  // animal-unsure / close call / inspect failure); the upload itself proceeds under
  // Perchance's auto-tag rating. Rejected (prebanned) images never upload and never
  // land here. This page is visible ONLY to the admin: look at each flagged picture
  // and press Done when you have decided (ban / move / leave — those flows live where
  // they always did; Done only clears the flag). Thumbnails are resolved by matching
  // the flag's hash against the gallery's data-image-id in recent listing pages; a
  // flag whose picture left the recent pages still shows its verdict + prompt.
  var INSPECT_RATING_NAMES = ["G", "PG13", "none"];
  function inspectFlagLabel(f) {
    f = f | 0;
    var out = [];
    if (f & 1) out.push("pedo?");
    if (f & 2) out.push("animal?");
    if (f & 4) out.push("close-call");
    if (!out.length) out.push("note");
    return out.join(" + ");
  }
  function buildInspectWindow(o, rowsOverride) {
    var had = o.el.querySelector("[data-dragon-inspect-win]");
    if (had) { try { had.remove(); } catch (eH) {} }
    // Separate page (Liked-window pattern): fixed full-screen overlay, head + scroll body.
    var win = el("div", "da-reports");
    win.setAttribute("data-dragon-inspect-win", "1");
    win.style.cssText = "position:fixed;left:0;right:0;top:0;bottom:0;z-index:2147483639;display:flex;flex-direction:column;" +
      "border:0;border-radius:0;background:var(--dt-bg,#131516);overflow:hidden;";
    var head = el("div", "da-head");
    head.style.cssText = "margin:0;padding:.55rem .7rem;flex:0 0 auto;";
    head.appendChild(el("div", "da-title", "\uD83D\uDD0D Watcher inspect queue"));
    var rf = el("button", "da-btn", "Refresh");
    rf.type = "button";
    rf.setAttribute("data-dragon-inspect-refresh", "1");
    var cls = el("button", "da-btn", "Close");
    cls.type = "button";
    cls.setAttribute("data-dragon-inspect-close", "1");
    var lbOv = null, lbEsc = null;
    function lbClose() {
      try { if (lbOv) lbOv.remove(); } catch (e) {}
      lbOv = null;
      if (lbEsc) { try { document.removeEventListener("keydown", lbEsc); } catch (e2) {} lbEsc = null; }
    }
    cls.onclick = function () { try { lbClose(); } catch (eL) {} try { win.remove(); } catch (e) {} };
    head.append(rf, cls);
    var note = el("div", "dg-admin-note",
      "Undecided uploads only — the watcher already uploaded these under Perchance's auto-tag rating. " +
      "Look, decide (ban / move / leave), then Done clears the flag. Nothing here is sent to anyone.");
    note.style.cssText = "padding:.45rem .7rem 0;flex:0 0 auto;";
    var ctrls = el("div", "da-row");
    ctrls.style.cssText += "flex:0 0 auto;";
    var msg = el("span", "da-msg");
    var counters = el("span", null);
    counters.style.cssText = "font-size:.72rem;opacity:.75;";
    ctrls.append(counters, msg);
    var body = el("div", null);
    body.style.cssText = "flex:1 1 auto;overflow:auto;min-height:0;padding:.6rem .7rem;text-align:left;";
    var grid = el("div", null);
    grid.style.cssText = "display:flex;flex-wrap:wrap;gap:.5rem;";
    grid.setAttribute("data-dragon-inspect-grid", "1");
    body.appendChild(grid);
    win.append(head, note, ctrls, body);
    o.el.appendChild(win);
    var all = [];
    function fmtTime(t) {
      try {
        if (!(t > 0)) return "?";
        var d = new Date(t * 1000);
        return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } catch (e) { return "?"; }
    }
    function lbShow(e) {
      var u = String((e && e.thumb) || "");
      if (!/^https?:\/\//.test(u)) return;
      lbClose();
      var ov = document.createElement("div");
      ov.style.cssText = "position:fixed;inset:0;background:rgba(8,8,12,.96);z-index:2147483645;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:.5rem;padding:1rem;";
      var im = document.createElement("img");
      im.src = u;
      im.style.cssText = "max-width:94vw;max-height:78vh;border-radius:8px;";
      var cap = el("div", null, "\uD83D\uDD0D " + String(e.h || "?").slice(0, 12) + "… · " + fmtTime(e.t));
      cap.style.cssText = "font-size:.75rem;opacity:.85;";
      var cb = el("button", "da-btn", "Close");
      cb.type = "button";
      cb.onclick = lbClose;
      ov.append(im, cap, cb);
      ov.onclick = function (ev) { if (ev.target === ov) lbClose(); };
      lbEsc = function (ev) { if (ev && ev.key === "Escape") lbClose(); };
      document.addEventListener("keydown", lbEsc);
      document.body.appendChild(ov);
      lbOv = ov;
    }
    function rowTile(e) {
      var tile = el("div", null);
      tile.style.cssText = "flex:0 0 auto;width:220px;border:1px solid #4a4a58;border-radius:10px;overflow:hidden;background:#1b1b21;";
      // Egon 20.10.2026 — live rows carry the reason text in `u` (never a URL); the resolved
      // thumbnail lands on `thumb`. Prefer it so the tile shows the picture, not the placeholder.
      var u = String(e.thumb || e.u || "");
      if (/^https?:\/\//.test(u)) {
        var im = document.createElement("img");
        im.src = u; im.loading = "lazy";
        im.style.cssText = "display:block;width:100%;height:150px;object-fit:cover;cursor:zoom-in;background:#000;";
        im.onclick = function () { try { lbShow(e); } catch (x) {} };
        tile.appendChild(im);
      } else {
        var ph = el("div", null, "\uD83D\uDD0D " + String(e.h || "?").slice(0, 12) + "…");
        ph.style.cssText = "display:flex;align-items:center;justify-content:center;width:100%;height:150px;background:#0d0d12;color:#8a8a99;font-family:monospace;font-size:.72rem;";
        tile.appendChild(ph);
      }
      var meta = el("div", null);
      meta.style.cssText = "padding:.35rem;font-size:.7rem;display:flex;flex-direction:column;gap:.2rem;";
      var badge = el("b", null, "\uD83D\uDD0D " + inspectFlagLabel(e.f));
      badge.style.cssText = "color:#ffd76a;";
      meta.appendChild(badge);
      var rline = el("div", null, "watcher: " + (INSPECT_RATING_NAMES[e.r] || "?") +
        " · erotic " + ((e.e | 0) >= 0 ? (e.e | 0) + "%" : "?") + " · " + fmtTime(e.t));
      meta.appendChild(rline);
      if (e.u) {
        var why = el("div", null, String(e.u));
        why.style.cssText = "opacity:.85;word-break:break-word;";
        meta.appendChild(why);
      }
      if (e.p) {
        var pr = el("div", null, "prompt: " + String(e.p));
        pr.style.cssText = "opacity:.6;word-break:break-word;font-size:.66rem;";
        meta.appendChild(pr);
      }
      var dn = el("button", "da-btn", "Done");
      dn.type = "button";
      dn.style.cssText += "font-size:.68rem;padding:.3rem .4rem;";
      dn.onclick = function () {
        if (!e.h) return;
        dn.disabled = true;
        msg.textContent = "clearing " + String(e.h).slice(0, 12) + "…";
        msg.className = "da-msg";
        arpc("dragonWatcherResolve", JSON.stringify({ h: String(e.h) })).then(function (raw) {
          var d = null;
          try { d = JSON.parse(raw); } catch (x) {}
          dn.disabled = false;
          if (d && d.ok) {
            try {
              var ix = all.indexOf(e);
              if (ix >= 0) all.splice(ix, 1);
              tile.remove();
            } catch (x3) {}
            msg.textContent = "flag cleared.";
            msg.className = "da-msg is-ok";
            refreshShowing();
          } else {
            msg.textContent = "clear failed: " + String((d && d.err) || "error") + ".";
            msg.className = "da-msg";
          }
        }, function (err) {
          dn.disabled = false;
          msg.textContent = "clear failed: " + String((err && err.message) || err || "error") + ".";
          msg.className = "da-msg";
        });
      };
      meta.appendChild(dn);
      tile.appendChild(meta);
      return tile;
    }
    function refreshShowing() {
      try { counters.textContent = all.length + " open flag" + (all.length === 1 ? "" : "s"); } catch (e) {}
    }
    function appendRows(list) {
      for (var i = 0; i < (list || []).length; i++) {
        all.push(list[i]);
        try { grid.appendChild(rowTile(list[i])); } catch (eA) {}
      }
      refreshShowing();
    }
    // Resolve a flag hash to a thumbnail by scanning recent gallery listing pages for
    // its data-image-id (the gallery stores the image SHA-256 there — the same value
    // the watcher filed). Bounded: a few sub-channels x 2 pages, sequential, first hit wins.
    async function resolveThumbs(list) {
      var subs = ["public"];
      try {
        if (window.dragonPushChannels) {
          var extra = window.dragonPushChannels();
          for (var si = 0; si < extra.length && subs.length < 3; si++) {
            if (subs.indexOf(extra[si]) < 0) subs.push(extra[si]);
          }
        }
      } catch (eS) {}
      if (typeof window.dragonSuperFetch !== "function" || !window.generatorName) return;
      var need = {};
      for (var li = 0; li < list.length; li++) if (list[li] && list[li].h) need[String(list[li].h)] = list[li];
      var skips = [0, 200];
      for (var s2 = 0; s2 < subs.length; s2++) {
        for (var k = 0; k < skips.length; k++) {
          var anyNeed = false;
          for (var kk in need) { anyNeed = true; break; }
          if (!anyNeed) return;
          var url = "https://image-generation.perchance.org/gallery?channel=" + encodeURIComponent(window.generatorName || "") +
            "&subChannel=" + encodeURIComponent(subs[s2]) + "&sort=recent&timeRange=all-time&contentFilter=none&imageElementsHtmlOnly=true&skip=" + skips[k] + "&__cacheBust=" + Math.random();
          var html = "";
          try { html = await window.dragonSuperFetch(url).then(function (r) { return r.text(); }); } catch (eF) { html = ""; }
          if (!html) continue;
          for (var hk in need) {
            var at = html.indexOf('data-image-id="' + hk + '"');
            if (at < 0) continue;
            var fwd = html.slice(at, Math.min(html.length, at + 12000));
            var m = /src="(https:[^"]+)"/.exec(fwd);
            if (!m) {
              var bwd = html.slice(Math.max(0, at - 8000), at);
              var all2 = bwd.match(/src="(https:[^"]+)"/g);
              if (all2 && all2.length) m = /src="(https:[^"]+)"/.exec(all2[all2.length - 1]);
            }
            if (m && m[1]) {
              try { need[hk].thumb = m[1]; } catch (eU) {}
              delete need[hk];
            }
          }
        }
      }
    }
    function repaintResolved() {
      try {
        grid.textContent = "";
        var keep = all.slice();
        all.length = 0;
        appendRows(keep);
      } catch (e) {}
    }
    function load() {
      if (rowsOverride) {   // test path: static rows, no RPC
        var rows = rowsOverride.rows || rowsOverride;
        all = []; grid.textContent = "";
        lbClose();
        counters.textContent = "";
        appendRows(rows);
        msg.textContent = "";
        msg.className = "da-msg";
        return;
      }
      all = []; grid.textContent = "";
      lbClose();
      msg.textContent = "loading inspect queue…";
      msg.className = "da-msg";
      counters.textContent = "";
      arpc("dragonWatcherList", "").then(function (raw) {
        var d = null;
        try { d = JSON.parse(raw); } catch (x) {}
        if (!d || !d.ok) {
          msg.textContent = "queue failed to load: " + String((d && d.err) || "error") + ".";
          return;
        }
        var list = d.flags || [];
        appendRows(list);
        msg.textContent = list.length ? "" : "queue is empty — nothing undecided.";
        msg.className = "da-msg";
        if (list.length) {
          msg.textContent = "resolving thumbnails…";
          resolveThumbs(list).then(function () { repaintResolved(); msg.textContent = ""; }, function () { msg.textContent = ""; });
        }
      }, function (err) {
        msg.textContent = "queue failed to load: " + String((err && err.message) || err || "error") + ".";
      });
    }
    rf.onclick = function () { load(); };
    window.__dragonAdminInspectSnapshot = function () {
      return { rows: all.length };
    };
    load();
    return win;
  }
  window.dragonAdminInspectWindow = function () {
    if (!open) openPage(false);
    if (!open) return null;
    var had = open.el.querySelector("[data-dragon-inspect-win]");
    if (had) { try { had.remove(); } catch (e) {} }
    return buildInspectWindow(open, null);
  };
  window.dragonAdminVaultTest = async function () {
    var wasOpen = !!open;
    var o = buildPage();
    o.authed = false;
    renderInto(o);
    var out = { box: false, rows: 0, thumbs: 0, hxNote: false, unbans: 0, payload: false, modal: false, stat: "" };
    var H = function (ch) { var s = ""; for (var i = 0; i < 64; i++) s += ch; return s; };
    var win = null;
    try { win = buildReportsWindow(o, []); } catch (eW) { win = null; out.err = "build:" + String((eW && eW.message) || eW); }
    try {
      var p = JSON.parse(window.dragonVaultWithout(JSON.stringify({ v: 1, updatedAt: 1, images: [H("a"), H("b")], users: ["u1", "u2"] }), H("a"), false));
      var q = JSON.parse(window.dragonVaultWithout(JSON.stringify({ v: 1, updatedAt: 1, images: [H("a")], users: ["u1", "u2"] }), "u2", true));
      out.payload = (p.images.length === 1 && p.images[0] === H("b") && p.users.length === 2 && q.users.length === 1 && q.users[0] === "u1");
    } catch (eP) { out.payload = false; }
    try {
      var tabs = win ? win.querySelectorAll("button") : [];
      var i;
      for (i = 0; i < tabs.length; i++) { if (tabs[i].textContent.indexOf("Banned images") !== -1) { tabs[i].click(); break; } }
      var rows = [];
      for (var k = 0; k < 40; k++) {
        try { rows = win.querySelectorAll("[data-dragon-vault-grid] [data-dragon-vault-row]"); } catch (eQ) { rows = []; }
        if (rows.length > 5) break;
        await new Promise(function (r) { setTimeout(r, 500); });
      }
      out.box = !!(win && win.querySelector("[data-dragon-vault-box]"));
      out.rows = rows.length;
      try {
        var st0 = win.querySelector('[data-dragon-vault-box] [data-dragon-vault-stat]');
        if (st0) out.stat = String(st0.textContent || "").slice(0, 160);
      } catch (eST) {}
      try { out.thumbs = win.querySelectorAll('[data-dragon-vault-grid] [data-dragon-vault-row] img[src^="https://aigc.uploads.dev/image/"]').length; } catch (eT) {}
      var divs = win.querySelectorAll("[data-dragon-vault-grid] div");
      for (i = 0; i < divs.length; i++) { if (divs[i].textContent === "hash ban — no picture") { out.hxNote = true; break; } }
      var btns = win.querySelectorAll("[data-dragon-vault-grid] button");
      for (i = 0; i < btns.length; i++) { if (btns[i].textContent === "Unban") out.unbans++; }
      var oldC = null;
      try { oldC = window.confirm; window.confirm = function () { return true; }; } catch (eC) {}
      try {
        for (i = 0; i < btns.length; i++) { if (btns[i].textContent === "Unban") { btns[i].click(); break; } }
        out.modal = !!document.querySelector('input[placeholder="vault edit key"]');
      } catch (eM) { out.modal = false; }
      try { window.confirm = oldC; } catch (eC2) {}
      try {
        var inp = document.querySelector('input[placeholder="vault edit key"]');
        if (inp) { var ov = inp; while (ov && !(ov.style && ov.style.position === "fixed")) ov = ov.parentNode; if (ov) ov.remove(); }
      } catch (eX) {}
    } catch (eB) { out.err = String((eB && eB.message) || eB); }
    try { if (win) win.remove(); } catch (eR) {}
    close();
    out.wasOpen = wasOpen;
    return out;
  };
  window.dragonAdminInspectTest = async function (rows) {
    var wasOpen = !!open;
    var o = buildPage();
    o.authed = false;
    renderInto(o);
    var H = function (ch) { var s = ""; for (var i = 0; i < 64; i++) s += ch; return s; };
    var fake = rows || [
      { h: H("a"), r: 1, e: 42, f: 4, u: "close-call: borderline", n: "", p: "a portrait", t: 1760000000 },
      { h: H("b"), r: 2, e: 75, f: 1, u: "pedo-unsure: young face?", n: "", p: "a dancer", t: 1760000100 }
    ];
    // Test thumbs ride on `thumb` directly (live entries resolve `thumb` from the gallery).
    fake[0].thumb = "https://example.com/i1.jpg";
    var win = buildInspectWindow(o, fake);
    var out = {
      opened: win.isConnected !== false,
      fixedPage: win.style.position === "fixed",
      tiles: win.querySelectorAll("[data-dragon-inspect-grid] > div").length,
      badges: Array.prototype.filter.call(win.querySelectorAll("[data-dragon-inspect-grid] b"), function (b) { return b.textContent.indexOf("\uD83D\uDD0D") === 0; }).length,
      dones: Array.prototype.filter.call(win.querySelectorAll("button"), function (b) { return b.textContent === "Done"; }).length,
      hasRefresh: !!win.querySelector("[data-dragon-inspect-refresh]"),
      hasClose: !!win.querySelector("[data-dragon-inspect-close]")
    };
    try {
      var im1 = win.querySelector("[data-dragon-inspect-grid] img");
      if (im1) im1.click();
      out.lightbox = !!document.querySelector("[data-dragon-inspect-win]") && !!document.body.lastChild;
    } catch (e) { out.lightbox = false; }
    try { win.querySelector("[data-dragon-inspect-close]").click(); } catch (e2) {}
    out.closed = !o.el.querySelector("[data-dragon-inspect-win]");
    close();
    out.wasOpen = wasOpen;
    return out;
  };
  window.dragonAdminLikedWindow = function () {
    if (!open) openPage(false);
    if (!open) return null;
    var had = open.el.querySelector("[data-dragon-liked-win]");
    if (had) { try { had.remove(); } catch (e) {} }
    return buildLikedWindow(open, null);
  };
  window.dragonAdminLikedTest = async function (rows) {
    var wasOpen = !!open;
    var o = buildPage();
    o.authed = false;
    renderInto(o);
    if (rows === "live") {
      // Live path: real diag + real G-slot pages (emulator-safe; reads only, no auth).
      var winL = buildLikedWindow(o, null);
      var snap = null;
      for (var i = 0; i < 40; i++) {
        try { snap = window.__dragonAdminLikedSnapshot ? window.__dragonAdminLikedSnapshot() : null; } catch (eS) { snap = null; }
        if (snap && snap.rows >= 100) break;
        await new Promise(function (r) { setTimeout(r, 500); });
      }
      var more = winL.querySelector("[data-dragon-liked-more]");
      if (more && !more.hidden) more.click();
      for (var j = 0; j < 20; j++) {
        try { snap = window.__dragonAdminLikedSnapshot ? window.__dragonAdminLikedSnapshot() : null; } catch (eS2) { snap = null; }
        if (snap && snap.done) break;
        await new Promise(function (r) { setTimeout(r, 500); });
      }
      var outL = { live: true, rows: snap ? snap.rows : -1, total: snap ? snap.total : -1,
        done: !!(snap && snap.done), gallery: snap ? snap.gallery : "" };
      try { winL.querySelector("[data-dragon-liked-close]").click(); } catch (e) {}
      outL.closed = !o.el.querySelector("[data-dragon-liked-win]");
      close();
      outL.wasOpen = wasOpen;
      return outL;
    }
    var fake = rows || [{ g: "bestaigen", t: "e0a928d5", c: 21, r: 0, x: 0, u: "https://example.com/t1.jpg" },
      { g: "bestaigen", t: "d75670de", c: 17, r: 0, x: 0, u: "https://example.com/t2.jpg" }];
    var win = buildLikedWindow(o, fake);
    var out = {
      opened: win.isConnected !== false,
      fixedPage: win.style.position === "fixed",
      tiles: win.querySelectorAll("[data-dragon-liked-grid] > div").length,
      selects: win.querySelectorAll("select").length,
      applies: Array.prototype.filter.call(win.querySelectorAll("button"), function (b) { return b.textContent === "Apply"; }).length,
      defSeat: (win.querySelector("[data-dragon-liked-grid] select") || {}).value,
      hasRefresh: !!win.querySelector("[data-dragon-liked-refresh]"),
      hasClose: !!win.querySelector("[data-dragon-liked-close]")
    };
    try {
      var im1 = win.querySelector("[data-dragon-liked-grid] img");
      if (im1) im1.click();
      var lb = document.querySelector("[data-dragon-liked-lb]");
      out.lbOpened = !!lb;
      out.lbCaption = lb ? String(lb.textContent || "").slice(0, 40) : "";
      var nx = lb ? Array.prototype.filter.call(lb.querySelectorAll("button"), function (b) { return b.textContent === "Next"; })[0] : null;
      if (nx) nx.click();
      out.lbNextOk = !!document.querySelector("[data-dragon-liked-lb]");
      var cb = document.querySelector("[data-dragon-liked-lb]") ?
        Array.prototype.filter.call(document.querySelector("[data-dragon-liked-lb]").querySelectorAll("button"), function (b) { return b.textContent === "Close"; })[0] : null;
      if (cb) cb.click();
      out.lbClosed = !document.querySelector("[data-dragon-liked-lb]");
    } catch (eLB) { out.lbErr = String(eLB).slice(0, 80); }
    try { win.querySelector("[data-dragon-liked-close]").click(); } catch (e) {}
    out.closed = !o.el.querySelector("[data-dragon-liked-win]");
    close();
    out.wasOpen = wasOpen;
    return out;
  };
  window.dragonAdminReportsWindow = function (rows) {
    if (!open) openPage(false);
    if (!open) return null;
    var had = open.el.querySelector("[data-dragon-reports-win]");
    if (had) { try { had.remove(); } catch (e) {} }
    return buildReportsWindow(open, rows || null);
  };
  window.dragonAdminReportsTest = async function (rows) {
    var wasOpen = !!open;
    var o = buildPage();
    o.authed = false;
    renderInto(o);
    var fake = rows || [
      { id: 7, r: 1, t: Math.floor(Date.now() / 1000) - 60, i: "aa", u: "", o: "bb", c: "bestaigen", s: "public", p: "a red cat", n: "test note" },
      { id: 8, r: 3, t: Math.floor(Date.now() / 1000), i: "aa", u: "", o: "bb", c: "bestaigen", s: "public", p: "a red cat", n: "" }
    ];
    var win = buildReportsWindow(o, fake);
    for (var i = 0; i < 60; i++) { if (!/loading/.test(win.textContent || "")) break; await new Promise(function (r) { setTimeout(r, 80); }); }
    var wr = win.getBoundingClientRect();
    var out = {
      opened: win.isConnected !== false,
      blocks: win.querySelectorAll(".dg-admin-block").length,
      hasRefresh: !!win.querySelector("[data-dragon-reports-refresh]"),
      hasClose: !!win.querySelector("[data-dragon-reports-close]"),
      isWindow: wr.width > 0 && wr.height > 0,
      fits: wr.width > 0 && wr.right <= window.innerWidth + 1 && wr.bottom <= window.innerHeight + 1
    };
    win.querySelector("[data-dragon-reports-close]").click();
    out.closed = !o.el.querySelector("[data-dragon-reports-win]");
    close();
    out.wasOpen = wasOpen;
    return out;
  };
  window.dragonAdminScanTest = async function (leaveOpen) {
    var out = { toggled: false, tiles: 0, banBtns: 0, banMarked: false };
    var o = buildPage();
    o.authed = false;
    renderInto(o);
    var now = Math.floor(Date.now() / 1000);
    var win = buildReportsWindow(o, [{ id: 9, r: 1, t: now, i: "zz", u: "", o: "", c: "bestaigen", s: "public", p: "x", n: "" }]);
    var tg = win.querySelector("[data-dragon-scan-toggle]");
    if (!tg) { close(); out.error = "no toggle"; return out; }
    tg.click();
    out.toggled = true;
    var btns = Array.prototype.slice.call(win.querySelectorAll("button"));
    var load = btns.filter(function (b) { return b.textContent === "Load"; })[0];
    if (!load) { close(); out.error = "no load"; return out; }
    load.click();
    var banBtns = [];
    for (var k = 0; k < 300; k++) {
      banBtns = Array.prototype.slice.call(win.querySelectorAll("button")).filter(function (b) { return b.textContent.indexOf("Ban image") !== -1; });
      if (banBtns.length) break;
      await new Promise(function (r) { setTimeout(r, 500); });
    }
    out.tiles = banBtns.length;
    if (!banBtns.length) { if (!leaveOpen) close(); out.error = "no tiles"; return out; }
    var tile0 = banBtns[0].parentNode.parentNode;
    var bb = tile0.querySelectorAll("button");
    out.banBtns = bb.length;
    var realRpc = window.dragonServerRpc;
    window.dragonServerRpc = function () { return Promise.resolve(JSON.stringify({ ok: true })); };
    try {
      var ban = null;
      for (var b = 0; b < bb.length; b++) { if (bb[b].textContent.indexOf("Ban image") !== -1) ban = bb[b]; }
      if (ban) ban.click();
      for (var j = 0; j < 40; j++) {
        if (/banned for everyone|device only|Banned/.test(tile0.textContent)) { out.banMarked = /banned for everyone|Banned/.test(tile0.textContent); break; }
        await new Promise(function (r) { setTimeout(r, 250); });
      }
    } finally { window.dragonServerRpc = realRpc; }
    if (!leaveOpen) { try { win.querySelector("[data-dragon-reports-close]").click(); } catch (e) {} try { close(); } catch (eC) {} }
    return out;
  };
  // The check-up's hook: builds the page, opens the Popups window with exactly these rows and measures it.
  window.dragonAdminPopupsTest = async function (rows) {
    var wasOpen = !!open;
    var o = buildPage();
    o.authed = false;
    renderInto(o);
    var fake = rows || [
      { m: 2, v: 120, a: 44, l: Math.floor(Date.now() / 1000), c: [] },
      { m: 1, v: 300, a: 90, l: Math.floor(Date.now() / 1000), c: [[0, 40], [1, 12]] }
    ];
    var win = buildPopupsWindow(o, fake);
    for (var i = 0; i < 60; i++) { if (!/loading/.test(win.textContent || "")) break; await new Promise(function (r) { setTimeout(r, 80); }); }
    var wr = win.getBoundingClientRect();
    var out = {
      opened: win.isConnected !== false,
      blocks: win.querySelectorAll(".dg-admin-block").length,
      titles: Array.prototype.slice.call(win.querySelectorAll(".dg-admin-block h4")).map(function (h) { return String(h.textContent || "").slice(0, 42); }),
      hasRefresh: !!win.querySelector("[data-dragon-popups-refresh]"),
      hasClose: !!win.querySelector("[data-dragon-popups-close]"),
      isWindow: wr.width > 0 && wr.height > 0,
      fits: wr.width > 0 && wr.right <= window.innerWidth + 1 && wr.bottom <= window.innerHeight + 1
    };
    win.querySelector("[data-dragon-popups-close]").click();
    out.closed = !o.el.querySelector("[data-dragon-popups-win]");
    close();
    out.wasOpen = wasOpen;
    return out;
  };

  // ---- 📋 THE RECORD PANELS: FEEDBACK (FL) AND WORKLIST (WL) (W-UI313 / W-UI314, Egon 25.09.2026) -------
  // Egon: the FL list must stop being pasted under every chat reply — it belongs on a page behind the admin
  // door, and the SAME page must exist for the open work items (WL). Both record sets live in the ENCRYPTED
  // books (src/BOOKS/Feedbacklist.enc / src/BOOKS/Worklist.enc) which are their single source of truth, so this panel
  // reads them READ-ONLY: it fetches the book and decrypts it in the browser with the vault passphrase.
  // Consequences that are deliberate: no Turkish ever ships in the clear (rule I32/78), the passphrase is
  // held in MEMORY for this session only (never written to storage), and there is NO write path — closing or
  // editing a record stays an edit to the book by the agent. Each record is rendered from a machine-readable
  // `@REC|` line at the top of the book (so the panel never has to guess), with the book's prose blocks as
  // the archive; the plain-language wording, the opening date and the F/R/S score of every record are what
  // Egon asked to see without having to ask "what was this?".
  var vaultPw = "";                                        // in-memory only; cleared when the page closes
  // 26.09.2026 code system (Egon): a work record is `W-<CATEGORY><number>`, a package is
  // `WP-<CATEGORY><number>` (src/BOOKS/workspaceplan.enc) and a feedback record is `FEED-<number>`
  // (src/BOOKS/Feedbacklist.enc). The old `WL-`/`FL-` prefixes are retired - the numbers never changed, only a
  // category code was put in front of them (the old work item WL-318 is now W-EFOR318, its package WP-EFOR001).
  var REC_FILES = { FEED: "src/BOOKS/Feedbacklist.enc", W: "src/BOOKS/Worklist.enc", WP: "src/BOOKS/workspaceplan.enc" };
  function b64ToBytes(s) { var bin = atob(String(s || "")); var u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  async function lencDecrypt(pw, raw) {
    var p = String(raw || "").split("|");
    if (p.length < 4 || p[0] !== "LENC1") throw new Error("not an encrypted book");
    var base = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(pw)), "PBKDF2", false, ["deriveKey"]);
    var key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64ToBytes(p[1]), iterations: 250000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    var pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(p[2]) }, key, b64ToBytes(p[3]));
    return new TextDecoder().decode(pt);
  }
  // The book's prose blocks: every `## FL-n · WL-m · title` / `## WL-n (Fx-Ry-Sz) - title` header plus the
  // LAST `Status:` line inside that block (the same rule the books' own counters use).
  function scanBlocks(text, kind) {
    var lines = String(text || "").split(/\r?\n/);
    var out = [], cur = null;
    for (var i = 0; i < lines.length; i++) {
      var live = (kind === "FEED") ? /^#{2,3}\s*FEED-\d+/.test(lines[i]) : /^#{2,3}\s*W-[A-Z]+\d+/.test(lines[i]);
      if (live) {
        var no = (lines[i].match(kind === "FEED" ? /FEED-\d+/ : /W-[A-Z]+\d+/) || [""])[0];
        var title = "", linked = "", frs = "";
        if (kind === "FEED") {
          var mf = lines[i].replace(/^#{2,3}\s*FEED-\d+\s*/, "").replace(/^\s*[·|]\s*/, "");
          var mo = mf.match(/^\s*(W-[A-Z]+\d+)\s*[·|]\s*(.*)$/);
          if (mo) { linked = mo[1]; title = mo[2]; } else title = mf;
        } else {
          var mw = lines[i].match(/^#{2,3}\s*W-[A-Z]+\d+\s*\(([^)]*)\)\s*[-–—]?\s*(.*)$/);
          if (mw) { frs = mw[1]; title = mw[2]; } else title = lines[i].replace(/^#{2,3}\s*W-[A-Z]+\d+\s*[-–—]?\s*/, "");
        }
        cur = { no: no, title: String(title || "").trim(), linked: String(linked || "").trim(), frs: String(frs || "").trim(), status: "", open: false };
        out.push(cur);
      } else if (cur) {
        // a `Status:` written inside a code span is a description of the counting method, not a status
        var sm = lines[i].replace(/`[^`]*`/g, " ").match(/Status\s*:\s*([^\n]+)/);
        if (sm) cur.status = sm[1].trim();
      }
    }
    for (var j = 0; j < out.length; j++) {
      var st = out[j].status;
      out[j].open = /OPEN|AÇIK|ACIK/i.test(st) && !/CLOSED|KAPALI|DONE|DEFERRED|ERTELEN/i.test(st);
    }
    return out;
  }
  // One `@REC|` line per OPEN record is the panel's data contract:
  //   @REC|<no>|<linked>|<opened>|<F>|<R>|<S>|<status>|<build>|<plain wording>|<expected from Egon>|<package>
  function mergeRecords(text, kind) {
    var scanned = scanBlocks(text, kind), byNo = {};
    for (var i = 0; i < scanned.length; i++) byNo[scanned[i].no] = scanned[i];
    var lines = String(text || "").split(/\r?\n/), full = [], covered = {};
    for (var j = 0; j < lines.length; j++) {
      if (lines[j].slice(0, 5) !== "@REC|") continue;
      var f = lines[j].split("|"), no = String(f[1] || "").trim();
      if (!no) continue;
      var base = byNo[no] || {};
      var st = String(f[7] || base.status || "").trim();
      full.push({ no: no, linked: String(f[2] || base.linked || "").trim(), opened: String(f[3] || "").trim(),
        f: String(f[4] || "").trim(), r: String(f[5] || "").trim(), s: String(f[6] || "").trim(),
        status: st, build: String(f[8] || "").trim(), ne: String(f[9] || "").trim(), exp: String(f[10] || "").trim(),
        pkg: String(f[11] || "").trim(),
        title: String(base.title || "").trim(), open: /OPEN|AÇIK/i.test(st) });
      covered[no] = 1;
    }
    var rest = [];
    for (var w = 0; w < scanned.length; w++) if (!covered[scanned[w].no]) rest.push(scanned[w]);
    function byNoDesc(a, b) { return (parseInt(String(b.no).replace(/\D/g, ""), 10) || 0) - (parseInt(String(a.no).replace(/\D/g, ""), 10) || 0); }
    full.sort(byNoDesc); rest.sort(byNoDesc);
    return { full: full, rest: rest };
  }
  function frsText(rec) {
    if (rec.f || rec.r || rec.s) return "F" + (rec.f || "?") + " \u00B7 R" + (rec.r || "?") + " \u00B7 S" + (rec.s || "?");
    return rec.frs || "\u2014";
  }
  function recordCard(rec, kind) {
    var blk = el("div", "dg-admin-block");
    blk.setAttribute("data-dragon-rec", rec.no);
    var head = el("h4", null, rec.no + (rec.linked ? " \u00B7 " + rec.linked : "") + (rec.title ? " \u00B7 " + rec.title : ""));
    blk.appendChild(head);
    var kpis = el("div", "dg-admin-kpis");
    kpis.append(kpi("opened", rec.opened || "\u2014"), kpi("F/R/S", frsText(rec)), kpi("status", rec.open ? "OPEN" : "closed"));
    if (rec.build && rec.build !== "\u2014") kpis.appendChild(kpi("delivered in", rec.build));
    if (rec.pkg && rec.pkg !== "\u2014") kpis.appendChild(kpi("package", rec.pkg));
    blk.appendChild(kpis);
    var rows = el("table", "dg-admin-t");
    function row(label, value) {
      if (!value || value === "\u2014") return;
      var tr = el("tr");
      tr.appendChild(el("td", null, label));
      var td = el("td"); td.style.textAlign = "left"; td.textContent = value;
      tr.appendChild(td);
      rows.appendChild(tr);
    }
    row("What it is", rec.ne);
    row("Expected from you", rec.exp);
    row("Full status", rec.status);
    if (rows.childNodes.length) blk.appendChild(rows);
    return blk;
  }
  function recordsContent(recs, kind, note) {
    var host = el("div", null);
    var label = kind === "FEED" ? "feedback record" : "work item";
    var kpis = el("div", "dg-admin-kpis");
    kpis.append(kpi("open " + label + "s", recs.full.length), kpi("archived", recs.rest.length),
      kpi("total", recs.full.length + recs.rest.length), kpi("records via", "@REC index"));
    host.appendChild(kpis);
    host.appendChild(el("div", "dg-admin-note",
      "Read-only: this page opens the encrypted book in your browser and never writes. A record is closed or changed by editing the book." + (note ? " (" + note + ")" : "")));
    if (!recs.full.length && !recs.rest.length) { host.appendChild(el("div", "dg-admin-empty", "No record found in this book.")); return host; }
    if (recs.full.length) {
      var open = section("\uD83D\uDD13 OPEN \u2014 waiting for your word (" + recs.full.length + ")");
      for (var i = 0; i < recs.full.length; i++) open.appendChild(recordCard(recs.full[i], kind));
      host.appendChild(open);
    }
    if (recs.rest.length) {
      var closed = section("\uD83D\uDD12 Archive \u2014 already closed (" + recs.rest.length + ")",
        "The full story of a closed record is in the book's prose section below its header.");
      var t = el("table", "dg-admin-t");
      var th = el("tr");
      ["no", "work item", "what it was", "status"].forEach(function (h) { th.appendChild(el("th", null, h)); });
      t.appendChild(th);
      for (var j = 0; j < recs.rest.length; j++) {
        var r = recs.rest[j], tr = el("tr");
        tr.appendChild(el("td", null, r.no));
        tr.appendChild(el("td", null, r.linked || "\u2014"));
        tr.appendChild(el("td", null, String(r.title || "").slice(0, 90)));
        tr.appendChild(el("td", null, /CLOSED|KAPALI|DONE/i.test(r.status) ? String(r.status).slice(0, 46) : (r.status || "\u2014").slice(0, 46)));
        t.appendChild(tr);
      }
      closed.appendChild(t);
      host.appendChild(closed);
    }
    return host;
  }
  function buildRecordsWindow(o, kind, bookText, recsOverride) {
    var win = el("div", "da-records");
    win.setAttribute("data-dragon-records-win", kind);
    win.style.cssText = "position:fixed;left:0;right:0;top:0;bottom:0;z-index:2147483640;display:flex;flex-direction:column;" +
      "border:1px solid var(--dt-border,#4a4a58);border-radius:12px;background:var(--dt-bg,#131516);box-shadow:0 14px 44px rgba(0,0,0,.6);overflow:hidden;";
    var head = el("div", "da-head");
    head.style.cssText = "margin:0;padding:.55rem .7rem;";
    head.appendChild(el("div", "da-title", kind === "FEED" ? "\uD83D\uDCCB Feedback (FEED)" : "\uD83D\uDCCB Work list (W)"));
    var rf = el("button", "da-btn", "\u21BB Refresh"); rf.type = "button"; rf.setAttribute("data-dragon-records-refresh", kind);
    var cl = el("button", "da-btn", "\u2715 Close"); cl.type = "button"; cl.setAttribute("data-dragon-records-close", kind);
    cl.onclick = function () { try { win.remove(); } catch (e) {} };
    head.append(rf, cl);
    var body = el("div", null);
    body.style.cssText = "flex:1 1 auto;overflow:auto;min-height:0;padding:.6rem .7rem;text-align:left;";
    win.append(head, body);
    o.el.appendChild(win);

    function paint(recs, note) { body.textContent = ""; body.appendChild(recordsContent(recs, kind, note)); }
    function ask(msg) {
      body.textContent = "";
      var f = el("div", "da-form");
      f.appendChild(el("label", "da-lbl", "Books passphrase"));
      var inp = el("input", "da-input"); inp.type = "password"; inp.autocomplete = "off"; inp.setAttribute("data-dragon-records-pw", kind);
      f.appendChild(inp);
      var row = el("div", "da-row");
      var go = el("button", "da-btn is-primary", "\uD83D\uDD13 Unlock"); go.type = "button";
      row.appendChild(go);
      f.appendChild(row);
      if (msg) { var m = el("div", "da-msg", msg); m.setAttribute("data-dragon-records-msg", kind); f.appendChild(m); }
      f.appendChild(el("div", "dg-admin-note", "Kept in memory for this session only \u2014 never stored. The book itself is encrypted; without this passphrase the page can show nothing."));
      body.appendChild(f);
      function attempt() {
        var v = String(inp.value || "");
        if (!v) return;
        vaultPw = v;
        if (typeof window.dragonServerRpc !== "function") { /* not needed: the book is a plain file */ }
        load();
      }
      go.onclick = attempt;
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); attempt(); } });
      try { inp.focus(); } catch (e) {}
    }
    async function load() {
      if (recsOverride) { paint(recsOverride, "synthetic test data"); return; }
      if (!vaultPw) { ask(""); return; }
      body.textContent = "";
      body.appendChild(el("div", "dg-admin-empty", "reading the book\u2026"));
      try {
        var r = await fetch(REC_FILES[kind], { cache: "no-store" });
        if (!r.ok) throw new Error("book not found (save the generator first)");
        var text = await lencDecrypt(vaultPw, await r.text());
        paint(mergeRecords(text, kind), null);
      } catch (e) {
        vaultPw = "";
        ask("Could not open the book (" + String((e && e.message) || e).slice(0, 60) + ").");
      }
    }
    if (recsOverride) { rf.onclick = load; load(); }
    else if (vaultPw) { rf.onclick = load; load(); }
    else { rf.onclick = function () { vaultPw = ""; ask(""); }; ask(""); }
    return win;
  }
  // 📦 PACKAGES (26.09.2026, Egon) - the workspaceplan's WP-<CATEGORY><number> packages, read from
  // the same encrypted book. One row per package: its code, its category, what it is, whether it is still
  // open, and which work records (W-<CATEGORY><number>) belong to it. This is the page Egon uses to decide
  // which package gets priority, so the table is the whole point - no prose needed.
  function parsePackages(text) {
    var lines = String(text || "").split(/\r?\n/), out = [], seen = {};
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(/^\|\s*(WP-[A-Z]+\d+)\s*\|\s*([A-Z]+)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*$/);
      if (!m || seen[m[1]]) continue;
      seen[m[1]] = 1;
      out.push({ code: m[1], cat: m[2], title: m[3].trim(), status: m[4].trim(), members: m[5].trim() });
    }
    return out;
  }
  function packagesContent(rows) {
    var host = el("div", null);
    var openN = 0;
    for (var i = 0; i < rows.length; i++) if (!/KAPALI|CLOSED|TAMAM|DONE/i.test(rows[i].status)) openN++;
    var kpis = el("div", "dg-admin-kpis");
    kpis.append(kpi("packages", rows.length), kpi("open", openN), kpi("done", rows.length - openN), kpi("code system", "WP-<CAT><no>"));
    host.appendChild(kpis);
    host.appendChild(el("div", "dg-admin-note",
      "Read-only. A package closes only when every work record inside it is done. The code states the category: UI / UX / LOC / FEAT / PERF / REL / DATA / SEC / CLEAN / EFOR / SEO / SOC / DOC."));
    if (!rows.length) { host.appendChild(el("div", "dg-admin-empty", "No package found in this book.")); return host; }
    var t = el("table", "dg-admin-t");
    var th = el("tr");
    ["code", "category", "what it is", "status", "work records"].forEach(function (h) { th.appendChild(el("th", null, h)); });
    t.appendChild(th);
    for (var j = 0; j < rows.length; j++) {
      var r = rows[j], tr = el("tr");
      tr.setAttribute("data-dragon-pkg", r.code);
      tr.appendChild(el("td", null, r.code));
      tr.appendChild(el("td", null, r.cat));
      var td = el("td"); td.style.textAlign = "left"; td.textContent = r.title; tr.appendChild(td);
      tr.appendChild(el("td", null, r.status || "\u2014"));
      var tm = el("td"); tm.style.textAlign = "left"; tm.textContent = r.members || "\u2014"; tr.appendChild(tm);
      t.appendChild(tr);
    }
    host.appendChild(t);
    return host;
  }
  function buildPackagesWindow(o, rowsOverride) {
    var win = el("div", "da-records");
    win.setAttribute("data-dragon-records-win", "WP");
    win.style.cssText = "position:fixed;left:0;right:0;top:0;bottom:0;z-index:2147483640;display:flex;flex-direction:column;" +
      "border:1px solid var(--dt-border,#4a4a58);border-radius:12px;background:var(--dt-bg,#131516);box-shadow:0 14px 44px rgba(0,0,0,.6);overflow:hidden;";
    var head = el("div", "da-head");
    head.style.cssText = "margin:0;padding:.55rem .7rem;";
    head.appendChild(el("div", "da-title", "\uD83D\uDCE6 Packages (WP)"));
    var rf = el("button", "da-btn", "\u21BB Refresh"); rf.type = "button"; rf.setAttribute("data-dragon-records-refresh", "WP");
    var cl = el("button", "da-btn", "\u2715 Close"); cl.type = "button"; cl.setAttribute("data-dragon-records-close", "WP");
    cl.onclick = function () { try { win.remove(); } catch (e) {} };
    head.append(rf, cl);
    var body = el("div", null);
    body.style.cssText = "flex:1 1 auto;overflow:auto;min-height:0;padding:.6rem .7rem;text-align:left;";
    win.append(head, body);
    o.el.appendChild(win);
    function paint(rows, note) {
      body.textContent = "";
      if (note) body.appendChild(el("div", "dg-admin-note", note));
      body.appendChild(packagesContent(rows));
    }
    function ask(msg) {
      body.textContent = "";
      var fm = el("div", "da-form");
      fm.appendChild(el("label", "da-lbl", "Books passphrase"));
      var inp = el("input", "da-input"); inp.type = "password"; inp.autocomplete = "off"; inp.setAttribute("data-dragon-records-pw", "WP");
      fm.appendChild(inp);
      var row = el("div", "da-row");
      var go = el("button", "da-btn is-primary", "\uD83D\uDD13 Unlock"); go.type = "button";
      row.appendChild(go); fm.appendChild(row);
      if (msg) { var m = el("div", "da-msg", msg); m.setAttribute("data-dragon-records-msg", "WP"); fm.appendChild(m); }
      fm.appendChild(el("div", "dg-admin-note", "Kept in memory for this session only \u2014 never stored. The book itself is encrypted; without this passphrase the page can show nothing."));
      body.appendChild(fm);
      function attempt() { var v = String(inp.value || ""); if (!v) return; vaultPw = v; load(); }
      go.onclick = attempt;
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); attempt(); } });
      try { inp.focus(); } catch (e) {}
    }
    async function load() {
      if (rowsOverride) { paint(rowsOverride, "synthetic test data"); return; }
      if (!vaultPw) { ask(""); return; }
      body.textContent = "";
      body.appendChild(el("div", "dg-admin-empty", "reading the book\u2026"));
      try {
        var r = await fetch(REC_FILES.WP, { cache: "no-store" });
        if (!r.ok) throw new Error("book not found (save the generator first)");
        var text = await lencDecrypt(vaultPw, await r.text());
        paint(parsePackages(text), null);
      } catch (e) {
        vaultPw = "";
        ask("Could not open the book (" + String((e && e.message) || e).slice(0, 60) + ").");
      }
    }
    if (rowsOverride) { rf.onclick = load; load(); }
    else if (vaultPw) { rf.onclick = load; load(); }
    else { rf.onclick = function () { vaultPw = ""; ask(""); }; ask(""); }
    return win;
  }
  function openPackagesWindow() {
    if (!open) openPage(false);
    if (!open) return null;
    var had = open.el.querySelector("[data-dragon-records-win='WP']");
    if (had) { try { had.remove(); } catch (e) {} }
    return buildPackagesWindow(open, null);
  }
  window.dragonAdminPackagesWindow = function () { return openPackagesWindow(); };
  // The check-up's hook: parses exactly this synthetic workspaceplan text and measures the table.
  window.dragonAdminPackagesTest = async function (bookText) {
    var rows = parsePackages(bookText || "");
    var wasOpen = !!open;
    var o = buildPage();
    o.authed = false;
    renderInto(o);
    var win = buildPackagesWindow(o, rows);
    var wr = win.getBoundingClientRect();
    var out = {
      rows: win.querySelectorAll("[data-dragon-pkg]").length,
      kpis: win.querySelectorAll(".dg-kpi").length,
      isWindow: wr.width > 0 && wr.height > 0,
      fits: wr.width > 0 && wr.right <= window.innerWidth + 1 && wr.bottom <= window.innerHeight + 1,
      text: String(win.textContent || "").replace(/\s+/g, " ").slice(0, 2000)
    };
    win.querySelector("[data-dragon-records-close]").click();
    out.closed = !o.el.querySelector("[data-dragon-records-win='WP']");
    close();
    out.wasOpen = wasOpen;
    return out;
  };

  function openRecordsWindow(kind) {
    if (!open) openPage(false);
    if (!open) return null;
    var had = open.el.querySelector("[data-dragon-records-win='" + kind + "']");
    if (had) { try { had.remove(); } catch (e) {} }
    return buildRecordsWindow(open, kind, null, null);
  }
  window.dragonAdminFeedbackWindow = function () { return openRecordsWindow("FEED"); };
  window.dragonAdminWorklistWindow = function () { return openRecordsWindow("W"); };
  // The crypto path, exposed for a test with a THROWAWAY passphrase (never the vault one): proves that a
  // real LENC1 book decrypts in the page exactly as the books were written.
  window.dragonAdminLencTest = async function (pw, raw) { try { return { ok: true, text: await lencDecrypt(pw, raw) }; } catch (e) { return { ok: false, err: String((e && e.message) || e) }; } };
  window.dragonAdminMergeTest = function (kind, text) { return mergeRecords(text, kind); };
  // The check-up's hook: renders the panel with exactly this synthetic book text (no passphrase, no fetch,
  // nothing spent) and measures every part of it.
  window.dragonAdminRecordsTest = async function (kind, bookText, recsOverride) {
    var wasOpen = !!open;
    var o = buildPage();
    o.authed = false;
    renderInto(o);
    var recs = recsOverride || (bookText ? mergeRecords(bookText, kind || "FEED") : { full: [], rest: [] });
    var win = buildRecordsWindow(o, kind || "FEED", null, recs);
    for (var i = 0; i < 30; i++) { if (!/reading|reading the book/.test(win.textContent || "")) break; await new Promise(function (r) { setTimeout(r, 80); }); }
    var wr = win.getBoundingClientRect();
    var out = {
      kind: kind || "FEED",
      opened: win.isConnected !== false,
      cards: win.querySelectorAll("[data-dragon-rec]").length,
      tables: win.querySelectorAll(".dg-admin-t").length,
      kpis: win.querySelectorAll(".dg-kpi").length,
      sections: win.querySelectorAll(".dg-admin-block").length,
      hasRefresh: !!win.querySelector("[data-dragon-records-refresh]"),
      hasClose: !!win.querySelector("[data-dragon-records-close]"),
      isWindow: wr.width > 0 && wr.height > 0,
      fits: wr.width > 0 && wr.right <= window.innerWidth + 1 && wr.bottom <= window.innerHeight + 1,
      text: String(win.textContent || "").replace(/\s+/g, " ").slice(0, 3000),
      sample: String(win.textContent || "").replace(/\s+/g, " ").slice(0, 260)
    };
    win.querySelector("[data-dragon-records-close]").click();
    out.closed = !o.el.querySelector("[data-dragon-records-win='" + (kind || "FEED") + "']");
    close();
    out.wasOpen = wasOpen;
    return out;
  };

  // ---- opening / closing ------------------------------------------------------------------------------
  function openPage(force) {
    if (open) return true;
    var back = "";
    try { back = String(location.hash || ""); } catch (e) {}
    if (back === HASH_NAME) back = "";
    var o = buildPage();
    o.backHash = back;
    open = o;
    try {
      if (window.dragonSharedTopic && !o.holdRelease) o.holdRelease = window.dragonSharedTopic("dragon-admin", function () {});
    } catch (eH) {}
    try { document.body.style.overflow = "hidden"; } catch (eB) {}
    // The SERVER decides: if this connection already passed the pair check, go straight to the report.
    // A remembered session token (never the password) is re-validated the same way before it is trusted.
    o.authed = authKnown === true;
    if (!o.authed && !adminTok) { try { var _st = adminTokLoad(); if (_st) adminTok = _st; } catch (eS) {} }
    renderInto(o);
    if (authKnown !== true && typeof window.dragonServerRpc === "function") {
      arpc("dragonAdminState", "").then(function (raw) {
        var d = null;
        try { d = JSON.parse(raw); } catch (e) { d = null; }
        authKnown = !!(d && d.authed);
        if (authKnown !== true && adminTok) { adminTok = ""; adminTokClear(); }
        // Egon 29.10.2026 (A1, fail-closed + diagnosis) — auto-unlock only a page that never
        // refused a pair; otherwise stay locked (the wrong pair itself is refused server-side).
        if (open === o && authKnown === true && !o.authed) {
          if (o.failedAttempts) { say("server reports an authed connection, but this page already refused a pair — staying locked"); }
          else { try { say("auto-unlock: the server reports this connection is already authed" + (adminTok ? " (remembered session)" : "")); } catch (eS) {} o.authed = true; renderInto(o); }
        }
      }).catch(function () {});
    }
    return true;
  }
  function close() {
    if (!open) return false;
    var o = open;
    open = null;
    try { if (o.holdRelease) o.holdRelease(); } catch (eH2) {}
    try { document.body.style.overflow = ""; } catch (eB2) {}
    try { o.el.remove(); } catch (e) {}
    try { document.removeEventListener("keydown", o.onKey, true); } catch (e) {}
    try {
      var back = o.backHash || "";
      var want = location.pathname + location.search + back;
      if (String(location.hash || "") === HASH_NAME) history.replaceState(null, "", want);
    } catch (e) {}
    return true;
  }
  window.dragonAdminOpen = function () { return openPage(true); };
  window.dragonAdminClose = function () { return close(); };
  window.dragonAdminLock = function () { adminTok = ""; adminTokClear(); if (open) { open.authed = false; authKnown = false; renderInto(open); } return true; };

  // The check-up's hooks. `dragonAdminReportTest(rows)` renders the report view with exactly those rows —
  // a pure RENDERING test (no password, no server write, nothing spent) — and measures it.
  window.dragonAdminReportTest = async function (rows) {
    var wasOpen = !!open;
    var o = buildPage();
    o.authed = false;
    o.body.textContent = "";
    addLogout(o);
    buildReport(o, rows || null);
    for (var i = 0; i < 80; i++) {
      if (!/loading/.test(o.body.textContent || "")) break;
      await new Promise(function (r) { setTimeout(r, 100); });
    }
    var out = {
      page: !!o.el,
      isPage: !!o.el && String(o.el.id) === PAGE_ID,
      blocks: o.body.querySelectorAll(".dg-admin-block").length,
      tables: o.body.querySelectorAll(".dg-admin-t").length,
      rows: o.body.querySelectorAll(".dg-admin-t tbody tr").length,
      kpis: o.body.querySelectorAll(".dg-kpi").length,
      empty: o.body.querySelectorAll(".dg-admin-empty").length,
      hasForm: !!o.body.querySelector("[data-dragon-admin-user]") || !!o.body.querySelector("[data-dragon-admin-signin]"),
      text: String(o.body.textContent || "").replace(/\s+/g, " ").slice(0, 4000),
      sample: String(o.body.textContent || "").replace(/\s+/g, " ").slice(0, 200)
    };
    close();
    out.closed = !open;
    out.wasOpen = wasOpen;
    return out;
  };
  // The check-up's hook for the SERVER DATA PANEL (Egon 25.09.2026): builds the page, renders the dashboard
  // with exactly this synthetic payload + manifest (no credentials, no server write, nothing spent) and
  // measures every section. The REAL payload is exercised separately by the region-map / build-sync items.
  window.dragonAdminDataTest = async function (fake, fakeManifest) {
    var wasOpen = !!open;
    var o = buildPage();
    o.authed = false;
    o.body.textContent = "";
    addLogout(o);
    buildNav(o);
    var host = buildServerData(o, fake || null, fakeManifest || null);
    for (var i = 0; i < 80; i++) {
      if (!/loading/.test(o.body.textContent || "")) break;
      await new Promise(function (r) { setTimeout(r, 100); });
    }
    var tables = o.body.querySelectorAll(".dg-admin-t");
    var out = {
      page: !!o.el,
      isPage: !!o.el && String(o.el.id) === PAGE_ID,
      hasNav: !!o.body.querySelector("[data-dragon-admin-nav]"),
      tabs: Array.prototype.slice.call(o.body.querySelectorAll("[data-dragon-admin-tab]")).map(function (b) { return b.getAttribute("data-dragon-admin-tab"); }),
      hasRefresh: !!o.body.querySelector("[data-dragon-admin-refresh]"),
      hasData: !!o.body.querySelector("[data-dragon-admin-data]"),
      kpis: o.body.querySelectorAll(".dg-kpi").length,
      sections: o.body.querySelectorAll(".dg-admin-block").length,
      tables: tables.length,
      regionRows: tables.length ? tables[0].querySelectorAll("tr").length - 1 : 0,
      hasAssets: !!o.body.querySelector("[data-dragon-admin-assets]"),
      hasPayload: !!o.body.querySelector("[data-dragon-admin-payload]"),
      text: String(o.body.textContent || "").replace(/\s+/g, " ").slice(0, 3000),
      sample: String(host.textContent || "").replace(/\s+/g, " ").slice(0, 200)
    };
    close();
    out.closed = !open;
    out.wasOpen = wasOpen;
    return out;
  };
  // Cosmetic counter reset kept for the check-up's contract; the REAL limiter is on the server and cannot
  // be cleared from here (that is the whole point of moving the lock server-side).
  window.dragonAdminResetTries = function () { localTries = 0; return true; };
  window.dragonAdminState = function () {
    return { open: !!open, authed: !!(open && open.authed), serverAuthed: authKnown === true, tries: localTries, hash: String(location.hash || "") };
  };
  // Try the credential pair from a test (the check-up uses this with a DELIBERATELY wrong pair).
  window.dragonAdminTryLogin = async function (u, p) {
    if (typeof window.dragonServerRpc !== "function") return { ok: false, err: "no-rpc" };
    var raw = null;
    try { raw = await window.dragonServerRpc("dragonAdminLogin", JSON.stringify({ u: String(u == null ? "" : u), p: String(p == null ? "" : p) })); } catch (e) { raw = null; }
    var d = null;
    try { d = JSON.parse(raw); } catch (e) { d = null; }
    return d || { ok: false, err: "no-answer" };
  };
  // Runs the page's OWN sign-in path with a synthetic pair, WITHOUT typing into the credential fields: the
  // check-up used to fill them and click Sign In, which made the browser's password manager offer to save
  // "check-up-wrong" on every sweep (Egon 26.09.2026). No field is touched here.
  window.dragonAdminLoginTest = async function (u, p) {
    if (!open || typeof open.attempt !== "function") return { ok: false, authed: !!(open && open.authed), msg: "" };
    var r = await open.attempt(u, p, true);
    return { ok: !!(r && r.ok), authed: !!(open && open.authed), msg: String((r && r.msg) || ""), tries: localTries };
  };

  // ---- the address hook --------------------------------------------------------------------------------
  function isAdminHash() {
    var h = "";
    try { h = String(location.hash || ""); } catch (e) {}
    return h.toLowerCase() === HASH_NAME;
  }
  function sync() {
    if (isAdminHash()) { if (!open) openPage(false); }
    else if (open) close();
  }
  window.addEventListener("hashchange", function () { try { sync(); } catch (e) {} });
  function boot() { try { sync(); } catch (e) {} }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
