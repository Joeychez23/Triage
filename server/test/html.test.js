const test = require("node:test");
const assert = require("node:assert/strict");
const { htmlToBlocks, blocksToText, snippet } = require("../lib/html");

test("LinkedIn-style bold headings separated by <br> become heading blocks", () => {
  const html = "<strong>Overview<br><br></strong>This is a remote role.<br><br><strong>Requirements<br></strong><ul><li>5+ years of React</li><li>TypeScript</li></ul>";
  assert.deepEqual(htmlToBlocks(html), [
    { t: "h", x: "Overview" },
    { t: "p", x: "This is a remote role." },
    { t: "h", x: "Requirements" },
    { t: "li", x: "5+ years of React" },
    { t: "li", x: "TypeScript" },
  ]);
});

test("Glassdoor-style paragraphs, entities, and nested bold", () => {
  const html = "<div><p><b>What You&rsquo;ll Do\n</b></p><ul><li>Build things.\n</li></ul><ul><li>Ship &amp; learn</li></ul></div>";
  assert.deepEqual(htmlToBlocks(html), [
    { t: "h", x: "What You’ll Do" },
    { t: "li", x: "Build things." },
    { t: "li", x: "Ship & learn" },
  ]);
});

test("scripts and styles are dropped; short colon lines are headings", () => {
  const html = "<script>alert(1)</script><style>p{}</style><p>Qualifications:</p><p>Must love dogs.</p>";
  assert.deepEqual(htmlToBlocks(html), [
    { t: "h", x: "Qualifications" },
    { t: "p", x: "Must love dogs." },
  ]);
});

test("plain text with bullets and shouted headings", () => {
  const blocks = htmlToBlocks("ABOUT YOU\n• Curious\n- Kind\n\nWe build software.");
  assert.deepEqual(blocks, [
    { t: "h", x: "ABOUT YOU" },
    { t: "li", x: "Curious" },
    { t: "li", x: "Kind" },
    { t: "p", x: "We build software." },
  ]);
});

test("blocksToText and snippet", () => {
  const blocks = [
    { t: "h", x: "Job Description" },
    { t: "p", x: "Job Title: Engineer" },
    { t: "p", x: "We are hiring a thoughtful engineer to build reliable systems." },
    { t: "li", x: "React" },
  ];
  assert.match(blocksToText(blocks), /Job Description:\n.*\n- React$/s);
  assert.equal(snippet(blocks), "We are hiring a thoughtful engineer to build reliable systems. React");
});
