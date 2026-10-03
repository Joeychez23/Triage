import { AlertTriangle, CheckCircle2, Gauge, Loader2, ScanSearch } from "lucide-react";
import { SOURCES } from "../lib/constants";

// Live status while boards are scouted and postings are X-rayed, then a
// compact summary row.
export default function SearchProgress({ search, fitPending, fitTotal, fitHint = "Add a profile" }) {
  if (!search) return null;
  const running = search.status === "running";
  const analyzing = search.status === "analyzing";
  const { analyzed, total } = search.progress || {};
  const steps = [
    ...search.sources.map((s) => ({
      key: s.id,
      label: SOURCES[s.id]?.label || s.label,
      state: s.status === "queued" || s.status === "running" ? "busy" : s.status === "failed" ? "bad" : s.status === "partial" ? "warn" : "done",
      detail: s.status === "failed" ? s.error || "Failed" : s.status === "queued" || s.status === "running" ? "Scouting…" : `${s.count} found`,
      color: SOURCES[s.id]?.color,
    })),
    {
      key: "xray",
      label: "X-ray",
      icon: ScanSearch,
      state: running ? "idle" : analyzing ? "busy" : "done",
      detail: running ? "Waiting" : total ? `${analyzed}/${total} read` : "Nothing to read",
    },
    {
      key: "fit",
      label: "Fit",
      icon: Gauge,
      state: fitTotal == null ? "idle" : fitPending > 0 ? "busy" : "done",
      detail: fitTotal == null ? fitHint : fitPending > 0 ? `${fitTotal - fitPending}/${fitTotal} scored` : `${fitTotal} scored`,
    },
  ];
  const pct = running ? 15 + 35 * (search.sources.filter((s) => !["queued", "running"].includes(s.status)).length / search.sources.length) : analyzing ? 50 + 50 * ((analyzed || 0) / Math.max(1, total || 1)) : 100;
  return (
    <div className={`search-progress ${running || analyzing ? "live" : "done"}`} aria-live="polite">
      {(running || analyzing) && (
        <div className="progress-bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${pct}%` }} />
        </div>
      )}
      <ol className="steps">
        {steps.map((s) => (
          <li key={s.key} className={`step step-${s.state}`} title={s.detail}>
            {s.state === "busy" ? (
              <Loader2 size={14} className="spin" aria-hidden />
            ) : s.state === "bad" || s.state === "warn" ? (
              <AlertTriangle size={14} aria-hidden />
            ) : s.icon ? (
              <s.icon size={14} aria-hidden />
            ) : s.state === "done" ? (
              <CheckCircle2 size={14} aria-hidden />
            ) : null}
            {s.color && <span className="source-dot" style={{ background: s.color }} aria-hidden />}
            <span className="step-label">{s.label}</span>
            <span className="step-detail">{s.detail}</span>
          </li>
        ))}
      </ol>
      {search.status === "failed" && <p className="notice notice-bad small">{search.error || "The search failed."}</p>}
    </div>
  );
}
