// dragon-cloud.js — moved VERBATIM out of index.html (Paket A1, 25.09.2026). Classic script
// (not a module), inserted at the same point of the boot order, so globals and ordering are unchanged.
// Rollback: paste this file's body back into index.html as a plain <script> at its old place.
  // ===== ☁️ CLOUD SETTINGS SYNC (dragon-cloud): login → settings follow the user across devices =====
  (function () {
    var user = null;                 // {u, p} where p = sha256Hex(u + ":" + password)
    var socket = null;
    var lastPushed = null;
    var syncTimer = null;
    var EXCLUDE = { dragonCloudUser: 1, antiBotKey: 1, dragonAntiBotKey: 1, dragonStatsBrowserId: 1, dragonStatsVisit: 1, dragonStatsGalCache: 1, dragonAiTextCode: 1, dragonPedoShield: 1, dragonPedoStrikes: 1, dragonPedoStrikeTime: 1, dragonPedoBannedLocal: 1, dragonPedoGrayAllow: 1 };
    var EXTRA_KEYS = ["forceColorScheme"];
    ;function getEl(id) { return document.getElementById(id); }
    ;function isSyncedKey(k) {
      if (EXCLUDE[k]) return false;
      if (k.indexOf("dragonGalCount_") === 0 || k.indexOf("localMediaGallery_") === 0) return false;
      return k.indexOf("dragon") === 0 || k.indexOf("explorer") === 0 || EXTRA_KEYS.indexOf(k) !== -1;
    }
    ;function snap() {
      var out = {};
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (!k || !isSyncedKey(k)) continue;
          out[k] = localStorage.getItem(k);
        }
      } catch (e) {}
      return out;
    }
    ;function applySet(set) {
      var n = 0;
      try {
        for (var k in set) {
          if (!isSyncedKey(k) || typeof set[k] !== "string") continue;
          if (localStorage.getItem(k) === set[k]) continue;
          localStorage.setItem(k, set[k]);
          n++;
        }
      } catch (e) {}
      return n;
    }
    ;function status(msg, color) {
      var el = getEl("dragonCloudStatus");
      if (el) { el.textContent = msg || ""; if (color) el.style.color = color; }
    }
    ;async function shaHex(str) {
      var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
      var arr = new Uint8Array(buf);
      var s = "";
      for (var i = 0; i < arr.length; i++) s += ("0" + arr[i].toString(16)).slice(-2);
      return s;
    }
    ;async function ensureSocket() {
      if (socket && socket.readyState === 1) return socket;
      if (!window.root || typeof root.createServerSocket !== "function") return null;
      try {
        socket = root.createServerSocket();
        try { if (window.dragonIdentifySocket) window.dragonIdentifySocket(socket); } catch (e2) {}
      } catch (e) { return null; }
      await new Promise(function (res) {
        var done = false;
        socket.addEventListener("open", function () { if (!done) { done = true; res(); } });
        socket.addEventListener("close", function () { if (!done) { done = true; res(); } });
        setTimeout(function () { if (!done) { done = true; res(); } }, 6000);
      });
      return socket;
    }
    ;function cloudRefreshUI() {
      var form = getEl("dragonCloudForm"), lg = getEl("dragonCloudLogged"), who = getEl("dragonCloudWho");
      if (!form) return;      var saved = null;
      try { saved = JSON.parse(localStorage.dragonCloudUser || "null"); } catch (e) {}
      if (saved && saved.u) {
        form.style.display = "none";
        lg.style.display = "flex";
        who.textContent = "";
        status("");
      } else {
        form.style.display = "flex";
        lg.style.display = "none";
        status("");
      }
      try { if (window.dragonPresenceReport) window.dragonPresenceReport(); } catch (ePR) {}
      try { if (window.dragonCloudSyncProfile) window.dragonCloudSyncProfile(); } catch (eSP) {}
      try { if (window.dragonProfileRefreshAll) window.dragonProfileRefreshAll(); } catch (eSR) {}
      try { if (window.dragonNavAccountSync) window.dragonNavAccountSync(); } catch (eNS) {}
    }
    var BACKUP_TIME_KEY = "dragonCloudBackupTime";
    function backupTime() { try { return Number(localStorage.getItem(BACKUP_TIME_KEY)) || 0; } catch (e) { return 0; } }
    function setBackupTime(t) { try { localStorage.setItem(BACKUP_TIME_KEY, String(t)); } catch (e) {} }
    async function encKey(pwHash) {
      var h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pwHash + ":setenc"));
      return crypto.subtle.importKey("raw", h, "AES-GCM", false, ["encrypt", "decrypt"]);
    }
    async function encryptSet(pwHash, obj) {
      var key = await encKey(pwHash);
      var iv = crypto.getRandomValues(new Uint8Array(12));
      var pt = new TextEncoder().encode(JSON.stringify(obj));
      var ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, pt));
      var out = new Uint8Array(12 + ct.length);
      out.set(iv, 0); out.set(ct, 12);
      return new Blob([out], { type: "application/octet-stream" });
    }
    async function decryptSet(pwHash, buf) {
      var b = new Uint8Array(buf);
      if (b.length < 13) throw new Error("short");
      var key = await encKey(pwHash);
      var pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b.slice(0, 12) }, key, b.slice(12));
      return JSON.parse(new TextDecoder().decode(pt));
    }
    ;function dragonShield(msg) {
      var old = document.getElementById("dragonCloudShield");
      if (old) { try { old.remove(); } catch (e) {} }
      if (!msg) return;
      var ov = document.createElement("div");
      ov.id = "dragonCloudShield";
      ov.style.cssText = "position:fixed; inset:0; z-index:100300; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.65); color:#ece6ff; font-size:.9rem; font-weight:700;";
      var box = document.createElement("div");
      box.style.cssText = "padding:1rem 1.4rem; border:1px solid rgba(155,107,255,.55); border-radius:12px; background:linear-gradient(180deg,#1c1230,#0d0918);";
      box.textContent = msg;
      ov.appendChild(box);
      document.body.appendChild(ov);
    }
    ;async function uploadSettingsBackup() {
      if (!user) return { ok: false, err: "nologin" };
      var sock = await ensureSocket();
      if (!sock || sock.readyState !== 1) return { ok: false, err: "noserver" };
      var blob;
      try { blob = await encryptSet(user.p, snap()); } catch (e) { return { ok: false, err: "crypto" }; }
      var up = null;
      try {
        if (window.root && root.uploadPlugin) up = await root.uploadPlugin(blob, { expires: Date.now() + 1000 * 60 * 60 * 24 * 365 });
      } catch (e) { up = null; }
      if (!up || up.error || !up.url) return { ok: false, err: (up && up.error) || "upload" };
      var now = Math.floor(Date.now() / 1000);
      var ok = await cloudProfileSave({ setUrl: up.url, setTime: now });
      if (!ok) return { ok: false, err: "profilesave" };
      setBackupTime(now);
      lastPushed = snap();
      return { ok: true, url: up.url };
    }
    ;async function syncBackupOnLogin(pwHash) {
      var prof = await cloudProfileLoad();
      if (!prof) return 0;
      if (prof.setUrl && (prof.setTime || 0) !== backupTime()) {
        var r = await fetch(prof.setUrl, { mode: "cors" });
        if (!r.ok) throw new Error("fetch " + r.status);
        var n = applySet(await decryptSet(pwHash, await r.arrayBuffer()));
        setBackupTime(prof.setTime || 0);
        lastPushed = snap();
        return n;
      }
      return 0;
    }
    ;function credFrame(u, p) {
      var ub = new TextEncoder().encode(u);
      var pw = new Uint8Array(64);
      for (var i = 0; i < 64; i++) pw[i] = p.charCodeAt(i);
      var f = new Uint8Array(1 + ub.length + 64);
      f[0] = ub.length;
      f.set(ub, 1);
      f.set(pw, 1 + ub.length);
      return f;
    }
    ;function cloudErrName(err) {
      return { bad: "wrong username or password", exists: "username already taken — try logging in", name: "username: 3–12 chars, letters and - (no leading/trailing -)", badp: "invalid password format", rate: "too many attempts — wait a minute", big: "settings too large to sync", mail: "that mail address does not look right", sec: "a secret question and answer are required", age: "you must be 18 or older to register", dob: "enter a valid birth date", country: "enter your country", gender: "pick female, male or prefer not to say" }[err] || "failed";
    }
    ;function parseLoginResp(resp) {
      var rb = new Uint8Array(resp);
      if (!rb.length) return null;
      if (rb[0] === 1) {
        var dl = rb[1] | (rb[2] << 8) | (rb[3] << 16) | (rb[4] << 24);
        var setObj = {};
        try { setObj = dl ? JSON.parse(new TextDecoder().decode(rb.slice(5, 5 + dl))) : {}; } catch (e) {}
        return { ok: true, set: setObj };
      }
      return { ok: false, err: new TextDecoder().decode(rb.slice(1)) };
    }
    ;async function cloudLogin(u, pw, isRegister) {
      dragonShield("☁️ checking your account…");
      var sock = await ensureSocket();
      if (!sock || sock.readyState !== 1) { dragonShield(null); status("⚠️ cloud server unreachable (save the generator to enable the real server)", "#ff8a80"); return; }
      var uname = u.toLowerCase();
      var ph = await shaHex(uname + ":" + pw);
      var isNew = false;
      if (isRegister) {
        var reply;
        try { reply = await sock.rpc.register(JSON.stringify({ u: u, p: ph })); }
        catch (e) { dragonShield(null); status("⚠️ error: " + String(e).slice(0, 50), "#ff8a80"); return; }
        var o = null; try { o = JSON.parse(reply); } catch (e) {}
        if (!o || !o.ok) { dragonShield(null); status("⚠️ " + cloudErrName(o && o.err), "#ff8a80"); return; }
        isNew = true;
      } else {
        var resp;
        try { resp = await sock.rpc.login(credFrame(uname, ph)); }
        catch (e) { dragonShield(null); status("⚠️ error: " + String(e).slice(0, 50), "#ff8a80"); return; }
        var res = parseLoginResp(resp);
        if (!res || !res.ok) { dragonShield(null); status("⚠️ " + cloudErrName(res && res.err), "#ff8a80"); return; }
      }
      user = { u: uname, p: ph };
      try { localStorage.dragonCloudUser = JSON.stringify(user); } catch (e) {}
      var n = 0;
      if (!isNew) {
        try {
          dragonShield("☁️ checking your backup…");
          var prof = await cloudProfileLoad();
          if (prof && prof.setUrl && (prof.setTime || 0) !== backupTime()) {
            dragonShield("☁️ downloading your settings…");
            n = await syncBackupOnLogin(ph);
          }
        } catch (e) { status("⚠️ backup download failed — keeping this browser's settings", "#ffd76a"); }
      }
      lastPushed = snap();
      dragonShield(null);
      cloudRefreshUI();
      status(isNew ? "☁️ account created — settings will now sync" : "☁️ logged in — settings restored" + (n ? " (" + n + " applied)" : ""), "#4ade80");
      if (!window.__dragonCloudNoReload && n > 0) setTimeout(function () { location.reload(); }, 1400);
    }
    ;async function cloudSaveNow() {
      if (!user) return;
      status("wait for uploading ur settings…", "#ffd76a");
      var r = null;
      try { r = await uploadSettingsBackup(); } catch (e) { r = { ok: false, err: "error" }; }
      if (r && r.ok) status("☁️ settings saved to cloud", "#4ade80");
      else status("⚠️ backup failed (" + ((r && r.err) || "error") + ") — will retry at logout", "#ff8a80");
    }
    ;async function cloudLogout() {
      if (user) {
        status("wait for uploading ur settings…", "#ffd76a");
        try { await uploadSettingsBackup(); } catch (e) {}
      }
      user = null;
      lastPushed = null;
      try { localStorage.removeItem("dragonCloudUser"); } catch (e) {}
      try { localStorage.removeItem("dragonCloudAvatar"); } catch (eAv) {}
      cloudRefreshUI();
      status("logged out — local settings stay on this device", "#ffd76a");
    }
    ;function validUser(u) { return /^[A-Za-z][A-Za-z-]{1,10}[A-Za-z]$/.test(String(u || "")); }
    ;function validPw(pw) { return /^[0-9]{8,12}$/.test(String(pw || "")); }
    window.dragonCloudHash = shaHex;
    window.dragonCloudValidUser = validUser;
    window.dragonCloudValidPw = validPw;
    ;function authedFrame() {
      var saved = null;
      try { saved = JSON.parse(localStorage.dragonCloudUser || "null"); } catch (e) {}
      if (!saved || !saved.u || !saved.p) return null;
      return { u: saved.u, frame: credFrame(saved.u, saved.p) };
    }
    ;function concatBytes(a, b) {
      var f = new Uint8Array(a.length + b.length);
      f.set(a, 0); f.set(b, a.length);
      return f;
    }
    ;async function cloudRegister(u, pw, prof) {
      var sock = await ensureSocket();
      if (!sock || sock.readyState !== 1) { status("⚠️ cloud server unreachable (save the generator to enable the real server)", "#ff8a80"); return; }
      var ph = await shaHex(u.toLowerCase() + ":" + pw);
      var key = u.toLowerCase();
      var reply;
      try { reply = await sock.rpc.register(JSON.stringify({ u: key, disp: u, p: ph, secQ: prof.secQ || "", secA: prof.secA || "", dob: prof.dob || "", country: prof.country || "", gender: prof.gender || "unspecified" })); }
      catch (e) { status("⚠️ error: " + String(e).slice(0, 50), "#ff8a80"); return; }
      var o = null; try { o = JSON.parse(reply); } catch (e2) {}
      if (!o || !o.ok) { status("⚠️ " + cloudErrName(o && o.err), "#ff8a80"); return; }
      try { getEl("dragonCloudUserIn").value = key; getEl("dragonCloudPassIn").value = pw; } catch (e3) {}
      await cloudLogin(key, pw, false);
    }
    window.dragonCloudRegister = cloudRegister;
    ;async function cloudProfileLoad() {
      var af = authedFrame();
      if (!af) return null;
      var sock = await ensureSocket();
      if (!sock || sock.readyState !== 1) return null;
      try {
        var r = await sock.rpc.cloudProfile(af.frame);
        var o = JSON.parse(r);
        if (o && o.ok) { try { localStorage.setItem("dragonCloudAvatar", o.avatar || ""); } catch (eAv) {} }
        return (o && o.ok) ? o : null;
      } catch (e) { return null; }
    }
    ;async function cloudProfileSave(patch) {
      var af = authedFrame();
      if (!af) { status("log in first", "#ffd76a"); return false; }
      var sock = await ensureSocket();
      if (!sock || sock.readyState !== 1) { status("⚠️ cloud server unreachable", "#ff8a80"); return false; }
      var jb = new TextEncoder().encode(JSON.stringify(patch));
      var head = af.frame;
      var f = new Uint8Array(head.length + 2 + jb.length);
      f.set(head, 0);
      f[head.length] = jb.length & 0xFF; f[head.length + 1] = (jb.length >> 8) & 0xFF;
      f.set(jb, head.length + 2);
      try {
        var r = await sock.rpc.cloudProfileSet(f);
        var o = JSON.parse(r);
        if (!o || !o.ok) { status("⚠️ " + cloudErrName(o && o.err), "#ff8a80"); return false; }
        return true;
      } catch (e) { status("⚠️ error: " + String(e).slice(0, 50), "#ff8a80"); return false; }
    }
    ;async function cloudPasswordChange(newPw) {
      var af = authedFrame();
      if (!af) { status("log in first", "#ffd76a"); return false; }
      var sock = await ensureSocket();
      if (!sock || sock.readyState !== 1) { status("⚠️ cloud server unreachable", "#ff8a80"); return false; }
      var nph = await shaHex(af.u + ":" + newPw);
      var nb = new Uint8Array(64);
      for (var i = 0; i < 64; i++) nb[i] = nph.charCodeAt(i);
      try {
        var r = await sock.rpc.cloudPassword(concatBytes(af.frame, nb));
        var o = JSON.parse(r);
        if (!o || !o.ok) { status("⚠️ " + cloudErrName(o && o.err), "#ff8a80"); return false; }
        try { localStorage.dragonCloudUser = JSON.stringify({ u: af.u, p: nph }); } catch (e2) {}
        user = { u: af.u, p: nph };
        return true;
      } catch (e) { status("⚠️ error: " + String(e).slice(0, 50), "#ff8a80"); return false; }
    }
    window.dragonCloudPasswordChange = cloudPasswordChange;
    ;async function cloudResetDo(u, secA, newPw) {
      var sock = await ensureSocket();
      if (!sock || sock.readyState !== 1) { status("⚠️ cloud server unreachable", "#ff8a80"); return false; }
      var nph = await shaHex(u.toLowerCase() + ":" + newPw);
      try {
        var r = await sock.rpc.cloudReset(JSON.stringify({ u: u, secA: secA, newP: nph }));
        var o = JSON.parse(r);
        if (!o || !o.ok) { status("⚠️ " + cloudErrName(o && o.err), "#ff8a80"); return false; }
        return true;
      } catch (e) { status("⚠️ error: " + String(e).slice(0, 50), "#ff8a80"); return false; }
    }
    ;async function cloudVerifyAnswer(ans) {
      var af = authedFrame();
      if (!af) return false;
      var sock = await ensureSocket();
      if (!sock || sock.readyState !== 1) return false;
      var jb = new TextEncoder().encode(JSON.stringify({ secA: ans }));
      var head = af.frame;
      var f = new Uint8Array(head.length + 2 + jb.length);
      f.set(head, 0);
      f[head.length] = jb.length & 0xFF; f[head.length + 1] = (jb.length >> 8) & 0xFF;
      f.set(jb, head.length + 2);
      try {
        var r = await sock.rpc.cloudVerify(f);
        var o = JSON.parse(r);
        return !!(o && o.ok);
      } catch (e) { return false; }
    }
    window.dragonCloudVerify = cloudVerifyAnswer;
    window.dragonCloudSecretOpen = function () {
      var m = dragonModal("Change secret question");
      var err = dragonModalErr(m.card);
      err.style.color = "#ffd76a"; err.textContent = "loading…";
      cloudProfileLoad().then(function (p) {
        if (!p || !m.card.isConnected) { err.style.color = "#ff8a80"; err.textContent = "couldn't load profile"; return; }
        err.textContent = "";
        var q = document.createElement("div");
        q.style.cssText = "font-size:.8rem; color:#d8c9ff; text-align:center; margin-bottom:.3rem;";
        q.textContent = "Your question: " + (p.secQ || "");
        m.card.appendChild(q);
        var fA = dragonField("Secret answer", { max: 120 });
        m.card.appendChild(fA.wrap);
        var row1 = dragonModalBtns(m.card, m.done, "Verify", async function () {
          var ans = fA.input.value.trim();
          if (!ans) { err.textContent = "enter your secret answer"; return; }
          err.style.color = "#ffd76a"; err.textContent = "checking…";
          var ok = await cloudVerifyAnswer(ans);
          if (!ok) { err.style.color = "#ff8a80"; err.textContent = "wrong answer"; return; }
          try { row1.parentNode.remove(); } catch (e2) {}
          q.remove(); fA.wrap.remove();
          err.textContent = "";
          var fQ = dragonField("New secret question", { max: 120 });
          var fA2 = dragonField("New secret answer", { max: 120 });
          fQ.input.value = p.secQ || "";
          m.card.appendChild(fQ.wrap); m.card.appendChild(fA2.wrap);
          dragonModalBtns(m.card, m.done, "Save", async function () {
            if (!fQ.input.value.trim() || !fA2.input.value.trim()) { err.textContent = "question and answer are required"; return; }
            err.style.color = "#ffd76a"; err.textContent = "saving…";
            var ok2 = await cloudProfileSave({ secQ: fQ.input.value.trim(), secA: fA2.input.value.trim() });
            if (ok2) { m.done(); if (window.dragonProfileRefreshAll) window.dragonProfileRefreshAll(); }
            else { err.style.color = "#ff8a80"; var st = getEl("dragonCloudStatus"); err.textContent = st ? st.textContent : "failed"; }
          });
        });
      });
    };
    window.dragonCloudPasswordOpen = function () {
      var m = dragonModal("Change password");
      var err = dragonModalErr(m.card);
      err.style.color = "#ffd76a"; err.textContent = "loading…";
      cloudProfileLoad().then(function (p) {
        if (!p || !m.card.isConnected) { err.style.color = "#ff8a80"; err.textContent = "couldn't load profile"; return; }
        var saved = null;
        try { saved = JSON.parse(localStorage.dragonCloudUser || "null"); } catch (e0) {}
        if (!saved || !saved.u) { err.style.color = "#ff8a80"; err.textContent = "log in first"; return; }
        err.textContent = "";
        var q = document.createElement("div");
        q.style.cssText = "font-size:.8rem; color:#d8c9ff; text-align:center; margin-bottom:.3rem;";
        q.textContent = "Your question: " + (p.secQ || "");
        m.card.appendChild(q);
        var fA = dragonField("Secret answer", { max: 120 });
        m.card.appendChild(fA.wrap);
        var row1 = dragonModalBtns(m.card, m.done, "Verify", async function () {
          var ans = fA.input.value.trim();
          if (!ans) { err.textContent = "enter your secret answer"; return; }
          err.style.color = "#ffd76a"; err.textContent = "checking…";
          var ok = await cloudVerifyAnswer(ans);
          if (!ok) { err.style.color = "#ff8a80"; err.textContent = "wrong answer"; return; }
          try { row1.parentNode.remove(); } catch (e2) {}
          q.remove(); fA.wrap.remove();
          err.textContent = "";
          var fP = dragonField("New password (0-9, max 12 chars)", { type: "password", max: 12, num: true });
          m.card.appendChild(fP.wrap);
          dragonModalBtns(m.card, m.done, "Save", async function () {
            if (!validPw(fP.input.value)) { err.textContent = "password must be 8–12 digits (0-9)"; return; }
            err.style.color = "#ffd76a"; err.textContent = "saving…";
            var ok2 = await cloudResetDo(saved.u, ans, fP.input.value);
            if (ok2) { m.done(); status("☁️ password changed", "#4ade80"); }
            else { err.style.color = "#ff8a80"; var st = getEl("dragonCloudStatus"); err.textContent = st ? st.textContent : "failed"; }
          });
        });
      });
    };
    ;function startAutoSync() {
      if (syncTimer) return;
      syncTimer = setInterval(function () {
        if (!user || !socket || socket.readyState !== 1) return;
        lastPushed = snap();
      }, 15000);
    }
    ;async function autoLogin() {
      var saved = null;
      try { saved = JSON.parse(localStorage.dragonCloudUser || "null"); } catch (e) {}
      if (!saved || !saved.u || !saved.p) return;
      user = { u: saved.u, p: saved.p };
      cloudRefreshUI();
      var sock = await ensureSocket();
      if (!sock || sock.readyState !== 1) return;
      try {
        var res = parseLoginResp(await sock.rpc.login(credFrame(user.u, user.p)));
        if (res && res.ok) {
          var n = 0;
          try { n = await syncBackupOnLogin(user.p); } catch (e) {}
          status("", "#4ade80");
          startAutoSync();
          if (!window.__dragonCloudNoReload && n > 0) setTimeout(function () { location.reload(); }, 1400);
        } else {
          cloudLogout();
        }
      } catch (e) {}
    }
    ;function dragonModal(title) {
      var ov = document.createElement("div");
      ov.style.cssText = "position:fixed; inset:0; z-index:100200; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.6); padding:1rem; box-sizing:border-box;";
      var card = document.createElement("div");
      card.style.cssText = "width:min(94vw,420px); max-height:88vh; overflow:auto; border:1px solid rgba(155,107,255,.55); border-radius:14px; background:linear-gradient(180deg,#1c1230,#0d0918); color:#ece6ff; padding:1rem 1.1rem 1.1rem; box-sizing:border-box;";
      var h = document.createElement("div");
      h.style.cssText = "font-size:1rem; font-weight:800; color:#d8c9ff; text-align:center; margin-bottom:.7rem;";
      h.textContent = title;
      card.appendChild(h);
      ov.appendChild(card);
      function done() { try { ov.remove(); } catch (e) {} try { document.removeEventListener("keydown", onKey, true); } catch (e2) {} }
      function onKey(e) { if (e.key === "Escape") { e.stopPropagation(); done(); } }
      document.addEventListener("keydown", onKey, true);
      ov.addEventListener("mousedown", function (e) { if (e.target === ov) done(); });
      document.body.appendChild(ov);
      return { ov: ov, card: card, done: done };
    }
    ;function dragonField(label, opts) {
      opts = opts || {};
      var wrap = document.createElement("div");
      wrap.style.cssText = "display:flex; flex-direction:column; gap:.2rem; margin-bottom:.5rem;";
      var lb = document.createElement("div");
      lb.style.cssText = "font-size:.72rem; font-weight:700; color:#b79bff;";
      lb.textContent = label;
      var inp = document.createElement("input");
      inp.type = opts.type || "text";
      if (opts.max) inp.maxLength = opts.max;
      if (opts.num) inp.inputMode = "numeric";
      if (opts.ph) inp.placeholder = opts.ph;
      inp.style.cssText = "box-sizing:border-box; width:100%; padding:.4rem .55rem; font-size:.8rem; border:1px solid #5a5a6a; border-radius:8px; background:#12141a; color:#eee;";
      wrap.appendChild(lb); wrap.appendChild(inp);
      return { wrap: wrap, input: inp };
    }
    ;function dragonModalBtns(card, done, okLabel, onOk) {
      var row = document.createElement("div");
      row.style.cssText = "display:flex; gap:.45rem; margin-top:.6rem;";
      var ok = document.createElement("button");
      ok.type = "button"; ok.textContent = okLabel;
      ok.style.cssText = "flex:1; padding:.45rem .6rem; font-size:.8rem; font-weight:800; border-radius:9px; cursor:pointer; border:1px solid #4ade80; background:linear-gradient(180deg,#14532d,#052e16); color:#bbf7d0;";
      var cancel = document.createElement("button");
      cancel.type = "button"; cancel.textContent = "Cancel";
      cancel.style.cssText = "flex:1; padding:.45rem .6rem; font-size:.8rem; font-weight:700; border-radius:9px; cursor:pointer; border:1px solid #5a5a6a; background:linear-gradient(180deg,#1a1a20,#3a3a44); color:#ddd;";
      cancel.onclick = function (e) { e.stopPropagation(); done(); };
      ok.onclick = function (e) { e.stopPropagation(); onOk(); };
      row.appendChild(ok); row.appendChild(cancel);
      card.appendChild(row);
      return ok;
    }
    ;function dragonModalErr(card) {
      var err = document.createElement("div");
      err.style.cssText = "font-size:.75rem; color:#ff8a80; min-height:1.1em; text-align:center; margin-top:.2rem;";
      card.appendChild(err);
      return err;
    }
    ;function validDob(d, m, y) {
      d = Math.floor(Number(d)); m = Math.floor(Number(m)); y = Math.floor(Number(y));
      if (!isFinite(d) || !isFinite(m) || !isFinite(y)) return null;
      if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
      var dt = new Date(y, m - 1, d);
      if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
      var n = new Date();
      var a = n.getFullYear() - y;
      if (n.getMonth() + 1 < m || (n.getMonth() + 1 === m && n.getDate() < d)) a--;
      if (a < 18 || a > 120) return null;
      return ("0000" + y).slice(-4) + "-" + ("00" + m).slice(-2) + "-" + ("00" + d).slice(-2);
    }
    ;function validDobStr(s) {
      var parts = String(s || "").trim().split(/[.\-\/]/);
      if (parts.length !== 3) return null;
      return validDob(parts[0], parts[1], parts[2]);
    }
    window.dragonCloudRegisterOpen = function () {
      var m = dragonModal("Create your account");
      var fU = dragonField("Username (letters, -, max 12)", { max: 12 });
      var fP = dragonField("Password (0-9, max 12 chars)", { type: "password", max: 12, num: true });
      var fQ = dragonField("Secret question (to reset your password)", { max: 120 });
      var fA = dragonField("Secret answer", { max: 120 });
      var fDob = dragonField("Birth date (DD.MM.YYYY)", { max: 10, ph: "DD.MM.YYYY" });
      fDob.input.addEventListener("input", function () {
        var d = fDob.input.value.replace(/\D/g, "").slice(0, 8);
        var out = d;
        if (d.length > 2) out = d.slice(0, 2) + "." + d.slice(2);
        if (d.length > 4) out = d.slice(0, 2) + "." + d.slice(2, 4) + "." + d.slice(4);
        if (out !== fDob.input.value) fDob.input.value = out;
      });
      var fCo = dragonField("Country", { max: 56 });
      var gWrap = document.createElement("div");
      gWrap.style.cssText = "display:flex; flex-direction:column; gap:.2rem; margin-bottom:.5rem;";
      var gLb = document.createElement("div");
      gLb.style.cssText = "font-size:.72rem; font-weight:700; color:#b79bff;";
      gLb.textContent = "Gender";
      var gSel = document.createElement("select");
      gSel.style.cssText = "box-sizing:border-box; width:100%; padding:.4rem .55rem; font-size:.8rem; border:1px solid #5a5a6a; border-radius:8px; background:#12141a; color:#eee;";
      var gOpts = [["female", "Female"], ["male", "Male"], ["unspecified", "Prefer not to say"]];
      for (var gi = 0; gi < gOpts.length; gi++) {
        var op = document.createElement("option");
        op.value = gOpts[gi][0]; op.textContent = gOpts[gi][1];
        gSel.appendChild(op);
      }
      gSel.value = "unspecified";
      gWrap.appendChild(gLb); gWrap.appendChild(gSel);
      [fU, fP, fQ, fA, fDob, fCo].forEach(function (f) { m.card.appendChild(f.wrap); });
      m.card.appendChild(gWrap);
      var err = dragonModalErr(m.card);
      dragonModalBtns(m.card, m.done, "Create account", async function () {
        var u = fU.input.value.trim();
        var pw = fP.input.value;
        var secQ = fQ.input.value.trim();
        var secA = fA.input.value.trim();
        if (!validUser(u)) { err.textContent = "username: 3–12 chars, letters and - (no leading/trailing -)"; return; }
        if (!validPw(pw)) { err.textContent = "password must be 8–12 digits (0-9)"; return; }
        if (!secQ || !secA) { err.textContent = "a secret question and answer are required"; return; }
        var dob = validDobStr(fDob.input.value);
        if (!dob) { err.textContent = "enter your birth date as DD.MM.YYYY (18+)"; return; }
        var country = fCo.input.value.trim();
        if (country.length < 2) { err.textContent = "enter your country"; return; }
        err.style.color = "#ffd76a"; err.textContent = "creating…";
        await cloudRegister(u, pw, { secQ: secQ, secA: secA, dob: dob, country: country, gender: gSel.value });
        var st = getEl("dragonCloudStatus");
        if (st && /logged in|account created/.test(st.textContent)) m.done();
        else { err.style.color = "#ff8a80"; err.textContent = st ? st.textContent : "failed"; }
      });
    };
    window.dragonCloudResetOpen = function () {
      var m = dragonModal("Reset your password");
      var fU = dragonField("Username", { max: 12 });
      var fA = dragonField("Secret answer", { max: 120 });
      var fP = dragonField("New password (0-9, max 12 chars)", { type: "password", max: 12, num: true });
      [fU, fA, fP].forEach(function (f) { m.card.appendChild(f.wrap); });
      var err = dragonModalErr(m.card);
      dragonModalBtns(m.card, m.done, "Reset password", async function () {
        var u = fU.input.value.trim().toLowerCase();
        var secA = fA.input.value.trim();
        var pw = fP.input.value;
        if (!validUser(u)) { err.textContent = "username: 3–12 chars, letters and - (no leading/trailing -)"; return; }
        if (!secA) { err.textContent = "enter your secret answer"; return; }
        if (!validPw(pw)) { err.textContent = "password must be 8–12 digits (0-9)"; return; }
        err.style.color = "#ffd76a"; err.textContent = "resetting…";
        var ok = await cloudResetDo(u, secA, pw);
        if (ok) {
          try { getEl("dragonCloudUserIn").value = u; getEl("dragonCloudPassIn").value = pw; } catch (e) {}
          status("password reset — log in with the new password", "#4ade80");
          m.done();
        } else { err.style.color = "#ff8a80"; var st = getEl("dragonCloudStatus"); err.textContent = st ? st.textContent : "failed"; }
      });
    };
    window.dragonBuildProfileCard = function () {
      var card = document.createElement("div");
      card.className = "dragon-set-card dragon-set-wide";
      card.id = "dragonProfileCard";
      var h = document.createElement("div"); h.className = "dragon-set-h"; h.textContent = "👤 Profile";
      var body = document.createElement("div"); body.className = "dragon-set-body";
      var who = document.createElement("div");
      who.id = "dragonProfileWho";
      who.style.cssText = "font-size:.78rem; color:#8f86a8; text-align:center; margin-bottom:.4rem;";
      who.textContent = "Log in above to edit your profile.";
      body.appendChild(who);
      function halfInp(id, ph, type) {
        var i = document.createElement("input");
        i.id = id; i.type = type || "text"; i.placeholder = ph;
        i.style.cssText = "display:block; width:calc(50% - .175rem); max-width:calc(50% - .175rem); margin:.15rem auto; padding:.3rem .5rem; font-size:.75rem; height:34px; box-sizing:border-box; border:1px solid #5a5a6a; border-radius:6px; background:#12141a; color:#eee;";
        body.appendChild(i);
        return i;
      }
      function halfBtn(label, border, bg, color) {
        var b = document.createElement("button");
        b.type = "button"; b.textContent = label;
        b.style.cssText = "display:block; width:calc(50% - .175rem); margin:.15rem auto; border:1px solid " + border + "; background:" + bg + "; color:" + color + "; border-radius:6px; cursor:pointer;";
        body.appendChild(b);
        return b;
      }
      var secQIn = halfInp("dragonProfileSecQ", "Secret question");
      var secAIn = halfInp("dragonProfileSecA", "New secret answer (empty = keep)");
      var saveB = halfBtn("💾 Save profile", "#ffd76a", "linear-gradient(180deg,#4a3a1a,#2a2416)", "#ffe9a8");
      saveB.title = "Save the mail address, secret question and secret answer into your profile";
      saveB.onclick = async function (e) {
        e.stopPropagation();
        var patch = { secQ: secQIn.value.trim() };
        if (secAIn.value.trim()) patch.secA = secAIn.value.trim();
        var ok = await cloudProfileSave(patch);
        if (ok) { status("☁️ profile saved", "#4ade80"); secAIn.value = ""; window.dragonCloudSyncProfile && window.dragonCloudSyncProfile(); }
      };
      var pwIn = halfInp("dragonProfilePw", "New password (0-9)", "password");
      pwIn.maxLength = 12; pwIn.inputMode = "numeric";
      var pwB = halfBtn("🔑 Change password", "#7b6cff", "linear-gradient(180deg,#2a1f4a,#14101f)", "#d8c9ff");
      pwB.title = "Change your password (8–12 digits)";
      pwB.onclick = async function (e) {
        e.stopPropagation();
        if (!validPw(pwIn.value)) { status("password must be 8–12 digits (0-9)", "#ffd76a"); return; }
        var ok = await cloudPasswordChange(pwIn.value);
        if (ok) { status("☁️ password changed", "#4ade80"); pwIn.value = ""; try { getEl("dragonCloudPassIn").value = ""; } catch (e2) {} }
      };
      card.appendChild(h); card.appendChild(body);
      return card;
    };
    window.dragonCloudSyncProfile = async function () {
      var who = document.getElementById("dragonProfileWho");
      var card = document.getElementById("dragonProfileCard");
      if (!who || !card || !who.isConnected) return;
      var saved = null;
      try { saved = JSON.parse(localStorage.dragonCloudUser || "null"); } catch (e) {}
      if (!saved || !saved.u) { who.textContent = "Log in above to edit your profile."; who.style.color = "#8f86a8"; card.dataset.profFor = ""; return; }
      who.textContent = "✅ " + saved.u; who.style.color = "#4ade80";
      if (card.dataset.profFor === saved.u) return;
      var p = await cloudProfileLoad();
      if (!p || !who.isConnected) return;
      try {
        document.getElementById("dragonProfileSecQ").value = p.secQ || "";
        card.dataset.profFor = saved.u;
      } catch (e2) {}
    };
    window.dragonProfileRefreshAll = function () {
      try { if (window.dragonSocialProfileRefresh) window.dragonSocialProfileRefresh(); } catch (eR1) {}
      try { if (window.dragonSocialProfileRefresh) window.dragonSocialProfileRefresh("dragonSetProfBox"); } catch (eR2) {}
    };
    window.dragonNavAccountIcon = "src/IMG/account-icon.png";
    window.dragonNavAccountSync = function () {
      var btn = document.getElementById("dragonNavAccountBtn") || document.querySelector('.dragon-nav-item[data-nav-page="account"]');
      if (!btn) return;
      try {
        btn.title = "Settings \u2014 sound, themes, display & preferences"; // W-SOCIALCUT 10.10.2026 (was Account)
        btn.setAttribute("aria-label", "Settings"); // W-SOCIALCUT 10.10.2026 (was Account)
        var lb = btn.querySelector(".dragon-nav-lb");
        if (lb && lb.textContent !== "Settings") lb.textContent = "Settings"; // W-SOCIALCUT 10.10.2026 (was Account)
        var ic = btn.querySelector(".dragon-nav-ic");
        if (!ic) return;
        var saved = null;
        try { saved = JSON.parse(localStorage.dragonCloudUser || "null"); } catch (eS) {}
        var av = "";
        try { av = localStorage.getItem("dragonCloudAvatar") || ""; } catch (eA) {}
        if (av && !/^(https:\/\/|src\/)/.test(av)) av = "";
        if (saved && saved.u && av) {
          var cur = ic.querySelector("img");
          if (!cur || cur.getAttribute("src") !== av) {
            ic.innerHTML = "";
            var im = document.createElement("img");
            im.src = av; im.alt = "";
            im.style.cssText = "height:1em;width:1em;object-fit:cover;display:block;border-radius:50%;";
            ic.appendChild(im);
          }
          ic.style.transform = "";
        } // W-SOCIALCUT 10.10.2026 — logged-out icon reset parked in the Librarybook DEPO (the navbar keeps its own gear icon now).
      } catch (e) {}
    };
    window.dragonBuildProfileBox = function (boxId) {
      var box = document.createElement("div");
      box.className = "dragon-social-note";
      box.id = boxId || "dragonSocProfBox";
      return box;
    };
    window.dragonBuildSocialProfile = function (boxId) {
      var pane = document.createElement("div");
      pane.className = "dragon-social-pane";
      pane.dataset.pane = "profile";
      pane.appendChild(window.dragonBuildProfileBox(boxId));
      return pane;
    };
    window.dragonSocialProfileRefresh = async function (boxRef) {
      var box = null;
      try { box = (typeof boxRef === "string") ? document.getElementById(boxRef) : (boxRef || document.getElementById("dragonSocProfBox")); } catch (eBx) { box = null; }
      if (!box || !box.isConnected) return;
      var saved = null;
      try { saved = JSON.parse(localStorage.dragonCloudUser || "null"); } catch (e) {}
      if (box.dataset.refreshing === "1") return;
      box.dataset.refreshing = "1";
      if (!document.getElementById("dragonSocProfStyle")) {
        var sty = document.createElement("style");
        sty.id = "dragonSocProfStyle";
        sty.textContent = "#dragonSocProfBox .prof2col,#dragonSetProfBox .prof2col{display:flex;gap:.9rem;align-items:flex-start;}#dragonSocProfBox .prof2col>div,#dragonSetProfBox .prof2col>div{flex:1 1 0;min-width:0;}@media (max-width:640px){#dragonSocProfBox .prof2col,#dragonSetProfBox .prof2col{flex-direction:column;}}";
        document.head.appendChild(sty);
      }
      var infoCol = document.createElement("div");
      var actCol = document.createElement("div");
      function line(t, css) {
        var d = document.createElement("div");
        d.style.cssText = css || "font-size:.82rem; color:#c3cbdd; margin:.15rem 0;";
        d.textContent = t;
        infoCol.appendChild(d);
        return d;
      }
      function inp(id, ph, type, max, num) {
        var i = document.createElement("input");
        i.id = id; i.type = type || "text"; i.placeholder = ph;
        if (max) i.maxLength = max;
        if (num) i.inputMode = "numeric";
        i.style.cssText = "display:block; width:100%; margin:.15rem 0; padding:.3rem .5rem; font-size:.75rem; height:34px; box-sizing:border-box; border:1px solid #5a5a6a; border-radius:6px; background:#12141a; color:#eee;";
        actCol.appendChild(i);
        return i;
      }
      function btn(label, title, fn) {
        var b = document.createElement("button");
        b.type = "button"; b.textContent = label; b.title = title || "";
        b.style.cssText = "display:block; width:100%; margin:.15rem 0; padding:.3rem .5rem; font-size:.75rem; font-weight:700; border:1px solid #ffd76a; border-radius:6px; background:linear-gradient(180deg,#4a3a1a,#2a2416); color:#ffe9a8; cursor:pointer;";
        b.onclick = function (e) { e.stopPropagation(); fn(); };
        actCol.appendChild(b);
        return b;
      }
      if (!saved || !saved.u) {
        delete box.dataset.refreshing;
        box.innerHTML = "";
        box.style.display = "none";
        return;
      }
      var p = await cloudProfileLoad();
      if (!p || !box.isConnected) {
        delete box.dataset.refreshing;
        if (!box.children.length) box.textContent = "⚠️ could not load profile — retry";
        return;
      }
      box.innerHTML = "";
      box.style.display = "";
      var wrap = document.createElement("div");
      wrap.className = "prof2col";
      wrap.appendChild(infoCol);
      wrap.appendChild(actCol);
      box.appendChild(wrap);
      if (p.avatar) {
        var im = document.createElement("img");
        im.src = p.avatar; im.alt = "";
        im.style.cssText = "display:block; width:72px; height:72px; object-fit:cover; border-radius:50%; margin:.2rem auto; border:2px solid #9b6bff;";
        infoCol.appendChild(im);
      }
      line("✅ " + (p.disp || saved.u), "font-size:1rem; font-weight:800; color:#4ade80;");
      if (p.created) {
        try { line("Member since " + new Date(p.created * 1000).toLocaleDateString(), "font-size:.72rem; color:#8f86a8;"); } catch (e2) {}
      }
      var badges = Array.isArray(p.badges) ? p.badges : [];
      line(badges.length ? ("🏅 " + badges.join(" · ")) : "No badges yet", "font-size:.78rem; color:#ffe9a8;");
      var priv = (p.priv && typeof p.priv === "object") ? p.priv : { age: true, country: true, gender: true };
      function shown(k) { return priv[k] !== false; }
      function genderName(g) { return g === "female" ? "Female" : g === "male" ? "Male" : "Prefer not to say"; }
      line("🎂 Born " + (p.dob || "—") + (shown("age") ? "" : " (hidden)") + "  ·  Age " + (p.age || "—") + (shown("age") ? "" : " (hidden)") + "  ·  " + (p.country || "—") + (shown("country") ? "" : " (hidden)"), "font-size:.82rem; color:#c3cbdd; margin:.4rem 0 .2rem;");
      line("⚧ " + genderName(p.gender) + (shown("gender") ? "" : " (hidden)"), "font-size:.82rem; color:#c3cbdd; margin:.15rem 0;");
      var st = line("", "font-size:.75rem; color:#ffd76a; min-height:1.1em;");
      function say(t, c) { st.textContent = t; st.style.color = c || "#ffd76a"; }
      function privBtn(key, label) {
        var b = btn((shown(key) ? "👁 " : "🚫 ") + label + ": " + (shown(key) ? "shown" : "hidden"), "Toggle visibility", async function () {
          if (b.disabled) return;
          b.disabled = true;
          b.style.opacity = ".45";
          var np = {};
          np[key] = !shown(key);
          say("saving…");
          var ok = await cloudProfileSave({ priv: np });
          if (ok) window.dragonSocialProfileRefresh(box);
          else { say("failed", "#ff8a80"); b.disabled = false; b.style.opacity = ""; }
        });
      }
      var avIn = inp("dragonSocProfAvatar", "Avatar URL (https:// or src/)");
      avIn.value = p.avatar || "";
      btn("💾 Save avatar", "Save your avatar", async function () {
        var av = avIn.value.trim();
        if (av && !/^(https:\/\/|src\/)/.test(av)) { say("avatar must start with https:// or src/", "#ff8a80"); return; }
        say("saving…");
        var ok = await cloudProfileSave({ avatar: av });
        if (ok) { say("☁️ avatar saved", "#4ade80"); window.dragonSocialProfileRefresh(box); }
      });
      btn("🎨 Choose avatar", "Pick one of the 64 ready-made avatars", function () {
        if (!window.dragonAvatarPickerOpen) return;
        window.dragonAvatarPickerOpen(p.avatar || "", async function (url) {
          say("saving…");
          var ok = await cloudProfileSave({ avatar: url });
          if (ok) { say("☁️ avatar saved", "#4ade80"); window.dragonSocialProfileRefresh(box); }
          else say("failed", "#ff8a80");
          return ok;
        });
      });
      privBtn("age", "Show my age");
      privBtn("country", "Show my country");
      privBtn("gender", "Show my gender");
      btn("🔑 Change password", "Verify your answer, then change the password", function () {
        if (window.dragonCloudPasswordOpen) window.dragonCloudPasswordOpen();
      });
      btn("🔐 Change secret question", "Verify your answer, then change the question", function () {
        if (window.dragonCloudSecretOpen) window.dragonCloudSecretOpen();
      });
      btn("💾 Save Settings Now", "Upload your settings to the cloud now", function () {
        cloudSaveNow();
      });
      var outB = btn("🚪 Log Out", "Log out (uploads your settings first)", function () {
        cloudLogout();
      });
      outB.style.border = "1px solid #c81e2e";
      outB.style.background = "linear-gradient(180deg,#3a1010,#1c0808)";
      outB.style.color = "#ffb3b3";
      try { if (window.dragonNavAccountSync) window.dragonNavAccountSync(); } catch (eNav) {}
      delete box.dataset.refreshing;
    };
    window.dragonAvatarPickerOpen = function (current, onPick) {
      var codes = ["X307", "D401", "D402", "D403", "D404"];
      for (var f = 101; f <= 120; f++) codes.push("F" + f);
      for (var q = 201; q <= 220; q++) codes.push("M" + q);
      for (var x = 301; x <= 320; x++) { if (x !== 307) codes.push("X" + x); }
      var m = dragonModal("Choose your avatar");
      var note = document.createElement("div");
      note.style.cssText = "font-size:.72rem; color:#8f86a8; text-align:center; margin-bottom:.5rem;";
      note.textContent = "New accounts start with a random dragon.";
      m.card.appendChild(note);
      var grid = document.createElement("div");
      grid.style.cssText = "display:grid; grid-template-columns:repeat(5,1fr); gap:.45rem;";
      m.card.appendChild(grid);
      var busy = false;
      codes.forEach(function (cd) {
        var url = "src/SOCIAL/avatars/" + cd.toLowerCase() + ".jpg";
        var im = document.createElement("img");
        im.src = url; im.alt = cd; im.loading = "lazy";
        im.style.cssText = "width:100%; aspect-ratio:1; object-fit:cover; border-radius:50%; cursor:pointer; box-sizing:border-box; border:" + (current === url ? "3px solid #4ade80" : "2px solid #4a4a58") + ";";
        im.title = cd;
        im.onclick = async function () {
          if (busy) return;
          busy = true;
          im.style.opacity = ".45";
          var ok = false;
          try { ok = await onPick(url); } catch (ePk) { ok = false; }
          if (ok) m.done();
          else { busy = false; im.style.opacity = ""; }
        };
        grid.appendChild(im);
      });
    };
    ;function wireCloud() {
      var loginBtn = getEl("dragonCloudLoginBtn"), regBtn = getEl("dragonCloudRegBtn");
      if (!loginBtn) return;
      ;function creds() {
        return {
          u: String(getEl("dragonCloudUserIn").value || "").trim().toLowerCase(),
          pw: getEl("dragonCloudPassIn").value || ""
        };
      }
      loginBtn.onclick = function (e) { e.stopPropagation(); var c = creds(); if (!validUser(c.u)) { status("username: 3–12 chars, letters and - (no leading/trailing -)", "#ffd76a"); return; } if (!c.pw) { status("enter your password", "#ffd76a"); return; } cloudLogin(c.u, c.pw, false); };
      regBtn.onclick = function (e) { e.stopPropagation(); if (window.dragonCloudRegisterOpen) window.dragonCloudRegisterOpen(); };
      var forgotBtn = getEl("dragonCloudForgotBtn");
      if (forgotBtn) forgotBtn.onclick = function (e) { e.stopPropagation(); if (window.dragonCloudResetOpen) window.dragonCloudResetOpen(); };
    }
    wireCloud();
    window.dragonCloudRefreshUI = cloudRefreshUI;
    window.dragonCloudLogin = cloudLogin;
    window.dragonCloudSaveNow = cloudSaveNow;
    window.dragonCloudLogout = cloudLogout;
    setTimeout(autoLogin, 1500);
  })();
