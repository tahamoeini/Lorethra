/* ============================================================================
   🧩 COLLAGE EDITOR (W-UX157)

   Egon's request (23.09.2026), translated: "we could offer an 'add another image' option to the editor
   so people can also add other images from the gallery and make a collage!!! like this; a 'make
   collage' button opens. From it you pick public/private gallery ... the user is given the chance to
   make a MULTIPLE selection. If it burdens us, 20 or 50 or 100. If it is no trouble, unlimited. Then
   those images are shown in a VERTICAL STRIP on the left of the editor and a drag-and-drop bubble
   goes to the user. You also add automatic collage patterns, 5-6 of them. It places the images
   according to the pattern. The user can still drag and drop freely in the editor."

   So this module is TWO windows:

     1) THE PICKER (`#dragonCollagePick`) — a thumbnail grid of THIS DEVICE'S OWN pictures with
        multi-select (a live counter, capped at MAX_PICK = 100) and "Create collage →". Egon 23.09.2026
        (W-UI234): the picker shows ONLY the visitor's private gallery — "let it show only the pictures in
        the private gallery … it loads faster and after all what a person wants is a collage of the things
        they liked". The public-gallery tab it used to carry is gone (parked in the Librarybook DEPO), and
        with it the overlapped / not-really-in-the-gallery pictures Egon saw. Nothing is uploaded: the
        pictures are read from the device's own vault stores.

     2) THE EDITOR (`#dragonCollageEditor`) — the picked images in a LEFT VERTICAL STRIP (drag one
        onto the canvas to add a copy; a tap adds it in the centre), a stage the tiles are placed on by
        one of SIX automatic patterns, free drag-and-drop afterwards, aspect + background choices, and
        "✓ Done" which renders the collage to a PNG (Download / Save to my gallery).

   HOW THE EXPORT AVOIDS A TAINTED CANVAS: public pictures live on a cross-origin CDN, so drawing them
   straight onto a canvas would make `toBlob` throw. Every image is therefore pulled as a BLOB through
   `window.dragonSuperFetch` first (data: URLs and blob: URLs just use fetch), and only the blob is
   drawn — the canvas stays clean and the PNG can be produced.

   Test hooks (used by the check-up's `collage` item, so the whole thing can be driven without touching
   the real galleries): window.dragonCollageTest.
   ========================================================================== */
