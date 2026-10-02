const mongoose = require("mongoose");

const STATUSES = ["saved", "applied", "interviewing", "offer", "closed"];
const OUTCOMES = ["", "hired", "rejected", "withdrawn", "ghosted"];

const eventSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["created", "status", "note"], required: true },
    from: String,
    to: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

// A tracked job. Key job fields are copied in so the card survives even
// after the scraped posting expires.
const applicationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    jobId: { type: String, default: "" },
    job: {
      title: { type: String, required: true, maxlength: 200 },
      company: { type: String, required: true, maxlength: 160 },
      location: { type: String, maxlength: 160, default: "" },
      url: { type: String, maxlength: 2000, default: "" },
      source: { type: String, maxlength: 40, default: "" },
      companyLogo: { type: String, maxlength: 2000, default: "" },
      salary: { type: mongoose.Schema.Types.Mixed, default: null },
      arrangement: { type: String, maxlength: 20, default: "" },
    },
    status: { type: String, enum: STATUSES, default: "saved", index: true },
    outcome: { type: String, enum: OUTCOMES, default: "" },
    fit: { type: Number, min: 0, max: 100, default: null },
    excitement: { type: Number, min: 0, max: 5, default: 0 },
    notes: { type: String, maxlength: 10000, default: "" },
    contact: { type: String, maxlength: 300, default: "" },
    appliedAt: { type: Date, default: null },
    followUpAt: { type: Date, default: null },
    order: { type: Number, default: 0 },
    history: { type: [eventSchema], default: [] },
  },
  { timestamps: true }
);

applicationSchema.index({ user: 1, jobId: 1 });

applicationSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    jobId: this.jobId,
    job: this.job,
    status: this.status,
    outcome: this.outcome,
    fit: this.fit,
    excitement: this.excitement,
    notes: this.notes,
    contact: this.contact,
    appliedAt: this.appliedAt,
    followUpAt: this.followUpAt,
    order: this.order,
    history: this.history,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model("Application", applicationSchema);
module.exports.STATUSES = STATUSES;
module.exports.OUTCOMES = OUTCOMES;
