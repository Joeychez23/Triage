import { useEffect, useRef, useState } from "react";
import { Binoculars, ChartNoAxesColumn, KanbanSquare, LogOut, Moon, Sun, UserRound } from "lucide-react";
import Logo from "./Logo";
import { Link, useRouter } from "../hooks/useRouter";
import { useAuth } from "../hooks/useAuth";
import { initials } from "../lib/format";

const DATELINE = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

const NAV = [
  { to: "/", name: "hunt", label: "Hunt", Icon: Binoculars },
  { to: "/tracker", name: "tracker", label: "Tracker", Icon: KanbanSquare },
  { to: "/insights", name: "insights", label: "Insights", Icon: ChartNoAxesColumn },
  { to: "/profile", name: "profile", label: "Profile", Icon: UserRound },
];

export default function Header({ onSignIn, isDark, onToggleTheme }) {
  const { route } = useRouter();
  const { user, status, signOut, syncState } = useAuth();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenu(false);
    };
    const esc = (e) => e.key === "Escape" && setMenu(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  const active = route.name === "job" ? "hunt" : route.name;

  return (
    // A newspaper masthead: the dateline row scrolls away and the section bar
    // below the double rule stays pinned.
    <header className="app-header">
      <div className="masthead">
        <span className="masthead-note">{DATELINE}</span>
        <Link to="/" className="brand" aria-label="Triage home">
          <Logo />
        </Link>
        <span className="masthead-note masthead-note-end">LinkedIn, Indeed and Glassdoor</span>
      </div>
      <div className="header-bar">
        <nav className="main-nav" aria-label="Main">
          {NAV.map(({ to, name, label, Icon }) => (
            <Link key={name} to={to} className={`nav-link ${active === name ? "active" : ""}`} aria-current={active === name ? "page" : undefined}>
              <Icon size={17} aria-hidden />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <button type="button" className="icon-btn" onClick={onToggleTheme} aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"} title="Toggle theme">
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {status === "signedIn" ? (
            <div className="menu-wrap" ref={menuRef}>
              <button type="button" className="avatar-btn" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu} title={user.email}>
                <span className="avatar">{initials(user.name || user.email)}</span>
                {syncState === "saving" && <span className="sync-dot" aria-label="Saving" />}
              </button>
              {menu && (
                <div className="menu" role="menu">
                  <div className="menu-head">
                    <strong>{user.name || "Your account"}</strong>
                    <span className="muted small">{user.email}</span>
                  </div>
                  <Link to="/profile" className="menu-item" role="menuitem" onClick={() => setMenu(false)}>
                    <UserRound size={16} /> Profile & settings
                  </Link>
                  <button
                    type="button"
                    className="menu-item"
                    role="menuitem"
                    onClick={() => {
                      setMenu(false);
                      signOut();
                    }}
                  >
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button type="button" className="btn btn-sm btn-ghost-strong" onClick={onSignIn} disabled={status === "loading"}>
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
