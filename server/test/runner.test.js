// Runs the search pipeline end to end with Apify and Jev stubbed, using the
// in-memory store (no database connection in tests).
const test = require("node:test");
const assert = require("node:assert/strict");
const config = require("../config");
const apify = require("../lib/apify");
const jev = require("../lib/jev");
const { startSearch, getSearch } = require("../lib/searches");
const store = require("../lib/store");

const fixtures = {
  [config.actors.linkedin]: require("./fixtures/linkedin.json"),
  [config.actors.indeed]: require("./fixtures/indeed.json"),
  [config.actors.glassdoor]: require("./fixtures/glassdoor.json"),
};

test("search pipeline scrapes, dedupes, X-rays, and caches", async () => {
  config.apifyEnabled = true;
  config.jevEnabled = true;
  const runs = new Map();
  apify.start = async (actor) => {
    const id = `run-${runs.size}`;
    runs.set(id, actor);
    return { id, defaultDatasetId: id };
  };
  apify.wait = async (id) => ({ id, status: "SUCCEEDED", defaultDatasetId: id });
  apify.items = async (datasetId) => fixtures[runs.get(datasetId)];
  let asked = 0;
  jev.ask = async () => {
    asked += 1;
    return { answers: { arrangement: { choice: "hybrid", probabilities: { hybrid: 1 } }, seniority: { choice: "senior" } } };
  };

  assert.equal(store.backend, "memory");
  const params = { keywords: "react", location: "Austin, TX", country: "us", postedWithin: 7, remoteOnly: false, limit: 10, sources: ["linkedin", "indeed", "glassdoor"] };
  const { search, cached } = await startSearch({ params });
  assert.equal(cached, false);

  let s;
  for (let i = 0; i < 100; i++) {
    s = await getSearch(search._id);
    if (s.status === "done" || s.status === "failed") break;
    await new Promise((r) => setTimeout(r, 20));
  }
  assert.equal(s.status, "done");
  assert.equal(s.jobs.length, 10);
  assert.equal(asked, 10);
  const jobs = await store.getJobs(s.jobs);
  assert.ok(jobs.every((j) => j.analysis?.arrangement === "hybrid"));
  const ercot = jobs.find((j) => /GMS Development/.test(j.title));
  assert.equal(ercot.alsoOn.length, 1);

  const again = await startSearch({ params });
  assert.equal(again.cached, true);
  assert.deepEqual(again.search.jobs, s.jobs);
  assert.equal(asked, 10);
});

test("a failing source doesn't sink the others", async () => {
  apify.start = async (actor) => {
    if (actor === config.actors.glassdoor) throw new apify.ApifyError("The Apify account is out of credit for this billing period.");
    return { id: actor, defaultDatasetId: actor };
  };
  apify.wait = async (id) => ({ id, status: "SUCCEEDED", defaultDatasetId: id });
  apify.items = async (id) => fixtures[id];
  const params = { keywords: "react 2", location: "", country: "us", postedWithin: 3, remoteOnly: true, limit: 10, sources: ["indeed", "glassdoor"] };
  const { search } = await startSearch({ params });
  let s;
  for (let i = 0; i < 100; i++) {
    s = await getSearch(search._id);
    if (s.status === "done" || s.status === "failed") break;
    await new Promise((r) => setTimeout(r, 20));
  }
  assert.equal(s.status, "done");
  const gd = s.sources.find((x) => x.id === "glassdoor");
  assert.equal(gd.status, "failed");
  assert.match(gd.error, /out of credit/);
  assert.equal(s.jobs.length, 3);
});
