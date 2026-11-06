// dragon-studio.js — Studio · 📕 Lookbook: same character, many poses, one fixed seed.
// Character + pose set (+optional outfits = poses x outfits matrix) -> one real framework
// tile per frame, so production cards, history, archive and tile actions all work natively.
// Parallel driver (all frames launch at once); frame generation mirrors dragon-art-styles runTest.
// Panel: accordion directly BELOW #dragonArtPanel. Rollback: delete this file + its script tag.
(function () {
  if (window.__dragonStudioInstalled) return;
  window.__dragonStudioInstalled = true;

  var LS_OPEN = "dragonStudioOpen", LS_CHAR = "dragonStudioChar", LS_SEED = "dragonStudioSeed",
      LS_NEG = "dragonStudioNeg", LS_PRIV = "dragonStudioPriv", LS_JOB = "dragonStudioJob",
      LS_POSES = "dragonStudioPoses", LS_OUTFITS = "dragonStudioOutfits";
  var PRIV_FOLDER = "studio";

  ;function toast(m) { try { if (window.dragonToast) window.dragonToast(m); } catch (e) {} }
  ;function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  ;function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  ;function q(s, r) { try { return (r || document).querySelector(s); } catch (e) { return null; } }
  ;function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  ;function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  var POSES_PORTRAIT = [
    "neutral expression, head straight, looking straight into the lens",
    "very slight closed-mouth smile, head straight, looking at the lens",
    "head turned 30 degrees to the left while the eyes stay on the lens",
    "head turned 30 degrees to the right while the eyes stay on the lens",
    "chin lowered slightly, eyes looking up to the lens",
    "eyes closed, calm relaxed expression",
    "one eyebrow slightly raised, half smile",
    "head tilted 15 degrees to the left with a soft smile"
  ];
  var POSES_HALF = [
    "standing straight, arms relaxed at the sides, looking at the lens",
    "standing with the weight on one leg, one hand on the hip, looking at the lens",
    "sitting on a wooden stool, hands on the knees, looking at the lens",
    "leaning back against a plain wall, arms crossed, looking at the lens",
    "crouching with the forearms on the knees, looking at the lens",
    "walking towards the camera, mid-step, looking at the lens",
    "turning to look over the shoulder, three-quarter view",
    "hands in the pockets, slight lean, looking at the lens"
  ];
  var POSES_FULL = [
    "standing straight, full body, arms relaxed, looking at the lens",
    "standing with one hand in a pocket, weight on one leg",
    "walking towards the camera, full body, mid-step",
    "sitting on a chair, legs crossed, full body, looking at the lens",
    "kneeling on one knee, full body, facing the camera",
    "crouching down, full body, looking at the lens"
  ];
  var POSES_TEST = POSES_PORTRAIT.concat([
    "left three-quarter profile, looking away from the camera",
    "right three-quarter profile, looking away from the camera",
    "looking up and to the left with a thoughtful expression",
    "looking down and to the right with a shy smile",
    "laughing, eyes slightly narrowed",
    "serious expression, jaw relaxed, staring at the lens",
    "one hand tucking the hair behind the ear",
    "hair falling forward over one shoulder, head straight",
    "wearing thin round metal glasses, head straight, looking at the lens",
    "hair tied back in a low loose ponytail with a few strands loose",
    "sitting on the floor with the knees drawn up, looking at the lens",
    "lying on the back with the head towards the camera, top-down view"
  ]);
  var PRESETS = [
    { name: "Portrait (8)", poses: POSES_PORTRAIT },
    { name: "Half body (8)", poses: POSES_HALF },
    { name: "Full body (6)", poses: POSES_FULL },
    { name: "Consistency test (20)", poses: POSES_TEST }
  ];
  var SHOOT = ", photorealistic amateur photograph, natural diffuse lighting, plain neutral background, natural bare skin texture, no beauty filter, sharp focus on the eyes";
  var EXTRA_NEG = "child, teenager, underage, minor, cartoon, anime, drawing, illustration, painting, 3d render, cgi, plastic skin, blurry, low quality, worst quality, deformed face, distorted face, asymmetric eyes, extra fingers, extra limbs";
  var RAND = {
    age: ["24-year-old", "27-year-old", "31-year-old", "35-year-old"],
    build: ["slim", "athletic", "curvy"],
    hair: ["long wavy auburn hair with a centre part", "shoulder-length straight black hair", "long curly dark brown hair", "short blonde bob"],
    eyes: ["hazel-green eyes", "deep brown eyes", "grey-blue eyes", "dark green eyes"],
    skin: ["fair freckled skin", "warm olive skin", "fair skin with a warm undertone", "deep brown skin"],
    top: ["cream knit sweater", "white linen shirt", "dark green blouse", "grey hoodie"]
  };
  ;function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  var st = { poses: [], outfits: [] };
  // Egon 11.10.2026 — fresh panel opens with the 6 full-body poses (only when the user never
  // saved a list: an explicitly emptied list stays empty).
  var _rawPoses = lsGet(LS_POSES, null);
  try { st.poses = _rawPoses == null ? POSES_FULL.slice() : (JSON.parse(_rawPoses) || []); } catch (e) { st.poses = POSES_FULL.slice(); }
  try { st.outfits = JSON.parse(lsGet(LS_OUTFITS, "[]")) || []; } catch (e) { st.outfits = []; }
  var job = null, raceTiles = [];
  try { job = JSON.parse(lsGet(LS_JOB, "null")); } catch (e) { job = null; }
  if (job && job.done) job = null;

  ;function saveJob() { try { lsSet(LS_JOB, job ? JSON.stringify(job) : "null"); } catch (e) {} }
  ;function charText() { var el = document.getElementById("dragonStudioChar"); return el ? el.value.trim() : lsGet(LS_CHAR, ""); }
  ;function negText() {
    var el = document.getElementById("dragonStudioNeg");
    var v = el ? el.value.trim() : lsGet(LS_NEG, "");
    return v || null;
  }
  ;function seedVal() {
    var el = document.getElementById("dragonStudioSeed");
    var v = el ? el.value.trim() : lsGet(LS_SEED, "");
    if (!v) { v = String(Math.floor(Math.random() * 900000) + 100000); if (el) el.value = v; lsSet(LS_SEED, v); }
    return v;
  }
  ;function privOn() { var el = document.getElementById("dragonStudioPriv"); return el ? !!el.checked : lsGet(LS_PRIV, "0") === "1"; }
  ;function effNegative() {
    var base = negText();
    if (!base) { try { base = (window.input && window.input.negative) || ""; } catch (e) { base = ""; } }
    base = String(base || "").trim();
    return base ? base + ", " + EXTRA_NEG : EXTRA_NEG;
  }
  ;function compose(pose, outfit) {
    return charText() + ", " + pose + (outfit ? ", wearing " + outfit : "") + SHOOT;
  }
  ;function buildPlan(seed) {
    var plan = [], outfits = st.outfits.length ? st.outfits : [""];
    for (var i = 0; i < st.poses.length; i++) {
      for (var k = 0; k < outfits.length; k++) {
        plan.push({ prompt: compose(st.poses[i], outfits[k]), poseNo: (i + 1), outfit: outfits[k] || "" });
      }
    }
    for (var j = 0; j < plan.length; j++) plan[j].seed = seed;
    return plan;
  }
  ;function specText(plan, seed) {
    return "CHARACTER: " + charText() + "\nFRAMES: " + plan.length + " | SEED: " + seed +
      "\nNEGATIVE: " + effNegative() + "\nSHOOT: " + SHOOT +
      (st.outfits.length ? "\nOUTFITS: " + st.outfits.join(" / ") : "");
  }
  ;function busyNow() {
    try { if (window.dragonAnyNormalPending && window.dragonAnyNormalPending()) return true; } catch (e) {}
    try {
      var oa = document.getElementById("outputAreaEl");
      if (oa) {
        var ts = oa.querySelectorAll(".t2i-image-ctn");
        for (var i = 0; i < ts.length; i++) {
          var f = null;
          try { f = ts[i].querySelector("iframe"); } catch (eF) {}
          var o = null;
          try { o = f && f.textToImagePluginOutput; } catch (eO) {}
          if (!o || !o.dataUrl) return true;
        }
      }
    } catch (e2) {}
    return false;
  }
  ;function fwReady() {
    try {
      var s = window.___userSettings746291937;
      if (!s || !s.imageOptions || typeof s.imageOptions.createClone !== "object" && typeof s.imageOptions.createClone !== "function") {
        if (!s || !s.imageOptions || !s.imageOptions.createClone) return false;
      }
      return (typeof window.___textToImagePlugin746291937 === "function");
    } catch (e) { return false; }
  }
  ;function tilePx() {
    var px = "450px";
    try {
      if (window.dragonProdTilePx) px = String(window.dragonProdTilePx());
      else { var v = getComputedStyle(document.documentElement).getPropertyValue("--dragon-prod-tile").trim(); if (v) px = v; }
    } catch (e) {}
    if (px !== "100%" && !/^\d+px$/.test(px)) px = "450px";
    return px;
  }
  ;function setForm(desc, neg) {
    try { if (window.input) { window.input.description = desc; window.input.negative = neg; } } catch (e) {}
    try {
      var ta = q('textarea[data-name="description"]');
      if (ta) { ta.value = desc; ta.dispatchEvent(new Event("input", { bubbles: true })); }
    } catch (e2) {}
  }

  // ---- one frame: real framework tile, like runTest ----
  ;function fireFrame(item, label) {
    return new Promise(function (resolve) {
      var oa = document.getElementById("outputAreaEl");
      if (!oa) { resolve({ ok: false, error: "no output area" }); return; }
      var s = window.___userSettings746291937;
      if (!s || !s.imageOptions) { resolve({ ok: false, error: "framework not ready" }); return; }
      setForm(item.prompt, effNegative());
      var clone;
      try {
        var io = s.imageOptions;
        clone = io.createClone;
        clone.prompt = io.prompt.evaluateItem;
        clone.negativePrompt = io.negativePrompt.evaluateItem;
        if (io.saveTitle) clone.saveTitle = io.saveTitle.evaluateItem;
        clone.seed = Number(item.seed);
        try { if (item.gs != null) clone.guidanceScale = item.gs; } catch (eG) {}
      } catch (e) { resolve({ ok: false, error: "clone failed" }); return; }
      var html = null;
      try { html = String(window.___textToImagePlugin746291937(clone)); } catch (e2) { resolve({ ok: false, error: "tile failed" }); return; }
      if (!html) { resolve({ ok: false, error: "empty tile" }); return; }
      var ctn = document.createElement("div");
      ctn.className = "t2i-image-ctn dragon-tester-ctn";
      ctn.style.cssText = "margin:0.25rem; margin-bottom:0.6rem; position:relative; width:" + tilePx() + "; max-width:100%; border:1px solid rgba(155,107,255,.35); border-radius:10px; overflow:hidden; background:rgba(20,16,32,.5);";
      var lab = document.createElement("div");
      lab.className = "dragon-tester-label";
      lab.textContent = label;
      lab.style.cssText = "display:block; width:100%; box-sizing:border-box; text-align:center; margin-bottom:.3rem; padding:.15rem .5rem; font-size:.72rem; font-weight:bold; color:#d8c9ff; background:rgba(155,107,255,.14); border:1px solid rgba(155,107,255,.35); border-radius:8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;";
      ctn.appendChild(lab);
      try { ctn.insertAdjacentHTML("beforeend", html); } catch (eH) { resolve({ ok: false, error: "tile html" }); return; }
      try { var hf = ctn.querySelector("iframe"); if (hf) hf.style.setProperty("width", "100%", "important"); } catch (eW) {}
      var under = document.createElement("div");
      under.className = "t2i-under-each-image-ctn";
      ctn.appendChild(under);
      oa.appendChild(ctn);
      try { if (window.dragonTesterTileReady) window.dragonTesterTileReady(ctn); } catch (eT) {}
      var n = 0;
      var iv = setInterval(function () {
        n++;
        var url = null, used = null;
        try {
          var f = ctn.querySelector("iframe");
          var o = f && f.textToImagePluginOutput;
          if (o && o.dataUrl) { url = o.dataUrl; used = (o.seedUsed != null ? o.seedUsed : (o.inputs && o.inputs.seed)); }
        } catch (eR) {}
        if (url || n > 360) {
          clearInterval(iv);
          if (url) resolve({ ok: true, url: url, seedUsed: used, tile: ctn });
          else resolve({ ok: false, error: "timeout", tile: ctn });
        }
      }, 500);
    });
  }
  ;function privSave(url, item) {
    if (!privOn()) return Promise.resolve(false);
    return fetch(url).then(function (r) { return r.blob(); }).then(function (blob) {
      if (!window.t2i_privateGallery || !window.t2i_privateGallery.add) throw new Error("no gallery");
      return window.t2i_privateGallery.add(blob, {
        folder: PRIV_FOLDER,
        info: { prompt: item.prompt, negativePrompt: effNegative(), seed: item.seed, guidanceScale: item.gs != null ? item.gs : null }
      });
    }).then(function () { return true; }).catch(function () { return false; });
  }

  // ---- parallel driver (Egon 11.10.2026): every frame launches at once, each a real
  // framework tile. fireFrame's setForm+clone is fully synchronous, so launching in one loop
  // gives every tile its own prompt/seed; history/overlay read each tile's own data (never the
  // shared form), so parallel frames stay correct.
  ;function jobRecorded(j) { var n = 0; for (var i = 0; i < j.plan.length; i++) if (j.plan[i].done) n++; return n; }
  ;function launchFrame(j, i) {
    var item = j.plan[i];
    var t0 = Date.now();
    fireFrame(item, "🎭 Studio " + (i + 1) + "/" + j.plan.length).then(function (res) {
      if (job !== j) return; // superseded by a newer job
      if (res.ok) {
        j.times.push(Date.now() - t0);
        item.done = true;
        if (!j.shots.some(function (s) { return s.prompt === item.prompt; }))
          j.shots.push({ url: res.url, prompt: item.prompt, seed: (res.seedUsed != null ? res.seedUsed : item.seed) });
        privSave(res.url, item).then(function () { settleFrame(j, null); });
        return;
      }
      settleFrame(j, (item.poseNo || "") + ": " + String(res.error || "failed").slice(0, 120));
    }).catch(function (e) { if (job === j) settleFrame(j, String((e && e.message) || e).slice(0, 120)); });
  }
  ;function settleFrame(j, err) {
    if (job !== j) return;
    if (err) j.errors.push(err);
    j.idx = jobRecorded(j); saveJob(); renderProgress();
    if (jobRecorded(j) >= j.plan.length) { finishJob(); return; }
    setStatus((j.cancelled ? "⏹ stopping… " : "⏳ ") + j.idx + "/" + j.plan.length + " frames done…");
  }
  ;function driver() {
    if (!job || job.cancelled || job.done) return;
    var launched = false;
    for (var i = 0; i < job.plan.length; i++) {
      if (!job.plan[i].done) { launchFrame(job, i); launched = true; }
    }
    if (!launched) finishJob();
    else setStatus("⏳ 0/" + job.plan.length + " frames done, all generating…");
  }
  ;function finishJob() {
    if (!job) return;
    job.done = true; saveJob(); restoreForm(); renderProgress(); renderResume(); setRunning(false);
    var msg = job.cancelled ? "⏹ stopped" : "✅ done";
    setStatus(msg + ": " + job.shots.length + "/" + job.plan.length + " frames" +
      (job.errors.length ? " · " + job.errors.length + " errors" : "") + ". Cards are in the gallery below; history updated.");
    try { if (window.dragonToast) window.dragonToast(msg + " — 🎭 Studio: " + job.shots.length + "/" + job.plan.length); } catch (e) {}
    renderSheetBtn();
  }
  var savedForm = null;
  ;function stashForm() {
    savedForm = null;
    try {
      var ta = q('textarea[data-name="description"]');
      savedForm = { d: (window.input ? window.input.description : (ta ? ta.value : "")), n: (window.input ? window.input.negative : "") };
    } catch (e) {}
  }
  ;function restoreForm() {
    if (!savedForm) return;
    try { setForm(savedForm.d || "", savedForm.n || ""); } catch (e) {}
    savedForm = null;
  }
  ;function readGs() {
    var g = null;
    try {
      var s = window.___userSettings746291937;
      if (s && s.imageOptions) {
        var io = s.imageOptions;
        try { g = io.guidanceScale != null ? io.guidanceScale : (io.gscale != null ? io.gscale : null); } catch (e) {}
      }
    } catch (e2) {}
    return (typeof g === "number") ? g : null;
  }
  // Egon 11.10.2026 — the framework's "Add a description…" empty-state line stays above the
  // tiles, so the Studio clears that exact hint (scoped to the output area) when it produces.
  ;function clearEmptyHint() {
    try {
      var oa = document.getElementById("outputAreaEl");
      if (!oa) return;
      var kids = oa.children;
      for (var i = kids.length - 1; i >= 0; i--) {
        if (kids[i].tagName === "SPAN" && /^Add a description/i.test(kids[i].textContent.trim())) kids[i].remove();
      }
    } catch (e) {}
  }
  window.dragonStudioProduce = function () {
    if (job && !job.done && !job.cancelled) { toast("Studio is already running"); return false; }
    if (!charText()) { toast("✏️ describe the character first"); return false; }
    if (!st.poses.length) { toast("add at least one pose"); return false; }
    if (!fwReady()) { toast("⚠️ image engine isn't ready yet — try again in a second"); return false; }
    if (busyNow()) { toast("⏳ wait for the current generation to finish first"); return false; }
    var seed = seedVal();
    lsSet(LS_SEED, seed);
    var gs = readGs();
    var plan = buildPlan(seed);
    if (gs != null) for (var i = 0; i < plan.length; i++) plan[i].gs = gs;
    if (!plan.length) { toast("nothing to produce"); return false; }
    stashForm();
    clearEmptyHint();
    job = { id: uid(), seed: seed, plan: plan, idx: 0, times: [], errors: [], shots: [], startedAt: Date.now(), done: false, cancelled: false };
    job.spec = specText(plan, seed);
    saveJob(); renderProgress(); renderResume(); renderSheetBtn(); setRunning(true); driver();
    return true;
  };
  window.dragonStudioStop = function () { if (job && !job.done) { job.cancelled = true; saveJob(); setStatus("⏹ stopping after these frames…"); } };

  // ---- reload resume: match finished frames back from history (order-free: parallel frames
  // can complete in any order) ----
  ;function recoverShots() {
    if (!job || job.done) return 0;
    var all = [];
    try { all = window.dragonHistGetAll ? window.dragonHistGetAll() : []; } catch (e) {}
    var found = 0;
    for (var i = 0; i < job.plan.length; i++) {
      var it = job.plan[i];
      if (it.done) { found++; continue; }
      var hit = null;
      for (var k = 0; k < all.length; k++) {
        var en = all[k] || {};
        var p = String(en.p || en.prompt || "");
        if (p.indexOf(it.prompt.slice(0, 60)) === 0 && String(en.seed) === String(it.seed)) { hit = en; break; }
      }
      if (hit) {
        var url = hit.full || hit.thumb || "";
        it.done = true;
        if (url && !job.shots.some(function (s) { return s.prompt === it.prompt; })) job.shots.push({ url: url, prompt: it.prompt, seed: it.seed });
        found++;
      }
    }
    job.idx = found;
    var timedOut = false;
    try { timedOut = (Date.now() - (job.startedAt || 0)) > 30 * 60 * 1000; } catch (eT) {}
    if (timedOut) { job.done = true; }
    saveJob();
    return found;
  }

  // ---- seed race (headless, no cards) ----
  window.dragonStudioRace = function (count) {
    raceTiles = []; renderRace();
    if (!charText()) { toast("✏️ describe the character first"); return false; }
    if (!window.dragonEmbedGenerate) { toast("⚠️ embed engine isn't ready"); return false; }
    var n = Math.max(2, Math.min(8, Number(count) || 5));
    var pose = st.poses.length ? st.poses[0] : POSES_PORTRAIT[0];
    var seeds = [];
    for (var i = 0; i < n; i++) seeds.push(Math.floor(Math.random() * 900000) + 100000);
    setStatus("🏁 racing " + n + " seeds on pose #1…");
    setRunning(true);
    var done = 0;
    seeds.forEach(function (sd) {
      var prompt = compose(pose, "");
      window.dragonEmbedGenerate({ prompt: prompt, seed: sd, negativePrompt: effNegative() }).then(function (res) {
        done++;
        if (res && res.ok) raceTiles.push({ url: res.dataUrl, seed: (res.seedUsed != null ? res.seedUsed : sd), prompt: prompt });
        if (done >= n) { setRunning(false); setStatus("🏁 race done — tap a tile to lock its seed, 💾 to keep it to history."); renderRace(); }
        else renderRace();
      }).catch(function () { done++; if (done >= n) { setRunning(false); renderRace(); } });
    });
    return true;
  };

  // ---- AI character card ----
  window.dragonStudioAiCard = function () {
    var ta = document.getElementById("dragonStudioChar");
    var cur = ta ? ta.value.trim() : "";
    if (!cur) { toast("✏️ type a rough idea first"); return false; }
    if (!window.root || typeof window.root.generateText !== "function") { toast("AI helper isn't ready yet"); return false; }
    setStatus("📇 writing character card…");
    setRunning(true);
    var acc = "";
    try {
      var obj = window.root.generateText({ instruction: "Write ONE concise, stable English text-to-image character description (2-4 sentences): age range, hair, build, 2-4 fixed facial marks, plain neutral clothing. No pose, no background, no camera. Base it on this idea: " + cur });
      Promise.resolve(obj).then(function (fin) {
        try {
          if (fin && typeof fin === "object" && fin.text) acc = fin.text;
          else if (typeof fin === "string" && fin) acc = fin;
        } catch (e) {}
        acc = String(acc || "").trim();
        if (acc && ta) { ta.value = acc; lsSet(LS_CHAR, acc); }
        setRunning(false);
        setStatus(acc ? "📇 card ready — review it, then produce." : "⚠️ empty answer — try again.");
      }).catch(function () { setRunning(false); setStatus("⚠️ card failed — try again."); });
    } catch (e) { setRunning(false); setStatus("⚠️ card failed — try again."); return false; }
    return true;
  };
  window.dragonStudioRandomChar = function () {
    var t = pick(RAND.age) + " woman, " + pick(RAND.hair) + ", " + pick(RAND.eyes) + ", " + pick(RAND.skin) + ", " + pick(RAND.top) + ", " + pick(RAND.build) + " build";
    var ta = document.getElementById("dragonStudioChar");
    if (ta) ta.value = t;
    lsSet(LS_CHAR, t);
    return true;
  };

  // ---- contact sheet ----
  ;function sheetCanvas(list, cb) {
    var imgs = [];
    var want = list.slice(0, 24);
    if (!want.length) { cb(null); return; }
    var loaded = 0;
    want.forEach(function (fr, i) {
      var im = new Image();
      im.onload = function () { imgs[i] = im; if (++loaded >= want.length) draw(); };
      im.onerror = function () { if (++loaded >= want.length) draw(); };
      try { im.src = fr.url; } catch (e) { if (++loaded >= want.length) draw(); }
    });
    ;function draw() {
      var cols = 2, cw = 512, ch = 768;
      var rows = Math.ceil(want.length / cols);
      var cv = document.createElement("canvas");
      cv.width = cols * cw; cv.height = rows * ch + 60;
      var g = cv.getContext("2d");
      g.fillStyle = "#101018"; g.fillRect(0, 0, cv.width, cv.height);
      g.fillStyle = "#e8e3f5"; g.font = "bold 28px system-ui";
      try { g.fillText("🎭 Studio · seed " + ((job && job.seed) || "") + " · " + want.length + " frames", 20, 38); } catch (e) {}
      for (var i = 0; i < want.length; i++) {
        if (!imgs[i]) continue;
        var x = (i % cols) * cw, y = 60 + Math.floor(i / cols) * ch;
        try { g.drawImage(imgs[i], x, y, cw, ch); } catch (e2) {}
      }
      cb(cv);
    }
  }
  window.dragonStudioSheet = function (toHistory) {
    var list = (job && job.shots && job.shots.length) ? job.shots : [];
    if (!list.length) { toast("nothing to sheet yet"); return false; }
    setStatus("📊 building contact sheet…");
    sheetCanvas(list, function (cv) {
      if (!cv) { setStatus("⚠️ sheet failed"); return; }
      var url = "";
      try { url = cv.toDataURL("image/jpeg", 0.85); } catch (e) { setStatus("⚠️ sheet failed"); return; }
      var host = document.getElementById("dragonStudioSheet");
      if (host) {
        host.innerHTML = "";
        var im = document.createElement("img");
        im.src = url;
        im.style.cssText = "max-width:100%; border-radius:8px; border:1px solid rgba(122,77,255,.4);";
        var dl = document.createElement("a");
        dl.href = url; dl.download = "studio-contact-" + ((job && job.seed) || "x") + ".jpg";
        dl.textContent = "⬇️ download contact sheet";
        dl.style.cssText = "display:inline-block; margin-top:.4rem; color:#d8c9ff;";
        host.appendChild(im); host.appendChild(document.createElement("br")); host.appendChild(dl);
      }
      if (toHistory && window.dragonHistAddImage) {
        try { window.dragonHistAddImage({ dataUrl: url, prompt: "🎭 Studio contact sheet (" + list.length + " frames, seed " + ((job && job.seed) || "") + ")", seed: (job && job.seed) || "" }); } catch (e2) {}
      }
      setStatus("📊 contact sheet ready.");
    });
    return true;
  };

  // ================= panel =================
  var panel = null, bodyEl = null, open = false;
  // Framework init walks every input/select/textarea in the input container and
  // crashes on one with no data-name, so every control here carries data-name="".
  ;function tagFramework() {
    try {
      if (!panel) return;
      var els = panel.querySelectorAll("input,textarea,select");
      for (var i = 0; i < els.length; i++) { try { els[i].dataset.name = ""; } catch (e) {} }
      var uis = window.___userSettings746291937 && window.___userSettings746291937.userInputs;
      if (uis && !uis[""]) uis[""] = { excludeFromShareLink: true };
    } catch (e2) {}
  }
  ;function setRunning(on) { var e = document.getElementById("dragonStudioStatus"); if (e) { try { if (on) e.classList.add("running"); else e.classList.remove("running"); } catch (e2) {} } }
  ;function setStatus(t) { var e = document.getElementById("dragonStudioStatus"); if (e) e.innerHTML = t; }
  ;function syncOpen() {
    open = lsGet(LS_OPEN, "0") === "1";
    if (bodyEl) bodyEl.style.display = open ? "flex" : "none";
    var h = document.getElementById("dragonStudioHead");
    if (h) { var as = h.querySelectorAll("[data-arr]"); for (var ai = 0; ai < as.length; ai++) as[ai].textContent = open ? "▴" : "▾"; h.setAttribute("aria-expanded", open ? "true" : "false"); }
  }
  window.dragonStudioOpen = function (v) { lsSet(LS_OPEN, (v === undefined ? !open : !!v) ? "1" : "0"); syncOpen(); };
  ;function renderProgress() {
    var bar = document.getElementById("dragonStudioBar");
    var tx = document.getElementById("dragonStudioProg");
    if (!job) { if (bar) bar.style.width = "0%"; if (tx) tx.textContent = ""; return; }
    var pct = job.plan.length ? Math.round(job.idx / job.plan.length * 100) : 0;
    if (bar) bar.style.width = pct + "%";
    if (tx) tx.textContent = job.idx + "/" + job.plan.length + (job.errors.length ? " · " + job.errors.length + " errors" : "");
    var el = document.getElementById("dragonStudioErrs");
    if (el) el.innerHTML = job.errors.length ? job.errors.map(function (e) { return "<div>⚠️ " + esc(e) + "</div>"; }).join("") : "";
  }
  ;function renderResume() {
    var b = document.getElementById("dragonStudioResume");
    if (!b) return;
    var show = !!(job && !job.done && (job.cancelled || job.idx > 0));
    b.style.display = show ? "" : "none";
    if (show) b.textContent = "⏵ Resume (" + job.idx + "/" + job.plan.length + ")";
  }
  ;function renderSheetBtn() {
    var b = document.getElementById("dragonStudioSheetBtn");
    if (!b) return;
    b.style.display = (job && job.shots.length) ? "" : "none";
  }
  ;function renderRace() {
    var host = document.getElementById("dragonStudioRace");
    if (!host) return;
    host.innerHTML = "";
    raceTiles.forEach(function (t) {
      var w = document.createElement("div");
      w.style.cssText = "position:relative; width:108px; cursor:pointer;";
      var im = document.createElement("img");
      im.src = t.url;
      im.title = "tap to lock seed " + t.seed;
      im.style.cssText = "width:108px; height:162px; object-fit:cover; border-radius:8px; border:2px solid " + (String(seedVal()) === String(t.seed) ? "#2fae6b" : "rgba(122,77,255,.4)") + ";";
      im.onclick = function () {
        var si = document.getElementById("dragonStudioSeed");
        if (si) si.value = String(t.seed);
        lsSet(LS_SEED, String(t.seed));
        toast("🔒 seed " + t.seed);
        renderRace();
      };
      var sv = document.createElement("button");
      sv.type = "button"; sv.textContent = "💾";
      sv.title = "keep to history";
      sv.style.cssText = "position:absolute; right:2px; bottom:2px; width:1.9rem; height:1.9rem; border-radius:50%; border:1px solid #6a6a78; background:rgba(20,20,28,.85); cursor:pointer;";
      sv.onclick = function (ev) {
        ev.stopPropagation();
        try { if (window.dragonHistAddImage) window.dragonHistAddImage({ dataUrl: t.url, prompt: t.prompt, seed: String(t.seed) }); toast("💾 kept to history"); } catch (e) {}
      };
      var cap = document.createElement("div");
      cap.textContent = "seed " + t.seed;
      cap.style.cssText = "font-size:.68rem; color:#9d9ab5; text-align:center;";
      w.appendChild(im); w.appendChild(sv); w.appendChild(cap);
      host.appendChild(w);
    });
  }
  ;function renderPoses() {
    var host = document.getElementById("dragonStudioPoses");
    if (!host) return;
    host.innerHTML = "";
    st.poses.forEach(function (p, i) {
      var row = document.createElement("div");
      row.style.cssText = "display:flex; gap:.35rem; align-items:center; padding:.15rem 0; font-size:.78rem;";
      var n = document.createElement("span");
      n.textContent = (i + 1) + ".";
      n.style.cssText = "flex:0 0 auto; color:#9d9ab5; min-width:1.2rem; text-align:right;";
      // Egon 11.10.2026 — like agenty, every pose has its own text field: editable, saved on change.
      var inp = document.createElement("input");
      inp.type = "text"; inp.value = p; inp.setAttribute("data-name", "");
      inp.style.cssText = "flex:1; min-width:0; box-sizing:border-box; background:var(--dt-bg2,#0f0f15); border:1px solid var(--dt-border,#4a4a58); border-radius:8px; color:var(--dt-fg,#e8e6ee); font-size:.78rem; padding:.35rem .5rem;";
      inp.addEventListener("change", function () {
        st.poses[i] = inp.value.trim() || st.poses[i];
        inp.value = st.poses[i];
        lsSet(LS_POSES, JSON.stringify(st.poses));
      });
      var x = document.createElement("button");
      x.type = "button"; x.textContent = "✖"; x.title = "remove";
      x.style.cssText = "border:1px solid #6a6a78; background:transparent; color:#ccc; border-radius:6px; cursor:pointer; min-width:1.8rem; min-height:1.8rem;";
      x.onclick = function () { st.poses.splice(i, 1); lsSet(LS_POSES, JSON.stringify(st.poses)); renderPoses(); };
      row.appendChild(n); row.appendChild(inp); row.appendChild(x);
      host.appendChild(row);
    });
    var c = document.getElementById("dragonStudioCount");
    if (c) c.textContent = st.poses.length + " poses" + (st.outfits.length ? " × " + st.outfits.length + " outfits = " + (st.poses.length * st.outfits.length) + " frames" : " = " + st.poses.length + " frames");
  }
  ;function renderOutfits() {
    var host = document.getElementById("dragonStudioOutfits");
    if (!host) return;
    host.innerHTML = "";
    st.outfits.forEach(function (o, i) {
      var row = document.createElement("div");
      row.style.cssText = "display:flex; gap:.35rem; align-items:center; padding:.1rem 0; font-size:.78rem;";
      var tx = document.createElement("span");
      tx.textContent = o; tx.style.cssText = "flex:1; color:#d8d2ea;";
      var x = document.createElement("button");
      x.type = "button"; x.textContent = "✖"; x.title = "remove";
      x.style.cssText = "border:1px solid #6a6a78; background:transparent; color:#ccc; border-radius:6px; cursor:pointer; min-width:1.8rem; min-height:1.8rem;";
      x.onclick = function () { st.outfits.splice(i, 1); lsSet(LS_OUTFITS, JSON.stringify(st.outfits)); renderOutfits(); renderPoses(); };
      row.appendChild(tx); row.appendChild(x);
      host.appendChild(row);
    });
  }
  ;function renderPresets() {
    var host = document.getElementById("dragonStudioPresets");
    if (!host) return;
    host.innerHTML = "";
    PRESETS.forEach(function (pr) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = pr.name;
      b.style.cssText = "padding:.35rem .55rem; border:1px solid #5a5a6a; background:linear-gradient(145deg,#2a2a33,#17171c); color:#ddd; border-radius:8px; cursor:pointer; font-size:.76rem;";
      b.onclick = function () {
        st.poses = pr.poses.slice();
        lsSet(LS_POSES, JSON.stringify(st.poses));
        renderPoses();
      };
      host.appendChild(b);
    });
  }

  ;function css() {
    return "#dragonStudioPanel{width:100%;margin-top:0;margin-bottom:-4px;}"
      // Egon 29.10.2026 (A3) — the head must read purple like the Art Style head:
      // the gradient carries the same #9b6bff the check-up looks for.
      + "#dragonStudioHead{width:100%;box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:.45rem;padding:.35rem .4rem;font-size:.85rem;font-weight:bold;line-height:1;border-radius:8px;cursor:pointer;flex-wrap:wrap;color:var(--dt-fg,#e6dcff);border:1px solid rgba(155,107,255,.55);background:linear-gradient(180deg,#2a1d52,#9b6bff);}"
      + "#dragonStudioBody{display:none;flex-direction:column;gap:.4rem;width:100%;box-sizing:border-box;margin-top:0;padding:.45rem;border-radius:14px;border:1px solid rgba(155,107,255,.3);background:linear-gradient(180deg,var(--dt-panel1,#15151d),var(--dt-bg,#0e0e13));}"
      + "#dragonStudioPanel textarea,#dragonStudioPanel input[type=text],#dragonStudioPanel input:not([type]){width:100%;box-sizing:border-box;background:var(--dt-bg2,#0f0f15);border:1px solid var(--dt-border,#4a4a58);border-radius:8px;color:var(--dt-fg,#e8e6ee);font-size:.8rem;padding:.45rem .55rem;}"
      + "#dragonStudioPanel label{font-size:.8rem;color:var(--dt-fg,#d8d2ea);display:block;margin-bottom:.15rem;}"
      + ".dragon-studio-row{display:flex;flex-wrap:wrap;gap:.4rem;align-items:center;}"
      + ".dragon-studio-btn{font-size:.76rem;font-weight:bold;padding:.32rem .6rem;border-radius:9px;cursor:pointer;white-space:nowrap;border:1px solid var(--dt-chipbd,#6a6a86);background:linear-gradient(180deg,var(--dt-btn1,#2a2a35),var(--dt-btn2,#16161d));color:var(--dt-fg,#dcd8ee);}"
      + ".dragon-studio-go{border-color:var(--dt-accent,#9b6bff);background:linear-gradient(180deg,#4a3a8a,#2a1d52);color:#fff;}"
      + ".dragon-studio-stop{border-color:#b82a2a;background:linear-gradient(180deg,#7d1a1a,#451010);color:#ffd4d4;}"
      + ".dragon-studio-tab[aria-pressed=\"true\"]{border-color:var(--dt-accent,#9b6bff);background:linear-gradient(180deg,#4a3a8a,#2a1d52);color:#fff;}"
      + "@keyframes dragonStudioPulse{0%,100%{opacity:1}50%{opacity:.4}}"
      + "#dragonStudioBarWrap{height:.5rem;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden;}"
      + "#dragonStudioBar{height:100%;width:0%;background:linear-gradient(90deg,#7a4dff,#2fae6b);}"
      + "#dragonStudioStatus{font-size:.78rem;color:#c9b8ff;min-height:1.1rem;}"
      + "#dragonStudioStatus.running{animation:dragonStudioPulse 1s infinite;}"
      + "#dragonStudioPoses,#dragonStudioOutfits{max-height:9rem;overflow-y:auto;border:1px solid var(--dt-border,#4a4a58);border-radius:8px;padding:.3rem .5rem;}"
      + "#dragonStudioRace{display:flex;flex-wrap:wrap;gap:.45rem;}"
      + "#dragonStudioErrs{font-size:.74rem;color:#ff9d9d;max-height:5rem;overflow-y:auto;}";
  }
  ;function build() {
    var host = document.getElementById("userInputsCtn8462746262");
    if (!host) return false;
    if (document.getElementById("dragonStudioPanel")) return true;
    var sty = document.createElement("style");
    sty.textContent = css();
    document.head.appendChild(sty);
    panel = document.createElement("div");
    panel.id = "dragonStudioPanel";
    var head = document.createElement("button");
    head.type = "button";
    head.id = "dragonStudioHead";
    ;function headSpan(txt, arr, mirror) {
      var s = document.createElement("span");
      s.textContent = txt;
      if (arr) s.setAttribute("data-arr", "1"); else s.setAttribute("aria-hidden", "true");
      s.style.cssText = "display:inline-block;flex:0 0 auto;font-size:1rem;line-height:1;" + (arr ? "font-size:1.1rem;" : "") + (mirror ? "transform:scaleX(-1);" : "");
      return s;
    }
    head.append(headSpan("🎭", false, false), headSpan("▾", true, false), (function () { var l = document.createElement("span"); l.textContent = "Studio"; return l; })(), headSpan("▾", true, false), headSpan("🎭", false, true));
    head.onclick = function () { window.dragonStudioOpen(); };
    // (Egon 22.10.2026: the "I'm HERE" badge is retired — controls are no longer marked.)
    bodyEl = document.createElement("div");
    bodyEl.id = "dragonStudioBody";
    bodyEl.innerHTML =
      "<div style='display:flex; gap:.4rem; margin-bottom:.35rem; justify-content:center; align-items:center; flex-wrap:wrap;'>"
      + "<button type='button' class='dragon-studio-btn dragon-studio-tab' id='dragonStudioTabLook' aria-pressed='true'>📕 Lookbook</button>"
      + "<button type='button' class='dragon-studio-btn dragon-studio-tab' id='dragonStudioTabAuto' aria-pressed='false'>AutoPilot</button></div>"
      + "<div id='dragonStudioLookbook'>"
      + "<div><label>Character (fixed for the whole set)</label><textarea id='dragonStudioChar' rows='3'></textarea>"
      + "<div class='dragon-studio-row' style='margin-top:.35rem;'><button type='button' class='dragon-studio-btn' id='dragonStudioDice'>🎲 Random</button>"
      + "<button type='button' class='dragon-studio-btn' id='dragonStudioCard'>📇 AI card</button></div></div>"
      + "<div><label>📕 Lookbook — pose sets</label><div class='dragon-studio-row' id='dragonStudioPresets'></div></div>"
      + "<div><label id='dragonStudioCount'></label><div id='dragonStudioPoses'></div>"
      + "<div class='dragon-studio-row' style='margin-top:.3rem;'><input id='dragonStudioPoseIn' type='text' placeholder='add a custom pose…' style='flex:1; min-width:8rem;'><button type='button' class='dragon-studio-btn' id='dragonStudioPoseAdd'>+ Pose</button></div></div>"
      + "<div><label>Outfits (optional — poses × outfits)</label><div id='dragonStudioOutfits'></div>"
      + "<div class='dragon-studio-row' style='margin-top:.3rem;'><input id='dragonStudioOutfitIn' type='text' placeholder='add an outfit…' style='flex:1; min-width:8rem;'><button type='button' class='dragon-studio-btn' id='dragonStudioOutfitAdd'>+ Outfit</button></div></div>"
      + "<div class='dragon-studio-row'><div style='flex:1; min-width:7rem;'><label>Seed (fixed)</label><input id='dragonStudioSeed' type='text'></div>"
      + "<div><label>&nbsp;</label><button type='button' class='dragon-studio-btn' id='dragonStudioRaceBtn'>🏁 Race</button></div></div>"
      + "<div id='dragonStudioRace'></div>"
      + "<div><label>Negative (fixed)</label><textarea id='dragonStudioNeg' rows='2'></textarea></div>"
      + "<div class='dragon-studio-row'><label style='display:flex; align-items:center; gap:.4rem; font-size:.8rem; color:#e8e3f5;'><input id='dragonStudioPriv' type='checkbox' style='width:auto;'> Save frames to Private Gallery (studio folder)</label></div>"
      + "<div class='dragon-studio-row'><button type='button' class='dragon-studio-btn dragon-studio-go' id='dragonStudioGo'>▶ Produce</button>"
      + "<button type='button' class='dragon-studio-btn dragon-studio-stop' id='dragonStudioStop'>⏹ Stop</button>"
      + "<button type='button' class='dragon-studio-btn' id='dragonStudioResume' style='display:none;'></button>"
      + "<button type='button' class='dragon-studio-btn' id='dragonStudioSpec'>📋 Spec</button>"
      + "<button type='button' class='dragon-studio-btn' id='dragonStudioSheetBtn' style='display:none;'>📊 Sheet</button></div>"
      + "<div id='dragonStudioBarWrap'><div id='dragonStudioBar'></div></div>"
      + "<div id='dragonStudioProg' style='font-size:.76rem; color:#9d9ab5;'></div>"
      + "<div id='dragonStudioStatus'></div><div id='dragonStudioErrs'></div><div id='dragonStudioSheet'></div>"
      + "</div>"
      + "<div id='dragonStudioAutopilot' style='display:none; padding:.6rem .4rem; font-size:.8rem; color:#9d9ab5; text-align:center;'>🤖 AutoPilot — coming soon. Code will move over from Egon's other generator.</div>";
    panel.appendChild(head);
    panel.appendChild(bodyEl);
    var art = document.getElementById("dragonArtPanel");
    if (art && art.parentNode === host) host.insertBefore(panel, art.nextSibling);
    else { var cp = host.querySelector(".dragon-control-panel"); if (cp) host.insertBefore(panel, cp); else host.appendChild(panel); }
    var che = document.getElementById("dragonStudioChar");
    if (che) { che.value = lsGet(LS_CHAR, ""); che.addEventListener("input", function () { lsSet(LS_CHAR, che.value); }); }
    var se = document.getElementById("dragonStudioSeed");
    if (se) { se.value = lsGet(LS_SEED, ""); se.addEventListener("input", function () { lsSet(LS_SEED, se.value); }); }
    var ne = document.getElementById("dragonStudioNeg");
    if (ne) {
      var nv = lsGet(LS_NEG, "");
      if (!nv) { try { nv = (window.input && window.input.negative) || ""; } catch (e) { nv = ""; } }
      ne.value = nv || "";
      ne.addEventListener("input", function () { lsSet(LS_NEG, ne.value); });
    }
    var pv = document.getElementById("dragonStudioPriv");
    if (pv) { pv.checked = lsGet(LS_PRIV, "0") === "1"; pv.addEventListener("change", function () { lsSet(LS_PRIV, pv.checked ? "1" : "0"); }); }
    var on = function (id, fn) { var e = document.getElementById(id); if (e) e.addEventListener("click", fn); };
    // Egon 11.10.2026 — Lookbook / AutoPilot tabs (the AutoPilot body fills in later).
    ;function setTab(which) {
      var look = which !== "auto";
      var L = document.getElementById("dragonStudioLookbook"), A = document.getElementById("dragonStudioAutopilot");
      var TL = document.getElementById("dragonStudioTabLook"), TA = document.getElementById("dragonStudioTabAuto");
      if (L) L.style.display = look ? "" : "none";
      if (A) A.style.display = look ? "none" : "";
      if (TL) TL.setAttribute("aria-pressed", look ? "true" : "false");
      if (TA) TA.setAttribute("aria-pressed", look ? "false" : "true");
    }
    window.dragonStudioTab = setTab;
    on("dragonStudioTabLook", function () { setTab("look"); });
    on("dragonStudioTabAuto", function () { setTab("auto"); });
    on("dragonStudioDice", function () { window.dragonStudioRandomChar(); });
    on("dragonStudioCard", function () { window.dragonStudioAiCard(); });
    on("dragonStudioGo", function () { window.dragonStudioProduce(); });
    on("dragonStudioStop", function () { window.dragonStudioStop(); });
    on("dragonStudioResume", function () {
      if (!job || job.done) return;
      job.cancelled = false; saveJob(); renderResume(); driver();
    });
    on("dragonStudioRaceBtn", function () { window.dragonStudioRace(5); });
    on("dragonStudioSheetBtn", function () { window.dragonStudioSheet(false); });
    on("dragonStudioSpec", function () {
      var seed = seedVal();
      var t = specText(buildPlan(seed), seed);
      try {
        if (window.dragonCopyText) window.dragonCopyText(t, "📋 spec copied");
        else if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { toast("📋 spec copied"); });
      } catch (e) {}
    });
    on("dragonStudioPoseAdd", function () {
      var i = document.getElementById("dragonStudioPoseIn");
      var v = i ? i.value.trim() : "";
      if (!v) return;
      st.poses.push(v); lsSet(LS_POSES, JSON.stringify(st.poses));
      if (i) i.value = "";
      renderPoses();
    });
    on("dragonStudioOutfitAdd", function () {
      var i = document.getElementById("dragonStudioOutfitIn");
      var v = i ? i.value.trim() : "";
      if (!v) return;
      st.outfits.push(v); lsSet(LS_OUTFITS, JSON.stringify(st.outfits));
      if (i) i.value = "";
      renderOutfits(); renderPoses();
    });
    renderPresets(); renderPoses(); renderOutfits(); renderProgress(); renderSheetBtn();
    tagFramework();
    if (job && !job.done && job.idx > 0) {
      var n = 0;
      try { n = recoverShots(); } catch (e) {}
      renderProgress(); renderResume();
      setStatus("🔄 recovered " + n + " frames from history — ⏵ Resume to continue.");
    } else renderResume();
    syncOpen();
    return true;
  }

  ;function place() {
    var host = document.getElementById("userInputsCtn8462746262");
    if (!host || !panel) return;
    var art = document.getElementById("dragonArtPanel");
    if (art && art.parentNode === host && art.nextSibling !== panel) {
      try { host.insertBefore(panel, art.nextSibling); } catch (e) {}
      return;
    }
    if (!art) {
      var cp = host.querySelector(".dragon-control-panel");
      if (cp && panel.nextSibling !== cp) { try { host.insertBefore(panel, cp); } catch (e2) {} }
    }
  }
  var tries = 0, placed = false, placeWatched = false;
  var boot = function () {
    if (build()) {
      place();
      try {
        if (!placeWatched) {
          placeWatched = true;
          var host = document.getElementById("userInputsCtn8462746262");
          if (host) new MutationObserver(function () { try { place(); } catch (e) {} }).observe(host, { childList: true });
        }
      } catch (eW) {}
      var art = document.getElementById("dragonArtPanel");
      placed = !!(art && art.nextSibling === panel);
      if (!placed && ++tries < 80) setTimeout(boot, 1000);
      return;
    }
    if (++tries < 80) setTimeout(boot, 500);
  };
  boot();
  window.dragonStudioBoot = boot;
})();
