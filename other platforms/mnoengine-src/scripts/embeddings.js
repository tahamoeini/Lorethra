// embeddings.js — local semantic vectors for hybrid BM25 + embedding retrieval.
//
// Why: BM25 is lexical — `sword` never matches a doc that only says `blade`
// (score 0, cut before any referee could see it). A tiny ONNX model
// (all-MiniLM-L6-v2, 384-dim, ~23MB, cached by the browser after first load)
// gives query↔doc cosine similarity where paraphrases score 0.45+ and
// unrelated text scores <0.20, so the hybrid recalls what BM25 can't.
//
// Design constraints (read before touching):
// - NO transformer import at module top level — the model/ONNX runtime load
//   ONLY inside a blob-shimmed worker (the preview iframe allows
//   `new Worker(blobUrl, {type:"module"})` but not cross-origin worker URLs).
//   This module on the main thread stays tiny: hashing, RRF fusion, kv cache.
// - Everything degrades to BM25-only. Worker missing, model failed, query
//   timeout, no cached doc vectors — every path falls back silently. Never
//   block a GM turn on vectors: the query embed races a timeout, doc misses
//   queue in the background for next turn.
// - Vectors are a DERIVED cache, never story truth: kv folder `embvec`,
//   key = model-prefix + fnv1a(text). Never in adventure saves/exports.
//   Eviction = entry cap + age + stale-prefix sweep (see sweepVectorsIfDue).
//   No per-turn kv writes: `at` is set on insert and refreshed only by the
//   session-enter warmup (bulk), so steady-state turns write nothing except
//   newly-embedded docs.

export const EMB_MODEL_ID = "Xenova/all-MiniLM-L6-v2";
export const EMB_TRANSFORMERS_URL = "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/+esm";
const EMB_KEY_PREFIX = "m6q1_"; // bump when model/quantization changes (old keys swept)
// Cosine floor: calibration (MiniLM, normalized mean-pool) put single-word
// paraphrases at 0.45–0.75 (sword/blade 0.73, healer/cleric 0.45), full-turn
// queries against paraphrase docs around 0.30 (diluted by scene words), and
// unrelated pairs at 0.05–0.20. Below this a doc is treated as having no
// vector, so a quiet scene still feeds nothing instead of the
// least-irrelevant doc.
export const EMB_COS_MIN = 0.25;
const EMB_QUERY_TIMEOUT_MS = 2500;
const EMB_CHUNK = 16; // docs per worker message (bounds query wait behind a batch)
const EMB_MAX_ENTRIES = 5000; // ~7.5MB ceiling for the kv cache
const EMB_MAX_AGE_MS = 60 * 24 * 3600 * 1000;
const EMB_SWEEP_INTERVAL_MS = 7 * 24 * 3600 * 1000;
const RRF_K = 60;

// ---------- hashing (cache keys) ----------
// Whitespace-collapsed, case-SENSITIVE (safe: dup cost only, never wrong vec).
export function vecTextNorm(t) {
  return String(t == null ? "" : t).replace(/\s+/g, " ").trim();
}
function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ("0000000" + (h >>> 0).toString(16)).slice(-8);
}
export function vecKey(text) {
  return EMB_KEY_PREFIX + fnv1a(vecTextNorm(text));
}

// ---------- math ----------
export function cosine(a, b) {
  if (!a || !b || a.length !== b.length || !a.length) return 0;
  let d = 0;
  for (let i = 0; i < a.length; i++) d += a[i] * b[i];
  return d;
}
// Reciprocal-rank fusion over index orders (best-first). Items absent from one
// list contribute only the other list's term. Returns fused best-first order.
export function rrfIndices(bm25Order, embOrder, k = RRF_K) {
  const rb = new Map();
  const re = new Map();
  (bm25Order || []).forEach((idx, rank) => { if (!rb.has(idx)) rb.set(idx, rank); });
  (embOrder || []).forEach((idx, rank) => { if (!re.has(idx)) re.set(idx, rank); });
  const pool = new Set([...rb.keys(), ...re.keys()]);
  return [...pool].map((idx) => {
    let s = 0;
    if (rb.has(idx)) s += 1 / (k + rb.get(idx));
    if (re.has(idx)) s += 1 / (k + re.get(idx));
    return { idx, s, tie: rb.has(idx) ? rb.get(idx) : 1e9 };
  }).sort((a, b) => (b.s - a.s) || (a.tie - b.tie)).map((e) => e.idx);
}

