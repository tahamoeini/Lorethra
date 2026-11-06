// NPC system: catalogues the NPCs the hero meets. Only NPCs the GM explicitly flags with a
// [[NPC: Name]] tag get a full generated profile + portrait; background speakers (guards,
// shopkeepers, crowd) stay as lightweight registry entries. Profiles feed back into the GM
// context so the AI behaves/speaks consistently. Entries are never auto-removed — the player
// manages the catalogue by hand (Remove button); pinning only sorts an entry to the top of
// the UI list. A lightweight NPC can still be profiled on demand (the player clicks them in chat,
// pins them, or hand-adds them).

import { loreForTurn, nameHit, resolveNpcName } from "./lorebook.js";
import { NPC_NOTE_CAP } from "./rp-engine.js";
import { subUser, heroNameOf } from "./text-utils.js";
import { initialNpcTrackers, purgeNpcTrackerHistory } from "./trackers.js";
import { generatedAvatarToWebp, genImageSafe, withTimeout, SCENE_BG_TIMEOUT_MS } from "./image-utils.js";
import { imageGuidance } from "./image-gen-prefs.js";

const DETAIL_FIELDS = ["age", "gender", "race", "appearance", "job", "persona", "extra", "secrets"];
const IMPORTANT = new Set(["high", "medium"]);
const LEGACY_PERSONA = ["personality", "mannerisms"];

const isPortrait = (p) => /^(data:|https?:|blob:)/.test(p || "");

// Player-set link overrides (the 🔗 menu in chat), stored at `state.npcLinkRules` keyed by the
// lowercased display spelling: `{ [displayLower]: { mode: "unlink" } | { mode: "link", target } }`.
// "unlink" means this spelling is someone else — never fuzzy-match it (exact only). "link" pins it
// to a specific roster entry. Absent = automatic (the resolver decides). Read here so the roster
// pass and the chat lookups can never disagree; written only from main.js's link menu.
export function npcLinkRuleFor(state, display) {
  const rules = state && state.npcLinkRules;
  if (!rules || typeof rules !== "object") return null;
  const r = rules[String(display || "").trim().toLowerCase()];
  if (!r || typeof r !== "object") return null;
  if (r.mode === "unlink") return r;
  if (r.mode === "link" && typeof r.target === "string" && r.target) return r;
  return null;
}

const FALLBACK_BGS = ["moody candlelit chamber", "interior", "city", "village", "smoke and embers", "solid color", "cloud", "trees"];
const fallbackBg = () => FALLBACK_BGS[Math.floor(Math.random() * FALLBACK_BGS.length)];

// Migrate a details object in place: merge the legacy `personality` + `mannerisms` keys into the
// unified `persona` field (older saves / exports predate the merge). No-op when already migrated.
export function mergePersona(details) {
  if (!details || typeof details !== "object") return details;
  if (String(details.persona || "").trim()) {
    for (const k of LEGACY_PERSONA) delete details[k];
    return details;
  }
  const bits = LEGACY_PERSONA.map((k) => String(details[k] || "").trim()).filter(Boolean);
  if (bits.length) {
    details.persona = bits.join(". ");
    for (const k of LEGACY_PERSONA) delete details[k];
  }
  return details;
}

export class NpcSystem {
  constructor(genText, genImage, ctx = {}) {
    this.genText = genText;
    this.genImage = genImage;
    // The world lorebook entries (preferred) or a pre-rendered lore text (legacy callers).
    this.loreEntries = Array.isArray(ctx.loreEntries) ? ctx.loreEntries : null;
    this.loreText = ctx.loreText || "";
    this.scenarioText = ctx.scenarioText || "";
    this.startText = ctx.startText || "";
    this.styleTags = ctx.styleTags || "";
    this.negativeTags = ctx.negativeTags || "";
    this.busy = new Set(); // names currently being built (profile/portrait)
    this.cast = [];        // the world's standing cast (canon NPCs defined in the world file)
    this.castByName = new Map();
    this.npcTrackerDefs = ctx.npcTrackerDefs || []; // the world's per-NPC tracker defs (may be empty)
    this._setCast(ctx.worldNpcs);
  }

  // The lore the profile generator sees: always-on entries plus the BM25 top-N keyword entries for
  // the NPC's own story excerpt (their name/description always counts as context).
  loreForProfile(storyText, npcName, npcDesc = "") {
    if (this.loreEntries) {
      return loreForTurn(this.loreEntries, { chatText: storyText, actionText: [npcName, npcDesc].filter(Boolean).join(" "), location: "" });
    }
    return (this.loreText || "").trim();
  }

  _setCast(list) {
    this.cast = [];
    for (const n of list || []) {
      if (!n || !String(n.name || "").trim()) continue;
      const details = {};
      for (const k of DETAIL_FIELDS) {
        const v = n[k];
        if (v !== undefined && v !== null && String(v).trim()) details[k] = String(v).trim();
      }
      this.cast.push({
        name: String(n.name).trim(), details, avatar: n.avatar ? String(n.avatar).trim() : "",
        trackers: n.trackers && typeof n.trackers === "object" ? { ...n.trackers } : null
      });
    }
    this.castByName = new Map(this.cast.map((n) => [n.name.toLowerCase(), n]));
  }

  // The world-cast NPC matching `name` (case-insensitive), or null if it isn't one.
  castMatch(name) {
    return this.castByName.get(String(name || "").trim().toLowerCase()) || null;
  }

