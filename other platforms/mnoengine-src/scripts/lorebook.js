// lorebook.js — the structured lorebook model + relevance selection.
// A world's lorebook is a list of small canon entries, each with a TYPE (world, location, law,
// faction, character, ... so the GM knows what kind of lore it is), a TITLE, and an ACTIVATION
// rule: "always" entries are fed to the GM every turn, while "keywords" entries are
// relevance-ranked each turn (BM25 fused with local embedding cosine — see
// embeddings.js). Only the selected entries are injected into the GM context,
// so a large lorebook no longer costs its full size on every turn.

import { rank as bm25Rank, BM25_NO_KEYWORD_PENALTY } from "./bm25.js";
import { getCachedVec, cosine, fuseRrf, EMB_COS_MIN } from "./embeddings.js";

// Fixed type vocabulary (the editor offers a dropdown of exactly these — keep it in sync with
// world-editor.js's AI-split instruction). Each type tells the model what kind of lore the entry
// is: "premise" ≈ standing facts that define the whole story; "world" ≈ setting canon;
// "location" ≈ places; "character" ≈ people (beyond the world's `npcs` cast); "faction" ≈
// organizations; "religion" ≈ faiths, gods, cults, temples; "magic" ≈ how magic/supernatural
// power works; "law" ≈ rules of the world/land; "culture" ≈ customs and society; "history" ≈
// past events and eras; "event" ≈ a single notable incident; "item" ≈ artifacts and objects;
// "creature" ≈ beasts, monsters, races; "lore" ≈ background facts of any other kind;
// "other" ≈ anything that fits none of these.
export const LORE_TYPES = ["premise", "world", "location", "character", "faction", "religion", "magic", "law", "culture", "history", "event", "item", "creature", "lore", "other"];

// How many recent player turns the trigger matcher looks back at when deciding whether a
// keyword-triggered entry is relevant (a turn = one player action + its GM reply). This is an
// ENGINE-level constant — the editor/world files do not expose it.
export const DEFAULT_TRIGGER_WINDOW_TURNS = 3;

// Per-turn feed cap on the KEYWORD-triggered tier (the "always" tier is author-controlled and
// left uncapped). Shipped worlds average ~950 chars per entry, so a count alone is easy to blow
// through: LORE_FEED_MAX_CHARS is the real ceiling and LORE_FEED_CAP is a backstop against a
// swarm of tiny entries. Candidates are BM25-ranked by scene relevance (title×1 + keywords×3 +
// content×1; see bm25.js) with a ×0.4 soft penalty when none of the author's trigger words appear
// verbatim — no keyword prefilter, so morphological variants still surface. When every score is 0
// (quiet scene) the rank falls back to scene recency (action → location → newest turn). Entries are
// included WHOLE — a truncated canon fact is worse than an omitted one (the omitted entry simply
// waits for a turn that needs it more).
export const LORE_FEED_CAP = 4;
export const LORE_FEED_MAX_CHARS = 3600;

// The lorebook interchange format used by the editor's Import/Export buttons (JSON payload worn
// with the .mno-lore extension). Import also accepts a whole world file — the parser pulls its
// `lorebook` array out — so a world can seed a lorebook without a separate export.
export const LORE_FORMAT = "mno-lorebook";
export const LORE_EXTENSION = ".mno-lore";

const str = (v) => (v === undefined || v === null ? "" : String(v));
const cleanKw = (raw) => str(raw).trim().replace(/^[^a-zA-Z0-9]+/, "").replace(/[^a-zA-Z0-9]+$/, "").toLowerCase();
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Accept keywords as a single string (comma / | / ; separated), an array, or an array of strings
// containing separators. Returns a de-duplicated, lower-cased keyword list (leading/trailing
// punctuation stripped). Empty items are dropped.
export function splitKeywords(v) {
  const parts = [];
  if (Array.isArray(v)) for (const raw of v) parts.push(...String(raw ?? "").split(/[,|;]+/));
  else parts.push(...String(v ?? "").split(/[,|;]+/));
  const out = [];
  const seen = new Set();
  for (const p of parts) {
    const k = cleanKw(p);
    if (k && !seen.has(k)) { seen.add(k); out.push(k); }
  }
  return out;
}

