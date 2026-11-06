/*
 * mock-seed.js — dev/testing helper: fills the community catalog with a realistic set of worlds.
 *
 * WHY THIS EXISTS
 * In the unsaved editor the server-plugin catalog is a THROWAWAY emulator that resets on every
 * preview reload, so Explore/library/moderation are otherwise empty and impossible to exercise.
 * This module publishes a varied mock catalog (several authors, tags, covers, adult flags, forks,
 * like/download counts) straight through the real RPC surface — the same calls the app makes.
 *
 * It may run ONLY against the unsaved editor's throwaway emulator: `createServerSocket()` returns
 * that emulator only while `window.generatorIsUnsaved` is true, and it returns the REAL shared
 * server otherwise. `assertEphemeralEditor()` below enforces that at runtime, so even a direct
 * console call (`mockSeed.seedMockCatalog()`) cannot publish to a live catalog.
 *
 * Nothing here touches the local identity, the library, or kv: the mock authors are separate
 * server-side users with their own tokens. Re-running skips worlds that already exist.
 */

const TEMPLATE_NAMES = ["fantasy", "cyberpunk", "space", "modern", "narrative"];

// Covers live on the platform's own upload host (the catalog only accepts user.uploads.dev /
// editable.uploads.dev URLs). Generated once; the images themselves are static.
const COVER = {
  sunkenCrown: "https://user.uploads.dev/file/72c6deecf367e28a463979ec871de070.jpg",
  neonRain: "https://user.uploads.dev/file/d25996948c75de6cc0f5b91e3cd8147d.jpg",
  hollowHouse: "https://user.uploads.dev/file/44cd59edca6726088c6691951dd72d75.jpg",
  cafe: "https://user.uploads.dev/file/e8067cda88fc6363f1477e5c0cee3f60.jpg",
  crimsonManor: "https://user.uploads.dev/file/e2e77485fe54688caf4d85c5f3778aa2.jpg",
  kepler: "https://user.uploads.dev/file/0f579c19deef64a27e99348e18c02ec4.jpg"
};

// Six mock creators, ordered so the demo worlds' authors (Lyrra Voss, GrimTide, Nightbloom,
// PixelSorcerer) all fall within the first five — the emulator only lets one network create five
// usernames per day, so the sixth may never get to claim.
export const MOCK_AUTHORS = [
  { username: "Lyrra Voss", userId: "01a2b3c4d5e6f708", token: "mno-mock-user-token-lyrra-voss-0000000" },
  { username: "GrimTide", userId: "02b3c4d5e6f70819", token: "mno-mock-user-token-grimtide-00000000" },
  { username: "Nightbloom", userId: "06f708192a3b4c5d", token: "mno-mock-user-token-nightbloom-0000000" },
  { username: "PixelSorcerer", userId: "05e6f708192a3b4c", token: "mno-mock-user-token-pixelsorc-00000000" },
  { username: "astral_kat", userId: "03c4d5e6f708192a", token: "mno-mock-user-token-astralkat-0000000" },
  { username: "Old Man Winter", userId: "04d5e6f708192a3b", token: "mno-mock-user-token-oldmanwinter-00000" }
];
const byName = (n) => MOCK_AUTHORS.find((a) => a.username === n);

