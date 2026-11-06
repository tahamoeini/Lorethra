// image-provider.js — switchable image-AI backend: the Perchance built-in or an
// OpenAI-compatible /images/generations endpoint (OpenAI / OpenRouter) with BYOK.
// Mirrors ai-provider.js: every image call in the app goes through `routedGenImage`
// (same `(prompt, opts) => {dataUrl}` shape as the text-to-image plugin, so the
// existing `genImageSafe` timeout/retry wrapper keeps working unchanged), which reads
// the live config per call — switching takes effect at once, no reload.
//
// Keys are SHARED with Settings → AI Model (`mno.aiProviderKey`, one entry per
// provider id): entering your OpenAI key here also fills it there and vice versa.
// Only the image model/baseUrl/advanced-option choices live in their own store
// (`mno.imageProvider`) because the text side keeps a different model per provider.

import { getAiKeyFor, setAiKeyFor } from "./ai-provider.js";
import { switchEl } from "./search-bar.js";
import { infoTipLabelHtml } from "./info-tip.js";
import { imageGuidance, persistImageGuidance, IMAGE_GUIDANCE_DEFAULT, IMAGE_GUIDANCE_MIN, IMAGE_GUIDANCE_MAX } from "./image-gen-prefs.js";

const CFG_KEY = "mno.imageProvider";
const perchanceGenImage = window.genImage;
window.__perchanceGenImage = window.__perchanceGenImage || perchanceGenImage;

const IMAGE_PROVIDERS = [
  { id: "perchance", label: "Perchance AI" },
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-image-1" },
  { id: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-5-image-mini" },
];

function labelOf(id) {
  return (IMAGE_PROVIDERS.find((p) => p.id === id) || IMAGE_PROVIDERS[0]).label;
}

function getPreset(id) {
  return IMAGE_PROVIDERS.find((p) => p.id === id) || IMAGE_PROVIDERS[0];
}

function readStore() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(CFG_KEY) || "{}") || {}; } catch (e) {}
  const ids = IMAGE_PROVIDERS.map((p) => p.id);
  const provider = ids.includes(s.provider) ? s.provider : "perchance";
  const saved = s.providers && typeof s.providers === "object" ? s.providers : {};
  const providers = {};
  for (const p of IMAGE_PROVIDERS) {
    if (p.id === "perchance") continue;
    const e = saved[p.id] && typeof saved[p.id] === "object" ? saved[p.id] : {};
    const eb = typeof e.baseUrl === "string" ? e.baseUrl.trim().replace(/\/+$/, "") : "";
    const em = typeof e.model === "string" ? e.model.trim() : "";
    providers[p.id] = { baseUrl: eb || p.baseUrl, model: em || p.model, opts: sanitizeImageOpts(e.opts) };
  }
  return { provider, providers, useExternal: sanitizeImageUseExternal(s.useExternal) };
}

// Per-call routing: which image jobs may use the external provider. Every image
// call carries a `route` id (see IMAGE_ROUTE_IDS); the Settings → Image Gen
// toggles decide per route, and anything switched off falls back to Perchance
// AI for that call. Unknown/missing routes ride "other".
export const IMAGE_ROUTE_IDS = ["portraits", "scene", "other"];
export const IMAGE_ROUTE_LABELS = {
  portraits: "Portraits",
  scene: "Scene image",
  other: "Other"
};
export const IMAGE_ROUTE_HINTS = {
  portraits: "Hero + NPC portraits, including the world-editor style preview and NPC avatar generator.",
  scene: "In-story scene illustrations (the 🎨 button + panel).",
  other: "World art: cover images and logos in the world editor."
};

function sanitizeImageUseExternal(v) {
  const o = v && typeof v === "object" ? v : {};
  const out = {};
  for (const id of IMAGE_ROUTE_IDS) out[id] = o[id] !== false;
  return out;
}

// Advanced per-provider options (Settings → Image Gen → Advanced settings).
// Empty string = Default: the parameter is omitted and the provider decides.
const IMG_RESOLUTIONS = ["", "512", "1K", "2K", "4K"];
const IMG_QUALITIES = ["", "auto", "low", "medium", "high", "standard", "hd"];

function sanitizeImageOpts(o) {
  const v = o && typeof o === "object" ? o : {};
  return {
    resolution: IMG_RESOLUTIONS.includes(v.resolution) ? v.resolution : "",
    quality: IMG_QUALITIES.includes(v.quality) ? v.quality : "",
  };
}

function writeStore(store) {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(store)); } catch (e) {}
}