// Normalize one entry (any legacy/sloppy shape) into the canonical runtime form:
//   { title, type, activation: "always"|"keywords", keywords: string[], content }
// Returns null for rows that are completely empty (dropped by callers).
export function normalizeLoreEntry(raw, fallbackIndex = 0) {
  if (typeof raw === "string") {
    const c = raw.trim();
    if (!c) return null;
    return { title: "", type: "lore", activation: "always", keywords: [], content: c };
  }
  if (!raw || typeof raw !== "object") return null;
  const content = str(raw.content).trim();
  const title = str(raw.title).trim();
  if (!content && !title) return null;
  let activation = str(raw.activation).trim().toLowerCase();
  if (activation !== "keywords") activation = "always";
  let keywords = splitKeywords(raw.keywords);
  if (activation === "keywords" && !keywords.length) activation = "always"; // no triggers → always on
  const type = str(raw.type).trim().toLowerCase() || "lore";
  return {
    title,
    // Types outside the fixed vocabulary fold into the generic "lore" bucket (the model reads the
    // tag itself, so a stray imported tag loses nothing — its content is what matters).
    type: LORE_TYPES.includes(type) ? type : "lore",
    activation,
    keywords,
    content
  };
}

// Normalize a whole lorebook — accepts the new array-of-entries form, a legacy plain-text
// lorebook (turned into one "always" world entry), or empty/undefined (→ empty book).
export function normalizeLorebook(raw) {
  const out = [];
  if (Array.isArray(raw)) {
    raw.forEach((e, i) => {
      const n = normalizeLoreEntry(e, i);
      if (n) out.push(n);
    });
  } else if (typeof raw === "string" && raw.trim()) {
    out.push({ title: "", type: "world", activation: "always", keywords: [], content: raw.trim() });
  }
  return out;
}

// Does `kw` appear as a (word-boundary) phrase inside `text`? Case-insensitive.
export function keywordHits(text, kw) {
  if (!text || !kw) return false;
  try { return new RegExp("(?<![a-z0-9])" + escRe(kw) + "(?![a-z0-9])", "i").test(text); }
  catch (e) { return text.toLowerCase().includes(kw.toLowerCase()); }
}

// Everyday function words. Two jobs, kept here beside the matcher both consumers use so they can
// never drift: nameHit (below) ignores them as bare name tokens, and memory-system picks the
// distinctive words of a text (triggers / near-dup gauge) by skipping them.
export const STOPWORDS = new Set(("a an the and or but if then than that this those these with without from into onto over under for of to in on at by as is are was were be been being has have had do does did will would can could should shall may might must not no yes so very just also only more most some any each other about after before during while when where why how who whom whose which what all both few many much own same such there here them their his her its your my our she him they you").split(/\s+/));

// Does `name` appear in `hay`? A full-name phrase (word-boundary, case-insensitive) always counts.
// Otherwise ANY 3+ char token of the name counts — never just the first, which for a title-prefixed
// name is the title ("Mistress", "Captain"), not the name — so a multi-word name still matches when
// the text uses only part of it ("Camilla" for "Mistress Camilla DeLuna"). An everyday word
// ("the", "and", …) is NOT counted as a bare token: otherwise "Billy the Torch" would read as
// present in any prose that merely contains "the". It still counts when it looks like a name in the
// text — capitalized and not merely sentence-initial ("…and May said…") — so a character actually
// called "May"/"Will" (or "May Parker" referred to by her given name) still matches. A name built
// ENTIRELY from everyday words falls back to matching its own tokens.
export function nameHit(hay, name) {
  const n = str(name).trim();
  if (!hay || !n) return false;
  if (keywordHits(hay, n)) return true;
  const toks = n.split(/\s+/).filter((t) => t.length >= 3);
  const distinct = toks.filter((t) => !STOPWORDS.has(t.toLowerCase()));
  const common = toks.filter((t) => STOPWORDS.has(t.toLowerCase()));
  if (distinct.some((t) => keywordHits(hay, t))) return true;
  if (!distinct.length) return common.some((t) => keywordHits(hay, t));
  return common.some((t) => capitalHit(hay, t));
}

