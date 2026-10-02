import { DEFAULT_FILTERS, activeFilterCount, applyFilters } from "./filters";

const now = Date.now();
const rows = [
  { job: { id: "a", title: "React Dev", company: "Acme", source: "linkedin", postedAt: new Date(now - 3600e3).toISOString(), salary: { min: 150000, max: 170000, period: "year", currency: "USD" }, analysis: { arrangement: "remote", seniority: "senior", redFlags: 0 } }, scored: { score: 90, hit: false } },
  { job: { id: "b", title: "Vue Dev", company: "Beta", source: "indeed", alsoOn: [{ source: "glassdoor" }], postedAt: new Date(now - 10 * 86400e3).toISOString(), salary: null, analysis: { arrangement: "onsite", seniority: "mid", redFlags: 0.7 } }, scored: { score: 95, hit: true } },
  { job: { id: "c", title: "Angular Dev", company: "Gamma", source: "glassdoor", postedAt: new Date(now - 2 * 86400e3).toISOString(), salary: { min: 60, max: 70, period: "hour", currency: "USD" }, analysis: null }, scored: null },
];
const ids = (list) => list.map((r) => r.job.id);

test("best fit sinks dealbreakers and unscored jobs", () => {
  expect(ids(applyFilters(rows, DEFAULT_FILTERS))).toEqual(["a", "c", "b"]);
});

test("filters by work style, source (including duplicates), and text", () => {
  expect(ids(applyFilters(rows, { arrangements: ["onsite"] }))).toEqual(["b"]);
  expect(ids(applyFilters(rows, { arrangements: ["unclear"] }))).toEqual(["c"]);
  expect(ids(applyFilters(rows, { sources: ["glassdoor"], sort: "newest" }))).toEqual(["c", "b"]);
  expect(ids(applyFilters(rows, { text: "gamma" }))).toEqual(["c"]);
});

test("hides dealbreakers, red flags, hidden companies, and tracked jobs", () => {
  expect(ids(applyFilters(rows, { hideDealbreakers: true }))).toEqual(["a", "c"]);
  expect(ids(applyFilters(rows, { hideRedFlags: true }))).toEqual(["a", "c"]);
  expect(ids(applyFilters(rows, {}, { profile: { hiddenCompanies: ["ACME"] } }))).toEqual(["c", "b"]);
  expect(ids(applyFilters(rows, { hideTracked: true }, { trackedIds: new Set(["a"]) }))).toEqual(["c", "b"]);
});

test("pay sorting annualizes and posted filter uses dates", () => {
  expect(ids(applyFilters(rows, { sort: "pay" }))).toEqual(["a", "c", "b"]);
  expect(ids(applyFilters(rows, { postedDays: 3, sort: "newest" }))).toEqual(["a", "c"]);
  expect(ids(applyFilters(rows, { payOnly: true, sort: "newest" }))).toEqual(["a", "c"]);
});

test("counts active filters", () => {
  expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
  expect(activeFilterCount({ arrangements: ["remote", "hybrid"], payOnly: true, text: "x" })).toBe(4);
});
