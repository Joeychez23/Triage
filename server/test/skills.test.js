const test = require("node:test");
const assert = require("node:assert/strict");
const { extractSkills, canonicalSkill } = require("../lib/skills");

test("distinguishes look-alike skills", () => {
  const s = extractSkills("Java and JavaScript, React Native and React. American Express is our client.");
  assert.ok(s.includes("Java"));
  assert.ok(s.includes("JavaScript"));
  assert.ok(s.includes("React"));
  assert.ok(s.includes("React Native"));
  assert.ok(!s.includes("Express.js"));
});

test("Go and R only in language contexts", () => {
  assert.ok(extractSkills("Experience with Go, Python, or Rust").includes("Go"));
  assert.ok(!extractSkills("Go to market with us and go beyond").includes("Go"));
  assert.ok(extractSkills("Fluent in Python, R, and SQL").includes("R"));
  assert.ok(!extractSkills("R&D department").includes("R"));
});

test("canonical names for free-typed skills", () => {
  assert.equal(canonicalSkill("reactjs"), "React");
  assert.equal(canonicalSkill("postgres"), "PostgreSQL");
  assert.equal(canonicalSkill("k8s"), "Kubernetes");
  assert.equal(canonicalSkill("Underwater basket weaving"), "Underwater basket weaving");
});