// Is `tok` written like a proper noun in `hay`? Case-sensitive, and not merely the first word of a
// sentence (where any word is capitalized): "…and May said" counts, "The door opens." does not.
function capitalHit(hay, tok) {
  const re = new RegExp("\\b" + escRe(tok) + "\\b", "g");
  let m;
  while ((m = re.exec(hay))) {
    const ch = hay[m.index];
    if (ch !== ch.toUpperCase() || ch === ch.toLowerCase()) continue; // not an uppercase letter
    let i = m.index - 1;
    while (i >= 0 && (hay[i] === " " || hay[i] === "\t")) i--;
    if (i >= 0 && !/[.!?\n]/.test(hay[i])) return true;               // mid-sentence → a name
  }
  return false;
}

// Distinctive tokens of a NAME (lowercased): 3+ char words minus everyday function words — the
// same token rule nameHit uses, so this resolver and the memory/prose matcher can never drift.
// A name built entirely from everyday words ("May", "Will") falls back to its own tokens.
export function distinctiveNameTokens(name) {
  const toks = str(name).split(/\s+/).map((t) => t.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, "").toLowerCase()).filter((t) => t.length >= 3);
  if (!toks.length) return [];
  const distinct = toks.filter((t) => !STOPWORDS.has(t));
  return distinct.length ? distinct : toks;
}

// All name tokens (lowercased, 3+ chars), stopwords KEPT — the fallback that lets a name built
// from an everyday word still resolve ("May" → "May Parker"). Distinctive sets diverge there
// ("may" is a stopword, so "May Parker" distills to ["parker"]), while the raw sets still nest.
export function rawNameTokens(name) {
  return str(name).split(/\s+/).map((t) => t.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, "").toLowerCase()).filter((t) => t.length >= 3);
}

