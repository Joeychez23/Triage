import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from "react";

// A tiny History API router. Routes:
//   /                 hunt (search home)
//   /search/:id       hunt with a search open (?job=<id> selects a job)
//   /job/:id          a single job, full page
//   /tracker, /insights, /profile
const RouterContext = createContext(null);

export function matchRoute(pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  let m;
  if (path === "/") return { name: "hunt" };
  if ((m = path.match(/^\/search\/([a-f0-9]{24})$/i))) return { name: "hunt", searchId: m[1] };
  if ((m = path.match(/^\/job\/([a-f0-9]{24})$/i))) return { name: "job", jobId: m[1] };
  if (path === "/tracker") return { name: "tracker" };
  if (path === "/insights") return { name: "insights" };
  if (path === "/profile") return { name: "profile" };
  return { name: "notFound" };
}

function readLocation() {
  return { pathname: window.location.pathname, search: window.location.search };
}

export function RouterProvider({ children }) {
  const [loc, setLoc] = useState(readLocation);

  useEffect(() => {
    const onPop = () => setLoc(readLocation());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((to, { replace = false, scroll = true } = {}) => {
    const url = new URL(to, window.location.origin);
    const next = url.pathname + url.search;
    if (next === window.location.pathname + window.location.search) return;
    window.history[replace ? "replaceState" : "pushState"]({}, "", next);
    setLoc(readLocation());
    if (scroll && !replace) window.scrollTo({ top: 0 });
  }, []);

  const value = useMemo(() => {
    const route = matchRoute(loc.pathname);
    const query = Object.fromEntries(new URLSearchParams(loc.search));
    return { route, query, pathname: loc.pathname, navigate };
  }, [loc, navigate]);

  return createElement(RouterContext.Provider, { value }, children);
}

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used inside RouterProvider");
  return ctx;
}

// <Link to="/tracker">: a real anchor (open in new tab works) that navigates
// in-app on a plain click.
export function Link({ to, onClick, children, replace, ...rest }) {
  const { navigate } = useRouter();
  const handle = (e) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to, { replace });
  };
  return createElement("a", { href: to, onClick: handle, ...rest }, children);
}
