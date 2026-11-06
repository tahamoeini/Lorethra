// Scenario import — third-party scenario files become worlds via an AI-matched rules template,
// plus the inbound-share return path (Batch 2: moved from main.js).
//
// Imports freshWorldId/extractAiValue from world-craft.js (one-way dependency); app state comes
// via initScenarioImport() getters (same pattern as scene-images.js / world-craft.js). AI calls go
// through window.genText. Local esc keeps this module free of main.js.

import { loadWorld } from "./world.js";
import { freshWorldId, extractAiValue } from "./world-craft.js";
import { convertScenarioFile, scenarioSourceLabel, importFailureMessage, isBackupFileText, buildTemplateChoiceInstruction, parseTemplateChoice, applyTemplateToWorld, findScenarioFormat, INBOUND_PARAM, inboundReferenceFromSearch, inboundFileUrl } from "./scenario-import.js";
import { inlineMd } from "./rich-text.js";
import { ConfirmPopup } from "./popups.js";
import { pushBackClose } from "./back-close.js";
import { notify } from "./notify.js";
import { ICON_IMPORT } from "./icons.js";

let D = null; // injected app deps (see initScenarioImport) — null until main.js wires it
export function initScenarioImport(deps) { D = deps; }
const needD = () => { if (!D) throw new Error("scenario-import-panel: initScenarioImport() was not called"); };
const getStore = () => { needD(); return D.store(); };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// ---- Third-party scenario import: AI-matched rules template -------------------------------
// A scenario file carries story but no rules. The import panel loads the LIVE template catalog
// (manifest + files, so it always tracks whatever templates exist), asks the AI which template's
// stats/trackers fit the scenario's genre, and applies it — the scenario's own words are never
// touched. Import-only: one automatic choice (blank fallback when the AI doesn't answer), no
// template picker.
async function loadTemplateCatalog() {
  const catalog = [];
  try {
    const manifest = JSON.parse(await fetch("src/game/templates/manifest.json").then((r) => r.text()));
    for (const m of manifest) {
      if (!m || !m.file) continue;
      try {
        const text = await fetch("src/game/templates/" + m.file).then((r) => r.text());
        const parsed = JSON.parse(text);
        catalog.push({
          file: m.file,
          name: m.name || (parsed.meta && parsed.meta.name) || m.file,
          desc: m.desc || "",
          icon: m.icon || "📄",
          tag: m.tag || "",
          text, parsed
        });
      } catch (e) { console.warn("[import] template failed:", m && m.file, e); }
    }
  } catch (e) { console.warn("[import] template manifest missing/invalid:", e); }
  // Blank is always available — it is also the fallback when the manifest can't load at all.
  // (Manifest ids are filenames like "blank.json" — match those, not a bare "blank".)
  if (!catalog.some((t) => t.file === "blank.json" || String(t.name || "").toLowerCase() === "blank")) {
    const blank = JSON.stringify({ format: "mno-world", version: 1, meta: { id: "", name: "", description: "", author: "", authorId: "", cover: "", tags: [], createdAt: "", updatedAt: "" }, narrativeVibe: "", lorebook: [], scenario: "", start: "", imageStyleTags: "", imageNegativeTags: "", stats: { pointsPerLevel: 2, ccBudget: 10, ccFloor: 1, averageThreshold: 10, exceptionalThreshold: 15, modStep: 1, defs: [] }, trackers: [], npcTrackers: [], npcs: [] });
    catalog.unshift({ file: "blank.json", name: "Blank", desc: "No rules — story only, no stats or trackers.", icon: "📄", tag: "empty", text: blank, parsed: JSON.parse(blank) });
  }
  return catalog;
}

// Ask the AI which catalog template fits the scenario. Returns { template, reason }; throws when
// the reply names nothing usable (the panel falls back to blank).
async function chooseScenarioTemplateAI(title, premise, catalog) {
  const choices = catalog.map((t) => ({ file: t.file, name: t.name, desc: t.desc }));
  const instruction = buildTemplateChoiceInstruction(title, premise, choices);
  const res = await window.genText({ instruction, route: "other" });
  const out = String((res && res.text) || res || "");
  const val = await extractAiValue(out);
  const file = parseTemplateChoice(val === undefined ? null : val, choices);
  if (!file) throw new Error("AI reply named no known template.");
  const template = catalog.find((t) => t.file === file) || null;
  if (!template) throw new Error("AI reply named no known template.");
  const reason = (val && typeof val === "object") ? String(val.reason || "") : "";
  return { template, reason };
}

