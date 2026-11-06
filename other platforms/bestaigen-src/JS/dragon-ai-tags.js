/* ============================================================================
   BestAiGen — AI Tags
   ----------------------------------------------------------------------------
   A vision model looks at a saved (private-gallery / "Likes") image and returns
   a handful of short visual tags. They are drawn as BLUE chips in the lightbox
   tag row and as a small badge on the tile. They are deliberately SEPARATE from
   the owner's own "What I Like" tags: those are personal picks and stay RED when
   selected, while the machine tags are blue and nobody's judgement. Tags are
   cached per image hash in localStorage. NEW POLICY (Egon 29.09.2026): tags are generated
   ONCE, at the moment the image enters the private gallery (the save functions in
   dragon-app-core call dragonAiTagOne with the already-fetched blob — no second
   download). The lightbox NO LONGER triggers generation for public-gallery images
   (their row is hidden anyway; generating for them only burned vision calls).
   Vault images saved before this policy still get tagged on first lightbox open
   (fallback, vid-gated). Tags are drawn ONLY as BLUE chips in the lightbox tag
   row — never on tiles (the old tile badge is gone).
   BURST COVER (Egon 29.09.2026): rapid liking is burst-guarded (max 2 vision calls in
   flight — overflow is skipped, never queued) and a background sweeper silently tags
   whatever slipped through (skipped / failed with backoff retry / never opened), one
   image at a time, idle-paced.
   window (every image the vision model gave that same tag). The old manual
   "regenerate" button was removed on 2026-09-16 (parked in Librarybook.enc).

   Public hooks (all on window):
     dragonAiTagsGet(hash)                -> {t: [tags], ts, pending, failed} | null
     dragonAiTagOne(hash, item)           -> generates tags for one image (save-time call passes
                                          {blob, vid}; lightbox fallback passes {url, vid})
     dragonLbTagsExtend(row, hash, item)  -> lightbox tag-row hook (called by index.html)
   No secrets and no personal data are stored here; everything is per-user, local.
   ========================================================================== */
