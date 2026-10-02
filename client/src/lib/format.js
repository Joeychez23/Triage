// Formatting helpers: money, relative time, initials, and colors.

const PERIOD_SHORT = { hour: "/hr", day: "/day", week: "/wk", month: "/mo", year: "/yr" };
const ANNUAL_FACTOR = { hour: 2080, day: 260, week: 52, month: 12, year: 1 };

export function money(n, currency = "USD", { compact = true } = {}) {
  if (n == null || !Number.isFinite(n)) return "";
  const useCompact = compact && n >= 10000;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: useCompact ? "compact" : "standard",
      // Whole amounts drop the cents ("$50/hr"); real cents stay ("$45.50").
      minimumFractionDigits: useCompact || n >= 100 || Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: useCompact ? 1 : n >= 100 ? 0 : 2,
    }).format(n);
  } catch {
    return `${currency} ${Math.round(n).toLocaleString()}`;
  }
}

export function salaryText(salary, opts) {
  if (!salary) return "";
  const { min, max, currency = "USD", period = "year" } = salary;
  const suffix = PERIOD_SHORT[period] || "";
  if (min != null && max != null && max !== min) return `${money(min, currency, opts)}–${money(max, currency, opts)}${suffix}`;
  if (min != null) return `${max == null ? "From " : ""}${money(min, currency, opts)}${suffix}`;
  if (max != null) return `Up to ${money(max, currency, opts)}${suffix}`;
  return "";
}

export function annualize(salary) {
  if (!salary || !ANNUAL_FACTOR[salary.period]) return null;
  const f = ANNUAL_FACTOR[salary.period];
  const min = salary.min != null ? salary.min * f : null;
  const max = salary.max != null ? salary.max * f : null;
  if (min == null && max == null) return null;
  const lo = min ?? max;
  const hi = max ?? min;
  return { min: lo, max: hi, mid: (lo + hi) / 2, currency: salary.currency || "USD" };
}

const rtf = typeof Intl !== "undefined" && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }) : null;

export function ago(date, now = Date.now()) {
  if (!date) return "";
  const t = new Date(date).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = (t - now) / 1000;
  const abs = Math.abs(diff);
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, secs] of units) {
    if (abs >= secs) return rtf ? rtf.format(Math.round(diff / secs), unit) : `${Math.round(abs / secs)} ${unit}s ago`;
  }
  return "just now";
}

export function shortDate(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function dateInputValue(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function initials(name) {
  const words = String(name || "?")
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !/^(inc|llc|ltd|corp|co|the)$/i.test(w));
  return (words.length >= 2 ? words[0][0] + words[1][0] : (words[0] || "?").slice(0, 2)).toUpperCase();
}

// Stable hue from a string, for company monograms.
export function hue(text) {
  let h = 2166136261;
  for (const ch of String(text || "")) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return Math.abs(h) % 360;
}

// FNV-1a hash of any JSON-serializable value, as a short string key.
export function hashOf(value) {
  const s = JSON.stringify(value);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

export const pct = (n) => (n == null ? "–" : `${Math.round(n * 100)}%`);
export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
