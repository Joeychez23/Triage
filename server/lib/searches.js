// Search orchestration: start one Apify run per source, merge each source's
// jobs into the search as it finishes (deduplicating across boards), then
// X-ray every new posting with Jev.
//
// Runs are tracked in-process. If the server restarts mid-search, the next
// status request notices there is no watcher and resumes from the stored
// Apify run ids.
const config = require("../config");
const store = require("./store");
const apify = require("./apify");
const { SOURCES } = require("./sources");
const { groupDuplicates } = require("./normalize");
const { xray, XRAY_VERSION } = require("./xray");
const { mapLimit, createKeyedLock } = require("./pool");
const { hashKey } = require("./cache");

const lock = createKeyedLock();
const active = new Set();
const liveProgress = new Map();
const STALE_MS = 15 * 60 * 1000;
const GUEST_TTL_MS = 3 * 24 * 3600 * 1000;
const hooks = { onFinished: null };

function searchKey(p) {
  return hashKey(
    "search1",
    (p.keywords || "").trim().toLowerCase(),
    (p.location || "").trim().toLowerCase(),
    p.country || "us",
    String(p.postedWithin),
    String(Boolean(p.remoteOnly)),
    String(p.limit),
    [...p.sources].sort().join(",")
  );
}

const needsXray = (job) => !job.analysis || job.analysis.v !== XRAY_VERSION || job.analysis.forHash !== job.contentHash;

async function startSearch({ params, ownerId = null, force = false, savedSearchId = null }) {
  const key = searchKey(params);
  const base = {
    owner: ownerId,
    params,
    key,
    savedSearch: savedSearchId,
    expiresAt: ownerId ? null : new Date(Date.now() + GUEST_TTL_MS),
  };
  if (!force) {
    const since = new Date(Date.now() - config.searchCacheHours * 3600 * 1000);
    const reusable = await store.findReusableSearch(key, since);
    if (reusable) {
      const search = await store.createSearch({
        ...base,
        status: "done",
        sources: reusable.sources.map(({ id, status, count, error }) => ({ id, status, count, error })),
        jobs: reusable.jobs,
        progress: reusable.progress,
        cachedFrom: reusable._id,
        finishedAt: new Date(),
      });
      await finalizeSaved(search);
      return { search, cached: true };
    }
  }
  if (!config.apifyEnabled) {
    throw Object.assign(new Error("Live search is not configured on this server (APIFY_TOKEN is missing)."), { status: 503 });
  }
  const search = await store.createSearch({
    ...base,
    status: "running",
    sources: params.sources.map((id) => ({ id, status: "queued", count: 0, error: "" })),
    jobs: [],
    progress: { analyzed: 0, total: 0 },
  });
  run(search._id);
  return { search, cached: false };
}

function run(id) {
  id = String(id);
  if (active.has(id)) return;
  active.add(id);
  (async () => {
    try {
      const search = await store.getSearch(id);
      if (!search) return;
      const pending = search.sources.filter((s) => s.status === "queued" || s.status === "running");
      await Promise.all(pending.map((src) => runSource(search, src)));
      await analyze(id);
    } catch (err) {
      console.error(`Search ${id} failed:`, err);
      await store.updateSearch(id, { status: "failed", error: "Something went wrong while searching." }).catch(() => {});
    } finally {
      active.delete(id);
      liveProgress.delete(id);
    }
  })();
}

async function runSource(search, src) {
  const source = SOURCES[src.id];
  const limit = Math.min(Math.max(Number(search.params.limit) || 25, 5), config.maxResultsPerSource);
  try {
    let runId = src.runId;
    if (!runId) {
      const started = await apify.start(source.actor(), source.buildInput(search.params, limit), {
        maxItems: limit,
        maxTotalChargeUsd: config.maxChargePerRunUsd,
      });
      runId = started.id;
      await store.setSearchSource(search._id, src.id, {
        status: "running",
        runId,
        datasetId: started.defaultDatasetId,
        startedAt: new Date(),
      });
    }
    const finished = await apify.wait(runId, 300);
    const rows = await apify.items(finished.defaultDatasetId, limit);
    const jobs = [];
    for (const row of rows) {
      try {
        const job = source.normalize(row);
        if (job) jobs.push(job);
      } catch (err) {
        console.warn(`Skipped a ${src.id} row: ${err.message}`);
      }
    }
    const ok = finished.status === "SUCCEEDED";
    if (!ok && !jobs.length) throw new Error(apify.describeRun(finished) || "The scraper returned no results.");
    await addJobs(search._id, jobs);
    await store.setSearchSource(search._id, src.id, {
      status: ok ? "done" : "partial",
      count: jobs.length,
      error: ok ? "" : apify.describeRun(finished),
      costUsd: finished.usageTotalUsd ?? null,
      finishedAt: new Date(),
    });
  } catch (err) {
    console.warn(`Source ${src.id} failed for search ${search._id}: ${err.message}`);
    await store.setSearchSource(search._id, src.id, { status: "failed", error: err.message, finishedAt: new Date() });
  }
}

