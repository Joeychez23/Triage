import { useEffect, useRef, useState } from "react";
import { Briefcase, MapPin, Search, SlidersHorizontal } from "lucide-react";
import { COUNTRIES, POSTED, SOURCES } from "../lib/constants";
import { load, save } from "../lib/storage";

export const DEFAULT_PARAMS = {
  keywords: "",
  location: "",
  country: "us",
  postedWithin: 7,
  remoteOnly: false,
  limit: 25,
  sources: ["linkedin", "indeed", "glassdoor"],
};

// The hunt form: what, where, and which boards. Options live behind a toggle
// to keep the bar compact; the last-used options are remembered.
export default function SearchBar({ initial, onSearch, busy, disabled, maxResults = 50, compact = false, autoFocus = false }) {
  const [params, setParams] = useState(() => ({ ...DEFAULT_PARAMS, ...load("searchOptions", {}), ...(initial || {}) }));
  const [showOptions, setShowOptions] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (initial) setParams((p) => ({ ...p, ...initial }));
  }, [initial]);

  // Focus without scrolling, and only with a mouse/trackpad (a phone
  // keyboard popping up on load is unwelcome).
  useEffect(() => {
    if (autoFocus && window.matchMedia?.("(pointer: fine)").matches) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  useEffect(() => {
    const focus = () => inputRef.current?.focus();
    window.addEventListener("triage:focus-search", focus);
    return () => window.removeEventListener("triage:focus-search", focus);
  }, []);

  const set = (k, v) => setParams((p) => ({ ...p, [k]: v }));
  const toggleSource = (id) =>
    setParams((p) => ({ ...p, sources: p.sources.includes(id) ? p.sources.filter((s) => s !== id) : [...p.sources, id] }));

  const submit = (e) => {
    e.preventDefault();
    const keywords = params.keywords.trim();
    if (keywords.length < 2) return setError("Enter a job title or keywords.");
    if (!params.sources.length) return setError("Pick at least one job board.");
    setError("");
    const { country, postedWithin, remoteOnly, limit, sources } = params;
    save("searchOptions", { country, postedWithin, remoteOnly, limit, sources });
    onSearch({ ...params, keywords, location: params.location.trim() });
  };

  return (
    <form className={`search-bar ${compact ? "compact" : ""}`} onSubmit={submit} role="search">
      <div className="search-fields">
        <label className="search-field">
          <Briefcase size={18} aria-hidden />
          <span className="sr-only">Job title or keywords</span>
          <input
            ref={inputRef}
            value={params.keywords}
            onChange={(e) => set("keywords", e.target.value)}
            placeholder="Job title, skill, or company"
            maxLength={120}
            enterKeyHint="search"
          />
        </label>
        <label className="search-field">
          <MapPin size={18} aria-hidden />
          <span className="sr-only">Location</span>
          <input
            value={params.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder={params.remoteOnly ? "Anywhere (remote)" : "City, state, or leave blank"}
            maxLength={120}
          />
        </label>
        <button type="button" className={`icon-btn search-options-btn ${showOptions ? "active" : ""}`} onClick={() => setShowOptions((s) => !s)} aria-expanded={showOptions} aria-label="Search options" title="Search options">
          <SlidersHorizontal size={18} />
        </button>
        <button className="btn btn-primary search-go" disabled={busy || disabled}>
          <Search size={18} aria-hidden />
          <span>{busy ? "Hunting…" : "Hunt"}</span>
        </button>
      </div>
      <div className="search-sources" role="group" aria-label="Job boards">
        {Object.entries(SOURCES).map(([id, s]) => (
          <button key={id} type="button" className={`source-toggle ${params.sources.includes(id) ? "on" : ""}`} aria-pressed={params.sources.includes(id)} onClick={() => toggleSource(id)}>
            <span className="source-dot" style={{ background: s.color }} aria-hidden />
            {s.label}
          </button>
        ))}
        <label className="switch-inline">
          <input type="checkbox" checked={params.remoteOnly} onChange={(e) => set("remoteOnly", e.target.checked)} />
          <span>Remote only</span>
        </label>
      </div>
      {showOptions && (
        <div className="search-options">
          <label className="field field-inline">
            <span>Posted</span>
            <select value={params.postedWithin} onChange={(e) => set("postedWithin", Number(e.target.value))}>
              {POSTED.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="field field-inline">
            <span>Country</span>
            <select value={params.country} onChange={(e) => set("country", e.target.value)}>
              {COUNTRIES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="field field-inline">
            <span>Per board</span>
            <select value={params.limit} onChange={(e) => set("limit", Number(e.target.value))}>
              {[10, 25, 50, 75, 100]
                .filter((n) => n <= maxResults)
                .map((n) => (
                  <option key={n} value={n}>
                    {n} jobs
                  </option>
                ))}
            </select>
          </label>
          <p className="small muted options-note">Indeed uses the country; LinkedIn and Glassdoor use the location. Repeat searches within a few hours are served from cache.</p>
        </div>
      )}
      {error && (
        <p className="small bad-text" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
