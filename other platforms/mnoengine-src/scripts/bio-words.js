// ==========================================================================
//  BIO WORDS — word pools + rules for the non-AI hero bio randomizer
// ==========================================================================
// Powers the character-creation wizard's "🎲 Randomize" button (see `rollBio`), which fills the
// eight bio fields without calling the AI. This file is the single place to add, reword or
// re-order anything the randomizer can produce — edit the arrays below freely.
//
// How it works
//   1. `detectGenre(world)` reads the world's NAME, TAGS, DESCRIPTION, narrative vibe, scenario
//      and lorebook titles/keywords, then scores every genre's `keywords` against them (a tag
//      match weighs 4, the name 3, description/vibe 2, scenario/lore 1). The highest score wins;
//      if nothing reaches MIN_SCORE the generic SHARED pool is used on its own.
//   2. `rollBio(c, world)` fills the fields. EVERY list — names, surnames, genders, races, ages,
//      jobs, and the "voice" lists (build, hairStyles + hairColors, eyes, marks, clothes, persona, mannerisms,
//      speech, extras) — draws from the genre's own pool PLUS the SHARED pool, with the genre's
//      entries listed twice so they stay ~2x as likely. SHARED is the universal floor under all
//      of them, so a genre block only needs to supply the flavour it wants to add; a genre that
//      omits a list rolls that field from SHARED alone.
//
// Coherence rules
//   * The name always rerolls (both randomizers replace it) and follows the rolled gender
//     (male / female / neutral buckets). `opts.keepName` can hold an existing name instead.
//   * Races with `AGELESS_RACES` roll a centuries-scale age; machine races (`MACHINE_RACES`)
//     roll years since activation instead of a human lifespan.
//   * Appearance is assembled as: build, hair, eyes, [distinguishing mark], then a clothing line.
//   * Picks within a single bio never repeat; extras are deduplicated.
//   * Adult flavour (`ADULT`) is only ever drawn when the world looks NSFW.
//
// Adding a genre: copy any block, give it a unique `id` + `label`, keep the same list names.
// Adding a language/style: extend SHARED — its lines are always in every pool (at half the
// weight of a genre's own), so every world benefits, recognised genre or not.
// ==========================================================================

// Score a genre needs before it is trusted (one tag match = 4, one description hit = 2).
const MIN_SCORE = 4;

// Races whose age should be measured in centuries rather than decades.
const AGELESS_RACES = ["elf", "half-elf", "vampire", "demon", "angel", "fae", "faerie", "dragonborn", "undead", "lich", "nephilim", "cambion", "succubus", "incubus", "werewolf"];
const AGELESS_AGES = [[60, 140], [150, 320], [340, 700], [800, 1400]];

// Races that were built, not born — "age" is time since activation/commissioning.
const MACHINE_RACES = ["android", "robot", "synth", "bioroid", "synthetic", "ai", "cyborg", "full-body cyborg", "automaton", "construct", "replicant"];
const MACHINE_AGES = [[2, 9], [11, 24], [26, 45], [50, 90]];

// Words in a world's tags/description/vibe/name that mark it as adult (unlocks the ADULT pool).
const ADULT_WORDS = ["nsfw", "adult", "erotic", "ecchi", "lewd", "hentai", "explicit", "smut", "sexual", "sex", "porn", "fetish", "bdsm", "harem", "futanari", "milf", "lewdness", "smutty"];

// --------------------------------------------------------------------------
// SHARED — universal / genre-less pools. Mixed into every genre's pools at half weight.
// --------------------------------------------------------------------------
export const SHARED = {
  genders: ["female", "male", "female", "male", "nonbinary"],
  names: {
    female: ["Nadia", "Sasha", "Rin", "Iris", "Kaede", "Yara", "Mira", "Zoë", "Aya", "Lena", "Talia", "Rhea", "Noor", "Ilse", "Maeve", "Suri", "Cleo", "Dagny", "Liora", "Anja", "Paloma", "Senna", "Alba", "Tove", "Imogen", "Liv", "Celia", "June", "Elif", "Sanne", "Petra", "Halima"],
    male: ["Dorian", "Kian", "Ravi", "Silas", "Emil", "Nico", "Tarek", "Jonas", "Isao", "Milo", "Dmitri", "Anders", "Yusuf", "Ezra", "Lars", "Kwame", "Bastian", "Osman", "Tomas", "Otis", "Ruben", "Felix", "Hugo", "Marco", "Idris", "Callum", "Theo", "Marcus", "Jonah", "Samir", "Sten", "Pavel"],
    neutral: ["Ash", "Rune", "Vesper", "Juno", "Sage", "Quill", "Onyx", "Kit", "Wren", "Marlow", "Lux", "Nova", "Sparrow", "Zephyr", "Ilya", "Beck", "Remy", "Tobin", "Ellis", "Harper", "Indigo", "Micah", "Parker", "Emery", "Finley", "Hayden", "Ari", "Lou", "Sam", "Noa", "Charlie", "Jamie"]
  },
  surnames: ["Vale", "Marsh", "Okonkwo", "Halvorsen", "Nakamura", "Adair", "Reyes", "Kovač", "Petrova", "Bright", "Sorrel", "Delacroix", "Mbeki", "Lindqvist", "Calder", "Vance", "Moreau", "Ito", "Bhatt", "Ferrão"],
  races: ["human", "asian", "caucasian", "black", "latina", "middle-eastern", "japanese", "korean", "chinese", "french", "italian", "russian", "mixed-race"],
  ages: [[18, 23], [24, 30], [31, 38], [39, 47], [48, 58], [59, 72]],
  jobs: ["courier", "mechanic", "nurse", "cook", "teacher", "security guard", "clerk", "journalist", "bartender", "student", "freelancer", "civil engineer", "paramedic", "trader", "archivist", "photographer", "private investigator", "warehouse hand", "session musician", "smuggler", "beekeeper", "night-shift janitor"],
  build: ["Lean and wiry", "Broad-shouldered and solid", "Short and compact", "Tall and rangy", "Stocky and thick-limbed", "Athletic with defined arms", "Slight and narrow-framed", "Heavily built with a barrel chest", "Narrow-shouldered with a straight posture", "Round-bellied and heavy-set", "Lanky with long limbs", "Tall with long legs and a short torso", "Short-legged and long-backed", "Wide-hipped and sturdy", "Thick-necked and square-jawed", "Thin with visible collarbones", "Muscular through the shoulders", "Soft around the middle", "Bony with sharp elbows and knees", "Very tall with a stooped posture", "Short with a barrel chest", "Medium height with a swimmer's frame", "Petite with small hands", "Large-framed with broad hips", "Wiry with ropy forearms", "Pale-skinned and freckled", "Dark-skinned with a shaved head", "Olive-skinned with a broad nose", "Tall with a long neck", "Compact with thick thighs"],
  buildFemale: ["Curvy with an hourglass figure","Tall with long legs and a full bust","Petite with a full chest","Voluptuous with wide hips","Athletic with toned curves","Slender with long legs","Busty with a narrow waist","Full-hipped with a narrow waist","Leggy with a dancer's posture","Soft-curved with a generous bust","Toned with an hourglass waist","Willowy with elegant curves","Short and curvy with full hips","Tall and statuesque with striking proportions","Pear-shaped with full hips and a slim top","Top-heavy with a tiny waist","Long-necked with graceful shoulders","Sun-kissed with a toned midriff","Thick-thighed with a round figure","Slim-waisted with an ample chest"],
  hairStyles: ["a {c} buzz cut","a chin-length {c} bob","{c} hair in a tight braid","a {c} ponytail","shoulder-length wavy {c} hair","a messy {c} fringe","short spiky {c} hair","a {c} pixie cut","waist-length straight {c} hair","tight {c} coils cropped short","{c} dreadlocks tied back with cord","{c} hair in two braids","a {c} topknot","a {c} undercut with long top","frizzy shoulder-length {c} hair","slicked-back {c} hair","{c} hair in a loose bun","a {c} fauxhawk","shoulder-length lank {c} hair","{c} hair shaved at the sides and long on top","a centre-parted {c} curtain cut","a shaved head","a bald head with stubble at the sides","a {c} crew cut"],
  hairColors: ["black","dark-brown","chestnut","auburn","copper-red","ginger","straw-blond","platinum-blond","ash-blond","grey","silver-grey","white","salt-and-pepper grey","mousy-brown","black with a platinum streak","brown with blond highlights","black with blue tips","brown fading to copper","blond with dark roots","split-dye black and white","auburn with a copper underdye","grey-streaked black","red with pink tips","two-tone blond and brown"],
  eyes: ["grey eyes, deep-set", "dark-brown round eyes", "pale-blue eyes with lined underlids", "one brown eye and one milky-white eye", "sharp green eyes, close-set", "heavy-lidded amber eyes", "deep-set brown eyes", "pale dishwater-grey eyes", "bright unblinking hazel eyes", "warm brown eyes", "ice-blue wide-set eyes", "narrow dark eyes", "large round green eyes", "small deep-set blue eyes", "gold-flecked brown eyes", "slate-grey hooded eyes", "light-green almond-shaped eyes", "one green eye and one brown eye", "clouded grey-blue eyes", "red-rimmed brown eyes", "pale-grey wide eyes", "black eyes with large pupils", "downturned brown eyes", "upturned green eyes with thick lashes"],
  marks: ["a long scar across one cheek", "ink-stained fingers and a crooked nose", "a half-finished tattoo on the forearm", "a missing fingertip on the left hand", "burn scars climbing the neck", "freckles across nose and shoulders", "a chipped front tooth", "a small birthmark under one eye", "callused palms and a split eyebrow scar", "scarred knuckles", "a thin scar through one eyebrow", "a tattoo sleeve of black linework", "a nose broken and healed crooked", "a cauliflower ear", "a port-wine birthmark on the jaw", "pockmarked cheeks", "a gold-capped front tooth", "a pierced nose and pierced brow", "stretched earlobes with steel tunnels", "a scarred lower lip", "vitiligo patches on the hands", "a mole on the upper lip", "a missing earlobe chunk", "track-mark scars inside one elbow"],
  clothes: ["Wears plain patched work clothes.", "Wears a grey sweater with frayed cuffs.", "Wears a battered canvas jacket with many pockets.", "Wears a long black wool coat and scuffed boots.", "Wears a faded red scarf and a denim jacket.", "Wears polished leather boots and a clean white shirt.", "Wears a rolled-sleeve chambray shirt and brown trousers.", "Wears a black t-shirt, cargo pants and sneakers.", "Wears a brown leather jacket over a grey hoodie.", "Wears a navy peacoat with brass buttons.", "Wears paint-stained overalls and heavy boots.", "Wears a green flannel shirt and ripped jeans.", "Wears a black turtleneck and charcoal slacks.", "Wears a floral print dress and white cardigan.", "Wears a pinstripe suit with a loosened tie.", "Wears a high-visibility vest over a hoodie.", "Wears a leather apron over a thermal shirt.", "Wears a puffer jacket, beanie and gloves.", "Wears a sleeveless denim vest covered in patches.", "Wears white sneakers, black jeans and a windbreaker.", "Wears a long grey cardigan and leggings.", "Wears a canvas trench coat and fingerless gloves.", "Wears a black leather biker jacket and engineer boots.", "Wears a mustard-yellow raincoat and rubber boots."],
  persona: ["Quietly watchful and slow to trust.", "Fiercely loyal once won over.", "Restless — always halfway out the door.", "Dryly funny, and never at the wrong moment.", "Patient to a fault, until they aren't.", "Blunt to the point of rudeness, but rarely wrong.", "Warm and easy, hiding a stubborn streak.", "Anxious underneath a practised calm.", "Relentlessly curious, with poor instincts for self-preservation.", "Steady in a crisis and useless in small talk.", "Generous with everything except apologies.", "Proud, in a way that costs them."],
  mannerisms: ["Chews their lip while thinking.", "Never breaks eye contact until the other person looks away.", "Hums tunelessly when nervous.", "Taps two fingers against their thigh in a rhythm only they know.", "Laughs too loudly, then looks embarrassed about it.", "Always sits with their back to a wall.", "Fidgets with whatever is in reach — a coin, a knife, a strap.", "Studies people's hands while they talk.", "Goes very still and very quiet before saying something difficult."],
  speech: ["Speaks in short, clipped sentences.", "Talks too fast when excited and too slow when afraid.", "Has a habit of ending statements like questions.", "Swears freely and colourfully.", "Uses precise, careful words, as though each one costs something.", "Slips into old sayings and proverbs nobody else recognises.", "Gives people nicknames they did not ask for.", "Repeats the last three words of your sentence back at you when sceptical."],
  extras: ["Keeps a tally of small debts, owed and owing, in a notebook that never leaves their person.", "Cannot swim, and is deeply embarrassed about it.", "Has an estranged sibling somewhere they never talk about.", "Cooks far better than anyone expects.", "Sleeps badly and covers for it with coffee and stubbornness.", "Writes letters to someone who never writes back.", "Keeps a memento of a dead friend, and won't say whose.", "Knows three card games well enough to lose on purpose.", "Sings beautifully and refuses to do it in front of anyone.", "Holds a grudge against an institution rather than a person.", "Adopted a stray animal and pretends it was tactical.", "Keeps a list of places they swear they will never go back to — and keeps going back."]
};

