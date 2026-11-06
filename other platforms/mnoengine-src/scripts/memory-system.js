// Memory system: automatic roll-ups (engine-cadenced) + player-managed manual memories.
// A memory entry is a durable record of one event worth remembering:
//   text     — the event, in story terms
//   turn     — the session turn it happened in (lets the GM judge how long ago)
//   owner    — WHO knows it: "world" for public knowledge, otherwise the name(s) of the
//              character(s) who hold that knowledge, joined with ", ". A memory can be held
//              by the hero, by NPCs, or by several characters at once — an event that played
//              out in front of the hero and an NPC belongs to both (e.g. "Shipo, Lysandra"),
//              so ownership is NOT limited to NPC-private secrets. Aliases ("you", "hero",
//              "player", ...) fold to the hero's actual name, and "all"/"everyone"/... fold to
//              "world".
//   triggers — short keywords that should recall this memory when they come up in talk
//   pinned   — protection from automatic removal ONLY: pinned auto entries survive the
//              edit/reroll rewind, plus the pinned-active feed below (a pinned entry with a
//              non-hero owner speaking/active feeds always, outside all caps). Unpinned entries
//              reach the GM only on an owner-in-scene + trigger match. The player can still
//              delete/rewrite pinned entries by hand.
// Auto memories are fed like the lorebook, in three independent budgets (4/4/4):
//  - pinned-active: pinned entries with a non-hero owner speaking/active feed always, outside all caps.
//  - topical-gated (MEMORY_TOPICAL_ACTIVE_CAP): today's topical tier unchanged — an entry
//    needs a holder in the current scene ("world"/hero-only always pass; hero+NPC shared
//    needs a non-hero holder; see memoriesForTurn), relevance-ranked, now capped at 4.
//  - topical-open (MEMORY_TOPICAL_OPEN_CAP): relevance-ranked entries with NO owner gate —
//    any holder (or none present) qualifies. A deliberate experiment: relevance only, so a
//    private memory can surface with nobody present (knowledge MAY bleed to the GM here).
//  - name-only (MEMORY_NAME_FEED_CAP): presence recalls, unchanged (see below).
// Rank ALL auto entries by relevance first (no gate). Then the gated tier takes the top 4
// that pass the scene gate. Then back to the same ranking, minus the gated picks, and the
// open tier takes the next top 4 — whatever they are (gate-passing leftovers included).
// A trigger that is merely one of the entry's own OWNER NAMES is a presence signal, not a topic
// one (dialogue renders `[Name] ...`, so a present character's name sits in the window every turn
// they speak): such "name-only" recalls get a small RESERVED budget (MEMORY_NAME_FEED_CAP) so they
// can never crowd out topic-matched memories, while still lending the GM a bounded slice of a
// present character's backstory.
// Manual memories are notes written by the player — they are ALWAYS fed (no owner/trigger
// gate), default to the hero's own knowledge but may name anyone (multi-owner included), are
// never pruned, and carry no turn (they are durable player intent, not dated events). Each
// carries an enable/disable flag (default ON): a disabled note is kept in the panel but skipped
// by the feed, so the player can keep a note on hand without it reaching the GM.
// Roll-ups feed the summarizer ONLY the story transcript — GM narration, NPC dialogue
// (including [Name inner] thoughts), and the hero's own actions. Everything else is kept out:
// OOC directives, scene-image commands, roll-check pips, ✦ scene breaks, and tracked-state
// ([TRACKERS]) blocks are meta-layer, not story, so they never become memories.
// Roll-ups intentionally EXCLUDE the last MEMORY_LAG_TURNS turns: those are still editable /
// rerollable, so we hold off baking them into durable memory until they've gone stale.

import { keywordHits, splitKeywords, STOPWORDS, nameHit } from "./lorebook.js";
import { rank as bm25Rank, BM25_NO_KEYWORD_PENALTY } from "./bm25.js";
import { getCachedVec, cosine, fuseRrf, EMB_COS_MIN } from "./embeddings.js";
import { extractTrackers } from "./trackers.js";
import { subUser } from "./text-utils.js";
import { PERCHANCE_INPUT_CAP, PERCHANCE_CHARS_PER_TOKEN } from "./perchance-limits.js";

// Engine-level roll-up cadence — deliberately NOT exposed as a user setting.
export const MEMORY_EVERY_TURNS = 10;
const MEMORY_LAG_TURNS = 2;
export const MANUAL_ENABLED_CAP = 15; // manual notes switched ON (always fed to the GM); disabled notes are kept but not fed, so the note LIST itself is uncapped
export const MEMORY_FEED_CAP = 8; // total topical backstop (gated + open) per turn; manual notes are never capped
// Split of the old 8-slot topical budget into two independent 4-slots (max auto feed stays 12):
// gated = today's scene-gated topical tier, just capped 8 → 4; open = relevance only, NO owner
// gate (a private memory can surface with nobody present — deliberate bleed for testing).
export const MEMORY_TOPICAL_ACTIVE_CAP = 4;
export const MEMORY_TOPICAL_OPEN_CAP = 4;
// Reserved sub-budget for "name-only" recalls — auto entries selected solely because one of their
// trigger words IS one of their own owner's names. That is a PRESENCE signal, not a topic match:
// rendered dialogue carries `[Name]`, so a present character's name is in the window every turn
// they speak. Keeping these out of MEMORY_FEED_CAP means a well-featured character's backstory can
// never evict genuinely topic-relevant memories, while the character is still lent a small, bounded
// slice of their own history. The two budgets are independent (max auto feed = 8 + 4).
export const MEMORY_NAME_FEED_CAP = 4;
// Memory triggers look back over the same window as the lorebook's
// DEFAULT_TRIGGER_WINDOW_TURNS: memories share the 3-turn scene the lorebook ranks on,
// and MEMORY_FEED_CAP keeps a busy scene from flooding the context.
export const MEMORY_TRIGGER_WINDOW_TURNS = 3;
// Cap on the EXISTING MEMORIES list shown to the summarizer each roll-up: pinned entries plus the
// newest `ROLLUP_REF_CAP` unpinned (by the turn they happened on, then when recorded), plus a
// small BM25 relevance top-up (see buildRefText) so entries older than the window can still be
// resolved/updated when the chunk is actually about them. The full store stays the matching
// ground for resolve/owner-updates, but at very long horizons listing all ~200 entries would
// bloat the prompt and tempt the model to copy or "resolve" stale, half-forgotten facts — the
// cap keeps the don't-repeat / exact-copy reference tight and current.
const ROLLUP_REF_CAP = 40;
// Relevance top-up: out-of-window unpinned entries BM25-ranked against the chunk's transcript
// (same ranker + doc text the per-turn feed uses — text×1 + triggers×3, hero stripped — no new
// deps, no AI cost), top `ROLLUP_REF_TOPUP` with score > 0 appended after the base list.
// Steady state this is usually zero additions; the old-thread case gets exactly the entries it
// needs to resolve/update against. Bounded so the packing margin below still covers it.
const ROLLUP_REF_TOPUP = 10;
// Token-aware sub-chunking (see splitRollUpChunks): the turn-based split bounds TURNS, but a
// chatty 10-turn window (measured live: 5.5k transcript tokens, ~8k prompt) still overflows
// Perchance's input limit — and middle-truncation then silently eats events/refs mid-prompt.
// On Perchance AI (see isPerchanceAI) turns are greedy-packed into maximal-fill sub-chunks
// (whole turns only — a summary should cover as many turns as fit): each candidate call is
// measured with the plugin's own token counter, or chars at ~4.0 (measured live) when the
// counter is unavailable. External providers keep turn-only chunks (big windows; splitting
// would just multiply prompt overhead).
// Perchance AI's actual input cap lives in perchance-limits.js (shared with GM transcript
// fitting). Deliberately NOT read from the plugin meta (which reports a lower conservative
// target) and NOT shared with the context meter / budget estimates — those keep their own
// reads and UI untouched.
const ROLLUP_TOKEN_MARGIN = 400; // headroom under the input cap (ref growth as sub-chunks record, BM25 top-up, multi-note)
// The digest (state.memories.digest) is a legacy rolling record of public knowledge from
// sessions that predate the uncapped store; nothing new folds into it. It stays length-capped
// (oldest lines drop first) and is still fed to the GM as background canon when present.
const DIGEST_MAX_CHARS = 800;
// Fuzzy-resolve thresholds: when the summarizer paraphrases a resolve target instead of copying it
// verbatim, the engine falls back to a best content-word match — but only when the winner shares
// >= FUZZY_RESOLVE_MIN_OVERLAP of the target's words AND beats every other entry by a wide margin
// (so a genuinely different memory that merely shares a name/place is never removed), judged only
// for targets with >= FUZZY_RESOLVE_MIN_WORDS distinctive words. Exact copy is still demanded of the
// model; this only catches near-misses that would otherwise leave a contradiction unresolved forever.
const FUZZY_RESOLVE_MIN_OVERLAP = 0.75;
const FUZZY_RESOLVE_MARGIN = 0.25;
const FUZZY_RESOLVE_MIN_WORDS = 5;
// A roll-up whose LLM reply was unusable retries on a short cadence (marker advanced so the next
// attempt fires ~this many turns later) instead of on EVERY subsequent send — a stuck marker would
// otherwise re-fire the cadence check each turn — or waiting the full MEMORY_EVERY_TURNS.
const ROLLUP_RETRY_GAP_TURNS = 5;
const HERO_ALIASES = new Set(["hero", "the hero", "player", "the player", "protagonist", "you", "pc", "user"]);
const PUBLIC_OWNERS = new Set(["world", "all", "everyone", "public", "party"]);