export function getImageConfig() {
  const store = readStore();
  const preset = getPreset(store.provider);
  const entry = store.providers[store.provider] || {};
  return {
    provider: store.provider,
    baseUrl: entry.baseUrl || preset.baseUrl || "",
    model: entry.model || preset.model || "",
    opts: sanitizeImageOpts(entry.opts),
    useExternal: sanitizeImageUseExternal(store.useExternal),
  };
}

export function getImageProviderEntry(id) {
  const store = readStore();
  const preset = getPreset(id);
  const entry = store.providers[id] || {};
  return {
    baseUrl: entry.baseUrl || preset.baseUrl || "",
    model: entry.model || preset.model || "",
    opts: sanitizeImageOpts(entry.opts),
    hasKey: !!getAiKeyFor(id),
  };
}

export function saveImageConfig(cfg, key) {
  const store = readStore();
  const ids = IMAGE_PROVIDERS.map((p) => p.id);
  const provider = ids.includes(cfg.provider) ? cfg.provider : "perchance";
  store.provider = provider;
  if (cfg.useExternal !== undefined) store.useExternal = sanitizeImageUseExternal(Object.assign({}, store.useExternal, cfg.useExternal));
  if (provider !== "perchance") {
    const preset = getPreset(provider);
    const prev = store.providers[provider] || {};
    store.providers[provider] = {
      baseUrl: typeof cfg.baseUrl === "string" && cfg.baseUrl.trim() ? cfg.baseUrl.trim().replace(/\/+$/, "") : prev.baseUrl || preset.baseUrl,
      model: typeof cfg.model === "string" && cfg.model.trim() ? cfg.model.trim() : prev.model || preset.model,
      opts: sanitizeImageOpts(cfg.opts !== undefined ? cfg.opts : prev.opts),
    };
  }
  writeStore(store);
  if (key !== undefined && provider !== "perchance") setAiKeyFor(provider, key || "");
  return getImageConfig();
}

export function activeImageProvider() {
  const c = getImageConfig();
  if (c.provider === "perchance") return "perchance";
  return getAiKeyFor(c.provider) ? c.provider : "perchance";
}

// Per-route variant of the above: true when THIS image job's calls may run on
// the external provider — either no external provider is active, or the job's
// toggle is on. Anything switched off falls back to Perchance AI for that job.
export function imageRouteUsesExternal(route) {
  try {
    if (!IMAGE_ROUTE_IDS.includes(route)) route = "other";
    if (activeImageProvider() === "perchance") return false;
    return getImageConfig().useExternal[route] !== false;
  } catch (e) { return false; }
}

// Close-time gate for the Settings panel (selecting a provider IS using it, so
// a keyless remote choice is saved immediately and only blocks closing).
// Returns null when the stored image config may close, else the details for the
// blocking popup (see guardProviderClose in main.js).
export function imageCloseBlocker() {
  const c = getImageConfig();
  if (c.provider === "perchance") return null;
  if (getAiKeyFor(c.provider)) return null;
  return {
    section: "Image Gen",
    label: labelOf(c.provider),
    message: "Enter an API key for " + labelOf(c.provider) + " (Settings → Image Gen), or switch back to Perchance AI."
  };
}

export function imageModelLabel() {
  const c = getImageConfig();
  const active = activeImageProvider();
  return active === "perchance" ? "Perchance AI" : labelOf(active) + " · " + c.model;
}

// The plugin calls use Perchance resolutions ("512x512", "512x768", "768x512",
// "768x768" …). OpenAI-compatible endpoints want their own sizes, so map by aspect:
// square → 1024x1024 everywhere; portrait/landscape → each family’s tall/wide size.
function aspectOf(resolution) {
  const m = String(resolution || "").match(/(\d+)\s*x\s*(\d+)/i);
  if (!m) return "square";
  const w = +m[1], h = +m[2];
  if (w > h * 1.05) return "landscape";
  if (h > w * 1.05) return "portrait";
  return "square";
}

function sizeFor(model, aspect) {
  const m = String(model || "").toLowerCase();
  if (m.includes("dall-e-2")) return "1024x1024";
  if (m.includes("dall-e-3")) return aspect === "portrait" ? "1024x1792" : aspect === "landscape" ? "1792x1024" : "1024x1024";
  return aspect === "portrait" ? "1024x1536" : aspect === "landscape" ? "1536x1024" : "1024x1024";
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Could not read the generated image."));
    r.readAsDataURL(blob);
  });
}

async function openaiCompatibleGenImage(prompt, opts = {}) {
  const cfg = getImageConfig();
  return cfg.provider === "openrouter"
    ? openRouterGenImage(cfg, prompt, opts)
    : openaiGenImage(cfg, prompt, opts);
}

