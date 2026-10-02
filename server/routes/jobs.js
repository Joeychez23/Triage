const express = require("express");
const config = require("../config");
const store = require("../lib/store");
const { jobDetail } = require("../lib/present");
const { fit, profileHash, profileReady, FIT_VERSION } = require("../lib/fit");
const { checkRequirements } = require("../lib/requirements");
const { mapLimit } = require("../lib/pool");
const { parse, fitRequest, profile: profileSchema } = require("../lib/schemas");
const { requireDb, requireAuth } = require("../middleware/auth");
const { jevLimiter } = require("../middleware/limits");

const router = express.Router();

function requireJev(req, res, next) {
  if (!config.jevEnabled) return res.status(503).json({ error: "Fit scoring is unavailable: Jev is not configured on this server." });
  next();
}

// Scores up to 30 jobs against the profile sent in the body. Profiles are an
// account feature, so this needs a signed-in user. The client sends its
// current profile (edits sync to the server with a short delay); results are
// cached by job + profile hash.
router.post("/fit", requireDb, requireAuth, jevLimiter, requireJev, async (req, res) => {
  const { profile, jobIds } = parse(fitRequest, req.body);
  if (!profileReady(profile)) return res.status(400).json({ error: "Add skills, target roles, or a resume to your profile to score fit." });
  const hash = profileHash(profile);
  const results = {};
  const missing = [];
  const ids = [...new Set(jobIds)];
  const cached = await store.getJudgments(ids.map((id) => `fit:${id}:${hash}`));
  for (const id of ids) {
    const hit = cached.get(`fit:${id}:${hash}`);
    if (hit && hit.v === FIT_VERSION) results[id] = hit;
    else missing.push(id);
  }
  const jobs = missing.length ? await store.getJobs(missing, { full: true }) : [];
  const outcomes = await mapLimit(jobs, 8, async (job) => {
    const value = await fit(job, profile);
    results[String(job._id)] = value;
    await store.setJudgment(`fit:${job._id}:${hash}`, value);
  });
  const failed = outcomes.filter((o) => !o.ok);
  if (failed.length) console.warn(`Fit failed for ${failed.length} job(s): ${failed[0].error.message}`);
  if (failed.length && failed.length === jobs.length && !Object.keys(results).length) throw failed[0].error;
  res.json({ profileHash: hash, results });
});

router.get("/:id", async (req, res) => {
  const job = await store.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "This posting is no longer cached. Open it on the original job board." });
  res.json({ job: jobDetail(job) });
});

router.post("/:id/requirements", requireDb, requireAuth, jevLimiter, requireJev, async (req, res) => {
  const profile = parse(profileSchema, req.body?.profile);
  if (!profileReady(profile)) return res.status(400).json({ error: "Add skills or a resume to your profile to check requirements." });
  const job = await store.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "This posting is no longer cached." });
  const key = `req:${job._id}:${job.contentHash}:${profileHash(profile)}`;
  let result = await store.getJudgment(key);
  if (!result) {
    result = await checkRequirements(job, profile);
    await store.setJudgment(key, result);
  }
  res.json(result);
});

module.exports = router;