const str = (v) => (v === undefined || v === null ? "" : String(v));

// Fallback trigger extraction from free text (manual notes, migrated legacy entries). Picks the
// first distinctive lowercase words; if nothing survives, the whole phrase becomes one trigger.
export function deriveTriggers(text, max = 8) {
  const src = str(text).toLowerCase();
  const cands = [];
  for (const m of src.match(/[a-z0-9]+(?:['’'-][a-z0-9]+)*/g) || []) {
    const w = m.replace(/^['’'-]+|['’'-]+$/g, "");
    if (w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w)) cands.push(w);
  }
  const out = [];
  const seen = new Set();
  for (const w of cands) {
    if (out.length >= max) break;
    if (!seen.has(w)) { seen.add(w); out.push(w); }
  }
  if (!out.length) {
    const whole = src.replace(/\s+/g, " ").trim();
    if (whole) out.push(whole.slice(0, 60));
  }
  return out;
}

// Distinctive content words (non-stopwords, len>=3) of a text — the shared gauge for the near-dup
// guard (a new entry that rehashes a kept fact) and the fuzzy resolve fallback (a paraphrased
// resolve target matched approximately).
function contentWords(t) {
  const out = new Set();
  for (const w of str(t).toLowerCase().match(/[a-z0-9]+(?:[''’-][a-z0-9]+)*/g) || []) {
    if (w.length >= 3 && !STOPWORDS.has(w)) out.add(w);
  }
  return out;
}

// Conservative fuzzy fallback for a RESOLVE target whose exact text wasn't found (the summarizer
// paraphrased instead of copying verbatim). Returns the index of the best unpinned candidate when it
// shares >= FUZZY_RESOLVE_MIN_OVERLAP of the target's content words AND clearly beats every other
// entry (a wide margin, so a genuinely different memory that merely shares a name or place is never
// removed); -1 otherwise.
function fuzzyResolveIndex(list, text) {
  const words = contentWords(text);
  if (words.size < FUZZY_RESOLVE_MIN_WORDS) return -1;
  let best = -1, bestScore = 0, second = 0;
  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    if (!m || m.pinned) continue;
    const gs = contentWords(str(m.text));
    if (!gs.size) continue;
    let hit = 0;
    for (const w of words) if (gs.has(w)) hit++;
    const s = hit / words.size;
    if (s > bestScore) { second = bestScore; bestScore = s; best = i; }
    else if (s > second) second = s;
  }
  if (best >= 0 && bestScore >= FUZZY_RESOLVE_MIN_OVERLAP && bestScore - second >= FUZZY_RESOLVE_MARGIN) return best;
  return -1;
}

// Canonicalize an owner string into "world" and/or exact character names joined with ", ".
// Hero aliases ("hero", "the hero", "you", ...) fold to the hero's actual name when known, and
// public tokens ("world", "all", "everyone", ...) fold to "world" — which, since it covers
// everyone, subsumes any names it is combined with. Both "," and "+" (the legacy separator) are
// accepted as input separators; the canonical stored form always uses ", ".
export function normalizeOwner(raw, heroName = "") {
  const hero = str(heroName).trim() || "the hero";
  const out = [];
  const seen = new Set();
  for (const rawTok of str(raw).split(/[,+]/)) {
    let tok = rawTok.trim();
    if (!tok) continue;
    const lt = tok.toLowerCase();
    if (HERO_ALIASES.has(lt) || (hero !== "the hero" && lt === hero.toLowerCase())) tok = hero;
    else if (PUBLIC_OWNERS.has(lt)) tok = "world";
    if (!seen.has(tok.toLowerCase())) { seen.add(tok.toLowerCase()); out.push(tok); }
  }
  if (out.some((t) => t.toLowerCase() === "world")) return "world";
  return out.length ? out.join(", ") : "world";
}

// One legacy/sloppy entry → the canonical runtime shape (drops empty rows). Legacy entries
// (no owner/triggers/turn) default to "world"-owned with triggers derived from their text and an
// unknown turn (null); old manual notes were the player's, so they default to the hero. A stored
// owner is always kept — ownership may name the hero, NPCs, or both.
export function migrateMemoryEntry(raw, heroName = "", manual = false) {
  if (!raw || typeof raw !== "object") return null;
  const text = str(raw.text).trim();
  if (!text) return null;
  const hero = heroName || "the hero";
  const fresh = raw.owner !== undefined || raw.triggers !== undefined || raw.turn !== undefined;
  const owner = fresh && str(raw.owner).trim() ? normalizeOwner(raw.owner, hero) : (manual ? hero : "world");
  const triggers = Array.isArray(raw.triggers)
    ? splitKeywords(raw.triggers)
    : (fresh && str(raw.triggers).trim() ? splitKeywords(raw.triggers) : deriveTriggers(text));
  return {
    text,
    manual: !!manual,
    pinned: manual ? true : !!raw.pinned,
    ts: typeof raw.ts === "number" && raw.ts > 0 ? raw.ts : Date.now(),
    owner,
    triggers,
    turn: manual ? null : (typeof raw.turn === "number" && Number.isFinite(raw.turn) && raw.turn >= 0 ? Math.round(raw.turn) : null),
    // Manual notes carry an enable/disable flag (default ON): a disabled note is kept in the panel
    // but never fed to the GM. Auto entries have no such flag — their feed is gated by
    // triggers + owner-presence (see memoriesForTurn), so an enable switch there would be redundant.
    // Auto entries may carry trackerApplied (the NPC tracker call's consumption stamp for banked
    // off-screen happenings — see updateNpcTrackers; preserved here so it survives reloads).
    ...(manual ? { enabled: raw.enabled === false ? false : true } : { trackerApplied: !!raw.trackerApplied })
  };
}

// Normalize a whole { auto, manual, digest? } memory store (used on session load/import). The
// digest string is kept as-is (clamped to DIGEST_MAX_CHARS from the tail — newest lines are at the
// end — in case a corrupt/older save holds an oversized one).
export function normalizeMemories(memories, heroName = "") {
  const hero = str(heroName).trim();
  const norm = (list, manual) => (Array.isArray(list) ? list.map((m) => migrateMemoryEntry(m, hero, manual)).filter(Boolean) : []);
  const digest = typeof (memories && memories.digest) === "string" ? memories.digest : "";
  return {
    auto: norm(memories && memories.auto, false),
    manual: norm(memories && memories.manual, true),
    digest: digest.length > DIGEST_MAX_CHARS ? digest.slice(-DIGEST_MAX_CHARS) : digest
  };
}

// How many manual notes are currently switched ON (always fed to the GM). A note counts as on
// unless explicitly disabled, matching the default-on migration in migrateMemoryEntry.
export function manualEnabledCount(state) {
  const list = (state && state.memories && state.memories.manual) || [];
  return list.reduce((n, m) => n + (m && m.enabled === false ? 0 : 1), 0);
}

// Human label for an owner: "known to all" for public, otherwise the character name(s)
// (hero aliases resolve to the hero's actual name).
export function ownerLabel(owner, heroName = "") {
  const hero = str(heroName).trim() || "the hero";
  const toks = str(owner).split(/[,+]/).map((s) => s.trim()).filter(Boolean);
  const named = toks.filter((t) => !PUBLIC_OWNERS.has(t.toLowerCase()));
  if (!named.length) return "known to all";
  const parts = named.map((t) => {
    const lt = t.toLowerCase();
    return (HERO_ALIASES.has(lt) || (hero !== "the hero" && lt === hero.toLowerCase())) ? hero : t;
  });
  return parts.join(", ");
}

// Name presence in the scene text — the one shared matcher (lorebook.js's `nameHit`), so this side
// and rp-engine can never drift. Phrase first, then any 3+ char token, with everyday words handled
// as in that function.
const nameLike = nameHit;

// Is `kw` (a trigger that matched) merely one of this entry's own owner names? Rendered dialogue is
// `[Name] ...`, so a present character's name lands in the haystack every turn they speak — a
// name-only match is a presence signal, not a topic one. Lenient like nameLike/inRoster: equal, or
// either name a word-boundary phrase of the other ("Captain Orin" ↔ "orin"/"captain"). Public owners
// ("world", ...) are never name triggers, so world-owned facts stay in the topical tier; hero
// aliases resolve to the hero's actual name.
function isOwnerNameTrigger(ownerToks, kw, hero) {
  const k = str(kw).trim().toLowerCase();
  if (!k) return false;
  return ownerToks.some((tok) => {
    const t = tok.trim().toLowerCase();
    if (!t || PUBLIC_OWNERS.has(t)) return false;
    const name = hero && HERO_ALIASES.has(t) ? hero.toLowerCase() : t;
    if (!name) return false;
    return name === k || keywordHits(name, k) || keywordHits(k, name);
  });
}

// A trigger that is merely the hero's name (or a hero alias) carries no topical signal —
// the hero is mentioned in nearly every scene, so it would match everything. Same
// leniency as isOwnerNameTrigger below: equality, aliases, or either side a
// word-boundary phrase of the other.
function isHeroNameTrigger(kw, hero) {
  const k = str(kw).trim().toLowerCase();
  const hn = str(hero).trim().toLowerCase();
  if (!k || !hn) return false;
  if (k === hn || HERO_ALIASES.has(k)) return true;
  return keywordHits(hn, k) || keywordHits(k, hn);
}

