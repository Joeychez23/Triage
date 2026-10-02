// Fit Lens: judgments that compare a job with the job seeker's profile. Jev
// returns the raw dimensions; the client combines them with the user's
// weights, so moving a slider re-ranks results without new API calls.
const jev = require("./jev");
const { hashKey } = require("./cache");

const FIT_VERSION = 2;
const DESCRIPTION_CHARS = 7000;
const RESUME_CHARS = 4000;

const SENIORITY_LABEL = {
  intern: "Student or intern",
  entry: "Entry level (0-2 years)",
  mid: "Mid level (2-5 years)",
  senior: "Senior (5-8 years)",
  lead: "Staff, principal, or lead",
  manager: "People manager",
  executive: "Executive",
};

const has = (v) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== "");

function candidateState(profile) {
  const c = {};
  if (has(profile.headline)) c.headline = profile.headline;
  if (has(profile.targetRoles)) c.target_roles = profile.targetRoles;
  if (has(profile.seniority)) c.seniority = SENIORITY_LABEL[profile.seniority] || profile.seniority;
  if (has(profile.yearsExperience)) c.years_experience = profile.yearsExperience;
  if (has(profile.skills)) c.skills = profile.skills;
  if (has(profile.locations)) c.locations = profile.locations;
  if (has(profile.resumeText)) c.resume = profile.resumeText.slice(0, RESUME_CHARS);
  return c;
}

const jobState = (job) => ({
  title: job.title,
  company: job.company,
  location: job.location || "Not listed",
  description: (job.description?.text || "").slice(0, DESCRIPTION_CHARS),
});

// What the profile can support; questions without evidence are skipped
// rather than asked against an empty profile.
function capabilities(profile) {
  const background = has(profile.skills) || has(profile.resumeText);
  return {
    skills: background,
    level: has(profile.seniority) || has(profile.yearsExperience) || has(profile.resumeText),
    role: has(profile.targetRoles) || has(profile.headline),
    commute: has(profile.locations),
  };
}

function profileReady(profile) {
  const c = capabilities(profile || {});
  return c.skills || c.role || has(profile?.dealbreakers) || has(profile?.mustHaves);
}

function fitQuestions(profile) {
  const can = capabilities(profile);
  const q = {};
  if (can.skills) {
    q.skills = {
      type: "score",
      instructions: "How well do the skills and experience in `candidate` cover the core requirements of `job`? Focus on required skills, tools, and domain experience rather than nice-to-haves.",
      criteria: [
        "Little overlap: the job needs a mostly different skill set",
        "Some overlap, but most core requirements are missing",
        "Covers about half of the core requirements",
        "Covers most core requirements with a few gaps",
        "Covers essentially all core requirements",
      ],
    };
  }
  if (can.level) {
    q.level = {
      type: "choice",
      instructions: "Compare the experience level `job` is hiring for with the candidate's experience in `candidate`.",
      criteria: {
        below: "The job is clearly more junior than the candidate; they would be overqualified",
        match: "The job's level fits the candidate's experience",
        stretch: "The job is about one step above the candidate's experience: a reasonable stretch",
        reach: "The job asks for much more experience or seniority than the candidate has",
      },
    };
  }
  if (can.role) {
    q.role = {
      type: "score",
      instructions: "How closely does the role in `job` match the kind of work the candidate wants, described by `candidate.target_roles` and `candidate.headline`?",
      criteria: [
        "A different kind of role",
        "A related field, but a different role",
        "A similar role with a different focus or specialty",
        "The same kind of role",
      ],
    };
  }
  if (can.commute) {
    q.commute = {
      type: "noul",
      instructions: "Is the work location in `job.location` in or near at least one place in `candidate.locations`, close enough for a daily commute?",
      criteria: {
        true: "Same city or metro area as one of the candidate's places, or a nearby suburb",
        false: "A different metro area, state, or country from all of the candidate's places, or no location is listed",
      },
    };
  }
  (profile.dealbreakers || []).forEach((text, i) => {
    q[`d${i}`] = {
      type: "noul",
      instructions: { question: "The candidate will not accept a job with the condition below. Does `job` have this condition?", condition: text },
      criteria: {
        true: "The posting states or clearly implies that this condition applies to this job",
        false: "The posting does not mention the condition, or it clearly does not apply",
      },
    };
  });
  (profile.mustHaves || []).forEach((text, i) => {
    q[`m${i}`] = {
      type: "noul",
      instructions: { question: "The candidate requires the item below from any job they take. Does `job` offer or satisfy it?", requirement: text },
      criteria: {
        true: "The posting states or clearly implies it",
        false: "The posting does not mention it, or contradicts it",
      },
    };
  });
  return q;
}

function readFit(answers, profile) {
  const a = (k) => answers[k];
  const level = a("level");
  return {
    v: FIT_VERSION,
    skills: jev.round(jev.scoreNorm(a("skills"), 4)),
    skillsConfidence: jev.round(a("skills")?.confidence ?? null),
    level: jev.choice(level),
    levelP: jev.probs(level),
    role: jev.round(jev.scoreNorm(a("role"), 3)),
    commute: jev.round(jev.noul(a("commute"))),
    dealbreakers: (profile.dealbreakers || []).map((_, i) => jev.round(jev.noul(a(`d${i}`)) ?? 0)),
    mustHaves: (profile.mustHaves || []).map((_, i) => jev.round(jev.noul(a(`m${i}`)) ?? 0)),
  };
}

// A stable hash of everything in the profile that changes fit answers.
function profileHash(profile) {
  const p = profile || {};
  return hashKey(
    `fit${FIT_VERSION}`,
    JSON.stringify([
      p.headline || "",
      p.targetRoles || [],
      p.seniority || "",
      p.yearsExperience ?? "",
      p.skills || [],
      p.locations || [],
      (p.resumeText || "").slice(0, RESUME_CHARS),
      p.dealbreakers || [],
      p.mustHaves || [],
    ])
  ).slice(0, 24);
}

async function fit(job, profile, { signal } = {}) {
  const questions = fitQuestions(profile);
  if (!Object.keys(questions).length) return readFit({}, profile);
  const state = { candidate: candidateState(profile), job: jobState(job) };
  const { answers } = await jev.ask(state, questions, { signal });
  return readFit(answers, profile);
}

module.exports = { fit, fitQuestions, readFit, candidateState, profileHash, profileReady, capabilities, FIT_VERSION, SENIORITY_LABEL };
