export const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

export const roundTo = (n, step) => Math.round(n / step) * step;

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v ?? "");

export const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** "2026-01-12T14:05:00.000Z" -> "12 Jan 2026, 3:05 pm" style display string. */
export function formatDateTime(iso) {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Short month name, e.g. "Jan". */
export function monthName(date) {
  return date.toLocaleString("en-US", { month: "short" });
}

/** Array of the last n month starts (oldest first), each as {year, monthIndex, key, label}. */
export function lastMonths(n = 6, now = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ year: d.getFullYear(), monthIndex: d.getMonth(), key: `${d.getFullYear()}-${d.getMonth()}`, label: monthName(d) });
  }
  return out;
}

export function monthOf(iso) {
  const d = new Date(iso);
  return { year: d.getFullYear(), monthIndex: d.getMonth(), key: `${d.getFullYear()}-${d.getMonth()}` };
}
