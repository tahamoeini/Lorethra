// search-bar.js — the one toolbar both card pages wear (Worlds and Explore): a search field with a
// drawn magnifier and its own ✕, the ⚙ Filters disclosure (with a count badge), the ⇅ sort disclosure
// and the ⊘ NSFW switch. Everything page-specific is a callback — the sort options, the filter panel's
// own body, the badge count — so the chrome, the popover plumbing and the phone fit test exist once
// (README §6.10 for Worlds, §6.11 for Explore).
//
// The ⊘ NSFW switch is the one control the bar owns PREFERENCE-side too, because every card page asks
// the same question with it — "may adult worlds exist in this list?" — and it would be wrong for Worlds
// and Explore to answer differently. `showNsfw()` / `setShowNsfw()` below are the single per-device
// answer (Worlds' library, Explore's catalog and the world picker all read it), so the switch is
// consistent across pages by construction.
//
// The panels are absolutely positioned inside `.hm-searchbar`'s box (the bar is their containing
// block); only one may be open at a time. The three global listeners that close the open panel live
// HERE rather than per mount, so a page visit never accumulates document listeners — each mount makes
// fresh panels and apis, and those die with the page DOM.

// One preference per browser, not per world/session/identity: whether adult worlds are visible at all.
// Off by default, so a first-time visitor never meets adult content by surprise. localStorage (rather
// than the kv store) because the switch reads it synchronously while it is being built, and a switch
// should paint its real state on the first frame. Included in the data-center backup (backup.js).
const NSFW_PREF_KEY = "mno.showNsfw";
const hasNsfwPref = () => {
  try { return localStorage.getItem(NSFW_PREF_KEY) !== null; } catch (e) { return true; }
};
export function showNsfw() {
  try { return localStorage.getItem(NSFW_PREF_KEY) === "1"; } catch (e) { return false; }
}
export function setShowNsfw(on) {
  try { localStorage.setItem(NSFW_PREF_KEY, on ? "1" : "0"); } catch (e) {}
  // Tavern world cards censor themselves while this is off — tell any open
  // Tavern/world thread to repaint (same-tab `storage` never fires, so the
  // event carries it; other tabs get the native `storage` event too).
  try { window.dispatchEvent(new Event("mno:nsfw")); } catch (e) {}
}
// One-time adoption of a legacy copy of this preference, from when Explore kept a `showNsfw` of its
// own inside its reader settings. Honoured only if this browser has never made a choice here, so a
// stale stored `true` can never override a reader who has since turned the switch off.
export function adoptStoredNsfw(v) {
  if (v && !hasNsfwPref()) setShowNsfw(true);
}


import { ICON_SEARCH, ICON_FUNNEL, ICON_SORT } from "./icons.js";
export { ICON_SEARCH, ICON_FUNNEL, ICON_SORT };

// Quotes MUST be escaped too: this `esc` feeds quoted attributes (title="…") below — an unescaped
// `"` closes the attribute early and spills text into the element (stored XSS).
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let openPop = null; // the open toolbar popover's api, if any
export function closeSearchPop() {
  if (openPop) openPop.close();
}
document.addEventListener("click", (e) => {
  if (openPop && !e.target.closest(".hm-pop") && !e.target.closest(".hm-popbtn")) closeSearchPop();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSearchPop(); });
window.addEventListener("resize", () => { if (openPop) openPop.place(); });

// Every bar on screen, so a viewport change re-decides whether the labels fit (the phone breakpoint is a
// width, and rotating a phone or dragging a window crosses it without any render happening). Bars whose
// page has since been unmounted are dropped here rather than needing a teardown call.
const mountedBars = new Set();
window.addEventListener("resize", () => {
  for (const b of mountedBars) {
    if (!b.el.isConnected) { mountedBars.delete(b); continue; }
    b.fit();
  }
});

// 200 ms debounced search box (README §6.10 — search must not rebuild the list per keystroke).
export function searchControl(value, placeholder, onInput) {
  const inp = document.createElement("input");
  inp.type = "search";
  inp.className = "hm-search";
  inp.placeholder = placeholder;
  inp.autocomplete = "off";
  inp.value = value;
  let t = null;
  inp.oninput = () => { clearTimeout(t); t = setTimeout(() => onInput(inp.value.trim()), 200); };
  return inp;
}

