import { memo } from "react";
import { Ban } from "lucide-react";
import CompanyMark from "./CompanyMark";
import FitRing from "./FitRing";
import Chip from "./Chip";
import SourceBadges from "./SourceBadge";
import { ARRANGEMENTS, SENIORITY, STATUSES, YEARS } from "../lib/constants";
import { ago, salaryText } from "../lib/format";

const statusLabel = Object.fromEntries(STATUSES.map((s) => [s.id, s.label]));

function JobCard({ job, rank, scored, selected, onSelect, tracked, isNew, scoring, profileReady }) {
  const a = job.analysis;
  const arrangement = a ? ARRANGEMENTS[a.arrangement] : null;
  const pay = salaryText(job.salary);
  const hitBreaker = scored?.hit ? scored.dealbreakers.find((d) => d.p >= 0.6) : null;
  return (
    <article className={`job-card ${rank != null ? "has-rank" : ""} ${selected ? "selected" : ""} ${scored?.hit ? "is-dealbreaker" : ""}`}>
      <button type="button" className="job-card-hit" onClick={() => onSelect(job.id)} aria-pressed={selected} aria-label={`${job.title} at ${job.company}`} />
      {rank != null && (
        <span className="job-rank" aria-hidden>
          {String(rank).padStart(2, "0")}
        </span>
      )}
      <CompanyMark name={job.company} logo={job.companyLogo} size={44} />
      <div className="job-card-main">
        <div className="job-card-top">
          <h3 className="job-title">{job.title}</h3>
          {isNew && (
            <Chip tone="accent">New</Chip>
          )}
        </div>
        <p className="job-sub">
          <span className="job-company">{job.company}</span>
          {job.companyRating ? <span className="rating">★ {job.companyRating.toFixed(1)}</span> : null}
          {job.location && <span className="dot-sep">{job.location}</span>}
        </p>
        <div className="chips">
          {arrangement && a.arrangement !== "unclear" && <Chip tone={arrangement.tone}>{arrangement.label}</Chip>}
          {a?.seniority && <Chip>{SENIORITY[a.seniority]}</Chip>}
          {a?.years && a.years !== "not_stated" && <Chip tone="muted">{YEARS[a.years]}</Chip>}
          {pay && (
            <Chip tone="good" title={job.salary.source === "estimated" ? "Glassdoor estimate" : job.salary.source === "extracted" ? "Found in the description" : "Posted by the employer"}>
              {pay}
              {job.salary.source === "estimated" ? " est." : ""}
            </Chip>
          )}
          {a?.sponsorship === "will_not" && <Chip tone="warn">No sponsorship</Chip>}
          {a?.sponsorship === "clearance" && <Chip tone="warn">Clearance</Chip>}
          {a && a.redFlags >= 0.5 && (
            <Chip tone="bad">Red flags</Chip>
          )}
        </div>
        {hitBreaker && (
          <p className="dealbreaker-line">
            <Ban size={14} aria-hidden /> Dealbreaker: {hitBreaker.text}
          </p>
        )}
        <div className="job-card-foot">
          <SourceBadges source={job.source} alsoOn={job.alsoOn} />
          <span className="muted small">
            {ago(job.postedAt || job.firstSeenAt) || "Date unknown"}
          </span>
          {tracked && (
            <Chip tone="info">{statusLabel[tracked.status]}</Chip>
          )}
        </div>
      </div>
      <div className="job-card-fit">
        <FitRing score={scored?.score ?? null} loading={scoring && profileReady} hit={scored?.hit} />
      </div>
    </article>
  );
}

export default memo(JobCard);