// The scenario import panel: the preset cards render as soon as the catalog loads and are
// immediately clickable; the AI recommendation resolves in the background and fills in the
// Recommended line + badge (taking the selection only when the player hasn't picked yet).
// Resolves the final world file form, or null when cancelled/failed (failures are shown inside
// the panel, so the caller stays silent).
function runScenarioImportPanel(converted, sourceName) {
  const fromLine = sourceName
    ? `Importing <b>${esc(converted.meta.name)}</b> from ${esc(sourceName)}.`
    : `Importing <b>${esc(converted.meta.name)}</b>.`;
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "cc-overlay";
    overlay.innerHTML = `
      <div class="cc-panel tp-panel" tabindex="-1">
        <div class="cc-head">
          <span class="cc-title">${ICON_IMPORT} Import World</span>
          <button class="popup-x sc-cancel" title="Close">✕</button>
        </div>
        <div class="cc-body">
          <p class="cc-hint sc-intro">${fromLine}</p>
          <div class="tp-ai-status sc-status"></div>
          <div class="sc-result" hidden></div>
        </div>
        <div class="cc-foot">
          <span class="cc-err"></span>
          <button type="button" class="mini sc-cancel-btn">Cancel</button>
          <button type="button" class="mini ok sc-go" disabled>Import World</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const release = pushBackClose(() => done(null));
    const statusEl = overlay.querySelector(".sc-status");
    const resultEl = overlay.querySelector(".sc-result");
    const goBtn = overlay.querySelector(".sc-go");
    let panelCatalog = [];
    let selectedFile = null;
    let manualPick = false;   // the player clicked a card — the AI must not steal the selection
    let aiFile = null;        // recommended template file, once the background call resolves
    let aiReason = "";
    let aiFailed = false;
    let cardEls = [];
    const done = (f) => { release(); overlay.remove(); resolve(f); };
    const setStatus = (msg, bad) => {
      statusEl.innerHTML = msg || "";
      statusEl.classList.toggle("bad", !!bad);
    };
    const working = (label) => { statusEl.hidden = false; setStatus('<span class="spin"></span> ' + esc(label), false); };
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) done(null); });
    overlay.addEventListener("keydown", (e) => { if (e.key === "Escape") done(null); });
    overlay.querySelector(".sc-cancel").onclick = () => done(null);
    overlay.querySelector(".sc-cancel-btn").onclick = () => done(null);
    overlay.querySelector(".cc-panel").focus();
    goBtn.onclick = () => {
      const tpl = panelCatalog.find((t) => t.file === selectedFile);
      if (!tpl) return; // no preset chosen yet — the button stays disabled until there is one
      try {
        const out = applyTemplateToWorld(converted, tpl.parsed);
        const via = loadWorld(JSON.stringify(out));
        if (!via.world) throw new Error(via.errors.join("\n"));
        done(out);
      } catch (err) {
        setStatus("⚠ " + ((err && err.message) ? err.message : "Import failed."), true);
        statusEl.hidden = false;
      }
    };
    const syncGo = () => { goBtn.disabled = !selectedFile; };
    const paintSel = () => {
      cardEls.forEach((c) => {
        const on = c.dataset.file === selectedFile;
        c.classList.toggle("sel", on);
        c.setAttribute("aria-checked", on ? "true" : "false");
      });
    };
    // The preset choice wears the same cards as ＋ Create world's template picker
    // (wp-card/tp-card + thumb + tag + stats/trackers meta); clicking selects, the footer
    // Import World confirms. Re-rendered when the background recommendation lands (badge +
    // line, and the selection when the player hasn't picked yet).
    const renderList = () => {
      const aiName = aiFile ? (panelCatalog.find((t) => t.file === aiFile) || {}).name : "";
      const recLine = aiFile
        ? `<div class="ld-wdesc">👍 Recommended: <b>${esc(aiName)}</b>` + (aiReason ? ` — ${esc(aiReason)}` : "") + `</div>`
        : aiFailed
          ? `<div class="ld-wdesc">Couldn't get a recommendation — pick a preset yourself.</div>`
          : `<div class="ld-wdesc">👍 Recommended: finding the best fit…</div>`;
      const cardsHtml = panelCatalog.map((t) => {
        const st = (t.parsed.stats && t.parsed.stats.defs) || [];
        const tr = t.parsed.trackers || [];
        const isAi = t.file === aiFile;
        const isSel = t.file === selectedFile;
        return `<div class="wp-card tp-card sc-tpl-card${isSel ? " sel" : ""}" data-file="${esc(t.file)}" role="radio" aria-checked="${isSel ? "true" : "false"}" tabindex="0">`
          + `<div class="tp-thumb">${esc(t.icon || "📄")}</div>`
          + `<div class="wp-main"><div class="ld-whead"><span class="ld-wname">${esc(t.name)}</span>`
          + (t.tag ? `<span class="ld-wtag">${esc(t.tag)}</span>` : "")
          + (isAi ? `<span class="ld-wtag sc-ai-tag">👍 Rec</span>` : "")
          + `</div>`
          + (t.desc ? `<div class="ld-wdesc">${inlineMd(t.desc)}</div>` : "")
          + `<div class="tp-meta">${st.length} stats · ${tr.length} trackers</div>`
          + `</div></div>`;
      }).join("");
      resultEl.innerHTML = `<div class="sc-pick-title">Choose world preset</div>`
        + `<div class="ld-wdesc sc-explain">Pick the preset that best fits the world — it sets the stats, trackers, tone and image style. The story text stays exactly as written.</div>`
        + recLine
        + `<div class="tp-list sc-tpl-list">${cardsHtml}</div>`;
      cardEls = [...resultEl.querySelectorAll(".sc-tpl-card")];
      cardEls.forEach((c) => {
        const pick = () => { selectedFile = c.dataset.file; manualPick = true; paintSel(); syncGo(); };
        c.onclick = pick;
        c.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } };
      });
      paintSel();
      syncGo();
    };
    (async () => {
      try {
        working("Loading rules templates…");
        panelCatalog = await loadTemplateCatalog();
        setStatus("", false);
        statusEl.hidden = true;
        resultEl.hidden = false;
        renderList(); // cards are clickable NOW; the recommendation fills in below
        try {
          const pick = await chooseScenarioTemplateAI(converted.meta.name, converted.scenario, panelCatalog);
          aiFile = pick.template.file;
          aiReason = pick.reason;
          if (!manualPick) selectedFile = aiFile;
        } catch (e) {
          console.warn("[import] template choice failed:", e);
          aiFailed = true;
        }
        renderList();
        if (!manualPick && selectedFile) goBtn.focus();
      } catch (err) {
        setStatus("⚠ " + ((err && err.message) ? err.message : "Import failed."), true);
      }
    })();
  });
}

