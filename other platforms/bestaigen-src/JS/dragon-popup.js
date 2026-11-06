// ============================================================================
// 🆕 INTERACTIVE POPUP (dragon-popup) — Egon 25.09.2026 (W-EFOR282)
// ----------------------------------------------------------------------------
// Egon's brief (verbatim, 25.09.2026): "#closecodeadmin sayfasını, what's new, interaktif popup, mmm
// numaralandırma + bir kez görünme + rapor tablosu çalışmasına başla" and, as the first popup he wanted to
// try: one site-wide question — "are you noticing any slowness?" — where picking YES opens the places it
// is felt (the gallery page, while generating, the whole site, while the page opens, the image editor, the
// private gallery) and picking NO opens nothing at all.
//
// WHAT THIS IS: the one small window through which the site can ASK the visitor something and get the
// answer back as numbers. It is deliberately not an announcement (the update notes already do that).
//
// THE NUMBER IS THE IDENTITY (`mmm`): every popup gets its own number — 1, 2, 3 … — and that single number
// ties together (a) the definition in index.html, (b) the counters in the server's POPUP region, (c) the
// visitor's "already seen it" flag and (d) the rows of the admin report. The server's stats payload
// carries the number of the popup that is live (`popupMmm`), and this module only ever shows
// `window.DRAGON_POPUP` when its own `mmm` is the number the server reports — so a tab still running an
// older build shows NOTHING rather than a stale popup.
//
// SHOWN ONCE, AND NEVER TO A FIRST-TIME VISITOR: `localStorage.dragonPopupSeen` holds the newest popup
// number this browser has been shown. NULL (a visitor we have never seen) is not "sees popup 1": it
// silently records the current number and shows nothing — nobody should be greeted by a survey — while
// anybody whose stored number is LOWER gets the popup exactly once, after which the number is written up
// to the newest. A visitor away for five popups therefore comes back to ONE window (the current one).
// Egon 22.10.2026: AND NEVER IN THE FIRST HOUR — `localStorage.dragonPopupFirst` stamps the first load
// that ever ran this module; canShow stays false until an hour passes since then. (The geo marker alone
// cannot guard this: it may land before this deferred module boots.)
//
// THE COUNTERS ARE HONEST: "I was shown this" is reported the moment the window is painted (so the report
// can say how many people saw it) and the answers are sent only when Send is pressed. The server dedupes
// both per visitor AND per network, so a reload — or a client that lies — cannot inflate either number.
//
// THE SITE NEVER TALKS OVER ITSELF: the popup holds the shared scrolling-banner lane
// (`window.dragonMarquee`) while it is open, exactly like the reload notice and the news ticker, so it can
// only appear in a quiet moment and no banner can start underneath it.
//
// Exposed on `window`:
//   dragonPopupShow(def, opts)   open a popup window (opts.test = never touch localStorage or the server)
//   dragonPopupTest()            open the LIVE popup in test mode and report what was measured (check-up)
//   dragonPopupClose()           close it (and give the lane back); returns whether one was open
//   dragonPopupReset()           forget the "already seen" flag
//   dragonPopupServerMmm(n)      the number the SERVER says is live (called from the stats payload)
//   dragonPopupState()           what this module is doing right now (the check-up reads this)
//   dragonPopupLabels(mmm)       the historical labels of a popup number (the admin report reads this)
// ============================================================================
(function () {
  var LS_SEEN = "dragonPopupSeen";
  var LS_REMIND = "dragonPopupRemind";
  var REMIND_MS = 60 * 60 * 1000; // Remind Me Later = 1 hour (Egon 29.09.2026)
  var LS_FIRST = "dragonPopupFirst";
  var FIRST_MS = 60 * 60 * 1000; // Egon 22.10.2026: no popup in the first hour after the first load
  var QMAX = 8;   // mirrors POP_QMAX on the server — one popup may ask at most this many questions
  var OMAX = 8;   // mirrors POP_OMAX — one question may offer at most this many answers

  // ---- the HISTORY of every popup number ever published ------------------------------------------------
  // The admin report only has NUMBERS, so the labels of a popup that is no longer live have to be kept
  // somewhere durable on the client. A retired popup is moved here; its full text also goes to the
  // encrypted Popupbook. The question order here is exactly the server's order (q index → q * 8 + option).
  var LABELS = {
    1: {
      title: "A Quick Question About Speed",
      questions: [
        { label: "Are you noticing any slowness while using BestAiGen?", options: [{ label: "Yes, it feels slow" }, { label: "No, it is fine" }] },
        { label: "Where do you notice it most?", options: [{ label: "The gallery page" }, { label: "While a picture is generating" }, { label: "The whole site" }, { label: "While the page opens" }, { label: "In the image editor" }, { label: "In the private gallery" }, { label: "Somewhere else" }, { label: "-" }] }
      ]
    },
    2: {
      title: "Hi! Please give us 30 second and join our Survey",
      questions: []
    }
  };

  window.dragonPopupLabels = function (mmm) { return LABELS[Number(mmm) | 0] || null; };

  // ---- the survey invite speaks the visitor's language (Egon 29.09.2026) --------------------------------
  // Dexa's messages and the survey panel already localise through the page detector; the popup had stayed
  // English. When a definition carries `i18n: "surveyInvite"`, the title, the survey action and the Remind
  // button are shown in the visitor's own browser language (the 14 the generator speaks).
  var POPUP_LANGS = ["en", "tr", "de", "fr", "es", "it", "ru", "pt", "ar", "nl", "pl", "ja", "zh", "ko"];
  var SURVEY_INVITE_TXT = {
    en: { title: "Hi! Please give us 30 second and join our Survey", take: "Take the Survey", remind: "Remind Me Later!" },
    tr: { title: "Merhaba! 30 saniyeni ayir ve Anketimize katil", take: "Ankete Katil", remind: "Daha Sonra Hatirlat!" },
    de: { title: "Hi! Schenk uns 30 Sekunden und mach bei unserer Umfrage mit", take: "An der Umfrage teilnehmen", remind: "Spater erinnern!" },
    fr: { title: "Salut ! Accorde-nous 30 secondes et participe a notre sondage", take: "Repondre au sondage", remind: "Me le rappeler plus tard !" },
    es: { title: "Hola! Regalanos 30 segundos y participa en nuestra encuesta", take: "Participar en la encuesta", remind: "Recuerdamelo mas tarde!" },
    it: { title: "Ciao! Regalaci 30 secondi e partecipa al nostro sondaggio", take: "Partecipa al sondaggio", remind: "Ricordamelo piu tardi!" },
    ru: { title: "Привет! Удели нам 30 секунд и пройди наш опрос", take: "Пройти опрос", remind: "Напомнить позже!" },
    pt: { title: "Ola! Da-nos 30 segundos e responde ao nosso questionario", take: "Responder ao questionario", remind: "Lembrar-me mais tarde!" },
    ar: { title: "مرحبًا! امنحنا 30 ثانية وشارك في استبياننا", take: "شارك في الاستبيان", remind: "ذكّرني لاحقًا!" },
    nl: { title: "Hoi! Geef ons 30 seconden en doe mee aan onze enquete", take: "Doe mee aan de enquete", remind: "Herinner me later!" },
    pl: { title: "Czesc! Poswiec nam 30 sekund i wez udzial w naszej ankiecie", take: "Wez udzial w ankiecie", remind: "Przypomnij pozniej!" },
    ja: { title: "こんにちは！30秒だけアンケートにご協力ください", take: "アンケートに答える", remind: "あとで知らせる！" },
    zh: { title: "你好！请花30秒参加我们的问卷", take: "参加问卷", remind: "稍后提醒我！" },
    ko: { title: "안녕하세요! 30초만 설문에 참여해 주세요", take: "설문 참여하기", remind: "나중에 알림!" }
  };
  function popupLang() {
    var l = "en";
    try { if (typeof window.detectUserLang === "function") l = String(window.detectUserLang() || "en"); } catch (e) {}
    if (POPUP_LANGS.indexOf(l) === -1) {
      try { var n = String((navigator.languages && navigator.languages[0]) || navigator.language || "en").toLowerCase().slice(0, 2); l = (POPUP_LANGS.indexOf(n) !== -1) ? n : "en"; } catch (e) { l = "en"; }
    }
    return (POPUP_LANGS.indexOf(l) !== -1) ? l : "en";
  }
  function surveyInviteText() { return SURVEY_INVITE_TXT[popupLang()] || SURVEY_INVITE_TXT.en; }

  // ---- small helpers ----------------------------------------------------------------------------------
  function say(m) { try { console.warn("dragon-popup: " + m); } catch (e) {} }
  function lsGet(k) { try { return localStorage[k]; } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage[k] = v; } catch (e) {} }
  function myUid() {
    try { if (window.dragonCommentUid) return String(window.dragonCommentUid()); } catch (e) {}
    try { var v = localStorage.dragonCommentUid; if (v) return String(v); } catch (e) {}
    return "";
  }
  function visible() {
    try { if (document.visibilityState && document.visibilityState !== "visible") return false; } catch (e) {}
    return true;
  }
  function rpc(method, payload) {
    if (!window.dragonServerRpc) return null;
    try { return window.dragonServerRpc(method, JSON.stringify(payload)); } catch (e) { return null; }
  }
  function el(tag, cls, txt) { var d = document.createElement(tag); if (cls) d.className = cls; if (txt != null) d.textContent = txt; return d; }

  // ---- the definition currently in hand ---------------------------------------------------------------
  var live = null;        // the published popup, normalised (null when nothing is published)
  var serverMmm = null;   // the number the SERVER says is live — null until the stats payload arrives
  var open = null;        // the window that is on screen right now
  var showRequested = false;
  var lastShownAt = 0, shownCount = 0, sentCount = 0;

  // One flat, canonical, DEPTH-FIRST order for every question (a revealed sub-question included), so a
  // question keeps the same index on the client and on the server for the whole life of the popup. Options
  // are indexed inside their own question; both are capped by the server's region (8 questions × 8 options).
  function normalise(def) {
    if (!def || typeof def !== "object") return null;
    var mmm = Number(def.mmm) | 0;
    if (!(mmm >= 1)) return null;
    var flat = [];
    function conv(list) {
      var out = [];
      if (!list || !list.length) return out;
      for (var i = 0; i < list.length; i++) {
        var q = list[i];
        if (!q || !q.label) continue;
        var opts = q.options || [];
        if (!opts.length) continue;
        if (flat.length >= QMAX) return out;                    // the region can only hold QMAX questions
        var node = { label: String(q.label), type: (q.type === "multi") ? "multi" : "single", id: "", qi: flat.length, options: [] };
        node.id = String(q.id || ("q" + node.qi));
        flat.push(node);                                        // push BEFORE recursing, so qi is the real index
        for (var j = 0; j < opts.length && node.options.length < OMAX; j++) {
          var op = opts[j];
          if (!op) continue;
          node.options.push({ id: String(op.id || ("o" + j)), label: String(op.label == null ? "-" : op.label), icon: op.icon ? String(op.icon) : "", reveal: null });
        }
        for (var k = 0; k < node.options.length && k < opts.length; k++) {
          var src = opts[k];
          if (src && src.reveal && src.reveal.length) {
            var kids = conv(src.reveal);
            if (kids.length) node.options[k].reveal = kids;
          }
        }
        out.push(node);
      }
      return out;
    }
    var roots = conv(def.questions);
    // 🛡️ A SHIELD NOTICE (W-UI309) asks nothing: it carries ONLY a message and one or more action buttons.
    // Such a popup is valid with zero questions, as long as it has at least one action to offer.
    var actions = [];
    if (def.actions && def.actions.length) {
      for (var ai = 0; ai < def.actions.length && actions.length < 4; ai++) {
        var ac = def.actions[ai];
        if (!ac || !ac.label) continue;
        actions.push({ id: String(ac.id || ("a" + ai)), label: String(ac.label), icon: ac.icon ? String(ac.icon) : "", survey: !!ac.survey });
      }
    }
    if (!flat.length && !actions.length) return null;
    return {
      mmm: mmm,
      kind: (def.kind === "notice") ? "notice" : "survey",
      icon: (def.icon == null) ? "\uD83C\uDD95" : String(def.icon),
      // `shield` = the only way out is the action button: no Close, no click-outside, no Escape. A barrier,
      // not a dialog. Used for the survey invite so the visitor has to take the (single) offered action.
      shield: !!def.shield,
      title: String(def.title || "BestAiGen"),
      body: String(def.body || ""),
      closeLabel: String(def.closeLabel || "Close"),
      sendLabel: String(def.sendLabel || "Send"),
      actions: actions,
      i18n: String(def.i18n || ""),
      // `reachEveryone` is for the FIRST popup ever published: a browser that has never been shown ANY
      // popup has no "already seen" number to compare against, and without this flag it would silently
      // record the number and never see this one. With it, such a browser is asked once — but only if it
      // has been on the site before (see hadPriorVisit), so nobody is greeted by a survey on their very
      // first visit. Every later popup is reached normally by a plain `< seen` comparison.
      reachEveryone: !!def.reachEveryone,
      roots: roots,
      questions: flat
    };
  }
  function setLive(def) {
    var n = normalise(def);
    if (!n && def) say("the published popup definition is not usable and was ignored");
    live = n;
    return n;
  }
  if (window.DRAGON_POPUP) setLive(window.DRAGON_POPUP);
  window.dragonPopupSetLive = function (def) { var n = setLive(def); tryShowSoon(); return n; };

  // ---- the "shown once" rule --------------------------------------------------------------------------
  function seenValue() {
    var v = lsGet(LS_SEEN);
    if (v == null || String(v).trim() === "") return null;
    var n = parseInt(v, 10);
    return isFinite(n) ? n : null;
  }
  function markSeen(mmm) {
    var cur = seenValue();
    if (cur == null || cur < mmm) lsSet(LS_SEEN, String(mmm));
  }
  // The Remind-Me-Later snooze: "mmm:at" — popup mmm may knock again once `at` (epoch ms) passes.
  // It lives in localStorage, so the browser remembers the timer across reloads, and it is cleared
  // the moment the survey is completed once (dragonPopupSealForSurvey), which ends the loop for good.
  function remindGet() {
    try {
      var raw = lsGet(LS_REMIND);
      if (!raw) return null;
      var parts = String(raw).split(":");
      var m = parseInt(parts[0], 10), at = parseInt(parts[1], 10);
      if (!(m >= 1) || !(at >= 1)) return null;
      return { m: m, at: at };
    } catch (e) { return null; }
  }
  function remindSet(mmm, at) { lsSet(LS_REMIND, String(mmm) + ":" + String(at)); }
  function remindClear() { try { localStorage.removeItem(LS_REMIND); } catch (e) {} }
  window.dragonPopupSeenValue = seenValue;
  window.dragonPopupReset = function () { try { localStorage.removeItem(LS_SEEN); } catch (e) {} remindClear(); return true; };

  // ---- the server link --------------------------------------------------------------------------------
  // A popup is only ever shown when the SERVER confirms its number, which is what makes a stale tab harmless.
  window.dragonPopupServerMmm = function (n) {
    var v = Number(n) | 0;
    if (v === serverMmm) return;
    serverMmm = v;
    if (v > 0) tryShowSoon(1800);
  };

  // ---- the window -------------------------------------------------------------------------------------
  function ensureCss() {
    try { if (window.dragonUIEnsureCss) window.dragonUIEnsureCss(); } catch (e) {}
    if (document.getElementById("dragonPopupCss")) return;
    var st = document.createElement("style");
    st.id = "dragonPopupCss";
    st.textContent = [
      ".dg-popup{width:fit-content;max-width:min(520px,calc(100vw - 24px));}",
      ".dg-popup .dg-title{overflow-wrap:break-word;}",
      ".dg-popup-actions .dg-btn{max-width:100%;}",
      ".dg-popup-q{margin:0 0 .7rem;}",
      ".dg-popup-q .dg-caption{display:block;font-size:.86rem;font-weight:700;color:#e7e2fb;opacity:1;margin:0 0 .35rem;}",
      ".dg-popup-opts{display:flex;flex-wrap:wrap;gap:.4rem;}",
      ".dg-popup-opt{display:flex;align-items:center;gap:.4rem;padding:.44rem .72rem;font-size:.8rem;font-weight:600;cursor:pointer;border:1px solid #4a4a5e;border-radius:9px;background:linear-gradient(180deg,#1a1a24,#101018);color:#e7e2fb;text-align:left;}",
      ".dg-popup-opt:hover{border-color:#9b6bff;}",
      ".dg-popup-opt.is-on{border-color:#ffd76a;color:#ffd76a;background:linear-gradient(180deg,#3a3120,#241d10);}",
      ".dg-popup-box{flex:0 0 auto;width:.95rem;height:.95rem;border:1px solid #6a6a80;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;font-size:.7rem;line-height:1;color:#ffd76a;background:#0e0e13;}",
      ".dg-popup-box.is-round{border-radius:50%;}",
      ".dg-popup-mark{font-size:1rem;line-height:1;}",
      ".dg-popup-hint{font-size:.72rem;color:#a99fd0;margin:.15rem 0 .75rem;}",
      ".dg-popup-actions{display:flex;align-items:center;gap:.5rem;justify-content:center;flex-wrap:wrap;}",
      ".dg-popup-status{flex:0 0 auto;font-size:.74rem;color:#8aff9e;min-height:1em;}",
      ".dg-popup-status:empty{display:none;}",
      ".dg-popup-body{margin:0 0 .8rem;}",
      ".dg-popup-remind{background:linear-gradient(180deg,#c02727,#8f1414)!important;border-color:#ff7b7b!important;color:#fff!important;}",
      "@media (max-width:560px){.dg-popup-opts{gap:.3rem;}.dg-popup-opt{font-size:.76rem;padding:.4rem .6rem;}}"
    ].join("\n");
    (document.head || document.documentElement).appendChild(st);
  }

  function close(press) {
    if (!open) return false;
    var o = open;
    open = null;
    try { o.ov.remove(); } catch (e) {}
    try { document.removeEventListener("keydown", o.onKey, true); } catch (e) {}
    try { if (o.laneHeld && window.dragonMarquee && window.dragonMarquee.release) window.dragonMarquee.release(); } catch (e) {}
    if (!o.test) {
      if (press === "remind") remindSet(o.def.mmm, Date.now() + REMIND_MS);
      else if (press !== "survey") markSeen(o.def.mmm);
      if (press === "send") sendAnswers(o);
    }
    return true;
  }
  window.dragonPopupClose = function () { return close(null); };
  window.dragonPopupIsOpen = function () { return !!open; };

  // 🛡️ Run an action button (W-UI309). The window closes FIRST (so the survey is the only overlay on screen),
  // then the action runs. The survey module is part of the deferred boot, so if it has not landed yet we wait
  // for it through the shared `dragonLazyReady` hook rather than failing.
  function runAction(o, ac) {
    if (!open || open !== o) return;
    if (!ac || !ac.survey) { close(null); return; }
    close("survey");
    var goSurvey = function () {
      try {
        if (typeof window.dragonSurveyOpen === "function") window.dragonSurveyOpen();
        else if (window.dragonToast) window.dragonToast("\uD83D\uDCCB The survey is still loading \u2014 please try again in a moment.");
      } catch (e) {}
    };
    if (typeof window.dragonSurveyOpen === "function") goSurvey();
    else if (window.dragonLazyReady) window.dragonLazyReady(goSurvey);
    else setTimeout(goSurvey, 400);
  }

  function sendAnswers(o) {
    var pairs = [];
    var sels = o.sel;
    for (var q = 0; q < o.def.questions.length; q++) {
      var qq = o.def.questions[q];
      var list = sels[qq.id] || [];
      for (var i = 0; i < list.length; i++) {
        for (var j = 0; j < qq.options.length; j++) {
          if (qq.options[j].id === list[i]) { pairs.push([qq.qi, j]); break; }
        }
      }
    }
    o.sentAnswers = pairs.length;
    if (pairs.length) sentCount++;
    rpc("dragonPopupVote", { m: o.def.mmm, u: myUid(), a: pairs });
  }

  // The questions that are on screen right now: the top-level ones, plus (right after their parent) the
  // sub-questions of every option that is currently picked.
  function activeQuestions(def, sels) {
    var out = [];
    (function walk(list) {
      for (var i = 0; i < list.length; i++) {
        var q = list[i];
        out.push(q);
        var picked = sels[q.id] || [];
        for (var j = 0; j < q.options.length; j++) {
          var op = q.options[j];
          if (op.reveal && picked.indexOf(op.id) !== -1) walk(op.reveal);
        }
      }
    })(def.roots);
    return out;
  }

  function paintQuestions(o) {
    var host = o.qHost;
    host.textContent = "";
    var list = activeQuestions(o.def, o.sel);
    o.activeIds = {};
    for (var i = 0; i < list.length; i++) {
      var q = list[i];
      o.activeIds[q.id] = q;
      var box = el("div", "dg-popup-q");
      box.appendChild(el("div", "dg-caption", q.label));
      var row = el("div", "dg-popup-opts");
      row.setAttribute("data-dragon-popup-q", String(q.qi));
      for (var j = 0; j < q.options.length; j++) {
        // each option gets its OWN scope: the handler must close over THIS question and THIS option, never
        // over the loop variable (a plain `var` here would make every button answer with the last option)
        (function (qq, op, oi) {
          var on = (o.sel[qq.id] || []).indexOf(op.id) !== -1;
          var b = el("button", "dg-popup-opt" + (on ? " is-on" : ""));
          b.type = "button";
          b.setAttribute("data-dragon-popup-opt", qq.qi + ":" + oi);
          var bx = el("span", "dg-popup-box" + (qq.type === "single" ? " is-round" : ""), on ? "\u2714" : "");
          b.appendChild(bx);
          if (op.icon) b.appendChild(el("span", "dg-popup-mark", op.icon));
          b.appendChild(el("span", null, op.label));
          b.onclick = function () { pick(o, qq, op); };
          row.appendChild(b);
        })(q, q.options[j], j);
      }
      box.appendChild(row);
      host.appendChild(box);
    }
    return list.length;
  }

  // An answer can never outlive the question it belongs to: the moment an option hides a sub-question, the
  // answers that were given under it are dropped, so nothing that is no longer on screen can be sent.
  function pruneSel(o) {
    var act = activeQuestions(o.def, o.sel);
    var keep = {};
    for (var i = 0; i < act.length; i++) keep[act[i].id] = 1;
    var ids = Object.keys(o.sel);
    for (var j = 0; j < ids.length; j++) if (!keep[ids[j]]) delete o.sel[ids[j]];
  }

  function pick(o, q, op) {
    if (!o.sel[q.id]) o.sel[q.id] = [];
    var list = o.sel[q.id];
    var at = list.indexOf(op.id);
    if (q.type === "multi") {
      if (at === -1) list.push(op.id); else list.splice(at, 1);
    } else {
      o.sel[q.id] = (at === -1) ? [op.id] : [];
    }
    paintQuestions(o);
    pruneSel(o);
  }

  function build(def, opts) {
    ensureCss();
    opts = opts || {};
    var o = {
      def: def, test: !!opts.test, sel: {}, sentAnswers: 0, laneHeld: !!opts.holdLane,
      openedAt: Date.now(), onKey: null
    };
    var ov = el("div", "dg-ov");
    ov.id = "dragonPopupOv";
    var card = el("div", "dg-card dg-popup");
    ov.appendChild(card);
    // A SHIELD has no escape hatch: no click-outside, no Escape, no Close button. Its single action button is
    // the only control on the page while it is up.
    ov.addEventListener("mousedown", function (e) { if (e.target === ov && !o.test && !def.shield) close(null); });
    o.onKey = function (e) { if (e.key === "Escape" && !o.test && !def.shield) { e.stopPropagation(); close(null); } };
    o.ov = ov; o.card = card;

    card.appendChild(el("div", "dg-title", (def.icon ? def.icon + " " : "") + ((def.i18n === "surveyInvite") ? surveyInviteText().title : def.title)));
    if (def.body) card.appendChild(el("div", "dg-text dg-popup-body", def.body));
    var qHost = el("div", "dg-popup-qhost");
    o.qHost = qHost;
    card.appendChild(qHost);
    if (def.kind === "survey") card.appendChild(el("div", "dg-popup-hint", "Your answers are anonymous and go to the site's own counter \u2014 nothing else is stored."));

    var acts = el("div", "dg-popup-actions");
    o.status = el("span", "dg-popup-status", "");
    acts.appendChild(o.status);
    // 🛡️ The ACTION buttons (W-UI309): the only exit from a shield. Each carries what it should DO, so the
    // window itself stays dumb markup and the behaviour (opening the survey) is declared in the definition.
    if (def.actions && def.actions.length) {
      for (var ai2 = 0; ai2 < def.actions.length; ai2++) {
        (function (ac) {
          var ab = el("button", "dg-btn is-primary");
          ab.type = "button";
          ab.setAttribute("data-dragon-popup-action", ac.id);
          if (ac.icon) ab.appendChild(el("span", "dg-popup-mark", ac.icon + " "));
          ab.appendChild(el("span", null, (def.i18n === "surveyInvite" && ac.id === "survey") ? surveyInviteText().take : ac.label));
          ab.onclick = function () { runAction(o, ac); };
          acts.appendChild(ab);
        })(def.actions[ai2]);
      }
    }
    if (!def.shield) {
      var closeBtn = el("button", "dg-btn", def.closeLabel);
      closeBtn.type = "button";
      closeBtn.setAttribute("data-dragon-popup-close", "1");
      closeBtn.onclick = function () { close(null); };
      acts.appendChild(closeBtn);
    }
    // Egon 29.09.2026: a shield's way out is no longer only the action — a red Remind Me Later button
    // sits beside it (same centred row) and snoozes THIS popup for one hour instead of spending its
    // once-only chance. The loop only ends when the survey is completed once (the survey module seals it).
    if (def.shield) {
      var rm = el("button", "dg-btn dg-popup-remind", "⏰ " + ((def.i18n === "surveyInvite") ? surveyInviteText().remind : "Remind Me Later!"));
      rm.type = "button";
      rm.setAttribute("data-dragon-popup-remind", "1");
      rm.onclick = function () { close("remind"); };
      acts.appendChild(rm);
    }
    if (def.kind === "survey") {
      var send = el("button", "dg-btn is-primary", def.sendLabel);
      send.type = "button";
      send.setAttribute("data-dragon-popup-send", "1");
      send.onclick = function () { close("send"); };
      o.sendBtn = send;
      acts.appendChild(send);
    }
    card.appendChild(acts);

    document.body.appendChild(ov);
    document.addEventListener("keydown", o.onKey, true);
    o.questionCount = paintQuestions(o);
    o.optionCount = qHost.querySelectorAll(".dg-popup-opt").length;
    open = o;
    shownCount++;
    lastShownAt = Date.now();
    if (!o.test) rpc("dragonPopupView", { m: def.mmm, u: myUid() });
    return o;
  }

  // ---- showing it -------------------------------------------------------------------------------------
  window.dragonPopupShow = function (def, opts) {
    if (open) return null;
    var n = setLive(def || window.DRAGON_POPUP);
    if (!n) { say("nothing to show"); return null; }
    return build(n, opts);
  };

  var showTimer = null;
  function tryShowSoon(delay) {
    if (showTimer) return;
    showTimer = setTimeout(function () { showTimer = null; tryShow(); }, delay == null ? 2500 : delay);
  }
  // The check-up (and any other long automated pass) suspends the popup while it runs, so a question can
  // never open over a measurement. Suspending does NOT spend the popup's once-only chance.
  var suppressed = false;
  window.dragonPopupSuppress = function (on) {
    suppressed = !!on;
    if (suppressed && open) close(null);   // it really was on screen, so this one counts as shown
    if (!suppressed) tryShowSoon(900);     // give it its chance back the moment the pass is over
    return suppressed;
  };
  // Has this BROWSER been on the site before THIS page load? A brand-new browser must never be greeted by
  // a survey, and `dragonVisitorCC` is the site's own "this browser has been here" mark: it is written a
  // second or two AFTER a session starts, so at the moment this module boots it can only be there from an
  // EARLIER visit. The answer is computed ONCE, at boot, BEFORE this module writes its own marker — see
  // boot() — so the marker can only ever count from the next load onward.
  var priorVisit = null;
  function hadPriorVisit() {
    if (priorVisit !== null) return priorVisit;
    var v = false;
    try { if (localStorage.dragonPopupEver) v = true; } catch (e) {}
    try { if (!v && localStorage.dragonVisitorCC) v = true; } catch (e) {}
    priorVisit = v;
    return v;
  }
  function canShow() {
    if (suppressed) return false;
    if (open || showRequested || !live) return false;
    if (!window.DRAGON_POPUP) return false;
    if (serverMmm == null || serverMmm !== live.mmm) return false;   // never show what the server does not
    if (!visible()) return false;
    // The survey loop is over the moment the visitor has completed the survey ONCE — seal the popup so
    // it can never knock again, whatever the snooze says.
    try { if (lsGet("dragonSurveyDone") === "1") { remindClear(); markSeen(live.mmm); return false; } } catch (e) {}
    // Never talk over the survey itself: taking the survey must not re-open the invite on top of it.
    try { if (document.querySelector(".dg-card.dg-survey")) return false; } catch (e) {}
    // A Remind-Me-Later snooze for THIS popup holds the window shut until its hour is up.
    try {
      var r = remindGet();
      if (r && r.m === live.mmm && Date.now() < r.at) return false;
    } catch (e) {}
    // Egon 22.10.2026: nothing knocks in the first hour. FIRST is the first load that ever ran this
    // module on this browser; until an hour passes since then this stays false — no popup in the
    // first minutes even when the geo marker won the boot race (see boot()).
    try {
      var first = parseInt(lsGet(LS_FIRST) || "", 10);
      if (!(first >= 1) || Date.now() - first < FIRST_MS) return false;
    } catch (e) { return false; }
    var seen = seenValue();
    if (seen == null) {
      if (!live.reachEveryone) { lsSet(LS_SEEN, String(live.mmm)); return false; }
      if (!hadPriorVisit()) return false;   // a browser we have never seen is not asked anything
      return true;
    }
    return seen < live.mmm;
  }
  function tryShow() {
    if (!canShow()) return false;
    var def = live;
    var viaLane = !!(window.dragonMarquee && window.dragonMarquee.request);
    var go = function (held) {
      showRequested = false;
      if (open || !canShow()) { if (held) { try { window.dragonMarquee.release(); } catch (e) {} } return; }
      try { var r0 = remindGet(); if (r0 && r0.m === def.mmm) remindClear(); } catch (e) {}
      build(def, { holdLane: !!held });
    };
    showRequested = true;
    if (viaLane) { window.dragonMarquee.request(function () { go(true); }); return true; }
    go(false);
    return true;
  }
  window.dragonPopupTryShow = tryShow;
  // Called by the survey module the moment its results are sent once: the snooze is cleared and the live
  // popup is marked seen, so the remind loop ends for good on THIS browser.
  window.dragonPopupSealForSurvey = function () {
    try { remindClear(); } catch (e) {}
    try { if (live) markSeen(live.mmm); } catch (e) {}
    return true;
  };
  window.dragonPopupRemindState = function () { return remindGet(); };

  // ---- the check-up's test hook -----------------------------------------------------------------------
  // Opens the LIVE popup in TEST mode — no server report, no localStorage write, nothing spent — measures
  // it, exercises the reveal link with a throwaway selection, then closes it again.
  window.dragonPopupTest = function () {
    var out = { defined: !!live, mmm: live ? live.mmm : 0, serverMmm: serverMmm, seen: seenValue(), wasOpen: !!open };
    if (!live) { say("no popup is published"); return out; }
    var o = build(live, { test: true });
    out.opened = !!o;
    out.questions = o.questionCount;
    out.options = o.optionCount;
    out.hasSend = !!o.sendBtn;
    out.hasClose = !!o.ov.querySelector("[data-dragon-popup-close]");
    out.shield = !!live.shield;
    out.actions = (live.actions || []).length;
    out.hasAction = !!o.ov.querySelector("[data-dragon-popup-action]");
    out.hasRemind = !!o.ov.querySelector("[data-dragon-popup-remind]");
    var ti = o.card.querySelector(".dg-title");
    out.title = String(ti ? ti.textContent : "").slice(0, 60);
    var r = o.card.getBoundingClientRect();
    out.w = Math.round(r.width); out.h = Math.round(r.height);
    out.fits = r.width > 0 && r.right <= (window.innerWidth + 1) && r.bottom <= (window.innerHeight + 1);
    var before = o.questionCount;
    var q0 = live.roots[0] || live.questions[0];
    if (q0) {
    var revOp = null;
    for (var i = 0; i < q0.options.length; i++) if (q0.options[i].reveal) { revOp = q0.options[i]; break; }
    if (revOp) {
      o.sel[q0.id] = [revOp.id];
      out.questionsAfterReveal = paintQuestions(o);
      out.revealed = out.questionsAfterReveal > before;
      out.revealedOptions = o.qHost.querySelectorAll(".dg-popup-opt").length;
      // answer everything that is on screen (a throwaway selection — no answer is ever sent from here)
      for (var k = 0; k < live.questions.length; k++) {
        var qq = live.questions[k];
        if (!o.activeIds[qq.id] || !qq.options.length) continue;
        o.sel[qq.id] = [qq.options[0].id];
      }
      var answered = 0;
      for (var m = 0; m < live.questions.length; m++) if (o.sel[live.questions[m].id] && o.sel[live.questions[m].id].length) answered++;
      out.answered = answered;
    }
    out.deselect = (function () {
      var list = o.sel[q0.id] || [];
      if (!list.length) return false;
      o.sel[q0.id] = [];
      paintQuestions(o);
      return o.questionCount === before;   // dropping the answer hides the sub-question again
    })();
    }
    close(null);
    out.stillOpen = !!open;
    return out;
  };

  window.dragonPopupState = function () {
    return {
      defined: !!live, mmm: live ? live.mmm : 0, kind: live ? live.kind : "",
      questions: live ? live.questions.length : 0,
      serverMmm: serverMmm, seen: seenValue(), open: !!open, shown: shownCount, sent: sentCount, lastShownAt: lastShownAt
    };
  };

  // ---- first attempts ---------------------------------------------------------------------------------
  function boot() {
    if (!live) say("no popup is published (window.DRAGON_POPUP is missing or unusable)");
    // decide "has this browser been here before" FIRST (it is cached), THEN leave our own marker, so the
    // marker can only count from the NEXT load onward
    hadPriorVisit();
    try { if (!lsGet("dragonPopupEver")) lsSet("dragonPopupEver", "1"); } catch (e) {}
    // Egon 22.10.2026: the 1-hour rule needs its own clock. The geo marker (localStorage.dragonVisitorCC)
    // may be written BEFORE this deferred module boots, so hadPriorVisit() alone cannot tell a first
    // visit from a return — stamp the first boot here and gate on it in canShow().
    try { if (!lsGet(LS_FIRST)) lsSet(LS_FIRST, String(Date.now())); } catch (e) {}
    tryShowSoon(2500);
    // The snooze clock: if the visitor keeps the tab open, the expired Remind-Me-Later must knock again
    // on its own — boot and visibility changes alone would never wake it.
    try {
      setInterval(function () {
        try {
          var r = remindGet();
          if (r && live && r.m === live.mmm && Date.now() >= r.at && !open && visible()) tryShowSoon(500);
          // Egon 22.10.2026: wake the first show too — a tab left open past its first hour knocks on its own.
          else if (!r && live && !open && visible()) tryShowSoon(500);
        } catch (e) {}
      }, 30000);
    } catch (e) {}
    // a hidden tab is no place to ask a question: the popup waits for the visitor to look at the page
    try { document.addEventListener("visibilitychange", function () { if (visible()) tryShowSoon(1200); }); } catch (e) {}
  }
  if (document.readyState !== "loading") boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
