import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BellRing, Binoculars, Filter, Keyboard, RefreshCw, ScanSearch, Sparkles, Star, X } from "lucide-react";
import SearchBar from "../components/SearchBar";
import SearchProgress from "../components/SearchProgress";
import FilterPanel from "../components/FilterPanel";
import JobCard from "../components/JobCard";
import JobDetail from "../components/JobDetail";
import Dialog from "../components/Dialog";
import { useRouter } from "../hooks/useRouter";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { forgetGuestSearch, isRunning, useDeleteSearch, useRecentSearches, useSearch, useStartSearch } from "../hooks/useSearches";
import { useFitScores } from "../hooks/useFitScores";
import { useTrackedMap } from "../hooks/useApplications";
import { useDocumentTitle, useHotkeys, useMediaQuery } from "../hooks/useUtils";
import { DEFAULT_FILTERS, activeFilterCount, applyFilters } from "../lib/filters";
import { profileCompleteness, scoreJob } from "../lib/fit";
import { SOURCES } from "../lib/constants";
import { api } from "../lib/api";
import { load, save } from "../lib/storage";
import { ago, plural } from "../lib/format";
import { Link } from "../hooks/useRouter";

const describeParams = (p) => `${p.keywords}${p.location ? ` · ${p.location}` : p.remoteOnly ? " · Remote" : ""}`;

function facetCounts(rows, { profile, trackedIds, newIds }) {
  const facets = { arrangements: {}, seniority: {}, sources: {}, withPay: 0, dealbreakers: 0, redFlags: 0, tracked: 0, newCount: 0, hidden: 0 };
  const hidden = new Set((profile.hiddenCompanies || []).map((c) => c.toLowerCase()));
  for (const { job, scored } of rows) {
    if (hidden.has(job.company.toLowerCase())) {
      facets.hidden += 1;
      continue;
    }
    const arr = job.analysis?.arrangement || "unclear";
    facets.arrangements[arr] = (facets.arrangements[arr] || 0) + 1;
    if (job.analysis?.seniority) facets.seniority[job.analysis.seniority] = (facets.seniority[job.analysis.seniority] || 0) + 1;
    for (const s of new Set([job.source, ...(job.alsoOn || []).map((a) => a.source)])) facets.sources[s] = (facets.sources[s] || 0) + 1;
    if (job.salary) facets.withPay += 1;
    if (scored?.hit) facets.dealbreakers += 1;
    if ((job.analysis?.redFlags ?? 0) >= 0.5) facets.redFlags += 1;
    if (trackedIds.has(job.id)) facets.tracked += 1;
    if (newIds.has(job.id)) facets.newCount += 1;
  }
  return facets;
}