// --------------------------------------------------------------------------
// ADULT — drawn only for worlds that read as NSFW (see ADULT_WORDS / isAdultWorld).
// --------------------------------------------------------------------------
export const ADULT = {
  persona: ["Flirts reflexively, and means about half of it.", "Comfortable in their own skin and makes sure everyone knows it.", "Treats seduction as a tool and plainly enjoys using it.", "Forthright about desire, and impatient with coyness."],
  extras: ["Has a reputation, and does nothing at all to correct it.", "Keeps a small, private bundle of scandalous letters.", "Is cheerfully indiscriminate about who warms their bed.", "Gets restless — and reckless — after too long without company.", "Knows exactly what the town says about them, and finds it funny."]
};

// --------------------------------------------------------------------------
// GENRES — order matters only as a tie-break (earlier wins). `keywords` drive detection.
// --------------------------------------------------------------------------
export const GENRES = [
  {
    id: "fantasy",
    label: "fantasy",
    surnameChance: 0.6,
    keywords: ["fantasy", "medieval", "magic", "magical", "mage", "wizard", "sorcerer", "witch", "sword", "knight", "kingdom", "dragon", "elf", "elven", "dwarf", "dwarven", "orc", "goblin", "tavern", "castle", "quest", "dungeon", "adventurer", "guild", "realm", "rune", "spell", "cleric", "rogue", "bard", "paladin", "throne", "sorcery", "alchemy", "monster", "village elder", "enchanted", "fable", "myth", "prophecy", "chosen one", "dark lord", "necromancer", "familiar", "potion", "crown", "heir", "fairy tale", "high fantasy"],
    names: {
      female: ["Elara", "Seraphine", "Isolde", "Mirabel", "Ysolde", "Rowena", "Aeliana", "Bryn", "Tamsin", "Nyra", "Sylvaine", "Cerys", "Ottilie", "Maelis", "Fiora", "Aldis", "Elowen", "Liora", "Sereia", "Thalassa", "Yllaria", "Vespera", "Ondine", "Faelith", "Morwen", "Liadan", "Astarra", "Bridwen"],
      male: ["Aldric", "Rowan", "Kael", "Bram", "Corvin", "Edric", "Magnus", "Tobias", "Garrick", "Soren", "Lucan", "Dain", "Hadrian", "Perrin", "Florian", "Osric", "Tamric", "Kellach", "Doran", "Emhric", "Galvorn", "Rhydian", "Torvald", "Caspian", "Beric", "Owain", "Cedric", "Alvar"],
      neutral: ["Fen", "Wren", "Rune", "Sorrel", "Vale", "Robin", "Juniper", "Lior", "Nym", "Thistle", "Ash", "Ellery", "Briar", "Clover", "Ember", "Hazel", "Lark", "Moss", "Sage", "Rowen", "Tarn", "Yarrow"]
    },
    surnames: ["Ashwood", "Blackbriar", "Thornfield", "Greymark", "Fenwick", "Ravenscar", "Duskwater", "Ironvale", "Hollowbrook", "Windmere", "Oakhart", "Coldhollow", "Brightwater", "Silvermoor", "of the Hollow"],
    races: ["human", "human", "half-elf", "elf", "dwarf", "halfling", "orc", "half-orc", "gnome", "tiefling", "dragonborn", "beastfolk", "goblin", "cat-kin", "wolf-kin", "lizardfolk", "dragon-kin"],
    ages: [[17, 22], [23, 29], [30, 38], [39, 52], [54, 68]],
    jobs: ["sellsword", "hedge wizard", "apothecary", "tavern keeper", "cartographer", "bounty hunter", "stablehand", "scribe", "temple acolyte", "thief-taker", "beast tracker", "court bard", "blacksmith", "herbalist", "runesmith", "caravan guard", "monster hunter", "court sorcerer", "wandering monk", "gravedigger", "adventurers' guild clerk"],
    build: ["Sun-browned and weathered","Broad with callused hands","Small with sharp elbows","Tall with stooped shoulders","Scarred and wiry","Soft-handed with clean nails","Thick-armed with a barrel chest","Bow-legged","Long-fingered with ink-stained cuticles","Weather-lined with a heavy brow","Short and dense with a thick neck","Pale with chapped hands"],
    hairStyles: ["a long {c} braid with a copper ring","{c} hair shorn on one side","{c} hair hacked to the jaw","{c} hair tied with a leather cord","{c} hair in a knotted plait","{c} hair with a shaved nape","{c} hair in a tight bun","curly {c} hair to the shoulders","{c} stubble","a tonsured scalp with a {c} fringe"],
    hairColors: ["wheat-blond","red","black","brown","grey","straw-blond","dark with a silver forelock","brown with a grey streak"],
    eyes: ["green eyes flecked with gold","grey eyes like river stone","one eye clouded white","amber eyes","pale-grey eyes","hazel eyes, deep-set","dark-brown wide eyes","one green eye and one grey eye","bloodshot blue eyes","narrow dark eyes"],
    marks: ["burn scars up one forearm","a branded mark on the shoulder","a wolf-jaw tattoo on the neck","half of one ear missing","thin white scars across both hands","a scar splitting one lip","a missing front tooth","a tattooed ring around one finger","a notched ear","a scar through the left eyebrow"],
    clothes: ["A patched traveller's coat over dented leather armour.","Soft worn leathers with a spare dagger at the belt.","An ash- and reagent-stained wool robe.","A heavy wool cloak over an undyed tunic.","A chain shirt under a torn tabard.","A fur-lined cloak pinned with iron.","A mud-spattered green tunic and brown hose.","A black doublet with silver buttons.","A patched linen shirt and laced boots.","A hooded russet cloak and fingerless gloves."],
    persona: ["Superstitious in small ways and stubbornly rational in large ones.", "Owes money and pretends not to remember to whom.", "Believes in the gods, quietly and without comfort.", "Dreams of a farm and tells nobody."],
    mannerisms: ["Touches the hilt of a blade when thinking.", "Makes the sign against ill luck without noticing.", "Drinks like someone who has learned to stop just in time."],
    speech: ["Speaks with the careful grammar of a village school and the accent of a farm.", "Says 'we' when they mean 'I'.", "Tells stories in the wrong order and refuses to be corrected."],
    extras: ["Still carries the first coin they ever earned, holed for a string.", "Was apprenticed to someone who vanished without explanation.", "Keeps a bestiary of their own drawings, most of them wrong.", "Is owed a favour by a guild master and is saving it.", "Cannot read, and has become very good at hiding it.", "Won a duel they should have lost and has never understood why."]
  },
  {
    id: "cyberpunk",
    label: "cyberpunk",
    surnameChance: 0.85,
    keywords: ["cyberpunk", "cyber", "neon", "chrome", "hacker", "netrunner", "megacorp", "corporate", "implant", "cyberware", "augmentation", "augment", "android", "cyborg", "dystopia", "dystopian", "slum", "ripperdoc", "street samurai", "ganger", "synth", "plasteel", "datashard", "grid", "black ice", "cyberspace", "hologram", "drone", "surveillance state", "undercity", "night city", "arcology"],
    names: {
      female: ["Vex", "Kira", "Sable", "Nyx", "Kestrel", "Rin", "Teza", "Malai", "Vega", "Zero", "Anya", "Rook", "Jinx", "Lumen", "Sable-9", "Vida", "Nocturne", "Plex", "Suki", "Dara", "Iris-0", "Fade"],
      male: ["Kade", "Roan", "Deacon", "Ivo", "Mako", "Jax", "Cutter", "Nero", "Vic", "Zane", "Rook", "Ansel", "Drex", "Knox", "Sil", "Vanto", "Reyes-9", "Hollow", "Brick", "Sol", "Cipher", "Jaxx"],
      neutral: ["Vex", "Sable", "Zero", "Nyx", "Wraith", "Kilo", "Echo", "Quill", "Nine", "Rook", "Static", "Six"]
    },
    surnames: ["//nullpointer", "Kilobyte", "Ghostline", "Six-Hands", "Coldstart", "Redline", "Deadlock", "Static", "Wirehead", "Cutback", "Deadbolt", "Lowball", "Hotline", "Spinejacker"],
    races: ["human", "cyborg", "human with cyberware", "android", "synth", "gene-tailored human", "uplifted animal", "partial cyborg", "full-body cyborg", "bioengineered human", "neural upload", "AI construct"],
    ages: [[18, 24], [25, 31], [32, 40], [41, 49], [51, 63]],
    jobs: ["netrunner", "ripperdoc", "street samurai", "corporate fixer", "drone rigger", "data broker", "smuggler", "cyberware technician", "bodyguard", "black-market surgeon", "media runner", "ganger", "logistics broker", "bounty recovery specialist", "ex-corp security", "chip forger", "braindance editor"],
    build: ["Chrome-plated along one whole arm","Wiry with subdermal armour at the collarbone","Heavy-set with vat-grown bulk","Small with a narrow frame","Rangy with mismatched prosthetic legs","Tall with a chrome jaw hinge","Thin with cable-thin limbs","Broad with a matt-black exoskeleton spine","Short with oversized prosthetic hands","Pale with scalp ports"],
    hairStyles: ["a {c} scalp buzz with a glowing strand","a shaved head with {c} circuit-trace tattoos","long {c} hair hiding an ear jack","cropped {c} hair with bleached tips","a {c} mohawk","synthetic {c} hair to the waist","a bald head with a glowing nape port","{c} fibre-optic hair extensions","a half-shaved head with a {c} braided top","{c} hair with an undercut shave"],
    hairColors: ["chemical-blue","neon-pink","bleached-white","chrome-silver","acid-green","hot magenta","half-black half-neon split-dye","blue fading to pink","black with fibre-optic tips"],
    eyes: ["matte-black optic eyes","one chrome eye and one brown eye","slit-pupil retinal implants","bruise-ringed drug-dulled eyes","irises flickering with an overlay","glowing amber optics","one missing eye with a capped socket","silver-mirrored eyes","blood-red optic glow","mismatched blue and chrome eyes"],
    marks: ["a diagnostic port at the temple","chrome plating along the jaw","matte utility prosthetic fingers","a round burn scar from a failed chip","slow-scrolling advertising tattoos","a barcode tattoo on the neck","a missing pinky with a capped stump","a data jack behind the ear","LED tattoos along the forearm","an implant seam scar down the arm"],
    clothes: ["A black jacket with one live LED strip.","Cheap mesh layers over an armoured vest.","Coveralls cut into a coat with tools in the pockets.","A torn corporate suit minus the tie.","A reflective silver bomber and cargo pants.","A long vinyl coat with steel-toed boots.","A neoprene bodysuit under a flak vest.","A hi-vis harness over a black hoodie.","A chrome corset over shorts.","A patched greatcoat with optic-camo lining."],
    persona: ["Trusts machines more than people, and knows it.", "Talks about corporations the way other people talk about weather.", "Has already decided how this goes wrong.", "Still believes in something, which is embarrassing and inconvenient."],
    mannerisms: ["Checks their own pulse with an implant before answering a hard question.", "Rolls a datashard across their knuckles.", "Goes offline for a minute at a time and comes back with an answer.", "Never takes the seat facing the door."],
    speech: ["Talks in corporate jargon and street slang in the same breath.", "Calls everyone 'chief' and means it less each time.", "Prices things out loud, constantly, as a nervous tic."],
    extras: ["Owes a ripperdoc more than they will ever earn.", "Has a dead man's ID chip sewn into their boot.", "Cannot remember whether one particular memory is theirs or an implant's.", "Keeps a backup of their own personality and has never been sure it took.", "Has a standing bounty that is small, permanent and personal."]
  },
  {
    id: "scifi",
    label: "sci-fi",
    surnameChance: 0.55,
    keywords: ["sci-fi", "scifi", "science fiction", "futuristic", "starship", "starship crew", "space", "spacecraft", "spaceship", "space station", "orbit", "galaxy", "galactic", "interstellar", "colony", "terraform", "alien", "xeno", "robot", "android", "artificial intelligence", "mech", "mecha", "nanotech", "warp", "hyperspace", "reactor", "asteroid", "planet", "fleet", "cybernetics", "quantum", "FTL", "cryosleep", "clone", "cloning", "psionic", "exosuit", "zero-g", "starfighter", "mothership", "space opera"],
    names: {
      female: ["Ila", "Nadir", "Sena", "Chyou", "Vera", "Anouk", "Solvei", "Priya", "Halley", "Turing-9", "Mira", "Ovelia", "Sable", "Vey", "Lian", "Nox", "Astra", "Chell", "Ivara", "Sorsha", "Ulani", "Vesper"],
      male: ["Cassian", "Bok", "Rhen", "Otto", "Dax", "Soren", "Mikal", "Tenzin", "Halden", "Unit-7", "Pavel", "Nils", "Joren", "Kessler", "Vann", "Doran", "Ilya", "Corso", "Bram", "Toll", "Verik", "Sten"],
      neutral: ["Echo", "Vector", "Sol", "Quill", "Ash", "Seren", "Nine", "Pim", "Kilo", "Lumen", "Orbit", "Rune"]
    },
    surnames: ["Vasquez", "Adeyemi", "Ostrom", "Sokolov", "Hale", "Ncube", "Petrakis", "Yildirim", "Ilves", "Darzi", "Wei", "Argyle", "Kanda", "Moss"],
    races: ["human", "human colonist", "belt-born human", "android", "synth", "gene-tailored human", "uplifted animal", "partial cyborg", "alien", "alien hybrid"],
    ages: [[19, 25], [26, 34], [35, 44], [45, 58]],
    jobs: ["flight engineer", "xeno-surveyor", "ship's medic", "cargo broker", "terraforming technician", "orbital traffic controller", "mech pilot", "systems analyst", "salvage operator", "ai ethicist", "deep-space courier", "reactor tech", "colony agronomist", "security contractor", "asteroid prospector", "comms officer"],
    build: ["Tall and thin with elongated limbs","Short, square and dense-boned","Broad with a shoulder yoke","Slight with scarred wrists","Medium height with a shaved head","Stocky with thick fingers","Long-legged with a narrow waist","Pale with a gaunt face","Dark-skinned with close-cropped hair","Grey-haired with a lined face"],
    hairStyles: ["short {c} hair, helmet-seal cropped","long {c} hair in a regulation knot","a shaved head with a sensor band","{c} hair with a magnetic-clasp ponytail","a {c} buzz cut","{c} hair in a tight coil bun","{c} hair shaved at the temples","shoulder-length straight {c} hair","thinning {c} hair combed flat","a high {c} ponytail"],
    hairColors: ["black","brown","auburn","blond","grey","white","white with a coolant-blue streak","black with a regulation-defying pink stripe"],
    eyes: ["grey eyes with a lens glint","one eye narrowed by a HUD implant","round over-steady grey pupils","catlike night-dilated eyes","pale-blue eyes","dark-brown deep-set eyes","one hazel eye and one prosthetic","bloodshot eyes with dark rings","wide pale-green eyes","narrow black eyes"],
    marks: ["radiation scarring on the forearms","a port at the base of the skull","a freezer burn across one cheek","a barcode tattoo under the collarbone","a scarred-over IV site in the arm","a missing tooth replaced with steel","a white graft patch on the jaw","callused zero-g grip hands","a pale surgical line down the scalp","frostbite-blackened fingertips"],
    clothes: ["Ship coveralls with a dead company's logo.","A radiation-weathered orange parka.","Pressure-suit underlayers with taped seams.","An exo-frame harness over thermals.","A grey station jumpsuit with mission patches.","A patched EVA suit with a cracked visor.","A black flight suit with a shearling collar.","A white lab coat over a jumpsuit.","A padded reactor suit with lead lining.","A sleeveless cargo vest and magnetic boots."],
    persona: ["Stubbornly procedural, even when the procedure is wrong.", "Homesick for somewhere that no longer exists.", "Calm in vacuum and a disaster in a crowded room.", "Convinced the mission matters more than any single person on it."],
    mannerisms: ["Checks the seal on a door twice, always twice.", "Reads gravity readouts out loud without meaning to.", "Talks to equipment by name.", "Counts down under their breath before anything nerve-racking."],
    speech: ["Speaks in checklists and mission-duration times.", "Says 'copy' instead of 'yes'.", "Explains things twice, then apologises for explaining twice."],
    extras: ["Has never stood on a planet's surface.", "Was the only survivor of a survey that officially never happened.", "Keeps a seed vault of plants from a world that is gone.", "Owed a debt to a ship's AI, which is not a sentence that makes sense out loud.", "Has a locket containing exactly eleven grams of home soil."]
  },
  {
    id: "postapoc",
    label: "post-apocalyptic",
    surnameChance: 0.4,
    keywords: ["apocalypse", "apocalyptic", "wasteland", "wastelands", "fallout", "the fall", "ruin", "ruins", "survivor", "survival", "scavenger", "radiation", "mutant", "mutants", "bunker", "collapse", "end of the world", "plague", "zombie", "zombies", "infected", "horde", "outbreak", "bandit", "raider", "overgrown", "the before times", "doomsday", "aftermath", "rubble", "cannibal", "settlement", "geiger", "ashfall", "dust bowl"],
    names: {
      female: ["Wren", "Tessa", "Marisol", "Halle", "Junie", "Ada", "Tova", "Vera", "Nissa", "Kestrel", "Dusty", "Maren", "Leta", "Sable", "Ruthie", "Odessa", "Carin", "Jedda", "Pippa", "Sorrow"],
      male: ["Boone", "Elias", "Cutler", "Oskar", "Ravi", "Dane", "Mose", "Anton", "Hollis", "Kell", "Flint", "Garr", "Huck", "Rye", "Tanner", "Cole", "Ward", "Decker", "Ashford", "Brandt"],
      neutral: ["Rook", "Bug", "Six", "Tin", "Sal", "Birdie", "Patch", "Juniper", "Ash", "Cricket"]
    },
    surnames: ["of the Ridge", "Vance", "Marsh", "Crowder", "Whitlock", "Salazar", "Boone", "Okafor", "Dunn", "Harrow"],
    races: ["human", "human", "irradiated human", "mutant", "gene-scarred human", "late-generation mutant"],
    ages: [[16, 21], [22, 29], [30, 39], [40, 52], [54, 70]],
    jobs: ["scavenger", "water trader", "bunker mechanic", "caravan guard", "doctor of salvaged medicine", "hunter", "radio operator", "farmer of the bad soil", "bounty trapper", "ferryman", "munitions salvager", "walled-town watchman", "roof-runner", "seed keeper"],
    build: ["Sun-scorched and wiry","Broad with heavy bulk","Thin and lean","Covered in badly healed burns","Small and quick-limbed","Tall with a caved chest","Bow-legged with knobby knees","Pale with a shaved scalp","Thick-set with scarred hands","Lanky with rope-veined arms"],
    hairStyles: ["{c} hair bleached bone-pale by the sun","a patchy knife-trimmed {c} beard","{c} hair matted into cords","prematurely grey {c} hair","ash-caked {c} dreadlocks","{c} hair with bald patches","filthy shoulder-length {c} hair","{c} hair in a topknot with a bone pin","singed {c} hair cut to the scalp","a shaved scalp with {c} stubble"],
    hairColors: ["bone-white","sand-blond","dust-brown","grey","black","ash-brown","grey with a singed black patch","brown with sun-bleached tips"],
    eyes: ["permanently squinted eyes","one eye scarred shut","pale colour-leached eyes","darting bloodshot eyes","sand-reddened blue eyes","one brown eye and one grey eye","deep-set eyes in dust-lined sockets","yellowed eyes","narrow green eyes","a milky cataract in one eye"],
    marks: ["a radiation bloom across the neck","laddered scars up one arm","a bite scar on the forearm","fingers lost to frostbite","a slaver-caravan brand","a burn-seamed cheek","a missing ear","a split-lip scar","a tattooed tally on the wrist","a gash scar across the scalp"],
    clothes: ["Layers of wire-repaired salvage cloth.","A gas mask on a strap with a heavy coat.","Tyre-rubber sandals and a tarp poncho.","A stripped uniform with sewn patches.","A tire-tread vest over rags.","A patched greatcoat with a fur collar.","Plastic-sheet rain gear over wool.","A taped football-padded jacket.","A blanket poncho with a rope belt.","Mismatched boots with wrapped ankles."],
    persona: ["Expects the worst and is rarely disappointed or surprised.", "Shares food before it is asked for.", "Hoardes water and lies about it badly.", "Still polite, which everyone finds unsettling.", "Wants, more than anything, to build something that lasts."],
    mannerisms: ["Checks the wind before speaking.", "Never stands in the open.", "Cleans a weapon while talking, as a kind of punctuation."],
    speech: ["Talks about the world before the fall like it was a rumour.", "Says 'we' when describing people who are dead.", "Won't name the dead out loud."],
    extras: ["Knows which ruins are safe and refuses to share the list.", "Has a working lighter, which makes them important.", "Was raised by a group that is no longer around.", "Can read, and it is the strangest thing about them.", "Keeps a photograph of a family they might have invented."]
  },
  {
    id: "supernatural",
    label: "supernatural",
    surnameChance: 0.55,
    keywords: ["vampire", "vampires", "vampiric", "werewolf", "lycan", "lycanthrope", "demon", "demonic", "angel", "witch", "warlock", "occult", "supernatural", "urban fantasy", "fae", "faerie", "fairy", "curse", "cursed", "hunter", "masquerade", "nephilim", "cambion", "succubus", "incubus", "spirit", "bloodline", "rite", "immortal", "shapeshifter", "psychic", "exorcist", "hell", "coven", "grimoire", "ley line", "changeling", "monster hunter"],
    names: {
      female: ["Lilith", "Seren", "Ottoline", "Mireille", "Cass", "Delphine", "Noor", "Talia", "Yseult", "Odile", "Sable", "Beatrix", "Vesper", "Morwen", "Lamia", "Drusilla", "Carmilla", "Belladonna", "Rowan", "Selene", "Anais", "Odette"],
      male: ["Damien", "Lazlo", "Ambrose", "Corvin", "Rafe", "Ilya", "Nikolai", "Sorin", "Emeric", "Tobias", "Gethin", "Cassius"],
      neutral: ["Vesper", "Rune", "Onyx", "Ash", "Bell", "Loire", "Thorne", "Wren", "Corvid", "Halcyon"]
    },
    surnames: ["Blackthorn", "Crowley", "Delacroix", "Vane", "Ashgrove", "Morrigan", "Beaumont", "Lysander", "Duskwood", "Fell", "Ravensworth", "Hollow"],
    races: ["human", "human", "vampire", "half-blood vampire", "werewolf", "witch", "cambion", "fae-touched", "nephilim", "cursed human", "psychic"],
    ages: [[19, 26], [27, 38], [39, 55], [58, 90]],
    jobs: ["hunter", "occult bookseller", "coroner", "exorcist", "cathedral archivist", "medium", "night-shift paramedic", "witch", "coven solicitor", "blood-bond broker", "monster hunter for hire", "funeral director", "psychic consultant for the police"],
    build: ["Fine-boned and very still","Tall, gaunt and pale","Broad and heavy with raw bulk","Slight and compact","Deathly pale with dark temple veins","Tall with long nails","Short with a powerful chest","Willowy with elongated fingers","Hunched with yellowed nails","Flawless-skinned with a dancer's frame"],
    hairStyles: ["glossy {c} hair to the shoulders","long loose {c} hair","a penance-short {c} crop","{c} hair to the waist","raven {c} hair with a widow's peak","slicked {c} hair","{c} hair in a mourning braid","dark {c} hair with a white forelock","wet-look {c} hair","{c} hair in a loose knot"],
    hairColors: ["ink-black","wine-red","silver","raven-black","ash-blond","blood-red","black with a white forelock","dark with silver temples"],
    eyes: ["light-reflecting animal eyes","entirely white eyes","one brown eye and one gold eye","bruise-shadowed eyes","fully black eyes","crimson-irised eyes","pale-grey pupil-less eyes","amber wolf-like eyes","one blue eye and one silver eye","sunken black-ringed eyes"],
    marks: ["a bite scar on the throat","old burn scars shaped like a sigil","black wrist veins","a crescent brand on the palm","an iron burn ring on the collarbone","two puncture scars on the neck","a claw-slash scar on the ribs","elongated canine teeth","a pentacle scar on the chest","a black tongue piercing"],
    clothes: ["An immaculate tailored black suit.","A long black coat with deep pockets.","Pressed church-sale formalwear.","Black gloves with a high collar.","A Victorian mourning dress with lace.","A blood-red lined cape over black.","A white shirt with a black cravat.","A leather corset over a black gown.","A charcoal frock coat with silver clasps.","A black veil with a wool coat."],
    persona: ["Courteous in a way that reads as very old.", "Furious underneath a perfect smile.", "Has decided not to be a monster and has to decide again every day.", "Fascinated by mortals and slightly cruel about it."],
    mannerisms: ["Stops breathing when they are paying attention.", "Never enters a room first.", "Flinches politely at holy water and pretends it's a draft."],
    speech: ["Speaks in old-fashioned constructions that slip out when tired.", "Never uses a contraction when it matters.", "Answers the question underneath the question."],
    extras: ["Has an arranged betrothal they have been avoiding for lifetimes.", "Keeps a written list of the people they have killed, in date order.", "Owes a debt to a creature older than the city.", "Cannot enter a home uninvited and finds it humiliating.", "Is being hunted by someone who was once family."]
  },
  {
    id: "horror",
    label: "horror",
    surnameChance: 0.5,
    keywords: ["horror", "eldritch", "cosmic horror", "haunted", "ghost", "ghostly", "nightmare", "terror", "sanity", "madness", "asylum", "gore", "slasher", "cult", "ritual", "abyss", "cthulhu", "dread", "grotesque", "flesh", "seance", "poltergeist", "wrongness", "the other side", "lovecraft", "lovecraftian", "possession", "exorcism", "body horror", "liminal", "backrooms", "creepypasta", "found footage", "survival horror"],
    names: {
      female: ["Edith", "Marion", "Hester", "Ruth", "Linnea", "Agnes", "Blythe", "Saoirse", "Keziah", "Ottoline", "Mabel", "Harriet", "Lenora", "Vesper", "Mira", "Odette", "Lucinda", "Prue", "Alma", "Wrenley"],
      male: ["Ephraim", "August", "Silas", "Nathaniel", "Lowell", "Ambrose", "Horace", "Gideon", "Corbin", "Erasmus", "Bartholomew", "Cornell", "Edgar", "Ishmael", "Lazarus", "Obadiah", "Thaddeus", "Wesley", "Alistair", "Mortimer"],
      neutral: ["Ash", "Crow", "Wren", "Maud", "Hallow", "Vesper", "Rue", "Lark", "Grim", "Poe"]
    },
    surnames: ["Blackwood", "Ashcroft", "Vane", "Hollis", "Crane", "Merrow", "Wexley", "Graves", "Dunmore", "Crowe", "Lackey", "Fenwick"],
    races: ["human", "human", "kraken-touched", "shadowspawn", "half-ghost", "cursed human", "ghoul", "undead", "madman", "demon-touched", "cultist", "ghast", "wraith", "nightmare-born"],
    ages: [[19, 25], [26, 34], [35, 46], [47, 60], [62, 78]],
    jobs: ["antiquarian", "night watchman", "doctor of a failing asylum", "funeral photographer", "cult deprogrammer", "insurance investigator", "lighthouse keeper", "hospital orderly", "researcher of things best left", "small-town coroner", "clergyman losing the plot"],
    build: ["Skeletally thin","Heavy and soft-fleshed","Tall with stooped shoulders","Slight and shivering-pale","Hollow-cheeked with jutting bones","Swollen-jointed and thin-haired","Bandage-wrapped with one eye showing","Lurching with uneven legs","Corpse-pale with blue lips","Emaciated with a bloated belly"],
    hairStyles: ["thinning {c} hair combed over a bald crown","{c} hair standing at the temples","brittle {c} hair to the waist","a self-cut uneven {c} crop","lank greasy {c} hair","patchy falling-out {c} hair","matted {c} hair","tangled {c} hair","a wild-grown {c} tonsure","wispy thin {c} hair"],
    hairColors: ["grey","white","black","mouse-brown","iron-grey","yellowed-white","grey with scalp showing through","black caked with old blood"],
    eyes: ["over-dilated dark-adapted eyes","unfocused staring eyes","bloodshot eyes with burst vessels","one pupil wider than the other","weeping red-rimmed eyes","sunken eyes in black sockets","filmy blind-white eyes","twitching eyelids over grey eyes","yellow-jaundiced eyes","eyes crusted at the corners"],
    marks: ["a surgical scar down the belly","nicotine-stained fingers","unhealed frostbite on the nose","a handprint-shaped birthmark","stitched gashes on the arms","a sewn-shut mouth scar","a tracheotomy scar","mismatched grafted skin patches","a rope burn around the neck","a missing nose tip"],
    clothes: ["An oversized winter coat in summer.","Institutional grey pyjamas.","A pressed second-hand suit two sizes big.","A yellowed raincoat with torn pockets.","A stained hospital gown under a blanket.","A black funeral suit with ash on the lapels.","A nightgown with muddy bare feet.","A moth-eaten cardigan over rags.","A plastic poncho smeared with mud.","A straitjacket sleeve torn into wraps."],
    persona: ["Believes what they have seen and resents it.", "Endlessly patient in a way that is not quite human.", "Kind, and entirely unable to stop investigating.", "Keeps a diary of things that escape the diary."],
    mannerisms: ["Looks up at corners when entering a room.", "Laughs at precisely the wrong moment.", "Checks behind doors without commentary.", "Falls silent mid-sentence as if listening."],
    speech: ["Speaks very softly and expects to be heard.", "Frames every statement as a question about the weather.", "Recites catalogued details like testimony."],
    extras: ["Keeps a journal of everything they saw, written in code.", "Has not slept properly in eleven years.", "Is the only one who came back.", "Burns candles in every room, even in daylight.", "Sometimes answers to a name that is not theirs."]
  },
  {
    id: "western",
    label: "western",
    surnameChance: 0.65,
    keywords: ["western", "frontier", "cowboy", "cowpoke", "gunslinger", "saloon", "sheriff", "outlaw", "marshal", "prairie", "ranch", "rancher", "bounty", "six-shooter", "homestead", "dust", "tumbleweed", "cattle", "railroad", "bandit", "deputy", "desperado", "posse", "showdown", "high noon", "gold rush", "stagecoach", "desert", "canyon", "spurs", "lasso", "wild west"],
    names: {
      female: ["Cordelia", "Josie", "Bess", "Maggie", "Lou", "Ellie", "Sadie", "Clara", "Nell", "Hattie", "Frankie", "Abigail", "Dorothea", "Pearl", "Adeline", "Willa", "Bonnie", "Loretta", "June", "Opal", "Cora", "Ida"],
      male: ["Clay", "Emmett", "Wyatt", "Silas", "Jesse", "Hollis", "Boone", "Garrett", "Ezekiel", "Dallas", "Rufus", "Colt", "Wade", "Virgil", "Levi", "Amos", "Jasper", "Silvan", "Hoyt", "Eli", "Nolan", "Travis"],
      neutral: ["Frankie", "Jesse", "Marlow", "Dell", "Roy", "Charlie", "Sandy", "Trace"]
    },
    surnames: ["Callahan", "Hollis", "Riggs", "Mercer", "Kane", "Boone", "Darrow", "Whitlow", "Sparks", "Tanner", "Hutch", "Garland", "Slade", "Pike"],
    races: ["human"],
    ages: [[19, 26], [27, 35], [36, 45], [46, 58], [60, 74]],
    jobs: ["bounty hunter", "ranch hand", "sheriff", "saloon keeper", "railroad surveyor", "gunsmith", "circuit preacher", "stagecoach guard", "horse trader", "undertaker", "claim prospector", "card sharp", "deputy", "farrier"],
    build: ["Leathery and lean","Broad with oversized hands","Compact and short-limbed","Stiff-jointed with scarred hands","Sun-reddened and chapped","Bow-legged","Tall with ropy arms","Short with a thick waist","Round-faced and windburned","Grizzled with squint lines"],
    hairStyles: ["lank {c} hair under a sweat-stained hat","a waxed {c} moustache","{c} hair to the collar","a knife-hacked {c} crop","a grey-flecked {c} beard","a {c} chin-curtain beard","a drooping {c} handlebar moustache","grey-flecked {c} sideburns to the jaw","a {c} scalp-lock braid","a shaved scalp with {c} fringe under the hat"],
    hairColors: ["dust-brown","grey","black","tobacco-brown","sand-blond","iron-grey","brown greying at the temples","black with a grey-streaked beard"],
    eyes: ["permanently narrowed horizon eyes","pale eyes in a sun-reddened face","one eye squinted shut","steady grey eyes","dust-reddened brown eyes","one blue eye and one brown eye","deep crow's-footed eyes","watery pale-blue eyes","bloodshot whiskey eyes","small close-set dark eyes"],
    marks: ["a bullet scar under the ribs","rope burns on both palms","a hatband tan line","brand scars on the wrist","a knife scar on the cheek","a missing front tooth","a powder-burn tattoo on the hand","a nose healed sideways","a scarred gun hand","a frostbitten ear edge"],
    clothes: ["A dust-caked duster, chaps and worn hat.","A good wool coat over scuffed boots.","Black head to toe with a silver-banded hat.","Ranch denim with a too-warm coat.","A striped poncho over a union suit.","A buckskin jacket with fringe.","A bowler hat with a sack suit.","A sheepskin vest over flannel.","A calico dress with a sunbonnet.","A brocade vest with a string tie."],
    persona: ["Slow to speak, impossible to hurry.", "Polite until precisely the moment they stop being polite.", "Keeps a code they cannot quite articulate.", "Wants to be left alone and keeps getting involved."],
    mannerisms: ["Spits to one side before answering.", "Rolls a bullet between thumb and forefinger.", "Won't sit with their back to a window."],
    speech: ["Drawls, and lets silences do the work.", "Says 'reckon' and means 'know'.", "Never raises their voice."],
    extras: ["Is carrying someone else's name on a wanted poster.", "Buried a partner and never told the family why.", "Owes a debt to a man who will collect in person.", "Keeps a tin of letters that were never sent.", "Can track a horse over rock."]
  },
  {
    id: "military",
    label: "military",
    surnameChance: 0.7,
    keywords: ["war", "warfare", "wartime", "military", "soldier", "army", "marine", "infantry", "battlefield", "trench", "trenches", "squad", "platoon", "regiment", "mercenary", "pmc", "conflict", "frontline", "front line", "veteran", "combat", "special forces", "artillery", "siege", "occupation", "boot camp", "drill sergeant", "dog tags", "court-martial", "AWOL", "recon", "sniper", "tank", "warship", "enlist"],
    names: {
      female: ["Marta", "Ingrid", "Rae", "Yuki", "Zainab", "Dani", "Petra", "Nadia", "Halima", "Bex", "Corrie", "Anya", "Sofia", "Lena", "Katya", "Farah", "Dessa", "Noor", "Talia", "Vera", "Samira", "Lin"],
      male: ["Anton", "Kwame", "Dmitri", "Hector", "Tobias", "Rafiq", "Jonas", "Mateo", "Viktor", "Emeka", "Sten", "Dorian", "Yusuf", "Anders", "Lars", "Kian", "Emil", "Tarek", "Bastian", "Osman", "Tomas", "Otis"],
      neutral: ["Ash", "Rook", "Kit", "Kade", "Sasha", "Nico", "Remy", "Blue"]
    },
    surnames: ["Novak", "Adeyemi", "Kowalski", "Reyes", "Fischer", "Okafor", "Lindqvist", "Delgado", "Petrov", "Bakker", "Nakamura", "Halloran", "Vasquez", "Mbeki"],
    races: ["human", "human", "human", "augmented soldier", "engineered soldier", "human with combat augments"],
    ages: [[19, 24], [25, 32], [33, 41], [42, 52], [54, 68]],
    jobs: ["squad leader", "combat medic", "sniper", "combat engineer", "intelligence officer", "drill sergeant", "forward observer", "logistics NCO", "mercenary contractor", "military police", "signals operator", "armourer", "helicopter crew chief", "field chaplain"],
    build: ["Hard-muscled with scarred forearms","Wiry with march-hardened legs","Big with a thick neck","Slight with a boxer's nose","Broad with shrapnel-pitted arms","Square-built with tattooed forearms","Tall with a ramrod spine","Short with a heavy brow","Weathered with a stiff knee","Dense with a shaved jaw"],
    hairStyles: ["a regulation {c} cut grown an inch","a nicked {c} scalp shave","a tight {c} braid","a heavy {c} post-service beard","a {c} high-and-tight fade","a shaved head","a short {c} crew cut","{c} hair in a pulled-back bun","{c} stubble over a scarred scalp","a {c} handlebar moustache"],
    hairColors: ["black","brown","blond","grey","auburn","sandy","brown with a shaved scar stripe","black with grey temples"],
    eyes: ["flat appraising eyes","one scarred milky eye","thousand-yard unfocused eyes","quick scanning eyes","steel-grey eyes","bloodshot sleep-starved eyes","one brown eye and one green eye","deep-set eyes under a heavy brow","squinting eyes with sand lines","pale-blue close-set eyes"],
    marks: ["shrapnel scars across the back","a faded unit tattoo","a prosthetic left hand","a hearing aid in one ear","a burn graft on the forearm","a scar splitting the chin","a cauliflower ear","a bullet-graze scar on the scalp","a knife scar on the hand","a chemical burn on the neck"],
    clothes: ["Cast-off fatigues with insignia torn off.","Webbing and weatherproofs over jeans.","A flight jacket with a torn patch outline.","Regulation boots with pressed cargos.","Desert camo with a shemagh.","A navy pea coat with a duffel.","A flak vest over thermal layers.","Jungle fatigues with taped boots.","A dress uniform with ribbon bars.","A poncho liner over PT gear."],
    persona: ["Follows orders only when they deserve it.", "Protective of anyone less dangerous than themselves.", "Won't discuss the war, and won't stop thinking about it.", "Refuses to leave anyone behind, at any cost."],
    mannerisms: ["Checks a weapon's state without looking at it.", "Counts people in a room.", "Wakes completely and instantly alert."],
    speech: ["Speaks in clipped, procedural phrases.", "Uses call-signs instead of names.", "Never says goodbye the normal way."],
    extras: ["Keeps a list of the people who did not make it.", "Has a discharge they would rather nobody read.", "Still writes to a comrade's family every year.", "Suffers night terrors and handles it with silence.", "Cannot sleep in a room with only one exit."]
  },
  {
    id: "historical",
    label: "historical",
    surnameChance: 0.7,
    keywords: ["historical", "history", "victorian", "edwardian", "regency", "georgian", "roman", "rome", "ancient", "antiquity", "crusade", "crusader", "revolution", "napoleonic", "1800s", "1600s", "1700s", "plague doctor", "alchemist", "musketeer", "empire", "colonial", "steamship", "guildsman", "courtesan", "noble house", "renaissance", "pharaoh", "egypt", "egyptian", "aztec", "sparta", "spartan", "gladiator", "byzantine", "ottoman", "mongol", "feudal", "peasant", "king", "queen"],
    names: {
      female: ["Beatrix", "Yuki", "Adelheid", "Constance", "Severine", "Rosalind", "Ottilie", "Hana", "Isabel", "Colette", "Agneta", "Mei", "Genevieve", "Henrietta", "Louisa", "Margot", "Emmeline", "Vivienne", "Clothilde", "Antoinette", "Elodie", "Sabine"],
      male: ["Alastair", "Étienne", "Kenji", "Rupert", "Ignacio", "Cornelius", "Hendrik", "Takeshi", "Barnaby", "Lucien", "Osric", "Sven", "Edmund", "Percival", "Aldous", "Crispin", "Leopold", "Benedict", "Thaddeus", "Gilbert", "Horatio", "Roderick"],
      neutral: ["Claude", "Jules", "Ren", "Ash", "Vero", "Cyr", "Nico", "Sasha", "Kim"]
    },
    surnames: ["Ashby", "Fitzgerald", "Laurent", "Bexley", "Okamoto", "Kinsky", "Devereux", "Sørensen", "Wexford", "Marchetti", "Anselm", "Nakagawa", "Talbot", "Bramley"],
    races: ["human"],
    ages: [[17, 22], [23, 30], [31, 40], [41, 55], [58, 72]],
    jobs: ["ship's surgeon", "private secretary", "courtesan", "spy for the crown", "clockmaker", "field naturalist", "cavalry officer", "lady's companion", "dockhand", "alchemist", "cartographer", "duelist for hire", "apothecary", "samurai without a lord", "press printer", "bookbinder"],
    build: ["Broad with sea-weathered skin","Corseted straight-shouldered","Thin with a scholar's stoop","Strong-handed with rough palms","Stout with a florid face","Willowy with a long neck","Short with swollen knuckles","Tall with a stiff spine","Pockmarked with a heavy jaw","Sallow with ink-stained fingers"],
    hairStyles: ["powdered {c} hair pinned high","{c} hair tied with fraying ribbon","an unfashionably short {c} crop","an elaborately dressed {c} wig","a tarred {c} sailor's queue","{c} hair in a topknot with a pin","a powdered {c} bag wig","a tonsured fringe of {c} hair","oiled {c} ringlets to the shoulders","a {c} periwig"],
    hairColors: ["brown","black","powdered-white","grey","auburn","flaxen","powdered grey with a black ribbon","brown with a powdered top"],
    eyes: ["composed hooded eyes","sharp hazel eyes","pale squinting sailor's eyes","dark eyes under a hat brim","watery grey eyes","one green eye and one clouded eye","close-set brown eyes","large heavily-lidded eyes","bloodshot candlelight eyes","small bright-blue eyes"],
    marks: ["smallpox pitting on the cheeks","ink-stained fingers with a duel scar","rope-burned palms","a fleur-de-lis brand on the shoulder","a powdered beauty mark","a scarred sword hand","a blackened tooth gap","a saddle nose bridge","a wig rash at the hairline","a lead-pale complexion"],
    clothes: ["An impeccably cut but outdated frock coat.","Good cloth gone grey with wear.","A silk waistcoat with tarnished buttons.","A sailor's slops with a good wool coat.","A tricorn hat with a patched cloak.","A brocade gown with a stomacher.","A linen shirt with a stock tie.","A leather jerkin over homespun.","A powdered wig with a black ribbon.","A damask gown with lace cuffs."],
    persona: ["Ambitious, and hiding it behind good manners.", "Believes in reason and is constantly disappointed by people.", "Scandalous, and delighted by the fact.", "Determined to rise above their birth, whatever it costs."],
    mannerisms: ["Takes snuff to buy time in conversation.", "Reads letters twice and then burns them.", "Corrects other people's grammar out of nervousness."],
    speech: ["Speaks in elaborate, formal sentences with a sting inside.", "Quotes poetry at inappropriate moments.", "Uses titles with sarcasm so fine it is undetectable."],
    extras: ["Carries a forged letter of introduction in a hidden pocket.", "Is entangled in a duel that has been postponed twice.", "Has a patron who expects favours in return.", "Keeps a coded journal of everything they overhear.", "Was disinherited and tells the story differently every time."]
  },
  {
    id: "modern",
    label: "modern",
    surnameChance: 0.5,
    keywords: ["modern", "contemporary", "present day", "present-day", "urban", "city", "office", "apartment", "romance", "school", "college", "university", "hospital", "police", "subway", "coffee shop", "bookshop", "mystery", "thriller", "neighbourhood", "commute", "roommate", "band", "small town", "smartphone", "social media", "startup", "podcast", "influencer", "landlord", "nightclub", "karaoke", "supermarket"],
    names: {
      female: ["Mia", "Zoë", "Priya", "Sasha", "Nora", "Amara", "Yuki", "Elena", "Mabel", "Simone", "Tess", "Bea", "Chloe", "Hannah", "Lily", "Grace", "Ava", "Emma", "Olivia", "Ella", "Ruby", "Stella"],
      male: ["Theo", "Marcus", "Kofi", "Daniel", "Hugo", "Samir", "Iker", "Nathaniel", "Otto", "Jonah", "Ruben", "Felix", "Liam", "Noah", "Ethan", "Lucas", "Mason", "Logan", "Caleb", "Owen", "Gabriel"],
      neutral: ["Alex", "Robin", "Sam", "Charlie", "Jamie", "Rowan", "Nico", "Frankie", "Sage", "Ash", "Kit", "Remy"]
    },
    surnames: ["Okafor", "Bianchi", "Nakamura", "Whitfield", "Alvarez", "Brennan", "Haddad", "Novak", "Kaur", "Doyle", "Lindberg", "Osei", "Moretti", "Ferreira"],
    races: ["human"],
    ages: [[18, 23], [24, 30], [31, 39], [40, 49], [50, 62], [65, 78]],
    jobs: ["barista with a degree", "paramedic", "architect", "public defender", "bookshop owner", "ER nurse", "software developer", "bike courier", "secondary school teacher", "freelance photographer", "sous chef", "night-shift security guard", "physiotherapist", "junior copywriter", "dog walker", "municipal clerk"],
    build: ["Soft with desk-work pallor","Trim with an expensive haircut","Round and rosy-cheeked","Lanky with a laptop slouch","Gym-built in a tight t-shirt","Tattoo-sleeved with a shaved head","Short with tattooed knuckles","Tall with acne scars","Willowy with a sharp jaw","Stocky with a shaved head"],
    hairStyles: ["a layered {c} cut","{c} hair with grown-out roots","{c} hair in a boring side part","{c} hair bundled with a pen through it","{c} hair with a faded underdye","{c} hair in a slicked man bun","{c} curtain bangs with highlights","a bleached {c} buzz cut","{c} box braids to the waist","a messy {c} topknot with an undercut"],
    hairColors: ["black","dark-brown","blond","auburn","chestnut","jet-black","blue with pink tips","black with blond roots","split-dye pink and black","copper with a teal underdye"],
    eyes: ["tired screen-squint eyes","bright expressive eyes","flat polite eyes","myopic eyes behind sliding glasses","contact-reddened eyes","hooded eyes with dark circles","wide mascara-heavy eyes","squinting eyes with smile lines","one hazel eye and one brown eye","pale-grey eyes behind thick frames"],
    marks: ["a faded stick-and-poke tattoo","a climbing scar on the shin","a small mole by the mouth","bitten-down nails","a coffee burn on the wrist","a nose ring and cartilage studs","a scar through a lip piercing","a wrist tattoo of a date","acne scars on the jaw","a chipped tooth"],
    clothes: ["Good leather shoes with charity-shop layers.","A commuter jacket carried over one arm.","A sharp blazer over a band tee.","A weather-ready puffer with sneakers.","Scrubs with worn clogs.","A barista apron over flannel.","A hi-vis vest over a hoodie.","A denim jacket with enamel pins.","A black blazer with ripped jeans.","A rain shell with a backpack."],
    persona: ["Warm, overstretched and quietly resentful of it.", "Chronically late and charming about it.", "Practical to a fault, and terrible at taking their own advice.", "Kind in the small ways nobody notices."],
    mannerisms: ["Checks their phone when the silence gets long.", "Over-explains things that were already understood.", "Apologises to furniture."],
    speech: ["Speaks in the flattened idiom of a hundred group chats.", "Never finishes a sentence if they think you've got it.", "Talks in deadlines and train times."],
    extras: ["Is on good terms with an ex who still calls at 2am.", "Has a flat with one room they never open.", "Is being chased by paperwork that has gone feral.", "Keeps a running list of things they are going to start doing Monday.", "Has a standing weekly dinner with people they no longer like.", "Won something once, and can't stop mentioning it."]
  },
  {
    id: "romance",
    label: "romance",
    surnameChance: 0.55,
    keywords: ["romance", "romantic", "dating", "relationship", "heartthrob", "slow burn", "enemies to lovers", "matchmaker", "wedding", "courtship", "fling", "love story", "boyfriend", "girlfriend", "soulmate", "meet-cute", "meet cute", "forbidden love", "love triangle", "second chance", "fake dating", "marriage of convenience", "valentine", "honeymoon"],
    names: {
      female: ["Rosie", "Isla", "Camille", "Delphine", "Mira", "Tali", "Sunny", "Nour", "Bridget", "Esme", "Poppy", "Daisy", "Violet", "Hazel", "Ivy", "Luna", "Stella", "Aurora", "Eden", "Ruby"],
      male: ["Rafael", "Elias", "Sebastian", "Luca", "Theodore", "Idris", "Marcus", "Callum", "Jamie", "Noel", "Julian", "Gabriel", "Dominic", "Xavier", "Tristan", "Oliver", "Henry", "William", "James", "Alexander"],
      neutral: ["Remy", "Jules", "Ari", "Lou", "Sam", "Noa", "Kit", "Wren"]
    },
    surnames: ["Beaumont", "Rossi", "Ferreira", "Ashby", "Nguyen", "Sinclair", "Okafor", "Marchetti", "Delacroix", "Hale"],
    races: ["human"],
    ages: [[19, 24], [25, 31], [32, 40], [41, 52]],
    jobs: ["florist", "wedding chef", "estate agent", "café owner", "romance novelist", "physiotherapist", "vet", "event planner", "bookshop clerk", "bartender", "flight attendant", "garden designer", "matchmaker", "wedding photographer", "cellist"],
    build: ["Softly built with warm skin","Tall with good posture","Athletic with a runner's calves","Curvy with full hips","Broad-shouldered with rolled sleeves","Petite with delicate wrists","Willowy with long legs","Stocky with a bearded jaw","Rosy-cheeked with dimples","Golden-tanned with freckled shoulders"],
    hairStyles: ["{c} hair escaping a loose bun","a polished {c} side part","artfully tousled {c} hair","long {c} hair constantly pushed back","{c} waves","a sleek {c} bob","{c} curls to the shoulders","a {c} pixie cut","{c} hair in a braid crown","sun-streaked {c} waves"],
    hairColors: ["honey-blond","chestnut","auburn","black","chocolate-brown","strawberry-blond","blond with sun-streaked highlights","brown with caramel balayage"],
    eyes: ["sideways-glancing brown eyes","lingering dark eyes","warm brown eyes with long lashes","steady direct eyes","sparkling green eyes","soft grey doe eyes","teasing blue eyes","downcast lidded eyes","laughter-creased eyes","amber eyes under heavy lashes"],
    marks: ["freckles across the nose","a scar on the lip","a tiny tattoo behind the ear","paint-stained hands","a flour burn on the wrist","a dimpled chin","a beauty mark above the lip","a thorn scratch on the cheek","a faded bracelet tan line","a small scar on the knee"],
    clothes: ["A well-cut dress that fits perfectly.","A pressed shirt one size too formal.","Soft knitwear with a tailored coat.","A linen sundress with sandals.","A velvet blazer with dark jeans.","A floral midi skirt with boots.","A cream cable-knit sweater.","A satin slip dress with a cardigan.","A tailored suit with no tie.","A cashmere scarf over a peacoat."],
    persona: ["Guarded, then suddenly all in.", "Terribly good at taking care of everyone but themselves.", "Allergic to serious conversations until they are not.", "Chaotic, generous and hopelessly romantic."],
    mannerisms: ["Smiles sideways when nervous.", "Tucks hair back the moment they notice being looked at.", "Fusses with drinks instead of saying the thing."],
    speech: ["Deflects with humour and a change of subject.", "Says 'I'm fine' in a way that invites argument.", "Speaks carefully when it matters and never otherwise."],
    extras: ["Has sworn off relationships for one calendar year.", "Is secretly finishing a novel nobody knows about.", "Has a person in their past they never got closure from.", "Cannot cook anything that isn't breakfast."]
  },
  {
    id: "isekai",
    label: "isekai",
    surnameChance: 0.35,
    keywords: ["isekai", "reincarnated", "reincarnation", "reborn in another world", "transported to another world", "another world", "game-like world", "status window", "status screen", "game mechanics", "respawn", "cheat skill", "overpowered skill", "summoned hero", "demon lord", "light novel", "otherworld", "otome game", "villainess", "new game plus", "save point", "guild card", "skill appraisal", "level up", "hero party", "demon army"],
    names: {
      female: ["Aria", "Yuna", "Sora", "Mio", "Hina", "Riko", "Airi", "Nene", "Koharu", "Mireille", "Luna", "Stella"],
      male: ["Kazuya", "Ren", "Haruto", "Subaru", "Naoki", "Kaito", "Daichi", "Ryo", "Seiya", "Lloyd", "Cain", "Ars"],
      neutral: ["Yu", "Nao", "Hikari", "Sora", "Ren", "Aoi", "Itsuki", "Nagisa"]
    },
    surnames: ["Suzuki", "Takahashi", "Watanabe", "Yamamoto", "of the Other World", "Godwin", "Ashford", "Belfast"],
    races: ["human", "human", "human", "half-elf", "elf", "beastfolk", "cat-kin", "dwarf", "demon kin", "angel kin", "slime kin", "human with a cheat skill"],
    ages: [[15, 19], [20, 26], [27, 34], [35, 48]],
    jobs: ["otherworld hero", "guild adventurer", "guild receptionist", "potion brewer", "magic academy student", "wandering merchant", "ex-office worker", "ex-student", "kingdom knight", "court mage", "dungeon explorer", "monster tamer", "innkeeper", "blacksmith apprentice", "hero party porter"],
    build: ["Ordinary-looking with unremarkable posture", "Soft from a sedentary former life", "Surprisingly fit for an ex-office worker", "Short with quick nervous energy", "Tall and plain-faced", "Round-cheeked and youthful", "Average height with tired eyes", "Lanky with gamer's pallor", "Compact and energetic", "Small with an oversized backpack"],
    hairStyles: ["messy {c} bedhead", "{c} hair in a low ponytail", "shoulder-length straight {c} hair", "a {c} bob with a hairclip", "unkempt {c} hair", "{c} hair tied with a ribbon", "a {c} side part", "long {c} hair in a braid"],
    hairColors: ["black", "dark-brown", "chestnut", "auburn", "strawberry-blond", "silver-white", "cherry-red", "sky-blue", "mint-green", "lavender"],
    eyes: ["plain brown eyes", "wide curious eyes", "tired office-worker eyes", "bright isekai-protagonist eyes", "heterochromatic red and blue eyes", "gentle drooping eyes", "sharp observant eyes", "sparkling naïve eyes"],
    marks: ["a faint mark on the hand from the summoning circle", "a game-like status tattoo on the wrist", "a small scar from the old world", "a beauty mark under one eye", "faintly glowing veins when casting", "a brand from a slave crest, since removed", "freckles from a childhood in the sun", "a missing button's worth of nothing — eerily unscarred"],
    clothes: ["A starter-town leather armour set, slightly too big.", "A tracksuit from the old world under a cloak.", "A guild-issued green tunic and belt pouch.", "Secondhand robes with patched elbows.", "A school uniform worn under travellers' garb.", "A plain shirt, slacks and an enchanted overcoat.", "A hand-me-down chain shirt and a wooden sword.", "A white-and-gold hero's mantle, still too clean."],
    persona: ["Treats this world like a game and is half right.", "Desperately wants a quiet life and keeps failing at it.", "Collects skills the way other people collect stamps.", "Apologises to monsters before finishing them off."],
    mannerisms: ["Checks an invisible status screen out of habit.", "Tries to open a menu by swiping the air.", "Hoards healing items and never uses them."],
    speech: ["Explains game mechanics nobody else can see.", "Uses old-world slang nobody understands.", "Narrates their own level-ups out loud."],
    extras: ["Remembers the exact moment of the summoning and will describe it unprompted.", "Has a cheat skill they are slightly embarrassed by.", "Keeps a diary comparing this world to video games.", "Is owed a resurrection fee by a goddess and intends to collect.", "Still does morning radio exercises from the old world."]
  },
  {
    id: "cultivation",
    label: "cultivation",
    surnameChance: 0.5,
    keywords: ["cultivation", "cultivator", "xianxia", "wuxia", "jianghu", "qi", "martial arts", "kung fu", "sect", "inner disciple", "outer disciple", "young master", "dao", "tribulation", "nascent soul", "golden core", "foundation establishment", "spirit root", "spiritual root", "dantian", "meridians", "pill refining", "flying sword", "sword cultivator", "ascension", "heavenly realm", "mortal world", "cultivation manual", "body tempering", "qi deviation"],
    names: {
      female: ["Mei", "Lian", "Xue", "Yue", "Fang", "Hong", "Qing", "Yan", "Zhi", "Rou", "Xiang", "Bi"],
      male: ["Wei", "Chen", "Long", "Feng", "Jian", "Tao", "Lei", "Hu", "Ming", "Gang", "Bo", "Kun"],
      neutral: ["Ren", "An", "Ping", "Jing", "Yun", "Zi"]
    },
    surnames: ["Li", "Wang", "Zhang", "Zhao", "Lin", "Xiao", "Ye", "Su", "Bai", "Mo", "Jiang", "Shen"],
    races: ["human", "human", "human", "half-spirit", "spirit beast kin", "demon blooded", "celestial descendant", "reincarnated immortal"],
    ages: [[16, 24], [25, 40], [60, 200], [300, 900]],
    jobs: ["outer sect disciple", "inner sect disciple", "rogue cultivator", "pill refiner", "sword cultivator", "body temperer", "sect errand runner", "spirit beast hunter", "talisman scribe", "tea house keeper", "mortal doctor", "caravan guard", "sect librarian", "herb gatherer", "arena fighter"],
    build: ["Lean with corded muscle", "Tall with a swordsman's posture", "Short with explosive speed", "Broad with iron-hard skin", "Thin to the point of frailty", "Graceful with flowing movement", "Scarred from countless spars", "Pale with dark-ringed eyes from night cultivation"],
    hairStyles: ["long {c} hair in a topknot", "{c} hair bound with a jade pin", "a {c} warrior's ponytail", "shoulder-length loose {c} hair", "a shaved head with a {c} queue braid", "{c} hair half-tied with a ribbon", "severely pulled-back {c} hair", "{c} hair with a headband"],
    hairColors: ["black", "ink-black", "dark-brown", "grey-streaked black", "white", "silver-white", "midnight-blue", "blood-red"],
    eyes: ["sharp sword-like eyes", "calm ancient eyes", "arrogant phoenix eyes", "clear dao-heart eyes", "cold assassin's eyes", "warm naive eyes", "golden cultivation eyes", "one blind eye, milky white"],
    marks: ["a sword scar across the collarbone", "meridian burn marks on the back", "a sect tattoo on the inner wrist", "a cauldron burn on the forearm", "a missing fingertip from a duel", "a lightning-tribulation scar on the shoulder", "callused sword hands", "a jade pendant fused to the skin"],
    clothes: ["A plain grey outer-disciple robe.", "A white inner-disciple robe with cloud patterns.", "A patched blue martial robe and cloth shoes.", "A black rogue-cultivator cloak.", "A green alchemist's robe smelling of herbs.", "A sleeveless training vest and loose trousers.", "A gold-trimmed young-master robe, slightly wine-stained.", "A travel-worn brown robe with a sword on the back."],
    persona: ["Measures everyone by cultivation realm within seconds.", "Speaks of face and fate like weather.", "Cultivates indifference and fails at it.", "Treats manuals as more trustworthy than people."],
    mannerisms: ["Meditates in the early hours wherever they happen to be.", "Tests the weight of every blade they see.", "Bows exactly as deeply as rank requires, no deeper."],
    speech: ["Quotes sect proverbs at inappropriate moments.", "Refers to mortals with unconscious condescension.", "Names their techniques out loud when showing off."],
    extras: ["Was expelled from a sect and never says which.", "Owes a life debt to a spirit beast.", "Keeps a manual everyone says is a fake — it isn't.", "Has failed the same tribulation twice.", "Brews tea better than they fight, which annoys them."]
  },
  {
    id: "pirates",
    label: "pirates",
    surnameChance: 0.45,
    keywords: ["pirate", "pirates", "piracy", "corsair", "buccaneer", "privateer", "high seas", "seven seas", "galleon", "frigate", "sloop", "caravel", "captain", "first mate", "quartermaster", "mutiny", "kraken", "sea monster", "treasure island", "buried treasure", "doubloon", "jolly roger", "shanty", "sea shanty", "navy", "royal navy", "caribbean", "tortuga", "port royal", "the plank", "keelhaul", "parley", "ahoy", "landlubber", "golden age of piracy"],
    names: {
      female: ["Anne", "Mary", "Isobel", "Scarlett", "Delia", "Wren", "Calico", "Morgana", "Sally", "Nell", "Odette", "Fiona"],
      male: ["Jack", "Bartholomew", "Silas", "Davy", "Red", "Flint", "Bones", "Hook", "Maddox", "Pike", "Salty", "Rackham"],
      neutral: ["Storm", "Reef", "Coral", "Dagger", "Lucky", "Piper", "Scully", "Tide"]
    },
    surnames: ["Silver", "Bonny", "Read", "Vane", "Teach", "Avery", "Kidd", "Sparrow", "Driftwood", "Stormcrow", "Blackflag", "Seadog"],
    races: ["human", "human", "human", "sea-touched", "half-siren", "cursed sailor", "merfolk kin", "ghost crewman"],
    ages: [[18, 26], [27, 36], [37, 48], [49, 62]],
    jobs: ["deckhand", "boatswain", "ship's cook", "navigator", "gunner", "powder monkey", "lookout", "ship's surgeon", "quartermaster", "first mate", "captain", "privateer", "smuggler", "treasure hunter", "dockside fence", "tavern wench", "naval officer", "castaway"],
    build: ["Bow-legged with a rolling gait", "Broad with tar-stained hands", "Thin and rope-muscled", "Barrel-chested with a booming laugh", "Short with a sailor's balance", "Tall and weather-beaten", "One-eyed with a patch", "Missing teeth and unbothered"],
    hairStyles: ["{c} hair in a tarred queue", "a {c} bandana over cropped hair", "long salt-matted {c} hair", "a {c} ponytail with beads", "close-cropped {c} hair", "{c} dreadlocks with shells", "a bald head with a {c} beard", "{c} hair under a tricorn"],
    hairColors: ["black", "tar-black", "sun-bleached brown", "salt-and-pepper grey", "red", "ginger", "dark with grey temples", "bleached blond"],
    eyes: ["sea-grey squinting eyes", "one eye, sharp and blue", "salt-reddened eyes", "merry rum-bright eyes", "cold shark eyes", "one glass eye", "deep-set watchful eyes", "laugh-creased brown eyes"],
    marks: ["a peg leg below one knee", "a hook for a left hand", "rope-burn scars on both palms", "a faded anchor tattoo on the forearm", "a powder burn on one cheek", "a missing ear from a duel", "a shark-bite scar on the thigh", "a noose burn around the neck that never quite faded"],
    clothes: ["A salt-stiff coat with brass buttons.", "A striped shirt, sash and cutlass belt.", "A captain's greatcoat with gold epaulettes.", "A canvas smock and tarred trousers.", "A red bandana, open vest and hoop earrings.", "A naval officer's uniform, deserted.", "A patched sailcloth shirt and bare feet.", "An oilskin coat and sou'wester hat."],
    persona: ["Spends coin like the sea provides, which it sometimes does.", "Loyal to the crew, superstitious about everything else.", "Has a price and pretends otherwise.", "Laughs at storms and cries at shanties."],
    mannerisms: ["Spits over the shoulder for luck.", "Taps a rhythm only a crew would know.", "Sights along an imaginary horizon when thinking."],
    speech: ["Calls everyone mate, officers sir, and storms by name.", "Swears in three dead port languages.", "Starts stories with 'there I was' regardless of truth."],
    extras: ["Buried something once and drew three different maps.", "Was marooned and never talks about the month ashore.", "Owes a kraken a favour or possibly is the favour.", "Keeps a parrot that only repeats artillery orders.", "Has a price on their head in four ports and a tab in a fifth."]
  },
  {
    id: "noir",
    label: "noir",
    surnameChance: 0.8,
    keywords: ["noir", "neo-noir", "detective", "private eye", "private investigator", "gumshoe", "hardboiled", "femme fatale", "murder mystery", "whodunit", "crime", "true crime", "1920s", "1930s", "1940s", "1950s", "prohibition", "speakeasy", "jazz age", "great depression", "mob", "mafia", "gangster", "corrupt cop", "alibi", "ransom", "blackmail", "stakeout", "trench coat", "fedora", "smoke-filled office", "film noir"],
    names: {
      female: ["Vivian", "Evelyn", "Dolores", "Rita", "Gloria", "Marlene", "Irene", "Beatrice", "Lola", "Veronica", "Sadie", "Mabel"],
      male: ["Sam", "Philip", "Raymond", "Walter", "Eddie", "Frank", "Lou", "Mickey", "Sal", "Vincent", "Harry", "Cole"],
      neutral: ["Robin", "Charlie", "Alex", "Casey", "Jo", "Max", "Nick", "Pat"]
    },
    surnames: ["Spade", "Marlowe", "Hammer", "Diamond", "Valentine", "Cross", "Slade", "Moreau", "Delacroix", "Vance", "Quill", "Nightingale", "Sterling", "Holloway"],
    races: ["human", "human", "human", "human", "human", "world-weary human", "ex-cop human", "human with a past"],
    ages: [[28, 36], [37, 46], [47, 58], [59, 70]],
    jobs: ["private investigator", "beat cop", "homicide detective", "nightclub singer", "bartender", "news photographer", "court stenographer", "cab driver", "coroner", "defense attorney", "bookie", "speakeasy owner", "cigarette girl", "hotel clerk", "insurance investigator", "morgue attendant"],
    build: ["Sharp-suited with tired eyes", "Rumpled with a five-o'clock shadow", "Small with a big coat", "Tall with a hat pulled low", "Soft around the middle from desk work", "Thin from cigarettes and coffee", "Broad with scarred knuckles", "Elegant with a dangerous posture"],
    hairStyles: ["a {c} finger wave", "slicked {c} hair under a fedora", "a {c} victory roll", "{c} hair in a severe bun", "a {c} pompadour", "short {c} waves with a side part", "{c} hair with a pencil stuck through it", "a {c} marcel wave"],
    hairColors: ["jet-black", "platinum-blond", "chestnut", "auburn", "silver-grey", "dark-brown", "red", "ash-blond"],
    eyes: ["world-weary grey eyes", "kohl-rimmed green eyes", "tired bloodshot eyes", "calculating narrow eyes", "sad bedroom eyes", "sharp cop eyes", "smoke-reddened eyes", "one wandering eye"],
    marks: ["a scar splitting one eyebrow from a bar fight", "nicotine-stained fingers", "a bullet graze on the shoulder", "a faded wedding-ring tan line", "a broken nose healed crooked", "a small scar on the chin", "trembling hands, mostly hidden", "a tattoo from the war, kept covered"],
    clothes: ["A trench coat over a wrinkled suit.", "A bias-cut satin gown with gloves.", "A fedora, raincoat and galoshes.", "A pinstripe suit with a carnation.", "A cigarette-girl uniform with a tray.", "A bartender's apron over shirtsleeves.", "A fur stole over a cocktail dress.", "A cab driver's cap and leather jacket."],
    persona: ["Trusts no one and verifies slowly.", "Has seen the worst of people and still answers the phone.", "Collects other people's secrets as retirement savings.", "Romantic about a past that never existed."],
    mannerisms: ["Lights a cigarette while thinking, whether smoking is allowed or not.", "Tilts the hat brim down when lying.", "Counts exits on entering any room."],
    speech: ["Speaks in similes nobody asked for.", "Calls women 'dame' and trouble 'business'.", "Answers questions with slower questions."],
    extras: ["Keeps a case file they were told to burn.", "Was thrown off the force and never says why.", "Owes a mobster a favour with no expiry date.", "Waters a dead plant in the office out of habit.", "Has a testimony that could end a career — possibly their own."]
  },
  {
    id: "steampunk",
    label: "steampunk",
    surnameChance: 0.7,
    keywords: ["steampunk", "victorian", "clockwork", "steam-powered", "steam power", "airship", "dirigible", "zeppelin", "brass", "copper", "goggles", "gaslamp", "gaslight", "aether", "automaton", "difference engine", "analytical engine", "tesla", "inventor", "tinkerer", "gadgeteer", "factory", "foundry", "coal", "boiler", "locomotive", "penny-farthing", "corset", "top hat", "brass goggles"],
    names: {
      female: ["Ada", "Clara", "Imogen", "Beatrice", "Cordelia", "Evangeline", "Florence", "Harriet", "Lavinia", "Prudence", "Theodora", "Winifred"],
      male: ["Edgar", "Cornelius", "Ambrose", "Thaddeus", "Percival", "Archibald", "Barnaby", "Chester", "Edmund", "Horace", "Phineas", "Rupert"],
      neutral: ["Alex", "Charlie", "Emery", "Finley", "Harper", "Kit", "Rowan", "Sage"]
    },
    surnames: ["Brasswick", "Copperfield", "Gearhart", "Steamwright", "Boilerplate", "Cogsworth", "Fitting", "Piston", "Rivets", "Smokestack", "Valve", "Whistlewick"],
    races: ["human", "human", "human", "clockwork-augmented human", "automaton", "half-construct", "aether-touched", "uplifted ape"],
    ages: [[19, 27], [28, 38], [39, 52], [53, 68]],
    jobs: ["airship pilot", "engine mechanic", "inventor", "tinkerer", "factory inspector", "aether researcher", "clockmaker", "locomotive engineer", "sky pirate", "scrap merchant", "telegram operator", "chimney sweep", "botanist", "cartographer of the skies", "patent clerk"],
    build: ["Soot-smudged with singed eyebrows", "Tall with oil-stained cuffs", "Short with powerful forearms", "Thin with spectacles and ink stains", "Broad with a boiler-man's shoulders", "Small with nimble fingers", "Pale from years below decks", "Sturdy with a brass-braced leg"],
    hairStyles: ["{c} hair under brass goggles", "a severe {c} bun with gear pins", "{c} mutton-chop whiskers", "a {c} handlebar moustache", "{c} hair in a practical plait", "wild {c} inventor hair", "a neat {c} side part", "{c} ringlets under a bonnet"],
    hairColors: ["dark-brown", "black", "grey", "silver-grey", "auburn", "copper-red", "straw-blond", "white"],
    eyes: ["goggle-ringed pale eyes", "sharp inventor's eyes", "soot-rimmed dark eyes", "one magnifier-lens eye", "kind tired eyes", "ambitious gleaming eyes", "squinting boiler-room eyes", "mismatched grey and green eyes"],
    marks: ["a burn scar in the shape of a gear", "oil permanently under the fingernails", "a missing fingertip from a press", "a scald scar up one forearm", "a monocle tan line", "a patched-together prosthetic finger", "a tattoo of an airship schematic", "a limp from a boiler explosion"],
    clothes: ["A leather apron over a waistcoat with too many pockets.", "A brass-buttoned frock coat and top hat.", "A corset over a bustle skirt with goggles on top.", "An oil-stained boiler suit with a tool belt.", "A pilot's leather jacket, scarf and cap.", "A tweed suit with a slide rule in the pocket.", "A maid's uniform modified with holsters.", "A greatcoat with glowing aether filaments."],
    persona: ["Believes any problem yields to enough pressure.", "Patents first, apologises never.", "Romantic about machines, practical about people.", "Keeps a rival inventor's failures in a scrapbook."],
    mannerisms: ["Winds something while thinking — a watch, a key, a toy.", "Pushes goggles up onto the forehead when excited.", "Taps pipes to judge their thickness by ear."],
    speech: ["Measures time in boiler pressures.", "Calls people by their trade, never their name.", "Explains inventions at length to anyone stationary."],
    extras: ["Owns a patent that earns exactly enough to cause trouble.", "Built something that escaped and pretends it didn't.", "Owes a sky pirate captain a life debt.", "Keeps a failed automaton head as a paperweight.", "Has blueprints for something the Crown would kill for."]
  },
  {
    id: "viking",
    label: "viking",
    surnameChance: 0.4,
    keywords: ["viking", "vikings", "norse", "norse mythology", "scandinavia", "ragnarok", "valhalla", "jarl", "longship", "longhouse", "fjord", "odin", "thor", "loki", "freyja", "runestone", "skald", "shieldmaiden", "berserker", "ulfberht", "danegeld", "norse gods", "yule", "mead hall", "dragon ship", "iceland", "greenland", "valkyrie"],
    names: {
      female: ["Astrid", "Freya", "Ingrid", "Sigrid", "Liv", "Solveig", "Yrsa", "Thyra", "Gudrun", "Bodil", "Sif", "Ran"],
      male: ["Ragnar", "Bjorn", "Erik", "Leif", "Torsten", "Hakon", "Sigurd", "Ivar", "Sten", "Ulf", "Harald", "Floki"],
      neutral: ["Embla", "Ask", "Siv", "Njal", "Kari", "Vigdis"]
    },
    surnames: ["Eriksdottir", "Ragnarsdottir", "Bjornsson", "Haraldsson", "Sigurdsson", "Leifsson", "of Skara", "of the Fjord", "Bloodaxe", "Ironside"],
    races: ["human", "human", "human", "half-giant", "touched by the gods", "berserker-blooded", "dwarf friend", "volva-blooded"],
    ages: [[17, 25], [26, 35], [36, 48], [49, 64]],
    jobs: ["shieldmaiden", "berserker", "skald", "runecarver", "shipwright", "fisher", "goatherd", "blacksmith", "volva", "trader", "explorer", "jarl's guard", "hunter", "weaver", "mead brewer"],
    build: ["Broad with frost-reddened cheeks", "Tall with rope-burned hands", "Thick-necked with a barrel chest", "Lean and wolf-quick", "Short with immense shoulders", "Weather-lined with pale eyes", "Huge with a booming laugh", "Wiry with a sailor's balance"],
    hairStyles: ["{c} hair in warrior braids", "a {c} beard with iron rings", "{c} hair shaved at the sides", "a long {c} plait down the back", "{c} hair with a leather band", "a {c} topknot", "wild wind-tangled {c} hair", "a {c} beard in two braids"],
    hairColors: ["straw-blond", "red", "copper-red", "dark-blond", "brown", "black", "grey", "white"],
    eyes: ["pale ice-blue eyes", "grey sea eyes", "one eye, sacrificed-sharp", "storm-dark eyes", "laughing blue eyes", "flint-grey hard eyes", "green fjord eyes", "snow-blind white eyes"],
    marks: ["a missing eye, given for wisdom or lost to an axe", "ritual scars on the forearms", "a raven tattoo across the back", "a split lip from a holmgang", "frostbite-blackened fingertips", "a broken nose from shield work", "a slave brand, burned over", "a Thor's hammer scarred into the chest"],
    clothes: ["A fur cloak over a wool tunic and iron brooches.", "A mail shirt with a round shield on the back.", "A sealskin coat and walrus-ivory toggles.", "A thrall's plain tunic and rope belt.", "A volva's blue cloak with a staff.", "A trader's fine cloak with silver arm rings.", "A berserker's bearskin with nothing under it.", "A sea-cloak stiff with salt and a helmet."],
    persona: ["Laughs at death and haggles over everything else.", "Believes the gods watch and behaves accordingly.", "Keeps oaths like grudges and grudges like oaths.", "Wants a good story more than a long life."],
    mannerisms: ["Touches an amulet before any decision.", "Sizes up doorframes out of habit.", "Drinks to the fallen before drinking to the living."],
    speech: ["Speaks in kennings half the time.", "Boasts first, apologises in verse.", "Names their weapons and introduces them."],
    extras: ["Was given to the sea once and the sea gave them back.", "Owes weregild nobody has come to collect.", "Carved their own runestone and got the spelling wrong.", "Has sworn to die somewhere specific and keeps missing.", "Knows a verse that ends every argument — by starting a fight."]
  },
  {
    id: "samurai",
    label: "samurai",
    surnameChance: 0.6,
    keywords: ["samurai", "ronin", "shogun", "shogunate", "edo", "edo period", "katana", "bushido", "daimyo", "seppuku", "kimono", "geisha", "ninja", "shinobi", "dojo", "sensei", "sake", "torii", "shrine", "warring states", "sengoku", "kyoto", "bakufu", "sumo", "tea ceremony", "sakura", "mount fuji", "chanbara", "jidaigeki", "kabuki"],
    names: {
      female: ["Yuki", "Hana", "Aya", "Keiko", "Sakura", "Mieko", "Tomoe", "Rin", "Setsuko", "Kiku", "Chiyo", "Fumiko"],
      male: ["Kenji", "Takeshi", "Hiro", "Sora", "Daichi", "Jiro", "Kaito", "Ren", "Shin", "Isamu", "Yoshiro", "Tadashi"],
      neutral: ["Akira", "Kai", "Nao", "Hikaru", "Shou", "Rei"]
    },
    surnames: ["Tanaka", "Yamamoto", "Sato", "Watanabe", "Kobayashi", "Matsumoto", "Hayashi", "Shimizu", "Fujiwara", "Takeda", "Miyamoto", "Oda"],
    races: ["human", "human", "human", "human", "kitsune kin", "tengu blooded", "cursed swordsman", "spirit touched"],
    ages: [[17, 25], [26, 36], [37, 52], [53, 70]],
    jobs: ["ronin", "clan samurai", "dojo instructor", "yojimbo", "tea master", "sake brewer", "ink painter", "kabuki actor", "sumo wrestler", "shrine keeper", "courtesan", "paper maker", "sword polisher", "fire watchman", "itinerant monk"],
    build: ["Compact with perfect posture", "Tall with a swordsman's reach", "Thin with callused hands", "Broad with a wrestler's bulk", "Small with blinding speed", "Straight-backed with measured steps", "Scarred with a missing finger joint", "Pale with ink-stained fingers"],
    hairStyles: ["a {c} topknot", "{c} hair in a Shimada style", "a shaved pate with a {c} queue", "long loose {c} ronin hair", "{c} hair bound with a cord", "a {c} bob with a hairpin", "close-cropped {c} hair", "{c} hair under a straw hat"],
    hairColors: ["black", "ink-black", "dark-brown", "grey", "silver-white", "blue-black", "brown with grey temples", "dyed auburn"],
    eyes: ["still pond eyes", "sharp duellist's eyes", "downcast disciplined eyes", "merry sake-bright eyes", "cold magistrate's eyes", "one scarred-shut eye", "large earnest eyes", "heavy-lidded judging eyes"],
    marks: ["a missing fingertip from an oath", "a duelling scar on the cheek", "burn scars from a fire watch", "a clan crest tattooed on the shoulder", "a broken nose from the dojo", "ink-stained hands to the wrist", "a seppuku scar that never happened — a story for drink", "a shaved eyebrow regrown crooked"],
    clothes: ["A patched kimono with two swords at the hip.", "A formal black montsuki with clan crests.", "A travel-worn yukata and straw sandals.", "A fireman's quilted coat and hood.", "A courtesan's layered silk kimono.", "A monk's grey robe and begging bowl.", "A sumo mawashi and a topknot.", "A rain cape of straw over plain cotton."],
    persona: ["Polite to enemies, honest with friends, rare with both.", "Follows a code nobody else can see.", "Has already died once, socially.", "Treats every meal like it might be the last good one."],
    mannerisms: ["Bows to inanimate objects out of habit.", "Checks both sword hilts when entering a room.", "Sits seiza even where no one requires it."],
    speech: ["Speaks in old forms to mock or to honour.", "Quotes the Hagakure at the worst moments.", "Apologises elaborately for other people's failures."],
    extras: ["Carries a sword they have sworn never to draw.", "Was adopted into a clan and adopted out of it.", "Owes a tea master an unpayable debt of teaching.", "Lost a duel on purpose and tells no one why.", "Keeps a poem that explains everything, folded small."]
  },
  {
    id: "cozy",
    label: "cozy",
    surnameChance: 0.55,
    keywords: ["cozy", "cosy", "slice of life", "iyashikei", "wholesome", "bakery", "café", "cafe", "flower shop", "village life", "farming", "cottagecore", "cottage", "tea shop", "bed and breakfast", "starting over", "retired adventurer", "slow living", "harvest", "farmers market", "seaside town", "pen pal", "warm", "gentle", "heartwarming"],
    names: {
      female: ["Poppy", "Daisy", "Wren", "Maple", "Clover", "Juniper", "Hazel", "Ivy", "Rosemary", "Sage", "Willow", "Bramble"],
      male: ["Ash", "Rowan", "Cedar", "Forrest", "Hollis", "Jasper", "Milo", "Oliver", "Reed", "Sorrel", "Tansy", "Alder"],
      neutral: ["Robin", "Sam", "Alex", "Jamie", "Noa", "Kit", "Ember", "Lark"]
    },
    surnames: ["Appleby", "Thistledown", "Honeycutt", "Barleycorn", "Meadowsweet", "Puddifoot", "Weatherby", "Fernside", "Copperkettle", "Dunmore"],
    races: ["human", "human", "human", "halfling", "gnome", "retired hero", "witch", "beastfolk"],
    ages: [[20, 29], [30, 42], [43, 58], [59, 74]],
    jobs: ["baker", "café owner", "bookshop clerk", "florist", "beekeeper", "lighthouse keeper", "retired adventurer", "tea blender", "knitter", "post carrier", "gardener", "cheesemaker", "innkeeper", "fisherman", "candlemaker", "mushroom forager"],
    build: ["Round and flour-dusted", "Tall with kind hands", "Short with a floury apron", "Soft with laugh lines", "Sturdy with garden muscles", "Thin with paint-spattered sleeves", "Rosy-cheeked and warm", "Small with quick capable hands"],
    hairStyles: ["{c} hair in a messy bun", "a {c} braid over one shoulder", "{c} curls escaping a scarf", "short practical {c} hair", "{c} hair with a pencil through it", "a {c} bob with flour in it", "long {c} hair in a kerchief", "a {c} ponytail with a ribbon"],
    hairColors: ["chestnut", "auburn", "honey-blond", "grey", "silver-white", "strawberry-blond", "dark-brown", "copper-red"],
    eyes: ["warm crinkled eyes", "kind brown eyes", "twinkling green eyes", "soft grey eyes", "laughing blue eyes", "gentle drooping eyes", "bright curious eyes", "tea-brown eyes"],
    marks: ["flour permanently under the fingernails", "a burn scar from the oven door", "soil under every nail", "a bee-sting scar on one hand", "a faded scar from an old adventure", "freckles across the nose", "a chipped tooth from olive pits", "a tattoo of a teapot, done young"],
    clothes: ["A floury apron over a patched dress.", "A chunky knit sweater with elbow patches.", "A canvas gardening apron and boots.", "A soft cardigan with tea stains.", "Rolled sleeves and a pencil behind the ear.", "A fisherman's smock smelling of salt.", "A flower crown worn unironically.", "A hand-knit scarf in clashing colours."],
    persona: ["Believes no problem survives tea and attention.", "Remembers everyone's orders and half their troubles.", "Retired from danger, excellent at comfort.", "Treats strangers like neighbours-in-waiting."],
    mannerisms: ["Presses food on anyone standing still.", "Hums while kneading, sweeping, shelving.", "Waves at every passing boat, cart and cloud."],
    speech: ["Calls everyone 'love' regardless of age.", "Refers to the weather as a personal friend.", "Ends bad news with a recipe."],
    extras: ["Never locks the door and has never needed to.", "Won a pie contest three years running and retired undefeated.", "Keeps a chair nobody sits in, for somebody.", "Writes the village newsletter under three pen names.", "Once saved the world and will not elaborate."]
  }
];

