// Storage for jobs, searches, and cached judgments. Uses MongoDB when it is
// connected and falls back to in-memory LRU caches (guest mode), so search
// keeps working even when the database is unreachable.
const crypto = require("crypto");
const mongoose = require("mongoose");
const { isConnected } = require("../db");
const { LruCache } = require("./cache");
const Job = require("../models/Job");
const Search = require("../models/Search");
const Judgment = require("../models/Judgment");

const DAY = 24 * 3600 * 1000;
const newId = () => new mongoose.Types.ObjectId().toString();
const contentHash = (job) =>
  crypto.createHash("sha1").update(`${job.title}␟${job.description?.text || ""}`).digest("base64url").slice(0, 16);

const SUMMARY_PROJECTION = { "description.blocks": 0, "description.text": 0 };

// ---------------------------------------------------------------- memory ---
const mem = {
  jobs: new LruCache({ max: 25000, ttlMs: 3 * DAY }),
  jobIdByKey: new Map(),
  searches: new LruCache({ max: 3000, ttlMs: 2 * DAY }),
  judgments: new LruCache({ max: 50000, ttlMs: 3 * DAY }),
};

const clone = (v) => (v == null ? v : structuredClone(v));
const summarize = (job) => {
  if (!job) return job;
  const { description, ...rest } = job;
  return { ...rest, description: { snippet: description?.snippet || "" } };
};

const memory = {
  async upsertJobs(jobs) {
    const now = new Date();
    return jobs.map((job) => {
      const hash = contentHash(job);
      let id = mem.jobIdByKey.get(job.key);
      const prev = id ? mem.jobs.get(id) : null;
      if (!prev) {
        id = newId();
        mem.jobIdByKey.set(job.key, id);
      }
      const doc = {
        ...job,
        _id: id,
        contentHash: hash,
        alsoOn: prev?.alsoOn || [],
        analysis: prev && prev.contentHash === hash ? prev.analysis : null,
        firstSeenAt: prev?.firstSeenAt || now,
        lastSeenAt: now,
      };
      mem.jobs.set(id, doc);
      return clone(doc);
    });
  },
  async getJobs(ids, { full = false } = {}) {
    return ids.map((id) => mem.jobs.get(String(id))).filter(Boolean).map((j) => clone(full ? j : summarize(j)));
  },
  async getJob(id) {
    return clone(mem.jobs.get(String(id)) || null);
  },
  async updateJob(id, set) {
    const job = mem.jobs.get(String(id));
    if (job) mem.jobs.set(String(id), { ...job, ...clone(set) });
  },
  async createSearch(doc) {
    const now = new Date();
    const search = { ...clone(doc), _id: newId(), createdAt: now, updatedAt: now };
    mem.searches.set(search._id, search);
    return clone(search);
  },
  async getSearch(id) {
    return clone(mem.searches.get(String(id)) || null);
  },
  async updateSearch(id, set) {
    const s = mem.searches.get(String(id));
    if (!s) return null;
    const next = { ...s, ...clone(set), updatedAt: new Date() };
    mem.searches.set(String(id), next);
    return clone(next);
  },
  async setSearchSource(id, sourceId, set) {
    const s = mem.searches.get(String(id));
    if (!s) return;
    s.sources = s.sources.map((src) => (src.id === sourceId ? { ...src, ...clone(set) } : src));
    s.updatedAt = new Date();
  },
  async findReusableSearch(key, since) {
    return clone(
      mem.searches
        .values()
        .filter((s) => s.key === key && s.status === "done" && s.jobs.length && s.createdAt >= since && !s.cachedFrom)
        .sort((a, b) => b.createdAt - a.createdAt)[0] || null
    );
  },
  async listSearches(owner, limit) {
    return clone(
      mem.searches
        .values()
        .filter((s) => String(s.owner) === String(owner))
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit)
        .map(({ jobs, newJobs, ...s }) => ({ ...s, jobCount: jobs.length }))
    );
  },
  async deleteSearch(id) {
    mem.searches.delete(String(id));
  },
  async getJudgment(key) {
    return clone(mem.judgments.get(key));
  },
  async getJudgments(keys) {
    return new Map(keys.map((k) => [k, clone(mem.judgments.get(k))]).filter(([, v]) => v !== undefined));
  },
  async setJudgment(key, value) {
    mem.judgments.set(key, clone(value));
  },
};

