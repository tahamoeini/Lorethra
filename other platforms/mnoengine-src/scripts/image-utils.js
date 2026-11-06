// image-utils.js — local-image → avatar helpers shared by the world editor, the NPC detail
// popup, the Hero panel, and the character-creation wizard. Inline portraits (NPC/hero) are
// downscaled and re-encoded as WebP data URLs (JPEG fallback), so they persist inline in
// saves/exports and need no external hosting. Hosted images (world covers, profile avatars)
// use the Blob pipeline below (`fileToWebpBlob` / `blobToWebpBlob` / `dataUrlToWebpBlob`):
// the same pixels, but the encoder hands back a Blob for `uploadPlugin`, so the upload path
// never pays for a base64 string plus an `atob` decode. Every encode strips metadata (EXIF/XMP)
// because only pixels are drawn to the canvas — never the source file's header.
//
// Quality is unified: one WebP quality for every upload/inline encode (covers, avatars, scene
// images). Thumbnails keep their own lower quality (tiny display size).
export const WEBP_QUALITY = 0.82; // unified encode quality (covers + avatars + scene images)
export const JPEG_QUALITY = 0.8; // fallback-encode quality where WebP encoding is unavailable

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // source file size cap (5 MB)
export const AVATAR_MAX_DIM = 512; // longest side after downscale
export const AVATAR_JPEG_QUALITY = WEBP_QUALITY;
export const AVATAR_WEBP_QUALITY = WEBP_QUALITY;
export const AVATAR_MIME = "image/webp";
export const PROFILE_AVATAR_MAX_DIM = 256; // profile avatar longest side (community.js avatarBtn)

// A WORLD COVER is not an avatar: it is shown 580px wide (and a full panel tall when the detail
// popup goes fullscreen), so its cap is 1024 rather than the avatar's 512. It lives here, and not in
// either module that uses it, because the two MUST agree: `world-editor.js` encodes the cover the
// author sees on their own card, and `community.js` re-encodes it for the catalog at publish time — a
// smaller cap there would silently downgrade the published world below the local one (a 832x1216
// upload became 351x512 when the publish side capped at 512).
export const COVER_MAX_DIM = 1024; // longest side after downscale
export const COVER_JPEG_QUALITY = WEBP_QUALITY;
export const COVER_WEBP_QUALITY = WEBP_QUALITY;
export const COVER_MIME = "image/webp";

// WebP with a JPEG fallback: toDataURL with an unsupported type silently returns PNG,
// so the prefix check must be exact, not just `data:image/`.
function canvasToDataUrl(canvas, mime, quality) {
  try {
    const out = canvas.toDataURL(mime, quality);
    if (out && out.startsWith(`data:${mime}`)) return out;
  } catch (e) {}
  if (mime !== "image/jpeg") {
    try {
      const out = canvas.toDataURL("image/jpeg", quality);
      if (out && out.startsWith("data:image/jpeg")) return out;
    } catch (e) {}
  }
  return "";
}

// Encode a cover canvas as WebP, falling back to JPEG on browsers without WebP
// encoding (toDataURL then returns PNG). Covers are uploaded to uploads.dev and
// every display site uses a plain <img>, so either mime renders fine.
export function coverDataUrl(canvas, quality = COVER_WEBP_QUALITY) {
  return canvasToDataUrl(canvas, COVER_MIME, quality)
    || canvas.toDataURL("image/jpeg", COVER_JPEG_QUALITY);
}

/* ---------- hosted-upload Blob pipeline (P0+P1) ---------- */
// Hosted images (world covers, profile avatars) end at `uploadPlugin`, which takes a Blob —
// so they never need a base64 data URL. The old path was File → Image (full-res decode) →
// canvas.drawImage → toDataURL (sync base64, +33%) → atob/decode → Blob → upload: two full
// base64 passes plus a main-thread block. The new path is File/Blob → createImageBitmap
// (off-main-thread decode, EXIF orientation applied) → canvas at target size → toBlob (async,
// binary) → upload. One decode, one encode, no base64 at all. Every encode strips metadata
// because only pixels cross the canvas — the source file's EXIF/XMP header is never copied.
// Per product decision Files are ALWAYS re-encoded to WebP (never passthrough-uploaded),
// so a user photo's location/orientation tags can never leak to the host.
//
// Inline portraits (NPC/hero/wizard data URLs stored in saves) keep the data-URL helpers
// below — their final form must stay a string. Only the hosted paths use these Blob helpers.