// Weighted document text for BM25: text×1 + triggers×3. Triggers are the
// author's relevance reason, so they weigh heaviest — except hero-name triggers,
// which are stripped (they would match every scene; pass heroName to enable).
// The hero's name (and aliases) are stripped from the TEXT as well: most memories
// mention the hero, so leaving it in makes every memory match every scene that names
// them. This text is ranking-only (BM25 + vectors) — the GM always sees the original.
// Rare trade: a hero named with a common word ("May") loses that token here too.
export function memoryDocText(m, heroName = "") {
  const stripHero = (s) => {
    let out = str(s);
    const names = [heroName, ...HERO_ALIASES].map((x) => str(x).trim()).filter(Boolean);
    for (const n of names) {
      const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp("\\b" + esc + "(?:['’]s)?\\b", "gi"), " ");
    }
    return out.replace(/\s+/g, " ").trim();
  };
  const text = stripHero(m && m.text);
  const trigs = (Array.isArray(m && m.triggers) ? m.triggers.map((k) => str(k).trim()).filter(Boolean) : [])
    .filter((k) => !isHeroNameTrigger(k, heroName))
    .map((k) => stripHero(k))
    .filter(Boolean);
  const trigPart = trigs.length ? ((trigs.join(" ") + " ").repeat(3)).trim() : "";
  return [text, trigPart].filter(Boolean).join(" ");
}

