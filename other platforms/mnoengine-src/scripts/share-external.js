// Share a world file to third-party libraries (e.g. the Unseen Scribe Library).
//
// The ⋮ menu on a Worlds card has a `Share (External)` entry (above Delete) that opens a
// destination picker; each destination builds a link out of a freshly uploaded
// `.gz` of the world file. Only the destinations listed in SHARE_DESTINATIONS
// are offered, so adding a second library later is one array entry plus one
// branch in `startShare`.
//
// Unseen Scribe Library contract (per their PARTNER-HANDOFF spec):
//   https://perchance.org/unseen-scribe-library?data=<name>~<32hex>.gz
//     &sourceTool=mnoengine&sourceUrl=https%3A%2F%2Fperchance.org%2Fmnoengine
// `<name>` is a cosmetic display prefix (whitespace → `_`, `~` stripped, then
// percent-encoded); the token is the bare upload-plugin filename
// (`https://user.uploads.dev/file/<token>`), which must match
// /^[0-9a-f]{32}\.gz$/. The gzip blob MUST be uploaded with an explicit
// `application/gzip` type — that is what makes the host hand back a `.gz`
// name (see ai-character-chat-extended's `compressBlobWithGzip`).

import { loadWorld, worldToFile } from "./world.js";

// Destinations offered by the Share picker, in order. `id` is internal;
// `name` is the button label and `icon` the button's icon (a shipped
// src/images/ asset, so the button never depends on a third party staying up).
// `uploadExpiresInMs` is per-destination: how long the handoff `.gz` needs to
// live on the file host (passed as the upload plugin's `expires` epoch). Omit
// it for a permanent upload. A short expiry also buys a much bigger size/quota
// allowance (≤24h → 400x), which is what lets big worlds through.
export const SHARE_DESTINATIONS = [
  {
    id: "unseen-scribe",
    name: "Unseen Scribe Library",
    icon: "src/images/unseen-scribe.webp",
    url: "https://perchance.org/unseen-scribe-library",
    // The Library converts the world into its own format when the link is
    // reviewed/published, so the handoff blob only needs to survive the trip
    // there — a 1-hour temporary upload, not a permanent file.
    uploadExpiresInMs: 60 * 60 * 1000,
  },
];

export const UNSSEEN_SCRIBE_URL = "https://perchance.org/unseen-scribe-library";
export const SOURCE_TOOL_ID = "mnoengine";
export const SOURCE_TOOL_URL = "https://perchance.org/mnoengine";
const TOKEN_RE = /^[0-9a-f]{32}\.gz$/;

// Cosmetic display prefix, exactly the way Extended's own share-link producer
// does it (whitespace → `_`, `~` stripped). The receiver splits on the LAST
// `~` and never parses the prefix, but keeping `~` out guarantees the token
// stays the final segment.
export function shareNamePart(title) {
  const part = String(title || "world").replace(/\s+/g, "_").replaceAll("~", "").trim().slice(0, 80);
  return part || "world";
}

// Pure URL builder (no network) so the shape is unit-testable: title + the
// bare upload filename → the full Library handoff URL.
export function buildUnseenScribeUrl(title, token) {
  const file = String(token || "").trim();
  if (!TOKEN_RE.test(file)) throw new Error("That upload didn't return a sharing file (expected a .gz name).");
  return `${UNSSEEN_SCRIBE_URL}?data=${encodeURIComponent(shareNamePart(title))}~${file}`
    + `&sourceTool=${SOURCE_TOOL_ID}&sourceUrl=${encodeURIComponent(SOURCE_TOOL_URL)}`;
}

function gzipAvailable() {
  return typeof CompressionStream === "function";
}

