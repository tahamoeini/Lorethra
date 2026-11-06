// Notify — toast + busy-button helpers.
//
// Fire-and-forget UI feedback used all over main.js (and exposed to community.js via
// `mnoApp.notify`). No dependencies: DOM + timers only. Imported by main.js; behavior is
// unchanged from when these lived there.

const $ = (id) => document.getElementById(id);

// The toast element is created on first use, never part of the initial HTML: an always-mounted
// toast renders one unstyled frame before styles.css lands, and its `transition` then animates it
// from visible to hidden — a fading box sliding away on every load. notify() only ever fires from
// post-load user actions, so keeping the element out of the load path fixes that for good.
function ensureToast() {
  let n = $("toastEl");
  if (!n) {
    n = document.createElement("div");
    n.id = "toastEl";
    document.body.appendChild(n);
    // Let the hidden state render once before .show lands, so the first toast fades/slides in
    // like every later one instead of popping in with no transition.
    void n.offsetWidth;
  }
  return n;
}

function notify(msg, opts = {}) {
  const n = ensureToast();
  n.classList.remove("lvlup");
  clearTimeout(n._lvlT);
  n.textContent = msg;
  n.classList.toggle("glow", !!opts.glow);
  n.classList.add("show");
  clearTimeout(n._t);
  n._t = setTimeout(() => n.classList.remove("show"), opts.ms || 2600);
}

// Level-up celebration: the juiced gold toast (hero badge, big title, shine sweep). Same
// fire-and-forget behavior as notify — auto-dismisses, never blocks input.
function notifyLevelUp(lvl, pts) {
  const n = ensureToast();
  clearTimeout(n._t);
  n.classList.remove("glow");
  n.classList.add("lvlup", "show");
  n.innerHTML = `<span class="lvlup-ic"><span class="lvlup-glyph"></span></span><span class="lvlup-tx"><span class="lvlup-t1">LEVEL UP — Level ${lvl}!</span><span class="lvlup-t2">+${pts} stat point${pts === 1 ? "" : "s"} — spend them in the Hero panel.</span></span><span class="lvlup-shine"></span>`;
  clearTimeout(n._lvlT);
  n._lvlT = setTimeout(() => {
    n.classList.remove("show");
    setTimeout(() => { if (!n.classList.contains("show")) n.classList.remove("lvlup"); }, 300);
  }, 5200);
}

// Busy buttons: swap a button's label for the shared inline spinner while an async action runs,
// then restore the original label. Idempotent (a second call while busy is ignored).
function setBusy(btn, label) {
  if (!btn || btn.dataset.busy !== undefined) return;
  btn.dataset.busy = btn.innerHTML;
  btn.disabled = true;
  btn.classList.add("is-loading");
  btn.innerHTML = '<span class="spin spin-sm"></span> ' + label;
}
function clearBusy(btn) {
  if (!btn) return;
  btn.disabled = false;
  btn.classList.remove("is-loading");
  if (btn.dataset.busy !== undefined) { btn.innerHTML = btn.dataset.busy; delete btn.dataset.busy; }
}

export { notify, notifyLevelUp, setBusy, clearBusy };