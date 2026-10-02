import { useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, Building2, Check, Clock, EyeOff, Link2, MapPin, Users, Wallet } from "lucide-react";
import CompanyMark from "./CompanyMark";
import SourceBadges from "./SourceBadge";
import FitPanel from "./FitPanel";
import XrayFacts from "./XrayFacts";
import RequirementCheck from "./RequirementCheck";
import DescriptionBlocks from "./DescriptionBlocks";
import TrackButton from "./TrackButton";
import Chip from "./Chip";
import { useJob } from "../hooks/useSearches";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { ago, annualize, money, salaryText } from "../lib/format";
import { canonicalSkill } from "../lib/skills";

function PayPanel({ salary, profile }) {
  if (!salary) {
    return (
      <section className="panel pay">
        <div className="panel-title">
          <Wallet size={16} aria-hidden /> Pay
        </div>
        <p className="muted small">No pay is listed, and Jev didn't find a pay range in the description.</p>
      </section>
    );
  }
  const annual = annualize(salary);
  const floor = Number(profile.minSalary) || null;
  const sameCurrency = (salary.currency || "USD") === (profile.currency || "USD");
  const sourceLabel = { employer: "Posted by the employer", estimated: "Glassdoor estimate", extracted: "Found in the description by Jev" }[salary.source] || "";
  const max = annual ? Math.max(annual.max, floor || 0) * 1.15 : 1;
  return (
    <section className="panel pay">
      <div className="panel-title">
        <Wallet size={16} aria-hidden /> Pay
      </div>
      <p className="pay-amount">{salaryText(salary, { compact: false })}</p>
      <p className="muted small">
        {sourceLabel}
        {annual && salary.period !== "year" ? ` · about ${money(annual.min, salary.currency)}–${money(annual.max, salary.currency)} a year` : ""}
      </p>
      {annual && floor && sameCurrency && (
        <div className="pay-scale" aria-label={`Your floor is ${money(floor, profile.currency)}`}>
          <span className="pay-range" style={{ left: `${(annual.min / max) * 100}%`, width: `${Math.max(1.5, ((annual.max - annual.min) / max) * 100)}%` }} />
          <span className="pay-floor" style={{ left: `${(floor / max) * 100}%` }}>
            <span>Your floor {money(floor, profile.currency)}</span>
          </span>
          <span className="pay-tick" style={{ left: `${(annual.min / max) * 100}%` }}>
            {money(annual.min, salary.currency)}
          </span>
          {annual.max !== annual.min && (
            <span className="pay-tick" style={{ left: `${(annual.max / max) * 100}%` }}>
              {money(annual.max, salary.currency)}
            </span>
          )}
        </div>
      )}
    </section>
  );
}

