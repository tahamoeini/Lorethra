/* ============================================================================
   BestAiGen — Dexa News (Update Notes panel + news ticker + bobbing "!" badge)
   ----------------------------------------------------------------------------
   Requested by Egon, 16.09.2026. SOURCE: the hand-written public comment block
   near the top of index.html, marked "BESTAIGEN UPDATE NOTES" (one [U<n>] line
   per release). This module finds those lines automatically, lists them in the
   Update Notes panel and drives the news ticker. NOTE: the panel content is
   curated and maintained BY HAND — it is not generated from the developer
   changelog.

   Flow: when a returning visitor has an unread entry, a single-line Dexa news
   ticker slowly scrolls at the top of the page (~2-3 loops / ~30s). Clicking it
   opens Update Notes. If the visitor misses or dismisses it, a bobbing red "!"
   appears above Dexa's circle; when the visitor opens Dexa's chat, Dexa posts a
   personalised note about it AND offers an "Open Update Notes" button. Opening
   the panel clears the badges.

   Dependencies: window.dragonBotAPI (index.html bot module), window.dragonToast,
   window.root.generateText (optional — only for translation and the personal note).
   ========================================================================== */
(function () {
  "use strict";

  var DEXA_AV = "https://user.uploads.dev/file/b113225d7dd4df887890c5b33ed65f7f.jpg";
  var LS_SEEN = "dragonNewsSeen";          // highest changelog number the user has seen
  var LS_SHOWN = "dragonNewsTickerShownN";  // highest number the ticker has played (no replay)
  var LS_TOLD = "dragonNewsToldN";          // highest number Dexa has told in chat
  var LS_CHATSEEN = "dragonNewsChatSeen";    // highest number of Dexa's news note the user has actually seen in chat
  var LS_TR = "dragonNewsTr";               // { "<lang>|<n>": [{n,name,desc}] } translation cache
  var PAGE_LANGS = ["en", "tr", "de", "fr", "es", "it", "ru", "pt", "ar", "nl", "pl", "ja", "zh", "ko"];

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function numOf(v) { var n = parseInt(v, 10); return isFinite(n) ? n : null; }

  function detectLang() {
    try { if (window.dragonLang) return window.dragonLang.get(); } catch (e0) {}
    var l = "en";
    try {
      var ls = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
      for (var i = 0; i < ls.length; i++) {
        var c = String(ls[i] || "").toLowerCase().split("-")[0];
        if (PAGE_LANGS.indexOf(c) !== -1) { l = c; break; }
      }
    } catch (e) {}
    return l;
  }
  var LANG = detectLang();
  window.dragonNewsLangRefresh = function () {
    var l = detectLang();
    if (l === LANG) return LANG;
    LANG = l;
    try { trCache = null; } catch (e) {}
    if (typeof notesOverlay !== "undefined" && notesOverlay) {
      try { if (notesOverlay.parentNode) notesOverlay.parentNode.removeChild(notesOverlay); } catch (e2) {}
      notesOverlay = null;
      try { detailEl = null; } catch (e3) {}
      try { buildUpdateNotesPanel(); } catch (e4) {}
    }
    try { syncBadge(); } catch (e5) {}
    return LANG;
  };
  try { if (window.dragonLang) window.dragonLang.onChange(window.dragonNewsLangRefresh); } catch (e6) {}

  /* ---------- 1) public Update Notes block -> news list ----------
     The feed is hand-written inside a dedicated HTML comment block near the top of
     index.html (marked "BESTAIGEN UPDATE NOTES"). Each entry is ONE line:
        [U12] 16.09.2026 | Short Title | One or two sentences a user can understand.
     The developer changelog is NOT read any more — this keeps the announcements
     short, corporate and free of internal detail. */
  function parseNews() {
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
          var nm = m[3].trim(), de = m[4].trim();
          items.push({
            n: num, date: m[2],
            // 📰 Egon 23.09.2026 (W-UI180) — the LIST shows a short preview (the row clamps it), and the
            // detail window that opens when a row is tapped shows the FULL, untruncated text.
            name: nm.length > 104 ? nm.slice(0, 101) + "…" : nm,
            desc: de.length > 320 ? de.slice(0, 317) + "…" : de,
            nameFull: nm,
            descFull: de
          });
        }
      }
    } catch (e) {}
    items.sort(function (a, b) { return b.n - a.n; });
    return items;
  }

  var ITEMS = parseNews();
  var LATEST = ITEMS.length ? ITEMS[0].n : 0;
  var LOG = [];   // diagnostic trace (window.dragonNews._log) — Egon 16.09.2026
  function log(m) { try { LOG.push(Date.now() + " " + m); if (LOG.length > 40) LOG.shift(); } catch (e) {} }

  // 📦 Paket A3 (W-PERF293) — the older update notes no longer ship inside index.html: only the newest
  // ten stay inline (the What's New card and the check-up read those synchronously). The rest live in
  // src/DATA/update-notes.txt and are fetched the first time the Update Notes page is opened.
  var ARCHIVE_URL = "src/DATA/update-notes.txt";
  var archiveState = 0;   // 0 idle · 1 loading · 2 merged · 3 unavailable
  var archiveP = null;
  function mergeArchiveText(txt) {
    var seen = {}, added = 0, lines = String(txt || "").split("\n");
    for (var i = 0; i < ITEMS.length; i++) seen[ITEMS[i].n] = 1;
    for (var j = 0; j < lines.length; j++) {
      var m = lines[j].match(/^\s*\[U(\d+)\]\s+(\d{2}\.\d{2}\.\d{4})\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*$/);
      if (!m) continue;
      var num = parseInt(m[1], 10);
      if (seen[num]) continue;
      seen[num] = 1;
      var nm = m[3].trim(), de = m[4].trim();
      ITEMS.push({ n: num, date: m[2], name: nm.length > 104 ? nm.slice(0, 101) + "…" : nm, desc: de.length > 320 ? de.slice(0, 317) + "…" : de, nameFull: nm, descFull: de });
      added++;
    }
    ITEMS.sort(function (a, b) { return b.n - a.n; });
    log("archive merged: +" + added + " note(s), total=" + ITEMS.length);
    return added;
  }
  function archiveLoad() {
    if (archiveState === 2 || archiveState === 3) return null;
    if (archiveState === 1) return archiveP;
    archiveState = 1;
    try {
      archiveP = fetch(ARCHIVE_URL).then(function (r) { return r.ok ? r.text() : ""; }).then(function (x) { mergeArchiveText(x); archiveState = 2; archiveP = null; })
        .catch(function () { archiveState = 3; archiveP = null; });
    } catch (e) { archiveState = 3; archiveP = null; return null; }
    return archiveP;
  }
  window.dragonNewsArchiveState = function () { return { state: archiveState, items: ITEMS.length }; };

  function seenN() { return numOf(lsGet(LS_SEEN)); }
  function isFirstTimer() { return seenN() === null; }
  function effectiveSeen() { var s = seenN(); return s === null ? Math.max(0, LATEST - 1) : s; }
  function unread() { var s = effectiveSeen(); return ITEMS.filter(function (i) { return i.n > s; }); }
  function markSeen() {
    lsSet(LS_SEEN, String(LATEST));
    hideRedMark();
    syncBadge();
  }

  /* ---------- 2) i18n ---------- */
  var TICKER = {
    en: "🐉 Dexa: News! Dear friends — Egon just added \u201c{X}\u201d — check this out! ✨",
    tr: "🐉 Dexa: Haberler! Sevgili dostlar — Egon az önce \u201c{X}\u201d özelliğini ekledi — bir bakın! ✨",
    de: "🐉 Dexa: Neuigkeiten! Liebe Freunde — Egon hat gerade \u201e{X}\u201c eingebaut — schau es dir an! ✨",
    fr: "🐉 Dexa : Nouveautés ! Chers amis — Egon vient d\u2019ajouter \u00ab {X} \u00bb — allez voir ! ✨",
    es: "🐉 Dexa: ¡Noticias! Amigos — Egon acaba de añadir «{X}» — ¡échale un vistazo! ✨",
    it: "🐉 Dexa: Novità! Amici — Egon ha appena aggiunto «{X}» — dai un\u2019occhiata! ✨",
    ru: "🐉 Dexa: Новости! Друзья — Egon только что добавил «{X}» — загляните! ✨",
    pt: "🐉 Dexa: Novidades! Amigos — o Egon acabou de adicionar «{X}» — dá uma olhada! ✨",
    ar: "🐉 دِكسا: أخبار! أصدقائي — أضاف Egon للتو «{X}» — ألقِ نظرة! ✨",
    nl: "🐉 Dexa: Nieuws! Lieve vrienden — Egon heeft net \u201c{X}\u201d toegevoegd — kijk eens! ✨",
    pl: "🐉 Dexa: Nowości! Przyjaciele — Egon właśnie dodał „{X}” — sprawdź! ✨",
    ja: "🐉 デクサ：ニュース！みんな — Egonが「{X}」を追加したよ — 見てね！✨",
    zh: "🐉 Dexa：快讯！朋友们 — Egon 刚刚加入了「{X}」— 快来看看！✨",
    ko: "🐉 덱사: 뉴스! 친구들 — Egon이 방금 \u201c{X}\u201d 기능을 추가했어요 — 확인해 보세요! ✨"
  };
  var UI = {
    en: { title: "Update Notes", sub: "Everything new, newest first", got: "Got it", tr: "Translate", tring: "Translating…", empty: "No updates yet.", newChip: "NEW", openTip: "Update Notes \u2014 what's new in BestAiGen", mark: "Dexa has news for you \u2014 click for Update Notes", offerBtn: "Open Update Notes" },
    tr: { title: "Güncelleme Notları", sub: "En yenisi en üstte", got: "Tamam", tr: "Çevir", tring: "Çeviriliyor…", empty: "Henüz güncelleme yok.", newChip: "YENİ", openTip: "Güncelleme Notları \u2014 BestAiGen'de neler yeni", mark: "Dexa'nın senin için bir haberi var \u2014 güncelleme notları için tıkla", offerBtn: "Güncelleme Notlarını Aç" },
    de: { title: "Update-Notizen", sub: "Alles Neue, Neuestes zuerst", got: "Verstanden", tr: "Übersetzen", tring: "Wird übersetzt…", empty: "Noch keine Updates.", newChip: "NEU", openTip: "Update-Notizen \u2014 Neuigkeiten bei BestAiGen", mark: "Dexa hat Neuigkeiten für dich \u2014 klicke für die Notizen", offerBtn: "Notizen öffnen" },
    fr: { title: "Notes de mise à jour", sub: "Tout ce qui est nouveau, du plus récent", got: "Compris", tr: "Traduire", tring: "Traduction en cours…", empty: "Aucune mise à jour.", newChip: "NOUVEAU", openTip: "Notes de mise à jour \u2014 les nouveautés de BestAiGen", mark: "Dexa a des nouvelles pour toi \u2014 clique pour les notes", offerBtn: "Ouvrir les notes" },
    es: { title: "Notas de actualización", sub: "Todo lo nuevo, lo más reciente primero", got: "Entendido", tr: "Traducir", tring: "Traduciendo…", empty: "Aún no hay novedades.", newChip: "NUEVO", openTip: "Notas de actualización \u2014 novedades de BestAiGen", mark: "Dexa tiene noticias para ti \u2014 clic para verlas", offerBtn: "Abrir notas" },
    it: { title: "Note di aggiornamento", sub: "Tutte le novità, le più recenti prima", got: "Capito", tr: "Traduci", tring: "Traduzione in corso…", empty: "Nessun aggiornamento.", newChip: "NUOVO", openTip: "Note di aggiornamento \u2014 le novità di BestAiGen", mark: "Dexa ha notizie per te \u2014 clicca per leggerle", offerBtn: "Apri le note" },
    ru: { title: "Новости обновлений", sub: "Всё новое, сначала свежее", got: "Понятно", tr: "Перевести", tring: "Перевожу…", empty: "Обновлений пока нет.", newChip: "НОВОЕ", openTip: "Новости обновлений \u2014 что нового в BestAiGen", mark: "У Dexa для тебя новости \u2014 нажми, чтобы открыть", offerBtn: "Открыть новости" },
    pt: { title: "Notas de atualização", sub: "Tudo de novo, do mais recente", got: "Entendi", tr: "Traduzir", tring: "Traduzindo…", empty: "Sem novidades ainda.", newChip: "NOVO", openTip: "Notas de atualização \u2014 novidades do BestAiGen", mark: "A Dexa tem novidades para ti \u2014 clica para ver", offerBtn: "Abrir notas" },
    ar: { title: "ملاحظات التحديث", sub: "كل جديد، الأحدث أولاً", got: "فهمت", tr: "ترجمة", tring: "جارٍ الترجمة…", empty: "لا تحديثات بعد.", newChip: "جديد", openTip: "ملاحظات التحديث \u2014 جديد BestAiGen", mark: "لدى Dexa أخبار لك \u2014 اضغط لعرضها", offerBtn: "فتح الملاحظات" },
    nl: { title: "Updatenotities", sub: "Alles nieuw, nieuwste eerst", got: "Begrepen", tr: "Vertalen", tring: "Bezig met vertalen…", empty: "Nog geen updates.", newChip: "NIEUW", openTip: "Updatenotities \u2014 wat is er nieuw bij BestAiGen", mark: "Dexa heeft nieuws voor je \u2014 klik voor de notities", offerBtn: "Notities openen" },
    pl: { title: "Nowości aktualizacji", sub: "Wszystko nowe, od najnowszych", got: "Rozumiem", tr: "Przetłumacz", tring: "Tłumaczę…", empty: "Brak aktualizacji.", newChip: "NOWE", openTip: "Nowości \u2014 co nowego w BestAiGen", mark: "Dexa ma dla ciebie wieści \u2014 kliknij, aby otworzyć", offerBtn: "Otwórz nowości" },
    ja: { title: "更新ノート", sub: "新着順", got: "わかった", tr: "翻訳", tring: "翻訳中…", empty: "まだ更新はありません。", newChip: "新着", openTip: "更新ノート \u2014 BestAiGenの新着情報", mark: "デクサからお知らせ \u2014 クリックで開く", offerBtn: "ノートを開く" },
    zh: { title: "更新说明", sub: "最新动态，最新的在前", got: "知道了", tr: "翻译", tring: "翻译中…", empty: "暂无更新。", newChip: "新", openTip: "更新说明 \u2014 BestAiGen的新动态", mark: "Dexa有消息告诉你 \u2014 点击查看", offerBtn: "打开更新说明" },
    ko: { title: "업데이트 노트", sub: "최신 소식부터", got: "알겠어요", tr: "번역", tring: "번역 중…", empty: "아직 업데이트가 없어요.", newChip: "신규", openTip: "업데이트 노트 \u2014 BestAiGen 새 소식", mark: "Dexa가 소식을 가져왔어요 \u2014 클릭해서 보기", offerBtn: "노트 열기" }
  };
  function ui() { return UI[LANG] || UI.en; }

  /* ---------- 3) Update Notes butonu: NEW rozeti ---------- */
  function syncBadge() {
    var btn = document.getElementById("dragonUpdateNotesBtn");
    if (!btn) return;
    var badge = document.getElementById("dragonUpdateNotesBadge");
    if (!badge) {
      badge = document.createElement("span");
      badge.id = "dragonUpdateNotesBadge";
      badge.textContent = "News";
      badge.style.cssText = "position:absolute; top:-8px; right:-8px; font-size:.5rem !important; line-height:1 !important; font-weight:900; letter-spacing:.05em; padding:2px 5px !important; border-radius:7px; background:#e11d2f; color:#fff; border:1px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,.55); pointer-events:none;";
      try { btn.style.position = "relative"; } catch (e) {}
      btn.appendChild(badge);
    }
    var un = unread();
    badge.style.display = un.length ? "" : "none";
    btn.title = ui().openTip;
  }

  /* ---------- 4) Red jiggling "!" (above the Dexa circle) ---------- */
  function ensureBadgeCss() {
    if (document.getElementById("dragonNewsCss")) return;
    var st = document.createElement("style");
    st.id = "dragonNewsCss";
    st.textContent =
      "@keyframes dragonNewsBounce{0%,4%{transform:translateY(0) scale(1)}" +
      "0.8%{transform:translateY(-6px) scale(1.12)}" +
      "1.6%{transform:translateY(0) scale(1)}" +
      "2.4%{transform:translateY(-4px) scale(1.08)}" +
      "3.2%{transform:translateY(0) scale(1)}" +
      "4%{transform:translateY(-2px) scale(1.04)}" +
      "4.8%{transform:translateY(0) scale(1)}" +
      "100%{transform:translateY(0) scale(1)}}" +
      "#dragonBotNewsBadge.dragon-news-badge{animation:dragonNewsBounce 115s linear infinite;}" +
      "@keyframes dragonNewsWob{0%,100%{transform:rotate(-11deg)}50%{transform:rotate(11deg)}}" +
      "#dragonBotNewsBadge .dragon-news-bang{display:block; animation:dragonNewsWob 1.1s ease-in-out infinite;}" +
      ".dragon-news-ticker-seg{display:inline-block; white-space:nowrap;}" +
      "@keyframes dragonNewsFade{from{opacity:1}to{opacity:0}}" +
      ".dragon-news-row{display:flex; flex-wrap:nowrap; align-items:center; gap:.4rem;}" +
      ".dragon-news-nm{flex:1 1 0%; min-width:0;}" +
      ".dragon-news-desc{color:#d6cfe9 !important;}" +
      "@media (max-width:430px){" +
      ".dragon-news-hd{gap:.4rem !important; padding:.55rem .6rem !important;}" +
      ".dragon-news-av{width:28px !important; height:28px !important;}" +
      ".dragon-news-ht{flex:1 1 auto; min-width:0;}" +
      ".dragon-news-ttl{font-size:.9rem !important;}" +
      ".dragon-news-sub{font-size:.66rem !important; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}" +
      ".dragon-news-hd button{padding:.26rem .4rem !important; font-size:.62rem !important;}" +
      ".dragon-news-desc{font-size:.72rem !important;}" +
      "}";
    document.head.appendChild(st);
  }
  function showRedMark() {
    var b = document.getElementById("dragonBotNewsBadge");
    if (!b) return;
    ensureBadgeCss();
    b.style.display = "block";
    b.classList.add("dragon-news-badge");
    if (!b.firstChild || !b.querySelector || !b.querySelector(".dragon-news-bang")) {
      b.textContent = "";
      var s = document.createElement("span");
      s.className = "dragon-news-bang";
      s.textContent = "!";
      b.appendChild(s);
    }
    b.title = ui().mark;
  }
  function hideRedMark() {
    var b = document.getElementById("dragonBotNewsBadge");
    if (!b) return;
    b.classList.remove("dragon-news-badge");
    b.style.display = "none";
  }

  /* ---------- 5) Scrolling news ticker ---------- */
  var tickerEl = null;
  function tickerText(it) {
    var t = TICKER[LANG] || TICKER.en;
    // NOTE: stripping the emoji with a character class is FORBIDDEN (it splits the surrogate pair in half → corrupt text).
    var nm = String(it.name || "").replace(/\s+/g, " ").trim();
    if (nm.length > 110) nm = nm.slice(0, 107).replace(/[\s(+\-—–]+$/, "") + "…";
    return t.replace("{X}", nm);
  }
  // 🎞️ Egon 20.09.2026 — ONE scrolling banner at a time: the ticker takes the shared marquee lane and
  // gives it back the moment it hides (finished, closed, or stopped by the screen saver), so the purple
  // reload notice can start — and vice versa.
  var tickerHoldsLane = false;
  function releaseLane() {
    if (!tickerHoldsLane) return;
    tickerHoldsLane = false;
    try { if (window.dragonMarquee) window.dragonMarquee.release(); } catch (e) {}
  }
  function hideTicker() {
    if (!tickerEl) return;
    try { if (window.dragonFastTipHide) window.dragonFastTipHide(); } catch (e) {}
    var el = tickerEl;
    tickerEl = null;
    releaseLane();
    try {
      el.style.transition = "opacity .35s ease";
      el.style.opacity = "0";
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 400);
    } catch (e) {}
  }
  function screenSaverOn() {
    var o = document.getElementById("dragonScreenOverlay");
    if (!o) return false;
    try {
      if (getComputedStyle(o).display === "none") return false;   // NOTE: for fixed elements offsetParent is ALWAYS null → check by measuring
      return o.getBoundingClientRect().width > 40 && o.getBoundingClientRect().height > 40;
    } catch (e) { return false; }
  }
  function showTicker(it, after) {
    return;
    if (tickerEl) return;
    // 🎞️ wait for the lane if another scrolling banner is running (the purple reload notice / a milestone)
    var run = function () { renderTicker(it, after); };
    if (window.dragonMarquee) { window.dragonMarquee.request(run); return; }
    run();
  }
  function renderTicker(it, after) {
    if (tickerEl) { releaseLane(); return; }
    tickerHoldsLane = true;
    ensureBadgeCss();
    var bar = document.createElement("div");
    bar.id = "dragonNewsTicker";
    bar.style.cssText =
      "position:fixed; left:0; right:0; top:var(--dragon-nav-h,36px); height:26px; box-sizing:border-box; z-index:2147482000;" +
      "display:flex; align-items:center; gap:.4rem; padding:0 .5rem; overflow:hidden; cursor:pointer;" +
      "background:linear-gradient(180deg,#7d1620,#2a0c10); border-bottom:1px solid #c81e2e;" +
      "box-shadow:0 3px 12px rgba(0,0,0,.55); color:#ffd9dc; font-size:.78rem; line-height:1;" +
      "-webkit-user-select:none; user-select:none;";
    bar.title = ui().openTip;
    var clickable = function () {
      hideTicker();
      try { if (window.dragonOpenUpdateNotes) window.dragonOpenUpdateNotes(); } catch (e) {}
    };
    var av = document.createElement("img");
    av.src = DEXA_AV; av.alt = "Dexa";
    av.style.cssText = "width:18px; height:18px; border-radius:50%; object-fit:cover; flex:0 0 auto; border:1px solid #ffb3bb; box-shadow:0 0 6px rgba(255,120,140,.6);";
    var clip = document.createElement("div");
    clip.style.cssText = "flex:1 1 auto; overflow:hidden; position:relative; height:100%;";
    var track = document.createElement("div");
    track.style.cssText = "position:absolute; left:0; top:0; height:100%; display:flex; align-items:center; will-change:transform;";
    // 🐉 → 🐲 the green dragon emoji is gone: Dexa's head picture (below) carries the identity now.
    var txt = (window.dragonMarqueeText ? window.dragonMarqueeText(tickerText(it)) : tickerText(it)) + "\u00A0\u00A0\u00A0•\u00A0\u00A0\u00A0";
    for (var i = 0; i < 2; i++) {
      var seg = document.createElement("span");
      seg.className = "dragon-news-ticker-seg";
      seg.textContent = txt;
      track.appendChild(seg);
    }
    clip.appendChild(track);
    bar.appendChild(av);
    bar.appendChild(clip);
    var x = document.createElement("button");
    x.type = "button";
    x.textContent = "\u2715";
    x.title = "Close";
    x.style.cssText = "flex:0 0 auto; background:transparent; border:0; color:#ffd9dc; font-size:.8rem; cursor:pointer; padding:0 .15rem;";
    var dismissByUser = function () { hideTicker(); if (shouldRedMark()) showRedMark(); if (after) after(); };
    x.onclick = function (e) { e.stopPropagation(); dismissByUser(); };
    x.setAttribute("data-dragon-gesture-skip", "");
    bar.appendChild(x);
    document.body.appendChild(bar);
    tickerEl = bar;
    // 🖱️ Egon 20.09.2026 — shared marquee gestures: 1 left click stops the scroll (again = continue),
    // 2 left clicks run the banner action (open Update Notes), right click closes it; on touch: 1 tap
    // stops, 2 taps close, 3 taps open the notes.
    if (window.dragonMarqueeGestures) window.dragonMarqueeGestures(bar, { action: clickable, dismiss: dismissByUser });
    else if (window.dragonDismissOnGesture) window.dragonDismissOnGesture(bar, dismissByUser, { single: clickable });
    else bar.onclick = clickable;
    lsSet(LS_SHOWN, String(it.n));

    // measure → animate (target: ~2-3 loops, ~30-40 s total, slow drift around 85 px/s)
    requestAnimationFrame(function () {
      try {
        var unit = track.firstChild.getBoundingClientRect().width || 1200;
        var speed = 85;                                     // px/s — "slowly"
        // Let the loop duration stay natural per TEXT (fixed speed); total ~30 s / 1-3 full loops.
        var loopMs = Math.max(5000, Math.round((unit / speed) * 1000));
        var loops = Math.max(1, Math.min(3, Math.round(30000 / loopMs)));
        var anim = track.animate(
          [{ transform: "translateX(0px)" }, { transform: "translateX(-" + unit + "px)" }],
          { duration: loopMs, iterations: loops, easing: "linear" }
        );
        var watch = setInterval(function () {
          if (!tickerEl) { clearInterval(watch); return; }
          if (screenSaverOn()) { clearInterval(watch); hideTicker(); }
        }, 600);
        anim.onfinish = function () {
          clearInterval(watch);
          if (!tickerEl) return;
          hideTicker();
          if (shouldRedMark()) showRedMark();               // user didn't see / missed it → red "!"
          if (after) after();
        };
        bar._dragonAnim = anim;
        bar.__dragonAnim = anim;   // the shared gesture helper pauses/resumes THIS
      } catch (e) {
        setTimeout(function () { hideTicker(); if (shouldRedMark()) showRedMark(); if (after) after(); }, 26000);
      }
    });
  }

  /* ---------- 6) Update Notes paneli ---------- */
  var trCache = null;
  function loadTrCache() {
    if (trCache) return trCache;
    try { trCache = JSON.parse(lsGet(LS_TR) || "{}") || {}; } catch (e) { trCache = {}; }
    return trCache;
  }
  function saveTrCache() { try { lsSet(LS_TR, JSON.stringify(trCache || {})); } catch (e) {} }
  function trKey() { return LANG + "|" + LATEST; }

  // 📰 Egon 23.09.2026 (W-UI180) — WHICH NAVBAR PAGE DOES A NOTE BELONG TO? Egon: "if the relevant update is
  // about the home page, the home page navbar button appears; if it is about generation, the generation
  // navbar button; if it is about settings, the settings button ... and so on". The note text is scanned
  // (name + full description) for the page's own vocabulary, WEIGHTED, and the HIGHEST score wins — a note
  // that names no page (score below the floor) simply grows no button (never a random guess). Deterministic
  // and testable (window.dragonNewsPageOf).
  var NEWS_PAGE = [
    { page: "account",   icon: "\u2699\uFE0F", label: "Settings",  words: [[/update notes|güncelleme not/i, 6], [/anket|survey/i, 6], [/ui scale|uygulama ölçe/i, 6], [/screen saver|ekran koruyucu/i, 6], [/settings?|ayarlar/i, 5], [/privacy|gizlilik/i, 5], [/storage|depolama/i, 4], [/config/i, 4], [/legends?|efsane/i, 3], [/theme|tema/i, 3], [/sliders?/i, 3], [/background|arka plan/i, 2]] },
    { page: "gallery",   icon: "\uD83D\uDDBC\uFE0F", label: "Galleries", words: [[/display mode|görünüm mod/i, 7], [/galler(y|ies)|galeri/i, 7], [/justified|masonry|pinterest|mosaic|spotlight|\bmixed\b/i, 6], [/sub-?channel|alt ?kanal/i, 6], [/content rating|içerik derece/i, 5], [/puzzle/i, 5], [/\btiles?\b|döşeme/i, 2], [/\bsort\b|sırala/i, 2], [/\bfilter\b|filtre/i, 2]] },
    { page: "generate",  icon: "\u2728", label: "Generate",  words: [[/generat|\bgenerate\b|üret/i, 5], [/art style|sanat tarz/i, 5], [/upscal|büyüt/i, 5], [/negative prompt/i, 3], [/resolution|çözünürlük/i, 3], [/\bseed\b|tohum/i, 3], [/aspect ratio|en ?boy/i, 3], [/\bprompt\b/i, 2]] },
    { page: "character", icon: "\uD83D\uDC83", label: "Character", words: [[/character|karakter/i, 5], [/persona/i, 4], [/waifu/i, 4], [/premade|hazır/i, 4], [/outfit|kıyafet/i, 4], [/avatar/i, 3]] },
    { page: "likes",     icon: "\u2B50", label: "Likes",     words: [[/likes?|beğen/i, 5], [/favorites?|favourites?|favori/i, 5], [/saved|kayded/i, 2]] },
    { page: "history",   icon: "\uD83D\uDD58", label: "History",   words: [[/prompt bank/i, 7], [/previous generation/i, 6], [/history|geçmiş/i, 5], [/recent|son ?kullan/i, 3]] },
    { page: "chat",      icon: "\uD83D\uDCAC", label: "Chat",      words: [[/\bchat\b|sohbet/i, 5], [/comments?|yorum/i, 4], [/guestbook/i, 4], [/\bmessage/i, 2]] },
    { page: "home",      icon: "\uD83C\uDFE0", label: "Home",      words: [[/home page|ana sayfa/i, 6], [/\bhome\b/i, 4], [/hero|landing/i, 3]] }
  ];
  ;function newsPageOf(it) {
    var s = String((it && (it.nameFull || it.name)) || "") + " " + String((it && (it.descFull || it.desc)) || "");
    var best = null, bestScore = 0;
    for (var i = 0; i < NEWS_PAGE.length; i++) {
      var sc = 0, ws = NEWS_PAGE[i].words || [];
      for (var j = 0; j < ws.length; j++) { if (ws[j][0].test(s) && ws[j][1] > sc) sc = ws[j][1]; }
      if (sc > bestScore) { bestScore = sc; best = NEWS_PAGE[i]; }
    }
    return bestScore >= 3 ? best : null;
  }
  window.dragonNewsPageOf = newsPageOf;

  function entryRow(it, isNew, override) {
    var row = document.createElement("div");
    row.className = "dragon-news-row-entry";
    row.style.cssText = "padding:.5rem .6rem; border:1px solid rgba(255,255,255,.08); border-radius:10px; background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.012));";
    // Egon 16.09.2026 — the title shares row 1 with the release date and must be CENTRED on that
    // row. The date is pinned to the left edge and the NEW chip to the right edge (both taken out of
    // flow) so the title sits in the true centre of the row regardless of their widths.
    var top = document.createElement("div");
    top.className = "dragon-news-row";
    top.style.cssText = "position:relative; display:flex; align-items:center; justify-content:center; min-height:1.45rem;";
    var d = document.createElement("span");
    d.className = "dragon-news-date";
    d.textContent = it.date || "";
    d.style.cssText = "position:absolute; left:0; top:50%; transform:translateY(-50%); font-size:.68rem; font-weight:800; color:#ffb3c0; letter-spacing:.03em; background:rgba(225,29,47,.16); border:1px solid rgba(225,29,47,.45); border-radius:6px; padding:.05rem .36rem; white-space:nowrap;";
    var nm = document.createElement("span");
    nm.className = "dragon-news-nm";
    nm.textContent = (override && override.name) || it.name;
    nm.style.cssText = "font-size:.8rem; font-weight:800; color:#f2ecff; text-align:center; flex:1 1 auto; min-width:0; padding:0 4.5rem;";
    top.appendChild(d);
    if (isNew) {
      var chip = document.createElement("span");
      chip.textContent = ui().newChip;
      chip.style.cssText = "position:absolute; right:0; top:50%; transform:translateY(-50%); font-size:.54rem; font-weight:900; letter-spacing:.06em; background:#e11d2f; color:#fff; border-radius:6px; padding:.08rem .32rem;";
      top.appendChild(chip);
    }
    top.appendChild(nm);
    row.appendChild(top);
    var de = (override && override.desc) || it.desc;
    if (de) {
      var p = document.createElement("div");
      p.className = "dragon-news-desc";
      p.textContent = de;
      // 📰 Egon 23.09.2026 (W-UI180) — the preview must FIT the row instead of overflowing it; a tap opens
      // the full note (the whole text) in a window above this panel.
      p.style.cssText = "margin-top:.3rem; font-size:.73rem; line-height:1.5; color:#cfc7e6; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;";
      row.appendChild(p);
    }
    // 📰 W-UI180 — the row is a button: tapping it opens the full note in an expanding window.
    try { row.style.cursor = "pointer"; row.title = "Tap to read the whole note"; } catch (e) {}
    return row;
  }

  var notesOverlay = null;
  var detailEl = null;   // the "whole note" window opened on top of the list (W-UI180)
  window.dragonOpenUpdateNotes = function () {
    if (notesOverlay) return;
    var p = archiveLoad();
    if (p) { p.then(buildUpdateNotesPanel, buildUpdateNotesPanel); return; }
    buildUpdateNotesPanel();
  };
  ;function buildUpdateNotesPanel() {
    if (notesOverlay) return;
    markSeen();
    var o = document.createElement("div");
    o.id = "dragonNewsOverlay";
    o.style.cssText = "position:fixed; inset:0; z-index:2147482600; display:flex; align-items:center; justify-content:center; padding:.7rem; background:rgba(6,6,10,.76); -webkit-backdrop-filter:blur(4px); backdrop-filter:blur(4px); opacity:0; transition:opacity .25s ease;";
    var card = document.createElement("div");
    card.style.cssText = "width:100%; max-width:min(560px, 96vw); max-height:88vh; display:flex; flex-direction:column; border-radius:18px; border:1px solid rgba(155,107,255,.5); background:radial-gradient(120% 80% at 50% 0%, rgba(155,107,255,.18), transparent 60%), linear-gradient(180deg,#191922,#0c0c11); box-shadow:0 24px 70px rgba(0,0,0,.75); overflow:hidden; transform:translateY(8px) scale(.98); transition:transform .28s cubic-bezier(.2,.8,.2,1);";
    var head = document.createElement("div");
    head.className = "dragon-news-hd";
    head.style.cssText = "display:flex; align-items:center; gap:.55rem; padding:.7rem .8rem; border-bottom:1px solid rgba(255,255,255,.08); background:linear-gradient(180deg,rgba(255,255,255,.03),transparent);";
    var av = document.createElement("img");
    av.className = "dragon-news-av";
    av.src = DEXA_AV; av.alt = "Dexa";
    av.style.cssText = "width:34px; height:34px; border-radius:50%; object-fit:cover; border:2px solid #b79bff; flex:0 0 auto;";
    var ht = document.createElement("div");
    ht.className = "dragon-news-ht";
    ht.style.cssText = "flex:1 1 auto; min-width:0;";
    var t1 = document.createElement("div");
    t1.className = "dragon-news-ttl";
    t1.textContent = ui().title;
    t1.style.cssText = "font-size:1rem; font-weight:900; color:#efe9ff;";
    var t2 = document.createElement("div");
    t2.className = "dragon-news-sub";
    t2.textContent = ui().sub;
    t2.style.cssText = "font-size:.7rem; color:#b9aee0;";
    ht.appendChild(t1); ht.appendChild(t2);
    var trBtn = document.createElement("button");
    trBtn.type = "button";
    trBtn.textContent = ui().tr;
    trBtn.title = "Translate the notes into your language";
    trBtn.style.cssText = "flex:0 0 auto; font-size:.68rem; font-weight:800; padding:.3rem .5rem; border-radius:8px; cursor:pointer; border:1px solid rgba(155,107,255,.6); background:linear-gradient(145deg,#2a2a36,#15151c); color:#d8c9ff;";
    var xb = document.createElement("button");
    xb.type = "button"; xb.textContent = "\u2715"; xb.title = "Close";
    xb.style.cssText = "flex:0 0 auto; width:1.8rem; height:1.8rem; border-radius:50%; border:1px solid rgba(155,107,255,.45); background:rgba(255,255,255,.04); color:#cbbcf0; cursor:pointer; font-size:.8rem; line-height:1; padding:0;";
    head.appendChild(av); head.appendChild(ht);
    try {
      if (window.dragonLang) {
        var langSel = window.dragonLang.select("flex:0 0 auto; font-size:.68rem; font-weight:800; padding:.3rem .3rem; border-radius:8px; cursor:pointer; border:1px solid rgba(155,107,255,.6); background:linear-gradient(145deg,#2a2a36,#15151c); color:#d8c9ff; max-width:5.2rem;");
        langSel.title = "Language";
        head.appendChild(langSel);
      }
    } catch (eLang) {}
    head.appendChild(trBtn); head.appendChild(xb);

    var body = document.createElement("div");
    body.style.cssText = "flex:1 1 auto; overflow-y:auto; padding:.6rem; display:flex; flex-direction:column; gap:.4rem;";
    var foot = document.createElement("div");
    foot.style.cssText = "flex:0 0 auto; padding:.55rem .7rem; border-top:1px solid rgba(255,255,255,.08); text-align:center;";
    var ok = document.createElement("button");
    ok.type = "button"; ok.textContent = ui().got;
    ok.style.cssText = "padding:.5rem 1.5rem; font-size:.86rem; font-weight:bold; border-radius:11px; cursor:pointer; color:#fff; border:1px solid #b79bff; background:linear-gradient(180deg,#7a4ddb,#4a2a94); box-shadow:0 6px 18px rgba(155,107,255,.4);";
    foot.appendChild(ok);

    function render() {
      body.innerHTML = "";
      var cache = loadTrCache()[trKey()] || null;
      var s = effectiveSeen();
      if (!ITEMS.length) {
        var e = document.createElement("div");
        e.textContent = ui().empty;
        e.style.cssText = "padding:1rem; text-align:center; color:#b9aee0; font-size:.8rem;";
        body.appendChild(e); return;
      }
      for (var i = 0; i < ITEMS.length; i++) {
        var it = ITEMS[i];
        var ov = null;
        if (cache) { for (var j = 0; j < cache.length; j++) { if (cache[j].n === it.n) { ov = cache[j]; break; } } }
        var rowEl = entryRow(it, it.n > s, ov);
        // 📰 W-UI180 — tapping any note opens its FULL text above this panel.
        (function (item, ovv) {
          rowEl.onclick = function () { openDetail(item, ovv); };
        })(it, ov);
        body.appendChild(rowEl);
      }
    }
    render();

    // 📰 Egon 23.09.2026 (W-UI180) — THE "WHOLE NOTE" WINDOW. Tapping a note in the list opens THIS on
    // top of the panel: a window as wide as the panel itself in which the note's FULL text fits without
    // being cut off. Its footer carries the navbar button of the page the note is about ON TOP of the
    // done row (item 2 of Egon's request), then the back-arrow to the list and "Got it".
    function closeDetail() {
      if (!detailEl) return;
      var el = detailEl, c = el.firstChild;
      detailEl = null;
      try { el.style.opacity = "0"; } catch (e) {}
      try { if (c) c.style.transform = "translateY(10px) scale(.97)"; } catch (e) {}
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    }
    // Take the visitor to the page the note is about: every window closes, the page is switched, and the
    // (Egon 22.10.2026: the "I'm HERE" badge is retired — the page button just opens the page.)
    function goNewsPage(pg) {
      if (!pg) return;
      closeDetail();
      close();
      setTimeout(function () {
        // 💬 the Chat is a floating window, not a page-state (goPage would fall back to home):
        // open it directly; the page button just opens the page, nothing more to mark.
        if (pg.page === "chat") { try { if (window.dragonChatOpen) window.dragonChatOpen(); } catch (e) {} }
        else try { if (window.dragonGoPage) window.dragonGoPage(pg.page); } catch (e) {}
      }, 240);
    }
    function openDetail(it, ov) {
      if (detailEl) return;
      var pg = newsPageOf(it);
      var o2 = document.createElement("div");
      o2.id = "dragonNewsDetail";
      o2.style.cssText = "position:absolute; inset:0; z-index:2; display:flex; align-items:center; justify-content:center; padding:.7rem; background:rgba(4,4,8,.62); -webkit-backdrop-filter:blur(3px); backdrop-filter:blur(3px); opacity:0; transition:opacity .2s ease;";
      var dc = document.createElement("div");
      dc.className = "dragon-news-detail-card";
      dc.style.cssText = "width:100%; max-width:min(560px,96vw); max-height:100%; display:flex; flex-direction:column; border-radius:16px; border:1px solid rgba(155,107,255,.55); background:radial-gradient(120% 80% at 50% 0%, rgba(155,107,255,.16), transparent 60%), linear-gradient(180deg,#1b1b26,#0d0d13); box-shadow:0 20px 60px rgba(0,0,0,.75); overflow:hidden; transform:translateY(10px) scale(.97); transition:transform .25s cubic-bezier(.2,.8,.2,1);";
      var dh = document.createElement("div");
      dh.style.cssText = "flex:0 0 auto; display:flex; align-items:flex-start; gap:.5rem; padding:.65rem .75rem; border-bottom:1px solid rgba(255,255,255,.08); background:linear-gradient(180deg,rgba(255,255,255,.03),transparent);";
      var dtxt = document.createElement("div");
      dtxt.style.cssText = "flex:1 1 auto; min-width:0;";
      var dd = document.createElement("div");
      dd.className = "dragon-news-detail-date";
      dd.textContent = it.date || "";
      dd.style.cssText = "font-size:.64rem; font-weight:800; color:#ffb3c0; letter-spacing:.03em; margin-bottom:.15rem;";
      var dtt = document.createElement("div");
      dtt.className = "dragon-news-detail-title";
      dtt.textContent = (ov && ov.name) || it.nameFull || it.name || "";
      dtt.style.cssText = "font-size:.92rem; font-weight:900; color:#efe9ff; line-height:1.25;";
      dtxt.appendChild(dd); dtxt.appendChild(dtt);
      var dx = document.createElement("button");
      dx.type = "button"; dx.textContent = "\u2715"; dx.title = "Close";
      dx.style.cssText = "flex:0 0 auto; width:1.8rem; height:1.8rem; border-radius:50%; border:1px solid rgba(155,107,255,.45); background:rgba(255,255,255,.04); color:#cbbcf0; cursor:pointer; font-size:.8rem; line-height:1; padding:0;";
      dh.appendChild(dtxt); dh.appendChild(dx);
      var db = document.createElement("div");
      db.className = "dragon-news-detail-body";
      db.style.cssText = "flex:1 1 auto; overflow-y:auto; padding:.7rem .8rem; font-size:.78rem; line-height:1.55; color:#d6cdec; white-space:pre-wrap;";
      db.textContent = (ov && ov.desc) || it.descFull || it.desc || ui().empty;
      var df = document.createElement("div");
      df.style.cssText = "flex:0 0 auto; display:flex; flex-direction:column; gap:.45rem; padding:.6rem .75rem; border-top:1px solid rgba(255,255,255,.08);";
      if (pg) {
        var pb = document.createElement("button");
        pb.type = "button";
        pb.id = "dragonNewsPageBtn";
        pb.textContent = pg.icon + " " + pg.label;
        pb.title = "Go to the " + pg.label + " page";
        pb.style.cssText = "width:100%; padding:.5rem 1rem; font-size:.82rem; font-weight:800; border-radius:11px; cursor:pointer; color:#efe6ff; border:1px solid rgba(155,107,255,.6); background:linear-gradient(180deg,#2b2140,#171320); box-shadow:0 4px 14px rgba(155,107,255,.25);";
        pb.onclick = function (e) { e.stopPropagation(); goNewsPage(pg); };
        df.appendChild(pb);
      }
      var drow = document.createElement("div");
      drow.style.cssText = "display:flex; gap:.45rem; align-items:center;";
      var back = document.createElement("button");
      back.type = "button";
      back.textContent = "\u2B05 " + ui().title;
      back.title = "Back to the list";
      back.style.cssText = "flex:1 1 auto; padding:.5rem 1rem; font-size:.82rem; font-weight:800; border-radius:11px; cursor:pointer; color:#cbbcf0; border:1px solid rgba(155,107,255,.4); background:rgba(255,255,255,.04);";
      back.onclick = function (e) { e.stopPropagation(); closeDetail(); };
      var ok2 = document.createElement("button");
      ok2.type = "button";
      ok2.textContent = "\u2713 " + ui().got;
      ok2.style.cssText = "flex:1 1 auto; padding:.5rem 1.2rem; font-size:.84rem; font-weight:bold; border-radius:11px; cursor:pointer; color:#fff; border:1px solid #b79bff; background:linear-gradient(180deg,#7a4ddb,#4a2a94); box-shadow:0 6px 18px rgba(155,107,255,.4);";
      ok2.onclick = function (e) { e.stopPropagation(); close(); };
      drow.appendChild(back); drow.appendChild(ok2);
      df.appendChild(drow);
      dc.appendChild(dh); dc.appendChild(db); dc.appendChild(df);
      o2.appendChild(dc);
      o.appendChild(o2);
      detailEl = o2;
      dx.onclick = function (e) { e.stopPropagation(); closeDetail(); };
      o2.addEventListener("click", function (e) { if (e.target === o2) closeDetail(); });
      requestAnimationFrame(function () { try { o2.style.opacity = "1"; dc.style.transform = "translateY(0) scale(1)"; } catch (e) {} });
    }
    window.dragonNewsOpenDetail = openDetail;
    window.dragonNewsCloseDetail = closeDetail;

    function close() {
      if (!notesOverlay) return;
      var el = notesOverlay;
      notesOverlay = null;
      detailEl = null;
      el.style.opacity = "0";
      card.style.transform = "translateY(8px) scale(.98)";
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
      document.removeEventListener("keydown", esc);
    }
    function esc(ev) { if (ev.key === "Escape") { if (detailEl) closeDetail(); else close(); } }
    xb.onclick = close; ok.onclick = close;
    o.addEventListener("click", function (e) { if (e.target === o) close(); });
    document.addEventListener("keydown", esc);

    trBtn.onclick = function (e) {
      e.stopPropagation();
      if (LANG === "en") { if (window.dragonToast) dragonToast("🌐 this is already English 🙂"); return; }
      if (!window.root || typeof window.root.generateText !== "function") { if (window.dragonToast) dragonToast("🌐 translator isn't ready yet"); return; }
      trBtn.disabled = true;
      trBtn.textContent = ui().tring;
      var src = ITEMS.slice(0, 22).map(function (it) { return it.n + ") " + it.name + (it.desc ? " — " + it.desc : ""); }).join("\n");
      var langName = { tr: "Turkish", de: "German", fr: "French", es: "Spanish", it: "Italian", ru: "Russian", pt: "Portuguese", ar: "Arabic", nl: "Dutch", pl: "Polish", ja: "Japanese", zh: "Chinese", ko: "Korean" }[LANG] || LANG;
      var out = "";
      try {
        var g = window.root.generateText({
          instruction: "Translate each numbered line below into " + langName + ". Keep the SAME line numbers and the SAME one-line-per-entry format (\"N) translated title — translated description\"). Translate the text only; keep emoji and product names as-is. Output ONLY the translated lines, nothing else.\n\n" + src,
          onChunk: function (d) { if (d && d.textChunk) out += d.textChunk; }
        });
        Promise.resolve(g).then(function (fin) {
          try { if (fin && typeof fin === "object" && fin.text) out = fin.text; else if (typeof fin === "string" && fin) out = fin; } catch (er) {}
          var res = [];
          String(out || "").split("\n").forEach(function (ln) {
            var m = ln.match(/^\s*(\d+)\)\s*(.+)$/);
            if (!m) return;
            var n = parseInt(m[1], 10), rest = m[2].trim();
            var parts = rest.split(/\s+—\s+/);
            res.push({ n: n, name: parts[0].trim(), desc: parts.length > 1 ? parts.slice(1).join(" — ").trim() : "" });
          });
          if (!res.length) { if (window.dragonToast) dragonToast("🌐 translation failed — try again"); trBtn.disabled = false; trBtn.textContent = ui().tr; return; }
          var c = loadTrCache(); c[trKey()] = res; saveTrCache();
          trBtn.textContent = ui().tr;
          render();
        }).catch(function () {
          trBtn.disabled = false; trBtn.textContent = ui().tr;
          if (window.dragonToast) dragonToast("🌐 translation failed — try again");
        });
      } catch (er) {
        trBtn.disabled = false; trBtn.textContent = ui().tr;
      }
    };

    card.appendChild(head); card.appendChild(body); card.appendChild(foot);
    o.appendChild(card);
    document.body.appendChild(o);
    notesOverlay = o;
    requestAnimationFrame(function () { o.style.opacity = "1"; card.style.transform = "translateY(0) scale(1)"; });
  };

  // (Egon 22.10.2026: the "I'm HERE" badge is retired — the page button just opens the page.)
  // 📰 W-UI180 (items 3 & 5) — the Dexa chat's news offer is now INTERACTIVE: its main chip opens the
  // newest note straight in its OWN window (full text + the page button), and when the note is about a
  // page the chat also carries that page's navbar button, so e.g. "Galleries" is reachable from the chat.
  function openNoteWindow(it) {
    if (!window.dragonOpenUpdateNotes) return;
    try { window.dragonOpenUpdateNotes(); } catch (e) { return; }
    setTimeout(function () {
      try { if (typeof window.dragonNewsOpenDetail === "function") window.dragonNewsOpenDetail(it, null); } catch (e) {}
    }, 320);
  }
  function offerNewsChat(it) {
    try {
      if (!window.dragonBotAPI || typeof window.dragonBotAPI.action !== "function") return;
      window.dragonBotAPI.action(ui().offerBtn, function () { openNoteWindow(it); });
      var pg = newsPageOf(it);
      if (pg) {
        window.dragonBotAPI.action(pg.icon + " " + pg.label, function () {
          if (window.dragonGoPage) window.dragonGoPage(pg.page);
        });
      }
    } catch (e) {}
  }
  window.dragonNewsOfferChat = offerNewsChat;

  /* ---------- 7) Personalized news message: PRE-BUILT + PRE-SENT so Dexa is instant ---------- */
  // Egon 16.09.2026 — REDESIGNED. The note is now PRE-GENERATED and PRE-SENT the moment a new Update
  // Notes entry exists, so opening Dexa's chat shows it INSTANTLY. (Before: the chat opened with a
  // placeholder "…" and generated the note on the fly — it felt empty.) The red "!" now means exactly
  // "Dexa has a message for you".
  var LS_MSG = "dragonNewsMsg";   // { "<lang>|<n>": text }
  var _msgCache = null;
  var _offeredN = null;
  function loadMsgCache() {
    if (_msgCache) return _msgCache;
    try { _msgCache = JSON.parse(lsGet(LS_MSG) || "{}") || {}; } catch (e) { _msgCache = {}; }
    return _msgCache;
  }
  function saveMsgCache() { try { lsSet(LS_MSG, JSON.stringify(_msgCache || {})); } catch (e) {} }
  function cachedMsg(n) { var c = loadMsgCache(); return c[LANG + "|" + n] ? (scrubNote(c[LANG + "|" + n]) || c[LANG + "|" + n]) : null; }
  function toldN() { return numOf(lsGet(LS_TOLD)); }
  function chatSeenN() { return numOf(lsGet(LS_CHATSEEN)); }
  // The red "!" means exactly "Dexa has a message for you". Once the visitor has OPENED the chat and
  // seen that message, it must stay off — even though the Update Notes panel (and its "News" badge)
  // may still be unread. This is why the "!" is NOT tied to unread() alone.
  function shouldRedMark() {
    var un = unread();
    if (!un.length) return false;
    var c = chatSeenN();
    return c === null || c < un[0].n;
  }
  // Lowest possible number in the CURRENT public feed (the developer changelog used a totally
  // different numbering up to ~311, which is why a stale LS_TOLD could block every announcement).
  function minItemN() { return ITEMS.length ? ITEMS[ITEMS.length - 1].n : 0; }
  function dexaLangName() {
    return { tr: "Turkish", de: "German", fr: "French", es: "Spanish", it: "Italian", ru: "Russian", pt: "Portuguese", ar: "Arabic", nl: "Dutch", pl: "Polish", ja: "Japanese", zh: "Chinese", ko: "Korean" }[LANG] || "English";
  }
  function fallbackMsg(it) {
    if (LANG === "tr") return "\uD83D\uDC09 Merhaba! Yeni bir g\u00FCncelleme var: \u201C" + it.name + "\u201D" + (it.desc ? " \u2014 " + it.desc : "") + " \u2014 G\u00FCncelleme Notlar\u0131'ndan bakabilirsin \u2728";
    return "\uD83D\uDC09 Hi! There's a new update: \u201C" + it.name + "\u201D" + (it.desc ? " \u2014 " + it.desc : "") + " \u2014 you can see it in Update Notes \u2728";
  }
  // Name sanity + output guard, shared with the talk bubbles: a leaked placeholder value ("undefined") or
  // another companion's name must never appear in Dexa's note — neither from the stored name nor from the
  // sentence the model produced.
  function validNewsName(s) {
    try { if (typeof window.dragonBotValidName === "function") return window.dragonBotValidName(s) ? String(s).trim() : ""; } catch (e) {}
    if (typeof s !== "string") return "";
    s = s.trim();
    if (!s || /^(undefined|null|nan|none|true|false|unknown|user|visitor|guest|you)$/i.test(s)) return "";
    return s;
  }
  function scrubNote(t) {
    return String(t || "")
      .replace(/[\s,]*\b(?:undefined|null|nan)\b/gi, "")
      .replace(/\bsexa\b/gi, "Dexa")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  function genMsg(it, cb) {
    if (!window.root || typeof window.root.generateText !== "function") { cb(fallbackMsg(it)); return; }
    var nm = validNewsName(window.dragonBotAPI && window.dragonBotAPI.userName ? window.dragonBotAPI.userName() : "");
    var prompt = "You are Dexa, the friendly dragon AI helper of \"Best AI Image Generator\". You are greeting a returning visitor and telling them about the newest update we shipped, like a warm welcome-back message. You are the only companion of the site: never mention, name, hint at or invent any other assistant or persona, and never invent the visitor's name.\n" +
      "NEWEST UPDATE: \"" + it.name + "\"" + (it.desc ? " — " + it.desc.slice(0, 220) : "") + " (shipped " + it.date + ")\n" +
      (nm ? "The visitor's name (from your earlier chat) is " + nm + " — address them by name.\n" : "") +
      "Reply in " + dexaLangName() + ". Max 2 short sentences. Be cheerful and personal, mention the update in your own words (never say you are an AI language model), and invite them to try it. No markdown, no lists, emoji ok.";
    var txt = "";
    try {
      var g = window.root.generateText({ instruction: prompt, onChunk: function (d) { if (d && d.textChunk) txt += d.textChunk; } });
      Promise.resolve(g).then(function (fin) {
        try { if (fin && typeof fin === "object" && fin.text) txt = fin.text; else if (typeof fin === "string" && fin) txt = fin; } catch (er) {}
        txt = scrubNote(String(txt || "").replace(/```[\s\S]*?```/g, "").trim()).slice(0, 320);
        cb(txt || fallbackMsg(it));
      }).catch(function () { cb(fallbackMsg(it)); });
    } catch (er) { cb(fallbackMsg(it)); }
  }
  // Pre-build the note for the newest unread update, then PRE-SEND it into the chat log (called at boot,
  // so the message is already waiting when the visitor opens Dexa). Delivered once per update per user.
  function deliver(it, text) {
    if (!text) return false;
    if (toldN() !== null && toldN() >= it.n) return false;   // already delivered
    var c = loadMsgCache(); c[LANG + "|" + it.n] = text; saveMsgCache();
    try {
      if (window.dragonBotAPI && window.dragonBotAPI.post) window.dragonBotAPI.post(text, { forBot: "dexa" });
      else if (window.dragonBotAPI && window.dragonBotAPI.say) window.dragonBotAPI.say(text);
    } catch (e) {}
    lsSet(LS_TOLD, String(it.n));
    // If the chat is already open the visitor is reading it right now → never flash the "!".
    var open = false;
    try { open = !!(window.dragonBotAPI && window.dragonBotAPI.isOpen && window.dragonBotAPI.isOpen()); } catch (e) {}
    if (open) lsSet(LS_CHATSEEN, String(it.n));
    else showRedMark();                                      // "!" = Dexa has a message for you
    return true;
  }
  function prepareNews() {
    var un = unread();
    if (!un.length) return;
    var it = un[0], n = it.n;
    if (toldN() !== null && toldN() >= n) return;            // already delivered
    var cached = cachedMsg(n);
    if (cached) { deliver(it, cached); return; }             // cached on an earlier visit but not sent yet
    genMsg(it, function (text) {
      if (!text) return;
      if (!unread().length) return;                          // the visitor already opened the notes
      deliver(it, text);
    });
  }
  window.dragonBotOnOpen = function () {
    try { if (window.dragonBotOnOpenTalk) window.dragonBotOnOpenTalk(); } catch (e) {}
    // Egon 18.09.2026 — the update note belongs to DEXA. If the visitor is in another chat, never deliver
    // it there: Egon got the "welcome back + newest update" blurb instead of the normal greeting. Dexa keeps the note and the
    // "!" until his OWN chat is opened.
    try { if (window.dragonBotAPI && window.dragonBotAPI.currentBot && window.dragonBotAPI.currentBot() !== "dexa") return; } catch (e) {}
    var un = unread();
    if (!un.length) return;
    var it = un[0];
    var already = (toldN() !== null && toldN() >= it.n);
    if (!already) {
      // Instant: use the pre-generated note, otherwise a short deterministic line.
      var txt = cachedMsg(it.n) || fallbackMsg(it);
      try {
        if (window.dragonBotAPI && window.dragonBotAPI.post) window.dragonBotAPI.post(txt, { forBot: "dexa" });
        else if (window.dragonBotAPI && window.dragonBotAPI.say) window.dragonBotAPI.say(txt);
      } catch (e) {}
      lsSet(LS_TOLD, String(it.n));
    }
    // The visitor has now seen Dexa's message (or it was already delivered) → clear the "!" for good.
    lsSet(LS_CHATSEEN, String(it.n));
    hideRedMark();
    // Offer the Update Notes button (once per update, while its "!" is still waiting).
    if (_offeredN !== it.n) {
      _offeredN = it.n;
      // 📰 W-UI180 (items 3 & 5) — the old plain "Open Update Notes" chip is replaced by the interactive
      // offer: the note's own window, plus the note's page as a navbar button.
      offerNewsChat(it);
    }
  };
  window.dragonNewsPrepare = prepareNews;

  /* ---------- 8) boot ---------- */
  // Egon 16.09.2026 — one-time footprint migration. The public feed was backfilled with the FULL
  // release history, so the highest entry number jumped sharply. Any returning visitor who had
  // already seen the older feed must NOT suddenly be told that 160+ items are "new": on the first
  // load after this migration we silently advance their seen-marker to the current latest. Genuinely
  // new entries added afterwards still light up the badge as usual.
  function migrateSeenOnce() {
    try {
      if (lsGet("dragonNewsMig2") === "1") return;
      lsSet("dragonNewsMig2", "1");
      var s = seenN();
      if (s !== null) lsSet(LS_SEEN, String(LATEST));
    } catch (e) {}
  }
  // Egon 16.09.2026 — the OLD dev-changelog feed numbered entries up to ~311, and LS_TOLD was written
  // with those numbers. Against the new [U<n>] feed (max = LATEST) such a stale value is always >=
  // every item, so prepareNews() bailed and Dexa stayed silent ("we're just clicking for nothing"). On the
  // first load after this migration we clamp any out-of-range value down to what the visitor has
  // already seen, so the newest unread update gets announced exactly once.
  function migrateToldOnce() {
    try {
      if (lsGet("dragonNewsMig3") === "1") return;
      lsSet("dragonNewsMig3", "1");
      var t = toldN();
      if (t !== null && t >= minItemN() && t <= LATEST) return;   // valid current-scheme value → keep
      if (t !== null) lsSet(LS_TOLD, String(effectiveSeen()));
    } catch (e) {}
  }
  function boot() {
    migrateSeenOnce();
    migrateToldOnce();
    ensureBadgeCss();
    syncBadge();
    setInterval(syncBadge, 4000);
    var un = unread();
    log("boot items=" + ITEMS.length + " latest=" + LATEST + " seen=" + seenN() + " unread=" + un.map(function (i) { return i.n; }).join(","));
    if (!un.length) { hideRedMark(); log("boot: nothing unread"); return; }
    prepareNews();   // Egon 16.09.2026 — pre-generate + pre-send the note so opening Dexa is instant
    var shownN = numOf(lsGet(LS_SHOWN));
    if (isFirstTimer() && shownN === null) { log("boot: first timer → no ticker"); return; }  // first visit: no ticker (the welcome window explains it), only the NEW badge
    setTimeout(function () {
      log("boot+2.2s ss=" + screenSaverOn() + " shownN=" + lsGet(LS_SHOWN));
      if (screenSaverOn()) { if (shouldRedMark()) showRedMark(); return; }
      if (!(shownN !== null && shownN >= un[0].n)) {
        // if the welcome window is open, wait for it to close
        var tries = 0;
        var wait = setInterval(function () {
          tries++;
          if (!document.getElementById("dragonGuideOverlay") || tries > 40) {
            clearInterval(wait);
            log("boot: show ticker n=" + un[0].n + " tries=" + tries);
            if (!shouldRedMark()) return;
            if (!screenSaverOn()) showTicker(un[0], function () { });
            else showRedMark();
          }
        }, 500);
      } else {
        if (shouldRedMark()) showRedMark();                 // ticker played, user didn't open it → jiggling "!"
      }
    }, 2200);
  }

  window.dragonNews = {
    items: ITEMS, latest: LATEST, unread: unread, markSeen: markSeen,
    lang: LANG, open: function () { window.dragonOpenUpdateNotes(); },
    _log: LOG, showTickerTest: function () { var un = unread(); if (un.length) showTicker(un[0], function () {}); return un.map(function (i) { return i.n; }); }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 0); });
  else setTimeout(boot, 0);
})();