function openRouterHeaders(key) {
  return {
    "Content-Type": "application/json",
    Authorization: "Bearer " + key,
    "HTTP-Referer": location.origin,
    "X-Title": "MNO RPG ENGINE",
  };
}

function apiError(res, fallback) {
  return res.json().then(
    (j) => new Error("Image API error: " + ((j && j.error && (j.error.message || j.error)) || fallback)),
    () => new Error("Image API error: " + fallback)
  );
}

// Reference-image URLs from call opts (scene-image character refs). Anything
// non-string is dropped — the providers each map the survivors to their own
// input shape, and Perchance ignores them entirely (see routedGenImage).
function refUrls(opts) {
  const r = opts && Array.isArray(opts.referenceImages) ? opts.referenceImages : [];
  return r.filter((u) => typeof u === "string" && u.trim());
}

// The send-time prompt WITHOUT the ref augmentation (scene images pass it as
// `barePrompt` alongside `referenceImages`). When a model rejects the
// references, the fallback retries with this — neither the images nor the
// "Image reference N is …" lines, which would otherwise point at nothing.
function barePrompt(opts, fallback) {
  const b = opts && typeof opts.barePrompt === "string" ? opts.barePrompt.trim() : "";
  return b || fallback;
}

// Request bodies are pure functions of (config, prompt, call opts) — exported so
// tests can assert the exact params without spending a generation.
export function openRouterBody(cfg, prompt, opts = {}) {
  const o = sanitizeImageOpts(cfg.opts);
  const aspect = aspectOf(opts.resolution);
  const body = {
    model: cfg.model,
    prompt: String(prompt || ""),
    aspect_ratio: aspect === "portrait" ? "2:3" : aspect === "landscape" ? "3:2" : "1:1",
  };
  if (o.resolution) body.resolution = o.resolution;
  if (o.quality) body.quality = o.quality;
  if (opts.removeBackground) body.background = "transparent";
  // Character likeness refs (scene images): data URLs are accepted as URLs.
  const refs = refUrls(opts);
  if (refs.length) body.input_references = refs.map((url) => ({ type: "image_url", image_url: { url } }));
  return body;
}

// OpenRouter's dedicated Image API: POST {base}/images. Aspect ratios are the ones
// the catalog actually accepts for image models (providers clamp to their subset).
// Unknown optionals 400 on some models, so they are retried away
// (bare {model, prompt} always works).
async function openRouterGenImage(cfg, prompt, opts = {}) {
  const key = getAiKeyFor("openrouter");
  if (!key) throw new Error("No API key saved for OpenRouter.");
  const url = cfg.baseUrl.replace(/\/+$/, "") + "/images";
  const headers = openRouterHeaders(key);
  const body = openRouterBody(cfg, prompt, opts);
  const post = (b) => fetch(url, { method: "POST", headers, body: JSON.stringify(b) }).catch((e) => {
    throw new Error("Could not reach the image endpoint: " + (e.message || e));
  });
  let res = await post(body);
  if (!res.ok && res.status === 400 && Object.keys(body).length > 2) {
    const retry = await post({ model: body.model, prompt: barePrompt(opts, body.prompt) }).catch(() => null);
    if (retry) res = retry;
  }
  if (!res.ok) throw await apiError(res, res.status + " " + res.statusText);
  let item = null;
  try {
    const j = await res.json();
    item = j && j.data && j.data[0];
  } catch (e) {}
  return itemToDataUrl(item, "openrouter");
}

async function itemToDataUrl(item, provider) {
  if (item && item.b64_json) {
    const mime = item.media_type && String(item.media_type).startsWith("image/") ? item.media_type : "image/png";
    return { dataUrl: `data:${mime};base64,` + item.b64_json, provider };
  }
  if (item && item.url) {
    const imgRes = await fetch(item.url);
    if (!imgRes.ok) throw new Error("Image generated but downloading it failed.");
    return { dataUrl: await blobToDataUrl(await imgRes.blob()), provider };
  }
  throw new Error("No image returned — try again.");
}

export function openaiBody(cfg, prompt, opts = {}) {
  const o = sanitizeImageOpts(cfg.opts);
  const m = String(cfg.model || "").toLowerCase();
  const isDalle2 = m.includes("dall-e-2");
  const isDalle3 = m.includes("dall-e-3");
  const body = {
    model: cfg.model,
    prompt: String(prompt || ""),
    n: 1,
    size: sizeFor(cfg.model, aspectOf(opts.resolution)),
  };
  // response_format is legacy and UNSUPPORTED on GPT image models (always b64) —
  // only DALL-E answers with a temporary URL by default, so only it gets b64_json
  // (which keeps images inline in saves exactly like Perchance ones).
  if (isDalle2 || isDalle3) body.response_format = "b64_json";
  // background is a GPT-image-only param. Avatar/portrait calls ask for cut-outs.
  if (opts.removeBackground && !isDalle2 && !isDalle3) body.background = "transparent";
  // quality: auto/low/medium/high on GPT image models (xhigh/max on the newest),
  // standard/hd on dall-e-3, nothing on dall-e-2.
  if (o.quality && !isDalle2 && (isDalle3 ? o.quality === "standard" || o.quality === "hd" : true)) {
    body.quality = o.quality;
  }
  return body;
}

