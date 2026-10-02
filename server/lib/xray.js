// Job X-ray: judgments about a posting on its own, independent of who is
// reading it. One Jev request per job; results are stored on the job and
// shared by every user who sees it.
const jev = require("./jev");
const { findSalaryCandidates, parseSalaryText } = require("./salary");

const XRAY_VERSION = 2;
const DESCRIPTION_CHARS = 9000;

const ARRANGEMENT = {
  remote: "Fully remote: the employee can work from home all or nearly all of the time. Occasional travel or offsites still count. A listed location may only be for time zone, state eligibility, or payroll.",
  hybrid: "Hybrid: a regular mix of office days and remote days, such as 2 or 3 days a week in an office.",
  onsite: "On-site: the work happens at a specific office, store, site, hospital, or facility every work day.",
  unclear: "The posting does not say whether the work is remote, hybrid, or on-site.",
};

const SENIORITY = {
  intern: "Internship, co-op, or apprenticeship for students",
  entry: "Entry level or junior: new graduates or about 0 to 2 years of experience",
  mid: "Mid level: about 2 to 5 years of experience, works independently",
  senior: "Senior individual contributor: about 5 to 8 years, owns large pieces of work and mentors others",
  lead: "Staff, principal, lead, or architect individual contributor who sets direction across teams",
  manager: "People manager who directly manages a team, such as a manager, head of, or director",
  executive: "Executive leadership such as VP, C-level, or general manager",
};

const EMPLOYMENT = {
  full_time: "Full-time permanent employment",
  part_time: "Part-time employment",
  contract: "Contract, freelance, consulting, or contract-to-hire",
  temporary: "Temporary or seasonal",
  internship: "Internship or co-op",
  not_stated: "The posting does not say",
};

const YEARS = {
  not_stated: "No number of years of experience is mentioned",
  "0_2": "Less than 3 years, for example 'new graduates', '1+ years', or '2 years'",
  "3_4": "3 or 4 years",
  "5_7": "5, 6, or 7 years",
  "8_plus": "8 or more years",
};

const SPONSORSHIP = {
  offers: "Says the employer will sponsor work visas, or welcomes candidates who need sponsorship",
  will_not: "Says the employer will not sponsor visas, or candidates must already be authorized to work",
  clearance: "Requires a security clearance or a specific citizenship",
  not_mentioned: "Says nothing about visas, sponsorship, work authorization, citizenship, or clearance",
};

const DEGREE = {
  none: "No education requirement is mentioned, or the posting says no degree is needed",
  flexible: "A degree is preferred, or required 'or equivalent experience'",
  bachelors: "A bachelor's degree is required with no alternative",
  advanced: "A master's degree, PhD, or professional degree (such as JD or MD) is required",
};

