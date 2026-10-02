// The Triage mark ("Signal"): three dots, biggest first, like a sorted list
// read at a glance. Colors come from CSS variables, so the mark is orange in
// light mode and blue in dark mode.
export function LogoMark({ size = 28, title }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <rect width="64" height="64" rx="15" style={{ fill: "var(--logo-tile)" }} />
      <circle cx="20" cy="32" r="9.5" style={{ fill: "var(--logo-accent)" }} />
      <circle cx="38.5" cy="32" r="6.2" opacity="0.85" style={{ fill: "var(--logo-cream)" }} />
      <circle cx="51" cy="32" r="3.6" opacity="0.45" style={{ fill: "var(--logo-cream)" }} />
    </svg>
  );
}

export default function Logo() {
  return (
    <span className="logo">
      <LogoMark />
      <span className="logo-word">Triage</span>
    </span>
  );
}
