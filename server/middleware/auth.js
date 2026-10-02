const jwt = require("jsonwebtoken");
const config = require("../config");
const { isConnected } = require("../db");
const User = require("../models/User");

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), tv: user.tokenVersion || 0 }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
    algorithm: "HS256",
  });
}

// null = no token sent; undefined = a token that is invalid or expired.
function readToken(req) {
  const header = req.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  try {
    return jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] });
  } catch {
    return undefined;
  }
}

// Rejects requests when accounts are unavailable (no database or secret).
function requireDb(req, res, next) {
  if (!config.accountsEnabled || !isConnected()) {
    return res.status(503).json({ error: "Accounts are unavailable right now. You can keep searching as a guest." });
  }
  next();
}

// Verifies the token and that it hasn't been revoked by a password change.
async function requireAuth(req, res, next) {
  const payload = config.jwtSecret ? readToken(req) : null;
  if (!payload) {
    return res.status(401).json({ error: payload === undefined ? "Your session has expired. Please sign in again." : "Please sign in." });
  }
  const user = await User.findById(payload.sub).select("tokenVersion").lean();
  if (!user || (user.tokenVersion || 0) !== (payload.tv || 0)) {
    return res.status(401).json({ error: "Your session has expired. Please sign in again." });
  }
  req.userId = payload.sub;
  next();
}

// Attaches req.userId when a valid token is present but never blocks.
function optionalAuth(req, res, next) {
  const payload = config.jwtSecret && isConnected() ? readToken(req) : null;
  if (payload) req.userId = payload.sub;
  next();
}

module.exports = { signToken, requireDb, requireAuth, optionalAuth };
