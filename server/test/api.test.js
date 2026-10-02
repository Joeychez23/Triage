// HTTP-level checks against the Express app without a database.
const test = require("node:test");
const assert = require("node:assert/strict");
process.env.NODE_ENV = "test";
const app = require("../index");

let server;
let base;
test.before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(() => server.close());

const post = (path, body, raw) =>
  fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: raw ?? JSON.stringify(body) });

test("health reports configuration", async () => {
  const res = await fetch(`${base}/health`);
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.accounts, false);
  assert.deepEqual(data.sources.map((s) => s.id), ["linkedin", "indeed", "glassdoor"]);
});

test("validation errors are readable", async () => {
  const res = await post("/searches", { keywords: "x" });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /keywords/);
  const bad = await post("/searches", null, "{nope");
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).error, /valid JSON/);
});

test("accounts report unavailable without a database", async () => {
  const res = await post("/auth/login", { email: "a@b.co", password: "whatever1" });
  assert.equal(res.status, 503);
});

test("unknown API routes and jobs 404", async () => {
  assert.equal((await fetch(`${base}/nope`)).status, 404);
  assert.equal((await fetch(`${base}/jobs/6abe6de254da079b9c188011`)).status, 404);
});

test("profile features need an account", async () => {
  // No database in tests, so accounts are unavailable and every
  // profile-based endpoint refuses before doing any work.
  for (const path of ["/profile/skills", "/profile/resume", "/jobs/fit", "/jobs/6abe6de254da079b9c188011/requirements"]) {
    const res = await post(path, { text: "React", profile: { skills: ["React"] }, jobIds: ["6abe6de254da079b9c188011"] });
    assert.equal(res.status, 503, path);
    assert.match((await res.json()).error, /Accounts are unavailable/);
  }
});
