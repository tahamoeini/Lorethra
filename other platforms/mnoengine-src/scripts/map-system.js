import { keywordLoreForText } from "./lorebook.js";
import { subUser, heroNameOf } from "./text-utils.js";

// Map system: builds the minimap of Points of Interest (POIs) around the hero's current location.
// A dedicated non-narrator AI call generates the surrounding POIs (name, type, icon, bearing +
// distance, description). The POI vocabulary is deliberately NOT fixed: the mapmaker AI reads the
// lore and recent story, infers the world's setting (fantasy, sci-fi, modern, historical — whatever
// the story is), and picks place types and emoji icons that fit it, so the same engine maps any
// genre. The app caches POIs per location (state.mapCache) so returning to a place shows the same
// map instead of spending another generation on it.

// The only fallback icon is this neutral pin, used when the AI happens to give a POI no emoji.
export const DEFAULT_ICON = "📍";
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;

// Accept an AI-supplied marker only if it actually looks like an emoji/symbol — a stray word the
// model slipped in falls back to DEFAULT_ICON.
function cleanIcon(s) {
  const v = String(s || "").trim();
  if (!v || v.length > 16 || !EMOJI_RE.test(v)) return null;
  return v;
}

// ---- Descriptions are facts about the PLACE, not about the hero ------------------------------
// ---- Map scale -------------------------------------------------------------------------------
// Distances only make sense relative to what the hero is looking at. Standing in a house, the
// kitchen is a few meters away — not the 100-900 m band used for open country. And a ship crossing
// between star systems measures its neighbors in light-years, not meters. So every map is built at
// a scale, and each scale carries its own UNIT as well as its distance band:
//   indoor (m) → local (m) → outdoor (m) → regional (km) → planetary (km) → system (AU) → galactic (ly)
// A scale's fields:
//   unit / unitWord    the coordinate unit dx/dy are expressed in, and how it's named to the AI.
//   band               the [min,max] POI distance the mapmaker is told to use (in `unit`).
//   sep                the minimum spacing the mapmaker is asked to keep between POIs (in `unit`).
//   near / walk        placement ranges for engine-added current-place / same-region spots.
//   originDir/originNear  placement ranges for the guaranteed origin POI (with / without a known
//                      travel bearing).
//   here               distances under this read as "here" in SURROUNDINGS and the POI list.
//   move               how far the hero must move within a region before SURROUNDINGS is re-fed.
//   when / scope / travel  the scale's prompt blurb, the SURROUNDINGS scope phrase, and the
//                      travel-time guidance the GM is given. All are fed to the AI — keep them true.
export const MAP_SCALES = {
  indoor: {
    key: "indoor", unit: "m", unitWord: "meters", band: [2, 60], sep: 6,
    near: [2, 20], walk: [4, 40], originDir: [20, 70], originNear: [30, 130], here: 2, move: 3,
    when: "the hero is INSIDE one building, vehicle, tent, cave or ship — rooms, halls, corridors, cellars, a cockpit, a deck. Use SHORT distances: 2 to 60 meters for places in the structure (a room ~10 m, a corridor ~15 m, an airlock ~12 m), up to ~150 m for what lies just outside (a street, a dock, the ground below).",
    scope: "around the hero inside the current building or vehicle (typically within ~150 m)",
    travel: "moments for a room, a minute or two for what lies just outside"
  },
  local: {
    key: "local", unit: "m", unitWord: "meters", band: [15, 250], sep: 25,
    near: [8, 50], walk: [20, 120], originDir: [70, 190], originNear: [80, 260], here: 2, move: 10,
    when: "the hero is in a small enclosed area — a courtyard, market square, village, camp, a ship's deck, a cavern floor. Use 15 to 250 meters.",
    scope: "around the hero in this small area (a few hundred meters at most)",
    travel: "minutes to a quarter hour to cross the area"
  },
  outdoor: {
    key: "outdoor", unit: "m", unitWord: "meters", band: [100, 900], sep: 150,
    near: [20, 60], walk: [60, 220], originDir: [150, 320], originNear: [200, 520], here: 10, move: 30,
    when: "the hero is in open country, or a settlement seen from outside, on foot or on a mount. Use 100 to 900 meters.",
    scope: "near the hero (typically within a couple of km)",
    travel: "a walk of some minutes to an hour"
  },
  regional: {
    key: "regional", unit: "km", unitWord: "kilometers", band: [5, 300], sep: 25,
    near: [3, 20], walk: [10, 80], originDir: [40, 140], originNear: [50, 200], here: 0.5, move: 5,
    when: "a landscape the size of a region — countryside, a kingdom, a coastline, a desert, a sea crossing — travelled by land, sea or air, or seen from high above. Use KILOMETERS: 5 to 300 km.",
    scope: "across the region around the hero (typically a few hundred km)",
    travel: "hours by vehicle or aircraft, or a few days on foot or by beast"
  },
  planetary: {
    key: "planetary", unit: "km", unitWord: "kilometers", band: [200, 400000], sep: 5000,
    near: [100, 2000], walk: [500, 10000], originDir: [10000, 150000], originNear: [20000, 250000], here: 20, move: 200,
    when: "a whole world and its near surroundings, seen from a craft or from high above — continents and oceans below, a moon, an orbital station — or flying between two points on a planet. Use KILOMETERS: 200 to 400,000 km (low orbit is ~400 km up; the Moon is ~384,000 km away).",
    scope: "across this world and its orbit (distances in km)",
    travel: "minutes to hours of flight; a descent to the surface in under an hour"
  },
  system: {
    key: "system", unit: "AU", unitWord: "astronomical units (AU)", band: [0.05, 50], sep: 1,
    near: [0.1, 2], walk: [0.5, 10], originDir: [5, 30], originNear: [8, 45], here: 0.01, move: 0.05,
    when: "a star system seen from a spacecraft — a sun, its planets, an asteroid belt, stations — cruising between worlds at sub-light speed. Use ASTRONOMICAL UNITS (AU), where 1 AU is the distance from a star to its Earth-like world: 0.05 to 50 AU.",
    scope: "across this star system (distances in AU)",
    travel: "days to weeks of sub-light cruise between worlds, per the ship's drive"
  },
  galactic: {
    key: "galactic", unit: "ly", unitWord: "light-years", band: [1, 2000], sep: 100,
    near: [2, 30], walk: [10, 200], originDir: [100, 800], originNear: [150, 1200], here: 0.2, move: 0.5,
    when: "interstellar space, travelling BETWEEN stars — nebulae, sectors, distant systems — at warp, jump or hyperspace speed. Use LIGHT-YEARS (ly): 1 to 2,000 ly.",
    scope: "across interstellar space (distances in light-years)",
    travel: "a warp or jump between stars takes whatever the setting's faster-than-light drive allows — hours or days"
  }
};
// The ladder, smallest → largest. Used to phrase the AI prompt and to validate the `[SCALE]` line.
export const SCALE_ORDER = ["indoor", "local", "outdoor", "regional", "planetary", "system", "galactic"];
export function mapScale(k) { return MAP_SCALES[k] || MAP_SCALES.outdoor; }

