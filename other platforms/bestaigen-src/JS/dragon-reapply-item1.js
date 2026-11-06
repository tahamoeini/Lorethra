
// ===== Incremental re-apply from 1.3.0 — Item 1: UI helpers (toast/modalShell) · Item 3: Scenario chips =====
(function () {
  if (window.__dragonScInstalled) return;
  window.__dragonScInstalled = true;

    ;function modalShell(cls, w, h, title, host) {
      // 📝 Egon 26.09.2026 — INLINE MODE: when `host` (an element) is passed, the same shell is rendered
      // INSIDE that element instead of as a fixed full-screen overlay. This is how the ⚗️ Test Multiple
      // Styles and 🧪 Prompt Tag Lab tools now open inside the 📝 Prompt Panel's dropdown body. With no
      // `host` the behaviour is byte-for-byte the old overlay shell (every other caller is unaffected).
      var inline = !!host;
      var ov = document.createElement("div");
      ov.className = cls + (inline ? " dragon-inline-shell" : "");
      ov.style.cssText = inline
        ? "position:static; width:100%; display:flex; align-items:stretch; justify-content:center; padding:0;"
        : "position:fixed; inset:0; z-index:2147483643; background:rgba(8,8,12,.92); display:flex; align-items:center; justify-content:center; padding:1rem;";
      var box = document.createElement("div");
      box.style.cssText = "width:" + (inline ? "100%" : (w || "min(640px,96vw)")) + "; max-height:" + (inline ? "none" : (h || "86vh")) + "; display:flex; flex-direction:column; gap:.6rem; background:#14141a; border:1px solid #9b6bff; border-radius:14px; padding:" + (inline ? ".7rem .75rem" : "1rem 1.1rem") + "; overflow:hidden;";
      var head = document.createElement("div");
      head.style.cssText = "display:flex; align-items:center; gap:.5rem;";
      var hd = document.createElement("div");
      hd.textContent = title;
      hd.style.cssText = "flex:1; font-weight:bold; font-size:.95rem; color:#eee;";
      var cl = document.createElement("button");
      cl.textContent = "\u2716"; cl.title = "Close";
      cl.style.cssText = "padding:.2rem .6rem; border:1px solid #5a5a6a; background:linear-gradient(145deg,#2a2a33,#17171c); color:#ddd; border-radius:6px; cursor:pointer;";
      head.append(hd, cl);
      box.appendChild(head);
      ov.appendChild(box);
      if (inline) host.appendChild(ov); else document.body.appendChild(ov);
      ;function esc(e) { if (e.key === "Escape") close(); }
      ;function close() { try { ov.remove(); } catch (e) {} document.removeEventListener("keydown", esc); }
      if (inline) { cl.onclick = close; }
      else {
        document.addEventListener("keydown", esc);
        cl.onclick = close;
        ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
      }
      return { ov: ov, box: box, close: close };
    }
  window.modalShell = modalShell;

  ;function toast(m) { try { if (window.dragonToast) window.dragonToast(m); } catch (e) {} }
  ;function findDescTa() {
    try { if (window.dragonDescTa) return window.dragonDescTa; } catch (e) {}
    return document.querySelector('textarea[data-name="description"]');
  }
  ;function getDesc() { var t = findDescTa(); return t ? String(t.value || "") : ""; }
  ;function setDescFB(v) {
    var ta = findDescTa();
    if (!ta) return false;
    var val = String(v == null ? "" : v);
    ta.value = val;
    if (window.input) { try { window.input.description = val; } catch (e) {} }
    try { var spec = window.___userSettings746291937 && window.___userSettings746291937.userInputs && window.___userSettings746291937.userInputs.description; if (spec) spec.value = val; } catch (e) {}
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }
  ;function stripPhrase(cur, phrase) {
    if (!phrase) return cur;
    var i = cur.indexOf(phrase);
    if (i === -1) return cur;
    var out = cur.slice(0, i) + cur.slice(i + phrase.length);
    out = out.replace(/,(\s*,)+/g, ",").replace(/,\s*$/g, "").replace(/^\s*,\s*/g, "").trim();
    return out;
  }
  window.toast = toast;
  window.findDescTa = findDescTa;
  window.setDescFB = setDescFB;

  var SCENARIOS_ALL = [
    ["\uD83C\uDFD6\uFE0F", "Beach", "sunny beach, golden sand, turquoise sea, swimwear, vacation vibe"],
    ["\uD83C\uDFCB\uFE0F", "Gym", "modern gym, athletic wear, sweat, dramatic gym lighting"],
    ["\uD83D\uDECF\uFE0F", "Lounge", "quiet lounge, soft warm lighting, bookshelves, relaxed mood"],
    ["\uD83C\uDFE2", "Office", "modern office, business attire, glass walls, city view"],
    ["\uD83D\uDEBF", "Shower", "glass shower, water droplets, fresh atmosphere"],
    ["\uD83C\uDF03", "Night City", "neon-lit city street at night, rain reflections, cinematic"],
    ["\uD83C\uDFF0", "Fantasy", "enchanted forest castle, magic glow, fantasy realm"],
    ["\uD83C\uDF38", "Garden", "blooming flower garden, golden hour, soft bokeh"],
    ["\uD83D\uDE97", "Car", "luxury car interior, leather seats, golden hour drive"],
    ["\uD83C\uDF77", "Bar", "dim cocktail bar, moody lighting, elegant outfit"],
    ["\uD83D\uDC40", "Candlelit", "soft silk draped, candlelight, graceful pose, romantic"],
    ["\uD83C\uDF40", "Vintage Parlor", "elegant vintage parlor, antique furniture, artistic lighting, silk robe"],
    ["\uD83C\uDF32", "Forest", "mystical forest, sunbeams through the canopy, mossy ground, nature vibe"],
    ["\u26F0\uFE0F", "Mountain", "mountain summit, dramatic clouds, alpine air, breathtaking view"],
    ["\uD83C\uDFD9\uFE0F", "Street", "city street corner, urban vibe, warm streetlights, busy atmosphere"],
    ["\uD83C\uDFEB", "School", "school courtyard, warm afternoon light, nostalgic mood"],
    ["\uD83C\uDF19", "Rooftop", "rooftop at dusk, city lights below, romantic sky"],
    ["\uD83C\uDFCA", "Poolside", "poolside, crystal clear water, sunny resort, summer vibe"],
    ["\uD83E\uDEA9", "Nightclub", "nightclub dance floor, colorful strobe lights, energetic crowd"],
    ["\uD83D\uDCDA", "Library", "quiet library, warm reading lamps, bookshelves, studious mood"],
    ["\uD83C\uDFD5\uFE0F", "Campfire", "campfire at night, sparks rising, starry sky, cozy warmth"],
    ["\uD83C\uDF27\uFE0F", "Rainy Alley", "rainy neon alley, wet pavement reflections, moody noir"],
    ["\uD83C\uDFEF", "Japanese Temple", "japanese temple garden, paper lanterns, cherry blossoms, serene"],
    ["\uD83D\uDEA2", "Cruise", "luxury cruise deck, ocean horizon, sea breeze, sunset glow"],
    ["\uD83C\uDFDC\uFE0F", "Desert", "sandy dunes at golden hour, desert wind, epic landscape"],
    ["\uD83C\uDFA2", "Theme Park", "theme park at night, colorful carnival lights, festive atmosphere"]
  ];
  window.SCENARIOS_ALL = SCENARIOS_ALL;

  ;function dragonApplyScenarioFB(emoji, label, phrase) {
    var ta = findDescTa();
    if (!ta) return;
    var cur = getDesc();
    var old = window.__dragonAppliedScenario || "";
    if (old && old !== phrase) cur = stripPhrase(cur, old);
    var nv = cur.trim() ? cur.trim() + ", " + phrase : phrase;
    setDescFB(nv);
    window.__dragonAppliedScenario = phrase;
    try { localStorage.dragonScenarioSel = phrase; } catch (e) {}
    toast(emoji + " " + label + " added to prompt");
  }
  window.dragonApplyScenario = dragonApplyScenarioFB;
  // Egon 13.09.2026 — drop/clear Scene selection (toggle) + clear all theme categories.
  ;function dragonClearScenarioFB(silent) {
    var ta = findDescTa();
    var ph = window.__dragonAppliedScenario || "";
    if (!ph) { try { ph = localStorage.dragonScenarioSel || ""; } catch (e) { ph = ""; } }
    if (ta && ph) {
      var nv = stripPhrase(getDesc(), ph);
      if (nv !== getDesc()) setDescFB(nv);
    }
    window.__dragonAppliedScenario = "";
    try { localStorage.removeItem("dragonScenarioSel"); } catch (e) {}
    if (!silent) toast("\uD83C\uDFAF scene removed from prompt");
  }
  window.dragonClearScenarioFB = dragonClearScenarioFB;
  // Egon 10.09.2026 — 🎇 Extravaganza: the old broken red "➕" (.random-append-btn) is gone; its
  // content (the randomAppendRaw "extravaganza" styles) now lives as a proper block at the BOTTOM
  // of the Character Creation panel. Selecting an item appends it to the prompt (single-select:
  // choosing again / None removes the previous one).
  ;function dragonApplyExtravaganza(phrase) {
    var ta = findDescTa();
    if (!ta) return;
    var cur = getDesc();
    var old = window.__dragonAppliedExtra || "";
    if (old && old !== phrase) cur = stripPhrase(cur, old);
    var nv = cur.trim() ? cur.trim() + ", " + phrase : phrase;
    setDescFB(nv);
    window.__dragonAppliedExtra = phrase;
    try { localStorage.dragonExtraSel = phrase; } catch (e) {}
    toast("\uD83C\uDF87 Extravaganza added to prompt");
  }
  window.dragonApplyExtravaganza = dragonApplyExtravaganza;
  ;function dragonClearExtravaganza(silent) {
    var ta = findDescTa();
    var ph = window.__dragonAppliedExtra || "";
    if (!ph) { try { ph = localStorage.dragonExtraSel || ""; } catch (e) { ph = ""; } }
    if (ta && ph) {
      var nv = stripPhrase(getDesc(), ph);
      if (nv !== getDesc()) setDescFB(nv);
    }
    window.__dragonAppliedExtra = "";
    try { localStorage.removeItem("dragonExtraSel"); } catch (e) {}
    if (!silent) toast("\uD83C\uDF87 extravaganza removed from prompt");
  }
  window.dragonClearExtravaganza = dragonClearExtravaganza;
  ;function dragonRandomExtravaganza() {
    try {
      if (window.root && window.root.randomAppendRaw && window.root.randomAppendRaw.selectOne) {
        var one = window.root.randomAppendRaw.selectOne.evaluateItem;
        if (one) { dragonApplyExtravaganza(String(one)); return String(one); }
      }
    } catch (e) {}
    return "";
  }
  window.dragonRandomExtravaganza = dragonRandomExtravaganza;
  ;function dragonExtravaganzaList() {
    var out = [];
    try { if (window.root && window.root.randomAppendRaw) out = Object.keys(window.root.randomAppendRaw); } catch (e) { out = []; }
    return out;
  }
  window.dragonExtravaganzaList = dragonExtravaganzaList;
  // Scene + Design Theme + Overall Theme + Image Background — clears all of them simultaneously.
  ;function dragonClearThemeCats(silent) {
    dragonClearScenarioFB(true);
    ["designTheme", "theme", "background"].forEach(function (cat) {
      var list = (typeof dtbEntries === "function") ? dtbEntries(cat) : [];
      for (var i = 0; i < list.length; i++) {
        var ph = list[i][0];
        if (typeof dtbIsSelected === "function" && dtbIsSelected(cat, ph, "v1")) {
          var chip = document.querySelector('.dragon-char-wrap .dragon-char-chip[data-phrase="' + dtbEsc(ph) + '"]');
          if (chip && chip.dataset.on === "1") chip.click();
        }
      }
      var s2 = document.querySelector('.dragon-char-wrap2 select[data-cat="' + cat + '"]');
      if (s2 && s2.value) { s2.value = ""; s2.dispatchEvent(new Event("change", { bubbles: true })); }
    });
    (window.__dragonThemeRefreshList || []).forEach(function (f) { try { f(); } catch (e) {} });
  }
  window.dragonClearThemeCats = dragonClearThemeCats;
  // Egon 13.09.2026 — clears all character selections (regardless of active panel: v1–v5 + theme block).
  ;function dragonClearAllChar() {
    try { if (window.dragonClearPanel) window.dragonClearPanel("char"); } catch (e) {}
    try { if (window.dragonV4Clear) window.dragonV4Clear(); } catch (e) {}
    try { if (window.__dragonV4ClearMore) window.__dragonV4ClearMore(); } catch (e) {}
    try { if (window.dragonV5Clear) window.dragonV5Clear(); } catch (e) {}
    dragonClearThemeCats(true);
    try { dragonClearExtravaganza(true); } catch (e) {}
  }
  window.dragonClearAllChar = dragonClearAllChar;
  // Egon 12.09.2026 — random Scene picker (the Scene block was the only one without a 🎲 button).
  ;function dragonRandomScene() {
    if (!SCENARIOS_ALL || !SCENARIOS_ALL.length) return;
    var sc = SCENARIOS_ALL[Math.floor(Math.random() * SCENARIOS_ALL.length)];
    dragonApplyScenarioFB(sc[0], sc[1], sc[2]);
  }
  window.dragonRandomScene = dragonRandomScene;

  ;function getMainCute() {
    try { var s = document.querySelector('[data-name="cuteness"]'); return s ? String(s.value || "Off") : ""; } catch (e) { return ""; }
  }
  ;function setMainCute(v) {
    var s = document.querySelector('[data-name="cuteness"]');
    if (!s) return false;
    var found = false;
    for (var i = 0; i < s.options.length; i++) {
      if (String(s.options[i].value) === v || String(s.options[i].textContent || "").trim() === v) { s.selectedIndex = i; found = true; break; }
    }
    if (!found) return false;
    s.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  // ---------- scenario chips bar (renders into every V1-V5 char panel) ----------
  ;function mkChip(label, title, fn) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    if (title) b.title = title;
    b.style.cssText = "font-size:.62rem; padding:.12rem .42rem; border:1px solid #6a6a78; background:linear-gradient(145deg,#24242d,#131318); color:#d8c9ff; cursor:pointer; border-radius:999px;";
    b.onclick = function (e) { e && e.stopPropagation(); try { fn(); } catch (err) { toast("Oops \u2014 try again"); } };
    return b;
  }
  // ---- Egon 11.09.2026 — unified "Theme & Scene" block at the END of EVERY CC panel ----
  // Each character panel version (v1–v5) now ENDS with 🎭 Design Theme · 🌅 Overall Theme ·
  // 🖼️ Image Background; the 🎯 Scene (scenarios) menu is added on top. This single block
  // REPLACES the panel's own scattered designTheme/theme/background sections (they are hidden,
  // state is preserved in DOM) and applies the selection to the ACTUAL control of the active version (v2 →
  // assigns value to select and spreads change; v1/v3/v4/v5 → clicks respective chip) → single-selection,
  // mirror sync, random/AI and description updates work as usual.
  ;function dtbEsc(s) { return (window.CSS && CSS.escape) ? CSS.escape(String(s)) : String(s).replace(/(["\\])/g, "\\$1"); }
  ;function dtbFill(sel, entries) {
    if (!sel) return;
    while (sel.options.length > 1) sel.remove(1); // keep the placeholder
    for (var i = 0; i < entries.length; i++) { var o = document.createElement("option"); o.value = entries[i][0]; o.textContent = entries[i][1]; sel.appendChild(o); }
  }
  ;function dtbEntries(cat) {
    // Since all versions share the same data, options are ALWAYS read from the
    // chips in the v1 panel (v2/v3/v4/v5 have no native designTheme/theme/background or they are hidden).
    var out = [];
    // Egon 15.09.2026 — the "✓ " label at the beginning of the native selected chip text was also coming to us
    // → when a second "✓" was added to our own chip, it appeared as "✓ ✓"; clear the label here.
    var cleanLbl = function (t) { return String(t || "").replace(/^[\u2713\u2714\u221A]\s*/, "").trim(); };
    var sec = document.querySelector('.dragon-char-wrap .dragon-v1-sec[data-cat="' + cat + '"]');
    if (sec) {
      var chips = sec.querySelectorAll(".dragon-char-chip");
      for (var i = 0; i < chips.length; i++) out.push([chips[i].dataset.phrase || chips[i].textContent, cleanLbl(chips[i].textContent)]);
      return out;
    }
    var s = document.querySelector('.dragon-char-wrap2 select[data-cat="' + cat + '"]');
    if (s) { for (var j = 0; j < s.options.length; j++) { var o = s.options[j]; if (o.value) out.push([o.value, cleanLbl(o.textContent)]); } }
    return out;
  }
  ;function dtbIsSelected(cat, phrase, ver) {
    if (ver === "v2") {
      var s = document.querySelector('.dragon-char-wrap2 select[data-cat="' + cat + '"]');
      return !!(s && s.value === phrase);
    }
    var scope = ver === "v3" ? ".dragon-char-wrap3 .dragon-v3-chip" : ".dragon-char-wrap .dragon-char-chip";
    var chip = document.querySelector(scope + '[data-phrase="' + dtbEsc(phrase) + '"]');
    if (chip) return chip.dataset.on === "1";
    chip = document.querySelector('.dragon-char-wrap .dragon-char-chip[data-phrase="' + dtbEsc(phrase) + '"]');
    return !!(chip && chip.dataset.on === "1");
  }
  ;function dtbSetCat(cat, phrase, ver) {
    if (!phrase) return;
    if (ver === "v2") {
      var s = document.querySelector('.dragon-char-wrap2 select[data-cat="' + cat + '"]');
      if (s) { if (s.value === phrase) return; s.value = phrase; s.dispatchEvent(new Event("change", { bubbles: true })); return; }
    }
    var scope = ver === "v3" ? ".dragon-char-wrap3 .dragon-v3-chip" : ".dragon-char-wrap .dragon-char-chip";
    var chip = document.querySelector(scope + '[data-phrase="' + dtbEsc(phrase) + '"]');
    if (!chip) chip = document.querySelector('.dragon-char-wrap .dragon-char-chip[data-phrase="' + dtbEsc(phrase) + '"]');
    if (chip && chip.dataset.on !== "1") chip.click();
  }
  // DEPOT (Librarybook → "PARKED CODE (DEPO) — 2026-09-25"): the old single-block "🎨 Theme & Scene"
  // renderer (dtbSyncBlock / dtbEnsureStyle / OLD installScenarioBar) was SHADOWED by the native version
  // below and therefore unreachable; removed in build 2.53.0 (Paket C). Parked code + rollback recipe in the book.
  ;function dtbCurrentScene() {
    // Egon 13.09.2026 — We no longer GUESS scenes from the DESCRIPTION text. Previously,
    // because background/scene texts were identical (e.g., "rooftop at dusk..."), a
    // background selection appeared selected in the scene as well, opening the v4/v5 progressive tree prematurely.
    // A scene is only considered selected if it has ACTUALLY been applied (dragonApplyScenarioFB / localStorage).
    var desc = getDesc();
    var scenePh = window.__dragonAppliedScenario || "";
    if (!scenePh) { try { scenePh = localStorage.dragonScenarioSel || ""; } catch (e) { scenePh = ""; } if (scenePh) window.__dragonAppliedScenario = scenePh; }
    if (!scenePh || desc.indexOf(scenePh) === -1) {
      window.__dragonAppliedScenario = "";
      try { localStorage.removeItem("dragonScenarioSel"); } catch (e) {}
      return "";
    }
    return scenePh;
  }
  ;function dtbEnsureStyleNative() {
    if (document.getElementById("dragonThemeNativeCss")) return;
    var st = document.createElement("style");
    st.id = "dragonThemeNativeCss";
    st.textContent =
      ".dragon-theme-native{width:100%; box-sizing:border-box; display:flex; flex-direction:column; gap:.4rem; margin-top:.2rem;}" +
      ".dragon-theme-native .dragon-theme-chip{user-select:none;}" +
      ".dragon-theme-native .dragon-theme-head{text-align:left;}" +
      ".dragon-theme-native-v5 .dragon-theme-v5step{width:100%; display:flex; flex-direction:column; gap:.3rem; padding:.4rem; border:1px solid #3a3a48; border-radius:8px; background:rgba(0,0,0,.22); box-sizing:border-box;}";
    document.head.appendChild(st);
  }
  // ---- Egon 11.09.2026 (v2) — 🎯 Scene · 🎭 Design Theme · 🌅 Overall Theme · 🖼️ Image Background ----
  // These 4 selections are now rendered at the END of EVERY panel (v1–v5), WITHIN THAT PANEL'S OWN STRUCTURE:
  //   v1 → collapsible section + chips (native .dragon-v1-sec)   v2 → label + dropdown row
  //   v3 → header + counter + chips (native .dragon-v3-sec)          v4 → progressive step + chips
  //   v5 → step card + dropdown
  // Selection changes the ACTUAL panel state by touching the hidden native chip/toggle; when the native state
  // changes (random/AI/description), visible controls are synchronized via MutationObserver.
  ;function installScenarioBar(wrap) {
    if (!wrap || !wrap.querySelector) return;
    if (wrap.querySelector(".dragon-theme-native")) return;
    var body = wrap.querySelector(".dragon-char-body, .dragon-char-body2, .dragon-char-body3, .dragon-char-body4, .dragon-char-body5");
    if (!body) return;
    var ver = /char-wrap2/.test(wrap.className) ? "v2" : /char-wrap3/.test(wrap.className) ? "v3" : /char-wrap4/.test(wrap.className) ? "v4" : /char-wrap5/.test(wrap.className) ? "v5" : "v1";
    dtbEnsureStyleNative();

    var host = document.createElement("div");
    host.className = "dragon-theme-native dragon-theme-native-" + ver;
    host.style.cssText = "width:100%; box-sizing:border-box; display:flex; flex-direction:column; gap:.4rem; margin-top:" + ((ver === "v4" || ver === "v5") ? "0" : ".2rem") + ";";

    var CATS = [
      { cat: "scene", label: "\uD83C\uDFAF Scene" },
      { cat: "designTheme", label: "\uD83C\uDFAD Design Theme" },
      { cat: "theme", label: "\uD83C\uDF05 Overall Theme" },
      { cat: "background", label: "\uD83D\uDDBC\uFE0F Image Background" }
    ];
    var entries = {}, refs = {}, refreshers = {};

    ;function optsFor(cat) {
      if (cat === "scene") return SCENARIOS_ALL.map(function (sc) { return [sc[2], sc[0] + " " + sc[1]]; });
      return dtbEntries(cat);
    }
    ;function currentVal(cat) {
      if (cat === "scene") return dtbCurrentScene();
      var list = entries[cat] || [];
      for (var i = 0; i < list.length; i++) { if (dtbIsSelected(cat, list[i][0], ver)) return list[i][0]; }
      return "";
    }
    ;function labelFor(cat, val) {
      var list = entries[cat] || [];
      for (var i = 0; i < list.length; i++) { if (list[i][0] === val) return list[i][1]; }
      return "";
    }
    ;function applyScene(phrase) {
      var hit = null;
      for (var i = 0; i < SCENARIOS_ALL.length; i++) { if (SCENARIOS_ALL[i][2] === phrase) { hit = SCENARIOS_ALL[i]; break; } }
      if (hit) dragonApplyScenarioFB(hit[0], hit[1], hit[2]);
      else dragonApplyScenarioFB("\uD83C\uDFAF", "Theme", phrase);
    }
    // Single-selection + click-to-release (toggle) behavior, like native categories.
    ;function dtbClearCat(cat) {
      var cur = currentVal(cat);
      if (!cur) return;
      if (ver === "v2") {
        var s2 = document.querySelector('.dragon-char-wrap2 select[data-cat="' + cat + '"]');
        if (s2) { s2.value = ""; s2.dispatchEvent(new Event("change", { bubbles: true })); }
        return;
      }
      var scope = ver === "v3" ? ".dragon-char-wrap3 .dragon-v3-chip" : ".dragon-char-wrap .dragon-char-chip";
      var chip = document.querySelector(scope + '[data-phrase="' + dtbEsc(cur) + '"]');
      if (!chip) chip = document.querySelector('.dragon-char-wrap .dragon-char-chip[data-phrase="' + dtbEsc(cur) + '"]');
      if (chip && chip.dataset.on === "1") chip.click();
    }
    ;function applyCat(cat, val) {
      if (cat === "scene") {
        // Egon 13.09.2026 — Scene is now a toggle: clicking the same scene again or selecting the placeholder
        // ("—") → selection is removed (previously it could never be removed).
        if (!val || currentVal("scene") === val) dragonClearScenarioFB();
        else applyScene(val);
        refreshAll(); return;
      }
      if (val && currentVal(cat) === val) dtbClearCat(cat);       // click same option again → release
      else if (val) dtbSetCat(cat, val, ver);                     // new selection → apply to native state
      else dtbClearCat(cat);                                      // placeholder ("—") → clear
      refreshAll();
    }
    ;function refreshAll() {
      Object.keys(refreshers).forEach(function (k) { try { refreshers[k](); } catch (e) {} });
      // Egon 14.09.2026 — V4 sequence fix: hide the block until the native tree reaches "Body Details"
      // (previously appeared right below Gender).
      if (ver === "v4") {
        var _done = false; try { _done = !!window.__dragonV4BodyDone; } catch (e) {}
        host.style.display = _done ? "flex" : "none";
      }
      // Egon 12.09.2026 — v4/v5 progressive reveal: the later steps only OPEN after the previous
      // step has a selection (a dependent tree). A step stays visible if it already has a value.
      if (ver === "v4" || ver === "v5") {
        var prevVal = "";
        CATS.forEach(function (c, idx) {
          var ref = refs[c.cat];
          if (!ref || !ref.stepEl) return;
          var selfVal = currentVal(c.cat);
          var show = idx === 0 || !!prevVal || !!selfVal;
          ref.stepEl.style.display = show ? "" : "none";
          prevVal = selfVal;
        });
      }
    }
    // ⚠️ write data-on ONLY when it changes → removes the risk of MutationObserver infinite loop.
    ;function styleChip(b, on) {
      var want = on ? "1" : "0";
      if (b.dataset.on !== want) b.dataset.on = want;
      b.style.borderColor = on ? "#ffd76a" : "#5a5a6a";
      b.style.background = on ? "linear-gradient(180deg,#4a3a1a,#6a5a2a)" : "linear-gradient(180deg,#1a1a20,#4a4a55)";
      b.style.color = on ? "#ffe9a8" : "#ddd";
      // Egon 10.09.2026 — text is FIXED (✓ not added): chip size/order doesn't change, only color + inner frame.
      b.textContent = b.dataset.label || b.textContent;
      b.style.boxShadow = on ? "inset 0 0 0 1px #ffd76a, 0 0 7px rgba(255,215,106,.45)" : "none";
    }
    ;function mkChip(cat, o) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = o[1];
      b.dataset.label = o[1];
      b.dataset.val = o[0];
      b.dataset.on = "0";
      b.className = "dragon-theme-chip" + (ver === "v3" ? " dragon-char-chip dragon-v3-chip" : " dragon-char-chip");
      b.style.cssText = "font-size:.75rem; padding:.2rem .55rem; border:1px solid #5a5a6a; background:linear-gradient(180deg,#1a1a20,#4a4a55); color:#ddd; border-radius:14px; cursor:pointer;";
      b.onclick = function (e) { if (e) e.stopPropagation(); applyCat(cat, b.dataset.val); };
      return b;
    }
    ;function fillChips(container, cat, buttons) {
      while (container.firstChild) container.removeChild(container.firstChild);
      // Egon 10.09.2026 — each of the last-4 blocks now offers an explicit "None" chip (clears it).
      var nb = mkChip(cat, ["", "\uD83D\uDEAB None"]); buttons.push(nb); container.appendChild(nb);
      (entries[cat] || []).forEach(function (o) { var b = mkChip(cat, o); buttons.push(b); container.appendChild(b); });
    }
    ;function fillSelect(s, cat, corner) {
      while (s.options.length) s.remove(0);
      var o0 = document.createElement("option"); o0.value = ""; o0.textContent = "\uD83D\uDEAB None"; s.appendChild(o0);
      (entries[cat] || []).forEach(function (o) { var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; s.appendChild(op); });
    }
    ;function mkRnd(cat, small) {
      var r = document.createElement("button");
      var _rndLbl = { scene: "Scene", designTheme: "Design Theme", theme: "Overall Theme", background: "Image Background" };
      r.type = "button"; r.textContent = "\uD83C\uDFB2"; r.title = "Random " + (_rndLbl[cat] || cat) + " only";
      r.style.cssText = (small ? "flex:0 0 auto; width:1.7rem; padding:.1rem 0; font-size:.72rem;" : "flex:0 0 auto; width:2rem; padding:.32rem 0; font-size:.8rem;") + " border:1px solid #5a5a6a; background:linear-gradient(180deg,#26262e,#3a3a44); color:#ffd76a; border-radius:8px; cursor:pointer;";
      r.onclick = function (e) { e.stopPropagation(); try { if (cat === "scene") { dragonRandomScene(); } else if (window.dragonRandomCat) { window.dragonRandomCat("char", cat); } } catch (er) {} refreshAll(); };
      return r;
    }

    CATS.forEach(function (c) {
      var cat = c.cat;
      entries[cat] = optsFor(cat);
      var ref = { cat: cat };      if (ver === "v2" || ver === "v5") {
        var row = document.createElement("div");
        if (ver === "v2") { row.className = "dragon-v2-row"; row.style.cssText = "width:100%; display:flex; align-items:center; gap:.4rem;"; }
        else { row.className = "dragon-theme-v5step"; }
        var lab = document.createElement("label");
        lab.textContent = c.label;
        lab.style.cssText = ver === "v2" ? "flex:0 0 42%; font-size:.75rem; color:#e8e0f0;" : "font-size:.76rem; font-weight:bold; color:#ffb3d9;";
        var corner = ver === "v2" ? "\u2014 " : "\u2014 " + c.label.replace(/^\S+\s*/, "") + " \u2014";
        var s = document.createElement("select");
        if (window.dragonStyleSelect) window.dragonStyleSelect(s);
        s.style.cssText = ver === "v2" ? "flex:1; min-width:0; padding:.2rem; font-size:.78rem; background:#1a1a20; color:#ddd; border:1px solid #5a5a6a; border-radius:6px;" : "flex:1; min-width:0; padding:.2rem; font-size:.75rem; background:#1a1a20; color:#ddd; border:1px solid #5a5a6a; border-radius:6px;";
        fillSelect(s, cat, corner);
        s.onchange = function () { applyCat(cat, s.value); };
        var r2 = mkRnd(cat, ver === "v5");
        if (ver === "v2") { row.append(lab, s); if (r2) row.appendChild(r2); }
        else { var wrap2 = document.createElement("div"); wrap2.style.cssText = "display:flex; gap:.4rem; align-items:center; width:100%;"; wrap2.append(s); if (r2) wrap2.appendChild(r2); row.append(lab, wrap2); }
        host.appendChild(row); ref.sel = s; ref.stepEl = row;
        ref.setOptions = function () { fillSelect(s, cat, corner); };
        refreshers[cat] = function () { s.value = currentVal(cat); };
      } else if (ver === "v3") {
        var sec3 = document.createElement("div");
        sec3.className = "dragon-v3-sec"; sec3.style.cssText = "width:100%;";
        var head3 = document.createElement("div");
        head3.style.cssText = "width:100%; padding:.28rem .3rem; font-size:.78rem; color:#e8e0f0; display:flex; align-items:center; gap:.35rem; border-bottom:1px solid #3a3a48;";
        var nm3 = document.createElement("span"); nm3.textContent = c.label;
        var cnt3 = document.createElement("span"); cnt3.className = "dragon-v3-count"; cnt3.textContent = "0";
        cnt3.style.cssText = "font-size:.68rem; color:#ffd76a; border:1px solid #6a5a2a; border-radius:10px; padding:0 .35rem; background:#2a2416;";
        var chips3 = document.createElement("div"); chips3.style.cssText = "display:flex; flex-wrap:wrap; gap:.4rem; padding:.4rem .15rem;";
        var r3 = mkRnd(cat, true); if (r3) r3.style.marginLeft = "auto";
        head3.append(nm3, cnt3); if (r3) head3.appendChild(r3);
        ref.buttons = []; fillChips(chips3, cat, ref.buttons);
        sec3.append(head3, chips3); host.appendChild(sec3);
        ref.stepEl = sec3;
        ref.setOptions = function () { ref.buttons = []; fillChips(chips3, cat, ref.buttons); };
        refreshers[cat] = function () {
          var cv = currentVal(cat), n = 0;
          for (var i = 0; i < ref.buttons.length; i++) { var on = ref.buttons[i].dataset.val === cv; styleChip(ref.buttons[i], on); if (on && ref.buttons[i].dataset.val !== "") n++; }
          cnt3.textContent = String(n);
        };
      } else if (ver === "v4") {
        var sec4 = document.createElement("div");
        sec4.className = "dragon-v4-step";
        sec4.style.cssText = "width:100%; display:flex; flex-direction:column; gap:.35rem; padding:.45rem; border:1px solid #3a3a48; border-radius:8px; background:rgba(0,0,0,.22); box-sizing:border-box;";
        var head4 = document.createElement("div"); head4.style.cssText = "display:flex; align-items:center; gap:.4rem;";
        var lbl4 = document.createElement("div"); lbl4.textContent = (9 + CATS.indexOf(c)) + " \u00b7 " + c.label; lbl4.style.cssText = "flex:1; min-width:0; font-size:.78rem; font-weight:bold; color:#c9a8ff;";
        var r4 = mkRnd(cat, true);
        head4.append(lbl4); if (r4) head4.appendChild(r4);
        var chips4 = document.createElement("div"); chips4.style.cssText = "display:flex; flex-wrap:wrap; gap:.35rem;";
        ref.buttons = []; fillChips(chips4, cat, ref.buttons);
        sec4.append(head4, chips4); host.appendChild(sec4);
        ref.stepEl = sec4;
        ref.setOptions = function () { ref.buttons = []; fillChips(chips4, cat, ref.buttons); };
        refreshers[cat] = function () {
          var cv = currentVal(cat);
          for (var i = 0; i < ref.buttons.length; i++) styleChip(ref.buttons[i], ref.buttons[i].dataset.val === cv);
        };
      } else {
        var sec1 = document.createElement("div");
        sec1.className = "dragon-v1-sec"; sec1.style.cssText = "width:100%; margin-top:.25rem;";
        var headRow = document.createElement("div"); headRow.style.cssText = "width:100%; display:flex; gap:.3rem;";
        var head1 = document.createElement("button");
        head1.className = "dragon-v1-sec-head dragon-theme-head"; head1.dataset.base = c.label; head1.dataset.open = "0";
        head1.style.cssText = "flex:1; min-width:0; padding:.32rem .5rem; font-size:.8rem; border:1px solid #5a5a6a; background:linear-gradient(180deg,#26262e,#3a3a44); color:#e8e0f0; border-radius:8px; cursor:pointer; text-align:left;";
        var cbody = document.createElement("div"); cbody.style.cssText = "display:none; flex-wrap:wrap; gap:.4rem; padding:.45rem .15rem;";
        var r1 = mkRnd(cat, false);
        head1.onclick = function () { var open = cbody.style.display === "flex"; cbody.style.display = open ? "none" : "flex"; head1.dataset.open = open ? "0" : "1"; refreshers[cat](); };
        headRow.append(head1); if (r1) headRow.appendChild(r1);
        ref.buttons = []; fillChips(cbody, cat, ref.buttons);
        sec1.append(headRow, cbody); host.appendChild(sec1);
        ref.stepEl = sec1;
        ref.setOptions = function () { ref.buttons = []; fillChips(cbody, cat, ref.buttons); };
        refreshers[cat] = function () {
          var cv = currentVal(cat);
          for (var i = 0; i < ref.buttons.length; i++) styleChip(ref.buttons[i], ref.buttons[i].dataset.val === cv);
          head1.textContent = c.label + (cv ? " \u2192 " + labelFor(cat, cv) : "") + (head1.dataset.open === "1" ? " \u25B4" : " \u25BE");
        };
      }
      refs[cat] = ref;
    });
    // Egon 10.09.2026 — 🎇 Extravaganza block at the very BOTTOM of the Character Creation panel.
    // Replaces the broken red "➕": a dropdown of every randomAppendRaw "extravaganza" style plus a
    // random 🎲 and a None option. Single-select — picking again with None removes it.
    var exSec = document.createElement("div");
    exSec.className = "dragon-v1-sec dragon-extravaganza";
    exSec.style.cssText = "width:100%; margin-top:.25rem;";
    var exHeadRow = document.createElement("div");
    exHeadRow.style.cssText = "width:100%; display:flex; gap:.3rem;";
    var exHead = document.createElement("button");
    exHead.type = "button";
    exHead.className = "dragon-v1-sec-head dragon-theme-head";
    exHead.dataset.open = "0";
    exHead.style.cssText = "flex:1; min-width:0; padding:.32rem .5rem; font-size:.8rem; border:1px solid #5a5a6a; background:linear-gradient(180deg,#26262e,#3a3a44); color:#e8e0f0; border-radius:8px; cursor:pointer; text-align:left;";
    var exBody = document.createElement("div");
    exBody.style.cssText = "display:none; flex-direction:column; gap:.4rem; padding:.45rem .15rem;";
    var exSel = document.createElement("select");
    if (window.dragonStyleSelect) window.dragonStyleSelect(exSel);
    exSel.style.cssText = "width:100%; padding:.25rem .4rem; font-size:.78rem; background:#1a1a20; color:#ddd; border:1px solid #5a5a6a; border-radius:6px; cursor:pointer;";
    ;function exFill() {
      while (exSel.options.length) exSel.remove(0);
      var o0 = document.createElement("option"); o0.value = ""; o0.textContent = "\uD83D\uDEAB None"; exSel.appendChild(o0);
      dragonExtravaganzaList().forEach(function (it) { var o = document.createElement("option"); o.value = it; o.textContent = it; exSel.appendChild(o); });
    }
    // 📦 C1 (2.53.0) — these 1.357 <option> nodes used to be materialised at panel-build time, while the
    // section (and the whole Character Creation panel) was still COLLAPSED: ~21% of the page's DOM belonged
    // to a control nobody could see. The list is now built on the FIRST EXPAND. Feature and behaviour are
    // untouched: the head label reads its state from currentExtra(), never from the <select>.
    ;function exEnsure() { if (!exSel.options.length) exFill(); }
    ;function currentExtra() {
      var d = getDesc();
      var ph = window.__dragonAppliedExtra || "";
      if (!ph) { try { ph = localStorage.dragonExtraSel || ""; } catch (e) { ph = ""; } }
      if (!ph || d.indexOf(ph) === -1) { window.__dragonAppliedExtra = ""; return ""; }
      return ph;
    }
    exSel.onchange = function (e) { if (e && e.stopPropagation) e.stopPropagation(); if (!exSel.value) dragonClearExtravaganza(); else dragonApplyExtravaganza(exSel.value); refreshAll(); };
    var exRnd = document.createElement("button");
    exRnd.type = "button"; exRnd.textContent = "\uD83C\uDFB2"; exRnd.title = "Random extravaganza";
    exRnd.style.cssText = "flex:0 0 auto; width:2rem; padding:.32rem 0; font-size:.8rem; border:1px solid #5a5a6a; background:linear-gradient(180deg,#26262e,#3a3a44); color:#ffd76a; border-radius:8px; cursor:pointer;";
    exRnd.onclick = function (e) { e.stopPropagation(); dragonRandomExtravaganza(); refreshAll(); };
    exHead.onclick = function () { var open = exBody.style.display === "flex"; exBody.style.display = open ? "none" : "flex"; exHead.dataset.open = open ? "0" : "1"; if (!open) exEnsure(); refreshAll(); };
    exHeadRow.append(exHead, exRnd);
    exBody.appendChild(exSel);
    exSec.append(exHeadRow, exBody);
    host.appendChild(exSec);
    refreshers.__extra = function () {
      var cv = currentExtra();
      if (exSel.options.length && exSel.value !== cv) exSel.value = cv;
      var lab = cv.length > 42 ? cv.slice(0, 42) + "\u2026" : cv;
      exHead.textContent = "\uD83C\uDF87 Extravaganza" + (cv ? " \u2192 " + lab : "") + (exHead.dataset.open === "1" ? " \u25B4" : " \u25BE");
    };
    refreshAll();
    (window.__dragonThemeRefreshList = window.__dragonThemeRefreshList || []).push(refreshAll);

    // Panel should now END with these selections → hide scattered native theme sections (state remains in DOM).
    ["designTheme", "theme", "background"].forEach(function (cat) {
      var n = wrap.querySelector('.dragon-v1-sec[data-cat="' + cat + '"], .dragon-v2-row[data-cat="' + cat + '"], .dragon-v3-sec[data-cat="' + cat + '"]');
      if (n) n.style.display = "none";
    });
    body.appendChild(host);

    // Native chips are often installed AFTER this block → refresh the options list a few times.
    var _scTries = 0;
    (function _scRetry() {
      _scTries++;
      try {
        CATS.forEach(function (c) {
          if (c.cat === "scene" || !refs[c.cat]) return;
          var ent = dtbEntries(c.cat);
          if (ent.length !== (entries[c.cat] || []).length) { entries[c.cat] = ent; if (refs[c.cat].setOptions) refs[c.cat].setOptions(); }
        });
        // Only refill a list the visitor has ALREADY opened (length 1 = placeholder-only build, e.g. the
        // raw list was not ready yet). An untouched list stays empty (C1).
        if (exSel.options.length && exSel.options.length <= 1 && dragonExtravaganzaList().length) exFill();
        // Egon 13.09.2026 — v4/v5 "headless" appearance fix: native v4/v5 steps were added
        // AFTER our block, so the block remained in the middle; move to the VERY END every turn.
        if (body.lastElementChild !== host) body.appendChild(host);
        refreshAll();
      } catch (e) {}
      if (_scTries < 10) setTimeout(_scRetry, 300 * _scTries);
    })();

    // Sync our visible controls when native state changes (random/AI/description sync).
    try {
      new MutationObserver(function () { refreshAll(); }).observe(body, { attributes: true, attributeFilter: ["data-on"], subtree: true });
    } catch (e) {}
    // ⚠️ BUBBLE phase (NOT capture) — capture was resetting our select's value before the handler.
    document.addEventListener("input", function (e) { var t = e.target; if (t && t.getAttribute && t.getAttribute("data-name") === "description") refreshAll(); });
    wrap.addEventListener("change", function () { refreshAll(); });
  }
  // The old "Theme & Scene" single-block (4 dropdown) version was replaced by the native renderer above.
  // Its dead, shadowed code was parked in src/Librarybook.enc and DELETED from this file in build 2.53.0
  // (Paket C) — see "PARKED CODE (DEPO) — 2026-09-25" for the byte-exact copy and the rollback recipe.
  ;function scanCharPanelsScenario() {
    var wraps = document.querySelectorAll(".dragon-char-wrap, .dragon-char-wrap2, .dragon-char-wrap3, .dragon-char-wrap4, .dragon-char-wrap5");
    for (var i = 0; i < wraps.length; i++) installScenarioBar(wraps[i]);
  }
  ;function bootScenarios() {
    scanCharPanelsScenario();
    dragonBodyObserve(function () { scanCharPanelsScenario(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootScenarios);
  else bootScenarios();
})();