// --------------------------------------------------------------------------
// Detection + rolling — the rules. (Words live in the pools above.)
// --------------------------------------------------------------------------

// The world text the genre scanner reads, as four weighted layers. Tag matches count most.
function worldScan(world) {
  const w = world || {};
  const meta = w.meta || {};
  const tags = (Array.isArray(meta.tags) ? meta.tags : []).map((t) => String(t).toLowerCase());
  const lore = (Array.isArray(w.lorebook) ? w.lorebook : []).map((e) => [e && e.title, e && Array.isArray(e.keywords) ? e.keywords.join(" ") : ""].filter(Boolean).join(" "));
  return {
    tags,
    name: String(meta.name || "").toLowerCase(),
    mid: [meta.description, w.narrativeVibe].filter(Boolean).join("\n").toLowerCase().slice(0, 4000),
    deep: [w.scenario, w.start, ...lore].filter(Boolean).join("\n").toLowerCase().slice(0, 6000)
  };
}

const escRe = (kw) => kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Occurrences of `kw` in `text`, tolerant of simple plurals/verb endings, capped at `cap`.
function hits(text, kw, cap) {
  if (!text) return 0;
  const re = new RegExp("\\b" + escRe(kw) + "(?:s|es|ed|ing)?\\b", "g");
  const n = (text.match(re) || []).length;
  return cap ? Math.min(n, cap) : n;
}

