const test = require("node:test");
const assert = require("node:assert/strict");
const { parseSalaryText, fromStructured, toAnnual, findSalaryCandidates } = require("../lib/salary");

test("parses common pay formats", () => {
  assert.deepEqual(parseSalaryText("$108,000.00/yr - $216,000.00/yr"), { min: 108000, max: 216000, currency: "USD", period: "year" });
  assert.deepEqual(parseSalaryText("$45 - $55 an hour"), { min: 45, max: 55, currency: "USD", period: "hour" });
  assert.deepEqual(parseSalaryText("£40k–£45k"), { min: 40000, max: 45000, currency: "GBP", period: "year" });
  assert.deepEqual(parseSalaryText("$120-150K"), { min: 120000, max: 150000, currency: "USD", period: "year" });
  assert.deepEqual(parseSalaryText("CA$90,000 per year"), { min: 90000, max: null, currency: "CAD", period: "year" });
  assert.deepEqual(parseSalaryText("Up to $70,000"), { min: null, max: 70000, currency: "USD", period: "year" });
  assert.deepEqual(parseSalaryText("$6,000 - $7,000 a month"), { min: 6000, max: 7000, currency: "USD", period: "month" });
  assert.equal(parseSalaryText(""), null);
  assert.equal(parseSalaryText("no numbers here"), null);
});

test("maps structured pay from scrapers", () => {
  assert.deepEqual(fromStructured({ min: 129300, max: 194700, currency: "USD", period: "YEAR" }), { min: 129300, max: 194700, currency: "USD", period: "year" });
  assert.deepEqual(fromStructured({ min: 25, max: 25, currency: "USD", period: "HOURLY" }), { min: 25, max: null, currency: "USD", period: "hour" });
  assert.equal(fromStructured({ min: null, max: null, period: "YEAR" }), null);
  assert.equal(fromStructured({ min: 1, max: 2, period: null }), null);
});

test("annualizes", () => {
  assert.deepEqual(toAnnual({ min: 50, max: 60, period: "hour" }), { min: 104000, max: 124800, mid: 114400 });
  assert.deepEqual(toAnnual({ min: null, max: 90000, period: "year" }), { min: 90000, max: 90000, mid: 90000 });
  assert.equal(toAnnual(null), null);
});

test("finds pay candidates with context, pay-language first", () => {
  const text = "We raised $40M last year. The base salary range for this role is $150,000 - $180,000 per year plus equity.";
  const found = findSalaryCandidates(text);
  assert.equal(found[0].span, "$150,000 - $180,000 per year");
  assert.ok(found[0].payWords);
  assert.ok(found.some((c) => c.span.startsWith("$40M")));
});