// Region labels that mean the hero is inside a structure / small enclosed area. Only the REGION
// (the part before the dash) is tested — "Thornwood — Guild hall" is a town, so the map around it
// is town-scale even though the hero stands in a hall.
const INDOOR_LOC_RE = /\b(home|house|cottage|hut|cabin|apartment|flat|chalet|lodge|inn|tavern|pub|manor|keep|castle|palace|tower|temple|church|shrine|library|museum|station|spaceship|starship|submarine|wagon|caravan|ship|vessel|boat|igloo|tent|hideout|bunker|outpost|dungeon|prison|crypt|tomb|cave|cavern|grotto|mine|shed|barn|mill|forge|workshop|shop|store|warehouse|factory|lab|laboratory|office|academy|school|hospital|clinic|guildhall|guild hall|courthouse|theater|theatre|arena)\b/i;
const LOCAL_LOC_RE = /\b(village|hamlet|town|camp|encampment|market|courtyard|plaza|square|compound|district|quarter|clearing|grove|yard|deck|dock|harbou?r|pier|island|valley|pass|canyon|ruins|fort|fortress|citadel|settlement|nei(?:gh|g)hbourhood|suburb|street|road)\b/i;
// Space scales — checked BEFORE the ground ones so a ship's bridge at a system/galactic label is
// read at the scale of what's being mapped. Only the REGION (before the dash) is tested, so
// "Sol System — Docking bay" is a star-system map, not the bay's interior.
const GALACTIC_LOC_RE = /\b(galax(?:y|ies|tic)|interstellar(?: space)?|deep space|nebula|nebulae|star cluster|cluster|constellation|sector|quadrant|hyperspace|warp|jump point|star lane|the void|outer rim|dark space)\b/i;
const SYSTEM_LOC_RE = /\b(star system|solar system|system|heliosphere|asteroid belt|the belt|kuiper belt|oort cloud|inner ring|outer ring)\b/i;
const PLANETARY_LOC_RE = /\b(orbit|low orbit|high orbit|planetary|planet|moon|satellite|atmosphere|stratosphere|mesosphere|exosphere|geostationary|lagrange)\b/i;
const REGIONAL_LOC_RE = /\b(region|province|kingdom|empire|continent|subcontinent|desert|sea|ocean|coast|coastline|shoreline|the plains|prairie|steppe|tundra|savanna|wilderness|frontier|badlands|highlands|lowlands|archipelago|peninsula|basin|river delta)\b/i;

// Best-guess scale from the location label alone (the mapmaker's own [SCALE] line overrides it).
// Space scales are tested first: a star system, a planet (or an orbit) and interstellar space each
// trump the ground heuristics, so "Interstellar Space" reads as galactic even though the hero is
// "in" a ship, and "Sol System" reads as a system rather than the interior of a station.
export function classifyScale(loc) {
  const region = normalizeLoc(loc);
  if (GALACTIC_LOC_RE.test(region)) return "galactic";
  if (SYSTEM_LOC_RE.test(region)) return "system";
  if (PLANETARY_LOC_RE.test(region)) return "planetary";
  if (REGIONAL_LOC_RE.test(region)) return "regional";
  if (INDOOR_LOC_RE.test(region)) return "indoor";
  if (LOCAL_LOC_RE.test(region)) return "local";
  return "outdoor";
}