// True when the world reads as adult (tag/description/vibe/name mention).
export function isAdultWorld(world) {
  const w = world || {};
  const meta = w.meta || {};
  if (meta.nsfw === true) return true; // the author-declared rating is the source of truth
  const tags = (Array.isArray(meta.tags) ? meta.tags : []).map((t) => String(t).toLowerCase()).join(" ");
  const text = [tags, meta.name, meta.description, w.narrativeVibe].filter(Boolean).join("\n").toLowerCase().slice(0, 4000);
  return ADULT_WORDS.some((w2) => hits(text, w2) > 0);
}

// Best-matching genre for a world: `{ id, label, score }` (score 0 + id "neutral" when nothing fits).
export function detectGenre(world) {
  const scan = worldScan(world);
  let best = { id: "neutral", label: "generic", score: 0 };
  for (const g of GENRES) {
    let score = 0;
    for (const kw of g.keywords) {
      for (const tag of scan.tags) {
        if (tag === kw) score += 4;
        else if (tag.includes(kw)) score += 3;
      }
      score += 3 * hits(scan.name, kw);
      score += 2 * hits(scan.mid, kw, 2);
      score += 1 * hits(scan.deep, kw, 2);
    }
    if (score > best.score) best = { id: g.id, label: g.label, score };
  }
  if (best.score < MIN_SCORE) return { id: "neutral", label: "generic", score: best.score };
  return best;
}

