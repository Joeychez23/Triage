import { useEffect, useRef, useState } from "react";

export function useDebounced(value, delay) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function useMediaQuery(query) {
  const get = () => Boolean(window.matchMedia?.(query).matches);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return undefined;
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, [query]);
  return matches;
}

// Keyboard shortcuts that ignore typing in inputs. map: { key: handler }.
export function useHotkeys(map, enabled = true) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target;
      const typing = el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      if (typing && e.key !== "Escape") return;
      if (document.querySelector("dialog[open]") && e.key !== "Escape") return;
      const handler = ref.current[e.key];
      if (handler) {
        e.preventDefault();
        handler(e);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | Triage` : "Triage | Know which jobs deserve your time";
  }, [title]);
}
