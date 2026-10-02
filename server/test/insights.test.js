const test = require("node:test");
const assert = require("node:assert/strict");
const { pipelineStats, weekly } = require("../routes/insights");

test("pipeline stats and response rate", () => {
  const past = new Date(Date.now() - 86400000);
  const apps = [
    { status: "saved", history: [{ to: "saved" }], appliedAt: null, fit: 90 },
    { status: "applied", history: [{ to: "saved" }, { to: "applied" }], appliedAt: past, fit: 70, followUpAt: past },
    { status: "closed", outcome: "rejected", history: [{ to: "applied" }, { to: "interviewing" }, { to: "closed" }], appliedAt: past, fit: 50 },
  ];
  const s = pipelineStats(apps);
  assert.equal(s.total, 3);
  assert.equal(s.applied, 2);
  assert.equal(s.responded, 1);
  assert.equal(s.responseRate, 0.5);
  assert.equal(s.avgAppliedFit, 60);
  assert.equal(s.followUpsDue, 1);
  assert.equal(s.outcomes.rejected, 1);
});

test("weekly buckets cover twelve weeks and count this week", () => {
  const now = new Date();
  const w = weekly([{ createdAt: now, appliedAt: now }]);
  assert.equal(w.length, 12);
  assert.deepEqual([w[11].saved, w[11].applied], [1, 1]);
});
