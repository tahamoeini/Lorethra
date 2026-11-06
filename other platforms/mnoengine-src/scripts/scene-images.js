// scene-images.js — everything about scene images: global amount/aspect prefs
// (machine-local `mno.scenePrefs`), the Scene modal (auto draft + direct-focus modes),
// background generation with in-place re-roll placeholders (a spinner per slot; failed slots
// revert to the old image), per-image delete/cancel, transcript thumbnails (`imageMsgEl`) and
// the right-rail gallery.
//
// main.js owns the app state and injects it via initSceneImages(). The gallery/lightbox browse
// set (`allGalleryImages`, newest batch first) is re-exported for main.js's lightbox wiring.

import { pushBackClose } from "./back-close.js";
import { TextPopup, ConfirmPopup } from "./popups.js";
import { openLightbox } from "./lightbox.js";
import { sceneImageToWebp, genImageSafe, withTimeout, IMAGE_PROMPT_TIMEOUT_MS } from "./image-utils.js";
import { imageGuidance } from "./image-gen-prefs.js";
import { findSceneNpcRefs, scenePromptWithRefs, refsSupported } from "./scene-refs.js";
import { activeImageProvider, getImageConfig } from "./image-provider.js";
import { subUser } from "./text-utils.js";
import { getCurrentTrackers, getCurrentNpcTrackers, liveMax, npcTrackerValuesLine } from "./trackers.js";

