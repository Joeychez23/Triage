// Shapes stored documents into the JSON the client receives.
const { SOURCES } = require("./sources");

function publicAnalysis(a) {
  if (!a) return null;
  return {
    arrangement: a.arrangement,
    arrangementP: a.arrangementP,
    seniority: a.seniority,
    employment: a.employment,
    years: a.years,
    sponsorship: a.sponsorship,
    degree: a.degree,
    clarity: a.clarity,
    redFlags: a.redFlags,
    intensity: a.intensity,
  };
}

function jobSummary(job) {
  const a = job.analysis;
  const salary = job.salary || (a?.pay ? { ...a.pay } : null);
  return {
    id: String(job._id),
    source: job.source,
    url: job.url || "",
    applyUrl: job.applyUrl || "",
    title: job.title,
    company: job.company,
    companyUrl: job.companyUrl || "",
    companyLogo: job.companyLogo || "",
    companyRating: job.companyRating || null,
    location: job.location || "",
    remoteHint: Boolean(job.remoteHint),
    employmentType: job.employmentType || "",
    seniorityHint: job.seniorityHint || "",
    industry: job.industry || "",
    salary: salary ? { min: salary.min ?? null, max: salary.max ?? null, currency: salary.currency, period: salary.period, source: salary.source } : null,
    postedAt: job.postedAt || null,
    firstSeenAt: job.firstSeenAt || null,
    applicants: job.applicants || "",
    easyApply: Boolean(job.easyApply),
    benefits: job.benefits || [],
    skills: job.skills || [],
    snippet: job.description?.snippet || "",
    alsoOn: (job.alsoOn || []).map(({ source, url }) => ({ source, url })),
    analysis: publicAnalysis(a),
  };
}

function jobDetail(job) {
  return { ...jobSummary(job), blocks: job.description?.blocks || [] };
}

function searchView(search) {
  return {
    id: String(search._id),
    params: search.params,
    status: search.status,
    error: search.error || "",
    sources: (search.sources || []).map((s) => ({
      id: s.id,
      label: SOURCES[s.id]?.label || s.id,
      status: s.status,
      count: s.count || 0,
      error: s.error || "",
    })),
    progress: search.progress || { analyzed: 0, total: 0 },
    jobCount: search.jobCount ?? (search.jobs || []).length,
    newJobs: search.newJobs || [],
    cached: Boolean(search.cachedFrom),
    savedSearch: search.savedSearch ? String(search.savedSearch) : null,
    createdAt: search.createdAt,
    finishedAt: search.finishedAt || null,
  };
}

module.exports = { jobSummary, jobDetail, searchView };
