// The core GM engine: context construction, GM output parsing, narration + NPC split.

import { characterSheet } from "./character.js";
import { buildNpcTrackerContext, buildNpcTrackerRulesContext, extractNpcTrackers, extractTrackers, foldNpcTrackers, getCurrentNpcTrackers, getCurrentTrackers, initialNpcTrackers, lifeTracker, levelTracker, expTracker, liveMax, locationValue, npcTrackerValuesLine, NPC_TRACKER_CAP, LIFE_TRACKER_LOOKBACK_TURNS, LIFE_TRACKER_OFFSCREEN_CAP, LIFE_TRACKER_EVENTS_PER_NPC, parseNpcTrackerBlock, parseTrackerBlock, buildTrackerContext, buildTrackerValuesContext, heroTrackerOutputCap, npcTrackerOutputCap, applyLevelUpBackstop, findTrackerLeakStart, stripTrackerLeak, TRACKER_LEAK_STOPS } from "./trackers.js";
import { buildStatsContext } from "./stats.js";
import { formatDistance, compassDir, normalizeLoc, mapScale } from "./map-system.js";
import { loreForTurn, LORE_FEED_CAP, LORE_FEED_MAX_CHARS, DEFAULT_TRIGGER_WINDOW_TURNS, STOPWORDS, nameHit } from "./lorebook.js";
import { memoriesForTurn, MEMORY_FEED_CAP, MEMORY_TOPICAL_ACTIVE_CAP, MEMORY_TOPICAL_OPEN_CAP, MEMORY_NAME_FEED_CAP, MEMORY_TRIGGER_WINDOW_TURNS, ownerLabel } from "./memory-system.js";
import { rank as bm25Rank, tokenize as bm25Tokenize } from "./bm25.js";
import { embedQuery, getCachedVec, cosine, fuseRrf, EMB_COS_MIN } from "./embeddings.js";
import { subUser, heroNameOf, blankDetail, compactNpcLine, ellipsize } from "./text-utils.js";
import { NPC_LIFE_MIN_OFFSCREEN_TURNS } from "./npc-life.js";
import { PERCHANCE_INPUT_CAP, PERCHANCE_CHARS_PER_TOKEN } from "./perchance-limits.js";

// Diff two tracker snapshots into "already applied" lines ("key: a → b"). Pseudo-entries
// (`key.max`, current caps) are included when they changed. `a` may be null/undefined when
// there is no earlier snapshot.
function diffTrackers(a, b, defs) {
  const A = a || {};
  const B = b || {};
  const out = [];
  for (const d of defs) {
    const k = d.key;
    const as = A[k] === undefined || A[k] === null ? "" : String(A[k]);
    const bs = B[k] === undefined || B[k] === null ? "" : String(B[k]);
    if (as !== bs) out.push(`${k}: ${as} → ${bs}`);
    const mk = k + ".max";
    if (A[mk] !== undefined && B[mk] !== undefined && String(A[mk]) !== String(B[mk])) out.push(`${k}.max: ${A[mk]} → ${B[mk]}`);
  }
  return out;
}

// RECENT EVENTS only includes the last `RECENT_TURNS` player turns (a turn = one player
// action/direct + its GM reply). Older turns are summarized into durable MEMORIES by the
// auto roll-up, so the raw transcript window can stay small. On Perchance AI the window is
// additionally fitted to the input cap (see GM transcript fitting below): already-baked turns
// drop first, then stale narration shortens — the newest GM_MIN_FULL_TURNS turns are sacrosanct.
const RECENT_TURNS = 10;
// Newest turns never dropped by fitting — half the max window, so a fitted prompt always
// carries 5 fully-verbatim recent turns plus the standing record. Narration truncation
// reaches further when it must (see GM_MIN_VERBATIM_TURNS), but these turns are never cut.
const GM_MIN_FULL_TURNS = 5;
// Newest turns whose narration is NEVER truncated (single newest-3 cutoff, no phases:
// turns older than these trim one at a time, oldest first).
const GM_MIN_VERBATIM_TURNS = 3;
const GM_FIT_MARGIN = 100; // headroom under the input cap: residual estimator noise only —
 // measurement is post-{{user}}-substitution everywhere (fitTranscript measures through
 // the same sub pass as the final send), so there is no substitution-growth bias left to
 // cover; the exact plugin counter needs ~nothing, the char-estimator fallback gets this buffer
const GM_NARR_MIN_MSG = 200; // per-MESSAGE floor (the only narration floor): paragraphs
// at/below this are never shortened (a ≤200-char paragraph keeps its whole beat)
const GM_TRUNC_MARK = "[...]"; // middle-cut marker for shortened narration
// Output cap for the two narrative calls (GM reply + death scene). The Perchance
// plugin ignores `maxTokens` (its output caps at ~1024 tokens anyway), but custom
// providers forward it as `max_tokens` — and OpenRouter treats a missing cap as a
// request for the model's whole context window ("requested up to 131072 tokens"),
// which fails its credit check even on small prompts. 2000 leaves generous headroom
// over a typical long GM turn while keeping the accounted total affordable.
const GM_REPLY_MAX_TOKENS = 2000;

// External providers have large inputs, so the GM memory + lore feeds are doubled for
// them (Perchance AI keeps the base caps). Multiplier applied to every memory/lore cap below.
const EXTERNAL_CAP_MULTIPLIER = 2;

// NPC context budget. Full dossiers (incl. secrets) go only to NPCs that matter RIGHT NOW:
// the most-recent [Name] speakers (Active), up to FULL_PROFILE_CAP. A merely
// mentioned name is not presence — no matter how topical, non-speakers never earn
// a dossier (no full psychology, no secrets for a rumor). Everyone else rides
// hooks: speaker overflow (recency order) then the present roster (Present —
// named in the recent chat/action/location, or seen within NPC_RECENT_SEEN turns —
// ordered by the fused relevance rank; recency-only faces keep most-recently-seen
// order) fill up to OVERFLOW_HOOK_CAP hook lines, so an in-scene face never loses
// its hook to an idle-but-topical one. Leftover room
// goes to HOOK_RELEVANCE_CAP relevance-ranked faces from the idle met + unmet standing cast,
// then sticky round-robin faces held HOOK_HOLD_TURNS turns so the GM can consider bringing
// them in and a big cast surfaces over time. Dossiers + hooks together never exceed
// NPC_TOTAL_CAP per turn (later tiers yield first). `high`
// importance is NOT presence — it only boosts hook rank, so author intent survives without
// dumping dossiers every turn. Pinned protects an entry from pruning only — it does NOT earn
// a dossier. A relevance hook must additionally share a content word with the candidate's
// name, job, or race (identity anchor), or a semantic pass — persona/appearance-only
// overlap never qualifies. When nothing relevant-and-anchored scores, the relevance tier is empty (no filler) and
// only the sticky rotation surfaces faces.
const NPC_RECENT_SEEN = 3;        // turns since lastSeenTurn to still count as present
const FULL_PROFILE_CAP = 4;       // max full dossiers per turn — recent speakers ONLY
const ACTIVE_SPEAKER_TURNS = 2;   // [Name] speaker lines this recent count as active
const HOOK_RELEVANCE_CAP = 2;     // relevance-ranked hook lines (idle met + unmet cast, after dossiers + overflow)
const OVERFLOW_HOOK_CAP = 4;      // hook lines for dossier losers: speaker overflow (recency), then present overflow (relevance)
const HOOK_ROTATION_SLOTS = 2;    // ...plus this many round-robin faces, held while sticky
const NPC_TOTAL_CAP = 10;         // hard ceiling on NPC entries per turn (dossiers + hooks); rotation yields first
const HOOK_HOLD_TURNS = 3;        // turns a rotation face persists before the pointer advances
const HOOK_IMPORTANCE_BOOST = 1.5;// score multiplier for high-importance hook candidates

// (blankDetail + compactNpcLine live in text-utils.js — shared with the off-screen life call.)

