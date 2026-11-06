// 🐾 Bestaigen Generator Companion (W-FEAT281) — Egon 24.09.2026
// A tiny living creature pinned to the very bottom of the page. It follows the pointer with a
// deliberate LAG (we remember where the pointer was a moment ago and aim for THAT), so it never
// feels glued to the cursor. Kinds: baby dragon (red — breathes fire when the page goes idle),
// cat (chases a ball of yarn), dog (sprints left and right). Purely cosmetic: the layer is
// pointer-events:none, so it can never steal a click.
// Egon 24.09.2026 (second pass): OFF by default · the pointer over a creature freezes it in place
// and plays its OWN happy animation (hearts keep coming) · jumping is an AFK-only behaviour and
// only the cat and the dog have it · AFK also lets them doze off · the dragon's fire shoots
// forward and fades · the cat's yarn is a real wound ball whose loose thread trails BEHIND it.
// Config lives in localStorage:
//   dragonCompanion       "off" | "dragon" | "cat" | "dog"   (default "off")
//   dragonCompanionDelay  follow lag in ms (450 = snappy · 800 = normal · 1300 = laid-back)
//   dragonCompanionLevel  0 = the flat sticker look · 1 = the stylised-realistic pass (default 0)

(function () {
  if (window.__dragonCompanionInstalled) return;
  window.__dragonCompanionInstalled = true;

  var LS_MODE = "dragonCompanion";
  var LS_DELAY = "dragonCompanionDelay";
  var LS_LEVEL = "dragonCompanionLevel";
  var KINDS = ["dragon", "cat", "dog"];
  var KIND_LABEL = { dragon: "\uD83D\uDC09 Baby Dragon", cat: "\uD83D\uDC08 Cat", dog: "\uD83D\uDC15 Dog" };
  // 🐾 Egon 24.09.2026 — the Settings button wears the colour of the creature you picked (the "Off"
  // state keeps the green it has always had). The button keeps its `.dragon-set-special` chrome, so only
  // these three inline props are swapped.
  var KIND_PAL = {
    off:    { bd: "#7ad0a8", bg: "linear-gradient(180deg,#10301f,#08170f)", col: "#c9ffe4", dot: "\u26D4" },
    dragon: { bd: "#e0392a", bg: "linear-gradient(180deg,#3a0f0a,#1a0705)", col: "#ffd7ac", dot: "\uD83D\uDD25" },
    cat:    { bd: "#e8a25a", bg: "linear-gradient(180deg,#3a2a12,#1c1206)", col: "#ffeeda", dot: "\uD83E\uDDE1" },
    dog:    { bd: "#c08a44", bg: "linear-gradient(180deg,#33240f,#171006)", col: "#f4e2c2", dot: "\uD83E\uDDA4" }
  };
  // 🐾 the realism ladder (Egon 24.09.2026): LEVEL 0 is the flat, sticker-like creature that shipped
  // in 2.49.0 — untouched, because he likes it. LEVEL 1 keeps the same geometry and behaviour and paints
  // it properly: volumetric gradients, a fur / scale texture, soft breathing + landing squash and a
  // two-frame walk with real paw lifts and a tail that travels like a whip. LEVELS 2 and 3 (rigged
  // sprite sheets, a real 2D skeleton / tiny 3D model) are parked as worklist entries, not code.
  var LEVEL_NAME = ["Level 0 \u00B7 Sticker", "Level 1 \u00B7 Gradient", "Level 2 \u00B7 Rigged"];
  var LAYER_H = 96;
  var DELAY_PRESETS = [["snappy", 450], ["normal", 800], ["lazy", 1300]];
  var AFK_MS = 3500;

  function say(m) { try { console.warn("dragon-companion: " + m); } catch (e) {} }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  var mode = String(lsGet(LS_MODE, "off"));
  if (mode !== "off" && KINDS.indexOf(mode) === -1) mode = "off";
  var level = parseInt(lsGet(LS_LEVEL, "0"), 10);
  if (!(level >= 0 && level <= 2)) level = 0;   // 0 = Sticker, 1 = Gradient, 2 = Rigged
  var delayMs = parseInt(lsGet(LS_DELAY, "800"), 10);
  if (!(delayMs >= 100 && delayMs <= 3000)) delayMs = 800;

  /* ---------------------------------------------------------------- scene state */
  var layer = null, canvas = null, ctx = null, raf = 0, lastT = 0, running = false;
  var W = 0, H = LAYER_H, dpr = 1;
  var ptr = { x: 0, y: 0, seen: false };
  var trail = [];
  var lastMoveT = 0;
  var st = {
    x: 0, vx: 0, dir: 1, phase: 0, walk: 0,
    jumpY: 0, jumpV: 0, nextHop: 0,
    happy: 0, overSince: 0, fireStart: -99999,
    sleep: 0, act: "wander", nextActT: 0, actUntil: 0
  };
  var yarn = { x: 0, vx: 0, back: -1 };
  var idle = { target: 0, nextT: 0 };

  function ensureLayer() {
    if (layer) return;
    layer = document.createElement("div");
    layer.id = "dragonCompanionLayer";
    layer.style.cssText = "position:fixed; left:0; right:0; bottom:0; height:" + LAYER_H + "px; " +
      "pointer-events:none; z-index:2147482100; overflow:hidden;";
    canvas = document.createElement("canvas");
    canvas.style.cssText = "display:block; width:100%; height:100%;";
    layer.appendChild(canvas);
    (document.body || document.documentElement).appendChild(layer);
    ctx = canvas.getContext("2d");
    resize();
    if (!window.__dragonCompanionResizeHooked) {
      window.__dragonCompanionResizeHooked = true;
      window.addEventListener("resize", function () { if (ctx) resize(); });
    }
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(200, (layer && layer.clientWidth) ? layer.clientWidth : (window.innerWidth || 360));
    H = LAYER_H;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!st.x) { st.x = W * 0.5; yarn.x = W * 0.5 + 40; idle.target = W * 0.5; }
    else { st.x = clamp(st.x, 44, W - 44); yarn.x = clamp(yarn.x, 44, W - 44); }
  }

  /* ---------------------------------------------------------------- pointer */
  function onMove(e) {
    var x = e.clientX, y = e.clientY;
    if (typeof x !== "number") return;
    var now = performance.now();
    ptr.x = x; ptr.y = y; ptr.seen = true;
    lastMoveT = now;
    var last = trail[trail.length - 1];
    if (!last || now - last.t > 40 || Math.abs(last.x - x) > 2) trail.push({ t: now, x: x });
    var cut = now - 5000;
    while (trail.length > 2 && trail[0].t < cut) trail.shift();
  }
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("mousemove", onMove, { passive: true });
  window.addEventListener("touchmove", function (e) { if (e.touches && e.touches[0]) onMove(e.touches[0]); }, { passive: true });

  function delayedX(now) {
    if (!trail.length) return st.x;
    var want = now - delayMs;
    for (var i = trail.length - 1; i >= 0; i--) if (trail[i].t <= want) return trail[i].x;
    return trail[0].x;
  }

  function canJump() { return mode === "cat" || mode === "dog"; }

  /* ---------------------------------------------------------------- update */
  function update(now, dt) {
    var vh = window.innerHeight || H;
    var layerTop = vh - H;
    var afk = !ptr.seen || (now - lastMoveT) > AFK_MS;
    var dxPtr = ptr.seen ? Math.abs(ptr.x - st.x) : 9999;
    var nearBottom = ptr.seen && ptr.y >= layerTop - 8;
    // Egon 24.09.2026 — the pointer ON a creature freezes it where it stands.
    var over = nearBottom && dxPtr < 48;

    /* ---- AFK behaviour: wander · hop (cat/dog) · doze off (all) ---- */
    if (afk) {
      if (st.act === "sleep" && now > st.actUntil) { st.act = "wander"; st.nextActT = now; }
      if (now > st.nextActT) {
        st.nextActT = now + 2200 + Math.random() * 3600;
        if (Math.random() < 0.3) { st.act = "sleep"; st.actUntil = now + 3200 + Math.random() * 3600; }
        else st.act = "wander";
      }
      if (st.act === "wander" && canJump() && now > st.nextHop) {
        st.nextHop = now + 2600 + Math.random() * 3600;
        if (st.jumpY === 0 && st.jumpV === 0) st.jumpV = 330 + Math.random() * 130;
      }
    } else {
      st.act = "wander";
    }
    var sleeping = afk && st.act === "sleep" && !over;
    st.sleep += ((sleeping ? 1 : 0) - st.sleep) * Math.min(1, dt / 320);

    /* ---- where does it WANT to be? ---- */
    var desired;
    if (sleeping) {
      desired = st.x;
    } else if (afk) {
      if (now > idle.nextT) {
        idle.nextT = now + 1300 + Math.random() * 1700;
        idle.target = 70 + Math.random() * Math.max(1, W - 140);
      }
      desired = idle.target;
    } else {
      desired = delayedX(now);
      idle.target = desired;
    }
    desired = clamp(desired, 52, W - 52);

    /* ---- the cat chases the yarn, and the yarn chases the target ---- */
    var goal = desired;
    if (mode === "cat") {
      yarn.vx += (((desired - yarn.x) * 2.6) - yarn.vx) * Math.min(1, dt / 150);
      yarn.x = clamp(yarn.x + yarn.vx * dt / 1000, 52, W - 52);
      if (Math.abs(yarn.vx) > 18) yarn.back = yarn.vx > 0 ? -1 : 1;
      goal = yarn.x;
      if (Math.abs(st.x - yarn.x) < 34) {
        yarn.vx += (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 160);
        // the pounce is a JUMP, so it only ever happens while the page is idle
        if (afk && !sleeping && now > st.nextHop && st.jumpY === 0 && st.jumpV === 0) { st.jumpV = 340; st.nextHop = now + 900; }
      }
    }

    /* ---- movement (frozen while the pointer rests on the creature) ---- */
    var maxSpeed = mode === "dog" ? 430 : (mode === "cat" ? 360 : 300);
    var dx = goal - st.x;
    if (Math.abs(dx) < 3) dx = 0;
    var desiredV = (over || sleeping) ? 0 : clamp(dx * 3.4, -maxSpeed, maxSpeed);
    st.vx += (desiredV - st.vx) * Math.min(1, dt / (over || sleeping ? 90 : 140));
    if (Math.abs(st.vx) < 2) st.vx = 0;
    st.x = clamp(st.x + st.vx * dt / 1000, 44, W - 44);
    if (st.vx > 12) st.dir = 1; else if (st.vx < -12) st.dir = -1;
    var targetWalk = sleeping ? 0 : Math.min(1, Math.abs(st.vx) / 90);
    st.walk += (targetWalk - st.walk) * Math.min(1, dt / 120);
    st.phase += dt / 1000 * (1.8 + st.walk * 7.5);

    /* ---- jump physics (AFK hops only — never on hover) ---- */
    if (st.jumpY > 0 || st.jumpV !== 0) {
      st.jumpV -= 2200 * dt / 1000;
      st.jumpY += st.jumpV * dt / 1000;
      if (st.jumpY <= 0) { st.jumpY = 0; if (st.jumpV < 0) st.jumpV = 0; }
    }

    /* ---- mood: pointer on it => its own happy dance, with a small reaction delay ---- */
    if (over) { if (!st.overSince) st.overSince = now; } else { st.overSince = 0; }
    var wantHappy = over && (now - st.overSince) > 180;
    st.happy += ((wantHappy ? 1 : 0) - st.happy) * Math.min(1, dt / 240);

    /* ---- dragon: breathe fire while the page is idle ---- */
    if (mode === "dragon" && afk && !sleeping && (now - st.fireStart) > 4200 && now > st.nextHop) {
      st.fireStart = now; st.nextHop = now + 600;
    }
  }

  function fireAmt(now) {
    var d = now - st.fireStart;
    if (d < 0 || d > 1150) return 0;
    return Math.sin(Math.PI * (d / 1150));
  }

  /* ---------------------------------------------------------------- drawing helpers */
  function ell(x, y, rx, ry, col, rot) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
    ctx.fill();
  }
  function shadow(w) {
    ctx.fillStyle = "rgba(0,0,0,.26)";
    ctx.beginPath();
    ctx.ellipse(0, 5, w, w * 0.19, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  function heart(x, y, s, a) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = "#ff5a7a";
    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.bezierCurveTo(-6, -3, -3, -9, 0, -5);
    ctx.bezierCurveTo(3, -9, 6, -3, 0, 3);
    ctx.fill();
    ctx.restore();
  }
  function hearts(now, hx, hy, happy) {
    if (happy <= 0.2) return;
    for (var h = 0; h < 3; h++) {
      var ph = (now / 700 + h * 0.7) % 1;
      heart(hx - 5 + h * 9 + Math.sin(now / 260 + h) * 3, hy - 16 - ph * 26, 1.1 * (1 - ph * 0.4) * happy, (1 - ph) * happy);
    }
  }
  function zzz(now, x, y, sl) {
    if (sl <= 0.2) return;
    ctx.save();
    ctx.fillStyle = "rgba(200,225,255," + (0.85 * sl) + ")";
    ctx.font = "bold 12px system-ui, sans-serif";
    for (var i = 0; i < 3; i++) {
      var ph = (now / 1300 + i * 0.34) % 1;
      ctx.globalAlpha = (1 - ph) * sl;
      ctx.fillText("Z", x + i * 7 + Math.sin(now / 500 + i) * 2, y - ph * 22);
    }
    ctx.restore();
  }
  function eyes(now, x, y, blinkSeed, happy, sl, col) {
    var closed = sl > 0.5 || happy > 0.5;
    if (closed) {
      ctx.strokeStyle = col || "#241a12";
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(x - 2, y, 2.2, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 4, y, 2.2, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      return;
    }
    var blink = ((now + blinkSeed) % 4200) < 130 ? 0.14 : 1;
    ell(x, y, 2.7, 2.9 * blink, "#ffffff");
    if (blink > 0.5) ell(x + 1, y, 1.7, 2, col || "#241a12");
    else { ctx.strokeStyle = col || "#241a12"; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(x - 2.4, y); ctx.lineTo(x + 1.6, y); ctx.stroke(); }
  }

  /* ---------------------------------------------------------------- dragon */
  /* ------------------------------------------------ LEVEL 1 — stylised realism */
  var _gradN = 0;
  function hexRgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function rgbaOf(h, a) { var c = hexRgb(h); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
  function mixCol(h1, h2, t) {
    var a = hexRgb(h1), b = hexRgb(h2);
    return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * t) + "," + Math.round(a[1] + (b[1] - a[1]) * t) + "," + Math.round(a[2] + (b[2] - a[2]) * t) + ")";
  }
  function softShadow(w, y) {
    var g = ctx.createRadialGradient(0, y, 1, 0, y, w * 1.3);
    g.addColorStop(0, "rgba(0,0,0,.34)");
    g.addColorStop(0.5, "rgba(0,0,0,.17)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, y, w * 1.3, w * 0.32, 0, 0, Math.PI * 2); ctx.fill();
  }
  // a body part: radial gradient (light from the upper left), a darker rim and a faint bounce light
  function ball(x, y, rx, ry, base, rot, lift) {
    var l = lift == null ? 0.34 : lift;
    var g = ctx.createRadialGradient(x - rx * 0.34, y - ry * 0.44, Math.max(0.5, Math.min(rx, ry) * 0.12), x, y, Math.max(rx, ry) * 1.08);
    g.addColorStop(0, mixCol(base, "#ffffff", l));
    g.addColorStop(0.5, base);
    g.addColorStop(0.85, mixCol(base, "#000000", 0.15));
    g.addColorStop(1, mixCol(base, "#000000", 0.33));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = rgbaOf("#ffffff", 0.13); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, y, rx * 0.88, ry * 0.88, rot || 0, Math.PI * 0.16, Math.PI * 0.84); ctx.stroke();
  }
  function clipEll(x, y, rx, ry, fn) {
    ctx.save();
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
    fn();
    ctx.restore();
  }
  // short strokes clipped to a body ellipse — fur (dir 0) or feathers (dir 1)
  function fur(x, y, rx, ry, dark, light, n, seed, len, dir) {
    clipEll(x, y, rx, ry, function () {
      ctx.lineCap = "round";
      for (var i = 0; i < n; i++) {
        var a = (i * 2.39996 + seed) % (Math.PI * 2);
        var rr = 0.4 + 0.56 * ((i * 0.618 + seed * 0.31) % 1);
        var px = x + Math.cos(a) * rx * rr, py = y + Math.sin(a) * ry * rr;
        var ang = a + (dir || 0) * 0.5 + Math.sin(i * 1.7) * 0.22;
        ctx.strokeStyle = (i % 3 === 0) ? light : dark;
        ctx.globalAlpha = (i % 3 === 0) ? 0.15 : 0.2;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len * 0.7);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
  }
  function scales(x, y, rx, ry, col, rows) {
    clipEll(x, y, rx, ry, function () {
      ctx.strokeStyle = col; ctx.globalAlpha = 0.3; ctx.lineWidth = 0.9;
      var step = (2 * ry) / rows, sw2 = (2 * rx) / 7;
      for (var r = 0; r < rows; r++) {
        var yy = y - ry + (r + 0.62) * step;
        for (var c = 0; c < 8; c++) {
          var xx = x - rx + (c + 0.5) * sw2 + (r % 2 ? sw2 * 0.5 : 0);
          ctx.beginPath();
          ctx.arc(xx, yy, Math.max(1.5, sw2 * 0.44), Math.PI * 1.08, Math.PI * 1.92);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    });
  }
  // a tail that TRAVELS: every segment lags the one before it, so a wave runs down the chain instead of
  // the whole tail swinging as one rigid stick. Returns the last point so the tip can be drawn there.
  function whip(x0, y0, len, ang, phase, wig, wdt, col) {
    var pts = [{ x: x0, y: y0 }], n = 5;
    for (var i = 1; i <= 4; i++) {
      var tt = i / 4;
      var bend = Math.sin(phase - i * 0.7) * wig * tt;
      var a2 = ang + bend * 0.12;
      var prev = pts[i - 1];
      pts.push({ x: prev.x + Math.cos(a2) * len / 4, y: prev.y + Math.sin(a2) * len / 4 + bend * 0.22 });
    }
    ctx.lineCap = "round";
    for (var k = 1; k < pts.length; k++) {
      ctx.strokeStyle = mixCol(col, "#000000", 0.08 + k * 0.05);
      ctx.lineWidth = Math.max(1.5, wdt * (1 - k * 0.16));
      ctx.beginPath();
      ctx.moveTo(pts[k - 1].x, pts[k - 1].y);
      ctx.lineTo(pts[k].x, pts[k].y);
      ctx.stroke();
    }
    var endP = pts[n - 4 + 3], before = pts[n - 4 + 2];
    return { x: endP.x, y: endP.y, a: Math.atan2(endP.y - before.y, endP.x - before.x) };
  }
  function legSeg(x, y, wdt, hgt, base, swing, lift) {
    ball(x + swing * 1.1, y - hgt * 0.5, wdt, hgt * 0.54, base, 0, 0.26);
    ball(x + swing * 2.1, y - lift, wdt * 1.02, wdt * 0.76, mixCol(base, "#000000", 0.08), 0, 0.3);
    ell(x + swing * 2.6, y + wdt * 0.38 - lift, wdt * 0.8, wdt * 0.36, mixCol(base, "#ffffff", 0.16));
  }
  function gaze(x, y, r, iris, dark, closed) {
    if (closed) {
      ctx.strokeStyle = dark; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(x, y, r, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      return;
    }
    ball(x, y, r, r * 1.08, "#ffffff", 0, 0.06);
    ball(x + r * 0.16, y + r * 0.1, r * 0.6, r * 0.66, iris, 0, 0.34);
    ell(x + r * 0.16, y + r * 0.1, r * 0.3, r * 0.5, dark);
    ell(x - r * 0.34, y - r * 0.36, r * 0.26, r * 0.26, "#ffffff", 0, 0.05);
  }
  // the flame is shared by both levels (level 0's block was lifted out verbatim so level 1 can reuse it)
  function fireBreath(now, hx, hy, f) {
    if (!(f > 0.02)) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < 6; i++) {
      var pc = i / 5;
      var dcore = pc * 40 * f;
      var rcore = (7 + pc * 5) * f;
      var acore = f * (1 - pc * 0.55);
      ctx.fillStyle = "rgba(" + (pc < 0.5 ? "255,252,214" : "255,206,96") + "," + acore + ")";
      ctx.beginPath(); ctx.arc(hx + 19 + dcore, hy + 3 + Math.sin(pc * 5 + now / 140) * 3 * pc, rcore, 0, Math.PI * 2); ctx.fill();
    }
    for (var e = 0; e < 9; e++) {
      var seed = e * 0.37;
      var age = ((now / 880) + seed) % 1;
      var dist = 12 + age * (92 + Math.sin(seed * 9) * 18) * f;
      var rr = (5.2 + age * 6) * f * (1 - age) * 1.7;
      if (rr <= 0.25) continue;
      var al = f * (1 - age) * (1 - age) * 0.95;
      var col = age < 0.3 ? "255,236,168" : (age < 0.62 ? "255,168,60" : "255,104,36");
      ctx.fillStyle = "rgba(" + col + "," + al + ")";
      ctx.beginPath();
      ctx.arc(hx + 19 + dist, hy + 3 + Math.sin(age * 5 + seed * 7) * 10 * age, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawDragon(now, happy) {
    if (level >= 2) { drawDragonRigged(now, happy); return; }
    if (level >= 1) { drawDragonRich(now, happy); return; }
    var RED = "#e0392a", RED2 = "#ad2418", BELLY = "#ffd7ac", HORN = "#f6ead0", CLAW = "#fff3da";
    var t = st.phase, walk = st.walk, sl = st.sleep;
    var bob = Math.sin(t * 2) * 2 * walk;
    ctx.save();
    ctx.translate(st.x, H - 8 - st.jumpY + bob + sl * 3);
    ctx.scale(st.dir, 1);
    shadow(24);
    var sw = Math.sin(t * 2) * 6 * walk;
    var tw = Math.sin(t * 1.7) * 7;

    // tail — the spade's POINT faces away from the body (outward)
    ctx.strokeStyle = RED2; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-14, -22); ctx.quadraticCurveTo(-30, -28 + tw, -40, -16 + tw); ctx.stroke();
    ctx.fillStyle = RED2;
    ctx.beginPath(); ctx.moveTo(-53, -17 + tw); ctx.lineTo(-40, -25 + tw); ctx.lineTo(-40, -7 + tw); ctx.closePath(); ctx.fill();

    // back legs
    ell(-9 + sw * 0.9, -7, 4.4, 6.8, RED2);
    ell(10 - sw * 0.9, -7, 4.4, 6.8, RED2);

    // body
    ell(0, -24, 20, 14.5, RED);
    ell(-1, -17, 12.5, 8.5, BELLY);

    // wing — bigger, and it flaps while the creature is happy
    var flap = 1 + happy * Math.sin(now / 105) * 0.3;
    ctx.save();
    ctx.translate(-8, -36);
    ctx.scale(1, flap);
    ctx.translate(8, 36);
    ctx.fillStyle = RED2;
    ctx.beginPath(); ctx.moveTo(-8, -33); ctx.quadraticCurveTo(-38, -66, -3, -52); ctx.quadraticCurveTo(7, -38, -2, -31); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,146,124,.6)";
    ctx.beginPath(); ctx.moveTo(-8, -34); ctx.quadraticCurveTo(-28, -56, -6, -48); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(120,20,12,.55)"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-6, -34); ctx.lineTo(-20, -50); ctx.stroke();
    ctx.restore();

    // front legs + claws
    ell(-8 - sw * 0.9, -7, 4.6, 7, RED);
    ell(11 + sw * 0.9, -7, 4.6, 7, RED);
    ell(-8 - sw * 0.9, -2.5, 5.2, 2.3, CLAW);
    ell(11 + sw * 0.9, -2.5, 5.2, 2.3, CLAW);

    // head
    var hy = -42 + Math.sin(t * 2) * 1 * walk + sl * 4 + happy * Math.sin(now / 190) * 1.4;
    var hx = 16;
    ell(hx, hy, 14.5, 13, RED);
    ell(hx + 10, hy + 3.5, 9.5, 7.2, BELLY);
    ell(hx + 16, hy + 1, 1.5, 1.5, RED2);
    ctx.fillStyle = HORN;
    ctx.beginPath(); ctx.moveTo(hx - 7, hy - 10); ctx.lineTo(hx - 3, hy - 22); ctx.lineTo(hx + 2, hy - 10); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx + 2, hy - 11); ctx.lineTo(hx + 7, hy - 21); ctx.lineTo(hx + 10, hy - 8); ctx.closePath(); ctx.fill();
    ell(hx + 5, hy + 5, 3, 2, "rgba(255,140,120,.55)");
    eyes(now, hx + 6, hy - 3, 700, happy, sl, "#20140f");

    // fire breath — a bright core at the snout plus embers that FLY outward and burn out in mid-air,
    // so the flame reads as travelling away from the mouth instead of hanging there.
    var f = fireAmt(now);
    fireBreath(now, hx, hy, f);
    hearts(now, hx, hy, happy);
    zzz(now, hx - 4, hy - 20, sl * (1 - Math.min(1, f * 2)));
    ctx.restore();
  }

  /* ---------------------------------------------------------------- cat + yarn */
  function drawYarn(now) {
    var yx = yarn.x, yy = H - 15 + Math.sin(now / 220) * 1.2;
    ctx.save();
    ctx.translate(yx, yy);
    ctx.fillStyle = "rgba(0,0,0,.22)";
    ctx.beginPath(); ctx.ellipse(0, 8, 11, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    // the loose end of the thread trails BEHIND the ball, opposite to the way it is rolling
    var bk = yarn.back;
    ctx.strokeStyle = "#e2547c"; ctx.lineWidth = 1.5; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bk * 4, 4);
    ctx.quadraticCurveTo(bk * 14, 9 + Math.sin(now / 260) * 3, bk * 27, 6 + Math.sin(now / 320) * 4);
    ctx.quadraticCurveTo(bk * 33, 4 + Math.sin(now / 210) * 4, bk * 36, 8 + Math.sin(now / 180) * 3);
    ctx.stroke();
    // the wound ball itself — cross-wound strands, so it reads as yarn rather than a glossy marble
    ell(0, 0, 10, 10, "#c9315c");
    ctx.lineWidth = 1.6;
    for (var i = 0; i < 4; i++) {
      ctx.strokeStyle = i % 2 ? "#ff9dba" : "#e2547c";
      ctx.beginPath(); ctx.ellipse(0, 0, 9.6, 9.6, -0.65 + i * 0.56, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.strokeStyle = "#8f1c3e"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0.6, 9.7, -0.5, 1.3); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0.6, 9.7, 2.2, 3.5); ctx.stroke();
    ctx.strokeStyle = "#7d1734"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function drawCat(now, happy) {
    if (level >= 2) { drawCatRigged(now, happy); return; }
    if (level >= 1) { drawCatRich(now, happy); return; }
    var OR = "#e8a25a", OR2 = "#c47f3c", CREAM = "#ffeeda", PINK = "#ff9db4";
    var t = st.phase, walk = st.walk, sl = st.sleep;
    var bob = Math.sin(t * 2) * 1.6 * walk;
    ctx.save();
    ctx.translate(st.x, H - 8 - st.jumpY + bob + sl * 4);
    ctx.scale(st.dir, 1);
    shadow(20);
    var sw = Math.sin(t * 2) * 5.5 * walk;
    // happy: the tail shoots straight up and waves
    var tw = happy > 0.2 ? Math.sin(now / 160) * 7 : Math.sin(t * 1.5) * 9;

    // tail
    ctx.strokeStyle = OR2; ctx.lineWidth = 4.4; ctx.lineCap = "round";
    if (happy > 0.2) {
      ctx.beginPath(); ctx.moveTo(-14, -18); ctx.quadraticCurveTo(-22, -34, -16 + tw, -50); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(-14, -18); ctx.quadraticCurveTo(-26, -30 + tw * 0.3, -22 + tw * 0.2, -40); ctx.stroke();
    }

    // back legs
    ell(-8 + sw * 0.9, -6, 3.9, 6, OR2);
    ell(9 - sw * 0.9, -6, 3.9, 6, OR2);

    // happy: a soft arch in the back
    var arch = 1 + happy * 0.12;
    ell(0, -18 + happy * 1.5, 17, 11.5 * arch, OR);
    ell(-1, -13, 10.5, 6.5, CREAM);
    ctx.strokeStyle = OR2; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(-6, -27); ctx.lineTo(-3, -21); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-1, -27.5); ctx.lineTo(1, -21); ctx.stroke();

    // front legs
    ell(-8 - sw * 0.9, -6, 4, 6.2, OR);
    ell(9 + sw * 0.9, -6, 4, 6.2, OR);

    // head
    var hy = -32 + Math.sin(t * 2) * 0.9 * walk + sl * 4 + happy * Math.sin(now / 150) * 1.2;
    var hx = 14;
    ctx.fillStyle = OR;
    ctx.beginPath(); ctx.moveTo(hx - 8, hy - 6); ctx.lineTo(hx - 10, hy - 19); ctx.lineTo(hx - 1, hy - 9); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx + 4, hy - 8); ctx.lineTo(hx + 6, hy - 19); ctx.lineTo(hx + 12, hy - 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = PINK;
    ctx.beginPath(); ctx.moveTo(hx - 7, hy - 8); ctx.lineTo(hx - 8.5, hy - 16); ctx.lineTo(hx - 3, hy - 9.5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx + 5.5, hy - 9.5); ctx.lineTo(hx + 6.5, hy - 16); ctx.lineTo(hx + 10.5, hy - 7.5); ctx.closePath(); ctx.fill();
    ell(hx, hy, 11.5, 10, OR);
    ell(hx + 5, hy + 3, 6, 4.4, CREAM);
    ell(hx + 7.5, hy + 1.5, 1.6, 1.3, "#e2688a");
    ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(hx + 8, hy + 3.5); ctx.lineTo(hx + 19, hy + 1.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx + 8, hy + 4.5); ctx.lineTo(hx + 19, hy + 6); ctx.stroke();
    // eyes (green; they close into happy arcs when petted or asleep)
    var closed = sl > 0.5 || happy > 0.5;
    if (closed) {
      ctx.strokeStyle = "#2c6b3a"; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(hx + 1, hy - 1, 2.6, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      ctx.beginPath(); ctx.arc(hx + 7, hy - 1, 2.4, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    } else {
      var blink = ((now + 300) % 3900) < 120 ? 0.14 : 1;
      ell(hx + 1, hy - 2, 2.6, 2.9 * blink, "#7ce08a");
      ell(hx + 7, hy - 2, 2.4, 2.7 * blink, "#7ce08a");
      if (blink > 0.5) { ell(hx + 1, hy - 2, 1, 2.3, "#201a12"); ell(hx + 7, hy - 2, 1, 2.2, "#201a12"); }
    }
    hearts(now, hx, hy, happy);
    zzz(now, hx - 3, hy - 16, sl);
    ctx.restore();
  }

  /* ---------------------------------------------------------------- dog */
  function drawDog(now, happy) {
    if (level >= 2) { drawDogRigged(now, happy); return; }
    if (level >= 1) { drawDogRich(now, happy); return; }
    var BR = "#b5813f", BR2 = "#8f6127", CREAM = "#f4e2c2", DARK = "#2a1c10";
    var t = st.phase, walk = st.walk, sl = st.sleep;
    var bob = Math.sin(t * 2) * 2.2 * walk;
    ctx.save();
    ctx.translate(st.x, H - 8 - st.jumpY + bob + sl * 4);
    ctx.scale(st.dir, 1);
    shadow(22);
    var sw = Math.sin(t * 2) * 8 * walk;
    // happy: the tail wags fast and wide
    var tw = happy > 0.2 ? Math.sin(now / 70) * 17 : Math.sin(t * 3.4) * 12;

    // tail
    ctx.strokeStyle = BR2; ctx.lineWidth = 4.6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-15, -22); ctx.quadraticCurveTo(-28, -28 + tw * 0.3, -33, -36 + tw * 0.24); ctx.stroke();

    // legs
    ell(-11 + sw, -7, 4.2, 7.4, BR2);
    ell(10 - sw, -7, 4.2, 7.4, BR2);
    ell(-8 - sw, -7, 4.4, 7.6, BR);
    ell(12 + sw, -7, 4.4, 7.6, BR);

    // body (a happy wiggle while it is being petted)
    ell(happy * Math.sin(now / 120) * 1.2, -22, 20, 12, BR);
    ell(0, -16, 13, 7, CREAM);

    // head — a pair of LONG floppy ears that hang DOWN on both sides of the head, so they read from the
    // side view too (Egon 24.09.2026: "the dog's ears should be visible from the side as well — right now
    // they are either missing or tiny"). The FAR ear droops out from behind the skull in a darker shade;
    // the NEAR ear is drawn AFTER the head, hangs over the cheek and past the jaw, and wears a visible
    // outline — the two overlapping lobes are what make the head read as a dog's even in silhouette.
    var hy = -38 + Math.sin(t * 2) * 1.2 * walk + sl * 5 + happy * Math.sin(now / 170) * 1.1;
    var hx = 18;
    var sway = Math.sin(now / 240) * 0.9 * (0.5 + walk) + Math.sin(t * 1.6) * 0.8 * walk + happy * Math.sin(now / 120) * 2.4;
    var flop = 1 + happy * Math.sin(now / 130) * 0.2;
    // far ear (behind the skull — its lower lobe hangs out past the jaw)
    ctx.fillStyle = "#7d5320"; ctx.strokeStyle = "#4f3210"; ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(hx - 5, hy - 9);
    ctx.quadraticCurveTo(hx - 15, hy - 11 + sway * 0.4, hx - 19, hy + 2 + sway);
    ctx.quadraticCurveTo(hx - 21 * flop, hy + 13 + sway, hx - 13, hy + 15 + sway);
    ctx.quadraticCurveTo(hx - 8, hy + 6, hx - 3, hy - 3);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ell(hx, hy, 11.5, 10.5, BR);
    ell(hx + 9, hy + 4, 7.5, 5.4, CREAM);
    ell(hx + 14, hy + 1.5, 2.4, 2, DARK);
    if (walk > 0.35 || happy > 0.3) { ell(hx + 12, hy + 8.5, 2.6, 3.4 + Math.max(walk, happy), "#ff6b7f"); }
    // near ear (in FRONT of the head — the lobe the viewer sees hanging over the cheek)
    ctx.fillStyle = BR; ctx.strokeStyle = "#5a3a12"; ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(hx - 5, hy - 10);
    ctx.quadraticCurveTo(hx - 13, hy - 10 + sway * 0.4, hx - 15, hy + 2 + sway);
    ctx.quadraticCurveTo(hx - 16 * flop, hy + 14 + sway, hx - 8, hy + 14 + sway);
    ctx.quadraticCurveTo(hx - 3, hy + 6, hx - 2, hy - 7);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(90,58,18,.30)";
    ctx.beginPath();
    ctx.moveTo(hx - 6, hy - 5);
    ctx.quadraticCurveTo(hx - 11, hy + 2, hx - 9, hy + 10);
    ctx.quadraticCurveTo(hx - 6, hy + 4, hx - 6, hy - 5);
    ctx.closePath(); ctx.fill();
    eyes(now, hx + 3, hy - 3, 1400, happy, sl, "#2a1c10");
    hearts(now, hx, hy, happy);
    zzz(now, hx - 3, hy - 18, sl);
    ctx.restore();
  }

  /* ---------------------------------------------------------------- loop */
  /* ------------------------------------------------ the LEVEL 1 creatures */
  function drawDragonRich(now, happy) {
    var RED = "#e0392a", RED2 = "#ad2418", BELLY = "#ffd7ac", HORN = "#f6ead0";
    var t = st.phase, walk = st.walk, sl = st.sleep;
    var breath = 1 + Math.sin(now / 900) * 0.022;
    var squash = clamp(1 + st.jumpV * 0.012, 0.88, 1.12);
    var bob = Math.sin(t * 2) * 2 * walk;
    ctx.save();
    ctx.translate(st.x, H - 8 - st.jumpY + bob + sl * 3);
    ctx.scale(st.dir, 1);
    softShadow(25, 4);
    var tw = Math.sin(t * 1.5) * 6 + happy * Math.sin(now / 130) * 6;
    var tip = whip(-13, -20, 44, Math.PI * 0.9, now / 240 + t * 1.2, 5 * (0.55 + walk), 6.6, RED2);
    ctx.save();
    ctx.translate(tip.x, tip.y);
    ctx.rotate((tip.a || 0) + tw * 0.03);
    ball(0, 0, 6.2, 5.2, RED2, 0, 0.3);
    ctx.fillStyle = mixCol(RED2, "#000000", 0.28);
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-1, -5.4); ctx.lineTo(-1, 5.4); ctx.closePath(); ctx.fill();
    ctx.restore();
    var lp = Math.sin(t * 2), lo = -lp;
    legSeg(-11, -4, 4.1, 8.4, RED2, lp * walk, Math.max(0, lp) * 2 * walk);
    legSeg(12, -4, 4.1, 8.4, RED2, lo * walk, Math.max(0, lo) * 2 * walk);
    ball(0, -24 * squash, 20 * breath, 14.5 * squash / breath, RED, 0, 0.32);
    scales(0, -25 * squash, 17.5, 11, "#6d140d", 4);
    fur(0, -24 * squash, 19, 13.5, "#7d1a11", "#ff8a72", 20, 1.7, 3.2, 0);
    ball(-1, -17 * squash, 12.5, 8, BELLY, 0, 0.2);
    var flap = 1 + happy * Math.sin(now / 105) * 0.3 + Math.sin(now / 620) * 0.05;
    ctx.save();
    ctx.translate(-8, -36); ctx.scale(1, flap); ctx.translate(8, 36);
    var wg = ctx.createLinearGradient(-32, -64, -4, -34);
    wg.addColorStop(0, mixCol(RED2, "#000000", 0.32));
    wg.addColorStop(0.55, RED2);
    wg.addColorStop(1, mixCol(RED2, "#ffffff", 0.1));
    ctx.fillStyle = wg;
    ctx.beginPath(); ctx.moveTo(-8, -33); ctx.quadraticCurveTo(-38, -66, -3, -52); ctx.quadraticCurveTo(7, -38, -2, -31); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = rgbaOf("#3a0a06", 0.5); ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = rgbaOf("#ff9280", 0.45); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-7, -34); ctx.quadraticCurveTo(-22, -50, -11, -44); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, -33); ctx.quadraticCurveTo(-15, -45, -3, -39); ctx.stroke();
    ctx.restore();
    legSeg(-8, -4, 4.4, 8.8, RED, lo * -walk, Math.max(0, lo) * 2 * walk);
    legSeg(11, -4, 4.4, 8.8, RED, lp * -walk, Math.max(0, lp) * 2 * walk);
    var hy = -42 + Math.sin(t * 2) * 1 * walk + sl * 4 + happy * Math.sin(now / 190) * 1.4;
    var hx = 16;
    ball(hx, hy, 14.5, 13, RED, 0, 0.34);
    scales(hx, hy, 12, 10, "#6d140d", 3);
    ball(hx + 10, hy + 3.5, 9.5, 7.2, BELLY, 0, 0.18);
    var hg = ctx.createLinearGradient(hx - 6, hy - 22, hx + 8, hy - 8);
    hg.addColorStop(0, mixCol(HORN, "#ffffff", 0.25));
    hg.addColorStop(1, mixCol(HORN, "#000000", 0.26));
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.moveTo(hx - 7, hy - 10); ctx.lineTo(hx - 3, hy - 22); ctx.lineTo(hx + 2, hy - 10); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx + 2, hy - 11); ctx.lineTo(hx + 7, hy - 21); ctx.lineTo(hx + 10, hy - 8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = rgbaOf("#5c1009", 0.4); ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(hx - 6, hy - 10.5); ctx.lineTo(hx - 3, hy - 20); ctx.stroke();
    ell(hx + 16, hy + 1, 1.5, 1.5, RED2);
    ell(hx + 5, hy + 5, 3, 2, "rgba(255,140,120,.45)");
    ctx.strokeStyle = rgbaOf("#7a150e", 0.45); ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(hx + 1, hy - 8.5); ctx.quadraticCurveTo(hx + 5, hy - 10.5, hx + 9, hy - 8.5); ctx.stroke();
    gaze(hx + 6, hy - 3, 2.9, "#ffd24a", "#20140f", sl > 0.5 || happy > 0.5 || ((now + 700) % 4200) < 130);
    fireBreath(now, hx, hy, fireAmt(now));
    hearts(now, hx, hy, happy);
    zzz(now, hx - 4, hy - 20, sl * (1 - Math.min(1, fireAmt(now) * 2)));
    ctx.restore();
  }

  function drawCatRich(now, happy) {
    var OR = "#e8a25a", OR2 = "#c47f3c", CREAM = "#ffeeda", PINK = "#ff9db4";
    var t = st.phase, walk = st.walk, sl = st.sleep;
    var breath = 1 + Math.sin(now / 820) * 0.022;
    var squash = clamp(1 + st.jumpV * 0.012, 0.88, 1.12);
    var bob = Math.sin(t * 2) * 1.6 * walk;
    ctx.save();
    ctx.translate(st.x, H - 8 - st.jumpY + bob + sl * 4);
    ctx.scale(st.dir, 1);
    softShadow(22, 4);
    var lp = Math.sin(t * 2), lo = -lp;
    // tail — up and travelling when happy, low and lazy otherwise
    var up = happy > 0.2;
    var tip = whip(-14, -18, up ? 30 : 24, up ? -Math.PI * 0.42 : -Math.PI * 0.72,
      now / (up ? 150 : 320) + t, up ? 6 : 3.4, 5.4, OR2);
    ball(tip.x, tip.y, 3, 3, OR2, 0, 0.3);
    legSeg(-9, -6, 3.8, 6, OR2, lp * walk, Math.max(0, lp) * 1.8 * walk);
    legSeg(9, -6, 3.8, 6, OR2, lo * walk, Math.max(0, lo) * 1.8 * walk);
    var arch = 1 + happy * 0.12;
    ball(0, (-18 + happy * 1.5) * squash, 17 * breath, 11.5 * arch * squash / breath, OR, 0, 0.32);
    fur(0, -18 * squash, 16, 10.5, "#a86528", "#ffcf9a", 34, 2.3, 3, 0);
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = OR2; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(-6, -27); ctx.lineTo(-3, -21); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-1, -27.5); ctx.lineTo(1, -21); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, -26.5); ctx.lineTo(6, -21); ctx.stroke();
    ctx.restore();
    ball(-1, -13 * squash, 10.5, 6.5, CREAM, 0, 0.18);
    legSeg(-8, -6, 3.9, 6.2, OR, lo * -walk, Math.max(0, lo) * 1.8 * walk);
    legSeg(9, -6, 3.9, 6.2, OR, lp * -walk, Math.max(0, lp) * 1.8 * walk);
    var hy = -32 + Math.sin(t * 2) * 0.9 * walk + sl * 4 + happy * Math.sin(now / 150) * 1.2;
    var hx = 14;
    // ears — outer gradient, inner pink
    var eg = ctx.createLinearGradient(hx - 10, hy - 19, hx + 12, hy - 6);
    eg.addColorStop(0, OR2); eg.addColorStop(1, mixCol(OR, "#ffffff", 0.18));
    ctx.fillStyle = eg;
    ctx.beginPath(); ctx.moveTo(hx - 8, hy - 6); ctx.lineTo(hx - 10, hy - 19); ctx.lineTo(hx - 1, hy - 9); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx + 4, hy - 8); ctx.lineTo(hx + 6, hy - 19); ctx.lineTo(hx + 12, hy - 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = PINK;
    ctx.beginPath(); ctx.moveTo(hx - 7, hy - 8); ctx.lineTo(hx - 8.5, hy - 16); ctx.lineTo(hx - 3, hy - 9.5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx + 5.5, hy - 9.5); ctx.lineTo(hx + 6.5, hy - 16); ctx.lineTo(hx + 10.5, hy - 7.5); ctx.closePath(); ctx.fill();
    ball(hx, hy, 11.5, 10, OR, 0, 0.34);
    fur(hx, hy, 11, 9.5, "#a86528", "#ffcf9a", 24, 4.1, 2.6, 0);
    ball(hx + 5, hy + 3, 6, 4.4, CREAM, 0, 0.18);
    ball(hx + 7.5, hy + 1.5, 1.7, 1.4, "#e2688a", 0, 0.34);
    ctx.strokeStyle = rgbaOf("#ffffff", 0.7); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(hx + 8, hy + 3.5); ctx.lineTo(hx + 19, hy + 1.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx + 8, hy + 4.5); ctx.lineTo(hx + 19, hy + 6); ctx.stroke();
    var closed = sl > 0.5 || happy > 0.5 || ((now + 300) % 3900) < 120;
    gaze(hx + 1, hy - 2, 2.6, "#7ce08a", "#201a12", closed);
    if (!closed) gaze(hx + 7, hy - 2, 2.4, "#7ce08a", "#201a12", false);
    hearts(now, hx, hy, happy);
    zzz(now, hx - 3, hy - 16, sl);
    ctx.restore();
  }

  function drawDogRich(now, happy) {
    var BR = "#b5813f", BR2 = "#8f6127", CREAM = "#f4e2c2", DARK = "#2a1c10";
    var t = st.phase, walk = st.walk, sl = st.sleep;
    var breath = 1 + Math.sin(now / 700) * 0.024;
    var squash = clamp(1 + st.jumpV * 0.012, 0.88, 1.12);
    var bob = Math.sin(t * 2) * 2.2 * walk;
    ctx.save();
    ctx.translate(st.x, H - 8 - st.jumpY + bob + sl * 4);
    ctx.scale(st.dir, 1);
    softShadow(24, 4);
    var lp = Math.sin(t * 2), lo = -lp;
    var wag = happy > 0.2 ? now / 70 : now / 220 + t * 1.4;
    var tip = whip(-15, -22, 24, -Math.PI * 0.58, wag, happy > 0.2 ? 8 : 4.5, 5.8, BR2);
    legSeg(-12, -6, 4, 7.6, BR2, lp * walk, Math.max(0, lp) * 2.2 * walk);
    legSeg(11, -6, 4, 7.6, BR2, lo * walk, Math.max(0, lo) * 2.2 * walk);
    var wig = happy * Math.sin(now / 120) * 1.2;
    ball(wig, -22 * squash, 20 * breath, 12 * squash / breath, BR, 0, 0.32);
    fur(wig, -22 * squash, 19, 11.5, "#7d5320", "#e0b071", 40, 3.1, 3.4, 0);
    ball(wig, -16 * squash, 13, 7, CREAM, 0, 0.18);
    legSeg(-8, -6, 4.3, 7.8, BR, lo * -walk, Math.max(0, lo) * 2.2 * walk);
    legSeg(12, -6, 4.3, 7.8, BR, lp * -walk, Math.max(0, lp) * 2.2 * walk);
    var hy = -38 + Math.sin(t * 2) * 1.2 * walk + sl * 5 + happy * Math.sin(now / 170) * 1.1;
    var hx = 18;
    var sway = Math.sin(now / 240) * 0.9 * (0.5 + walk) + Math.sin(t * 1.6) * 0.8 * walk + happy * Math.sin(now / 120) * 2.4;
    var flop = 1 + happy * Math.sin(now / 130) * 0.2;
    var farG = ctx.createLinearGradient(hx - 21, hy - 11, hx - 5, hy + 15);
    farG.addColorStop(0, mixCol("#7d5320", "#000000", 0.12));
    farG.addColorStop(1, "#6b4519");
    ctx.fillStyle = farG; ctx.strokeStyle = "#4f3210"; ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(hx - 5, hy - 9);
    ctx.quadraticCurveTo(hx - 15, hy - 11 + sway * 0.4, hx - 19, hy + 2 + sway);
    ctx.quadraticCurveTo(hx - 21 * flop, hy + 13 + sway, hx - 13, hy + 15 + sway);
    ctx.quadraticCurveTo(hx - 8, hy + 6, hx - 3, hy - 3);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ball(hx, hy, 11.5, 10.5, BR, 0, 0.34);
    fur(hx, hy, 11, 10, "#7d5320", "#e0b071", 26, 5.4, 2.8, 0);
    ball(hx + 9, hy + 4, 7.5, 5.4, CREAM, 0, 0.18);
    ball(hx + 14, hy + 1.5, 2.5, 2.1, DARK, 0, 0.3);
    if (walk > 0.35 || happy > 0.3) {
      ball(hx + 12, hy + 8.5, 2.6, 3.4 + Math.max(walk, happy), "#ff6b7f", 0, 0.2);
      ctx.fillStyle = rgbaOf("#d94f66", 0.5);
      ctx.beginPath(); ctx.moveTo(hx + 12, hy + 6.5); ctx.lineTo(hx + 12.4, hy + 10); ctx.stroke();
    }
    var nearG = ctx.createLinearGradient(hx - 15, hy - 10, hx - 2, hy + 14);
    nearG.addColorStop(0, mixCol(BR, "#ffffff", 0.14));
    nearG.addColorStop(1, mixCol(BR, "#000000", 0.14));
    ctx.fillStyle = nearG; ctx.strokeStyle = "#5a3a12"; ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(hx - 5, hy - 10);
    ctx.quadraticCurveTo(hx - 13, hy - 10 + sway * 0.4, hx - 15, hy + 2 + sway);
    ctx.quadraticCurveTo(hx - 16 * flop, hy + 14 + sway, hx - 8, hy + 14 + sway);
    ctx.quadraticCurveTo(hx - 3, hy + 6, hx - 2, hy - 7);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(90,58,18,.26)";
    ctx.beginPath();
    ctx.moveTo(hx - 6, hy - 5);
    ctx.quadraticCurveTo(hx - 11, hy + 2, hx - 9, hy + 10);
    ctx.quadraticCurveTo(hx - 6, hy + 4, hx - 6, hy - 5);
    ctx.closePath(); ctx.fill();
    gaze(hx + 3, hy - 3, 3.1, "#7a4a18", DARK, sl > 0.5 || happy > 0.5 || ((now + 1400) % 4200) < 130);
    hearts(now, hx, hy, happy);
    zzz(now, hx - 3, hy - 18, sl);
    ctx.restore();
  }

  /* ============================================================================
     LEVEL 2 — RIGGED SKELETON   (Egon 25.09.2026, W-FEAT284 / Designbook §4)
     ----------------------------------------------------------------------------
     Level 0 paints a sticker, Level 1 paints the creature fresh every frame. Level 2 keeps Level 1's
     primitives but drives them from a real 2-D SKELETON, so what gets painted is a POSE: the legs run a
     contact / push / lift / reach cycle with the paws clamped to the ground line, the tail is an FK
     chain that travels like a whip, the wing flaps and the head swings on the neck to follow the pointer.

     RIG (local space: +x = forward, y = 0 is the ground, y < 0 is up; origin = the point under the hip)
         pelvis ── torso ── neck ── head
            │                └── wing (dragon only)
            ├── hind leg (hip -> knee -> paw)   ├── fore leg (hip -> knee -> paw)
            └── tail bone 0 -> bone 1 -> bone 2
   ============================================================================ */
  var RIG = {
    dragon: { bw: 20, bh: 14.5, up: 6.6, lo: 6.6, lw: 4.9, head: 14.5, lift: 18.5, neck: [10.5, -7.8], headOff: [5.6, -7.6],
      tail: 50, tw: 6.4, wings: true,
      col: "#e0392a", col2: "#ad2418", belly: "#ffd7ac", ink: "#6d140d", hi: "#ff8a72", horn: "#f6ead0", iris: "#ffd24a", dark: "#20140f" },
    cat: { bw: 17.5, bh: 11.5, up: 5.4, lo: 5.4, lw: 4.2, head: 11.6, lift: 15, neck: [8.8, -6.6], headOff: [4.8, -7],
      tail: 34, tw: 5.6, wings: false,
      col: "#e8a25a", col2: "#c47f3c", belly: "#ffeeda", ink: "#a86528", hi: "#ffcf9a", horn: "#ff9db4", iris: "#7ce08a", dark: "#3a2a18" },
    dog: { bw: 19.5, bh: 12.5, up: 6.2, lo: 6.2, lw: 4.6, head: 12.8, lift: 17, neck: [9.2, -7], headOff: [5.4, -7],
      tail: 34, tw: 6, wings: false,
      col: "#b5813f", col2: "#8f6127", belly: "#f4e2c2", ink: "#6b451a", hi: "#d8ab6a", horn: "#f4e2c2", iris: "#3a2a18", dark: "#241a10" }
  };

  // A bone: a tapered capsule shaded like the rest of the creature (light from the upper left), with a
  // soft outline. Everything in Level 2 that is not the torso or the head is built out of these.
  function capsule(x1, y1, x2, y2, r1, r2, base, shade) {
    var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.01) return;
    var sh = shade == null ? 0.3 : shade;
    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(Math.atan2(dy, dx));
    var r = Math.max(r1, r2);
    var g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, mixCol(base, "#ffffff", sh * 0.9));
    g.addColorStop(0.45, base);
    g.addColorStop(1, mixCol(base, "#000000", sh));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r1, Math.PI * 0.5, Math.PI * 1.5, false);
    ctx.arc(len, 0, r2, Math.PI * 1.5, Math.PI * 0.5, false);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgbaOf("#000000", 0.15);
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.restore();
  }

  // One leg: hip -> knee -> paw. The knee folds on the swing half of the cycle, and the shin is clamped
  // so that the paw never sinks through the ground line — that clamp is what makes the stance read as
  // planted instead of sliding.
  function rigLeg(A, hipX, hipY, thigh, knee, base) {
    var kx = hipX + Math.sin(thigh) * A.up, ky = hipY + Math.cos(thigh) * A.up;
    var fa = thigh + knee;
    var px = kx + Math.sin(fa) * A.lo, py = ky + Math.cos(fa) * A.lo;
    if (py > 0) {
      var want = Math.acos(clamp(-ky / A.lo, -1, 1));
      fa = (fa < 0 ? -1 : 1) * want;
      px = kx + Math.sin(fa) * A.lo;
      py = ky + Math.cos(fa) * A.lo;
    }
    capsule(hipX, hipY, kx, ky, A.lw, A.lw * 0.84, base, 0.28);
    ball(kx, ky, A.lw * 0.86, A.lw * 0.86, mixCol(base, "#000000", 0.04), 0, 0.3);
    capsule(kx, ky, px, py, A.lw * 0.82, A.lw * 0.72, base, 0.32);
    ball(px, py, A.lw * 0.98, A.lw * 0.84, mixCol(base, "#000000", 0.05), 0, 0.3);
    ell(px + A.lw * 0.42, py + A.lw * 0.26, A.lw * 0.58, A.lw * 0.26, mixCol(base, "#ffffff", 0.22));;
  }

  // The gait. It is a TROT: the near hind leg swings with the far fore leg, and the far hind with the
  // near fore, so the diagonal pairs stay together the way a dog actually moves.
  function legCycle(p, walk, fore) {
    return [-0.42 * Math.sin(p) * walk, (fore ? 0.55 : 1.0) * Math.max(0, -Math.cos(p)) * walk + 0.08];
  }

  // the torso, painted around the body centre (breathing, landing squash and a little roll on the walk).
  // A haunch behind and a chest in front break the egg silhouette so the body reads as a body.
  function drawRigTorso(A, kind, breath, squash, tilt) {
    ctx.save();
    ctx.rotate(tilt);
    ctx.scale(1 + (squash - 1) * 0.5, squash);
    ball(0, 0, A.bw * breath, A.bh / breath, A.col, 0, 0.32);
    ball(-A.bw * 0.42, A.bh * 0.1, A.bw * 0.56, A.bh * 0.86, mixCol(A.col, "#000000", 0.07), 0, 0.3);
    ball(A.bw * 0.44, A.bh * 0.12, A.bw * 0.48, A.bh * 0.78, mixCol(A.col, "#ffffff", 0.04), 0, 0.3);
    if (kind === "dragon") scales(0, A.bh * 0.06, A.bw * 0.86, A.bh * 0.74, A.ink, 4);
    fur(0, 0, A.bw * 0.94, A.bh * 0.92, kind === "dragon" ? "#7d1a11" : A.ink, A.hi,
      kind === "cat" ? 30 : (kind === "dog" ? 36 : 20), kind === "cat" ? 2.3 : 3.1, 3, 0);
    if (kind === "cat") {
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = A.col2; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(-A.bw * 0.35, -A.bh * 0.6); ctx.lineTo(-A.bw * 0.18, -A.bh * 0.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-A.bw * 0.06, -A.bh * 0.66); ctx.lineTo(A.bw * 0.06, -A.bh * 0.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(A.bw * 0.24, -A.bh * 0.58); ctx.lineTo(A.bw * 0.35, -A.bh * 0.2); ctx.stroke();
      ctx.restore();
    }
    ball(-A.bw * 0.05, A.bh * 0.45, A.bw * 0.62, A.bh * 0.52, A.belly, 0, 0.2);
    ctx.restore();
  }

  // the head, painted around the head centre inside the neck's rotated frame
  function drawRigHead(A, kind, now, happy, sl, look, walk) {
    var H = A.head;
    var closed = sl > 0.5 || happy > 0.5 || ((now + 700) % 4200) < 130;
    if (kind === "dragon") {
      ball(0, 0, H, H * 0.9, A.col, 0, 0.34);
      scales(0, 0, H * 0.83, H * 0.69, A.ink, 3);
      ball(H * 0.69, H * 0.24, H * 0.66, H * 0.5, A.belly, 0, 0.18);
      var hg = ctx.createLinearGradient(-H * 0.41, -H * 1.52, H * 0.55, -H * 0.55);
      hg.addColorStop(0, mixCol(A.horn, "#ffffff", 0.25));
      hg.addColorStop(1, mixCol(A.horn, "#000000", 0.26));
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.moveTo(-H * 0.48, -H * 0.69); ctx.lineTo(-H * 0.21, -H * 1.52); ctx.lineTo(H * 0.14, -H * 0.69); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(H * 0.14, -H * 0.76); ctx.lineTo(H * 0.48, -H * 1.45); ctx.lineTo(H * 0.69, -H * 0.55); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgbaOf("#5c1009", 0.4); ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(-H * 0.41, -H * 0.72); ctx.lineTo(-H * 0.21, -H * 1.38); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(H * 0.55, H * 0.34); ctx.lineTo(H * 1.35, H * 0.22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(H * 0.55, H * 0.44); ctx.lineTo(H * 1.35, H * 0.56); ctx.stroke();
      ell(H * 1.1, H * 0.07, H * 0.1, H * 0.1, A.col2);
      ell(H * 0.34, H * 0.34, H * 0.21, H * 0.14, "rgba(255,140,120,.45)");
      ctx.strokeStyle = rgbaOf("#7a150e", 0.45); ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(H * 0.07, -H * 0.59); ctx.quadraticCurveTo(H * 0.34, -H * 0.72, H * 0.62, -H * 0.59); ctx.stroke();
      gaze(H * 0.41 + look * H * 0.05, -H * 0.21, H * 0.2, A.iris, A.dark, closed);
    } else if (kind === "cat") {
      var c = H / 11.5;
      var eg = ctx.createLinearGradient(-10 * c, -19 * c, 12 * c, -6 * c);
      eg.addColorStop(0, A.col2); eg.addColorStop(1, mixCol(A.col, "#ffffff", 0.18));
      ctx.fillStyle = eg;
      ctx.beginPath(); ctx.moveTo(-8 * c, -6 * c); ctx.lineTo(-10 * c, -19 * c); ctx.lineTo(-1 * c, -9 * c); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(4 * c, -8 * c); ctx.lineTo(6 * c, -19 * c); ctx.lineTo(12 * c, -6 * c); ctx.closePath(); ctx.fill();
      ctx.fillStyle = A.horn;
      ctx.beginPath(); ctx.moveTo(-7 * c, -8 * c); ctx.lineTo(-8.5 * c, -16 * c); ctx.lineTo(-3 * c, -9.5 * c); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(5.5 * c, -9.5 * c); ctx.lineTo(6.5 * c, -16 * c); ctx.lineTo(10.5 * c, -7.5 * c); ctx.closePath(); ctx.fill();
      ball(0, 0, H, H * 0.87, A.col, 0, 0.34);
      fur(0, 0, H * 0.95, H * 0.83, A.ink, A.hi, 24, 4.1, 2.6, 0);
      ball(5 * c, 3 * c, 6 * c, 4.4 * c, A.belly, 0, 0.18);
      ball(7.5 * c, 1.5 * c, 1.7 * c, 1.4 * c, "#e2688a", 0, 0.34);
      ctx.strokeStyle = rgbaOf("#ffffff", 0.7); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(8 * c, 3.5 * c); ctx.lineTo(19 * c, 1.5 * c); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(8 * c, 4.5 * c); ctx.lineTo(19 * c, 6 * c); ctx.stroke();
      gaze((1 + look * 0.9) * c, -2 * c, 2.6 * c, A.iris, A.dark, closed);
      if (!closed) gaze((7 + look * 0.9) * c, -2 * c, 2.4 * c, A.iris, A.dark, false);
    } else {
      var d = H / 11.5;
      var sway = Math.sin(now / 240) * 0.9 * (0.5 + walk) + happy * Math.sin(now / 120) * 2.2;
      var flop = 1 + happy * Math.sin(now / 130) * 0.2;
      var farG = ctx.createLinearGradient(-21 * d, -11 * d, -5 * d, 15 * d);
      farG.addColorStop(0, mixCol("#7d5320", "#000000", 0.12));
      farG.addColorStop(1, "#6b4519");
      ctx.fillStyle = farG; ctx.strokeStyle = "#4f3210"; ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-5 * d, -9 * d);
      ctx.quadraticCurveTo(-15 * d, -11 * d + sway * 0.4, -19 * d, 2 * d + sway);
      ctx.quadraticCurveTo(-21 * d * flop, 13 * d + sway, -13 * d, 15 * d + sway);
      ctx.quadraticCurveTo(-8 * d, 6 * d, -3 * d, -3 * d);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ball(0, 0, H, H * 0.91, A.col, 0, 0.34);
      fur(0, 0, H * 0.95, H * 0.87, "#7d5320", "#e0b071", 26, 5.4, 2.8, 0);
      ball(9 * d, 4 * d, 7.5 * d, 5.4 * d, A.belly, 0, 0.18);
      ball(14 * d, 1.5 * d, 2.5 * d, 2.1 * d, A.dark, 0, 0.3);
      if (walk > 0.35 || happy > 0.3) {
        ball(12 * d, 8.5 * d, 2.6 * d, (3.4 + Math.max(walk, happy)) * d, "#ff6b7f", 0, 0.2);
        ctx.fillStyle = rgbaOf("#d94f66", 0.5);
        ctx.beginPath(); ctx.moveTo(12 * d, 6.5 * d); ctx.lineTo(12.4 * d, 10 * d); ctx.stroke();
      }
      var nearG = ctx.createLinearGradient(-15 * d, -10 * d, -2 * d, 14 * d);
      nearG.addColorStop(0, mixCol(A.col, "#ffffff", 0.14));
      nearG.addColorStop(1, mixCol(A.col, "#000000", 0.14));
      ctx.fillStyle = nearG; ctx.strokeStyle = "#5a3a12"; ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-5 * d, -10 * d);
      ctx.quadraticCurveTo(-13 * d, -10 * d + sway * 0.4, -15 * d, 2 * d + sway);
      ctx.quadraticCurveTo(-16 * d * flop, 14 * d + sway, -8 * d, 14 * d + sway);
      ctx.quadraticCurveTo(-3 * d, 6 * d, -2 * d, -7 * d);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      gaze((3 + look * 1.1) * d, -3 * d, 3.1 * d, A.iris, A.dark, closed);
    }
  }

  function drawRigged(kind, now, happy) {
    var A = RIG[kind];
    if (!A) return;
    var t = st.phase, walk = st.walk, sl = st.sleep;
    var ph = t * 2;
    var breath = 1 + Math.sin(now / 880) * 0.022;
    var squash = clamp(1 + st.jumpV * 0.012, 0.88, 1.12);
    var bob = Math.sin(ph) * 2 * walk;
    // where the pointer is, in LOCAL space (the canvas is mirrored by ctx.scale(st.dir, 1))
    var look = ptr.seen ? clamp(((ptr.x - st.x) * st.dir) / 240, -1, 1) : 0;
    var tilt = Math.sin(ph) * 0.05 * walk - 0.05 * happy + sl * 0.03;

    ctx.save();
    ctx.translate(st.x, H - 8 - st.jumpY + bob + sl * 4);
    ctx.scale(st.dir, 1);
    softShadow(A.bw * 1.15, 4);

    var hipY = -(A.up + A.lo);                       // standing: the paw lands exactly on y = 0
    var bodyY = hipY - A.lift;                       // the body rides above the hips
    var hindX = -A.bw * 0.5, foreX = A.bw * 0.48;
    var dark = mixCol(A.col2, "#000000", 0.22);

    // ---- far pair first, so the torso covers their shoulder joints ----
    var fl = legCycle(ph + Math.PI * 0.94, walk, false);
    rigLeg(A, hindX, hipY, fl[0], fl[1], dark);
    var fr = legCycle(ph + Math.PI * 0.06, walk, true);
    rigLeg(A, foreX, hipY, fr[0], fr[1], dark);

    // ---- tail: an FK chain rooted at the rump, travelling like a whip ----
    var wag = 4.5 + 5 * walk + 7 * happy;
    var tAng = kind === "dragon" ? -Math.PI * 0.80 : (kind === "cat" ? -Math.PI * 0.56 : -Math.PI * 0.64);
    var tip = whip(-A.bw * 0.72, bodyY + A.bh * 0.18, A.tail, tAng + tilt * 0.8,
      now / 240 + t * 1.5, wag, A.tw, A.col2);
    ctx.save();
    ctx.translate(tip.x, tip.y);
    if (kind === "dragon") {
      ctx.rotate((tip.a || 0) + Math.PI * 0.5);
      ball(0, 0, A.tw * 0.95, A.tw * 0.8, A.col2, 0, 0.3);
      ctx.fillStyle = mixCol(A.col2, "#000000", 0.28);
      ctx.beginPath(); ctx.moveTo(A.tw * 1.35, 0); ctx.lineTo(-A.tw * 0.15, -A.tw * 0.85); ctx.lineTo(-A.tw * 0.15, A.tw * 0.85); ctx.closePath(); ctx.fill();
    } else {
      ball(0, 0, A.tw * 0.52, A.tw * 0.52, A.col2, 0, 0.3);
    }
    ctx.restore();

    // ---- torso ----
    ctx.save();
    ctx.translate(0, bodyY);
    drawRigTorso(A, kind, breath, squash, tilt);
    ctx.restore();

    // ---- near pair (in front of the body) ----
    var nl = legCycle(ph, walk, false);
    rigLeg(A, hindX, hipY, nl[0], nl[1], A.col);
    var nr = legCycle(ph + Math.PI, walk, true);
    rigLeg(A, foreX, hipY, nr[0], nr[1], A.col);

    // ---- wing (dragon only): anchored at the shoulder, in front of the torso ----
    if (A.wings) {
      var flap = 1 + happy * Math.sin(now / 105) * 0.3 + Math.sin(now / 620) * 0.05 + Math.sin(ph) * 0.06 * walk;
      ctx.save();
      ctx.translate(0, bodyY - A.bh * 0.5);
      ctx.scale(A.bw / 20, (A.bw / 20) * flap);
      var wg = ctx.createLinearGradient(-32, -28, -4, 4);
      wg.addColorStop(0, mixCol(A.col2, "#000000", 0.32));
      wg.addColorStop(0.55, A.col2);
      wg.addColorStop(1, mixCol(A.col2, "#ffffff", 0.1));
      ctx.fillStyle = wg;
      ctx.beginPath(); ctx.moveTo(-8, 3); ctx.quadraticCurveTo(-38, -30, -3, -16); ctx.quadraticCurveTo(7, -2, -2, 5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgbaOf("#3a0a06", 0.5); ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = rgbaOf("#ff9280", 0.45); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-7, 2); ctx.quadraticCurveTo(-22, -14, -11, -8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-6, 3); ctx.quadraticCurveTo(-15, -9, -3, -3); ctx.stroke();
      ctx.restore();
    }

    // ---- head: sits on the neck, swings toward the pointer, droops when asleep ----
    var headA = tilt * 0.5 + look * 0.42 + happy * Math.sin(now / 190) * 0.06 + sl * 0.3;
    var pivotX = A.neck[0], pivotY = bodyY + A.neck[1];
    var hx = pivotX + Math.cos(headA) * A.headOff[0] - Math.sin(headA) * A.headOff[1];
    var hy = pivotY + Math.sin(headA) * A.headOff[0] + Math.cos(headA) * A.headOff[1] - sl * 1.6;
    // neck: a short capsule from the chest up to the head, so the head never reads as detached
    capsule(A.bw * 0.4, bodyY - A.bh * 0.42, hx, hy, A.head * 0.44, A.head * 0.5, A.col, 0.3);
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(headA);
    drawRigHead(A, kind, now, happy, sl, look, walk);
    // ---- effects, drawn in the head's own frame ----
    if (kind === "dragon") fireBreath(now, A.head * 0.7, A.head * 0.15, fireAmt(now));
    hearts(now, 0, 0, happy);
    zzz(now, -A.head * 0.3, -A.head * 0.9, sl * (kind === "dragon" ? (1 - Math.min(1, fireAmt(now) * 2)) : 1));
    ctx.restore();

    ctx.restore();
  }

  function drawDragonRigged(now, happy) { drawRigged("dragon", now, happy); }
  function drawCatRigged(now, happy) { drawRigged("cat", now, happy); }
  function drawDogRigged(now, happy) { drawRigged("dog", now, happy); }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!ctx) return;
    if (document.hidden) { lastT = now; return; }
    var dt = lastT ? Math.min(60, now - lastT) : 16;
    lastT = now;
    ctx.clearRect(0, 0, W, H);
    update(now, dt);
    var happy = st.happy;
    if (mode === "dragon") drawDragon(now, happy);
    else if (mode === "cat") { drawYarn(now); drawCat(now, happy); }
    else if (mode === "dog") drawDog(now, happy);
  }

  function start() {
    if (running || mode === "off") return;
    running = true;
    ensureLayer();
    lastT = 0;
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    layer = null; canvas = null; ctx = null;
    if (window.__dragonCompanionBtnSync) window.__dragonCompanionBtnSync();
  }

  function setMode(k) {
    var next = (k === "off" || KINDS.indexOf(k) !== -1) ? k : "off";
    if (next === mode && running) { if (window.__dragonCompanionBtnSync) window.__dragonCompanionBtnSync(); return; }
    mode = next;
    lsSet(LS_MODE, mode);
    stop();
    if (mode !== "off") { st.x = 0; st.happy = 0; st.sleep = 0; start(); }
    if (window.__dragonCompanionBtnSync) window.__dragonCompanionBtnSync();
    if (window.dragonToast) window.dragonToast("🐾 Companion: " + (mode === "off" ? "Off" : KIND_LABEL[mode]));
  }
  function setDelay(ms) {
    delayMs = clamp(parseInt(ms, 10) || 800, 100, 3000);
    lsSet(LS_DELAY, String(delayMs));
    if (window.__dragonCompanionBtnSync) window.__dragonCompanionBtnSync();
  }
  // 🐾 LEVEL 0 <-> LEVEL 1 (Egon 24.09.2026). Switching is instant and needs no restart: the loop is
  // already running and simply paints the other variant on the next frame.
  function setLevel(n) {
    var next = parseInt(n, 10);
    if (!(next >= 0 && next <= 2)) next = 0;
    if (next === level) { if (window.__dragonCompanionBtnSync) window.__dragonCompanionBtnSync(); return; }
    level = next;
    lsSet(LS_LEVEL, String(level));
    if (window.__dragonCompanionBtnSync) window.__dragonCompanionBtnSync();
    if (window.dragonToast) window.dragonToast("\uD83D\uDC3E Companion: " + LEVEL_NAME[level]);
  }

  /* ---------------------------------------------------------------- settings control */
  function dragonBuildCompanionBtn() {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "dragonCompanionBtn";
    btn.className = "dragon-set-special";
    // Egon 25.09.2026 — set the three COLOUR properties only. The Settings card standard gives this button
    // its width inline (the two standard widths are assigned by the card builders), so writing
    // `style.cssText` here would wipe the width and the button would collapse to fit-content (
    // "starts big, shrinks when clicked"). Rulebook I23-6 / Designbook §4-6.
    btn.style.border = "1px solid #7ad0a8";
    btn.style.background = "linear-gradient(180deg,#10301f,#08170f)";
    btn.style.color = "#c9ffe4";
    var pop = document.createElement("div");
    pop.style.cssText = "position:fixed; z-index:2147483000; display:none; flex-direction:column; gap:3px; " +
      "background:#10131a; border:1px solid #4fbf8a; border-radius:9px; padding:6px; " +
      "width:15.5rem; max-width:calc(100vw - 16px); box-sizing:border-box; " +
      "box-shadow:0 12px 30px rgba(0,0,0,.7);";
    (document.body || document.documentElement).appendChild(pop);

    function mkRow(label, active, fn) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.style.cssText = "text-align:left; padding:.35rem .5rem; font-size:.76rem; border-radius:6px; cursor:pointer; " +
        "border:1px solid " + (active ? "#4fbf8a" : "#33333f") + "; " +
        "background:" + (active ? "#173a29" : "#16161d") + "; color:" + (active ? "#c9ffe4" : "#ddd") + ";";
      b.onclick = function (e) { e.stopPropagation(); fn(); };
      pop.appendChild(b);
      return b;
    }
    function build() {
      pop.innerHTML = "";
      var head = document.createElement("div");
      head.textContent = "\uD83D\uDC3E Generator Companion";
      head.style.cssText = "font-size:.72rem; font-weight:bold; color:#9fe8c4; padding:.15rem .35rem .3rem;";
      pop.appendChild(head);
      mkRow("\u26D4 Off", mode === "off", function () { setMode("off"); build(); });
      KINDS.forEach(function (k) { mkRow(KIND_LABEL[k], mode === k, function () { setMode(k); build(); }); });
      var lag = document.createElement("div");
      lag.textContent = "\u23F1 Follow lag";
      lag.style.cssText = "font-size:.68rem; color:#9fe8c4; padding:.4rem .35rem .1rem;";
      pop.appendChild(lag);
      var row = document.createElement("div");
      row.style.cssText = "display:flex; gap:4px;";
      DELAY_PRESETS.forEach(function (p) {
        var active = Math.abs(delayMs - p[1]) < 120;
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = p[0];
        b.style.cssText = "flex:1 1 0; padding:.25rem .2rem; font-size:.68rem; border-radius:6px; cursor:pointer; border:1px solid " +
          (active ? "#4fbf8a" : "#33333f") + "; background:" + (active ? "#173a29" : "#16161d") + "; color:" + (active ? "#c9ffe4" : "#ccc") + ";";
        b.onclick = function (e) { e.stopPropagation(); setDelay(p[1]); build(); };
        row.appendChild(b);
      });
      pop.appendChild(row);
      // 🐾 the realism ladder lives in this same window (Egon 24.09.2026: "the current one is level 0 —
      // build level 1 and put it in the window behind the Settings button"). Level 0 stays the default.
      var lvl = document.createElement("div");
      lvl.textContent = "\u2B50 Realism";
      lvl.style.cssText = "font-size:.68rem; color:#9fe8c4; padding:.4rem .35rem .1rem;";
      pop.appendChild(lvl);
      var lrow = document.createElement("div");
      lrow.style.cssText = "display:flex; gap:4px;";
      [0, 1, 2].forEach(function (n) {
        var active = level === n;
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = LEVEL_NAME[n];
        b.setAttribute("data-clevel", String(n));
        b.style.cssText = "flex:1 1 0; padding:.25rem .2rem; font-size:.66rem; border-radius:6px; cursor:pointer; border:1px solid " +
          (active ? "#4fbf8a" : "#33333f") + "; background:" + (active ? "#173a29" : "#16161d") + "; color:" + (active ? "#c9ffe4" : "#ccc") + ";";
        b.onclick = function (e) { e.stopPropagation(); setLevel(n); build(); };
        lrow.appendChild(b);
      });
      pop.appendChild(lrow);
      var lnote = document.createElement("div");
      lnote.textContent = level === 1
        ? "Level 1 keeps the same little creature but paints it properly: volume, fur and scales, a walk cycle with real paw steps and a tail that travels."
        : "Level 0 is the flat, sticker-like look. Level 1 is the stylised-realistic pass \u2014 same behaviour, richer painting.";
      lnote.style.cssText = "font-size:.6rem; color:#8fa39a; padding:.3rem .35rem .1rem; line-height:1.25;";
      pop.appendChild(lnote);
      var hint = document.createElement("div");
      hint.textContent = "The creature sits at the bottom of the page, follows the pointer with this lag, and plays on its own when the mouse rests.";
      hint.style.cssText = "font-size:.62rem; color:#8fa39a; padding:.35rem; line-height:1.25;";
      pop.appendChild(hint);
      // 🚧 Egon 24.09.2026 — the "work in progress" note belongs INSIDE this menu, at its very bottom
      // (it used to sit under the Settings button, where it was easy to miss and where it pushed the
      // UI & Display card around).
      var wip = document.createElement("div");
      wip.className = "dragon-companion-wip";
      wip.textContent = "\uD83D\uDEA7 work in progress";
      wip.title = "The companion is still being built — the controls work, but expect changes";
      wip.style.cssText = "font-size:.64rem; color:#c9a24d; text-align:center; line-height:1.2; " +
        "border-top:1px dashed #3a3a46; margin-top:.3rem; padding:.35rem .3rem .1rem;";
      pop.appendChild(wip);
    }
    function close() { pop.style.display = "none"; document.removeEventListener("pointerdown", out, true); }
    function out(e) { if (!pop.contains(e.target) && e.target !== btn) close(); }
    btn.onclick = function (e) {
      e.stopPropagation();
      if (pop.style.display === "flex") { close(); return; }
      build();
      pop.style.display = "flex";
      var r = btn.getBoundingClientRect();
      var pw = pop.offsetWidth, ph = pop.offsetHeight;
      pop.style.left = clamp(r.left + r.width / 2 - pw / 2, 8, Math.max(8, (window.innerWidth || 360) - pw - 8)) + "px";
      var below = r.bottom + 4;
      pop.style.top = (below + ph > (window.innerHeight || 600) ? Math.max(8, r.top - ph - 4) : below) + "px";
      setTimeout(function () { document.addEventListener("pointerdown", out, true); }, 0);
    };
    // 🐾 Egon 24.09.2026 — the button wears the COLOUR of the selected companion (red dragon, ginger cat,
    // brown dog; green while off). Same `.dragon-set-special` chrome, only these three props change.
    window.__dragonCompanionBtnSync = function () {
      var pal = KIND_PAL[mode] || KIND_PAL.off;
      btn.style.border = "1px solid " + pal.bd;
      btn.style.background = pal.bg;
      btn.style.color = pal.col;
      btn.textContent = "\uD83D\uDC3E Companion: " + (mode === "off" ? "Off" : KIND_LABEL[mode]) + (level > 0 ? " \u00B7 L" + level : "");
    };
    window.__dragonCompanionBtnSync();
    return btn;
  }

  // 🚧 W-FEAT281 — the "work in progress" note now lives INSIDE the picker menu (see build() above); the
  // standalone builder that used to sit under the Settings button was retired (Egon 24.09.2026: "the
  // note should be at the very bottom of the window that opens when you press the companion button —
  // move it there").

  window.dragonBuildCompanionBtn = dragonBuildCompanionBtn;
  window.dragonCompanion = {
    get: function () { return mode; },
    set: setMode,
    setDelay: setDelay,
    delay: function () { return delayMs; },
    level: function () { return level; },
    setLevel: setLevel,
    levels: LEVEL_NAME,
    kinds: KINDS
  };

  function boot() { if (mode !== "off") start(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
