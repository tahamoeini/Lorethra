// def-presets.js — one-click starter packs for the world editor's Stats / Trackers /
// NPC Trackers tabs (the 📋 Presets buttons in world-editor.js). Edit freely: each entry is a
// plain def object with the same fields the editor rows use. Tracker rules follow the
// what/how/when sentence (WHAT it is, HOW high/low values affect play, WHEN the GM updates it).
// Packs are deliberately cross-genre — fantasy, sci-fi, modern, horror, mystery, survival.

export const STAT_PRESETS = [
  { key: "str", label: "Strength", start: 10, max: 50, hint: "Raw physical power.", rules: "Used for melee attacks, grappling, breaking things, and carrying. High strength hits harder and lifts more." },
  { key: "agi", label: "Agility", start: 10, max: 50, hint: "Speed and coordination.", rules: "Used for dodging, stealth, initiative, and fine movement. High agility acts first and evades often." },
  { key: "end", label: "Endurance", start: 10, max: 50, hint: "Stamina and toughness.", rules: "Used to resist poison, exhaustion, and pain, and to keep going on long marches." },
  { key: "int", label: "Intellect", start: 10, max: 50, hint: "Reasoning and knowledge.", rules: "Used for lore, puzzles, crafting, and understanding strange magic or devices." },
  { key: "wit", label: "Wit", start: 10, max: 50, hint: "Perception and quick thinking.", rules: "Used to notice hidden things, read people, and react to surprises." },
  { key: "cha", label: "Charm", start: 10, max: 50, hint: "Social influence.", rules: "Used to persuade, deceive, haggle, and lead. High charm opens doors that words alone can open." },
  { key: "luck", label: "Luck", start: 10, max: 50, hint: "Fortune and fate.", rules: "Used when outcomes are pure chance. High luck turns near-misses into miracles." },
  { key: "stealth", label: "Stealth", start: 10, max: 50, hint: "Moving unseen.", rules: "Used to sneak, hide, tail targets, and steal. High stealth goes unnoticed even under watch." },
  { key: "magic", label: "Magic", start: 10, max: 50, hint: "Spell power and control.", rules: "Used to cast, shape, and resist spells. High magic hits harder, lasts longer, and bends stranger forces." },
  { key: "perception", label: "Perception", start: 10, max: 50, hint: "Noticing the world.", rules: "Used to spot hidden things, hear distant sounds, and sense danger. High perception misses nothing." },
  { key: "wisdom", label: "Wisdom", start: 10, max: 50, hint: "Judgment and insight.", rules: "Used to read people, weigh choices, and see through deception. High wisdom chooses well under pressure." },
  { key: "nature", label: "Nature", start: 10, max: 50, hint: "Lore of living things.", rules: "Used to know beasts, plants, and wild places, and to calm or handle animals. High nature thrives outdoors." },
  { key: "history", label: "History", start: 10, max: 50, hint: "Knowledge of the past.", rules: "Used to recall wars, lineages, ruins, and old laws. High history turns the past into leverage." },
  { key: "tech", label: "Tech", start: 10, max: 50, hint: "Operating and repairing technology.", rules: "Used to hack, repair, pilot by wire, and understand machines. High tech keeps gear alive and doors open." },
  { key: "med", label: "Medicine", start: 10, max: 50, hint: "Healing and first aid.", rules: "Used to treat wounds, diagnose illness, and perform surgery. High medicine saves lives that would otherwise be lost." },
  { key: "surv", label: "Survival", start: 10, max: 50, hint: "Wilderness living.", rules: "Used to track, forage, hunt, navigate wilds, and endure the elements." },
  { key: "scav", label: "Scavenging", start: 10, max: 50, hint: "Finding useful scrap.", rules: "Used to search ruins, trash, and battlefields for usable loot. High scavenging finds valuables where others see junk." },
];