async function openaiGenImage(cfg, prompt, opts = {}) {
  const refs = refUrls(opts);
  const m = String(cfg.model || "").toLowerCase();
  const isDalle = m.includes("dall-e-2") || m.includes("dall-e-3");
  // GPT-image models take reference images through /images/edits; DALL-E has no
  // usable ref input, so its calls stay on generations with the refs dropped.
  if (refs.length && !isDalle) return openaiEditsGenImage(cfg, prompt, opts, refs);
  return openaiGenerationsGenImage(cfg, prompt, opts);
}

// GPT-image edit call: the reference avatars ride along as image[] parts and the
// prompt's "Image reference N is <Name>" lines bind them to the characters.
// Avatars that won't fetch are dropped, not fatal — one less guide, not a failed
// generation. No refs left means plain generations (same prompt, no images).
async function openaiEditsGenImage(cfg, prompt, opts, refs) {
  const key = getAiKeyFor("openai");
  if (!key) throw new Error("No API key saved for OpenAI.");
  const blobs = (await Promise.all(refs.map(async (u) => {
    try {
      const res = await fetch(u);
      if (!res.ok) return null;
      const b = await res.blob();
      return b && b.size > 0 ? b : null;
    } catch (e) { return null; }
  }))).filter(Boolean);
  if (!blobs.length) return openaiGenerationsGenImage(cfg, barePrompt(opts, prompt), { ...opts, referenceImages: [] });
  const o = sanitizeImageOpts(cfg.opts);
  const form = new FormData();
  blobs.forEach((b, i) => {
    const t = String(b.type || "");
    const ext = t.includes("webp") ? "webp" : (t.includes("jpeg") || t.includes("jpg")) ? "jpg" : "png";
    form.append("image[]", b, `ref${i}.${ext}`);
  });
  form.append("prompt", String(prompt || ""));
  form.append("model", cfg.model);
  form.append("size", sizeFor(cfg.model, aspectOf(opts.resolution)));
  if (o.quality) form.append("quality", o.quality);
  if (opts.removeBackground) form.append("background", "transparent");
  const base = cfg.baseUrl.replace(/\/+$/, "");
  let res;
  try {
    res = await fetch(base + "/images/edits", {
      method: "POST",
      headers: { Authorization: "Bearer " + key },
      body: form,
    });
  } catch (e) {
    throw new Error("Could not reach the image endpoint: " + (e.message || e));
  }
  if (!res.ok) {
    // The model can't take references (or the endpoint isn't there): retry the
    // same generation with neither the images nor their prompt lines. Anything
    // else (auth, rate limits, …) would fail identically, so it throws.
    if (res.status === 400 || res.status === 404) {
      return openaiGenerationsGenImage(cfg, barePrompt(opts, prompt), { ...opts, referenceImages: [] });
    }
    throw await apiError(res, res.status + " " + res.statusText);
  }
  let item = null;
  try {
    const j = await res.json();
    item = j && j.data && j.data[0];
  } catch (e) {}
  const out = await itemToDataUrl(item, "openai");
  out.model = cfg.model;
  return out;
}

async function openaiGenerationsGenImage(cfg, prompt, opts = {}) {
  const key = getAiKeyFor("openai");
  if (!key) throw new Error("No API key saved for OpenAI.");
  const base = cfg.baseUrl.replace(/\/+$/, "");
  const headers = { "Content-Type": "application/json", Authorization: "Bearer " + key };
  const body = openaiBody(cfg, prompt, opts);
  const post = (b) => fetch(base + "/images/generations", {
    method: "POST",
    headers,
    body: JSON.stringify(b),
  });
  const minimal = { model: body.model, prompt: body.prompt, n: 1, size: body.size };
  let res;
  try {
    res = await post(body);
  } catch (e) {
    throw new Error("Could not reach the image endpoint: " + (e.message || e));
  }
  // Shed optionals one layer at a time: an older/specialized model may reject any
  // of them, but the minimal shape is valid for every image model.
  for (const shed of ["response_format", "quality", "background"]) {
    if (!res.ok && res.status === 400 && shed in body) {
      delete body[shed];
      const retry = await post(body).catch(() => null);
      if (retry) res = retry;
    }
  }
  if (!res.ok && res.status === 400) {
    const retry = await post(minimal).catch(() => null);
    if (retry) res = retry;
  }
  if (!res.ok) throw await apiError(res, res.status + " " + res.statusText);
  let item = null;
  try {
    const j = await res.json();
    item = j && j.data && j.data[0];
  } catch (e) {}
  const out = await itemToDataUrl(item, "openai");
  out.model = cfg.model;
  return out;
}

