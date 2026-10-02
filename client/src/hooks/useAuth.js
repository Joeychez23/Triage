import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, setUnauthorizedHandler } from "../lib/api";
import { load, save } from "../lib/storage";
import { DEFAULT_WEIGHTS, EMPTY_PROFILE } from "../lib/constants";

const AuthContext = createContext(null);

// Fills in every field so components never deal with partial profiles.
export function normalizeProfile(p) {
  const src = p && typeof p === "object" ? p : {};
  return {
    ...EMPTY_PROFILE,
    ...src,
    arrangements: { ...EMPTY_PROFILE.arrangements, ...(src.arrangements || {}) },
    weights: { ...DEFAULT_WEIGHTS, ...(src.weights || {}) },
    targetRoles: src.targetRoles || [],
    skills: src.skills || [],
    locations: src.locations || [],
    dealbreakers: src.dealbreakers || [],
    mustHaves: src.mustHaves || [],
    hiddenCompanies: src.hiddenCompanies || [],
  };
}

const USER_QUERIES = ["applications", "insights", "searches", "saved"];

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | guest | signedIn
  const [health, setHealth] = useState(null);
  // The profile is an account feature: guests always see an empty one.
  const [profile, setProfile] = useState(() => normalizeProfile(null));
  const [savedSearches, setSavedSearches] = useState([]);
  const [syncState, setSyncState] = useState("idle"); // idle | saving | saved | error
  const statusRef = useRef(status);
  const pendingRef = useRef(null);
  const timerRef = useRef(null);
  statusRef.current = status;

  const signOut = useCallback(() => {
    clearTimeout(timerRef.current);
    pendingRef.current = null;
    save("token", null);
    setUser(null);
    setSavedSearches([]);
    setProfile(normalizeProfile(null));
    setStatus("guest");
    for (const key of USER_QUERIES) qc.removeQueries({ queryKey: [key] });
  }, [qc]);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
    let cancelled = false;
    let retry;
    const check = async (attempt = 0) => {
      const h = await api("/health").catch(() => null);
      if (cancelled) return;
      // The database may still be connecting right after the server starts.
      if (h?.db === "connecting" && attempt < 8) {
        retry = setTimeout(() => check(attempt + 1), 1500);
        return;
      }
      setHealth(h || { ok: false });
      if (!load("token", null) || !h?.accounts) {
        setStatus("guest");
        return;
      }
      try {
        const session = await api("/auth/me");
        if (cancelled) return;
        setUser(session.user);
        setProfile(normalizeProfile(session.profile));
        setSavedSearches(session.savedSearches || []);
        setStatus("signedIn");
      } catch {
        if (!cancelled) signOut();
      }
    };
    check();
    return () => {
      cancelled = true;
      clearTimeout(retry);
    };
  }, [signOut]);

  const pushProfile = useCallback(async (next) => {
    setSyncState("saving");
    try {
      const { profile: saved } = await api("/profile", { method: "PUT", body: { profile: next } });
      setSyncState("saved");
      return saved;
    } catch (err) {
      setSyncState("error");
      throw err;
    }
  }, []);

  const finish = useCallback(
    async (session) => {
      save("token", session.token);
      setUser(session.user);
      setProfile(normalizeProfile(session.profile));
      setSavedSearches(session.savedSearches || []);
      setStatus("signedIn");
      // Move this browser's guest searches into the account's history.
      const recent = load("recentSearches", []);
      if (recent.length) {
        api("/searches/claim", { method: "POST", body: { ids: recent.map((s) => s.id) } })
          .then(() => {
            save("recentSearches", null);
            qc.invalidateQueries({ queryKey: ["searches"] });
            qc.invalidateQueries({ queryKey: ["insights"] });
          })
          .catch(() => {});
      }
      for (const key of USER_QUERIES) qc.invalidateQueries({ queryKey: [key] });
      return session.user;
    },
    [qc]
  );

  const signIn = useCallback((email, password) => api("/auth/login", { method: "POST", body: { email, password } }).then(finish), [finish]);
  const register = useCallback(
    (email, password, name) => api("/auth/register", { method: "POST", body: { email, password, name } }).then(finish),
    [finish]
  );

  // Profile edits apply locally at once and sync to the server, debounced.
  // Guests have no profile, so their edits are ignored (the UI asks them to
  // sign up instead of offering profile controls).
  const updateProfile = useCallback(
    (patch) => {
      if (statusRef.current !== "signedIn") return;
      setProfile((prev) => {
        const next = normalizeProfile({ ...prev, ...(typeof patch === "function" ? patch(prev) : patch) });
        pendingRef.current = next;
        clearTimeout(timerRef.current);
        setSyncState("saving");
        timerRef.current = setTimeout(() => {
          const body = pendingRef.current;
          pendingRef.current = null;
          if (body) pushProfile(body).catch(() => {});
        }, 800);
        return next;
      });
    },
    [pushProfile]
  );

  // Don't lose an edit made in the last moment before closing the tab.
  useEffect(() => {
    const flush = () => {
      const body = pendingRef.current;
      const token = load("token", null);
      if (!body || !token) return;
      pendingRef.current = null;
      fetch("/api/profile", {
        method: "PUT",
        keepalive: true,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ profile: body }),
      }).catch(() => {});
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  const updateAccount = useCallback(async (patch) => {
    const { user: next } = await api("/auth/account", { method: "PATCH", body: patch });
    setUser(next);
    return next;
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const { token } = await api("/auth/password", { method: "POST", body: { currentPassword, newPassword } });
    save("token", token);
  }, []);

  const deleteAccount = useCallback(async () => {
    await api("/auth/account", { method: "DELETE" });
    signOut();
  }, [signOut]);

  const refreshSaved = useCallback(async () => {
    if (statusRef.current !== "signedIn") return;
    const { savedSearches: list } = await api("/saved-searches");
    setSavedSearches(list);
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      health,
      accountsAvailable: Boolean(health?.accounts),
      profile,
      updateProfile,
      syncState,
      savedSearches,
      setSavedSearches,
      refreshSaved,
      signIn,
      register,
      signOut,
      updateAccount,
      changePassword,
      deleteAccount,
    }),
    [user, status, health, profile, updateProfile, syncState, savedSearches, refreshSaved, signIn, register, signOut, updateAccount, changePassword, deleteAccount]
  );
  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
