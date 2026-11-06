// Page helpers — shared stateless builders for the card collection pages.
//
// renderIncremental (chunked list rendering), flipFilter (three-valued filter toggle),
// emptyStateEl / optionEl / renderActivePills (filter UI pieces). Used by the Worlds and
// Adventures pages in main.js (emptyStateEl is also exposed via `mnoApp`). Pure DOM + local
// esc — no app state, no imports.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- shared page pieces (toolbars, incremental rendering) ---------- */
// Incremental renderer shared by every collection page: append `chunk` items, then append the next
// chunk when `scroller` comes within ~400px of its bottom, or via a visible "Show more" button
// (the fallback — e.g. during a momentum scroll or a short viewport). Deliberately a plain scroll
// listener: IntersectionObserver is unreliable in the preview iframe (README §6.10).
// Returns release(): call it when the page unmounts or the list is rebuilt.
function renderIncremental(scroller, ctn, builders, { chunk = 24, moreLabel = "Show more" } = {}) {
  ctn.innerHTML = "";
  if (!builders.length) return () => {};
  let shown = 0;
  let detached = false;
  const more = document.createElement("button");
  more.type = "button";
  more.className = "btn hm-more";
  const detach = () => { if (detached) return; detached = true; scroller.removeEventListener("scroll", onScroll); };
  const step = () => {
    if (detached) return;
    const end = Math.min(shown + chunk, builders.length);
    const frag = document.createDocumentFragment();
    for (let k = shown; k < end; k++) {
      try { const n = builders[k](); if (n) frag.appendChild(n); }
      catch (e) { console.warn("[home] item build failed", e); }
    }
    ctn.insertBefore(frag, more);
    shown = end;
    const left = builders.length - shown;
    if (left) more.textContent = `${moreLabel} (${left})`;
    else { more.remove(); detach(); }
  };
  const onScroll = () => { if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 400) step(); };
  more.onclick = step;
  ctn.appendChild(more);
  scroller.addEventListener("scroll", onScroll, { passive: true });
  step();
  return detach;
}
// One filter value in the ⚙ panel is three-valued: clicking the value REQUIRES it, clicking the ✕ on its
// right EXCLUDES it, and the two sides are mutually exclusive per value (a value can never be both).
function flipFilter(list, other, v) {
  const i = other.indexOf(v);
  if (i >= 0) other.splice(i, 1);
  const j = list.indexOf(v);
  if (j >= 0) list.splice(j, 1); else list.push(v);
}
// A page's "nothing here" block: an optional mark (a `currentColor` mask, or an emoji for pages that
// haven't got an icon of their own) over one plain line of text, and — only when the caller passes
// `acts` — the row of actions offered underneath. It sits directly ON the page background: no fill and
// no dashed box, because an empty grid is an ordinary state, not a warning (README §6.10).
function emptyStateEl(icon, text, acts) {
  const el = document.createElement("div");
  el.className = "hm-empty";
  el.innerHTML = `${icon ? `<div class="hm-empty-ic">${icon}</div>` : ""}<div class="hm-empty-t">${esc(text)}</div>`;
  if (!acts || !acts.length) return el;
  const box = document.createElement("div");
  box.className = "hm-empty-acts";
  el.appendChild(box);
  for (const a of acts) {
    let node;
    if (a.file) {
      node = document.createElement("label");
      node.className = "mini filebtn";
      node.innerHTML = `${esc(a.label)}<input type="file" accept="${esc(a.accept || "")}" hidden>`;
      node.querySelector("input").onchange = (e) => a.onPick(e.target.files[0], e.target);
    } else {
      node = document.createElement("button");
      node.type = "button";
      node.className = "mini" + (a.primary ? " ok" : "");
      node.textContent = a.label;
      node.onclick = a.onPick;
    }
    box.appendChild(node);
  }
  return el;
}
/* ---------- shared card-page filter bits (Worlds + Adventures) ---------- */

// One entry in a ⚙ Filters panel: the value on the left (click = REQUIRE it) and an ✕ on its right
// (click = EXCLUDE it). The wrapper paints the state, so the pair reads as one chip: nothing, `.on`
// (required — the accent chip) or `.ex` (excluded — dashed, struck through and red). `extra` is the
// marker's own tint for a special entry (the two special tags), which `.ex` overrides when it applies.
// `icon` is optional markup that leads the label (a page mark — see `WORLD_SOURCES`); `label` is always
// escaped and is what the chip's tooltips are built from, so it stays plain text.
function optionEl(label, count, state, onMain, onX, tips, extra = "", icon = "") {
  const el = document.createElement("span");
  el.className = "hm-popt" + (state === "on" ? " on" : state === "ex" ? " ex" : "") + extra;
  const main = document.createElement("button");
  main.type = "button";
  main.className = "hm-opt-main";
  main.title = state === "on" ? "Remove this requirement" : tips.main;
  main.innerHTML = `${icon}<span class="hm-opt-lb">${esc(label)}</span>${count ? `<span class="hm-tag-n">${count}</span>` : ""}`;
  main.onclick = onMain;
  const x = document.createElement("button");
  x.type = "button";
  x.className = "hm-opt-x";
  x.title = state === "ex" ? "Remove this exclusion" : tips.x;
  x.setAttribute("aria-label", x.title);
  x.textContent = "✕";
  x.onclick = onX;
  el.append(main, x);
  return el;
}

// The applied filters, as removable pills under a toolbar (`entries` = `{ label, excluded, remove }`,
// plus an optional `icon` markup mark that leads the label, in the order they should read). An EXCLUDED
// one says so in its own way — ⊘, struck through, in red — since a plain `nsfw` beside `✕ nsfw` would
// read alike in a row of otherwise identical pills. `onClear` adds the trailing `Clear all` link; pass
// null when there is nothing to clear (the row then hides itself). `label` is escaped, as everywhere.
function renderActivePills(barEl, entries, onClear) {
  barEl.innerHTML = "";
  barEl.hidden = !entries.length;
  if (!entries.length) return;
  for (const e of entries) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "hm-apill" + (e.excluded ? " hm-apill-ex" : "");
    b.title = e.excluded ? "Stop excluding this" : "Remove this filter";
    b.innerHTML = e.excluded
      ? `<span class="hm-strike">⊘ ${e.icon || ""}${esc(e.label)}</span> <span class="hm-x">✕</span>`
      : `${e.icon || ""}${esc(e.label)} <span class="hm-x">✕</span>`;
    b.onclick = e.remove;
    barEl.appendChild(b);
  }
  if (!onClear) return;
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "hm-plink";
  clear.textContent = "Clear all";
  clear.onclick = onClear;
  barEl.appendChild(clear);
}

export { renderIncremental, flipFilter, emptyStateEl, optionEl, renderActivePills };