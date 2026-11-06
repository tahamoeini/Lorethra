// ============================================================================
// 🆕 WHAT'S NEW (dragon-whatsnew) — Egon 25.09.2026 (W-EFOR282)
// ----------------------------------------------------------------------------
// Egon's brief (verbatim, 25.09.2026): "what's new" as part of the same work as the interactive popup and
// the admin report.
//
// WHAT IT IS: a small card that tells the visitor what changed *just now* — nothing older than TODAY and
// YESTERDAY. It is deliberately NOT a menu entry and NOT a badge: it never appears in the navbar, and it
// never counts as an unread marker. Instead, the first time the visitor MOVES somewhere on the site (a
// navbar button), the card appears over the page he asked for, lists those one or two days of updates, and
// then spends itself — once, ever, per browser.
//
// WHERE THE NOTES COME FROM: the SAME hand-maintained block the Update Notes feed uses — the
// `[U<number>] dd.mm.yyyy | Title | Text` lines inside the HTML comment near the top of index.html. This
// module does NOT keep its own list: it walks the document's comment nodes exactly like dexa-news.js does,
// so there is one place where updates are written and no second list to forget.
//
// ONCE MEANS ONCE: `localStorage.dragonWhatsNewSeen` holds the highest note number already shown. A NEW
// note (a higher number) arms the card again; nothing else does. So a returning visitor who missed five
// updates does not get five cards, and a visitor who has seen the newest note is never interrupted again
// until something new is written. A first-time visitor is not shown anything at all unless a note is
// dated today or yesterday AND he navigates somewhere — and even then the card is what tells him there is
// a site here that keeps improving.
//
// Exposed on `window`:
//   dragonWhatsNewShow()          show the card now (the first press of a navbar button does this by itself)
//   dragonWhatsNewClose()         close it (marks the notes as seen)
//   dragonWhatsNewNotes()         the eligible notes right now (today + yesterday)
//   dragonWhatsNewState()         what this module is doing right now (the check-up reads this)
// ============================================================================
(function () {
  var LS_SEEN = "dragonWhatsNewSeen";
  var MAX_ROWS = 6;

  var card = null;         // the element on screen right now
  var laneHeld = false;
  var shownCount = 0, lastShownAt = 0;
  var notes = [];          // every note read from the document, newest number first
  var eligible = [];       // the ones dated today or yesterday

  function say(m) { try { console.warn("dragon-whatsnew: " + m); } catch (e) {} }
  function el(tag, cls, txt) { var d = document.createElement(tag); if (cls) d.className = cls; if (txt != null) d.textContent = txt; return d; }
  function seenValue() {
    var v = null;
    try { v = localStorage[LS_SEEN]; } catch (e) {}
    if (v == null || String(v).trim() === "") return null;
    var n = parseInt(v, 10);
    return isFinite(n) ? n : null;
  }
  function markSeen() {
    if (!notes.length) return;
    var top = notes[0].n;
    var cur = seenValue();
    if (cur == null || cur < top) { try { localStorage[LS_SEEN] = String(top); } catch (e) {} }
  }
  function visible() {
    try { if (document.visibilityState && document.visibilityState !== "visible") return false; } catch (e) {}
    return true;
  }
  function d2(n) { return (n < 10 ? "0" : "") + n; }
  function dayKey(d) { return d2(d.getDate()) + "." + d2(d.getMonth() + 1) + "." + d.getFullYear(); }

  // ---- read the notes ---------------------------------------------------------------------------------
  // The very same block the Update Notes feed reads (see src/dexa-news.js). One regex, one source.
  function readNotes() {
    var items = [], seen = {};
    try {
      var w = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_COMMENT, null, false);
      while (w.nextNode()) {
        var lines = (w.currentNode.data || "").split("\n");
        for (var i = 0; i < lines.length; i++) {
          var m = lines[i].match(/^\s*\[U(\d+)\]\s+(\d{2}\.\d{2}\.\d{4})\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*$/);
          if (!m) continue;
          var num = parseInt(m[1], 10);
          if (seen[num]) continue;
          seen[num] = 1;
          items.push({ n: num, date: m[2], title: m[3].trim(), text: m[4].trim() });
        }
      }
    } catch (e) { say("could not read the update notes: " + e); }
    items.sort(function (a, b) { return b.n - a.n; });
    return items;
  }
  function refresh() {
    notes = readNotes();
    var today = new Date();
    var yest = new Date(Date.now() - 86400000);
    var want = {};
    want[dayKey(today)] = 1;
    want[dayKey(yest)] = 1;
    eligible = notes.filter(function (i) { return want[i.date]; });
    return eligible;
  }
  window.dragonWhatsNewNotes = function () { refresh(); return eligible.slice(0, MAX_ROWS); };
  // How many notes are dated today or yesterday RIGHT NOW — the full number, not the few the card draws
  // (the card clamps itself to MAX_ROWS and offers "See all update notes" for the rest).
  window.dragonWhatsNewEligible = function () { refresh(); return eligible.length; };

  // ---- the card ---------------------------------------------------------------------------------------
  function ensureCss() {
    if (document.getElementById("dragonWhatsNewCss")) return;
    var st = document.createElement("style");
    st.id = "dragonWhatsNewCss";
    st.textContent = [
      ".dragon-wn-ov{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.42);display:flex;align-items:flex-start;justify-content:center;padding:min(12vh,6rem) .6rem .6rem;box-sizing:border-box;font-family:system-ui,sans-serif;}",
      ".dragon-wn{width:min(560px,calc(100vw - 20px));max-height:76vh;overflow:auto;box-sizing:border-box;background:#16161d;color:#eee;border:1px solid #7a5ad0;border-radius:13px;box-shadow:0 20px 55px rgba(0,0,0,.85);padding:.85rem .95rem .95rem;text-align:left;}",
      ".dragon-wn-h{display:flex;align-items:center;gap:.45rem;font-weight:800;font-size:.98rem;color:#d8c9ff;margin:0 0 .2rem;}",
      ".dragon-wn-sub{font-size:.72rem;color:#a99fd0;margin:0 0 .6rem;padding:0 0 .5rem;border-bottom:1px solid rgba(155,107,255,.3);}",
      ".dragon-wn-row{padding:.45rem .1rem;border-bottom:1px solid #23232d;}",
      ".dragon-wn-row:last-of-type{border-bottom:0;}",
      ".dragon-wn-t{font-weight:700;font-size:.84rem;color:#ffd76a;margin:0 0 .15rem;}",
      ".dragon-wn-d{font-size:.68rem;color:#a99fd0;font-weight:600;margin-left:.35rem;}",
      ".dragon-wn-x{font-size:.79rem;line-height:1.45;color:#cfc9e6;word-break:break-word;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;}",
      ".dragon-wn-a{display:flex;align-items:center;gap:.5rem;justify-content:flex-end;padding-top:.6rem;}",
      ".dragon-wn-a .dg-btn{white-space:nowrap;}",
      "@media (max-width:560px){.dragon-wn-x{-webkit-line-clamp:5;}}"
    ].join("\n");
    (document.head || document.documentElement).appendChild(st);
  }

  function close(mark) {
    if (!card) return false;
    var c = card;
    card = null;
    try { c.ov.remove(); } catch (e) {}
    try { if (c.onKey) document.removeEventListener("keydown", c.onKey, true); } catch (e) {}
    if (mark !== false && !c.test) markSeen();
    if (laneHeld) { laneHeld = false; try { window.dragonMarquee.release(); } catch (e) {} }
    return true;
  }
  window.dragonWhatsNewClose = function () { return close(true); };
  function build(items, opts) {
    refresh();
    var list = items && items.length ? items : eligible;
    if (!list.length) { say("nothing new in the last two days"); return null; }
    ensureCss();
    try { if (window.dragonUIEnsureCss) window.dragonUIEnsureCss(); } catch (e) {}
    var ov = el("div", "dragon-wn-ov");
    ov.id = "dragonWhatsNewOv";
    var box = el("div", "dragon-wn");
    ov.appendChild(box);
    box.appendChild(el("div", "dragon-wn-h", "\uD83C\uDD95 What's New"));
    box.appendChild(el("div", "dragon-wn-sub", "Everything that changed in the last two days \u2014 this card shows itself once, the first time you move around the site."));
    for (var i = 0; i < list.length && i < MAX_ROWS; i++) {
      var n = list[i];
      var row = el("div", "dragon-wn-row");
      var t = el("div", "dragon-wn-t", n.title);
      t.appendChild(el("span", "dragon-wn-d", n.date));
      row.appendChild(t);
      row.appendChild(el("div", "dragon-wn-x", n.text));
      box.appendChild(row);
    }
    var acts = el("div", "dragon-wn-a");
    var more = el("button", "dg-btn", "See all update notes");
    more.type = "button";
    more.onclick = function () { close(true); try { if (window.dragonOpenUpdateNotes) window.dragonOpenUpdateNotes(); } catch (e) {} };
    var ok = el("button", "dg-btn is-primary", "Got it");
    ok.type = "button";
    ok.setAttribute("data-dragon-wn-got", "1");
    ok.onclick = function () { close(true); };
    acts.append(more, ok);
    box.appendChild(acts);
    ov.addEventListener("mousedown", function (e) { if (e.target === ov) close(true); });
    var onKey = function (e) { if (e.key === "Escape") { e.stopPropagation(); close(true); document.removeEventListener("keydown", onKey, true); } };
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(ov);
    card = { ov: ov, box: box, onKey: onKey, test: !!(opts && opts.test) };
    shownCount++;
    lastShownAt = Date.now();
    return card;
  }

  window.dragonWhatsNewShow = function (items, opts) { if (card) return null; return build(items, opts); };
  // The check-up's test hook: build the card from what IS eligible right now (or from an explicitly
  // supplied probe item when nothing is dated today or yesterday), measure it, close it again and spend
  // nothing (no localStorage write, no lane taken).
  window.dragonWhatsNewTest = function (probe) {
    refresh();
    var out = { eligible: eligible.length, seen: seenValue(), armed: armed, tops: eligible.slice(0, 3).map(function (n) { return n.n + " " + n.date; }) };
    var items = eligible.slice(0, MAX_ROWS);
    if (!items.length && probe) { items = [probe]; out.probe = true; }
    if (!items.length) return out;
    var c = build(items, { test: true });
    out.opened = !!c;
    if (c) {
      out.rows = c.box.querySelectorAll(".dragon-wn-row").length;
      out.hasGot = !!c.box.querySelector("[data-dragon-wn-got]");
      var r = c.box.getBoundingClientRect();
      out.w = Math.round(r.width); out.h = Math.round(r.height);
      out.fits = r.width > 0 && r.right <= (window.innerWidth + 1) && r.bottom <= (window.innerHeight + 1);
      out.seenAfter = seenValue();
    }
    close(false);
    out.stillOpen = !!card;
    return out;
  };

  // ---- when it is allowed to appear -------------------------------------------------------------------
  var armed = false, armedAt = 0, pendingTimer = null;
  function refreshArmed() {
    refresh();
    if (!eligible.length) { armed = false; return false; }
    var top = eligible[0].n;
    var cur = seenValue();
    armed = (cur == null) || (cur < top);
    armedAt = Date.now();
    return armed;
  }
  function showSoon(delay) {
    if (pendingTimer || !armed || card) return;
    pendingTimer = setTimeout(function () {
      pendingTimer = null;
      if (!armed || card) return;
      if (!visible()) return;
      var items = eligible.slice(0, MAX_ROWS);
      var go = function (held) {
        if (!armed || card) { if (held) { try { window.dragonMarquee.release(); } catch (e) {} } return; }
        laneHeld = !!held;
        build(items, {});
      };
      armed = false;   // one claim only — a second navigation cannot queue a second card
      if (window.dragonMarquee && window.dragonMarquee.request) { window.dragonMarquee.request(function () { go(true); }); return; }
      go(false);
    }, delay == null ? 500 : delay);
  }
  // The trigger: a press on a navbar button (the visitor is MOVING somewhere). Registered in the capture
  // phase on the document, so it works for buttons the app builds later, and it never consumes the click.
  function isNavTarget(t) {
    try {
      if (!t || t.nodeType !== 1) return false;
      if (t.closest && t.closest("button.dragon-nav-item")) return true;
      var a = t.closest ? t.closest("a[href]") : null;
      if (a) {
        var h = String(a.getAttribute("href") || "");
        if (h === "#" || h.indexOf("#") === 0) return true;
      }
    } catch (e) {}
    return false;
  }
  function boot() {
    refreshArmed();
    try {
      document.addEventListener("click", function (e) {
        if (!armed) return;
        if (isNavTarget(e.target)) showSoon(600);
      }, true);
    } catch (e) {}
    // A deep-link into a page (a shared `#gallery` link) counts as moving too: let the card follow the
    // first hash change as well, so a visitor arriving straight at a page still learns what is new.
    try {
      window.addEventListener("hashchange", function () { if (armed) showSoon(700); });
    } catch (e) {}
  }
  window.dragonWhatsNewState = function () {
    return { seen: seenValue(), armed: armed, armedAt: armedAt, open: !!card, shown: shownCount, lastShownAt: lastShownAt, tops: notes.slice(0, 3).map(function (n) { return n.n + " " + n.date; }), eligible: eligible.length };
  };
  if (document.readyState !== "loading") boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
