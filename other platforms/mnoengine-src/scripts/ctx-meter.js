// ctx-meter.js — the admin-only in-chat token counter pip.
//
// Owns its own topbar element (created by initCtxMeter, so index.html stays a static shell),
// the live count, and the "what the AI sees" popup. Debugging-only: it shows the EXACT prompts of
// the last turn taken this page-load, never an estimate — `–` until there is one. A stacked
// "Background calls" section below shows the last NPC-life tick + memory roll-up pass (they don't
// fire every turn, so each entry carries its own turn tag) — same pill, same popup.
//
// main.js drives it: initCtxMeter once (with a snapshot getter plus notify/esc, so this module
// never imports main.js — no cycle), then refreshCtxMeter() after every turn and session enter.
// Visibility follows the live `admin` event through main.js's community subscription.
import { pushBackClose } from "./back-close.js";

let deps = null;
let pill = null;
let meterCalls = null;
let meterTurn = 0;
let meterAdventureId = null;
// Background calls (NPC life tick + roll-up chunks): latest run per group, adventure-scoped.
// { adventureId, life: { turn, label, sub, text } | null, rollup: { turn, chunks: [...] } | null }
let meterBg = null;
let tokenMetaCache = null;

function tokenMeta() {
  if (!tokenMetaCache) {
    let meta = null;
    try { meta = window.genText && window.genText({ getMetaObject: true }); } catch (e) {}
    tokenMetaCache = {
      count: meta && typeof meta.countTokens === "function"
        ? (t) => meta.countTokens(String(t == null ? "" : t))
        : (t) => Math.ceil(String(t == null ? "" : t).length / 3.8),
      ideal: meta && Number.isFinite(meta.idealMaxContextTokens) ? meta.idealMaxContextTokens : 6000
    };
  }
  return tokenMetaCache;
}
const fmtK = (n) => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n);

const CALL_DEFS = [
  { key: "gm", label: "GM Prompt", field: "instruction" },
  { key: "check", label: "Skill-check Referee", field: "checkInstruction" },
  { key: "tracker", label: "Trackers", field: "trackerInstruction" },
  { key: "npc", label: "NPC Trackers", field: "npcTrackerInstruction" }
];

// The last calculated meter is persisted per adventure in its own kv key
// (NOT inside the adventure save itself, so exports/imports never carry it).
const meterKey = (adventureId) => "ctxmeter_" + adventureId;
const labelFor = (key) => (CALL_DEFS.find((d) => d.key === key) || {}).label || key;

export const OTHER_HEADERS = {
  check: {
    order: ["Intro", "Stats", "Trackers", "NPC trackers", "Decision rules", "Previous turn", "Latest action", "Custom instruction", "Output format"],
    match: [
      ["You are the skill-check referee", "Intro"],
      ["STATS (", "Stats"],
      ["CURRENT TRACKERS (values after", "Trackers"],
      ["NPC TRACKERS (values after", "NPC trackers"],
      ["DECISION RULES:", "Decision rules"],
      ["PREVIOUS TURN (the GM's", "Previous turn"],
      ["LATEST ACTION:", "Latest action"],
      ["CUSTOM INSTRUCTION", "Custom instruction"],
      ["Output ONLY one line", "Output format"]
    ]
  },
  tracker: {
    order: ["Intro", "Tracked state + rules", "Leveling rule", "Quest rule", "Previous turn", "Already applied", "Player action", "Latest turn", "Output format"],
    match: [
      ["You are the game-state tracker", "Intro"],
      ["TRACKED STATE:", "Tracked state + rules"],
      ["PREVIOUS STORY TURN", "Previous turn"],
      ["(this is the very first turn", "Previous turn"],
      ["CHANGES THE TRACKER ALREADY APPLIED", "Already applied"],
      ["The player's action/directive", "Player action"],
      ["LATEST STORY TURN TO TRACK:", "Latest turn"],
      ["Output ONLY the [TRACKERS]", "Output format"]
    ],
    sub: {
      "Tracked state + rules": [["LEVELING (", "Leveling rule"], ["QUEST OUTCOME (", "Quest rule"]]
    }
  },
  npc: {
    order: ["Intro", "Tracker rules", "Characters", "Previous turn", "Player action", "Latest turn", "Output format"],
    match: [
      ["You are the character-state tracker", "Intro"],
      ["NPC TRACKERS (one set of rules", "Tracker rules"],
      ["PREVIOUS STORY TURN", "Previous turn"],
      ["(this is the very first turn", "Previous turn"],
      ["The player's action/directive", "Player action"],
      ["LATEST STORY TURN TO TRACK:", "Latest turn"],
      ["Output ONLY the [NPC TRACKERS]", "Output format"]
    ],
    sub: {
      "Tracker rules": [["CHARACTERS TO TRACK (", "Characters"]]
    }
  }
};