  // The world-cast NPC matching `name`, tolerating a GM variant (a dropped title/surname or a
  // small misspelling — the same partial-name rule the memory owner-gate uses). Exact first,
  // then the unique-subset resolver; ambiguous across the cast (two members sharing the tag's
  // tokens) returns null rather than guessing. See lorebook.js's `resolveNpcName`.
  castResolve(name) {
    const t = String(name || "").trim();
    if (!t) return null;
    const direct = this.castByName.get(t.toLowerCase());
    if (direct) return direct;
    const hit = resolveNpcName(t, this.cast.map((n) => n.name));
    return hit ? (this.castByName.get(hit.toLowerCase()) || null) : null;
  }

  // The session roster (`state.npcs`) entry matching a GM-written speaker/tag spelling, or null.
  // Exact key first, then lowercase-exact, then the unique-subset resolver — so `[Camilla]`
  // lands on the `Mistress Camilla DeLuna` profile instead of forking a second entry, while a
  // spelling shared by two catalogued characters stays ambiguous (null) and forks as before.
  resolveEntry(name, state) {
    const npcs = (state && state.npcs) || {};
    const t = String(name || "").trim();
    if (!t || !Object.keys(npcs).length) return null;
    if (npcs[t]) return npcs[t];
    const lt = t.toLowerCase();
    for (const k of Object.keys(npcs)) {
      if (k.toLowerCase() === lt) return npcs[k];
    }
    const hit = resolveNpcName(t, Object.keys(npcs));
    return hit ? npcs[hit] : null;
  }

  // A world-cast NPC's canonical fields are authored in the world file and may use the `{{user}}`
  // shorthand. Resolve it as the values are copied into the session entry — they are shown in the
  // NPC panel and fed back to the GM, so the raw token must never survive the copy.
  _castFields(cast, state) {
    const hero = heroNameOf(state);
    const out = {};
    for (const [k, v] of Object.entries((cast && cast.details) || {})) out[k] = subUser(v, hero);
    return out;
  }

  emptyDetails() {
    return { age: "", gender: "", race: "", appearance: "", job: "", persona: "", extra: "", secrets: "" };
  }

  hasDetails(entry) {
    return !!(entry.details && DETAIL_FIELDS.some((k) => entry.details[k]));
  }

  // Whether this NPC qualifies for a full profile: marked important by the AI, pinned, or a
  // legacy entry that already has details.
  isImportant(entry) {
    return IMPORTANT.has(entry.importance) || !!entry.pinned || this.hasDetails(entry);
  }

  // Seed the world-cast `{{user}}`-resolved fields + this character's starting tracked values.
  // number/`=`-formula starts come from the defs; a world NPC entry's `trackers` map overrides them.
  _seedTrackers(cast, state) {
    const stats = (state && state.character && state.character.stats) || {};
    return initialNpcTrackers(this.npcTrackerDefs, stats, cast ? cast.trackers : null);
  }

  // The GM's own 1–3 sentence description of a character it flagged with `[[NPC: Name | …]]`.
  // parseGmOutput collects those as `messages.npcNotes`, keyed by the exact tag spelling. The
  // excerpt becomes the newcomer's `description` — the FIRST APPEARANCE line that the profile
  // writer, the portrait's look, and the dossier fallback all read — so a character the GM invented
  // gets a profile matching what the GM had in mind, instead of being invented from the bare name
  // (a promoted newcomer has no dialogue of their own and no dossier, which left the profile call
  // almost nothing to go on). World-cast members never need it — their profile is canon — so the
  // only caller is the non-cast promote path.
  _noteFor(messages, name) {
    const notes = messages && messages.npcNotes;
    if (!notes) return "";
    return String(notes[String(name || "").trim()] || "").trim().slice(0, NPC_NOTE_CAP);
  }

  _newEntry(name, cast, description, turn, state) {
    // A name with tracker history but no entry means the character was deleted and is being
    // met again — drop the old snapshots so their ancient values can't resurface through the
    // fold (see README §6.3.1).
    if (state) purgeNpcTrackerHistory(state, name);
    return {
      name,
      portrait: cast ? (cast.avatar || "src/images/portrait-placeholder.webp") : "src/images/portrait-placeholder.webp",
      description: description || "",
      details: cast ? this._castFields(cast, state) : null,
      trackers: this._seedTrackers(cast, state),
      importance: cast ? "high" : null,
      appearanceCount: 1,
      firstSeenTurn: turn,
      lastSeenTurn: turn,
      // True once the character has at least one visible dialogue/thought line. Distinguishes
      // "had dialogue but now edited/deleted/rerolled away" (demote to -1, not present) from
      // "never spoke" (promote-only / hand-added — preserve creation recency). Set on every
      // visible tally; backfilled from archives on first rebuild for older saves.
      everSpoke: false,
      pinned: false,
      cast: !!cast
    };
  }