// Import a world file (.mno-world, a legacy .json, or a third-party scenario such as a
// `.scenario.json`): validate via the loader, handle id collisions, add to the library
// (stored as the file form, so it round-trips back out byte-identically).
async function importWorldFile(file, inputEl) {
  if (!file) return;
  try {
    const text = await file.text();
    // The classic mix-up: a full backup dropped on ⭱ Import World. Point at the restore
    // flow instead of the scenario-format lecture — with a button that takes them there.
    if (isBackupFileText(text)) {
      const go = await ConfirmPopup.choose({
        title: "That's a backup file",
        message: "This file is a FULL BACKUP of everything in this browser — adventures, worlds, library and settings — not a single world, so it can't be imported here.\n\nTo restore it: Settings › Data & Backup › Import (merge adds what's missing, replace wipes first).",
        options: [{ label: "Open Data & Backup", value: "backup", kind: "ok" }],
        cancelText: "Close"
      });
      if (go === "backup") {
        try { D.openBackupSection(); } catch (e) { /* settings is a nicety here */ }
      }
      return;
    }
    await importWorldText(text);
  } catch (err) {
    await ConfirmPopup.open({ title: "World import failed", message: err.message, confirmText: "OK" });
  } finally {
    if (inputEl) inputEl.value = "";
  }
}