export function routedGenImage(prompt, opts) {
  // Per-route toggle: a call switched off bypasses the external provider and
  // runs on Perchance AI. The `route` id rides on the call opts and is stripped
  // before delegating, so neither backend ever sees it. Unmarked calls ride "other".
  let route = "other";
  let cleanOpts = opts;
  if (opts && typeof opts === "object" && typeof opts.route === "string") {
    route = opts.route;
    cleanOpts = Object.assign({}, opts);
    delete cleanOpts.route;
  }
  if (!IMAGE_ROUTE_IDS.includes(route)) route = "other";
  if (!imageRouteUsesExternal(route)) {
    if (typeof perchanceGenImage !== "function") throw new Error("No image generator available.");
    const o = { ...(cleanOpts || {}) };
    delete o.referenceImages; // no image input on the plugin — refs are external-only
    delete o.barePrompt; // only a fallback for ref-capable providers, meaningless here
    return perchanceGenImage(prompt, o);
  }
  return openaiCompatibleGenImage(prompt, cleanOpts || {});
}

// Free key check (no generation cost, so no spend): OpenAI's model list needs
// auth, while OpenRouter's is public — its dedicated key-info endpoint is used.
export async function testImageConnection(baseUrl, key, provider) {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const url = provider === "openrouter" ? base + "/auth/key" : base + "/models";
  const headers = {};
  if (key) headers.Authorization = "Bearer " + key;
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = location.origin;
    headers["X-Title"] = "MNO RPG ENGINE";
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    let detail = res.status + " " + res.statusText;
    try {
      const j = await res.json();
      if (j && j.error && j.error.message) detail = j.error.message;
    } catch (e) {}
    throw new Error(detail);
  }
  return true;
}

