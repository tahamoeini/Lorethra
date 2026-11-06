import { switchEl } from "./search-bar.js";
import { infoTipLabelHtml } from "./info-tip.js";

const CFG_KEY = "mno.aiProvider";
const KEY_KEY = "mno.aiProviderKey";
const perchanceGenText = window.genText;
window.__perchanceGenText = window.__perchanceGenText || perchanceGenText;

const PROVIDERS = [
  { id: "perchance", label: "Perchance AI" },
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  { id: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "openrouter/auto" },
  { id: "ollama", label: "Ollama (local)", baseUrl: "http://localhost:11434/v1", model: "llama3.1", noKey: true }
];

function getProvider(id) {
  return PROVIDERS.find((p) => p.id === id) || PROVIDERS[0];
}

function readStore() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(CFG_KEY) || "{}") || {}; } catch (e) {}
  const ids = PROVIDERS.map((p) => p.id);
  const provider = ids.includes(s.provider) ? s.provider : "perchance";
  const saved = s.providers && typeof s.providers === "object" ? s.providers : {};
  const legacyBase = typeof s.baseUrl === "string" ? s.baseUrl.trim().replace(/\/+$/, "") : "";
  const legacyModel = typeof s.model === "string" ? s.model.trim() : "";
  const providers = {};
  for (const p of PROVIDERS) {
    if (p.id === "perchance") continue;
    const e = saved[p.id] && typeof saved[p.id] === "object" ? saved[p.id] : {};
    const eb = typeof e.baseUrl === "string" ? e.baseUrl.trim().replace(/\/+$/, "") : "";
    const em = typeof e.model === "string" ? e.model.trim() : "";
    providers[p.id] = {
      baseUrl: eb || (p.id === provider && legacyBase) || p.baseUrl,
      model: em || (p.id === provider && legacyModel) || p.model
    };
    providers[p.id].sampling = sanitizeSampling(e.sampling, p.id);
  }
  return { provider, allowReasoning: s.allowReasoning === true, thinkingBudget: sanitizeBudget(s.thinkingBudget), customParams: s.customParams === true, useExternal: sanitizeUseExternal(s.useExternal), providers };
}

function sanitizeBudget(v) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return 256;
  return Math.min(128000, Math.max(1, n));
}

// Per-call routing: which jobs may use the external provider. Every text-AI
// call carries a `route` id (see AI_ROUTE_IDS); the Settings → AI Model
// toggles decide per route, and anything switched off falls back to Perchance
// AI for that call. Unknown/missing routes ride "other".
export const AI_ROUTE_IDS = ["gm", "check", "tracker", "npc", "scene", "memory", "npclife", "other"];
export const AI_ROUTE_LABELS = {
  gm: "GM",
  check: "Skill checks",
  tracker: "Trackers",
  npc: "NPC generation",
  scene: "Scene image prompt",
  memory: "Memories",
  npclife: "NPC life sim",
  other: "Other"
};
export const AI_ROUTE_HINTS = {
  gm: "Story narration and dialogues.",
  check: "Stat-based check referee before GM call.",
  tracker: "Hero + NPC tracker updates after each turn.",
  npc: "In-session NPC profiles and portrait backdrops.",
  scene: "Scene-image prompt writer.",
  memory: "Session memory roll-ups (the digest written every few turns).",
  npclife: "Off-screen NPC life simulation ticks.",
  other: "Everything else: map, hero creation, world editor + crafting, imports."
};

function sanitizeUseExternal(v) {
  const o = v && typeof v === "object" ? v : {};
  const out = {};
  for (const id of AI_ROUTE_IDS) out[id] = o[id] !== false;
  return out;
}

// Sampling sliders (Settings → AI Model → Advanced). Stored on every custom
// provider's entry; Perchance AI has none. Defaults match each provider's own
// API defaults, so untouched sliders behave exactly like before.
const SAMP_LIMITS = {
  temperature: [0, 2],
  top_p: [0, 1],
  top_k: [0, 100],
  repeatPenalty: [1, 2]
};

function sampDefaultsFor(pid) {
  if (pid === "ollama") return { temperature: 0.8, top_p: 0.9, top_k: 40, repeatPenalty: 1.1 };
  return { temperature: 1, top_p: 1, top_k: 0, repeatPenalty: 1 };
}

function sanitizeSampNum(v, key, pid) {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return sampDefaultsFor(pid)[key];
  const [lo, hi] = SAMP_LIMITS[key];
  const c = Math.min(hi, Math.max(lo, n));
  return key === "top_k" ? Math.round(c) : Math.round(c * 100) / 100;
}

function sanitizeSampling(s, pid) {
  const o = s && typeof s === "object" ? s : {};
  return {
    temperature: sanitizeSampNum(o.temperature, "temperature", pid),
    top_p: sanitizeSampNum(o.top_p, "top_p", pid),
    top_k: sanitizeSampNum(o.top_k, "top_k", pid),
    repeatPenalty: sanitizeSampNum(o.repeatPenalty, "repeatPenalty", pid)
  };
}

