// Small labeled pill. tone: neutral | good | info | warn | bad | muted | accent
export default function Chip({ tone = "neutral", icon: Icon, children, title, className = "" }) {
  return (
    <span className={`chip chip-${tone} ${className}`} title={title}>
      {Icon && <Icon size={13} aria-hidden />}
      {children}
    </span>
  );
}
