// dragon-tag-combine.js — moved VERBATIM out of index.html (Paket A1, 25.09.2026). Classic script
// (not a module), inserted at the same point of the boot order, so globals and ordering are unchanged.
// Rollback: paste this file's body back into index.html as a plain <script> at its old place.
// #tagLocation# inside Base + negative prompt; tags are combined line by line (// disabled) with a delimiter.
// 4 test types: Singular / Consecutive (cumulative) / Combination (2^n) /
// Permutation (n!). Each card shows result prompt + negative + seed. Production is SEQUENTIAL (one by one).
(function () {
  if (window.__dragonTagLabInstalled) return;
  window.__dragonTagLabInstalled = true;
  ;function toast(m) { try { if (window.dragonToast) window.dragonToast(m); } catch (e) {} }
  ;function getArtSelect() { return document.querySelector('select[data-name="artStyle"]'); }
  ;function escapeHtml(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  ;function splitTags(raw) {
    return String(raw || "").split("\n").map(function (a) { return a.trim(); }).filter(function (a) { return a && a.indexOf("//") !== 0; });
  }
  ;function subsets(arr) {
    var out = [], n = arr.length;
    for (var m = 0; m < (1 << n); m++) { var s = []; for (var i = 0; i < n; i++) if (m & (1 << i)) s.push(arr[i]); out.push(s); }
    return out;
  }
  ;function perms(arr) {
    if (!arr.length) return [[]];
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var rest = arr.slice(0, i).concat(arr.slice(i + 1));
      var sub = perms(rest);
      for (var j = 0; j < sub.length; j++) out.push([arr[i]].concat(sub[j]));
    }
    return out;
  }
  ;function combosFor(mode, tags) {
    if (mode === "singular") return tags.map(function (t) { return [t]; });
    if (mode === "consecutive") return tags.map(function (t, i) { return tags.slice(0, i + 1); });
    if (mode === "combination") return subsets(tags);
    if (mode === "permutation") { if (tags.length > 7) return null; return perms(tags); }
    return tags.map(function (t) { return [t]; });
  }
  // replace #tagLocation# in base/neg with the combined tag string.
  ;function applyTags(base, negBase, tagStr, delimiter) {
    var hasPos = /#tagLocation#/.test(base), hasNeg = /#tagLocation#/.test(negBase);
    var t = String(tagStr || "").replace(/,\s*$/, "");
    var pos, neg;
    if (hasPos) pos = t ? base.replace(/#tagLocation#/g, t) : base.replace(/#tagLocation#,?\s*/g, "").trim();
    else pos = t ? (base ? (base.replace(/[,\s]+$/, "") + delimiter + t) : t) : base;
    if (hasNeg) neg = t ? negBase.replace(/#tagLocation#/g, t) : negBase.replace(/#tagLocation#,?\s*/g, "").trim();
    else neg = negBase;
    return { pos: pos, neg: neg };
  }

  // ---- sequential generator (shared; multi-premade also uses this) ----
  window.dragonSeqGenerate = function (list, opts) {
    opts = opts || {};
    var s = window.___userSettings746291937;
    var oa = document.getElementById("outputAreaEl");
    if (!s || !s.imageOptions) { toast("\u26A0\uFE0F generator isn't ready yet"); return; }
    if (!window.___textToImagePlugin746291937) { toast("\u26A0\uFE0F plugin not ready"); return; }
    if (!oa) return;
    window.__dragonSeqRunning = true;
    if (opts.clear !== false) oa.innerHTML = "";
    var savedDesc = (window.input && window.input.description) || "";
    var savedNeg = (window.input && window.input.negative) || "";
    var fixedSeed = (opts.seed != null && opts.seed !== "") ? Number(opts.seed) : null;
    var doneCount = 0;
    ;function restore() { try { if (window.input) { window.input.description = savedDesc; window.input.negative = savedNeg; } } catch (e) {} }

    // while the queue runs. Every tile shows its "Prompt N" heading plus a status line
    // (Queued → Generating… → Done); the ACTIVE tile swaps its placeholder for the real generation. The
    // shared capture pipeline only sees a tile once it becomes active (the .t2i-image-ctn class is added
    // then), so it gets exactly ONE progress bar and is recorded into History like a normal image.
    var shells = [];
    ;function setStatus(shell, txt) {
      if (!shell) return;
      var st = shell.ctn.querySelector(".dragon-queue-status");
      if (st) st.textContent = txt;
    }
    if (opts.precreate) {
      list.forEach(function (item, i) {
        var shCtn = document.createElement("div");
        shCtn.className = "dragon-queue-shell";
        shCtn.style.cssText = "margin:0.25rem; margin-bottom:0.6rem; position:relative; display:flex; flex-direction:column; align-items:center;";
        var shLab = document.createElement("div");
        shLab.textContent = item.label || ("Prompt " + (i + 1));
        shLab.style.cssText = "max-width:100%; margin-bottom:.35rem; padding:.2rem .7rem; font-size:.8rem; font-weight:bold; color:#e2d6ff; background:rgba(155,107,255,.18); border:1px solid rgba(155,107,255,.45); border-radius:9px; text-align:center;";
        var shHolder = document.createElement("div");
        shHolder.style.cssText = "display:flex; justify-content:center;";
        var shPh = document.createElement("div");
        shPh.style.cssText = "width:min(340px,74vw); aspect-ratio:1/1; border-radius:12px; border:1px dashed rgba(155,107,255,.35); background:rgba(155,107,255,.05); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:.45rem; color:#9d94bb; font-size:.82rem; text-align:center;";
        shPh.innerHTML = "<div style='font-size:1.9rem'>\u23F3</div>";
        shHolder.appendChild(shPh);
        // NOTE: the status line lives OUTSIDE the placeholder (the placeholder is dropped when the tile
        // becomes active), so it survives and can be updated to Generating…/Done.
        var shStat = document.createElement("div");
        shStat.className = "dragon-queue-status";
        shStat.textContent = "Queued";
        shStat.style.cssText = "margin-top:.3rem; font-size:.76rem; font-weight:bold; color:#b9a6ff; text-align:center;";
        var shUnder = document.createElement("div");
        shUnder.className = "t2i-under-each-image-ctn";
        shCtn.append(shLab, shHolder, shStat, shUnder);
        oa.appendChild(shCtn);
        shells.push({ ctn: shCtn, lab: shLab, holder: shHolder, under: shUnder });
      });
    }

    ;function makeCard(item, cb, shell) {
      var ctn, holder, under;
      if (shell) {
        ctn = shell.ctn; holder = shell.holder; under = shell.under;
        ctn.classList.add("t2i-image-ctn");        // let the shared capture/history pipeline see this tile
        while (holder.firstChild) holder.removeChild(holder.firstChild);
        setStatus(shell, "Generating\u2026");
      } else {
        ctn = document.createElement("div");
        ctn.className = "t2i-image-ctn dragon-taglab-ctn";
        ctn.style.cssText = "margin:0.25rem; margin-bottom:0.6rem; position:relative; display:flex; flex-direction:column; align-items:center;";
        var lab = document.createElement("div");
        lab.textContent = item.label || "";
        lab.style.cssText = "max-width:100%; margin-bottom:.3rem; padding:.15rem .55rem; font-size:.72rem; font-weight:bold; color:#d8c9ff; background:rgba(155,107,255,.14); border:1px solid rgba(155,107,255,.35); border-radius:8px; white-space:normal; word-break:break-word; text-align:center;";
        holder = document.createElement("div");
        holder.style.cssText = "display:flex; justify-content:center;";
        under = document.createElement("div");
        under.className = "t2i-under-each-image-ctn";
        ctn.append(lab, holder);
        oa.appendChild(ctn);
      }
      try {
        if (window.input) { window.input.description = item.prompt; window.input.negative = item.negative; }
        var clone = s.imageOptions.createClone;
        clone.prompt = s.imageOptions.prompt.evaluateItem;
        clone.negativePrompt = s.imageOptions.negativePrompt.evaluateItem;
        if (fixedSeed != null) clone.seed = fixedSeed;
        holder.innerHTML = String(window.___textToImagePlugin746291937(clone));
      } catch (e) { holder.innerHTML = "<div style='color:#f88'>generation error</div>"; }
      // available in the image info), so only the non-queue callers get the seed/prompt caption.
      if (!item.noCaption) {
        var cap = document.createElement("div");
        cap.className = "dragon-queue-cap";
        cap.style.cssText = "margin-top:.35rem; max-width:min(560px,90vw); font-size:.68rem; color:#b9b3cc; text-align:center; line-height:1.35; word-break:break-word;";
        cap.innerHTML = "<div style='font-weight:bold; color:#d8c9ff;'>seed: <span class='dragon-taglab-seed'>" + (fixedSeed != null ? fixedSeed : "\u2026") + "</span></div>" +
          "<div style='opacity:.85'>prompt: " + escapeHtml(item.prompt) + "</div>" +
          (item.negative ? "<div style='opacity:.7'>negative: " + escapeHtml(item.negative) + "</div>" : "");
        ctn.appendChild(cap);
      }
      ctn.appendChild(under);
      var tries = 0;
      var iv = setInterval(function () {
        tries++;
        var f = holder.querySelector("iframe");
        var o = f && f.textToImagePluginOutput;
        if (o && o.dataUrl) {
          clearInterval(iv);
          try { if (window.dragonMarkFreshImage) window.dragonMarkFreshImage(o.dataUrl); } catch (eMK) {}
          try { var sd = o.inputs && o.inputs.seed; if (sd != null) { var se = ctn.querySelector(".dragon-taglab-seed"); if (se) se.textContent = String(sd); } } catch (e) {}
          if (shell) setStatus(shell, "\u2705 Done");
          cb();
        } else if (tries > 180) { clearInterval(iv); if (shell) setStatus(shell, "\u26A0\uFE0F timed out"); cb(); }
      }, 1000);
    }

    var idx = 0;
    ;function next() {
      if (idx >= list.length) { restore(); window.__dragonSeqRunning = false; if (opts.onDone) opts.onDone(doneCount); return; }
      var item = list[idx++];
      if (opts.onProgress) opts.onProgress(idx, list.length);
      makeCard(item, function () { doneCount++; next(); }, shells[idx - 1]);
    }
    if (opts.parallel) {
      if (!list.length) { restore(); window.__dragonSeqRunning = false; if (opts.onDone) opts.onDone(0); return; }
      var pending = list.length;
      list.forEach(function (item, i) {
        makeCard(item, function () {
          doneCount++;
          if (opts.onProgress) opts.onProgress(doneCount, list.length);
          if (--pending <= 0) { restore(); window.__dragonSeqRunning = false; if (opts.onDone) opts.onDone(doneCount); }
        }, shells[i]);
      });
      return;
    }
    next();
  };

  window.dragonTagLab = function (host) {
    if (!window.modalShell) { toast("can't open tag lab"); return; }
    var m = window.modalShell("dragon-taglab-modal", "min(860px,96vw)", "92vh", "\uD83E\uDDEA Prompt Tag Lab", host);
    if (!m) return;
    var wrap = document.createElement("div");
    wrap.style.cssText = "flex:1; min-height:0; display:flex; flex-direction:column; gap:.5rem; overflow:auto;";
    var taCss = "width:100%; box-sizing:border-box; min-height:4.2rem; resize:vertical; padding:.4rem .5rem; border:1px solid #4a4a58; border-radius:8px; background:#0f0f15; color:#e8e6ee; font-size:.8rem;";
    ;function field(label, ph) {
      var f = document.createElement("div"); f.style.cssText = "display:flex; flex-direction:column; gap:.2rem;";
      var l = document.createElement("div"); l.textContent = label; l.style.cssText = "font-size:.72rem; color:#b9a6ff; font-weight:bold;";
      var t = document.createElement("textarea"); t.placeholder = ph || ""; t.style.cssText = taCss;
      f.append(l, t); return { f: f, t: t };
    }
    var dta = document.querySelector('textarea[data-name="description"]');
    var baseF = field("Base Prompt \u2014 put #tagLocation# where the tags should go", "e.g. portrait of a woman, #tagLocation#, cinematic lighting");
    baseF.t.value = (window.input && window.input.description) || (dta ? dta.value : "") || "";
    var negF = field("Negative Prompt (optional) \u2014 may also contain #tagLocation#", "what you don't want\u2026");
    try { negF.t.value = (window.input && window.input.negative) || ""; } catch (e) {}
    var tagF = field("Tags \u2014 one per line (start a line with // to disable)", "red hair\nblue eyes\nsmiling");
    wrap.append(baseF.f, negF.f, tagF.f);
    var row = document.createElement("div");
    row.style.cssText = "display:flex; flex-wrap:wrap; align-items:center; gap:.5rem; border-top:1px solid rgba(255,255,255,.08); padding-top:.5rem;";
    ;function mksel(opts, val) {
      var s = document.createElement("select");
      if (window.dragonStyleSelect) window.dragonStyleSelect(s);
      s.style.cssText = "padding:.35rem .5rem; border:1px solid #4a4a58; border-radius:8px; background:#0f0f15; color:#e8e6ee; font-size:.78rem;";
      opts.forEach(function (o) { var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; s.appendChild(op); });
      if (val != null) s.value = val;
      return s;
    }
    var modeSel = mksel([["singular", "Singular (each tag on its own)"], ["consecutive", "Consecutive (sequential / cumulative)"], ["combination", "Combination (every 2^n subset)"], ["permutation", "Permutation (every n! ordering)"]], "consecutive");
    var delimSel = mksel([[", ", "delimiter: comma"], [" ", "delimiter: space"], ["|", "delimiter: |"], ["__custom__", "delimiter: custom\u2026"]], ", ");
    var customDelim = document.createElement("input");
    customDelim.placeholder = "custom delimiter";
    customDelim.style.cssText = "display:none; width:7rem; padding:.32rem .5rem; border:1px solid #4a4a58; border-radius:8px; background:#0f0f15; color:#e8e6ee; font-size:.76rem;";
    delimSel.onchange = function () { customDelim.style.display = delimSel.value === "__custom__" ? "" : "none"; };
    var seedWrap = document.createElement("label");
    seedWrap.style.cssText = "display:flex; align-items:center; gap:.35rem; font-size:.74rem; color:#cfc8e6; cursor:pointer;";
    var seedCb = document.createElement("input"); seedCb.type = "checkbox"; seedCb.checked = true;
    var seedInput = document.createElement("input"); seedInput.placeholder = "seed (blank = random)"; seedInput.type = "text";
    seedInput.style.cssText = "width:9rem; padding:.32rem .5rem; border:1px solid #4a4a58; border-radius:8px; background:#0f0f15; color:#e8e6ee; font-size:.74rem;";
    seedWrap.append(seedCb, document.createTextNode("\uD83D\uDD12 same seed (fair comparison)"));
    var info = document.createElement("span"); info.style.cssText = "font-size:.74rem; color:#9d9ab5;";
    var go = document.createElement("button"); go.type = "button";
    go.textContent = "\u26A1 Generate tags";
    go.style.cssText = "margin-left:auto; padding:.5rem 1.1rem; border:1px solid #22c55e; background:linear-gradient(145deg,#14532d,#052e16); color:#bbf7d0; border-radius:10px; cursor:pointer; font-size:.88rem; font-weight:bold;";
    row.append(modeSel, delimSel, customDelim, seedWrap, seedInput, info, go);
    wrap.append(row);
    var hint = document.createElement("div");
    hint.textContent = "\u2139\uFE0F If #tagLocation# is missing, tags are appended to the END of the base prompt. Images are generated one after another (sequentially).";
    hint.style.cssText = "font-size:.7rem; color:#8a8699;";
    wrap.append(hint);
    m.box.appendChild(wrap);

    ;function tagsNow() { return splitTags(tagF.t.value); }
    ;function delimNow() { return delimSel.value === "__custom__" ? (customDelim.value || ", ") : delimSel.value; }
    ;function fact(k) { return k <= 1 ? 1 : k * fact(k - 1); }
    ;function refreshInfo() {
      var tags = tagsNow(); var n = tags.length; var count = 0; var mode = modeSel.value;
      if (mode === "singular") count = n;
      else if (mode === "consecutive") count = n;
      else if (mode === "combination") count = n > 20 ? Infinity : Math.pow(2, n);
      else if (mode === "permutation") count = n > 10 ? Infinity : fact(n);
      info.textContent = n + " tag" + (n === 1 ? "" : "s") + " \u2192 " + (isFinite(count) ? count : "too many") + " image" + (count === 1 ? "" : "s");
    }
    tagF.t.addEventListener("input", refreshInfo);
    modeSel.onchange = refreshInfo;
    refreshInfo();

    go.onclick = function () {
      var tags = tagsNow();
      if (!tags.length) { toast("\uD83E\uDDEA enter at least one tag"); return; }
      var mode = modeSel.value;
      var comboList = combosFor(mode, tags);
      if (!comboList) { toast("\u26A0\uFE0F too many tags (max 7 for permutation)"); return; }
      var _runCombo = function () {
        var delim = delimNow();
        var base = baseF.t.value, negBase = negF.t.value;
        var fixedSeed = seedCb.checked ? (String(seedInput.value).replace(/\D/g, "") ? Number(String(seedInput.value).replace(/\D/g, "")) : Math.floor(Math.random() * 2147483647)) : null;
        var list = comboList.map(function (c) {
          var tagStr = c.join(delim);
          var r = applyTags(base, negBase, tagStr, delim);
          return { prompt: r.pos, negative: r.neg, label: tagStr || "(blank)" };
        });
        m.close();
        if (window.dragonSeqGenerate) window.dragonSeqGenerate(list, {
          seed: fixedSeed,
          onProgress: function (i, n) { toast("\uD83E\uDDEA " + i + "/" + n); },
          onDone: function (c) { toast("\u2705 tag lab done \u2014 " + c + " image" + (c === 1 ? "" : "s")); }
        });
      };
      if (comboList.length > 64) {
        window.dragonVaultConfirm({ title: "\uD83E\uDDEA Generate " + comboList.length + " images?", body: comboList.length + " images will be generated. Continue? (this may take a while)", confirmText: "Continue" }).then(function (r) { if (r.ok) _runCombo(); });
        return;
      }
      _runCombo();
    };
  };

  ;function installButton() {
    // The 🧪 Prompt Tag Lab button under the Art Style dropdown is gone: the lab opens inside the 📝 Prompt
    // Panel's own tab now (window.dragonTagLab is unchanged). The button's production is in the Librarybook
    // DEPO.
    return true;
  }
  // Any button built by an earlier build is removed from the page.
  try { var _oldTagBtns = document.querySelectorAll(".dragon-taglab-open"); for (var _otg = 0; _otg < _oldTagBtns.length; _otg++) { try { _oldTagBtns[_otg].parentNode.removeChild(_oldTagBtns[_otg]); } catch (e) {} } } catch (e) {}
  var pending = false;
  ;function schedule() { if (pending) return; pending = true; setTimeout(function () { pending = false; installButton(); }, 300); }
  ;function start() { installButton(); if (document.body) dragonBodyObserve(schedule); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
