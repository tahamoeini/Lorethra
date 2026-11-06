/* ============================================================================
   "I'M HERE" BADGE + PURPLE GLOW — RETIRED (Egon 22.10.2026)

   The shared badge primitive (rule I114, W-UI194) and the one-time "Click ME!"
   pill (W-UI227) are retired: no control is marked anymore, anywhere.
   ROLLBACK: restore this file from the 2.82.5 full backup
   (scratch/backup-bestaigen-2.82.5-2026-10-22-full.zip, entry src/JS/dragon-here.js)
   to bring the badges back.

   This file stays as an inert API-compatible stub so every existing caller
   (Dexa legends hand-off, news offers, studio, check-up) keeps working: the
   calls simply do nothing. No CSS is injected, no observers are installed,
   no badges are ever drawn.
   ========================================================================== */
(function () {
  "use strict";
  var EMPTY_STATE = { batch: "", pending: {}, done: {} };
  function noop() {}
  function falseFn() { return false; }
  function trueFn() { return true; }
  function zeroFn() { return 0; }
  function emptyArrFn() { return []; }
  function stateFn() { return { batch: "", pending: {}, done: {} }; }
  window.dragonHere = {
    version: "retired-22.10.2026",
    mark: falseFn,
    clear: noop,
    isPending: falseFn,
    pending: emptyArrFn,
    rescan: zeroFn,
    reset: noop,
    place: noop,
    state: stateFn
  };
  window.dragonClickMe = {
    mark: falseFn,
    clear: noop,
    isSeen: trueFn,
    pending: emptyArrFn,
    rescan: zeroFn,
    reset: noop
  };
})();
