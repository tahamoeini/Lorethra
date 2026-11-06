export function initUpdateCheck() {
  const bar = document.getElementById("updateBanner");
  if (!bar) return;
  const reloadBtn = document.getElementById("updateReloadBtn");
  const dismissBtn = document.getElementById("updateDismissBtn");
  if (reloadBtn) reloadBtn.onclick = () => window.location.reload();
  if (dismissBtn) dismissBtn.onclick = () => { bar.hidden = true; };
  window.__showUpdateBanner = () => { bar.hidden = false; };
  const POLL_MS = 15 * 60 * 1000;
  const EVENT_MIN_GAP_MS = 60 * 1000;
  let baseline = typeof window.generatorLastEditTime === "number" ? window.generatorLastEditTime : null;
  let checking = false;
  let lastCheck = Date.now();
  const readStamp = async () => {
    try {
      const r = await fetch("/api/getGeneratorStats?name=" + window.generatorName + "&_=" + Date.now(), { cache: "no-store" }).then((x) => x.json());
      const t = r && r.data && r.data.lastEditTime;
      return typeof t === "number" ? t : null;
    } catch (e) { return null; }
  };
  const check = async (isEvent) => {
    if (checking) return false;
    if (isEvent && Date.now() - lastCheck < EVENT_MIN_GAP_MS) return false;
    checking = true;
    lastCheck = Date.now();
    try {
      const cur = await readStamp();
      if (cur === null) return false;
      if (baseline === null) {
        baseline = cur;
        return false;
      }
      if (cur === baseline) return false;
      const confirm = await readStamp();
      if (confirm === null || confirm === baseline) return false;
      baseline = confirm;
      if (typeof window.__refreshLastEdit === "function") window.__refreshLastEdit(confirm);
      bar.hidden = false;
      return true;
    } finally {
      checking = false;
    }
  };
  window.__checkUpdate = check;
  setInterval(() => { check(false); }, POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) check(true);
  });
  window.addEventListener("focus", () => { check(true); });
  window.addEventListener("online", () => { check(true); });
}