// Candidate-level fusion shared by lore / memory / NPC ranking (one tuning
// point — keep the three call sites on this, don't reimplement).
// `bm25Rank`: Map cand -> rank among BM25-positive scorers (absent = no score).
// `embRank`: Map cand -> rank by cosine desc (absent = no vector / below floor).
// `hitOf`: Map cand -> bool (author trigger present verbatim).
// `penalty`: multiplier for no-verbatim-hit candidates (pass 1 for no penalty).
// Returns [{cand, score}] best-first (score 0 filtered out).
export function fuseRrf(pool, bm25Rank, embRank, hitOf, penalty = 1, k = RRF_K) {
  const out = [];
  for (const cand of pool) {
    const rb = bm25Rank.has(cand) ? bm25Rank.get(cand) : -1;
    const re = embRank.has(cand) ? embRank.get(cand) : -1;
    if (rb < 0 && re < 0) continue;
    let s = 0;
    if (rb >= 0) s += 1 / (k + rb);
    if (re >= 0) s += 1 / (k + re);
    if (hitOf && !hitOf.get(cand)) s *= penalty;
    if (s > 0) out.push({ cand, score: s, rb });
  }
  out.sort((a, b) => (b.score - a.score) || (a.rb - b.rb));
  return out;
}

// ---------- kv store (lazy, memory-only fallback) ----------
let kvFolder = null;
let kvProbed = false;
function embFolder() {
  if (kvProbed) return kvFolder;
  kvProbed = true;
  try {
    const k = (typeof window !== "undefined" && window.kv) ? window.kv.embvec : null;
    kvFolder = k && typeof k.get === "function" ? k : null;
  } catch (e) { kvFolder = null; }
  return kvFolder;
}
// Test seam: inject a fake folder {get,getMany,set,setMany,deleteMany,entries}.
export function initEmbStore(folder) {
  kvFolder = folder || null;
  kvProbed = true;
}

// In-memory cache: key -> Float32Array (the sync source rankers read).
const memCache = new Map();
function memCap() {
  if (memCache.size > 6000) {
    const drop = memCache.size - 6000;
    let n = 0;
    for (const k of memCache.keys()) {
      memCache.delete(k);
      if (++n >= drop) break;
    }
  }
}

// ---------- worker ----------
const WORKER_SRC = [
  'import {pipeline, env} from "' + EMB_TRANSFORMERS_URL + '";',
  'env.backends.onnx.wasm.numThreads = 1;',
  'var extractor = null;',
  'self.onmessage = async function(e) {',
  '  var d = e.data, id = d.id, texts = d.texts;',
  '  try {',
  '    if (!extractor) extractor = await pipeline("feature-extraction", "' + EMB_MODEL_ID + '", {quantized:true});',
  '    var vecs = [];',
  '    for (var i = 0; i < texts.length; i++) {',
  '      var out = await extractor(texts[i], {pooling:"mean", normalize:true});',
  '      vecs.push(Array.from(out.data));',
  '    }',
  '    self.postMessage({id:id, ok:true, vecs:vecs});',
  '  } catch(err) { self.postMessage({id:id, ok:false, err:String((err&&err.message)||err).slice(0,200)}); }',
  '};'
].join('\n');

let worker = null;
let workerFailed = false; // sticky per page load: stay BM25-only, never retry-spam
let modelReady = false; // flips on the first successful worker inference
let workerSeq = 0;
const workerPending = new Map();
function bootWorker() {
  if (worker || workerFailed) return worker;
  try {
    if (typeof Worker === "undefined") { workerFailed = true; return null; }
    const w = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" })), { type: "module" });
    w.onmessage = (e) => {
      const d = e && e.data;
      if (!d || d.id === undefined) return;
      const p = workerPending.get(d.id);
      if (!p) return;
      workerPending.delete(d.id);
      if (d.ok) p.resolve(d.vecs);
      else p.reject(new Error(d.err || "embed failed"));
    };
    w.onerror = () => {
      workerFailed = true;
      for (const p of workerPending.values()) p.reject(new Error("embed worker error"));
      workerPending.clear();
      try { w.terminate(); } catch (e) {}
      if (worker === w) worker = null;
    };
    worker = w;
    return w;
  } catch (e) {
    workerFailed = true;
    return null;
  }
}
// Serialized sender: one in-flight worker call at a time (the ONNX session is
// single-threaded — concurrent inferences would interleave on it). Queries
// jump ahead of doc chunks but wait out the current chunk (≤16 docs).
const sendQueue = [];
let sendActive = false;
function workerRequest(texts, timeoutMs, priority = false) {
  return new Promise((resolve, reject) => {
    const item = { texts, timeoutMs, resolve, reject };
    if (priority) sendQueue.unshift(item);
    else sendQueue.push(item);
    processSendQueue();
  });
}
function processSendQueue() {
  if (sendActive) return;
  const item = sendQueue.shift();
  if (!item) return;
  const w = bootWorker();
  if (!w) { item.reject(new Error("no worker")); processSendQueue(); return; }
  sendActive = true;
  const id = ++workerSeq;
  const done = () => { sendActive = false; processSendQueue(); };
  const to = setTimeout(() => {
    workerPending.delete(id);
    done();
    item.reject(new Error("embed timeout"));
  }, item.timeoutMs);
  workerPending.set(id, {
    resolve: (v) => { clearTimeout(to); done(); item.resolve(v); },
    reject: (e) => { clearTimeout(to); done(); item.reject(e); }
  });
  try { w.postMessage({ id, texts: item.texts }); }
  catch (e) {
    workerPending.delete(id);
    clearTimeout(to);
    done();
    item.reject(e);
  }
}
// Warms the model (first inference loads ~23MB + compiles WASM — seconds, in
// the worker thread). Fire-and-forget: turns stay BM25 until ready flips.
let warming = false;
function ensureModelWarming() {
  if (modelReady || workerFailed || warming) return;
  const w = bootWorker();
  if (!w) return;
  warming = true;
  workerRequest(["warmup"], 180000).then(
    () => { modelReady = true; warming = false; pumpQueue(); },
    () => { warming = false; }
  );
}

