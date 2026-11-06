// Text helpers shared by every prompt. `{{user}}` is the authoring shorthand for the hero's name:
// it appears in the narrator prompt, in world-authored text (a world's `scenario`/`start`,
// lorebook entry content, cast personas/secrets), and in text players type once they know it.
// The AI has no idea what the bare token means, so every string handed to a genText/genImage call
// is resolved first. Kept in one module so the GM context, the NPC profile/portrait calls, the
// mapmaker, the scene-image call and the hero-bio generator all resolve it identically.

export const USER_PLACEHOLDER = "{{user}}";

// The hero's name for substitution, with the same neutral fallback the GM context uses (calls that
// run before a hero exists — a world's starter content, a bio being randomized — still read fine).
export function heroNameOf(state) {
  return String(((state && state.character) || {}).name || "").trim() || "the hero";
}

// Resolve `{{user}}` in `text` to `heroName`. Idempotent, and blank-safe (null/undefined → "").
export function subUser(text, heroName) {
  const name = String(heroName || "").trim() || "the hero";
  return String(text == null ? "" : text).split(USER_PLACEHOLDER).join(name);
}

// Placeholder-only profile text counts as empty: blank, dash/dot-only ("—", "-", "…"), or an
// explicit nothing-here ("none", "none notable", "n/a"). One copy — the GM context, the NPC
// ranking, and the off-screen life call all import this, so filler ("Secrets: —") is filtered
// identically everywhere and the filters can never drift.
const BLANK_DETAIL_RE = /^[\s—–\-‒·•_.…]+$/;
const BLANK_DETAIL_WORDS = new Set(["none", "none notable", "nothing notable", "no notes", "n/a", "n.a.", "nil"]);
export function blankDetail(v) {
  const s = String(v == null ? "" : v).trim();
  if (!s) return true;
  if (BLANK_DETAIL_RE.test(s)) return true;
  return BLANK_DETAIL_WORDS.has(s.toLowerCase());
}

// Truncate to n chars with a visible marker when cut — a clipped GM line should read
// "playful, teasing cadence…", never look like a complete sentence that ends mid-word.
export function ellipsize(s, n) {
  const t = String(s == null ? "" : s);
  if (t.length <= n) return t;
  return t.slice(0, Math.max(0, n - 1)) + "…";
}
// Compact one-line roster line — `- Name (role) — trait` — shared by the GM's hook lines and
// the off-screen life call's company sketches, so the two can never drift (same role order,
// same first-real-trait priority, same placeholder filtering). Takes raw dossier text with NO
// `{{user}}` resolution — each caller subs its own output (the engine subs the whole prompt
// globally; the life call subs per line). Appends nothing: tails (Pursuit, Whereabouts) stay
// with their callers.
export function compactNpcLine(entry, maxTrait = 160, extraTags = []) {
  const d = (entry && entry.details) || {};
  const tags = [d.race, d.gender, d.age, d.job, ...extraTags].filter((v) => !blankDetail(v));
  const role = tags.join(", ");
  // First REAL trait wins — a placeholder persona ("—") must not shadow a real appearance.
  const srcRaw = [d.persona, d.extra, d.appearance, entry && entry.description].find((v) => !blankDetail(v));
  const src = String(srcRaw == null ? "" : srcRaw).replace(/\s+/g, " ").trim();
  const hook = src ? " — " + ellipsize(src, maxTrait) : "";
  return `- ${entry && entry.name}${role ? ` (${role})` : ""}${hook}`;
}
