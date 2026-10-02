// Thin wrapper around the official Apify client: start an Actor run with a
// cost ceiling, wait for it, and read its dataset.
const { ApifyClient } = require("apify-client");
const config = require("../config");

const FINISHED = new Set(["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"]);

class ApifyError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "ApifyError";
    this.status = status;
  }
}

let client;
function getClient() {
  if (!config.apifyEnabled) throw new ApifyError("Live search is not configured (APIFY_TOKEN is missing).", 503);
  client ||= new ApifyClient({ token: config.apifyToken, maxRetries: 4, minDelayBetweenRetriesMillis: 400 });
  return client;
}

async function start(actorId, input, { maxItems, maxTotalChargeUsd, timeoutSecs = 240 } = {}) {
  try {
    return await getClient().actor(actorId).start(input, { maxItems, maxTotalChargeUsd, timeout: timeoutSecs });
  } catch (err) {
    throw friendly(err);
  }
}

// Waits for a run to finish. Runs that are still going after `waitSecs` are
// aborted so they stop accruing charges, and reported as timed out.
async function wait(runId, waitSecs = 300) {
  try {
    const run = await getClient().run(runId).waitForFinish({ waitSecs });
    if (!run) throw new ApifyError("The scraper run disappeared.");
    if (FINISHED.has(run.status)) return run;
    await getClient().run(runId).abort().catch(() => {});
    return { ...run, status: "TIMED-OUT" };
  } catch (err) {
    throw friendly(err);
  }
}

async function items(datasetId, limit) {
  if (!datasetId) return [];
  try {
    const { items: rows } = await getClient().dataset(datasetId).listItems({ limit, clean: true });
    return rows;
  } catch (err) {
    throw friendly(err);
  }
}

function describeRun(run) {
  switch (run?.status) {
    case "TIMED-OUT": return "The scraper took too long and was stopped.";
    case "ABORTED": return "The scraper run was aborted.";
    case "FAILED": return "The scraper failed on the job board's side.";
    default: return "";
  }
}

function friendly(err) {
  if (err instanceof ApifyError) return err;
  const type = err?.type || "";
  const status = err?.statusCode;
  if (status === 401 || /token|unauthori[sz]ed|user-or-token-not-found/i.test(type)) {
    return new ApifyError("The Apify token was rejected. Check APIFY_TOKEN.", 502);
  }
  if (status === 402 || /not-enough-usage|limit-reached|insufficient/i.test(type)) {
    return new ApifyError("The Apify account is out of credit for this billing period.", 502);
  }
  if (status === 404 || /actor-not-found|record-not-found/i.test(type)) {
    return new ApifyError("The scraper could not be found on Apify.", 502);
  }
  if (status === 429) return new ApifyError("Apify is rate limiting requests; try again shortly.", 429);
  return new ApifyError(`Apify request failed: ${String(err?.message || err).slice(0, 200)}`, 502);
}

module.exports = { start, wait, items, describeRun, ApifyError };
