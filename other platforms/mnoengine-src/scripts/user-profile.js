// user-profile.js — the public user profile page (`#user/<username>`).
// Mounted by main.js like any home page. Reads the catalog (username + worlds) and the public
// bio/avatar through community.js. Editing lives in Settings → Identity; this page only links there.
import { scheduleTagFit } from "./tag-row.js";
import { ICON_REDDIT, ICON_DISCORD, ICON_HEART, ICON_HEART_OUTLINE, ICON_DOWNLOAD } from "./icons.js";

const A = () => window.mnoApp;
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (n) => { n = Number(n) || 0; if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k"; return String(n); };

let mounted = false;
let paneEl = null;
let currentUserId = "";
let loadToken = 0;

function isHexId(s) { return /^[0-9a-f]{16,64}$/i.test(String(s || "").trim()); }
const PLACEHOLDER = "src/images/portrait-placeholder.webp";
const SOCIAL_ORDER = ["reddit", "discord"];
const SOCIAL_TITLES = { reddit: "Reddit", discord: "Discord" };
const SOCIAL_ICONS = {
  reddit: ICON_REDDIT,
  discord: ICON_DISCORD
};
// Icon circles after the bio — one per non-empty value, nothing rendered when all are empty.
// Links open in a new tab; a bare Discord username renders a circle that copies it on click.
function socialsHtml(socials) {
  const items = [];
  for (const k of SOCIAL_ORDER) {
    const url = String((socials && socials[k]) || "").trim();
    if (!url) continue;
    if (/^https:\/\//i.test(url)) {
      items.push(`<a class="up-soc" href="${esc(url)}" target="_blank" rel="noopener" title="${esc(SOCIAL_TITLES[k])}">${SOCIAL_ICONS[k]}</a>`);
    } else if (k === "discord" && !/[\s:]/.test(url)) {
      items.push(`<button class="up-soc up-soc-copy" type="button" data-handle="${esc(url)}" title="Discord: ${esc(url)} — click to copy">${SOCIAL_ICONS[k]}</button>`);
    }
  }
  if (!items.length) return "";
  return `<div class="up-socials">${items.join("")}</div>`;
}
function avatarHtml(username, avatar, userId) {
  if (avatar) return `<img class="up-avatar-img" src="${avatar}" alt="">`;
  return `<img class="up-avatar-img" src="${PLACEHOLDER}" alt="">`;
}
function fmtDate(ts) {
  if (!ts) return "";
  try { return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short" }); } catch (e) { return ""; }
}

export async function mountUserProfile(pane, ctx, initialUserId, fallbackName) {
  mounted = true;
  paneEl = pane;
  if (ctx && ctx.pageEl) {
    const head = ctx.pageEl.querySelector(".hm-head");
    if (head) { head.classList.add("hm-head-empty"); head.setAttribute("aria-hidden", "true"); head.innerHTML = `<div class="hm-bar"></div>`; }
  }
  pane.innerHTML = `<div class="up-page"></div>`;
  await showUserProfile(initialUserId || "", fallbackName || "");
  return () => closeUserProfile();
}

export function closeUserProfile() {
  mounted = false;
  paneEl = null;
  currentUserId = "";
  loadToken++;
}

export async function showUserProfile(target, fallbackName) {
  target = String(target || "").replace(/^@+/, "").trim();
  // Fallback username when the id no longer resolves (stale forkOfUserId on an old remix, …).
  // Ignored when it duplicates the target — a name-only navigation already resolves by name.
  fallbackName = String(fallbackName || "").replace(/^@+/, "").trim();
  if (!fallbackName || fallbackName === target) fallbackName = "";
  const my = loadToken + 1;
  loadToken = my;
  currentUserId = target;
  const scroller = document.getElementById("homeMain");
  if (scroller) scroller.scrollTop = 0;
  if (!mounted || !paneEl) return;
  const page = paneEl.querySelector(".up-page");
  if (!target) {
    page.innerHTML = `<div class="hm-empty"><div class="hm-empty-t">No user selected.</div></div>`;
    return;
  }
  // No loading note here: a cached profile paints below with no flash at all, and only a first-ever
  // visit (no cache) writes the note in the else branch. The pane stays empty for the ~200ms of
  // user resolution either way.
  let comm;
  try { comm = await import("./community.js"); }
  catch (e) { page.innerHTML = `<div class="hm-empty"><div class="hm-empty-t">Couldn't load the community module.</div></div>`; return; }
  // The address names a user by username (`#user/SaucyMans`) or, for old links, by id. A hex-looking
  // name that isn't a claimed id falls back to the name lookup (a 16-20 char hex username is legal).
  // A programmatic navigation (`goUser`) may also carry a username hint alongside the id: when the
  // id lookup misses, the hint is tried before giving up (remix originals recorded under an old id).
  // Bio/avatar ride on the user record itself (server profile slots), so resolving the user already
  // yields the picture + bio — no second profile fetch, no local cache. Every visit reads fresh.
  // Drop the pre-server viewer cache once (best-effort; ignored afterwards).
  try { await comm.dropProfileCache?.(); } catch (e) {}
  let user = null, userId = "";
  // Paint one payload: the reader's live settings — bundled worlds, blocklists, mute state — over
  // it, then the page. Paints when this run still owns the pane and claims it for `uid`. False when
  // a newer navigation has superseded this one.
  const paintPayload = async (uid, p) => {
    uid = String(uid || "");
    let me = "";
    try { if (comm.ensureIdentity) await comm.ensureIdentity(); me = comm.myUserId() || ""; } catch (e) { me = ""; }
    // The cards below read the reader-local liked set synchronously — hydrate it before rendering,
    // otherwise a profile visited before Explore shows every heart as unliked.
    try { if (comm.ensureLiked) await comm.ensureLiked(); } catch (e) {}
    if (!mounted || loadToken !== my || (currentUserId !== uid && currentUserId !== target && currentUserId !== fallbackName)) return false;
    const username = (p.user && p.user.username) || (p.worlds.length && p.worlds[0].authorName) || "";
    if (username && A()) { try { A().syncUserHash(username); } catch (e) {} }
    const claimedAt = (p.user && p.user.claimedAt) || 0;
    const own = !!(me && me.toLowerCase() === uid.toLowerCase());
    let bundled = [];
    try { if (comm.isEngineAuthorId(uid) && A() && A().bundledWorlds) bundled = A().bundledWorlds() || []; }
    catch (e) { bundled = []; }
    // Every profile obeys the reader's content settings, exactly like Explore: blocked tags, muted
    // authors and the Show-NSFW preference filter the world's lists (catalog and bundled alike).
    // Likes and downloads always count every published world, regardless of those filters.
    const likes = (p.worlds || []).reduce((a, w) => a + (Number(w.likes) || 0), 0);
    const downloads = (p.worlds || []).reduce((a, w) => a + (Number(w.downloads) || 0), 0);
    let worlds = (p.worlds || []).slice();
    let f = null, muted = false, hidden = 0;
    try { f = await comm.profileFilter(); } catch (e) { f = null; }
    if (f) {
      muted = f.users.indexOf(uid) !== -1;
      const vis = (r) => comm.profileWorldPasses(r, f);
      const seenCatalog = worlds.length, seenBundled = bundled.length;
      worlds = worlds.filter(vis);
      bundled = bundled.filter((w) => { try { return vis({ userId: uid, tags: (w.meta && w.meta.tags) || [], nsfw: comm.isNsfwMeta(w.meta) }); } catch (e) { return true; } });
      hidden = (seenCatalog - worlds.length) + (seenBundled - bundled.length);
    }
    if (!mounted || loadToken !== my || (currentUserId !== uid && currentUserId !== target && currentUserId !== fallbackName)) return false;
    currentUserId = uid;
    render(page, comm, { userId: uid, username, claimedAt, worlds, likes, downloads, bio: p.bio, avatar: p.avatar, socials: p.socials, own, bundled, muted, hidden });
    return true;
  };
  if (!mounted || loadToken !== my) return;
  page.innerHTML = `<div class="hm-empty"><div class="hm-empty-t"><span class="spin spin-sm"></span> Loading profile…</div></div>`;
  if (!isHexId(target)) {
    try { user = await comm.getUserByName(target); }
    catch (e) {
      if (!mounted || loadToken !== my) return;
      const missing = e && e.code === "not_found";
      page.innerHTML = `<div class="hm-empty"><div class="hm-empty-t">${missing ? `No user named @${esc(target)}.` : `Couldn't reach the community — check your connection, then try again.`}</div></div>`;
      return;
    }
    userId = user.userId;
  } else {
    userId = target;
    try { user = await comm.getProfileUser(userId); } catch (e) { user = null; }
    if (!user) {
      try { user = await comm.getUserByName(target); userId = user.userId; }
      catch (e2) { user = null; }
    }
    if (!user && fallbackName) {
      try { user = await comm.getUserByName(fallbackName); userId = user.userId; }
      catch (e3) { user = null; }
    }
  }
  if (!mounted || loadToken !== my) return;
  currentUserId = userId;
  let worlds = [];
  try { const r = await comm.listAuthorWorlds(userId); worlds = r.worlds; } catch (e) { worlds = []; }
  if (!mounted || loadToken !== my || currentUserId !== userId) return;
  const bio = String((user && user.bio) || "").slice(0, 200);
  const avatar = String((user && user.avatar) || "");
  const socials = (user && user.socials && typeof user.socials === "object") ? user.socials : {};
  if (!user && !worlds.length && !bio && !avatar && !Object.values(socials).some(Boolean)) {
    page.innerHTML = `<div class="hm-empty"><div class="hm-empty-t">${fallbackName ? `No user found with this id (or as @${esc(fallbackName)}).` : `No user found with this id.`}</div></div>`;
    return;
  }
  await paintPayload(userId, { user, worlds, bio, avatar, socials });
}

function render(page, comm, d) {
  const { userId, username, claimedAt, worlds, likes, downloads, bio, avatar, socials, own, bundled, muted, hidden } = d;
  const shipped = (bundled || []).filter(Boolean);
  const shown = worlds.length + shipped.length;
  const hiddenCount = Number(hidden) || 0;
  page.innerHTML = `
    <div class="up-head">
      <div class="up-avatar">${avatarHtml(username, avatar, userId)}</div>
      <div class="up-id">
        <div class="up-name">@${esc(username || "unknown")}</div>
        <div class="up-stats">
          <span class="up-stat" title="Published worlds"><b><span class="w-ic" aria-hidden="true"></span> ${num(shown + hiddenCount)}</b> worlds</span>
          <span class="up-stat" title="Total likes"><b><span class="ex-heart">${ICON_HEART}</span> ${num(likes)}</b> likes</span>
          <span class="up-stat" title="Total downloads"><b><span class="ex-dl">${ICON_DOWNLOAD}</span> ${num(downloads)}</b> downloads</span>
          ${claimedAt ? `<span class="up-stat up-joined" title="Join date">(Joined ${esc(fmtDate(claimedAt))})</span>` : ""}
        </div>
        <div class="up-bio">${bio ? esc(bio) : `<span class="dim">${own ? "You haven't written a bio yet — say a line or two about yourself." : "No bio yet."}</span>`}</div>
        ${socialsHtml(socials)}
        ${muted && !own ? `<div class="up-muted" title="Their worlds are hidden by your content settings">⦸ muted</div>` : ""}
      </div>
      ${own ? `<div class="up-actions">
        <button class="mini up-editprofile" type="button" title="Edit your picture and bio in Settings">✎ Edit profile</button>
      </div>` : `<div class="up-actions">
        <button class="mini up-mute" type="button" title="${muted ? "Unmute this author" : "Hide this author's worlds from Explore"}">${muted ? "⦸ Unmute" : "⦸ Mute"}</button>
      </div>`}
    </div>
    <h3 class="up-listhead">Published worlds (${num(shown)})${hiddenCount ? ` <span class="dim">· ${hiddenCount} hidden by your preferences</span>` : ""}</h3>
    ${worlds.length || shipped.length ? `<div class="ex-grid"></div>` : `<div class="hm-empty"><div class="hm-empty-t">${own ? "You haven't published any worlds yet." : "No published worlds."}</div></div>`}`;
  const grid = page.querySelector(".ex-grid");
  if (worlds.length && grid) {
    for (const rec of worlds) {
      try { grid.appendChild(comm.exCard(rec)); } catch (e) {}
    }
    try { scheduleTagFit(); } catch (e) {}
    try { comm.paintLibraryBadges(grid, worlds); } catch (e) {}
  }
  if (shipped.length && grid && A() && A().bundledWorldCard) {
    for (const w of shipped) {
      try { grid.appendChild(A().bundledWorldCard(w)); } catch (e) {}
    }
  }
  if (own) page.querySelector(".up-editprofile").onclick = () => A().openSettingsPanel("identity");
  const muteBtn = page.querySelector(".up-mute");
  if (muteBtn) muteBtn.onclick = async () => {
    muteBtn.disabled = true;
    try {
      const next = await comm.setUserMuted(userId, username, !muted);
      A().notify(next ? `⦸ Muted @${username || "unknown"} — their worlds are now hidden.` : `Unmuted @${username || "unknown"}.`);
    } catch (e) { A().notify("✖ " + (e.message || e)); }
    showUserProfile(currentUserId);
  };
  page.querySelectorAll(".up-soc-copy").forEach((b) => {
    b.onclick = () => {
      const h = b.dataset.handle || "";
      if (comm && comm.copyText) comm.copyText(h, { okMsg: "📋 Discord username copied: " + h, title: "Discord username" });
    };
  });
}
