// dragon-art-mix.js — Art Style panel · Mixed Art Style: blend two art styles into one generation.
// Egon 11.10.2026: the core of agentstudio's "Styles & Mix" panel, rebuilt on bestaigen's engine.
// Styles come from the artStyle select; per-style prompt/negative templates are extracted with the
// marker trick (compiled prompts evaluate live against window.input). Non-pixel techniques fire the
// normal Generate path on a neutral base style, so cards + history are automatic. Pixel blend renders
// A and B headless at the same seed, composites on canvas, and records via dragonHistAddImage.
// Rollback: delete this file + its script tag, and point mixedBtn back at its "coming soon" toast.
(function () {
  if (window.__dragonArtMixInstalled) return;
  window.__dragonArtMixInstalled = true;

  var LS_STATE = "dragonMixState", LS_MIXES = "dragonMixSaved";
  var MARKER = "ZZMIXMARKERZZ01";
  var BLEND_MODES = ["overlay", "soft-light", "hard-light", "screen", "multiply", "color-dodge", "difference", "source-over"];
  var BAD_CHARS = /[\[\]{}^$|]/g;

  ;function toast(m) { try { if (window.dragonToast) window.dragonToast(m); } catch (e) {} }
  ;function q(s, r) { try { return (r || document).querySelector(s); } catch (e) { return null; } }
  ;function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  ;function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  ;function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  ;function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  ;function clampNum(v, lo, hi, d) { var n = parseFloat(v); return isNaN(n) ? d : Math.max(lo, Math.min(hi, n)); }
  ;function tag(el) { try { el.setAttribute("data-name", ""); } catch (e) {} return el; }
  ;function sanitize(t) { return String(t == null ? "" : t).replace(BAD_CHARS, " ").replace(/\s+/g, " ").trim(); }
  ;function cleanEdges(s) { return String(s || "").replace(/^[,\s;:.]+/, "").replace(/[,\s;:.]+$/, "").replace(/\s*,\s*,\s*/g, ", "); }

  var TECHNIQUES = [
    { id: "fusion", label: "Weighted fusion", hint: "(style:weight) in one prompt — the reliable default" },
    { id: "stacked", label: "Stacked tags", hint: "plain style tags appended, no weights" },
    { id: "diptych", label: "Diptych split", hint: "two styles side by side, hard divide (uses A + B)" },
    { id: "mashup", label: "Named mashup", hint: "\u201CA meets B\u201D (uses A + B)" },
    { id: "grid", label: "2x2 grid", hint: "four styles in one contact sheet", exp: true },
    { id: "transition", label: "Soft transition", hint: "left-to-right morph — often becomes a lighting split", exp: true },
    { id: "pixel", label: "Pixel blend", hint: "renders A and B separately, then blends the pixels (2x cost)", exp: true }
  ];

  // ================= style source =================
  ;function artSelect() { return q('select[data-name="artStyle"]'); }
  ;function styleNames() {
    var sel = artSelect(), out = [];
    if (!sel) return out;
    for (var i = 0; i < sel.options.length; i++) {
      var o = sel.options[i];
      if (o.disabled) continue;
      // NOTE: the panel decorates option text with emoji — dataset.dragonOrig holds the real
      // style name, which is also the compiledOptions key. Never match on the decorated text.
      var t = String((o.dataset && o.dataset.dragonOrig) || o.text || "").trim();
      if (t) out.push(t);
    }
    return out;
  }
  ;function selCurrentName() {
    try {
      var sel = artSelect();
      if (!sel || sel.selectedIndex < 0) return "";
      var o = sel.options[sel.selectedIndex];
      return String((o.dataset && o.dataset.dragonOrig) || o.text || "").trim();
    } catch (e) { return ""; }
  }
  ;function sanitizeState() {
    // NOTE: this module loads before the framework populates the artStyle select, so slots
    // resolved at load time may be empty — refill here, at build time, when names are real.
    var names = styleNames();
    var co = compiled();
    var ok = (model.slots || []).filter(function (s) { return s && names.indexOf(s.name) >= 0 && co[s.name]; }).slice(0, 2);
    if (!ok.length) {
      var neutral = noStyleKey();
      var cur = selCurrentName();
      var a = (cur && names.indexOf(cur) >= 0 && cur !== neutral) ? cur : "";
      if (!a) for (var i = 0; i < names.length; i++) if (names[i] !== neutral) { a = names[i]; break; }
      var b = "";
      for (var j = 0; j < names.length; j++) if (/cinematic/i.test(names[j]) && names[j] !== a) { b = names[j]; break; }
      if (!b) for (var k = 0; k < names.length; k++) if (names[k] !== a && names[k] !== neutral) { b = names[k]; break; }
      if (a) ok.push({ name: a, weight: 1.5 });
      if (b) ok.push({ name: b, weight: 1.0 });
    }
    while (ok.length < 2) {
      var fb = names.filter(function (n) { return ok.map(function (s) { return s.name; }).indexOf(n) < 0; })[0] || "";
      if (!fb) break;
      ok.push({ name: fb, weight: ok.length === 0 ? 1.5 : 1.0 });
    }
    model.slots = ok;
  }
  ;function compiled() {
    try {
      var s = window.___userSettings746291937;
      var a = s && s.userInputs && s.userInputs.artStyle;
      return (a && a.compiledOptions) || {};
    } catch (e) { return {}; }
  }
  ;function noStyleKey() {
    var co = compiled(), keys = Object.keys(co), i, norm;
    for (i = 0; i < keys.length; i++) {
      if (keys[i].indexOf("\u2500\u2500") === 0) continue; // category headers normalize to "nostyle" too — skip them
      norm = keys[i].replace(/[^A-Za-z]/g, "").toLowerCase();
      if (norm === "nostyle") return keys[i];
    }
    for (i = 0; i < keys.length; i++) if (keys[i].indexOf("\u2500\u2500") !== 0) return keys[i];
    return keys[0] || "";
  }
  ;function suffixOf(name) {
    var co = compiled();
    if (!co[name] || !window.input) return "";
    var prev = undefined;
    try { prev = window.input.description; window.input.description = MARKER; } catch (e) { return ""; }
    var raw = "";
    try { raw = String(co[name].prompt); } catch (e) {}
    try { window.input.description = prev; } catch (e) {}
    return cleanEdges(sanitize(raw.split(MARKER).join(" ")));
  }
  ;function negSuffixOf(name) {
    var co = compiled();
    if (!co[name] || !window.input) return "";
    var prev = undefined;
    try { prev = window.input.negative; window.input.negative = ""; } catch (e) { return ""; }
    var raw = "";
    try { raw = String(co[name].negative); } catch (e) {}
    try { window.input.negative = prev; } catch (e) {}
    return cleanEdges(sanitize(raw));
  }
  ;function shortPhrase(name) {
    var s = suffixOf(name);
    if (!s) return name;
    return s.split(",").slice(0, 2).join(",").trim() || name;
  }

  // ================= state =================
  ;function defaults() {
    var names = styleNames();
    var cur = selCurrentName();
    if (names.indexOf(cur) < 0) cur = names[0] || "";
    var b = "";
    for (var i = 0; i < names.length; i++) if (/cinematic/i.test(names[i]) && names[i] !== cur) { b = names[i]; break; }
    if (!b) b = names[0] === cur ? (names[1] || names[0] || "") : (names[0] || "");
    return { technique: "fusion", slots: [{ name: cur, weight: 1.5 }, { name: b, weight: 1.0 }],
      applyNeg: true, blendMode: "overlay", blendOpacity: 0.6, seed: "" };
  }
  var model = defaults();
  try {
    var m = JSON.parse(lsGet(LS_STATE, "null"));
    if (m && typeof m === "object") {
      if (m.technique) model.technique = m.technique;
      if (m.slots && m.slots.length) model.slots = m.slots.slice(0, 2);
      if (m.applyNeg !== undefined) model.applyNeg = !!m.applyNeg;
      if (m.blendMode) model.blendMode = m.blendMode;
      if (m.blendOpacity != null) model.blendOpacity = clampNum(m.blendOpacity, 0, 1, 0.6);
      if (m.seed != null) model.seed = String(m.seed);
    }
  } catch (e) {}
  sanitizeState();
  ;function save() {
    lsSet(LS_STATE, JSON.stringify({ technique: model.technique, slots: model.slots,
      applyNeg: model.applyNeg, blendMode: model.blendMode, blendOpacity: model.blendOpacity, seed: model.seed }));
  }

  // ================= prompt construction =================
  ;function activeSlots() {
    var co = compiled(), out = [];
    model.slots.forEach(function (s) {
      if (s && s.name && co[s.name]) out.push({ name: s.name, weight: clampNum(s.weight, 0, 2, 1) });
    });
    return out;
  }
  ;function buildNegative(userNeg) {
    var base = String(userNeg || "").trim();
    if (!model.applyNeg) return base;
    var want = {};
    activeSlots().forEach(function (s) {
      sanitize(suffixOf(s.name)).toLowerCase().split(/[,\s]+/).forEach(function (w) { if (w.length > 3) want[w] = 1; });
    });
    var ban = [];
    activeSlots().forEach(function (s) {
      String(negSuffixOf(s.name) || "").split(",").map(function (t) { return t.trim().toLowerCase(); }).filter(Boolean).forEach(function (raw) {
        var conflict = false;
        for (var w in want) if (w === raw || w.indexOf(raw) >= 0 || raw.indexOf(w) >= 0) { conflict = true; break; }
        if (!conflict && base.toLowerCase().indexOf(raw) < 0 && ban.indexOf(raw) < 0) ban.push(raw);
      });
    });
    return cleanEdges([base].concat(ban).filter(Boolean).join(", "));
  }
  ;function buildPrompt(subject) {
    var sub = sanitize(subject);
    var list = activeSlots();
    if (!list.length) return sub;
    var A = list[0], B = list[1];
    var w = function (x) { return "(" + sanitize(suffixOf(x.name)) + ":" + x.weight.toFixed(2) + ")"; };
    switch (model.technique) {
      case "stacked":
        return cleanEdges([sub].concat(list.map(function (x) { return sanitize(suffixOf(x.name)); })).join(", "));
      case "fusion":
        return cleanEdges([sub].concat(list.map(w)).join(", "));
      case "diptych":
        if (!B) return cleanEdges([sub, sanitize(suffixOf(A.name))].join(", "));
        return "diptych split image, exact vertical divide down the middle, left half: " + shortPhrase(A.name) + " of " + sub + "; right half: " + shortPhrase(B.name) + " of the same subject in the same pose, matching composition and lighting, both halves perfectly aligned";
      case "grid": {
        var pk = function (i) { return (list[i] && list[i].name) || A.name; };
        var names = [pk(0), pk(1), pk(2), pk(3)].map(shortPhrase);
        return "a 2x2 grid of four panels showing " + sub + ", each panel in a different art style: top left " + names[0] + ", top right " + names[1] + ", bottom left " + names[2] + ", bottom right " + names[3] + ", thin white borders between the panels, contact sheet";
      }
      case "mashup":
        if (!B) return cleanEdges([sub, sanitize(suffixOf(A.name))].join(", "));
        return shortPhrase(A.name) + " meets " + shortPhrase(B.name) + ", " + sub + ", the two aesthetics fused into one coherent image";
      case "transition":
        if (!B) return cleanEdges([sub, sanitize(suffixOf(A.name))].join(", "));
        return "one seamless image that transitions from left to right, starting as " + shortPhrase(A.name) + " and gradually turning into " + shortPhrase(B.name) + ", smooth gradient transition across the frame, no hard divider, " + sub;
      case "pixel":
        return list.slice(0, 2).map(function (x) { return shortPhrase(x.name) + " of " + sub; }).join("  ·  ");
      default:
        return cleanEdges([sub].concat(list.map(function (x) { return sanitize(suffixOf(x.name)); })).join(", "));
    }
  }

  // ================= io helpers =================
  ;function descEl() { return q('textarea.paragraph-input[data-name="description"]'); }
  ;function negEl() { return q('textarea[data-name="negative"]'); }
  ;function subject() {
    var d = descEl();
    var v = d ? String(d.value || "").trim() : (window.input ? String(window.input.description || "").trim() : "");
    return v.replace(/\(seed:::\s*\d+\)/g, "").trim();
  }
  ;function userNeg() {
    var n = negEl();
    return n ? String(n.value || "") : (window.input ? String(window.input.negative || "") : "");
  }
  ;function setSelectTo(key) {
    try {
      var sel = artSelect();
      if (!sel) return;
      for (var i = 0; i < sel.options.length; i++) {
        var o = sel.options[i];
        if (String((o.dataset && o.dataset.dragonOrig) || o.text || "") === key) { sel.selectedIndex = i; sel.dispatchEvent(new Event("change", { bubbles: true })); return; }
      }
    } catch (e) {}
  }

  // ================= non-pixel production (normal Generate path) =================
  var busy = false, statusTimer = null;
  ;function setStatus(t) { var el = document.getElementById("dragonMixStatus"); if (el) el.textContent = t; }
  ;function startTimer(label) {
    stopTimer();
    var t0 = Date.now(), el = document.getElementById("dragonMixStatus");
    var tick = function () { if (el) el.textContent = label + " " + Math.round((Date.now() - t0) / 1000) + "s"; };
    tick();
    statusTimer = setInterval(tick, 500);
  }
  ;function stopTimer() { if (statusTimer) clearInterval(statusTimer); statusTimer = null; }
  ;function fireMix() {
    if (busy) { toast("a mix is already generating"); return; }
    var sub = subject();
    if (!sub) { toast("type a description first"); return; }
    var slots = activeSlots();
    if (!slots.length) { toast("pick at least one style"); return; }
    var prompt = buildPrompt(sub), neg = buildNegative(userNeg());
    if (!prompt) { toast("could not build the mix prompt"); return; }
    var base = noStyleKey();
    if (!base) { toast("style engine isn't ready"); return; }
    busy = true; paintGo(); startTimer("Firing");
    try {
      if (window.input) {
        try { window.input.artStyle = compiled()[base]; } catch (e) {}
        try { window.input.description = prompt; } catch (e) {}
        try { window.input.negative = neg; } catch (e) {}
      }
      var d = descEl(); if (d) { d.value = prompt; d.dispatchEvent(new Event("input", { bubbles: true })); }
      var n = negEl(); if (n) { n.value = neg; n.dispatchEvent(new Event("input", { bubbles: true })); }
    } catch (e) {}
    setTimeout(function () {
      try {
        setSelectTo(base); // display follows what actually generates (set after inputs, avoids framework races)
        var fn = window.___generateButtonClickEvent746291937;
        if (typeof fn === "function") fn();
        else toast("image engine isn't ready");
      } catch (e) { toast("mix fire failed"); }
      stopTimer(); busy = false; paintGo();
      setStatus("fired \u2014 watch the output area");
      toast("mix fired \u2014 cards land in the output area like a normal generation");
    }, 400);
  }

  // ================= pixel production (two headless renders + canvas blend) =================
  ;function tileList() { try { var oa = document.getElementById("outputAreaEl"); return oa ? Array.prototype.slice.call(oa.querySelectorAll(".t2i-image-ctn")) : []; } catch (e) { return []; } }
  ;function headlessRender(descText, negText, styleName, seed) {
    var s = window.___userSettings746291937;
    if (!s || !s.imageOptions || !s.imageOptions.createClone) return Promise.reject(new Error("engine not ready"));
    var io = s.imageOptions, co = compiled();
    if (!co[styleName]) return Promise.reject(new Error("unknown style"));
    var pDesc = undefined, pNeg = undefined, pArt = undefined;
    try {
      pDesc = window.input.description; pNeg = window.input.negative; pArt = window.input.artStyle;
      window.input.description = descText; window.input.negative = negText; window.input.artStyle = co[styleName];
    } catch (e) { return Promise.reject(new Error("inputs not ready")); }
    var clone = null;
    try {
      clone = io.createClone;
      clone.prompt = io.prompt.evaluateItem;
      clone.negativePrompt = io.negativePrompt.evaluateItem;
      if (seed != null) clone.seed = seed;
    } catch (e) { clone = null; }
    try { window.input.description = pDesc; window.input.negative = pNeg; window.input.artStyle = pArt; } catch (e) {}
    if (!clone) return Promise.reject(new Error("prompt build failed"));
    var html = "";
    try { html = String(window.___textToImagePlugin746291937(clone)); } catch (e) { return Promise.reject(new Error("render start failed")); }
    if (!html) return Promise.reject(new Error("render start failed"));
    var holder = document.createElement("div");
    holder.style.cssText = "position:absolute; left:0; top:0; width:8px; height:8px; overflow:hidden; visibility:hidden; pointer-events:none;";
    holder.setAttribute("data-name", "");
    try { document.body.appendChild(holder); } catch (e) { return Promise.reject(new Error("holder failed")); }
    try { holder.insertAdjacentHTML("beforeend", html); } catch (e) { try { holder.remove(); } catch (e2) {} return Promise.reject(new Error("tile failed")); }
    return new Promise(function (res, rej) {
      var t0 = Date.now(), done = false;
      var iv = setInterval(function () {
        var url = null, err = null;
        try {
          var f = holder.querySelector("iframe");
          var o = f && f.textToImagePluginOutput;
          if (o && o.dataUrl) url = o.dataUrl;
          else if (o && o.error) err = String(o.error);
        } catch (e) {}
        if (url || err || Date.now() - t0 > 300000) {
          if (!done) {
            done = true; clearInterval(iv);
            try { holder.remove(); } catch (e) {}
            if (url) res(url); else rej(new Error(err || "timeout"));
          }
        }
      }, 1500);
    });
  }
  ;function blendTwo(srcA, srcB, mode, opacity) {
    return new Promise(function (res, rej) {
      var left = 2, imA = new Image(), imB = new Image();
      var done = function () { if (--left > 0) return; draw(); };
      imA.onload = done; imB.onload = done;
      imA.onerror = imB.onerror = function () { rej(new Error("blend decode failed")); };
      imA.src = srcA; imB.src = srcB;
      function draw() {
        try {
          var c = document.createElement("canvas");
          c.width = imA.naturalWidth || 512; c.height = imA.naturalHeight || 512;
          var x = c.getContext("2d");
          x.drawImage(imA, 0, 0);
          x.globalAlpha = Math.max(0, Math.min(1, opacity));
          x.globalCompositeOperation = mode;
          x.drawImage(imB, 0, 0, c.width, c.height);
          res(c.toDataURL("image/jpeg", 0.92));
        } catch (e) { rej(new Error("blend failed")); }
      }
    });
  }
  ;function mixSeed() {
    var n = parseInt(String(model.seed || "").trim(), 10);
    if (isFinite(n) && n > 0 && n <= 2147483647) return n;
    var r = 100000 + Math.floor(Math.random() * 900000);
    model.seed = String(r); save();
    var si = document.getElementById("dragonMixSeed");
    if (si) si.value = String(r);
    return r;
  }
  ;function pixelMix() {
    if (busy) { toast("a mix is already generating"); return; }
    var sub = subject();
    if (!sub) { toast("type a description first"); return; }
    var slots = activeSlots().slice(0, 2);
    if (slots.length < 2) { toast("pixel blend needs styles in both A and B"); return; }
    var neg = buildNegative(userNeg());
    var seed = mixSeed();
    busy = true; paintGo(); startTimer("Rendering 2 styles");
    var descA = cleanEdges([sub, sanitize(suffixOf(slots[0].name))].join(", "));
    var descB = cleanEdges([sub, sanitize(suffixOf(slots[1].name))].join(", "));
    Promise.all([
      headlessRender(descA, neg, slots[0].name, seed),
      headlessRender(descB, neg, slots[1].name, seed)
    ]).then(function (rs) {
      setStatus("Blending\u2026");
      return blendTwo(rs[0], rs[1], model.blendMode, model.blendOpacity).then(function (url) { return { url: url, srcs: rs }; });
    }).then(function (r) {
      var title = "Pixel blend \u2014 " + slots[0].name + " x " + slots[1].name;
      var prompt = "[pixel blend \u00B7 " + model.blendMode + " " + Math.round(model.blendOpacity * 100) + "%] " + descA + "  ||  " + descB;
      try {
        if (window.dragonHistAddImage) window.dragonHistAddImage({ dataUrl: r.url, prompt: prompt, seed: seed });
      } catch (e) {}
      paintResultTile(r.url, title, prompt, r.srcs);
      stopTimer(); busy = false; paintGo();
      setStatus("Done");
      toast("pixel blend is in the output area + history");
    }).catch(function (e) {
      stopTimer(); busy = false; paintGo();
      setStatus("Failed");
      toast("pixel blend failed: " + ((e && e.message) || e));
    });
  }
  ;function paintResultTile(url, title, prompt, srcs) {
    try {
      var oa = document.getElementById("outputAreaEl");
      if (!oa) return;
      var ctn = document.createElement("div");
      ctn.className = "t2i-image-ctn dragon-mix-ctn";
      ctn.style.cssText = "margin:0.25rem; margin-bottom:0.6rem; position:relative; width:450px; max-width:100%; border:1px solid rgba(155,107,255,.35); border-radius:10px; overflow:hidden; background:rgba(20,16,32,.5); cursor:zoom-in;";
      var lab = document.createElement("div");
      lab.textContent = title;
      lab.style.cssText = "display:block; width:100%; box-sizing:border-box; text-align:center; padding:.15rem .5rem; font-size:.72rem; font-weight:bold; color:#d8c9ff; background:rgba(155,107,255,.14); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;";
      var img = document.createElement("img");
      img.src = url; img.alt = title;
      img.style.cssText = "width:100%; display:block;";
      ctn.appendChild(lab); ctn.appendChild(img);
      ctn.title = prompt;
      ctn.onclick = function (e) {
        e.stopPropagation();
        try {
          if (window.dragonZoomLightbox) { window.dragonZoomLightbox({ url: url, prompt: prompt, ctn: ctn }); return; }
        } catch (e2) {}
      };
      if (oa.firstChild) oa.insertBefore(ctn, oa.firstChild); else oa.appendChild(ctn);
      try { ctn.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (e) {}
    } catch (e) {}
  }

  // ================= UI =================
  var built = false;
  ;function mkBtn(t, fn, primary) {
    var b = document.createElement("button");
    b.type = "button"; b.textContent = t;
    b.style.cssText = "background:" + (primary ? "linear-gradient(135deg,#7c5cff,#a855f7)" : "#23232e") + "; color:#fff; border:1px solid " + (primary ? "#a855f7" : "#4a4a58") + "; border-radius:8px; padding:.35rem .6rem; font-size:.78rem; font-weight:700; cursor:pointer; white-space:nowrap;";
    b.onclick = function (e) { e.stopPropagation(); fn(); };
    return b;
  }
  ;function paintGo() {
    var g = document.getElementById("dragonMixGo");
    if (g) { g.disabled = busy; g.style.opacity = busy ? ".55" : "1"; }
  }
  ;function refreshPreview() {
    var sub = subject() || "(your Description text)";
    var pv = document.getElementById("dragonMixPreview");
    if (pv) pv.value = model.technique === "pixel" ? activeSlots().slice(0, 2).map(function (x) { return shortPhrase(x.name) + " of " + sub; }).join("  ·  ") : buildPrompt(sub);
    var nv = document.getElementById("dragonMixNeg");
    if (nv) nv.value = buildNegative(userNeg());
  }
  ;function slotRow(i) {
    var names = styleNames();
    var wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; gap:.35rem; align-items:center; margin-bottom:.3rem;";
    var lab = document.createElement("b");
    lab.textContent = i === 0 ? "A" : "B";
    lab.style.cssText = "color:#c9b8ff; font-size:.8rem; min-width:1rem; text-align:center;";
    var sel = document.createElement("select");
    tag(sel);
    sel.style.cssText = "flex:1 1 auto; min-width:0; background:#0f0f15; border:1px solid #4a4a58; border-radius:8px; color:#e8e6ee; font-size:.78rem; padding:.35rem .45rem;";
    names.forEach(function (n) {
      var o = document.createElement("option");
      o.value = n; o.textContent = n;
      sel.appendChild(o);
    });
    var cur = (model.slots[i] && model.slots[i].name) || "";
    if (names.indexOf(cur) >= 0) sel.value = cur;
    sel.onchange = function () { model.slots[i] = { name: sel.value, weight: (model.slots[i] && model.slots[i].weight) || 1 }; save(); refreshPreview(); };
    sel.onclick = function (e) { e.stopPropagation(); };
    var range = document.createElement("input");
    range.type = "range"; range.min = "0"; range.max = "2"; range.step = "0.05";
    tag(range);
    range.style.cssText = "flex:0 1 90px; min-width:70px;";
    range.value = String((model.slots[i] && model.slots[i].weight) || 1);
    var badge = document.createElement("span");
    badge.style.cssText = "font-size:.72rem; color:#c9b8ff; background:rgba(155,107,255,.14); border:1px solid rgba(155,107,255,.35); border-radius:6px; padding:.1rem .35rem; min-width:2.6rem; text-align:center;";
    var showW = function () { badge.textContent = "x" + clampNum(range.value, 0, 2, 1).toFixed(2); };
    showW();
    range.oninput = function () {
      model.slots[i] = { name: sel.value, weight: clampNum(range.value, 0, 2, 1) };
      showW(); save(); refreshPreview();
    };
    range.onclick = function (e) { e.stopPropagation(); };
    wrap.appendChild(lab); wrap.appendChild(sel); wrap.appendChild(range); wrap.appendChild(badge);
    return wrap;
  }
  ;function build(container) {
    try { sanitizeState(); save(); } catch (e) {}
    // NOTE: the panel can be rebuilt from scratch (ensure2Rebuild) with a FRESH empty row while
    // this module's `built` flag is already true — rebuild fully whenever the given row is empty.
    if (built && container && container.children.length) { refreshPreview(); return; }
    built = true;
    container.innerHTML = "";
    container.style.cssText = "width:100%; box-sizing:border-box; display:flex; flex-direction:column; gap:.45rem; padding:.5rem .55rem; border-top:1px solid rgba(155,107,255,.25); text-align:left;";
    // slots
    var slotBox = document.createElement("div");
    slotBox.appendChild(slotRow(0)); slotBox.appendChild(slotRow(1));
    var negRow = document.createElement("label");
    negRow.style.cssText = "display:flex; align-items:center; gap:.35rem; font-size:.76rem; color:#d8d2ea;";
    var negCb = document.createElement("input");
    negCb.type = "checkbox"; negCb.checked = !!model.applyNeg;
    tag(negCb);
    negCb.onchange = function () { model.applyNeg = !!negCb.checked; save(); refreshPreview(); };
    var negTx = document.createElement("span"); negTx.textContent = "apply style negative tags";
    var negHint = document.createElement("span");
    negHint.style.cssText = "opacity:.65;";
    negHint.textContent = "1.00 = neutral, higher pushes a style";
    negRow.appendChild(negCb); negRow.appendChild(negTx); negRow.appendChild(negHint);
    container.appendChild(slotBox); container.appendChild(negRow);
    // techniques
    var techBox = document.createElement("div");
    techBox.style.cssText = "display:flex; gap:.3rem; flex-wrap:wrap;";
    TECHNIQUES.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button";
      var on = model.technique === t.id;
      b.style.cssText = "flex:1 1 30%; min-width:8rem; text-align:left; background:" + (on ? "rgba(155,107,255,.22)" : "#1b1b24") + "; border:1px solid " + (on ? "#a855f7" : "#4a4a58") + "; border-radius:8px; padding:.3rem .45rem; cursor:pointer; color:#e8e6ee;";
      var ttl = document.createElement("div");
      ttl.style.cssText = "font-size:.76rem; font-weight:700;";
      ttl.textContent = (t.id === "pixel" ? "\uD83E\uDDEA " : t.id === "fusion" ? "\uD83C\uDFA8 " : t.id === "stacked" ? "\uD83E\uDDF1 " : t.id === "diptych" ? "\uD83E\uDE9E " : t.id === "mashup" ? "\uD83E\uDD1D " : t.id === "grid" ? "\uD83D\uDD32 " : "\uD83C\uDF2B ") + t.label + (t.exp ? " \u00B7 experimental" : "");
      var hn = document.createElement("div");
      hn.style.cssText = "font-size:.68rem; opacity:.7;";
      hn.textContent = t.hint;
      b.appendChild(ttl); b.appendChild(hn);
      b.title = t.hint + (t.exp ? " (experimental — results vary)" : "");
      b.onclick = function (e) {
        e.stopPropagation();
        model.technique = t.id; save();
        var kids = techBox.children;
        for (var i = 0; i < kids.length; i++) { kids[i].style.background = "#1b1b24"; kids[i].style.borderColor = "#4a4a58"; }
        b.style.background = "rgba(155,107,255,.22)"; b.style.borderColor = "#a855f7";
        drawBlend(); refreshPreview();
      };
      techBox.appendChild(b);
    });
    container.appendChild(techBox);
    // blend row (pixel only)
    var blendRow = document.createElement("div");
    blendRow.id = "dragonMixBlend";
    blendRow.style.cssText = "display:flex; gap:.4rem; align-items:center; flex-wrap:wrap; font-size:.76rem; color:#e8e3f5;";
    container.appendChild(blendRow);
    // seed row
    var seedRow = document.createElement("div");
    seedRow.style.cssText = "display:flex; gap:.4rem; align-items:center; font-size:.76rem; color:#e8e3f5;";
    var seedLab = document.createElement("span"); seedLab.textContent = "Seed:"; seedLab.style.cssText = "opacity:.8;";
    var seedIn = document.createElement("input");
    seedIn.id = "dragonMixSeed";
    tag(seedIn);
    seedIn.placeholder = "optional — same seed reproduces";
    seedIn.value = model.seed || "";
    seedIn.style.cssText = "width:11rem; box-sizing:border-box; background:#0f0f15; border:1px solid #4a4a58; border-radius:8px; color:#e8e6ee; font-size:.78rem; padding:.35rem .45rem;";
    seedIn.onchange = function () { model.seed = seedIn.value.trim(); save(); };
    seedIn.onclick = function (e) { e.stopPropagation(); };
    seedRow.appendChild(seedLab); seedRow.appendChild(seedIn);
    container.appendChild(seedRow);
    // preview
    var pvLab = document.createElement("div");
    pvLab.style.cssText = "font-size:.76rem; color:#d8d2ea;";
    pvLab.textContent = "What will be sent (uses your Description as the subject):";
    var pv = document.createElement("textarea");
    pv.id = "dragonMixPreview"; pv.readOnly = true; pv.rows = 3;
    tag(pv);
    pv.style.cssText = "width:100%; box-sizing:border-box; background:#0f0f15; border:1px solid #4a4a58; border-radius:8px; color:#e8e6ee; font-size:.74rem; padding:.4rem .5rem;";
    pv.onclick = function (e) { e.stopPropagation(); };
    var nv = document.createElement("textarea");
    nv.id = "dragonMixNeg"; nv.readOnly = true; nv.rows = 2;
    tag(nv);
    nv.style.cssText = pv.style.cssText;
    nv.onclick = function (e) { e.stopPropagation(); };
    container.appendChild(pvLab); container.appendChild(pv); container.appendChild(nv);
    // go row + status
    var goRow = document.createElement("div");
    goRow.style.cssText = "display:flex; gap:.4rem; align-items:center; flex-wrap:wrap;";
    var go = mkBtn("\u2728 Generate mix", function () {
      if (model.technique === "pixel") pixelMix(); else fireMix();
    }, true);
    go.id = "dragonMixGo";
    var st = document.createElement("span");
    st.id = "dragonMixStatus";
    st.style.cssText = "font-size:.76rem; color:#c9b8ff;";
    st.textContent = "Ready";
    goRow.appendChild(go); goRow.appendChild(st);
    container.appendChild(goRow);
    // saved mixes
    var mixLab = document.createElement("div");
    mixLab.style.cssText = "font-size:.78rem; color:#d8d2ea;";
    mixLab.textContent = "Saved mixes:";
    var mixRow = document.createElement("div");
    mixRow.style.cssText = "display:flex; gap:.35rem; align-items:center;";
    var mixName = document.createElement("input");
    tag(mixName);
    mixName.placeholder = "mix name \u2014 e.g. Anime x Cinematic";
    mixName.style.cssText = "flex:1; min-width:6rem; background:#0f0f15; border:1px solid #4a4a58; border-radius:8px; color:#e8e6ee; font-size:.78rem; padding:.35rem .45rem;";
    mixName.onclick = function (e) { e.stopPropagation(); };
    var saveB = mkBtn("\uD83D\uDCBE Save current", function () {
      var list = loadMixes();
      var nm = mixName.value.trim() || (model.slots.map(function (s) { return s.name; }).join(" x ") + " \u00B7 " + model.technique);
      list.unshift({ id: "mix" + Date.now().toString(36), name: nm, ts: Date.now(), technique: model.technique,
        slots: JSON.parse(JSON.stringify(model.slots)), blendMode: model.blendMode, blendOpacity: model.blendOpacity, applyNeg: model.applyNeg });
      while (list.length > 30) list.pop();
      lsSet(LS_MIXES, JSON.stringify(list));
      mixName.value = "";
      drawMixes(mixList);
      toast("mix saved");
    }, false);
    mixRow.appendChild(mixName); mixRow.appendChild(saveB);
    var mixList = document.createElement("div");
    mixList.style.cssText = "display:flex; flex-direction:column; gap:.25rem;";
    container.appendChild(mixLab); container.appendChild(mixRow); container.appendChild(mixList);
    drawMixes(mixList);
    drawBlend();
    refreshPreview();
    try {
      var d = descEl();
      if (d && !d.__dragonMixHook) { d.__dragonMixHook = true; d.addEventListener("input", function () { try { refreshPreview(); } catch (e) {} }); }
    } catch (e) {}
  }
  ;function loadMixes() {
    try { var l = JSON.parse(lsGet(LS_MIXES, "[]")); return Array.isArray(l) ? l : []; } catch (e) { return []; }
  }
  ;function drawMixes(host) {
    host.innerHTML = "";
    var list = loadMixes();
    if (!list.length) {
      var em = document.createElement("div");
      em.style.cssText = "font-size:.74rem; color:#9d9ab5;";
      em.textContent = "no saved mixes yet";
      host.appendChild(em);
      return;
    }
    list.forEach(function (m) {
      var row = document.createElement("div");
      row.style.cssText = "display:flex; gap:.35rem; align-items:center;";
      var tx = document.createElement("span");
      tx.style.cssText = "flex:1; font-size:.76rem; color:#e8e3f5; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;";
      tx.textContent = m.name;
      tx.title = (m.slots || []).map(function (s) { return s.name + " x" + Number(s.weight || 1).toFixed(2); }).join(" + ");
      var load = mkBtn("\u25B6", function () {
        model.technique = m.technique || "fusion";
        model.slots = (m.slots || []).map(function (s) { return { name: s.name, weight: s.weight }; });
        if (m.blendMode) model.blendMode = m.blendMode;
        if (m.blendOpacity != null) model.blendOpacity = m.blendOpacity;
        if (m.applyNeg !== undefined) model.applyNeg = !!m.applyNeg;
        save(); built = false;
        var host2 = document.getElementById("dragonArtMixBody");
        if (host2) build(host2);
        toast("mix loaded: " + m.name);
      }, false);
      load.title = "load this mix";
      var del = mkBtn("\uD83D\uDDD1", function () {
        lsSet(LS_MIXES, JSON.stringify(loadMixes().filter(function (x) { return x.id !== m.id; })));
        drawMixes(host);
        toast("mix deleted");
      }, false);
      del.title = "delete this mix";
      row.appendChild(tx); row.appendChild(load); row.appendChild(del);
      host.appendChild(row);
    });
  }
  ;function drawBlend() {
    var row = document.getElementById("dragonMixBlend");
    if (!row) return;
    row.innerHTML = "";
    if (model.technique !== "pixel") { row.style.display = "none"; return; }
    row.style.display = "flex";
    var mLab = document.createElement("span"); mLab.textContent = "blend:"; mLab.style.cssText = "opacity:.8;";
    var mode = document.createElement("select");
    tag(mode);
    mode.style.cssText = "background:#0f0f15; border:1px solid #4a4a58; border-radius:8px; color:#e8e6ee; font-size:.76rem; padding:.3rem .4rem;";
    BLEND_MODES.forEach(function (m) {
      var o = document.createElement("option");
      o.value = m; o.textContent = m;
      mode.appendChild(o);
    });
    mode.value = model.blendMode;
    mode.onchange = function () { model.blendMode = mode.value; save(); };
    mode.onclick = function (e) { e.stopPropagation(); };
    var oLab = document.createElement("span"); oLab.textContent = "opacity:"; oLab.style.cssText = "opacity:.8;";
    var op = document.createElement("input");
    op.type = "range"; op.min = "0"; op.max = "1"; op.step = "0.05";
    tag(op);
    op.style.cssText = "flex:1 1 100px;";
    op.value = String(model.blendOpacity);
    var out = document.createElement("span");
    out.style.cssText = "min-width:2.4rem; text-align:right;";
    out.textContent = Math.round(model.blendOpacity * 100) + "%";
    op.oninput = function () { model.blendOpacity = clampNum(op.value, 0, 1, 0.6); out.textContent = Math.round(model.blendOpacity * 100) + "%"; save(); };
    op.onclick = function (e) { e.stopPropagation(); };
    row.appendChild(mLab); row.appendChild(mode); row.appendChild(oLab); row.appendChild(op); row.appendChild(out);
  }

  window.dragonArtMixBuild = build;
  try {
    // Self-heal for the script-order gap: the panel script loads BEFORE this one, so on a fresh
    // page load with mix persisted ON the panel may have shown an empty row — fill it now.
    var _row = document.getElementById("dragonArtMixBody");
    if (_row && _row.style.display !== "none" && !_row.children.length) build(_row);
  } catch (eSH) {}
  window.dragonArtMixDebug = function () {
    return { slots: model.slots, technique: model.technique,
      names: styleNames().length, noStyle: noStyleKey(),
      sufA: model.slots[0] ? suffixOf(model.slots[0].name).slice(0, 60) : "?" };
  };
})();