  // Register NPCs from `messages`. Refreshes `lastSeenTurn` on entries the roster already holds, and
  // creates an entry ONLY for world-cast members (seeded from the world's canonical profile) — see
  // the [[NPC: Name]] tag loop below for the other automatic route. A full profile + portrait is
  // built ONLY for NPCs the GM explicitly flagged, for world-cast NPCs, and for entries a user
  // already made important (pinned / hand-added / previously profiled). Inner thoughts and repeated
  // appearances are storytelling, not importance signals. Returns the names of NEW NPCs.
  //
  // Display vs linkage: `m.name` is ALWAYS the GM's own spelling and is never rewritten — the
  // transcript shows exactly what the GM wrote ("Garreth" stays "Garreth"). When that spelling
  // resolves to a catalogued character, the message carries `m.npcKey` with the canonical roster
  // key ("Captain Garreth") instead: avatars, profile popups, appearance counts and portrait /
  // profile builds all follow `npcKey`, while the bubble keeps its original label. A descriptor
  // that resolves to nothing ("Maya's friend" for a roster holding "Maya") keeps no key at all —
  // it is a different person, not a variant, so it neither renames nor links.
  // A line the player unlinked (`m.npcUnlinked`, or an "unlink" rule for its spelling) stays
  // exactly as written with no key and no roster side-effects, even if it would otherwise resolve.
  // A "link" rule pins the spelling to one roster entry instead of whatever the resolver says.
  //
  // `opts.createOnly` is the early pass (see registerNew): create the entries this reply introduces
  // and touch nothing else — no builds, no refreshes of existing entries — so the normal pass after
  // the turn can do all of that exactly once.
  update(messages, state, onDone, opts = {}) {
    const createOnly = !!opts.createOnly;
    const fresh = [];
    const turn = state.turn || 0;
    for (const m of messages || []) {
      if (!m.name || (m.role !== "npc" && m.role !== "thought")) continue;
      const display = String(m.name || "").trim();
      if (!display) continue;
      // One-off unlink from the 🔗 menu: this bubble is someone else, full stop.
      if (m.npcUnlinked) { delete m.npcKey; continue; }
      const rule = npcLinkRuleFor(state, display);
      if (rule && rule.mode === "unlink") {
        // Exact-only: the spelling may still BE a roster entry (or the world cast), but it is
        // never a variant of one. Anything else is scenery — no entry, no key, no counts.
        let exact = state.npcs[display] || null;
        if (!exact) {
          const lt = display.toLowerCase();
          for (const k of Object.keys(state.npcs || {})) {
            if (k.toLowerCase() === lt) { exact = state.npcs[k]; break; }
          }
        }
        if (exact) {
          delete m.npcKey;
          if (!createOnly) {
            exact.lastSeenTurn = turn;
            exact.appearanceCount = (exact.appearanceCount || 0) + 1;
            exact.everSpoke = true;
          }
          continue;
        }
        const castOnly = this.castMatch(display);
        if (!castOnly) continue;
        delete m.npcKey;
        const entry = this._newEntry(castOnly.name, castOnly, (m.text || "").slice(0, 160), turn, state);
        entry.everSpoke = true;
        state.npcs[castOnly.name] = entry;
        fresh.push(castOnly.name);
        if (!createOnly) this._ensureBuild(entry, state, onDone);
        continue;
      }
      if (rule && rule.mode === "link" && state.npcs[rule.target]) {
        const pinned = state.npcs[rule.target];
        if (pinned.name && pinned.name !== display) m.npcKey = pinned.name;
        else delete m.npcKey;
        if (!createOnly) {
          pinned.lastSeenTurn = turn;
          pinned.appearanceCount = (pinned.appearanceCount || 0) + 1;
          pinned.everSpoke = true;
          if (this.isImportant(pinned) && (!this.hasDetails(pinned) || !isPortrait(pinned.portrait)) && !this.busy.has(pinned.name)) {
            this._ensureBuild(pinned, state, onDone);
          }
        }
        continue;
      }
      // Canonical linkage for this line: exact roster key first (case-insensitive), then the
      // unique-subset resolver ([Camilla] → Mistress Camilla DeLuna). Ambiguous spellings resolve
      // to nothing and fall through as before — they stay unlinked, never guessed.
      let canon = state.npcs[display] || null;
      if (!canon) {
        const lt = display.toLowerCase();
        for (const k of Object.keys(state.npcs || {})) {
          if (k.toLowerCase() === lt) { canon = state.npcs[k]; break; }
        }
      }
      if (!canon) {
        const seen = this.resolveEntry(display, state);
        if (seen) canon = seen;
        else {
          const castKnown = this.castResolve(display);
          if (castKnown && state.npcs[castKnown.name]) canon = state.npcs[castKnown.name];
        }
      }
      if (canon) {
        // Link, don't rename: the bubble keeps the GM's spelling, the roster entry gets the
        // appearance. Legacy exact lines carry no key (name already is the key).
        if (canon.name && canon.name !== display) m.npcKey = canon.name;
        else delete m.npcKey;
        if (!createOnly) {
          canon.lastSeenTurn = turn;
          canon.appearanceCount = (canon.appearanceCount || 0) + 1;
          canon.everSpoke = true;
          if (this.isImportant(canon) && (!this.hasDetails(canon) || !isPortrait(canon.portrait)) && !this.busy.has(canon.name)) {
            this._ensureBuild(canon, state, onDone);
          }
        }
        continue;
      }
      {
        // A generic speaker — a guard, a schoolgirl, an innkeeper — is scenery, and gets no roster
        // entry at all. Nothing would read such a stub: the GM context (NPC PROFILES / inPlayNpcs), the NPC panel (isImportant), scene casting and the memory owner-gate
        // all require `details`, so an entry storing just a scrap of the character's first line
        // would sit in the save file forever as dead weight. Promoting one is a click away in the
        // chat (openNpcFromChat), and the GM's [[NPC: Name]] tag below is the automatic route.
        const cast = this.castMatch(display) || this.castResolve(display);
        if (!cast) continue;
        // World-cast NPC? Seed the session entry from the world's canonical profile instead of
        // generating one from scratch. The entry only appears here — once the hero has actually
        // met them in the story.
        const name = cast.name;
        // The entry is canonical; the line keeps its variant spelling and links to it.
        if (name !== display) m.npcKey = name;
        else delete m.npcKey;
        const entry = this._newEntry(name, cast, (m.text || "").slice(0, 160), turn, state);
        entry.everSpoke = true;
        state.npcs[name] = entry;
        fresh.push(name);
        if (!createOnly) this._ensureBuild(entry, state, onDone);
      }
    }
    // GM-flagged NPCs ([[NPC: Name]]) — the sole automatic path to a profile. A tag for a name
    // that never spoke is still honoured (the GM judged them important); it creates a bare entry.
    for (const raw of (messages && messages.npcPromotes) || []) {
      const rawName = String(raw || "").trim();
      if (!rawName) continue;
      // World-cast NPC? Seed the entry from the world's canonical profile (and adopt its canonical
      // name) instead of generating one — same as the dialogue loop above. A cast member the GM
      // flags before they speak must not get an invented profile. A non-cast tag that is a variant
      // spelling of a catalogued NPC resolves to that entry instead of forking a second one;
      // ambiguous variants (shared by two entries) fall through and fork as before.
      const cast = this.castMatch(rawName) || this.castResolve(rawName);
      const seen = cast ? null : this.resolveEntry(rawName, state);
      const name = cast ? cast.name : (seen ? (seen.name || rawName) : rawName);
      const key = name.toLowerCase();
      let entry = Object.values(state.npcs).find((e) => String(e.name || "").trim().toLowerCase() === key);
      if (!entry) {
        // The GM's own excerpt (if it wrote one) becomes the newcomer's description, so the profile
        // it will generate matches what the GM had in mind rather than being invented from the name.
        // Cast members keep the canonical (empty) description — their profile comes from the world.
        entry = this._newEntry(name, cast, cast ? "" : this._noteFor(messages, rawName), turn, state);
        if (!cast) entry.importance = "medium";
        state.npcs[name] = entry;
        fresh.push(name);
      } else if (!createOnly && !IMPORTANT.has(entry.importance)) {
        entry.importance = cast ? "high" : "medium";
      }
      if (!createOnly && (!this.hasDetails(entry) || !isPortrait(entry.portrait)) && !this.busy.has(entry.name)) {
        this._ensureBuild(entry, state, onDone);
      }
    }
    return fresh;
  }

