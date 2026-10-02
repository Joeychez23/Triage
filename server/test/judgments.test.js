const test = require("node:test");
const assert = require("node:assert/strict");
const { fitQuestions, readFit, profileHash, profileReady } = require("../lib/fit");
const { readXray, xrayQuestions, XRAY_VERSION } = require("../lib/xray");
const { extractRequirements, readRequirements, missingKeywords } = require("../lib/requirements");

test("fit only asks questions the profile can support", () => {
  assert.deepEqual(Object.keys(fitQuestions({ skills: ["React"] })), ["skills"]);
  const q = fitQuestions({
    skills: ["React"],
    seniority: "mid",
    targetRoles: ["Frontend"],
    locations: ["Austin"],
    dealbreakers: ["on-call"],
    mustHaves: ["remote"],
  });
  assert.deepEqual(Object.keys(q), ["skills", "level", "role", "commute", "d0", "m0"]);
  assert.equal(q.d0.instructions.condition, "on-call");
  assert.ok(!profileReady({}));
  assert.ok(profileReady({ targetRoles: ["Designer"] }));
});

test("readFit normalizes Jev answers", () => {
  const out = readFit(
    {
      skills: { type: "score", score: 3, confidence: 0.8 },
      level: { type: "choice", choice: "stretch", probabilities: { match: 0.2, stretch: 0.8 } },
      d0: { type: "noul", noul: 0.91 },
    },
    { dealbreakers: ["clearance"], mustHaves: ["remote"] }
  );
  assert.equal(out.skills, 0.75);
  assert.equal(out.level, "stretch");
  assert.equal(out.role, null);
  assert.deepEqual(out.dealbreakers, [0.91]);
  assert.deepEqual(out.mustHaves, [0]);
});

test("profile hash ignores fields that don't change fit answers", () => {
  const base = { skills: ["React"], weights: { skills: 3 } };
  assert.equal(profileHash(base), profileHash({ ...base, weights: { skills: 1 }, hiddenCompanies: ["Acme"] }));
  assert.notEqual(profileHash(base), profileHash({ ...base, skills: ["Vue"] }));
});

test("X-ray pay selection only accepts confident picks", () => {
  const candidates = [{ span: "$150,000 - $180,000 per year", context: "base salary" }];
  assert.ok(xrayQuestions({}, candidates).pay.criteria.c0);
  const answers = {
    arrangement: { choice: "remote", probabilities: { remote: 0.9 } },
    pay: { choice: "c0", probabilities: { c0: 0.92, none: 0.08 } },
  };
  const out = readXray(answers, candidates);
  assert.equal(out.v, XRAY_VERSION);
  assert.equal(out.arrangement, "remote");
  assert.deepEqual([out.pay.min, out.pay.max, out.pay.source], [150000, 180000, "extracted"]);
  const unsure = readXray({ pay: { choice: "c0", probabilities: { c0: 0.4, none: 0.6 } } }, candidates);
  assert.equal(unsure.pay, undefined);
  assert.equal(unsure.arrangement, "unclear");
});

test("requirement extraction prefers qualification sections", () => {
  const blocks = [
    { t: "h", x: "What you'll do" },
    { t: "li", x: "Build features" },
    { t: "h", x: "Requirements" },
    { t: "li", x: "3+ years of React" },
    { t: "li", x: "Strong TypeScript" },
    { t: "li", x: "Experience with GraphQL" },
    { t: "h", x: "Benefits" },
    { t: "li", x: "Unlimited PTO" },
  ];
  assert.deepEqual(
    extractRequirements(blocks).map((r) => r.text),
    ["3+ years of React", "Strong TypeScript", "Experience with GraphQL"]
  );
});

test("requirement answers and missing keywords", () => {
  const reqs = [{ section: "Requirements", text: "React" }];
  const out = readRequirements(
    { "r0:met": { score: 3, confidence: 0.9 }, "r0:hard": { noul: 0.8 }, "r0:qual": { noul: 0.95 }, s0: { noul: 0.9 }, s1: { noul: 0.2 } },
    reqs,
    ["React", "Rust"]
  );
  assert.equal(out.items[0].met, 1);
  assert.deepEqual(out.leadWith, ["React"]);
  assert.deepEqual(missingKeywords({ skills: ["React", "GraphQL", "Jest"] }, { skills: ["reactjs"], resumeText: "Wrote tests with Jest" }), ["GraphQL"]);
});
