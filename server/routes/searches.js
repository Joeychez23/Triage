const express = require("express");
const mongoose = require("mongoose");
const config = require("../config");
const Search = require("../models/Search");
const store = require("../lib/store");
const { startSearch, getSearch, searchKey } = require("../lib/searches");
const { searchView, jobSummary } = require("../lib/present");
const { parse, searchParams } = require("../lib/schemas");
const { optionalAuth, requireDb, requireAuth } = require("../middleware/auth");
const { consumeSearchQuota } = require("../middleware/limits");

const router = express.Router();

// Signed-in users can only open their own searches; guest searches are
// reachable by id (they contain public listings and the query only).
const canRead = (search, req) => !search.owner || String(search.owner) === String(req.userId || "");

async function withJobs(search) {
  const jobs = await store.getJobs(search.jobs || []);
  return { search: searchView(search), jobs: jobs.map(jobSummary) };
}

router.post("/", optionalAuth, async (req, res) => {
  const params = parse(searchParams, req.body);
  const force = req.body?.force === true;
  let quota = null;
  // Peek at the cache first so re-running a recent search never uses quota.
  const since = new Date(Date.now() - config.searchCacheHours * 3600_000);
  const reusable = force ? null : await store.findReusableSearch(searchKey(params), since);
  if (!reusable) {
    quota = consumeSearchQuota(req);
    if (!quota.ok) return res.status(429).json({ error: quota.error });
  }
  try {
    const { search, cached } = await startSearch({ params, ownerId: req.userId || null, force });
    res.status(cached ? 200 : 202).json({ ...(await withJobs(search)), remaining: quota?.remaining ?? null });
  } catch (err) {
    quota?.refund?.();
    throw err;
  }
});

// After signing in, guest searches from this browser join the account's
// history (only unowned ones, so nobody can take someone else's search).
router.post("/claim", requireDb, requireAuth, async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id) => mongoose.isValidObjectId(id)).slice(0, 20) : [];
  if (!ids.length) return res.json({ claimed: 0 });
  const { modifiedCount } = await Search.updateMany({ _id: { $in: ids }, owner: null }, { $set: { owner: req.userId, expiresAt: null } });
  res.json({ claimed: modifiedCount });
});

router.get("/", requireDb, requireAuth, async (req, res) => {
  const searches = await store.listSearches(req.userId, 30);
  res.json({ searches: searches.map(searchView) });
});

router.get("/:id", optionalAuth, async (req, res) => {
  const search = await getSearch(req.params.id);
  if (!search || !canRead(search, req)) return res.status(404).json({ error: "That search doesn't exist or has expired." });
  res.set("Cache-Control", "no-store");
  res.json(await withJobs(search));
});

router.delete("/:id", requireDb, requireAuth, async (req, res) => {
  const search = await store.getSearch(req.params.id);
  if (!search || String(search.owner) !== String(req.userId)) return res.status(404).json({ error: "Search not found." });
  await store.deleteSearch(search._id);
  res.status(204).end();
});

module.exports = router;
