// Job sources backed by Apify Actors. Each source turns search params into the
// Actor's input and maps one dataset item into Triage's job shape.
const config = require("../config");
const { parseSalaryText, fromStructured } = require("./salary");
const { describe, parseLocation, finalizeJob, REMOTE_HINT } = require("./normalize");
const { canonicalSkill, SKILL_NAMES } = require("./skills");

const COUNTRIES = {
  us: "United States", ca: "Canada", uk: "United Kingdom", ie: "Ireland", au: "Australia", nz: "New Zealand",
  de: "Germany", fr: "France", nl: "Netherlands", es: "Spain", it: "Italy", se: "Sweden", ch: "Switzerland",
  in: "India", sg: "Singapore", mx: "Mexico", br: "Brazil", za: "South Africa", ae: "United Arab Emirates",
};

const KNOWN_SKILLS = new Set(SKILL_NAMES);
const str = (v) => (v == null ? "" : String(v));
const date = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};
const values = (obj) => (obj && typeof obj === "object" ? Object.values(obj).map(str).filter(Boolean) : []);

const linkedin = {
  id: "linkedin",
  label: "LinkedIn",
  actor: () => config.actors.linkedin,
  buildInput({ keywords, location, country, postedWithin, remoteOnly }, limit) {
    const input = {
      keywords,
      location: location || COUNTRIES[country] || "United States",
      datePosted: postedWithin <= 1 ? "r86400" : postedWithin <= 7 ? "r604800" : "r2592000",
      limit,
    };
    // f_WT=2 is LinkedIn's "Remote" workplace filter.
    if (remoteOnly) input.urlParam = [{ key: "f_WT", value: "2" }];
    return input;
  },
  normalize(item) {
    if (!item?.id || !item.title) return null;
    const loc = parseLocation(item.location);
    const pay = parseSalaryText(item.salary);
    const level = str(item.experienceLevel);
    return finalizeJob({
      key: `linkedin:${item.id}`,
      source: "linkedin",
      sourceId: str(item.id),
      url: str(item.url),
      applyUrl: str(item.applyUrl),
      title: item.title,
      company: item.companyName,
      companyUrl: str(item.companyUrl),
      companyLogo: "",
      companyRating: null,
      location: str(item.location),
      ...loc,
      remoteHint: REMOTE_HINT.test(str(item.location)),
      employmentType: str(item.contractType),
      seniorityHint: /not applicable/i.test(level) ? "" : level,
      industry: str(item.sector || item.workType),
      salary: pay ? { ...pay, source: "employer", text: str(item.salary) } : null,
      postedAt: date(item.postedDate),
      applicants: str(item.applicationsCount),
      easyApply: /easy/i.test(str(item.applyType)),
      benefits: [],
      description: describe(item.descriptionHtml, item.description),
    });
  },
};

const indeed = {
  id: "indeed",
  label: "Indeed",
  actor: () => config.actors.indeed,
  buildInput({ keywords, location, country, postedWithin, remoteOnly }, limit) {
    const input = { country: country || "us", title: keywords, location: remoteOnly ? "remote" : location || "", limit };
    const windows = [1, 3, 7, 14];
    const fit = windows.find((w) => w >= postedWithin);
    if (fit) input.datePosted = String(fit);
    return input;
  },
  normalize(item) {
    if (!item?.key || !item.title || item.expired) return null;
    const l = item.location || {};
    const city = str(l.city);
    const region = str(l.admin1Code);
    const location = [city, region].filter(Boolean).join(", ") || str(l.countryName);
    const attributes = values(item.attributes);
    const base = item.baseSalary || {};
    const pay = fromStructured({ min: base.min, max: base.max, currency: base.currencyCode, period: base.unitOfWork });
    const employer = item.employer || {};
    return finalizeJob({
      key: `indeed:${item.key}`,
      source: "indeed",
      sourceId: str(item.key),
      url: str(item.url),
      applyUrl: str(item.jobUrl),
      title: item.title,
      company: employer.name,
      companyUrl: str(employer.companyPageUrl),
      companyLogo: str(employer.logoUrl),
      companyRating: Number(employer.ratingsValue) || null,
      location,
      city,
      region,
      country: str(l.countryCode),
      remoteHint: attributes.some((a) => /^remote/i.test(a)) || REMOTE_HINT.test(location),
      employmentType: values(item.jobTypes)[0] || attributes.find((a) => /full-time|part-time|contract|temporary|internship/i.test(a)) || "",
      seniorityHint: attributes.find((a) => /^(entry|mid|senior|junior)[- ]level$/i.test(a)) || "",
      industry: str(employer.industry),
      salary: pay ? { ...pay, source: "employer" } : null,
      postedAt: date(item.datePublished || item.dateOnIndeed),
      applicants: "",
      easyApply: false,
      benefits: values(item.benefits).slice(0, 12),
      extraSkills: attributes.map(canonicalSkill).filter((s) => KNOWN_SKILLS.has(s)),
      description: describe(item.description?.html, item.description?.text),
    });
  },
};

const glassdoor = {
  id: "glassdoor",
  label: "Glassdoor",
  actor: () => config.actors.glassdoor,
  buildInput({ keywords, location, country, postedWithin, remoteOnly }, limit) {
    const input = {
      keywords,
      location: location || COUNTRIES[country] || "United States",
      daysOld: postedWithin,
      sortBy: "date_desc",
      limit,
    };
    if (remoteOnly) input.remoteWorkType = true;
    return input;
  },
  normalize(item) {
    if (!item?.id || !item.title) return null;
    const employer = item.employer || {};
    const locationName = str(item.location?.name);
    const p = item.pay || {};
    const pay = fromStructured({ min: p.min, max: p.max, currency: p.currency, period: p.period });
    const age = Number(item.ageInDays);
    return finalizeJob({
      key: `glassdoor:${item.id}`,
      source: "glassdoor",
      sourceId: str(item.id),
      url: str(item.seoUrl || item.url),
      applyUrl: "",
      title: item.title,
      company: employer.name,
      companyUrl: str(employer.url),
      companyLogo: str(employer.logoUrl),
      companyRating: Number(item.rating) || null,
      location: locationName,
      ...parseLocation(locationName),
      remoteHint: REMOTE_HINT.test(locationName),
      employmentType: "",
      seniorityHint: "",
      industry: "",
      salary: pay ? { ...pay, source: /employer/i.test(str(p.source)) ? "employer" : "estimated" } : null,
      postedAt: Number.isFinite(age) ? new Date(Date.now() - age * 86400000) : null,
      applicants: "",
      easyApply: Boolean(item.easyApply),
      benefits: [],
      description: describe(item.description),
    });
  },
};

const SOURCES = { linkedin, indeed, glassdoor };
const SOURCE_IDS = Object.keys(SOURCES);

module.exports = { SOURCES, SOURCE_IDS, COUNTRIES };
