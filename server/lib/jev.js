// Minimal TypeSafe System One client with a timeout, retries for rate limits
// and overload responses, and a process-wide concurrency cap so a burst of
// job analyses never exceeds the API's request rate.
const config = require("../config");
const { createLimiter } = require("./pool");

const RETRYABLE = new Set([429, 500, 502, 503, 504, 529]);
const TIMEOUT_MS = 25000;
const MAX_ATTEMPTS = 3;

class JevError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.name = "JevError";
    this.status = status;
    this.detail = detail;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const limit = createLimiter(config.jevConcurrency);

const usage = { requests: 0, inputTokens: 0, failures: 0 };

async function ask(state, questions, { signal } = {}) {
  if (!config.jevEnabled) throw new JevError("Jev is not configured (TYPESAFE_API_KEY is missing)", 503);
  if (!questions || !Object.keys(questions).length) return { answers: {} };
  return limit(() => send(state, questions, signal));
}

async function send(state, questions, signal) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    try {
      const res = await fetch(config.typesafeUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.typesafeApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: config.jevModel, state, questions }),
        signal: combined,
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text.slice(0, 300) };
      }
      if (res.ok && data.answers) {
        usage.requests += 1;
        usage.inputTokens += data.usage?.input_tokens || 0;
        return data;
      }
      lastError = new JevError(describe(res.status), res.status, data);
      if (!RETRYABLE.has(res.status)) throw lastError;
    } catch (err) {
      if (err instanceof JevError && !RETRYABLE.has(err.status)) {
        usage.failures += 1;
        throw err;
      }
      if (signal?.aborted) throw new JevError("Request cancelled", 499);
      lastError =
        err instanceof JevError
          ? err
          : new JevError(err.name === "TimeoutError" ? "Jev timed out" : `Could not reach Jev: ${err.message}`, 504);
    }
    if (attempt < MAX_ATTEMPTS) await sleep(400 * 3 ** (attempt - 1) + Math.random() * 250);
  }
  usage.failures += 1;
  throw lastError;
}

function describe(status) {
  switch (status) {
    case 401: return "The TypeSafe API key is missing or invalid";
    case 422: return "Jev rejected the request format";
    case 429: return "Jev rate limit reached; try again in a moment";
    case 529: return "Jev is temporarily overloaded; try again in a moment";
    default: return `Jev request failed (${status})`;
  }
}

// Helpers for reading typed answers.
const noul = (a) => (a && typeof a.noul === "number" ? a.noul : null);
const scoreNorm = (a, max) => (a && typeof a.score === "number" ? clamp01(a.score / max) : null);
const choice = (a) => (a && a.choice ? a.choice : null);
const probs = (a) => (a?.probabilities ? roundAll(a.probabilities) : {});
const clamp01 = (n) => Math.min(1, Math.max(0, n));
const round = (n, d = 3) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);
const roundAll = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, round(v)]));

module.exports = { ask, JevError, usage, noul, scoreNorm, choice, probs, round };
