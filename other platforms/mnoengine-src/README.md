# MNO RPG ENGINE — Text AI Roleplay Game

A **text-based AI roleplaying game**. The player types freeform actions and dialogue; an AI acts as
the **Game Master (narrator)** — it describes the world, reacts to the player, and **voices every
NPC** they encounter. The result is an interactive tabletop-RPG-like experience with a persistent
character, an evolving story, and the standard "chat" affordances players expect from AI roleplay.
Working title/brand shown in the top bar: **MNO RPG ENGINE**.

> **This file is the single source of truth and the starting point for agents/devs.** Update it
> whenever behavior changes.
>
> **Release notes live in [`CHANGELOG.md`](CHANGELOG.md)** — add one concise entry per user-visible
> change, the day it lands, following [§9](#9-changelog-convention).
>
> **Editor/tooling notes (for AI agents):** keep `#landing`/`#app` hidden with the `hidden` attribute,
> never `<style>#id{opacity:0}</style>` — the screenshot helper clones the DOM and re-applies inline
> styles without the stylesheet's override, capturing a blank page. `#landing` is
> `position:absolute; inset:0` and clips (`overflow:hidden`) — its content pane **`#homeMain` is the
> internal scroll container** (the nav and page header stay put), so scroll and screenshot it there,
> not `#landing`. A full-page capture taken while a reply is streaming can hang indefinitely (the
> stream bubble mutates the DOM every chunk) — pose the state, let it settle, then capture.

## Contents
1. [Vision & principles](#1-vision--principles)
2. [Feature checklist](#2-feature-checklist)
3. [Architecture & file layout](#3-architecture--file-layout)
4. [World format (single-file worlds)](#4-world-format-single-file-worlds)
5. [Save / data model](#5-save--data-model)
6. [Subsystems](#6-subsystems)
   - [RP loop & commands](#61-rp-loop--commands) · [Context construction](#62-context-construction-what-the-gm-sees) ·
     [Trackers](#63-trackers-ai-tracked-state) · [Hero stats & checks](#64-hero-stats--skill-checks) ·
     [Memory](#65-memory-system) · [NPCs](#66-npc-system) · [Lorebook](#67-lorebook) ·
     [Map](#68-map-system) · [World editor](#69-world-editor) · [UI / rails / landing](#610-ui--rails--landing) ·
     [Storage & sessions](#611-storage--sessions) · [Choices](#612-choose-your-own-adventure) ·
     [Stop button](#613-stopping-a-generation) · [Community layer](#614-community-layer-explore-publishing-added-world-library) ·
     [Data & Backup](#615-data--backup-everything) · [Settings panel](#616-settings-panel-identity--content-settings--interface--image-gen--ai-model--data--backup)
7. [Key invariants & gotchas](#7-key-invariants--gotchas)
8. [Tech notes & history](#8-tech-notes--history)
9. [Changelog convention](#9-changelog-convention) — how and when to write release notes in `CHANGELOG.md`

---

## 1. Vision & principles

1. **The AI is the GM.** It narrates in second person, describes scenes and consequences, and
   speaks *as* NPCs (with voice/dialogue attributed to them).
2. **Player agency.** The player drives everything. The GM reacts, never dictates the player's
   actions or feelings.
3. **Persistence.** Character + story + memories survive reloads, live in the browser, and can be
   backed up/restored.
4. **Editable by non-programmers.** All game content — world lore, premise, opening scene, tone,
   stats, trackers, the standing cast — lives in **single-file JSON worlds** (no code). Engine code
   and the narrator system prompt are deliberately separate so content work never touches them.
5. **Consistency.** Memory + a scene-relevant lorebook + an AI-tracked world state keep the world,
   NPCs, and history coherent over long games.

---

## 2. Feature checklist

| # | Feature | Notes |
|---|---------|-------|
| 1 | Text-based AI RP (fantasy RPG, any world) | GM narration + NPC voices |
| 2 | Edit message | Edit your action *or* the GM reply |
| 3 | Re-roll a message | Regenerate GM reply, keep a version history (`◀ n/N ▶`) |
| 4 | Delete a message | Delete a whole turn, or just the GM reply |
| 5 | Auto memory | AI records important events (owner/triggers/turn) on an engine cadence |
| 6 | Manual memory | Player can add/edit/delete/pin notes |
| 7 | Character-creation wizard | Full-screen 4-step wizard (bio/avatar/stats/review) before the opening turn |
| 8 | Local save in browser | Auto + manual (kv-plugin / IndexedDB) |
| 9 | Backup | Export / Import (`.mno-adv` download / upload); v1 & v2 saves accepted |
| 10 | Multiple sessions | Create, switch, rename, delete campaigns |
| 11 | Narrator prompt in a separate file | `src/scripts/narrator-prompt.md` |
| 12 | Lorebook (multi-entry bible, type + activation per entry) | world `lorebook` array; world-editor Lorebook tab |
| 13 | World premise (`scenario`, always injected) | world `scenario` field |
| 14 | Starting scenario (first 20 turns) | world `start` field |
| 15 | Narrative vibe in its own field | world `narrativeVibe` field |
| 16 | Dark fantasy UI, modern + flat | palette in §6.10 |
| 17 | Flat glyph icons | inline symbols; monochrome PNG page/rail marks (§6.10) |
| 18 | NPC bubbles + generated portraits | profiles + catalogue (never auto-removed; pin sorts to top) |
| 19 | Landing / main menu + Worlds gallery | non-chat first screen; create/import worlds |
| 20 | Tracked state/resources | `[TRACKERS]` block, per-message snapshots, tracker bar |
| 21 | Player-owned hero stats (STR/INT/…) | point-buy at creation, spent at level-up |
| 22 | Skill checks (die + mod vs DC) | configurable die sides + optional custom modifier formula; referee call + dice pip in chat |
| 23 | Scene images | 🎨 Scene command → image turns + lightbox |
| 24 | Map / points of interest | location-change-driven POI minimap + travel |
| 25 | Death & game over | life tracker → death scene + game-over badge, composer lock |
| 26 | Stop the GM mid-reply | send button becomes a red-square stop while writing (§6.13); partial reply kept, the turn's remaining AI calls skipped |
| 27 | Community catalog (Explore) | search / tag + ♥ Liked filter / sort / author pages / paging over a server-plugin catalog of shared worlds (§6.14) |
| 28 | Publish / update / unpublish your worlds | device-local identity (`secret` → `userId` + unique username), content on the upload host, catalog on the server plugin (§6.14) |
| 29 | Added-world library + attributed forks | add caches a read-only playable copy; Duplicate makes a local fork carrying `meta.remix` (§6.14) |
| 30 | Light automatic moderation | report-count auto-hide + appeal; an owner-only mod log **plus admin hide / unhide / unpublish on any Explore listing** and a **delete-an-identity** tool (behind the admin password; the session survives closing the panel, and a same-tab reload silently re-authenticates from the sessionStorage-kept password), in Settings' Admin section (§6.14 / §6.16); per-reader filters (blocked tags, muted authors — set on the Settings panel, §6.16) (§6.14) |
| 31 | Data & Backup (everything) | one JSON with adventures + worlds + community identity/library + UI prefs; merge or replace import (§6.15 / §6.16) |
| 32 | Settings panel (popup) | your **identity** (username, user id, creator code, restore), **content settings** (blocked tags, muted authors), **interface** (the Worlds welcome banner), **AI Model** (Perchance AI, OpenAI, DeepSeek, OpenRouter or local Ollama), **Image Gen** (provider: Perchance AI, OpenAI or OpenRouter with your own key; guidance scale for Perchance), **Data & Backup** and **Admin** (the owner-only mod log, behind the admin password) — sections behind a rail, which on a phone is a tap-in list with a `‹ Back` pill, raised over whatever home page you're on (§6.16) |
| 33 | Shareable world links | a `#explore/<worldId>` deep link opens a published world's details panel on load; **🔗 Copy link** is a chip beside the download counter in Explore's panel and in the Worlds page's world detail popup (a live listing of your own, or an added world), plus a ⋮ entry on the Worlds page for a live listing (§6.14) |
| 34 | Public user profiles | a `#user/<username>` deep link opens that author's profile: avatar, username, bio, total likes/downloads, and their published worlds (old `#user/<userId>` links still resolve). Author names on Explore cards, Explore panels, Worlds cards (library + added) and Worlds panels link to it, as do the original authors credited on remix lines; your picture and bio are edited in Settings → Identity |
| 35 | Third-party scenario import | ⭱ Import World accepts `.scenario.json` (`unseen-scribe-library-scenario-v1`): story crosses over verbatim, then the AI suggests a preset from the live rules-template catalog (preselected, overridable; blank fallback) — see `src/scripts/scenario-import.js` |

---

## 3. Architecture & file layout

Shipped files live at the **workspace root**; everything else lives in **`src/`** (persists and
ships with the generator; `scratch/` does not ship and is ephemeral).

```
main.pjs                 ← plugin imports only
index.html               ← boot splash + script tags + the community catalog server (contents of <body>; the landing/app shells are JS-mounted — see landing-shell.js / app-shell.js)
src/
  README.md              ← this document (single source of truth)
  CHANGELOG.md           ← release notes; loaded by the landing changelog popup (see §9)
  styles.css             ← all styling (palette in §6.10)
  fonts/                 ← (removed Oct 2026; was the retired mno-glyphs fallback font)
  images/                ← logo.svg, icon-512.png (tab/app icon, wired via `$meta icon`), portrait-placeholder.webp, map-parchment.webp, hero-header.webp, backdrop-castle.webp, favicon.png (legacy 100px, superseded by icon-512.png), cover-*.webp, and the monochrome page marks icon-{worlds,adventures,explore,changelog,memory,settings,hero,map,npc,gallery}.png
                            (backdrop-castle.webp is the shell's one page backdrop — `#ldBg`, behind Worlds, Adventures AND Explore, so the welcome banner's glass has something to be glass over; it was vendored off `user.uploads.dev` so the art ships with the generator, §6.10)
                            (the icon-*.png files are white-on-transparent monochrome masks — tinted with `currentColor` via CSS `mask`, see §6.10 / `.sec-ic`)
  vendor/                ← jsonrepair.mjs — vendored ESM JSON-repair lib for recovering LLM JSON replies
  scripts/               ← ENGINE LAYER (logic + system prompt; not for content edits)
    boot.js              ← classic script (loads first): exposes the Perchance plugins on `window` (read off `root`) for the ES modules
    main.js              ← app logic: boot, HOME pages (Worlds/Adventures/Explore + the Settings panel), chat flow, turn model, rendering, rails, memory trigger, AI calls (shells live in landing-shell.js / app-shell.js)
    landing-shell.js     ← LANDING shell: `#landing` markup + the update banner + pure nav-chrome (collapse, drawer, prefs); mounted by main.js at boot
    app-shell.js         ← APP (chat) shell: `#app` markup + rail scrim + rail-tab descriptors + section icons + mobile/composer constants; mounted by main.js at boot
    notify.js            ← toast + busy-button helpers (no dependencies)
    info-tip.js          ← shared tap-friendly tooltip: hover/focus on desktop, tap to pin on mobile; one delegated install (`initInfoTips()`), `infoTipHtml()` icon builder + `infoTipLabelHtml()` full-label trigger, no per-render wiring (no dependencies)
    changelog.js         ← Changelog popup (parses CHANGELOG.md; needs back-close + rich-text)
    page-helpers.js      ← shared stateless page builders: incremental rendering, filter toggle, empty states, filter chips/pills (no dependencies)
    world-craft.js       ← world creation: fresh ids, duplicates, the new-world template picker + Craft with AI (app state via initWorldCraft(), same pattern as scene-images.js)
    scenario-import-panel.js ← third-party scenario import (AI-matched rules template) + the inbound-share return path (imports freshWorldId/extractAiValue from world-craft.js; app state via initScenarioImport())
    ai-provider.js       ← switchable text-AI backend: the Perchance built-in or any OpenAI-compatible endpoint (BYOK); `routedGenText` wraps every AI call, `aiModelSection()` is the Settings panel's AI Model section
    community.js         ← COMMUNITY LAYER: identity/creator code, publish/update/unpublish, Explore page (its detail panel hosts the per-world 💬 Comments thread), added-world library (cached play, refresh, forks), reader blocklists, reports/appeal, the owner-only mod log (the Settings panel's Admin section), and that panel's Identity + Content settings sections (§6.14 / §6.16). Lazily imported; also sets `window.community` for debugging
    mock-seed.js         ← DEV/TEST ONLY: fills the editor's ephemeral emulated catalog with mock authors + worlds (the 🧪 button in Explore's footer). Lazily imported; hard-refuses to run against the live server (`assertEphemeralEditor`, §6.14)
    backup.js            ← Data & Backup: export/import EVERYTHING, plus the "What's here now" size readout — the Settings panel's third section (§6.15 / §6.16). Lazily imported
    discussion.js        ← TAVERN + per-world comments: threaded community chat (channel sidebar + chat pane) with a fully custom UI over the comments-plugin as a headless transport (hidden 10px hosts, onLoad/onComment + submit). Chat name follows the claimed MNO username when present (locked nick field), otherwise the free nickname; others always render as `nick #visualId` (4-char network id) since nicknames are free text. Messages render chat markdown via rich-text.js's `chatMd`; replies are a `⟦reply:id⟧` header convention (programmatic submit can't set the plugin's native `replyingTo`) with bell/toast/ding/browser notifications for replies-to-you mirrored off that header. Per-world threads (`wd-<worldId>`, mounted in the detail panels' Comments tab via `mountWorldComments`) reuse the same renderer/transport; watched threads notify through the shared bell/inbox/toast — your published worlds on every comment, threads you joined on replies/@mentions to you (implicit watch list in localStorage, rotation-cycled backends, default-off master toggle in the Tavern config). Authors can hide the tab with the editor's 💬 Comments switch (`meta.commentsOff`, server flags bit 2, default enabled). Lazily imported
    rp-engine.js         ← context construction, GM output parsing, dedicated tracker-update call, checks, death scene
    memory-system.js     ← auto-memory roll-up + manual store, rewind, digest, feeding
    npc-system.js        ← NPC catalogue: profile/portrait generation, last-seen, pruning
    npc-life.js          ← off-screen NPC private life: background tick advancing unseen NPCs' mini-goals + NPC-owned memories (§6.6)
    map-system.js        ← POI minimap engine: scale tiers + units, POI call, placement guarantees, travel
    trackers.js          ← tracked state engine: def parsing, context sections, `[TRACKERS]` parse, derived formulas
    stats.js             ← hero-attribute engine: parsing, clamping, tiers, ATTRIBUTES context, skill checks
    world.js             ← single-file world loader: schema constants, loadWorld/normalizeWorld, WorldStore
    tag-row.js           ← the shared world tag row drawn by every card: the special-marker (nsfw/remix) + author chips, and the one-line `…` overflow fit (§6.10)
    search-bar.js        ← the shared toolbar all card pages wear: search field (drawn magnifier + ✕), the ⚙ Filters disclosure with its count badge, the ⇅ sort menu and the page's own labelled switches (Adventures' Group by world, Worlds'/Explore's ⊘ NSFW), plus the anchored-popover plumbing and the phone fit test (§6.10 / §6.11 / §6.14)
    world-editor.js      ← in-app world editor (tabs, AI craft/split, NPC avatars, validation). Lazily imported and preloaded on idle, so it is off the boot path but already there when the first ✏️/＋ click lands (§6.9)
    context-budget.js    ← world editor's Context tab: per-turn token estimate (read-only, off the play path); reached only through world-editor.js
    character.js         ← character data model + character-sheet string for the GM context
    bio-words.js         ← EDITABLE content: word pools + genre rules for hero creation's non-AI "🎲 Randomize" (§6.10). Lazily imported — fetched on the first 🎲 press, never at boot
    lorebook.js          ← lorebook model + relevance selection (normalize, keywords, loreForTurn)
    bm25.js              ← tiny BM25 retrieval (tokenize, rank) for lore / memory / NPC roster relevance
    embeddings.js        ← local semantic vectors (MiniLM ONNX in a worker) fused with BM25 via RRF; kv `embvec` cache + weekly sweep (never in saves)
    text-utils.js        ← {{user}} placeholder resolution (hero name) — every AI call runs its text through this
    rich-text.js         ← the one displayed-text renderer: `**bold**`, `*italic*` and `` `code` `` (+ `.q` quoted speech and line breaks for the transcript), shared by the transcript, world cards/details panels (own and community) and the changelog (§6.17)
    storage.js           ← SessionStore + HeroStore (kv), export/import, validation; the session index caches each hero's list thumbnail (§6.11)
    image-utils.js       ← inline portraits (NPC/hero ≤512px WebP data URL, JPEG fallback; bitmap-first decode via createImageBitmap, output unchanged) + the shared WORLD COVER caps (`COVER_MAX_DIM` 1024, unified `WEBP_QUALITY` 0.8) + the hosted-upload Blob pipeline (`fileToWebpBlob` / `blobToWebpBlob` / `dataUrlToWebpBlob` → `uploadPlugin`; createImageBitmap off-thread decode, canvas toBlob async encode, no base64 round-trip, always re-encodes so EXIF/XMP is stripped; community.js covers + profile avatars use it) + `portraitThumb`/`portraitSig` for cheap list thumbnails + `sceneImageToWebp` (scene JPEGs → WebP at native resolution, §6.11) — world-editor.js cover studio (`encodeCover`/`encodeLogo`/`logoToCanvas`/`drawCombo`) uses the same bitmap-first decode, output unchanged
    back-close.js        ← closes modal overlays on the device/browser Back button (§6.10)
    nav-history.js       ← the ONE navigation module: landing/session/profile hash + history (syncHomeHash, landing pushes, bridge returns). All URL/Back work goes through here — never raw pushState/replaceState for a home route (§6.10)
    view-count.js        ← home shell's compact view counter (#viewCountEl, in the nav foot)
    storage-info.js      ← the browser's side of storage: `readBrowserStorage()` (`{usage, quota, persisted}` from `navigator.storage`) + `fmtBytes` — feeds the Settings panel's **Browser report** / **Persistent storage** rows (§6.16, moved there from the nav foot)
    chip-input.js        ← the shared tag field (`createChipInput`): chips + an inline box — the world editor's `tags` and lorebook `trigger words`, and Settings' `Blocked tags` (§6.9 / §6.16); reached only through world-editor.js / community.js (both lazy)
    narrator-prompt.md   ← EDITABLE (engine config): GM system prompt — don't edit to change game content
    image-prompt.md      ← EDITABLE: template for the AI-generated 🎨 Scene image prompt
  game/                  ← CONTENT LAYER
    worlds/              ← bundled single-file worlds (one world = one JSON)
      manifest.json      ← ordered [{file, default?}] listing them (a static site can't enumerate a dir)
      mno-grb.json       ← bundled DEFAULT world (Goddess Reborn — isekai fantasy)
      mno-chr.json       ← also bundled (Cum Healer RPG)
    templates/           ← new-world templates (manifest.json + blank/narrative/fantasy/space/cyberpunk/modern)
```

The world file holds `narrativeVibe`, `lorebook`, `scenario`, `start`, `imageStyleTags`,
`imageNegativeTags`, `stats` (settings + defs), `trackers`, `npcs` (standing cast) — loaded by
`world.js` and injected into the AI context. Editing a world changes the game on next load; the
`.js` files under `src/scripts/` are engine logic and shouldn't need touching for content work.

### main.pjs (top-level imports only)
`main.pjs` is deliberately minimal: `$meta` + plugin imports, no runtime logic — everything the app
executes lives in `src/scripts/`.
```pjs
generateText = {import:ai-text-plugin}
generateImage = {import:text-to-image-plugin}
kv = {import:kv-plugin}
uploadPlugin = {import:upload-plugin}
createServerSocket = {import:server-plugin}
copyTextPlugin = {import:copy-text-plugin}
commentsPlugin = {import:comments-plugin}
```
`index.html`'s classic `scripts/boot.js` exports these to the ES modules
(`window.genText/genImage/kv`) since module scripts can't see bare globals — it reads them off
`root` (the portable way in from `src/`).

The **catalog server** is the `<script type="text/x-server-plugin">` at the bottom of `index.html`
(the engine picks up that element by its type wherever it sits; it's kept last so the document body
stays readable). It holds only catalog metadata (never world content) and is PUBLIC source — see §6.14.

---

## 4. World format (single-file worlds)

One world = one JSON file (`format: "mno-world"`, `version: 1`), exported with the `.mno-world`
extension (adventure saves `.mno-adv`, lorebooks `.mno-lore`, full backups `.mno-backup`) — a
downloaded world is named after its **title**, not its id (`Goddess_Reborn_Isekai_RPG.mno-world`; the
same `<name>` rule `exportState` follows for adventures) — while the payload is still plain JSON and
the extension is only a label so each import picker filters to the right kind of file. `loadWorld` in `src/scripts/world.js`
is the **single choke point** that turns any world text into the canonical runtime object, so every
downstream consumer behaves identically no matter the source (bundled default, imported file, or a
kv-stored user world). All fields optional except `meta.id` / `meta.name`.

- **`meta`** — `id` (immutable slug: lowercase/digits/hyphens), `name`, `description`, `author` and
  `authorId` (**the author line, written by the app** — there is no author input). `author` is the
  username shown on the card, `authorId` is the stable community
  id behind it (the same 16-hex `userId` the catalog knows you by), so a rename never has to be guessed
  at by name,
  `tags` (≤ 5 author tags; the reserved markers `nsfw` and `remix` are never stored here — see §6.9/§6.10), `cover` (image URL),
  `authorNotes` (unlimited Markdown draft text, always kept locally — publishing uploads it but
  never rewrites the field; the catalog keeps only the blob's 32-char upload ID; see §6.14),
  `origin` (`"imported"` when the file arrived via import — the card footer reads it instead of an author tag;
  authorship still wins: a world stamped with your own `authorId` reads "My World" regardless),
  `createdAt`/`updatedAt`.
- **`narrativeVibe`** — the GM's narrative tone (e.g. `Ecchi, funny, adventure, exploration`),
  injected as `NARRATIVE VIBE` on every reply.
- **`lorebook`** — the world bible as a **list of canon entries** (see §6.7).
- **`scenario`** — permanent world premise, injected into **every** GM reply.
- **`start`** — opening scenario, injected only for the first 20 turns (`RPEngine.startTurns`).
- **`imageStyleTags` / `imageNegativeTags`** — tags appended to / excluded from scene-image
  generations (hidden from the user). Scene images always follow the engine's 🎨 Scene template.
- **`stats`** — the hero's **player-owned stats** (§6.4): `pointsPerLevel`, `ccBudget`/`ccFloor`/`ccCeiling`
  (creation point-buy pool, floor, and ceiling — default 20), `averageThreshold`/`exceptionalThreshold` (UI color tiers and
  check-modifier breakpoints), `modStep`, `dieSides` (skill-check die faces, default 20), and the optional
  custom check-modifier formula (`useStatModFormula` + `statModFormula` — see §6.4), and `defs[]` (per-stat
  `key`/`label`/`hint`/`start`/`max`/`rules`).
- **`trackers`** — the **tracked state/resources** the AI keeps up to date (§6.3). Each: `key`,
  `label`, `icon`, optional `hint`/`color`, `type` (`number`/`text`), optional `max` (renders a health
  bar), `start`, `show` (`header`/`hero`/`both`, default `both`), and `rules`. `max`/`start` may be
  **stat-derived formulas** (§6.3).
- **`npcTrackers`** — the **per-character tracked state** the AI keeps up to date, one copy per NPC
  in play (§6.3.1). Same schema as `trackers` minus `show` (NPC values are never in the header bar).
  Absent/empty = the feature is off for that world.
- **`npcs`** — the world's **standing cast** (world editor NPC tab): each `name` (required, unique)
  plus optional `age`/`gender`/`race`/`appearance`/`job`/`persona`/`secrets`/`extra`, an optional
  `trackers` map of per-character overrides: a starting value (`{ "trust": 60 }`) and, for a tracker
  with a **literal** max, a per-character cap (`{ "trust.max": 80 }`) — literals (never formulas),
  merged over the def's own `start`/`max` when the character first enters play; set on the NPC tab's
  per-character **NPC Trackers** section, or in Raw JSON),
  and an optional `avatar` (WebP data URL, JPEG from older versions also loads). See §6.6.
- `scenario`/`start`, lorebook `content`, and cast fields may use the `{{user}}` placeholder, and so
  may the narrator prompt itself. **Every prompt that carries such text resolves it to the hero's
  name before the AI sees it** — the model never receives the raw token (§6.2).

### Bundled worlds
`src/game/worlds/manifest.json` is an ordered array of `{ "file": "…json", "default": true? }`; the
entry flagged `default` (else the first) is the engine's universal fallback world
(`mno-grb.json`, world id `goddess-reborn`). Every bundled world shows in the landing **Worlds**
gallery badged **✦ MNO** — except any tagged `nsfw`, which the landing's filter hides by default.
**To add a bundled world: drop the `.json` in `src/game/worlds/` and add one line to `manifest.json`**
(it won't appear without the manifest entry).

### New worlds — templates
`＋ CREATE WORLD` fetches a template picker: `src/game/templates/manifest.json` lists every template,
each pointing at a JSON file of the same schema (usually with empty `meta.name`/`id`, filled in at
creation). **`blank.json` is listed first and is all-empty** (0 stats, 0 trackers). Bundled templates:
`narrative.json`, `fantasy.json`, `space.json`, `cyberpunk.json`, `modern.json` — the genre templates
each ship 10 stat defs (with GM `rules`) and 10 trackers (location/quest/level/exp/hp + a
theme-specific money tracker + theme extras), except `modern.json` (8 stats / 7 trackers:
day/time/location/level/exp/cash/stamina). Each genre template's `exp` tracker is **statically
capped at 100** (`"max": 100`, same as AI-crafted worlds), so hitting 100 levels the hero up and
resets exp — this lights up the level-up directive/backstop described in §6.3. **`narrative.json` is the no-rules story mode**: 0 stat
defs (so the wizard skips the stat step, no skill checks ever fire, and level-up grants nothing) and
exactly 4 header trackers — `day` (number), `dayname` (text weekday), `time` (text 12-hour clock,
e.g. `10:00 AM`), `date` (text `D Mon YYYY`, e.g. `1 Jan 2027`), which the GM advances in lockstep.
Adding a template = drop a file in `src/game/templates/` and add one line to its `manifest.json`
(keep `blank.json` first).

### Third-party scenario import
⭱ Import World also accepts **scenario files** (currently `unseen-scribe-library-scenario-v1`
`.scenario.json`). `src/scripts/scenario-import.js` carries the file's own words over verbatim —
`premise` → `scenario`, `openingScene`/`starters[0]` → `start` — and invents nothing. A loading
panel then reads the **live template catalog** (`src/game/templates/manifest.json` + files, so it
tracks whatever templates exist), asks the AI which template's stats/trackers fit the scenario's
genre, and applies that template's rules layer (stat config + defs, trackers, vibe, image tags,
genre tags). Provenance rides on `meta.origin: "imported"`, which the card footer reads as
⭱ Imported — never an author tag. The AI's pick arrives preselected as the 👍 Recommended card in a Choose world preset list; the player confirms or overrides it. Blank fallback
when the AI doesn't answer. The story text is never touched. Formats live in the
`SCENARIO_FORMATS` registry at the top of `scenario-import.js` — adding one is a single entry
(`format` + `source` + `extensions` + `detect`/`convert`, reusing `makeImportedFileForm`); the
import flow, panel, template match, footer and failure message all read the registry, so no other
file changes. A second Unseen Scribe format, `unseen-scribe-library-scenario-mno-v1`, is the
Library's MNO-backed envelope: it embeds the complete original world (`mnoWorld`) beside the
scenario prose. That entry is flagged `complete` — the converter restores the world verbatim
(stats, trackers, cast with avatars, lorebook, vibe, image tags; only `meta.origin` is stamped
`"imported"`), keeps its id so the usual bundled/existing collision handling applies, and the
import flow skips the AI template panel for it entirely.

### Inbound share (the return path — other libraries link IN)
This engine accepts incoming worlds at `https://perchance.org/<generatorName>?importdata=[<name>~]<32hex>.gz`
(`<name>` is an optional cosmetic prefix, same `~` convention as the outbound handoff; the token
is the bare upload-plugin filename). The token is fetched **only** from
`https://user.uploads.dev/file/<token>` — never an arbitrary URL — with an 8 MiB compressed /
16 MiB decompressed / 15 s timeout bound, gunzipped when needed, then imported exactly as if the
player had picked the file in ⭱ Import World: full restore for `mno-world` files and MNO
envelopes (usual id-collision handling), the AI template panel for story-only scenarios, the
standard failure popup otherwise. The parameter is consumed once (stripped from the URL on read
plus a session guard), so a reload can never re-import. This is the contract a sender (e.g. the
Unseen Scribe Library's outbound destination) builds its "send to MNO engine" link against.

### ✨ Craft with AI
The picker's first card (**Craft with AI**, a special `.tp-ai-card`) swaps the panel to an AI view: a
large textarea, **← Back** / **✨ Craft World** in the footer. The description is fed to
`craftWorldWithAI` (`scripts/main.js`), which returns a complete world file (JSON text). A crafted
world takes the AI's suggested name automatically and is **saved to the world library at once**, then
the **World Editor** opens on it. (Templates prompt for a name before opening.)

**The output token cap is the defining constraint** (~1024 output tokens per reply; the
`ai-text-plugin` ignores a `maxTokens` option entirely). A whole world can't fit in one call, so
`craftWorldWithAI` builds it in **6 staged calls**, each under the cap and sharing an identical
instruction prefix (`craftBase`) for prefix-cache speed:
1. **spine** — meta (name/description/tags), narrativeVibe, scenario, start, image tag lines;
2. **hero attributes** — `stats.defs` (7);
3. **tracked resources** — 10 trackers (5 required: location/quest/level/exp/hp; `exp` capped at 100;
   plus 5 unique to the genre; day/time deliberately not mandated);
4. **lorebook (1/2)** — 8 entries (overview, premise, 4 locations, 2 factions);
5. **lorebook (2/2)** — 8 entries (magic/tech, law, culture, history/events, item, creature);
6. **cast** — 5 NPCs.

Each stage is recovered via `extractAiValue` (strip code fences → slice from first `{`/`[` → strict
`JSON.parse` → vendored `jsonrepair` → `closeTruncatedJson`). `aiCraftStage` retries required stages
once; optional stages degrade to `null`. The assembled pieces pass through `coerceWorldFile`
(defaults every missing key, slugifies/dedupes stat & tracker keys, normalizes lore, **appends the 5
`WORLD_CORE_TRACKERS`** if omitted, and **forces the 3 `CORE_GAMEPLAY_TRACKERS`** — `level`, `exp`,
`location`, the keys the engine itself uses — to the right type/show). Result: the editor always opens
a complete, valid world and level-up + map are guaranteed to work. **To adjust what the AI builds,
edit the `craft*Task` builders and the stage list, not the schema shape.**

---

## 5. Save / data model

### Session state (one per session, stored in kv folder `rpg` under `session_<id>`)
```jsonc
{
  "version": 2,                 // v1 (no worldId) still imports
  "id": "adventureId",
  "worldId": "goddess-reborn",  // the world this adventure is bound to
  "worldName": "Goddess Reborn", // that world's display name as this save last saw it (see §6.11)
  "name": "Adventure · 8/25/2026",
  "character": {
    "name": "Rowan",
    "portrait": "data:... | src/images/portrait-placeholder.webp",
    "age": "", "gender": "", "race": "", "appearance": "", "job": "", "persona": "", "extra": "",
    "background": "",           // legacy, not shown/used by characterSheet
    "stats": { "str": 10, "agi": 10, "end": 10, "int": 10, "wit": 10, "cha": 10 },
    "statPoints": 0,            // unspent level-up points
    "statFloors": {},           // per-stat refund floor for the current level-up window
    "statCommitted": false,     // true once a level-up allocation was Saved
    "statsAwardedLevel": 1      // hero level at which stat points were last granted
  },
  "messages": [ { "role": "action", "text": "...", "ts": 0 } ],   // `rerolls`/`rerollIndex` appear ONLY once a turn has 2+ versions (lazy archives — see "Turn model")
  "initialTrackers": { "day": 1, "time": "Morning", "location": "Thornwood", "level": 1, "exp": 0, "quest": "", "hp": 20, "coins": 100 },
  "npcs": {
    "Brom": {
      "name": "Brom", "portrait": "data:...", "description": "one-line blurb",
      "details": { "age": "", "gender": "", "race": "", "appearance": "", "job": "", "persona": "", "extra": "", "secrets": "" },
      "importance": "high", "firstSeenTurn": 2, "lastSeenTurn": 5, "everSpoke": true, "pinned": false,
      "lifeGoal": "Rebuild the burned shed before winter", "lifeTick": 18  // off-screen private life (§6.6) — never rewound
    }
  },
  "memories": {
    "auto":   [ { "text": "The party defeated the ghoul lord.", "turn": 12, "owner": "world", "triggers": ["ghoul","lord"], "pinned": false, "ts": 0 } ],
    "manual": [ { "text": "Brom owes Rowan a favor.", "turn": null, "owner": "Rowan", "triggers": ["brom"], "pinned": true, "enabled": true, "ts": 0 } ],
    "digest": "bounded string (≤800 chars) of world-owned public history that fell off `auto` (§6.5)"
  },
  "latestSituation": "one-line present-tense snapshot of where the story stands (refreshed each roll-up, always fed as LATEST SITUATION)",
  "latestSituationTurn": "session turn the situation was last written (roll-up or hand-edit) — ages the GM line",
  "openThreads": [ "one-line 'what is in motion now' items" ],
  "map": null,                  // { loc, status: loading|ready|error, pois, hero, scale: indoor|local|outdoor|regional|planetary|system|galactic, at }
                                //   scale sets the unit of poi.dx/dy and hero.x/hero.y (m, km, AU or ly) — see §6.8
  "mapCache": {},               // per-region POI cache: { [regionKey]: { pois, hero, scale } } — last 12 regions
  "surroundingsLoc": null,      // last region whose SURROUNDINGS were fed to the GM
  "surroundingsPos": null,      // hero position when SURROUNDINGS were last fed
  "turn": 0,                    // stable per-send counter (re-rolls/edits don't inflate it)
  "messageCount": 0,            // append-only counter (ordering/firstSeen) — NOT a turn count
  "lastAutoMemoryAt": 0, "lastAutoMemoryTurn": 0,
  "lastNpcLifeTurn": 0,         // background off-screen NPC life cursor (§6.6) — engine-level, like the memory cadence
  "openingRerolls": { "0": [ [ /* reply message arrays for the action-less opening turn */ ] ] },  // only once the opening has 2+ versions
  "settings": { "showInnerThoughts": false, "rollChecks": true, "simNpcLife": true, "showTrackerChanges": true }
}
```

### Message roles
- **`action`** — the player's typed input. Right-aligned bubble with portrait + name. Carries the
  turn's re-roll version history: `rerolls[]` (array of GM-reply message arrays) and `rerollIndex` —
  but **only when the turn has 2+ versions** (lazy archives; a single-version turn stores nothing).
  A `kind` registered in `SYSTEM_ACTIONS` (currently `travel`, set by the map's Travel button) marks
  an **engine-generated** action — its text was written by the app, not typed by the player — and it
  renders in the left-aligned **system bubble** (`systemEl`) instead of the player bubble. Registering
  a new kind there is all it takes; unregistered kinds keep the player bubble. Edit/delete work the same
  either way.
- **`direct`** — a player **command** (⚡ Direct OOC direction, or the ⏩ Advance anchor). The GM treats
  it as authorial direction, never an in-world action. It anchors its own turn with full Edit / Re-roll /
  Delete + version history, and is one of the two entries in `SYSTEM_ACTIONS`, so it wears the **same
  system bubble** as an engine-generated action (see the `action` bullet) — only the badge and label
  differ. Advance's anchor carries `kind:"advance"` and is deliberately *not* registered: it renders as a
  `✦ ✦ ✦` scene-break divider instead (no action text).
- **`meta`** — system notes; also the `✦ ✦ ✦` scene-break divider (`parseGmOutput` converts any
  separator-only line the AI writes into one).
- **`image`** — a scene image from 🎨 Scene (player-only). Standalone turn in `groupTurns`; rendered
  as a right-aligned clickable thumbnail opening a lightbox (`src/scripts/lightbox.js`: ◀▶ buttons +
  arrow keys + finger-following horizontal swipe to browse, vertical swipe / tap-around / ✖ to close).
  **Never sent
  to the AI** — filtered out of `buildContext`, `memory-system.rollUp`, `npc-system._storyExcerpt`.
  The 🖼 **Gallery** grid (`galleryItems` in `src/scripts/scene-images.js`) and the lightbox browse set are both
  ordered **newest batch first** (newest scene images on top).
- **`narrator`** — GM prose; plain prose, no bubble, muted tone.
- **`npc`** — NPC dialogue (`name` → looked up in `npcs` for portrait/profile). Bubble with avatar +
  uppercase name. An NPC name/portrait in the transcript is clickable (see §6.6). If `name` matches the
  hero — the GM wrote a line for the player instead of voicing an NPC — the bubble falls back to the
  hero's portrait and clicking opens the Hero panel (§6.6).
- **`thought`** — an NPC inner thought (`[Name inner]`). Private — hidden unless
  `settings.showInnerThoughts`; always fed back to the AI. Shown as an italic dashed 💭 bubble.
- **`check`** — a resolved skill check (dice pip). Never fed to the AI.
- **`choice`** — a set of choose-your-own-adventure options the GM emitted as `[[CHOICE: ...]]` lines
  (§6.12). Carries `options: [string]` (no `text`). Rendered as a button column, but **only on the
  latest reply** and only while no newer player turn exists; clicking one submits it as the player's
  `action`. Never fed to the AI (excluded from `fmt`/`recentChatText`, the memory roll-up and
  `npc-system._storyExcerpt`).

### Turn model
A **turn** = one anchor message (`action`/`direct`) + all following GM parts (`narrator`/`npc`/`meta`)
up to the next anchor. An **opening turn** has no action (index 0); its re-roll versions live in
`state.openingRerolls[turnStart][]` with `state.openingRerollIndex`. Empty-field sends (or bare Enter)
anchor an **idle turn**: an empty-text `action` with `kind:"idle"`, rendered as a one-line `Waiting`
system bubble (`SYSTEM_ACTIONS.idle`, delete-only like Advance). The GM advances the story on its
own and the reply stands alone as that turn's parts, so idle turns delete/re-roll exactly like
action turns. Exception: an empty send while the transcript ends on an unanswered anchor (its reply
was deleted) retries that anchor's reply instead of stacking an idle turn on top (`send()`).

**Lazy version archives.** A turn with only ONE version stores **no** archive at all — its live
transcript tail *is* version 0, so the reply is never duplicated in the save file (which would
roughly double a file's size). The archive (`action.rerolls` / `openingRerolls[start]`) is
materialised on the **first re-roll**, which stashes the pre-re-roll reply as version 0 before
appending the new one (`rerollTurn()`). So while a turn has a single version, `rerolls`/`rerollIndex`
are simply absent, and every reader treats "absent" as "exactly one version" (`((turn.action.rerolls ||
[]).length || 1)`). Prune (`runPruneCommand`) drops the archive again rather than keeping a one-item
array, and edits/continuations only write into an archive that already exists. Older saves that still
carry single-version archives are compacted once on load/import (`compactVersionArchives()`, §6.11).

> `turn` is a stable counter (incremented once per anchored turn; re-rolls/edits/deletes never inflate
> it). `messageCount` is append-only and *not* a reliable turn measure — memory uses `turn`.

---

## 6. Subsystems

### 6.1 RP loop & commands

One turn: the action is appended (`turn++`) → `buildContext` (§6.2) → `generateText` with the narrator
prompt → a streaming bubble → parsed messages. A dedicated **tracker-update call** then writes the
`[TRACKERS]` block (§6.3); when `rollChecks` is on, a **referee call** decides a skill check first
(§6.4); the auto-memory check runs (§6.5); level-up points are granted (§6.4); a location change
refreshes the map (§6.8); an alive→dead transition runs the death scene (§6.3). Every turn is
edit / re-roll / delete able, and the player can **stop** mid-stream (§6.13) — the partial reply is kept
and the turn's remaining AI calls are skipped.

`parseGmOutput`: `[Name] "…"` → an **npc** message (own bubble + portrait on first appearance);
`[Name inner] "…"` → a **thought**; `[[NPC: Name]]` → an `npcPromotes` flag, and
`[[NPC: Name | excerpt]]` also collects the GM's own short description as an `npcNotes` entry (§6.6);
everything else → **narrator** prose.

**Commands** (the `⋮` button, built from the `COMMANDS` registry in `main.js` — add new ones there; the
🎨 Scene button is separate):

- **⚡ Direct** (`runDirectCommand`) — sends an OOC direction as a `role:"direct"` turn, shown in the
  shared **system bubble** (`SYSTEM_ACTIONS`, §5) with a `⚡` badge; the GM receives it as a
  `NARRATION DIRECTIVE (OOC)` and weaves it into the fiction without acknowledging it.
- **⏩ Advance** (`runAdvanceCommand`) — takes no input; concludes the current scene and opens the next,
  as a `{role:"direct", kind:"advance"}` `✦ ✦ ✦` divider plus a GM reply under the `kind:"advance"`
  scene-transition instruction. Independently deletable/editable/re-rollable.
- **🎨 Scene** (`runSceneCommand` / `openSceneModal` in `src/scripts/scene-images.js`, also ⋮ menu > Scene) — generates scene images. The modal has an editable
  **prompt** (AI-drafted from `image-prompt.md` + scene/NPC context; ⟳ re-rolls it), an **amount** (1–4,
  global `mno.scenePrefs`, auto-saved on click) and an **aspect ratio** (square/portrait/landscape/random,
  same global pref). Generation appends the world's style tags (hidden from the user); results land
  as player-only `image` turns. The 🎨 button beside the chat input is a shortcut (`quickSceneImage`):
  no modal — it drops the placeholders at once using the saved prefs while the AI writes the prompt.
  The panel's prompt drafting is **Auto** by default (purely from recent chat), with a **Direct**
  toggle that opens a ≤300-char directive box appended on top of the regular instruction to steer
  framing/subject. The toggle position persists in the same global pref; the directive box itself
  always opens empty. In **Auto** the prompt is drafted up front and editable (⟳ re-rolls it); in
  **Direct** the prompt field stays hidden and nothing is drafted until you press Generate — the
  prompt is then written from the directive with placeholder boxes already in the chat, exactly
  like the instant 🎨 shortcut. Whether the 🎨 button
  beside the chat input generates immediately or opens the panel lives in Settings → Interface.
  **Character refs (experiment):** before the finished prompt is sent to an *external* image
  provider, the prompt text is searched for hero + NPC name hits (`nameHit`, same rule as strict casting)
  and each hit with a real avatar is attached as a reference image (first-mention order, max 4;
  `src/scripts/scene-refs.js`), with `Image reference 1 is <Name>. …` lines appended to the
  prompt plus a likeness-only direction (avatars are front-facing busts, so without it the
  model copies the pose — everyone facing the camera — instead of just face and clothes).
  OpenRouter sends them as `input_references`; OpenAI GPT-image models via
  `/images/edits`; DALL-E and Perchance AI can't take image input, so those paths send the
  prompt unchanged (no ref lines). If a model rejects the references (OpenAI 400/404 on
  edits, OpenRouter 400), the call retries once with neither the images nor their prompt
  lines (`barePrompt`); anything else (auth, rate limits) throws as before.

Editing replaces only the action text; editing a GM reply re-parses `[Name]`/`[Name inner]`; re-roll
regenerates the whole reply and materialises the version archive (§5), with `◀ n/N ▶` in the UI;
deleting removes the whole turn (*Delete reply* just the GM parts). Deletes/edits never decrement
`turn`/`messageCount`, and every transcript-rewriting flow calls `rewindFromTurn` (§6.5).

### 6.2 Context construction (what the GM "sees")

**Prefix-cache friendly — static first, volatile last, with one deliberate exception**
(`RPEngine.buildContext`): the banked prefix runs instructions → sheet; the hero's live
tracked values break it most turns (that is the price of the hero-first flow — sheet stats
themselves only change on level-up, so the sheet line itself is near-static). Lore then
flows general → current → episodic (lore → situation → threads → memories); the small
stable situation + threads (~120 tokens together) recompute when the lore selection
changes, which is cheap and intended.

1. **GM INSTRUCTIONS** ← `src/scripts/narrator-prompt.md` (mostly static). `{{user}}` is resolved for
   every AI call by `subUser()` (`text-utils.js`) on the way out, so no section leaks the raw token. The
   prompt also states the **canon-name rule** for NPCs, naming the context headers verbatim — **keep
   those labels in sync** with the `parts.push(...)` headers in `rp-engine.js` (`NPC PROFILES`,
   `TRACKED STATE`).
2. **NARRATIVE VIBE** ← the world's `narrativeVibe`.
3. **WORLD PREMISE** ← the world's `scenario` (always injected).
4. **STARTING SCENARIO** ← the world's `start` (only while `state.turn <= 20`).
5. **CHARACTER SHEET** ← `characterSheet()` + **ATTRIBUTES** (player-owned stats — the GM uses them but
   never changes them; stats only change on level-up, so this line is near-static).
6. **TRACKED STATE** ← the hero's live values + each tracker's rules (§6.3; the narrative GM does not
   output the block). Rides directly under the sheet as the hero cluster; HP and friends live
   here, not in stats.
7. **WORLD LORE** ← the lorebook's per-turn relevant subset (§6.7; BM25 + embedding hybrid — paraphrases like `sword` recall a `blade` entry), each entry tagged `◆ [type]`.
8. **LATEST SITUATION** ← `latestSituation`.
9. **OPEN THREADS** ← `state.openThreads` (4–6 one-liners, always fed).
10. **MEMORIES** ← manual notes always + hybrid-ranked auto entries whose owner is in the scene (§6.5).
11. **DISTANT PAST (digest)** ← `state.memories.digest` (always fed, never re-recorded).
12. **NPC PROFILES** — one section, three tiers: **Active** (recent `[Name]` speakers,
    up to `FULL_PROFILE_CAP` = 4 — full dossier + secrets; a merely mentioned name is not
    presence and never earns a dossier), **Present** (hooks only: the present roster minus
    Active — named in scene or seen within `NPC_RECENT_SEEN` = 3 turns — ordered by fused
    relevance rank, recency-only faces by most-recently-seen, max 4 hooks together with
    speaker overflow), **Others** (never secrets: 2 BM25 relevance-ranked faces from idle met + unmet cast
    tagged `(unmet)`, ×1.5 high-importance boost, then 2 sticky round-robin faces held
    3 turns so a big cast surfaces over time; empty relevance when nothing scores; dossiers +
    hooks together never exceed `NPC_TOTAL_CAP` = 10 per turn, later tiers yielding first; the
    tier tells the GM never to invent looks/voice/history a hook doesn't state; placeholder-only fields
    (blank, "—", "none notable") are omitted label-and-all, and the Secrets rule lives on the
    Active/Present tier headers instead of every dossier line). On the opening turn (no chat or
    action yet) the world's `start` text stands in as the roster query, so the scene's named cast
    surfaces first. Unmet cast is hooks-only — except on the opening scene, where cast named
    in the `start` text get full Present dossiers (cap-respecting) so the GM can write their
    entrance with full psychology; everywhere else the full dossier arrives once they're met.
    `high` importance is not presence.
12. **NPC TRACKED STATE** ← a world's `npcTrackers` rules, once for the whole cast (values ride on
    each dossier line above; §6.3.1). Tail of the NPC cluster.
13. **SURROUNDINGS** ← the current location + every POI with type, distance and compass direction — only
    when `surroundingsToFeed` says the GM needs it (§6.8).
14. **RECENT EVENTS** ← the last `RECENT_TURNS` (10) turns of raw transcript, formatted per role, with a `REPLY:` cue line between each player turn and its GM response (GM narration itself is unlabeled). On Perchance AI the window is fitted to the input cap (`PERCHANCE_INPUT_CAP`, `perchance-limits.js`), measured with the exact plugin counter: the full window is kept while it fits; otherwise the whole SURROUNDINGS map section drops first (the map panel itself is untouched — just this turn's GM feed), then rotation hooks (relevance hooks are never cut — dossiers and overflow hooks, incl. active-speaker overflow, never trim either); then the oldest already-baked turn drops (its events live in MEMORIES + the standing record), one at a time until it fits — never below 5 newest turns, never an unbaked turn; only with nothing left to drop does stale narration middle-cut (`[...]`) one turn at a time, oldest first — each turn is exhausted before the next is touched, stopping the moment the prompt fits, so only the newest 3 turns are guaranteed verbatim. The truncation numbers, all in rp-engine.js: paragraphs at/below 200 chars (`GM_NARR_MIN_MSG`, the only narration floor) are never shortened; longer paragraphs keep roughly their first + last quarters (~half — a 255-char paragraph keeps ~62+62); cuts saving under 16 chars don't count. Narrator messages are paragraph-chunked (one paragraph per message), so inside a long turn even mid-length paragraphs trim. Dialogue, thoughts, player turns, and the newest 3 turns are never shortened. External providers keep the full window.
15. **LATEST ACTION** ← the new action, or a `kind`-specific instruction (advance / travel / death /
    direct / opening / idle), or a skill-check result.
16. A closing instruction on reply formatting (prose, `[Name]`, `[Name inner]`, `[[NPC: Name]]` /
    `[[NPC: Name | excerpt]]`).

**Retrieval (hybrid BM25 + embeddings).** Lore, memories, and NPC rosters rank by BM25 fused
(reciprocal-rank fusion) with local embedding cosine (`scripts/embeddings.js` + `scripts/bm25.js`).
The embedding side is a quantized MiniLM model run in a worker (downloaded once, ~23MB, cached by
the browser) — it recalls true paraphrases (`sword` → `blade`, `grieving mother` → `Mira`) that
score BM25 zero. A cosine floor (0.25; unrelated pairs calibrate <0.20) keeps quiet scenes feeding
nothing. Vectors are a derived cache in kv `embvec` (never in saves/exports), warmed on session
enter and after roll-ups, swept weekly (5000-entry cap + 60-day age + stale-model keys). Every
path degrades to BM25-only: cold model, worker failure, and timeouts never block a GM turn.

### 6.3 Trackers (AI-tracked state)

Defined per world (§4). The **AI owns the values**: after the reply, a small focused call is fed the new
reply + current values + rules and outputs a `[TRACKERS]` block (one `key: value` line each). A failed or
blockless call **keeps the previous snapshot** (never zeroed); numbers are clamped to ≥ 0 and to `max`.

- Each GM message carries **`afterTrackers`** (the snapshot after that turn). The live state is
  **derived** from the messages (`getCurrentTrackers` = the last message's, falling back to
  `state.initialTrackers`), so delete / re-roll / edit / version-navigation reverts automatically.
- The narrative GM sees trackers only through the **TRACKED STATE** section; it never writes the block.
- **UI**: the tracker bar (`#trackerbar`), one chip per tracker (`show ∈ {header, both}`; a `number` with
  a `max` renders a health-style bar). `show ∈ {hero, both}` also appear in the 🛡 Hero panel's read-only
  Status section, repainted in place by `refreshHeroTrackerRow` so an update never rebuilds the panel. On
  phones the bar is one scrollable row with a ▼/▲ toggle centred on its bottom edge. The GM-reply editor
  has Narrative / Trackers / NPC-tracker sections behind flat icon buttons in the editbar (after the Full Editor switch; icons hide in full mode and in the action editor, and when the world defines no such trackers) — one row per tracker in the Trackers section (label display-only, value/max editable) so a value can be
  hand-fixed without touching the raw `[TRACKERS]` block (still available in Full Editor mode).
  `show: hidden` trackers appear here too, badged `hidden` — so saving an edit never wipes this
  turn's hidden values (everywhere else they stay invisible: header/hero bar, Hero panel,
  change chips, NPC profiles).

**Feature-critical trackers match by KEY *or* LABEL** (`matchTracker`, `trackers.js`): `lifeTracker`
(death), `levelTracker` (level-up points), `expTracker`, `locationTracker` (the map; text trackers
only), and `questTracker` (quest/objective outcome pips; text trackers only). `dayTracker` (the
calendar — day counts and dates, number or text) and `timeTracker` (the clock, with weekday names
as fallback) are separate matchers feeding the NPC life tick's time anchors (`dayValue` /
`timeValue`, same convention as `locationValue`). A hand-authored world can name them differently and the feature still works; only a crafted world
is additionally forced to the canonical keys by `coerceWorldFile` (§4). Each matcher is memoized on the
defs array (`WeakMap`), and `locationValue(defs, current)` reads the matched tracker's value.

**Quest outcome pips:** a quest tracker resolves a turn two ways at once — its value rotates to the
next quest (or empty) while a trailing ` [!completed]` / ` [!failed]` tag records the previous quest's
fate (`questDirective`, appended to the dedicated tracker call; no-op without a quest tracker).
`parseTrackerBlock` strips the tag into a `key.outcome` pseudo-entry (same convention as `key.max`) that
lives only on that turn's snapshot, so `trackerDeltas` renders two chips under the reply: a whole-chip
green/red status chip (`📜 QUEST COMPLETED ✓ <old>` / `📜 QUEST FAILED ✗ <old>`), plus a normal-styled
`📜 NEW QUEST <new>` successor chip (skipped when the quest ends with no successor). An untagged
quest change reads the same way: `📜 NEW QUEST <new>` when it starts from empty, `📜 NEW QUEST
<old> → <new>` when it rotates from another quest. A tagged line whose value merely echoes the
previous quest is cleared to empty (a finished quest never lingers as the current one).
Deletes/re-rolls revert both automatically. The GM-reply editor round-trips the tag.

**Derived formulas:** a `max`/`start` beginning with `=` (`= end*2`, `= level*20 + 80`) is evaluated by
`evalFormula` (a safe recursive-descent parser: tracker/stat keys, arithmetic, comparisons, `&& || !`,
ternary, parens, whitelisted `Math.*`) against the hero's stats **and the live values of the other
number trackers** — so a cap may grow with another tracker. Precedence is formula > stored literal >
config literal; seeds resolve in dependency order (a cycle falls back to the literal with a warning).
An experience tracker with **no** `max` at all (neither a literal nor a `= formula`) falls back to
`EXP_DEFAULT_MAX` (100) at load time in `normalizeTracker`, so the level-up bar always has a
denominator to render (it used to show `0/undefined`) and the level-up directive/backstop engage.
Such caps are marked **FIXED** in the AI context, and `parseTrackerBlock` clamps to them (values applied
before clamping, so a cross-tracker cap sees this turn's numbers).

**Level-up reliability.** A level-up is derived from `exp` reaching its cap, but the tracker call only
changes what the turn describes, so `exp` can sit pinned at its cap with no level gained. Two
guards (the tracker keeps full authority — no engine rewrite of what the turn earned): (1)
`levelingDirective` (appended by `buildTrackerContext`) tells the model the exact cap-crossing
arithmetic whenever the world has a level tracker and a *capped* exp tracker (a no-op otherwise);
(2) `RPEngine.enforceLevelUp` runs **only** when `exp ≥ cap` after the update and applies the
corrected pair deterministically — level +1 (unless the turn already raised it, in which case the
level is kept and only the unspent exp is topped up) and exp minus the cap, floored at 0. No AI
call: the answer was always pure arithmetic, and the old focused call accepted only the exact
precomputed pair anyway, so the model could never contribute anything but latency. The token
estimator skips it (`{levelUpBackstop:false}`). The arithmetic lives in `applyLevelUpBackstop`
(`trackers.js`), shared with the GM-reply editor: a hand-edit that pins `exp` at its cap without
raising the level gets the same fix-up (measured against that turn's predecessor snapshot, so an
already-raised level is topped up, never doubled) — otherwise the bar would sit stuck full exactly
the way an AI miss does. It never undoes anything an edit granted.

**Death & game over:** the life tracker (`lifeTracker` / `isDead`) drives it. After the tracker update,
`runGmTurn` compares alive/dead before vs after; on an **alive → dead** transition it runs one more GM
call (`generateDeathScene`, `kind:"death"`) that narrates the death — no tracker update after it. Those
messages are tagged `gameOver:true`, the turn renders a game-over badge, and the composer locks
(`isGameOver`). All derived from the messages, so re-rolling/deleting the fatal turn revives the hero. A
world with no life tracker plays on, and no later turn re-triggers the scene.

### 6.3.1 NPC trackers (per-character tracked state)

§6.3's idea, but each in-play character carries their own copy of a second world def set (`npcTrackers`,
§4). Fully additive: a world without `npcTrackers` is unaffected (no extra prompt text, call or storage).

- **Values live on the message, not the NPC.** Each GM message carries **`afterNpcTrackers`**, a
  **sparse** `{ "<name>": { key: value } }` map holding only the characters that turn reported. Live
  values are **folded** from the messages (`getCurrentNpcTrackers` / `foldNpcTrackers`: the newest
  snapshot containing that character, else the entry seed, else defaults), so delete/re-roll/edit/
  version-navigation revert correctly, and a character who sat out still compares against their last
  known value.
- **Seeding:** an NPC's session entry seeds `state.npcs[name].trackers` via
  `initialNpcTrackers(defs, stats, overrides)` — the def's `start`/`max` (formulas included) merged with
  the character's per-NPC literal overrides. An override is either a start (`{ "trust": 60 }`) or, for a
  tracker with a literal max, a cap (`{ "trust.max": 80 }`, the same `key.max` pseudo-entry the live
  snapshot uses) — caps apply first, so a start is clamped to the character's own cap, and a
  formula-derived cap is fixed by the def and never overridden.
- **One call, parallel with the hero's.** `generateGmReply` extracts the `[NPC TRACKERS]` block first (so
  the hero parser never sees it), then runs the hero and NPC tracker calls in one `Promise.all` — one
  extra call, not a serial round-trip. It is fed the reply + the tracked characters' current values +
  the rules, and is capped at `NPC_TRACKER_CAP` (4) characters per turn, in priority order: those **who
  acted in the reply**, then pinned, then most recently seen. Dropped characters keep their values and
  rejoin when they act or appear again; a failed call keeps the previous values. Output is capped
  dynamically at `npcTrackerOutputCap(defs, rosterSize)` (48 + roster × (10 + 28 per def)).
- **Newcomers are tracked from their first appearance:** an NPC the reply introduces is registered
  before the tracker call (`NpcSystem.registerNew` in create-only mode) and passed as `newcomers`, so the
  call sees them on their introduction turn even though `inPlayNpcs` requires a profile that is still
  building. The normal post-turn pass does the build / notification exactly once.
- **Block & parsing:** `[NPC TRACKERS]` then `Name:` + indented `key: value` lines.
  `parseNpcTrackerBlock` resolves names leniently, skips a number line with no digits, and clamps to live
  caps. The narrative GM never sees the block (`stripBlockForDisplay` removes both blocks), and the rules
  render once as their own `NPC TRACKED STATE` section.
- **UI:** folded values render **read-only** in the NPC profile popup only (`npcTrackerStripHtml`), and
  under each GM reply `npcTrackerDeltas` shows change chips per character (e.g. `ALICE · 🤝TRUST 92
  (+15)`, gated on a real turn). They are hand-fixed in the GM reply's ✎ editor, whose NPC trackers section
  always carries one complete section per character who speaks in that turn (plus anyone the snapshot
  moved) — rows work like the Trackers tab, and removing a section (✕) leaves that character untouched;
  saving writes one value set per section against the turn's pre-turn baseline (`npcTrackersBefore`) and
  drops untouched echoes, so the snapshot stays sparse. (Full Editor mode still edits the raw block.)
- **Off-screen handoff (banked happenings).** NPC-owned auto memories the tracker call hasn't
  applied yet (`trackerApplied`) and fresh enough (`LIFE_TRACKER_LOOKBACK_TURNS`, 10 — older
  backlog was already narrated past) ride the *next* tracker call in an `OFF-SCREEN HAPPENINGS`
  section — but only for characters that turn can't already see (stale past the off-screen window
  and absent from the in-play roster, whose doings are in the reply already). Hero-involved and
  world-owned memories never bank. Off-screen names sit outside `NPC_TRACKER_CAP` (own mini-cap
  of 3, newest 2 happenings each), so absent faces never evict the roster or starve an empty one.
  Consumption is a verdict (changed and no-change alike are stamped, failures retry); the names
  the call changed off-screen land on the turn's messages as `afterNpcTrackersOffscreen`, and
  `npcTrackerDeltas` hides chips for those names unless the character speaks in that turn. A
  hand-edit of the reply keeps the marker (filtered to names still in the edited snapshot), so a
  dialogue-only edit never unsuppresses absent-NPC chips; reverting a muted change clears its mute.
- **Purge:** stored values are dropped when a def or a world NPC is removed (`purgeNpcTrackerHistory` /
  `purgeNpcTrackerKeys`, on session enter and on entry creation).

### 6.4 Hero stats & skill checks

`character.stats` — player-owned attributes from the world's `stats.defs` (`scripts/stats.js` clamps /
fills them, tiers them for colour, builds the ATTRIBUTES context section, and resolves checks). **The AI
never changes stats** — they move only when the player spends level-up points.

- **Level-up → points:** `grantLevelUpPoints` (end of every GM turn) watches the AI-tracked `level`
  tracker; each rise grants `pointsPerLevel` to `character.statPoints`, **one level per call**, so a
  tracker jump that skips levels pays out a level per turn.
- **Editing rules:** stats are read-only during play unless a level-up window is open (`statPoints > 0`
  or an un-locked allocation), when −/＋ appear. **−** refunds but never below the value at the window's
  open / last Save (`statFloors`). Spending/refunding persists immediately; **Save** re-baselines
  `statFloors`, locking that allocation while any remaining points stay spendable.
- **Skill checks:** before a player `action` reply, `RPEngine.determineCheck` (the referee) decides
  whether a roll is warranted and picks a stat + difficulty (`trivial 5–8 / easy 9–12 / medium
  13–15 / hard 16–19 / veryhard 20–24 / impossible 25–29` on a d20 — each check rolls a random DC inside its
  band, scaled to the world's die via `dcForDifficulty` so the success odds stay the same). `resolveCheck` computes `die + mod` vs DC (die = `stats.dieSides`, default 20, clamped
  2–1000); criticals generalise via `critWindow = max(1, floor(sides/20))` — a die above
  `sides − critWindow` auto-passes, one ≤ `critWindow` auto-fails (for a d20, exactly nat-20/nat-1). The
  chat shows a dice pip with a PASSED/FAILED badge; re-rolling the action re-runs the check.
  The referee otherwise sees only the previous GM turn (capped), the action, stats, location
  and time — a world may opt in to
  feeding it the last turn's tracker / NPC tracker values (`stats.checkIncludeTrackers`,
  `stats.checkIncludeNpcTrackers`, both off by default; sections are omitted when empty), plus
  an optional author-written custom instruction appended last (`stats.useCheckInstruction` +
  `stats.checkInstruction`).
- **Check modifier:** `checkMod` derives it from the stat value (below `averageThreshold` negative, above
  `exceptionalThreshold` positive, in steps of `modStep`, default 5). A world may instead set a **custom
  formula** (`stats.useStatModFormula` + `stats.statModFormula`) evaluated by `evalFormula` against
  `{ v, avg, exc, step }`; invalid input warns once and falls back to the built-in.
- **Hero panel** (`🛡 Hero`): portrait + name, the live status trackers, then a **Stats / Profile** switch
  (module-level `heroTab`) — in worlds without stats the bar shows Profile alone. The Profile tab uses the *same* renderer as the NPC profile popup,
  `bioLayoutHtml(fields, value, attr)` (short fields as label/value rows, then `PROSE_FIELDS` as prose
  blocks; `attr` ties a row to its caller's edit handler so the two bios can't drift), with
  `⟳ Regenerate avatar` / `⬆ Upload image` at its foot.

### 6.5 Memory system

`scripts/memory-system.js`. Entry: `{text, turn, owner, triggers, pinned, ts}` — `text` is 1–2 factual
sentences; `turn` the session turn (auto only — manual notes are undated); **`owner`** is who knows it
(`"world"` = public, else exact comma-separated names; `you`/`hero` fold to the hero, `everyone`/`all` to
`world`) and gates *feeding* only, so knowledge never bleeds; `triggers` recall it; `pinned` is pruning
protection (rewind on rewritten past drops unpinned auto entries, never pinned ones) and sorts the
entry first in memory lists — it never affects GM feeding, which stays owner-gate + relevance.

**Auto memory (roll-up).** Runs every `MEMORY_EVERY_TURNS` (10) turns — engine-level, on the stable
`turn` — and **excludes the last `MEMORY_LAG_TURNS` (2)** so they stay editable. A window that grew
past one cadence (missed runs, an import, an early-turn rewrite that pulled the cursor back) is
worked oldest-first in chunks of at most `MEMORY_EVERY_TURNS` turns per summarizer call, never all
at once — and on Perchance AI turns are greedy-packed into maximal-fill sub-chunks
(whole turns only, each candidate call measured exactly with the plugin counter) so no call
overflows the 6976-token input cap; external providers keep turn-only chunks). It produces a **LATEST
SITUATION** sentence (→ `latestSituation`), the long-term events (each with `turn`, `owner`, 3–6 `triggers`)
and **OPEN THREADS** (4–6 one-liners on objectives, oaths, grudges, quests, threats → `state.openThreads`,
always fed). Every entry's `text` must be self-contained (names/objects/places restated — never a
bare "it"/"they"/"this" without its antecedent in the same entry). The same call also revises: `resolve` removes memories the new events made obsolete
(exact/case-insensitive first, then a conservative fuzzy fallback needing ≥ 75% shared distinctive words
and a ≥ 25% lead over the runner-up, only for targets with ≥ 5 such words), and `ownerUpdates` **merges**
owners when knowledge spread (exact-match only — a fuzzy merge would leak). The summarizer sees only the
story transcript (tagged `[TURN n]`), never OOC/image/system text or a `[TRACKERS]` block; it is given
the previous `latestSituation`/`openThreads` as "as last recorded", told to update rather than rewrite, and
forbidden from re-recording what EXISTING MEMORIES, the digest or the kept threads already hold. Dedup is
exact plus a near-dup guard (≥ ~70% shared distinctive words, for entries with ≥ 4). The EXISTING
MEMORIES reference is capped at pinned + the newest `ROLLUP_REF_CAP` (40) unpinned (matching still runs
against the full store); the auto store itself is uncapped — every baked entry is kept and the
player curates by hand (pin, edit, delete). `state.memories.digest` is legacy only (older
sessions folded dropped world-owned entries into it, ≤ `DIGEST_MAX_CHARS` = 800, oldest dropping
off, fed as DISTANT PAST); nothing new folds in, and a **named-owner** entry was never folded
(that would leak). An unusable reply records nothing and backs the next attempt off ~
`ROLLUP_RETRY_GAP_TURNS` (5) turns; success sets `lastRollUpReport` and the toast reads
"🧠 Memory roll-up: N new · M superseded · K knowledge spread".

**Feeding** (`memoriesForTurn`): manual notes switched ON are always fed (at most `MANUAL_ENABLED_CAP`,
15, can be on); auto entries — pinned or not — split into three independent budgets: 4
scene-gated topical (`MEMORY_TOPICAL_ACTIVE_CAP`; a holder must be in the current scene — the
engine's in-play roster, `sceneNpcs`, with owners off the roster needing their name in the recent
text via `nameHit`; a hero-only entry always qualifies, while a hero+NPC shared entry needs one
of its non-hero holders present — the hero alone never pulls a shared scene back after the NPC
has left), 4 ungated topical (`MEMORY_TOPICAL_OPEN_CAP`; relevance only, no owner gate — may
bleed, deliberate experiment), and 4 reserved name-only (`MEMORY_NAME_FEED_CAP`).
Both topical tiers share one **BM25-ranked** pass (`scripts/bm25.js`: text×1 + triggers×3, ×0.4
when no trigger appears verbatim — no trigger prefilter, empty when every score is 0, fused with
embedding cosine when available) over the recent window (the last `MEMORY_TRIGGER_WINDOW_TURNS`
(3) player turns, plus the current action and location). Steps: rank everything, gated takes
the top scene-passing picks, open takes the next top picks with gated's picks removed
(`MEMORY_FEED_CAP` = 8 total backstop). The feed stays **tiered** for selection: a
recall where every matched trigger is merely one of the entry's own **owner names** is a *presence*
signal, so it draws on a reserved `MEMORY_NAME_FEED_CAP` (4; 0 disables, most-recent-first) and can
never evict a topic-relevant memory; the reserved tier additionally needs a recent speaker
(a `[Name]` voice in the last 2 turns, same window as Active — a merely present/mentioned face draws nothing from the reserved tier;
mixed owner+topic triggers still compete topically as before); hero-only
entries never take name slots, and hero-name triggers are stripped from ranking (the hero is
mentioned everywhere). Manual notes first (input order), then gated topical most-relevant-first,
then open topical most-relevant-first, then name-only most-recent-first (last-2-turns speakers'
memories only); manual notes never capped. An entry whose
event turn is inside the RECENT EVENTS window is skipped (`recentFloor`).

**Rewind on rewritten past** — every edit/reroll/◀▶/delete calls `rewindFromTurn(state, k, baked)`:
unpinned auto memories with `turn >= k` are dropped, the cursor is pulled back, and `lastAutoMemoryTurn`
is forced old so the next send re-bakes the span (dedup + resolve reconcile survivors). Pinned entries
and manual notes are never auto-removed; if the region was never baked nothing is dropped, and a deletion
that shrank the transcript past the cursor only clamps it (the load-time `normalize` clamp guards the
same invariant).

**Manual memory (player control).** The Memory panel lists auto + manual entries; the player can
add/edit/delete any and pin/unpin auto ones. **＋ Add memory** sits at the top of the Manual list and
opens a `TextPopup`. Each manual row carries an **enable switch** (`role="switch"`, ON/OFF, stored per
entry as `enabled`, default true so legacy saves stay fed): ON = always sent, OFF = kept (dimmed) but
never fed. ON notes are capped at `MANUAL_ENABLED_CAP` (15) — the list itself is uncapped — enforced on
the OFF→ON transition (`toggleManualEnabled` returns `"capped"`), and a note added while full lands
**OFF** (never refused). Auto entries list pinned-first, then newest, with a pin 📌 left and ✎/✖ right and an
owner · turn · recalls meta; manual rows use the same stacked layout minus pin/meta, outlined olive while
ON (the border a pinned auto row wears). Each tab shows a live counter (Auto: `n/200 entries · k pinned`;
Manual: `x entries · k/15 enabled`). Destructive actions route through the shared `ConfirmPopup`; editing
opens a full-field form. `latestSituation`/`openThreads` are read-only in the **Latest** and **Threads**
sub-tabs. The NPC profile popup's **Memory** tab (§6.6) is a per-character view of the same entries — a
shortcut, not a copy: Manual/Auto group headers show only when both groups are present, pinning
shows no group titles — manual notes above, a quiet rule, auto entries below (the rule hides
unless both halves exist); pinning re-sorts the lists pinned-first, and **＋ Add memory**
(directly above the auto list) opens the same full-field form as auto ✎ with owner + turn
pre-filled, writing a real auto entry — dated, triggers derived unless given, unpinned unless
pinned in the form, fed only on owner + relevance like any roll-up entry.
### 6.6 NPC system

`scripts/npc-system.js` + `noteNpcs`/panel code in `main.js`. NPCs live in `state.npcs` (keyed by name).
**Only important NPCs get a full profile.**

- **Who gets an entry** (`update()`): world-cast members (seeded from the canonical profile) and
  characters the GM flagged `[[NPC: Name]]` — the tag may carry a 1–3 sentence description
  (`[[NPC: Name | excerpt]]`), which becomes the entry's `description` (its FIRST APPEARANCE) and feeds
  the profile call. A generic speaker (guard, shopkeeper, crowd voice) gets **no entry at all**: every
  consumer of `state.npcs` (the GM context's NPC PROFILES and `inPlayNpcs`, the panel's
  `isImportant`, scene casting, the memory owner-gate) requires `details`, so a stub would be dead
  weight in the save. Their bubble falls back to `portrait-placeholder.webp`, and `openNpcFromChat` can
  still build a profile on demand. Entries are never auto-removed — the player deletes them by hand.
- **Sightings** (`firstSeenTurn` / `lastSeenTurn` / `appearanceCount` + `everSpoke`): recomputed from
  the SHOWN transcript only (`rebuildSightings`, anchored turn ordinals, opening = 0) after every
  history rewrite (edit, re-roll, version switch, delete), using the same linkage as `update()`
  (unlink flag/rules, exact, case-insensitive, `resolveEntry`, castResolve) — hidden re-roll versions
  never count, and an NPC that didn't speak that turn is never bumped. New-turn replies still use the
  incremental `update()` path (only the fresh reply). An entry with no visible dialogue but a past one
  (`everSpoke`, legacy count > 1, or dialogue in archives) is demoted to `-1` (not in shown story —
  excluded from Present recency, sorts last); never-spoke entries (promote-only / hand-added) keep
  their creation recency.
- **Importance** is assigned up front (cast → *high*, GM-flagged / hand-added → *medium*), so
  background speakers are never AI-rated — they never enter the roster. Legacy entries that already have
  details are treated as MEDIUM on load.
- **Profile generation** (`_genProfile`) invents age, gender, race, appearance, job, persona (one merged
  personality + mannerisms field), secrets (never rendered — GM-only) and a catch-all extra. It is fed
  the scene-relevant lore, the premise / starting scenario (which may fix the NPC's role) and an excerpt
  of the NPC's own appearances, so an established role is never contradicted; a flagged newcomer's FIRST
  APPEARANCE excerpt is what makes the profile match the GM's intent. **Portrait** (`_genPortrait`) is
  generated from appearance / age / gender / race / job with a scene-derived background; a placeholder
  shows until it lands and existing portraits are kept.
- **Avatars** can be uploaded (`⬆ Upload image` in the popup / Hero panel / wizard — downscaled to
  ≤512px and JPEG-encoded inline via `image-utils.js`) or taken from a cast member's `avatar`.
- **World-cast NPCs** (world `npcs`, §4): unmet cast members ride as compact hook lines
  (name — role — distinctive trait; never secrets) in NPC PROFILES' Others tier, which mixes
      them with idle met NPCs (dossier overflow first, then 2 relevance-ranked + 2 sticky rotation). A cast member enters the
  `👥 NPCs` list only when the hero **meets them in-story**, seeded **from the cast profile** (HIGH, no AI
  rating/profile call, cast `avatar` if set); `_castFields` resolves `{{user}}` so neither the panel nor
  the context shows the raw token while the world file keeps the author's shorthand. `mergePersona`
  migrates legacy `personality`/`mannerisms` keys.
- **In-context:** full dossiers (incl. secrets) go only to **Active** speakers and **Present**
  NPCs (named in scene / seen within `NPC_RECENT_SEEN` = 3; `-1` = not in shown story, never present
  via recency), capped at `FULL_PROFILE_CAP` = 4;
  pinning only sorts to the top of the UI list and does not earn a dossier; everything else shares the Others
  hook tier (dossier overflow first — speaker overflow, then present overflow, max 4 hooks —
  then 2 relevance-ranked with a ×1.5 high-importance boost + 2 sticky rotation,
  recency fallback when nothing scores). Dossiers + hooks together never exceed
  `NPC_TOTAL_CAP` = 10 per turn — the rotation yields first.
- **The profile popup (`NpcPopup`)** — two columns: the face + live values left, the profile right
  (720px; stacked under 620px).
  - **Title bar:** name + importance tag; 📌 Pin/Unpin, 🗑 Remove, ✕ (character-level actions).
  - **Left (`npcpop-left`, 240px):** the portrait, the **tracker strip** (`npcpop-trackband`, full-width
    rows, no heading, omitted when the world has no `npcTrackers`), the portrait actions
    (`⟳ Regenerate portrait`, `⬆ Upload image`), then a dim first-seen / last-seen footnote.
  - **Right:** `Profile` | `Memory` tabs (`.npc-tabs`, the Hero panel's `.hero-tabs` styling; the open tab
    lives in the popup's closure so an in-place re-render keeps it).
    - **Profile** renders `bioLayoutHtml(NPC_FIELDS, …)` — the same shared bio renderer as the Hero panel
      (§6.4): compact age/gender/race/job rows, then one prose block per `PROSE_FIELDS` entry — with
      `⟳ Regenerate profile` at its foot.
    - **Memory** is a *shortcut* to the Memory panel's own rows (`manualMemRow` / `autoMemRow`, same
      controls) filtered to the entries this NPC owns, newest turn first. **Nothing is copied or moved**
      — entries are shared references, so an edit here is the same edit the Memory panel would make. The
      label carries the combined count (`Memory (5)`). (`npcOwnedMemories` / `memoryOwnerMatches` /
      `npcMemRowsInto`, `main.js`.)
  - Field ✎ editors are hover-revealed (always visible under `@media (hover: none)`).
- **Per-character trackers** (§6.3.1): an entry is seeded with its own values on creation
  (`_seedTrackers`) and shown read-only in the popup; they are hand-fixed in a GM reply's ✎ editor.
- **Canon names / variant resolution:** the rule that a roster name must be written exactly as listed lives
  in `narrator-prompt.md` (§6.2 item 1), not in the section headers, because it must cover every roster
  the GM sees (NPC PROFILES' Active / Present / Others tiers plus WORLD LORE). It is prompt-level mitigation only — the GM
  still shortens and misspells — so every engine-side name lookup resolves variants through
  `resolveNpcName` (`lorebook.js`): exact key, then lowercase-exact, then the unique-subset rule (the
  smaller token set must be contained in the larger's, matched exactly — no typo tolerance, since
  one-letter differences are routinely different names like `Mica`/`Mira` — `[Camilla]` → the
  `Mistress Camilla DeLuna` profile, no fork; stopword-built names fall back to the raw token sets
  (`May` → `May Parker`)). Substring containment is deliberately NOT used (`Maya` inside
  `Maya's friend` is not a variant — it is a different person). Possessives never fuzzy-match, and
  an extra relational/generic word vetoes the match (`Maya friend` stays forked via `friend`). A lone
  stopword never stands in for a middle particle (`the` is not `Billy the Torch` — it may only match
  a given name in first position, keeping `May` → `May Parker`). It
  stays exact-match-safe by returning null when ambiguous: a spelling whose tokens match TWO
  catalogued characters (bare `Camilla` for both `Camilla Thorne` and `Camilla DeLuna`) forks as
  before rather than merging strangers, and two multi-word names that merely share a token without
  containing each other (`Governor Camilla` vs `Mistress Camilla`) do not resolve. Applied in
  `NpcSystem.update` (speakers keep their display spelling and link via `npcKey` — see below),
  `resolveEntry`/`castResolve`, the transcript and click lookups (`npcForSpeaker`), the tracker
  header parse, and the profile excerpt collector.
- **Display vs linkage (no dialogue renames):** `m.name` is always the GM's own spelling and is never
  rewritten — the bubble shows exactly what the GM wrote (`[Garreth]` stays `Garreth`). When that
  spelling resolves, the message carries `m.npcKey` with the canonical roster key (`Captain Garreth`):
  avatars, profile popups, appearance counts and portrait/profile builds follow `npcKey`, while the
  label stays variant. Descriptors that resolve to nothing (`Maya's friend` for a roster holding
  `Maya`) carry no key — they neither rename nor link. Internal contexts (GM history via `fmt()`,
  memory roll-up lines, profile excerpts) read the canonical key so owners and dossiers stay unified.
  A faded 🔗 after a linked bubble's name opens its link menu: open the profile, unlink that line
  (`npcUnlinked`), pin the spelling to another entry, remember it as always-separate, or forget the
  remembered rule. Remembered rules live at `state.npcLinkRules` (`unlink` = exact-only, never a
  variant; `link` = pinned target) and are honoured by `NpcSystem.update`, `npcForSpeaker`,
  `linkedCanonFor` and the profile excerpt collector, so roster and chat can never disagree.
  Unlinked bubbles (flag or rule) show a dimmer cut 🔗 instead — same menu, offering the way back
  (`Link to <auto>`, link-instead, generate-new, forget rule) — and wear the placeholder avatar,
  since `npcForSpeaker` resolves them exact-only too. Bubbles with nothing catalogued show no icon;
  their name/avatar click opens the same menu in create mode (generate new vs link-to-existing
  search), so a never-linked speaker can be pinned to a profile as well as profiled fresh.
- **Click-to-profile in chat** (`openSpeakerFromChat` → `openNpcFromChat`): profiled NPCs open the popup;
  unprofiled ones get a `ConfirmPopup` offering **Generate profile** (live "generating…" state).
- **The hero voicing their own line** — the GM sometimes writes `[<hero name>] "…"` (or `[<hero name>
  inner]`), which the GM should not do but does. The parse is left exactly as the GM wrote it (§6.1 warns
  the GM against it; this is mitigation at the rendering layer only): `isHeroSpeaker` matches the bubble's
  name against the hero's (case-insensitively, also `{{user}}`/`You`), and such a bubble wears the **hero's
  own portrait** and routes clicks to the **Hero panel** instead of the placeholder portrait + an NPC
  profile offer. A hero line does NOT create a roster entry (a non-cast speaker never does — see the
  `update()` bullet above), so nothing lands in `state.npcs`.
- **Panel (`👥 NPCs`):** a compact list — portrait + name (+ pin/importance tag) per row, sorted
  pinned-first then most-recently-seen (`-1` = not in shown story, sorts last). **➕ Add NPC** hand-creates one (MEDIUM; profile + portrait
  generate immediately).
- **No auto-forget:** entries are never removed automatically. The player deletes them by hand
  (🗑 Remove in the popup); pinning only keeps an entry at the top of the list.
- In-app popups only: `TextPopup` (prompts), `ConfirmPopup` (confirmations — no browser dialogs, see `src/scripts/popups.js`).
- **Off-screen private life** (`scripts/npc-life.js`, `NpcLifeSystem.tick`, fired from
  `saveAndMaybeMemory` after the memory roll-up, gated by the adventure's **Simulate NPC life**
  switch in the Story panel — off by default; turning it on starts the call, shows the popup's
  **Life** tab, and feeds the `Pursuit:` / `Whereabouts:` lines into the GM context, while all
  stored goals, history, places and NPC-owned memories are kept and resume when re-enabled): every `NPC_LIFE_EVERY_TURNS` (5) turns one
  background call advances up to `NPC_LIFE_MAX_PER_TICK` (2) profiled NPCs unseen for at least
  `NPC_LIFE_MIN_OFFSCREEN_TURNS` (4) turns (demoted `-1` faces and detail-less stubs never qualify;
  oldest-simulated first so every face surfaces). Each gets a personal mini-goal of their own
  (auto-invented when missing, so authoring is optional — never world-dependent), always advanced
  even on routine ticks. A memory is recorded ONLY when something worth remembering happened (the
  roll-up's bar — relationship changes, promises, secrets, setbacks, discoveries; routine errands
  update the goal and leave no memory), optionally with another listed NPC, as an NPC-owned auto
  memory (`turn` = current turn, so rewinds drop it like any auto memory). The goal itself reaches
  the GM as one `Pursuit:` clause in the dossier (`RPEngine.npcProfile`), so mundane continuity
  survives without spending a memory. Every tick also reports the NPC's current `whereabouts`
  (short place phrase, `entry.lifeWhere`, ≤120 chars — fed back into the next tick as "Last
  whereabouts" so movements stay continuous; an empty reply keeps the old place). The hook
  lines the GM sees for idle NPCs (`RPEngine.npcHook`) carry `Pursuit:` plus `Whereabouts:` — the
  whereabouts rides only off-screen faces (seen ≥4 turns ago; present NPCs are standing right
  here, so a stored place would mis-stage them), with no age tag when fresh from this turn and
  `(N turns ago)` otherwise. Clipped lines of every length (hook base, both tails, dossier
  `Pursuit:`) end in `…` via the shared `ellipsize` helper so the GM never mistakes a cutoff
  for a complete sentence. The whereabouts joins the hook ranking (BM25 text, semantic role field, identity
  anchor), so a hero walking into the tavern re-surfaces the NPC whose last tick left them
  there; the Others-tier header tells the GM a whereabouts match means a natural run-in. Cross-talk: each tick also sees other NPCs' recent (≤10 turns) doings mentioning the candidate — seeds for NPC×NPC scenes, never duplicated own memories, never hero-private knowledge
  The input is NPC-centric by
  construction — dossier (incl. secrets) + current goal + previous mini-goals (up to 5, oldest-first with the turn each was set, so multi-step threads continue instead of restarting) + their own latest private memories + a
  per-NPC anchor (base turn + day/time from tracker snapshots, the place only on the
  never-simulated-since-seen line when hero and NPC were still together, plus current
  turn/clock and elapsed turns stated outright) + a cast name list + ≤2 world-owned
  public facts + cross-talk (up to 2 recent doings by other NPCs mentioning this one, ≤10 turns
  old — never their own memories twice, never world facts twice, never hero-private knowledge)
  + per-candidate "Likely company" sketches (up to 2 partners the threads point at: cross-talk
  holders first, then recent co-owners — the shared `compactNpcLine` builder also behind the
  GM's hook lines, so the two can never drift; secrets stripped so no cross-NPC leak; omitted
  when quiet)
  + a compact WORLD block (premise ≤600 chars, vibe ≤200 — setting/genre
  coherence only, never plot; the hero's opening scene is excluded) — and never sees
  `latestSituation`, `openThreads`, the transcript, or the player action. The write touches ONLY
  `lifeGoal`/`lifeHistory`/`lifeTick`/`lifeWhere` + `memories.auto`: `lastSeenTurn`/`appearanceCount`/`everSpoke`/
  `npcSpotlight` are never bumped, so off-screen life never counts as presence. Cursor
  `state.lastNpcLifeTurn` advances on success and on no-ops, backs off `NPC_LIFE_RETRY_GAP_TURNS`
  (7) on failure; silent on auto-ticks (no toast), one extra `store.save` only when something
  landed. Variance is deliberate: the provider offers no temperature/seed control, so each
  candidate's block carries a randomly drawn `Angle for this tick` lens (12 options — an
  inconvenience, a craving, a finish-it opening, nostalgia…), which bends how the beat plays out without changing
  the thread; identical game states still diverge across instances. First-goal invention goes
  further: a random brief (domain × horizon — 8 domains, e.g. livelihood,
  domestic need, secret want) constrains WHAT the new want must involve, so identical dossiers
  invent different cores rather than rewordings; later differing events grow differing memories
  and trajectories separate on their own. The rules forbid the
  `Base goal (currently …)` shape (the new step is folded INTO the goal itself),
  require every tick to reach a genuinely new beat, and force threads alive 3+ ticks
  (same want reworded — counted by content-word overlap, shown as THREAD AGE) to
  conclude with a non-null outcome event and a genuinely different follow-up want
  (same domain×horizon brief mechanism as first invention). A code-level near-dup
  guard (≥70% content-word overlap vs current + history) rejects rewordings with one
  repair call; still-stuck faces keep their old goal/tick and the cursor backs off
  so they retry soon instead of stamping progress on no progress.
  The NPC popup's **Life** tab is split in two stacked sections: the live one (mini-goal,
  whereabouts, activity — past goals newest-first with the turn in its own left column, stacked full-width below the title (hover highlights only the row under the cursor), always shown — and
  last-simulated as relative time (e.g. `2 turns ago`, absolute turn in the tooltip); mini-goal, whereabouts and activity are hand-editable (each entry's turn too) and save to the session)
  and a **Debug** block (eligibility,
  cadence, a ▶ run-now button for every eligible NPC, prompt preview) that gets gated later.

### 6.7 Lorebook

The world's `lorebook`: a setting bible as small canon entries `{title, type, activation, keywords[],
content}`.

- **`type`** ← a fixed vocabulary (`LORE_TYPES`, `scripts/lorebook.js`): premise, world, location,
  character, faction, religion, magic, law, culture, history, event, item, creature, lore, other
  (unknown types fold into `lore`). Each fed entry is tagged `◆ [type]`. A legacy plain-text lorebook
  still loads as one `always`/`world` entry.
- **`activation`** — `"always"` (fed every turn) or `"keywords"` (BM25-ranked each turn against the
  last `DEFAULT_TRIGGER_WINDOW_TURNS` (3) player turns, the current action, and the current Location
  value — engine-level, not per-world). Only relevant entries are injected (`loreForTurn`), so
  a large lorebook costs tokens only for what the story touches.
- **Per-turn feed cap** — the `keywords` tier is capped at `LORE_FEED_CAP` (4) entries and
  `LORE_FEED_MAX_CHARS` (3600) chars per turn, ranked by BM25 scene relevance (title×1 +
  keywords×3 + content×1, ×0.4 when no trigger appears verbatim — no keyword prefilter, recency
  fallback when every score is 0). Entries are fed whole, never truncated. The
  `always` tier is author-controlled and uncapped. This keeps a big or "shotgun-trigger" book from
  flooding the per-turn context — shipped entries average ~950 chars, so a count cap alone isn't
  enough.
- **`content`** — canon facts; the GM treats them as ground truth (in-game divergence is recorded in
  memory).

`scripts/lorebook.js` also provides normalization (`normalizeLorebook`/`normalizeLoreEntry`), keyword
splitting/matching (word-boundary, case-insensitive), `lorebookToText` for one-shot consumers, and
`lorebookTitleList` (titles + type tags — a bounded digest for the editor's AI splitter).

### 6.8 Map system

`scripts/map-system.js` drives the **🗺 Map** section — a minimap of the POIs around the hero.
`MapSystem.buildPois` runs a **dedicated non-narrator call** (`[POIS]` block: `Name | type | dx | dy |
description`, meters relative to the hero) whenever the **Location tracker changes** (`maybeRefreshMap`,
wired into `runGmTurn`, `enterSession`, `deleteTurn`/`deleteGmReply`). Builds are **gated while a reply
streams** (`generating` → `pendingMapRefresh` deferral).

- **Canon inputs:** a bounded digest of always-on `world`/`location` lore entries (~1500 chars) plus
  keyword-triggered ones (~900 chars), combined with a **recent-story window** (the last ~2500 chars of
  narrator text, treated as canon — story-named places are REQUIRED POIs with exact names).
- **POIs are places, never people** — enforced purely in the prompt (no name/type filter, which proved
  unreliable). The instruction defines a POI as a fixed physical location ("could the hero physically go
  there?"), forbids characters/creatures, and maps the *place* tied to a person ("Marla's Smithy", not
  "Marla"). If a character slips in, fix the prompt rather than re-adding a name filter.
- **Scale** (`MAP_SCALES`): the mapmaker prints a `[SCALE]` line (fallback `classifyScale`, a
  region-label guess) choosing one of **seven** tiers, each with its own **unit** — the ladder runs
  from a room to interstellar space so the same engine maps a tavern, a continent and a galactic
  sector: **`indoor`** (one building/vehicle/cave/ship interior; meters, 2–60 m), **`local`** (a small
  enclosed area; meters, 15–250 m), **`outdoor`** (open country / a settlement from outside; meters,
  100–900 m), **`regional`** (a country-sized landscape; km, 5–300 km), **`planetary`** (a whole world
  and its orbit; km, 200–400,000 km), **`system`** (a star system seen from a craft; AU, 0.05–50 AU)
  and **`galactic`** (travelling between stars; light-years, 1–2,000 ly). The unit is part of the
  scale, so POI `dx`/`dy` are in meters on the ground scales, km on regional/planetary, AU on a star
  system and ly between stars — the prompt's SCALE GUIDE (generated from `MAP_SCALES`), the distance
  band, min spacing and `clampToScale` all follow the chosen unit, and `formatDistance(v, scale)`
  renders it ("42 m", "830 km", "1.80 AU", "4.2 ly"). The scale is picked from the SCENE BEING
  MAPPED: a ship's crew *inside* the hull is `indoor`, but a crew looking at a world, a star system or
  interstellar space maps what they can SEE (`planetary`/`system`/`galactic`) even though they are "in"
  a ship. `classifyScale` tests the space keywords (galaxy/nebula/sector, star system, orbit/planet/
  moon, region/kingdom/sea) before the ground ones, and only the REGION prefix, so "Sol System —
  Docking Bay" is a star-system map.
- **Descriptions are timeless facts about the place**, never about the hero; the engine adds no prose of
  its own (the guaranteed current-place POI carries just the place's name, so no stale "you are here"
  line survives). "The way back to …" on the origin POI is a deliberate navigation hint.
- **Hard-guaranteed POIs** (`enforceCurrentPoi` / `enforceOriginPoi`): the hero's current place, and the
  place the hero came from (nearest POI to the old position on the previous map), described "The way back
  to …", so travel-back always works. The mapmaker keeps POIs a scale-appropriate distance apart (each
  scale's `sep`), and `buildMapSvg` nudges any dot landing on the hero marker outward.
- **Region normalization:** map keys are normalized by `normalizeLoc` (strips an em/en-dash detail
  suffix, lowercases), so micro-moves within a place don't trigger rebuilds or re-feeds.
- **Hero position:** `state.map.hero` is the hero's position in the region grid; when the Location
  tracker's dash-detail names a POI (`locDetail` + fuzzy `matchPoi`), the hero **snaps to it**
  (`refreshHeroPos`), recomputing live distances.
- **Rendering** (`buildMapSvg`): an SVG minimap with grid lines, dashed distance rings and a scale bar
  auto-fitted to the POIs' spread (`niceMapSpan`, a 1-1.5-2-3-4-6-8 × 10ⁿ snap, so it spans meters to
  light-years) and labelled in the map's unit, a pulsing hero dot, and emoji POI markers
  (clamped to view). `buildMapList` lists every POI nearest-first (`sortPoisByDistance`) with icon, name,
  excerpt, unit-aware distance (`formatDistance`) and 8-point compass direction. Hovering a marker or row
  highlights the match.
- **Travel:** each non-current POI row has a **Travel** button (`travelToPoi`) — a confirmation, then a
  normal action tagged `kind:"travel"`; the GM concludes the scene, narrates the journey advancing time
  for the distance (scale-aware — each scale's `travel` guidance phrases it: minutes on foot, hours across
  a region, days of sub-light cruise, a warp jump between stars), and ends at the destination, and travel
  turns always re-feed SURROUNDINGS. `keepTravelLocationInRegion` keeps the region prefix only when the
  destination is genuinely a POI on this region's map. The action carries `kind:"travel"`, so it wears
  the shared **system bubble** (🧭 badge) rather than the player's (§5) — the same hook future
  engine-generated actions use (add a `SYSTEM_ACTIONS` entry).
- **Cache & ↻:** POIs cache per region (`state.mapCache`, last 12) so revisiting is instant; ↻
  force-regenerates without dropping the cache (a failed rebuild keeps the previous map). Entering a
  **new** region feeds the previous map and asks the model to keep 1–3 of its landmarks that plausibly
  span the boundary, so the world feels continuous. Failure → a distinct ⚠ "Try again" state (no
  auto-retry); empty/unparseable reply → a "Nothing of note" state with a retry.
- **Bidirectional with the narrator:** `surroundingsToFeed` decides per-turn whether the GM needs the
  map; when so, `buildContext` appends **SURROUNDINGS** (location + every POI with type, hero-relative
  distance and compass bearing). To save tokens it is **not fed every turn** — only when the hero reaches
  a location the GM hasn't seen, moves > 30 m within the region, on ⏩ Advance, or when the action hints
  at travel/exploration (`TRAVEL_RE`).

### 6.9 World editor

`scripts/world-editor.js` — the in-app authoring UI, parchment-scrim header with a single-row
scrollable tab bar (fade + chevron cues via `.ce-tab-nav` / `paintTabNav`). Tabs: **Basics / Story
/ Lorebook / NPC / Images / Stats / Trackers / NPC Trackers / Context / Raw JSON**. (`TABS` is
id-keyed (`{id, name}`) and views dispatch by `data-view="<id>"` / `$v(id)`, so adding or
reordering a tab is just editing the `TABS` array order.)

- **Master/detail tabs (Lorebook · NPC · Stats · Trackers · NPC trackers):** these five tabs are all
  the same shape — a scrollable **list** on the left beside the **selected item's** field editor on the
  right — so only one item's fields are ever in the DOM, and a long list no longer means one giant
  scrolling column. A single shared controller (`createSplit(view, part)` in `world-editor.js`) owns the
  mechanics: the selection (`state.sel`), the mobile drill-down flag, the list scroll offset, the
  move/delete/back chrome, the empty state, and the row/editor split itself. Each tab supplies only a
  spec (its rows, its editor fields, and their wiring), so all five behave — and look — identical. On
  narrow screens (< 640px) the split becomes a **one-pane drill-down**: only the list shows, tapping a
  row swaps in its editor behind a compact `‹ Back` **pill** (`.ce-split-back`: a chevron + the word,
  left-aligned on its own line — not full width, so it reads as the way out of the pane rather than as
  another field), and **＋ Add** opens the new item's editor straight away. There, **only one pane is ever on screen, so there is no nested scroll**: the view and
  split drop out of the panel-height flex chain (`flex: 0 0 auto`, no `min-height`) and both panes are
  `overflow: visible`, so the visible pane's content flows into the panel and `.ce-body` — the panel's own
  scroller — is the single thing that scrolls (`createSplit` keeps `state.bodyScroll` so opening a row
  starts the editor at the top and Back returns the list to where it was). Desktop keeps the two
  fixed-height panes with their own scroll bars. The list follows the editor live (one row is rebuilt per edit, so the focused input is
  never torn down) and every row wears a colour stripe keyed to `--lt`. **Duplicate keys/names are
  flagged on the rows themselves** (red edge + a `duplicate` badge) as well as on the editor's field, so
  a clash is visible without opening every item. Deleting asks for confirmation (`ConfirmPopup`) — except
  for an item that is still blank, which just goes.
- **Lorebook tab:** rows show the entry's title, a **colour-coded type** badge (each type has its own
  hue, echoed as the row's left stripe, so entries are easy to pick out) and its activation — **always**
  = gold, **triggered** = grey — plus its trigger-word count. The editor holds title / type / activation
  (sharing one row), the trigger-word chips and the content box. **✨ Split text with AI** (paste a lore
  dump → JSON entries appended for review) and **⭱ Import / ⭳ Export** (`.mno-lore`, `{entries}` or a
  `.mno-world`; append vs replace). The split **auto-chunks** long dumps — it sizes each part against the
  plugin's real context window (`getMetaObject`), splits on paragraph → sentence → character boundaries,
  calls once per part with a fixed schema prefix plus a titles-only digest of the book, then de-dupes
  across parts; a paste needing > ~24 calls is refused.
- **Chip inputs** (world tags, trigger-words) are the shared `createChipInput` (`chip-input.js`, also
  used by the Settings panel's *Blocked tags*). It repaints only its chips, so the text box keeps focus
  through a run of adds. World **tags** are capped at `MAX_WORLD_TAGS` (5) with a live `n/5` count, and a
  raw-JSON world with > 5 is blocked from saving (`tagErrors`). The trigger-words input is unlimited.
  **content rating** and **tags** share one two-column row: the rating column sits at the normal left
  edge (lined up with the name / description / cover labels) and only the tags column is indented past
  the 120px cover preview, so its input lines up with the cover section's "paste an image…" input. The
  two labels line up at the top and the rating switch is centred vertically on the taller tag input
  beside it. On a narrow screen the row stacks into a full-width column. Below the row sits the
  **common-tag pick-list** (`TAG_SUGGESTIONS`, `#ceTagSug`): one flat, unlabelled flow of click-to-add
  chips in the vocabulary Explore filters by, so a new world is tagged consistently. (The constant's
  facet groups set the render ORDER — genre-flavoured tags first, then setting, then theme — and nothing
  visible.) Clicking a chip runs the same commit path as typing it (reserved markers refused, the cap
  enforced, `renderTagSuggestions` re-run on every change); a tag the world already wears renders
  selected and disabled, so the row doubles as a checklist.
- **No author field.** The author is written by the app from your community identity (`world.js` reads
  the username + `userId` once from kv `community/user`). One rule: **a world is signed where it is
  authored, and nowhere else** — created and duplicated worlds call `WorldStore.sign()` (a fork also
  carries the original in `meta.remix`); an **import** keeps the author it arrived with (importing is not
  authoring); **saving** only ever refreshes the line of a world already yours; **publishing** fills a
  missing author and records `authorId` when the name is already yours. A username rename propagates by
  **id**, never by name (`reconcileWorldAuthors()` at boot and the moment a claim/rename lands), with
  name matching used exactly once as adoption (a world with no `authorId` whose author is your current
  username, or one of your own listings). **The Raw JSON tab stays** — it can hand-edit `meta.author`,
  and that is fine: the author line is cosmetic provenance, the catalog credits the server-side `userId`
  a file can't forge, and an exported file is plain JSON anyway.
- **NSFW toggle** (the content-rating field above the tags): a short **be mindful of others** note sits
  directly above it (a `.ce-sec-note`), reminding authors to rate and tag honestly so players can find
  what they want and avoid what they don't. The `nsfw` tag is **reserved** — it marks
  adult content, is owned by this toggle (typing `nsfw` flips it rather than adding a chip) and never
  counts against the 5-tag limit. `remix` is reserved the same way but has **no toggle** (fork
  provenance, derived from `meta.remix`; the input refuses it). `nsfw` stays a real tag on the *file*
  (`world.js` writes `meta.nsfw` and keeps `tags` free of it) so everything reading `meta.tags` keeps
  working. The control is the shared `.ui-sw` pill (§6.10).
- **NPC tab:** the standing cast, with per-NPC ✨ Generate / ⬆ Upload avatar and (when the world defines
  NPC trackers) a per-character **NPC Trackers** section after the Extra field writing the entry's
  `trackers` override — one row per tracker (a colour dot, its icon/name and dim `key · kind` on the
  left), with a `start` field and, for a number tracker whose def has a literal max, a `max` field (a
  formula cap is def-fixed and gets no field) on the right, in two aligned columns. Rows
  stay minimal — the portrait (or its placeholder), the name, and the job as one line of dim plain text
  (no badge; elided by CSS with the full value in the `title`, so a long job costs no height) — while
  age/gender/race live only in the editor. The row stripe uses the **default green accent** (`lt-npc`),
  not the Lorebook `character` hue. In the editor the **name** gets its own full-width row, with
  age / gender / race on the row beneath it and `job` full-width below that.
- **Stats/Trackers tabs:** point-buy settings, die sides, the optional custom check-modifier formula
  (with a live stat→mod preview) sit above the master/detail def list; below it, each stat row shows its
  label (or key) with the key and start/max badges, and each tracker row its icon + display name with
  key/type/where-it-shows badges. Every tracker row wears its own hue on the stripe — the bar colour, or
  the bar's default (**green accent**) when `color` is unset, so the row always matches the chip (a text
  tracker has no bar, so it takes the default too — the tab hue survives only as a fallback for a
  malformed colour). Both tracker editors give `rules` a 4-row box. The live header-chip **preview** lives
  in the editor. Stats/trackers keep formula support. In a stat's editor the first row is **key | label**
  and the numbers sit together on the row below (**start | max**) — a hidden spacer holds the third grid
  cell so the two pairs stack that way on desktop while the 2-col mobile grid gets key|label / start|max
  for free. The Trackers tab's **show in** dropdown is the last field (after `color`, before `rules`) and
  is labelled `chat header` / `hero panel` / `both` / `hidden` (`TRACKER_SHOWS`) while the stored token stays
  `header`/`hero`/`both`/`hidden` (`hidden` = tracked by the AI but shown nowhere). A new tracker defaults to `show: "header"`.
- **NPC Trackers tab** (§6.3.1): the same def grid with its own `show in` selector (`npc profile` /
  `hidden`, stored as `profile`/`hidden`, default `profile`; `hidden` = tracked by the AI but shown nowhere —
  no profile rows, no change chips), with NPC-scoped wording and a duplicate-key check. NPC values never
  appear in the header bar.
- **Context tab** (`scripts/context-budget.js`) — a read-only **token-budget meter**, isolated from the
  play path. It reuses the real builders (`RPEngine.buildContext`, the tracker/stats builders,
  `MemorySystem`) with a capturing **mock `genText`**, so it records the exact instruction each call
  would send without spending a generation, and uses the plugin's own tokenizer
  (`getMetaObject().countTokens`, chars/3.8 fallback). Three scenarios — **Opening** (turn 0, no
  history, empty NPC roster so the cast rides as hook lines — a cast-less world meets no-one yet,
  so its opening stays at 0 NPC tokens), **Typical** (turn 26 — 2 in play), **Worst case**
  (full 15-turn window, every lore entry triggered, the
  whole cast, full memory feed and the map). A world with NO standing cast still has company by
  mid-campaign (the GM invents NPCs on the fly), so Typical plays 2 and Worst case plays 4
  synthetic stand-in dossiers (+ their name-only memories and NPC-tracker roster) instead of
  measuring an empty roster. It shows the GM narration call's input vs the plugin's
  recommended context window (`idealMaxContextTokens`, ~6000 — a target, not a hard limit), a
  per-section breakdown — the **same** canonical bars in all three scenarios, with a section the
  prompt doesn't reach shown as 0 (so Opening gets the breakdown too, and a lighter turn reads as
  cheaper, not as having fewer parts) — that sums exactly to that headline, every call in a turn
  (narration, referee,
  tracker update, NPC tracker update, memory roll-up amortized over `MEMORY_EVERY_TURNS`), and the
  whole-turn total. It is painted only when opened.
### 6.10 UI / rails / landing

Dark fantasy, **modern + flat**: near-black warm backgrounds, muted brown-gray borders, parchment-ish
light text, flat glyph icons. All styling lives in `src/styles.css` — **its comments carry the per-rule
rationale** (why a value, why a stacking/nesting trick, what was rejected), so this section is the map
and the contracts, not a copy of it.

**Palette**

| Token | Hex | Use |
|-------|-----|-----|
| `--bg`       | `#11100E` | page background |
| `--panel`    | `#141412` | panels |
| `--panel2`   | `#1A1A18` | secondary panels |
| `--border`   | `#2A2520` | borders / dividers |
| `--text`     | `#C4B99A` | primary text |
| `--muted`    | `#8A8070` | secondary / placeholders |
| `--accent`   | `#8B9A6E` | sage accent (links, focus, selected) |
| `--warn`     | `#9A4A4A` | danger / delete / death motif |

Two screens, both in `index.html` + `main.js`: the **chat** and the **home shell**. Everything is styled
by class from `styles.css`; an icon is either an emoji or a `currentColor` CSS mask of a
white-on-transparent `src/images/icon-*.png` (`.sec-ic` / `secIconInner`).

**Chrome is one family.** The chat top bar (`#topbar`), both rail heads (`.rail-head`) and the nav's head
(`.hn-head`) are the **same 60px** (`min-height` + centred content), so their bottom borders land on one
line. The app's one "screen title" size is **14px**.

**Chat screen**

- **Two collapsible side rails** around a central transcript column: left `#leftRail` (non-narrative —
  **Menu / Adventures / Memories / Chat**), right `#rightRail` (**Hero / Map / NPCs / Gallery**). Each
  collapses to a ~46px icon strip. Every section is identified by one drawn mark (`RAIL_SECTIONS` holds
  `{label, iconImg}`, still accepting an `icon` emoji fallback), worn on its tab, panel title, menu row
  and page emblem at one size: `--rail-ic` (20px). `railPref` persistence and
  `renderRailSection` / `syncRail` live in `main.js`.
- **Below 901px** an expanded rail overlays the chat behind `#railScrim`, one rail open at a time; the
  header's two corner buttons (☰ and the inline squares icon (icons.js `ICON_SQUARES`)) open the drawers. **901px is the app's
  one breakpoint** (`isNarrow()`), shared with the home shell.
- **Memory** sub-tabs: **Manual / Auto / Situation / Threads** (module-level `memTab`). Its long lists
  render lazily (`renderChunked`, 40 rows at a time, a plain scroll listener; `releaseMemChunks` on
  clear/collapse) and row actions update in place by identity (`memIndex`).
- Panel renderers each take a body element: `renderMenuPanel` (quick-nav grid), `renderSessionPanel` (**Currently Playing** — the bound world's cover/title/author plus the detail popup's Overview / Author's notes tabs in the popup's `.wd-*` language, `paintCurrentWorld` — + an **Adventures in this world** shelf reusing the Adventures page's `adventureRow`), `renderMemoryPanel` (+ `renderAutoMemories` /
  `renderManualMemories` / `renderSituationPanel` / `renderThreadsPanel`),
  `renderSettingsPanel` (the **Story** panel: **Tools** — the AI-provider button, the Image Gen button, + prune — then **Preferences**), `renderCharacterPanel`, `renderMapPanel`, `renderNpcPanel`, `renderGalleryBody`. (The old in-chat Adventures tab is gone — it duplicated the grid's Adventures button; the Session tab is the in-chat shelf now.)
- **Top bar** `#topbar`: the brand logo (the way back to the landing; `draggable="false"`) + a
  click-to-rename adventure title + the token-counter pip (`#ctxMeterPill`, owned by `ctx-meter.js` —
  admin-only: visible while signed in as admin, showing `–` until the first turn of the page-load produces a real prompt). The title's word span hides ≤640px; the name keeps its 14px.
- **Transcript** `#transcriptEl`: narration is prose; NPC / player bubbles carry a portrait + name; inner
  thoughts are dashed 💭 bubbles. Displayed text goes through the one shared renderer (`rich-text.js`):
  `**bold**`, `*italic*` (faded `.em`) and `` `code` ``, plus `"quoted speech"` in the brighter `.q`
  tone — the same renderer the world cards / details panels and the changelog use, so prose reads the
  same everywhere. Turn controls appear on hover (on touch, tap-to-reveal — and the
  revealing tap can never fire a control; the guard keys the gesture stably by turn + row + button
  index, so a background render landing mid-tap can't eat a deliberate press, and the buttons wear
  `touch-action: manipulation` so a quick second tap is never swallowed as a zoom). The scroller
  keeps scroll chaining to itself (`overscroll-behavior-y: contain`). Windowed rendering: the last `RENDER_INITIAL` (10) turns,
  older ones lazy-loaded by `loadOlderTurns` with the scroll preserved, `renderFollowTail`, and a
  floating `#scrollBottomBtn` whenever you are not at the tail.
- **Composer** `#composer`: a `⋮` commands button, a 🎨 Scene button, a textarea + Send (Enter sends,
  Shift+Enter newlines). While the GM writes, Send becomes the red-square **stop** (§6.13). The chat
  shell sizes to `100dvh` (falling back to `100vh`), and a `visualViewport` resync plus a
  composer-blur reset keep the transcript scrolling after the on-screen keyboard opens/closes (the
  old layout-vs-visual desync froze scrolling until the tab was switched).
- **Loading**: the shared ring spinner `.spin` (inline variant `.spin-sm`) with `setBusy(btn, label)` /
  `clearBusy(btn)` (defined in both `main.js` and `world-editor.js`).

**Home shell** (`#landing`; `renderLanding` / `setHomePage` / `renderHomeNav` / `goToLanding` /
`beginNewAdventure` / `doImport`). A **left nav + content pane**, not a single scroll.

- `#homeNav` (232px, collapsing to a 60px icon strip; persisted `mno.homeNav`) beside `#homeMain` — the
  **only** scrolling element (`scrollbar-gutter: stable`, so a page with a scrollbar and one without
  can't shift the page's centring). The backdrop is one image for all three pages
  (`images/backdrop-castle.webp`, dimmed by `#ldScrim`).
- **Nav is config-driven** from `HOME_SECTIONS`: one row per entry
  (`{id,label,icon|iconImg,zone,accent,rgb,title,sub}`, or `{…,opens}` for a row that runs something
  instead of being a page — only Settings, which raises the Settings popup, §6.16). Adding a page = a
  config row + a `HOME_MOUNTS` mount; `renderHomeNav` rebuilds the list each render and `hnActionEl`
  renders the non-page rows. Zones: the primary pages **Worlds / Adventures / Explore** (drawn
  `icon-*.png` masks), then the util cluster **Settings** (`icon-settings.png`) and **Changelog**
  (`HN_ACTIONS`, `icon-changelog.png`, opens the CHANGELOG popup, §9) — no divider, the primary list just
  flexes. Count badges where cheap (`updateHomeNavCounts`); the active row takes its page's accent
  (`paintHomeNav`); Arrow keys / Home / End walk it, and the drawer traps Tab + closes on Escape. Routing
  is `HOME_SECTIONS.filter(s => !s.opens)`, so `#settings` is not a page URL.
- **Foot actions:** the nav footer holds an icon-only fullscreen toggle (same drawn expand/compress
  SVG as the cover toggle — the ⛶/⤢ glyphs are empty boxes on some devices) and the install-app
  button (same `beforeinstallprompt` pattern as perchance.org/installable-app-demo — but always shown:
  the generator runs in a cross-origin iframe and that event only fires top-level, so gating on it
  would hide the button forever; without a deferred prompt the button toasts the manual
  browser-menu steps instead, and it hides itself when already running installed. `boot.js` stashes
  the event from parse time (`window.__mnoInstallEvent`): the bridge drops repeat eventIds, so a
  dispatch arriving before any listener exists is lost — an inline listener (like the demo's) wins
  that race, a deferred-module listener often loses it. The install button and colophon only show
  when the nav is expanded; the fullscreen toggle stays visible in both modes (collapsed: alone at
  the bottom under the foot's separator).
- **Two layouts, the one breakpoint:** ≥901px a pinned rail honouring the saved collapse preference;
  ≤900px a slide-over drawer (always labelled; `isDrawerMode()` keeps its transient state out of
  storage). While the drawer is open the page behind it is dimmed and inert through `#homeNavScrim`,
  which sits **between** the rail and the pane so an outside click can never also press a button behind
  it.
- **Pages are built from shared pieces**: `renderIncremental` (chunked append + `.hm-more`; a plain
  scroll listener that returns a `release()`), `searchBar` (the one toolbar), `optionEl` (a three-valued
  filter chip), `renderActivePills`, and `emptyStateEl(icon, text, acts)` (the page's own emblem as a
  mask; no fill — an empty grid is an ordinary state, not a warning). `setHomePage(id, {force})` unmounts
  the previous page (`release()` + drop its DOM), builds the `.hm-head` band (`.hm-bar` + `.hm-hacts` +
  the `.hm-id` identity slot) and `.hm-body`, and restores that page's remembered scroll
  (`homeUI[page].scroll`; search / facets / sort / scroll are per-visit, never persisted).
- **Routing**: the default page is always **Worlds**, and Worlds owns the clean URL (no hash —
  the home page); UI tab switches push a history entry and then mirror the page into the URL with
  `history.replaceState` (`#adventures`/`#explore`, empty for Worlds), so Back walks Worlds ↔
  Adventures ↔ Explore. History mounts (Back/forward, deep links, initial render) only replace.
  (`#worlds` still parses as Worlds for old links, but nothing writes it.) A real hash on load
  deep-links, and a
  `hashchange` listener follows later edits. A route may also carry one target — `#explore/<worldId>` —
  which opens that world's details panel (see §6.14, *Share links*). That target is owned by the panel
  while it is open (it names the world on open and clears it on close), so the URL always describes what
  is on screen. `replaceState` is also the ONLY write that reaches the VISIBLE address bar: the app is a
  cross-origin iframe, and the platform wraps `history.replaceState` to post the new hash up to the host
  page, whose URL then follows (a bare `location.hash =` or `history.pushState` is not wrapped — it moves
  only the iframe, never the bar). The platform's own inbound half is unreliable though: it forwards a
  top-level hash change as a `changeHash` postMessage and applies it with `window.location.hash = …`,
  but perchance injects a `<base>` pointing at the top-level page, so that write resolves cross-origin
  and bounces (a stray history event, and the hash snapping back). So the shell subscribes to
  `changeHash` itself and applies it with `applyForwardedHash` (through `syncHomeHash`) — which is what
  makes editing the address bar behave. Entering a session `pushState`s (see *Back*, below), so Back from
  a chat returns to the shell on the page you left — and while a chat is open the bar reads `#session`
  (no landing route, so deep links and the hash router ignore it; a reload still boots the active
  session, and no home page is current until the chat is left).

**Worlds page** (`mountWorldsPage`) — the app's landing page. There is **no hero block**: the branding
lives in the welcome banner. Header actions **⚔ Begin Your Adventure** / **＋ Create world** /
**⭱ Import World** (one right-aligned group; a full-width, left-aligned row in the drawer band). Below:
the shared toolbar, then the card grid and an `N worlds` footer.

- **Welcome banner** (`welcomeBannerEl`, `.hm-welcome`) between header and toolbar: `logo.svg` +
  `gameTitle` + a one-line engine description + the **three ways in**, each labelled with, and running,
  the real control it names (`beginNewAdventure` / `newWorld` / `setHomePage("explore")`). It is the one
  surfaced block (glass + gold outline + outer halo — the *why* is in the `styles.css` comment), offers
  no buttons but the dismiss, and dismissing writes `mno.worlds.welcome` (bring it back in
  **Settings → Interface**, §6.16). Its three steps are one `auto-fit` grid (floor 240px).
- **Toolbar** (`src/scripts/search-bar.js` — the one toolbar Worlds, Adventures and Explore all mount):
  a search field (drawn magnifier + ✕), chrome-less **⚙ Filters** and **⇅ sort** disclosures, an optional
  per-page `toggles:` switch (Adventures' *Group by world*) and `actions:` icon button (Worlds' ⟳ update
  check), and a right-hand **⊘ NSFW** switch. **NSFW is a content preference, not a filter**, so its
  state lives in the module (`showNsfw()` / `setShowNsfw()`, pref `mno.showNsfw`) and every page agrees.
  All filtering UI lives **inside** the Filters panel as labelled sections (SOURCE + TAGS); the applied
  set shows as removable `.hm-apill` pills under the bar, and the Filters button carries a corner badge
  count. Every chip is **three-valued** (`off · require · exclude` — require = match all, exclude = match
  none; picking one side clears the other; empty = no constraint). Below 641px the bar is **two rows**
  (search full-width, controls centred beneath); whether the labels stay is decided by measurement
  (`fit()` sums the real control widths), not a breakpoint.
- **Cards** (`worldCard`, plus `addedCard` / `simpleAddedCard` / the picker / Explore) share one anatomy
  and a **fixed vertical rhythm** — every slot reserved and emitted even when empty, so neighbouring
  cards' rows line up: a cover (lazy `<img>` or a letter placeholder; the gold **✦ MNO** chip is the one
  badge that rides a cover, on bundled worlds only), a one-line **ellipsised** title, one shared
  **non-wrapping** meta line (author only), a 2-line description, a one-line tag row, and a footer note.
  The footer (`worldNote` / `sourceNote` / `localWorldNote` / `addedNote`) states the world's
  **provenance** (`✎ My World`, `… · Published`, `… · Hidden`, `🌐 Public`, `✦ Bundled`) or, for a saved
  community copy, the one thing needing attention (`⟳ Update Available`, `⚠ Download Failed`,
  `⚠ No Longer Public`, `⚑ Hidden After Reports`). `⚠ No Longer Public` covers **both** ways a
  saved copy loses its original: the catalog answering `unknown` (record gone) *and* `removed` (the
  author unpublished it — a tombstone on the same slot, so the note self-heals to `🌐 Public` if
  they republish). Grid `minmax(148px,1fr)`. **A card has no Play
  button** — the whole card opens the world detail popup, whose Play/Continue block is
  `mountWorldSessions` (§6.11). A record's `source` is derived in `worldRecords()` (bundled / mine /
  added); `link` adds `· Published` / `· Hidden` for your own worlds.
- **Tag rows** live in one shared place (`src/scripts/tag-row.js`) because two rules must agree: the
  special **`nsfw`** and **`remix`** markers lead the row (they are world *fields*, `meta.nsfw` /
  `meta.remix`, not author tags — `isNsfwMeta` / `isRemixMeta` / `isReservedTag` in `world.js`), and the
  row is **one visible line** whose overflow `fitTagRow` handles by dropping the tail chip-by-chip and
  appending a `…` chip whose tooltip lists the rest. In the detail popups the row instead shows in full
  and every chip is a shortcut into a fresh tag filter.
- **The like control**: a card's `♡`/`♥ n` heart *is* the toggle (`toggleLike`, state from `likedWorlds`,
  §6.14), live on your own listing too; the same `likeCountHtml()` (with its `pip` flag) draws the likes
  entry of the popup's facts row. On the card the counters are one inline `·`-separated pair inside
  `.ex-cnts`; in the popup the ledger draws each as its own **rounded pip** (`.ex-pip`) — the two
  counters on the first row, with the **🔗 share control as a third pip to the right of the download
  counter** (a `<button>` wearing the same capsule via `.ex-pipbtn`, which strips the UA button box so
  `.ex-pip` can put the pip back on — see §6.14, *Share links*), and the file's own
  `vN · size · updated …` line as one quieter pip below (`.ex-meta`), gathered directly under the
  author/remix line and hugging their content. This panel shares Explore's ledger: when the world has a
  catalog id (a live listing of your own, or an added world the catalog still has) a **🔗 Copy link** pip
  rides its own `.ex-facts` row just above the capsule — exactly the row Explore draws its counters + share
  in, and the same button classes (`opts.share` carries the `worldId` to the panel; §6.14, *Share links*).
  **Both detail popups wear this meta capsule** — Explore's
  and this one — built by main.js's `worldMetaRow()` from whichever of the three facts is known: for your
  own live world the catalog **link record** (`version` / `jsonBytes` / `updatedAt`, so it reads exactly
  as Explore does), for an added community copy the **library record** (the same three, snapshotted at add
  / refresh time), and otherwise the local file's own size (`localWorldBytes`) plus the world's
  `meta.updatedAt`. An unknown fact is simply omitted, so an unpublished world shows size/updated without
  a fabricated version.
- The **world detail popup's cover** carries two controls, both inset 10px from the panel's corner, one
  per end of the right edge: the **✕** at the top and a **fullscreen toggle** at the bottom (level with
  the title's baseline; the scrim's right padding is 48px so a long title can never run under it).
  Toggling it — through the button **or a click anywhere on the cover, title included** (`.wd-hdr` is
  the toggle; the button's own click stops propagating so the two can't cancel out) — adds `.wd-full`:
  the details band, the `✦` badge and the scrim's own padding drop away and the cover's band grows from
  its 240px (180px on a phone) to the panel's whole content height. **The panel's own size does not
  change at all**, and it is never a content-hugging `height: auto`: a world with three lines of
  description gets the same panel as a wordy one, and the details band scrolls instead (`.wd-body` is
  the scroller). Its size comes from two variables on the panel (`--wd-w` / `--wd-h`, styles.css):
  the width is a flat 580px (94vw on a phone, up to 720px on a big screen — `min-width: 1100px`
  and `min-height: 900px`, capped by `64.5vh` so the box below always holds) and the height is `86vh`
  **capped at what that width measures in the card cover's own 3:4 box** (`--wd-w * 4 / 3` — 773px
  at 580, 960px at 720, and 4:3 of 94vw on a phone). A taller panel would show the cover more tightly framed than the card it was clicked from,
  which is exactly what the fullscreen band would otherwise do on a tall window. That fixed frame is
  what makes the
  toggle read as "the cover gets the panel" rather than "the popup resizes"; the title keeps its size
  and its 20px inset, so nothing shifts sideways. The scrim
  softens too (`0 / 0 / .5` down the cover, against the band's `0 / .2 / .9` — a full-height cover
  needs far less darkening), and both the padding
  and the gradient are in the transition so the whole toggle reads as one motion. Only the cover's own
  px height changes, so the toggle
  animates — a height transition (under `prefers-reduced-motion: no-preference`) that pushes the
  details down out of the panel and back up again, with the details' opacity following. The button's
  four-arrow icon is drawn as an SVG (`WD_FS_EXPAND_IC` / `WD_FS_COMPRESS_IC`) because the ⛶/⤢ glyphs
  differ per OS and can't take the button's colour.
  The whole thing is written ONCE — `mountCoverFullscreen(overlay, state)` in main.js, which creates the
  button, binds it and the cover, and re-applies the state (dropping any existing button first, so a
  re-mount can't double up). Both world detail panels call it: this file's, and community.js's Explore
  panel (`openWorldDetail`), which rebuilds its panel's HTML on every repaint and so owns a `{full}`
  object it passes back in each time — a ♡ or a finished download must not drop the reader out of
  fullscreen.
- The **`.ui-sw`** pill is the app's one toggle look (`<button role="switch">` + `.sw-track` / `.sw-knob`
  + `.sw-text`, host toggles `.on`; `.sw-plain` keeps a phrase in sentence case, `.sw-danger` paints the
  ON state red). It comes in two sizes: the compact default, and a **large** one (`.hm-wtoolbar .ui-sw`,
  `.ce-fld > .ui-sw`, `.ce-view > .ui-sw` — one rule block, so the toolbar's ⊘ NSFW and the world
  editor's two switches can never drift apart) for a switch sitting in a row of full-size controls. The
  reserved-marker chips and the ⊘ switch are built on it.

**Adventures page** (`mountAdventuresPage`) — your saved journeys, as `.a-row` rows from the one
`adventureRow` builder (also the in-session ⚔ Adventures panel and a world popup's own list, so rows
can't drift). It wears **the same toolbar**, with its own sort options, a **WORLD** filter (plus an
**Unbound** bucket for a missing world — the same condition as the row's ⚠ badge) and a persisted
**Group by world** switch (`mno.adventures.group`; grouping walks one contiguous bucket per world).
Header actions ⚔ New Adventure / ⭱ Import Save, and the empty state is the shared `emptyStateEl` block
with **no buttons** (both actions are in the header just above). It is not filterable by state.

**Explore page** (`mountExplorePage`) — `community.js` owns the content (§6.14). The shell supplies the
pane, an empty actions slot and the header's identity slot (`.hm-id`), where the module mounts the
identity chip — which **opens the Settings panel on Identity** (§6.16) rather than navigating. The
socket's lifetime is tied to the mount (`closeExplore()` on unmount); leaving Explore to *play* calls
`pauseExplore()`, keeping the page mounted under the character wizard.

**Shared popups & wizard.** `openWorldDetail` / `showWorldPicker` / `openCharacterCreation` are shared,
not shell-specific. `showWorldPicker` lists **all three sources** (bundled, yours, added-from-Explore —
an added world's `lib:` id is what the session binds to), searches name/author/description, and chunks
with `WP_CHUNK`; its scroll trigger is deliberately the input events, not IntersectionObserver.
**Character wizard** (`openCharacterCreation`, "Forge Your Hero"): its header shares the world
editor's language (textured scrim header, emblem spanning title + world rows, underline step
tabs — see §6.9; only the texture/emblem differ). Four steps: Bio / Avatar / Stats / Review.
Step 1's bio renders `CC_BIO_FIELDS`
(the short fields pair into a two-column `.cc-row2` grid via a tuple's `half` flag); the tool row is
🎲 Randomize / ✨ Generate / 💾 Save / 📂 Load. 🎲 is AI-free (`rollBio` in `src/scripts/bio-words.js`,
which owns every word and rule — tune it there, never in engine code); ✨ (`randomizeBioWithAI`) asks the
model for a coherent JSON hero (premise + vibe + a strict 8-field JSON schema, ~700 tokens;
every non-empty reply field overwrites the bio — a full reroll). ✨ now toggles an inline
direction box (same pattern as the world editor's NPC generator: textarea + run button +
status line in a `.cc-genwrap` card); the direction is fed to the model as the highest-priority
instruction, blank means surprise-me, and the box stays open so runs can be iterated. The Avatar step keeps every generated/uploaded/loaded portrait in
an in-memory history strip (`ccAvHistory`, max 8, `setPortrait`/`noteAvatar`/`renderAvHist`) so
regenerating never destroys a liked result; the strip always shows at least the current portrait
(the stock placeholder renders as a real `<img>`) in a wrapping grid under a "History — Tap to
reuse" title. Stats has ↺ Reset (restore `d.start` values, refund full
`ccBudget`) beside 🎲 Randomize. The Review step (`renderReview`) shows portrait + filled bio + final
stats with roll mods, reusing the red/gold `stat-val` tiers, plus advisory warnings (no name,
unspent points) — but Begin itself requires a name (it jumps back to Bio with an error). An
unfinished hero autosaves per world to `kv.rpg` (`wizard-draft:<worldId>`, 30-day expiry, debounced
typing + every mutation via `saveDraft`); reopening restores it (`restoreDraft`), while explicit
cancel and successful Begin delete it (`clearDraft`). Only genuine portraits (data:/http:/blob:)
count as "touched" — the stock placeholder must never overwrite a saved draft on open.

**Back closes overlays** (`scripts/back-close.js`) — and **all navigation history lives in
`scripts/nav-history.js`**, the single common module every view must use (landing pages, the session
chat, profiles, the Explore panel's `#explore/<id>` URL). It owns `syncHomeHash` (the only hash
write — replaceState-only platform mirroring, same-URL posts, the stale-echo log), the landing
push-then-replace rule (tracked pushes while a Menu-grid bridge is pending, plain otherwise), the
`__mno:session/user/landing` entry markers with `pushSessionEntry` / `pushUserEntry`, the
`forgetEntry` (leave without popping) vs `popEntry` (leave with a pop) distinction, and the
hashchange-defers-to-popstate bridge-return guards. Future navigation changes go there, so the
Back-walk rules can't drift apart again. Overlay mechanics (`pushBackClose`, tokens, `reuse`,
`closeOnPop`, auto-splice of Back-closed entries): every modal overlay registers `pushBackClose(close)`
on open, which pushes a history entry; a device Back pops the topmost overlay (LIFO) instead of
navigating away. **Every programmatic close path (✕ / backdrop / Escape / teardown) MUST call the
returned `release()`** or a stale entry makes the next Back a silent no-op. Each entry carries a token
(`__bid`) and `release()` only calls `history.back()` while its own entry is current, because
`history.back()` is async and a release can race the next overlay's `pushState`. A Back-triggered close
that succeeds is spliced from the stack (closes that call `release()` inside already spliced —
idempotent), so bridge/no-op closes never linger as stale tops that misfire the next Back. A view that is being
replaced by another of its own kind (an Explore details panel swapped for another, §6.14) gives its entry
up with `release.forget()` instead — spliced from the stack, not popped — and the incoming view takes that
same entry over with `pushBackClose(close, {reuse:true})`, so a run of swaps leaves one entry behind, not
one per view. A popstate that did not actually pop our entry (a fragment write can emit one — see the
`<base>` note in §6.10) is likewise ignored, and a view may pass `closeOnPop` to keep the final say: the
Explore details panel uses it to survive a popstate while the URL still names a world (§6.14). The open
**session**
registers the same way (`{__mno:"session"}`), so Back from a chat returns to the shell — except while the
GM is mid-write, when `goToLanding()` returns `false` and the entry is re-pushed so an in-flight turn is
never discarded. Exits from inside the chat to a SPECIFIC landing page never pop the session entry:
a pop restores the chat-opener page's URL and the shell's hash router mounts THAT over the requested
page (Menu Worlds from an Adventures-opened chat landed on Adventures). So the Menu grid (Worlds /
Adventures / Explore) keeps its entry standing (`goToLanding({keepSession:true})`) — the mount
rewrites that entry to the new page's URL, and Back pops it and re-enters the stashed chat
(`menuReturnSession`, via `sessionBackClose`). In-landing navigation preserves the bridge and pushes
landing history on top (tracked while the bridge is pending so the session entry underneath can't
misfire), so Worlds → Explore → Back walks back to Worlds first and the final Back still resumes
the chat; opening another session from that landing consumes it (the old entry
is forgotten so the new chat pushes fresh and Back returns to the landing). A profile opened from the
chat Menu's Currently Playing author is the same kind of peek the other way — the forget bridge (no
programmatic `back()` to race the profile's own push) plus the session id stashed in
`userBackSession`, which `userBackClose` re-enters; any deliberate landing navigation or fresh
session entry clears it. `goToLanding({forgetSession:true})` is that bridge.

**Flat symbols:** Narrator: plain prose · Player: portrait · NPC: generated portrait ·
Memory `🧠` · Session `⚔` · Hero `🛡` · Map `🗺` · NPCs `👥` · Gallery `🖼` · Export `⭳` · Import `⭱` ·
Edit `✎` · Re-roll `🔄`/`⟳` · Delete `✖` · Settings `⚙` · Send `➤` · Direct `⚡` · Advance `⏩` · Scene `🎨`.
The rail panels and home pages wear the drawn `icon-*.png` marks rather than emoji in their titles; these
glyphs remain the app's inline/notification vocabulary.

**Responsive:** desktop = a centered transcript column with rail overlays; phone (390px) = a single
column, rails become full-width overlays. Tested at both sizes; the tracker bar becomes one scrollable
row.
### 6.11 Storage & sessions

`scripts/storage.js`. `SessionStore` persists over the kv-plugin (IndexedDB, per-browser, survives
reloads): kv folder `rpg`, a `sessions` list of tiny metadata rows (`{id, name, charName, worldId,
worldName, turn, lastUpdated, avatar, portraitSig}`) plus one `session_<id>` blob per session.
`HeroStore` keeps the global **saved-hero library** (`savedHeroes`, max 40) — bio + portrait only, not
bound to any world.

- **A session snapshots the world's name it was built in** (`worldName`, on the save and the index row):
  the id can't be turned back into a name once the world leaves the library, and the id is what the player
  must not be shown. `applyWorld` keeps `currentWorldName`, `newSession` writes it and `enterSession`
  backfills older saves; it names the missing world in the "World not installed" prompt and on the
  Adventures row (§6.10).
- **Opening an adventure whose world isn't installed searches the public worlds first**
  (`chooseWorldForUnbound` → community.js `findPublicWorldMatches`): a `lib:<id>` binding is looked up
  exactly, otherwise the remembered `worldName` is title-searched (exact-title-first, published only).
  Matches are offered one-click (`showPublicWorldMatches`: Add & play, or Play in this world when the
  candidate is already installed — your own reclaimed world binds its local id, anyone else's binds
  `lib:<id>` via `addPublicWorldAndBindId`). Only when nothing matches does the old "pick a different
  world" flow run, and its prompt then says the world wasn't found publicly either.
- **A row's face lives in the index, not the save.** The real portrait is a 60–90 KB data URL inside
  `session_<id>` (saves are megabytes), so the index caches a thumbnail — `avatar` (a ~2–4 KB JPEG from
  `portraitThumb`, `image-utils.js`) and `portraitSig`, a fingerprint of the portrait it came from — and a
  save re-derives it only when the signature changed, so the every-turn autosave never pays for a canvas
  encode. `SessionStore.backfillAvatars()` (once per Adventures visit) fills older saves one at a time in
  the background. A hero with no avatar draws a **gold monogram**, not a stock face.
- **Auto-save** after every GM turn (and on edit/delete/reroll/settings changes). **Export** downloads the
  active session as `.mno-adv` (`version: 2`, JSON, full state incl. portraits). **Import** validates
  (`parseImported`: version 1 or 2, must have `id`).
- **Version-archive compaction** — opening or importing a save runs `compactVersionArchives()` once, which
  drops single-version re-roll archives (migrating the legacy array-form `openingRerolls` to the
  `{start: […]}` object form); message text is untouched and it's a no-op on an already-compacted save.
  > **TODO — remove this at a later date.** It only exists to shrink saves written by the old eager
  > format. Once every live save has been opened/imported once, it and the legacy array-form branch in
  > `normalizeOpeningRerolls()` can be deleted — "archive absent" already means "one version".
- **Adventures panel** (`⚔ Adventures`): the rail's list of your adventures, drawn with the Adventures
  page's own `adventureRow` (§6.10) — the one list that asks for `face: false`, since a panel is too
  narrow. Sorted by last-updated with the current one marked `.current`; per-adventure Open / ✎ Rename /
  Delete (deleting the active one drops the chat and returns to the landing), plus **⬅ Back to World
  Selection**. Each adventure = one character + one timeline + its own memories/NPCs/settings/map. Boot
  always lands on the landing page.

### 6.12 Choose-your-own-adventure

**Opt-in, per-world:** the GM can offer 2–6 tappable action suggestions under its latest reply, and
clicking one submits it as the player's `action`. The narrator prompt is **not** involved — a world
enables it by asking for the format in its own text (`scenario`, `narrativeVibe` or `start`), e.g.:

```
CHOICES: End every reply with 2–4 short actions {{user}} could take next, each on its own line,
formatted exactly [[CHOICE: <action>]]. Never dictate {{user}}'s feelings — offer options only.
Offer none when the hero is dead or the story has ended.
```

- **Format:** each option is its own line `[[CHOICE: <action>]]` (case-insensitive; `[[OPTION: …]]` and a
  full-width `：` also accepted). Parsed in `parseGmOutput` *before* the `[Name]` speaker branch, stripped
  from the prose, and appended as one trailing `{role:"choice", options}` message (max `MAX_CHOICES` = 6).
  A half-typed `[[CHOICE:` fragment at the end of a streaming chunk is stripped so it never flashes as
  prose.
- **Rendering** (`main.js`): only the **most recent turn** (`choicesIdx` = the last GM turn when nothing is
  generating and every later turn is image-only); older ones stay hidden, and the block is suppressed
  while generating, during edits and after game over. The options sit after the tracker-change chips, at
  the very bottom of the reply.
- **Never fed back:** choice messages carry no `text` and are excluded from `fmt`/`recentChatText`, the
  memory roll-up and `npc-system._storyExcerpt`, so they are pure UI. The GM textarea edit view
  round-trips them as `[[CHOICE: …]]`.
- **Styles:** `.msg.choices` / `.choices-label` / `.choices-row` / `.choice-btn` in `styles.css`; a phone
  rule lets the block use the full bubble width.

### 6.13 Stopping a generation

While the GM writes, the composer's send button **becomes a stop control** (glyph swaps to `■`, turns red,
title "Stop generating"; `#sendBtn.stopping` overrides only `color`, so the chrome is unchanged) and stays
clickable. Clicking it aborts the turn's in-flight `generateText`.

- **Why the same button:** the composer has one send control and sending is impossible mid-turn anyway
  (the input is disabled), so `setLoading(on)` never *disables* `#sendBtn` — it only swaps the glyph +
  class. The game-over lock is applied separately (`updateComposerForGameOver()`).
- **Wiring:** `#sendBtn` → `onSendBtn()` → `send()` normally, `stopGmTurn()` while generating.
  `stopGmTurn` calls `engine.stop()`, which sets `RPEngine._aborted` and calls `.stop()` on the in-flight
  promise, then toasts `⏹ Stopped.`
- **What `.stop()` does:** the plugin's promise `.stop()` **resolves early with the partial text** (it
  resolves, not rejects; the `onChunk` text equals `.text`), so the normal path just sees a short reply —
  no abort exception. Settling takes ~150–250 ms.
- **Partial replies are kept** (committed, re-rollable, just truncated). What is *skipped* is every
  remaining AI call of that turn, via `_aborted` guards: the tracker update + level-up backstop, the
  pre-reply skill check and the death scene. An aborted reply therefore carries **no `afterTrackers`**, so
  the tracked state carries over from the previous turn.
- **Stopping before the first chunk** (during the skill-check call) makes `generateGmReply` return an empty
  list, leaving that turn with just the player's action and no GM text.
- **Lifecycle:** `runGmTurn` calls `engine.clearStop()` at the top of every turn so a stop can't leak
  forward; `_active` is a **Set** of the turn's in-flight promises (a turn issues several calls, and the
  hero + NPC tracker calls run in parallel), so a stop aborts all of them. The generation lock
  (`generating` + the stop-button state) always releases via `try/finally`, even if a turn throws —
  a failed turn can never wedge send / re-roll until reload.
- **Background work is unaffected:** `memory`, `npcSys` and `mapSys` receive the raw `genText`, so a stop
  doesn't cancel an NPC portrait or a map build.

### 6.14 Community layer (Explore, publishing, added-world library)

Everything lives in **`src/scripts/community.js`**, **lazily imported on first need** — the socket, the
catalog fetch and the Explore DOM never touch the boot or play path. It exposes `api` (also on
`window.community` for debugging) and talks back to the app only through `window.mnoApp`.

**Two stores, deliberately separated.** The catalog holds **metadata only** (title, tags, cover URL,
the Author's-notes 32-char upload ID, hashes, counters) on the **server-plugin**; the world JSON is uploaded by the **upload-plugin** and
referenced by URL — so browsing is cheap and the server's byte state stays small. The notes TEXT
itself lives in its own upload blob (`src/scripts/notes.js`); the record keeps only the blob's
32-hex file ID as a trailing slot field after the hashes (old records decode as "" — no layout
bump, no migration), and detail panels lazy-fetch + cache it.

- **Server (bottom of `index.html`)** — a synchronous server script: record + user codecs, an
  open-addressing hash index (probe chain, `IDX_TOMB` sentinel) over `RECORDS`,
  `USER_BY_ID`/`USER_BY_NAME`, a reboot-time index rebuild, and RPCs for
  publish/update/delete/get/getWorlds/checkUsername/claimUsername/renameUser/reportWorld/appealWorld/
  modlog/admin plus `watchCatalog`/`unwatchCatalog` (pub/sub). **All of it is public source** — never put
  a secret in it; the admin password's SHA-256 hash is the only credential it carries, and the only reason
  a handler can be owner-only (`getModLog`/`moderate` check `adminConns`). Transport failures surface as
  socket `close` codes — always handle `close` rather than awaiting forever (`transportMsg` maps
  1006/1011/4403/4429). `rpc()` retries once on transport failure (never on app refusals or
  permanent 4403/4429 closes) and re-subscribes `watchCatalog` after a retry; a 20s `ping()`
  keepalive runs only while Explore is on screen or an admin session holds the socket, so idle
  NAT timeouts don't surface as 1006 on the next action.
- **Identity is device-local.** A random `secret` (kv `community/user`) derives the public `userId`; a
  **username** is claimed once on the server (unique, renameable once / 7 days; giving a name up
  **frees** it for anyone to claim — names are never retired, because an author is always rendered from
  their `userId`, so a recycled name can't inherit anyone's worlds). `claimUsernamePopup` opens **prefilled with your current name** and answers that name
  locally — "✓ current" — rather than letting `checkUsername` report it as taken by you;
  submitting it unchanged just closes (no registry call, so it can't burn the rename cooldown). A world's **edit token is derived deterministically from the secret + worldId**, so the secret
  alone is authority to update — which is why it is the "creator code" and why the backup warns. A
  **creator code** (`MNO1-…`) serializes `{userId, secret}`; `restoreCreatorCode` makes a new device into
  the same author, and `reclaimMyWorlds` / `reclaimSingleWorld` then pull that author's published
  worlds (via the owner-only `listOwnWorlds`, which also returns reports-hidden listings) back into
  the local world library with rebuilt publish links — never overwriting a local world. The restore
  flow (`promptRestoreCreatorCode`) runs the reclaim automatically; Settings → Identity also has a
  manual "Restore my published worlds" button, and your own Explore listing offers "Restore to my
  worlds" when its local copy is missing (`addToLibrary` routes your own world the same way instead
  of refusing).
- **Publish flows.** `publishFlow` handles publish / listing-only (no re-upload) / content update, and
  **picks between them itself**: with no explicit mode it diffs the local file against the link record's
  memory of the last push via a **content signature** (`contentSigOf` — a sha256 of the canonical upload
  text with `meta` reduced to `{id, createdAt}`, so listing fields, the signed author line and
  `updatedAt` are excluded) and a **listing fingerprint** (title, description, tags, rating, cover,
  Author's-notes pointer). A
  content upload wins when both moved; when neither moved nothing is sent (`{mode:"none"}` + a toast). The
  cover is fingerprinted as `local:<fnv-digest>` while it is local, since the push rewrites it to the
  uploaded URL. `republishWorld` revives an unpublished link (sending the stored `coverUrl` back);
  `unpublishWorld` tombstones the record and best-effort deletes the blob. Every catalog write goes
  through `rpcClaiming`, which recovers **once** from `username_required` by re-claiming and retrying; a
  failed publish cleans up its orphan blob. `uploadBlob` normalises the plugin's `url`/`deletionUrl` with
  `String(...)` — the plugin hands back String **objects**, and a String object never `===` a plain string.
  **Ordering rule: no overlay, no upload, no server write until every check has passed.** The publish
  overlay (`.ex-busy`, z-index 80) is created *last*, and the pre-flight runs in this order: the
  **description gate** (`descTooShort` — at least `MIN_DESC_CHARS` (140) trimmed UTF-8 bytes; it cancels
  with a toast *before* the interactive steps, so a listing that can't go up never claims a username or
  makes the author choose a cover; `republishWorld` applies the same gate) and the **tags gate**
  (`tagsTooFew` — at least `MIN_TAGS` (3) author tags, same toast-and-cancel shape), then the file JSON
  round-trips, the size/id caps and malware screen run, the identity and its username claim are settled (`ensureIdentityAndName()`, with one
  authoritative `getUser` read), then the cover gate's interactive part runs. `prepareCover()` decides
  (foreign-host prompt, file picker, downscale) with no network, and `commitCover()` does the one upload
  after the overlay is up. The cover's size/quality caps live in `image-utils.js` (`COVER_MAX_DIM` 1024)
  and are shared with the world editor: the editor and the publish step MUST cap identically, or
  publishing silently downgrades the author's cover (this was 512 here against the editor's 1024). A
  cover the editor already encoded — JPEG or WebP within the cap — is passed through untouched, so the
  published cover is the author's own file rather than a re-encode of it. `rpcClaiming` still recovers a mid-flight `username_required`, and for that
  case the claim overlay wears `ex-user-ov` (z-index 90) and borrows the busy overlay's text through
  `activeBusy.lend(...)` so the wait is explained instead of looking frozen.
- **The toast is the topmost layer.** `#toastEl` (z-index 100) sits above every overlay — panels/pickers
  (`.cc-overlay` 60), the world editor (`.ce-overlay` 70), the publish busy overlay (`.ex-busy` 80), and
  confirms + the username gate (`.popup-overlay` / `.ex-user-ov` 90) — because a toast is how a panel
  reports what just happened (a retry that failed, a publish that landed, a world that was saved). Its
  position never changes (bottom-centre at chat height, whatever is underneath) and it stays
  `pointer-events: none`, so it covers panel content for a few seconds without ever blocking a click:
  toasts are transient, and a toast nobody can see is worse than one that overlaps a button.
- **One management surface:** everything an author can do to a world they own lives on the **Worlds
  page** — the card's **⋮** menu carries a community entry labelled by the world's own state
  (`worldMenuCommunityEntries`: **🌐 Publish**, **🌐 Publish Changes**, **⛔ Unpublish**, and **⚑ Appeal
  (unhide)** only when the community has hidden it), and each opens `openCommunityMenu(metaId)`, which
  picks the flows that apply. The panel is written in plain language (no "catalog"/"listing"/ids):
  Publish for a never-published (or unpublished) world; Publish Changes for a live one whose local copy
  moved on (*"You have unpublished changes."* plus one plain statement of whether the world itself
  changed or only its details); a live world with nothing to publish shows **🌐 Published** and no
  button. Every version prints the version in a `cc-ver` span (`v1 → v2` when the world is re-uploaded,
  else `vN`), buttons read **Cancel** first like every confirmation, and each panel ends with the **daily
  allowance line** (`quotaLineHtml`: `Publish quota 3/5 · resets daily`, or `Update quota …` — the
  panel's own action's count, read from the catalog via `getQuota` in the same breath as its
  `checkOwnListings` sweep; the line is absent if the catalog can't be reached). When the allowance is
  genuinely spent (`enforced` and `used >= limit`) the action button is dropped and one sentence says
  why. **⚑ Appeal** rides here only for a **community** hide (a moderator's hide isn't the author's to
  reverse and offers nothing; `appealWorld` refuses it too); the entry reads **⚑ Appeal Pending** while
  an appeal is in flight, and selecting it reports when the world comes back (`APPEAL_DELAY_MS` later).
  There is no listing-edit form here — listing fields belong to the world file, edited in the **world
  editor** and pushed with Publish Changes. When the community shows a hidden world of yours in Explore,
  `syncOwnLinkStatuses()` folds `hidden`, `hiddenReason` (`reports` vs `admin`) and any `reinstatesAt`
  onto the local link record (a kv write only on a real change), which is what lets the Worlds card say
  `· Hidden` / `· Appeal Pending` without querying the community; the other direction — a listing the
  community no longer has — is folded by `checkOwnListings()`'s `markLinkRemoved()` tombstone (keeping its
  `worldId`). `mountWorldsPage` runs one batched sweep per visit and `openCommunityMenu` once more before
  choosing a panel, so a world the community no longer has offers **🌐 Publish** instead of the dead end
  of a `· Published` label; an unreachable community changes nothing (an offline device must never
  tombstone a live world). `publishFlow`'s write step heals in both directions — `not_found` on an update
  publishes afresh, `world_exists` on a publish updates (and revives) the record — both landing on the
  same `worldId`. These flows repaint via `window.mnoApp.repaintWorldsPage()` (never `refreshLanding()`).
- **Deleting a world unpublishes it first.** `worldCard`'s ⋮ → ✖ Delete reads the link record straight
  from kv (`communityKv("links")`); when the world is live the confirmation says so and names both
  effects, then `unpublishWorld(metaId, {confirm:false, note:false})` runs *before* `worldStore.remove()`
  — so a world can never be deleted while its listing stays up. If the unpublish fails the delete is
  **abandoned** with a toast and the world is left as it was (`community.links` keeps the tombstone, so
  re-publishing reuses the same link).
- **Sharing a world to a third-party library.** `worldCard`'s ⋮ → ↗ Share (External) (above Delete) opens a
  destination picker (`openSharePanel` in `share-external.js`, lazy-imported so the code only loads when
  used). The picker says plainly that the world leaves this engine for an external library and warns it may
  not play 1:1 elsewhere; each destination is an icon button (icons are shipped `src/images/` assets, e.g.
  `unseen-scribe.webp` (64×64, vendored from the Library's brand plugin, never hotlinked)). A final
  **🌐 Publish in this engine** button at the bottom runs the card's own ⋮ → Publish flow
  (`openCommunityMenu(metaId)` via an `onPublish` callback, so the two are one flow) for a player who
  opened Share but wants the world in this engine's Explore.
- **Explore** is the **Explore page of the home shell (§6.10)** — `mountExplore()` renders into the pane
  and **wears the same toolbar as Worlds**: search field, **⚙ Filters**, **⇅ sort** and **⊘ NSFW**. The
  panel holds two kinds of filter: a **YOURS** row (the reader-local **♥ Liked** chip) over a **TAGS**
  cloud of the catalog's own facets — both drawn with the same three-valued chips (require / ✕ exclude),
  the tags tallied by `listFacets` with the tag dimension ignored so a count never collapses to 0, while
  the Liked chip carries no count (the catalog knows only like *counts*, never who hearted what). Liked
  narrows to the worlds in your own per-device `likedWorlds` set — requiring it shows exactly those,
  excluding it hides them — so its ids ride the query as an allow-list (`worldIds`) or deny-list
  (`worldIdsNot`) into `filterRecords` in the server plugin, which keeps the paging totals and the facet
  counts honest, and it counts toward the ⚙ badge, the pill row and "Clear all" like any other filter.
  NSFW sits on the shared switch (it decides what
  *exists*, not what's listed)
  and is the same preference Worlds wears. (The reader's **Blocked tags** / **Muted authors** are
  device-local, not catalog filters, and live in Settings → Content settings, §6.16.) Applied filters show
  as removable `.hm-apill` pills; worlds hidden after reports are always excluded; nothing matching → the
  shared `emptyStateEl` block with `icon-explore.png`. **A world of your own reads as already-added** (the
  `✓` in-library icon) though it is absent from the added-world library, and its popup ends with the same
  Play/Continue + adventures block the Worlds panel shows (`mnoApp.mountWorldSessions`); an added world
  with a saved copy gets that block too, bound to `lib:<worldId>`, while one with no local copy keeps the
  reader actions alone (**🡻 Add to Library**, or **🡻 Retry download**). Starting an adventure closes the
  popup at the moment the next screen exists, never before — the panel's close hook is handed down through
  `mountWorldSessions` and runs inside `beginNewAdventure` (see §7's handoff rule); the **▶ Continue** /
  adventure-row paths don't take that hook (they run `enterSession`), so this panel also watches `#landing`
  for `hidden` and closes itself the frame the chat replaces it — the same watcher the Worlds panel uses,
  and without it the panel stayed on top of the chat. And both Play paths
  call **`pauseExplore()`** (releases the socket but leaves the
  page mounted, so the wizard opens over a populated Explore page). While mounted it **subscribes to the
  catalog** and shows a "⟳ catalog changed" pill on remote changes (`NUDGE_SELF_MS` suppresses our own
  echo). **Likes** (`likeWorld`/`unlikeWorld`) are the one catalog write a reader makes: the card's heart
  and the popup's likes entry are the same `likeCountHtml()` and call `toggleLike()`, which folds the
  server's authoritative total back into the record and writes your set to the `likedWorlds` pref. Your
  OWN listing wears the same live heart — there is no self-like guard, since a self-like is a legitimate
  bookmark and it is exactly what the Liked filter reads — on the card and in the popup. The
  server **dedupes a like per network group** (three nested groups with 72 h / 6 h / 30 min cooldowns), so
  `counted` can be `false` while the UI still shows ♥ locally; un-liking releases the network's like in
  every group, so like → unlike → like oscillates 1 → 0 → 1.
- **Share links.** Every published world has one: `https://perchance.org/<generatorName>#explore/<worldId>`.
  It is built at runtime from `window.generatorName` (never `location.href`, which points at the iframe's
  subdomain and can't be navigated to directly), and it rides the shell's hash routing (§6.10): on load, or on
  a later `hashchange`, the shell mounts Explore and calls `community.openLinkedWorld(worldId)`, which asks the
  catalog with `getWorld` and opens `openWorldDetail`. The catalog is the authority, so the panel opens for a
  **hidden** world too — a direct link is the one way to a world Explore itself is hiding, and the panel says
  so — while a target it can't resolve (never published, unpublished, or gone) toasts and is dropped from the
  URL (a transport failure keeps it, so a reload retries). The panel OWNS the target while it is open: it puts
  `#explore/<worldId>` in the URL on open and clears it back to `#explore` on close, on every path (✕, backdrop,
  Escape, Back). So the address bar mid-session IS the world's share link — the browser's own Copy-address /
  share-sheet now works, and a reload reopens the world. This goes through the shell's `syncHomeHash`
  (`replaceState`) because that is the one write the platform mirrors to the visible host-page URL (§6.10). The
  id is set on the panel's own history entry, never on the Explore entry beneath it (a deep link arrives with
  the id already on the current entry, so the panel normalises it away first): that way the entry a close pops
  back to is a clean `#explore` and Back can't land on a world id that re-fires the deep-link route and reopens
  the panel. Only one details panel is ever open: a link to another world arriving over it swaps the panel
  to that world (the outgoing entry is reused, not stacked), and a navigation to any other route closes it
  and lets that route land. `pushBackClose`'s `closeOnPop` is what keeps a close honest here — the panel
  declines the stray popstate a fragment write emits while the URL still names a world, but a real Back to
  the bare `#explore` still closes it. **🔗 Copy link** is
  offered by every world detail popup for a world that has a catalog id. In Explore's own panel (on every
  world that isn't removed) it is a capsule in the details ledger, sat to the right of the download counter
  — the same `.ex-pip` furniture the two counters wear, its button reset by `.ex-pipbtn` and given a green
  hover tint so it reads as an action beside the read-only counters. The Worlds page's popup
  (`openWorldPanel`, main.js) draws the same capsule in its own `.ex-facts` row just above the meta row,
  fed by `opts.share`: `openWorldDetail` passes the live listing's `link.worldId` (an unpublished world has
  none — there is nothing to link to), and `openLibWorldDetail` passes an added world's id unless the
  library record says it is `unknown`/`removed` (a dead link would only say so; a `hidden` original still
  resolves by direct link, so it keeps the button). It is also offered by the Worlds page's ⋮ menu for a
  live listing of your own
  (`copyWorldLink` / `worldShareUrl` in `community.js`). The copy itself goes through the platform's
  `copy-text-plugin` (`copyTextPlugin`, imported in `main.pjs`) with a textarea/`execCommand` fallback —
  and, because a generator runs in a cross-origin iframe whose `clipboard-write` grant depends on the host
  page (production grants it; the editor/preview frame does not, so copying there legitimately fails), a
  refused copy ends with the link shown **pre-selected in a popup** to copy by hand rather than a silent
  no-op.
- **Added worlds.** "Add to Library" fetches/verifies the world **first and caches the JSON text** in kv
  `community/cache` (fetch-first, then the library reference is written), so a failed *first* add
  leaves nothing behind — no unplayable stub — while a world already in the library keeps its entry
  with (`unavailable` + `failReason` on the record) and the card wears **⚠ Download Failed**; **🡻 Retry
  download** (the card's ⋮ menu, or Explore's popup) goes through `retryLibrary`, which asks the catalog
  what the world is *now* (its snapshot's `jsonUrl` is exactly what rots — an expired/removed upload, or a
  re-published version) with the snapshot kept as the offline fallback, then **emits `library`** so the card
  actually repaints when the copy lands (an in-place `🡻 Downloading…` covers the landing section's copy of
  the card; without the emit a successful retry was indistinguishable from a dead button). Every reported
  failure is translated to plain English by **`downloadFailText`** — `download_failed` (HTTP 404: the blob
  is gone from the host), `hash_mismatch` (the bytes don't match the catalog's checksum), `invalid_world`,
  a transport failure, or `not_found` (the community no longer has the world, so there is nothing left to
  download). The card's tooltip carries the same reason next to ⋮ → Retry.
  `checkLibraryUpdates` flags stale (⟳ Update
  available) and gone (💾 saved copy) entries. **Duplicate** writes an ordinary local world carrying
  `meta.remix` — a fork with visible provenance — never an editable copy. Adding also fires a
  **best-effort `incrementDownload` ping** whose returned total is folded back into the card (the 🡻
  number is the server's truth); the server counts **at most one download per network group per world,
  ever**, so a repeat add legitimately returns `counted:false`. The ping fires only for a file that
  actually landed (a failed first add counts nothing).
- **A listing is only a URL.** The catalog stores the world file's URL — host-checked at publish, and now
  fetch-verified: `publishFlow` reads the just-uploaded blob back and compares its SHA-256 before the
  record points at it (one fresh re-upload on a transient miss, else the publish fails and its orphans
  are deleted), so a phantom success (plugin says ok, host 404s for everyone) never goes live — and
  nothing re-checks it afterwards, so a listing can still go stale while its file is gone from
  the host: `unpublishWorld` deletes the blob, and a **revive** (the ⋮ menu's 🌐 Publish on a tombstone,
  or a listing-only push from a device whose link record is stale) keeps that deleted URL, leaving
  Explore with a world every reader fails to download. `publishFlow` therefore probes the stored blob
  before any push that would leave the URL alone — **`blobMissing`** (HEAD, then a ranged GET; only a
  definite 404/410 counts, so offline/blocked/a host hiccup reads as "still there" and never triggers a
  needless re-upload) — and quietly becomes a **content push** (same file, re-uploaded, `version` bumps)
  when it's gone, healing the record; a "✓ Nothing to publish" heals the same way instead of stopping at
  "up to date", and `republishWorld` makes the same check before its listing-only revive (the delete is
  best-effort, so a blob that outlived its unpublish still takes the cheap path). This is the repair for
  a broken listing — the author's next 🌐 Publish fixes a world whose file 404s for everyone.
- **Publishing a copy → a remix.** Importing a world file is purely local, but if a *copy* of a world that
  is out there is published, the pre-flight asks the catalog once (`<authorId>-<meta.id>`) and marks the
  listing as a remix of it (writing the same `meta.remix` record the ⧉ flow writes, so the original's
  author keeps the credit). Four guards each must answer "no": no `meta.authorId` (older/hand-made files),
  the file already carries `meta.remix` (its own lineage wins), the `authorId` is *ours* (never a remix of
  itself), or the record is gone / the read failed (publish plainly — it is a courtesy, never a gate). A
  positive answer is cached for the session; a "no" never is. Any publish panel for a remix carries the
  guidance — a remix is not a repost, only publish it when it's significantly different from the original.
- **Moderation.** No approval gate or taste blocklist. **64 reports from distinct networks inside 72 h**
  auto-hide a world, and the hide **sticks**: nothing but the author's **appeal** brings a reports-hidden
  world back — the catalog records it and acts `APPEAL_DELAY_MS` = **3 days** later (lazily, on the
  record's next visit; the server has no timers), one appeal per world per **30 days**. A *moderator's*
  hide is not appealable, and neither an update nor anything else lifts a hide. The log records only
  reports-hidden events, appeals and admin actions (ordinary publishing/updating/claiming are not logged)
  and is **owner-only**: `moderate()` and `getModLog()` sit behind a **SHA-256-hashed admin password**
  embedded in the server script (the plaintext lives only with the owner). The Settings panel's **Admin**
  section (§6.16) is the only way in; authorization is **per socket connection** (`adminConns`), never
  stored client-side, and the session **outlives the panel** — it ends at the Admin section's **Sign out**,
  on a reload, or when the connection carrying it drops (which the client notices and reports). Console
  equivalents: `community.adminLogin(pw)` then `community.adminModerate(worldId, "hide"|"unhide"|"nsfw"|"sfw"|"unpublish")`.
- **The admin actions, and where they are offered.** `moderate` is the whole surface:
  **hide** (`HIDDEN_ADMIN` — out of Explore, no appeal, an update can't lift it: the sticky one, for
  anything that must stay down), **unhide** (back to `PUBLISHED`, reports cleared), **nsfw** / **sfw**
  (the moderation rating: set or clear the record's `nsfw`, so the ⊘ Show-NSFW filter and the reserved
  `nsfw` tag apply to a world its author didn't rate) and **unpublish**
  (`STATUS_REMOVED` — leaves the catalog and Explore, and because it writes the same tombstone the
  author's own unpublish writes, the author can publish the world again; the uploaded blob is left on the
  host, since only the author's device holds its deletion URL). *Unpublish* is the action that used to be
  called *remove*: the server still accepts `"remove"` as an alias so an older client keeps working, and
  such rows keep decoding as `admin_remove` (both decode to the label "unpublished by admin"). The rating
  mark is **locked** (record flags bit 1): `updateWorld` ignores the author's `nsfw` while it is set, so
  their next content update can't quietly lift a moderator's call — an admin can still flip it either way,
  and each change is logged (`admin_nsfw` / `admin_sfw`). They are
  reachable from two places, both admin-only: the mod log's per-world groups (§6.16) — which only list
  worlds that are *already* in the log — and, new, each **Explore card's 🔑 corner control** plus the
  world-detail popup's **Admin** group, which act on any listing you can see (the case the log can't
  cover: a live listing whose file 404s and which nobody reported). There the rating is a single
  **Mark NSFW / Unmark NSFW** toggle that reads the world's current state; in the log the actions sit
  in **Visibility** and **Rating** groups, and the inapplicable toggle hides once the row's details
  load. The client's `adminAuthed` gates the
  buttons (the grid repaints on every sign-in/out, `emit("admin")`) and the server refuses `moderate` to a
  connection that hasn't authenticated, so the buttons are a convenience and never the guard.
- **Deleting an identity (`deleteUser`).** Also owner-only. It erases a **registered user** by userId:
  the user slot is emptied and both index cells are tombstoned, and the username is **released**, so it
  is claimable again at once (exactly what a rename does — see the identity note above; names are never
  retired). Every world the
  identity owns is moved to the same `removed` tombstone the author's own unpublish writes, so no
  listing is left authored by a ghost. Irreversible. It requires `confirmUsername` to still match the
  record, so a pasted id alone cannot erase the wrong user. Offered in the Settings panel's **Admin**
  section (§6.16) as a **Delete an identity** group (paste an id → **Look up** shows the name →
  **Delete user…**), and from the console as `community.adminDeleteUser(userId, confirmUsername)`
  after `community.adminLogin(pw)`.
- **Rate limits (`RL_ENFORCED`).** The master switch is `const RL_ENFORCED = true;` above `rlAllow()` in
  the server plugin; it ships **true**. Flip it to `false` only for a deliberate testing pass — the
  counters still count (so the publish panel's allowance line stays real) and simply stop at the cap,
  nothing is refused, and `rlQuota` reports `enforced: false` (which stops the client showing a full
  allowance as "used up"). Limits are per-network, fixed 24 h window: **publish 5 / update 10 / claim 5 /
  report 10** (stricter for proxies: 1 / 5 / 5 / 5). Likes, download dedupe and the admin-login
  throttle have their own cooldowns and are unaffected. A trip surfaces as `ERR_TEXT.rate_limited`.
- **Editor-only mock catalog (`src/scripts/mock-seed.js`).** The editor's server is an ephemeral
  emulator (catalog and rate limits reset on every preview reload), so Explore starts empty. Its footer
  grows a **🧪 Seed mock worlds** button *only while `window.generatorIsUnsaved`*; it lazily imports
  `mock-seed.js` and publishes mock authors + demo worlds through the ordinary RPCs (the same path the app
  uses). The emulator models one **network group** per browser, so the real per-network limits apply (**5
  new worlds / 5 new usernames per 24 h**) — hence the seeder publishes only the first five and reports
  `hitLimit`. Likes/downloads dedupe on the same key, so the seeder **does not spend them by default**
  (`likes:false`) and the seeded catalog starts at **♡ 0 · 🡻 0**, so *your* like / add visibly move the
  numbers; `mockSeed.seedMockCatalog({likes:true})` restores the old baseline. A saved generator's real
  server enforces the identical 5-publish cap per network.

  **`seedMockCatalog()` fails closed — never run it outside the unsaved editor.** `createServerSocket()`
  is the throwaway emulator *only* while `window.generatorIsUnsaved` is true (a generator that has never
  been saved); for a **saved** generator it returns a socket to the real, shared production server, even
  in the editor preview. Because the seeder writes through the ordinary RPCs, a direct call (console,
  `window.mockSeed`, or an automated `page_eval`) therefore published mock worlds to the live catalog and
  claimed real usernames there — the guard used to live only on the 🧪 button's visibility, which does not
  constrain the function itself. `openSocket()` now runs `assertEphemeralEditor(sock)`, which refuses
  (throws, before any write) unless `generatorIsUnsaved === true` *and* the socket is not production
  (`constructor.name !== "ProductionServerSocket"` and no `server-plugin.perchance.org` in its `url`).
  Any future harness that wants mock data must go through the unsaved-editor emulator, never a saved
  preview. If a live catalog is ever polluted this way, the worlds can be unpublished from the catalog,
  but the claimed usernames and the emulator's rate-limit buckets stay — so treat this as unrecoverable.

### 6.15 Data & Backup (everything)

`src/scripts/backup.js` exports **one plain JSON** file: adventures (incl. `session_*` blobs), the world
library, the community identity + links + library + settings (+ cached world copies, opt-in) and a couple
of UI prefs. It downloads as **`<date>.mno-backup`** (the same `<name><extension>` shape as `.mno-world` /
`.mno-adv` / `.mno-lore`, so the picker offers only backups), named after the date because a backup has no
name of its own. Import still accepts a legacy `.json` backup (validated by its `format` field, not its
name). `KV_REGISTRY` lists the kv folders/keys to walk (kv can't enumerate folder names — **add a folder
here when a feature adds one**). Import offers **merge** or **replace-all** (wipe the three folders, then
write; the app reloads so every store re-initialises). Because the file contains the creator code, the
warning is shown every time — on the page above the buttons and again in the download confirmation. The
module is lazily imported (never in the boot path) and reached **only from the Settings panel**, whose
Data & Backup section it draws (§6.16); that section ends with the **💾 Storage** group — the app's own
size readout, then the browser's answer to the same question as two more rows (§6.16).

### 6.16 Settings panel (identity + content settings + interface + Image Gen + AI Model + Data & Backup)

Settings is a **popup panel**, not a page (a modal's worth of content shouldn't cost a navigation).
`openSettingsPanel(section)` raises it over whatever page is showing; `section` is
`"identity" | "content" | "interface" | "imagegen" | "aimodel" | "backup" | "admin"`, or `null` (the default) for **no particular
section** — which is what the home nav's Settings item passes. Desktop renders both options the same way
(the panel opens on the first section, Identity); on a phone they differ, because there the rail is a
drill-down: a named section opens its card, and `null` leaves you on the **section list** (§6.16, Layout).
The Explore header's identity chip passes `"identity"`, so the chip opens the panel **on Identity, without
leaving Explore**. It never touches `homePage` or the URL, and closing it leaves the page where it was. ✕, Escape,
a scrim click and the device Back all close it; a second open request switches to the requested section
instead of stacking.

It assembles from seven `<section>` elements, each drawn by the module that already owned its content
(except **Interface**, which is main.js's own), shown **one at a time** behind a section rail (`.pf-md`):

- **Identity** (`community.js`'s `identitySection()`): the **Username** row (@name, **Claim** / **Rename**
  opening the same `claimUsernamePopup` the publish flow uses), the **User id**, the **Creator code**
  behind a **Reveal**/**Hide** toggle (cleared on hide — the master key isn't left in the DOM), the amber
  master-key warning, and **Switch identity** (`Paste a creator code…` → `promptRestoreCreatorCode`, which
  confirms and then reloads: a switched identity changes who owns what and is read into several in-memory
  places at boot).
- **Content settings** (`contentSettingsSection()`): **Show NSFW** (an **On** / **Off** `.ui-sw` for the
  shared per-device preference behind the toolbar's ⊘, so a reader can set the standing answer here
  instead of at every toolbar), then the reader's blocklists — **Blocked tags** (the shared
  `chip-input.js` field, capped at `MAX_BLOCKED_TAGS` = 60) and **Muted authors** (removable chips). The
  blocklists use the same `community/settings` keys, applied by the same `blockedSet()` after every
  Explore page. Muted authors are stored as **ids** (`mutedUsers`) — the catalog keys by id and a rename
  must not break a mute — with a `mutedNames` display sidecar and `localAuthorNames()` filling what it
  can; an id nobody can name falls back to its first eight characters. Clicking a chip unmutes and
  removes it from both. Flipping Show NSFW repaints whichever card page is behind the popup (Explore
  in-module via `refreshExplore`; Worlds through `mnoApp.applyNsfwPref`), dropping a stale `nsfw`
  REQUIRE filter exactly as the toolbar's own switch does.
- **Interface** (`interfaceSection()`): how the app itself looks, kept per device. Two rows —
  **Welcome Banner** (**On** / **Off**, `mno.worlds.welcome`) and **Input Tip** (`mno.composer.tip`) —
  each the way back for something dismissed in place.
- **Image Gen** (`image-provider.js`'s `imageProviderControls()`, mounted by main.js's
  `imageGenSection()`): global image-generation settings, kept per device.
  A **Provider** dropdown (**Perchance AI**, **OpenAI**, **OpenRouter**) with editable base URL +
  model and your own API key, plus a **Test connection** button — the same BYOK shape as AI Model,
  and the key map is shared with it (`mno.aiProviderKey`: one entry per provider id, so a key entered
  on either section fills the other; both sections say so — "Shared key with AI Model" /
  "Shared key with Image Gen", the latter shown only on the OpenAI/OpenRouter providers Image Gen
  actually uses). With no key saved the provider silently falls back to Perchance
  AI. Every image call in the app (scene images, hero/NPC portraits, world-editor previews) goes
  through `routedGenImage`, which reads the live config per call (switching takes effect at once, no
  reload) and returns the plugin's `{dataUrl}` shape, so the existing `genImageSafe` timeout/retry
  wrapper works unchanged. OpenAI uses its `/images/generations` endpoint (the plugin's `resolution`
  mapped to a model-family size by aspect: square 1024x1024; portrait/landscape 1024x1536 /
  1536x1024, or 1024x1792 / 1792x1024 on dall-e-3, square-only on dall-e-2; `b64_json` requested so
  images stay inline in saves, `background: "transparent"` for cut-out calls on gpt-image-1 models);
  OpenRouter uses its dedicated `/images` endpoint (`aspect_ratio` 1:1 / 2:3 / 3:2 by aspect, default
  model `openai/gpt-5-image-mini`) with a bare-`{model, prompt}` retry when a model rejects an
  optional. Either side fetches `url` answers into data URLs otherwise. **Test** is free (it hits
  `/models`, or OpenRouter's `/auth/key`) — only real generations spend. A foldable **External AI images**
  box (above **Advanced settings**, same shared `.foldbox` style, open by default) holds an **All** master
  switch plus one **On** / **Off** toggle per image job — **Portraits** (hero + NPC portraits, including the
  world-editor style preview and NPC avatar generator), **Scene image** (in-story scene illustrations),
  **Other** (world-editor cover art + title logos; each label carries a ⓘ info-tip with its note): a job
  switched off runs on Perchance AI even while the provider above is external. The toggles only show for
  external providers (Perchance AI needs no routing) and persist like every other control. An **Advanced settings**
  foldbox holds per-provider options, stored per provider in `mno.imageProvider` (`opts`):
  **Resolution** (OpenRouter only: Default/512/1K/2K/4K, omitted on Default) and **Quality**
  (both: Default/auto/low/medium/high, plus standard/hd for dall-e-3 on OpenAI; omitted on
  Default, and never sent where the model rejects it — dall-e-2 takes none, dall-e-3 only
  standard/hd; the OpenAI call additionally sheds `response_format`/`quality`/`background` one
  layer at a time on a 400 before a minimal retry, since `response_format` is legacy and
  unsupported on GPT image models). The **Guidance scale**
  slider (1–30, default 7, `mno.imageGenPrefs`) is Perchance AI's own configuration: it sits between
  the provider rows and **Save** and follows the dropdown (picking Perchance AI shows it before Save
  is pressed; the slider writes live, no save needed).
  The slider's track/thumb painting lives in a `<style>` inside the section's own markup
  (not `styles.css`): range pseudo-element rules only take effect colocated like that
  in this app's preview pipeline.
- **AI Model** (`ai-provider.js`'s `aiModelSection()`): which AI writes the stories — a provider
  dropdown (**Perchance AI**, **OpenAI**, **DeepSeek**, **OpenRouter**, **Ollama (local)**) with
  editable base URL + model and your own API key, plus a **Test connection** button. Every text-AI call in the app goes through `routedGenText`, which reads the live
  config per call (so switching takes effect at once, no reload) and otherwise delegates to the built-in
  plugin — including token counting (`getMetaObject`) and all non-text calls. The key lives in
  `localStorage` (`mno.aiProviderKey`, a per-provider map) on that device only and is never backed up or sent anywhere but
  your endpoint; the rest of the config (`mno.aiProvider`: selected provider plus one address/model pair per provider, plus the per-job routing toggles below) rides in Data & Backup like the other UI prefs.
  Under the provider rows, a foldable **External AI calls** box holds an **All** master switch plus one **On** / **Off** toggle per job
  (**GM**, **Skill checks**, **Trackers**, **NPC generation**, **Scene image prompt**, **Memories**, **NPC life sim**,
  **Other** — see the call table's Route column for exactly which call rides which; each label carries a
  ⓘ info-tip with its note): a job switched off runs on Perchance AI even while
  the provider above is external. The box sits above **Advanced settings** and, like it, uses the shared
  `.foldbox` style (open by default here). The toggles only show for external providers (Perchance AI needs no
  routing) and persist like every other control — picking the provider IS using it. Budgets follow the
  toggle, not the provider: a job routed back to Perchance gets Perchance-sized budgets (GM transcript
  trimming, base memory/lore caps, tight tracker output caps), while jobs left external keep the roomy ones.
  Everything from **Thinking** down lives in a foldable **Advanced settings** box (closed by default,
  the shared `.foldbox` style in `styles.css` — reuse it anywhere with
  `<details class="foldbox"><summary>Title</summary>…</details>`):
  the Thinking toggle, the OpenRouter-only thinking budget, and the same four
  **sampling sliders** on every custom provider — **Temperature**, **Top-p**, **Top-k** and
  **Repeat penalty**, each stored per provider with defaults matching that provider's own API
  settings (Ollama: 0.8 / 0.9 / 40 / 1.1; the rest: 1 / 1 / off / off, so untouched sliders
  behave exactly like before). Temperature/top-p are sent everywhere; top-k only goes to
  Ollama and OpenRouter (OpenAI/DeepSeek reject unknown fields); repeat penalty is sent as
  `repetition_penalty` (Ollama, OpenRouter) or mapped to `frequency_penalty` (OpenAI, DeepSeek);
  **Test** uses the on-screen slider values.
  A global **Custom parameters** toggle below Thinking gates all of it (off by default): when off,
  no slider value is sent and the sliders grey out; each provider then uses its own defaults.
  The Ollama note sits right under the Provider dropdown, and **Test connection** sits outside the fold,
  at the bottom of the section.
  The chat's left-rail Settings panel shows the active model up top — click it to jump straight to this section. Every control persists immediately:
  picking the provider IS using it, and every field/slider/switch saves on input — there is no Save step. Note **Test** never saves,
  so a failed test alone changes nothing about what the chat uses. The only gate is at close time: a keyless remote
  provider blocks closing Settings until a key is entered or Perchance AI is re-picked.
  On OpenRouter, model thinking/reasoning is **off by default** (billed as output tokens when on —
  re-enable with the section's checkbox). Custom-provider calls forward the call's `maxTokens`
  as `max_tokens` (calls without one stay uncapped) and are otherwise never cut
  short, except the two safety nets (90s without data, 5-minute absolute cap), which keep partial text;
  the composer's stop button aborts them the same as built-in calls.
  Every AI call and its output cap is listed below (caps are completion-token limits, read by both
  Perchance AI and every custom provider). Route is the **External AI calls** toggle that governs
  the call (`gm` = GM, `check` = Skill checks, `tracker` = Trackers, `npc` = NPC generation, `scene` = Scene image prompt,
  `memory` = Memories, `npclife` = NPC life sim, `other` = Other):

  | Call (code site) | What it does | Cap | Route |
  |---|---|---|---|
  | GM narrative reply (`rp-engine.js` `generateGmReply`) | the story turn itself | none (uncapped) | gm |
  | Death scene (`rp-engine.js` `generateDeathScene`) | the game-over narration | none (uncapped) | gm |
  | Hero trackers (`rp-engine.js` `updateTrackers`) | `[TRACKERS]` block for the latest turn | dynamic: 48 + 28 per tracker def | tracker |
  | NPC trackers (`rp-engine.js` `updateNpcTrackers`) | `[NPC TRACKERS]` block for the whole cast | dynamic: 48 + roster × (10 + 28 per def) | tracker |
  | Level-up backstop (`rp-engine.js` `enforceLevelUp`) | fixes a cap-pinned level/exp pair | no call — applied deterministically in-engine | — |
  | Skill-check referee (`rp-engine.js` `determineCheck`) | one `[CHECK]` / `[NO CHECK]` line | 120 | check |
  | World-map POIs (`map-system.js` build) | region POI table | 320 | other |
  | Single-POI line (`map-system.js` one-liner) | one `Name \| type \| icon \| description` line | 150 | other |
  | Memory roll-up (`memory-system.js`) | session digest JSON | 2200 | memory |
  | NPC life tick (`npc-life.js`) | off-screen NPC doings JSON | 900 (600 on the goal-repair retry) | npclife |
  | NPC profile (`npc-system.js`) | dossier fields for one NPC | 350 | npc |
  | Scene backdrop phrase (`npc-system.js`) | ≤12-word location phrase for portraits | 24 | npc |
  | Scene-image prompt (`scene-images.js` `genImagePrompt`) | visual prompt for 🎨 generation | 220 | scene |
  | Hero randomizer (`main.js` `randomizeBioWithAI`) | full hero JSON | 700 | other |
  | World Craft stages (`world-craft.js` `aiCraftStage`) | one world field per attempt | none (uncapped) | other |
  | World-editor helpers (`world-editor.js`) | lore split, NPC / stat / tracker gen, cover + logo prompts | 160 / 80 for the cover/logo prompts, otherwise uncapped | other |
  | Scenario-import template match (`scenario-import-panel.js`) | which rules template fits the scenario | none (uncapped) | other |
- **Data & Backup** (`backup.js`'s `backupSection()`): a page card with **three** labelled groups — **⭳
  Back up** (include-saved-copies + *Download full backup*), **⭱ Restore from a backup file** (merge /
  replace all) and **💾 Storage**, and the first two are what the section is named for; Storage is the
  one that reads rather than acts. Storage is a single group holding **one stats list** (all `.pf-stat`
  rows, filled asynchronously) and one note. The list is **two answers kept apart**: our own count first
  — adventures, world library, saved heroes, published / added worlds, then a **Total** — and then what
  the **browser** says, as ordinary rows in the same style: **Browser report** (`8.5 MB of 10.7 GB used`)
  and **Persistent storage** (`On` / `Off` / `Unknown`, with a tooltip saying what that means). The
  browser's `usage` is reported as the browser's answer and never folded into our sum, which is why the
  two numbers differ a little and why the note says so. Our readout counts an adventure as the `sessions`
  index row **plus** its `session_<id>` transcript blob — the blobs are where the megabytes are, and
  counting only the index (the original bug) reported ~45 KB for ~9 MB of adventures. Both halves format
  bytes through storage-info.js's `fmtBytes` (SI), so one group never shows one number in two unit
  systems. Two rows rather than one for the browser's answer is deliberate: a stats row is label-left /
  value-right and the 2-column layout leaves the value column ~200px, so `used (persistent: on)` on one
  row wrapped onto two lines — the label column is `white-space: nowrap`, so a too-long value wraps under
  itself instead. The note says all of this in the player's words: everything up to **Total** is the
  app's own count, the last two rows are the browser's own word, the quota is a rough ceiling rather than
  a promise, and "persistent" means the data won't be cleared automatically when the device runs low on
  space.
  **What the total leaves out** (documented in the block above the readout): `localStorage` (a few
  hundred bytes of per-device UI prefs — only `LS_KEYS` ride in the backup) and the platform's own
  service worker registration (~11 kB, serving `src/`), plus any **empty IndexedDB shells**. That last one
  is a kv-plugin property: it is a `Proxy`, so reading *any* property off it runs
  `indexedDB.open("<prop>-db-kv-plugin")`, and an IndexedDB database never disappears once created — so a
  stray read (`kv.keys`, `kv.get`, destructuring) or a folder rename leaves an empty database behind
  forever. Verified on a live page: deleting every database but `rpg` / `worlds` / `community` and
  reloading brings back exactly those three (and freed ~0.7 MB of the browser's IDB accounting, which had
  been counting the shells).
- **Admin** (`community.js`'s `adminSection()`), the only section that is *asked for* rather than shown.
  Its rail entry is **faded** (`.pf-md-faded` — full strength on hover or when selected), so the
  owner-only tool never competes with the everyday sections. Behind the admin password, it holds three
  tabs — **Overview** (the `getStats` counters: store usage, bio buckets, activity), the **moderation log**
  (the tab carries the row count) — newest first (`report_hidden`,
  `appeal_requested`, `appeal_unhidden`, the `admin_*` actions; publishing/updating/claiming are not
  logged), each row labelled in words (`MODLOG_LABELS`). Each world row has a **▸ details** toggle
  (status, live report count vs quorum, author + userId, description, tags, stats, dates, cover —
  fetched through the admin-only `getWorldAdmin`, since report counts stay out of the public
  record) and a **⋯ menu** with **open** (the world as readers see it), **inspect copy** (downloads
  the world's file and saves an editable "(inspect)" duplicate to the library — no library entry
  for the original, no download counted), and the moderation actions (**Hide** / **Unhide**,
  **Mark** / **Unmark NSFW**, **Unpublish** — only the applicable ones show once details load). Plus **⟳ Refresh** and **Sign out**. The log only lists worlds that are *already* in
  it, which is why the same three actions are also offered on Explore (§6.14). The third tab holds the
  **Delete an identity** group — an id field, **Look up** (resolves the id to its username via the
  public `getUser`) and **Delete user…** (enabled only after a successful look-up, and only while
  signed in) — which calls the owner-only `deleteUser` (§6.14).

**The Admin gate.** Every way in runs `adminEnsure()` first, which prompts for the password (`TextPopup`
password mode) and calls `rpc("authenticateAdmin", pw)`. Declining or failing leaves the panel on the
section it was showing (a toast says which — "Wrong password." or the server's throttle line), so a stray
click never parks you on an empty card. It carries a **Sign out** (`adminDispose`) and, if the connection
drops underneath it, a signed-out state with its own **Sign in** rather than a card that silently stops
working. **The session outlives the panel** — closing Settings calls only `adminSectionClosed()` (the
closed panel's repaint hook), so the owner can sign in and then go look at the world they mean to act on. It ends at **Sign out**, on a reload, or when the connection drops (`onSocketClose` clears the flag and
says so). That last one is the reason `disconnect()` refuses to release the socket while signed in: the
server's authorization lives on the connection, so holding it open *is* keeping the session.

**The log is owner-only.** There is no 📜 Log button in Explore's header and no public `cc-panel`; the
server refuses `getModLog` to a connection that hasn't authenticated, exactly as `moderate` does. Both
halves matter: a button alone would leave the log readable with one console line, since the RPC is a
public surface like every other. So the log lives in Admin, next to the only actions that change it.

**Why the blocklists live in Settings.** They are not catalog filters. A tag you *require* is a question
about the shared catalog; a tag you *block* is a standing decision about what you never want to see —
device-local, applied on every page — so a `Clear all` in a catalog panel resetting it would be wrong.
Hence Explore keeps the Tags section (its badge counts those alone) and the reader lists live with the
rest of the device-local settings; the hint reads *"what you'd rather not see in Explore"* because the
lists do nothing outside the catalog.

**One creator-code path:** exactly one reveal and one "paste a creator code" restore, in Identity as
**Switch identity**, living in one function (`promptRestoreCreatorCode`) with one wording and one
confirmation. The backup card says its own import restores everything (the identity included, since the
file carries the code) and points at that row when you have no file. **Restore** means two different
things, so the wording distinguishes them: the backup group is **⭱ Restore from a backup file** (imports a
file), the Identity row is **Switch identity** (pastes a creator code). The relation is easy to get
backwards: the backup file **contains** the creator code (see `WARNING_HTML` and `applyBackup`), so
importing it — merge or replace — signs you in as well as moving your data; the creator code is the
**minimal subset** of it, for when you only need to be you (or have no file). Copy claiming the two are
complementary-and-separate is wrong. **Admin** is not one of those three jobs: it is a tool for the
catalog's owner, and it sits here because the password that opens it is a device-local secret like the
rest of the panel.

**Layout: a master/detail, not a stack of cards** (`styles.css`). A stack of cards read badly on desktop
(two short cards over one tall, wide one), so `.pf-md` is the arrangement: `.pf-md-nav` is a **rail of the
section names** and `.pf-md-panel` holds the selected section's card, one at a time. Clicking a rail
button *moves* that section's element into the panel (`replaceChildren`) — a section is a finished element
with its listeners already bound, so switching rebuilds nothing and the sections are built once per *open*
(torn down with the popup). Consequences worth keeping: the Data & Backup card can't loom over the two
short ones, and the panel is as tall as **one** section rather than the sum of three. The popup
(`.settings-pop`) is `width: min(920px, 94vw)`, `height: min(88vh, 840px)` (a **fixed** height, not a
`max-height`: switching sections must never resize the panel — short sections leave empty space and tall
ones scroll `.set-body`), a flex column so the head
stays put, with `.set-body` its **only scroller** (`overscroll-behavior: contain`, so its end doesn't hand
off to the page behind); a section switch resets that scroll to the top.

Two responsive decisions, both deliberate: **≥760px** the rail sits beside the panel and is
`position: sticky`, its width `clamp(140px, 17vw, 184px)` so the panel never gets *narrower* crossing the
breakpoint; **<760px** the same master/detail becomes the **one-pane drill-down the world editor's split
uses** (§6.9): the rail is a full-width vertical list of sections, tapping one opens its card, and a
compact `‹ Back` pill (`.pf-md-back` — the world editor's own control, a sibling of the panel so
`replaceChildren` can never eat it) returns to the list. Everything hangs off one `pf-md-drill` class on `.pf-md`: the panel opens a section with it
set (`showSection()`, after any section gate has passed — a declined Admin password therefore leaves the
list on screen), Back clears it, and `listScroll` remembers the body's offset so the list comes back
where it was. The panel is raised **on the list** unless a section was actually asked for:
`applySelect(id, drill)` only drills when the open request named one, so the home nav's plain
`openSettingsPanel()` shows the list while the identity chip (and Admin) open their card. Only one pane is on screen, so nothing needs its own scroller — `.set-body` stays the only
one. The class is **inert above the breakpoint** (the drill rules live in a `max-width: 759.98px` block),
so resizing across the breakpoint can never leave a pane hidden. Inside the card `@media (max-width: 559px)` puts each label on its own line above its
value (that block must stay *after* the 720px `flex-basis` rule it overrides). Card classes: `.pf-sec`
(card), `.pf-kv` (labelled row `.pf-k`/`.pf-v`), `.pf-sub` (a backup group), `.pf-chip` (muted author),
`.pf-stat` (a readout line — the Storage group's rows are all these; a row's optional third element
becomes its `title`).

### 6.17 Displayed text (the shared renderer)

Every place the app shows authored or generated prose — the transcript, a world's description on its
card and in its details panel (your own world or one from the community), the changelog — renders it
through **one** module, [`rich-text.js`](scripts/rich-text.js), so the same source text always looks the
same (`main.js`'s `renderText` is just the transcript's local name for it):

- `inlineMd(s)` — inline marks only: `` `code` ``, `**bold**`, `*italic*`.
- `richText(s)` — `inlineMd` plus the transcript's two extras: `"quoted speech"` is wrapped in the
  brighter `.q` tone, and newlines become `<br>` (a description separates its paragraphs with a blank
  line, which plain HTML would collapse into the previous sentence).
- **Escaping first is the security boundary.** Both escape the input *before* any marker becomes a tag,
  so a community world's description can never inject markup. `code` spans are lifted out and restored
  last, so a literal `*` inside `` `a*b*c` `` is code rather than a marker.
- Italic renders as `<i class="em">`, and `.em` is `font-style: italic; opacity: .8` — faded *relative
  to the line it sits in*, so an aside reads quieter in bright narration and in muted panel copy alike.
- Card previews (`.ld-wdesc` / `.ex-desc`) take `inlineMd` (marks, no forced breaks — they're
  line-clamped); panel descriptions (`.wd-desc`) take `richText`, exactly as the transcript does.

### 6.18 Announcements banners (dev-editable notice bars)

One file — [`announcements.md`](announcements.md) — controls notice bars on the **Worlds**,
**Adventures** and **Explore** pages, rendered directly below the page header (never inside it: on
phones the header bar sticks, and the accent wash is positioned off the header). The module is
[`scripts/announcements.js`](scripts/announcements.js), hooked into `setHomePage` in `main.js`
(fire-and-forget, so the md fetch never delays the page mount).

- The file holds one or more notices. A `[pages: ...]` line starts a new notice for those pages:
  `[pages: all]` (every page), `[pages: worlds]` (Worlds only), `[pages: adventures, explore]`
  (those two). Text before the first directive shows on ALL pages, so a plain one-notice file works.
- Notices render with the shared marks (`**bold**`, `*italic*`, `` `code` ``), external
  `[label](https://…)` links (http/https only, opened in a new tab), and internal action links —
  `[label](settings/identity|content|interface|imagegen|aimodel|backup|admin)` opens that Settings
  section, `[label](worlds|adventures|explore)` switches home page (pushes history, like the nav),
  `[label](changelog)` opens the release notes. Actions render as buttons wired to a handler main.js
  registers (announcements.js can't import main.js back). Everything is escaped first, so
  the file can never inject markup. A directive naming no valid page, or a link naming no known
  target, is skipped (console warning).
- **Retiring a notice:** delete its text (and its `[pages: ...]` line, if it has one). Empty /
  comments-only / missing file = no banner on any page.
- **✕ is per-notice and lasts a day:** it hides only its own notice, persisted per notice
  in machine-local localStorage (`mno.announce.dismissed`, keyed by a hash of the notice's
  pages + text) for 24 hours, so the notice stays hidden across reloads. Edited text hashes
  to a new id and shows again. Notices disappear for good only when the file is cleared (above).

## 7. Key invariants & gotchas

- **No popup hands the screen over through undimmed air.** A panel that launches the next screen — the
  world detail popup's **▶ Play / ✦ New adventure** — stays up until that screen actually exists:
  `mountWorldSessions` doesn't close it itself, it hands its `beforeStart` down as `beginNewAdventure`'s
  `opts.beforeOpen` (or as the argument to a community `startNew`), so the popup comes down in the *same
  task* that builds the character wizard. **▶ Continue** needs no hook at all: *both* detail panels — the
  Worlds popup (`openWorldPanel`) and Explore's (`openWorldDetail`) — watch the landing's `hidden` and take
  themselves down on the frame `enterSession` swaps it for the chat. (`openWorldDetail` was missing that
  watcher, which let its panel sit on top of the chat after a Continue.)
  Closing at the click instead leaves a gap with no overlay in it, which the browser paints — invisible for a
  bundled world (already in memory, so a microtask) and a **visible dim → bright → dim flash** for a world
  read out of kv (a real task). Anything new that opens a panel and then a screen follows the same rule.
- **Engine evaluation order:** the perchance engine renders the whole template (every square block / pjs
  expression) FIRST, then runs index.html's `<script>` tags in order. Don't rely on top-to-bottom
  interleaving between square blocks and scripts.
- **Everything derives from messages.** Trackers (`afterTrackers`), NPC trackers (`afterNpcTrackers`),
  death/game-over, and map hero position are derived from the message list, so edits/re-rolls/deletes
  revert automatically. Memory is the one thing that needs an explicit `rewindFromTurn`.
- **NPC tracker values are message-anchored, never a mutable "current value".** The snapshot is
  **sparse** (only the characters that turn reported) and the live value is folded per character by
  walking back to the newest snapshot containing that name. Anything that stores a value in place
  (a hand-edit) must write onto a *message* snapshot or the entry seed, or it will drift
  from what delete/re-roll/version-navigation does. Harnessed in this order:
  `fold → write` and never `write → fold`.
- **`turn` ≠ `messageCount`.** Memory cadence and "N turns ago" labels use `turn`; `messageCount` is
  append-only for ordering.
- **Static-first context.** `buildContext` orders static → volatile for prefix caching. Keep it that way.
- **World content vs engine code.** Change the game via the world JSON (tone via `narrativeVibe`, lore via
  `lorebook`, premise via `scenario`, opening via `start`). Never edit `narrator-prompt.md` to change
  content; it's engine config.
- **Content work never touches scripts.** The only content-facing file is the world JSON (edited in the
  world editor). Stats/trackers/lorebook/cast all live there.
- **The AI never writes stats.** Player-owned stats change only by spending level-up points; AI-tracked
  values live in `[TRACKERS]`.
- **Combat is fully narrative** — no engine roll (keyword matching was unreliable).
- **Knowledge gating.** A memory/AI fact with a named owner reaches the GM only when a holder is in the
  scene (a hero+NPC shared memory needs one of its non-hero holders — the hero alone is not enough);
  secrets never leak in cast profiles or hooks. `ownerUpdates` is exact-match only for the same reason.
- **Craft-only guarantees.** `coerceWorldFile` forces the core trackers (`level`/`exp`/`location`) into the
  right shape only for AI-crafted worlds — a user is free to delete them from their own world.
- **Re-roll/delete vs. roll-up race is intentionally unguarded.** Operating assumption: the player
  doesn't re-roll/delete far-back messages. `rewindFromTurn` covers recent edits/rerolls.
- **No browser dialogs.** Use the themed `TextPopup`/`ConfirmPopup`, never `prompt()`/`confirm()`/`alert()`.
- **The catalog index stores `slot+1`, and a "hit" is a KEY match — never a value match.** In the
  server script an index cell is `0` (empty), a `slot+1` value (≥ 1), or `IDX_TOMB` (`0xffff`).
  Reading a probe chain by testing the raw cell value (e.g. `if (cell === 1)`) silently finds only
  slot 0 and hides every other entry — exactly the bug that made user/record lookups fail. Always
  walk the chain comparing the *record's* key via the injected `keyOf(slot)` (§6.14).
- **A created user object must carry `userId` before it is indexed**, or `USER_BY_ID` can never
  resolve that user (the second half of the same bug). Renaming tombstones the old name cell.
- **Route every catalog write through `rpcClaiming`.** A bare `rpc("updateWorld"/…)` dead-ends with
  `username_required` whenever the catalog has no claim for this identity, and `updateWorld` on a
  stale link record answers `not_found` — `publishFlow` must fall back to a fresh publish.
- **A link record only counts as "ours" when `link.worldId` starts with our current `userId + "-"`.**
  Restoring a creator code replaces the identity, so pre-existing links can carry a foreign worldId;
  such a record can neither be updated nor re-published under that id (the server keys worldIds by
  userId, and rejects a mismatched prefix with `bad_world_id`). `publishFlow` computes `ours`/`active`
  and mints a fresh worldId instead of reusing a foreign one, then `setLink` self-heals the record.
- **The catalog's store layout is versioned.** `LAYOUT_VERSION` is stamped in the state header and
  every record lives at fixed offsets inside its slot (`writeRecord`/`readRecord`; the layout is
  documented in the codec comment). Anything that moves an offset invalidates every stored record, so
  bump `LAYOUT_VERSION` when it does. There is deliberately **no migration path**: a store written by a
  different layout is reinitialized at boot with a loud console error rather than throwing (which would
  quarantine the whole community server). So a layout change that reaches a store already holding real
  published worlds must ship a migration (re-read each record at the old offsets, rewrite it at the new)
  — bumping `LAYOUT_VERSION` alone reinitializes the store and would silently wipe every published world.
- **In the editor the catalog server's state is an ephemeral emulator** that resets on every preview
  reload. "I published a world and it's gone" after a reload is expected there, not a bug — only a
  **saved** generator has a durable server.
- **The in-flight stream bubble survives re-renders.** `render()` rebuilds the transcript with
  `innerHTML = ""`, which wipes the live reply bubble (it isn't part of `state`). `makeStreamBubble`
  registers itself in the module-level `activeStreamBubble`, and `render()` re-appends it at the tail
  if it got detached — otherwise a background re-render (an async NPC profile/portrait finishing, a
  map build) mid-turn would make the reply look stalled: action bubble shown, but no typing dots or
  check pip until the next stream chunk.
- **Stop ≠ roll-back.** The stop button (§6.13) keeps the partial reply and only *skips* the turn's
  remaining AI calls — nothing is removed and no error is raised (the promise resolves). A stop
  before the first chunk leaves a turn with just the player's action and no GM text.
- **The tab icon comes from `$meta icon`.** It points at the uploaded build of `src/images/icon-512.png` (512×512, `logo.svg` cropped to its wing bounds on a dark radial with a slight glow). To change it, rebuild the PNG, re-upload it, and update the `$meta icon` URL in `main.pjs`.
- **Editor/tooling gotcha** — see the note at the top of this file.

---

## 8. Tech notes & history

**Constraints**
- **Single-player only:** there is no multiplayer or co-op — one player and their GM.
- The `ai-text-plugin` caps output at ~1024 tokens and ignores a `maxTokens` option; only the memory
  roll-up sets `maxTokens: 2200` for rewind re-bakes. Any long job (the Craft-world builder, the
  lorebook splitter) is therefore staged into multiple calls (§4, §6.9).

**History:** the initial release shipped the foundation (chat loop, editing, memory, characters,
save/backup, NPCs and polish); added since are the world system + editor, player-owned stats & skill
checks, tracked-state formulas, map/POIs + travel, death & game over, scene images, and the landing
gallery. Dated release notes live in [`CHANGELOG.md`](CHANGELOG.md).

**Implemented:** the community layer (Explore / world publishing / added-world library + forks) and
full backup & restore — see §6.14 / §6.15 — and the **home shell** (§6.10).

---

## 9. Changelog convention

[`src/CHANGELOG.md`](CHANGELOG.md) is the **single source of truth for release notes**, is loaded at
runtime by the landing page's changelog-icon popup, and is public.

**Add one entry per user-visible change, on the day it lands.** A development change nobody can see —
a refactor, a style pass, an experiment reversed the same day — is not a release note and earns no entry.

**Format** — markdown, a level-2 date heading per day (newest day first), each followed by concise
`- ` bullet entries. Every date heading ends with `UTC` (space-separated):

```md
## 2026-09-15 UTC
- Chat: Stop button (stop AI generation)
- Fixed: Generic NPCs are silently stored in the save game, causing bloat
```

**Writing convention:**

1. **Get the current date in UTC.** Do not guess from memory. Either read the workspace env's
   "Today's date", or compute it directly — `execute_js`: `return new Date().toISOString().slice(0,10)`
   (or `page_eval` the same). Only if those are unavailable, fetch a UTC time source such as
   `https://worldtimeapi.org/api/timezone/Etc/UTC` (the `utc_datetime` field). Group entries under the
   `## YYYY-MM-DD UTC` heading for that UTC date (always write the literal `UTC` suffix).
2. **Insert at the top of the day's group.** If a heading for today's UTC date already exists, add the
   new bullet as the **first** `- ` line under it (so within a day, newest entry first). Otherwise
   insert a fresh `## YYYY-MM-DD UTC` heading **above** the newest existing heading (keep the whole file
   newest-day-first — never append at the bottom).
3. **One entry = one user-visible change**, written concisely in the existing style:
   `Area: what changed` (e.g. `Memory: Tiered memory recall`), and prefix bug fixes with
   `Fixed: …`. Keep it tight; no multi-sentence paragraphs. An entry may span lines —
   extra lines under a `- ` bullet join that same entry (each renders as a new line),
   so wrap long entries or add sub-lines freely, indented or not.
4. **Bullets only.** Don't restructure or reformat existing entries; only add/refresh today's group.
   Plain markdown — `` `code` `` spans are fine (the popup renders them); avoid tables/images.
5. **NEVER write `src` or filenames in a changelog entry.** Entries are player-facing release notes:
   describe the *user-visible* change, never implementation details, file paths, or source files
   (no `src/…`, no `main.js`, no `CHANGELOG.md`, etc.). ❌ `Landing: icon renders src/CHANGELOG.md`
   → ✅ `Landing: changelog icon opens the release-notes popup`.
6. **Write what a player can do, not how it was built.** No file names, functions, or internals
   (see rule 5), and no development churn — a change nobody can observe, or one reverted before it ever
   reached players, earns no entry and must not be added retroactively.

The popup parser (`parseChangelog` in `src/scripts/main.js`) is intentionally minimal: it reads
`## ` headings as dates and `- `/`* ` lines as entries; any other non-empty line under a bullet
is a continuation of that entry (joined with a newline; blank lines and `#` lines ignored).
`changelogHtml` renders each entry with the shared displayed-text renderer (`inlineMd`,
[`rich-text.js`](scripts/rich-text.js) — see §6.17): escaped first, then `code`,
**bold** and *italic* (`_underscore_` italics are **not** a marker — an underscore inside a word or a
name is left alone), each line rendered on its own (continuation lines as spaced `.cl-sub`
blocks). Bullets render with a ✦ marker
(`.cl-list li::before` in `styles.css`).
