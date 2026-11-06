// Hero attributes (STR, INT, …) — player-owned, stable values. Defined by the dev in
// the loaded world's stats config (same style as trackers), stored on state.character.stats.
// Unlike trackers, the AI NEVER updates these: they change only when the player spends level-up
// points in the Hero panel. The GM only reads them (via the CHARACTER SHEET).

import { evalFormula } from "./trackers.js";

// Parse stats.md into { defs, pointsPerLevel, ccBudget, ccFloor, averageThreshold,
// exceptionalThreshold, modStep, dieSides, useStatModFormula, statModFormula }. Format mirrors
// trackers.md: top-level settings (the `pointsPerLevel` level-up grant, the creation-wizard
// `ccBudget`/`ccFloor`/`ccCeiling`, the UI color thresholds `averageThreshold`/`exceptionalThreshold`, the
// skill-check `modStep`/`dieSides`, and the optional custom `statModFormula`), then one [key] block
// per stat with label/start/max/rules lines.
export function parseStatsConfig(text) {
  const defs = [];
  let cur = null;
  const cfg = { pointsPerLevel: 2, ccBudget: 12, ccFloor: 5, ccCeiling: 20, averageThreshold: 10, exceptionalThreshold: 15, modStep: 5, dieSides: 20, useStatModFormula: false, statModFormula: "" };
  let inFence = false;
  const flush = () => { if (cur) defs.push(cur); cur = null; };
  const FIELDS = new Set(["label", "hint", "start", "max"]);
  for (const raw of String(text || "").split("\n")) {
    const line = raw.trim();
    if (/^\s*```/.test(line)) { inFence = !inFence; continue; } // skip markdown fenced code blocks
    if (inFence) continue;
    if (!line || line.startsWith("#")) continue;
    const sec = line.match(/^\[([A-Za-z_][\w-]*)\]\s*$/);
    if (sec) { flush(); cur = { key: sec[1], label: "", hint: "", start: undefined, max: undefined, rules: "" }; continue; }
    if (!cur) {
      const g = line.match(/^([A-Za-z_]\w*)\s*=\s*(.*)$/);
      if (g) {
        const rawKey = g[1].toLowerCase();
        const rawVal = g[2].trim();
        const numKey = { pointsperlevel: "pointsPerLevel", ccbudget: "ccBudget", ccfloor: "ccFloor", ccceiling: "ccCeiling", averagethreshold: "averageThreshold", exceptionalthreshold: "exceptionalThreshold", modstep: "modStep", diesides: "dieSides" }[rawKey];
        if (numKey) { const n = Number(rawVal); if (Number.isFinite(n)) cfg[numKey] = n; }
        else if (rawKey === "usestatmodformula") cfg.useStatModFormula = /^(true|yes|1)$/i.test(rawVal);
        else if (rawKey === "statmodformula") cfg.statModFormula = rawVal.replace(/^=\s*/, "");
      }
      continue;
    }
    const kv = line.match(/^([a-z][\w-]*)\s*=\s*(.*)$/i);
    if (kv && FIELDS.has(kv[1].toLowerCase())) {
      const k = kv[1].toLowerCase();
      const v = kv[2].trim();
      if (k === "label") cur.label = v;
      else if (k === "hint") cur.hint = v;
      else if (k === "start") cur.start = Number(v) || undefined;
      else if (k === "max") cur.max = Number(v) || undefined;
    } else {
      cur.rules = cur.rules ? cur.rules + " " + line : line;
    }
  }
  flush();
  return { defs, ...cfg };
}

// Skill-check modifier for a stat value against the config thresholds. Below `averageThreshold`
// the mod is negative (at least −1), above `exceptionalThreshold` positive (at least +1), and
// between them (inclusive) it's 0. Unbounded — very low/high stats keep scaling by `modStep`
// points per modifier step. `modStep` is tunable in stats.md. This is the built-in fallback; a
// world may replace it with a custom formula (see checkMod).
export function statMod(v, cfg) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const avg = Number((cfg && cfg.averageThreshold) ?? 10);
  const exc = Number((cfg && cfg.exceptionalThreshold) ?? 15);
  const step = Number((cfg && cfg.modStep) ?? 5);
  if (n < avg) return Math.floor((n - avg) / step);
  if (n > exc) return Math.ceil((n - exc) / step);
  return 0;
}

// Faces on the skill-check die (`dieSides`, default 20). Clamped to a sane range so a bad config
// can never produce a 0- or 1-face die (which would make every roll identical).
export function dieSidesOf(cfg) {
  const raw = cfg && cfg.dieSides;
  if (raw === undefined || raw === null || raw === "" || !Number.isFinite(Number(raw))) return 20;
  return Math.min(1000, Math.max(2, Math.round(Number(raw))));
}

// The modifier actually applied to a skill check. When the world enables a custom formula, it is
// evaluated against { v (the stat value), avg, exc, step } — see `evalFormula` for the grammar —
// and rounded to a whole modifier. Anything non-numeric/NaN, a throw, or an empty/disabled
// formula falls back to the built-in statMod with a console warning so config typos surface.
export function checkMod(v, cfg) {
  const n = Number(v);
  const avg = Number((cfg && cfg.averageThreshold) ?? 10);
  const exc = Number((cfg && cfg.exceptionalThreshold) ?? 15);
  const step = Number((cfg && cfg.modStep) ?? 5);
  const expr = cfg && cfg.useStatModFormula ? String(cfg.statModFormula || "").trim() : "";
  if (expr) {
    try {
      const r = evalFormula(expr, { v: Number.isFinite(n) ? n : 0, avg, exc, step });
      if (typeof r === "number" && Number.isFinite(r)) return Math.round(r);
      console.warn("[stats] custom skill-check formula returned a non-number:", expr);
    } catch (e) {
      console.warn("[stats] bad custom skill-check formula:", expr, "-", e.message);
    }
  }
  return statMod(v, cfg);
}

// Difficulty ladder — base d20 DC ranges. Each check rolls a random DC inside its band so
// repeated attempts at the same difficulty don't all face one fixed number. Bands partition
// 5–29 with no gaps: trivial [5,8], easy [9,12], medium [13,15], hard [16,19], veryhard [20,24],
// impossible [25,29].
// Veryhard can exceed 20: above the die max only a strong modifier (or a crit) passes.
// Impossible exceeds any natural d20 roll: without a huge modifier only a crit succeeds.
// The words the AI may use are documented in stats.md.
export const DIFFICULTY_RANGES = { trivial: [5, 8], easy: [9, 12], medium: [13, 15], hard: [16, 19], veryhard: [20, 24], impossible: [25, 29] };
export const DIFFICULTIES = { trivial: 8, easy: 10, medium: 13, hard: 16, veryhard: 20, impossible: 25 };

export function normalizeDifficulty(word) {
  const w = String(word || "").toLowerCase().replace(/[^a-z]/g, "");
  if (DIFFICULTIES[w] !== undefined) return w;
  if (/^(veryhard|extreme|deadly|herculean)$/.test(w)) return "veryhard";
  if (/^(moderate|average|standard|normal)$/.test(w)) return "medium";
  if (/^(simple|basic|light)$/.test(w)) return "easy";
  return "medium";
}

// Scale one base-d20 DC to a die with `sides` faces. Linear scaling: the DC sits the same
// fraction up the die (factor sides/20, rounded, minimum 1). A DC above the d20 max stays
// the same fraction above the new max — e.g. base 24 is 20% above a d20, so it is 120 on
// a d100 and 7 on a d6.
export function dcValueForBase(base, sides) {
  const b = Number(base);
  const s = Number(sides);
  if (!Number.isFinite(b)) return 13;
  if (!Number.isFinite(s) || Math.round(s) === 20) return Math.round(b);
  const sc = Math.min(1000, Math.max(2, Math.round(s)));
  return Math.max(1, Math.round(b * sc / 20));
}

// DC for a difficulty on a die with `sides` faces: a uniform random integer from the scaled
// band. d20 values land inside the base ranges above (e.g. medium 13–15, trivial 5–8);
// other dice scale linearly (d100 medium 65–75, veryhard 100–120, impossible 125–145).
export function dcForDifficulty(word, sides, rng) {
  const key = normalizeDifficulty(word);
  const band = DIFFICULTY_RANGES[key] || [13, 15];
  const s = Number(sides);
  if (!Number.isFinite(s) || Math.round(s) === 20) {
    const lo = Math.round(band[0]), hi = Math.round(band[1]);
    const r = typeof rng === "function" ? rng() : Math.random();
    return lo + Math.floor(r * (hi - lo + 1));
  }
  const sc = Math.min(1000, Math.max(2, Math.round(s)));
  let lo = dcValueForBase(band[0], sc);
  let hi = dcValueForBase(band[1], sc);
  if (hi < lo) { const t = lo; lo = hi; hi = t; }
  const r = typeof rng === "function" ? rng() : Math.random();
  return lo + Math.floor(r * (hi - lo + 1));
}

// Roll a skill check. `decision` = { stat, difficulty } from the check referee. Rolls the
// configured die (default d20) + checkMod. Critical successes/failures generalise the d20
// natural-20/natural-1 rule to any die: the top and bottom `max(1, floor(sides/20))` faces are
// critical — i.e. the best achievable approximation of the d20's 5% windows (exactly 5% for a
// d100, and exactly nat-20/nat-1 for a d20). Returns the full record used by the chat pip and the
// GM's context. `stats` are the hero's current stat values.
export function resolveCheck(decision, stats, defs, cfg) {
  const stat = decision && decision.stat;
  const d = (defs || []).find((x) => x.key === stat);
  const statVal = stats && stats[stat] !== undefined ? Number(stats[stat]) : (d && d.start !== undefined ? d.start : 0);
  const mod = checkMod(statVal, cfg);
  const sides = dieSidesOf(cfg);
  const die = 1 + Math.floor(Math.random() * sides);
  const dc = dcForDifficulty(decision && decision.difficulty, sides);
  const critWindow = Math.max(1, Math.floor(sides / 20));
  const crit = die > sides - critWindow ? "pass" : die <= critWindow ? "fail" : null;
  const total = die + mod;
  const passed = crit === "pass" ? true : crit === "fail" ? false : total >= dc;
  return {
    stat,
    statLabel: (d && d.label) || stat,
    statVal,
    mod,
    die,
    sides,
    total,
    dc,
    difficulty: normalizeDifficulty(decision && decision.difficulty),
    passed,
    crit,
    margin: total - dc
  };
}

// UI color tier for a stat value against the config thresholds: "" (default color),
// "low" (below `averageThreshold` → red) or "high" (above `exceptionalThreshold` → gold).
// Values exactly at a threshold (and everything between them) stay the default color.
export function statTier(val, cfg) {
  const v = Number(val);
  const avg = Number((cfg && cfg.averageThreshold) ?? 10);
  const exc = Number((cfg && cfg.exceptionalThreshold) ?? 15);
  if (!Number.isFinite(v)) return "";
  if (v < avg) return "low";
  if (v > exc) return "high";
  return "";
}

// Clamp a stat value to [0, max] (no cap when max is undefined).
export function clampStat(v, d) {
  const n = Number(v);
  if (Number.isNaN(n)) return (d && d.start !== undefined) ? d.start : 0;
  const hi = (d && d.max !== undefined) ? d.max : 999999;
  return Math.max(0, Math.min(hi, n));
}

// Values a new hero begins with (each stat's `start`, default 0).
export function initialStats(defs) {
  const out = {};
  for (const d of defs || []) out[d.key] = clampStat(d.start !== undefined ? d.start : 0, d);
  return out;
}

// Fill in missing stat keys (from `start`) and clamp existing values to [0, max]. Used on session
// load so config changes (new stats added in stats.md) propagate to existing characters.
export function ensureStats(stats, defs) {
  const s = (stats && typeof stats === "object") ? stats : {};
  const out = { ...s };
  for (const d of defs || []) {
    const v = out[d.key];
    out[d.key] = (v === undefined || v === null || v === "") ? clampStat(d.start !== undefined ? d.start : 0, d) : clampStat(v, d);
  }
  return out;
}

// The ATTRIBUTES section for the CHARACTER SHEET context — the GM reads current values + rules so
// checks and consequences can use them. Explicitly player-owned & stable: never in the [TRACKERS]
// block, never AI-updated.
export function buildStatsContext(defs, stats) {
  if (!defs || !defs.length) return "";
  const s = stats || {};
  const lines = defs.map((d) => {
    const maxTxt = d.max !== undefined ? ` (max ${d.max})` : "";
    const rulesTxt = d.rules ? " — " + d.rules : "";
    return `- ${d.key}: ${s[d.key] ?? (d.start !== undefined ? d.start : 0)}${maxTxt}${rulesTxt}`;
  });
  return "STATS (the hero's core stats. Use them for checks and consequences.):\n" + lines.join("\n");
}