// Per-field semantic texts for NPC ranking — the raw profile fields, unweighted, one
// vector each. The embedding side scores a candidate by its BEST-matching field
// (max, not mean): a single pooled vector lets a long persona/appearance drown out the
// job ("High school student" invisible inside a fashion essay at 0.16); field-level
// max keeps role matches at 0.3–0.6 while unrelated scenes stay under the floor.
// Split into two tiers mirroring the BM25 weights (see npcRankText): ROLE fields
// (name, job, race) clear the standard floor; PROSE fields (persona, appearance,
// extra, description) must clear NPC_PROSE_COS_MIN — personality/appearance prose
// resonates with generic scene language too easily (a "curious observer" persona
// matches any scene full of watching at 0.27). Tuned on live probes from one world
// (noise max 0.269, genuine role-prose 0.30+), so treat the number as adjustable.
// Exported for the embedding warmup (main.js), which pre-embeds the same fields.
export function npcSemanticFieldTiers(entry) {
  const d = (entry && entry.details) || {};
  const clean = (v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  const kept = (arr) => arr.map(clean).filter((s) => s && !blankDetail(s));
  return {
    // lifeWhere (off-screen whereabouts, see npc-life.js) ranks as a role
    // fact: a scene set where the NPC currently is should confirm
    // semantically, the same way a matching job does.
    role: kept([entry && entry.name, d.job, d.race, entry && entry.lifeWhere]),
    prose: kept([d.persona, d.appearance, d.extra, entry && entry.description])
  };
}
export function npcSemanticFields(entry) {
  const t = npcSemanticFieldTiers(entry);
  return [...t.role, ...t.prose];
}
// Prose fields must match more strongly than role fields to count (see above).
export const NPC_PROSE_COS_MIN = 0.30;
// Weighted document text for NPC BM25 ranking: name×4 + job/race×2 + everything
// else×1 (age, gender, persona, extra, appearance, description, off-screen
// whereabouts) — never secrets, since hooks don't show them, so they don't
// rank by them either. Identity and role outrank prose: a scene saying a name
// or a job should beat one that merely shares a descriptive word ("cold",
// "glass", "leaning") with a persona or appearance field. lifeWhere sits at ×1
// with the other facts; its real power is the identity anchor below, not weight.
// (Vectors use npcSemanticFields above — one embedding per field, max-pooled.)
export function npcRankText(entry) {
  const name = String((entry && entry.name) || "").trim();
  const d = (entry && entry.details) || {};
  const rep = (v, n) => {
    const s = String(v == null ? "" : v).trim();
    return s ? ((s + " ").repeat(n).trim()) : "";
  };
  const body = [
    rep(name, 4),
    rep(d.job, 2), rep(d.race, 2),
    rep(d.gender, 1), rep(d.age, 1),
    rep(d.persona, 1), rep(d.extra, 1), rep(d.appearance, 1),
    rep(entry.description, 1), rep(entry.lifeWhere, 1)
  ].filter(Boolean).join(" ");
  return body;
}

// Rank roster candidates best-first: BM25 fused (RRF) with embedding max-field cosine
// when `hybrid.queryVec` is present, BM25 alone otherwise. The embedding side scores each
// candidate by its best-matching profile field (see npcSemanticFields) rather than one
// pooled vector. `boost` ({ docs: Set, mult })
// multiplies the BM25 score and cosine of those docs — a mild author-intent nudge (used for
// high-importance hooks) that reorders but never overrides relevance outright. The cosine
// floor is judged BEFORE the boost, so the quiet-scene guard stays pure.
// Identity anchor: the scene must share at least one content word with the candidate's
// NAME, JOB, or RACE, or confirm them semantically (embedding cosine above the floor) —
// persona/appearance/extra/description overlap alone never qualifies.
// Rationale: idf is computed over a ~6-entry pool, so ANY word unique to one profile
// ("too", "cold", "half", "glass") scores max rarity and a breakfast scene can put two
// strangers at 9–12 points on pure coincidence. The anchor is set-based (no score math),
// so it can't drift with cast size the way an absolute floor would. No-score or
// unanchored candidates are dropped (empty array when nothing is relevant) — matching the
// lorebook and memory feeds, which also feed only positive scorers, so an irrelevant turn
// sends no relevance hooks instead of pool-order filler. Serendipity still has a path:
// the sticky rotation below surfaces faces regardless of score.
function rankNpcCandidates(cands, query, getEntry, hybrid = null, boost = null) {
  if (!cands.length || !String(query || "").trim()) return [];
  try {
    const boosted = (c) => (boost && boost.docs && boost.docs.has(c) ? (boost.mult || 1) : 1);
    const textOf = new Map();
    for (const c of cands) textOf.set(c, npcRankText(getEntry(c)));
    const qToks = new Set(bm25Tokenize(query, STOPWORDS));
    const idHit = (c) => {
      const e = getEntry(c) || {};
      const d = (e && e.details) || {};
      // lifeWhere joins the anchor set: a scene sharing a content word with
      // the NPC's current whereabouts is a location fact matching the scene's
      // own location (which rides in the query) — the store run-in, not a
      // prose coincidence. The hook line carries the age ("3 turns ago") so
      // the GM judges staleness instead of treating it as gospel.
      const idToks = bm25Tokenize([e.name, d.job, d.race, e.lifeWhere].filter(Boolean).join(" "), STOPWORDS);
      return idToks.some((t) => qToks.has(t));
    };
    const ranked = bm25Rank(query, cands, (c) => textOf.get(c), { stopwords: STOPWORDS });
    for (const r of ranked) { const m = boosted(r.doc); if (m !== 1) r.score *= m; }
    ranked.sort((a, b) => (b.score - a.score) || (a.index - b.index));
    const posOf = new Map();
    ranked.forEach((r, i) => { if (r.score > 0 && !posOf.has(r.doc)) posOf.set(r.doc, posOf.size); });
    const qv = hybrid && hybrid.queryVec;
    const cosOf = new Map();
    if (qv && qv.length) {
      for (const c of cands) {
        // Best-field cosine: each profile field is embedded separately (short, focused
        // texts), and the candidate takes its max — a matching job is never diluted by
        // an unrelated persona the way a single pooled vector would be. Role fields
        // clear the standard floor; prose fields (persona/appearance/…) must clear the
        // higher NPC_PROSE_COS_MIN — topical matching should turn on who someone is,
        // not on coincidentally shared descriptive language.
        const tiers = npcSemanticFieldTiers(getEntry(c));
        let best = -1;
        for (const f of tiers.role) {
          const v = getCachedVec(f); // queues misses for next turn
          if (!v) continue;
          const co = cosine(qv, v);
          if (co >= EMB_COS_MIN && co > best) best = co;
        }
        for (const f of tiers.prose) {
          const v = getCachedVec(f); // queues misses for next turn
          if (!v) continue;
          const co = cosine(qv, v);
          if (co >= NPC_PROSE_COS_MIN && co > best) best = co;
        }
        if (best < 0) continue;
        cosOf.set(c, best * boosted(c));
      }
    }
    // Identity anchor: the scene must share a content word with the candidate's NAME,
    // JOB, RACE, or current whereabouts — or confirm them semantically (cosine above
    // the floor). Either qualifies: lexical gaps ("classroom" vs job "High school student")
    // are exactly what the vectors are for, while BM25 micro-overlap alone ("cold", "glass")
    // never is. Whereabouts is anchor-grade (a place fact, not prose), so a hero walking
    // into the tavern re-surfaces the NPC whose last life tick left them there.
    const anchored = (c) => cosOf.has(c) || idHit(c);
    if (cosOf.size) {
      const embRank = new Map([...cosOf.entries()].sort((a, b) => b[1] - a[1]).map(([c], rank) => [c, rank]));
      const fused = fuseRrf(new Set([...posOf.keys(), ...embRank.keys()]), posOf, embRank, null, 1);
      if (fused.length) return fused.map((f) => f.cand).filter(anchored);
    }
    return ranked.filter((r) => r.score > 0 && anchored(r.doc)).map((r) => r.doc);
  } catch (e) {}
  return [];
}

// Embed the turn's query text for hybrid ranking. Fast-null on a cold model
// (that turn simply runs BM25) — never stalls a GM call on vectors.
async function hybridForTurn(engine, state, history, actionText) {
  try {
    const chatQ = engine.recentChatText(history);
    const locQ = locationValue(engine.trackerDefs, getCurrentTrackers(state, engine.trackerDefs));
    const q = [chatQ, actionText, locQ].filter(Boolean).join("\n");
    if (!q.trim()) return null;
    const qv = await embedQuery(q);
    return qv ? { queryVec: qv } : null;
  } catch (e) { return null; }
}

// Output caps for the two dedicated tracker-update calls live in trackers.js
// (heroTrackerOutputCap / npcTrackerOutputCap) — sized from what each call must
// actually emit, so they grow with the world's tracker count (see README §6.3.1).

// Cap on the GM's own description of a newcomer it flags with `[[NPC: Name | …]]` (see
// parseGmOutput). The instruction asks for 1–3 sentences; this is the backstop against a runaway
// reply, and is generous enough that a real excerpt never hits it (~600 chars ≈ 4–5 sentences).
// Exported so npc-system's entry creation clamps to the same number.
export const NPC_NOTE_CAP = 600;

// Choose-your-own-adventure options. Opt-in per world: the world's `scenario` text instructs the GM
// to end its reply with `[[CHOICE: ...]]` lines, which parseGmOutput turns into one `choice` message
// (rendered as buttons; a click submits the option as the player's action). Worlds without that
// instruction simply never emit the marker, so nothing changes for them. The cap bounds a runaway
// reply; the marker's own `[[...]]` namespace keeps it unambiguous against `[Name]` dialogue.
const MAX_CHOICES = 6;

// Does `name` appear in `hay`? The shared matcher lives in lorebook.js (`nameHit`) so the GM
// context and the memory owner-gate use the exact same rule — see there for how everyday words in
// a name ("Billy **the** Torch") are handled.

// "N turns ago" phrasing for a memory whose `turn` is known. The GM context never states an
// absolute turn count, so recency is expressed relative to the current turn.
function agoLabel(currentTurn, turn) {
  const ago = Math.max(0, (currentTurn || 0) - (turn || 0));
  return ago === 0 ? "this turn" : ago === 1 ? "1 turn ago" : ago + " turns ago";
}

// The anchored-turn ordinal of one specific message in the transcript — the same counting the
// memory system uses when it stamps memories with the [TURN n] they happened on (a turn = one
// player action/direct + the GM messages that follow it; an action/direct anchor returns its own
// count, itself included, and the messages after it share that anchor's turn). Used to find the
// turn ordinal of the OLDEST message in the GM's RECENT EVENTS window, so a triggered memory
// whose event is still inside that verbatim transcript window can be recognized as redundant.
// Returns 0 when the target message isn't found.
function anchoredTurnAt(history, target) {
  if (!Array.isArray(history) || !history.length) return 0;
  let t = 0;
  for (const m of history) {
    if (m && (m.role === "action" || m.role === "direct")) t++;
    if (m === target) return t;
  }
  return 0;
}

// GM transcript fitting (Perchance AI ONLY — external providers keep the full window and let
// their large inputs absorb it). Measure-driven, cheapest fidelity cost first: keep the full
// window while it fits; otherwise drop ONE oldest baked turn at a time until it fits; only
// then shorten narration. Specifically:
//
//  0. hook-trim: the most expendable NPC hooks drop first — rotation hooks, then
//     relevance hooks if still over budget. Dossiers and overflow hooks (incl.
//     active-speaker overflow) never trim.
//  0b. surroundings-trim: the whole SURROUNDINGS map section drops when hooks didn't
//     suffice (the map panel itself is untouched — just this turn's GM feed).
//  1. turn-drop: whole oldest turns the roll-up already baked (ordinal at/below the bake
//     cursor) fall out — their events live in MEMORIES + the standing record. Never drops
//     below GM_MIN_FULL_TURNS newest turns, never drops an unbaked turn.
//  2. fitTranscript: if the prompt STILL overflows with nothing left to drop, stale
//     narration middle-cuts (~half) one turn at a time, oldest first — each turn is
//     exhausted before the next is touched, stopping the moment the prompt fits, so
//     only the newest GM_MIN_VERBATIM_TURNS turns are guaranteed verbatim. Dialogue
//     (npc), inner thoughts (thought), player turns (action/direct) and short lines
//     are never shortened.
//
// Drop-before-truncate is a fidelity ordering: dropped turns survive elsewhere in context
// (memories + standing record), while truncation destroys live detail — so truncation only
// runs when dropping can do no more. Keeping everything that fits also keeps the prefix-cache
// prefix stable instead of churning the window every turn.

// Per-route Perchance check for engine-side budget switches (see isPerchanceAIFor
// in ai-provider.js). Cached dynamic import: ai-provider.js touches window at
// load, so a static import would break non-DOM importers of this module.
// Unknown (import failed / no check fn) fails safe to true — Perchance is the
// default provider and its small window is the conservative assumption.
let _isPerchanceMod = null, _isPerchanceProbed = false;
// Per-route variant: true when THIS route's calls will run on Perchance AI
// (no external provider active, or the route's toggle is off). GM trimming,
// memory/lore caps and tracker output caps read this per route, so a route
// switched back to Perchance gets Perchance-sized budgets even while the
// global provider is external.
async function isPerchanceAIFor(route) {
  try {
    if (!_isPerchanceProbed) { _isPerchanceProbed = true; _isPerchanceMod = await import("./ai-provider.js"); }
    const f = _isPerchanceMod && _isPerchanceMod.isPerchanceAIFor;
    if (typeof f === "function") return !!f(route);
  } catch (e) {}
  return true;
}

// The plugin's exact token counter (same read as the roll-up packing). Null when unknown —
// callers fall back to the shared char estimator.
function gmCounter(genText) {
  try {
    const meta = genText && genText({ getMetaObject: true });
    if (meta && typeof meta.countTokens === "function") return (t) => meta.countTokens(String(t));
  } catch (e) {}
  return null;
}

// Turn-group boundaries in a transcript window: every action/direct starts a new turn; leading
// non-action messages ride with the first turn. Returns the anchor index of each group.
function windowTurnGroups(window) {
  const anchors = [];
  for (let i = 0; i < window.length; i++) {
    const m = window[i];
    if (m && (m.role === "action" || m.role === "direct")) anchors.push(i);
  }
  if (!anchors.length) return window.length ? [0] : [];
  return anchors;
}

// How many whole turns the roll-up baked: anchors at/before the message-index cursor. The
// cursor (not the cadence marker) is the exact baked-through point — the marker lies on
// retry-backoff (turn−5 while those turns are unbaked) and on success equals the live turn
// (which includes the intentionally-unbaked lag turns).
function bakedTurnCount(history, cursor) {
  const end = Math.max(0, Math.min(cursor || 0, (history || []).length));
  let t = 0;
  for (let i = 0; i < end; i++) {
    const m = history[i];
    if (m && (m.role === "action" || m.role === "direct")) t++;
  }
  return t;
}

// Ordinal of each window message on the anchored-turn scale (one pass over history).
function windowOrdinals(history, window) {
  const ord = new Map();
  let t = 0;
  for (const m of history || []) {
    if (m && (m.role === "action" || m.role === "direct")) t++;
    if (!ord.has(m)) ord.set(m, t);
  }
  return window.map((m) => ord.has(m) ? ord.get(m) : 0);
}

// Stage 1: drop up to `maxDrops` oldest whole baked turns from the window (mutates it).
// One call drops one turn: the oldest group goes iff its ordinal is at/below the bake cursor
// AND more than GM_MIN_FULL_TURNS turns remain. Returns how many turns were actually dropped.
function dropOldestBakedTurns(history, window, state, maxDrops) {
  if (!window.length || maxDrops <= 0) return 0;
  const baked = bakedTurnCount(history, state.lastAutoMemoryAt);
  if (baked <= 0) return 0;
  let dropped = 0;
  while (dropped < maxDrops) {
    const groups = windowTurnGroups(window);
    if (groups.length <= GM_MIN_FULL_TURNS) break;
    const oldestOrd = windowOrdinals(history, window)[groups[0]];
    if (oldestOrd > baked) break;
    window.splice(0, groups.length > 1 ? groups[1] : window.length);
    dropped++;
  }
  return dropped;
}

// Whether one more oldest turn could be dropped (same eligibility as above, without mutating).
function canDropMoreTurns(history, window, state) {
  if (!window.length) return false;
  const groups = windowTurnGroups(window);
  if (groups.length <= GM_MIN_FULL_TURNS) return false;
  const baked = bakedTurnCount(history, state.lastAutoMemoryAt);
  if (baked <= 0) return false;
  return windowOrdinals(history, window)[groups[0]] <= baked;
}

// Middle-cut one narration to ~HALF its length, snapping to line boundaries, marked with
// [...]. Keeps roughly the first and last quarters (proportional — a 255-char paragraph
// keeps ~62+62 chars, a 1000-char one ~248+248); lines too short to split cleanly fall
// back to a hard char cut. Returns the input unchanged when the cut would save fewer
// than 16 chars (caller treats that as no-progress). One disclosed floor: messages
// at/below GM_NARR_MIN_MSG are never touched.
function middleCutNarration(text) {
  const s = String(text || "");
  if (s.length <= GM_NARR_MIN_MSG) return s;
  const mark = GM_TRUNC_MARK;
  const quarter = Math.floor((s.length - mark.length - 2) / 4);
  const lines = s.split("\n");
  let head = "", hi = 0;
  while (hi < lines.length && (head + (head ? "\n" : "") + lines[hi]).length <= quarter) { head += (head ? "\n" : "") + lines[hi]; hi++; }
  let tail = "", ti = lines.length - 1;
  while (ti >= hi && (lines[ti] + (tail ? "\n" : "") + tail).length <= quarter) { tail = lines[ti] + (tail ? "\n" : "") + tail; ti--; }
  let out;
  if (head && tail) out = head + "\n" + mark + "\n" + tail;
  else out = s.slice(0, quarter) + "\n" + mark + "\n" + s.slice(-quarter);
  return out.length < s.length - 16 ? out : s;
}

function transcriptHeader(t) {
  const n = t.turns;
  return `RECENT EVENTS (last ${n} turn${n === 1 ? "" : "s"}, most recent last; PLAYER: is the hero's action, REPLY: starts the GM response; events older than this are in MEMORIES${t.truncated ? "; " + GM_TRUNC_MARK + " marks shortened narration" : ""}):\n`;
}

// Stage 2: shorten eligible narrator lines (oldest first, ~half per cut, repeat passes) until
// the FULL prompt fits. Turn span never changes, so recentFloor/memories stay valid — this runs
// at the very end of context assembly. Mutates t.lines / t.truncated. Measurement runs
// through subFn (the same {{user}} substitution as the final send), so what is measured
// is what is sent — no substitution-growth bias, and the GM_FIT_MARGIN only covers
// counter noise.
function fitTranscript(parts, idx, t, measure, subFn) {
  const limit = PERCHANCE_INPUT_CAP - GM_FIT_MARGIN;
  const sub = subFn || ((s) => s);
  const render = () => {
    parts[idx] = transcriptHeader(t) + t.lines.join("\n");
    return measure(sub(parts.join("\n\n")));
  };
  let total = render();
  if (total <= limit) return;
  // Truncation cutoff: messages at/after the 3rd-from-last anchor belong to the newest
  // turns, which are ALWAYS verbatim. With 3 or fewer anchored turns the cutoff is the
  // first anchor — the opening scene (or replies orphaned by a deleted action) before it
  // is older than every protected turn, so it stays eligible. No anchors (degenerate
  // window) protects everything.
  const anchors = [];
  for (let i = 0; i < t.roles.length; i++) {
    if (t.roles[i] === "action" || t.roles[i] === "direct") anchors.push(i);
  }
  const cutoff = anchors.length > GM_MIN_VERBATIM_TURNS ? anchors[anchors.length - GM_MIN_VERBATIM_TURNS] : (anchors.length ? anchors[0] : 0);
  // Eligibility is per-message only: any narrator line over GM_NARR_MIN_MSG (200)
  // before the cutoff can cut, oldest first — no turn-total gate (removed 10-18 per
  // user steer: the per-line check is the better one). One turn at a time, oldest
  // first: each turn is exhausted (repeat rounds until it converges or the prompt
  // fits) before the next is touched — the re-measure after every cut stops the whole
  // process the moment it fits, so newer turns are only ever reached when older ones
  // have nothing left to give. Turn span never changes, so recentFloor/memories stay
  // valid. Segments are anchor-delimited turns; pre-anchor lines (opening/orphaned,
  // before anchors[0]) form their own leading segment. Every segment here starts
  // before the cutoff, so it ends at or before it — protected newest turns are never
  // entered.
  const segEnds = [...anchors.filter((a) => a > 0), t.lines.length];
  const segStarts = [];
  if (cutoff > 0) {
    segStarts.push(0);
    for (const a of anchors) { if (a > 0 && a < cutoff) segStarts.push(a); }
  }
  for (const segStart of segStarts) {
    const segEnd = segEnds.find((e) => e > segStart);
    for (;;) {
      let progressed = false;
      for (let i = segStart; i < segEnd && i < t.lines.length && total > limit; i++) {
        if (t.roles[i] !== "narrator") continue;
        const cut = middleCutNarration(t.lines[i]);
        if (cut === t.lines[i]) continue;
        t.lines[i] = cut;
        t.truncated = true;
        progressed = true;
        total = render();
      }
      if (total <= limit || !progressed) break;
    }
    if (total <= limit) return;
  }
}

// Banked off-screen happenings for the NPC tracker call (see updateNpcTrackers): NPC-owned auto
// memories the call hasn't applied yet (`trackerApplied`), fresh enough to still matter
// (LIFE_TRACKER_LOOKBACK_TURNS — older backlog was already narrated past, never bulk-apply it),
// and owned by characters this turn can't already see — stale (the same off-screen window the
// life tick simulates) and absent from the in-play roster (their doings are in the reply text the
// call already tracks, so feeding them again would double-apply). Hero-involved and world-owned
// memories are never banked here: the former surface through normal present-NPC paths, the
// latter are public facts rather than character state. Owners are canonical at bank time
// (normalizeOwner), so exact roster matching is safe. Returns
// [{ name, events: [{ turn, text, mem }] }] with names capped at LIFE_TRACKER_OFFSCREEN_CAP
// (freshest first) and events newest-first per name (capped at LIFE_TRACKER_EVENTS_PER_NPC).
function bankedOffscreenEvents(state, rosterSet) {
  const mems = (state && state.memories && state.memories.auto) || [];
  if (!mems.length) return [];
  const turnNow = (state && state.turn) || 0;
  const heroLower = String(heroNameOf(state) || "").trim().toLowerCase();
  const npcs = (state && state.npcs) || {};
  const byLower = new Map(Object.keys(npcs).map((n) => [String(n).trim().toLowerCase(), n]));
  const perName = new Map();
  for (const m of mems) {
    if (!m || m.trackerApplied || typeof m.text !== "string" || !m.text.trim()) continue;
    if (typeof m.turn !== "number" || m.turn < 0 || turnNow - m.turn > LIFE_TRACKER_LOOKBACK_TURNS) continue;
    const toks = String(m.owner || "").split(/[,+]/).map((s) => s.trim()).filter(Boolean);
    if (!toks.length) continue;
    const lows = toks.map((t) => t.toLowerCase());
    if (lows.some((t) => t === "world")) continue;
    if (heroLower && lows.some((t) => t === heroLower)) continue;
    const text = m.text.trim();
    for (const t of toks) {
      const canon = byLower.get(t.toLowerCase());
      if (!canon || rosterSet.has(canon)) continue;
      const e = npcs[canon];
      const ls = e && typeof e.lastSeenTurn === "number" ? e.lastSeenTurn : 0;
      if (ls < 0 || turnNow - ls < NPC_LIFE_MIN_OFFSCREEN_TURNS) continue;
      if (!perName.has(canon)) perName.set(canon, []);
      perName.get(canon).push({ turn: m.turn, text, mem: m });
    }
  }
  return [...perName.entries()]
    .map(([name, evs]) => {
      evs.sort((a, b) => b.turn - a.turn);
      return { name, events: evs.slice(0, LIFE_TRACKER_EVENTS_PER_NPC) };
    })
    .sort((a, b) => b.events[0].turn - a.events[0].turn)
    .slice(0, LIFE_TRACKER_OFFSCREEN_CAP);
}

export class RPEngine {
  constructor({ genText, promptText, loreEntries = [], scenarioText = "", startText = "", vibeText = "", trackerDefs = [], npcTrackerDefs = [], statDefs = [], worldNpcs = [], checkIncludeTrackers = false, checkIncludeNpcTrackers = false, checkTrackerKeys = [], checkNpcTrackerKeys = [], useCheckInstruction = false, checkInstruction = "" }) {
    this.lastInstruction = null;
    this.lastTrackerInstruction = null;
    this.lastNpcTrackerInstruction = null;
    this.lastCheckInstruction = null;
    this.genText = genText;
    // --- stop support (the composer's stop button) --------------------------------------------
    // `_gen` wraps every generation call so the UI can abort the current one: `_active` holds the
    // set of in-flight generateText promises (each has a .stop()), and `_aborted` tells the
    // follow-up AI calls of this turn (tracker update, level-up backstop, skill check) to stand
    // down. A SET rather than a single slot because the hero tracker call and the NPC tracker call
    // run in parallel (see generateGmReply) and both must be stoppable. Stopping resolves each
    // promise with whatever text streamed in, so the reply is kept — just cut short.
    this._active = new Set();
    this._aborted = false;
    this.promptText = promptText;
    // The world's lorebook: canon entries with a type + activation rule. Only the entries the
    // current scene actually touches are fed to the GM each turn (see buildContext) — "always"
    // entries plus the BM25 top-N "keywords" entries for the recent scene.
    this.loreEntries = loreEntries || [];
    this.scenarioText = scenarioText;
    this.startText = startText;
    this.vibeText = vibeText;
    this.trackerDefs = trackerDefs; // from the loaded world
    this.npcTrackerDefs = npcTrackerDefs; // from the loaded world — per-NPC tracked values (see README §6.3.1)
    this.statDefs = statDefs; // from the loaded world (player-owned attributes)
    this.checkIncludeTrackers = checkIncludeTrackers === true; // world opt-in: feed last-turn tracker values to the skill-check referee
    this.checkIncludeNpcTrackers = checkIncludeNpcTrackers === true; // world opt-in: feed last-turn NPC tracker values to the skill-check referee
    const keyList = (v) => (Array.isArray(v) ? v.filter((k) => typeof k === "string" && k) : []);
    this.checkTrackerKeys = keyList(checkTrackerKeys); // explicit hero tracker subset for the referee ([] = all)
    this.checkNpcTrackerKeys = keyList(checkNpcTrackerKeys); // explicit NPC tracker subset for the referee ([] = all)
    this.useCheckInstruction = useCheckInstruction === true; // world opt-in: append the author's custom instruction to the referee prompt
    this.checkInstruction = String(checkInstruction || "");
    this.startTurns = 20; // the world's start section is injected only for the first N turns
    // The world's standing cast (canon NPCs authored in the world file), in the same shape as a
    // session NPC entry so npcProfile() can format them. Known/met NPCs are listed in the KNOWN
    // NPCS section instead and excluded here.
    this.worldNpcs = (worldNpcs || [])
      .filter((n) => n && String(n.name || "").trim())
      .map((n) => {
        const details = {};
        for (const k of ["age", "gender", "race", "appearance", "job", "persona", "extra", "secrets"]) {
          const v = n[k];
          if (v !== undefined && v !== null && String(v).trim()) details[k] = String(v).trim();
        }
        return { name: String(n.name).trim(), details };
      });
  }

  // The session NPCs currently present in the scene — named in the recent chat/action/location
  // (`hay`), or seen within the last few turns. Feeds the Present dossier tier and the memory
  // owner-gate, so a picture is cast from the same roster the GM is told is present. Pinned is
  // deliberately NOT a bypass: pinning only protects an entry from pruning (`NpcSystem.prune`).
  // Importance is not presence either — it only boosts hook rank (see HOOK_IMPORTANCE_BOOST).
  // `strict` drops the recently-seen bypass and keeps ONLY NPCs whose name
  // actually appears in `hay`. Used by the scene-image prompt: a character who is merely
  // world-cast, or "seen a few turns ago", must not be cast into a picture of the current moment —
  // only someone named in the scene text is.
  inPlayNpcs(state, hay, { strict = false } = {}) {
    const turnNow = state.turn || 0;
    return Object.entries(state.npcs || {})
      .filter(([n, d]) => d && d.details && Object.values(d.details).some((v) => v))
      .filter(([n, d]) => {
        if (strict) return nameHit(hay, n);
        if (nameHit(hay, n)) return true;
        // -1 = no visible appearance in the shown transcript (edited/deleted/rerolled away):
        // never present via recency, only via an explicit name hit above.
        const ls = d && typeof d.lastSeenTurn === "number" ? d.lastSeenTurn : 0;
        if (ls < 0) return false;
        return (turnNow - ls) <= NPC_RECENT_SEEN;
      })
      .map(([n]) => n);
  }

  // [Name] speakers in the last `turns` player turns, most-recent-first, deduped
  // (case-insensitive). Thought lines ([Name inner]) count — thinking on-page is presence too.
  // Names are the canonical npcKey the transcript links carry, so callers match them exactly.
  speakersIn(history, turns = ACTIVE_SPEAKER_TURNS) {
    const out = [];
    const seen = new Set();
    let anchors = 0;
    for (let i = (history || []).length - 1; i >= 0; i--) {
      const m = history[i];
      if (!m) continue;
      if (m.role === "action" || m.role === "direct") {
        anchors++;
        if (anchors > turns) break;
      }
      if (m.role === "npc" || m.role === "thought") {
        const k = String(m.npcKey || m.name || "").trim();
        if (k && !seen.has(k.toLowerCase())) { seen.add(k.toLowerCase()); out.push(k); }
      }
    }
    return out;
  }

  // Sticky off-scene rotation: HOOK_ROTATION_SLOTS faces held HOOK_HOLD_TURNS turns so the GM
  // can consider bringing them in, then the pointer advances. The order is shuffled once per
  // session (S.order); newcomers append at the end, the gone are dropped. `pool` = candidate
  // keys in a stable order; `skip` = keys already fed bigger this turn (dossiers / relevance
  // hooks) — skipped, never consumed. Reads/writes only state.npcSpotlight, so double calls in
  // one turn (reply + death scene) are idempotent inside the sticky window.
  rotationHooks(state, pool, skip) {
    const S = (state.npcSpotlight && typeof state.npcSpotlight === "object")
      ? state.npcSpotlight : (state.npcSpotlight = {});
    if (!Array.isArray(S.order)) S.order = [];
    const poolSet = new Set(pool);
    S.order = S.order.filter((k) => poolSet.has(k));
    const fresh = pool.filter((k) => !S.order.includes(k));
    for (let i = fresh.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [fresh[i], fresh[j]] = [fresh[j], fresh[i]];
    }
    S.order.push(...fresh);
    const turn = state.turn || 0;
    const live = (names) => (names || []).filter((k) => poolSet.has(k) && !(skip && skip.has(k)));
    if (typeof S.setAtTurn === "number" && (turn - S.setAtTurn) < HOOK_HOLD_TURNS) {
      const keep = live(S.names);
      if (keep.length) return keep; // sticky window — same faces, minus any that entered play
    }
    const out = [];
    const n = S.order.length;
    const cur = typeof S.cursor === "number" ? S.cursor : 0;
    let lastIdx = -1;
    for (let step = 0; step < n && out.length < HOOK_ROTATION_SLOTS; step++) {
      const idx = n ? (cur + step) % n : 0;
      const k = S.order[idx];
      if (poolSet.has(k) && !(skip && skip.has(k)) && !out.includes(k)) { out.push(k); lastIdx = idx; }
    }
    if (out.length || !pool.length) {
      S.names = out;
      S.setAtTurn = turn;
      S.cursor = n && lastIdx >= 0 ? (lastIdx + 1) % n : cur;
    }
    return out;
  }

  // Build the full context the GM sees. history = events BEFORE this reply, anchor EXCLUDED
  // (the latest action/direct rides as actionText, never inside history — every caller in main.js
  // splits them; the trim below is only a backstop). actionText = the latest action to respond
  // to (null for the opening scene).
  // kind = "action" (the hero's in-world action), "direct" (OOC direction to the GM),
  // "advance" (the player is ending the current scene and starting the next one), or
  // "idle" (empty-send wait — actionText is null, so the idle instruction below fires).
  // opening = true only for the very first scene.
  // opts.includeSurroundings — feed the SURROUNDINGS map section or not (decided by the caller,
  // which tracks what the GM has already seen — see shouldFeedSurroundings in main.js).
  buildContext(state, history, actionText, kind = "action", opening = false, opts = {}) {
    // `{{user}}` is the authoring shorthand for the hero's name (see text-utils.js): it appears in
    // the narrator prompt, in world-authored text (scenario/start, lorebook entries, cast personas)
    // and in text the AI wrote on earlier turns. The model must never see the raw token.
   const hero = heroNameOf(state);
   const sub = (t) => subUser(t, hero);
   const parts = [];
    // External providers get doubled memory + lore caps (see EXTERNAL_CAP_MULTIPLIER).
    // Set async in fittedInstruction via isPerchanceAIFor("gm"); defaults to 1 (Perchance) for direct callers.
    const capMultiplier = typeof opts?.capMultiplier === "number" ? opts.capMultiplier : 1;
    parts.push("GM INSTRUCTIONS:\n" + this.promptText);
    // vibeText is the tone the GM must keep in every reply — kept separate from the
    // narrator prompt so devs can tune the vibe without touching the (immutable) system prompt.
    if (this.vibeText) parts.push("NARRATIVE VIBE (tone to maintain in every reply):\n" + sub(this.vibeText));
    // The current location tracker value (used by the lore selector and the SURROUNDINGS section).
    const curLocTxt = locationValue(this.trackerDefs, getCurrentTrackers(state, this.trackerDefs));
    // The same "what is the scene about" text the lorebook matcher uses, used to decide which NPCs
    // are in play (their name appears in the recent chat, the latest action, or the location).
    // On the opening turn there is no chat or action yet, so the world's `start` text stands in —
    // the author just told us who is in the scene, and the roster matcher should hear it.
    const npcHay = [this.recentChatText(history), actionText, curLocTxt, opening ? sub(this.startText) : ""].filter(Boolean).join("\n");

    // scenarioText is a permanent premise — injected on every single reply.
    if (this.scenarioText) parts.push("WORLD PREMISE (always true):\n" + sub(this.scenarioText));
    // startText is the opening scenario — injected only during the first `startTurns` turns.
    if (this.startText && (state.turn || 0) <= this.startTurns) {
      parts.push("STARTING SCENARIO (how this adventure began):\n" + sub(this.startText));
    }

    parts.push("CHARACTER SHEET (player character/the hero):\n" + characterSheet(state.character, this.statDefs));

    // Tracked state/resources ride directly under the sheet — hero cluster: who the hero is
    // above, their live values here. The GM reads the current values + rules so the story
    // stays consistent with the UI. It does NOT output the machine block; a dedicated
    // tracker-update call runs after this reply (see updateTrackers below). The values
    // change most turns, so the prefix cache breaks here — everything below recomputes;
    // that is the price of the hero-first flow, and the stable prefix above stays banked.
    if (this.trackerDefs.length) {
      parts.push(buildTrackerValuesContext(this.trackerDefs, getCurrentTrackers(state, this.trackerDefs), (state.character && state.character.stats) || {}));
    }

    // The lorebook: only the entries relevant to the current scene are fed — "always"
    // entries plus the BM25 top-N keyword entries for the recent chat, the latest action,
    // and the current location. Each entry is tagged with its [type]. See loreForTurn.
    // It sits here — world facts, then the current situation below — rather than with the
    // static premise blocks: the selected subset changes almost every turn, so it belongs
    // in the volatile cluster, flowing general → current → episodic (lore → situation →
    // threads → memories). The small stable sections below it (~120 tokens for situation +
    // threads) recompute when the lore selection changes; deliberate.
   if (this.loreEntries.length) {
     const lore = loreForTurn(this.loreEntries, {
       chatTurns: this.recentChatTurns(history),
       actionText,
        location: curLocTxt,
        feedCap: LORE_FEED_CAP * capMultiplier,
        maxChars: LORE_FEED_MAX_CHARS * capMultiplier
      }, opts.hybrid || null);
      if (lore) parts.push("WORLD LORE (canon — the entries below were selected as relevant to the current scene; each is tagged [type]; treat them as ground truth and never contradict them):\n" + lore);
    }

    if (state.latestSituation) {
      // Age-tag the line so the GM can judge staleness itself: a sentence baked 9 turns ago
      // must not override the recent transcript on where everyone is and what's happening.
      // latestSituationTurn falls back to the roll-up cadence marker for saves that predate it.
      const sitStamp = typeof state.latestSituationTurn === "number" && state.latestSituationTurn >= 0
        ? state.latestSituationTurn : (state.lastAutoMemoryTurn || 0);
      const sitAge = Math.max(0, (state.turn || 0) - sitStamp);
      const sitWhen = sitAge <= 0 ? "just updated" : sitAge === 1 ? "1 turn ago" : sitAge + " turns ago";
      parts.push(`LATEST SITUATION (${sitWhen}, Not necessarily public knowledge): ` + state.latestSituation);
    }

    // Open threads — what is in motion right now (the hero's current objectives, unresolved
    // promises/oaths, live grudges/relationships) — distilled by the same roll-up that refreshes
    // the latest situation and always fed, so standing goals keep driving the story even after the
    // individual memories that started them age out of the per-turn MEMORIES feed.
    if (state.openThreads && state.openThreads.length) {
      parts.push("OPEN THREADS (what is in motion right now. Keep them progressing and resolve them naturally when the moment is right; let new threads emerge from events. Not necessarily public knowledge):\n" + state.openThreads.map((t) => "- " + t).join("\n"));
    }

    // The session NPCs currently in play — named in the recent chat/action/location, or seen
    // within the last few turns (pinning and high importance do NOT count as presence — see
    // inPlayNpcs). The same set feeds both the full dossiers below and the memory
    // owner-gate, so an NPC standing in the scene counts as present even when their name
    // hasn't been typed in the recent chat window (their memories can still surface when a
    // trigger word comes up).
    const inPlayNpcs = this.inPlayNpcs(state, npcHay);

    // Each character's live tracked values (see README §6.3.1), folded once per turn and
    // reused for every dossier line + the NPC TRACKED STATE section below.
    const heroStats = (state.character && state.character.stats) || {};
    const npcVals = this.npcTrackerDefs.length ? getCurrentNpcTrackers(state, this.npcTrackerDefs, heroStats) : {};

    // Memories are fed like the lorebook, with one exception: the player's manual notes are
    // always in. Auto entries split into three independent budgets (see memoriesForTurn): 4
    // scene-gated topical (the old topical tier — "world" is public, a hero-only memory always
    // qualifies, an NPC counts via the in-play roster above or their name in the recent text; a
    // hero+NPC shared memory needs one of its non-hero holders present — the hero alone is not
    // enough), 4 ungated topical (relevance only — may bleed), and 4 reserved name-only (needs an
    // Active holder: a recent [Name] speaker — a merely present/mentioned face draws nothing
    // there; mixed owner+topic triggers still compete topically as before). The topical tiers
    // share one BM25 (+embedding) ranking pass (no trigger prefilter); entries recalled ONLY
    // because a trigger word is one of their own owner's names (a presence signal — dialogue
    // carries `[Name]`, so a present character's name is in the window every turn they speak)
    // draw on the small RESERVED name-only budget and so can never evict a genuinely
    // topic-relevant memory. Fed most-relevant-first (name-only most-recent-last). Each line is
    // tagged with who knows it and roughly when it happened,
    // so knowledge never bleeds between characters who weren't there or weren't told — except
    // through the ungated tier, which is an explicit experiment.
    // Entries whose event is still inside the raw RECENT EVENTS transcript window (computed below
    // as the anchored-turn floor of its oldest message) are skipped: that turn's full text is
    // already before the GM verbatim, so re-listing it as a memory would duplicate tokens — the
    // memories exist to carry what FELL OUT of that window.
    const storyHistory = (history && history.length) ? this.recentWindow(history, RECENT_TURNS) : [];
    // Backstop: if a trailing action/direct duplicates the separately-rendered action below, feed
    // it once. Only for kinds that render actionText on its own (action/direct/travel) — advance
    // and death never show it, so trimming there would delete the text entirely. recentFloor
    // reads the OLDEST message, so this never moves it.
    if ((kind === "action" || kind === "direct" || kind === "travel") && actionText && storyHistory.length) {
      const last = storyHistory[storyHistory.length - 1];
      if (last && (last.role === "action" || last.role === "direct") && String(last.text || "").trim() === String(actionText).trim()) {
        storyHistory.pop();
      }
    }
    // Perchance AI only (opts.fit comes from the async send paths): stage-1 turn-drop.
    // opts.fit = { measure, dropTurns, truncate, hookTrim, surroundTrim }. The send path
    // re-builds trimming hooks, then surroundings, then with rising dropTurns until the
    // full prompt fits (or nothing droppable remains) and only then allows stage-2
    // truncation — so recentFloor below always reads the actually-fed window
    // and the memory feed's already-verbatim skip stays exact. Budget probes call buildContext
    // without fit and keep the full window, unmeasured.
    const fit = opts.fit || null;
    if (fit) dropOldestBakedTurns(history, storyHistory, state, fit.dropTurns || 0);
    this.lastFit = fit ? { canDropMore: canDropMoreTurns(history, storyHistory, state), truncated: false, hookTrim: (typeof fit.hookTrim === "number") ? fit.hookTrim : 0, surroundTrim: (typeof fit.surroundTrim === "number") ? fit.surroundTrim : 0 } : null;
    const recentFloor = storyHistory.length ? anchoredTurnAt(history, storyHistory[0]) : null;    // Active gate for the name-only tier: every recent speaker in the window (uncapped —
    // the 4-slot budget absorbs it). Computed here so the memory feed below sees the same
    // Active set the dossier tiers use further down.
    const activeSpeakers = this.speakersIn(history);
    // Name-only pool for the memory feed: speakers of the last 2 turns — same window the
    // Active roster uses (ACTIVE_SPEAKER_TURNS), so whoever is talking right now draws backstory.
    const lastTurnSpeakers = this.speakersIn(history, 2);
    const memSel = memoriesForTurn(
      [...(state.memories.manual || []), ...(state.memories.auto || [])],
      {
        chatText: this.recentChatText(history, MEMORY_TRIGGER_WINDOW_TURNS),
        actionText,
        location: curLocTxt,
       heroName: (state.character && state.character.name) || "",
        cap: MEMORY_FEED_CAP * capMultiplier,
        gatedCap: MEMORY_TOPICAL_ACTIVE_CAP * capMultiplier,
        openCap: MEMORY_TOPICAL_OPEN_CAP * capMultiplier,
        nameCap: MEMORY_NAME_FEED_CAP * capMultiplier,
        sceneNpcs: inPlayNpcs,
        activeNpcs: activeSpeakers,
        lastTurnNpcs: lastTurnSpeakers,
        recentFloor
      },
      opts.hybrid || null
    );
    if (memSel.length) {
      const heroName = (state.character && state.character.name) || "";
      const lines = memSel.map(({ m, reason }) => {
        const who = ownerLabel(m.owner, heroName);
        const when = typeof m.turn === "number" && m.turn >= 0 ? agoLabel(state.turn, m.turn) : "";
        const tag = [reason === "manual" ? "player's note" : "", who, when].filter(Boolean).join(" · ");
        return `- [${tag}] ${m.text}`;
      }).join("\n");
      parts.push(
        "MEMORIES (events worth remembering, most relevant first. Each line's tag tells you WHO knows it — ONLY the named characters know it, never treat it as known by anyone not named and never leak it through narration or another character's words/thoughts unless the story has made it theirs — and roughly WHEN it happened. Use them for continuity; never contradict them.):\n" + lines
      );
    }

    // The DISTANT PAST digest — a bounded rolling record of the era that fell off the live memory
    // list as it filled up (public/world knowledge only; named-owner facts are private and are
    // never absorbed into it). It is background canon everyone shares, fed every turn for
    // continuity: history, not current events — the GM should reference it but never re-record
    // its facts as if new, and it carries no owner/turn nuance beyond what each line states.
    const digestTxt = String(((state.memories || {}).digest) || "").trim();
    if (digestTxt) {
      parts.push("DISTANT PAST (compressed public canon from long ago — events that fell off the live memory list as it filled up. Background world knowledge everyone shares — reference it for continuity and never contradict it, but it is HISTORY, not current events, and its facts are already recorded, so do not re-record them as new memories):\n" + digestTxt);
    }

    // NPC PROFILES — one section, three tiers. Full dossiers (incl. secrets + tracked
    // values) only for NPCs that matter RIGHT NOW: recent [Name] speakers (Active),
    // up to FULL_PROFILE_CAP. A merely mentioned name is not presence — non-speakers
    // never earn a dossier, no matter how topical. Everything else rides hooks: the
    // present roster (the same inPlayNpcs set that opens the memory owner-gate above —
    // ordered by the fused relevance rank below; recency-only faces keep
    // most-recently-seen order) plus speaker overflow (recency order) fill up to
    // OVERFLOW_HOOK_CAP hook lines, so an in-scene face never loses its hook to an
    // idle-but-topical one; leftover room goes to HOOK_RELEVANCE_CAP
    // relevance-ranked faces from the idle met + unmet standing cast (high-importance
    // boosted), then HOOK_ROTATION_SLOTS sticky round-robin faces so a big cast surfaces
    // over time. Dossiers + hooks together never exceed NPC_TOTAL_CAP — later tiers yield
    // first. Either tier lets the GM introduce someone naturally — never
    // forced. Unmet cast members are hooks-only now: a first contact plays true to type from
    // the hook, and the full dossier arrives once they're met and registered. One exception:
    // on the opening scene (no speakers, no session NPCs yet) world-cast NPCs named in the
    // Start text get full dossiers — the author put them in the scene, so the GM needs their
    // full psychology to write the entrance, not a hook that forbids inventing voice/manner.
    const npcs = Object.entries(state.npcs || {})
      .filter(([n, d]) => d && d.details && Object.values(d.details).some((v) => v));
    const met = new Set();
    for (const [, e] of npcs) met.add(String((e && e.name) || "").toLowerCase());
    // Recent speakers resolved to session names (most-recent-first). A speaker the session
    // doesn't know is normally impossible — registration runs after every reply — and an
    // unknown name simply earns nothing: it is ignored here, and it is NOT added to the hook
    // pool below (that pool is built from session NPCs + world cast, never from speaker strings).
    const sessionByLower = new Map(npcs.map(([n]) => [String(n).toLowerCase(), n]));
    const activeNames = [];
    const activeOverflow = []; // speakers past FULL_PROFILE_CAP, most-recent-first — hook-overflow tier, below
    for (const s of this.speakersIn(history)) {
      const hit = sessionByLower.get(s.toLowerCase());
      if (!hit || activeNames.includes(hit) || activeOverflow.includes(hit)) continue;
      if (activeNames.length < FULL_PROFILE_CAP) activeNames.push(hit);
      else activeOverflow.push(hit);
    }
    // Present dossiers go to the most scene-relevant of the present roster, ranked with the
    // same fused ranker as hooks (BM25 + vectors, RRF) but NO importance boost — importance
    // is not presence. Faces the ranker drops (recency-only, nothing topical to match) keep
    // most-recently-seen order behind the ranked ones, so the quiet face still beats an older
    // one and the tail never depends on thin signal. Array.sort is stable, so lastSeen ties
    // keep registration order.
    const presentEligible = inPlayNpcs.filter((n) => !activeNames.includes(n));
    const presentRanked = rankNpcCandidates(presentEligible, npcHay, (n) => ((state.npcs || {})[n] || {}), opts.hybrid || null, null);
    const presentRankedSet = new Set(presentRanked);
    const presentRest = presentEligible.filter((n) => !presentRankedSet.has(n)).sort((a, b) => {
      const la = (state.npcs[a] && state.npcs[a].lastSeenTurn) || 0;
      const lb = (state.npcs[b] && state.npcs[b].lastSeenTurn) || 0;
      return lb - la;
    });
    const presentOrdered = [...presentRanked, ...presentRest];
    // Dossiers are Active-only (a mentioned name is not presence) — the whole Present
    // rank rides the hook-overflow tier instead, relevance order. The rank still matters:
    // it decides which in-scene faces keep their hooks when room runs short.
    const presentNames = [];
    const presentOverflow = presentOrdered; // relevance order — hook-overflow tier, below
    const fullNames = new Set([...activeNames, ...presentNames]);
    // Opening-scene exception (see above): world-cast NPCs named in the Start text earn full
    // dossiers on the very first scene. Cap-respecting: whatever FULL_PROFILE_CAP room the
    // (empty-at-opening) session tiers leave. Already-met cast are skipped — the session
    // entry above wins — as are cast names colliding with a session key already fed bigger.
    const openingCast = [];
    if (opening && this.startText) {
      const startHay = sub(this.startText);
      const room = Math.max(0, FULL_PROFILE_CAP - fullNames.size);
      for (const n of (this.worldNpcs || [])) {
        if (openingCast.length >= room) break;
        if (!n || !String(n.name || "").trim()) continue;
        const lower = String(n.name).toLowerCase();
        if (met.has(lower) || sessionByLower.has(lower)) continue;
        if ([...fullNames].some((k) => String(k).toLowerCase() === lower)) continue;
        if (nameHit(startHay, n.name)) openingCast.push(n);
      }
    }
    const openingCastLowers = new Set(openingCast.map((n) => String(n.name).toLowerCase()));
    // One merged hook pool: idle met NPCs (recency order is only the pre-rank shape) + unmet
    // cast in book order. Keys are disambiguated so a cast name can never collide with a
    // session name. Opening-dossier cast is excluded — already fed bigger below.
    const hookPool = [];
    for (const [n, d] of npcs) {
      if (fullNames.has(n)) continue;
      hookPool.push({ key: "met:" + n, entry: d, cast: false, boosted: !!d && d.importance === "high" });
    }
    for (const n of (this.worldNpcs || [])) {
      if (!n || met.has(String(n.name || "").toLowerCase())) continue;
      if (openingCastLowers.has(String(n.name || "").toLowerCase())) continue;
      hookPool.push({ key: "cast:" + n.name, entry: n, cast: true, boosted: false });
    }
    const byKey = new Map(hookPool.map((w) => [w.key, w]));
    const shownKeys = new Set([...fullNames].map((n) => "met:" + n)
      .concat(openingCast.map((n) => "cast:" + n.name)));
    // Dossier overflow eats first: recent-speaker overflow (recency order) then present
    // overflow (relevance order) — an in-scene face never loses its hook to an idle one.
    // True total-cap budgeting: dossiers keep their slots, overflow takes what's left,
    // relevance takes what's left after that, rotation takes the remainder (possibly 0).
    const dossierCount = fullNames.size + openingCast.length;
    const overflowAllowed = Math.max(0, NPC_TOTAL_CAP - dossierCount);
    const overflowHooks = [];
    for (const n of [...activeOverflow, ...presentOverflow]) {
      if (overflowHooks.length >= OVERFLOW_HOOK_CAP) break;
      if (overflowHooks.length >= overflowAllowed) break;
      const w = byKey.get("met:" + n);
      if (!w || shownKeys.has(w.key) || overflowHooks.includes(w)) continue;
      overflowHooks.push(w);
      shownKeys.add(w.key);
    }
    const boostDocs = new Set(hookPool.filter((w) => w.boosted));
    const rankedAll = rankNpcCandidates(hookPool, npcHay, (w) => w.entry, opts.hybrid || null,
      boostDocs.size ? { docs: boostDocs, mult: HOOK_IMPORTANCE_BOOST } : null);
    const relRanked = rankedAll.filter((w) => !shownKeys.has(w.key)).slice(0, Math.min(HOOK_RELEVANCE_CAP, Math.max(0, NPC_TOTAL_CAP - dossierCount - overflowHooks.length)));
    for (const w of relRanked) shownKeys.add(w.key);
    // Global ceiling: dossiers + hooks never exceed NPC_TOTAL_CAP per turn. Dossiers, then
    // overflow, then relevance win, in that order; the sticky rotation yields whatever room
    // is left (zero on a busy turn — those faces surface on a quieter one instead).
    const rotAllowed = Math.max(0, NPC_TOTAL_CAP - fullNames.size - openingCast.length - overflowHooks.length - relRanked.length);
    const rotRanked = this.rotationHooks(state, hookPool.map((w) => w.key), shownKeys)
      .map((k) => byKey.get(k)).filter(Boolean).slice(0, rotAllowed);
    const npcLines = [];
    // Off-screen life tails (Pursuit / Whereabouts) ride only while the adventure simulates
    // them — stored life fields are kept, just not fed to the GM while off.
    const life = !state.settings || state.settings.simNpcLife !== false;
    if (activeNames.length) {
      npcLines.push("ACTIVE — speaking in this scene (Secrets are hidden from the hero — act on them, never reveal):\n" +
        activeNames.map((n) => this.npcProfile((state.npcs[n] || {}), npcVals[n], heroStats, life)).join("\n"));
    }
    if (presentNames.length || openingCast.length) {
      npcLines.push("Present — in or near the scene (may enter; Secrets are hidden from the hero — act on them, never reveal):\n" +
        presentNames.map((n) => this.npcProfile((state.npcs[n] || {}), npcVals[n], heroStats, life))
          .concat(openingCast.map((e) => this.npcProfile(e || {}, npcVals[e.name], heroStats, life))).join("\n"));
    }
    // Hook trimming (Perchance-AI fitting only — fit.hookTrim 0/1/2): the most expendable
    // NPC context drops before any transcript turn is touched. 1 = rotation hooks go;
    // 2 = relevance hooks go too (kept as a mechanism, but fitting never uses it — tested,
    // they're needed). Dossiers and overflow hooks (incl. active-speaker
    // overflow) never trim. The tiers above still compute untouched — rotationHooks
    // advances its spotlight state exactly as before — only assembly filters.
    const hookTrim = (fit && typeof fit.hookTrim === "number") ? fit.hookTrim : 0;
    const hookLines = [...overflowHooks, ...(hookTrim >= 2 ? [] : relRanked), ...(hookTrim >= 1 ? [] : rotRanked)].map((w) => this.npcHook(w.entry || {}, { unmet: !!w.cast, turnNow: state.turn, life }));
    if (hookLines.length) {
      npcLines.push("OTHERS — met before or standing cast (hooks only; you may bring one in naturally when the story allows — never force it. If Whereabouts matches current location, that means NPC is likely there — let the hero run into them when it fits. Never invent looks, voice, or history a hook doesn't state — play only what's listed, and treat an (unmet) tag as never-met):\n" + hookLines.join("\n"));
    }
    if (npcLines.length) {
      parts.push("NPC PROFILES (canon — behave and speak exactly according to them):\n" + npcLines.join("\n"));
    }

    // Per-NPC tracked values — the rules ONCE for the whole cast (never repeated per character;
    // the values themselves are at the end of each character's NPC PROFILES line above). The
    // hero's own TRACKED STATE section rides up with the CHARACTER SHEET instead, so this
    // stays the NPC cluster's rules tail. See README §6.3.1.
    if (this.npcTrackerDefs.length) {
      const sec = buildNpcTrackerRulesContext(this.npcTrackerDefs);
      if (sec) parts.push(sec);
    }

    // The hero's surroundings (from the 🗺 map panel). Only when the caller opted in (the map is
    // ready AND matches the current Location tracker AND the caller judges the GM needs it — see
    // shouldFeedSurroundings in main.js). The GM must know the same places the hero can see on the map.
    const map = state.map;
    // Surroundings trimming (Perchance-AI fitting only — fit.surroundTrim 1): the whole
    // map section drops as the FIRST fitting cut, before hooks or turns.
    // The caller's includeSurroundings opt-in still gates first — trim only removes more.
    const keepSurroundings = !(fit && fit.surroundTrim);
    if (opts.includeSurroundings && keepSurroundings && map && map.status === "ready" && map.pois && map.pois.length && map.loc === normalizeLoc(curLocTxt)) {
      const hx = (map.hero && map.hero.x) || 0;
      const hy = (map.hero && map.hero.y) || 0;
      // The distances are at the map's own scale — indoor maps measure a building in meters, a star
      // system in AU, interstellar space in light-years. Say so, and read "here" at the scale's radius.
      const scaleKey = map.scale || "outdoor";
      const sc = mapScale(scaleKey);
      const scopeTxt = sc.scope;
      const hereR = sc.here;
      parts.push(
        "SURROUNDINGS (the hero's map — these places are canon, " + scopeTxt + "; the hero knows about them and can travel to them):\n" +
        "Current location: " + curLocTxt + "\n" +
        map.pois.map((p) => {
          const rx = (p.dx || 0) - hx;
          const ry = (p.dy || 0) - hy;
          const d = Math.hypot(rx, ry);
          const distTxt = d < hereR ? "here" : formatDistance(d, scaleKey) + " " + compassDir(rx, ry);
          return `- ${p.name} — ${distTxt}: ${p.desc}`;
        }).join("\n")
      );
    }

    // Transcript lines are held aside (not joined yet): stage-2 fitting at the end may shorten
    // stale narration, which only re-renders this one part — turn span never changes, so the
    // recentFloor/memories above stay valid.
    let transcript = null, transcriptIdx = -1;
    if (storyHistory.length) {
      const rawLines = storyHistory.map((m) => this.fmt(m));
      const rawRoles = storyHistory.map((m) => (m && m.role) || "");
      // REPLY: cue — one line between each player turn and the GM response answering it, so
      // the boundary is explicit (GM narration itself carries no label). Inserted here rather
      // than in fmt() so BM25 retrieval queries (recentChatTurns) stay cue-free. Role "cue" is
      // inert for stage-2 fitting (only "narrator" lines cut, only action/direct count as anchors).
      const lines = [], roles = [];
      for (let i = 0; i < storyHistory.length; i++) {
        lines.push(rawLines[i]);
        roles.push(rawRoles[i]);
        if ((rawRoles[i] === "action" || rawRoles[i] === "direct") && i + 1 < storyHistory.length) {
          const nr = rawRoles[i + 1];
          if (nr !== "action" && nr !== "direct") { lines.push("REPLY:"); roles.push("cue"); }
        }
      }
      transcript = {
        lines,
        roles,
        turns: Math.max(1, windowTurnGroups(storyHistory).length),
        truncated: false
      };
      transcriptIdx = parts.length;
      parts.push("");
    }

    if (kind === "travel") {
      const tScale = (state.map && state.map.scale) || "outdoor";
      const timeHint = mapScale(tScale).unit === "m"
        ? "advance time realistically for the distance — minutes for a nearby spot (under ~100 m), an hour or two for a medium distance, most of a day for a long one"
        : "advance time realistically for the distance at this map's scale — " + mapScale(tScale).travel;
      parts.push("TRAVEL ACTION: " + actionText);
      parts.push("TRAVELING TO A DESTINATION: The hero is setting out for a specific place — its name, type, distance and bearing are in the action above and on the SURROUNDINGS map. Handle the reply in three steps. 1) CONCLUDE THE CURRENT SCENE SWIFTLY: resolve the immediate moment in a sentence or two — the conversation winds down, the moment passes; do not drag it out. 2) NARRATE THE JOURNEY: " + timeHint + " — and describe the route, terrain and whatever the hero passes along the way; let the Day/Time tracked values reflect however much time the travel takes. 3) END WITH ARRIVAL: describe reaching the destination and the new scene there, with a hook. After arrival the hero's location IS the destination, so set the location tracker to '<current region> — <destination name>' (e.g. 'Thornwood — Old Stone Bridge', or for space 'Sol System — Aurora Station') once they arrive.");
    } else if (kind === "advance") {
      parts.push("SCENE TRANSITION: The player is ending the current scene. First, CONCLUDE the current scene: wrap up the immediate moment concisely in a sentence or two — the current action resolves, the conversation winds down, the moment passes. Then START THE NEXT SCENE: move the story forward in time and/or to a new location or situation, naturally connected to everything that has happened — the hero travels, a day passes, they arrive somewhere new, a fresh situation unfolds. Describe the new scene vividly in second person — the setting, people present, atmosphere, and a hook to draw the hero in.");
    } else if (kind === "death") {
      const hk = opts.deathKey || "health";
      const hl = opts.deathLabel ? String(opts.deathLabel) : hk;
      parts.push(
        "THE HERO IS DEAD: " + hero + "'s " + hl + " (" + hk + ") has just reached 0 — the hero has died as a result of the turn above. Write the FINAL passage of this story, and make it an ending:\n" +
        "- Pick up exactly where the previous turn ended and carry it to its conclusion — do NOT repeat or re-narrate anything already written above.\n" +
        "- Narrate the hero's death with gravity and finality, in second person: the final moments, the last breath or last thought, the world receding around them.\n" +
        "- Resolve what is immediately left hanging — how the characters present react, what becomes of the hero, the silence that follows.\n" +
        "- Close on a resonant final note (a sense of aftermath, memory, or what the death leaves behind). Do not start any new plot, and do not revive, rescue, or spare the hero.\n" +
        "Do not offer choices or invite the hero to act, and never write narration or [Name] dialogue that implies the story continues. This is an ending, not a cliffhanger."
      );
    } else if (actionText) {
      if (kind === "direct") {
        parts.push("NARRATION DIRECTIVE (OOC instruction from the player — NOT an in-world action): " + actionText);
        parts.push("Follow the directive: shift the narrative exactly as instructed and narrate the result in second person. The hero reacts naturally if the directive touches them, but you never invent the hero's choices, words, or dialogue. Never mention, acknowledge, or quote this directive in your reply — simply weave it into the fiction.");
      } else {
        parts.push("LATEST ACTION: " + actionText);
      }
    } else if (opening) {
      parts.push("The adventure is just beginning. Open the scene following the STARTING SCENARIO above. Begin with narration that sets the scene. Do not start with quoted lines.");
    } else {
      parts.push("The hero is idle. Continue the story.");
    }
    if (opts.check) {
      const c = opts.check;
      const label = String(c.statLabel || c.stat || "?").toUpperCase();
      const modTxt = (c.mod >= 0 ? "+" : "−") + Math.abs(c.mod);
      const critPass = c.crit === "pass";
      const critFail = c.crit === "fail";
      const nearMiss = !c.passed && c.margin >= -2 && c.margin < 0;
      // One outcome, one instruction — the branches the result didn't take are omitted entirely,
      // so the GM never hedges between succeeding and failing in the same reply.
      const guidance = critPass
        ? "CRITICAL SUCCESS: the action succeeds spectacularly — beyond what was attempted. Grant an extra benefit (an opening, a discovery, admiration) and make the moment memorable."
        : critFail
          ? "CRITICAL FAILURE: the action fails dramatically and things get worse — a complication, cost, or new danger. Never a dead end: the story moves forward through the mess."
          : c.passed
            ? "SUCCESS: the hero's action succeeds — narrate it with fitting skill and flair."
            : nearMiss
              ? "NEAR MISS: the action almost works — grant a partial result or success at a cost, and keep the story moving."
              : "FAILURE: the action fails — narrate consequences and keep the story moving forward; a failure is never a dead end.";
      parts.push(
        "SKILL CHECK (already rolled for the LATEST ACTION — your reply MUST faithfully reflect this result; never re-roll, override, or contradict it):\n" +
        `[${label}] rolled ${c.die} ${modTxt} = ${c.total} vs DC ${c.dc} — ${critPass ? "CRITICAL SUCCESS" : critFail ? "CRITICAL FAILURE" : c.passed ? "SUCCESS" : nearMiss ? "NEAR MISS" : "FAILURE"}.\n` +
        guidance
      );
    }
    parts.push("Now write your reply:");
    if (transcript) {
      // Stage 2 runs only when the send path allows it (nothing left to drop): with
      // truncate !== false a direct caller (tests) gets the old measure-and-shorten behavior.
      if (fit && fit.truncate !== false) {
        const measure = fit.measure || ((s) => Math.ceil(String(s).length / PERCHANCE_CHARS_PER_TOKEN));
        fitTranscript(parts, transcriptIdx, transcript, measure, sub);
        if (this.lastFit) this.lastFit.truncated = transcript.truncated;
      } else {
        parts[transcriptIdx] = transcriptHeader(transcript) + transcript.lines.join("\n");
      }
    }
    // One blanket pass over the assembled context: every section above (the narrator prompt, the
    // lorebook, cast dossiers, memories, AI-written state) may carry `{{user}}`, and none of it may
    // reach the model as a raw token.
    return sub(parts.join("\n\n"));
  }

  // Return only the last `n` player turns of history (a turn = one action/direct anchor plus
  // the GM messages after it). Older messages fall out of the window — their durable facts
  // live in MEMORIES instead. Scene-image turns never count as anchors or appear here.
  recentWindow(history, n) {
    const out = [];
    let anchors = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      const m = history[i];
      if (m.role === "image" || m.role === "check" || m.role === "choice") continue;
      if (anchors >= n) break;
      if (m.role === "action" || m.role === "direct") anchors++;
      out.unshift(m);
    }
    return out;
  }

  // The raw transcript (every role) of the last `n` player turns as an ARRAY of per-message
  // strings, oldest → newest — the BM25 query text is built from it (see loreForTurn). n defaults
  // to the lorebook's lookback window, DEFAULT_TRIGGER_WINDOW_TURNS (the WORLD LORE / NPC-roster
  // matches use this); the MEMORIES feed passes MEMORY_TRIGGER_WINDOW_TURNS (same 3-turn
  // window since the narrowing — see memory-system.js).
  // Image/check messages are player-only and carry no story content for the GM, so they're skipped.
  recentChatTurns(history, n = DEFAULT_TRIGGER_WINDOW_TURNS) {
    const msgs = [];
    let anchors = 0;
    for (let i = (history || []).length - 1; i >= 0; i--) {
      const m = history[i];
      if (!m) continue;
      if (m.role === "image" || m.role === "check" || m.role === "choice") continue;
      if (anchors >= n) break;
      if (m.role === "action" || m.role === "direct") anchors++;
      msgs.unshift(m);
    }
    return msgs.map((m) => this.fmt(m));
  }

  // The same window joined into one string — the BM25 query text (NPC roster, MEMORIES feed).
  recentChatText(history, n = DEFAULT_TRIGGER_WINDOW_TURNS) {
    return this.recentChatTurns(history, n).join("\n");
  }

  // Feed the transcript in EXACTLY the format the GM is instructed to write, so the model learns
  // the format from its own past turns instead of contradicting it (it imitates this block):
  // NPC dialogue as `[Name] "..."`, inner thoughts as `[Name inner] ...`, narration as plain
  // prose with no `GM:` label. NPC text already carries its own wrapping quotes — don't add more.
  fmt(m) {
    if (m.role === "action") return m.kind === "idle" ? "PLAYER (idle — the hero waits and gives no instruction)" : `PLAYER: ${m.text}`;
    if (m.role === "direct") return m.kind === "advance" ? "SCENE TRANSITION (the player skipped ahead — a new scene began here)" : `NARRATION DIRECTIVE (OOC): ${m.text}`;
    // Linked lines feed their canonical roster name (the bubble itself keeps the GM's variant
    // spelling) so the model keeps learning the canon form and owners stay unified.
    if (m.role === "npc") return `[${m.npcKey || m.name}] ${m.text}`;
    if (m.role === "thought") return `[${m.npcKey || m.name} inner] ${m.text}`;
    if (m.role === "choice") return ""; // engine directive, not story — never fed to the GM
    return String(m.text || "").trim().replace(/^(?:GM|PLAYER|OOC|META|SYSTEM)\s*:\s*/i, "");
  }

  // One character's dossier line. Placeholder-only fields (blank, "—", "none notable") are
  // omitted WITH their label, so the GM never sees a `Secrets: —` that reads like redaction.
  // `values` (optional) is their live NPC-tracker value set: it is
  // appended as a trailing `Tracked: …` clause so the GM can keep narration consistent with the
  // numbers the player sees. The rules for those trackers are NOT repeated here — they are rendered
  // once in the NPC TRACKED STATE section (see README §6.3.1). The hidden-from-hero rule for
  // Secrets lives on the tier headers above, not on each line.
  npcProfile(entry, values, stats, life = true) {
    const d = entry.details || {};
    const headBits = [d.race, d.gender, d.age, d.job].filter((v) => !blankDetail(v));
    const bits = [];
    for (const [k, label] of [["appearance", "Appearance"], ["persona", "Persona"], ["extra", "Extra details"], ["secrets", "Secrets"]]) {
      if (!blankDetail(d[k])) bits.push(`${label}: ${d[k]}`);
    }
    // Off-screen private life (see npc-life.js): the NPC's current mini-goal,
    // kept current even on routine ticks that recorded no memory. One clause
    // so mundane continuity ("still saving for the debt") reaches the GM
    // without spending a memory on it; secrets stay where they were.
    // Omitted while the adventure's life simulation is off (stored goal kept).
    const pursuit = life ? String((entry && entry.lifeGoal) || "").trim() : "";
    if (pursuit) {
      const pi = bits.findIndex((b) => b.indexOf("Secrets:") === 0);
      const pl = `Pursuit: ${ellipsize(pursuit, 200)}`;
      if (pi >= 0) bits.splice(pi, 0, pl);
      else bits.push(pl);
    }
    const head = `${entry.name}${headBits.length ? ` (${headBits.join(", ")})` : ""}`;
    const tracked = (values && this.npcTrackerDefs && this.npcTrackerDefs.length) ? npcTrackerValuesLine(this.npcTrackerDefs, values, stats) : "";
    const tail = tracked ? `${bits.length ? "; " : ""}Tracked: ${tracked}` : "";
    const desc = blankDetail(entry.description) ? "" : entry.description;
    return `- ${head} — ` + (bits.length || tracked ? bits.join("; ") + tail : (desc || "no profile yet"));
  }

  // Compact one-line roster entry — name, role, and a distinctive trait. Deliberately excludes
  // secrets and most of the dossier: roster lines are shown to the GM every turn, so they stay
  // small. Used for met-but-idle known NPCs and the unmet standing cast (`unmet` tags the
  // latter — the hero hasn't met them, so the GM must not act as if they have).
  // Off-screen life rides along when present (see npc-life.js): the NPC's current
  // mini-goal as `Pursuit:` plus their last reported `Whereabouts:` with its age,
  // so the GM can run the hero into them where they actually are. World-cast
  // entries never carry life fields, so their lines stay as short as before.
  // The base line is compactNpcLine (text-utils.js) — the same builder the life
  // call's company sketches use.
  npcHook(entry, { unmet = false, turnNow = null, life = true } = {}) {
    const base = compactNpcLine(entry || {}, 160, unmet ? ["unmet"] : []);
    const tail = [];
    const goal = life ? String((entry && entry.lifeGoal) || "").trim() : "";
    if (goal) tail.push(`Pursuit: ${ellipsize(goal, 100)}`);
    const where = life ? String((entry && entry.lifeWhere) || "").trim() : "";
    if (where) {
      // A stored whereabouts describes where the NPC drifted off to — once they're back in the
      // shown story (seen within the off-screen window) they're standing right here, so the old
      // place would mis-stage them and rides along no more. Presence unknown → keep it.
      const ls = (entry && typeof entry.lastSeenTurn === "number") ? entry.lastSeenTurn : 0;
      const offscreen = (typeof turnNow === "number") ? turnNow - ls : Infinity;
      if (offscreen >= NPC_LIFE_MIN_OFFSCREEN_TURNS) {
        const lt = (entry && typeof entry.lifeTick === "number") ? entry.lifeTick : -1;
        const w = ellipsize(where, 80);
        if (lt >= 0 && typeof turnNow === "number") {
          const age = Math.max(0, turnNow - lt);
          tail.push(age === 0 ? `Whereabouts: ${w}` : `Whereabouts (${age} turn${age === 1 ? "" : "s"} ago): ${w}`);
        } else if (lt >= 0) tail.push(`Whereabouts (turn ${lt}): ${w}`);
        else tail.push(`Whereabouts: ${w}`);
      }
    }
    return `${base}${tail.length ? "; " + tail.join("; ") : ""}`;
  }

  // Start a generation, remembering the promise so stop() can abort it. The plugin's promise has
  // its own .stop(); we just release our reference once it settles so a later stop() can't touch a
  // finished call. Kept in a SET: the hero tracker call and the NPC tracker call run in parallel.
  _gen(opts) {
    const p = this.genText(opts);
    const active = this._active || (this._active = new Set());
    active.add(p);
    const clear = () => active.delete(p);
    if (p && typeof p.then === "function") p.then(clear, clear);
    return p;
  }

  // Abort this turn's current generation (the composer's stop button). Whatever has streamed in is
  // kept — the promise resolves with the partial text — but the remaining AI calls of the turn are
  // skipped (the `_aborted` guards), so no tracker update/death scene is spent on a cut reply.
  // EVERY in-flight call is stopped (the narrative reply, and the parallel hero + NPC tracker
  // calls).
  stop() {
    this._aborted = true;
    for (const p of this._active || []) {
      try { if (p && typeof p.stop === "function") p.stop(); } catch (e) { console.error("generation stop failed:", e); }
    }
  }

  // Clear the previous turn's stop state. Called at the start of every turn.
  clearStop() {
    this._aborted = false;
    this._active = new Set();
    this.lastError = null;
  }

  // Transcript fit opts for this send ({ measure } on Perchance AI, null otherwise). An
  // explicitly-passed opts.fit (tests, probes) is respected as-is. External providers get null:
  // their large inputs absorb the full window, so fitting would only multiply work.
  // Per-route: the GM toggle decides — a GM switched back to Perchance trims like Perchance.
  async gmFitOpts(explicit) {
    if (explicit !== undefined) return explicit;
    if (!(await isPerchanceAIFor("gm"))) return null;
    const count = gmCounter(this.genText);
    return { measure: count || ((s) => Math.ceil(String(s).length / PERCHANCE_CHARS_PER_TOKEN)) };
  }

  // Build the GM instruction, fitting the transcript to the input cap on Perchance AI:
  // re-build dropping the SURROUNDINGS map section first, then rotation hooks, then dropping
  // one more baked turn per pass until the full prompt fits (or nothing droppable remains),
  // then one final pass allowing narration truncation. Relevance hooks are never cut.
  // External providers
  // (and explicit null) take the full window unmeasured. Returns the exact string to send.
  // this.lastFit (set by buildContext) reports the final pass: { canDropMore, truncated, hookTrim, surroundTrim }.
  async fittedInstruction(state, history, actionText, kind, opening, opts, hybrid) {
    const fitBase = await this.gmFitOpts(opts.fit);
    const capMultiplier = (await isPerchanceAIFor("gm")) ? 1 : EXTERNAL_CAP_MULTIPLIER;
    const build = (dropTurns, truncate, hookTrim, surroundTrim) =>
      this.buildContext(state, history, actionText, kind, opening, { ...opts, hybrid, capMultiplier, fit: fitBase ? { ...fitBase, dropTurns, truncate, hookTrim, surroundTrim } : null });
    if (!fitBase) return build(0, false, 0, 0);
    const measure = fitBase.measure || ((s) => Math.ceil(String(s).length / PERCHANCE_CHARS_PER_TOKEN));
    const limit = PERCHANCE_INPUT_CAP - GM_FIT_MARGIN;
    // Stage 0: surroundings first — the whole map section drops before anything else.
    // Then rotation hooks (hookTrim 1). Relevance hooks are never cut — tested, they're needed.
    // Dossiers + overflow hooks (incl. active-speaker overflow) never trim.
    for (const [hookTrim, surroundTrim] of [[0, 0], [0, 1], [1, 1]]) {
      const instruction = build(0, false, hookTrim, surroundTrim);
      if (measure(instruction) <= limit) return instruction;
    }
    let dropTurns = 0;
    for (;;) {
      const instruction = build(dropTurns, false, 1, 1);
      if (measure(instruction) <= limit) return instruction;
      if (!this.lastFit || !this.lastFit.canDropMore || dropTurns >= RECENT_TURNS) {
        return build(dropTurns, true, 1, 1);
      }
      dropTurns++;
    }
  }

  // Stream a GM turn. onStream(accumulatedText) is called as it grows.
  // Resolves with the parsed list of messages. Each message carries `afterTrackers` — the full
  // tracked-state snapshot after this turn (from the GM's [TRACKERS] block) — so the live state
  // can always be derived from the messages, and deletes/re-rolls/nav revert correctly.
  async generateGmReply(state, history, actionText, onStream, kind = "action", opening = false, opts = {}) {
    // The player stopped during the pre-reply skill check — don't spend a whole reply on a turn
    // they already cancelled (the turn simply has no GM text; see runGmTurn).
    if (this._aborted) return [];
    // Hybrid retrieval: embed this turn's query (fast-null on a cold model —
    // that turn runs BM25 and the model keeps warming in the background).
    const hybrid = await hybridForTurn(this, state, history, actionText);
    const instruction = await this.fittedInstruction(state, history, actionText, kind, opening, opts, hybrid);
    this.lastInstruction = instruction;
    let acc = "";
    let result;
    try {
      // Auto-stop the stream the moment the GM leaks its tracker context (a `TRACKED STATE`
      // echo, sometimes after a `✦ ✦ ✦` line, or a machine `[TRACKERS]` / `[NPC TRACKERS]`
      // block) into the story. Two layers: `stopSequences` asks the model to stop itself (saves
      // tokens), and the onChunk backstop aborts client-side the moment the header lands (covers
      // providers/casings the stop sequence misses). This is NOT a user abort — `_aborted` stays
      // false so the dedicated tracker-update calls below still run on the kept story.
      let genP = null;
      let leakStopped = false;
      genP = this._gen({
        instruction,
        maxTokens: GM_REPLY_MAX_TOKENS,
        route: "gm",
        stopSequences: TRACKER_LEAK_STOPS.slice(),
        onChunk: (d) => {
          if (d && d.textChunk) {
            acc += d.textChunk;
            if (!leakStopped && findTrackerLeakStart(acc) >= 0) {
              leakStopped = true;
              console.warn("[mno] GM narrative leaked tracker state — stopping stream at the header.");
              try { if (genP && typeof genP.stop === "function") genP.stop(); } catch (e) {}
            }
            if (onStream) onStream(acc);
          }
        }
      });
      result = await genP;
    } catch (e) {
      // A failed generation is a system error, never story: save nothing, stream nothing, so the
      // failure can't pollute the transcript, memories, or the next turn's context. The caller
      // surfaces it as a toast from lastError (see runGmTurn).
      this.lastError = e;
      return [];
    }
    const raw = (acc && acc.trim()) || String((result && result.text) || result || "").trim() || "";
    // Defensive: cut a leaked TRACKED STATE echo (header through end of text) FIRST, then strip a
    // stray machine block, so neither ever renders as narration nor leaks into history. The
    // authoritative state comes from the dedicated tracker-update calls below. The NPC block must
    // be extracted FIRST: its per-character `Name:`
    // headers also match the hero block's `key:` line shape, so the hero extractor would swallow
    // them (see README §6.3.1).
    const deLeaked = stripTrackerLeak(raw);
    const { text: noNpcBlock } = extractNpcTrackers(deLeaked);
    const { text } = extractTrackers(noNpcBlock);
    const parsed = this.parseGmOutput(text);
    // The player stopped this reply mid-stream: keep the partial text, but don't spend the
    // follow-up tracker calls on a reply they cut short — the tracked state simply carries over
    // from the last turn (see runGmTurn / updateTrackers).
    if (this._aborted) return parsed;
    const wantHero = this.trackerDefs.length > 0;
    const wantNpc = this.npcTrackerDefs.length > 0;
    if (wantHero || wantNpc) {
      // The characters THIS reply introduces must exist as entries before the NPC tracker call, so
      // that call can fill in their values on the very turn they appear. Otherwise a newcomer has
      // no entry (improvised NPC) or no profile yet (the build is still running) at roster time, so
      // they would sit on their bare seeded start values until their next appearance — the
      // one-turn lag, which is worst for NPCs outside the world cast
      // (see README §6.3.1). The callback does SYNCHRONOUS entry creation only: the
      // profile/portrait build still runs normally from `noteNpcs` after the turn.
      let newcomers = [];
      if (wantNpc && typeof opts.registerReplyNpcs === "function") {
        try { newcomers = opts.registerReplyNpcs(parsed) || []; }
        catch (e) { console.error("npc pre-register failed:", e); }
      }
      // The characters who actually acted in this reply — npc/thought message names, read off the
      // parsed reply itself. Linked lines report their canonical key (`npcKey`), so a variant
      // spelling ("Garreth") still prioritizes its roster entry ("Captain Garreth") instead of a
      // name the roster doesn't hold. Exact, unlike matching names against prose text, and they
      // get first claim on the NPC tracker roster's slots (see npcTrackerRoster).
      const speakers = wantNpc
        ? [...new Set((parsed || []).filter((m) => m && m.name && (m.role === "npc" || m.role === "thought")).map((m) => m.npcKey || m.name))]
        : [];
      // Both calls take the finished reply as their only input and neither depends on the other, so
      // they run in PARALLEL (see README §6.3.1).
      const [trackers, npcSnap] = await Promise.all([
        // The cleaned story (leak cut out), never the raw stream: a leaked echo carries stale
        // values that must not bias the tracker call.
        wantHero ? this.updateTrackers(state, text, actionText) : Promise.resolve(null),
        wantNpc ? this.updateNpcTrackers(state, text, actionText, { newcomers, speakers }) : Promise.resolve({})
      ]);
      for (const m of parsed) {
        if (trackers) m.afterTrackers = trackers;
        if (npcSnap && Object.keys(npcSnap).length) m.afterNpcTrackers = npcSnap;
        // Names the tracker call changed off-screen (banked happenings): stamped beside the
        // snapshot so change chips can suppress absent-NPC bookkeeping (durable on the message —
        // re-renders and rewinds stay consistent). See npcTrackerDeltas.
        const offMuted = this.lastNpcTrackerOffscreen || [];
        if (offMuted.length && npcSnap && Object.keys(npcSnap).length) m.afterNpcTrackersOffscreen = [...offMuted];
      }
    }
    return parsed;
  }

  // The hero's life tracker has just hit 0. Run ONE more GM call to conclude the scene and narrate
  // the hero's death (kind:"death" in buildContext). `history` must already include the fatal turn,
  // so the GM continues from it. There is deliberately NO tracker update after it — the state is
  // settled, and calling the tracker again could only muddle it. Returns the parsed messages; the
  // caller tags them as the game-over point.
  async generateDeathScene(state, history, onStream) {
    if (this._aborted) return [];
    const def = lifeTracker(this.trackerDefs);
    const hybrid = await hybridForTurn(this, state, history, null);
    const instruction = await this.fittedInstruction(state, history, null, "death", false, {
      deathKey: def ? def.key : "",
      deathLabel: def ? def.label || "" : "",
    }, hybrid);
    this.lastInstruction = instruction;
    let acc = "";
    let result;
    try {
      // Same leak auto-stop as generateGmReply (see above): never a user abort, so `_aborted`
      // stays false and the kept story is returned normally.
      let genP = null;
      let leakStopped = false;
      genP = this._gen({
        instruction,
        maxTokens: GM_REPLY_MAX_TOKENS,
        route: "gm",
        stopSequences: TRACKER_LEAK_STOPS.slice(),
        onChunk: (d) => {
          if (d && d.textChunk) {
            acc += d.textChunk;
            if (!leakStopped && findTrackerLeakStart(acc) >= 0) {
              leakStopped = true;
              console.warn("[mno] GM death scene leaked tracker state — stopping stream at the header.");
              try { if (genP && typeof genP.stop === "function") genP.stop(); } catch (e) {}
            }
            if (onStream) onStream(acc);
          }
        }
      });
      result = await genP;
    } catch (e) {
      // Same as generateGmReply: a system error, never story — nothing saved, toast via lastError.
      this.lastError = e;
      return [];
    }
    const raw = (acc && acc.trim()) || String((result && result.text) || result || "").trim() || "";
    const { text } = extractTrackers(stripTrackerLeak(raw));
    return this.parseGmOutput(text);
  }

  // Reconstruct what the tracker has already applied, from the per-turn snapshots stored on the
  // messages. Each turn's GM messages carry `afterTrackers` (the snapshot after that turn), so
  // consecutive snapshots give the exact deltas the tracker recorded — the only reliable record
  // of "what is already reflected in the current values". We do NOT assume the previous turn was
  // tracked perfectly: if it changed nothing (or its event was missed), there is simply no diff,
  // so the latest turn is free to apply that event. Returns the previous turn's text plus the
  // applied-changes lines for the last `limit` turns.
  recentTrackerHistory(state, defs, limit = 4) {
    const msgs = (state && state.messages) || [];
    const turns = [];
    let cur = null;
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      if (!m) continue;
      if (m.role === "action" || m.role === "direct") { cur = null; continue; }
      if (m.afterTrackers && typeof m.afterTrackers === "object") {
        if (!cur) { cur = { snap: m.afterTrackers, text: [] }; turns.push(cur); }
        // Attribute dialogue like every other previous-turn builder does (previousTurnText,
        // prevTurnText, fmt) — bare quotes leave the tracker calls guessing who spoke.
        if (typeof m.text === "string") {
          if (m.role === "npc" && m.name) cur.text.push(`[${m.npcKey || m.name}] ${m.text}`);
          else if (m.role === "thought" && m.name) cur.text.push(`[${m.npcKey || m.name} inner] ${m.text}`);
          else cur.text.push(m.text);
        }
      }
    }
    const lines = [];
    for (let t = Math.max(1, turns.length - limit); t < turns.length; t++) {
      lines.push(...diffTrackers(turns[t - 1].snap, turns[t].snap, defs));
    }
    const prev = turns.length ? turns[turns.length - 1].text.join("\n\n").trim() : "";
    return { prevText: prev, appliedChanges: lines };
  }

  // Dedicated tracker-update call, run AFTER the narrative reply has finished streaming. The narrative
  // model only reads the current values (buildTrackerValuesContext); emitting the machine block is not
  // its job (it sometimes forgot or slopped it), so this small focused call does that one thing and is
  // far more reliable. On failure (or no block) the previous snapshot is kept unchanged — values are
  // never zeroed.
  async updateTrackers(state, replyText, actionText, opts = {}) {
    const current = getCurrentTrackers(state, this.trackerDefs);
    if (this._aborted) return current; // stopped — keep the previous snapshot untouched
    const heroStats = (state.character && state.character.stats) || {};
    const { prevText, appliedChanges } = this.recentTrackerHistory(state, this.trackerDefs);
    const appliedTxt = appliedChanges.length
      ? appliedChanges.map((l) => "  " + l).join("\n")
      : "  (none — the previous turn changed no tracked value)";
    const instruction = [
      "You are the game-state tracker for a text RPG. The tracked values below are the state AFTER the previous story turn, exactly as the tracker recorded it — they are the ground truth to build on, not a perfect guarantee. Your job is to output the state AFTER the LATEST turn: apply what the latest turn genuinely changes, keep everything else exactly as-is, and keep every value consistent with the narration.",
      buildTrackerContext(this.trackerDefs, current, heroStats),
      prevText ? "PREVIOUS STORY TURN (already handled — for reference only):\n" + prevText : "(this is the very first turn — there is no previous turn)",
      "CHANGES THE TRACKER ALREADY APPLIED (already reflected in the values above — do NOT apply them again):\n" + appliedTxt,
      actionText ? "The player's action/directive this turn: " + actionText : "",
      "LATEST STORY TURN TO TRACK:\n" + replyText,
      "Output ONLY the [TRACKERS] block for the state AFTER this turn — nothing before or after it."
    ].filter(Boolean).join("\n\n");
    const finalTrackerInstruction = subUser(instruction, heroNameOf(state));
    this.lastTrackerInstruction = finalTrackerInstruction;
    let out = "";
    try {
      const res = await this._gen({ instruction: finalTrackerInstruction, route: "tracker", maxTokens: heroTrackerOutputCap(this.trackerDefs, !(await isPerchanceAIFor("tracker"))) });
      out = String((res && res.text) || res || "").trim();
    } catch (e) {
      console.error("tracker update failed:", e);
      return current;
    }
    const { block } = extractTrackers(out);
    const snap = block ? parseTrackerBlock(block, this.trackerDefs, current, heroStats) : current;
    // Backstop: if the tracker call left exp pinned at its cap without applying the level-up,
    // enforceLevelUp fixes the pair deterministically (pure arithmetic, no extra call). The
    // read-only token estimator passes levelUpBackstop:false so it never even runs the check.
    if (opts.levelUpBackstop === false) return snap;
    return this.enforceLevelUp(snap, current, heroStats);
  }

  // The previous turn's GM prose — the "already handled, for reference only" block of the NPC
  // tracker call. `recentTrackerHistory` supplies it when the world has hero trackers (it keys off
  // `afterTrackers`); a world with ONLY NPC trackers has no such snapshots, so fall back to the
  // tail of the transcript (the current turn's reply is not in `state.messages` yet, so the newest
  // GM messages there ARE the previous turn).
  previousTurnText(state) {
    const msgs = (state && state.messages) || [];
    const out = [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (!m) continue;
      if (m.role === "action" || m.role === "direct") break;
      if (m.role === "narrator" || m.role === "npc") {
        const t = String(m.text || "").trim();
        if (t) out.unshift(m.role === "npc" && m.name ? `[${m.name}] ${t}` : t);
      }
    }
    return out.join("\n\n").slice(-3000);
  }

  // The characters this turn's NPC tracker call may cover: the in-play roster (the same notion the
  // dossiers use), PLUS everyone who acted in the reply this turn — the characters who just spoke or
  // thought are exactly who tends to change values, and they are what the cap is spent on.
  //
  // `newcomers` are the names this reply introduced, already registered as entries by the caller
  // (see generateGmReply's registerReplyNpcs). They need the extra push because inPlayNpcs requires
  // a PROFILE, and a character introduced this turn has none yet — the build runs in the background
  // — so without them the very turn they should be tracked is the one turn they are invisible. The
  // fold seeds them from their entry (world-cast `trackers` override, or the defs' start values), so
  // the call fills in real values from the reply on their first appearance instead of leaving them
  // on the seed until next turn (see README §6.3.1).
  //
  // `speakers` are the characters who actually ACTED in this reply (its npc/thought message names —
  // exact, not a keyword guess). They outrank even pinned characters, because a pinned, silent
  // character's values cannot change this turn (absent = unchanged, they simply carry over), while a
  // character who just acted is the only one whose values can. Without that rule a save with more
  // pinned characters than `NPC_TRACKER_CAP` would spend every slot on the same silent faces and
  // never track the actor.
  //
  // Capped, in priority order: this turn's speakers → pinned → most recently seen, so a crowded
  // scene can't blow up the call's context or output and the cap can never drop someone who acted.
  npcTrackerRoster(state, hay, newcomers, speakers) {
    const npcs = (state && state.npcs) || {};
    const set = new Set(this.inPlayNpcs(state, hay).filter((n) => npcs[n]));
    for (const n of newcomers || []) if (npcs[n]) set.add(n);
    const acted = new Set(speakers || []);
    for (const n of newcomers || []) acted.add(n);
    return [...set]
      .sort((a, b) => {
        const aa = acted.has(a) ? 1 : 0, ab = acted.has(b) ? 1 : 0;
        if (aa !== ab) return ab - aa;
        const pa = npcs[a].pinned ? 1 : 0, pb = npcs[b].pinned ? 1 : 0;
        if (pa !== pb) return pb - pa;
        return (npcs[b].lastSeenTurn || 0) - (npcs[a].lastSeenTurn || 0);
      })
      .slice(0, NPC_TRACKER_CAP);
  }

  // Dedicated NPC tracker call, run in PARALLEL with the hero tracker call (both take the finished
  // reply as their input and neither depends on the other — see generateGmReply). Same contract as
  // updateTrackers: on failure, on abort, or with no block, the result is `{}` — "no character
  // changed" — so a bad call can never zero a character's values. Values are written as SPARSE
  // per-character snapshots (only characters the turn changed), which is what makes each
  // character's value revert correctly when a turn is deleted or re-rolled.
  // Off-screen life handoff: banked NPC-owned happenings (see bankedOffscreenEvents) ride along
  // in an OFF-SCREEN section with their own mini-cap, and names the call changed off-screen are
  // exposed on this.lastNpcTrackerOffscreen for the snapshot marker (chip suppression).
  async updateNpcTrackers(state, replyText, actionText, opts = {}) {
    this.lastNpcTrackerOffscreen = [];
    const defs = this.npcTrackerDefs;
    if (!defs || !defs.length) { this.lastNpcTrackerInstruction = null; return {}; }
    if (this._aborted) return {};
    const heroStats = (state.character && state.character.stats) || {};
    const curLocTxt = locationValue(this.trackerDefs, getCurrentTrackers(state, this.trackerDefs));
    const npcHay = [this.recentChatText((state && state.messages) || []), curLocTxt, actionText, replyText].filter(Boolean).join("\n");
    const roster = this.npcTrackerRoster(state, npcHay, opts.newcomers, opts.speakers);
    const rosterSet = new Set(roster);
    // Off-screen handoff: banked happenings ride OUTSIDE the roster cap, so absent faces can
    // never evict the in-play characters (or starve the call when nobody is in play).
    const offscreen = bankedOffscreenEvents(state, rosterSet);
    const offNames = offscreen.map((o) => o.name);
    if (!roster.length && !offNames.length) { this.lastNpcTrackerInstruction = null; return {}; } // nobody in play and nothing banked — spend no tokens at all
    const byNpc = {};
    for (const n of [...roster, ...offNames]) byNpc[n] = foldNpcTrackers(state, n, defs, heroStats);
    const prevText = this.recentTrackerHistory(state, this.trackerDefs).prevText || this.previousTurnText(state);
    const offSection = offscreen.length ? [
      "In addition to the characters above, the following off-screen characters may also appear in your block — ONLY through their banked happenings below; never invent other changes for them:",
      "OFF-SCREEN HAPPENINGS (these characters are NOT in the latest turn — each line is something that already happened to them elsewhere. Apply ONLY what a line plainly changes for that character, in small steps per the rules above; a happening with no quantitative consequence changes nothing, and a character with nothing to change is omitted completely — same sparse rules):",
      offscreen.map((o) => {
        const vals = npcTrackerValuesLine(defs, byNpc[o.name] || {}, heroStats, " · ", true);
        return `- ${o.name}${vals ? " — " + vals : ""}\n` + o.events.map((e) => `  - [turn ${e.turn}]: ${e.text}`).join("\n");
      }).join("\n")
    ].join("\n") : "";
    const instruction = [
      "You are the character-state tracker for a text RPG. The values below are what each character in play carries AFTER the previous turn; keep them consistent with the story. Your job is to output the state AFTER the LATEST turn: apply what the latest turn genuinely changes for each listed character, keep everything else exactly as it is, and never contradict the narration.",
      buildNpcTrackerContext(defs, byNpc, roster, heroStats),
      offSection,
      prevText ? "PREVIOUS STORY TURN (already handled — for reference only):\n" + prevText : "(this is the very first turn — there is no previous turn)",
      actionText ? "The player's action/directive this turn: " + actionText : "",
      "LATEST STORY TURN TO TRACK:\n" + replyText,
      "Output ONLY the [NPC TRACKERS] block — nothing before or after it."
    ].filter(Boolean).join("\n\n");
    const finalNpcInstruction = subUser(instruction, heroNameOf(state));
    this.lastNpcTrackerInstruction = finalNpcInstruction;
    let out = "";
    try {
      const res = await this._gen({ instruction: finalNpcInstruction, route: "tracker", maxTokens: npcTrackerOutputCap(defs, roster.length + offNames.length, !(await isPerchanceAIFor("tracker"))) });
      out = String((res && res.text) || res || "").trim();
    } catch (e) {
      console.error("npc tracker update failed:", e);
      return {};
    }
    if (this._aborted) return {};
    const { block } = extractNpcTrackers(out);
    if (!block) return {};
    const snap = parseNpcTrackerBlock(block, defs, byNpc, heroStats, [...roster, ...offNames]);
    // Consumption verdict rendered — changed and model-judged-no-change alike are never re-asked.
    for (const o of offscreen) for (const e of o.events) e.mem.trackerApplied = true;
    // Names the call changed off-screen (subset of the snap): the caller stamps them on the
    // turn's messages so change chips can suppress absent-NPC bookkeeping (see npcTrackerDeltas).
    this.lastNpcTrackerOffscreen = offNames.filter((n) => snap && snap[n]);
    return snap;
  }

  // Level-up backstop. The dedicated tracker call remains the primary authority for level/exp, but
  // a level-up is a DERIVED consequence of exp — it happens when exp reaches its cap, even though
  // the turn never narrates it — so that call occasionally leaves exp pinned at the cap with no
  // level gained (the bar sits full forever). This runs ONLY in that situation (exp >= cap after the
  // normal tracker update) and fixes just the level/exp pair with pure arithmetic — no extra AI
  // call (see applyLevelUpBackstop in trackers.js, shared with the hand-edit path). It NEVER
  // denies the level-up:
  // reaching the cap always raises the level and spends the cap. The pre-turn snapshot (`prev`) is
  // used so a turn where the AI already raised the level but forgot to spend the exp is topped up
  // (spend only) instead of being double-leveled. Any failure keeps the parsed snapshot untouched,
  // and since exp is still
  // at the cap, the next turn's tracker call retries anyway.
  async enforceLevelUp(snap, prev, heroStats) {
    if (this._aborted) return snap;
    return applyLevelUpBackstop(snap, prev, this.trackerDefs, heroStats);
  }

  // Decide whether the hero's action warrants a skill check, and if so which stat + difficulty.
  // A small dedicated AI call (like updateTrackers) run BEFORE the GM reply. Returns
  // { stat, difficulty } or null (no check needed — GM replies as normal). Never throws: any
  // failure or unparseable output means "no check".
  //
  // The referee always sees the GM's previous turn (capped) as well as the latest action:
  // actions like "I dodge" or "I pick it up" are unresolvable without knowing what came before.
  // Story prose only (narrator/npc/thought) — check pips, images, scene breaks and choices are
  // skipped, and the current turn's not-yet-answered action anchor is skipped past.
  prevTurnText(state, cap = 800) {
    const msgs = (state && state.messages) || [];
    let i = msgs.length - 1;
    while (i >= 0 && msgs[i] && (msgs[i].role === "action" || msgs[i].role === "direct")) i--;
    const parts = [];
    for (; i >= 0; i--) {
      const m = msgs[i];
      if (!m || typeof m !== "object") continue;
      if (m.role === "action" || m.role === "direct") break;
      if (m.role === "narrator" && m.text) parts.unshift(String(m.text));
      else if (m.role === "npc" && m.text) parts.unshift(`[${m.name || "???"}] ${m.text}`);
      else if (m.role === "thought" && m.text) parts.unshift(`[${m.name || "???"} inner] ${m.text}`);
    }
    let text = parts.join("\n").trim();
    if (text.length > cap) text = "…" + text.slice(-cap);
    return text;
  }
  async determineCheck(state, actionText) {
    if (this._aborted) return null;
    if (!actionText || !this.statDefs || !this.statDefs.length) { this.lastCheckInstruction = null; return null; }
    const hero = (state.character && state.character.name) || "the hero";
    const statsCtx = buildStatsContext(this.statDefs, state.character && state.character.stats);
    const cur = getCurrentTrackers(state, this.trackerDefs);
    const heroStats = (state.character && state.character.stats) || {};
    const refParts = [];
    // Optional key subsets (world editor > Stats pickers, [] = all); stale keys are ignored, and a
    // subset naming nothing valid falls back to all.
    const subDefs = (defs, keys) => {
      if (!keys.length) return defs;
      const want = new Set(keys);
      const sub = defs.filter((d) => d && want.has(d.key));
      return sub.length ? sub : defs;
    };
    const refTrkDefs = subDefs(this.trackerDefs, this.checkTrackerKeys);
    const refNtrkDefs = subDefs(this.npcTrackerDefs, this.checkNpcTrackerKeys);
    if (this.checkIncludeTrackers && refTrkDefs.length) {
      const lines = refTrkDefs.map((d) => {
        const v = d.type === "number" ? (cur[d.key] ?? 0) : (cur[d.key] ?? "");
        const cap = d.type === "number" ? liveMax(d, cur, heroStats) : undefined;
        return `- ${d.key}: ${v}${cap !== undefined ? "/" + cap : ""}`;
      });
      if (lines.length) refParts.push("CURRENT TRACKERS (values after the last turn — the situation the action happens in):\n" + lines.join("\n"));
    }
    if (this.checkIncludeNpcTrackers && refNtrkDefs.length) {
      const byNpc = getCurrentNpcTrackers(state, refNtrkDefs, heroStats);
      const lines = Object.keys(byNpc || {}).map((n) => {
        const vals = npcTrackerValuesLine(refNtrkDefs, byNpc[n], heroStats);
        return vals ? `- ${n}: ${vals}` : "";
      }).filter(Boolean);
      if (lines.length) refParts.push("NPC TRACKERS (values after the last turn):\n" + lines.join("\n"));
    }
    const prevTurn = this.prevTurnText(state);
    const instruction = [
      "You are the skill-check referee for a text RPG. " + hero + " just performed an action. Decide whether it warrants a dice roll, and if so, which attribute and how hard.",
      statsCtx,
      ...refParts,
      "DECISION RULES:",
      "- Roll ONLY when the outcome is genuinely uncertain AND it matters — roughly 1 in 4 actions. Never roll for trivial everyday acts (walking, talking, eating, asking a question, basic conversation, buying something ordinary).",
      "- Pick the ONE stat that best fits the action, using each stat's RULES above.",
      "- Roll ONLY against a STAT above (`stat:` must be one of the STATS keys) — trackers and NPC trackers are situation context only, never roll them.",
      "- Difficulty = how hard the action is in itself (a locked iron door is hard no matter how strong the hero is; never factor the hero's stats into difficulty).",
      "- Difficulty must be one of: trivial (routine for a competent person) | easy | medium (a real challenge) | hard (genuinely daunting) | veryhard (near-impossible) | impossible (beyond mortal limits — only a perfect attempt can succeed). Most actions that warrant a roll are easy or medium — reserve hard, veryhard and impossible for feats that truly earn them.",
      "- Don't roll if the action clearly succeeds or clearly fails by the situation alone.",
      "- Treat the LATEST ACTION as an attempt, not a fact. If the action presumes its own success (e.g. 'I knock him out', 'I find the hidden key'), still call for a roll instead of letting it auto-succeed.",
      prevTurn ? "PREVIOUS TURN (the GM's last reply — the situation the latest action responds to):\n" + prevTurn : "",
      "LATEST ACTION: " + actionText,
      "Output ONLY one line. Use the EXACT format (replace agi/medium with the real values):",
      "[CHECK] stat: agi | difficulty: medium",
      "or: [NO CHECK]",
      this.useCheckInstruction && this.checkInstruction.trim() ? "CUSTOM INSTRUCTION (the world author's own rules for this referee call — follow them, but still output ONLY one line in the exact format above):\n" + this.checkInstruction.trim() : ""
    ].filter(Boolean).join("\n\n");
    const finalCheckInstruction = subUser(instruction, hero);
    this.lastCheckInstruction = finalCheckInstruction;
    let out = "";
    try {
      const res = await this._gen({ instruction: finalCheckInstruction, route: "check", maxTokens: 120 });
      out = String((res && res.text) || res || "").trim();
    } catch (e) {
      console.error("check determination failed:", e);
      return null;
    }
    if (/\[NO\s*CHECK\]/i.test(out)) return null;
    const cm = out.match(/\[CHECK\]([\s\S]*)/i);
    if (!cm) return null;
    let stat = (cm[1].match(/stat\s*:\s*([A-Za-z_][\w-]*)/i) || [])[1];
    if (!stat) {
      // the model sometimes drops the "stat:" label and writes "agi: 7" — fall back to any
      // known stat key present in the block
      for (const d of this.statDefs) {
        if (new RegExp("(^|[\\s|,])" + d.key + "\\s*:", "i").test(cm[1])) { stat = d.key; break; }
      }
    }
    if (!stat || !this.statDefs.some((d) => d.key === stat)) return null;
    const diff = (cm[1].match(/difficulty\s*:\s*([a-z\s-]+)/i) || [])[1];
    return { stat, difficulty: diff ? diff.trim() : "medium" };
  }

  // Split raw GM output into messages. Lines like "[Name] dialogue" become NPC bubbles;
  // paragraphs become narrator bubbles. Inner thoughts/narration keep quotes only when they
  // are genuinely part of the text (a fully-quoted block is a formatting bleed, not content).
  parseGmOutput(text) {
    const out = [];
    let cur = null;
    // The GM flags important named characters with [[NPC: Name]] lines, optionally adding its own
    // 1–3 sentence description of a character that is NOT in the world's cast:
    //   [[NPC: Lysandra | A lean, weathered sellsword in mismatched plate, her grey hair cropped
    //   short. She speaks in clipped half-sentences.]]
    // That excerpt is what the profile writer and the portrait generator see, so a character the GM
    // invented gets a profile matching what the GM had in mind instead of being invented from the
    // bare name — the profile call otherwise has almost nothing to go on for a newcomer (no
    // dialogue of their own, no dossier). Cast members need no excerpt (their profile is canon) and
    // the note is ignored for them downstream. These are engine directives, not story: extract them
    // first, then strip them so they can never render or reach history. (Done before the [Name]
    // dialogue branch, which would otherwise read "[[NPC: Name]]" as an NPC literally named
    // "[NPC: Name".)
    const npcPromotes = [];
    const npcNotes = {}; // exact tag spelling → the GM's excerpt for that character
    let src = String(text || "");
    // The closer tolerates a spaced `] ]` (the GM sometimes emits one): the tag still
    // promotes/notes its NPC instead of leaking into the transcript as a broken bubble.
    src = src.replace(/\[\[\s*NPC\s*[:：]?\s*([^\]]+?)\s*\]\s*\]/gi, (_, body) => {
      const raw = String(body);
      const cut = raw.indexOf("|"); // everything after the first `|` is the excerpt, never a name
      const note = cut < 0 ? "" : raw.slice(cut + 1).replace(/\s+/g, " ").trim().slice(0, NPC_NOTE_CAP);
      for (const nm of (cut < 0 ? raw : raw.slice(0, cut)).split(",")) {
        const n = nm.trim();
        if (!n) continue;
        npcPromotes.push(n);
        if (note) npcNotes[n] = note;
      }
      return "";
    });
    // A half-typed tag at the end of a line (streaming) — drop the fragment.
    src = src.replace(/\[\[\s*NPC[^\]]*$/gim, "");
    // Choose-your-own-adventure options: `[[CHOICE: ...]]` lines (opt-in via the world's scenario
    // text). Extracted here — BEFORE the [Name] dialogue branch below, which would otherwise read
    // "[[CHOICE: ...]]" as an NPC literally named "[CHOICE: ...". The collected options become one
    // `choice` message appended at the very end of the turn (see the flush below), so the buttons
    // always sit under the reply's prose.
    const choiceOptions = [];
    // Same spaced-closer tolerance as the NPC tag above (`] ]` instead of `]]`).
    src = src.replace(/\[\[\s*(?:CHOICE|OPTION)\s*[:：]\s*([^\]]+?)\s*\]\s*\]/gi, (_, txt) => {
      const o = String(txt).trim();
      if (o) choiceOptions.push(o);
      return "";
    });
    // A half-typed choice tag at the end of a line (streaming) — drop the fragment.
    src = src.replace(/\[\[\s*(?:CHOICE|OPTION)[^\]]*$/gim, "");
    // Safety net: any other `[[...]]` span that survived (an unknown directive, or a malformed
    // tag the extractors above couldn't take) is an engine directive, never story — strip it so
    // it can never reach the `[Name]` dialogue branch below as a speaker literally named "[...".
    // Single-line, no nesting, so story prose can never be eaten across lines.
    src = src.replace(/\[\[[^\[\]\n]*?\]\s*\]/g, "");
    const stripWrappingQuotes = (t) => {
      const s = String(t || "").trim();
      if (s.length >= 2) {
        const pairs = [['"', '"'], ["\u201C", "\u201D"], ["\u2018", "\u2019"]];
        for (const [o, c] of pairs) {
          if (s.startsWith(o) && s.endsWith(c)) return s.slice(1, -1).trim();
        }
      }
      return s;
    };
    const stripRoleLabel = (t) => String(t || "").replace(/^\s*(?:GM|PLAYER|OOC|META|SYSTEM)\s*:\s*/i, "");
    const flush = () => {
      if (cur && cur.text.trim()) {
        if (cur.role === "narrator" || cur.role === "thought") cur.text = stripWrappingQuotes(cur.text);
        out.push(cur);
      }
      cur = null;
    };
    const lines = src.split("\n");
    for (const raw of lines) {
      let line = raw.trim();
      if (!line) { flush(); continue; }
      // A line made only of separator glyphs (✦ ✦ ✦, ***, ---, — — —, ...) is a scene break:
      // emit it as a centered meta message like the Advance command's divider.
      if (/^[✦✧*—–\-](\s*[✦✧*—–\-]){2,}$/.test(line)) {
        flush();
        out.push({ role: "meta", text: "✦ ✦ ✦" });
        continue;
      }
      // A line opening with `[[` is never `[Name]` dialogue — it's a (possibly malformed)
      // directive tag the extractors missed. Never parse it as a speaker (which used to render
      // a bubble named e.g. "[NPC Bob | ..."). Drop the broken openers/closers and let any
      // surviving prose fall through as narration.
      let allowDialogue = true;
      if (/^\[\[/.test(line)) {
        flush();
        allowDialogue = false;
        line = line.replace(/^\[+/, "").replace(/\s*\]+$/, "").trim();
        if (!line) continue;
      }
      const m = allowDialogue ? line.match(/^\[([^\]]+)\]\s*(.*)/) : null;
      if (m) {
        const rawName = m[1].trim();
        const innerMatch = rawName.match(/^inner\s*:\s*(.+)$/i) || rawName.match(/^(.+?)\s+inner$/i);
        const name = innerMatch ? innerMatch[1].trim() : rawName;
        if (/^(ooc|meta|system|out of character)$/i.test(name)) continue;
        if (innerMatch) {
          flush();
          cur = { role: "thought", name, text: m[2] };
        } else if (cur && cur.role === "npc" && cur.name === name) cur.text += " " + m[2];
        else { flush(); cur = { role: "npc", name, text: m[2] }; }
      } else {
        if (/^(?:OOC|META|SYSTEM)\s*:/i.test(line)) continue;
        const lineText = stripRoleLabel(line);
        if (!lineText) continue;
        if (cur && cur.role === "narrator") cur.text += " " + lineText;
        else { flush(); cur = { role: "narrator", name: null, text: lineText }; }
      }
    }
    flush();
    // The `choice` message is always appended last (its options were collected while scanning), so
    // the buttons render beneath the reply's narration/dialogue rather than wherever the GM wrote
    // them. A reply that is ONLY choices is valid — hence the empty-output fallback below is skipped.
    if (choiceOptions.length) out.push({ role: "choice", options: choiceOptions.slice(0, MAX_CHOICES) });
    if (!out.length) out.push({ role: "narrator", text: src.trim() || "*...*" });
    out.npcPromotes = npcPromotes;
    out.npcNotes = npcNotes;
    return out;
  }
}