// Per-turn memory selection for the GM context — the lorebook rule, applied to memories.
// Manual entries (the player's own notes) are always returned, unless disabled (a disabled manual
// note is kept in the panel but never fed).
// Auto entries (pinned or not) split into three independent budgets:
//  - pinned-active: pinned entries with a non-hero owner speaking/active feed always, outside all caps.
//  - topical-gated (`gatedCap`, default MEMORY_TOPICAL_ACTIVE_CAP = 4): today's scene-gated tier —
//    the entry needs a holder in the current scene ("world" always; hero-only always since the
//    hero is always present; NPC-only any holder; hero+NPC shared needs a NON-hero holder — the
//    hero alone does not qualify). Being pinned only protects from pruning, NOT from this gate.
//  - topical-open (`openCap`, default MEMORY_TOPICAL_OPEN_CAP = 4): NO owner gate — any auto entry
//    qualifies on relevance alone, even with no holder present. Deliberate bleed for testing.
//  - name-only (`nameCap`, default MEMORY_NAME_FEED_CAP = 4): the reserved presence tier, unchanged.
// Both topical tiers share ONE ranking pass over the ungated pool (every auto entry that survives
// `recentFloor` and isn't name-only), so their scores share a scale: BM25 (text×1 + triggers×3,
// ×0.4 when no trigger appears verbatim — no trigger prefilter, so morphological variants still
// surface) fused with embedding cosine (RRF) when `hybrid.queryVec` is passed, BM25 alone
// otherwise. Zero-score entries are dropped from both tiers — an irrelevant turn sends no topical
// memories instead of recency-ordered filler. Steps: rank everything, gated takes the top
// scene-passing picks, open takes the next top picks from the same ranking with gated's picks
// removed (no second gate — leftovers included).
// `sceneNpcs` (optional) is the engine's present roster — known NPCs named in the recent
// scene or seen within the last few turns (importance is not presence). It is authoritative
// It is authoritative for the scene gate, so an NPC who is standing in the scene but hasn't been
// named in the recent chat window still counts as present (their memory can surface when its
// trigger comes up). Without it (or for owners it doesn't list) the owner's name must appear in
// the recent text as before. The open tier ignores it entirely.
// `activeNpcs` (optional) is the engine's Active roster — recent [Name] speakers. Both
// topical tiers ignore it. It is only the legacy fallback for the name-only pool (see next).
// `lastTurnNpcs` (optional) is the last 2 turns' speakers (same window as the Active roster).
// It defines the name-only pool: a presence-signal recall needs one of its non-hero holders in
// this set, so backstory comes only from whoever is talking RIGHT NOW. Without it the name-only
// tier falls back to the Active gate above (and without that, the legacy `sceneNpcs` gate —
// backwards compat for direct callers).
// `recentFloor` (optional) is the anchored-turn ordinal of the OLDEST message in the raw transcript
// window the GM is shown (RECENT EVENTS). A triggered auto entry whose event happened at turn >=
// that floor is already before the GM verbatim in that transcript, so re-listing it as a memory
// would duplicate tokens — it is skipped (manual notes carry no turn and are unaffected, as is any
// entry whose turn is unknown/older than the floor, which is the population memories exist for).
// `cap` (default MEMORY_FEED_CAP) is a backstop on gated+open combined; `nameCap`
// (default MEMORY_NAME_FEED_CAP) is the separate, reserved budget for name-only recalls — a match on a
// trigger that is just one of the entry's own owner names (presence, not topic). A `nameCap` of 0
// disables name-only recalls entirely. Manual notes are never capped.
// Pinned-active entries feed outside all caps and are never ranked. Manual notes are never capped.
// Feed order: manual notes first (player directives, timeless, input order), then pinned-active
// most-recent-first, then the gated
// topical tier most-relevant-first, then the open topical tier most-relevant-first, then the
// name-only tier most-recent-first (last-2-turns speakers only, no relevance score).
// Returns [{ m, reason: "manual"|"triggered", tier?: "pinned"|"topical-gated"|"topical-open"|"name", score?: number }].
export function memoriesForTurn(entries, { chatText = "", actionText = "", location = "", heroName = "", cap = MEMORY_FEED_CAP, gatedCap = MEMORY_TOPICAL_ACTIVE_CAP, openCap = MEMORY_TOPICAL_OPEN_CAP, nameCap = MEMORY_NAME_FEED_CAP, sceneNpcs, activeNpcs, lastTurnNpcs, recentFloor } = {}, hybrid = null) {
  const hero = str(heroName).trim();
  const hay = [chatText, actionText, location].filter(Boolean).join("\n");
  const roster = Array.isArray(sceneNpcs)
    ? sceneNpcs.map((n) => str(n).trim().toLowerCase()).filter(Boolean)
    : null;
  const activeRoster = Array.isArray(activeNpcs)
    ? activeNpcs.map((n) => str(n).trim().toLowerCase()).filter(Boolean)
    : null;
  // Last-2-turns speakers, most-recent-first (rp-engine passes speakersIn(history, 2)). The name-only
  // pool draws ONLY on these holders; null when the caller doesn't pass them (legacy path below).
  const lastTurnRoster = Array.isArray(lastTurnNpcs)
    ? lastTurnNpcs.map((n) => str(n).trim().toLowerCase()).filter(Boolean)
    : null;
  // Does an owner token match a roster NPC? Exact name, or the shorter of the two names
  // appearing as a contiguous run of tokens inside the longer — so a short owner name still matches
  // a canonical roster name ("Camilla" ↔ "Mistress Camilla DeLuna", "Captain" ↔ "Captain Orin",
  // either side may be the longer one). A run needs at least one token of 4+ chars, so a particle or
  // stopword ("von", "van", "the") can never match on its own — exact equality is still checked
  // first, so a genuinely short name ("Kai") matches when spelled out. Mirrors the text-side nameLike
  // leniency, but stricter: both sides here are names, so tokens compare by equality, not substrings.
  const matchIn = (list, t) => {
    if (!list || !list.length || !t) return false;
    if (list.includes(t)) return true;
    const toks = t.split(/\s+/);
    return list.some((rn) => {
      if (rn === t) return true;
      const rts = rn.split(/\s+/);
      const [short, long] = toks.length <= rts.length ? [toks, rts] : [rts, toks];
      if (!short.some((x) => x.length >= 4)) return false;
      for (let i = 0; i + short.length <= long.length; i++) {
        let hit = true;
        for (let j = 0; j < short.length; j++) {
          if (short[j] !== long[i + j]) { hit = false; break; }
        }
        if (hit) return true;
      }
      return false;
    });
  };
  const inRoster = (t) => matchIn(roster, t);
  const inActive = (t) => matchIn(activeRoster, t);
  // Most-recent-first within a tier: by the turn the event happened on, then by record time.
  const byRecency = (a, b) => {
    const at = typeof a.m.turn === "number" && a.m.turn >= 0 ? a.m.turn : -1;
    const bt = typeof b.m.turn === "number" && b.m.turn >= 0 ? b.m.turn : -1;
    if (at !== bt) return bt - at;
    return (b.m.ts || 0) - (a.m.ts || 0);
  };
  const manual = [];
  const topicalCands = [];
  const nameOnly = [];
  const pinnedActive = [];
  for (const m of entries || []) {
    if (!m || !str(m.text).trim()) continue;
    if (m.manual) { if (m.enabled === false) continue; manual.push({ m, reason: "manual" }); continue; }
    const toks = str(m.owner).split(/[,+]/);
    const heroLower = hero ? hero.toLowerCase() : "";
    const isHeroTok = (t) => !!t && (HERO_ALIASES.has(t) || (!!heroLower && t === heroLower));
    const isPublicTok = (t) => !t || PUBLIC_OWNERS.has(t);
    const tokPresent = (tok) => {
      const t = tok.trim().toLowerCase();
      if (inRoster(t)) return true;
      return hay ? nameLike(hay, tok.trim()) : false;
    };
    // A hero+NPC shared memory needs one of its OTHER holders present — the hero alone (always
    // in scene) must not pull a shared scene back after the NPC has left. Hero-only stays always
    // in play; NPC-only (no hero holder) stays any-holder-matches.
    const hasPublic = toks.some((tok) => isPublicTok(tok.trim().toLowerCase()));
    const hasHero = toks.some((tok) => isHeroTok(tok.trim().toLowerCase()));
    const nonHeroToks = toks.filter((tok) => {
      const t = tok.trim().toLowerCase();
      return !isPublicTok(t) && !isHeroTok(t);
    });
    let ownerInScene;
    if (hasPublic) ownerInScene = true;
    else if (hasHero && nonHeroToks.length) ownerInScene = nonHeroToks.some(tokPresent);
    else ownerInScene = toks.some((tok) => {
      const t = tok.trim().toLowerCase();
      if (isHeroTok(t)) return true;
      return tokPresent(tok);
    });
    // NOTE: no scene-gate skip here — the open tier reads entries regardless of owner
    // presence. The gated and name-only tiers filter on scenePass below.
    const scenePass = ownerInScene;
    // Skip events still inside the raw transcript window the GM sees verbatim (see recentFloor in
    // the docstring) — memories exist to carry what FELL OUT of that window.
    const evTurn = typeof m.turn === "number" && m.turn >= 0 ? m.turn : -1;
    if (typeof recentFloor === "number" && recentFloor > 0 && evTurn >= recentFloor) continue;
    const trigs = Array.isArray(m.triggers) ? m.triggers : splitKeywords(m.triggers);
    // Hero-name triggers are not topical (the hero is mentioned in nearly every scene),
    // so they neither count as verbatim matches below nor weigh into the doc text.
    const topicTrigs = trigs.filter((kw) => !isHeroNameTrigger(kw, hero));
    const matched = topicTrigs.length && hay ? topicTrigs.filter((kw) => keywordHits(hay, kw)) : [];
    // A match where EVERY trigger is merely one of the entry's own owner names surfaced on
    // presence alone (dialogue carries `[Name]`, so a present character's name is in the window
    // every turn they speak) — it goes to the reserved name-only tier instead, so it can't crowd
    // out topical ones. The name-only tier is presence-driven, so it needs a holder whose
    // presence means something: a hero-only entry has none (the hero's name is mentioned
    // constantly without anyone being present), and must never occupy a reserved slot — it
    // competes in the topical tier instead. Everything else is a topical candidate, ranked
    // by BM25 below (no trigger prefilter — a zero-verbatim-match candidate can still surface
    // on lexical relevance, penalized).
    const hasNonHeroHolder = nonHeroToks.length > 0;
    // Pinned-active tier: a pinned entry with a non-hero owner speaking/active (last-2-turns
    // speakers, fallback to the Active roster) feeds always, outside all caps. No trigger or
    // relevance needed — presence alone recalls it. Non-qualifying pinned entries fall through
    // to the normal topical/name-only path below.
    if (m.pinned && hasNonHeroHolder) {
      const speaking = lastTurnRoster
        ? nonHeroToks.some((tok) => matchIn(lastTurnRoster, tok.trim().toLowerCase()))
        : (!activeRoster || nonHeroToks.some((tok) => inActive(tok.trim().toLowerCase())));
      if (speaking) { pinnedActive.push({ m, reason: "triggered", tier: "pinned" }); continue; }
    }
    if (scenePass && matched.length && hasNonHeroHolder && !matched.some((kw) => !isOwnerNameTrigger(toks, kw, hero))) {
      // Reserved presence tier: the pool is holders who spoke in the last 2 turns (lastTurnRoster
      // from the caller; legacy fallback any Active holder). A merely present/mentioned holder
      // draws nothing — dropping (not demoting) matters,
      // because the owner-name trigger would otherwise score topically and evict a
      // genuinely relevant memory. Mixed owner+topic triggers never reach this branch,
      // so a truly relevant memory still competes in the topical tier below.
      const poolHolder = lastTurnRoster
        ? nonHeroToks.some((tok) => matchIn(lastTurnRoster, tok.trim().toLowerCase()))
        : (!activeRoster || nonHeroToks.some((tok) => inActive(tok.trim().toLowerCase())));
      if (poolHolder) nameOnly.push({ m, reason: "triggered", tier: "name" });
    } else {
      topicalCands.push({ m, reason: "triggered", tier: "topical", hasHit: matched.length > 0, scenePass });
    }
  }
  // Rank the UNGATED pool once so gated + open share one score scale. `ranked` is
  // relevance-best-first with the fused (or penalized BM25) score attached; zero-score
  // entries are dropped from both tiers.
  let ranked = [];
  if (!hay.trim()) {
    ranked = [];
  } else if (topicalCands.length) {
    try {
      const textOf = new Map();
      for (const c of topicalCands) textOf.set(c, memoryDocText(c.m, hero));
      const rankedBm25 = bm25Rank(hay, topicalCands, (c) => textOf.get(c), { stopwords: STOPWORDS });
      const hitOf = new Map();
      let maxScore = 0;
      const penalized = rankedBm25.map((r) => {
        hitOf.set(r.doc, !!r.doc.hasHit);
        const s = r.doc.hasHit ? r.score : r.score * BM25_NO_KEYWORD_PENALTY;
        if (s > maxScore) maxScore = s;
        return { cand: r.doc, score: s, index: r.index };
      });
      penalized.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return byRecency(a.cand, b.cand);
      });
      const positive = penalized.filter((p) => p.score > 0);
      const posOf = new Map(positive.map((p, rank) => [p.cand, rank]));
      // Embedding fusion (sword → blade recall). Quiet-scene guard lives in
      // the cosine floor: unrelated docs never enter the fused pool.
      const qv = hybrid && hybrid.queryVec;
      let fused = null;
      if (qv && qv.length) {
        const cosOf = new Map();
        for (const c of topicalCands) {
          const v = getCachedVec(textOf.get(c)); // queues misses for next turn
          if (!v) continue;
          const co = cosine(qv, v);
          if (co >= EMB_COS_MIN) cosOf.set(c, co);
        }
        if (cosOf.size) {
          const embRank = new Map([...cosOf.entries()].sort((a, b) => b[1] - a[1]).map(([c], rank) => [c, rank]));
          fused = fuseRrf(new Set([...posOf.keys(), ...embRank.keys()]), posOf, embRank, hitOf, BM25_NO_KEYWORD_PENALTY);
          fused.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return byRecency(a.cand, b.cand);
          });
        }
      }
      if (fused && fused.length) {
        ranked = fused.map((f) => ({ cand: f.cand, score: f.score }));
      } else if (maxScore > 0) {
        ranked = positive.map((p) => ({ cand: p.cand, score: p.score }));
      } else {
        // No-score candidates are dropped — a turn with nothing relevant sends no topical
        // memories instead of recency-ordered filler (same rule as the NPC hook tier).
        ranked = [];
      }
    } catch (e) { ranked = topicalCands.slice().sort(byRecency).map((c) => ({ cand: c, score: 0 })); }
  }
  // Gated takes the top scene-passing picks off the ranked list; open takes the next top
  // picks off the same list with gated's picks removed. One entry never feeds twice.
  const gatedBudget = typeof gatedCap === "number" && gatedCap >= 0 ? gatedCap : MEMORY_TOPICAL_ACTIVE_CAP;
  const openBudget = typeof openCap === "number" && openCap >= 0 ? openCap : MEMORY_TOPICAL_OPEN_CAP;
  const picked = new Set();
  const gatedSel = [];
  const openSel = [];
  for (const r of ranked) {
    if (gatedSel.length >= gatedBudget) break;
    if (!r.cand.scenePass) continue;
    gatedSel.push(r);
    picked.add(r.cand);
  }
  for (const r of ranked) {
    if (openSel.length >= openBudget) break;
    if (picked.has(r.cand)) continue;
    openSel.push(r);
    picked.add(r.cand);
  }
  for (const r of gatedSel) { r.cand.score = r.score; r.cand.tier = "topical-gated"; }
  for (const r of openSel) { r.cand.score = r.score; r.cand.tier = "topical-open"; }
  // Group order intact, relevance inside each group (recency tiebreak): gated first, then open.
  const byScore = (a, b) => (b.score - a.score) || byRecency(a.cand, b.cand);
  gatedSel.sort(byScore);
  openSel.sort(byScore);
  let topical = gatedSel.concat(openSel).map((r) => r.cand);
  // Total topical backstop (defaults to gated + open, so normally a no-op).
  if (typeof cap === "number" && cap >= 0 && topical.length > cap) topical.length = cap;
  // Name-only: most-recent-first, top nameCap. The pool is already last-2-turns speakers only.
  nameOnly.sort(byRecency);
  if (typeof nameCap === "number" && nameOnly.length > nameCap) nameOnly.length = Math.max(0, nameCap);
  // Pinned-active: most-recent-first, uncapped (outside gated+open+name budgets).
  pinnedActive.sort(byRecency);
  // Feed order: manual notes first (player directives, timeless, input order), then pinned-active
  // most-recent-first, then the selected topical entries most-relevant-first, then the name-only
  // tier most-recent-first (presence backstory — it carries no relevance score, so it rides last
  // instead of interleaving).
  return manual.concat(pinnedActive, topical, nameOnly);
}

// Index of the first message of the last `lagTurns` player turns. Messages at/after this index
// are considered "too fresh" (still editable/rerollable) and excluded from a roll-up.
function lagStartIndex(messages, lagTurns) {
  let count = 0;
  let i = messages.length;
  while (i > 0 && count < lagTurns) {
    i--;
    if (messages[i] && (messages[i].role === "action" || messages[i].role === "direct")) count++;
  }
  // If we ran out of turns before finding lagTurns, everything is in the lag window.
  return count >= lagTurns ? i : 0;
}

// Approximate absolute session-turn label per message: counts anchored player turns (actions +
// directs; GM-only continuations fold into the turn they extend). Consistent with the "last N
// turns" notion the GM already sees in RECENT EVENTS.
function messageTurns(messages) {
  const turns = new Array(messages.length).fill(0);
  let t = 0;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m && (m.role === "action" || m.role === "direct")) t++;
    turns[i] = t;
  }
  return turns;
}

