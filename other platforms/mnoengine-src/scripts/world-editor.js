// world-editor.js — the world editor overlay.
// Edits a world's FILE FORM ({format,version,meta,...,stats:{...},trackers:[...],npcs:[...]}) — the
// same shape that's stored in the kv library and exported — so save/load round-trips are lossless.
// Nine tabs: Basics / Story / Lorebook / NPC / Images / Stats / Trackers / Context / Raw JSON. Save
// validates through the loader (loadWorld) and blocks on errors; warnings go to the console. The
// Context tab (context-budget.js) is a read-only diagnostic and never affects play. The
// built-in default world is not editable in place (callers duplicate-then-open); the kv library
// holds user worlds.
import { loadWorld, WORLD_EXTENSION, MAX_AUTHOR_TAGS, isReservedTag, isNsfwTag, isRemixTag } from "./world.js";
import { evalFormula } from "./trackers.js";
import { fileToAvatarDataUrl, pickImageFile, COVER_MAX_DIM, COVER_WEBP_QUALITY, COVER_MIME, coverDataUrl, generatedAvatarToWebp, genImageSafe, withTimeout, IMAGE_PROMPT_TIMEOUT_MS } from "./image-utils.js";
import { pushBackClose } from "./back-close.js";
import { STAT_PRESETS, TRK_PRESETS, NTRK_PRESETS } from "./def-presets.js";
import { IMAGE_STYLE_TEMPLATES } from "./image-style-presets.js";
import { createChipInput } from "./chip-input.js";
import { ICON_BACK_CHEV, ICON_IMPORT, ICON_EXPORT } from "./icons.js";
import { ColorPicker } from "./color-picker.js";
import { renderContextTab } from "./context-budget.js";
import { imageGuidance } from "./image-gen-prefs.js";
import { utf8ByteLen } from "./popups.js";
import {
  normalizeLorebook, normalizeLoreEntry, splitKeywords, lorebookTitleList, lorebookToText,
  LORE_TYPES, DEFAULT_TRIGGER_WINDOW_TURNS, LORE_FORMAT, LORE_EXTENSION
} from "./lorebook.js";
import { NPC_NAME_BANNED } from "./banned-words.js";