export function splitOther(text, count, def) {
  const match = Array.isArray(def) ? def : (def && def.match) || [];
  const order = Array.isArray(def) ? null : (def && def.order) || null;
  const sub = (!Array.isArray(def) && def && def.sub) || {};
  const acc = new Map();
  const seen = [];
  const put = (label, chunk) => {
    if (!acc.has(label)) seen.push(label);
    acc.set(label, (acc.get(label) || "") + (acc.get(label) ? "\n\n" : "") + chunk);
  };
  let cur = null;
  for (const raw of String(text || "").split("\n\n")) {
    // Same triple-newline guard as context-budget's splitter: a part ending in "\n"
    // leaves the next header as "\nHEADER...", which must match its section instead
    // of folding into the previous one (this is what hid the vibe in the system prompt).
    if (!String(raw).trim()) continue;
    const chunk = String(raw).trim();
    let hit = null;
    for (const [prefix, label] of match) {
      if (chunk.startsWith(prefix)) { hit = label; break; }
    }
    if (hit) { cur = hit; put(cur, chunk); }
    else if (cur) acc.set(cur, acc.get(cur) + "\n\n" + chunk);
    else { cur = "Intro"; put(cur, chunk); }
  }
  // Some builders pack sub-sections as single LINES inside one chunk (the tracker call's
  // LEVELING (/QUEST OUTCOME ( rules, the NPC call's CHARACTERS TO TRACK roster) — carve
  // those out so each gets its own meter row instead of hiding inside the parent.
  for (const parent of Object.keys(sub)) {
    if (!acc.has(parent)) continue;
    const rules = sub[parent];
    const main = [];
    const carved = new Map();
    let curSub = null;
    for (const ln of acc.get(parent).split("\n")) {
      let h = null;
      for (const [pfx, lab] of rules) {
        if (ln.startsWith(pfx)) { h = lab; break; }
      }
      if (h) { curSub = h; if (!carved.has(h)) carved.set(h, []); carved.get(h).push(ln); }
      else if (curSub) carved.get(curSub).push(ln);
      else main.push(ln);
    }
    if ([...carved.values()].some((a) => a.length)) {
      acc.set(parent, main.join("\n"));
      for (const [lab, arr] of carved) {
        const txt = arr.join("\n");
        if (!acc.has(lab)) seen.push(lab);
        acc.set(lab, (acc.get(lab) || "") + (acc.get(lab) ? "\n\n" : "") + txt);
      }
    }
  }
  const labels = order || seen;
  return labels.map((label) => ({ label, tokens: acc.has(label) ? count(acc.get(label)) : 0, text: acc.get(label) || "" }));
}

function kvRpg() {
  try { return (typeof window !== "undefined" && window.kv && window.kv.rpg) || null; } catch (e) { return null; }
}

async function saveMeter(adventureId, turn, calls, bg) {
  try {
    const rpg = kvRpg();
    if (!rpg || !adventureId || !calls || !calls.length) return;
    const cleanBg = bg && bg.adventureId === adventureId && (bg.life || bg.rollup)
      ? { life: bg.life, rollup: bg.rollup } : null;
    await rpg.set(meterKey(adventureId), {
      v: 2, adventureId, turn: turn || 0, savedAt: Date.now(),
      calls: calls.map((c) => ({ key: c.key, text: c.text })),
      bg: cleanBg
    });
  } catch (e) { /* persistence is a nicety — a failed write never breaks the meter */ }
}

function validBg(bg) {
  try {
    if (!bg || typeof bg !== "object") return null;
    const out = { life: null, rollup: null };
    if (bg.life && typeof bg.life.text === "string" && bg.life.text) {
      out.life = { turn: bg.life.turn || 0, label: String(bg.life.label || "NPC life tick"), sub: String(bg.life.sub || ""), text: bg.life.text };
    }
    if (bg.rollup && Array.isArray(bg.rollup.chunks)) {
      const chunks = bg.rollup.chunks
        .filter((c) => c && typeof c.text === "string" && c.text)
        .map((c) => ({ label: String(c.label || "Memory roll-up"), sub: String(c.sub || ""), text: c.text }));
      if (chunks.length) out.rollup = { turn: bg.rollup.turn || 0, chunks };
    }
    return (out.life || out.rollup) ? out : null;
  } catch (e) { return null; }
}

