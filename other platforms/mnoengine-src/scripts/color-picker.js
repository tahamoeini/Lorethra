// color-picker.js — a hex colour field: a swatch button, a hex text box, and a clear button.
//
// Clicking the swatch opens a small popover (saturation/value square, hue slider, preset row)
// styled with the app theme — the native OS colour panel can't be themed, so this control brings
// its own. Typing accepts `#rgb` / `#rrggbb` (the `#` is optional while typing). The caller owns
// the data — the committed value is always the trimmed text ("" means "the default"), and anything
// the popover produces is `#rrggbb`. A blank or unparseable value renders the swatch as a
// checkerboard, so "no colour" is visible, not broken.
//
// Used by the world editor's tracker colour fields (hero + NPC trackers) so both are literally the
// same control rather than two lookalikes that drift apart:
//
//   const picker = new ColorPicker({
//     value: t.color, placeholder: "#bd2d2d", title: "Bar color — hex like #bd2d2d",
//     onInput: (hex) => { t.color = hex; markTouched(); refreshPip(); }
//   });
//   mountEl.replaceWith(picker.el);
//   ...
//   picker.sync(arr[i].color); // external update without firing onInput
const PRESETS = [
  "#bd2d2d", "#e97834", "#ffc330", "#aadb4f", "#43a157", "#90daf5", 
  "#6666f0", "#884dc6", "#ff3d8d", "#5e5959", "#969aa3", "#ffffff", 
];

