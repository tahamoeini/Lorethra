/* ============================================================================
   BestAiGen — Dedupe (BOTH galleries)
   ----------------------------------------------------------------------------
   Same-prompt dedupe ported 1:1 from the reference generator (see src/README.md;
   x's spec is the source of truth). Two behaviours, both driven by ONE
   normaliser so the grid and the lightbox can never disagree:

     * KEEPS model (default): EVERY image stays visible; a tile whose prompt is
       shared with other tiles in the CURRENT (filtered) view gets a "xN" badge
       in its top-left corner (the reference .kv2dup). Nothing is hidden.
     * EXPLORER model (the 🧬 toolbar toggle): when switched on, all but the
       first tile of each same-prompt group are collapsed (display:none), the
       representative keeps its "xN" badge. Toggling off restores every tile.

   Clicking a tile opens the lightbox, and this module renders a strip of every
   copy of THAT prompt UNDER the image (the reference keepsLightboxDupRow). Clicking a
   strip thumbnail swaps the copy on screen; the ‹ › arrows keep walking the
   OUTER gallery (a different prompt each step). The two navigations are
   independent.

   Egon 16.09.2026 — the SAME system now runs over the PUBLIC gallery too
   (`.dragon-gal-grid .dragon-gal-tile`, prompts read straight off the tile) as
   well as the private/vault gallery (`#localMediaGallery_root [data-...item]`,
   prompts via the blobs DB scan). One normaliser, one collapse flag, two twin
   🧬 toolbar buttons (dragonVaultDedupeButton / dragonPublicDedupeButton).

   IMPORTANT: grouping is computed from the tiles CURRENTLY in the grid (the
   filtered view), never from the whole blobs DB — otherwise a badge could claim
   "x5" while only 2 copies are on screen, and the strip would list images that
   are not in the current view. One normaliser (`normalizePromptKey`), one group
   source => the badge and the strip always match.

   NOTHING IS DELETED. This is a way of LOOKING at the gallery, not a cleaner.
   (Egon explicitly rejected every earlier byte/seed based cleaner because those
   could wipe real images.)

   Public hooks (all on window):
     normalizePromptKey(prompt)                 -> shared grouping key
     dragonVaultDedupeButton()                  -> the private "🧬" toolbar button
     dragonPublicDedupeButton()                 -> the public "🧬" toolbar twin
     dragonVaultDedupeOn()                      -> {bool} is COLLAPSE mode active?
     dragonVaultDedupeApply()                   -> re-run badges/collapse on both grids
     dragonVaultDedupeInvalidate()              -> drop the cached id->prompt scan
     dragonVaultPromptScan([force])             -> Promise<{groups, byId, size}>
     dragonLbDupesRender(rowEl, item, onPick)   -> lightbox thumbnail strip (both galleries)
     dragonLbDupesRefresh                       -> set by index.html; re-renders the strip
   Everything here is per-user and local; no data leaves the device.
   ========================================================================== */