async function loadMeter(adventureId) {
  try {
    const rpg = kvRpg();
    if (!rpg || !adventureId) return null;
    const rec = await rpg.get(meterKey(adventureId));
    if (!rec || rec.adventureId !== adventureId || !Array.isArray(rec.calls)) return null;
    const calls = rec.calls
      .map((c) => {
        const def = CALL_DEFS.find((d) => d.key === c.key);
        return def && c.text ? { ...def, text: c.text } : null;
      })
      .filter(Boolean);
    if (!calls.length) return null;
    return { turn: rec.turn || 0, savedAt: rec.savedAt || 0, calls, bg: validBg(rec.bg) };
  } catch (e) { return null; }
}

// Normalize the snapshot's background calls into meter blocks. Runs on every refresh and
// popup open; merge keeps only the latest run per group (background calls don't fire every
// turn, so a fresh snapshot usually carries nothing new — never wipe on absence).
function bgFromSnap(snap) {
  const out = { life: null, rollup: null };
  try {
    const lc = snap && snap.lifeCall;
    if (lc && lc.text) {
      out.life = {
        turn: lc.turn || 0, label: "NPC life tick",
        sub: "Turn " + (lc.turn || 0) + (lc.npcs && lc.npcs.length ? " · " + lc.npcs.join(", ") : ""),
        text: String(lc.text)
      };
    }
    const rc = snap && snap.rollupCalls;
    if (rc && Array.isArray(rc.chunks) && rc.chunks.length) {
      const chunks = rc.chunks
        .filter((c) => c && c.text)
        .map((c) => ({
          label: "Memory roll-up" + (c.count > 1 ? ` ${c.idx + 1}/${c.count}` : ""),
          sub: `Baked turn ${rc.turn || 0}` + (typeof c.turnMin === "number" ? ` · turns ${c.turnMin}–${c.turnMax}` : ""),
          text: String(c.text)
        }));
      if (chunks.length) out.rollup = { turn: rc.turn || 0, chunks };
    }
  } catch (e) {}
  return out;
}

function noteBgSnapshot(snap) {
  if (!snap || !snap.adventureId) return;
  if (!meterBg || meterBg.adventureId !== snap.adventureId) {
    meterBg = { adventureId: snap.adventureId, life: null, rollup: null };
  }
  const fresh = bgFromSnap(snap);
  if (fresh.life && (!meterBg.life || fresh.life.turn >= meterBg.life.turn)) meterBg.life = fresh.life;
  if (fresh.rollup && (!meterBg.rollup || fresh.rollup.turn >= meterBg.rollup.turn)) meterBg.rollup = fresh.rollup;
}

function paintPill(tokens) {
  const ideal = tokenMeta().ideal;
  pill.classList.toggle("ctxm-near", tokens > ideal && tokens <= ideal * 1.5);
  pill.classList.toggle("ctxm-over", tokens > ideal * 1.5);
  pill.innerHTML = `<span class="ctxm-dot"></span><span>◉ ${fmtK(tokens)}</span>`;
  return ideal;
}

export function initCtxMeter(d) {
  deps = d;
  if (pill) return;
  const anchor = document.getElementById("openRightBtn");
  if (!anchor || !anchor.parentNode) return;
  pill = document.createElement("button");
  pill.id = "ctxMeterPill";
  pill.className = "ctxm-pill";
  pill.type = "button";
  pill.title = "Token budget — click to see what the AI sees";
  pill.hidden = true;
  pill.addEventListener("click", openCtxMeterPop);
  anchor.parentNode.insertBefore(pill, anchor);
}

