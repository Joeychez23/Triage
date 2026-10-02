const mongoose = require("mongoose");

const sourceRunSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    status: { type: String, enum: ["queued", "running", "done", "partial", "failed"], default: "queued" },
    runId: String,
    datasetId: String,
    count: { type: Number, default: 0 },
    error: { type: String, default: "" },
    costUsd: Number,
    startedAt: Date,
    finishedAt: Date,
  },
  { _id: false }
);

const searchSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    params: {
      keywords: String,
      location: String,
      country: String,
      postedWithin: Number,
      remoteOnly: Boolean,
      limit: Number,
      sources: [String],
    },
    key: { type: String, index: true },
    status: { type: String, enum: ["running", "analyzing", "done", "failed"], default: "running" },
    error: { type: String, default: "" },
    sources: { type: [sourceRunSchema], default: [] },
    jobs: { type: [String], default: [] },
    newJobs: { type: [String], default: [] },
    progress: { analyzed: { type: Number, default: 0 }, total: { type: Number, default: 0 } },
    cachedFrom: { type: mongoose.Schema.Types.ObjectId, default: null },
    savedSearch: { type: mongoose.Schema.Types.ObjectId, default: null },
    finishedAt: Date,
    // Guest searches expire; signed-in history is kept until deleted.
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

searchSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
searchSchema.index({ key: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Search", searchSchema);