// Extra chat-completions body fields for `provider`'s sampling sliders. Only
// sends params the provider accepts (OpenAI/DeepSeek reject unknown fields):
// temperature/top-p go everywhere; top-k only to Ollama + OpenRouter;
// repeat penalty is native repetition_penalty on Ollama/OpenRouter and maps to
// frequency_penalty (minus one) on OpenAI/DeepSeek. Untouched sliders equal
// each API's own defaults, so nothing changes until the user moves one.
export function samplingParams(provider, sampling) {
  const s = sanitizeSampling(sampling, provider);
  const b = { temperature: s.temperature, top_p: s.top_p };
  if (provider === "ollama") {
    b.options = {
      temperature: s.temperature,
      top_p: s.top_p,
      top_k: s.top_k,
      repeat_penalty: s.repeatPenalty
    };
  } else if (provider === "openrouter") {
    if (s.top_k > 0) b.top_k = s.top_k;
    if (s.repeatPenalty !== 1) b.repetition_penalty = s.repeatPenalty;
  } else if (provider === "openai" || provider === "deepseek") {
    if (s.repeatPenalty !== 1) b.frequency_penalty = Math.round((s.repeatPenalty - 1) * 100) / 100;
  }
  return b;
}

function writeStore(store) {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(store)); } catch (e) {}
}

function readKeys() {
  let raw = "";
  try { raw = localStorage.getItem(KEY_KEY) || ""; } catch (e) {}
  if (raw.trim().startsWith("{")) {
    try {
      const j = JSON.parse(raw) || {};
      const out = {};
      for (const p of PROVIDERS) {
        if (p.id !== "perchance" && typeof j[p.id] === "string" && j[p.id]) out[p.id] = j[p.id];
      }
      return out;
    } catch (e) {}
  }
  if (raw && readStore().provider === "openai") return { openai: raw };
  return {};
}

function writeKeys(map) {
  try {
    const ids = Object.keys(map || {}).filter((k) => map[k]);
    if (!ids.length) localStorage.removeItem(KEY_KEY);
    else localStorage.setItem(KEY_KEY, JSON.stringify(map));
  } catch (e) {}
}

export function getAiConfig() {
  const store = readStore();
  const preset = getProvider(store.provider);
  const entry = store.providers[store.provider] || {};
  const cfg = {
    provider: store.provider,
    baseUrl: entry.baseUrl || preset.baseUrl || "",
    model: entry.model || preset.model || "",
    allowReasoning: store.allowReasoning,
    thinkingBudget: store.thinkingBudget,
    customParams: store.customParams === true,
    useExternal: sanitizeUseExternal(store.useExternal)
  };
  if (store.provider === "ollama") cfg.sampling = sanitizeSampling(entry.sampling, "ollama");
  else if (store.provider !== "perchance") cfg.sampling = sanitizeSampling(entry.sampling, store.provider);
  return cfg;
}

export function getAiKey() {
  return readKeys()[readStore().provider] || "";
}

export function getAiKeyFor(id) {
  return readKeys()[id] || "";
}

// Shared-key writer for the image provider (Settings → Image Gen keeps its own
// model/baseUrl store but the same per-provider key map, so one key serves both).
export function setAiKeyFor(id, key) {
  const keys = readKeys();
  if (key) keys[id] = key;
  else delete keys[id];
  writeKeys(keys);
}

export function getProviderEntry(id) {
  const store = readStore();
  const preset = getProvider(id);
  const entry = store.providers[id] || {};
  const out = {
    baseUrl: entry.baseUrl || preset.baseUrl || "",
    model: entry.model || preset.model || "",
    hasKey: !!readKeys()[id],
    noKey: !!preset.noKey
  };
  if (id === "ollama") out.sampling = sanitizeSampling(entry.sampling, "ollama");
  else if (id !== "perchance") out.sampling = sanitizeSampling(entry.sampling, id);
  return out;
}

export function saveAiConfig(cfg, key) {
  const store = readStore();
  const ids = PROVIDERS.map((p) => p.id);
  const provider = cfg.provider === undefined ? store.provider : (ids.includes(cfg.provider) ? cfg.provider : "perchance");
  store.provider = provider;
  store.allowReasoning = !!cfg.allowReasoning;
  if (cfg.useExternal !== undefined) store.useExternal = sanitizeUseExternal(Object.assign({}, store.useExternal, cfg.useExternal));
  if (cfg.customParams !== undefined) store.customParams = !!cfg.customParams;
  if (cfg.thinkingBudget !== undefined) store.thinkingBudget = sanitizeBudget(cfg.thinkingBudget);
  if (provider !== "perchance") {
    const preset = getProvider(provider);
    const prev = store.providers[provider] || {};
    store.providers[provider] = {
      baseUrl: typeof cfg.baseUrl === "string" && cfg.baseUrl.trim() ? cfg.baseUrl.trim().replace(/\/+$/, "") : prev.baseUrl || preset.baseUrl,
      model: typeof cfg.model === "string" && cfg.model.trim() ? cfg.model.trim() : prev.model || preset.model
    };
    if (provider === "ollama") {
      store.providers[provider].sampling = sanitizeSampling(cfg.sampling !== undefined ? cfg.sampling : prev.sampling, "ollama");
    } else {
      store.providers[provider].sampling = sanitizeSampling(cfg.sampling !== undefined ? cfg.sampling : prev.sampling, provider);
    }
  }
  writeStore(store);
  if (key !== undefined && provider !== "perchance") {
    const keys = readKeys();
    if (key) keys[provider] = key;
    else delete keys[provider];
    writeKeys(keys);
  }
  return getAiConfig();
}

export function aiActiveProvider() {
  const c = getAiConfig();
  if (c.provider === "perchance") return "perchance";
  if (getAiKey()) return c.provider;
  return getProvider(c.provider).noKey ? c.provider : "perchance";
}

