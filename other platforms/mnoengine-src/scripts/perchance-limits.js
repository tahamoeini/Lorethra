// Central Perchance AI input budget — INTERNAL engine use only (memory roll-up packing,
// GM transcript fitting). The context meter / budget-estimate UI keeps its own reads and is
// deliberately untouched by this number.
//
// NOTE (future): this is currently hardcoded. An agent can fetch the real value from the
// source with: fetch_url https://text-generation.perchance.org/embed to scratch/, then grep
// maxContextTokens in the saved file. A script built on that can replace the constant below —
// until then every caller must keep working off this sync const as the fallback, so keep it
// importable without side effects (no window touches in this module).
export const PERCHANCE_INPUT_CAP = 6976;

// Token estimator fallback when the plugin's exact counter is unavailable. Measured live on
// story prose (~4.0); the fit/pack margins below absorb its error.
export const PERCHANCE_CHARS_PER_TOKEN = 4.0;