(function () {
  "use strict";

  var LS_TAGS = "dragonAiTags";        // { "<hash>": { t:[...], ts, pending, failed } }
  var LS_TAGS_ON = "dragonAiTagsOn";   // "0" disables the lazy auto-tagging
  var DEBUG = false;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function ensureCss() {
    if (document.getElementById("dragonAiTagsCss")) return;
    var s = document.createElement("style");
    s.id = "dragonAiTagsCss";
    s.textContent =
      ".dragon-ai-chip{display:inline-flex; align-items:center; gap:.24rem; padding:.28rem .5rem; font-size:.7rem; border-radius:999px; border:1px solid #3d7ddc; background:linear-gradient(180deg,#12233c,#0a1421); color:#9cc7ff; white-space:nowrap;}" +
      ".dragon-ai-chip.regen{cursor:pointer; border-style:dashed; color:#cfe3ff;}" +
      ".dragon-ai-sep{width:1px; height:1.2rem; background:rgba(255,255,255,.18); margin:0 .15rem;}" +
      ".dgt-spin{display:inline-block; width:14px; height:14px; border-radius:50%; border:2px solid rgba(255,255,255,.25); border-top-color:#c9b4ff; animation:dgtspin .8s linear infinite; vertical-align:-2px;}" +
      "@keyframes dgtspin{to{transform:rotate(360deg);}}";
    document.head.appendChild(s);
  }

  /* --------------------------------------------------------------- store */
  function tagsStore() {
    var o = {};
    try { o = JSON.parse(lsGet(LS_TAGS) || "{}") || {}; } catch (e) { o = {}; }
    return o;
  }
  function tagsSave(o) {
    try { lsSet(LS_TAGS, JSON.stringify(o)); } catch (e) {}
  }
  window.dragonAiTagsGet = function (hash) {
    if (!hash) return null;
    var rec = tagsStore()[String(hash)];
    return rec || null;
  };
  window.dragonAiTagsEnabled = function () { return lsGet(LS_TAGS_ON) !== "0"; };
  window.dragonAiTagsSetEnabled = function (on) { lsSet(LS_TAGS_ON, on ? "1" : "0"); };

  // Egon 29.09.2026 — ONE-TIME PRUNE: until today the lightbox also tagged public-gallery images
  // (hidden row, never shown), leaving 1000+ orphan records per browser. Keep an AI record only if
  // its hash still belongs to a vault folder (hash list or id map) or the user touched it
  // (What-I-Like tags / favorite in dragonTagMap — e.g. records a folder repair may re-home later).
  // Everything else is regenerated instruction output, safe to drop. Runs once per browser.
  (function aiTagsPruneOnce() {
    try {
      if (lsGet("dragonAiTagsPruned29") === "1") return;
      var ai = tagsStore();
      var keys = Object.keys(ai);
      var keep = {};
      try {
        var idx = JSON.parse(localStorage.getItem("dragonStarIdx") || "{}") || {};
        Object.keys(idx).forEach(function (f) { (idx[f] || []).forEach(function (h) { keep[String(h)] = 1; }); });
        var ids = JSON.parse(localStorage.getItem("dragonStarIds") || "{}") || {};
        Object.keys(ids).forEach(function (f) { var m = ids[f] || {}; Object.keys(m).forEach(function (h) { keep[String(h)] = 1; }); });
        var tm = JSON.parse(localStorage.getItem("dragonTagMap") || "{}") || {};
        Object.keys(tm).forEach(function (h) {
          var r = tm[h] || {};
          if ((r.t && r.t.length) || r.f || (r.tt && r.tt.length)) keep[String(h)] = 1;
        });
      } catch (e) {}
      var n = 0;
      keys.forEach(function (k) { if (!keep[k]) { delete ai[k]; n++; } });
      if (n) tagsSave(ai);
      lsSet("dragonAiTagsPruned29", "1");
    } catch (e) {}
  })();

  function cleanTag(s) {
    s = String(s || "").trim().replace(/^[\s"'\-*#\d.]+/, "").replace(/[."']+$/, "").trim();
    if (s.length > 24) s = s.slice(0, 24);
    return s.toLowerCase();
  }
  async function blobFor(hash, item) {
    try {
      if (item && item.blob instanceof Blob) {
        if (String(item.blob.type || "").indexOf("video") === 0) return null;
        return item.blob;
      }
      if (item && item.vid != null) {
        var rec = await window.dragonVaultBlobGet(item.vid);
        var b = rec ? ((rec instanceof Blob) ? rec : window.dragonToBlob(rec)) : null;
        if (b) return b;
      }
      if (item && item.url && String(item.url).indexOf("blob:") === 0) {
        return await fetch(item.url).then(function (r) { return r.blob(); });
      }
      if (item && item.url) {
        var r = await fetch(item.url);
        if (r.ok) return await r.blob();
      }
    } catch (e) {}
    return null;
  }
  var _tagging = {};
  window.dragonAiTagOne = async function (hash, item) {
    hash = String(hash || "");
    if (!hash) return null;
    if (_tagging[hash]) return _tagging[hash];
    if (!window.root || typeof window.root.generateText !== "function") return null;
    var store = tagsStore();
    store[hash] = Object.assign({}, store[hash] || {}, { pending: true, failed: false });
    tagsSave(store);
    try { if (window.dragonLbTagsRefresh) window.dragonLbTagsRefresh(hash); } catch (e) {}
    _tagging[hash] = (async function () {
      var blob = await blobFor(hash, item);
      var tags = [];
      if (blob) {
        try {
          var out = "";
          var g = window.root.generateText({
            instruction: [
              "Look at this image and list 6 to 10 short visual tags that describe what is literally visible: subject, pose, clothing, setting, colours, lighting, mood, art style. " +
              "Output ONLY the tags, separated by commas, all lowercase, one to three words each. No sentences, no numbering, no explanation.",
              blob
            ],
            onChunk: function (d) { if (d && d.textChunk) out += d.textChunk; }
          });
          var fin = await Promise.resolve(g);
          if (fin && typeof fin === "object" && fin.text) out = fin.text;
          else if (typeof fin === "string" && fin) out = fin;
          var seen = {};
          String(out || "").split(/[,\n]/).forEach(function (p) {
            var t = cleanTag(p);
            if (!t || t.length < 2 || t.length > 24 || seen[t]) return;
            if (/^(tags?|image|photo|picture|the|a|an)$/.test(t)) return;
            seen[t] = 1; tags.push(t);
          });
          if (tags.length > 12) tags = tags.slice(0, 12);
        } catch (e) { DEBUG && console.log("[ai-tags] tag fail", e); }
      }
      store = tagsStore();
      var prev = store[hash] || {};
      if (tags.length) { store[hash] = { t: tags, ts: Date.now() }; }
      else {
        // Egon 29.09.2026 — failures carry a retry timestamp (10min, doubling, max 24h) so the
        // background sweeper retries burst victims instead of sealing them `failed` forever.
        var fa = (prev.fa || 0) + 1;
        store[hash] = { t: (prev.t || []), ts: prev.ts || 0, failed: true, fa: fa, fr: Date.now() + Math.min(86400000, 600000 * Math.pow(2, fa - 1)) };
      }
      tagsSave(store);
      delete _tagging[hash];
      try { if (window.dragonLbTagsRefresh) window.dragonLbTagsRefresh(hash); } catch (e) {}
      return tags;
    })();
    return _tagging[hash];
  };

  // Egon 29.09.2026 — BURST GUARD: at most 2 vision calls in flight. Anything beyond that returns
  // null and is left to the background sweeper below — so rapid liking never piles up generations.
  var AITAG_MAX_FLY = 2;
  window.dragonAiTagMaybe = function (hash, item) {
    hash = String(hash || "");
    if (!hash) return null;
    if (_tagging[hash]) return _tagging[hash];
    if (Object.keys(_tagging).length >= AITAG_MAX_FLY) return null;
    try { return window.dragonAiTagOne(hash, item); } catch (e) { return null; }
  };

  // Egon 29.09.2026 — BACKGROUND SWEEPER: silently tags vault images that slipped through
  // (burst-skipped at save time, never opened in the lightbox, failed, or stuck `pending` from a
  // reload mid-tagging). One image at a time, idle-paced, never more than the burst limit in
  // flight — it cannot slow the user down. Videos and repeated failures back off automatically
  // via the fr timestamp above, so nothing is retried in a loop.
  function sweepDue(hash, rec) {
    if (!rec) return true;
    if (rec.t && rec.t.length) return false;
    if (rec.pending) return !_tagging[hash];
    if (rec.failed) return !rec.fr || Date.now() >= rec.fr;
    return true;
  }
  var _sweepBusy = false, _sweepTimer = null;
  function sweepLater(ms) {
    if (_sweepTimer) return;
    _sweepTimer = setTimeout(function () { _sweepTimer = null; dragonAiTagSweepStep(); }, (ms == null) ? 8000 : ms);
  }
  window.dragonAiTagSweep = function () { sweepLater(500); };
  async function dragonAiTagSweepStep() {
    if (_sweepBusy) { sweepLater(); return; }
    try {
      if (!window.dragonAiTagsEnabled()) { sweepLater(60000); return; }
      if (!window.root || typeof window.root.generateText !== "function") { sweepLater(60000); return; }
      if (Object.keys(_tagging).length >= AITAG_MAX_FLY) { sweepLater(); return; }
      var ids = {};
      try { ids = window.dragonStarIdsGet ? window.dragonStarIdsGet() : JSON.parse(localStorage.dragonStarIds || "{}"); } catch (e) { ids = {}; }
      // Favorites first — those tags drive the What I Like menu, so they jump the queue.
      var fl = Object.keys(ids);
      fl.sort(function (a, b) { return ((a === "Favorites") ? 0 : 1) - ((b === "Favorites") ? 0 : 1); });
      var byHash = {};
      fl.forEach(function (f) {
        var m = ids[f] || {};
        Object.keys(m).forEach(function (h) { if (!byHash[h]) byHash[h] = String(m[h]); });
      });
      var target = null;
      var hashes = Object.keys(byHash);
      for (var i = 0; i < hashes.length; i++) {
        var h = hashes[i];
        if (_tagging[h]) continue;
        if (sweepDue(h, window.dragonAiTagsGet(h))) { target = h; break; }
      }
      if (!target) return;
      _sweepBusy = true;
      try { await window.dragonAiTagOne(target, { vid: byHash[target] }); } catch (e) {}
      _sweepBusy = false;
      sweepLater();
    } catch (e) { _sweepBusy = false; sweepLater(30000); }
  }
  setTimeout(function () { sweepLater(50); }, 30000);

  function aiChips(container, hash, item, opts) {
    var rec = window.dragonAiTagsGet(hash);
    var chips = [];
    if (rec && rec.pending) {
      var sp = document.createElement("span");
      sp.className = "dragon-ai-chip";
      sp.innerHTML = '<span class="dgt-spin" style="width:10px;height:10px;border-width:2px"></span> tagging\u2026';
      chips.push(sp);
    } else if (rec && rec.t && rec.t.length) {
      rec.t.forEach(function (t) {
        var c = document.createElement("span");
        c.className = "dragon-ai-chip";
        c.textContent = t;
        // Egon 16.09.2026 — AI tags are clickable too: a chip opens the tag gallery listing every image
        // the vision model described with this same tag.
        c.style.cursor = "pointer";
        c.title = "AI tag \u2014 tap to see every image tagged \u201C" + t + "\u201D by the AI";
        c.onclick = function (e) {
          e.stopPropagation();
          try { if (window.dragonLightboxClose) window.dragonLightboxClose(); } catch (e2) {}
          try { if (window.dragonTagGalleryOpen) window.dragonTagGalleryOpen("ai:" + t, t, "\uD83E\uDD16"); } catch (e3) {}
        };
        chips.push(c);
      });
    }
    // The "\u21BB AI tags" regenerate button was removed (Egon 16.09.2026): tagging already runs
    // automatically the first time an image is opened, so a manual re-tag button was redundant.
    // The removed block is parked in Librarybook.enc ("PARKED CODE (DEPO)") per rule I62.
    return chips;
  }

  // index.html calls this at the end of renderLbTags()
  window.dragonLbTagsExtend = function (tagRow, hash, item) {
    if (!tagRow) return;
    var old = tagRow.querySelectorAll(".dragon-ai-chip, .dragon-ai-sep");
    for (var i = 0; i < old.length; i++) old[i].remove();
    if (!hash) return;
    ensureCss();
    var sep = document.createElement("span");
    sep.className = "dragon-ai-sep";
    tagRow.appendChild(sep);
    var chips = aiChips(tagRow, hash, item, { showRegen: true });
    chips.forEach(function (c) { tagRow.appendChild(c); });
    // Egon 29.09.2026 — generation fires ONLY for vault images (item.vid set): at save time the
    // image is tagged with its blob, and pre-policy vault images are tagged on first lightbox
    // open (fallback). Public-gallery images (no vid) NEVER trigger generation — their row is
    // hidden anyway, so tagging them only burned vision calls (~1300 orphan records did exactly that).
    var rec = window.dragonAiTagsGet(hash);
    var isVault = !!(item && item.vid != null);
    if (isVault && window.dragonAiTagsEnabled() && !rec && !_tagging[hash]) {
      try { (window.dragonAiTagMaybe || window.dragonAiTagOne)(hash, item); } catch (e) {}
    }
  };

  // Egon 29.09.2026 — tile badges are GONE by policy: AI tags show ONLY in the lightbox,
  // never on tiles. The old dragonVaultTileTags badge builder was removed here, and its stale-badge
  // remover in dragonVaultDecorateItems (dragon-tag-system.js) went with it.
})();