// Cheap bool for engine-side budget switches (roll-up chunking, etc.): false ONLY when an
// external provider is confidently active (big windows — don't multiply calls). True on
// Perchance AI and whenever the config can't be read (fail safe: Perchance is the default
// provider, and its small window is the conservative assumption).
export function isPerchanceAI() {
  try { return aiActiveProvider() === "perchance"; } catch (e) { return true; }
}

// Per-route variant of the above: true when THIS route's calls will run on
// Perchance AI — either because no external provider is active, or because
// the route's toggle is off. GM trimming, memory/lore caps and tracker output
// caps read this (not the global), so a route switched back to Perchance gets
// Perchance-sized budgets even while other routes stay external.
export function routeUsesExternal(route) {
  try {
    if (!AI_ROUTE_IDS.includes(route)) route = "other";
    if (aiActiveProvider() === "perchance") return false;
    return getAiConfig().useExternal[route] !== false;
  } catch (e) { return false; }
}

export function isPerchanceAIFor(route) {
  try { return !routeUsesExternal(route); } catch (e) { return true; }
}

// Close-time gate for the Settings panel (selecting a provider IS using it, so
// a keyless remote choice is saved immediately and only blocks closing).
// Returns null when the stored AI config may close, else the details for the
// blocking popup (see guardProviderClose in main.js).
export function aiCloseBlocker() {
  const c = getAiConfig();
  if (c.provider === "perchance") return null;
  const preset = getProvider(c.provider);
  if (preset.noKey) return null;
  if (getAiKey()) return null;
  return {
    section: "AI Model",
    label: preset.label,
    message: "Enter an API key for " + preset.label + " (Settings → AI Model), or switch back to Perchance AI."
  };
}

export function aiModelLabel() {
  const c = getAiConfig();
  const active = aiActiveProvider();
  return active === "perchance" ? "Perchance AI" : getProvider(active).label + " · " + c.model;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Could not read attached image."));
    r.readAsDataURL(blob);
  });
}

function normalizeInput(inputData, extraOpts) {
  if (typeof inputData === "string" || inputData instanceof String) {
    const o = { instruction: inputData + "" };
    if (extraOpts) for (const k of ["startWith", "stopSequences", "hideStartWith", "onChunk", "onStart", "onFinish"]) {
      if (extraOpts[k] !== undefined) o[k] = extraOpts[k];
    }
    return o;
  }
  const o = Object.assign({}, inputData || {});
  if (typeof o.instruction !== "string" && !Array.isArray(o.instruction)) o.instruction = "Write something.";
  return o;
}

async function instructionToContent(instruction) {
  if (!Array.isArray(instruction)) return String(instruction ?? "");
  const texts = [];
  const images = [];
  for (const p of instruction) {
    if (typeof Blob !== "undefined" && p instanceof Blob) images.push(await blobToDataUrl(p));
    else texts.push(String(p ?? ""));
  }
  if (!images.length) return texts.join("");
  const content = [];
  if (texts.join("").trim()) content.push({ type: "text", text: texts.join("") });
  for (const url of images) content.push({ type: "image_url", image_url: { url } });
  return content;
}

