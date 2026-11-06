// lightbox.js — fullscreen scene-image viewer with phone-gallery gestures.
//
// main.js owns the browse set (`allGalleryImages`, newest batch first) and hands it over via
// initLightbox({ getItems }); everything else (DOM, keyboard, buttons, touch) lives here.
//
// Gestures (pointer events, so touch + mouse drag behave the same):
// - Horizontal drag moves the whole 3-slide track with the finger — the neighbor peeks in as
//   you drag. Release past the distance/velocity threshold (or fling) to navigate, else it
//   springs back. Past the first/last image the track resists (rubber-band) and bounces.
// - Vertical drag moves the current image with the finger while it shrinks and the
//   backdrop/chrome fade. Release past the distance/velocity threshold to dismiss,
//   else it springs back.
// - A tap (no drag) on the empty stage around the image closes, like the old backdrop click.

import { pushBackClose } from "./back-close.js";
import { ICON_CHEV_LEFT_LG, ICON_CHEV_RIGHT_LG, ICON_X_LG } from "./icons.js";

let getItems = () => [];
let session = null; // { idx } — flat index into getItems() being browsed
let release = null; // back-close handle while open (see back-close.js)
let els = null; // built once: { lb, stage, track, slides, imgs, cap, btnX, btnPrev, btnNext }
let drag = null; // active pointer gesture, or null
let animating = false; // a programmatic slide/dismiss animation is running (nav input ignored)
let animToken = 0; // guards setTimeout continuations against close/reopen races
let suppressClickUntil = 0; // taps right after a drag must not close as "backdrop" taps

const DIR_LOCK_PX = 12; // finger travel before the gesture locks to an axis
const TAP_SLOP_PX = 10; // movement still counted as a tap (not a drag)
const H_SNAP_PX = 60; // horizontal travel that commits to the neighbor
const H_FLING_PXMS = 0.4; // horizontal velocity (px/ms) that commits, with some travel
const H_FLING_MIN_PX = 20;
const V_DISMISS_PX = 110; // vertical travel that dismisses
const V_FLING_PXMS = 0.55; // vertical velocity (px/ms) that dismisses, with some travel
const V_FLING_MIN_PX = 30;
const V_SCALE_RANGE_PX = 700; // vertical drag that shrinks the image down to V_MIN_SCALE
const V_MIN_SCALE = 0.5; // smallest scale while dragging (image never shrinks past this)
const V_DISMISS_END_SCALE = 0.45; // scale the fly-off animation settles on while fading out
const EDGE_RESIST = 0.35; // rubber-band factor dragging past the first/last image
const SLIDE_MS = 240; // neighbor-slide animation length
const SPRING_MS = 220; // snap-back animation length
const DISMISS_MS = 200; // dismiss-fly-off animation length
const BG_FULL = 0.9; // #lightbox backdrop alpha at rest (mirrors styles.css)

export function initLightbox(opts) {
  if (opts && typeof opts.getItems === "function") getItems = opts.getItems;
}

function items() {
  try {
    const list = getItems() || [];
    return Array.isArray(list) ? list : [];
  } catch (e) { return []; }
}

function srcOf(it) {
  if (!it) return "";
  if (it.src) return it.src;
  try {
    const arr = (it.msg && it.msg.images) || [];
    return arr[it.idx] || "";
  } catch (e) { return ""; }
}

const SVG_PREV = ICON_CHEV_LEFT_LG;
const SVG_NEXT = ICON_CHEV_RIGHT_LG;
const SVG_X = ICON_X_LG;

function ensureDom() {
  if (els) return els;
  const lb = document.createElement("div");
  lb.id = "lightbox";
  lb.innerHTML =
    `<div class="lb-stage"><div class="lb-track">` +
    `<div class="lb-slide"><img alt="Scene image" draggable="false"></div>`.repeat(3) +
    `</div></div>` +
    `<button class="lb-x" title="Close" aria-label="Close">${SVG_X}</button>` +
    `<button class="lb-nav prev" title="Previous" aria-label="Previous image">${SVG_PREV}</button>` +
    `<button class="lb-nav next" title="Next" aria-label="Next image">${SVG_NEXT}</button>` +
    `<div class="lb-cap"></div>`;
  const q = (sel) => lb.querySelector(sel);
  const built = {
    lb,
    stage: q(".lb-stage"),
    track: q(".lb-track"),
    slides: Array.from(lb.querySelectorAll(".lb-slide")),
    cap: q(".lb-cap"),
    btnX: q(".lb-x"),
    btnPrev: q(".lb-nav.prev"),
    btnNext: q(".lb-nav.next"),
  };
  built.imgs = built.slides.map((s) => s.querySelector("img"));
  built.chrome = [built.btnX, built.btnPrev, built.btnNext, built.cap];
  built.btnX.onclick = () => closeLightbox();
  built.btnPrev.onclick = () => step(-1);
  built.btnNext.onclick = () => step(1);
  // Tap (no drag) on the empty stage around the image closes — the old backdrop click.
  // Buttons and the image itself are excluded; a tap right after a drag is suppressed.
  built.stage.addEventListener("click", (e) => {
    if (Date.now() < suppressClickUntil) return;
    if (e.target.closest("img,button")) return;
    closeLightbox();
  });
  built.stage.addEventListener("pointerdown", onDown);
  built.stage.addEventListener("pointermove", onMove);
  built.stage.addEventListener("pointerup", onUp);
  built.stage.addEventListener("pointercancel", onUp);
  document.addEventListener("keydown", onKey);
  // A rotate/resize mid-view re-centers the track (slide width == stage width).
  window.addEventListener("resize", () => {
    if (!session || !lb.classList.contains("open") || drag) return;
    snapTrack(false);
  });
  document.body.appendChild(lb);
  els = built;
  return els;
}