// Import worlds from TEXT (a picked file's contents, or a fetched inbound share). This is the
// unit that moves if the import flow ever gets its own module — importWorldFile (file picker)
// and checkInboundShare (?importdata= link) are both thin callers over it. Silent on cancel
// (null panel result, declined Replace/Duplicate); throws a player-facing Error otherwise.
async function importWorldText(text) {
  let fileForm = null;
  let world = null;
  const direct = loadWorld(text);
    if (direct.world) {
      world = direct.world;
      fileForm = JSON.parse(text);
    } else {
      // Not an mno-world — maybe a third-party scenario. A `complete` registry entry (one
      // whose converted world already carries its full rules layer) skips the template panel
      // and validates like a direct import, keeping its id for the collision tail below;
      // anything else goes through the panel's AI rules match (null = cancelled, silent).
      try {
        const converted = convertScenarioFile(text);
        let parsed = null;
        try { parsed = JSON.parse(text); } catch (e) { parsed = null; }
        const entry = parsed ? findScenarioFormat(parsed) : null;
        if (entry && entry.complete) {
          const viaComplete = loadWorld(JSON.stringify(converted));
          if (!viaComplete.world) throw new Error(viaComplete.errors.join("\n"));
          fileForm = converted;
          world = viaComplete.world;
        } else {
          const picked = await runScenarioImportPanel(converted, scenarioSourceLabel(text));
          if (!picked) return; // cancelled — stay silent
          picked.meta.id = await freshWorldId();
          const via = loadWorld(JSON.stringify(picked));
          if (!via.world) throw new Error(via.errors.join("\n"));
          fileForm = picked;
          world = via.world;
        }
      } catch (convErr) {
        throw new Error(importFailureMessage(text, direct.errors, convErr));
      }
    }
    // An imported world KEEPS the author it arrived with — its `meta.author` and the `meta.authorId`
    // behind it, so a file that came from your own export is still recognised as yours and follows a
    // rename. Importing is not authoring (README §6.9): your username is stamped only where a world
    // is created or duplicated. What the file came from is provenance, and that survives in
    // `meta.remix` when it carries fork lineage, and in `meta.origin` ("imported") which the card
    // footer reads — the scenario importer stamps it, and a legacy file that already carries it
    // keeps it.
    if (D.isBundled(world.meta.id)) { // never shadow a bundled world's fixed id
      fileForm.meta.id = await freshWorldId();
      notify("🌍 Imported world's id matched a bundled world — it was given a new id.");
    }
    const existing = await getStore().get(fileForm.meta.id);
    if (existing) {
      const existingName = String(existing.meta.name || fileForm.meta.id);
      const incomingName = String(world.meta.name || fileForm.meta.id);
      const choice = await ConfirmPopup.choose({
        title: "World already exists",
        message: existingName === incomingName
          ? `A world named "${existingName}" (${fileForm.meta.id}) already exists in your library. Replace it, or keep both by importing a copy?`
          : `A world with this id already exists ("${existingName}"). The file you're importing is "${incomingName}". Replace the existing world, or keep both by importing a copy?`,
        options: [
          { label: "Duplicate", value: "duplicate", kind: "ok" },
          { label: "Replace", value: "replace", kind: "warn" }
        ],
        cancelText: "Cancel"
      });
      if (!choice) return; // cancelled — stay silent
      if (choice === "duplicate") {
        // A second library entry from the same file: fresh id + a disambiguating name, kept as an
        // import (the file's author travels with it — importing is not authoring, so no `sign`).
        fileForm.meta.id = await freshWorldId();
        const taken = new Set((await getStore().list()).map((e) => String((e && e.name) || "").trim().toLowerCase()));
        const root = String(world.meta.name || "World").trim().replace(/\s*\(copy( \d+)?\)\s*$/i, "") || "World";
        let cand = `${root} (copy)`;
        for (let n = 2; taken.has(cand.toLowerCase()); n++) cand = `${root} (copy ${n})`;
        fileForm.meta.name = cand;
        world.meta.id = fileForm.meta.id;
        world.meta.name = cand;
      }
      // "replace" keeps fileForm.meta.id, so worldStore.save below overwrites the existing world.
    }
    await getStore().save(fileForm);
    await D.refreshNames();
    notify("🌍 World \"" + world.meta.name + "\" imported.");
    D.onSaved();
}

