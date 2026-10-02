const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const store = require("../lib/store");
const { startSearch, hooks } = require("../lib/searches");
const { searchView, jobSummary } = require("../lib/present");
const { parse, savedSearchCreate } = require("../lib/schemas");
const { requireDb, requireAuth } = require("../middleware/auth");
const { consumeSearchQuota } = require("../middleware/limits");
const { publicSaved } = require("./auth");

const router = express.Router();
const MAX_SAVED = 20;

router.use(requireDb, requireAuth);

router.get("/", async (req, res) => {
  const user = await User.findById(req.userId).select("savedSearches");
  res.json({ savedSearches: (user?.savedSearches || []).map(publicSaved) });
});

router.post("/", async (req, res) => {
  const { name, params } = parse(savedSearchCreate, req.body);
  const user = await User.findById(req.userId).select("savedSearches");
  if (!user) return res.status(401).json({ error: "Your account no longer exists." });
  if (user.savedSearches.length >= MAX_SAVED) return res.status(400).json({ error: `You can save up to ${MAX_SAVED} searches. Remove one first.` });
  // Seed the "seen" list with the search the user saved from, so the first
  // re-run only flags postings that are actually new.
  const fromSearch = mongoose.isValidObjectId(req.body?.searchId) ? await store.getSearch(req.body.searchId) : null;
  const seen = fromSearch && String(fromSearch.owner || "") === String(req.userId) ? fromSearch.jobs : [];
  user.savedSearches.push({ name, params, lastJobIds: seen.slice(0, 600), lastRunAt: fromSearch ? fromSearch.createdAt : null });
  await user.save();
  res.status(201).json({ savedSearch: publicSaved(user.savedSearches[user.savedSearches.length - 1]) });
});

router.patch("/:id", async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 80) : "";
  if (!name) return res.status(400).json({ error: "Give the search a name." });
  const user = await User.findOneAndUpdate(
    { _id: req.userId, "savedSearches._id": req.params.id },
    { $set: { "savedSearches.$.name": name } },
    { returnDocument: "after" }
  ).select("savedSearches");
  const saved = user?.savedSearches.id(req.params.id);
  if (!saved) return res.status(404).json({ error: "Saved search not found." });
  res.json({ savedSearch: publicSaved(saved) });
});

router.delete("/:id", async (req, res) => {
  await User.updateOne({ _id: req.userId }, { $pull: { savedSearches: { _id: req.params.id } } });
  res.status(204).end();
});

router.post("/:id/run", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Saved search not found." });
  const user = await User.findById(req.userId).select("savedSearches");
  const saved = user?.savedSearches.id(req.params.id);
  if (!saved) return res.status(404).json({ error: "Saved search not found." });
  const force = req.body?.force === true;
  const quota = consumeSearchQuota(req);
  if (!quota.ok) return res.status(429).json({ error: quota.error });
  try {
    const { search, cached } = await startSearch({ params: saved.params, ownerId: req.userId, force, savedSearchId: saved._id });
    if (cached) quota.refund();
    const fresh = cached ? await store.getSearch(search._id) : search;
    const jobs = await store.getJobs(fresh.jobs || []);
    res.status(cached ? 200 : 202).json({ search: searchView(fresh), jobs: jobs.map(jobSummary) });
  } catch (err) {
    quota.refund();
    throw err;
  }
});

// When a saved search finishes, flag postings that weren't in its last run.
hooks.onFinished = async (search) => {
  const user = await User.findOne({ _id: search.owner, "savedSearches._id": search.savedSearch }).select("savedSearches");
  const saved = user?.savedSearches.id(search.savedSearch);
  if (!saved) return;
  const seen = new Set(saved.lastJobIds || []);
  const newJobs = seen.size ? search.jobs.filter((id) => !seen.has(id)) : [];
  await User.updateOne(
    { _id: search.owner, "savedSearches._id": search.savedSearch },
    {
      $set: {
        "savedSearches.$.lastJobIds": [...new Set([...search.jobs, ...seen])].slice(0, 600),
        "savedSearches.$.lastRunAt": new Date(),
        "savedSearches.$.lastSearchId": search._id,
        "savedSearches.$.lastNewCount": newJobs.length,
      },
    }
  );
  await store.updateSearch(search._id, { newJobs });
};

module.exports = router;