// `slug` must be lowercase [a-z0-9-]; the published worldId is `<userId>-<slug>`.
// `likes`/`dl` are how many distinct mock voter connections endorse it (max 5).
export const MOCK_WORLDS = [
  {
    slug: "sunken-crown", author: "Lyrra Voss", title: "The Sunken Crown", tpl: "fantasy",
    tags: ["fantasy", "adventure", "epic"], cover: COVER.sunkenCrown, likes: 5, dl: 4,
    desc: "A drowned kingdom stirs beneath the tide, and you are the last heir of a crown no living soul remembers.",
    scenario: "The realm of Calath was swallowed by the sea three hundred years ago. Its towers are coral now, its courts are kelp, and its crown — heavy, salt-crusted and very much awake — has begun to call for an heir.",
    start: "You wake on a tide-washed beach with salt in your mouth and a crown-shaped bruise on your palm. Somewhere below the waves, something is counting. {{user}}, what do you do?"
  },
  {
    slug: "neon-rain-2088", author: "GrimTide", title: "Neon Rain 2088", tpl: "cyberpunk",
    tags: ["cyberpunk", "noir", "heist"], cover: COVER.neonRain, likes: 4, dl: 3,
    desc: "It never stops raining in Sector 9. You're a fixer with one debt left to clear and a city that would rather you didn't.",
    scenario: "Neo-Kowloon, 2088. The rain is acidic, the cops are rented, and every favour has a price in chrome. You fix other people's problems for a living — until one of them turns out to be yours.",
    start: "The comm crackles at 3 a.m.: a voice you don't know, a package you shouldn't take, and an address that was demolished last year. {{user}}, what do you do?"
  },
  {
    slug: "station-kepler-9", author: "PixelSorcerer", title: "Station Kepler-9", tpl: "space",
    tags: ["scifi", "space", "survival"], cover: COVER.kepler, likes: 3, dl: 2,
    desc: "A deep-space research station, twelve years from help, and something is growing in the hydroponics bay.",
    scenario: "Kepler-9 orbits a gas giant at the edge of charted space. The crew of nine has become six, the station's logs have been edited, and the greenhouses are thriving in ways nobody programmed.",
    start: "You come off a six-month cryo shift to a station that is too quiet, too warm, and exactly one heartbeat too alive. {{user}}, what do you do?"
  },
  {
    slug: "deep-signal", author: "GrimTide", title: "Deep Signal", tpl: "space",
    tags: ["scifi", "horror", "mystery"], likes: 2, dl: 2,
    forkOf: "station-kepler-9",
    desc: "The research sub has been under for six months, and the crew hears a song in the hull.",
    scenario: "Seven kilometres down, in a trench the charts call the Hollow, the sub Halcyon is still transmitting. The song started three weeks ago and nobody has slept properly since.",
    start: "You're the relief crew, descending in a bathyscaphe that ticks as it cools. At four thousand metres, something knocks twice on the outside of the hull. {{user}}, what do you do?"
  },
  {
    slug: "crimson-manor", author: "Nightbloom", title: "Crimson Manor", tpl: "narrative",
    tags: ["romance", "vampire", "gothic"], nsfw: true, cover: COVER.crimsonManor, likes: 4, dl: 3,
    desc: "An invitation to the manor of a reclusive count. The doors lock at midnight, and not all of the guests are alive.",
    scenario: "You are one of seven invited to Crimson Manor for the count's famous winter salon. The wine is excellent, the conversation is dangerous, and the count is very interested in how long you plan to stay.",
    start: "The carriage stops at the gate at dusk. Seven sets of footsteps crunch on the gravel; six of them cast no shadow. {{user}}, what do you do?"
  },
  {
    slug: "hollow-house", author: "Nightbloom", title: "Hollow House", tpl: "modern",
    tags: ["horror", "mystery", "haunted"], cover: COVER.hollowHouse, likes: 3, dl: 2,
    desc: "The house on Marrow Lane has been sold eleven times in eleven years. You are its twelfth tenant.",
    scenario: "The rent is impossibly cheap, the lease is six pages of handwriting, and the previous tenants all left in a hurry — leaving behind photographs, diaries, and one door that is painted shut.",
    start: "The keys are warm. They shouldn't be. As the removal van pulls away, the upstairs hallway creaks like something settling down to listen. {{user}}, what do you do?"
  },
  {
    slug: "cafe-at-the-end", author: "astral_kat", title: "Café at the End of the World", tpl: "narrative",
    tags: ["slice-of-life", "cozy", "romance"], cover: COVER.cafe, likes: 3, dl: 2,
    desc: "The last café before the edge of everything. Sit down. Have a cup. Tell me how you got here.",
    scenario: "The café stands where all roads run out. People arrive with suitcases, secrets and no intention of leaving. You pour the coffee and listen, and slowly you learn why the world ended — and why you're still here.",
    start: "A bell you don't remember hanging rings. A stranger in a travelling coat takes the window table and orders whatever's warm. {{user}}, what do you do?"
  },
  {
    slug: "ironveil", author: "PixelSorcerer", title: "Ironveil: A Skybound Saga", tpl: "fantasy",
    tags: ["fantasy", "exploration", "airship"], likes: 2, dl: 2,
    desc: "Cities hang on chains above a poisoned earth. You are a skyship scavenger with a stolen map and a bad reputation.",
    scenario: "Below the cloud-deck the world is ash and rust. Above it, the chain-cities trade, scheme and starve. You fly between them in a patched-up skiff, chasing the one map everyone wants destroyed.",
    start: "Your skiff limps into Ironveil's lower dock with a broken sail and a cargo hold full of someone else's treasure. {{user}}, what do you do?"
  },
  {
    slug: "last-precinct", author: "GrimTide", title: "The Last Precinct", tpl: "cyberpunk",
    tags: ["scifi", "detective", "noir"], likes: 1, dl: 1,
    desc: "The city's final detective station, staffed by one burnt-out cop and whatever walks through the door.",
    scenario: "Precinct 13 was decommissioned years ago; nobody told the detective, and nobody told the crimes. Every case file is a dead end, and every dead end has a name.",
    start: "A woman walks in out of the rain, sets a photograph on the desk and says: \"This is me. I died on Tuesday.\" {{user}}, what do you do?"
  },
  {
    slug: "wanderers-rest", author: "Old Man Winter", title: "Wanderer's Rest", tpl: "modern",
    tags: ["cozy", "slice-of-life", "town"], likes: 2, dl: 1,
    desc: "A quiet crossroads town where you've just inherited the old inn — and everyone in it has a story.",
    scenario: "Two roads meet at Wanderer's Rest and go no further. You've inherited the inn, the debt and the regulars: a retired cartographer, a widow who never says her name, and a dog that knows things.",
    start: "The first guest of the season arrives before you've finished sweeping, dripping on the floorboards and asking for a room for the winter. {{user}}, what do you do?"
  },
  {
    slug: "ashes-ninth-age", author: "Lyrra Voss", title: "Ashes of the Ninth Age", tpl: "fantasy",
    tags: ["fantasy", "dark", "war"], likes: 2, dl: 1,
    desc: "The gods are dead and their armies are not. You command what's left of the Ninth Legion.",
    scenario: "The Ninth Age ended when the heavens cracked. You have ninety soldiers, three weeks of rations, and a war between gods who are no longer alive to surrender.",
    start: "The scouts return at dawn with word of a banner moving through the pass — and the banner belongs to a god who died a century ago. {{user}}, what do you do?"
  },
  {
    slug: "whispering-pines", author: "Old Man Winter", title: "Whispering Pines", tpl: "modern",
    tags: ["horror", "mystery", "small-town"], likes: 1, dl: 1,
    desc: "A small town where everyone knows your name and nobody will say what happened in 1987.",
    scenario: "Whispering Pines has one diner, one church and one anniversary nobody acknowledges. You've come back after twenty years to sell your mother's house; the town would rather you didn't.",
    start: "The realtor won't cross the threshold. The keys are in the mailbox. Someone has been keeping the garden. {{user}}, what do you do?"
  },
  {
    slug: "gilded-serpent", author: "astral_kat", title: "The Gilded Serpent", tpl: "fantasy",
    tags: ["fantasy", "heist", "rogue"], likes: 2, dl: 1,
    desc: "One heist. Three impossible vaults. A crew that mostly doesn't hate each other.",
    scenario: "The Serpent is the finest bank in the Free Cities: three vaults, no keys, and a curse to discourage ambitious guests. You have one week, four accomplices and no plan worth the name.",
    start: "The crew assembles in a cellar that smells of lamp oil. Somebody has already bribed a guard; somebody else has already betrayed that somebody. {{user}}, what do you do?"
  },
  {
    slug: "bloodmoon-academy", author: "Lyrra Voss", title: "Bloodmoon Academy", tpl: "fantasy",
    tags: ["fantasy", "school", "romance"], nsfw: true, likes: 2, dl: 1,
    desc: "A boarding school for mages where the curriculum is survival and the prom is a duel.",
    scenario: "Bloodmoon Academy accepts one student a year from each bloodline. The lessons are lethal, the faculty are worse, and this year's intake is unusually determined to graduate alive.",
    start: "You arrive at the gates with one trunk and a letter you were told never to read. The letter has already been read. {{user}}, what do you do?"
  }
];