// ---- Inbound share (?importdata=): the return path --------------------------------------
// Another library links here with `?importdata=[<name>~]<32hex>.gz` (see INBOUND_PARAM and
// parseInboundReference in scenario-import.js) and this engine imports the referenced file
// exactly as if the player had picked it in ⭱ Import World. The token is fetched ONLY from
// the blob host, with the same bounds the Library enforces outbound (8 MiB compressed /
// 16 MiB decompressed / 15 s timeout), gunzipped when it wears the gzip magic, then run
// through importWorldText — so every payload type behaves like its picker equivalent (full
// restore for mno-worlds and MNO envelopes, template panel for story-only scenarios,
// failure popup otherwise). The parameter is consumed once: stripped from the URL the moment
// it is read (replaceState is what the platform bridges to the host bar) plus a
// sessionStorage guard, so a reload or a lingering host-bar param can never re-import.
const INBOUND_FETCH_MS = 15000;
const INBOUND_MAX_COMPRESSED = 8 * 1024 * 1024;
const INBOUND_MAX_DECOMPRESSED = 16 * 1024 * 1024;

function stripInboundParam() {
  try {
    const u = new URL(window.location.href);
    if (!u.searchParams.has(INBOUND_PARAM)) return;
    u.searchParams.delete(INBOUND_PARAM);
    history.replaceState(history.state, "", u.pathname + u.search + u.hash);
  } catch (e) {}
}

async function fetchInboundWorld(token) {
  const url = inboundFileUrl(token);
  if (!url) throw new Error("That share link doesn't name a valid file.");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), INBOUND_FETCH_MS);
  let res;
  try {
    res = await fetch(url, { signal: ctrl.signal });
  } catch (e) {
    throw new Error("Couldn't reach the shared file — check your connection and try opening the link again.");
  } finally {
    clearTimeout(timer);
  }
  if (!res || !res.ok) throw new Error("The shared file is no longer available (it may have expired) — ask the sender to share it again.");
  const buf = await res.arrayBuffer();
  if (buf.byteLength > INBOUND_MAX_COMPRESSED) throw new Error("That shared file is too big to import.");
  let bytes = new Uint8Array(buf);
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    try {
      const out = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
      bytes = new Uint8Array(out);
    } catch (e) {
      throw new Error("That shared file couldn't be unzipped.");
    }
  }
  if (bytes.length > INBOUND_MAX_DECOMPRESSED) throw new Error("That shared file is too big to import.");
  try {
    return new TextDecoder().decode(bytes);
  } catch (e) {
    throw new Error("That shared file isn't readable text.");
  }
}

async function checkInboundShare() {
  let ref = null;
  try { ref = inboundReferenceFromSearch(); } catch (e) { ref = null; }
  if (!ref) return;
  stripInboundParam(); // consume-once: the fetch below can take a while; never read this twice
  const seenKey = "mno.inbound." + ref.token;
  try {
    if (window.sessionStorage && sessionStorage.getItem(seenKey)) return;
  } catch (e) {}
  try {
    notify("Receiving shared world" + (ref.name ? ` “${ref.name}”` : "") + "…");
    const text = await fetchInboundWorld(ref.token);
    await importWorldText(text);
  } catch (err) {
    await ConfirmPopup.open({ title: "World import failed", message: (err && err.message) || "Import failed.", confirmText: "OK" });
  } finally {
    try { if (window.sessionStorage) sessionStorage.setItem(seenKey, "1"); } catch (e) {}
  }
}
export { loadTemplateCatalog, chooseScenarioTemplateAI, runScenarioImportPanel, importWorldFile, importWorldText, checkInboundShare };