export default function JobDetail({ summary, jobId, scored, fit, scoring, fitError, fitReady, tracked, onClose, onRequireAccount, variant = "panel" }) {
  const { data: job, isLoading, isError, error } = useJob(jobId, summary);
  const { profile, updateProfile, health, status } = useAuth();
  const signedIn = status === "signedIn";
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const view = job || summary;
  const mySkills = useMemo(() => new Set((profile.skills || []).map((s) => canonicalSkill(s).toLowerCase())), [profile.skills]);

  if (!view) {
    return (
      <div className="job-detail empty">
        {isLoading ? <div className="spinner" aria-label="Loading" /> : <p className="muted">{isError ? error.message : "Job not found."}</p>}
      </div>
    );
  }

  const applyUrl = view.applyUrl || view.url;
  const hideCompany = () => {
    if (!signedIn) return onRequireAccount("Create a free account to hide companies from every search.", { mode: "register" });
    const name = view.company;
    updateProfile((p) => ({ hiddenCompanies: [...new Set([...(p.hiddenCompanies || []), name])] }));
    toast(`Hiding jobs from ${name}`, {
      action: { label: "Undo", onClick: () => updateProfile((p) => ({ hiddenCompanies: (p.hiddenCompanies || []).filter((c) => c !== name) })) },
    });
    onClose?.();
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/job/${view.id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast("Couldn't copy the link", { tone: "bad" });
    }
  };
  const addSkill = (skill) => {
    updateProfile((p) => ({ skills: [...(p.skills || []), skill] }));
    toast(`Added ${skill} to your skills`, { tone: "good" });
  };

  return (
    <div className={`job-detail variant-${variant}`}>
      <div className="detail-head">
        {onClose && (
          <button type="button" className="icon-btn detail-back" onClick={onClose} aria-label="Back to results">
            <ArrowLeft size={18} />
          </button>
        )}
        <CompanyMark name={view.company} logo={view.companyLogo} size={56} />
        <div className="detail-title">
          <h2>{view.title}</h2>
          <p className="detail-meta">
            <span>
              <Building2 size={14} aria-hidden /> {view.company}
              {view.companyRating ? <span className="rating"> ★ {view.companyRating.toFixed(1)}</span> : null}
            </span>
            {view.location && (
              <span>
                <MapPin size={14} aria-hidden /> {view.location}
              </span>
            )}
            <span>
              <Clock size={14} aria-hidden /> {ago(view.postedAt || view.firstSeenAt) || "Date unknown"}
            </span>
            {view.applicants && (
              <span>
                <Users size={14} aria-hidden /> {view.applicants}
              </span>
            )}
          </p>
          <SourceBadges source={view.source} alsoOn={view.alsoOn} links primaryUrl={view.url} />
        </div>
      </div>

      <div className="detail-actions">
        {applyUrl && (
          <a className="btn btn-primary" href={applyUrl} target="_blank" rel="noopener noreferrer">
            {view.easyApply ? "Easy apply" : "Apply"} <ArrowUpRight size={16} aria-hidden />
          </a>
        )}
        <TrackButton job={view} tracked={tracked} fit={scored?.score ?? null} onRequireAccount={onRequireAccount} />
        <button type="button" className="icon-btn" onClick={copyLink} title="Copy link" aria-label="Copy link to this job">
          {copied ? <Check size={18} /> : <Link2 size={18} />}
        </button>
        <button type="button" className="icon-btn" onClick={hideCompany} title={`Hide ${view.company}`} aria-label={`Hide jobs from ${view.company}`}>
          <EyeOff size={18} />
        </button>
      </div>

      <div className="detail-grid">
        <FitPanel scored={scored} fit={fit} profile={profile} scoring={scoring} ready={fitReady} error={fitError} signedIn={signedIn} onRequireAccount={onRequireAccount} />
        <XrayFacts analysis={view.analysis} />
        <PayPanel salary={view.salary} profile={profile} />
        <RequirementCheck jobId={view.id} profile={profile} onAddSkill={addSkill} jevEnabled={health?.jev !== false} signedIn={signedIn} onRequireAccount={onRequireAccount} />
      </div>

      {view.skills?.length > 0 && (
        <section className="detail-section">
          <h3>Skills mentioned</h3>
          <div className="chips">
            {view.skills.map((s) => (
              <Chip key={s} tone={mySkills.has(s.toLowerCase()) ? "good" : "neutral"} icon={mySkills.has(s.toLowerCase()) ? Check : undefined}>
                {s}
              </Chip>
            ))}
          </div>
        </section>
      )}

      {view.benefits?.length > 0 && (
        <section className="detail-section">
          <h3>Benefits</h3>
          <div className="chips">
            {view.benefits.map((b) => (
              <Chip key={b} tone="muted">
                {b}
              </Chip>
            ))}
          </div>
        </section>
      )}

      <section className="detail-section">
        <h3>About the role</h3>
        {job?.blocks ? (
          <DescriptionBlocks blocks={job.blocks} highlight={profile.skills} />
        ) : isError ? (
          <p className="muted">
            {error.message}{" "}
            {view.url && (
              <a href={view.url} target="_blank" rel="noopener noreferrer">
                Open the original posting
              </a>
            )}
          </p>
        ) : (
          <>
            <p className="muted">{view.snippet}</p>
            <div className="skeleton-lines" aria-busy="true">
              <span />
              <span />
              <span />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
