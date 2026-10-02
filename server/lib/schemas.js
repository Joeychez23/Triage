// Request validation with zod. Routes call parse() and get a 400 with a
// readable message when input is wrong.
const { z } = require("zod");
const config = require("../config");
const { SOURCE_IDS, COUNTRIES } = require("./sources");
const { SENIORITY } = require("../models/User");
const { STATUSES, OUTCOMES } = require("../models/Application");

const uniqCaseless = (list) => {
  const seen = new Set();
  return list.filter((s) => {
    const k = s.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};
const list = (maxItems, maxLen) => z.array(z.string().trim().min(1).max(maxLen)).max(maxItems).transform(uniqCaseless);
const weight = z.number().min(0).max(3);

const profile = z.object({
  headline: z.string().trim().max(120).default(""),
  targetRoles: list(8, 60).default([]),
  seniority: z.enum(SENIORITY).default(""),
  yearsExperience: z.number().min(0).max(60).nullable().default(null),
  skills: list(60, 40).default([]),
  locations: list(6, 80).default([]),
  arrangements: z
    .object({ remote: z.boolean().default(true), hybrid: z.boolean().default(true), onsite: z.boolean().default(true) })
    .default({ remote: true, hybrid: true, onsite: true }),
  minSalary: z.number().min(0).max(10_000_000).nullable().default(null),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).default("USD"),
  dealbreakers: list(10, 160).default([]),
  mustHaves: list(10, 160).default([]),
  resumeText: z.string().max(20000).default(""),
  resumeName: z.string().trim().max(200).default(""),
  weights: z
    .object({ skills: weight, level: weight, role: weight, location: weight, pay: weight, quality: weight, wants: weight })
    .partial()
    .default({}),
  hiddenCompanies: list(300, 160).default([]),
});

const searchParams = z.object({
  keywords: z.string().trim().min(2, "Enter a job title or keywords.").max(120),
  location: z.string().trim().max(120).default(""),
  country: z.enum(Object.keys(COUNTRIES)).default("us"),
  postedWithin: z.coerce.number().refine((v) => [1, 3, 7, 14, 30].includes(v), "Choose 1, 3, 7, 14, or 30 days.").default(7),
  remoteOnly: z.boolean().default(false),
  limit: z.coerce.number().int().min(5).max(config.maxResultsPerSource).default(25),
  sources: z
    .array(z.enum(SOURCE_IDS))
    .min(1, "Pick at least one job board.")
    .max(SOURCE_IDS.length)
    .transform((s) => [...new Set(s)])
    .default(SOURCE_IDS),
});

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id.");

const fitRequest = z.object({
  profile,
  jobIds: z.array(objectId).min(1).max(30),
});

const snapshot = z.object({
  title: z.string().trim().min(1).max(200),
  company: z.string().trim().min(1).max(160),
  location: z.string().trim().max(160).default(""),
  url: z.string().trim().max(2000).default(""),
  source: z.string().trim().max(40).default(""),
  companyLogo: z.string().trim().max(2000).default(""),
  salary: z
    .object({
      min: z.number().nullable().optional(),
      max: z.number().nullable().optional(),
      currency: z.string().max(3).optional(),
      period: z.string().max(10).optional(),
      source: z.string().max(20).optional(),
    })
    .nullable()
    .default(null),
  arrangement: z.string().max(20).default(""),
});

const date = z.union([z.coerce.date(), z.null()]);

const applicationCreate = z.object({
  jobId: z.string().max(40).default(""),
  job: snapshot,
  status: z.enum(STATUSES).default("saved"),
  fit: z.number().min(0).max(100).nullable().default(null),
  notes: z.string().max(10000).default(""),
});

const applicationUpdate = z
  .object({
    status: z.enum(STATUSES),
    outcome: z.enum(OUTCOMES),
    notes: z.string().max(10000),
    contact: z.string().max(300),
    excitement: z.number().int().min(0).max(5),
    appliedAt: date,
    followUpAt: date,
    order: z.number().finite(),
    job: snapshot.partial(),
  })
  .partial();

const savedSearchCreate = z.object({ name: z.string().trim().min(1).max(80), params: searchParams });

function parse(schema, data) {
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
  const err = new Error(`${path}${issue.message}`);
  err.status = 400;
  throw err;
}

module.exports = { parse, profile, searchParams, fitRequest, applicationCreate, applicationUpdate, savedSearchCreate, objectId };