// The Settings → Image Gen controls: provider switch, the Perchance-only guidance
// block, and the remote key/model rows. main.js spreads the returned box's children
// straight into the section (`sec.append(...box.childNodes)`) so every row is a
// direct `.pf-sec` flex item with the same 10px gaps as the AI Model section —
// a wrapper div would swallow them. Same behavior contract as AI Model: every
// control persists immediately (picking the provider IS using it), Test never
// saves. The key field shares AI Model's key map. A keyless remote choice only
// blocks closing the Settings panel (see imageCloseBlocker).
// Guidance follows the DROPDOWN (what is being configured), not the saved provider,
// so picking Perchance AI shows it at once; the slider itself writes live to
// `mno.imageGenPrefs` like before.
export function imageProviderControls(opts = {}) {
  const notify = typeof opts.notify === "function" ? opts.notify : null;
  const box = document.createElement("div");
  // The slider painting lives in this colocated <style> — NOT in styles.css.
  // Range track/thumb pseudo-element rules only take effect from a <style> placed
  // inside the section itself in this app's preview pipeline: the identical
  // selectors in the linked sheet (or a document-level <style>) style the
  // section's elements but leave slider tracks/thumbs browser-default.
  box.innerHTML = `
    <style>
      .pf-img-guide[hidden] { display: none; }
      input[type="range"].mno-range { -webkit-appearance: none; appearance: none; flex: 1; min-width: 0; background: transparent; border: none; height: 18px; padding: 0; margin: 0; cursor: pointer; }
      input[type="range"].mno-range::-webkit-slider-runnable-track { height: 6px; border-radius: 3px; background: #2A2520; border: 1px solid #00000055; }
      input[type="range"].mno-range::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; margin-top: -5px; border-radius: 50%; background: #8B9A6E; border: 1px solid #00000088; box-shadow: 0 1px 4px rgba(0,0,0,.6); cursor: pointer; }
      input[type="range"].mno-range:hover::-webkit-slider-thumb { filter: brightness(1.2); }
      input[type="range"].mno-range:active::-webkit-slider-thumb { filter: brightness(1.3); }
      input[type="range"].mno-range:focus-visible { outline: 1px solid #8B9A6E; outline-offset: 4px; }
      input[type="range"].mno-range::-moz-range-track { height: 6px; border-radius: 3px; background: #2A2520; border: 1px solid #00000055; }
      input[type="range"].mno-range::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: #8B9A6E; border: 1px solid #00000088; box-shadow: 0 1px 4px rgba(0,0,0,.6); cursor: pointer; }
      input[type="range"].mno-range:hover::-moz-range-thumb { filter: brightness(1.2); }
      .pf-img-saved.is-warn { color: var(--warn); }
      .pf-keyrow { flex-wrap: nowrap; align-items: stretch; }
      .pf-keyrow .mini { align-self: stretch; display: inline-flex; align-items: center; justify-content: center; }
      .pf-img-routelist .pf-img-routerow + .pf-img-routerow { margin-top: 12px; }
      .pf-img-routeall { border-bottom: 1px solid var(--border); padding-bottom: 12px; }
      .pf-img-routes > .pf-hint { margin-bottom: 14px; }
    </style>
    <div class="pf-kv"><span class="pf-k">Provider</span><select class="popup-in pf-img-prov" style="max-width:240px"></select></div>
    <div class="pf-kv pf-img-guide"><span class="pf-k">Guidance scale</span><span class="pf-v"><b class="pf-guide-val"></b></span></div>
    <div class="pf-slider-wrap pf-img-guide"><span class="pf-slider-min">${IMAGE_GUIDANCE_MIN}</span><input type="range" class="mno-range pf-guide" min="${IMAGE_GUIDANCE_MIN}" max="${IMAGE_GUIDANCE_MAX}" step="1"><span class="pf-slider-max">${IMAGE_GUIDANCE_MAX}</span></div>
    <p class="pf-hint pf-img-guide">How closely images follow the prompt. Lower is looser and more creative, higher is stricter. Default ${IMAGE_GUIDANCE_DEFAULT}.</p>
    <div class="pf-row pf-img-guide"><button class="mini pf-guide-reset" type="button">Reset to default (${IMAGE_GUIDANCE_DEFAULT})</button></div>
    <div class="pf-img-remote" hidden>
      <div class="pf-kv"><span class="pf-k">Base URL</span></div>
      <input class="popup-in pf-img-base" autocomplete="off" spellcheck="false">
      <div class="pf-ai-keybox">
      <div class="pf-kv"><span class="pf-k">API key</span></div>
      <div class="pf-row pf-keyrow"><input class="popup-in pf-img-key" type="password" placeholder="sk-…" autocomplete="off" spellcheck="false" style="flex:1"><button class="mini pf-img-show" type="button">Show</button><button class="mini pf-img-clear" type="button" title="Delete the saved key for this provider">Clear</button></div>
      <div class="pf-warn">⚠️ Your key is kept only in this browser and is sent only to your endpoint. Never paste it anywhere public.</div>
      <div class="pf-info">🔑 Shared key with AI Model.</div>
      </div>
      <div class="pf-kv"><span class="pf-k">Model</span></div>
      <input class="popup-in pf-img-model" autocomplete="off" spellcheck="false">
      <details class="foldbox pf-img-routes" open>
      <summary>External AI images</summary>
      <p class="pf-hint">Each image job below can use the provider above — or fall back to Perchance AI when switched off. Off is useful when the external model is worse at a job, or to save credits.</p>
      <div class="pf-img-routelist"></div>
      </details>
      <details class="foldbox pf-img-adv">
      <summary>Advanced settings</summary>
      <div class="pf-kv pf-img-resrow" style="border-bottom:none;padding-bottom:0"><span class="pf-k">Resolution</span><select class="popup-in pf-img-res" style="max-width:240px"></select></div>
      <p class="pf-hint pf-img-resrow">OpenRouter resolution tier. Default omits it and the provider decides.</p>
      <div class="pf-kv" style="border-bottom:none;padding-bottom:0"><span class="pf-k">Quality</span><select class="popup-in pf-img-quality" style="max-width:240px"></select></div>
      <p class="pf-hint">Higher costs more and takes longer. Default omits it and the provider decides.</p>
      </details>
      <div class="pf-row" style="border-top:1px solid var(--border);padding-top:9px"><button class="btn pf-img-test" type="button">Test connection</button><span class="pf-note pf-img-status"></span></div>
    </div>
    <div class="pf-row"><span class="pf-note pf-img-saved"></span></div>`;
  const cfg = getImageConfig();
  const provEl = box.querySelector(".pf-img-prov");
  const remoteBox = box.querySelector(".pf-img-remote");
  const guideRows = box.querySelectorAll(".pf-img-guide");
  const resRows = box.querySelectorAll(".pf-img-resrow");
  const baseEl = box.querySelector(".pf-img-base");
  const keyEl = box.querySelector(".pf-img-key");
  const modelEl = box.querySelector(".pf-img-model");
  const resEl = box.querySelector(".pf-img-res");
  const qualityEl = box.querySelector(".pf-img-quality");
  const statusEl = box.querySelector(".pf-img-status");
  const savedEl = box.querySelector(".pf-img-saved");
  const RES_LABELS = { "": "Default", 512: "512", "1K": "1K", "2K": "2K", "4K": "4K" };
  const QUALITY_LABELS = { "": "Default", auto: "auto", low: "low", medium: "medium", high: "high", standard: "standard (dall-e-3)", hd: "hd (dall-e-3)" };
  for (const v of IMG_RESOLUTIONS) {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = RES_LABELS[v] || v;
    resEl.appendChild(o);
  }
  const fillQuality = (providerId) => {
    qualityEl.innerHTML = "";
    // dall-e-2 takes no quality param at all; still show the row so a stored
    // value isn't silently hidden — it just isn't sent (see openaiBody).
    const vals = providerId === "openai"
      ? ["", "auto", "low", "medium", "high", "standard", "hd"]
      : ["", "auto", "low", "medium", "high"];
    for (const v of vals) {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = QUALITY_LABELS[v] || v;
      qualityEl.appendChild(o);
    }
  };
  for (const p of IMAGE_PROVIDERS) {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = p.label;
    provEl.appendChild(o);
  }
  provEl.value = cfg.provider;
  const loadEntry = (id) => {
    const entry = getImageProviderEntry(id);
    baseEl.value = entry.baseUrl;
    modelEl.value = entry.model;
    keyEl.value = "";
    keyEl.placeholder = entry.hasKey ? "•••••••• (saved)" : "sk-…";
    fillQuality(id);
    const o = sanitizeImageOpts(entry.opts);
    resEl.value = o.resolution;
    qualityEl.value = [...qualityEl.options].some((op) => op.value === o.quality) ? o.quality : "";
  };
  // Per-job routing switches (global, not per provider): which image calls may
  // use the external provider above. Anything off falls back to Perchance AI.
  const routesList = box.querySelector(".pf-img-routelist");
  const routeMounts = {};
  const routeSwitches = {};
  const paintRouteSw = (id) => {
    const sw = routeSwitches[id];
    if (!sw || !routeMounts[id]) return;
    sw.paint();
    sw.setLabel(routeMounts[id].dataset.on === "1" ? "On" : "Off");
  };
  for (const id of IMAGE_ROUTE_IDS) {
    const row = document.createElement("div");
    row.className = "pf-row pf-img-routerow";
    row.innerHTML = `<span class="pf-k" style="min-width:130px">${infoTipLabelHtml(IMAGE_ROUTE_LABELS[id], IMAGE_ROUTE_HINTS[id])}</span><span class="pf-v pf-img-routesw"></span>`;
    const mount = row.querySelector(".pf-img-routesw");
    mount.dataset.on = (cfg.useExternal && cfg.useExternal[id] !== false) ? "1" : "";
    const sw = switchEl({
      on: () => mount.dataset.on === "1",
      set: (on) => { mount.dataset.on = on ? "1" : ""; },
      text: mount.dataset.on === "1" ? "On" : "Off",
      plain: true,
      onChange: () => { paintRouteSw(id); imgAllSw.paint(); imgAllSw.setLabel(imgAllOn() ? "On" : "Off"); persist(); }
    });
    mount.appendChild(sw.el);
    routeMounts[id] = mount;
    routeSwitches[id] = sw;
    routesList.appendChild(row);
  }
  // Master "All" switch, prepended above the per-job rows: flips every job at
  // once. Its own state is derived (on only when every job is on) and repaints
  // whenever any single toggle changes.
  const imgAllOn = () => IMAGE_ROUTE_IDS.every((id) => routeMounts[id] && routeMounts[id].dataset.on === "1");
  const allRow = document.createElement("div");
  allRow.className = "pf-row pf-img-routerow pf-img-routeall";
  allRow.innerHTML = `<span class="pf-k" style="min-width:130px">${infoTipLabelHtml("All", "Switch every image job below at once.")}</span><span class="pf-v pf-img-routesw"></span>`;
  const allMount = allRow.querySelector(".pf-img-routesw");
  const imgAllSw = switchEl({
    on: () => imgAllOn(),
    set: (on) => { for (const id of IMAGE_ROUTE_IDS) routeMounts[id].dataset.on = on ? "1" : ""; },
    text: imgAllOn() ? "On" : "Off",
    plain: true,
    onChange: () => { for (const id of IMAGE_ROUTE_IDS) paintRouteSw(id); imgAllSw.paint(); imgAllSw.setLabel(imgAllOn() ? "On" : "Off"); persist(); }
  });
  allMount.appendChild(imgAllSw.el);
  routesList.prepend(allRow);
  const readRoutes = () => {
    const out = {};
    for (const id of IMAGE_ROUTE_IDS) out[id] = !routeMounts[id] || routeMounts[id].dataset.on === "1";
    return out;
  };
  const paint = () => {
    const isPerchance = provEl.value === "perchance";
    const isOpenRouter = provEl.value === "openrouter";
    remoteBox.hidden = isPerchance;
    guideRows.forEach((el) => { el.hidden = !isPerchance; });
    resRows.forEach((el) => { el.hidden = !isOpenRouter; });
    if (!statusEl.dataset.touched) {
      const entry = getImageProviderEntry(provEl.value);
      statusEl.textContent = !isPerchance && !entry.hasKey && !keyEl.value.trim() ? "No key saved yet." : "";
    }
  };
  const refreshUsingLine = (next) => {
    // The line only exists for the fallback warning — a healthy selection needs
    // no commentary (the dropdown itself shows what is active).
    const fallback = next.provider !== "perchance" && !getAiKeyFor(next.provider);
    if (fallback) {
      savedEl.textContent = "⚠️ Using Perchance AI for now — enter a key to use " + labelOf(next.provider) + ".";
    } else {
      savedEl.textContent = "";
    }
    savedEl.classList.toggle("is-warn", fallback);
  };
  // Every control writes straight through: picking the provider IS using it, and
  // every field/select persists on input — no Save step. A keyless remote choice
  // is saved as-is and only blocks closing (see imageCloseBlocker).
  const persist = () => {
    const typedKey = keyEl.value.trim();
    const next = saveImageConfig({
      provider: provEl.value,
      baseUrl: baseEl.value,
      model: modelEl.value,
      opts: { resolution: resEl.value, quality: qualityEl.value },
      useExternal: readRoutes(),
    }, typedKey ? typedKey : undefined);
    refreshUsingLine(next);
    try { window.dispatchEvent(new Event("mno:imagegen-changed")); } catch (e) {}
    paint();
  };
  provEl.onchange = () => {
    loadEntry(provEl.value);
    statusEl.dataset.touched = "";
    statusEl.textContent = "";
    persist();
  };
  for (const el of [baseEl, modelEl]) el.addEventListener("input", persist);
  keyEl.addEventListener("input", persist);
  resEl.onchange = persist;
  qualityEl.onchange = persist;
  loadEntry(cfg.provider);
  paint();
  refreshUsingLine(getImageConfig());
  const slider = box.querySelector(".pf-guide");
  const guideVal = box.querySelector(".pf-guide-val");
  slider.value = imageGuidance();
  guideVal.textContent = slider.value;
  slider.addEventListener("input", () => {
    guideVal.textContent = slider.value;
    persistImageGuidance(slider.value);
  });
  slider.addEventListener("change", () => {
    slider.value = imageGuidance();
    guideVal.textContent = slider.value;
  });
  box.querySelector(".pf-guide-reset").onclick = () => {
    persistImageGuidance(IMAGE_GUIDANCE_DEFAULT);
    slider.value = imageGuidance();
    guideVal.textContent = slider.value;
    if (notify) notify("Guidance scale reset to " + IMAGE_GUIDANCE_DEFAULT + ".");
  };
  box.querySelector(".pf-img-show").onclick = (e) => {
    const show = keyEl.type === "password";
    keyEl.type = show ? "text" : "password";
    e.target.textContent = show ? "Hide" : "Show";
  };
  box.querySelector(".pf-img-clear").onclick = () => {
    keyEl.value = "";
    keyEl.placeholder = "sk-…";
    statusEl.dataset.touched = "";
    const next = saveImageConfig({
      provider: provEl.value,
      baseUrl: baseEl.value,
      model: modelEl.value,
      opts: { resolution: resEl.value, quality: qualityEl.value },
      useExternal: readRoutes(),
    }, ""); // "" deletes the stored key for this provider
    refreshUsingLine(next);
    try { window.dispatchEvent(new Event("mno:imagegen-changed")); } catch (e) {}
    paint();
  };
  box.querySelector(".pf-img-test").onclick = async (e) => {
    const btn = e.target;
    btn.disabled = true;
    statusEl.dataset.touched = "1";
    statusEl.textContent = "Testing…";
    try {
      const key = keyEl.value.trim() || (getImageProviderEntry(provEl.value).hasKey ? getAiKeyFor(provEl.value) : "");
      if (!key) throw new Error("Enter an API key first.");
      await testImageConnection(baseEl.value.trim(), key, provEl.value);
      statusEl.textContent = "✓ Connected — key is valid.";
    } catch (err) {
      statusEl.textContent = "✖ " + (err.message || err);
    }
    btn.disabled = false;
  };
  return box;
}