// A possessive ("Maya's friend", "James' brother") names someone ELSE, never a spelling variant
// of the possessor — so it must never fuzzy-match. Legitimate apostrophe names ("D'Artagnan",
// "O'Brien", "Ka'el") don't match this: it fires only on 's / s' before a boundary.
const POSSESSIVE_RE = /['’]s(?=\s|$|[.,;:!?")\]])|s['’](?=\s|$|[.,;:!?")\]])/i;

// Extra words that mark a descriptor rather than a variant spelling ("Maya friend" is someone
// else, not Maya). Titles that ARE routinely dropped ("Captain", "Mistress", "Lord", "Dr") are
// deliberately absent — those still resolve. Only relational / generic-person nouns veto.
const RELATIONAL_VETO = new Set(("friend friends mother father mom mum mummy daddy dad papa mama brother sister sibling siblings son daughter child children kid kids baby babies husband wife spouse partner boyfriend girlfriend fiance fiancee lover cousin uncle aunt nephew niece parent parents family relative relatives stranger strangers companion companions ally allies enemy enemies rival rivals neighbor neighbour neighbors neighbours colleague colleagues coworker master servant apprentice teacher student mentor boss employee guard guards soldier soldiers merchant shopkeeper innkeeper bartender waiter waitress clerk officer official man woman men women boy girl boys girls guy guys lady ladies fellow fellows person people human humans").split(/\s+/));

// The tokens in `longer` left over after spending `shorter` once each — the "extra" words a
// subset match ignored. True when any extra word is a relational/descriptor noun.
function extraHasVeto(shorter, longer) {
  const avail = longer.slice();
  for (const t of shorter) {
    const i = avail.findIndex((u) => sameToken(t, u));
    if (i >= 0) avail.splice(i, 1);
  }
  return avail.some((t) => RELATIONAL_VETO.has(t));
}

// Exact token equality for roster resolution — deliberately NO typo tolerance: one-letter
// differences are routinely different names ("Mica"/"Mira", "Leo"/"Leon"), so near-misses stay
// forked rather than risk merging strangers.
function sameToken(a, b) {
  return a === b;
}

// Is every token of the smaller set found (exactly) in the larger one? Each larger
// token is spent at most once, so "Jo Jo" can't match a single "Jo".
function isTokenSubset(shorter, longer) {
  if (!shorter.length) return false;
  const avail = longer.slice();
  for (const t of shorter) {
    const i = avail.findIndex((u) => sameToken(t, u));
    if (i < 0) return false;
    avail.splice(i, 1);
  }
  return true;
}

// Resolve a GM-written name (`[Name]` speaker, `[[NPC: Name]]` tag, tracker header, chat click)
// to one of `candidates` (the canonical roster names). Exact-match-safe:
//   1. exact (case-sensitive), then lowercase-exact — always win, even when ambiguous;
//   2. otherwise the smaller token set must be a SUBSET of the larger's (a dropped title/surname/
//      given name, or a bare given name for a full one), matched exactly (no typo tolerance —
//      "Mica"/"Mira" are different names). Distinctive tokens are tried first; when stopwords
//      split them ("May" vs "May Parker") the raw token sets are tried instead. Substring
//      containment is deliberately NOT used: "Maya" is a substring of "Maya's friend", but that
//      speaker is a different person, not a variant spelling;
//   3. and exactly ONE candidate may qualify — two roster entries sharing the tag's tokens
//      ("Camilla Thorne" vs "Camilla DeLuna" for a bare "Camilla") stay ambiguous and return
//      null, so two genuinely different characters are never merged.
// Deliberately conservative: two multi-word names that merely SHARE a token but neither
// contains the other ("Governor Camilla" vs "Mistress Camilla") do NOT resolve — that shape is
// indistinguishable from two different people sharing a given name, so it stays forked rather
// than risk merging strangers. Possessives ("Maya's friend") and relational extras ("Maya
// friend") never resolve either — those name someone else. Returns the canonical candidate,
// or null.
export function resolveNpcName(raw, candidates) {
  const t = str(raw).trim().replace(/\s+/g, " ");
  const list = (candidates || []).map((c) => str(c).trim()).filter(Boolean);
  if (!t || !list.length) return null;
  if (list.includes(t)) return t;
  const lt = t.toLowerCase();
  const lowerMap = new Map();
  for (const c of list) if (!lowerMap.has(c.toLowerCase())) lowerMap.set(c.toLowerCase(), c);
  if (lowerMap.has(lt)) return lowerMap.get(lt);
  // A quote-wrapped or double-spaced variant ("“Camilla”", "Camilla  DeLuna") still counts as exact.
  const cleaned = t.replace(/^[“”‘’"'«»„()[\]{}]+|[“”‘’"'«»„()[\]{}.,;:!?]+$/g, "").replace(/\s+/g, " ").trim();
  if (cleaned && cleaned !== t && lowerMap.has(cleaned.toLowerCase())) return lowerMap.get(cleaned.toLowerCase());
  // A possessive names someone else, never a variant spelling of the possessor ("Maya's friend"
  // is not Maya). Only an exact roster entry counts — handled above — so there is no fuzzy path.
  if (POSSESSIVE_RE.test(t)) return null;
  const rToks = distinctiveNameTokens(t);
  const rRaw = rawNameTokens(t);
  if (!rToks.length && !rRaw.length) return null;
  let hit = null, hits = 0;
  for (const c of list) {
    // A possessive roster entry ("Maya's friend" hand-added as its own character) is its own
    // person — it never absorbs, and is never absorbed by, a fuzzy variant.
    if (POSSESSIVE_RE.test(c)) continue;
    const cToks = distinctiveNameTokens(c);
    const cRaw = rawNameTokens(c);
    if (!cToks.length && !cRaw.length) continue;
    let matched = false;
    // Distinctive subset: dropped titles/surnames ("Garreth" → "Captain Garreth", "Camilla" →
    // "Mistress Camilla DeLuna"). Exact token equality only, so "Jon" never matches "Jonas"
    // and "maya" never matches "maya's".
    if (rToks.length && cToks.length) {
      const [shorter, longer] = rToks.length <= cToks.length ? [rToks, cToks] : [cToks, rToks];
      if (isTokenSubset(shorter, longer) && !extraHasVeto(shorter, longer)) matched = true;
    }
    // Raw subset fallback: names built from everyday words ("May" → "May Parker" — "may" is a
    // stopword, so the distinctive sets diverge while the raw sets still nest). Same exact-token
    // rule, same relational veto ("Maya friend" stays forked via its "friend" extra).
    if (!matched && rRaw.length && cRaw.length) {
      const [shorter, longer] = rRaw.length <= cRaw.length ? [rRaw, cRaw] : [cRaw, rRaw];
      // A lone stopword ("the", "a") is a particle, not a name — it may only stand in for a
      // given name in first position ("May" → "May Parker"), never for a middle particle ("the"
      // is not "Billy the Torch"). Without this, "[the]" would link to Billy.
      if (shorter.length === 1 && STOPWORDS.has(shorter[0]) && longer[0] !== shorter[0]) {
        matched = false;
      } else if (isTokenSubset(shorter, longer) && !extraHasVeto(shorter, longer)) matched = true;
    }
    if (!matched) continue;
    hit = c;
    hits++;
    if (hits > 1) return null; // ambiguous — shared by two roster entries, never guess
  }
  return hit;
}

// Render one entry for an AI context. The [type] tag tells the model what kind of lore this is.
export function renderLoreEntry(e) {
  const c = str(e && e.content).trim();
  if (!c) return "";
  const type = (e.type || "lore").toLowerCase();
  return `◆ [${type}] ${e.title ? e.title + " — " : ""}${c}`;
}

// Render the always-on entries (optionally restricted to certain types), capped at capChars if >0.
// Used by subsystems that consume the "core bible" wholesale (mapmaker, NPC profiling). Pass
// activation = null to include every entry regardless of its activation rule.
export function lorebookToText(entries, { types = null, capChars = 0, activation = "always" } = {}) {
  const sel = (entries || []).filter((e) => e && str(e.content).trim()
    && (activation === null || !activation || e.activation === activation)
    && (!types || types.includes(e.type)));
  let out = sel.map(renderLoreEntry).join("\n\n");
  if (capChars > 0 && out.length > capChars) out = out.slice(0, capChars);
  return out;
}

// Render ONLY the titles (with their type tag) — a compact "these subjects already exist" list for
// the AI that splits raw text into entries. Bounded regardless of how long the entries' content is,
// so a large book can never overflow the splitter's prompt (see world-editor.js's lore AI split).
export function lorebookTitleList(entries, { capChars = 0 } = {}) {
  const lines = [];
  for (const e of entries || []) {
    if (!e) continue;
    const t = str(e.title).trim();
    if (!t) continue;
    const type = str(e.type).trim().toLowerCase();
    lines.push("- " + t + (type ? " [" + type + "]" : ""));
  }
  let out = lines.join("\n");
  if (capChars > 0 && out.length > capChars) out = out.slice(0, capChars);
  return out;
}

// Always-on entries + any keyword entry whose trigger words hit `text`. This is the core
// relevance selection used for the GM's per-turn WORLD LORE section (text = the recent chat
// window + current action + current location).
export function lorebookForText(entries, text) {
  const hay = str(text);
  const sel = [];
  for (const e of entries || []) {
    if (!e || !str(e.content).trim()) continue;
    if (e.activation === "keywords") {
      if (hay && (e.keywords || []).some((kw) => keywordHits(hay, kw))) sel.push(e);
    } else {
      sel.push(e); // always
    }
  }
  return sel.map(renderLoreEntry).join("\n\n");
}

// The keyword-triggered entries whose trigger words hit `text`, rendered. Consumers that already
// received the always-on digest separately (the mapmaker, which matches against the recent story)
// use this to add the story-relevant keyword entries without duplicating the always-on ones.
export function keywordLoreForText(entries, text, { types = null, capChars = 0 } = {}) {
  const hay = str(text);
  const sel = (entries || []).filter((e) => e && e.activation === "keywords" && str(e.content).trim()
    && (!types || types.includes(e.type))
    && hay && (e.keywords || []).some((kw) => keywordHits(hay, kw)));
  let out = sel.map(renderLoreEntry).join("\n\n");
  if (capChars > 0 && out.length > capChars) out = out.slice(0, capChars);
  return out;
}

// Weighted document text for BM25: title×1 + keywords×3 + content×1. Title is
// ×1 — the author's trigger words are the relevance reason, the title is just
// a label.
export function loreDocText(e) {
  const title = str(e && e.title).trim();
  const kws = Array.isArray(e && e.keywords) ? e.keywords.map((k) => str(k).trim()).filter(Boolean) : [];
  const content = str(e && e.content).trim();
  const kwPart = kws.length ? ((kws.join(" ") + " ").repeat(3)).trim() : "";
  return [title, kwPart, content].filter(Boolean).join(" ");
}

// Compose the WORLD LORE section for one GM turn. `chatTurns` = the recent transcript as per-turn
// strings (oldest → newest, from RPEngine.recentChatTurns), `actionText` = the player's latest
// action/directive, `location` = the current location tracker value (both part of "what the scene
// is about"). `chatText` (a single joined blob) is still accepted when no per-turn split is
// available. The "always" tier is fed in full; the "keywords" tier is relevance-ranked — BM25
// fused with local embedding cosine (RRF) when `hybrid.queryVec` is passed, BM25 alone otherwise
// (no keyword prefilter — morphological variants and paraphrases still surface) — with a ×0.4
// soft penalty when none of the author's trigger words appear verbatim, then capped
// (LORE_FEED_CAP / LORE_FEED_MAX_CHARS) so a big or shotgun-triggered book can't flood the
// context. When every score is 0 the rank falls back to scene recency (action → location →
// newest turn). Returns "" when nothing applies.
export function loreForTurn(entries, { chatTurns = null, chatText = "", actionText = "", location = "", feedCap = LORE_FEED_CAP, maxChars = LORE_FEED_MAX_CHARS } = {}, hybrid = null) {
  const turns = Array.isArray(chatTurns) ? chatTurns.map((t) => str(t)).filter((t) => t.trim()) : [];
  const blob = str(chatText);
  const act = str(actionText);
  const loc = str(location);
  const always = [];
  const cands = [];
  (entries || []).forEach((e, i) => {
    if (!e || !str(e.content).trim()) return;
    if (e.activation !== "keywords") { always.push({ e, i }); return; }
    cands.push({ e, i });
  });
  const windowText = turns.length ? turns.join("\n") : blob;
  const query = [windowText, act, loc].filter((t) => t && t.trim()).join("\n");
  let ordered = [];
  if (cands.length && query.trim()) {
    try {
      const mod = rankLoreCandidates(cands, query, hybrid);
      if (mod && mod.maxScore > 0) ordered = mod.ordered;
    } catch (e) { ordered = []; }
  }
  if (!ordered.length) {
    // Fallback: old scene-recency rank (immediate scene first, then newest turn).
    const scored = [];
    for (const { e, i } of cands) {
      const kws = e.keywords || [];
      if (!kws.length) continue;
      let r = -1;
      if (act && kws.some((kw) => keywordHits(act, kw))) r = 0;
      else if (loc && kws.some((kw) => keywordHits(loc, kw))) r = 1;
      else {
        for (let t = turns.length - 1; t >= 0; t--) {
          if (kws.some((kw) => keywordHits(turns[t], kw))) { r = 2 + (turns.length - 1 - t); break; }
        }
        if (r < 0 && blob && kws.some((kw) => keywordHits(blob, kw))) r = 2 + turns.length;
      }
      if (r >= 0) scored.push({ e, i, r });
    }
    scored.sort((a, b) => (a.r - b.r) || (a.i - b.i));
    ordered = scored.map((s) => ({ e: s.e, i: s.i }));
  }
 const chosen = [];
  let chars = 0;
  for (const s of ordered) {
    if (chosen.length >= feedCap) break;
    const text = renderLoreEntry(s.e);
    if (!text) continue;
    // Always admit the top-ranked entry (a fact the scene clearly touches is never dropped
    // wholesale); past that, stop before the keyword tier outgrows its character budget.
    if (chosen.length && chars + text.length > maxChars) break;
    chosen.push(text);
    chars += text.length + 2;
  }
  return always.map((a) => renderLoreEntry(a.e)).filter(Boolean).concat(chosen).join("\n\n");
}

// Rank lore candidates best-first. BM25 over the weighted doc text, fused
// (RRF) with embedding cosine when `hybrid.queryVec` is present — the fusion
// is what recalls true paraphrases (`sword` → a `blade` doc BM25 scores 0).
// The ×0.4 no-verbatim-keyword penalty applies to the fused score, so an
// author's explicit trigger still outranks a pure-semantic match.
// Returns { ordered: [{e,i}], maxScore }.
function rankLoreCandidates(cands, query, hybrid = null) {
  if (!cands.length) return { ordered: [], maxScore: 0 };
  const textOf = new Map();
  for (const c of cands) textOf.set(c, loreDocText(c.e));
  const ranked = bm25Rank(query, cands, (c) => textOf.get(c), { stopwords: STOPWORDS });
  const hitOf = new Map();
  const posOf = new Map(); // cand -> BM25 rank among positive scorers
  let maxScore = 0;
  const penalized = ranked.map((r) => {
    const kws = (r.doc && r.doc.e && r.doc.e.keywords) || [];
    const hasHit = !!(kws.length && query && kws.some((kw) => keywordHits(query, kw)));
    hitOf.set(r.doc, hasHit);
    const s = hasHit ? r.score : r.score * BM25_NO_KEYWORD_PENALTY;
    if (s > maxScore) maxScore = s;
    return { cand: r.doc, e: r.doc.e, i: r.doc.i, score: s };
  });
  penalized.sort((a, b) => (b.score - a.score) || (a.i - b.i));
  const positive = penalized.filter((p) => p.score > 0);
  positive.forEach((p, rank) => posOf.set(p.cand, rank));
  const qv = hybrid && hybrid.queryVec;
  if (qv && qv.length) {
    const cosOf = new Map();
    for (const c of cands) {
      const v = getCachedVec(textOf.get(c)); // queues misses for next turn
      if (!v) continue;
      const co = cosine(qv, v);
      if (co >= EMB_COS_MIN) cosOf.set(c, co);
    }
    if (cosOf.size) {
      const embRank = new Map([...cosOf.entries()].sort((a, b) => b[1] - a[1]).map(([c], rank) => [c, rank]));
      const fused = fuseRrf(new Set([...posOf.keys(), ...embRank.keys()]), posOf, embRank, hitOf, BM25_NO_KEYWORD_PENALTY);
      let fmax = 0;
      // fuseRrf sorts by score, then BM25 rank; book order breaks the rest.
      fused.sort((a, b) => (b.score - a.score) || (a.rb - b.rb) || (a.cand.i - b.cand.i));
      for (const f of fused) if (f.score > fmax) fmax = f.score;
      return { ordered: fused.map((f) => ({ e: f.cand.e, i: f.cand.i })), maxScore: fmax };
    }
  }
  return { ordered: positive, maxScore };
}
