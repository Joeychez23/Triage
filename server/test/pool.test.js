const test = require("node:test");
const assert = require("node:assert/strict");
const { mapLimit, createKeyedLock, createLimiter } = require("../lib/pool");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test("mapLimit bounds concurrency and keeps order and failures", async () => {
  let active = 0;
  let peak = 0;
  const out = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (n) => {
    active += 1;
    peak = Math.max(peak, active);
    await sleep(5);
    active -= 1;
    if (n === 4) throw new Error("boom");
    return n * 10;
  });
  assert.equal(peak, 2);
  assert.deepEqual(out.map((o) => (o.ok ? o.value : o.error.message)), [10, 20, 30, "boom", 50, 60]);
});

test("keyed lock serializes work per key", async () => {
  const lock = createKeyedLock();
  const log = [];
  await Promise.all([
    lock("a", async () => { await sleep(10); log.push("a1"); }),
    lock("a", async () => { log.push("a2"); }),
    lock("b", async () => { log.push("b1"); }),
  ]);
  assert.deepEqual(log, ["b1", "a1", "a2"]);
  await assert.rejects(lock("a", async () => { throw new Error("x"); }));
  assert.equal(await lock("a", async () => "still works"), "still works");
});

test("limiter propagates results", async () => {
  const limit = createLimiter(1);
  assert.equal(await limit(async () => 7), 7);
});
