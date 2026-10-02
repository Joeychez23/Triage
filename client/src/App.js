import { Suspense, lazy, useCallback, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Header from "./components/Header";
import AuthDialog from "./components/AuthDialog";
import HuntView from "./views/HuntView";
import JobView from "./views/JobView";
import TrackerView from "./views/TrackerView";
import ProfileView from "./views/ProfileView";
import NotFoundView from "./views/NotFoundView";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ToastProvider } from "./hooks/useToast";
import { RouterProvider, useRouter } from "./hooks/useRouter";
import { useTheme } from "./hooks/useTheme";

// Charts (recharts) only load when someone opens Insights.
const InsightsView = lazy(() => import("./views/InsightsView"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

function Shell() {
  const { route } = useRouter();
  const { health } = useAuth();
  const { isDark, toggle } = useTheme();
  const [auth, setAuth] = useState({ open: false, reason: "", mode: "signin" });
  // requireAccount(reason, { mode: "register" }) opens straight to sign-up.
  const requireAccount = useCallback((reason, { mode = "signin" } = {}) => setAuth({ open: true, reason, mode }), []);

  const views = {
    hunt: HuntView,
    job: JobView,
    tracker: TrackerView,
    insights: InsightsView,
    profile: ProfileView,
  };
  const View = views[route.name] || NotFoundView;

  return (
    <div className={`app route-${route.name}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header onSignIn={() => requireAccount("")} isDark={isDark} onToggleTheme={toggle} />
      {health && health.ok === false && (
        <div className="banner banner-bad" role="alert">
          Can't reach the Triage server. Start it with <code>npm run dev</code> and refresh.
        </div>
      )}
      <main id="main">
        <Suspense fallback={<div className="spinner" aria-label="Loading" />}>
          <View onRequireAccount={requireAccount} />
        </Suspense>
      </main>
      <footer className="app-footer muted small">
        Listings scraped from LinkedIn, Indeed, and Glassdoor with Apify. Judgments by TypeSafe Jev. Always confirm details on the original posting.
      </footer>
      <AuthDialog open={auth.open} reason={auth.reason} initialMode={auth.mode} onClose={() => setAuth((a) => ({ ...a, open: false }))} />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider>
        <AuthProvider>
          <ToastProvider>
            <Shell />
          </ToastProvider>
        </AuthProvider>
      </RouterProvider>
    </QueryClientProvider>
  );
}
