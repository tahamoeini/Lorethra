// ============================================================================
// ⭐ PICTURE LIKES (dragon-likes) — Egon 23.09.2026
// ----------------------------------------------------------------------------
// Egon: "what i want is for every image liked in our public gallery ... when the liked button is
// pressed, it gets a like score (stored on server) and then sorted by this score. just like the
// likes dislikes system we wanted to establish before."
//
// So the ⭐ button ("Save To Likes" / its unstar twin) now casts ONE durable vote per visitor into the
// generator's own server state (see the PICTURE LIKES region in the server script inside index.html):
//   * one visitor = one point, however often they press the star (the server hashes the same
//     per-browser id the comments use, and a vote that changes nothing writes nothing),
//   * the gallery's ⭐ Liked image sort filters on the SERVER count and ranks by it (most liked first),
//   * every public-gallery tile carries a small ⭐ N chip, so the number is visible while browsing.
// Votes cast before this build do not exist (nothing was counted then) — the count starts with the
// first star press that goes through this code.
//
// Exposed on `window`:
//   dragonLikeVote(url, up)      cast / take back this visitor's vote for a picture (fire and forget)
//   dragonLikeCountOf(url)       the cached count (-1 = not known yet)
//   dragonLikePrefetch([urls])   fill the cache for a slice of pictures (the ⭐ Liked sort uses this)
//   dragonLikeBadges(scopeEl)    (re)draw the ⭐ N chip on every public-gallery tile inside `scopeEl`
//   dragonLikeKey(url)           the key a picture is counted under
//   dragonLikeRepaint(url)       repaint the tiles that show this picture
// ============================================================================
(function () {
  var BADGE_TTL = 60000;
  var MAXQ = 300;
  var counts = {};
  var countsAt = {};
  var fetchTok = 0;
  var pending = null;
  var gen = 0;              // bumped by dragonLikeForget: a reply from before the wipe is ignored
  // Every tile the ⭐ chip may sit on (gallery tiles).
  var TILE_SEL = ".dragon-gal-tile";

  // The key a picture is counted under. It is the SAME hash the star system already uses to remember a
  // save, so a like and a save can never disagree about which picture they mean, and the key is short
  // (the server hashes it again on arrival — no raw url ever reaches the durable region).
  function keyOf(url) {
    var s = String(url == null ? "" : url).trim();
    if (!s) return "";
    var k = s;
    try { if (window.dragonStarHash) k = String(window.dragonStarHash(s)); } catch (e) { k = s; }
    try { urlMapNote(k, s); } catch (e) {}   // W-LIKEDFAST: every seen url feeds the top→url map
    return k;
  }
  window.dragonLikeKey = keyOf;

  function myUid() {
    try { if (window.dragonCommentUid) return window.dragonCommentUid(); } catch (e) {}
    return "";
  }

  // ONE socket and ONE rpc path for all server traffic (the comment module owns both — rule I104).
  function rpc(method, data) {
    if (window.dragonServerRpc) return window.dragonServerRpc(method, data);
    return window.dragonSharedSocket().then(function (s) { return s.rpc[method](data === undefined ? "" : data); });
  }

  window.dragonLikeCountOf = function (url) {
    return countKnown(keyOf(url));
  };

  // Cast one vote. The badge and the ⭐ Liked ranking move the moment the visitor presses (optimistic),
  // and the server's answer always wins afterwards, so a lost reply can never make the count drift.
  window.dragonLikeVote = function (url, up) {
    var k = keyOf(url);
    if (!k) return;
    var want = up ? 1 : 0;
    var known = countsAt[k] !== undefined;
    if (known) counts[k] = want ? (counts[k] | 0) + 1 : Math.max(0, (counts[k] | 0) - 1);
    countsAt[k] = Date.now();
    repaint(k);
    // W-GALTOP: the vote carries its context (url+gallery+rating) so the server can maintain that
    // gallery's top lists. Overlong urls ride count-only (a truncated url must never be stored).
    var payload = { i: k, u: myUid(), d: want };
    try {
      var ctx = window.__dragonGalCtx ? window.__dragonGalCtx() : null;
      var us = String(url == null ? "" : url);
      if (ctx && ctx.gen && us && us.length <= 100) {
        payload.l = us; payload.g = String(ctx.gen).slice(0, 32); payload.r = ctx.rating | 0;
      }
      // Egon 16.10.2026 (listing truth): the vote teaches the picture's listing rating (learned
      // from the listing node by the walk) so a none-context vote on a G picture ranks it in G.
      try {
        if (typeof urlMapInit === "function") urlMapInit();
        var _qt = window.dragonLikeServerTag ? window.dragonLikeServerTag(k) : null;
        var _qe = (_qt && urlMap) ? urlMap[_qt] : null;
        if (_qe && (_qe.lr === 0 || _qe.lr === 2)) payload.q = _qe.lr;
      } catch (eQ) {}
    } catch (eC) {}
    rpc("dragonLikeVote", JSON.stringify(payload)).then(function (raw) {
      var d = null;
      try { d = JSON.parse(raw); } catch (e) { d = null; }
      if (!d || !d.ok) {
        // refused (rate limit / no storage): drop our guess and ask the server for the truth again
        delete countsAt[k];
        window.dragonLikePrefetch([url]);
        return;
      }
      counts[k] = d.c | 0;
      countsAt[k] = Date.now();
      try { topList = null; topAt = 0; } catch (eTop) {}   // W-LIKEDSORT: own vote reshuffles the ranking
      try { galTopCache = {}; } catch (eGT) {}            // W-GALTOP: own vote reshuffles the maintained top too
      repaint(k);
    }).catch(function () {});
  };

  // ⭐ READ-ONLY LEDGER DIAGNOSTIC (Egon 23.09.2026, see the LIKES PERMANENT LEDGER block in the server
  // script): the two copies of the like log and the never-cleared repair log. It writes nothing and casts
  // no vote, so it is safe to call on production;
  // check-up's `likes-ledger` test is the one that uses it.
  window.dragonLikesDiag = function () {
    return Promise.resolve(rpc("dragonLikesDiag")).then(function (raw) {
      var d = null;
      if (typeof raw === "string") { try { d = JSON.parse(raw); } catch (e) { return null; } }
      else d = raw || null;
      // The server reports warming while a post-rebuild scan is still slicing: not a failure,
      // the check-up loop already sleeps and retries, and each retry advances the slices.
      if (!d || d.warming) return null;
      return d;
    }).catch(function () { return null; });
  };

  window.dragonLikePrefetch = function (urls) {
    var want = [], now = Date.now();
    for (var i = 0; i < (urls || []).length; i++) {
      var k = keyOf(urls[i]);
      if (!k) continue;
      if (countsAt[k] !== undefined && now - countsAt[k] <= BADGE_TTL) continue;
      // W-LIKEDSORT: a freshly top-seeded tag answers too — no per-slice RPC for ranked pictures
      var tk = null;
      try { tk = window.dragonLikeServerTag(k); } catch (e) { tk = null; }
      if (tk && countsAt[tk] !== undefined && now - countsAt[tk] <= BADGE_TTL) continue;
      if (want.indexOf(k) === -1) want.push(k);
    }
    if (!want.length) return Promise.resolve(true);
    if (want.length > MAXQ) want = want.slice(0, MAXQ);
    rememberKeys(want);
    var g = gen;
    var body = want.join(",");
    return rpc("dragonLikeCounts", body).then(function (raw) {
      if (g !== gen) return false;                     // the cache was wiped while this answer was in flight
      var d = null;
      try { d = JSON.parse(raw); } catch (e) { d = null; }
      want.forEach(function (k) { counts[k] = (d && d[k]) ? (d[k] | 0) : 0; countsAt[k] = Date.now(); });
      return true;
    }, function () {
      if (g !== gen) return false;
      // Faz-2/A9: a failed lookup stays UNKNOWN (no write — old value and old stamp kept). A transport
      // failure must never masquerade as a fresh confirmed zero. Tiles already render unknown (the
      // pre-first-prefetch state), and the next eligible prefetch re-asks since the stamp never advanced.
      // 🧯 Egon 29.10.2026: report the miss (false) so paintSlice backs off instead of tight-looping.
      return false;
    });
  };

  // 🏆 GLOBAL TOP-1000 (W-LIKEDSORT, Egon 10.10.2026) — the server's ranking, most-liked first.
  // The old client sorted page-by-page (each page right, the gallery wrong); the ⭐ Liked view now takes
  // this single list and intersects the gallery walk with it. Cached 30 s; any own vote invalidates it.
  var topList = null, topAt = 0;
  var TOP_TTL = 30000;
  function seedTop(list) {
    var now = Date.now();
    for (var i = 0; i < list.length; i++) {
      var k = String(list[i][0] || "");
      if (!k) continue;
      counts[k] = list[i][1] | 0;
      countsAt[k] = now;
    }
  }
  window.dragonLikeTop = function (force) {
    var now = Date.now();
    if (!force && topList && now - topAt <= TOP_TTL) return Promise.resolve(topList);
    var g = gen;
    return rpc("dragonLikeTop", "").then(function (raw) {
      if (g !== gen) return topList || [];
      var d = null;
      try { d = JSON.parse(raw); } catch (e) { d = null; }
      if (!d || d.warming || !d.top) return topList || [];
      topList = d.top;
      topAt = Date.now();
      seedTop(topList);
      rememberKeys(topList.map(function (e) { return String(e[0]); }).slice(0, 250));
      return topList;
    }, function () { return topList || []; });
  };
  // 🗺️ TOP→URL MAP (W-LIKEDFAST, Egon 10.10.2026) — the server top-1000 speaks TAGS
  // (cmtTag of the client key), but tiles speak URLS, and a tag cannot be reversed into its url.
  // So every url this browser ever SEES is remembered here (tag -> url, insertion-ordered, capped),
  // persisted across sessions: the ⭐ Liked view can then paint the global top INSTANTLY from urls it
  // already knows, instead of waiting for the whole recent-walk to rediscover them. A first-ever open
  // (empty map) still walks; every later open paints the top from ONE fast RPC.
  var urlMap = null, urlMapDirty = false, urlMapSaveAt = 0;
  var URLMAP_KEY = "dragonLikeUrlMap", URLMAP_CAP = 4000;
  var adoptedTags = {};   // W-GALTOP: tags already taught to the server this page-load (adopt once)
  function urlMapInit() {
    if (urlMap) return urlMap;
    urlMap = {};
    try {
      var raw = localStorage.getItem(URLMAP_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o === "object") {
          var ks = Object.keys(o);
          for (var i = 0; i < ks.length && Object.keys(urlMap).length < URLMAP_CAP; i++) {
            var v = o[ks[i]];
            // W-GALTOP: entries are {u,g,r} now; legacy plain-string urls migrate with unknown context
            if (typeof v === "string" && v) urlMap[ks[i]] = { u: v, g: "", r: -1 };
            else if (v && typeof v.u === "string" && v.u) urlMap[ks[i]] = { u: v.u, g: v.g || "", r: (v.r === 0 || v.r === 1 || v.r === 2) ? v.r : -1 };
          }
        }
      }
    } catch (e) {}
    return urlMap;
  }
  function urlMapSave() {
    if (!urlMapDirty) return;
    var now = Date.now();
    if (now - urlMapSaveAt < 8000) return;   // persisted at most every 8 s (a walk must not jank on writes)
    urlMapSaveAt = now;
    urlMapDirty = false;
    try {
      var ks = Object.keys(urlMap);
      while (ks.length > URLMAP_CAP) { try { delete urlMap[ks.shift()]; } catch (e) { break; } }
      localStorage.setItem(URLMAP_KEY, JSON.stringify(urlMap));
    } catch (e) {}
  }
  function urlMapNote(clientKey, url, gen, rating, lrIn) {
    if (!clientKey || !url) return;
    var t = null;
    try { t = window.dragonLikeServerTag(clientKey); } catch (e) { t = null; }
    if (!t) return;
    urlMapInit();
    var cur = urlMap[t];
    // W-GALTOP: context (gallery+rating) sticks when known and never unlearns (empty never overwrites)
    var g = gen || (cur && cur.g) || "";
    var r = (rating === 0 || rating === 1 || rating === 2) ? rating : (cur ? cur.r : -1);
    // Egon 16.10.2026 (listing truth): the listing rating (0 = G, 2 = none) sticks the same way —
    // the shocking flag never changes for a picture, so first truth wins and vote context (r)
    // keeps updating independently beside it.
    var lr = (lrIn === 0 || lrIn === 2) ? lrIn : (cur && (cur.lr === 0 || cur.lr === 2) ? cur.lr : -1);
    if (cur && cur.u === url && cur.g === g && cur.r === r && cur.lr === lr) return;
    try { delete urlMap[t]; } catch (e) {}
    urlMap[t] = { u: url, g: g, r: r, lr: lr };       // re-set = newest (eviction drops the oldest first)
    urlMapDirty = true;
    try {
      var now = Date.now();
      if (now - urlMapSaveAt >= 8000) urlMapSave();
      else if (!urlMapNote._t) urlMapNote._t = setTimeout(function () { urlMapNote._t = 0; urlMapSave(); }, 9000);
    } catch (e) {}
  }
  // Every url the gallery shows, counts, or walks is remembered (tags of throwaway checkup keys are
  // harmless: they simply never match a future top list).
  window.dragonLikeNoteUrls = function (urls, gen, rating, lrMap) {
    try {
      urlMapInit();
      for (var i = 0; i < (urls || []).length; i++) {
        var s = String(urls[i] == null ? "" : urls[i]).trim();
        if (!s) continue;
        var lrk = -1;
        try { if (lrMap) { var _lv = lrMap[s]; if (_lv === 0 || _lv === 2) lrk = _lv; } } catch (eL) {}
        urlMapNote(keyOf(s), s, gen, rating, lrk);
      }
      urlMapSave();
    } catch (e) {}
  };
  // Forget one dead picture (its file no longer resolves): it must not top the next instant open.
  window.dragonLikeDropUrl = function (url) {
    try {
      var s = String(url == null ? "" : url);
      if (!s || !urlMap) return;
      var drop = false;
      for (var k in urlMap) { if (urlMap[k] && urlMap[k].u === s) { try { delete urlMap[k]; } catch (e) {} drop = true; } }
      if (drop) { urlMapDirty = true; urlMapSave(); }
    } catch (e) {}
  };
  // The global top, but as PAINTABLE urls (most-liked first, capped at n): only pictures this browser
  // has already seen resolve — the walk backfills the rest.
  window.dragonLikeTopUrls = function (n) {
    return window.dragonLikeTop(false).then(function (top) {
      var out = [], seen = {};
      try {
        urlMapInit();
        var cap = n | 0;
        if (!(cap > 0)) cap = 50;
        for (var i = 0; i < (top || []).length && out.length < cap; i++) {
          var tag = String((top[i] && top[i][0]) || "");
          var c = (top[i] && top[i][1]) | 0;
          if (!tag || !(c > 0)) continue;
          var e = urlMap[tag];
          var u = (e && e.u) || "";
          if (!u || seen[u]) continue;
          seen[u] = 1;
          out.push({ url: u, c: c });
        }
      } catch (e) {}
      return out;
    }, function () { return []; });
  };
  // Faz-2/C-1: the wall fallback must never paint foreign-gallery pictures — same as above, but only
  // entries this browser saw IN this gallery (urlMap carries g). May return fewer than n; that is correct
  // (the walk backfills the rest; a foreign picture would be a worse failure than a thin fallback).
  window.dragonLikeTopUrlsFor = function (gn, n) {
    return window.dragonLikeTop(false).then(function (top) {
      var out = [], seen = {};
      try {
        urlMapInit();
        var want = String(gn || "");
        var cap = n | 0;
        if (!(cap > 0)) cap = 50;
        for (var i = 0; i < (top || []).length && out.length < cap; i++) {
          var tag = String((top[i] && top[i][0]) || "");
          var c = (top[i] && top[i][1]) | 0;
          if (!tag || !(c > 0)) continue;
          var e = urlMap[tag];
          var u = (e && e.u) || "";
          if (!u || seen[u]) continue;
          if (!e || e.g !== want) continue;
          seen[u] = 1;
          out.push({ url: u, c: c });
        }
      } catch (e) {}
      return out;
    }, function () { return []; });
  };
  window.dragonLikeTopForget = function () { topList = null; topAt = 0; };
  // 🖼️ MAINTAINED GALLERY TOP (W-GALTOP, Egon 10.10.2026) — one gallery's top-1000 for one rating,
  // WITH urls, in ONE server call (the server maintains the order on every vote). 30 s cache per
  // gallery|rating. Counts are seeded into the shared cache, and urls into the top→url map WITH their
  // context, so chips and the walk answer without extra RPCs. `slot:false` = gallery never registered.
  var galTopCache = {}, GALTOP_TTL = 30000;
  window.dragonGalleryTop = function (gn, rating, n) {
    var nn = (n | 0) || 1000;
    if (nn < 1 || nn > 1000) nn = 1000;
    var key = String(gn || "") + "|" + (rating | 0) + "|" + nn;
    var now = Date.now();
    var gg = gen;   // Faz-2/C-2: generation guard (like prefetch) — a reply from before a forget must not seed
    var hit = galTopCache[key];
    if (hit && now - hit.at <= GALTOP_TTL) return Promise.resolve(hit.list);
    return rpc("dragonGalleryTop", JSON.stringify({ g: gn, r: rating | 0, n: nn })).then(function (raw) {
      var d = null;
      try { d = JSON.parse(raw); } catch (e) { d = null; }
      // Faz-2/warming: warming is NOT an empty slot — reject so the wall retries it as a failure
      // (cached [] + open socket used to wedge the wall on fallback tiles forever).
      if (d && d.warming) return Promise.reject(new Error("warming"));
      if (!d || !d.ok) return hit ? hit.list : [];
      var list = d.list || [];
      if (gg !== gen) return hit ? hit.list : [];   // stale reply: no cache write, no count seeding
      galTopCache[key] = { at: Date.now(), list: list, slot: !!d.slot };
      try {
        for (var i = 0; i < list.length; i++) {
          var u = String((list[i] && list[i].u) || "");
          if (!u) continue;
          var kk = keyOf(u);
          counts[kk] = (list[i].c | 0);
          countsAt[kk] = Date.now();
          urlMapNote(kk, u, gn, rating);
        }
      } catch (eS) {}
      return list;
    }, function () { return hit ? hit.list : []; });
  };
  window.dragonGalleryTopForget = function () { galTopCache = {}; };
  // PAGED MAINTAINED TOP (Egon 17.10.2026) — the same single-slot source as dragonGalleryTop above,
  // but one bounded page per call ({list, total, off, next, slot}) so Load-more continues with
  // {off:next} instead of re-fetching served ranks. Pages share the 30 s cache. Warming rejects
  // like the single (a partial page must never seed a ranking).
  var galTopPageCache = {};
  window.dragonGalleryTopPage = function (gn, rating, off, n) {
    var nn = (n | 0) || 100;
    if (nn < 1 || nn > 200) nn = 100;
    var oo = (off | 0) || 0;
    if (oo < 0) oo = 0;
    var key = String(gn || "") + "|" + (rating | 0) + "|" + oo + "+" + nn;
    var now = Date.now();
    var gg = gen;
    var hit = galTopPageCache[key];
    if (hit && now - hit.at <= GALTOP_TTL) return Promise.resolve(hit.env);
    function empty() { return { ok: false, slot: false, list: [], total: 0, off: oo, next: oo }; }
    return rpc("dragonGalleryTop", JSON.stringify({ g: gn, r: rating | 0, n: nn, off: oo })).then(function (raw) {
      var d = null;
      try { d = JSON.parse(raw); } catch (e) { d = null; }
      if (d && d.warming) return Promise.reject(new Error("warming"));
      if (!d || !d.ok) return hit ? hit.env : empty();
      var env = { ok: true, slot: !!d.slot, list: d.list || [], total: (d.total | 0) || 0, off: (d.off | 0) || 0, next: (d.next | 0) || 0 };
      if (gg !== gen) return hit ? hit.env : env;
      galTopPageCache[key] = { at: Date.now(), env: env };
      try {
        for (var i = 0; i < env.list.length; i++) {
          var u = String((env.list[i] && env.list[i].u) || "");
          if (!u) continue;
          var kk = keyOf(u);
          counts[kk] = (env.list[i].c | 0);
          countsAt[kk] = Date.now();
          urlMapNote(kk, u, gn, rating);
        }
      } catch (eS) {}
      return env;
    }, function () { return hit ? hit.env : empty(); });
  };
  window.dragonGalleryTopPageForget = function () { galTopPageCache = {}; };
  // PAGED UNION TOP (Egon 17.10.2026) — the default (all-content) view merges all three rating slots,
  // most-liked first. Fetching 3x1000 per view kept tripping the server's per-handler budget on
  // production (quarantine-4429). Each rating now keeps its own page cursor and Load-more k-way-merges
  // the heads: exact at every depth (merged rank k can only come from slot positions below k), bounded
  // per call (one 100-page per drained slot, usually none). Live votes between pages may drift ranks
  // slightly; served urls dedupe so nothing ever repeats.
  var UNION_PAGE = 100;
  window.dragonGalleryTopUnionCursor = function (gn) {
    return { gen: String(gn || ""), off: [0, 0, 0], buf: [[], [], []], done: [false, false, false], served: {} };
  };
  window.dragonGalleryTopUnionNext = function (cur, n) {
    if (!cur) return Promise.resolve([]);
    var want = (n | 0) || UNION_PAGE;
    if (want < 1 || want > 200) want = UNION_PAGE;
    var guard = 0;
    function refill(r) {
      if (cur.done[r]) return Promise.resolve();
      return window.dragonGalleryTopPage(cur.gen, r, cur.off[r], UNION_PAGE).then(function (env) {
        if (!env || !env.slot) { cur.done[r] = true; return; }
        var list = env.list || [], i, u;
        for (i = 0; i < list.length; i++) {
          u = String((list[i] && (list[i].u || list[i].url)) || "");
          if (!u || cur.served[u]) continue;
          cur.buf[r].push({ u: u, c: (list[i].c | 0) || 0 });
        }
        cur.off[r] = (env.next | 0) || (cur.off[r] + list.length);
        if (!list.length || cur.off[r] >= (env.total | 0)) cur.done[r] = true;
      }, function (e) {
        if (e && e.message === "warming") throw e;
        cur.done[r] = true;
      });
    }
    function step(out) {
      if (out.length >= want || guard++ > 600) return Promise.resolve(out);
      var need = false, bi = -1, bc = -1, r, c;
      for (r = 0; r < 3; r++) {
        if (!cur.buf[r].length && !cur.done[r]) need = true;
        if (cur.buf[r].length) {
          c = (cur.buf[r][0].c | 0) || 0;
          if (bi < 0 || c > bc) { bi = r; bc = c; }
        }
      }
      if (bi < 0 && !need) return Promise.resolve(out);
      if (bi < 0) {
        var ps = [];
        for (var q = 0; q < 3; q++) if (!cur.buf[q].length && !cur.done[q]) ps.push(refill(q));
        return Promise.all(ps).then(function () { return step(out); });
      }
      var e = cur.buf[bi].shift();
      if (e && e.u && !cur.served[e.u]) { cur.served[e.u] = 1; out.push(e); }
      return step(out);
    }
    return step([]);
  };
  // 🖼️ UNION TOP (Egon 12.10.2026) — ONE record holds ONE rating (last vote/adopt wins), so a picture
  // voted under several filters lives in exactly one rating slot: the true #1 (14 votes) sat in the
  // G slot while the default view read the none slot starting at 12. The default (all-content) view
  // therefore reads ALL THREE slots and merges by live count, most-liked first — ties keep the
  // caller's own rating first (stable sort). Filtered views keep their single slot, untouched.
  // Egon 16.10.2026 (Faz-3, serverNow DELIBERATELY absent): no per-slot epoch is attached because each
  // single carries its own 30 s cache — a skew check would either see nothing (cache hits carry no epoch)
  // or refetch-loop against the cache. Ties already break by slot order (documented), which is the only
  // place a seconds-level skew could ever show.
  window.dragonGalleryTopAll = function (gen, rating, n) {
    var singles = (typeof window.dragonGalleryTop === "function") ? window.dragonGalleryTop : null;
    if (!gen || !singles) return Promise.resolve([]);
    var order = [rating | 0, 0, 1, 2], seenR = {}, rs = [];
    for (var q = 0; q < order.length; q++) { var rr = order[q]; if (rr >= 0 && rr <= 2 && !seenR[rr]) { seenR[rr] = 1; rs.push(rr); } }
    var cap = (n | 0) || 300;
    if (cap < 1) cap = 300;
    return Promise.all(rs.map(function (r) {
      return singles(gen, r, 1000).then(null, function (e) {
        if (e && e.message === "warming") throw e;   // Faz-2/warming: never merge a partial union during rebuild
        return [];
      });
    })).then(function (lists) {
      var byTag = {}, out = [], i, j, e, u, tag;
      for (i = 0; i < lists.length; i++) {
        var list = lists[i] || [];
        for (j = 0; j < list.length; j++) {
          e = list[j]; if (!e) continue;
          u = String(e.u || e.url || "");
          if (!u) continue;
          try { tag = window.dragonLikeServerTag ? window.dragonLikeServerTag(keyOf(u)) : ("u:" + u); } catch (x) { tag = "u:" + u; }
          if (!tag || byTag[tag]) continue;
          byTag[tag] = 1;
          out.push({ u: u, c: (e.c | 0) || 0 });
        }
      }
      out.sort(function (a, b) { return b.c - a.c; });
      if (out.length > cap) out.length = cap;
      return out;
    }, function (e) { if (e && e.message === "warming") throw e; return []; });
  };
  // 🖼️ BACKFILL (W-GALTOP) — teach the server the urls this browser already knows (its own map entries
  // with gallery+rating), 300/batch with the server's 10 s gate respected. Runs once per page-load per
  // gallery|rating; the server skips tags it already holds, so re-runs are cheap no-ops.
  var adoptRunning = {};
  window.dragonGalleryAdoptSend = function (gen, rating) {
    var key = String(gen || "") + "|" + (rating | 0);
    if (!gen || adoptRunning[key]) return Promise.resolve({ ok: true, sent: 0, note: "already" });
    adoptRunning[key] = 1;
    var all = [];
    try {
      urlMapInit();
      for (var t in urlMap) {
        if (adoptedTags[t]) continue;
        var e = urlMap[t];
        if (e && e.u && e.g === gen && e.r === (rating | 0)) { all.push([t, e.u, e.g, e.r, (e.lr === 0 || e.lr === 2) ? e.lr : -1]); }
      }
    } catch (e) {}
    if (!all.length) { adoptRunning[key] = 0; return Promise.resolve({ ok: true, sent: 0 }); }
    var idx = 0, total = { added: 0, skipped: 0, refused: 0 };
    var markBatch = function (batch) { for (var z = 0; z < batch.length; z++) adoptedTags[batch[z][0]] = 1; };
    var unmarkTags = function (tags) {   // tags: batch rows or bare tag strings
      for (var z = 0; z < tags.length; z++) {
        var tt = (typeof tags[z] === "string") ? tags[z] : tags[z][0];
        try { delete adoptedTags[tt]; } catch (eD) {}
      }
    };
    return new Promise(function (resolve) {
      (function step() {
        if (idx >= all.length) {
          try { galTopCache = {}; } catch (eGC) {}   // W-GALTOP: taught urls join the maintained top
          adoptRunning[key] = 0;   // Faz-2/A13: completion releases the guard; per-tag state governs re-runs
          resolve({ ok: true, sent: all.length, added: total.added, skipped: total.skipped, refused: total.refused }); return; }
        var batch = all.slice(idx, idx + 300); idx += 300;
        rpc("dragonGalleryAdopt", JSON.stringify({ a: batch })).then(function (raw) {
          try {
            var d = JSON.parse(raw);
            if (d && d.ok) {
              total.added += d.added | 0; total.skipped += d.skipped | 0; total.refused += d.refused | 0;
              // Egon 17.10.2026 (quarantine-4429): the server time-slices big batches — only the processed
              // prefix is terminal; the rest rewinds onto the next 11 s step, never a hot retry. Old servers
              // send no processed flag, which reads as a full batch (identical to before).
              var doneN = (d && d.stopped) ? ((d.processed | 0) || 0) : batch.length;
              if (!(doneN >= 0)) doneN = 0; if (doneN > batch.length) doneN = batch.length;
              var restN = batch.length - doneN;
              if (restN > 0) idx -= restN;
              var doneB = batch.slice(0, doneN);
              // Faz-2/A5: confirm per tag. Added/skipped are terminal (server holds, or dead/invalid) —
              // refused must stay retryable. Without an rt list, unmark the whole batch conservatively.
              markBatch(doneB);
              var rts = (d && d.rt) || [];
              if (rts.length) unmarkTags(rts);
              else if ((d.refused | 0) > 0) unmarkTags(doneB);
            } else unmarkTags(batch);
          } catch (eP) { unmarkTags(batch); }
          setTimeout(step, 11000);
        }, function () { unmarkTags(batch); setTimeout(step, 11000); });
      })();
    });
  };
  // 🔑 SERVER TAG (W-LIKEDSORT) — the ledger keys pictures by cmtTag(clientKey): FNV-1a hex, first 8
  // chars of "hhhhhhhh.hhhhhhhh" (unpadded — a short first half pulls in the dot, byte-exact port of
  // the server's cmtHash32/cmtKey/cmtTag, quirks included). The top-1000 speaks tags; tiles speak urls.
  function cmtHash32(s, seed) {
    var h = seed >>> 0;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  window.dragonLikeServerTag = function (k) {
    var s = String(k == null ? "" : k);
    return (cmtHash32(s, 0x811c9dc5).toString(16) + "." + cmtHash32(s, 0x1000193).toString(16)).slice(0, 8);
  };
  // One door for every read: the client key first, then the top-seeded server tag (W-LIKEDSORT: the
  // top-1000 speaks tags, everything else speaks client keys). Client-keyed writes always win ties.
  function countKnown(k) {
    if (!k) return -1;
    if (countsAt[k] !== undefined) return counts[k] | 0;
    var t = null;
    try { t = window.dragonLikeServerTag(k); } catch (e) { t = null; }
    if (t && countsAt[t] !== undefined) return counts[t] | 0;
    return -1;
  }
  // 🧹 FORGET EVERYTHING (Egon 23.09.2026) — the counts are cached for 60 s, and NOTHING used to clear
  // that cache, so a like cast on ANOTHER device stayed invisible until the page was reloaded (Egon hit
  // exactly this: sort away and back, press Refresh Gallery, nothing — F5 and it appeared). The gallery
  // now calls this whenever its view is (re)built, so a channel/sort/filter switch and the Refresh
  // Gallery button always ask the server for the truth instead of re-using a number fetched a moment ago.
  window.dragonLikeForget = function () {
    gen++;
    counts = {};
    countsAt = {};
    topList = null; topAt = 0;
    try { galTopCache = {}; } catch (e) {}   // W-GALTOP: a rebuilt view re-asks the maintained top too
    try { liveKeys = []; liveSeen = {}; } catch (eL) {}   // Faz-2/C-7: don't poll the previous view's dead keys
  };

  // 📡 LIVE COUNTS (Egon 23.09.2026) — a like cast on ANOTHER device lands on this screen by itself.
  // While a gallery is open (`dragonLikeLive(true)`, called by the gallery itself) this module holds ONE
  // pub/sub subscription on the shared socket plus a 30 s safety poll of the pictures the visitor was
  // actually shown. A push carries the picture's key and its new count: the count overwrites the cache,
  // the chip repaints, and the ⭐ Liked view is told (window.__dragonLikeChanged) so the picture slides
  // into — or out of — the ranking live. No reload, no F5, no refresh button.
  // COST: one tiny frame per changed picture (the server coalesces bursts and caps 25/s), the socket is
  // held open only while a gallery is on screen (and released the moment it closes), and the poll reads
  // at most 300 keys every 30 s and never runs in a hidden tab.
  var liveRelease = null, liveTimer = null, liveVis = null;
  var liveKeys = [], liveSeen = {};
  function rememberKeys(keys) {
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (!k || liveSeen[k]) continue;
      liveSeen[k] = 1;
      liveKeys.push(k);
      if (liveKeys.length > 250) { delete liveSeen[liveKeys.shift()]; }
    }
  }
  function applyCount(k, c) {
    var v = c | 0;
    if (countsAt[k] !== undefined && (counts[k] | 0) === v) return;
    counts[k] = v;
    countsAt[k] = Date.now();
    repaint(k);
    try { if (window.__dragonLikeChanged) window.__dragonLikeChanged(k, v); } catch (e) {}
  }
  function onLikePush(m) {
    var p = m && m.c;
    if (!p || typeof p !== "object" || !p.i) return;
    applyCount(String(p.i), p.c | 0);
  }
  function livePoll(force) {
    if (!liveKeys.length) return Promise.resolve();
    if (!force && document.visibilityState === "hidden") return Promise.resolve();
    var keys = liveKeys.slice(0, MAXQ);
    var g = gen;
    return rpc("dragonLikeCounts", keys.join(",")).then(function (raw) {
      if (g !== gen) return;
      var d = null;
      try { d = JSON.parse(raw); } catch (e) { d = null; }
      for (var i = 0; i < keys.length; i++) applyCount(keys[i], (d && d[keys[i]]) ? (d[keys[i]] | 0) : 0);
    }, function () {});
  }
  function onLikeVis() { if (document.visibilityState !== "hidden") { window.dragonLikeForget(); livePoll(true); } }
  var liveUsers = {};   // who wants the live socket (the gallery keeps it while open)
  function liveStart() {
    if (!liveRelease) {
      try { liveRelease = window.dragonSharedTopic ? window.dragonSharedTopic("lk", onLikePush) : null; } catch (e) { liveRelease = null; }
    }
    if (!liveTimer) liveTimer = setInterval(function () { try { livePoll(false); } catch (e) {} }, 30000);
    if (!liveVis) { liveVis = onLikeVis; try { document.addEventListener("visibilitychange", liveVis); } catch (e) {} }
  }
  function liveStop() {
    if (liveRelease) { try { liveRelease(); } catch (e) {} liveRelease = null; }
    if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
    if (liveVis) { try { document.removeEventListener("visibilitychange", liveVis); } catch (e) {} liveVis = null; }
  }
  // `who` keeps the consumers honest: the gallery asks for live counts while it is open and releases them
  // when it closes — and the socket lives as long as ONE consumer still wants it (never forever, and
  // never twice).
  window.dragonLikeLive = function (on, who) {
    var id = String(who || "default");
    var was = Object.keys(liveUsers).length > 0;
    if (on) liveUsers[id] = 1; else delete liveUsers[id];
    var now = Object.keys(liveUsers).length > 0;
    if (now && !was) liveStart();
    else if (!now && was) liveStop();
  };
  // what the live channel is doing right now (used by the check-up and while testing)
  window.dragonLikeLiveState = function () {
    return { users: Object.keys(liveUsers), subscribed: !!liveRelease, polling: !!liveTimer, tracked: liveKeys.length, cached: Object.keys(countsAt).length, gen: gen };
  };

  // The count chip. It sits UNDER the tile's ⭐ button (top-right) on purpose: the 💬 comment chip owns the
  // bottom-center and the #N number the bottom-left, so nothing ever overlaps.
  function paintBadge(tile) {
    var st = tile.querySelector(".dragon-gal-tile-star");
    var url = (st && st.dataset) ? String(st.dataset.url || "") : "";
    var k = keyOf(url);
    if (!k) return;
    var n = countKnown(k);
    if (n < 0) n = 0;
    var b = tile.querySelector(".dlk-badge");
    if (n <= 0) { if (b) b.remove(); return; }
    if (!b) {
      b = document.createElement("span");
      b.className = "dlk-badge";
      b.style.cssText = "position:absolute;right:calc(1.05rem + 4px);transform:translateX(50%);top:calc(2.1rem + 8px);z-index:4;display:inline-flex;align-items:center;gap:.2rem;font-size:.66rem;font-weight:800;line-height:1.3;padding:.12rem .42rem;border-radius:999px;background:rgba(10,10,14,.86);color:#ffe9a8;border:1px solid rgba(212,175,55,.65);pointer-events:auto;cursor:zoom-in;box-shadow:0 2px 8px rgba(0,0,0,.45);";
      tile.appendChild(b);
    }
    // 🖱️ Egon 23.09.2026 — the chip used to carry `cursor:help`, and that help cursor IS the "?" the mouse
    // showed next to the tooltip; the chip opens the picture when tapped, so it wears the picture's own
    // zoom-in cursor instead (set on every paint, so chips built by an older build are corrected too).
    // ⚡ 2.55.2 — WRITE ONLY WHAT CHANGED. A repaint that rewrites the same text/attributes MUTATES the
    // document, and `boot()` observes the body: every mutation re-armed a repaint, so the two fed each other
    // in an endless 2-per-second loop (measured: ~220 mutations/s on a 60-tile gallery page). Each pass
    // forced a style/layout sweep over the whole grid, which starved image decoding and made pictures crawl
    // everywhere the ⭐ chips live (galleries, the home wall). Comparing first makes a repaint
    // that has nothing to say a no-op, so the loop dies the moment the counts stop moving.
    try { if (b.style.cursor !== "zoom-in") b.style.cursor = "zoom-in"; } catch (eC) {}
    try { b.style.right = "calc(1.05rem + 4px)"; b.style.top = "calc(2.1rem + 8px)"; b.style.bottom = "auto"; b.style.transform = "translateX(50%)"; } catch (eP) {}
    var badgeText = "\u2B50 " + n;
    if (b.textContent !== badgeText) b.textContent = badgeText;
    var tipText = "This image got " + n + " Like" + (n === 1 ? "" : "s") + "!";
    // 🖱️ Egon 23.09.2026 (W-UX187 follow-up) — TWO tooltips were showing on this chip: the themed one from
    // index.html's `#dragonFastTip` layer, and the browser's own crude box (with the "?" the help cursor
    // drew beside the pointer). Anything in `title` is what the browser paints as its own bubble, so the
    // chip now carries its tip in `data-dragon-tip` ONLY and never in `title` — the themed layer reads
    // `data-dragon-tip` as well, so the chip still gets its fast tip, and no repaint (a scroll, a live
    // like, a badge sweep) can ever bring the native bubble back.
    try { if (b.getAttribute("title") !== null) b.removeAttribute("title"); } catch (eT) {}
    try { if (b.getAttribute("data-dragon-tip") !== tipText) b.setAttribute("data-dragon-tip", tipText); } catch (e0) {}
    // 🖱️ Egon 23.09.2026 — the chip must take clicks (that is what lets the browser show its tooltip on
    // hover), but it sits ON TOP of the picture, and the picture is what opens the lightbox (`img.onclick`).
    // Without this forward, tapping the chip's corner would do nothing — the old `pointer-events:none` chip
    // let the tap fall through to the picture. So a click on the chip is handed straight to the picture.
    b.onclick = function (ev) {
      try { if (ev && ev.stopPropagation) ev.stopPropagation(); } catch (e0) {}
      try { var im = tile.querySelector("img"); if (im && typeof im.onclick === "function") im.onclick(ev); } catch (e1) {}
    };
  }

  function repaint(k) {
    var all = document.querySelectorAll(TILE_SEL);
    for (var i = 0; i < all.length; i++) {
      var st = all[i].querySelector(".dragon-gal-tile-star");
      if (st && st.dataset && keyOf(st.dataset.url) === k) paintBadge(all[i]);
    }
    try { if (window.__dragonAdminScanBadges) window.__dragonAdminScanBadges(); } catch (eA) {}
  }
  window.dragonLikeRepaint = function (url) { return repaint(keyOf(url)); };

  window.dragonLikeBadges = function (scopeEl) {
    var root = scopeEl || document;
    var tiles = root.querySelectorAll(TILE_SEL);
    var urls = [], now = Date.now();
    for (var i = 0; i < tiles.length; i++) {
      var st = tiles[i].querySelector(".dragon-gal-tile-star");
      var url = (st && st.dataset) ? String(st.dataset.url || "") : "";
      if (!url) continue;
      paintBadge(tiles[i]);
      var k = keyOf(url);
      // refresh a count that is unknown or older than a minute, so a picture liked moments ago grows its
      // chip without a reload
      if ((countsAt[k] === undefined || now - countsAt[k] > BADGE_TTL) && urls.indexOf(url) === -1) urls.push(url);
    }
    if (!urls.length) return;
    clearTimeout(pending);
    pending = setTimeout(function () {
      var tok = ++fetchTok;
      window.dragonLikePrefetch(urls).then(function () {
        if (tok !== fetchTok) return;
        var all = document.querySelectorAll(TILE_SEL);
        for (var j = 0; j < all.length; j++) paintBadge(all[j]);
      }, function () {});
    }, 350);
  };

  // Tiles are appended by the gallery's own painter, so a light observer paints the chips as they land
  // (exactly how the 💬 badge does it) instead of every addTile having to remember to call us.
  function boot() {
    var scheduled = false;
    var onChange = function () {
      if (scheduled) return;
      scheduled = true;
      setTimeout(function () {
        scheduled = false;
        try { window.dragonLikeBadges(document); } catch (e) {}
      }, 500);
    };
    if (window.dragonBodyObserve) { window.dragonBodyObserve(onChange); return; }
    if (!window.MutationObserver) return;
    try { new MutationObserver(onChange).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
