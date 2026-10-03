import { useEffect, useRef, useState } from "react";
import { Ban, Check, CloudOff, Loader2, Upload, X } from "lucide-react";
import ChipInput from "../components/ChipInput";
import ListEditor from "../components/ListEditor";
import Dialog from "../components/Dialog";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { useRouter } from "../hooks/useRouter";
import { useDocumentTitle } from "../hooks/useUtils";
import { api } from "../lib/api";
import { DEFAULT_WEIGHTS, DIMENSIONS, SENIORITY } from "../lib/constants";
import { profileCompleteness } from "../lib/fit";
import { SKILL_NAMES, canonicalSkill } from "../lib/skills";

const DEALBREAKER_EXAMPLES = [
  "Requires a security clearance",
  "Regular on-call or weekend shifts",
  "Contract or temporary role",
  "Commission-only pay",
  "More than 25% travel",
  "Crypto, gambling, or tobacco company",
  "Requires relocation",
];
const MUST_HAVE_EXAMPLES = [
  "Remote or hybrid work",
  "Visa sponsorship",
  "Health insurance",
  "Mentorship or clear growth path",
  "Flexible hours",
  "Learning or education budget",
  "Paid parental leave",
];
const CURRENCIES = ["USD", "CAD", "GBP", "EUR", "AUD", "INR", "SGD", "CHF", "SEK", "NZD", "MXN", "BRL"];
const WEIGHT_LABELS = ["Off", "Low", "Medium", "High"];

function Section({ id, title, hint, children }) {
  return (
    <section className="panel profile-section" id={id} aria-labelledby={`${id}-title`}>
      <header>
        <h2 id={`${id}-title`}>{title}</h2>
        {hint && <p className="muted small">{hint}</p>}
      </header>
      {children}
    </section>
  );
}

