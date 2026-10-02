const express = require("express");
const mongoose = require("mongoose");
const Application = require("../models/Application");
const { requireDb, requireAuth } = require("../middleware/auth");
const { parse, applicationCreate, applicationUpdate } = require("../lib/schemas");

const router = express.Router();
const MAX_APPLICATIONS = 1000;

router.use(requireDb, requireAuth);

router.get("/", async (req, res) => {
  const apps = await Application.find({ user: req.userId }).sort({ status: 1, order: 1, updatedAt: -1 });
  res.json({ applications: apps.map((a) => a.toPublic()) });
});

router.post("/", async (req, res) => {
  const body = parse(applicationCreate, req.body);
  if (body.jobId) {
    const existing = await Application.findOne({ user: req.userId, jobId: body.jobId });
    if (existing) return res.json({ application: existing.toPublic(), existed: true });
  }
  if ((await Application.countDocuments({ user: req.userId })) >= MAX_APPLICATIONS) {
    return res.status(400).json({ error: `You can track up to ${MAX_APPLICATIONS} jobs. Archive some first.` });
  }
  const now = new Date();
  const first = await Application.findOne({ user: req.userId, status: body.status }).sort({ order: 1 }).select("order");
  const app = await Application.create({
    ...body,
    user: req.userId,
    appliedAt: body.status !== "saved" ? now : null,
    order: (first?.order ?? 0) - 1,
    history: [{ type: "created", to: body.status, at: now }],
  });
  res.status(201).json({ application: app.toPublic() });
});

router.patch("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Not found." });
  const patch = parse(applicationUpdate, req.body);
  const app = await Application.findOne({ _id: req.params.id, user: req.userId });
  if (!app) return res.status(404).json({ error: "Not found." });
  if (patch.status && patch.status !== app.status) {
    app.history.push({ type: "status", from: app.status, to: patch.status, at: new Date() });
    if (patch.status !== "saved" && !app.appliedAt && patch.appliedAt === undefined) app.appliedAt = new Date();
    if (patch.status !== "closed" && patch.outcome === undefined) app.outcome = "";
    if (app.history.length > 200) app.history = app.history.slice(-200);
  }
  const { job, ...rest } = patch;
  Object.assign(app, rest);
  if (job) app.job = { ...app.job.toObject?.() ?? app.job, ...job };
  await app.save();
  res.json({ application: app.toPublic() });
});

router.delete("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Not found." });
  await Application.deleteOne({ _id: req.params.id, user: req.userId });
  res.status(204).end();
});

module.exports = router;
