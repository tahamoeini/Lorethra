// dragon-upmeta.js — Gallery upload meta (Egon 12.10.2026): title / username inputs in
// the Control Panel, processed into the gallery TITLE + DESCRIPTION on upload.
// RULES (Egon 12.10.2026, rev 3):
//   1. the marker goes VERBATIM FIRST in the description (a future indexOf(marker) gallery
//      verification depends on it — appends must never precede it);
//   2. the date append is AUTOMATIC: every upload stamps the PRODUCTION day (today, decided
//      at upload time — there is no date input anymore). Old descriptions with an explicit
//      date still parse;
//   3. EMPTY TITLE = NO TITLE: no prompt excerpt, no main.pjs fallback. Title + username
//      combine as "TITLE by USER"; a lone username stands bare ("Egon"); an empty username
//      always degrades to the SERVER USER TAG (the 4-letter code the default gallery cards
//      print, e.g. "2UBQ" — murmur3(channel + server id), computed locally): "T" alone goes
//      as "T by TAG", empty/empty as "TAG", or "" while the server id is still unknown;
//   4. LIMITS: title input 20 / username 40 chars; combined TITLE sliced to 140,
//      DESCRIPTION sliced to 400.
// Rollback: delete this file + its <script> tag. Both integration edits (the options wrapper in
// dragon-app-core.js, dragonSendToPublicGallery in dragon-pages.js) are guarded try/catch, so
// titles fall back to the plugin default (the prompt) and descriptions to main.pjs saveDescription.
(function () {
  if (window.__dragonUpMetaInstalled) return;
  window.__dragonUpMetaInstalled = true;

  var LS_KEY = "dragonUpMetaV1";
  var MARKER_BASE = "bestaigen";
  // Egon 29.10.2026 (A12) — the title stays tiny on purpose (20 chars): a gallery
  // card reads "TITLE by USER", so a short title keeps the credit visible.
  var LIM_TITLE_IN = 20, LIM_USER_IN = 40, LIM_DATE_IN = 24;
  var LIM_TITLE = 140, LIM_DESC = 400;

  ;function toast(m) { try { if (window.dragonToast) window.dragonToast(m); } catch (e) {} }
  ;function todayStr() {
    try {
      var t = new Date();
      return t.getFullYear() + "-" + ("0" + (t.getMonth() + 1)).slice(-2) + "-" + ("0" + t.getDate()).slice(-2);
    } catch (e) { return ""; }
  }
  ;function lsGet() { try { return localStorage.getItem(LS_KEY); } catch (e) { return null; } }
  ;function lsSet(v) { try { localStorage.setItem(LS_KEY, v); return true; } catch (e) { return false; } }

  ;function upMetaDef() {
    return { title: "", username: "", date: todayStr() };
  }
  var _mem = null;
  ;function read(stored) {
    var m = upMetaDef();
    try {
      if (stored && typeof stored === "object") {
        if (typeof stored.title === "string") m.title = stored.title;
        // legacy rev-1 key (was labelled "credit"): migrated, never written again.
        if (typeof stored.username === "string") m.username = stored.username;
        else if (typeof stored.by === "string") m.username = stored.by;
      }
    } catch (e) {}
    // Egon 12.10.2026 (rev 3) — the date is not user data anymore: every upload stamps the
    // production day automatically (see upMetaDesc). A stored date is always ignored.
    m.date = todayStr();
    return m;
  }
  ;function upMeta() {
    if (_mem) return read(_mem);
    var s = null;
    try { s = JSON.parse(lsGet() || "null"); } catch (e) { s = null; }
    var m = read(s);
    _mem = { title: m.title, username: m.username, date: m.date };
    return m;
  }
  ;function upMetaSave(m) {
    // Egon 29.10.2026 (A12) — the title is capped at 20 chars on every write path.
    _mem = { title: String((m && m.title) || "").slice(0, LIM_TITLE_IN), username: String((m && (m.username != null ? m.username : m.by)) || "").slice(0, LIM_USER_IN),
      date: todayStr() };
    var ok = false;
    try { ok = lsSet(JSON.stringify(_mem)); } catch (e) { ok = false; }
    return ok;
  }
  // Combined TITLE, sliced to 140. EMPTY = NO TITLE: an empty title never pulls a prompt
  // excerpt or the main.pjs fallback. Lone username stands bare ("Egon"); an empty username
  // always degrades to the server user TAG (the 4-letter code the default gallery cards show,
  // e.g. "2UBQ" — computed locally from channel + server id, no server call): "T" alone is
  // sent as "T by TAG", empty/empty as "TAG". "" while the server id is still unknown.
  ;function upMetaTitle() {
    var m = upMeta();
    var t = String(m.title || "").trim();
    var u = String(m.username || "").trim();
    if (!u) u = serverFallbackName();
    if (t && u) t += " by " + u;
    else if (!t) t = u;
    return t.slice(0, LIM_TITLE);
  }
  // The fallback display name: the gallery user tag for our server id.
  ;function serverFallbackName() {
    try {
      var sid = serverUserIdGet();
      if (sid && window.dragonUserTag) return window.dragonUserTag(sid) || "";
    } catch (e) {}
    return "";
  }
  // Description: marker VERBATIM first, date at the END, sliced to 400.
  ;function upMetaDesc(marker) {
    var mk = String(marker || "").trim() || MARKER_BASE;
    var m = upMeta(), parts = [mk];
    if (String(m.date || "").trim()) parts.push(String(m.date).trim().slice(0, LIM_DATE_IN));
    return parts.join(" | ").slice(0, LIM_DESC);
  }
  ;function upMetaNewMarker() {
    try { return MARKER_BASE + "-" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36); }
    catch (e) { return MARKER_BASE; }
  }
  // Egon 12.10.2026 (rev 3) — the SERVER-STAMPED user id: the same 64-hex identity the gallery
  // stores as data-user-id on our own uploads (verified: identical across our uploads). It is
  // learned, never guessed: dragonGalleryConfirm reads it off each confirmed upload (the
  // getPublicUserId endpoint answers from the PROXY's network, so it reports the wrong id and
  // is deliberately NOT used). It feeds the visible fallback: the 4-letter gallery user tag
  // (serverFallbackName) an empty username degrades to.
  var SRV_KEY = "dragonServerUserIdV1", _srvMem = null;
  ;function serverUserIdGet() {
    if (_srvMem) return _srvMem;
    try {
      var s = String(localStorage.getItem(SRV_KEY) || "").trim();
      if (/^[a-f0-9]{64}$/.test(s)) { _srvMem = s; return s; }
    } catch (e) {}
    return "";
  }
  ;function serverUserIdNote(id) {
    try {
      var s = String(id || "").trim().toLowerCase();
      if (!s) { _srvMem = null; try { localStorage.removeItem(SRV_KEY); } catch (eC) {} return true; }
      if (!/^[a-f0-9]{64}$/.test(s)) return false;
      _srvMem = s;
      try { localStorage.setItem(SRV_KEY, s); } catch (e) {}
      return true;
    } catch (e) { return false; }
  }
  // Inverse of upMetaDesc for history display: our own format is marker-first, date-last.
  ;function upMetaParseDesc(desc) {
    var out = { marker: "", tags: "", date: "" };
    try {
      var segs = String(desc || "").split(" | ").map(function (s) { return String(s).trim(); }).filter(Boolean);
      if (!segs.length) return out;
      out.marker = segs[0];
      if (segs.length > 1) {
        var last = segs[segs.length - 1];
        var mid = segs.slice(1, segs.length - 1);
        // date is a short trailing segment (max 24 chars) that is NOT a tags segment
        if (last && last.slice(0, 5).toLowerCase() !== "tags:" && last.length <= LIM_DATE_IN) {
          out.date = last;
        } else {
          mid = segs.slice(1);
        }
        out.tags = mid.map(function (s) { return s.replace(/^tags:\s*/i, ""); }).join(" | ");
      }
    } catch (e) {}
    return out;
  }
  ;function upMetaSummary() {
    var m = upMeta();
    return "title=" + (upMetaTitle() || "(none)") +
      " · date=" + (String(m.date || "").trim() || "-");
  }

  window.dragonUpMeta = upMeta;
  window.dragonUpMetaSave = upMetaSave;
  window.dragonUpMetaTitle = upMetaTitle;
  window.dragonUpMetaDesc = upMetaDesc;
  window.dragonUpMetaNewMarker = upMetaNewMarker;
  window.dragonServerUserIdGet = serverUserIdGet;
  window.dragonServerUserIdNote = serverUserIdNote;
  window.dragonUpMetaParseDesc = upMetaParseDesc;
  window.dragonUpMetaSummary = upMetaSummary;

  // ---------------------------------------------------------------- Control Panel UI
  ;function tag(el) { try { el.setAttribute("data-name", ""); } catch (e) {} return el; }
  ;function mkLab(text, title) {
    var s = document.createElement("span");
    s.textContent = text;
    if (title) s.title = title;
    s.style.cssText = "font-size:.72rem; color:#9fb6cc; white-space:nowrap;";
    return s;
  }
  ;function mkInput(id, max, placeholder, width, title) {
    var inp = document.createElement("input");
    inp.type = "text"; inp.id = id;
    tag(inp);
    inp.maxLength = max; inp.placeholder = placeholder; inp.title = title;
    inp.setAttribute("aria-label", title);
    inp.style.cssText = "background:#0f0f15; border:1px solid #5a789a; border-radius:7px; color:#e8e6ee; " +
      "font-size:.76rem; padding:.28rem .45rem; box-sizing:border-box; width:" + width + "; min-width:0;";
    inp.onclick = function (e) { e.stopPropagation(); };
    return inp;
  }
  ;function ensure() {
    try {
      var body = document.querySelector(".dragon-control-body");
      if (!body) return false;
      if (document.getElementById("dragonUpMetaRow")) return true;
      var row = document.createElement("div");
      row.id = "dragonUpMetaRow";
      row.style.cssText = "display:flex; align-items:center; justify-content:center; gap:.35rem; " +
        "flex-wrap:wrap; width:100%; box-sizing:border-box; padding:.3rem .35rem; " +
        "border:1px solid rgba(63,143,214,.35); border-radius:8px; background:rgba(0,0,0,.18);";
      var head = document.createElement("span");
      head.textContent = "🏷️ Image Info:";
      head.title = "Title + username stamped onto gallery uploads as TITLE (empty title sends no title; empty username falls back to the server-stamped user id); the production date is stamped automatically";
      head.style.cssText = "font-size:.76rem; font-weight:bold; color:#cfe3ff; white-space:nowrap;";
      var iTitle = mkInput("dragonUpMetaTitle", LIM_TITLE_IN, "e.g. Red Kite", "10rem", "Gallery upload title (empty = no title is sent)");
      var iUser = mkInput("dragonUpMetaUser", LIM_USER_IN, "e.g. Egon", "6rem", "Visible username credit, sent as TITLE by X — or bare when the title is empty (empty falls back to the server-stamped user id)");
      ;function fill() {
        var m = upMeta();
        iTitle.value = m.title; iUser.value = m.username;
      }
      ;function save() {
        var ok = upMetaSave({ title: iTitle.value, username: iUser.value });
        toast("Gallery meta saved (" + upMetaSummary() + ")" + (ok ? "" : " — kept for this session (browser storage is full)."));
      }
      ;function saveQuiet() { try { upMetaSave({ title: iTitle.value, username: iUser.value }); } catch (eQ) {} }
      [iTitle, iUser].forEach(function (el) { el.addEventListener("input", saveQuiet); el.addEventListener("change", save); });
      window.dragonUpMetaFlush = saveQuiet;
      row.append(head, mkLab("Title", "Gallery upload title (empty = no title is sent)"), iTitle,
        mkLab("Username", "Visible username credit"), iUser);
      body.appendChild(row);
      // ⚠️ MANDATORY framework tolerance: it walks every input inside the input container and binds
      // by data-name (see dragon-art-panel.js) — data-name="" is set above; register the key so the
      // lookup never hits `userInputs[undefined]`.
      try {
        var uis = window.___userSettings746291937 && window.___userSettings746291937.userInputs;
        if (uis && !uis[""]) uis[""] = { excludeFromShareLink: true };
      } catch (e) {}
      fill();
      return true;
    } catch (e) { return false; }
  }
  window.dragonUpMetaEnsure = ensure;
  try { ensure(); } catch (e) {}
  try { setInterval(function () { try { ensure(); } catch (e2) {} }, 1500); } catch (e3) {}
})();
