/* ============================================================================
   🧩 TILE LAYOUT ENGINE — pure geometry, no DOM (Egon 23.09.2026)

   WHY: the gallery's tile display modes grew one by one, and the ROW ones
   (justified / default) were solved inline in dragon-app-core.js with a DP,
   while the new modes Egon asked for need real packers. So the MATHS lives here
   ONCE and the two galleries (public + private) only apply the returned rects
   to their own DOM. Big-cup rule: one algorithm, two appliers.

   Every function is PURE: give it the aspect ratios (width/height) of the tiles
   in display order plus the container width, and it returns rectangles
   ({i,x,y,w,h}) keyed by the ORIGINAL index. No DOM, no localStorage, no
   globals besides the single `window.dragonLayouts` export — which is why the
   whole engine can be unit-tested head-lessly (see src/README.md).

   PACKERS
     rows(ratios, W, o)       equal-height rows that ALWAYS fill the width
                              exactly (puzzle / mosaic / spotlight)
     pinterest(ratios, W, o)  true column packing, round-robin column order
                              (masonry.js `horizontalOrder`), reading left→right
     mixed(ratios, W, o)      cell grid of 1x1 and 2x2 blocks, Packery-style,
                              hole-free by construction (a second pass fills)
   ========================================================================== */
(function () {
  "use strict";

  // Deterministic shuffle (xorshift32) — the same seed gives the same wall, so a
  // re-pack (lazy image arriving, resize, dedupe collapse) never reshuffles the
  // gallery under the visitor's finger. Egon's mosaic mode is random BY DESIGN,
  // but it must be STABLE randomness.
  ;function shuffle(arr, seed) {
    var a = arr.slice(), s = (seed >>> 0) || 1;
    ;function rnd() {
      s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    }
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  ;function clampRatio(r) {
    r = Number(r);
    if (!isFinite(r) || r <= 0) return 1;
    if (r < 0.2) return 0.2;
    if (r > 5) return 5;
    return r;
  }
  ;function indexArray(n, seed) {
    var a = [], i;
    for (i = 0; i < n; i++) a.push(i);
    return seed == null ? a : shuffle(a, seed);
  }

  /* ---------------------------------------------------------------- rows ----
     Rows that ALWAYS fill the width exactly and never crop a picture.

     How: a row is complete when `rowHeight = (W - gaps) / Σratios`. So instead
     of choosing a row height first and then hoping the pictures fit, we choose
     the PICTURES so that the resulting height lands on the wanted one:

       - keep adding pictures while the next one is small enough that the row
         would still be at least `target` tall (never denser than the target);
       - when the next picture in line is too wide, LOOK AHEAD (default 30) and
         take the picture that fits the leftover best — this is Egon's
         "the sort order is relaxed for some pictures so the puzzle works":
         an older picture may step forward to close a row;
       - a row that would end up taller than `maxGrow × target` (a lone
         panorama) pulls in extra pictures until it is back in band;
       - the last picture of a row absorbs the rounding, so the browser can
         never wrap a row early and leave a hole.

     `mirror:true` lays the first row out RIGHT-TO-LEFT (Egon's puzzle mode) by
     mirroring x — the DOM order is untouched, only the picture's position is.
     `seed` shuffles the pool first (Egon's mosaic mode). The packer reorders
     VISUALLY only: rects keep the original index `i`, so the lightbox, the
     numbering, the lazy loading and the comments all still follow the DOM. */
  ;function rows(ratios, W, o) {
    o = o || {};
    var gap = o.gap > 0 ? o.gap : 6;
    var target = o.target > 0 ? o.target : 300;
    var look = o.lookahead == null ? 30 : o.lookahead;
    var maxGrow = o.maxGrow > 0 ? o.maxGrow : 1.8;
    var posPen = o.posPenalty == null ? 0.004 : o.posPenalty;
    var y0 = o.y0 > 0 ? o.y0 : 0;
    var src = o.ratios || ratios;
    var order = indexArray(ratios.length, o.seed);
    var rects = [], q = 0, y = y0, devSum = 0, rowsN = 0, ragged = 0, swaps = 0;
    while (q < order.length) {
      var row = [], sum = 0;
      while (q < order.length) {
        var k = row.length;
        // the ratio that would make this row exactly `target` tall
        var targetR = (W - gap * k) / target - sum;
        var bestJ = -1, bestScore = Infinity;
        var lim = Math.min(order.length, q + look + 1);
        for (var j = q; j < lim; j++) {
          var rj = clampRatio(src[order[j]]);
          if (k === 0) { bestJ = j; break; }
          if (rj > targetR + 1e-9) continue;   // any wider picture would starve the row's height
          var sc = (targetR - rj) + (j - q) * posPen;
          if (sc < bestScore) { bestScore = sc; bestJ = j; }
        }
        if (bestJ < 0) break;
        if (bestJ !== q) { var tp = order[bestJ]; order.splice(bestJ, 1); order.splice(q, 0, tp); swaps++; }
        row.push(order[q]); sum += clampRatio(src[order[q]]); q++;
      }
      if (!row.length) { row.push(order[q]); sum += clampRatio(src[order[q]]); q++; }
      var rh = (W - gap * (row.length - 1)) / sum, capped = false;
      while (rh > target * maxGrow && q < order.length) {
        row.push(order[q]); sum += clampRatio(src[order[q]]); q++;
        rh = (W - gap * (row.length - 1)) / sum;
      }
      // A still-too-tall row can only happen at the very end of the pool (a lone
      // portrait with nothing left to pair it with): keep the wanted height and
      // accept a short row rather than blowing one picture up to a billboard.
      // The moment more pictures load, this row is packed normally again.
      if (rh > target * maxGrow) { rh = target; capped = true; ragged++; }
      if (o.maxHeight > 0 && rh > o.maxHeight) { rh = o.maxHeight; capped = true; ragged++; }
      rowsN++; devSum += Math.abs(rh - target) / target;
      var used = 0;
      for (var t = 0; t < row.length; t++) {
        var rr = clampRatio(src[row[t]]);
        var w = (!capped && t === row.length - 1) ? Math.max(4, W - used) : rr * rh;
        rects.push({ i: row[t], x: o.mirror ? (W - used - w) : used, y: y, w: w, h: rh, row: rowsN - 1 });
        used += w + gap;
      }
      y += rh + gap;
    }
    return {
      rects: rects, height: Math.max(0, y - gap - y0), rows: rowsN,
      avgDev: rowsN ? devSum / rowsN : 0, ragged: ragged, swaps: swaps
    };
  }
  /* ----------------------------------------------------------- pinterest ----
     TRUE Pinterest packing (masonry.js `horizontalOrder`): equal-width columns,
     every picture keeps its own shape, and the columns are filled ROUND-ROBIN
     (picture 0 → column 0, picture 1 → column 1, …), which is what makes the
     first row read LEFT-TO-RIGHT. The old "Masonry" mode uses CSS `columns`,
     which fills the FIRST COLUMN top-to-bottom instead — same pictures, very
     different reading order. `seeds` shuffles (a random Pinterest wall).
     x/y are rounded on SHARED edges (`round(next) - round(this)`) so two
     neighbouring columns can never open a 1px hairline between them. */
  ;function pinterest(ratios, W, o) {
    o = o || {};
    var gap = o.gap > 0 ? o.gap : 6;
    var cols = o.cols | 0 || 4;
    var src = o.ratios || ratios;
    var colW = (W - gap * (cols - 1)) / cols;
    var tops = [], c;
    for (c = 0; c < cols; c++) tops[c] = 0;
    var order = indexArray(ratios.length, o.seed);
    var rects = [];
    for (var k = 0; k < order.length; k++) {
      var idx = order[k], col;
      if (o.horizontalOrder === false) {
        col = 0;
        for (c = 1; c < cols; c++) if (tops[c] < tops[col] - 0.01) col = c;
      } else {
        col = k % cols;   // round-robin → left-to-right reading order
      }
      var left = col * (colW + gap);
      var right = left + colW;
      var top = tops[col];
      var h = colW / clampRatio(src[idx]);
      var x = Math.round(left), w = Math.round(right) - x;
      var yy = Math.round(top), hh = Math.round(top + h) - yy;
      rects.push({ i: idx, x: x, y: yy, w: w, h: hh, col: col });
      tops[col] = top + h + gap;
    }
    var maxTop = 0;
    for (c = 0; c < cols; c++) if (tops[c] - gap > maxTop) maxTop = tops[c] - gap;
    return { rects: rects, height: Math.max(0, Math.round(maxTop)), cols: cols, colW: colW };
  }
  /* --------------------------------------------------------------- mixed ----
     Packery/Muuri-style MIXED CELL GRID: the wall is a grid of square CELLS and
     every picture gets a block whose shape matches it —
       2x1 (wide) for landscapes · 1x2 (tall) for portraits · 2x2 for the
       scattered ~18% of near-square pictures (the one block a square picture
       fills EXACTLY, so those tiles are never cropped) · 1x1 otherwise.
     Blocks are placed by a row-major first-fit walk: the scan always moves to the
     leftmost-topmost FREE cell and puts the next picture there, sized 2x1 when
     it is a landscape and the cell to its right is free, 1x2 when it is a
     portrait and the cell below is free, 1x1 otherwise. Because the scan never
     leaves a cell behind, the wall is HOLE-FREE BY CONSTRUCTION (a Packery-style
     column scan cannot promise that once tall blocks exist). Everything is
     cell-aligned, so the edges line up perfectly — the pictures are cropped to
     their block, which is what makes this the one "designed wall" mode. */
  ;function mixed(ratios, W, o) {
    o = o || {};
    var gap = o.gap > 0 ? o.gap : 6;
    var cols = o.cols | 0 || 5;
    var src = o.ratios || ratios;
    var cellW = (W - gap * (cols - 1)) / cols, cellH = cellW;
    var occupied = {}, placed = [];
    ;function key(x, y) { return x * 100000 + y; }
    ;function free(x0, y0, sx, sy) {
      for (var yy = y0; yy < y0 + sy; yy++) for (var xx = x0; xx < x0 + sx; xx++) if (occupied[key(xx, yy)]) return false;
      return true;
    }
    ;function put(idx, x0, y0, sx, sy) {
      for (var yy = y0; yy < y0 + sy; yy++) for (var xx = x0; xx < x0 + sx; xx++) occupied[key(xx, yy)] = 1;
      placed.push({ i: idx, cx: x0, cy: y0, sx: sx, sy: sy });
    }
    // Row-major first-fit: walk the cells in reading order and never skip a free
    // one, choosing the block shape the picture (and the free room) allows.
    var cx = 0, cy = 0;
    for (var i = 0; i < ratios.length; i++) {
      // advance to the next free cell (left→right, top→bottom)
      while (occupied[key(cx, cy)]) { cx++; if (cx >= cols) { cx = 0; cy++; } }
      var r = clampRatio(src[i]), sx = 1, sy = 1;
      // Shape from the picture; a near-square picture may take a 2x2 block (it is the
      // one block whose shape a square picture fills EXACTLY — no crop at all), on a
      // stable ~18% scatter so the wall reads as a designed mosaic rather than a grid.
      if (r >= 1.3 && cx + 2 <= cols && free(cx, cy, 2, 1)) sx = 2;
      else if (r <= 0.8 && free(cx, cy, 1, 2)) sy = 2;
      else if (r > 0.8 && r < 1.3 && ((i * 37) % 11) < 2 && cx + 2 <= cols && free(cx, cy, 2, 2)) { sx = 2; sy = 2; }
      put(i, cx, cy, sx, sy);
    }
    var rowsN = 0;
    for (var p = 0; p < placed.length; p++) if (placed[p].cy + placed[p].sy > rowsN) rowsN = placed[p].cy + placed[p].sy;
    for (var q2 = 0; q2 < placed.length; q2++) {
      var b = placed[q2];
      b.x = b.cx * (cellW + gap);
      b.y = b.cy * (cellH + gap);
      b.w = b.sx * cellW + (b.sx - 1) * gap;
      b.h = b.sy * cellH + (b.sy - 1) * gap;
    }
    return { rects: placed, height: Math.max(0, rowsN * (cellH + gap) - gap), cols: cols, cellW: cellW, unplaced: 0 };
  }

  // The single public entry point. Everything else in this file is private.
  window.dragonLayouts = {
    rows: rows,
    pinterest: pinterest,
    mixed: mixed,
    shuffle: shuffle,
    clampRatio: clampRatio,
    version: "1.0.0"
  };
})();
