// Tracked state & resources — the dev defines what the AI tracks (in the loaded world's trackers),
// the AI updates those values at the end of every GM turn via a machine-readable [TRACKERS]
// block, and the live state is DERIVED from the messages themselves. Each GM message carries
// `afterTrackers` — the full tracker snapshot after its turn — so deleting / re-rolling /
// editing / navigating re-roll versions automatically reverts or restores the correct values.

// ---------------------------------------------------------------------------------------------
// Formula parser (shared). A formula is a small single-line expression over a scope of named
// numbers. Trackers use it for `max`/`start` (`= expr` means "computed, not literal"); the world's
// skill-check modifier uses it too (scope {v, avg, exc, step}). Grammar, lowest→highest precedence:
//   ternary    `cond ? a : b`  (right-associative)
//   logic      `||`, `&&`, unary `!`
//   comparison `<  <=  >  >=  ==  !=`
//   additive   `+ -`  ·  multiplicative `* / %`  ·  unary `+ -`
//   primary    numbers, named values, `(...)`, and a whitelist of Math fns (bare or `Math.`)
// No eval — a recursive-descent parser that fails loudly on anything else.
// ---------------------------------------------------------------------------------------------
import { resolveNpcName } from "./lorebook.js";

const FORMULA_FNS = new Set(["abs", "floor", "ceil", "round", "trunc", "sign", "min", "max", "pow", "sqrt"]);

export function evalFormula(src, stats) {
  const s = String(src || "").replace(/\s+/g, "");
  if (!s) throw new Error("empty formula");
  const stat = stats || {};
  let i = 0;
  const fail = () => { throw new Error("bad formula: " + src); };
  const peek = (k = 0) => s[i + k];
  const num = () => {
    let j = i;
    while (j < s.length && /[0-9.]/.test(s[j])) j++;
    if (j === i) fail();
    const v = Number(s.slice(i, j));
    if (Number.isNaN(v)) fail();
    i = j;
    return v;
  };
  const ident = () => {
    let j = i;
    while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
    if (j === i) fail();
    const n = s.slice(i, j);
    i = j;
    return n;
  };
  // ternary — lowest precedence, right-associative: `a ? b : c`
  const cond = () => {
    const c = or();
    if (peek() !== "?") return c;
    i++;
    const a = cond();
    if (peek() !== ":") fail();
    i++;
    const b = cond();
    return c ? a : b;
  };
  const or = () => {
    let v = and();
    while (peek() === "|" && peek(1) === "|") { i += 2; const r = and(); v = !!(v || r); }
    return v;
  };
  const and = () => {
    let v = eq();
    while (peek() === "&" && peek(1) === "&") { i += 2; const r = eq(); v = !!(v && r); }
    return v;
  };
  const eq = () => {
    let v = cmp();
    for (;;) {
      if (peek() === "=" && peek(1) === "=") { i += 2; v = v == cmp(); } // eslint-disable-line eqeqeq
      else if (peek() === "!" && peek(1) === "=") { i += 2; v = v != cmp(); } // eslint-disable-line eqeqeq
      else break;
    }
    return v;
  };
  const cmp = () => {
    let v = expr();
    for (;;) {
      if (peek() === "<" && peek(1) === "=") { i += 2; v = v <= expr(); }
      else if (peek() === ">" && peek(1) === "=") { i += 2; v = v >= expr(); }
      else if (peek() === "<") { i++; v = v < expr(); }
      else if (peek() === ">") { i++; v = v > expr(); }
      else break;
    }
    return v;
  };
  const expr = () => {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = peek(); i++;
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  };
  const term = () => {
    let v = unary();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = peek(); i++;
      const r = unary();
      v = op === "*" ? v * r : op === "/" ? v / r : v % r;
    }
    return v;
  };
  const unary = () => {
    if (peek() === "-") { i++; return -unary(); }
    if (peek() === "+") { i++; return unary(); }
    if (peek() === "!") { i++; return !unary(); }
    if (peek() === "(") {
      i++;
      const v = cond();
      if (peek() !== ")") fail();
      i++;
      return v;
    }
    if (peek() !== undefined && /[0-9]/.test(peek())) return num();
    if (peek() !== undefined && /[A-Za-z_]/.test(peek())) {
      let n = ident();
      let fnName = null;
      // dotted form: Math.floor(...)
      if (peek() === ".") {
        i++;
        const m = ident();
        if (n === "Math" && FORMULA_FNS.has(m)) { fnName = m; n = n + "." + m; }
        else fail();
      }
      if (peek() === "(") {
        if (!fnName) {
          if (!FORMULA_FNS.has(n)) fail(); // bare function form: floor(...)
          fnName = n;
        }
        i++;
        const args = [];
        if (peek() !== ")") { args.push(cond()); while (peek() === ",") { i++; args.push(cond()); } }
        if (peek() !== ")") fail();
        i++;
        return Math[fnName].apply(null, args);
      }
      if (fnName || !(n in stat)) fail();
      const v = stat[n];
      if (typeof v !== "number" || Number.isNaN(v)) fail();
      return v;
    }
    fail();
  };
  const out = cond();
  if (i !== s.length) fail();
  return out;
}

// The scope a formula is evaluated against: the hero's stats plus the current numeric values of
// the trackers themselves, so a formula may reference another tracker by key (e.g. an exp cap of
// `= level*20 + 80`). Tracker values win over same-named stats.
export function formulaScope(stats, trackers) {
  const scope = { ...(stats || {}) };
  const cur = trackers || {};
  for (const k in cur) {
    const v = cur[k];
    if (typeof v === "number" && Number.isFinite(v)) scope[k] = v;
  }
  return scope;
}

// A tracker's effective max: the derived formula if configured (rounds, never negative; a
// bad formula falls back to the literal max with a console warning so config typos surface).
// `scope` is a formula scope (see formulaScope) — hero stats, optionally + tracker values.
export function effectiveMax(d, scope) {
  if (d && d.maxFormula) {
    try {
      const v = evalFormula(d.maxFormula, scope || {});
      if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.round(v));
    } catch (e) {
      console.warn(`[trackers] bad max formula for "${d.key}":`, d.maxFormula, "-", e.message);
    }
  }
  return d ? d.max : undefined;
}

// A tracker's effective start — same rule as effectiveMax for the starting value.
export function effectiveStart(d, scope) {
  if (d && d.startFormula) {
    try {
      const v = evalFormula(d.startFormula, scope || {});
      if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
    } catch (e) {
      console.warn(`[trackers] bad start formula for "${d.key}":`, d.startFormula, "-", e.message);
    }
  }
  return d ? d.start : undefined;
}

// The max the UI + AI should currently use for a tracker: a derived max (formula) always
// wins over anything stored; otherwise the live `key.max` (which the AI may have changed
// mid-game, e.g. an exp cap) wins over the config's static max. A formula is evaluated against
// the hero's stats PLUS the live tracker values, so it can reference another tracker.
export function liveMax(d, current, stats) {
  if (d && d.maxFormula) return effectiveMax(d, formulaScope(stats, current));
  const cur = current || {};
  return cur[d.key + ".max"] !== undefined ? cur[d.key + ".max"] : (d ? d.max : undefined);
}

