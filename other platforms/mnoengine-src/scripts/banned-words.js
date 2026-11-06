// Banned words for AI-invented names — shared by Craft with AI (world-craft.js) and the
// world editor's single-NPC Generate button (world-editor.js). Prompt-only: the lists feed the
// prompt instructions, nothing else. The GM's runtime NPCs and any user-typed name are never
// filtered.
//
// WORLD_TITLE_BANNED: overused AI title words — never allowed in a Crafted world title.
// NPC_NAME_BANNED: overused AI first names — never invented by the AI (a user who types one
// explicitly still gets exactly what they asked for).

export const WORLD_TITLE_BANNED = [
  "gilded", "velvet", "horizon", "sovereign", "ember", "embers", "ashen", "crimson",
  "obsidian", "ethereal", "echoes", "shattered", "veil", "whispers", "shadows", "thorns",
  "crown", "hollow", "fallen", "forsaken", "forgotten", "eternal", "silent", "midnight",
  "twilight", "storm", "iron", "blood", "frost", "starlight", "moonlit", "neon",
  "celestial", "sacred", "cursed", "abyss", "void", "requiem", "reckoning", "chronicles"
];

export const NPC_NAME_BANNED = [
  "elara", "elora", "alara", "thorne", "kaelen", "kael", "silas", "lyra", "nyx",
  "rowan", "celeste", "seraphina", "elowen", "dorian", "julian", "kai", "mira", 
  "zara", "voss", "vane", "marcus"
].filter((v, i, a) => v && a.indexOf(v) === i);
