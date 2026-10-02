import { Ban, CircleCheck, CircleDashed, CircleHelp, Sparkles } from "lucide-react";
import FitRing from "./FitRing";
import { DIMENSIONS } from "../lib/constants";
import { DEALBREAKER_HIT, DEALBREAKER_MAYBE, MUST_HAVE_MET, fitLabel } from "../lib/fit";
import { Link } from "../hooks/useRouter";

const missingReason = {
  skills: "Add skills or a resume",
  level: "Add your experience level",
  role: "Add target roles",
  location: "Waiting for the X-ray",
  pay: "No pay listed, or no salary floor set",
  quality: "Waiting for the X-ray",
  wants: "Add must-haves to your profile",
};

// The Fit Lens: overall score, each dimension, and dealbreaker / must-have
// checks. Dimension values come from Jev; weights come from the profile.
export default function FitPanel({ scored, fit, profile, scoring, ready, error, signedIn, onRequireAccount }) {
  if (!ready) {
    return (
      <section className="panel fit-panel empty">
        <div className="panel-title">
          <Sparkles size={16} aria-hidden /> Fit Lens
        </div>
        <p className="muted">
          Tell Triage what you're after and every job gets a fit score: skills, level, role, location, pay, and your own dealbreakers.
        </p>
        {signedIn ? (
          <Link to="/profile" className="btn btn-sm btn-primary">
            Build your profile
          </Link>
        ) : (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => onRequireAccount("Create a free account to build your profile and see how well each job fits you.", { mode: "register" })}>
            Sign up to see your fit
          </button>
        )}
      </section>
    );
  }
  const score = scored?.score ?? null;
  const { label } = scored?.hit ? { label: "Dealbreaker" } : fitLabel(score);
  const weights = profile.weights || {};
  return (
    <section className="panel fit-panel">
      <div className="fit-head">
        <FitRing score={score} size={76} stroke={7} loading={scoring && !fit} hit={scored?.hit} />
        <div>
          <div className="panel-title">
            <Sparkles size={16} aria-hidden /> Fit Lens
          </div>
          <p className="fit-label">{fit ? label : scoring ? "Scoring…" : error ? "Couldn't score" : "Not scored yet"}</p>
          {error && !fit && <p className="small bad-text">{error}</p>}
        </div>
      </div>
      {fit && (
        <ul className="dims">
          {DIMENSIONS.map(({ id, label: dimLabel, hint }) => {
            const v = scored?.dims?.[id];
            const w = Number(weights[id]) || 0;
            return (
              <li key={id} className={`dim ${w === 0 ? "off" : ""}`} title={hint}>
                <span className="dim-label">{dimLabel}</span>
                <span className="dim-bar" aria-hidden>
                  {v != null && <span className="dim-fill" style={{ width: `${Math.round(v * 100)}%`, "--v": v }} />}
                </span>
                <span className="dim-value">{w === 0 ? "off" : v == null ? <span className="muted" title={missingReason[id]}>—</span> : Math.round(v * 100)}</span>
              </li>
            );
          })}
        </ul>
      )}
      {fit && scored?.dealbreakers?.length > 0 && (
        <div className="checks">
          <h4>Dealbreakers</h4>
          <ul>
            {scored.dealbreakers.map((d) => (
              <li key={d.text} className={d.p >= DEALBREAKER_HIT ? "bad" : d.p >= DEALBREAKER_MAYBE ? "warn" : "ok"}>
                {d.p >= DEALBREAKER_HIT ? <Ban size={15} /> : d.p >= DEALBREAKER_MAYBE ? <CircleHelp size={15} /> : <CircleCheck size={15} />}
                <span>{d.text}</span>
                <small>{d.p >= DEALBREAKER_HIT ? "Present" : d.p >= DEALBREAKER_MAYBE ? "Possibly" : "Not found"}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
      {fit && scored?.mustHaves?.length > 0 && (
        <div className="checks">
          <h4>Must-haves</h4>
          <ul>
            {scored.mustHaves.map((m) => (
              <li key={m.text} className={m.p >= MUST_HAVE_MET ? "ok" : m.p >= 0.35 ? "warn" : "muted"}>
                {m.p >= MUST_HAVE_MET ? <CircleCheck size={15} /> : <CircleDashed size={15} />}
                <span>{m.text}</span>
                <small>{m.p >= MUST_HAVE_MET ? "Offered" : m.p >= 0.35 ? "Unclear" : "Not mentioned"}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
