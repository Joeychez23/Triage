// Request rate limits (express-rate-limit) plus a manual quota for live
// searches, which cost Apify credit. Cached searches don't use the quota.
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const config = require("../config");

const keyFor = (req) => (req.userId ? `u:${req.userId}` : `ip:${ipKeyGenerator(req.ip || "")}`);

function limiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: keyFor,
    handler: (req, res) => res.status(429).json({ error: message }),
  });
}

const authLimiter = limiter({ windowMs: 15 * 60_000, limit: 30, message: "Too many sign-in attempts. Try again in a few minutes." });
const jevLimiter = limiter({ windowMs: 60_000, limit: 90, message: "You're scoring jobs very quickly. Give it a moment." });
const uploadLimiter = limiter({ windowMs: 60 * 60_000, limit: 20, message: "Too many uploads. Try again later." });
const apiLimiter = limiter({ windowMs: 60_000, limit: 600, message: "Too many requests. Please slow down." });

// Fixed-window counters for live (credit-using) searches, per user or IP.
// In-memory, so it assumes one server process.
const windows = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, w] of windows) if (w.reset <= now) windows.delete(k);
}, 10 * 60_000).unref();

function consumeSearchQuota(req) {
  const signedIn = Boolean(req.userId);
  const max = signedIn ? config.userSearchesPerDay : config.guestSearchesPerHour;
  const windowMs = signedIn ? 24 * 3600_000 : 3600_000;
  const key = `search:${keyFor(req)}`;
  const now = Date.now();
  let w = windows.get(key);
  if (!w || w.reset <= now) {
    w = { count: 0, reset: now + windowMs };
    windows.set(key, w);
  }
  if (w.count >= max) {
    const minutes = Math.ceil((w.reset - now) / 60_000);
    const hint = signedIn ? "" : " Sign in for a higher limit.";
    return { ok: false, error: `You've reached the live search limit (${max} per ${signedIn ? "day" : "hour"}). Try again in ${minutes} min, or re-run a recent search to use cached results.${hint}` };
  }
  w.count += 1;
  return { ok: true, remaining: max - w.count, refund: () => (w.count = Math.max(0, w.count - 1)) };
}

module.exports = { authLimiter, jevLimiter, uploadLimiter, apiLimiter, consumeSearchQuota };