function stageW() {
  return (els && els.stage.clientWidth) || window.innerWidth || 1;
}

// Photo-viewer shrink: 1 at rest, easing down to V_MIN_SCALE over V_SCALE_RANGE_PX.
function vScale(dy) {
  return Math.max(V_MIN_SCALE, 1 - Math.min(Math.abs(dy) / V_SCALE_RANGE_PX, 1 - V_MIN_SCALE));
}

// Track resting position: the middle slide (current image) fills the stage.
function snapTrack(withTransition) {
  const t = els.track;
  t.style.transition = withTransition ? `transform ${SPRING_MS}ms ease` : "none";
  t.style.transform = `translateX(${-stageW()}px)`;
}

function setChrome(opacity) {
  for (const el of els.chrome) el.style.opacity = String(opacity);
}

function setBackdrop(alpha) {
  els.lb.style.backgroundColor = `rgba(0,0,0,${alpha})`;
}

function paintSlide(k, it) {
  const slide = els.slides[k], img = els.imgs[k];
  const src = srcOf(it);
  if (src) {
    if (img.getAttribute("src") !== src) img.setAttribute("src", src);
    img.style.display = "";
  } else {
    img.removeAttribute("src");
    img.style.display = "none";
  }
}

// Instantly lay out prev/current/next around `i` (clamped). The single place DOM reflects state.
function render(i) {
  const list = items();
  if (!list.length) { closeLightbox(); return; }
  session.idx = Math.max(0, Math.min(i, list.length - 1));
  paintSlide(0, list[session.idx - 1]);
  paintSlide(1, list[session.idx]);
  paintSlide(2, list[session.idx + 1]);
  // Clear any gesture/programmatic transforms.
  const cur = els.slides[1];
  cur.style.transition = "none";
  cur.style.transform = "";
  cur.style.opacity = "";
  snapTrack(false);
  setBackdrop(BG_FULL);
  setChrome(1);
  els.cap.textContent = list.length > 1 ? `Image ${session.idx + 1}/${list.length}` : "";
  const vis = list.length > 1 ? "visible" : "hidden";
  els.btnPrev.style.visibility = vis;
  els.btnNext.style.visibility = vis;
}

// Animated step to the neighbor in direction d (+1 next, -1 prev). Out-of-range nudges and
// bounces back. Buttons, keys and flings all funnel through here.
function step(d) {
  if (!session || animating || drag || !els) return;
  const list = items();
  const target = session.idx + d;
  if (target < 0 || target >= list.length) {
    // Rubber-band nudge against the end.
    animating = true;
    const my = ++animToken;
    const t = els.track, W = stageW();
    t.style.transition = `transform ${SPRING_MS / 2}ms ease`;
    t.style.transform = `translateX(${-W - d * Math.min(64, W * 0.12)}px)`;
    setTimeout(() => {
      if (my !== animToken || !session) return;
      snapTrack(true);
      setTimeout(() => { if (my === animToken) animating = false; }, SPRING_MS + 30);
    }, SPRING_MS / 2 + 30);
    return;
  }
  animating = true;
  const my = ++animToken;
  const t = els.track, W = stageW();
  t.style.transition = `transform ${SLIDE_MS}ms ease`;
  t.style.transform = `translateX(${-W - d * W}px)`;
  setTimeout(() => {
    if (my !== animToken || !session) return;
    render(target);
    animating = false;
  }, SLIDE_MS + 40);
}

function onKey(e) {
  if (!els || !els.lb.classList.contains("open") || !session) return;
  if (e.key === "Escape") closeLightbox();
  else if (e.key === "ArrowLeft") step(-1);
  else if (e.key === "ArrowRight") step(1);
}

function onDown(e) {
  if (!session || animating || drag) return;
  if (e.isPrimary === false) return;
  if (e.pointerType === "mouse" && e.button !== 0) return;
  drag = {
    id: e.pointerId,
    x0: e.clientX, y0: e.clientY,
    dx: 0, dy: 0, mode: null,
    vx: 0, vy: 0, lx: e.clientX, ly: e.clientY, lt: performance.now(),
    W: stageW(),
  };
  try { els.stage.setPointerCapture(e.pointerId); } catch (err) {}
}