// ---------- doc vectors ----------
// Background queue of raw texts awaiting embedding (a Set = deduped).
const pendingTexts = new Set();
let pumpInFlight = false;
async function pumpQueue() {
  if (pumpInFlight || workerFailed) return;
  if (!pendingTexts.size) return;
  // Drop texts already cached while queued.
  const batch = [];
  for (const t of pendingTexts) {
    if (batch.length >= EMB_CHUNK) break;
    if (!memCache.has(vecKey(t))) batch.push(t);
    pendingTexts.delete(t);
  }
  if (!batch.length) {
    if (pendingTexts.size) pumpQueue();
    return;
  }
  pumpInFlight = true;
  try {
    const vecs = await workerRequest(batch, 120000);
    modelReady = true;
    const writes = [];
    for (let i = 0; i < batch.length; i++) {
      const v = vecs && vecs[i];
      if (!v || !v.length) continue;
      const key = vecKey(batch[i]);
      const fv = Float32Array.from(v);
      memCache.set(key, fv);
      writes.push([key, { v: fv, at: Date.now() }]);
    }
    memCap();
    const f = embFolder();
    if (f && writes.length) {
      try {
        if (typeof f.setMany === "function") await f.setMany(writes);
        else for (const [k, val] of writes) await f.set(k, val);
      } catch (e) { /* persistence is a nicety — memory cache still serves */ }
    }
  } catch (e) {
    if (String((e && e.message) || e).match(/no worker|embed worker error/)) workerFailed = true;
    else for (const t of batch) { if (!memCache.has(vecKey(t))) pendingTexts.add(t); }
  } finally {
    pumpInFlight = false;
    if (pendingTexts.size && !workerFailed) pumpQueue();
  }
}
// Queue texts for background embedding (no-op when disabled). Fire-and-forget.
export function queueEmbedTexts(texts) {
  if (workerFailed) return;
  let added = false;
  for (const t of texts || []) {
    const n = vecTextNorm(t);
    if (!n || memCache.has(vecKey(n))) continue;
    if (!pendingTexts.has(n)) { pendingTexts.add(n); added = true; }
  }
  // Lazy boot on first real demand (never on landing); the model warms even
  // when everything is already cached so queries can engage.
  ensureModelWarming();
  if (added) pumpQueue();
}
// Sync read for rankers (queues a miss in the background for next turn).
// Returns Float32Array or null.
export function getCachedVec(text) {
  const key = vecKey(text);
  const hit = memCache.get(key);
  if (hit) return hit;
  queueEmbedTexts([text]);
  return null;
}
// Bulk warmup: memory → kv (one getMany) → worker queue. Fire-and-forget;
// resolves when kv backfill is queued (worker embedding continues after).
export async function warmupTexts(texts) {
  const uniq = [];
  const seen = new Set();
  for (const t of texts || []) {
    const n = vecTextNorm(t);
    if (!n || seen.has(n) || memCache.has(vecKey(n))) continue;
    seen.add(n);
    uniq.push(n);
  }
  if (!uniq.length) return;
  const f = embFolder();
  if (f) {
    try {
      let vals = null;
      if (typeof f.getMany === "function") vals = await f.getMany(uniq.map(vecKey));
      else {
        vals = [];
        for (const n of uniq) vals.push(await f.get(vecKey(n)));
      }
      for (let i = 0; i < uniq.length; i++) {
        const rec = vals && vals[i];
        const v = rec && rec.v;
        if (v && v.length) memCache.set(vecKey(uniq[i]), v instanceof Float32Array ? v : Float32Array.from(v));
      }
      memCap();
    } catch (e) { /* fall through to worker queue */ }
  }
  queueEmbedTexts(uniq.filter((n) => !memCache.has(vecKey(n))));
}
// Session-enter: warm the working set + refresh `at` so the age sweep keeps
// live texts (one bulk read + one bulk write, no per-turn writes ever).
export async function warmupSessionVectors({ lore = [], memories = [], npcs = [] } = {}) {
  const all = [...lore, ...memories, ...npcs].map(vecTextNorm).filter(Boolean);
  if (!all.length) return;
  await warmupTexts(all);
  const f = embFolder();
  if (!f) return;
  try {
    const keys = [...new Set(all.map(vecKey))];
    const now = Date.now();
    if (typeof f.getMany === "function" && typeof f.setMany === "function") {
      const vals = await f.getMany(keys);
      const touch = [];
      for (let i = 0; i < keys.length; i++) {
        if (vals && vals[i] && vals[i].v) touch.push([keys[i], { v: vals[i].v, at: now }]);
      }
      if (touch.length) await f.setMany(touch);
    }
  } catch (e) { /* touch is a nicety */ }
}

