const test = require("node:test");
const assert = require("node:assert/strict");
const { SOURCES } = require("../lib/sources");
const { groupDuplicates, normalizeTitle, normalizeCompany, sameJob, parseLocation } = require("../lib/normalize");

const load = (id) => require(`./fixtures/${id}.json`).map((item) => SOURCES[id].normalize(item));

test("every fixture normalizes to the shared job shape", () => {
  for (const id of ["linkedin", "indeed", "glassdoor"]) {
    for (const job of load(id)) {
      assert.equal(job.source, id);
      assert.ok(job.key.startsWith(`${id}:`));
      assert.ok(job.title && job.company);
      assert.ok(Array.isArray(job.description.blocks) && job.description.blocks.length > 0);
      assert.ok(job.description.text.length > 100);
      assert.ok(job.dedupeKey.includes("|"));
    }
  }
});

test("structured pay is kept with its source", () => {
  const glassdoor = load("glassdoor");
  assert.equal(glassdoor[0].salary.source, "estimated");
  assert.equal(glassdoor[1].salary.source, "employer");
  const apple = load("indeed").find((j) => j.company === "Apple");
  assert.deepEqual([apple.salary.min, apple.salary.max, apple.salary.period], [129300, 194700, "year"]);
});

test("duplicates merge within and across boards", () => {
  const all = [...load("linkedin"), ...load("indeed"), ...load("glassdoor")];
  const groups = groupDuplicates(all);
  assert.equal(all.length, 12);
  assert.equal(groups.length, 10);
  const ercot = groups.find((g) => /GMS Development/.test(g.primary.title));
  assert.equal(ercot.duplicates.length, 1);
  assert.notEqual(ercot.primary.source, ercot.duplicates[0].source);
});

test("pinned jobs stay primary", () => {
  const [a, b] = load("indeed").filter((j) => j.company === "Apple");
  const pinned = new Set([b.key]);
  const [group] = groupDuplicates([a, b], { pinned });
  assert.equal(group.primary, b);
});

test("title/company/location helpers", () => {
  assert.equal(normalizeTitle("Sr. Software Engineer (Remote)"), "senior software engineer");
  assert.equal(normalizeCompany("The Walt Disney Company, Inc."), "walt disney");
  assert.deepEqual(parseLocation("Austin, Texas, United States"), { city: "Austin", region: "TX", country: "United States" });
  assert.ok(!sameJob({ title: "Engineer", company: "Acme", city: "Austin" }, { title: "Engineer", company: "Acme", city: "Boston" }));
});