// Read the mapmaker's `[SCALE] indoor|local|...` line, if it emitted one.
function parseScale(text) {
  const m = String(text || "").match(new RegExp("\\[\\s*SCALE\\s*\\]\\s*:?\\s*(" + SCALE_ORDER.join("|") + ")", "i"));
  return m ? m[1].toLowerCase() : null;
}

// Guess a scale from an already-built POI set (used to migrate legacy cache entries that predate
// the scale field). Deliberately permissive so one far landmark doesn't flip an interior map.
export function inferScaleFromPois(pois, hero) {
  const hx = (hero && hero.x) || 0, hy = (hero && hero.y) || 0;
  let reach = 0;
  for (const p of pois || []) reach = Math.max(reach, Math.hypot((p.dx || 0) - hx, (p.dy || 0) - hy));
  if (reach <= 120) return "indoor";
  if (reach <= 350) return "local";
  return "outdoor";
}

export class MapSystem {
  constructor(genText, opts = {}) {
    this.genText = genText;
    this.lore = String(opts.lore || "").trim();
    // The world's lorebook entries (the always-on digest above is derived from them, but the raw
    // entries are kept so keyword-triggered ones can be matched against the recent story per build).
    this.loreEntries = Array.isArray(opts.loreEntries) ? opts.loreEntries : null;
  }

  // Extract icon/dx/dy/desc from a pipe-split row. Canonical format:
  //   Name | type | icon | dx | dy | one-sentence description
  // The model sometimes merges the coordinates into a single "20 E, 10 N" field, and sometimes
  // drops the icon column (older "Name | type | dx | dy | desc" format) — handle all. Returns
  // null if the row doesn't look like a coordinate row.
  coordParts(parts) {
    const twoNums = (s) => ((s || "").match(/-?\d+(?:\.\d+)?/g) || []).length >= 2;
    const hasDigit = (s) => /-?\d/.test(s || "");
    if (parts.length >= 6) return { dxRaw: parts[3], dyRaw: parts[4], icon: cleanIcon(parts[2]), rest: parts.slice(5) };
    if (parts.length === 5) {
      // "Name | type | icon | 20 E, 10 N | desc" — icon column present, coords merged.
      if (!hasDigit(parts[2]) && twoNums(parts[3])) {
        const nums = (parts[3] || "").match(/-?\d+(?:\.\d+)?/g) || [];
        return { dxRaw: nums[0], dyRaw: nums[1], icon: cleanIcon(parts[2]), rest: [parts[4]] };
      }
      // No icon column: "Name | type | dx | dy | desc".
      return { dxRaw: parts[2], dyRaw: parts[3], icon: null, rest: parts.slice(4) };
    }
    if (parts.length === 4) {
      const nums = (parts[2] || "").match(/-?\d+(?:\.\d+)?/g) || [];
      if (nums.length >= 2) return { dxRaw: nums[0], dyRaw: nums[1], rest: [parts[3]] };
    }
    return null;
  }

