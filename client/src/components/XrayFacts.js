import { ARRANGEMENTS, DEGREE, EMPLOYMENT, SENIORITY, SPONSORSHIP, YEARS } from "../lib/constants";

const level = (v, labels) => (v == null ? null : labels[Math.min(labels.length - 1, Math.round(v * (labels.length - 1)))]);

// What Jev read out of the posting itself, independent of the viewer.
export default function XrayFacts({ analysis, pending }) {
  if (!analysis) {
    return (
      <section className="panel xray">
        <div className="panel-title">
          X-ray
        </div>
        <p className="muted small">{pending ? "Reading the posting…" : "No X-ray for this posting yet."}</p>
      </section>
    );
  }
  const a = analysis;
  const red = level(a.redFlags, ["None", "Minor", "Serious", "Severe"]);
  const facts = [
    ["Work style", ARRANGEMENTS[a.arrangement]?.label, a.arrangement === "remote" ? "good" : ""],
    ["Level", SENIORITY[a.seniority]],
    ["Employment", EMPLOYMENT[a.employment]],
    ["Experience", YEARS[a.years]],
    ["Education", DEGREE[a.degree]],
    ["Visa", SPONSORSHIP[a.sponsorship]?.label, SPONSORSHIP[a.sponsorship]?.tone],
    ["Pace", level(a.intensity, ["Flexible", "Normal", "Demanding", "Intense"]), a.intensity >= 0.6 ? "warn" : ""],
    ["Clarity", level(a.clarity, ["Vague", "Thin", "Clear", "Very clear"]), a.clarity < 0.35 ? "warn" : ""],
    ["Red flags", red, a.redFlags >= 0.5 ? "bad" : a.redFlags >= 0.3 ? "warn" : "good"],
  ].filter(([, v]) => v);
  return (
    <section className="panel xray">
      <div className="panel-title">
        X-ray
        <span className="muted small panel-sub">read from the posting by Jev</span>
      </div>
      <dl className="facts">
        {facts.map(([k, v, tone]) => (
          <div key={k} className={`fact ${tone ? `fact-${tone}` : ""}`}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
