// Shared helpers for turning scraper output into one job shape, plus
// cross-source duplicate detection.
const { htmlToBlocks, blocksToText, snippet, clean } = require("./html");
const { extractSkills } = require("./skills");

const COMPANY_NOISE = new Set([
  "inc", "incorporated", "llc", "l.l.c", "ltd", "limited", "corp", "corporation", "co", "company",
  "plc", "gmbh", "ag", "sa", "the", "group", "holdings", "lp", "llp", "pllc", "pc",
]);

const words = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9+#]+/g, " ")
    .split(" ")
    .filter(Boolean);

const companyTokens = (name) => words(name).filter((w) => !COMPANY_NOISE.has(w));
const normalizeCompany = (name) => companyTokens(name).join(" ");

// Titles compare without seniority punctuation noise or location suffixes
// like "(Austin)" or "- Remote".
function normalizeTitle(title) {
  const t = String(title || "")
    .replace(/\((?:remote|hybrid|on-?site|[A-Z][a-z]+(?:,\s*[A-Z]{2})?)\)/gi, " ")
    .replace(/\s[-–|]\s*(?:remote|hybrid|on-?site)\s*$/i, " ");
  return words(t)
    .map((w) => (w === "sr" ? "senior" : w === "jr" ? "junior" : w === "engr" ? "engineer" : w === "mgr" ? "manager" : w))
    .join(" ");
}

const US_STATES = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT",
  delaware: "DE", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI",
  minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC",
  "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
  "district of columbia": "DC",
};

// "Austin, TX" / "Austin, Texas, United States" -> { city: "Austin", region: "TX" }
function parseLocation(text) {
  const raw = clean(text);
  if (!raw) return { city: "", region: "", country: "" };
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  const city = /remote|anywhere|united states|^us$|^usa$/i.test(parts[0] || "") ? "" : parts[0] || "";
  let region = parts[1] || "";
  if (US_STATES[region.toLowerCase()]) region = US_STATES[region.toLowerCase()];
  const country = parts.length >= 3 ? parts[parts.length - 1] : "";
  return { city, region, country };
}

const REMOTE_HINT = /\bremote\b|\bwork from home\b|\bwfh\b|\banywhere\b/i;

function cityKey(job) {
  const city = words(job.city || parseLocation(job.location).city).join(" ");
  return city || (REMOTE_HINT.test(job.location || "") ? "remote" : "");
}

// Builds the description fields every job shares from HTML or text.
function describe(html, fallbackText) {
  let blocks = html ? htmlToBlocks(html) : [];
  if (!blocks.length && fallbackText) blocks = htmlToBlocks(fallbackText);
  const text = blocksToText(blocks);
  return { blocks, text, snippet: snippet(blocks) };
}

function finalizeJob(job) {
  const text = `${job.title}\n${job.description?.text || ""}`;
  const skills = [...new Set([...(job.extraSkills || []), ...extractSkills(text)])].slice(0, 30);
  const out = {
    ...job,
    title: clean(job.title).slice(0, 200),
    company: clean(job.company).slice(0, 160) || "Unknown company",
    location: clean(job.location).slice(0, 160),
    skills,
    dedupeKey: `${normalizeTitle(job.title)}|${normalizeCompany(job.company)}|${cityKey(job)}`,
  };
  delete out.extraSkills;
  return out;
}

function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  return inter / (A.size + B.size - inter);
}

// Two postings are the same job when the normalized titles match, the cities
// match (or one side is unknown), and the company names overlap strongly,
// e.g. "ERCOT/Electric Reliability Council of Texas" vs
// "Electric Reliability Council of Texas, Inc.".
function sameJob(a, b) {
  if (normalizeTitle(a.title) !== normalizeTitle(b.title)) return false;
  const ca = cityKey(a);
  const cb = cityKey(b);
  if (ca && cb && ca !== cb) return false;
  const ta = companyTokens(a.company);
  const tb = companyTokens(b.company);
  if (!ta.length || !tb.length) return false;
  if (ta.join(" ") === tb.join(" ")) return true;
  const small = ta.length <= tb.length ? ta : tb;
  const big = new Set(ta.length <= tb.length ? tb : ta);
  const contained = small.every((w) => big.has(w));
  return contained || jaccard(ta, tb) >= 0.6;
}

// Higher is richer: prefer the copy with pay, a longer description, a logo.
function richness(job) {
  return (
    (job.salary && job.salary.source !== "estimated" ? 4 : job.salary ? 2 : 0) +
    Math.min(3, (job.description?.text?.length || 0) / 1500) +
    (job.companyLogo ? 0.5 : 0) +
    (job.applyUrl ? 0.5 : 0)
  );
}

// Groups duplicates. Returns [{ primary, duplicates: [...] }] keeping input
// order of each group's first member. `pinned` items (already shown to the
// user) always stay primary so ids don't shuffle while results stream in.
function groupDuplicates(jobs, { pinned = new Set() } = {}) {
  const groups = [];
  for (const job of jobs) {
    const group = groups.find((g) => g.members.some((m) => sameJob(m, job)));
    if (group) group.members.push(job);
    else groups.push({ members: [job] });
  }
  return groups.map(({ members }) => {
    const pin = members.find((m) => pinned.has(String(m._id ?? m.key)));
    const primary = pin || [...members].sort((a, b) => richness(b) - richness(a))[0];
    return { primary, duplicates: members.filter((m) => m !== primary) };
  });
}

module.exports = {
  words,
  normalizeCompany,
  normalizeTitle,
  parseLocation,
  describe,
  finalizeJob,
  sameJob,
  groupDuplicates,
  richness,
  REMOTE_HINT,
};