// ---------- query ----------
// Embed one query string. Fast-null when the model isn't ready (no turn ever
// stalls on a cold model); otherwise races the worker against a timeout.
export function embModelReady() {
  return modelReady && !workerFailed;
}
export async function embedQuery(text) {
  const n = vecTextNorm(text);
  if (!n || workerFailed) return null;
  if (!modelReady) {
    ensureModelWarming();
    return null;
  }
  try {
    const vecs = await workerRequest([n], EMB_QUERY_TIMEOUT_MS, true);
    if (vecs && vecs[0] && vecs[0].length) return Float32Array.from(vecs[0]);
  } catch (e) { /* timeout → BM25-only turn */ }
  return null;
}

// ---------- orphan sweep ----------
// LRU-cap + age + stale-prefix eviction. Runs at most weekly (meta key), in
// the background, never on the play path. Shared text-hash keys mean one
// world's lore also serves another session — attribution is impossible, so
// recency + age is the collection rule (see header).
export async function sweepVectorsIfDue() {
  const f = embFolder();
  if (!f) return;
  try {
    let meta = null;
    try { meta = await f.get("meta"); } catch (e) {}
    const now = Date.now();
    if (meta && typeof meta.lastSweep === "number" && now - meta.lastSweep < EMB_SWEEP_INTERVAL_MS) return;
    await sweepVectorsNow();
    try { await f.set("meta", { lastSweep: now }); } catch (e) {}
  } catch (e) { /* sweep never breaks play */ }
}
export async function sweepVectorsNow() {
  const f = embFolder();
  if (!f || typeof f.entries !== "function") return { removed: 0 };
  let removed = 0;
  try {
    const all = await f.entries();
    const stale = [];
    const live = [];
    for (const [k, rec] of all) {
      if (k === "meta") continue;
      if (!String(k).startsWith(EMB_KEY_PREFIX)) { stale.push(k); continue; }
      const at = rec && typeof rec.at === "number" ? rec.at : 0;
      live.push([k, at]);
    }
    const now = Date.now();
    const aged = live.filter(([, at]) => now - at > EMB_MAX_AGE_MS).map(([k]) => k);
    live.sort((a, b) => a[1] - b[1]); // oldest first
    const over = live.length - EMB_MAX_ENTRIES;
    const cold = over > 0 ? live.slice(0, over).map(([k]) => k) : [];
    const gone = [...new Set([...stale, ...aged, ...cold])];
    if (gone.length) {
      if (typeof f.deleteMany === "function") await f.deleteMany(gone);
      else for (const k of gone) await f.delete(k);
      removed = gone.length;
    }
    for (const k of gone) memCache.delete(k);
  } catch (e) { /* sweep never breaks play */ }
  return { removed };
}

// Debug/testing seam.
export function embStats() {
  return {
    modelReady, workerFailed,
    memCached: memCache.size,
    pending: pendingTexts.size,
    prefix: EMB_KEY_PREFIX
  };
}
export function __resetEmbForTest() {
  memCache.clear();
  pendingTexts.clear();
  workerFailed = false;
  modelReady = false;
  warming = false;
  sendQueue.length = 0;
}
