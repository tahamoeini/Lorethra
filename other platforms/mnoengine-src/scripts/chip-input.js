// chip-input.js — a tag field: a row of chips with an inline text box.
//
// Type a tag and press Enter or `,` to commit it; Backspace in an empty box drops the last chip; ✕ on
// a chip drops that one; a half-typed tag commits on blur. The box is built once and only its chips
// are repainted, so the input keeps focus (and the caret) while you add several tags in a row.
//
// Extracted so the three fields that are this control are literally the same control rather than
// three lookalikes that drift apart: the world editor's `tags` (Basics) and `trigger words` (each
// lorebook entry), and the Settings page's `Blocked tags`.
//
// The caller owns the data:
//   list()      → the live array to mirror (re-read every time, so it may be reassigned)
//   commit(tag) → add one tag; return false to refuse it (the world editor refuses the reserved
//                 markers: "nsfw" belongs to the rating switch, "remix" is fork provenance)
//   remove(tag) → delete one tag
//   split(raw)  → optional; the tags one commit adds, for a field that accepts a comma-separated
//                 paste (the lorebook's trigger words). Default: the whole trimmed string.
//   onSync()    → the caller's own repaint, run after every change (a counter, a switch)
//   onRefuse(t) → a commit was refused, so the caller can explain it
export function createChipInput(opts = {}) {
  const {
    list, commit, remove, split,
    onChange = null, onSync = null, onRefuse = null,
    max = 0, placeholder = "type a tag, Enter to add", fullText = "",
    id = "", removeTitle = "Remove"
  } = opts;

  const box = document.createElement("div");
  box.className = "chipbox";
  if (id) box.id = id;
  const inp = document.createElement("input");
  inp.type = "text";
  inp.autocomplete = "off";
  inp.spellcheck = false;
  box.appendChild(inp);

  const isFull = () => max > 0 && list().length >= max;
  const sync = () => {
    inp.placeholder = isFull() ? (fullText || `max ${max} — remove one to add another`) : placeholder;
  };

  let revertTimer = 0;
  // Show a message in the field itself for a moment, then fall back to the normal placeholder — how a
  // refused "remix" gets explained without a popup.
  const setPlaceholder = (text, revertMs = 0) => {
    clearTimeout(revertTimer);
    inp.placeholder = text;
    if (revertMs) revertTimer = setTimeout(sync, revertMs);
  };

  const afterChange = () => { if (onChange) onChange(); if (onSync) onSync(); sync(); };

  const makeChip = (tag) => {
    const chip = document.createElement("span");
    chip.className = "chipbox-chip";
    chip.textContent = tag;
    const x = document.createElement("button");
    x.type = "button";
    x.className = "chipbox-x";
    x.textContent = "✕";
    x.title = removeTitle;
    x.onclick = () => { remove(tag); repaint(); afterChange(); inp.focus(); };
    chip.appendChild(x);
    return chip;
  };

  // Repaint the chips from `list()`. Cheaper and safer than tracking individual chips: the array is
  // the truth, so the DOM can never disagree with it.
  const repaint = () => {
    for (const c of Array.from(box.querySelectorAll(".chipbox-chip"))) c.remove();
    for (const t of list()) box.insertBefore(makeChip(t), inp);
  };

  // "added" | "empty" | "dup" | "full" | "refused" — only a refusal is worth explaining to the caller.
  const tryAdd = (tag) => {
    const t = String(tag == null ? "" : tag).trim();
    if (!t) return "empty";
    if (list().includes(t)) return "dup";
    if (isFull()) return "full";
    if (commit(t) === false) return "refused";
    return "added";
  };

  const commitInput = () => {
    const raw = inp.value;
    inp.value = "";
    const parts = split ? split(raw) : [raw];
    let refused = null;
    for (const p of parts) {
      if (tryAdd(p) === "refused" && refused === null) refused = String(p).trim();
    }
    repaint();
    afterChange();
    if (refused !== null && onRefuse) onRefuse(refused);
  };

  inp.onkeydown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitInput();
    } else if (e.key === "Backspace" && !inp.value) {
      const tags = list();
      if (!tags.length) return;
      remove(tags[tags.length - 1]);
      repaint();
      afterChange();
    }
  };
  inp.onblur = () => { if (inp.value.trim()) commitInput(); };

  repaint();
  sync();
  return { el: box, input: inp, sync, setPlaceholder, repaint };
}
