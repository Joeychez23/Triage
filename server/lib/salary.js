// Salary parsing in code. Jev never does the arithmetic: code finds candidate
// pay spans in a description, Jev only selects which span is the pay for the
// role, and code parses and annualizes the chosen span.

const PERIODS = ["hour", "day", "week", "month", "year"];
const ANNUAL_FACTOR = { hour: 2080, day: 260, week: 52, month: 12, year: 1 };

const SYMBOLS = [
  [/(?:CA|C)\$/i, "CAD"],
  [/(?:AU|A)\$/i, "AUD"],
  [/NZ\$/i, "NZD"],
  [/HK\$/i, "HKD"],
  [/S\$/i, "SGD"],
  [/US\$/i, "USD"],
  [/£/, "GBP"],
  [/€/, "EUR"],
  [/₹/, "INR"],
  [/¥/, "JPY"],
  [/\$/, "USD"],
];
const CODES = /\b(USD|CAD|GBP|EUR|AUD|NZD|INR|SGD|HKD|CHF|SEK|NOK|DKK|PLN|MXN|BRL|JPY|ZAR)\b/;

function detectCurrency(text) {
  const code = text.match(CODES);
  if (code) return code[1].toUpperCase();
  for (const [re, cur] of SYMBOLS) if (re.test(text)) return cur;
  return null;
}

function detectPeriod(text) {
  const t = text.toLowerCase();
  if (/(?:\/|\b(?:per|an|a|each))\s*(?:hour|hr|h)\b|\bhourly\b/.test(t)) return "hour";
  if (/(?:\/|\b(?:per|a|each))\s*day\b|\bdaily rate\b|\bper diem\b/.test(t)) return "day";
  if (/(?:\/|\b(?:per|a|each))\s*(?:week|wk)\b|\bweekly\b/.test(t)) return "week";
  if (/(?:\/|\b(?:per|a|each))\s*(?:month|mo)\b|\bmonthly\b/.test(t)) return "month";
  if (/(?:\/|\b(?:per|a|an|each))\s*(?:year|yr|annum)\b|\bannual(ly)?\b|\bp\.a\.|\byearly\b|\bsalary\b/.test(t)) return "year";
  return null;
}

const NUMBER = /(\d{1,3}(?:[,\s]\d{3})+|\d+)(?:\.(\d{1,2}))?\s*([kKmM](?![a-z]))?/g;

function readNumbers(text) {
  const out = [];
  for (const m of text.matchAll(NUMBER)) {
    const whole = Number(m[1].replace(/[,\s]/g, ""));
    if (!Number.isFinite(whole)) continue;
    let value = whole + (m[2] ? Number(`0.${m[2]}`) : 0);
    const suffix = (m[3] || "").toLowerCase();
    if (suffix === "k") value *= 1000;
    if (suffix === "m") value *= 1_000_000;
    out.push({ value, suffix });
  }
  return out;
}

function inferPeriod(value) {
  if (value >= 15000) return "year";
  if (value >= 1500) return "month";
  if (value <= 300) return "hour";
  return null;
}

// Parses a pay string such as "$108,000.00/yr - $216,000.00/yr",
// "$45-55 an hour", or "£40k–£45k". Returns null when it isn't a pay string.
function parseSalaryText(input) {
  const text = String(input || "").replace(/[–—]/g, "-");
  if (!text.trim()) return null;
  const nums = readNumbers(text).filter((n) => n.value > 0);
  if (!nums.length) return null;
  // "$120-150k": the suffix on the second number applies to the first.
  if (nums.length >= 2 && !nums[0].suffix && nums[1].suffix && nums[0].value < 1000) {
    nums[0].value *= nums[1].suffix === "m" ? 1_000_000 : 1000;
  }
  let min = nums[0].value;
  let max = nums.length >= 2 && /-|\bto\b/i.test(text) ? nums[1].value : null;
  if (max != null && max < min) [min, max] = [max, min];
  const lower = text.toLowerCase();
  if (/\bup to\b|\bmax(imum)?\b/.test(lower) && max == null) {
    max = min;
    min = null;
  }
  const period = detectPeriod(text) || inferPeriod(max ?? min);
  if (!period) return null;
  return {
    min: min != null ? round2(min) : null,
    max: max != null ? round2(max) : null,
    currency: detectCurrency(text) || "USD",
    period,
  };
}

const round2 = (n) => Math.round(n * 100) / 100;

function fromStructured({ min, max, currency, period }) {
  const p = mapPeriod(period);
  const lo = Number(min) || null;
  const hi = Number(max) || null;
  if (!p || (!lo && !hi)) return null;
  return { min: lo, max: hi && hi !== lo ? hi : null, currency: currency || "USD", period: p };
}

function mapPeriod(p) {
  const v = String(p || "").toLowerCase();
  if (/hour/.test(v)) return "hour";
  if (/day|daily/.test(v)) return "day";
  if (/week/.test(v)) return "week";
  if (/month/.test(v)) return "month";
  if (/year|annual|yr/.test(v)) return "year";
  return null;
}

function toAnnual(salary) {
  if (!salary || !PERIODS.includes(salary.period)) return null;
  const f = ANNUAL_FACTOR[salary.period];
  const min = salary.min != null ? Math.round(salary.min * f) : null;
  const max = salary.max != null ? Math.round(salary.max * f) : null;
  if (min == null && max == null) return null;
  return { min: min ?? max, max: max ?? min, mid: Math.round(((min ?? max) + (max ?? min)) / 2) };
}

const CUR = String.raw`(?:(?:US|CA|C|AU|A|NZ|HK|S)?\$|£|€|₹|\b(?:USD|CAD|GBP|EUR|AUD|INR)\s?)`;
const AMT = String.raw`\d[\d,]*(?:\.\d{1,2})?\s*[kKmM]?`;
const PER = String.raw`(?:\s*(?:\/|per|an|a)\s*(?:hour|hr|year|yr|annum|month|mo|week|wk|day)\b)?`;
const MONEY = new RegExp(
  String.raw`${CUR}\s?${AMT}(?:\s*(?:USD|CAD|GBP|EUR|AUD))?${PER}(?:\s*(?:-|–|—|to)\s*${CUR}?\s?${AMT}(?:\s*(?:USD|CAD|GBP|EUR|AUD))?${PER})?`,
  "g"
);
const PAY_WORDS = /salary|pay\b|compensation|base|range|hourly|wage|rate|ote|earn|annual/i;

// Finds money spans that could be the pay for the role, with nearby context
// so Jev can tell a salary from a bonus, a funding round, or a benefit.
// Spans introduced by pay language sort first.
function findSalaryCandidates(text, max = 8) {
  const source = String(text || "");
  const seen = new Set();
  const found = [];
  for (const m of source.matchAll(MONEY)) {
    const span = m[0].trim();
    const parsed = parseSalaryText(span);
    if (!parsed || seen.has(span)) continue;
    seen.add(span);
    const before = source.slice(Math.max(0, m.index - 70), m.index);
    const start = Math.max(0, m.index - 90);
    const end = Math.min(source.length, m.index + span.length + 60);
    const context = source.slice(start, end).replace(/\s+/g, " ").trim();
    const payWords = PAY_WORDS.test(before);
    const score = (payWords ? 2 : 0) + (detectPeriod(span) ? 1 : 0);
    found.push({ span, context, parsed, payWords, score });
  }
  found.sort((a, b) => b.score - a.score);
  return found.slice(0, max).map(({ score, ...c }) => c);
}

module.exports = { parseSalaryText, fromStructured, toAnnual, findSalaryCandidates, detectCurrency, mapPeriod };