export const TRK_PRESETS = [
  { key: "level", label: "Level", icon: "🏅", type: "number", show: "hero", start: 1, max: "", hint: "Power tier.", rules: "The hero\u2019s level; higher levels gate tougher challenges and greater rewards. Increase when exp is full." },
  { key: "exp", label: "Experience", icon: "✨", type: "number", show: "hero", start: 0, max: 100, hint: "Progress to next level.", rules: "Progress toward the next level; at max it resets and level rises. Award it for victories, quests, and breakthroughs." },
  { key: "quest", label: "Objective", icon: "📜", type: "text", show: "header", start: "", max: "", hint: "Current goal.", rules: "The hero\u2019s single current goal, one short phrase. Replace it when completed or abandoned; only one at a time." },
  { key: "location", label: "Location", icon: "📍", type: "text", show: "header", start: "", max: "", hint: "Where the hero is.", rules: "Where the hero currently is. Update whenever the scene moves." },
  { key: "hp", label: "HP", icon: "❤️", type: "number", show: "hero", start: 100, max: 100, hint: "Health.", rules: "The hero\u2019s health; at 0 they are downed. Lose it to enemy hits and hazards; restore it by healing, rest, or potions." },
  { key: "mana", label: "Mana", icon: "🔮", type: "number", show: "hero", start: 100, max: 100, hint: "Magical fuel.", rules: "Magical fuel; at 0 no spells can be cast. Spend it on magic; recover it by rest, crystals, or ley lines." },
  { key: "stamina", label: "Stamina", icon: "⚡", type: "number", show: "hero", start: 100, max: 100, hint: "Short-term exertion.", rules: "Short-term energy for sprinting, fighting, and hard labor; at 0 the hero is exhausted and must rest. Burns fast, recovers with breaks." },
  { key: "rep", label: "Reputation", icon: "⭐", type: "number", show: "hero", start: 0, max: "", hint: "Standing in the world.", rules: "How the world regards the hero; high standing opens alliances and discounts, low standing brings suspicion and closed doors. Moves with public deeds." },
  { key: "gold", label: "Gold", icon: "🪙", type: "number", show: "hero", start: 0, max: "", hint: "Coin on hand.", rules: "The hero\u2019s coin; wealth gates bribes, gear, and services. Gain it from loot, quests, and trade; spend it on supplies and favors." },
  { key: "money", label: "Money", icon: "💵", type: "number", show: "hero", start: 0, max: "", hint: "Modern cash.", rules: "Modern cash on hand; wealth gates bribes, gear, and services. Earn it from jobs, quests, and sales; spend it on supplies and favors." },
  { key: "supplies", label: "Supplies", icon: "🎒", type: "number", show: "hero", start: 5, max: "", hint: "Food and consumables.", rules: "Food, ammo, and consumables; at 0 the party goes hungry. Consume them on the road; restock in towns." },
  { key: "day", label: "Day", icon: "📅", type: "number", show: "header", start: 1, max: "", hint: "Day count.", rules: "How many days have passed since the story began." },
  { key: "dayname", label: "Day Name", icon: "🗓️", type: "text", show: "header", start: "", max: "", hint: "Weekday name.", rules: "The current weekday name (Monday, Tuesday, ...). Can't be empty." },
  { key: "date", label: "Date", icon: "📆", type: "text", show: "header", start: "", max: "", hint: "Calendar date.", rules: "The full calendar date. Update when day changes; festivals, paydays, and deadlines key off it." },
  { key: "time", label: "Time", icon: "🕐", type: "text", show: "header", start: "09:00 AM", max: "", hint: "Time of day.", rules: "The current time of day in this format: 09:00 AM. Advances naturally with the narrative, always move forward." },
];

export const NTRK_PRESETS = [
  { key: "hp", label: "HP", icon: "❤️", type: "number", start: 100, max: 100, hint: "Health.", rules: "The character\u2019s health; Lose it to enemy hits and hazards; restore it by healing, rest, or potions." },
  { key: "relationship", label: "Relationship", icon: "👥", type: "text", start: "", max: "", hint: "Bond with the hero.", rules: "How this character is bonded to the hero (stranger, friend, rival, lover...); the bond gates what they will do for each other. Deepens or breaks with shared trials." },
  { key: "trust", label: "Trust", icon: "🤝", type: "number", start: 50, max: 100, hint: "Faith in the hero.", rules: "How much this character trusts the hero; high trust unlocks secrets and aid, low trust risks betrayal. Moves when the hero keeps or breaks promises." },
  { key: "mood", label: "Mood", icon: "🎭", type: "text", start: "", max: "", hint: "Emotional state.", rules: "Current emotional state; a hostile mood closes dialogue options while a warm one opens them. Shifts with how the hero treats them." },
  { key: "condition", label: "Condition", icon: "🩹", type: "text", start: "healthy", max: "", hint: "Physical state.", rules: "Physical state; while wounded the character fights poorly and needs protection. Worsens on injury, improves with rest and healing." },
  { key: "favor", label: "Favor", icon: "🙏", type: "number", start: 0, max: "", hint: "Debts owed.", rules: "Debts between this character and the hero; positive means they owe the hero. Earn it with aid, spend it to ask hard things." },
  { key: "fear", label: "Fear", icon: "😨", type: "number", start: 0, max: 100, hint: "Fear of the hero.", rules: "How afraid this character is of the hero; high fear forces obedience but kills honesty. Rises with threats and displays of power, fades with kindness." },
  { key: "loyalty", label: "Loyalty", icon: "🛡️", type: "number", start: 50, max: 100, hint: "Devotion to the cause.", rules: "Devotion to the hero\u2019s cause rather than the person; high loyalty holds the line in defeat, low loyalty defects for better offers. Moves with victories, ideals, and pay." },
  { key: "romance", label: "Romance", icon: "💘", type: "number", start: 0, max: 100, hint: "Romantic interest.", rules: "Romantic interest in the hero; high romance opens devotion and jealousy arcs, low closes them. Grows with intimacy and gestures, dies with neglect or cruelty." },
];