// Merges one source's jobs into the search. Serialized per search so sources
// finishing at the same moment can't overwrite each other.
function addJobs(searchId, jobs) {
  return lock(String(searchId), async () => {
    const stored = dedupeById(await store.upsertJobs(jobs));
    const search = await store.getSearch(searchId);
    const existing = await store.getJobs(search.jobs);
    const pinned = new Set(existing.map((j) => String(j._id)));
    const groups = groupDuplicates([...existing, ...stored.filter((j) => !pinned.has(String(j._id)))], { pinned });
    const ids = [];
    for (const { primary, duplicates } of groups) {
      ids.push(String(primary._id));
      if (duplicates.length) await mergeInto(primary, duplicates);
    }
    await store.updateSearch(searchId, { jobs: ids });
  });
}

const dedupeById = (jobs) => [...new Map(jobs.map((j) => [String(j._id), j])).values()];

// Records where else a job is listed and borrows missing details (pay, logo,
// rating) from its duplicates.
async function mergeInto(primary, duplicates) {
  const alsoOn = [...(primary.alsoOn || [])];
  const set = {};
  for (const d of duplicates) {
    if (d.key !== primary.key && !alsoOn.some((a) => a.key === d.key)) alsoOn.push({ source: d.source, url: d.url, key: d.key });
    const better = d.salary && (!primary.salary || (primary.salary.source === "estimated" && d.salary.source === "employer"));
    if (better && !set.salary) set.salary = d.salary;
    if (!primary.companyLogo && d.companyLogo) set.companyLogo = d.companyLogo;
    if (!primary.companyRating && d.companyRating) set.companyRating = d.companyRating;
    if (!primary.applyUrl && d.applyUrl) set.applyUrl = d.applyUrl;
  }
  set.alsoOn = alsoOn.slice(0, 6);
  await store.updateJob(primary._id, set);
}

async function analyze(id) {
  let search = await store.getSearch(id);
  const failedAll = search.sources.every((s) => s.status === "failed");
  if (failedAll) {
    const reasons = [...new Set(search.sources.map((s) => s.error).filter(Boolean))];
    await store.updateSearch(id, { status: "failed", error: reasons.join(" ") || "Every job board failed.", finishedAt: new Date() });
    return;
  }
  const jobs = await store.getJobs(search.jobs, { full: true });
  const todo = config.jevEnabled ? jobs.filter(needsXray) : [];
  const progress = { analyzed: jobs.length - todo.length, total: jobs.length };
  liveProgress.set(id, progress);
  search = await store.updateSearch(id, { status: "analyzing", progress });
  await mapLimit(todo, 6, async (job) => {
    try {
      const analysis = await xray(job);
      analysis.forHash = job.contentHash;
      await store.updateJob(job._id, { analysis });
    } catch (err) {
      console.warn(`X-ray failed for ${job.key}: ${err.message}`);
    } finally {
      progress.analyzed += 1;
    }
  });
  search = await store.updateSearch(id, { status: "done", progress, finishedAt: new Date() });
  await finalizeSaved(search);
}

async function finalizeSaved(search) {
  if (hooks.onFinished && search?.savedSearch && search.owner) {
    await hooks.onFinished(search).catch((err) => console.warn(`Saved search update failed: ${err.message}`));
  }
}

// Returns a search with live progress, resuming or expiring orphaned runs.
async function getSearch(id) {
  const search = await store.getSearch(id);
  if (!search) return null;
  const running = search.status === "running" || search.status === "analyzing";
  if (running && !active.has(String(search._id))) {
    if (Date.now() - new Date(search.createdAt).getTime() > STALE_MS) {
      return store.updateSearch(search._id, { status: "failed", error: "This search was interrupted. Run it again." });
    }
    run(search._id);
  }
  const live = liveProgress.get(String(search._id));
  return live ? { ...search, progress: { ...live } } : search;
}

module.exports = { startSearch, getSearch, searchKey, hooks, needsXray, mergeInto };
