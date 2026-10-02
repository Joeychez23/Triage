const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env"), quiet: true });

const num = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const config = {
  // API_PORT wins so a PORT meant for the React dev server isn't picked up here.
  port: num(process.env.API_PORT || process.env.PORT, 8080),
  isProduction: process.env.NODE_ENV === "production",

  typesafeApiKey: process.env.TYPESAFE_API_KEY || "",
  typesafeUrl: process.env.TYPESAFE_URL || "https://api.typesafe.ai/v1/systemone",
  jevModel: process.env.JEV_MODEL || "jev-latest",
  jevConcurrency: num(process.env.JEV_CONCURRENCY, 8),

  apifyToken: process.env.APIFY_TOKEN || "",
  // Actor overrides let you swap a scraper without touching code.
  actors: {
    linkedin: process.env.APIFY_LINKEDIN_ACTOR || "valig/linkedin-jobs-scraper",
    indeed: process.env.APIFY_INDEED_ACTOR || "valig/indeed-jobs-scraper",
    glassdoor: process.env.APIFY_GLASSDOOR_ACTOR || "valig/glassdoor-jobs-scraper",
  },
  // Hard ceiling on what a single scraper run may charge your Apify account.
  maxChargePerRunUsd: num(process.env.APIFY_MAX_CHARGE_PER_RUN_USD, 0.25),
  maxResultsPerSource: num(process.env.MAX_RESULTS_PER_SOURCE, 50),
  searchCacheHours: num(process.env.SEARCH_CACHE_HOURS, 6),
  guestSearchesPerHour: num(process.env.GUEST_SEARCHES_PER_HOUR, 6),
  userSearchesPerDay: num(process.env.USER_SEARCHES_PER_DAY, 40),

  mongoUri: process.env.MONGODB_URI || "",
  mongoDb: process.env.MONGODB_DB || "triage_jobs",
  jwtSecret: process.env.JWT_SECRET || "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
};

config.jevEnabled = Boolean(config.typesafeApiKey);
config.apifyEnabled = Boolean(config.apifyToken);
// Accounts need both a database and a signing secret; without them the app
// still runs in guest mode with in-memory storage.
config.accountsEnabled = Boolean(config.mongoUri && config.jwtSecret);

if (!config.apifyEnabled) console.warn("APIFY_TOKEN is not set: live job searches are disabled.");
if (!config.jevEnabled) console.warn("TYPESAFE_API_KEY is not set: Jev analysis and fit scoring are disabled.");

module.exports = config;
