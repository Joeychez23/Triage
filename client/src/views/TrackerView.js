import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlarmClock, ArrowUpRight, CalendarClock, ExternalLink, Plus, Star, Trash2, X } from "lucide-react";
import Sep from "../components/Sep";
import CompanyMark from "../components/CompanyMark";
import Chip from "../components/Chip";
import Dialog from "../components/Dialog";
import { useAuth } from "../hooks/useAuth";
import { useApplications, useUpdateApplication } from "../hooks/useApplications";
import { useToast } from "../hooks/useToast";
import { Link } from "../hooks/useRouter";
import { useDocumentTitle } from "../hooks/useUtils";
import { api } from "../lib/api";
import { OUTCOMES, STATUSES } from "../lib/constants";
import { ago, dateInputValue, salaryText, shortDate } from "../lib/format";
import { fitLabel } from "../lib/fit";

const isDue = (a) => a.followUpAt && new Date(a.followUpAt) <= endOfToday() && (a.status === "applied" || a.status === "interviewing");
function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function Stars({ value, onChange, size = 14 }) {
  return (
    <span className="stars" role="radiogroup" aria-label="Excitement">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className={n <= value ? "on" : ""}
          onClick={(e) => {
            e.stopPropagation();
            onChange(value === n ? 0 : n);
          }}
        >
          <Star size={size} />
        </button>
      ))}
    </span>
  );
}

