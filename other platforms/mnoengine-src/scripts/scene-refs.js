// scene-refs.js — character reference images for scene generation (experiment).
//
// Before a finished scene prompt is sent to an EXTERNAL image provider, the prompt
// text is searched for NPC name hits (lorebook.js's `nameHit` — the same rule the
// scene prompt's own strict casting uses) and every hit with a usable avatar
// contributes it as a reference image, numbered in first-mention order:
//
//   Image reference 1 is <Name>. Image reference 2 is <Name>. ...
//
// Perchance AI has no reference-image input, so refs only ever attach where the
// provider accepts them (see refsSupported) — everywhere else the prompt goes out
// exactly as before.

import { nameHit } from "./lorebook.js";

export const MAX_SCENE_REFS = 4;

// A portrait that can actually be sent: a data:, http(s) or blob: URL. The
// generated-avatar pipeline stores webp data URLs; anything else is the bundled
// placeholder (or empty) and carries no likeness.
export function usableAvatar(portrait) {
  const p = String(portrait || "").trim();
  return /^(data:|https?:|blob:)/.test(p) ? p : "";
}

function firstMention(hay, name) {
  const low = String(hay).toLowerCase();
  const full = low.indexOf(String(name).toLowerCase());
  if (full !== -1) return full;
  let best = Infinity;
  for (const t of String(name).split(/\s+/).filter((t) => t.length >= 3)) {
    const i = low.indexOf(t.toLowerCase());
    if (i !== -1 && i < best) best = i;
  }
  return best;
}

// NPC name hits in `promptText`, first-mention order, capped. `npcs` is the
// session roster (state.npcs): {name: {portrait, details, ...}}. `hero` is the
// player character ({name, portrait[, avatar]}) — searched with the same rule,
// so a hero named in the scene contributes their likeness too. (A hero always
// has a real name, so no generic-name guard is needed.)
export function findSceneNpcRefs(promptText, npcs, hero) {
  const hay = String(promptText || "");
  if (!hay) return [];
  const candidates = [];
  if (hero && typeof hero === "object") {
    const hn = String(hero.name || "").trim();
    if (hn) candidates.push({ name: hn, avatar: usableAvatar(hero.portrait) || usableAvatar(hero.avatar) });
  }
  if (npcs && typeof npcs === "object") {
    for (const name of Object.keys(npcs)) {
      if (!name) continue;
      candidates.push({ name, avatar: usableAvatar(npcs[name] && npcs[name].portrait) });
    }
  }
  const out = [];
  for (const c of candidates) {
    if (!nameHit(hay, c.name)) continue;
    if (!c.avatar) continue;
    out.push({ name: c.name, avatar: c.avatar, at: firstMention(hay, c.name) });
  }
  out.sort((a, b) => a.at - b.at);
  return out.slice(0, MAX_SCENE_REFS).map(({ name, avatar }) => ({ name, avatar }));
}

// The prompt suffix binding each attached reference to its character. Only
// appended when the references are actually sent — without attached images the
// numbering would point at nothing. The likeness-only paragraph fights the
// refs' built-in bias: every avatar is a front-facing bust, so without it the
// model copies the pose/composition (everyone facing the camera) instead of
// just the face and clothes.
export function scenePromptWithRefs(prompt, refs) {
  const lines = refs.map((r, i) => `Image reference ${i + 1} is ${r.name}.`);
  lines.push("Use each reference for that character's facial and physical traits only. Place everyone naturally in the scene's action; nobody poses for the viewer or makes eye contact with the camera unless the moment calls for it.");
  return String(prompt || "").trim() + " " + lines.join(" ");
}

// Which (provider, model) pairs can actually receive reference images.
export function refsSupported(providerId, model) {
  if (providerId === "openrouter") return true; // input_references (data URLs OK)
  if (providerId === "openai") {
    const m = String(model || "").toLowerCase();
    return !m.includes("dall-e-2") && !m.includes("dall-e-3"); // GPT-image via /images/edits
  }
  return false; // Perchance AI takes no image input
}
