const mongoose = require("mongoose");

const { Mixed } = mongoose.Schema.Types;

const salarySchema = new mongoose.Schema(
  {
    min: Number,
    max: Number,
    currency: String,
    period: { type: String, enum: ["hour", "day", "week", "month", "year"] },
    source: { type: String, enum: ["employer", "estimated", "extracted"] },
    text: String,
  },
  { _id: false }
);

const jobSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true }, // "<source>:<sourceId>"
    source: { type: String, required: true, index: true },
    sourceId: { type: String, required: true },
    url: String,
    applyUrl: String,
    title: { type: String, required: true },
    company: { type: String, required: true },
    companyUrl: String,
    companyLogo: String,
    companyRating: Number,
    location: String,
    city: String,
    region: String,
    country: String,
    remoteHint: Boolean,
    employmentType: String,
    seniorityHint: String,
    industry: String,
    salary: { type: salarySchema, default: null },
    postedAt: Date,
    applicants: String,
    easyApply: Boolean,
    benefits: [String],
    skills: [String],
    description: {
      blocks: { type: [Mixed], default: [] },
      text: String,
      snippet: String,
    },
    contentHash: String,
    dedupeKey: { type: String, index: true },
    alsoOn: { type: [{ _id: false, source: String, url: String, key: String }], default: [] },
    // Jev X-ray results; see lib/xray.js.
    analysis: { type: Mixed, default: null },
    firstSeenAt: Date,
    lastSeenAt: Date,
  },
  { minimize: false }
);

// Old postings that no search references anymore age out after 60 days.
jobSchema.index({ lastSeenAt: 1 }, { expireAfterSeconds: 60 * 24 * 3600 });

module.exports = mongoose.model("Job", jobSchema);
