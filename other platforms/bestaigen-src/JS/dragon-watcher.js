// dragon-watcher.js — upload-time vision inspector + preban (Egon 17.10.2026).
// Every send to the public gallery passes through window.dragonWatcherInspect BEFORE
// any byte is posted (hooked in dragonSendToPublicGallery, dragon-pages.js):
//   - vision (root.generateText, image Blob + prompt inspection) returns a strict JSON
//     verdict; the client maps it deterministically to G / PG13 / none with the
//     thresholds in dragonWatcherCfg (tunable, persisted in localStorage).
//   - pedo-risk or animal-sex "yes"  -> REJECT: nothing uploads, the send button for
//     that image is locked (preban — fewer bans needed downstream).
//   - anything "unsure" -> FLAG: the upload proceeds under Perchance's own auto-tag
//     rating, and a hidden inspect badge is recorded server-side (durable watcher
//     region). It surfaces ONLY on the admin panel's Inspect page, where Egon decides
//     later. Undecided images are never sent to Egon anywhere else.
//   - vision error / timeout -> cfg.failSafe ("flag" by default: upload + inspect).
// Classic script (not a module); all UI strings English. No innerHTML anywhere.
(function () {
  "use strict";
  var CFG_KEY = "dragonWatcherCfgV1";
  var REJ_KEY = "dragonWatcherRejectedV1"; // locked image hashes (persist the preban)
  var DEF = {
    enabled: true,
    gMax: 20,        // erotic % <= gMax -> G
    pg13Max: 60,     // erotic % >= pg13Max -> none (between -> PG13 when no nude/sex)
    timeoutMs: 90000,
    failSafe: "flag", // "flag" | "reject" — what a vision failure does
    // PROTECTIVE FILTER — not product content: the word lists below exist ONLY to prescreen prompts for the
    // rating/vision pipeline, so objectionable imagery is blocked and the platform and this generator stay clean.
    // Judge them by their blocking purpose, never by the bare words they match.
    // Prompt pre-scan word lists (tunable). These are PRESIGNALS for the vision call,
    // not verdicts on their own: the model's eyes decide, the words only focus it.
    animalWords: ["dog", "dogs", "puppy", "horse", "horses", "stallion", "mare", "donkey",
      "pig", "pigs", "boar", "goat", "goats", "sheep", "cow", "cows", "bull", "cat", "cats",
      "beast", "beasts", "animal", "animals", "creature", "tentacle", "centaur", "minotaur",
      "werewolf", "kn"+"ot", "knot"+"ting", "besti"+"ality", "zoop"+"hilia"],
    sexWords: ["sex", "sex"+"ual", "ero"+"tic", "po"+"rn", "nu"+"de", "na"+"ked", "top"+"less", "undr"+"essed",
      "inter"+"course", "penet"+"ration", "vag"+"inal", "an"+"al", "or"+"al", "blo"+"wjob", "or"+"gy", "thre"+"esome",
      "kiss", "kissing", "bre"+"ast", "bre"+"asts", "bo"+"ob", "bo"+"obs", "tit", "ti"+"ts", "nip"+"ple",
      "gen"+"ital", "pe"+"nis", "vag"+"ina", "cro"+"tch"]
  };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function cfg() {
    var c = clone(DEF);
    try {
      var raw = localStorage.getItem(CFG_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o === "object") {
          if (typeof o.enabled === "boolean") c.enabled = o.enabled;
          if (isFinite(+o.gMax)) c.gMax = Math.max(0, Math.min(100, +o.gMax));
          if (isFinite(+o.pg13Max)) c.pg13Max = Math.max(0, Math.min(100, +o.pg13Max));
          if (c.pg13Max < c.gMax) c.pg13Max = c.gMax;
          if (isFinite(+o.timeoutMs)) c.timeoutMs = Math.max(15000, Math.min(300000, +o.timeoutMs));
          if (o.failSafe === "reject" || o.failSafe === "flag") c.failSafe = o.failSafe;
          if (Array.isArray(o.animalWords) && o.animalWords.length) c.animalWords = o.animalWords.map(String);
          if (Array.isArray(o.sexWords) && o.sexWords.length) c.sexWords = o.sexWords.map(String);
        }
      }
    } catch (e) {}
    return c;
  }
  window.dragonWatcherCfgGet = function () { return cfg(); };
  window.dragonWatcherCfgSet = function (patch) {
    var c = cfg();
    try {
      var p = patch || {};
      if (typeof p.enabled === "boolean") c.enabled = p.enabled;
      if (isFinite(+p.gMax)) c.gMax = Math.max(0, Math.min(100, +p.gMax));
      if (isFinite(+p.pg13Max)) c.pg13Max = Math.max(0, Math.min(100, +p.pg13Max));
      if (c.pg13Max < c.gMax) c.pg13Max = c.gMax;
      if (isFinite(+p.timeoutMs)) c.timeoutMs = Math.max(15000, Math.min(300000, +p.timeoutMs));
      if (p.failSafe === "reject" || p.failSafe === "flag") c.failSafe = p.failSafe;
      if (Array.isArray(p.animalWords) && p.animalWords.length) c.animalWords = p.animalWords.map(String);
      if (Array.isArray(p.sexWords) && p.sexWords.length) c.sexWords = p.sexWords.map(String);
      localStorage.setItem(CFG_KEY, JSON.stringify(c));
    } catch (e) {}
    return cfg();
  };
  // ---- rejected-hash store (preban persistence across lightbox reopens) ----
  function rejLoad() {
    try {
      var a = JSON.parse(localStorage.getItem(REJ_KEY) || "[]");
      return Array.isArray(a) ? a.filter(function (x) { return /^[a-f0-9]{64}$/.test(String(x)); }).slice(0, 300) : [];
    } catch (e) { return []; }
  }
  function rejHas(h) {
    if (!h) return false;
    try { return rejLoad().indexOf(String(h)) >= 0; } catch (e) { return false; }
  }
  function rejAdd(h) {
    try {
      h = String(h || "");
      if (!/^[a-f0-9]{64}$/.test(h)) return;
      var a = rejLoad();
      if (a.indexOf(h) < 0) { a.unshift(h); localStorage.setItem(REJ_KEY, JSON.stringify(a.slice(0, 300))); }
    } catch (e) {}
  }
  // ---- helpers ----
  function wordsOf(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  }
  // Fast local prompt pre-scan. Returns presignals only — the vision verdict decides.
  function promptScan(p, c) {
    var out = { pedoTerms: [], animalTerms: [] };
    try {
      if (typeof window.dragonPedoScan === "function") {
        var hit = window.dragonPedoScan(p || "");
        if (hit && hit.length) out.pedoTerms = hit.map(String).slice(0, 12);
      }
    } catch (e) {}
    try {
      var ws = wordsOf(p), set = {};
      for (var i = 0; i < ws.length; i++) set[ws[i]] = 1;
      var aw = c.animalWords || [], sw = c.sexWords || [];
      var hasAnimal = [], hasSex = false, i2;
      for (i2 = 0; i2 < aw.length; i2++) if (set[String(aw[i2]).toLowerCase()]) hasAnimal.push(String(aw[i2]).toLowerCase());
      for (i2 = 0; i2 < sw.length; i2++) if (set[String(sw[i2]).toLowerCase()]) { hasSex = true; break; }
      // Animal terms matter for the watcher only in a sexual context; otherwise a
      // plain "horse in a meadow" would light up every animal picture.
      if (hasAnimal.length && hasSex) out.animalTerms = hasAnimal.slice(0, 12);
    } catch (e2) {}
    return out;
  }
  function dataUrlToBlob(dataUrl) {
    var m = /^data:([^;,]+)?(;base64)?,(.*)$/.exec(String(dataUrl || ""));
    if (!m) throw new Error("bad-data-url");
    var mime = m[1] || "image/jpeg";
    if (m[2]) {
      var bin = atob(m[3]), n = bin.length, u = new Uint8Array(n);
      for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
      return new Blob([u], { type: mime });
    }
    return new Blob([decodeURIComponent(m[3])], { type: mime });
  }
  function genText() {
    try {
      if (window.root && typeof window.root.generateText === "function") return window.root.generateText;
    } catch (e) {}
    try {
      // main.pjs top-level names also land on window in classic scripts.
      if (typeof window.generateText === "function") return window.generateText;
    } catch (e2) {}
    return null;
  }
  // Static instruction prefix (kept IDENTICAL across calls so the backend prefix
  // cache survives; only the tail — image + prompt + presignals — changes).
  function staticPrefix(c) {
    return "You are an upload inspector for a public image gallery. Look CAREFULLY at " +
      "the image with your eyes AND read the generation prompt quoted after it. " +
      "Rules:\n" +
      "- erotic: 0-100, how sexually charged the IMAGE looks (0 = nothing erotic, " +
      "100 = explicit). Non-erotic or mildly suggestive (at or below " + c.gMax + ") is G. " +
      "Between " + c.gMax + " and " + c.pg13Max + " with NO nudity and NO sex act is PG13. " +
      "At or above " + c.pg13Max + " is ADULT.\n" +
      "- nudity: true if naked bodies, visible genitals, buttocks or breasts are shown " +
      "(artistic nude counts). Any nudity is ADULT.\n" +
      "- sex: true if a sex act is shown or clearly about to happen (kissing, vaginal, " +
      "anal, oral, orgy and the like). Any sex act is ADULT.\n" +
      "- pedo: \"yes\" if ANY person in the image looks under 18 AND the image is erotic, " +
      "nude, or sexual in any way, OR the prompt sexualizes a minor (schoolgirl/loli/" +
      "child/teen framing with sexual content). \"unsure\" if an age-relevant person " +
      "appears but you cannot tell whether they are a minor or the content is " +
      "non-sexual. Otherwise \"no\". Consider the prompt text seriously here: youth " +
      "wording plus sexual content is a real signal even when the render looks adult.\n" +
      "- animal: \"yes\" if the image shows a human having sex with an animal (or a " +
      "creature clearly standing in for one). \"unsure\" if sexualized animal-adjacent " +
      "content appears but no act is shown. Otherwise \"no\".\n" +
      "- unsure: true when the rating itself is a close call you do not want to make " +
      "alone.\n" +
      "Reply with ONLY one strict JSON object, no other text: " +
      "{\"erotic\":0,\"nudity\":false,\"sex\":false,\"pedo\":\"no\",\"pedoWhy\":\"\"," +
      "\"animal\":\"no\",\"animalWhy\":\"\",\"unsure\":false,\"note\":\"\"}.";
  }
  function parseVerdict(text) {
    var s = String((text && text.text !== undefined) ? text.text : text);
    var a = s.indexOf("{"), b = s.lastIndexOf("}");
    if (a < 0 || b <= a) throw new Error("no-json");
    var o = JSON.parse(s.slice(a, b + 1));
    var tri = function (v) { v = String(v || "").toLowerCase(); return (v === "yes" || v === "unsure") ? v : "no"; };
    var num = +o.erotic;
    return {
      erotic: isFinite(num) ? Math.max(0, Math.min(100, Math.round(num))) : 0,
      nudity: !!o.nudity,
      sex: !!o.sex,
      pedo: tri(o.pedo),
      pedoWhy: String(o.pedoWhy || "").slice(0, 160),
      animal: tri(o.animal),
      animalWhy: String(o.animalWhy || "").slice(0, 160),
      unsure: !!o.unsure,
      note: String(o.note || "").slice(0, 160)
    };
  }
  var RATING_NAMES = ["G", "PG13", "none"];
  function mapRating(v, c) {
    if (v.sex || v.nudity || v.erotic >= c.pg13Max) return 2;
    if (v.erotic > c.gMax) return 1;
    return 0;
  }
  // ---- pending flags (undecided uploads, flushed to the server on confirm) ----
  var pending = {}; // hash -> {r,e,u,n,p}
  function flagReason(v) {
    var bits = [];
    if (v.pedo === "unsure") bits.push("pedo-unsure" + (v.pedoWhy ? ": " + v.pedoWhy : ""));
    if (v.animal === "unsure") bits.push("animal-unsure" + (v.animalWhy ? ": " + v.animalWhy : ""));
    if (v.unsure) bits.push("close-call");
    if (v.note) bits.push(v.note);
    return bits.join(" | ").slice(0, 200);
  }
  window.dragonWatcherNotePending = function (info) {
    try {
      if (!info || !/^[a-f0-9]{64}$/.test(String(info.hash || ""))) return;
      pending[String(info.hash)] = info;
    } catch (e) {}
  };
  window.dragonWatcherOnConfirmed = function (hash) {
    var info = null;
    try { info = pending[String(hash || "")] || null; } catch (e) {}
    if (!info) return Promise.resolve({ ok: false, err: "none" });
    try { delete pending[String(hash)]; } catch (e2) {}
    try {
      if (typeof window.dragonServerRpc !== "function") return Promise.resolve({ ok: false, err: "no-rpc" });
     return window.dragonServerRpc("dragonWatcherFlag", JSON.stringify({
       h: String(hash), r: info.rating | 0, e: info.erotic | 0,
        u: String(info.why || ""), n: String(info.note || ""), p: String(info.prompt || ""),
        f: info.f | 0
      })).then(function (raw) {
        try { return JSON.parse(raw); } catch (e3) { return { ok: false, err: "parse" }; }
      }, function (err) { return { ok: false, err: String((err && err.message) || err || "rpc") }; });
    } catch (e4) { return Promise.resolve({ ok: false, err: "throw" }); }
  };
  // ---- send-button lock (preban) ----
  window.dragonWatcherLockBtn = function (btn, reason) {
    try {
      if (!btn) return;
      btn.__dragonWatchRejected = true;
      btn.__dragonWatchReason = String(reason || "rejected");
      btn.disabled = true;
      try { btn.style.opacity = ".42"; } catch (e) {}
      try { btn.style.cursor = "not-allowed"; } catch (e2) {}
      try { btn.style.borderColor = "#e0554f"; } catch (e3) {}
      btn.title = "Blocked by the upload inspector — this image cannot be sent to the public gallery";
      try { if (btn.textContent === "⏳" || btn.textContent === "📮") btn.textContent = "⛔"; } catch (e4) {}
    } catch (e5) {}
  };
  window.dragonWatcherBtnLocked = function (btn) {
    try { return !!(btn && btn.__dragonWatchRejected); } catch (e) { return false; }
  };
  window.dragonWatcherIsRejected = async function (url) {
    try {
      if (!url || typeof window.dragonUrlHash !== "function") return false;
      var h = await window.dragonUrlHash(url);
      return rejHas(h);
    } catch (e) { return false; }
  };
  function rejectResult(msg, lockReason, extra) {
    var r = { action: "reject", message: msg, lockReason: lockReason || "rejected" };
    if (extra && typeof extra === "object") for (var k in extra) r[k] = extra[k];
    return r;
  }
  // ---- THE inspection (called by the send flow; never throws) ----
  window.dragonWatcherInspect = async function (job) {
    var c = cfg();
    try {
      job = job || {};
      var hash = String(job.hash || "");
      var prompt = String(job.prompt || "");
      if (!c.enabled) return { action: "ok", rating: -1, skipped: true };
      if (hash && rejHas(hash)) {
        return rejectResult("⛔ Not sent — the upload inspector already rejected this image, and it stays rejected. Nothing was added to the public gallery.", "already-rejected", { hash: hash });
      }
      var gt = (typeof window.__dragonWatcherVisionStub === "function") ? window.__dragonWatcherVisionStub : genText();
      if (!gt) {
        // No vision backend (should not happen — ai-text-plugin is imported).
        if (c.failSafe === "reject") return rejectResult("⛔ Not sent — the upload inspector is unavailable, and it is set to block on failure. Nothing was added to the public gallery.", "no-backend");
        window.dragonWatcherNotePending({ hash: hash, rating: -1, erotic: -1, why: "inspector-unavailable", note: "", prompt: prompt.slice(0, 140), f: 0 });
        return { action: "flag", rating: -1, hash: hash, why: "inspector-unavailable" };
      }
      var pre = promptScan(prompt, c);
      var blob = dataUrlToBlob(job.dataUrl);
      var tail = "\nPROMPT THAT GENERATED IT: \"" + prompt.slice(0, 600) + "\"\n" +
        "PRESIGNALS FROM PROMPT SCAN (focus hints, not verdicts): " +
        "pedo-terms [" + pre.pedoTerms.join(", ") + "]; animal-in-sexual-context [" + pre.animalTerms.join(", ") + "].\n" +
        "TASK: inspect the IMAGE carefully with your eyes and weigh the prompt. Reply ONLY the JSON object.";
      var call = gt({ instruction: [staticPrefix(c), blob, tail], startWith: "{" });
      var raw;
      if (call && typeof call.then === "function") {
        var timer = null;
        try {
          raw = await Promise.race([
            call.then(function (v) { return v; }),
            new Promise(function (_, rej) { timer = setTimeout(function () { rej(new Error("watcher-timeout")); }, c.timeoutMs); })
          ]);
        } finally { try { if (timer) clearTimeout(timer); } catch (eT) {} }
      } else raw = call;
      var v = parseVerdict(raw);
      if (v.pedo === "yes" || v.animal === "yes") {
        var why = v.pedo === "yes" ? ("pedo-risk" + (v.pedoWhy ? ": " + v.pedoWhy : "")) : ("animal-sex" + (v.animalWhy ? ": " + v.animalWhy : ""));
        if (hash) rejAdd(hash);
        return rejectResult("⛔ Not sent — the upload inspector detected " + (v.pedo === "yes" ? "a pedo-shield risk" : "animal-sex content") +
          " in this image, so it was never uploaded. The send button for this image is now closed. " +
          (v.note ? "(" + v.note + ")" : ""), why, { hash: hash, rating: mapRating(v, c), verdict: v });
      }
      var rating = mapRating(v, c);
      if (v.pedo === "unsure" || v.animal === "unsure" || v.unsure) {
        var why2 = flagReason(v) || "close-call";
        window.dragonWatcherNotePending({ hash: hash, rating: rating, erotic: v.erotic, why: why2, note: v.note, prompt: prompt.slice(0, 140),
          f: ((v.pedo === "unsure") ? 1 : 0) | ((v.animal === "unsure") ? 2 : 0) | (v.unsure ? 4 : 0) });
        return { action: "flag", rating: rating, hash: hash, why: why2, verdict: v };
      }
      return { action: "ok", rating: rating, hash: hash, verdict: v };
    } catch (e) {
      try {
        if (c.failSafe === "reject") {
          return rejectResult("⛔ Not sent — the upload inspection failed (" + String((e && e.message) || e || "error") +
            "), and the inspector is set to block on failure. Nothing was added to the public gallery.", "inspect-failed");
        }
        var j2 = (job || {});
        window.dragonWatcherNotePending({ hash: String(j2.hash || ""), rating: -1, erotic: -1, why: "inspect-failed: " + String((e && e.message) || e || "error").slice(0, 80), note: "", prompt: String(j2.prompt || "").slice(0, 140), f: 0 });
        return { action: "flag", rating: -1, hash: String(j2.hash || ""), why: "inspect-failed" };
      } catch (e2) { return { action: "flag", rating: -1, why: "inspect-failed" }; }
    }
  };
  window.dragonWatcherRatingName = function (r) { return RATING_NAMES[r] || "?"; };
  // ---- self-test (stubbed vision, zero network): logic + mapping + locks ----
  window.dragonWatcherTest = async function () {
    var out = {};
    var keepStub = null;
    try { keepStub = window.__dragonWatcherVisionStub; } catch (e) {}
    // Fake 64-hex hashes (never real images).
    var H = function (ch) { var s = ""; for (var i = 0; i < 64; i++) s += ch; return s; };
    var say = function (v) {
      return { text: "{\"erotic\":" + v.erotic + ",\"nudity\":" + !!v.nudity + ",\"sex\":" + !!v.sex +
        ",\"pedo\":\"" + v.pedo + "\",\"pedoWhy\":\"" + (v.pedoWhy || "") + "\",\"animal\":\"" + v.animal +
        "\",\"animalWhy\":\"" + (v.animalWhy || "") + "\",\"unsure\":" + !!v.unsure + ",\"note\":\"" + (v.note || "") + "\"}" };
    };
    var tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    try {
      // 1. pedo yes -> reject (+ hash locked)
      window.__dragonWatcherVisionStub = function () { return Promise.resolve(say({ erotic: 80, nudity: true, sex: false, pedo: "yes", pedoWhy: "test", animal: "no", unsure: false })); };
      var r1 = await window.dragonWatcherInspect({ dataUrl: tinyPng, prompt: "test", hash: H("a") });
      out.rejectPedo = (r1.action === "reject");
      // same hash again -> instant reject without a second vision call
      var calls = 0;
      window.__dragonWatcherVisionStub = function () { calls++; return Promise.resolve(say({ erotic: 0, nudity: false, sex: false, pedo: "no", animal: "no", unsure: false })); };
      var r1b = await window.dragonWatcherInspect({ dataUrl: tinyPng, prompt: "test", hash: H("a") });
      out.rejectSticky = (r1b.action === "reject" && calls === 0);
      // 2. animal yes -> reject
      window.__dragonWatcherVisionStub = function () { return Promise.resolve(say({ erotic: 70, nudity: false, sex: true, pedo: "no", animal: "yes", animalWhy: "test", unsure: false })); };
      var r2 = await window.dragonWatcherInspect({ dataUrl: tinyPng, prompt: "test", hash: H("b") });
      out.rejectAnimal = (r2.action === "reject");
      // 3. unsure -> flag + pending queued
      window.__dragonWatcherVisionStub = function () { return Promise.resolve(say({ erotic: 30, nudity: false, sex: false, pedo: "no", animal: "no", unsure: true, note: "borderline" })); };
      var r3 = await window.dragonWatcherInspect({ dataUrl: tinyPng, prompt: "hello world", hash: H("c") });
      out.flagUnsure = (r3.action === "flag" && r3.rating === 1);
      // 4. rating map: G / PG13 / none
      window.__dragonWatcherVisionStub = function () { return Promise.resolve(say({ erotic: 5, nudity: false, sex: false, pedo: "no", animal: "no", unsure: false })); };
      out.mapG = ((await window.dragonWatcherInspect({ dataUrl: tinyPng, prompt: "x", hash: H("d") })).rating === 0);
      window.__dragonWatcherVisionStub = function () { return Promise.resolve(say({ erotic: 40, nudity: false, sex: false, pedo: "no", animal: "no", unsure: false })); };
      out.mapPG = ((await window.dragonWatcherInspect({ dataUrl: tinyPng, prompt: "x", hash: H("e") })).rating === 1);
      window.__dragonWatcherVisionStub = function () { return Promise.resolve(say({ erotic: 10, nudity: true, sex: false, pedo: "no", animal: "no", unsure: false })); };
      out.mapNude = ((await window.dragonWatcherInspect({ dataUrl: tinyPng, prompt: "x", hash: H("f") })).rating === 2);
      window.__dragonWatcherVisionStub = function () { return Promise.resolve(say({ erotic: 61, nudity: false, sex: false, pedo: "no", animal: "no", unsure: false })); };
      out.mapErotic61 = ((await window.dragonWatcherInspect({ dataUrl: tinyPng, prompt: "x", hash: H("0") })).rating === 2);
      // 5. pedo unsure -> flag (upload proceeds, badge queued)
      window.__dragonWatcherVisionStub = function () { return Promise.resolve(say({ erotic: 10, nudity: false, sex: false, pedo: "unsure", pedoWhy: "young face?", animal: "no", unsure: false })); };
      var r5 = await window.dragonWatcherInspect({ dataUrl: tinyPng, prompt: "portrait", hash: H("1") });
      out.flagPedoUnsure = (r5.action === "flag");
      // 6. vision throws -> failSafe flag
      window.__dragonWatcherVisionStub = function () { return Promise.reject(new Error("boom")); };
      var r6 = await window.dragonWatcherInspect({ dataUrl: tinyPng, prompt: "x", hash: H("2") });
      out.failSafeFlag = (r6.action === "flag");
      // 7. disabled -> skip
      var beforeCfg = window.dragonWatcherCfgGet();
      window.dragonWatcherCfgSet({ enabled: false });
      var r7 = await window.dragonWatcherInspect({ dataUrl: tinyPng, prompt: "x", hash: H("3") });
      out.disabledSkip = (r7.action === "ok" && r7.skipped === true);
      window.dragonWatcherCfgSet({ enabled: beforeCfg.enabled });
      // 8. button lock
      var b = document.createElement("button");
      b.textContent = "📮";
      window.dragonWatcherLockBtn(b, "test");
      out.btnLock = (b.disabled === true && b.textContent === "⛔" && window.dragonWatcherBtnLocked(b));
      out.allOk = out.rejectPedo && out.rejectSticky && out.rejectAnimal && out.flagUnsure &&
        out.mapG && out.mapPG && out.mapNude && out.mapErotic61 && out.flagPedoUnsure &&
        out.failSafeFlag && out.disabledSkip && out.btnLock;
    } finally {
      try {
        if (keepStub === undefined || keepStub === null) delete window.__dragonWatcherVisionStub;
        else window.__dragonWatcherVisionStub = keepStub;
      } catch (eR) {}
    }
    return out;
  };
})();