export class ColorPicker {
  constructor(opts = {}) {
    const {
      value = "", placeholder = "#rrggbb", title = "",
      onInput = null, swatchTitle = "Pick a color"
    } = opts;
    this.onInput = onInput;
    this.open = false;

    const el = document.createElement("div");
    el.className = "colorpicker";
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "cp-swatch";
    swatch.title = swatchTitle;
    const hex = document.createElement("input");
    hex.type = "text";
    hex.className = "cp-hex";
    hex.placeholder = placeholder;
    hex.title = title;
    hex.autocomplete = "off";
    hex.spellcheck = false;
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "cp-clear";
    clear.textContent = "✕";
    clear.title = "Clear (use the default color)";
    const wrap = document.createElement("span");
    wrap.className = "cp-wrap";
    wrap.append(hex, clear);
    el.append(swatch, wrap);

    const pop = document.createElement("div");
    pop.className = "cp-pop";
    pop.hidden = true;
    const sv = document.createElement("div");
    sv.className = "cp-sv";
    const cur = document.createElement("span");
    cur.className = "cp-svcur";
    sv.appendChild(cur);
    const hueWrap = document.createElement("div");
    hueWrap.className = "cp-huewrap";
    hueWrap.tabIndex = 0;
    hueWrap.setAttribute("role", "slider");
    hueWrap.setAttribute("aria-label", "Hue");
    hueWrap.setAttribute("aria-valuemin", "0");
    hueWrap.setAttribute("aria-valuemax", "360");
    hueWrap.setAttribute("aria-valuenow", "0");
    const hueRail = document.createElement("div");
    hueRail.className = "cp-huerail";
    const hueMk = document.createElement("span");
    hueMk.className = "cp-huemk";
    hueWrap.append(hueRail, hueMk);
    const pres = document.createElement("div");
    pres.className = "cp-pres";
    for (const p of PRESETS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cp-pre";
      b.style.background = p;
      b.title = p;
      b.onclick = () => { this.commit(p); };
      pres.appendChild(b);
    }
    pop.append(sv, hueWrap, pres);
    el.appendChild(pop);

    this.el = el;
    this.swatch = swatch;
    this.input = hex;
    this.pop = pop;
    this.sv = sv;
    this.svcur = cur;
    this.hueWrap = hueWrap;
    this.huemk = hueMk;
    this.hsv = { h: 0, s: 1, v: 1 };

    hex.addEventListener("input", () => {
      this.paint();
      this.syncPanel();
      if (this.onInput) this.onInput(hex.value.trim());
    });
    swatch.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!this.open) this.show();
    });
    // The hue rail is driven directly from the pointer (no native range input): the OS
    // thumb's inset travel would otherwise offset clicks away from the marker.
    let hueDrag = false;
    const pickHue = (e) => {
      const r = hueWrap.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      this.hsv.h = t * 360;
      this.paintSv();
      this.commit(ColorPicker.hsvToHex(this.hsv.h, this.hsv.s, this.hsv.v));
    };
    hueWrap.addEventListener("pointerdown", (e) => {
      hueDrag = true;
      try { hueWrap.setPointerCapture(e.pointerId); } catch (err) { /* synthetic event — no capture */ }
      pickHue(e);
    });
    hueWrap.addEventListener("pointermove", (e) => { if (hueDrag) pickHue(e); });
    const endHueDrag = () => { hueDrag = false; };
    hueWrap.addEventListener("pointerup", endHueDrag);
    hueWrap.addEventListener("pointercancel", endHueDrag);
    hueWrap.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 10 : 1;
      let h = null;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") h = (this.hsv.h - step + 360) % 360;
      else if (e.key === "ArrowRight" || e.key === "ArrowUp") h = (this.hsv.h + step) % 360;
      else if (e.key === "Home") h = 0;
      else if (e.key === "End") h = 0;
      else return;
      e.preventDefault();
      this.hsv.h = h;
      this.paintSv();
      this.commit(ColorPicker.hsvToHex(this.hsv.h, this.hsv.s, this.hsv.v));
    });
    clear.addEventListener("click", () => {
      hex.value = "";
      this.paint();
      if (this.onInput) this.onInput("");
      hex.focus();
    });

    let drag = false;
    const pick = (e) => {
      const r = sv.getBoundingClientRect();
      this.hsv.s = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      this.hsv.v = 1 - Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
      this.paintSv();
      this.commit(ColorPicker.hsvToHex(this.hsv.h, this.hsv.s, this.hsv.v));
    };
    sv.addEventListener("pointerdown", (e) => {
      drag = true;
      try { sv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic event — no capture */ }
      pick(e);
    });
    sv.addEventListener("pointermove", (e) => { if (drag) pick(e); });
    const endDrag = () => { drag = false; };
    sv.addEventListener("pointerup", endDrag);
    sv.addEventListener("pointercancel", endDrag);

    this.outside = (e) => {
      if (!this.open || drag || hueDrag) return; // a panel drag never counts as "outside"
      if (!el.contains(e.target)) this.close();
    };
    this.esc = (e) => { if (this.open && e.key === "Escape") { e.stopPropagation(); this.close(); } };
    this.replace = () => this.place(); // scroll/resize re-pin while open (bound: place() needs `this`)

    this.set(value);
  }

  commit(hexValue) {
    this.input.value = hexValue;
    this.paint();
    this.syncPanel();
    if (this.onInput) this.onInput(this.input.value.trim());
  }

  show() {
    this.open = true;
    this.el.classList.add("open");
    this.pop.hidden = false;
    // Float the popover fixed to the viewport (positioned off the swatch) instead of absolute
    // inside the control: inside a scrollable panel an absolute popover stretches the scroll
    // height and scrolls away with the content — fixed, it hovers over the panel and the
    // preview stays visible while picking.
    this.pop.style.position = "fixed";
    this.place();
    const hex = ColorPicker.toHex(this.input.value.trim());
    const hsv = hex ? ColorPicker.hexToHsv(hex) : { h: 95, s: 0.3, v: 0.6 };
    this.hsv = hsv;
    this.paintSv();
    document.addEventListener("pointerdown", this.outside, true);
    document.addEventListener("keydown", this.esc, true);
    window.addEventListener("scroll", this.replace, true);
    window.addEventListener("resize", this.replace);
  }
  // Pin the floating popover to the swatch: below it when there's room, above it when the
  // viewport bottom is too close, clamped horizontally so it never runs off-screen.
  place() {
    if (!this.open) return;
    if (!this.el.isConnected) { this.close(); return; } // host removed (panel closed) — self-clean
    const r = this.swatch.getBoundingClientRect();
    const w = this.pop.offsetWidth || 182, h = this.pop.offsetHeight || 215;
    let left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - 6 - h);
    this.pop.style.left = Math.round(left) + "px";
    this.pop.style.top = Math.round(top) + "px";
  }
  close() {
    this.open = false;
    this.el.classList.remove("open");
    this.pop.hidden = true;
    this.pop.style.position = "";
    this.pop.style.left = "";
    this.pop.style.top = "";
    document.removeEventListener("pointerdown", this.outside, true);
    document.removeEventListener("keydown", this.esc, true);
    window.removeEventListener("scroll", this.replace, true);
    window.removeEventListener("resize", this.replace);
  }

  // "#abc" → "#aabbcc"; "#aabbcc" → itself (lowercased); anything else → "".
  static toHex(raw) {
    const t = String(raw == null ? "" : raw).trim();
    const m = t.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return "";
    let h = m[1].toLowerCase();
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return "#" + h;
  }

  static hsvToHex(h, s, v) {
    h = ((h % 360) + 360) % 360;
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    const n = (f) => Math.round((f + m) * 255).toString(16).padStart(2, "0");
    return "#" + n(r) + n(g) + n(b);
  }

  static hexToHsv(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const d = mx - mn;
    let h = 0;
    if (d) {
      if (mx === r) h = 60 * (((g - b) / d) % 6);
      else if (mx === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
    }
    if (h < 0) h += 360;
    return { h, s: mx ? d / mx : 0, v: mx };
  }

  paint() {
    const hex = ColorPicker.toHex(this.input.value.trim());
    this.swatch.style.background = hex || "";
    this.swatch.classList.toggle("empty", !hex);
    this.input.classList.toggle("bad", !!this.input.value.trim() && !hex);
  }

  paintSv() {
    const { h, s, v } = this.hsv;
    this.sv.style.backgroundColor = `hsl(${Math.round(h)}, 100%, 50%)`;
    this.svcur.style.left = (s * 100) + "%";
    this.svcur.style.top = ((1 - v) * 100) + "%";
    this.paintHue();
  }

  // The marker tracks the true value edge-to-edge (0 = far left = red), not the native
  // thumb's inset travel.
  paintHue() {
    this.huemk.style.left = (Math.min(this.hsv.h, 360) / 360 * 100) + "%";
    if (this.hueWrap) this.hueWrap.setAttribute("aria-valuenow", String(Math.round(this.hsv.h % 360)));
  }

  syncPanel() {
    if (!this.open) return;
    const hex = ColorPicker.toHex(this.input.value.trim());
    if (!hex) return;
    this.hsv = ColorPicker.hexToHsv(hex);
    this.paintSv();
  }

  // External update (a re-render, a preset, a hand-edit elsewhere) — never fires onInput.
  set(v) {
    this.input.value = v == null ? "" : String(v);
    this.paint();
    this.syncPanel();
  }
  sync(v) { this.set(v); }
}