export async function refreshCtxMeter() {
  if (!deps || !pill) return;
  const snap = deps.getSnapshot();
  if ((!snap.admin && !snap.ctxDebug) || snap.appHidden) { pill.hidden = true; return; }
  const showEmpty = () => {
    meterCalls = null;
    pill.classList.remove("ctxm-near", "ctxm-over");
    pill.innerHTML = `<span class="ctxm-dot"></span><span>◉ –</span>`;
    pill.title = "No context yet — send a message first";
    pill.hidden = false;
  };
  const calls = CALL_DEFS.map((d) => ({ ...d, text: snap[d.field] })).filter((c) => c.text);
  if (calls.length) {
    const gm = calls.find((c) => c.key === "gm");
    if (!gm) { pill.hidden = true; return; }
    let tokens = 0;
    try { tokens = tokenMeta().count(gm.text); } catch (e) {}
    if (!tokens) { pill.hidden = true; return; }
    meterCalls = calls;
    meterTurn = snap.turn || 0;
    meterAdventureId = snap.adventureId || null;
    const ideal = paintPill(tokens);
    pill.title = `${tokens.toLocaleString()} tokens in context / ${ideal.toLocaleString()} budget — click to see what the AI sees`;
    pill.hidden = false;
    noteBgSnapshot(snap);
    saveMeter(meterAdventureId, meterTurn, calls, meterBg);
    return;
  }
  // No live prompts this page-load (e.g. after a reload) — fall back to this
  // adventure's saved meter so the pill still reflects its last turn.
  // Anything in memory from a DIFFERENT adventure is stale: drop it first, otherwise the
  // pill keeps showing the previous adventure's count on one with no context yet (or stays
  // hidden when it was hidden) instead of falling through to the empty state below.
  if (meterAdventureId !== (snap.adventureId || null)) {
    meterCalls = null;
    meterTurn = 0;
    meterAdventureId = snap.adventureId || null;
    meterBg = null;
  }
  if (!snap.adventureId) { showEmpty(); return; }
  const wantId = snap.adventureId;
  const saved = await loadMeter(wantId);
  if (deps.getSnapshot().adventureId !== wantId) return; // switched adventures mid-load
  if (!saved) { showEmpty(); return; }
  meterCalls = saved.calls;
  meterTurn = saved.turn || 0;
  meterAdventureId = wantId;
  if (saved.bg) meterBg = { adventureId: wantId, life: saved.bg.life, rollup: saved.bg.rollup };
  const gm = saved.calls.find((c) => c.key === "gm");
  let tokens = 0;
  try { tokens = tokenMeta().count(gm ? gm.text : ""); } catch (e) {}
  if (!tokens) { showEmpty(); meterCalls = null; return; }
  const ideal = paintPill(tokens);
  pill.title = `Turn ${meterTurn} · ${tokens.toLocaleString()} tokens in context / ${ideal.toLocaleString()} budget — click to see what the AI sees`;
  pill.hidden = false;
}

