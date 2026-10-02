// Combines Jev's raw judgments with the user's preferences into one fit
// score. Everything here is plain arithmetic in the browser, so changing a
// weight or a preference re-ranks results instantly with no API calls.
import { DEFAULT_WEIGHTS } from "./constants";
import { annualize } from "./format";

const LEVEL_VALUE = { match: 1, stretch: 0.7, below: 0.5, reach: 0.15 };
export const DEALBREAKER_HIT = 0.6;
export const DEALBREAKER_MAYBE = 0.35;
export const MUST_HAVE_MET = 0.6;

const clamp01 = (n) => Math.min(1, Math.max(0, n));

function levelValue(fit) {
  const p = fit?.levelP;
  if (p && Object.keys(p).length) {
    let total = 0;
    let weight = 0;
    for (const [k, v] of Object.entries(p)) {
      if (LEVEL_VALUE[k] == null) continue;
      total += LEVEL_VALUE[k] * v;
      weight += v;
    }
    if (weight > 0) return total / weight;
  }
  return fit?.level ? LEVEL_VALUE[fit.level] ?? null : null;
}

// Work style plus commute against what the user accepts.
export function locationValue(job, fit, profile) {
  const arrangement = job.analysis?.arrangement;
  if (!arrangement) return null;
  const ok = profile?.arrangements || { remote: true, hybrid: true, onsite: true };
  const commute = fit?.commute ?? null;
  switch (arrangement) {
    case "remote":
      return ok.remote ? 1 : 0.4;
    case "hybrid":
      if (!ok.hybrid) return ok.remote ? 0.15 : 0.3;
      return commute == null ? 0.65 : 0.2 + 0.8 * commute;
    case "onsite":
      if (!ok.onsite) return 0;
      return commute == null ? 0.55 : commute;
    default:
      // Unclear postings are usually on-site; score them a little softer.
      if (!ok.onsite && !ok.hybrid) return 0.25;
      return commute == null ? 0.5 : 0.25 + 0.6 * commute;
  }
}

export function payValue(job, profile) {
  const floor = Number(profile?.minSalary);
  if (!floor) return null;
  const annual = annualize(job.salary);
  if (!annual) return null;
  if ((job.salary.currency || "USD") !== (profile.currency || "USD")) return null;
  if (annual.mid >= floor) return 1;
  if (annual.max >= floor) return 0.8;
  // Below the floor: fade to 0 at 75% of it.
  return clamp01(1 - (floor - annual.max) / (0.25 * floor)) * 0.5;
}

export function qualityValue(job) {
  const a = job.analysis;
  if (!a || a.redFlags == null) return null;
  return clamp01(0.65 * (1 - a.redFlags) + 0.35 * (a.clarity ?? 0.5));
}

export function wantsValue(fit) {
  const list = fit?.mustHaves || [];
  if (!list.length) return null;
  return list.reduce((s, p) => s + p, 0) / list.length;
}

export function dimensions(job, fit, profile) {
  return {
    skills: fit?.skills ?? null,
    level: levelValue(fit),
    role: fit?.role ?? null,
    location: locationValue(job, fit, profile),
    pay: payValue(job, profile),
    quality: qualityValue(job),
    wants: wantsValue(fit),
  };
}

// Returns { score 0-100 | null, dims, dealbreakers: [{text, p}], hit, maybe }.
export function scoreJob(job, fit, profile) {
  const weights = { ...DEFAULT_WEIGHTS, ...(profile?.weights || {}) };
  const dims = dimensions(job, fit, profile);
  let total = 0;
  let weight = 0;
  for (const [k, v] of Object.entries(dims)) {
    const w = Number(weights[k]) || 0;
    if (v == null || w <= 0) continue;
    total += v * w;
    weight += w;
  }
  const dealbreakers = (profile?.dealbreakers || []).map((text, i) => ({ text, p: fit?.dealbreakers?.[i] ?? 0 }));
  const mustHaves = (profile?.mustHaves || []).map((text, i) => ({ text, p: fit?.mustHaves?.[i] ?? null }));
  const worst = dealbreakers.reduce((m, d) => Math.max(m, d.p), 0);
  const hit = worst >= DEALBREAKER_HIT;
  const maybe = !hit && worst >= DEALBREAKER_MAYBE;
  // Fit needs at least one judgment about the person, not just the posting.
  const personal = ["skills", "level", "role", "wants"].some((k) => dims[k] != null);
  let score = weight > 0 && fit && personal ? (total / weight) * 100 : null;
  if (score != null && hit) score *= 0.35;
  return { score: score == null ? null : Math.round(score), dims, dealbreakers, mustHaves, hit, maybe };
}

export function fitLabel(score) {
  if (score == null) return { label: "Not scored", tone: "muted" };
  if (score >= 80) return { label: "Strong fit", tone: "strong" };
  if (score >= 65) return { label: "Good fit", tone: "good" };
  if (score >= 45) return { label: "Possible", tone: "fair" };
  return { label: "Long shot", tone: "weak" };
}

// The fields that change Jev's fit answers (weights and hidden companies
// don't), used to key cached results.
export function fitProfile(profile) {
  const p = profile || {};
  return {
    headline: p.headline || "",
    targetRoles: p.targetRoles || [],
    seniority: p.seniority || "",
    yearsExperience: p.yearsExperience ?? null,
    skills: p.skills || [],
    locations: p.locations || [],
    dealbreakers: p.dealbreakers || [],
    mustHaves: p.mustHaves || [],
    resumeText: p.resumeText || "",
  };
}

export function profileReady(profile) {
  const p = profile || {};
  return Boolean(p.skills?.length || p.resumeText?.trim() || p.targetRoles?.length || p.headline?.trim() || p.dealbreakers?.length || p.mustHaves?.length);
}

export function profileCompleteness(profile) {
  const p = profile || {};
  const checks = [
    { id: "roles", label: "Target roles", done: Boolean(p.targetRoles?.length || p.headline?.trim()) },
    { id: "skills", label: "Skills", done: (p.skills?.length || 0) >= 3 },
    { id: "level", label: "Experience level", done: Boolean(p.seniority || p.yearsExperience != null) },
    { id: "resume", label: "Resume", done: Boolean(p.resumeText?.trim()) },
    { id: "where", label: "Locations", done: Boolean(p.locations?.length) },
    { id: "pay", label: "Salary floor", done: Boolean(p.minSalary) },
    { id: "wants", label: "Must-haves or dealbreakers", done: Boolean(p.mustHaves?.length || p.dealbreakers?.length) },
  ];
  return { checks, ratio: checks.filter((c) => c.done).length / checks.length };
}