// Split a roll-up window [start, end) into chunk boundaries so no single summarizer call ever
// covers more than `maxTurns` anchored player turns (action + direct roles — the same turn
// notion messageTurns/lagStartIndex use). Each chunk holds WHOLE turns: it ends right before
// the action that would exceed the budget, so a turn's narration is never split from its
// action. Leading non-action messages stay with the first chunk, trailing ones with the last.
// Returns an array of [chunkStart, chunkEnd] pairs.
function splitRollUpChunks(messages, start, end, maxTurns) {
  const per = Math.max(1, Math.floor(Number(maxTurns)) || 1);
  const starts = [];
  for (let i = start; i < end; i++) {
    const m = messages[i];
    if (m && (m.role === "action" || m.role === "direct")) starts.push(i);
  }
  if (starts.length <= per) return [[start, end]];
  const out = [];
  for (let j = 0; j < starts.length; j += per) {
    const cs = j === 0 ? start : starts[j];
    const ce = j + per < starts.length ? starts[j + per] : end;
    if (ce > cs) out.push([cs, ce]);
  }
  return out.length ? out : [[start, end]];
}

// The plugin's token counter for budget math (same read as ctx-meter.js / context-budget.js).
// Only the counter is used — the packing cap is PERCHANCE_INPUT_CAP (see perchance-limits.js), never the
// plugin's conservative ideal target. Null when unknown → the char estimator below.
function rollUpMeter(genText) {
  try {
    const meta = genText && genText({ getMetaObject: true });
    return {
      count: meta && typeof meta.countTokens === "function" ? ((t) => meta.countTokens(String(t))) : null,
    };
  } catch (e) { return { count: null }; }
}

// Per-route Perchance check for engine-side budget switches (see isPerchanceAIFor
// in ai-provider.js). Cached dynamic import: ai-provider.js touches window at
// load, so a static import would break non-DOM importers of this module.
// Unknown (import failed / no check fn) fails safe to true — Perchance is the
// default provider and its small window is the conservative assumption.
let _isPerchanceMod = null, _isPerchanceProbed = false;
// Per-route variant (see rp-engine.js): the memory roll-up rides "memory", so
// its chunk packing follows the Memories toggle, not the global provider.
async function isPerchanceAIFor(route) {
  try {
    if (!_isPerchanceProbed) { _isPerchanceProbed = true; _isPerchanceMod = await import("./ai-provider.js"); }
    const f = _isPerchanceMod && _isPerchanceMod.isPerchanceAIFor;
    if (typeof f === "function") return !!f(route);
  } catch (e) {}
  return true;
}

// The EXISTING MEMORIES reference text (header + listed entries), shared by the budget math
// and the per-chunk prompt build — one construction so the two can never drift. Base = pinned
// plus newest `ROLLUP_REF_CAP` unpinned; when `chunkText` is given, out-of-window unpinned
// entries are BM25-ranked against it (same ranker + doc text the feed uses) and the top
// `ROLLUP_REF_TOPUP` with score > 0 ride along, so an old thread the chunk re-opens can still
// be resolved/updated by exact copy. The packing measurement calls without `chunkText` (base
// only); the margin below absorbs the bounded top-up on the send path.
function buildRefText(existingList, heroName, chunkText = "") {
  const pinnedRef = existingList.filter((m) => m.pinned);
  const sortedUnpinned = existingList.filter((m) => !m.pinned)
    .sort((a, b) => ((typeof a.turn === "number" && a.turn >= 0 ? a.turn : -1) - (typeof b.turn === "number" && b.turn >= 0 ? b.turn : -1)) || ((a.ts || 0) - (b.ts || 0)));
  const newestRef = sortedUnpinned.slice(-ROLLUP_REF_CAP);
  const existingRef = pinnedRef.concat(newestRef);
  let topUp = [];
  const query = str(chunkText).trim();
  if (query) {
    const inBase = new Set(existingRef);
    const outOfWindow = existingList.filter((m) => !m.pinned && !inBase.has(m));
    if (outOfWindow.length) {
      try {
        const ranked = bm25Rank(query, outOfWindow, (m) => memoryDocText(m, heroName), { stopwords: STOPWORDS });
        topUp = ranked.filter((r) => r.score > 0).slice(0, ROLLUP_REF_TOPUP).map((r) => r.doc);
      } catch (e) { topUp = []; }
    }
  }
  const listed = existingRef.concat(topUp);
  const refNote = listed.length < existingList.length
    ? ` (${listed.length} of ${existingList.length} listed — pinned plus the newest ${ROLLUP_REF_CAP}${topUp.length ? ` plus ${topUp.length} relevant older` : ""}; only entries listed above can be named in resolve/ownerUpdates — never invent an entry's text)`
    : "";
  const existingTxt = listed.map((m) => {
    const turn = typeof m.turn === "number" && m.turn >= 0 ? `, turn ${m.turn}` : "";
    return `- [${ownerLabel(m.owner, heroName)}${turn}] ${m.text}`;
  }).join("\n") || "(none)";
  return "EXISTING MEMORIES:" + refNote + "\n" + existingTxt;
}

// Render one chunk's transcript lines exactly as the summarizer sees them (turn headers,
// speaker tags, tracker-stripped text), so packing measures what will actually be sent.
function renderRollUpLines(messages, turnAt, cs, ce) {
  const lines = [];
  let turnMin = Infinity, turnMax = -Infinity;
  let lastTurn = null;
  for (let i = cs; i < ce; i++) {
    const m = messages[i];
    if (isNonStoryMessage(m)) continue;
    const t = turnAt[i] || 0;
    turnMin = Math.min(turnMin, t);
    turnMax = Math.max(turnMax, t);
    if (t !== lastTurn) { lines.push(`[TURN ${t}]`); lastTurn = t; }
    const text = extractTrackers(m.text).text; // defensive: a legacy narration may still hold a [TRACKERS] block — never feed tracked state
    if (m.role === "action") lines.push(`PLAYER: ${text}`);
    // Linked lines use their canonical roster name so owners stay unified ("Garreth" still
    // attributes to "Captain Garreth"); the transcript bubble keeps the GM's variant.
    else if (m.role === "npc") lines.push(`${String(m.npcKey || m.name || "?").toUpperCase()}: ${text}`);
    else if (m.role === "thought") lines.push(`${String(m.npcKey || m.name || "?").toUpperCase()} (inner): ${text}`);
    else lines.push(`GM: ${text}`);
  }
  if (!Number.isFinite(turnMin)) { turnMin = turnMax = 0; }
  return { lines, turnMin, turnMax };
}

// Greedy-pack one turn-chunk's whole turns into maximal-fill sub-chunks: turns stay in order,
// so filling each call to the brim uses the fewest calls. `fixed` is the measured prompt cost
// without any transcript, `limit` the input cap, `measure` the token counter. A story-less span
// folds into its neighbor for free; a lone giant turn still goes out alone (progress always).
function packTurnChunk(messages, turnAt, cs, ce, fixed, limit, measure) {
  const bounds = [cs];
  for (let i = cs; i < ce; i++) {
    const m = messages[i];
    if (i > cs && m && (m.role === "action" || m.role === "direct")) bounds.push(i);
  }
  bounds.push(ce);
  const out = [];
  let sub = cs, acc = 0;
  for (let k = 0; k + 1 < bounds.length; k++) {
    const t = renderRollUpLines(messages, turnAt, bounds[k], bounds[k + 1]).lines.join("\n");
    if (!t.trim()) continue;
    const tc = measure(t);
    if (acc > 0 && fixed + acc + tc > limit) { out.push([sub, bounds[k]]); sub = bounds[k]; acc = 0; }
    acc += tc;
  }
  if (ce > sub) out.push([sub, ce]);
  return out.length ? out : [[cs, ce]];
}

// Roles that are meta-layer, not story — never fed to the memory summarizer. Player-only
// images, check pips, scene breaks, OOC directives and CYOA options are excluded; the
// narration that follows them already carries what happened.
function isNonStoryMessage(m) {
  return !m || m.role === "image" || m.role === "check" || m.role === "meta" || m.role === "direct" || m.role === "choice";
}

// Recover one JSON object from an LLM reply — strict parse, then the vendored jsonrepair.
async function parseJsonObject(t) {
  const s = String(t || "").trim();
  const fenced = (s.match(/```[a-zA-Z]*\s*([\s\S]*?)```/) || [])[1];
  const cands = [fenced, s].filter(Boolean);
  const chunks = [];
  for (const c of cands) {
    const o = c.indexOf("{");
    const e = c.lastIndexOf("}");
    if (o >= 0 && e > o) chunks.push(c.slice(o, e + 1));
  }
  for (const ch of chunks) { try { return JSON.parse(ch); } catch (_) {} }
  const rep = await import("../vendor/jsonrepair.mjs").then((m) => m.jsonrepair);
  for (const ch of chunks) { try { return JSON.parse(rep(ch)); } catch (_) {} }
  return null;
}