async function openCtxMeterPop() {
  if (!deps) return;
  const snap = deps.getSnapshot();
  let calls = (meterCalls && meterCalls.length && (!snap.adventureId || meterAdventureId === snap.adventureId))
    ? meterCalls
    : CALL_DEFS.map((d) => ({ ...d, text: snap[d.field] })).filter((c) => c.text);
  let turn = snap.turn || 0;
  if (meterCalls && meterCalls.length && meterAdventureId === snap.adventureId && !calls.length) {
    calls = meterCalls;
    turn = meterTurn || 0;
  }
  if (!calls.length && snap.adventureId) {
    const saved = await loadMeter(snap.adventureId);
    if (saved) { calls = saved.calls; turn = saved.turn || 0; meterCalls = saved.calls; meterTurn = turn; meterAdventureId = snap.adventureId; }
  }
  if (!calls.length) { deps.notify("No context yet — send a message first."); return; }
  const esc = deps.esc;
  const canSeePrompts = !!snap.admin;
  const { count, ideal } = tokenMeta();
  let cb = null;
  try { cb = await import("./context-budget.js"); } catch (e) { cb = null; }
  const blocks = calls.map((c) => {
    let tokens = 0;
    try { tokens = count(c.text); } catch (e) {}
    let sections = [];
    try {
      if (c.key === "gm" && cb) {
        sections = cb.scaleSections(cb.splitSections(c.text, count), tokens);
      } else if (cb) {
        sections = cb.scaleSections(splitOther(c.text, count, OTHER_HEADERS[c.key]), tokens);
      }
    } catch (e) { sections = []; }
    return { ...c, tokens, sections };
  });
  const total = blocks.reduce((a, b) => a + b.tokens, 0);
  // Background calls ride under the last-turn calls as their own stacked section (same pill,
  // same popup). They don't fire every turn, so each entry carries its own turn tag, and the
  // last-turn total above never includes them.
  noteBgSnapshot(snap);
  const bg = (meterBg && (!snap.adventureId || meterBg.adventureId === snap.adventureId)) ? meterBg : null;
  const bgList = [];
  if (bg) {
    if (bg.life) bgList.push(bg.life);
    if (bg.rollup) for (const c of bg.rollup.chunks || []) bgList.push(c);
  }
  const bgBlocks = bgList.map((g) => {
    let tokens = 0;
    try { tokens = count(g.text); } catch (e) {}
    return { ...g, tokens };
  });
  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";
  overlay.innerHTML = `
    <div class="popup ctxm-pop" tabindex="-1">
      <div class="popup-head">
        <span class="popup-title">${turn ? `Context Meter — Turn ${turn}` : "Context Meter"}</span>
        <button class="popup-x" title="Close" aria-label="Close">✕</button>
      </div>
      <div class="ctxm-body">
        <div class="ctxm-total ctxm-total-top">
          <span>${turn ? `Turn ${turn}, all calls` : "Last turn, all calls"}</span>
          <b>${total.toLocaleString()}</b>
        </div>
        ${blocks.map((b) => {
          const bpct = Math.min(100, Math.round((b.tokens / ideal) * 100));
          const bcls = b.tokens <= ideal ? "" : b.tokens <= ideal * 1.5 ? "near" : "over";
          const maxTok = Math.max(1, ...b.sections.map((s) => s.tokens));
          return `<div class="ctxm-call">
            <div class="ctxm-call-head">
              <span>${esc(b.label)}</span>
              <b>${b.tokens.toLocaleString()}<span class="ctxm-dim"> / ${ideal.toLocaleString()}</span></b>
            </div>
            <div class="ctxm-bar"><span class="ctxm-fill ${bcls}" style="width:${bpct}%"></span></div>
            ${b.sections.length ? `<div class="ctxm-groups">${b.sections.map((s) => {
              const w = s.tokens > 0 ? Math.max(2, Math.round((s.tokens / maxTok) * 100)) : 0;
              const rowInner = `<span class="ctxm-gl">${esc(s.label)}</span>` +
                `<span class="ctxm-gbar"><span class="ctxm-gfill" style="width:${w}%"></span></span>` +
                `<span class="ctxm-gv">${s.tokens.toLocaleString()}</span>`;
              if (!canSeePrompts) return `<div class="ctxm-gdet ctxm-locked"><div class="ctxm-grow">${rowInner}</div></div>`;
              return `<details class="ctxm-gdet"><summary class="ctxm-grow">${rowInner}</summary>` +
                `<div class="ctxm-pop-pre ctxm-gpre">${esc(s.text)}</div></details>`;
            }).join("")}</div>` : ""}
          </div>`;
        }).join("")}
        ${bgBlocks.length ? `<div class="ctxm-sep">Background calls · last run, not in total</div>
          ${bgBlocks.map((g) => {
            const bpct = Math.min(100, Math.round((g.tokens / ideal) * 100));
            const bcls = g.tokens <= ideal ? "" : g.tokens <= ideal * 1.5 ? "near" : "over";
            const rowInner = `<span class="ctxm-gl">Prompt</span>` +
              `<span class="ctxm-gbar"><span class="ctxm-gfill" style="width:100%"></span></span>` +
              `<span class="ctxm-gv">${g.tokens.toLocaleString()}</span>`;
            return `<div class="ctxm-call">
              <div class="ctxm-call-head"><span>${esc(g.label)}</span><b>${g.tokens.toLocaleString()}<span class="ctxm-dim"> / ${ideal.toLocaleString()}</span></b></div>
              <div class="ctxm-sub ctxm-dim">${esc(g.sub)}</div>
              <div class="ctxm-bar"><span class="ctxm-fill ${bcls}" style="width:${bpct}%"></span></div>
              ${canSeePrompts ? `<details class="ctxm-gdet"><summary class="ctxm-grow">${rowInner}</summary><div class="ctxm-pop-pre ctxm-gpre">${esc(g.text)}</div></details>` : ""}
            </div>`;
          }).join("")}` : ""}
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const release = pushBackClose(() => overlay.remove());
  const close = () => { release(); overlay.remove(); };
  overlay.querySelector(".popup-x").onclick = close;
  overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
  overlay.querySelector(".popup").focus();
}