  // The early half of `update`, run BEFORE the NPC tracker call so that the characters this reply
  // introduces can have their tracked values filled in on their introduction turn instead of the
  // next one (see README §6.3.1). Creates the entries only — no profile/portrait build,
  // no notification, no refreshing of entries that already exist (the normal pass after the turn
  // does all of that exactly once) — and returns the names it created. Created entries carry the
  // correct seed already (`_newEntry`), which is what the tracker call folds their values from.
  registerNew(messages, state) {
    return this.update(messages, state, null, { createOnly: true });
  }

  // Create entries for [[NPC: Name]] tags carried by an edited turn's fresh parse (saveGmFull
  // discards the parse's promotes when it splices, so the caller passes them explicitly).
  // `turn` is the edited turn's anchored ordinal (NOT state.turn — editing an old turn must not
  // stamp newcomers with the latest turn). Mirrors update()'s promote loop exactly (cast seed,
  // variant resolution, excerpt for newcomers, importance, builds). Returns created names.
  // Dialogue tallies are left to rebuildSightings (called right after) — this handles only tags.
  registerPromoteTags(promotes, notes, state, turn, onDone) {
    const fresh = [];
    for (const raw of promotes || []) {
      const rawName = String(raw || "").trim();
      if (!rawName) continue;
      const cast = this.castMatch(rawName) || this.castResolve(rawName);
      const seen = cast ? null : this.resolveEntry(rawName, state);
      const name = cast ? cast.name : (seen ? (seen.name || rawName) : rawName);
      const key = name.toLowerCase();
      let entry = Object.values(state.npcs).find((e) => String(e.name || "").trim().toLowerCase() === key);
      if (!entry) {
        const note = notes ? String(notes[String(rawName || "").trim()] || "").trim().slice(0, NPC_NOTE_CAP) : "";
        entry = this._newEntry(name, cast, cast ? "" : note, turn, state);
        if (!cast) entry.importance = "medium";
        state.npcs[name] = entry;
        fresh.push(name);
      } else if (!IMPORTANT.has(entry.importance)) {
        entry.importance = cast ? "high" : "medium";
      }
      if ((!this.hasDetails(entry) || !isPortrait(entry.portrait)) && !this.busy.has(entry.name)) {
        this._ensureBuild(entry, state, onDone);
      }
    }
    return fresh;
  }

  // DEPRECATED — auto-forget is removed. Entries are never pruned; the player manages the
  // catalogue by hand and pinning only sorts to the top of the UI list. Kept as a no-op so
  // older callers don't throw; always returns [] and deletes nothing.
  prune(state, idleTurns) {
    return [];
  }

  // Anchored turn ordinal for each visible message index: the count of action/direct anchors
  // at or before that index (opening messages before the first anchor are turn 0). Matches the
  // memory system's turn numbering and `state.turn` (total anchors), so rebuilt lastSeen values
  // line up with the recency checks that read them.
  _turnAt(msgs) {
    const out = new Array((msgs || []).length);
    let anchors = 0;
    for (let i = 0; i < (msgs || []).length; i++) {
      const m = msgs[i];
      if (m && (m.role === "action" || m.role === "direct")) anchors++;
      out[i] = anchors;
    }
    return out;
  }

