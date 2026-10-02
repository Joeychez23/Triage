const express = require("express");
const multer = require("multer");
const User = require("../models/User");
const { requireDb, requireAuth } = require("../middleware/auth");
const { uploadLimiter } = require("../middleware/limits");
const { parse, profile: profileSchema } = require("../lib/schemas");
const { extractResumeText, UnsupportedFileError } = require("../lib/resume");
const { extractSkills } = require("../lib/skills");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

function publicProfile(p) {
  const raw = p && typeof p.toObject === "function" ? p.toObject() : p || {};
  // Run stored data through the schema so the client always gets every field.
  const result = profileSchema.safeParse({
    ...raw,
    yearsExperience: raw.yearsExperience ?? null,
    minSalary: raw.minSalary ?? null,
  });
  return result.success ? result.data : profileSchema.parse({});
}

router.get("/", requireDb, requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ error: "Your account no longer exists." });
  res.json({ profile: publicProfile(user.profile) });
});

router.put("/", requireDb, requireAuth, async (req, res) => {
  const profile = parse(profileSchema, req.body?.profile);
  const user = await User.findByIdAndUpdate(req.userId, { $set: { profile } }, { returnDocument: "after", runValidators: true });
  if (!user) return res.status(401).json({ error: "Your account no longer exists." });
  res.json({ profile: publicProfile(user.profile) });
});

// Extracts text from an uploaded resume (PDF, DOCX, TXT, MD). The file is
// processed in memory and never stored; the client saves the text.
router.post("/resume", requireDb, requireAuth, uploadLimiter, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Choose a PDF, Word (.docx), or text file." });
  try {
    const text = await extractResumeText(req.file);
    if (text.length < 40) {
      return res.status(422).json({ error: "We couldn't read text from that file. If it's a scanned PDF, paste your resume text instead." });
    }
    res.json({ name: req.file.originalname.slice(0, 200), text: text.slice(0, 20000), truncated: text.length > 20000, skills: extractSkills(text, { max: 40 }) });
  } catch (err) {
    if (err instanceof UnsupportedFileError) return res.status(415).json({ error: err.message });
    console.warn(`Resume parse failed: ${err.message}`);
    res.status(422).json({ error: "We couldn't read that file. Try a different format or paste the text." });
  }
});

router.post("/skills", requireDb, requireAuth, (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.slice(0, 20000) : "";
  res.json({ skills: extractSkills(text, { max: 40 }) });
});

module.exports = router;
module.exports.publicProfile = publicProfile;