function ResumeBox({ profile, updateProfile, onSkills }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);

  const upload = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast("That file is larger than 5 MB.", { tone: "bad" });
    const form = new FormData();
    form.append("file", file);
    setBusy(true);
    try {
      const res = await api("/profile/resume", { method: "POST", form });
      updateProfile({ resumeText: res.text, resumeName: res.name });
      onSkills(res.skills);
      toast(res.truncated ? "Resume imported (trimmed to 20,000 characters)." : "Resume imported.", { tone: "good" });
    } catch (err) {
      toast(err.message, { tone: "bad", duration: 6000 });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="resume-box">
      <div
        className={`dropzone ${drag ? "drag" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          upload(e.dataTransfer.files?.[0]);
        }}
      >
        {busy ? <Loader2 size={20} className="spin" aria-hidden /> : <Upload size={20} aria-hidden />}
        <div>
          <strong>{profile.resumeName || "Drop your resume here"}</strong>
          <span className="muted small">PDF, Word (.docx) or text. Read in memory, never stored as a file.</span>
        </div>
        <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()} disabled={busy}>
          {profile.resumeText ? "Replace" : "Choose file"}
        </button>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" hidden onChange={(e) => upload(e.target.files?.[0])} />
      </div>
      <label className="field">
        <span>
          Resume text <span className="muted small">({(profile.resumeText || "").length.toLocaleString()} / 20,000)</span>
        </span>
        <textarea
          rows={8}
          maxLength={20000}
          value={profile.resumeText}
          placeholder="…or paste your resume or a summary of your experience here."
          onChange={(e) => updateProfile({ resumeText: e.target.value, resumeName: e.target.value ? profile.resumeName : "" })}
        />
      </label>
      {profile.resumeText && (
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => updateProfile({ resumeText: "", resumeName: "" })}>
          <X size={14} aria-hidden /> Clear resume
        </button>
      )}
    </div>
  );
}

function AccountSection() {
  const { user, updateAccount, changePassword, deleteAccount, signOut } = useAuth();
  const toast = useToast();
  const { navigate } = useRouter();
  const [name, setName] = useState(user.name || "");
  const [pw, setPw] = useState({ current: "", next: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState("");

  const saveName = async () => {
    if (name.trim() === (user.name || "")) return;
    try {
      await updateAccount({ name: name.trim() });
      toast("Name updated", { tone: "good" });
    } catch (err) {
      toast(err.message, { tone: "bad" });
    }
  };
  const savePassword = async (e) => {
    e.preventDefault();
    setPwBusy(true);
    try {
      await changePassword(pw.current, pw.next);
      setPw({ current: "", next: "" });
      toast("Password changed. Other devices have been signed out.", { tone: "good" });
    } catch (err) {
      toast(err.message, { tone: "bad" });
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <Section id="account" title="Account" hint={`Signed in as ${user.email}`}>
      <div className="form-grid">
        <label className="field">
          <span>Display name</span>
          <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} onBlur={saveName} />
        </label>
        <label className="field">
          <span>Email</span>
          <input value={user.email} readOnly />
        </label>
      </div>
      <form className="form-grid" onSubmit={savePassword}>
        <label className="field">
          <span>Current password</span>
          <input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} required />
        </label>
        <label className="field">
          <span>New password</span>
          <input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} required />
        </label>
        <button className="btn btn-sm" disabled={pwBusy}>
          {pwBusy ? "Saving…" : "Change password"}
        </button>
      </form>
      <div className="danger-row">
        <button type="button" className="btn btn-sm btn-ghost" onClick={signOut}>
          Sign out
        </button>
        <button type="button" className="btn btn-sm btn-danger-ghost" onClick={() => setConfirm(true)}>
          Delete account
        </button>
      </div>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Delete your account?" labelledBy="delete-title">
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await deleteAccount();
              setConfirm(false);
              navigate("/");
              toast("Your account and everything in it was deleted.");
            } catch (err) {
              toast(err.message, { tone: "bad" });
            }
          }}
        >
          <p className="muted">This permanently removes your profile, tracker, saved searches, and search history. Type DELETE to confirm.</p>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Type DELETE to confirm" autoComplete="off" />
          <button className="btn btn-danger" disabled={typed !== "DELETE"}>
            Delete everything
          </button>
        </form>
      </Dialog>
    </Section>
  );
}

function ProfileEditor() {
  const { profile, updateProfile, syncState } = useAuth();
  const [suggested, setSuggested] = useState([]);
  const { checks, ratio } = profileCompleteness(profile);

  // Suggest skills found in the resume that aren't listed yet.
  useEffect(() => {
    if (!profile.resumeText?.trim()) return setSuggested([]);
    const t = setTimeout(() => {
      api("/profile/skills", { method: "POST", body: { text: profile.resumeText } })
        .then((r) => setSuggested(r.skills))
        .catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [profile.resumeText]);

  useEffect(() => {
    if (window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" });
  }, []);

  const mine = new Set(profile.skills.map((s) => s.toLowerCase()));
  const newSuggestions = suggested.filter((s) => !mine.has(s.toLowerCase()));
  const weights = { ...DEFAULT_WEIGHTS, ...(profile.weights || {}) };
  const set = (k) => (v) => updateProfile({ [k]: v });

  return (
    <div className="page profile">
      <div className="page-head">
        <div>
          <h1>Your hunting profile</h1>
          <p className="muted">Triage compares every job against this. The more you add, the sharper the fit scores.</p>
        </div>
        <span className={`sync sync-${syncState}`}>
          {syncState === "saving" ? (
            <>
              <Loader2 size={14} className="spin" aria-hidden /> Saving…
            </>
          ) : syncState === "error" ? (
            <>
              <CloudOff size={14} aria-hidden /> Not saved
            </>
          ) : (
            <>
              <Check size={14} aria-hidden /> Saved to your account
            </>
          )}
        </span>
      </div>

      <div className="profile-layout">
        <div className="profile-main">
          <Section id="basics" title="What you're looking for">
            <label className="field">
              <span>Headline</span>
              <input value={profile.headline} maxLength={120} placeholder="e.g. Frontend engineer focused on design systems" onChange={(e) => set("headline")(e.target.value)} />
            </label>
            <div className="field">
              <span>Target roles</span>
              <ChipInput value={profile.targetRoles} onChange={set("targetRoles")} max={8} placeholder="Add a role and press Enter" label="Target roles" splitOnComma={false} />
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Experience level</span>
                <select value={profile.seniority} onChange={(e) => set("seniority")(e.target.value)}>
                  <option value="">Choose…</option>
                  {Object.entries(SENIORITY).map(([id, l]) => (
                    <option key={id} value={id}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Years of experience</span>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={profile.yearsExperience ?? ""}
                  onChange={(e) => set("yearsExperience")(e.target.value === "" ? null : Math.min(60, Math.max(0, Number(e.target.value))))}
                />
              </label>
            </div>
          </Section>

          <Section id="skills" title="Skills" hint="Tools, languages, and specialties. Matching uses meaning, so related skills still count.">
            <ChipInput value={profile.skills} onChange={set("skills")} max={60} maxLength={40} suggestions={SKILL_NAMES} normalize={canonicalSkill} placeholder="Add a skill and press Enter" label="Skills" />
            {newSuggestions.length > 0 && (
              <div className="suggestions">
                <span className="small muted">Found in your resume:</span>
                {newSuggestions.slice(0, 20).map((s) => (
                  <button key={s} type="button" className="chip chip-neutral chip-btn" onClick={() => set("skills")([...profile.skills, s])}>
                    + {s}
                  </button>
                ))}
                {newSuggestions.length > 1 && (
                  <button type="button" className="link small" onClick={() => set("skills")([...profile.skills, ...newSuggestions].slice(0, 60))}>
                    Add all
                  </button>
                )}
              </div>
            )}
          </Section>

          <Section id="resume" title="Resume" hint="Used to judge skills, level, and each job's requirements. It's sent to the server for scoring and stored only in your profile.">
            <ResumeBox profile={profile} updateProfile={updateProfile} onSkills={setSuggested} />
          </Section>

          <Section id="where" title="Where and how you work">
            <div className="field">
              <span>Places you'd commute to</span>
              <ChipInput value={profile.locations} onChange={set("locations")} max={6} maxLength={80} placeholder="e.g. Austin, TX" label="Locations" splitOnComma={false} />
            </div>
            <fieldset className="field">
              <legend>Work styles you'll accept</legend>
              <div className="pill-row">
                {[
                  ["remote", "Remote"],
                  ["hybrid", "Hybrid"],
                  ["onsite", "On-site"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`pill ${profile.arrangements[id] ? "on" : ""}`}
                    aria-pressed={profile.arrangements[id]}
                    onClick={() => set("arrangements")({ ...profile.arrangements, [id]: !profile.arrangements[id] })}
                  >
                    {profile.arrangements[id] && <Check size={13} aria-hidden />} {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="form-grid">
              <label className="field">
                <span>Salary floor (per year)</span>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={profile.minSalary ?? ""}
                  placeholder="e.g. 120000"
                  onChange={(e) => set("minSalary")(e.target.value === "" ? null : Math.max(0, Number(e.target.value)))}
                />
              </label>
              <label className="field">
                <span>Currency</span>
                <select value={profile.currency} onChange={(e) => set("currency")(e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
          </Section>

          <Section
            id="wants"
            icon={Ban}
            title="Dealbreakers and must-haves"
            hint="Write them in plain English. Jev checks every posting for each one; dealbreakers sink a job to the bottom and must-haves raise its fit."
          >
            <div className="two-col">
              <div>
                <h3 className="sub-head bad-text">Dealbreakers</h3>
                <ListEditor items={profile.dealbreakers} onChange={set("dealbreakers")} examples={DEALBREAKER_EXAMPLES} placeholder="e.g. Requires on-call" tone="bad" />
              </div>
              <div>
                <h3 className="sub-head good-text">Must-haves</h3>
                <ListEditor items={profile.mustHaves} onChange={set("mustHaves")} examples={MUST_HAVE_EXAMPLES} placeholder="e.g. 4-day work week" tone="good" />
              </div>
            </div>
            <p className="small muted">Salary is compared in code against your floor above, so it doesn't need a dealbreaker.</p>
          </Section>
        </div>

        <aside className="profile-side">
          <section className="panel">
            <div className="panel-title">Profile strength</div>
            <div className="meter" aria-label={`Profile ${Math.round(ratio * 100)}% complete`}>
              <span style={{ width: `${ratio * 100}%` }} />
            </div>
            <ul className="checklist">
              {checks.map((c) => (
                <li key={c.id} className={c.done ? "done" : ""}>
                  {c.label}
                </li>
              ))}
            </ul>
          </section>

          <section className="panel" id="weights">
            <div className="panel-title">
              Fit weights
            </div>
            <p className="small muted">How much each factor counts. Changing these re-ranks results instantly.</p>
            {DIMENSIONS.map(({ id, label, hint }) => (
              <label key={id} className="weight" title={hint}>
                <span className="weight-label">{label}</span>
                <input type="range" min={0} max={3} step={1} value={weights[id]} onChange={(e) => set("weights")({ ...weights, [id]: Number(e.target.value) })} aria-valuetext={WEIGHT_LABELS[weights[id]]} />
                <span className="weight-value">{WEIGHT_LABELS[weights[id]]}</span>
              </label>
            ))}
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => set("weights")({ ...DEFAULT_WEIGHTS })}>
              Reset weights
            </button>
          </section>

          <section className="panel" id="hidden">
            <div className="panel-title">Hidden companies</div>
            {profile.hiddenCompanies.length ? (
              <ul className="list compact">
                {profile.hiddenCompanies.map((c) => (
                  <li key={c} className="list-row">
                    <span>{c}</span>
                    <button type="button" className="icon-btn" onClick={() => set("hiddenCompanies")(profile.hiddenCompanies.filter((x) => x !== c))} aria-label={`Show ${c} again`}>
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">Hide a company from any job's detail panel and it disappears from every search.</p>
            )}
          </section>
        </aside>
      </div>

      <AccountSection />
    </div>
  );
}

const PERKS = [
  ["A fit score on every job", "Skills, level, role, commute and pay, weighted the way you choose."],
  ["Dealbreakers in plain English", "Write \"requires on-call\" or \"no crypto companies\" and matching jobs sink to the bottom."],
  ["Requirement checks", "See which requirements you already meet and which of your skills to lead with."],
  ["Resume import", "Upload a PDF or Word file and Triage picks out your skills."],
];

// What guests see: the profile is an account feature.
function LockedProfile({ onRequireAccount }) {
  const { accountsAvailable } = useAuth();
  return (
    <div className="page locked">
      <section className="locked-card" aria-labelledby="locked-title">
        <h1 id="locked-title">Your profile lives in your account</h1>
        <p className="muted">Create a free account to build a profile. Triage scores every job against it, and it follows you to any device.</p>
        <ul className="perks">
          {PERKS.map(([title, text]) => (
            <li key={title}>
              <div>
                <strong>{title}</strong>
                <span className="muted small">{text}</span>
              </div>
            </li>
          ))}
        </ul>
        {!accountsAvailable && (
          <div className="notice notice-warn" role="alert">
            Accounts are unavailable right now (the database isn't connected). Searching still works as a guest.
          </div>
        )}
        <div className="locked-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onRequireAccount("Create a free account to build your profile.", { mode: "register" })}
            disabled={!accountsAvailable}
          >
            Create a free account
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => onRequireAccount("Sign in to see your profile.")} disabled={!accountsAvailable}>
            I already have an account
          </button>
        </div>
      </section>
    </div>
  );
}

export default function ProfileView({ onRequireAccount }) {
  const { status } = useAuth();
  useDocumentTitle("Profile");
  if (status === "loading") {
    return (
      <div className="page empty-state">
        <div className="spinner" aria-label="Loading" />
      </div>
    );
  }
  if (status !== "signedIn") return <LockedProfile onRequireAccount={onRequireAccount} />;
  return <ProfileEditor />;
}
