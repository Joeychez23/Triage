// Board colors are categorical chart slots 1-3 (validated for color-vision
// deficiency), so a board keeps one color everywhere, charts included.
export const SOURCES = {
  linkedin: { label: "LinkedIn", color: "var(--series-1)" },
  indeed: { label: "Indeed", color: "var(--series-2)" },
  glassdoor: { label: "Glassdoor", color: "var(--series-3)" },
};

export const ARRANGEMENTS = {
  remote: { label: "Remote", tone: "good" },
  hybrid: { label: "Hybrid", tone: "info" },
  onsite: { label: "On-site", tone: "neutral" },
  unclear: { label: "Work style unclear", tone: "muted" },
};

export const SENIORITY = {
  intern: "Intern",
  entry: "Entry level",
  mid: "Mid level",
  senior: "Senior",
  lead: "Staff / Lead",
  manager: "Manager",
  executive: "Executive",
};

export const EMPLOYMENT = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  temporary: "Temporary",
  internship: "Internship",
  not_stated: "Not stated",
};

export const YEARS = {
  not_stated: "Not stated",
  "0_2": "0–2 years",
  "3_4": "3–4 years",
  "5_7": "5–7 years",
  "8_plus": "8+ years",
};

export const SPONSORSHIP = {
  offers: { label: "Sponsors visas", tone: "good" },
  will_not: { label: "No visa sponsorship", tone: "warn" },
  clearance: { label: "Clearance or citizenship required", tone: "warn" },
  not_mentioned: { label: "Visa not mentioned", tone: "muted" },
};

export const DEGREE = {
  none: "No degree required",
  flexible: "Degree or equivalent",
  bachelors: "Bachelor's required",
  advanced: "Advanced degree required",
};

export const STATUSES = [
  { id: "saved", label: "Saved", hint: "Worth a closer look" },
  { id: "applied", label: "Applied", hint: "Waiting to hear back" },
  { id: "interviewing", label: "Interviewing", hint: "In conversation" },
  { id: "offer", label: "Offer", hint: "Decision time" },
  { id: "closed", label: "Closed", hint: "Wrapped up" },
];

export const OUTCOMES = {
  hired: "Hired",
  rejected: "Rejected",
  withdrawn: "Withdrew",
  ghosted: "Ghosted",
};

export const COUNTRIES = [
  ["us", "United States"], ["ca", "Canada"], ["uk", "United Kingdom"], ["ie", "Ireland"], ["au", "Australia"],
  ["nz", "New Zealand"], ["de", "Germany"], ["fr", "France"], ["nl", "Netherlands"], ["es", "Spain"],
  ["it", "Italy"], ["se", "Sweden"], ["ch", "Switzerland"], ["in", "India"], ["sg", "Singapore"],
  ["mx", "Mexico"], ["br", "Brazil"], ["za", "South Africa"], ["ae", "United Arab Emirates"],
];

export const POSTED = [
  [1, "Past 24 hours"],
  [3, "Past 3 days"],
  [7, "Past week"],
  [14, "Past 2 weeks"],
  [30, "Past month"],
];

export const DEFAULT_WEIGHTS = { skills: 3, level: 2, role: 2, location: 2, pay: 1, quality: 1, wants: 2 };

export const DIMENSIONS = [
  { id: "skills", label: "Skills", hint: "How much of the core requirements your skills cover" },
  { id: "level", label: "Level", hint: "Whether the seniority matches your experience" },
  { id: "role", label: "Role", hint: "How close the role is to what you're targeting" },
  { id: "location", label: "Location", hint: "Work style and commute against your preferences" },
  { id: "pay", label: "Pay", hint: "Posted pay against your salary floor" },
  { id: "quality", label: "Posting", hint: "Clarity of the posting, minus red flags" },
  { id: "wants", label: "Must-haves", hint: "How many of your must-haves the posting offers" },
];

export const EMPTY_PROFILE = {
  headline: "",
  targetRoles: [],
  seniority: "",
  yearsExperience: null,
  skills: [],
  locations: [],
  arrangements: { remote: true, hybrid: true, onsite: true },
  minSalary: null,
  currency: "USD",
  dealbreakers: [],
  mustHaves: [],
  resumeText: "",
  resumeName: "",
  weights: { ...DEFAULT_WEIGHTS },
  hiddenCompanies: [],
};
