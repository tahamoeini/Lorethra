
// ===== Incremental re-apply from 1.3.0 — Item 5: Quick bar + Premade characters =====
(function () {
  if (window.__dragonQuickBarInstalled) return;
  window.__dragonQuickBarInstalled = true;

  ;function toast(m) { try { if (window.dragonToast) window.dragonToast(m); } catch (e) {} }

  var CUTE_OPTS = ["Off", "Subtle", "Soft", "Adorable", "Extra Maximum"];
  // Short names shown in Button/menu → actual (canonical) tier names. Main select and prompt values remain unchanged.
  var CUTE_DISPLAY = { "Extra Maximum": "Maximum" };
  ;function cuteDisplay(canonical) { return CUTE_DISPLAY[canonical] || canonical || "Off"; }
  var SHOT_OPTS = ["Auto", "Full Body", "Medium / Waist-up", "Cowboy Shot", "Close-up Portrait", "Head & Shoulders", "Extreme Close-Up"];
  var ANGLE_OPTS = ["Auto", "Low Angle", "Dramatic Low Angle", "High Angle", "Over-the-Shoulder", "From Behind", "Side Profile", "Three-Quarter View", "POV", "Top-Down", "Bottom-Up", "Dutch Angle", "Bird's-Eye View", "Worm's-Eye View", "Eye-Level", "Overhead / Flat Lay", "Reverse Angle"];
  var POSE_OPTS = ["None", "Standing", "Sitting", "Kneeling", "Lying Down", "Walking", "Running", "Jumping", "Leaning Against Wall", "Hands on Hips", "Arms Crossed", "Hand on Face", "Looking Over Shoulder", "Stretching", "Dancing", "Crouching", "Squatting", "Reference T-Pose", "Contemplative"];
  window.__dragonCuteMirrors = window.__dragonCuteMirrors || [];
  // ---- generic mirror machinery: quick-bar selects that mirror a hidden framework input (by data-name) ----
  // The framework restores the last remembered value into the real select on load, so the mirrors must
  // reflect that state or they'd lie (e.g. showing "Off" while another tier is actually active).
  window.__dragonMirrors = window.__dragonMirrors || {};
  ;function dragonSetMain(name, v) {
    var s = document.querySelector('[data-name="' + name + '"]');
    if (!s) return false;
    var found = false;
    for (var i = 0; i < s.options.length; i++) {
      if (String(s.options[i].value) === v || String(s.options[i].textContent || "").trim() === v) { s.selectedIndex = i; found = true; break; }
    }
    if (!found) return false;
    s.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  ;function dragonSyncMirror(name) {
    var ms = document.querySelector('[data-name="' + name + '"]');
    if (!ms || !ms.options) return;
    var t = (ms.selectedIndex >= 0 && ms.options[ms.selectedIndex]) ? String(ms.options[ms.selectedIndex].textContent || "").trim() : "";
    (window.__dragonMirrors[name] || []).forEach(function (sel) {
      if (!sel) return;
      if (typeof sel.update === "function") { sel.update(t); return; }
      if (!sel.options) return;
      var cur = (sel.selectedIndex >= 0 && sel.options[sel.selectedIndex]) ? String(sel.options[sel.selectedIndex].textContent || "").trim() : "";
      if (cur === t) return;
      for (var i = 0; i < sel.options.length; i++) {
        if (String(sel.options[i].textContent || "").trim() === t) { sel.selectedIndex = i; break; }
      }
    });
  }
  ;function dragonBindMirror(name) {
    var ms = document.querySelector('[data-name="' + name + '"]');
    if (!ms || ms.__dragonMirrorBound) return;
    ms.__dragonMirrorBound = true;
    ms.addEventListener("change", function () { dragonSyncMirror(name); });
  }
  ;function dragonRegisterMirror(name, sel) {
    (window.__dragonMirrors[name] = window.__dragonMirrors[name] || []).push(sel);
    if (name === "cuteness") window.__dragonCuteMirrors.push(sel);
    dragonBindMirror(name);
    dragonSyncMirror(name);
  }
  ;function dragonSyncAllMirrors() { Object.keys(window.__dragonMirrors || {}).forEach(dragonSyncMirror); }
  window.__dragonSyncAllMirrors = dragonSyncAllMirrors;
  // backward-compat alias used by the input-binding repair script
  window.__dragonSyncCuteMirrors = dragonSyncAllMirrors;
  // generic mirror select builder: labels + fallback option names; real options are cloned from the hidden select
  ;function mkMirrorSelect(name, label, labelColor, fallbackOpts, selCss) {
    var wrap = document.createElement("span");
    wrap.style.cssText = "flex:0 0 auto; display:inline-flex; align-items:center; gap:.25rem;";
    var lbl = document.createElement("span");
    lbl.textContent = label;
    lbl.style.cssText = "font-size:.72rem; font-weight:bold; color:" + labelColor + ";";
    var sel = document.createElement("select");
    if (window.dragonStyleSelect) window.dragonStyleSelect(sel);
    sel.style.cssText = selCss;
    // Tag at creation + guarantee the placeholder spec exists: the t2i framework's binding
    // loop (triggered early via an <img onerror>) crashes on any select inside its container
    // whose data-name isn't a known user input.
    sel.dataset.name = "";
    try {
      var uis = window.___userSettings746291937 && window.___userSettings746291937.userInputs;
      if (uis && !uis[""]) uis[""] = { excludeFromShareLink: true };
    } catch (e) {}
    var ms = document.querySelector('[data-name="' + name + '"]');
    var opts = (ms && ms.options && ms.options.length) ? [].slice.call(ms.options).map(function (o) { return o.textContent.trim(); }) : fallbackOpts;
    opts.forEach(function (o) { var op = document.createElement("option"); op.value = o; op.textContent = o; sel.appendChild(op); });
    sel.onchange = function () { if (dragonSetMain(name, sel.value)) toast(label + ": " + sel.value); };
    wrap.append(lbl, sel);
    dragonRegisterMirror(name, sel);
    return wrap;
  }
  // Pink Cuteness button + dropdown menu — replaces the raw <select> mirror in the quick bars.
  // It's a "mirror" with an .update() method, so its label follows the hidden cuteness select.
  // All buttons share ONE lazily-built menu (no orphaned menus when bars are rebuilt).
  var cuteMenuEl = null;
  var cuteMenuBtn = null;
  ;function currentCute() {
    try {
      var s = document.querySelector('[data-name="cuteness"]');
      if (s && s.selectedIndex >= 0) return String(s.options[s.selectedIndex].textContent || "").trim();
    } catch (e) {}
    return "Off";
  }
  // 📐 W-UI347 (Egon 27.09.2026) — the Control Panel's dropdown menus (🥰 Cuteness · 📷 Shot · 📐 Angle ·
  // 🧍 Pose) now follow the generator's dropdown standard (Rulebook I53/I88): the menu opens CENTERED under
  // its own button, never leaves the viewport, flips ABOVE the button when there is no room below, and is
  // registered in the central dropdown registry (I105) so outside-click / Escape / other-menu opening closes
  // it. They used to hug the button's LEFT edge, which is exactly what I88 forbids.
  ;function dragonPlaceMirrorMenu(menu, btn) {
    if (!menu || !btn) return;
    if (menu.style.display === "none") return;   // placement needs a laid-out menu
    try { menu.__dragonMenuAnchor = btn; } catch (e) {}
    try { if (window.dragonPlaceMenu) window.dragonPlaceMenu(menu, btn); } catch (e) {}
  }
  ;function dragonRegisterMirrorMenu(menu, closeFn) {
    // the placement registry (dragon-ui-scale.js) is global; the gallery's dropdown registry is only
    // installed while the public gallery is open, so it is used when present and skipped otherwise.
    try { if (window.dragonRegisterMenuEl) window.dragonRegisterMenuEl(menu); } catch (e) {}
    try { if (window.dragonHookOutside) window.dragonHookOutside(menu, closeFn); } catch (e) {}
    try { if (window.dragonRegisterDropdown) window.dragonRegisterDropdown(menu, closeFn); } catch (e) {}
  }
  window.dragonPlaceMirrorMenu = dragonPlaceMirrorMenu;
  ;function placeCuteMenu() { dragonPlaceMirrorMenu(cuteMenuEl, cuteMenuBtn); }
  ;function openCuteMenu(btn) {
    cuteMenuBtn = btn;
    if (shotMenuEl && shotMenuEl.style.display !== "none") shotMenuEl.style.display = "none";
    try { dragonCloseMirrorMenus(null); } catch (e) {}
    if (!cuteMenuEl) {
      var menu = document.createElement("div");
      menu.className = "dragon-cute-menu";
      menu.style.cssText = "display:none; position:fixed; z-index:99999; min-width:11rem; padding:.3rem; border:1px solid #ff6fa8; border-radius:10px; background:#241321; box-shadow:0 6px 20px rgba(0,0,0,.6);";
      CUTE_OPTS.forEach(function (o) {
        var it = document.createElement("button");
        it.type = "button";
        it.textContent = cuteDisplay(o);
        it.dataset.val = o;
        it.style.cssText = "display:block; width:100%; text-align:left; padding:.35rem .6rem; font-size:.78rem; font-weight:bold; color:#ffd0e2; background:transparent; border:0; border-radius:6px; cursor:pointer;";
        it.onmouseenter = function () { it.style.background = "rgba(255,111,168,.16)"; };
        it.onmouseleave = function () { it.style.background = it.classList.contains("dragon-cute-sel") ? "rgba(255,111,168,.24)" : "transparent"; };
        it.onclick = function (e) {
          e.stopPropagation();
          menu.style.display = "none";
          try { if (dragonSetMain("cuteness", o)) toast("\uD83E\uDD70 Cuteness: " + cuteDisplay(o)); } catch (err) {}
          dragonSyncMirror("cuteness");
        };
        menu.appendChild(it);
      });
      document.body.appendChild(menu);
      document.addEventListener("click", function (e) {
        if (menu.style.display !== "none" && !menu.contains(e.target) && !(e.target && e.target.classList && (e.target.classList.contains("dragon-cute-btn") || e.target.classList.contains("dragon-shot-btn"))) && !(shotMenuEl && shotMenuEl.contains(e.target))) menu.style.display = "none";
      });
      window.addEventListener("scroll", function () { if (menu.style.display !== "none") placeCuteMenu(); }, { passive: true });
      window.addEventListener("resize", function () { if (menu.style.display !== "none") placeCuteMenu(); });
      menu.__dragonCuteClose = function () { menu.style.display = "none"; };
      dragonRegisterMirrorMenu(menu, menu.__dragonCuteClose);
      cuteMenuEl = menu;
    }
    try { window.dragonCloseOtherDropdowns(cuteMenuEl.__dragonCuteClose); } catch (eCD) {}
    for (var i = 0; i < cuteMenuEl.children.length; i++) {
      var it = cuteMenuEl.children[i];
      var on = it.dataset.val === currentCute();
      it.classList.toggle("dragon-cute-sel", on);
      it.style.background = on ? "rgba(255,111,168,.24)" : "transparent";
    }
    cuteMenuEl.style.display = "block";
    placeCuteMenu();
  }
  ;function mkCuteBtn() {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dragon-cute-btn";
    btn.title = "Cuteness \u2014 select level";
    btn.style.cssText = "flex:0 0 auto; font-weight:bold; padding:.26rem .55rem; border-radius:999px; cursor:pointer; font-size:.7rem; border:1px solid #ff6fa8; background:linear-gradient(180deg,#4a1a2e,#2a1020); color:#ffb3d9;";
    btn.onclick = function (e) {
      e.stopPropagation();
      if (cuteMenuEl && cuteMenuEl.style.display !== "none" && cuteMenuBtn === btn) { cuteMenuEl.style.display = "none"; return; }
      openCuteMenu(btn);
    };
    ;function setLabel() { btn.textContent = "\uD83E\uDD70 Cuteness: " + cuteDisplay(currentCute()); }
    var mirror = { update: function () { setLabel(); } };
    (window.__dragonMirrors.cuteness = window.__dragonMirrors.cuteness || []).push(mirror);
    window.__dragonCuteMirrors.push(mirror);
    dragonBindMirror("cuteness");
    dragonSyncMirror("cuteness");
    setLabel();
    return btn;
  }
  // 📷 Shot / Angle button + dropdown menu — same pattern as the pink Cuteness button.
  var shotMenuEl = null;
  var shotMenuBtn = null;
  ;function currentShot() {
    try {
      var s = document.querySelector('[data-name="shot"]');
      if (s && s.selectedIndex >= 0) return String(s.options[s.selectedIndex].textContent || "").trim();
    } catch (e) {}
    return "Auto";
  }
  ;function placeShotMenu() { dragonPlaceMirrorMenu(shotMenuEl, shotMenuBtn); }
  ;function openShotMenu(btn) {
    shotMenuBtn = btn;
    if (cuteMenuEl && cuteMenuEl.style.display !== "none") cuteMenuEl.style.display = "none";
    try { dragonCloseMirrorMenus(null); } catch (e) {}
    if (!shotMenuEl) {
      var menu = document.createElement("div");
      menu.className = "dragon-shot-menu";
      menu.style.cssText = "display:none; position:fixed; z-index:99999; min-width:12rem; max-height:min(60vh,22rem); overflow-y:auto; padding:.3rem; border:1px solid #9ad8ff; border-radius:10px; background:#121a26; box-shadow:0 6px 20px rgba(0,0,0,.6);";
      SHOT_OPTS.forEach(function (o) {
        var it = document.createElement("button");
        it.type = "button";
        it.textContent = o;
        it.dataset.val = o;
        it.style.cssText = "display:block; width:100%; text-align:left; padding:.35rem .6rem; font-size:.78rem; font-weight:bold; color:#cfe8ff; background:transparent; border:0; border-radius:6px; cursor:pointer;";
        it.onmouseenter = function () { it.style.background = "rgba(154,216,255,.14)"; };
        it.onmouseleave = function () { it.style.background = it.classList.contains("dragon-shot-sel") ? "rgba(154,216,255,.22)" : "transparent"; };
        it.onclick = function (e) {
          e.stopPropagation();
          menu.style.display = "none";
          try { if (dragonSetMain("shot", o)) toast("\uD83D\uDCF7 Shot / Angle: " + o); } catch (err) {}
          dragonSyncMirror("shot");
        };
        menu.appendChild(it);
      });
      document.body.appendChild(menu);
      document.addEventListener("click", function (e) {
        if (menu.style.display !== "none" && !menu.contains(e.target) && !(e.target && e.target.classList && (e.target.classList.contains("dragon-shot-btn") || e.target.classList.contains("dragon-cute-btn"))) && !(cuteMenuEl && cuteMenuEl.contains(e.target))) menu.style.display = "none";
      });
      window.addEventListener("scroll", function () { if (menu.style.display !== "none") placeShotMenu(); }, { passive: true });
      window.addEventListener("resize", function () { if (menu.style.display !== "none") placeShotMenu(); });
      menu.__dragonShotClose = function () { menu.style.display = "none"; };
      dragonRegisterMirrorMenu(menu, menu.__dragonShotClose);
      shotMenuEl = menu;
    }
    try { window.dragonCloseOtherDropdowns(shotMenuEl.__dragonShotClose); } catch (eCD) {}
    for (var i = 0; i < shotMenuEl.children.length; i++) {
      var it = shotMenuEl.children[i];
      var on = it.dataset.val === currentShot();
      it.classList.toggle("dragon-shot-sel", on);
      it.style.background = on ? "rgba(154,216,255,.22)" : "transparent";
    }
    shotMenuEl.style.display = "block";
    placeShotMenu();
  }
  ;function mkShotBtn() {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dragon-shot-btn";
    btn.title = "Shot \u2014 select camera framing";
    btn.style.cssText = "flex:0 0 auto; font-weight:bold; padding:.26rem .55rem; border-radius:999px; cursor:pointer; font-size:.7rem; border:1px solid #9ad8ff; background:linear-gradient(180deg,#1a2438,#101a26); color:#9ad8ff;";
    btn.onclick = function (e) {
      e.stopPropagation();
      if (shotMenuEl && shotMenuEl.style.display !== "none" && shotMenuBtn === btn) { shotMenuEl.style.display = "none"; return; }
      openShotMenu(btn);
    };
    ;function setLabel() { btn.textContent = "\uD83D\uDCF7 Shot: " + currentShot(); }
    var mirror = { update: function () { setLabel(); } };
    (window.__dragonMirrors.shot = window.__dragonMirrors.shot || []).push(mirror);
    dragonBindMirror("shot");
    dragonSyncMirror("shot");
    setLabel();
    return btn;
  }
  // 📐 Angle + 🧍 Pose buttons — generic mirror-menu pattern (same behavior as 📷 Shot).
  var _dragonMirrorMenus = {}; // name -> { el, activeBtn }
  ;function dragonCloseMirrorMenus(exceptName) {
    Object.keys(_dragonMirrorMenus).forEach(function (n) {
      var m = _dragonMirrorMenus[n];
      if (n !== exceptName && m && m.el && m.el.style.display !== "none") m.el.style.display = "none";
    });
  }
  ;function mkMirrorMenuBtn(cfg) {
    var shared = _dragonMirrorMenus[cfg.name] = _dragonMirrorMenus[cfg.name] || { el: null, activeBtn: null };
    ;function current() {
      try {
        var s = document.querySelector('[data-name="' + cfg.name + '"]');
        if (s && s.selectedIndex >= 0) return String(s.options[s.selectedIndex].textContent || "").trim();
      } catch (e) {}
      return cfg.opts[0];
    }
    ;function place() { dragonPlaceMirrorMenu(shared.el, shared.activeBtn); }
    ;function buildMenu() {
      var menu = document.createElement("div");
      menu.className = "dragon-mirror-menu";
      menu.style.cssText = "display:none; position:fixed; z-index:99999; min-width:12rem; max-height:min(60vh,22rem); overflow-y:auto; padding:.3rem; border:1px solid " + cfg.border + "; border-radius:10px; background:" + cfg.menuBg + "; box-shadow:0 6px 20px rgba(0,0,0,.6);";
      cfg.opts.forEach(function (o) {
        var it = document.createElement("button");
        it.type = "button";
        it.textContent = o;
        it.dataset.val = o;
        it.style.cssText = "display:block; width:100%; text-align:left; padding:.35rem .6rem; font-size:.78rem; font-weight:bold; color:" + cfg.fg + "; background:transparent; border:0; border-radius:6px; cursor:pointer;";
        it.onmouseenter = function () { it.style.background = cfg.hover; };
        it.onmouseleave = function () { it.style.background = it.classList.contains("dragon-mirror-sel") ? cfg.sel : "transparent"; };
        it.onclick = function (e) {
          e.stopPropagation();
          menu.style.display = "none";
          try { if (dragonSetMain(cfg.name, o)) toast(cfg.toast + o); } catch (err) {}
          dragonSyncMirror(cfg.name);
        };
        menu.appendChild(it);
      });
      document.body.appendChild(menu);
      document.addEventListener("click", function (e) {
        if (menu.style.display !== "none" && !menu.contains(e.target) && !(e.target && e.target.classList && e.target.classList.contains(cfg.btnClass))) menu.style.display = "none";
      });
      window.addEventListener("scroll", function () { if (menu.style.display !== "none") place(); }, { passive: true });
      window.addEventListener("resize", function () { if (menu.style.display !== "none") place(); });
      menu.__dragonMirrorClose = function () { menu.style.display = "none"; };
      dragonRegisterMirrorMenu(menu, menu.__dragonMirrorClose);
      shared.el = menu;
    }
    ;function open() {
      if (!shared.el) buildMenu();
      try { window.dragonCloseOtherDropdowns(shared.el.__dragonMirrorClose); } catch (eCD) {}
      for (var i = 0; i < shared.el.children.length; i++) {
        var it = shared.el.children[i];
        var on = it.dataset.val === current();
        it.classList.toggle("dragon-mirror-sel", on);
        it.style.background = on ? cfg.sel : "transparent";
      }
      shared.el.style.display = "block";
      place();
    }
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = cfg.btnClass;
    btn.title = cfg.title;
    btn.style.cssText = "flex:0 0 auto; font-weight:bold; padding:.26rem .55rem; border-radius:999px; cursor:pointer; font-size:.7rem; border:1px solid " + cfg.border + "; background:linear-gradient(180deg," + cfg.bg1 + "," + cfg.bg2 + "); color:" + cfg.fg + ";";
    btn.onclick = function (e) {
      e.stopPropagation();
      if (!shared.el) buildMenu();
      if (shared.el.style.display !== "none" && shared.activeBtn === btn) { shared.el.style.display = "none"; return; }
      shared.activeBtn = btn;
      dragonCloseMirrorMenus(cfg.name);
      try { if (cuteMenuEl && cuteMenuEl.style.display !== "none") cuteMenuEl.style.display = "none"; } catch (err) {}
      try { if (shotMenuEl && shotMenuEl.style.display !== "none") shotMenuEl.style.display = "none"; } catch (err) {}
      open();
    };
    ;function setLabel() { btn.textContent = cfg.labelPrefix + current(); }
    var mirror = { update: function () { setLabel(); } };
    (window.__dragonMirrors[cfg.name] = window.__dragonMirrors[cfg.name] || []).push(mirror);
    dragonBindMirror(cfg.name);
    dragonSyncMirror(cfg.name);
    setLabel();
    return btn;
  }
  ;function mkAngleBtn() {
    return mkMirrorMenuBtn({
      name: "angle", opts: ANGLE_OPTS, btnClass: "dragon-angle-btn",
      labelPrefix: "\uD83D\uDCD0 Angle: ", title: "Camera Angle \u2014 select viewing angle",
      toast: "\uD83D\uDCD0 Angle: ",
      border: "#b39ddb", fg: "#d6c6ff", bg1: "#241a38", bg2: "#150f26", menuBg: "#1a1226",
      hover: "rgba(179,157,219,.16)", sel: "rgba(179,157,219,.26)"
    });
  }
  ;function mkPoseBtn() {
    return mkMirrorMenuBtn({
      name: "pose", opts: POSE_OPTS, btnClass: "dragon-pose-btn",
      labelPrefix: "\uD83E\uDDCD Pose: ", title: "Pose \u2014 select body pose / stance",
      toast: "\uD83E\uDDCD Pose: ",
      border: "#8fe08a", fg: "#c6f5bf", bg1: "#16301a", bg2: "#0e2012", menuBg: "#121f14",
      hover: "rgba(143,224,138,.16)", sel: "rgba(143,224,138,.26)"
    });
  }
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

    ;function premadePrompt(d) {
    return "young adult woman, {|petite|curvy|slim|toned|athletic} build, " + d + ", {|flowing hair catching the light|soft natural makeup|expressive eyes|subtle smile}, {|confident pose|elegant stance|serene gaze|playful smile|dramatic pose}, {|cinematic lighting|soft studio lighting|dramatic rim light|golden hour glow}, ultra realistic photo, RAW photograph, photorealistic photography, shot on full-frame DSLR, 35mm film grain, commercial studio quality, premium catalog quality, editorial photography, luxury brand presentation, museum-quality realism, visually stunning, aesthetically pleasing, premium realism, realistic visual harmony, exceptional attention to detail, professional production value, photorealistic, hyper-realistic, natural skin texture with visible pores, skin imperfections, individual hair strands, realistic anatomy and proportions, natural human expression, sharp focus, high detail, professional portrait photography, photorealistic rendering, unedited photo, candid shot, real photograph, 8k uhd";
  }
  var PREMADE = [
    { e: "🏥", n: "Classics", items: [
      ["Nurse", null, "{|petite|tall|curvy} young adult woman, {|short|long|wavy} {|blonde|brown|black} hair, {|blue|green|hazel} eyes, white nurse uniform, comfortable nursing shoes, {|smiling warmly|kind bedside manner|calm professional focus}, bright hospital hallway"],
      ["Teacher", null, "{|petite|curvy|slim} young adult woman, {|glasses|no glasses}, {|blonde|brown|black} hair in {|a bun|a ponytail|soft waves}, elegant blouse and pencil skirt, {|confident|gentle|strict} expression, sunlit classroom"],
      ["Vampire", null, "pale young adult woman, {|long black|platinum blonde|silver} hair, {|crimson|golden|violet} eyes, elegant gothic dress, {|mysterious smile|serene gaze|graceful pose}, moonlit gothic castle, candlelight"],
      ["Goddess", null, "radiant young adult goddess, {|golden|silver|flowing brown} hair, {|ethereal glow|celestial aura}, flowing white gown, {|golden wings|soft halo|floating petals}, temple of light, divine atmosphere"],
      ["Hunter", null, "{|athletic|toned|muscular} young adult woman, {|dark brown|black|chestnut} hair in {|a braid|a ponytail|a short cut}, leather hunting outfit, crossbow, {|determined gaze|sharp focus|confident smirk}, misty forest"],
      ["Elf Princess", null, "{|elegant|graceful|petite} young adult elf princess, {|long blonde|silver|white} hair, pointed ears, {|emerald|blue|violet} eyes, shimmering gown, {|silver tiara|golden circlet}, enchanted forest palace, magical glow"],
      ["Police", null, "{|fit|athletic|curvy} young adult woman, {|dark hair in a bun|ponytail|short hair}, police uniform, badge, {|confident|stern|friendly} expression, city street backdrop"],
      ["Chef", null, "{|petite|curvy|tall} young adult woman, {|dark hair|red hair|blonde} in {|a bun|a ponytail}, white chef uniform, apron, {|flour smudge on cheek|warm smile|focused look}, busy restaurant kitchen"],
      ["Scientist", null, "{|bright|curious|genius} young adult woman, {|glasses|safety goggles}, white lab coat, {|blonde|brown|dark} hair in {|a bun|a ponytail}, {|holding a test tube|examining a sample|confident smile}, modern laboratory"],
      ["Flight Attendant", null, "{|polished|elegant|petite} young adult woman, {|dark hair|blonde|black} in {|a neat bun|sleek waves}, airline uniform with scarf, {|warm professional smile|friendly demeanor}, airplane cabin, soft lighting"],
      ["Athlete", null, "{|athletic|toned|slim} young adult woman, {|ponytail|braid|short hair}, athletic top and shorts, {|holding a water bottle|stretching|confident pose}, gym, dramatic lighting"],
      ["Pirate", null, "{|bold|fierce|playful} young adult woman pirate, {|long dark|brown|red} hair, tricorn hat, loose shirt, {|cutlass|golden compass}, {|mischievous grin|eye patch}, wooden ship deck, ocean sunset"],
      ["Fairy", null, "{|sweet|radiant|whimsical} young adult fairy woman, {|translucent wings|glowing wings}, {|flower dress|leaf dress}, {|sparkles|floating pollen}, {|cheerful laugh|gentle smile}, enchanted meadow, bokeh"],
      ["Model", null, "{|tall|slim|gorgeous} young adult woman model, {|high cheekbones|model face}, {|flowing|straight|wavy} {|blonde|brown|black} hair, designer outfit, {|confident pose|runway walk|editorial stare}, fashion studio, bright lights"],
      ["Maid", null, "{|sweet|demure|charming} young adult maid, {|long hair|twin braids|ponytail}, classic black and white maid uniform, {|neat headdress|frilly apron}, {|bowing politely|warm smile|welcoming gesture}, elegant manor interior"],
      ["Military Officer", null, "{|disciplined|confident|stern} young adult woman officer, {|hair in a tight bun|short hair}, military dress uniform, medals, {|authoritative gaze|slight smile}, army base, overcast sky"],
      ["Witch", null, "{|mysterious|enchanting|whimsical} young adult witch, {|long dark hair|wild curls|silver hair}, pointy hat, {|purple|black} robe, {|spellbook|glowing potion|magic wand}, {|cryptic smile|playful look}, candlelit cottage"],
      ["Heroine", null, "{|brave|noble|fierce} young adult heroine, {|flowing hair|practical braid|short cut}, {|shining armor|battle gear|flowing cape}, {|sword|shield}, {|determined eyes|heroic stance}, epic battlefield, dramatic sky"]
    ]},
    { e: "🧛", n: "Supernatural Beings", items: [
      ["Ancient Nymph", "an ancient forest nymph, ageless and wise, skin like moss and petals"],
      ["Anthropomorphic Furry", "an anthropomorphic furry girl with soft fur, animal ears and a tail"],
      ["Anthropomorphic Harpy", "an anthropomorphic harpy girl with bird wings, feathers and talons"],
      ["Arachne", "an arachne spider-girl with silken black hair and a spider lower body"],
      ["Spa Hostess Marina", "an elegant spa hostess girl by a marble fountain, rose petals, serene wellness spa"],
      ["Blood Mage", "a blood mage girl wreathed in crimson magic, glowing runes"],
      ["Catgirl", "a catgirl with fluffy cat ears and a swishing tail"],
      ["Centaur Girl", "a centaur girl, half woman half horse, strong and graceful"],
      ["Cursed Herbalist", "a mysterious herbalist girl surrounded by strange glowing plants"],
      ["Cybernetic Android Girl", "a cybernetic android girl with visible tech seams and glowing circuits"],
      ["Cyborg", "a cyborg girl with sleek chrome limbs and neon light accents"],
      ["Dark Alchemist Luna", "a dark alchemist girl mixing glowing potions at a rune-covered table"],
      ["Dark Elf (Obsidian)", "a dark elf with obsidian skin and silver hair, pointed ears"],
      ["Demonic Girl", "a demonic girl with small horns and a mischievous flame-touched aura"],
      ["Dryad", "a dryad girl with living vines and leaves woven through her hair"],
      ["Exiled Sorceress Morgana", "an exiled sorceress in worn robes, banished but still powerful"],
      ["Gnome", "a gnome girl with rosy cheeks, braided hair and whimsical garden clothes"],
      ["Gothic Witch", "a gothic witch girl in dark robes and a pointy hat, candlelit cottage"],
      ["Harpy (Eerie)", "an eerie harpy girl with dark feathers and sharp eyes"],
      ["Horned Devil Girl", "a horned devil girl with curved horns and a sly grin"],
      ["Horned Female Demon", "a horned female demon with dark skin and glowing eyes"],
      ["Ice Elemental Girl", "an ice elemental girl with frozen skin and crystalline frost"],
      ["Icy Girl", "an icy girl with frozen pale skin and frost-touched hair"],
      ["Innocent Nun", "an innocent nun girl in a modest habit, serene chapel light"],
      ["Demon Horn Girl", "a japanese demon girl with elegant horns and a flowing kimono"],
      ["Kitsune", "a kitsune girl with fox ears and multiple fluffy tails"],
      ["Lich Queen", "a lich queen with bone-white skin and a dark crown, necromantic glow"],
      ["Mermaid Girl with Scales", "a mermaid girl with scales on her skin and a shimmering tail"],
      ["Mermaid with Tail", "a mermaid girl with a long shimmering tail on a seaside rock"],
      ["Midnight Librarian Witch", "a midnight librarian witch in a dark library of glowing spellbooks"],
      ["Mummy Girl", "a mummy girl with loose bandages and golden jewelry"],
      ["Mystical Druid", "a mystical druid girl with antlers and swirling forest magic"],
      ["Mystical Elven Mage", "a mystical elven mage in flowing silk robes, arcane glow"],
      ["Mystical Forest Nymph", "a mystical forest nymph with flower-crowned hair and woodland glow"],
      ["Mythical Mermaid", "a mythical mermaid with coral ornaments and an iridescent tail"],
      ["Naga with Scaly Tail", "a naga girl with a long scaly snake tail"],
      ["Neon Street Witch", "a neon street witch with cyberpunk glow and holographic magic"],
      ["Oni Girl", "an oni girl with horned demon features and fierce traditional attire"],
      ["Orc Girl", "an orc girl with tusks, strong features and tribal gear"],
      ["Pan-like Girl", "a pan-like girl with goat legs, small horns and a woodland charm"],
      ["Powerful Human Sorceress", "a powerful human sorceress with arcane sigils and crackling magic"],
      ["Satyr Girl", "a satyr girl with furry legs and little horns, dancing in a forest glade"],
      ["Shadow Courier Swifttoe", "a shadowy courier girl in dark leathers, swift and silent"],
      ["Shadow Librarian Sophia", "a shadowy librarian girl surrounded by floating dark tomes"],
      ["Siren (Lorelei)", "a siren girl with a haunting song, sea-spray hair on a rocky coast"],
      ["Imp Girl", "a playful imp girl with small wings and a teasing smile"],
      ["Imp with a Tail", "a playful imp with a long spaded tail and small wings"],
      ["Tactical Imp Xanthia", "a tactical imp girl in modern combat gear, tail curling"],
      ["Translucent Slime Girl", "a translucent slime girl with a glossy, liquid-smooth body"],
      ["Valerica", "valerica from skyrim, elegant vampire matriarch, dark hair, pale porcelain skin, black and purple aristocratic velvet gown, ancient dignified beauty"],
      ["Vampire with Fangs", "a beautiful vampire with fangs and crimson eyes"],
      ["Vampire Countess", "a vampire countess in an elegant dark gown, candlelit castle"],
      ["Vampire Princess", "a vampire princess with a dark crown and pale grace"],
      ["Water Bender Ballerina", "a water-bending ballerina girl weaving liquid ribbons mid-pirouette"],
      ["Werewolf Girl", "a werewolf girl with wolf ears, claws and a fur-trimmed edge"],
      ["Wet Rainbow Fairy", "a wet rainbow fairy with iridescent wings and glistening droplets"],
      ["Wolfgirl", "a wolfgirl with grey wolf ears and a fluffy tail"]
    ]},
    { e: "🌟", n: "Goddesses & Immortals", items: [
      ["Amaterasu", "amaterasu, japanese sun goddess, radiant golden glow"],
      ["Ancient Greek Goddess", "an ancient greek goddess in flowing white chiton and laurel crown"],
      ["Angel with Halo", "an angel with a glowing halo and serene heavenly light"],
      ["Aphrodite", "aphrodite, greek goddess of love and beauty, roses and sea foam"],
      ["Astral Dancer", "an astral dancer glowing with cosmic energy, dancing among stars"],
      ["Athena", "athena, greek goddess of wisdom, with owl and spear"],
      ["Aurelia", "aurelia, a fallen angel with black feather wings and tattered glory"],
      ["Banshee", "a banshee with long pale hair and a mournful spectral wail"],
      ["Bastet", "bastet, egyptian cat goddess, gold jewelry and a black cat"],
      ["Celestial Angel", "a celestial angel with white wings and golden light"],
      ["Celestial Sun Goddess", "a celestial sun goddess with a solar corona and blazing rays"],
      ["Circe", "circe, greek enchantress goddess, potions and a greek isle"],
      ["Crystalline Harpist", "a crystalline harpist with a shimmering form, making glass-like music"],
      ["Dark Moon Goddess", "a dark moon goddess in silver-blue, crescent moon glow"],
      ["Eris", "eris, greek goddess of discord, with a golden apple"],
      ["Etherea", "ethera, a sacred unicorn girl with a pearlescent horn and holy aura"],
      ["Fallen Angel", "a fallen angel with black wings and a defiant gaze"],
      ["Forgotten Temple Goddess", "a forgotten temple goddess among crumbling ruins, moss and starlight"],
      ["Freyja", "freyja, nordic goddess of love and war, falcon cloak and amber"],
      ["Ghostly Specter", "a ghostly specter girl, translucent and ethereal with a faint glow"],
      ["Hecate", "hecate, greek goddess of magic and crossroads, twin torches"],
      ["Hel", "hel, norse goddess of the dead, half-ghostly visage"],
      ["Ignis", "ignis, an ancient female dragon in human form, ember eyes and scales"],
      ["Inanna", "inanna, mesopotamian goddess of love and war, winged star symbols"],
      ["Isis", "isis, egyptian goddess of magic, winged throne headdress"],
      ["Izanami", "izanami, shinto goddess of creation and the underworld, pale beauty"],
      ["Kali", "kali, hindu goddess of destruction, dark skin and fierce grace"],
      ["Lilith", "lilith, primordial night demon goddess, dark wings, moonlit"],
      ["Living Statue Galatea", "galatea, a living marble statue with carved perfection"],
      ["Mama Quilla", "mama quilla, inca moon goddess, silver moonlight and star robes"],
      ["Marble Goddess", "a marble goddess carved in perfection with veins of gold"],
      ["Medusa", "medusa, the snake-haired gorgon with a petrifying gaze"],
      ["Morrigan (Goddess Form)", "the morrigan in goddess form, raven feathers and war fate"],
      ["Mythical Forest Goddess", "a mythical forest goddess crowned with leaves and wildlife"],
      ["Nemesis", "nemesis, greek goddess of retribution, scales and sword"],
      ["Nephilim Girl", "a nephilim girl, half-angel half-human, with feathered wings"],
      ["Null", "null, a void specter of absolute darkness with faint stars within"],
      ["Nyx", "nyx, primordial greek goddess of night, veil of stars"],
      ["Oracle in Trance", "an oracle in a trance, eyes glowing with prophecy light"],
      ["Pandora", "pandora, first woman of myth, carrying the opened box"],
      ["Pele", "pele, hawaiian volcano goddess, molten lava and flame"],
      ["Persephone", "persephone, queen of the underworld, pomegranate and spring flowers"],
      ["Sekhmet", "sekhmet, egyptian lioness goddess of war, sun disk"],
      ["Selene (Moon Titan)", "selene, titan goddess of the moon, silver chariot"],
      ["Siren of the Void", "a siren of the void singing across dark cosmic waters"],
      ["Skadi", "skadi, norse giantess goddess of winter and hunting, snow"],
      ["Theia", "theia, titan goddess of light, golden shimmer"],
      ["Tiamat", "tiamat, primordial dragon goddess of chaos"],
      ["Valkyrie Brunhilde", "brunhilde the valkyrie with a winged helm and shield"],
      ["Venus", "venus, roman goddess of love, mirror and rose"],
      ["Warrior Goddess", "a warrior goddess in divine armor with spear and radiance"],
      ["Xochiquetzal", "xochiquetzal, aztec goddess of beauty and flowers, quetzal feathers"]
    ]},
    { e: "⚔️", n: "Warriors & Soldiers", items: [
      ["Armored Female Knight", "an armored female knight in gleaming plate armor"],
      ["Battle-Worn Female Soldier", "a battle-worn female soldier in dirty camo, scars and grit"],
      ["Beast Trainer Kira", "a beast trainer girl guiding trained beasts with sturdy reins"],
      ["Captured Soldier Girl", "a captured soldier girl with bound hands and defiant eyes"],
      ["Cellar Master Fiona", "a cellar master girl among wine barrels and candlelight"],
      ["Combat Soldier", "a combat soldier in camouflage and tactical gear"],
      ["Cunning Elf Rogue", "a cunning elf rogue with lockpicks and a sly smile"],
      ["Cyber Assassin", "a cyber assassin girl in sleek black techwear with a glowing blade"],
      ["Deadly Female Ninja", "a deadly female ninja in a tight black shinobi outfit"],
      ["Disheveled Princess", "a disheveled princess in a torn ballgown"],
      ["Elf Ranger", "an elf ranger with a longbow and forest cloak"],
      ["Estate Gardener Flora", "an estate gardener girl with shears and apron among flowerbeds"],
      ["Fallen Paladin Alaric", "a fallen paladin woman in tarnished armor, holy light fading"],
      ["Female Gladiator", "a female gladiator in arena leathers with sword and shield"],
      ["Fierce Female Barbarian", "a fierce female barbarian with a great axe and war paint"],
      ["Gothic Chamberlain Eleanor", "a gothic chamberlain girl in dark formal attire with manor keys"],
      ["Holy Female Paladin", "a holy female paladin in radiant armor with divine glow"],
      ["Irish Princess", "an irish princess with a crown of braids and an emerald dress"],
      ["Iron Maiden Vera", "an iron maiden warrior girl in steel and chains, imposing"],
      ["Mystik Oryantalist", "a mystical orientalist dancer with veils and bangles"],
      ["Neko Amigo", "a friendly neko girl with a weapon, street-style jacket"],
      ["Orc Female Warrior", "an orc female warrior with tusks and heavy armor"],
      ["Police Officer", "a police officer girl in uniform on a city beat"],
      ["Rebel Princess Elora", "a rebel princess girl in battle leathers, crown tilted"],
      ["Regal Queen", "a regal queen in velvet and a royal tiara"],
      ["Ronin Samurai Girl", "a ronin samurai girl with a katana and wandering cloak"],
      ["Samurai Woman", "a samurai woman in traditional tatami armor"],
      ["Shadowy Elf Assassin", "a shadowy elf assassin in dark stealth gear, daggers ready"],
      ["Sharp Elf Archer", "a sharp elf archer nocking an arrow, keen eyes"],
      ["Shameful Elven Ranger", "a shameful elven ranger in tattered leather armor"],
      ["Shuffle Dancer with Whips", "a shuffle dancer girl wielding twin whips"],
      ["Slavic Warrior Princess", "a slavic warrior princess in fur and mail on a winter steppe"],
      ["Twin Shadow Guards", "twin shadow guard girls in identical black armor"],
      ["Valkyrie", "a valkyrie in winged armor, spear and shield"],
      ["Valkyrie (GoW Style)", "a valkyrie from god of war, ornate golden and silver winged armor, massive feathered wings, winged helmet, glowing eyes, fierce battle goddess"],
      ["Valkyrie in Silver Armor", "a valkyrie in silver armor with wings and a spear"],
      ["Velvet Torturer Ravenna", "a velvet-clad warrior girl named ravenna with an ornate mask"],
      ["Viper (Bandit Girl)", "a viper bandit girl in a hood with dual blades"],
      ["Viking Princess", "a viking princess in leather and fur, shield maiden"]
    ]},
    { e: "🌸", n: "Daily Life", items: [
      ["Burnt-Out Girl", "a tired young woman showing signs of exhaustion, gritty realism"],
      ["Cheerful Cheerleader", "a cheerful cheerleader in a bright uniform with pom-poms"],
      ["Tipsy Party Girl", "a young woman with flushed cheeks and a tipsy smile at a party"],
      ["Neon Night Driver", "a young woman taxi driver on a neon city corner"],
      ["Ballerina in a Mess", "a ballerina in a mess, hair fallen, studio chaos"],
      ["Band Logo Fan Girl", "a band logo fan girl in a worn concert tee"],
      ["Bubblegum Rebel Girl", "a bubblegum rebel girl in pastel punk style"],
      ["Camping Girl", "a camping girl by a tent and campfire"],
      ["Casual College Student", "a casual college student with a backpack on campus"],
      ["Cheerful Japanese Student", "a cheerful young adult japanese student in a neat uniform"],
      ["Crying Prom Queen", "a crying prom queen with smeared makeup, tiara askew"],
      ["Sweet Vintage Girl", "a young woman in a sweet polka-dot outfit, warm smile"],
      ["Disheveled Dirty Homeless", "a disheveled dirty homeless girl wrapped in a blanket"],
      ["Elegant Flight Attendant", "an elegant flight attendant in a uniform and scarf, airplane cabin"],
      ["Elegant Geisha", "an elegant geisha in a floral kimono with white face paint"],
      ["Exhausted Ballerina", "an exhausted ballerina resting after rehearsal, hair undone"],
      ["Fallen Pop-Idol", "a fallen pop-idol girl backstage, faded editorial"],
      ["Fruit Picker Girl", "a fruit picker girl in an orchard with a basket"],
      ["Fruit Seller Girl", "a fruit seller girl at a market stall with fresh produce"],
      ["Evening Bath Ritual", "a woman relaxing in a clawfoot tub filled with bubbles, candles and soft light, tranquil spa mood"],
      ["Girl Fallen Off Bicycle", "a girl fallen off a bicycle, scraped knee, laughing it off"],
      ["Girl Grooming Horse", "a girl grooming a horse in a stable"],
      ["Girl Playing with Bird", "a girl playing with a small bird in cupped hands"],
      ["Girl Playing with Butterflies", "a girl playing with butterflies in a meadow"],
      ["Girl Playing with Cat", "a girl playing with a playful cat"],
      ["Girl Playing with Pony", "a girl playing with a pony in a paddock"],
      ["Girl Playing with Rabbit", "a girl playing with a fluffy rabbit"],
      ["Girl Playing with Water", "a girl splashing in clear water"],
      ["Girl Riding Horse in Dress", "a girl riding a horse sidesaddle in a flowing dress"],
      ["Woman Swimming in Pool", "a woman swimming laps in a pool, water ripples, athletic swim"],
      ["Woman Swimming with Cat", "a woman swimming with a cat paddling beside her"],
      ["Waterfall Shower", "a woman enjoying a waterfall shower in swimwear, tropical spa setting"],
      ["Woman Trying on Clothes", "a woman trying on clothes in a boutique fitting room, mirror, daytime"],
      ["Woman Washing Car", "a woman washing a car with a sponge and bucket, soap suds, sunny driveway, casual summer clothes"],
      ["Glowing Gamer Girl", "a glowing gamer girl at a neon-lit setup with a headset"],
      ["Gothic Nun", "a gothic nun in a black habit, candlelit chapel"],
      ["Gothic Petite", "a gothic petite girl in dark frills and platforms"],
      ["Graceful Ballerina", "a graceful ballerina in a delicate tutu"],
      ["Hitchhiker Girl", "a hitchhiker girl with a thumb out on an open road"],
      ["Homeless Street Girl", "a homeless street girl with a cardboard sign and a warm scarf"],
      ["Ice Skater", "an ice skater girl gliding on a frozen rink"],
      ["Diligent Academy Student", "a diligent young adult academy student in a neat uniform, confident smile"],
      ["Mad Scientist Girl", "a mad scientist girl with wild hair and goggles"],
      ["Messy Trash Collector", "a messy trash collector girl in a reflective vest"],
      ["Motorcycle Girl", "a motorcycle girl with a helmet under her arm"],
      ["Kind Nurse", "a kind nurse with a warm reassuring smile"],
      ["Night Shift Nurse", "a night shift nurse in scrubs, tired but kind, dim ward"],
      ["Arm Wrestling Champ", "an arm wrestling champion at a contest table, focused crowd"],
      ["Peach Girl", "a peach girl with peachy tones and fruit motifs"],
      ["Poolside Waitress", "a poolside waitress with a tray by a sunlit pool"],
      ["Prison Inmate", "a prison inmate girl in an orange jumpsuit"],
      ["Rebellious American Student", "a rebellious young adult american student in a denim jacket"],
      ["Rebellious Punk Girl", "a rebellious punk girl with spikes and a leather jacket"],
      ["Rebellious Skater Girl", "a rebellious skater girl with a skateboard"],
      ["Rooftop Lookout", "a rooftop lookout girl at a city edge, windblown"],
      ["Sharp Lawyer", "a sharp lawyer girl in a tailored suit"],
      ["Ship Captain Woman", "a ship captain woman in a captain's coat on the bridge"],
      ["Splattered Paint Girl", "a splattered paint girl in a colorful studio"],
      ["Sauna Relaxation", "a woman relaxing on a wooden sauna bench wrapped in a towel, wooden interior, tranquil spa"],
      ["Stern Female Judge", "a stern female judge in black robes with a gavel"],
      ["Strawberry Girl", "a strawberry girl with strawberry tones and berry motifs"],
      ["Street Food Vendor", "a street food vendor girl at a colorful cart"],
      ["Strict Secretary", "a strict secretary in a tailored blazer and knee-length skirt, glasses"],
      ["Strict Teacher", "a strict teacher girl with glasses and a pointer"],
      ["Sun-Touched Girl", "a sun-touched girl with golden skin and freckles"],
      ["Swimmer Girl", "a swimmer girl in a swimsuit at the lane"],
      ["Tennis Girl", "a tennis girl in a skirt, racket ready"],
      ["Tired College Student", "a tired college student with coffee and books"],
      ["Tired Female Driver", "a tired female driver at the wheel of a long-haul truck"],
      ["Volleyballer Girl", "a volleyballer girl in a jersey, ball in hand"]
    ]},
    { e: "🔥", n: "Original & Scenario", items: [
      ["Abandoned Bride", "an abandoned bride at the altar, veil and tears"],
      ["Aristocrat Hacker Princess (Elowen Kryss)", "a hacker princess aristocrat in a ballgown with circuit embroidery"],
      ["Asylum Patient", "an asylum patient girl in a worn gown, stark ward"],
      ["Ballet Assassin", "a ballet assassin with a pointe-shoe blade, tulle and shadow"],
      ["Barbie Doll", "a human-size barbie doll girl, glossy and perfect"],
      ["Betrayed Spymaster", "a betrayed spymaster girl in a dark coat, maps and knives"],
      ["Boss Corporate Executive", "a boss corporate executive in a designer suit, boardroom chair"],
      ["Corporate Assassin Intern", "a corporate assassin intern in an office suit, hidden blade"],
      ["Corrupted Angel CEO (Seraphine Vale)", "a corrupted angel ceo with black wings and an executive gown"],
      ["Corrupt Police Officer Girl", "a corrupt police officer girl with a smug expression"],
      ["Cyber Cafe Owner Girl", "a cyber cafe owner girl among glowing PCs"],
      ["Cyberpunk Netrunner", "a cyberpunk netrunner girl with neural ports and a neon jacket"],
      ["Cyberpunk Street Urchin", "a cyberpunk street urchin girl in grungy neon rags"],
      ["Dark Cultist", "a dark cultist girl in hooded robes, candlelit ritual"],
      ["Defeated Evil Queen", "a defeated evil queen with a broken crown in a throne room"],
      ["Desert Smuggler Queen", "a desert smuggler queen in dusty leathers, sand dunes"],
      ["Distressed Opera Singer", "a distressed opera singer in a torn gown, grand stage"],
      ["Drone Operator Girl", "a drone operator girl at a console, screen glow"],
      ["Farm Girl", "a farm girl working in a dirt field, straw hat"],
      ["Firefighter Captain Woman", "a firefighter captain woman in turnout gear, helmet under arm"],
      ["Glass Office Executive", "a glass office executive in a sharp suit and heels"],
      ["Hacker Streamer Girl", "a hacker streamer girl with a glowing setup and camera"],
      ["High-Fashion Mechanic Girl", "a high-fashion mechanic girl in designer coveralls"],
      ["High Society Poison Taster", "a high society poison taster girl in a silk gown, goblet"],
      ["Ice Queen CEO", "an ice queen ceo in a frozen glass tower"],
      ["Jungle Explorer Biologist", "a jungle explorer biologist with a specimen bag"],
      ["Lab Subject", "a lab subject girl in a sterile gown with test markings"],
      ["Luxury Yacht Heiress", "a luxury yacht heiress in white linen on a deck"],
      ["Museum Artifact Thief", "a museum artifact thief with a stolen relic, laser beams"],
      ["Neon Taxi Driver Girl", "a neon taxi driver girl in a cyberpunk cab"],
      ["Racing Grid Girl", "a racing grid girl in a team race outfit"],
      ["Raincoat Detective Woman", "a raincoat detective woman in the noir rain"],
      ["Secret Society Archivist", "a secret society archivist girl among forbidden tomes"],
      ["Neon Hacker Girl", "a hacker girl at a wall of screens"],
      ["Steampunk Aviator", "a steampunk aviator girl with goggles and brass gear"],
      ["Street Food Vendor Goddess", "a street food vendor goddess at a heavenly food cart"],
      ["Tattoo Artist Muse", "a tattoo artist girl with inked arms"],
      ["Tribal Shaman with a Skull Mask", "a tribal shaman girl with a skull mask and mystical body paint"],
      ["Underground Breach Office Girl", "an underground breach office girl in neon techwear"],
      ["Underground Fight Club Medic", "an underground fight club medic with a med kit"],
      ["Vintage Poster Pilot", "a vintage poster pilot girl in a leather flight jacket"]
    ]},
    { e: "🎮", n: "Game & Anime", items: [
      ["Ada Wong", "ada wong from resident evil, sleek dark brown bob with side-swept bangs, brown eyes, red figure-hugging qipao dress with high thigh slit, black thigh holster, red lipstick, confident smirk"],
      ["Ahri", "ahri from league of legends, nine-tailed fox girl, long flowing silver-white hair, blue fox ears and nine fluffy blue-tipped tails, sharp amber eyes, elegant silver and blue robe with ribbon accents"],
      ["Akali", "akali from league of legends, long dark hair, black tattoo on her face and neck, fierce kinkou assassin in a dark hooded outfit, glowing green kama blades, intense eyes"],
      ["Alexstrasza", "alexstrasza from world of warcraft, dragon queen of the red flight, long flowing red hair, green eyes, ornate red and gold dragon armor with horned shoulder plates, curved horns, majestic"],
      ["Alleria Windrunner", "alleria windrunner from world of warcraft, tall high elf ranger, long blonde hair, pointed ears, pale skin, glowing purple void-touched eyes, dark leather ranger armor with void energy"],
      ["Aloy", "aloy from horizon, red hair in two side braids, freckles, blue eyes, tribal leather and machine-plate outfit with fur collar, bow on her back"],
      ["Asuka Kazama", "asuka kazama from tekken, long brown hair, red and white karate gi with black belt, confident fighting stance, tomboy charm"],
      ["Ayane", "ayane from dead or alive, short violet-purple bob hair with blunt bangs, purple and white kunoichi outfit with red ribbon, blue eyes"],
      ["Baizhi", "baizhi from wuthering waves, long pale white hair, blue eyes, elegant white and blue healer robes with gold trim, serene"],
      ["Bayonetta", "bayonetta from the bayonetta GAME, platinum blonde hair in a sleek updo with long bangs, black rectangular glasses, dramatic black bodysuit, long legs, gun-heeled boots, powerful confident pose"],
      ["Blood Elf Priest", "a blood elf priestess from world of warcraft, long blonde hair, pointed ears, red eyes, ornate white and gold sacred robes with a hood, holy light glow"],
      ["BloodRayne", "bloodrayne from the bloodrayne GAME, half-vampire dhampir with long platinum white hair, pale skin, crimson eyes, black leather outfit, twin blades"],
      ["Cammy White", "cammy white from street fighter, long blonde ponytail, green leotard with black spiked sleeves, red beret, athletic muscular build"],
      ["Chun-Li", "chun-li from street fighter, black hair in twin high ox-horn buns, blue qipao dress with gold trim, white thigh-high boots, strong athletic stance, martial arts stance"],
      ["Ciri", "ciri from the witcher, long ashen white-silver hair, green eyes, faint scar on her cheek, black leather armor, witcher sword on her back, fierce determined beauty"],
      ["D.Va", "d.va from overwatch, brown hair in a bob with pink highlights, pink and black pilot jumpsuit with bunny emblem, playful confident smile"],
      ["Damiane", "damiane from crimson desert, fierce mercenary woman with dark hair, rugged leather and fur armor, battle-hardened expression, sword at her hip"],
      ["Eula", "eula from genshin impact, long blonde hair, blue eyes, cryo knight armor in white and dark blue with a fur-trimmed cape, elegant noble demeanor"],
      ["Evelynn", "evelynn from league of legends, demon diva with long white hair, pale skin, black and violet fitted outfit, wicked claws, dangerous predatory smile"],
      ["Garona Halforcen", "garona from world of warcraft, half-orc woman with green skin, small tusks, short black hair, red eyes, dark leather rogue armor"],
      ["Ivy Valentine", "ivy valentine from soulcalibur, long platinum blonde hair, green eyes, ornate purple bodysuit with gold trim, snake-blade sword, aristocratic beauty"],
      ["Jade", "jade from mortal kombat, tall dark-skinned woman, long black hair, emerald green and gold ninja outfit, glowing green staff, fierce glare"],
      ["Jaina Proudmoore", "jaina proudmoore from world of warcraft, long blonde hair, blue eyes, elegant blue and gold frost mage robes, glowing magical staff, archmage grace"],
      ["Jill Valentine", "jill valentine from resident evil, dark brown bob hair, blue beret, blue STARS police uniform with a chest holster, determined look"],
      ["Judy Alvarez", "judy alvarez from cyberpunk 2077, short dark hair shaved on one side, tattooed arms, tank top, nose and ear piercings, edgy cool tech girl"],
      ["Juliet Starling", "juliet starling from lollipop chainsaw, blonde cheerleader with a high ponytail, pink and white cheerleading uniform, holding a chainsaw, cheerful grin"],
      ["Juri Han", "juri han from street fighter, black hair with white streaks, eyepatch over one eye, purple and black taekwondo outfit, sadistic smile, high kick stance"],
      ["Kai'Sa", "kai'sa from league of legends, dark hair, living black and purple void skin-suit with glowing violet energy patterns, survivor intensity"],
      ["Kasumi", "kasumi from dead or alive, long black hair, blue eyes, white and red ninja suit, serene graceful beauty"],
      ["Katarina", "katarina from league of legends, long red hair, green eyes, red and gold armor with leather straps, twin daggers, deadly smirk"],
      ["Kitana", "kitana from mortal kombat, long black hair, steel-bladed folding fans, blue and gold royal ninja outfit, elegant deadly royalty"],
      ["Lady Dimitrescu", "lady dimitrescu from resident evil village, extremely tall elegant pale woman, dark hair in a sleek bun, white wide-brimmed hat, long white dress with black accents, red lipstick, classy menacing beauty"],
      ["Lara Croft", "lara croft from tomb raider GAME, adventurer with brown hair in a braid, tank top and cargo shorts, dual pistols, rugged jungle explorer look, confident smirk"],
      ["Lucyna Kushinada", "lucy from cyberpunk edgerunners, pale skin, long straight white-silver hair, black netrunner bodysuit, futuristic cyberpunk style, cool distant expression"],
      ["Mai Shiranui", "mai shiranui from fatal fury, long blonde hair in a high ponytail with red ribbon, red and white traditional fighting outfit with flowing sleeves, folding fan, playful confidence"],
      ["Makima", "makima from chainsaw man, long pink-red hair, red-brown eyes, white blouse with black necktie, dark skirt, calm manipulative smile"],
      ["Mercy", "mercy from overwatch, blonde bob hair, white and yellow valkyrie combat medic suit, glowing golden wings and halo headpiece, kind smile"],
      ["Mileena", "mileena from mortal kombat, pale skin, long black hair, purple ninja outfit, twin sai, sharp jagged tarkatan teeth, feral grin"],
      ["Misty Tattoo Artist", "misty from cyberpunk 2077, ashy blonde choppy bob with straight-across bangs, fair freckled skin, green eyes, heavy smudged black eyeliner, dark mauve eyeshadow, dark plum lipstick, navy tank top, purple knit cardigan slipping off one shoulder, black spiked choker, skull pendant, grunge mystic tattoo artist"],
      ["Morrigan Aensland", "morrigan aensland from darkstalkers, dream-demon with teal-green hair, pale skin, black fitted dress, large bat wings, playful knowing smile"],
      ["Nina Williams", "nina williams from tekken, platinum blonde hair, elegant white and blue assassin dress with thigh slit, cold professional beauty"],
      ["Poison", "poison from street fighter, long pink hair, leather jacket with red accents, pink miniskirt, whip, punk gang leader attitude"],
      ["Princess Zelda", "princess zelda of hyrule from the legend of zelda GAME, long golden blonde hair, blue eyes, royal white and gold gown with blue accents, golden tiara, regal grace"],
      ["Quiet", "quiet from metal gear solid v, short black hair, green eyes, torn black outfit with stockings, sniper rifle, silently intense"],
      ["Raiden Shogun", "raiden shogun from genshin impact, very long violet-purple hair in a braid, purple eyes, white and purple electro archon dress with flowing sleeves, stern divine beauty"],
      ["Samus Aran", "samus aran from metroid GAME, blonde hair in a ponytail, sleek blue zero suit, intergalactic bounty hunter, confident stance"],
      ["Sindel", "sindel from mortal kombat, very long white-silver hair, elegant purple and gold royal outfit, regal stern beauty"],
      ["Skarlet", "skarlet from mortal kombat, long red hair, crimson blood-mage outfit, red eyes, sharp clawed nails, menacing warrior"],
      ["Sonya Blade", "sonya blade from mortal kombat, blonde hair in a ponytail, military green tactical outfit, energy ring armband, tough fighter"],
      ["Sylvanas Windrunner", "sylvanas windrunner from world of warcraft, tall high elf banshee, long blonde hair, pale skin, glowing red eyes, dark ranger hooded armor, bow, cold ruthless beauty"],
      ["Taki", "taki from soulcalibur, black hair with long bangs, purple and white kunoichi outfit, twin nodachi blades, fierce focused gaze"],
      ["Tifa Lockhart", "tifa lockhart from final fantasy vii, long black hair with wispy bangs, brown eyes, white tank top, black miniskirt with suspenders, strong athletic build, warm smile"],
      ["Tracer", "tracer from overwatch, short chestnut hair in two buns, amber goggles, orange and black skin-tight pilot jumpsuit with chronal accelerator on chest, bright energetic smile"],
      ["Triss Merigold", "triss merigold from the witcher, long auburn chestnut hair, blue eyes, freckled pale skin, elegant blue and gold sorceress dress"],
      ["Tyrande Whisperwind", "tyrande whisperwind from world of warcraft, tall night elf priestess, silver-white hair, lavender-purple skin, glowing silver eyes, white and silver moon armor with crescent symbols"],
      ["Valeera Sanguinar", null, "valeera sanguinar from World of warcraft in blood elf rogue gear, (red leather suit with a loincloth draping in front, legs in dark fitted leggings:1.4), (holding s-curved twin daggers with green glowing crystals:1.5), (long blonde hair, green glowy eyes:1.3)"],
      ["Widowmaker", "widowmaker from overwatch, tall pale blue-skinned woman, long blue hair, purple skin-tight assassin bodysuit, spider tattoo on neck, sniper rifle, cold stare"],
      ["Yennefer of Vengerberg", "yennefer of vengerberg from the witcher, long raven black hair, violet-purple eyes, black and white sorceress outfit with corset, commanding confidence"],
      ["Yinlin", "yinlin from wuthering waves, long silver-white hair, violet eyes, dark purple and gold outfit, lightning conductor puppet at her side, elegant mysterious aura"],
      ["Yor Forger", "yor forger from spy x family, long black hair in a ponytail, red eyes, elegant red and white dress, secret assassin elegance"],
      ["Ysera", "ysera from world of warcraft, dream dragon aspect in elven form, long green hair, glowing golden-green eyes, flowing emerald robes, ethereal magical presence"],
      ["Yuna", "yuna from final fantasy x, long brown hair, blue eyes, white and gold summoner dress with fur-trimmed collar, gentle serene beauty"],
      ["Misty (Pokemon)", "misty from pokemon, strawberry-blonde hair in a high side ponytail tied with an orange ribbon, blue eyes, yellow crop top with orange suspenders, white denim shorts, orange sneakers, cheerful athletic girl"],
      ["Jessie (Team Rocket)", "jessie from team rocket (pokemon), long magenta-pink hair in a high ponytail, violet eyes, white crop-top jacket with a red R emblem, black shorts, white gloves, tall confident pose, dramatic flair"],
      ["Princess Peach", "princess peach from mario, long strawberry-blonde hair, blue eyes, golden crown, elegant pink floor-length gown with puffed sleeves, white elbow-length gloves, royal regal beauty"],
      ["Princess Daisy", "princess daisy from mario, shoulder-length auburn-brown hair, brown eyes, golden crown, orange and yellow floral-print dress with white accents, energetic sporty smile"],
      ["Rosalina", "rosalina from mario galaxy, very long platinum-blonde hair, pale blue eyes, deep blue star-studded gown with silver accents, silver tiara, serene cosmic elegance"],
      ["Ling Xiaoyu", "ling xiaoyu from tekken, short black hair with a side fringe, dark brown eyes, red and white chinese-style qipao training outfit with yellow trim, cheerful energetic pose"],
      ["Lili Rochefort", "lili rochefort from tekken, very long wavy honey-blonde hair, blue eyes, elegant white and blue aristocratic outfit, long white gloves, graceful heiress pose"],
      ["Alisa Bosconovitch", "alisa bosconovitch from tekken, blonde hair in twin tails with a black and red headband, blue eyes, black and red gothic battle dress with jet-pack wings and ringblade forearms, android beauty"],
      ["Jun Kazama", "jun kazama from tekken, long dark brown hair with a black headband, brown eyes, white kazama-style martial arts outfit with yellow accents, serene gentle aura"],
      ["Anna Williams", "anna williams from tekken, long platinum-blonde hair with a center part, violet cat-eye sunglasses, elegant black dress with purple accents and leopard-print details, lethal elegance"],
      ["Kunimitsu", "kunimitsu from tekken, long raven-black hair, jade green eyes, purple and white ninja armor with a red mask and golden claw gauntlet, sleek assassin stance"],
      ["Reina", "reina from tekken 8, shoulder-length black hair with purple and magenta highlights, violet eyes, black and purple jacket with white accents, punk-rock fighting style, fierce confident smile"],
      ["Sakura Kasugano", "sakura kasugano from street fighter, brown hair in a ponytail with a red ribbon, brown eyes, white sailor school uniform with a red neckerchief, playful fist-pumping energy"],
      ["Rainbow Mika", "rainbow mika from street fighter, long rainbow-dyed hair in a high ponytail, sparkling eyes, white and rainbow wrestling suit with stars, muscular yet playful wrestler pose"],
      ["Rose", "rose from street fighter, long silver-white hair with bangs covering one eye, elegant white fortune-teller dress with gold accents and a red cape, glowing tarot cards, mysterious aura"],
      ["Menat", "menat from street fighter, dark skin, short black bob with a golden headdress, ornate gold jewelry, white and gold ancient egyptian-inspired outfit, floating crystal ball and scarf"],
      ["Laura Matsuda", "laura from street fighter v, long braided dark hair, brown skin, yellow and blue capoeira outfit with a red sash, energetic acrobatic stance"],
      ["Tanya", "tanya from mortal kombat, dark skin, shoulder-length black hair with gold beads, green and gold royal edenian outfit, glowing green scepter, confident royal warrior"],
      ["Cassie Cage", "cassie cage from mortal kombat, blonde hair in a ponytail, blue eyes, green and black military tactical outfit, energy gauntlets, cocky smirk, sunglasses"],
      ["Sareena", "sareena from mortal kombat, long raven-black hair with red streaks, pale skin, red and black demon-hunter outfit, throwing knives, fierce crimson eyes"],
      ["Li Mei", "li mei from mortal kombat, long black hair in a topknot with red ties, brown eyes, red and black martial arts outfit, glowing red lantern weapon, determined outworld warrior"],
      ["Nitara", "nitara from mortal kombat, long platinum-blonde hair with dark roots, crimson eyes, deep burgundy and black leather outfit with wings, vampire fangs, sharp dangerous beauty"],
      ["Jinx", "jinx from arcane, very long pale blue braids with pink and purple dip-dyed tips, light blue eyes, wild black tattoos on her chest and arms, purple and black crop-top outfit, smoking a cigar, maniacal grin"],
      ["Vi", "vi from arcane, short hot pink bob hair with dark roots, blue eyes, black and gold zipped jacket over a white crop top, heavily tattooed muscular arms, massive hextech gauntlets, fierce confident smirk"],
      ["Caitlyn", "caitlyn from arcane, long navy blue hair in a high ponytail, tan skin, dark blue top hat, blue and gold piltovan enforcer uniform with shoulder armor, long hextech rifle, sharp vigilant gaze"],
      ["Shani", "shani from the witcher 3, red-haired field doctor, freckles, green eyes, red corset top with white blouse, dark skirt, gentle caring smile, oxenfurt university medic"],
      ["Keira Metz", "keira metz from the witcher 3, sorceress with long chestnut brown hair, green eyes, elegant black and violet mage gown with golden trim, spellcasting hands, confident allure"],
      ["Milva", "milva from the witcher, dryad-born huntress, short dark brown hair, green eyes, green hooded leather archer armor, wooden longbow on her back, fierce forest warrior"],
      ["Philippa Eilhart", "philippa eilhart from the witcher, sorceress with chin-length dark blonde hair, sharp violet eyes, luxurious violet and gold dress, golden necklace, ruthless scheming beauty"],
      ["Tissaia de Vries", "tissaia de vries from the witcher, archmage of the lodge, long silver-blonde hair, pale blue eyes, regal white and gold sorceress robes, cold elegant authority"],
      ["Cerys an Craite", "cerys an craite from the witcher 3, skellige warrior queen, long red hair in braids, green eyes, leather and fur armor, battle axe, fierce nordic royalty"],
      ["Renfri", "renfri of creyden from the witcher, black hair, pale skin, cold dark eyes, dark leather outfit with sword, sinister tragic beauty, snowy blaviken background"],
      ["Francesca Findabair", "francesca findabair from the witcher, the enchantress of dol blathanna, long platinum blonde elven hair, pale glowing skin, elegant white elven sorceress robes with gold, proud luminous beauty"],
      ["Maiev Shadowsong", "maiev shadowsong from world of warcraft, night elf warden, silver face tattoos, ornate glowing headpiece covering the eyes, dark crescent glaive blades, blue and gold sentinel armor, grim avenger"],
      ["Lady Vashj", "lady vashj from world of warcraft, naga sorceress, long dark green serpentine hair-tendrils, glowing green eyes, ornate coral crown, scaled snake-like lower body, teal and gold jewelry"],
      ["Queen Azshara", "queen azshara from world of warcraft, naga empress, long flowing silver hair, golden crown, regal pearl and gold regalia, serpentine scaled body, luminous divine beauty, commanding presence"],
      ["Chromie", "chromie from world of warcraft, bronze dragon in gnome form, bright pink hair in twin braids, goggles on headband, colorful blue and gold robe, cheerful playful grin, glowing time-rune motes"],
      ["Lady Liadrin", "lady liadrin from world of warcraft, blood elf paladin, golden blonde hair, crimson and gold ornate plate armor with holy light glow, radiant warm smile, sunwell knight"],
      ["Vereesa Windrunner", "vereesa windrunner from world of warcraft, silver-haired high elf ranger, blue eyes, white and silver ranger armor with fur mantle, twin daggers, calm noble elven beauty"],
      ["Onyxia", "onyxia from world of warcraft, black dragon in noble human form, long black hair, elegant black and crimson gown, piercing amber dragon eyes, subtle scales and sharp claws"],
      ["Draenei Priestess", "draenei priestess from world of warcraft, blue-skinned woman with curved white horns, golden eyes, white and gold priest robes, glowing hooved feet, serene holy light aura"],
      ["Fenyx", "fenyx from immortals fenyx rising, greek heroine, short dark hair, athletic build, white and gold greek armor with winged sandals, sword and axe, heroic determined pose"],
      ["Lost Ark Gunslinger", "gunslinger from lost ark, long dark hair, red and black leather coat, two pistols drawn, western outlaw gunslinger style, confident deadly smile"],
      ["Lost Ark Sorceress", "sorceress from lost ark, long blonde hair, elegant flowing blue and white mage robes with gold trim, floating arcane circles, graceful spellcaster"],
      ["Lost Ark Deathblade", "deathblade from lost ark, assassin with long thin blade, black hair with a white streak, dark armor with red scarf, lethal elegant stance"],
      ["Lost Ark Shadowhunter", "shadowhunter from lost ark, demonic assassin, dark violet hair, glowing red eyes, black demonic leather armor, wicked claw gauntlets, menacing allure"],
      ["Lost Ark Reaper", "reaper from lost ark, shadow assassin, short white hair, dark ghostly outfit with scythes, pale eerie beauty, misty dark aura"],
      ["Lost Ark Glaivier", "glaivier from lost ark, spear dancer, long black hair, white and blue martial robes, elegant long spear, graceful combat pose"],
      ["Frost", "frost from mortal kombat, ice assassin, white hair, pale cold skin, cybernetic blue and white lin kuei armor, glowing ice blades, arrogant frosty beauty"],
      ["Sheeva", "sheeva from mortal kombat, shokan warrior queen, four arms, dark skin, red hair in warrior braids, muscular powerful build, golden warrior armor, intimidating royalty"],
      ["Ashrah", "ashrah from mortal kombat, demon-turned-crusader, long white hair, violet eyes, white nun-like crusader armor, glowing blue dagger, halo of redemption light"],
      ["Cetrion", "cetrion from mortal kombat, elder goddess of nature, flowing green and white ethereal robes, golden laurel headdress, glowing elemental motes, serene divine power"],
      ["Jacqui Briggs", "jacqui briggs from mortal kombat, special forces soldier, dark skin, short black hair in braids, tactical black and yellow armor with glowing gauntlets, confident smile"],
      ["Kronika", "kronika from mortal kombat 11, titan of time, long white hair, golden crown, elegant white and gold robes with hourglass motifs, cold calculating divinity"],
      ["Ibuki", "ibuki from street fighter, ninja girl, short brown hair with red headband, red and white ninja outfit with arm wraps, shuriken pouch, playful cheeky grin, agile acrobatic stance"],
      ["Karin Kanzuki", "karin kanzuki from street fighter, wealthy heiress fighter, long red hair, elegant white and red school uniform with gold accents, refined smug smile, haughty grace"],
      ["C. Viper", "c. viper from street fighter, secret agent, red hair in a short bob, blue sunglasses, black and red catsuit with glowing thunder gauntlets, confident smirk"],
      ["Elena", "elena from street fighter, kenyan warrior, dark skin, purple hair in wild natural curls, tribal blue cape and skirt, tall elegant dancer stance, radiant warm smile"],
      ["Lucia Morgan", "lucia morgan from street fighter 5, police detective, short dark hair, blue tactical jacket, red kicks, fierce street-fighting cop energy"],
      ["Akira Kazama", "akira kazama from street fighter 5, martial artist, short black bob hair, white school jacket with red ribbon, arm-wrapped grappler stance, gentle fierce beauty"],
      ["Panam Palmer", "panam palmer from cyberpunk 2077, nomad, chestnut hair with a shaved side, hazel eyes, denim jacket with alder ring necklace, rifle on her back, rugged desert beauty"],
      ["Evelyn Parker", "evelyn parker from cyberpunk 2077, socialite, long dark hair, glamorous silver dress, gold earrings, smoky eye makeup, tragic high-class allure, night city penthouse"],
      ["Rogue Amendiares", "rogue amendiares from cyberpunk 2077, fixer, short dark hair with grey streaks, sleek black coat, cigarette in hand, jaded queen of the night city underworld"],
      ["Alt Cunningham", "alt cunningham from cyberpunk 2077, legendary netrunner, red dreadlocked hair, glowing blue netrunning suit, semi-transparent digitalized body, code-light aura"],
      ["Hanako Arasaka", "hanako arasaka from cyberpunk 2077, arasaka heiress, long black hair, elegant red and gold kimono, cybernetic silver arm, serene composed beauty"],
      ["V (Cyberpunk)", "v female from cyberpunk 2077, mercenary, short black hair, black and yellow jacket, cyberware arm implants, katana and pistol, neon night city backdrop"],
      ["Ganyu", "ganyu from genshin impact, half-qilin adeptus, long pale blue hair, red and gold horns, blue qipao with patterned sleeves, gentle serene beauty, glacial aura"],
      ["Hu Tao", "hu tao from genshin impact, funeral parlor director, dark brown hair in twin tails with red bows, brown eyes with red accents, black and red hat, cheerful mischievous grin"],
      ["Keqing", "keqing from genshin impact, liyue qixing, long lavender hair in a high ponytail with cat-ear-like ribbons, purple and white dress with gold trim, sharp violet eyes, refined determination"],
      ["Kamisato Ayaka", "kamisato ayaka from genshin impact, cryo swordswoman, long silvery-blue hair with short bangs, blue and white kimono dress with golden accents, elegant fan, graceful noble beauty"],
      ["Yae Miko", "yae miko from genshin impact, kitsune shrine maiden, long pink hair, pointed fox ears, violet eyes, white and pink shrine maiden attire, sly playful smile"],
      ["Furina", "furina from genshin impact, hydro archon, long dark blue and white gradient hair with short bangs, blue and white outfit with half-cloak and hat, dramatic theatrical elegance"],
      ["Kafka", "kafka from honkai star rail, stelleron hunter, long wavy purple hair, dark coat with glowing red accents, tall elegant gunslinger, calm dangerous allure"],
      ["Silver Wolf", "silver wolf from honkai star rail, gamer hacker, short pale pink hair, black and cyan jacket, holographic gaming interface, smirk, playful glitchy aura"],
      ["Bronya", "bronya from honkai star rail, silvermane commander, pale blue hair, red and silver military uniform, white leggings, stern commanding beauty"],
      ["Seele", "seele from honkai star rail, sickle-wielder, long dark blue hair with a side braid, black and violet outfit, glowing eye, fierce wild beauty"],
      ["Nicole Demara", "nicole demara from zenless zone zero, cunning detective, blonde hair, white suit jacket, confident smirk, sharp businesswoman energy"],
      ["Jane Doe", "jane doe from zenless zone zero, undercover agent, long purple hair, black and yellow jacket, piercing eyes, mysterious magnetic aura"],
      ["Sombra", "sombra from overwatch, hacker, short black hair with magenta undercut, purple cybernetic skin tones on one arm, magenta and black outfit, holographic data streams, cocky grin"],
      ["Ashe", "ashe from overwatch, gunslinger queen, long light blonde hair, sharp eyes, dark leather outfit with red scarf, lever-action rifle, cold calculated elegance"],
      ["Kiriko", "kiriko from overwatch, support hero, long black hair with red streak, white and pink fox shrine outfit, kunai and healing ofuda, determined heroic gaze"],
      ["Mei", "mei from overwatch, climatologist, long dark hair with white streak, tan parka with fur hood, frost gun, warm cheerful smile, ice crystals around"],
      ["Wraith", "wraith from apex legends, interdimensional skirmisher, dark purple hair, pale skin, void gauntlets, glowing blue tactical gear, mysterious intense stare"],
      ["Lifeline", "lifeline from apex legends, combat medic, dark skin, blonde locs, green and white combat medic outfit, drone by her side, bright caring smile"],
      ["Loba", "loba from apex legends, thief, dark skin, long platinum blonde hair, elegant black and gold outfit, wolf motif, confident sly smirk"],
      ["Valkyrie (Apex)", "valkyrie from apex legends, jetpack pilot, black hair with purple and green streaks, aviator jacket, high-tech jetpack, cocky grin"],
      ["Jett", "jett from valorant, duelist, long black hair with teal highlights, white hooded jacket with grey sleeves, knives spinning, cool confident smirk"],
      ["Sage", "sage from valorant, healer, long dark hair with green streaks, elegant green and white robe, glowing radianite orbs, calm serene beauty"],
      ["Viper (Valorant)", "viper from valorant, toxic controller, long dark hair, black tactical catsuit with glowing green canisters, gas mask off, cold menacing green eyes"],
      ["Neon", "neon from valorant, speedster, short dark hair with bright blue lightning streaks, blue and white running suit with glowing trails, energetic grin"],
      ["Aerith Gainsborough", "aerith gainsborough from final fantasy 7, flower seller, long chestnut braid with pink ribbon, pink dress with red capelet, green eyes, gentle kind smile"],
      ["Lightning", "lightning from final fantasy 13, soldier, long pink hair, blue eyes, white and black military coat with armor plating, gunblade, cold determined heroine"],
      ["Yuffie Kisaragi", "yuffie from final fantasy 7, ninja, dark brown hair in a ponytail with hairband, green and black attire, shuriken in hand, playful energetic grin"],
      ["Claire Redfield", "claire redfield from resident evil, biker and agent, long reddish-brown hair, red leather jacket, blue jeans, confident survivor heroine"],
      ["Rebecca Chambers", "rebecca chambers from resident evil, rookie medic, short blonde hair, blue and white st.arms uniform with green scarf, gentle brave smile"],
      ["Sheva Alomar", "sheva alomar from resident evil 5, bsw agent, dark skin, long black hair in a ponytail, red and black tactical outfit, dual pistols, fierce warrior beauty"],
      ["Ashley Graham", "ashley graham from resident evil 4, presidents daughter, long blonde hair, white blouse and brown skirt, wide blue eyes, brave"],
      ["Trish", "trish from devil may cry, demon hunter, long blonde hair, silver and black leather outfit, elegant devilish beauty, glowing eyes"],
      ["Lady", "lady from devil may cry, devil hunter, short dark hair, white crop top and black skirt, twin pistols, fierce determined beauty"],
      ["The Boss", "the boss from metal gear solid 3, legendary soldier, grey-blonde hair, military fatigues, bandolier, cold legendary war goddess presence"],
      ["EVA", "eva from metal gear solid 3, spy, long dark hair, fitted combat outfit, katana, confident daring smile"],
      ["Sniper Wolf", "sniper wolf from metal gear solid, sniper, long black hair, grey combat uniform, white sniper rifle, cold poetic beauty, snowy battlefield"],
      ["Ranni", "ranni from elden ring, witch with doll-like pale face and red hair, blue skin on visible hands, dark hooded robe, four arms with glowing eyes, ethereal moon witch aura"],
      ["Malenia", "malenia from elden ring, blade of miquella, long red hair, golden prosthetic arm, scarlet aeonia bloom, green battle armor, tragic divine beauty"],
      ["Freya", "freya from god of war ragnarok, norse goddess of war and love, long red hair, green and brown valkyrie-leather armor, glowing green runes, fierce mother-warrior"],
      ["Angrboda", "angrboda from god of war ragnarok, giantess girl, dark skin with glowing tattoo markings, white hair with braids, green and brown giant-kin outfit, mystical sparkle dust, playful fierce"],
      ["A2", "a2 from nier automata, android, long silver-white hair with short bangs, black sleeveless combat outfit, katana blade, cold lonely beauty"],
      ["Kainé", "kaine from nier, human-shade hybrid, short white hair, red eyes, white and black outfit, two swords, fierce wild beauty"],
      ["Cortana", "cortana from halo GAME, holographic ai, blue skin, short digital blue hair, sleek hologram body, glowing circuits, floating above a light table, brilliant cosmic beauty"],
      ["Kerrigan", "kerrigan from starcraft, queen of blades, white long hair, purple skin, psionic wings and armor, glowing eyes, terrifying beautiful zerg queen"],
      ["Lilith (Diablo 4)", "lilith from diablo 4, daughter of hatred, dark red skin, pale hair, black horns, glowing eyes, shadowy tendrils, demonic queen of hell"],
      ["Andariel", "andariel from diablo, maiden of anguish, dark hair, pale sickly skin, clawed hands, sinister red eyes, demonic tormentor"],
      ["Kassandra", "kassandra from assassins creed odyssey, misthios, short dark brown hair, warm eyes, spartan armor with blue cape, spear of leonidas, fierce greek warrior"],
      ["Eivor", "eivor female from assassins creed valhalla, viking shieldmaiden, red-blonde hair in braids, scarred face, dark wolf-pelt armor, bearded axe, fierce norse raider"],
      ["Evie Frye", "evie frye from assassins creed syndicate, assassin, dark brown hair, victorian dark green and black outfit with top hat, hidden blade, sharp determined elegance"],
      ["Aya", "aya from assassins creed origins, hidden one, short black hair, white and gold egyptian assassin robes, hidden blade, fierce protector"],
      ["Liara T'Soni", "liara tsoni from mass effect, asari archaeologist, blue skin, dark tentacle-like hair crest, purple and white armor, soft violet eyes, brilliant gentle beauty"],
      ["Tali'Zorah", "talizorah from mass effect, quarian engineer, fully sealed purple and silver hazard suit with glowing visor, holo-drones, curious brave spirit"],
      ["Miranda Lawson", "miranda lawson from mass effect, cerberus operative, long dark hair, elegant white and black catsuit, striking blue eyes, poised powerful beauty"],
      ["Commander Shepard", "female commander shepard from mass effect, n7 commander, dark hair, black and white n7 armor with red stripe, futuristic rifle, heroic determined pose"],
      ["Morrigan", "morrigan from dragon age origins, swamp witch, long raven black hair, dark leather outfit with feathers, yellow-gold eyes, sharp wit, wild mystic beauty"],
      ["Cassandra Pentaghast", "cassandra pentaghast from dragon age, seeker, short dark hair, scarred warrior face, silver and red heavy armor, sword and shield, noble fierce beauty"],
      ["Isabela", "isabela from dragon age 2, pirate captain, dark skin, long dark curly hair, red and white pirate outfit, cutlasses, swashbuckling roguish smile"],
      ["Leliana", "leliana from dragon age, bard spymaster, red hair with side braid, hooded leather and armor, twin daggers, sly gentle beauty"],
      ["Shadowheart", "shadowheart from baldur's gate 3, half-elf cleric, dark hair with white bangs, brown eyes, black and silver armor with sharp-jeweled accessories, mysterious guarded beauty"],
      ["Lae'zel", "laezel from baldur's gate 3, githyanki fighter, yellow-green skin, dark hair pulled back, pale yellow eyes, steel armor, greatsword, fierce proud warrior"],
      ["Karlach", "karlach from baldur's gate 3, tiefling barbarian, red skin, dark hair with short bangs, glowing chest infernal engine, muscular build, greatsword, warm fierce smile"],
      ["Minthara", "minthara from baldur's gate 3, drow paladin, pale skin, white hair, purple eyes, dark spiked armor, glowing sword, cruel commanding beauty"],
      ["Sophitia", "sophitia from soulcalibur, greek fighter, long blonde hair in a braid, white and gold outfit, twin swords, gentle fierce goddess-like beauty"],
      ["Xianghua", "xianghua from soulcalibur, chinese swordsman, black hair with red ribbon buns, red and white chinese outfit, kurei blade, playful energetic grace"],
      ["Talim", "talim from soulcalibur, wind priestess, short black hair with green ribbons, green and white tribal outfit, tonfa blades, youthful serene beauty"],
      ["Hilde", "hilde from soulcalibur, princess, long blonde hair, blue and white armor with fur, spear and shield, regal warrior grace"],
      ["Tira", "tira from soulcalibur, deadly dancer, long dark green hair with ringlets, black and purple jester outfit, ringblade, insane playful cruelty"],
      ["Hitomi", "hitomi from dead or alive, karate fighter, long brown hair, blue karate gi, green eyes, warm determined smile"],
      ["Helena Douglas", "helena douglas from dead or alive, opera singer, long blonde hair, elegant white opera gown, noble mysterious beauty"],
      ["Momiji", "momiji from dead or alive, miko shrine maiden, long black hair, white and red shrine maiden outfit, wooden blade, gentle fierce beauty"],
      ["Athena Asamiya", "athena asamiya from king of fighters, idol fighter, short purple hair with a pink headband, pink and white outfit with skirt, energetic charming smile"],
      ["Leona Heidern", "leona heidern from king of fighters, soldier, short red hair, dark green and black outfit, red headband, cold intense blue eyes, wild bloodline power"],
      ["Kula Diamond", "kula diamond from king of fighters, ice girl, long silver-white hair with blue and pink streaks, blue and white futuristic outfit, k frost claws, playful cold beauty"],
      ["Shermie", "shermie from king of fighters, wrestler, long dark red hair, black dress with red trim, mysterious orange eyes, elegant deadly grace"],
      ["Ramlethal", "ramlethal valentine from guilty gear, alien sword-wielder, long white hair, dark skin, twin talking swords, black and red armor, stoic otherworldly beauty"],
      ["Baiken", "baiken from guilty gear, samurai, brown hair with a prominent side bang, traditional kimono with katana, eye patch, tessen fan, fierce ronin grace"],
      ["Millia Rage", "millia rage from guilty gear, assassin, long silver blonde hair, black leather outfit, elegant deadly grace, cold beauty"],
      ["Makoto Niijima", "makoto niijima from persona 5, student council president, long dark brown hair, red eyes, black school uniform, brass knuckles, serious determined beauty"],
      ["Ann Takamaki", "ann takamaki from persona 5, model and phantom thief, long blonde hair, blue eyes, black school uniform and red cat-suit, playful charming smile"],
      ["Futaba Sakura", "futaba sakura from persona 5, hacker, short brown hair, thick glasses, oversized orange hoodie, small petite frame, shy brilliant energy"],
      ["Edelgard", "edelgard from fire emblem three houses, flame emperor, long light grey-white hair, regal crimson and black armor with fur collar, axe, fierce determined empress"],
      ["Camilla", "camilla from fire emblem fates, princess, long purple hair, ornate black and gold armor, dark sorcery, dangerous regal beauty"],
      ["Tharja", "tharja from fire emblem awakening, dark mage, long black hair, dark black and purple outfit, hexes and curses, obsessive mysterious beauty"],
      ["Lucina", "lucina from fire emblem awakening, prince marth in disguise, long blue hair, white and blue coat with shoulder armor, falchion sword, determined heroic beauty"],
      ["Jinhsi", "jinhsi from wuthering waves, magistrate, long white hair with violet accents, elegant blue and gold dress, glowing golden dragon aura, serene regal beauty"],
      ["Changli", "changli from wuthering waves, judge, long red hair, elegant black and red dress with golden crane motifs, crimson eyes, refined deadly elegance"],
      ["Hinata Hyuga", "hinata hyuga from naruto, gentle kunoichi, long dark blue hair, pale lavender eyes, light purple jacket, shy gentle smile, byakugan warrior"],
      ["Sakura Haruno", "sakura haruno from naruto, kunoichi medic, long pink hair, green eyes, red outfit with gloves, strong determined heroine"],
      ["Tsunade", "tsunade from naruto, legendary sannin, blonde hair in two buns, green haori coat, large forehead symbol, fierce confident beauty"],
      ["Temari", "temari from naruto, wind kunoichi, long blonde hair in a ponytail, purple outfit, giant iron fan, sharp confident smirk"],
      ["Boa Hancock", "boa hancock from one piece, pirate empress, very long black hair, violet eyes, elegant red dress with snake motif, arrogant goddess beauty"],
      ["Yamato", "yamato from one piece, kaido's daughter, white hair with blue and red streaks, dark blue outfit with fur and mask, spiked club, fierce oni beauty"],
      ["Perona", "perona from one piece, ghost girl, long pink hair, gothic dress with ruffles, crown hat, eerie cute charm, hollow spirits around"],
      ["Historia Reiss", "historia reiss from attack on titan, queen, short blonde hair, blue eyes, elegant green and white outfit, gentle serene beauty"],
      ["Annie Leonhart", "annie leonhart from attack on titan, warrior, short blonde hair, blue eyes, military uniform with red scarf, cold fighting beauty, crystalline shards"],
      ["Sasha Blouse", "sasha blouse from attack on titan, scout, long dark brown hair in a bun, green military cloak, bow, hungry cheerful wild smile"],
      ["Nezuko Kamado", "nezuko kamado from demon slayer, demon girl, long black hair with pink tips, pink eyes, bamboo muzzle, pale skin, pink kimono with black grid pattern, demon powers"],
      ["Mitsuri Kanroji", "mitsuri kanroji from demon slayer, love hashira, long pink and green gradient hair in braided tails, green eyes with beauty marks, white and pink uniform, love sword, gentle sweet fierce beauty"],
      ["Shinobu Kocho", "shinobu kocho from demon slayer, insect hashira, short black hair with purple tips, violet eyes, butterfly patterned haori, thin elegant sword, cold polite smile"],
      ["Nobara Kugisaki", "nobara kugisaki from jujutsu kaisen, jujutsu sorcerer, short orange-brown hair, freckles, dark school uniform, hammer and nails, confident fierce smile"],
      ["Maki Zenin", "maki zenin from jujutsu kaisen, jujutsu sorcerer, long dark hair tied back, glasses, dark school uniform, cursed tool katana, cold powerful aura"],
      ["Power", "power from chainsaw man, fiend, long blonde hair, red eyes, devil hunter suit with necktie, blood manipulation axe, wild manic grin"],
      ["Reze", "reze from chainsaw man, bomb devil, short ash-blonde hair, soft red eyes, casual dress, bombs hidden in palms, sweet dangerous smile"],
      ["Himeno", "himeno from chainsaw man, devil hunter, long dark hair, black suit with white shirt, cigarette, tired mysterious beauty"],
      ["Riza Hawkeye", "riza hawkeye from fullmetal alchemist, captain, short blonde hair, red eyes, military uniform with goggles, twin pistols, calm deadly loyalty"],
      ["Winry Rockbell", "winry rockbell from fullmetal alchemist, automail engineer, long blonde hair, blue eyes, overalls and wrench, bright cheerful energy"],
      ["Lust", "lust from fullmetal alchemist, homunculus, long black hair, amber eyes, black outfit, sharp claws, cold deadly beauty"],
      ["Olivier Mira Armstrong", "olivier mira armstrong from fullmetal alchemist, general, long blonde hair with bangs, ice blue eyes, military uniform, sabre, regal unyielding warrior"],
      ["Asuka Langley", "asuka langley soryu from evangelion, pilot, long red hair in twin tails with headband, yellow and red plugsuit, confident tsundere energy"],
      ["Rei Ayanami", "rei ayanami from evangelion, pilot, short blue hair, red eyes, white plugsuit, pale stoic beauty, ethereal mystery"],
      ["Misato Katsuragi", "misato katsuragi from evangelion, operations director, dark purple hair, green jacket, beer can, cheerful mature energy"],
      ["Faye Valentine", "faye valentine from cowboy bebop, bounty hunter, short green hair, yellow jacket over white top, short shorts, fiery confident beauty"],
      ["Ryuko Matoi", "ryuko matoi from kill la kill, fighter, long black hair with red streak, red and black sailor uniform, scissor blade, fierce determined rage"],
      ["Satsuki Kiryuin", "satsuki kiryuin from kill la kill, student council president, long blue-black hair, white and red kamui, kendo sword, commanding icy presence"],
      ["Zero Two", "zero two from darling in the franxx, klaxosaur pilot, long pink hair with short bangs, red horns, blue eyes, black and white pilot suit, fang grin, wild fierce beauty"],
      ["Asuna", "asuna from sword art online, flash, long chestnut hair, hazel eyes, white and red berserk healer outfit, rapier, gentle brave beauty"],
      ["Motoko Kusanagi", "motoko kusanagi from ghost in the shell, cyborg major, short purple hair, red eyes, futuristic black bodysuit, cyberpunk city, stoic intense beauty"]

    ]},
    { e: "🎬", n: "Film & Comics", items: [
      ["Æon Flux", "aeon flux from the aeon flux animated series, shaved bald head, dark intense eyes, black figure-hugging bodysuit, futuristic assassin, mysterious cold beauty"],
      ["Alice", "alice from resident evil, short dark brown bob hair, pale skin, red sleeveless dress, combat-ready with dual guns, fierce heroine"],
      ["Anck-su-namun", "anck-su-namun from the mummy, dark-haired ancient egyptian priestess, tan skin, ornate gold headdress and jewelry, ornate gold ceremonial dress, dark kohl-lined eyes"],
      ["Anna", "anna from frozen, auburn red hair in twin braids, green eyes, freckles, green and coral queen gown, cheerful smile"],
      ["Ariel", "ariel the little mermaid, long flowing red hair, blue eyes, fair skin, seashell top, elegant green gown, bright cheerful beauty"],
      ["Aura", "aura from flash gordon, long red hair, ornate purple sci-fi outfit, exotic alien princess beauty"],
      ["Aurora", "aurora from sleeping beauty, long golden blonde hair, blue eyes, pink and blue princess gown, elegant gentle beauty"],
      ["Belle", "belle from beauty and the beast, long chestnut brown hair, blue eyes, golden yellow ballgown, holding a book, intelligent kind beauty"],
      ["Black Widow", "black widow from marvel comics, long wavy red hair, pale skin, black leather catsuit with red hourglass zipper, wrist-mounted widow's bite gauntlets, fierce pose"],
      ["Catwoman", "catwoman from dc comics, black leather catsuit with cat-eared cowl and goggles, whip, sleek feline movements, sly smirk"],
      ["Cinderella", "cinderella, blonde hair in an elegant updo, sparkling blue ballgown, glass slippers, delicate graceful beauty"],
      ["Cleopatra", "cleopatra, egyptian queen with dark hair, heavy kohl-lined eyes, gold crown and snake jewelry, white and gold gown, regal beauty"],
      ["Dark Phoenix", "dark phoenix from marvel comics x-men, long red hair, black and gold phoenix costume, wreathed in cosmic fire, powerful raging expression"],
      ["Elektra", "elektra from marvel comics, long dark hair, red sleeveless outfit, twin sais, deadly assassin stance, intense gaze"],
      ["Elsa", "elsa from frozen, platinum blonde hair in a side braid, blue eyes, ice-blue shimmering crystal gown, pale skin, ice queen grace"],
      ["Emma Frost", "emma frost from marvel comics x-men, platinum blonde hair, elegant white and black outfit, diamond crystal skin, cold confident beauty"],
      ["Felicia Hardy", "felicia hardy black cat from marvel comics black cat, long white-platinum hair, black and white figure-hugging catsuit, cat burglar grace, sly smirk"],
      ["Harley Quinn", "harley quinn from dc comics, blonde pigtails dyed red and blue, black and red jester costume, smudged makeup, giant mallet, chaotic grin"],
      ["Ice Queen", "an ice queen in a frost palace, cold beauty"],
      ["Jean Grey", "jean grey from marvel comics x-men, long red hair, green and yellow x-men uniform, telekinetic aura, kind yet powerful"],
      ["Jasmine", "jasmine from aladdin, long dark hair, olive skin, turquoise harem pants with gold crop top, gold jewelry, regal exotic beauty"],
      ["Jessica Rabbit", "jessica rabbit from the film who framed roger rabbit, glamorous stage look, long wavy red hair, red strapless gown with long purple gloves, confident showgirl pose"],
      ["Maleficent", "maleficent from disney's sleeping beauty, pale green-tinged skin, large curved black horns, dramatic black robes with gold trim, dark sorceress staff, imperious beauty"],
      ["Mathilda (Grown Up)", "all-grown-up mathilda, adult woman with short dark brown bob hair, black leather jacket, choker necklace, calm confident gaze"],
      ["Merida", "merida from brave, wild voluminous curly red hair, blue-green eyes, teal dress with silver brooch, bow and quiver, free-spirited archer"],
      ["Stage Jessica", "jessica rabbit in a stage costume from the film who framed roger rabbit, glamorous stage look, long wavy red hair, red sequin stage gown with purple gloves, confident showgirl pose"],
      ["Messy Harley Quinn", "messy harley quinn from dc comics, smeared clown makeup, tangled blonde pigtails dyed red and blue, torn jester costume, chaotic wild grin"],
      ["Dairy Farm Girl", "a dairy farm girl with a milk pail at a barn, morning chores"],
      ["Mulan", "mulan, black hair in an elegant updo, red and gold chinese warrior armor, sword, determined gaze"],
      ["Mystique", "mystique from marvel comics x-men, deep blue scaly skin, red hair, yellow eyes, fitted dark combat suit, shapeshifter"],
      ["Pink Power Ranger Girl", "a pink power ranger girl from the power rangers, pink and white spandex ranger suit, holding her pink helmet under her arm, superhero pose"],
      ["Pocahontas", "pocahontas, long flowing black hair, tan skin, fringed deerskin dress, beaded necklace, windswept natural beauty"],
      ["Poison Ivy (Leaf-Suit)", "poison ivy in a leaf-suit from dc comics, long red hair, body wrapped in green leaves, green eyes, striking magnetic beauty"],
      ["Poison Ivy (Vine)", "poison ivy from dc comics, long red hair, pale green-tinged skin, dressed in living vines, green eyes, striking poisonous beauty"],
      ["Princess Leia", "princess leia from star wars, brown hair in the classic cinnamon-bun style, white ceremonial gown, regal sci-fi princess"],
      ["Psylocke", "psylocke from marvel comics x-men, purple hair, purple and black x-men outfit, glowing psychic katana, telekinetic power"],
      ["Rapunzel", "rapunzel, extremely long golden blonde braided hair, purple dress with white puff sleeves, green eyes, charming smile"],
      ["Rogue", "rogue from x-men, dark brown hair with a white streak, green and yellow x-men uniform, leather jacket, tough southern charm"],
      ["Runaway Bride", "a runaway bride in a wedding dress, running"],
      ["Sailor Moon", "sailor moon from the anime sailor moon, long blonde hair in two odango buns with long tails, red tiara, white sailor fuku with red bow and blue skirt, cheerful heroine"],
      ["Stage Performer", "a stage performer with bunny ears headband and a sparkling stage costume"],
      ["Scarlet Witch", "scarlet witch from marvel comics, long wavy red hair, crimson red corset costume with black accents, glowing red chaos magic, powerful beauty"],
      ["Selene (Underworld)", "selene from underworld, black shoulder-length hair, pale skin, long black leather coat, dual pistols, vampire death dealer, cold stare"],
      ["Sha'yi Taandu", "a desert warrior woman, fierce and loyal"],
      ["She-Hulk", "she-hulk from marvel comics, tall muscular woman with green skin, dark green hair, professional suit, confident smile, lawyer superhero"],
      ["Harem Princess", "a harem princess in elegant silks"],
      ["Snow White", "snow white from disney's snow white, raven black hair with a red bow, porcelain skin, blue and red dress with yellow accents, sweet beauty"],
      ["Spider-Gwen", "spider-gwen from marvel comics, blonde ponytail, white pink and black hooded spider suit with web pattern, masked superhero"],
      ["Storm", "storm from x-men, white hair, dark skin, black leather x-men outfit, lightning energy crackling, regal weather goddess"],
      ["Sucker Punch Amber", "sucker punch amber from the film sucker punch, goth with short dark hair, black and white doll-like dress, twin guns, deadpan beauty"],
      ["Sucker Punch Fighter", "sucker punch fighter from the film sucker punch, short dark bob hair, stage costume with heavy dark makeup, katana, intense haunted eyes"],
      ["Sucker Punch Blondie", "sucker punch blondie from the film sucker punch, blonde hair, stylized military-style outfit, knives, playful yet deadly"],
      ["Supergirl", null, "Heroic full-body shot of an adult Supergirl hovering high above a city at eye level, facing the camera with a determined gaze. She wears a red cape, a modest solid red skirt worn over her iconic cobalt-blue suit, and matching red knee-high boots. Her cobalt-blue suit has a classic heroic cut with a high neckline and full coverage, its metallic sheen catching the light. She hovers steady and poised. High-altitude bright sunlight, lens flare, motion blur in the background clouds, extremely detailed fabric textures. RAW photo, 8k uhd, cinematic realism, authentic skin tones, no filters. Her matching red knee-high boots gleam with polished precision. Her windswept blonde hair, radiant under the cinematic lighting, frames a face of determined focus, eyes locked on some distant threat. Shot with a 75mm lens, classic heroic composition, the depth of field isolating her against a softly blurred metropolis below."],
      ["Shadow Catwoman", "a catwoman in black catsuit with cat-eared cowl from dc comics, whip, agile feline pose"],
      ["The Bride", "the bride from kill bill, black hair, yellow and black motorcycle jumpsuit, katana on her back, fierce vengeance gaze"],
      ["Tiana", "tiana from the princess and the frog, dark skin, brown hair in an elegant updo, sparkling green ballgown, warm determined beauty"],
      ["Velma", "velma from scooby-doo, brown bob hair, thick round glasses, orange turtleneck and red pleated skirt, cute bookish nerd"],
      ["Wonder Woman", "wonder woman from dc comics, long black hair, silver tiara, red and gold bustier with eagle emblem, blue star-spangled shorts, golden lasso, amazon warrior"],
      ["Xenia Onatopp", "xenia onatopp from goldeneye, sleek blonde hair, elegant designer outfits, deadly elegant beauty"],
      ["Zatanna", "zatanna from dc comics, long black hair, top hat, black tuxedo jacket over white shirt, dark stockings, playing cards, stage magician"],
      ["Little Red Riding Hood", "little red riding hood, auburn hair in two braids, bright red hooded cape with white trim, white blouse with a laced bodice and apron skirt, wicker basket in hand, cheerful beauty in a forest"],
      ["Daphne Blake", "daphne blake from scooby-doo, long auburn red hair, green eyes, purple mini dress with a green headband and matching scarf, lavender tights, orange knee-high boots, glamorous mystery-solver"],
      ["Moana", "moana, very long thick black wavy hair, tan skin, red and white striped top with a green skirt, flower necklace, sailing the open ocean, adventurous spirit"],
      ["Raya", "raya from raya and the last dragon, long dark brown hair tied in a high messy bun with a red cord, tan skin, blue and green warrior tunic, golden dagger at her hip, determined warrior princess"],
      ["Kim Possible", "kim possible from the disney animated series kim possible, shoulder-length red hair, green eyes, green cargo pants, black crop top with a utility belt, black gloves and boots, confident hero pose"],
      ["Shego", "shego from kim possible, long jet-black hair, pale green skin, black and green sleeveless catsuit, glowing green plasma claws, sarcastic evil smirk"],
      ["Raven", "raven from the titans animated series, violet-purple hair in an asymmetrical bob covering one eye, pale skin, dark plum and blue bodysuit with a silver belt and buckled collar, glowing dark-empress aura"],
      ["Starfire", "starfire from the titans animated series, very long flowing red-orange hair, bright green eyes, purple and blue alien bodysuit with a silver collar, glowing green starbolts, floating gracefully"],
      ["Nami", "nami from one piece, long orange hair, brown eyes, blue and white striped shirt, black shorts, gold log pose on her wrist, playful confident smile"],
      ["Nico Robin", "nico robin from one piece, long straight black hair, tan skin, blue-grey eyes, purple hat and elegant purple and white outfit, floating cherry blossom petals, mature mysterious beauty"],
      ["Mikasa Ackerman", "mikasa ackerman from the anime attack on titan, short black hair, grey eyes, red scarf, white attack on titan survey corps jacket with brown harness straps, determined intense gaze"],
      ["Betty Boop", "betty boop from the classic betty boop cartoon, short black bob hair with a tiny curl, huge sparkling cartoon eyes, red strapless dress, black stockings and high heels, classic 1930s cartoon style"],
      ["Hermione Granger", "hermione granger from harry potter, bushy dark brown hair, brown eyes, red and gold gryffindor sweater with a lion crest, wool skirt, holding a wand, intelligent determined look"],
      ["Daenerys Targaryen", "daenerys targaryen from game of thrones, very long platinum blonde braided hair, violet-blue eyes, pale skin, blue and silver gown with dragon-scale details, a small dragon on her shoulder, khaleesi regal beauty"],
      ["Captain Marvel", "captain marvel from marvel comics, long wavy blonde hair, blue eyes, red blue and gold star-spangled suit, glowing cosmic energy aura, fierce flying pose"],
      ["Gamora", "gamora from marvel comics, long straight dark brown hair, green skin, black and red leather armored suit with gold straps, holding a sword, fierce guardian of the galaxy"],
      ["Ahsoka Tano", "ahsoka tano from star wars, togruta with orange and white skin, blue montrals and lekku, blue and white warrior robes, twin white lightsabers, jedi knight"],
      ["Cersei Lannister", "cersei lannister from game of thrones, very long golden blonde hair, green eyes, elegant red and gold lannister gown, wine goblet, cold ruthless queen beauty"],
      ["Arya Stark", "arya stark from game of thrones, long brown hair, grey eyes, dark leather outfit, needle sword, fierce determined assassin"],
      ["Sansa Stark", "sansa stark from game of thrones, queen in the north, long auburn red hair, blue eyes, elegant white northern gown with wolf fur, regal icy beauty"],
      ["Melisandre", "melisandre from game of thrones, red priestess, long copper red hair, red eyes, crimson red robes with gold trim, glowing ruby necklace, mysterious arcane power"],
      ["Brienne of Tarth", "brienne of tarth from game of thrones, knight, tall blonde hair, freckled scarred face, blue and gold renly armor, valyrian steel sword oathkeeper, noble fierce knight"],
      ["Ygritte", "ygritte from game of thrones, wildling, wild red hair, freckles, pale blue eyes, fur and leather wildling clothes, bow and arrows, fierce playful grin"],
      ["Margaery Tyrell", "margaery tyrell from game of thrones, queen, long brown hair, elegant white and gold gown with flower embroidery, warm cunning smile, noble beauty"],
      ["Rhaenyra Targaryen", "rhaenyra targaryen from house of the dragon, princess, long silver-blonde hair in braids, violet eyes, black and red valyrian gown with dragon sigils, dragon egg, regal fierce beauty"],
      ["Alicent Hightower", "alicent hightower from house of the dragon, queen, long auburn hair, green and gold hightower gown, stern devout beauty, dagger hidden"],
      ["Rhaenys Targaryen", "rhaenys targaryen from house of the dragon, queen who never was, silver hair streaked with black, elegant black and red armor-riding leathers, fierce regal presence"],
      ["Eleven", "eleven from stranger things, psychic girl, curly short brown hair, dark eyes, 80s jacket, eggo waffle, telekinetic blood nose, mysterious powerful aura"],
      ["Max Mayfield", "max mayfield from stranger things, skateboarder girl, long red hair, 80s denim and purple outfit, camera and walkman, fierce cool beauty"],
      ["Robin Buckley", "robin buckley from stranger things, scoops ahoy clerk, curly light brown hair, 80s blue and white scoops ahoy uniform, playful clever smile"],
      ["Ellie Williams", "ellie from the last of us, survivor, shoulder-length brown hair in a braid, freckles, green eyes, plaid shirt and backpack, knife, determined post-apocalyptic heroine"],
      ["Abby Anderson", "abby from the last of us 2, soldier, blonde hair in a ponytail, muscular athletic build, grey tank top, scars, fierce survivor warrior"],
      ["Rey Skywalker", "rey from star wars, scavenger turned jedi, long brown hair in buns, sand-colored desert robes, quarterstaff and lightsaber, hopeful fierce beauty"],
      ["Padmé Amidala", "padme amidala from star wars, queen and senator, long dark brown hair in elaborate braids, elegant royal gown with gold headpiece, regal graceful beauty"],
      ["Asajj Ventress", "asajj ventress from star wars, sith assassin, bald head, pale skin, dark eyes, black and grey outfit, twin curved red lightsabers, cold deadly beauty"],
      ["Bo-Katan Kryze", "bo-katan kryze from star wars, mandalorian, short dark hair, red and silver mandalorian armor, blaster, fierce warrior leader"],
      ["Nebula", "nebula from marvel, cybernetic assassin, bald head, blue-tinged skin, black cybernetic implants, metal arm, cold scarred beauty"],
      ["Wasp", "wasp from marvel, hope van dyne, blonde hair, black and yellow cybernetic suit with wings, glowing sting blasts, fierce graceful heroine"],
      ["Batgirl", "batgirl from dc, barbara gordon, red hair, black and purple batsuit with cape, utility belt, confident crime-fighting heroine"],
      ["Black Canary", "black canary from dc, metahuman singer, long platinum blonde hair, black leather jacket and dark stockings, sonic scream, fierce rock star heroine"],
      ["Mera", "mera from dc, atlantean queen, long red hair, green scaled mermaid armor, golden tiara, water bending, fierce aquatic beauty"]

    ]},
    { e: "🎭", n: "Character Vibes", items: [
      ["Chaise Reverie", "elegant woman in a vintage silk robe reclining on a chaise lounge, soft candlelight, tasteful classical portrait, painterly mood"],
      ["Streamer", "young woman streaming from a cozy home studio, ring light and microphone on the desk, cheerful friendly vibe, warm home lighting"],
      ["Preppy Student", "young woman in a modest plaid skirt, white blouse and cardigan, school hallway, bright friendly smile"],
      ["Librarian", "young woman with glasses and a neat bun, buttoned blouse and long skirt, warm knowing smile, cozy bookshelf background"],
      ["Night-Shift Nurse", "young woman in a professional white nurse uniform with a stethoscope, caring smile, quiet hospital corridor at night"],
      ["Flight Attendant", "young woman in a neat flight attendant uniform with a scarf, friendly professional smile, airplane cabin"],
      ["Stage Dancer", "young woman dancing on a stage under a spotlight, sparkling costume, joyful dynamic performance, concert lights"],
      ["Executive", "young woman in a tailored business suit sitting at an executive desk, confident professional gaze, modern glass office"],
      ["Video Creator", "young woman filming a video in a cozy home studio with a phone on a tripod and ring light, cheerful creator vibe"],
      ["Classic Maid", "young woman in a modest vintage maid uniform with a white apron, feather duster, cheerful smile, elegant manor"],
      ["Rainy Stroll", "young woman with a clear dome umbrella in soft rain, city lights bokeh, cozy cinematic mood"],
      ["Gym Goer", "fit young woman in athletic wear training with gym equipment, focused energetic expression, bright gym interior"],
      ["Artist's Muse", "young woman in a flowing dress posing in an art studio, painter's canvas in the background, creative atmosphere"],
      ["Cheer Captain", "young woman in a full-length cheer uniform with pompoms, energetic confident team pose, stadium lights"],
      ["Romantic Evening", "young woman in an elegant evening dress in a rose-decorated ballroom, soft romantic lighting, gentle smile"],
      ["Pirate Captain", "young woman pirate captain in a leather coat and tricorn hat, cutlass, ship deck at ocean sunset, bold adventurous grin"],
      ["Tattoo Artist", "young woman tattoo artist with tattooed arms in a casual top, working in a studio, creative edgy atmosphere"],
      ["Beach Day", "young woman in a sporty one-piece swimsuit on a beach at sunset, wet hair, golden hour glow, joyful wave"],
      ["Police Officer", "young woman in a professional police uniform with cap and badge, confident stance, patrol car on a city street"]
    ]},
    { e: "\uD83D\uDC64", n: "Personas", items: [
      ["Actress Portrait", "glamorous actress in a soft-focus studio portrait, elegant styling, red-carpet beauty"],
      ["Actor Headshot", "professional actor headshot, neutral backdrop, confident approachable expression"],
      ["Celebrity Portrait", "A-list celebrity editorial portrait, designer outfit, confident red-carpet aura"],
      ["Musician Portrait", "moody musician portrait holding an instrument, artistic studio light"],
      ["Supermodel Portrait", "high-fashion supermodel portrait, striking cheekbones, intense editorial gaze"],
      ["Movie Star", "classic movie star portrait, glamorous styling, silver-screen charisma"],
      ["Silent Film Star", "1920s silent-film star, expressive face, vintage black-and-white portrait styling"],
      ["Vanity Fair Portrait", "polished Vanity Fair style celebrity portrait, dramatic lighting, luxurious styling"],
      ["Fashion Model", "fashion model mid-runway walk, designer outfit, confident stride"],
      ["Runway Model", "runway model under bright catwalk lights, avant-garde couture look"],
      ["Supermodel", "supermodel in a high-fashion editorial, sleek styling, powerful pose"],
      ["Editorial Fashion", "editorial fashion model, bold styling, magazine-spread lighting"],
      ["Vintage Fashion", "woman in vintage fashion, retro styling, nostalgic film tones"],
      ["Retro Fashion", "retro fashion model, bold sixties colors, playful styling"],
      ["Silk Robe Model", "silk robe model in flowing silk, soft studio lighting, tasteful elegant pose"],
      ["Swimsuit Model", "swimsuit model on a sunny beach, radiant glow, sporty confidence"],
      ["Hipster", "hipster woman in thrift-store layers, beanie and round glasses, artsy coffee-shop vibe"],
      ["Punk Rocker", "punk rocker with a mohawk and studded jacket, rebellious attitude, smoky club"],
      ["Prom Queen", "prom queen in a sparkling gown and tiara, festive dance-floor lights"],
      ["Beauty Pageant", "beauty pageant contestant on stage in an evening gown, sash and spotlight"],
      ["Bombshell", "classic bombshell with hollywood waves and bold red lips, vintage charm"],
      ["Poster Girl", "1950s poster girl, retro styling, playful wink, vintage poster colors"],
      ["Rockstar", "rockstar woman on stage with a guitar, leather and attitude, concert lights"],
      ["Magazine Cover Girl", "magazine cover girl, bold editorial layout vibe, flawless beauty"],
      ["Vogue Cover", "Vogue cover model, high-fashion elegance, refined editorial lighting"],
      ["Basketball Star", "basketball star in a team jersey, athletic pose, arena lights"],
      ["Bodybuilder", "female bodybuilder with sculpted muscles, gym lighting, powerful pose"],
      ["Boxer", "female boxer with hand wraps and gloves, determined gaze, ring corner"],
      ["Football Player", "female football player in a uniform, stadium field, confident stance"],
      ["MMA Fighter", "female MMA fighter in fight gear, intense stare, cage-side lights"],
      ["Olympic Athlete", "Olympic athlete in a national kit, podium-ready confidence, stadium"],
      ["Skater", "skater girl with a skateboard, street style, urban skatepark"],
      ["Surfer", "surfer woman with a board, wet hair, ocean waves at golden hour"],
      ["Wrestler", "female wrestler in ring gear, dynamic pose, arena spotlights"],
      ["Ballet Dancer", "ballerina in a tutu mid-pirouette, stage lighting, graceful poise"],
      ["Street Dancer", "street dancer mid-move, urban backdrop, dynamic energy"],
      ["Fitness Model", "fitness model in athletic wear, toned physique, clean gym studio"],
      ["Yoga Model", "yoga model in a serene pose, soft daylight, calm wellness studio"],
      ["1920s Flapper", "1920s flapper in a beaded fringe dress and cloche hat, art-deco ballroom, jazz-age editorial"],
      ["1950s Polka-Dot", "1950s polka-dot dress, vintage kitchen set, playful classic pose"],
      ["1960s Mod", "1960s mod girl in a geometric shift dress with bouffant hair, scooter-era London"],
      ["1970s Disco", "1970s disco dancer in a sequined jumpsuit, disco-ball lights, funky pose"],
      ["1980s Glam", "1980s glam woman with big hair and neon makeup, bold colors, retro studio"],
      ["1990s Grunge", "1990s grunge girl in flannel and ripped jeans, moody film tones, cassette-era vibe"],
      ["2000s Y2K", "2000s Y2K fashion girl in low-rise denim with butterfly clips, glossy pop styling"],
      ["Golden Age of Hollywood", "golden-age Hollywood starlet, satin gown, dramatic studio lighting, vintage elegance"],
      ["Old Hollywood", "old Hollywood editorial portrait, sculpted waves, red lips, silver-screen sophistication"],
      ["Hollywood Editorial", "Hollywood editorial portrait, sparkling jewelry, luxurious studio lighting"]
    ]}
  ];
  // 🔢 Egon 23.09.2026 — publish the premade count the moment this file loads: the HOME page caption reads it
  // ("select one of our N Premade Characters!"), and the number must be right without the visitor having ever
  // opened the 🎭 panel (the panel recomputes the same total for its header). See dragonHomePremadePhrase().
  try { window.dragonPremadeTotal = PREMADE.reduce(function (n, c) { return n + ((c && c.items) ? c.items.length : 0); }, 0); } catch (e) {}
  ;function dragonPremadePanel() {
    var ov = document.createElement("div");
    ov.style.cssText = "position:fixed; inset:0; background:rgba(10,10,14,.94); z-index:2147483600; display:flex; align-items:center; justify-content:center; padding:1rem;";
    var box = document.createElement("div");
    box.style.cssText = "background:linear-gradient(145deg,#1a1a24,#101018); border:1px solid #6a5a9a; border-radius:14px; max-width:760px; width:100%; max-height:90vh; display:flex; flex-direction:column; overflow:hidden;";
    var head = document.createElement("div");
    head.style.cssText = "padding:.65rem .9rem; border-bottom:1px solid #3a3a48; display:flex; align-items:center; justify-content:space-between; gap:.5rem;";
    var h = document.createElement("b");
    h.textContent = "\uD83C\uDFE5 Premade Characters";
    h.style.color = "#c9a8ff";
    var x = document.createElement("button");
    x.textContent = "\u2716";
    x.title = "Close";
    x.style.cssText = "cursor:pointer; background:none; border:none; color:#bbb; font-size:1.1rem; padding:.2rem .4rem;";
    x.onclick = close;
    head.append(h, x);
    var sub = document.createElement("div");
    sub.textContent = "Tap one \u2014 she loads into your description with \u2728 random detail slots, so every generation gives a fresh look. Search to filter, categories are alphabetical.";
    sub.style.cssText = "font-size:.72rem; color:#aaa; padding:.4rem .9rem .1rem;";
    var search = document.createElement("input");
    search.type = "text";
    search.placeholder = "\uD83D\uDD0D Search... (e.g. vampire, tifa, cat)";
    search.style.cssText = "margin:.5rem .9rem 0; padding:.4rem .6rem; border-radius:8px; border:1px solid #6a5a9a; background:#14141c; color:#e8e8f0; font-size:.8rem; width:calc(100% - 2rem); box-sizing:border-box;";
    var list = document.createElement("div");
    list.style.cssText = "overflow-y:auto; padding:.6rem .9rem 1.2rem; display:flex; flex-direction:column; gap:.7rem; scrollbar-width:thin; scrollbar-color:#6a5a9a transparent;";
    var sections = [];
    var ALL_TOTAL = 0;
    PREMADE.forEach(function (cat) { ALL_TOTAL += cat.items.length; });
    try { window.dragonPremadeTotal = ALL_TOTAL; } catch (e) {}
    h.textContent = "\uD83C\uDFE5 Premade Characters \u2014 " + ALL_TOTAL + " total";

    ;function loadItem(cat, it) {
      var prompt = it.length > 2 ? it[2] : premadePrompt(it[1]);
      setDescFB(prompt);
      toast(cat.e + " " + it[0] + " loaded \u2014 random details on every generation");
      close();
    }
    ;function randomOf(cat) {
      var arr = (cat && cat.items) || [];
      return arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
    }
    // Top: random character from ANY category.
    var topRand = document.createElement("button");
    topRand.textContent = "\uD83C\uDFB2 Random Character \u2014 from any category";
    topRand.title = "Load a random character from all categories";
    topRand.style.cssText = "margin:.5rem .9rem 0; align-self:center; font-size:.8rem; padding:.45rem .9rem; border:1px solid #ffd76a; background:linear-gradient(180deg,#4a3a1a,#2a2416); color:#ffe9a8; border-radius:999px; cursor:pointer; font-weight:bold;";
    topRand.onclick = function () {
      var cat = PREMADE[Math.floor(Math.random() * PREMADE.length)];
      var it = randomOf(cat); if (it) loadItem(cat, it);
    };

    PREMADE.forEach(function (cat) {
      var sec = document.createElement("div");
      var headWrap = document.createElement("div");
      headWrap.style.cssText = "display:flex; align-items:center; justify-content:center; gap:.5rem; flex-wrap:wrap; margin-bottom:.35rem;";
      var head2 = document.createElement("div");
      head2.textContent = cat.e + " " + cat.n + " \u2014 " + cat.items.length;
      head2.style.cssText = "font-size:.78rem; font-weight:bold; color:#ffd76a;";
      var rBtn = document.createElement("button");
      rBtn.textContent = "\uD83C\uDFB2 Random";
      rBtn.title = "Load a random character from this category";
      rBtn.style.cssText = "font-size:.68rem; padding:.24rem .55rem; border:1px solid #9b6bff; background:linear-gradient(145deg,#2a1a4a,#14101f); color:#d8c9ff; border-radius:999px; cursor:pointer; font-weight:bold;";
      rBtn.onclick = function () { var it = randomOf(cat); if (it) loadItem(cat, it); };
      var row = document.createElement("div");
      row.style.cssText = "display:flex; flex-wrap:wrap; gap:.4rem; justify-content:center;";
      var chips = [];
      var items = cat.items.slice().sort(function (a, b) { return a[0].localeCompare(b[0]); });
      items.forEach(function (it) {
        var b = document.createElement("button");
        b.textContent = cat.e + " " + it[0];
        b.title = "Load " + it[0];
        b.dataset.q = it[0].toLowerCase();
        b.style.cssText = "font-size:.78rem; padding:.42rem .62rem; border:1px solid #6a5a9a; background:linear-gradient(145deg,#241c3a,#16121f); color:#d8c9ff; border-radius:999px; cursor:pointer;";
        b.onclick = function () { loadItem(cat, it); };
        chips.push(b);
        row.appendChild(b);
      });
      headWrap.append(head2, rBtn);
      sec.append(headWrap, row);
      list.appendChild(sec);
      sections.push({ cat: cat, sec: sec, chips: chips, head: head2 });
    });
    search.addEventListener("input", function () {
      var q = search.value.trim().toLowerCase();
      sections.forEach(function (s) {
        var vis = 0;
        s.chips.forEach(function (c) {
          var show = !q || c.dataset.q.indexOf(q) !== -1;
          c.style.display = show ? "" : "none";
          if (show) vis++;
        });
        s.sec.style.display = vis ? "" : "none";
        s.head.textContent = s.cat.e + " " + s.cat.n + " \u2014 " + vis + "/" + s.cat.items.length;
      });
    });
    ;function esc(e) { if (e.key === "Escape") close(); }
    ;function close() { ov.remove(); document.removeEventListener("keydown", esc); }
    document.addEventListener("keydown", esc);
    box.append(head, sub, search, topRand, list);
    ov.appendChild(box);
    document.body.appendChild(ov);
  }
  window.dragonPremadePanel = dragonPremadePanel;


  ;function mkBtnFB(label, title, style, fn) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    if (title) b.title = title;
    b.style.cssText = style;
    b.onclick = function (e) { e && e.stopPropagation(); try { fn(); } catch (err) { toast("Oops \u2014 try again"); } };
    return b;
  }
  var FB_BTN = "font-size:.7rem; padding:.26rem .55rem; border-radius:999px; cursor:pointer;";
  // 📋 Panel Style — moved here from Options (Egon 11.09.2026).
  // 11.09.2026 (Egon): converted from a cycling button into a DROPDOWN menu WITH short
  // descriptions, exactly like 📷 Shot / 📐 Angle / 🧍 Pose. Clicking a row picks that version.
  var _PSTYLE = ["v1", "v2", "v3", "v4"]; // Egon 13.09.2026 — V5 REMOVED (PARKED).
  var _PSTYLE_INFO = {
    v1: { name: "V1 \u2014 Classic", desc: "The original step-by-step wizard. Simple and familiar, everything in one column." },
    v2: { name: "V2 \u2014 Compact", desc: "Dense ribbon rows per category. Best for quickly scanning many options." },
    v3: { name: "V3 \u2014 Sections", desc: "Grouped sections with clear headers. Balanced and easy to read." },
    v4: { name: "V4 \u2014 Progressive", desc: "Each choice unlocks the next step. Guided, tidy and less overwhelming." }
    // v5: { name: "V5 — Experimental" } — REMOVED (Egon 13.09.2026, PARKED).
  };
  window.__dragonSyncPanelStyleBtn = function () {
    (window.__dragonPanelStyleSyncs || []).forEach(function (f) { try { f(); } catch (e) {} });
  };
  ;function _pstyleEsc(s) { return String(s == null ? "" : s).replace(/[&<>]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]; }); }
  var _panelStyleMenu = null, _panelStyleMenuBtn = null;
  ;function _panelStylePlace() {
    if (!_panelStyleMenu || !_panelStyleMenuBtn) return;
    var r = _panelStyleMenuBtn.getBoundingClientRect();
    _panelStyleMenu.style.left = Math.max(4, Math.min(r.left, window.innerWidth - _panelStyleMenu.offsetWidth - 8)) + "px";
    _panelStyleMenu.style.top = (r.bottom + 4) + "px";
  }
  // Egon 14.09.2026 — open menu should not persist when the page changes.
  window.dragonClosePanelStyleMenu = function () {
    if (_panelStyleMenu) _panelStyleMenu.style.display = "none";
  };
  ;function _panelStyleBuildMenu() {
    if (_panelStyleMenu) return _panelStyleMenu;
    var menu = document.createElement("div");
    menu.className = "dragon-pstyle-menu";
    menu.style.cssText = "display:none; position:fixed; z-index:99999; min-width:16rem; max-width:min(20rem,92vw); max-height:min(60vh,24rem); overflow-y:auto; padding:.3rem; border:1px solid #9b6bff; border-radius:10px; background:#1a1226; box-shadow:0 6px 20px rgba(0,0,0,.6);";
    _PSTYLE.forEach(function (v) {
      var info = _PSTYLE_INFO[v] || { name: v.toUpperCase(), desc: "" };
      var it = document.createElement("button");
      it.type = "button";
      it.dataset.val = v;
      it.style.cssText = "display:block; width:100%; text-align:left; padding:.4rem .6rem; font-size:.78rem; color:#c9a8ff; background:transparent; border:0; border-radius:6px; cursor:pointer;";
      it.innerHTML = "<div style='font-weight:bold; color:#d6c6ff;'>" + _pstyleEsc(info.name) + "</div><div style='font-size:.7rem; opacity:.8; margin-top:.1rem; white-space:normal;'>" + _pstyleEsc(info.desc) + "</div>";
      it.onmouseenter = function () { it.style.background = "rgba(155,107,255,.16)"; };
      it.onmouseleave = function () { it.style.background = it.classList.contains("dragon-pstyle-sel") ? "rgba(155,107,255,.26)" : "transparent"; };
      it.onclick = function (e) {
        e.stopPropagation();
        menu.style.display = "none";
        if (window.dragonSetMenuStyle) window.dragonSetMenuStyle(v);
        (window.__dragonPanelStyleSyncs || []).forEach(function (f) { try { f(); } catch (er) {} });
        if (typeof toast === "function") toast("\uD83D\uDCCB panel style: " + v.toUpperCase());
      };
      menu.appendChild(it);
    });
    document.body.appendChild(menu);
    document.addEventListener("click", function (e) {
      if (menu.style.display !== "none" && !menu.contains(e.target) && !(e.target && e.target.classList && e.target.classList.contains("dragon-pstyle-cycle"))) menu.style.display = "none";
    });
    window.addEventListener("scroll", function () { if (menu.style.display !== "none") _panelStylePlace(); }, { passive: true });
    window.addEventListener("resize", function () { if (menu.style.display !== "none") _panelStylePlace(); });
    _panelStyleMenu = menu;
    return menu;
  }
  // Egon 15.09.2026 — 🏥 Premade Characters are no longer in the quick bar: the CC panel-style dropdown's
  // It stays ABOVE, as its own DROPDOWN MENU (not a new window/modal).
  var _premadeMenu = null, _premadeMenuBtn = null;
  var _premadeOutside = null;
  ;function _premadePlace() {
    if (!_premadeMenu || !_premadeMenuBtn) return;
    var r = _premadeMenuBtn.getBoundingClientRect();
    // Egon 14.09.2026 — menu is now the SAME WIDTH AS THE ACTIVE CC PANEL and opens aligned to the left
    // (full layout, like V1). If the panel is not found, it falls back to button width.
    var wrap = (typeof activeCharWrapVis === "function") ? activeCharWrapVis() : null;
    var baseRect = wrap ? wrap.getBoundingClientRect() : r;
    // Egon 15.09.2026 — security: if the measurement is 0 while the active CC panel is closed, the menu used to collapse to 0/20px and
    // wrap 700 chips into a single column (unusable state). Now it's at least 320px; menu never opens with 0 width.
    var avail = Math.max(220, window.innerWidth - 8);
    var w = Math.min(Math.max(baseRect.width || r.width || 0, 320), avail);
    _premadeMenu.style.width = w + "px";
    var left = baseRect.left + (baseRect.width ? 0 : (r.width - w) / 2);
    left = Math.max(4, Math.min(left, window.innerWidth - w - 4));
    _premadeMenu.style.left = (left + window.scrollX) + "px";
    // Egon 12.09.2026 — panel is now position:absolute (document coordinate) → panel also scrolls when the page is scrolled.
    _premadeMenu.style.top = (r.bottom + window.scrollY + 2) + "px";
  }
  // Egon 14.09.2026 — open menu should not remain when the page changes (e.g., going to Toolbox).
  window.dragonClosePremadeMenu = function () {
    if (_premadeMenu) _premadeMenu.style.display = "none";
  };
  ;function _premadeBuildMenu() {
    if (_premadeMenu) return _premadeMenu;
    var menu = document.createElement("div");
    menu.className = "dragon-premade-menu";
    // Egon 12.09.2026 — Panel now opens full height WITHOUT an INTERNAL SCROLLBAR (like the CC panel):
    // position:absolute + full height instead of position:fixed + max-height + overflow-y.
    // General page scrolling also scrolls the panel; no internal handle.
    // Egon 12.09.2026 — PC (Premade Characters) panel now stays BELOW the navbar (z 99980 < navbar 99990):
    // when scrolling down the page, it slides UNDER the navbar like the CC panel (previously it was going ABOVE the navbar).
    // Panel content/function hasn't changed, only the layer order.
    menu.style.cssText = "display:none; position:absolute; z-index:99980; width:min(992px,96vw); padding:.55rem; border:1px solid #d4af37; border-radius:14px; background:#1a1626; box-shadow:0 12px 40px rgba(0,0,0,.72); box-sizing:border-box;";
    var searchWrap = document.createElement("div");
    searchWrap.style.cssText = "position:relative; margin:0 0 .4rem;";
    var search = document.createElement("input");
    search.type = "text"; search.placeholder = "\uD83D\uDD0D Search premade\u2026";
    search.style.cssText = "width:100%; box-sizing:border-box; margin:0; padding:.4rem 2rem .4rem .55rem; border-radius:8px; border:1px solid #6a5a9a; background:#120f1b; color:#e8e8f0; font-size:.78rem;";
    // Egon 15.09.2026 — red ✖ clear button INSIDE RIGHT of search box (deletes text + resets filter).
    var searchClear = document.createElement("button");
    searchClear.type = "button"; searchClear.textContent = "\u2716"; searchClear.title = "Clear search";
    // Egon 15.09.2026 — I59 JUMPING FIX: when centering was done with `transform:translateY(-50%)`, the global
    // `button:active:not(:disabled){transform:none !important}` rule removed the translate during the press →
    // the button would drop DOWN by half its height and jump back ("red ✖ jumps"). Now there is NO transform:
    // vertical centering is done with `margin-top:-.65rem` (half height); no :active rule affects it.
    searchClear.style.cssText = "position:absolute; right:5px; top:50%; margin-top:-.65rem; width:1.3rem; height:1.3rem; box-sizing:border-box; min-width:0; padding:0; display:inline-flex; align-items:center; justify-content:center; border-radius:50%; border:1px solid #e0244c; background:linear-gradient(180deg,#3a1010,#1c0808); color:#ff6b7d; font-size:.72rem; line-height:1; cursor:pointer; box-shadow:0 1px 4px rgba(0,0,0,.5);";
    searchClear.onclick = function (e) {
      e.stopPropagation();
      search.value = "";
      search.dispatchEvent(new Event("input", { bubbles: true }));
      try { search.focus(); } catch (er) {}
    };
    searchWrap.append(search, searchClear);
    menu.appendChild(searchWrap);
    // Egon 15.09.2026 — the old full-width "🎲 Random Character — from any category" bar is GONE.
    // It is now a compact 🎲 sitting between "Generate selected" and "✖" (same size as ✖), and every
    // category header gets its own identical 🎲 that rolls a random character FROM THAT CATEGORY.
    // (built further down, inside the selection bar / section loop).
    // Egon 12.09.2026 — CHIP CLICK = SELECTION (checkbox REMOVED). Select multiple premade characters,
    // Generate in ORDER with the FLOATING "Generate selected" below. The checkboxes were visual clutter, so they're gone.
    var selSet = {}, chipByName = {}, allChips = [];
    ;function syncChip(el, on) {
      if (!el) return;
      el.dataset.on = on ? "1" : "0";
      el.style.borderColor = on ? "#22c55e" : "#6a5a9a";
      el.style.background = on ? "linear-gradient(145deg,#14532d,#052e16)" : "linear-gradient(145deg,#241c3a,#16121f)";
      var sp = el.firstElementChild; if (sp) sp.style.color = on ? "#bbf7d0" : "#d8c9ff";
    }
    var selBar = document.createElement("div");
    // Egon 12.09.2026 — FLOATING (top): Generate bar is now RIGHT NEXT TO the Random Character button
    // stays BELOW (at the very top of the menu) and as the page scrolls `position:sticky; top:navbar`
    // stays pinned to the top of the screen — even if the user scrolls down, they go up to reach Generate
    // has to scroll away. Clear All ✖ is also inside the same floating bar.
    // Egon 15.09.2026 — this bar now has the same appearance as the ACTION BAR in the CC panel
    // (dark purple background + red border; 🎲 amber, ✨ Generate red, 🧹 Clear All red).
    selBar.style.cssText = "position:sticky; top:calc(var(--dragon-nav-h,42px) + 2px); z-index:5; margin:.1rem 0 .5rem; padding:.42rem .4rem; background:linear-gradient(180deg,rgba(22,14,30,.97),rgba(22,14,30,.9)); border:1px solid rgba(194,51,63,.45); border-radius:10px; box-shadow:0 6px 18px rgba(0,0,0,.45);";
    var selRow = document.createElement("div");
    selRow.className = "dragon-premade-selrow";
    selRow.style.cssText = "display:flex; flex-wrap:wrap; gap:.35rem; justify-content:center; align-items:stretch;";
    var genSel = document.createElement("button");
    genSel.type = "button";
    // Egon 15.09.2026 — PREMADE "Generate" button is now YELLOW (CC panel geometry is exactly: same
    // padding/radius/font/box-shadow) — only color is yellow. The amber next to it should be distinct from 🎲 All Random
    // a saturated gold tone is used (dark olive amber vs. bright gold).
    genSel.style.cssText = "flex:1 1 auto; max-width:420px; padding:.5rem .9rem; border:1px solid #ffe680; background:linear-gradient(180deg,#c9a227,#7a6212); color:#fff8d6; border-radius:10px; cursor:pointer; font-weight:800; font-size:.82rem; line-height:1; opacity:.5; box-shadow:0 4px 14px rgba(0,0,0,.5);";
    var clearSel = document.createElement("button");
    clearSel.type = "button"; clearSel.textContent = "\uD83E\uDDF9 Clear All";
    clearSel.title = "Clear selection";
    // Egon 15.09.2026 — look is IDENTICAL to the 🧹 Clear All button in the CC panel (function is DIFFERENT:
    // this only clears the premade selection).
    clearSel.style.cssText = "flex:0 0 auto; padding:.5rem .7rem; border:1px solid #c81e2e; background:linear-gradient(180deg,#3a1010,#1c0808); color:#ffb3b3; border-radius:10px; cursor:pointer; font-weight:800; font-size:.76rem; line-height:1;";
    // Egon 15.09.2026 — compact 🎲 (same look/size as ✖). Rolls a random character (any category)
    // and immediately generates it — identical flow to the old full-width button.
    ;function _premadeRandomGo(pick) {
      if (!pick) return;
      Object.keys(selSet).forEach(function (k) { delete selSet[k]; });
      allChips.forEach(function (el) { syncChip(el, false); });
      selSet[pick.it[0]] = pick;
      var el = chipByName[pick.it[0]];
      if (el) { syncChip(el, true); }
      updateSel();
      startSelected();
    }
    ;function _premadeRandomAny() {
      // Egon 15.09.2026 — "All Random" now selects **3** premade characters instead of 1 (active search
      // respects the filter) and produces the selected ones IN ORDER. Category 🎲's continue to select 1.
      var q = (search.value || "").trim().toLowerCase();
      var all = [];
      PREMADE.forEach(function (cat) {
        (cat.items || []).forEach(function (it) {
          if (!q || it[0].toLowerCase().indexOf(q) !== -1) all.push({ cat: cat, it: it });
        });
      });
      if (!all.length) PREMADE.forEach(function (cat) { (cat.items || []).forEach(function (it) { all.push({ cat: cat, it: it }); }); });
      if (!all.length) return;
      var n = Math.min(3, all.length);
      var pool = all.slice(), picks = [];
      for (var i = 0; i < n; i++) {
        var j = Math.floor(Math.random() * pool.length);
        picks.push(pool[j]); pool.splice(j, 1);
      }
      Object.keys(selSet).forEach(function (k) { delete selSet[k]; });
      allChips.forEach(function (el) { syncChip(el, false); });
      picks.forEach(function (p) {
        selSet[p.it[0]] = p;
        var el = chipByName[p.it[0]];
        if (el) syncChip(el, true);
      });
      updateSel();
      startSelected();
    }
    // Egon 15.09.2026 — per-category 🎲: picks from that category only (respects the active search
    // filter so it rolls among the visible results). Same look as the other dice.
    ;function _premadeRandomCat(cat) {
      var its = (cat && cat.items) ? cat.items : [];
      var q = (search.value || "").trim().toLowerCase();
      var vis = its.filter(function (it) { return !q || it[0].toLowerCase().indexOf(q) !== -1; });
      var pool = vis.length ? vis : its;
      if (!pool.length) return;
      _premadeRandomGo({ cat: cat, it: pool[Math.floor(Math.random() * pool.length)] });
    }
    // Egon 15.09.2026 — 🎲 buttons have the same appearance as the amber "All Random" on the CC action bar.
    var _diceCss = "flex:0 0 auto; padding:.5rem .7rem; border:1px solid #ffd76a; background:linear-gradient(180deg,#4a3a1a,#2a2416); color:#ffe9a8; border-radius:10px; cursor:pointer; font-weight:800; font-size:.76rem; line-height:1;";
    var diceSel = document.createElement("button");
    diceSel.type = "button"; diceSel.textContent = "\uD83C\uDFB2 All Random";
    diceSel.title = "Random Character \u2014 picks 3 from any category and generates them";
    diceSel.style.cssText = _diceCss;
    diceSel.onclick = function (e) { e.stopPropagation(); _premadeRandomAny(); };
    // Egon 15.09.2026 — ROW: 🎲 All Random (LEFT) · ✨ Generate (MIDDLE) · 🧹 Clear All (RIGHT) — Same as CC panel.
    selRow.append(diceSel, genSel, clearSel);
    // Egon 12.09.2026 — multi-select note BELOW the button.
    var selNote = document.createElement("div");
    selNote.textContent = "You can select multiple premade characters! Then press the Generate button!";
    selNote.style.cssText = "font-size:.7rem; color:#ffe9a8; text-align:center; margin-top:.32rem; opacity:.95;";
    selBar.append(selRow, selNote);
    ;function updateSel() {
      var n = Object.keys(selSet).length;
      genSel.textContent = "\u2728 Generate selected (" + n + ")";
      genSel.style.opacity = n ? "1" : ".5";
    }
    updateSel();
    clearSel.onclick = function (e) {
      e.stopPropagation(); selSet = {}; updateSel();
      allChips.forEach(function (el) { syncChip(el, false); });
    };
    // Egon 12.09.2026 — both "Generate selected" and "Random Character" use this common flow:
    // CLOSE the menu + active character panel, generate the selection IN PARALLEL (dragonSeqGenerate) and show the generation
    // area.
    ;function startSelected() {
      var names = Object.keys(selSet);
      if (!names.length) { if (typeof toast === "function") toast("select one or more characters first"); return; }
      var list = names.map(function (n) {
        var rec = selSet[n];
        var prompt = (rec.it.length > 2 && rec.it[2]) ? rec.it[2] : premadePrompt(rec.it[1]);
        return { prompt: prompt, negative: "", label: rec.cat.e + " " + rec.it[0], noCaption: true };
      });
      menu.style.display = "none";
      if (window.dragonClosePremadeMenu) { try { window.dragonClosePremadeMenu(); } catch (er) {} }
      // Egon request — "close panels and show the generation part".
      if (window.__dragonCollapseActiveCharPanel) { try { window.__dragonCollapseActiveCharPanel(); } catch (er) {} }
      try { var _pph = document.querySelector(".dragon-placeholder"); if (_pph) _pph.remove(); } catch (erP) {}
      if (window.dragonSeqGenerate) {
        if (typeof toast === "function") toast("\uD83C\uDFE5 generating " + list.length + " character" + (list.length === 1 ? "" : "s") + " \u2014 starting together\u2026");
        try {
          var _mon = (window.dragonMonitorEnsure ? window.dragonMonitorEnsure() : null) || document.getElementById("dragonProcessPanel") || document.getElementById("outputAreaEl");
          if (_mon && _mon.isConnected) {
            var _navH = 42;
            try { _navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--dragon-nav-h")) || 42; } catch (eNH) {}
            var _y = _mon.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop || 0) - _navH - 4;
            window.scrollTo({ top: Math.max(0, _y), behavior: "auto" });
          }
        } catch (eS1) {}
        window.dragonSeqGenerate(list, { seed: null, parallel: true, precreate: true, onProgress: function (i, t) { if (typeof toast === "function") toast("\uD83C\uDFE5 " + i + "/" + t + " done"); }, onDone: function (c) { if (typeof toast === "function") toast("\u2705 done \u2014 " + c + " character" + (c === 1 ? "" : "s")); } });
      } else if (typeof toast === "function") toast("generator not ready yet");
    }
    genSel.onclick = function (e) {
      e.stopPropagation();
      startSelected();
    };
    var secs = [];
    PREMADE.forEach(function (cat) {
      var sec = document.createElement("div"); sec.style.cssText = "margin-bottom:.5rem;";
      var headRow = document.createElement("div");
      headRow.style.cssText = "display:flex; align-items:center; justify-content:center; gap:.4rem; margin:.15rem 0 .3rem;";
      var h = document.createElement("div");
      h.textContent = cat.e + " " + cat.n + " \u2014 " + cat.items.length;
      h.style.cssText = "font-size:.74rem; font-weight:bold; color:#ffd76a;";
      // Egon 15.09.2026 — per-category 🎲 (same look as the main dice) beside every header.
      var catDice = document.createElement("button");
      catDice.type = "button"; catDice.textContent = "\uD83C\uDFB2";
      catDice.title = "Random from " + cat.n + " \u2014 generate";
      catDice.style.cssText = _diceCss;
      catDice.onclick = (function (c) { return function (e) { e.stopPropagation(); _premadeRandomCat(c); }; })(cat);
      headRow.append(h, catDice);
      var row = document.createElement("div"); row.style.cssText = "display:flex; flex-wrap:wrap; gap:.3rem; justify-content:center;";
      var chips = [];
      cat.items.slice().sort(function (a, b) { return a[0].localeCompare(b[0]); }).forEach(function (it) {
        var wrapc = document.createElement("span");
        wrapc.dataset.q = it[0].toLowerCase();
        wrapc.dataset.pmName = it[0];
        wrapc.style.cssText = "display:inline-flex; align-items:center; padding:.2rem .6rem; border:1px solid #6a5a9a; background:linear-gradient(145deg,#241c3a,#16121f); border-radius:999px; cursor:pointer; transition:border-color .12s, background .12s;";
        var b = document.createElement("span");
        b.textContent = cat.e + " " + it[0];
        b.title = it[0] + " \u2014 click to select/deselect. Select several, then press Generate.";
        b.style.cssText = "font-size:.72rem; color:#d8c9ff; pointer-events:none;";
        wrapc.onclick = function (e) {
          e.stopPropagation();
          if (selSet[it[0]]) delete selSet[it[0]]; else selSet[it[0]] = { cat: cat, it: it };
          syncChip(wrapc, !!selSet[it[0]]);
          updateSel();
        };
        wrapc.append(b);
        chipByName[it[0]] = wrapc; allChips.push(wrapc);
        chips.push(wrapc); row.appendChild(wrapc);
      });
      sec.append(headRow, row); menu.appendChild(sec);
      secs.push({ sec: sec, chips: chips, head: h, cat: cat });
    });
    search.addEventListener("input", function () {
      var q = search.value.trim().toLowerCase();
      secs.forEach(function (s) {
        var vis = 0;
        s.chips.forEach(function (c) { var show = !q || c.dataset.q.indexOf(q) !== -1; c.style.display = show ? "" : "none"; if (show) vis++; });
        s.sec.style.display = vis ? "" : "none";
        s.head.textContent = s.cat.e + " " + s.cat.n + " \u2014 " + vis + "/" + s.cat.items.length;
      });
    });
    // Egon 12.09.2026 — Floating sel bar is now added to the VERY BEGINNING of the menu (right under search)
    // (stays hanging at the top of the screen with sticky top).
    // Egon 15.09.2026 — it used to be added after the "rnd" button; that button was removed → after search.
    if (searchWrap.nextSibling) menu.insertBefore(selBar, searchWrap.nextSibling); else menu.appendChild(selBar);
    document.body.appendChild(menu);
    document.addEventListener("click", function (e) {
      if (menu.style.display !== "none" && !menu.contains(e.target) && !(e.target && e.target.classList && e.target.classList.contains("dragon-premade-cycle"))) menu.style.display = "none";
    });
    // Egon 12.09.2026 — Since the Panel now scrolls with the page flow, there is NO repositioning on scroll.
    // (Old behavior is in STORAGE.) Only realign when the window size changes.
    // window.addEventListener("scroll", function () { if (menu.style.display !== "none") _premadePlace(); }, { passive: true });
    window.addEventListener("resize", function () { if (menu.style.display !== "none") _premadePlace(); });
    _premadeMenu = menu;
    return menu;
  }
  ;function mkPremadeBtn() {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dragon-premade-cycle";
    // Egon 14.09.2026 — yellow glow REMOVED; button will stand aligned/adjacent to the CC panel header.
    btn.style.cssText = "display:block; width:100%; box-sizing:border-box; padding:.5rem .7rem; font-size:.9rem; font-weight:800; letter-spacing:.02em; border-radius:8px; cursor:pointer; border:1px solid #d4af37; background:linear-gradient(180deg,#5a4620,#2a2416); color:#ffe9a8; box-shadow:0 2px 8px rgba(0,0,0,.4);";
    btn.textContent = "\uD83C\uDFE5 Premade Characters";
    btn.title = "Premade characters \u2014 pick one to load (dropdown)";
    btn.onclick = function (e) {
      e.stopPropagation();
      var menu = _premadeBuildMenu();
      if (menu.style.display !== "none" && _premadeMenuBtn === btn) { menu.style.display = "none"; return; }
      // Egon 14.09.2026 — when premade panel opens, the character creation panel CLOSES (one is closed while the other is open).
      if (window.__dragonCollapseActiveCharPanel) { try { window.__dragonCollapseActiveCharPanel(); } catch (er) {} }
      _premadeMenuBtn = btn;
      _premadePlace();
      menu.style.display = "block";
    };
    return btn;
  }
  ;function mkPanelStyleBtn() {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dragon-pstyle-cycle";
    btn.style.cssText = "border:1px solid #9b6bff; background:linear-gradient(180deg,#2a1a4a,#1a102e); color:#c9a8ff; font-weight:bold;" + FB_BTN;
    ;function cur() { try { return (window.dragonMenuStyleGet && window.dragonMenuStyleGet()) || "v1"; } catch (e) { return "v1"; } }
    ;function sync() { btn.textContent = "\uD83D\uDCCB Panel Style: " + cur().toUpperCase(); btn.title = "Character Creation panel style \u2014 click to choose a version"; }
    btn.onclick = function (e) {
      e.stopPropagation();
      var menu = _panelStyleBuildMenu();
      if (menu.style.display !== "none" && _panelStyleMenuBtn === btn) { menu.style.display = "none"; return; }
      _panelStyleMenuBtn = btn;
      for (var i = 0; i < menu.children.length; i++) {
        var it = menu.children[i];
        var on = it.dataset.val === cur();
        it.classList.toggle("dragon-pstyle-sel", on);
        it.style.background = on ? "rgba(155,107,255,.26)" : "transparent";
      }
      _panelStylePlace();
      menu.style.display = "block";
    };
    (window.__dragonPanelStyleSyncs = window.__dragonPanelStyleSyncs || []).push(sync);
    sync();
    return btn;
  }
  // STORAGE — old cycle button version (converted to dropdown on Egon 11.09.2026):
  //   btn.onclick = function (e) { e.stopPropagation(); var c = cur(), i = _PSTYLE.indexOf(c);
  //     var next = _PSTYLE[(i + 1) % _PSTYLE.length];
  //     if (window.dragonSetMenuStyle) window.dragonSetMenuStyle(next);
  //     (window.__dragonPanelStyleSyncs || []).forEach(function (f) { try { f(); } catch (er) {} });
  //     if (typeof toast === "function") toast("\uD83D\uDCCB panel style: " + next.toUpperCase()); };
  ;function installCommonBar(wrap) {
    if (!wrap || !wrap.querySelector) return;
    if (wrap.querySelector(".dragon-fb-bar")) return;
    var body = wrap.querySelector(".dragon-char-body, .dragon-char-body2, .dragon-char-body3, .dragon-char-body4, .dragon-char-body5");
    if (!body) return;
    var bar = document.createElement("div");
    bar.className = "dragon-fb-bar";
    bar.style.cssText = "width:100%; display:flex; flex-wrap:wrap; gap:.3rem; align-items:center; justify-content:center; padding:.3rem; margin-bottom:.2rem; border:1px solid rgba(107,91,255,.55); border-radius:8px; background:rgba(107,91,255,.08); box-sizing:border-box;";
    // 🧹 Egon 26.09.2026 — "Cp'deki ⚙️ Quick Bar ve ✨ Quick Controls ifadelerini sil." The "⚙️ Quick Bar"
    // caption is REMOVED; the bar's buttons below are untouched.
    // PARKED: var lbl = document.createElement("span"); lbl.textContent = "⚙️ Quick Bar"; bar.appendChild(lbl);
    var FB_BTN2 = "flex:0 0 auto; font-weight:bold;";
    // Egon 15.09.2026 — 🎲 All Random + 🧹 Clear All REMOVED from quick bar: they now stand on either side
    // of the ✨ Generate ⭐ button in the red action bar at the very top of the CC panel
    // (bkz. ensureCCGenBtn → panelAction).
    bar.appendChild(mkBtnFB("\uD83E\uDD16 AI Random", "Randomize with AI \u2014 writes a full character prompt", "border:1px solid #9b6bff; background:linear-gradient(180deg,#2a1a4a,#1a102e); color:#c9a8ff;" + FB_BTN2 + FB_BTN, function () { if (window.dragonAIRandomize) window.dragonAIRandomize("char"); else toast("AI not ready"); }));
    bar.appendChild(mkBtnFB("\u2728 AI Selected", "Randomize selected traits with AI", "border:1px solid #e08a3a; background:linear-gradient(180deg,#3a2210,#1c1006); color:#ffc98a;" + FB_BTN2 + FB_BTN, function () { if (window.dragonAISelected) window.dragonAISelected("char"); else toast("AI not ready"); }));
    // Egon 15.09.2026 — 🏥 Premade Characters ACTUALLY removed from quick bar: it is no longer inside
    // the quick bar, but in its own row JUST ABOVE the quick bar (right-aligned,
    // meaning it stays right above the CC Panel Style button).
    bar.appendChild(mkCuteBtn());
    bar.appendChild(mkShotBtn());
    bar.appendChild(mkAngleBtn());
    bar.appendChild(mkPoseBtn());
    bar.appendChild(mkPanelStyleBtn());
    // Egon 15.09.2026 — 🧹 Clear All was removed from here (now in the action bar above).
    body.insertBefore(bar, body.firstChild);
    // Egon 10.09.2026 — Premade Characters button is now OUTSIDE the CC PANEL, RIGHT ABOVE the panel
    // as a large bar that opens downwards (see placePremadeOutside).
    // Old in-panel version is in the DEPOT:
    //   var premadeStack = document.createElement("div");
    //   premadeStack.className = "dragon-premade-stack";
    //   premadeStack.style.cssText = "width:100%; display:flex; justify-content:flex-end; margin-bottom:.2rem;";
    //   premadeStack.appendChild(mkPremadeBtn());
    //   body.insertBefore(premadeStack, bar);
    if (window.dragonPlacePremadeOutside) window.dragonPlacePremadeOutside();
  }
  ;function activeCharWrapVis() {
    var container = document.getElementById("userInputsCtn8462746262");
    if (!container) return null;
    var kids = container.children;
    for (var i = 0; i < kids.length; i++) {
      var el = kids[i];
      if (!el.className || String(el.className).indexOf("dragon-char-wrap") === -1) continue;
      if (getComputedStyle(el).display !== "none") return el;
    }
    return null;
  }
  // Egon 19.09.2026 — 🏥 PREMADE + 💃 CC PANEL MUST ARRIVE TOGETHER (fix for the "panel appears, then
  // the premade bar pops in and pushes it down" jump, worst on mobile). The old version waited until a
  // character panel became VISIBLE (150ms retry loop) and only then inserted itself above it — so the CC
  // panel always rendered first and the premade bar slid in a moment later, shifting everything. Now the
  // premade bar is created and parked as the FIRST child of the character container immediately, and its
  // visibility is decided by the PAGE (visible exactly on Character Creation), so both come up in one
  // paint, premade COLLAPSED and the CC panel OPEN, and the layout never moves afterwards.
  ;function placePremadeOutside() {
    var container = document.getElementById("userInputsCtn8462746262");
    if (!container) return;
    if (!_premadeOutside) {
      _premadeOutside = document.createElement("div");
      _premadeOutside.className = "dragon-premade-stack";
      _premadeOutside.style.cssText = "width:100%; box-sizing:border-box; margin:0;";
      _premadeOutside.appendChild(mkPremadeBtn());
    }
    var onCharPage = (window.dragonPage === "character") || !!activeCharWrapVis();
    var wantVisible = !!onCharPage;
    _premadeOutside.style.display = wantVisible ? "" : "none";
    if (_premadeOutside.parentElement !== container || container.firstElementChild !== _premadeOutside) {
      container.insertBefore(_premadeOutside, container.firstElementChild);
    }
  }
  window.dragonPlacePremadeOutside = placePremadeOutside;
  // Egon 15.09.2026 — Cuteness is now a REAL trait block inside every CC panel (v1–v5), built to look
  // like that panel's own category sections: collapsible chip section in v1, dropdown row in v2,
  // counted section in v3, a step in v4/v5. Every chip/select writes the hidden
  // select[data-name="cuteness"] through dragonSetMain and a registered mirror keeps it in two-way
  // sync with the pink quick-bar button. The old bottom chip row is gone.
  ;function dragonCuteSet(val) {
    try { if (dragonSetMain("cuteness", val)) toast("\uD83E\uDD70 Cuteness: " + cuteDisplay(val)); } catch (e) {}
    dragonSyncMirror("cuteness");
  }
  ;function dragonMakeCuteSection(wrap) {
    var cn = (wrap && wrap.className) || "";
    var isV2 = cn.indexOf("wrap2") !== -1;
    var isV3 = cn.indexOf("wrap3") !== -1;
    var isV4 = cn.indexOf("wrap4") !== -1 || cn.indexOf("wrap5") !== -1;
    var chipOffCss = "font-size:.75rem; padding:.2rem .55rem; border:1px solid #ff6fa8; background:rgba(255,111,168,.10); color:#ffd0e2; border-radius:14px; cursor:pointer;";
    var chipOnCss = "font-size:.75rem; padding:.2rem .55rem; border:1px solid #ff4d94; background:rgba(255,111,168,.34); color:#fff0f7; border-radius:14px; cursor:pointer; box-shadow:inset 0 0 0 1px #ff4d94;";
    var sec, recompute = function () {};
    if (isV2) {
      sec = document.createElement("div");
      sec.className = "dragon-v2-row dragon-cc-cutesec";
      sec.dataset.cat = "cuteness";
      sec.style.cssText = "width:100%; display:flex; align-items:center; gap:.4rem;";
      var l2 = document.createElement("label");
      l2.textContent = "\uD83E\uDD70 Cuteness";
      l2.style.cssText = "flex:0 0 42%; font-size:.75rem; color:#e8e0f0;";
      var s2 = document.createElement("select");
      if (window.dragonStyleSelect) window.dragonStyleSelect(s2);
      s2.className = "dragon-cc-cutesel";
      s2.style.cssText = "flex:1; min-width:0; padding:.2rem; font-size:.78rem; background:#1a1a20; color:#ddd; border:1px solid #5a5a6a; border-radius:6px;";
      CUTE_OPTS.forEach(function (o) { var op = document.createElement("option"); op.value = o; op.textContent = cuteDisplay(o); s2.appendChild(op); });
      s2.onchange = function () { dragonCuteSet(s2.value); };
      var d2 = document.createElement("button");
      d2.type = "button"; d2.textContent = "\uD83C\uDFB2"; d2.title = "Random Cuteness";
      d2.style.cssText = "flex:0 0 auto; width:2rem; padding:.2rem 0; font-size:.78rem; border:1px solid #6a5a2a; background:linear-gradient(180deg,#26262e,#3a3a44); color:#ffd76a; border-radius:6px; cursor:pointer;";
      d2.onclick = function (e) { e.stopPropagation(); dragonCuteSet(CUTE_OPTS[Math.floor(Math.random() * CUTE_OPTS.length)]); };
      var n2 = document.createElement("button");
      n2.type = "button"; n2.textContent = "🚫"; n2.title = "None / Clear Cuteness";
      n2.className = "dragon-none-chip";
      n2.style.cssText = "flex:0 0 auto; width:1.9rem; padding:.2rem 0; font-size:.8rem; border:1px dashed #8a8a9a; background:rgba(255,255,255,.04); color:#b9b9c9; border-radius:6px; cursor:pointer;";
      n2.onclick = function (e) { e.stopPropagation(); dragonCuteSet("Off"); };
      sec.append(l2, s2, d2, n2);
      recompute = function () {
        var cur = currentCute();
        for (var j = 0; j < s2.options.length; j++) { if (s2.options[j].value === cur) { s2.selectedIndex = j; break; } }
      };
      sec.__dragonCuteTint = recompute;
      return sec;
    }
    sec = document.createElement("div");
    sec.dataset.cat = "cuteness";
    sec.className = (isV3 ? "dragon-v3-sec" : (isV4 ? "dragon-v4-step" : "dragon-v1-sec")) + " dragon-cc-cutesec";
    sec.style.cssText = isV4
      ? "width:100%; display:flex; flex-direction:column; gap:.35rem; padding:.45rem; border:1px solid #3a3a48; border-radius:8px; background:rgba(0,0,0,.22); box-sizing:border-box;"
      : (isV3 ? "width:100%;" : "width:100%; margin-top:.25rem;");
    var headRow = document.createElement("div");
    headRow.style.cssText = (isV3 || isV4) ? "width:100%; display:flex; align-items:center; gap:.35rem;" : "width:100%; display:flex; gap:.3rem;";
    var head;
    if (isV4) {
      head = document.createElement("div");
      head.style.cssText = "font-size:.78rem; font-weight:bold; color:#c9a8ff;";
      head.textContent = "\uD83E\uDD70 Cuteness";
    } else if (isV3) {
      head = document.createElement("div");
      head.style.cssText = "flex:1; min-width:0; padding:.28rem .3rem; font-size:.78rem; color:#e8e0f0; display:flex; align-items:center; gap:.35rem; border-bottom:1px solid #3a3a48;";
      head.textContent = "\uD83E\uDD70 Cuteness";
    } else {
      head = document.createElement("button");
      head.type = "button";
      head.className = "dragon-v1-sec-head";
      head.dataset.base = "\uD83E\uDD70 Cuteness";
      head.dataset.open = "0";
      head.style.cssText = "flex:1; min-width:0; padding:.32rem .5rem; font-size:.8rem; border:1px solid #5a5a6a; background:linear-gradient(180deg,#26262e,#3a3a44); color:#e8e0f0; border-radius:8px; cursor:pointer; text-align:left;";
      head.textContent = "\uD83E\uDD70 Cuteness \u25BE";
    }
    var dice = document.createElement("button");
    dice.type = "button"; dice.textContent = "\uD83C\uDFB2"; dice.title = "Random Cuteness";
    dice.style.cssText = isV3
      ? "margin-left:auto; flex:0 0 auto; width:1.7rem; padding:.1rem 0; font-size:.72rem; border:1px solid #6a5a2a; background:linear-gradient(180deg,#26262e,#3a3a44); color:#ffd76a; border-radius:6px; cursor:pointer;"
      : (isV4
        ? "margin-left:auto; flex:0 0 auto; width:1.8rem; padding:.15rem 0; font-size:.74rem; border:1px solid #6a5a2a; background:linear-gradient(180deg,#26262e,#3a3a44); color:#ffd76a; border-radius:6px; cursor:pointer;"
        : "flex:0 0 auto; width:2.1rem; padding:.32rem 0; font-size:.8rem; border:1px solid #5a5a6a; background:linear-gradient(180deg,#26262e,#3a3a44); color:#ffd76a; border-radius:8px; cursor:pointer;");
    dice.onclick = function (e) { e.stopPropagation(); dragonCuteSet(CUTE_OPTS[Math.floor(Math.random() * CUTE_OPTS.length)]); };
    headRow.append(head, dice);
    var chips = document.createElement("div");
    chips.className = "dragon-cc-cutechips";
    chips.style.cssText = "display:flex; flex-wrap:wrap; gap:.35rem;" + (isV4 ? "" : "padding:.4rem .15rem;");
    CUTE_OPTS.forEach(function (o) {
      var c = document.createElement("button");
      c.type = "button";
      c.className = "dragon-cc-cutechip";
      c.dataset.val = o;
      c.textContent = cuteDisplay(o);
      c.title = "Cuteness: " + o;
      c.style.cssText = chipOffCss;
      c.onclick = function (e) { e.stopPropagation(); dragonCuteSet(o); };
      chips.appendChild(c);
    });
    recompute = function () {
      var cur = currentCute();
      var cs = chips.querySelectorAll(".dragon-cc-cutechip");
      for (var i = 0; i < cs.length; i++) cs[i].style.cssText = (cs[i].dataset.val === cur) ? chipOnCss : chipOffCss;
    };
    sec.__dragonCuteTint = recompute;
    if (isV3 || isV4) {
      sec.append(headRow, chips);
    } else {
      chips.style.display = "none";
      head.onclick = function () {
        var open = chips.style.display === "flex";
        chips.style.display = open ? "none" : "flex";
        head.dataset.open = open ? "0" : "1";
        head.textContent = "\uD83E\uDD70 Cuteness " + (open ? "\u25BE" : "\u25B4");
      };
      sec.append(headRow, chips);
    }
    return sec;
  }
  ;function ensureCCCuteSection(wrap) {
    if (!wrap || !wrap.querySelector) return;
    var body = wrap.querySelector(".dragon-char-body, .dragon-char-body2, .dragon-char-body3, .dragon-char-body4, .dragon-char-body5");
    if (!body) return;
    var oldRow = body.querySelector(".dragon-cc-cuterow");
    if (oldRow && oldRow.parentNode) oldRow.parentNode.removeChild(oldRow);
    var sec = body.querySelector(".dragon-cc-cutesec");
    if (!sec) {
      sec = dragonMakeCuteSection(wrap);
      body.appendChild(sec);
    } else if (body.lastElementChild !== sec) {
      try { body.appendChild(sec); } catch (e) {}
    }
    var tint = sec.__dragonCuteTint;
    if (typeof tint === "function") { try { tint(); } catch (e) {} }
    if (!sec.__dragonCuteMirror) {
      sec.__dragonCuteMirror = { update: function () { try { if (typeof sec.__dragonCuteTint === "function") sec.__dragonCuteTint(); } catch (e) {} } };
      try { dragonRegisterMirror("cuteness", sec.__dragonCuteMirror); } catch (e) {}
    }
  }
  ;function scanCharPanels() {
    var wraps = document.querySelectorAll(".dragon-char-wrap, .dragon-char-wrap2, .dragon-char-wrap3, .dragon-char-wrap4, .dragon-char-wrap5");
    for (var i = 0; i < wraps.length; i++) { installCommonBar(wraps[i]); ensureCCGenBtn(wraps[i]); ensureCCCuteSection(wraps[i]); }
    if (window.dragonPlacePremadeOutside) window.dragonPlacePremadeOutside();
  }
  // Egon 15.09.2026 — "Random All" / "Clear All" distributor based on panel-type (v4/v5 use their own
  // functions, v1-v3 use common dragonRandomScope/dragonClearAllChar).
  ;function panelAction(wrap, action) {
    var cn = (wrap && wrap.className) || "";
    if (cn.indexOf("wrap4") !== -1) {
      if (action === "rnd") { if (window.dragonV4RandomAll) window.dragonV4RandomAll(); }
      else if (window.dragonV4Clear) window.dragonV4Clear();
    } else if (cn.indexOf("wrap5") !== -1) {
      if (action === "rnd") { if (window.dragonV5RandomAll) window.dragonV5RandomAll(); }
      else if (window.dragonV5Clear) window.dragonV5Clear();
    } else {
      if (action === "rnd") { if (window.dragonRandomScope) window.dragonRandomScope("char", true); }
      else if (window.dragonClearAllChar) window.dragonClearAllChar();
      else if (window.dragonClearPanel) window.dragonClearPanel("char");
    }
    // Egon 13.09.2026 — "Clear All" also clears Scene + Design/Overall Theme + Background blocks.
    if (action !== "rnd" && window.dragonClearThemeCats) { try { window.dragonClearThemeCats(true); } catch (e) {} }
  }
  // Egon 15.09.2026 — ✨ Generate button is now AT THE TOP of the panel, just like in the premade panel,
  // inside a sticky action bar: 🎲 All Random · ✨ Generate ⭐ · 🧹 Clear All. The user can generate/randomize/clear
  // without scrolling up while selecting traits.
  ;function ensureCCGenBtn(wrap) {
    if (!wrap || !wrap.querySelector) return;
    var body = wrap.querySelector(".dragon-char-body, .dragon-char-body2, .dragon-char-body3, .dragon-char-body4, .dragon-char-body5");
    if (!body) return;
    var barEl = body.querySelector(".dragon-cc-genbar");
    if (!barEl) {
      barEl = document.createElement("div");
      barEl.className = "dragon-cc-genbar";
      barEl.style.cssText = "position:sticky; top:calc(var(--dragon-nav-h,42px) + 2px); z-index:6; display:flex; flex:0 0 100%; flex-wrap:wrap; gap:.35rem; justify-content:center; align-items:stretch; width:100%; box-sizing:border-box; padding:.42rem .4rem; margin:0 0 .45rem; background:linear-gradient(180deg,rgba(22,14,30,.97),rgba(22,14,30,.9)); border:1px solid rgba(194,51,63,.45); border-radius:10px; box-shadow:0 6px 18px rgba(0,0,0,.45);";
      var FBA = "flex:0 0 auto; padding:.5rem .7rem; border-radius:10px; cursor:pointer; font-weight:800; font-size:.76rem; line-height:1;";
      var rndB = document.createElement("button");
      rndB.type = "button"; rndB.textContent = "\uD83C\uDFB2 All Random"; rndB.title = "Randomize the whole character";
      rndB.style.cssText = FBA + "border:1px solid #ffd76a; background:linear-gradient(180deg,#4a3a1a,#2a2416); color:#ffe9a8;";
      rndB.onclick = function (e) { e.stopPropagation(); panelAction(wrap, "rnd"); };
      var b = document.createElement("button");
      b.type = "button";
      // Egon 15.09.2026 — ⭐ appended on the RIGHT + recolored to the CC-panel red (border #c2333f,
      // gradient #2a0c10→#7d1620, text #ffd4d4). No hover/click size change (I59).
      b.textContent = "\u2728 Generate \u2B50";
      b.title = "Generate an image from your character description";
      b.style.cssText = "flex:1 1 auto; max-width:420px; padding:.5rem .9rem; border:1px solid #c2333f; background:linear-gradient(180deg,#2a0c10,#7d1620); color:#ffd4d4; border-radius:10px; cursor:pointer; font-weight:800; font-size:.82rem; box-shadow:0 4px 14px rgba(0,0,0,.5);";
      b.onclick = function (e) {
        e.stopPropagation();
        try { if (window.dragonClosePremadeMenu) window.dragonClosePremadeMenu(); } catch (e1) {}
        try { if (window.__dragonCollapseActiveCharPanel) window.__dragonCollapseActiveCharPanel(); } catch (e0) {}
        if (window.dragonTriggerGen) window.dragonTriggerGen();
        else { var g = document.getElementById("generateButtonEl"); if (g) g.click(); }
      };
      var clrB = document.createElement("button");
      clrB.type = "button"; clrB.textContent = "\uD83E\uDDF9 Clear All"; clrB.title = "Clear character selections";
      clrB.style.cssText = FBA + "border:1px solid #c81e2e; background:linear-gradient(180deg,#3a1010,#1c0808); color:#ffb3b3;";
      clrB.onclick = function (e) { e.stopPropagation(); panelAction(wrap, "clr"); };
      barEl.append(rndB, b, clrB);
      body.insertBefore(barEl, body.firstChild);
    } else if (body.firstElementChild !== barEl) {
      // The bar should always remain AT THE TOP (even if the content grows later).
      try { body.insertBefore(barEl, body.firstChild); } catch (e) {}
    }
  }
  // Same quick bar, permanently visible on the parent screen right under the description panel,
  // so normal users can enrich their prompt (All Random / AI / Premades / Cuteness / Shot)
  // without ever opening a character panel. The mirror selects keep in sync with the panel bars.
  ;function installParentQuickBar() {
    if (document.querySelector(".dragon-parent-quickbar")) return true;
    var ta0 = document.querySelector('textarea[data-name="description"]');
    var ctn0 = ta0 && ta0.closest(".input-ctn");
    if (!ctn0 || !ctn0.parentElement) return false;
    var bar = document.createElement("div");
    bar.className = "dragon-fb-bar dragon-parent-quickbar";
    bar.style.cssText = "width:100%; display:flex; flex-wrap:wrap; gap:.3rem; align-items:center; justify-content:center; padding:.3rem; margin:.1rem 0 .3rem; border:1px solid rgba(107,91,255,.55); border-radius:8px; background:rgba(107,91,255,.08); box-sizing:border-box;";
    // 🧹 Egon 26.09.2026 — "Cp'deki ⚙️ Quick Bar ve ✨ Quick Controls ifadelerini sil." This is the SECOND
    // "⚙️ Quick Bar" caption (the parent-screen bar); it is removed exactly like the one in the CC panel.
    // PARKED: var lbl = document.createElement("span"); lbl.textContent = "⚙️ Quick Bar"; bar.appendChild(lbl);
    var FB2 = "flex:0 0 auto; font-weight:bold;";
    bar.appendChild(mkBtnFB("\uD83C\uDFB2 All Random", "Randomize the whole character", "border:1px solid #ffd76a; background:linear-gradient(180deg,#4a3a1a,#2a2416); color:#ffe9a8;" + FB2 + FB_BTN, function () { if (window.dragonRandomScope) window.dragonRandomScope("char", true); else toast("panel not ready"); }));
    bar.appendChild(mkBtnFB("\uD83E\uDD16 AI Random", "Randomize with AI \u2014 writes a full character prompt", "border:1px solid #9b6bff; background:linear-gradient(180deg,#2a1a4a,#1a102e); color:#c9a8ff;" + FB2 + FB_BTN, function () { if (window.dragonAIRandomize) window.dragonAIRandomize("char"); else toast("AI not ready"); }));
    bar.appendChild(mkBtnFB("\u2728 AI Selected", "Randomize selected traits with AI", "border:1px solid #e08a3a; background:linear-gradient(180deg,#3a2210,#1c1006); color:#ffc98a;" + FB2 + FB_BTN, function () { if (window.dragonAISelected) window.dragonAISelected("char"); else toast("AI not ready"); }));
    bar.appendChild(mkBtnFB("\uD83E\uDDF9 Clear All", "Clear character selections", "border:1px solid #c81e2e; background:linear-gradient(180deg,#3a1010,#1c0808); color:#ffb3b3;" + FB2 + FB_BTN, function () { if (window.dragonClearAllChar) window.dragonClearAllChar(); else if (window.dragonClearPanel) window.dragonClearPanel("char"); }));
    // Egon 15.09.2026 — Premade Characters was removed from the parent quick bar (it now lives in the CC panel dropdown).
    bar.appendChild(mkCuteBtn());
    bar.appendChild(mkShotBtn());
    bar.appendChild(mkAngleBtn());
    bar.appendChild(mkPoseBtn());
    ctn0.parentElement.insertBefore(bar, ctn0.nextSibling);
    return true;
  }

  ;function bootQuickBars() {
    scanCharPanels();
    installParentQuickBar();
    dragonBodyObserve(function () { scanCharPanels(); installParentQuickBar(); });
  }
  window.__dragonRebuildQuickBars = scanCharPanels;
  window.__dragonInstallParentQuickBar = installParentQuickBar;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootQuickBars);
  else bootQuickBars();
})();
