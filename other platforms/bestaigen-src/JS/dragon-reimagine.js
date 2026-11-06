// dragon-reimagine.js — moved VERBATIM out of index.html (Paket A1, 25.09.2026). Classic script
// (not a module), inserted at the same point of the boot order, so globals and ordering are unchanged.
// Rollback: paste this file's body back into index.html as a plain <script> at its old place.
// ===== Incremental re-apply from 1.3.0 — Item 7: 📷 Reimagine =====
(function () {
  if (window.__dragonReimagineInstalled) return;
  window.__dragonReimagineInstalled = true;

  ;function toast(m) { try { if (window.dragonToast) window.dragonToast(m); } catch (e) {} }

  // and it becomes clear what happened when production starts. (Previously, there was only a disappearing toast.)
  window.dragonWaitShield = function (msg) {
    try {
      var ov = document.createElement("div");
      ov.style.cssText = "position:fixed; inset:0; z-index:2147483647; background:rgba(6,4,10,.82); display:flex; align-items:center; justify-content:center; padding:1rem;";
      var box = document.createElement("div");
      box.style.cssText = "max-width:430px; width:100%; background:linear-gradient(180deg,#1a1424,#0c0a12); border:1px solid #9b6bff; border-radius:16px; padding:1.35rem 1.2rem; color:#efeaff; text-align:center; box-shadow:0 16px 50px rgba(0,0,0,.7); font-family:system-ui;";
      var sp = document.createElement("div");
      sp.textContent = "\u23F3";
      sp.style.cssText = "font-size:2rem; margin-bottom:.5rem; display:inline-block; animation:dragonWaitSpin 1.1s linear infinite;";
      var t = document.createElement("div");
      t.textContent = msg || "working\u2026";
      t.style.cssText = "font-size:.92rem; font-weight:700;";
      var sub = document.createElement("div");
      sub.textContent = "This can take a few seconds \u2014 please wait.";
      sub.style.cssText = "font-size:.74rem; opacity:.75; margin-top:.35rem;";
      box.append(sp, t, sub); ov.appendChild(box); document.body.appendChild(ov);
      if (!document.getElementById("dragonWaitShieldCss")) {
        var c = document.createElement("style"); c.id = "dragonWaitShieldCss";
        c.textContent = "@keyframes dragonWaitSpin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}";
        document.head.appendChild(c);
      }
      return { close: function () { try { ov.remove(); } catch (e) {} }, set: function (m) { t.textContent = m; } };
    } catch (e) { return { close: function () {}, set: function () {} }; }
  };

  ;function reimaginePick(basePrompt) {
    var styles = {
      "\uD83C\uDF8C Anime": "anime style, vibrant, highly detailed",
      "\uD83D\uDCF7 Realistic": "photorealistic, ultra detailed, 8k",
      "\uD83E\uDDEA 3D Render": "3D render, octane render, soft studio lighting",
      "\uD83D\uDD8C\uFE0F Oil Painting": "oil painting, impressionist brushstrokes, textured canvas",
      "\uD83D\uDC2D Disney": "Disney 3D animated movie style, big expressive eyes, playful",
      "\uD83C\uDF06 Cyberpunk": "cyberpunk, neon lights, futuristic, cinematic"
    };
    var m = window.modalShell("dragon-reimagine-modal", "min(520px,94vw)", "80vh", "\uD83D\uDCF7 Reimagine My Photo");
    var body = document.createElement("div");
    body.style.cssText = "flex:1; display:flex; flex-direction:column; gap:.7rem; overflow:auto;";
    var lab = document.createElement("div");
    lab.textContent = "Your photo prompt (editable):";
    lab.style.cssText = "font-size:.75rem; color:#9a9aab;";
    var ta = document.createElement("textarea");
    ta.value = basePrompt;
    ta.style.cssText = "width:100%; box-sizing:border-box; height:120px; resize:vertical; background:#0f0f15; color:#e8e6ee; border:1px solid #4a4a58; border-radius:8px; padding:.5rem; font-size:.78rem;";
    var lab2 = document.createElement("div");
    lab2.textContent = "Reimagine as:";
    lab2.style.cssText = "font-size:.75rem; color:#9a9aab;";
    var sel = document.createElement("select");
    if (window.dragonStyleSelect) window.dragonStyleSelect(sel);
    sel.style.cssText = "width:100%; box-sizing:border-box; background:#1a1a20; color:#eee; border:1px solid #6a6a78; border-radius:7px; padding:.4rem; font-size:.85rem;";
    var keys = Object.keys(styles);
    for (var i = 0; i < keys.length; i++) { var op = document.createElement("option"); op.value = keys[i]; op.textContent = keys[i]; sel.appendChild(op); }
    var go = document.createElement("button");
    go.textContent = "\u2728 Reimagine & Generate";
    go.style.cssText = "padding:.6rem .9rem; border:1px solid #22c55e; background:linear-gradient(145deg,#14532d,#052e16); color:#bbf7d0; border-radius:9px; cursor:pointer; font-size:.9rem;";
    go.onclick = function () {
      var phrase = styles[sel.value] || "";
      if (window.dragonSetDesc) window.dragonSetDesc(String(ta.value || basePrompt).trim() + (phrase ? ", " + phrase : ""));
      if (window.dragonForceSeed) window.dragonForceSeed(Math.floor(Math.random() * 1e9));
      else if (window.dragonLockSeed) window.dragonLockSeed(Math.floor(Math.random() * 1e9));
      m.close();
      var wait = window.dragonWaitShield ? window.dragonWaitShield("\uD83D\uDCF7 Generating your reimagined image\u2026") : null;
      if (window.dragonTriggerGen) window.dragonTriggerGen();
      toast("\uD83D\uDCF7 reimagining \u2014 generating\u2026");
      if (wait) {
        var _t = 0;
        var _iv = setInterval(function () {
          _t++;
          var oa = document.getElementById("outputAreaEl");
          if ((oa && oa.querySelector(".t2i-image-ctn")) || _t > 8) { clearInterval(_iv); wait.close(); }
        }, 500);
      }
    };
    body.append(lab, ta, lab2, sel, go);
    m.box.appendChild(body);
  }

  window.dragonReimagine = function () {
    var fi = document.createElement("input");
    fi.type = "file"; fi.accept = "image/png,image/jpeg,image/webp"; fi.style.display = "none";
    fi.onchange = function () {
      var f = fi.files && fi.files[0];
      fi.value = "";
      if (!f) return;
      var genFn = window.root && window.root.generateText;
      if (typeof genFn !== "function") { toast("AI helper isn't ready yet \u2014 try again"); return; }
      toast("\uD83D\uDCF7 reading your photo\u2026");
      var wait = window.dragonWaitShield ? window.dragonWaitShield("\uD83D\uDCF7 Reading your photo\u2026") : null;
      var resp = "";
      var instr = ["You are an expert image-prompt writer inside \"Best AI Image Generator\". LOOK at the attached photo and write ONE detailed, ready-to-use English image-generation prompt that recreates its subject: subject, pose, expression, outfit, style, lighting, composition, mood, camera angle. Output ONLY the prompt inside a fenced block like \`\`\`prompt\\n...\\n\`\`\` with no extra text before or after.", f];
      try {
        var genObj = root.generateText({ instruction: instr, onChunk: function (d) { if (d && d.textChunk) resp += d.textChunk; } });
        Promise.resolve(genObj).then(function (final) {
          try { if (final && typeof final === "object" && final.text) resp = final.text; else if (typeof final === "string" && final) resp = final; } catch (e) {}
          var m2 = /\`\`\`prompt\s*([\s\S]*?)\`\`\`/i.exec(resp);
          var prompt = m2 ? m2[1].trim() : (resp && resp.trim() ? resp.trim() : "");
          if (wait) wait.close();
          if (!prompt) { toast("\u26A0\uFE0F couldn't read the image \u2014 try again"); return; }
          reimaginePick(prompt);
        }).catch(function () { if (wait) wait.close(); toast("\u26A0\uFE0F couldn't read the image \u2014 try a clearer PNG/JPEG"); });
      } catch (e) { if (wait) wait.close(); toast("Something went wrong \u2014 try again?"); }
    };
    document.body.appendChild(fi);
    fi.click();
  };
})();
