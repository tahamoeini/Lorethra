// bm25.js — tiny BM25 retrieval for per-turn GM context selection.
// No dependencies (lorebook.js imports from here, never the reverse, so the
// STOPWORDS set can never drift into a cycle — callers pass it in).
//
// Why BM25 over binary keywordHits: keywordHits is pass/fail + recency, so a
// big or shotgun-triggered book floods the context with whatever matched
// newest. BM25 scores by actual scene relevance (term frequency × rarity +
// length norm), so the feed can take fewer entries without losing recall.
//
// Tokenization normalizations (proven on live turns — without these `GINA
// Core` scored 0 and `mica` missed):
//   - lowercase, `G.I.N.A.` → `gina` (dots → space, then single-letter runs
//     re-joined before split), `.` → space
//   - `'` removed first (`mica's`→`micas`), then naive singularize
//     (`checks`→`check`, len>4; `ies`→`y`, `sses/ches/shes/xes/zes` strip `es`)
//   - split `[a-z0-9]+`, drop STOPWORDS (passed in), len>=3

export const BM25_K1 = 1.2;
export const BM25_B = 0.75;
// The query (recent chat + action + location) can hold hundreds of tokens —
// scoring every one against every doc is noise + wasted cycles. Keep only the
// most informative terms (freq × rarity), plus capitalized names which are
// almost always the point of the scene even at low frequency.
export const BM25_MAX_QUERY_TERMS = 40;
// Soft penalty, not a prefilter: an entry whose author keywords/triggers never
// appear verbatim in the scene can still surface on BM25 (morphological
// variants, partial matches), but a pure lexical overlap without the author's
// explicit relevance reason scores lower than one with it.
export const BM25_NO_KEYWORD_PENALTY = 0.4;

function singularize(w) {
  if (!w || w.length <= 4) return w;
  if (w.endsWith("ies") && w.length > 5) return w.slice(0, -3) + "y"; // stories → story
  if (w.endsWith("sses")) return w.slice(0, -2); // classes → class
  if (w.endsWith("ches") || w.endsWith("shes") || w.endsWith("xes") || w.endsWith("zes")) return w.slice(0, -2); // boxes → box
  if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) return w.slice(0, -1); // checks → check, micas → mica; class/status stay
  return w;
}

// Tokenize free text into BM25 terms. `stopwords` is a Set (callers pass
// lorebook.js's STOPWORDS so the two can never drift); null = no filtering.
export function tokenize(text, stopwords = null) {
  let s = String(text == null ? "" : text).toLowerCase();
  if (!s) return [];
  s = s.replace(/['’`]/g, ""); // mica's → micas, ai's → ais (singularize then folds micas → mica)
  s = s.replace(/\./g, " "); // G.I.N.A. → g i n a + all other dots → space
  // Re-join single-letter runs ("g i n a" → "gina", "u s a" → "usa"). Only
  // runs where EVERY token is one letter join, so "a dragon" is untouched.
  s = s.replace(/(?<![a-z0-9])(?:[a-z]\s+){1,}[a-z](?![a-z0-9])/g, (m) => m.replace(/\s+/g, ""));
  const raw = s.match(/[a-z0-9]+/g) || [];
  const out = [];
  for (let w of raw) {
    if (w.length < 3) continue;
    if (stopwords && stopwords.has(w)) continue;
    w = singularize(w);
    if (w.length < 3) continue;
    if (stopwords && stopwords.has(w)) continue;
    out.push(w);
  }
  return out;
}

// Capitalized words (3+ chars) in the ORIGINAL query text — the "always-keep"
// names. A name at low frequency (said once) is still the point of the scene,
// so it survives the top-40 trim even when common words outnumber it.
function queryNameTokens(queryText, stopwords) {
  const names = new Set();
  const src = String(queryText || "");
  for (const m of src.match(/[A-Z][a-z]{2,}(?:['’][a-z]+)?/g) || []) {
    for (const t of tokenize(m, stopwords)) names.add(t);
  }
  return names;
}

// Rank `docs` against `queryText`. `getText(doc)` returns the (already
// weighted — see callers) document text. Returns [{ doc, score, index }]
// sorted by score desc (index = original position, for stable tie-breaks).
// Scores are computed per-turn and never stored.
export function rank(queryText, docs, getText, { stopwords = null, maxTerms = BM25_MAX_QUERY_TERMS } = {}) {
  const list = Array.isArray(docs) ? docs : [];
  const result = list.map((doc, index) => ({ doc, score: 0, index }));
  if (!list.length) return result;
  const qToks = tokenize(queryText, stopwords);
  if (!qToks.length) return result;
  // Tokenize docs once.
  const docToks = list.map((d) => {
    try { return tokenize(getText(d), stopwords); }
    catch (e) { return []; }
  });
  const N = list.length;
  // Document frequencies.
  const df = new Map();
  const docLens = new Array(N);
  let totalLen = 0;
  for (let i = 0; i < N; i++) {
    const toks = docToks[i];
    docLens[i] = toks.length;
    totalLen += toks.length;
    const seen = new Set(toks);
    for (const t of seen) df.set(t, (df.get(t) || 0) + 1);
  }
  const avgLen = totalLen / Math.max(1, N);
  const idf = (t) => {
    const d = df.get(t) || 0;
    return Math.log(1 + (N - d + 0.5) / (d + 0.5));
  };
  // Trim the query: top maxTerms by freq × idf, plus always-keep names that
  // actually occur in the docs (a name nobody wrote about scores nothing).
  const qfreq = new Map();
  for (const t of qToks) qfreq.set(t, (qfreq.get(t) || 0) + 1);
  const names = queryNameTokens(queryText, stopwords);
  const weighted = [];
  for (const [t, f] of qfreq) {
    if (!df.has(t)) continue; // contributes nothing — drop before trimming
    weighted.push({ t, w: f * idf(t) });
  }
  weighted.sort((a, b) => b.w - a.w);
  const keep = new Set();
  for (const e of weighted.slice(0, Math.max(1, maxTerms))) keep.add(e.t);
  for (const n of names) if (df.has(n)) keep.add(n);
  if (!keep.size) return result;
  // Score.
  for (let i = 0; i < N; i++) {
    const toks = docToks[i];
    if (!toks.length) continue;
    const tf = new Map();
    for (const t of toks) if (keep.has(t)) tf.set(t, (tf.get(t) || 0) + 1);
    if (!tf.size) continue;
    const dl = docLens[i] || 1;
    const norm = BM25_K1 * (1 - BM25_B + BM25_B * (dl / Math.max(1, avgLen)));
    let s = 0;
    for (const [t, f] of tf) {
      s += idf(t) * ((f * (BM25_K1 + 1)) / (f + norm));
    }
    result[i].score = s;
  }
  result.sort((a, b) => (b.score - a.score) || (a.index - b.index));
  return result;
}