// Wire one button to one panel. The panel is absolutely positioned in `host`'s padding box (the bar),
// so it needs `host { position: relative }`; it is clamped to the host's width on the way in, and (a
// panel opens DOWNWARD) its height is clamped to the room left below it — on a short screen the
// scrolling body takes the loss and the footer stays where it can be reached.
function anchoredPopover(host, btn, panel, beforeOpen) {
  const place = () => {
    const hb = host.getBoundingClientRect();
    const bb = btn.getBoundingClientRect();
    const w = panel.offsetWidth;
    let left = bb.left - hb.left;
    if (left + w > host.clientWidth) left = bb.right - hb.left - w;
    panel.style.left = Math.round(Math.max(0, Math.min(left, host.clientWidth - w))) + "px";
    panel.style.top = Math.round(bb.bottom - hb.top + 8) + "px";
    panel.style.maxHeight = "";
    const room = window.innerHeight - panel.getBoundingClientRect().top - 12;
    if (room < panel.offsetHeight) panel.style.maxHeight = Math.max(170, Math.round(room)) + "px";
  };
  const api = {
    place,
    close: () => {
      if (openPop === api) openPop = null;
      if (panel.hidden) return;
      panel.hidden = true;
      btn.classList.remove("on");
      btn.setAttribute("aria-expanded", "false");
    },
    open: () => {
      if (openPop && openPop !== api) openPop.close();
      if (beforeOpen) beforeOpen();
      panel.hidden = false;
      btn.classList.add("on");
      btn.setAttribute("aria-expanded", "true");
      place();
      openPop = api;
    },
    toggle: () => (panel.hidden ? api.open() : api.close()),
    isOpen: () => !panel.hidden
  };
  btn.onclick = (e) => { e.stopPropagation(); api.toggle(); };
  panel.addEventListener("click", (e) => e.stopPropagation());
  return api;
}

// One labelled switch (`.ui-sw`): the markup and its paint, no opinion about what the preference is
// or where it lives — `on`/`set` are the caller's (Adventures persists its own group-by-world, and the
// Settings panel's toggles are built from it too). `danger` paints the ON
// state red, the app's one adult-content look; `plain` keeps the label in sentence case instead of the
// `.ui-sw` default of small-caps (a switch whose label is a phrase rather than a badge); `text` is the
// label the switch wears, with `short` used in the phone fit test below when the labelled row has no room.
export function switchEl({ on, set, onChange, text, short, danger, plain, titleOn, titleOff }) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ui-sw" + (danger ? " sw-danger" : "") + (plain ? " sw-plain" : "");
  btn.setAttribute("role", "switch");
  btn.innerHTML = '<span class="sw-track"><span class="sw-knob"></span></span><span class="sw-text"></span>';
  const label = btn.querySelector(".sw-text");
  label.textContent = text;
  const paint = () => {
    const isOn = !!on();
    btn.classList.toggle("on", isOn);
    btn.setAttribute("aria-checked", String(isOn));
    if (titleOn || titleOff) btn.title = isOn ? (titleOn || "") : (titleOff || "");
  };
  paint();
  btn.onclick = () => { set(!on()); paint(); onChange && onChange(); };
  return { el: btn, paint, setLabel: (s) => { label.textContent = s; } };
}