// Async canvas → Blob with WebP → JPEG fallback. Resolves null when neither encodes.
export function canvasToBlob(canvas, mime = COVER_MIME, quality = WEBP_QUALITY) {
  return new Promise((resolve) => {
    if (!canvas || !canvas.width || !canvas.height) { resolve(null); return; }
    const tryMime = (m, q, fallback) => {
      try {
        if (typeof canvas.toBlob !== "function") { fallback(); return; }
        canvas.toBlob((b) => {
          if (b && b.size) resolve(b);
          else fallback();
        }, m, q);
      } catch (e) { fallback(); }
    };
    const jpegFallback = () => {
      if (mime === "image/jpeg") {
        // Last resort for ancient browsers without toBlob: sync data URL → binary.
        try {
          const d = canvasToDataUrl(canvas, "image/jpeg", quality);
          if (!d) { resolve(null); return; }
          fetch(d).then((r) => r.blob()).then((b) => resolve(b && b.size ? b : null)).catch(() => resolve(null));
        } catch (e) { resolve(null); }
        return;
      }
      tryMime("image/jpeg", quality, () => {
        try {
          const d = canvasToDataUrl(canvas, "image/jpeg", quality);
          if (!d) { resolve(null); return; }
          fetch(d).then((r) => r.blob()).then((b) => resolve(b && b.size ? b : null)).catch(() => resolve(null));
        } catch (e) { resolve(null); }
      });
    };
    tryMime(mime, quality, jpegFallback);
  });
}

// Decode a Blob to an ImageBitmap with EXIF orientation applied (matches <img> behavior).
// Resolves null when createImageBitmap is unavailable/fails — callers fall back to <img>.
async function decodeBlobToBitmap(blob) {
  if (!blob || typeof createImageBitmap !== "function") return null;
  try {
    return await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch (e) {}
  try {
    return await createImageBitmap(blob);
  } catch (e) {}
  return null;
}

// <img>-element fallback for ancient browsers without createImageBitmap: decode via object URL.
function decodeBlobToImage(blob) {
  return new Promise((resolve, reject) => {
    let url = "";
    try { url = URL.createObjectURL(blob); }
    catch (e) { reject(new Error("Couldn't read that image.")); return; }
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { try { URL.revokeObjectURL(url); } catch (e) {} reject(new Error("Couldn't read that file — is it a valid image?")); };
    img.src = url;
  });
}

// Data-URL → ImageBitmap (off-main-thread decode, EXIF orientation applied). Used by the
// inline data-URL encoders below so saves/exports never block the UI on a full-res <img>
// decode. Falls back to an <img> element where createImageBitmap is unavailable. Callers
// must close() the bitmap when done; the <img> fallback needs no cleanup.
// Rejects when the bytes can't be decoded — inline callers convert that to their own
// fallback value (original image or ""), never a thrown error to the save path.
export async function dataUrlToBitmap(dataUrl) {
  const d = String(dataUrl || "");
  if (!d.startsWith("data:")) throw new Error("Couldn't read that image.");
  let srcBlob = null;
  try { srcBlob = await (await fetch(d)).blob(); }
  catch (e) { srcBlob = null; }
  if (srcBlob && srcBlob.size) {
    try {
      const bmp = await decodeBlobToBitmap(srcBlob);
      if (bmp) return bmp;
    } catch (e) {}
  }
  // Fallback: direct <img> decode of the data URL (same as the old path).
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't read that image."));
    img.src = d;
  });
}

// Intrinsic pixel size of a decoded source (ImageBitmap has .width/.height, <img> has
// .naturalWidth/.naturalHeight) — one accessor so bitmap-first paths stay correct.
function decodedSize(src) {
  const w = (src && (src.naturalWidth || src.width)) || 1;
  const h = (src && (src.naturalHeight || src.height)) || 1;
  return { w: Math.max(1, w), h: Math.max(1, h) };
}
function closeDecoded(src) {
  try { if (src && typeof src.close === "function") src.close(); } catch (e) {}
}