// Parse the dev's trackers.md into a list of tracker definitions.
// Format: [key] header, then `field = value` lines (label/hint/icon/color/row/type/max/start/show/rules).
// Lines that aren't a header, a comment, or a known field append to `rules` (multi-line rules).
export function parseTrackerConfig(text) {
  const defs = [];
  let cur = null;
  let inFence = false;
  const flush = () => { if (cur) defs.push(cur); cur = null; };
  const FIELDS = new Set(["label", "hint", "icon", "color", "type", "max", "start", "show"]);
  for (const raw of String(text || "").split("\n")) {
    const line = raw.trim();
    if (/^\s*```/.test(line)) { inFence = !inFence; continue; } // skip markdown fenced code blocks
    if (inFence) continue;
    if (!line || line.startsWith("#")) continue;
    const sec = line.match(/^\[([A-Za-z_][\w-]*)\]\s*$/);
    if (sec) { flush(); cur = { key: sec[1], label: "", hint: "", icon: "", color: "", type: "text", rules: "", show: "both" }; continue; }
    if (!cur) continue;
    const kv = line.match(/^([a-z][\w-]*)\s*=\s*(.*)$/i);
    if (kv && FIELDS.has(kv[1].toLowerCase())) {
      const k = kv[1].toLowerCase();
      const v = kv[2].trim();
      if (k === "label") cur.label = v;
      else if (k === "hint") cur.hint = v;
      else if (k === "icon") cur.icon = v;
      else if (k === "color") cur.color = v;
      else if (k === "type") cur.type = v === "number" ? "number" : "text";
      else if (k === "max") {
        if (/^\s*=/.test(v)) { cur.maxFormula = v.replace(/^\s*=\s*/, "").trim(); cur.max = undefined; }
        else cur.max = Number(v) || undefined;
      }
      else if (k === "start") {
        if (/^\s*=/.test(v)) { cur.startFormula = v.replace(/^\s*=\s*/, "").trim(); cur.start = undefined; }
        else cur.start = v;
      }
      else if (k === "show") cur.show = ["header", "hero", "both", "hidden"].includes(v) ? v : "both";
    } else {
      cur.rules = cur.rules ? cur.rules + " " + line : line;
    }
  }
  flush();
  return defs;
}

// Trackers render as one continuous bar.
export function groupByRow(defs) {
  return [{ row: "", defs: defs || [] }];
}

// Resolve the tracker whose KEY or LABEL matches `re`. `type` restricts the search (default
// "number"); pass "text" for text-valued trackers like location. The defs list is built once per
// loaded world and never mutated afterwards (world.js fills the array before it's handed out), so
// resolution is memoized keyed on the array reference: the scan runs once on the first call after
// each world loads — not on every turn — and a freshly loaded world's new array resolves again
// automatically. A regex with no `g` flag, so `.test` is stateless.
function matchTracker(defs, re, cache, type = "number") {
  if (!Array.isArray(defs)) return null;
  if (cache.has(defs)) return cache.get(defs);
  let found = null;
  for (const d of defs) {
    if (!d || (type && d.type !== type)) continue;
    if (re.test(String(d.key || "").trim()) || re.test(String(d.label || "").trim())) { found = d; break; }
  }
  cache.set(defs, found);
  return found;
}

// The hero's LIFE tracker — the one whose value reaching 0 means the hero has died. Matched by
// key OR label so worlds can call it hp / health / life / vitality / hit points / etc. Returns the
// tracker def (or null when the world defines no such tracker, in which case death is never
// detected and the game simply plays on).
const LIFE_TRACKER_RE = /^(hp|h\.p\.|health|life|lives|vitality|vigor|vigour|hit\s*points?|health\s*points?|well-?being)$/i;
const lifeTrackerCache = new WeakMap();
export function lifeTracker(defs) {
  return matchTracker(defs, LIFE_TRACKER_RE, lifeTrackerCache);
}

// The hero's LEVEL tracker — drives the level-up bar and the stat-point grants (see
// grantLevelUpPoints in main.js). Matched by key OR label so a world can call it lvl / rank /
// tier / character level / etc., not just the exact key `level`.
const LEVEL_TRACKER_RE = /^(lvl|lv|lev|level|char(?:acter)?[\s_-]*level|hero[\s_-]*level|player[\s_-]*level|class[\s_-]*level|rank|tier)$/i;
const levelTrackerCache = new WeakMap();
export function levelTracker(defs) {
  return matchTracker(defs, LEVEL_TRACKER_RE, levelTrackerCache);
}

// The hero's EXPERIENCE tracker — the bar that fills toward the next level. Matched by key OR
// label so a world can call it exp / xp / experience / experience points / etc., not just `exp`.
const EXP_TRACKER_RE = /^(exp|xp|exper(?:ience)?|experience[\s_-]*points?|exp[\s_-]*points?|xp[\s_-]*points?|level[\s_-]*(?:progress|exp|xp)|progress[\s_-]*to[\s_-]*next[\s_-]*level|to[\s_-]*next[\s_-]*level)$/i;
const expTrackerCache = new WeakMap();
export function expTracker(defs) {
  return matchTracker(defs, EXP_TRACKER_RE, expTrackerCache);
}

// The cap an experience tracker falls back to when its world defines `max` neither as a literal
// nor as a formula. Forgetting to set it used to render the hero panel's bar as "0/undefined",
// so a blank exp max now means "capped at 100". Applied at world load (normalizeTracker in
// world.js), which makes every downstream read — the hero panel, the tracker bar, the AI's
// tracked-state context and the level-up directive/backstop — agree on the same cap.
export const EXP_DEFAULT_MAX = 100;

// True when a single def names the hero's experience tracker — the same key-or-label match
// `expTracker` performs, exposed for callers that hold one def rather than the whole list.
export function isExpTrackerDef(d) {
  return !!d && (EXP_TRACKER_RE.test(String(d.key || "").trim()) || EXP_TRACKER_RE.test(String(d.label || "").trim()));
}

// The hero's LOCATION tracker — the current place, and the value the map system keys off (the
// mapmaker is fed this text and the minichart rebuilds when it changes). Matched by key OR label,
// like the others, so a world can call it loc / place / area / region / whereabouts / setting /
// site / etc., not just the exact key `location`. Text trackers only.
const LOCATION_TRACKER_RE = /^(location|loc|place|area|region|whereabouts|setting|locale|locality|position|spot|site|zone|district|where|current[\s_-]*location|hero[\s_-]*location|player[\s_-]*location|current[\s_-]*place|hero[\s_-]*place)$/i;
const locationTrackerCache = new WeakMap();
export function locationTracker(defs) {
  return matchTracker(defs, LOCATION_TRACKER_RE, locationTrackerCache, "text");
}

// The hero's QUEST tracker — the single current quest/objective, and the value the
// completed/failed pips key off (see questDirective / parseTrackerBlock). Matched by key OR
// label, like the others, so a world can call it objective / mission / contract / task /
// bounty / errand / etc., not just the exact key `quest`. Text trackers only.
const QUEST_TRACKER_RE = /^((current|active|main|side|primary|secondary|hero|player)[\s_-]*)?(quest(s)?|objective(s)?|mission(s)?|contract(s)?|tasks?|bount(y|ies)|errand(s)?)$/i;
const questTrackerCache = new WeakMap();
export function questTracker(defs) {
  return matchTracker(defs, QUEST_TRACKER_RE, questTrackerCache, "text");
}

// Every quest-tracker def in the set (normally one). The prompt directive and the parser act on
// all of them so a world with e.g. both `quest` and `side_quest` tags each correctly.
export function questTrackers(defs) {
  if (!Array.isArray(defs)) return [];
  return defs.filter((d) => d && d.type === "text" &&
    (QUEST_TRACKER_RE.test(String(d.key || "").trim()) || QUEST_TRACKER_RE.test(String(d.label || "").trim())));
}

// True when a single def names a quest tracker — the same key-or-label match `questTracker`
// performs, exposed for callers that hold one def rather than the whole list.
export function isQuestTrackerDef(d) {
  return !!d && (QUEST_TRACKER_RE.test(String(d.key || "").trim()) || QUEST_TRACKER_RE.test(String(d.label || "").trim()));
}

// The DAY tracker — the calendar (a count like `day 4`, a date like `1 Jan 2027`,
// or both when the world defines two). Matched by key OR label like the others,
// so a world can call it date / day count / current day / etc. Day counts are
// usually numbers and dates are text, so unlike location/quest there is no type
// restriction — whichever the world uses reads.
const DAY_TRACKER_RE = /^(day|date|days|day[\s_-]*num(ber)?|day[\s_-]*count|current[\s_-]*day|current[\s_-]*date)$/i;
const dayTrackerCache = new WeakMap();
export function dayTracker(defs) {
  return matchTracker(defs, DAY_TRACKER_RE, dayTrackerCache, null);
}

// The TIME tracker — the clock (and, failing that, the weekday). Two-tier so a
// world with both a clock (`time`) and a weekday (`dayname`) feeds the clock
// into time slots: clock-like keys win, weekday-like keys are the fallback.
// Matched by key OR label; no type restriction (an hour count may be a number).
const TIME_CLOCK_RE = /^(time|clock|hours?|time[\s_-]*of[\s_-]*day|current[\s_-]*time)$/i;
const TIME_WEEKDAY_RE = /^(dayname|day[\s_-]*name|weekday|day[\s_-]*of[\s_-]*week)$/i;
const timeClockCache = new WeakMap();
const timeWeekdayCache = new WeakMap();
export function timeTracker(defs) {
  if (!Array.isArray(defs)) return null;
  return matchTracker(defs, TIME_CLOCK_RE, timeClockCache, null) ||
    matchTracker(defs, TIME_WEEKDAY_RE, timeWeekdayCache, null);
}

// The trailing outcome tag a quest value may carry in the [TRACKERS] block (`quest: <new
// value> [!completed]`). The tag describes the PREVIOUS quest's fate; the value is the new
// quest (or empty). `!` is optional so `[completed]` also parses; `complete`/`fail` shortenings map
// to their canonical outcome. A leading tag (`quest: [!completed] <new value>`) is accepted too —
// the model sometimes emits the tag before the new quest — with identical meaning.
const QUEST_OUTCOME_RE = /\s*\[\s*!?\s*(completed|complete|failed|fail)\s*\]\s*$/i;
const QUEST_OUTCOME_LEADING_RE = /^\s*\[\s*!?\s*(completed|complete|failed|fail)\s*\]\s*/i;

// Current location value from a tracker snapshot, resolved through the location matcher (so the
// engine reads whatever key the world used). Returns "" when the world has no location tracker.
export function locationValue(defs, current) {
  const d = locationTracker(defs);
  return d ? String((current || {})[d.key] || "").trim() : "";
}

// Current day / time values from a tracker snapshot, resolved through the day/time matchers.
// `??` (not `||`) so a day-0 count still reads.
export function dayValue(defs, current) {
  const d = dayTracker(defs);
  const v = d ? (current || {})[d.key] : undefined;
  return v === undefined || v === null ? "" : String(v).trim();
}
export function timeValue(defs, current) {
  const d = timeTracker(defs);
  const v = d ? (current || {})[d.key] : undefined;
  return v === undefined || v === null ? "" : String(v).trim();
}

// Has the hero died? True when a life tracker exists and its current value has hit 0. Callers
// compare the snapshot before a turn to this one, so the death scene fires once on the
// alive → dead transition (and a re-roll that keeps the hero alive removes it again).
export function isDead(defs, current) {
  const d = lifeTracker(defs);
  if (!d) return false;
  const v = (current || {})[d.key];
  return typeof v === "number" && v <= 0;
}

// Default values a new session begins with (from each tracker's `start` — which may be a derived
// formula — else 0 / ""). Number trackers with a `max` (literal or derived) also get a
// `key.max` pseudo-entry (current max, may change during play) so the fallback snapshot the
// UI/context reads from always knows the cap. `stats` = the hero's stats; pass the hero's FINAL
// stats after character creation. Because a formula may reference ANOTHER tracker (e.g. an exp cap
// of `= level*20 + 80`), defs are resolved in dependency order with retry passes — a formula that
// needs a not-yet-computed tracker is retried once that tracker lands. A cycle / missing
// reference falls back to the literal (with a console warning) so a session can still start.
export function initialTrackers(defs, stats) {
  const list = defs || [];
  const out = {};
  const base = stats || {};
  const remaining = list.slice();
  let guard = list.length + 1;
  while (remaining.length && guard-- > 0) {
    let progressed = false;
    for (let i = 0; i < remaining.length; ) {
      const d = remaining[i];
      if (d.type !== "number") {
        out[d.key] = d.start !== undefined ? String(d.start) : "";
        remaining.splice(i, 1);
        progressed = true;
        continue;
      }
      const scope = formulaScope(base, out);
      let st = d.start;
      let m = d.max;
      let ok = true;
      if (d.startFormula !== undefined) { try { st = evalFormula(d.startFormula, scope); } catch (e) { ok = false; } }
      if (ok && d.maxFormula !== undefined) { try { m = evalFormula(d.maxFormula, scope); } catch (e) { ok = false; } }
      if (!ok) { i++; continue; } // a dependency isn't computed yet (or a real typo) — retry next pass
      out[d.key] = st !== undefined && st !== "" ? Number(st) || 0 : 0;
      if (m !== undefined && m !== "") out[d.key + ".max"] = Math.max(0, Math.round(Number(m)));
      remaining.splice(i, 1);
      progressed = true;
    }
    if (!progressed) break;
  }
  for (const d of remaining) {
    if (d.type !== "number") { out[d.key] = d.start !== undefined ? String(d.start) : ""; continue; }
    const st = d.start;
    out[d.key] = st !== undefined && st !== "" ? Number(st) || 0 : 0;
    if (d.max !== undefined && d.max !== "") out[d.key + ".max"] = Math.max(0, Math.round(Number(d.max)));
    if (d.maxFormula !== undefined || d.startFormula !== undefined) console.warn(`[trackers] could not resolve formula for "${d.key}" (missing/cyclic reference) — used literal`);
  }
  return out;
}

// The live tracker state, derived from the messages: the `afterTrackers` snapshot of the last
// GM message (or `state.initialTrackers` before any GM reply exists). This is what makes
// deletes / re-rolls / version nav revert to the correct values with no bookkeeping.
export function getCurrentTrackers(state, defs) {
  const msgs = (state && state.messages) || [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m && m.afterTrackers && typeof m.afterTrackers === "object") return m.afterTrackers;
  }
  return (state && state.initialTrackers) || initialTrackers(defs || []);
}

// Per-tracker value + rule lines for the DEDICATED tracker-update call
// (`- key (type, max): value — rules`). Key-only: the model must output keys, so labels/icons
// are omitted here (the narrative context keeps its label lines for prose). Number trackers carry a max (static
// from config, stat-derived from a formula, or dynamic — the AI may raise/lower it by writing
// `key: value/max`, e.g. `exp: 40/200`); the current max lives in the live snapshot as
// `key.max`, falling back to the config's static max. A stat-derived max always wins and is
// flagged so the AI never tries to change it.
function trackerLines(defs, current, stats) {
  const cur = current || {};
  const val = (d) => (d.type === "number" ? (cur[d.key] ?? 0) : (cur[d.key] ?? ""));
  const curMax = (d) => liveMax(d, cur, stats);
  return defs.map((d) => {
    const typeTxt = d.type === "number" ? "number" : "text";
    const maxTxt = curMax(d) !== undefined ? ", max " + curMax(d) : "";
    const fixedTxt = d.maxFormula ? " — max is FIXED" : "";
    return `- ${d.key} (${typeTxt}${maxTxt}${fixedTxt}): ${val(d)} — ${d.rules}`;
  });
}

// Label-only lines for the NARRATIVE context (`- Label (max N): value — rules`).
// No key, icon, or type; label falls back to key when empty. Max shown when present.
function trackerValueLines(defs, current, stats) {
  const cur = current || {};
  const val = (d) => (d.type === "number" ? (cur[d.key] ?? 0) : (cur[d.key] ?? ""));
  const curMax = (d) => liveMax(d, cur, stats);
  return defs.map((d) => {
    const name = (d.label && String(d.label).trim()) || d.key;
    const m = curMax(d);
    const maxTxt = m !== undefined ? ` (max ${m})` : "";
    return `- ${name}${maxTxt}: ${val(d)} — ${d.rules}`;
  });
}

// The TRACKED STATE section for the NARRATIVE context: current values + rules only. The GM reads
// these so the story stays consistent with the UI, but is NOT asked to output the machine block —
// that's the dedicated tracker-update call's job (see RPEngine.updateTrackers in rp-engine.js).
export function buildTrackerValuesContext(defs, current, stats) {
  if (!defs || !defs.length) return "";
  return [
    "TRACKED STATE (current values and rules — keep your narration consistent with them. Do not output the values in your reply; it's handled separately by the engine.):",
    ...trackerValueLines(defs, current, stats),
  ].join("\n");
}

// The computed LEVELING RULE appended to the dedicated tracker call's context. When a world has
// BOTH a level tracker and a *capped* experience tracker — resolved through levelTracker /
// expTracker, so it works whatever the world calls them (level/lvl/xp/rank/experience/…) — the AI
// is told the exact cap-crossing arithmetic. The world's own prose `rules` for these two tends to
// be missed: a level-up is a DERIVED consequence of exp (it happens when exp reaches its cap),
// never something the turn narrates, while the general instruction says to only change what the
// latest turn describes. Returns "" when there is no capped level/exp pair (e.g. milestone-only
// leveling, or exp with no max), leaving behavior exactly as it was. Uses the LIVE max, so a
// derived cap like `= level*100` is handled (the cap shown is the one currently in force).
export function levelingDirective(defs, current, stats) {
  const lvlDef = levelTracker(defs);
  const expDef = expTracker(defs);
  if (!lvlDef || !expDef) return "";
  const cur = current || {};
  const cap = liveMax(expDef, cur, stats);
  if (cap === undefined || !(cap > 0)) return "";
  const lvl = Number(cur[lvlDef.key]) || 0;
  return [
    `LEVELING (apply this before you output): ${lvlDef.key} and ${expDef.key} are linked — ${expDef.key} is capped at ${cap}, and reaching that cap triggers a level-up.`,
    `When this turn's story earns enough ${expDef.key} to reach ${cap} (or it is already there), the hero LEVELS UP: write ${lvlDef.key} as ${lvl + 1} and ${expDef.key} as the remainder left after subtracting ${cap} (exactly ${cap} leaves 0).`,
    `Subtract the cap shown here (${cap}) BEFORE raising ${lvlDef.key}, and never output ${expDef.key} at or above its cap.`,
    `If ${expDef.key} is below ${cap} after this turn, leave ${lvlDef.key} exactly as it was. This is the one exception to "only change what the latest turn describes".`
  ].join(" ");
}

// Deterministic level-up fix-up, shared by the AI tracker path (RPEngine.enforceLevelUp) and the
// hand-edit path (saveGmFull in main.js) so both uphold the same invariant: reaching the exp cap
// always raises the level and spends the cap, however the snapshot was produced. Pure arithmetic,
// no AI call — returns a corrected snapshot, or `snap` untouched when no cap was crossed. `prev`
// is the pre-turn snapshot: a turn that already raised the level but forgot to spend the exp is
// topped up (spend only) instead of being double-leveled. Never denies a level-up the input
// already granted. Resolves through levelTracker/expTracker/liveMax, so it works whatever the
// world keys level/exp and whether the cap is static or derived.
export function applyLevelUpBackstop(snap, prev, defs, stats) {
  const lvlDef = levelTracker(defs);
  const expDef = expTracker(defs);
  if (!lvlDef || !expDef) return snap;
  const cap = liveMax(expDef, snap, stats);
  if (cap === undefined || !(cap > 0)) return snap;
  const exp = Number(snap[expDef.key]) || 0;
  if (exp < cap) return snap; // no cap crossed — the normal case, no fix-up
  const lvl = Number(snap[lvlDef.key]) || 0;
  const prevLvl = prev && typeof prev[lvlDef.key] === "number" ? prev[lvlDef.key] : lvl;
  // Already raised → top up the unspent exp only (never double-level); otherwise raise one
  // level and spend the cap.
  return {
    ...snap,
    [lvlDef.key]: lvl > prevLvl ? lvl : lvl + 1,
    [expDef.key]: Math.max(0, exp - cap)
  };
}

// The computed QUEST OUTCOME rule appended to the dedicated tracker call's context. When the
// world has a quest tracker (resolved through questTrackers, so it works whatever the world
// calls it — quest/objective/mission/…), the AI is told to tag the line when the latest turn
// resolves the previous quest: `quest: <new quest> [!completed]` (or `[!failed]`). The tag
// describes the PREVIOUS value's fate while the value itself already moves on to the next quest
// (or empty), so completion and rotation happen in one turn. Returns "" when there is no quest
// tracker, leaving behavior exactly as it was.
export function questDirective(defs, current) {
  const qs = questTrackers(defs);
  if (!qs.length) return "";
  const cur = current || {};
  const isEmpty = (v) => { const t = String(v ?? "").trim(); return t === "" || t === "—" || t === "-"; };
  if (qs.every((d) => isEmpty(cur[d.key]))) return "";
  const prevTxt = qs.map((d) => `${d.key} (previous: ${String(cur[d.key] ?? "").trim() || "—"})`).join("; ");
  return [
    `QUEST OUTCOME (only for ${qs.map((d) => d.key).join(", ")} — the hero's current quest/objective): the [!completed] / [!failed] tag reports what the latest turn did to the PREVIOUS value (${prevTxt}) — never the new one.`,
    `When the latest turn finishes that previous quest (achieved, delivered, slain, escaped — the narration says so), write the NEW quest text, or empty when no quest follows, with \` [!completed]\` appended. When it fails, is abandoned or botched, do the same with \` [!failed]\`. When a new quest starts in the same turn, the value is the NEW quest and the tag still belongs to the OLD one.`,
    `A turn that merely continues, mentions or recalls the quest gets NO tag. When in doubt, leave the tag off, and never invent a completion the narration doesn't describe.`,
  ].join(" ");
}

// The full tracker-update instruction for the DEDICATED call (run after the narrative reply is
// done): current values + rules + the exact machine format the block must be output in.
export function buildTrackerContext(defs, current, stats) {
  if (!defs || !defs.length) return "";
  const cur = current || {};
  const val = (d) => (d.type === "number" ? (cur[d.key] ?? 0) : (cur[d.key] ?? ""));
  const curMax = (d) => liveMax(d, cur, stats);
  const example = [
    "[TRACKERS]",
    ...defs.map((d) =>
      d.type === "number" && curMax(d) !== undefined ? `${d.key}: ${val(d)}/${curMax(d)}` : `${d.key}: ${val(d)}`
    ),
  ];
  const directive = levelingDirective(defs, cur, stats);
  const quest = questDirective(defs, cur);
  return [
    "TRACKED STATE:",
    ...trackerLines(defs, current, stats),
    "Output the updated state as the complete machine-readable block below, and NOTHING after it:",
    example.join("\n"),
    "Rules: `[TRACKERS]` alone on its own line, then one line per tracker as `key: value` — no bullets, no bold, no quotes, no commentary. Output EVERY tracker every time. Values that didn't change stay as shown above. A change goes in ONLY when the latest turn describes something actually HAPPENING in it — not when it merely refers back to the past. Anything on the ALREADY APPLIED list is reflected in the current values, so a later mention of it is a recall: keep the value unchanged. Anything the latest turn describes that is NOT yet reflected in the current values is a genuine change: apply it. When in doubt, keep the value exactly as it is. A number may be written relative to its current value — `key: +N` adds N, `key: -N` subtracts N. For a tracker WITH a max, write `key: value/max` (e.g. `hp: 15/20`, `exp: 40/200`) and keep the max current even when unchanged — if the max itself changes this turn (level-up raising an exp cap, a curse lowering max HP), just write the new max. A tracker whose max is marked FIXED must keep the shown max. Trackers without a max are plain numbers (no /max, no commas, no units). Empty text values are written as `key:` with nothing after the colon.",
    directive,
    quest
  ].filter(Boolean).join("\n");
}

// Split raw GM output into (text, block). The [TRACKERS] block — if present — is pulled out of
// the reply so it never renders as narration or leaks into history. Returns {text, block}.
export function extractTrackers(rawText) {
  const src = String(rawText || "");
  const lines = src.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*\[TRACKERS\]\s*$/i.test(lines[i])) { start = i; break; }
  }
  if (start < 0) return { text: src, block: null };
  let end = start;
  let seen = false;
  for (let i = start + 1; i < lines.length; i++) {
    const ln = lines[i];
    if (/^\s*[A-Za-z_][\w-]*\s*:/.test(ln)) { end = i; seen = true; }
    else if (!ln.trim()) { if (seen) end = i; else continue; }
    else break;
  }
  while (end > start && !lines[end].trim()) end--;
  const block = lines.slice(start, end + 1).join("\n");
  const text = lines.slice(0, start).concat(lines.slice(end + 1)).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { text, block };
}