// Quotes MUST be escaped too: this `esc` feeds quoted attributes (title="…", value="…") below —
// an unescaped `"` closes the attribute early and spills text into the element (stored XSS).
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const escAttr = (s) => esc(s); // alias: `esc` already covers quotes for attributes
const toNum = (s) => { const t = String(s ?? "").trim(); return t === "" ? "" : (Number.isFinite(Number(t)) ? Number(t) : NaN); };
// A tracker's bar colour is free text from the world file; only colour-shaped values may reach an
// inline style (a stray quote would otherwise escape the attribute).
const safeColor = (c) => { const t = String(c ?? "").trim(); return /^[#a-zA-Z0-9(),.%\s/-]{1,40}$/.test(t) ? t : ""; };

// Busy buttons: swap a button's label for the shared inline spinner while an async action runs,
// then restore the original label. Idempotent (a second call while busy is ignored).
function setBusy(btn, label) {
  if (!btn || btn.dataset.busy !== undefined) return;
  btn.dataset.busy = btn.innerHTML;
  btn.disabled = true;
  btn.classList.add("is-loading");
  btn.innerHTML = '<span class="spin spin-sm"></span> ' + label;
}
function clearBusy(btn) {
  if (!btn) return;
  btn.disabled = false;
  btn.classList.remove("is-loading");
  if (btn.dataset.busy !== undefined) { btn.innerHTML = btn.dataset.busy; delete btn.dataset.busy; }
}
const sampleStats = (defs) => {
  const o = {};
  for (const d of defs || []) { const n = Number(d.start); o[d.key] = Number.isFinite(n) ? n : 1; }
  return o;
};
// Like sampleStats, but also exposes the editor's number trackers as sample values so a max/start
// formula may reference ANOTHER tracker by key (e.g. `= level*20 + 80`) when validating/previewing.
const sampleFormulaScope = (defs, trackers) => {
  const o = sampleStats(defs);
  for (const t of trackers || []) {
    if (!t || !t.key || t.type !== "number") continue;
    const n = Number(t.start);
    o[t.key] = Number.isFinite(n) ? n : 1;
  }
  return o;
};
// The scope a custom skill-check formula is evaluated against: `v` is the stat value being scored,
// with the configured thresholds/step as named constants. `v` defaults to a mid-range stat so syntax
// validation has something to chew on; the preview passes several sample values.
const statModScope = (s, v = 10) => {
  const num = (x, d) => { const n = Number(x); return Number.isFinite(n) ? n : d; };
  return { v, avg: num(s.averageThreshold, 10), exc: num(s.exceptionalThreshold, 15), step: num(s.modStep, 5) };
};
// The built-in statMod, written as a formula — shown as the textarea placeholder so a world author
// starting from scratch has a working example to tweak.
const DEFAULT_STAT_MOD_FORMULA = "v < avg ? floor((v - avg) / step) : v > exc ? ceil((v - exc) / step) : 0";
const DEFAULT_STATS = { pointsPerLevel: 2, ccBudget: 12, ccFloor: 5, ccCeiling: 20, averageThreshold: 10, exceptionalThreshold: 15, modStep: 5, dieSides: 20 };
const MAX_WORLD_TAGS = MAX_AUTHOR_TAGS; // shared cap (world.js) — author tags, excluding the rating

// The pick-list of common tags offered under the Basics tab's `tags` field. Curated (not the catalog's
// live facets) so a new world is tagged in the same vocabulary Explore can actually filter by. The
// groups below are DATA ONLY — they set the render order (genre-flavoured tags first, then setting,
// then theme); the pick-list itself renders them as one flat, unlabelled flow. Picking a tag runs the
// same commit path as typing it — so the max and the reserved markers still apply — and a tag the world
// already wears shows as selected.
const TAG_SUGGESTIONS = [
  {
    label: "genre",
    tags: [
      "fantasy", "dark fantasy", "urban fantasy", "sci-fi", "cyberpunk", "steampunk",
      "post-apocalyptic", "modern", "historical", "horror", "mystery", "romance",
      "comedy", "isekai", "western", "superhero", "dystopian"
    ]
  },
  {
    label: "setting",
    tags: [
      "medieval", "futuristic", "space", "urban", "school", "academy",
      "wilderness", "dungeon", "island", "ocean", "desert", "underworld"
    ]
  },
  {
    label: "theme",
    tags: [
      "adventure", "exploration", "survival", "political intrigue", "war", "revenge",
      "corruption", "redemption", "simulation", "dungeon crawl", "investigation", "action", "strategy", 
      "harem", "power fantasy", "slice of life"
    ]
  }
];

// Live "pip" preview for the Trackers tab — mirrors the header-bar chip markup/behavior in
// main.js (trackerChip): number trackers with a max render as a bar, everything else as a
// compact tag. max/start accept literals or "= formula" over the sample hero stats/trackers.
const trackerPipPreview = (t, stats) => {
  const type = t.type === "number" ? "number" : "text";
  const title = esc(t.hint || t.label || t.key || "tracker");
  const label = t.label ? `<span class="trk-l">${esc(t.label.toUpperCase())}</span>` : "";
  const icon = t.icon ? `<span class="trk-ic">${esc(t.icon)}</span>` : "";
  const num = (v) => {
    if (v === undefined || v === null || v === "") return undefined;
    if (typeof v === "string" && v.trim().startsWith("=")) {
      const expr = v.replace(/^=\s*/, "").trim();
      if (!expr) return undefined;
      try { const r = evalFormula(expr, stats || {}); return Number.isFinite(r) ? Math.round(r) : undefined; } catch (e) { return undefined; }
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const max = num(t.max);
  if (type === "number" && max !== undefined && max > 0) {
    let v = num(t.start);
    if (v === undefined) v = 0;
    v = Math.max(0, Math.min(max, v));
    const pct = Math.round((v / max) * 100);
    const fillStyle = `width:${pct}%` + (safeColor(t.color) ? `;background:${safeColor(t.color)}` : "");
    return `<div class="trk hp" title="${title}">${icon}${label}<span class="trk-bar"><span class="trk-fill" style="${fillStyle}"></span></span><span class="trk-v">${v}/${max}</span></div>`;
  }
  const shown = type === "text"
    ? (t.start !== undefined && t.start !== null && String(t.start) !== "" ? String(t.start) : "—")
    : String(num(t.start) ?? 0);
  return `<div class="trk" title="${title}">${icon}${label}<span class="trk-v">${esc(shown)}</span></div>`;
};

// Rendered in a 4-column grid (2 on narrow screens): settings flow in rows of four —
// points/budget/floor/ceiling, then die/thresholds/mod-step.
const STAT_FIELDS = [
  { key: "pointsPerLevel", label: "stat points / level", hint: "Granted on every level-up. Requires exp/level trackers." },
  { key: "ccBudget", label: "creation budget", hint: "Total points to spend in hero creation." },
  { key: "ccFloor", label: "creation floor", hint: "Lowest starting stat in hero creation." },
  { key: "ccCeiling", label: "creation ceiling", hint: "Highest starting stat in hero creation." },
  { key: "dieSides", label: "dice sides", hint: "Faces on the skill-check die (20 = d20); criticals use the top/bottom ~5%." },
  { key: "averageThreshold", label: "average threshold", hint: "Stats below this take a penalty on skill checks; renders red." },
  { key: "exceptionalThreshold", label: "exceptional threshold", hint: "Stats above this gain a bonus on skill checks; renders gold." },
  { key: "modStep", label: "modifier step", hint: "How many stat points each +1/−1 on skill checks costs." }
];
const TRACKER_TYPES = ["number", "text"];
// [value, label] — the stored token stays `header`/`hero`/`both` (world files, trackers.js and
// main.js all branch on those), only the dropdown wording is friendlier.
const TRACKER_SHOWS = [["header", "chat header"], ["hero", "hero panel"], ["both", "both"], ["hidden", "hidden"]];
const TRACKER_NPC_SHOWS = [["profile", "npc profile"], ["hidden", "hidden"]];
// Stable tab ids: order is just the array order — insert/reorder here and nothing else
// renumbers (views, splits and dispatch all look up by id, never by position).
const TABS = [
  { id: "basics", name: "Basics" },
  { id: "story", name: "Story" },
  { id: "lorebook", name: "Lorebook" },
  { id: "npc", name: "NPC" },
  { id: "images", name: "Images" },
  { id: "stats", name: "Stats" },
  { id: "trackers", name: "Trackers" },
  { id: "npcTrackers", name: "NPC Trackers" },
  { id: "context", name: "Context" },
  { id: "raw", name: "Raw JSON" }
];
const TAB_IDS = new Set(TABS.map((t) => t.id));

function openCoverStudio(o) {
  const title = String(o.title || "untitled game").trim() || "untitled game";
  const notify = o.notify || (() => {});
  const confirmBox = o.ConfirmPopup || null;
  let bg = String(o.initialCover || "");
  let logo = "";
  let logoProc = ""; // cleanup/soften-filtered cutout actually composited (dataURL)
  let logoRawCanvas = null; // decoded raw logo pixels — the mask filters always re-run from here
  let logoAspect = 1; // raw logo w/h — drives the transform box proportions on the preview
  let scale = 0.72; // logo width as a fraction of cover width
  let yPos = 0.5; // logo center, cover fractions
  let xPos = 0.5;
  let rot = 0; // logo rotation, degrees (-180, 180]
  let prevBg = null, prevLogo = null, prevBox = null; // layered preview nodes (rebuilt on bg/logo swap)
  let cleanup = 25; // 0..100 — alpha cutout threshold + white-halo despill + despeckle
  let soften = 30; // 0..100 — alpha edge feather (0 = crisp)
  let outlineColor = "#ffffff"; // outline tint (hex); applied only when outlineWidth > 0
  let outlineWidth = 0; // 0..20 logo px — ring stamped around the finished mask (0 = off)
  let maskTimer = 0;
  const ov = document.createElement("div");
  ov.className = "popup-overlay";
  ov.innerHTML = `
    <div class="popup cs-popup" role="dialog" aria-label="Cover studio">
      <div class="popup-head"><span class="popup-title">🌟 Cover studio</span><button class="popup-x" id="csX" title="Close">✕</button></div>
      <div class="popup-body">
        <div class="cs-wrap">
          <div class="cs-prev" id="csPrev"></div>
          <div class="cs-side">
            <div class="cs-sec"><span>Background</span>
              <div class="ce-cover-btns">
                <button type="button" class="mini ok" id="csBgGen">🎲 Generate</button>
                <button type="button" class="mini" id="csBgUp">⬆ Upload</button>
                <button type="button" class="mini" id="csBgDl" hidden>⬇ Download</button>
              </div>
            </div>
            <div class="cs-sec"><span>Logo</span>
              <div class="ce-cover-btns">
                <button type="button" class="mini ok" id="csLogoGen">✨ Generate</button>
                <button type="button" class="mini" id="csLogoUp">⬆ Upload</button>
                <button type="button" class="mini" id="csLogoDl" hidden>⬇ Download</button>
                <button type="button" class="mini warn" id="csLogoClear" hidden>✕ Remove</button>
              </div>
              <div class="cs-logorow" id="csLogoRow" hidden>
                <div class="cs-sliders">
                  <div class="cs-hint">Drag the logo on the preview to move it — corner dots resize, outer dot rotates. Click the background to hide the box, the logo to re-show it. ⇧ drag = fine · keys: arrows · + − · [ ]</div>
                  <label class="ce-slider"><span>Cleanup</span><input type="range" class="mno-range" id="csCleanup" min="0" max="100" value="25" title="Cuts haze, specks and halo from the logo's alpha mask. Top half also chokes the edge inward — 100 cuts very aggressively."></label>
                  <label class="ce-slider"><span>Soften</span><input type="range" class="mno-range" id="csSoften" min="0" max="100" value="30" title="Feathers the logo's alpha mask edge. Subtle low down, heavy bloom at max."></label>
                  <label class="ce-slider"><span>Outline</span><span id="csOutlineMount" class="cs-pickmount"></span></label>
                  <label class="ce-slider"><span>Width</span><input type="range" class="mno-range" id="csOutlineW" min="0" max="20" value="0" title="Outline thickness in logo pixels. 0 = off."></label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="popup-acts">
        <button class="mini" id="csDl">⬇ Download</button>
        <button class="mini ok" id="csUse">💾 Save as cover</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const q = (s) => ov.querySelector(s);
  const prev = q("#csPrev");
  // Click-away selection: clicking the background hides the transform box, clicking the logo
  // (or the box itself) re-shows it. The logo layer ignores pointer events so the click target
  // is never the logo — hit-test against its on-screen rect instead (rotation makes it an
  // approximation, which is fine for a selection toggle). Attached once: `prev` itself persists
  // across repaints (only its children are rebuilt).
  prev.addEventListener("pointerdown", (e) => {
    if (!prevBox || !prevLogo) return;
    if (prevBox.contains(e.target)) {
      if (!boxSel) { boxSel = true; paintLogo(); }
      return; // the box's own handler starts the drag
    }
    const r = prevLogo.getBoundingClientRect();
    const overLogo = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (overLogo === boxSel) {
      if (overLogo) { try { prevBox.focus({ preventScroll: true }); } catch (err) { /* focus optional */ } }
      return;
    }
    boxSel = overLogo;
    paintLogo();
    try { if (overLogo) prevBox.focus({ preventScroll: true }); else prevBox.blur(); } catch (err) { /* focus optional */ }
  });
  const bgDlBtn = q("#csBgDl");
  const logoDlBtn = q("#csLogoDl");
  const logoRow = q("#csLogoRow");
  const logoClearBtn = q("#csLogoClear");
  const useBtn = q("#csUse");
  const dlBtn = q("#csDl");
  const release = pushBackClose(() => requestClose());
  function close() { release(); ov.remove(); document.removeEventListener("keydown", onKey); }
  function onKey(e) { if (e.key === "Escape") close(); }
  document.addEventListener("keydown", onKey);
  const loadImg = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
  // Bitmap-first decode for the cover studio (same pixels, off-main-thread decode): fetch the
  // source to bytes and decode with createImageBitmap (EXIF orientation applied), falling back
  // to <img> where unavailable. Works for data:, blob: and https: sources. Callers close()
  // bitmap results; <img> results need no cleanup. Never rejects with a lost image — callers
  // keep their existing resolve(src)/throw fallback.
  const srcToBitmap = async (src) => {
    const s = String(src || "");
    if (s && typeof createImageBitmap === "function") {
      try {
        const blob = await (await fetch(s)).blob();
        if (blob && blob.size) {
          try { const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" }); if (bmp) return bmp; } catch (e) {}
          try { const bmp2 = await createImageBitmap(blob); if (bmp2) return bmp2; } catch (e) {}
        }
      } catch (e) {}
    }
    return loadImg(src);
  };
  const srcSize = (x) => ({ w: Math.max(1, (x && (x.naturalWidth || x.width)) || 1), h: Math.max(1, (x && (x.naturalHeight || x.height)) || 1) });
  const closeSrc = (x) => { try { if (x && typeof x.close === "function") x.close(); } catch (e) {} };
  const bgToDataUrl = async (src) => {
    if (String(src || "").startsWith("data:")) return src;
    const res = await fetch(src, { mode: "cors" });
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    return await new Promise((res2, rej) => { const fr = new FileReader(); fr.onload = () => res2(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
  };
  const coverCrop = (w, h) => {
    const t = 3 / 4;
    let sw = w, sh = h, sx = 0, sy = 0;
    if (w / h > t) { sw = h * t; sx = (w - sw) / 2; }
    else { sh = w / t; sy = (h - sh) / 2; }
    return { sx, sy, sw, sh };
  };
  // Cover/logo encoders: bitmap-first decode, identical crop/scale/encode to before — only the
  // decode moved off the UI thread. Never rejects: any failure resolves with the source, so an
  // image is never lost over encoding (same contract as the old <img> versions).
  const encodeCover = async (src) => {
    let dec = null;
    try {
      dec = await srcToBitmap(src);
      const nat = srcSize(dec);
      const S = COVER_MAX_DIM;
      const cr = coverCrop(nat.w, nat.h);
      const k = Math.min(1, S / Math.max(cr.sw, cr.sh));
      const w = Math.max(1, Math.round(cr.sw * k));
      const h = Math.max(1, Math.round(cr.sh * k));
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(dec, cr.sx, cr.sy, cr.sw, cr.sh, 0, 0, w, h);
      closeSrc(dec); dec = null;
      return coverDataUrl(c);
    } catch (e) { closeSrc(dec); return src; }
  };
  const encodeLogo = async (src) => {
    let dec = null;
    try {
      dec = await srcToBitmap(src);
      const nat = srcSize(dec);
      const S = 512;
      const k = Math.min(1, S / Math.max(nat.w, nat.h));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(nat.w * k));
      c.height = Math.max(1, Math.round(nat.h * k));
      c.getContext("2d").drawImage(dec, 0, 0, c.width, c.height);
      closeSrc(dec); dec = null;
      return c.toDataURL("image/png");
    } catch (e) { closeSrc(dec); return src; }
  };
  // Decode a logo dataURL into a canvas at its natural (encodeLogo-capped) size, so the mask
  // filters below always re-run from pristine pixels and never stack on their own output.
  const logoToCanvas = async (src) => {
    const dec = await srcToBitmap(src);
    try {
      const nat = srcSize(dec);
      const c = document.createElement("canvas");
      c.width = nat.w;
      c.height = nat.h;
      c.getContext("2d").drawImage(dec, 0, 0, c.width, c.height);
      closeSrc(dec);
      return c;
    } catch (e) { closeSrc(dec); throw e; }
  };
  // Alpha cutout mask for the logo.
  //  cleanup 0..100: alpha threshold ramp (kills faint removeBackground haze), white-halo
  //    despill (un-mixes the white backing the generator composited on), isolated-speck
  //    removal, and — across the top half of the slider — morphological erosion that chokes
  //    the mask inward for stubborn rims and residue blobs. Curves are shaped so the low end
  //    behaves gently (thin lettering survives) while 100 cuts very aggressively.
  //    At 0 only near-zero noise (<4/255) is dropped, so clean uploads pass through.
  //  soften 0..100: Gaussian feather of the mask only (RGB is kept sharp, then recombined),
  //    so edges fade to transparent instead of blurring into a dark fringe. Quadratic curve:
  //    subtle through the low end, up to a heavy ~8px bloom at max.
  const applyLogoMask = (raw, cleanupV, softenV) => {
    const w = raw.width, h = raw.height;
    if (!w || !h) return raw;
    const co = Math.max(0, Math.min(100, cleanupV)) / 100;
    const so = Math.max(0, Math.min(100, softenV)) / 100;
    const srcCtx = raw.getContext("2d", { willReadFrequently: true });
    let src;
    try { src = srcCtx.getImageData(0, 0, w, h); }
    catch (e) { return raw; }
    const d = src.data;
    // Opaque fast path: nothing to cut or feather when the logo has no transparency at all
    // (e.g. an opaque JPEG upload) — the mask is solid, so threshold + feather are no-ops.
    let hasGlass = false;
    for (let i = 3; i < d.length; i += 4096) { if (d[i] < 250) { hasGlass = true; break; } }
    if (!hasGlass) return raw;
    // Power curves: gentle through the low end (≈ old behavior at the 25 default), far stronger
    // at full — threshold 4..200 (was 4..114), despill up to 1.0 (was 0.9).
    const thresh = 4 + Math.pow(co, 1.5) * 196;
    const span = Math.max(1, 255 - thresh);
    const despill = Math.min(1, co * 1.25);
    const n = w * h;
    let alpha = new Uint8ClampedArray(n);
    // Pass 1: threshold ramp + white despill into a separate mask (RGB kept aside for pass 2).
    for (let p = 0; p < n; p++) {
      const i = p * 4;
      const a = d[i + 3];
      let na;
      if (a <= thresh) na = 0;
      else if (co <= 0) na = a;
      else na = Math.round(((a - thresh) / span) * 255);
      if (na > 0 && na < 250 && despill > 0) {
        // The generator rendered on white: observed = true*af + white*(1-af) → solve for true.
        const af = a / 255;
        const inv = 1 - af;
        const rt = (d[i] - 255 * inv) / af;
        const gt = (d[i + 1] - 255 * inv) / af;
        const bt = (d[i + 2] - 255 * inv) / af;
        d[i] = Math.max(0, Math.min(255, d[i] + (rt - d[i]) * despill));
        d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + (gt - d[i + 1]) * despill));
        d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + (bt - d[i + 2]) * despill));
      }
      alpha[p] = na;
    }
    // Pass 2: despeckle — kill lone lit pixels fully surrounded by cut pixels (dust/noise dots).
    if (co > 0.02) {
      const cut = thresh * 0.5;
      const kill = new Uint8Array(n);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const p = y * w + x;
          if (alpha[p] <= 0) continue;
          let lit = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              if (alpha[p + dy * w + dx] > cut) { lit++; break; }
            }
            if (lit) break;
          }
          if (!lit) kill[p] = 1;
        }
      }
      for (let p = 0; p < n; p++) if (kill[p]) alpha[p] = 0;
    }
    // Pass 3: top-end choke — morphological erosion (3x3 minimum filter) shrinks the mask
    // inward, eating halo rims and residue blobs the threshold ramp leaves behind. Ramps 0..2px
    // across the slider's top half, blended fractionally so dragging stays continuous.
    if (co > 0.5) {
      const erode = Math.min(1, (co - 0.5) / 0.5) * 2; // 0..2 px
      const min3 = (srcArr) => {
        const out = new Uint8ClampedArray(n);
        for (let y = 0; y < h; y++) {
          const up = y > 0 ? -w : 0, dn = y < h - 1 ? w : 0;
          for (let x = 0; x < w; x++) {
            const p = y * w + x;
            const lf = x > 0 ? -1 : 0, rt = x < w - 1 ? 1 : 0;
            let m = srcArr[p];
            const a1 = srcArr[p + up + lf]; if (a1 < m) m = a1;
            const a2 = srcArr[p + up]; if (a2 < m) m = a2;
            const a3 = srcArr[p + up + rt]; if (a3 < m) m = a3;
            const a4 = srcArr[p + lf]; if (a4 < m) m = a4;
            const a5 = srcArr[p + rt]; if (a5 < m) m = a5;
            const a6 = srcArr[p + dn + lf]; if (a6 < m) m = a6;
            const a7 = srcArr[p + dn]; if (a7 < m) m = a7;
            const a8 = srcArr[p + dn + rt]; if (a8 < m) m = a8;
            out[p] = m;
          }
        }
        return out;
      };
      const full = Math.floor(erode), frac = erode - full;
      for (let k = 0; k < full; k++) alpha = min3(alpha);
      if (frac > 0.001) {
        const nxt = min3(alpha);
        for (let p = 0; p < n; p++) alpha[p] = alpha[p] + (nxt[p] - alpha[p]) * frac;
      }
    }
    // Pass 4: feather the mask only, then recombine over the sharp RGB.
    if (so > 0.005) {
      const radius = Math.pow(so, 2) * 8; // 0..8px — subtle low, heavy bloom at max
      try {
        const aCanvas = document.createElement("canvas");
        aCanvas.width = w; aCanvas.height = h;
        const aCtx = aCanvas.getContext("2d");
        const aImg = aCtx.createImageData(w, h);
        for (let p = 0; p < n; p++) {
          const i = p * 4, v = alpha[p];
          aImg.data[i] = v; aImg.data[i + 1] = v; aImg.data[i + 2] = v; aImg.data[i + 3] = 255;
        }
        aCtx.putImageData(aImg, 0, 0);
        const bCanvas = document.createElement("canvas");
        bCanvas.width = w; bCanvas.height = h;
        const bCtx = bCanvas.getContext("2d");
        bCtx.filter = `blur(${radius.toFixed(2)}px)`;
        bCtx.drawImage(aCanvas, 0, 0);
        const blurred = bCtx.getImageData(0, 0, w, h).data;
        for (let p = 0; p < n; p++) alpha[p] = blurred[p * 4];
      } catch (e) { /* ctx.filter unsupported — keep the unfeathered mask */ }
    }
    const out = document.createElement("canvas");
    out.width = w; out.height = h;
    const oCtx = out.getContext("2d");
    const oImg = oCtx.createImageData(w, h);
    for (let p = 0; p < n; p++) {
      const i = p * 4;
      oImg.data[i] = d[i]; oImg.data[i + 1] = d[i + 1]; oImg.data[i + 2] = d[i + 2];
      oImg.data[i + 3] = alpha[p];
    }
    oCtx.putImageData(oImg, 0, 0);
    return out;
  };
  // Re-run the mask from the pristine raw pixels and refresh the composited cutout.
  // Outline ring from the finished mask: dilate the silhouette by stamping it around a
  // 16-point ring (GPU-cheap dilation approx), punch the original shape back out, tint the
  // ring, and stack the logo on top. Runs on the cleanup/soften result, never on raw pixels.
  const normOutlineHex = (t) => {
    const m = String(t || "").trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return "";
    let hx = m[1].toLowerCase();
    if (hx.length === 3) hx = hx[0] + hx[0] + hx[1] + hx[1] + hx[2] + hx[2];
    return "#" + hx;
  };
  const addOutline = (logoCanvas, wPx, hex) => {
    const w = logoCanvas.width, h = logoCanvas.height;
    const m = normOutlineHex(hex);
    const r = Math.round(Math.max(0, Math.min(24, Number(wPx) || 0)));
    if (!w || !h || !r || !m) return logoCanvas;
    // Silhouette: solid shape carrying the logo's finished mask alpha.
    const sil = document.createElement("canvas"); sil.width = w; sil.height = h;
    const sCtx = sil.getContext("2d");
    sCtx.drawImage(logoCanvas, 0, 0);
    sCtx.globalCompositeOperation = "source-in";
    sCtx.fillStyle = "#fff"; sCtx.fillRect(0, 0, w, h);
    sCtx.globalCompositeOperation = "source-over";
    // Dilate by stamping the silhouette around the ring, then cut the original back out.
    const dil = document.createElement("canvas"); dil.width = w; dil.height = h;
    const dCtx = dil.getContext("2d");
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      dCtx.drawImage(sil, Math.cos(a) * r, Math.sin(a) * r);
    }
    dCtx.globalCompositeOperation = "destination-out";
    dCtx.drawImage(sil, 0, 0);
    // Tint the ring and stack the logo over it.
    dCtx.globalCompositeOperation = "source-in";
    dCtx.fillStyle = m; dCtx.fillRect(0, 0, w, h);
    dCtx.globalCompositeOperation = "source-over";
    const out = document.createElement("canvas"); out.width = w; out.height = h;
    const oCtx = out.getContext("2d");
    oCtx.drawImage(dil, 0, 0);
    oCtx.drawImage(logoCanvas, 0, 0);
    return out;
  };
  const refreshLogoProc = () => {
    if (!logo || !logoRawCanvas) { logoProc = logo || ""; return; }
    try {
      let out = applyLogoMask(logoRawCanvas, cleanup, soften);
      out = addOutline(out, outlineWidth, outlineColor);
      logoProc = out === logoRawCanvas && logo.startsWith("data:") ? logo : out.toDataURL("image/png");
    } catch (e) { logoProc = logo; }
  };
  // Slider input runs the (synchronous, ~ms at 512px) mask immediately but repaints the cover
  // combo on a short debounce — dragging fires dozens of events per second.
  const scheduleMaskPaint = () => {
    clearTimeout(maskTimer);
    maskTimer = setTimeout(() => { refreshLogoProc(); paint(); }, 60);
  };
  // Direct-manipulation math (pure — the transform-box drag handlers feed pointer
  // positions through these, so the gestures stay testable without a live popup).
  // Move: pointer delta in cover fractions, scaled by `k` (Shift = 0.2 fine mode).
  const csMoveStep = (x0, y0, sx, sy, px, py, k) => ({ x: x0 + (px - sx) * k, y: y0 + (py - sy) * k });
  // Uniform resize with rotation: project the pointer's travel from the box center onto the
  // grabbed corner's axis (all in px). Falls back to radial distance when the box is tiny.
  const csResizeScale = (s0, cx, cy, ux, uy, qx, qy, px, py) => {
    const clamp = (v) => Math.max(0.05, Math.min(2.5, v));
    const p0 = (qx - cx) * ux + (qy - cy) * uy;
    if (Math.abs(p0) < 2) {
      const d0 = Math.hypot(qx - cx, qy - cy);
      if (d0 < 2) return s0;
      return clamp(s0 * Math.hypot(px - cx, py - cy) / d0);
    }
    return clamp(s0 * (((px - cx) * ux + (py - cy) * uy) / p0));
  };
  // Rotate: angular travel around the center, in degrees, normalized to (-180, 180].
  // `snap` rounds to 15° steps (Shift).
  const csRotateTo = (r0, a0, a1, snap) => {
    let r = r0 + ((a1 - a0) * 180) / Math.PI;
    if (snap) r = Math.round(r / 15) * 15;
    return (((r + 180) % 360) + 360) % 360 - 180;
  };
  const drawCombo = async (bgSrc, logoSrc, sc, yp, xp, rotDeg) => {
    let b = null, lg = null;
    try {
      b = await srcToBitmap(bgSrc);
      const bNat = srcSize(b);
      const cr = coverCrop(bNat.w, bNat.h);
      const k = Math.min(1, COVER_MAX_DIM / Math.max(cr.sw, cr.sh));
      const cw = Math.max(1, Math.round(cr.sw * k));
      const ch = Math.max(1, Math.round(cr.sh * k));
      const c = document.createElement("canvas");
      c.width = cw; c.height = ch;
      const ctx = c.getContext("2d");
      ctx.drawImage(b, cr.sx, cr.sy, cr.sw, cr.sh, 0, 0, cw, ch);
      if (logoSrc) {
        lg = await srcToBitmap(logoSrc);
        const lNat = srcSize(lg);
        const lw = cw * sc;
        const lh = lw * (lNat.h / lNat.w);
        ctx.save();
        ctx.translate((xp == null ? 0.5 : xp) * cw, yp * ch);
        ctx.rotate(((Number(rotDeg) || 0) * Math.PI) / 180);
        ctx.shadowColor = "rgba(0,0,0,0.65)";
        ctx.shadowBlur = Math.max(2, cw * 0.02);
        ctx.shadowOffsetY = Math.max(1, cw * 0.006);
        ctx.drawImage(lg, -lw / 2, -lh / 2, lw, lh);
        ctx.restore();
      }
      closeSrc(b); b = null; closeSrc(lg); lg = null;
      return coverDataUrl(c);
    } catch (e) { closeSrc(b); closeSrc(lg); throw e; }
  };
  // Layered preview: the bg plus the processed logo are stacked as DOM layers and the
  // transform box positions them with CSS, so drags repaint synchronously at 60fps with no
  // canvas re-render. Flattening (drawCombo) only runs for Download / Save as cover.
  let rotH = null; // rotate handle node, assigned when the box is built in paint()
  let boxSel = true; // transform box selected — clicking the background hides it, clicking the logo re-shows it
  const paintLogo = () => {
    if (!prevLogo || !prevBox) return;
    // Clamp the center so a grabbable strip of the box always stays on-canvas — otherwise a
    // logo dragged fully outside could never be dragged back (no sliders to recover with).
    // NOTE: cover fractions — x spans the full width, y spans height = width/0.75.
    const m = 0.08;
    const hx = scale / 2, hy = (scale / Math.max(0.01, logoAspect)) * 0.375;
    xPos = Math.min(1 - m + hx, Math.max(m - hx, xPos));
    yPos = Math.min(1 - m + hy, Math.max(m - hy, yPos));
    scale = Math.min(2.5, Math.max(0.05, scale));
    const t = `translate(-50%,-50%) rotate(${rot}deg)`;
    for (const el of [prevLogo, prevBox]) {
      el.style.left = (xPos * 100).toFixed(3) + "%";
      el.style.top = (yPos * 100).toFixed(3) + "%";
      el.style.width = (scale * 100).toFixed(3) + "%";
      el.style.transform = t;
    }
    prevBox.style.aspectRatio = String(logoAspect);
    // The rotate handle sticks out ~36px above the box and the preview clips overflow — when the
    // logo sits near the top it would be cut off and unreachable, so flip the handle to hang
    // below the box instead (but only when there's room there — a giant logo filling the whole
    // preview keeps the handle on top). Rotation-aware: the corners swing out as the logo turns.
    const prevW = prev.clientWidth || 250, prevH = prev.clientHeight || 333;
    const bw = scale * prevW, bh = bw / Math.max(0.01, logoAspect);
    const rad = (rot * Math.PI) / 180;
    const rotHH = Math.abs((bw / 2) * Math.sin(rad)) + Math.abs((bh / 2) * Math.cos(rad));
    const topGap = yPos * prevH - rotHH;
    const botGap = prevH - (yPos * prevH + rotHH);
    prevBox.classList.toggle("flip", topGap < 42 && botGap > 42);
    prevBox.style.display = boxSel ? "" : "none";
  };
  const wireBox = () => {
    let drag = null;
    const fracOf = (e) => {
      const r = prev.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, r };
    };
    prevBox.addEventListener("pointerdown", (e) => {
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      try { prevBox.setPointerCapture(e.pointerId); } catch (err) { /* mouse — capture optional */ }
      prevBox.focus({ preventScroll: true });
      const p = fracOf(e);
      const cx = p.r.left + xPos * p.r.width, cy = p.r.top + yPos * p.r.height;
      const corner = e.target && e.target.dataset ? e.target.dataset.c : "";
      if (e.target === rotH) {
        drag = { mode: "rotate", r0: rot, a0: Math.atan2(e.clientY - cy, e.clientX - cx), cx, cy };
      } else if (corner === "tl" || corner === "tr" || corner === "bl" || corner === "br") {
        // Corner axis in px: the grabbed corner's offset from center, rotated by `rot`.
        const lw = scale * p.r.width, lh = lw / logoAspect;
        const ox = (corner[1] === "r" ? 1 : -1) * lw / 2;
        const oy = (corner[0] === "b" ? 1 : -1) * lh / 2;
        const rad = (rot * Math.PI) / 180;
        const vx = Math.cos(rad) * ox - Math.sin(rad) * oy;
        const vy = Math.sin(rad) * ox + Math.cos(rad) * oy;
        const len = Math.hypot(vx, vy) || 1;
        drag = { mode: "resize", s0: scale, cx, cy, ux: vx / len, uy: vy / len, qx: e.clientX, qy: e.clientY };
      } else {
        drag = { mode: "move", x0: xPos, y0: yPos, sx: p.x, sy: p.y };
      }
    });
    prevBox.addEventListener("pointermove", (e) => {
      if (!drag) return;
      if (drag.mode === "move") {
        const p = fracOf(e);
        const k = e.shiftKey ? 0.2 : 1;
        const m = csMoveStep(drag.x0, drag.y0, drag.sx, drag.sy, p.x, p.y, k);
        xPos = m.x; yPos = m.y;
      } else if (drag.mode === "resize") {
        scale = csResizeScale(drag.s0, drag.cx, drag.cy, drag.ux, drag.uy, drag.qx, drag.qy, e.clientX, e.clientY);
      } else {
        rot = csRotateTo(drag.r0, drag.a0, Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx), e.shiftKey);
      }
      paintLogo();
    });
    const endDrag = () => { drag = null; };
    prevBox.addEventListener("pointerup", endDrag);
    prevBox.addEventListener("pointercancel", endDrag);
    // Keyboard parity for the spatial controls the sliders used to own: arrows move
    // (⇧ = ×5), +/− scale, [ ] rotate.
    prevBox.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 0.05 : 0.01;
      let used = true;
      if (e.key === "ArrowLeft") xPos -= step;
      else if (e.key === "ArrowRight") xPos += step;
      else if (e.key === "ArrowUp") yPos -= step;
      else if (e.key === "ArrowDown") yPos += step;
      else if (e.key === "+" || e.key === "=") scale = Math.min(2.5, scale * 1.05);
      else if (e.key === "-" || e.key === "_") scale = Math.max(0.05, scale / 1.05);
      else if (e.key === "[") rot = csRotateTo(rot, 0, (-5 * Math.PI) / 180, false);
      else if (e.key === "]") rot = csRotateTo(rot, 0, (5 * Math.PI) / 180, false);
      else used = false;
      if (used) { e.preventDefault(); paintLogo(); }
    });
  };
  const paint = () => {
    logoRow.hidden = !logo;
    logoDlBtn.hidden = !logo;
    bgDlBtn.hidden = !bg;
    logoClearBtn.hidden = !logo;
    dlBtn.disabled = !bg;
    useBtn.disabled = !bg;
    if (!bg) {
      prev.innerHTML = `<span class="ce-cover-ph">🖼</span>`;
      prevBg = prevLogo = prevBox = null;
      return;
    }
    if (!prevBg || prevBg.dataset.src !== bg) {
      prev.innerHTML = "";
      prevBg = document.createElement("img");
      prevBg.className = "cs-bg";
      prevBg.alt = "cover background";
      prevBg.draggable = false;
      prevBg.src = bg;
      prevBg.dataset.src = bg;
      prev.appendChild(prevBg);
      prevLogo = prevBox = null;
    }
    const effLogo = logoProc || logo;
    if (!effLogo) {
      if (prevLogo) { prevLogo.remove(); prevLogo = null; }
      if (prevBox) { prevBox.remove(); prevBox = null; }
      return;
    }
    if (!prevLogo || !prevBox) {
      prevLogo = document.createElement("img");
      prevLogo.className = "cs-logo";
      prevLogo.alt = "cover logo";
      prevLogo.draggable = false;
      prevBox = document.createElement("div");
      prevBox.className = "cs-box";
      prevBox.tabIndex = 0;
      prevBox.setAttribute("role", "application");
      prevBox.setAttribute("aria-label", "Logo transform box. Drag to move, corner dots resize, outer dot rotates. Arrow keys move, plus and minus resize, brackets rotate.");
      for (const cn of ["tl", "tr", "bl", "br"]) {
        const h = document.createElement("span");
        h.className = "cs-h";
        h.dataset.c = cn;
        prevBox.appendChild(h);
      }
      rotH = document.createElement("span");
      rotH.className = "cs-rot";
      rotH.title = "Drag to rotate (⇧ = snap 15°)";
      prevBox.appendChild(rotH);
      wireBox();
      prev.appendChild(prevLogo);
      prev.appendChild(prevBox);
    }
    if (prevLogo.dataset.src !== effLogo) { prevLogo.src = effLogo; prevLogo.dataset.src = effLogo; }
    paintLogo();
  };
  // Adopt a fresh raw logo (generated or uploaded): keep the pristine pixels for the mask
  // filters, run cleanup/soften once, then repaint the combo.
  const setLogo = async (rawUrl) => {
    logo = rawUrl || "";
    logoProc = "";
    logoRawCanvas = null;
    logoAspect = 1;
    boxSel = true; // a fresh logo arrives selected, box visible
    if (logo) {
      try {
        logoRawCanvas = await logoToCanvas(logo);
        if (logoRawCanvas) logoAspect = (logoRawCanvas.width / logoRawCanvas.height) || 1;
      }
      catch (e) { logoRawCanvas = null; }
      refreshLogoProc();
    }
    paint();
  };
  const ctxLines = () => [
    `Title: ${title}`,
    o.description ? `Description: ${o.description}` : "",
    o.vibe ? `Vibe: ${o.vibe}` : "",
    o.scenario ? `Premise: ${String(o.scenario).slice(0, 600)}` : "",
    (o.tags && o.tags.length) ? `Tags: ${o.tags.join(", ")}` : ""
  ].filter(Boolean);
  const clean = (s) => String(s || "").replace(/\[\[[^\]]*\]\]/g, " ").replace(/\s+/g, " ").trim();
  const genBg = async () => {
    const g = window.genImage;
    if (!g) throw new Error("no image generator");
    let base = "";
    if (window.genText) {
      const res = await withTimeout(window.genText({ instruction: [
        "You write image-generation prompts for a game cover art. Write ONE rich visual prompt for a portrait-orientation with no text, no words, no letters, no logo and no watermark that captures the world's mood, setting and genre.",
        "Be concrete and visual. 2-5 sentences. Reply with ONLY the prompt itself — no quotes, no commentary.",
        "",
        "Now write the background prompt for THIS game:",
        ...ctxLines()
      ].join("\n"), route: "other", maxTokens: 160 }), IMAGE_PROMPT_TIMEOUT_MS, "Cover prompt timed out.");
      base = clean((res && res.text) || res);
    }
    if (!base) base = `Breathtaking RPG world background art for "${title}"` + (o.description ? ` — ${o.description}` : "");
    const prompt = ["A game cover.", base, o.styleTags ? `(${o.styleTags})` : ""].filter(Boolean).join(" ") + ", portrait cover composition, no text, no watermark";
    const neg = [o.negTags || "", "text, words, letters, typography, title, logo, watermark, frame, border"].filter(Boolean).join(", ");
    // genImageSafe times out (the plugin's promise never settles on failure) and throws on empty.
    const r = await genImageSafe(g, prompt, { route: "other", resolution: "512x768", negativePrompt: neg, guidanceScale: imageGuidance() });
    const src = (r && r.dataUrl) || r;
    const url = src ? await encodeCover(src) : "";
    if (!url) throw new Error("no image returned");
    return url;
  };
  const genLogo = async () => {
    const g = window.genImage;
    if (!g) throw new Error("no image generator");
    let base = "";
    if (window.genText) {
      const res = await withTimeout(window.genText({ instruction: [
        "You write image-generation prompts for a game title logo. Write ONE short prompt for a bold stylized title-lettering emblem that fits the game's mood and genre.",
        "1-2 sentences. Reply with ONLY the prompt itself — no quotes, no commentary.",
        "",
        "Now write the logo prompt for THIS game:",
        `Title: ${title}`,
        o.description ? `Description: ${o.description}` : "",
        (o.tags && o.tags.length) ? `Tags: ${o.tags.join(", ")}` : ""
      ].join("\n"), route: "other", maxTokens: 80 }), IMAGE_PROMPT_TIMEOUT_MS, "Logo prompt timed out.");
      base = clean((res && res.text) || res);
    }
    if (!base) base = "ornate glowing title lettering";
    const prompt = `Game title logo reading "${title}", ${base}, bold stylized lettering emblem, isolated centered on a plain solid white background, flat graphic logo, no scenery, no photo`;
    const neg = [o.negTags || "", "scenery, photo, landscape, background, watermark, frame, border"].filter(Boolean).join(", ");
    const wide = Math.random() < 0.5;
    const r = await genImageSafe(g, prompt, { route: "other", resolution: wide ? "768x512" : "512x512", negativePrompt: neg, removeBackground: true, guidanceScale: imageGuidance() });
    const src = (r && r.dataUrl) || r;
    const url = src ? await encodeLogo(src) : "";
    if (!url) throw new Error("no image returned");
    return url;
  };
  q("#csBgGen").onclick = async () => {
    const btn = q("#csBgGen");
    setBusy(btn, "Painting…");
    try { bg = await genBg(); paint(); notify("🖼 Background ready."); }
    catch (err) { console.error("Cover generation failed:", err); notify("⚠ Cover generation failed — try again.", { ms: 4200 }); }
    finally { clearBusy(btn); }
  };
  q("#csLogoGen").onclick = async () => {
    const btn = q("#csLogoGen");
    setBusy(btn, "Lettering…");
    try { await setLogo(await genLogo()); notify("✨ Logo ready."); }
    catch (err) { console.error("Logo generation failed:", err); notify("⚠ Logo generation failed — try again.", { ms: 4200 }); }
    finally { clearBusy(btn); }
  };
  q("#csBgUp").onclick = async () => {
    const file = await pickImageFile();
    if (!file) return;
    const btn = q("#csBgUp");
    btn.disabled = true;
    try {
      bg = await fileToAvatarDataUrl(file, { maxDim: COVER_MAX_DIM, quality: COVER_WEBP_QUALITY, mime: COVER_MIME });
      paint(); notify("🖼 Background uploaded.");
    } catch (err) { notify("⚠ " + (err && err.message ? err.message : "Couldn't read that file."), { ms: 4200 }); }
    finally { btn.disabled = false; }
  };
  q("#csLogoUp").onclick = async () => {
    const file = await pickImageFile();
    if (!file) return;
    const btn = q("#csLogoUp");
    btn.disabled = true;
    try {
      const obj = URL.createObjectURL(file);
      const url = await encodeLogo(obj);
      URL.revokeObjectURL(obj);
      if (!url) throw new Error("bad image");
      await setLogo(url); notify("✨ Logo uploaded.");
    } catch (err) { notify("⚠ " + (err && err.message ? err.message : "Couldn't read that file."), { ms: 4200 }); }
    finally { btn.disabled = false; }
  };
  logoClearBtn.onclick = () => {
    logo = ""; logoProc = ""; logoRawCanvas = null;
    scale = 0.72; xPos = 0.5; yPos = 0.5; rot = 0; // a removed logo leaves no stale transform behind
    boxSel = true;
    paint();
  };
  const dlOne = (src, name) => {
    const s = String(src || "");
    if (!s) return;
    if (!s.startsWith("data:")) { window.open(s, "_blank", "noopener"); return; }
    const a = document.createElement("a");
    a.href = s; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  };
  bgDlBtn.onclick = () => { dlOne(bg, "cover-bg.webp"); notify("Background downloaded."); };
  logoDlBtn.onclick = () => { dlOne(logoProc || logo, "cover-logo.png"); notify("Logo downloaded."); };
  dlBtn.onclick = async () => {
    if (!bg) return;
    setBusy(dlBtn, "Preparing…");
    try {
      const effLogo = logoProc || logo;
      const url = effLogo ? await drawCombo(bg, effLogo, scale, yPos, xPos, rot) : bg;
      const s = String(url || "");
      if (!s) throw new Error("empty image");
      if (!s.startsWith("data:")) { window.open(s, "_blank", "noopener"); return; }
      const a = document.createElement("a");
      a.href = s; a.download = "cover.webp";
      document.body.appendChild(a); a.click(); a.remove();
      notify("Cover downloaded.");
    } catch (err) { notify("⚠ Download failed.", { ms: 4200 }); }
    finally { clearBusy(dlBtn); }
  };
  const cleanupInp = q("#csCleanup");
  const softenInp = q("#csSoften");
  if (cleanupInp) {
    cleanupInp.value = String(cleanup);
    cleanupInp.oninput = (e) => {
      cleanup = Math.max(0, Math.min(100, Number(e.target.value) || 0));
      scheduleMaskPaint();
    };
  }
  if (softenInp) {
    softenInp.value = String(soften);
    softenInp.oninput = (e) => {
      soften = Math.max(0, Math.min(100, Number(e.target.value) || 0));
      scheduleMaskPaint();
    };
  }
  const outlineMount = q("#csOutlineMount");
  if (outlineMount) {
    const picker = new ColorPicker({
      value: outlineColor,
      placeholder: "#ffffff",
      title: "Outline color — hex like #ffffff",
      onInput: (hex) => { outlineColor = hex; scheduleMaskPaint(); }
    });
    outlineMount.replaceWith(picker.el);
  }
  const outlineWInp = q("#csOutlineW");
  if (outlineWInp) {
    outlineWInp.value = String(outlineWidth);
    outlineWInp.oninput = (e) => {
      outlineWidth = Math.max(0, Math.min(24, Number(e.target.value) || 0));
      scheduleMaskPaint();
    };
  }
  useBtn.onclick = async () => {
    if (!bg) return;
    if (confirmBox) {
      const ok = await confirmBox.open({ title: "Save as cover?", message: "This flattens the background and logo into a single image. The separate layers won't be saved unless you download them.", confirmText: "Save cover" });
      if (!ok) return;
    }
    setBusy(useBtn, "Combining…");
    try {
      const effLogo = logoProc || logo;
      const url = effLogo ? await drawCombo(bg, effLogo, scale, yPos, xPos, rot) : bg;
      o.onUse(url);
      close();
    } catch (err) { notify("⚠ Combine failed.", { ms: 4200 }); }
    finally { clearBusy(useBtn); }
  };
  const requestClose = async () => {
    if ((bg || logo) && confirmBox) {
      const ok = await confirmBox.open({ title: "Close without saving?", message: "The staged background and logo won't be saved unless you download them.", confirmText: "Close", danger: true });
      if (!ok) return;
    }
    close();
  };
  q("#csX").onclick = requestClose;
  paint();
  if (bg && !bg.startsWith("data:")) {
    bgToDataUrl(bg).then((url) => { bg = url; paint(); }).catch(() => {});
  }
}

export function openWorldEditor(fileForm, opts = {}) {
  const { worldStore, onSaved, notify, ConfirmPopup, genImage, community } = opts;
  const M = JSON.parse(JSON.stringify(fileForm || {}));
  // Fill in the parts the structured tabs write, so a hand-built/raw-edited world still edits
  // consistently (the loader would default these anyway).
  M.meta = M.meta && typeof M.meta === "object" ? M.meta : {};
  M.meta.tags = Array.isArray(M.meta.tags) ? M.meta.tags : [];
  // Fold a legacy reserved `nsfw` tag into the boolean (the world file's source of truth) and drop
  // every reserved marker from the tag list, so the toggle and the tag chips agree on old files.
  // (The NSFW marker is tested by name: a stray `remix` tag must not declare the world adult.)
  if (M.meta.tags.some(isNsfwTag)) M.meta.nsfw = true;
  M.meta.tags = M.meta.tags.filter((t) => !isReservedTag(t));
  M.meta.nsfw = M.meta.nsfw === true;
  M.meta.commentsOff = M.meta.commentsOff === true;
  M.stats = M.stats && typeof M.stats === "object" ? M.stats : {};
  M.stats.defs = Array.isArray(M.stats.defs) ? M.stats.defs : [];
  if (M.stats.dieSides === undefined) M.stats.dieSides = DEFAULT_STATS.dieSides;
  if (M.stats.ccCeiling === undefined || M.stats.ccCeiling === "" ) M.stats.ccCeiling = DEFAULT_STATS.ccCeiling;
  if (typeof M.imageIncludeTrackers !== "boolean") M.imageIncludeTrackers = false;
  if (typeof M.imageIncludeNpcTrackers !== "boolean") M.imageIncludeNpcTrackers = false;
  if (!Array.isArray(M.imageTrackerKeys)) M.imageTrackerKeys = [];
  if (!Array.isArray(M.imageNpcTrackerKeys)) M.imageNpcTrackerKeys = [];
  if (typeof M.stats.useStatModFormula !== "boolean") M.stats.useStatModFormula = false;
  if (typeof M.stats.statModFormula !== "string") M.stats.statModFormula = "";
  if (typeof M.stats.checkIncludeTrackers !== "boolean") M.stats.checkIncludeTrackers = false;
  if (typeof M.stats.checkIncludeNpcTrackers !== "boolean") M.stats.checkIncludeNpcTrackers = false;
  if (!Array.isArray(M.stats.checkTrackerKeys)) M.stats.checkTrackerKeys = [];
  if (!Array.isArray(M.stats.checkNpcTrackerKeys)) M.stats.checkNpcTrackerKeys = [];
  if (typeof M.stats.useCheckInstruction !== "boolean") M.stats.useCheckInstruction = false;
  if (typeof M.stats.checkInstruction !== "string") M.stats.checkInstruction = "";
  M.trackers = Array.isArray(M.trackers) ? M.trackers : [];
  // Per-NPC tracked values (see README §6.3.1) — same def shape as `trackers` minus `show`.
  M.npcTrackers = Array.isArray(M.npcTrackers) ? M.npcTrackers : [];
  M.npcs = Array.isArray(M.npcs) ? M.npcs : [];
  // The lorebook always edits as an array of entries (a legacy plain-text lorebook or empty value
  // normalizes to entries here — the loader accepts both, so raw/legacy worlds still open fine).
  M.lorebook = normalizeLorebook(M.lorebook);
  // The trigger-lookback window is an engine-level constant (DEFAULT_TRIGGER_WINDOW_TURNS), not a
  // world setting — drop any legacy value a pre-change world file may carry so it doesn't persist.
  delete M.loreTriggerWindowTurns;
  // Snapshot AFTER normalization: open-time defaults/folding must not count as user changes,
  // or worlds saved before the newest defaults existed always open "dirty" (Cancel warns).
  const ORIG = JSON.stringify(M);

  let curTab = "basics";
  // (Each master/detail tab keeps its selection, mobile-drill-down flag and list scroll offset inside
  // the split controller it creates below — see `createSplit`.)
  let stylePreviewDataUrl = ""; // last generated style-preview portrait (kept while the editor is open)
  let touched = false;

 const overlay = document.createElement("div");
 overlay.className = "ce-overlay";
  // Header context line (world name + id + remix) lives in its own sub row so a long name
  // truncates there instead of squeezing the title/dirty/close row. Repainted on rename.
  const worldLineHtml = () => `${esc(M.meta.name || "(untitled)")}<span class="ce-id"> · ${esc(M.meta.id || "no id")}</span>${M.meta.remix ? `<span class="ce-remix" title="Duplicated from a community world"> · ⧉ remix of ${esc(M.meta.remix.name || "")} by <b>@${esc(M.meta.remix.author || "?")}</b></span>` : ""}`;
  const paintWorldLine = () => { const w = overlay.querySelector(".ce-world"); if (w) w.innerHTML = worldLineHtml(); };
  overlay.innerHTML = `
    <div class="ce-panel" tabindex="-1" role="dialog" aria-label="World Editor">
      <div class="ce-hdr">
        <span class="ce-ic" aria-hidden="true"></span>
        <div class="ce-head">
          <span class="ce-title">World Editor</span>
          <span class="ce-dirty" hidden>● Unsaved</span>
          <button class="popup-x ce-close" type="button" title="Close" aria-label="Close">✕</button>
        </div>
        <div class="ce-sub"><span class="ce-world">${worldLineHtml()}</span></div>
        <div class="ce-tabs-wrap">
          <div class="ce-tabs" role="tablist" aria-label="World sections">
            ${TABS.map((t, i) => `<button type="button" role="tab" aria-selected="${i === 0 ? "true" : "false"}" title="${esc(t.name)}" class="ce-tab${i === 0 ? " on" : ""}" data-t="${t.id}">${esc(t.name)}</button>`).join("")}
          </div>
          <button type="button" class="ce-tab-nav prev" data-nav="prev" aria-label="Scroll tabs left" title="Scroll tabs left" tabindex="-1" hidden>‹</button>
          <button type="button" class="ce-tab-nav next" data-nav="next" aria-label="Scroll tabs right" title="Scroll tabs right" tabindex="-1" hidden>›</button>
        </div>
      </div>
      <div class="ce-body">
        ${TABS.map((t, i) => `<div class="ce-view" data-view="${t.id}"${i === 0 ? "" : " hidden"}></div>`).join("")}
      </div>
      <div class="ce-foot">
        <span class="ce-err" id="ceErr"></span>
        <button class="mini ce-cancel">Cancel</button>
        <button class="mini ok ce-save">💾 Save World</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const release = pushBackClose(() => close());
  overlay.querySelector(".ce-panel").focus();

  const $v = (id) => overlay.querySelector(`.ce-view[data-view="${id}"]`);
  const errEl = overlay.querySelector("#ceErr");
  const showErr = (m) => { errEl.textContent = m || ""; };
  const setRawStatus = (el, msg, cls) => { el.textContent = msg; el.className = "ce-raw-status" + (cls ? " " + cls : ""); };

  const markTouched = () => {
    touched = true;
    overlay.querySelector(".ce-dirty").hidden = false;
  };
  const isDirty = () => touched || JSON.stringify(M) !== ORIG;
  // Browser-level guard: the in-panel ConfirmPopup covers ✕/Cancel/Escape/Back, but it can't
  // stop a tab close, reload, or address-bar navigation — only the native `beforeunload`
  // dialog can. Registered per editor instance (closure over its own M/ORIG) and removed on
  // every successful exit path below, so a saved/discarded editor leaves no stale guard.
  const onBeforeUnload = (e) => {
    if (!isDirty()) return;
    e.preventDefault();
    e.returnValue = "";
  };
  window.addEventListener("beforeunload", onBeforeUnload);
  const detachBeforeUnload = () => window.removeEventListener("beforeunload", onBeforeUnload);

  /* ---------- shared: duplicate-key + number validation (block save) ---------- */
  // Tracker keys flow into the machine-readable [TRACKERS] / [NPC TRACKERS] blocks
  // (`key: value` per line — see parseTrackerBlock in trackers.js) and into `= formula`
  // max/start expressions, so they must be block-safe ids: start with a letter/underscore,
  // then letters/digits/underscores/hyphens. Anything else — spaces included — means the
  // AI's updates for that tracker silently fail to parse, so it blocks saving.
  const TRACKER_KEY_RE = /^[A-Za-z_][A-Za-z0-9_-]*$/;
  const isValidTrackerKey = (k) => TRACKER_KEY_RE.test(String(k || "").trim());
  // Save-blocking key check for both tracker grids: every def needs a key, and every key
  // must match TRACKER_KEY_RE. Runs before the loader check in saveQuiet, so a spaced key
  // like "hair style" (which the loader would only warn-and-skip) stops the save instead.
  const trackerKeyErrors = () => {
    const out = [];
    const check = (list, what) => {
      (list || []).forEach((t, i) => {
        const k = String(t.key || "").trim();
        const n = i + 1;
        if (!k) { out.push(`${what} ${n} needs a key — every ${what.toLowerCase()} must have a unique id (e.g. hp).`); return; }
        if (/\s/.test(k)) { out.push(`${what} key "${k}" must not contain spaces — use underscores (e.g. "${k.replace(/\s+/g, "_")}").`); return; }
        if (!TRACKER_KEY_RE.test(k)) { out.push(`${what} key "${k}" is invalid — use letters, digits, underscores and hyphens, starting with a letter (e.g. hp, magic_points).`); return; }
      });
    };
    check(M.trackers, "Tracker");
    if (!out.length) check(M.npcTrackers, "NPC tracker");
    return out;
  };
  const dupErrors = () => {
    const out = [];
    const statSeen = {};
    for (const d of M.stats.defs) {
      if (!d.key) continue;
      if (statSeen[d.key]) { out.push(`Duplicate stat key "${d.key}"`); break; }
      statSeen[d.key] = true;
    }
    const trkSeen = {};
    for (const t of M.trackers) {
      const k = String(t.key || "").trim();
      if (!k) continue;
      if (trkSeen[k]) { out.push(`Duplicate tracker key "${k}"`); break; }
      trkSeen[k] = true;
    }
    const ntrkSeen = {};
    for (const t of (M.npcTrackers || [])) {
      const k = String(t.key || "").trim();
      if (!k) continue;
      if (ntrkSeen[k]) { out.push(`Duplicate NPC tracker key "${k}"`); break; }
      ntrkSeen[k] = true;
    }
    const npcSeen = {};
    for (const n of M.npcs) {
      const nm = String(n.name || "").trim();
      if (!nm) { out.push("Every world NPC needs a name."); break; }
      const key = nm.toLowerCase();
      if (npcSeen[key]) { out.push(`Duplicate world NPC "${nm}"`); break; }
      npcSeen[key] = true;
    }
    return out;
  };
  const numFieldErrors = () => {
    const out = [];
    for (const f of STAT_FIELDS) {
      const v = M.stats[f.key];
      if (v === "" || v === undefined || v === null) continue;
      if (typeof v !== "number" || !Number.isFinite(v)) out.push(`Setting "${f.label}" must be a number`);
    }
    for (const d of M.stats.defs) {
      for (const f of ["start", "max"]) {
        if (d[f] === "" || d[f] === undefined || d[f] === null) continue;
        if (typeof d[f] !== "number" || !Number.isFinite(d[f])) out.push(`Stat "${d.key || "?"}" ${f} must be a number`);
      }
    }
    for (const t of M.trackers) {
      if (t.type !== "number") continue;
      for (const f of ["max", "start"]) {
        const v = t[f];
        if (v === undefined || v === null || v === "") continue;
        if (typeof v === "number" && Number.isFinite(v)) continue;
        if (typeof v === "string" && v.trim().startsWith("=")) continue;
        out.push(`Tracker "${t.key || "?"}" ${f} must be a number or "= formula"`);
      }
    }
    for (const t of (M.npcTrackers || [])) {
      if (t.type !== "number") continue;
      for (const f of ["max", "start"]) {
        const v = t[f];
        if (v === undefined || v === null || v === "") continue;
        if (typeof v === "number" && Number.isFinite(v)) continue;
        if (typeof v === "string" && v.trim().startsWith("=")) continue;
        out.push(`NPC tracker "${t.key || "?"}" ${f} must be a number or "= formula"`);
      }
    }
    return out;
  };
  const formulaErrors = () => {
    const out = [];
    const scope = sampleFormulaScope(M.stats.defs, M.trackers);
    for (const t of M.trackers) {
      for (const f of ["max", "start"]) {
        const v = t[f];
        if (typeof v !== "string" || !v.trim().startsWith("=")) continue;
        const expr = v.replace(/^=\s*/, "").trim();
        if (!expr) { out.push(`Tracker "${t.key || "?"}" ${f} formula is empty`); continue; }
        try { evalFormula(expr, scope); }
        catch (e) { out.push(`Tracker "${t.key || "?"}" ${f}: bad formula (${expr})`); }
      }
    }
    const npcScope = sampleFormulaScope(M.stats.defs, M.npcTrackers);
    for (const t of (M.npcTrackers || [])) {
      for (const f of ["max", "start"]) {
        const v = t[f];
        if (typeof v !== "string" || !v.trim().startsWith("=")) continue;
        const expr = v.replace(/^=\s*/, "").trim();
        if (!expr) { out.push(`NPC tracker "${t.key || "?"}" ${f} formula is empty`); continue; }
        try { evalFormula(expr, npcScope); }
        catch (e) { out.push(`NPC tracker "${t.key || "?"}" ${f}: bad formula (${expr})`); }
      }
    }
    return out;
  };
  const statModErrors = () => {
    const out = [];
    if (!M.stats.useStatModFormula) return out;
    const expr = String(M.stats.statModFormula || "").trim();
    if (!expr) return out; // empty is allowed — the built-in modifier is used
    try {
      const r = evalFormula(expr, statModScope(M.stats));
      if (typeof r !== "number" || !Number.isFinite(r)) out.push("Skill-check formula must produce a number.");
    } catch (e) {
      out.push(`Skill-check formula: bad formula (${expr})`);
    }
    return out;
  };
  // Tags the author typed — the special markers never live here: the adult rating is the
  // `meta.nsfw` boolean and fork provenance is the `meta.remix` record (see world.js).
  const userTags = () => M.meta.tags;
  const nsfwOn = () => M.meta.nsfw === true;
  // Turn the adult rating on/off — it's the `meta.nsfw` boolean (the world file's source of truth).
  const setNsfw = (on) => {
    if (on === nsfwOn()) return;
    M.meta.nsfw = !!on;
    markTouched();
  };
  // Comments on/off — same shape, opposite default: the switch reads ON while
  // comments are enabled (`meta.commentsOff` false/missing), flipping it off.
  const commentsOn = () => M.meta.commentsOff !== true;
  const setComments = (on) => {
    if (on === commentsOn()) return;
    M.meta.commentsOff = !on;
    markTouched();
  };
  // Paint a shared `.ui-sw` pill switch (class + a11y state) to match the model. Its label/title are
  // static markup; only the on/off state is dynamic.
  const paintSwitch = (btn, on) => {
    if (!btn) return;
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-checked", String(on));
  };
  // Tracker-key lookups shared by the Images scene settings and the Stats referee settings.
  const edTrkKeys = () => (M.trackers || []).map((t) => t && t.key).filter(Boolean);
  const edNtrkKeys = () => (M.npcTrackers || []).map((t) => t && t.key).filter(Boolean);
  const edTrkLabel = (k) => { const t = (M.trackers || []).find((x) => x && x.key === k); const l = (t && String(t.label || "").trim()) || k; const ic = t && String(t.icon || "").trim(); return (ic ? ic + " " : "") + l; };
  const edNtrkLabel = (k) => { const t = (M.npcTrackers || []).find((x) => x && x.key === k); const l = (t && String(t.label || "").trim()) || k; const ic = t && String(t.icon || "").trim(); return (ic ? ic + " " : "") + l; };
  // Shared tracker-key picker: an "All" chip plus one chip per defined tracker key (label +
  // icon). Empty list = all, the default, so existing worlds read as all when enabled. Each
  // picker sits below its toggle and only shows while it is on. In All mode every chip
  // highlights; clicking one excludes just it, clicking again re-includes it. Clicking an
  // active All clears every highlight as a visual reset (stored list stays empty) so the next
  // pick starts a fresh subset. Selecting every key collapses back to All; clearing the last
  // key returns to All too (turn the toggle off for none).
  // o: { known(), get(), set(list), labelOf(k), emptyHint } — set() must markTouched itself.
  const createKeyPicker = (pickEl, o) => {
    let cleared = false; // transient visual reset (active All clicked): highlights cleared, data untouched
    const paint = () => {
      if (!pickEl) return;
      const known = o.known();
      const clean = (o.get() || []).filter((k) => known.includes(k));
      if (!known.length) { pickEl.innerHTML = `<span class="dim">${o.emptyHint}</span>`; return; }
      const allOn = !clean.length && !cleared;
      pickEl.innerHTML = `<button type="button" class="ce-tsug-chip${allOn ? " on" : ""}" data-k="">All</button>` +
        known.map((k) => `<button type="button" class="ce-tsug-chip${allOn || clean.includes(k) ? " on" : ""}" data-k="${esc(k)}" title="${esc(k)}">${esc(o.labelOf(k))}</button>`).join("");
      pickEl.querySelectorAll("[data-k]").forEach((b) => {
        b.onclick = () => toggle(b.dataset.k, known, clean);
      });
    };
    const commit = (sel) => {
      if (JSON.stringify(sel) !== JSON.stringify(o.get() || [])) o.set(sel);
      paint();
    };
    const toggle = (k, known, clean) => {
      if (!k && !clean.length && !cleared) { cleared = true; paint(); return; }
      const wasCleared = cleared;
      cleared = false;
      if (!k) { commit([]); return; }
      if (wasCleared) { commit([k]); return; }
      let sel;
      if (!clean.length) sel = known.filter((x) => x !== k);
      else if (clean.includes(k)) sel = clean.filter((x) => x !== k);
      else sel = [...clean, k];
      if (!sel.length || (known.length && sel.length === known.length)) sel = [];
      commit(sel);
    };
    return { paint };
  };
  const tagErrors = () => {
    const out = [];
    const n = userTags().length;
    if (n > MAX_WORLD_TAGS) out.push(`Too many tags (${n}) — the maximum is ${MAX_WORLD_TAGS}.`);
    return out;
  };
  const validateAll = () => [...dupErrors(), ...trackerKeyErrors(), ...numFieldErrors(), ...formulaErrors(), ...statModErrors(), ...tagErrors()];

  /* ---------- Basics ---------- */
  function renderBasics() {
    const v = $v("basics");
    v.innerHTML = `
      <div class="ce-sec"><span>basic world info</span></div>
      <div class="ce-fld"><span class="ce-lab">name <span class="ce-note" id="ceNameCount"></span></span><input id="ceName" value="${esc(M.meta.name)}" placeholder="Display name"></div>
      <div class="ce-fld"><span class="ce-lab">description <span class="ce-note" id="ceDescCount"></span></span><textarea id="ceDesc" rows="3" placeholder="Public description shown on the library card. Describe your world and the player’s role in it."></textarea></div>
      <div class="ce-fld"><span>cover image <span class="ce-note">(shown on the library card — optional)</span></span>
        <div class="ce-cover">
          <div class="ce-cover-prev" id="ceCoverPrev"></div>
          <div class="ce-cover-side">
            <input id="ceCoverUrl" placeholder="Paste an image URL, or generate one below…">
            <div class="ce-cover-btns">
              <button type="button" class="mini" id="ceCoverSet">Use URL</button>
              <button type="button" class="mini" id="ceCoverUp">⬆ Upload</button>
              <button type="button" class="mini ok" id="ceCoverGen">🌟 Studio</button>
              <button type="button" class="mini warn" id="ceCoverClear" hidden>✖ Remove</button>
            </div>
          </div>
        </div>
      </div>
      <div class="ce-fld"><span>author&rsquo;s notes</span>
        <textarea id="ceNotes" rows="3" placeholder="Optional notes you want to tell about this world."></textarea>
      </div>
      <div class="ce-fld"><span>public comments</span>
        <button type="button" class="ui-sw" id="ceComments" role="switch" aria-checked="false" title="Let readers comment on this world (off hides the Comments tab everywhere)"><span class="sw-track"><span class="sw-knob"></span></span><span class="sw-text">Enable</span></button>
      </div>
      <hr class="ce-hr">
      <div class="ce-rate-tags">
        <div class="ce-fld ce-rate"><span>content rating</span>
          <button type="button" class="ui-sw sw-danger" id="ceNsfw" role="switch" aria-checked="false" title="Mark this world as adult content"><span class="sw-track"><span class="sw-knob"></span></span><span class="sw-text">⊘ NSFW</span></button>
        </div>
      </div>
      <div class="ce-note ce-sec-note">Be mindful of others — rate and tag your world properly, so players can find what they want and steer clear of what they don't.</div>
      <div class="ce-fld ce-tags"><span>tags <span class="ce-note" id="ceTagCount"></span></span>
        <div id="ceChips"></div>
      </div>
      <div class="ce-tsug" id="ceTagSug"></div>`;
    v.querySelector("#ceDesc").value = M.meta.description || "";
   const nameCount = v.querySelector("#ceNameCount");
    // Byte counters (not char counters): the catalog slot holds UTF-8 bytes (80/800), so an
    // emoji-heavy name/description must read against bytes to match what publishing stores.
    const paintNameCount = () => { nameCount.textContent = `${utf8ByteLen(String(M.meta.name || "").trim())} / 80 bytes`; };
    v.querySelector("#ceName").oninput = (e) => { M.meta.name = e.target.value; paintNameCount(); paintWorldLine(); markTouched(); };
    paintNameCount();
    const descCount = v.querySelector("#ceDescCount");
    const paintDescCount = () => { const n = utf8ByteLen(String(M.meta.description || "").trim()); descCount.textContent = `${n} / 800 bytes`; };
    v.querySelector("#ceDesc").oninput = (e) => { M.meta.description = e.target.value; paintDescCount(); markTouched(); };
    paintDescCount();
    renderChips(v);
    v.querySelector("#ceNsfw").onclick = () => { setNsfw(!nsfwOn()); renderChips(v); };
    const cmtBox = v.querySelector("#ceComments");
    if (cmtBox) {
      cmtBox.onclick = () => { setComments(!commentsOn()); paintSwitch(cmtBox, commentsOn()); };
      paintSwitch(cmtBox, commentsOn());
    }
    renderCover(v);
    renderNotes(v);
  }
function renderCover(v) {
    const prev = v.querySelector("#ceCoverPrev");
    const urlInp = v.querySelector("#ceCoverUrl");
    const setBtn = v.querySelector("#ceCoverSet");
    const studioBtn = v.querySelector("#ceCoverGen");
    const clearBtn = v.querySelector("#ceCoverClear");
    const show = (c) => { prev.innerHTML = c ? `<img src="${esc(c)}" alt="cover">` : `<span class="ce-cover-ph">🖼</span>`; };
    const apply = (c) => { M.meta.cover = c ? String(c).trim() : ""; markTouched(); show(M.meta.cover); clearBtn.hidden = !M.meta.cover; };
    show(M.meta.cover);
    clearBtn.hidden = !M.meta.cover;
    urlInp.value = M.meta.cover && !/^data:/.test(M.meta.cover) ? M.meta.cover : "";
    setBtn.onclick = () => apply(urlInp.value);
    clearBtn.onclick = () => { apply(""); urlInp.value = ""; };
    const upBtn = v.querySelector("#ceCoverUp");
    upBtn.onclick = async () => {
      const file = await pickImageFile();
      if (!file) return;
      upBtn.disabled = true;
      upBtn.textContent = "⬆ Uploading…";
      try {
        const url = await fileToAvatarDataUrl(file, { maxDim: COVER_MAX_DIM, quality: COVER_WEBP_QUALITY, mime: COVER_MIME });
        apply(url);
        urlInp.value = "";
        notify("🖼 Cover uploaded.");
      } catch (err) {
        notify("⚠ " + (err && err.message ? err.message : "Couldn't read that file."), { ms: 4200 });
      } finally {
        upBtn.disabled = false;
        upBtn.textContent = "⬆ Upload";
      }
    };
    studioBtn.onclick = () => {
      openCoverStudio({
        title: M.meta.name, description: M.meta.description, tags: M.meta.tags,
        vibe: M.narrativeVibe, scenario: M.scenario,
        styleTags: M.imageStyleTags, negTags: M.imageNegativeTags,
        initialCover: M.meta.cover, notify, ConfirmPopup,
        onUse: (url) => { apply(url); urlInp.value = ""; notify("🌟 Cover applied."); }
      });
    };
  }
  // Author's notes (unlimited Markdown) is a plain local draft, always editable in place —
  // publishing uploads it but never rewrites the field.
  function renderNotes(v) {
    const area = v.querySelector("#ceNotes");
    area.value = String(M.meta.authorNotes == null ? "" : M.meta.authorNotes);
    area.oninput = (e) => { M.meta.authorNotes = e.target.value; markTouched(); };
  }
  // The `tags` field is the shared tag control (chip-input.js). The editor supplies the rules the
  // control doesn't know about: the reserved markers typed as tags are refused (see `commit`), and
  // the `/20` counter and the NSFW switch are repainted whenever the chips change (`onSync`).
  let tagInput = null;
  function renderChips(v) {
    const old = v.querySelector("#ceChips");
    const countEl = v.querySelector("#ceTagCount");
    const nsfwBox = v.querySelector("#ceNsfw");
    const syncHint = () => {
      if (countEl) countEl.textContent = `${userTags().length}/${MAX_WORLD_TAGS}`;
      paintSwitch(nsfwBox, nsfwOn());
    };
    // Add one author tag, refusing anything the field can't hold. Shared by the chip input's `commit`
    // (typing) and the suggestion pick-list (clicking), so both obey the same rules — a reserved
    // marker never becomes a chip, and the cap still applies.
    const commitTag = (t) => {
      // "nsfw" belongs to the rating toggle (flip it); "remix" is provenance, written by the community
      // Remix flow rather than typed, so it is simply refused.
      if (isNsfwTag(t)) { setNsfw(true); return false; }
      if (isRemixTag(t)) return false;
      if (M.meta.tags.includes(t)) return false;
      if (M.meta.tags.length >= MAX_WORLD_TAGS) return false;
      M.meta.tags.push(t);
      return true;
    };
    // The common-tag pick-list under the field. Re-rendered from the model on every change, so a chip
    // the world now wears shows as selected (and disabled). Clicking runs the same commit path as
    // typing. The facets only fix the ORDER (genre → setting → theme); the chips render as one flat
    // flow, so there is no per-group label or break in the row.
    const renderTagSuggestions = () => {
      const box = v.querySelector("#ceTagSug");
      if (!box) return;
      const has = (t) => userTags().some((x) => String(x).toLowerCase() === t.toLowerCase());
      const tags = TAG_SUGGESTIONS.flatMap((g) => g.tags);
      box.innerHTML = tags.map((t) => {
        const on = has(t);
        return `<button type="button" class="ce-tsug-chip${on ? " on" : ""}" data-tag="${esc(t)}"${on ? " disabled" : ""} title="${on ? "Already tagged" : "Add this tag"}">${esc(t)}</button>`;
      }).join("");
      box.querySelectorAll(".ce-tsug-chip").forEach((b) => {
        b.onclick = () => {
          const added = commitTag(b.dataset.tag);
          if (added) { markTouched(); tagInput.repaint(); tagInput.sync(); }
          else if (!isNsfwTag(b.dataset.tag) && M.meta.tags.length >= MAX_WORLD_TAGS) {
            tagInput.setPlaceholder(`max ${MAX_WORLD_TAGS} tags — remove one to add another`, 2600);
          }
          syncHint();
          renderTagSuggestions();
        };
      });
    };
    tagInput = createChipInput({
      id: "ceChips",
      list: userTags,
      max: MAX_WORLD_TAGS,
      placeholder: "type a tag, Enter to add",
      fullText: `max ${MAX_WORLD_TAGS} tags — remove one to add another`,
      removeTitle: "Remove tag",
      commit: commitTag,
      // Drop the last author tag (never a reserved marker, which is filtered out on load anyway).
      remove: (t) => {
        for (let i = M.meta.tags.length - 1; i >= 0; i--) {
          if (M.meta.tags[i] === t && !isReservedTag(M.meta.tags[i])) { M.meta.tags.splice(i, 1); break; }
        }
      },
      onChange: markTouched,
      // A typed/removed tag repaints the counter, the switch AND the pick-list's selected state.
      onSync: () => { syncHint(); renderTagSuggestions(); },
      onRefuse: (t) => {
        if (isNsfwTag(t)) syncHint();
        else if (isRemixTag(t) && tagInput) tagInput.setPlaceholder("remix is added automatically to remixed worlds", 2600);
      }
    });
    old.replaceWith(tagInput.el);
    syncHint();
    renderTagSuggestions();
  }

  /* ---------- Story ---------- */
  function renderStory() {
    const v = $v("story");
    v.innerHTML = `
      <div class="ce-sec"><span>world story</span></div>
      <div class="ce-fld"><span>narrative vibe <span class="ce-note">(the GM's tone — how the story is told)</span></span><textarea id="ceVibe" rows="2" placeholder="e.g. funny, adventure, exploration."></textarea></div>
      <div class="ce-fld"><span>scenario <span class="ce-note">(permanent premise, injected into every reply; {{user}} = hero's name)</span></span><textarea id="ceScen" rows="6" placeholder="The world's standing premise — what is always true of this story."></textarea></div>
      <div class="ce-fld"><span>start <span class="ce-note">(opening for the first ~20 turns; {{user}} = hero's name)</span></span><textarea id="ceStart" rows="9" placeholder="How the adventure begins."></textarea></div>`;
    v.querySelector("#ceVibe").value = M.narrativeVibe || "";
    v.querySelector("#ceScen").value = M.scenario || "";
    v.querySelector("#ceStart").value = M.start || "";
    v.querySelector("#ceVibe").oninput = (e) => { M.narrativeVibe = e.target.value; markTouched(); };
    v.querySelector("#ceScen").oninput = (e) => { M.scenario = e.target.value; markTouched(); };
    v.querySelector("#ceStart").oninput = (e) => { M.start = e.target.value; markTouched(); };
  }

  /* ---------- shared: master/detail splits (Lorebook · NPC · Stats · Trackers · NPC trackers) ---- */
  // The pane's way back to the list (mobile drill-down only — see `.ce-split-back` in styles.css). A
  // drawn chevron rather than a `←`/`‹` character: at 13px the glyphs read as punctuation, and the SVG
  // keeps a clean stroke at any zoom. Mirrors the `›` the list rows already wear.
  const BACK_CHEV = ICON_BACK_CHEV;
  // Those five tabs are all the same shape: a scrollable list of items beside the selected item's
  // editor. On narrow viewports (the 640px breakpoint the CSS uses) the split becomes a one-pane
  // drill-down — tapping a row opens its editor and a compact `‹ Back` pill returns to the list.
  // A tab supplies only its row/editor markup and wiring; this controller owns the selection, the
  // mobile pane swap, the list scroll position, the move/delete/back chrome and the empty state.
  function createSplit(view, part) {
    let spec = null;
    // `scroll` is the list's own offset (desktop, where the list is its own scroll box); `bodyScroll`
    // is the panel body's offset while the mobile list was on screen (mobile has no nested scroll —
    // the body is the only scroller — so entering the editor starts it at the top and Back
    // returns the list to where it was).
    const state = { sel: 0, editing: false, scroll: 0, bodyScroll: 0 };
    let wasEditing = false;
    let suppressClick = false;
    const q = (s) => overlay.querySelector(`[data-view="${view}"] ${s}`);
    const listEl = () => q(`[data-part="${part}-list"]`);
    const editEl = () => q(`[data-part="${part}-edit"]`);
    const items = () => (spec && spec.items ? spec.items() : []);
    const isMobile = () => window.matchMedia("(max-width: 640px)").matches;
    // One list row: a full-width button (the tab supplies its contents) carrying the tab's row
    // class/colour and the selected state. The grip span is a drag handle (see startRowDrag) —
    // absolutely positioned, so it never disturbs the tab's own row layout.
    const rowHtml = (it, i) => {
      const a = (spec.rowAttrs && spec.rowAttrs(it, i, state)) || {};
      return `<button type="button" data-rowi="${i}" class="ce-split-item${a.cls ? " " + a.cls : ""}${i === state.sel ? " on" : ""}"` +
        `${a.hue ? ` style="--lt:${safeColor(a.hue)}"` : ""}><span class="ce-drag" title="Drag to reorder">⠿</span>${spec.row(it, i, state)}</button>`;
    };
    const wireRow = (b) => {
      b.onclick = () => { if (suppressClick) return; pick(+b.dataset.rowi); };
      const grip = b.querySelector(":scope > .ce-drag");
      if (grip) grip.onpointerdown = (e) => startRowDrag(e, b);
    };
    function pick(i) {
      if (isMobile()) { state.sel = i; state.editing = true; render(); return; } // tap → open its editor
      if (i === state.sel) return;
      state.sel = i;
      render();
    }
    // Rebuild just one row: the list follows the editor keystroke by keystroke without tearing down
    // the focused input.
    function paintRow(i) {
      const list = listEl();
      const btn = list && list.querySelector(`[data-rowi="${i}"]`);
      if (!btn || !spec) return;
      btn.outerHTML = rowHtml(items()[i], i);
      wireRow(list.querySelector(`[data-rowi="${i}"]`));
    }
    // Rows tied to validation (duplicate keys/names) are flagged by class, so the list can be marked
    // up without a re-render.
    function markRows(fn) {
      const list = listEl();
      if (list) list.querySelectorAll("[data-rowi]").forEach((b) => fn(b, +b.dataset.rowi));
    }
    // Commit a drag-and-drop reorder: `to` is the insertion index in the post-removal array
    // (see startRowDrag), so no index arithmetic is needed here — just splice, follow the
    // selection, and let the tab persist + repaint through afterReorder.
    function doReorder(from, to) {
      const arr = items();
      if (from < 0 || from >= arr.length || to < 0 || to > arr.length || from === to) return;
      const [it] = arr.splice(from, 1);
      arr.splice(to, 0, it);
      if (state.sel === from) state.sel = to;
      else if (from < state.sel && state.sel <= to) state.sel--;
      else if (to <= state.sel && state.sel < from) state.sel++;
      if (spec.afterReorder) spec.afterReorder();
    }
    // Drag-and-drop reordering through Pointer Events (one path for mouse, touch and pen — the
    // grip wears `touch-action: none`, so a press on it always means "drag", while presses
    // elsewhere still scroll the list / select the row). A short move threshold keeps plain
    // clicks selecting; past it the row dims and an insertion line tracks the pointer. The drop
    // position counts non-dragged rows above the pointer, which is exactly the post-removal
    // insertion index doReorder wants.
    function startRowDrag(e, rowBtn) {
      if (e.button !== undefined && e.button !== 0) return;
      const from = +rowBtn.dataset.rowi;
      const list = listEl();
      if (!list) return;
      const startY = e.clientY;
      let active = false, target = -1, line = null;
      const rowsBelow = (y) => {
        const rows = [...list.querySelectorAll("[data-rowi]")].filter((r) => r !== rowBtn);
        for (let p = 0; p < rows.length; p++) {
          const rb = rows[p].getBoundingClientRect();
          if (y < rb.top + rb.height / 2) return { p, el: rows[p] };
        }
        return { p: rows.length, el: null };
      };
      const cleanup = () => {
        rowBtn.classList.remove("dragging");
        if (line) { line.remove(); line = null; }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      const onMove = (ev) => {
        if (!active) {
          if (Math.abs(ev.clientY - startY) < 6) return;
          active = true;
          rowBtn.classList.add("dragging");
          line = document.createElement("div");
          line.className = "ce-drop-line";
        }
        const lr = list.getBoundingClientRect();
        if (ev.clientY < lr.top + 44) list.scrollTop -= 12;
        else if (ev.clientY > lr.bottom - 44) list.scrollTop += 12;
        const { p, el } = rowsBelow(ev.clientY);
        target = p;
        if (el) list.insertBefore(line, el);
        else list.appendChild(line);
      };
      const onUp = () => {
        const t = target, wasActive = active;
        cleanup();
        if (wasActive) {
          // Swallow the browser's post-drag click on the row (it would re-pick the dragged
          // row), then release — a plain timeout works because that click, if it fires at
          // all, dispatches synchronously right after pointerup, before any timer.
          suppressClick = true;
          setTimeout(() => { suppressClick = false; }, 0);
          if (t >= 0) doReorder(from, t);
        }
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    }
    function render(next) {
      if (next) spec = next;
      if (!spec) return;
      const split = q(`[data-part="${part}"]`), list = listEl(), edit = editEl();
      if (!split || !list || !edit) return;
      const arr = items();
      const n = arr.length;
      split.hidden = !n;
      const empty = q(".ce-split-empty");
      if (empty) empty.hidden = !!n;
      if (!n) return;
      if (state.sel >= n) state.sel = n - 1;
      if (state.sel < 0) state.sel = 0;
      const mobile = isMobile();
      if (mobile && state.editing !== wasEditing) {
        const body = edit.closest(".ce-body");
        if (body) {
          if (state.editing) { state.bodyScroll = body.scrollTop; body.scrollTop = 0; }
          else body.scrollTop = state.bodyScroll;
        }
      }
      wasEditing = state.editing;
      split.classList.toggle("editing", state.editing);
      list.innerHTML = (spec.listHead ? spec.listHead(arr, state) : "") + arr.map(rowHtml).join("");
      list.querySelectorAll("[data-rowi]").forEach(wireRow);
      list.onscroll = () => { state.scroll = list.scrollTop; };
      // Keep the list where the user left it, nudging the selected row into view when it's off-screen.
      // Desktop only: on mobile the list is not a scroll box at all (see the `@media` block), and the
      // body's offset is handled above.
      if (!mobile) {
        list.scrollTop = state.scroll;
        const selBtn = list.querySelector(".on");
        if (selBtn) {
          const lb = list.getBoundingClientRect(), sb = selBtn.getBoundingClientRect();
          if (sb.top < lb.top) list.scrollTop += sb.top - lb.top - 6;
          else if (sb.bottom > lb.bottom) list.scrollTop += sb.bottom - lb.bottom + 6;
        }
      }
      edit.innerHTML =
        `<div class="ce-track ce-split-entry">` +
          `<button type="button" class="mini ce-split-back">${BACK_CHEV} Back</button>` +
          `<div class="ce-track-top"><span class="ce-split-pos dim">${esc(spec.posLabel(arr[state.sel], state.sel, n))}</span>` +
            `<span class="ce-acts"><button class="mini ce-mv" data-d="-1" title="Move up">▲</button>` +
            `<button class="mini ce-mv" data-d="1" title="Move down">▼</button>` +
            `<button class="mini warn ce-del" title="${esc(spec.delTitle || "Remove")}">✕</button></span></div>` +
          spec.edit(arr[state.sel], state.sel, state) +
        `</div>`;
      if (spec.wireEdit) spec.wireEdit(edit, state.sel, state);
      edit.querySelectorAll(".ce-mv").forEach((b) => (b.onclick = () => {
        const d = +b.dataset.d, from = state.sel, to = from + d;
        if (to < 0 || to >= items().length) return;
        state.sel = to;
        spec.move(d, from);
      }));
      edit.querySelector(".ce-del").onclick = async () => {
        if (spec.confirmDelete && !(await spec.confirmDelete(items()[state.sel]))) return;
        spec.remove(state.sel);
      };
      edit.querySelector(".ce-split-back").onclick = () => { state.editing = false; render(); };
    }
    return { state, render, paintRow, markRows };
  }
  // Deleting something that still holds content asks first; a brand-new blank row (nothing typed in
  // it yet) just goes. ConfirmPopup renders its message as plain text, so no markup belongs in it.
  async function confirmDeleteItem({ blank, title, message }) {
    if (blank || !ConfirmPopup) return true;
    return ConfirmPopup.open({ title, message, confirmText: "Delete", danger: true });
  }
  // Shared inner markup of a list row: a title line, a badge line, and the badges themselves.
  const siTitle = (t, blank) => `<span class="ce-si-t${blank ? " dim" : ""}">${esc(t)}</span>`;
  const siMeta = (...bits) => `<span class="ce-si-m">${bits.filter(Boolean).join("")}</span>`;
  const siBadge = (t, cls) => (t === undefined || t === null || String(t) === "" ? "" : `<span class="ce-si-b${cls ? " " + cls : ""}">${esc(t)}</span>`);
  const siDup = () => `<span class="ce-si-b ce-si-dup">duplicate</span>`;

  /* ---------- Lorebook ---------- */
  // Each entry is { title, type, activation ("always"|"keywords"), keywords[], content }.
  const emptyLoreEntry = () => ({ title: "", type: "lore", activation: "keywords", keywords: [], content: "" });
  const loreSplit = createSplit("lorebook", "lore");
  function renderLorebook() {
    const v = $v("lorebook");
    v.innerHTML = `
      <div class="ce-sec ce-lore-head"><span>lorebook</span>
        <span class="ce-lore-toolbtns">
          <button class="mini ce-lore-ai" type="button">✨ Split text with AI</button>
          <button class="mini ce-lore-import" type="button">${ICON_IMPORT} Import</button>
          <button class="mini ce-lore-export" type="button">${ICON_EXPORT} Export</button>
          <button class="mini ok ce-add-lore">＋ Add entry</button>
        </span>
      </div>
      <div class="ce-note ce-sec-note">The world bible as small canon entries. <b>always</b> entries are fed to the GM every turn; <b>trigger words</b> entries are only fed when one of their words appears in the recent conversation. For main characters/NPCs in the story, add them in <b>NPC</b> tab instead.</div>
      <input type="file" id="ceLoreFile" accept="${LORE_EXTENSION},${WORLD_EXTENSION}" hidden>
      <div class="ce-lore-aiwrap" hidden>
        <div class="ce-fld"><span>raw text <span class="ce-note">(paste a whole lore dump — wiki text, notes, a setting bible… — and the AI will split it into proper entries)</span></span><textarea id="ceLoreRaw" rows="7" placeholder="Paste the lore text here…"></textarea></div>
        <div class="ce-lore-aibar">
          <button class="mini ok" id="ceLoreRun">✨ Split into entries</button>
          <span class="ce-lore-status"></span>
        </div>
      </div>
      <div class="ce-split" data-part="lore">
        <div class="ce-split-list" data-part="lore-list"></div>
        <div class="ce-split-edit" data-part="lore-edit"></div>
      </div>
      <div class="ce-split-empty dim" hidden>No lorebook entries yet — add one above, import a lorebook file, or let the AI split pasted text into entries.</div>`;
    v.querySelector(".ce-add-lore").onclick = () => {
      M.lorebook.push(emptyLoreEntry());
      loreSplit.state.sel = M.lorebook.length - 1;
      loreSplit.state.editing = true; // mobile drill-down: open the new entry's editor straight away
      markTouched();
      renderLoreList();
    };
    v.querySelector(".ce-lore-export").onclick = exportLorebook;
    v.querySelector(".ce-lore-import").onclick = () => v.querySelector("#ceLoreFile").click();
    v.querySelector("#ceLoreFile").onchange = (e) => importLorebookFile(e.target.files[0], e.target);
    const aiWrap = v.querySelector(".ce-lore-aiwrap");
    v.querySelector(".ce-lore-ai").onclick = () => { aiWrap.hidden = !aiWrap.hidden; if (!aiWrap.hidden) v.querySelector("#ceLoreRaw").focus(); };
    v.querySelector("#ceLoreRun").onclick = () => runLoreAi(v.querySelector("#ceLoreRaw").value, v.querySelector(".ce-lore-status"));
    renderLoreList();
  }
  // --- master/detail: the left column lists every entry, the right column edits ONE ---
  const loreTitleOf = (e) => (String((e && e.title) || "").trim() || "Untitled entry");
  // One left-column row: title + type/activation badges (the row is rebuilt on each edit, so the
  // list follows the editor live without tearing down the focused input).
  const loreRowInner = (e) => {
    const type = String((e && e.type) || "lore").toLowerCase();
    const keywords = !!e && e.activation === "keywords";
    const nKw = ((e && e.keywords) || []).length;
    return siTitle(loreTitleOf(e), !String((e && e.title) || "").trim()) +
      siMeta(
        siBadge(type, "acc"),
        siBadge(keywords ? "triggered" : "always", keywords ? "" : "al"),
        keywords && nKw ? siBadge(nKw + (nKw === 1 ? " word" : " words")) : ""
      );
  };
  // A per-type class on each row, so every lore type carries its own colour (see styles.css's lt-*
  // rules) and entries are easy to pick out at a glance; unknown/imported types fall back to "other".
  const loreTypeClass = (t) => "lt-" + (LORE_TYPES.includes(String(t || "").toLowerCase()) ? String(t).toLowerCase() : "other");
  // The right column: the fields for ONE entry (the split controller adds the back/move/delete chrome).
  function loreEditHtml(e, i) {
    const cur = (e.type || "lore").toLowerCase();
    // A value already outside the fixed vocabulary (legacy/imported) stays selectable so it is
    // never silently lost — choosing anything else replaces it.
    const typeOpts = LORE_TYPES.map((t) => `<option value="${t}"${t === cur ? " selected" : ""}>${t}</option>`).join("")
      + (LORE_TYPES.includes(cur) ? "" : `<option value="${esc(cur)}" selected>${esc(cur)}</option>`);
    return `<div class="ce-grid ce-lore-grid">
        <label class="ce-fld"><span>title</span><input data-f="title" value="${esc(e.title)}" placeholder="e.g. The Adventurer's Guild"></label>
        <label class="ce-fld"><span>type</span><select data-f="type" title="What kind of lore this entry is">${typeOpts}</select></label>
        <label class="ce-fld"><span>activation</span><select data-f="activation">${["always", "keywords"].map((a) => `<option value="${a}" ${a === e.activation ? "selected" : ""}>${a === "always" ? "always include" : "trigger words"}</option>`).join("")}</select></label>
      </div>
      <div class="ce-lore-kw"${e.activation === "keywords" ? "" : " hidden"}>
        <div class="ce-fld"><span>trigger words <span class="ce-note">(comma-separated — entry is fed when any appears in the last ${DEFAULT_TRIGGER_WINDOW_TURNS} turns of chat)</span></span>
          <div class="ce-kw-chips" data-kw-chips="${i}"></div>
        </div>
      </div>
      <label class="ce-fld ce-lore-content"><span>content <span class="ce-note">(the canon facts themselves — what the GM must know)</span></span><textarea data-f="content" rows="10" placeholder="What is canon about this entry — facts, rules, descriptions…">${esc(e.content)}</textarea></label>`;
  }
  // Wire the selected entry's controls. Field edits mutate in place and repaint the matching left
  // row; only add/delete/move (which change the list itself) re-render the whole list.
  function wireLoreEditor(editEl, sel) {
    const e = M.lorebook[sel];
    editEl.querySelectorAll("input[data-f], select[data-f], textarea[data-f]").forEach((inp) => {
      inp.oninput = () => {
        const f = inp.dataset.f;
        if (f === "activation") e.activation = inp.value;
        else if (f === "title") e.title = inp.value;
        else if (f === "type") e.type = inp.value.toLowerCase();
        else e.content = inp.value;
        markTouched();
        if (f === "activation") editEl.querySelector(".ce-lore-kw").hidden = inp.value !== "keywords";
        loreSplit.paintRow(sel);
      };
      if (inp.tagName === "SELECT") inp.onchange = inp.oninput;
    });
    // The trigger-word chips: built in JS so the input keeps focus while adding/removing words
    // (no full re-render on every commit).
    const wrap = editEl.querySelector(".ce-kw-chips");
    const entry = () => M.lorebook[sel];
    const box = createChipInput({
      list: () => (entry() && entry().keywords) || [],
      split: splitKeywords, // the field takes a comma-separated paste
      placeholder: "type a trigger word, Enter to add",
      removeTitle: "Remove trigger word",
      commit: (k) => { if (!entry()) return false; entry().keywords.push(k); return true; },
      remove: (k) => { if (!entry()) return; entry().keywords = entry().keywords.filter((w) => w !== k); },
      onChange: () => { markTouched(); loreSplit.paintRow(sel); }
    }).el;
    // Carry the hook over to the new element, so re-running this pass rebuilds the control in place
    // instead of finding nothing.
    box.classList.add("ce-kw-chips");
    box.dataset.kwChips = String(sel);
    wrap.replaceWith(box);
  }
  function renderLoreList() {
    loreSplit.render({
      items: () => M.lorebook,
      posLabel: (e, i, n) => `entry ${i + 1} / ${n}`,
      delTitle: "Remove entry",
      listHead: (arr) => {
        const always = arr.filter((e) => e.activation === "always").length;
        return `<div class="ce-split-count dim">${arr.length} entries — ${always} always · ${arr.length - always} triggered</div>`;
      },
      rowAttrs: (e) => ({ cls: loreTypeClass(e && e.type) }),
      row: (e) => loreRowInner(e),
      edit: (e, i) => loreEditHtml(e, i),
      wireEdit: (el, i) => wireLoreEditor(el, i),
      move: (d, i) => moveLore(d, i),
      afterReorder: () => { markTouched(); renderLoreList(); },
      remove: (i) => { M.lorebook.splice(i, 1); markTouched(); renderLoreList(); },
      confirmDelete: (e) => confirmDeleteItem({
        blank: !String(e.title || "").trim() && !String(e.content || "").trim() && !(e.keywords || []).length,
        title: "Delete entry",
        message: `Delete the lorebook entry${String(e.title || "").trim() ? ` "${String(e.title).trim()}"` : ""}? This cannot be undone.`
      })
    });
  }
  function moveLore(delta, i) {
    const j = i + delta;
    if (j < 0 || j >= M.lorebook.length) return;
    [M.lorebook[i], M.lorebook[j]] = [M.lorebook[j], M.lorebook[i]];
    markTouched();
    renderLoreList();
  }
  function loreFilename() {
    const name = (M.meta && M.meta.name) || "world";
    return String(name).replace(/[^a-z0-9]+/gi, "_") + LORE_EXTENSION;
  }
  function exportLorebook() {
    const payload = {
      format: LORE_FORMAT,
      entries: M.lorebook.map((e) => normalizeLoreEntry(e)).filter(Boolean)
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = loreFilename();
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
    if (notify) notify("Lorebook exported (" + payload.entries.length + " entries).");
  }
  // Parse an imported lorebook file into normalized entries.
  function parseLoreImport(text) {
    let obj = null;
    try { obj = JSON.parse(text); }
    catch (e) { throw new Error("Not valid JSON: " + e.message); }
    let raw = null;
    if (Array.isArray(obj)) raw = obj;
    else if (obj && Array.isArray(obj.entries)) raw = obj.entries;
    else if (obj && obj.lorebook !== undefined) raw = obj.lorebook;
    if (raw === null) throw new Error("Couldn't find a lorebook in that file (expected a JSON array of entries, a { entries: [...] } object, or a world file).");
    return { entries: normalizeLorebook(raw) };
  }
  function importLorebookFile(file, inputEl) {
    inputEl.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      let parsed;
      try { parsed = parseLoreImport(String(reader.result || "")); }
      catch (e) { if (notify) notify("Import failed: " + e.message, { ms: 5200 }); return; }
      if (!parsed.entries.length) { if (notify) notify("That file has no usable lorebook entries."); return; }
      const mode = await askLoreMerge(parsed.entries.length, M.lorebook.length);
      if (!mode) return; // cancelled
      if (mode === "replace") { M.lorebook = parsed.entries; loreSplit.state.sel = 0; }
      else { loreSplit.state.sel = M.lorebook.length; M.lorebook.push(...parsed.entries); }
      loreSplit.state.editing = true;
      markTouched();
      renderLorebook();
      if (notify) notify("Lorebook " + (mode === "replace" ? "replaced" : "updated") + " — " + parsed.entries.length + " entr" + (parsed.entries.length === 1 ? "y" : "ies") + " imported.");
    };
    reader.onerror = () => { if (notify) notify("Couldn't read that file."); };
    reader.readAsText(file);
  }
  // Reuse the .popup chrome: three-way choice for how imported entries should be merged.
  function askLoreMerge(imported, existing) {
    return new Promise((resolve) => {
      const pop = document.createElement("div");
      pop.className = "popup-overlay";
      pop.innerHTML = `
        <div class="popup">
          <div class="popup-head"><span class="popup-title">Import lorebook</span><button class="popup-x">✕</button></div>
          <div class="confirm-msg" style="padding: 14px;">${imported} entr${imported === 1 ? "y" : "ies"} found in the file${existing ? ` — your world already has ${existing}` : ""}. How should they be added?</div>
          <div class="popup-acts">
            <button class="mini popup-cancel">Cancel</button>
            <button class="mini popup-append">Append to current</button>
            <button class="mini warn popup-replace">Replace all</button>
          </div>
        </div>`;
      const release = pushBackClose(() => done(null));
      const done = (v) => { release(); pop.remove(); resolve(v); };
      pop.querySelector(".popup-x").onclick = () => done(null);
      pop.querySelector(".popup-cancel").onclick = () => done(null);
      pop.querySelector(".popup-append").onclick = () => done("append");
      pop.querySelector(".popup-replace").onclick = () => done("replace");
      pop.addEventListener("mousedown", (e) => { if (e.target === pop) done(null); });
      document.body.appendChild(pop);
      pop.querySelector(".popup-append").focus();
    });
  }
  // AI conversion: turn a pasted text dump into structured entries. The world's name + vibe + a
  // compact list of the book's existing SUBJECTS (titles only — bounded, so a big book can't blow
  // the prompt) form a fixed prefix; the raw text goes last, so successive parts of one paste share
  // that cached prefix. The caller splits long dumps into parts (see runLoreAi) and appends the
  // parsed rows to the book (the user reviews/edits before saving).
  function loreAiInstruction(rawChunk, existingTitles) {
    return [
      "You convert raw setting text into a structured lorebook for a text RPG world.",
      `World: ${(M.meta && M.meta.name) || "(unnamed)"}${M.narrativeVibe ? " — narrative vibe: " + M.narrativeVibe : ""}`,
      "Reply in MARKDOWN with one block per entry, in the order the subjects appear in the text. Each block looks like this:",
      "\"## {short title}\" on its own line, then \"type: {exactly one of: premise, world, location, character, faction, religion, magic, law, culture, history, event, item, creature, lore, other}\" on its own line, then \"keywords: {2-8 lowercase trigger words, comma-separated — proper nouns and topic words that mean this entry is relevant, e.g. guild, adventurer, quest, rank}\" on its own line, then the full canon facts in present tense on the following lines (any characters, quotes and line breaks allowed — no escaping needed). Leave one blank line between blocks. A whole-world fact like \"magic works this way\" is type world; a specific background fact is type lore; only use premise for the story's central standing premise. Keyword triggers are derived automatically for premise entries, so you may write \"keywords: -\" there.",
      "Split the text below into as many entries as its topics warrant — aim for one entry per distinct subject. Do NOT invent facts that aren't in the text, and do NOT merge distinct subjects into one entry. If the text names individual characters (people, generals, party members, creatures with names — even members named only in a list), create ONE character-type entry PER named character — never merge several named characters into one entry and never skip any. Prophecies, wars, artifacts and other named things each get their own entry too. Cover every subject in the text in order, omitting none. Condense wording but preserve all concrete facts (names, appearances, items, abilities, relationships, dialects, quoted wordings) — do not summarize detail away.",
      existingTitles ? "SUBJECTS ALREADY IN THE LOREBOOK — do NOT create entries for these; add only subjects not listed here:\n" + existingTitles : "",
      "RAW TEXT TO CONVERT (one part of a longer document; convert only this part):\n" + rawChunk,
      "Example reply (strictly this shape):\n## The Adventurer's Guild\ntype: faction\nkeywords: guild, adventurer, quest, rank\nThe guild issues ranked quests from its hall in the capital.\n\n## Lysandra\ntype: character\nkeywords: lysandra, lich, arch-lich\nLysandra is a gaunt arch-lich with a haunting voice.\n\nEND",
      "Reply with ONLY the entry blocks followed by a final line containing exactly END — no prose, no code fences, no JSON, nothing else."
    ].filter(Boolean).join("\n\n");
  }
  // The plugin exposes its real token counter + context window (a synchronous getMetaObject call), so
  // the splitter sizes each part against the actual budget instead of guessing. Falls back to a
  // ~3.8-chars/token estimate if the plugin can't answer.
  let loreTokenMetaCache = null;
  function loreTokenMeta() {
    if (!loreTokenMetaCache) {
      let meta = null;
      try { meta = window.genText && window.genText({ getMetaObject: true }); } catch (e) {}
      const count = meta && typeof meta.countTokens === "function"
        ? (t) => meta.countTokens(String(t == null ? "" : t))
        : (t) => Math.ceil(String(t == null ? "" : t).length / 3.8);
      const ideal = meta && Number.isFinite(meta.idealMaxContextTokens) ? meta.idealMaxContextTokens : 6000;
      loreTokenMetaCache = { count, ideal };
    }
    return loreTokenMetaCache;
  }
  // Tokens left free per call for the generated entries (the instruction block + one part + its reply
  // must fit the context window). The per-part input cap is deliberately small: each part's reply
  // must list EVERY subject in that part, so a big part outgrows the model's output limit and the
  // tail subjects (usually the characters at the end) are silently truncated away.
  const LORE_AI_OUTPUT_RESERVE = 2400;
  const LORE_AI_MAX_PARTS = 24;
  // Max SUBJECTS per AI call. Chunks are sized by input tokens, but the failure mode is OUTPUT
  // length: one call must emit an entry per subject, so a token-small but subject-dense part (the
  // 11-member harem list is a single paragraph!) blows the reply limit and the tail subjects die.
  const LORE_AI_MAX_SUBJECTS = 8;
  // A list item looks like "- ...", "* ...", or "1. ...". Two or more = a subject-dense piece.
  const LORE_BULLET_RE = /^[\s>]*(?:[-*•]|\d+[.)])\s+\S/;
  function countSubjects(piece) {
    const lines = String(piece).split(/\n/);
    let bullets = 0;
    for (const ln of lines) if (LORE_BULLET_RE.test(ln)) bullets++;
    if (bullets >= 2) return bullets;
    return Math.max(1, String(piece).split(/\n\s*\n/).filter((p) => p.trim()).length);
  }
  // Split a subject-dense piece (usually a list) into parts of at most cap subjects. Header
  // (non-bullet) lines ride on the first part; later parts get a one-line context note so the
  // model still types the members correctly.
  function splitBySubjects(piece, cap) {
    const lines = String(piece).split(/\n/);
    const header = [];
    const items = [];
    let cur = null;
    for (const ln of lines) {
      if (LORE_BULLET_RE.test(ln)) { if (cur) items.push(cur); cur = ln; }
      else if (cur) cur += "\n" + ln;
      else header.push(ln);
    }
    if (cur) items.push(cur);
    if (items.length <= cap) return [String(piece).trim()];
    const headText = header.join("\n").trim();
    const firstHead = headText ? headText.split(/\n/)[0].trim() : "";
    const out = [];
    for (let i = 0; i < items.length; i += cap) {
      const group = items.slice(i, i + cap).join("\n");
      if (!i) out.push((headText ? headText + "\n" : "") + group);
      else out.push((firstHead ? "(Continued list — " + firstHead + ".)\n" : "") + group);
    }
    return out;
  }
  // Cut a long paste into parts that each fit `budget` tokens. Splits on blank lines first (a topic
  // rarely straddles a paragraph), then sentences, then — for one monstrous sentence — characters.
  // Cut a long paste into parts that fit BOTH budgets: input tokens per part AND subjects
  // per part (see LORE_AI_MAX_SUBJECTS). Splits on blank lines first (a topic rarely straddles
  // a paragraph), then list items, then sentences, then — for one monstrous sentence — chars.
  function splitLoreText(text, budget) {
    const { count } = loreTokenMeta();
    const out = [];
    let cur = "";
    let curSubjects = 0;
    const flush = () => { const s = cur.trim(); if (s) out.push(s); cur = ""; curSubjects = 0; };
    const emitSmall = (p) => {
      const s = countSubjects(p);
      const cand = cur ? cur + "\n\n" + p : p;
      if (cur && (count(cand) > budget || curSubjects + s > LORE_AI_MAX_SUBJECTS)) flush();
      if (!cur) { cur = p; curSubjects = s; return; }
      cur = cand; curSubjects += s;
    };
    const addPiece = (piece) => {
      const p = piece.trim();
      if (!p) return;
      if (countSubjects(p) > LORE_AI_MAX_SUBJECTS) {
        flush();
        for (const part of splitBySubjects(p, LORE_AI_MAX_SUBJECTS)) addPiece(part);
        return;
      }
      if (count(p) > budget) {
        flush();
        const parts = splitOversized(p, budget, count);
        for (let i = 0; i < parts.length - 1; i++) out.push(parts[i]);
        cur = parts[parts.length - 1] || "";
        curSubjects = cur ? countSubjects(cur) : 0;
        return;
      }
      emitSmall(p);
    };
    for (const p of String(text).split(/\n\s*\n/)) addPiece(p);
    flush();
    return out.length ? out : [String(text).trim()];
  }
  // A same-subject key for de-duping: the normalized title, or (for untitled rows) the start of the
  // content. Used both against the book that already exists and within a single split run.
  const loreKey = (e) => {
    const t = String((e && e.title) || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (t) return "t:" + t;
    const c = String((e && e.content) || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    return c ? "c:" + c.slice(0, 120) : "";
  };
  // The AI never sees the other parts' output, so collapse same-subject duplicates here.
  function dedupeLoreEntries(entries, existing) {
    const seen = new Set();
    for (const e of existing || []) { const k = loreKey(e); if (k) seen.add(k); }
    const out = [];
    for (const e of entries || []) {
      const k = loreKey(e);
      if (k && seen.has(k)) continue;
      if (k) seen.add(k);
      out.push(e);
    }
    return out;
  }

  // The model sometimes emits slightly-off JSON (trailing/missing commas, unescaped newlines, a
  // stray sentence around or between entries, ...). Instead of failing on it we recover in stages:
  // strict parse of the bracketed array -> jsonrepair (vendored lib, tolerates the usual LLM JSON
  // artifacts) -> scan for balanced {...} objects and parse each. First stage that yields objects wins.
  const fenceBlocks = (t) => {
    const out = [];
    const re = /```[a-zA-Z]*\s*([\s\S]*?)```/g;
    let m;
    while ((m = re.exec(t))) out.push(m[1]);
    return out;
  };
  const sliceArray = (t) => {
    const s = t.indexOf("[");
    const e = t.lastIndexOf("]");
    return s >= 0 && e > s ? t.slice(s, e + 1) : null;
  };
  const balancedObjects = (t) => {
    const chunks = [];
    let i = 0;
    while (i < t.length) {
      const o = t.indexOf("{", i);
      if (o < 0) break;
      let depth = 0, inStr = false, esc = false, j = o;
      for (; j < t.length; j++) {
        const c = t[j];
        if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; }
        else if (c === '"') inStr = true;
        else if (c === "{") depth++;
        else if (c === "}") { depth--; if (!depth) { j++; break; } }
      }
      if (!depth && j > o) chunks.push(t.slice(o, j));
      i = j;
    }
    return chunks;
  };
  // Markdown reply parser: each entry is a "## {title}" header, optional "type:" /
  // "keywords:" lines, then free-form content until the next header. Free text needs no
  // escaping, so a quoted prophecy or an apostrophe can no longer poison the whole reply the
  // way one unescaped JSON quote could — and a reply cut off mid-list still yields every
  // complete entry before the cut instead of failing the entire array parse.
  function parseLoreMarkdown(text) {
    const out = [];
    let cur = null;
    const flush = () => {
      if (!cur) return;
      const content = cur.body.join("\n").trim();
      if (content) {
        let keywords = splitKeywords(cur.keywords.join(","));
        if (!keywords.length && cur.type !== "premise") {
          keywords = splitKeywords(cur.title);
          if (!keywords.length) keywords = splitKeywords(content.split(/\s+/).slice(0, 8).join(" "));
        }
        const e = normalizeLoreEntry({
          title: cur.title,
          type: cur.type,
          activation: cur.type === "premise" ? "always" : "keywords",
          keywords,
          content
        });
        if (e && e.content && e.content.trim()) out.push(e);
      }
      cur = null;
    };
    for (const rawLine of String(text || "").split(/\n/)) {
      const line = rawLine.replace(/\r$/, "");
      const head = line.match(/^##\s+(.{1,120}?)\s*$/);
      if (head) { flush(); cur = { title: head[1].replace(/\*\*/g, "").trim(), type: "lore", keywords: [], body: [] }; continue; }
      if (!cur) continue;
      const tm = line.match(/^\s*type\s*:\s*(.+?)\s*$/i);
      if (tm && !cur.body.length) {
        const ty = tm[1].trim().toLowerCase();
        cur.type = LORE_TYPES.includes(ty) ? ty : "lore";
        continue;
      }
      const km = line.match(/^\s*(keywords?|triggers?)\s*:\s*(.*?)\s*$/i);
      if (km && !cur.body.length) {
        if (!/^-+\s*$/.test(km[2])) cur.keywords.push(km[2]);
        continue;
      }
      const cm = line.match(/^\s*content\s*:\s*(.*?)\s*$/i);
      if (cm && !cur.body.length) { if (cm[1]) cur.body.push(cm[1]); continue; }
      if (/^\s*END\s*$/.test(line)) continue;
      cur.body.push(rawLine);
    }
    flush();
    return out;
  }
  // Entry point for splitter replies: markdown first (the current prompt format), legacy JSON
  // second (an older prompt's reply, or a model that answered in JSON anyway).
  async function extractLoreEntries(out) {
    const txt = String(out || "").trim();
    const noFence = txt.replace(/```[a-zA-Z]*\s*([\s\S]*?)```/g, "$1").trim();
    if (/^##\s+/m.test(noFence)) {
      const entries = parseLoreMarkdown(noFence);
      if (entries.length) return entries;
    }
    return extractLoreArray(txt);
  }
  async function extractLoreArray(out) {
    const t = String(out || "").trim();
    const cands = [...new Set([...fenceBlocks(t), t])];
    const tried = [];
    const repair = () => import("../vendor/jsonrepair.mjs").then((m) => m.jsonrepair);
    const parseOrRepair = async (s) => {
      try { return { v: JSON.parse(s) }; }
      catch (e) { tried.push(e.message); }
      try { const rep = await repair(); return { v: JSON.parse(rep(s)) }; }
      catch (e) { tried.push(e.message); }
      return null;
    };
    for (const c of cands) {
      const sliced = sliceArray(c);
      if (sliced) {
        const r = await parseOrRepair(sliced);
        if (r) return r.v;
      }
      const objs = [];
      for (const chunk of balancedObjects(c)) {
        const r = await parseOrRepair(chunk);
        if (r && typeof r.v === "object" && !Array.isArray(r.v)) objs.push(r.v);
      }
      if (objs.length) return objs;
    }
    const last = [...new Set(tried)].pop();
    throw new Error("The AI reply wasn't valid JSON" + (last ? " (" + last + ")" : "") + " — click Split again to retry, or convert a shorter chunk of text.");
  }
  async function runLoreAi(rawText, statusEl) {
    const g = window.genText;
    const setStatus = (msg, bad, html) => { if (html) statusEl.innerHTML = msg; else statusEl.textContent = msg || ""; statusEl.classList.toggle("bad", !!bad); };
    if (!rawText || !rawText.trim()) { setStatus("✋ Paste some text first.", true); return; }
    if (!g) { setStatus("✋ No text AI available.", true); return; }
    const btn = overlay.querySelector("#ceLoreRun");
    setBusy(btn, "Splitting…");
    try {
      // Size each call against the plugin's real context window: the fixed instruction block (schema
      // + the existing book's subject list) is charged once, the rest is left for one part of raw
      // text plus its generated entries. A long dump becomes several bounded calls instead of one
      // truncated, over-budget one.
      const { count, ideal } = loreTokenMeta();
      const existingTitles = lorebookTitleList(M.lorebook, { capChars: 2400 });
      const overhead = count(loreAiInstruction("", existingTitles));
      const budget = Math.max(600, Math.min(1500, ideal - overhead - LORE_AI_OUTPUT_RESERVE));
      const chunks = splitLoreText(rawText, budget);
      if (chunks.length > LORE_AI_MAX_PARTS) throw new Error(`That text is very long — it would take ${chunks.length} AI calls. Paste it in a few smaller batches instead.`);
      setStatus(`Splitting ${chunks.length} part${chunks.length === 1 ? "" : "s"} — this can take up to a minute per part…`);
      const collected = [];
      const failures = [];
      let truncated = 0;
      let retried = 0;
      const cutIdx = [];
      const runPart = async (chunkText) => {
        const res = await g({ instruction: loreAiInstruction(chunkText, existingTitles), route: "other" });
        const out = String((res && res.text) || res || "");
        const arr = await extractLoreEntries(out);
        if (!Array.isArray(arr)) throw new Error("reply wasn't an array");
        collected.push(...arr.map((e) => normalizeLoreEntry(e)).filter((e) => e && e.content && e.content.trim()));
        return !/^\s*END\s*$/m.test(out || "");
      };
      for (let i = 0; i < chunks.length; i++) {
        if (chunks.length > 1) setStatus(`Generating entries — part ${i + 1}/${chunks.length}…`);
        try {
          if (await runPart(chunks[i])) { truncated++; cutIdx.push(i); }
        } catch (err) {
          failures.push("part " + (i + 1) + ": " + (err && err.message ? err.message : "failed"));
        }
      }
      // One automatic retry: a cut-off part is halved and each half re-run (dedupe below absorbs
      // the overlap with the partial first attempt), so subjects lost to output truncation get a
      // second chance without the user re-splitting manually.
      for (const i of cutIdx) {
        const halves = splitLoreText(chunks[i], Math.max(400, Math.floor(count(chunks[i]) / 2)));
        if (halves.length < 2) continue;
        if (chunks.length + retried + halves.length > LORE_AI_MAX_PARTS) {
          failures.push("part " + (i + 1) + ": reply cut off, too long to retry — Split it manually in smaller batches");
          continue;
        }
        truncated--;
        for (const h of halves) {
          retried++;
          setStatus(`Re-running cut-off part ${i + 1} in smaller pieces…`);
          try {
            if (await runPart(h)) truncated++;
          } catch (err) {
            failures.push("part " + (i + 1) + " retry: " + (err && err.message ? err.message : "failed"));
          }
        }
      }
      const entries = dedupeLoreEntries(collected, M.lorebook);
      if (!entries.length) throw new Error(failures.length ? "No entries came back — " + failures.join("; ") : "no usable entries in the reply");
      loreSplit.state.sel = M.lorebook.length;
      loreSplit.state.editing = true;
      M.lorebook.push(...entries);
      markTouched();
      renderLorebook();
      const nv = $v("lorebook");
      const nWrap = nv.querySelector(".ce-lore-aiwrap");
      const nRaw = nv.querySelector("#ceLoreRaw");
      const nStatus = nv.querySelector(".ce-lore-status");
      if (nWrap) nWrap.hidden = false;
      if (nRaw) { nRaw.value = rawText; }
      const plural = entries.length === 1 ? "y" : "ies";
      let done = "✓ " + entries.length + " entr" + plural + " added below — review and edit before saving.";
      if (failures.length) done += " ⚠ " + failures.length + " part" + (failures.length === 1 ? "" : "s") + " failed (" + failures.join("; ") + ").";
      if (retried) done += " ↻ " + retried + " smaller re-run" + (retried === 1 ? "" : "s") + " after a cut-off reply.";
      if (truncated) done += " ⚠ " + truncated + " part" + (truncated === 1 ? "" : "s") + " still looked cut off — check the end of each part for missing subjects and Split those again.";
      if (nStatus) { nStatus.textContent = done; nStatus.classList.toggle("bad", !!(failures.length || truncated)); }
      if (notify) notify("✨ Lorebook split into " + entries.length + " entr" + plural + ".");
    } catch (err) {
      console.error("lore AI split failed:", err);
      setStatus("⚠ " + (err && err.message ? err.message : "The AI call failed."), true);
    } finally {
      clearBusy(btn);
    }
  }

  /* ---------- Images ---------- */
  /* Image style presets live in image-style-presets.js for easy editing. */

  // Fixed subject for the Images-tab style preview, so a world's art style can be judged on a
  // Style-preview subject: free text, preview-only (never saved). Pre-filled with the old fixed
  // subject so previews read the same until the author types their own. Mirrors the in-session
  // NPC portrait prompt (identity + appearance + the world's style tags) — but with no scene
  // backdrop, since the editor has no live scene.
  const PREVIEW_SUBJECT_DEFAULT = "Hero, male, human, 25 years old, warrior. full armor";
  const previewPortraitPrompt = (subject, styleTags) => {
    const s = String(subject || "").trim() || PREVIEW_SUBJECT_DEFAULT;
    return `Portrait of ${s}${styleTags ? `, (${styleTags})` : ""}.`;
  };

  function renderImages() {
    const v = $v("images");
    v.innerHTML = `
      <div class="ce-sec"><span>image style</span></div>
      <div class="ce-fld"><span>style template <span class="ce-note">(loads a preset into the style tags)</span></span><select id="ceTpl"></select></div>
      <div class="ce-fld"><span>image style tags <span class="ce-note">(appended to every scene-image generation, hidden from the player)</span></span><textarea id="ceStyle" rows="3" placeholder="e.g. (masterpiece:1.2), cinematic lighting, ..."></textarea></div>
      <div class="ce-fld"><span>image negative tags</span><textarea id="ceNeg" rows="1" placeholder="e.g. low quality, fused digits, ..."></textarea></div>
      <div class="ce-sec">style preview</div>
      <div class="ce-prev">
        <div class="ce-prev-img"><img id="cePrevImg" alt="Style preview"></div>
        <div class="ce-prev-side">
          <textarea id="cePrevSubject" rows="1" spellcheck="false" placeholder="Preview subject — who the portrait paints"></textarea>
          <div class="ce-note ce-prev-prompt" id="cePrevPrompt"></div>
          <div><button type="button" class="btn ok ce-prev-btn" id="cePrevBtn">🎨 Preview style</button></div>
        </div>
      </div>
      <div class="ce-sec"><span>scene-image settings</span></div>
      <div class="ce-note ce-sec-note">Results may vary — the image model interprets tracker values loosely. Recommended: pick only trackers that affect appearance in image.</div>
      <button type="button" class="ui-sw sw-plain" id="ceImgTrackers" role="switch" aria-checked="false" title="Append the last turn's hero tracker values to the hero's description in the scene image prompt"><span class="sw-track"><span class="sw-knob"></span></span><span class="sw-text">Include trackers</span></button>
      <span class="ce-key-pick" id="ceImgTrkPick"></span>
      <button type="button" class="ui-sw sw-plain" id="ceImgNpcTrackers" role="switch" aria-checked="false" title="Append each present character's NPC tracker values to their description in the scene image prompt"><span class="sw-track"><span class="sw-knob"></span></span><span class="sw-text">Include NPC trackers</span></button>
      <span class="ce-key-pick" id="ceImgNpcPick"></span>`;
    const styleEl = v.querySelector("#ceStyle");
    const negEl = v.querySelector("#ceNeg");
    const tplWrap = v.querySelector("#ceTpl");
    const prevImg = v.querySelector("#cePrevImg");
    const prevPrompt = v.querySelector("#cePrevPrompt");
    const prevBtn = v.querySelector("#cePrevBtn");
    const prevSubject = v.querySelector("#cePrevSubject");
    prevSubject.value = PREVIEW_SUBJECT_DEFAULT;
    const imgT = v.querySelector("#ceImgTrackers");
    const imgN = v.querySelector("#ceImgNpcTrackers");
    const imgTrkPick = createKeyPicker(v.querySelector("#ceImgTrkPick"), {
      known: edTrkKeys, get: () => M.imageTrackerKeys,
      set: (l) => { M.imageTrackerKeys = l; markTouched(); }, labelOf: edTrkLabel,
      emptyHint: "No trackers yet — add some in the Trackers tab."
    });
    const imgNpcPick = createKeyPicker(v.querySelector("#ceImgNpcPick"), {
      known: edNtrkKeys, get: () => M.imageNpcTrackerKeys,
      set: (l) => { M.imageNpcTrackerKeys = l; markTouched(); }, labelOf: edNtrkLabel,
      emptyHint: "No NPC trackers yet — add some in the NPC Trackers tab."
    });
    const syncPickVis = () => {
      v.querySelector("#ceImgTrkPick").hidden = !(M.imageIncludeTrackers === true);
      v.querySelector("#ceImgNpcPick").hidden = !(M.imageIncludeNpcTrackers === true);
    };
    paintSwitch(imgT, M.imageIncludeTrackers === true);
    paintSwitch(imgN, M.imageIncludeNpcTrackers === true);
    imgT.onclick = () => { M.imageIncludeTrackers = !(M.imageIncludeTrackers === true); paintSwitch(imgT, M.imageIncludeTrackers === true); syncPickVis(); markTouched(); };
    imgN.onclick = () => { M.imageIncludeNpcTrackers = !(M.imageIncludeNpcTrackers === true); paintSwitch(imgN, M.imageIncludeNpcTrackers === true); syncPickVis(); markTouched(); };
    imgTrkPick.paint();
    imgNpcPick.paint();
    syncPickVis();
    styleEl.value = M.imageStyleTags || "";
    negEl.value = M.imageNegativeTags || "";
    const curStyle = () => (M.imageStyleTags || "").trim();
    const updPreviewPrompt = () => { prevPrompt.textContent = previewPortraitPrompt(prevSubject.value, curStyle()); };
    prevSubject.oninput = updPreviewPrompt;
    prevImg.src = stylePreviewDataUrl || "src/images/portrait-placeholder.webp";
    updPreviewPrompt();
    prevBtn.onclick = async () => {
      if (!genImage) { if (notify) notify("⚠ No image AI available."); return; }
      setBusy(prevBtn, "Generating…");
      try {
        // genImageSafe times out (the plugin's promise never settles on failure) and throws on empty.
        const r = await genImageSafe(genImage, previewPortraitPrompt(prevSubject.value, curStyle()), { route: "portraits", resolution: "512x512", negativePrompt: (M.imageNegativeTags || "").trim(), guidanceScale: imageGuidance() });
        if (r && r.dataUrl) { stylePreviewDataUrl = r.dataUrl; prevImg.src = r.dataUrl; }
        else if (notify) notify("⚠ Couldn't generate the preview.");
      } catch (e) {
        console.error("Style preview generation failed:", e);
        if (notify) notify("⚠ Couldn't generate the preview.");
      } finally {
        clearBusy(prevBtn);
      }
    };
    const renderTpls = () => {
      const cur = curStyle();
      const idx = IMAGE_STYLE_TEMPLATES.findIndex((t) => t.text.trim() === cur);
      let html = idx < 0 ? `<option value="">Custom…</option>` : "";
      let openGroup = null;
      IMAGE_STYLE_TEMPLATES.forEach((t, i) => {
        const g = t.group || "Other";
        if (g !== openGroup) {
          if (openGroup !== null) html += `</optgroup>`;
          html += `<optgroup label="${esc(g)}">`;
          openGroup = g;
        }
        html += `<option value="${i}"${i === idx ? " selected" : ""} title="${esc(t.text)}">${esc(t.label)}</option>`;
      });
      if (openGroup !== null) html += `</optgroup>`;
      tplWrap.innerHTML = html;
    };
    tplWrap.onchange = () => {
      if (tplWrap.value === "") return;
      M.imageStyleTags = IMAGE_STYLE_TEMPLATES[+tplWrap.value].text;
      styleEl.value = M.imageStyleTags;
      markTouched();
      renderTpls();
      updPreviewPrompt();
    };
    renderTpls();
    styleEl.oninput = (e) => { M.imageStyleTags = e.target.value; markTouched(); renderTpls(); updPreviewPrompt(); };
    negEl.oninput = (e) => { M.imageNegativeTags = e.target.value; markTouched(); };
  }

  /* ---------- Stats ---------- */
  function renderStats() {
    const v = $v("stats");
    const s = M.stats;
    const numFlds = ({ key, label, hint }) => `<label class="ce-fld"><span>${label}</span><span class="ce-hint">${hint}</span><input type="number" data-sts="${key}" value="${esc(s[key])}"></label>`;
    v.innerHTML = `
      <div class="ce-sec ce-lore-head"><span>stat definitions</span>
        <span class="ce-lore-toolbtns">
          <button class="mini ce-stat-ai" type="button">✨ Generate</button>
          <button class="mini ce-stat-presets" type="button">📋 Presets</button>
          <button class="mini ok ce-add-stat">＋ Add stat</button>
        </span>
      </div>
      <div class="ce-lore-aiwrap" hidden>
        <div class="ce-fld"><span>describe the stat <span class="ce-note">(a name plus a line — what it measures, how the GM uses it…)</span></span><textarea id="ceStatRaw" rows="3" placeholder="e.g. Grit — willpower to push through pain and fear, used for endurance rolls…"></textarea></div>
        <div class="ce-lore-aibar">
          <button class="mini ok" id="ceStatRun">✨ Generate stat</button>
          <span class="ce-lore-status"></span>
        </div>
      </div>
      <div class="ce-note ce-sec-note">Stats are the hero's attributes. <b>key</b> is a unique lowercase id used for formulas (e.g. <code>str</code>). <b>rules</b> tells the GM how the stat is used in skill checks.</div>
      <div class="ce-split" data-part="stat">
        <div class="ce-split-list" data-part="stat-list"></div>
        <div class="ce-split-edit" data-part="stat-edit"></div>
      </div>
      <div class="ce-split-empty dim" hidden>No stats yet — add one above.</div>
      <div class="ce-sec"><span>settings</span></div>
      <div class="ce-grid ce-setgrid">${STAT_FIELDS.map(numFlds).join("")}</div>
      <div class="ce-sec"><span>advanced skill-check</span></div>
      <div class="ce-note ce-sec-note"><b>It's recommended to leave these OFF.</b> Each one will add into the token context window and make responses slower. <b>Include trackers</b> and <b>NPC trackers</b> feed the referee call (which decides whether to roll) the last turn's values. <b>Custom instruction</b> injects additional instructions to the referee call. <b>Custom formula</b> sets how a stat value becomes the +/− on the roll.</div>
      <button type="button" class="ui-sw sw-plain" id="ceRefTrackers" role="switch" aria-checked="false" title="Feed the last turn's tracker values to the skill-check referee"><span class="sw-track"><span class="sw-knob"></span></span><span class="sw-text">Include trackers</span></button>
      <span class="ce-key-pick" id="ceRefTrkPick"></span>
      <button type="button" class="ui-sw sw-plain" id="ceRefNpcTrackers" role="switch" aria-checked="false" title="Feed the last turn's NPC tracker values to the skill-check referee"><span class="sw-track"><span class="sw-knob"></span></span><span class="sw-text">Include NPC trackers</span></button>
      <span class="ce-key-pick" id="ceRefNpcPick"></span>
      <button type="button" class="ui-sw sw-plain" id="ceRefCustom" role="switch" aria-checked="false" title="Append your own instruction to the skill-check referee prompt"><span class="sw-track"><span class="sw-knob"></span></span><span class="sw-text">Use custom instruction</span></button>
      <div class="ce-fld" id="ceRefCustomWrap"><span>custom referee instruction</span><textarea id="ceRefCustomTa" rows="3" spellcheck="false" placeholder="e.g. Never call for a roll on social persuasion — always let it play out in dialogue."></textarea></div>
      <div class="ce-note" id="ceRefCustomNote">The custom instruction is appended <b>in addition to</b> the built-in rules — it never replaces them.</div>
      <button type="button" class="ui-sw sw-plain" id="ceUseModFormula" role="switch" aria-checked="false" title="Replace the built-in modifier with your own formula"><span class="sw-track"><span class="sw-knob"></span></span><span class="sw-text">Use custom formula</span></button>
      <div class="ce-modform" id="ceModFormulaWrap"${s.useStatModFormula ? "" : " hidden"}>
        <div class="ce-fld"><span>formula</span><textarea id="ceModFormula" rows="2" spellcheck="false" placeholder="${esc(DEFAULT_STAT_MOD_FORMULA)}"></textarea></div>
        <div class="ce-note ce-sec-note">Variables: <code>v</code> (the stat value), <code>avg</code>, <code>exc</code>, <code>step</code>. Supports <code>+ - * / %</code>, comparisons (<code>&lt; &lt;= &gt; &gt;= == !=</code>), logic (<code>&amp;&amp; || !</code>), the ternary <code>a ? b : c</code>, and <code>floor ceil round trunc sign abs min max pow sqrt</code>. The result is rounded to a whole modifier.</div>
        <div class="ce-note" id="ceModFormulaPrev"></div>
      </div>
      <div style="height:14px"></div>`;
    function updModPreview() {
      const el = v.querySelector("#ceModFormulaPrev");
      if (!el) return;
      const expr = String(s.statModFormula || "").trim();
      if (!s.useStatModFormula) { el.textContent = ""; el.classList.remove("bad"); return; }
      if (!expr) { el.textContent = "Preview: (empty — the built-in modifier is used)"; el.classList.remove("bad"); return; }
      const sc = statModScope(s);
      const step = Number(sc.step) || 0;
      const samples = [Math.max(0, Math.round(sc.avg - step)), sc.avg, sc.exc, Math.round(sc.exc + step)];
      const outs = [];
      const bad = () => { el.textContent = "⚠ Bad formula — the built-in modifier will be used."; el.classList.add("bad"); };
      for (const val of samples) {
        try {
          const r = evalFormula(expr, statModScope(s, val));
          if (typeof r !== "number" || !Number.isFinite(r)) { bad(); return; }
          outs.push(`${val} → ${r >= 0 ? "+" : ""}${Math.round(r)}`);
        } catch (e) {
          bad();
          return;
        }
      }
      el.classList.remove("bad");
      el.textContent = "Preview (stat → modifier): " + outs.join("  ·  ");
    }
    v.querySelectorAll("[data-sts]").forEach((inp) => {
      inp.oninput = () => {
        const k = inp.dataset.sts;
        M.stats[k] = toNum(inp.value);
        inp.classList.toggle("bad", inp.value.trim() !== "" && Number.isNaN(M.stats[k]));
        markTouched();
        updModPreview();
      };
    });
    const cb = v.querySelector("#ceUseModFormula");
    const ta = v.querySelector("#ceModFormula");
    const wrap = v.querySelector("#ceModFormulaWrap");
    paintSwitch(cb, !!s.useStatModFormula);
    ta.value = s.statModFormula || "";
    cb.onclick = () => { s.useStatModFormula = !s.useStatModFormula; paintSwitch(cb, s.useStatModFormula); wrap.hidden = !s.useStatModFormula; markTouched(); updModPreview(); };
    ta.oninput = () => { s.statModFormula = ta.value; markTouched(); updModPreview(); };
    const refT = v.querySelector("#ceRefTrackers");
    const refN = v.querySelector("#ceRefNpcTrackers");
    const refTrkPick = createKeyPicker(v.querySelector("#ceRefTrkPick"), {
      known: edTrkKeys, get: () => s.checkTrackerKeys,
      set: (l) => { s.checkTrackerKeys = l; markTouched(); }, labelOf: edTrkLabel,
      emptyHint: "No trackers yet — add some in the Trackers tab."
    });
    const refNpcPick = createKeyPicker(v.querySelector("#ceRefNpcPick"), {
      known: edNtrkKeys, get: () => s.checkNpcTrackerKeys,
      set: (l) => { s.checkNpcTrackerKeys = l; markTouched(); }, labelOf: edNtrkLabel,
      emptyHint: "No NPC trackers yet — add some in the NPC Trackers tab."
    });
    const syncRefPickVis = () => {
      v.querySelector("#ceRefTrkPick").hidden = !(s.checkIncludeTrackers === true);
      v.querySelector("#ceRefNpcPick").hidden = !(s.checkIncludeNpcTrackers === true);
    };
    paintSwitch(refT, s.checkIncludeTrackers === true);
    paintSwitch(refN, s.checkIncludeNpcTrackers === true);
    refT.onclick = () => { s.checkIncludeTrackers = !(s.checkIncludeTrackers === true); paintSwitch(refT, s.checkIncludeTrackers === true); syncRefPickVis(); markTouched(); };
    refN.onclick = () => { s.checkIncludeNpcTrackers = !(s.checkIncludeNpcTrackers === true); paintSwitch(refN, s.checkIncludeNpcTrackers === true); syncRefPickVis(); markTouched(); };
    refTrkPick.paint();
    refNpcPick.paint();
    syncRefPickVis();
    const refC = v.querySelector("#ceRefCustom");
    const refCWrap = v.querySelector("#ceRefCustomWrap");
    const refCTa = v.querySelector("#ceRefCustomTa");
    const refCNote = v.querySelector("#ceRefCustomNote");
    paintSwitch(refC, s.useCheckInstruction === true);
    refCWrap.hidden = !(s.useCheckInstruction === true);
    refCNote.hidden = !(s.useCheckInstruction === true);
    refCTa.value = s.checkInstruction || "";
    refC.onclick = () => { s.useCheckInstruction = !(s.useCheckInstruction === true); paintSwitch(refC, s.useCheckInstruction === true); refCWrap.hidden = !(s.useCheckInstruction === true); refCNote.hidden = !(s.useCheckInstruction === true); markTouched(); };
    refCTa.oninput = () => { s.checkInstruction = refCTa.value; markTouched(); };
    const statAiWrap = v.querySelector(".ce-lore-aiwrap");
    v.querySelector(".ce-stat-ai").onclick = () => { statAiWrap.hidden = !statAiWrap.hidden; if (!statAiWrap.hidden) v.querySelector("#ceStatRaw").focus(); };
    v.querySelector("#ceStatRun").onclick = () => runDefAi("stat", v.querySelector("#ceStatRaw").value, v.querySelector(".ce-lore-status"));
    v.querySelector(".ce-stat-presets").onclick = () => openPresetPopup("stat");
    v.querySelector(".ce-add-stat").onclick = () => {
      M.stats.defs.push(emptyStatDef());
      statSplit.state.sel = M.stats.defs.length - 1;
      statSplit.state.editing = true; // mobile drill-down: open the new stat's editor straight away
      markTouched();
      renderStatDefs();
    };
    updModPreview();
    renderStatDefs();
  }
  const statSplit = createSplit("stats", "stat");
  const emptyStatDef = () => ({ key: "", label: "", hint: "", start: "", max: "", rules: "" });
  // One stat row: its label (or key) plus the key it's referenced by in formulas, and start/max.
  const statRowInner = (d) => {
    const key = String(d.key || "").trim();
    const label = String(d.label || "").trim();
    const num = (x) => (x === undefined || x === null || x === "" ? "" : String(x));
    const range = num(d.start) || num(d.max) ? `${num(d.start) || "?"}/${num(d.max) || "?"}` : "";
    return siTitle(label || key || "Untitled stat", !label && !key) +
      siMeta(siBadge(label ? key : "", "acc"), siBadge(range), siDup());
  };
  const statEditHtml = (d) => `
      <div class="ce-grid ce-track-grid ce-stat-grid ce-defgrid">
        <label class="ce-fld"><span>key</span><input data-f="key" value="${esc(d.key)}" class="ce-k" placeholder="str" title="Stat key (lowercase, unique)"></label>
        <label class="ce-fld"><span>label</span><input data-f="label" value="${esc(d.label)}" placeholder="Strength"></label>
        <div class="ce-fld ce-fld-spacer" aria-hidden="true"></div>
        <label class="ce-fld"><span>start</span><input data-f="start" value="${esc(d.start)}" class="ce-num" placeholder="10"></label>
        <label class="ce-fld"><span>max</span><input data-f="max" value="${esc(d.max)}" class="ce-num" placeholder="50"></label>
        <label class="ce-fld ce-fld-full"><span>rules <span class="ce-note">(how the GM uses this stat in skill checks)</span></span><textarea data-f="rules" rows="2" placeholder="When this stat is used, how the GM should apply it — used for skill checks.">${esc(d.rules)}</textarea></label>
        <label class="ce-fld ce-fld-full"><span>hint <span class="ce-note">(tooltip only — optional)</span></span><input data-f="hint" value="${esc(d.hint)}" placeholder="tooltip shown in the hero panel"></label>
      </div>`;
  function wireStatEditor(el, i) {
    const d = M.stats.defs[i];
    el.querySelectorAll("input[data-f], textarea[data-f]").forEach((inp) => {
      inp.oninput = () => {
        const f = inp.dataset.f;
        if (f === "start" || f === "max") {
          d[f] = toNum(inp.value);
          inp.classList.toggle("bad", inp.value.trim() !== "" && Number.isNaN(d[f]));
        } else d[f] = inp.value;
        markTouched();
        statSplit.paintRow(i);
        if (f === "key") refreshStatDup();
      };
    });
    refreshStatDup();
  }
  // Flag every stat whose key collides with another's — its list row gets a red edge + "duplicate".
  function refreshStatDup() {
    const defs = M.stats.defs;
    const seen = {}; const bads = new Set();
    defs.forEach((d, i) => { if (d.key && seen[d.key] !== undefined) { bads.add(i); bads.add(seen[d.key]); } else seen[d.key] = i; });
    statSplit.markRows((b, i) => b.classList.toggle("bad", bads.has(i)));
    const inp = overlay.querySelector('[data-view="stats"] [data-part="stat-edit"] [data-f="key"]');
    if (inp) {
      const bad = bads.has(statSplit.state.sel);
      inp.classList.toggle("bad", bad);
      inp.title = bad ? "Duplicate stat key" : "Stat key (lowercase, unique)";
    }
  }
  function renderStatDefs() {
    statSplit.render({
      items: () => M.stats.defs,
      posLabel: (d, i, n) => `stat ${i + 1} / ${n}`,
      delTitle: "Remove stat",
      rowAttrs: () => ({ cls: "lt-stats" }),
      row: (d) => statRowInner(d),
      edit: (d) => statEditHtml(d),
      wireEdit: (el, i) => wireStatEditor(el, i),
      move: (d, i) => moveStatDef(d, i),
      afterReorder: () => { markTouched(); renderStatDefs(); },
      remove: (i) => { M.stats.defs.splice(i, 1); markTouched(); renderStatDefs(); },
      confirmDelete: (d) => confirmDeleteItem({
        blank: !String(d.key || "").trim() && !String(d.label || "").trim() && !String(d.hint || "").trim() && !String(d.rules || "").trim(),
        title: "Delete stat",
        message: `Delete the stat${String(d.key || "").trim() ? ` "${String(d.key).trim()}"` : ""}? This cannot be undone.`
      })
    });
  }
  function moveStatDef(delta, i) {
    const defs = M.stats.defs;
    const j = i + delta;
    if (j < 0 || j >= defs.length) return;
    [defs[i], defs[j]] = [defs[j], defs[i]];
    markTouched();
    renderStatDefs();
  }

  /* ---------- Trackers ---------- */
  const trkSplit = createSplit("trackers", "trk");
  function renderTrackers() {
    const v = $v("trackers");
    v.innerHTML = `
      <div class="ce-sec ce-lore-head"><span>tracked state &amp; resources</span>
        <span class="ce-lore-toolbtns">
          <button class="mini ce-trk-ai" type="button">✨ Generate</button>
          <button class="mini ce-trk-presets" type="button">📋 Presets</button>
          <button class="mini ok ce-add-trk">＋ Add tracker</button>
        </span>
      </div>
      <div class="ce-lore-aiwrap" hidden>
        <div class="ce-fld"><span>describe the tracker <span class="ce-note">(a name plus a line — what it tracks, what high/low values mean…)</span></span><textarea id="ceTrkRaw" rows="3" placeholder="e.g. Heat — how wanted the hero is; high heat means guards attack on sight…"></textarea></div>
        <div class="ce-lore-aibar">
          <button class="mini ok" id="ceTrkRun">✨ Generate tracker</button>
          <span class="ce-lore-status"></span>
        </div>
      </div>
      <div class="ce-note ce-sec-note">The AI keeps these up to date at the end of every GM turn. For <b>number</b> trackers, max/start may be a literal number or a formula over hero stats and other trackers: <code>= str*2</code>, <code>= level*20 + 80</code>.</div>
      <div class="ce-split" data-part="trk">
        <div class="ce-split-list" data-part="trk-list"></div>
        <div class="ce-split-edit" data-part="trk-edit"></div>
      </div>
      <div class="ce-split-empty dim" hidden>No trackers yet — add one above.</div>`;
    const trkAiWrap = v.querySelector(".ce-lore-aiwrap");
    v.querySelector(".ce-trk-ai").onclick = () => { trkAiWrap.hidden = !trkAiWrap.hidden; if (!trkAiWrap.hidden) v.querySelector("#ceTrkRaw").focus(); };
    v.querySelector("#ceTrkRun").onclick = () => runDefAi("trk", v.querySelector("#ceTrkRaw").value, v.querySelector(".ce-lore-status"));
    v.querySelector(".ce-trk-presets").onclick = () => openPresetPopup("trk");
    v.querySelector(".ce-add-trk").onclick = () => {
      M.trackers.push(emptyTracker());
      trkSplit.state.sel = M.trackers.length - 1;
      trkSplit.state.editing = true; // mobile drill-down: open the new tracker's editor straight away
      markTouched();
      renderTrkList();
    };
    renderTrkList();
  }
  const emptyTracker = () => ({ key: "", label: "", hint: "", icon: "", color: "", type: "number", show: "header", max: "", start: "", rules: "" });
  const trkName = (t) => String(t.label || "").trim() || String(t.key || "").trim();
  // A tracker's list row: icon + display name, then its key, type and where it shows. Number trackers
  // carry their bar colour onto the row's colour stripe.
  const trkRowInner = (t, npc) => {
    const icon = String(t.icon || "").trim();
    const label = String(t.label || "").trim();
    const key = String(t.key || "").trim();
    const name = label || key || "Untitled tracker";
    const showLab = npc
      ? (TRACKER_NPC_SHOWS.find(([val]) => val === t.show) || ["", t.show || "npc profile"])[1]
      : (TRACKER_SHOWS.find(([val]) => val === t.show) || ["", t.show])[1];
    return siTitle(icon ? icon + " " + name : name, !label && !key) +
      siMeta(siBadge(key, "acc"), siBadge(t.type === "number" ? "number" : "text"), siBadge(showLab), siDup());
  };
  const trkTypeOpts = (t) => TRACKER_TYPES.map((o) => `<option ${o === t.type ? "selected" : ""}>${o}</option>`).join("");
  const trkShowOpts = (t) => TRACKER_SHOWS.map(([val, lab]) => `<option value="${val}" ${val === t.show ? "selected" : ""}>${lab}</option>`).join("");
  const ntrkShowOpts = (t) => { const cur = t.show || "profile"; return TRACKER_NPC_SHOWS.map(([val, lab]) => `<option value="${val}" ${val === cur ? "selected" : ""}>${lab}</option>`).join(""); };
  // The live preview of the tracker exactly as it appears in the chat header / hero panel.
  const trkPipBox = () => `
        <div class="ce-trk-prev ce-fld-full">
          <span class="ce-trk-prev-lbl">preview</span>
          <div class="ce-trk-prev-box" data-part="pip"></div>
        </div>`;
  const trkEditHtml = (t) => `
      <div class="ce-grid ce-track-grid ce-defgrid">
        <label class="ce-fld"><span>key</span><input data-f="key" value="${esc(t.key)}" class="ce-k" placeholder="hp" title="Unique id without spaces (e.g. hp) — used in formulas and the machine block"></label>
        <label class="ce-fld"><span>icon</span><input data-f="icon" value="${esc(t.icon)}" placeholder="❤" title="Emoji shown in the bar"></label>
        <label class="ce-fld"><span>display name</span><input data-f="label" value="${esc(t.label)}" placeholder="HP"></label>
        <label class="ce-fld"><span>type</span><select data-f="type" title="number = a bar with a value; text = a plain tag">${trkTypeOpts(t)}</select></label>
        <label class="ce-fld"><span>starting value</span><input data-f="start" value="${esc(t.start)}" class="ce-fx" placeholder="1" title="Initial value — a number or = formula over stats/trackers"></label>
        <label class="ce-fld" data-numonly${t.type === "number" ? "" : " hidden"}><span>max value</span><input data-f="max" value="${esc(t.max)}" class="ce-fx" placeholder="100" title="Bar cap — a number or = formula over stats/trackers (e.g. = str*2, = level*20 + 80)"></label>
        <label class="ce-fld" data-numonly${t.type === "number" ? "" : " hidden"}><span>color</span><span data-part="colorfield" title="Bar color — hex like #bd2d2d (blank = the default green)"></span></label>
        <label class="ce-fld"><span>show in</span><select data-f="show" title="Where the tracker appears: chat header, hero panel, both, or hidden (tracked but never shown)">${trkShowOpts(t)}</select></label>
        <label class="ce-fld ce-fld-full"><span>rules <span class="ce-note">(how the GM changes it)</span></span><textarea data-f="rules" rows="4" placeholder="When this goes up/down, what it means, what the GM should track.">${esc(t.rules)}</textarea></label>
        <label class="ce-fld ce-fld-full"><span>hint <span class="ce-note">(tooltip only — optional)</span></span><input data-f="hint" value="${esc(t.hint)}" placeholder="short tooltip shown when hovering the bar"></label>
        ${trkPipBox()}
      </div>`;
  // The number/text + formula plumbing is identical for both tracker grids; `npc` picks the array it
  // edits and the split whose list row follows along.
  function wireTrkEditor(el, arr, i, npc) {
    const split = npc ? ntrkSplit : trkSplit;
    const scope = sampleFormulaScope(M.stats.defs, arr);
    const applyNumOnly = () => el.querySelectorAll("[data-numonly]").forEach((l) => (l.hidden = arr[i].type !== "number"));
    const refreshPip = () => {
      const box = el.querySelector('[data-part="pip"]');
      if (box) box.innerHTML = trackerPipPreview(arr[i], sampleFormulaScope(M.stats.defs, arr));
    };
    // start/max is a literal for number trackers, or a `= formula` over the sample stats/trackers.
    const checkFx = (inp) => {
      const val = inp.value.trim();
      let bad = false;
      if (val.startsWith("=")) {
        const expr = val.replace(/^=\s*/, "").trim();
        if (!expr) bad = true;
        else { try { evalFormula(expr, scope); } catch (e) { bad = true; } }
      } else if (arr[i].type === "number" && val !== "" && !Number.isFinite(Number(val))) bad = true;
      inp.classList.toggle("bad", bad);
    };
    applyNumOnly();
    refreshPip();
    const colorMount = el.querySelector('[data-part="colorfield"]');
    if (colorMount) {
      const picker = new ColorPicker({
        value: arr[i].color,
        placeholder: "#bd2d2d",
        title: colorMount.title || "",
        onInput: (hex) => {
          arr[i].color = hex;
          markTouched();
          refreshPip();
          split.paintRow(i);
        }
      });
      colorMount.replaceWith(picker.el);
    }
    el.querySelectorAll("input[data-f], select[data-f], textarea[data-f]").forEach((inp) => {
      inp.oninput = () => {
        const f = inp.dataset.f;
        const t = arr[i];
        if (f === "type" || f === "show") t[f] = inp.value;
        else if (f === "max" || f === "start") {
          const val = inp.value.trim();
          if (t.type === "number" && val && !val.startsWith("=") && Number.isFinite(Number(val))) t[f] = Number(val);
          else t[f] = val;
        }
        else t[f] = inp.value;
        markTouched();
        if (f === "max" || f === "start") checkFx(inp);
        if (f === "type") applyNumOnly();
        refreshPip();
        split.paintRow(i);
        if (f === "key") refreshTrkDup(arr, npc);
      };
      if (inp.tagName === "SELECT") inp.onchange = inp.oninput;
    });
    refreshTrkDup(arr, npc);
  }
  // Duplicate AND malformed keys are flagged on the list rows (red edge + "duplicate") and on the
  // editor's key field — an invalid key blocks saving (see trackerKeyErrors), so it shows red early.
  // Empty keys stay neutral live (a fresh "Add tracker" row starts empty) and are caught at save.
  function refreshTrkDup(arr, npc) {
    const split = npc ? ntrkSplit : trkSplit;
    const seen = {}; const bads = new Set();
    const invalids = new Set();
    arr.forEach((t, i) => {
      const k = String(t.key || "").trim();
      if (!k) return; // empty: neutral live, blocked at save
      if (!isValidTrackerKey(k)) { bads.add(i); invalids.add(i); return; }
      if (seen[k] !== undefined) { bads.add(i); bads.add(seen[k]); } else seen[k] = i;
    });
    split.markRows((b, i) => b.classList.toggle("bad", bads.has(i)));
    const inp = overlay.querySelector(`[data-view="${npc ? 'npcTrackers' : 'trackers'}"] [data-part="${npc ? "ntrk" : "trk"}-edit"] [data-f="key"]`);
    if (inp) {
      const bad = bads.has(split.state.sel);
      inp.classList.toggle("bad", bad);
      inp.title = invalids.has(split.state.sel)
        ? "Invalid key — use letters, digits, underscores and hyphens, no spaces (e.g. hp, magic_points)"
        : bad ? "Duplicate key — every key must be unique" : "Unique id without spaces (e.g. hp) — used in formulas and the machine block";
    }
  }
  // A tracker's list row wears its bar colour — and, with no colour set, the bar's own default (the
  // green accent), so the row always matches the chip. Text trackers have no bar, so they take the
  // default too (the tab hue is now only a fallback for a malformed colour).
  const trkHue = (t) => safeColor(t.color) || "var(--accent)";
  function renderTrkList() {
    trkSplit.render({
      items: () => M.trackers,
      posLabel: (t, i, n) => `tracker ${i + 1} / ${n}`,
      delTitle: "Remove tracker",
      rowAttrs: (t) => ({ cls: "lt-trk", hue: trkHue(t) }),
      row: (t) => trkRowInner(t),
      edit: (t) => trkEditHtml(t),
      wireEdit: (el, i) => wireTrkEditor(el, M.trackers, i, false),
      move: (d, i) => moveTrk(d, i),
      afterReorder: () => { markTouched(); renderTrkList(); },
      remove: (i) => { M.trackers.splice(i, 1); markTouched(); renderTrkList(); },
      confirmDelete: (t) => confirmDeleteItem({
        blank: !String(t.key || "").trim() && !String(t.label || "").trim() && !String(t.hint || "").trim() && !String(t.rules || "").trim(),
        title: "Delete tracker",
        message: `Delete the tracker${trkName(t) ? ` "${trkName(t)}"` : ""}? This cannot be undone.`
      })
    });
  }
  function moveTrk(delta, i) {
    const trks = M.trackers;
    const j = i + delta;
    if (j < 0 || j >= trks.length) return;
    [trks[i], trks[j]] = [trks[j], trks[i]];
    markTouched();
    renderTrkList();
  }

  /* ---------- NPC Trackers ---------- */
  // The per-NPC counterpart of the Trackers tab (README §6.3.1): the same def grid, minus the `show`
  // selector — these values live on each character, never in the header bar — and with NPC-scoped
  // wording. Writes `world.npcTrackers`.
  const ntrkSplit = createSplit("npcTrackers", "ntrk");
  function renderNpcTrackers() {
    const v = $v("npcTrackers");
    v.innerHTML = `
      <div class="ce-sec ce-lore-head"><span>per-character tracked state</span>
        <span class="ce-lore-toolbtns">
          <button class="mini ce-ntrk-ai" type="button">✨ Generate</button>
          <button class="mini ce-ntrk-presets" type="button">📋 Presets</button>
          <button class="mini ok ce-add-ntrk">＋ Add NPC tracker</button>
        </span>
      </div>
      <div class="ce-lore-aiwrap" hidden>
        <div class="ce-fld"><span>describe the npc tracker <span class="ce-note">(a name plus a line — what it tracks per character…)</span></span><textarea id="ceNtrkRaw" rows="3" placeholder="e.g. Trust — how much an NPC trusts the hero; high trust means they share secrets…"></textarea></div>
        <div class="ce-lore-aibar">
          <button class="mini ok" id="ceNtrkRun">✨ Generate NPC tracker</button>
          <span class="ce-lore-status"></span>
        </div>
      </div>
      <div class="ce-note ce-sec-note">Each character in play carries their <b>own</b> copy of every tracker here. A per-character starting value can be set on the <b>NPC</b> tab.</div>
      <div class="ce-split" data-part="ntrk">
        <div class="ce-split-list" data-part="ntrk-list"></div>
        <div class="ce-split-edit" data-part="ntrk-edit"></div>
      </div>
      <div class="ce-split-empty dim" hidden>No NPC trackers yet — add one above.</div>`;
    const ntrkAiWrap = v.querySelector(".ce-lore-aiwrap");
    v.querySelector(".ce-ntrk-ai").onclick = () => { ntrkAiWrap.hidden = !ntrkAiWrap.hidden; if (!ntrkAiWrap.hidden) v.querySelector("#ceNtrkRaw").focus(); };
    v.querySelector("#ceNtrkRun").onclick = () => runDefAi("ntrk", v.querySelector("#ceNtrkRaw").value, v.querySelector(".ce-lore-status"));
    v.querySelector(".ce-ntrk-presets").onclick = () => openPresetPopup("ntrk");
    v.querySelector(".ce-add-ntrk").onclick = () => {
      M.npcTrackers.push({ key: "", label: "", hint: "", icon: "", color: "", type: "number", show: "profile", max: "", start: "", rules: "" });
      ntrkSplit.state.sel = M.npcTrackers.length - 1;
      ntrkSplit.state.editing = true; // mobile drill-down: open the new tracker's editor straight away
      markTouched();
      renderNpcTrkList();
    };
    renderNpcTrkList();
  }
  const ntrkEditHtml = (t) => `
      <div class="ce-grid ce-track-grid ce-defgrid">
        <label class="ce-fld"><span>key</span><input data-f="key" value="${esc(t.key)}" class="ce-k" placeholder="trust" title="Unique id without spaces (e.g. trust) — used in formulas and in the machine block"></label>
        <label class="ce-fld"><span>icon</span><input data-f="icon" value="${esc(t.icon)}" placeholder="❤" title="Emoji shown on the chip"></label>
        <label class="ce-fld"><span>display name</span><input data-f="label" value="${esc(t.label)}" placeholder="Trust"></label>
        <label class="ce-fld"><span>type</span><select data-f="type" title="number = a bar with a value; text = a plain tag">${trkTypeOpts(t)}</select></label>
        <label class="ce-fld"><span>starting value</span><input data-f="start" value="${esc(t.start)}" class="ce-fx" placeholder="0" title="Initial value for a character the first time they are tracked — a number or = formula over hero stats/trackers"></label>
        <label class="ce-fld" data-numonly${t.type === "number" ? "" : " hidden"}><span>max value</span><input data-f="max" value="${esc(t.max)}" class="ce-fx" placeholder="100" title="Bar cap — a number or = formula over hero stats/trackers (e.g. = str*2)"></label>
        <label class="ce-fld" data-numonly${t.type === "number" ? "" : " hidden"}><span>color</span><span data-part="colorfield" title="Bar color — hex like #bd2d2d"></span></label>
        <label class="ce-fld"><span>show in</span><select data-f="show" title="npc profile shows it on the character, hidden tracks it silently">${ntrkShowOpts(t)}</select></label>
        <label class="ce-fld ce-fld-full"><span>rules <span class="ce-note">(how this character's value changes)</span></span><textarea data-f="rules" rows="4" placeholder="When this goes up/down for a character, what it means, and what the AI should watch for.">${esc(t.rules)}</textarea></label>
        <label class="ce-fld ce-fld-full"><span>hint <span class="ce-note">(tooltip only — optional)</span></span><input data-f="hint" value="${esc(t.hint)}" placeholder="short tooltip shown when hovering the chip"></label>
        ${trkPipBox()}
      </div>`;
  function renderNpcTrkList() {
    ntrkSplit.render({
      items: () => M.npcTrackers,
      posLabel: (t, i, n) => `npc tracker ${i + 1} / ${n}`,
      delTitle: "Remove NPC tracker",
      rowAttrs: (t) => ({ cls: "lt-ntrk", hue: trkHue(t) }),
      row: (t) => trkRowInner(t, true),
      edit: (t) => ntrkEditHtml(t),
      wireEdit: (el, i) => wireTrkEditor(el, M.npcTrackers, i, true),
      move: (d, i) => moveNpcTrk(d, i),
      afterReorder: () => { markTouched(); renderNpcTrkList(); },
      remove: (i) => { M.npcTrackers.splice(i, 1); markTouched(); renderNpcTrkList(); },
      confirmDelete: (t) => confirmDeleteItem({
        blank: !String(t.key || "").trim() && !String(t.label || "").trim() && !String(t.hint || "").trim() && !String(t.rules || "").trim(),
        title: "Delete NPC tracker",
        message: `Delete the NPC tracker${trkName(t) ? ` "${trkName(t)}"` : ""}? This cannot be undone.`
      })
    });
  }
  function moveNpcTrk(delta, i) {
    const trks = M.npcTrackers;
    const j = i + delta;
    if (j < 0 || j >= trks.length) return;
    [trks[i], trks[j]] = [trks[j], trks[i]];
    markTouched();
    renderNpcTrkList();
  }

  /* ---------- NPCs ---------- */
  const npcSplit = createSplit("npc", "npc");
  const emptyNpc = () => ({ name: "", age: "", gender: "", race: "", appearance: "", job: "", persona: "", secrets: "", extra: "", avatar: "" });
  const avatarPreview = (src) => src
    ? `<img class="ce-av-img" src="${esc(src)}" alt="">`
    : `<span class="ce-av-none">—</span>`;
  const NPC_NOTE = "The world's standing cast. These profiles are canon. They only appear in the chat NPC list once the hero actually meets them. This list is best kept to the main cast of the story. The engine can create other NPCs at runtime when needed.";
  function renderNpcs() {
    const v = $v("npc");
    v.innerHTML = `
      <div class="ce-sec ce-lore-head"><span>world cast</span>
        <span class="ce-lore-toolbtns">
          <button class="mini ce-npc-ai" type="button">✨ Generate</button>
          <button class="mini ok ce-add-npc">＋ Add NPC</button>
        </span>
      </div>
      <div class="ce-note ce-sec-note">${NPC_NOTE}</div>
      <div class="ce-lore-aiwrap" hidden>
        <div class="ce-fld"><span>describe the npc <span class="ce-note">(a name plus a line or two — role, looks, vibe… — the AI fills in the full profile using the world's story and lorebook)</span></span><textarea id="ceNpcRaw" rows="4" placeholder="e.g. Lysandra, a warm but secretive guild receptionist with a scar over one eye…"></textarea></div>
        <div class="ce-lore-aibar">
          <button class="mini ok" id="ceNpcRun">✨ Generate NPC</button>
          <span class="ce-lore-status"></span>
        </div>
      </div>
      <div class="ce-split" data-part="npc">
        <div class="ce-split-list" data-part="npc-list"></div>
        <div class="ce-split-edit" data-part="npc-edit"></div>
      </div>
      <div class="ce-split-empty dim" hidden>No world NPCs yet — add one above.</div>`;
    v.querySelector(".ce-add-npc").onclick = () => {
      M.npcs.push(emptyNpc());
      npcSplit.state.sel = M.npcs.length - 1;
      npcSplit.state.editing = true; // mobile drill-down: open the new NPC's editor straight away
      markTouched();
      renderNpcList();
    };
    const aiWrap = v.querySelector(".ce-lore-aiwrap");
    v.querySelector(".ce-npc-ai").onclick = () => { aiWrap.hidden = !aiWrap.hidden; if (!aiWrap.hidden) v.querySelector("#ceNpcRaw").focus(); };
    v.querySelector("#ceNpcRun").onclick = () => runNpcAi(v.querySelector("#ceNpcRaw").value, v.querySelector(".ce-lore-status"));
    renderNpcList();
  }
  // A cast row: just the portrait, the name and the job (dim, cut to one line with the full value on
  // hover) — age/gender/race stay in the editor so the list stays scannable.
  const npcRowInner = (n) => {
    const name = String(n.name || "").trim();
    const job = String(n.job || "").trim();
    return `<span class="ce-si-av">${avatarPreview(n.avatar)}</span>` +
      siTitle(name || "Unnamed NPC", !name) +
      siMeta(job ? `<span class="ce-si-job" title="${escAttr(job)}">${esc(job)}</span>` : "", siDup());
  };
  // Per-character starting values + caps for the world's NPC trackers (README §6.3.1) — an
  // "NPC Trackers" section placed after Extra, one row per tracker. A value set here is the seed for
  // this character's first appearance; blank means "use the world default". A number tracker with a
  // LITERAL max also gets a per-character cap field (a formula-derived cap is fixed by the def, so it
  // is left alone). Only rendered when the world actually defines NPC trackers, and only for defs
  // that have a key (a keyless def row is flagged as invalid anyway).
  function npcStartGrid(n) {
    const defs = (M.npcTrackers || []).filter((d) => String(d.key || "").trim());
    if (!defs.length) return "";
    const ov = n.trackers && typeof n.trackers === "object" ? n.trackers : {};
    const isSet = (v) => v !== undefined && v !== null && v !== "";
    const rows = defs.map((d) => {
      const key = String(d.key).trim();
      const name = String(d.label || "").trim() || key;
      const icon = String(d.icon || "").trim();
      const def = d.start === undefined || d.start === null ? "" : String(d.start);
      const startFld = `<label class="ce-fld"><span>start</span><input data-ntrk="${esc(key)}" value="${isSet(ov[key]) ? esc(ov[key]) : ""}" placeholder="${esc(def)}" title="Starting value for this character — blank uses the world default"></label>`;
      // A per-character cap only means something when the def's max is a LITERAL — a `= formula`
      // cap is derived from the hero's stats/trackers and stays fixed (§6.3.1). The editor holds def
      // fields pre-normalization, so a formula is still the raw `= …` string here.
      const maxRaw = d.max === undefined || d.max === null ? "" : String(d.max).trim();
      const capped = d.type === "number" && maxRaw !== "" && !maxRaw.startsWith("=");
      const maxFld = capped
        ? `<label class="ce-fld"><span>max</span><input data-ntrkm="${esc(key)}" value="${isSet(ov[key + ".max"]) ? esc(ov[key + ".max"]) : ""}" placeholder="${esc(d.max)}" title="Cap for this character — blank uses the world default"></label>`
        : "";
      return `<div class="ce-ntrk-row">
          <span class="ce-ntrk-name" title="${escAttr(name)}">${icon ? `<span class="ce-ntrk-ic">${esc(icon)}</span>` : ""}<b class="ce-ntrk-nm">${esc(name)}</b></span>
          <span class="ce-ntrk-vals">${startFld}${maxFld}</span>
        </div>`;
    }).join("");
    return `<div class="ce-fld-full ce-ntrk-start">
        <div class="ce-sec ce-ntrk-head"><span class="ce-ntrk-title">NPC Trackers</span><span class="ce-note">per-character — blank uses the world default</span></div>
        <div class="ce-ntrk-rows">${rows}</div>
      </div>`;
  }
  const npcEditHtml = (n, i) => `
      <div class="ce-av">
        <div class="ce-av-prev" data-i="${i}">${avatarPreview(n.avatar)}</div>
        <div class="ce-av-acts">
          <button class="mini ok ce-av-gen" data-i="${i}" title="Generate an avatar from appearance + persona" ${genImage ? "" : "disabled"}>✨ Generate</button>
          <button class="mini ce-av-up" data-i="${i}" title="Upload an image from your device (auto-scaled to a small JPEG)">⬆ Upload</button>
          ${n.avatar ? `<button class="mini warn ce-av-clr" data-i="${i}" title="Remove avatar — will generate one on first meeting">✕ Clear</button>` : `<span class="dim ce-av-note">No avatar set — the app generates one when the hero meets them.</span>`}
        </div>
      </div>
      <div class="ce-grid ce-track-grid ce-defgrid">
        <label class="ce-fld ce-fld-full"><span>name <span class="ce-note">(unique)</span></span><input data-f="name" value="${esc(n.name)}" class="ce-nk" placeholder="Lysandra" title="How they appear in the story — must be unique"></label>
        <label class="ce-fld"><span>age</span><input data-f="age" value="${esc(n.age)}" placeholder="late twenties"></label>
        <label class="ce-fld"><span>gender</span><input data-f="gender" value="${esc(n.gender)}" placeholder="woman"></label>
        <label class="ce-fld"><span>race</span><input data-f="race" value="${esc(n.race)}" placeholder="half-elf"></label>
        <label class="ce-fld ce-fld-full"><span>job</span><input data-f="job" value="${esc(n.job)}" placeholder="guild receptionist"></label>
        <label class="ce-fld ce-fld-full"><span>appearance</span><textarea data-f="appearance" rows="3" placeholder="Build, face, hair, eyes, clothing…">${esc(n.appearance)}</textarea></label>
        <label class="ce-fld ce-fld-full"><span>persona <span class="ce-note">(how they come across — personality, mannerisms, speech, habits)</span></span><textarea data-f="persona" rows="3" placeholder="Warm and chatty, but evasive about her past…">${esc(n.persona)}</textarea></label>
        <label class="ce-fld ce-fld-full"><span>secrets <span class="ce-note">(hidden from the hero — the GM acts on them but never reveals them unprompted)</span></span><textarea data-f="secrets" rows="3" placeholder="What they keep private…">${esc(n.secrets)}</textarea></label>
        <label class="ce-fld ce-fld-full"><span>extra <span class="ce-note">(anything that fits no other field — optional)</span></span><textarea data-f="extra" rows="3" placeholder="Skills, ties, quirks…">${esc(n.extra)}</textarea></label>
        ${npcStartGrid(n)}
      </div>`;
  function wireNpcEditor(el, i) {
    el.querySelectorAll("input[data-f], textarea[data-f]").forEach((inp) => {
      inp.oninput = () => {
        const f = inp.dataset.f;
        M.npcs[i][f] = inp.value;
        markTouched();
        npcSplit.paintRow(i);
        if (f === "name") refreshNpcDup();
      };
    });
    // Per-character NPC-tracker starting values: a literal only (formulas stay world-level).
    el.querySelectorAll("input[data-ntrk]").forEach((inp) => {
      const setVal = (key, v) => {
        const npc = M.npcs[i];
        if (!npc.trackers || typeof npc.trackers !== "object") npc.trackers = {};
        npc.trackers[key] = v;
      };
      const dropVal = (key) => {
        const npc = M.npcs[i];
        if (!npc.trackers || typeof npc.trackers !== "object") return;
        delete npc.trackers[key];
        if (!Object.keys(npc.trackers).length) delete npc.trackers;
      };
      inp.oninput = () => {
        const key = inp.dataset.ntrk;
        if (!key) return;
        const def = (M.npcTrackers || []).find((d) => String(d.key || "").trim() === key);
        const raw = inp.value.trim();
        let bad = false;
        if (raw === "") dropVal(key);
        else if (def && def.type === "number") {
          const num = Number(raw);
          if (Number.isFinite(num)) setVal(key, num);
          else bad = true; // a per-character override is a literal, never a formula
        } else setVal(key, raw);
        inp.classList.toggle("bad", bad);
        inp.title = bad ? "Starting value must be a number for this tracker (formulas aren't supported per character)" : "Starting value for this character — blank uses the world default";
        markTouched();
      };
    });
    // Per-character CAP override, for a number tracker whose def has a literal max. Stored as the
    // `key.max` pseudo-entry the live snapshot already uses (README §6.3.1).
    el.querySelectorAll("input[data-ntrkm]").forEach((inp) => {
      const capKey = () => String(inp.dataset.ntrkm || "").trim() + ".max";
      inp.oninput = () => {
        if (!inp.dataset.ntrkm) return;
        const k = capKey();
        const npc = M.npcs[i];
        const raw = inp.value.trim();
        let bad = false;
        if (raw === "") {
          if (npc.trackers && typeof npc.trackers === "object") {
            delete npc.trackers[k];
            if (!Object.keys(npc.trackers).length) delete npc.trackers;
          }
        } else {
          const num = Number(raw);
          if (Number.isFinite(num) && num >= 0) {
            if (!npc.trackers || typeof npc.trackers !== "object") npc.trackers = {};
            npc.trackers[k] = Math.round(num);
          } else bad = true; // literal, never a formula; never negative
        }
        inp.classList.toggle("bad", bad);
        inp.title = bad ? "Max must be a number ≥ 0 (formulas aren't supported per character)" : "Cap for this character — blank uses the world default";
        markTouched();
      };
    });
    el.querySelector(".ce-av-gen").onclick = () => genNpcAvatar(i, el.querySelector(".ce-av-gen"));
    el.querySelector(".ce-av-up").onclick = () => uploadNpcAvatar(i);
    const clr = el.querySelector(".ce-av-clr");
    if (clr) clr.onclick = () => { M.npcs[i].avatar = ""; markTouched(); renderNpcList(); };
    refreshNpcDup();
  }
  // Flag every NPC whose name collides with another's — the row gets a red edge + "duplicate" tag.
  function refreshNpcDup() {
    const seen = {}; const bads = new Set();
    M.npcs.forEach((n, i) => {
      const nm = String(n.name || "").trim().toLowerCase();
      if (nm && seen[nm] !== undefined) { bads.add(i); bads.add(seen[nm]); } else seen[nm] = i;
    });
    npcSplit.markRows((b, i) => b.classList.toggle("bad", bads.has(i)));
    const inp = overlay.querySelector('[data-view="npc"] [data-part="npc-edit"] [data-f="name"]');
    if (inp) {
      const bad = bads.has(npcSplit.state.sel);
      inp.classList.toggle("bad", bad);
      inp.title = bad ? "Duplicate NPC name" : "How they appear in the story — must be unique";
    }
  }
  function renderNpcList() {
    npcSplit.render({
      items: () => M.npcs,
      posLabel: (n, i, total) => `npc ${i + 1} / ${total}`,
      delTitle: "Remove NPC",
      rowAttrs: () => ({ cls: "lt-npc has-av" }),
      row: (n) => npcRowInner(n),
      edit: (n, i) => npcEditHtml(n, i),
      wireEdit: (el, i) => wireNpcEditor(el, i),
      move: (d, i) => moveNpc(d, i),
      afterReorder: () => { markTouched(); renderNpcList(); },
      remove: (i) => { M.npcs.splice(i, 1); markTouched(); renderNpcList(); },
      confirmDelete: (n) => confirmDeleteItem({
        blank: !String(n.name || "").trim() && !n.appearance && !n.persona && !n.secrets && !n.extra && !n.avatar,
        title: "Delete NPC",
        message: `Delete the NPC${String(n.name || "").trim() ? ` "${String(n.name).trim()}"` : ""}? This cannot be undone.`
      })
    });
  }
  function moveNpc(delta, i) {
    const npcs = M.npcs;
    const j = i + delta;
    if (j < 0 || j >= npcs.length) return;
    [npcs[i], npcs[j]] = [npcs[j], npcs[i]];
    markTouched();
    renderNpcList();
  }
  function npcAiInstruction(userText) {
    const lore = lorebookToText(M.lorebook, { activation: null, capChars: 3500 });
    const story = [
      M.narrativeVibe ? "NARRATIVE VIBE:\n" + String(M.narrativeVibe).slice(0, 1200) : "",
      M.scenario ? "SCENARIO:\n" + String(M.scenario).slice(0, 2000) : "",
      M.start ? "STARTING SCENE:\n" + String(M.start).slice(0, 2000) : ""
    ].filter(Boolean).join("\n\n");
    const existing = (M.npcs || []).map((n) => String(n.name || "").trim()).filter(Boolean).join(", ");
    // The ban covers only INVENTED names: when the request already contains a name ("Lysandra, a…",
    // "a scalper named John", "John is a…"), the AI must use that exact name even if it sits on the
    // overused list. This is decided per-reply in runNpcAi (AI name vs request text), not by guessing
    // where the name sits in the request.
    const nameRule = "If the NPC REQUEST already contains a name for this character, use that exact name for the name field — even if it appears in the list below. Otherwise — when the request gives no name and you must invent one — do NOT use any of these overused AI names (or close variants/spellings): " + NPC_NAME_BANNED.join(", ") + ". Invent a fresh name fitting the world's own culture instead.";
    return [
      "You create a single NPC profile for a text RPG world. Match the world's story and lorebook — races, factions, tone, roles.",
      `World: ${(M.meta && M.meta.name) || "(unnamed)"}`,
      story,
      lore ? "WORLD LOREBOOK (canon):\n" + lore : "",
      existing ? "EXISTING CAST (do NOT reuse these names): " + existing : "",
      "NPC REQUEST:\n" + userText,
      nameRule,
      "Reply with ONLY one JSON object — no prose, no code fence. Strict valid JSON: double quotes, NO trailing commas, each string on a single line (write inner line breaks as \\n). Keys: name (required, unique), age (e.g. \"early twenties\"), gender, race, appearance (build, face, hair, eyes, clothing), job (what they do), persona (personality, mannerisms, speech, habits), secrets (hidden from the hero; \"none notable\" if nothing), extra (ONLY anything fitting no other field; \"none notable\" if nothing). Invent vivid consistent details to fill gaps. Example: {\"name\": \"Lysandra\", \"age\": \"late twenties\", \"gender\": \"woman\", \"race\": \"half-elf\", \"job\": \"guild receptionist\", \"appearance\": \"...\", \"persona\": \"...\", \"secrets\": \"...\", \"extra\": \"none notable\"}"
    ].filter(Boolean).join("\n\n");
  }
  async function runNpcAi(rawText, statusEl) {
    const g = window.genText;
    const setStatus = (msg, bad) => { if (!statusEl) return; statusEl.textContent = msg || ""; statusEl.classList.toggle("bad", !!bad); };
    if (!rawText || !rawText.trim()) { setStatus("✋ Describe the NPC first.", true); return; }
    if (!g) { setStatus("✋ No text AI available.", true); return; }
    const btn = overlay.querySelector("#ceNpcRun");
    setBusy(btn, "Generating…");
    setStatus("Generating NPC — this can take up to a minute…");
    try {
      const userText = rawText.trim();
      const res = await g({ instruction: npcAiInstruction(userText), route: "other" });
      const out = String((res && res.text) || res || "");
      const arr = await extractLoreArray(out);
      const obj = Array.isArray(arr) ? arr[0] : arr;
      if (!obj || typeof obj !== "object") throw new Error("reply wasn't usable");
      const s = (v) => String(v ?? "").trim();
      const npc = { ...emptyNpc(), name: s(obj.name), age: s(obj.age), gender: s(obj.gender), race: s(obj.race), appearance: s(obj.appearance), job: s(obj.job), persona: s(obj.persona), secrets: s(obj.secrets), extra: s(obj.extra) };
      if (!npc.name) throw new Error("the AI reply had no name — click Generate again to retry");
      if ((M.npcs || []).some((n) => String(n.name || "").trim().toLowerCase() === npc.name.toLowerCase())) throw new Error(`an NPC named "${npc.name}" already exists`);
      npcSplit.state.sel = M.npcs.length;
      npcSplit.state.editing = true;
      M.npcs.push(npc);
      markTouched();
      renderNpcList();
      setStatus(`✓ "${npc.name}" added below — review and edit before saving.`);
      if (notify) notify(`✨ NPC "${npc.name}" generated.`);
    } catch (err) {
      console.error("npc AI generation failed:", err);
      setStatus("⚠ " + (err && err.message ? err.message : "The AI call failed."), true);
    } finally {
      clearBusy(btn);
    }
  }

  // AI-generate an NPC's avatar from their appearance/persona (mirrors the in-session portrait
  // pipeline — appearance + identity + the world's art-style tags feed the prompt).
  function defAiContext() {
    const lore = lorebookToText(M.lorebook, { activation: null, capChars: 1500 });
    const story = [
      M.narrativeVibe ? "NARRATIVE VIBE:\n" + String(M.narrativeVibe).slice(0, 800) : "",
      M.scenario ? "SCENARIO:\n" + String(M.scenario).slice(0, 1200) : ""
    ].filter(Boolean).join("\n\n");
    return { story, lore };
  }
  function worldName() { return "World: " + (((M.meta && M.meta.name) || "(unnamed)")); }
  function statAiInstruction(userText) {
    const ctx = defAiContext();
    const existing = (M.stats.defs || []).map((d) => String(d.key || "").trim()).filter(Boolean).join(", ");
    return [
      "You create a single hero stat (attribute) for a text RPG world. Match the genre and tone.",
      worldName(),
      ctx.story,
      ctx.lore ? "WORLD LOREBOOK (canon):\n" + ctx.lore : "",
      existing ? "EXISTING STAT KEYS (do NOT reuse): " + existing : "",
      "STAT REQUEST:\n" + userText,
      "Reply with ONLY one JSON object with EXACTLY these property names: key, label, start, max, hint, rules. Do NOT use the stat name as a property name. Bad: {\"grit\": \"Grit\"}. Good: {\"key\": \"grit\", \"label\": \"Grit\", ...}. Strict valid JSON: double quotes around every property name and every string, NO trailing commas. Example: {\"key\": \"grit\", \"label\": \"Grit\", \"start\": 10, \"max\": 50, \"hint\": \"willpower to push through pain\", \"rules\": \"Used for endurance and fear checks; high grit steadies the hero under torment\"}"
    ].filter(Boolean).join("\n\n");
  }
  function trkAiInstruction(userText, npc) {
    const ctx = defAiContext();
    const arr = npc ? M.npcTrackers : M.trackers;
    const existing = (arr || []).map((d) => String(d.key || "").trim()).filter(Boolean).join(", ");
    const scope = npc ? "Each character carries their OWN copy of this tracker." : "This is a shared hero/world tracker.";
    const showRule = npc ? ", show (\"profile\" to show it on the character, \"hidden\" to track it silently)" : ", show (\"header\" for shared world state on every screen, \"hero\" for personal resources — never \"both\")";
    const example = npc ? "{\"key\": \"trust\", \"label\": \"Trust\", \"icon\": \"❤️\", \"type\": \"number\", \"start\": 50, \"max\": 100, \"hint\": \"faith in the hero\", \"rules\": \"How much this character trusts the hero; high trust unlocks secrets and aid, low trust risks betrayal. Moves when the hero keeps or breaks promises\"}" : "{\"key\": \"heat\", \"label\": \"Heat\", \"icon\": \"🔥\", \"type\": \"number\", \"show\": \"header\", \"start\": 0, \"max\": 100, \"hint\": \"how wanted the hero is\", \"rules\": \"How hot the hunt is; high heat means patrols attack on sight and informants talk. Rises on loud crimes, cools when the hero lays low\"}" ;
    return [
      npc ? "You create a single per-character NPC tracker." : "You create a single hero/world tracker.",
      scope + " Match the genre, premise and tone.",
      worldName(),
      ctx.story,
      ctx.lore ? "WORLD LOREBOOK (canon):\n" + ctx.lore : "",
      existing ? "EXISTING TRACKER KEYS (do NOT reuse): " + existing : "",
      "TRACKER REQUEST:\n" + userText,
      "RULES FIELD (most important) — one sentence with three jobs: WHAT the tracker is, HOW high/low values affect play (what they unlock, block, or risk), WHEN the GM updates it. Bad, never write this: \"Decreases when taking damage.\" Good: \"Nero's health; at 0 he is downed and at the enemy's mercy. Lose it to enemy hits; restore it by healing, rest, or potions.\"",
      "Reply with ONLY one JSON object with EXACTLY these property names: key, label, icon, type, show, start, max, hint, rules. Do NOT use the tracker name as a property name. Bad: {\"hair_style\": \"Hair Appearance\"}. Good: {\"key\": \"hair_style\", \"label\": \"Hair Appearance\", ...}. type must be exactly \"number\" or \"text\" (never \"string\"). Strict valid JSON: double quotes around every property name and every string, NO trailing commas. Example: " + example
    ].filter(Boolean).join("\n\n");
  }
  // Fallback when the model answers in markdown/prose instead of JSON: pull ## header +
  // field pairs out of the reply into one def object. Unknown lines join the rules text.
  function parseDefFallback(kind, text) {
    const txt = String(text || "").replace(/```[a-zA-Z]*\s*([\s\S]*?)```/g, "$1");
    const head = txt.match(/^##\s+(.{1,60}?)\s*$/m);
    const obj = {};
    if (head) obj.label = head[1].replace(/\*\*/g, "").trim();
    const pairRe = /(key|label|icon|type|show|start|max|hint|rules)\s*:\s*(\([^)]*\)|[^,\n]+)/gi;
    let m = null;
    const rest = [];
    for (const line of txt.split(/\n/)) {
      if (/^##\s+/.test(line) || /^\s*END\s*$/.test(line)) continue;
      pairRe.lastIndex = 0;
      let hit = false;
      while ((m = pairRe.exec(line))) {
        hit = true;
        const k = m[1].toLowerCase();
        let v = String(m[2]).trim().replace(/^\(+([\s\S]*)\)+$/, "$1").trim();
        if (k !== "rules") v = v.replace(/[{}]+/g, "").trim();
        if (v && !(k in obj)) obj[k] = v;
        else if (v && k === "rules") obj.rules = obj.rules + " " + v;
      }
      if (!hit && line.trim()) rest.push(line.trim());
    }
    if (rest.length && !obj.rules) obj.rules = rest.join(" ");
    else if (rest.length) obj.rules = obj.rules + " " + rest.join(" ");
    if (!obj.key && obj.label) obj.key = obj.label;
    if (!obj.label && obj.key) obj.label = obj.key;
    if (!obj.key) return null;
    return obj;
  }
  /* ---------- Def presets popup (packs live in def-presets.js for easy editing) ---------- */
  function openPresetPopup(kind) {
    const cfg = {
      stat: { title: "Stat presets", items: STAT_PRESETS, list: () => M.stats.defs, paint: renderStatDefs },
      trk: { title: "Tracker presets", items: TRK_PRESETS, list: () => M.trackers, paint: renderTrkList },
      ntrk: { title: "NPC tracker presets", items: NTRK_PRESETS, list: () => M.npcTrackers, paint: renderNpcTrkList }
    }[kind];
    if (!cfg) return;
    const pop = document.createElement("div");
    pop.className = "popup-overlay";
    pop.innerHTML = "\n      <div class=\"popup\">\n        <div class=\"popup-head\"><span class=\"popup-title\">" + cfg.title + "</span><button class=\"popup-x\">✕</button></div>\n        <div class=\"confirm-msg\" style=\"padding: 6px 14px;\">Click to add — one click per item, the popup stays open.</div>\n        <div class=\"ce-preset-list\" style=\"max-height: 50vh; overflow-y: auto; padding: 0 14px 6px;\"></div>\n        <div class=\"popup-acts\">\n          <button class=\"mini popup-cancel\">Done</button>\n        </div>\n      </div>";
    const release = pushBackClose(() => donePop());
    const donePop = () => { release(); pop.remove(); };
    const listEl = pop.querySelector(".ce-preset-list");
    const paintRows = () => {
      listEl.innerHTML = cfg.items.map((p, i) => {
        const taken = (cfg.list() || []).some((d) => String(d.key || "").trim().toLowerCase() === p.key);
        const rowCls = kind === "stat" ? "lt-stats" : (kind === "ntrk" ? "lt-ntrk" : "lt-trk");
        const rowInner = kind === "stat" ? statRowInner(p) : trkRowInner(p, kind === "ntrk");
        const rowStyle = "flex:1;min-width:0;cursor:default" + (kind === "stat" ? "" : ";--lt:" + trkHue(p));
        return "<div class=\"ce-preset-row\" style=\"display:flex;gap:8px;align-items:center;margin-bottom:6px\">" +
          "<div class=\"ce-split-item " + rowCls + "\" style=\"" + rowStyle + "\">" + rowInner + "</div>" +
          (taken ? "<button class=\"mini\" disabled>Added ✓</button>" : "<button class=\"mini ok\" data-preset=\"" + i + "\">Add</button>") + "</div>";
      }).join("");
      listEl.querySelectorAll("[data-preset]").forEach((b) => {
        b.onclick = () => {
          const p = cfg.items[+b.dataset.preset];
          cfg.list().push(JSON.parse(JSON.stringify(p)));
          markTouched();
          cfg.paint();
          if (notify) notify("Added preset \"" + p.label + "\".");
          paintRows();
        };
      });
    };
    paintRows();
    pop.querySelector(".popup-x").onclick = () => donePop();
    pop.querySelector(".popup-cancel").onclick = () => donePop();
    pop.addEventListener("mousedown", (e) => { if (e.target === pop) donePop(); });
    document.body.appendChild(pop);
  }

  async function runDefAi(kind, rawText, statusEl) {
    const g = window.genText;
    const setStatus = (msg, bad) => { if (!statusEl) return; statusEl.textContent = msg || ""; statusEl.classList.toggle("bad", !!bad); };
    if (!rawText || !rawText.trim()) { setStatus("Describe it first.", true); return; }
    if (!g) { setStatus("No text AI available.", true); return; }
    const btnIds = { stat: "#ceStatRun", trk: "#ceTrkRun", ntrk: "#ceNtrkRun" };
    const what = kind === "stat" ? "Stat" : (kind === "ntrk" ? "NPC tracker" : "Tracker");
    const btn = overlay.querySelector(btnIds[kind]);
    if (!btn) return;
    setBusy(btn, "Generating…");
    setStatus("Generating " + what.toLowerCase() + "…");
    try {
      const instruction = kind === "stat" ? statAiInstruction(rawText.trim()) : trkAiInstruction(rawText.trim(), kind === "ntrk");
      const res = await g({ instruction, route: "other" });
      const out = String((res && res.text) || res || "");
      let obj = null;
      try {
        const arr = await extractLoreArray(out);
        obj = Array.isArray(arr) ? arr[0] : arr;
      } catch (e) { obj = null; }
      if (!obj || typeof obj !== "object") obj = parseDefFallback(kind, out);
      if (!obj || typeof obj !== "object") throw new Error("the AI reply was not usable JSON — click Generate again to retry");
      const s = (v) => String(v == null ? "" : v).trim();
      const pick = (o, names) => {
        for (const k of Object.keys(o || {})) {
          if (names.indexOf(k.toLowerCase()) >= 0) return o[k];
        }
        return undefined;
      };
      // AI replies sometimes use a display name ("Hair Style") as the key — collapse whitespace
      // to underscores so a generated tracker always starts save-valid (e.g. "hair style" → "hair_style").
      let key = s(pick(obj, ["key", "name", "id", "slug"])).toLowerCase().replace(/\s+/g, "_");
      if (!key) {
        const known = ["key", "name", "id", "slug", "label", "title", "icon", "type", "show", "start", "max", "hint", "rules"];
        const strange = Object.keys(obj).filter((k) => known.indexOf(k.toLowerCase()) < 0);
        if (strange.length === 1) {
          const v = s(obj[strange[0]]);
          key = strange[0].trim().toLowerCase().replace(/\s+/g, "_");
          if (!s(pick(obj, ["label", "title"]))) obj.label = v || strange[0].trim();
        }
      }
      if (!key) throw new Error("the AI reply had no key — click Generate again to retry");
      if (kind === "stat") {
        if ((M.stats.defs || []).some((d) => String(d.key || "").trim().toLowerCase() === key)) throw new Error("duplicate key");
        const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : ""; };
        statSplit.state.sel = M.stats.defs.length;
        statSplit.state.editing = true;
        M.stats.defs.push({ key, label: s(pick(obj, ["label", "title"])) || key, hint: s(pick(obj, ["hint"])), start: num(pick(obj, ["start"])), max: num(pick(obj, ["max"])), rules: s(pick(obj, ["rules"])) });
        markTouched();
        renderStatDefs();
      } else {
        const list = kind === "ntrk" ? M.npcTrackers : M.trackers;
        const split = kind === "ntrk" ? ntrkSplit : trkSplit;
        if ((list || []).some((d) => String(d.key || "").trim().toLowerCase() === key)) throw new Error("duplicate key");
        const rawType = s(pick(obj, ["type"])).toLowerCase();
        const type = (rawType === "text" || rawType === "string" || rawType === "str" || rawType === "textual") ? "text" : "number";
        const def = { key, label: s(pick(obj, ["label", "title"])) || key, hint: s(pick(obj, ["hint"])), icon: s(pick(obj, ["icon"])), color: "", type, max: "", start: "", rules: s(pick(obj, ["rules"])) };
        const keepRaw = (v) => {
          if (v === undefined || v === null || v === "") return "";
          if (typeof v === "number" && Number.isFinite(v)) return v;
          const sv = s(v);
          if (!sv) return "";
          if (type === "number" && sv.charAt(0) !== "=" && Number.isFinite(Number(sv))) return Number(sv);
          return sv;
        };
        def.start = keepRaw(pick(obj, ["start"]));
        def.max = keepRaw(pick(obj, ["max"]));
        if (kind === "trk") { const sh = s(pick(obj, ["show"])).toLowerCase(); def.show = (sh === "header" || sh === "hero" || sh === "both" || sh === "hidden") ? sh : "header"; }
        if (kind === "ntrk") { const sh = s(pick(obj, ["show"])).toLowerCase(); def.show = (sh === "hidden" || sh === "profile") ? sh : "profile"; }
        split.state.sel = list.length;
        split.state.editing = true;
        list.push(def);
        markTouched();
        if (kind === "ntrk") renderNpcTrkList(); else renderTrkList();
      }
      setStatus("Added — review and edit before saving.");
      if (notify) notify("Generated " + what.toLowerCase() + ".");
    } catch (err) {
      setStatus("Problem: " + (err && err.message ? err.message : "The AI call failed."), true);
    } finally {
      clearBusy(btn);
    }
  }

  async function genNpcAvatar(i, btn) {
    const npc = M.npcs[i];
    if (!npc || !genImage) return;
    setBusy(btn, "Generating…");
    try {
      const identity = [npc.gender, npc.race, npc.age ? `age ${npc.age}` : ""].filter(Boolean).join(", ");
      const style = M.imageStyleTags ? `, (${M.imageStyleTags})` : "";
      const bits = [identity, npc.appearance, style].filter(Boolean);
      const subject = npc.name || "a character";
      const prompt = bits.length ? `Portrait of ${subject}, ${bits.join(", ")}.` : `Portrait of ${subject}.`;
      // genImageSafe times out (the plugin's promise never settles on failure) and throws on empty.
      const r = await genImageSafe(genImage, prompt, { route: "portraits", negativePrompt: M.imageNegativeTags || "", guidanceScale: imageGuidance() });
      if (r && r.dataUrl) { npc.avatar = await generatedAvatarToWebp(r.dataUrl); markTouched(); renderNpcList(); }
      else if (notify) notify("⚠ Couldn't generate avatar.");
    } catch (e) {
      console.error("World NPC avatar generation failed:", e);
      if (notify) notify("⚠ Couldn't generate avatar.");
    } finally {
      clearBusy(btn);
    }
  }

  // Upload a local image as the NPC's avatar (downscaled + JPEG-encoded data URL, same encoding
  // as generated avatars).
  async function uploadNpcAvatar(i) {
    const npc = M.npcs[i];
    if (!npc) return;
    let file;
    try { file = await pickImageFile(); } catch (e) { return; }
    if (!file) return;
    try {
      npc.avatar = await fileToAvatarDataUrl(file);
      markTouched();
      renderNpcList();
    } catch (e) {
      if (notify) notify("⚠ " + ((e && e.message) || "Couldn't load that image."));
    }
  }

  /* ---------- Raw JSON ---------- */
  function renderRaw() {
    const v = $v("raw");
    v.innerHTML = `
      <div class="ce-sec"><span>raw json</span>
        <span class="ce-lore-toolbtns">
          <button class="mini ce-raw-fmt" type="button">Format</button>
          <button class="mini ce-raw-val" type="button">Validate</button>
        </span>
      </div>
      <span class="ce-raw-status"></span>
      <textarea class="ce-raw-ta" id="ceRawTa" spellcheck="false"></textarea>`;
    const ta = v.querySelector("#ceRawTa");
    const st = v.querySelector(".ce-raw-status");
    ta.value = JSON.stringify(M, null, 2);
    ta.oninput = () => markTouched();
    v.querySelector(".ce-raw-fmt").onclick = () => {
      try { ta.value = JSON.stringify(JSON.parse(ta.value), null, 2); setRawStatus(st, "Formatted.", "ok"); }
      catch (e) { setRawStatus(st, "Parse error: " + e.message, "bad"); }
    };
    v.querySelector(".ce-raw-val").onclick = () => {
      let obj;
      try { obj = JSON.parse(ta.value); }
      catch (e) { setRawStatus(st, "Parse error: " + e.message, "bad"); return; }
      // Same key rule as the structured tabs (see trackerKeyErrors): the loader alone accepts
      // spaced keys, so check the raw text here too — otherwise Validate would call a world
      // "valid" that Save then refuses.
      const rawKeyErr = (() => {
        const lists = [["trackers", "Tracker"], ["npcTrackers", "NPC tracker"]];
        for (const [field, what] of lists) {
          const arr = obj && obj[field];
          if (!Array.isArray(arr)) continue;
          for (let i = 0; i < arr.length; i++) {
            const k = String((arr[i] && arr[i].key) || "").trim();
            if (!k) return `${what} ${i + 1} needs a key.`;
            if (/\s/.test(k)) return `${what} key "${k}" must not contain spaces — use underscores.`;
            if (!TRACKER_KEY_RE.test(k)) return `${what} key "${k}" is invalid — use letters, digits, underscores and hyphens, starting with a letter.`;
          }
        }
        return "";
      })();
      if (rawKeyErr) { setRawStatus(st, rawKeyErr, "bad"); return; }
      const { world, errors, warnings } = loadWorld(JSON.stringify(obj));
      if (errors.length) setRawStatus(st, errors[0], "bad");
      else if (warnings.length) setRawStatus(st, "Valid — " + warnings.length + " warning(s): " + warnings[0], "ok");
      else setRawStatus(st, "✓ Valid world file.", "ok");
    };
  }
  // Parse the raw textarea back into M; false on parse failure (caller stays on the tab).
  // Visiting the tab without changing anything must NOT dirty the editor, so only
  // mark touched when the parsed content actually differs from M.
  function applyRaw() {
    const ta = overlay.querySelector("#ceRawTa");
    if (!ta) return true;
    let obj;
    try { obj = JSON.parse(ta.value); }
    catch (e) { showErr("Raw JSON parse error: " + e.message); return false; }
    const before = JSON.stringify(M);
    Object.keys(M).forEach((k) => delete M[k]);
    Object.assign(M, obj);
    if (!M.meta || typeof M.meta !== "object") M.meta = {};
    if (!Array.isArray(M.meta.tags)) M.meta.tags = [];
    if (M.meta.tags.some(isNsfwTag)) M.meta.nsfw = true;
    M.meta.tags = M.meta.tags.filter((t) => !isReservedTag(t));
    M.meta.nsfw = M.meta.nsfw === true;
    if (!M.stats || typeof M.stats !== "object") M.stats = {};
    if (!Array.isArray(M.stats.defs)) M.stats.defs = [];
    if (M.stats.dieSides === undefined) M.stats.dieSides = DEFAULT_STATS.dieSides;
  if (M.stats.ccCeiling === undefined || M.stats.ccCeiling === "" ) M.stats.ccCeiling = DEFAULT_STATS.ccCeiling;
    if (typeof M.imageIncludeTrackers !== "boolean") M.imageIncludeTrackers = false;
    if (typeof M.imageIncludeNpcTrackers !== "boolean") M.imageIncludeNpcTrackers = false;
    if (!Array.isArray(M.imageTrackerKeys)) M.imageTrackerKeys = [];
    if (!Array.isArray(M.imageNpcTrackerKeys)) M.imageNpcTrackerKeys = [];
    if (typeof M.stats.statModFormula !== "string") M.stats.statModFormula = "";
    if (typeof M.stats.useStatModFormula !== "boolean") M.stats.useStatModFormula = false;
    if (typeof M.stats.checkIncludeTrackers !== "boolean") M.stats.checkIncludeTrackers = false;
    if (typeof M.stats.checkIncludeNpcTrackers !== "boolean") M.stats.checkIncludeNpcTrackers = false;
    if (!Array.isArray(M.stats.checkTrackerKeys)) M.stats.checkTrackerKeys = [];
    if (!Array.isArray(M.stats.checkNpcTrackerKeys)) M.stats.checkNpcTrackerKeys = [];
    if (typeof M.stats.useCheckInstruction !== "boolean") M.stats.useCheckInstruction = false;
    if (typeof M.stats.checkInstruction !== "string") M.stats.checkInstruction = "";
    if (!Array.isArray(M.trackers)) M.trackers = [];
    if (!Array.isArray(M.npcTrackers)) M.npcTrackers = [];
    if (!Array.isArray(M.npcs)) M.npcs = [];
    M.lorebook = normalizeLorebook(M.lorebook);
    delete M.loreTriggerWindowTurns;
    showErr("");
    if (JSON.stringify(M) !== before) markTouched();
    return true;
  }

 /* ---------- tabs / save / cancel ---------- */
 const tabIndex = (id) => TABS.findIndex((t) => t.id === id);
  function showTab(id) {
    if (!TAB_IDS.has(id)) return;
    curTab = id;
    // The tab bar is a single scrollable row (no wrapping) so it scales to any number of
    // tabs — keep the active one in view when it moves off-screen.
    overlay.querySelectorAll(".ce-tab").forEach((t) => {
      const on = t.dataset.t === id;
      t.classList.toggle("on", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      if (on) { try { t.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (err) { /* scroll optional */ } }
    });
    overlay.querySelectorAll(".ce-view").forEach((v) => { v.hidden = v.dataset.view !== id; });
    showErr("");
    try { requestAnimationFrame(() => { if (typeof paintTabNav === "function") paintTabNav(); }); } catch (err) { /* nav optional */ }
    if (id === "basics") renderBasics();
    else if (id === "story") renderStory();
    else if (id === "lorebook") renderLorebook();
    else if (id === "npc") renderNpcs();
    else if (id === "images") renderImages();
    else if (id === "stats") renderStats();
    else if (id === "trackers") renderTrackers();
    else if (id === "npcTrackers") renderNpcTrackers();
    else if (id === "context") renderContext();
    else if (id === "raw") renderRaw();
  }

  /* ---------- Context budget: the diagnostic tab ---------- */
  // Isolated from the rest of the editor: it only reads M and renders its own tab.
  function renderContext() {
    const v = $v("context");
    if (v) renderContextTab(v, M);
  }
  const tabsEl = overlay.querySelector(".ce-tabs");
  const goTab = (id) => {
    if (!TAB_IDS.has(id) || id === curTab) return;
    if (curTab === "raw" && !applyRaw()) return; // stay on Raw if it doesn't parse
    showTab(id);
  };
  overlay.querySelectorAll(".ce-tab").forEach((t) => {
    t.onclick = () => goTab(t.dataset.t);
  });
  // Arrow keys move across the tab row (with wrapping) — useful once the bar scrolls.
  if (tabsEl) {
    tabsEl.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const d = e.key === "ArrowRight" ? 1 : -1;
      const idx = tabIndex(curTab);
      const nid = TABS[(idx + d + TABS.length) % TABS.length].id;
      if (curTab === "raw" && !applyRaw()) return;
      showTab(nid);
      const btn = tabsEl.querySelector(`.ce-tab[data-t="${nid}"]`);
      if (btn) btn.focus();
    });
  }
  // Scroll cues: show the fade + chevron on each edge that still has off-screen tabs.
  // Repainted on scroll/resize/tab change (and once after open, once fonts settle layout).
  const tabPrev = overlay.querySelector('.ce-tab-nav.prev');
  const tabNext = overlay.querySelector('.ce-tab-nav.next');
  const paintTabNav = () => {
    if (!tabsEl) return;
    const canL = tabsEl.scrollLeft > 4;
    const canR = tabsEl.scrollLeft + tabsEl.clientWidth < tabsEl.scrollWidth - 4;
    if (tabPrev) tabPrev.hidden = !canL;
    if (tabNext) tabNext.hidden = !canR;
  };
  const stepTabNav = (d) => {
    if (!tabsEl) return;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    tabsEl.scrollBy({ left: d * Math.max(120, Math.round(tabsEl.clientWidth * 0.6)), behavior: reduce ? "auto" : "smooth" });
  };
  if (tabsEl) {
    tabsEl.addEventListener("scroll", paintTabNav, { passive: true });
    if (tabPrev) tabPrev.onclick = () => stepTabNav(-1);
    if (tabNext) tabNext.onclick = () => stepTabNav(1);
    if (window.ResizeObserver) {
      // rAF-coalesced (same reason as the Tavern channel strip in discussion.js): cue
      // painting writes layout, and doing it synchronously inside RO delivery trips the
      // browser's "ResizeObserver loop" guard during resize/rotation storms.
      let tabRaf = 0;
      const ro = new ResizeObserver(() => {
        if (tabRaf) return;
        tabRaf = requestAnimationFrame(() => { tabRaf = 0; paintTabNav(); });
      });
      ro.observe(tabsEl);
      const panel = overlay.querySelector(".ce-panel");
      if (panel) ro.observe(panel);
    } else {
      window.addEventListener("resize", paintTabNav);
    }
    requestAnimationFrame(paintTabNav);
    setTimeout(paintTabNav, 300);
  }

  // Validate + persist the editor's current contents into the world store WITHOUT closing the
  // editor. Returns false (and shows the error) when the world can't be saved yet. `doSave` uses it.
  async function saveQuiet() {
    if (curTab === "raw" && !applyRaw()) return false;
    const errs = validateAll();
    if (errs.length) { showErr("✋ " + errs[0]); return false; }
    // Byte limits (not char limits): the catalog record stores UTF-8 bytes, so the save gate
    // measures what the server slot actually holds — emoji/CJK text fills it faster than chars suggest.
    const titleLen = utf8ByteLen(String(M.meta.name || "").trim());
    if (titleLen > 80) { showErr(`✋ Title is ${titleLen}/80 bytes — trim ${titleLen - 80} before saving.`); return false; }
    const descLen = utf8ByteLen(String(M.meta.description || "").trim());
    if (descLen > 800) { showErr(`✋ Description is ${descLen}/800 bytes — trim ${descLen - 800} before saving.`); return false; }
    const { world, errors, warnings } = loadWorld(JSON.stringify(M));
    if (errors.length) { showErr(errors.join(" ")); return false; }
    if (warnings.length) console.warn("[world-editor] warnings:", warnings);
    if (worldStore) {
      M.meta.updatedAt = new Date().toISOString();
      if (!M.meta.createdAt) M.meta.createdAt = M.meta.updatedAt;
      M.lorebook = M.lorebook.map((e) => normalizeLoreEntry(e)).filter(Boolean);
      delete M.loreTriggerWindowTurns;
      try {
        await worldStore.save(M);
      } catch (e) {
        // worldStore.save already throws a friendly low-space sentence — show it as-is.
        showErr("✋ " + (e.message || e));
        return false;
      }
    }
    return true;
  }

  async function doSave() {
    if (!(await saveQuiet())) return;
    notify("💾 World \"" + (M.meta.name || M.meta.id) + "\" saved.");
    detachBeforeUnload();
    release();
    overlay.remove();
    if (onSaved) onSaved();
  }

  let closing = false;
  const close = async () => {
    if (closing) return true; // one confirm at a time — ignore repeats (double-cancel / repeated Escape)
    if (isDirty()) {
      closing = true;
      try {
        const ok = await ConfirmPopup.open({ title: "Discard changes?", message: `Unsaved changes to "${M.meta.name || "this world"}" will be lost.`, confirmText: "Discard", danger: true });
        if (!ok) return false; // declined — keep the editor (and its Back-close entry) open
      } finally {
        closing = false;
      }
    }
    detachBeforeUnload();
    release();
    overlay.remove();
    return true;
  };

  overlay.querySelector(".ce-save").onclick = doSave;
  overlay.querySelector(".ce-cancel").onclick = close;
  overlay.querySelector(".ce-close").onclick = close;
  overlay.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } });

  renderBasics();
}
