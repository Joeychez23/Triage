import { RotateCcw, SlidersVertical } from "lucide-react";
import { ARRANGEMENTS, DEFAULT_WEIGHTS, DIMENSIONS, SENIORITY, SOURCES } from "../lib/constants";
import { DEFAULT_FILTERS, SORTS, activeFilterCount } from "../lib/filters";
import { Link } from "../hooks/useRouter";

const POSTED = [
  [0, "Any time"],
  [1, "24 hours"],
  [3, "3 days"],
  [7, "7 days"],
];

const WEIGHT_LABELS = ["Off", "Low", "Medium", "High"];

function Toggle({ checked, onChange, children, disabled, count }) {
  return (
    <label className={`check ${disabled ? "disabled" : ""}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
      <span>{children}</span>
      {count != null && <span className="count">{count}</span>}
    </label>
  );
}

// Filters, sorting, and fit weights. Everything here runs in the browser;
// nothing triggers a new search or new Jev calls.
export default function FilterPanel({ filters, onChange, facets, profile, onWeights, hasNew, fitReady, showWeights = true }) {
  const f = { ...DEFAULT_FILTERS, ...filters };
  const set = (k, v) => onChange({ ...f, [k]: v });
  const toggleIn = (k, v) => set(k, f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v]);
  const weights = { ...DEFAULT_WEIGHTS, ...(profile.weights || {}) };
  const active = activeFilterCount(f);

  return (
    <div className="filter-panel">
      <div className="filter-group">
        <label className="field">
          <span>Sort by</span>
          <select value={f.sort} onChange={(e) => set("sort", e.target.value)}>
            {SORTS.map(([v, l]) => (
              <option key={v} value={v} disabled={v === "fit" && !fitReady}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Narrow results</span>
          <input type="search" value={f.text} onChange={(e) => set("text", e.target.value)} placeholder="Title, company, skill…" />
        </label>
      </div>

      <fieldset className="filter-group">
        <legend>Work style</legend>
        {Object.entries(ARRANGEMENTS).map(([id, a]) => (
          <Toggle key={id} checked={f.arrangements.includes(id)} onChange={() => toggleIn("arrangements", id)} count={facets.arrangements[id] || 0}>
            {id === "unclear" ? "Not stated" : a.label}
          </Toggle>
        ))}
      </fieldset>

      <fieldset className="filter-group">
        <legend>Level</legend>
        <div className="pill-row">
          {Object.entries(SENIORITY)
            .filter(([id]) => facets.seniority[id])
            .map(([id, label]) => (
              <button key={id} type="button" className={`pill ${f.seniority.includes(id) ? "on" : ""}`} aria-pressed={f.seniority.includes(id)} onClick={() => toggleIn("seniority", id)}>
                {label} <span className="count">{facets.seniority[id]}</span>
              </button>
            ))}
          {!Object.keys(facets.seniority).length && <span className="muted small">Appears after the X-ray.</span>}
        </div>
      </fieldset>

      <fieldset className="filter-group">
        <legend>Posted within</legend>
        <div className="pill-row">
          {POSTED.map(([d, label]) => (
            <button key={d} type="button" className={`pill ${f.postedDays === d ? "on" : ""}`} aria-pressed={f.postedDays === d} onClick={() => set("postedDays", d)}>
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="filter-group">
        <legend>Job board</legend>
        {Object.entries(SOURCES)
          .filter(([id]) => facets.sources[id])
          .map(([id, s]) => (
            <Toggle key={id} checked={f.sources.includes(id)} onChange={() => toggleIn("sources", id)} count={facets.sources[id]}>
              <span className="source-dot" style={{ background: s.color }} aria-hidden /> {s.label}
            </Toggle>
          ))}
      </fieldset>

      <fieldset className="filter-group">
        <legend>Show</legend>
        <Toggle checked={f.payOnly} onChange={(v) => set("payOnly", v)} count={facets.withPay}>
          Pay listed
        </Toggle>
        <Toggle checked={f.meetsFloor} onChange={(v) => set("meetsFloor", v)} disabled={!profile.minSalary}>
          Meets my salary floor
        </Toggle>
        {hasNew && (
          <Toggle checked={f.newOnly} onChange={(v) => set("newOnly", v)} count={facets.newCount}>
            New since last run
          </Toggle>
        )}
        <Toggle checked={f.hideDealbreakers} onChange={(v) => set("hideDealbreakers", v)} disabled={!profile.dealbreakers?.length} count={facets.dealbreakers}>
          Hide dealbreakers
        </Toggle>
        <Toggle checked={f.hideRedFlags} onChange={(v) => set("hideRedFlags", v)} count={facets.redFlags}>
          Hide red-flag postings
        </Toggle>
        <Toggle checked={f.hideTracked} onChange={(v) => set("hideTracked", v)} count={facets.tracked}>
          Hide jobs I'm tracking
        </Toggle>
        {facets.hidden > 0 && (
          <p className="small muted">
            {facets.hidden} hidden by company. <Link to="/profile#hidden">Manage</Link>
          </p>
        )}
      </fieldset>

      {active > 0 && (
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange({ ...DEFAULT_FILTERS, sort: f.sort })}>
          <RotateCcw size={14} aria-hidden /> Reset {active} filter{active === 1 ? "" : "s"}
        </button>
      )}

      {showWeights && (
        <details className="filter-group weights" open={fitReady || undefined}>
          <summary>
            <SlidersVertical size={15} aria-hidden /> Tune fit weights
          </summary>
          <p className="small muted">How much each factor counts toward the fit score. Results re-rank instantly.</p>
          {DIMENSIONS.map(({ id, label, hint }) => (
            <label key={id} className="weight" title={hint}>
              <span className="weight-label">{label}</span>
              <input type="range" min={0} max={3} step={1} value={weights[id]} onChange={(e) => onWeights({ ...weights, [id]: Number(e.target.value) })} aria-valuetext={WEIGHT_LABELS[weights[id]]} />
              <span className="weight-value">{WEIGHT_LABELS[weights[id]]}</span>
            </label>
          ))}
        </details>
      )}
    </div>
  );
}
