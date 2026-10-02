import { useCallback, useEffect, useState } from "react";

// Stored as a raw string so public/theme-init.js can apply it before React
// loads (avoids a flash of the wrong theme).
const KEY = "triage.theme";
const systemDark = () => Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches);

function readChoice() {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function useTheme() {
  const [choice, setChoice] = useState(readChoice);
  const [isDark, setIsDark] = useState(() => (choice === "system" ? systemDark() : choice === "dark"));

  useEffect(() => {
    const root = document.documentElement;
    if (choice === "system") delete root.dataset.theme;
    else root.dataset.theme = choice;
    try {
      if (choice === "system") window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, choice);
    } catch {
      // Storage unavailable; the theme still applies for this visit.
    }
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const update = () => setIsDark(choice === "system" ? Boolean(mq?.matches) : choice === "dark");
    update();
    mq?.addEventListener?.("change", update);
    return () => mq?.removeEventListener?.("change", update);
  }, [choice]);

  const toggle = useCallback(() => {
    setChoice((prev) => {
      const dark = prev === "system" ? systemDark() : prev === "dark";
      return dark ? "light" : "dark";
    });
  }, []);

  return { isDark, toggle };
}
