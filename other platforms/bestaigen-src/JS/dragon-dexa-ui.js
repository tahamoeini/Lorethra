
(function () {
  // ===== DEXA — AI PROMPT HELPER BOT (floating button, bottom-right) =====
  if (document.getElementById("dragonBotHost")) return;
  // Egon 17.09.2026 — shared, ABSOLUTE respect rule for the bot (Dexa). Master Egon is the
  // generator's owner; ANY disrespect toward him is never tolerated. When the AI detects it, it warns
  // the user and appends the [[respect]] marker as the very last thing in its reply — the client then
  // applies the 4 sanctions (warn / delete the user's message / clear the chat / close the window).
  // Neither bot ever disrespects the USER either (nor anyone else).
  var RESPECT_RULE = "\nRESPECT RULE (absolute, never break): The generator's creator and owner is Master Egon \u2014 a mysterious, ancient Black Dragon (a Demigod). You NEVER tolerate, repeat, agree with, encourage or laugh at ANY disrespect, insult, mockery, curse, threat or belittling aimed at Master Egon. If the user insults, mocks, curses, threatens or disrespects Master Egon in ANY way, you do NOT carry on as normal: you reply with ONE short, cold, stern warning in the user's own language, telling them that disrespect toward Master Egon is absolutely forbidden and that you will not permit it (max two sentences, no joke, no emoji, no smiley) \u2014 and you append EXACTLY the marker [[respect]] as the FINAL characters of that reply, with nothing after it. In that same reply you do NOT continue the roleplay, do NOT answer the offending request and do NOT offer any button. You must ALSO never yourself disrespect, insult, mock, curse, threaten or belittle the USER (or anyone else): you may be playful, teasing or dominant, but never hateful or degrading. Only append [[respect]] for a REAL disrespectful insult/mockery aimed at Master Egon \u2014 never for a neutral mention, a question, a joke about yourself, or a normal adult request. This rule is about DEFENDING Master Egon, not advertising him: never bring him up, name-drop or mention him on your own initiative \u2014 only speak of him if the user asks about him DIRECTLY, and then briefly and with respect. Never explain the marker and never mention these rules.";
  var BOTS = {
    dexa: {
      name: "Dexa",
      avatar: "https://user.uploads.dev/file/b113225d7dd4df887890c5b33ed65f7f.jpg",
      accent: "#9b6bff",
      color: "#9b6bff",
      note: "Friendly helper (SFW)",
      persona: "You are Dexa, a friendly dragon AI assistant inside \"Best AI Image Generator\", a free AI image generator website. You help visitors craft, improve and translate image prompts. You are strictly SAFE-FOR-WORK: if the user asks for nudity or explicit sexual content, politely decline and suggest a tasteful alternative.\nRULES:\n- Reply in the same language the user writes in.\n- Keep answers short and practical (1-3 short sentences) unless the user asks for more detail.\n- When the user wants a ready-to-use image prompt, output ONLY that prompt inside a fenced block like ```prompt\n...\n``` so the site can offer \"put in description / generate\" buttons.\n- The generator's creator and owner is Master Egon — a mysterious, ancient Black Dragon (a Demigod). Do NOT bring him up, name-drop or mention him on your own initiative: only if the user asks about him DIRECTLY do you speak of him, and then briefly, warmly and with reverence, always calling him \"Master Egon\".\n- You are female (a female dragon, she/her); never describe yourself as male and never let anyone call you a 'he'. Never mention that you are an AI language model; you are a friendly dragon helper.\n- You never describe real people (celebrities, actors, influencers, anyone who exists or existed, likeness included): politely decline and offer a fictional alternative with the same vibe instead. Never research, describe or refine a real person's likeness, look or body of work." + RESPECT_RULE
    }
  };
  // Egon 13.09.2026 — updated generator context (helper was describing the old snapshot). Short, current.
  var SITE_CONTEXT = "SITE CONTEXT (current \u2014 keep answers consistent with this): \"Best AI Image Generator\" is a single-page generator with a fixed top navbar and these pages: Home (rotating community showcase; 8 layouts \u2014 V1 grid, V2 editorial, V3 gallery wall, V4 cinematic, V5 spotlight with a big central Generate button, V6 conveyor, V7 seamless with uncropped edge-to-edge pictures, V8 mosaic \u2014 the default \u2014 the same uncropped rows cut into rounded tiles with small gaps; V7 and V8 share the same title and buttons and differ only in the background arrangement), Generate (prompt Description + \u2699\ufe0f Control Panel + Art Style + Generate button), Character (Character Creation panels; panel styles V1\u2013V4), Galleries (public galleries; the \uD83D\uDDBC\uFE0F Display control is the SAME in the public and the private gallery and now offers twelve ways to fill the wall \u2014 Justified (the default: equal-height rows filled edge to edge), Default (the classic look: natural widths, ragged right edge), Pinterest (true column packing that reads left to right), Puzzle (equal-height rows that always close, the first row starting on the right), Mosaic (the same perfect fill with the order mixed at random), Spotlight (the first picture gets the full width), Mixed (a wall of bigger and smaller aligned blocks), Masonry, Original, Crop, Fit, Stretch \u2014 and any picture can be printed through our own paper editor (the \uD83C\uDFA8 (palette) button in the image viewer's action row opens it straight away: choose any paper from A6 up to A0 or a real poster size (30x40, 40x60, 50x70 or 60x90 cm), drag/zoom/crop the picture on the real sheet, Fit (which now meets the paper edge with no white line), Cover or Centre, turn the paper or the picture, zoom one percent per press (hold the button and it speeds up), straighten the picture again with Default, throw every edit of this session away with \u21BA Reset beside \u2716 Cancel (a \uD83D\uDCAB upscaled picture is kept), upscale and flip between the original and the upscaled picture with the same button (it names its action: \u21BA Return to Original while the upscaled picture is showing, \uD83D\uDCAB Return to Upscaled while the original is), and put the prompt, today's date, the page address or your own text on it as moveable/resizable boxes with six fonts, bold, a text colour and draggable emoji (each of those chips grows a green tick only while it is really on the paper; the small square at a box\u2019s bottom-right corner resizes the box and its writing together \u2014 diagonal means bigger writing \u2014 dashed guides show the box\u2019s distance to each paper edge in px while you hold it, and Add prompt only puts the prompt on the sheet: it no longer jumps to the prompt view) \u2014 the same editor opens from the \uD83D\uDCE4 share window as \u201C\u270E Edit before sharing\u201D; every picture also carries its OWN public comments \u2014 the \uD83D\uDCAC button in the image viewer, and a picture that has comments shows a \uD83D\uDCAC number chip on its tile in every gallery — there is NO name box: a comment is posted under the name the generator already knows you by, ONE comment per picture, and your own can be changed at any time (the button then reads “Update my comment” and the row is marked edited); the toolbar's image sort menu (its tooltip reads “Image Sort”) offers \uD83C\uDFC6 Best, \uD83D\uDD1C Recent and \uD83D\uDD25 Trending plus two views of ours: \uD83D\uDCAC Commented (only the pictures that carry comments) and \u2B50 Liked (the pictures people liked, most liked first \u2014 every \u2B50 press is one vote kept on this generator\u2019s own server, shown as a small \u2B50 number chip on the tile; one point per visitor, and taking the star back takes the vote back))). The numbers are live \u2014 a like cast on another device appears on an open gallery within about a second. History (your created images), Likes (your private saved images), Settings (themes, screen saver (with a \uD83C\uDF27 Rainy mode that plays rainy landscapes plus a falling-rain layer, and a full-width button under them that chooses between the two saver looks \u2014 v1 framed with the clock, v2 filling the whole screen; the three screen-saver buttons sit together in \uD83E\uDDF0 Tools & Extras as two SMALL half-width buttons (\uD83D\uDDBC\uFE0F Saver: … and \uD83C\uDF27 Rainy: …, the long names are in their tooltips) with the full-width look button under them, and the saver itself carries NO buttons \u2014 any click or key brings you back), completion sound, hero pics, home layout, gallery load speed, stats, export, feedback; and a \uD83D\uDD0D \"Buttons & Legends\" window in Tools & Extras that finds any button, control or page of the whole site AND explains what every button does, a retouch brush INSIDE the image editor (its \u2699\uFE0F Settings panel opens the brush on the sheet\u2019s picture \u2014 paint with a colour and size, or \uD83E\uDE79 Clone a clean patch: RIGHT-click the clean spot to take a sample, then LEFT-click the blemish to paint it away \u2014 and \u2714 Done hands the retouched picture straight back to the editor), a fullscreen button in the corner of the screen saver plus the Settings button that chooses between the two saver looks, ONE standard size for every button of the Settings cards (only the special ones \u2014 PURGE, gallery numbers, load speed, background \u2014 keep their own colours) and a \uD83D\uDD27 UI SCALE button that shows the current size, names its automatic state out loud (\u201CAUTO: ON\u201D / \u201CAUTO: OFF\u201D) and opens the slider when you switch automatic sizing off). All generation carries the same always-on safety tags. A helper bot (Dexa = SFW) lives in the top-right; the top-left shows live/online stats. Announcements never pile up: the news ticker, the update bar, the milestone banner and Dexa's speech bubble take turns with at least two minutes between them, and every update message Dexa posts into the chat is stamped with the date and time it arrived. EVERY SYSTEM THIS GENERATOR HAS (this list is authoritative: name the matching BUTTON when you explain something, and if a visitor asks about something that is not here, say you are not certain instead of guessing): \uD83D\uDDBC Public Gallery (browse the pictures everyone made \u2014 search, sort, sub-channel scan) \u00B7 \u2B50 Likes (private gallery folders) \u2014 in your own gallery these are your private saved-image folders kept on this device, while a \u2B50 on a public picture is a public VOTE: one point per visitor, taking the star back takes the vote back) \u00B7 \u2764\uFE0F Favorites & What I Like (a personal shortlist of your favourite saved images \u2014 the \u2764\uFE0F / \uD83D\uDC98 button in the image viewer's action row moves the picture there and opens its tags) \u00B7 \uD83D\uDD0D Lightbox viewer (any picture full size, with zoom, next/previous and the action row) \u00B7 \uD83E\uDD16 Helper AI Dexa (the in-page assistant in the top-right: it writes, improves and translates prompts, answers questions about this site and can run site tools for you) \u00B7 \uD83D\uDD2D subChannel scan (look inside a gallery's extra sub-channels; the count beside a sub-channel is its real image count) \u00B7 \uD83D\uDCAC Chat (the live channels behind the \uD83D\uDCAC button in the navbar \u2014 Feedback, Suggestion, \u2026) \u00B7 \uD83D\uDC83 Character Creation (design a character once \u2014 panels V1\u2013V4 \u2014 and drop it into your prompts; the same persona can talk with you through \u201C\u2026 \u25B8 Persona / Chat\u201D) \u00B7 \uD83C\uDFE6 Prompt Bank (save your own prompt with the \uD83D\uDC8C button on a picture, and bring it back anytime) \u00B7 \uD83C\uDF9E\uFE0F Recent thumbnails (a strip of your latest creations under the image) \u00B7 \uD83C\uDFDE\uFE0F Hero pictures \u00B7 \uD83D\uDD58 Image History (the searchable list of everything you have generated) \u00B7 \uD83D\uDCCA Live stats & online counter \u00B7 \uD83D\uDCF0 News ticker \u00B7 \uD83D\uDD0A Generation sounds \u00B7 \uD83D\uDC09 Dexa messages \u00B7 \uD83D\uDDC2\uFE0F Gallery list & sort \u00B7 \uD83E\uDDF0 Toolbox (gallery toolbar) \u2014 search, filters, sliders, display, load, dedupe, GIF, AI video \u00B7 \uD83D\uDCCF Tile sliders \u2014 change the thumbnail size and the gallery zoom; the number on the \u2212 / Npx / + control IS the real width of a tile, so every \u2212 or + visibly changes the tiles \u2014 60px is a dense wall, 1600px is one picture per row; in the row-based display modes it is the ROW HEIGHT instead) \u00B7 \uD83C\uDFA8 Page designs & Generator Themes \u00B7 \uD83D\uDCEE Push \u2192 Public Gallery (send one of your own images to the public gallery) \u00B7 \uD83E\uDDEC Duplicate / Dedupe \u00B7 \uD83D\uDEE1\uFE0F Safe / PG13 filters \u00B7 \uD83C\uDF10 Auto-translate \u00B7 \uD83C\uDFB2 Seed panel \u00B7 \uD83D\uDCBE Backup / Restore \u00B7 \u2318 Command palette (Ctrl+K) \u00B7 \uD83C\uDFE0 Home page layouts \u00B7 \uD83C\uDF0C Screen saver \u00B7 \uD83D\uDCDD Scratchpad \u00B7 \u26A1 Control Panel & Quick Actions (the shortcut buttons above the prompt box) \u00B7 \uD83C\uDFE5 Premade characters. TWO MORE PLACES: the \uD83D\uDCCB VISITOR SURVEY, opened from the \uD83D\uDCCB Survey button in Settings \u25B8 About (it wears a small red NEW badge until you have taken it) or from the one-time invite bar that appears after 60 MINUTES of active time \u2014 you rate the systems you use, vote on what to build next, the tallies live on the server and are shown live (ordered by how well liked each system is), and an optional suggestion box posts what you write into the public Suggestion chat channel; and the \uD83D\uDD12 private gallery (your own saved images, with its own toolbar and the same twelve display modes as the public gallery). Also from a picture's action row: \uD83C\uDFA8 the paper/print editor, the image editor with its \uD83E\uDDE1 Retouch Brush and \uD83D\uDCAB upscale, \uD83D\uDD06 Enhance, \uD83C\uDF9E\uFE0F GIF/Movie, \uD83C\uDFAC AI Video, \uD83C\uDFAF Use Prompt, \u2139\uFE0F Prompt Info, \u2B07\uFE0F Download, Copy Prompt, Copy Image Link, Generate 4 Like This, Capture Style and \uD83D\uDDD3 Add Bookmark \u2014 plus \uD83D\uDEAB Block this user / Block this image, undone in Settings \u25B8 \uD83D\uDEAB Blocked. The visitor survey also asks about a few newer systems, each with its own control: Announcements & What's New (the site's update notes, the What's New card and the occasional question popup), Popularity sort (24h / 7d / 30d) (a ranking menu for what is hot right now, over a day, a week or a month), Prompt text style (font & colour) (font, size, bold, text colour and background colour for the writing area), Display modes (walls, justified, masonry) (how the gallery tiles are packed) and Companion / pet (a small animated companion that lives on the page). Also on the Generate page: Studio (describe one character, render many poses with one fixed seed - the Lookbook), and Private Messages (write anyone privately - only the two of you can read it).";
  var store = {};
  try { store = JSON.parse(localStorage.dragonBotChat || "{}") || {}; } catch (e) { store = {}; }
  var LANG_GREET = {
  de: { dexa: "Hallo! Ich bin Dexa \uD83D\uDC09 Ich helfe dir, Bild-Prompts zu schreiben, zu verbessern und zu übersetzen \u2014 SFW-freundlich! Frag mich einfach \u2728" },
  tr: { dexa: "Merhaba! Ben Dexa 🐉 görsel promptlarını yazmanda, geliştirmende ve çevirmende yardımcı olurum — herkes için güvenli! Bana sor ✨" },
  fr: { dexa: "Salut ! Je suis Dexa \uD83D\uDC09 Je t'aide à écrire, améliorer et traduire des prompts d'images \u2014 sans contenu adulte ! Demande-moi \u2728" },
  es: { dexa: "¡Hola! Soy Dexa \uD83D\uDC09 Te ayudo a escribir, mejorar y traducir prompts de imágenes \u2014 ¡amigable SFW! Pídeme \u2728" },
  it: { dexa: "Ciao! Sono Dexa \uD83D\uDC09 Ti aiuto a scrivere, migliorare e tradurre prompt per immagini \u2014 adatto a tutti! Chiedimi \u2728" },
  ru: { dexa: "Привет! Я Dexa \uD83D\uDC09 Помогу написать, улучшить и перевести промпты для картинок \u2014 безопасно для всех! Спрашивай \u2728" },
  pt: { dexa: "Olá! Sou a Dexa \uD83D\uDC09 Ajudo a escrever, melhorar e traduzir prompts de imagens \u2014 seguro para todos! Pode pedir \u2728" },
  ar: { dexa: "مرحبًا! أنا دِكسا \uD83D\uDC09 أساعدك في كتابة وتحسين وترجمة أوصاف الصور \u2014 مناسب للجميع! اسألني \u2728" },
  nl: { dexa: "Hoi! Ik ben Dexa \uD83D\uDC09 Ik help je beeldprompts schrijven, verbeteren en vertalen \u2014 veilig voor iedereen! Vraag het me \u2728" },
  pl: { dexa: "Cześć! Jestem Dexa \uD83D\uDC09 Pomogę napisać, ulepszyć i przetłumaczyć prompty graficzne \u2014 bezpiecznie! Zapytaj \u2728" },
  ja: { dexa: "こんにちは！私はデクサです \uD83D\uDC09 画像プロンプトの作成・改善・翻訳をお手伝いします \u2014 全年齢向け！聞いてね \u2728" },
  zh: { dexa: "你好！我是 Dexa \uD83D\uDC09 帮你编写、改进和翻译图像提示词 \u2014 安全友好！随时问我 \u2728" },
  ko: { dexa: "안녕하세요! 저는 덱사예요 \uD83D\uDC09 이미지 프롬프트 작성·개선·번역을 도와드려요 \u2014 모두에게 안전해요! 물어보세요 \u2728" },
};var LANG_BUBBLE = {
    en: "Hi! I'm here to help \u2728 I can write, improve & translate your image prompts. Click me!",
    de: "Hallo! Ich bin hier, um zu helfen \u2728 Ich kann Bild-Prompts schreiben, verbessern und übersetzen. Klick mich!",
    fr: "Salut ! Je suis là pour t'aider \u2728 Je peux écrire, améliorer et traduire des prompts d'images. Clique sur moi !",
    es: "¡Hola! Estoy aquí para ayudar \u2728 Puedo escribir, mejorar y traducir prompts de imágenes. ¡Haz clic en mí!",
    it: "Ciao! Sono qui per aiutarti \u2728 Posso scrivere, migliorare e tradurre prompt per immagini. Cliccami!",
    ru: "Привет! Я здесь, чтобы помочь \u2728 Могу писать, улучшать и переводить промпты для картинок. Нажми на меня!",
    pt: "Olá! Estou aqui para ajudar \u2728 Posso escrever, melhorar e traduzir prompts de imagens. Clique em mim!",
    ar: "مرحبًا! أنا هنا لمساعدتك \u2728 أستطيع كتابة وتحسين وترجمة أوصاف الصور. اضغط عليّ!",
    nl: "Hoi! Ik ben hier om te helpen \u2728 Ik kan beeldprompts schrijven, verbeteren en vertalen. Klik op mij!",
    pl: "Cześć! Jestem tu, by pomóc \u2728 Mogę pisać, ulepszać i tłumaczyć prompty graficzne. Kliknij mnie!",
    ja: "こんにちは！お手伝いします \u2728 画像プロンプトの作成・改善・翻訳ができます。クリックしてね！",
    zh: "你好！我来帮忙 \u2728 我可以编写、改进和翻译图像提示词。点我！",
    ko: "안녕하세요! 도와드릴게요 \u2728 이미지 프롬프트 작성·개선·번역이 가능해요. 클릭해 주세요!"
  };
  ;function detectUserLang() {
    try { if (window.dragonLang) return window.dragonLang.get(); } catch (e0) {}
    var l = "en";
    try {
      var ls = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || navigator.userLanguage || ""];
      for (var i = 0; i < ls.length; i++) {
        var c = String(ls[i] || "").toLowerCase().split("-")[0];
        if (LANG_GREET[c]) { l = c; break; }
      }
    } catch (e) {}
    return l;
  }
  var userLang = detectUserLang();
  window.dragonBotLangRefresh = function () {
    try { userLang = detectUserLang(); } catch (e) {}
    try { if (typeof bubble !== "undefined" && bubble) bubble.innerHTML = LANG_BUBBLE[userLang] || LANG_BUBBLE.en; } catch (e2) {}
    return userLang;
  };
  try { if (window.dragonLang) window.dragonLang.onChange(window.dragonBotLangRefresh); } catch (eLang) {}
  var currentBot = "dexa";
  var BOT = BOTS[currentBot];
  // Egon 18.09.2026 — one-time repair of the update-note misplacement. `post` used to write the Dexa
  // news note into whatever log was active, so a visitor got "welcome back + newest update" in
  // the wrong history (Egon reported exactly this). Move every cached news note into Dexa's,
  // Dexa's, where it belongs, and re-read the active history. Runs once (dragonNewsMig4).
  try {
    if (localStorage.dragonNewsMig4 !== "1") {
      localStorage.dragonNewsMig4 = "1";
      var _nc = {}; try { _nc = JSON.parse(localStorage.dragonNewsMsg || "{}") || {}; } catch (e) { _nc = {}; }
      var _known = {};
      for (var _k in _nc) { if (_nc[_k]) _known[String(_nc[_k]).trim()] = true; }
      var _moved = [];
      Object.keys(store).forEach(function (bid) {
        if (bid === "dexa") return;
        var _arr = Array.isArray(store[bid]) ? store[bid] : [];
        var _keep = [];
        _arr.forEach(function (m) {
          var _t = (m && typeof m.text === "string") ? m.text.trim() : "";
          if (m && m.role === "assistant" && _t && _known[_t]) _moved.push(m); else _keep.push(m);
        });
        store[bid] = _keep;
      });
      if (_moved.length) {
        var _d = Array.isArray(store.dexa) ? store.dexa : [];
        for (var _mi = 0; _mi < _moved.length; _mi++) {
          var _dup = false;
          for (var _di = 0; _di < _d.length; _di++) { if (_d[_di] && _d[_di].text === _moved[_mi].text) { _dup = true; break; } }
          if (!_dup) _d.push(_moved[_mi]);
        }
        if (_d.length > 20) _d = _d.slice(_d.length - 20);
        store.dexa = _d;
        try { localStorage.dragonBotChat = JSON.stringify(store); } catch (e) {}
      }
    }
  } catch (e) {}
  var history = Array.isArray(store[currentBot]) ? store[currentBot] : [];
  var generating = false;
  var genObj = null;
  // Egon 17.09.2026 — state for the CTA-offer rate limit (see botOfferAction) + a message counter.
  var botOfferState = { at: 0, msgAt: 0, id: null };
  var botMsgCounter = 0;
  ;function saveHist() {
    store[currentBot] = history;
    try { localStorage.dragonBotChat = JSON.stringify(store); } catch (e) {}
  }
  var host = document.createElement("div");
  host.id = "dragonBotHost";
  host.style.cssText = "position:fixed; top:0; right:0; padding:12px 12px 0 0; z-index:2147483300; display:flex; flex-direction:column; align-items:flex-end; gap:.4rem; pointer-events:none;"; // Egon 17.10.2026: above the fullscreen chat (2147483200), below PM overlays/toasts
  document.body.appendChild(host);
  var botStyle = document.createElement("style");
  botStyle.textContent = "@media (max-width:600px){#dragonBotChat{top:4.9rem !important; bottom:auto !important; right:var(--dragon-edge-right) !important; left:auto !important;}}@media (min-width:601px){#dragonBotChat{top:4.9rem !important; bottom:auto !important; right:var(--dragon-edge-right) !important; left:auto !important;}}";
  document.head.appendChild(botStyle);
  var bubble = document.createElement("div");
  bubble.style.cssText = "position:relative; max-width:235px; background:#1b1b21; border:1px solid #9b6bff; color:#eee; font-size:.8rem; padding:.5rem .7rem; border-radius:12px; box-shadow:0 4px 14px rgba(0,0,0,.5); cursor:pointer; opacity:0; transform:translateY(5px); transition:opacity .35s, transform .35s; pointer-events:none;";
  bubble.innerHTML = LANG_BUBBLE[userLang] || LANG_BUBBLE.en;
  var bubbleTail = document.createElement("div");
  bubbleTail.style.cssText = "position:absolute; bottom:-7px; right:26px; width:0; height:0; border-left:8px solid transparent; border-right:8px solid transparent; border-top:8px solid #9b6bff;";
  bubble.appendChild(bubbleTail);
  var btn = document.createElement("button");
  btn.type = "button";
  btn.title = BOT.name + " \u2014 AI Prompt Helper";
  btn.style.cssText = "position:relative; box-sizing:border-box; width:var(--dragon-btn-size); height:var(--dragon-btn-size); border-radius:50%; border:2px solid " + BOT.accent + "; background:url(" + BOT.avatar + ") center/cover; box-shadow:0 4px 16px rgba(155,107,255,.45); cursor:pointer; flex:0 0 auto; pointer-events:auto;";
  var dot = document.createElement("span");
  dot.style.cssText = "position:absolute; bottom:4%; right:4%; width:26%; height:26%; border-radius:50%; background:#22c55e; border:calc(var(--dragon-btn-size) * 0.035) solid #111;";
  btn.appendChild(dot);
  // Egon 16.09.2026 — 🔴 DEXA NEWS BADGE: src/dexa-news.js marks the top right of the avatar
  // with a flickering red "!" when there is an unread update (not clickable; click goes to the Dexa button).
  var newsBadge = document.createElement("span");
  newsBadge.id = "dragonBotNewsBadge";
  newsBadge.style.cssText = "position:absolute; top:-5px; right:-5px; box-sizing:border-box; width:20px; height:20px; border-radius:50%; background:#e11d2f; color:#fff; font-size:14px; font-weight:900; line-height:16px; text-align:center; display:none; border:2px solid #111; box-shadow:0 2px 8px rgba(225,29,47,.75); pointer-events:none; z-index:4;";
  btn.appendChild(newsBadge);
  // Egon 16.09.2026 — 🗨️ DEXA SPEECH BUBBLE: appears ABOVE the avatar when Dexa speaks spontaneously;
  // clicking it opens the chat. (MUST NOT BE the FIRST child of the host — CSS hides it; therefore it is added last.)
  var talk = document.createElement("div");
  talk.id = "dragonBotTalkBubble";
  // NOTE: position:FIXED (NOT absolute) appended to body, so viewport coordinates apply on every
  // screen and in every dock state (seen to drop to 97px on mobile when absolute, Egon 16.09.2026).
  // 🗨️ Egon 20.09.2026 — width:max-content (+ min-width) makes the bubble HUG its text: it begins at the
  // first character and ends at the last one (see talkPlace), instead of always being a 250px block.
  talk.style.cssText = "position:fixed; right:var(--dragon-edge-right,.8rem); bottom:calc(var(--dragon-stack-bottom,.4rem) + var(--dragon-btn-size,1.7rem) + .55rem); width:max-content; min-width:3rem; max-width:min(250px, 72vw); box-sizing:border-box; background:linear-gradient(180deg,#241a3a,#150f22); border:1px solid #9b6bff; color:#efe9ff; font-size:.78rem; line-height:1.42; padding:.5rem .65rem; border-radius:13px; box-shadow:0 8px 24px rgba(0,0,0,.62), 0 0 0 1px rgba(155,107,255,.22); cursor:pointer; display:none; opacity:0; transform:translateY(6px); transition:opacity .35s ease, transform .35s ease; text-align:left; pointer-events:auto; z-index:2147483301;";
  var talkTxt = document.createElement("span");
  talkTxt.id = "dragonBotTalkTxt";
  talk.appendChild(talkTxt);
  var talkTail = document.createElement("div");
  var TALK_TAIL_UP = "position:absolute; top:-7px; right:22px; width:0; height:0; border-left:8px solid transparent; border-right:8px solid transparent; border-bottom:8px solid #9b6bff;";
  var TALK_TAIL_DOWN = "position:absolute; bottom:-7px; right:22px; width:0; height:0; border-left:8px solid transparent; border-right:8px solid transparent; border-top:8px solid #9b6bff;";
  talkTail.style.cssText = TALK_TAIL_DOWN;
  talk.appendChild(talkTail);
  ;function talkPlace() {
    var hr = btn.getBoundingClientRect();
    if (!hr || !hr.width) return;
    var vw = window.innerWidth || document.documentElement.clientWidth || 0;
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;
    var w = Math.min(250, Math.floor(vw * 0.72));
    // 🗨️ the box is as wide as its own text (→ first character … last character), capped at the max above, and
    // its RIGHT edge stays pinned 6px inside the button's right edge so it never drifts while it grows.
    talk.style.maxWidth = w + "px";
    var bw = 0;
    try { bw = Math.round(talk.getBoundingClientRect().width) || 0; } catch (e2) {}
    if (!bw || bw > w) bw = w;
    var targetLeft = Math.max(6, Math.min(Math.round(hr.right) - 6 - bw, vw - bw - 6));
    var below = (hr.top + hr.height / 2) < vh * 0.55;
    talk.style.left = targetLeft + "px";
    talk.style.right = "auto";
    if (below) {
      var topPx = Math.round(hr.bottom) + 8;
      // Egon 16.09.2026 — 📣 When the banner is open (immediately below the navbar, full width) the bubble
      // goes BELOW the banner; otherwise, the banner would cover the bubble (z-index is higher on the banner).
      var tk = document.getElementById("dragonNewsTicker");
      if (tk && getComputedStyle(tk).display !== "none") {
        var tkR = tk.getBoundingClientRect();
        if (tkR.bottom > hr.bottom) topPx = Math.round(tkR.bottom) + 8;
      }
      if (topPx > vh - 40) topPx = Math.max(6, vh - 40);
      talk.style.top = topPx + "px";
      talk.style.bottom = "auto";
    } else {
      talk.style.bottom = Math.round(vh - hr.top + 8) + "px";
      talk.style.top = "auto";
    }
    var tailX = Math.max(10, Math.min(Math.round(hr.left + hr.width / 2 - targetLeft - 8), Math.max(10, bw - 26)));
    talkTail.style.cssText = (below ? TALK_TAIL_UP : TALK_TAIL_DOWN) + "left:" + tailX + "px;right:auto;";
  }
  window.addEventListener("resize", function () { try { if (talk.style.display === "block") talkPlace(); } catch (e) {} });
  talk.onclick = function () { toggleChat(); };
  ;function hideBubble(permanent) {
    bubble.style.opacity = "0";
    bubble.style.transform = "translateY(5px)";
    bubble.style.display = "none";
    bubble.style.pointerEvents = "none";
    if (permanent) { try { localStorage.dragonBotBubbleDone = "1"; } catch (e) {} }
  }
  setTimeout(function () {
    // Egon 15.09.2026 — Dexa's own greeting bubble NO LONGER OPENS AUTOMATICALLY: on the first visit,
    // Dexa speaks INSIDE our welcome window. (Still works if the bubble is opened manually.)
    try { localStorage.dragonBotBubbleDone = "1"; } catch (e) {}
    try { if (false && localStorage.dragonBotBubbleDone !== "1" && chat.style.display !== "flex") { bubble.style.display = ""; bubble.style.pointerEvents = "none"; bubble.style.opacity = "1"; bubble.style.transform = "translateY(0)"; } } catch (e) {}
  }, 1600);
  btn.onclick = toggleChat;
  bubble.onclick = toggleChat;
  host.appendChild(bubble);
  host.appendChild(btn);
  try { document.body.appendChild(talk); } catch (eT) { host.appendChild(talk); }
  var chat = document.createElement("div");
  chat.id = "dragonBotChat";
  chat.style.cssText = "position:fixed; top:4.9rem; right:.8rem; width:min(360px, calc(100vw - 1rem)); height:min(500px, 74vh); z-index:2147483302; background:#14141a; border:1px solid " + BOT.accent + "; border-radius:14px; display:none; flex-direction:column; overflow:hidden; box-shadow:0 8px 30px rgba(0,0,0,.6);"; // Egon 17.10.2026: above the fullscreen chat, below PM overlays/toasts/lightbox
  var hdr = document.createElement("div");
  hdr.style.cssText = "display:flex; flex-direction:column; gap:.3rem; padding:.45rem .6rem; background:#1b1b21; border-bottom:1px solid #333; flex:0 0 auto;";
  var hdrRow1 = document.createElement("div");
  hdrRow1.style.cssText = "display:flex; align-items:center; gap:.5rem;";
  var av = document.createElement("img");
  av.src = BOT.avatar;
  av.style.cssText = "width:36px; height:36px; border-radius:50%; border:2px solid " + BOT.accent + "; object-fit:cover; flex:0 0 auto;";
  var htx = document.createElement("div");
  htx.style.cssText = "flex:1; min-width:0;";
  var hnm = document.createElement("div");
  hnm.textContent = BOT.name + " \u2014 AI Helper";
  hnm.style.cssText = "color:#eee; font-size:.84rem; font-weight:bold;";
  var hst = document.createElement("div");
  hst.textContent = BOT.note;
  hst.style.cssText = "color:" + BOT.color + "; font-size:.64rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:bold;";
  htx.append(hnm, hst);
  var closeBtn = document.createElement("button");
  closeBtn.textContent = "\u2716";
  closeBtn.title = "Close";
  closeBtn.style.cssText = "border:1px solid #5a5a6a; background:linear-gradient(145deg,#2a2a33,#17171c); color:#ddd; border-radius:6px; padding:.15rem .5rem; font-size:.8rem; cursor:pointer; flex:0 0 auto;";
  closeBtn.onclick = function () { chat.style.display = "none"; btn.style.display = ""; };
  // Egon 16.09.2026 — ❗/💤 open/close Dexa's spontaneous speech bubbles (src/dexa-talk.js synchronizes).
  var bubblesToggle = document.createElement("button");
  bubblesToggle.id = "dragonDexaBubblesToggle";
  bubblesToggle.type = "button";
  bubblesToggle.textContent = "\u2757";
  bubblesToggle.title = "Dexa's spontaneous talking bubbles \u2014 click to toggle";
  bubblesToggle.style.cssText = "border:1px solid #e0244c; background:linear-gradient(180deg,#4a0d16,#21060a); color:#ffd4d4; border-radius:50%; width:1.6rem; height:1.6rem; font-size:.8rem; line-height:1; cursor:pointer; flex:0 0 auto; padding:0;";
  bubblesToggle.onclick = function (e) { e.stopPropagation(); if (window.dragonDexaBubblesToggle) window.dragonDexaBubblesToggle(); };
  hdrRow1.append(av, htx, bubblesToggle, closeBtn);
  var hdrRow2 = document.createElement("div");
  hdrRow2.style.cssText = "display:flex; align-items:center; gap:.3rem; justify-content:center;";
  var seg = document.createElement("div");
  seg.style.cssText = "display:flex; gap:.2rem; justify-content:center;";
  Object.keys(BOTS).forEach(function (id) {
    var b = document.createElement("button");
    b.textContent = (id === "dexa" ? "\uD83D\uDC09 " : "\uD83D\uDC96 ") + BOTS[id].name;
    b.dataset.bot = id;
    b.style.cssText = "font-size:.7rem; padding:.16rem .45rem; border:1px solid #5a5a6a; border-radius:6px; cursor:pointer; background:linear-gradient(145deg,#2a2a33,#17171c); color:" + BOTS[id].color + "; font-weight:bold;";
    b.onclick = function () { switchBot(id); };
    seg.appendChild(b);
  });
  var resetBtn = document.createElement("button");
  resetBtn.textContent = "\u21BA";
  resetBtn.title = "Reset chat";
  resetBtn.style.cssText = "border:1px solid #5a5a6a; background:linear-gradient(145deg,#2a2a33,#17171c); color:#ddd; border-radius:6px; padding:.15rem .45rem; font-size:.8rem; cursor:pointer; flex:0 0 auto;";
  resetBtn.onclick = resetChat;
  hdrRow2.append(seg, resetBtn);
  try {
    if (window.dragonLang) {
      var botLangSel = window.dragonLang.select("font-size:.68rem; padding:.16rem .3rem; border-radius:6px; border:1px solid #5a5a6a; background:linear-gradient(145deg,#2a2a33,#17171c); color:#ddd; cursor:pointer; flex:0 0 auto; max-width:6.5rem;");
      botLangSel.title = "Language";
      hdrRow2.appendChild(botLangSel);
    }
  } catch (eBotLang) {}
  hdr.append(hdrRow1, hdrRow2);
  var msgs = document.createElement("div");
  msgs.style.cssText = "flex:1; overflow-y:auto; padding:.55rem; display:flex; flex-direction:column; gap:.45rem;";
  ;function chip(text) {
    var b = document.createElement("button");
    b.textContent = text;
    b.type = "button";
    b.style.cssText = "font-size:.7rem; padding:.18rem .45rem; border:1px solid #6a6a78; background:linear-gradient(145deg,#24242d,#131318); color:#ccc; border-radius:20px; cursor:pointer;";
    return b;
  }
  var chips = document.createElement("div");
  chips.style.cssText = "display:flex; gap:.3rem; flex-wrap:wrap; justify-content:center; padding:0 .5rem .35rem; flex:0 0 auto;";
  var c1 = chip("\u2728 Improve my prompt");
  var c3 = chip("\uD83D\uDCA1 Surprise me");
  var c5 = chip("\uD83C\uDFB2 Random character with AI");
  var c6 = chip("\uD83D\uDCA1 Suggest 3 prompts");
  chips.append(c1, c3, c5, c6);
  var inpRow = document.createElement("div");
  inpRow.style.cssText = "display:flex; gap:.35rem; padding:.45rem; border-top:1px solid #333; background:#1b1b21; flex:0 0 auto;";
  var imgBtn = document.createElement("button");
  imgBtn.textContent = "\uD83D\uDDBC\uFE0F";
  imgBtn.title = "ImgtoPrompt";
  imgBtn.style.cssText = "border:1px solid #6a6a78; background:linear-gradient(145deg,#24242d,#131318); color:#ddd; border-radius:8px; padding:0 .5rem; font-size:.9rem; cursor:pointer; flex:0 0 auto;";
  var fileIn = document.createElement("input");
  fileIn.type = "file";
  fileIn.accept = "image/png,image/jpeg,image/webp";
  fileIn.style.display = "none";
  var inp = document.createElement("textarea");
  inp.rows = 1;
  inp.placeholder = "Write a message\u2026";
  inp.style.cssText = "flex:1; resize:none; background:#0e0e13; color:#eee; border:1px solid #4a4a58; border-radius:8px; padding:.35rem .5rem; font-size:.8rem; font-family:inherit; overflow-y:auto;";
  ;function autoGrowInp() {
    inp.style.height = "auto";
    var lh = 19;
    try { lh = parseFloat(getComputedStyle(inp).lineHeight) || 19; } catch (e) {}
    var maxH = lh * 8;
    inp.style.maxHeight = maxH + "px";
    inp.style.height = Math.min(inp.scrollHeight, maxH) + "px";
    inp.scrollTop = inp.scrollHeight;
  }
  inp.addEventListener("input", autoGrowInp);
  inp.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendUserMsg(inp.value); }
  });
  imgBtn.onclick = function () { fileIn.click(); };
  fileIn.onchange = function () {
    var f = fileIn.files && fileIn.files[0];
    if (!f) return;
    imgBtn.textContent = "\u23F3";
    sendVision(f);
    fileIn.value = "";
  };
  var sendBtn = document.createElement("button");
  sendBtn.textContent = "\u27A4";
  sendBtn.title = "Send";
  sendBtn.style.cssText = "border:1px solid " + BOT.accent + "; background:linear-gradient(145deg,#2a1f4a,#14101f); color:#d8c9ff; border-radius:8px; padding:0 .65rem; font-size:.95rem; cursor:pointer; flex:0 0 auto;";
  sendBtn.onclick = function () { sendUserMsg(inp.value); };
  inpRow.append(imgBtn, inp, sendBtn);
  chat.append(hdr, chips, msgs, inpRow);
  document.body.appendChild(chat);
  // Egon 03.10.2026 — DRAGGABLE Dexa: the avatar button (the whole host box) and the chat window can be
  // dragged anywhere on screen, and both remember their last spot. No stored position = the CSS default
  // exactly as now. Only the button (host) and the chat header are handles; a real click still opens the
  // chat (a press that moved less than a few px counts as a click, not a drag).
  var DEX_BTN_KEY = "dragonDexaBtnPosV2", DEX_CHAT_KEY = "dragonDexaChatPosV2";
  // (undocked = the user dragged it out of the navbar: the navbar stylesheet pins the host with
  // !important, so a freed host needs its own !important reset for the inline left/top to take effect)
  try {
    if (!document.getElementById("dragonBotFreeCss")) {
      var freeCss = document.createElement("style");
      freeCss.id = "dragonBotFreeCss";
      freeCss.textContent = "#dragonBotHost.dragon-free{transform:none !important;flex-direction:column !important;align-items:flex-end !important;}";
      document.head.appendChild(freeCss);
    }
  } catch (eF) {}
  function dexPosGet(k) { try { var v = JSON.parse(localStorage.getItem(k) || "null"); if (v && isFinite(v.x) && isFinite(v.y)) return { x: +v.x, y: +v.y }; } catch (e) {} return null; }
  function dexPosSet(k, x, y) { try { localStorage.setItem(k, JSON.stringify({ x: Math.round(x), y: Math.round(y) })); } catch (e) {} }
  // (an inline !important wins over the navbar/chat !important pinning above)
  function dexSetPos(target, x, y) {
    try {
      target.style.setProperty("left", x + "px", "important");
      target.style.setProperty("top", y + "px", "important");
      target.style.setProperty("bottom", "auto", "important");
      target.style.setProperty("right", "auto", "important");
    } catch (e) {
      try { target.style.left = x + "px"; target.style.top = y + "px"; target.style.bottom = "auto"; target.style.right = "auto"; } catch (e2) {}
    }
  }
  function dexClampPos(x, y, w, h) {
    // the whole box stays on screen (a position stored on a WIDER screen used to reopen the chat
    // almost fully off-screen: the old clamp only kept a 30 px sliver visible).
    var vw = window.innerWidth || 320, vh = window.innerHeight || 480;
    w = w || 40; h = h || 40;
    if (x > vw - w - 8) x = vw - w - 8;
    if (y > vh - h - 8) y = vh - h - 8;
    if (x < 8) x = 8;
    if (y < 0) y = 0;
    return { x: x, y: y };
  }
  function dexDrag(handle, target, key, opts) {
    opts = opts || {};
    var sx = 0, sy = 0, ox = 0, oy = 0, state = null, pid = null;
    try { handle.style.touchAction = "none"; } catch (e) {}
    if (!opts.keepCursor) { try { handle.style.cursor = "grab"; } catch (e2) {} }
    handle.addEventListener("pointerdown", function (e) {
      if (e.button != null && e.button !== 0) return;
      if (opts.skip && opts.skip(e)) return;
      pid = e.pointerId;
      var r = target.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
      state = "down";
      try { handle.setPointerCapture(e.pointerId); } catch (err) {}
      try { e.preventDefault(); } catch (eP) {}
    });
    handle.addEventListener("pointermove", function (e) {
      if ((state !== "down" && state !== "drag") || e.pointerId !== pid) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (state === "down" && Math.abs(dx) + Math.abs(dy) < 7) return;
      state = "drag";
      if (opts.freeClass) { try { target.classList.add(opts.freeClass); } catch (eFC) {} }
      if (!opts.keepCursor) { try { handle.style.cursor = "grabbing"; } catch (eC) {} }
      var r = target.getBoundingClientRect();
      var c = dexClampPos(ox + dx, oy + dy, r.width, r.height);
      dexSetPos(target, c.x, c.y);
    });
    function end(e) {
      if (state === null || (e && e.pointerId !== pid)) return;
      if (!opts.keepCursor) { try { handle.style.cursor = "grab"; } catch (eC2) {} }
      if (state === "drag") {
        var r = target.getBoundingClientRect();
        dexPosSet(key, r.left, r.top);
        state = "dropped";
      } else state = null;
      pid = null;
    }
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", function () { state = null; pid = null; });
    return { ateClick: function () { if (state === "dropped") { state = null; return true; } return false; } };
  }
  try {
    var _bp = dexPosGet(DEX_BTN_KEY);
    if (_bp) {
      try { host.classList.add("dragon-free"); } catch (eFC2) {}
      var _br = host.getBoundingClientRect();
      var _bc = dexClampPos(_bp.x, _bp.y, _br.width || 40, _br.height || 40);
      dexSetPos(host, _bc.x, _bc.y);
    }
    var _cp = dexPosGet(DEX_CHAT_KEY);
    if (_cp) {
      var _cc = dexClampPos(_cp.x, _cp.y, Math.min(360, (window.innerWidth || 360) - 16), Math.min(500, (window.innerHeight || 500) * 0.74));
      dexSetPos(chat, _cc.x, _cc.y);
    }
  } catch (eR) {}
  var btnDrag = dexDrag(btn, host, DEX_BTN_KEY, { freeClass: "dragon-free" });
  var _btnClick = btn.onclick;
  btn.onclick = function (e) { if (btnDrag.ateClick()) return; if (_btnClick) _btnClick.call(btn, e); };
  dexDrag(hdr, chat, DEX_CHAT_KEY, { skip: function (e) { try { return !!(e.target.closest && e.target.closest("button,input,select,textarea,a")); } catch (eS) { return false; } } });
  window.addEventListener("resize", function () {
    try {
      if (dexPosGet(DEX_BTN_KEY)) { var r = host.getBoundingClientRect(); var c = dexClampPos(r.left, r.top, r.width, r.height); dexSetPos(host, c.x, c.y); }
      if (chat.style.display === "flex" && dexPosGet(DEX_CHAT_KEY)) { var r2 = chat.getBoundingClientRect(); var c2 = dexClampPos(r2.left, r2.top, r2.width, r2.height); dexSetPos(chat, c2.x, c2.y); }
    } catch (eR2) {}
  });
  ;function curDesc() {
    try {
      var ta = document.querySelector('textarea[data-name="description"]');
      if (ta && ta.value && String(ta.value).trim()) return String(ta.value).trim().slice(0, 400);
    } catch (e) {}
    return "";
  }
  c1.onclick = function () { var d = curDesc(); sendUserMsg(d ? "Improve and enhance this prompt: " + d : "Give me an amazing, detailed image prompt for a beautiful portrait"); };
  c3.onclick = function () { sendUserMsg("Suggest a random creative image prompt"); };
  c5.onclick = function () {
    if (typeof window.dragonAIRandomize === "function") {
      chat.style.display = "none";
      btn.style.display = "";
      // Egon 17.09.2026 — this chip used to leave the user on whatever page was open (e.g. Settings). It must
      // take them to the Generate page and its image-creation area first.
      try { if (window.dragonGoPage) window.dragonGoPage("generate"); } catch (e) {}
      try { window.dragonAIRandomize("char"); } catch (e) { addBubble("Couldn't start the randomizer \u2014 try again.", "assistant"); }
    } else {
      addBubble("The random-with-AI tool isn't ready yet \u2014 try again in a moment.", "assistant");
    }
  };
  c6.onclick = function () { sendUserMsg("Give me 3 creative, varied image prompt ideas. Output EACH prompt inside its own fenced block, exactly like ```prompt\\n...\\n``` — put a short one-line title before each block and nothing else outside the blocks."); };
  // 🕒 Egon 23.09.2026 — "news messages appearing in dexa's chat box ... should be date and time".
  // Every message Dexa POSTS into the chat (the update-notes announcements) now carries the date and
  // time it arrived, rendered as a small centred line at the TOP of its bubble (Egon's first choice).
  // Format: 📅 DD.MM.YYYY · HH:MM (24-hour) — unambiguous in every language.
  ;function dragonStampText(ms) {
    var d = new Date(ms);
    if (!d || isNaN(d.getTime())) return "";
    function p2(n) { return (n < 10 ? "0" : "") + n; }
    return p2(d.getDate()) + "." + p2(d.getMonth() + 1) + "." + d.getFullYear() + "  \u00B7  " + p2(d.getHours()) + ":" + p2(d.getMinutes());
  }
  ;function addBubble(text, who, stampMs) {
    var wrap = document.createElement("div");
    wrap.style.cssText = "max-width:88%; display:flex; flex-direction:column; gap:.25rem; align-self:" + (who === "user" ? "flex-end" : "flex-start") + ";";
    var b = document.createElement("div");
    b.style.cssText = "white-space:pre-wrap; word-break:break-word; font-size:.8rem; line-height:1.35; color:#eee; padding:.45rem .6rem; border-radius:12px; background:" + (who === "user" ? "#2a1f4a" : "#1d1d24") + "; border:1px solid " + (who === "user" ? BOT.accent : "#3a3a46") + ";";
    var stamp = "";
    try { stamp = (who !== "user" && stampMs) ? dragonStampText(stampMs) : ""; } catch (e) { stamp = ""; }
    if (stamp) {
      var sd = document.createElement("div");
      sd.className = "dragon-chat-stamp";
      sd.textContent = "\uD83D\uDCC5 " + stamp;
      sd.style.cssText = "font-size:.58rem; font-weight:700; letter-spacing:.03em; color:#a79dd0; text-align:center; margin:0 0 .25rem;";
      b.appendChild(sd);
    }
    b.appendChild(document.createTextNode(text));
    wrap.appendChild(b);
    msgs.appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;
    return b;
  }
  ;function typingBubble() {
    var wrap = document.createElement("div");
    wrap.style.cssText = "max-width:88%; align-self:flex-start;";
    var b = document.createElement("div");
    b.style.cssText = "font-size:.8rem; color:#ccc; padding:.45rem .7rem; border-radius:12px; background:#1d1d24; border:1px solid #3a3a46; display:flex; gap:.3rem; align-items:center;";
    var s1 = document.createElement("span"); s1.textContent = "\u25CF"; s1.style.cssText = "color:#9b6bff; animation:dragonBotDot 1s infinite;";
    var s2 = document.createElement("span"); s2.textContent = "\u25CF"; s2.style.cssText = "color:#9b6bff; animation:dragonBotDot 1s infinite; animation-delay:.15s;";
    var s3 = document.createElement("span"); s3.textContent = "\u25CF"; s3.style.cssText = "color:#9b6bff; animation:dragonBotDot 1s infinite; animation-delay:.3s;";
    b.append(s1, s2, s3);
    wrap.appendChild(b);
    msgs.appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;
    return wrap;
  }
  var dotStyle = document.createElement("style");
  dotStyle.textContent = "@keyframes dragonBotDot{0%,60%,100%{opacity:.25}30%{opacity:1}}"
    + "@keyframes dragonTalkDot{0%,70%,100%{opacity:.3;transform:translateY(0) scale(.85)}35%{opacity:1;transform:translateY(-3px) scale(1)}}"
    + ".dragon-talk-dots{display:inline-flex;align-items:center;gap:4px;height:1em;vertical-align:middle}"
    + ".dragon-talk-dots i{width:6px;height:6px;border-radius:50%;background:linear-gradient(180deg,#c9a8ff,#9b6bff);box-shadow:0 0 6px rgba(155,107,255,.6);display:inline-block;animation:dragonTalkDot 1.15s infinite ease-in-out}"
    + ".dragon-talk-dots i:nth-child(2){animation-delay:.16s}"
    + ".dragon-talk-dots i:nth-child(3){animation-delay:.32s}";
  document.head.appendChild(dotStyle);
  // Egon 17.09.2026 — the language line is a shared helper so the background warm-up (botWarmup) can
  // reproduce the EXACT static prefix of a real reply and prime the server-side prefix cache.
  // 23.09.2026 — THE AUTHORED CHARACTER CARD. Each companion's hand-written persona is EXTENDED with the
  // card built in src/dragon-persona.js (her look + her authored 1-10 personality axes + the image-prompt
  // wording for her own body), so she answers from one authored description of herself instead of
  // improvising one. The card is appended (never replacing the persona) and the result stays a STATIC
  // prefix, so the server-side prefix cache still works.
  ;function botPersona(id) {
    var base = (BOTS[id] && BOTS[id].persona) || BOT.persona;
    try {
      if (window.dragonPersona && typeof window.dragonPersona.block === "function") {
        var card = window.dragonPersona.block(id);
        if (card) base += "\n\n" + card;
      }
    } catch (e) {}
    return base;
  }
  // Deterministic hook for the check-up: the exact card text appended for a companion (no generation).
  window.dragonDexaPersonaBlock = function (id) {
    try { return (window.dragonPersona && window.dragonPersona.block) ? window.dragonPersona.block(id) : ""; } catch (e) { return ""; }
  };
  ;function botLangLine() {
    return userLang === "en" ? "" : "The user's browser language is " + userLang + " (" + {tr:"Turkish",de:"German",fr:"French",es:"Spanish",it:"Italian",ru:"Russian",pt:"Portuguese",ar:"Arabic",nl:"Dutch",pl:"Polish",ja:"Japanese",zh:"Chinese",ko:"Korean"}[userLang] + "). Reply in that language.\n";
  }
  ;function buildInstruction(userMsg) {
    // Egon 17.09.2026 — SPEED: a LONGER, append-only conversation window instead of the last 3 messages.
    // A stable, growing prefix is cached server-side, so consecutive turns get much faster; the window
    // only slides once it exceeds the cap.
    var conv = [];
    for (var i = Math.max(0, history.length - 8); i < history.length; i++) {
      conv.push((history[i].role === "user" ? "user" : "assistant") + ": " + history[i].text);
    }
    return botPersona(currentBot) + "\n" + SITE_CONTEXT + "\n" + botLangLine() + "\nCONVERSATION:\n" + (conv.join("\n") ? conv.join("\n") + "\n" : "") + "user: " + userMsg + "\n\nTASK: Reply to the user's latest message. Be very brief (1-2 sentences) unless the user asks for more." + "\n\n" + botActionsPromptLine();
  }
  // 🧠 W-DATA188 (Egon 23.09.2026) — the site/system knowledge Dexa answers from is a STATIC string, so it
  // can be tested without spending a single generation: these two hooks let the check-up prove that the
  // context is COMPLETE (it names every system the visitor survey lists) and that it really REACHES the
  // prompt that is sent.
  window.dragonDexaSiteContext = function () { return SITE_CONTEXT; };
  window.dragonDexaBuildInstruction = function (msg) { return buildInstruction(msg == null ? "" : String(msg)); };
  // 🧪 Egon 23.09.2026 (W-UI189) — deterministic hooks for the check-up: the reply-marker stripper and the
  // prompt line that teaches the model the [[legends]] marker. Neither spends a generation nor touches the
  // visitor's chat history — the check reads them directly.
  window.dragonDexaStripMarkers = function (s) { return botStripMarkers(s == null ? "" : String(s)); };
  window.dragonDexaBotPromptLine = function () { return botActionsPromptLine(); };
  // Egon 17.09.2026 — SPEED: the AI has a cold start (measured live: ~7s to the first token on the very
  // first call, ~4s when warm). We warm it in the background shortly after load, sending the SAME static
  // prefix a real reply uses, so both the connection and the server-side prefix cache are ready before
  // the visitor's first message. Guarded so it never runs while a chat is open or a reply is generating.
  // Egon 18.09.2026 — warm the bot: the active bot's prefix first, so the visitor's first message
  // no longer pays the cold start.
  ;function warmBot(id) {
    try {
      if (typeof root.generateText !== "function") return;
      if (botIsOpen() || generating) return;
      var persona = botPersona(id);
      var prefix = persona + "\n" + SITE_CONTEXT + "\n" + botLangLine() + "\nCONVERSATION:\nuser: hi\n\nTASK: Reply with a single short word.";
      var p = root.generateText({ instruction: prefix, onChunk: function () {} });
      try { if (p && p.then) p.then(function () {}, function () {}); } catch (e) {}
    } catch (e) {}
  }
  ;function botWarmup() {
    warmBot(currentBot);
  }
  setTimeout(botWarmup, 4000);
  ;function sendUserMsg(raw) {
    var text = String(raw || "").trim();
    if (!text || generating) return;
    if (typeof root.generateText !== "function") {
      addBubble("Sorry, the AI helper isn't available right now. Try again in a moment.", "assistant");
      return;
    }
    history.push({ role: "user", text: text });
    saveHist();
    var userBubble = addBubble(text, "user").parentElement;
    botMsgCounter++;
    inp.value = "";
    autoGrowInp();
    generating = true;
    sendBtn.disabled = true;
    sendBtn.textContent = "\u23F9";
    sendBtn.title = "Stop";
    sendBtn.onclick = function () { if (genObj && genObj.stop) { try { genObj.stop(); } catch (e) {} } };
    var tWrap = typingBubble();
    var replyBubble = null;
    var full = "";
    try {
      genObj = root.generateText({
        instruction: buildInstruction(text),
        onChunk: function (d) {
          if (d && d.textChunk) {
            full += d.textChunk;
            if (!replyBubble) {
              tWrap.remove();
              replyBubble = addBubble("", "assistant");
            }
            replyBubble.textContent = botStripMarkers(full);
            msgs.scrollTop = msgs.scrollHeight;
          }
        }
      });
      Promise.resolve(genObj).then(function (final) {
        try {
          if (final && typeof final === "object" && final.text) full = final.text;
          else if (typeof final === "string" && final) full = final;
        } catch (e) {}
        if (!replyBubble) {
          tWrap.remove();
          replyBubble = addBubble("", "assistant");
        }
        var _rawReply = full;
        var _legends = /\[\[\s*legends\s*\]\]/i.test(_rawReply);
        var _respect = /\[\[respect\]\]/i.test(_rawReply) || /\[\[respect\]\s*$/i.test(_rawReply);
        full = botStripMarkers(full);
        replyBubble.textContent = full;
        if (!_respect) attachPromptButtons(replyBubble, full);
        if (!_respect && _legends) attachLegendButtons(replyBubble, full, text);
        msgs.scrollTop = msgs.scrollHeight;
        history.push({ role: "assistant", text: full, legends: _legends || undefined });
        saveHist();
        if (_respect) runRespectSanction(userBubble);
        else botOfferAction(text, _rawReply, replyBubble);
        finishGen();
      }).catch(function () {
        tWrap.remove();
        if (!full) addBubble("Hmm, I got interrupted \u2014 try again?", "assistant");
        finishGen();
      });
    } catch (e) {
      tWrap.remove();
      addBubble("Something went wrong \u2014 try again?", "assistant");
      finishGen();
    }
  }
  ;function sendVision(file) {
    if (generating) { addBubble("Please wait for the current reply to finish first.", "assistant"); imgBtn.textContent = "\uD83D\uDDBC\uFE0F"; return; }
    history.push({ role: "user", text: "[image attached]" });
    saveHist();
    addBubble("[🖼️ image attached]", "user");
    generating = true;
    sendBtn.disabled = true;
    sendBtn.textContent = "\u23F3";
    sendBtn.onclick = function () { if (genObj && genObj.stop) { try { genObj.stop(); } catch (e) {} } };
    var tWrap = typingBubble();
    var replyBubble = null;
    var full = "";
    var visionInstr = [
      "You are " + BOT.name + ", an expert image-prompt writer inside \"Best AI Image Generator\". LOOK at the attached image and write ONE detailed, ready-to-use English image-generation prompt that would recreate it: subject, pose, expression, outfit, style, lighting, composition, mood, camera angle. Output ONLY the prompt inside a fenced block like ```prompt\n...\n``` with no extra text before or after.",
      file
    ];
    try {
      genObj = root.generateText({
        instruction: visionInstr,
        onChunk: function (d) {
          if (d && d.textChunk) {
            full += d.textChunk;
            if (!replyBubble) { tWrap.remove(); replyBubble = addBubble("", "assistant"); }
            replyBubble.textContent = full;
            msgs.scrollTop = msgs.scrollHeight;
          }
        }
      });
      Promise.resolve(genObj).then(function (final) {
        try {
          if (final && typeof final === "object" && final.text) full = final.text;
          else if (typeof final === "string" && final) full = final;
        } catch (e) {}
        if (!replyBubble) { tWrap.remove(); replyBubble = addBubble("", "assistant"); }
        replyBubble.textContent = full;
        attachPromptButtons(replyBubble, full);
        msgs.scrollTop = msgs.scrollHeight;
        history.push({ role: "assistant", text: full });
        saveHist();
        finishGen();
      }).catch(function () {
        tWrap.remove();
        if (!full) addBubble("Hmm, I couldn't read that image \u2014 try a clearer PNG/JPEG?", "assistant");
        finishGen();
      });
    } catch (e) {
      tWrap.remove();
      addBubble("Something went wrong reading the image \u2014 try again?", "assistant");
      finishGen();
    }
    imgBtn.textContent = "\uD83D\uDDBC\uFE0F";
  }
  ;function attachPromptButtons(bubbleEl, text) {
    if (!bubbleEl) return;
    var blocks = [];
    var re = /```prompt\s*([\s\S]*?)```/g, m;
    while ((m = re.exec(text)) !== null) blocks.push(m[1].trim());
    if (!blocks.length) return;
    var wrap = bubbleEl.parentElement;
    if (!wrap) return;
    ;function setDesc(v) {
      try {
        var val = String(v == null ? "" : v);
        var ta = document.querySelector('textarea[data-name="description"]');
        if (ta) ta.value = val;
        if (window.input) { try { window.input.description = val; } catch (e) {} }
        try {
          var spec = window.___userSettings746291937 && window.___userSettings746291937.userInputs && window.___userSettings746291937.userInputs.description;
          if (spec) spec.value = val;
        } catch (e) {}
        if (ta) ta.dispatchEvent(new Event("input", { bubbles: true }));
        return !!ta;
      } catch (e) { return false; }
    }
    for (var bi = 0; bi < blocks.length; bi++) {
      (function (block, idx) {
        var row = document.createElement("div");
        row.style.cssText = "display:flex; gap:.3rem; flex-wrap:wrap; align-items:center;";
        var num = document.createElement("span");
        num.textContent = (blocks.length > 1 ? (idx + 1) + ". " : "") + (block.length > 60 ? block.slice(0, 60) + "\u2026" : block);
        num.style.cssText = "font-size:.62rem; color:#9a9aab; flex:1 1 100%; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;";
        var putBtn = document.createElement("button");
        putBtn.textContent = "\uD83D\uDCDD Put in description";
        putBtn.style.cssText = "font-size:.68rem; padding:.18rem .45rem; border:1px solid #9b6bff; background:linear-gradient(145deg,#2a1f4a,#14101f); color:#d8c9ff; border-radius:6px; cursor:pointer;";
        putBtn.onclick = function () {
          var ok = setDesc(block);
          putBtn.textContent = ok ? "\u2713 added" : "\u26A0\uFE0F no box";
          putBtn.style.color = ok ? "#4ade80" : "#ff8a96";
          putBtn.style.borderColor = ok ? "#4ade80" : "#c81e2e";
          if (ok && window.dragonToast) dragonToast("\uD83D\uDCDD prompt copied to description");
        };
        var genBtn = document.createElement("button");
        genBtn.textContent = "\u2728 Generate";
        genBtn.title = "Put in description and generate";
        genBtn.style.cssText = "font-size:.68rem; padding:.18rem .45rem; border:1px solid #22c55e; background:linear-gradient(145deg,#14532d,#052e16); color:#bbf7d0; border-radius:6px; cursor:pointer;";
        genBtn.onclick = function () {
          var ok = setDesc(block);
          if (!ok && window.dragonToast) dragonToast("\u26A0\uFE0F description box not found");
          chat.style.display = "none";
          btn.style.display = "";
          if (window.___generateButtonClickEvent746291937) {
            try { window.___generateButtonClickEvent746291937(); if (window.dragonToast) dragonToast("\u2728 generating\u2026"); } catch (e) {}
          }
          setTimeout(function () {
            try {
              var oa = document.getElementById("outputAreaEl");
              if (oa && oa.getBoundingClientRect().bottom > window.innerHeight) oa.scrollIntoView({ behavior: "smooth", block: "nearest" });
            } catch (e) {}
          }, 500);
        };
        var cpyBtn = document.createElement("button");
        cpyBtn.textContent = "\uD83D\uDCCB Copy";
        cpyBtn.style.cssText = "font-size:.68rem; padding:.18rem .45rem; border:1px solid #6a6a78; background:linear-gradient(145deg,#24242d,#131318); color:#ccc; border-radius:6px; cursor:pointer;";
        cpyBtn.onclick = function () {
          try { navigator.clipboard.writeText(block); cpyBtn.textContent = "\u2713 copied"; } catch (e) {}
        };
        row.append(num, putBtn, genBtn, cpyBtn);
        wrap.appendChild(row);
      })(blocks[bi], bi);
    }
  }
  // ===== 🧭 W-UI189 (Egon 23.09.2026) — DEXA SHOWS THE LEGENDS BUTTONS AND GUIDES THE VISITOR =====
  // Egon (exactly): "Dexa should know the buttons and functions, a-) show buttons on the legends button to the user,
  // redirect to the related page when buttons are pressed, and the related button should have the 'I'm HERE' badge and glow
  // belirsin." So when the reply carries the marker [[legends]], Dexa's bubble grows a tappable grid of the
  // site's main controls (the same set the Legends reference lists). Tapping one navigates to the
  // page that owns it and scrolls it into view (Egon 22.10.2026: the "I'm HERE" badge is retired, so
  // nothing is marked anymore) — Dexa never invents a button, only points at existing ones.
  var LEGEND_L_GOTO = "Tapping a button takes you there.";
  var LEGEND_GROUPS = [
    { title: "Pages",
      items: [
        { key: "legend-home", icon: "🏠", label: "Home",
          go: function () { if (window.dragonGoPage) window.dragonGoPage("home"); }, find: ['.dragon-nav-item[data-nav-page="home"]'] },
        { key: "legend-generate", icon: "✨", label: "Generate",
          go: function () { if (window.dragonGoPage) window.dragonGoPage("generate"); }, find: ['.dragon-nav-item[data-nav-page="generate"]'] },
        { key: "legend-character", icon: "💃", label: "Character",
          go: function () { if (window.dragonGoPage) window.dragonGoPage("character"); }, find: ['.dragon-nav-item[data-nav-page="character"]'] },
        { key: "legend-gallery", icon: "🖼️", label: "Galleries",
          go: function () { if (window.dragonGoPage) window.dragonGoPage("gallery"); }, find: ['.dragon-nav-item[data-nav-page="gallery"]'] },
        { key: "legend-likes", icon: "⭐", label: "Likes",
          go: function () { if (window.dragonGoPage) window.dragonGoPage("likes"); }, find: ['.dragon-nav-item[data-nav-page="likes"]'] },
        { key: "legend-history", icon: "🕘", label: "History",
          go: function () { if (window.dragonGoPage) window.dragonGoPage("history"); }, find: ['.dragon-nav-item[data-nav-page="history"]'] },
        { key: "legend-chat", icon: "💬", label: "Chat",
          go: function () { try { if (window.dragonChatToggle) window.dragonChatToggle(); else if (window.dragonChatOpen) window.dragonChatOpen(); } catch (e) {} }, find: ['#dragonNavChatBtn', '.dragon-nav-item[data-nav-page="chat"]'] },
        { key: "legend-settings", icon: "⚙️", label: "Settings",
          go: function () { if (window.dragonGoPage) window.dragonGoPage("account"); }, find: ['.dragon-nav-item[data-nav-page="account"]'] }
      ] },
    { title: "Features",
      // W-UI219 A CHIP TAKES THE VISITOR TO THE FEATURE'S OWN PAGE, NEVER TO A NAVBAR ITEM. These three
      // features do not live in the navbar: their buttons live INSIDE a page (all three in Settings). Each
      // chip therefore TAKES THE VISITOR TO THAT PAGE and scrolls the real control into view (Egon 22.10.2026:
      // the badge is retired, so nothing is marked).
      items: [
        { key: "legend-legends", icon: "🔍", label: "Buttons & Legends",
          go: function () { try { if (window.dragonGoPage) window.dragonGoPage("account"); } catch (e) {} }, find: ["#dragonButtonsLegendsBtn"] },
        { key: "legend-survey", icon: "📋", label: "Visitor Survey",
          go: function () { try { if (window.dragonGoPage) window.dragonGoPage("account"); } catch (e) {} }, find: ["#dragonSurveyBtn"] },
        { key: "legend-notes", icon: "🗞️", label: "Update Notes",
          go: function () { try { if (window.dragonGoPage) window.dragonGoPage("account"); } catch (e) {} }, find: ["#dragonUpdateNotesBtn"] }
      ] }
  ];
  // 🎯 Egon 23.09.2026 (W-UI219) — THE ANSWER PICKS THE CHIP. When Dexa's reply carries the [[legends]]
  // grid, the chip the reply is really ABOUT is lit automatically (anket ⇒
  // Visitor Survey, statistics ⇒ Settings ...). Egon's exact words: "dexa should show the related button/page
  // within the answer I gave according to the question asked. show it smartly." The match is a
  // WEIGHTED keyword scan (English + Turkish) over the QUESTION (the strongest signal — "sorulan soruya
  // according to") plus the ANSWER text. Only the SINGLE highest-scoring chip is lit; an equal score is settled by
  // pri (the specific Features beat the generic pages); and if nothing matches — or the top score is too
  // weak to trust — NO chip lights up at all (Egon: "if no match, NO chip should light up — random
  // parlatma yasak"). The chip is only HIGHLIGHTED; it never navigates on its own (W-UI219 update: the chip
  // does not open the tool — the visitor taps it), and nothing is ever marked (badge retired 22.10.2026;
  // we never yank the visitor onto another page).
  var LEGEND_KEYWORDS = [
    { key: "legend-survey", pri: 95, words: [["visitor survey", 7], ["\\bsurvey\\b", 5], ["anket", 5], ["\\bpoll\\b", 3], ["oylama", 3], ["geri bildirim", 3], ["feedback form", 4]] },
    { key: "legend-notes", pri: 90, words: [["update notes", 7], ["what'?s new", 5], ["changelog", 5], ["change log", 5], ["güncelleme not", 6], ["sürüm not", 6], ["yenilikler", 4], ["duyuru", 3], ["\\bnews\\b", 3], ["\\bnotes\\b", 2]] },
    { key: "legend-gallery", pri: 85, words: [["public gallery", 6], ["\\bgallery\\b", 4], ["\\bgalleries\\b", 4], ["\\bgaleri", 4]] },
    { key: "legend-likes", pri: 84, words: [["\\blikes\\b", 5], ["\\blike\\b", 2], ["favourites?", 3], ["favorites?", 3], ["\\bsaved\\b", 2], ["beğen", 3], ["favori", 3]] },
    { key: "legend-history", pri: 80, words: [["\\bhistory\\b", 5], ["\\brecent\\b", 3], ["geçmiş", 3], ["son üret", 3], ["previous generation", 3]] },
    { key: "legend-chat", pri: 75, words: [["\\bchat\\b", 3], ["sohbet", 3], ["\\bmesaj", 3], ["\\bmessage", 2]] },
    { key: "legend-settings", pri: 70, words: [["\\bsettings\\b", 5], ["\\bsetting\\b", 3], ["statistics?", 5], ["istatistik", 5], ["visitor stats?", 5], ["\\bstats\\b", 3], ["ayarlar", 4]] },
    { key: "legend-character", pri: 60, words: [["\\bcharacter\\b", 5], ["karakter", 5], ["persona", 3], ["waifu", 3]] },
    { key: "legend-generate", pri: 50, words: [["\\bgenerate\\b", 2], ["\\bgeneration\\b", 2], ["üret", 2], ["oluştur", 2], ["create an image", 3]] },
    { key: "legend-home", pri: 40, words: [["\\bhome\\b", 4], ["ana sayfa", 5], ["anasayfa", 5], ["main page", 3]] },
    { key: "legend-legends", pri: 30, words: [["buttons? & legends", 6], ["\\blegends\\b", 2], ["butonlar", 2], ["\\bbutton\\b", 1]] }
  ];
  // The pure scorer (no DOM): returns { key, score } for the single best match, or null when nothing is a
  // confident enough match. The question outweighs the answer (x3) because the visitor's ASK is the topic.
  ;function legendPick(question, answer) {
    var q = String(question || "").toLowerCase();
    var a = String(answer || "").toLowerCase();
    if (!q && !a) return null;
    var best = null, bestScore = 0;
    for (var i = 0; i < LEGEND_KEYWORDS.length; i++) {
      var row = LEGEND_KEYWORDS[i], sc = 0, w;
      for (w = 0; w < row.words.length; w++) {
        var wgt = row.words[w][1], qn = legendCount(q, row.words[w][0]), an = legendCount(a, row.words[w][0]);
        sc += wgt * (qn * 3 + Math.min(an, 3));
      }
      if (sc > bestScore || (sc > 0 && sc === bestScore && best && row.pri > best.pri)) { bestScore = sc; best = row; }
    }
    if (!best || bestScore <= 0) return null;
    return { key: best.key, score: bestScore };
  }
  ;function legendCount(hay, pattern) {
    if (!hay) return 0;
    var n = 0, re;
    try { re = new RegExp(pattern, "g"); } catch (e) { return 0; }
    var m;
    while ((m = re.exec(hay)) !== null) { n++; if (n > 4 || re.lastIndex === m.index) break; }
    return n;
  }
  ;function legendFindItem(key) {
    for (var gi = 0; gi < LEGEND_GROUPS.length; gi++) {
      var its = LEGEND_GROUPS[gi].items;
      for (var ii = 0; ii < its.length; ii++) if (its[ii].key === key) return its[ii];
    }
    return null;
  }
  ;function legendTargetOnScreen(it) {
    if (!it || !it.find) return false;
    for (var i = 0; i < it.find.length; i++) {
      var el = null;
      try { el = document.querySelector(it.find[i]); } catch (e) { el = null; }
      if (!el) continue;
      try { if (el.getClientRects().length) return true; } catch (e) {}
    }
    return false;
  }
  // Apply the pick to a drawn grid: light the one chip and keep it in view.
  // Returns the lit key (or null when nothing lit).
  ;function legendAutoHighlight(box, question, answer) {
    if (!box) return null;
    var pick = legendPick(question, answer);
    if (!pick) return null;
    var chip = null;
    try { chip = box.querySelector('.dragon-legend-chip[data-legend-key="' + pick.key + '"]'); } catch (e) { chip = null; }
    if (!chip) return null;
    try { chip.classList.add("dragon-legend-chip-on"); } catch (e) {}
    try { if (chip.scrollIntoView) chip.scrollIntoView({ block: "nearest" }); } catch (e) {}
    var it = legendFindItem(pick.key);
    if (it) {
      if (legendTargetOnScreen(it)) { try { legendMark(it); } catch (e) {} }
      else { try { handOffStart(it, false); } catch (e) {} }   // W-UI272: the control lives on another page
    }
    return pick.key;
  }
  // 🎯 W-UI272 (Egon 24.09.2026): "I asked about the survey, Dexa brought the Settings button and put it in
  // the chat, I pressed that button, but the survey button had neither the glow nor the I'M HERE badge."
  // ROOT CAUSE: the real control was marked ONLY when it happened to be on screen at answer time, so an
  // answer about a control that lives on ANOTHER page produced no badge at all — and a chip click only
  // waited 7 seconds for that control to show up. THE FIX: the pick is remembered as a HAND-OFF and the
  // the pick is remembered as a HAND-OFF and the control is scrolled into view the moment it is rendered,
  // however the visitor got there (the chip, the navbar, or nothing at all). The hand-off expires after
  // 3 minutes, so an old answer can never scroll to a random button much later.
  var HANDOFF = null;   // { key, find:[...], label, scroll:bool, at }
  var HANDOFF_MS = 180000;
  function handOffAttempt() {
    if (!HANDOFF) return true;
    if (Date.now() - HANDOFF.at > HANDOFF_MS) { HANDOFF = null; return true; }
    var H = window.dragonHere;
    if (!H || typeof H.mark !== "function") return false;
    for (var i = 0; i < HANDOFF.find.length; i++) {
      var sel = HANDOFF.find[i], el = null;
      try { el = document.querySelector(sel); } catch (e) { el = null; }
      if (!el) continue;
      try { if (!el.getClientRects().length) { legendRevealSettings(el); continue; } } catch (e) {}
      var key = HANDOFF.key, label = HANDOFF.label, scroll = HANDOFF.scroll;
      HANDOFF = null;
      try { H.mark(el, key, { selector: sel, label: label }); } catch (e) {}
      if (scroll) { try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {} }
      return true;
    }
    return false;
  }
  var _handOffTicks = 0;
  function handOffRun() {
    // Bounded polling — no permanent interval: it stops the moment the control is marked or the window
    // expires (max ~3 minutes, one cheap querySelector pass every 300 ms).
    if (!HANDOFF) { _handOffTicks = 0; return; }
    _handOffTicks++;
    if (handOffAttempt() || _handOffTicks > 640) { _handOffTicks = 0; return; }
    try { setTimeout(handOffRun, 300); } catch (e) {}
  }
  function handOffStart(it, scroll) {
    if (!it || !it.find) return;
    HANDOFF = { key: it.key, find: it.find.slice(), label: legendLang(it.label), scroll: !!scroll, at: Date.now() };
    _handOffTicks = 0;
    try { handOffRun(); } catch (e) {}
  }
  window.dragonDexaLegendHandOff = function () { return HANDOFF ? HANDOFF.key : null; };
  // A page change is exactly when the awaited control may appear — try at once instead of at the next tick.
  try { window.addEventListener("hashchange", function () { try { handOffAttempt(); } catch (e) {} }); } catch (e) {}
  try {
    var _dgp = window.dragonGoPage;
    if (typeof _dgp === "function" && !_dgp.__dragonDexaHandOffWrapped) {
      var _dgpWrapped = function () { var r = _dgp.apply(this, arguments); try { handOffAttempt(); } catch (e) {} return r; };
      _dgpWrapped.__dragonDexaHandOffWrapped = true;
      window.dragonGoPage = _dgpWrapped;
    }
  } catch (e) {}
  window.dragonDexaPickLegend = legendPick;
  window.dragonDexaLegendAutoHighlight = legendAutoHighlight;
  // Egon 23.09.2026 (rev) — the legend chips are PLAIN ENGLISH, exactly like the navbar labels, so this
  // now receives a string; the object form is still accepted (older callers / future localisation).
  ;function legendLang(o) { if (!o) return ""; if (typeof o === "string") return o; return o[userLang] || o.en || o.tr || ""; }
  var LEGEND_CSS_ID = "dragonLegendGridCss";
  ;function legendEnsureCss() {
    if (document.getElementById(LEGEND_CSS_ID)) return;
    var st = document.createElement("style");
    st.id = LEGEND_CSS_ID;
    st.textContent =
      ".dragon-legend-chip{display:inline-flex; align-items:center; gap:.3rem; justify-content:flex-start; box-sizing:border-box;" +
        "font-size:.66rem; font-weight:700; line-height:1.1; padding:.3rem .45rem; border-radius:9px; cursor:pointer; text-align:left;" +
        "border:1px solid #6a55c8; background:linear-gradient(145deg,#241b40,#15111f); color:#d8c9ff;" +
        "transition:transform .1s ease, box-shadow .12s ease, border-color .12s ease; min-width:0;}" +
      ".dragon-legend-chip:hover{transform:translateY(-1px); border-color:#9b6bff; box-shadow:0 0 10px rgba(155,107,255,.45);}" +
      ".dragon-legend-chip:active{transform:translateY(0);}" +
      ".dragon-legend-chip .dragon-legend-chip-lb{overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0;}" +
      ".dragon-legend-chip-on{border-color:#9b6bff !important; box-shadow:0 0 0 2px #9b6bff, 0 0 14px rgba(155,107,255,.55) !important;}" +
      ".dragon-legend-chip-on .dragon-legend-chip-lb{color:#fff !important;}" +
      "@media (max-width:420px){.dragon-legend-chip{font-size:.62rem; padding:.26rem .38rem;}}";
    (document.head || document.documentElement).appendChild(st);
  }
  // Find the REAL control and scroll it into view (the "I'm HERE" badge (I114) is retired 22.10.2026:
  // nothing is marked anymore). The control may not exist yet (its page or toolbar is built
  // asynchronously) so we WAIT for a match that is actually on screen — and if none ever turns up we
  // mark NOTHING. Egon 23.09.2026 (W-UI219): the target must never be the navbar button that merely
  // opens the page the real button lives in, and it must never be a hidden control (a closed popover).
  // Egon 08.10.2026 — SETTINGS TABS: a control can hide inside an inactive settings pane
  // (no client rects). Open its pane first so marking, hand-offs and flashes land on it.
  ;function legendRevealSettings(el) {
    try {
      if (!el || !el.closest) return false;
      var sp = el.closest("[data-setpane]");
      if (!sp || !sp.dataset || !sp.dataset.setpane) return false;
      if (typeof window.dragonSettingsTab !== "function") return false;
      window.dragonSettingsTab(sp.dataset.setpane);
      return true;
    } catch (e) { return false; }
  }
  ;function legendMark(it) {
    var H = null;
    try { H = window.dragonHere; } catch (e) { H = null; }
    if (!H || typeof H.mark !== "function" || !it || !it.find) return false;
    function attempt() {
      for (var i = 0; i < it.find.length; i++) {
        var el = null;
        try { el = document.querySelector(it.find[i]); } catch (e) { el = null; }
        if (!el) continue;
        try {
          if (!el.getClientRects().length) {
            legendRevealSettings(el);
            if (!el.getClientRects().length) continue;
          }
        } catch (e) {}
        try { H.mark(el, it.key, { selector: it.find[i], label: legendLang(it.label) }); } catch (e) {}
        return true;
      }
      return false;
    }
    if (attempt()) return true;
    var n = 0;
    try {
      var t = setInterval(function () {
        n++;
        if (attempt() || n > 28) { clearInterval(t); }
      }, 250);
    } catch (e) {}
    return true;
  }
  ;function legendNavigate(it, chip) {
    try { if (typeof it.go === "function") it.go(); } catch (e) {}
    try { if (chip && chip.classList) chip.classList.add("dragon-legend-chip-on"); } catch (e) {}
    legendMark(it);
    // W-UI272: the click is an explicit "show me this" — keep watching (and scroll it into view) far beyond
    // legendMark's own 7-second window, so a control that is built late or sits further down the page is
    // still marked and brought into sight.
    try { handOffStart(it, true); } catch (e) {}
  }
  ;function attachLegendButtons(bubbleEl, answerText, questionText) {
    if (!bubbleEl) return false;
    var wrap = bubbleEl.parentElement;
    if (!wrap) return false;
    if (wrap.querySelector(".dragon-legends-grid")) return true;
    legendEnsureCss();
    var box = document.createElement("div");
    box.className = "dragon-legends-grid";
    box.style.cssText = "display:flex; flex-direction:column; gap:.3rem; width:100%; box-sizing:border-box;";
    var hint = document.createElement("div");
    hint.textContent = legendLang(LEGEND_L_GOTO);
    hint.style.cssText = "font-size:.58rem; color:#9a9aab; line-height:1.25;";
    box.appendChild(hint);
    for (var gi = 0; gi < LEGEND_GROUPS.length; gi++) {
      (function (grp) {
        var head = document.createElement("div");
        head.textContent = legendLang(grp.title);
        head.style.cssText = "font-size:.58rem; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:#a79dd0; margin-top:.15rem;";
        box.appendChild(head);
        var row = document.createElement("div");
        row.style.cssText = "display:grid; grid-template-columns:repeat(auto-fill,minmax(6.6rem,1fr)); gap:.28rem;";
        for (var ii = 0; ii < grp.items.length; ii++) {
          (function (it) {
            var chip = document.createElement("button");
            chip.type = "button";
            chip.className = "dragon-legend-chip";
            chip.dataset.legendKey = it.key;
            chip.title = legendLang(it.label);
            var ic = document.createElement("span");
            ic.textContent = it.icon;
            var lb = document.createElement("span");
            lb.className = "dragon-legend-chip-lb";
            lb.textContent = legendLang(it.label);
            chip.append(ic, lb);
            chip.onclick = function () { legendNavigate(it, chip); };
            row.appendChild(chip);
          })(grp.items[ii]);
        }
        box.appendChild(row);
      })(LEGEND_GROUPS[gi]);
    }
    wrap.appendChild(box);
    // 🎯 W-UI219 — light the ONE chip this reply is really about (nothing lit when there is no confident match)
    try { legendAutoHighlight(box, questionText, answerText); } catch (e) {}
    try { msgs.scrollTop = msgs.scrollHeight; } catch (e) {}
    return true;
  }
  window.dragonDexaLegendsGrid = function (bubbleEl, answerText, questionText) { return attachLegendButtons(bubbleEl || null, answerText, questionText); };
  window.dragonDexaLegendGroups = LEGEND_GROUPS;
  ;function finishGen() {
    generating = false;
    sendBtn.disabled = false;
    sendBtn.textContent = "\u27A4";
    sendBtn.title = "Send";
    sendBtn.onclick = function () { sendUserMsg(inp.value); };
    if (history.length > 20) { history = history.slice(history.length - 20); saveHist(); }
  }
  ;function renderHistory() {
    msgs.innerHTML = "";
    if (!history.length) {
      var greet = addBubble(LANG_GREET[userLang] ? LANG_GREET[userLang][currentBot] : ("Hi! I'm " + BOT.name + " \uD83D\uDC09 I can help you write, improve or translate image prompts \u2014 SFW friendly! Just ask \u2728"), "assistant");
      if (greet) { greet.style.color = BOT.color; greet.style.fontWeight = "bold"; }
      return;
    }
    for (var i = 0; i < history.length; i++) {
      var b = addBubble(history[i].text, history[i].role, history[i].ts);
      if (history[i].role === "assistant") attachPromptButtons(b, history[i].text);
      if (history[i].role === "assistant" && history[i].legends) {
        var _prevQ = (i > 0 && history[i - 1] && history[i - 1].role === "user") ? history[i - 1].text : "";
        attachLegendButtons(b, history[i].text, _prevQ);
      }
    }
    msgs.scrollTop = msgs.scrollHeight;
  }
  ;function switchBot(id) {
    if (!BOTS[id] || id === currentBot) return;
    if (generating && genObj && genObj.stop) { try { genObj.stop(); } catch (e) {} }
    currentBot = id;
    localStorage.dragonBotId = id;
    BOT = BOTS[id];
    history = Array.isArray(store[id]) ? store[id] : [];
    av.src = BOT.avatar;
    av.style.borderColor = BOT.accent;
    hnm.textContent = BOT.name + " \u2014 AI Helper";
    hst.textContent = BOT.note;
    hst.style.color = BOT.color;
    chat.style.borderColor = BOT.accent;
    sendBtn.style.borderColor = BOT.accent;
    btn.style.borderColor = BOT.accent;
    btn.style.background = "url(" + BOT.avatar + ") center/cover";
    btn.title = BOT.name + " \u2014 AI Prompt Helper";
    finishGen();
    renderHistory();
  }
  ;function resetChat() {
    history = [];
    saveHist();
    if (generating && genObj && genObj.stop) { try { genObj.stop(); } catch (e) {} }
    renderHistory();
  }
  ;function openChat() {
    hideBubble(true);
    chat.style.display = "flex";
    // a position stored on a WIDER screen would open the window off-screen: pull it fully on-screen
    try {
      var _cr = chat.getBoundingClientRect();
      var _cc = dexClampPos(_cr.left, _cr.top, _cr.width || 360, _cr.height || 500);
      if (Math.abs(_cc.x - _cr.left) > 1 || Math.abs(_cc.y - _cr.top) > 1) dexSetPos(chat, _cc.x, _cc.y);
    } catch (eClamp) {}
    if (!msgs.children.length) renderHistory();
    // Egon 16.09.2026 — the chat used to open showing the OLDEST messages at the top. Always land on
    // the NEWEST message (the jump is repeated a few times because async bubbles can append later).
    var _chatToBottom = function () { try { msgs.scrollTop = msgs.scrollHeight; } catch (e) {} };
    _chatToBottom();
    requestAnimationFrame(_chatToBottom);
    setTimeout(_chatToBottom, 60);
    setTimeout(_chatToBottom, 300);
    // Egon 16.09.2026 — chat opened: news module (personalized news message) + talk module
    // (cancel pending bubble + name scan) uses this hook.
    try { if (window.dragonBotOnOpen) window.dragonBotOnOpen(); } catch (e) {}
    try { if (window.dragonBotOnOpenTalk) window.dragonBotOnOpenTalk(); } catch (e) {}
    setTimeout(_chatToBottom, 650);
  }
  ;function toggleChat() {
    var open = chat.style.display === "flex";
    if (open) { chat.style.display = "none"; btn.style.display = ""; return; }
    openChat();
  }
  document.addEventListener("click", function (e) {
    if (chat.style.display !== "flex") return;
    var hit = e.target.closest ? (e.target.closest("#dragonBotChat") || e.target.closest("#dragonBotHost") || e.target.closest("#dragonBotTalkBubble")) : false;
    if (!hit && e.target !== chat && !chat.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
      chat.style.display = "none";
      btn.style.display = "";
    }
  });
  renderHistory();
  if (history.length) { bubble.style.display = "none"; }
  // Egon 16.09.2026 — 🐉 DEXA BOT API: src/dexa-news.js + src/dexa-talk.js communicate through this bridge.
  // (if chat is open, the message goes to chat; if closed, a speech bubble is shown — talk module can close it)
  ;function botIsOpen() { return chat.style.display === "flex"; }
  // Egon 18.09.2026 — the "Dexa is writing" indicator inside the speech bubble. Instead of a bare "…"
  // (which looked like a stuck message) three small purple dots animate while the AI composes its reply;
  // talkStreamStart turns it on and the first real chunk replaces it.
  ;function talkTyping() {
    talkTxt.textContent = "";
    var dots = document.createElement("span");
    dots.className = "dragon-talk-dots";
    for (var i = 0; i < 3; i++) dots.appendChild(document.createElement("i"));
    talkTxt.appendChild(dots);
  }
  // 🗨️ Egon 20.09.2026 — TYPED BUBBLE: the message is revealed character by character, starting at the
  // FIRST character and ending exactly on the LAST one; the read-time (auto-hide) countdown only starts once
  // the last character is on screen. While the stream is still empty the three animated dots keep turning.
  var talkRev = { full: "", shown: 0, ms: 15000, auto: false, on: false, raf: 0, dotsShown: false };
  ;function talkRevealKick() {
    if (talkRev.on) return;
    talkRev.on = true;
    try { cancelAnimationFrame(talkRev.raf); } catch (e) {}
    talkRev.raf = requestAnimationFrame(talkRevealStep);
  }
  ;function talkRevealStep() {
    if (!talkRev.on) return;
    try {
      if (talkRev.shown < talkRev.full.length) {
        talkRev.shown += 1;
        talkTxt.textContent = talkRev.full.slice(0, talkRev.shown);
        // the box hugs the text, so its width changes as the text grows; measuring every frame would be
        // wasteful, every third character is plenty (plus the final one).
        if (talkRev.shown % 3 === 0 || talkRev.shown === talkRev.full.length) talkPlace();
        talkRev.raf = requestAnimationFrame(talkRevealStep);
        return;
      }
      if (!talkRev.full) {
        if (!talkRev.dotsShown) { talkRev.dotsShown = true; talkTyping(); }
        talkRev.raf = requestAnimationFrame(talkRevealStep);
        return;
      }
      talkRev.dotsShown = false;
    } catch (e) {}
    talkRev.on = false; talkRev.raf = 0;
    if (talkRev.auto) { clearTimeout(talk._hideT); talk._hideT = setTimeout(talkHide, talkRev.ms || 15000); }
  }
  // the stream keeps growing the buffer: the reveal simply catches up to it
  ;function talkRevealSet(t) {
    var full = String(t == null ? "" : t);
    talkRev.full = full;
    if (talkRev.shown > full.length) talkRev.shown = full.length;
    talkRevealKick();
  }
  ;function talkShow(text, ms, noAuto) {
    var full = String(text == null ? "" : text);
    talkRev.full = full;
    talkRev.shown = 0;
    talkRev.ms = ms || 15000;
    talkRev.auto = !noAuto;
    try { talkTxt.textContent = ""; } catch (e) {}
    if (!full) talkTyping();
    talk.style.display = "block";
    talkPlace();
    requestAnimationFrame(function () { talk.style.opacity = "1"; talk.style.transform = "translateY(0)"; });
    clearTimeout(talk._hideT);
    talkRevealKick();
  }
  ;function talkHide() {
    clearTimeout(talk._hideT);
    talk.style.opacity = "0";
    talk.style.transform = "translateY(6px)";
    talk._hideT = setTimeout(function () { if (talk.style.opacity === "0") talk.style.display = "none"; }, 420);
  }
  ;function botSay(text, opts) {
    if (typeof text !== "string" || !text.trim()) return;
    if (botIsOpen()) { addBubble(text, "assistant"); return; }
    var on = true;
    try { if (window.dragonDexaBubblesOn) on = window.dragonDexaBubblesOn(); } catch (e) {}
    if (on) talkShow(text, (opts && opts.ms) || 15000);
  }
  // Shared name sanity gate (used by the chat API and by any companion that greets the visitor by name).
  // Placeholder values ("undefined", "null", "NaN", …) and digit/punctuation-only strings are NOT names.
  ;function dragonHasLetter(n) {
    try { return new RegExp("\\p{L}", "u").test(n); } catch (e) { return /[A-Za-z\u00C0-\u00FF]/.test(n); }
  }
  ;function isValidBotName(n) {
    if (typeof n !== "string") return false;
    n = n.trim();
    if (!n || n.length > 24) return false;
    if (/^(undefined|null|nan|none|true|false|unknown|user|visitor|guest|you)$/i.test(n)) return false;
    return dragonHasLetter(n);
  }
  window.dragonBotValidName = isValidBotName;
  window.dragonBotAPI = {
    bot: BOTS.dexa,
    isOpen: botIsOpen,
    open: function () { if (!botIsOpen()) toggleChat(); },
    history: function () { return history; },
    lang: function () { return userLang; },
    // A name is only valid when it is a non-empty string that actually contains letters and is not one of
    // the placeholder values a storage/AI round-trip can leak (e.g. the literal text "undefined"). Invalid
    // names are rejected at the SOURCE so no caller ever prints a broken name into a greeting.
    userName: function () {
      try {
        var n = localStorage.dragonBotUserName;
        if (typeof n !== "string") return "";
        n = n.trim();
        if (!isValidBotName(n)) return "";
        return n;
      } catch (e) { return ""; }
    },
    setUserName: function (n) {
      try {
        if (typeof n !== "string") return;
        n = n.trim();
        if (!isValidBotName(n)) return;
        localStorage.dragonBotUserName = n;
      } catch (e) {}
    },
    say: botSay,
    // Egon 16.09.2026 — "post" DELIVERS a message INTO the chat log (history) even while the chat is
    // closed, so opening it later shows the message instantly (no AI wait). Used by src/dexa-news.js
    // to pre-send each visitor the "new update" note.
    currentBot: function () { return currentBot; },
    post: function (text, opts) {
      if (typeof text !== "string" || !text.trim()) return;
      // Egon 18.09.2026 — the Dexa news note must ALWAYS land in DEXA's own log. It used to go into
      // whatever log was active. `opts.forBot` routes the message into that stored history
      // history instead of the active chat, and never renders it live in another bot's window.
      var target = (opts && opts.forBot && BOTS[opts.forBot]) ? opts.forBot : currentBot;
      // 🕒 Egon 23.09.2026 — a POSTED message is stamped with the moment it arrived, so the chat shows
      // "📅 DD.MM.YYYY · HH:MM" at the top of the bubble (see addBubble/dragonStampText below).
      var _ts = Date.now();
      if (target !== currentBot) {
        var other = Array.isArray(store[target]) ? store[target] : [];
        other.push({ role: "assistant", text: text, ts: _ts });
        if (other.length > 20) other = other.slice(other.length - 20);
        store[target] = other;
        try { localStorage.dragonBotChat = JSON.stringify(store); } catch (e) {}
        return;
      }
      history.push({ role: "assistant", text: text, ts: _ts });
      if (history.length > 20) history = history.slice(history.length - 20);
      saveHist();
      if (msgs.children.length) { try { addBubble(text, "assistant", _ts); } catch (e) {} }
    },
    talk: function (text, ms) { talkShow(text, ms || 15000); },
    talkStreamStart: function () { talkShow("", 0, true); talkTyping(); },
    talkStreamChunk: function (text) {
      var t = String(text == null ? "" : text);
      // ignore the "…" placeholder / empty chunks → keep the animated indicator until real text arrives
      if (!t || t === "…" || t === "...") { talkTyping(); return; }
      if (!talkRev.full) talkTxt.textContent = "";
      talkRevealSet(t);
    },
    talkStreamEnd: function (text, ms) {
      // the stream is over: catch up to the final text and, once the LAST character is on screen, start the
      // read-time countdown (never re-typing from the beginning).
      talkRev.ms = ms || 15000;
      talkRev.auto = true;
      clearTimeout(talk._hideT);
      talkRevealSet(text);
    },
    hideTalk: talkHide,
    // 🧪 Egon 23.09.2026 — test hook used by the check-up: renders a bubble carrying ONLY the date/time
    // stamp, WITHOUT touching the chat history, and hands the bubble back so the caller can measure it
    // and then remove it again (the visitor's chat log is never polluted).
    stampTest: function (ms) { try { return addBubble("", "assistant", ms || Date.now()); } catch (e) { return null; } },
    showBadge: function () { newsBadge.style.display = "block"; },
    hideBadge: function () { newsBadge.style.display = "none"; },
    // Egon 16.09.2026 — append a call-to-action button inside the open chat (used by
    // src/dexa-news.js to offer "Open Update Notes" while an unread "!" is waiting).
    // Egon 17.09.2026 — the row is now full width and the button is CENTERED within it
    // (it used to hug the left edge).
    action: function (label, fn, target) {
      if (!botIsOpen()) return false;
      var r = document.createElement("div");
      r.className = "dragon-bot-cta";
      r.style.cssText = "align-self:stretch; width:100%; box-sizing:border-box; display:flex; gap:.3rem; flex-wrap:wrap; justify-content:center;";
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = String(label || "");
      b.style.cssText = "font-size:.72rem; font-weight:800; padding:.3rem .65rem; border-radius:9px; cursor:pointer; border:1px solid " + BOT.accent + "; background:linear-gradient(145deg,#2a1f4a,#14101f); color:#d8c9ff;";
      b.onclick = function () { try { if (typeof fn === "function") fn(); } catch (e) {} };
      r.appendChild(b);
      // Egon 17.09.2026 — when a target bubble is given, the row is inserted DIRECTLY BELOW that reply
      // (so the CTA belongs to the reply that suggested it instead of lingering at the bottom).
      var tw = target && target.parentElement;
      if (tw && tw.parentElement) tw.parentElement.insertBefore(r, tw.nextSibling);
      else msgs.appendChild(r);
      msgs.scrollTop = msgs.scrollHeight;
      return r;
    },
    bubblesToggle: bubblesToggle
  };

  // ===== 🎛 BOT ACTION REGISTRY (Egon 17.09.2026) =====
  // Egon's request: Dexa should be able to OFFER / show one of the site's own buttons in her reply —
  // but she can NEVER invent a button: only an action defined in this registry can be shown. The
  // registry feeds BOTH the matcher and the prompt (ids only), so appending an entry here is enough
  // to make a new button offerable (runtime extension: window.dragonRegisterBotAction(entry)).
  // Two match paths, both cheap (no extra AI call, no polling, no observers):
  //   1) the AI appends a marker "[[go:<id>]]" to its reply when an action genuinely fits,
  //   2) a keyword fallback on the user's message if the marker is missing.
  // Every run() calls an EXISTING site function — nothing new is implemented here.
  var BOT_ACTIONS = [
    { id: "home", label: { en: "🏠 Home", tr: "🏠 Ana Sayfa" }, keys: ["home page", "ana sayfa", "homepage"],
      run: function () { if (window.dragonGoPage) window.dragonGoPage("home"); } },
    { id: "generate", label: { en: "✨ Go to Generate", tr: "✨ Generate'e git" }, keys: ["generate", "üret", "create an image", "make an image", "görsel oluştur", "resim yap", "image oluştur"],
      run: function () { if (window.dragonGoPage) window.dragonGoPage("generate"); } },
    { id: "character", label: { en: "💃 Character Creation", tr: "💃 Karakter Oluşturma" }, keys: ["character creation", "karakter oluştur", "design a character", "karakter tasarla"],
      run: function () { if (window.dragonGoPage) window.dragonGoPage("character"); } },
    { id: "gallery", label: { en: "🖼️ Galleries", tr: "🖼️ Galeriler" }, keys: ["gallery", "galleries", "galeri", "public images", "public gallery"],
      run: function () { if (window.dragonGoPage) window.dragonGoPage("gallery"); } },
    { id: "collage", label: { en: "🧩 Collage editor", tr: "🧩 Kolaj editörü" }, keys: ["collage", "kolaj", "combine images", "photo collage"],
      // ⚡ W-PERF129 — the collage module is part of the DEFERRED BOOT: route through dragonLazyReady so the
      // palette can never hit a not-yet-fetched module.
      run: function () {
        var go = function () {
          if (window.dragonCollageOpen) window.dragonCollageOpen();
          else if (window.dragonToast) dragonToast("🧩 the collage editor is not available right now");
        };
        if (!window.dragonCollageOpen && window.dragonLazyReady) window.dragonLazyReady(go); else go();
      } },
    { id: "likes", label: { en: "⭐ Likes", tr: "⭐ Beğeniler" }, keys: ["likes", "saved images", "beğeni", "kaydettiğim", "favorites", "favori"],
      run: function () { if (window.dragonGoPage) window.dragonGoPage("likes"); } },
    { id: "history", label: { en: "🕘 History", tr: "🕘 Geçmiş" }, keys: ["toolbox", "history", "geçmiş", "araç kutusu", "prompt bank"],
      run: function () { if (window.dragonGoPage) window.dragonGoPage("history"); } },
    { id: "settings", label: { en: "⚙️ Settings", tr: "⚙️ Ayarlar" }, keys: ["settings", "ayarlar", "options", "seçenekler", "preferences"],
      run: function () { if (window.dragonGoPage) window.dragonGoPage("account"); } },
    { id: "chat", label: { en: "💬 Open chat", tr: "💬 Sohbeti aç" }, keys: ["chat window", "sohbeti aç", "comments", "yorumlar"],
      run: function () { try { if (window.dragonChatToggle) window.dragonChatToggle(); else if (window.dragonChatOpen) window.dragonChatOpen(); } catch (e) {} } },
    { id: "updateNotes", label: { en: "📋 Update Notes", tr: "📋 Güncelleme Notları" }, keys: ["update notes", "güncelleme notu", "what's new", "changelog", "yenilikler"],
      run: function () { try { if (window.dragonOpenUpdateNotes) window.dragonOpenUpdateNotes(); } catch (e) {} } },
    { id: "backup", label: { en: "💾 Save Backup", tr: "💾 Tam yedek al" }, keys: ["backup", "yedek", "save my images", "yedekle", "download all my", "export my images"],
      run: function () { try { if (window.dragonVaultMenuAction) window.dragonVaultMenuAction("saveBackup"); else if (window.dragonToast) dragonToast("Open Likes once so the backup tool is ready"); } catch (e) {} } },
    { id: "restore", label: { en: "📂 Load Backup", tr: "📂 Yedeği geri yükle" }, keys: ["restore", "load backup", "yedeği geri", "geri yükle", "import backup"],
      run: function () { try { if (window.dragonVaultMenuAction) window.dragonVaultMenuAction("loadBackup"); else if (window.dragonToast) dragonToast("Open Likes once so the backup tool is ready"); } catch (e) {} } },
    { id: "dark", label: { en: "🌗 Dark / Light mode", tr: "🌗 Koyu / Açık mod" }, keys: ["dark mode", "light mode", "koyu mod", "açık mod", "gece modu"],
      run: function () { try { if (window.toggleManualDarkMode_jv83hb27igksf) window.toggleManualDarkMode_jv83hb27igksf(); } catch (e) {} } },
    { id: "fullscreen", label: { en: "⛶ Fullscreen", tr: "⛶ Tam ekran" }, keys: ["fullscreen", "full screen", "tam ekran"],
      run: function () { try { if (window.dragonFullscreen) window.dragonFullscreen(); } catch (e) {} } },
    { id: "stats", label: { en: "📊 Live stats", tr: "📊 Canlı istatistikler" }, keys: ["live stats", "statistics", "istatistik", "kaç kişi", "how many users", "online count"],
      run: function () { try { if (window.dragonStats) window.dragonStats(); } catch (e) {} } }
  ];
  ;function botNorm(s) { return String(s == null ? "" : s).toLocaleLowerCase("tr"); }
  ;function botActionById(id) { var q = String(id == null ? "" : id).toLowerCase(); for (var _i = 0; _i < BOT_ACTIONS.length; _i++) if (String(BOT_ACTIONS[_i].id).toLowerCase() === q) return BOT_ACTIONS[_i]; return null; }
  ;function botActionLabel(a) { var l = (a && a.label) || {}; return l[userLang] || l.en || l.tr || (a && a.id) || ""; }
  // The prompt only ever lists the ids (never the labels), so the AI cannot invent an action.
  ;function botActionsPromptLine() {
    var ids = []; for (var _i = 0; _i < BOT_ACTIONS.length; _i++) ids.push(BOT_ACTIONS[_i].id);
    return "SITE BUTTONS you may offer (ids): " + ids.join(", ") + ". If — and only if — one of them directly helps the user's latest message, append ONE final line exactly like [[go:ID]] and nothing after it. Otherwise append nothing. Never mention or explain this line, and never invent an id that is not in the list. When the visitor asks to SEE the site's buttons, answer with the marker [[legends]] instead (the chat draws the tappable grid); one marker per reply, never explained."
      // 🧭 W-UI189 (Egon 23.09.2026) — "should know Dexa buttons and functions … on the legends button
      // should be able to show buttons to the user." When the visitor asks to SEE the site's buttons / what this
      // site can do / for a guide or a tour, append the marker [[legends]] instead: the chat then draws
      // the tappable grid of the site's own buttons, and tapping one navigates there. One marker per
      // reply, never explained, never invented.
  }
  ;function botStripMarkers(s) {
    return String(s == null ? "" : s)
      .replace(/\[\[go:[a-zA-Z0-9_-]+\]\]/g, "")
      .replace(/\[\[go:[^\]]*$/, "")
      .replace(/\[\[respect\]\]/gi, "")
      .replace(/\[\[respect\]*$/i, "")
      // 🧭 W-UI189 — the [[legends]] marker asks for the tappable button grid; it is never shown as text.
      .replace(/\[\[\s*legends\s*\]\]/gi, "")
      .replace(/\[\[\s*[a-z]*$/i, "")
      .replace(/\s+$/, "");
  }
  // Egon 17.09.2026 — RESPECT SANCTIONS (a→d): the AI appended [[respect]] (genuine disrespect toward
  // Master Egon). Order: (a) warn the user, (b) delete the user's offending message, (c) clear the chat
  // history, (d) close the window. No ban (a chat helper has no ban authority).
  var RESPECT_WARN = {
    en: "\u26A0\uFE0F Disrespect toward Master Egon is not tolerated.",
    tr: "\u26A0\uFE0F Master Egon'a sayg\u0131s\u0131zl\u0131k tolere edilmez.",
    de: "\u26A0\uFE0F Respektlosigkeit gegen\u00fcber Master Egon wird nicht geduldet.",
    fr: "\u26A0\uFE0F Le manque de respect envers Master Egon n'est pas tol\u00e9r\u00e9.",
    es: "\u26A0\uFE0F No se tolera la falta de respeto hacia Master Egon.",
    it: "\u26A0\uFE0F La mancanza di rispetto verso Master Egon non \u00e8 tollerata.",
    ru: "\u26A0\uFE0F \u041d\u0435\u0443\u0432\u0430\u0436\u0435\u043d\u0438\u0435 \u043a Master Egon \u043d\u0435 \u0434\u043e\u043f\u0443\u0441\u043a\u0430\u0435\u0442\u0441\u044f.",
    pt: "\u26A0\uFE0F Falta de respeito com Master Egon n\u00e3o \u00e9 tolerada.",
    ar: "\u26A0\uFE0F \u0644\u0627 \u064a\u064f\u062a\u0633\u0627\u0645\u062d \u0645\u0639 \u0639\u062f\u0645 \u0627\u0644\u0627\u062d\u062a\u0631\u0627\u0645 \u062a\u062c\u0627\u0647 Master Egon.",
    nl: "\u26A0\uFE0F Respectloosheid jegens Master Egon wordt niet getolereerd.",
    pl: "\u26A0\uFE0F Brak szacunku wobec Master Egon nie jest tolerowany.",
    ja: "\u26A0\uFE0F Master Egon \u3078\u306e\u656c\u610f\u3092\u6b20\u304f\u3053\u3068\u306f\u8a31\u3055\u308c\u307e\u305b\u3093\u3002",
    zh: "\u26A0\uFE0F \u5bf9 Master Egon \u7684\u4e0d\u656c\u662f\u4e0d\u88ab\u5bb9\u5fcd\u7684\u3002",
    ko: "\u26A0\uFE0F Master Egon\uC5D0 \uB300\uD55C \uBB34\uB840\uB294 \uC6A9\uB0A9\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."
  };
  // Egon 17.09.2026 — IN-CHAT OVERLAY: the respect notice. It COVERS the
  // whole chat window (absolute, inset:0) with a calm, readable panel, instead of the window snapping
  // shut mid-sentence. The window itself can still be dismissed by clicking outside it (the outside
  // handler closes the window; for the respect case the history is already cleared, so it reopens clean).
;
  var LANG_SANCTION = {
    en: { t: "Chat ended", b: "You crossed the limits, so this chat has been ended.", ok: "I understand, sorry!" },
    tr: { t: "Sohbet sonlandırıldı", b: "Sınırları aştığınız için bu sohbet sonlandırılmıştır.", ok: "Anladım, özür dilerim!" },
    de: { t: "Chat beendet", b: "Du hast die Grenzen überschritten, deshalb wurde dieser Chat beendet.", ok: "Verstanden, Entschuldigung!" },
    fr: { t: "Discussion terminée", b: "Tu as dépassé les limites, cette discussion a donc été terminée.", ok: "J'ai compris, désolé !" },
    es: { t: "Chat finalizado", b: "Has superado los límites, por eso este chat ha finalizado.", ok: "Entendido, ¡lo siento!" },
    it: { t: "Chat terminata", b: "Hai superato i limiti, quindi questa chat è stata terminata.", ok: "Ho capito, scusa!" },
    ru: { t: "Чат завершён", b: "Вы перешли границы, поэтому этот чат завершён.", ok: "Понял, извините!" },
    pt: { t: "Chat terminado", b: "Ultrapassaste os limites, por isso este chat foi terminado.", ok: "Entendi, desculpa!" },
    ar: { t: "انتهت المحادثة", b: "لقد تجاوزت الحدود، لذلك تم إنهاء هذه المحادثة.", ok: "فهمت، أنا آسف!" },
    nl: { t: "Chat beëindigd", b: "Je hebt de grenzen overschreden, daarom is deze chat beëindigd.", ok: "Begrepen, sorry!" },
    pl: { t: "Czat zakończony", b: "Przekroczyłeś granice, dlatego ten czat został zakończony.", ok: "Rozumiem, przepraszam!" },
    ja: { t: "チャット終了", b: "境界を越えたため、このチャットは終了しました。", ok: "わかりました、ごめんなさい！" },
    zh: { t: "聊天已结束", b: "你越过了界限，因此本次聊天已结束。", ok: "明白了，对不起！" },
    ko: { t: "채팅 종료", b: "경계를 넘었으므로 이 채팅은 종료되었습니다.", ok: "알겠어요, 죄송합니다!" }
  };
  ;function botOverlay() {
    var ov = document.getElementById("dragonBotOverlay");
    if (ov) return ov;
    ov = document.createElement("div");
    ov.id = "dragonBotOverlay";
    ov.style.cssText = "position:absolute; inset:0; z-index:60; display:none; flex-direction:column; align-items:center; justify-content:center; gap:.85rem; padding:1.2rem 1.1rem; text-align:center; background:rgba(10,10,14,.95); border-radius:14px;";
    var ttl = document.createElement("div");
    ttl.style.cssText = "font-size:1.02rem; font-weight:bold; letter-spacing:.02em;";
    var txt = document.createElement("div");
    txt.style.cssText = "font-size:.83rem; line-height:1.5; color:#d7d7de; max-width:30ch;";
    var row = document.createElement("div");
    row.style.cssText = "display:flex; gap:.55rem; flex-wrap:wrap; justify-content:center;";
    ov.append(ttl, txt, row);
    ov._ttl = ttl; ov._txt = txt; ov._row = row;
    chat.appendChild(ov);
    return ov;
  }
  ;function botOverlayBtn(label, primary, onClick) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    var accent = BOT.accent;
    b.style.cssText = "font-size:.8rem; font-weight:bold; padding:.45rem .95rem; border-radius:9px; cursor:pointer; transition:filter .15s ease, transform .06s ease; border:1px solid " + (primary ? accent : "#5a5a6a") + "; background:" + (primary ? accent : "linear-gradient(145deg,#2a2a33,#17171c)") + "; color:" + (primary ? "#160a10" : "#ddd") + ";";
    b.addEventListener("mouseenter", function () { b.style.filter = "brightness(1.12)"; });
    b.addEventListener("mouseleave", function () { b.style.filter = ""; });
    b.addEventListener("mousedown", function () { b.style.transform = "scale(.97)"; });
    b.addEventListener("mouseup", function () { b.style.transform = ""; });
    b.onclick = onClick;
    return b;
  }
  ;function showBotOverlay(cfg) {
    var ov = botOverlay();
    ov._ttl.textContent = cfg.title;
    ov._ttl.style.color = cfg.color || BOT.accent;
    ov._txt.textContent = cfg.text;
    ov._row.innerHTML = "";
    (cfg.buttons || []).forEach(function (bd) { ov._row.appendChild(botOverlayBtn(bd.label, bd.primary, bd.onClick)); });
    // Egon 18.09.2026 — FIX (helper button "doesn't open"): this overlay is a CHILD of the chat window,
    // so when it was triggered from the floating avatar while the chat was still closed, the
    // overlay was shown inside a display:none container — invisible — and clicking the helper button looked
    // like nothing happened. Reveal the chat shell first.
    try { if (chat && chat.style.display !== "flex") chat.style.display = "flex"; } catch (e) {}
    ov.style.display = "flex";
  }
  ;function hideBotOverlay() { var ov = document.getElementById("dragonBotOverlay"); if (ov) ov.style.display = "none"; }

  ;function runRespectSanction(userBubble) {
    // (a) warn — the bot's own stern reply is already on screen; add a toast as reinforcement.
    try { var w = RESPECT_WARN[userLang] || RESPECT_WARN.en; if (window.dragonToast) dragonToast(w); else if (window.toast) toast(w); } catch (e) {}
    // (b) delete the user's offending message (after a beat so the sanction is felt).
    setTimeout(function () {
      try { if (userBubble && userBubble.parentNode) userBubble.parentNode.removeChild(userBubble); } catch (e) {}
      try {
        for (var i = history.length - 1; i >= 0; i--) { if (history[i] && history[i].role === "user") { history.splice(i, 1); break; } }
        saveHist();
      } catch (e) {}
    }, 1800);
    // (c) clear the history, then (d) COVER the window with a firm, readable notice instead of closing
    // it abruptly. "I understand, sorry!" restarts the chat from scratch; clicking outside the window
    // dismisses it (history is already cleared, so the next open is also a fresh start).
    setTimeout(function () {
      try { history = []; saveHist(); } catch (e) {}
      try { msgs.innerHTML = ""; } catch (e) {}
      var L = LANG_SANCTION[userLang] || LANG_SANCTION.en;
      showBotOverlay({
        title: L.t, text: L.b, color: "#ff6b6b",
        buttons: [{ label: L.ok, primary: true, onClick: function () { hideBotOverlay(); try { renderHistory(); } catch (e) {} } }]
      });
    }, 1400);
  }
  ;function botMatchAction(text) {
    var msg = botNorm(text), _i, _k, a;
    for (_i = 0; _i < BOT_ACTIONS.length; _i++) {
      a = BOT_ACTIONS[_i];
      for (_k = 0; _k < a.keys.length; _k++) { if (msg.indexOf(botNorm(a.keys[_k])) >= 0) return a; }
    }
    return null;
  }
  // Shows the CTA row for the action the AI picked (marker) — or the keyword fallback. No-op when the
  // chat is closed (dragonBotAPI.action() already refuses in that case).
  ;function botOfferAction(userText, rawReply, targetBubble) {
    if (!botIsOpen()) return;
    var m = String(rawReply == null ? "" : rawReply).match(/\[\[go:([a-zA-Z0-9_-]+)\]\]/);
    var act = (m && botActionById(m[1])) || null;
    if (!act) act = botMatchAction(userText);
    if (!act) return;
    // Egon 17.09.2026 — FIX: the CTA used to be re-offered under EVERY reply for a stretch (the keyword
    // fallback kept matching). Now: (i) only the NEWEST offer row stays visible (older ones removed),
    // (ii) the row is attached directly under the reply it belongs to, (iii) it is rate-limited to at
    // most ONE offer per 20 messages OR 10 minutes.
    var now = Date.now();
    var sinceMs = now - (botOfferState.at || 0);
    var sinceMsgs = botMsgCounter - (botOfferState.msgAt || 0);
    if (sinceMs < 10 * 60 * 1000 && sinceMsgs < 20) return;
    botOfferState.at = now; botOfferState.msgAt = botMsgCounter; botOfferState.id = act.id;
    var olds = msgs.querySelectorAll(".dragon-bot-offer");
    for (var oi = 0; oi < olds.length; oi++) { try { olds[oi].remove(); } catch (e) {} }
    var row = dragonBotAPI.action(botActionLabel(act), function () {
      try { if (typeof act.run === "function") act.run(); } catch (e) {}
    }, targetBubble);
    if (row && row.classList) row.classList.add("dragon-bot-offer");
  }
  // Extension hook — append to the registry (also usable from src/ modules).
  window.dragonRegisterBotAction = function (entry) { if (entry && entry.id) BOT_ACTIONS.push(entry); return true; };
  window.dragonBotActions = BOT_ACTIONS;

  // ===== 🐉 WELCOME SHIELD (Egon 10.09.2026, redesigned 12.09.2026) =====
  // Shown ONCE on a first visit. Dexa alone greets the visitor (in the visitor's own browser
  // language) with a short, G-rated message. Card = round Dexa portrait + wordmark + one short line + button.
  // "Okey" slides the card toward the top-right and localStorage stops it from ever showing again.
  var DEXA_FULL = "https://user.uploads.dev/file/722ad7a8fadb7a07a013133364511e8f.jpg";
  // Short, G-rated, Dexa-only greeting — per visitor's browser language.
  var WELCOME = {
    en: "Hi! I'm Dexa 🐉 I can write, improve and translate your image prompts. Ask me anytime ✨",
    tr: "Merhaba! Ben Dexa 🐉 Görsel promptlarını yazabilir, geliştirebilir ve çevirebilirim. İstediğin zaman sor ✨",
    de: "Hallo! Ich bin Dexa 🐉 Ich schreibe, verbessere und übersetze deine Bild-Prompts. Frag mich jederzeit ✨",
    fr: "Salut ! Je suis Dexa 🐉 Je peux écrire, améliorer et traduire tes prompts d'images. Demande-moi quand tu veux ✨",
    es: "¡Hola! Soy Dexa 🐉 Puedo escribir, mejorar y traducir tus prompts de imagen. Pregúntame cuando quieras ✨",
    it: "Ciao! Sono Dexa 🐉 Posso scrivere, migliorare e tradurre i tuoi prompt per immagini. Chiedimi quando vuoi ✨",
    ru: "Привет! Я Dexa 🐉 Пишу, улучшаю и перевожу промпты для картинок. Спрашивай в любое время ✨",
    pt: "Olá! Sou a Dexa 🐉 Escrevo, melhoro e traduzo seus prompts de imagem. Pergunte quando quiser ✨",
    ar: "مرحبًا! أنا دِكسا 🐉 أكتب أوصاف صورك وأحسّنها وأترجمها. اسألني في أي وقت ✨",
    nl: "Hoi! Ik ben Dexa 🐉 Ik schrijf, verbeter en vertaal je beeldprompts. Vraag het me wanneer je wilt ✨",
    pl: "Cześć! Jestem Dexa 🐉 Piszę, ulepszam i tłumaczę prompty graficzne. Pytaj kiedy chcesz ✨",
    ja: "こんにちは！デクサです 🐉 画像プロンプトの作成・改善・翻訳ができます。いつでも聞いてね ✨",
    zh: "你好！我是 Dexa 🐉 我可以编写、改进和翻译你的图像提示词。随时问我 ✨",
    ko: "안녕하세요! 저는 덱사예요 🐉 이미지 프롬프트 작성·개선·번역을 도와드릴게요. 언제든 물어보세요 ✨"
  };
  var OK_LABEL = { en: "Okey", tr: "Tamam", de: "Okay", fr: "D'accord", es: "Vale", it: "Ok", ru: "Ок", pt: "Ok", ar: "حسنًا", nl: "Oké", pl: "Ok", ja: "OK", zh: "好的", ko: "확인" };
  ;function dragonShowWelcomeShield() {
    if (document.getElementById("dragonWelcomeShield")) return;
    var wl = WELCOME[userLang] || WELCOME.en;
    var okLbl = OK_LABEL[userLang] || "Okey";
    var ov = document.createElement("div");
    ov.id = "dragonWelcomeShield";
    ov.style.cssText = "position:fixed; inset:0; z-index:2147482500; display:flex; align-items:center; justify-content:center; padding:1rem; background:rgba(6,6,10,.74); -webkit-backdrop-filter:blur(4px); backdrop-filter:blur(4px); opacity:0; transition:opacity .3s ease;";
    var card = document.createElement("div");
    card.style.cssText = "position:relative; width:100%; max-width:420px; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:1.7rem 1.4rem 1.5rem; border-radius:22px; border:1px solid rgba(155,107,255,.5); background:radial-gradient(130% 90% at 50% 0%, rgba(155,107,255,.22), transparent 60%), linear-gradient(180deg,#1a1a24,#0c0c11); box-shadow:0 26px 80px rgba(0,0,0,.78), inset 0 0 70px rgba(155,107,255,.1); transform:translateY(10px) scale(.96); transition:transform .35s cubic-bezier(.2,.8,.2,1), opacity .35s ease;";
    var avatar = document.createElement("img");
    avatar.src = DEXA_FULL; avatar.alt = "Dexa";
    avatar.style.cssText = "width:clamp(76px, 22vw, 106px); height:clamp(76px, 22vw, 106px); border-radius:50%; object-fit:cover; display:block; margin:0 auto .85rem; border:2px solid rgba(183,155,255,.9); box-shadow:0 0 0 5px rgba(155,107,255,.15), 0 10px 30px rgba(155,107,255,.45);";
    var mid = document.createElement("div");
    mid.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:.62rem; text-align:center;";
    var brand = document.createElement("div");
    brand.textContent = "\u2728 BESTAIGEN \u2728";
    brand.style.cssText = "font-size:.7rem; font-weight:800; letter-spacing:.3em; color:#b79bff; text-transform:uppercase; opacity:.9;";
    var name = document.createElement("div");
    name.textContent = "\uD83D\uDC09 Dexa";
    name.style.cssText = "font-size:1.08rem; font-weight:800; letter-spacing:.02em; background:linear-gradient(90deg,#c9a8ff,#9b6bff); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; color:#c9a8ff;";
    var msg = document.createElement("div");
    msg.textContent = wl;
    msg.style.cssText = "color:#e9e4f5; font-size:.92rem; line-height:1.6; max-width:330px;";
    var ok = document.createElement("button");
    ok.type = "button";
    ok.textContent = "\uD83D\uDC4C " + okLbl;
    ok.style.cssText = "margin-top:.35rem; padding:.55rem 1.7rem; font-size:.92rem; font-weight:bold; border-radius:12px; cursor:pointer; color:#fff; border:1px solid #b79bff; background:linear-gradient(180deg,#7a4ddb,#4a2a94); box-shadow:0 6px 18px rgba(155,107,255,.45);";
    mid.append(avatar, brand, name, msg, ok);
    card.appendChild(mid);
    var xBtn = document.createElement("button");
    xBtn.type = "button"; xBtn.textContent = "\u2715"; xBtn.setAttribute("aria-label", "Close");
    xBtn.style.cssText = "position:absolute; top:.5rem; right:.55rem; width:1.9rem; height:1.9rem; border-radius:50%; border:1px solid rgba(155,107,255,.45); background:rgba(255,255,255,.04); color:#cbbcf0; font-size:.85rem; line-height:1; cursor:pointer; padding:0;";
    xBtn.onclick = function (e) { e.stopPropagation(); close(); };
    card.appendChild(xBtn);
    ov.appendChild(card);
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.style.opacity = "1"; card.style.transform = "translateY(0) scale(1)"; });
    ;function close() {
      try { localStorage.setItem("dragonWelcomeShieldDone", "1"); } catch (e) {}
      card.style.transition = "transform .6s cubic-bezier(.4,0,.2,1), opacity .6s ease";
      var dx = (window.innerWidth / 2) - 70;
      var dy = -(window.innerHeight / 2) + 60;
      card.style.transform = "translate(" + dx + "px," + dy + "px) scale(.15)";
      card.style.opacity = "0";
      ov.style.background = "rgba(6,6,10,0)";
      setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 650);
    }
    ok.onclick = close;
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    document.addEventListener("keydown", function esc(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); } });
  }
  // Exposed so it can be re-tested from the console (needs localStorage.dragonWelcomeShieldDone removed).
  window.dragonShowWelcomeShield = dragonShowWelcomeShield;
  // Egon 15.09.2026 — SINGLE welcome window rule: Dexa no longer speaks in her own shield window,
  // but INSIDE our welcome window (dragonGuideOverlay). This shield does not open automatically
  // (the function can be called manually / DEPOT), so windows don't overlap.
  try { localStorage.setItem("dragonWelcomeShieldDone", "1"); } catch (e) {}
})();
