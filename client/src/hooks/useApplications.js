import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "./useAuth";
import { useToast } from "./useToast";

const KEY = ["applications"];

export function useApplications() {
  const { status } = useAuth();
  return useQuery({
    queryKey: KEY,
    queryFn: () => api("/applications").then((d) => d.applications),
    enabled: status === "signedIn",
    staleTime: 30_000,
  });
}

// jobId -> application, for "Tracked" badges in search results.
export function useTrackedMap() {
  const { data } = useApplications();
  return useMemo(() => new Map((data || []).filter((a) => a.jobId).map((a) => [a.jobId, a])), [data]);
}

export function snapshotOf(job) {
  return {
    title: job.title,
    company: job.company,
    location: job.location || "",
    url: job.applyUrl || job.url || "",
    source: job.source || "",
    companyLogo: job.companyLogo || "",
    salary: job.salary || null,
    arrangement: job.analysis?.arrangement || "",
  };
}

export function useTrackJob() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ job, status = "saved", fit = null }) =>
      api("/applications", { method: "POST", body: { jobId: job.id, job: snapshotOf(job), status, fit } }),
    onMutate: async ({ job, status = "saved", fit = null }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData(KEY);
      const temp = {
        id: `temp-${job.id}`,
        jobId: job.id,
        job: snapshotOf(job),
        status,
        outcome: "",
        fit,
        excitement: 0,
        notes: "",
        contact: "",
        appliedAt: status === "saved" ? null : new Date().toISOString(),
        followUpAt: null,
        order: -1,
        history: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      qc.setQueryData(KEY, (list) => [temp, ...(list || [])]);
      return { prev };
    },
    onError: (err, _v, ctx) => {
      qc.setQueryData(KEY, ctx?.prev);
      toast(err.message, { tone: "bad" });
    },
    onSuccess: ({ application }) => {
      qc.setQueryData(KEY, (list) => [application, ...(list || []).filter((a) => a.id !== `temp-${application.jobId}` && a.id !== application.id)]);
      qc.invalidateQueries({ queryKey: ["insights"] });
    },
  });
}

export function useUpdateApplication() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, patch }) => api(`/applications/${id}`, { method: "PATCH", body: patch }),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData(KEY);
      qc.setQueryData(KEY, (list) =>
        (list || []).map((a) => {
          if (a.id !== id) return a;
          const next = { ...a, ...patch, job: { ...a.job, ...(patch.job || {}) } };
          if (patch.status && patch.status !== "saved" && !a.appliedAt && patch.appliedAt === undefined) next.appliedAt = new Date().toISOString();
          return next;
        })
      );
      return { prev };
    },
    onError: (err, _v, ctx) => {
      qc.setQueryData(KEY, ctx?.prev);
      toast(err.message, { tone: "bad" });
    },
    onSuccess: ({ application }) => {
      qc.setQueryData(KEY, (list) => (list || []).map((a) => (a.id === application.id ? application : a)));
      qc.invalidateQueries({ queryKey: ["insights"] });
    },
  });
}

export function useDeleteApplication() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id) => api(`/applications/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData(KEY);
      qc.setQueryData(KEY, (list) => (list || []).filter((a) => a.id !== id));
      return { prev };
    },
    onError: (err, _v, ctx) => {
      qc.setQueryData(KEY, ctx?.prev);
      toast(err.message, { tone: "bad" });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["insights"] }),
  });
}
