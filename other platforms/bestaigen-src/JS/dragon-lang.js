(function () {
  if (window.dragonLang) return;
  var LS = "dragonPageLang";
  var LANGS = [
    ["en", "English"], ["tr", "Türkçe"], ["de", "Deutsch"], ["fr", "Français"],
    ["es", "Español"], ["it", "Italiano"], ["ru", "Русский"], ["pt", "Português"],
    ["ar", "العربية"], ["nl", "Nederlands"], ["pl", "Polski"], ["ja", "日本語"],
    ["zh", "中文"], ["ko", "한국어"]
  ];
  var NAMES = {};
  LANGS.forEach(function (p) { NAMES[p[0]] = p[1]; });
  function supported(c) { return !!NAMES[c]; }
  function auto() {
    var l = "en";
    try {
      var ls = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || navigator.userLanguage || ""];
      for (var i = 0; i < ls.length; i++) {
        var c = String(ls[i] || "").toLowerCase().split("-")[0];
        if (supported(c)) { l = c; break; }
      }
    } catch (e) {}
    return l;
  }
  function manual() {
    try {
      var v = localStorage.getItem(LS);
      if (v && supported(v)) return v;
    } catch (e) {}
    return null;
  }
  function get() { return manual() || auto(); }
  var subs = [];
  function set(code) {
    var v = (code === "auto" || code == null || code === "") ? null : String(code);
    if (v && !supported(v)) return get();
    try {
      if (v) localStorage.setItem(LS, v);
      else localStorage.removeItem(LS);
    } catch (e) {}
    var cur = get();
    try {
      var sels = document.querySelectorAll("select.dragon-lang-select");
      for (var i = 0; i < sels.length; i++) { try { sels[i].value = v || "auto"; } catch (e2) {} }
    } catch (e3) {}
    for (var j = 0; j < subs.length; j++) { try { subs[j](cur); } catch (e4) {} }
    return cur;
  }
  function select(cssText) {
    var s = document.createElement("select");
    s.className = "dragon-lang-select";
    s.title = "Language";
    s.style.cssText = cssText || "font-size:.72rem; padding:.2rem .3rem; border-radius:7px; border:1px solid rgba(155,107,255,.55); background:#1b1b24; color:#d8c9ff; cursor:pointer; max-width:7.5rem;";
    var o0 = document.createElement("option");
    o0.value = "auto";
    o0.textContent = "Auto";
    s.appendChild(o0);
    LANGS.forEach(function (p) {
      var o = document.createElement("option");
      o.value = p[0];
      o.textContent = p[1];
      s.appendChild(o);
    });
    try { s.value = manual() || "auto"; } catch (e) {}
    s.addEventListener("change", function () {
      var cur = set(s.value);
      try { if (window.dragonToast) window.dragonToast("Language: " + (NAMES[cur] || cur)); } catch (e2) {}
    });
    return s;
  }
  window.dragonLang = {
    list: LANGS,
    auto: auto,
    manual: manual,
    get: get,
    set: set,
    select: select,
    name: function (c) { return NAMES[c] || c || "English"; },
    onChange: function (fn) { if (typeof fn === "function") subs.push(fn); }
  };
})();
