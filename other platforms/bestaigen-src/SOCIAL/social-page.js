(function () {
  var PAGE_ID = "dragonSocialPage";
  // W-SOCIALCUT 10.10.2026 (Egon) — Chat / Story / Games / P.M. parked (see Librarybook.enc DEPO).
  // Only AI Chat stays; the tab strip returns when the parked surfaces are re-integrated.
  var TABS = [
    { id: "ai", label: "AI Chat", icon: "✨", phase: "P5" }
  ];
  var active = "ai";

  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, cls, txt) { var d = document.createElement(tag); if (cls) d.className = cls; if (txt != null) d.textContent = txt; return d; }

  function css() {
    if (document.getElementById("dragonSocialCss")) return;
    var st = document.createElement("style");
    st.id = "dragonSocialCss";
    st.textContent =
      "html[data-dragon-page='social'] #mainColumnEl85394739{display:none !important;}" +
      "html[data-dragon-page='social'] #dragonWowHeroBanner{display:none !important;}" +
      "html[data-dragon-page='social'] #commentsPluginCtn654732{display:none !important;}" +
      "html[data-dragon-page='social'] #dragonAppMount>br{display:none !important;}" +
      "html:not([data-dragon-page='social']) #dragonSocialPage{display:none !important;}" +
      "html[data-dragon-bg] #dragonSocialPage{background-image:var(--dragon-bg-veil,none),var(--dragon-bg-url,none) !important;background-size:cover,cover !important;background-position:center center,center center !important;background-repeat:no-repeat,no-repeat !important;background-attachment:fixed,fixed !important;}" +
      "#dragonSocialPage{display:block;min-height:calc(100vh - var(--dragon-nav-h,42px));min-height:calc(100dvh - var(--dragon-nav-h,42px));padding:1.2rem 1rem 3rem;box-sizing:border-box;}" +
      "html[data-dragon-page='social'] body{scrollbar-gutter:stable;}" +
      "#dragonSocialPage .dragon-social-box{max-width:1200px;margin:0 auto;padding:.9rem .8rem 1.1rem;box-sizing:border-box;background:linear-gradient(#15151d,#0e0e13) !important;border:1px solid rgba(155,107,255,.3) !important;border-radius:14px !important;}" +
      ".dragon-social-title{display:flex;align-items:center;justify-content:center;gap:.35rem;font-size:3rem;font-weight:800;letter-spacing:.01em;color:#d8c9ff;text-align:center;margin:.1rem 0 .35rem;}" +
      ".dragon-social-title-ic{line-height:1.1;display:inline-flex;align-items:center;}" +
      ".dragon-social-title-tx{line-height:1.1;}" +
      ".dragon-social-nav{display:flex;flex-wrap:wrap;gap:0;border:1px solid rgba(155,107,255,.3);border-radius:12px;overflow:hidden;background:linear-gradient(180deg,#1a1a20,#101015);margin-bottom:.625rem;}" +
      ".dragon-social-tab{flex:1 1 auto;display:flex;align-items:center;justify-content:center;gap:.3rem;min-height:2.6rem;padding:.45rem .5rem;border:0;border-left:1px solid rgba(155,107,255,.22);background:transparent;color:#c3cbdd;font-size:.78rem;font-weight:700;cursor:pointer;white-space:nowrap;}" +
      ".dragon-social-tab:first-child{border-left:0;}" +
      ".dragon-social-tab[aria-selected='true']{background:linear-gradient(180deg,#5b34c0,#2a1650);color:#efe7ff;}" +
      ".dragon-social-tab .dragon-social-soon{font-size:.62rem;font-weight:700;border:1px solid var(--dt-chipbd,#4a4a58);border-radius:8px;padding:.05rem .3rem;opacity:.75;}" +
      ".dragon-social-pane{display:none;padding:1.2rem 1rem;}" +
      ".dragon-social-pane.on{display:block;}" +
      ".dragon-social-card{border:1px solid var(--dt-border,#4a4a58);border-radius:12px;background:var(--dt-panel1,#14141a);overflow:hidden;}" +
      ".dragon-social-note{border:1px solid var(--dt-border,#4a4a58);border-radius:10px;padding:1.4rem 1rem;text-align:center;color:var(--dt-fg,#e9e6f2);font-size:.85rem;line-height:1.6;background:var(--dt-panel1,#14141a);}" +
      ".dragon-social-note b{color:var(--dt-accent,#9b6bff);}";
    document.head.appendChild(st);
  }

  function showTab(id) {
    active = id;
    var page = document.getElementById(PAGE_ID);
    if (!page) return;
    var tabs = page.querySelectorAll(".dragon-social-tab");
    for (var i = 0; i < tabs.length; i++) tabs[i].setAttribute("aria-selected", tabs[i].dataset.tab === id ? "true" : "false");
    var panes = page.querySelectorAll(".dragon-social-pane");
    for (var j = 0; j < panes.length; j++) panes[j].classList.toggle("on", panes[j].dataset.pane === id);
  }

  function placeholderPane(id, title, text) {
    var p = el("div", "dragon-social-pane");
    p.dataset.pane = id;
    var n = el("div", "dragon-social-note");
    var b = el("b", "", title);
    n.appendChild(b);
    n.appendChild(el("div", "", text));
    p.appendChild(n);
    return p;
  }

  function build() {
    css();
    var page = document.getElementById(PAGE_ID);
    if (!page) {
      page = el("div", "");
      page.id = PAGE_ID;
      document.body.appendChild(page);
    }
    if (page.dataset.built === "1") { showTab(active); return; }
    page.dataset.built = "1";
    var box = el("div", "dragon-social-box");
    page.appendChild(box);
    var title = el("div", "dragon-social-title", null);
    var titleIc = el("span", "dragon-social-title-ic", null);
    var titleTx = el("span", "dragon-social-title-tx", "Ai Chat");
    titleIc.textContent = "✨"; title.appendChild(titleIc);
    title.appendChild(titleTx);
    box.appendChild(title);
    var nav = null;
    // Single-tab page: no nav strip (it only ever held the redundant ✨ AI Chat button).
    // When the parked surfaces return, TABS grows and the strip comes back by itself.
    if (TABS.length > 1) {
      nav = el("div", "dragon-social-nav");
      box.appendChild(nav);
    }
    var card = el("div", "dragon-social-card");
    box.appendChild(card);
    if (nav) {
    nav.setAttribute("role", "tablist");
    nav.setAttribute("aria-label", "Ai Chat");
    for (var i = 0; i < TABS.length; i++) {
      (function (t) {
        var b = el("button", "dragon-social-tab");
        b.type = "button";
        b.dataset.tab = t.id;
        b.setAttribute("role", "tab");
        b.setAttribute("aria-selected", t.id === active ? "true" : "false");
        if (t.right) b.style.order = "99";
        b.appendChild(el("span", "", t.icon));
        b.appendChild(el("span", "", t.label));
        b.appendChild(el("span", "dragon-social-soon", "soon")); b.title = t.label + " — lands with build " + t.phase;
        b.onclick = function () { showTab(t.id); };
        nav.appendChild(b);
      })(TABS[i]);
    }
    }
    var aiPane = placeholderPane("ai", "✨ AI Chat", "Chat with Dexa and the character bots — lands with the chat build (P5).");
    aiPane.classList.add("on");
    card.appendChild(aiPane);
    showTab("ai");
  }

  window.dragonBuildSocialPage = build;
  window.dragonSocialShowTab = showTab;
})();
