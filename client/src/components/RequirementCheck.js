import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, CircleCheckBig, CircleDot, CircleOff, CircleSlash, ListChecks, Plus } from "lucide-react";
import { api } from "../lib/api";
import { fitProfile, profileReady } from "../lib/fit";
import { hashOf } from "../lib/format";
import Chip from "./Chip";

const MET = [
  { label: "Not met", Icon: CircleOff, tone: "bad" },
  { label: "Weak", Icon: CircleSlash, tone: "warn" },
  { label: "Partly", Icon: CircleDot, tone: "fair" },
  { label: "Met", Icon: CircleCheckBig, tone: "good" },
];

// On demand: Jev checks every requirement bullet against the profile.
export default function RequirementCheck({ jobId, profile, onAddSkill, jevEnabled, signedIn, onRequireAccount }) {
  const [asked, setAsked] = useState(false);
  const fp = fitProfile(profile);
  const hash = hashOf(fp);
  const ready = profileReady(profile);
  const q = useQuery({
    queryKey: ["requirements", jobId, hash],
    queryFn: () => api(`/jobs/${jobId}/requirements`, { method: "POST", body: { profile: fp } }),
    enabled: asked && ready && Boolean(jobId),
    staleTime: Infinity,
    retry: false,
  });

  const items = (q.data?.items || []).filter((i) => i.qualification >= 0.5);
  const hard = items.filter((i) => i.hard >= 0.5);
  const soft = items.filter((i) => i.hard < 0.5);
  const metCount = (list) => list.filter((i) => i.metLevel >= 2).length;
  const mine = new Set((profile.skills || []).map((s) => s.toLowerCase()));

  return (
    <section className="panel req-check">
      <div className="panel-title">
        <ListChecks size={16} aria-hidden /> Requirement check
      </div>
      {!asked || !ready ? (
        <>
          <p className="muted small">See which requirements you already meet, which are gaps, and which of your skills to lead with.</p>
          {signedIn ? (
            <>
              <button type="button" className="btn btn-sm" onClick={() => setAsked(true)} disabled={!ready || !jevEnabled}>
                Check against my profile
              </button>
              {!ready && <p className="small muted">Add skills or a resume to your profile first.</p>}
            </>
          ) : (
            <button type="button" className="btn btn-sm" onClick={() => onRequireAccount("Create a free account to check jobs against your profile.", { mode: "register" })}>
              Sign up to check requirements
            </button>
          )}
        </>
      ) : q.isLoading ? (
        <div className="skeleton-lines" aria-busy="true" aria-label="Checking requirements">
          <span />
          <span />
          <span />
        </div>
      ) : q.isError ? (
        <div className="notice notice-bad">
          {q.error.message}{" "}
          <button type="button" className="link" onClick={() => q.refetch()}>
            Try again
          </button>
        </div>
      ) : (
        <>
          {items.length > 0 ? (
            <>
              <p className="req-summary">
                {hard.length > 0 && (
                  <span>
                    <strong>{metCount(hard)}</strong> of {hard.length} required met or partly met
                  </span>
                )}
                {soft.length > 0 && (
                  <span>
                    {" "}
                    · <strong>{metCount(soft)}</strong> of {soft.length} preferred
                  </span>
                )}
              </p>
              {[
                ["Required", hard],
                ["Preferred", soft],
              ].map(([title, list]) =>
                list.length ? (
                  <div key={title} className="req-group">
                    <h4>{title}</h4>
                    <ul className="req-list">
                      {list.map((item, i) => {
                        const m = MET[item.metLevel] || MET[0];
                        return (
                          <li key={i} className={`req req-${m.tone}`}>
                            <m.Icon size={16} aria-hidden />
                            <span className="req-text">{item.text}</span>
                            <span className="req-met">{m.label}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null
              )}
            </>
          ) : (
            <p className="muted small">This posting doesn't list requirements as bullets, so there was nothing to check.</p>
          )}
          {q.data?.leadWith?.length > 0 && (
            <div className="req-group">
              <h4>Lead with</h4>
              <div className="chips">
                {q.data.leadWith.map((s) => (
                  <Chip key={s} tone="good" icon={Check}>
                    {s}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          {q.data?.missing?.length > 0 && (
            <div className="req-group">
              <h4>Keywords you haven't listed</h4>
              <p className="small muted">If you have these, add them so your fit scores (and your resume) reflect it.</p>
              <div className="chips">
                {q.data.missing
                  .filter((s) => !mine.has(s.toLowerCase()))
                  .map((s) => (
                    <button key={s} type="button" className="chip chip-neutral chip-btn" onClick={() => onAddSkill(s)} title={`Add ${s} to your skills`}>
                      <Plus size={12} aria-hidden /> {s}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
