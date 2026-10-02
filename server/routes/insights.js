const express = require("express");
const Application = require("../models/Application");
const Search = require("../models/Search");
const store = require("../lib/store");
const { toAnnual } = require("../lib/salary");
const { requireDb, requireAuth } = require("../middleware/auth");

const router = express.Router();
const WEEK = 7 * 24 * 3600 * 1000;
const REACHED_RESPONSE = new Set(["interviewing", "offer"]);

router.use(requireDb, requireAuth);

const weekStart = (d) => {
  const x = new Date(d);
  const day = (x.getUTCDay() + 6) % 7; // Monday = 0
  x.setUTCHours(0, 0, 0, 0);
  x.setUTCDate(x.getUTCDate() - day);
  return x;
};

function pipelineStats(apps) {
  const statuses = { saved: 0, applied: 0, interviewing: 0, offer: 0, closed: 0 };
  const outcomes = { hired: 0, rejected: 0, withdrawn: 0, ghosted: 0 };
  let applied = 0;
  let responded = 0;
  let fitSum = 0;
  let fitCount = 0;
  let followUpsDue = 0;
  const now = Date.now();
  for (const a of apps) {
    statuses[a.status] = (statuses[a.status] || 0) + 1;
    if (a.status === "closed" && a.outcome) outcomes[a.outcome] = (outcomes[a.outcome] || 0) + 1;
    const visited = new Set([a.status, ...a.history.map((h) => h.to).filter(Boolean)]);
    const didApply = Boolean(a.appliedAt) || visited.has("applied");
    if (didApply) {
      applied += 1;
      if ([...visited].some((s) => REACHED_RESPONSE.has(s)) || a.outcome === "hired") responded += 1;
      if (a.fit != null) {
        fitSum += a.fit;
        fitCount += 1;
      }
    }
    if (a.followUpAt && new Date(a.followUpAt).getTime() <= now && (a.status === "applied" || a.status === "interviewing")) followUpsDue += 1;
  }
  return {
    total: apps.length,
    statuses,
    outcomes,
    applied,
    responded,
    responseRate: applied ? responded / applied : null,
    avgAppliedFit: fitCount ? Math.round(fitSum / fitCount) : null,
    followUpsDue,
  };
}

function weekly(apps, weeks = 12) {
  const start = weekStart(Date.now() - (weeks - 1) * WEEK).getTime();
  const buckets = Array.from({ length: weeks }, (_, i) => ({ week: new Date(start + i * WEEK).toISOString().slice(0, 10), saved: 0, applied: 0 }));
  const put = (date, field) => {
    const t = new Date(date).getTime();
    if (!Number.isFinite(t) || t < start) return;
    const idx = Math.floor((weekStart(t).getTime() - start) / WEEK);
    if (buckets[idx]) buckets[idx][field] += 1;
  };
  for (const a of apps) {
    put(a.createdAt, "saved");
    if (a.appliedAt) put(a.appliedAt, "applied");
  }
  return buckets;
}

async function market(userId) {
  const searches = await Search.find({ owner: userId, status: "done" }, { jobs: 1 }).sort({ createdAt: -1 }).limit(15).lean();
  const ids = [...new Set(searches.flatMap((s) => s.jobs))].slice(0, 900);
  const jobs = await store.getJobs(ids);
  const skillCounts = new Map();
  const arrangements = { remote: 0, hybrid: 0, onsite: 0, unclear: 0 };
  const sources = {};
  const seniority = {};
  const salaries = [];
  const currencies = {};
  for (const j of jobs) {
    for (const s of j.skills || []) skillCounts.set(s, (skillCounts.get(s) || 0) + 1);
    const arr = j.analysis?.arrangement || "unclear";
    arrangements[arr] = (arrangements[arr] || 0) + 1;
    // A job merged across boards counts for every board that listed it.
    for (const src of new Set([j.source, ...(j.alsoOn || []).map((a) => a.source)])) sources[src] = (sources[src] || 0) + 1;
    if (j.analysis?.seniority) seniority[j.analysis.seniority] = (seniority[j.analysis.seniority] || 0) + 1;
    const pay = j.salary || j.analysis?.pay;
    const annual = pay ? toAnnual(pay) : null;
    if (annual && annual.mid >= 10000 && annual.mid <= 2_000_000) {
      salaries.push({ mid: annual.mid, currency: pay.currency || "USD" });
      currencies[pay.currency || "USD"] = (currencies[pay.currency || "USD"] || 0) + 1;
    }
  }
  const currency = Object.entries(currencies).sort((a, b) => b[1] - a[1])[0]?.[0] || "USD";
  return {
    totalJobs: jobs.length,
    searches: searches.length,
    topSkills: [...skillCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([skill, count]) => ({ skill, count, share: jobs.length ? count / jobs.length : 0 })),
    arrangements,
    sources,
    seniority,
    currency,
    salaries: salaries.filter((s) => s.currency === currency).map((s) => s.mid),
  };
}

router.get("/", async (req, res) => {
  const apps = await Application.find({ user: req.userId }).lean();
  const [marketStats] = await Promise.all([market(req.userId)]);
  res.json({ pipeline: pipelineStats(apps), weekly: weekly(apps), market: marketStats });
});

module.exports = router;
module.exports.pipelineStats = pipelineStats;
module.exports.weekly = weekly;
