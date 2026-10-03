import { useCallback, useEffect, useState } from "react";

// Triage is light first: warm paper unless someone picks dark, whatever the
// OS says. Stored as a raw string so public/theme-init.js can apply it before
// React loads (avoids a flash of the wrong theme).
const KEY = "triage.theme";
const THEME_COLOR = { light: "#f6f3ec", dark: "#121110" };

function readChoice() {
  try {
    return window.localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function useTheme() {
  const [choice, setChoice] = useState(readChoice);

  useEffect(() => {
    const root = document.documentElement;
    if (choice === "dark") root.dataset.theme = "dark";
    else delete root.dataset.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[choice]);
    try {
      if (choice === "dark") window.localStorage.setItem(KEY, "dark");
      else window.localStorage.removeItem(KEY);
    } catch {
      // Storage unavailable; the theme still applies for this visit.
    }
  }, [choice]);

  const toggle = useCallback(() => setChoice((prev) => (prev === "dark" ? "light" : "dark")), []);

  return { isDark: choice === "dark", toggle };
}
