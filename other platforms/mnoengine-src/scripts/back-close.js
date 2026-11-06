// back-close.js — make the device/browser Back button (and the mobile back gesture) close modal
// overlays instead of navigating the page away.
//
// An overlay registers its close function with pushBackClose() when it opens; that pushes one
// history entry tagged with a unique token. A Back press pops that entry and invokes the topmost
// overlay's close. Overlays stack LIFO, so a ConfirmPopup opened over a panel is closed first, and
// each Back closes exactly one overlay.
//
// Every programmatic close path (✕ / backdrop / Escape / any teardown) MUST call the release()
// function pushBackClose() returns, so the history entry it pushed is consumed and the stack stays
// balanced — otherwise a stale entry is left behind and the next Back press is a silent no-op.
//
// If an overlay's close() decides NOT to close (returns false — e.g. the World Editor's "discard
// changes?" confirm is declined), the helper re-pushes its entry so it stays Back-closeable.
//
// TOKENS: history.back() is asynchronous, so a release() can race with the NEXT overlay's
// pushState (a natural flow is picker → name popup → editor). Each entry therefore carries a unique
// token in its history state; release() only calls history.back() when OUR entry is still the
// current one (history.state.__bid === entry.token). If a queued back already popped past us, we
// must NOT call back() again — doing so would pop a later entry and even navigate the page away.

const stack = []; // open overlays in open order: { close, owns, state, token }
let suppress = 0; // # of self-initiated history.back() calls whose popstate must be ignored
let nextToken = 1;
let lastPopAt = 0; // when the last history traversal landed (any popstate, self-initiated or not)

// When the last back/forward traversal landed. The shell reads this to tell a genuine traversal
// (popstate + hashchange together) from a bare fragment assignment (hashchange alone): the platform
// applies forwarded hashes with `window.location.hash = …`, which fires hashchange with NO popstate.
export function lastPopStateAt() { return lastPopAt; }

async function onPop() {
  lastPopAt = Date.now();
  if (suppress > 0) { suppress--; return; } // our own history.back() — not a user Back press
  const entry = stack[stack.length - 1];
  if (!entry) return; // nothing of ours is open — let the browser navigate normally
  // A popstate whose history state is STILL ours did not actually pop our entry — that is the stray
  // event a fragment write can emit inside a generator (perchance's <base> makes a relative fragment
  // resolve cross-origin, so the write bounces and emits a history event without trimming history).
  // Then the view's own `closeOnPop` gets the final say. Both guards exist so an address-bar edit or a
  // followed link can't dismiss a view the player is still looking at.
  const cur = history.state;
  if (cur && cur.__bid === entry.token) return;
  if (entry.closeOnPop && !entry.closeOnPop()) return;
  entry.owns = false; // the browser already popped this overlay's entry
  let closed = true;
  try { closed = await entry.close(); } catch (e) {}
  if (closed === false && stack.includes(entry)) {
    // The close was declined — re-push the entry so it stays Back-closeable (with the same marker).
    try { history.pushState(entry.state, "", location.href); entry.owns = true; } catch (e) {}
  } else {
    // Successful Back close: drop the entry from the stack. Overlays that call release() inside
    // close() already spliced themselves (splice is idempotent); bridge closes (session/user) and
    // no-op landing entries never call release(), so without this they linger as stale top entries
    // and misfire on the NEXT Back press (a landing pop gets mistaken for a session pop and yanks
    // back into the chat, or the same close runs twice — the "reload twice" double-mount).
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
  }
}

window.addEventListener("popstate", onPop);

// Register `close` as the topmost overlay (and push its history entry). Returns release(): call it
// from every programmatic close path. Safe to call once per overlay, including from within the
// Back-triggered close.
//
// opts.state: extra history-entry state (defaults to an overlay marker). Give a non-overlay view
//   (e.g. the chat/session) its own marker so it can be recognized after a reload.
// opts.adopt: when true and the CURRENT history entry already carries the same marker, reuse it
//   instead of pushing a duplicate — this keeps reload from accumulating stale entries.
// opts.reuse: when true, take over the CURRENT overlay entry instead of pushing a new one — for a view
//   replacing another of its own kind (see the `forget()` note on release() below).
// opts.closeOnPop: a predicate answering "should a Back dismiss this view right now?". Default: always.
//   A view whose existence the URL itself encodes (the Explore details panel, §6.14) returns false when
//   the URL still names that content — a fragment write can fire a stray popstate without any traversal
//   (see onPop), and the predicate lets the view survive it while still closing on a real Back.
export function pushBackClose(close, opts = {}) {
  const token = "bc" + (nextToken++);
  const base = opts.state || { __overlay: true };
  const state = Object.assign({}, base, { __bid: token });
  const entry = { close, owns: true, state, token, closeOnPop: typeof opts.closeOnPop === "function" ? opts.closeOnPop : null };
  stack.push(entry);
  const adoptable = opts.adopt && base.__mno && history.state && history.state.__mno === base.__mno;
  // `reuse`: take over the CURRENT entry instead of stacking another, for a view replacing another of
  // its own kind (a panel swapped for a panel, §6.14). The outgoing view must have given its entry up
  // with `release.forget()` first (not `release()`, which pops it) — this then rewrites that entry's
  // marker to ours, so it becomes ours to consume. One history entry survives the swap, and it keeps
  // describing whatever is on screen.
  const reusable = opts.reuse && history.state && history.state.__overlay === true;
  try {
    if (adoptable || reusable) history.replaceState(state, "", location.href); // reuse the entry we're on
    else history.pushState(state, "", location.href);
  } catch (e) { entry.owns = false; } // history unavailable — Back just won't close this one
  const release = function release() {
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
    if (!entry.owns) return; // browser already consumed it (Back) or the push failed
    entry.owns = false;
    // Consume our entry only if it is still the CURRENT one. A queued history.back() from a prior
    // release may have already popped past us (and a later overlay may now be current) — going back
    // then would pop that later entry and could navigate the page away.
    const s = history.state;
    const isCurrent = !!(s && s.__bid === entry.token);
    if (isCurrent && i === stack.length) {
      suppress++;
      try { history.back(); } catch (e) { suppress = Math.max(0, suppress - 1); }
    }
  };
  // Give up our entry WITHOUT popping it — for an overlay whose entry is being taken over by a
  // replacement (`opts.reuse` above) or dropped as its page unmounts. Splices us out of the stack and
  // stops owning the entry, but leaves the entry (and the URL on it) standing for whoever comes next.
  release.forget = () => {
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
    entry.owns = false;
  };
  return release;
}