(function () {
  "use strict";

  var VERSION = "1.0.0";
  var MAX_PICK = 100;        // Egon left the ceiling to us (20 / 50 / 100 / unlimited) — 100 is a safe cap
  var VAULT_SCAN_MAX = 5000; // safety ceiling on how many pictures one folder may offer (W-UI252: the real
                             // folder counts are in the thousands — 1618 in "general" — so the old
                             // "read 120" cap is why Egon only ever saw ~150 tiles)
  var LOAD_BUDGET = 260;     // how many thumbnails stay decoded at once; the rest load as they scroll in
  var COLLAGE_FOLDER = "Collages";
  var STYLE_ID = "dragonCollageCss";

  var ASPECTS = [
    { id: "1:1",  px: [1600, 1600] },
    { id: "4:3",  px: [1600, 1200] },
    { id: "3:4",  px: [1200, 1600] },
    { id: "16:9", px: [1600, 900] }
  ];
  var BGS = ["#0d0d13", "#ffffff", "#1b1030", "#f2e9d8"];
  var PATTERNS = [
    { id: "grid2",  label: "\u25A6 Auto grid" },
    { id: "grid3",  label: "\u25A9 3\u00D73 grid" },
    { id: "vstrip", label: "\u25AC Vertical strip" },
    { id: "hband",  label: "\u25A0 Horizontal band" },
    { id: "mosaic", label: "\u25E7 Mosaic" },
    { id: "spot",   label: "\u2728 Spotlight" }
  ];

  var pickEl = null, editEl = null, resultEl = null;
  var tileSeq = 0;
  var picked = [];                  // the picker's current selection, in tap order
  var cellUrls = [];                // W-UI252: the blob URLs currently painted in the grid (released on a folder switch)
  var state = { items: [], tiles: [], aspect: "1:1", bg: "#0d0d13", z: 1, pattern: "grid2", zoom: 1, fit: "cover" };
  var lastTotal = 0;                // 🧩 W-UI252: how many pictures the folder the picker is showing holds
  var _carry = null;                // 🧩 W-UI252: pictures carried back from the editor by "Add more images"
  var _mainItem = null;             // 🧩 W-UI252: the picture the collage was opened FROM (the Image Editor's own)
  var _mainOn = true;               // ...and it is part of the collage unless the visitor unticks "Use main image"
  var blobCache = {};
  var stageEl = null, stripEl = null, hintEl = null;

  /* ------------------------------------------------------------------ css -- */
  function css() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent =
      // 🧩 W-UI252 (Egon 24.09.2026) — "the collage window must open ABOVE the editor, the editor must NOT
      // close, it must stay underneath". The overlay used to sit at 2147483400, i.e. BELOW the ✏️ Image Editor
      // (2147483647) and below the lightbox (2147483644), so from the editor it opened out of sight. Raised to
      // 2147483648 — above both — and the editor is no longer hidden when the collage opens.
      ".dragon-cl-ov{position:fixed; inset:0; z-index:2147483648; display:flex; align-items:center; justify-content:center; padding:.7rem; background:rgba(5,5,9,.8); -webkit-backdrop-filter:blur(4px); backdrop-filter:blur(4px);}" +
      ".dragon-cl-card{width:100%; display:flex; flex-direction:column; border-radius:16px; border:1px solid rgba(155,107,255,.5); background:radial-gradient(120% 80% at 50% 0%, rgba(155,107,255,.14), transparent 60%), linear-gradient(180deg,#191922,#0c0c11); box-shadow:0 24px 70px rgba(0,0,0,.78); overflow:hidden;}" +
      ".dragon-cl-head{flex:0 0 auto; display:flex; align-items:center; gap:.5rem; padding:.65rem .75rem; border-bottom:1px solid rgba(255,255,255,.08);}" +
      ".dragon-cl-ttl{flex:1 1 auto; min-width:0; font-size:.95rem; font-weight:900; color:#efe9ff;}" +
      ".dragon-cl-x{flex:0 0 auto; width:1.8rem; height:1.8rem; border-radius:50%; border:1px solid rgba(155,107,255,.45); background:rgba(255,255,255,.04); color:#cbbcf0; cursor:pointer; font-size:.8rem; line-height:1; padding:0;}" +
      ".dragon-cl-tab{font-size:.75rem; font-weight:800; padding:.32rem .62rem; border-radius:9px; cursor:pointer; border:1px solid rgba(155,107,255,.35); background:rgba(255,255,255,.03); color:#cbbcf0;}" +
      ".dragon-cl-tab.on{background:linear-gradient(180deg,#7a4ddb,#4a2a94); color:#fff; border-color:#b79bff;}" +
      // 🧩 W-UI252 (Egon 24.09.2026) — KISSING TILES. The pictures really were "stacked on top of each
      // other": the grid row track was sized from an indefinite content height (the square cells measure
      // 101px while their row was only 47px), so every row overlapped the one below it. `grid-auto-rows:
      // max-content` + `align-items:start` pins each row to its own square and the 2px gap makes the tiles
      // KISS instead of colliding. Selection moved from a real border to an inset outline so switching a
      // tile on never nudges the grid.
      ".dragon-cl-grid{flex:1 1 auto; overflow-y:auto; display:grid; grid-template-columns:repeat(auto-fill,minmax(96px,1fr)); grid-auto-rows:max-content; align-items:start; gap:2px; padding:.5rem;}" +
      ".dragon-cl-cell{position:relative; aspect-ratio:1/1; border-radius:5px; overflow:hidden; cursor:pointer; outline:2px solid transparent; outline-offset:-2px; background:#15151c;}" +
      ".dragon-cl-cell img{width:100%; height:100%; object-fit:cover; display:block;}" +
      ".dragon-cl-cell.on{outline-color:#b79bff; outline-width:3px;}" +
".dragon-cl-ord{position:absolute; top:3px; left:3px; min-width:18px; height:18px; border-radius:9px; background:#9b6bff; color:#fff; font:800 .62rem/18px system-ui,sans-serif; text-align:center; padding:0 4px;}" +
      ".dragon-cl-foot{flex:0 0 auto; display:flex; align-items:center; gap:.45rem; flex-wrap:nowrap; padding:.5rem .75rem; border-top:1px solid rgba(255,255,255,.08);}" +
      ".dragon-cl-tailnote{font-size:.68rem; color:#8f88ab; margin-left:auto; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}" +
      // 🧩 W-UI252 (third round) — the CONTROL BAR (patterns · aspect · background · zoom · fit · shuffle ·
      // random sizes) now sits directly under the title, above the picture area and the left strip.
      ".dragon-cl-ctrl{flex:0 0 auto; display:flex; align-items:center; gap:.4rem; flex-wrap:wrap; padding:.5rem .75rem; border-bottom:1px solid rgba(255,255,255,.08); background:rgba(155,107,255,.07); max-height:26vh; overflow-y:auto;}" +
      ".dragon-cl-wip{flex:0 0 auto; font-size:.64rem; font-weight:800; letter-spacing:.03em; color:#ffd76a; background:rgba(255,215,106,.12); border:1px solid rgba(255,215,106,.45); border-radius:999px; padding:.16rem .5rem; white-space:nowrap;}" +
      // the paper preview: a real sheet with a light edge, sitting on a mat
      ".dragon-cl-stage{position:relative; overflow:hidden; border-radius:4px; background-size:cover; box-shadow:0 12px 44px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.10); touch-action:none;}" +
      // 🗂️ W-UI252 — the FOLDER bar: the picker opens on a dropdown of the private gallery's own folders.
      ".dragon-cl-fbar{flex:0 0 auto; display:flex; align-items:center; gap:.45rem; flex-wrap:wrap; padding:.45rem .75rem; border-bottom:1px solid rgba(255,255,255,.08); background:rgba(0,0,0,.18);}" +
      ".dragon-cl-fbar .dragon-cl-flab{font-size:.72rem; font-weight:800; color:#b9aee0; letter-spacing:.02em; white-space:nowrap;}" +
      ".dragon-cl-sel{font-size:.78rem; font-weight:700; color:#e6ddff; background:#1b1526; border:1px solid rgba(155,107,255,.5); border-radius:9px; padding:.32rem .5rem; max-width:min(20rem,66vw); cursor:pointer;}" +
      ".dragon-cl-fcount{font-size:.7rem; color:#9a92b8; white-space:nowrap;}" +
      ".dragon-cl-btn{font-size:.78rem; font-weight:800; padding:.42rem .8rem; border-radius:10px; cursor:pointer; border:1px solid rgba(155,107,255,.5); background:rgba(255,255,255,.05); color:#d8c9ff;}" +
      ".dragon-cl-btn.pri{border-color:#b79bff; background:linear-gradient(180deg,#7a4ddb,#4a2a94); color:#fff;}" +
      ".dragon-cl-btn:disabled{opacity:.45; cursor:not-allowed;}" +
      ".dragon-cl-body{flex:1 1 auto; display:flex; min-height:0;}" +
      ".dragon-cl-strip{flex:0 0 auto; width:74px; overflow-y:auto; display:flex; flex-direction:column; gap:.35rem; padding:.5rem; border-right:1px solid rgba(255,255,255,.08); background:rgba(0,0,0,.25);}" +
      ".dragon-cl-thumb{width:100%; aspect-ratio:1/1; border-radius:8px; object-fit:cover; cursor:grab; border:1px solid rgba(155,107,255,.35); touch-action:none;}" +
      ".dragon-cl-stagewrap{flex:1 1 auto; min-width:0; display:flex; align-items:center; justify-content:center; padding:.7rem; position:relative; overflow:hidden; min-height:0;}" +
      ".dragon-cl-tile{position:absolute; overflow:hidden; border-radius:6px; box-shadow:0 4px 18px rgba(0,0,0,.45); cursor:move; touch-action:none;}" +
      ".dragon-cl-tile img{width:100%; height:100%; object-fit:cover; display:block; pointer-events:none; -webkit-user-drag:none; user-select:none;}" +
      ".dragon-cl-tile .dragon-cl-tile-x{position:absolute; top:2px; right:2px; width:18px; height:18px; border-radius:50%; border:0; background:rgba(0,0,0,.6); color:#fff; font-size:.6rem; line-height:1; cursor:pointer; opacity:0; transition:opacity .15s;}" +
      ".dragon-cl-tile:hover .dragon-cl-tile-x{opacity:1;}" +
      "@media (hover:none){.dragon-cl-tile .dragon-cl-tile-x{opacity:1;}}" +
      ".dragon-cl-hint{position:absolute; left:50%; bottom:8%; transform:translateX(-50%); font-size:.72rem; font-weight:800; color:#efe6ff; background:rgba(155,107,255,.92); border-radius:10px; padding:.35rem .7rem; pointer-events:none; box-shadow:0 6px 20px rgba(0,0,0,.55);}" +
      // 🧩 W-UI252 — the "Use main image" row and the ONE zoom that moves every tile together.
      ".dragon-cl-main{flex:0 0 auto; display:flex; align-items:center; gap:.55rem; padding:.45rem .75rem; border-bottom:1px solid rgba(255,255,255,.08); background:rgba(155,107,255,.09);}" +
      ".dragon-cl-main img{width:44px; height:44px; object-fit:cover; border-radius:6px; border:1px solid rgba(155,107,255,.55);}" +
      ".dragon-cl-main label{display:flex; align-items:center; gap:.4rem; font-size:.78rem; font-weight:800; color:#e6ddff; cursor:pointer;}" +
      ".dragon-cl-main .dragon-cl-mainhint{font-size:.68rem; color:#9a92b8;}" +
      ".dragon-cl-zoom{display:flex; align-items:center; gap:.3rem; font-size:.72rem; color:#cbbcf0;}" +
      ".dragon-cl-zbtn{min-width:26px; height:26px; border-radius:7px; border:1px solid rgba(155,107,255,.5); background:rgba(255,255,255,.05); color:#d8c9ff; cursor:pointer; font-size:.78rem; line-height:1; padding:0 .3rem;}" +
      ".dragon-cl-loading{grid-column:1/-1; padding:1.2rem; text-align:center; color:#b9aee0; font-size:.78rem;}" +
"@media (max-width:560px){.dragon-cl-strip{width:56px;} .dragon-cl-grid{grid-template-columns:repeat(auto-fill,minmax(74px,1fr));}}";
    (document.head || document.documentElement).appendChild(st);
  }

  /* --------------------------------------------------------------- helpers -- */
  function toast(msg) { try { if (window.dragonToast) window.dragonToast(msg); } catch (e) {} }
  function aspectPx(id) { for (var i = 0; i < ASPECTS.length; i++) if (ASPECTS[i].id === id) return ASPECTS[i].px; return [1600, 1600]; }

  // Every image reaches the canvas as a BLOB (see the header note) so the PNG never taints.
  function urlToBlob(url) {
    if (!url) return Promise.resolve(null);
    if (blobCache[url]) return Promise.resolve(blobCache[url]);
    var p;
    if (/^data:|^blob:/.test(url)) p = fetch(url).then(function (r) { return r.blob(); });
    else if (window.dragonSuperFetch) p = window.dragonSuperFetch(url).then(function (r) { return r.blob(); });
    else p = fetch(url).then(function (r) { return r.blob(); });
    return p.then(function (b) { blobCache[url] = b; return b; }).catch(function () { return null; });
  }

  /* ------------------------------------------------- the automatic patterns -- */
  // Every rect is a PERCENTAGE of the stage, so a pattern is resolution-independent and the exported PNG
  // uses exactly the same geometry.
  function layoutFor(name, n) {
    var out = [], i;
    if (n <= 0) return out;
    if (n === 1) return [{ x: 0, y: 0, w: 100, h: 100 }];
    if (name === "grid2") {
      // 🧩 W-UI252 (Egon 24.09.2026) — Egon: "with 4 pictures it lays them out nicely, but with 15 it crops
      // and squeezes them". The old rule ALWAYS used 2 columns, so 15 pictures became 8 rows of 50%×12.5%
      // ribbons. The column count now follows the picture count (a balanced ⌊sqrt grid: 2, 2, 3, 3, 4, …) and
      // a short LAST row stretches to fill the canvas — so the tiles KISS, the canvas is filled edge to edge
      // and no picture is squeezed into a sliver.
      var c2 = Math.max(2, Math.round(Math.sqrt(n))), r2 = Math.ceil(n / c2);
      var lastRow = n % c2;
      for (i = 0; i < n; i++) {
        var rowI = Math.floor(i / c2), colInRow = i - rowI * c2;
        var inRow = (rowI === r2 - 1 && lastRow) ? lastRow : c2;
        var w2 = 100 / inRow, h2 = 100 / r2;
        out.push({ x: colInRow * w2, y: rowI * h2, w: w2, h: h2 });
      }
      return out;
    }    if (name === "grid3") {
      var c3 = Math.min(3, n), r3 = Math.ceil(n / c3);
      for (i = 0; i < n; i++) out.push({ x: (i % c3) * (100 / c3), y: Math.floor(i / c3) * (100 / r3), w: 100 / c3, h: 100 / r3 });
      return out;
    }
    if (name === "vstrip") {
      for (i = 0; i < n; i++) out.push({ x: 0, y: i * (100 / n), w: 100, h: 100 / n });
      return out;
    }
    if (name === "hband") {
      for (i = 0; i < n; i++) out.push({ x: i * (100 / n), y: 0, w: 100 / n, h: 100 });
      return out;
    }
    if (name === "mosaic") {
      out.push({ x: 0, y: 0, w: 66.7, h: 100 });
      var rest = n - 1;
      for (i = 0; i < rest; i++) out.push({ x: 66.7, y: i * (100 / rest), w: 33.3, h: 100 / rest });
      return out;
    }
    // "spot": one big centred tile and a strip of small ones along the bottom
    var small = n - 1;
    out.push({ x: 8, y: 0, w: 84, h: 62 });
    for (i = 0; i < small; i++) out.push({ x: i * (100 / small), y: 66, w: 100 / small, h: 34 });
    return out;
  }
  window.dragonCollageLayoutFor = layoutFor;

  function applyPattern(name, keepSize) {
    if (name) state.pattern = name;
    var rects = layoutFor(state.pattern, state.tiles.length);
    for (var i = 0; i < state.tiles.length && i < rects.length; i++) {
      var t = state.tiles[i], r = rects[i];
      t.x = r.x; t.y = r.y; t.w = r.w; t.h = r.h;
      if (!keepSize) t.z = i + 1;
    }
    state.z = state.tiles.length + 1;
    renderStage();
  }

  /* ------------------------------------------------------------ the stage UI -- */
  // 🔍 W-UI252 (Egon 24.09.2026) — ONE zoom for the whole canvas. Egon: "there must be a zoom in / zoom out
  // that acts on EACH OF THEM, not on one specific picture, so the visitor can do specific placement". The tile
  // keeps its pattern SLOT (that is what the patterns and the drag maths speak in) and the zoom scales the
  // RENDERED box about the slot's own centre — so zooming never drifts a tile off its place.
  function zRect(t) {
    var z = state.zoom || 1;
    if (z === 1) return { x: t.x, y: t.y, w: t.w, h: t.h };
    var cx = t.x + t.w / 2, cy = t.y + t.h / 2, w = t.w * z, h = t.h * z;
    return { x: cx - w / 2, y: cy - h / 2, w: w, h: h };
  }
  window.dragonCollageZRect = zRect;

  // 🧩 W-UI252 (third round) — THE EMBEDDED PAPER PREVIEW. The stage used to be sized from its width alone
  // (`width:100%; aspect-ratio:…`), so on a short/wide window it grew taller than the space it had and the
  // control buttons ended up below the visible area. It is now measured against BOTH dimensions of its frame
  // and sized in pixels, so the sheet always fits inside the window like a real paper preview.
  function fitStage() {
    if (!stageEl || !stageEl.parentElement) return;
    var wrap = stageEl.parentElement;
    var W = wrap.clientWidth - 18, H = wrap.clientHeight - 18;
    if (W < 40 || H < 40) return;
    var pa = String(state.aspect || "1:1").split(":");
    var ar = (parseFloat(pa[0]) || 1) / (parseFloat(pa[1]) || 1);   // width / height
    var w = W, h = w / ar;
    if (h > H) { h = H; w = h * ar; }
    stageEl.style.aspectRatio = "";
    stageEl.style.width = Math.round(w) + "px";
    stageEl.style.height = Math.round(h) + "px";
  }
  window.dragonCollageFitStage = fitStage;

  function renderStage() {
    if (!stageEl) return;
    fitStage();
    stageEl.innerHTML = "";
    stageEl.style.background = state.bg || "#0d0d13";
    var contain = (state.fit === "contain");
    state.tiles.forEach(function (t) {
      var d = document.createElement("div");
      d.className = "dragon-cl-tile";
      d.setAttribute("data-tile", t.id);
      var r = zRect(t);
      d.style.left = r.x + "%"; d.style.top = r.y + "%"; d.style.width = r.w + "%"; d.style.height = r.h + "%";
      d.style.zIndex = String(t.z);
      // 🧩 W-UI252 — "Whole picture" mode shows the ENTIRE photograph inside its place (nothing cropped), so
      // the tile stops painting a shadow around empty space — the sheet's background shows through instead.
      d.style.boxShadow = contain ? "none" : "";
      var im = document.createElement("img");
      im.src = t.url; im.alt = ""; im.draggable = false;
      im.style.objectFit = contain ? "contain" : "cover";
      d.appendChild(im);
      var x = document.createElement("button");
      x.type = "button"; x.className = "dragon-cl-tile-x"; x.textContent = "\u2715"; x.title = "Remove this picture";
      x.setAttribute("aria-label", "Remove this picture");
      // 🧩 W-UI252 (third round) — Egon: "the ✕ button over the pictures in the collage window does not remove
      // the picture." The tile grabbed the pointer on `pointerdown` (setPointerCapture) before the button could
      // ever see a click, so ✕ was dead. The drag is now refused when the press starts on the ✕, and the ✕
      // stops the event so no drag can begin.
      x.addEventListener("pointerdown", function (ev) { ev.stopPropagation(); ev.preventDefault(); });
      x.onclick = function (ev) { ev.stopPropagation(); ev.preventDefault(); removeTile(t.id); };
      d.appendChild(x);
      d.addEventListener("pointerdown", function (ev) {
        if (ev.target && ev.target.closest && ev.target.closest(".dragon-cl-tile-x")) return;
        startTileDrag(ev, t, d);
      });
      stageEl.appendChild(d);
      t.el = d;
    });
    var c = document.getElementById("dragonClCount");
    if (c) c.textContent = state.tiles.length + " on the canvas";
    // 🔍 W-UI252 — the zoom readout is painted by renderStage, so every route that changes the zoom (the
    // pair of buttons, ⤢ Fit, or the check-up) shows the same percentage.
    var zl = document.getElementById("dragonClZoom");
    if (zl) zl.textContent = Math.round((state.zoom || 1) * 100) + "%";
  }
  function removeTile(id) {
    var had = state.tiles.length;
    state.tiles = state.tiles.filter(function (t) { return t.id !== id; });
    if (state.tiles.length === had) return;
    renderStage();
    try { toast("\u2715 picture removed from the collage"); } catch (e) {}
  }

  function startTileDrag(ev, t, el) {
    if (ev.button !== undefined && ev.button !== 0) return;
    ev.preventDefault();
    var rect = stageEl.getBoundingClientRect();
    var px = (ev.clientX - rect.left) / rect.width * 100;
    var py = (ev.clientY - rect.top) / rect.height * 100;
    var gr = zRect(t);
    var offX = px - gr.x, offY = py - gr.y;
    t.z = ++state.z;
    el.style.zIndex = String(t.z);
    hideHint();
    try { el.setPointerCapture(ev.pointerId); } catch (e) {}
    function move(e2) {
      var nx = (e2.clientX - rect.left) / rect.width * 100 - offX;
      var ny = (e2.clientY - rect.top) / rect.height * 100 - offY;
      t.x = Math.max(-t.w + 10, Math.min(100 - 10, nx));
      t.y = Math.max(-t.h + 10, Math.min(100 - 10, ny));
      el.style.left = t.x + "%"; el.style.top = t.y + "%";
    }
    function up() {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    }
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  }

  // A copy dropped onto the stage (from the left strip) lands where the finger let go.
  function addManualTile(item, nx, ny) {
    var w = 30, h = 30;
    var t = {
      id: "t" + (++tileSeq), url: item.url,
      x: Math.max(0, Math.min(100 - w, nx - w / 2)),
      y: Math.max(0, Math.min(100 - h, ny - h / 2)),
      w: w, h: h, z: ++state.z
    };
    state.tiles.push(t);
    renderStage();
    // 🧩 W-UI252 (third round) — Egon: "when I click a picture in the list on the left it is added to the
    // middle of the collage window — show a toast for that."
    try { toast("\uD83E\uDDE9 picture added to the canvas (" + state.tiles.length + ")"); } catch (e) {}
  }

  function hideHint() { if (hintEl) { try { hintEl.remove(); } catch (e) {} hintEl = null; } }

  /* --------------------------------------------------------------- renderers -- */
  function buildStrip() {
    if (!stripEl) return;
    stripEl.innerHTML = "";
    state.items.forEach(function (it) {
      var im = document.createElement("img");
      im.className = "dragon-cl-thumb";
      im.src = it.url; im.alt = ""; im.draggable = false;
      im.title = "Drag onto the canvas (or tap) to add a copy";
      im.addEventListener("pointerdown", function (ev) { startStripDrag(ev, it); });
      stripEl.appendChild(im);
    });
  }

  function startStripDrag(ev, item) {
    if (ev.button !== undefined && ev.button !== 0) return;
    ev.preventDefault();
    var ghost = document.createElement("img");
    ghost.src = item.url;
    ghost.style.cssText = "position:fixed; width:64px; height:64px; object-fit:cover; border-radius:8px; opacity:.85; pointer-events:none; z-index:2147483600; transform:translate(-50%,-50%);";
    ghost.style.left = ev.clientX + "px"; ghost.style.top = ev.clientY + "px";
    document.body.appendChild(ghost);
    var moved = false;
    function move(e2) {
      if (Math.abs(e2.clientX - ev.clientX) + Math.abs(e2.clientY - ev.clientY) > 6) moved = true;
      ghost.style.left = e2.clientX + "px"; ghost.style.top = e2.clientY + "px";
    }
    function up(e2) {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      try { ghost.remove(); } catch (e) {}
      hideHint();
      if (!stageEl) return;
      var r = stageEl.getBoundingClientRect();
      var over = e2.clientX >= r.left && e2.clientX <= r.right && e2.clientY >= r.top && e2.clientY <= r.bottom;
      if (!moved || !over) { addManualTile(item, 50, 50); return; }
      addManualTile(item, (e2.clientX - r.left) / r.width * 100, (e2.clientY - r.top) / r.height * 100);
    }
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  }

  /* ----------------------------------------------------------- the PICKER UI -- */
  // 🗂️ Egon 23.09.2026 (W-UI234) — ONLY the visitor's own gallery. The picker used to offer a "Public
  // gallery" tab fed by whatever tiles happened to be painted in the public gallery; Egon saw overlapped
  // pictures and pictures that were not really in the gallery (blocked ones, stale tiles), so the tab is
  // gone. Everything now comes from the device's own vault stores — deduplicated by picture id, so the
  // same picture can never appear twice, and nothing can be offered that the visitor does not actually own.
  // (The removed public-image reader is parked in the Librarybook DEPO.)
  function vaultFolderNames() {
    var names = ["general"];
    try { var raw = JSON.parse(localStorage["localMediaGallery_.names"] || '["general"]'); if (raw && raw.length) names = raw; } catch (e) {}
    return names.map(function (n) { return String(n); });
  }
  // 🧩 W-UI252 (Egon 24.09.2026) — "the collage folder made by Save to my gallery is not in the
  // private gallery, it is not in the folder menu". The save always wrote the folder into the SAME key the
  // create-media-gallery plugin reads (`localMediaGallery_.names`), but a gallery window that was ALREADY
  // open kept the option list it built at open time, and a visitor who had never saved a collage had no
  // "Collages" entry at all. So: the folder is registered the moment this module loads, and every
  // registration patches any gallery window that is already on screen.
  function registerFolder(name) {
    if (!name) return;
    try {
      var list = JSON.parse(localStorage["localMediaGallery_.names"] || '["general"]');
      if (!Array.isArray(list) || !list.length) list = ["general"];
      if (list.indexOf(name) === -1) { list.push(name); localStorage["localMediaGallery_.names"] = JSON.stringify(list); }
    } catch (e) { try { localStorage["localMediaGallery_.names"] = JSON.stringify(["general", name]); } catch (e2) {} }
    try {
      var root = document.getElementById("localMediaGallery_root");
      if (!root) return;
      var sels = root.querySelectorAll("select");
      for (var i = 0; i < sels.length; i++) {
        var s = sels[i], anchor = s.querySelector('option[value="__new__"]');
        if (!anchor) continue;
        var has = false;
        for (var j = 0; j < s.options.length; j++) if (s.options[j].value === name) { has = true; break; }
        if (has) continue;
        var o = document.createElement("option");
        o.value = name; o.textContent = name;
        s.insertBefore(o, anchor);
      }
    } catch (e) {}
  }
  window.dragonVaultRegisterFolder = registerFolder;
  registerFolder(COLLAGE_FOLDER);
  // 📁 W-UI252 — the folder LIST only (no pictures read), so a folder holding 1618 records answers in
  // a few milliseconds; the thumbnails themselves are fetched one by one as the visitor scrolls.
  function vaultImageIds(folder) {
    return new Promise(function (resolve) {
      var names = vaultFolderNames();
      if (folder && folder !== "*") names = [String(folder)];
      var ids = [], seen = {};
      (async function () {
        for (var i = 0; i < names.length; i++) {
          try {
            var db = await window.dragonOpenIDB("localMediaGallery_." + names[i] + "-db-kv-plugin");
            var recs = await window.dragonStoreAll(db);
            for (var j = 0; j < (recs || []).length; j++) {
              var id = recs[j] && recs[j].id;
              if (id == null) continue;
              var k = String(id);
              if (!seen[k]) { seen[k] = 1; ids.push(k); }
            }
          } catch (e) {}
        }
        ids.sort(function (a, b) { var na = parseFloat(a), nb = parseFloat(b); return (isNaN(na) || isNaN(nb)) ? (a < b ? 1 : -1) : (nb - na); });
        resolve(ids.slice(0, VAULT_SCAN_MAX));
      })();
    });
  }
  // one record id → a fresh object URL (minted on demand, released again by releaseCells/the LRU trim)
  function vaultBlobUrl(id) {
    return Promise.resolve()
      .then(function () { return window.dragonVaultBlobGet(id); })
      .then(function (rec) {
        var b = rec ? ((rec instanceof Blob) ? rec : (window.dragonToBlob ? window.dragonToBlob(rec) : null)) : null;
        return b ? URL.createObjectURL(b) : null;
      })
      .catch(function () { return null; });
  }
  function closePicker() {
    if (!pickEl) return;
    var el = pickEl; pickEl = null;
    try { el.remove(); } catch (e) {}
    releaseCells();
    if (!_suppressClose) {
      picked.forEach(function (it) { if (it.kind === "vault" && it.url && it.url.indexOf("blob:") === 0) { try { URL.revokeObjectURL(it.url); } catch (e) {} } });
      // 🧩 W-UI252 — the main picture is a copy WE minted to keep it alive; the editor underneath still owns
      // its own handle, so this one goes when the picker does. (The collage itself holds its own blob.)
      if (_mainItem && _mainItem.minted && _mainItem.url) {
        try { URL.revokeObjectURL(_mainItem.url); } catch (e) {}
      }
    }
    picked = [];
    document.removeEventListener("keydown", pickEsc);
    if (!_suppressClose) fireCloseIfIdle();
  }
  // W-UI252: switching folders repaints the grid, so the blob URLs of the folder we are leaving must be
  // released — EXCEPT any that the visitor has already picked (those are handed to the editor later).
  function releaseCells() {
    for (var i = 0; i < cellUrls.length; i++) {
      var u = cellUrls[i], keep = false;
      for (var j = 0; j < picked.length; j++) if (picked[j] && picked[j].url === u) { keep = true; break; }
      if (!keep) { try { URL.revokeObjectURL(u); } catch (e) {} }
    }
    cellUrls = [];
  }
  function pickEsc(ev) { if (ev.key === "Escape") closePicker(); }

  // 🧩 Egon 23.09.2026 — the caller can hand in an onClose callback, fired once the picker AND the editor
  // AND the result window are all gone. The ✏️ Image Editor uses it to stay hidden behind the collage
  // windows and to come back the moment the visitor is done (the collage overlay sits UNDER the editor).
  var _onCloseCb = null;
  // 🧩 When the picker HANDS OVER to the editor (Create collage) the picked blob URLs must NOT be revoked,
  // and the onClose callback must NOT fire (that would bring the ✏️ Image Editor back on top of the collage).
  // While this flag is set the picker closes silently and the editor takes ownership of the pictures.
  var _suppressClose = false;
  function fireCloseIfIdle() {
    if (pickEl || editEl || resultEl) return;
    var cb = _onCloseCb; _onCloseCb = null;
    if (cb) { try { cb(); } catch (e) {} }
  }

  function openPicker() {
    if (pickEl || editEl) return;
    css();
    picked = [];
    var totalIds = null;        // how many pictures the chosen folder holds
    var io = null;              // the lazy thumbnail loader
    var ov = document.createElement("div");
    ov.className = "dragon-cl-ov"; ov.id = "dragonCollagePick";
    var card = document.createElement("div");
    card.className = "dragon-cl-card";
    card.style.maxWidth = "min(62rem, 96vw)";
    card.style.maxHeight = "90vh";
    var head = document.createElement("div");
    head.className = "dragon-cl-head";
    var t = document.createElement("div");
    t.className = "dragon-cl-ttl"; t.textContent = "\uD83E\uDDE9 Collage \u2014 pick pictures from your Private Gallery (your Likes)";
    var xb = document.createElement("button");
    xb.type = "button"; xb.className = "dragon-cl-x"; xb.textContent = "\u2715"; xb.title = "Close";
    head.appendChild(t); head.appendChild(xb);
    var grid = document.createElement("div");
    grid.className = "dragon-cl-grid";
    // 🧩 W-UI252 (Egon 24.09.2026) — "USE MAIN IMAGE": the collage button lives in the Image Editor of a
    // chosen picture because the collage is meant to be made ON that picture, so that picture is part of the
    // collage BY DEFAULT. The tick box is how the visitor takes it out again.
    var mainRow = null;
    if (_mainItem && _mainItem.url) {
      mainRow = document.createElement("div");
      mainRow.className = "dragon-cl-main";
      var mimg = document.createElement("img");
      mimg.src = _mainItem.url; mimg.alt = "";
      var mlab = document.createElement("label");
      var mchk = document.createElement("input");
      mchk.type = "checkbox"; mchk.id = "dragonClUseMain"; mchk.checked = _mainOn;
      mchk.onchange = function () { _mainOn = mchk.checked; paintCount(); };
      mlab.htmlFor = "dragonClUseMain";
      mlab.appendChild(mchk);
      mlab.appendChild(document.createTextNode(" Use main image"));
      var mhint = document.createElement("span");
      mhint.className = "dragon-cl-mainhint";
      mhint.textContent = "the picture you opened the collage from \u2014 it is in the collage unless you untick this";
      mainRow.append(mimg, mlab, mhint);
    }
    // 📁 W-UI252 — the FOLDER dropdown (a real select, so it is keyboard- and touch-friendly on every
    // device). Egon 24.09.2026: the "All folders" choice is GONE and the picker opens on "general".
    var fbar = document.createElement("div");
    fbar.className = "dragon-cl-fbar";
    var flab = document.createElement("span");
    flab.className = "dragon-cl-flab";
    flab.textContent = "\uD83D\uDCC1 Folder";
    var fsel = document.createElement("select");
    if (window.dragonStyleSelect) window.dragonStyleSelect(fsel);
    fsel.id = "dragonClFolder";
    fsel.className = "dragon-cl-sel";
    fsel.title = "Choose a folder of your private gallery";
    var fcount = document.createElement("span");
    fcount.className = "dragon-cl-fcount";
    function fillFolders() {
      var names = vaultFolderNames();
      fsel.innerHTML = "";
      for (var i = 0; i < names.length; i++) {
        var o = document.createElement("option");
        o.value = names[i]; o.textContent = names[i];
        fsel.appendChild(o);
      }
      fsel.value = (names.indexOf("general") !== -1) ? "general" : (names[0] || "general");
    }
    fbar.append(flab, fsel, fcount);
    var foot = document.createElement("div");
    foot.className = "dragon-cl-foot";
    var count = document.createElement("div");
    count.id = "dragonClPickCount";
    count.style.cssText = "flex:1 1 auto; font-size:.72rem; color:#b9aee0;";
    var create = document.createElement("button");
    create.type = "button"; create.className = "dragon-cl-btn pri"; create.id = "dragonClCreate";
    create.textContent = "Create collage \u2192"; create.disabled = true;
    foot.appendChild(count); foot.appendChild(create);
    card.appendChild(head);
    if (mainRow) card.appendChild(mainRow);
    card.appendChild(fbar); card.appendChild(grid); card.appendChild(foot);
    ov.appendChild(card);
    document.body.appendChild(ov);
    pickEl = ov;

    // the FINAL list handed to the editor: the main picture (if ticked) first, then the grid picks in tap order
    function finalItems() {
      var out = [];
      if (_mainOn && _mainItem && _mainItem.url) out.push(_mainItem);
      for (var i = 0; i < picked.length; i++) out.push(picked[i]);
      return out;
    }
    // 🔢 W-UI252 (Egon 24.09.2026) — "Total N \u00b7 Selected N \u00b7 Max 100" (the Total reads leftmost).
    function paintCount() {
      var sel = finalItems().length;
      count.textContent = "Total " + (totalIds == null ? "\u2026" : totalIds) + " \u00b7 Selected " + sel + " \u00b7 Max " + MAX_PICK;
      create.disabled = sel < 2;
    }
    // one cell = one record id; the picture inside is fetched only when the cell scrolls into view, so a
    // folder with 1618 records still opens instantly and never holds 1618 pictures in memory at once.
    function loadCell(cell) {
      if (!cell) return Promise.resolve(null);
      if (cell.__url) return Promise.resolve(cell.__url);
      // a tap that lands while the thumbnail is still being read must NOT be lost: the SAME in-flight promise
      // is handed back, so pickCell runs again the moment the picture is there.
      if (cell.__loadPromise) return cell.__loadPromise;
      cell.__loadPromise = vaultBlobUrl(cell.__id).then(function (u) {
        cell.__loadPromise = null;
        if (!pickEl) { if (u) { try { URL.revokeObjectURL(u); } catch (e) {} } return null; }
        if (!u) { cell.classList.add("missing"); return null; }
        cell.__url = u; cellUrls.push(u);
        var im = cell.querySelector("img");
        if (im) im.src = u;
        trim(u);
        return u;
      });
      return cell.__loadPromise;
    }
    function trim(justAdded) {
      if (cellUrls.length <= LOAD_BUDGET) return;
      var cells = grid.querySelectorAll(".dragon-cl-cell");
      var vh = window.innerHeight || 800;
      for (var i = 0; i < cells.length && cellUrls.length > LOAD_BUDGET; i++) {
        var c = cells[i];
        if (!c.__url || c.__url === justAdded) continue;
        var r = c.getBoundingClientRect();
        if (r.bottom > -700 && r.top < vh + 700) continue;   // still near the viewport \u2192 keep
        var keep = false;
        for (var j = 0; j < picked.length; j++) if (picked[j].url === c.__url) { keep = true; break; }
        if (keep) continue;
        dropCellUrl(c);
      }
    }
    function dropCellUrl(c) {
      var u = c.__url; if (!u) return;
      c.__url = null;
      var im = c.querySelector("img"); if (im) im.removeAttribute("src");
      var k = cellUrls.indexOf(u); if (k >= 0) cellUrls.splice(k, 1);
      try { URL.revokeObjectURL(u); } catch (e) {}
    }
    function paintCell(cell) {
      var b = cell.querySelector(".dragon-cl-ord"), pos = -1;
      for (var i = 0; i < picked.length; i++) if (picked[i].id === cell.__id) { pos = i; break; }
      if (pos < 0) { cell.classList.remove("on"); if (b) b.remove(); return; }
      cell.classList.add("on");
      if (!b) { b = document.createElement("span"); b.className = "dragon-cl-ord"; cell.appendChild(b); }
      b.textContent = String(pos + 1);
    }
    function indexOfCell(cell) {
      for (var i = 0; i < picked.length; i++) if (picked[i].id === cell.__id) return i;
      return -1;
    }
    function pickCell(cell) {
      var at = indexOfCell(cell);
      if (at >= 0) { picked.splice(at, 1); paintCell(cell); renumber(); paintCount(); toast("\u2796 removed from the collage"); return; }
      if (picked.length >= MAX_PICK) { toast("\uD83E\uDDE9 up to " + MAX_PICK + " pictures"); return; }
      if (!cell.__url) { loadCell(cell).then(function (u) { if (u) pickCell(cell); }); return; }
      picked.push({ id: cell.__id, url: cell.__url, kind: "vault" });
      paintCell(cell); paintCount();
      // 🧩 W-UI252 (third round) — feedback for every pick (Egon asked for a toast when a picture is added).
      toast("\uD83E\uDDE9 added to the collage \u2014 " + picked.length + "/" + MAX_PICK);
    }
    function renumber() {
      var cells = grid.querySelectorAll(".dragon-cl-cell");
      for (var i = 0; i < cells.length; i++) paintCell(cells[i]);
    }
    function observe() {
      if (io) { try { io.disconnect(); } catch (e) {} io = null; }
      var cells = grid.querySelectorAll(".dragon-cl-cell");
      var obsFn = window.IntersectionObserver ? new IntersectionObserver(function (es) {
        es.forEach(function (en) { if (en.isIntersecting) loadCell(en.target); });
      }, { root: grid, rootMargin: "500px 0px" }) : null;
      io = obsFn;
      for (var i = 0; i < cells.length; i++) {
        (function (c) { c.onclick = function () { pickCell(c); }; })(cells[i]);
        if (obsFn) obsFn.observe(cells[i]); else loadCell(cells[i]);
      }
    }
    // 🧩 W-UI252 — "Add more images": mark the editor's pictures again as soon as their folder paints.
    function applyCarry() {
      if (!_carry || !_carry.length) return;
      var map = grid.__byId || {}, left = [];
      for (var i = 0; i < _carry.length; i++) {
        var it = _carry[i], c = map[it.id];
        if (!c) { left.push(it); continue; }
        if (!c.__url) { c.__url = it.url; cellUrls.push(it.url); var im = c.querySelector("img"); if (im) im.src = it.url; }
        if (indexOfCell(c) < 0 && picked.length < MAX_PICK) { picked.push({ id: c.__id, url: c.__url, kind: "vault" }); paintCell(c); }
      }
      _carry = left.length ? left : null;
      paintCount();
    }
    function draw(ids, emptyMsg) {
      grid.innerHTML = "";
      grid.__byId = {};
      if (!ids.length) {
        var e = document.createElement("div");
        e.className = "dragon-cl-loading";
        e.textContent = emptyMsg;
        grid.appendChild(e);
        return;
      }
      var frag = document.createDocumentFragment();
      for (var i = 0; i < ids.length; i++) {
        var cell = document.createElement("div");
        cell.className = "dragon-cl-cell";
        cell.__id = ids[i];
        cell.title = "Tap to add / remove this picture";
        var im = document.createElement("img");
        im.alt = ""; im.loading = "lazy"; im.decoding = "async";
        cell.appendChild(im);
        grid.__byId[ids[i]] = cell;
        frag.appendChild(cell);
      }
      grid.appendChild(frag);
      observe();
      applyCarry();
    }
    function showFolder(folder) {
      releaseCells();
      if (io) { try { io.disconnect(); } catch (e) {} io = null; }
      totalIds = null;
      paintCount();
      var ld = document.createElement("div");
      ld.className = "dragon-cl-loading";
      ld.textContent = "Reading your gallery\u2026";
      grid.innerHTML = ""; grid.appendChild(ld);
      fcount.textContent = "reading\u2026";
      vaultImageIds(folder).then(function (ids) {
        if (!pickEl) return;
        totalIds = ids.length;
        lastTotal = ids.length;
        fcount.textContent = ids.length + (ids.length === 1 ? " picture" : " pictures");
        draw(ids, folder ? "This folder is empty." : "Your private gallery is empty \u2014 save a few pictures first.");
        paintCount();
      });
    }
    fsel.onchange = function () { showFolder(fsel.value); };
    xb.onclick = closePicker;
    ov.addEventListener("click", function (e) { if (e.target === ov) closePicker(); });
    document.addEventListener("keydown", pickEsc);
    create.onclick = function () {
      var items = finalItems();
      if (items.length < 2) return;
      create.disabled = true;
      Promise.all(items.map(function (it) {
        if (it.url) return Promise.resolve(it);
        return vaultBlobUrl(it.id).then(function (u) { return u ? { id: it.id, url: u, kind: "vault" } : null; });
      })).then(function (res) {
        var live = [];
        for (var i = 0; i < res.length; i++) if (res[i]) live.push(res[i]);
        if (live.length < 2) { toast("\uD83E\uDDE9 those pictures could not be read"); create.disabled = false; return; }
        _suppressClose = true;
        try { closePicker(); } finally { _suppressClose = false; }
        openEditor(live);
      });
    };
    paintCount();
    fillFolders();
    showFolder(fsel.value);
  }  window.dragonCollageFolders = function () { return vaultFolderNames(); };

  /* ----------------------------------------------------------- the EDITOR UI -- */
  function closeEditor() {
    if (!editEl) return;
    var el = editEl; editEl = null;
    try { el.remove(); } catch (e) {}
    state.items.forEach(function (it) { if (it.kind === "vault" && it.url && it.url.indexOf("blob:") === 0) { try { URL.revokeObjectURL(it.url); } catch (e) {} } });
    state = { items: [], tiles: [], aspect: "1:1", bg: "#0d0d13", z: 1, pattern: "grid2" };
    stageEl = null; stripEl = null; hintEl = null;
    document.removeEventListener("keydown", editEsc);
    fireCloseIfIdle();
  }
  function editEsc(ev) { if (ev.key === "Escape") { if (resultEl) closeResult(); else closeEditor(); } }

  function openEditor(items) {
    if (editEl) return;
    css();
    state.items = items.slice();
    state.tiles = [];
    state.aspect = "1:1";
    state.bg = BGS[0];
    state.z = 1;
    state.pattern = "grid2";
    state.zoom = 1;
    // 🧩 W-UI252 (third round) — Egon: "the pictures in the collage window must always be shown at FULL size;
    // right now it looks like a cropped view." The editor therefore STARTS in "whole picture" mode; the
    // 📐 button still switches to fill-the-tile (crop) for anyone who wants the tight mosaic look.
    state.fit = "contain";
    tileSeq = 0;
    state.tiles = items.map(function (it, i) {
      var r = layoutFor("grid2", items.length)[i] || { x: 0, y: 0, w: 50, h: 50 };
      return { id: "t" + (i + 1), url: it.url, x: r.x, y: r.y, w: r.w, h: r.h, z: i + 1 };
    });
    state.z = items.length + 1;

    var ov = document.createElement("div");
    ov.className = "dragon-cl-ov"; ov.id = "dragonCollageEditor";
    var card = document.createElement("div");
    card.className = "dragon-cl-card";
    card.style.maxWidth = "min(76rem, 98vw)";
    card.style.height = "min(94vh, 60rem)";
    card.style.maxHeight = "94vh";

    var head = document.createElement("div");
    head.className = "dragon-cl-head";
    var t = document.createElement("div");
    t.className = "dragon-cl-ttl"; t.textContent = "\uD83E\uDDE9 Collage editor";
    // 🚧 W-UI252 (Egon 25.09.2026) — Egon: "write WORK IN PROGRESS on the collage window; I don't have time
    // for this right now, do what I said and we'll look at it later."
    var wip = document.createElement("span");
    wip.className = "dragon-cl-wip";
    wip.textContent = "\uD83D\uDEA7 work in progress";
    wip.title = "This window is still being built \u2014 the controls are usable, but expect rough edges";
    var cnt = document.createElement("div");
    cnt.id = "dragonClCount";
    cnt.style.cssText = "font-size:.72rem; color:#b9aee0; margin-right:.3rem;";
    var xb = document.createElement("button");
    xb.type = "button"; xb.className = "dragon-cl-x"; xb.textContent = "\u2715"; xb.title = "Close";
    head.appendChild(t); head.appendChild(wip); head.appendChild(cnt); head.appendChild(xb);

    var body = document.createElement("div");
    body.className = "dragon-cl-body";
    var strip = document.createElement("div");
    strip.className = "dragon-cl-strip";
    var wrap = document.createElement("div");
    wrap.className = "dragon-cl-stagewrap";
    var stage = document.createElement("div");
    stage.className = "dragon-cl-stage";
    stage.id = "dragonClStage";
    var hint = document.createElement("div");
    hint.className = "dragon-cl-hint";
    hint.textContent = "\u270B drag a picture onto the canvas";
    wrap.appendChild(stage); wrap.appendChild(hint);
    body.appendChild(strip); body.appendChild(wrap);

    // 🧩 W-UI252 (Egon 25.09.2026 third round) — THE CONTROL BAR MOVED TO THE TOP. Egon: "the Auto grid button
    // and the whole picture / fill the tile buttons end up BELOW the picture area, and even Done is not
    // visible. Either make the picture area an embedded paper preview inside the window (like the editor) and
    // put these buttons above the left selection row, or add a new button/control row at the top." Both: the
    // controls are now a full-width bar directly under the title, and the only thing left at the bottom is the
    // action row (➕ Add more images · ✓ Done), which can never be pushed out of view.
    var foot = document.createElement("div");
    foot.className = "dragon-cl-ctrl";
    PATTERNS.forEach(function (p) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "dragon-cl-btn dragon-cl-pattern";
      b.setAttribute("data-pattern", p.id);
      b.textContent = p.label;
      if (p.id === state.pattern) b.classList.add("pri");
      b.onclick = function () {
        applyPattern(p.id);
        Array.prototype.forEach.call(foot.querySelectorAll(".dragon-cl-pattern"), function (o) { o.classList.remove("pri"); });
        b.classList.add("pri");
      };
      foot.appendChild(b);
    });
    var asp = document.createElement("select");
    if (window.dragonStyleSelect) window.dragonStyleSelect(asp);
    asp.id = "dragonClAspect";
    asp.style.cssText = "font-size:.74rem; padding:.3rem; border-radius:8px; border:1px solid rgba(155,107,255,.5); background:#15151c; color:#d8c9ff;";
    ASPECTS.forEach(function (a) {
      var o = document.createElement("option"); o.value = a.id; o.textContent = a.id;
      if (a.id === state.aspect) o.selected = true;
      asp.appendChild(o);
    });
    asp.onchange = function () { state.aspect = asp.value; renderStage(); };
    foot.appendChild(asp);
    BGS.forEach(function (col) {
      var sw = document.createElement("button");
      sw.type = "button"; sw.className = "dragon-cl-bg";
      sw.setAttribute("data-bg", col);
      sw.title = "Background " + col;
      sw.style.cssText = "width:22px; height:22px; border-radius:50%; border:2px solid rgba(155,107,255,.6); background:" + col + "; cursor:pointer;";
      sw.onclick = function () { state.bg = col; renderStage(); };
      foot.appendChild(sw);
    });
    // 🔍 W-UI252 (Egon 24.09.2026) — ONE zoom for EVERY tile, plus the cover/contain switch. Egon:
    // "15 pictures get cropped and shrunk — instead it should zoom out / shrink the pictures to fit, and
    // there should be a zoom in / zoom out that acts on each of them, not on one specific picture".
    var zoomWrap = document.createElement("div");
    zoomWrap.className = "dragon-cl-zoom";
    var zOut = document.createElement("button");
    zOut.type = "button"; zOut.className = "dragon-cl-zbtn"; zOut.id = "dragonClZoomOut";
    zOut.textContent = "\uD83D\uDD0D\u2212"; zOut.title = "Smaller \u2014 every picture on the canvas shrinks together";
    var zLab = document.createElement("span");
    zLab.id = "dragonClZoom"; zLab.textContent = "100%";
    zLab.style.cssText = "min-width:2.7rem; text-align:center;";
    var zIn = document.createElement("button");
    zIn.type = "button"; zIn.className = "dragon-cl-zbtn"; zIn.id = "dragonClZoomIn";
    zIn.textContent = "\uD83D\uDD0D+"; zIn.title = "Bigger \u2014 every picture on the canvas grows together";
    var zFit = document.createElement("button");
    zFit.type = "button"; zFit.className = "dragon-cl-zbtn"; zFit.id = "dragonClZoomFit";
    zFit.textContent = "\u2922 Fit"; zFit.title = "Back to the pattern\u2019s own size (100%)";
    ;function setZoom(z) {
      state.zoom = Math.max(0.15, Math.min(3, z));
      zLab.textContent = Math.round(state.zoom * 100) + "%";
      renderStage();
    }
    zOut.onclick = function () { setZoom((state.zoom || 1) / 1.12); };
    zIn.onclick = function () { setZoom((state.zoom || 1) * 1.12); };
    zFit.onclick = function () { setZoom(1); };
    zoomWrap.append(zOut, zLab, zIn, zFit);
    foot.appendChild(zoomWrap);
    var fitBtn = document.createElement("button");
    fitBtn.type = "button"; fitBtn.className = "dragon-cl-btn"; fitBtn.id = "dragonClFit";
    fitBtn.title = "How each picture sits in its place \u2014 fill it (the overflowing edges are cropped) or show the WHOLE picture";
    ;function syncFit() { fitBtn.textContent = (state.fit === "contain") ? "\u2921 Whole picture" : "\u25A3 Fill the tiles"; }
    fitBtn.onclick = function () { state.fit = (state.fit === "contain") ? "cover" : "contain"; syncFit(); renderStage(); };
    syncFit();
    foot.appendChild(fitBtn);
    // 🧩 W-UI252 (third round) — MORE COLLAGE OPTIONS, as Egon asked ("add other collage options: random order,
    // random picture sizes, etc.").
    var shufBtn = document.createElement("button");
    shufBtn.type = "button"; shufBtn.className = "dragon-cl-btn"; shufBtn.id = "dragonClShuffle";
    shufBtn.textContent = "\uD83D\uDD00 Shuffle";
    shufBtn.title = "Random order \u2014 the pictures are dealt into the tiles in a random order (and re-stacked)";
    shufBtn.onclick = function () {
      var ts = state.tiles;
      for (var i = ts.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = ts[i].url; ts[i].url = ts[j].url; ts[j].url = tmp;
      }
      for (var k = 0; k < ts.length; k++) ts[k].z = k + 1;
      state.z = ts.length + 1;
      renderStage();
      toast("\uD83D\uDD00 pictures shuffled");
    };
    foot.appendChild(shufBtn);
    var rndBtn = document.createElement("button");
    rndBtn.type = "button"; rndBtn.className = "dragon-cl-btn"; rndBtn.id = "dragonClRandomSize";
    rndBtn.textContent = "\uD83C\uDFB2 Random sizes";
    rndBtn.title = "Give every tile a random size (and re-stack them) \u2014 each picture keeps its own proportions, the tiles overlap like a scrapbook";
    rndBtn.onclick = function () {
      var pat = PATTERNS.filter(function (p) { return p.id === state.pattern; })[0];
      var base = layoutFor(state.pattern, state.tiles.length);
      state.tiles.forEach(function (t, i) {
        var r = base[i] || { x: 0, y: 0, w: 50, h: 50 };
        var f = 0.62 + Math.random() * 0.95;
        t.x = Math.max(0, Math.min(100 - 6, r.x + (Math.random() * 12 - 6)));
        t.y = Math.max(0, Math.min(100 - 6, r.y + (Math.random() * 12 - 6)));
        t.w = Math.max(12, Math.min(96, r.w * f));
        t.h = Math.max(12, Math.min(96, r.h * (0.72 + Math.random() * 0.7)));
        t.z = i + 1;
      });
      state.z = state.tiles.length + 1;
      renderStage();
      toast("\uD83C\uDFB2 random tile sizes \u2014 drag them around");
    };
    foot.appendChild(rndBtn);
    // 🧩 W-UI252 (third round) — the ACTION ROW stays at the bottom and holds only two buttons, so ➕ Add more
    // images and ✓ Done are visible on every screen height.
    var tail = document.createElement("div");
    tail.className = "dragon-cl-foot";
    var more = document.createElement("button");
    more.type = "button"; more.className = "dragon-cl-btn";
    more.textContent = "\u2795 Add more images";
    more.onclick = function () {
      // 🧩 W-UI252 — the picks survive the trip: each picture is copied into a FRESH blob URL before the
      // editor closes (closing revokes the ones the editor was holding), and the picker pre-selects them again.
      var keep = state.items.slice();
      Promise.all(keep.map(function (it) {
        return urlToBlob(it.url).then(function (b) { return { id: it.id, url: b ? URL.createObjectURL(b) : null, kind: it.kind }; });
      })).then(function (list) {
        _carry = [];
        for (var i = 0; i < list.length; i++) if (list[i].url) _carry.push(list[i]);
        _suppressClose = true;
        try { closeEditor(); } finally { _suppressClose = false; }
        openPicker();
      });
    };
    tail.appendChild(more);
    var done = document.createElement("button");
    done.type = "button"; done.className = "dragon-cl-btn pri";
    done.id = "dragonClDone";
    done.textContent = "\u2713 Done";
    done.title = "Finish the collage and build the picture";
    done.onclick = function () { renderResult(); };
    tail.appendChild(done);
    var tailNote = document.createElement("span");
    tailNote.className = "dragon-cl-tailnote";
    tailNote.textContent = "drag a picture on the canvas to move it \u2014 \u2715 removes it";
    tail.appendChild(tailNote);

    card.appendChild(head); card.appendChild(foot); card.appendChild(body); card.appendChild(tail);
    ov.appendChild(card);
    document.body.appendChild(ov);
    editEl = ov;
    stageEl = stage; stripEl = strip; hintEl = hint;

    renderStage();
    buildStrip();
    xb.onclick = closeEditor;
    ov.addEventListener("click", function (e) { if (e.target === ov) closeEditor(); });
    document.addEventListener("keydown", editEsc);
    // 🧩 W-UI252 (third round) — the paper preview re-measures with the window (see fitStage).
    if (!window.__dragonCollageFitResize) {
      window.__dragonCollageFitResize = true;
      window.addEventListener("resize", function () { if (editEl) { try { fitStage(); } catch (e) {} } });
    }
    setTimeout(function () { if (hintEl === hint) hideHint(); }, 9000);
    // one more measurement once the browser has finished laying the freshly-appended card out
    setTimeout(function () { if (editEl) { try { fitStage(); } catch (e) {} } }, 90);
  }

  /* -------------------------------------------------------------- the RESULT -- */
  async function exportBlob() {
    var px = aspectPx(state.aspect);
    var W = px[0], H = px[1];
    var c = document.createElement("canvas");
    c.width = W; c.height = H;
    var g = c.getContext("2d");
    g.fillStyle = state.bg || "#0d0d13";
    g.fillRect(0, 0, W, H);
    var order = state.tiles.slice().sort(function (a, b) { return a.z - b.z; });
    for (var i = 0; i < order.length; i++) {
      var t = order[i];
      var b = await urlToBlob(t.url);
      if (!b) continue;
      var bmp = null;
      try { bmp = await createImageBitmap(b); } catch (e) { bmp = null; }
      if (!bmp) continue;
      // the PNG must show EXACTLY what the stage shows: the same zoomed slot, and the same cover/contain rule
      var rr = zRect(t);
      var dx = rr.x / 100 * W, dy = rr.y / 100 * H, dw = rr.w / 100 * W, dh = rr.h / 100 * H;
      if (state.fit === "contain") {
        var sc = Math.min(dw / (bmp.width || 1), dh / (bmp.height || 1));
        var iw = (bmp.width || 1) * sc, ih = (bmp.height || 1) * sc;
        g.drawImage(bmp, dx + (dw - iw) / 2, dy + (dh - ih) / 2, iw, ih);
      } else {
        g.drawImage(bmp, dx, dy, dw, dh);
      }
      try { bmp.close(); } catch (e) {}
    }
    return await new Promise(function (res) { c.toBlob(function (b) { res(b); }, "image/png"); });
  }

  function closeResult() {
    if (!resultEl) return;
    try { resultEl.remove(); } catch (e) {}
    resultEl = null;
    fireCloseIfIdle();
  }

  async function renderResult() {
    if (!editEl || resultEl) return;
    var ov = document.createElement("div");
    ov.className = "dragon-cl-ov"; ov.id = "dragonCollageResult";
    var card = document.createElement("div");
    card.className = "dragon-cl-card";
    card.style.maxWidth = "min(46rem, 96vw)";
    card.style.maxHeight = "92vh";
    var head = document.createElement("div");
    head.className = "dragon-cl-head";
    var t = document.createElement("div");
    t.className = "dragon-cl-ttl"; t.textContent = "\uD83E\uDDE9 Your collage";
    var xb = document.createElement("button");
    xb.type = "button"; xb.className = "dragon-cl-x"; xb.textContent = "\u2715"; xb.title = "Close";
    head.appendChild(t); head.appendChild(xb);
    var body = document.createElement("div");
    body.style.cssText = "flex:1 1 auto; overflow:auto; padding:.7rem; text-align:center;";
    var note = document.createElement("div");
    note.style.cssText = "font-size:.76rem; color:#b9aee0; padding:1rem;";
    note.textContent = "Rendering\u2026";
    body.appendChild(note);
    var foot = document.createElement("div");
    foot.className = "dragon-cl-foot";
    var dl = document.createElement("button");
    dl.type = "button"; dl.className = "dragon-cl-btn pri"; dl.id = "dragonClDownload";
    dl.textContent = "\u2B07\uFE0F Download PNG"; dl.disabled = true;
    var sv = document.createElement("button");
    sv.type = "button"; sv.className = "dragon-cl-btn"; sv.id = "dragonClSave";
    sv.textContent = "\uD83D\uDCBE Save to my gallery"; sv.disabled = true;
    // 🖨️ W-UI252 (Egon 24.09.2026) — "add a Print button and a Send to editor option (the visitor may want
    // to add text or emoji)". Both hand the finished collage to the ✏️ Image Editor — printing lives inside it,
    // so Print opens the editor and presses its 🖨️ Print for the visitor, while Send stops there.
    var prB = document.createElement("button");
    prB.type = "button"; prB.className = "dragon-cl-btn"; prB.id = "dragonClPrint";
    prB.textContent = "\uD83D\uDDA8\uFE0F Print"; prB.disabled = true;
    prB.title = "Open the Image Editor on this collage and go straight to printing it";
    var seB = document.createElement("button");
    seB.type = "button"; seB.className = "dragon-cl-btn"; seB.id = "dragonClSendEditor";
    seB.textContent = "\u270F\uFE0F Send to editor"; seB.disabled = true;
    seB.title = "Open the Image Editor on this collage \u2014 add your own text, emoji and a date, then print or share it";
    foot.appendChild(dl); foot.appendChild(sv); foot.appendChild(prB); foot.appendChild(seB);
    card.appendChild(head); card.appendChild(body); card.appendChild(foot);
    ov.appendChild(card);
    document.body.appendChild(ov);
    resultEl = ov;
    xb.onclick = closeResult;

    var blob = null;
    try { blob = await exportBlob(); } catch (e) { blob = null; }
    if (!resultEl) return;
    if (!blob) {
      note.textContent = "The collage could not be rendered \u2014 try removing the picture that failed to load.";
      return;
    }
    var url = URL.createObjectURL(blob);
    body.innerHTML = "";
    var img = document.createElement("img");
    img.src = url;
    img.style.cssText = "max-width:100%; max-height:70vh; border-radius:10px; box-shadow:0 10px 40px rgba(0,0,0,.6);";
    body.appendChild(img);
    dl.disabled = false; sv.disabled = false; prB.disabled = false; seB.disabled = false;
    // 🧩 W-UI252 — the collage URL is deliberately NOT revoked: the editor opened from here keeps its own
    // handle on it (its 🖨️ Print re-reads the same source), and a revoked blob URL would break it.
    function sendToEditor(alsoPrint) {
      var u = url, n = (state.items || []).length;
      _onCloseCb = null;                      // the collage flow is finished — never resurrect the editor behind it
      try { _suppressClose = true; window.dragonCollageClose(); } finally { _suppressClose = false; }
      setTimeout(function () {
        try { if (window.dragonPrintPreviewClose) window.dragonPrintPreviewClose(); } catch (e) {}
        if (!window.dragonPrintEditor) { toast("\u270F\uFE0F the Image Editor is not available right now"); return; }
        window.dragonPrintEditor({ url: u, prompt: "collage (" + n + " pictures)" });
        if (alsoPrint) setTimeout(function () {
          var pb = null;
          try { pb = document.querySelector("#dragonPrintPreview [data-pp='print']"); } catch (e) {}
          if (pb) pb.click();
        }, 320);
      }, 60);
    }
    prB.onclick = function () { sendToEditor(true); };
    seB.onclick = function () { sendToEditor(false); };
    dl.onclick = function () {
      var a = document.createElement("a");
      a.href = url; a.download = "bestaigen-collage-" + Date.now() + ".png";
      document.body.appendChild(a); a.click(); a.remove();
    };
    sv.onclick = function () {
      (async function () {
        try {
          var folder = COLLAGE_FOLDER;
          // 📁 W-UI252 (Egon 24.09.2026) — "the collage folder is not in the private gallery / not in the
          // folder menu": write it through the SHARED registrar, which also patches a gallery window that is
          // already open, so the option is there the moment the toast appears.
          registerFolder(folder);
          await window.t2i_privateGallery.add(blob, { folder: folder, info: { prompt: "collage (" + state.items.length + " images)", negativePrompt: "", seed: null, guidanceScale: null } });
          if (window.dragonStatsListedGalleries) { try { window.dragonStatsListedGalleries(); } catch (e) {} }
          toast("\uD83E\uDDE9 saved to \u201C" + folder + "\u201D \u2014 it is in your gallery\u2019s \uD83D\uDCC1 folder menu");
        } catch (e) { toast("couldn't save the collage"); }
      })();
    };
  }
  /* ------------------------------------------------------------------- api -- */
  window.dragonCollageVersion = VERSION;
  // 🧩 W-UI252 (Egon 24.09.2026) — opts: { main: {url, prompt}, onClose: fn }. `main` is the picture the
  // collage was opened FROM (the Image Editor's own): "the reason the collage button sits in the editor panel of
  // that picture is that the collage is made ON that picture, so the picture in the lightbox must be selected by
  // default" — and the picker's ☑ Use main image tick (ticked by default) is how it is taken back out.
  window.dragonCollageOpen = function (opts) {
    opts = opts || {};
    _onCloseCb = (typeof opts.onClose === "function") ? opts.onClose : null;
    _carry = null;
    _mainItem = null;
    _mainOn = true;
    if (opts.main && opts.main.url) {
      _mainItem = { id: "__main__", url: opts.main.url, kind: "main", minted: false, prompt: String(opts.main.prompt || "") };
      (function (item, srcUrl) {
        // keep our OWN copy alive so the collage survives even if the editor releases its handle
        urlToBlob(srcUrl).then(function (b) {
          if (!b || _mainItem !== item) return;
          item.url = URL.createObjectURL(b);
          item.minted = true;
          try {
            var pk = document.getElementById("dragonCollagePick");
            var im = pk && pk.querySelector(".dragon-cl-main img");
            if (im) im.src = item.url;
          } catch (e) {}
        }).catch(function () {});
      })(_mainItem, opts.main.url);
    }
    openPicker();
  };
  window.dragonCollageClose = function () { closeResult(); closeEditor(); closePicker(); };

  // Test hooks — the check-up drives the editor with throwaway data: URLs, so the whole feature is proven
  // without touching the public or the private gallery.
  window.dragonCollageTest = {
    max: MAX_PICK,
    patterns: PATTERNS.map(function (p) { return p.id; }),
    layoutFor: layoutFor,
    openEditor: openEditor,
    applyPattern: function (name) { applyPattern(name); return state.tiles.map(function (t) { return { x: t.x, y: t.y, w: t.w, h: t.h, z: t.z }; }); },
    tiles: function () { return state.tiles.map(function (t) { return { x: t.x, y: t.y, w: t.w, h: t.h, z: t.z, url: t.url }; }); },
    addTile: function (item, x, y) { addManualTile(item, x == null ? 50 : x, y == null ? 50 : y); return state.tiles.length; },
    removeTile: removeTile,
    setAspect: function (a) { state.aspect = a; renderStage(); return state.aspect; },
    setBg: function (b) { state.bg = b; renderStage(); return state.bg; },
    stageRect: function () { return stageEl ? stageEl.getBoundingClientRect() : null; },
    tileEl: function (i) { return stageEl ? stageEl.querySelectorAll(".dragon-cl-tile")[i] : null; },
    exportBlob: exportBlob,
    isOpen: function () { return !!editEl; },
    isPickerOpen: function () { return !!pickEl; },
    openPicker: openPicker,
    // 🧩 W-UI252 hooks
    openWithMain: function (url, prompt) { window.dragonCollageOpen({ main: { url: url, prompt: prompt || "" } }); },
    hasMainRow: function () { return !!document.getElementById("dragonClUseMain"); },
    mainTicked: function () { var e = document.getElementById("dragonClUseMain"); return e ? !!e.checked : null; },
    countText: function () { var e = document.getElementById("dragonClPickCount"); return e ? e.textContent : null; },
    folderValue: function () { var e = document.getElementById("dragonClFolder"); return e ? e.value : null; },
    folderChoices: function () { var e = document.getElementById("dragonClFolder"); return e ? [].slice.call(e.options).map(function (o) { return o.value; }) : null; },
    setFolder: function (n) { var e = document.getElementById("dragonClFolder"); if (!e) return null; e.value = n; if (e.onchange) e.onchange(); return e.value; },
    folderPictures: function () { return lastTotal; },
    setZoom: function (z) { var nz = Math.max(0.15, Math.min(3, z)); state.zoom = nz; renderStage(); return nz; },
    zoomPct: function () { var e = document.getElementById("dragonClZoom"); return e ? e.textContent : null; },
    zoom: function () { return state.zoom; },
    zRects: function () { return state.tiles.map(function (t) { var r = zRect(t); return { x: r.x, y: r.y, w: r.w, h: r.h, z: t.z }; }); },
    setFit: function (f) { state.fit = (f === "contain") ? "contain" : "cover"; renderStage(); return state.fit; },
    fit: function () { return state.fit; },
    folders: function () { return vaultFolderNames(); },
    pickedCount: function () { return picked.length; },
    shownCells: function () { return pickEl ? pickEl.querySelectorAll(".dragon-cl-cell").length : -1; },
    close: function () { window.dragonCollageClose(); }
  };
})();