// Build the bar. Every part is optional: pass `sort` for the sort disclosure, `filters` for the ⚙
// panel, `toggles` for labelled switches of the page's own, `nsfw` for the ⊘ switch. Returns the element
// plus the handles a page needs to keep it honest — `refresh()` repaints the label + badge + switches and
// re-renders whichever panel is open.
//
//   query/onQuery                 the search field's value and its (already debounced) handler
//   sort {options,value,onPick}   options are `{id,label}`; `value()` returns the current id; the
//                                 button always names the current order
//   filters {title,count,body,clearAll}
//                                 `count()` feeds the badge; `body(ctn)` renders the panel's own
//                                 sections into the scrolling body; `clearAll` adds the footer link
//   toggles [{label,short,on,set,onChange,titleOn,titleOff,danger,plain}]
//                                 the page's own switches, in order (Adventures' Group by world);
//                                 `short` is the label worn on a phone when the row is tight, `plain`
//                                 keeps the label in sentence case rather than small-caps
//   nsfw {on,set,onChange}        the ⊘ NSFW switch — a `toggles` entry with the red ON state, kept a
//                                 named option because every card page has exactly this one. `on`/`set`
//                                 default to the shared `showNsfw()`/`setShowNsfw()` above; a host that
//                                 ever needs a different source can pass its own.
export function searchBar(opts = {}) {
  const bar = document.createElement("div");
  bar.className = "hm-toolbar hm-wtoolbar hm-searchbar";

  const searchWrap = document.createElement("label");
  searchWrap.className = "hm-searchwrap";
  searchWrap.innerHTML = ICON_SEARCH;
  const input = searchControl(opts.query || "", opts.placeholder || "Search…", opts.onQuery || (() => {}));
  // The field's ✕, at the far end of the box: it clears the search AND re-filters in one click, instead
  // of making you select the text and delete it. It is shown only while there is something to clear, and
  // it must not wait for searchControl's 200ms debounce to appear/disappear — hence its own `input`
  // listener beside the debounced one.
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "hm-searchclear";
  clear.title = "Clear search";
  clear.setAttribute("aria-label", "Clear search");
  clear.textContent = "✕";
  clear.hidden = !input.value;
  clear.onclick = (e) => {
    e.preventDefault();
    input.value = "";
    clear.hidden = true;
    if (opts.onClear) opts.onClear(); else (opts.onQuery || (() => {}))("");
    input.focus();
  };
  input.addEventListener("input", () => { clear.hidden = !input.value; });
  searchWrap.append(input, clear);

  // ⚙ Filters and ⇅ sort share one chrome-less button (`.hm-btn` + `.hm-popbtn`): the badge hangs on
  // the button's top-right CORNER so adding a filter never reflows the bar.
  const mkBtn = (icon, label, title) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "hm-btn hm-popbtn";
    b.title = title;
    b.setAttribute("aria-expanded", "false");
    b.innerHTML = `${icon}<span class="${label}"></span>${label === "hm-btnlabel" ? '<span class="hm-badge" hidden></span>' : ""}<span class="hm-caret">▾</span>`;
    return b;
  };

  let filterBtn = null, filterPop = null, filterBody = null, filterApi = null;
  if (opts.filters) {
    filterBtn = mkBtn(ICON_FUNNEL, "hm-btnlabel", opts.filters.title || "Filter");
    filterBtn.querySelector(".hm-btnlabel").textContent = opts.filters.label || "Filters";
    filterPop = document.createElement("div");
    filterPop.className = "hm-pop";
    filterPop.hidden = true;
    filterPop.innerHTML = `<div class="hm-pbody"></div>${opts.filters.clearAll
      ? '<div class="hm-pfoot"><button class="hm-plink" type="button" data-act="clear">Clear all</button><button class="mini ok" type="button" data-act="done">Done</button></div>'
      : '<div class="hm-pfoot"><button class="mini ok" type="button" data-act="done">Done</button></div>'}`;
    filterBody = filterPop.querySelector(".hm-pbody");
    if (opts.filters.clearAll) filterPop.querySelector('[data-act="clear"]').onclick = () => opts.filters.clearAll();
    filterPop.querySelector('[data-act="done"]').onclick = () => closeSearchPop();
    filterApi = anchoredPopover(bar, filterBtn, filterPop, () => renderFilters());
  }

  let sortBtn = null, sortPop = null, sortSlot = null, sortApi = null, sortLabel = null, sortMaxW = 0;
  if (opts.sort) {
    sortBtn = document.createElement("button");
    sortBtn.type = "button";
    sortBtn.className = "hm-btn hm-popbtn";
    sortBtn.title = opts.sort.title || "Sort";
    sortBtn.setAttribute("aria-expanded", "false");
    sortBtn.innerHTML = `${ICON_SORT}<span class="hm-sortlabel"></span><span class="hm-caret">▾</span>`;
    sortLabel = sortBtn.querySelector(".hm-sortlabel");
    sortPop = document.createElement("div");
    sortPop.className = "hm-pop hm-sortpop";
    sortPop.hidden = true;
    sortPop.innerHTML = '<div class="hm-menulist" data-slot="sort"></div>';
    sortSlot = sortPop.querySelector('[data-slot="sort"]');
    sortApi = anchoredPopover(bar, sortBtn, sortPop, () => renderSortMenu());
  }

  let sw = null;
  if (opts.nsfw) sw = switchEl(Object.assign({
    text: "⊘ NSFW", danger: true,
    on: showNsfw, set: setShowNsfw,
    titleOn: "Hide worlds tagged NSFW",
    titleOff: "Show worlds tagged NSFW (hidden by default)"
  }, opts.nsfw));

  // The page's own switches, in the order given. They sit between the sort button and the ⊘ switch: the
  // disclosures narrow the list, these change how it is shown, and ⊘ NSFW closes the row (it is the one
  // control that decides what EXISTS, so it keeps the far end).
  const toggles = (opts.toggles || []).map((t) => ({
    def: t,
    label: t.label,
    short: t.short || t.label,
    api: switchEl({ on: t.on, set: t.set, onChange: t.onChange, text: t.label, danger: !!t.danger, plain: !!t.plain, titleOn: t.titleOn, titleOff: t.titleOff })
  }));

  bar.append(searchWrap);
  if (filterBtn) bar.append(filterBtn);
  if (sortBtn) bar.append(sortBtn);
  for (const t of toggles) bar.append(t.api.el);
  // Page-specific buttons, if any, close the control row — after the disclosures and the page's own
  // switches, before the ⊘ switch that always owns the far end. Worlds' ⟳ update check is one: it is
  // a thing you DO to the list rather than a way of narrowing it, so it belongs with the controls
  // instead of in the page header (which is for making things). The bar only places them — the
  // caller owns their markup, behaviour and tooltip.
  const actions = (opts.actions || []).filter(Boolean);
  for (const a of actions) bar.append(a);
  if (sw) bar.append(sw.el);
  if (filterPop) bar.append(filterPop);
  if (sortPop) bar.append(sortPop);

  function renderFilters() {
    if (!filterBody) return;
    filterBody.innerHTML = "";
    opts.filters.body(filterBody);
  }
  function renderSortMenu() {
    if (!sortSlot) return;
    sortSlot.innerHTML = "";
    const cur = opts.sort.value();
    for (const o of opts.sort.options) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "hm-menurow" + (o.id === cur ? " on" : "");
      b.innerHTML = `<span class="hm-tick">${o.id === cur ? "✓" : ""}</span><span>${esc(o.label)}</span>`;
      b.onclick = () => { closeSearchPop(); opts.sort.onPick(o.id); };
      sortSlot.appendChild(b);
    }
  }

  // On a phone the bar is two rows (see the ≤640px block in styles.css), and the disclosures keep their
  // desktop labels down there while the row has room — the search field takes a line of its own and the
  // controls answer it centred beneath. Whether the labels fit is MEASURED rather than breakpointed: the
  // widest control is a word ("Most adventures" is ~60px wider than "Oldest", and how wide that renders
  // depends on the device's font). The sort width is taken from the widest order the button could wear,
  // so the same handset makes the same call whatever order it is showing instead of flipping as you
  // pick a new one.
  const fit = () => {
    bar.classList.remove("hm-iconsonly");
    const setLabels = (short) => { for (const t of toggles) t.api.setLabel(short ? t.short : t.label); };
    setLabels(false);
    if (window.innerWidth > 640) return;
    const avail = bar.clientWidth;
    if (!avail) return; // no layout yet (page not shown) — don't decide from a zero width
    const gap = parseFloat(getComputedStyle(bar).columnGap) || 0;
    if (sortBtn && !sortMaxW) {
      const keep = sortLabel.textContent;
      for (const o of opts.sort.options) { sortLabel.textContent = o.label; sortMaxW = Math.max(sortMaxW, sortBtn.offsetWidth); }
      sortLabel.textContent = keep;
    }
    const need = () => {
      let n = 0, w = 0;
      if (filterBtn) { n += 1; w += filterBtn.offsetWidth; }
      if (sortBtn) { n += 1; w += sortMaxW; }
      for (const t of toggles) { n += 1; w += t.api.el.offsetWidth; }
      for (const a of actions) { n += 1; w += a.offsetWidth; }
      if (sw) { n += 1; w += sw.el.offsetWidth; }
      return w + gap * Math.max(0, n - 1);
    };
    // A few pixels of air at the ends of the row — the widest control otherwise fills a 390px phone
    // exactly edge to edge. Three steps, so words survive as long as they can: the full labels, then the
    // toggles' short labels (Adventures' `Group`), then the disclosures drop to their icons alone.
    if (need() <= avail - 8) return;
    setLabels(true);
    if (need() <= avail - 8) return;
    bar.classList.add("hm-iconsonly");
  };

  const refresh = () => {
    if (sortBtn) sortLabel.textContent = (opts.sort.options.find((o) => o.id === opts.sort.value()) || opts.sort.options[0]).label;
    if (filterBtn) {
      const n = opts.filters.count ? opts.filters.count() : 0;
      const badge = filterBtn.querySelector(".hm-badge");
      badge.hidden = !n;
      badge.textContent = n ? String(n) : "";
    }
    for (const t of toggles) t.api.paint();
    if (filterApi && filterApi.isOpen()) renderFilters();
    if (sortApi && sortApi.isOpen()) renderSortMenu();
    fit();
  };

  const api = { el: bar, input, clear, filterBtn, sortBtn, switchEl: sw ? sw.el : null, switches: toggles.map((t) => t.api.el), refresh, fit, close: closeSearchPop };
  mountedBars.add(api);
  return api;
}
