const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const Application = require("../models/Application");
const Search = require("../models/Search");
const { signToken, requireDb, requireAuth } = require("../middleware/auth");
const { authLimiter } = require("../middleware/limits");
const { publicProfile } = require("./profile");

const router = express.Router();
const BCRYPT_ROUNDS = 12;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// A real hash so failed logins for unknown emails take as long as wrong passwords.
const DUMMY_HASH = bcrypt.hashSync("triage-timing-guard", BCRYPT_ROUNDS);

const validPassword = (p) => typeof p === "string" && p.length >= 8 && p.length <= 128;
const session = (user) => ({
  token: signToken(user),
  user: user.toPublic(),
  profile: publicProfile(user.profile),
  savedSearches: (user.savedSearches || []).map(publicSaved),
});

const publicSaved = (s) => ({
  id: s._id.toString(),
  name: s.name,
  params: s.params,
  lastRunAt: s.lastRunAt,
  lastSearchId: s.lastSearchId ? s.lastSearchId.toString() : null,
  lastNewCount: s.lastNewCount || 0,
  createdAt: s.createdAt,
});

router.use(requireDb);

router.post("/register", authLimiter, async (req, res) => {
  const { email, password, name } = req.body || {};
  if (typeof email !== "string" || !EMAIL.test(email.trim()) || email.length > 254) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (!validPassword(password)) {
    return res.status(400).json({ error: "Use a password between 8 and 128 characters." });
  }
  const normalized = email.trim().toLowerCase();
  if (await User.exists({ email: normalized })) {
    return res.status(409).json({ error: "An account with that email already exists. Try signing in." });
  }
  try {
    const user = await User.create({
      email: normalized,
      name: typeof name === "string" ? name.trim().slice(0, 80) : "",
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    });
    res.status(201).json(session(user));
  } catch (err) {
    // Two sign-ups racing for the same email hit the unique index.
    if (err.code === 11000) return res.status(409).json({ error: "An account with that email already exists. Try signing in." });
    throw err;
  }
});

router.post("/login", authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Email and password are required." });
  }
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+passwordHash");
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) return res.status(401).json({ error: "That email and password don't match." });
  res.json(session(user));
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ error: "Your account no longer exists." });
  const { token, ...rest } = session(user);
  res.json(rest);
});

router.patch("/account", requireAuth, async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 80) : undefined;
  const user = await User.findByIdAndUpdate(req.userId, name === undefined ? {} : { $set: { name } }, { returnDocument: "after" });
  if (!user) return res.status(401).json({ error: "Your account no longer exists." });
  res.json({ user: user.toPublic() });
});

// Changing the password signs out every other session.
router.post("/password", authLimiter, requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!validPassword(newPassword)) return res.status(400).json({ error: "Use a new password between 8 and 128 characters." });
  const user = await User.findById(req.userId).select("+passwordHash");
  if (!user) return res.status(401).json({ error: "Your account no longer exists." });
  if (typeof currentPassword !== "string" || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return res.status(400).json({ error: "Your current password is incorrect." });
  }
  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  res.json({ token: signToken(user) });
});

// Deletes the account and everything stored for it.
router.delete("/account", requireAuth, async (req, res) => {
  await Promise.all([Application.deleteMany({ user: req.userId }), Search.deleteMany({ owner: req.userId })]);
  await User.findByIdAndDelete(req.userId);
  res.status(204).end();
});

module.exports = router;
module.exports.publicSaved = publicSaved;
