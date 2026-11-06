/* ============================================================================
   STEEL RACER — admin test build (Egon 26.10.2026)
   A 2D top-down steel-track racer: 3 laps vs 3 AI rivals, boost pads,
   oil slicks, drift sparks, touch controls. No external assets — all canvas.
   Standalone page, loaded by the admin panel in an iframe.
   Exposes window.__racerState() for automated smoke tests.
   ============================================================================ */
(function () {
  "use strict";

  var W = 960, H = 600;
  var TOTAL_LAPS = 3;
  var HALF_W = 65;               // half track width (px)
  var BEST_KEY = "steelRacerBestV1";

  var canvas = document.getElementById("sr-canvas");
  var ctx = canvas.getContext("2d");
  var elLap = document.getElementById("sr-lap");
  var elTime = document.getElementById("sr-time");
  var elPos = document.getElementById("sr-pos");
  var elSpeed = document.getElementById("sr-speed");
  var elMsg = document.getElementById("sr-msg");
  var btnPause = document.getElementById("sr-pause");
  var btnRestart = document.getElementById("sr-restart");

  /* ---------------- small helpers ---------------- */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function fmtTime(ms) {
    if (ms == null || ms < 0) return "--:--.-";
    var t = Math.floor(ms / 100), d = t % 10, s = Math.floor(t / 10) % 60, m = Math.floor(t / 600);
    return m + ":" + (s < 10 ? "0" : "") + s + "." + d;
  }
  function angLerp(a, b, t) {
    var d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }
  function loadBest() {
    try { var o = JSON.parse(localStorage.getItem(BEST_KEY) || "null"); if (o && typeof o === "object") return o; } catch (e) {}
    return { lap: 0, total: 0 };
  }
  function saveBest(b) { try { localStorage.setItem(BEST_KEY, JSON.stringify(b)); } catch (e) {} }

  /* ---------------- tiny beeps (guarded) ---------------- */
  var AC = null;
  function beep(freq, ms) {
    try {
      if (!AC) { var Ctor = window.AudioContext || window.webkitAudioContext; if (!Ctor) return; AC = new Ctor(); }
      if (AC.state === "suspended") AC.resume();
      var o = AC.createOscillator(), g = AC.createGain();
      o.type = "square"; o.frequency.value = freq;
      g.gain.setValueAtTime(0.06, AC.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + ms / 1000);
      o.connect(g); g.connect(AC.destination);
      o.start(); o.stop(AC.currentTime + ms / 1000 + 0.02);
    } catch (e) {}
  }

  /* ---------------- track: closed Catmull-Rom loop ---------------- */
  var CONTROL = [
    [150, 150], [350, 88], [600, 88], [800, 140], [862, 300],
    [760, 432], [560, 470], [400, 542], [200, 522], [88, 380], [100, 230]
  ];
  var PTS = [], SEG_LEN = [], TRACK_LEN = 0, NSEG = 0;
  function catmull(p0, p1, p2, p3, t) {
    var t2 = t * t, t3 = t2 * t;
    return [
      0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
      0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
    ];
  }
  (function buildTrack() {
    var n = CONTROL.length, i, j, p;
    for (i = 0; i < n; i++) {
      var p0 = CONTROL[(i - 1 + n) % n], p1 = CONTROL[i], p2 = CONTROL[(i + 1) % n], p3 = CONTROL[(i + 2) % n];
      for (j = 0; j < 20; j++) { p = catmull(p0, p1, p2, p3, j / 20); PTS.push({ x: p[0], y: p[1] }); }
    }
    NSEG = PTS.length;
    var acc = 0;
    for (i = 0; i < NSEG; i++) {
      var a = PTS[i], b = PTS[(i + 1) % NSEG];
      var dx = b.x - a.x, dy = b.y - a.y, L = Math.sqrt(dx * dx + dy * dy) || 0.0001;
      SEG_LEN.push(L); acc += L;
    }
    TRACK_LEN = acc;
  })();
  // s in [0,1) -> interpolated frame {x,y,ang,nx,ny}
  function queryAt(s) {
    s = ((s % 1) + 1) % 1;
    var target = s * TRACK_LEN, i = 0, acc = 0;
    while (i < NSEG - 1 && acc + SEG_LEN[i] < target) { acc += SEG_LEN[i]; i++; }
    var a = PTS[i], b = PTS[(i + 1) % NSEG];
    var t = SEG_LEN[i] ? (target - acc) / SEG_LEN[i] : 0;
    var x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
    var ang = Math.atan2(b.y - a.y, b.x - a.x);
    return { x: x, y: y, ang: ang, nx: -Math.sin(ang), ny: Math.cos(ang), seg: i };
  }
  // nearest track frame to (x,y), searching around a hint segment
  function nearest(x, y, hint) {
    var best = null, k, i, a, b, px, py, dx, dy, t, d2;
    for (k = -14; k <= 14; k++) {
      i = (((hint + k) % NSEG) + NSEG) % NSEG;
      a = PTS[i]; b = PTS[(i + 1) % NSEG];
      px = x - a.x; py = y - a.y;
      dx = b.x - a.x; dy = b.y - a.y;
      var L2 = dx * dx + dy * dy || 1;
      t = clamp((px * dx + py * dy) / L2, 0, 1);
      var qx = a.x + dx * t, qy = a.y + dy * t;
      var ex = x - qx, ey = y - qy;
      d2 = ex * ex + ey * ey;
      if (!best || d2 < best.d2) {
        var ang = Math.atan2(dy, dx);
        best = { d2: d2, dist: Math.sqrt(d2), seg: i, t: t, qx: qx, qy: qy,
                 lat: ex * -Math.sin(ang) + ey * Math.cos(ang), ang: ang,
                 s: (cumLen(i) + Math.sqrt((qx - a.x) * (qx - a.x) + (qy - a.y) * (qy - a.y))) / TRACK_LEN };
      }
    }
    return best;
  }
  var CUM = null;
  function cumLen(i) {
    if (!CUM) { CUM = [0]; var a = 0; for (var k = 0; k < NSEG; k++) { a += SEG_LEN[k]; CUM.push(a); } }
    return CUM[i];
  }

  /* ---------------- static prerender (floor + track) ---------------- */
  var BOOSTS = [{ s0: 0.16, s1: 0.20 }, { s0: 0.62, s1: 0.665 }];
  var OILS = [{ s: 0.33, lat: -20 }, { s: 0.47, lat: 26 }, { s: 0.83, lat: -8 }];
  var staticLayer = document.createElement("canvas");
  staticLayer.width = W; staticLayer.height = H;
  (function paintStatic() {
    var g = staticLayer.getContext("2d"), i, f;
    // steel floor
    var bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#14171c"); bg.addColorStop(0.5, "#101318"); bg.addColorStop(1, "#0c0e12");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(255,255,255,0.045)"; g.lineWidth = 1;
    for (i = 0; i <= W; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, H); g.stroke(); }
    for (i = 0; i <= H; i += 64) { g.beginPath(); g.moveTo(0, i); g.lineTo(W, i); g.stroke(); }
    g.fillStyle = "rgba(255,255,255,0.06)";
    for (i = 32; i < W; i += 64) for (var j = 32; j < H; j += 64) { g.beginPath(); g.arc(i, j, 1.6, 0, 7); g.fill(); }
    // rail bed (wide dark stroke) then asphalt
    function strokePath(width, style) {
      g.strokeStyle = style; g.lineWidth = width; g.lineJoin = "round"; g.lineCap = "round";
      g.beginPath(); g.moveTo(PTS[0].x, PTS[0].y);
      for (var k = 1; k <= NSEG; k++) { var p = PTS[k % NSEG]; g.lineTo(p.x, p.y); }
      g.closePath(); g.stroke();
    }
    strokePath(HALF_W * 2 + 16, "#3d434c");           // steel rail
    strokePath(HALF_W * 2 + 16, "#565e68");           // rail highlight (overdrawn center next)
    strokePath(HALF_W * 2 + 8, "#33373d");
    strokePath(HALF_W * 2, "#22252a");                // asphalt
    strokePath(HALF_W * 2 - 14, "#26292f");
    // rail rivets: dots along both edges
    g.fillStyle = "#7c8590";
    for (i = 0; i < NSEG; i += 6) {
      f = queryAt(i / NSEG);
      g.beginPath(); g.arc(f.x + f.nx * (HALF_W + 6), f.y + f.ny * (HALF_W + 6), 1.8, 0, 7); g.fill();
      g.beginPath(); g.arc(f.x - f.nx * (HALF_W + 6), f.y - f.ny * (HALF_W + 6), 1.8, 0, 7); g.fill();
    }
    // center dashes
    g.strokeStyle = "rgba(230,236,242,0.5)"; g.lineWidth = 3; g.setLineDash([20, 30]);
    g.beginPath(); g.moveTo(PTS[0].x, PTS[0].y);
    for (i = 1; i <= NSEG; i++) { var q = PTS[i % NSEG]; g.lineTo(q.x, q.y); }
    g.closePath(); g.stroke(); g.setLineDash([]);
    // start/finish checker
    var st = queryAt(0);
    g.save(); g.translate(st.x, st.y); g.rotate(st.ang);
    for (var r = -3; r < 3; r++) for (var c = 0; c < 2; c++) {
      g.fillStyle = ((r + c) % 2 === 0) ? "#e8edf3" : "#14161a";
      g.fillRect(c * 8 - 8, r * (HALF_W / 3), 8, HALF_W / 3);
    }
    g.restore();
    // boost pads
    BOOSTS.forEach(function (b) {
      var mid = queryAt((b.s0 + b.s1) / 2);
      g.save(); g.translate(mid.x, mid.y); g.rotate(mid.ang);
      var len = (b.s1 - b.s0) * TRACK_LEN;
      g.fillStyle = "rgba(64,200,255,0.30)";
      g.fillRect(-len / 2, -HALF_W + 8, len, HALF_W * 2 - 16);
      g.strokeStyle = "rgba(150,225,255,0.9)"; g.lineWidth = 2;
      for (var k2 = -2; k2 <= 2; k2++) {
        g.beginPath(); g.moveTo(-len / 2 + 6, k2 * (HALF_W - 10) / 2.4);
        g.lineTo(len / 2 - 6, k2 * (HALF_W - 10) / 2.4); g.stroke();
      }
      g.restore();
    });
    // oil slicks
    OILS.forEach(function (o) {
      var p2 = queryAt(o.s);
      var ox = p2.x + p2.nx * o.lat, oy = p2.y + p2.ny * o.lat;
      g.save(); g.translate(ox, oy); g.rotate(p2.ang);
      g.fillStyle = "rgba(8,8,10,0.85)";
      g.beginPath(); g.ellipse(0, 0, 26, 13, 0, 0, 7); g.fill();
      g.fillStyle = "rgba(90,60,140,0.35)";
      g.beginPath(); g.ellipse(-6, -3, 10, 5, 0.4, 0, 7); g.fill();
      g.restore();
    });
  })();

  /* ---------------- cars ---------------- */
  var AI_DEFS = [
    { color: "#c0392b", dark: "#7b241c", off: -30, base: 258 },
    { color: "#2471a3", dark: "#154360", off: 0, base: 266 },
    { color: "#1e8449", dark: "#145a32", off: 30, base: 250 }
  ];
  function drawCar(g, x, y, ang, main, dark, glow) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = "rgba(0,0,0,0.45)";
    g.beginPath(); g.ellipse(2, 3, 24, 13, 0, 0, 7); g.fill();
    if (glow) {
      var hg = g.createRadialGradient(30, 0, 2, 30, 0, 46);
      hg.addColorStop(0, "rgba(190,230,255,0.35)"); hg.addColorStop(1, "rgba(190,230,255,0)");
      g.fillStyle = hg; g.beginPath(); g.arc(30, 0, 46, 0, 7); g.fill();
    }
    // wheels
    g.fillStyle = "#0a0b0d";
    [[13, -11], [13, 9], [-13, -11], [-13, 9]].forEach(function (w) { g.fillRect(w[0] - 6, w[1] - 3, 12, 6); });
    // steel body
    var bg2 = g.createLinearGradient(0, -11, 0, 11);
    bg2.addColorStop(0, "#f4f7fa"); bg2.addColorStop(0.35, main);
    bg2.addColorStop(0.65, dark); bg2.addColorStop(1, "#101215");
    g.fillStyle = bg2;
    g.beginPath();
    g.moveTo(23, 0); g.lineTo(12, -9); g.lineTo(-8, -11); g.lineTo(-19, -8);
    g.lineTo(-19, 8); g.lineTo(-8, 11); g.lineTo(12, 9); g.closePath(); g.fill();
    g.strokeStyle = "rgba(0,0,0,0.6)"; g.lineWidth = 1.5; g.stroke();
    // nose stripe + cockpit
    g.fillStyle = "rgba(255,255,255,0.85)"; g.fillRect(-2, -2.2, 20, 4.4);
    var cg = g.createLinearGradient(0, -6, 0, 6);
    cg.addColorStop(0, "#9fb6cc"); cg.addColorStop(1, "#2c3a48");
    g.fillStyle = cg;
    g.beginPath(); g.ellipse(-4, 0, 8, 5.5, 0, 0, 7); g.fill();
    g.strokeStyle = "#0d1117"; g.lineWidth = 1.5; g.stroke();
    g.restore();
  }

  /* ---------------- state ---------------- */
  var input = { up: false, down: false, left: false, right: false };
  var player, ais, particles, skids;
  var state = "count";           // count | run | pause | done
  var countT = 0, countStep = -1;
  var raceT = 0, lapStart = 0, lastLap = 0;
  var best = loadBest();
  var wrongT = 0, lastS = 0, spinT = 0, bumpCd = 0;
  var finishInfo = null;

  function gridSpot(s, lat) { var f = queryAt(s); return { x: f.x + f.nx * lat, y: f.y + f.ny * lat, a: f.ang }; }
  function reset(full) {
    var g0 = gridSpot(0.965, -30);
    player = { x: g0.x, y: g0.y, a: g0.a, vx: 0, vy: 0, lap: 1, gate: false, s: 0.965, hint: Math.floor(0.965 * NSEG), off: false };
    ais = AI_DEFS.map(function (d, i) {
      var s0 = 0.972 + i * 0.004, gg = gridSpot(s0, d.off * 0.7);
      return { x: gg.x, y: gg.y, a: gg.a, s: s0, lap: 1, gate: false, def: d, wob: Math.random() * 6.28, v: 0 };
    });
    particles = []; skids = [];
    raceT = 0; lapStart = 0; lastLap = 0; wrongT = 0; lastS = 0.965; spinT = 0; finishInfo = null;
    countT = 0; countStep = -1; state = full === "go" ? state : "count";
    if (full === true) { state = "count"; }
    showMsg("3", "");
    updateHud();
  }
  function progressOf(r) { return (r.lap - 1) + r.s; }
  function playerRank() {
    var me = progressOf(player), r = 1, i;
    for (i = 0; i < ais.length; i++) if (progressOf(ais[i]) > me + 0.0005) r++;
    return r;
  }

  /* ---------------- messages / HUD ---------------- */
  function showMsg(big, sub, btn) {
    elMsg.innerHTML = "";
    elMsg.hidden = false;
    if (big) { var b = document.createElement("div"); b.className = "sr-big"; b.textContent = big; elMsg.appendChild(b); }
    if (sub) { var s = document.createElement("div"); s.className = "sr-sub"; s.textContent = sub; elMsg.appendChild(s); }
    if (btn) {
      var w = document.createElement("button"); w.type = "button"; w.textContent = btn.label;
      w.onclick = function () { btn.fn(); };
      elMsg.appendChild(w);
    }
  }
  function hideMsg() { elMsg.hidden = true; elMsg.innerHTML = ""; }
  function updateHud() {
    elLap.textContent = Math.min(player.lap, TOTAL_LAPS) + "/" + TOTAL_LAPS;
    elTime.textContent = fmtTime(raceT * 1000);
    elPos.textContent = "P" + playerRank();
    var sp = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
    elSpeed.textContent = Math.round(sp * 0.55);
  }

  /* ---------------- physics ---------------- */
  var ACCEL = 300, BOOST_A = 520, MAXV = 345, OFFMAX = 150, TURN = 2.5;
  function stepPlayer(dt) {
    var p = player;
    var locked = (state !== "run");
    var throt = (!locked && input.up) ? 1 : 0;
    var brake = (!locked && input.down) ? 1 : 0;
    var steer = (!locked) ? ((input.left ? -1 : 0) + (input.right ? 1 : 0)) : 0;
    if (spinT > 0) { spinT -= dt; steer = 1; throt = 0; }

    var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    // steering scales with speed
    var grip = clamp(sp / 120, 0, 1);
    p.a += steer * TURN * grip * dt * (sp > 8 ? 1 : 0) * (sp < 200 ? 1 : 0.75);

    var fx = Math.cos(p.a), fy = Math.sin(p.a);
    var onBoost = false, i, b;
    for (i = 0; i < BOOSTS.length; i++) {
      b = BOOSTS[i];
      if (p.s > b.s0 && p.s < b.s1 && !p.off) { onBoost = true; break; }
    }
    var aNow = throt * (onBoost ? BOOST_A : ACCEL);
    p.vx += fx * aNow * dt; p.vy += fy * aNow * dt;
    if (brake) { p.vx -= p.vx * 2.4 * dt; p.vy -= p.vy * 2.4 * dt; if (sp < 40) { p.vx -= fx * 120 * dt; p.vy -= fy * 120 * dt; } }

    // grip: kill lateral slide, keep some drift
    var fvx = fx * (p.vx * fx + p.vy * fy), fvy = fy * (p.vx * fx + p.vy * fy);
    var lvx = p.vx - fvx, lvy = p.vy - fvy;
    var latSp = Math.sqrt(lvx * lvx + lvy * lvy);
    var keep = p.off ? 0.86 : 0.90;
    p.vx = fvx + lvx * Math.pow(keep, dt * 60);
    p.vy = fvy + lvy * Math.pow(keep, dt * 60);

    // drag + caps
    var cap = p.off ? OFFMAX : (onBoost ? MAXV + 60 : MAXV);
    var drag = p.off ? 1.6 : 0.35;
    p.vx -= p.vx * drag * dt; p.vy -= p.vy * drag * dt;
    sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (sp > cap) { p.vx *= cap / sp; p.vy *= cap / sp; sp = cap; }

    p.x += p.vx * dt; p.y += p.vy * dt;

    // track relation
    var nr = nearest(p.x, p.y, p.hint);
    p.hint = nr.seg; p.off = nr.dist > HALF_W + 2;
    var prevS = p.s; p.s = nr.s;
    var ds = p.s - prevS;
    if (ds > 0.5) ds -= 1; if (ds < -0.5) ds += 1;
    if (sp > 60) { if (ds < -0.00002) wrongT += dt; else wrongT = Math.max(0, wrongT - dt * 2); }
    // gates + laps
    if (p.s > 0.4 && p.s < 0.6) p.gate = true;
    if (prevS > 0.9 && p.s < 0.1 && p.gate && state === "run") {
      p.gate = false;
      var now = raceT, lt = now - lapStart;
      lapStart = now; lastLap = lt;
      if (!best.lap || lt < best.lap) { best.lap = lt; saveBest(best); }
      if (p.lap >= TOTAL_LAPS) { finishRace(); return; }
      p.lap++;
      beep(880, 120);
    }
    // oil slicks
    if (bumpCd > 0) bumpCd -= dt;
    for (i = 0; i < OILS.length; i++) {
      var op = queryAt(OILS[i].s);
      var ox = op.x + op.nx * OILS[i].lat, oy = op.y + op.ny * OILS[i].lat;
      var ex = p.x - ox, ey = p.y - oy;
      if (ex * ex + ey * ey < 26 * 26 && sp > 90 && spinT <= 0 && bumpCd <= 0) {
        spinT = 0.7; bumpCd = 1.2;
        p.vx *= 0.45; p.vy *= 0.45;
        burst(p.x, p.y, 14, "#b9a7ff");
        beep(160, 200);
      }
    }
    // AI bumps
    for (i = 0; i < ais.length; i++) {
      var q = ais[i], ddx = p.x - q.x, ddy = p.y - q.y;
      var dd = Math.sqrt(ddx * ddx + ddy * ddy);
      if (dd < 30 && dd > 0.01) {
        var push = (30 - dd) * 6;
        p.vx += (ddx / dd) * push; p.vy += (ddy / dd) * push;
        if (bumpCd <= 0) { burst(p.x, p.y, 8, "#ffd27a"); beep(220, 90); bumpCd = 0.4; }
      }
    }
    // sparks: boost / off-track / drift
    if ((onBoost && sp > 200) || p.off || latSp > 130) {
      var sx = p.x - Math.cos(p.a) * 20, sy = p.y - Math.sin(p.a) * 20;
      burst(sx, sy, 2, onBoost ? "#7adcff" : (p.off ? "#c8ccd2" : "#ffb14e"));
      if (latSp > 130 || p.off) {
        skids.push({ x1: sx, y1: sy, x2: sx - p.vx * 0.03, y2: sy - p.vy * 0.03, life: 1 });
        if (skids.length > 420) skids.splice(0, skids.length - 420);
      }
    }
  }
  function stepAI(dt, q) {
    var me = progressOf(player), pr = progressOf(q);
    var target = q.def.base + clamp((me - pr) * 60, -36, 36);
    q.v += clamp(target - q.v, -260 * dt, 200 * dt);
    q.s += (q.v * dt) / TRACK_LEN;
    if (q.s >= 1) { q.s -= 1; if (q.gate) { q.gate = false; q.lap++; } }
    if (q.s < 0) q.s += 1;
    if (q.s > 0.4 && q.s < 0.6) q.gate = true;
    q.wob += dt * 0.9;
    var lat = q.def.off + Math.sin(q.wob) * 9;
    var f = queryAt(q.s);
    var tx = f.x + f.nx * lat, ty = f.y + f.ny * lat;
    q.x += (tx - q.x) * Math.min(1, dt * 7);
    q.y += (ty - q.y) * Math.min(1, dt * 7);
    q.a = angLerp(q.a, f.ang, Math.min(1, dt * 8));
  }
  function burst(x, y, n, color) {
    for (var i = 0; i < n; i++) {
      if (particles.length > 320) particles.shift();
      var a = Math.random() * 6.283, sp = 40 + Math.random() * 160;
      particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.4, c: color });
    }
  }
  function finishRace() {
    state = "done";
    var total = raceT;
    if (!best.total || total < best.total) { best.total = total; saveBest(best); }
    finishInfo = { total: total, pos: playerRank() };
    beep(660, 140); setTimeout(function () { beep(880, 200); }, 160);
    var sub = "P" + finishInfo.pos + " · total " + fmtTime(total * 1000) + " · last lap " + fmtTime(lastLap * 1000) +
      " · best lap " + fmtTime(best.lap * 1000);
    showMsg("FINISH", sub, { label: "RACE AGAIN (R)", fn: function () { reset(true); } });
  }

  /* ---------------- render ---------------- */
  function render() {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(staticLayer, 0, 0);
    var i;
    // skid marks
    ctx.strokeStyle = "rgba(10,10,12,0.5)"; ctx.lineWidth = 5; ctx.lineCap = "round";
    for (i = 0; i < skids.length; i++) {
      var s = skids[i];
      ctx.globalAlpha = 0.5 * s.life;
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
      s.life -= 0.008;
    }
    ctx.globalAlpha = 1;
    while (skids.length && skids[0].life <= 0) skids.shift();
    // cars: AIs then player
    for (i = 0; i < ais.length; i++) drawCar(ctx, ais[i].x, ais[i].y, ais[i].a, ais[i].def.color, ais[i].def.dark, false);
    drawCar(ctx, player.x, player.y, player.a, "#c7ccd4", "#5d646e", true);
    // particles
    for (i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      ctx.globalAlpha = clamp(p.life * 2, 0, 1);
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
    // wrong way
    if (state === "run" && wrongT > 1.2) {
      ctx.save();
      ctx.fillStyle = "rgba(180,30,30,0.92)";
      ctx.font = "900 34px 'Segoe UI', Arial, sans-serif";
      ctx.textAlign = "center";
      var blink = (Math.floor(raceT * 4) % 2 === 0) ? 1 : 0.35;
      ctx.globalAlpha = blink;
      ctx.fillText("⚠ WRONG WAY ⚠", W / 2, 120);
      ctx.restore();
    }
  }
  function stepParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= (1 - 3 * dt); p.vy *= (1 - 3 * dt);
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  /* ---------------- main loop ---------------- */
  var lastT = 0, rafId = 0;
  function frame(t) {
    if (state === "dead") return;
    rafId = requestAnimationFrame(frame);
    if (!lastT) lastT = t;
    var dt = Math.min(0.033, (t - lastT) / 1000);
    lastT = t;
    if (state === "count") {
      countT += dt;
      var step = Math.floor(countT);
      if (step !== countStep && step < 3) {
        countStep = step;
        showMsg(String(3 - step), "get ready…");
        beep(440, 110);
      }
      if (countT >= 3) {
        state = "run"; raceT = 0; lapStart = 0; hideMsg(); beep(880, 260);
      }
    } else if (state === "run") {
      raceT += dt;
      stepPlayer(dt);
      for (var i = 0; i < ais.length; i++) stepAI(dt, ais[i]);
      stepParticles(dt);
    } else if (state === "done" || state === "pause") {
      stepParticles(dt);
    }
    if (state === "run" || state === "count") updateHud();
    render();
  }

  /* ---------------- input ---------------- */
  var KEYMAP = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };
  function onKeyDown(e) {
    if (KEYMAP[e.code]) { input[KEYMAP[e.code]] = true; e.preventDefault(); }
    else if (e.code === "KeyR") reset(true);
    else if (e.code === "KeyP" || e.code === "Escape") togglePause();
  }
  function onKeyUp(e) { if (KEYMAP[e.code]) { input[KEYMAP[e.code]] = false; e.preventDefault(); } }
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
  function togglePause() {
    if (state === "run") {
      state = "pause";
      showMsg("PAUSED", "press P to resume", { label: "RESUME", fn: togglePause });
    } else if (state === "pause") { state = "run"; hideMsg(); }
  }
  function bindTouch(id, key) {
    var b = document.getElementById(id);
    if (!b) return;
    function on(e) { e.preventDefault(); input[key] = true; b.classList.add("sr-on"); }
    function off(e) { e.preventDefault(); input[key] = false; b.classList.remove("sr-on"); }
    b.addEventListener("pointerdown", on);
    b.addEventListener("pointerup", off);
    b.addEventListener("pointercancel", off);
    b.addEventListener("pointerleave", off);
  }
  bindTouch("sr-tleft", "left"); bindTouch("sr-tright", "right");
  bindTouch("sr-tgas", "up"); bindTouch("sr-tbrake", "down");
  document.addEventListener("touchstart", function () {
    try { document.body.classList.add("sr-hastouch"); } catch (e) {}
  }, { passive: true });
  if (window.matchMedia && window.matchMedia("(pointer:coarse)").matches) {
    try { document.body.classList.add("sr-hastouch"); } catch (e2) {}
  }
  btnPause.onclick = function () { togglePause(); };
  btnRestart.onclick = function () { reset(true); };
  document.addEventListener("visibilitychange", function () {
    try { if (document.hidden && state === "run") togglePause(); } catch (e) {}
  });

  /* ---------------- go ---------------- */
  reset(false);
  state = "count";
  // smoke-test hook: {state, lap, pos, fps-ish}
  window.__racerState = function () {
    return { ok: true, v: 1, state: state, lap: player ? player.lap : 0, pos: playerRank(),
             t: Math.round(raceT), ais: ais ? ais.length : 0 };
  };
  // test harness hook: stops the loop and detaches input (the admin iframe needs none of this,
  // unloading the iframe stops it on its own).
  window.__racerDestroy = function () {
    try { state = "dead"; } catch (e0) {}
    try { if (rafId) cancelAnimationFrame(rafId); } catch (e1) {}
    try { document.removeEventListener("keydown", onKeyDown); } catch (e2) {}
    try { document.removeEventListener("keyup", onKeyUp); } catch (e3) {}
  };
  requestAnimationFrame(frame);
})();
