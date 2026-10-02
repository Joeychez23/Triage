// Requirement Check: code pulls requirement bullets out of the description;
// Jev judges each one against the candidate (met? must-have? actually a
// qualification?) and picks which of the candidate's skills to lead with.
const jev = require("./jev");
const { candidateState } = require("./fit");
const { extractSkills, canonicalSkill } = require("./skills");

const MAX_REQUIREMENTS = 24;
const MAX_SKILLS = 20;

const REQ_SECTION = /require|qualif|skills|experience|you have|you bring|you.?ll need|you need|looking for|must|ideal|about you|who you are|preferred|nice to have|bonus|plus|competenc|education|knowledge|what we need|what you.?ll bring/i;
const SKIP_SECTION = /benefit|perk|we offer|what we offer|compensation|salary|pay range|about us|about the company|who we are|equal opportunity|eeo|diversity|accommodation|our values|why join|life at|culture|schedule|physical|working conditions|disclaimer/i;
const REQ_CUE = /experience|proficien|knowledge|degree|ability|able to|familiar|skill|years|understanding|expertise|certif|background in|fluen|bachelor|master|license|track record/i;

function extractRequirements(blocks) {
  const bullets = [];
  let section = "";
  for (const b of blocks || []) {
    if (b.t === "h") section = b.x;
    else if (b.t === "li") bullets.push({ section, text: b.x });
  }
  let picked = bullets.filter((i) => REQ_SECTION.test(i.section) && !SKIP_SECTION.test(i.section));
  if (picked.length < 3) {
    picked = bullets.filter((i) => !SKIP_SECTION.test(i.section) && REQ_CUE.test(i.text));
  }
  if (picked.length < 3) {
    const sentences = (blocks || [])
      .filter((b) => b.t === "p")
      .flatMap((b) => b.x.split(/(?<=[.!?])\s+(?=[A-Z])/))
      .filter((s) => s.length > 25 && s.length < 320 && REQ_CUE.test(s))
      .map((text) => ({ section: "", text }));
    picked = [...picked, ...sentences];
  }
  const seen = new Set();
  return picked
    .map((i) => ({ section: i.section.slice(0, 80), text: i.text.slice(0, 320) }))
    .filter((i) => {
      const k = i.text.toLowerCase();
      if (seen.has(k) || i.text.length < 6) return false;
      seen.add(k);
      return true;
    })
    .slice(0, MAX_REQUIREMENTS);
}

const MET_LEVELS = [
  "Not met: nothing in the candidate's skills, experience, or resume shows it",
  "Weak: related experience, but not the specific skill, tool, or level asked for",
  "Partly met: has the skill or experience, but less of it than asked (for example fewer years)",
  "Met: the candidate clearly has this",
];

function requirementQuestions(requirements, skills) {
  const q = {};
  requirements.forEach((_, i) => {
    q[`r${i}:met`] = {
      type: "score",
      instructions: `How well does \`candidate\` meet the requirement in \`requirements[${i}].text\`? Use the candidate's skills, years of experience, and resume.`,
      criteria: MET_LEVELS,
    };
    q[`r${i}:hard`] = {
      type: "noul",
      instructions: `Is \`requirements[${i}]\` a must-have qualification rather than a preferred, bonus, or nice-to-have one? Use its \`section\` heading and its wording.`,
    };
    q[`r${i}:qual`] = {
      type: "noul",
      instructions: `Is \`requirements[${i}].text\` a qualification the candidate must bring, such as a skill, experience, education, certification, or trait, rather than a job duty, a benefit, or information about the company?`,
    };
  });
  skills.forEach((_, j) => {
    q[`s${j}`] = {
      type: "noul",
      instructions: `Is the skill \`candidate.skills[${j}]\` asked for, or clearly useful, in this job based on \`job.title\` and \`requirements\`?`,
    };
  });
  return q;
}

function readRequirements(answers, requirements, skills) {
  const items = requirements.map((r, i) => {
    const met = answers[`r${i}:met`];
    return {
      ...r,
      met: jev.round(jev.scoreNorm(met, 3) ?? 0),
      metLevel: met ? Math.round(met.score) : 0,
      confidence: jev.round(met?.confidence ?? 0),
      hard: jev.round(jev.noul(answers[`r${i}:hard`]) ?? 0.5),
      qualification: jev.round(jev.noul(answers[`r${i}:qual`]) ?? 1),
    };
  });
  const leadWith = skills
    .map((name, j) => ({ name, p: jev.noul(answers[`s${j}`]) ?? 0 }))
    .filter((s) => s.p >= 0.6)
    .sort((a, b) => b.p - a.p)
    .map((s) => s.name);
  return { items, leadWith };
}

// Lexicon skills the job mentions that the profile doesn't list or show.
function missingKeywords(job, profile) {
  const mine = new Set(
    [...(profile.skills || []).map(canonicalSkill), ...extractSkills(profile.resumeText || "", { max: 80 })].map((s) =>
      s.toLowerCase()
    )
  );
  return (job.skills || []).filter((s) => !mine.has(s.toLowerCase())).slice(0, 12);
}

async function checkRequirements(job, profile, { signal } = {}) {
  const requirements = extractRequirements(job.description?.blocks);
  const skills = (profile.skills || []).slice(0, MAX_SKILLS);
  const missing = missingKeywords(job, profile);
  if (!requirements.length && !skills.length) return { items: [], leadWith: [], missing };
  const state = {
    candidate: candidateState(profile),
    job: { title: job.title, company: job.company },
    requirements,
  };
  const { answers } = await jev.ask(state, requirementQuestions(requirements, skills), { signal });
  return { ...readRequirements(answers, requirements, skills), missing };
}

module.exports = { checkRequirements, extractRequirements, requirementQuestions, readRequirements, missingKeywords };