// The full roll-up prompt, shared by the packing measurement and the per-chunk send — one
// construction so the measured shell and the sent prompt can never drift. `block` is the
// chunk's transcript; everything else is the fixed shell for that chunk.
function buildRollUpInstruction({ block, multi, partCount, partIdx, prevSituation, prevThreads, digestTxt, refText }) {
  return [
        "You are the memory keeper for a text-based RPG. Below are RECENT EVENTS from the story, grouped under the [TURN n] header they happened on (most recent last), plus the STANDING RECORD — the LATEST SITUATION and OPEN THREADS exactly as the previous roll-up left them.",
        ...(multi ? [`NOTE: this bake is running in ${partCount} chronological parts (a long backlog and/or a transcript split to fit the context window) — this is part ${partIdx + 1} of ${partCount}. Summarize ONLY the RECENT EVENTS below; the STANDING RECORD already reflects the earlier parts.`] : []),
        "",
        "PLAYER/HERO NAME: {{user}}",
        "",
        "STANDING RECORD (update it — do not write from scratch):",
        "",
        "LATEST SITUATION (as last recorded):",
        prevSituation || "(none yet)",
        "",
        "OPEN THREADS (as last recorded):",
        prevThreads.length ? prevThreads.map((t) => "- " + t).join("\n") : "(none yet)",
        "",
        "From these events:",
        "1) Write the LATEST SITUATION — ONE sentence, present tense, on where the hero is and what is happening right now. UPDATE the LATEST SITUATION above instead of replacing it: keep every element that still holds (a standing war, a curse, an alliance, a long pursuit, a hidden identity...) and fold in what these events changed. If the events contradict it, the events win — reflect the current truth.",
        "2) Record the events WORTH REMEMBERING long-term as durable memory entries. Include: plot developments, first meetings, relationship changes, promises made or broken, secrets revealed or learned (and by whom), alliances, betrayals, grudges, injuries, deaths, important items gained/lost/given, big reveals, discoveries, lasting location changes, and any fact a character now knows that will matter later. SKIP: trivial banter, pure atmosphere, routine actions, minor fights, and anything already implied by a more important entry.",
        "For each memory entry you write:",
        "- text: 1–2 factual sentences, past tense, third person, using characters' exact names — SELF-CONTAINED (each entry is read alone): NEVER write a bare pronoun or vague pointer without its explicit antecedent IN THE SAME entry.",
        "- turn: the [TURN n] header above the line(s) where the event happened.",
        `- owner: WHO knows this fact — "world" ONLY when it is genuinely public (town talk, proclaimed, spread beyond the scene). A fact merely shared by everyone present is NOT public: name exactly those present instead (a family dinner belongs to the family members, e.g. "Shipo, Lysandra, Mira"). Otherwise name exactly the character(s) who hold that knowledge, separating several names with ", ". A memory is NOT limited to secrets: a fact the hero and an NPC both witnessed belongs to both, a hero-only fact (something only the hero learned) names the hero, and NPC-private knowledge the hero hasn't learned (a secret agenda, a hidden identity) names just those NPCs (e.g. "Mira, Kael"). Never mark a fact as known by a character who was not there or was not told.`,
        "- triggers: 3–6 short lowercase keywords that should recall this memory later — the words people would say when the topic comes back up (names, places, objects, concepts). NOT generic words like \"went\", \"said\", \"saw\".",
        "3) RESOLVE existing memories that these events made FALSE or OBSOLETE — superseded, contradicted, or reversed (the lost pendant was just found; a presumed-dead character just returned; an oath was just broken). For each, add its EXACT text — copied character-for-character from the EXISTING MEMORIES list below — to the \"resolve\" array; that memory will be removed, so if the fact still matters in its new form, capture the CURRENT state as a fresh entry in \"memories\". NEVER resolve a memory merely for being old, and never resolve a fact that still stands.",
        "4) SPREAD OWNERSHIP when these events shared knowledge that an EXISTING MEMORY says only some character(s) knew — a secret was revealed, a private discovery became known to others, a hidden identity came out. For each such memory add an object to \"ownerUpdates\": \"text\" = its EXACT text copied from EXISTING MEMORIES, \"owner\" = who knows it NOW (the full current list — \"world\" only once it is genuinely public beyond those present, otherwise every holder, e.g. \"Shipo, Lysandra\"). Do NOT write a duplicate entry for the same fact — updating its owners is enough.",
        "5) List OPEN THREADS — 4 to 6 short one-line items (under ~15 words each) capturing what is IN MOTION right now: the hero's current objectives, unresolved promises or oaths, live grudges, rivalries or romances, unfulfilled quests, approaching threats. START from the OPEN THREADS above: keep every thread that is still in motion (reword it if its shape changed), drop any these events resolved or made obsolete, and add any genuinely new threads that emerged. Not history — what the story is reaching toward. If nothing is clearly in motion, describe the most pressing present situation.",
        "6) Never repeat facts already covered by the EXISTING MEMORIES below, the DISTANT PAST digest (if any), or the OPEN THREADS you are keeping.",
        "",
        refText,
        ...(digestTxt
          ? ["", "DISTANT PAST (world knowledge from long ago that fell off the live memory list as it filled up — kept only for continuity; do NOT re-record these facts):", digestTxt]
          : []),
        "",
        "RECENT EVENTS:",
        block,
        "",
        'Reply with ONLY a JSON object, no prose and no code fence, with exactly these keys: {"situation": "<one present-tense sentence>", "memories": [{"text": "...", "turn": 12, "owner": "world", "triggers": ["mill", "dagger", "lyra"]}], "resolve": ["<exact text of an EXISTING MEMORY that is now false or obsolete>"], "ownerUpdates": [{"text": "<exact text of an EXISTING MEMORY>", "owner": "<who knows it now>"}], "openThreads": ["<one-line thread>", "..."]}'
      ].join("\n");
}

export class MemorySystem {
  constructor(genText) {
    this.genText = genText;
    this.lastRollUpFailed = false; // true when the most recent roll-up attempt hit an unusable LLM reply
    this.lastRollUpReport = null;  // { added, resolved, spread } of the most recent successful roll-up
    this.lastRollUpCalls = null;   // exact prompts of the most recent roll-up pass, for the ctx meter: { turn, chunks: [{ idx, count, turnMin, turnMax, text }] }
  }

  // Summarize the events since the last roll-up into durable auto-memories, and refresh the
  // one-line latest situation. The same call also REVISES the existing store where the events demand
  // it: memories these events made false/obsolete are resolved away (exact-text match first, then a
  // conservative fuzzy fallback for paraphrased targets — pinned entries are safe), memories whose
  // knowledge spread get their owners merged, and the list of OPEN THREADS (what's in motion right
  // now) is refreshed. Every recorded memory carries the turn it happened on, which character(s)
  // hold that knowledge (world = public), and trigger words for later recall. The EXISTING MEMORIES
  // reference shown to the summarizer is capped (pinned plus the newest ROLLUP_REF_CAP unpinned,
  // plus a BM25 relevance top-up of older entries the chunk is about — see below), so the
  // don't-repeat/copy reference stays tight at very long horizons; the full
  // store is still what resolve/owner-updates match against. The summarizer also receives the
  // PREVIOUS latestSituation and openThreads and is told to UPDATE them, not rewrite from scratch —
  // standing arcs survive quiet windows instead of silently evaporating.

