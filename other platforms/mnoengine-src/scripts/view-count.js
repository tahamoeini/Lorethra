// view-count.js — the landing footer's compact view counter.
// The spot is the static placeholder `#viewCountEl` in index.html. Shows compact
// counts like `100.0k`. Fired once at boot (init()) — fire-and-forget, so it never blocks the app.

const PLACEHOLDER_ID = "viewCountEl";

// `123` → `123`, `1234` → `1.2k`, `188837` → `188.8k`, `2500000` → `2.5M`.
function formatCompact(n) {
  n = Number(n) || 0;
  if (n < 1000) return String(n);
  if (n < 1000000) return (n / 1000).toFixed(1) + "k";
  return (n / 1000000).toFixed(1) + "M";
}

async function fetchViewText() {
  try {
    const res = await fetch("/api/getGeneratorStats?name=" + window.generatorName).then((r) => r.json());
    if (res && res.status === "success" && res.data) return formatCompact(res.data.views || 0);
    return "(" + ((res && res.status) || "error") + ")";
  } catch (e) {
    return "(error)";
  }
}

// Fill the placeholder. The element is static markup, so it normally exists by the time init()
// runs; the short retry only guards against an unexpected ordering.
export function initViewCount() {
  const fill = async (el) => { el.textContent = await fetchViewText(); };
  const el = document.getElementById(PLACEHOLDER_ID);
  if (el) { fill(el); return; }
  let tries = 0;
  const t = setInterval(() => {
    const found = document.getElementById(PLACEHOLDER_ID);
    if (found) { clearInterval(t); fill(found); }
    else if (++tries > 100) clearInterval(t);
  }, 50);
}
