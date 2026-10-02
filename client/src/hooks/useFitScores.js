import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { hashOf } from "../lib/format";
import { fitProfile, profileReady } from "../lib/fit";
import { useDebounced } from "./useUtils";

// Shared across views so revisiting a search never re-requests fit scores.
// Keyed by `${profileHash}:${jobId}`.
const cache = new Map();
const inflight = new Set();
const listeners = new Set();
const BATCH = 15;
const MAX_PARALLEL = 3;
let running = 0;
const queue = [];

function finished() {
  running -= 1;
  pump();
}

function pump() {
  while (running < MAX_PARALLEL && queue.length) {
    const task = queue.shift();
    running += 1;
    task().finally(finished);
  }
}

function notify() {
  for (const fn of listeners) fn();
}

// Scores jobs against the profile in batches as they appear. The profile is
// debounced so typing in the profile editor doesn't fire requests per key.
export function useFitScores(jobs, profile, { enabled = true } = {}) {
  const fp = useMemo(() => fitProfile(profile), [profile]);
  const settled = useDebounced(fp, 900);
  const hash = useMemo(() => hashOf(settled), [settled]);
  const ready = enabled && profileReady(settled);
  const ids = useMemo(() => jobs.map((j) => j.id), [jobs]);
  const idsKey = ids.join(",");
  const [version, setVersion] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fn = () => setVersion((t) => t + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);

  useEffect(() => {
    if (!ready || !ids.length) return;
    const missing = ids.filter((id) => !cache.has(`${hash}:${id}`) && !inflight.has(`${hash}:${id}`));
    if (!missing.length) return;
    setError(null);
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH);
      batch.forEach((id) => inflight.add(`${hash}:${id}`));
      queue.push(() =>
        api("/jobs/fit", { method: "POST", body: { profile: settled, jobIds: batch } })
          .then((res) => {
            for (const [id, value] of Object.entries(res.results || {})) cache.set(`${hash}:${id}`, value);
          })
          .catch((err) => setError(err.message))
          .finally(() => {
            batch.forEach((id) => inflight.delete(`${hash}:${id}`));
            notify();
          })
      );
    }
    pump();
    notify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, hash, ready]);

  // A new object only when the underlying results change, so consumers can
  // memoize on it.
  const { results, pending } = useMemo(() => {
    const out = {};
    let waiting = 0;
    for (const id of ids) {
      const v = cache.get(`${hash}:${id}`);
      if (v) out[id] = v;
      else if (inflight.has(`${hash}:${id}`)) waiting += 1;
    }
    return { results: out, pending: waiting };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, hash, version]);
  return { results, pending, error, ready, updating: hash !== hashOf(fp) };
}

export function clearFitCache() {
  cache.clear();
  notify();
}
