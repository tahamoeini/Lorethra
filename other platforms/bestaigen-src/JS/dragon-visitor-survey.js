
/* ===== VISITOR SURVEY (Egon, 2026-09-19) =====================================================
   One survey, two ways in: (a) an invite bar, shown after 60 MINUTES of ACTIVE
   (tab-visible) time, and (b) the permanent "Survey" button in Settings -> About. Both entry points
   open the SAME panel.
   The panel is a single card that is torn down and rebuilt IN PLACE: pressing "Complete survey &
   show results" pushes the votes to the durable server counters and then turns the card into the
   LIVE results view of exactly the same size (the tallies are pulled back from the server and
   refreshed while the view is open).
   Chrome strings are localised to the 14 languages the generator already speaks; the feature names
   stay in the product's own English UI wording, each one carrying its own SYMBOL so the row is
   recognisable at a glance. Every row and every option also carries a one-line description of what
   that system does, shown as a tooltip.
   Design language: DRAGON UI KIT only (rule I84). Legends row (rule I85) is the Settings button +
   the invite bar. */
(function () {
  var ACTIVE_MS_NEEDED = 60 * 60 * 1000; // 60 MINUTES of active time (Egon correction: NOT 60 seconds)
  var LS_ACTIVE = "dragonSurveyActiveMs";
  var LS_TICK = "dragonSurveyLastTick";
  var LS_INVITED = "dragonSurveyInviteShown";
  var LS_DONE = "dragonSurveyDone";
  var LS_VOTES = "dragonSurveyVotes";
  var LS_NEXT = "dragonSurveyNext";

  // Symbol + English product name of every system the survey asks about. The symbol is the one the
  // visitor already sees on the matching button in the generator, so the list reads like the UI.
  var ITEMS = [
    { s: "\uD83D\uDDBC", n: "Public Gallery", d: "Browse and search images that everyone has created with this generator." },
    { s: "\u2B50", n: "Likes (private gallery folders)", d: "Save images you love into your own folders, kept on this device." },
    { s: "\u2764\uFE0F", n: "Favorites & What I Like", d: "A personal shortlist of your favourite saved images." },
    { s: "\uD83D\uDD0D", n: "Lightbox viewer", d: "Open any image full size, with zoom, next/previous and save buttons." },
    { s: "\uD83E\uDD16", n: "Helper AI Dexa", d: "The in-page assistant that writes, improves and translates prompts for you." },
    { s: "\uD83D\uDD2D", n: "subChannel scan", d: "Look inside the extra sub-channels of a public gallery for more images." },
    { s: "\uD83D\uDCAC", n: "Chat", d: "Talk with other visitors in the live channels (Feedback, Suggestion, ...)." },
    { s: "\uD83D\uDC83", n: "Character Creation", d: "Design a character once and drop it into your prompts." },
    { s: "\uD83C\uDFE6", n: "Prompt Bank", d: "Save your own prompts and bring them back anytime." },
    { s: "\uD83C\uDF9E\uFE0F", n: "Recent thumbnails", d: "A strip of your latest creations shown under the image." },
    { s: "\uD83C\uDFDE\uFE0F", n: "Hero pictures", d: "The large rotating picture at the top of the home page." },
    { s: "\uD83D\uDD58", n: "Image History", d: "A searchable list of everything you have generated." },
    { s: "\uD83D\uDCCA", n: "Live stats & online counter", d: "How many people are creating right now, plus the all-time record." },
    { s: "\uD83D\uDCF0", n: "News ticker", d: "Site announcements that scroll across the top of the page." },
    { s: "\uD83D\uDD0A", n: "Generation sounds", d: "A short sound when your image is ready." },
    { s: "\uD83D\uDC09", n: "Dexa messages", d: "The helper's tips and announcements, shown as speech bubbles." },
    { s: "\uD83D\uDDC2\uFE0F", n: "Gallery list & sort", d: "Pick which public gallery to browse, and how to sort it." },
    { s: "\uD83E\uDDF0", n: "Toolbox (gallery toolbar)", d: "The gallery toolbar: search, filters, sliders and display options." },
    { s: "\uD83D\uDCCF", n: "Tile sliders", d: "Change thumbnail size and gallery zoom." },
    { s: "\uD83C\uDFA8", n: "Page designs & Generator Themes", d: "Change how the pages look and which colour theme is used." },
    { s: "\uD83D\uDCEE", n: "Push \u2192 Public Gallery", d: "Send one of your own images to the public gallery." },
    { s: "\uD83E\uDDEC", n: "Duplicate / Dedupe", d: "Group images that share the same prompt and browse the copies." },
    { s: "\uD83D\uDEE1\uFE0F", n: "Safe / PG13 filters", d: "Hide adult images while browsing the public gallery." },
    { s: "\uD83C\uDF10", n: "Auto-translate", d: "Translate chat messages and prompts into your language." },
    { s: "\uD83C\uDFB2", n: "Seed panel", d: "See, copy and lock the seed behind an image." },
    { s: "\uD83D\uDCBE", n: "Backup / Restore", d: "Save your whole gallery to a file, and load it back later." },
    { s: "\u2318", n: "Command palette", d: "Jump to any tool or page by typing (Ctrl+K)." },
    { s: "\uD83C\uDFE0", n: "Home page layouts", d: "Choose which of the six home page designs you want." },
    { s: "\uD83C\uDF0C", n: "Screen saver", d: "A slow slideshow that starts when the page sits idle." },
    { s: "\uD83D\uDCDD", n: "Scratchpad", d: "A quick notepad for your ideas while you generate." },
    { s: "\u26A1", n: "Control Panel & Quick Actions", d: "The shortcut buttons above the prompt box." },
    { s: "\uD83C\uDFE5", n: "Premade characters", d: "Ready-made characters you can pick instead of writing your own." },
    { s: "\uD83D\uDCE3", n: "Announcements & What's New", d: "The site's own messages: update notes, the 'What's New' card and the occasional question popup." },
    { s: "\uD83D\uDD25", n: "Popularity sort (24h / 7d / 30d)", d: "Rank the gallery by what is popular right now, over a day, a week or a month." },
    { s: "\uD83C\uDFA8", n: "Prompt text style (font & colour)", d: "Change the writing area's font, size, bold, text colour and background colour." },
    { s: "\uD83E\uDDF1", n: "Display modes (walls, justified, masonry)", d: "How the gallery tiles are packed: columns, wall puzzles, justified rows and more." },
    { s: "\uD83D\uDC3E", n: "Companion / pet", d: "A little animated companion that lives on the page and reacts while you create." },
    { s: "\uD83D\uDEE0", n: "Studio", d: "Same character, many poses, one fixed seed \u2014 the Studio's \uD83D\uDCD5 Lookbook." }
  ];
  var NEXT = [];
  // Egon 18.10.2026 — the survey asks about the MAIN features only (20 rows), and the
  // "which feature next" question is retired. ix pins each row to its ORIGINAL server
  // index: tallies and saved votes are index-keyed, so old numbers keep their meaning.
  var SURVEY_KEPT = [0, 1, 3, 4, 6, 7, 8, 11, 12, 16, 17, 20, 22, 23, 24, 25, 30, 33, 35, 37];
  ITEMS = ITEMS.filter(function (it, i) { return SURVEY_KEPT.indexOf(i) !== -1; });
  ITEMS.forEach(function (it, i) { it.ix = SURVEY_KEPT[i]; });
  ITEMS.push({ s: "\uD83D\uDC8C", n: "Private Messages", d: "Write anyone privately from the \uD83D\uDC8C button or the people list \u2014 only the two of you can read it.", ix: 39 });
  function ixOf(i) { var it = ITEMS[i]; return (it && typeof it.ix === "number") ? it.ix : i; }
  // 🧪 Egon 23.09.2026 (W-DATA191) — the survey's two option lists are exposed so the check-up can prove the
  // survey still covers the systems the generator has (rule I117) and that nothing was silently dropped:
  // the check cross-references every option with the live control list / the legends, and ratchets on the
  // number of items so a feature can never vanish from the survey unnoticed.
  try { window.dragonSurveyItems = ITEMS; window.dragonSurveyNext = NEXT; } catch (e) {}

  var L = {
    en: { title: "Visitor Survey", intro: "Help us decide what to build next. It takes about a minute - and you can see what everyone else voted.", q1: "Which feature should come next?", q2: "How much do you like each of these?", res: "Live results", done: "Surveys completed", complete: "Complete survey & show results", close: "Close", thanks: "Thanks for taking part!", rate: "Did you like this generator? Please rate us!", none: "No votes yet", invite: "Got a minute? Take our survey and shape what comes next.", inviteOk: "Take the survey", inviteNo: "Not now", sort: "most liked first", sortD: "most disliked first" },
    tr: { title: "Ziyaretci Anketi", intro: "Sirada neyi yapacagimiza karar vermemize yardim et. Yaklasik bir dakika surer - ve herkesin neye oy verdigini gorebilirsin.", q1: "Sirada hangi ozellik gelmeli?", q2: "Bunlarin her birini ne kadar seviyorsun?", res: "Canli sonuclar", done: "Tamamlanan anket", complete: "Anketi tamamla ve sonuclari goster", close: "Kapat", thanks: "Katildigin icin tesekkurler!", rate: "Bu generatoru begendin mi? Lutfen bizi puanla!", none: "Henuz oy yok", invite: "Bir dakikan var mi? Anketimize katil, sirada neyin olacagini sen belirle.", inviteOk: "Ankete katil", inviteNo: "Simdi degil", sort: "en cok begenilen en ustte", sortD: "en cok begenilmeyen en ustte" },
    de: { title: "Besucherumfrage", intro: "Hilf uns zu entscheiden, was als Nachstes kommt. Es dauert etwa eine Minute - und du siehst, wie alle anderen abgestimmt haben.", q1: "Welche Funktion soll als Nachstes kommen?", q2: "Wie gut gefallt dir das jeweils?", res: "Live-Ergebnisse", done: "Abgeschlossene Umfragen", complete: "Umfrage abschliessen & Ergebnisse zeigen", close: "Schliessen", thanks: "Danke fur deine Teilnahme!", rate: "Hat dir dieser Generator gefallen? Bitte bewerte uns!", none: "Noch keine Stimmen", invite: "Hast du eine Minute? Mach bei unserer Umfrage mit und bestimme, was als Nachstes kommt.", inviteOk: "An der Umfrage teilnehmen", inviteNo: "Jetzt nicht", sort: "beliebteste zuerst", sortD: "unbeliebteste zuerst" },
    fr: { title: "Sondage des visiteurs", intro: "Aide-nous a decider de la suite. Cela prend environ une minute - et tu verras ce que les autres ont vote.", q1: "Quelle fonctionnalite devrait arriver ensuite ?", q2: "A quel point aimes-tu chacun de ces elements ?", res: "Resultats en direct", done: "Sondages termines", complete: "Terminer le sondage et voir les resultats", close: "Fermer", thanks: "Merci d'avoir participe !", rate: "Ce generateur t'a plu ? Note-nous !", none: "Aucun vote pour l'instant", invite: "Une minute ? Reponds a notre sondage et decide de la suite.", inviteOk: "Repondre au sondage", inviteNo: "Pas maintenant", sort: "les plus aimes en premier", sortD: "les moins aimes en premier" },
    es: { title: "Encuesta de visitantes", intro: "Ayudanos a decidir que viene despues. Tarda un minuto - y puedes ver que voto todo el mundo.", q1: "Que funcion deberia llegar despues?", q2: "Cuanto te gusta cada una de estas?", res: "Resultados en vivo", done: "Encuestas completadas", complete: "Completar la encuesta y ver resultados", close: "Cerrar", thanks: "Gracias por participar!", rate: "Te ha gustado este generador? Puntuanos!", none: "Aun no hay votos", invite: "Tienes un minuto? Participa en nuestra encuesta y decide que viene.", inviteOk: "Participar en la encuesta", inviteNo: "Ahora no", sort: "los mas gustados primero", sortD: "los menos gustados primero" },
    it: { title: "Sondaggio visitatori", intro: "Aiutaci a decidere cosa fare dopo. Ci vuole circa un minuto - e puoi vedere cosa hanno votato gli altri.", q1: "Quale funzione dovrebbe arrivare dopo?", q2: "Quanto ti piace ciascuna di queste?", res: "Risultati in diretta", done: "Sondaggi completati", complete: "Completa il sondaggio e mostra i risultati", close: "Chiudi", thanks: "Grazie per aver partecipato!", rate: "Ti e piaciuto questo generatore? Valutaci!", none: "Nessun voto per ora", invite: "Hai un minuto? Partecipa al nostro sondaggio e decidi cosa arriva dopo.", inviteOk: "Partecipa al sondaggio", inviteNo: "Non ora", sort: "i piu apprezzati per primi", sortD: "i meno apprezzati per primi" },
    ru: { title: "Опрос посетителей", intro: "Помоги решить, что делать дальше. Это займёт около минуты - и ты увидишь, за что проголосовали другие.", q1: "Какая функция должна появиться следующей?", q2: "Насколько тебе нравится каждая из них?", res: "Живые результаты", done: "Завершено опросов", complete: "Завершить опрос и показать результаты", close: "Закрыть", thanks: "Спасибо за участие!", rate: "Понравился генератор? Оцени нас!", none: "Пока нет голосов", invite: "Есть минута? Пройди наш опрос и определи, что будет дальше.", inviteOk: "Пройти опрос", inviteNo: "Не сейчас", sort: "сначала самые любимые", sortD: "сначала самые нелюбимые" },
    pt: { title: "Questionario dos visitantes", intro: "Ajuda-nos a decidir o que vem a seguir. Leva cerca de um minuto - e podes ver o que os outros votaram.", q1: "Que funcionalidade deve vir a seguir?", q2: "Quanto gostas de cada uma destas?", res: "Resultados ao vivo", done: "Questionarios concluidos", complete: "Concluir o questionario e mostrar resultados", close: "Fechar", thanks: "Obrigado por participar!", rate: "Gostaste deste gerador? Avalia-nos!", none: "Ainda sem votos", invite: "Tens um minuto? Responde ao nosso questionario e decide o que vem a seguir.", inviteOk: "Responder ao questionario", inviteNo: "Agora nao", sort: "os mais gostados primeiro", sortD: "os menos gostados primeiro" },
    ar: { title: "استبيان الزوار", intro: "ساعدنا في تحديد ما سنبنيه بعد ذلك. يستغرق دقيقة تقريبًا - ويمكنك رؤية تصويت الآخرين.", q1: "ما الميزة التي يجب أن تأتي بعد ذلك؟", q2: "إلى أي مدى تعجبك كل من هذه؟", res: "نتائج مباشرة", done: "الاستبيانات المكتملة", complete: "إكمال الاستبيان وعرض النتائج", close: "إغلاق", thanks: "شكرًا لمشاركتك!", rate: "هل أعجبك هذا المولّد؟ قيّمنا من فضلك!", none: "لا توجد أصوات بعد", invite: "هل لديك دقيقة؟ شارك في استبياننا وحدد ما سيأتي بعد ذلك.", inviteOk: "شارك في الاستبيان", inviteNo: "ليس الآن", sort: "الأكтر إعجابًا أولًا", sortD: "الأقل إعجابًا أولًا" },
    nl: { title: "Bezoekersenquete", intro: "Help ons te bepalen wat er hierna komt. Het duurt ongeveer een minuut - en je ziet waar anderen op stemden.", q1: "Welke functie moet er hierna komen?", q2: "Hoe leuk vind je elk van deze?", res: "Live resultaten", done: "Voltooide enquetes", complete: "Enquete afronden en resultaten tonen", close: "Sluiten", thanks: "Bedankt voor je deelname!", rate: "Vond je deze generator leuk? Beoordeel ons!", none: "Nog geen stemmen", invite: "Heb je een minuut? Doe mee aan onze enquete en bepaal wat er hierna komt.", inviteOk: "Doe mee aan de enquete", inviteNo: "Niet nu", sort: "meest gewaardeerd eerst", sortD: "minst gewaardeerd eerst" },
    pl: { title: "Ankieta odwiedzajacych", intro: "Pomoz nam zdecydowac, co zrobic dalej. To zajmuje okoo minuty - i mozesz zobaczyc, na co glosowali inni.", q1: "Ktora funkcja powinna pojawic sie nastepna?", q2: "Jak bardzo lubisz kazda z tych?", res: "Wyniki na zywo", done: "Ukonczone ankiety", complete: "Zakoncz ankiete i pokaz wyniki", close: "Zamknij", thanks: "Dziekujemy za udzial!", rate: "Podobal ci sie ten generator? Ocen nas!", none: "Brak glosow", invite: "Masz minute? Wez udzial w naszej ankiecie i zdecyduj, co bedzie dalej.", inviteOk: "Wez udzial w ankiecie", inviteNo: "Nie teraz", sort: "najbardziej lubiane najpierw", sortD: "najmniej lubiane najpierw" },
    ja: { title: "訪問者アンケート", intro: "次に何を作るか、あなたの意見を聞かせてください。約1分で終わります - みんなの投票結果も見られます。", q1: "次に実装すべき機能はどれですか？", q2: "これらはそれぞれどのくらい好きですか？", res: "ライブ結果", done: "完了したアンケート", complete: "アンケートを完了して結果を見る", close: "閉じる", thanks: "ご協力ありがとうございました！", rate: "このジェネレーターは気に入りましたか？評価をお願いします！", none: "まだ投票がありません", invite: "1分だけいいですか？アンケートに答えて、次に作るものを決めましょう。", inviteOk: "アンケートに答える", inviteNo: "今はしない", sort: "いいねが多い順", sortD: "嫌われている順" },
    zh: { title: "访客问卷", intro: "帮助我们决定接下来做什么。大约只需一分钟 - 你还能看到大家都投了什么。", q1: "接下来应该推出哪个功能？", q2: "你喜欢这些中的每一个吗？", res: "实时结果", done: "已完成的问卷", complete: "完成问卷并查看结果", close: "关闭", thanks: "感谢参与！", rate: "你喜欢这个生成器吗？请给我们评分！", none: "暂无投票", invite: "有一分钟吗？参加我们的问卷，决定接下来做什么。", inviteOk: "参加问卷", inviteNo: "暂时不要", sort: "点赞最多排在最前", sortD: "最不受欢迎排在最前" },
    ko: { title: "방문자 설문", intro: "다음에 무엇을 만들지 결정할 수 있게 도와주세요. 약 1분이면 끝나고, 다른 사람들의 투표도 볼 수 있습니다.", q1: "다음에 어떤 기능이 나와야 할까요?", q2: "이것들을 각각 얼마나 좋아하시나요?", res: "실시간 결과", done: "완료된 설문", complete: "설문 완료하고 결과 보기", close: "닫기", thanks: "참여해 주셔서 감사합니다!", rate: "이 생성기가 마음에 드셨나요? 평가해 주세요!", none: "아직 투표가 없습니다", invite: "잠깐 시간 되시나요? 설문에 참여해 다음 기능을 정해 주세요.", inviteOk: "설문 참여하기", inviteNo: "나중에", sort: "가장 좋아하는 것부터", sortD: "가장 싫어하는 것부터" }
  };
  // The optional free-text suggestion box at the end of the survey. Its text is posted to the public
  // "suggestion" chat channel, so it is a normal, openly readable community suggestion - nothing private.
  var SUG = {
    en: { label: "Your suggestion (optional)", ph: "Write an idea or an improvement you would like to see...", send: "Send suggestion", ok: "\u2705 suggestion sent - thank you!", fail: "\u26A0\uFE0F could not send, please try again" },
    tr: { label: "Senin \u00F6nerin (iste\u011Fe ba\u011Fl\u0131)", ph: "G\u00F6rmek istedi\u011Fin bir fikir ya da iyile\u015Ftirmeyi yaz...", send: "\u00D6neriyi g\u00F6nder", ok: "\u2705 \u00F6neri g\u00F6nderildi - te\u015Fekk\u00FCrler!", fail: "\u26A0\uFE0F g\u00F6nderilemedi, tekrar dene" },
    de: { label: "Dein Vorschlag (optional)", ph: "Schreibe eine Idee oder eine Verbesserung, die du sehen m\u00F6chtest...", send: "Vorschlag senden", ok: "\u2705 Vorschlag gesendet - danke!", fail: "\u26A0\uFE0F konnte nicht senden, bitte erneut versuchen" },
    fr: { label: "Ta suggestion (facultatif)", ph: "\u00C9cris une id\u00E9e ou une am\u00E9lioration que tu aimerais voir...", send: "Envoyer la suggestion", ok: "\u2705 suggestion envoy\u00E9e - merci !", fail: "\u26A0\uFE0F envoi impossible, r\u00E9essaie" },
    es: { label: "Tu sugerencia (opcional)", ph: "Escribe una idea o una mejora que te gustar\u00EDa ver...", send: "Enviar sugerencia", ok: "\u2705 sugerencia enviada - \u00A1gracias!", fail: "\u26A0\uFE0F no se pudo enviar, int\u00E9ntalo de nuevo" },
    it: { label: "Il tuo suggerimento (facoltativo)", ph: "Scrivi un'idea o un miglioramento che vorresti vedere...", send: "Invia suggerimento", ok: "\u2705 suggerimento inviato - grazie!", fail: "\u26A0\uFE0F invio non riuscito, riprova" },
    ru: { label: "\u0422\u0432\u043E\u0451 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435 (\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E)", ph: "\u041D\u0430\u043F\u0438\u0448\u0438 \u0438\u0434\u0435\u044E \u0438\u043B\u0438 \u0443\u043B\u0443\u0447\u0448\u0435\u043D\u0438\u0435, \u043A\u043E\u0442\u043E\u0440\u043E\u0435 \u0445\u043E\u0442\u0435\u043B \u0431\u044B \u0432\u0438\u0434\u0435\u0442\u044C...", send: "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435", ok: "\u2705 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043E - \u0441\u043F\u0430\u0441\u0438\u0431\u043E!", fail: "\u26A0\uFE0F \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C, \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0435\u0449\u0451 \u0440\u0430\u0437" },
    pt: { label: "A tua sugest\u00E3o (opcional)", ph: "Escreve uma ideia ou uma melhoria que gostarias de ver...", send: "Enviar sugest\u00E3o", ok: "\u2705 sugest\u00E3o enviada - obrigado!", fail: "\u26A0\uFE0F n\u00E3o foi poss\u00EDvel enviar, tenta de novo" },
    ar: { label: "\u0627\u0642\u062A\u0631\u0627\u062D\u0643 (\u0627\u062E\u062A\u064A\u0627\u0631\u064A)", ph: "\u0627\u0643\u062A\u0628 \u0641\u0643\u0631\u0629 \u0623\u0648 \u062A\u062D\u0633\u064A\u0646\u064B\u0627 \u062A\u0648\u062F \u0631\u0624\u064A\u062A\u0647...", send: "\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0627\u0642\u062A\u0631\u0627\u062D", ok: "\u2705 \u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0627\u0642\u062A\u0631\u0627\u062D - \u0634\u0643\u0631\u064B\u0627 \u0644\u0643!", fail: "\u26A0\uFE0F \u062A\u0639\u0630\u0651\u0631 \u0627\u0644\u0625\u0631\u0633\u0627\u0644\u060C \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649" },
    nl: { label: "Jouw suggestie (optioneel)", ph: "Schrijf een idee of verbetering die je graag zou zien...", send: "Suggestie versturen", ok: "\u2705 suggestie verstuurd - bedankt!", fail: "\u26A0\uFE0F kon niet versturen, probeer opnieuw" },
    pl: { label: "Twoja sugestia (opcjonalnie)", ph: "Napisz pomys\u0142 lub ulepszenie, kt\u00F3re chcia\u0142by\u015B zobaczy\u0107...", send: "Wy\u015Blij sugesti\u0119", ok: "\u2705 sugestia wys\u0142ana - dzi\u0119kujemy!", fail: "\u26A0\uFE0F nie uda\u0142o si\u0119 wys\u0142a\u0107, spr\u00F3buj ponownie" },
    ja: { label: "\u3042\u306A\u305F\u306E\u63D0\u6848\uFF08\u4EFB\u610F\uFF09", ph: "\u898B\u3066\u307F\u305F\u3044\u30A2\u30A4\u30C7\u30A2\u3084\u6539\u5584\u70B9\u3092\u66F8\u3044\u3066\u304F\u3060\u3055\u3044...", send: "\u63D0\u6848\u3092\u9001\u4FE1", ok: "\u2705 \u63D0\u6848\u3092\u9001\u4FE1\u3057\u307E\u3057\u305F - \u3042\u308A\u304C\u3068\u3046\uFF01", fail: "\u26A0\uFE0F \u9001\u4FE1\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u3082\u3046\u4E00\u5EA6\u304A\u8A66\u3057\u304F\u3060\u3055\u3044" },
    zh: { label: "\u4F60\u7684\u5EFA\u8BAE\uFF08\u53EF\u9009\uFF09", ph: "\u5199\u4E0B\u4F60\u5E0C\u671B\u770B\u5230\u7684\u60F3\u6CD5\u6216\u6539\u8FDB...", send: "\u53D1\u9001\u5EFA\u8BAE", ok: "\u2705 \u5EFA\u8BAE\u5DF2\u53D1\u9001 - \u8C22\u8C22\uFF01", fail: "\u26A0\uFE0F \u53D1\u9001\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5" },
    ko: { label: "\uB2F9\uC2E0\uC758 \uC81C\uC548 (\uC120\uD0DD)", ph: "\uBCF4\uACE0 \uC2F6\uC740 \uC544\uC774\uB514\uC5B4\uB098 \uAC1C\uC120\uC810\uC744 \uC801\uC5B4 \uC8FC\uC138\uC694...", send: "\uC81C\uC548 \uBCF4\uB0B4\uAE30", ok: "\u2705 \uC81C\uC548\uC744 \uBCF4\uB0C8\uC5B4\uC694 - \uAC10\uC0AC\uD569\uB2C8\uB2E4!", fail: "\u26A0\uFE0F \uBCF4\uB0B4\uC9C0 \uBABB\uD588\uC5B4\uC694, \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694" }
  };
  // Egon 22.09.2026 (mail [374] p.6): the survey used to stay silently ENGLISH after the size diet,
  // because its language detector lived in another IIFE and was never a window global. It now has its
  // own detector: the page's detector when it is exposed, otherwise the browser language mapped onto
  // the 14 languages the generator speaks. Extra strings (busy/bad/already + the summary labels) fall
  // back to English when a language has no translation.
  var LANGS = ["en", "tr", "de", "fr", "es", "it", "ru", "pt", "ar", "nl", "pl", "ja", "zh", "ko"];
  var EXTRA = {
    en: { busy: "Too many votes from your network right now - please try again in a little while.", bad: "Could not send your survey - please try again.", already: "You have already taken this survey - here are the live results.", sortD: "most disliked first", sumUp: "Likes", sumDown: "Dislikes", sumPos: "Positive", sumVotes: "total votes", sumDone: "completed" },
    tr: { busy: "Su anda aginizdan cok fazla oy geldi - lutfen biraz sonra tekrar deneyin.", bad: "Anketiniz gonderilemedi - lutfen tekrar deneyin.", already: "Bu anketi zaten doldurdunuz - iste canli sonuclar.", sumUp: "Begeni", sumDown: "Begenmeme", sumPos: "Olumlu", sumVotes: "toplam oy", sumDone: "tamamlanan" }
  };
  ;function langCode() {
    var l = "en";
    try { if (typeof window.detectUserLang === "function") l = String(window.detectUserLang() || "en"); } catch (e) {}
    if (LANGS.indexOf(l) === -1) {
      try { var n = String((navigator.languages && navigator.languages[0]) || navigator.language || "en").toLowerCase().slice(0, 2); l = (LANGS.indexOf(n) !== -1) ? n : "en"; } catch (e) { l = "en"; }
    }
    return (LANGS.indexOf(l) !== -1) ? l : "en";
  }
  ;function TS() { return SUG[langCode()] || SUG.en; }
  ;function T() { return L[langCode()] || L.en; }
  ;function TD(k) { try { var t = T(); if (t && t[k]) return t[k]; } catch (e) {} var e2 = EXTRA[langCode()] || EXTRA.en; return (e2 && e2[k]) || EXTRA.en[k] || k; }
  ;function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  ;function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  ;function votesRead() { try { var o = JSON.parse(lsGet(LS_VOTES, "{}")); return (o && typeof o === "object") ? o : {}; } catch (e) { return {}; } }
  ;function nextRead() { var n = parseInt(lsGet(LS_NEXT, "-1"), 10); return (n >= 0 && n < NEXT.length) ? n : -1; }
  ;function socketNow() { try { return (window.__dragonStatsSockets && window.__dragonStatsSockets().socket) || null; } catch (e) { return null; } }
  ;function el(tag, cls, txt) { var d = document.createElement(tag); if (cls) d.className = cls; if (txt != null) d.textContent = txt; return d; }
  var RATE_EMOJI = ["\uD83D\uDE20", "\uD83D\uDE41", "\uD83D\uDE10", "\uD83D\uDE0A", "\uD83E\uDD29"];

  // 📊 THE ONE RANKING (Egon 23.09.2026, W-DATA223 — FINAL; supersedes W-DATA204 and its W-DATA220
  // revision). Ordering by the raw like-RATIO split the table into a wall of tiny-sample "100%" rows above
  // the systems people had actually rated; the Wilson lower bound did NOT fix that either, because a row
  // with a handful of clean votes still outscored a busier row that had one dislike. Egon's final word: the
  // list is ordered by the TOTAL 👍 COUNT (highest first). The middle percentage is only that row's
  // like/dislike ratio; rows with an equal 👍 count fall back to the better ratio and then to the
  // survey's own order, so a system nobody has voted on (0 👍) stays at the bottom.

  var open = null; // { ov, mode, poll }

  ;function closePanel() {
    if (!open) return;
    if (open.poll) { clearInterval(open.poll); open.poll = 0; }
    if (open.onKey) { try { document.removeEventListener("keydown", open.onKey, true); } catch (e) {} }
    try { open.ov.remove(); } catch (e) {}
    open = null;
  }

  // ---- the RATE twin that sits at the bottom of the survey card (same look as Settings -> About) ----
  ;function ratePanel() {
    var t = T();
    var wrap = el("div", "dg-survey-rate");
    var cellWrap = el("div", "dg-survey-ratecells");
    var counts = [null, null, null, null, null];
    for (var i = 0; i < 5; i++) (function (i) {
      var cell = el("div", "dg-survey-ratecell");
      var b = el("button", "dg-vote", RATE_EMOJI[i]);
      b.type = "button";
      b.title = "Rate " + (i + 1) + " / 5";
      b.addEventListener("click", function () {
        if (window.dragonRateVote) window.dragonRateVote(i + 1);
        if (window.dragonToast) dragonToast("\u2764\uFE0F thanks for rating " + (i + 1) + "/5!");
        setTimeout(refreshRate, 400);
      });
      counts[i] = el("div", "dg-survey-ratecount", "0");
      cell.append(b, counts[i]);
      cellWrap.appendChild(cell);
    })(i);
    var note = el("div", "dg-survey-thanks", lsGet("dragonRated", "") === "1" ? t.thanks : "");
    wrap.append(el("div", "dg-caption", t.rate), cellWrap, note);
    ;function refreshRate() {
      var sk = socketNow();
      if (!sk) return;
      try {
        sk.rpc.getStats("").then(function (s) {
          try {
            var r = JSON.parse(s).ratings || [];
            for (var k = 0; k < 5; k++) counts[k].textContent = String(r[k] || 0);
          } catch (e) {}
        }).catch(function () {});
      } catch (e) {}
    }
    refreshRate();
    return wrap;
  }

  // ---- survey view -------------------------------------------------------------------------------
  ;function buildSurvey(card) {
    var t = T();
    card.innerHTML = "";
    card.appendChild(el("div", "dg-title", "\uD83D\uDCCB " + t.title));
    card.appendChild(el("div", "dg-text", t.intro));

    var body = el("div", "dg-survey-body");
    
    body.appendChild(el("div", "dg-caption", t.q2));

    var votes = votesRead();
    var list = el("div", "dg-surveylist");
    ITEMS.forEach(function (it, i) {
      var k = (typeof it.ix === "number") ? it.ix : i;
      var row = el("div", "dg-survey-row");
      row.appendChild(el("span", "dg-survey-sym", it.s));
      row.title = it.d;
      var nmRow = el("span", "dg-survey-name", it.n);
      nmRow.title = it.d;
      row.appendChild(nmRow);
      var up = el("button", "dg-vote is-up", "\uD83D\uDC4D");
      var dn = el("button", "dg-vote is-down", "\uD83D\uDC4E");
      up.type = dn.type = "button";
      up.title = "Like"; dn.title = "Dislike";
      if (votes[k] === 1) up.classList.add("is-on");
      if (votes[k] === -1) dn.classList.add("is-on");
      ;function pick(v) {
        var cur = votesRead();
        if (cur[k] === v) delete cur[k]; else cur[k] = v;
        lsSet(LS_VOTES, JSON.stringify(cur));
        votes = cur;
        up.classList.toggle("is-on", cur[k] === 1);
        dn.classList.toggle("is-on", cur[k] === -1);
      }
      up.addEventListener("click", function () { pick(1); });
      dn.addEventListener("click", function () { pick(-1); });
      row.append(up, dn);
      list.appendChild(row);
    });
    body.appendChild(list);
    // Optional free-text suggestion, posted to the public "suggestion" chat channel by our helper.
    (function () {
      var s = TS();
      var wrap = el("div", "dg-survey-sug");
      wrap.appendChild(el("div", "dg-caption", s.label));
      var ta = document.createElement("textarea");
      ta.className = "dg-input dg-survey-sugbox";
      ta.rows = 2;
      ta.placeholder = s.ph;
      ta.spellcheck = false;
      var send = el("button", "dg-btn", s.send);
      send.type = "button";
      var status = el("div", "dg-survey-sugstatus", "");
      send.addEventListener("click", function () {
        var v = String(ta.value || "").trim();
        if (!v) { status.style.color = "#ffb4a8"; status.textContent = s.ph; return; }
        send.disabled = true;
        var label = send.textContent;
        send.textContent = "...";
        status.style.color = "";
        status.textContent = "";
        window.dragonSuggestSubmit(v, function (ok) {
          send.disabled = false;
          send.textContent = label;
          if (ok) { status.style.color = "#8aff9e"; status.textContent = s.ok; ta.value = ""; }
          else { status.style.color = "#ffb4a8"; status.textContent = s.fail; }
        });
      });
      var row = el("div", "dg-survey-sugrow");
      row.append(send);
      wrap.append(ta, row, status);
      body.appendChild(wrap);
    })();
    card.appendChild(body);

    var act = el("div", "dg-actions");
    var doneBtn = el("button", "dg-btn is-primary", t.complete);
    doneBtn.type = "button";
    doneBtn.addEventListener("click", function () {
      doneBtn.disabled = true;
      doneBtn.textContent = "...";
      submit(function (r) {
        if (r && r.ok === false && r.why !== "already") {
          doneBtn.disabled = false;
          doneBtn.textContent = t.complete;
          if (window.dragonToast) dragonToast(r.why === "busy" ? TD("busy") : TD("bad"));
          return;
        }
        buildResults(card, (r && r.why === "already") ? TD("already") : "");
      });
    });
    act.appendChild(doneBtn);
    card.appendChild(act);
    card.appendChild(ratePanel());
    var closeAct = el("div", "dg-actions");
    var cBtn = el("button", "dg-btn", t.close);
    cBtn.type = "button";
    cBtn.addEventListener("click", closePanel);
    closeAct.appendChild(cBtn);
    card.appendChild(closeAct);
  }

  // The visitor's stable identity — the SAME uid the comments panel and the ⭐ likes use (Egon 22.09.2026,
  // mail [374]/[377]: the survey is now PER VISITOR, not per network, so it must send this id).
  ;function uid() {
    try { if (window.dragonCommentUid) return String(window.dragonCommentUid()); } catch (e) {}
    try { var v = localStorage.dragonCommentUid; if (v) return String(v); } catch (e) {}
    return "";
  }
  // Submits the votes. cb({ok, why, data}); the caller only shows "done" when the server really accepted
  // (ok:1) or reports "already" — a silent drop ("busy") keeps the form so the visitor can retry.
  ;function submit(cb) {
    var votes = votesRead();
    var v = [];
    for (var k in votes) { if (votes[k] === 1 || votes[k] === -1) v.push([parseInt(k, 10), votes[k]]); }
    // 🔁 A visitor who has already completed the survey is RE-VOTING (W-UI309): the flag tells the server to
    // accept it (subject to the 15-minute cooldown) instead of answering "already". A first-time submission
    // is unchanged. This is what makes the survey popup's shortcut able to send people back to vote again.
    var revote = lsGet(LS_DONE, "") === "1";
    var payload = JSON.stringify({ q: nextRead(), v: v, u: uid(), r: revote ? 1 : 0 });
    var sk = socketNow();
    function finish(ok, why, data) {
      if (ok || why === "already") {
        lsSet(LS_DONE, "1");
        try { if (window.dragonPopupSealForSurvey) window.dragonPopupSealForSurvey(); } catch (e) {}
      }
      try { cb({ ok: !!ok, why: why || "ok", data: data || null }); } catch (e) {}
    }
    if (!sk) { setTimeout(function () { finish(true, "ok", null); }, 0); return; }
    try {
      sk.rpc.dragonSurveySubmit(payload).then(function (s) {
        var r = null; try { r = JSON.parse(s); } catch (e) {}
        if (r && typeof r.ok !== "undefined") finish(!!r.ok, String(r.why || ""), r);
        else finish(true, "ok", null);
      }).catch(function () { finish(true, "ok", null); });
    } catch (e) { setTimeout(function () { finish(true, "ok", null); }, 0); }
  }

  // ---- results view (SAME card size; live totals pulled back from the server) ---------------------
  ;function buildResults(card, note) {
    var t = T();
    card.innerHTML = "";
    card.appendChild(el("div", "dg-title", "\uD83D\uDCCB " + t.res));
    if (note) card.appendChild(el("div", "dg-survey-note", note));
    var meta = el("div", "dg-text", t.done + ": 0");
    card.appendChild(meta);
    // 📊 Egon 22.09.2026 (mail [374] p.3): the results view is now a REAL report — a summary strip
    // (likes / dislikes / positive % / total votes) above the bars, and every row carries a percentage.
    var sum = el("div", "dg-survey-summary");
    function mkKpi(label) { var c = el("div", "dg-kpi"); var n = el("span", "dg-kpi-n", "\u2014"); var l = el("span", "dg-kpi-l", label); c.append(n, l); sum.appendChild(c); return n; }
    var kpiUp = mkKpi(TD("sumUp")), kpiDn = mkKpi(TD("sumDown")), kpiPos = mkKpi(TD("sumPos")), kpiTot = mkKpi(TD("sumVotes"));
    card.appendChild(sum);
    var body = el("div", "dg-survey-body");
    var rows = [];
    ;function mkRow(sym, name, desc, parent) {
      var row = el("div", "dg-survey-row is-res");
      row.title = desc;
      row.appendChild(el("span", "dg-survey-sym", sym));
      var nm = el("span", "dg-survey-name", name);
      nm.title = desc;
      row.appendChild(nm);
      var metrics = el("span", "dg-survey-metrics");
      var num = el("span", "dg-survey-num", "\u2014");
      metrics.appendChild(num);
      row.appendChild(metrics);
      (parent || body).appendChild(row);
      return { row: row, num: num };
    }
    
    // 📊 Egon 23.09.2026 (Paket C) asked for the results best-liked-first; W-DATA204 shipped that as a raw
    // like-ratio sort, which turned out to split the table in two (see the ranking note above): a wall of
    // one-vote "100%" rows, then the systems with a real following — Egon reported that lower block
    // looking like a separate ranking and asked for one main list. The rating rows therefore live in
    // their own container and are RE-ORDERED on every paint by the TOTAL \uD83D\uDC4D count, so all 22
    // systems sit in ONE ranking (a system nobody has voted on scores 0 and stays at the bottom in the
    // survey's own order). The first question's three options keep their own fixed order.
    body.appendChild(el("div", "dg-caption", t.q2));
    // 🏆 Egon 26.09.2026 — the old "· 🏆 most liked first" note lived INSIDE the "How much do you like
    // each of these?" caption and was decorative. It is now a BUTTON that sits exactly over the
    // like/dislike number column (same 36% width, same right alignment, so it lines up with the
    // percentages below it) and pressing it flips the whole ranking between MOST LIKED FIRST and
    // MOST DISLIKED FIRST. The label follows the active direction.
    var sortRow = el("div", "dg-survey-sortrow");
    var sortCol = el("span", "dg-survey-sortcol");
    var sortBtn = el("button", "dg-survey-sort", "");
    sortBtn.type = "button";
    sortCol.appendChild(sortBtn);
    sortRow.append(el("span", "dg-survey-sortspacer", ""), sortCol);
    body.appendChild(sortRow);
    var itemsWrap = el("div", "dg-survey-rows");
    ITEMS.forEach(function (it) { rows.push(mkRow(it.s, it.n, it.d, itemsWrap)); });
    body.appendChild(itemsWrap);
    var sortDir = "up"; // "up" = most liked first · "down" = most disliked first
    ;function sortLabel() {
      var k = (sortDir === "up") ? "sort" : "sortD";
      sortBtn.textContent = "\uD83C\uDFC6 " + TD(k);
      sortBtn.title = TD(k) + " \u2014 " + t.res;
    }
    sortLabel();
    sortBtn.addEventListener("click", function () {
      sortDir = (sortDir === "up") ? "down" : "up";
      sortLabel();
      try { if (open && open.lastData) paint(open.lastData); } catch (e) {}
    });
    card.appendChild(body);
    card.appendChild(ratePanel());
    var closeAct = el("div", "dg-actions");
    var cBtn = el("button", "dg-btn", t.close);
    cBtn.type = "button";
    cBtn.addEventListener("click", closePanel);
    closeAct.appendChild(cBtn);
    card.appendChild(closeAct);

    // 🔒 DAMAGE GATE (W-DATA298): a survey counter above a billion is damaged data, not a vote. The server
    // rejects and repairs the same value (PERM_MAX_VAL), and the client refuses to print an impossible
    // number even if it is talking to a stale build, so the results view can never show a 19-digit total.
    function sane(v) { return (typeof v === "number" && v >= 0 && v <= 1e9) ? v : 0; }
    ;function paint(d) {
      // The last payload is kept so the 🏆 sort button can re-order the SAME data without another round
      // trip to the server (Egon 26.09.2026).
      try { if (open) open.lastData = d; } catch (e) {}
      var i, j = 0, upSum = 0, dnSum = 0;
      var items = d.items || [];
      for (i = 0; i < ITEMS.length; i++) {
        var pr = items[ixOf(i)] || [0, 0];
        upSum += sane(pr[0]); dnSum += sane(pr[1]);
      }
      for (i = 0; i < ITEMS.length; i++) {
        var r = rows[j++];
        var p = items[ixOf(i)] || [0, 0];
        var upN = sane(p[0]), dnN = sane(p[1]), tot = upN + dnN;
        // Three spans, not one string: on a phone the number cell is narrow, and a single nowrap string
        // was clipped after the like count (the dislike count was invisible). Separate spans let it wrap.
        r.num.innerHTML = "<span class=\"dg-n-up\">\uD83D\uDC4D " + upN + "</span>" +
          (tot ? "<span class=\"dg-n-pct\">(" + Math.round((upN / tot) * 100) + "%)</span>" : "") +
          "<span class=\"dg-n-down\">\uD83D\uDC4E " + dnN + "</span>";
      }
      // ONE ranking for every system (Egon 23.09.2026, W-DATA223 FINAL): ordered by the TOTAL \uD83D\uDC4D
      // COUNT, highest first; rows with the same \uD83D\uDC4D count fall back to the better like-ratio and
      // then to the survey's own order. A system nobody has voted on (0 \uD83D\uDC4D) stays at the bottom.
      var ord = [];
      for (i = 0; i < ITEMS.length; i++) {
        var pp = items[ixOf(i)] || [0, 0];
        var uu = sane(pp[0]), dd = sane(pp[1]), tt = uu + dd;
        ord.push({ i: i, up: uu, dn: dd, ratio: tt ? (uu / tt) : 0, tot: tt });
      }
      // 🏆 Egon 26.09.2026 — the ranking follows the sort button: 👍 count (most liked first) or
      // 👎 count (most disliked first). Ties fall back to the better ratio for that direction, then to
      // the busier row, then to the survey's own order, so rows nobody voted on (0) stay at the bottom.
      var downMode = (sortDir === "down");
      ord.sort(function (a, b) {
        var ka = downMode ? a.dn : a.up, kb = downMode ? b.dn : b.up;
        if (kb !== ka) return kb - ka;
        var ra = downMode ? (1 - a.ratio) : a.ratio, rb = downMode ? (1 - b.ratio) : b.ratio;
        if (rb !== ra) return rb - ra;
        if (b.tot !== a.tot) return b.tot - a.tot;
        return a.i - b.i;
      });
      for (i = 0; i < ord.length; i++) itemsWrap.appendChild(rows[ord[i].i].row);
      var allTot = upSum + dnSum;
      kpiUp.textContent = String(upSum);
      kpiDn.textContent = String(dnSum);
      kpiTot.textContent = String(allTot);
      kpiPos.textContent = allTot ? (Math.round((upSum / allTot) * 100) + "%") : "\u2014";
      meta.textContent = String(sane(d.n)) + " " + TD("sumDone") + " \u00B7 " + allTot + " " + TD("sumVotes");
    }
    ;function pull() {
      var sk = socketNow();
      if (!sk) return;
      try { sk.rpc.dragonSurveyGet("").then(function (s) { try { paint(JSON.parse(s)); } catch (e) {} }).catch(function () {}); } catch (e) {}
    }
    pull();
    if (open) { open.poll = setInterval(pull, 10000); open.paint = paint; }
  }

  // ---- panel shell (one window, two views, one size) ----------------------------------------------
  ;function openPanel(fresh) {
    if (open) closePanel();
    try { if (window.dragonUIEnsureCss) dragonUIEnsureCss(); } catch (e) {}
    var ov = el("div", "dg-ov");
    ov.setAttribute("data-local-media-gallery-lightbox", "1");
    var card = el("div", "dg-card dg-survey");
    ov.appendChild(card);
    if (fresh !== "results") ov.addEventListener("mousedown", function (e) { if (e.target === ov) closePanel(); });
    var onKey = function (e) { if (e.key === "Escape") { e.stopPropagation(); closePanel(); } };
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(ov);
    open = { ov: ov, poll: 0, onKey: onKey };
    if (fresh === "results") buildResults(card); else buildSurvey(card);
    return card;
  }
  window.dragonSurveyOpen = function () {
    lsSet(LS_INVITED, "1");
    hideInvite();
    return openPanel();
  };
  // 🔎 Test seam (same idea as dragonStatsDebugSet): opens the RESULTS view directly, without casting a
  // vote. Used by the check-up / by hand to verify the board, the ranking and the 🏆 sort button.
  window.dragonSurveyResultsOpen = function () {
    lsSet(LS_INVITED, "1");
    hideInvite();
    return openPanel("results");
  };
  window.dragonSurveySortPick = function (dir) {
    try {
      var b = document.querySelector(".dg-survey-sort");
      if (!b) return false;
      var want = (dir === "down") ? "down" : "up";
      var isDown = /most disliked|begenilmeyen|unbeliebteste|moins aimes|menos gustados|meno apprez|нелюбимые|menos gostados|الأقل|minst|najmniej|嫌われ|最不受|싫어하는/i.test(String(b.title || ""));
      if ((want === "down") !== isDown) b.click();
      return true;
    } catch (e) { return false; }
  };

  // ---- the once-per-browser invite -----------------------------------------------------------------
  var inviteEl = null;
  ;function hideInvite() {
    if (inviteEl) { try { inviteEl.remove(); } catch (e) {} inviteEl = null; }
  }
  ;function showInvite() {
    if (inviteEl) return;
    try { if (window.dragonUIEnsureCss) dragonUIEnsureCss(); } catch (e) {}
    var t = T();
    inviteEl = el("div", "dg-invite");
    inviteEl.id = "dragonSurveyInvite";
    inviteEl.appendChild(el("span", "dg-invite-txt", "\uD83D\uDCCB " + t.invite));
    var yes = el("button", "dg-btn is-primary", t.inviteOk);
    var no = el("button", "dg-btn", t.inviteNo);
    yes.type = no.type = "button";
    yes.addEventListener("click", function () { lsSet(LS_INVITED, "1"); hideInvite(); openPanel(); });
    no.addEventListener("click", function () { lsSet(LS_ACTIVE, "0"); hideInvite(); });
    inviteEl.append(yes, no);
    document.body.appendChild(inviteEl);
  }
  // Active-time clock: only time with the tab VISIBLE counts, and it is persisted so a reload does not
  // reset it. Once 60 minutes are reached the invite is shown. "Not now" does NOT silence it forever:
  // it zeroes the clock instead, so the bar comes back after 60 MORE minutes of active time. Opening
  // the panel (or completing the survey) sets the shown/done flag and the bar never returns.
  ;function tick() {
    try {
      if (document.visibilityState !== "visible") { try { localStorage.removeItem(LS_TICK); } catch (e) {} return; }
      var now = Date.now();
      var last = parseInt(lsGet(LS_TICK, "0"), 10) || 0;
      if (last) {
        var dt = Math.min(now - last, 3000);
        if (dt > 0) lsSet(LS_ACTIVE, String((parseInt(lsGet(LS_ACTIVE, "0"), 10) || 0) + dt));
      }
      lsSet(LS_TICK, String(now));
      if (lsGet(LS_DONE, "") === "1" || lsGet(LS_INVITED, "") === "1") return;
      if ((parseInt(lsGet(LS_ACTIVE, "0"), 10) || 0) >= ACTIVE_MS_NEEDED) showInvite();
    } catch (e) {}
  }
  window.dragonSurveyTick = tick;
  // Self-test hook for the check-up sweep: opens the window, turns it into the results view WITHOUT
  // submitting anything (no vote is sent, no server counter moves, no localStorage flag is written)
  // and closes it again, reporting what it measured.
  window.dragonSurveySelfTest = function () {
    var card = openPanel();
    var btns = card ? Array.prototype.slice.call(card.querySelectorAll(".dg-actions .dg-btn")) : [];
    var info = {
      opened: !!card,
      items: card ? card.querySelectorAll(".dg-survey-row").length : 0,
      opts: card ? card.querySelectorAll(".dg-survey-opt").length : 0,
      rate: card ? card.querySelectorAll(".dg-survey-ratecell").length : 0,
      complete: btns.some(function (b) { return b.classList.contains("is-primary"); }),
      close: btns.length > 1
    };
    if (card) {
      info.sug = card.querySelectorAll(".dg-survey-sugbox").length;
      info.sugSend = !!card.querySelector(".dg-survey-sugrow .dg-btn");
      info.desc = Array.prototype.slice.call(card.querySelectorAll(".dg-survey-row,.dg-survey-opt")).filter(function (r) { return (r.title || "").length > 3; }).length;
      var r1 = card.getBoundingClientRect();
      buildResults(card);
      var r2 = card.getBoundingClientRect();
      info.morph = !!card.querySelector(".dg-survey-row.is-res");
      info.resSummary = !!card.querySelector(".dg-survey-summary");
      info.sameSize = Math.abs(r1.width - r2.width) < 1 && Math.abs(r1.height - r2.height) < 1;
      info.w = Math.round(r2.width);
      info.h = Math.round(r2.height);
      info.resRows = card.querySelectorAll(".dg-survey-row.is-res").length;
      info.resRate = card.querySelectorAll(".dg-survey-ratecell").length;
      // 🏆 Egon 26.09.2026 — the results view carries ONE sort button over the 👍/👎 number column, it
      // starts as "most liked first", and pressing it flips to "most disliked first" (and back).
      info.sortBtn = !!card.querySelector(".dg-survey-sort");
      try {
        var sb = card.querySelector(".dg-survey-sort");
        if (sb) {
          var lbl1 = sb.textContent;
          sb.click();
          var lbl2 = sb.textContent;
          sb.click();
          info.sortFlips = (lbl1 !== lbl2) && (sb.textContent === lbl1);
          info.sortLabel = lbl1;
        }
      } catch (e) {}
      var kids = Array.prototype.slice.call(card.children);
      info.resOrder = kids.length > 1 && kids[kids.length - 1].classList.contains("dg-actions") && kids[kids.length - 2].classList.contains("dg-survey-rate");
      // W-DATA223: the coloured bars are GONE (Egon: "remove the colored bars, they are confusing") - the
      // results rows now show the plain \uD83D\uDC4D N (P%) \uD83D\uDC4E M figure, so there is no bar to measure.
      info.bars = card.querySelectorAll(".dg-survey-row.is-res .dg-survey-bar").length;
      info.resClose = !!card.querySelector(".dg-actions .dg-btn");
      // 📊 W-DATA223 (Egon 23.09.2026, final): the rating rows must sit in ONE ranking ordered by the
      // TOTAL 👍 COUNT, highest first (ties by better ratio, then survey order). A fabricated tally is
      // painted into this (already torn-down-again) view and the order read back — no vote is sent and
      // no counter moves.
      // Egon 29.10.2026 — the tally is server-index keyed (paint reads items[ixOf(i)]), so the
      // fabricated tally is keyed the same way; a positional array would starve every row past ix 20.
      var fake = [];
      var _I = window.dragonSurveyItems || [];
      for (var fi = 0; fi < info.items; fi++) {
        var _fx = (_I[fi] && typeof _I[fi].ix === "number") ? _I[fi].ix : fi;
        fake[_fx] = [(fi % 5) + 1, 5 - (fi % 5)];
      }
      if (open && open.paint) {
        open.paint({ q1: [3, 2, 1], items: fake, n: 9 });
        var I = window.dragonSurveyItems || [];
        var seq = Array.prototype.slice.call(card.querySelectorAll(".dg-survey-rows .dg-survey-row")).map(function (r) {
          var n = r.querySelector(".dg-survey-name"); return n ? n.textContent : "";
        });
        var ord = [];
        for (var ik = 0; ik < I.length; ik++) { var _k = (I[ik] && typeof I[ik].ix === "number") ? I[ik].ix : ik; var _pr = fake[_k] || [0, 0]; var uu = _pr[0], dd = _pr[1], tt = uu + dd; ord.push({ i: ik, up: uu, ratio: tt ? (uu / tt) : 0, tot: tt }); }
        ord.sort(function (a, b) { if (b.up !== a.up) return b.up - a.up; if (b.ratio !== a.ratio) return b.ratio - a.ratio; if (b.tot !== a.tot) return b.tot - a.tot; return a.i - b.i; });
        var want = ord.map(function (o) { return I[o.i] ? I[o.i].n : ""; });
        info.sortRows = seq.length;
        info.sortOk = seq.length === want.length && want.length > 0 && seq.every(function (nm, k) { return nm === want[k]; });
        info.sortTop = seq[0] || "";
        info.sortBottom = seq[seq.length - 1] || "";
        // the first section's three options must keep their own fixed order
        info.sortQ1Fixed = (function () {
          var all = Array.prototype.slice.call(card.querySelectorAll(".dg-survey-row.is-res"));
          var firstThree = all.slice(0, 3).map(function (r) { var n = r.querySelector(".dg-survey-name"); return n ? n.textContent : ""; });
          var N = window.dragonSurveyNext || [];
          return firstThree.length === N.length && firstThree.every(function (nm, k) { return nm === N[k].n; });
        })();
      }
    }
    closePanel();
    info.closed = !document.querySelector(".dg-card.dg-survey");
    return info;
  };
  // 🔎 READ-ONLY diagnostics (mail [374] p.5 / [376]): never submit, never write — they only ask the
  // server for the ledger report (copies, addresses, seq, merged numbers, ring/log fullness, event log).
  window.dragonSurveyDiag = function () {
    var sk = socketNow();
    if (!sk) return Promise.resolve(null);
    try { return sk.rpc.dragonSurveyDiag("").then(function (s) { try { return JSON.parse(s); } catch (e) { return null; } }).catch(function () { return null; }); }
    catch (e) { return Promise.resolve(null); }
  };
  window.dragonPermDiag = function () {
    var sk = socketNow();
    if (!sk) return Promise.resolve(null);
    try { return sk.rpc.dragonPermDiag("").then(function (s) { try { return JSON.parse(s); } catch (e) { return null; } }).catch(function () { return null; }); }
    catch (e) { return Promise.resolve(null); }
  };
  setInterval(tick, 1000);
  if (document.readyState !== "loading") setTimeout(tick, 1500);
  else document.addEventListener("DOMContentLoaded", function () { setTimeout(tick, 1500); });
})();
