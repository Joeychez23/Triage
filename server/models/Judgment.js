const mongoose = require("mongoose");

// Cached per-profile Jev results (fit scores and requirement checks), keyed
// by job id + profile hash so unchanged profiles never pay for a re-check.
const judgmentSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now, expires: 14 * 24 * 3600 },
});

module.exports = mongoose.model("Judgment", judgmentSchema);