function AppCard({ app, onOpen, onDragStart, dragging }) {
  const due = isDue(app);
  const fit = app.fit != null ? fitLabel(app.fit) : null;
  return (
    <article
      className={`app-card ${dragging ? "dragging" : ""} ${due ? "due" : ""}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", app.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(app.id);
      }}
      onDragEnd={() => onDragStart(null)}
    >
      <button type="button" className="app-card-hit" onClick={() => onOpen(app.id)} aria-label={`${app.job.title} at ${app.job.company}`} />
      <div className="app-card-head">
        <CompanyMark name={app.job.company} logo={app.job.companyLogo} size={32} />
        <div>
          <h4>{app.job.title}</h4>
          <p className="muted small">{app.job.company}</p>
        </div>
      </div>
      <div className="chips">
        {fit && <Chip tone={fit.tone === "strong" || fit.tone === "good" ? "good" : fit.tone === "fair" ? "info" : "muted"}>Fit {app.fit}</Chip>}
        {app.job.salary && <Chip tone="muted">{salaryText(app.job.salary)}</Chip>}
        {app.status === "closed" && app.outcome && <Chip tone={app.outcome === "hired" ? "good" : "muted"}>{OUTCOMES[app.outcome]}</Chip>}
      </div>
      <div className="app-card-foot">
        {app.excitement > 0 && <span className="stars-static" aria-label={`${app.excitement} of 5`}>{"★".repeat(app.excitement)}</span>}
        {app.followUpAt && (app.status === "applied" || app.status === "interviewing") ? (
          <span className={`small ${due ? "bad-text" : "muted"}`}>
            <AlarmClock size={12} aria-hidden /> Follow up {shortDate(app.followUpAt)}
          </span>
        ) : app.appliedAt ? (
          <span className="small muted">Applied {ago(app.appliedAt)}</span>
        ) : (
          <span className="small muted">Saved {ago(app.createdAt)}</span>
        )}
      </div>
    </article>
  );
}

function AppPanel({ app, onClose }) {
  const update = useUpdateApplication();
  const toast = useToast();
  const [notes, setNotes] = useState(app.notes);
  const [contact, setContact] = useState(app.contact);
  const timer = useRef(null);
  const qc = useQueryClient();

  useEffect(() => {
    setNotes(app.notes);
    setContact(app.contact);
    // Only when switching cards, not on every save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.id]);

  const patch = (p) => update.mutate({ id: app.id, patch: p });
  const debounced = (p) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => patch(p), 700);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  // The card disappears at once; the delete is sent only after the undo
  // window passes, so Undo restores everything (notes, history) exactly.
  const remove = () => {
    const snapshot = qc.getQueryData(["applications"]);
    qc.setQueryData(["applications"], (list) => (list || []).filter((a) => a.id !== app.id));
    onClose();
    let undone = false;
    const timer = setTimeout(() => {
      if (undone) return;
      api(`/applications/${app.id}`, { method: "DELETE" })
        .then(() => qc.invalidateQueries({ queryKey: ["insights"] }))
        .catch((err) => {
          qc.setQueryData(["applications"], snapshot);
          toast(err.message, { tone: "bad" });
        });
    }, 6000);
    toast("Removed from your tracker", {
      duration: 6000,
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          clearTimeout(timer);
          qc.setQueryData(["applications"], snapshot);
        },
      },
    });
  };

  return (
    <aside className="app-panel" aria-label={`${app.job.title} details`}>
      <div className="app-panel-head">
        <CompanyMark name={app.job.company} logo={app.job.companyLogo} size={44} />
        <div>
          <h3>{app.job.title}</h3>
          <p className="muted">
            {app.job.company}
            {app.job.location ? (
              <>
                <Sep />
                {app.job.location}
              </>
            ) : null}
          </p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      </div>
      <div className="app-panel-links">
        {app.job.url && (
          <a className="btn btn-sm" href={app.job.url} target="_blank" rel="noopener noreferrer">
            Posting <ExternalLink size={13} aria-hidden />
          </a>
        )}
        {app.jobId && (
          <Link to={`/job/${app.jobId}`} className="btn btn-sm btn-ghost">
            Fit & X-ray <ArrowUpRight size={13} aria-hidden />
          </Link>
        )}
      </div>
      <div className="form-grid">
        <label className="field">
          <span>Stage</span>
          <select value={app.status} onChange={(e) => patch({ status: e.target.value })}>
            {STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {app.status === "closed" && (
          <label className="field">
            <span>Outcome</span>
            <select value={app.outcome} onChange={(e) => patch({ outcome: e.target.value })} autoFocus={!app.outcome}>
              <option value="">Choose…</option>
              {Object.entries(OUTCOMES).map(([id, l]) => (
                <option key={id} value={id}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>Applied on</span>
          <input type="date" value={dateInputValue(app.appliedAt)} onChange={(e) => patch({ appliedAt: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null })} />
        </label>
        <label className="field">
          <span>Follow up on</span>
          <input type="date" value={dateInputValue(app.followUpAt)} onChange={(e) => patch({ followUpAt: e.target.value ? new Date(`${e.target.value}T09:00:00`).toISOString() : null })} />
        </label>
      </div>
      <div className="field">
        <span>Excitement</span>
        <Stars value={app.excitement} onChange={(v) => patch({ excitement: v })} size={18} />
      </div>
      <label className="field">
        <span>Contact</span>
        <input
          value={contact}
          maxLength={300}
          placeholder="Recruiter or referral, email or LinkedIn"
          onChange={(e) => {
            setContact(e.target.value);
            debounced({ contact: e.target.value });
          }}
        />
      </label>
      <label className="field">
        <span>Notes</span>
        <textarea
          rows={6}
          value={notes}
          maxLength={10000}
          placeholder="Interview prep, questions to ask, salary discussed…"
          onChange={(e) => {
            setNotes(e.target.value);
            debounced({ notes: e.target.value });
          }}
        />
      </label>
      {app.history?.length > 0 && (
        <div className="timeline">
          <h4>Timeline</h4>
          <ol>
            {[...app.history].reverse().map((h, i) => (
              <li key={i}>
                <span>{h.type === "created" ? `Added as ${STATUSES.find((s) => s.id === h.to)?.label || h.to}` : `Moved to ${STATUSES.find((s) => s.id === h.to)?.label || h.to}`}</span>
                <span className="muted small">{shortDate(h.at)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <button type="button" className="btn btn-sm btn-danger-ghost" onClick={remove}>
        <Trash2 size={14} aria-hidden /> Remove from tracker
      </button>
    </aside>
  );
}

function AddJobDialog({ open, onClose }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ title: "", company: "", url: "", location: "", status: "saved" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { title, company, url, location, status } = form;
      const { application } = await api("/applications", { method: "POST", body: { job: { title, company, url, location }, status } });
      qc.setQueryData(["applications"], (list) => [application, ...(list || [])]);
      setForm({ title: "", company: "", url: "", location: "", status: "saved" });
      onClose();
    } catch (err) {
      toast(err.message, { tone: "bad" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} title="Track a job from anywhere" labelledBy="add-job-title">
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>Job title</span>
          <input required maxLength={200} value={form.title} onChange={set("title")} />
        </label>
        <label className="field">
          <span>Company</span>
          <input required maxLength={160} value={form.company} onChange={set("company")} />
        </label>
        <label className="field">
          <span>Link</span>
          <input type="url" maxLength={2000} value={form.url} onChange={set("url")} placeholder="https://" />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Location</span>
            <input maxLength={160} value={form.location} onChange={set("location")} />
          </label>
          <label className="field">
            <span>Stage</span>
            <select value={form.status} onChange={set("status")}>
              {STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Adding…" : "Add to tracker"}
        </button>
      </form>
    </Dialog>
  );
}

export default function TrackerView({ onRequireAccount }) {
  const { status } = useAuth();
  const { data: apps = [], isLoading, isError, error } = useApplications();
  const update = useUpdateApplication();
  const [openId, setOpenId] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [filter, setFilter] = useState("");
  const [adding, setAdding] = useState(false);
  useDocumentTitle("Tracker");

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? apps.filter((a) => `${a.job.title} ${a.job.company} ${a.notes}`.toLowerCase().includes(q)) : apps;
  }, [apps, filter]);
  const columns = useMemo(
    () =>
      STATUSES.map((s) => ({
        ...s,
        items: visible
          .filter((a) => a.status === s.id)
          .sort((a, b) => Number(isDue(b)) - Number(isDue(a)) || new Date(b.updatedAt) - new Date(a.updatedAt)),
      })),
    [visible]
  );
  const due = apps.filter(isDue);
  const open = apps.find((a) => a.id === openId) || null;

  if (status !== "signedIn") {
    return (
      <div className="page gate">
        <h1>Track every application in one place</h1>
        <p className="muted">Save jobs from your hunts, move them from Applied to Offer, set follow-up reminders, and keep notes for each one.</p>
        <button type="button" className="btn btn-primary" onClick={() => onRequireAccount("Sign in to use the tracker.")} disabled={status === "loading"}>
          Sign in to start tracking
        </button>
      </div>
    );
  }

  const drop = (statusId) => (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setOverCol(null);
    setDragId(null);
    const app = apps.find((a) => a.id === id);
    if (!app || app.status === statusId || app.id.startsWith("temp-")) return;
    update.mutate({ id, patch: { status: statusId } });
    if (statusId === "closed") setOpenId(id);
  };

  return (
    <div className={`page tracker ${open ? "with-panel" : ""}`}>
      <div className="page-head">
        <div>
          <h1>Tracker</h1>
          <p className="muted">
            {apps.length} job{apps.length === 1 ? "" : "s"} tracked
            {due.length > 0 && (
              <span className="bad-text">
                <Sep />
                {due.length} follow-up{due.length === 1 ? "" : "s"} due
              </span>
            )}
          </p>
        </div>
        <div className="page-actions">
          <input type="search" className="input-sm" placeholder="Filter tracker…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter tracker" />
          <button type="button" className="btn btn-sm" onClick={() => setAdding(true)}>
            <Plus size={14} aria-hidden /> Add job
          </button>
        </div>
      </div>

      {due.length > 0 && (
        <div className="notice notice-warn followups">
          <CalendarClock size={16} aria-hidden />
          <span>
            Time to follow up on{" "}
            {due.slice(0, 3).map((a, i) => (
              <span key={a.id}>
                {i > 0 && ", "}
                <button type="button" className="link" onClick={() => setOpenId(a.id)}>
                  {a.job.company}
                </button>
              </span>
            ))}
            {due.length > 3 && ` and ${due.length - 3} more`}.
          </span>
        </div>
      )}

      {isError ? (
        <div className="notice notice-bad">{error.message}</div>
      ) : isLoading ? (
        <div className="empty-state">
          <div className="spinner" aria-label="Loading" />
        </div>
      ) : (
        <div className="board-wrap">
          <div className="board">
            {columns.map((col) => (
              <section
                key={col.id}
                className={`column ${overCol === col.id ? "over" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setOverCol(col.id);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) setOverCol(null);
                }}
                onDrop={drop(col.id)}
                aria-label={col.label}
              >
                <header className="column-head">
                  <span className={`column-dot status-${col.id}`} aria-hidden />
                  <strong>{col.label}</strong>
                  <span className="count">{col.items.length}</span>
                </header>
                <div className="column-body">
                  {col.items.map((a) => (
                    <AppCard key={a.id} app={a} onOpen={setOpenId} onDragStart={setDragId} dragging={dragId === a.id} />
                  ))}
                  {!col.items.length && <p className="column-empty muted small">{col.id === "saved" ? "Save jobs from a hunt to start." : `${col.hint}. Drag cards here.`}</p>}
                </div>
              </section>
            ))}
          </div>
          {open && <AppPanel app={open} onClose={() => setOpenId(null)} />}
        </div>
      )}
      <AddJobDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
