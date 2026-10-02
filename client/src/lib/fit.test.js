import { fitLabel, locationValue, payValue, profileCompleteness, qualityValue, scoreJob } from "./fit";

const job = (over = {}) => ({
  id: "j1",
  title: "Frontend Engineer",
  salary: { min: 130000, max: 160000, currency: "USD", period: "year" },
  analysis: { arrangement: "hybrid", redFlags: 0, clarity: 1 },
  ...over,
});

const profile = (over = {}) => ({
  skills: ["React"],
  minSalary: 120000,
  currency: "USD",
  arrangements: { remote: true, hybrid: true, onsite: false },
  dealbreakers: ["Requires a clearance"],
  mustHaves: ["Remote or hybrid"],
  weights: { skills: 3, level: 2, role: 2, location: 2, pay: 1, quality: 1, wants: 2 },
  ...over,
});

const fit = (over = {}) => ({ skills: 0.8, level: "match", levelP: { match: 1 }, role: 1, commute: 0.9, dealbreakers: [0.05], mustHaves: [0.9], ...over });

test("combines dimensions with weights", () => {
  const { score, dims, hit } = scoreJob(job(), fit(), profile());
  expect(hit).toBe(false);
  expect(dims.pay).toBe(1);
  expect(dims.location).toBeCloseTo(0.92);
  expect(score).toBeGreaterThan(85);
});

test("weights change the score without new judgments", () => {
  const base = scoreJob(job(), fit({ skills: 0.2 }), profile()).score;
  const lowSkills = scoreJob(job(), fit({ skills: 0.2 }), profile({ weights: { skills: 0, level: 2, role: 2, location: 2, pay: 1, quality: 1, wants: 2 } })).score;
  expect(lowSkills).toBeGreaterThan(base);
});

test("a dealbreaker sinks the score and is flagged", () => {
  const ok = scoreJob(job(), fit(), profile());
  const bad = scoreJob(job(), fit({ dealbreakers: [0.92] }), profile());
  expect(bad.hit).toBe(true);
  expect(bad.score).toBeLessThan(ok.score * 0.4);
  expect(scoreJob(job(), fit({ dealbreakers: [0.45] }), profile()).maybe).toBe(true);
});

test("no fit result means no score", () => {
  expect(scoreJob(job(), null, profile()).score).toBeNull();
});

test("location respects accepted work styles and commute", () => {
  expect(locationValue(job({ analysis: { arrangement: "remote" } }), fit(), profile())).toBe(1);
  expect(locationValue(job({ analysis: { arrangement: "onsite" } }), fit(), profile())).toBe(0);
  expect(locationValue(job(), fit({ commute: 0 }), profile())).toBeCloseTo(0.2);
  expect(locationValue(job({ analysis: null }), fit(), profile())).toBeNull();
});

test("pay compares annualized pay with the floor", () => {
  expect(payValue(job(), profile())).toBe(1);
  expect(payValue(job({ salary: { min: 100000, max: 125000, currency: "USD", period: "year" } }), profile())).toBe(0.8);
  // $40-50/hr is about $104K at most: 87% of the floor, so partial credit.
  expect(payValue(job({ salary: { min: 40, max: 50, currency: "USD", period: "hour" } }), profile())).toBeCloseTo(0.233, 2);
  expect(payValue(job({ salary: { min: 30, max: 35, currency: "USD", period: "hour" } }), profile())).toBe(0);
  expect(payValue(job({ salary: null }), profile())).toBeNull();
  expect(payValue(job({ salary: { min: 1, max: 2, currency: "EUR", period: "year" } }), profile())).toBeNull();
  expect(payValue(job(), profile({ minSalary: null }))).toBeNull();
});

test("quality blends red flags and clarity", () => {
  expect(qualityValue(job({ analysis: { redFlags: 1, clarity: 0 } }))).toBe(0);
  expect(qualityValue(job({ analysis: { redFlags: 0, clarity: 1 } }))).toBe(1);
});

test("labels and completeness", () => {
  expect(fitLabel(85).label).toBe("Strong fit");
  expect(fitLabel(70).label).toBe("Good fit");
  expect(fitLabel(50).label).toBe("Possible");
  expect(fitLabel(10).label).toBe("Long shot");
  expect(fitLabel(null).label).toBe("Not scored");
  expect(profileCompleteness({}).ratio).toBe(0);
  expect(profileCompleteness(profile({ targetRoles: ["Dev"], skills: ["a", "b", "c"] })).ratio).toBeGreaterThan(0.5);
});
