// dragon-display-xl.js — moved VERBATIM out of index.html (Paket A1, 25.09.2026). Classic script
// (not a module), inserted at the same point of the boot order, so globals and ordering are unchanged.
// Rollback: paste this file's body back into index.html as a plain <script> at its old place.
// 📐 Display XL/2XL/3XL/Full Screen — ONLY enlarge the visual area for wide displays
// Logic: XL/2XL (<=1000px) ALREADY work normally → they are not touched at all. Only the 1000px
// for two exceeding options (3XL=1300, Full Screen=100%), the main column is up to min(1900px, 100vw)
// is expanded. BUT the content container INSIDE the column (description/scratchpad/quick bar/all
// option panels = userInputsCtn) LOCKS at 1000px → quick bar and panels NEVER
// does not grow; only the visual area (outputAreaEl) expands to full width, visuals with flex-center
// stays in the CENTER of the screen. Additional corrections (per .t2i-image-ctn, for wide images only):
//  3XL (iframe width 1300px): flexShrink:0 + maxWidth:100% → flex container image
//    CANNOT SHRINK to 984px (old cap issue).
//  Full Screen (iframe width "100%"): "100%" iframe inside shrink-to-fit flex item is 0-based
//    if taken → ~300px "default size" would be visible. explicit width to ctn
//    set to min(innerWidth-16, 1900px) so that the iframe is actually full width.
// Visual width is embedded into the iframe by the plugin (at generation time); display change
// affects the next generate (plugin's existing behavior was preserved).
(function () {
  var COL = "dragon-wide-column";
  ;function ensureStyle() {
    var st = document.getElementById("dragon-wide-col-style");
    if (!st) { st = document.createElement("style"); st.id = "dragon-wide-col-style"; document.head.appendChild(st); }
    st.textContent =
      "#mainColumnEl85394739." + COL + " { max-width: min(1900px, 100vw) !important; }" +
      "#mainColumnEl85394739." + COL + " #userInputsCtn8462746262 { max-width: 1000px !important; margin-left: auto !important; margin-right: auto !important; }";
  }
  ;function apply() {
    var s = document.querySelector('[data-name="display"]');
    var v = s ? String(s.value || "").trim() : "";
    var pct = v.indexOf("%") !== -1;
    var num = pct ? NaN : Number(v);
    if (!pct && (isNaN(num) || num <= 0)) return;   // unknown/empty value → leave the tiles alone
    var wide = pct || num > 1000;
    var col = document.getElementById("mainColumnEl85394739");
    if (col) col.classList.toggle(COL, wide);
    // already-generated image at whatever width it was created with, so picking a bigger size looked like
    // it did nothing. Each tile is now re-sized to the selected display width immediately — the iframe
    // carries its own aspect-ratio, so only the width has to be written, and the plugin's
    // `iframe.text-to-image-plugin-image-iframe { max-width:100% }` rule keeps small screens safe.
    // The wanted size is CLAMPED to the space that is actually free (a 450px tile on a 390px phone
    // must not push the page sideways); the iframe itself is always 100% of its tile, which keeps its
    // aspect-ratio and makes the width of the tile the single thing that has to be set.
    var _area = document.getElementById("outputAreaEl");
    var _avail = _area ? _area.clientWidth : 0;
    if (!_avail || _avail < 200) _avail = window.innerWidth;
    var want = pct ? Math.min(window.innerWidth - 16, 1900) : num;
    var fit = Math.max(60, Math.min(want, _avail - 8));
    var ctns = document.querySelectorAll("#mainColumnEl85394739 .t2i-image-ctn");
    for (var i = 0; i < ctns.length; i++) {
      var ctn = ctns[i];
      var ifr = ctn.querySelector("iframe");
      if (!ifr) continue;
      ifr.style.width = "100%";
      ctn.style.width = fit + "px";
      ctn.style.maxWidth = "100%";
      ctn.style.flexShrink = "0";
    }
  }
  ensureStyle();
  document.addEventListener("change", function (e) {
    if (e.target && e.target.dataset && e.target.dataset.name === "display") apply();
  }, true);
  var outArea = document.getElementById("outputAreaEl");
  if (outArea) new MutationObserver(apply).observe(outArea, { childList: true, subtree: true });
  dragonTick(apply, 1500);
  apply();
})();
