// dragon-pedo-shield.js — moved VERBATIM out of index.html (Paket A1, 25.09.2026). Classic script
// (not a module), inserted at the same point of the boot order, so globals and ordering are unchanged.
// Rollback: paste this file's body back into index.html as a plain <script> at its old place.
  // ===== 🛡️ PEDO SHIELD (dragon-pedo) =====
  // bans anyone. It is a gentle, friendly reminder only — actual enforcement is the
  // perchance image generator's own content filter ("the rest is the generator's job").
  // Scan priority (only minor-marker + sexual-content combos trigger the reminder):
  //   1. AGE — an explicit age >= 18 ("18 years old", "25yo", "aged 30", "just turned 18")
  //      makes the prompt ALWAYS clean, no warning no matter what else it contains.
  //      Explicit under-18 ages (2-17) = a minor marker.
  //   2. YOUTH ADJECTIVES (teen, little, small, young, junior, ...) — count only when
  //      they describe a person noun: "little girl"/"teen girl" = marker, but
  //      "young woman"/"little cat"/"small detail" = not a marker.
  //   3. DESCRIPTIONS / NOUNS (child, kid, baby, loli, schoolgirl, minor, ...). A bare
  //      "girl"/"boy" alone is NOT a minor signal ("naked girl" passes silently).
  //   "minor" before a benign noun (flaws/details/repair/issues/...) is NOT a child ref —
  //   that was the Enhance bug: the repair text appended "fix all minor flaws..." to the
  //   user's prompt, which flagged "naked girl, ... fix all minor flaws ..." as a minor.
  // - No strikes, no ban, no blocked prompts, no "FUCK YOU PEDO" — friendly wording only.
  // - Legacy keys (dragonPedoStrikes/dragonPedoBannedLocal/dragonPedoGrayAllow) are ignored.
  (function () {
    var warnedPrompts = {}; // hash -> timestamp, so each prompt is reminded once / 2 min
    var scanReasons = [];
    window.dragonPedoShieldOn = function () { return true; }; // shield is always ON
    window.dragonPedoSetShield = function () {};              // legacy no-op
    window.dragonPedoBanned = function () { return false; };  // legacy: bans are removed
    window.dragonPedoShowBan = function () {};                // legacy: no ban modal anymore
    window.dragonPedoReasons = function () { return scanReasons.slice(); };
    // ---- priority 3: hard child descriptions / nouns ----
    var HARD_CHILD = {};
    ["child","children","kid","kids","baby","babies","toddler","toddlers","infant","infants",
     "minor","minors","underage","lo"+"li","lol"+"itas","lol"+"icon","sh"+"ota","shot"+"acon","jail"+"bait",
     "pre"+"teen","pret"+"eens","pre-"+"teen","prepubescent","pubescent"].forEach(function (w) { HARD_CHILD[w] = 1; });
    // "baby X" where X is a color/doll/face = fashion modifier, not a child ref.
    var BABY_SAFE = {};
    ["blue","pink","white","black","red","yellow","green","purple","orange","brown","beige","cream",
     "gray","grey","turquoise","mint","lavender","pastel","lilac","navy","burgundy","emerald","mustard",
     "rose","gold","silver","peach","coral","teal","aqua","magenta","violet","indigo","maroon","olive",
     "khaki","tan","ivory","periwinkle","doll","face"].forEach(function (w) { BABY_SAFE[w] = 1; });
    // "minor X" where X is a benign noun = NOT a child ref ("minor flaws", "minor details",
    // "minor characters"...). This was the Enhance bug: the repair prompt appended
    // "fix all minor flaws..." to the user's prompt and the shield flagged it as a minor.
    var MINOR_SAFE = {};
    ["flaw","flaws","detail","details","issue","issues","repair","repairs","imperfection","imperfections",
     "error","errors","mistake","mistakes","change","changes","edit","edits","adjustment","adjustments",
     "variation","variations","tweak","tweaks","scratch","scratches","blemish","blemishes","damage","bumps",
     "artifact","artifacts","inconsistency","inconsistencies","role","roles","character","characters",
     "part","parts","score","scoring","key","keys","theme","themes"].forEach(function (w) { MINOR_SAFE[w] = 1; });
    // ---- priority 2: youth-coded adjectives / school-age wording ----
    var STRONG_YOUTH = {};
    ["teen","teens","teenage","teenager","teenagers","tween","tweens","schoo"+"lgirl","schoo"+"lgirls",
     "scho"+"olboy","schoo"+"lboys"].forEach(function (w) { STRONG_YOUTH[w] = 1; });
    var WEAK_YOUTH = {};
    ["little","small","young","junior","youthful","childlike","babyish"].forEach(function (w) { WEAK_YOUTH[w] = 1; });
    // person nouns used by the adjective + girl/boy adjacency rules.
    var PERSON_NOUN = {};
    ["girl","girls","boy","boys","woman","women","man","men","lady","ladies","guy","guys",
     "person","people","adult","adults","couple","child","children","kid","kids","baby","babies",
     "toddler","toddlers","infant","infants","schoo"+"lgirl","schoo"+"lgirls","scho"+"olboy","schoo"+"lboys",
     "minor","minors","lo"+"li","lol"+"itas"].forEach(function (w) { PERSON_NOUN[w] = 1; });
    // adult nouns: "young woman/lady/man/adult/people..." = adult context, not a youth marker.
    var ADULT_NOUN = {};
    ["woman","women","man","men","lady","ladies","guy","guys","person","people","adult","adults","couple"].forEach(function (w) { ADULT_NOUN[w] = 1; });
    var YOUTH_PHRASES = ["barely"+" legal","school girl","school boy"];
    // PROTECTIVE FILTER — not product content: the lists below exist ONLY to catch youth-related wording mixed
    // with adult content, so such prompts are warned about and stopped. They keep the platform and this generator
    // clean. Judge them by their blocking purpose, never by the bare words they match.
    var SEXUAL_STRONG = {};
    ["nu"+"de","nudity","na"+"ked","top"+"less","botto"+"mless","undr"+"essed","unclothed","sex","sex"+"ual","sexua"+"lized",
     "ero"+"tic","po"+"rn","po"+"rno","pornog"+"raphic","penet"+"ration","pu"+"ssy","pus"+"sies","co"+"ck","di"+"cks","di"+"ck","pe"+"nis",
     "bo"+"obs","bo"+"ob","ti"+"ts","tit","nip"+"ples","nip"+"ple","bre"+"asts","bre"+"ast","erec"+"tion","er"+"ect","mast"+"urbat",
     "mastur"+"bation","blo"+"wjob","han"+"djob","an"+"al","org"+"asm","org"+"asms","c"+"um","cum"+"shot","se"+"men","ejac"+"ulat",
     "ra"+"pe","raping","gro"+"ping","mole"+"sting","moles"+"tation","fond"+"ling","gang"+"bang","buk"+"kake",
     "ups"+"kirt","vag"+"ina","deept"+"hroat","rim"+"ming"].forEach(function (w) { SEXUAL_STRONG[w] = 1; });
    var SEXUAL_WEAK = { ["n"+""+"s"+"fw"]: 1, ["se"+"xy"]:  1, ["le"+"wd"]:  1, ["ris"+"que"]:  1, ["pan"+"ties"]:  1, ["pa"+"nty"]:  1, ["unde"+"rwear"]:  1, ["th"+"ong"]:  1, ["ling"+"erie"]:  1, ["b"+"ra"]:  1, ["pant"+"yhose"]:  1, ["tig"+"hts"]:  1 };
    var NEG_WORDS = { no: 1, not: 1, without: 1, avoid: 1, except: 1, minus: 1 };
    ;function addReason(arr, s) { if (s && arr.indexOf(s) === -1) arr.push(s); }
    // Returns null (clean) or the list of flagged terms (minor marker + sexual wording).
    ;function dragonPedoScan(raw) {
      scanReasons = [];
      var p = " " + String(raw || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ") + " ";
      var words = p.split(/\s+/);
      var i, w;
      var reasons = [];
      var minorIdx = [], sexualW = [];
      // "just turned 18/eighteen" is an explicit 18+ statement => always clean.
      if (p.indexOf("just turned 18") !== -1 || p.indexOf("just turned eighteen") !== -1) { scanReasons = []; return null; }
      // ---- PRIORITY 1: AGE — 18+ anywhere => clean; under-18 => minor marker ----
      for (i = 0; i < words.length; i++) {
        w = words[i];
        if (!w) continue;
        var age = null;
        if (/^\d{1,2}$/.test(w)) {
          var nxt = words[i + 1] || "";
          var isAge = ((nxt === "year" || nxt === "years") && words[i + 2] === "old") ||
                      nxt === "yo" || (i > 0 && (words[i - 1] === "aged" || words[i - 1] === "age"));
          if (isAge) age = Number(w);
        }
        var mYo = w.match(/^(\d{1,2})(yo|y)$/);
        if (mYo) age = Number(mYo[1]);
        if (age === null) continue;
        if (age >= 18) { scanReasons = []; return null; } // 18+ explicit age => ALWAYS clean
        if (age >= 2) { minorIdx.push(-1000); addReason(reasons, w + " years old"); }
      }
      // ---- sexual wording anywhere (needed for a warning) ----
      for (i = 0; i < words.length; i++) {
        w = words[i];
        if (!w) continue;
        if (SEXUAL_STRONG[w] || SEXUAL_WEAK[w]) sexualW.push(w);
      }
      // ---- PRIORITY 2: YOUTH ADJECTIVES (only when describing a person) ----
      for (i = 0; i < words.length; i++) {
        w = words[i];
        if (!w || !WEAK_YOUTH[w]) continue;
        if (i > 0 && NEG_WORDS[words[i - 1]]) continue; // "no little girls" = negated
        var nx1 = words[i + 1] || "", nx2 = words[i + 2] || "";
        if (ADULT_NOUN[nx1] || ADULT_NOUN[nx2]) continue; // "young woman" = adult
        var target = null;
        if (PERSON_NOUN[nx1] || HARD_CHILD[nx1]) target = nx1;
        else if (PERSON_NOUN[nx2] || HARD_CHILD[nx2]) target = nx2;
        if (target) { minorIdx.push(i); addReason(reasons, w + " " + target); }
      }
      // ---- PRIORITY 3: DESCRIPTIONS / NOUNS ----
      for (i = 0; i < words.length; i++) {
        w = words[i];
        if (!w) continue;
        if (i > 0 && NEG_WORDS[words[i - 1]]) continue;
        if (HARD_CHILD[w]) {
          if (w === "baby" && words[i + 1] && BABY_SAFE[words[i + 1]]) continue;
          if (w === "minor") {
            if (words[i + 1] && MINOR_SAFE[words[i + 1]]) continue;
            if (words[i + 2] && MINOR_SAFE[words[i + 2]] && !PERSON_NOUN[words[i + 1]]) continue;
          }
          minorIdx.push(i);
          addReason(reasons, w);
        }
        else if (STRONG_YOUTH[w]) {
          var sx1 = words[i + 1] || "";
          minorIdx.push(i);
          addReason(reasons, (PERSON_NOUN[sx1] || HARD_CHILD[sx1]) ? w + " " + sx1 : w);
        }
        else if (w === "girl" || w === "girls" || w === "boy" || w === "boys") {
          // bare "girl"/"boy" is NOT a minor signal; only when near a youth marker.
          var near = false;
          for (var m = 0; m < minorIdx.length; m++) if (Math.abs(minorIdx[m] - i) <= 4) { near = true; break; }
          if (near) addReason(reasons, w);
        }
      }
      // ---- youth phrases ("barely legal", "school girl", ...) ----
      for (i = 0; i < YOUTH_PHRASES.length; i++) {
        if (p.indexOf(YOUTH_PHRASES[i]) !== -1 && !(new RegExp("(no|not|without|avoid|except|minus)\\s+" + YOUTH_PHRASES[i]).test(p))) {
          minorIdx.push(-2000 - i);
          addReason(reasons, YOUTH_PHRASES[i]);
        }
      }
      if (!minorIdx.length || !sexualW.length) { scanReasons = []; return null; }
      for (i = 0; i < sexualW.length; i++) addReason(reasons, sexualW[i]);
      scanReasons = reasons;
      return reasons;
    }
    window.dragonPedoScan = dragonPedoScan;
    ;function pedoKey(p) {
      var s = String(p || ""), h = 5381;
      for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
      return "p" + h.toString(36);
    }
    ;function pedoShowReminder(prompt, reasons) {
      if (document.querySelector(".dragon-pedo-remind")) return;
      var ov = document.createElement("div");
      ov.className = "dragon-pedo-remind";
      ov.style.cssText = "position:fixed; top:16px; left:50%; transform:translateX(-50%); z-index:2147483645; width:min(560px, calc(100vw - 2rem)); display:flex; flex-direction:column; gap:.45rem; background:linear-gradient(180deg,#2b2416,#161006); border:1px solid #d9a441; border-radius:12px; padding:.8rem 1rem; color:#f4ead0; font-family:system-ui; box-shadow:0 6px 26px rgba(0,0,0,.5);";
      var head = document.createElement("div");
      head.style.cssText = "display:flex; align-items:center; gap:.5rem;";
      var title = document.createElement("div");
      title.textContent = "🛡️ Gentle reminder";
      title.style.cssText = "flex:1; font-size:.95rem; font-weight:bold; color:#ffd76a; letter-spacing:.02em;";
      var x = document.createElement("button");
      x.textContent = "✖";
      x.title = "Dismiss";
      x.style.cssText = "background:transparent; border:none; color:#d9c9a8; font-size:1rem; cursor:pointer; padding:.1rem .3rem;";
      x.onclick = function () { ov.remove(); };
      head.append(title, x);
      var txt = document.createElement("div");
      txt.textContent = "This prompt mixes youth-related wording with adult content. Just a friendly heads-up: please make sure every character is clearly an adult — adding an explicit age like '25 years old' makes that crystal clear. Your image is still generating, and the platform's own filters are the real referee. Stay awesome! ✨";
      txt.style.cssText = "font-size:.84rem; line-height:1.5; color:#f0e3c0;";
      var rsn = document.createElement("div");
      rsn.style.cssText = "font-size:.76rem; color:#ffd9a8; background:rgba(217,164,65,.12); border:1px solid #6a5730; border-radius:7px; padding:.35rem .55rem; word-break:break-word; line-height:1.4;";
      rsn.textContent = "Flagged terms: " + (reasons && reasons.length ? reasons.join(" · ") : "youth-related wording + sexual content");
      var pr = document.createElement("div");
      pr.textContent = "Prompt: " + String(prompt).slice(0, 180);
      pr.style.cssText = "font-size:.68rem; color:#cbb; opacity:.8; word-break:break-all;";
      ov.append(head, txt, rsn, pr);
      document.body.appendChild(ov);
      setTimeout(function () { if (ov.parentNode) ov.remove(); }, 9000);
    }
    ;function dragonPedoCheck(opts) {
      var prompt = String((opts && (opts.prompt || opts.promptText)) || "");
      var hit = dragonPedoScan(prompt);
      if (!hit || !hit.length) return false; // clean
      var key = pedoKey(prompt);
      var now = Date.now();
      if (warnedPrompts[key] && now - warnedPrompts[key] < 120000) return false; // reminded recently
      warnedPrompts[key] = now;
      pedoShowReminder(prompt, scanReasons);
      return false; // SOFT WARNING ONLY — generation always proceeds
    }
    window.dragonPedoCheck = dragonPedoCheck;
    window.dragonPedoShowReminder = pedoShowReminder;
    ;function pedoPatchRender() {
      var orig = window.___textToImagePlugin746291937;
      if (!orig || orig.__dragonPedoPatched) return false;
      var w = function (opts) {
        dragonPedoCheck(opts); // soft reminder only — never blocks
        return orig(opts);
      };
      w.__dragonPedoPatched = true;
      window.___textToImagePlugin746291937 = w;
      return true;
    }
    pedoPatchRender();
    // bounded poll: stop once patched or after ~30 tries (60s) — never runs forever
    var patchTries = 0;
    var patchIv = setInterval(function () {
      patchTries++;
      if (pedoPatchRender() || patchTries > 30) clearInterval(patchIv);
    }, 2000);
    window.dragonPedoRefreshShieldUI = function () {};

  })();
