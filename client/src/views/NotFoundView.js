import { Link } from "../hooks/useRouter";
import { useDocumentTitle } from "../hooks/useUtils";

export default function NotFoundView() {
  useDocumentTitle("Not found");
  return (
    <div className="page empty-state">
      <h1>Nothing to triage here</h1>
      <p className="muted">This page doesn't exist. Let's get you back to the hunt.</p>
      <Link to="/" className="btn btn-primary">
        Go to Hunt
      </Link>
    </div>
  );
}