function xrayQuestions(job, salaryCandidates) {
  const q = {
    arrangement: {
      type: "choice",
      instructions: "Where does the job in `job` expect the employee to work? Use `job.location`, `job.title`, and `job.description`.",
      criteria: ARRANGEMENT,
    },
    seniority: {
      type: "choice",
      instructions: "What experience level is the job in `job` hiring for? Judge from the title, the years of experience asked for, and the responsibilities.",
      criteria: SENIORITY,
    },
    employment: {
      type: "choice",
      instructions: "What kind of employment does `job` offer? Use `job.employment_type` if present, otherwise the description.",
      criteria: EMPLOYMENT,
    },
    years: {
      type: "choice",
      instructions: "How many years of professional experience does `job` require in its main requirements? Ignore years asked for individual tools if a general requirement is given. If the years depend on the degree, use the years for a bachelor's degree.",
      criteria: YEARS,
    },
    sponsorship: {
      type: "choice",
      instructions: "What does `job` say about work authorization, visa sponsorship, citizenship, or security clearance?",
      criteria: SPONSORSHIP,
    },
    degree: {
      type: "choice",
      instructions: "What education does `job` require?",
      criteria: DEGREE,
    },
    clarity: {
      type: "score",
      instructions: "How clearly does `job.description` explain what the person will do day to day and what they need to bring?",
      criteria: [
        "Vague: mostly company boilerplate or buzzwords, and the actual work is unclear",
        "Somewhat clear: the general area of work is clear, but responsibilities or requirements are thin",
        "Clear: specific responsibilities and specific requirements",
        "Very clear: specific responsibilities and requirements plus team or project context and what success looks like",
      ],
    },
    red_flags: {
      type: "score",
      instructions: "How serious are the warning signs for a job seeker in `job`?",
      criteria: [
        "None: a normal, credible posting",
        "Minor: hype words such as 'rockstar', 'ninja', 'work hard play hard', or 'we're a family', or an unusually long wish list of skills",
        "Serious: unpaid or commission-only pay, a title that contradicts the requirements (such as 'entry level' asking for 5+ years), or vague duties with pressure to apply fast",
        "Severe: signs of a scam or pyramid scheme, asks for payment or bank details to apply, or the job looks fake",
      ],
    },
    intensity: {
      type: "score",
      instructions: "How demanding are the hours and pace described in `job`?",
      criteria: [
        "Flexible: mentions flexible hours, work-life balance, or a sustainable pace",
        "Normal: no signals about hours or pace either way",
        "Demanding: fast-paced, tight deadlines, occasional on-call, evenings, or frequent travel",
        "Intense: long hours, weekends, regular on-call or overnight shifts, or 'hustle' language",
      ],
    },
  };
  // Select instead of generate: Jev picks which code-found money span is the
  // pay for this role, if any.
  if (salaryCandidates.length) {
    const criteria = {};
    salaryCandidates.forEach((c, i) => {
      criteria[`c${i}`] = { amount: c.span, context: c.context };
    });
    criteria.none = "None of these is the pay for this role (for example a bonus, a funding round, revenue, or a benefit amount)";
    q.pay = {
      type: "choice",
      instructions: "Which option states the base pay or pay range for the role in `job`?",
      criteria,
    };
  }
  return q;
}

function xrayState(job) {
  return {
    job: {
      title: job.title,
      company: job.company,
      location: job.location || "Not listed",
      employment_type: job.employmentType || undefined,
      description: (job.description?.text || "").slice(0, DESCRIPTION_CHARS),
    },
  };
}

function readXray(answers, salaryCandidates) {
  const a = (k) => answers[k];
  const out = {
    v: XRAY_VERSION,
    arrangement: jev.choice(a("arrangement")) || "unclear",
    arrangementP: jev.probs(a("arrangement")),
    seniority: jev.choice(a("seniority")),
    seniorityConfidence: jev.round(a("seniority")?.confidence ?? 0),
    employment: jev.choice(a("employment")),
    years: jev.choice(a("years")),
    sponsorship: jev.choice(a("sponsorship")),
    degree: jev.choice(a("degree")),
    clarity: jev.round(jev.scoreNorm(a("clarity"), 3)),
    redFlags: jev.round(jev.scoreNorm(a("red_flags"), 3)),
    intensity: jev.round(jev.scoreNorm(a("intensity"), 3)),
    at: new Date(),
  };
  const pay = a("pay");
  if (pay?.choice && pay.choice !== "none") {
    const idx = Number(pay.choice.slice(1));
    const pick = salaryCandidates[idx];
    const p = pay.probabilities?.[pay.choice] ?? 0;
    const parsed = pick ? parseSalaryText(pick.span) : null;
    if (parsed && p >= 0.55) out.pay = { ...parsed, source: "extracted", text: pick.span, p: jev.round(p) };
  }
  return out;
}

// Runs the X-ray for one job. Returns the analysis object.
async function xray(job, { signal } = {}) {
  const candidates = job.salary ? [] : findSalaryCandidates(job.description?.text || "");
  const { answers } = await jev.ask(xrayState(job), xrayQuestions(job, candidates), { signal });
  return readXray(answers, candidates);
}

module.exports = { xray, xrayQuestions, xrayState, readXray, XRAY_VERSION, SENIORITY, ARRANGEMENT };