// --------------------------------------------------------------------------
// Pickers
// --------------------------------------------------------------------------
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (list) => (Array.isArray(list) && list.length ? list[rnd(list.length)] : "");
function pickN(list, n) {
  const pool = [...new Set((Array.isArray(list) ? list : []).filter(Boolean))];
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(rnd(pool.length), 1)[0]);
  return out;
}

// A genre list mixed with SHARED: the genre's own entries appear twice, so they stay ~2x as likely
// as the universal SHARED lines, which are always in the running. A genre with no such list rolls
// that field from SHARED alone.
function mixed(g, key) {
  const gl = (g && g[key]) || [];
  const sl = SHARED[key] || [];
  return gl.length ? gl.concat(gl, sl) : sl.slice();
}

// The same mix, per name bucket (`names` is an object of three arrays rather than one flat list).
function mixedNames(g, bucket) {
  const gn = (g && g.names && g.names[bucket]) || [];
  const sn = (SHARED.names && SHARED.names[bucket]) || [];
  return gn.length ? gn.concat(gn, sn) : sn.slice();
}

const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

// --------------------------------------------------------------------------
// The roll
// --------------------------------------------------------------------------

// Age rules: ageless races get centuries, machine races get years in service, everyone else a
// human-ish lifespan drawn from the genre + SHARED age bands.
function rollAge(g, race) {
  const r = String(race || "").toLowerCase();
  if (AGELESS_RACES.some((x) => r.includes(x))) return pickBand(AGELESS_AGES);
  if (MACHINE_RACES.some((x) => r.includes(x))) return pickBand(MACHINE_AGES);
  return pickBand(mixed(g, "ages"));
}
const pickBand = (bands) => {
  const b = pick(bands);
  if (!Array.isArray(b)) return 30;
  return b[0] + rnd(b[1] - b[0] + 1);
};