// Parse a [TRACKERS] block into a fresh snapshot (current values + whatever the block changed).
// Unknown keys, missing keys, or unparseable values fall back to the current value. A number
// written as `+N` / `-N` is relative (added to / subtracted from the current value); anything else
// is absolute. Numbers are
// clamped to >= 0 (and to the CURRENT max — dynamic `key.max` if present, else the config's static
// `max`, else a derived max, which always wins). A `key: value/max` line (e.g. `exp: 40/200`)
// also updates the max for that tracker — EXCEPT for formula-derived trackers, whose cap is fixed.
// Applied in two passes (values first, then clamping) so a cap formula that references ANOTHER
// tracker — e.g. `max = level*20 + 80` — sees this turn's level, not last turn's.
export function parseTrackerBlock(block, defs, current, stats) {
  const out = { ...(current || {}) };
  if (!block) return out;
  const byKey = {};
  for (const d of defs) byKey[d.key] = d;
  const lines = block.split("\n");
  const nums = [];
  const tagged = new Set();
  for (let i = 1; i < lines.length; i++) {
    const m = lines[i].match(/^\s*([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    const d = byKey[m[1].trim()];
    if (!d) continue;
    let raw = m[2].trim();
    if (d.type === "number") {
      const slash = raw.match(/^\s*([\d.-]+)\s*\/\s*([\d.-]+)\s*$/);
      let newMax;
      if (slash) {
        if (!d.maxFormula) {
          const nm = Number(slash[2]);
          if (!Number.isNaN(nm) && nm > 0) newMax = nm;
        }
        raw = slash[1];
      } else {
        raw = raw.split("/")[0]; // tolerate sloppy "18/20"
      }
      // Relative adjustment (`+N` / `-N`): add to / subtract from the current value instead of
      // replacing it. Still clamped to 0/max afterwards like any other value.
      const rel = raw.match(/^\s*([+-])\s*([\d.]+)\s*$/);
      if (rel) {
        const delta = Number(rel[2]);
        if (Number.isNaN(delta)) continue;
        const base = typeof (current || {})[d.key] === "number" ? (current || {})[d.key] : 0;
        nums.push({ d, n: rel[1] === "+" ? base + delta : base - delta, newMax });
        continue;
      }
      // Strip stray characters (`39 (rising)` → `39`), but a value with NO digits at all is a
      // malformed line, not a zero — leave the tracker alone rather than silently wiping it.
      const cleaned = raw.replace(/[^\d.\-]/g, "");
      if (cleaned === "") continue;
      const n = Number(cleaned);
      if (!Number.isNaN(n)) nums.push({ d, n, newMax });
    } else if (isQuestTrackerDef(d)) {
      // Outcome tag in either position: canonical trailing (`New quest [!completed]`) or
      // leading (`[!completed] New quest`). Trailing wins when both are present.
      let outcomeWord = null;
      const trail = raw.match(QUEST_OUTCOME_RE);
      if (trail) {
        outcomeWord = trail[1];
        raw = raw.slice(0, trail.index).trim();
      }
      const lead = raw.match(QUEST_OUTCOME_LEADING_RE);
      if (lead) {
        if (!outcomeWord) outcomeWord = lead[1];
        raw = raw.slice(lead[0].length).trim();
      }
      if (outcomeWord) {
        const prevVal = String((current || {})[d.key] ?? "").trim();
        const prevEmpty = prevVal === "" || prevVal === "—" || prevVal === "-";
        if (!prevEmpty) {
          const w = outcomeWord.toLowerCase();
          out[d.key + ".outcome"] = (w === "failed" || w === "fail") ? "failed" : "completed";
          tagged.add(d.key);
        }
        if (raw !== "" && raw.toLowerCase() === String((current || {})[d.key] ?? "").trim().toLowerCase()) raw = "";
      } else {
        delete out[d.key + ".outcome"];
      }
      out[d.key] = raw;
    } else {
      out[d.key] = raw;
    }
  }
  for (const p of nums) if (p.newMax !== undefined) out[p.d.key + ".max"] = p.newMax;
  // Apply the raw values first, THEN build the scope, so a cap formula referencing another tracker
  // (`max = level*20 + 80`) sees this turn's numbers; clamp against that cap last.
  for (const p of nums) out[p.d.key] = p.n;
  const scope = formulaScope(stats, out);
  for (const p of nums) {
    const curMax = p.d.maxFormula ? effectiveMax(p.d, scope) : (out[p.d.key + ".max"] !== undefined ? out[p.d.key + ".max"] : p.d.max);
    out[p.d.key] = Math.max(0, curMax !== undefined ? Math.min(curMax, p.n) : p.n);
  }
  for (const k of Object.keys(out)) {
    if (!k.endsWith(".outcome")) continue;
    if (!tagged.has(k.slice(0, -8))) delete out[k];
  }
  return out;
}

// Streaming display helper: cut everything from the first line containing the tracker header
// (plus a half-typed header forming on the last line) so the player never sees the raw block
// while it streams. Covers the machine blocks (`[TRACKERS]` / `[NPC TRACKERS]`) AND a narrative
// leak where the GM echoes its TRACKED STATE context section into the story (sometimes after a
// `✦ ✦ ✦` line) instead of just narrating from it. The dedicated tracker-update calls own those
// blocks — the narrative call must never emit them — so the reply stream is also auto-stopped
// at the first leak line (see RPEngine.generateGmReply) and the tail is cut before parsing.
//
// A line counts as a leak header only when it STARTS with the header (after leading markdown /
// quote / bullet / ornament chars are stripped), so prose that merely mentions tracked state
// mid-line never triggers, and an NPC named e.g. Tracy (`[Tracy] ...`) no longer matches. It
// must also be a BARE header — after the phrase only header furniture (end of line, colon,
// parenthetical, markdown, dash) — so a narration line like `Tracked state of affairs had
// worsened.` never triggers. Deliberately no "empty line before it" requirement: the reported
// leak puts the header on the line directly under `✦ ✦ ✦`, with no blank line between.
function isTrackerLeakHeaderLine(line) {
  const t = String(line || "");
  if (!/TRAC/i.test(t)) return false;
  const s = t.replace(/^[\s#>\-–—*✦✧•]+/, "").replace(/^\*{1,2}/, "");
  if (/^\[(?:NPC\s+)?TRACKERS?\]/i.test(s)) return true;
  const m = s.match(/^(?:NPC\s+)?TRACKED STATE\b/i);
  if (!m) return false;
  return /^\s*($|[:(\[*—–\-])/.test(s.slice(m[0].length));
}
// Strict prefixes of a leak header, for holding back a header that is still being typed on the
// stream's last line. Display-only (never aborts generation): over-matching here just delays one
// line by one chunk, so this is deliberately lenient.
const TRACKER_LEAK_TARGETS = ["[TRACKERS]", "[NPC TRACKERS]", "[NPC TRACKER]", "TRACKED STATE", "NPC TRACKED STATE"];
function isTrackerLeakPrefixTail(line) {
  const s = String(line || "").replace(/^[\s#>\-–—*✦✧•]+/, "").replace(/^\*{1,2}/, "").trim().replace(/\*+$/, "");
  if (s.length < 3) return false;
  const u = s.toUpperCase();
  return TRACKER_LEAK_TARGETS.some((t) => t.startsWith(u));
}
// Model-level stop sequences for the NARRATIVE calls (the dedicated tracker calls must NOT use
// these — emitting the block is their job). "TRACKED STATE" also covers "NPC TRACKED STATE" as
// a substring, but the longer NPC form is listed first so the stop lands before its "NPC " head
// instead of leaving it dangling as narration.
export const TRACKER_LEAK_STOPS = ["NPC TRACKED STATE", "[NPC TRACKERS]", "[TRACKERS]", "TRACKED STATE"];
// A divider/ornament-only line (scene break: ✦ ✦ ✦, ***, ---, — — —, ...).
const DIVIDER_LINE_RE = /^[✦✧*—–\-](\s*[✦✧*—–\-]){2,}\s*$/;
// Drop trailing ornament-only divider lines — a lone `✦ ✦ ✦` at the very end of a GM reply,
// with no following scene. The leak path below only ran when a tracker header was found, so a
// divider-terminated reply with no leak previously survived into a dangling meta message.
// Text that is ONLY dividers is left alone (degenerate — not ours to judge).
export function stripTrailingDivider(text) {
  const src = String(text || "");
  const lines = src.split("\n");
  let end = lines.length;
  while (end > 0 && DIVIDER_LINE_RE.test(lines[end - 1].trim())) end--;
  if (end === 0 || end === lines.length) return src;
  return lines.slice(0, end).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
// Line index of the first leak header in `text`, or -1 when there is none.
export function findTrackerLeakStart(text) {
  const lines = String(text || "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (isTrackerLeakHeaderLine(lines[i])) return i;
  }
  return -1;
}
// Cut a leaked tracker echo (header line through end of text) for final parsing. The leak is
// always trailing machine output after the story, never story itself, so everything from the
// header on is dropped. A scene-break line left orphaned at the end by the cut (a divider with
// no following scene — usually the separator the model put before the machine block) is dropped
// too, so the turn doesn't end on a dangling `✦ ✦ ✦`.
export function stripTrackerLeak(text) {
  const src = String(text || "");
  const idx = findTrackerLeakStart(src);
  if (idx < 0) return stripTrailingDivider(src);
  const lines = src.split("\n");
  let head = lines.slice(0, idx);
  while (head.length && DIVIDER_LINE_RE.test(head[head.length - 1].trim())) head.pop();
  return head.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
export function stripBlockForDisplay(text) {
  const lines = String(text || "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (isTrackerLeakHeaderLine(lines[i])) return lines.slice(0, i).join("\n");
  }
  if (lines.length) {
    const tail = lines[lines.length - 1];
    if (tail && isTrackerLeakPrefixTail(tail)) return lines.slice(0, -1).join("\n");
  }
  return text;
}

// =============================================================================================
// NPC trackers — the same tracked-state concept, scoped per character. One def set per world;
// every profiled NPC carries their own values. See README §6.3.1.
//
// Three layers, mirroring the hero trackers, with one difference: snapshots are SPARSE AND
// PER-NPC. A message's `afterNpcTrackers` holds a COMPLETE value set for each NPC that turn
// changed, and omits everyone else ("absent = unchanged"), so the fold walks back per NAME rather
// than reading a single global snapshot. That keeps saves small and makes deletes/re-rolls revert
// correctly for each character independently.
// =============================================================================================

// The most characters one turn's NPC tracker call may cover. Only the handful of characters who
// actually ACT in a turn can change values, so a big scene must not blow up the call's
// context/output with the idle crowd; dropped characters keep their values (absent = unchanged) and
// rejoin the moment they act or appear again. See RPEngine.npcTrackerRoster for who wins a slot.
export const NPC_TRACKER_CAP = 4;

// Off-screen life → tracker handoff (see updateNpcTrackers in rp-engine.js): banked NPC-owned
// auto memories qualify while fresh (older backlog was already narrated past — never bulk-apply
// it), a few off-screen characters per call at most (their own mini-cap, OUTSIDE
// NPC_TRACKER_CAP, so absent faces can never evict the in-play roster), and only the newest
// couple of happenings per character.
export const LIFE_TRACKER_LOOKBACK_TURNS = 10;
export const LIFE_TRACKER_OFFSCREEN_CAP = 3;
export const LIFE_TRACKER_EVENTS_PER_NPC = 2;

// Output caps for the two dedicated tracker-update calls (see RPEngine.updateTrackers /
// updateNpcTrackers), sized from what each call must actually emit so they grow with the
// world's tracker count: the hero call outputs `[TRACKERS]` plus one `key: value` line per
// def; the NPC call outputs one `Name:` header plus one line per def for each character in
// this turn's roster (at most NPC_TRACKER_CAP). A block line runs ~5–15 tokens — 28 per line
// plus the base keeps comfortable headroom, and stored text values are already capped at
// NPC_TRACKER_TEXT_CAP so one verbose value can't blow the estimate up.
//
// External providers (non-Perchance AI) get a roomier cap: they enforce `max_tokens`
// strictly, so a tight cap truncates the block (lost updates), while Perchance AI ignores
// it. External models also vary by tokenizer and tend to add a short preamble despite the
// "block only" instruction. 2x covers that without letting a rambling reply run far —
// thinking/reasoning budget is separate (OpenRouter `reasoning.exclude`, Ollama think flag),
// so no thinking headroom is baked in here. Both calls carry a flat +150 headroom on top.
// Capped at 3000 (GM reply scale).
export function heroTrackerOutputCap(defs, isExternal = false) {
  const base = 48 + Math.max(0, (defs || []).length) * 28;
  if (!isExternal) return base + 150;
  return Math.min(3000, base * 2 + 150);
}
export function npcTrackerOutputCap(defs, rosterSize, isExternal = false) {
  const perChar = 10 + Math.max(0, (defs || []).length) * 28;
  const base = 48 + Math.max(1, rosterSize || 0) * perChar;
  if (!isExternal) return base + 150;
  return Math.min(3000, base * 2 + 150);
}

// Stored text values are capped so one verbose value can't bloat the save file or the next turn's
// context, and newlines are flattened (a value always occupies one line in the block format).
export const NPC_TRACKER_TEXT_CAP = 120;

function capNpcText(v) {
  return String(v === undefined || v === null ? "" : v).replace(/\s*\n\s*/g, " ").slice(0, NPC_TRACKER_TEXT_CAP);
}

// The values a brand-new NPC's entry is seeded with (state.npcs[name].trackers). Same rules as
// initialTrackers (literal/formula start + max, dependency-ordered), then the character's own
// overrides merged on top: a start (`{"trust": 60}`) and, for a tracker with a LITERAL max, a cap
// (`{"trust.max": 80}` — same `key.max` pseudo-entry the live snapshot uses). Both are coerced for
// the def's type, clamped (start to the cap, cap to ≥ 0) and ignored for keys that aren't defs.
// A formula-derived cap (`max = trust*2`) is fixed by the def, so it is never overridden here.
export function initialNpcTrackers(defs, stats, overrides) {
  const list = defs || [];
  const out = initialTrackers(list, stats);
  const ov = overrides || {};
  // Caps first, so a start override is clamped against the character's own cap (not the world's).
  const capOverridden = new Set();
  for (const d of list) {
    if (d.type !== "number" || d.maxFormula !== undefined) continue;
    if (!Object.prototype.hasOwnProperty.call(ov, d.key + ".max")) continue;
    const n = Number(ov[d.key + ".max"]);
    if (!Number.isFinite(n)) continue;
    out[d.key + ".max"] = Math.max(0, Math.round(n));
    capOverridden.add(d.key);
  }
  for (const d of list) {
    const hasStart = Object.prototype.hasOwnProperty.call(ov, d.key);
    if (!hasStart && !capOverridden.has(d.key)) continue;
    if (d.type === "number") {
      const n = Number(hasStart ? ov[d.key] : out[d.key]);
      if (!Number.isFinite(n)) continue;
      const cap = liveMax(d, out, stats);
      out[d.key] = Math.max(0, cap !== undefined ? Math.min(cap, Math.round(n)) : Math.round(n));
    } else if (hasStart) {
      out[d.key] = capNpcText(ov[d.key]);
    }
  }
  // Re-resolve the stored caps after the overrides: a derived cap (`max = trust*2`) must reflect
  // the overridden trust, not the pre-override one.
  for (const d of list) {
    if (d.type !== "number") continue;
    const cap = liveMax(d, out, stats);
    if (cap !== undefined) out[d.key + ".max"] = cap;
  }
  return out;
}

// The live tracked values for ONE NPC: the newest message (walking backwards) whose snapshot
// contains that NPC, else the entry's seed, else fresh defaults. Always a copy — callers must never
// be able to mutate the stored history.
export function foldNpcTrackers(state, name, defs, stats) {
  const msgs = (state && state.messages) || [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    const snap = m && m.afterNpcTrackers;
    if (!snap || typeof snap !== "object") continue;
    const v = snap[name];
    if (v && typeof v === "object" && Object.keys(v).length) return { ...v };
  }
  const entry = (state && state.npcs && state.npcs[name]) || null;
  if (entry && entry.trackers && typeof entry.trackers === "object" && Object.keys(entry.trackers).length) return { ...entry.trackers };
  return initialNpcTrackers(defs || [], stats);
}

// Every tracked NPC's live values at once — `{ [name]: values }`. Built once per turn so the fold
// isn't re-walked per NPC while rendering dossiers.
export function getCurrentNpcTrackers(state, defs, stats) {
  const out = {};
  for (const name of Object.keys((state && state.npcs) || {})) out[name] = foldNpcTrackers(state, name, defs, stats);
  return out;
}

// Drop a character's tracker history from every message snapshot. Called when an entry is created
// for a name that has been seen before — i.e. after the character was deleted by the player and is
// being met again: their pre-deletion values must never resurface when they are re-met. Also keeps
// the save clean (no dead snapshot keys). See README §6.3.1.
export function purgeNpcTrackerHistory(state, name) {
  let removed = 0;
  for (const m of (state && state.messages) || []) {
    const snap = m && m.afterNpcTrackers;
    if (!snap || typeof snap !== "object" || !(name in snap)) continue;
    delete snap[name];
    removed++;
    if (!Object.keys(snap).length) delete m.afterNpcTrackers;
  }
  return removed;
}

// Drop keys that are no longer any def's — the D8 purge for a world whose def set changed since the
// save was written. Idempotent; run once when a session binds a world. Without it, a re-added key
// would resurrect the stale values from before the def was removed.
export function purgeNpcTrackerKeys(state, defs) {
  const keys = new Set((defs || []).map((d) => d.key));
  const clean = (obj) => {
    if (!obj || typeof obj !== "object") return 0;
    let n = 0;
    for (const k of Object.keys(obj)) {
      const base = k.endsWith(".max") ? k.slice(0, -4) : k;
      if (!keys.has(base)) { delete obj[k]; n++; }
    }
    return n;
  };
  let removed = 0;
  for (const entry of Object.values((state && state.npcs) || {})) removed += clean(entry && entry.trackers);
  for (const m of (state && state.messages) || []) {
    const snap = m && m.afterNpcTrackers;
    if (!snap || typeof snap !== "object") continue;
    for (const name of Object.keys(snap)) {
      removed += clean(snap[name]);
      if (!Object.keys(snap[name]).length) delete snap[name];
    }
    if (!Object.keys(snap).length) delete m.afterNpcTrackers;
  }
  return removed;
}

// One character's values as a compact, single-line rendering — `trust 34/100 · status wary`
// when keyOnly (the dedicated NPC tracker call's roster), else `Trust 34/100 · Status wary`
// (dossier lines, referee context, change chips). Shared so all three agree on values + caps.
export function npcTrackerValuesLine(defs, values, stats, sep = " · ", keyOnly = false) {
  const cur = values || {};
  const bits = [];
  for (const d of defs || []) {
    const v = cur[d.key];
    if (v === undefined || v === null || v === "") continue;
    const cap = d.type === "number" ? liveMax(d, cur, stats) : undefined;
    bits.push(`${keyOnly ? d.key : (d.label || d.key)} ${v}${cap !== undefined ? "/" + cap : ""}`);
  }
  return bits.join(sep);
}

// The shared per-def rules list. Rendered ONCE for the whole cast — never repeated per character
// (that would be pure duplication; see README §6.3.1). keyOnly drops label/icons for the
// dedicated NPC tracker call (the model must output keys); the narrative rules section keeps them.
function npcTrackerRulesList(defs, keyOnly = false) {
  return (defs || []).map((d) => {
    const meta = [];
    if (!keyOnly && (d.label || d.icon)) meta.push([d.label, d.icon].filter(Boolean).join(" "));
    meta.push(d.type === "number" ? "number" : "text");
    if (d.maxFormula) meta.push("max is FIXED");
    else if (d.type === "number" && d.max !== undefined) meta.push("max " + d.max);
    return `- ${d.key} (${meta.join(", ")}): ${d.rules || "no rules given — infer how it moves from the story"}`;
  }).join("\n");
}

// Label-only lines for the NARRATIVE context (`- Label: rules`), mirroring trackerValueLines
// minus values. No key, icon, type, or max; label falls back to key when empty. Values and caps
// live on each dossier's `Tracked:` line, so they are not repeated here.
function npcTrackerGmLines(defs) {
  return (defs || []).map((d) => {
    const name = (d.label && String(d.label).trim()) || d.key;
    return `- ${name}: ${d.rules || "no rules given — infer how it moves from the story"}`;
  }).join("\n");
}

// The section appended to the NARRATIVE context: the rules once, plus the note that the GM reads
// but never writes these values (a dedicated call does). Values themselves live on each character's
// NPC PROFILES line, so they are not repeated here.
export function buildNpcTrackerRulesContext(defs) {
  if (!defs || !defs.length) return "";
  return [
    "NPC TRACKED STATE (each active NPC carries their own tracked values in NPC PROFILES above, keep your narration consistent with them):",
    npcTrackerGmLines(defs)
  ].join("\n");
}

// The rules + roster + machine format for the DEDICATED NPC tracker call. Prose around it (the
// instruction, the reply to track, the player's action) lives in RPEngine.updateNpcTrackers.
export function buildNpcTrackerContext(defs, byNpc, roster, stats) {
  if (!defs || !defs.length) return "";
  const names = roster || [];
  const lines = names.map((n, i) => {
    const vals = npcTrackerValuesLine(defs, (byNpc && byNpc[n]) || {}, stats, " · ", true);
    return `${i + 1}. ${n}${vals ? " — " + vals : ""}`;
  });
  const exampleName = names[0] || "Character Name";
  // Only ask for a live cap when we actually have that character's values — a derived formula
  // (`= trust*2`) has nothing to resolve against otherwise, and would only log a warning.
  const exampleVals = byNpc && byNpc[exampleName];
  const example = [
    "[NPC TRACKERS]",
    `${exampleName}:`,
    ...defs.map((d) => {
      const cap = d.type === "number" && exampleVals ? liveMax(d, exampleVals, stats) : undefined;
      if (d.type === "number") {
        const raw = exampleVals?.[d.key];
        const v = raw === undefined || raw === null || raw === "" ? 0 : raw;
        return cap !== undefined ? `${d.key}: ${v}/${cap}` : `${d.key}: ${v}`;
      }
      const v = exampleVals?.[d.key] ?? "";
      return `${d.key}: ${v}`;
    })
  ];
  return [
    "NPC TRACKERS (one set of rules, shared by every character below — apply them per character):",
    npcTrackerRulesList(defs, true),
    "CHARACTERS TO TRACK (these are the only characters in play this turn — output these and only these; anyone not listed does not exist for this task):",
    lines.length ? lines.join("\n") : "(no characters are in play — output nothing)",
    "Output the updated state as the complete machine-readable block below, and NOTHING after it:",
    example.join("\n"),
    "Rules: `[NPC TRACKERS]` alone on its own line, then for each character that CHANGED this turn: the character's name alone on a line ending with a colon, followed by one `key: value` line per tracker they carry. A character whose values did not change is OMITTED COMPLETELY — omitting a character means \"unchanged\" (their values carry over exactly). For a character you do include, output EVERY tracker they carry, even the unchanged ones, so the block is a complete snapshot of that character. No bullets, no bold, no quotes, no commentary, no characters other than those listed above. A change goes in ONLY when the latest turn describes something actually HAPPENING to that character in it — not when the turn merely refers back to the past, and not for another character's action that doesn't touch them. When in doubt, leave the character out. For a number tracker with a max, write `key: value/max` (e.g. `trust: 39/100`) and keep the max current even when unchanged; a max marked as FIXED is fixed — never write a different one. Numbers are plain (no units, no commas). An empty text value is written as `key:` with nothing after the colon."
  ].join("\n");
}

// Find the `[NPC TRACKERS]` block in a raw reply, returning it plus the text with it removed.
// Mirrors extractTrackers; the body grammar is looser because it holds per-character sections.
export function extractNpcTrackers(rawText) {
  const src = String(rawText || "");
  const lines = src.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*\[NPC\s+TRACKERS?\]\s*$/i.test(lines[i])) { start = i; break; }
  }
  if (start < 0) return { text: src, block: null };
  let end = start;
  let seen = false;
  for (let i = start + 1; i < lines.length; i++) {
    const ln = lines[i];
    // A character header (`Name:`) or a `key: value` line continues the block; anything else
    // (prose) ends it. Blank lines are tolerated only after the block has started.
    const body = /^\s*[^:\n]{1,60}:\s*$/.test(ln) || /^\s*[A-Za-z_][\w-]*\s*:/.test(ln);
    if (body) { end = i; seen = true; }
    else if (!ln.trim()) { if (seen) end = i; else continue; }
    else break;
  }
  while (end > start && !lines[end].trim()) end--;
  const block = lines.slice(start, end + 1).join("\n");
  const text = lines.slice(0, start).concat(lines.slice(end + 1)).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { text, block };
}

// Parse an [NPC TRACKERS] block into a SPARSE snapshot: `{ [name]: values }` for the characters the
// block actually changed. Each character's section is handed to the hero parser (parseTrackerBlock)
// with that character's current values as the fallback, so clamping to ≥0/`max`, `value/max` max
// handling, fixed derived caps, unknown-key tolerance and "unparseable → keep current" all behave
// exactly as they do for the hero — one code path, no drift.
export function parseNpcTrackerBlock(block, defs, prevByName, stats, roster, opts) {
  const out = {};
  if (!block || !defs || !defs.length) return out;
  // `sparse` (the default, and what the AI's own block is parsed with) drops a character whose
  // parsed values equal what they already had, so a model that echoes an unchanged character can
  // never produce a no-op snapshot. A HAND-EDIT passes `{sparse:false}`: there every section in the
  // block is authoritative, since the player is deliberately setting that character's state (even
  // back to the value they already had) and a section left untouched must not silently vanish.
  const sparse = !opts || opts.sparse !== false;
  const prev = prevByName || {};
  const names = (roster || []).map(String);
  const byLower = new Map(names.map((n) => [n.trim().toLowerCase(), n]));
  const resolveName = (raw) => {
    const t = String(raw || "").trim();
    const direct = byLower.get(t.toLowerCase());
    if (direct) return direct;
    // Models often echo the roster numbering as the context printed it ("1. Alice" / "2) Bob"), or
    // just the bare index. Strip the numbering and retry the name, then fall back to the index.
    const stripped = t.replace(/^\d+\s*[.):\-]\s*/, "").trim();
    if (stripped !== t) {
      const named = byLower.get(stripped.toLowerCase());
      if (named) return named;
      // A numbered variant spelling ("1. Camilla") still resolves through the roster matcher.
      const fuzzyStripped = resolveNpcName(stripped, names);
      if (fuzzyStripped) return fuzzyStripped;
    }
    const idx = t.match(/^(\d+)\s*[.):\-]?$/);
    if (idx) { const n = Number(idx[1]); if (names[n - 1]) return names[n - 1]; }
    // A variant spelling of a roster name (dropped title/surname, small typo) resolves to the
    // unique roster entry whose distinctive tokens contain it — ambiguous variants match nothing
    // and are skipped as before, so two different characters are never merged.
    return resolveNpcName(t, names);
  };
  const lines = String(block).split("\n");
  const keySet = new Set((defs || []).map((d) => String(d.key).toLowerCase()));
  const sections = [];
  let cur = null;
  const flush = () => { if (cur && cur.lines.length) sections.push(cur); cur = null; };
  for (let i = 1; i < lines.length; i++) {
    const ln = lines[i];
    if (!ln.trim()) continue;
    // A bare `label:` line is a character header — UNLESS the label is one of our own def keys, in
    // which case it's an empty text value (`status:` with nothing after the colon). A header always
    // ends the previous character: an unknown (hallucinated) character is skipped entirely rather
    // than folded into the character before it.
    const head = ln.match(/^\s*(.+?)\s*:\s*$/);
    const label = head ? head[1].trim() : null;
    if (label !== null && !keySet.has(label.toLowerCase())) {
      flush();
      const name = resolveName(label);
      cur = name ? { name, lines: [] } : null;
      continue;
    }
    if (cur) cur.lines.push(ln); // a `key: value` line for the current character
  }
  flush();
  for (const sec of sections) {
    const prior = { ...(prev[sec.name] || {}) };
    const parsed = parseTrackerBlock("[TRACKERS]\n" + sec.lines.join("\n"), defs, prior, stats);
    for (const d of defs) if (d.type !== "number") parsed[d.key] = capNpcText(parsed[d.key]);
    for (const k of Object.keys(parsed)) if (k.endsWith(".outcome")) delete parsed[k];
    if (!sparse || !npcValuesEqual(defs, parsed, prior, stats)) out[sec.name] = parsed;
  }
  return out;
}

// Render a sparse snapshot back into the `[NPC TRACKERS]` block format — the inverse of
// parseNpcTrackerBlock. Used by the GM-reply editor, so NPC values are hand-fixed in exactly the
// place the hero's `[TRACKERS]` block is edited.
export function npcTrackerBlockText(defs, snap, stats) {
  const secs = [];
  for (const name of Object.keys(snap || {})) {
    const vals = snap[name] || {};
    const lines = [`${name}:`];
    for (const d of defs || []) {
      if (d.type === "number") {
        const cap = liveMax(d, vals, stats);
        lines.push(`${d.key}: ${Number(vals[d.key]) || 0}${cap !== undefined ? "/" + cap : ""}`);
      } else {
        const v = vals[d.key];
        lines.push(`${d.key}: ${v === undefined || v === null ? "" : String(v)}`);
      }
    }
    secs.push(lines.join("\n"));
  }
  return secs.join("\n\n");
}

// Whether two value sets are the same for every def — used to keep snapshots genuinely sparse (a
// model that helpfully echoes an unchanged character must not produce a no-op snapshot or a chip).
function npcValuesEqual(defs, a, b, stats) {
  for (const d of defs || []) {
    if (d.type === "number") {
      if ((Number(a[d.key]) || 0) !== (Number(b[d.key]) || 0)) return false;
      const am = liveMax(d, a, stats);
      const bm = liveMax(d, b, stats);
      if ((am === undefined) !== (bm === undefined)) return false;
      if (am !== undefined && am !== bm) return false;
    } else if (String(a[d.key] || "") !== String(b[d.key] || "")) return false;
  }
  return true;
}
