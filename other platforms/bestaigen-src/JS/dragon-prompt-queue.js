// dragon-prompt-queue.js — moved VERBATIM out of index.html (Paket A1, 25.09.2026). Classic script
// (not a module), inserted at the same point of the boot order, so globals and ordering are unchanged.
// Rollback: paste this file's body back into index.html as a plain <script> at its old place.
(function () {
  var MAX = 10;
  var queue = [];
  var box = null, chips = null, ta = null;

  ;function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  ;function toastMsg(m) { try { if (window.toast) toast(m); else if (window.dragonToast) dragonToast(m); } catch (e) {} }

  ;function ensureUI() {
    if (box && document.body.contains(box)) return true;
    var t = document.querySelector('textarea[data-name="description"]');
    if (!t) return false;
    ta = t;
    var inner = t.closest(".input-inner");
    var ctn = t.closest(".input-ctn");
    if (!inner || !ctn) return false;
    var existing = ctn.querySelector("#dragonPromptQueue");
    if (existing) { box = existing; chips = box.querySelector(".dragon-pq-chips"); return true; }
    box = document.createElement("div");
    box.id = "dragonPromptQueue";
    chips = document.createElement("div");
    chips.className = "dragon-pq-chips";
    box.appendChild(chips);
    var wrap = t;
    while (wrap.parentElement && wrap.parentElement !== inner) wrap = wrap.parentElement;
    inner.insertBefore(box, wrap);
    var col = ctn.querySelector(".random-input-btn-ctn");
    if (col && !col.querySelector("#dragonPromptAddBtn")) {
      var add = document.createElement("button");
      add.type = "button";
      add.id = "dragonPromptAddBtn";
      add.className = "random-input-btn dragon-pq-add";
      // 🖐 W-UI116 (third round) — stable movable-button key (see the toolbox buttons in dragon-pages.js).
      add.dataset.d = "pqadd";
      add.textContent = "\u2795";
      add.title = "Add new prompt line (max 10)";
      add.setAttribute("aria-label", "Add new prompt line");
      add.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); enqueue(); });
      col.appendChild(add);
    }
    render();
    return true;
  }

  ;function enqueue() {
    if (!ta) return;
    var v = String(ta.value || "").trim();
    if (!v) { toastMsg("\u270D\uFE0F Type a prompt first, then press \u2795"); return; }
    if (queue.length >= MAX) { toastMsg("\u2705 Queue is full (max 10)"); return; }
    queue.push(v);
    ta.value = "";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    if (window.input) { try { window.input.description = ""; } catch (e) {} }
    render();
    toastMsg("\uD83D\uDCDD Prompt line added (" + queue.length + "/" + MAX + ")");
  }

  ;function collapseAll() {
    if (!chips) return;
    Array.prototype.forEach.call(chips.querySelectorAll(".dragon-pq-edit"), function (ed) {
      ed.style.display = "none";
      var b = ed.parentElement.querySelector(".dragon-pq-btn");
      if (b) b.style.display = "flex";
    });
  }

  ;function render() {
    if (!chips) return;
    chips.innerHTML = "";
    if (queue.length) box.classList.add("has"); else box.classList.remove("has");
    queue.forEach(function (p, i) {
      var item = document.createElement("div");
      item.className = "dragon-pq-item";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dragon-pq-btn";
      btn.innerHTML = "<span class='dragon-pq-num'>" + (i + 1) + "</span><span class='dragon-pq-tag'>Prompt Line</span><span class='dragon-pq-txt'>" + esc(p) + "</span>";
      // description's .input-ctn, and the t2i framework's dice/append handlers resolve their target with
      // `el.closest(".input-ctn").querySelector("input, textarea")` then call `target.oninput({})`. Any
      // input/textarea placed BEFORE the real description field would be picked instead and crash with
      // "inputEl.oninput is not a function" (dice appears dead). A contenteditable DIV can never be picked.
      var edit = document.createElement("div");
      edit.className = "dragon-pq-edit";
      edit.contentEditable = "true";
      edit.spellcheck = false;
      edit.textContent = p;
      var del = document.createElement("button");
      del.type = "button";
      del.className = "dragon-pq-del";
      del.textContent = "\u2715";
      del.title = "Remove from queue";
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var open = getComputedStyle(edit).display !== "none";
        collapseAll();
        if (!open) { edit.style.display = "block"; btn.style.display = "none"; edit.focus(); }
      });
      edit.addEventListener("input", function () { queue[i] = edit.innerText; });
      edit.addEventListener("blur", function () { collapseAll(); });
      del.addEventListener("click", function (e) { e.stopPropagation(); e.preventDefault(); queue.splice(i, 1); render(); });
      item.append(btn, edit, del);
      chips.appendChild(item);
    });
  }

  window.__dragonPQ = {
    active: function () { return ensureUI() && queue.length > 0; },
    count: function () { return queue.length; },
    run: function () {
      if (!window.dragonSeqGenerate) return;
      var lines = queue.slice();
      var descNow = "";
      try { descNow = String((ta && ta.value) || "").trim(); } catch (eD) { descNow = ""; }
      if (descNow) lines.push(descNow);
      if (!lines.length) return;
      var count = 1;
      try {
        var csel = document.querySelector('[data-name="numImages"]');
        var cv = csel ? csel.value : ((window.input && window.input.numImages) || "");
        count = parseInt(cv, 10);
      } catch (eC) { count = 1; }
      if (!(count >= 1)) count = 1;
      if (count > 50) count = 50;
      var go = function () {
        // HISTORY so the ◀ ▶ previous/next buttons can recall it. Previously only prompts typed straight into
        // the description field and generated were recorded, so queued prompts never came back.
        try { if (window.dragonPushHist) lines.forEach(function (p) { window.dragonPushHist(p); }); } catch (e) {}
        var neg = (window.input && window.input.negative) || "";
        // the info anyway), and precreate:true lays out ALL queued tiles up-front so the screen is never
        // blank while the queue runs.
        var list = [];
        lines.forEach(function (p, i) {
          for (var k = 0; k < count; k++) {
            list.push({ label: "Prompt " + (i + 1) + (count > 1 ? " (" + (k + 1) + "/" + count + ")" : ""), prompt: p, negative: neg, noCaption: true });
          }
        });
        queue = [];
        render();
        // parallel:true starts every line at the same time instead of one by one.
        window.dragonSeqGenerate(list, {
          precreate: true,
          parallel: true,
          onProgress: function (i, t) { toastMsg("\uD83E\uDDFE " + i + "/" + t); },
          onDone: function (c) { toastMsg("\u2705 done \u2014 " + c + " image" + (c === 1 ? "" : "s")); }
        });
      };
      if (lines.length * count > 24 && window.dragonVaultConfirm) {
        window.dragonVaultConfirm({ title: "\uD83E\uDDFE Generate " + (lines.length * count) + " images?", body: lines.length + " prompt lines x " + count + " (Count) will generate " + (lines.length * count) + " images at once. Continue?", confirmText: "Continue" }).then(function (r) { if (r && r.ok) go(); });
        return;
      }
      go();
    }
  };
  window.dragonPQ = window.__dragonPQ;

  var hooked = false;
  ;function hook() {
    if (hooked) return;
    var orig = window.___generateButtonClickEvent746291937;
    if (typeof orig !== "function") return;
    if (orig.__dragonPQ) { hooked = true; return; }
    var wrapped = function (ev) {
      if (ensureUI() && queue.length) {
        try { if (ev && ev.preventDefault) ev.preventDefault(); } catch (e) {}
        window.__dragonPQ.run();
        return;
      }
      return orig.apply(this, arguments);
    };
    wrapped.__dragonPQ = true;
    window.___generateButtonClickEvent746291937 = wrapped;
    hooked = true;
  }
  hook();

  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    hook();
    ensureUI();
    if ((hooked && box) || tries > 400) clearInterval(iv);
  }, 250);

  document.addEventListener("click", function (e) {
    if (!box || !chips) return;
    if (e.target.closest && e.target.closest("#dragonPromptQueue")) return;
    collapseAll();
  }, true);
})();