// Cap the completion length from the call's `maxTokens` (see call table in the
// README). The plugin reads the same option, so behaviour matches Perchance AI.
function maxTokensFor(norm) {
  const n = parseInt(norm && norm.maxTokens, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.min(128000, Math.max(1, n));
}

function openaiGenText(norm) {
  const cfg = getAiConfig();
  const preset = getProvider(cfg.provider);
  const key = getAiKey();
  if (!key && !preset.noKey) throw new Error("No API key saved for " + preset.label + ".");
  const headers = { "Content-Type": "application/json" };
  if (key) headers.Authorization = "Bearer " + key;
  else if (preset.noKey) headers.Authorization = "Bearer ollama";
  if (cfg.provider === "openrouter") {
    headers["HTTP-Referer"] = location.origin;
    headers["X-Title"] = "MNO RPG ENGINE";
  }
  const ctrl = new AbortController();
  let activeReader = null;
  const startWith = typeof norm.startWith === "string" ? norm.startWith : "";
  const prefix = startWith && !norm.hideStartWith ? startWith : "";
  let acc = prefix;
  let generated = "";
  const finishData = () => {
    const out = new String(acc);
    out.text = acc;
    out.generatedText = generated;
    return out;
  };
  const fire = (textChunk) => {
    if (norm.onChunk) {
      try { norm.onChunk({ fullTextSoFar: acc, textChunk }); } catch (e) { console.error("Error in onChunk:", e); }
    }
  };
  const p = (async () => {
    if (norm.onStart) {
      try { norm.onStart(p); } catch (e) { console.error(e); }
    }
    if (prefix) fire(prefix);
    const userContent = await instructionToContent(norm.instruction);
    const messages = [{ role: "user", content: userContent }];
    if (startWith) messages.push({ role: "assistant", content: startWith });
    const body = { model: cfg.model, messages, stream: true };
    const cap = maxTokensFor(norm);
    if (cap > 0) body.max_tokens = cap;
    if (Array.isArray(norm.stopSequences) && norm.stopSequences.length) body.stop = norm.stopSequences.slice(0, 4);
    else if (typeof norm.stopSequences === "string" && norm.stopSequences) body.stop = [norm.stopSequences];
    if (cfg.provider === "openrouter") {
      if (cfg.allowReasoning) body.reasoning = { max_tokens: cfg.thinkingBudget, exclude: true };
      else body.reasoning = { enabled: false, exclude: true };
    }
    if (cfg.provider === "ollama" && !cfg.allowReasoning) {
      // Thinking models (qwen3, deepseek-r1, gpt-oss, ...) think by default and
      // stream the thinking as content. Disable it: `think` is the native
      // Ollama flag (works on /v1/chat/completions even though current docs
      // only list it for /v1/responses), `reasoning_effort` / `reasoning.effort`
      // is the documented OpenAI-compat way ("none" -> think off).
      // Send all three for max compat across Ollama versions.
      body.think = false;
      body.reasoning_effort = "none";
      body.reasoning = { effort: "none" };
    }
    // Sampling sliders (Settings → AI Model → Advanced): per-provider params, see
    // samplingParams(). Only sent when Custom parameters is on — otherwise the
    // provider's own defaults apply untouched.
    if (cfg.provider !== "perchance" && cfg.customParams === true) Object.assign(body, samplingParams(cfg.provider, cfg.sampling));
    const post = (b) => fetch(cfg.baseUrl + "/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify(b),
      signal: ctrl.signal
    });
    let res;
    try {
      res = await post(body);
    } catch (e) {
      if (e && e.name === "AbortError") return finishData();
      let hint = e.message || e;
      if (/localhost|127\.0\.0\.1/.test(cfg.baseUrl)) hint += " (Ollama: is it running, does OLLAMA_ORIGINS allow this page, and is mixed http/https content blocked?)";
      throw new Error("Could not reach the API endpoint: " + hint);
    }
    if (!res.ok && res.status === 400 && (body.reasoning || body.think !== undefined || body.reasoning_effort)) {
      const b2 = Object.assign({}, body);
      delete b2.reasoning;
      delete b2.think;
      delete b2.reasoning_effort;
      const r2 = await post(b2).catch(() => null);
      if (r2) res = r2;
    }
    const ctype = res.headers.get("content-type") || "";
    if (ctype.includes("application/json")) {
      const j = await res.json();
      const txt = j && j.choices && j.choices[0] && j.choices[0].message ? String(j.choices[0].message.content || "") : "";
      if (txt) { generated += txt; acc += txt; fire(txt); }
    } else {
      const reader = res.body.getReader();
      activeReader = reader;
      const dec = new TextDecoder();
      let buf = "";
      const STALL_MS = 90000;
      const ABS_MS = 300000;
      const startAt = Date.now();
      const stall = Symbol("stall");
      let stalled = false;
      let streamDone = false;
      for (;;) {
        let chunk;
        try {
          chunk = await Promise.race([
            reader.read(),
            new Promise((_, rej) => setTimeout(() => rej(stall), STALL_MS))
          ]);
        } catch (e) {
          if (e === stall || (e && e.name === "AbortError")) {
            stalled = stalled || e === stall;
            try { Promise.resolve(reader.cancel()).catch(() => {}); } catch (e2) {}
            break;
          }
          throw e;
        }
        const { done, value } = chunk;
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop();
        for (const ev of events) {
          for (const line of ev.split("\n")) {
            const t = line.trim();
            if (!t.startsWith("data:")) continue;
            const payload = t.slice(5).trim();
            if (payload === "[DONE]") { streamDone = true; break; }
            let j = null;
            try { j = JSON.parse(payload); } catch (e) { continue; }
            const piece = j && j.choices && j.choices[0] && j.choices[0].delta ? j.choices[0].delta.content : "";
            if (piece) { generated += piece; acc += piece; fire(piece); }
          }
          if (streamDone) break;
        }
        if (streamDone) break;
        if (Date.now() - startAt > ABS_MS) {
          try { Promise.resolve(reader.cancel()).catch(() => {}); } catch (e) {}
          break;
        }
      }
      if (stalled && !generated && !prefix) throw new Error("The model stopped responding mid-reply (no data for 90s).");
    }
    if (!res.ok) {
      let detail = res.status + " " + res.statusText;
      try {
        const j = await res.json();
        if (j && j.error && j.error.message) detail = j.error.message;
      } catch (e) {}
      throw new Error("API error: " + detail);
    }
    const out = finishData();
    if (norm.onFinish) {
      try { norm.onFinish(out); } catch (e) { console.error("error in onFinish:", e); }
    }
    return out;
  })();
  p.stop = () => {
    try { ctrl.abort(); } catch (e) {}
    try { if (activeReader) Promise.resolve(activeReader.cancel()).catch(() => {}); } catch (e) {}
    return p;
  };
  return p;
}

export function routedGenText(inputData, extraOpts) {
  if (inputData && typeof inputData === "object" && inputData.getMetaObject === true) {
    return perchanceGenText(inputData, extraOpts);
  }
  // Per-route toggle: a call switched off bypasses the external provider and
  // runs on Perchance AI. The `route` id rides on the call object (or
  // extraOpts for string calls) and is stripped before delegating, so neither
  // backend ever sees it. Unmarked calls ride "other".
  let route = "other";
  if (extraOpts && typeof extraOpts === "object" && typeof extraOpts.route === "string") route = extraOpts.route;
  const plainObj = inputData && typeof inputData === "object" && !Array.isArray(inputData) && !(inputData instanceof String);
  if (plainObj && typeof inputData.route === "string") route = inputData.route;
  if (!AI_ROUTE_IDS.includes(route)) route = "other";
  let cleanInput = inputData, cleanExtra = extraOpts;
  if (plainObj && ("route" in inputData)) { cleanInput = Object.assign({}, inputData); delete cleanInput.route; }
  if (extraOpts && typeof extraOpts === "object" && ("route" in extraOpts)) { cleanExtra = Object.assign({}, extraOpts); delete cleanExtra.route; }
  if (!routeUsesExternal(route)) return perchanceGenText(cleanInput, cleanExtra);
  return openaiGenText(normalizeInput(cleanInput, cleanExtra));
}