function onMove(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const now = performance.now();
  const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
  // Smoothed velocity from the last segment (guards against a single stale jump).
  const dt = Math.max(1, now - drag.lt);
  drag.vx = 0.7 * ((e.clientX - drag.lx) / dt) + 0.3 * drag.vx;
  drag.vy = 0.7 * ((e.clientY - drag.ly) / dt) + 0.3 * drag.vy;
  drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = now;
  drag.dx = dx; drag.dy = dy;
  if (!drag.mode && Math.hypot(dx, dy) > DIR_LOCK_PX) {
    drag.mode = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
  }
  if (drag.mode === "h") {
    const list = items();
    const hasPrev = session.idx > 0, hasNext = session.idx < list.length - 1;
    let eff = dx;
    if ((dx > 0 && !hasPrev) || (dx < 0 && !hasNext)) eff = dx * EDGE_RESIST;
    const t = els.track;
    t.style.transition = "none";
    t.style.transform = `translateX(${-drag.W + eff}px)`;
  } else if (drag.mode === "v") {
    const cur = els.slides[1];
    cur.style.transition = "none";
    cur.style.transform = `translate(${dx * 0.4}px, ${dy}px) scale(${vScale(dy)})`;
    const p = Math.min(Math.abs(dy) / 380 + Math.abs(dx) / 1400, 0.85);
    setBackdrop(BG_FULL * (1 - p));
    setChrome(1 - Math.min(Math.abs(dy) / 200, 1));
  }
}

function onUp(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const { dx, dy, mode, vx, vy, W } = drag;
  drag = null;
  if (Math.hypot(dx, dy) > TAP_SLOP_PX) suppressClickUntil = Date.now() + 350;
  if (!session || !els) return;
  if (!mode) return; // plain tap — the click handler decides (empty stage closes)
  if (mode === "h") {
    const dir = dx < 0 ? 1 : -1;
    const list = items();
    const hasNeighbor = dir > 0 ? session.idx < list.length - 1 : session.idx > 0;
    const travel = Math.abs(dx);
    const fling = Math.abs(vx) > H_FLING_PXMS && travel > H_FLING_MIN_PX && (vx < 0 ? 1 : -1) === dir;
    if (hasNeighbor && (travel > H_SNAP_PX || fling)) {
      // Continue from the finger's current position for a seamless handoff.
      const t = els.track;
      t.style.transition = "none";
      t.style.transform = `translateX(${-W + dx}px)`;
      // Force the style flush before re-enabling the transition.
      void t.offsetWidth;
      step(dir);
    } else {
      snapTrack(true);
    }
  } else {
    const travel = Math.abs(dy);
    const speed = Math.hypot(vx, vy);
    const dirY = dy === 0 ? 1 : dy / Math.abs(dy);
    const fling = speed > V_FLING_PXMS && travel > V_FLING_MIN_PX;
    if (travel > V_DISMISS_PX || fling) dismiss(dirY, dx);
    else {
      const cur = els.slides[1];
      cur.style.transition = `transform ${SPRING_MS}ms ease, opacity ${SPRING_MS}ms ease`;
      cur.style.transform = "";
      cur.style.opacity = "";
      setBackdrop(BG_FULL);
      setChrome(1);
    }
  }
}

// Fly the current image off in the drag's vertical direction while shrinking and fading
// out, then close. dx keeps the horizontal drift continuous with the finger.
function dismiss(dirY, dx = 0) {
  if (animating) return;
  animating = true;
  const my = ++animToken;
  const cur = els.slides[1];
  const off = (window.innerHeight || 800) * 1.1 * (dirY >= 0 ? 1 : -1);
  cur.style.transition = `transform ${DISMISS_MS}ms ease-in, opacity ${DISMISS_MS}ms ease-in`;
  cur.style.transform = `translate(${dx * 0.4}px, ${off}px) scale(${V_DISMISS_END_SCALE})`;
  cur.style.opacity = "0";
  setBackdrop(0);
  setChrome(0);
  setTimeout(() => {
    if (my !== animToken) return;
    animating = false;
    closeLightbox();
  }, DISMISS_MS + 40);
}

export function openLightbox(m, idx) {
  ensureDom();
  // Browse the whole gallery (every finished scene image across all batches), starting at the
  // image that was clicked — its flat position in message order.
  session = { idx: 0 };
  const start = items().findIndex((it) => it.msg === m && it.idx === idx);
  render(start >= 0 ? start : 0);
  els.lb.classList.add("open");
  if (!release) release = pushBackClose(closeLightbox);
}

export function closeLightbox() {
  animToken++; // invalidate any in-flight slide/dismiss continuations
  drag = null;
  animating = false;
  if (!els) { session = null; return; }
  if (!els.lb.classList.contains("open")) { session = null; return; }
  els.lb.classList.remove("open");
  session = null;
  if (release) { const r = release; release = null; r(); }
}