  // A long-unprocessed backlog is worked oldest-first in chronological CHUNKS of at most
  // MEMORY_EVERY_TURNS anchored turns per summarizer call (the same cadence that fires roll-ups)
  // — see splitRollUpChunks — so a stall, an import, or an early-turn rewrite that pulled the
  // cursor back can never send dozens of turns in one giant call. On Perchance AI turns are
  // additionally greedy-packed into maximal-fill sub-chunks (whole turns only, each candidate
  // call measured exactly) so no single call overflows the input limit; external providers
  // keep turn-only chunks. Each chunk
  // updates the standing record in turn, and the cursor advances per completed chunk, so a
  // failed chunk retries only its remainder (see fail() below).
  // Returns the number of NEW memories recorded (0 = nothing new; the roll-up cursor still
  // advances past every successfully summarized chunk, so a stale window is never re-summarized
  // forever). On an unusable LLM reply the completed chunks keep their progress while the
  // remainder is retried: lastRollUpFailed is set and the cadence marker backs off to
  // ROLLUP_RETRY_GAP_TURNS so the window is retried soon without re-firing every turn. After a
  // successful run, lastRollUpReport = { added, resolved, spread } lets the UI summarize the pass
  // (on a partially-completed run it holds the partial totals).
  async rollUp(state) {
    this.lastRollUpReport = null;
    this.lastRollUpFailed = false;
    this.lastRollUpCalls = null;
    const total = state.messages.length;
    const start = Math.min(state.lastAutoMemoryAt || 0, total);
    const end = Math.max(start, lagStartIndex(state.messages, MEMORY_LAG_TURNS));
    // Anything to bake at all? (Player-only images / check pips / scene breaks / OOC
    // directives / CYOA options are not story — the narration that follows them already
    // carries what happened.)
    let hasStory = false;
    for (let i = start; i < end; i++) {
      if (!isNonStoryMessage(state.messages[i])) { hasStory = true; break; }
    }
    if (!hasStory) return 0;

    const heroName = String(((state.character || {}).name) || "").trim() || "the hero";
    const turnAt = messageTurns(state.messages);
    if (!state.memories) state.memories = { auto: [], manual: [], digest: "" };
    if (!Array.isArray(state.memories.auto)) state.memories.auto = [];
    const existingList = state.memories.auto;

    // Chunk the window so each summarizer call covers at most MEMORY_EVERY_TURNS anchored
    // turns — the same cadence that governs how often roll-ups fire.
    // ...then, on Perchance AI only, greedy-pack turns into maximal-fill sub-chunks so each
    // call carries as many turns as fit under PERCHANCE_INPUT_CAP (see perchance-limits.js): the
    // fixed shell is measured EXACTLY with the same builder the send path uses (empty block),
    // and each turn-span is measured the same way. Turns stay ordered, so filling each call to
    // the brim uses the fewest calls. External providers keep turn-only chunks.
    let chunks = splitRollUpChunks(state.messages, start, end, MEMORY_EVERY_TURNS);
    if (await isPerchanceAIFor("memory")) {
      const meter = rollUpMeter(this.genText);
      const measure = meter.count || ((s) => Math.ceil(String(s).length / PERCHANCE_CHARS_PER_TOKEN));
      const prevSituation0 = str(state.latestSituation).trim();
      const prevThreads0 = (Array.isArray(state.openThreads) ? state.openThreads : []).map((t) => str(t).trim()).filter(Boolean);
      const digestTxt0 = typeof state.memories.digest === "string" ? state.memories.digest.trim() : "";
      const refText0 = buildRefText(existingList, heroName);
      // Shell measured without the multi-note (it only exists when packing splits) and without
      // the per-chunk BM25 top-up (bounded to ROLLUP_REF_TOPUP entries): the
      // margin below absorbs both, plus ref growth as sub-chunks record.
      const fixedTokens = measure(buildRollUpInstruction({ block: "", multi: false, partCount: 1, partIdx: 0, prevSituation: prevSituation0, prevThreads: prevThreads0, digestTxt: digestTxt0, refText: refText0 }));
      const limit = PERCHANCE_INPUT_CAP - ROLLUP_TOKEN_MARGIN;
      const packed = [];
      for (const [cs, ce] of chunks) packed.push(...packTurnChunk(state.messages, turnAt, cs, ce, fixedTokens, limit, measure));
      if (packed.length) chunks = packed;
    }
    const multi = chunks.length > 1;

    // Exact (case-insensitive) text lookup against the auto list — the summarizer is told to copy
    // existing texts character-for-character, so a verbatim match is required before we trust it.
    const autoIndexByText = (list, text) => {
      const key = str(text).trim().toLowerCase();
      if (!key) return -1;
      return list.findIndex((m) => str(m.text).trim().toLowerCase() === key);
    };

    let added = 0, resolved = 0, spread = 0;
    let completed = start;
    // Exact prompts SENT this pass, for the ctx meter's background section (published per
    // chunk before each send, so even a chunk whose reply later proves unusable is recorded —
    // it still consumed context).
    const sentChunks = [];
    // A chunk whose LLM reply was unusable (threw, came back empty, or wasn't JSON): keep the
    // cursor where the last COMPLETED chunk left it — markRollUpFailed deliberately leaves
    // lastAutoMemoryAt alone — and back the cadence marker off so the remainder is retried
    // soon without re-firing every turn.
    const fail = () => {
      state.lastAutoMemoryAt = completed;
      this.markRollUpFailed(state);
      this.lastRollUpReport = (added || resolved || spread) ? { added, resolved, spread } : null;
      return added;
    };

    for (let ci = 0; ci < chunks.length; ci++) {
      const [cStart, cEnd] = chunks[ci];
      const { lines, turnMin, turnMax } = renderRollUpLines(state.messages, turnAt, cStart, cEnd);
      // A chunk with no story lines (only OOC/directs) needs no summarizer call — just advance.
      if (!lines.length) { completed = cEnd; state.lastAutoMemoryAt = cEnd; continue; }
      const block = lines.join("\n");

      // The EXISTING MEMORIES block is the summarizer's reference for "don't repeat", exact-copy
      // resolve, and ownership spreads — but the model can only copy what it sees, so the block is
      // capped: pinned entries plus the newest ROLLUP_REF_CAP unpinned (recency = the turn the
      // memory happened on, then when it was recorded), plus a BM25 relevance top-up of older
      // entries the chunk's transcript is actually about (see buildRefText). Rebuilt per chunk so each call sees what
      // earlier chunks in this same pass just recorded. The resolve/owner-update matching below
      // still runs against the FULL store, so nothing outside the window is ever wrongly
      // dropped — it just can't be named by the model until it rolls back into view.
      const refText = buildRefText(existingList, heroName, block);

      const prevSituation = str(state.latestSituation).trim();
      const prevThreads = (Array.isArray(state.openThreads) ? state.openThreads : []).map((t) => str(t).trim()).filter(Boolean);
      const digestTxt = typeof state.memories.digest === "string" ? state.memories.digest.trim() : "";

      const instruction = buildRollUpInstruction({ block, multi, partCount: chunks.length, partIdx: ci, prevSituation, prevThreads, digestTxt, refText });

      sentChunks.push({ idx: ci, count: chunks.length, turnMin, turnMax, text: subUser(instruction, heroName) });
      this.lastRollUpCalls = { turn: state.turn || 0, chunks: sentChunks.slice() };

      let raw = "";
      try {
        const res = await this.genText({ instruction: subUser(instruction, heroName), route: "memory", maxTokens: 2200 });
        raw = String((res && res.text) || res || "").trim();
      } catch (e) {
        console.error("memory roll-up failed:", e);
        return fail();
      }
      if (!raw) { this.markRollUpFailed(state); state.lastAutoMemoryAt = completed; this.lastRollUpReport = (added || resolved || spread) ? { added, resolved, spread } : null; return added; }
      const parsed = await parseJsonObject(raw);
      if (!parsed || typeof parsed !== "object") {
        console.warn("[memory] roll-up reply wasn't JSON — skipping this chunk.", raw.slice(0, 200));
        return fail();
      }

      const latest = str(parsed.situation ?? parsed["latest situation"] ?? parsed["current situation"] ?? parsed.currentSituation ?? parsed.latestSituation).replace(/^(latest situation|current situation):\s*/i, "").trim();
      if (latest && !/^(none|n\/a|no change|same as before)$/i.test(latest)) state.latestSituation = latest;

      // RESOLVE: drop existing auto memories that the new events superseded/contradicted. Pinned
      // entries are safe — pinning protects an entry from BOTH pruning and automatic supersession
      // (the player can still delete or rewrite one by hand); manual notes live in a separate list
      // and are never targeted. Exact copy is matched first; when the summarizer paraphrased instead
      // (no verbatim hit) a conservative fuzzy fallback still catches the near-miss — see
      // fuzzyResolveIndex — so a superseded fact is not left standing just because of wording.
      const resolveList = Array.isArray(parsed.resolve) ? parsed.resolve : [];
      for (const r of resolveList) {
        const t = str(typeof r === "string" ? r : (r && r.text)).trim();
        if (!t) continue;
        let idx = autoIndexByText(existingList, t);
        if (idx < 0) idx = fuzzyResolveIndex(existingList, t);
        if (idx < 0) continue;
        if (existingList[idx].pinned) continue;
        existingList.splice(idx, 1);
        resolved++;
      }

      // OWNER-UPDATE: spread knowledge — a memory whose fact is unchanged but whose holder set grew
      // (a secret told, a discovery shared) gets its owners merged with the new list instead of being
      // duplicated. Merging (not replacing) keeps any holder the summarizer didn't re-list. Matched
      // EXACTLY only: merging a wrong entry's owners would hand knowledge to characters who never
      // learned it, so the fuzzy leniency that guards resolve (a removal) must not apply here.
      const ownerUpdates = Array.isArray(parsed.ownerUpdates) ? parsed.ownerUpdates : [];
      for (const u of ownerUpdates) {
        if (!u || typeof u !== "object") continue;
        const t = str(u.text).trim();
        const o = str(u.owner).trim();
        if (!t || !o) continue;
        const idx = autoIndexByText(existingList, t);
        if (idx < 0) continue;
        existingList[idx].owner = normalizeOwner(existingList[idx].owner + ", " + o, heroName);
        spread++;
      }

      // OPEN THREADS: what is in motion right now (objectives, unresolved promises, live
      // grudges/relationships) — refreshed on the same cadence as the latest situation, always fed to
      // the GM so standing goals survive even as individual memories age out of the per-turn feed.
      const threadList = Array.isArray(parsed.openThreads) ? parsed.openThreads : (Array.isArray(parsed.threads) ? parsed.threads : null);
      if (threadList) {
        state.openThreads = threadList
          .map((t) => str(typeof t === "string" ? t : (t && (t.text || t.thread))).replace(/^[-•*]\s*/, "").trim())
          .filter((t) => t && !/^(none|nothing|n\/a|no open threads)$/i.test(t))
          .slice(0, 8)
          .map((t) => t.slice(0, 160));
      }

      const seen = new Set(existingList.map((m) => str(m.text).toLowerCase()));
      // Near-duplicate guard: past the exact-text dedup above, skip a NEW entry whose wording is a
      // rehash of a fact we already keep — the summarizer often restates an existing entry in
      // slightly different words (or twice within one reply). Two entries count as the same fact
      // when >= ~70% of the new one's content words also appear in one kept entry OR in another
      // entry accepted earlier in this batch; only judged when the new entry has >=4 content words
      // (short entries are too sparse to compare safely). Rebuilt per chunk from the current
      // store, so entries recorded by earlier chunks in this same pass dedup too.
      const guardSets = existingList.map((m) => contentWords(m.text));
      const isNearDup = (words) => {
        if (words.size < 4) return false;
        for (const gs of guardSets) {
          if (!gs.size) continue;
          let hit = 0;
          for (const w of words) if (gs.has(w)) hit++;
          if (hit / words.size >= 0.7) return true;
        }
        return false;
      };
      const batch = Array.isArray(parsed.memories) ? parsed.memories : (Array.isArray(parsed.entries) ? parsed.entries : []);
      for (const e of batch) {
        if (!e || typeof e !== "object") continue;
        const text = str(e.text).trim();
        if (!text) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const words = contentWords(text);
        if (isNearDup(words)) continue;
        guardSets.push(words);
        let turn = Number(e.turn);
        if (!Number.isFinite(turn)) turn = turnMax;
        else turn = Math.max(turnMin, Math.min(turnMax, Math.round(turn)));
        const owner = normalizeOwner(e.owner, heroName);
        let triggers = splitKeywords(e.triggers);
        if (!triggers.length) triggers = deriveTriggers(text);
        existingList.push({ text, turn, owner, triggers, pinned: false, ts: Date.now() });
        added++;
      }

      completed = cEnd;
      state.lastAutoMemoryAt = cEnd;
    }

    // The auto store is uncapped — every baked entry is kept (pinned entries sort first),
    // and the player curates by hand (pin, edit, delete). Feeding, the roll-up reference
    // window, and the digest each carry their own bounds, so store size never leaks into them.
    const pinned = existingList.filter((m) => m.pinned);
    const unpinned = existingList.filter((m) => !m.pinned);
    state.memories.auto = pinned.concat(unpinned);

    // Advance the roll-up cursor to just before the lagged turns: the excluded turns are still
    // editable/rerollable, so they get picked up by the NEXT roll-up once they've aged.
    state.lastAutoMemoryAt = end;
    state.lastAutoMemoryTurn = state.turn || 0;
    state.latestSituationTurn = state.turn || 0; // the standing record was just re-baked — the GM's age tag restarts
    this.lastRollUpReport = { added, resolved, spread };
    return added;
  }