// Core: any image Blob → downscaled WebP Blob (JPEG Blob fallback). ALWAYS re-encodes, so
// metadata is stripped even when the source already fits the cap. Rejects with a
// human-readable message on invalid input (mirrors fileToAvatarDataUrl's wording).
export async function blobToWebpBlob(blob, { maxDim = COVER_MAX_DIM, quality = WEBP_QUALITY } = {}) {
  if (!blob || !(blob.size >= 0) || (blob.type && !String(blob.type).startsWith("image/") && blob.type !== "")) {
    throw new Error("Please choose an image file (png, jpg, webp…).");
  }
  if (!blob.size) throw new Error("Couldn't read that image.");
  let bmp = null;
  try { bmp = await decodeBlobToBitmap(blob); } catch (e) { bmp = null; }
  if (bmp) {
    try {
      const sw = bmp.width || 1, sh = bmp.height || 1;
      const scale = Math.min(1, maxDim / Math.max(sw, sh));
      const w = Math.max(1, Math.round(sw * scale));
      const h = Math.max(1, Math.round(sh * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
      try { bmp.close(); } catch (e) {}
      const out = await canvasToBlob(canvas, COVER_MIME, quality);
      if (out && out.size) return out;
      throw new Error("Couldn't encode that image.");
    } catch (e) {
      try { bmp.close(); } catch (e2) {}
      if (e && e.message === "Couldn't encode that image.") throw e;
      // Fall through to the <img> path below.
    }
  }
  // Fallback path (no createImageBitmap): full decode via <img>, then async Blob encode.
  const img = await decodeBlobToImage(blob);
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(img, 0, 0, w, h);
  const out = await canvasToBlob(canvas, COVER_MIME, quality);
  if (!out || !out.size) throw new Error("Couldn't encode that image.");
  return out;
}

// File → downscaled WebP Blob with type + size validation. Per product decision this ALWAYS
// re-encodes (never uploads the original file), so EXIF/XMP is stripped and the host only
// ever stores WebP (JPEG fallback where WebP encoding is unavailable).
export async function fileToWebpBlob(file, { maxDim = AVATAR_MAX_DIM, maxBytes = AVATAR_MAX_BYTES, quality = WEBP_QUALITY } = {}) {
  if (!file || !file.type || !String(file.type).startsWith("image/")) {
    throw new Error("Please choose an image file (png, jpg, webp…).");
  }
  if (file.size > maxBytes) {
    throw new Error(`That image is too large — please use one under ${Math.round(maxBytes / (1024 * 1024))} MB.`);
  }
  return blobToWebpBlob(file, { maxDim, quality });
}

// Data-URL cover → Blob for upload. Data URLs from the world editor are already canvas-made
// WebPs (no metadata to strip), so a WebP within the cap converts straight to its bytes with
// NO second-generation re-encode (avoids quality loss + wasted work): the bytes are decoded
// from base64 natively via fetch(). Anything else (JPEG/PNG user pastes, oversized WebP) is
// always re-encoded through the canvas, which strips metadata. Never rejects with a lost
// image for the foreign-URL path — callers decide the fallback popup.
export async function dataUrlToWebpBlob(dataUrl, { maxDim = COVER_MAX_DIM, quality = WEBP_QUALITY } = {}) {
  const d = String(dataUrl || "");
  if (!d.startsWith("data:image/")) throw new Error("Couldn't read that cover image.");
  const isWebp = /^data:image\/webp[;,]/i.test(d);
  let srcBlob = null;
  try { srcBlob = await (await fetch(d)).blob(); }
  catch (e) { throw new Error("Couldn't read that cover image."); }
  if (!srcBlob || !srcBlob.size) throw new Error("Couldn't read that cover image.");
  if (isWebp) {
    // Fast lane for our own editor output: check dimensions, skip the re-encode when it fits.
    let bmp = null;
    try { bmp = await decodeBlobToBitmap(srcBlob); } catch (e) { bmp = null; }
    if (bmp) {
      const fits = Math.max(bmp.width || 1, bmp.height || 1) <= maxDim;
      try { bmp.close(); } catch (e) {}
      if (fits) return srcBlob;
      return blobToWebpBlob(srcBlob, { maxDim, quality });
    }
    // No createImageBitmap: fall back to an <img> dimension check (one decode, no encode).
    try {
      const img = await decodeBlobToImage(srcBlob);
      if (Math.max(img.naturalWidth || 1, img.naturalHeight || 1) <= maxDim) return srcBlob;
    } catch (e) {}
  }
  return blobToWebpBlob(srcBlob, { maxDim, quality });
}

/* ---------- scene images ---------- */
// Scene images arrive from the generator as JPEG data URLs (~70-90 KB at 512x768).
// They live inline in the adventure JSON, so every byte is paid on each save write
// and in `.mno-adv` exports. Re-encoding as WebP at native resolution cuts them to
// ~25-35 KB with no visible difference. Never rejects: any failure resolves with the
// original, so an image is never lost over encoding.
export const SCENE_WEBP_QUALITY = WEBP_QUALITY;

export async function sceneImageToWebp(dataUrl, { quality = SCENE_WEBP_QUALITY } = {}) {
  const d = String(dataUrl || "");
  if (!d.startsWith("data:image/")) return d;
  if (d.startsWith("data:image/webp")) return d;
  // Bitmap-first decode (off-main-thread); the encode to a data URL is unchanged, so the
  // stored bytes are identical in form to before — only the decode moved off the UI thread.
  let src = null;
  try {
    src = await dataUrlToBitmap(d);
    const { w, h } = decodedSize(src);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(src, 0, 0);
    closeDecoded(src); src = null;
    return canvasToDataUrl(canvas, "image/webp", quality) || d;
  } catch (e) { closeDecoded(src); return d; }
}

export async function generatedAvatarToWebp(dataUrl, { maxDim = AVATAR_MAX_DIM, quality = AVATAR_WEBP_QUALITY } = {}) {
  const d = String(dataUrl || "");
  if (!d.startsWith("data:image/")) return d;
  let src = null;
  try {
    src = await dataUrlToBitmap(d);
    const nat = decodedSize(src);
    const scale = Math.min(1, maxDim / Math.max(nat.w, nat.h));
    const w = Math.max(1, Math.round(nat.w * scale));
    const h = Math.max(1, Math.round(nat.h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(src, 0, 0, w, h);
    closeDecoded(src); src = null;
    return canvasToDataUrl(canvas, "image/webp", quality) || d;
  } catch (e) { closeDecoded(src); return d; }
}

// Read a local image file, validate type + size, downscale to fit `maxDim` on its longest side,
// and re-encode as a WebP data URL by default (JPEG fallback). Pass `mime` to override.
// Resolves with the data URL; rejects with a human-readable
// message on invalid input.
export async function fileToAvatarDataUrl(file, { maxDim = AVATAR_MAX_DIM, maxBytes = AVATAR_MAX_BYTES, quality = AVATAR_WEBP_QUALITY, mime = AVATAR_MIME } = {}) {
  if (!file || !file.type || !String(file.type).startsWith("image/")) {
    throw new Error("Please choose an image file (png, jpg, webp…).");
  }
  if (file.size > maxBytes) {
    throw new Error(`That image is too large — please use one under ${Math.round(maxBytes / (1024 * 1024))} MB.`);
  }
  // Bitmap-first decode straight from the File (no object URL): the decoder runs off the
  // main thread and EXIF orientation is applied. Falls back to the old <img> path below.
  let src = null;
  try { src = await decodeBlobToBitmap(file); } catch (e) { src = null; }
  if (src) {
    try {
      const nat = decodedSize(src);
      const scale = Math.min(1, maxDim / Math.max(nat.w, nat.h));
      const w = Math.max(1, Math.round(nat.w * scale));
      const h = Math.max(1, Math.round(nat.h * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(src, 0, 0, w, h);
      closeDecoded(src); src = null;
      const dataUrl = canvasToDataUrl(canvas, mime, quality);
      if (!dataUrl) throw new Error("Couldn't encode that image.");
      return dataUrl;
    } catch (e) {
      closeDecoded(src);
      if (e && e.message === "Couldn't encode that image.") throw e;
      throw new Error("Couldn't process that image.");
    }
  }
  // Fallback path (no createImageBitmap): identical to the old implementation.
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvasToDataUrl(canvas, mime, quality);
        if (!dataUrl) { reject(new Error("Couldn't encode that image.")); return; }
        resolve(dataUrl);
      } catch (e) {
        reject(new Error("Couldn't process that image."));
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't read that file — is it a valid image?")); };
    img.src = url;
  });
}

// Open the native file picker (images only) and resolve with the chosen File, or null on cancel.
export function pickImageFile() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => resolve((input.files && input.files[0]) || null);
    input.click();
  });
}

/* ---------- list thumbnails ---------- */
// A tiny copy of an avatar for LISTS. The Adventures page wants a ~52px face on every row, and the real
// avatar is a 60–90 KB data URL living INSIDE the save (`state.character.portrait`) — reading a save per
// row to draw one would be megabytes of IndexedDB for a list. So the session index caches a downscaled
// copy instead (storage.js), and this is what makes it: a canvas re-encode at `maxDim`.
//
// Portraits that aren't image data at all — a bundled path, an https URL, an emoji — are already tiny,
// so they come back exactly as they went in. A portrait that can't be decoded resolves to "" (the caller
// draws its own monogram), never a rejected promise: a thumbnail is never worth failing a save over.
export const THUMB_MAX_DIM = 96;export const THUMB_JPEG_QUALITY = 0.72;
export const THUMB_WEBP_QUALITY = 0.72;
export const THUMB_MIME = "image/webp";

export async function portraitThumb(portrait, { maxDim = THUMB_MAX_DIM, quality = THUMB_WEBP_QUALITY } = {}) {
  const p = String(portrait || "");
  if (!p || !p.startsWith("data:")) return p;
  // Bitmap-first decode (off-main-thread); a thumbnail is never worth failing a save over,
  // so any failure resolves to "" exactly as before.
  let src = null;
  try {
    src = await dataUrlToBitmap(p);
    const nat = decodedSize(src);
    const scale = Math.min(1, maxDim / Math.max(nat.w, nat.h));
    const w = Math.max(1, Math.round(nat.w * scale));
    const h = Math.max(1, Math.round(nat.h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(src, 0, 0, w, h);
    closeDecoded(src); src = null;
    return canvasToDataUrl(canvas, THUMB_MIME, quality);
  } catch (e) { closeDecoded(src); return ""; }
}

// A cheap fingerprint of a portrait string, so a SAVE can tell whether the hero's avatar actually
// changed before spending a canvas decode on it (a save runs every turn; the avatar almost never
// changes). The length plus the head and tail of the string is decisive in practice — a re-encoded
// image differs in all three — and costs nothing to compute on a 70 KB string.
export function portraitSig(portrait) {
  const p = String(portrait || "");
  return p ? `${p.length}:${p.slice(0, 24)}:${p.slice(-16)}` : "";
}

/* ---------- generation timeouts ---------- */
// The text-to-image plugin's awaited promise ONLY settles on a `finished` postMessage from its
// generation iframe — server errors, moderation blocks, network drops, or a removed iframe leave
// it pending FOREVER (no rejection path). Every `await genImage(...)` must therefore go through
// `genImageSafe` (or an equivalent race), or a failed generation spins its button/placeholder
// forever with no message. Same for the AI prompt-writing step (`withTimeout` + existing catch).
export const IMAGE_GEN_TIMEOUT_MS = 60000; // image renders usually land in 10-60s; 60s with no answer is treated as stalled
export const IMAGE_PROMPT_TIMEOUT_MS = 60000; // AI prompt-writing (genText) step
export const SCENE_BG_TIMEOUT_MS = 30000; // portrait backdrop phrase (genText) — falls back silently
export const IMAGE_GEN_RETRIES = 2; // auto-retries per image call (3 attempts total, in-memory only)
export const IMAGE_GEN_RETRY_DELAY_MS = 2000; // breather between attempts so a struggling service isn't hammered

// Race any promise against a timeout. Rejects with `message` on timeout; otherwise passes the
// promise's own settlement through (including its rejection).
export function withTimeout(promise, ms, message) {
  let timer = null;
  const gate = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message || `Timed out after ${Math.round(ms / 1000)}s — try again.`)), ms);
  });
  return Promise.race([Promise.resolve(promise), gate]).then(
    (v) => { if (timer) clearTimeout(timer); return v; },
    (e) => { if (timer) clearTimeout(timer); throw e; }
  );
}