// ----------------------------------------------------------------- mongo ---
const plain = (doc) => {
  if (!doc) return doc;
  const o = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return { ...o, _id: String(o._id), owner: o.owner ? String(o.owner) : o.owner ?? null };
};

const mongo = {
  async upsertJobs(jobs) {
    if (!jobs.length) return [];
    const now = new Date();
    const unique = [...new Map(jobs.map((j) => [j.key, j])).values()];
    const hashes = new Map(unique.map((j) => [j.key, contentHash(j)]));
    const existing = await Job.find({ key: { $in: unique.map((j) => j.key) } }, { key: 1, contentHash: 1 }).lean();
    const changed = new Set(existing.filter((e) => e.contentHash !== hashes.get(e.key)).map((e) => e.key));
    await Job.bulkWrite(
      unique.map((job) => {
        const { alsoOn, analysis, firstSeenAt, ...fields } = job;
        const update = {
          $set: { ...fields, contentHash: hashes.get(job.key), lastSeenAt: now },
          $setOnInsert: { firstSeenAt: now, alsoOn: [], analysis: null },
        };
        // A changed posting needs a fresh X-ray.
        if (changed.has(job.key)) update.$set.analysis = null;
        if (changed.has(job.key)) delete update.$setOnInsert.analysis;
        return { updateOne: { filter: { key: job.key }, update, upsert: true } };
      }),
      { ordered: false }
    );
    const docs = await Job.find({ key: { $in: unique.map((j) => j.key) } }).lean();
    const byKey = new Map(docs.map((d) => [d.key, plain(d)]));
    return jobs.map((j) => byKey.get(j.key)).filter(Boolean);
  },
  async getJobs(ids, { full = false } = {}) {
    const valid = ids.filter((id) => mongoose.isValidObjectId(id));
    const docs = await Job.find({ _id: { $in: valid } }, full ? {} : SUMMARY_PROJECTION).lean();
    const byId = new Map(docs.map((d) => [String(d._id), plain(d)]));
    return valid.map((id) => byId.get(String(id))).filter(Boolean);
  },
  async getJob(id) {
    if (!mongoose.isValidObjectId(id)) return null;
    return plain(await Job.findById(id).lean());
  },
  async updateJob(id, set) {
    await Job.updateOne({ _id: id }, { $set: set });
  },
  async createSearch(doc) {
    return plain(await Search.create(doc));
  },
  async getSearch(id) {
    if (!mongoose.isValidObjectId(id)) return null;
    return plain(await Search.findById(id).lean());
  },
  async updateSearch(id, set) {
    return plain(await Search.findByIdAndUpdate(id, { $set: set }, { returnDocument: "after" }).lean());
  },
  async setSearchSource(id, sourceId, set) {
    const $set = Object.fromEntries(Object.entries(set).map(([k, v]) => [`sources.$.${k}`, v]));
    await Search.updateOne({ _id: id, "sources.id": sourceId }, { $set });
  },
  async findReusableSearch(key, since) {
    return plain(
      await Search.findOne({ key, status: "done", cachedFrom: null, createdAt: { $gte: since }, "jobs.0": { $exists: true } })
        .sort({ createdAt: -1 })
        .lean()
    );
  },
  async listSearches(owner, limit) {
    const docs = await Search.aggregate([
      { $match: { owner: new mongoose.Types.ObjectId(String(owner)) } },
      { $sort: { createdAt: -1 } },
      { $limit: limit },
      { $addFields: { jobCount: { $size: "$jobs" } } },
      { $project: { jobs: 0, newJobs: 0 } },
    ]);
    return docs.map(plain);
  },
  async deleteSearch(id) {
    await Search.deleteOne({ _id: id });
  },
  async getJudgment(key) {
    const doc = await Judgment.findOne({ key }).lean();
    return doc ? doc.value : undefined;
  },
  async getJudgments(keys) {
    const docs = await Judgment.find({ key: { $in: keys } }).lean();
    return new Map(docs.map((d) => [d.key, d.value]));
  },
  async setJudgment(key, value) {
    await Judgment.updateOne({ key }, { $set: { value, createdAt: new Date() } }, { upsert: true });
  },
};

// Every call picks the backend at call time, so a database that connects a
// few seconds after boot is used as soon as it is ready.
const extras = { memoryBackend: memory, contentHash };
const store = new Proxy(
  {},
  {
    get(_, name) {
      if (name in extras) return extras[name];
      if (name === "backend") return isConnected() ? "mongo" : "memory";
      return (isConnected() ? mongo : memory)[name];
    },
  }
);

module.exports = store;
