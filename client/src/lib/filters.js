// Client-side filtering and sorting over a search's jobs.
import { annualize } from "./format";
import { payValue } from "./fit";

export const DEFAULT_FILTERS = {
  text: "",
  arrangements: [],
  seniority: [],
  sources: [],
  postedDays: 0,
  payOnly: false,
  meetsFloor: false,
  hideDealbreakers: false,
  hideRedFlags: false,
  hideTracked: false,
  newOnly: false,
  sort: "fit",
};

export const SORTS = [
  ["fit", "Best fit"],
  ["newest", "Newest"],
  ["pay", "Highest pay"],
  ["rating", "Company rating"],
];

const norm = (s) => String(s || "").toLowerCase();

export function applyFilters(rows, filters, { profile, trackedIds, newIds } = {}) {
  const f = { ...DEFAULT_FILTERS, ...filters };
  const q = norm(f.text).trim();
  const hidden = new Set((profile?.hiddenCompanies || []).map(norm));
  const now = Date.now();
  const out = rows.filter(({ job, scored }) => {
    if (hidden.has(norm(job.company))) return false;
    if (q && !`${norm(job.title)} ${norm(job.company)} ${norm(job.location)} ${(job.skills || []).join(" ").toLowerCase()}`.includes(q)) return false;
    if (f.arrangements.length && !f.arrangements.includes(job.analysis?.arrangement || "unclear")) return false;
    if (f.seniority.length && !f.seniority.includes(job.analysis?.seniority)) return false;
    if (f.sources.length && !f.sources.includes(job.source) && !(job.alsoOn || []).some((a) => f.sources.includes(a.source))) return false;
    if (f.postedDays) {
      const t = new Date(job.postedAt || job.firstSeenAt || 0).getTime();
      if (!t || now - t > f.postedDays * 86400000) return false;
    }
    if (f.payOnly && !job.salary) return false;
    if (f.meetsFloor && (payValue(job, profile) ?? 0) < 0.8) return false;
    if (f.hideDealbreakers && scored?.hit) return false;
    if (f.hideRedFlags && (job.analysis?.redFlags ?? 0) >= 0.5) return false;
    if (f.hideTracked && trackedIds?.has(job.id)) return false;
    if (f.newOnly && !newIds?.has(job.id)) return false;
    return true;
  });
  return sortRows(out, f.sort);
}

export function sortRows(rows, sort) {
  const time = (j) => new Date(j.postedAt || j.firstSeenAt || 0).getTime() || 0;
  const pay = (j) => annualize(j.salary)?.mid ?? -1;
  const byFit = (a, b) => {
    // Dealbreakers always sink; unscored jobs sit below scored ones.
    if (Boolean(a.scored?.hit) !== Boolean(b.scored?.hit)) return a.scored?.hit ? 1 : -1;
    const sa = a.scored?.score ?? -1;
    const sb = b.scored?.score ?? -1;
    return sb - sa || time(b.job) - time(a.job);
  };
  const sorters = {
    fit: byFit,
    newest: (a, b) => time(b.job) - time(a.job),
    pay: (a, b) => pay(b.job) - pay(a.job) || byFit(a, b),
    rating: (a, b) => (b.job.companyRating ?? 0) - (a.job.companyRating ?? 0) || byFit(a, b),
  };
  return [...rows].sort(sorters[sort] || byFit);
}

export function activeFilterCount(filters) {
  const f = { ...DEFAULT_FILTERS, ...filters };
  return (
    (f.text ? 1 : 0) +
    f.arrangements.length +
    f.seniority.length +
    f.sources.length +
    (f.postedDays ? 1 : 0) +
    ["payOnly", "meetsFloor", "hideDealbreakers", "hideRedFlags", "hideTracked", "newOnly"].filter((k) => f[k]).length
  );
}
