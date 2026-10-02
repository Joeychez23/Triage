import { fitLabel } from "../lib/fit";

// Circular fit gauge. `score` is 0–100 or null (not scored yet).
export default function FitRing({ score, size = 52, stroke = 5, loading = false, hit = false, label = true }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const value = score == null ? 0 : Math.max(0, Math.min(100, score));
  const { tone, label: text } = hit ? { tone: "weak", label: "Dealbreaker" } : fitLabel(score);
  return (
    <span
      className={`fit-ring tone-${tone} ${loading ? "is-loading" : ""}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={score == null ? (loading ? "Scoring fit" : "Fit not scored") : `Fit ${score} out of 100, ${text}`}
      title={score == null ? (loading ? "Scoring fit…" : "Add a profile to score fit") : `${text} · ${score}/100`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle className="fit-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
        {score != null && (
          <circle
            className="fit-value"
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${(value / 100) * c} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      {label && <span className="fit-num">{score == null ? (loading ? "" : "–") : score}</span>}
    </span>
  );
}
