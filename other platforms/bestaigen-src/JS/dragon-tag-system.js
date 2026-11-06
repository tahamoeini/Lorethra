
// 🏷️ WHAT I LIKE — TAG SYSTEM (Egon, 03.09.2026)
// ❤️ heart button + left-swipe open a tag panel. FIRST tag tap = permanent Likes
// save (same folder rule as the yellow ⭐). Re-tapping a tag only toggles the label — the
// save STAYS (unlike the star's toggle-delete). No tag tapped + not saved = just browsing,
// nothing is saved. Tags are hash-based, stored in localStorage.dragonTagMap
// {hash:{t:[ids],f:bool}}; custom tags in dragonCustomTags; per-image rating for the
// private-gallery G/PG13/18 filter in dragonRatingMap. In the Likes the heart
// button on tiles re-opens the panel, and a filter bar adds rating + tag filtering
// (rating = folder-independent list; tags = filter the current folder, view only).
(function () {
  if (window.__dragonTagSystem) return;
  window.__dragonTagSystem = true;

  var TAG_STORE = "dragonTagMap";
  var CUSTOM_STORE = "dragonCustomTags";
  var RATING_STORE = "dragonRatingMap";

  var DEFAULT_TAGS = [
    { id: "artStyle", e: "\uD83C\uDFA8", n: "Art Style" },
    { id: "outfit", e: "\uD83D\uDC57", n: "Outfit" },
    { id: "top", e: "\uD83D\uDC5A", n: "Top" },
    { id: "bottom", e: "\uD83D\uDC56", n: "Bottom" },
    { id: "hairStyle", e: "\uD83D\uDC87", n: "Hair Style" },
    { id: "hairColor", e: "\uD83D\uDC88", n: "Hair Color" },
    { id: "eyeShape", e: "\uD83D\uDC41\uFE0F", n: "Eye Shape" },
    { id: "eyeColor", e: "\uD83D\uDC40", n: "Eye Color" },
    { id: "makeup", e: "\uD83D\uDC84", n: "Makeup" },
    { id: "skinTone", e: "\uD83D\uDC64", n: "Skin Tone" },
    { id: "bodyShape", e: "\uD83E\uDDCD", n: "Body Shape" },
    { id: "posture", e: "\uD83E\uDDD8", n: "Posture" },
    { id: "underwear", e: "\uD83E\uDDF2", n: "Underwear" },
    { id: "footwear", e: "\uD83D\uDC60", n: "Footwear" },
    { id: "position", e: "\uD83D\uDCCC", n: "Position" },
    { id: "pose", e: "\uD83E\uDDCE", n: "Pose" },
    { id: "camAngle", e: "\uD83D\uDCF7", n: "Cam Angle" },
    { id: "background", e: "\uD83C\uDF9E\uFE0F", n: "Background" },
    { id: "lighting", e: "\uD83D\uDCA1", n: "Lighting" },
    { id: "effect", e: "\u2728", n: "Effect" },
    { id: "theme", e: "\uD83C\uDFAD", n: "Theme" },
    { id: "accessories", e: "\uD83D\uDC8D", n: "Accessories" },
    { id: "tattoo", e: "\uD83E\uDDA1", n: "Tattoo" },
    { id: "face", e: "\uD83D\uDE10", n: "Face" },
    { id: "emotion", e: "\uD83D\uDE0A", n: "Emotion" },
    { id: "mood", e: "\uD83C\uDF17", n: "Mood" },
    { id: "expression", e: "\uD83D\uDE33", n: "Expression" },
    { id: "body", e: "\uD83E\uDFB4", n: "Body" },
    { id: "proportions", e: "\uD83D\uDCD0", n: "Proportions" },
    { id: "legwear", e: "\uD83E\uDDE6", n: "Legwear" },
    { id: "landscape", e: "\uD83C\uDFDE\uFE0F", n: "Landscape" },
    { id: "cleavage", e: "\uD83E\uDE71", n: "Cleavage" },
    { id: "coloring", e: "\uD83D\uDD8C\uFE0F", n: "Coloring" },
    { id: "ambiance", e: "\uD83D\uDD6F\uFE0F", n: "Ambiance" }
  ];
  var FAV_ID = "\u2665fav";

  var _tagCache = { j: "", o: null };
  ;function tagStoreRaw() {
    var s = "{}";
    try { s = localStorage[TAG_STORE] || "{}"; } catch (e) { s = "{}"; }
    if (_tagCache.j !== s || !_tagCache.o) { try { _tagCache.o = JSON.parse(s); } catch (e) { _tagCache.o = {}; } _tagCache.j = s; }
    return _tagCache.o;
  }
  ;function tagStore() { return JSON.parse(JSON.stringify(tagStoreRaw())); }
  ;function tagSave(o) { try { localStorage[TAG_STORE] = JSON.stringify(o); } catch (e) {} }
  ;function dragonTagGet(hash) {
    var o = tagStoreRaw()[hash];
    var out = { t: (o && Array.isArray(o.t) ? o.t : []).slice(), f: !!(o && o.f) };
    // 🐉 System B (Egon 16.09.2026) — `tt` is the STASH of "What I Like" tags that were put away when
    // the image was un-favorited. They stay in the DB so re-favoriting (or the toast ↩️ Undo) brings
    // them back. This accessor and the setter below MUST carry it, otherwise the stash is destroyed.
    if (o && Array.isArray(o.tt) && o.tt.length) out.tt = o.tt.slice();
    return out;
  }
  ;function dragonTagSet(hash, rec) {
    var o = tagStore();
    var cur = o[hash] || {};
    var n = { t: (rec.t || []).slice(), f: !!rec.f };
    // `rec.tt` given → it is authoritative (an empty array explicitly CLEARS the stash, which is what
    // favoriting does once the tags have been restored); not given → keep whatever is on the record.
    var tt = (rec.tt !== undefined) ? (rec.tt || []) : (Array.isArray(cur.tt) ? cur.tt : []);
    if (tt && tt.length) n.tt = tt.slice();
    o[hash] = n;
    tagSave(o);
  }
  ;function customTags() { try { var l = JSON.parse(localStorage[CUSTOM_STORE] || "[]"); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  ;function customTagsSave(l) { try { localStorage[CUSTOM_STORE] = JSON.stringify(l); } catch (e) {} }
  var _ratingCache = { j: "", o: null };
  ;function ratingStore() {
    var s = "{}";
    try { s = localStorage[RATING_STORE] || "{}"; } catch (e) { s = "{}"; }
    if (_ratingCache.j !== s || !_ratingCache.o) { try { _ratingCache.o = JSON.parse(s); } catch (e) { _ratingCache.o = {}; } _ratingCache.j = s; }
    return _ratingCache.o;
  }
  ;function ratingSet(hash, r) {
    try {
      var o = JSON.parse(localStorage[RATING_STORE] || "{}");
      o[hash] = r;
      localStorage[RATING_STORE] = JSON.stringify(o);
    } catch (e) {}
  }
  ;function ratingGet(hash, folder) {
    var o = ratingStore();
    if (o[hash]) return o[hash] === "r18" ? "none" : o[hash]; // migrated value
    return (folder === "NS"+"FW") ? "none" : "g";
  }
  var _savedCache = { j: "", s: null };
  ;function dragonHashSavedAnywhere(hash) {
    var key = String(hash);
    var sig = "{}";
    try { sig = localStorage.dragonStarIdx || "{}"; } catch (e) { sig = "{}"; }
    var m = _savedCache.s;
    if (_savedCache.j !== sig || !m) {
      m = {};
      try {
        var idx = JSON.parse(sig);
        for (var f in idx) { var l = idx[f] || []; for (var i = 0; i < l.length; i++) m[String(l[i])] = true; }
      } catch (e) {}
      _savedCache.s = m; _savedCache.j = sig;
    }
    return !!m[key];
  }
  var _revCache = { j: "", m: null };
  ;function dragonHashForVaultId(id) {
    var sig = "{}";
    try { sig = localStorage.dragonStarIds || "{}"; } catch (e) { sig = "{}"; }
    var rev = _revCache.m;
    if (_revCache.j !== sig || !rev) {
      rev = {};
      try {
        var ids = JSON.parse(sig);
        for (var f in ids) { var mm = ids[f] || {}; for (var h in mm) rev[String(mm[h])] = h; }
      } catch (e) {}
      _revCache.m = rev; _revCache.j = sig;
    }
    var k = String(id);
    return rev[k] || null;
  }
  ;function allTagIds() {
    var ids = [];
    for (var i = 0; i < DEFAULT_TAGS.length; i++) ids.push(DEFAULT_TAGS[i].id);
    var cs = customTags();
    for (var j = 0; j < cs.length; j++) ids.push("custom:" + cs[j]);
    return ids;
  }
  ;function tagById(id) {
    if (id === FAV_ID) return { id: FAV_ID, e: "\u2764\uFE0F", n: "Favorite" };
    for (var i = 0; i < DEFAULT_TAGS.length; i++) if (DEFAULT_TAGS[i].id === id) return DEFAULT_TAGS[i];
    if (id.indexOf("custom:") === 0) return { id: id, e: "\uD83C\uDFF7\uFE0F", n: id.slice(7) };
    return null;
  }
  window.dragonTagGet = dragonTagGet;
  window.dragonTagSet = dragonTagSet;
  window.dragonRatingGet = ratingGet;
  window.dragonHashSavedAnywhere = dragonHashSavedAnywhere;
  window.dragonHashForVaultId = dragonHashForVaultId;
  window.dragonAllTagIds = allTagIds;
  window.dragonTagById = tagById;
  window.dragonFavTagId = FAV_ID;
  window.dragonRatingSet = ratingSet;
  window.dragonCustomTags = customTags;
  window.dragonCustomTagsSave = customTagsSave;

  // ============================================================================================
  // 🐉 SYSTEM B — FAVORITE = MOVE + "What I Like" UNLOCK (Egon 16.09.2026)
  //  * `rec.f` (dragonTagMap) is the ONLY source of truth for "favorite". It is a separate flag,
  //    never a chip in the tag row (the heart button already shows it).
  //  * Favoriting a VAULT image MOVES its record into the "Favorites" folder: the same id is written
  //    into the Favorites metadata store and removed from the source one, while the SHARED blob
  //    store (keyed by that same id) is never touched → no copy, no new id, no re-hash, no dupes.
  //    The folder the image came from is remembered in `localStorage.dragonFavHome` so un-favoriting
  //    can move it straight back.
  //  * Favoriting a PUBLIC-gallery image (no vault id) saves a copy into Favorites — there is nothing
  //    local to move; un-favoriting that one removes the copy again.
  //  * Un-favoriting STASHES the WIW tags on the record (`rec.tt`) and clears the active list (`rec.t`)
  //    — the tags are kept in the DB, so re-favoriting / the toast ↩️ Undo brings them back.
  //  * `rec.f` never depends on tags: removing every WIW tag keeps the image in Favorites.
  //  * Every toast in this system carries an ↩️ Undo (generator rule).
  // ============================================================================================
  var FAV_HOME_KEY = "dragonFavHome";
  ;function favHomeAll() {
    try { var o = JSON.parse(localStorage[FAV_HOME_KEY] || "{}"); return (o && typeof o === "object") ? o : {}; } catch (e) { return {}; }
  }
  // The remembered home folder of a favorite. A REAL folder name = "move it back there when
  // un-favorited". The empty string is an explicit marker for "this is only a copy of an image that
  // has no vault record of its own (public gallery) → removing the favorite deletes the copy".
  // A missing key means "unknown" and is always treated as 'general' (never a delete → no data loss).
  ;function favHomeSet(hash, folder) {
    try { var o = favHomeAll(); o[String(hash)] = String(folder == null ? "" : folder); localStorage[FAV_HOME_KEY] = JSON.stringify(o); } catch (e) {}
  }
  ;function favHomeGet(hash) { var o = favHomeAll(); return (hash in o) ? o[String(hash)] : null; }
  ;function favHomeDel(hash) {
    try { var o = favHomeAll(); delete o[String(hash)]; localStorage[FAV_HOME_KEY] = JSON.stringify(o); } catch (e) {}
  }
  window.dragonFavHomeGet = favHomeGet;

  // One-time normalization: every hash recorded in the "Favorites" folder IS a favorite (that is
  // exactly what the folder means), so the flag + the WIW row must agree with it. Purely additive —
  // it only turns rec.f ON for hashes already living in the Favorites folder and never touches tags.
  (function favNormalize() {
    try {
      var idx = JSON.parse(localStorage.dragonStarIdx || "{}");
      var favs = (idx["Favorites"] || []).slice();
      // Also count every hash the id→hash index files under the Favorites folder: those records
      // physically live in Favorites, so they ARE favorites even if the flag (or the idx list) lagged
      // behind. Purely additive — a flag is only ever turned ON here, never off, so no tag can be lost.
      try {
        var _ids = window.dragonStarIdsGet ? window.dragonStarIdsGet() : {};
        var _fm = _ids["Favorites"] || {};
        for (var _k in _fm) if (favs.indexOf(String(_k)) === -1) favs.push(String(_k));
      } catch (e0) {}
      if (!favs.length) return;
      var o = tagStore();
      var changed = false;
      for (var i = 0; i < favs.length; i++) {
        var h = String(favs[i]);
        var cur = o[h] || { t: [], f: false };
        if (!cur.f) { cur.f = true; o[h] = cur; changed = true; }
      }
      if (changed) tagSave(o);
    } catch (e) {}
  })();

  ;function vaultFolderNames() {
    try { var l = JSON.parse(localStorage["localMediaGallery_.names"] || "[]"); return Array.isArray(l) ? l : []; } catch (e) { return []; }
  }
  ;function vaultEnsureFolderName(name) {
    if (!name) return;
    try {
      var l = vaultFolderNames();
      if (l.indexOf(name) === -1) { l.push(name); localStorage["localMediaGallery_.names"] = JSON.stringify(l); }
    } catch (e) {}
  }
  // Which folder store does this vault id live in right now? (dragonStarIds is the reverse index.)
  ;function vaultFolderOfId(id, hash) {
    id = String(id == null ? "" : id);
    if (!id) return null;
    var ids = window.dragonStarIdsGet ? window.dragonStarIdsGet() : {};
    if (hash) { for (var f0 in ids) { var m0 = ids[f0] || {}; if (String(m0[String(hash)]) === id) return f0; } }
    for (var f in ids) {
      var m = ids[f] || {};
      for (var k in m) { if (String(m[k]) === id) return f; }
    }
    return null;
  }
  window.dragonVaultFolderOfId = vaultFolderOfId;

  // MOVE a vault record between two folder stores (shared blob untouched → the true "move" Egon asked for).
  ;function dragonVaultMoveRecord(id, src, dst) {
    return new Promise(function (res) {
      if (!id || !src || !dst || src === dst) { res(false); return; }
      (async function () {
        try {
          var sdb = await dragonOpenIDB("localMediaGallery_." + src + "-db-kv-plugin");
          var all = await dragonStoreAll(sdb);
          var rec = null;
          for (var i = 0; i < all.length; i++) { if (String(all[i].id) === String(id)) { rec = all[i]; break; } }
          if (!rec) { res(false); return; }
          vaultEnsureFolderName(dst);
          vaultEnsureFolderName(src);
          var ddb = await dragonOpenIDB("localMediaGallery_." + dst + "-db-kv-plugin");
          await dragonStorePut(ddb, String(id), rec);
          await dragonStoreDelete(sdb, String(id));
          res(true);
        } catch (e) { res(false); }
      })();
    });
  }
  window.dragonVaultMoveRecord = dragonVaultMoveRecord;

  ;function favIdxSet(hash, folder, on) {
    if (!hash || !folder) return;
    try {
      if (on) { if (!window.dragonStarHasHash(hash, folder)) window.dragonStarAddHash(hash, folder); }
      else window.dragonStarRemoveHash(hash, folder);
    } catch (e) {}
  }
  ;function favIdsSet(hash, folder, id) {
    try {
      var ids = window.dragonStarIdsGet ? window.dragonStarIdsGet() : {};
      if (!ids[folder]) ids[folder] = {};
      if (id == null) delete ids[folder][hash]; else ids[folder][hash] = String(id);
      window.dragonStarIdsSet(ids);
    } catch (e) {}
  }
  // Drop the tile of a record that just left the folder currently on screen (the plugin re-renders on demand).
  ;function favDropTile(id) {
    try {
      var root = document.getElementById("localMediaGallery_root");
      if (!root || id == null) return;
      var el = root.querySelector('[data-local-media-gallery-item][data-id="' + String(id).replace(/"/g, "") + '"]');
      if (el) el.remove();
      if (window.dragonVaultCounterSync) { try { window.dragonVaultCounterSync(); } catch (e) {} }
    } catch (e) {}
  }
  window.dragonFavDropTile = favDropTile;

  // 🐉 System B (Egon 16.09.2026) — a favourite MOVES a record in or out of the folder currently on
  // screen. Instead of blindly removing the tile, the removed element is REMEMBERED so that the ↩️
  // Undo (or a re-favourite) can put it straight back where it was — no flicker, no scroll jump and
  // no "the image vanished after Undo". Only the folder the record really entered/left is affected;
  // the "🖼 All images" overlay lists every folder, so its tiles always stay (the heart just re-tints).
  window.__dragonDroppedTiles = window.__dragonDroppedTiles || {};
  ;function favCurrentView() {
    if (window.__dragonVaultAllMode) return "__all__";
    var root = document.getElementById("localMediaGallery_root");
    if (!root) return null;
    try { return currentVaultFolder(root); } catch (e) { return null; }
  }
  ;function favTileFor(id) {
    var root = document.getElementById("localMediaGallery_root");
    if (!root || id == null) return null;
    var s = String(id).replace(/"/g, "");
    return root.querySelector('[data-local-media-gallery-item][data-id="' + s + '"], [data-oid="' + s + '"]');
  }
  ;function favSyncTile(id, hash) {
    id = (id == null) ? null : String(id);
    if (!id) return;
    var view = favCurrentView();
    if (view == null) return;
    var actual = null;
    try { actual = window.dragonVaultFolderOfId ? window.dragonVaultFolderOfId(id, hash) : null; } catch (e) {}
    var belongs = (view === "__all__" || actual == null) ? true : (actual === view);
    var store = window.__dragonDroppedTiles;
    if (belongs) {
      if (favTileFor(id)) { delete store[id]; }
      else {
        var rec = store[id];
        if (rec && rec.view === view && rec.el && !document.contains(rec.el)) {
          var parent = (rec.parent && rec.parent.isConnected) ? rec.parent : document.getElementById("localMediaGallery_root");
          if (parent) {
            if (rec.next && rec.next.parentNode === parent) parent.insertBefore(rec.el, rec.next);
            else parent.appendChild(rec.el);
          }
          delete store[id];
        }
      }
    } else if (!store[id]) {
      var el = favTileFor(id);
      if (el) {
        store[id] = { el: el, parent: el.parentNode, next: el.nextSibling, view: (el.getAttribute("data-folder") || view) };
        el.remove();
      }
    }
    try { refreshTiles(); } catch (e) {}
    try { if (window.dragonVaultCounterSync) window.dragonVaultCounterSync(); } catch (e) {}
  }
  window.dragonFavSyncTile = favSyncTile;
  window.dragonFavForgetDrops = function () { window.__dragonDroppedTiles = {}; };

  ;function favTintBtn(btn, hash, onOverride) {
    if (!btn) return;
    var on = (typeof onOverride === "boolean") ? onOverride : false;
    if (typeof onOverride !== "boolean") { try { on = !!dragonTagGet(hash).f; } catch (e) {} }
    btn.textContent = on ? "\uD83D\uDC98" : "\u2764\uFE0F";
    btn.title = on
      ? "\uD83D\uDC98 Favorite \u2014 tap to move it back out of Favorites"
      : "\u2764\uFE0F Favorite \u2014 tap to move this image into Favorites and open What I Like";
    btn.style.color = on ? "#ff2d55" : "#ffd0d8";
    btn.style.textShadow = on ? "0 0 6px rgba(255,45,85,.9)" : "";
    btn.setAttribute("data-dragon-fav-on", on ? "1" : "0");
  }
  window.dragonFavTintBtn = favTintBtn;

  // Silent core: sets the favorite on/off and MOVES the record. Callers own the toasts/undo.
  ;function dragonFavSet(hash, on, ctx, cb) {
    ctx = ctx || {};
    hash = String(hash || "");
    if (!hash) { if (cb) cb(false); return; }
    var rec = dragonTagGet(hash);
    var flagged = !!ctx.isFlagged;
    var id = (ctx.id != null && ctx.id !== "") ? String(ctx.id) : null;
    ;function afterChange() {
      ratingSet(hash, flagged ? "none" : "g");
      if (window.dragonVaultTagsChanged) { try { window.dragonVaultTagsChanged(); } catch (e) {} }
      try { refreshTiles(); } catch (e) {}
      if (window.dragonStatsListedGalleries) { try { window.dragonStatsListedGalleries(); } catch (e) {} }
    }
    if (on) {
      if (rec.f) { if (cb) cb(true); return; }
      // `srcFolder === "Favorites"` means it is already there → the flag alone has to be written.
      if (rec.tt && rec.tt.length) {
        var merged = (rec.t || []).slice();
        for (var i = 0; i < rec.tt.length; i++) if (merged.indexOf(rec.tt[i]) === -1) merged.push(rec.tt[i]);
        rec.t = merged;
      }
      rec.tt = [];
      rec.f = true;
      dragonTagSet(hash, rec);
      var src = ctx.srcFolder || null;
      if (!src && id) src = vaultFolderOfId(id, hash);
      var done = function (ok) {
        afterChange();
        if (cb) cb(ok !== false);
      };
      if (id) {
        var home = (src && src !== "Favorites") ? src : "general";
        favHomeSet(hash, home);
        favIdsSet(hash, "Favorites", id);
        favIdxSet(hash, "Favorites", true);
        if (src && src !== "Favorites") {
          favIdsSet(hash, src, null);
          favIdxSet(hash, src, false);
          dragonVaultMoveRecord(id, src, "Favorites").then(function (ok) {
            if (ok) { favSyncTile(id, hash); done(true); return; }
            // Move failed → revert cleanly, never leave a half state.
            var r2 = dragonTagGet(hash); r2.f = false; dragonTagSet(hash, r2);
            favIdsSet(hash, "Favorites", null);
            favIdsSet(hash, src, id);
            favIdxSet(hash, src, true);
            favHomeDel(hash);
            afterChange();
            if (window.dragonToast) window.dragonToast("\u26A0\uFE0F couldn't move the image into Favorites");
            if (cb) cb(false);
          });
        } else { done(true); }
      } else if (ctx.url) {
        // No vault record → this is a public-gallery image: only a COPY can be made in Favorites.
        favHomeSet(hash, "");
        if (window.dragonSaveToFavorites) window.dragonSaveToFavorites(ctx.url, ctx.prompt || "", function () { done(true); });
        else done(true);
      } else { done(true); }
    } else {
      if (!rec.f && !ctx.assumeFavorite) { if (cb) cb(false); return; }
      rec.f = false;
      rec.tt = (rec.t || []).slice();
      rec.t = [];
      dragonTagSet(hash, rec);
      var homeRaw = favHomeGet(hash);
      var isCopy = (homeRaw === "");
      var home2 = homeRaw || "general";
      var ids2 = window.dragonStarIdsGet ? window.dragonStarIdsGet() : {};
      var fid = (ids2["Favorites"] || {})[hash] || null;
      var doneOff = function () {
        favIdxSet(hash, "Favorites", false);
        afterChange();
        if (cb) cb(false);
      };
      if (fid) {
        if (!isCopy) {
          // Move the record back to the folder it came from — NEVER a delete (no data loss).
          favIdsSet(hash, "Favorites", null);
          favIdsSet(hash, home2, fid);
          favIdxSet(hash, home2, true);
          dragonVaultMoveRecord(fid, "Favorites", home2).then(function () { favSyncTile(fid, hash); doneOff(); });
        } else {
          // A copy saved for a public-gallery image: there is nothing local to move back to.
          favIdsSet(hash, "Favorites", null);
          if (window.dragonVaultDelete) window.dragonVaultDelete("Favorites", fid).then(doneOff);
          else doneOff();
        }
      } else { doneOff(); }
    }
  }
  window.dragonFavSet = dragonFavSet;

  ;function dragonFavToggle(ctx, cb) {
    ctx = ctx || {};
    var hash = String(ctx.hash || "");
    if (!hash) { if (cb) cb(false); return; }
    dragonFavSet(hash, !dragonTagGet(hash).f, ctx, cb);
  }
  window.dragonFavToggle = dragonFavToggle;

  // Some legacy vault records have no id→hash mapping at all (they were saved before that index
  // existed), so they cannot carry tags. Mint a STABLE synthetic key on demand for such a record
  // (additive, never overwrites an existing mapping, never touches the record or its blob) — and if
  // the record lives in the Favorites folder, mark it as a favorite at the same time.
  ;function dragonEnsureVaultHash(id, folder) {
    id = String(id == null ? "" : id);
    if (!id) return null;
    var h = window.dragonHashForVaultId ? window.dragonHashForVaultId(id) : null;
    if (h) {
      if (folder === "Favorites") { try { var rr = dragonTagGet(h); if (!rr.f) { rr.f = true; dragonTagSet(h, rr); } } catch (e) {} }
      return h;
    }
    h = dragonStarHash("vault:" + id);
    try {
      var ids = window.dragonStarIdsGet ? window.dragonStarIdsGet() : {};
      var f = folder || "general";
      if (!ids[f]) ids[f] = {};
      if (!ids[f][h]) { ids[f][h] = id; window.dragonStarIdsSet(ids); }
    } catch (e) {}
    if (folder === "Favorites") { try { var r2 = dragonTagGet(h); if (!r2.f) { r2.f = true; dragonTagSet(h, r2); } } catch (e) {} }
    return h;
  }
  window.dragonEnsureVaultHash = dragonEnsureVaultHash;

  // Is this image a favorite? `rec.f` is the flag; the folder hint covers records that physically sit
  // in the Favorites folder (which is what that folder MEANS) even if their flag was never written.
  ;function favIsOn(hash, folderHint) {
    if (hash) { try { if (dragonTagGet(hash).f) return true; } catch (e) {} }
    return folderHint === "Favorites";
  }
  window.dragonFavIsOn = favIsOn;

  // Shared toast helper: "moved in" / "moved out" both carry an ↩️ Undo.
  ;function favNotify(added, hash, ctx, folderName) {
    var undo = function () { window.dragonFavToggle({ hash: hash, id: ctx.id, url: ctx.url, prompt: ctx.prompt, isFlagged: ctx.isFlagged, srcFolder: added ? "Favorites" : (favHomeGet(hash) || "general") }); };
    var homeMsg = favHomeGet(hash);
    var msg = added
      ? "\u2764\uFE0F moved into Favorites \u2014 What I Like unlocked"
      : (homeMsg
        ? "\uD83D\uDC94 moved out of Favorites \u2014 back to \u201C" + homeMsg + "\u201D"
        : "\uD83D\uDC94 removed from Favorites");
    try {
      if (window.dragonToastAction) { window.dragonToastAction(msg, "\u21A9\uFE0F Undo", undo); return; }
    } catch (e) {}
    if (window.dragonToast) window.dragonToast(msg);
  }
  window.dragonFavNotify = favNotify;

  // One trigger used by the TILE double-click / tile heart / "All images" heart.
  ;function dragonFavFromTile(tile) {
    if (!tile) return;
    var id = tile.getAttribute("data-id") || tile.getAttribute("data-oid");
    if (!id) return;
    var hint = tile.getAttribute("data-folder") || window.__dragonVaultFolder || null;
    if (!hint) hint = vaultFolderOfId(String(id), null);
    hint = hint || "general";
    var hash = window.dragonEnsureVaultHash ? dragonEnsureVaultHash(String(id), hint) : (window.dragonHashForVaultId ? window.dragonHashForVaultId(String(id)) : null);
    if (!hash) return;
    var img = tile.querySelector("img, video");
    var url = (img && (img.currentSrc || img.src)) || "";
    var on = favIsOn(hash, hint);
    var flagged = (hint === "NS"+"FW") || tile.getAttribute("data-n"+"sfw") === "1";
    dragonFavSet(hash, !on, { hash: hash, id: String(id), url: url, prompt: "", isFlagged: flagged, srcFolder: on ? "Favorites" : hint, assumeFavorite: on }, function (added) {
      favNotify(added, hash, { hash: hash, id: String(id), url: url, isFlagged: flagged });
      try { if (window.dragonRefreshTagTiles) window.dragonRefreshTagTiles(); } catch (e) {}
    });
  }
  window.dragonFavFromTile = dragonFavFromTile;

  // Capture-phase click hook for the private-gallery tiles: a SINGLE click opens OUR standard lightbox, a
  // LONG PRESS (600 ms) toggles the favorite.
  // 🧩 W-UI252 (Egon 24.09.2026) — Egon: "single-clicking a picture in the private gallery reacts late and the
  // lightbox opens late, it used to be instant". It really was late: the first click was held back for 260 ms so a
  // quick SECOND click could be caught as a double-click. The lightbox now opens on the FIRST click, with no beat at
  // all — exactly like the public gallery, which has never had a delay (a lightbox that appears instantly cannot
  // see a second click on the tile underneath, so the favorite moved to a long press; the tile’s own ❤️ button and
  // the lightbox’s heart still do the same job with one tap).
  ;function dragonInstallTileDblHook(container) {
    if (!container || container.__dragonDblHook) return;
    container.__dragonDblHook = true;
    function tileOf(node) {
      var t = node;
      if (!t || (t.tagName !== "IMG" && t.tagName !== "VIDEO")) return null;
      if (t.closest("button")) return null;
      var tile = t.closest("[data-local-media-gallery-item], [data-oid]");
      if (!tile || !container.contains(tile)) return null;
      return tile;
    }
    var LP = 600, press = null;
    function cancelPress() { if (press) { clearTimeout(press.timer); press = null; } }
    container.addEventListener("pointerdown", function (ev) {
      var tile = tileOf(ev.target);
      if (!tile || (ev.button !== undefined && ev.button !== 0)) return;
      cancelPress();
      press = {
        tile: tile, x: ev.clientX, y: ev.clientY,
        timer: setTimeout(function () {
          press = null;
          tile.__dragonLpFired = Date.now();
          try { dragonFavFromTile(tile); } catch (e) {}
        }, LP)
      };
    }, true);
    container.addEventListener("pointermove", function (ev) {
      if (press && (Math.abs(ev.clientX - press.x) + Math.abs(ev.clientY - press.y) > 12)) cancelPress();
    }, true);
    container.addEventListener("pointerup", cancelPress, true);
    container.addEventListener("pointercancel", cancelPress, true);
    container.addEventListener("pointerleave", cancelPress, true);
    container.addEventListener("scroll", cancelPress, true);
    container.addEventListener("click", function (ev) {
      var tile = tileOf(ev.target);
      if (!tile) return;
      ev.stopPropagation();
      ev.preventDefault();
      // the long press already acted on this tile — swallow the click it produced
      if (tile.__dragonLpFired && (Date.now() - tile.__dragonLpFired) < 900) return;
      var im = (ev.target && ev.target.isConnected) ? ev.target : tile.querySelector("img, video");
      if (im && window.dragonVaultOpenLightbox) window.dragonVaultOpenLightbox(im);
    }, true);
  }
  window.dragonInstallTileDblHook = dragonInstallTileDblHook;

  ;function refreshTiles() {
    try {
      document.querySelectorAll(".dragon-gal-tile-star").forEach(function (st) {
        try {
          var u = st.dataset.url;
          if (!u) return;
          // Egon 16.09.2026 — regression fix: this refresh must ALSO look in every folder
          // (dragonHashSavedAnywhere), exactly like the tile/lb builders, otherwise a tile
          // saved to another folder flips back to the yellow star after any refresh.
          var h = dragonStarHash(u);
          var sv = window.dragonHashSavedAnywhere ? !!window.dragonHashSavedAnywhere(h) : window.dragonStarHasHash(h, window.dragonStarTargetFolder(st.dataset.isFlagged === "1"));
          window.dragonStarVisual(st, sv, st.dataset.isFlagged === "1", h);
        } catch (e) {}
      });
    } catch (e) {}
    try {
      document.querySelectorAll("[data-dragon-fav]").forEach(function (fb) {
        try { if (fb.dataset.url) window.tintFav(fb, fb.dataset.url); } catch (e) {}
      });
    } catch (e) {}
    // 🐉 System B — the private-gallery tile hearts (❤️/💘) follow the favorite flag.
    try {
      document.querySelectorAll(".dragon-vault-whatilike").forEach(function (b) {
        try {
          var tl = b.closest("[data-local-media-gallery-item], [data-oid]");
          var id = tl ? (tl.getAttribute("data-id") || tl.getAttribute("data-oid")) : null;
          var h = (id && window.dragonHashForVaultId) ? window.dragonHashForVaultId(id) : null;
          var hint = (tl && tl.getAttribute("data-folder")) || window.__dragonVaultFolder || null;
          window.dragonFavTintBtn(b, h, window.dragonFavIsOn(h, hint));
        } catch (e) {}
      });
    } catch (e) {}
  }
  window.dragonRefreshTagTiles = refreshTiles;

  // ---------- LIKES: TAG + RATING FILTERS ----------
  // ⚡ Egon 13.09.2026 — PRIVATE GALLERY STATE PERSISTENCE ("cookie system"): a professional site
  // remembers what you were looking at. The private gallery's stable UI state (rating filter, tag
  // filter, prompt search, exclude terms, sort order, scroll position per folder) is written to
  // localStorage and restored on the next visit, so re-opening never snaps back to defaults.
  // (Display mode and tile zoom already persist: dragonVaultDisplay / dragonVaultZoom.)
  var VAULT_UI_KEY = "dragonVaultUI";
  var vaultState = { rating: "all", tags: [], search: "", exclude: [], sort: "dateDesc", scroll: {} };
  var vaultWasFiltered = false;
  var vaultSortSel = null;
  window.dragonVaultFilterState = function () { return vaultState; };

  ;function vaultUIPersistNow() {
    try {
      var r = document.getElementById("localMediaGallery_root");
      if (r) {
        var g = (typeof dragonPluginGrid === "function") ? dragonPluginGrid(r) : null;
        if (g) {
          vaultState.scroll = vaultState.scroll || {};
          vaultState.scroll[currentVaultFolder(r)] = g.scrollTop || 0;
        }
      }
      localStorage.setItem(VAULT_UI_KEY, JSON.stringify({
        rating: vaultState.rating, tags: vaultState.tags, search: vaultState.search,
        exclude: vaultState.exclude, sort: vaultState.sort, scroll: vaultState.scroll
      }));
    } catch (e) {}
  }
  var _vaultUIPersistT = null;
  ;function vaultUIPersist() {
    if (_vaultUIPersistT) clearTimeout(_vaultUIPersistT);
    _vaultUIPersistT = setTimeout(vaultUIPersistNow, 400);
  }
  window.dragonVaultUIPersist = vaultUIPersist;
  (function vaultUILoad() {
    try {
      var raw = localStorage.getItem(VAULT_UI_KEY);
      if (!raw) return;
      var o = JSON.parse(raw);
      if (!o || typeof o !== "object") return;
      if (typeof o.rating === "string") vaultState.rating = o.rating;
      if (Array.isArray(o.tags)) vaultState.tags = o.tags;
      if (typeof o.search === "string") vaultState.search = o.search;
      if (Array.isArray(o.exclude)) vaultState.exclude = o.exclude;
      if (typeof o.sort === "string") vaultState.sort = o.sort;
      if (o.scroll && typeof o.scroll === "object") vaultState.scroll = o.scroll;
    } catch (e) {}
  })();

  // ⚡ Egon 13.09.2026 — INSTANT RE-OPEN ("keep-alive"). A professional site does not rebuild the page
  // you just left. Closing now DETACHES the gallery root (keeping its DOM and its tile media) instead
  // of destroying it; re-opening re-attaches the very same node → no IndexedDB reads, no image
  // decode, no toolbar rebuild: the toolbar you left is the toolbar you get. A newly added image
  // marks the kept DOM dirty so the next open does a full rebuild (otherwise it would be missing).
  // Disabled on low-memory devices (<=4GB) where holding the DOM would be wasteful.
  window.__dragonVaultDirty = false;
  var _vaultKeepRoot = null;
  var _vaultKeepOn = true;
  try { var _kdm = navigator.deviceMemory; if (_kdm && _kdm <= 4) _vaultKeepOn = false; } catch (e) {}
  ;function dragonVaultDetach(root) {
    try { if (root && root.parentNode) root.parentNode.removeChild(root); } catch (e) {}
  }
  ;function dragonVaultHide() {
    var root = document.getElementById("localMediaGallery_root");
    try { document.documentElement.style.overflow = ""; document.body.style.overflow = ""; } catch (e) {}
    if (!root) return false;
    try { vaultUIPersistNow(); } catch (e) {}
    dragonVaultDetach(root);
    // ⚡ Egon 14.09.2026 — RECALCULATE "to the top" visibility based on page when vault closes
    // (fixes if it remains visible due to vault scrolling).
    try { if (window.__dragonScrollTopRefresh) window.__dragonScrollTopRefresh(); } catch (e) {}
    // ⚡ Egon 13.09.2026 — only KEEP a DOM that still matches storage. If an image was added while
    // the gallery was closed, the kept DOM would be stale → don't keep it, rebuild next open.
    _vaultKeepRoot = (_vaultKeepOn && !window.__dragonVaultDirty) ? root : null;
    return true;
  }
  window.dragonVaultHide = dragonVaultHide;
  window.dragonVaultKeepRoot = function () { return _vaultKeepRoot; };
  window.dragonVaultDiscardKeep = function () {
    var r = _vaultKeepRoot; _vaultKeepRoot = null;
    if (r) { try { if (r.__dragonPoll) clearInterval(r.__dragonPoll); } catch (e) {} dragonVaultDetach(r); }
  };
  ;function dragonVaultResume() {
    var root = _vaultKeepRoot;
    if (!root || root.isConnected) return null;
    _vaultKeepRoot = null;
    try { document.documentElement.style.overflow = "hidden"; document.body.style.overflow = "hidden"; } catch (e) {}
    document.body.appendChild(root);
    // 🧱 Egon 14.09.2026 — BLACK SCREEN FIX: "All images" panel might have remained open or
    // grid became display:none in the DOM returned from keep-alive. Revert to clean folder view on reopen.
    try {
      var _st = root.querySelectorAll ? root.querySelectorAll(".dragon-vault-inplace") : [];
      for (var _si = 0; _si < _st.length; _si++) { try { _st[_si].remove(); } catch (e) {} }
      window.__dragonVaultAllMode = false;
      var _pg0 = dragonPluginGrid(root);
      if (_pg0) _pg0.style.display = "flex"; // 🧱 Egon 14.09.2026 — maintain inline display:flex (prevent it from falling back to block).
      if (window.dragonVaultUnhideMediaTiles) window.dragonVaultUnhideMediaTiles();
      if (window.dragonVaultRefitAll) window.dragonVaultRefitAll();
    } catch (e) {}
    try { if (root.__dragonSyncMob) root.__dragonSyncMob(); } catch (e) {}
    try { window.dragonVaultForceLoad && window.dragonVaultForceLoad(); } catch (e) {}
    try { if (window.dragonVaultRefitAll) window.dragonVaultRefitAll(); } catch (e) {}
    // 🧹 Egon 14.09.2026 — toolbar should open as OPEN on reopen: with keep-alive, the collapse
    // state from the previous session remained in the DOM → user found the toolbar "missing" when opening the gallery.
    // Public gallery also starts open every time; collapse only occurs with actual scrolling.
    try { if (window.__dragonExpandVaultHeader) window.__dragonExpandVaultHeader(); } catch (e) {}
    try { if (window.__dragonScrollTopRefresh) window.__dragonScrollTopRefresh(); } catch (e) {}
    try {
      var f = currentVaultFolder(root);
      var top = (vaultState.scroll && vaultState.scroll[f]) || 0;
      if (top > 0) {
        var g = dragonPluginGrid(root);
        if (g) setTimeout(function () { try { g.scrollTop = top; } catch (e) {} }, 30);
      }
    } catch (e) {}
    return root;
  }
  window.dragonVaultResume = dragonVaultResume;
  // An own `remove` on the root routes EVERY close path (plugin Esc handler, navbar Likes, the
  // floating button) through the keep-alive detach, so none of them destroys the kept DOM.
  ;function dragonVaultInstallKeep(root) {
    if (!root || root.__dragonKeepInstalled) return;
    root.__dragonKeepInstalled = true;
    if (!_vaultKeepOn) return;
    var realRemove = Element.prototype.remove;
    root.remove = function () {
      try { if (window.dragonVaultHide) return window.dragonVaultHide(); } catch (e) {}
      return realRemove.call(root);
    };
  }
  window.dragonVaultInstallKeep = dragonVaultInstallKeep;
  // A new image added while the gallery is closed makes the kept DOM stale → full rebuild next open.
  ;function dragonVaultWrapAdd() {
    try {
      var pg = window.t2i_privateGallery;
      if (!pg || typeof pg.add !== "function" || pg.add.__dragonWrapped) return;
      var orig = pg.add.bind(pg);
      var wrapped = function () { window.__dragonVaultDirty = true; return orig.apply(null, arguments); };
      wrapped.__dragonWrapped = true;
      pg.add = wrapped;
    } catch (e) {}
  }
  window.dragonVaultWrapAdd = dragonVaultWrapAdd;

  ;function currentVaultFolder(root) {
    try {
      var sels = root.querySelectorAll("select");
      if (sels.length > 1) {
        var v = sels[1].value;
        if (v && v !== "__new__" && v !== "__del__") return v;
      }
    } catch (e) {}
    return "general";
  }

  // ============================================================================================
  // Egon 15.09.2026 — PRIVATE GALLERY IMPROVEMENTS:
  //  (1) item buttons "kiss" (gap:0, ⭐ in the middle), (2) 1-5 DROPDOWN (not prompt) when ⭐ clicked,
  //  (3) selected score remains as RED digit over ⭐, (4) old "edit info" is hidden →
  //  replaced by OUR Prompt Info button, (5) 4-way counter in toolbar (total/folder count+size),
  //  (6) "🖼 All images" in folder menu (listing above folder).
  // ============================================================================================
  var _vaultItemRatingCache = { folder: null, map: {} };
  var _vaultSizeCache = null;
  var _vaultRateGuard = 0;
  ;function dragonFmtBytes(b) {
    b = Number(b) || 0;
    if (b < 1024) return b + " B";
    if (b < 1048576) return (b / 1024).toFixed(b < 10240 ? 1 : 0) + " KB";
    if (b < 1073741824) return (b / 1048576).toFixed(b < 10485760 ? 1 : 0) + " MB";
    return (b / 1073741824).toFixed(2) + " GB";
  }
  ;function dragonVaultInstallBarCss() {
    if (document.getElementById("dragonVaultBarCss")) return;
    var s = document.createElement("style");
    s.id = "dragonVaultBarCss";
    s.textContent =
      "[data-local-media-gallery-bar]{gap:0 !important; align-items:stretch !important;}" +
      "[data-local-media-gallery-bar]>button{margin:0 !important; border-radius:0 !important; border:1px solid #6a6a7a !important; border-left-width:0 !important; min-width:34px; height:25px; padding:0 9px !important; background:linear-gradient(180deg,#2f2f3b,#17171d) !important; color:#eee !important; font-size:14px !important; line-height:1 !important; cursor:pointer;}" +
      "[data-local-media-gallery-bar]>button:first-child{border-left-width:1px !important; border-radius:9px 0 0 9px !important;}" +
      "[data-local-media-gallery-bar]>button:last-child{border-radius:0 9px 9px 0 !important;}" +
      // Egon 15.09.2026 — delete button should have a rounded left edge even when it is the first VISIBLE button in the row.
      "[data-local-media-gallery-bar]>button.dragon-vault-bar-first{border-left-width:1px !important; border-radius:9px 0 0 9px !important;}" +
      "[data-local-media-gallery-bar]>button.dragon-vault-bar-last{border-radius:0 9px 9px 0 !important;}" +
      "[data-local-media-gallery-bar]>button:hover{background:linear-gradient(180deg,#3d3d4d,#21212a) !important;}" +
      "[data-local-media-gallery-bar]>button[data-dragon-vault-editinfo]{display:none !important;}" +
      // Egon 16.09.2026 — the ⭐ rate button is hidden (replaced by the 💘 What I Like tile button).
      "[data-local-media-gallery-bar]>button[data-dragon-vault-rate-hidden]{display:none !important;}" +
      // 🐉 System B (Egon 16.09.2026) — tile favorite heart: ❤️ off / 💘 on (attribute set by dragonFavTintBtn).
      ".dragon-vault-whatilike{color:#ffd0d8;}" +
      ".dragon-vault-whatilike[data-dragon-fav-on=\"1\"]{color:#ff2d55 !important; text-shadow:0 0 6px rgba(255,45,85,.9);}" +
      ".dragon-vault-promptinfo{color:#d8c9ff !important;}" +
      // Egon 17.09.2026 — the FAR-RIGHT private-tile button: send a saved image to the public gallery.
      ".dragon-vault-rate-menu{position:fixed; z-index:2147483647; display:flex; gap:4px; padding:5px 6px; border-radius:10px; background:#1c1c24; border:1px solid #6a6a7a; box-shadow:0 8px 24px rgba(0,0,0,.7);}" +
      ".dragon-vault-rate-menu button{width:30px; height:30px; border-radius:7px; border:1px solid #6a6a7a; background:linear-gradient(180deg,#2f2f3b,#17171d); color:#eee; font-weight:800; cursor:pointer;}" +
      ".dragon-vault-rate-menu button:hover{background:#3d3d4d;}" +
      ".dragon-vault-rate-menu button.dgm-clear{width:auto; padding:0 8px; color:#ff9aa3; border-color:#ff6a76;}" +
      // Egon 17.09.2026 — this element is now an ICON-ONLY "Storage info" button (💽): the old 26px
      // text pill became a compact 22px icon button that matches the kissing toolbar standard.
      // 💽 Egon 19.09.2026 — this INFO button was the only control in the private toolbar that was not
      // the standard square (it stretched to 34x24 because of its old pill padding). It now takes the
      // EXACT same 22x22 square box as its neighbours (the 🔍/🙈/🔞/🚫/🎚/🧬 buttons), so the whole
      // row is one standard size and the UI-Scale rule scales it identically.
      ".dragon-vault-counter{display:inline-flex; align-items:center; justify-content:center; white-space:nowrap; width:22px; height:22px; padding:0; box-sizing:border-box; font-size:.85rem; color:#cfe3ff; background:linear-gradient(180deg,#1a2632,#0f1720); border:1px solid #4a6a8c; border-radius:7px; cursor:pointer;}" +
      // Egon 17.09.2026 — the element is a single ICON button now, so the old full-width text-wrapping
      // hack (which made it fill a whole phone row) is gone; only a small top margin remains on phones.
      "@media (max-width:700px){ .dragon-vault-counter{width:22px !important; min-width:22px !important; height:22px !important; padding:0 !important; margin:2px 0 0 !important;} #localMediaGallery_root{overflow-x:hidden !important;} }";
    document.head.appendChild(s);
  }
  ;function dragonVaultDecorateItems(root) {
    if (!root) return;
    dragonVaultInstallBarCss();
    var folder = _vaultItemRatingCache.folder;
    // 🐉 System B — the folder the user is looking at right now (used as the favorite hint: everything
    // seen inside the Favorites folder is a favorite even if its flag was never written).
    var _curFol = "general";
    try { _curFol = currentVaultFolder(root); } catch (e) {}
    window.__dragonVaultFolder = _curFol;
    var tiles = root.querySelectorAll("[data-local-media-gallery-item]");
    for (var i = 0; i < tiles.length; i++) {
      var tl = tiles[i];
      var bar = tl.querySelector("[data-local-media-gallery-bar]");
      if (!bar) continue;
      var id = tl.getAttribute("data-id");
      var rateBtn = bar.querySelector('button[title^="rate item"],button[data-dragon-tip^="rate item"]');
      if (rateBtn) {
        // Egon 16.09.2026 — the ⭐ "rate item" button is gone from the tiles (its old rating-number
        // decoration code is parked in Librarybook.enc). The button is only HIDDEN, never destroyed,
        // so the plugin's own handler/data stay intact. Its place is taken by the tile FAVORITE heart
        // (System B): ❤️ not-favorite / 💘 favorite — it moves the image in and out of the Favorites
        // folder. The lightbox heart drives the very same state (the tag row opens by itself).
        rateBtn.style.setProperty("display", "none", "important");
        rateBtn.setAttribute("data-dragon-vault-rate-hidden", "1");
        var wlBtn = bar.querySelector(".dragon-vault-whatilike");
        if (!wlBtn) {
          wlBtn = document.createElement("button");
          wlBtn.type = "button";
          wlBtn.className = "dragon-vault-whatilike";
          // 🐉 System B (Egon 16.09.2026) — this tile heart is the FAVORITE control: ❤️ while the image
          // is not a favorite, 💘 once it is. Tapping it when it is OFF moves the image into the
          // Favorites folder AND opens the lightbox with the "What I Like" panel unlocked; tapping it
          // when it is ON moves it back to the folder it came from (toast carries ↩️ Undo).
          wlBtn.onclick = (function (theTl) {
            return function (e) {
              e.stopPropagation();
              e.preventDefault();
              var rid = theTl.getAttribute("data-id");
              var h = (rid && window.dragonHashForVaultId) ? window.dragonHashForVaultId(rid) : null;
              if (!h) return;
              var fol = "general";
              try { var rt = document.getElementById("localMediaGallery_root"); if (rt) fol = currentVaultFolder(rt); } catch (e0) {}
              var imgEl = theTl.querySelector("img, video");
              var url = (imgEl && (imgEl.currentSrc || imgEl.src)) || "";
              var isOn = !!dragonTagGet(h).f;
              if (isOn) {
                window.dragonFavSet(h, false, { hash: h, id: rid, url: url, isFlagged: fol === "NS"+"FW", srcFolder: "Favorites" }, function (added) {
                  window.dragonFavNotify(added, h, { hash: h, id: rid, url: url, isFlagged: fol === "NS"+"FW" });
                });
                return;
              }
              // Open the lightbox FIRST (its swipe list is built from the tiles on screen), then move.
              try { if (imgEl && window.dragonVaultOpenLightbox) window.dragonVaultOpenLightbox(imgEl); } catch (e2) {}
              window.dragonFavSet(h, true, { hash: h, id: rid, url: url, isFlagged: fol === "NS"+"FW", srcFolder: fol }, function (added) {
                window.dragonFavNotify(added, h, { hash: h, id: rid, url: url, isFlagged: fol === "NS"+"FW" });
                try { if (window.dragonLbTagsRefresh) window.dragonLbTagsRefresh(h); } catch (e3) {}
              });
            };
          })(tl);
          if (rateBtn.parentNode) rateBtn.parentNode.insertBefore(wlBtn, rateBtn.nextSibling);
          else bar.appendChild(wlBtn);
        }
        // keep the heart's look in sync with the favorite flag (decorate runs on every tile refresh)
        try {
          var _wlId = tl.getAttribute("data-id");
          var _wlHash = _wlId ? window.dragonHashForVaultId(_wlId) : null;
          window.dragonFavTintBtn(wlBtn, _wlHash, window.dragonFavIsOn(_wlHash, _curFol));
        } catch (e5) {}
      }
      var infoBtn = bar.querySelector('button[title="edit info"],button[data-dragon-tip="edit info"]');
      if (infoBtn) infoBtn.setAttribute("data-dragon-vault-editinfo", "1");
      if (!bar.querySelector(".dragon-vault-promptinfo")) {
        var pBtn = document.createElement("button");
        pBtn.type = "button"; pBtn.className = "dragon-vault-promptinfo"; pBtn.textContent = "\u2139\uFE0F";
        pBtn.title = "Prompt Info";
        pBtn.onclick = (function (theId) {
          return function (e) {
            e.stopPropagation();
            if (!window.dragonVaultBlobGet) { dragonToast("\u2139\uFE0F not ready"); return; }
            window.dragonVaultBlobGet(theId).then(function (rec) {
              var inf = rec && rec.info;
              if (typeof inf === "string") { try { inf = JSON.parse(inf); } catch (er) { inf = null; } }
              if (!inf || !inf.prompt) { dragonToast("\u2139\uFE0F no prompt info saved"); return; }
              window.dragonPromptInfo({ prompt: inf.prompt, neg: inf.negativePrompt, seed: inf.seed, gs: inf.guidanceScale, desc: (inf.desc || inf.description || "") });
            });
          };
        })(id);
        bar.appendChild(pBtn);
      }
      // Egon 18.09.2026 — 📮 REMOVED from private-gallery tiles (batch49): the send button now lives ONLY in
      // the Image History lightbox (see the pushPublic option of dragonZoomLightbox). The old
      // per-tile button (class .dragon-vault-pushpublic, appended to this action bar) is PARKED — it used to call
      // window.dragonSendToPublicGallery with the tile blob url + the prompt stored in its vault record.
    }
    try { dragonVaultMarkBarEnds(root); } catch (e) {}
  }
  // Egon 15.09.2026 — marks the first and last VISIBLE buttons of the delete/move/rate row; this way
  // the ends always remain rounded even if the number badge leaves the row (to prevent visual glitch).
  ;function dragonVaultMarkBarEnds(root) {
    if (!root) return;
    var bars = root.querySelectorAll("[data-local-media-gallery-bar]");
    for (var i = 0; i < bars.length; i++) {
      var btns = bars[i].querySelectorAll(":scope > button");
      var first = null, last = null;
      for (var j = 0; j < btns.length; j++) {
        var vis = true;
        try { vis = getComputedStyle(btns[j]).display !== "none"; } catch (e) {}
        if (!vis) continue;
        if (!first) first = btns[j];
        last = btns[j];
      }
      for (var k = 0; k < btns.length; k++) {
        btns[k].classList.remove("dragon-vault-bar-first", "dragon-vault-bar-last");
      }
      if (first) first.classList.add("dragon-vault-bar-first");
      if (last) last.classList.add("dragon-vault-bar-last");
    }
  }
  window.dragonVaultMarkBarEnds = dragonVaultMarkBarEnds;
  ;function dragonVaultRefreshRatings(folder, cb) {
    dragonVaultInstallBarCss();
    if (!folder || folder === "__all__") { _vaultItemRatingCache = { folder: null, map: {} }; if (cb) cb(); return; }
    window.dragonOpenIDB("localMediaGallery_." + folder + "-db-kv-plugin").then(function (db) {
      return window.dragonStoreAll(db);
    }).then(function (all) {
      var map = {};
      for (var i = 0; i < (all || []).length; i++) {
        var m = all[i];
        if (m && m.id != null && m.rating) map[String(m.id)] = m.rating;
      }
      _vaultItemRatingCache = { folder: folder, map: map };
      var root = document.getElementById("localMediaGallery_root");
      if (root) dragonVaultDecorateItems(root);
      if (cb) cb();
    }).catch(function () { _vaultItemRatingCache = { folder: folder, map: {} }; if (cb) cb(); });
  }
  ;function dragonVaultCloseRateMenu() { var m = document.querySelector(".dragon-vault-rate-menu"); if (m) m.remove(); }
  ;function dragonVaultRateMenu(btn) {
    dragonVaultCloseRateMenu();
    _vaultRateGuard = Date.now() + 80;
    var id = null;
    var tile = btn.closest && btn.closest("[data-local-media-gallery-item]");
    if (tile) id = tile.getAttribute("data-id");
    var menu = document.createElement("div");
    menu.className = "dragon-vault-rate-menu";
    ;function pick(n) {
      dragonVaultCloseRateMenu();
      if (id != null) { if (n > 0) _vaultItemRatingCache.map[String(id)] = n; else delete _vaultItemRatingCache.map[String(id)]; }
      // Run the plugin's own handler (for persist + sort) by temporarily overriding the prompt.
      var origPrompt = window.prompt;
      window.prompt = function () { return String(n > 0 ? n : 0); };
      try { if (btn.onclick) btn.onclick({ stopPropagation: function () {}, preventDefault: function () {} }); }
      finally { window.prompt = origPrompt; }
      var root = document.getElementById("localMediaGallery_root");
      setTimeout(function () { dragonVaultDecorateItems(root); }, 40);
      setTimeout(function () { dragonVaultDecorateItems(root); }, 220);
    }
    for (var n = 1; n <= 5; n++) {
      (function (nn) {
        var b = document.createElement("button"); b.type = "button"; b.textContent = String(nn); b.title = "Rate " + nn;
        b.onclick = function (e) { e.stopPropagation(); pick(nn); };
        menu.appendChild(b);
      })(n);
    }
    var clr = document.createElement("button"); clr.type = "button"; clr.className = "dgm-clear"; clr.textContent = "\u2716"; clr.title = "Clear rating";
    clr.onclick = function (e) { e.stopPropagation(); pick(0); }; menu.appendChild(clr);
    document.body.appendChild(menu);
    var r = btn.getBoundingClientRect();
    var mw = menu.offsetWidth || 210;
    var left = Math.max(6, Math.min(window.innerWidth - mw - 6, r.left + r.width / 2 - mw / 2));
    var top = r.top - (menu.offsetHeight || 40) - 6;
    if (top < 6) top = r.bottom + 6;
    menu.style.left = left + "px"; menu.style.top = top + "px";
  }
  ;function dragonVaultInstallRateHook() {
    if (window.__dragonVaultRateHooked) return;
    window.__dragonVaultRateHooked = true;
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var btn = t.closest('[data-local-media-gallery-bar] button[title^="rate item"]');
      if (!btn) return;
      if (Date.now() < _vaultRateGuard) { e.preventDefault(); e.stopImmediatePropagation(); return; }
      e.preventDefault(); e.stopImmediatePropagation();
      dragonVaultRateMenu(btn);
    }, true);
    document.addEventListener("click", function (e) {
      if (Date.now() < _vaultRateGuard) return;
      if (!e.target || !e.target.closest || !e.target.closest(".dragon-vault-rate-menu")) dragonVaultCloseRateMenu();
    }, false);
  }
  // When "🖼 All images" is selected, the plugin's own onchange should NEVER see it (otherwise activeGalleryName
  // becomes "__all__" and the grid empties). We capture and stop it at the document phase.
  ;function dragonVaultInstallFolderHook() {
    if (window.__dragonVaultFolderHooked) return;
    window.__dragonVaultFolderHooked = true;
    document.addEventListener("change", function (e) {
      var t = e.target;
      if (!t || t.tagName !== "SELECT" || t.value !== "__all__") return;
      if (!t.closest || !t.closest("#localMediaGallery_root")) return;
      e.stopImmediatePropagation();
      window.__dragonVaultAllMode = true;
      openVaultOverlay(true);
    }, true);
  }
  ;async function dragonVaultComputeSizes() {
    if (_vaultSizeCache && _vaultSizeCache.ready) return _vaultSizeCache;
    // ⚡ Egon 13.09.2026 — the per-image byte sizes are now remembered across opens (localStorage
    // map, filled by dragonVaultForceLoad whenever it already reads a blob). So this no longer
    // scans the whole (100+ MB) blobs store on every gallery open — it only fills in ids it has
    // never seen before, and after that first fill it is a pure in-memory tally.
    var map = (window.dragonVaultSizeMapLoad ? window.dragonVaultSizeMapLoad() : {});
    var gals = ["general"];
    try { var raw = JSON.parse(localStorage["localMediaGallery_.names"] || '["general"]'); if (raw && raw.length) gals = raw; } catch (e) {}
    var recsByFolder = {}, seen = {}, missing = [];
    for (var gi = 0; gi < gals.length; gi++) {
      var f = gals[gi];
      try {
        var recs = await window.dragonStoreAll(await window.dragonOpenIDB("localMediaGallery_." + f + "-db-kv-plugin"));
        recsByFolder[f] = recs || [];
        for (var j = 0; j < recsByFolder[f].length; j++) {
          var mid = recsByFolder[f][j] && recsByFolder[f][j].id;
          if (mid == null) continue;
          var k = String(mid);
          if (seen[k]) continue;
          seen[k] = 1;
          if (!(k in map)) missing.push(k);
        }
      } catch (e) {}
    }
    if (missing.length) {
      if (missing.length <= 80) {
        // few unknown ids → read only those blobs (cheap)
        for (var mi = 0; mi < missing.length; mi++) {
          try {
            var rec = await window.dragonVaultBlobGet(missing[mi]);
            var b = rec ? window.dragonToBlob(rec) : null;
            map[missing[mi]] = b ? (b.size || 0) : 0;
          } catch (e) { map[missing[mi]] = 0; }
        }
      } else {
        // many unknown (images added before this feature) → one full blobs scan, cached forever after
        try {
          var entries = await window.dragonStoreAllEntries(await window.dragonOpenIDB("localMediaGallery_.blobs-db-kv-plugin"));
          for (var ei = 0; ei < entries.length; ei++) {
            var v = entries[ei].value || {};
            var buf = v.buffer;
            var sz = 0; try { sz = buf ? (buf.byteLength || buf.size || 0) : 0; } catch (e) {}
            map[String(entries[ei].key)] = sz;
          }
        } catch (e) {}
        // orphans (metadata without a blob) must be marked too, else they'd re-trigger a scan next time
        for (var oi = 0; oi < missing.length; oi++) { if (!(missing[oi] in map)) map[missing[oi]] = 0; }
      }
      try { if (window.dragonVaultSizeFlush) window.dragonVaultSizeFlush(map); } catch (e) {}
    }
    var per = {}, perN = {}, total = 0, n = 0;
    for (var fi = 0; fi < gals.length; fi++) {
      var folder = gals[fi];
      var bytes = 0, cnt = 0;
      var rlist = recsByFolder[folder] || [];
      for (var rj = 0; rj < rlist.length; rj++) {
        var rid = rlist[rj] && rlist[rj].id;
        if (rid == null) continue;
        cnt++; bytes += (map[String(rid)] || 0);
      }
      per[folder] = bytes; perN[folder] = cnt; total += bytes; n += cnt;
    }
    _vaultSizeCache = { ready: true, total: total, n: n, per: per, perN: perN };
    dragonVaultCounterSync();
    // Egon 16.09.2026 — counts are ready: refresh the folder-menu labels + collapsed-bar clone.
    try { if (window.dragonVaultRelabelFolders) window.dragonVaultRelabelFolders(document.getElementById("localMediaGallery_root")); } catch (e) {}
    try { if (window.__dragonSyncColFolder) window.__dragonSyncColFolder(); } catch (e) {}
    return _vaultSizeCache;
  }
  ;function dragonVaultCounterSync() {
    // Egon 17.09.2026 — this toolbar element no longer prints the counts; it is now an ICON-ONLY
    // "Storage info" button (💽). The live counts are surfaced through its tooltip instead, while the
    // full breakdown lives inside the ☰ menu's "Storage info" dialog.
    var el = document.querySelector(".dragon-vault-counter");
    if (!el) return;
    var txt = "";
    try { if (window.dragonVaultStorageStatsText) txt = window.dragonVaultStorageStatsText(); } catch (e) {}
    el.title = txt ? ("Storage info\n" + txt) : "Storage info";
  }
  // Egon 17.09.2026 — the gallery size/count stats that used to be printed on the toolbar are now
  // rendered INSIDE the ☰ menu's "Storage info" dialog. Returns a ready-to-show string
  // (empty string while the async size scan has not finished yet). The per-folder line was removed
  // (Egon: the selected folder's own size/count is not needed here).
  window.dragonVaultStorageStatsText = function () {
    try {
      var s = _vaultSizeCache;
      if (!s || !s.ready) return "";
      return "\uD83D\uDDBC Total image: " + s.n + " \u00B7 \uD83D\uDCBE Total size: " + dragonFmtBytes(s.total);
    } catch (e) { return ""; }
  };
  // Egon 16.09.2026 — per-folder image counts for the folder menu / collapsed bar labels.
  window.dragonVaultFolderCountsGet = function () {
    try { return (_vaultSizeCache && _vaultSizeCache.ready && _vaultSizeCache.perN) ? _vaultSizeCache.perN : null; } catch (e) { return null; }
  };

  // Egon 14.09.2026 — 🖼 PRIVATE GALLERY TWIN TOOLBAR.
  // Egon's request: place a DEAD RINGER of the search box, 🎚️ sliders, 🚫 exclude,
  // 📐 image display mode, and ⚡ load speed menus from the public gallery toolbar into the private gallery.
  // The appearance is the same. NOTE (Egon 13.09.2026): display mode is now in a SEPARATE key (`dragonVaultDisplay`)
  // — the "Default" option for private is not in the public menu; the shared key was stealing settings from both galleries.
  ;function dragonVaultTwinCss() {
    if (document.getElementById("dragonVaultTwinCss")) return;
    var st = document.createElement("style");
    st.id = "dragonVaultTwinCss";
    st.textContent = [
      // Egon 12.09.2026 — GREY BACKGROUND ROOT CAUSE: a 2/3 ratio was being FORCED on the square (to reserve
      // space while unloaded). Non-2:3 images (square/landscape) were falling into a letterbox within the square,
      // leaving the tile's grey background (#444) at the bottom/side. Now max-height is removed and
      // once the image loads, the square's aspect-ratio is equated to the image's ACTUAL ratio (dragonVaultForceLoad)
      // → fits the square image perfectly, no grey bands remain.
      // Egon 13.09.2026 — this override is now ONLY valid in non-Default modes: in Default mode,
      // the plugin's own row geometry (`flex:0 0 ratio*300px`) should win (stock look).
      // 🖼️📐 W-LOC303 (Egon 26.09.2026) — a FIXED tile width left the row short of the right edge, and the
      // plugin's `place-content: flex-start center` then split that leftover between BOTH sides (measured
      // 52px + 52px at 2560, 80px + 80px at 3840). The width is now a share of the row instead of a constant
      // (the same count --dragon-vault-cols drives the columns), so a full row always ends flush right, the
      // tiles stay uniform and only the LAST row keeps the normal ragged edge. The −0.5px guards against
      // sub-pixel rounding pushing a tile onto a line of its own.
      "#localMediaGallery_root:not(.dragon-vault-dm-default) [data-local-media-gallery-item]{flex:0 0 calc((100% - (var(--dragon-vault-cols,4) - 1) * 4px) / var(--dragon-vault-cols,4) - 0.5px) !important;}",
      // Egon 16.09.2026 — DEFAULT mode "stacked / brick-wall" ROOT FIX: the stock plugin geometry gives
      // every tile a width of (image ratio × 300px) and centers each row independently, so rows start at
      // DIFFERENT x positions and tile widths differ → the "staggered" look. Default is
      // now a UNIFORM, FLUSH-LEFT grid: fixed tile width (zoom slider) + a 2/3 portrait box + cover crop.
      // 🖼️ Egon 23.09.2026 — DEFAULT is now the SAME mode as the public gallery's "Default": the stock look
      // of equal-height rows at each picture's OWN width (ragged right edge). It used to be a uniform 2:3
      // crop grid invented for the private gallery, which is why the two panels' "Default" rows meant two
      // different things. Justified and Default now share one packer; only the row filling differs.
      "#localMediaGallery_root.dragon-vault-dm-default{overflow-y:auto !important; overflow-x:hidden !important;}",
      "#localMediaGallery_root.dragon-vault-dm-default .dragon-vault-grid, #localMediaGallery_root.dragon-vault-dm-default .dragon-vault-inplace{display:flex !important; flex-wrap:wrap !important; gap:6px !important; align-content:flex-start !important; align-items:flex-start !important; justify-content:flex-start !important; flex:0 0 auto !important; height:auto !important; max-height:none !important; overflow:visible !important;}",
      "#localMediaGallery_root.dragon-vault-dm-default [data-local-media-gallery-item]{display:block !important; min-width:0 !important; max-height:none !important;}",
      // Egon 12.09.2026 — PRIVATE GALLERY GREY BACKGROUND: align-items was not set in the flex grid →
      // SHORT squares in the flex-wrap row were being STRETCHED to the LONGEST square in the row,
      // leaving the tile's grey background (#444) at the bottom. align-items:flex-start fixes this (the private/flex
      // equivalent of the grid align-items:start fix in the public gallery).
      "#localMediaGallery_root .dragon-vault-grid, #localMediaGallery_root .dragon-vault-inplace{align-items:flex-start !important;}",
      // 🧱 Egon 14.09.2026 — HUGE IMAGE ROOT FIX: plugin grid is established with inline `display:flex`; our
      // restore code writes `display=""` which DELETES this line and the grid drops to block (each square full
      // width + max-height:300px clipping = "huge, only the top is visible"). Ensure flex in non-masonry modes
      // (block wins because the masonry rule comes later and further down).
      "#localMediaGallery_root:not(.dragon-vault-dm-masonry) .dragon-vault-grid{display:flex !important;}",
      // 🖼️📐 W-LOC303 (Egon 26.09.2026) — the plugin centres each row (`place-content: flex-start center`),
      // which is what turned a short row into a gap on the LEFT as well as the right. The square-tile modes
      // now start at the left edge like every other mode; an incomplete LAST row keeps the normal ragged edge
      // (the wall modes are display:block and the masonry mode is multi-column, so neither is touched here).
      "#localMediaGallery_root.dragon-vault-dm-cover .dragon-vault-grid, #localMediaGallery_root.dragon-vault-dm-contain .dragon-vault-grid, #localMediaGallery_root.dragon-vault-dm-original .dragon-vault-grid, #localMediaGallery_root.dragon-vault-dm-stretch .dragon-vault-grid{justify-content:flex-start !important; gap:6px !important;}",
      "#localMediaGallery_root.dragon-vault-dm-cover [data-local-media-gallery-item], #localMediaGallery_root.dragon-vault-dm-contain [data-local-media-gallery-item], #localMediaGallery_root.dragon-vault-dm-original [data-local-media-gallery-item], #localMediaGallery_root.dragon-vault-dm-stretch [data-local-media-gallery-item]{flex:0 0 calc((100% - (var(--dragon-vault-cols,4) - 1) * 6px) / var(--dragon-vault-cols,4) - 0.5px) !important; box-sizing:border-box !important; border-radius:8px !important; overflow:hidden !important; border:1px solid var(--dt-border,#4a4a58) !important; background:#1b1b21 !important;}",
      // Egon 13.09.2026 — REMAINING ~4px GREY BAND (actual root cause): since <img> is inline, baseline/descender
      // space remains in the line box, the grey background (#444) of the tile was visible by 4px at the bottom.
      // display:block + vertical-align:top removes this space completely (not letterbox — not related to
      // object-fit; in every tile, tile−image = 4px).
      "#localMediaGallery_root [data-local-media-gallery-item] > img, #localMediaGallery_root [data-local-media-gallery-item] > video{display:block !important; vertical-align:top !important;}",
      "#localMediaGallery_root [data-local-media-gallery-item]{position:relative;}",
      "#localMediaGallery_root.dragon-vault-dm-cover [data-local-media-gallery-item] img{object-fit:cover !important;}",
      "#localMediaGallery_root.dragon-vault-dm-contain [data-local-media-gallery-item] img{object-fit:contain !important; background:#000;}",
      "#localMediaGallery_root.dragon-vault-dm-original [data-local-media-gallery-item]{max-height:none !important;}",
      "#localMediaGallery_root.dragon-vault-dm-original [data-local-media-gallery-item] img{object-fit:contain !important; height:auto !important;}",
      // Egon 13.09.2026 — MASONRY SCROLL FIX: plugin grid is a flex scroller with FIXED height
      // (flex:1 1 0% + overflow:auto). CSS multicol pushes excess content to the RIGHT at fixed height
      // (scrollWidth ~80,000px) → only ~1 screen worth of squares were visible ("only 20
      // images"). In Masonry, we give vertical scrolling to the ROOT and leave the grid height to the content
      // → columns flow downwards, all squares become visible. Header (toolbar) remains sticky.
      "#localMediaGallery_root.dragon-vault-dm-masonry{overflow-y:auto !important; overflow-x:hidden !important;}",
      "#localMediaGallery_root.dragon-vault-dm-masonry > div:first-child{position:sticky; top:0; z-index:30; background:#15151b;}",
      // Egon 13.09.2026 — MASONRY SPACING FIX (Egon: "in private masonry there is x distance from side, xx
      // from bottom; in public masonry it is equal in all directions"). MEASUREMENT: horizontal 4px (the
      // plugin's own inline `gap:4px` was overriding our `column-gap:6px`) · vertical 10px (the square's
      // 6px margin + the `display:inline-block` line box's ~4px descender gap). FIX: `column-gap:6px !important`
      // (same as public masonry) + squares `display:block` (inline-block strut gap is completely removed) →
      // 6px ÷ 6px, EQUAL IN ALL DIRECTIONS.
      "#localMediaGallery_root.dragon-vault-dm-masonry .dragon-vault-grid{display:block !important; columns:var(--dragon-vault-cols,4); column-gap:6px !important; flex:0 0 auto !important; height:auto !important; max-height:none !important; overflow:visible !important;}",
      "#localMediaGallery_root.dragon-vault-dm-masonry [data-local-media-gallery-item]{break-inside:avoid; display:block !important; width:100% !important; max-width:100% !important; margin:0 0 6px; max-height:none !important; height:auto !important;}",
      "#localMediaGallery_root.dragon-vault-dm-masonry [data-local-media-gallery-item] img{object-fit:contain !important; height:auto !important;}",
      // 🖼📐 Egon 22.09.2026 — STRETCH + JUSTIFIED, the two public-gallery modes that were missing from the
      // private display menu (the two menus are twins again). Stretch = the picture fills the square edge
      // to edge even if it distorts; Justified = equal-height full-width rows packed by each picture's own
      // ratio (the tile slider becomes the ROW height, exactly like the public side).
      "#localMediaGallery_root.dragon-vault-dm-stretch [data-local-media-gallery-item] img, #localMediaGallery_root.dragon-vault-dm-stretch [data-local-media-gallery-item] video{object-fit:fill !important;}",
      "#localMediaGallery_root.dragon-vault-dm-justified{overflow-y:auto !important; overflow-x:hidden !important;}",
      "#localMediaGallery_root.dragon-vault-dm-justified .dragon-vault-grid, #localMediaGallery_root.dragon-vault-dm-justified .dragon-vault-inplace{display:flex !important; flex-wrap:wrap !important; gap:6px !important; align-content:flex-start !important; align-items:flex-start !important; justify-content:flex-start !important; flex:0 0 auto !important; height:auto !important; max-height:none !important; overflow:visible !important;}",
      "#localMediaGallery_root.dragon-vault-dm-justified [data-local-media-gallery-item]{display:block !important; min-width:0 !important; max-height:none !important;}",
      "#localMediaGallery_root.dragon-vault-dm-justified [data-local-media-gallery-item] img, #localMediaGallery_root.dragon-vault-dm-justified [data-local-media-gallery-item] video{object-fit:cover !important; width:100% !important; height:100% !important;}",
      // 🖼️ Egon 23.09.2026 — in the Default row mode a tile's width is exactly (ratio × rowHeight), so a
      // `cover` fill crops NOTHING; it is only here to neutralise the loader's own inline fit.
      "#localMediaGallery_root.dragon-vault-dm-default [data-local-media-gallery-item] img, #localMediaGallery_root.dragon-vault-dm-default [data-local-media-gallery-item] video{object-fit:cover !important; width:100% !important; height:100% !important;}",
      // 🧩 Egon 23.09.2026 — THE FOUR WALL MODES in the private gallery (Pinterest · Puzzle · Mosaic ·
      // Mixed). Identical promise to the public gallery, and identical division of labour: the
      // shared engine (src/dragon-layouts.js) computes ABSOLUTE rectangles, so these rules only turn the
      // grid into a positioning context and neutralise the square-tile box. Vertical scrolling moves to the
      // ROOT (exactly like the masonry fix), the toolbar stays sticky, and the geometry itself is never
      // decided here — it is written per tile in JS.
      "#localMediaGallery_root.dragon-vault-dm-pinterest, #localMediaGallery_root.dragon-vault-dm-puzzle, #localMediaGallery_root.dragon-vault-dm-mosaic, #localMediaGallery_root.dragon-vault-dm-mixed{overflow-y:auto !important; overflow-x:hidden !important;}",
      "#localMediaGallery_root.dragon-vault-dm-pinterest > div:first-child, #localMediaGallery_root.dragon-vault-dm-puzzle > div:first-child, #localMediaGallery_root.dragon-vault-dm-mosaic > div:first-child, #localMediaGallery_root.dragon-vault-dm-mixed > div:first-child{position:sticky; top:0; z-index:30; background:#15151b;}",
      "#localMediaGallery_root.dragon-vault-dm-pinterest .dragon-vault-grid, #localMediaGallery_root.dragon-vault-dm-puzzle .dragon-vault-grid, #localMediaGallery_root.dragon-vault-dm-mosaic .dragon-vault-grid, #localMediaGallery_root.dragon-vault-dm-mixed .dragon-vault-grid, #localMediaGallery_root.dragon-vault-dm-pinterest .dragon-vault-inplace, #localMediaGallery_root.dragon-vault-dm-puzzle .dragon-vault-inplace, #localMediaGallery_root.dragon-vault-dm-mosaic .dragon-vault-inplace, #localMediaGallery_root.dragon-vault-dm-mixed .dragon-vault-inplace{display:block !important; position:relative !important; flex:0 0 auto !important; height:auto !important; max-height:none !important; overflow:visible !important;}",
      "#localMediaGallery_root.dragon-vault-dm-pinterest [data-local-media-gallery-item], #localMediaGallery_root.dragon-vault-dm-puzzle [data-local-media-gallery-item], #localMediaGallery_root.dragon-vault-dm-mosaic [data-local-media-gallery-item], #localMediaGallery_root.dragon-vault-dm-mixed [data-local-media-gallery-item]{position:absolute !important; display:block; margin:0 !important; max-width:none !important; max-height:none !important;}",
      // 🧬 A tile collapsed by the dedupe MUST stay collapsed: `display:block` above is NOT `!important`
      // on purpose, but the collapse is re-stated explicitly so no other rule can ever resurrect a
      // duplicate (measured: with a forced `display:block !important` the 175 collapsed tiles came back
      // as 512×512 blocks piling up on top of the wall).
      "#localMediaGallery_root.dragon-vault-dm-pinterest [data-local-media-gallery-item].dragon-dupe-hidden, #localMediaGallery_root.dragon-vault-dm-puzzle [data-local-media-gallery-item].dragon-dupe-hidden, #localMediaGallery_root.dragon-vault-dm-mosaic [data-local-media-gallery-item].dragon-dupe-hidden, #localMediaGallery_root.dragon-vault-dm-mixed [data-local-media-gallery-item].dragon-dupe-hidden{display:none !important;}",
      "#localMediaGallery_root.dragon-vault-dm-pinterest [data-local-media-gallery-item] img, #localMediaGallery_root.dragon-vault-dm-puzzle [data-local-media-gallery-item] img, #localMediaGallery_root.dragon-vault-dm-mosaic [data-local-media-gallery-item] img, #localMediaGallery_root.dragon-vault-dm-mixed [data-local-media-gallery-item] img, #localMediaGallery_root.dragon-vault-dm-pinterest [data-local-media-gallery-item] video, #localMediaGallery_root.dragon-vault-dm-puzzle [data-local-media-gallery-item] video, #localMediaGallery_root.dragon-vault-dm-mosaic [data-local-media-gallery-item] video, #localMediaGallery_root.dragon-vault-dm-mixed [data-local-media-gallery-item] video{object-fit:cover !important; width:100% !important; height:100% !important;}",
      "#localMediaGallery_root .dragon-vault-twin input[type=range]{width:110px; accent-color:#9b6bff; vertical-align:middle;}",
      // 🔢 Egon 14.09.2026 — private gallery "#N" badge: located at the FAR LEFT of the button row
      // BELOW the square. Color `--dragon-gal-num-c` (Settings → Gallery Image Numbers) → SYNCED with public.
      // Egon 15.09.2026 — the badge is no longer INSIDE the button row, but on the SQUARE (tile) itself:
      // it sits FLUSH against the bottom-left corner of the image (previously it was 6px inside + disappeared on hover).
      // Egon 15.09.2026 — SIZE PARITY: private "#N" badge looked smaller than public
      // (.64rem vs public .72rem). Now EXACTLY the same as public: font .72rem, line-height 1.4,
      // padding .1rem .38rem, radius 0 7px 0 0, opacity .85, default color #7cc4ff.
      "#localMediaGallery_root .dragon-vault-tile-num{position:absolute; left:0 !important; bottom:0 !important; top:auto !important; transform:none !important; z-index:7; font-size:.72rem; font-weight:700; line-height:1.4; padding:.1rem .38rem; border-radius:0 7px 0 0; background:rgba(10,10,14,.85); color:var(--dragon-gal-num-c,#7cc4ff); border:1px solid var(--dragon-gal-num-c,#7cc4ff); border-left:0; border-bottom:0; pointer-events:none; white-space:nowrap;}",
      // 📱 Egon 14.09.2026 — square buttons are slightly shrunk so the "#N" badge can sit at the FAR LEFT of the row
      // WITHOUT CLASHING with buttons (badge left:0; buttons stay centered). Shrinks further on mobile.
      // Egon 15.09.2026 — since the badge is now OUTSIDE the row (in the corner of the square), buttons
      // returned to normal size; only the badge text remained small.
      "#localMediaGallery_root .dragon-vault-tile-num{font-size:.72rem !important; padding:.1rem .38rem !important;}",
      "@media(max-width:640px){ #localMediaGallery_root [data-local-media-gallery-bar] > button{width:26px !important; min-width:26px !important; height:20px !important; font-size:.78rem !important;} }",
      // 📱 Egon 14.09.2026 — private gallery toolbar MOBILE compression (more compact & minimal):
      // spacing tightened, button text shrunk, twin toolbar stays on a single line.
      "@media(max-width:640px){ .dragon-vault-header-bar{gap:3px !important; padding:2px 3px !important;} .dragon-vault-header-bar button{font-size:.62rem !important; height:22px !important; padding:0 .28rem !important; max-width:9.5rem !important;} .dragon-vault-header-bar select{font-size:.6rem !important;} .dragon-vault-header-bar .dragon-vault-twin{gap:2px !important; flex-wrap:nowrap !important;} .dragon-vault-header-bar .dragon-vault-twin > button, .dragon-vault-header-bar .dragon-vault-twin > span > button{height:20px !important; font-size:.66rem !important; padding:0 .18rem !important;} .dragon-vault-header-bar .dragon-vault-counter{font-size:.78rem !important; width:22px !important; min-width:22px !important; height:22px !important; padding:0 !important;} }",
      "@media(max-width:640px){ #localMediaGallery_root .dragon-vault-twin.dragon-vault-twin-collapsed > *:not(.dragon-vault-twin-toggle){display:none !important;} }"
      ,
      // 🅾️ Egon 15.09.2026 — PRIVATE gallery "Image Display Mode" menu is now synchronized with PUBLIC gallery menus
      // SAME modern card view (identical to dragonMenuStandardCss; since the public menu was inside `.dragon-gal-panel`,
      // those rules didn't apply here → for private, the same rules were written within the `#localMediaGallery_root`
      // scope). The `dragon-menu-card dragon-menu-scroll` class is added to the menu; active row
      // `dragon-menu-on` (amber + bold).
      "#localMediaGallery_root .dragon-menu-card{background:#16161d !important;border:1px solid #5a5a7a !important;border-radius:9px !important;box-shadow:0 12px 34px rgba(0,0,0,.75) !important;padding:0 !important;gap:0 !important;overflow:hidden !important;}",
      "#localMediaGallery_root .dragon-menu-card.dragon-menu-scroll{overflow:auto !important;}",
      "#localMediaGallery_root .dragon-menu-card > button{display:flex !important;align-items:center !important;justify-content:flex-start !important;gap:.4rem !important;width:100% !important;box-sizing:border-box !important;text-align:left !important;padding:.45rem .7rem !important;font-size:.8rem !important;line-height:1.25 !important;height:auto !important;min-height:0 !important;border:0 !important;border-bottom:1px solid #23232d !important;border-radius:0 !important;background:transparent !important;color:#eee !important;cursor:pointer !important;white-space:normal !important;}",
      "#localMediaGallery_root .dragon-menu-card > button:hover{background:#2b2b3a !important;}",
      "#localMediaGallery_root .dragon-menu-card .dragon-menu-on.dragon-menu-on{background:#2a2a3a !important;color:#ffd76a !important;font-weight:bold !important;}",
      "#localMediaGallery_root .dragon-menu-card > button.dragon-menu-hide{display:none !important;}"
    ].join("\n");
    document.head.appendChild(st);
  }
  // Prompt index (id → lowercase prompt): for search/exclude, lazy + cached.
  ;function dragonVaultIndexPrompts(root) {
    window.__dragonVaultPromptIdx = window.__dragonVaultPromptIdx || {};
    try {
      if (!window.__dragonVaultPromptIdx.__loaded) {
        var cached = JSON.parse(localStorage.dragonVaultPromptIdx || "{}");
        for (var k in cached) if (window.__dragonVaultPromptIdx[k] === undefined) window.__dragonVaultPromptIdx[k] = cached[k];
        window.__dragonVaultPromptIdx.__loaded = true;
      }
    } catch (e) {}
    if (root.__dragonIdxBusy) return;
    var tiles = root.querySelectorAll("[data-local-media-gallery-item]");
    if (!tiles.length) {
      // Squares are not rendered yet → retry after a short while (max ~24 sec).
      if ((root.__dragonIdxRetry || 0) < 80) {
        root.__dragonIdxRetry = (root.__dragonIdxRetry || 0) + 1;
        setTimeout(function () { dragonVaultIndexPrompts(root); }, 300);
      }
      return;
    }
    root.__dragonIdxRetry = 0;
    root.__dragonIdxBusy = true;
    var i = 0, added = false;
    ;function step() {
      var end = Math.min(i + 25, tiles.length);
      var ps = [];
      for (; i < end; i++) {
        (function (tl) {
          var id = tl.getAttribute("data-id");
          if (!id || window.__dragonVaultPromptIdx[id] !== undefined) return;
          ps.push(window.dragonVaultBlobGet(id).then(function (b) {
            var info = b && b.info;
            if (typeof info === "string") { try { info = JSON.parse(info); } catch (e) {} }
            window.__dragonVaultPromptIdx[id] = (info && info.prompt) ? String(info.prompt).toLowerCase() : "";
            added = true;
          }).catch(function () {}));
        })(tiles[i]);
      }
      Promise.all(ps).then(function () {
        if (i < tiles.length) { setTimeout(step, 60); return; }
        root.__dragonIdxBusy = false;
        if (added) { try { localStorage.dragonVaultPromptIdx = JSON.stringify(window.__dragonVaultPromptIdx); } catch (e) {} try { applyVaultFilter(); } catch (e) {} }
      });
    }
    step();
  }
  window.dragonVaultIndexPrompts = dragonVaultIndexPrompts;
  ;function dragonVaultTwinToolbar(root, header, closeBtn) {
    if (!root || root.__dragonTwinInstalled) return;
    root.__dragonTwinInstalled = true;
    dragonVaultTwinCss();
    var grid = (typeof dragonPluginGrid === "function") ? dragonPluginGrid(root) : null;
    if (grid) grid.classList.add("dragon-vault-grid");
    // Egon 13.09.2026 — clicking a private gallery image used to open the PLUGIN's simple viewer
    // (black background + ⬅️➡️✖️); our standard lightbox (dragonZoomLightbox:
    // prompt info, favorite, zoom/gear, swipe) should open. ROOT CAUSE: since the plugin pushed its own `<img>`
    // with `onclick:()=>lightbox(id)`, our img.onclick was never bound
    // (dragonVaultForceLoad returns early when it finds ready media in the square). FIX: in the capture phase
    // DELEGATION — clicking the img/video inside the square is caught BEFORE reaching the plugin's handler.
    if (grid) {
      // 🐉 System B (Egon 16.09.2026) — twin of the public gallery: a SINGLE click opens our standard
      // lightbox (held back for a short beat so a fast second click can be caught), a DOUBLE click
      // toggles the favorite (moves the image in/out of the Favorites folder).
      grid.__dragonLbHook = true;
      try { window.dragonInstallTileDblHook(grid); } catch (e) {}
    }
    // initial values (same keys as public gallery)
    // Egon 13.09.2026 — private gallery display list: DEFAULT at the beginning (stock plugin view).
    // Values are kept in the `dragonVaultDisplay` key, INDEPENDENT of the public gallery (public `dragonGalDisplay`).
    var DISP = window.dragonDisplayModeIds();
    // (DISP_IC — the per-mode icon table — was never rendered by the menu; removed 23.09.2026.)
    var disp = window.dragonDisplaySharedGet ? window.dragonDisplaySharedGet() : window.dragonDisplayDefault;
    if (!window.dragonDisplayIsMode(disp)) disp = window.dragonDisplayDefault;
    ;function applyDisp() {
      DISP.forEach(function (m) { root.classList.toggle("dragon-vault-dm-" + m, m === disp); });
      try { localStorage.setItem("dragonVaultDisplay", disp); } catch (e) {}
      // Egon 13.09.2026 — instantly rescale squares when the mode changes (Crop/Fit → 1/1,
      // Original/Masonry → actual ratio). Otherwise, squares remain at the old ratio and the mode seems ineffective.
      if (typeof window.dragonVaultRefitAll === "function") { try { window.dragonVaultRefitAll(); } catch (e) {} }
      if (typeof syncDispBtn === "function") syncDispBtn();
    }
    // 🖼️ ONE shared selection (W-UI172): a pick here moves the public gallery too, and the two legacy keys
    // are written together by the shared store.
    ;function setDisp(m) {
      if (!window.dragonDisplayIsMode(m)) m = window.dragonDisplayDefault;
      disp = m;
      applyDisp();
      try { if (window.dragonDisplaySharedSetAndEmit) window.dragonDisplaySharedSetAndEmit(m); } catch (e) {}
    }
    try {
      if (window.dragonDisplaySubscribe) window.dragonDisplaySubscribe(function (v) {
        if (window.dragonDisplayIsMode && window.dragonDisplayIsMode(v) && v !== disp) { disp = v; applyDisp(); }
      });
    } catch (e) {}
    var wrap = document.createElement("span");
    wrap.className = "dragon-vault-twin";
    wrap.style.cssText = "display:inline-flex; align-items:center; gap:4px; flex-wrap:wrap;";
    ;function mkVB(txt, title, color, fn) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = txt; b.title = title;
      b.style.cssText = "width:22px; height:22px; padding:0; box-sizing:border-box; border:1px solid " + color + "; background:linear-gradient(180deg,#1c1c24,#0e0e13); color:" + color + "; border-radius:7px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; font-size:.78rem; flex:0 0 auto;";
      b.onclick = function (e) { e.stopPropagation(); fn(e); };
      return b;
    }
    // 🔍 search — SAME as public gallery: small 22px button; opens the search bar when clicked.
    // 🔍 Egon 16.09.2026 — PROMISE: this button opens the FLOATING search bar + fullscreen results
    // window (the same one the public gallery uses). The old inline search row — which pushed the
    // toolbar around when it opened — is retired (parked in src/Librarybook.enc).
    var searchBtn = mkVB("\uD83D\uDD0D", "Search Prompts + Tags", "#7db8ff", function () {
      if (window.dragonSearchToggle) window.dragonSearchToggle("private");
      else if (window.dragonSearchOpen) window.dragonSearchOpen("private");
    });
    searchBtn.style.borderRadius = "8px";
    searchBtn.style.fontSize = ".85rem";
    searchBtn.style.borderColor = "#4d8dff";
    searchBtn.style.background = "linear-gradient(180deg,#0d1f3a,#0a1220)";
    searchBtn.style.color = "#7db8ff";
    // exempt from the search's outside-close so the magnifier can toggle it closed (Egon 16.09.2026)
    searchBtn.classList.add("dragon-search-toggle-btn");
    // ⚡ Egon 13.09.2026 — the button gets an ACTIVE (green) state while a remembered/active search
    // filter is applied, so a restored filter is obvious even with the search row collapsed.
    ;function syncSearchActive() {
      var on = !!(vaultState.search && vaultState.search.trim());
      searchBtn.style.borderColor = on ? "#3ddc84" : "#4d8dff";
      searchBtn.style.color = on ? "#b9ffd8" : "#7db8ff";
      searchBtn.style.background = on ? "linear-gradient(180deg,#0e2a1c,#08150f)" : "linear-gradient(180deg,#0d1f3a,#0a1220)";
      searchBtn.title = on ? ("Search Prompts + Tags \u2014 active: " + vaultState.search) : "Search Prompts + Tags";
    }
    // 🔍 Egon 16.09.2026 — the inline search row (searchRow / searchIn) is RETIRED; the 🔍 button now opens
    // the FLOATING search bar (window.dragonSearchOpen("private")). Code parked in src/Librarybook.enc.
    // 📐 display mode — the SHARED control (src/dragon-display.js): exactly the same 22px button, the same
    // 7 rows and the same order as the public gallery, built by ONE piece of code for both panels (rule
    // "the rule of water in large glasses"). The retired hand-built copy (its own 7 rows, its own syncDispBtn,
    // its own open/close wiring) is parked in src/Librarybook.enc → "PRIVATE GALLERY HAND-BUILT DISPLAY MENU".
    var displayCtl = window.dragonDisplayBuild({
      getMode: function () { return disp; },
      onPick: function (m) { setDisp(m); },
      zIndex: 2147483647
    });
    var dispWrap = displayCtl.wrap;
    var dispBtn = displayCtl.btn;
    var dispMenu = displayCtl.menu;
    ;function syncDispBtn() { try { displayCtl.sync(); } catch (e) {} }
    // Registered like every other toolbar dropdown (placement rule I88 + the other menus close on open).
    try { if (window.dragonRegisterDropdown) window.dragonRegisterDropdown(dispMenu, displayCtl.close); } catch (e) {}
    // 🚫 exclude
    var exWrap = document.createElement("span");
    exWrap.style.cssText = "position:relative; display:inline-flex;";
    var exBtn = mkVB("\uD83D\uDEAB", "Exclude terms \u2014 hide images whose prompt contains them", "#c9a3ff", function () {
      exPop.style.display = (exPop.style.display === "none" || exPop.style.display === "") ? "flex" : "none";
    });
    // SAME look as public gallery exclude button (purple, 22px)
    exBtn.style.borderColor = "#8b5cf6";
    exBtn.style.color = "#c9a3ff";
    exBtn.style.borderRadius = "6px";
    exBtn.style.fontSize = ".85rem";
    var exPop = document.createElement("div");
    exPop.style.cssText = "position:absolute; top:100%; left:50%; transform:translateX(-50%); margin-top:2px; z-index:2147483647; display:none; flex-direction:column; gap:4px; background:#10131a; border:1px solid #8b5cf6; border-radius:6px; padding:5px; min-width:12rem; max-height:70vh; overflow:auto; box-shadow:0 6px 18px rgba(0,0,0,.55);";
    var exIn = document.createElement("input");
    exIn.type = "text"; exIn.placeholder = "term + Enter";
    exIn.style.cssText = "width:100%; box-sizing:border-box; padding:.25rem .4rem; font-size:.74rem; border:1px solid #6a6a78; border-radius:6px; background:#0e0e13; color:#eee;";
    var exList = document.createElement("div");
    exList.style.cssText = "display:flex; flex-wrap:wrap; gap:4px; margin-top:5px;";
    ;function renderEx() {
      exList.innerHTML = "";
      (vaultState.exclude || []).forEach(function (t) {
        var chip = document.createElement("button");
        chip.type = "button"; chip.textContent = t + " \u2716";
        chip.style.cssText = "font-size:.68rem; padding:.12rem .4rem; border:1px solid #ff6a76; background:rgba(255,106,118,.14); color:#ffb3b9; border-radius:12px; cursor:pointer;";
        chip.onclick = function () { vaultState.exclude = (vaultState.exclude || []).filter(function (x) { return x !== t; }); renderEx(); applyVaultFilter(); };
        exList.appendChild(chip);
      });
      if (!(vaultState.exclude || []).length) { var n = document.createElement("span"); n.textContent = "no exclusions"; n.style.cssText = "font-size:.68rem; color:#8a8a9a;"; exList.appendChild(n); }
    }
    exIn.onkeydown = function (e) {
      if (e.key === "Enter" && exIn.value.trim()) {
        vaultState.exclude = vaultState.exclude || [];
        var v = exIn.value.trim().toLowerCase();
        if (vaultState.exclude.indexOf(v) === -1) vaultState.exclude.push(v);
        exIn.value = ""; renderEx(); applyVaultFilter();
      }
    };
    exPop.append(exIn, exList);
    exWrap.append(exBtn, exPop);
    document.addEventListener("click", function (e) { if (exPop.style.display === "block" && !exWrap.contains(e.target)) exPop.style.display = "none"; });
    // 🎚️ sliders (tile size)
    var slWrap = document.createElement("span");
    slWrap.style.cssText = "position:relative; display:inline-flex;";
    var slBtn = mkVB("\uD83C\uDF9A", "Sliders \u2014 Zoom, Tile Size & UI Scale", "#ffd76a", function () {
      var opening = (slPop.style.display === "none" || slPop.style.display === "");
      slPop.style.display = opening ? "flex" : "none";
      if (window.dragonUiScaleHold) window.dragonUiScaleHold("private-sliders", opening);
      if (opening && window.dragonClampPopover) window.dragonClampPopover(slPop, slWrap);
    });
    // SAME look as public gallery sliders button
    slBtn.style.borderColor = "#e0b24d";
    slBtn.style.color = "#ffd76a";
    slBtn.style.borderRadius = "8px";
    slBtn.style.fontSize = ".85rem";
    var slPop = document.createElement("div");
    // Egon 16.09.2026 — EXACT twin of the public gallery's Sliders panel (same class, border, padding, gap).
    slPop.className = "dragon-slider-panel";
    slPop.style.cssText = "position:absolute; top:100%; left:50%; transform:translateX(-50%); margin-top:2px; z-index:2147483647; display:none; flex-direction:column; gap:.3rem; background:#10131a; border:1px solid #5a5a6a; border-radius:6px; padding:.4rem .55rem; box-shadow:0 6px 18px rgba(0,0,0,.55); width:max-content; min-width:230px; max-width:min(96vw,360px); box-sizing:border-box;";
    // 🔍 ZOOM ROW — EXACT twin of the public gallery's Zoom row (same shared factory). The public
    // zoom scales its grid via transform; the private gallery is a scroll container, so the twin
    // applies the equivalent CSS `zoom` to the grid (grows the tiles and re-flows the columns).
    var vGridZoom = 100;
    try { if (window.dragonZoomSharedGet) vGridZoom = window.dragonZoomSharedGet(); } catch (e) {}
    ;function vaultGridEl() {
      try { return root.querySelector(".dragon-vault-grid") || ((typeof dragonPluginGrid === "function") ? dragonPluginGrid(root) : null); } catch (e) { return null; }
    }
    var zrP = document.createElement("input");
    zrP.type = "range"; zrP.min = "50"; zrP.max = "200"; zrP.step = "5";
    zrP.value = String(vGridZoom);
    zrP.title = "Zoom Private Gallery 50\u2013200%";
    zrP.style.cssText = "width:5.5rem; accent-color:#9b6bff; cursor:pointer;";
    var zrPReset = window.dragonSliderResetBtn("Back To Auto Zoom (100%)", function () {
      zrP.value = "100"; applyGridZoom();
      try { if (window.dragonZoomAuto) window.dragonZoomAuto(); } catch (e) {}
    });
    var zRowP = window.dragonSliderRow({
      label: "",
      control: zrP,
      buttons: [zrPReset],
      infoTitle: "Zoom Info",
      info: "\uD83D\uDD0D Zoom: scales the whole private gallery 50\u2013200%. Default 100%. Lower = see more tiles, higher = zoom into details."
    });
    ;function vaultZoomAutoOn() { try { return window.dragonZoomSharedMode ? window.dragonZoomSharedMode() !== "manual" : true; } catch (e) { return true; } }
    ;function zSyncP() { try { if (window.dragonAutoBadge) window.dragonAutoBadge(zRowP.label, "\uD83D\uDD0D " + Number(zrP.value) + "% Zoom", vaultZoomAutoOn()); else zRowP.label.textContent = "\uD83D\uDD0D " + Number(zrP.value) + "% Zoom"; } catch (e) {} }
    ;function applyGridZoom(tries) {
      vGridZoom = Number(zrP.value) || 100;
      var g = vaultGridEl();
      if (g) { try { g.style.zoom = String(vGridZoom / 100); } catch (e) {} }
      else if ((tries || 0) < 12) { setTimeout(function () { applyGridZoom((tries || 0) + 1); }, 400); }
      try { localStorage.setItem("dragonVaultGridZoom", String(vGridZoom)); } catch (e) {}
      zSyncP();
    }
    window.dragonVaultGridZoomApply = applyGridZoom;
    zrP.oninput = function () { applyGridZoom(); try { if (window.dragonZoomSharedSet) window.dragonZoomSharedSet(Number(zrP.value)); } catch (e) {} };
    if (window.dragonZoomSubscribe) window.dragonZoomSubscribe("private", function (v) {
      try { if (!root || !root.isConnected) return; } catch (e) { return; }
      try { zrP.value = String(v); applyGridZoom(); } catch (e) {}
    });
    zSyncP();
    // ▦ TILE SIZE ROW — twin of the public Tile row (label + slider + ↺ reset + ℹ️ info). The VALUE
    // RANGE stays 100-440 because the private gallery needs denser tiles than the public one.
    var sl = document.createElement("input");
    sl.type = "range"; sl.min = "100"; sl.max = "800"; sl.step = "10";
    var _tz = 200;
    try {
      if (window.dragonTileSharedMode && window.dragonTileSharedMode() === "manual" && window.dragonTileSharedPx) _tz = window.dragonTileSharedPx();
      else if (window.dragonTileSharedAutoPx) _tz = window.dragonTileSharedAutoPx(root.clientWidth || window.innerWidth || 1200);
    } catch (e) {}
    sl.value = _tz;
    sl.title = "Tile Size (px)";
    sl.style.cssText = "width:5.5rem; accent-color:#9b6bff; cursor:pointer;";
    var slResetP = window.dragonSliderResetBtn("Back To Auto Tile Size", function () {
      try { if (window.dragonTileAuto) window.dragonTileAuto(); } catch (e) {}
      try { if (window.dragonTileSharedAutoPx) sl.value = String(window.dragonTileSharedAutoPx(root.clientWidth || window.innerWidth || 1200)); } catch (e) {}
      applyZoom();
    });
    var tRowP = window.dragonSliderRow({
      label: "",
      control: sl,
      buttons: [slResetP],
      infoTitle: "Tile Size Info",
      info: "\u25A6 Tile: private gallery tile width in pixels (100\u2013800). AUTO sizes it to your screen \u2014 drag the slider for manual, \u21BA for auto."
    });
    ;function vaultColsFor(v) {
      var w = 0;
      try { w = root.clientWidth || 0; } catch (e) {}
      if (!(w > 60)) w = window.innerWidth || 1200;
      return Math.max(2, Math.round(w / (v + 8)));
    }
    // 🔁 W-LOC303 (Egon 26.09.2026) — the tile width is now a SHARE of the row, so the column count must
    // follow the window: a count left over from another width packed slivers (12 columns on a phone). One
    // source of truth — the saved zoom value — read fresh on every resize and every open.
    if (!window.__dragonVaultColsApply) {
      window.__dragonVaultColsApply = function () {
        try {
          var rt = document.getElementById("localMediaGallery_root");
          if (!rt) return;
          var w = rt.clientWidth || 0;
          if (!(w > 60)) w = window.innerWidth || 1200;
          var v = 200;
          try { v = window.dragonTileVaultH ? window.dragonTileVaultH(w) : 200; } catch (e) {}
          rt.style.setProperty("--dragon-vault-cols", Math.max(2, Math.round(w / (v + 8))));
          try { if (window.__dragonVaultTileRefresh) window.__dragonVaultTileRefresh(); } catch (e) {}
        } catch (e) {}
      };
      window.addEventListener("resize", function () { try { window.__dragonVaultColsApply(); } catch (e) {} });
      // 🛡 A resize event is not guaranteed (an embedded frame can be resized by the page around it without
      // one), so the width is also re-checked on the shared tick — a plain getBoundingClientRect poll, the
      // same guard style used elsewhere for layouts that must not depend on an observer.
      var _vaultW = 0;
      if (window.dragonTick) window.dragonTick(function () {
        try {
          var rt = document.getElementById("localMediaGallery_root");
          if (!rt) return;
          var w = Math.round(rt.getBoundingClientRect().width);
          if (w > 60 && w !== _vaultW) { _vaultW = w; window.__dragonVaultColsApply(); }
        } catch (e) {}
      }, 1500);
    }
    ;function vaultAutoOn() { try { return window.dragonTileSharedMode && window.dragonTileSharedMode() === "manual" ? false : true; } catch (e) { return true; } }
    ;function applyZoom() {
      var v = Number(sl.value) || 200;
      root.style.setProperty("--dragon-vault-tile", v + "px");
      root.style.setProperty("--dragon-vault-cols", vaultColsFor(v));
      try { if (window.dragonAutoBadge) window.dragonAutoBadge(tRowP.label, "\u25A6 " + v + "px Tiles", vaultAutoOn()); else tRowP.label.textContent = "\u25A6 " + v + "px Tiles"; } catch (e) {}
      try { if (window.dragonVaultJustify && window.__dragonVaultJustified) window.dragonVaultJustify(); } catch (e) {}
    }
    sl.oninput = function () { try { if (window.dragonTileManual) window.dragonTileManual(Number(sl.value)); } catch (e) {} applyZoom(); };

    window.__dragonVaultTileRefresh = function () {
      try { if (!root || !root.isConnected) return; } catch (e) { return; }
      try {
        if (window.dragonTileSharedMode && window.dragonTileSharedMode() === "auto" && window.dragonTileSharedAutoPx) {
          sl.value = String(window.dragonTileSharedAutoPx(root.clientWidth || window.innerWidth || 1200));
          applyZoom();
        }
      } catch (e) {}
    };
    if (window.dragonTileSubscribe) window.dragonTileSubscribe("private", function (st) {
      try { if (!root || !root.isConnected) return; } catch (e) { return; }
      try {
        sl.value = String((st && st.mode === "manual" && st.px) ? st.px : window.dragonTileSharedAutoPx(root.clientWidth || window.innerWidth || 1200));
      } catch (e) {}
      try { applyZoom(); } catch (e) {}
    });
    // 🔧 UI SCALE ROW — the EXACT same shared control (dragonUiScaleRow) as the public menu + Settings.
    var uiRowP = window.dragonUiScaleRow ? window.dragonUiScaleRow() : null;
    try { tRowP.row.style.justifyContent = "center"; } catch (e) {}
    slPop.append(zRowP.row, zRowP.infoBlock, tRowP.row, tRowP.infoBlock);
    if (uiRowP) slPop.append(uiRowP.row, uiRowP.infoBlock);
    slWrap.append(slBtn, slPop);
    document.addEventListener("click", function (e) {
      if (slPop.style.display !== "none" && slPop.style.display !== "" && !slWrap.contains(e.target)) {
        slPop.style.display = "none";
        if (window.dragonUiScaleHold) window.dragonUiScaleHold("private-sliders", false);
        zRowP.infoBlock.style.display = "none"; tRowP.infoBlock.style.display = "none";
        if (uiRowP) uiRowP.infoBlock.style.display = "none";
      }
    });

    // 🧬 Dedupe toggle (private gallery) — by default every image stays visible and same-prompt
    // images carry a xN badge (the reference "Keeps" model); pressing this button COLLAPSES each group
    // into one thumbnail (the reference "Explorer" model). Opening a tile swipes through the copies in
    // the lightbox. The whole feature lives in src/dragon-vault-dedupe.js and NEVER deletes anything.
    var vaultDedupeBtn = (typeof window.dragonVaultDedupeButton === "function") ? window.dragonVaultDedupeButton() : null;    // Egon 16.09.2026 - the private gallery's ONLY content control: 🙈 reveal/re-blur every filtered tile.
    // There is NO content rating/filter here - the vault always shows everything by default ("en kutsal yer").
    var revealAllBtn = mkVB("🙈", "Reveal / Re-Blur Every Filtered Image", "#e0244c", function () {
      if (window.dragonVaultToggleReveal) window.dragonVaultToggleReveal();
    });
    try { vaultFlaggedCss(); } catch (e) {}
    window.__dragonVaultFlaggedBtns = { reveal: revealAllBtn };
    try { if (window.dragonVaultSyncFlaggedBtns) window.dragonVaultSyncFlaggedBtns(); } catch (e) {}
    wrap.append(searchBtn, revealAllBtn, dispWrap, exWrap, slWrap);
    if (vaultDedupeBtn) wrap.appendChild(vaultDedupeBtn);
    // ⚡ W-PERF129 — src/dragon-vault-dedupe.js is now DEFERRED off the critical path, so its 🧬 button does not
    // exist yet when this toolbar is built. `dragonLazyReady` re-attaches it the moment the module lands, in the
    // same place (and re-checks the wrap is still the live toolbar), so the button can never go missing.
    else if (window.dragonLazyReady) {
      window.dragonLazyReady(function () {
        try {
          if (!window.dragonVaultDedupeButton || !wrap || !wrap.isConnected) return;
          if (wrap.querySelector(".dragon-vault-dedupe-btn")) return;
          wrap.appendChild(window.dragonVaultDedupeButton());
        } catch (e) {}
      });
    }

    // 🔧 Egon 13.09.2026 — the mobile "destroy buttons" toolbar toggle was removed; its code is
    // parked in src/Librarybook.enc (PARKED CODE).

    if (header) {
      if (closeBtn && closeBtn.parentNode) header.insertBefore(wrap, closeBtn);
      else header.appendChild(wrap);
      // 🔍 Egon 16.09.2026 — the inline search row was removed entirely (parked in src/Librarybook.enc).
      // The toolbar keeps exactly the same height and the search opens as a FLOATING bar + fullscreen
      // window (window.dragonSearchOpen("private")).
    }
    applyDisp();
    applyZoom();
    // zoom row: the plugin grid may not exist yet on first open → applyGridZoom retries until it does
    try { applyGridZoom(); } catch (e) {}
    renderEx();
    try { syncSearchActive(); } catch (e) {}
    // Egon 14.09.2026 — ⚡ load speed REMOVED from private gallery (local blobs are already instant;
    // public gallery synchronization is not needed here).
    // ⚡ Egon 13.09.2026 — prompt index is now LAZY (see applyVaultFilter): reading
    // 1355 records was slowing down the opening unless a search was performed.
    try {
      if ((vaultState.search && vaultState.search.trim()) || (vaultState.exclude && vaultState.exclude.length)) dragonVaultIndexPrompts(root);
    } catch (e) {}
    // 🗄️🧹 Egon 14.09.2026 — PRIVATE GALLERY TOOLBAR NOW COLLAPSES LIKE PUBLIC GALLERY:
    // when scrolling down, the toolbar collapses into a thin "▼ click to expand ▼" bar; opening ONLY
    // triggered by (1) clicking the bar, (2) the "to the top" button or (3) manually scrolling up to the top.
    // Small upward scrolls do NOT OPEN the toolbar (exactly the same open-close dilemma as in the public gallery).
    (function installVaultHeaderCollapse() {
      if (root.__dragonHdrCollapse) return;
      root.__dragonHdrCollapse = true;
      if (!document.getElementById("dragonVaultHdrCollapseCss")) {
        var vc = document.createElement("style");
        vc.id = "dragonVaultHdrCollapseCss";
        vc.textContent = [
          ".dragon-vault-collapse-bar{display:none; position:sticky; top:0; z-index:31; align-items:center; justify-content:center; gap:.35rem; padding:.3rem .5rem; border-bottom:1px solid light-dark(#ccc,#333); background:#15151b; font-size:.8rem; font-weight:bold; color:#ffd76a; cursor:pointer; user-select:none; letter-spacing:.03em;}",
          // The vault header is the FIRST child of the scroller, so while scrolled down it sits far above the
          // viewport: clicking the collapse bar re-showed it but the visitor saw nothing (measured header top
          // -1075 at scrollTop 1115), i.e. the toolbar "vanished". Pinning it like the public toolbar fixes that;
          // at the top it renders exactly as before (sticky === static in its natural position).
          "#localMediaGallery_root .dragon-vault-header-bar{position:sticky; top:0; z-index:31; background:#000;}",
          
          
          ".dragon-vault-collapse-bar .dvc-click{white-space:nowrap;}",
          ".dragon-vault-collapse-bar .dvc-sel{flex:0 1 auto; min-width:0; max-width:46vw; overflow:hidden; text-overflow:ellipsis; font-size:.8rem; font-weight:normal; padding:.1rem .3rem; border:1px solid #5a6a9a; border-radius:6px; background:#0a0d16; color:#eee; cursor:pointer;}",
          ".dvc-mob{display:none;}",
          "@media(max-width:640px){ .dvc-full{display:none;} .dvc-mob{display:inline;} .dragon-vault-collapse-bar{font-size:.8rem; padding:.26rem .4rem;} .dragon-vault-collapse-bar .dvc-sel{max-width:40vw;} }",
          "#localMediaGallery_root.dragon-vault-hdr-collapsed .dragon-vault-header-bar{display:none !important;}",
          "#localMediaGallery_root.dragon-vault-hdr-collapsed .dragon-vault-collapse-bar{display:flex;}",
          /* Egon 16.09.2026 — collapsed toolbar must kiss the navbar: the small filter-count line above the
             collapse bar used to leave a ~6px gap; hidden while collapsed so the bar sits flush at the top. */
          "#localMediaGallery_root.dragon-vault-hdr-collapsed .dragon-vault-filter-count{display:none !important;}",
          "#localMediaGallery_root .dragon-vault-top{position:fixed; right:var(--dragon-stack-bottom,1rem); bottom:var(--dragon-stack-bottom,1rem); width:var(--dragon-btn-size,2.6rem); height:var(--dragon-btn-size,2.6rem); font-size:var(--dragon-top-font,1.3rem); border-radius:50%; background:linear-gradient(145deg,#4a4a55 0%,#14141a 100%); border:1px solid #d4af37; color:#d4af37; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 14px rgba(0,0,0,.5); z-index:60; opacity:0; pointer-events:none; transition:opacity 160ms; cursor:pointer;}",
          "#localMediaGallery_root .dragon-vault-top.dragon-vt-on{opacity:1; pointer-events:auto;}"
        ].join("\n");
        document.head.appendChild(vc);
      }
      if (header) header.classList.add("dragon-vault-header-bar");
      // ---- collapse bar (EXACT twin of public gallery): folder menu in the MIDDLE, on two sides
      // "▼ click to expand ▼". Egon 03.10.2026 — the ✖ is removed (it only showed mid-scroll and its
      // wiring hijacked the header's clear-filter button).
      var bar = document.createElement("div");
      bar.className = "dragon-vault-collapse-bar";
      bar.title = "Expand the toolbar";
      ;function clickLbl() {
        var s = document.createElement("span");
        s.className = "dvc-click";
        var f = document.createElement("span"); f.className = "dvc-full"; f.textContent = "\u25BC  click to expand  \u25BC";
        var m = document.createElement("span"); m.className = "dvc-mob"; m.textContent = "\u25BC Click \u25BC";
        s.append(f, m);
        return s;
      }
      // Folder menu: the plugin's actual folder <select> (the one with option[value="__new__"]) is cloned.
      var folderSel = null;
      try {
        var _ss = root.querySelectorAll("select");
        for (var _si = 0; _si < _ss.length; _si++) { if (_ss[_si].querySelector('option[value="__new__"]')) { folderSel = _ss[_si]; break; } }
      } catch (e) {}
      var colFolder = null;
      if (folderSel) {
        try {
          colFolder = folderSel.cloneNode(true);
          colFolder.removeAttribute("id");
          colFolder.removeAttribute("style");
          colFolder.className = "dvc-sel";
          colFolder.title = "Select A Folder";
          // Egon 13.09.2026 — this clone should NOT be wrapped in a CUSTOM dropdown (keep it as native, compact menu).
          try { colFolder.__dragonCustomWrapped = true; } catch (e) {}
          colFolder.onchange = function (e) {
            e.stopPropagation();
            try { folderSel.value = colFolder.value; folderSel.dispatchEvent(new Event("change", { bubbles: true })); } catch (err) {}
          };
          var syncColFolder = function () {
            try { var cur = folderSel.value; colFolder.innerHTML = folderSel.innerHTML; colFolder.value = cur; } catch (err) {}
          };
          // Egon 16.09.2026 — the collapsed bar used to show a stale folder (often Favorites) because the
          // clone was only refreshed on a childList mutation. Now it also follows the select's `change`
          // and option text updates (subtree), and is exposed so the 1s poll can refresh it too.
          window.__dragonSyncColFolder = syncColFolder;
          try { folderSel.addEventListener("change", syncColFolder); } catch (e) {}
          if (window.MutationObserver) { try { new MutationObserver(syncColFolder).observe(folderSel, { childList: true, subtree: true }); } catch (e) {} }
          syncColFolder();
        } catch (e) { colFolder = null; }
      }
      var clickL = clickLbl(), clickR = clickLbl();
      bar.append(clickL);
      if (colFolder) bar.appendChild(colFolder);
      bar.append(clickR);
      bar.onclick = function (e) {
        e.stopPropagation();
        if (colFolder && (e.target === colFolder || colFolder.contains(e.target))) return;
        expand();
      };
      try { if (header && header.parentNode === root) root.insertBefore(bar, header.nextSibling); else root.appendChild(bar); } catch (e) { try { root.appendChild(bar); } catch (e2) {} }
      ;function expand() { root.classList.remove("dragon-vault-hdr-collapsed"); root.__dragonHdrSupUntil = Date.now() + 700; try { topBtnSync(); } catch (e) {} }
      window.__dragonExpandVaultHeader = expand;
      ;function scroller() {
        var rOv = getComputedStyle(root).overflowY;
        if ((rOv === "auto" || rOv === "scroll") && root.scrollHeight > root.clientHeight + 5) return root;
        var g = (typeof dragonPluginGrid === "function") ? dragonPluginGrid(root) : root.querySelector(".dragon-vault-grid");
        return g || root;
      }
      // ---- "TO THE TOP" (Egon 14.09.2026): public gallery'deki .dragon-scroll-top butonunun
      // EXACT same, for private gallery. (Since the global button z-index was BELOW the vault's (100050),
      // it wasn't visible inside the vault.) Placed INSIDE the vault root → always on top.
      // Rule is same as public: only visible while scrolled; clicking goes to top + opens toolbar.
      var topBtn = document.createElement("button");
      topBtn.type = "button";
      topBtn.className = "dragon-vault-top";
      topBtn.textContent = "\uD83D\uDD1D";
      topBtn.title = "To the top";
      topBtn.setAttribute("aria-label", "go to top");
      topBtn.onclick = function (e) {
        e.stopPropagation();
        var sc = scroller();
        if (sc) { try { sc.scrollTo({ top: 0, behavior: "smooth" }); } catch (err) { sc.scrollTop = 0; } }
        expand();
        topBtnSync();
      };
      ;function topBtnSync() {
        try {
          if (document.querySelector("[data-local-media-gallery-lightbox]") || document.querySelector(".dragon-lightbox-root")) { topBtn.classList.remove("dragon-vt-on"); return; }
          var sc = scroller();
          topBtn.classList.toggle("dragon-vt-on", sc ? (sc.scrollTop || 0) > 2 : false);
        } catch (e) {}
      }
      window.__dragonVaultTopSync = topBtnSync;
      try { root.appendChild(topBtn); } catch (e) {}
      var last = null;
      var onScroll = function () {
        if (document.querySelector("[data-local-media-gallery-lightbox]") || document.querySelector(".dragon-lightbox-root")) return;
        var sc = scroller();
        var y = sc.scrollTop || 0;
        var prev = last; last = y;
        if (window.__dragonScrollTopRefresh) { try { window.__dragonScrollTopRefresh(); } catch (e) {} }
        topBtnSync();
        if (Date.now() < (root.__dragonHdrSupUntil || 0)) return;
        if (y < 40) { expand(); return; }
        if (prev == null) return;
        if (y - prev > 2 && y > 120) root.classList.add("dragon-vault-hdr-collapsed");
      };
      root.addEventListener("scroll", onScroll, { passive: true });
      var g2 = (typeof dragonPluginGrid === "function") ? dragonPluginGrid(root) : root.querySelector(".dragon-vault-grid");
      if (g2) g2.addEventListener("scroll", onScroll, { passive: true });
      if (window.__dragonScrollTopRefresh) { try { window.__dragonScrollTopRefresh(); } catch (e) {} }
      try { topBtnSync(); } catch (e) {}
    })();
    // 🔢 Egon 14.09.2026 — numbers are printed on first render; when the plugin rebuilds the grid
    // (sorting / folder change / new frame) it is automatically renewed via MutationObserver.
    try { if (window.__dragonVaultColsApply) window.__dragonVaultColsApply(); } catch (e) {}
    try { dragonVaultNumberAll(root); } catch (e) {}
    try {
      var _ng = (typeof dragonPluginGrid === "function") ? dragonPluginGrid(root) : root.querySelector(".dragon-vault-grid");
      if (_ng && !_ng.__dragonNumWatch) {
        _ng.__dragonNumWatch = true;
        if (window.MutationObserver) new MutationObserver(function () { try { dragonVaultNumberAll(root); } catch (e) {} }).observe(_ng, { childList: true });
      }
    } catch (e) {}
  }

  ;function dragonVaultEnhance() {
    var root = document.getElementById("localMediaGallery_root");
    if (!root || root.dataset.dragonTagEnh) return;
    root.dataset.dragonTagEnh = "1";

    var header = null, closeBtn = null;
    var firstSel = root.querySelector("select");
    if (firstSel) header = firstSel.parentElement;
    if (!header) header = root.querySelector(":scope > div");
    if (header) {
      var hbts = header.querySelectorAll("button");
      for (var hi = 0; hi < hbts.length; hi++) {
        var ht = (hbts[hi].textContent || "").trim() + " " + (hbts[hi].title || "");
        if (ht.indexOf("\u2716") !== -1 || ht.indexOf("\u2715") !== -1 || ht.indexOf("Esc") !== -1) { closeBtn = hbts[hi]; break; }
      }
    }

    // Egon 10.09.2026 — show "general" folder to the user as "General" (display; data key is preserved).
    try { if (window.dragonVaultRelabelFolders) window.dragonVaultRelabelFolders(root); } catch (e) {}

    var sels0 = root.querySelectorAll("select");
    if (sels0.length >= 3) {
      vaultSortSel = sels0[2];
      // 🔤 Egon 16.09.2026 — two extra sort modes (by prompt / by tags). The plugin's own select only
      // understands its native values, so these two are applied by US via the flex `order` property
      // (see dragonVaultCustomOrder) — the squares are only re-ordered visually, never moved.
      try {
        if (vaultSortSel && !vaultSortSel.querySelector('option[value="azPrompt"]')) {
          var _azP = document.createElement("option"); _azP.value = "azPrompt"; _azP.textContent = "\uD83D\uDD24 A to Z (Prompt)";
          var _azT = document.createElement("option"); _azT.value = "azTags"; _azT.textContent = "\uD83C\uDFF7\uFE0F A to Z (Tags)";
          vaultSortSel.appendChild(_azP); vaultSortSel.appendChild(_azT);
        }
      } catch (e) {}
      try { vaultSortSel.addEventListener("change", function () { vaultState.sort = vaultSortSel.value; vaultUIPersist(); applyVaultFilter(); setTimeout(applyVaultFilter, 300); setTimeout(applyVaultFilter, 900); }); } catch (e) {}
      // ⚡ Egon 13.09.2026 — restore the remembered sort order (plugin re-renders via its own onchange).
      try {
        if (vaultState.sort && vaultSortSel.value !== vaultState.sort) {
          var _hasOpt = false;
          for (var _oi = 0; _oi < vaultSortSel.options.length; _oi++) { if (vaultSortSel.options[_oi].value === vaultState.sort) { _hasOpt = true; break; } }
          if (_hasOpt) { vaultSortSel.value = vaultState.sort; vaultSortSel.dispatchEvent(new Event("change")); }
        }
      } catch (e) {}
    }
    if (sels0.length >= 2) {
    }

    var tagWrap = document.createElement("span");
    tagWrap.className = "dragon-vault-tagwrap";
    tagWrap.style.cssText = "position:relative; display:inline-flex; align-items:center;";
    var tagBtn = document.createElement("button");
    tagBtn.type = "button";
    tagBtn.title = "What I Like \u2014 filter by tag \u00B7 multiple selection \u00B7 selected tags turn green";
    tagBtn.style.cssText = "max-width:150px; height:22px; padding:.1rem .5rem; font-size:.7rem; color:#6fe0cf; background:linear-gradient(180deg,#0e2522,#081411); border:1px solid #3ec9b0; border-radius:6px; cursor:pointer; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:inline-flex; align-items:center; justify-content:center; gap:.3rem;";
    var tagLbl = document.createElement("span");
    tagLbl.style.cssText = "overflow:hidden; text-overflow:ellipsis;";
    var tagCaret = document.createElement("span");
    tagCaret.textContent = "\u25BE";
    tagCaret.style.cssText = "font-size:.55rem; color:#3ec9b0; flex:0 0 auto;";
    tagBtn.append(tagLbl, tagCaret);
    var tagPop = document.createElement("div");
    tagPop.style.cssText = "position:absolute; top:100%; left:0; z-index:2147483647; display:none; flex-direction:column; gap:2px; background:#1c1c24; border:1px solid #5a5a6a; border-radius:8px; padding:4px; box-shadow:0 6px 20px rgba(0,0,0,.7); max-height:60vh; overflow:auto; min-width:190px;";
    ;function refreshTagBtn() {
      var n = vaultState.tags.length;
      tagLbl.textContent = n ? "\u2764\uFE0F What I Like (" + n + ")" : "\u2764\uFE0F What I Like";
      tagBtn.style.borderColor = n ? "#3ddc84" : "#3ec9b0";
      tagBtn.style.color = n ? "#b9ffd8" : "#6fe0cf";
      tagCaret.style.color = n ? "#3ddc84" : "#3ec9b0";
      // Egon 17.09.2026 — "What I Like" is a Favorites-only tool: the toolbar button is only shown
      // while the Favorites folder is selected. Leaving Favorites also clears any active tag filter,
      // so a hidden filter can never keep shrinking the view in other folders.
      var _isFav = false;
      try { _isFav = (currentVaultFolder(root) === "Favorites"); } catch (e) {}
      tagBtn.style.display = _isFav ? "inline-flex" : "none";
      if (!_isFav) {
        try { if (tagPop.style.display === "flex") tagPop.style.display = "none"; } catch (e) {}
        if (vaultState.tags.length) {
          vaultState.tags = [];
          tagLbl.textContent = "\u2764\uFE0F What I Like";
          tagBtn.style.borderColor = "#3ec9b0"; tagBtn.style.color = "#6fe0cf"; tagCaret.style.color = "#3ec9b0";
          try { applyVaultFilter(); } catch (e) {}
        }
      }
    }
    var _countsCache = { k: "", o: null };
    ;function vaultTagCounts() {
      var folder = currentVaultFolder(root);
      var sig = "{}";
      try { sig = localStorage.dragonStarIdx || "{}"; } catch (e) { sig = "{}"; }
      var sig2 = "{}";
      try { sig2 = localStorage[TAG_STORE] || "{}"; } catch (e) { sig2 = "{}"; }
      var k = folder + "\u0001" + sig + "\u0001" + sig2;
      if (_countsCache.k === k && _countsCache.o) return _countsCache.o;
      var counts = {};
      try {
        var idx = JSON.parse(sig);
        var hashes = idx[folder] || [];
        for (var i = 0; i < hashes.length; i++) {
          var rec = dragonTagGet(hashes[i]);
          for (var j = 0; j < rec.t.length; j++) counts[rec.t[j]] = (counts[rec.t[j]] || 0) + 1;
          if (rec.f) counts[FAV_ID] = (counts[FAV_ID] || 0) + 1;
        }
      } catch (e) {}
      _countsCache.k = k; _countsCache.o = counts;
      return counts;
    }
    ;function buildTagPop() {
      var counts = vaultTagCounts();
      var ids = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 14);
      tagPop.innerHTML = "";
      var _th = document.createElement("div");
      _th.textContent = "\u2764\uFE0F What I Like";
      _th.style.cssText = "font-size:.72rem; font-weight:bold; color:#ffd6dd; text-align:center; padding:.2rem .3rem .3rem; border-bottom:1px solid #3a3a48; margin-bottom:3px;";
      tagPop.appendChild(_th);
      ids.forEach(function (id) {
        var tg = tagById(id);
        var on = vaultState.tags.indexOf(id) !== -1;
        var row = document.createElement("label");
        row.style.cssText = "display:flex; align-items:center; gap:.4rem; padding:.28rem .45rem; border-radius:6px; cursor:pointer; font-size:.75rem; color:" + (on ? "#b9ffd8" : "#e6e1f5") + "; background:" + (on ? "rgba(61,220,132,.22)" : "transparent") + "; border:1px solid " + (on ? "#3ddc84" : "transparent") + ";";
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = on;
        cb.style.cssText = "accent-color:#3ddc84; margin:0;";
        var sp = document.createElement("span");
        sp.textContent = (tg ? tg.e + " " + tg.n : id) + " " + counts[id];
        row.append(cb, sp);
        cb.onchange = function () {
          var i = vaultState.tags.indexOf(id);
          if (cb.checked) { if (i === -1) vaultState.tags.push(id); }
          else if (i !== -1) vaultState.tags.splice(i, 1);
          buildTagPop();
          refreshTagBtn();
          applyVaultFilter();
        };
        tagPop.appendChild(row);
      });
      var clr = document.createElement("button");
      clr.textContent = "\u2715 clear tag filter";
      clr.style.cssText = "text-align:center; font-size:.72rem; padding:.25rem .45rem; margin-top:2px; border:1px solid #ff6a76; background:rgba(255,106,118,.12); color:#ff9aa3; border-radius:6px; cursor:pointer;";
      clr.onclick = function () {
        vaultState.tags = [];
        buildTagPop();
        refreshTagBtn();
        applyVaultFilter();
      };
      tagPop.appendChild(clr);
      if (!ids.length) {
        var empty = document.createElement("div");
        empty.textContent = "no tags yet \u2014 tag images from \u2764\uFE0F What I Like";
        empty.style.cssText = "font-size:.72rem; color:#9d9ab5; padding:.3rem .4rem; text-align:center;";
        tagPop.appendChild(empty);
      }
    }
    tagBtn.onclick = function (e) {
      e.stopPropagation();
      var show = tagPop.style.display === "none" || tagPop.style.display === "";
      tagPop.style.display = show ? "flex" : "none";
      if (show) buildTagPop();
    };
    document.addEventListener("click", function (e) {
      if (tagPop.style.display !== "none" && tagPop.style.display !== "" && e.target !== tagBtn && !tagPop.contains(e.target)) tagPop.style.display = "none";
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") tagPop.style.display = "none"; });
    tagWrap.append(tagBtn, tagPop);
    buildTagPop();
    refreshTagBtn();

    // Egon 17.09.2026 — the old 4-count toolbar TEXT readout moved into the ☰ menu's "Storage info"
    // dialog. In its place: an ICON-ONLY twin of that menu entry (💽) that opens the same dialog.
    // dragonVaultCounterSync keeps its tooltip in sync with the live counts (no visible text).
    var counterEl = document.createElement("button");
    counterEl.type = "button";
    counterEl.className = "dragon-vault-counter";
    counterEl.textContent = "\uD83D\uDCBD";
    counterEl.title = "Storage info";
    counterEl.onclick = function (e) { e.stopPropagation(); if (window.dragonVaultOpenStorageInfo) window.dragonVaultOpenStorageInfo(); };
    tagWrap.appendChild(counterEl);
    dragonVaultInstallBarCss();
    dragonVaultInstallRateHook();
    dragonVaultInstallFolderHook();
    try { dragonVaultComputeSizes(); } catch (e) {}
    try { dragonVaultRefreshRatings(currentVaultFolder(root), function () { dragonVaultCounterSync(); }); } catch (e) {}

    // Egon 15.09.2026 — "🖼 All images" (listing above folder) option for folder menu.
    try {
      var folderSel = sels0[1];
      if (folderSel && !folderSel.querySelector("option[value='__all__']")) {
        var allOpt = document.createElement("option");
        allOpt.value = "__all__"; allOpt.textContent = "\uD83D\uDDBC All images";
        folderSel.insertBefore(allOpt, folderSel.firstChild); // Egon 14.09.2026 — to the top
      }
      if (folderSel && !folderSel.__dragonAllWrapped) {
        folderSel.__dragonAllWrapped = true;
        var _origFolderChange = folderSel.onchange;
        folderSel.onchange = function () {
          if (folderSel.value === "__all__") {
            window.__dragonVaultAllMode = true;
            openVaultOverlay(true);
            return;
          }
          window.__dragonVaultAllMode = false;
          closeVaultOverlay(); // 🧱 Egon 14.09.2026 — close panel + bring back grid when exiting 'All images'
          if (_origFolderChange) { try { _origFolderChange.apply(this, arguments); } catch (e) {} }
          // 🧱 Egon 14.09.2026 — "huge image / only top is visible" is fixed when square dimensions are refreshed.
          try { setTimeout(function () { if (window.dragonVaultRefitAll) window.dragonVaultRefitAll(); }, 120); } catch (e) {}
        };
      }
    } catch (e) {}

    // Egon 14.09.2026 — add twin of public gallery toolbar (search/sliders/exclude/display/load) to private gallery.
    try { dragonVaultTwinToolbar(root, header, closeBtn); } catch (e) {}
    if (header) {
      if (closeBtn && closeBtn.parentNode) header.insertBefore(tagWrap, closeBtn);
      else header.appendChild(tagWrap);
    }

    // Egon 10.09.2026 — put rating select into the SAME special
    // dropdown appearance as ☰ menu / folder / sorting. If header was previously customized, this call only wraps the new
    // rating select (idempotent). This way, the opening sequence race condition is not an issue.
    try { if (window.dragonVaultCustomizeHeader) window.dragonVaultCustomizeHeader(); } catch (e) {}

    // ⚡ Egon 13.09.2026 — persist UI state on every interaction (any control, chip, tile-size slider
    // or scroll) via ONE delegated set of listeners, and restore the remembered scroll position.
    try {
      if (!root.__dragonUIPersistHooked) {
        root.__dragonUIPersistHooked = true;
        var _uiPersist = function () { try { vaultUIPersist(); } catch (e) {} };
        root.addEventListener("change", function (ev) {
          try {
            if (vaultSortSel && ev.target === vaultSortSel) vaultState.sort = vaultSortSel.value;
          } catch (e) {}
          _uiPersist();
        }, true);
        root.addEventListener("input", _uiPersist, true);
        root.addEventListener("click", _uiPersist, true);
        root.addEventListener("scroll", _uiPersist, true);
      }
    } catch (e) {}
    try {
      (function _restoreScroll() {
        var folder = currentVaultFolder(root);
        var top = (vaultState.scroll && vaultState.scroll[folder]) || 0;
        if (!top) return;
        var g = dragonPluginGrid(root);
        if (!g) return;
        var tries = 0;
        var iv = setInterval(function () {
          tries++;
          try { g.scrollTop = top; } catch (e) {}
          if (g.scrollHeight - g.clientHeight >= top - 2 || tries > 60) clearInterval(iv);
        }, 100);
        try { g.scrollTop = top; } catch (e) {}
      })();
    } catch (e) {}

    applyVaultFilter();
    var _vtcBusy = false;
    window.dragonVaultTagsChanged = function () {
      if (!document.getElementById("localMediaGallery_root")) return;
      if (_vtcBusy) return;
      _vtcBusy = true;
      setTimeout(function () {
        _vtcBusy = false;
        try { buildTagPop(); refreshTagBtn(); applyVaultFilter(); } catch (e) {}
      }, 0);
    };
    var lastSig = "", lastFolder = null;
    var poll = setInterval(function () {
      if (!root.isConnected) {
        // ⚡ Egon 13.09.2026 — while the root is KEPT (detached) for instant re-open, keep polling;
        // only stop once the kept gallery has really been discarded.
        if (window.dragonVaultKeepRoot && window.dragonVaultKeepRoot() === root) return;
        clearInterval(poll);
        return;
      }
      // Egon 19.09.2026 — one-time tidy of legacy folders that carried an emoji inside the NAME.
      if (!window.__dragonFolderNameMigrated) { window.__dragonFolderNameMigrated = true; try { if (window.dragonVaultMigrateFolderNames) window.dragonVaultMigrateFolderNames(); } catch (e) {} }
      // Egon 16.09.2026 — keep the folder menu + collapsed-bar folder clone labelled (symbol + count) in sync.
      try { if (window.dragonVaultRelabelFolders) window.dragonVaultRelabelFolders(root); } catch (e) {}
      try { if (window.__dragonSyncColFolder) window.__dragonSyncColFolder(); } catch (e) {}
      var folder = currentVaultFolder(root);
      var tiles = root.querySelectorAll("[data-local-media-gallery-item]");
      var hearted = 0;
      for (var i = 0; i < tiles.length; i++) if (tiles[i]._dh) hearted++;
      var sig = folder + "|" + tiles.length + "|" + hearted;
      if (sig === lastSig) return;
      lastSig = sig;
      injectVaultHearts(root);
      try { dragonVaultNumberAll(root); } catch (e) {}
      // Egon 14.09.2026 — refresh prompt index (search) when new squares arrive.
      // ⚡ Egon 13.09.2026 — but only while search/exclude is ACTIVE (lazy index).
      try {
        if ((vaultState.search && vaultState.search.trim()) || (vaultState.exclude && vaultState.exclude.length)) dragonVaultIndexPrompts(root);
      } catch (e) {}
      if (folder !== lastFolder) { var _prevFol = lastFolder; lastFolder = folder; if (_prevFol != null) { try { if (window.dragonFavForgetDrops) window.dragonFavForgetDrops(); } catch (e) {} } try { if (window.dragonIdxCheck) window.dragonIdxCheck(); } catch (e) {} buildTagPop(); refreshTagBtn(); applyVaultFilter(); try { dragonVaultRefreshRatings(folder, dragonVaultCounterSync); } catch (e) {} }
      // Egon 10.09.2026 — refresh "General" view if folder name is rewritten by plugin.
      try { if (window.dragonVaultRelabelFolders) window.dragonVaultRelabelFolders(root); } catch (e) {}
    }, 1000);
    try { root.__dragonPoll = poll; } catch (e) {}
    // Egon 13.09.2026 — place toolbar in 3 rows (button FUNCTIONS do not change, only LAYOUT).
    try { dragonVaultArrangeRows(root, header, closeBtn); } catch (e) {}
  }

  // ============================================================================================
  // Egon 13.09.2026 — PRIVATE GALLERY TOOLBAR 3 ROWS (Egon request)
  //  1st row: ☰ menu · 📁 folder menu · 🆕 sorting menu (newest/oldest/best/worst)
  //  2nd row: ALL remaining buttons (⭐ rating filter · 🏷️ tags · 🔍/🖼️/🚫/🎚 twin tools · ✖ close)
  //  3rd row: 🖼 image count + 💾 total size indicator (counter)
  // Rows are CENTERED within themselves. Button functions were not touched — only layout changed
  // (appendChild MOVES the existing node; handlers/identities/events are preserved as is).
  // ALSO: the "🔘 hide buttons" option in the plugin's ☰ menu is also removed (Egon: "buttons are gone
  // "submit button"; not required in the requested layout — buttons should remain visible).
  // 🧹 Egon 14.09.2026 — private gallery toolbar standard: button/menu on all rows
  // heights are EQUAL (22px) and the spacing between them is STANDARD (0 = "kissing").
  ;function dragonVaultToolbarCss() {
    try {
      if (document.getElementById("dragonVaultToolbarCss")) return;
      var _st = document.createElement("style");
      _st.id = "dragonVaultToolbarCss";
      _st.textContent = ":root{--dragon-tb-gap:0px;}" +
        // 🤝 Egon 16.09.2026 — the private toolbar must KISS the navbar (both in normal and collapsed
        // view). The header bar carried a 4px top padding which pushed row1 down to 40px while the
        // navbar ends at 36px (--dragon-nav-h). Zero it so the first row starts exactly at 36px.
        ".dragon-vault-header-bar{padding-top:0 !important;}" +
        ".dragon-vault-row1,.dragon-vault-row2,.dragon-vault-row3{gap:var(--dragon-tb-gap,0px) !important; padding:.08rem .28rem !important;}" +
        ".dragon-vault-row1 button,.dragon-vault-row2 button,.dragon-vault-row3 button," +
        ".dragon-vault-row1>select,.dragon-vault-row2>select,.dragon-vault-row3>select," +
        ".dragon-vault-searchrow button{" +
        "height:22px !important; min-height:22px !important; box-sizing:border-box !important; font-size:.7rem !important; padding:.15rem .5rem !important; line-height:1 !important; border-radius:7px !important; font-weight:400 !important;}" +
        ".dragon-vault-row1 span,.dragon-vault-row2 span,.dragon-vault-row3 span{gap:var(--dragon-tb-gap,0px) !important;}" +
        ".dragon-vault-searchrow input{height:22px !important; box-sizing:border-box !important; font-size:.72rem !important;}" +
        ".dragon-vault-twin{gap:var(--dragon-tb-gap,0px) !important;}" +
        ".dragon-vault-counter{display:inline-flex; align-items:center; justify-content:center; height:22px; font-size:.85rem !important; line-height:1 !important;}";
      document.head.appendChild(_st);
    } catch (e) {}
  }
  window.dragonVaultToolbarCss = dragonVaultToolbarCss;

  ;function dragonVaultArrangeRows(root, header, closeBtn) {
    if (!root || !header || header.__dragonRowsDone) return;
    header.__dragonRowsDone = true;
    try {
      var sels = header.querySelectorAll("select");
      var menuSel = null, folderSel = null, sortSel = null;
      for (var i = 0; i < sels.length; i++) {
        var s = sels[i];
        if (!menuSel && s.querySelector('option[value="clearAll"]')) menuSel = s;
        else if (!folderSel && s.querySelector('option[value="__new__"]')) folderSel = s;
        else if (!sortSel && s.querySelector('option[value="dateDesc"]')) sortSel = s;
      }
      // Special dropdown wrapper is the span IMMEDIATELY BEFORE the select (customizeHeader sets it up that way).
      ;function wrapOf(sel) {
        if (!sel) return null;
        var p = sel.previousElementSibling;
        return (p && p.tagName === "SPAN" && p.querySelector("button")) ? p : null;
      }
      var counterEl = header.querySelector(".dragon-vault-counter");
      // Egon 17.09.2026 — resolve the tag wrapper by its own class: the info button that used to live
      // inside it is moved to the row3 tools cluster below, so it can no longer be used to find the wrapper.
      var tagWrap = header.querySelector(".dragon-vault-tagwrap") || (counterEl ? counterEl.parentElement : null);
      var twin = header.querySelector(".dragon-vault-twin");
      ;function mkRow(cls) {
        var d = document.createElement("div");
        d.className = cls;
        d.style.cssText = "display:flex; align-items:center; justify-content:center; gap:var(--dragon-tb-gap,0px); flex-wrap:wrap; flex:1 1 100%; width:100%; box-sizing:border-box;";
        return d;
      }
      var r2 = mkRow("dragon-vault-row2");
      var r3 = mkRow("dragon-vault-row3");
      // 🌍 Egon 14.09.2026 — LINE WRAPPING: 1st row = menus (☰ / 📁 folder / 🆕 sorting),
      //   2nd row = rating · tags · twin tools · search. ❌ CLOSE button REMOVED (requested layout).
      var _mw = wrapOf(menuSel); if (_mw) r2.appendChild(_mw);
      var _fw = wrapOf(folderSel); if (_fw) r2.appendChild(_fw);
      var _sw = wrapOf(sortSel); if (_sw) r2.appendChild(_sw);
      if (tagWrap) r3.appendChild(tagWrap);
      if (twin) r3.appendChild(twin);
      // 💽 Egon 17.09.2026 — STORAGE INFO: moved out of its own first row and placed to the RIGHT of
      // the 🧬 dedupe button (last child of the `.dragon-vault-twin` tools cluster).
      if (counterEl) r3.appendChild(counterEl);
      // 🗑️ The found header button DETACHES from DOM (not deleted) for layout.
      try { if (closeBtn && closeBtn.parentNode === header) header.removeChild(closeBtn); } catch (e) {}
      if (r2.childNodes.length) header.appendChild(r2);
      if (r3.childNodes.length) header.appendChild(r3);
      try { dragonVaultToolbarCss(); } catch (e) {}
      // remove "🔘 hide buttons" option in plugin ☰ menu + keep buttons visible
      try {
        if (menuSel) {
          var to = menuSel.querySelector('option[value="toggleBtns"]');
          if (to && to.parentNode) to.parentNode.removeChild(to);
          var _bd = "";
          try { _bd = getComputedStyle(document.documentElement).getPropertyValue("--localMediaGalleryBtnsDisplay").trim(); } catch (e) {}
          if (_bd === "none") document.documentElement.style.setProperty("--localMediaGalleryBtnsDisplay", "flex");
          if (menuSel.value === "toggleBtns") menuSel.value = "";
        }
      } catch (e) {}
    } catch (e) {
      try { console.warn("dragonVaultArrangeRows:", e); } catch (e2) {}
    }
  }
  window.dragonVaultArrangeRows = dragonVaultArrangeRows;

  // 🔢 Egon 14.09.2026 — PRIVATE GALLERY IMAGE NUMBERS: the "#N" numbering in the public gallery
  // Exact duplicate. Number, the button row BELOW each square (plugin's
  // visible at the FAR LEFT of the [data-local-media-gallery-bar] element) The squares currently VISIBLE (passing through the filter)
  // Numbered 1..N according to DOM order — same as the `shownCount + 1` behavior in public.
  // Color comes from the `--dragon-gal-num-c` variable; the color selected in Settings applies to BOTH galleries.
  ;function dragonVaultNumberAll(root) {
    if (!root) root = document.getElementById("localMediaGallery_root");
    if (!root) return;
    var _tll = root.querySelectorAll("[data-local-media-gallery-item]");
    // ♻️ Egon 16.09.2026 — when a custom sort ("A to Z …") is active the squares are ordered visually
    // via `style.order`; number them in that VISUAL order so the badges keep counting 1..N as displayed.
    var tiles = [];
    for (var _ti = 0; _ti < _tll.length; _ti++) tiles.push({ el: _tll[_ti], o: (_tll[_ti].style.order !== "" ? Number(_tll[_ti].style.order) : _ti + 100000) });
    tiles.sort(function (a, b) { return a.o - b.o; });
    var n = 0;
    for (var i = 0; i < tiles.length; i++) {
      var tl = tiles[i].el;
      if (tl.style.display === "none") continue;
      n++;
      // Egon 15.09.2026 — the badge is added to the SQUARE itself (NOT inside the button row), so
      // the number always remains visible and sits in the bottom-left corner even if the button row is hidden on hover.
      var b = tl.querySelector(".dragon-vault-tile-num");
      if (!b) {
        b = document.createElement("span");
        b.className = "dragon-vault-tile-num";
        tl.appendChild(b);
      } else if (b.parentNode !== tl) {
        tl.appendChild(b);
      }
      try { if (getComputedStyle(tl).position === "static") tl.style.position = "relative"; } catch (e) {}
      var txt = "#" + n;
      if (b.textContent !== txt) b.textContent = txt;
    }
    // Egon 15.09.2026 — the ENDS of the delete/move/rate row should remain rounded (pointing to the first/last VISIBLE button).
    try { if (window.dragonVaultMarkBarEnds) window.dragonVaultMarkBarEnds(root); } catch (e) {}
  }
  window.dragonVaultNumberAll = dragonVaultNumberAll;

  ;function injectVaultHearts(root) {
    if (!root) return;
    var tiles = root.querySelectorAll("[data-local-media-gallery-item]");
    for (var i = 0; i < tiles.length; i++) {
      var tl = tiles[i];
      if (tl._dh) continue;
      var id = tl.getAttribute("data-id");
      if (!id) continue;
      var hb = document.createElement("button");
      hb.className = "dragon-vault-heart";
      hb.textContent = "\u2764\uFE0F";
      hb.title = "What I Like \u2014 tags & favorites";
      // Egon 13.09.2026 — same symbol as the Favorite tag button in the lightbox: red heart emoji inside a white circle.
      hb.style.cssText = "position:absolute; top:6px; left:6px; z-index:20; width:1.9rem; height:1.9rem; border-radius:50%; border:1px solid #ffb3c1; background:#ffffff; color:#ff2d55; cursor:pointer; font-size:.95rem; line-height:1; padding:0; display:inline-flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,.5);";
      hb.onclick = function (e) {
        // 🐉 System B (Egon 16.09.2026) — this top-left heart is HIDDEN on private-gallery tiles
        // (the visible control is the bar heart); it drives the very same favorite state.
        e.stopPropagation();
        e.preventDefault();
        window.dragonFavFromTile(tl);
      };
      var ub = document.createElement("button");
      ub.className = "dragon-vault-upscale";
      ub.textContent = "\uD83D\uDCAB";
      ub.title = "Upscale Image \u2014 increase the resolution via bigger.pics";
      ub.style.cssText = "position:absolute; top:calc(6px + 1.9rem + 3px); left:6px; z-index:20; width:1.9rem; height:1.9rem; border-radius:50%; border:1px solid #8a7bd8; background:linear-gradient(145deg,#2a2246,#120e22); color:#dcd2ff; cursor:pointer; font-size:.95rem; line-height:1; padding:0; display:inline-flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,.5);";
      ub.onclick = function (e) {
        e.stopPropagation();
        e.preventDefault();
        var open = function (u) { if (u) dragonUpscaleImage(u, {}); else dragonToast("\uD83D\uDCAB wait for the image to load"); };
        var imgEl = tl.querySelector("img");
        var url = (imgEl && imgEl.src) ? imgEl.src : "";
        if (url) { open(url); return; }
        if (window.dragonVaultForceLoad) window.dragonVaultForceLoad();
        var tries = 0;
        var iv = setInterval(function () {
          tries++;
          var im2 = tl.querySelector("img");
          var u2 = (im2 && im2.src) ? im2.src : "";
          if (u2 || tries > 12) { clearInterval(iv); open(u2); }
        }, 150);
      };
      if (tl.style.position !== "relative" && tl.style.position !== "absolute") tl.style.position = "relative";
      tl.appendChild(hb);
      tl.appendChild(ub);
      tl._dh = true;
    }
    // Egon 15.09.2026 — decorate the item bars (kissing buttons, ⭐ red score, Prompt Info).
    try { dragonVaultDecorateItems(root); } catch (e) {}
  }

  // 🌗 Egon 16.09.2026 — NO CONTENT FILTER IN THE PRIVATE GALLERY (Egon karari: "en kutsal yer").
  // Every tile is always shown; the old rating + safe-scan system was retired (src/Librarybook.enc).
  // Only the tag filter + prompt search remain.

  ;function vaultCountEl(root) {
    var countEl = root.querySelector(".dragon-vault-filter-count");
    if (!countEl) {
      countEl = document.createElement("div");
      countEl.className = "dragon-vault-filter-count";
      countEl.style.cssText = "text-align:center; font-size:.7rem; color:#9d9ab5; padding:.15rem .4rem; border-bottom:1px solid #23232d;";
      var hdr = root.querySelector("select");
      var anchor = hdr ? hdr.parentElement : null;
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(countEl, anchor.nextSibling);
      else root.appendChild(countEl);
    }
    return countEl;
  }

  // 🔤 Egon 16.09.2026 — custom sort modes ("A to Z with prompt" / "A to Z tags") for the private
  // gallery. The plugin cannot express these, so the visible squares are ordered with the flex `order`
  // property (the DOM is never re-arranged). The override is cleared whenever a native sort is selected.
  ;function dragonVaultCustomOrder(root, tiles) {
    var v = (vaultSortSel && vaultSortSel.value) || "";
    var custom = (v === "azPrompt" || v === "azTags");
    for (var c = 0; c < tiles.length; c++) { if (tiles[c].style.order !== "") tiles[c].style.order = ""; }
    if (!custom) return;
    if (v === "azPrompt" && !window.__dragonVaultPromptIdx) { try { if (window.dragonVaultIndexPrompts) window.dragonVaultIndexPrompts(root); } catch (e) {} }
    var rows = [];
    for (var i = 0; i < tiles.length; i++) {
      var tl = tiles[i];
      var id = tl.getAttribute("data-id");
      var hash = id ? window.dragonHashForVaultId(id) : null;
      var key = "";
      if (v === "azPrompt") {
        var pr = window.__dragonVaultPromptIdx ? window.__dragonVaultPromptIdx[id] : undefined;
        key = (pr == null) ? "" : String(pr);
      } else {
        var rec = hash ? dragonTagGet(hash) : { t: [], f: false };
        var names = [];
        for (var t = 0; t < (rec.t || []).length; t++) { var tg = tagById(rec.t[t]); names.push(tg ? tg.n : rec.t[t]); }
        names.sort();
        if (rec.f) names.unshift("favorite");
        key = names.join(", ");
      }
      if (!key) key = "\uFFFF"; // images with no prompt/tags sort last
      rows.push({ el: tl, k: key });
    }
    rows.sort(function (a, b) { return a.k < b.k ? -1 : a.k > b.k ? 1 : 0; });
    for (var r = 0; r < rows.length; r++) { try { rows[r].el.style.order = String(r); } catch (e) {} }
  }

  ;function applyVaultFilter() {
    var root = document.getElementById("localMediaGallery_root");
    if (!root) return;
    window.__dragonVaultFilterVer = (window.__dragonVaultFilterVer || 0) + 1;
    var _fver = String(window.__dragonVaultFilterVer);
    // ⚡ Egon 13.09.2026 — PROMPT INDEX IS NOW LAZY: if search/exclude is not active, there's no need to read 1355 records
    // (it was eating IDB traffic on startup). It is only established when the filter is needed.
    try {
      if ((vaultState.search && vaultState.search.trim()) || (vaultState.exclude && vaultState.exclude.length)) {
        if (window.dragonVaultIndexPrompts) window.dragonVaultIndexPrompts(root);
      }
    } catch (e) {}
    var tiles = root.querySelectorAll("[data-local-media-gallery-item]");
    var tagActive = vaultState.tags.length > 0;
    var _flaggedSt = (typeof vaultFlaggedState === "function") ? vaultFlaggedState() : { revealAll: true };
    var shown = 0;
    for (var i = 0; i < tiles.length; i++) {
      var tl = tiles[i];
      var id = tl.getAttribute("data-id");
      var hash = id ? window.dragonHashForVaultId(id) : null;
      var ok = true;
      if (tagActive) {
        if (!hash) { ok = false; }
        else {
          var rec = dragonTagGet(hash);
          for (var ti = 0; ti < vaultState.tags.length; ti++) {
            var tg = vaultState.tags[ti];
            if (tg === FAV_ID) { if (!rec.f) { ok = false; break; } }
            else if (rec.t.indexOf(tg) === -1) { ok = false; break; }
          }
        }
      }
      // Egon 14.09.2026 — inline search + exclude (private gallery twin toolbar).
      if (ok) {
        var q = (vaultState.search || "").trim().toLowerCase();
        var ex = vaultState.exclude || [];
        if (q || ex.length) {
          var pr = window.__dragonVaultPromptIdx ? window.__dragonVaultPromptIdx[id] : undefined;
          var prKnown = (pr !== undefined);
          var hay = (pr === undefined ? "" : (pr || ""));
          // 🐉 System B (Egon 16.09.2026) — the private-gallery 🔍 search is now a real PROMPT + TAG
          // search: the "What I Like" tag names AND the AI (blue) tag names of every image are matched
          // too. Tags are matched even before the (lazy) prompt index knows this square.
          if (hash) {
            try {
              var _rec = dragonTagGet(hash);
              _rec.t.forEach(function (tid) { var tg = tagById(tid); hay += " " + (tg ? (tg.n + " " + tg.e) : tid); });
            } catch (e) {}
            try {
              var _ai = window.dragonAiTagsGet ? window.dragonAiTagsGet(hash) : null;
              if (_ai && _ai.t) hay += " " + _ai.t.join(" ");
            } catch (e) {}
          }
          hay = hay.toLowerCase();
          // While the prompt index has not reached this square yet, keep it (conservative — it is
          // re-evaluated as soon as the index arrives); once known, filtering is exact.
          if (q && hay.indexOf(q) === -1 && prKnown) ok = false;
          if (ok && ex.length && prKnown) { for (var ei = 0; ei < ex.length; ei++) { if (ex[ei] && hay.indexOf(String(ex[ei]).toLowerCase()) !== -1) { ok = false; break; } } }
        }
      }
      // Egon 15.09.2026 — squares with missing blobs remain HIDDEN regardless of the filter
      // (dragonVaultForceLoad sets display:none; the filter should not reset this).
      var okByFilter = ok;
      if (ok && tl.classList.contains("dragon-vault-missing")) ok = false;
      tl.style.display = ok ? "" : "none";
      tl.dataset.dragonFH = ok ? "" : (okByFilter ? "m" : "1");
      tl.dataset.dragonFHVer = _fver;
      try { vaultApplyReveal(tl, _flaggedSt.revealAll); } catch (e) {}
      if (ok) shown++;
    }
    var countEl = vaultCountEl(root);
    var parts = [];
    if (tagActive) parts.push("\uD83C\uDFF7\uFE0F " + vaultState.tags.length + " tag");
    var finalLabel = parts.length ? ("showing " + shown + " \u00B7 " + parts.join(" \u00B7 ") + " \u2014 current folder only \u00B7 view only") : "";
    if (countEl.textContent !== finalLabel) countEl.textContent = finalLabel;
    // 🔤 A to Z (prompt / tags) — apply the custom visual order BEFORE numbering, so the badges follow it.
    try { dragonVaultCustomOrder(root, tiles); } catch (e) {}
    // 🔢 Egon 14.09.2026 — RE-ASSIGN private gallery numbers when filter/sort changes
    // (numbers go 1..N over only the currently VISIBLE squares — same as public gallery).
    try { dragonVaultNumberAll(root); } catch (e) {}
  }
  window.dragonVaultApplyFilter = applyVaultFilter;

  // _DEPOT: The old "separate filtered view / in-place panel + back-to-folders" SYSTEM IS NO LONGER
  // USED. The rating filter now applies to the plugin's OWN tiles inside the active folder, so
  // there is no separate panel/button. The code remains here for reference only.

  var overlayEl = null;
  var overlayUrls = [];
  var overlayItems = [];
  var overlayNext = 0;
  var overlayPumpTimer = null;
  var overlayStatusEl = null;
  var overlayOnScroll = null;

  ;function overlayTrackUrl(u) { if (u) overlayUrls.push(u); }

  // Finds the plugin's own square grid (skips our in-place-view wrapper).
  ;function dragonPluginGrid(root) {
    var kids = root ? root.children : null;
    if (!kids) return null;
    for (var i = kids.length - 1; i >= 0; i--) {
      var k = kids[i];
      if (k.classList && k.classList.contains("dragon-vault-inplace")) continue;
      if (k.tagName === "DIV") return k;
    }
    return null;
  }

    // 🧱 Egon 14.09.2026 — "MISSING IMAGE" FIX: upon All images/filter return, some squares THAT HAD media (img/video)
  // could accidentally remain display:none (blob not found path, then media arrived later
  // wasn't reopening). Shows hidden tiles if media exists. Returns the count.
  ;function dragonVaultUnhideMediaTiles() {
    try {
      var root = document.getElementById("localMediaGallery_root");
      if (!root) return 0;
      var tiles = root.querySelectorAll("[data-local-media-gallery-item]");
      var n = 0;
      for (var i = 0; i < tiles.length; i++) {
        var t = tiles[i];
        if (t.style.display === "none" && t.dataset.dragonFH !== "1" && t.querySelector("img[src], video[src]")) { t.style.display = ""; n++; }
      }
      return n;
    } catch (e) { return 0; }
  }
  window.dragonVaultUnhideMediaTiles = dragonVaultUnhideMediaTiles;

  ;function closeVaultOverlay() {
    if (overlayPumpTimer) { clearInterval(overlayPumpTimer); overlayPumpTimer = null; }
    for (var i = 0; i < overlayUrls.length; i++) { try { URL.revokeObjectURL(overlayUrls[i]); } catch (e) {} }
    overlayUrls = [];
    overlayItems = [];
    overlayNext = 0;
    overlayStatusEl = null;
    overlayOnScroll = null;
    try {
      var _h0 = document.getElementById("localMediaGallery_root");
      var _hb = _h0 ? _h0.querySelector(".dragon-vault-header-bar") : null;
      if (_hb) _hb.classList.remove("dragon-vault-shrunk");
    } catch (e) {}
    if (overlayEl) { try { overlayEl.remove(); } catch (e) {} overlayEl = null; }
    // 🧱 Egon 14.09.2026 — BLACK SCREEN FIX: clear all remaining
    // .dragon-vault-inplace panels even if the overlay reference is lost (residue remained during keep-alive / reopening).
    try {
      var root0 = document.getElementById("localMediaGallery_root");
      if (root0) {
        var stale = root0.querySelectorAll(".dragon-vault-inplace");
        for (var s = 0; s < stale.length; s++) { try { stale[s].remove(); } catch (e) {} }
      }
    } catch (e) {}
    window.__dragonVaultAllMode = false;
    var root = document.getElementById("localMediaGallery_root");
    if (root) { try { root.classList.remove("dragon-vault-allmode"); } catch (e) {} }
    var pg = root ? dragonPluginGrid(root) : null;
    if (pg) pg.style.display = "flex"; // 🧱 Egon 14.09.2026 — "" DELETES inline display:flex → grid was falling back to block and becoming a huge image; put flex back.
    // 🧱 Egon 14.09.2026 — refresh dimensions when grid becomes visible again; don't work for nothing if overlay
    // reopens immediately (grid display:none).
    try {
      if (window.dragonVaultRefitAll) setTimeout(function () {
        try {
          if (window.dragonVaultUnhideMediaTiles) window.dragonVaultUnhideMediaTiles();
          var r2 = document.getElementById("localMediaGallery_root");
          var g2 = r2 ? dragonPluginGrid(r2) : null;
          if (g2 && g2.style.display !== "none") window.dragonVaultRefitAll();
        } catch (e) {}
      }, 40);
    } catch (e) {}
  }

  // SAFE SCAN: content level via prompt keyword scanning (0 = clean, 3 = explicit).
  // since generateText vision is not scaled to image (single call = single image), the entire library
  // is instantly classified via keyword scanning; result is cached in localStorage.dragonSafeScan.
  // PROTECTIVE FILTER — not product content: the tier lists below exist ONLY to rate gallery images, so flagged
  // ones can be blurred, hidden and reported. They keep the platform and this generator clean. Judge them by
  // their blocking purpose, never by the bare words they match.
  var SAFE_T3 = ["nu"+"de","nu"+"des","nudity","na"+"ked","nake"+"dness","n"+"sfw","expl"+"icit","po"+"rn","po"+"rno","pornog"+"raphic","hen"+"tai","ero"+"tic","ero"+"tica","erot"+"icism","org"+"asm","orga"+"smic","gen"+"ital","geni"+"talia","geni"+"tals","pe"+"nis","vag"+"ina","vu"+"lva","nip"+"ple","nip"+"ples","are"+"ola","are"+"olas","top"+"less","botto"+"mless","und"+"ress","undr"+"essed","undre"+"ssing","inter"+"course","ejacu"+"lation","ejacu"+"lating","se"+"men","c"+"um","cum"+"ming","pu"+"ssy","co"+"ck","di"+"ck","anus","an"+"al","fu"+"ck","fuc"+"ked","fuc"+"king","blo"+"wjob","han"+"djob","or"+"gy","bd"+"sm","bon"+"dage","strip"+"tease","stri"+"pping","pu"+"bic","cro"+"tch","gr"+"oin","bre"+"ast","bre"+"asts","bo"+"ob","bo"+"obs","ti"+"ts","a"+"ss","bu"+"tt","bu"+"tts"];
  var SAFE_T2 = ["clea"+"vage","ling"+"erie","bikini","underwear","pan"+"ties","thong","bra","swimsuit","sedu"+"ctive","sedu"+"ction","se"+"xy","sexiness","sen"+"sual","sensu"+"ality","allu"+"ring","provocative","reve"+"aling","see-through","see through","fis"+"hnet","stoc"+"kings","gar"+"ter","cor"+"set","flirtatious","flirty","teasing","tempting","voluptuous","curvaceous","sultry","steamy","negligee","nightwear","chemise","midriff","side"+"boob","unde"+"rboob","downb"+"louse","ups"+"kirt","bodypaint","sh"+"eer","stiletto","miniskirt","booty","curvy","sugge"+"stive","naughty","risque","burlesque","pinup"];
  var SAFE_T1 = ["kiss","kissing","romantic","romance","swimwear","swimming","beach","pool","bedroom","bathtub","hug","hugging","embrace","cuddle"];
  ;function safeHit(text, w) {
    if (w.length <= 5) return (" " + text + " ").indexOf(" " + w + " ") !== -1;
    return text.indexOf(w) !== -1;
  }
  ;function dragonSafeScanTier(prompt) {
    var t = (" " + String(prompt || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim() + " ");
    var i;
    for (i = 0; i < SAFE_T3.length; i++) if (safeHit(t, SAFE_T3[i])) return 3;
    for (i = 0; i < SAFE_T2.length; i++) if (safeHit(t, SAFE_T2[i])) return 2;
    for (i = 0; i < SAFE_T1.length; i++) if (safeHit(t, SAFE_T1[i])) return 1;
    return 0;
  }
  window.dragonSafeScanTier = dragonSafeScanTier;

  // ============================================================================================
  // PRIVATE GALLERY FILTERED-VIEW CONTROL - reveal-all (NO content rating / filter)
  // The vault NEVER filters by content rating: every tile is shown by default. The only content
  // control is reveal/re-blur every filtered tile. State is vault-local and INDEPENDENT from the
  // public gallery (localStorage.dragonVaultRevealAll).
  // ============================================================================================
  ;function vaultFlaggedCss() {
    if (document.getElementById("dragon-vault-flagged-css")) return;
    var s = document.createElement("style");
    s.id = "dragon-vault-flagged-css";
    s.textContent =
      "#localMediaGallery_root [data-local-media-gallery-item].dragon-vault-flagged-blur img," +
      "#localMediaGallery_root [data-local-media-gallery-item].dragon-vault-flagged-blur video{" +
      "filter:blur(26px) brightness(.32) saturate(.35) !important;}";
    document.head.appendChild(s);
  }
  window.dragonVaultFlaggedCss = vaultFlaggedCss;

  ;function vaultRevealAllGet() { try { return localStorage.dragonVaultRevealAll !== "0"; } catch (e) { return true; } }
  ;function vaultRevealAllSet(v) { try { localStorage.dragonVaultRevealAll = v ? "1" : "0"; } catch (e) {} }
  ;function vaultFlaggedState() { return { revealAll: vaultRevealAllGet() }; }
  window.dragonVaultFlaggedState = vaultFlaggedState;

  // Content level of a vault tile: max(stored rating base, prompt safe-scan tier). The safe-scan uses
  // the (lazy) prompt index; while an id is not indexed yet its tier is 0 (conservative: stays visible).
  ;function vaultTileLevel(tl) {
    var id = tl ? tl.getAttribute("data-id") : null;
    var hash = id ? window.dragonHashForVaultId(id) : null;
    var folder = null;
    try { folder = currentVaultFolder(document.getElementById("localMediaGallery_root")); } catch (e) {}
    var base = 0;
    try { var r = hash ? ratingGet(hash, folder) : (folder === "NS"+"FW" ? "none" : "g"); base = (r === "none") ? 3 : (r === "pg13" ? 2 : 0); } catch (e) {}
    var tier = 0;
    try { var pr = window.__dragonVaultPromptIdx ? window.__dragonVaultPromptIdx[id] : undefined; if (pr !== undefined) tier = dragonSafeScanTier(pr); } catch (e) {}
    return Math.max(base, tier);
  }
  window.dragonVaultTileLevel = vaultTileLevel;

  ;function vaultApplyReveal(tl, revealAll) {
    if (!tl) return;
    var hide = false;
    try { hide = (!revealAll) && (vaultTileLevel(tl) >= 3); } catch (e) {}
    try { tl.classList.toggle("dragon-vault-flagged-blur", hide); } catch (e) {}
  }
  window.dragonVaultApplyReveal = vaultApplyReveal;

  ;function dragonVaultSyncFlaggedBtns() {
    var reg = window.__dragonVaultFlaggedBtns;
    if (!reg) return;
    var rev = vaultRevealAllGet();
    if (reg.reveal) {
      try {
        reg.reveal.textContent = rev ? "🙈" : "🫣";
        reg.reveal.style.borderColor = rev ? "#e0244c" : "#6a6a78";
        reg.reveal.style.boxShadow = rev ? "0 0 5px #e0244c" : "none";
        reg.reveal.title = rev ? "Reveal / Re-Blur Every Filtered Image (filtered currently REVEALED)" : "Reveal / Re-Blur Every Filtered Image (filtered currently BLURRED)";
      } catch (e) {}
    }

  }
  window.dragonVaultSyncFlaggedBtns = dragonVaultSyncFlaggedBtns;

  ;function dragonVaultToggleReveal() {
    vaultRevealAllSet(!vaultRevealAllGet());
    var root = document.getElementById("localMediaGallery_root");
    if (root && window.dragonVaultIndexPrompts) { try { window.dragonVaultIndexPrompts(root); } catch (e) {} }
    dragonVaultSyncFlaggedBtns();
    try { if (window.dragonVaultApplyFilter) window.dragonVaultApplyFilter(); } catch (e) {}
    if (typeof dragonToast === "function") dragonToast(vaultRevealAllGet() ? "🫣 all filtered tiles revealed" : "🙈 filtered view blurred");
  }
  window.dragonVaultToggleReveal = dragonVaultToggleReveal;



  ;function dragonVaultBlobCount() {
    return dragonOpenIDB("localMediaGallery_.blobs-db-kv-plugin").then(function (db) {
      return new Promise(function (res) {
        var st = db.transaction(db.objectStoreNames[0], "readonly").objectStore(db.objectStoreNames[0]);
        var r = st.count();
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { res(-1); };
      });
    }).catch(function () { return -1; });
  }
  // 🔍 Egon 16.09.2026 — exported so the floating search can cheaply check whether its cached Likes
  // index is still current (same blob count → reuse).
  window.dragonVaultBlobCount = dragonVaultBlobCount;

  // Special gallery filter view — NOT A SEPARATE WINDOW/OVERLAY. Works like
  // G/PG13/None filters on the parent screen: images matching the selected rating are listed
  // inside the SAME gallery panel, replacing the plugin's own tile grid.
  // ============================================================================================
  // 🏷️ Egon 16.09.2026 — TAG GALLERY WINDOW
  // Clicking any tag in the lightbox (an AI vision tag, one of your "What I Like" tags, or Favorite)
  // opens this modal, which lists ONLY the images that carry that tag — across every folder. Clicking a
  // thumbnail opens the standard lightbox, swiping through just these images. Nothing is modified.
  // ============================================================================================
  var tagGalEl = null;
  ;function closeTagGallery() {
    if (tagGalEl) { try { tagGalEl.remove(); } catch (e) {} tagGalEl = null; }
    try { document.body.style.overflow = ""; } catch (e) {}
  }
  window.dragonTagGalleryClose = closeTagGallery;
  ;function loadTagGalTile(img, id) {
    try {
      var hit = window.dragonVaultUrlGet ? window.dragonVaultUrlGet(String(id)) : null;
      if (hit) { img.src = hit.url; return; }
    } catch (e) {}
    dragonVaultBlobGet(id).then(function (rec) {
      if (!img.isConnected) return;
      var b = null;
      try { if (rec) b = (rec instanceof Blob) ? rec : dragonToBlob(rec); } catch (e) {}
      if (!b) return;
      var u = URL.createObjectURL(b);
      try { if (window.dragonVaultUrlPut) window.dragonVaultUrlPut(String(id), u, b.type || "", b.size || 0); } catch (e) {}
      img.src = u;
    });
  }
  ;function dragonTagGalleryOpen(tagKey, label, emoji) {
    try { closeTagGallery(); } catch (e) {}
    var kind = "like", aiText = null;
    var favId = window.dragonFavTagId || "\u2665fav";
    if (tagKey === favId || tagKey === "__fav__") kind = "fav";
    else if (String(tagKey).indexOf("ai:") === 0) { kind = "ai"; aiText = String(tagKey).slice(3); }
    var ov = document.createElement("div");
    ov.setAttribute("data-dragon-tag-gallery", "1");
    ov.style.cssText = "position:fixed; inset:0; background:rgba(6,6,12,.96); z-index:2147483642; display:flex; flex-direction:column; padding:.6rem; gap:.5rem;";
    var head = document.createElement("div");
    head.style.cssText = "display:flex; align-items:center; gap:.6rem; flex-wrap:wrap; justify-content:center;";
    var titleEl = document.createElement("span");
    titleEl.textContent = (emoji || "\uD83C\uDFF7\uFE0F") + " " + (label || "tag");
    titleEl.style.cssText = "font-weight:bold; color:#ffd76a; font-size:.95rem;";
    var status = document.createElement("span");
    status.style.cssText = "color:#9d9ab5; font-size:.78rem;";
    status.textContent = "reading\u2026";
    var close = document.createElement("button");
    close.type = "button"; close.textContent = "\u2716"; close.title = "Close";
    close.style.cssText = "width:2.2rem; height:2.2rem; border-radius:50%; border:1px solid #ff4d6d; background:linear-gradient(145deg,#5a1018,#2a0a0e); color:#ffb3ba; cursor:pointer; font-size:1.1rem; line-height:1; display:inline-flex; align-items:center; justify-content:center;";
    close.onclick = closeTagGallery;
    head.append(titleEl, status, close);
    var grid = document.createElement("div");
    grid.className = "dragon-vault-inplace";
    grid.style.cssText = "flex:1; min-height:0; overflow:auto; display:flex; flex-wrap:wrap; gap:4px; padding:4px; align-content:flex-start; justify-content:center;";
    ov.append(head, grid);
    ov.addEventListener("pointerdown", function (e) { if (e.target === ov) closeTagGallery(); });
    document.body.appendChild(ov);
    tagGalEl = ov;
    (async function () {
      var folders = {};
      try {
        var dbs = await indexedDB.databases();
        for (var i = 0; i < dbs.length; i++) {
          var nm = dbs[i].name || "";
          if (nm.indexOf("localMediaGallery_.") !== 0 || nm.indexOf("localMediaGallery_..") === 0 || nm.slice(-"-db-kv-plugin".length) !== "-db-kv-plugin" || nm.indexOf("blobs") !== -1) continue;
          folders[nm.slice("localMediaGallery_.".length, -"-db-kv-plugin".length)] = nm;
        }
      } catch (e) {}
      var items = [];
      for (var f in folders) {
        try {
          var db = await dragonOpenIDB(folders[f]);
          var recs = await dragonStoreAll(db);
          db.close();
          for (var j = 0; j < recs.length; j++) {
            var id = String(recs[j].id);
            var hash = window.dragonHashForVaultId ? window.dragonHashForVaultId(id) : null;
            var hit = false;
            if (kind === "ai") {
              var ai = (window.dragonAiTagsGet && hash) ? window.dragonAiTagsGet(hash) : null;
              hit = !!(ai && ai.t && ai.t.indexOf(aiText) !== -1);
            } else if (hash) {
              var rec = dragonTagGet(hash);
              hit = (kind === "fav") ? !!rec.f : (rec.t || []).indexOf(tagKey) !== -1;
            }
            if (!hit) continue;
            items.push({ id: id, folder: f, title: recs[j].title || "", w: recs[j].w || 0, h: recs[j].h || 0 });
          }
        } catch (e) {}
      }
      if (!ov.isConnected) return;
      status.textContent = items.length + " image" + (items.length === 1 ? "" : "s");
      if (!items.length) {
        grid.innerHTML = '<div style="width:100%; text-align:center; color:#9d9ab5; padding:2rem; font-size:.85rem;">no images with this tag yet</div>';
        return;
      }
      // 🐉 System B (Egon 16.09.2026) — results are grouped under their FOLDER HEADINGS (Favorites and
      // general first, then the rest alphabetically); each image keeps opening the standard lightbox.
      var byFolder = {};
      items.forEach(function (item) {
        var f = item.folder || "general";
        (byFolder[f] = byFolder[f] || []).push(item);
      });
      var order = Object.keys(byFolder);
      order.sort(function (a, b) {
        ;function rk(n) { return n === "Favorites" ? 0 : (n === "general" ? 1 : 2); }
        var ra = rk(a), rb = rk(b);
        if (ra !== rb) return ra - rb;
        var la = String(a).toLowerCase(), lb = String(b).toLowerCase();
        return la < lb ? -1 : la > lb ? 1 : 0;
      });
      var frag = document.createDocumentFragment();
      order.forEach(function (fold) {
        var list = byFolder[fold];
        list.sort(function (a, b) {
          var ka = String(a.title || "").toLowerCase(), kb = String(b.title || "").toLowerCase();
          return ka < kb ? -1 : ka > kb ? 1 : 0;
        });
        var head = document.createElement("div");
        head.textContent = (fold === "Favorites" ? "\uD83D\uDC98 " : "\uD83D\uDCC1 ") + fold + "  \u00B7  " + list.length + " image" + (list.length === 1 ? "" : "s");
        head.style.cssText = "width:100%; text-align:center; font-weight:bold; font-size:.78rem; color:#ffd76a; padding:.35rem .2rem .1rem; border-bottom:1px solid rgba(255,215,106,.25); margin-top:.2rem;";
        frag.appendChild(head);
        list.forEach(function (item) {
          var h = 240;
          var w = (item.w && item.h) ? Math.round((item.w / item.h) * h) : h;
          var tile = document.createElement("div");
          tile.setAttribute("data-local-media-gallery-item", "");
          tile.setAttribute("data-id", item.id);
          tile.style.cssText = "flex:0 0 " + w + "px; max-height:" + h + "px; max-width:100%; overflow:hidden; background:light-dark(#ddd,#444); position:relative; cursor:zoom-in;";
          var img = document.createElement("img");
          img.style.cssText = "width:100%; height:100%; object-fit:cover; display:block;";
          img.onclick = function () { try { if (window.dragonVaultOpenLightbox) window.dragonVaultOpenLightbox(img); } catch (e) {} };
          tile.appendChild(img);
          frag.appendChild(tile);
          loadTagGalTile(img, item.id);
        });
      });
      grid.appendChild(frag);
    })();
  }
  window.dragonTagGalleryOpen = dragonTagGalleryOpen;

  // Egon 16.09.2026 — "All images" is now ONE opaque window under the toolbar (twin of the floating
  // search results window): the plugin's own folder grid is hidden (.dragon-vault-allmode) so there are
  // never two galleries at once, images are laid out as tiles in the active private display mode, and the
  // whole window collapses to its title bar. There is no per-image collapse panel any more.
  ;function dragonVaultAllWinCss() {
    if (document.getElementById("dragonVaultAllWinCss")) return;
    var st = document.createElement("style");
    st.id = "dragonVaultAllWinCss";
    st.textContent = [
      // the !important flex rule on .dragon-vault-grid must be beaten while All images is open
      "#localMediaGallery_root.dragon-vault-allmode .dragon-vault-grid{display:none !important;}",
      "#localMediaGallery_root .dragon-vault-inplace.dragon-vault-allwin{flex:1 1 auto; min-height:0; display:flex; flex-direction:column; background:#000 !important;}",
      "#localMediaGallery_root .dragon-vault-inplace.dragon-vault-allwin .dragon-vault-allwin-bar{display:flex; align-items:center; justify-content:center; gap:.5rem; flex-wrap:wrap; padding:.4rem .6rem; border-bottom:1px solid #26262e; background:#050506; color:#ffd76a; font-size:.82rem; font-weight:bold; cursor:pointer; user-select:none; letter-spacing:.02em;}",
      "#localMediaGallery_root .dragon-vault-inplace.dragon-vault-allwin .dragon-vault-allwin-hint{font-weight:normal; color:#7a7a8a; font-size:.68rem;}",
      "#localMediaGallery_root .dragon-vault-inplace.dragon-vault-allwin .dragon-vault-allwin-status{color:#9d9ab5; font-weight:normal; font-size:.74rem;}",
      "#localMediaGallery_root .dragon-vault-inplace.dragon-vault-allwin .dragon-vault-inplace-list.dragon-vault-allwin-list{flex:1 1 auto; width:100%; min-height:0; overflow:auto; display:flex; flex-direction:row; flex-wrap:wrap; align-items:flex-start; align-content:flex-start; justify-content:flex-start; gap:4px; padding:6px 6px 40px; background:#000;}",
      "#localMediaGallery_root .dragon-vault-allwin .dragon-vault-allwin-tile{position:relative; overflow:hidden; background:#0c0c10; cursor:zoom-in; flex:0 0 auto;}",
      "#localMediaGallery_root .dragon-vault-allwin .dragon-vault-allwin-tile img{display:block; width:100%; height:100%; object-fit:cover;}",
      "#localMediaGallery_root .dragon-vault-inplace-list.dragon-allwin-dm-original .dragon-vault-allwin-tile img,",
      "#localMediaGallery_root .dragon-vault-inplace-list.dragon-allwin-dm-contain .dragon-vault-allwin-tile img{object-fit:contain; background:#08080c;}",
      "#localMediaGallery_root .dragon-vault-inplace.dragon-vault-allwin.dragon-vault-allwin-collapsed .dragon-vault-allwin-list{display:none;}",
      "@media(max-width:640px){ #localMediaGallery_root .dragon-vault-allwin .dragon-vault-allwin-tile{max-width:46vw;} }"
    ].join("\n");
    document.head.appendChild(st);
  }
  window.dragonVaultAllWinCss = dragonVaultAllWinCss;

  ;function openVaultOverlay(allMode) {
    closeVaultOverlay();
    window.__dragonVaultAllMode = !!allMode;
    var root = document.getElementById("localMediaGallery_root");
    if (!root) return;
    dragonVaultAllWinCss();
    root.classList.add("dragon-vault-allmode");
    var pg = dragonPluginGrid(root);
    if (pg) pg.style.display = "none";
    var wrap = document.createElement("div");
    wrap.className = "dragon-vault-inplace dragon-vault-allwin";
    var bar = document.createElement("div");
    bar.className = "dragon-vault-inplace-bar dragon-vault-allwin-bar";
    bar.title = "Click the title to collapse / expand this window";
    var title = document.createElement("span");
    title.className = "dragon-vault-inplace-title dragon-vault-allwin-title";
    title.textContent = allMode ? "\uD83D\uDDBC All images" : "\uD83D\uDDBC Filtered";
    var status = document.createElement("span");
    status.className = "dragon-vault-allwin-status";
    status.textContent = "\u2026";
    var hint = document.createElement("span");
    hint.className = "dragon-vault-allwin-hint";
    hint.textContent = "\u25BC click the title to collapse \u25BC";
    var grid = document.createElement("div");
    grid.className = "dragon-vault-inplace-list dragon-vault-allwin-list";
    bar.append(title, status, hint);
    // Egon 16.09.2026 — clicking the title bar collapses this window to just its title. Collapsing is a
    // FOLDER-level action (one window = one folder listing), never per image.
    bar.onclick = function (e) {
      e.stopPropagation();
      wrap.classList.toggle("dragon-vault-allwin-collapsed");
    };
    wrap.append(bar, grid);
    root.appendChild(wrap);
    overlayEl = wrap;
    overlayStatusEl = status;
    // \uD83D\uDCC9 Egon 16.09.2026 — as the user scrolls this list DOWN the private toolbar shrinks
    // (counter + tag/twin rows hidden, padding tightened); it grows back at the top. The folder menu
    // stays reachable in the shrunken toolbar.
    overlayOnScroll = function () {
      try {
        var hdr = root.querySelector(".dragon-vault-header-bar");
        if (hdr) hdr.classList.toggle("dragon-vault-shrunk", grid.scrollTop > 60);
      } catch (e) {}
    };
    grid.addEventListener("scroll", function () { overlayOnScroll(); overlayLoadMore(grid); }, { passive: true });
    overlayPumpTimer = setInterval(function () {
      if (!overlayEl || !overlayEl.isConnected) { closeVaultOverlay(); return; }
      overlayLoadMore(grid);
    }, 600);
    loadOverlayItems(grid, status);
  }

  ;function loadOverlayTile(tile, id) {
    if (!tile || tile._loaded) return;
    tile._loaded = true;
    // \u26A1 Egon 16.09.2026 — panels own their own (lazy) loader; the persistent id \u2192 blob URL cache is
    // still used inside it, so nothing is read twice.
    if (typeof tile.dzLoad === "function") { try { tile.dzLoad(); } catch (e) {} return; }
    try {
      var _hit = window.dragonVaultUrlGet ? window.dragonVaultUrlGet(String(id)) : null;
      if (_hit) { var _hi = tile.querySelector("img"); if (_hi) _hi.src = _hit.url; return; }
    } catch (e) {}
    dragonVaultBlobGet(id).then(function (rec) {
      if (!tile.isConnected) return;
      var b = null;
      try { if (rec) b = (rec instanceof Blob) ? rec : dragonToBlob(rec); } catch (e) {}
      if (!b) return;
      var u = URL.createObjectURL(b);
      try { if (window.dragonVaultUrlPut) window.dragonVaultUrlPut(String(id), u, b.type, b.size || 0); else overlayTrackUrl(u); } catch (e) { overlayTrackUrl(u); }
      var img = tile.querySelector("img");
      if (img) img.src = u;
    }).catch(function () {});
  }

  // Only panels near the screen (visible area + 1100px) are loaded, max 24 per turn.
  ;function overlayLoadMore(grid) {
    if (!grid || !grid.isConnected) return;
    var tiles = grid.querySelectorAll("[data-oid]");
    var limit = grid.getBoundingClientRect().bottom + 1100;
    var batch = 0;
    while (overlayNext < overlayItems.length && batch < 24) {
      var tile = tiles[overlayNext];
      if (!tile) { overlayNext++; continue; }
      if (tile.getBoundingClientRect().top > limit) break;
      loadOverlayTile(tile, overlayItems[overlayNext].id);
      overlayNext++;
      batch++;
    }
    if (overlayNext >= overlayItems.length && overlayStatusEl) overlayStatusEl.textContent = overlayItems.length + " images";
  }

  ;function dragonVaultSortItems(items) {
    var v = vaultSortSel ? vaultSortSel.value : "dateDesc";
    items.sort(function (a, b) {
      if (v === "dateAsc") return (a.date || 0) - (b.date || 0);
      if (v === "ratingDesc") return (b.rating || 0) - (a.rating || 0);
      if (v === "ratingAsc") return (a.rating || 0) - (b.rating || 0);
      if (v === "azPrompt" || v === "azTags") {
        var ka = String(a.title || "").toLowerCase(), kb = String(b.title || "").toLowerCase();
        return ka < kb ? -1 : ka > kb ? 1 : 0;
      }
      return (b.date || 0) - (a.date || 0);
    });
    return items;
  }

  ;async function loadOverlayItems(grid, statusEl) {
    grid.innerHTML = '<div style="width:100%; text-align:center; color:#9d9ab5; padding:2rem; font-size:.85rem;">reading your Likes\u2026</div>';
    var items = [];
    var folders = {};
    try {
      var dbs = await indexedDB.databases();
      for (var i = 0; i < dbs.length; i++) {
        var nm = dbs[i].name || "";
        if (nm.indexOf("localMediaGallery_.") !== 0 || nm.indexOf("localMediaGallery_..") === 0 || nm.slice(-"-db-kv-plugin".length) !== "-db-kv-plugin" || nm.indexOf("blobs") !== -1) continue;
        folders[nm.slice("localMediaGallery_.".length, -"-db-kv-plugin".length)] = nm;
      }
    } catch (e) {}
    for (var f in folders) {
      try {
        var db = await dragonOpenIDB(folders[f]);
        var recs = await dragonStoreAll(db);
        db.close();
        for (var j = 0; j < recs.length; j++) {
          var id = String(recs[j].id);
          var hash = window.dragonHashForVaultId(id);
          var recT = hash ? dragonTagGet(hash) : { t: [], f: false };
          var okT = true;
          for (var k = 0; k < vaultState.tags.length; k++) {
            var tg = vaultState.tags[k];
            if (tg === FAV_ID) { if (!recT.f) { okT = false; break; } }
            else if (recT.t.indexOf(tg) === -1) { okT = false; break; }
          }
          if (!okT) continue;
          items.push({ id: id, folder: f, title: recs[j].title || "", w: recs[j].w || 0, h: recs[j].h || 0, date: recs[j].date || 0, rating: recs[j].rating || 0 });
        }
      } catch (e) {}
    }
    if (!grid.isConnected) return;
    dragonVaultSortItems(items);
    grid.innerHTML = "";
    if (!items.length) {
      grid.innerHTML = '<div style="width:100%; text-align:center; color:#9d9ab5; padding:2rem; font-size:.85rem;">no images match this filter</div>';
      if (statusEl) statusEl.textContent = "0 images";
      return;
    }
    // \uD83E\uDDEC Egon 16.09.2026 — duplicate count per item (same prompt inside THIS list) so the "\u00D7N"
    // dedupe badge is visible in the "All images" view too.
    var dupeMap = {};
    for (var di = 0; di < items.length; di++) {
      var dk = window.dragonImgPanelNormKey ? window.dragonImgPanelNormKey(items[di].title) : "";
      if (dk) dupeMap[dk] = (dupeMap[dk] || 0) + 1;
    }
    overlayItems = items;
    overlayNext = 0;
    if (statusEl) statusEl.textContent = items.length + " images";
    var dm = (window.dragonVaultDisplayMode ? dragonVaultDisplayMode() : "default");
    grid.classList.add("dragon-allwin-dm-" + dm);
    var S = 200;
    try { if (window.dragonTileVaultH) S = window.dragonTileVaultH(); } catch (e) {}
    var frag = document.createDocumentFragment();
    for (var it = 0; it < items.length; it++) {
      var item = items[it];
      var tile = document.createElement("div");
      tile.className = "dragon-vault-allwin-tile";
      tile.setAttribute("data-oid", String(item.id));
      tile.setAttribute("data-id", String(item.id));
      if (item.folder) tile.setAttribute("data-folder", item.folder);
      var iw = Number(item.w) || 0, ih = Number(item.h) || 0;
      var iRatio = (iw > 0 && ih > 0) ? Math.max(0.2, Math.min(5, iw / ih)) : 1;
      tile.style.width = S + "px";
      tile.style.aspectRatio = ((dm === "cover" || dm === "default" || dm === "contain") ? "1 / 1" : iRatio.toFixed(4) + " / 1");
      var timg = document.createElement("img");
      timg.decoding = "async"; timg.alt = ""; timg.loading = "lazy";
      timg.onclick = function () { try { if (window.dragonVaultOpenLightbox) window.dragonVaultOpenLightbox(this); } catch (e) {} };
      tile.appendChild(timg);
      frag.appendChild(tile);
    }
    grid.appendChild(frag);
    overlayLoadMore(grid);
  }
  ;(function init() {
    // ⚡ Egon 13.09.2026 — expose the enhancer + grid helper so the show() wrapper can build the
    // private gallery toolbar SYNCHRONOUSLY (before first paint) instead of via a body observer.
    try { window.dragonVaultEnhance = dragonVaultEnhance; } catch (e) {}
    try { window.dragonPluginGrid = dragonPluginGrid; } catch (e) {}
    dragonBodyObserve(function () {
      if (document.getElementById("localMediaGallery_root")) dragonVaultEnhance();
    });
  })();
})();
