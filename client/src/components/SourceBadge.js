import { SOURCES } from "../lib/constants";

// Job board badges: the primary source plus boards that list the same job.
export default function SourceBadges({ source, alsoOn = [], links = false, primaryUrl }) {
  const seen = new Set([source]);
  const extra = alsoOn.filter((a) => a.source && !seen.has(a.source) && seen.add(a.source));
  const items = [{ source, url: primaryUrl }, ...extra];
  return (
    <span className="source-badges">
      {items.map(({ source: s, url }) => {
        const meta = SOURCES[s] || { label: s, color: "var(--text-3)" };
        const content = (
          <>
            <span className="source-dot" style={{ background: meta.color }} aria-hidden />
            {meta.label}
          </>
        );
        return links && url ? (
          <a key={s} className="source-badge" href={url} target="_blank" rel="noopener noreferrer" title={`Open on ${meta.label}`}>
            {content}
          </a>
        ) : (
          <span key={s} className="source-badge">
            {content}
          </span>
        );
      })}
    </span>
  );
}