// First name from the bucket matching the rolled gender (genre + SHARED names, any bucket as a
// fallback), plus an optional surname/handle.
function rollName(g, gender) {
  const bucket = (gender === "male" || gender === "female") ? gender : "neutral";
  let pool = mixedNames(g, bucket);
  // Nobody fills this bucket (neither the genre nor SHARED): draw from every bucket that has names.
  if (!pool.length) pool = ["female", "male", "neutral"].flatMap((b) => mixedNames(g, b));
  const first = pick(pool);
  const chance = typeof g.surnameChance === "number" ? g.surnameChance : 0.55;
  if (!first || Math.random() > chance) return first;
  const surnames = mixed(g, "surnames");
  return surnames.length ? `${first} ${pick(surnames)}` : first;
}

// Build, hair, eyes, [distinguishing mark], then a clothing line.
function rollHair(g) {
  const style = pick(mixed(g, "hairStyles"));
  if (!style) return "";
  if (style.indexOf("{c}") === -1) return style;
  const colors = mixed(g, "hairColors");
  const treated = /underdye|grown-out roots|bleached|streak|sun-streaked|highlights/i.test(style);
  const isMulti = (s) => /split-dye|two-tone|fading|roots|tips|highlights|underdye|streak|balayage| with /i.test(s);
  let color = pick(colors) || "dark";
  for (let i = 0; treated && isMulti(color) && i < 6; i++) color = pick(colors);
  if (treated && isMulti(color)) { const singles = colors.filter((s) => !isMulti(s)); if (singles.length) color = pick(singles); }
  return style.split("{c}").join(color);
}