(function () {
  "use strict";

  var DEBUG = false;
  var BLOBS_DB = "localMediaGallery_.blobs-db-kv-plugin";
  var CACHE_MS = 120000;

  /* --------------------------------------------------------- prompt key */
  // Same-prompt grouping key — copied VERBATIM from the reference app (src/app.js:3666,
  // also index.html kv2NormKey). Lowercase, drop perchance odds markers (^3),
  // fold whitespace, trim edge punctuation. Two images produced from the same
  // prompt text land in the same bucket regardless of seed/steps.
  function normalizePromptKey(prompt) {
    return String(prompt || "")
      .toLowerCase()
      .replace(/\^\d+(?:\.\d+)?/g, " ")
      .replace(/[\s\r\n\t]+/g, " ")
      .replace(/^[\s"'`\-\u2013\u2014:.,;]+/, "")
      .replace(/[\s"'`\-\u2013\u2014:.,;]+$/, "")
      .trim();
  }
  window.dragonNormalizePromptKey = normalizePromptKey;

  function blobUrl(id) {
    var hit = window.dragonVaultUrlGet ? window.dragonVaultUrlGet(String(id)) : null;
    if (hit && hit.url) return Promise.resolve(hit.url);
    if (!window.dragonVaultBlobGet) return Promise.resolve(null);
    return window.dragonVaultBlobGet(id).then(function (rec) {
      var b = rec ? ((rec instanceof Blob) ? rec : (window.dragonToBlob ? window.dragonToBlob(rec) : null)) : null;
      return b ? URL.createObjectURL(b) : null;
    }).catch(function () { return null; });
  }

  /* ------------------------------------------------------------- scan */
  // The DB scan is only used as an id -> normalised-prompt lookup for the VAULT
  // gallery. The PUBLIC gallery reads the prompt directly off each tile.
  var _scan = null;    // { at, groups:[{key, prompt, ids:[]}], byId:{ id: groupIndex }, size }
  var _scanning = null;

  function parseInfo(rec) {
    var info = rec && rec.info;
    if (typeof info === "string") { try { info = JSON.parse(info); } catch (e) { return null; } }
    return info || null;
  }

  function scan(force) {
    if (!force && _scan && (Date.now() - _scan.at) < CACHE_MS) return Promise.resolve(_scan);
    if (_scanning) return _scanning;
    if (!window.dragonOpenIDB || !window.dragonStoreAllEntries) return Promise.resolve(_scan || emptyScan());
    _scanning = window.dragonOpenIDB(BLOBS_DB).then(function (db) {
      return window.dragonStoreAllEntries(db);
    }).then(function (entries) {
      var buckets = {};   // key -> [ids]
      var prompts = {};   // key -> prompt
      for (var i = 0; i < (entries || []).length; i++) {
        var e = entries[i];
        if (!e || e.key == null) continue;
        var id = String(e.key);
        var info = parseInfo(e.value);
        var p = (info && info.prompt) ? String(info.prompt) : "";
        var key = p ? normalizePromptKey(p) : ("\u0000" + id);
        (buckets[key] || (buckets[key] = [])).push(id);
        if (!prompts[key]) prompts[key] = p;
      }
      var groups = [];
      var byId = {};
      Object.keys(buckets).forEach(function (key) {
        var ids = buckets[key];
        ids.sort(function (a, b) { var na = parseFloat(a), nb = parseFloat(b); return (isNaN(na) || isNaN(nb)) ? (a < b ? -1 : 1) : (na - nb); });
        groups.push({ key: key, prompt: prompts[key] || "", ids: ids });
      });
      groups.sort(function (a, b) { return b.ids.length - a.ids.length || (a.ids[0] < b.ids[0] ? -1 : 1); });
      byId = {};
      for (var g = 0; g < groups.length; g++) {
        for (var k = 0; k < groups[g].ids.length; k++) byId[groups[g].ids[k]] = g;
      }
      _scan = { at: Date.now(), groups: groups, byId: byId, size: (entries || []).length };
      _scanning = null;
      if (DEBUG) console.log("[vault-dedupe] scan:", _scan.size, "blobs /", groups.length, "prompt groups");
      return _scan;
    }).catch(function (e) {
      _scanning = null;
      DEBUG && console.log("[vault-dedupe] scan failed", e);
      return _scan || emptyScan();
    });
    return _scanning;
  }
  function emptyScan() { return { at: Date.now(), groups: [], byId: {}, size: 0 }; }

  window.dragonVaultPromptScan = scan;
  window.dragonVaultDedupeInvalidate = function () { _scan = null; };

  // id -> normalised prompt key (via the cached DB scan)
  function keyForId(id) {
    if (!_scan || !_scan.byId || id == null) return null;
    var gi = _scan.byId[String(id)];
    return gi == null ? null : _scan.groups[gi].key;
  }

  /* --------------------------------------------------------------- CSS */
  function ensureCss() {
    if (document.getElementById("dragonVaultDedupeCss")) return;
    var s = document.createElement("style");
    s.id = "dragonVaultDedupeCss";
    s.textContent =
      // the toolbar toggle (collapse mode) — shared look for both galleries
      ".dragon-vault-dedupe-btn{width:22px; height:22px; padding:0; box-sizing:border-box; border:1px solid #b07dff; background:linear-gradient(180deg,#231a33,#120d1c); color:#d9c2ff; border-radius:7px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; font-size:.78rem; flex:0 0 auto;}" +
      ".dragon-vault-dedupe-btn.active{border-color:#4da3ff; color:#cfe6ff; box-shadow:0 0 8px rgba(77,163,255,.75);}" +
      // collapsed tiles + the "xN" badge (the reference .kv2dup / .explorerCardDup) — both galleries
      "[data-local-media-gallery-item].dragon-dupe-hidden{display:none !important;}" +
      ".dragon-gal-tile.dragon-dupe-hidden{display:none !important;}" +
      ".dragon-dupe-badge{position:absolute; left:0; top:0; z-index:7; background:rgba(20,10,40,.82); color:#c9a6ff; font-size:.62rem; font-weight:bold; letter-spacing:.02em; padding:1px 5px; border-radius:8px; pointer-events:none; border:1px solid rgba(150,110,255,.55); box-shadow:0 1px 4px rgba(0,0,0,.5);}" +
      // the lightbox duplicate strip (the reference keepsLightboxDupRow, 1:1)
      // 🧬 Egon 22.09.2026 — ONE centred row + a modern slider. The copies sit on a single track that is
      // centred whenever it fits; when there are more than fit, the row itself scrolls sideways under a
      // slim hand-styled slider (a real drag handle on Firefox, a gradient pill on WebKit).
      ".dragon-lb-dupes{flex:0 0 auto; align-self:center; width:min(88vw,900px); max-width:100%; display:flex; overflow-x:auto; overflow-y:hidden; padding:.3rem .2rem .5rem; scrollbar-width:thin; scrollbar-color:#7a5cff rgba(255,255,255,.08);}" +
      ".dragon-lb-dupes::-webkit-scrollbar{height:9px;}" +
      ".dragon-lb-dupes::-webkit-scrollbar-track{background:rgba(255,255,255,.07); border-radius:99px; margin:0 6px;}" +
      ".dragon-lb-dupes::-webkit-scrollbar-thumb{background:linear-gradient(90deg,#4a2a9a,#9b6bff); border-radius:99px; border:1px solid rgba(200,170,255,.35); box-shadow:0 0 7px rgba(155,107,255,.6);}" +
      ".dragon-lb-dupes::-webkit-scrollbar-thumb:hover{background:linear-gradient(90deg,#5b34c0,#b48cff);}" +
      ".dragon-lb-dupes-track{display:flex; gap:.4rem; width:max-content; margin:0 auto; padding:0 2px; align-items:center;}" +
      ".dragon-lb-dupes .dragonLbDupThumb{flex:0 0 auto; width:64px; height:64px; padding:0; border-radius:6px; overflow:hidden; border:2px solid #444; background:#000; cursor:pointer; opacity:.65;}" +
      ".dragon-lb-dupes .dragonLbDupThumb.active{border-color:#4da3ff; opacity:1; box-shadow:0 0 9px rgba(77,163,255,.75);}" +
      ".dragon-lb-dupes .dragonLbDupThumb img{width:100%; height:100%; object-fit:cover; display:block;}" +
      ".dragon-lightbox-root.lbWithDupes .dragon-lb-imgwrap{max-height:60vh !important;}";
    document.head.appendChild(s);
  }

  /* ------------------------------------------------------------- grid */
  // ONE shared collapse flag so public/private behave identically (Egon: "if
  // possible the exact same system as the private gallery").
  // 🧬 Egon 22.09.2026 — DEFAULT ON: the dedupe/undupe button starts in the ACTIVE (collapsed) state in
  // BOTH galleries, so same-prompt copies are grouped from the moment a gallery opens. The visitor's own
  // toggle is remembered (`dragonDedupeCollapse`), so once they press ↩️ Undupe it stays off for them.
  var COLLAPSE_KEY = "dragonDedupeCollapse";
  var _collapse = (function () {
    try { var v = localStorage.getItem(COLLAPSE_KEY); return v === null ? true : v === "1"; } catch (e) { return true; }
  })();
  ;function saveCollapse() { try { localStorage.setItem(COLLAPSE_KEY, _collapse ? "1" : "0"); } catch (e) {} }
  var _observer = null, _obsTargets = [];
  var _applyTimer = null, _applying = false, _lastVaultCount = -1, _lastPubCount = -1, _rescanTimer = null;
  var _btns = [];
  /* --------------------------------------------- deep dedupe (channel-wide) */
  // \uD83D\uDD0D Egon 04.10.2026 — DEEP DEDUPE. The shallow collapse only ever sees LOADED tiles. Deep mode
  // keeps it (instant grouping first) and additionally walks the WHOLE channel quietly
  // (window.dragonGalleryWalk, 3 workers), grouping every row by the same normalized prompt key.
  // Badges grow as channel-wide copies are found; the lightbox strip gains the deep members too.
  // Silent: no shield, no toast, no gallery mutation — only badge text changes, through the existing
  // reconcile (addBadge), so the observer loop still converges. Dedupe()/Undupe() stop it, so the
  // check-up halves never see it.
  var _deep = false, _deepTok = 0, _deepStore = {}, _deepLoaded = {}, _deepKeys = 0, _deepPaintAt = 0;
  var DEEP_URL_CAP = 60, DEEP_KEY_CAP = 5000;
  function stopDeep() { _deepTok++; _deep = false; _deepStore = {}; _deepLoaded = {}; _deepKeys = 0; }
  function deepExtraForTile(tile) {
    if (!_deep) return 0;
    var k = null;
    try { k = pubKeyFor(tile); } catch (e) { k = null; }
    if (!k) return 0;
    var rec = _deepStore[k];
    return rec ? (rec.extra | 0) : 0;
  }
  window.dragonDeepDedupeExtra = function (key) { var r = _deepStore[String(key || "")]; return r ? (r.extra | 0) : 0; };
  window.dragonDeepDedupeMembers = function (key, haveUrls) {
    var r = _deepStore[String(key || "")];
    if (!r || !r.urls || !r.urls.length) return [];
    var have = {};
    try { (haveUrls || []).forEach(function (u) { if (u) have[u] = 1; }); } catch (e) {}
    return r.urls.filter(function (u) { return !have[u]; });
  };
  window.dragonDeepDedupe = function () {
    _collapse = true; saveCollapse();
    _deep = true; _deepTok++;
    _deepStore = {}; _deepKeys = 0; _deepLoaded = {};
    try {
      var tiles = publicTiles();
      for (var i = 0; i < tiles.length; i++) {
        var u = null;
        try { u = (tiles[i]._t && tiles[i]._t.url) || null; } catch (eU) { u = null; }
        if (u) _deepLoaded[u] = 1;
      }
    } catch (eL) {}
    applyGrid(); syncAllBtns();
    deepWalk(_deepTok);
    return true;
  };
  window.dragonDeepDedupeStop = function () { stopDeep(); applyGrid(); syncAllBtns(); return true; };
  window.dragonDeepDedupeOn = function () { return !!_deep; };
  function deepWalk(tok) {
    if (typeof window.dragonGalleryWalk !== "function") return;
    function alive() {
      if (tok !== _deepTok || !_deep) return false;
      try { var pr = publicRoot(); if (!pr || !pr.isConnected) return false; } catch (e) { return false; }
      return true;
    }
    window.dragonGalleryWalk({
      workers: 3,
      isCancelled: function () { return !alive(); },
      onRow: function (it) {
        if (!alive() || !it) return;
        var k = null;
        try { k = normalizePromptKey(it.prompt); } catch (eK) { k = null; }
        if (!k || !it.url || _deepLoaded[it.url]) return;
        var rec = _deepStore[k];
        if (!rec) {
          if (_deepKeys >= DEEP_KEY_CAP) return;
          _deepKeys++;
          rec = _deepStore[k] = { extra: 0, urls: [], seen: {} };
        }
        if (rec.seen[it.url]) return;
        rec.seen[it.url] = 1;
        rec.extra++;
        if (rec.urls.length < DEEP_URL_CAP) rec.urls.push(it.url);
        if (Date.now() - _deepPaintAt > 2000) { _deepPaintAt = Date.now(); try { applyGrid(); } catch (eA) {} }
      },
      onPage: function () {
        if (!alive()) return;
        if (Date.now() - _deepPaintAt > 4000) { _deepPaintAt = Date.now(); try { applyGrid(); } catch (eA2) {} }
      }
    }).then(function () { try { if (alive()) applyGrid(); } catch (eF) {} }, function () {});
  }

  function vaultRoot() { return document.getElementById("localMediaGallery_root"); }
  function publicRoot() { return document.querySelector(".dragon-gal-grid"); }

  function toArray(nl) { return Array.prototype.slice.call(nl || []); }
  function vaultTiles() {
    var r = vaultRoot();
    return r ? toArray(r.querySelectorAll("[data-local-media-gallery-item][data-id]")) : [];
  }
  function publicTiles() {
    var r = publicRoot();
    return r ? toArray(r.querySelectorAll(".dragon-gal-tile")) : [];
  }
  // public tiles carry their prompt on the element itself (set by addTile)
  function pubKeyFor(tile) {
    try {
      var t = tile && tile._t;
      var p = t && t.prompt;
      return p ? normalizePromptKey(p) : null;
    } catch (e) { return null; }
  }

  // ⚡ 2.55.2 — RECONCILE, DON'T RE-CREATE. These two run on every mutation of the gallery grid (this module
  // observes it), so the old remove-then-append rebuilt every badge and renumbered every tile on each pass:
  // the writes were themselves mutations, which re-armed the observer, and the wall never stopped repainting.
  // A badge that is already correct is now KEPT (marked for this pass) and only a stale one is removed, so a
  // pass with nothing to say mutates nothing and the loop dies.
  function clearBadgesIn(root) {
    if (!root) return;
    var badges = root.querySelectorAll(".dragon-dupe-badge");
    for (var j = 0; j < badges.length; j++) {
      var b = badges[j];
      if (b.__dragonDupeKeep) { b.__dragonDupeKeep = 0; continue; }   // re-labelled by this pass → keep it
      if (b.parentNode) b.parentNode.removeChild(b);
    }
  }

  function addBadge(tile, n) {
    if (!tile) return;
    var dx = 0;
    try { dx = deepExtraForTile(tile); } catch (eDX) { dx = 0; }
    var txt = "🧬×" + (n + dx);
    var ttl = dx > 0
      ? ((n + dx) + " share this prompt (" + n + " here + " + dx + " more in the channel) \u2014 open it to swipe through them")
      : (n + " images in this view share this prompt \u2014 open it to swipe through the copies");
    var b = null, kids = tile.children;
    for (var c = 0; c < kids.length; c++) { if (kids[c].classList && kids[c].classList.contains("dragon-dupe-badge")) { b = kids[c]; break; } }
    if (b) {
      if (b.textContent !== txt) b.textContent = txt;
      if (b.title !== ttl) b.title = ttl;
      b.__dragonDupeKeep = 1;
      return;
    }
    try { if (tile.style.position !== "relative" && getComputedStyle(tile).position === "static") tile.style.position = "relative"; } catch (e) {}
    b = document.createElement("span");
    b.className = "dragon-dupe-badge";
    b.textContent = txt;
    b.title = ttl;
    b.__dragonDupeKeep = 1;
    tile.appendChild(b);
  }

  function applyVaultTiles() {
    var root = vaultRoot();
    if (!root || !_scan) return;
    clearBadgesIn(root);
    var tiles = vaultTiles();
    var map = Object.create(null);
    var unknown = false;
    for (var i = 0; i < tiles.length; i++) {
      var k = keyForId(tiles[i].getAttribute("data-id"));
      if (k == null) { unknown = true; continue; }
      (map[k] || (map[k] = [])).push(tiles[i]);
    }
    if (unknown && (Date.now() - (_scan.at || 0)) > 4000) scheduleRescan();
    var seen = Object.create(null);
    for (var j = 0; j < tiles.length; j++) {
      var tile = tiles[j];
      var k2 = keyForId(tile.getAttribute("data-id"));
      var n = (k2 && map[k2]) ? map[k2].length : 1;
      tile.classList.remove("dragon-dupe-hidden");
      if (n > 1) {
        if (_collapse) { if (seen[k2]) { tile.classList.add("dragon-dupe-hidden"); continue; } seen[k2] = 1; }
        addBadge(tile, n);
      }
    }
    _lastVaultCount = tiles.length;
  }

  function applyPublicTiles() {
    var root = publicRoot();
    if (!root) return;
    clearBadgesIn(root);
    var tiles = publicTiles();
    if (!tiles.length) return;
    var map = Object.create(null);
    for (var i = 0; i < tiles.length; i++) {
      var k = pubKeyFor(tiles[i]);
      if (k == null || !k) continue;
      (map[k] || (map[k] = [])).push(tiles[i]);
    }
    var seen = Object.create(null);
    for (var j = 0; j < tiles.length; j++) {
      var tile = tiles[j];
      var k2 = pubKeyFor(tile);
      var n = (k2 && map[k2]) ? map[k2].length : 1;
      tile.classList.remove("dragon-dupe-hidden");
      if (n > 1) {
        if (_collapse) { if (seen[k2]) { tile.classList.add("dragon-dupe-hidden"); continue; } seen[k2] = 1; }
        addBadge(tile, n);
      }
    }
    _lastPubCount = tiles.length;
    try { if (window.__dragonRenumberGalTiles) window.__dragonRenumberGalTiles(); } catch (e) {}
  }

  function applyGrid() {
    if (!vaultRoot() && !publicRoot()) return;
    if (vaultRoot() && !_scan) { scan().then(function () { applyGrid(); }); }
    else { applyVaultTiles(); }
    applyPublicTiles();
    // 🖼🧬 Egon 22.09.2026 — collapsing/expanding hides tiles, and a JUSTIFIED wall packs every row from
    // the tiles it can see, so it has to be re-packed or the row that lost a tile ends short.
    try { if (window.__dragonGalJustifySoon) window.__dragonGalJustifySoon(); } catch (e) {}
    try { if (window.dragonVaultJustify && window.__dragonVaultJustified) window.dragonVaultJustify(); } catch (e) {}
  }

  function scheduleApply() {
    if (_applyTimer) return;
    _applyTimer = setTimeout(function () { _applyTimer = null; applyGrid(); }, 200);
  }

  function scheduleRescan() {
    if (_rescanTimer) return;
    _rescanTimer = setTimeout(function () {
      _rescanTimer = null;
      scan(true).then(function () { applyGrid(); });
    }, 600);
  }

  function ensureObserver() {
    var targets = [];
    var vr = vaultRoot(); if (vr) targets.push(vr);
    var pr = publicRoot(); if (pr) targets.push(pr);
    if (!targets.length) targets.push(document.body);
    var same = targets.length === _obsTargets.length;
    if (same) { for (var i = 0; i < targets.length; i++) if (targets[i] !== _obsTargets[i]) { same = false; break; } }
    if (_observer && same) return;
    if (_observer) { try { _observer.disconnect(); } catch (e) {} }
    _obsTargets = targets;
    try {
      _observer = new MutationObserver(function () { if (!_applying) scheduleApply(); });
      for (var t = 0; t < targets.length; t++) _observer.observe(targets[t], { childList: true, subtree: true });
    } catch (e) { _observer = null; }
  }

  window.dragonVaultDedupeOn = function () { return _collapse; };
  // 🧬 Egon 20.09.2026 — the function that does NOT collapse is called UNDUPE: it takes the grid out of the
  // collapsed state and every copy becomes visible again. Each half can be called on its own, and the
  // toolbar button (both galleries) simply calls the matching one.
  window.dragonVaultDedupe = function () { stopDeep(); _collapse = true; saveCollapse(); applyGrid(); syncAllBtns(); return true; };
  window.dragonVaultUndupe = function () { stopDeep(); _collapse = false; saveCollapse(); applyGrid(); syncAllBtns(); return true; };
  window.dragonVaultDedupeToggle = function () { return _collapse ? window.dragonVaultUndupe() : window.dragonVaultDedupe(); };
  window.dragonVaultDedupeApply = function () {
    if (vaultRoot() && !_scan) scan().then(applyGrid); else applyGrid();
  };

  function syncBtn(btn) {
    if (!btn) return;
    var deep = !!_deep;
    var mode = deep ? "deep" : (_collapse ? "dedupe" : "undupe");
    try { btn.textContent = deep ? "\uD83D\uDD0D" : (_collapse ? "\uD83E\uDDEC" : "\u21A9\uFE0F"); } catch (e) {}
    try { btn.classList.toggle("active", mode !== "undupe"); } catch (e) {}
    btn.setAttribute("aria-pressed", mode !== "undupe" ? "true" : "false");
    try { btn.setAttribute("data-dragon-dedupe-state", mode); } catch (e) {}
    btn.title = mode === "deep"
      ? "Deep Dedupe \u2014 groups instantly like Dedupe, then quietly walks the WHOLE channel in the background and grows the \u00D7N badges as channel-wide copies are found. Takes time and data. Click for the Dedupe menu."
      : (mode === "dedupe"
        ? "Dedupe \u2014 same-prompt copies are collapsed into ONE thumbnail right now. Click for the Dedupe menu."
        : "Undupe \u2014 every copy is shown right now. Click for the Dedupe menu.");
    try {
      btn.setAttribute("data-dragon-dedupe-mode", deep ? "deep" : "shallow");
    } catch (eDM) {}
  }
  function syncAllBtns() { for (var i = 0; i < _btns.length; i++) syncBtn(_btns[i]); }

  var _dupeMenu = null;
  function closeDedupeMenu() {
    try { if (_dupeMenu) _dupeMenu.remove(); } catch (e) {}
    _dupeMenu = null;
    try { document.removeEventListener("pointerdown", dupeMenuOutside, true); } catch (e2) {}
    try { document.removeEventListener("keydown", dupeMenuKey); } catch (e3) {}
  }
  function dupeMenuOutside(e) { try { if (_dupeMenu && !_dupeMenu.contains(e.target)) closeDedupeMenu(); } catch (e2) {} }
  function dupeMenuKey(e) { if (e && e.key === "Escape") closeDedupeMenu(); }
  function openDedupeMenu(anchor) {
    closeDedupeMenu();
    var m = document.createElement("div");
    m.className = "dragon-dupe-menu";
    m.style.cssText = "position:fixed; z-index:2147483650; min-width:240px; max-width:86vw; background:#1b1b24; border:1px solid #6a6a8c; border-radius:12px; padding:.35rem; box-shadow:0 14px 38px rgba(0,0,0,.65);";
    function row(glyph, name, desc, fn, sel) {
      var b2 = document.createElement("button");
      b2.type = "button";
      b2.style.cssText = "display:flex; gap:.5rem; align-items:center; width:100%; box-sizing:border-box; text-align:left; font-size:.78rem; font-weight:600; padding:.45rem .55rem; border:0; border-radius:8px; background:" + (sel ? "rgba(155,107,255,.18)" : "transparent") + "; color:#eee; cursor:pointer;";
      var g = document.createElement("span");
      g.textContent = glyph;
      g.style.cssText = "font-size:1rem; line-height:1; flex:0 0 auto;";
      var nm = document.createElement("span");
      nm.textContent = name + (sel ? " \u2713" : "");
      nm.style.cssText = "min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;";
      b2.appendChild(g); b2.appendChild(nm);
      b2.title = name + " \u2014 " + desc;
      b2.onmouseenter = function () { try { b2.style.background = "rgba(155,107,255,.14)"; } catch (eH) {} };
      b2.onmouseleave = function () { try { b2.style.background = "transparent"; } catch (eL) {} };
      b2.onclick = function (e) { e.stopPropagation(); closeDedupeMenu(); try { fn(); } catch (eF) {} };
      m.appendChild(b2);
    }
    var dupeMode = _deep ? "deep" : (_collapse ? "dedupe" : "undupe");
    row("\uD83E\uDDEC", "Dedupe", "Instant. Groups the loaded images that share a prompt into one thumbnail. Nothing is deleted.", function () { window.dragonVaultDedupe(); }, dupeMode === "dedupe");
    row("\uD83D\uDD0D", "Deep Dedupe", "Slow. Groups instantly like Dedupe, then quietly walks the WHOLE channel in the background and grows the \u00D7N badges as channel-wide copies are found. Takes time and data.", function () { window.dragonDeepDedupe(); }, dupeMode === "deep");
    row("\u21A9\uFE0F", "Undupe", "Instant. Shows every copy again.", function () { window.dragonVaultUndupe(); }, dupeMode === "undupe");
    document.body.appendChild(m);
    try {
      var r = anchor.getBoundingClientRect();
      var mw = m.offsetWidth || 250, mh = m.offsetHeight || 150;
      var x = Math.max(6, Math.min(r.left, (window.innerWidth || 800) - mw - 6));
      var y = r.bottom + 6;
      if (y + mh > (window.innerHeight || 700) - 6) y = Math.max(6, r.top - mh - 6);
      m.style.left = x + "px"; m.style.top = y + "px";
    } catch (eP) {}
    _dupeMenu = m;
    setTimeout(function () {
      try { document.addEventListener("pointerdown", dupeMenuOutside, true); } catch (eA) {}
      try { document.addEventListener("keydown", dupeMenuKey); } catch (eK) {}
    }, 0);
  }
  function makeDedupeButton() {
    ensureCss();
    var b = document.createElement("button");
    b.type = "button";
    b.className = "dragon-vault-dedupe-btn";
    b.textContent = "\uD83E\uDDEC";
    b.onclick = function (e) {
      e.stopPropagation();
      openDedupeMenu(b);
    };
    _btns.push(b);
    syncBtn(b);
    return b;
  }

  window.dragonVaultDedupeButton = function () { return makeDedupeButton(); };
  window.dragonPublicDedupeButton = function () { return makeDedupeButton(); };

  /* --------------------------------------------------------- lightbox */
  // index.html renders its duplicate strip through this hook. `item` is the
  // lightbox item: `item.vid` marks a VAULT copy (prompt looked up via the DB
  // scan), while a PUBLIC copy carries `item.prompt` directly. The strip is
  // built from the SAME grid grouping as the badges, so what you see is what you
  // swipe through. On a public thumb click `onPick(null, url)` swaps the image.
  window.dragonLbDupesRender = function (rowEl, item, onPick) {
    if (!rowEl) return;
    var lbRoot = null;
    try { lbRoot = rowEl.closest(".dragon-lightbox-root"); } catch (e) {}
    function hide() {
      rowEl.style.display = "none";
      rowEl.innerHTML = "";
      if (lbRoot) lbRoot.classList.remove("lbWithDupes");
    }
    function show(entries, activeIndex, hint) {
      ensureCss();
      rowEl.innerHTML = "";
      rowEl.style.display = "flex";
      // ONE centred row (the copies live on a `width:max-content` track that centres itself while it fits
      // and scrolls sideways — under the modern slider styled in ensureCss — once it doesn't).
      var track = document.createElement("div");
      track.className = "dragon-lb-dupes-track";
      var activeBtn = null;
      entries.forEach(function (en, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "dragonLbDupThumb" + (i === activeIndex ? " active" : "");
        b.title = "\uD83E\uDDEC duplicate " + (i + 1) + " / " + entries.length + (hint ? (" \u2014 " + hint) : "") + "\n(click to show this copy)";
        var im = document.createElement("img");
        im.alt = ""; im.loading = "lazy"; im.draggable = false;
        if (en.getSrc) en.getSrc().then(function (u) { if (u) im.src = u; });
        else im.src = en.src || "";
        b.appendChild(im);
        b.addEventListener("click", function () { if (i === activeIndex) return; if (en.pick) en.pick(); });
        if (i === activeIndex) activeBtn = b;
        track.appendChild(b);
      });
      rowEl.appendChild(track);
      if (lbRoot) lbRoot.classList.add("lbWithDupes");
      // Bring the ACTIVE copy into the middle of the strip (without scrolling the page itself). Measured with
      // rects so it stays exact no matter which element is the offsetParent (the fixed lightbox root is).
      try {
        if (activeBtn && rowEl.scrollWidth > rowEl.clientWidth + 2) {
          var rRect = rowEl.getBoundingClientRect();
          var bRect = activeBtn.getBoundingClientRect();
          rowEl.scrollLeft = Math.max(0, rowEl.scrollLeft + (bRect.left - rRect.left) - (rRect.width - bRect.width) / 2);
        }
      } catch (e) {}
    }
    if (!item) { hide(); return; }

    /* ---- VAULT path (item.vid) ---- */
    if (item.vid != null) {
      if (!_scan) {
        scan().then(function () { try { if (window.dragonLbDupesRefresh) window.dragonLbDupesRefresh(); } catch (e) {} }).catch(function () {});
        hide();
        return;
      }
      var vid = String(item.vid);
      var vk = keyForId(vid);
      if (vk == null) { hide(); return; }
      var vgroup = vaultTiles().filter(function (t) { return keyForId(t.getAttribute("data-id")) === vk; });
      if (vgroup.length < 2) { hide(); return; }
      var vActive = 0;
      for (var vi = 0; vi < vgroup.length; vi++) { if (vgroup[vi].getAttribute("data-id") === vid) { vActive = vi; break; } }
      var vEntries = vgroup.map(function (tile) {
        var tid = tile.getAttribute("data-id");
        var live = tile.querySelector("img");
        return {
          src: (live && live.src) || "",
          getSrc: function () { return blobUrl(tid); },
          pick: function () {
            var l = tile.querySelector("img");
            var direct = (l && l.src) ? l.src : null;
            if (direct) { if (onPick) onPick(tid, direct); return; }
            blobUrl(tid).then(function (u) { if (u && onPick) onPick(tid, u); });
          }
        };
      });
      show(vEntries, vActive, item.prompt ? String(item.prompt).slice(0, 160) : "");
      return;
    }

    /* ---- PUBLIC path (item.prompt) ---- */
    if (item.prompt) {
      var pk = normalizePromptKey(item.prompt);
      if (!pk) { hide(); return; }
      var pgroup = publicTiles().filter(function (t) { return pubKeyFor(t) === pk; });
      var pDeep = [];
      try {
        if (window.dragonDeepDedupeMembers) {
          var haveU = [];
          for (var hi = 0; hi < pgroup.length; hi++) { var him = pgroup[hi].querySelector("img"); if (him) haveU.push(him.currentSrc || him.src); }
          pDeep = window.dragonDeepDedupeMembers(pk, haveU) || [];
        }
      } catch (ePD) { pDeep = []; }
      if (pgroup.length + pDeep.length < 2) { hide(); return; }
      var pActive = 0;
      for (var pi = 0; pi < pgroup.length; pi++) {
        var im0 = pgroup[pi].querySelector("img");
        if (im0 && (im0.currentSrc || im0.src) && (im0.currentSrc || im0.src) === item.url) { pActive = pi; break; }
      }
      var pEntries = pgroup.map(function (tile) {
        var live = tile.querySelector("img");
        return {
          src: (live && (live.currentSrc || live.src)) || "",
          pick: function () {
            var l = tile.querySelector("img");
            var u = l ? (l.currentSrc || l.src) : null;
            if (u && onPick) onPick(null, u);
          }
        };
      });
      for (var di = 0; di < pDeep.length; di++) {
        (function (du) {
          pEntries.push({ src: du, pick: function () { if (onPick) onPick(null, du); } });
        })(pDeep[di]);
      }
      show(pEntries, pActive, String(item.prompt).slice(0, 160));
      return;
    }

    hide();
  };

  /* ------------------------------------------------------------- boot */
  function boot() {
    ensureCss();
    ensureObserver();
    scan().then(function () { applyGrid(); });
    try {
      setInterval(function () {
        ensureObserver();
        var vn = vaultTiles().length;
        var pn = publicTiles().length;
        if (vn !== _lastVaultCount || pn !== _lastPubCount) scheduleApply();
      }, 2500);
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