export async function testAiConnection(baseUrl, model, key, provider, sampling) {
  const headers = { "Content-Type": "application/json" };
  if (key) headers.Authorization = "Bearer " + key;
  else if (getProvider(provider).noKey) headers.Authorization = "Bearer ollama";
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = location.origin;
    headers["X-Title"] = "MNO RPG ENGINE";
  }
  const testBody = { model, messages: [{ role: "user", content: "Reply with exactly: OK" }], max_tokens: 5, stream: false };
  if (provider === "ollama") {
    testBody.think = false;
    testBody.reasoning_effort = "none";
    testBody.reasoning = { effort: "none" };
  }
  if (provider !== "perchance" && sampling !== undefined) Object.assign(testBody, samplingParams(provider, sampling));
  const res = await fetch(String(baseUrl || "").replace(/\/+$/, "") + "/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify(testBody)
  });
  if (!res.ok) {
    let detail = res.status + " " + res.statusText;
    try {
      const j = await res.json();
      if (j && j.error && j.error.message) detail = j.error.message;
    } catch (e) {}
    throw new Error(detail);
  }
  const j = await res.json();
  const txt = j && j.choices && j.choices[0] && j.choices[0].message ? String(j.choices[0].message.content || "").trim() : "";
  return txt || "OK";
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function aiModelSection() {
  const sec = document.createElement("section");
  sec.className = "pf-sec";
  const cfg = getAiConfig();
  sec.innerHTML = `
    <style>
      input[type="range"].mno-range { -webkit-appearance: none; appearance: none; flex: 1; min-width: 0; background: transparent; border: none; height: 18px; padding: 0; margin: 0; cursor: pointer; }
      input[type="range"].mno-range::-webkit-slider-runnable-track { height: 6px; border-radius: 3px; background: #2A2520; border: 1px solid #00000055; }
      input[type="range"].mno-range::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; margin-top: -5px; border-radius: 50%; background: #8B9A6E; border: 1px solid #00000088; box-shadow: 0 1px 4px rgba(0,0,0,.6); cursor: pointer; }
      input[type="range"].mno-range:hover::-webkit-slider-thumb { filter: brightness(1.2); }
      input[type="range"].mno-range:active::-webkit-slider-thumb { filter: brightness(1.3); }
      input[type="range"].mno-range:focus-visible { outline: 1px solid #8B9A6E; outline-offset: 4px; }
      input[type="range"].mno-range::-moz-range-track { height: 6px; border-radius: 3px; background: #2A2520; border: 1px solid #00000055; }
      input[type="range"].mno-range::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: #8B9A6E; border: 1px solid #00000088; box-shadow: 0 1px 4px rgba(0,0,0,.6); cursor: pointer; }
      input[type="range"].mno-range:hover::-moz-range-thumb { filter: brightness(1.2); }
      .pf-samp-val { color: var(--accent); font-variant-numeric: tabular-nums; }
      .pf-ai-sampoff { opacity: .45; }
      .pf-ai-sampoff input, .pf-ai-sampoff button { pointer-events: none; }
      .pf-ai-saved.is-warn { color: var(--warn); }
      .pf-ai-routelist .pf-ai-routerow + .pf-ai-routerow { margin-top: 12px; }
      .pf-ai-routeall { border-bottom: 1px solid var(--border); padding-bottom: 12px; }
      .pf-ai-routes > .pf-hint { margin-bottom: 14px; }
      .pf-ai-provrow.nosep { border-bottom: none; padding-bottom: 0; }
      .pf-keyrow { flex-wrap: nowrap; align-items: stretch; }
      .pf-keyrow .mini { align-self: stretch; display: inline-flex; align-items: center; justify-content: center; }
    </style>
    <h3 class="pf-sec-title">AI Model</h3>
    <p class="pf-hint">Choose AI model provider. The Perchance AI model just works. It's free but has a small, limited context window.</p>
    <div class="pf-kv pf-ai-provrow"><span class="pf-k">Provider</span><select class="popup-in pf-ai-prov" style="max-width:240px"></select></div>    <div class="pf-hint pf-ai-ollama" hidden>Ollama is a local model on your own machine: <a href="https://ollama.com" target="_blank" rel="noopener">https://ollama.com</a><br>Use <b>ngrok</b> or <b>cloudflare tunnel</b> to serve https.</div>
    <div class="pf-ai-remote" hidden>
      <div class="pf-kv"><span class="pf-k">Base URL</span></div>
      <input class="popup-in pf-ai-base" autocomplete="off" spellcheck="false">
      <div class="pf-ai-keybox">
      <div class="pf-kv"><span class="pf-k">API key</span></div>
      <div class="pf-row pf-keyrow"><input class="popup-in pf-ai-key" type="password" placeholder="sk-…" autocomplete="off" spellcheck="false" style="flex:1"><button class="mini pf-ai-show" type="button">Show</button><button class="mini pf-ai-clear" type="button" title="Delete the saved key for this provider">Clear</button></div>
      <div class="pf-warn pf-ai-keywarn">⚠️ Your key is kept only in this browser and is sent only to your endpoint. Never paste it anywhere public.</div>
      <div class="pf-info pf-ai-sharedkey" hidden>🔑 Shared key with Image Gen.</div>
      </div>
      <div class="pf-kv"><span class="pf-k">Model</span></div>
      <input class="popup-in pf-ai-model" autocomplete="off" spellcheck="false">
      <details class="foldbox pf-ai-routes" open hidden>
      <summary>External AI calls</summary>
      <p class="pf-hint">Each job below can use the provider above — or fall back to Perchance AI when switched off. Off is useful when the external model is worse at a job, or to save credits.</p>
      <div class="pf-ai-routelist"></div>
      </details>
      <details class="foldbox pf-ai-adv">
      <summary>Advanced settings</summary>
      <div class="pf-kv" style="border-bottom:none;padding-bottom:0"><span class="pf-k">Thinking</span><span class="pf-v pf-ai-think"></span></div>
      <p class="pf-hint">Slower and costs extra tokens — recommended: off.</p>
      <div class="pf-ai-budgetwrap">
      <div class="pf-kv" style="border-bottom:none;padding-bottom:0"><span class="pf-k">Thinking budget</span><span class="pf-v"><input class="popup-in pf-ai-thinkbudget" type="number" min="1" max="128000" step="1" style="max-width:110px"></span></div>
      <p class="pf-hint">Max thinking tokens per call when Thinking is on (OpenRouter only).</p>
      </div>
      <div class="pf-kv" style="border-bottom:none;padding-bottom:0"><span class="pf-k">Custom parameters</span><span class="pf-v pf-ai-custom"></span></div>
      <p class="pf-hint">When on, the sampling sliders below are sent with every request. When off, each provider uses its own defaults and the sliders do nothing.</p>
      <div class="pf-ai-sampwrap" hidden>
      <div class="pf-kv" style="border-bottom:none;padding-bottom:0"><span class="pf-k">Temperature</span><span class="pf-v"><b class="pf-samp-val pf-ai-tempval"></b></span></div>
      <div class="pf-slider-wrap"><span class="pf-slider-min">0</span><input type="range" class="mno-range pf-ai-temp" min="0" max="2" step="0.01"><span class="pf-slider-max">2</span></div>
      <p class="pf-hint">How random the writing is. Lower is focused and consistent, higher is wilder and more creative.</p>
      <div class="pf-kv" style="border-bottom:none;padding-bottom:0"><span class="pf-k">Top-p</span><span class="pf-v"><b class="pf-samp-val pf-ai-toppval"></b></span></div>
      <div class="pf-slider-wrap"><span class="pf-slider-min">0</span><input type="range" class="mno-range pf-ai-topp" min="0" max="1" step="0.01"><span class="pf-slider-max">1</span></div>
      <p class="pf-hint">Only the most likely next words adding up to this probability are picked from. Lower is safer, 1 is off.</p>
      <div class="pf-kv" style="border-bottom:none;padding-bottom:0"><span class="pf-k">Top-k</span><span class="pf-v"><b class="pf-samp-val pf-ai-topkval"></b></span></div>
      <div class="pf-slider-wrap"><span class="pf-slider-min">0</span><input type="range" class="mno-range pf-ai-topk" min="0" max="100" step="1"><span class="pf-slider-max">100</span></div>
      <p class="pf-hint">Only the this many most likely next words are picked from. Lower is safer, 0 is off. Ollama and OpenRouter only.</p>
      <div class="pf-kv" style="border-bottom:none;padding-bottom:0"><span class="pf-k">Repeat penalty</span><span class="pf-v"><b class="pf-samp-val pf-ai-reppval"></b></span></div>
      <div class="pf-slider-wrap"><span class="pf-slider-min">1</span><input type="range" class="mno-range pf-ai-repp" min="1" max="2" step="0.01"><span class="pf-slider-max">2</span></div>
      <p class="pf-hint">How much the model avoids repeating itself. Higher repeats less but can wander. Sent as repetition penalty (Ollama, OpenRouter) or frequency penalty (OpenAI, DeepSeek).</p>
      <p class="pf-hint">Defaults match each provider's own API settings — Reset restores them.</p>
      <div class="pf-row"><button class="mini pf-ai-sampreset" type="button">Reset sampling to defaults</button></div>
      </div>
      </details>
      <div class="pf-row" style="border-top:1px solid var(--border);padding-top:9px"><button class="btn pf-ai-test" type="button">Test connection</button><span class="pf-note pf-ai-status"></span></div>
    </div>
    <div class="pf-row"><span class="pf-note pf-ai-saved"></span></div>`;
  const provEl = sec.querySelector(".pf-ai-prov");
  const provRowEl = sec.querySelector(".pf-ai-provrow");
  const remoteBox = sec.querySelector(".pf-ai-remote");
  const baseEl = sec.querySelector(".pf-ai-base");
  const keyEl = sec.querySelector(".pf-ai-key");
  const modelEl = sec.querySelector(".pf-ai-model");
  const keyBox = sec.querySelector(".pf-ai-keybox");
  const ollamaHint = sec.querySelector(".pf-ai-ollama");
  const sharedKeyHint = sec.querySelector(".pf-ai-sharedkey");
  const budgetWrap = sec.querySelector(".pf-ai-budgetwrap");
  const statusEl = sec.querySelector(".pf-ai-status");
  const savedEl = sec.querySelector(".pf-ai-saved");
  const thinkBox = sec.querySelector(".pf-ai-think");
  const customBox = sec.querySelector(".pf-ai-custom");
  const budgetEl = sec.querySelector(".pf-ai-thinkbudget");
  const sampWrap = sec.querySelector(".pf-ai-sampwrap");
  const tempEl = sec.querySelector(".pf-ai-temp");
  const toppEl = sec.querySelector(".pf-ai-topp");
  const topkEl = sec.querySelector(".pf-ai-topk");
  const reppEl = sec.querySelector(".pf-ai-repp");
  const tempVal = sec.querySelector(".pf-ai-tempval");
  const toppVal = sec.querySelector(".pf-ai-toppval");
  const topkVal = sec.querySelector(".pf-ai-topkval");
  const reppVal = sec.querySelector(".pf-ai-reppval");
  budgetEl.value = cfg.thinkingBudget;
  thinkBox.dataset.on = cfg.allowReasoning ? "1" : "";
  // Titleless switches: each row's pf-hint below it already explains both states,
  // so there is nothing a tooltip would add (same policy as the Story panel).
  const swThink = switchEl({
    on: () => thinkBox.dataset.on === "1",
    set: (on) => { thinkBox.dataset.on = on ? "1" : ""; },
    text: cfg.allowReasoning ? "On" : "Off",
    plain: true,
    onChange: () => { swThink.setLabel(thinkBox.dataset.on === "1" ? "On" : "Off"); persist(); }
  });
  thinkBox.appendChild(swThink.el);
  customBox.dataset.on = cfg.customParams === true ? "1" : "";
  const swCustom = switchEl({
    on: () => customBox.dataset.on === "1",
    set: (on) => { customBox.dataset.on = on ? "1" : ""; },
    text: cfg.customParams === true ? "On" : "Off",
    plain: true,
    onChange: () => { swCustom.setLabel(customBox.dataset.on === "1" ? "On" : "Off"); paintCustom(); persist(); }
  });
  customBox.appendChild(swCustom.el);
  // Per-job routing switches (global, not per provider): which calls may use
  // the external provider above. Anything off falls back to Perchance AI.
  const routesBox = sec.querySelector(".pf-ai-routes");
  const routesList = sec.querySelector(".pf-ai-routelist");
  const routeMounts = {};
  const routeSwitches = {};
  const paintRouteSw = (id) => {
    const sw = routeSwitches[id];
    if (!sw || !routeMounts[id]) return;
    sw.paint();
    sw.setLabel(routeMounts[id].dataset.on === "1" ? "On" : "Off");
  };
  for (const id of AI_ROUTE_IDS) {
    const row = document.createElement("div");
    row.className = "pf-row pf-ai-routerow";
    row.innerHTML = `<span class="pf-k" style="min-width:130px">${infoTipLabelHtml(AI_ROUTE_LABELS[id], AI_ROUTE_HINTS[id])}</span><span class="pf-v pf-ai-routesw"></span>`;
    const mount = row.querySelector(".pf-ai-routesw");
    mount.dataset.on = (cfg.useExternal && cfg.useExternal[id] !== false) ? "1" : "";
    const sw = switchEl({
      on: () => mount.dataset.on === "1",
      set: (on) => { mount.dataset.on = on ? "1" : ""; },
      text: mount.dataset.on === "1" ? "On" : "Off",
      plain: true,
      onChange: () => { paintRouteSw(id); allSw.paint(); allSw.setLabel(allOn() ? "On" : "Off"); persist(); }
    });
    mount.appendChild(sw.el);
    routeMounts[id] = mount;
    routeSwitches[id] = sw;
    routesList.appendChild(row);
  }
  // Master "All" switch, prepended above the per-job rows: flips every job at
  // once. Its own state is derived (on only when every job is on) and repaints
  // whenever any single toggle changes.
  const allOn = () => AI_ROUTE_IDS.every((id) => routeMounts[id] && routeMounts[id].dataset.on === "1");
  const allRow = document.createElement("div");
  allRow.className = "pf-row pf-ai-routerow pf-ai-routeall";
  allRow.innerHTML = `<span class="pf-k" style="min-width:130px">${infoTipLabelHtml("All", "Switch every job below at once.")}</span><span class="pf-v pf-ai-routesw"></span>`;
  const allMount = allRow.querySelector(".pf-ai-routesw");
  const allSw = switchEl({
    on: () => allOn(),
    set: (on) => { for (const id of AI_ROUTE_IDS) routeMounts[id].dataset.on = on ? "1" : ""; },
    text: allOn() ? "On" : "Off",
    plain: true,
    onChange: () => { for (const id of AI_ROUTE_IDS) paintRouteSw(id); allSw.paint(); allSw.setLabel(allOn() ? "On" : "Off"); persist(); }
  });
  allMount.appendChild(allSw.el);
  routesList.prepend(allRow);
  const readRoutes = () => {
    const out = {};
    for (const id of AI_ROUTE_IDS) out[id] = !routeMounts[id] || routeMounts[id].dataset.on === "1";
    return out;
  };
  for (const p of PROVIDERS) {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = p.label;
    provEl.appendChild(o);
  }
  provEl.value = cfg.provider;
  const loadEntry = (id) => {
    const entry = getProviderEntry(id);
    baseEl.value = entry.baseUrl;
    modelEl.value = entry.model;
    keyEl.value = "";
    keyEl.placeholder = entry.hasKey ? "•••••••• (saved)" : "sk-…";
    const s = sanitizeSampling(entry.sampling, id);
    tempEl.value = s.temperature; tempVal.textContent = String(s.temperature);
    toppEl.value = s.top_p; toppVal.textContent = String(s.top_p);
    topkEl.value = s.top_k; topkVal.textContent = String(s.top_k);
    reppEl.value = s.repeatPenalty; reppVal.textContent = String(s.repeatPenalty);
  };
  const readSampling = () => sanitizeSampling({
    temperature: tempEl.value,
    top_p: toppEl.value,
    top_k: topkEl.value,
    repeatPenalty: reppEl.value
  }, provEl.value);
  const paintSampVals = () => {
    const s = readSampling();
    tempVal.textContent = String(s.temperature);
    toppVal.textContent = String(s.top_p);
    topkVal.textContent = String(s.top_k);
    reppVal.textContent = String(s.repeatPenalty);
  };
  for (const el of [tempEl, toppEl, topkEl, reppEl]) {
    el.addEventListener("input", () => { paintSampVals(); persist(); });
  }
  const paintCustom = () => {
    sampWrap.classList.toggle("pf-ai-sampoff", customBox.dataset.on !== "1");
  };
  sec.querySelector(".pf-ai-sampreset").onclick = () => {
    const s = sampDefaultsFor(provEl.value);
    tempEl.value = s.temperature; toppEl.value = s.top_p;
    topkEl.value = s.top_k; reppEl.value = s.repeatPenalty;
    paintSampVals();
    persist();
  };
  const paint = () => {
    const preset = getProvider(provEl.value);
    const remote = provEl.value !== "perchance";
    // Perchance AI has no settings of its own — drop the provider row's
    // separator so it doesn't dangle over an empty section.
    provRowEl.classList.toggle("nosep", !remote);
    remoteBox.hidden = !remote;
    keyBox.hidden = !!preset.noKey;
    ollamaHint.hidden = !preset.noKey;
    sharedKeyHint.hidden = !(provEl.value === "openai" || provEl.value === "openrouter");
    budgetWrap.hidden = provEl.value !== "openrouter";
    sampWrap.hidden = provEl.value === "perchance";
    routesBox.hidden = !remote;
    paintCustom();
    if (!statusEl.dataset.touched) {
      const entry = getProviderEntry(provEl.value);
      statusEl.textContent = remote && !preset.noKey && !entry.hasKey && !keyEl.value.trim() ? "No key saved yet." : "";
    }
  };
  const refreshUsingLine = (next) => {
    // The line only exists for the fallback warning — a healthy selection needs
    // no commentary (the dropdown itself shows what is active).
    const fallback = next.provider !== "perchance" && !getAiKey() && !getProvider(next.provider).noKey;
    if (fallback) {
      savedEl.textContent = "⚠️ Using Perchance AI for now — enter a key to use " + getProvider(next.provider).label + ".";
    } else {
      savedEl.textContent = "";
    }
    savedEl.classList.toggle("is-warn", fallback);
  };
  // Every control writes straight through: picking the provider IS using it, and
  // every field/slider/switch persists on input — no Save step. A keyless remote
  // choice is saved as-is and only blocks closing (see aiCloseBlocker).
  const persist = () => {
    const c = { provider: provEl.value, baseUrl: baseEl.value, model: modelEl.value, allowReasoning: thinkBox.dataset.on === "1", thinkingBudget: budgetEl.value, customParams: customBox.dataset.on === "1", useExternal: readRoutes() };
    if (provEl.value !== "perchance") c.sampling = readSampling();
    const typedKey = keyEl.value.trim();
    const next = saveAiConfig(c, typedKey ? typedKey : undefined);
    refreshUsingLine(next);
    try { window.dispatchEvent(new Event("mno:aimodel-changed")); } catch (e) {}
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
  budgetEl.addEventListener("input", persist);
  budgetEl.addEventListener("change", persist);
  loadEntry(cfg.provider);
  paint();
  refreshUsingLine(getAiConfig());
  sec.querySelector(".pf-ai-show").onclick = (e) => {
    const show = keyEl.type === "password";
    keyEl.type = show ? "text" : "password";
    e.target.textContent = show ? "Hide" : "Show";
  };
  sec.querySelector(".pf-ai-clear").onclick = () => {
    keyEl.value = "";
    keyEl.placeholder = "sk-…";
    statusEl.dataset.touched = "";
    const c = { provider: provEl.value, baseUrl: baseEl.value, model: modelEl.value, allowReasoning: thinkBox.dataset.on === "1", thinkingBudget: budgetEl.value, customParams: customBox.dataset.on === "1" };
    if (provEl.value !== "perchance") c.sampling = readSampling();
    const next = saveAiConfig(c, ""); // "" deletes the stored key for this provider
    refreshUsingLine(next);
    try { window.dispatchEvent(new Event("mno:aimodel-changed")); } catch (e) {}
    paint();
  };
  sec.querySelector(".pf-ai-test").onclick = async (e) => {
    const btn = e.target;
    btn.disabled = true;
    statusEl.dataset.touched = "1";
    statusEl.textContent = "Testing…";
    try {
      const preset = getProvider(provEl.value);
      const key = keyEl.value.trim() || (getProviderEntry(provEl.value).hasKey ? getAiKeyFor(provEl.value) : "");
      if (!key && !preset.noKey) throw new Error("Enter an API key first.");
      const sampling = (provEl.value === "perchance" || customBox.dataset.on !== "1") ? undefined : readSampling();
      const reply = await testAiConnection(baseEl.value.trim(), modelEl.value.trim(), key, provEl.value, sampling);
      statusEl.textContent = "✓ Connected" + (reply ? " — replied: " + reply.slice(0, 40) : "");
    } catch (err) {
      statusEl.textContent = "✖ " + (err.message || err);
    }
    btn.disabled = false;
  };
  return sec;
}
