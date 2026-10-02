// Concurrency helpers: a shared limiter (at most N tasks in flight) and a
// mapLimit for running a function over a list with bounded parallelism.

function createLimiter(max) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= max || !queue.length) return;
    active += 1;
    const { task, resolve, reject } = queue.shift();
    Promise.resolve()
      .then(task)
      .then(resolve, reject)
      .finally(() => {
        active -= 1;
        next();
      });
  };
  return (task) =>
    new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject });
      next();
    });
}

// Resolves to an array of { ok, value } / { ok: false, error } in input order,
// so one failure never discards the other results.
async function mapLimit(items, max, fn) {
  const limit = createLimiter(max);
  return Promise.all(
    items.map((item, i) =>
      limit(() => fn(item, i)).then(
        (value) => ({ ok: true, value }),
        (error) => ({ ok: false, error })
      )
    )
  );
}

// Serializes async work per key (for example, per search) inside one process.
function createKeyedLock() {
  const tails = new Map();
  return (key, fn) => {
    const prev = tails.get(key) || Promise.resolve();
    const run = prev.then(() => fn());
    const tail = run.catch(() => {});
    tails.set(key, tail);
    tail.then(() => {
      if (tails.get(key) === tail) tails.delete(key);
    });
    return run;
  };
}

module.exports = { createLimiter, mapLimit, createKeyedLock };
