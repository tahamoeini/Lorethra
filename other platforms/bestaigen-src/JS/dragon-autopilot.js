// dragon-autopilot.js — Studio · 🤖 AutoPilot: word pools -> endless prompt combos -> background production.
// Ported from Egon's k6rm7u3ebn (src/autopilot.js + t2iFast idea), rebuilt on bestaigen's own engine:
// prompts run through the REAL Generate path (Description field + Generate handler), so every card
// appears in the output area exactly as if Egon pressed Generate himself. Finished frames also land
// in a Private Gallery folder when the vault copy is switched on (default off; history is automatic
// on that path). Lives in the Studio's AutoPilot tab.
// Queue rule (Egon 11.10.2026): one shared ledger (window.dragonGenQueue). Humans always win —
// autopilot waits while any human generation (normal Generate, Lookbook tiles, race embeds) is pending.
// Rollback: delete this file + its script tag (the AutoPilot tab falls back to its placeholder).
(function () {
  if (window.__dragonAutopilotInstalled) return;
  window.__dragonAutopilotInstalled = true;

  var LS_POOLS = "dragonAutopilotPools", LS_CFG = "dragonAutopilotCfg";
  var FOLDER_DEFAULT = "Autopilot";

  ;function toast(m) { try { if (window.dragonToast) window.dragonToast(m); } catch (e) {} }
  ;function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  ;function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  ;function q(s, r) { try { return (r || document).querySelector(s); } catch (e) { return null; } }
  ;function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  ;function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  ;function clampInt(v, lo, hi, d) { var n = parseInt(v, 10); return isNaN(n) ? d : Math.max(lo, Math.min(hi, n)); }

  // ================= shared generation ledger (the queue rule) =================
  // Owners are explicit (autopilot registers itself); human work is SEEN through pending
  // output tiles, so Lookbook / race / normal Generate need no code changes to be respected.
  if (!window.dragonGenQueue) {
    window.dragonGenQueue = {
      owners: {},
      begin: function (o) { try { this.owners[o] = true; } catch (e) {} },
      end: function (o) { try { delete this.owners[o]; } catch (e) {} },
      pendingTiles: function () {
        var n = 0;
        try {
          var oa = document.getElementById("outputAreaEl");
          if (oa) {
            var ts = oa.querySelectorAll(".t2i-image-ctn");
            for (var i = 0; i < ts.length; i++) {
              var f = null, o = null;
              try { f = ts[i].querySelector("iframe"); } catch (eF) {}
              try { o = f && f.textToImagePluginOutput; } catch (eO) {}
              if (!o || !o.dataUrl) n++;
            }
          }
        } catch (e) {}
        return n;
      },
      busy: function (except) {
        for (var k in this.owners) if (k !== except) return true;
        return this.pendingTiles() > 0;
      }
    };
  }

  // ================= presets (mode-safe built-ins) =================
  // Risky pool labels (e.g. pasted from the other generator's mixed preset) are LOCKED in G mode.
  var RISKY_LABELS = ["reve"+"aling", "sca"+"nty", "expl"+"icit", "sugge"+"stive", "top"+"less", "ling"+"erie", "nu"+"de", "sh"+"eer"];
  var PRESETS = {
    sample: { label: "\uD83C\uDF3F sample (mixed)", subject: "mixed", pools:
      "identity: 25 year old adult woman, 28 year old adult woman, 31 year old adult man, 35 year old adult man\n" +
      "outfit: white summer dress, denim jacket and jeans, beige knit sweater, grey hoodie and black trousers\n" +
      "place: sunlit stone balcony, quiet bookstore interior, misty forest path, seaside boardwalk\n" +
      "pose: standing and looking at the camera, sitting on a wooden bench, walking away and glancing back\n" +
      "light: soft golden hour light, overcast daylight, warm indoor lamp light\n" +
      "shot: 85mm portrait lens, full body shot, waist-up framing" },
    kitty: { label: "\uD83D\uDC31 cute kitty", subject: "mixed", pools:
      "breed: fluffy orange tabby cat, tiny grey tabby kitten, snow white cat with blue eyes, calico cat\n" +
      "place: curled up in a woven wicker basket, on a soft knitted blanket, on a sunny windowsill, on a cozy rug by a fireplace\n" +
      "pose: sleeping curled into a ball, stretching with a big yawn, playing with a ball of yarn, looking up curiously with wide eyes\n" +
      "light: soft warm window light, gentle golden sunlight, cozy indoor lamplight, bright airy daylight\n" +
      "shot: close-up macro shot, 50mm lens, shallow depth of field, eye-level portrait" },
    figure: { label: "\uD83E\uDDCD plain figure", subject: "figure", pools:
      "identity: 24 year old adult woman, 27 year old adult woman, 31 year old adult woman, 29 year old adult man, 34 year old adult man\n" +
      "build: slim athletic figure, soft natural build, toned dancer physique\n" +
      "outfit: elegant black evening gown, white linen shirt and trousers, denim shorts and crop top, oversized knit sweater, sports jacket and leggings\n" +
      "place: sunlit bedroom with white linens, modern hotel suite with large windows, lakeside wooden deck, quiet studio with a paper backdrop\n" +
      "pose: sitting on the edge of the bed, standing by the window looking back over the shoulder, leaning against the wall, walking away and glancing back\n" +
      "light: golden hour light through blinds, soft window light, natural overcast daylight\n" +
      "shot: 85mm portrait lens, full body shot, medium shot, three-quarter framing" },
    place: { label: "\uD83C\uDFDE\uFE0F people-free place", subject: "none", pools:
      "subject: ancient stone cottage, abandoned lighthouse, tiny fishing hut, modernist glass villa, wooden treehouse\n" +
      "surroundings: wildflower meadow, dense pine forest, rocky coastline, misty mountain valley, quiet snowy field\n" +
      "sky: clear blue sky, heavy rolling fog, dramatic storm clouds, soft overcast light\n" +
      "time: at sunrise, at golden hour, at blue hour just after sunset, in the middle of the night\n" +
      "shot: wide establishing shot, drone aerial view, symmetrical composition, 24mm landscape lens" }
  };

  // ================= pools =================
  ;function parsePools(text) {
    var pools = [];
    String(text || "").split("\n").forEach(function (ln) {
      var line = String(ln || "").trim();
      if (!line) return;
      var ci = line.indexOf(":");
      if (ci < 0) return;
      var label = line.slice(0, ci).trim();
      var items = line.slice(ci + 1).split(",").map(function (s) { return String(s || "").trim(); }).filter(Boolean);
      if (label && items.length) pools.push({ label: label, items: items });
    });
    return pools;
  }
  ;function weightedPick(items) {
    var bag = [];
    items.forEach(function (w) {
      var m = String(w).match(/^(.*)\^(\d+)\s*$/);
      var word = m ? m[1].trim() : String(w).trim();
      var times = m ? clampInt(m[2], 1, 9, 1) : 1;
      for (var i = 0; i < times; i++) bag.push(word);
    });
    return bag.length ? bag[Math.floor(Math.random() * bag.length)] : "";
  }
  ;function poolTier() { return "g"; } // no tiers: the risky-pool filter always applies.
  ;function isRisky(label) {
    var l = String(label || "").toLowerCase();
    for (var i = 0; i < RISKY_LABELS.length; i++) if (l.indexOf(RISKY_LABELS[i]) !== -1) return true;
    return false;
  }
  ;function activePools() {
    var pools = parsePools(model.poolText);
    var off = model.off || {};
    var g = (poolTier() === "g");
    return pools.filter(function (p) {
      if (off[p.label]) return false;
      if (g && isRisky(p.label)) return false; // risky pools always stay out (no modes)
      return true;
    });
  }
  var seen = {};
  ;function promptKey(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 220); }
  ;function mkPrompt() {
    var pools = activePools();
    if (!pools.length) return "";
    var parts = [];
    for (var i = 0; i < pools.length; i++) {
      var w = weightedPick(pools[i].items);
      if (w) parts.push(w);
    }
    // shuffle pool order so the combo reads fresh every time
    for (var j = parts.length - 1; j > 0; j--) { var k = Math.floor(Math.random() * (j + 1)); var t = parts[j]; parts[j] = parts[k]; parts[k] = t; }
    return parts.join(", ");
  }
  ;function makePrompts(n) {
    var out = [], guard = 0;
    while (out.length < n && guard++ < n * 40) {
      var p = mkPrompt();
      if (!p) break;
      var key = promptKey(p);
      if (seen[key]) continue;
      seen[key] = true;
      out.push(p);
    }
    if (out.length < n) seen = {}; // exhausted: start over rather than stall
    return out;
  }

  // ================= persistent model =================
  function defaults() {
    return { preset: "sample", poolText: PRESETS.sample.pools, off: {}, round: 2, batch: 2, count: 4,
      delaySec: 5, timeoutSec: 300, folder: FOLDER_DEFAULT, hist: true, vault: false };
  }
  var model = defaults();
  try {
    var m = JSON.parse(lsGet(LS_CFG, "null"));
    if (m && typeof m === "object") { for (var k in model) if (k in m) model[k] = m[k]; }
    if (!("vault" in (m || {}))) model.vault = false;
    if (model.folder === "autopilot") model.folder = FOLDER_DEFAULT;
    if (m && m.perBatch != null && m.batch == null) model.batch = clampInt(m.perBatch, 1, 6, 2);
    if (m && m.gapSec != null && m.delaySec == null) model.delaySec = clampInt(m.gapSec, 0, 3600, 5);
    var pt = lsGet(LS_POOLS, null);
    if (pt != null) model.poolText = pt;
  } catch (e) {}
  ;function save() {
    lsSet(LS_POOLS, model.poolText || "");
    var c = {};
    for (var k in model) if (k !== "poolText") c[k] = model[k];
    lsSet(LS_CFG, JSON.stringify(c));
  }

  // ================= run state + loop =================
  var run = { active: false, paused: false, stop: false, cycle: 0, ok: 0, failed: 0, lastPrompt: "", t0: 0, failStreak: 0, waiting: false };
  var logBuf = [];
  ;function logLine(t) {
    logBuf.push(t);
    if (logBuf.length > 40) logBuf.shift();
    var el = document.getElementById("dragonAutoLog");
    if (el) el.innerHTML = logBuf.slice(-10).map(function (l) { return "<div>" + esc(l) + "</div>"; }).join("");
  }
    ;function paint() {
    var st = document.getElementById("dragonAutoStats");
    if (st) {
      var rr = clampInt(model.round, 0, 100000, 2);
      st.textContent = run.active
        ? ("\uD83E\uDD16 round " + run.round + (rr ? "/" + rr : "") + " \u00B7 " + run.ok + " images" + (run.paused ? " \u00B7 paused" : (run.waiting ? " \u00B7 waiting for your generations to finish\u2026" : " \u00B7 running\u2026")))
        : (run.ok || run.failed ? ("\u2714 done \u2014 " + run.ok + " images, " + run.failed + " errors") : "ready");
    }
    paintButtons();
  }
;function paintButtons() {
    var bS = document.getElementById("dragonAutoStart"), bX = document.getElementById("dragonAutoStop"),
        bP = document.getElementById("dragonAutoPause");
    if (bS) bS.style.display = run.active ? "none" : "";
    if (bX) bX.style.display = run.active ? "" : "none";
    if (bP) { bP.style.display = run.active ? "" : "none"; bP.textContent = run.paused ? "\u23F5 Resume" : "\u23F8 Pause"; }
  }
  // UI mode: autopilot drives the REAL Generate path — the prompt goes into the normal
  // Description field and fires the same handler the Generate button uses, so every
  // production card appears in the output area exactly as if Egon pressed it himself.
  // Cards + history are automatic on that path; autopilot only adds the vault-folder copy.
  ;function descEl() { try { return document.querySelector('textarea.paragraph-input[data-name="description"]'); } catch (e) { return null; } }
  ;function tileList() { try { var oa = document.getElementById("outputAreaEl"); return oa ? Array.prototype.slice.call(oa.querySelectorAll(".t2i-image-ctn")) : []; } catch (e) { return []; } }
  ;function tileSnap(t) {
    try {
      if (!t.isConnected) return { gone: true };
      var f = t.querySelector("iframe"), o = f && f.textToImagePluginOutput;
      if (o && o.dataUrl) return { url: o.dataUrl };
      if (o && o.error) return { error: String(o.error) };
      return { pending: true };
    } catch (e) { return { pending: true }; }
  }
  ;function firePress(prompt) {
    var d = descEl();
    if (!d) return false;
    try {
      d.value = String(prompt);
      d.dispatchEvent(new Event("input", { bubbles: true }));
      d.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (e) {}
    try {
      // NOTE: the very same function the Generate button calls — a synthetic .click()
      // proved unreliable in live tests, this direct call is the dependable twin.
      var fn = window.___generateButtonClickEvent746291937;
      if (typeof fn !== "function") return false;
      fn();
      return true;
    } catch (e) { return false; }
  }
  ;function saveVault(url, prompt) {
    if (!model.vault) return Promise.resolve(false);
    var folder = String(model.folder || FOLDER_DEFAULT).trim() || FOLDER_DEFAULT;
    try {
      if (!window.t2i_privateGallery || !window.t2i_privateGallery.add) return Promise.resolve(false);
      return fetch(url).then(function (r) { return r.blob(); }).then(function (blob) {
        return window.t2i_privateGallery.add(blob, { folder: folder, info: { prompt: prompt, seed: "ui", source: "autopilot" } });
      }).catch(function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }
    ;function waitUnpaused() {
    return new Promise(function (res) {
      (function chk() { if (run.stop || !run.paused) res(); else setTimeout(chk, 400); })();
    });
  }
  ;function collectNew(before, waitMs) {
    var t0 = Date.now();
    return new Promise(function (res) {
      (function chk() {
        if (run.stop) { res([]); return; }
        var now = tileList(), fresh = [];
        for (var i = 0; i < now.length; i++) if (before.indexOf(now[i]) === -1) fresh.push(now[i]);
        if (fresh.length || Date.now() - t0 > waitMs) res(fresh);
        else setTimeout(chk, 700);
      })();
    });
  }
  ;function settleTiles(tiles, ms) {
    var t0 = Date.now();
    return new Promise(function (res) {
      var urls = [], failed = 0, seen = [];
      (function chk() {
        if (run.stop) { res({ urls: urls, failed: failed, stopped: true }); return; }
        var allDone = true;
        for (var i = 0; i < tiles.length; i++) {
          if (seen[i]) continue;
          var s = tileSnap(tiles[i]);
          if (s.url) { seen[i] = true; urls.push(s.url); }
          else if (s.error || s.gone) { seen[i] = true; failed++; }
          else allDone = false;
        }
        if (allDone || Date.now() - t0 > ms) {
          for (var j = 0; j < tiles.length; j++) if (!seen[j]) failed++;
          res({ urls: urls, failed: failed, stopped: false });
        } else setTimeout(chk, 1500);
      })();
    });
  }
  ;function pressOnce(pr) {
    return waitUnpaused().then(function () {
      if (run.stop) return { ok: 0, stopped: true };
      logLine("\u2026 generating: " + String(pr).slice(0, 70));
      var before = tileList();
      if (!firePress(pr)) { run.failed++; logLine("\u2717 press failed (engine not ready)"); return { ok: 0 }; }
      var ms = clampInt(model.timeoutSec, 60, 1800, 300) * 1000;
      return collectNew(before, 25000).then(function (fresh) {
        if (run.stop) return { ok: 0, stopped: true };
        if (!fresh.length) { run.failed++; logLine("\u2717 no card appeared for: " + String(pr).slice(0, 55)); return { ok: 0 }; }
        return settleTiles(fresh, ms).then(function (st) {
          var n = 0;
          var chain = Promise.resolve();
          st.urls.forEach(function (u) {
            chain = chain.then(function () { return saveVault(u, pr); }).then(function () {
              if (!run.stop) { run.ok++; n++; run.lastPrompt = pr; logLine("\u2713 " + String(pr).slice(0, 70)); }
            });
          });
          run.failed += st.failed;
          return chain.then(function () { return { ok: n, stopped: st.stopped }; });
        });
      });
    });
  }
  ;function pressOne(pr) {
    // one retry, like the original headless driver
    return pressOnce(pr).then(function (r1) {
      if (r1.ok > 0 || r1.stopped || run.stop) return r1;
      logLine("\u21BB retry: " + String(pr).slice(0, 55));
      return pressOnce(pr);
    });
  }
    ;function runBatch(prompts, cap, okStart) {
    // UI mode: one real press per prompt, strictly sequential — exactly like Egon typing
    // the prompt into Description and hitting Generate himself. The round ends early once
    // its image Count is reached, so leftover prompts are simply skipped.
    var chain = Promise.resolve();
    prompts.forEach(function (pr) {
      chain = chain.then(function () {
        if (run.stop) return null;
        if (cap && (run.ok - okStart) >= cap) return null;
        return pressOne(pr);
      });
    });
    return chain;
  }
async function loop() {
    run.active = true; run.stop = false; run.paused = false;
    run.round = 0; run.ok = 0; run.failed = 0; run.lastPrompt = ""; run.t0 = Date.now(); run.failStreak = 0; run.waiting = false;
    seen = {};
    if (!parsePools(model.poolText).length) {
      run.active = false; paint();
      toast("\u26A0\uFE0F pools are empty \u2014 write your pools first");
      return { ok: false, error: "no_pools" };
    }
    if (!descEl() || typeof window.___generateButtonClickEvent746291937 !== "function") {
      run.active = false; paint();
      toast("\u26A0\uFE0F image engine isn't ready");
      return { ok: false, error: "no_engine" };
    }
    try { run.savedDesc = descEl().value; } catch (eS) { run.savedDesc = null; }
    var rounds = clampInt(model.round, 0, 100000, 2);
    logLine("\u25B6 autopilot started \u2014 " + (rounds ? rounds + " rounds" : "endless rounds") +
      " \u00B7 " + clampInt(model.batch, 1, 6, 2) + " presses/round \u00B7 " + clampInt(model.count, 1, 100000, 4) + " images/round" +
      " \u00B7 real cards (like pressing Generate)" + (model.vault ? " \u00B7 vault \u2192 " + model.folder : " \u00B7 vault off"));
    paint();
    window.dragonGenQueue.begin("autopilot");
    while (!run.stop) {
      if (run.paused) { await sleep(500); continue; }
      rounds = clampInt(model.round, 0, 100000, 2);
      if (rounds && run.round >= rounds) break; // all rounds done — leave even if straggler cards still settle
      if (window.dragonGenQueue.busy("autopilot")) {
        if (!run.waiting) { run.waiting = true; logLine("\u23F3 waiting for your generations to finish (humans first)\u2026"); paint(); }
        await sleep(2500); continue;
      }
      if (run.waiting) { run.waiting = false; logLine("\u25B6 queue is clear \u2014 autopilot takes over"); paint(); }
      var batchN = clampInt(model.batch, 1, 6, 2);
      var countN = clampInt(model.count, 1, 100000, 4);
      var prompts = makePrompts(batchN);
      if (!prompts.length) { logLine("\u2717 no prompt made (pools missing)"); break; }
      run.round++;
      paint();
      var ok0 = run.ok, fail0 = run.failed;
      await runBatch(prompts, countN, ok0);
      var gotOk = run.ok - ok0;
      if (gotOk === 0 && run.failed > fail0) {
        run.failStreak++;
        logLine("\u26A0\uFE0F no images this round (" + run.failStreak + "/3)");
        if (run.failStreak >= 3) { logLine("\u2717 3 failed rounds in a row \u2014 stopped"); toast("\u26A0\uFE0F autopilot stopped \u2014 the server keeps failing"); break; }
      } else run.failStreak = 0;
      if (run.stop) break;
      if (run.paused) continue;
      rounds = clampInt(model.round, 0, 100000, 2);
      if (rounds && run.round >= rounds) break;
      var delayN = clampInt(model.delaySec, 0, 3600, 5);
      if (delayN > 0) await sleep(delayN * 1000);
    }
    var wasStop = run.stop;
    run.active = false; run.paused = false; run.stop = false;
    try { if (run.savedDesc != null && descEl() && descEl().value !== run.savedDesc) { descEl().value = run.savedDesc; descEl().dispatchEvent(new Event("input", { bubbles: true })); } } catch (eR) {}
    run.savedDesc = null;
    try { if (window.dragonProdNewSession) window.dragonProdNewSession(); } catch (eNS) {}
    window.dragonGenQueue.end("autopilot");
    logLine((wasStop ? "\u23F9 stopped" : "\u2714 done") + " \u2014 " + run.ok + " images, " + run.failed + " errors");
    toast("\uD83E\uDD16 " + run.ok + " images" + (model.vault ? " \u2192 \u201C" + (String(model.folder || FOLDER_DEFAULT)) + "\u201D" : ""));
    paint();
    return { ok: true, produced: run.ok, failed: run.failed };
  }

  // ================= UI (inside the Studio AutoPilot tab) =================
  ;function tag(el) { try { el.setAttribute("data-name", ""); } catch (e) {} return el; }
  ;function mkInput(type, val) { var i = document.createElement("input"); i.type = type; if (val != null) i.value = val; return tag(i); }
  ;function numRow(label, key, lo, hi, d, width) {
    var wrap = document.createElement("label");
    wrap.style.cssText = "display:flex; align-items:center; gap:.35rem; font-size:.78rem; color:#e8e3f5;";
    var sp = document.createElement("span"); sp.textContent = label; sp.style.cssText = "opacity:.8;";
    var i = mkInput("number", String(model[key] == null ? d : model[key]));
    i.min = lo; i.max = hi;
    i.style.cssText = "width:" + (width || "4.2rem") + "; box-sizing:border-box; background:var(--dt-bg2,#0f0f15); border:1px solid var(--dt-border,#4a4a58); border-radius:8px; color:var(--dt-fg,#e8e6ee); font-size:.8rem; padding:.35rem .45rem;";
    i.addEventListener("change", function () { model[key] = clampInt(i.value, lo, hi, d); i.value = String(model[key]); save(); });
    wrap.appendChild(sp); wrap.appendChild(i);
    return wrap;
  }
  ;function btn(t, fn, accent) {
    var b = document.createElement("button");
    b.type = "button"; b.textContent = t;
    b.className = "dragon-studio-btn" + (accent ? " dragon-studio-go" : "");
    b.onclick = fn;
    return b;
  }
  ;function renderPoolToggles(host) {
    host.innerHTML = "";
    var pools = parsePools(model.poolText);
    var g = (poolTier() === "g");
    pools.forEach(function (p) {
      var lab = document.createElement("label");
      lab.style.cssText = "display:flex; align-items:center; gap:.35rem; font-size:.76rem; color:#d8d2ea; padding:.1rem 0;";
      var cb = document.createElement("input");
      cb.type = "checkbox";
      var locked = g && isRisky(p.label);
      cb.checked = !model.off[p.label] && !locked;
      cb.disabled = !!locked;
      tag(cb);
      cb.title = locked ? "locked (sensitive pool)" : p.items.length + " words";
      cb.addEventListener("change", function () {
        if (cb.checked) delete model.off[p.label]; else model.off[p.label] = true;
        save();
      });
      var tx = document.createElement("span");
      tx.textContent = p.label + " (" + p.items.length + ")" + (locked ? " \uD83D\uDD12" : "");
      tx.style.cssText = "flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" + (locked ? "opacity:.55;" : "");
      tx.title = p.items.join(", ").slice(0, 300);
      lab.appendChild(cb); lab.appendChild(tx);
      host.appendChild(lab);
    });
    if (!pools.length) host.innerHTML = "<div style='font-size:.76rem;color:#9d9ab5;'>no pools \u2014 load a preset below or write your own</div>";
  }
  ;function build() {
    var host = document.getElementById("dragonStudioAutopilot");
    if (!host) return false;
    host.innerHTML = "";
    host.style.textAlign = "";
    var st = document.createElement("div");
    st.style.cssText = "display:flex; flex-direction:column; gap:.4rem; width:100%; box-sizing:border-box; text-align:left;";
    // subject = preset family shortcut
    var subRow = document.createElement("div");
    subRow.style.cssText = "display:flex; gap:.4rem; align-items:center; flex-wrap:wrap; font-size:.78rem; color:#e8e3f5;";
    var subLab = document.createElement("span"); subLab.textContent = "Subject:"; subLab.style.cssText = "opacity:.8;";
    subRow.appendChild(subLab);
    [["Figure", "figure"], ["No figure", "place"], ["Mixed", "sample"]].forEach(function (pr) {
      var b = btn(pr[0], function () {
        model.preset = pr[1]; model.poolText = PRESETS[pr[1]].pools; model.off = {};
        save(); syncEditor(); toast("\uD83E\uDD16 subject: " + pr[0]);
      });
      if (model.preset === pr[1]) { try { b.setAttribute("aria-pressed", "true"); b.classList.add("dragon-studio-go"); } catch (e) {} }
      subRow.appendChild(b);
    });
    st.appendChild(subRow);
    // preset row (all four)
    var preRow = document.createElement("div");
    preRow.style.cssText = "display:flex; gap:.4rem; align-items:center; flex-wrap:wrap; font-size:.76rem; color:#e8e3f5;";
    var preLab = document.createElement("span"); preLab.textContent = "Preset:"; preLab.style.cssText = "opacity:.8;";
    preRow.appendChild(preLab);
    Object.keys(PRESETS).forEach(function (k) {
      preRow.appendChild(btn(PRESETS[k].label, function () {
        model.preset = k; model.poolText = PRESETS[k].pools; model.off = {};
        save(); syncEditor(); toast("\uD83E\uDD16 preset: " + PRESETS[k].label);
      }));
    });
    st.appendChild(preRow);
    // pool toggles
    var togLab = document.createElement("div");
    togLab.style.cssText = "font-size:.8rem; color:#d8d2ea;";
    togLab.textContent = "Pools (feed the random picks):";
    st.appendChild(togLab);
    var togHost = document.createElement("div");
    togHost.id = "dragonAutoToggles";
    togHost.style.cssText = "max-height:8rem; overflow-y:auto; border:1px solid var(--dt-border,#4a4a58); border-radius:8px; padding:.3rem .5rem;";
    st.appendChild(togHost);
    // manual add: pool select + word
    var addRow = document.createElement("div");
    addRow.style.cssText = "display:flex; gap:.35rem; align-items:center;";
    var sel = document.createElement("select");
    tag(sel);
    sel.id = "dragonAutoPoolSel";
    sel.style.cssText = "flex:1; min-width:6rem; background:var(--dt-bg2,#0f0f15); border:1px solid var(--dt-border,#4a4a58); border-radius:8px; color:var(--dt-fg,#e8e6ee); font-size:.78rem; padding:.35rem .45rem;";
    var word = mkInput("text", "");
    word.id = "dragonAutoWord";
    word.placeholder = "add a word to a pool\u2026";
    word.style.cssText = "flex:2; min-width:7rem; box-sizing:border-box; background:var(--dt-bg2,#0f0f15); border:1px solid var(--dt-border,#4a4a58); border-radius:8px; color:var(--dt-fg,#e8e6ee); font-size:.78rem; padding:.35rem .5rem;";
    var addB = btn("+ Add", function () {
      var w = String(word.value || "").trim().replace(/[:,]/g, "");
      if (!w) return;
      var lab = sel.value === "__new" ? null : sel.value;
      if (!lab) {
        lab = "new";
        model.poolText = String(model.poolText || "").trim() + (model.poolText.trim() ? "\n" : "") + lab + ": " + w;
      } else {
        var lines = String(model.poolText || "").split("\n");
        for (var i = 0; i < lines.length; i++) {
          if (lines[i].split(":")[0].trim() === lab) { lines[i] = lines[i].replace(/\s*$/, "") + ", " + w; break; }
        }
        model.poolText = lines.join("\n");
      }
      word.value = "";
      save(); syncEditor();
    });
    addRow.appendChild(sel); addRow.appendChild(word); addRow.appendChild(addB);
    st.appendChild(addRow);
    // raw editor (power users, agenty format)
    var rawLab = document.createElement("div");
    rawLab.style.cssText = "font-size:.8rem; color:#d8d2ea;";
    rawLab.textContent = "Pool text (label: word, word \u00B7 word^3 = often):";
    st.appendChild(rawLab);
    var raw = document.createElement("textarea");
    raw.id = "dragonAutoPools";
    raw.rows = 5;
    tag(raw);
    raw.style.cssText = "width:100%; box-sizing:border-box; background:var(--dt-bg2,#0f0f15); border:1px solid var(--dt-border,#4a4a58); border-radius:8px; color:var(--dt-fg,#e8e6ee); font-size:.78rem; padding:.4rem .5rem;";
    raw.addEventListener("change", function () { model.poolText = raw.value; model.off = {}; save(); syncEditor(); });
    st.appendChild(raw);
    // run settings
    var setRow = document.createElement("div");
    setRow.style.cssText = "display:flex; gap:.6rem; align-items:center; flex-wrap:wrap;";
    setRow.appendChild(numRow("Round (0=endless):", "round", 0, 100000, 2, "4.6rem"));
    setRow.appendChild(numRow("Count:", "count", 1, 100000, 4));
    setRow.appendChild(numRow("Batch:", "batch", 1, 6, 2));
    setRow.appendChild(numRow("Delay (s):", "delaySec", 0, 3600, 5));
    st.appendChild(setRow);
    var setHint = document.createElement("div");
    setHint.style.cssText = "font-size:.72rem; color:#9d9ab5;";
    setHint.textContent = "Round = production rounds \u00B7 Count = images per round \u00B7 Batch = presses per round \u00B7 Delay = pause between rounds";
    st.appendChild(setHint);
    var setRow2 = document.createElement("div");
    setRow2.style.cssText = "display:flex; gap:.6rem; align-items:center; flex-wrap:wrap; font-size:.78rem; color:#e8e3f5;";
    var fLab = document.createElement("span"); fLab.textContent = "Folder:"; fLab.style.cssText = "opacity:.8;";
    var fIn = mkInput("text", String(model.folder || FOLDER_DEFAULT));
    fIn.id = "dragonAutoFolder";
    fIn.style.cssText = "width:8rem; box-sizing:border-box; background:var(--dt-bg2,#0f0f15); border:1px solid var(--dt-border,#4a4a58); border-radius:8px; color:var(--dt-fg,#e8e6ee); font-size:.8rem; padding:.35rem .45rem;";
    fIn.addEventListener("change", function () { model.folder = String(fIn.value || "").trim() || FOLDER_DEFAULT; fIn.value = model.folder; save(); });
    var vLab = document.createElement("label");
    vLab.style.cssText = "display:flex; align-items:center; gap:.35rem;";
    var vCb = document.createElement("input");
    vCb.type = "checkbox"; vCb.checked = !!model.vault;
    tag(vCb);
    vCb.title = "also save finished cards into the private gallery folder";
    vCb.addEventListener("change", function () { model.vault = !!vCb.checked; save(); });
    var vTx = document.createElement("span"); vTx.textContent = "Private gallery copy";
    vLab.appendChild(vCb); vLab.appendChild(vTx);
    var hTx = document.createElement("span");
    hTx.textContent = "cards + history are automatic (normal Generate path)";
    hTx.style.cssText = "opacity:.8;";
    setRow2.appendChild(vLab); setRow2.appendChild(fLab); setRow2.appendChild(fIn); setRow2.appendChild(hTx);
    st.appendChild(setRow2);
    // run buttons
    var goRow = document.createElement("div");
    goRow.style.cssText = "display:flex; gap:.4rem; flex-wrap:wrap;";
    var bS = btn("\u25B6 Start", function () { api.start(); }, true);
    bS.id = "dragonAutoStart";
    var bX = btn("\u23F9 Stop", function () { api.stop(); });
    bX.id = "dragonAutoStop";
    var bP = btn("\u23F8 Pause", function () { api.pauseToggle(); });
    bP.id = "dragonAutoPause";
    goRow.appendChild(bS); goRow.appendChild(bX); goRow.appendChild(bP);
    st.appendChild(goRow);
    var stats = document.createElement("div");
    stats.id = "dragonAutoStats";
    stats.style.cssText = "font-size:.78rem; color:#c9b8ff; min-height:1.1rem;";
    st.appendChild(stats);
    var log = document.createElement("div");
    log.id = "dragonAutoLog";
    log.style.cssText = "font-size:.74rem; color:#9d9ab5; max-height:7rem; overflow-y:auto; border:1px solid var(--dt-border,#4a4a58); border-radius:8px; padding:.3rem .5rem;";
    st.appendChild(log);
    host.appendChild(st);
    ;function syncEditor() {
      var r = document.getElementById("dragonAutoPools");
      if (r) r.value = model.poolText || "";
      var s2 = document.getElementById("dragonAutoPoolSel");
      if (s2) {
        s2.innerHTML = "";
        parsePools(model.poolText).forEach(function (p) {
          var o = document.createElement("option");
          o.value = p.label; o.textContent = p.label;
          s2.appendChild(o);
        });
        var n = document.createElement("option");
        n.value = "__new"; n.textContent = "+ new pool";
        s2.appendChild(n);
      }
      var th = document.getElementById("dragonAutoToggles");
      if (th) renderPoolToggles(th);
      paint();
      if (logBuf.length) logLine(logBuf[logBuf.length - 1]);
    }
    window.__dragonAutoSync = syncEditor;
    syncEditor();
    if (run.active) paint();
    return true;
  }

  // ================= public API =================
  var api = {
    start: function (n) {
      if (run.active) { toast("\uD83E\uDD16 already running"); return false; }
      if (n != null) { model.round = clampInt(n, 0, 100000, 2); save(); }
      loop();
      return true;
    },
    stop: function () { if (run.active) { run.stop = true; } return true; },
    pauseToggle: function () {
      if (!run.active) return false;
      run.paused = !run.paused;
      paint();
      return true;
    },
    state: function () {
      return { active: run.active, paused: run.paused, round: run.round, ok: run.ok,
        failed: run.failed, rounds: model.round, folder: model.folder, lastPrompt: run.lastPrompt };
    },
    mkPrompt: makePrompts,
    onePrompt: function () { var a = makePrompts(1); return a.length ? a[0] : ""; },
    setPools: function (t) { model.poolText = String(t || ""); model.off = {}; save(); if (window.__dragonAutoSync) window.__dragonAutoSync(); },
    getPools: function () { return model.poolText || ""; }
  };
  window.dragonAutopilot = api;

  // ================= boot (mount into the Studio tab) =================
  var tries = 0;
  ;function boot() {
    if (build()) return;
    if (++tries < 80) setTimeout(boot, 500);
  }
  boot();
  window.dragonAutopilotBoot = boot;
})();