// Await the image plugin with a timeout, and treat an empty result as failure. Resolves with the
// plugin result (which carries `.dataUrl`); throws on missing generator, timeout, rejection, or
// an empty result — callers handle it with their existing try/catch + notify + clearBusy.
//
// Each call auto-retries (3 attempts total by default — a transient stall or blip usually lands
// within them). The retries live entirely in memory, so a page reload never resumes or repeats
// them — reload recovery keeps its current behavior (pending work is dropped, old images kept). Cancel stays
// available throughout: the caller's pending slot can still be cancelled while a retry runs.
export async function genImageSafe(genImageFn, prompt, opts, { timeoutMs = IMAGE_GEN_TIMEOUT_MS, retries = IMAGE_GEN_RETRIES, retryDelayMs = IMAGE_GEN_RETRY_DELAY_MS } = {}) {
  if (typeof genImageFn !== "function") throw new Error("No image generator available.");
  const label = timeoutMs < 1000 ? `${timeoutMs}ms` : `${Math.round(timeoutMs / 1000)}s`;
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await withTimeout(
        Promise.resolve().then(() => genImageFn(prompt, opts)),
        timeoutMs,
        `Image generation timed out after ${label} — try again.`
      );
      if (!r || !r.dataUrl) throw new Error("No image returned — try again.");
      return r;
    } catch (e) {
      lastErr = e;
      if (attempt < retries) {
        console.warn(`Image generation attempt ${attempt + 1} failed, retrying:`, e);
        await new Promise((res) => setTimeout(res, retryDelayMs));
      }
    }
  }
  throw lastErr;
}