  // Generate the surrounding POIs for a location. Returns { pois, scale }, where `pois` is an array
  // of { name, type, dx, dy, desc, icon } at the chosen `scale` (see MAP_SCALES). On failure or an
  // unparseable reply it returns { pois: [], scale: <label-based guess> }.
  async buildPois(state, loc, prevMap = null) {
    let recent = "";
    for (let i = (state.messages || []).length - 1; i >= 0 && recent.length < 2500; i--) {
      const m = state.messages[i];
      if (m.role === "narrator" && m.text) recent = m.text.trim() + "\n\n" + recent;
    }
    // The hero's ORIGIN POI — the place on the previous map they just came from. It must survive
    // onto the new map so the player can always travel back. Defined as the POI nearest to where
    // the hero stood on the old map.
    let origin = null;
    if (prevMap && prevMap.pois && prevMap.pois.length) {
      const hx = (prevMap.hero && prevMap.hero.x) || 0, hy = (prevMap.hero && prevMap.hero.y) || 0;
      let bd = Infinity;
      for (const p of prevMap.pois) {
        const d = Math.hypot((p.dx || 0) - hx, (p.dy || 0) - hy);
        if (d < bd) { bd = d; origin = p; }
      }
    }
    const prevScale = (prevMap && (prevMap.scale || inferScaleFromPois(prevMap.pois, prevMap.hero))) || "outdoor";
    const prevSection = origin
      ? "THE HERO JUST ARRIVED FROM: " + (String(prevMap.loc || "").charAt(0).toUpperCase() + String(prevMap.loc || "").slice(1)) + " (mapped at `" + prevScale + "` scale, so those distances were in " + mapScale(prevScale).unitWord + "). Its surroundings were:\n" +
        prevMap.pois.map((p) => `- ${p.name} (${p.type}) — ${formatDistance(Math.hypot(p.dx || 0, p.dy || 0), prevScale)} ${compassDir(p.dx || 0, p.dy || 0)} of the old spot: ${p.desc}`).join("\n") +
        "\n\nThe world is continuous: big landmarks can span regions (mountains, rivers, forests, ruins, roads, settlements on the ground; worlds, suns, stations, nebulae in space). If it makes sense, KEEP 1-3 of those places on the new map too, using their exact names and adjusting their distance/bearing for the hero's new position. But if the hero has crossed to a very different scale (a world's surface → orbit, or from one star to another), those old landmarks usually do NOT belong — start a fresh map and keep only the place the hero came from (below)." +
        "\n\nTHE PLACE THE HERO CAME FROM is \"" + origin.name + "\" (" + origin.type + ") — this is the way back. You MUST include it on the new map as a POI (keep its exact name, or \"Road to " + origin.name + "\" if it lies beyond the immediate area), placed in the direction the hero traveled FROM, at a distance that fits the journey and the scale you chose. NEVER omit it — the player must always be able to travel back there."
      : "";
    const currentDetail = locDetail(String(loc || ""));
    // The full canon for this build: the always-on digest plus any keyword entry whose trigger
    // words appear in the recent story or the current location label — the story may have just
    // brought up a place whose lore isn't always-on, and the mapmaker must know it as canon.
    let loreText = this.lore;
    if (this.loreEntries && this.loreEntries.length) {
      const kwLore = keywordLoreForText(this.loreEntries, [recent, String(loc || "")].filter(Boolean).join("\n"), { types: ["world", "location"], capChars: 900 });
      if (kwLore) loreText = loreText ? loreText + "\n\n" + kwLore : kwLore;
    }
    const hint = classifyScale(loc);
    const instruction = [
      "You are the mapmaker for a text-based RPG. Map the PLACES of interest (POIs) around the hero's current position — the buildings, landmarks and features the hero could walk to.",
      loreText ? "WORLD LORE (canonical — you may reference these places/landmarks if they fit the surroundings, but don't force them):\n" + loreText : "",
      "Current location: " + (loc || "(somewhere in the wilderness)"),
      currentDetail ? "THE HERO IS CURRENTLY AT \"" + loc + "\". This exact place MUST be one of your POIs — name the building/settlement/spot itself (for \"" + loc + "\" that could be \"" + currentDetail + "\" or a fuller name like \"" + currentDetail + " Hall\"), NOT a small object or piece of furniture inside it, and NOT the place the hero came from. Give this place coordinates near 0 0 — the hero is standing there. Its description must still be a timeless FACT about the place itself (what it is, its look, its reputation) — never write that the hero is there." : "",
      prevSection,
      recent ? "Recent story — this is CANON for what's near the hero. If it names specific PLACES (buildings, landmarks, districts, rooms) near the hero, you MUST include them as POIs with their exact names — the player expects to see the places the story just mentioned. If it only names PEOPLE, do not list them; map the place they are at instead:\n" + recent : "",
      "FIRST decide the SCALE of this map from what the hero can see around them, and output it as the very first line of your reply: `[SCALE] ` followed by exactly one of: indoor, local, outdoor, regional, planetary, system, galactic.",
      "The scale is set by the SCENE BEING MAPPED, not by the words of the location label. If the hero is inside a building, ship, tent or cave and you are mapping that interior, it is `indoor` even when the world outside is vast. But a spacecraft crew looking out at a world, a star system or interstellar space is NOT mapping the ship — map what they can SEE, and use `planetary`, `system` or `galactic`. Choose the scale of the thing whose places the hero could actually reach from here.",
      "SCALE GUIDE — pick the one that matches the hero's situation and use ITS unit and distances:",
      SCALE_ORDER.map((k) => "• " + k + " — " + MAP_SCALES[k].when).join("\n"),
      "DEFAULT (a guess from the location name — override it if the story says otherwise): " + hint + ".",
      "After the [SCALE] line, write a line that is exactly `[POIS]`, then one POI per line in EXACTLY this format (do not omit the `[POIS]` line):",
      "- Name | type | icon | dx | dy | one-sentence description",
      "dx and dy are distances in the UNIT of the scale you chose (see the SCALE GUIDE — meters, kilometers, AU or light-years): dx = that many units EAST of the hero (negative = WEST), dy = that many units NORTH of the hero (negative = SOUTH).",
      "A POI is a PLACE — a fixed physical location the hero could reach — walk to, or fly/dock at — and stand in or at: a building, room, landmark, natural feature, settlement, shop, road, camp, ruin; in a space game, a world, moon, sun, station, belt, nebula or sector. Test every single line with the question \"could the hero physically go there?\". If not, it is not a POI, so remove it.",
      "NEVER put a person, creature or character in the list — not an important NPC, not a companion, and not the hero — and never use a person's name as a POI name. People are not destinations. When the story features a person, map the PLACE associated with them instead: write \"Marla's Smithy\" or \"The Apothecary\", never \"Marla\"; write \"The Captain's Quarters\", never \"Captain Voss\". The `type` is always a kind of place, never a person or creature.",
      "The description is a TIMELESS FACT ABOUT THE PLACE — what it is, its look, purpose, atmosphere, its history or reputation. Describe the place as it always is. NEVER mention the hero, the player, or the current moment: no \"you are here\", \"where you are standing\", \"the hero's current location\", \"now\", and nothing about what just happened in the story. The same description must still make sense later, when the hero is somewhere else and reads the map.",
      "Good description: \"A smoky alehouse whose sign lost its paint decades ago; locals settle old grudges over the dice table.\" — Bad description: \"You are here — the tavern you just entered.\"",
      "List 5 to 7 POIs. SPREAD THEM OUT: use a mix of distances across the chosen scale's band, in ALL directions — don't cluster them all right next to the hero or all in one direction. Keep every POI well separated so they don't overlap on the map (" + SCALE_ORDER.map((k) => k + ": " + MAP_SCALES[k].sep + "+ " + MAP_SCALES[k].unit).join("; ") + ") — the hero's CURRENT place (at coordinates near 0 0) is the only one that sits at the center.",
      "Example line (ground, meters): - The Wilted Flagon | tavern | 🍺 | 120 | -80 | A raucous alehouse with a sagging sign.",
      "Example line (space, star-system scale — note the distances are then in AU): - Aurora Station | orbital station | 🛰 | 0.6 | -0.3 | A ring-shaped habitat hanging in the shadow of the gas giant.",
      "If the recent story revolves around a person (say the blacksmith Marla), a correct POI is `- Marla's Smithy | smithy | 🔨 | 90 | 40 | A squat forge reeking of coal smoke.` — WRONG is `- Marla | blacksmith | 🔨 | 90 | 40 | …`.",
      "type is a short lowercase category that fits THIS world and its setting — there is no fixed list, but it is always a KIND OF PLACE (never a person or creature). Fantasy might use tavern/shrine/ruin, sci-fi station/dock/reactor, modern cafe/subway/clinic — infer the genre from the lore and the story and choose accordingly. Reuse a category you already used rather than inventing synonyms, so similar places stay grouped.",
      "icon is a single emoji representing the place, matching its type and the setting's look (fantasy 🍺/⛪/🏰, sci-fi 🛰/🔬/⚙, modern ☕/🚇/🏥 — match whatever genre this world is). Use the same icon for the same type.",
      "Match the setting and the tone of the story. Do not repeat the same POI twice."
    ].filter(Boolean).join("\n\n");

    let out = "";
    try {
      const res = await this.genText({ instruction: subUser(instruction, heroNameOf(state)), route: "other", maxTokens: 320 });
      out = String((res && res.text) || res || "").trim();
    } catch (e) {
      console.error("map build failed:", e);
      return { pois: [], scale: hint };
    }
    const pois = this.parsePois(out);
    // The scale the mapmaker chose (falling back to our label-based guess) drives both the prompt's
    // distance band and where the hard-guaranteed POIs below are placed.
    let scale = parseScale(out) || hint;
    if (!MAP_SCALES[scale]) scale = "outdoor";
    clampToScale(pois, scale);
    // Hard guarantees the AI prompt alone can't be trusted for: the hero's CURRENT place is always
    // a POI (so HERE shows the right name, not a random nearby feature), and the ORIGIN place is
    // always on the map (so the player can always go back).
    enforceCurrentPoi(pois, String(loc || ""), scale);
    enforceOriginPoi(pois, origin, state, scale);
    return { pois, scale };
  }