const MODERATION_DEMO_SLUG = "deep-signal";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const worldIdFor = (w) => byName(w.author).userId + "-" + w.slug;
const editTokenFor = (w) => ("mno-mock-edit-token-" + w.slug).padEnd(44, "0");

// Handy for the console: `await mockSeed.seedMockCatalog()` in the preview's devtools.
window.mockSeed = { MOCK_AUTHORS, MOCK_WORLDS, seedMockCatalog };

async function sha256Hex(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function loadTemplate(name) {
  const res = await fetch(new URL("../game/templates/" + name + ".json", import.meta.url));
  if (!res.ok) throw new Error("template " + name + " failed (" + res.status + ")");
  return await res.json();
}
/*
 * FAIL CLOSED. This is the whole reason the module is safe to keep in src/: a mock publish that
 * reaches the live, shared catalog claims real usernames and pollutes Explore for everyone, and it
 * is not recoverable from the client. `createServerSocket()` is the emulator ONLY while the
 * generator has never been saved (`window.generatorIsUnsaved === true`); the moment it is saved —
 * including the ordinary editor preview of a saved generator — that call returns a socket to
 * `wss://server-plugin.perchance.org/...`, i.e. production. We refuse to write on anything that
 * looks like production, checked at the socket itself so no caller can bypass it.
 */
function assertEphemeralEditor(sock) {
  const ctor = (sock && sock.constructor && sock.constructor.name) || "";
  const url = String((sock && sock.url) || "");
  const looksLive = ctor === "ProductionServerSocket" || url.includes("server-plugin.perchance.org");
  if (window.generatorIsUnsaved === true && !looksLive) return;
  throw new Error(
    "mock-seed refused to run: this preview is attached to the LIVE server " +
    "(generatorIsUnsaved=" + window.generatorIsUnsaved + ", socket=" + (ctor || "?") + "). " +
    "Mock worlds may only be seeded into the unsaved editor's throwaway emulator."
  );
}

// One server connection. Rate limits, like/report dedupe and download dedupe are all keyed on the
// caller's network group, so every socket opened from this browser shares one bucket — fanning out
// across sockets buys nothing. Caps per network per 24h: 5 new worlds, 5 new usernames.
async function openSocket() {
  const s = window.createServerSocket();
  await s.opened;
  assertEphemeralEditor(s);
  return async (method, payload) => JSON.parse(await s.rpc[method](JSON.stringify(payload || {})));
}

// Build a playable world file from a genre template, overriding the listing fields and premise.
function buildWorldFile(tpl, w, nowIso) {
  const f = JSON.parse(JSON.stringify(tpl));
  f.meta = Object.assign({}, f.meta, {
    id: w.slug, name: w.title, description: w.desc, author: w.author,
    tags: w.tags.slice(), nsfw: !!w.nsfw, cover: w.cover || "", createdAt: nowIso, updatedAt: nowIso
  });
  // A fork's file carries its provenance (`meta.remix`), exactly as the Duplicate flow writes it, so
  // the mock catalog exercises the card's `remix` chip through both the listing and the saved copy.
  if (w.forkOf) {
    const origin = MOCK_WORLDS.find((x) => x.slug === w.forkOf);
    if (origin) f.meta.remix = {
      worldId: worldIdFor(origin), name: origin.title, userId: byName(origin.author).userId,
      author: origin.author, at: nowIso
    };
  }
  if (w.scenario) f.scenario = w.scenario;
  if (w.start) f.start = w.start;
  return JSON.stringify(f);
}

/*
 * Seed the catalog. Idempotent-ish: worlds already present are skipped, so calling it again after
 * a partial run resumes where it left off — but the network rate limits mean a single editor
 * session can only ever add five new worlds (and five new usernames). A reload resets both the
 * emulated catalog and the limits, so reload then seed again to start over.
 *
 * `likes` (OFF by default) would spend THIS browser's one like and one download per seeded world —
 * the server dedupes both per network group, so from a single browser the numbers can never vary and
 * the seeder would simply consume the editor's own like/download budget. Left off, the seeded
 * catalog starts at ♡0 · 🡻0 and behaves like a brand-new real one: liking a world moves it to ♥1 and
 * adding it to your library moves 🡻0 → 🡻1, which is exactly the flow you want to see while testing.
 * Turn it on (console: `mockSeed.seedMockCatalog({likes:true})`) when you specifically want to
 * exercise the like/download write RPCs or see a non-zero baseline.
 *
 * Returns a small summary: { published, authors, skippedPresent, skippedNoAuthor, hitLimit, ... }.
 */
export async function seedMockCatalog({ onProgress = () => {}, likes = false, moderationDemo = true } = {}) {
  const templates = {};
  onProgress("loading templates…");
  for (const name of TEMPLATE_NAMES) {
    try { templates[name] = await loadTemplate(name); } catch (e) { templates[name] = await loadTemplate("blank"); }
  }

  const conn = await openSocket();
  const allIds = MOCK_WORLDS.map(worldIdFor);
  const present = new Set();
  try {
    const res = await conn("getWorlds", { worldIds: allIds });
    for (const it of (res.items || [])) if (it.status && it.status !== "unknown") present.add(it.worldId);
  } catch (e) {}

  // 1. Authors. A repeat claim with the same token is a harmless no-op, so this is safe to re-run.
  //    Only the first five usernames can be created per network per day; the rest are skipped.
  const claimed = new Set();
  let claimLimited = false;
  onProgress("claiming authors…");
  for (const a of MOCK_AUTHORS) {
    if (claimLimited) break;
    const r = await conn("claimUsername", { userId: a.userId, username: a.username, token: a.token });
    if (r && r.ok) claimed.add(a.username);
    else if (r && r.error === "rate_limited") claimLimited = true;
    else if (r && (r.error === "username_taken")) claimed.add(a.username); // already ours from a prior run
    await sleep(120);
  }

  // 2. Worlds, in MOCK_WORLDS order. Only authors we actually own can publish, and a published
  //    world must be able to back a fork to an earlier entry, so order the demo set first and
  //    publish strictly top-to-bottom.
  const nowIso = new Date().toISOString();
  let published = 0, skippedPresent = 0, skippedNoAuthor = 0, hitLimit = false;
  const thisRun = [];
  for (const w of MOCK_WORLDS) {
    const wid = worldIdFor(w);
    if (present.has(wid)) { skippedPresent++; continue; }
    if (!claimed.has(w.author)) { skippedNoAuthor++; continue; }
    onProgress("publishing… " + (published + 1));
    const text = buildWorldFile(templates[w.tpl] || templates.fantasy, w, nowIso);
    const up = await window.uploadPlugin(text);
    if (!up || up.error) throw new Error("upload failed (" + ((up && up.error) || "?") + ")");
    const payload = {
      worldId: wid, userId: byName(w.author).userId, userToken: byName(w.author).token,
      editToken: editTokenFor(w), title: w.title, description: w.desc, tags: w.tags.slice(),
      nsfw: !!w.nsfw, coverUrl: w.cover || "", jsonUrl: up.url, jsonBytes: up.size,
      jsonHash: await sha256Hex(text), jsonEncoding: "identity"
    };
    if (w.forkOf && present.has(worldIdFor(MOCK_WORLDS.find((x) => x.slug === w.forkOf)))) {
      const origin = MOCK_WORLDS.find((x) => x.slug === w.forkOf);
      payload.forkOfWorldId = worldIdFor(origin);
      payload.forkOfUserId = byName(origin.author).userId;
      payload.forkOfTitle = origin.title;
      payload.forkOfAuthor = origin.author;
    }
    const r = await conn("publishWorld", payload);
    if (r && r.ok) { published++; thisRun.push(w.slug); present.add(wid); }
    else if (r && r.error === "rate_limited") { hitLimit = true; break; }
    await sleep(160);
  }

  // 3. Popularity — opt-in only (see the header). Likes and downloads are deduped per network group,
  //    so from a single browser each world can gain at most one of each; running this just spends the
  //    editor's own like/download budget. When enabled it's enough to show a non-zero count and the
  //    "liked" state.
  if (likes && thisRun.length) {
    onProgress("adding likes & downloads…");
    const voter = await openSocket();
    for (const w of MOCK_WORLDS) {
      if (!thisRun.includes(w.slug)) continue;
      const wid = worldIdFor(w);
      if (w.likes) { try { await voter("likeWorld", { worldId: wid }); } catch (e) {} }
      if (w.dl) { try { await voter("incrementDownload", { worldId: wid }); } catch (e) {} }
      await sleep(60);
    }
  }

  // 4. Moderation demo. Reports are deduped per network group and the quorum is 64, so from one
  //    browser we can never actually hide a world — but we still fire one report so the flow is
  //    exercised, and note it in the summary. (The mod log stays empty here: only hides, appeals and
  //    admin actions are logged, never publishing, updating or claiming names.)
  let moderationDemoRan = false;
  if (moderationDemo) {
    const victim = MOCK_WORLDS.find((w) => w.slug === MODERATION_DEMO_SLUG);
    if (victim && thisRun.includes(victim.slug)) {
      onProgress("moderation demo…");
      try {
        const r = await conn("reportWorld", { worldId: worldIdFor(victim) });
        moderationDemoRan = !!(r && r.ok);
      } catch (e) {}
    }
  }

  onProgress("done");
  return {
    published, authors: claimed.size, skippedPresent, skippedNoAuthor,
    hitLimit, moderationDemo: moderationDemoRan, slugs: thisRun,
    total: MOCK_WORLDS.length
  };
}