// App wiring (set once by main.js at boot). All mutable app state flows through here so this
// module never holds a stale copy: world-bound values (engine, style tags, prompt text) and UI
// flags (generating, rail state) are getters evaluated per call.
let ctx = null;
export function initSceneImages(deps) { ctx = deps; }

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Scene image amount + aspect are GLOBAL (machine-local localStorage, `mno.scenePrefs`) — not
// per-adventure. The modal reads the global pref, falling back to 1/portrait when nothing is
// saved yet. Every seg click persists immediately, so closing, cancelling, or generating all
// keep the choice.
const SCENE_PREF_KEY = "mno.scenePrefs";
const SCENE_AMTS = [1, 2, 3, 4];
const SCENE_ASPECTS = ["square", "portrait", "landscape", "random"];
function readScenePrefs() {
  try {
    const raw = localStorage.getItem(SCENE_PREF_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    const amt = SCENE_AMTS.includes(+p.amt) ? +p.amt : (SCENE_AMTS.includes(p.amt) ? p.amt : null);
    const aspect = SCENE_ASPECTS.includes(p.aspect) ? p.aspect : null;
    const mode = p.mode === "focus" || p.mode === "auto" ? p.mode : null;
    const focus = typeof p.focus === "string" ? p.focus.replace(/\s+/g, " ").trim().slice(0, 300) : null;
    const instant = (p.instant === undefined || p.instant === null) ? null : p.instant !== false;
    if (amt == null && aspect == null && mode == null && (focus == null || !focus) && instant == null) return null;
    return { amt, aspect, mode, focus, instant };
  } catch (e) { return null; }
}
function scenePrefs() {
  const g = readScenePrefs();
  const amt = (g && g.amt != null) ? g.amt : 1;
  const aspect = (g && g.aspect != null) ? g.aspect : "portrait";
  const mode = (g && g.mode) ? g.mode : "auto";
  const focus = (g && typeof g.focus === "string") ? g.focus : "";
  const instant = (g && g.instant != null) ? g.instant !== false : true;
  return { amt, aspect, mode, focus, instant };
}
// Patch-style writer: each control saves only what changed, the rest carries over — so a click
// on amount never wipes the mode, the directive, or the instant toggle.
function persistScenePrefs(patch = {}) {
  try {
    const cur = readScenePrefs() || {};
    const pick = (k, fb) => (patch[k] !== undefined ? patch[k] : (cur[k] !== undefined && cur[k] !== null ? cur[k] : fb));
    const amt = pick("amt", 1), aspect = pick("aspect", "portrait"), mode = pick("mode", "auto"),
      focus = pick("focus", ""), instant = pick("instant", true);
    localStorage.setItem(SCENE_PREF_KEY, JSON.stringify({
      amt: SCENE_AMTS.includes(+amt) ? +amt : 1,
      aspect: SCENE_ASPECTS.includes(aspect) ? aspect : "square",
      mode: mode === "focus" ? "focus" : "auto",
      focus: String(focus == null ? "" : focus).replace(/\s+/g, " ").trim().slice(0, 300),
      instant: instant !== false
    }));
  } catch (e) {}
}

const ASPECT_RES = { square: "768x768", portrait: "512x768", landscape: "768x512" };

async function runSceneCommand() {
  if (ctx.isGenerating()) { ctx.notify("⏳ The GM is still writing…"); return; }
  openSceneModal();
}

// The 🎨 button beside the chat input is an INSTANT shortcut, not the settings panel: it uses
// the saved global prefs (see scenePrefs), drops the placeholder boxes into the chat at once,
// and has the AI write the prompt in the background — no modal, nothing to configure. The full
// panel (editable prompt, amount, aspect) stays available at ⋮ menu > Scene.
async function quickSceneImage() {
  if (ctx.isGenerating()) { ctx.notify("⏳ The GM is still writing…"); return; }
  if (!ctx.getState()) return;
  const { amt, aspect } = scenePrefs();
  const aspectV = aspect === "random" ? ["square", "portrait", "landscape"][(Math.random() * 3) | 0] : aspect;
  const st = ctx.getState();
  const msg = { role: "image", images: [], pending: amt, failed: 0, prompt: "", aspect: aspectV, ts: Date.now() };
  ctx.getState().messages.push(msg);
  ctx.getState().messageCount++;
  ctx.render();
  await ctx.store.save(ctx.getState());
  ctx.notify("🖼 Generating " + amt + " scene image" + (amt > 1 ? "s" : "") + "…");
  let base = "";
  try {
    // The prompt-writing AI call can also stall — time it out so the placeholder boxes never spin
    // forever (the empty-base path below converts it into failed boxes + a message).
    base = cleanScenePrompt(await withTimeout(genImagePrompt(), IMAGE_PROMPT_TIMEOUT_MS, "Scene prompt timed out."));
  } catch (e) {
    console.error("Scene prompt generation failed:", e);
  }
  if (ctx.getState() !== st || !ctx.getState().messages.includes(msg)) return; // switched adventure, or the batch was deleted while the prompt was being written
  // Slots cancelled while the prompt was being written stay cancelled — don't regenerate them.
  msg.cancelled = 0;
  const left = msg.pending;
  if (!base) {
    msg.pending = 0;
    msg.failed = (msg.failed || 0) + left;
    ctx.render();
    ctx.refreshGallery();
    await ctx.store.save(ctx.getState());
    ctx.notify("⚠ Couldn't write a scene prompt — tap ✎ on the failed batch to enter one.");
    return;
  }
  if (!left) { afterImageChange(msg); return; } // every slot was cancelled while the prompt was being written
  msg.prompt = base;
  await ctx.store.save(ctx.getState());
  generateSceneImages(msg, base, left, aspectV);
}

// Ask the AI for an image prompt of the CURRENT scene, following image-prompt.md.
// `focus` is an optional player directive (the panel's Focus mode): appended ON TOP of the
// regular instruction to steer framing/subject, without changing the moment, location, or cast.
// Empty (the Auto mode, and always the instant 🎨 button) drafts purely from recent chat.
// The scene is read from the same material the GM sees: the last few turns of the real transcript
// (narration, NPC dialogue, inner thoughts — not just bare narration), the current location, and
// the characters actually in play (the SAME roster the GM's memory owner-gate uses). It keeps the
// TAIL of that transcript, because the freshest moment is at the end — an older event near the
// front must never win. Deliberately NO state.latestSituation: it is a plot-state line (not visual),
// empty for the first ~20 turns, and refreshed only every ~20 turns after that — a stale summary
// is exactly what used to drag the image back to a long-past event. The transcript is the scene.
async function genImagePrompt(focus = "") {
  const hero = (ctx.getState().character && ctx.getState().character.name) || "the hero";
  const loc = ctx.currentLocation();
  const recentMsgs = ctx.getEngine().recentWindow(ctx.getState().messages, 3);
  const recentFull = recentMsgs.map((m) => ctx.getEngine().fmt(m)).join("\n").trim();
  const sceneText = recentFull.length > 2400 ? recentFull.slice(-2400) : recentFull;
  // STRICT roster: only characters actually named in the scene transcript being painted — a
  // character merely seen a few turns ago (or world-cast but absent) is not cast into the picture
  // (see inPlayNpcs).
  const present = new Set(ctx.getEngine().inPlayNpcs(ctx.getState(), recentFull, { strict: true }));
  const engine = ctx.getEngine();
  const st = ctx.getState();
  const heroStats = (st.character && st.character.stats) || {};
  // Advanced Images settings (world editor > Images): when on, the last turn's tracker values
  // ride along as visible condition/state — hero trackers on PLAYER CHARACTER, each present
  // NPC's trackers on their own CHARACTERS PRESENT line. Same values the referee opt-ins feed
  // the skill check with (see RPEngine.determineCheck). Each toggle carries an optional key
  // subset ([] = all); stale keys are ignored. Sections are omitted when empty.
  const onlyKeys = (getter) => {
    try {
      const v = getter && getter();
      return Array.isArray(v) ? v.filter((k) => typeof k === "string" && k) : [];
    } catch (e) { return []; }
  };
  const subDefs = (defs, keys) => {
    if (!keys.length) return defs;
    const want = new Set(keys);
    const sub = defs.filter((d) => d && want.has(d.key));
    return sub.length ? sub : defs;
  };
  let heroTrackers = "";
  try {
    if (ctx.imageIncludeTrackers && ctx.imageIncludeTrackers() === true) {
      const defs = subDefs((engine && engine.trackerDefs) || [], onlyKeys(ctx.imageTrackerKeys));
      if (defs.length) {
        const cur = getCurrentTrackers(st, defs);
        const bits = [];
        for (const d of defs) {
          const v = cur[d.key];
          if (v === undefined || v === null || v === "") continue;
          const cap = d.type === "number" ? liveMax(d, cur, heroStats) : undefined;
          const name = (d.label && String(d.label).trim()) || d.key;
          bits.push(`${name} ${v}${cap !== undefined ? "/" + cap : ""}`);
        }
        if (bits.length) heroTrackers = bits.join(" · ");
      }
    }
  } catch (e) {}
  let npcTrackerByName = null;
  let npcTrackerDefs = [];
  try {
    if (ctx.imageIncludeNpcTrackers && ctx.imageIncludeNpcTrackers() === true) {
      const defs = subDefs((engine && engine.npcTrackerDefs) || [], onlyKeys(ctx.imageNpcTrackerKeys));
      npcTrackerDefs = defs;
      if (defs.length) npcTrackerByName = getCurrentNpcTrackers(st, defs, heroStats);
    }
  } catch (e) { npcTrackerByName = null; npcTrackerDefs = []; }
  const npcTrackerLine = (name) => {
    try {
      if (!npcTrackerByName) return "";
      const defs = npcTrackerDefs.length ? npcTrackerDefs : ((engine && engine.npcTrackerDefs) || []);
      if (!defs.length) return "";
      return npcTrackerValuesLine(defs, (npcTrackerByName && npcTrackerByName[name]) || {}, heroStats) || "";
    } catch (e) { return ""; }
  };
  const npcs = Object.entries(ctx.getState().npcs || {})
    .filter(([n, d]) => present.has(n) && d && d.details)
    .map(([n, d]) => {
      const dd = d.details || {};
      const bits = [dd.gender, dd.age, dd.race, dd.appearance, dd.job].filter(Boolean).join(", ");
      const base = bits || d.description || "";
      const vals = npcTrackerLine(n);
      if (vals) return base ? `- ${n}: ${base} — currently ${vals}` : `- ${n}: currently ${vals}`;
      return `- ${n}: ${base}`;
    }).join("\n");
  const c = ctx.getState().character || {};
  const heroBio = [c.age ? "age " + c.age : "", c.gender, c.race, c.appearance].filter(Boolean).join(", ");
  const heroLine = `PLAYER CHARACTER: ${hero}${heroBio ? ` — ${heroBio}` : ""}${heroTrackers ? ` — currently ${heroTrackers}` : ""}`;
  const directive = String(focus || "").replace(/\s+/g, " ").trim().slice(0, 300);
  const instruction = [
    "You write detailed image-generation prompts for a fantasy RPG scene. Follow the format and rules exactly:",
    ctx.promptText(),
    "",
    "Depict the CURRENT MOMENT — the single instant the scene is at right now. The transcript below is chronological (oldest first, newest last): paint what is happening at the very END of it and ignore anything earlier that has already resolved. Never combine moments from different points in time.",
    "Never give one character another character's appearance.",
    directive ? "Incorporate the player's directive below into the framing and focus of the image (subject, camera, emphasis) — the moment, the location, stay exactly as specified above." : "",
    "",
    "Now generate a visual prompt for THIS scene:",
    loc ? `LOCATION: ${loc}` : "",
    sceneText ? `CURRENT SCENE (transcript of the last few turns, newest at the end):\n${sceneText}` : "",
    heroLine,
    npcs ? `CHARACTERS PRESENT:\n${npcs}` : "",
    directive ? `PLAYER DIRECTIVE: ${directive}` : "",
    "",
    "Reply with ONLY the prompt itself, nothing else — no labels, no quotes, no commentary."
  ].filter(Boolean).join("\n");
  const res = await ctx.genText({ instruction: subUser(instruction, hero), route: "scene", maxTokens: 220 });
  return cleanScenePrompt(String((res && res.text) || res || "").trim());
}

function cleanScenePrompt(s) {
  return String(s || "").replace(/[\[\]]/g, "").replace(/\s+/g, " ").trim();
}

function openSceneModal() {
  const overlay = document.createElement("div");
  overlay.className = "scene-overlay";
  overlay.innerHTML = `
    <div class="scene-pop">
      <div class="popup-head"><span class="popup-title">🎨 Scene Image</span><button class="popup-x" title="Close">✕</button></div>
      <div class="scene-body">
        <div class="p-label" id="scenePromptLabel">Prompt <span class="scene-ctx.getState()" id="sceneGenState"></span></div>
        <button type="button" class="ui-sw sw-plain scene-sw" id="sceneDirect" role="switch" aria-checked="false" title="Direct the AI draft with your own focus, on top of the automatic prompt"><span class="sw-track"><span class="sw-knob"></span></span><span class="sw-text">Direct the prompt</span></button>
        <div id="sceneFocusWrap" hidden>
          <textarea id="sceneFocus" class="popup-ta scene-focus" rows="2" maxlength="300" placeholder="What should the image focus on? e.g. close-up on the dragon's eye…"></textarea>
          <div class="scene-hint">Directs the image — used when you press Generate. The moment and cast stay the same.</div>
        </div>
        <textarea id="scenePrompt" class="popup-ta" rows="4" placeholder="✨ Crafting a prompt for the current scene…"></textarea>
        <div class="scene-bar" id="scenePromptBar"><button id="sceneRegen" class="mini">⟳ Regenerate</button></div>
        <div class="p-label">Amount</div>
        <div class="seg" id="sceneAmt">
          <button type="button" data-v="1" class="seg-btn">1</button>
          <button type="button" data-v="2" class="seg-btn">2</button>
          <button type="button" data-v="3" class="seg-btn">3</button>
          <button type="button" data-v="4" class="seg-btn">4</button>
        </div>
        <div class="p-label">Aspect ratio</div>
        <div class="seg" id="sceneAspect">
          <button type="button" data-v="square" class="seg-btn">Square</button>
          <button type="button" data-v="portrait" class="seg-btn">Portrait</button>
          <button type="button" data-v="landscape" class="seg-btn">Landscape</button>
          <button type="button" data-v="random" class="seg-btn">Random</button>
        </div>
      </div>
      <div class="popup-acts">
        <button class="mini scene-cancel">Cancel</button>
        <button class="mini ok scene-gen">Generate</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const release = pushBackClose(() => close());

  const $q = (sel) => overlay.querySelector(sel);
  const ta = $q("#scenePrompt");
  const genBtn = $q(".scene-gen");
  const stateEl = $q("#sceneGenState");
  const regenBtn = $q("#sceneRegen");
  const focusWrap = $q("#sceneFocusWrap");
  const focusTa = $q("#sceneFocus");
  const directBtn = $q("#sceneDirect");
  const promptLabel = $q("#scenePromptLabel");
  const promptBar = $q("#scenePromptBar");
  const paintSw = (btn, on) => {
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-checked", String(on));
  };
  let { amt, aspect, mode } = scenePrefs();
  let promptBusy = false;

  // Direct mode (focus): the prompt field stays hidden and no draft is generated up
  // front — the prompt is written when Generate is pressed, with placeholder boxes
  // already in the chat (same preview as the instant 🎨 button). Auto mode keeps the
  // visible editable draft.
  const applyDirectUI = () => {
    const direct = mode === "focus";
    paintSw(directBtn, direct);
    focusWrap.hidden = !direct;
    promptLabel.hidden = direct;
    ta.hidden = direct;
    promptBar.hidden = direct;
    if (direct) genBtn.disabled = false;
    else genBtn.disabled = promptBusy;
  };

  const close = () => {
    // The directive is single-use: it belongs to the draft just made, so leaving the panel drops
    // it — while the rest (amount, aspect, toggles) carries the modal's current values into global.
    focusTa.value = "";
    persistScenePrefs({ amt, aspect, mode, focus: "" });
    release();
    overlay.remove();
  };

  const setPromptState = (busy, label) => {
    promptBusy = busy;
    if (busy) ctx.setBusy(regenBtn, "Generating…"); else ctx.clearBusy(regenBtn);
    regenBtn.disabled = busy;
    genBtn.disabled = mode === "focus" ? false : busy;
    ta.disabled = busy;
    focusTa.disabled = busy;
    stateEl.innerHTML = (busy ? '<span class="spin spin-sm"></span> ' : "") + esc(label || "");
  };

  const loadPrompt = async () => {
    setPromptState(true, "generating…");
    try {
      const p = await withTimeout(genImagePrompt(""), IMAGE_PROMPT_TIMEOUT_MS, "Scene prompt timed out.");
      if (!overlay.isConnected) return;
      if (mode !== "auto") { setPromptState(false, ""); return; }
      if (p) { ta.value = p; setPromptState(false, ""); }
      else setPromptState(false, "⚠ empty — press ⟳ Regenerate");
    } catch (e) {
      console.error("Scene prompt generation failed:", e);
      if (!overlay.isConnected) return;
      if (mode !== "auto") { setPromptState(false, ""); return; }
      setPromptState(false, "⚠ failed — press ⟳ Regenerate");
    }
  };

  const bindSeg = (sel, onPick) => {
    const seg = $q(sel);
    seg.querySelectorAll(".seg-btn").forEach((b) => {
      b.onclick = () => {
        if (b.disabled) return;
        seg.querySelectorAll(".seg-btn").forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
        onPick(b.dataset.v);
      };
    });
  };
  bindSeg("#sceneAmt", (v) => { amt = +v; persistScenePrefs({ amt }); });
  bindSeg("#sceneAspect", (v) => { aspect = v; persistScenePrefs({ aspect }); });
  directBtn.onclick = () => {
    mode = mode === "focus" ? "auto" : "focus";
    persistScenePrefs({ mode });
    applyDirectUI();
    if (mode === "focus") focusTa.focus();
    else {
      // Back to Auto: the hidden draft is untouched — only draft when there is nothing to show.
      if (!cleanScenePrompt(ta.value) && !promptBusy) loadPrompt();
      ta.focus();
    }
  };
  focusTa.addEventListener("input", () => persistScenePrefs({ focus: focusTa.value }));
  const setSeg = (sel, v) => {
    $q(sel).querySelectorAll(".seg-btn").forEach((x) => x.classList.toggle("on", x.dataset.v === String(v)));
  };
  setSeg("#sceneAmt", amt);
  setSeg("#sceneAspect", aspect);
  applyDirectUI();

  regenBtn.onclick = () => { if (!promptBusy && mode === "auto") loadPrompt(); };
  $q(".scene-cancel").onclick = close;
  $q(".popup-x").onclick = close;
  overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
  ta.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  focusTa.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  genBtn.onclick = async () => {
    if (genBtn.disabled) return;
    const amtV = amt;
    const aspectV = aspect === "random" ? ["square", "portrait", "landscape"][(Math.random() * 3) | 0] : aspect;
    if (mode === "focus") {
      // Direct mode: no visible draft — write the prompt on Generate from the directive,
      // with the placeholder boxes already in the chat, exactly like the instant 🎨 button.
      const directive = String(focusTa.value || "").replace(/\s+/g, " ").trim().slice(0, 300);
      close(); // close the modal first — prompt + images continue in the background
      const st = ctx.getState();
      const msg = { role: "image", images: [], pending: amtV, failed: 0, prompt: "", aspect: aspectV, ts: Date.now() };
      ctx.getState().messages.push(msg);
      ctx.getState().messageCount++;
      ctx.render();
      await ctx.store.save(ctx.getState());
      ctx.notify("🖼 Generating " + amtV + " scene image" + (amtV > 1 ? "s" : "") + "…");
      let base = "";
      try {
        base = cleanScenePrompt(await withTimeout(genImagePrompt(directive), IMAGE_PROMPT_TIMEOUT_MS, "Scene prompt timed out."));
      } catch (e) {
        console.error("Scene prompt generation failed:", e);
      }
      if (ctx.getState() !== st || !ctx.getState().messages.includes(msg)) return; // switched adventure, or the batch was deleted while the prompt was being written
      // Slots cancelled while the prompt was being written stay cancelled — don't regenerate them.
      msg.cancelled = 0;
      const left = msg.pending;
      if (!base) {
        msg.pending = 0;
        msg.failed = (msg.failed || 0) + left;
        ctx.render();
        ctx.refreshGallery();
        await ctx.store.save(ctx.getState());
        ctx.notify("⚠ Couldn't write a scene prompt — tap ✎ on the failed batch to enter one.");
        return;
      }
      if (!left) { afterImageChange(msg); return; } // every slot was cancelled while the prompt was being written
      msg.prompt = base;
      await ctx.store.save(ctx.getState());
      generateSceneImages(msg, base, left, aspectV);
      return;
    }
    const base = cleanScenePrompt(ta.value);
    if (!base) { ctx.notify("⚠ The prompt is empty."); return; }
    close(); // close the modal first — generation continues in the background
    const msg = { role: "image", images: [], pending: amtV, failed: 0, prompt: base, aspect: aspectV, ts: Date.now() };
    ctx.getState().messages.push(msg);
    ctx.getState().messageCount++;
    ctx.render();
    await ctx.store.save(ctx.getState());
    ctx.notify("🖼 Generating " + amtV + " scene image" + (amtV > 1 ? "s" : "") + "…");
    generateSceneImages(msg, base, amtV, aspectV);
  };

  // Auto mode drafts on open; Direct mode stays quiet until Generate is pressed.
  if (mode === "auto") loadPrompt();
  (mode === "focus" ? focusTa : ta).focus();
}

// Generate the scene images in the background, filling the placeholder boxes in the transcript as
// each one lands. Chat stays fully usable while this runs — `generating` is only set by GM turns.
// A re-roll regenerates IN PLACE: each slot shows a spinner until its replacement lands (then
// the new image) or fails (then it reverts to the old image) — the batch never grows mid-reroll.
// `replacing.done[i]` marks attempted slots (success, failure, or player-cancelled); `dropped`
// holds the slot indices the player deleted mid-reroll (legacy value entries are also honoured).
function replacingDroppedSet(rep) {
  const s = new Set();
  const dropped = Array.isArray(rep.dropped) ? rep.dropped : [];
  const old = Array.isArray(rep.old) ? rep.old : [];
  const n = Array.isArray(rep.fresh) ? rep.fresh.length : old.length;
  for (const d of dropped) if (typeof d === "number" && Number.isInteger(d)) s.add(d);
  const vals = dropped.filter((d) => typeof d !== "number");
  if (vals.length) {
    const left = new Map();
    for (const v of vals) left.set(v, (left.get(v) || 0) + 1);
    for (let i = 0; i < n; i++) {
      const o = old[i];
      if (o !== undefined) {
        const c = left.get(o) || 0;
        if (c > 0) { s.add(i); left.set(o, c - 1); }
      }
    }
  }
  return s;
}
// Display cells for a message mid-reroll, in slot order, skipping deleted slots: a landed
// replacement (new image), a finished-but-failed/cancelled slot (old image, reverted), or a
// still-waiting slot (spinner). Count stays at n minus explicit deletes — never 2n.
function replacingCells(m) {
  const rep = m.replacing || {};
  const old = Array.isArray(rep.old) ? rep.old : [];
  const fresh = Array.isArray(rep.fresh) ? rep.fresh : [];
  const done = Array.isArray(rep.done) ? rep.done : [];
  const dropped = replacingDroppedSet(rep);
  const cells = [];
  for (let i = 0; i < fresh.length; i++) {
    if (dropped.has(i)) continue;
    if (fresh[i]) cells.push({ slot: i, kind: "img", src: fresh[i], isNew: true });
    else if (done[i] && old[i] !== undefined) cells.push({ slot: i, kind: "img", src: old[i], isNew: false });
    else if (!done[i]) cells.push({ slot: i, kind: "load" });
    // done with no old image to revert to (shouldn't happen) — show nothing for the slot
  }
  return cells;
}
async function generateSceneImages(msg, base, amt, aspect) {
  const st = ctx.getState();
  const alive = () => ctx.getState() === st && ctx.getState().messages.includes(msg);
  // Character likeness refs (experiment): NPC name hits in the finished prompt
  // contribute their avatars as provider reference images, numbered in
  // first-mention order. Resolved once per batch — every slot paints the same
  // moment, so every slot gets the same refs. Only where the active provider
  // accepts them (never Perchance/DALL-E): elsewhere the prompt goes out
  // exactly as before.
  const sceneRefs = (() => {
    try {
      const hits = findSceneNpcRefs(base, ctx.getState().npcs || {}, ctx.getState().character || {});
      if (!hits.length) return null;
      const cfg = getImageConfig();
      if (!refsSupported(activeImageProvider(), cfg.model)) return null;
      return {
        prompt: scenePromptWithRefs(base, hits),
        images: hits.map((h) => h.avatar),
        names: hits.map((h) => h.name),
      };
    } catch (e) {
      console.warn("Scene refs failed, generating without them:", e);
      return null;
    }
  })();
  const sendBase = (sceneRefs && sceneRefs.prompt) || base;
  const sendRefs = (sceneRefs && sceneRefs.images) || null;
  // Same prompt with the style tags the send paths append — without the ref
  // augmentation. Providers fall back to it when the model rejects references,
  // so a ref failure retries with neither the images nor their prompt lines.
  const styled = (p) => cleanScenePrompt(p + (ctx.styleTags() ? ` (${ctx.styleTags()})` : ""));
  for (let i = 0; i < amt; i++) {
    if (msg.replacing) {
      const rep = msg.replacing;
      if (!Array.isArray(rep.done) || rep.done.length !== (rep.fresh || []).length) {
        rep.done = new Array((rep.fresh || []).length).fill(false);
        // Preserve already-landed replacements as done (a stale buffer without `done` can only
        // come from an older client version — anything with a fresh image is trivially done).
        for (let k = 0; k < rep.done.length; k++) if (rep.fresh && rep.fresh[k]) rep.done[k] = true;
      }
      if (replacingDroppedSet(rep).has(i)) {
        msg.pending = Math.max(0, (msg.pending || 0) - 1);
        ctx.render();
        ctx.refreshGallery();
        await ctx.store.save(ctx.getState());
        if (!alive()) return;
        continue;
      }
      if (rep.done[i]) {
        // Cancelled mid-reroll (see cancelPendingImage) — already reverted to the old image.
        msg.pending = Math.max(0, (msg.pending || 0) - 1);
        ctx.render();
        ctx.refreshGallery();
        await ctx.store.save(ctx.getState());
        if (!alive()) return;
        continue;
      }
      let r = null;
      try {
        r = await genImageSafe(ctx.genImage, styled(sendBase), { route: "scene", resolution: ASPECT_RES[aspect], negativePrompt: ctx.negativeTags(), guidanceScale: imageGuidance(), ...(sendRefs ? { referenceImages: sendRefs, barePrompt: styled(base) } : {}) });
      } catch (e) {
        console.error("Scene image generation failed:", e);
      }
      if (!alive()) return;
      if (rep.done[i]) {
        // Cancelled while this slot was generating — discard the result, keep the old image.
        msg.pending = Math.max(0, (msg.pending || 0) - 1);
        ctx.render();
        ctx.refreshGallery();
        await ctx.store.save(ctx.getState());
        continue;
      }
      msg.pending = Math.max(0, (msg.pending || 1) - 1);
      if (r && r.dataUrl) {
        const webp = await sceneImageToWebp(r.dataUrl);
        if (!alive()) return;
        if (rep.done[i]) {
          // Cancelled during conversion — discard (pending already counted above).
          ctx.render();
          ctx.refreshGallery();
          await ctx.store.save(ctx.getState());
          continue;
        }
        rep.fresh[i] = webp;
        rep.done[i] = true;
      }
      else {
        rep.failed = (rep.failed || 0) + 1;
        rep.done[i] = true; // failed — reverts to the old image
      }
      ctx.render();
      ctx.refreshGallery();
      await ctx.store.save(ctx.getState());
      continue;
    }
    // A pending box was cancelled by the player — skip this slot so no image is wasted.
    if ((msg.cancelled || 0) > 0) {
      msg.cancelled--;
      msg.pending = Math.max(0, (msg.pending || 0) - 1);
      ctx.render();
      ctx.refreshGallery();
      await ctx.store.save(ctx.getState());
      if (!alive()) return;
      continue;
    }
    let r = null;
    try {
      // genImageSafe times out (the plugin's promise never settles on failure) and throws on an
      // empty result — the catch below converts either into a failed box + a message.
      r = await genImageSafe(ctx.genImage, styled(sendBase), { route: "scene", resolution: ASPECT_RES[aspect], negativePrompt: ctx.negativeTags(), guidanceScale: imageGuidance(), ...(sendRefs ? { referenceImages: sendRefs, barePrompt: styled(base) } : {}) });
    } catch (e) {
      console.error("Scene image generation failed:", e);
    }
    if (!alive()) return;
    msg.pending = Math.max(0, (msg.pending || 1) - 1);
    if (r && r.dataUrl) {
      const webp = await sceneImageToWebp(r.dataUrl);
      // (A re-roll never reaches here — it returns via the in-place branch above.)
      msg.images.push(webp);
    }
    else msg.failed = (msg.failed || 0) + 1;
    ctx.render();
    ctx.refreshGallery();
    await ctx.store.save(ctx.getState());
  }
  if (!alive() || msg.pending) return;
  if (msg.replacing) { finishImageReplace(msg); return; }
  if (msg.images.length || msg.failed) {
    if (msg.failed) ctx.notify(msg.images.length ? "🖼 Some scene images failed." : "⚠ Scene image generation failed.");
    else ctx.notify("🖼 Scene image" + (msg.images.length > 1 ? "s" : "") + " added.");
  }
  afterImageChange(msg); // drop the message if the player cancelled every slot
}

// Bulk-swap a finished re-roll, slot by slot: each position takes its new image when one arrived,
// otherwise keeps its old image (a failed/cancelled replacement never blanks the slot). Positions
// the player deleted mid-reroll stay deleted. The old images were never cleared, so a reload
// mid-reroll simply recovers them — the partial buffer is dropped on load (see normalize).
function finishImageReplace(m) {
  const rep = m.replacing || {};
  const old = Array.isArray(rep.old) ? rep.old : [];
  const fresh = Array.isArray(rep.fresh) ? rep.fresh : [];
  // Deleted-mid-reroll slots stay deleted (slot indices; legacy value entries resolve to slots
  // via replacingDroppedSet, so two identical images never nuke each other's slot).
  const dropped = replacingDroppedSet(rep);
  const next = [];
  let swapped = 0;
  for (let i = 0; i < fresh.length; i++) {
    if (dropped.has(i)) continue; // deleted mid-reroll — stays deleted
    const o = old[i];
    if (fresh[i]) { next.push(fresh[i]); swapped++; }
    else if (o !== undefined) next.push(o); // failed/cancelled — keep the old one
  }
  m.images = next;
  delete m.replacing;
  m.failed = 0;
  m.cancelled = 0;
  const failedN = rep.failed || 0;
  if (swapped && !failedN) ctx.notify("🖼 Scene image" + (swapped > 1 ? "s" : "") + " updated.");
  else if (swapped && failedN) ctx.notify(`🖼 ${swapped} updated, ${failedN} failed — kept the old one${failedN > 1 ? "s" : ""}.`);
  else if (!swapped && failedN) ctx.notify("⚠ Scene image regeneration failed — kept the current images.");
  // All-cancelled: no notify — the spinners simply clear back to the kept images.
  afterImageChange(m); // drop the message if nothing is left to show
}

/* ---------- image messages ---------- */
// A loading box that stands in for a scene image still being generated. `aspect` matches the
// final image's shape so the finished <img> slots neatly into the same row.
function loadingBox(n, total, aspect, failed, label) {
  const cls = aspect === "portrait" ? " p" : aspect === "landscape" ? " l" : "";
  return `<div class="img-load${failed ? " fail" : ""}${cls}">
    ${failed ? `<span style="font-size:22px">⚠</span>` : `<div class="spin"></div>`}
    <span>${failed ? "Failed" : (label || `Generating ${n}/${total}…`)}</span>
    <button class="load-del" title="${failed ? "Remove placeholder" : "Cancel image"}">✖</button>
  </div>`;
}

function imageMsgEl(m) {
  const w = document.createElement("div");
  w.className = "msg imgmsg";
  const wcls = m.aspect === "portrait" ? " p" : m.aspect === "landscape" ? " l" : "";
  // Mid-reroll: render IN PLACE — each slot shows its spinner until the replacement lands (new
  // image) or fails (reverts to the old image). The row never grows to old + spinners.
  if (m.replacing) {
    const cells = replacingCells(m);
    const row = cells.map((c) => {
      if (c.kind === "img") {
        return `<span class="img-thumb-wrap${wcls}"><img class="img-thumb" src="${c.src}" data-slot="${c.slot}" alt="Scene image"><button class="thumb-del" title="Delete image">✖</button></span>`;
      }
      return loadingBox(c.slot + 1, cells.length, m.aspect, false, "Regenerating…");
    }).join("");
    w.innerHTML = `<div class="img-col">
        <div class="img-row">${row}</div>
      </div>`;
    w.querySelectorAll(".img-thumb-wrap").forEach((wrap) => {
      const im = wrap.querySelector(".img-thumb");
      const slot = +im.dataset.slot;
      im.onclick = () => openLightbox(m, slot);
      wrap.querySelector(".thumb-del").onclick = () => deleteOneImageWithConfirm(m, slot);
      if (!im.complete) {
        im.addEventListener("load", () => ctx.stickOnLoad(), { once: true });
      }
    });
    // Every spinner reverts its slot to the old image when cancelled (see cancelPendingImage).
    w.querySelectorAll(".img-load").forEach((el) => {
      el.querySelector(".load-del").onclick = () => cancelPendingWithConfirm(m);
    });
    return w;
  }
  const thumbs = (m.images || []).map((src, i) => {
    return `<span class="img-thumb-wrap${wcls}"><img class="img-thumb" src="${src}" data-i="${i}" alt="Scene image ${i + 1}"><button class="thumb-del" title="Delete image">✖</button></span>`;
  }).join("");
  const total = (m.images || []).length + (m.pending || 0) + (m.failed || 0);
  const loads = [];
  let boxNo = (m.images || []).length;
  for (let i = 0; i < (m.pending || 0); i++) { boxNo++; loads.push(loadingBox(boxNo, total, m.aspect)); }
  for (let i = 0; i < (m.failed || 0); i++) { boxNo++; loads.push(loadingBox(boxNo, total, m.aspect, true)); }
  w.innerHTML = `<div class="img-col">
      <div class="img-row">${thumbs}${loads.join("")}</div>
    </div>`;
  const pendingN = m.pending || 0;
  w.querySelectorAll(".img-thumb-wrap").forEach((wrap) => {
    const im = wrap.querySelector(".img-thumb");
    const i = +im.dataset.i;
    im.onclick = () => openLightbox(m, i);
    wrap.querySelector(".thumb-del").onclick = () => deleteOneImageWithConfirm(m, i);
    if (!im.complete) {
      im.addEventListener("load", () => ctx.stickOnLoad(), { once: true });
    }
  });
  w.querySelectorAll(".img-load").forEach((el, i) => {
    el.querySelector(".load-del").onclick = () => (i < pendingN ? cancelPendingWithConfirm(m) : cancelFailedWithConfirm(m));
  });
  return w;
}

// Per-image delete: removes a single scene image out of a multi-image message, so deleting one
// never nukes the whole batch. Used by both the chat thumbnails and the gallery cells.
// `idx` is a slot index mid-reroll (see replacingCells) and a plain image index otherwise.
function deleteOneImage(m, idx) {
  if (m.replacing) {
    const rep = m.replacing;
    const n = Array.isArray(rep.fresh) ? rep.fresh.length : 0;
    if (!Number.isInteger(idx) || idx < 0 || idx >= n) return;
    rep.dropped = rep.dropped || [];
    if (rep.dropped.includes(idx)) return;
    // The slot stays gone through the final swap (see finishImageReplace); the row re-renders
    // without it right away. Pending is counted down by the generation loop, so it is untouched
    // here — the loop skips dropped slots when it reaches them.
    rep.dropped.push(idx);
    afterImageChange(m);
    return;
  }
  const arr = m.images || [];
  if (idx < 0 || idx >= arr.length) return;
  const [v] = arr.splice(idx, 1);
  afterImageChange(m);
}

function cancelPendingImage(m) {
  // Mid-reroll cancel reverts ONE waiting/generating slot to its old image immediately (no count
  // change). The generation loop skips already-done slots, so pending is untouched here.
  if (m.replacing) {
    const rep = m.replacing;
    const n = Array.isArray(rep.fresh) ? rep.fresh.length : 0;
    if (!Array.isArray(rep.done) || rep.done.length !== n) {
      rep.done = new Array(n).fill(false);
      for (let k = 0; k < n; k++) if (rep.fresh && rep.fresh[k]) rep.done[k] = true;
    }
    const dropped = replacingDroppedSet(rep);
    for (let i = 0; i < n; i++) {
      if (rep.done[i] || dropped.has(i)) continue;
      rep.done[i] = true; // reverts to old[i] on the next render; the loop discards/skips it
      afterImageChange(m);
      return;
    }
    return;
  }
  if (!(m.pending > 0)) return;
  m.pending--;
  m.cancelled = (m.cancelled || 0) + 1; // the generation loop skips this slot
  afterImageChange(m);
}

function cancelFailedImage(m) {
  if (!(m.failed > 0)) return;
  m.failed--;
  afterImageChange(m);
}

// Re-render + persist after any single-cell change, and drop the message entirely if its last
// cell was removed (nothing left to show).
function afterImageChange(m) {
  if (!(m.images || []).length && !m.pending && !m.failed) {
    const i = ctx.getState().messages.indexOf(m);
    if (i >= 0) ctx.getState().messages.splice(i, 1);
  }
  ctx.clampMemoryCursor(); // image rows aren't story, but removing them must never leave the roll-up cursor past the transcript
  ctx.render();
  ctx.store.save(ctx.getState());
  ctx.refreshGallery();
}

// Shared confirm for every single-cell image operation (delete / cancel).
async function confirmImageOp(title, message, confirmText, fn) {
  const ok = await ConfirmPopup.open({
    title,
    message,
    confirmText,
    danger: true
  });
  if (ok) fn();
}

const deleteOneImageWithConfirm = (m, idx) => confirmImageOp("Delete image", "Remove this image? Deletion is permanent and cannot be undone.", "Delete", () => deleteOneImage(m, idx));
const cancelPendingWithConfirm = (m) => confirmImageOp("Cancel image", "Stop generating this image? The rest of the batch is unaffected.", "Remove", () => cancelPendingImage(m));
const cancelFailedWithConfirm = (m) => confirmImageOp("Delete image", "Remove this failed image placeholder?", "Delete", () => cancelFailedImage(m));

// Whole-batch delete for the chat action bar — the per-image ✖ stays on each thumbnail.
function deleteMessageImages(m) {
  const i = ctx.getState().messages.indexOf(m);
  if (i >= 0) ctx.getState().messages.splice(i, 1);
  ctx.clampMemoryCursor(); // a removed image row must never leave the roll-up cursor past the transcript
  ctx.render();
  ctx.store.save(ctx.getState());
  ctx.refreshGallery();
}

function deleteMessageWithConfirm(m) {
  // Mid-reroll the row shows one cell per slot (never old + spinners), so count those — not
  // old images + pending spinners, which would double-count the batch.
  const n = m.replacing ? replacingCells(m).length : (m.images || []).length + (m.pending || 0) + (m.failed || 0);
  confirmImageOp(
    n > 1 ? "Delete all images" : "Delete image",
    n > 1 ? `Remove all ${n} images in this batch? This cannot be undone.` : "Remove this image? Deletion is permanent and cannot be undone.",
    "Delete",
    () => deleteMessageImages(m)
  );
}

function editImagePrompt(m) {
  const n = (m.images || []).length;
  TextPopup.open({
    title: n > 1 ? `Edit image prompt · ${n} images` : "Edit image prompt",
    value: m.prompt || "",
    placeholder: "Describe the scene…",
    rows: 6,
    confirmText: "⟳ Regenerate",
    cancelText: "Cancel"
  }).then((val) => {
    if (val == null) return;
    const p = val.trim();
    if (!p) { ctx.notify("⚠ Enter a prompt before regenerating."); return; }
    rerollSceneImages(m, p);
  });
}

// Re-roll a finished image batch: regenerate the same number of images IN PLACE — each thumbnail
// becomes a spinner until its replacement lands (new image) or fails (reverts to the old image),
// so the row never grows. Failed/cancelled slots keep their old image; slots deleted mid-reroll
// stay deleted (see finishImageReplace). The old images survive a reload (see normalize).
// `prompt` lets the player edit the stored prompt first (omit to reuse it). Runs in the
// background like a fresh generation.
function rerollSceneImages(m, prompt) {
  const n = (m.images || []).length;
  if (m.pending || m.replacing) { ctx.notify("⏳ Scene images are still generating."); return; }
  if (!n) return; // nothing to re-roll
  if (typeof prompt === "string") m.prompt = prompt;
  m.replacing = { old: [...m.images], fresh: new Array(n).fill(null), done: new Array(n).fill(false), failed: 0, dropped: [] };
  m.pending = n;
  m.failed = 0;
  m.cancelled = 0;
  ctx.render();
  ctx.store.save(ctx.getState());
  ctx.notify("⟳ Re-generating " + n + " scene image" + (n > 1 ? "s" : "") + "…");
  generateSceneImages(m, m.prompt || "", n, m.aspect || "square");
}

const rerollImagesWithConfirm = (m) => {
  const n = (m.images || []).length;
  confirmImageOp(
    n > 1 ? "Re-roll images" : "Re-roll image",
    `Regenerate the ${n} image${n > 1 ? "s" : ""} with the same prompt?`,
    "Regenerate",
    () => rerollSceneImages(m)
  );
};

// Flatten every image message's finished images into live {msg, idx} references, newest batch
// first. The lightbox browses THIS whole list, so next/prev spans every batch in the gallery and
// stays in sync with the gallery grid's newest-on-top order.
// Mid-reroll messages browse their in-place cells (landed replacements + reverted olds), so the
// lightbox never shows the stale pre-reroll set once new images have arrived.
function allGalleryImages() {
  const items = [];
  for (let mi = ctx.getState().messages.length - 1; mi >= 0; mi--) {
    const m = ctx.getState().messages[mi];
    if (m.role !== "image") continue;
    if (m.replacing) {
      for (const c of replacingCells(m)) if (c.kind === "img") items.push({ msg: m, idx: c.slot, src: c.src });
    }
    else (m.images || []).forEach((src, i) => items.push({ msg: m, idx: i, src }));
  }
  return items;
}

/* ---------- gallery — grid of all scene images in the current adventure (right rail) ---------- */
function openGallery() {
  ctx.openRailSection("right", "gallery");
}

// Flatten every image message into individual gallery cells (finished, still-generating, failed).
// Iterated newest-message-first so the gallery grid shows the most recent scene images on top.
function galleryItems() {
  const items = [];
  for (let mi = ctx.getState().messages.length - 1; mi >= 0; mi--) {
    const m = ctx.getState().messages[mi];
    if (m.role !== "image") continue;
    // Mid-reroll: the same in-place cells as the transcript — spinners replace the old images
    // instead of stacking after them, so the gallery count never grows mid-reroll either.
    if (m.replacing) {
      for (const c of replacingCells(m)) {
        if (c.kind === "img") items.push({ kind: "img", src: c.src, msg: m, idx: c.slot, regen: true });
        else items.push({ kind: "load", aspect: m.aspect, msg: m, regen: true });
      }
      continue;
    }
    (m.images || []).forEach((src, i) => items.push({ kind: "img", src, msg: m, idx: i }));
    for (let i = 0; i < (m.pending || 0); i++) items.push({ kind: "load", aspect: m.aspect, msg: m });
    for (let i = 0; i < (m.failed || 0); i++) items.push({ kind: "fail", aspect: m.aspect, msg: m });
  }
  return items;
}

function renderGalleryBody(body) {
  body.innerHTML = "";
  const items = galleryItems();
  const imgs = items.filter((i) => i.kind === "img");
  const head = document.createElement("div");
  head.className = "gal-head";
  head.innerHTML = `<div class="p-label">Gallery ${imgs.length ? `· ${imgs.length} image${imgs.length > 1 ? "s" : ""}` : ""}</div>`;
  body.appendChild(head);
  if (!items.length) {
    const e = document.createElement("div");
    e.className = "gal-empty";
    e.innerHTML = `No scene images yet.<br>Use the <b>🎨</b> button beside the chat input to paint the current scene.`;
    body.appendChild(e);
    return;
  }
  const grid = document.createElement("div");
  grid.className = "gal-grid";
  // Two masonry lanes, filled left-to-right: each cell goes to the currently shorter lane, so the
  // top row is always the two newest images and columns stay balanced without cropping.
  const colA = document.createElement("div");
  colA.className = "gal-col";
  const colB = document.createElement("div");
  colB.className = "gal-col";
  grid.append(colA, colB);
  const laneH = [0, 0];
  const estH = (it) => {
    const a = it.kind === "img" ? it.msg.aspect : it.aspect;
    return a === "portrait" ? 768 / 512 : a === "landscape" ? 512 / 768 : 1;
  };
  for (const it of items) {
    const cell = document.createElement("div");
    if (it.kind === "img") {
      cell.className = "gal-item";
      cell.innerHTML = `<img src="${it.src}" alt="Scene image">` +
        `<button class="gal-info" title="Edit prompt & regenerate">✎</button>` +
        `<button class="gal-del" title="Delete image">✖</button>`;
      cell.querySelector("img").onclick = () => openLightbox(it.msg, it.idx);
      cell.querySelector(".gal-info").onclick = () => editImagePrompt(it.msg);
      cell.querySelector(".gal-del").onclick = () => deleteOneImageWithConfirm(it.msg, it.idx);
    } else {
      const cls = it.aspect === "portrait" ? " p" : it.aspect === "landscape" ? " l" : "";
      if (it.kind === "load") {
        cell.className = "gal-item load" + cls;
        cell.innerHTML = `<div class="spin"></div><span>${it.regen ? "Regenerating…" : "Generating…"}</span><button class="gal-del" title="Cancel image">✖</button>`;
        cell.querySelector(".gal-del").onclick = () => cancelPendingWithConfirm(it.msg);
      } else {
        cell.className = "gal-item fail" + cls;
        cell.innerHTML = `<span style="font-size:20px">⚠</span><span>Failed</span><button class="gal-del" title="Remove placeholder">✖</button>`;
        cell.querySelector(".gal-del").onclick = () => cancelFailedWithConfirm(it.msg);
      }
    }
    const lane = laneH[0] <= laneH[1] ? 0 : 1;
    (lane === 0 ? colA : colB).appendChild(cell);
    laneH[lane] += estH(it);
  }
  body.appendChild(grid);
}


export {
  runSceneCommand, quickSceneImage, imageMsgEl, editImagePrompt,
  rerollImagesWithConfirm, deleteMessageWithConfirm, renderGalleryBody,
  allGalleryImages, openGallery, scenePrefs, persistScenePrefs,
};