  // Non-mutating classification of one archived (hidden-version) dialogue line: which roster
  // entry it would count for under the CURRENT link rules, or null for scenery/unlinked.
  // Used only to backfill `everSpoke` for older saves (a character with dialogue only in a
  // hidden re-roll still spoke once). Never touches npcKey.
  _classifyArchived(display, npcKey, unlinked, state) {
    const t = String(display || "").trim();
    if (!t) return null;
    if (unlinked) return null;
    const rule = npcLinkRuleFor(state, t);
    if (rule && rule.mode === "unlink") {
      let exact = state.npcs[t] || null;
      if (!exact) {
        const lt = t.toLowerCase();
        for (const k of Object.keys(state.npcs || {})) {
          if (k.toLowerCase() === lt) { exact = state.npcs[k]; break; }
        }
      }
      return exact ? exact.name : null;
    }
    if (rule && rule.mode === "link" && state.npcs[rule.target]) return state.npcs[rule.target].name;
    if (npcKey && state.npcs[npcKey]) return state.npcs[npcKey].name;
    if (state.npcs[t]) return state.npcs[t].name;
    {
      const lt = t.toLowerCase();
      for (const k of Object.keys(state.npcs || {})) {
        if (k.toLowerCase() === lt) return state.npcs[k].name;
      }
    }
    {
      const seen = this.resolveEntry(t, state);
      if (seen) return seen.name;
      const castKnown = this.castResolve(t);
      if (castKnown && state.npcs[castKnown.name]) return state.npcs[castKnown.name].name;
      const cast = this.castMatch(t) || this.castResolve(t);
      if (cast) return cast.name;
    }
    return null;
  }

  // True when `entryName` has at least one dialogue/thought line in any stored (hidden)
  // re-roll version — i.e. it spoke in an alternate timeline even if the shown transcript
  // has none. Scans action.rerolls + openingRerolls without mutating them.
  _spokeInArchives(state, entryName) {
    if (!entryName) return false;
    const hit = (m) => {
      if (!m || !m.name || (m.role !== "npc" && m.role !== "thought")) return false;
      return this._classifyArchived(m.name, m.npcKey, !!m.npcUnlinked, state) === entryName;
    };
    try {
      for (const m of (state.messages || [])) {
        if (m && Array.isArray(m.rerolls)) {
          for (const ver of m.rerolls) {
            if (!Array.isArray(ver)) continue;
            for (const a of ver) if (hit(a)) return true;
          }
        }
      }
      const orr = state.openingRerolls;
      if (orr && typeof orr === "object" && !Array.isArray(orr)) {
        for (const k of Object.keys(orr)) {
          const list = orr[k];
          if (!Array.isArray(list)) continue;
          for (const ver of list) {
            if (!Array.isArray(ver)) continue;
            for (const a of ver) if (hit(a)) return true;
          }
        }
      }
    } catch (e) { /* archive scan is best-effort; visible tallies still decide */ }
    return false;
  }

