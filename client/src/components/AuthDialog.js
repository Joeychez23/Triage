import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import Dialog from "./Dialog";

// Sign in / create account. Mirrors the bcrypt + JWT flow on the server.
export default function AuthDialog({ open, onClose, reason, initialMode = "signin" }) {
  const { signIn, register, accountsAvailable } = useAuth();
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    setMode(initialMode);
  }, [open, initialMode]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "signin") await signIn(form.email, form.password);
      else await register(form.email, form.password, form.name);
      setForm({ name: "", email: "", password: "" });
      onClose(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => onClose(false)} labelledBy="auth-title" title={mode === "signin" ? "Welcome back" : "Create your account"}>
      <form onSubmit={submit} className="stack">
        <p className="muted small">
          {reason || "Track applications, save searches, and keep your profile in sync across devices."} Your profile stays private to your
          account.
        </p>
        {!accountsAvailable && (
          <div className="notice notice-warn" role="alert">
            Accounts are unavailable right now (the database isn't connected). You can keep searching as a guest.
          </div>
        )}
        {mode === "register" && (
          <label className="field">
            <span>Name</span>
            <input value={form.name} onChange={set("name")} autoComplete="name" maxLength={80} />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input type="email" required value={form.email} onChange={set("email")} autoComplete="email" />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            required
            minLength={mode === "register" ? 8 : undefined}
            maxLength={128}
            value={form.password}
            onChange={set("password")}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
          {mode === "register" && <small className="muted">At least 8 characters.</small>}
        </label>
        {error && (
          <div className="notice notice-bad" role="alert">
            {error}
          </div>
        )}
        <button className="btn btn-primary btn-block" disabled={busy || !accountsAvailable}>
          {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
        <p className="small center">
          {mode === "signin" ? "New to Triage?" : "Already have an account?"}{" "}
          <button
            type="button"
            className="link"
            onClick={() => {
              setMode(mode === "signin" ? "register" : "signin");
              setError("");
            }}
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </form>
    </Dialog>
  );
}