  // A roll-up attempt whose LLM reply was unusable (threw, came back empty, or wasn't JSON).
  // The roll-up cursor (lastAutoMemoryAt) is deliberately NOT advanced — the window still needs
  // baking — but leaving the cadence marker where it is would make the cadence check re-fire on
  // EVERY subsequent send, so it is backed off to fire again ~ROLLUP_RETRY_GAP_TURNS later.
  // lastRollUpFailed stays set until the next attempt begins (rollUp resets it up top) so the UI
  // can surface that a roll-up is pending/retrying.
  markRollUpFailed(state) {
    this.lastRollUpFailed = true;
    this.lastRollUpReport = null;
    state.lastAutoMemoryTurn = (state.turn || 0) - MEMORY_EVERY_TURNS + ROLLUP_RETRY_GAP_TURNS;
  }

  // Rewind the durable memory store after the story's PAST was rewritten — an action edited, a GM
  // reply edited/re-rolled/switched to another version, or a whole turn deleted. Auto memories
  // baked from turns at or after `ordinalK` (a 1-based anchored player turn; the caller computes it
  // from the message region it is about to mutate) may now contradict the transcript, so they are
  // dropped: pinned entries are safe (pin = protection from every automatic removal, including
  // this one — the player can still delete/rewrite them by hand) and manual notes are never
  // touched. The roll-up cursor is pulled back to that turn so the next roll-up re-bakes the
  // rewritten span from the edited transcript (surviving pre-rewrite memories dedup against it,
  // and the resolve pass reconciles anything that now contradicts them).
  // `bakedOrdinal` = the anchored-turn ordinal the roll-up cursor had reached BEFORE the mutation
  // (computed by the caller against the pre-mutation transcript). If the rewritten region was never
  // baked (still inside the lag window / past the cursor), nothing is dropped and only the cursor
  // is clamped when deletions shrank the transcript past it — the cursor>total case that used to
  // stall roll-ups forever (an empty window returned 0 without advancing, permanently).
  // Returns how many auto memories were dropped.
  rewindFromTurn(state, ordinalK, bakedOrdinal) {
    const k = Math.max(1, Math.floor(Number(ordinalK)) || 1);
    const msgs = state.messages || [];
    const total = msgs.length;
    if (k > (bakedOrdinal || 0)) {
      const cur = state.lastAutoMemoryAt || 0;
      if (cur > total) state.lastAutoMemoryAt = total;
      return 0;
    }
    const list = state.memories && state.memories.auto ? state.memories.auto : [];
    let removed = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i];
      if (m && !m.pinned && typeof m.turn === "number" && m.turn >= k) { list.splice(i, 1); removed++; }
    }
    // Re-point the cursor at the first message of turn k in the CURRENT transcript so the next
    // roll-up re-bakes the rewritten span (or at the end, when that turn no longer exists).
    let seen = 0;
    let cursor = total;
    for (let i = 0; i < total; i++) {
      const m = msgs[i];
      if (m && (m.role === "action" || m.role === "direct")) {
        seen++;
        if (seen === k) { cursor = i; break; }
      }
    }
    state.lastAutoMemoryAt = cursor;
    if (removed) {
      // Make the NEXT turn re-bake the rewound span (the edit/reroll/delete itself stays free of
      // AI calls): the cadence trigger fires once `lastAutoMemoryTurn` falls >= MEMORY_EVERY_TURNS
      // behind the current turn.
      state.lastAutoMemoryTurn = (state.turn || 0) - MEMORY_EVERY_TURNS;
    }
    return removed;
  }

  // --- manual memories (the player's pinned notes — never pruned; fed only while switched on) ---
  // Notes switched ON beyond MANUAL_ENABLED_CAP would flood the GM feed, so a note added while the
  // cap is already full lands OFF (kept, never sent) rather than being refused — the player's text
  // is never lost, and they choose which note to switch off to make room. Returns the new entry.
  addManual(state, text) {
    const t = text.trim();
    if (!t) return null;
    const entry = {
      text: t,
      manual: true,
      pinned: true,
      enabled: manualEnabledCount(state) < MANUAL_ENABLED_CAP,
      ts: Date.now(),
      owner: String(((state.character || {}).name) || "").trim() || "the hero",
      triggers: deriveTriggers(t),
      turn: null
    };
    state.memories.manual.push(entry);
    return entry;
  }
  // Hand-added AUTO entry — the same shape the roll-up bakes (dated, unpinned, triggers
  // derived when the caller passes none), so it feeds on owner-presence + relevance like any
  // roll-up entry instead of gluing itself into every reply the way a manual note does.
  // Returns the new entry (null on empty text).
  addAuto(state, { text, owner, triggers, turn, pinned } = {}) {
    const t = str(text).trim();
    if (!t) return null;
    const heroName = str((state.character || {}).name).trim();
    let trigs = Array.isArray(triggers) ? splitKeywords(triggers) : (str(triggers).trim() ? splitKeywords(triggers) : []);
    if (!trigs.length) trigs = deriveTriggers(t);
    const entry = {
      text: t,
      turn: (typeof turn === "number" && Number.isFinite(turn) && turn >= 0) ? Math.round(turn) : null,
      owner: str(owner).trim() ? normalizeOwner(owner, heroName) : "world",
      triggers: trigs,
      pinned: !!pinned,
      ts: Date.now(),
    };
    if (!Array.isArray(state.memories.auto)) state.memories.auto = [];
    state.memories.auto.push(entry);
    return entry;
  }
  // Apply a field patch { text?, owner?, triggers?, turn?, pinned? } to an entry: owner is
  // canonicalized (aliases → hero name, "everyone" → world), triggers are split/normalized,
  // and text must be non-empty. Auto entries take turn/pinned from the patch; manual entries
  // (durable player notes) are always pinned and undated, so those two fields are forced.
  applyPatch(state, listKey, i, patch, { allowTurn = false } = {}) {
    const list = state.memories[listKey];
    const m = list && list[i];
    if (!m) return;
    const p = patch || {};
    if (str(p.text).trim()) {
      // Reworded facts may move numbers differently — the tracker call's consumption stamp dies
      // with the old wording so the new text gets applied once.
      if (str(p.text).trim() !== m.text) m.trackerApplied = false;
      m.text = str(p.text).trim();
    }
    if (p.owner !== undefined) {
      const no = normalizeOwner(p.owner, str((state.character || {}).name).trim());
      if (no !== m.owner) m.trackerApplied = false;
      m.owner = no;
    }
    if (p.triggers !== undefined) m.triggers = splitKeywords(p.triggers);
    if (allowTurn) {
      if (typeof p.turn === "number" && Number.isFinite(p.turn) && p.turn >= 0) m.turn = Math.round(p.turn);
      else if (p.turn === null) m.turn = null;
      if (typeof p.pinned === "boolean") m.pinned = p.pinned;
    } else {
      m.turn = null;
      m.pinned = true;
      if (typeof p.enabled === "boolean") m.enabled = p.enabled;
    }
  }
  updateManual(state, i, patch) {
    this.applyPatch(state, "manual", i, patch);
  }
  removeManual(state, i) {
    state.memories.manual.splice(i, 1);
  }
  // Manual-note enable switch: a note is "enabled" unless explicitly false, so toggling is
  // `enabled = (enabled === false)`. Default-on means legacy saves (which have no flag) stay fed.
  // Switching ON is refused once MANUAL_ENABLED_CAP notes are already on: returns "capped" so the
  // caller can explain why, and the note is left off rather than silently overflowing the feed.
  toggleManualEnabled(state, i) {
    const m = state.memories.manual[i];
    if (!m) return;
    const turningOn = m.enabled === false;
    if (turningOn && manualEnabledCount(state) >= MANUAL_ENABLED_CAP) return "capped";
    m.enabled = turningOn;
    return turningOn ? "on" : "off";
  }
  removeAuto(state, i) {
    state.memories.auto.splice(i, 1);
  }
  updateAuto(state, i, patch) {
    this.applyPatch(state, "auto", i, patch, { allowTurn: true });
  }
  togglePin(state, i) {
    state.memories.auto[i].pinned = !state.memories.auto[i].pinned;
  }
}