  // Recompute sightings from the SHOWN transcript only (hidden re-roll versions never count).
  // Fixes the two false-present bugs: edits bumping NPCs that didn't speak that turn, and
  // version switches leaving the hidden version's NPCs marked recent.
  //
  // For every visible npc/thought line it applies the SAME linkage as update() (unlink flag,
  // unlink/link rules, exact, case-insensitive, resolveEntry, castResolve) and sets/clears
  // m.npcKey identically — but instead of bumping to state.turn it tallies per-entry
  // {count, first, last} using anchored turn ordinals (opening = 0). Missing world-cast
  // speakers are created from the tally (same seed as update). Existing entries with a tally
  // are overwritten (first/last/count, everSpoke=true) and get builds if needy. Existing
  // entries with NO visible tally are demoted to -1/-1/0 (not in shown story) ONLY when they
  // spoke before (everSpoke, legacy appearanceCount>1, or dialogue in archives); never-spoke
  // entries (promote-only / hand-added) are preserved untouched so a fresh promotion keeps its
  // creation recency. Returns {created, demoted}.
  rebuildSightings(state, onDone) {
    const msgs = (state && state.messages) || [];
    if (!state.npcs || typeof state.npcs !== "object") state.npcs = {};
    const turnAt = this._turnAt(msgs);
    const tallies = new Map(); // canonicalName -> {count, first, last}
    const pendingCast = new Map(); // castCanonicalName -> cast obj (for creation)
    const bump = (canonName, idx) => {
      const t = turnAt[idx];
      let e = tallies.get(canonName);
      if (!e) { e = { count: 0, first: t, last: t }; tallies.set(canonName, e); }
      e.count++;
      if (t < e.first) e.first = t;
      if (t > e.last) e.last = t;
    };
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      if (!m || !m.name || (m.role !== "npc" && m.role !== "thought")) continue;
      const display = String(m.name || "").trim();
      if (!display) continue;
      if (m.npcUnlinked) { delete m.npcKey; continue; }
      const rule = npcLinkRuleFor(state, display);
      if (rule && rule.mode === "unlink") {
        let exact = state.npcs[display] || null;
        if (!exact) {
          const lt = display.toLowerCase();
          for (const k of Object.keys(state.npcs || {})) {
            if (k.toLowerCase() === lt) { exact = state.npcs[k]; break; }
          }
        }
        if (exact) {
          delete m.npcKey;
          bump(exact.name, i);
          continue;
        }
        const castOnly = this.castMatch(display);
        if (!castOnly) continue;
        delete m.npcKey;
        pendingCast.set(castOnly.name, castOnly);
        bump(castOnly.name, i);
        continue;
      }
      if (rule && rule.mode === "link" && state.npcs[rule.target]) {
        const pinned = state.npcs[rule.target];
        if (pinned.name && pinned.name !== display) m.npcKey = pinned.name;
        else delete m.npcKey;
        bump(pinned.name, i);
        continue;
      }
      let canon = state.npcs[display] || null;
      if (!canon) {
        const lt = display.toLowerCase();
        for (const k of Object.keys(state.npcs || {})) {
          if (k.toLowerCase() === lt) { canon = state.npcs[k]; break; }
        }
      }
      if (!canon) {
        const seen = this.resolveEntry(display, state);
        if (seen) canon = seen;
        else {
          const castKnown = this.castResolve(display);
          if (castKnown && state.npcs[castKnown.name]) canon = state.npcs[castKnown.name];
        }
      }
      if (canon) {
        if (canon.name && canon.name !== display) m.npcKey = canon.name;
        else delete m.npcKey;
        bump(canon.name, i);
        continue;
      }
      {
        const cast = this.castMatch(display) || this.castResolve(display);
        if (!cast) continue;
        const name = cast.name;
        if (name !== display) m.npcKey = name;
        else delete m.npcKey;
        pendingCast.set(name, cast);
        bump(name, i);
      }
    }
    const created = [];
    const demoted = [];
    // Create missing world-cast speakers from their visible tally (first meeting = first visible
    // line, same seed as update). Description is the first line's excerpt, like update().
    for (const [name, cast] of pendingCast) {
      if (state.npcs[name]) continue;
      const t = tallies.get(name);
      if (!t) continue;
      let excerpt = "";
      for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i];
        if (!m || !m.name || (m.role !== "npc" && m.role !== "thought")) continue;
        const d = String(m.name || "").trim();
        if (!d) continue;
        const linked = (m.npcKey === name) || (d === name);
        if (!linked) {
          // Variant spelling that resolved to this cast name also qualifies (same as update's
          // castResolve path). Re-resolve cheaply: exact/case-insensitive already failed (no
          // entry existed then), so only castMatch/castResolve can link here.
          const c1 = this.castMatch(d);
          const c2 = c1 ? null : this.castResolve(d);
          if (!((c1 && c1.name === name) || (c2 && c2.name === name))) continue;
        }
        excerpt = String(m.text || "").slice(0, 160);
        break;
      }
      const entry = this._newEntry(name, cast, excerpt, t.first, state);
      entry.firstSeenTurn = t.first;
      entry.lastSeenTurn = t.last;
      entry.appearanceCount = t.count;
      entry.everSpoke = true;
      state.npcs[name] = entry;
      created.push(name);
    }
    // Overwrite sightings for entries with visible tallies; demote spoke-before-but-now-hidden
    // to the -1 sentinel (not in shown story); preserve never-spoke (promote-only/hand-added).
    for (const [name, entry] of Object.entries(state.npcs || {})) {
      if (!entry || typeof entry !== "object") continue;
      const t = tallies.get(name);
      if (t) {
        entry.firstSeenTurn = t.first;
        entry.lastSeenTurn = t.last;
        entry.appearanceCount = t.count;
        entry.everSpoke = true;
        continue;
      }
      const spokeBefore = !!entry.everSpoke || (Number(entry.appearanceCount) || 0) > 1;
      const inArchive = spokeBefore ? true : this._spokeInArchives(state, name);
      if (spokeBefore || inArchive) {
        if (entry.everSpoke !== true) entry.everSpoke = true;
        // Only record a demotion when something actually changes (avoids noisy callers).
        if (entry.lastSeenTurn !== -1 || entry.firstSeenTurn !== -1 || (entry.appearanceCount || 0) !== 0) {
          entry.firstSeenTurn = -1;
          entry.lastSeenTurn = -1;
          entry.appearanceCount = 0;
          demoted.push(name);
        }
      }
      // else: never spoke anywhere (promote-only bare entry, hand-added) — preserve creation
      // recency exactly as update() left it, so a fresh promotion keeps its 3-turn presence.
    }
    // Builds for visible needy entries only (same gate as update): important + missing details
    // or non-portrait, not already building. Demoted (hidden) entries never build.
    if (onDone) {
      for (const [name] of tallies) {
        const entry = state.npcs[name];
        if (!entry) continue;
        if (this.isImportant(entry) && (!this.hasDetails(entry) || !isPortrait(entry.portrait)) && !this.busy.has(entry.name)) {
          this._ensureBuild(entry, state, onDone);
        }
      }
    } else {
      for (const [name] of tallies) {
        const entry = state.npcs[name];
        if (!entry) continue;
        if (this.isImportant(entry) && (!this.hasDetails(entry) || !isPortrait(entry.portrait)) && !this.busy.has(entry.name)) {
          this._ensureBuild(entry, state, null);
        }
      }
    }
    return { created, demoted };
  }

  // Backfill profiles/portraits for existing important entries (e.g. migrated legacy NPCs)
  // that are missing details or a real portrait, without requiring a fresh appearance. Legacy
  // entries (created before NPC trackers existed) also get their seed here.
  backfill(state, onDone) {
    for (const entry of Object.values(state.npcs || {})) {
      if (!entry.trackers && this.npcTrackerDefs.length) {
        entry.trackers = this._seedTrackers(entry.cast ? this.castMatch(entry.name) : null, state);
      }
      if (IMPORTANT.has(entry.importance) && this.isImportant(entry) &&
          (!this.hasDetails(entry) || !isPortrait(entry.portrait)) && !this.busy.has(entry.name)) {
        this._ensureBuild(entry, state, onDone);
      }
    }
  }

  // Regenerate an NPC's portrait from their appearance (used by the "regenerate" button).
  // Returns true when a portrait landed, false on any failure — the caller notifies.
  async regeneratePortrait(entry, state) {
    return await this._genPortrait(entry, state);
  }

  // Where the story currently is, as a short concrete location phrase (used as the backdrop for
  // generated portraits — the hero's avatar regeneration uses this too).
  async sceneBackground(state) {
    return this._currentSceneBackground(state);
  }

  // Rebuild an NPC's full profile + portrait from scratch (used by the "regenerate profile"
  // button — e.g. when the AI got the role wrong). Details and portrait are cleared first.
  async regenerateProfile(entry, state, onDone) {
    const cast = this.castMatch(entry.name);
    if (cast) {
      entry.details = this._castFields(cast, state);
      entry.portrait = cast.avatar || "src/images/portrait-placeholder.webp";
      if (!IMPORTANT.has(entry.importance)) entry.importance = "high";
      entry.cast = true;
      this._ensureBuild(entry, state, onDone);
      return;
    }
    entry.details = null;
    entry.portrait = "src/images/portrait-placeholder.webp";
    if (!IMPORTANT.has(entry.importance)) entry.importance = "medium";
    this._ensureBuild(entry, state, onDone);
  }

  // Ensure an entry gets a full profile + portrait (used when the user creates an NPC by hand).
  // World-cast NPCs skip AI generation — their canonical profile comes from the world file.
  ensureProfiled(entry, state, onDone) {
    const cast = this.castMatch(entry.name);
    if (cast) {
      if (!IMPORTANT.has(entry.importance)) entry.importance = "high";
      const fields = this._castFields(cast, state);
      entry.details = fields;
      if (!isPortrait(entry.portrait)) entry.portrait = cast.avatar || "src/images/portrait-placeholder.webp";
      if (!entry.description) entry.description = [fields.job, fields.persona].filter(Boolean).join(". ");
      entry.cast = true;
      this._ensureBuild(entry, state, onDone);
      return;
    }
    if (!IMPORTANT.has(entry.importance)) entry.importance = "medium";
    this._ensureBuild(entry, state, onDone);
  }

  // One-line profile used in the GM context. The AI is told to treat this as canon.
  profileLine(entry) {
    const d = mergePersona({ ...(entry.details || {}) });
    const bits = [];
    for (const [k, label] of [["age", "Age"], ["gender", "Gender"], ["race", "Race"], ["appearance", "Appearance"], ["job", "Job"], ["persona", "Persona"], ["extra", "Extra details"], ["secrets", "Secrets"]]) {
      if (d[k]) bits.push(`${label}: ${d[k]}`);
    }
    const head = `${entry.name}${d.job ? ` (${d.job})` : ""}`;
    return `- ${head} — ` + (bits.length ? bits.join("; ") : (entry.description || "no profile yet"));
  }

  // ---- internals ----

  _ensureBuild(entry, state, onDone) {
    // A character created by hand (or promoted mid-session) gets their tracker seed here too — the
    // same seed a tracked appearance gives — so their strip has real values immediately rather than
    // only after the next session load's backfill.
    if (this.npcTrackerDefs.length && !entry.trackers) {
      entry.trackers = this._seedTrackers(entry.cast ? this.castMatch(entry.name) : null, state);
    }
    if (this.busy.has(entry.name)) return;
    this.busy.add(entry.name);
    this._build(entry, state, onDone).finally(() => {
      this.busy.delete(entry.name);
      if (onDone) onDone();
    });
  }

  async _build(entry, state, onDone) {
    if (!IMPORTANT.has(entry.importance)) {
      if (this.hasDetails(entry) || entry.pinned) {
        entry.importance = "medium"; // legacy or pinned — treat as important without a rating call
      } else return; // background NPC — stays lightweight
    }
    if (!this.hasDetails(entry)) {
      const d = await this._genProfile(entry, state);
      if (d) {
        entry.details = { ...this.emptyDetails(), ...d };
        if (!entry.description) entry.description = [d.job, d.persona].filter(Boolean).join(". ");
        if (onDone) onDone(); // show profile fields while the portrait still generates
      }
    }
    if (!isPortrait(entry.portrait)) {
      await this._genPortrait(entry, state);
    }
  }

  async _genProfile(entry, state) {
    const story = this._storyExcerpt(entry, state);
    const lore = this.loreForProfile(story, entry.name, entry.description || "").trim();
    const premise = [this.scenarioText, this.startText].map((t) => (t || "").trim()).filter(Boolean).join("\n\n");
    const lines = [
      "You are building a character profile for an important NPC in a text RPG.",
      "This profile is permanent canon for the whole game, and it must MATCH what is already established:",
      "- The WORLD LORE defines the setting — races, guilds, uniforms, currency, factions. Use it.",
      "- The PREMISE / STARTING SCENARIO may already name this NPC and their role. If so, that role is canon — reflect it exactly in the fields (especially age, gender, race, appearance, job), never invent a conflicting one.",
      "- The STORY EXCERPT shows how this NPC has actually appeared and behaved in the game so far. Honour it.",
      "Invent consistent, vivid details only to fill the gaps; make them feel like a real person with their own history and desires.",
      "Write exactly these lines, one per field:",
      "age: <age in years (e.g. 20 years old), or an age group such as \"early twenties\" or \"ageless\" if unknown>",
      "gender: <gender>",
      "race: <species/race — human, elf, dwarf, orc, or any that fits the world>",
      "appearance: <build, face, hair, eyes, clothings/outfit>",
      "job: <what they do for a living — match the story/lore if already established>",
      "persona: <the whole of how they come across — core personality traits, how they treat others, speech patterns, gestures, habits; one merged field>",
      "secrets: <anything private that they keep hidden, including personal tastes, turns ons, past crimes, true allegiance, etc; write \"none notable\" if nothing>",
      "extra: <ONLY anything that doesn't fit on any other field; write \"none notable\" if nothing>"
    ];
    if (lore) lines.push("", "WORLD LORE (canon):", lore);
    if (premise) lines.push("", "PREMISE / STARTING SCENARIO (canon where it names this NPC):", premise);
    if (story) lines.push("", "STORY EXCERPT (how this NPC has appeared so far):", story);
    lines.push("", `NPC NAME: ${entry.name}`, `FIRST APPEARANCE: ${entry.description || "(no description)"}`);
    const instruction = lines.join("\n");
    let out = "";
    try {
      const res = await this.genText({ instruction: subUser(instruction, heroNameOf(state)), route: "npc", maxTokens: 350 });
      out = String((res && res.text) || res || "");
    } catch (e) {
      console.error("NPC profile generation failed:", e);
      return null;
    }
    const details = {};
    for (const line of out.split("\n")) {
      const m = line.match(/^\s*(age|gender|race|appearance|job|persona|personality|mannerisms|extra|secrets)\s*:\s*(.+)$/i);
      if (m && m[2].trim()) details[m[1].toLowerCase()] = m[2].trim();
    }
    mergePersona(details); // fold a stray personality/mannerisms response into persona
    return Object.keys(details).length ? details : null;
  }

  // A short excerpt of the story around this NPC's appearances, so profile generation can
  // match how they've actually been described and spoken in the game.
  // Lines the player unlinked (per-line flag or an "unlink" rule for their spelling) are excluded
  // unless they carry this entry's exact name — they were ruled a different person.
  _storyExcerpt(entry, state) {
    const msgs = (state && state.messages) || [];
    const idxs = [];
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      if (m && m.name && entry.name && m.name !== entry.name
        && (m.npcUnlinked || (npcLinkRuleFor(state, m.name) || {}).mode === "unlink")) continue;
      // Linked lines first (the variant spelling resolved to this entry via `npcKey`), then the
      // legacy fallbacks: exact lines (pre-linkage saves) and the fuzzy arms for lines voiced
      // under a variant before linkage existed (either direction — a bare given name for a full
      // one). Descriptors that never linked ("Maya's friend" for "Maya") match nothing here.
      if (m && m.name && entry.name && (m.npcKey === entry.name || m.name === entry.name
        || nameHit(m.name, entry.name) || nameHit(entry.name, m.name))) idxs.push(i);
    }
    if (!idxs.length) return "";
    const fmt = (m) => {
      if (m.role === "action") return `PLAYER: ${m.text}`;
      // Linked lines render under their canonical roster name so the profile writer sees one
      // character, not two spellings — the transcript bubble itself keeps the GM's variant.
      if (m.role === "npc") return `[${m.npcKey || m.name}] ${m.text}`;
      if (m.role === "thought") return `[${m.npcKey || m.name} inner] ${m.text}`;
      return `GM: ${m.text}`;
    };
    const blocks = idxs.slice(-4).map((idx) =>
      msgs.slice(Math.max(0, idx - 2), idx + 1).filter((m) => m.role !== "image" && m.role !== "choice").map(fmt).join("\n"));
    let out = blocks.join("\n\n");
    if (out.length > 2600) out = "…\n" + out.slice(-2600);
    return out.trim();
  }

  // Derive the portrait's background from where the story currently is. Uses only the latest
  // scene narration (a plot-state line would mis-stage portraits — it goes stale between
  // roll-ups), then asks the AI for a short, concrete location phrase. Falls back to a moody
  // generic backdrop if there's no usable scene info or the call fails.
  async _currentSceneBackground(state) {
    const msgs = (state && state.messages) || [];
    const latestScene = msgs.filter((m) => m.role === "narrator").slice(-2)
      .map((m) => m.text).join(" ");
    const scene = latestScene ? `LATEST SCENE: ${latestScene.slice(0, 1400)}` : "";
    if (!scene.trim()) return fallbackBg();
    const instruction = [
      "You are helping paint character portraits.",
      "From the story state below, tell me WHERE the scene currently takes place as a short, concrete location phrase — e.g. 'the torch-lit crypt beneath the old temple', 'the rain-soaked docks of the harbor district'.",
      "Reply with only that location phrase, 12 words max. Do not mention any characters.",
      "",
      scene
    ].join("\n");
    try {
      const res = await withTimeout(
        this.genText({ instruction: subUser(instruction, heroNameOf(state)), route: "npc", maxTokens: 24 }),
        SCENE_BG_TIMEOUT_MS,
        "Scene background timed out."
      );
      const out = String((res && res.text) || res || "").trim().replace(/[.]+$/, "");
      return out || fallbackBg();
    } catch (e) {
      console.error("Scene background extraction failed:", e);
      return fallbackBg();
    }
  }

  // Returns true when a portrait landed, false on any failure (timeout, rejection, empty
  // result). Background auto-builds stay silent on false (no UI owns them); the portrait popup's
  // regen button notifies (see main.js).
  async _genPortrait(entry, state) {
    const d = entry.details || {};
    const look = d.appearance || entry.description || "";
    const identity = [d.gender, d.race, d.age, d.job].filter(Boolean).join(", ");
    const bg = await this._currentSceneBackground(state);
    const style = this.styleTags ? `, (${this.styleTags})` : "";
    const prompt = subUser(`Portrait of ${entry.name}${identity ? `, ${identity}` : ""}. ${look}, ${bg}${style}.`, heroNameOf(state));
    try {
      const r = await genImageSafe(this.genImage, prompt, { route: "portraits", negativePrompt: this.negativeTags, guidanceScale: imageGuidance() });
      entry.portrait = await generatedAvatarToWebp(r.dataUrl);
      return true;
    } catch (e) {
      console.error("NPC portrait generation failed:", e);
      return false;
    }
  }
}
