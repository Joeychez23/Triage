import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import JobDetail from "../components/JobDetail";
import { useRouter } from "../hooks/useRouter";
import { useAuth } from "../hooks/useAuth";
import { useJob } from "../hooks/useSearches";
import { useFitScores } from "../hooks/useFitScores";
import { useTrackedMap } from "../hooks/useApplications";
import { useDocumentTitle } from "../hooks/useUtils";
import { scoreJob } from "../lib/fit";

// A single job on its own page (shared links, tracker links).
export default function JobView({ onRequireAccount }) {
  const { route } = useRouter();
  const { profile, health, status } = useAuth();
  const { data: job } = useJob(route.jobId);
  const jobs = useMemo(() => (job ? [job] : []), [job]);
  const fit = useFitScores(jobs, profile, { enabled: status === "signedIn" && health?.jev !== false });
  const tracked = useTrackedMap();
  const result = job ? fit.results[job.id] : null;
  useDocumentTitle(job ? `${job.title} at ${job.company}` : "Job");

  return (
    <div className="page job-page">
      <button type="button" className="btn btn-sm btn-ghost back-link" onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = "/"))}>
        <ArrowLeft size={15} aria-hidden /> Back
      </button>
      <JobDetail
        jobId={route.jobId}
        summary={null}
        scored={job && result ? scoreJob(job, result, profile) : null}
        fit={result}
        scoring={fit.pending > 0 || fit.updating}
        fitError={fit.error}
        fitReady={fit.ready}
        tracked={job ? tracked.get(job.id) : null}
        onRequireAccount={onRequireAccount}
        variant="page"
      />
    </div>
  );
}
