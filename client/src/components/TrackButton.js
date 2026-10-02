import { useEffect, useRef, useState } from "react";
import { Bookmark, BookmarkCheck, ChevronDown } from "lucide-react";
import { STATUSES } from "../lib/constants";
import { useAuth } from "../hooks/useAuth";
import { useTrackJob, useUpdateApplication } from "../hooks/useApplications";
import { useToast } from "../hooks/useToast";
import { useRouter } from "../hooks/useRouter";

// Save a job to the tracker, or move it between stages.
export default function TrackButton({ job, tracked, fit, onRequireAccount }) {
  const { status } = useAuth();
  const track = useTrackJob();
  const update = useUpdateApplication();
  const toast = useToast();
  const { navigate } = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const choose = (to) => {
    setOpen(false);
    if (status !== "signedIn") return onRequireAccount("Sign in to track jobs through your pipeline.");
    if (!tracked) {
      track.mutate(
        { job, status: to, fit },
        {
          onSuccess: () =>
            toast(`Added to ${STATUSES.find((s) => s.id === to).label}`, {
              tone: "good",
              action: { label: "Open tracker", onClick: () => navigate("/tracker") },
            }),
        }
      );
    } else if (!tracked.id.startsWith("temp-")) {
      update.mutate({ id: tracked.id, patch: { status: to } });
    }
  };

  const current = tracked ? STATUSES.find((s) => s.id === tracked.status) : null;
  return (
    <div className="split-btn" ref={ref}>
      <button type="button" className={`btn ${tracked ? "btn-tracked" : ""}`} onClick={() => (tracked ? setOpen((o) => !o) : choose("saved"))}>
        {tracked ? <BookmarkCheck size={16} aria-hidden /> : <Bookmark size={16} aria-hidden />}
        {tracked ? current?.label : "Save"}
      </button>
      <button type="button" className="btn btn-caret" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Choose tracker stage">
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="menu menu-right" role="menu">
          {STATUSES.filter((s) => s.id !== "closed").map((s) => (
            <button key={s.id} type="button" role="menuitemradio" aria-checked={tracked?.status === s.id} className={`menu-item ${tracked?.status === s.id ? "active" : ""}`} onClick={() => choose(s.id)}>
              {s.label}
              <span className="muted small">{s.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
