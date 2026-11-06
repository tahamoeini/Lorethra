export function formatLastEditAgo(stamp) {
  const s = Math.max(0, Math.floor((Date.now() - stamp) / 1000));
  const units = [[60 * 60 * 24 * 30 * 12, "year"], [60 * 60 * 24 * 30, "month"], [60 * 60 * 24, "day"], [60 * 60, "hour"], [60, "minute"]];
  for (const [len, name] of units) {
    if (s >= len) {
      const t = Math.round(s / len);
      return t + " " + name + (t === 1 ? "" : "s") + " ago";
    }
  }
  return s + " second" + (s === 1 ? "" : "s") + " ago";
}

export function initLastEdit() {
  const el = document.getElementById("lastEditEl");
  if (!el) return;
  let stamp = typeof window.generatorLastEditTime === "number" ? window.generatorLastEditTime : null;
  const paint = () => {
    if (stamp !== null) el.textContent = formatLastEditAgo(stamp);
  };
  window.__refreshLastEdit = (t) => {
    if (typeof t === "number") {
      stamp = t;
      paint();
    }
  };
  paint();
  if (stamp === null) {
    fetch("/api/getGeneratorStats?name=" + window.generatorName + "&_=" + Date.now(), { cache: "no-store" }).then((x) => x.json()).then((r) => {
      const t = r && r.data && r.data.lastEditTime;
      if (typeof t === "number") {
        stamp = t;
        paint();
      }
    }).catch(() => {});
  }
  setInterval(paint, 30 * 1000);
}