function Landing({ onSearch, busy, health, onRunSaved, runningSaved, onRequireAccount }) {
  const { profile, status, savedSearches } = useAuth();
  const recent = useRecentSearches();
  const del = useDeleteSearch();
  const { checks, ratio } = profileCompleteness(profile);
  const { navigate } = useRouter();
  const recentList = (recent.data || []).slice(0, 8);
  const removeRecent = (id) => {
    if (status === "signedIn") del.mutate(id);
    else {
      forgetGuestSearch(id);
      window.dispatchEvent(new Event("triage:recent"));
    }
  };

  return (
    <div className="landing">
      <section className="hero">
        <p className="eyebrow">
          <Binoculars size={15} aria-hidden /> LinkedIn · Indeed · Glassdoor
        </p>
        <h1>
          Know which jobs <em>deserve</em> your time.
        </h1>
        <p className="hero-sub">
          Triage scouts three job boards at once, X-rays every posting with Jev, and sorts what it finds by how well it fits <em>you</em>: skills, level,
          commute, pay, and your own dealbreakers.
        </p>
        <SearchBar onSearch={onSearch} busy={busy} disabled={health && !health.search} maxResults={health?.maxResultsPerSource} autoFocus />
        {health && !health.search && <p className="notice notice-warn small">Live search is turned off on this server (no Apify token).</p>}
      </section>

      <section className="how">
        <article>
          <span className="how-icon">
            <Binoculars size={18} />
          </span>
          <h3>Scout</h3>
          <p>Apify scrapers search LinkedIn, Indeed, and Glassdoor in parallel. Duplicate postings across boards are merged into one.</p>
        </article>
        <article>
          <span className="how-icon">
            <ScanSearch size={18} />
          </span>
          <h3>X-ray</h3>
          <p>Jev reads each posting for what job boards bury: real work style, level, visa stance, pace, red flags, and pay hidden in the text.</p>
        </article>
        <article>
          <span className="how-icon">
            <Sparkles size={18} />
          </span>
          <h3>Fit</h3>
          <p>Your profile is compared with every job. Write dealbreakers in plain English, like "requires on-call", and Triage flags them.</p>
        </article>
      </section>

      <div className="landing-grid">
        {status === "signedIn" ? (
          <section className="panel">
            <div className="panel-title">
              <Sparkles size={16} aria-hidden /> Your hunting profile
            </div>
            <div className="meter" aria-label={`Profile ${Math.round(ratio * 100)}% complete`}>
              <span style={{ width: `${ratio * 100}%` }} />
            </div>
            <ul className="checklist">
              {checks.map((c) => (
                <li key={c.id} className={c.done ? "done" : ""}>
                  {c.label}
                </li>
              ))}
            </ul>
            <Link to="/profile" className="btn btn-sm">
              {ratio > 0 ? "Edit profile" : "Build your profile"}
            </Link>
          </section>
        ) : (
          <section className="panel">
            <div className="panel-title">
              <Sparkles size={16} aria-hidden /> Fit scores need a profile
            </div>
            <p className="muted small">
              Searching is free without an account. Sign up to build a profile and Triage scores every job for you: skills, level, commute, pay, and
              your own dealbreakers. You also get the tracker, insights, and saved searches.
            </p>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => onRequireAccount("Create a free account to build your profile.", { mode: "register" })}
              disabled={status === "loading" || (health && !health.accounts)}
            >
              Create a free account
            </button>
          </section>
        )}

        {status === "signedIn" && (
          <section className="panel">
            <div className="panel-title">
              <BellRing size={16} aria-hidden /> Saved searches
            </div>
            {savedSearches.length ? (
              <ul className="list">
                {savedSearches.map((s) => (
                  <li key={s.id} className="list-row">
                    <div>
                      <strong>{s.name}</strong>
                      <span className="muted small">
                        {describeParams(s.params)} · {s.lastRunAt ? `ran ${ago(s.lastRunAt)}` : "never run"}
                        {s.lastNewCount ? ` · ${s.lastNewCount} new` : ""}
                      </span>
                    </div>
                    <button type="button" className="btn btn-sm" onClick={() => onRunSaved(s)} disabled={runningSaved === s.id}>
                      {runningSaved === s.id ? "Starting…" : "Run"}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">Save a search from its results page to re-run it later and see only what's new.</p>
            )}
          </section>
        )}

        <section className="panel">
          <div className="panel-title">
            <RefreshCw size={16} aria-hidden /> Recent hunts
          </div>
          {recentList.length ? (
            <ul className="list">
              {recentList.map((s) => (
                <li key={s.id} className="list-row">
                  <button type="button" className="list-link" onClick={() => navigate(`/search/${s.id}`)}>
                    <strong>{describeParams(s.params)}</strong>
                    <span className="muted small">
                      {(s.params.sources || []).map((id) => SOURCES[id]?.label).join(", ")} · {ago(s.createdAt)}
                      {s.jobCount != null ? ` · ${plural(s.jobCount, "job")}` : ""}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Remove from history"
                    onClick={() => removeRecent(s.id)}
                  >
                    <X size={15} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">Your searches will show up here.</p>
          )}
        </section>
      </div>
    </div>
  );
}

const SHORTCUTS = [
  ["/", "Focus the search box"],
  ["j / k", "Next / previous job"],
  ["o", "Open the application page"],
  ["s", "Save the job to your tracker"],
  ["f", "Toggle filters"],
  ["Esc", "Close the job"],
  ["?", "Show shortcuts"],
];

export default function HuntView({ onRequireAccount }) {
  const { route, query, navigate } = useRouter();
  const searchId = route.searchId || null;
  const { profile, updateProfile, health, status, setSavedSearches, savedSearches } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const start = useStartSearch();
  const searchQuery = useSearch(searchId);
  const search = searchQuery.data?.search;
  const jobs = useMemo(() => searchQuery.data?.jobs || [], [searchQuery.data]);
  const fitScores = useFitScores(jobs, profile, { enabled: status === "signedIn" && health?.jev !== false });
  const tracked = useTrackedMap();
  const [filters, setFilters] = useState(() => ({ ...DEFAULT_FILTERS, sort: load("sort", "fit") }));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [runningSaved, setRunningSaved] = useState(null);
  const [, forceRecent] = useState(0);
  const wide = useMediaQuery("(min-width: 1180px)");
  const twoCol = useMediaQuery("(min-width: 820px)");
  const listRef = useRef(null);
  const selectedId = query.job || null;

  useDocumentTitle(search ? describeParams(search.params) : "Hunt");

  useEffect(() => {
    const bump = () => forceRecent((n) => n + 1);
    window.addEventListener("triage:recent", bump);
    return () => window.removeEventListener("triage:recent", bump);
  }, []);

  const setFiltersAndSave = useCallback((next) => {
    setFilters(next);
    save("sort", next.sort);
  }, []);

  const rows = useMemo(
    () => jobs.map((job) => ({ job, scored: fitScores.results[job.id] ? scoreJob(job, fitScores.results[job.id], profile) : null })),
    [jobs, profile, fitScores.results]
  );
  const trackedIds = useMemo(() => new Set(tracked.keys()), [tracked]);
  const newIds = useMemo(() => new Set(search?.newJobs || []), [search?.newJobs]);
  const effectiveFilters = useMemo(
    () => (fitScores.ready || filters.sort !== "fit" ? filters : { ...filters, sort: "newest" }),
    [filters, fitScores.ready]
  );
  const visible = useMemo(() => applyFilters(rows, effectiveFilters, { profile, trackedIds, newIds }), [rows, effectiveFilters, profile, trackedIds, newIds]);
  const facets = useMemo(() => facetCounts(rows, { profile, trackedIds, newIds }), [rows, profile, trackedIds, newIds]);
  const selectedRow = rows.find((r) => r.job.id === selectedId) || null;

  const select = useCallback(
    (id) => {
      if (!searchId) return;
      navigate(id ? `/search/${searchId}?job=${id}` : `/search/${searchId}`, { replace: true, scroll: false });
    },
    [navigate, searchId]
  );

  // On wide screens, open the best match automatically once results arrive.
  useEffect(() => {
    if (wide && searchId && !selectedId && visible.length && !isRunning(search)) select(visible[0].job.id);
  }, [wide, searchId, selectedId, visible, search, select]);

  // Keep the selected card in view when moving with the keyboard.
  useEffect(() => {
    if (!selectedId) return;
    listRef.current?.querySelector(".job-card.selected")?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  const runSearch = (params, force = false) =>
    start.mutate(
      { params, force },
      {
        onSuccess: (data) => {
          if (data.search.cached) toast("Served from a recent identical search, no scraping needed.", { tone: "info" });
          navigate(`/search/${data.search.id}`);
        },
        onError: (err) => toast(err.message, { tone: "bad", duration: 6000 }),
      }
    );

  const runSaved = async (saved) => {
    setRunningSaved(saved.id);
    try {
      const data = await api(`/saved-searches/${saved.id}/run`, { method: "POST", body: {} });
      qc.setQueryData(["search", data.search.id], data);
      navigate(`/search/${data.search.id}`);
    } catch (err) {
      toast(err.message, { tone: "bad" });
    } finally {
      setRunningSaved(null);
    }
  };

  const saveSearch = async () => {
    if (status !== "signedIn") return onRequireAccount("Sign in to save searches and see what's new each time you run them.");
    try {
      const name = describeParams(search.params).slice(0, 80);
      const { savedSearch } = await api("/saved-searches", { method: "POST", body: { name, params: search.params, searchId: search.id } });
      setSavedSearches((list) => [...list, savedSearch]);
      toast("Search saved. Run it from the Hunt page to see new postings.", { tone: "good" });
    } catch (err) {
      toast(err.message, { tone: "bad" });
    }
  };

  const move = (dir) => {
    if (!visible.length) return;
    const idx = visible.findIndex((r) => r.job.id === selectedId);
    const next = visible[Math.min(visible.length - 1, Math.max(0, idx + dir))] || visible[0];
    select(next.job.id);
  };

  useHotkeys({
    "/": () => window.dispatchEvent(new Event("triage:focus-search")),
    j: () => move(1),
    k: () => move(-1),
    o: () => {
      const j = selectedRow?.job;
      if (j && (j.applyUrl || j.url)) window.open(j.applyUrl || j.url, "_blank", "noopener,noreferrer");
    },
    s: () => selectedRow && document.querySelector(".job-detail .split-btn .btn")?.click(),
    f: () => setFiltersOpen((o) => !o),
    Escape: () => (helpOpen ? setHelpOpen(false) : selectedId && !twoCol ? select(null) : null),
    "?": () => setHelpOpen(true),
  });

  if (!searchId) {
    return (
      <Landing
        onSearch={(p) => runSearch(p)}
        busy={start.isPending}
        health={health}
        onRunSaved={runSaved}
        runningSaved={runningSaved}
        onRequireAccount={onRequireAccount}
      />
    );
  }

  const alreadySaved = savedSearches.some((s) => JSON.stringify(s.params) === JSON.stringify(search?.params));
  const scoredCount = Object.keys(fitScores.results).length;
  const detail = selectedRow && (
    <JobDetail
      key={selectedRow.job.id}
      summary={selectedRow.job}
      jobId={selectedRow.job.id}
      scored={selectedRow.scored}
      fit={fitScores.results[selectedRow.job.id]}
      scoring={fitScores.pending > 0 || fitScores.updating}
      fitError={fitScores.error}
      fitReady={fitScores.ready}
      tracked={tracked.get(selectedRow.job.id)}
      onRequireAccount={onRequireAccount}
      onClose={twoCol ? undefined : () => select(null)}
    />
  );

  return (
    <div className="hunt">
      <div className="hunt-top">
        <SearchBar initial={search?.params} onSearch={(p) => runSearch(p)} busy={start.isPending} compact maxResults={health?.maxResultsPerSource} />
      </div>

      {searchQuery.isError ? (
        <div className="empty-state">
          <h2>That search isn't available</h2>
          <p className="muted">{searchQuery.error.message}</p>
          <Link to="/" className="btn">
            Start a new hunt
          </Link>
        </div>
      ) : !search ? (
        <div className="empty-state">
          <div className="spinner" aria-label="Loading search" />
        </div>
      ) : (
        <div className={`hunt-layout ${wide ? "three" : twoCol ? "two" : "one"}`}>
          {wide ? (
            <aside className="hunt-filters" aria-label="Filters">
              <FilterPanel
                filters={filters}
                onChange={setFiltersAndSave}
                facets={facets}
                profile={profile}
                onWeights={(weights) => updateProfile({ weights })}
                hasNew={newIds.size > 0}
                fitReady={fitScores.ready}
                showWeights={status === "signedIn"}
              />
            </aside>
          ) : (
            filtersOpen && (
              <div className="drawer-backdrop" onClick={() => setFiltersOpen(false)}>
                <aside className="drawer" aria-label="Filters" onClick={(e) => e.stopPropagation()}>
                  <div className="drawer-head">
                    <strong>Filters</strong>
                    <button type="button" className="icon-btn" onClick={() => setFiltersOpen(false)} aria-label="Close filters">
                      <X size={18} />
                    </button>
                  </div>
                  <FilterPanel
                    filters={filters}
                    onChange={setFiltersAndSave}
                    facets={facets}
                    profile={profile}
                    onWeights={(weights) => updateProfile({ weights })}
                    hasNew={newIds.size > 0}
                    fitReady={fitScores.ready}
                    showWeights={status === "signedIn"}
                  />
                </aside>
              </div>
            )
          )}

          <section className="hunt-results" aria-label="Results" ref={listRef}>
            <SearchProgress
              search={search}
              fitPending={fitScores.pending}
              fitTotal={fitScores.ready ? jobs.length : null}
              fitHint={status === "signedIn" ? "Add a profile" : "Sign up to score"}
            />
            <div className="results-head">
              <p>
                <strong>{visible.length}</strong> of {plural(jobs.length, "job")}
                {search.cached && <span className="muted small"> · cached</span>}
                {newIds.size > 0 && <span className="new-count"> · {newIds.size} new</span>}
              </p>
              <div className="results-actions">
                {!wide && (
                  <button type="button" className="btn btn-sm" onClick={() => setFiltersOpen(true)}>
                    <Filter size={14} aria-hidden /> Filters
                    {activeFilterCount(filters) > 0 && <span className="badge">{activeFilterCount(filters)}</span>}
                  </button>
                )}
                {!isRunning(search) && (
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => runSearch(search.params, true)} title="Scrape the boards again for fresh results" disabled={start.isPending}>
                    <RefreshCw size={14} aria-hidden /> Refresh
                  </button>
                )}
                {!alreadySaved && !isRunning(search) && (
                  <button type="button" className="btn btn-sm btn-ghost" onClick={saveSearch}>
                    <Star size={14} aria-hidden /> Save search
                  </button>
                )}
                <button type="button" className="icon-btn" onClick={() => setHelpOpen(true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts">
                  <Keyboard size={16} />
                </button>
              </div>
            </div>

            {!fitScores.ready && jobs.length > 0 && (
              <div className="notice notice-info small">
                <Sparkles size={14} aria-hidden />
                {status === "signedIn" ? (
                  <span>
                    <Link to="/profile">Add your skills and goals</Link> to rank these jobs by fit.
                  </span>
                ) : (
                  <span>
                    <button
                      type="button"
                      className="link"
                      onClick={() => onRequireAccount("Create a free account to build your profile and rank jobs by fit.", { mode: "register" })}
                    >
                      Sign up
                    </button>{" "}
                    and build your profile to rank these jobs by fit.
                  </span>
                )}
              </div>
            )}
            {fitScores.error && <div className="notice notice-bad small">Fit scoring: {fitScores.error}</div>}

            <div className="job-list">
              {visible.map(({ job, scored }) => (
                <JobCard
                  key={job.id}
                  job={job}
                  scored={scored}
                  selected={job.id === selectedId}
                  onSelect={select}
                  tracked={tracked.get(job.id)}
                  isNew={newIds.has(job.id)}
                  scoring={!fitScores.results[job.id] && (fitScores.pending > 0 || fitScores.updating)}
                  profileReady={fitScores.ready}
                />
              ))}
              {isRunning(search) && jobs.length === 0 && (
                <div className="skeleton-cards" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="skeleton-card" />
                  ))}
                </div>
              )}
              {!isRunning(search) && jobs.length > 0 && visible.length === 0 && (
                <div className="empty-state small">
                  <p>No jobs match these filters.</p>
                  <button type="button" className="btn btn-sm" onClick={() => setFiltersAndSave({ ...DEFAULT_FILTERS, sort: filters.sort })}>
                    Clear filters
                  </button>
                </div>
              )}
              {!isRunning(search) && search.status !== "failed" && jobs.length === 0 && (
                <div className="empty-state small">
                  <p>No postings found. Try broader keywords, a wider time window, or another location.</p>
                </div>
              )}
            </div>
            <p className="results-foot muted small">
              {scoredCount > 0 && `${scoredCount} scored by Jev · `}Results scraped {ago(search.finishedAt || search.createdAt)} via Apify
            </p>
          </section>

          {twoCol ? (
            <section className="hunt-detail" aria-label="Job details">
              {detail || (
                <div className="detail-placeholder">
                  <Binoculars size={28} aria-hidden />
                  <p>Select a job to see its fit, X-ray, and requirements.</p>
                </div>
              )}
            </section>
          ) : (
            detail && (
              <div className="sheet" role="dialog" aria-modal="true" aria-label={selectedRow.job.title}>
                {detail}
              </div>
            )
          )}
        </div>
      )}

      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} title="Keyboard shortcuts" labelledBy="shortcuts-title">
        <dl className="shortcuts">
          {SHORTCUTS.map(([k, d]) => (
            <div key={k}>
              <dt>
                <kbd>{k}</kbd>
              </dt>
              <dd>{d}</dd>
            </div>
          ))}
        </dl>
      </Dialog>
    </div>
  );
}