function rollBuild(g, gender) {
  const pool = mixed(g, "build");
  if (gender === "female") {
    const fp = mixed(g, "buildFemale");
    if (fp.length) return pick(pool.concat(fp, fp));
  }
  return pick(pool);
}

function rollAppearance(g, gender) {
  const frags = [rollBuild(g, gender), rollHair(g), pick(mixed(g, "eyes"))];
  if (Math.random() < 0.65) frags.push(pick(mixed(g, "marks")));
  const parts = frags.filter(Boolean);
  const look = parts.length ? cap(parts[0]) + parts.slice(1).map((s) => ", " + s).join("") : "";
  const clothes = pick(mixed(g, "clothes"));
  return [look ? look + "." : "", clothes].filter(Boolean).join(" ");
}

// One or two personality lines + a mannerism + a speech habit.
function rollPersona(g, adult) {
  const traits = pickN(mixed(g, "persona"), Math.random() < 0.45 ? 2 : 1);
  const parts = [...traits, pick(mixed(g, "mannerisms")), pick(mixed(g, "speech"))];
  if (adult && Math.random() < 0.3) parts.push(pick(ADULT.persona));
  return parts.filter(Boolean).join(" ");
}

// One or two background lines (never duplicated), plus adult flavour in adult worlds.
function rollExtra(g, adult) {
  const parts = [pick(mixed(g, "extras"))];
  if (Math.random() < 0.45) parts.push(pick(mixed(g, "extras")));
  if (adult && Math.random() < 0.35) parts.push(pick(ADULT.extras));
  return pickN(parts, parts.length).join(" ");
}

// Fill the eight bio fields of `c` without the AI. The name is rolled too; pass `opts.keepName`
// to hold whatever name is already set instead. Returns a summary of what was rolled.
export function rollBio(c, world, opts = {}) {
  const det = detectGenre(world);
  const g = GENRES.find((x) => x.id === det.id) || {};
  const adult = isAdultWorld(world);
  const typedName = String(c.name || "").trim();
  const keepName = !!opts.keepName;

  const gender = pick(mixed(g, "genders"));
  const race = pick(mixed(g, "races"));
  c.name = keepName && typedName ? typedName : rollName(g, gender);
  c.gender = gender;
  c.race = race;
  c.age = String(rollAge(g, race));
  c.job = pick(mixed(g, "jobs"));
  c.appearance = rollAppearance(g, gender);
  c.persona = rollPersona(g, adult);
  c.extra = rollExtra(g, adult);
  return { genre: det.id, label: det.label, score: det.score, adult, keptName: !!(keepName && typedName) };
}