async function gzipWorldText(text) {
  const plain = await fetch("data:text/plain;charset=utf-8," + text.replace(/#/g, "%23")).then((r) => r.blob());
  const out = await new Response(plain.stream().pipeThrough(new CompressionStream("gzip"))).blob();
  // The explicit type is load-bearing: it is what makes the upload host hand
  // back a `<32hex>.gz` filename instead of some other extension.
  return new Blob([out], { type: "application/gzip" });
}

function busyError(code) {
  const c = String(code || "").toLowerCase();
  return (c.indexOf("another") !== -1 && c.indexOf("progress") !== -1)
    || (c.indexOf("already") !== -1 && c.indexOf("upload") !== -1)
    || c === "upload_in_progress" || c === "busy" || c === "rate_limited";
}

function friendlyUploadError(code) {
  const c = String(code || "failed").replaceAll("_", " ");
  if (busyError(code)) return "Another upload is still finishing — wait a few seconds and try again. Your world is safe on this device.";
  if (code === "file_too_big" || code === "over_daily_allowance") return `That upload was refused (${c}) — try again tomorrow, or share a smaller world.`;
  if (code === "disallowed_content") return "That upload was refused by the file host's content filter (disallowed content). If you believe this is a mistake, check the world's text for anything that reads as disallowed and try again. Your world is safe on this device.";
  return `Couldn't upload the world file (${c}) — check your connection and try again. Your world is safe on this device.`;
}

// One upload through the platform plugin, retrying the host's "another upload
// in progress" lock like the community publish path does. `dest` is the
// SHARE_DESTINATIONS entry: when it sets `uploadExpiresInMs` the blob goes up
// as a temporary file expiring that far in the future, otherwise permanent.
async function uploadGzip(blob, dest) {
  const expiresIn = dest && Number(dest.uploadExpiresInMs);
  const opts = Number.isFinite(expiresIn) && expiresIn > 0 ? { expires: Date.now() + expiresIn } : undefined;
  for (let attempt = 1; ; attempt++) {
    const r = await window.uploadPlugin(blob, opts);
    if (r && !r.error) return String(r.url || "");
    const code = String((r && r.error) || "failed");
    if (busyError(code) && attempt < 6) {
      await new Promise((res) => setTimeout(res, 700 * attempt + Math.random() * 400));
      continue;
    }
    throw new Error(friendlyUploadError(code));
  }
}

// Destination picker + upload + handoff link, all in one overlay. `loadFile`
// is the card's own file loader (it returns the world in file form).
// `opts.onPublish` runs the engine's own publish flow for the world (the card
// wires the exact same call its ⋮ → Publish entry makes, so the two are one
// flow, not two).
export async function openSharePanel(meta, loadFile, opts = {}) {
  const A = window.mnoApp;
  const esc = A.esc;
  const title = (meta && meta.name) || "world";
  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";
  overlay.innerHTML = `
    <div class="popup" tabindex="-1">
      <div class="popup-head"><span class="popup-title">Share to external library</span><button class="popup-x" title="Close">✕</button></div>
      <div class="share-body" style="padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;">
        <div class="share-pick">
          <div class="share-note">Share your world “<b>${esc(title)}</b>” with a third-party library. It may not play 1:1 in other generators — stats, trackers and mechanics can work differently there. Make sure you have the right to share this world.</div>
          <div class="share-sep"></div>
          <div class="share-pick-label">Supported Libraries</div>
          ${SHARE_DESTINATIONS.map((d) => `
            <button class="btn share-dest" data-dest="${esc(d.id)}"><img class="share-dest-ic" src="${esc(d.icon)}" alt="">${esc(d.name)}</button>`).join("")}
          ${opts.onPublish ? `
          <div class="share-sep"></div>
          <div class="share-pick-label">MNO Engine</div>
          <div class="share-note">If you meant to publish this world in this engine instead.</div>
          <button class="btn share-dest" data-publish>🌐 Publish in this engine</button>` : ""}
        </div>
        <div class="share-work" hidden></div>
      </div>
      <div class="popup-acts"><button class="mini share-cancel">Cancel</button></div>
    </div>`;
  document.body.appendChild(overlay);
  const release = A.pushBackClose(() => close());
  let closed = false;
  const close = () => { if (closed) return; closed = true; release(); overlay.remove(); };
  overlay.querySelector(".popup-x").onclick = close;
  overlay.querySelector(".share-cancel").onclick = close;
  overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
  overlay.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  overlay.querySelector(".popup").focus();

  const pickEl = overlay.querySelector(".share-pick");
  const workEl = overlay.querySelector(".share-work");

  overlay.querySelectorAll("[data-dest]").forEach((btn) => {
    btn.onclick = () => startShare(btn.dataset.dest);
  });
  // The engine's own publish flow, offered at the bottom for a player who
  // opened Share but really wants the world in this engine's Explore. It closes
  // this panel first and then runs the caller's flow — the same one the card's
  // own ⋮ → Publish entry runs.
  const pubBtn = overlay.querySelector("[data-publish]");
  if (pubBtn) pubBtn.onclick = async () => { close(); if (opts.onPublish) await opts.onPublish(); };

  async function startShare(destId) {
    const dest = SHARE_DESTINATIONS.find((d) => d.id === destId);
    if (!dest) return;
    if (dest.id !== "unseen-scribe") return;
    pickEl.hidden = true;
    workEl.hidden = false;
    workEl.innerHTML = `<div style="display: flex; align-items: center; gap: 8px;"><span class="spin spin-sm"></span><span>Preparing “${esc(title)}”…</span></div>`;
    const say = (msg) => {
      const span = workEl.querySelector("span:last-child");
      if (span) span.textContent = msg;
    };
    try {
      if (!gzipAvailable()) throw new Error("Sharing needs a modern browser with gzip support — please update your browser and try again.");
      if (typeof window.uploadPlugin !== "function") throw new Error("The upload service isn't ready — try again in a moment.");
      say("Reading world…");
      const fileForm = await loadFile();
      if (!fileForm) throw new Error("That world isn't in your local library any more.");
      // Canonicalize through the loader so a shared world always loads (the
      // same guarantee the community publish path makes).
      let jsonText;
      try {
        const { world, errors } = loadWorld(JSON.stringify(fileForm));
        if (!world) throw new Error(errors && errors[0] ? errors[0] : "unknown error");
        jsonText = JSON.stringify(worldToFile(world), null, 2);
      } catch (e) {
        throw new Error("This world file doesn't load: " + (e.message || e));
      }
      say("Compressing world…");
      const blob = await gzipWorldText(jsonText);
      say(`Uploading world (${blob.size < 1024 ? blob.size + " B" : blob.size < 1048576 ? (blob.size / 1024).toFixed(1) + " KB" : (blob.size / 1048576).toFixed(1) + " MB"})…`);
      const url = await uploadGzip(blob, dest);
      const token = String(url || "").split("?")[0].split("/").pop() || "";
      const link = buildUnseenScribeUrl(title, token);
      workEl.innerHTML = `
        <div style="opacity: .75;">Your world is ready to send. Opening the link lands in the Unseen Scribe Library's review step — nothing publishes automatically.</div>`;
      // User-gesture opens only: a post-await window.open outside a click is
      // refused by the popup blocker, so the link opens from the footer's
      // own button (which replaces Cancel on success).
      const doneBtn = overlay.querySelector(".share-cancel");
      doneBtn.textContent = "Open in Library ↗";
      doneBtn.classList.add("ok");
      doneBtn.onclick = () => { window.open(link, "_blank", "noopener"); close(); };
    } catch (e) {
      workEl.innerHTML = `<div>✖ ${esc(e && e.message ? e.message : String(e))}</div>`;
      overlay.querySelector(".share-cancel").textContent = "Close";
    }
  }
}
