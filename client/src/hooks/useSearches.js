import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { load, save } from "../lib/storage";
import { useAuth } from "./useAuth";

const RUNNING = new Set(["running", "analyzing"]);
export const isRunning = (search) => Boolean(search && RUNNING.has(search.status));

// Polls while the search is scraping or analyzing, then stops.
export function useSearch(id) {
  return useQuery({
    queryKey: ["search", id],
    queryFn: ({ signal }) => api(`/searches/${id}`, { signal }),
    enabled: Boolean(id),
    refetchInterval: (q) => (isRunning(q.state.data?.search) ? 1500 : false),
    refetchOnWindowFocus: false,
    staleTime: (q) => (isRunning(q.state.data?.search) ? 0 : 5 * 60_000),
    retry: (count, err) => err.status !== 404 && count < 2,
  });
}

// Guests keep a short list of recent searches in this browser.
function rememberGuestSearch(search) {
  const list = load("recentSearches", []).filter((s) => s.id !== search.id);
  save("recentSearches", [{ id: search.id, params: search.params, createdAt: search.createdAt }, ...list].slice(0, 8));
}

export function useStartSearch() {
  const qc = useQueryClient();
  const { status } = useAuth();
  return useMutation({
    mutationFn: ({ params, force = false }) => api("/searches", { method: "POST", body: { ...params, force } }),
    onSuccess: (data) => {
      qc.setQueryData(["search", data.search.id], data);
      if (status === "signedIn") qc.invalidateQueries({ queryKey: ["searches"] });
      else rememberGuestSearch(data.search);
    },
  });
}

export function useRecentSearches() {
  const { status } = useAuth();
  const signedIn = status === "signedIn";
  const query = useQuery({
    queryKey: ["searches"],
    queryFn: () => api("/searches").then((d) => d.searches),
    enabled: signedIn,
    staleTime: 30_000,
  });
  if (!signedIn) return { data: load("recentSearches", []), isLoading: false };
  return query;
}

export function useDeleteSearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api(`/searches/${id}`, { method: "DELETE" }),
    onMutate: (id) => {
      qc.setQueryData(["searches"], (list) => (list || []).filter((s) => s.id !== id));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["searches"] }),
  });
}

export function forgetGuestSearch(id) {
  save("recentSearches", load("recentSearches", []).filter((s) => s.id !== id));
}

export function useJob(id, initial) {
  return useQuery({
    queryKey: ["job", id],
    queryFn: ({ signal }) => api(`/jobs/${id}`, { signal }).then((d) => d.job),
    enabled: Boolean(id),
    staleTime: 10 * 60_000,
    placeholderData: initial ? { ...initial, blocks: null } : undefined,
    retry: (count, err) => err.status !== 404 && count < 2,
  });
}