  // Fill in a single engine-added stub POI (type "poi", name as its whole description): a same-region
  // move like "Genesis — lounge" → "Genesis — private quarters" adds the spot locally with no AI
  // involved, so this cheap background call gives it a proper name, type, icon and one-sentence
  // brief in the world's voice. Returns { name, type, icon, desc } or null (keep the stub).
  async describePoi(state, regionKey, poiName, scaleKey) {
    const clean = String(poiName || "").trim().replace(/\s+/g, " ").slice(0, 60);
    if (!clean) return null;
    const sc = mapScale(scaleKey);
    let recent = "";
    for (let i = (state.messages || []).length - 1; i >= 0 && recent.length < 1200; i--) {
      const m = state.messages[i];
      if (m.role === "narrator" && m.text) recent = m.text.trim() + "\n\n" + recent;
    }
    const sibs = [];
    const seen = new Set([clean.toLowerCase()]);
    const collect = (arr) => {
      for (const p of arr || []) {
        const n = String((p && p.name) || "").trim();
        if (n && !seen.has(n.toLowerCase())) { seen.add(n.toLowerCase()); sibs.push(n); }
      }
    };
    collect(state.map && state.map.loc === regionKey ? state.map.pois : null);
    const ce = (state.mapCache || {})[regionKey];
    collect(Array.isArray(ce) ? ce : (ce && ce.pois));
    const instruction = [
      "You are the mapmaker for a text-based RPG. Describe ONE place for the hero's surroundings map. Reply with exactly one line and no commentary.",
      this.lore ? "WORLD LORE (canonical — match its setting and tone):\n" + this.lore.slice(0, 800) : "",
      "Region (the whole area this map covers): \"" + String(regionKey || "") + "\".",
      "The place to describe: \"" + clean + "\".",
      "Map scale: " + sc.key + " — distances in " + sc.unitWord + ".",
      sibs.length ? "Other places already on this map (do not repeat or rename one of these — describe the requested place):\n" + sibs.slice(0, 8).map((n) => "- " + n).join("\n") : "",
      recent ? "Recent story — canon for what this place is like (it may just have been introduced):\n" + recent : "",
      "Write exactly ONE line in this format:\nName | type | icon | one-sentence description",
      "Name: the place's name — \"" + clean + "\" or a slightly fuller name (e.g. \"Officer's Private Quarters\").",
      "type: a short lowercase kind of place fitting this world (lounge, quarters, bridge, tavern, shrine — never a person or creature).",
      "icon: a single emoji for the place.",
      "description: ONE timeless fact about the place — what it is, its look, purpose or atmosphere. Never mention the hero, the player, or the current moment."
    ].filter(Boolean).join("\n\n");
    let out = "";
    try {
      const res = await this.genText({ instruction: subUser(instruction, heroNameOf(state)), route: "other", maxTokens: 150 });
      out = String((res && res.text) || res || "").trim();
    } catch (e) {
      return null;
    }
    const line = out.split("\n").map((s) => s.trim()).find((s) => s && !/^\[/.test(s) && s.includes("|"));
    if (!line) return null;
    const parts = line.replace(/^[-•*]\s*/, "").split("|").map((s) => s.trim());
    let name, type, icon, desc;
    if (parts.length >= 4) { name = parts[0]; type = parts[1]; icon = parts[2]; desc = parts.slice(3).join(" "); }
    else if (parts.length === 3) { name = parts[0]; type = parts[1]; desc = parts[2]; icon = null; }
    else return null;
    name = String(name || "").trim().slice(0, 60);
    desc = String(desc || "").replace(/\s+/g, " ").trim().slice(0, 200);
    if (!name || !desc) return null;
    // Keep the tracker's wording unless the AI's name is recognisably the same place — otherwise
    // the hero's on-map snap (fuzzy-matched against the tracker label) could lose it.
    if (!nameTouches({ name }, clean)) name = clean;
    return { name, type: String(type || "poi").toLowerCase().trim().slice(0, 24) || "poi", icon: cleanIcon(icon) || DEFAULT_ICON, desc };
  }

  parsePois(text) {
    const lines = String(text || "").split("\n");
    // The mapmaker is asked for a `[SCALE]` header and a `[POIS]` header, but models routinely drop
    // one or the other (or write the POI rows straight after `[SCALE]`). So: start after whichever
    // header we find, or scan the whole reply if neither is there — the row parser rejects anything
    // that isn't a coordinate line.
    let start = lines.findIndex((l) => /^\s*\[POIS\]\s*$/i.test(l));
    if (start < 0) start = lines.findIndex((l) => /^\s*\[SCALE\]/i.test(l));
    if (start < 0) start = -1;
    const out = [];
    for (let i = start + 1; i < lines.length; i++) {
      const ln = lines[i].trim();
      if (!ln) continue;
      if (/^\s*\[/.test(ln)) {
        if (/^\s*\[(SCALE|POIS)/i.test(ln)) continue; // tolerate a repeated/duplicate header
        break; // start of some other block
      }
      const parts = ln.replace(/^[-•*]\s*/, "").split("|").map((s) => s.trim());
      const c = this.coordParts(parts);
      if (!c) continue;
      const name = parts[0];
      const type = parts[1];
      const dx = Number(String(c.dxRaw).replace(/[^\d.\-]/g, ""));
      const dy = Number(String(c.dyRaw).replace(/[^\d.\-]/g, ""));
      if (!name || !Number.isFinite(dx) || !Number.isFinite(dy)) continue;
      const desc = c.rest.join(" ").replace(/\s+/g, " ").trim();
      if (!desc) continue;
      out.push({
        name: name.slice(0, 60),
        type: String(type || "poi").toLowerCase().trim(),
        dx, dy, desc,
        icon: c.icon || DEFAULT_ICON
      });
    }
    return out;
  }

}

// A distance in a scale's own unit, formatted for the UI/GM: "42 m" / "1.2 km" on the meter scales,
// "830 km" / "384,000 km" on the km scales, "1.80 AU" on a star system, "4.2 ly" between stars.
// Passing no scale (legacy callers) keeps the old meter behaviour.
function trimNum(v, digits) {
  return String(Number(Number(v).toFixed(digits)));
}
export function formatDistance(value, scaleKey = "outdoor") {
  let v = Math.abs(Number(value));
  if (!Number.isFinite(v)) v = 0;
  switch (mapScale(scaleKey).unit) {
    case "m": {
      const d = Math.round(v);
      return d >= 1000 ? trimNum(d / 1000, 1) + " km" : d + " m";
    }
    case "km":
      if (v >= 1000) return Math.round(v).toLocaleString("en-US") + " km";
      return (v >= 100 ? String(Math.round(v)) : trimNum(v, 1)) + " km";
    case "AU":
      if (v >= 10) return trimNum(v, 1) + " AU";
      if (v >= 1) return trimNum(v, 2) + " AU";
      return trimNum(v, 3) + " AU";
    default: // ly
      if (v >= 1000) return Math.round(v).toLocaleString("en-US") + " ly";
      if (v >= 100) return String(Math.round(v)) + " ly";
      return trimNum(v, 1) + " ly";
  }
}

// Canonical map-region key for a location string: strip any em/en-dash detail suffix
// ("Thornwood — Guild hall" -> "thornwood"), trim, lowercase. The map is built per region, so
// fine-grained tracker wording within one place ("Thornwood — Guild hall" vs "Thornwood —
// Wilted Flagon") doesn't trigger pointless rebuilds or re-feeds of the GM.
export function normalizeLoc(loc) {
  let s = String(loc || "").trim();
  const cut = s.search(/[—–]/);
  if (cut >= 0) s = s.slice(0, cut).trim();
  return s.toLowerCase();
}

// The dash-detail of a location label — everything after the em/en dash ("Thornwood — Wayfarer's
// Rest" -> "Wayfarer's Rest"), or "" if none. Used to snap the hero's on-map position to a POI.
export function locDetail(loc) {
  const s = String(loc || "").trim();
  const cut = s.search(/[—–]/);
  return cut >= 0 ? s.slice(cut + 1).trim() : "";
}

// Normalized name for fuzzy POI matching: lowercase, drop possessives/filler words/punctuation.
function normName(s) {
  return String(s || "").toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an|of|and|at|in|near|by)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Find the POI a location detail refers to (so the hero can snap to it on the map). Exact name,
// substring containment, or a strong token overlap win; failing that, a detail that merely names a
// category ("Thornwood — tavern") is matched against the POIs' types and descriptions, so no fixed
// type vocabulary is needed. Ties break toward the POI nearest the map center. Returns { poi, score }.
export function matchPoiScore(detail, pois) {
  const d = normName(detail);
  if (!d) return { poi: null, score: 0 };
  const dw = d.split(" ");
  let best = null, bestScore = 0;
  for (const p of pois || []) {
    const n = normName(p && p.name);
    const hay = normName((p && p.type || "") + " " + (p && p.desc || ""));
    let score = 0;
    if (n === d) score = 4;
    else if (n && (n.includes(d) || d.includes(n))) score = 3;
    else if (n) {
      const nt = n.split(" ");
      const hits = dw.filter((t) => t && nt.includes(t)).length;
      if (hits && hits >= Math.ceil(dw.length / 2)) score = 2 + hits / Math.max(dw.length, nt.length);
    }
    if (score < 3 && hay) {
      // Category-word fallback: EVERY token of the detail must appear in a POI's type/description
      // (e.g. "tavern" matching a tavern whose description says "tavern") — a genuine match, not a
      // chance shared word. Scores just below a real name hit.
      const hw = hay.split(" ");
      const hits = dw.filter((t) => t && hw.includes(t)).length;
      if (hits >= dw.length) score = Math.max(score, 2.4 + 0.4 * (hits / Math.max(dw.length, 1)));
    }
    const closer = best && Math.hypot((p.dx || 0), (p.dy || 0)) < Math.hypot((best.dx || 0), (best.dy || 0));
    if (score > bestScore || (score > 0 && score === bestScore && closer)) { bestScore = score; best = p; }
  }
  return { poi: best, score: bestScore };
}

export function matchPoi(detail, pois) {
  const r = matchPoiScore(detail, pois);
  return r.score >= 2.5 ? r.poi : null;
}

// The hero's CURRENT location must be a POI on the map. The prompt demands it, but if the mapmaker
// only produced a weak/partial match (score < 3 — e.g. a generic detail like "Guild" latching onto a
// "guild_feature" POI's description), add a proper POI named after the place itself so the hero's
// HERE snaps to the right name. Placed where the weak match stands (that's physically where the hero
// is), else at a free spot near the map center.
function enforceCurrentPoi(pois, loc, scaleKey) {
  const detail = locDetail(loc);
  if (!detail) return;
  const m = matchPoiScore(detail, pois);
  if (m.poi && m.score >= 3) return;
  const x = (m.poi && m.poi.dx) || 0, y = (m.poi && m.poi.dy) || 0;
  const near = mapScale(scaleKey).near;
  const pos = freeSpotNear(pois, x, y, near[0], near[1], scaleKey);
  // Engine-added stub: just the place's name as text. `needsBrief` marks it for the background
  // POI enricher (describePoi), which fills in the real type/icon/description.
  pois.push({ name: detail, type: "poi", dx: pos.x, dy: pos.y, desc: detail, icon: DEFAULT_ICON, needsBrief: true });
}

// The hero's ORIGIN POI (the place they just came from) must be on the new map so the player can
// always travel back. If the mapmaker omitted or renamed it out of recognition, add it ourselves,
// placed in the direction the hero traveled FROM (opposite the last travel bearing) if known, else
// at a free spot at mid range from center.
function enforceOriginPoi(pois, origin, state, scaleKey) {
  if (!origin) return;
  if (pois.some((p) => nameTouches(p, origin.name))) return;
  const sc = mapScale(scaleKey);
  const back = travelBackDir(state);
  const pos = back ? freeSpotInDir(pois, back, sc.originDir[0], sc.originDir[1], scaleKey) : freeSpotNear(pois, 0, 0, sc.originNear[0], sc.originNear[1], scaleKey);
  pois.push({ name: origin.name, type: origin.type || "poi", dx: pos.x, dy: pos.y, desc: "The way back to " + origin.name + ".", icon: origin.icon || DEFAULT_ICON });
}

// Safety net for the mapmaker missing the distance band it just chose: if the farthest POI is way
// beyond the scale's band (e.g. an "indoor" map where the model still put the kitchen 200 m away),
// compress EVERY distance proportionally so the farthest sits at the band's max. Relative layout and
// bearings are preserved; only the absolute scale is corrected. A no-op when the map is in-band.
function clampToScale(pois, scaleKey) {
  const band = mapScale(scaleKey).band;
  const cap = band[1] * 1.5;
  let reach = 0;
  for (const p of pois) reach = Math.max(reach, Math.hypot(p.dx || 0, p.dy || 0));
  if (reach <= cap || reach <= 0) return;
  const k = band[1] / reach;
  for (const p of pois) { p.dx = roundCoord(scaleKey, p.dx * k); p.dy = roundCoord(scaleKey, p.dy * k); }
}

// Round a coordinate to a precision that suits the scale's unit — whole meters/kilometers, but three
// decimals for AU and two for light-years (a star system's inner planets live well inside 1 AU, so an
// integer round would collapse their whole layout onto the center).
export function roundCoord(scaleKey, v) {
  const n = Number(v) || 0;
  const unit = mapScale(scaleKey).unit;
  const f = unit === "AU" ? 1000 : unit === "ly" ? 100 : 1;
  return Math.round(n * f) / f;
}

// Loose "is this origin name present on the map" test: name containment either way, or a shared
// significant token (so an AI's "Road to Thornwood" counts as having kept "Thornwood Guild Hall").
function nameTouches(p, name) {
  const n = normName(p && p.name), o = normName(name);
  if (!n || !o) return false;
  if (n.includes(o) || o.includes(n)) return true;
  const ow = o.split(" ").filter((t) => t.length >= 4);
  return ow.length > 0 && ow.some((t) => n.split(" ").includes(t));
}

// Opposite compass direction of the hero's last travel-button press (the direction they came FROM).
const OPP_DIR = { N: "S", NE: "SW", E: "W", SE: "NW", S: "N", SW: "NE", W: "E", NW: "SE" };
const DIR_ANG = { N: 0, NE: Math.PI / 4, E: Math.PI / 2, SE: 3 * Math.PI / 4, S: Math.PI, SW: -3 * Math.PI / 4, W: -Math.PI / 2, NW: -Math.PI / 4 };
function travelBackDir(state) {
  for (let i = (state.messages || []).length - 1; i >= 0; i--) {
    const m = state.messages[i];
    if (m && m.role === "action" && m.kind === "travel" && m.travelBearing) return OPP_DIR[m.travelBearing] || null;
  }
  return null;
}

// A spot within [min,max] units of (cx,cy) that keeps clear of the existing POIs (mirrors the
// placement logic for same-region "here" POIs in main.js). Distances are in the scale's own unit,
// and the "on-map" bound scales with it, so a system/galactic spot is not squashed into ±900 meters.
function freeSpotNear(pois, cx, cy, minDist, maxDist, scaleKey) {
  const LIM = mapScale(scaleKey).band[1] * 1.2;
  let best = null, bestScore = -Infinity;
  for (let a = 0; a < 32; a++) {
    const ang = (a / 32) * Math.PI * 2 + Math.random() * (Math.PI / 32);
    const dist = minDist + Math.random() * (maxDist - minDist);
    const x = roundCoord(scaleKey, cx + Math.cos(ang) * dist);
    const y = roundCoord(scaleKey, cy + Math.sin(ang) * dist);
    const dClosest = pois.reduce((m, p) => Math.min(m, Math.hypot((p.dx || 0) - x, (p.dy || 0) - y)), Infinity);
    const score = (Math.abs(x) <= LIM && Math.abs(y) <= LIM ? 0 : -1e6) + Math.min(dClosest, LIM);
    if (score > bestScore) { bestScore = score; best = { x, y }; }
  }
  return best || { x: roundCoord(scaleKey, cx), y: roundCoord(scaleKey, cy) };
}

// A spot at [minDist,maxDist] units in compass direction `dir` (dx=sin, dy=cos, so dy is north),
// with a little angular jitter and clearance-favoring like freeSpotNear.
function freeSpotInDir(pois, dir, minDist, maxDist, scaleKey) {
  const base = DIR_ANG[dir];
  if (base === undefined) return freeSpotNear(pois, 0, 0, minDist, maxDist, scaleKey);
  const LIM = mapScale(scaleKey).band[1] * 1.2;
  let best = null, bestScore = -Infinity;
  for (let i = 0; i < 32; i++) {
    const ang = base + (Math.random() - 0.5) * 0.7;
    const dist = minDist + Math.random() * (maxDist - minDist);
    const x = roundCoord(scaleKey, Math.sin(ang) * dist);
    const y = roundCoord(scaleKey, Math.cos(ang) * dist);
    const dClosest = pois.reduce((m, p) => Math.min(m, Math.hypot((p.dx || 0) - x, (p.dy || 0) - y)), Infinity);
    const score = (Math.abs(x) <= LIM && Math.abs(y) <= LIM ? 0 : -1e6) + Math.min(dClosest, LIM);
    if (score > bestScore) { bestScore = score; best = { x, y }; }
  }
  const mid = (minDist + maxDist) / 2;
  return best || { x: roundCoord(scaleKey, Math.sin(base) * mid), y: roundCoord(scaleKey, Math.cos(base) * mid) };
}

// 8-point compass direction (N, NE, E, ...) from an (east, north) offset.
export function compassDir(dx, dy) {
  const ang = Math.round((Math.atan2(dx, dy) * 180) / Math.PI / 45) * 45;
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[(((ang + 360) % 360) / 45) % 8];
}
