// image-gen-prefs.js — global image-generation preferences (machine-local localStorage).
// Single source of truth for the Settings > Image Gen section's guidance scale.
// Default 7 matches the text-to-image-plugin's own default.

export const IMAGE_GEN_PREF_KEY = "mno.imageGenPrefs";
export const IMAGE_GUIDANCE_DEFAULT = 7;
export const IMAGE_GUIDANCE_MIN = 1;
export const IMAGE_GUIDANCE_MAX = 30;

export function clampGuidance(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return IMAGE_GUIDANCE_DEFAULT;
  return Math.max(IMAGE_GUIDANCE_MIN, Math.min(IMAGE_GUIDANCE_MAX, n));
}

export function imageGuidance() {
  try {
    const raw = localStorage.getItem(IMAGE_GEN_PREF_KEY);
    if (!raw) return IMAGE_GUIDANCE_DEFAULT;
    const p = JSON.parse(raw);
    const v = p != null && typeof p === "object" ? p.guidance : p;
    if (v == null || v === "") return IMAGE_GUIDANCE_DEFAULT;
    return clampGuidance(v);
  } catch (e) {
    return IMAGE_GUIDANCE_DEFAULT;
  }
}

export function persistImageGuidance(v) {
  try {
    localStorage.setItem(IMAGE_GEN_PREF_KEY, JSON.stringify({ guidance: clampGuidance(v) }));
  } catch (e) {}
}

// Window fallback for modules that don't import this file (same key/shape).
if (typeof window !== "undefined" && !window.mnoImageGuidance) {
  window.mnoImageGuidance = imageGuidance;
}
