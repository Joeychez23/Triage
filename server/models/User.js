const mongoose = require("mongoose");

const SENIORITY = ["", "intern", "entry", "mid", "senior", "lead", "manager", "executive"];

const weightsSchema = new mongoose.Schema(
  {
    skills: { type: Number, min: 0, max: 3, default: 3 },
    level: { type: Number, min: 0, max: 3, default: 2 },
    role: { type: Number, min: 0, max: 3, default: 2 },
    location: { type: Number, min: 0, max: 3, default: 2 },
    pay: { type: Number, min: 0, max: 3, default: 1 },
    quality: { type: Number, min: 0, max: 3, default: 1 },
    wants: { type: Number, min: 0, max: 3, default: 2 },
  },
  { _id: false }
);

const profileSchema = new mongoose.Schema(
  {
    headline: { type: String, trim: true, maxlength: 120, default: "" },
    targetRoles: { type: [String], default: [] },
    seniority: { type: String, enum: SENIORITY, default: "" },
    yearsExperience: { type: Number, min: 0, max: 60, default: null },
    skills: { type: [String], default: [] },
    locations: { type: [String], default: [] },
    arrangements: {
      remote: { type: Boolean, default: true },
      hybrid: { type: Boolean, default: true },
      onsite: { type: Boolean, default: true },
    },
    minSalary: { type: Number, min: 0, max: 10_000_000, default: null },
    currency: { type: String, maxlength: 3, default: "USD" },
    dealbreakers: { type: [String], default: [] },
    mustHaves: { type: [String], default: [] },
    resumeText: { type: String, maxlength: 20000, default: "" },
    resumeName: { type: String, maxlength: 200, default: "" },
    weights: { type: weightsSchema, default: () => ({}) },
    hiddenCompanies: { type: [String], default: [] },
  },
  { _id: false }
);

const savedSearchSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 80, required: true },
    params: { type: mongoose.Schema.Types.Mixed, required: true },
    lastRunAt: { type: Date, default: null },
    lastSearchId: { type: mongoose.Schema.Types.ObjectId, default: null },
    lastJobIds: { type: [String], default: [] },
    lastNewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    name: { type: String, trim: true, maxlength: 80, default: "" },
    passwordHash: { type: String, required: true, select: false },
    // Bumped on password change so older sessions stop working.
    tokenVersion: { type: Number, default: 0 },
    profile: { type: profileSchema, default: () => ({}) },
    savedSearches: { type: [savedSearchSchema], default: [] },
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    email: this.email,
    name: this.name,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model("User", userSchema);
module.exports.SENIORITY = SENIORITY;
