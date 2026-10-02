import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartNoAxesColumn, Check } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useDocumentTitle } from "../hooks/useUtils";
import { Link } from "../hooks/useRouter";
import { ARRANGEMENTS, SENIORITY, SOURCES, STATUSES } from "../lib/constants";
import { money, pct } from "../lib/format";
import { canonicalSkill } from "../lib/skills";

const AXIS = { fontSize: 12, fill: "var(--chart-muted)" };
const tooltipProps = {
  cursor: { fill: "var(--chart-hover)" },
  contentStyle: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    boxShadow: "var(--shadow-md)",
    color: "var(--text)",
    fontSize: 13,
  },
  labelStyle: { color: "var(--text)", fontWeight: 600 },
  itemStyle: { color: "var(--text-2)" },
};

function StatTile({ label, value, sub }) {
  return (
    <div className="stat-tile">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

function ChartCard({ title, subtitle, children, table, className = "" }) {
  return (
    <section className={`panel chart-card ${className}`}>
      <header>
        <h3>{title}</h3>
        {subtitle && <p className="muted small">{subtitle}</p>}
      </header>
      {children}
      {table && (
        <details className="chart-table">
          <summary>Show as table</summary>
          {table}
        </details>
      )}
    </section>
  );
}

function DataTable({ columns, rows }) {
  return (
    <table>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c} scope="col">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((v, j) => (
              <td key={j}>{v}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// A single 100% bar split into parts, with a legend that carries identity
// and numbers (color is never the only cue).
function SplitBar({ parts, total, label }) {
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div className="split">
      <div className="split-bar" role="img" aria-label={`${label}: ${shown.map((p) => `${p.label} ${p.value}`).join(", ")}`}>
        {shown.map((p) => (
          <span key={p.id} style={{ flexGrow: p.value, background: p.color }} title={`${p.label}: ${p.value} (${pct(p.value / total)})`} />
        ))}
      </div>
      <ul className="split-legend">
        {parts.map((p) => (
          <li key={p.id}>
            <span className="swatch" style={{ background: p.color }} aria-hidden />
            <span>{p.label}</span>
            <strong>{p.value}</strong>
            <span className="muted">{total ? pct(p.value / total) : "–"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function histogram(values, floor) {
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * 0.02)];
  const hi = sorted[Math.ceil(sorted.length * 0.98) - 1];
  const span = Math.max(1, hi - lo);
  const rough = span / 10;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough) || rough;
  const start = Math.floor(Math.min(lo, floor || lo) / step) * step;
  const end = Math.ceil(Math.max(hi, floor || hi) / step) * step;
  const bins = [];
  for (let x = start; x < end; x += step) bins.push({ from: x, to: x + step, mid: x + step / 2, count: 0 });
  for (const v of values) {
    const b = bins[Math.min(bins.length - 1, Math.max(0, Math.floor((v - start) / step)))];
    if (b) b.count += 1;
  }
  return bins;
}

export default function InsightsView({ onRequireAccount }) {
  const { status, profile } = useAuth();
  useDocumentTitle("Insights");
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["insights"],
    queryFn: () => api("/insights"),
    enabled: status === "signedIn",
    staleTime: 60_000,
  });

  const mySkills = useMemo(() => new Set((profile.skills || []).map((s) => canonicalSkill(s).toLowerCase())), [profile.skills]);

  if (status !== "signedIn") {
    return (
      <div className="page empty-state">
        <ChartNoAxesColumn size={36} aria-hidden />
        <h1>See your search in numbers</h1>
        <p className="muted">Your pipeline and response rate, the skills employers ask for most in your searches, and where pay lands against your floor.</p>
        <button type="button" className="btn btn-primary" onClick={() => onRequireAccount("Sign in to see insights from your searches and applications.")} disabled={status === "loading"}>
          Sign in to see insights
        </button>
      </div>
    );
  }
  if (isError) return <div className="page notice notice-bad">{error.message}</div>;
  if (isLoading || !data) {
    return (
      <div className="page empty-state">
        <div className="spinner" aria-label="Loading insights" />
      </div>
    );
  }

  const { pipeline, weekly, market } = data;
  const pipelineRows = STATUSES.map((s) => ({ id: s.id, label: s.label, count: pipeline.statuses[s.id] || 0 }));
  const weeklyRows = weekly.map((w) => ({ ...w, label: new Date(`${w.week}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }) }));
  const skills = market.topSkills.slice(0, 15).map((s) => ({ ...s, have: mySkills.has(s.skill.toLowerCase()), share: Math.round(s.share * 100) }));
  const floor = profile.currency === market.currency ? Number(profile.minSalary) || null : null;
  const bins = histogram(market.salaries, floor);
  const arrangementColors = { remote: "var(--series-1)", hybrid: "var(--series-2)", onsite: "var(--series-3)", unclear: "var(--series-muted)" };
  const sourceColors = { linkedin: "var(--series-1)", indeed: "var(--series-2)", glassdoor: "var(--series-3)" };
  const seniorityRows = Object.entries(SENIORITY)
    .map(([id, label]) => ({ id, label, count: market.seniority[id] || 0 }))
    .filter((r) => r.count > 0);
  const median = market.salaries.length ? [...market.salaries].sort((a, b) => a - b)[Math.floor(market.salaries.length / 2)] : null;
  const aboveFloor = floor && market.salaries.length ? market.salaries.filter((v) => v >= floor).length / market.salaries.length : null;

  return (
    <div className="page insights">
      <div className="page-head">
        <div>
          <h1>Insights</h1>
          <p className="muted">
            From {pipeline.total} tracked job{pipeline.total === 1 ? "" : "s"} and {market.totalJobs} postings across your last {market.searches} search
            {market.searches === 1 ? "" : "es"}.
          </p>
        </div>
      </div>

      <div className="stat-row">
        <StatTile label="Tracked" value={pipeline.total} sub={`${pipeline.statuses.saved || 0} saved for later`} />
        <StatTile label="Applied" value={pipeline.applied} sub={pipeline.followUpsDue ? `${pipeline.followUpsDue} follow-up${pipeline.followUpsDue === 1 ? "" : "s"} due` : "No follow-ups due"} />
        <StatTile label="Response rate" value={pipeline.responseRate == null ? "–" : pct(pipeline.responseRate)} sub={`${pipeline.responded} reached interviews`} />
        <StatTile label="Avg fit of applications" value={pipeline.avgAppliedFit ?? "–"} sub="Fit score when you tracked them" />
        <StatTile label="Median posted pay" value={median ? money(median, market.currency) : "–"} sub={aboveFloor != null ? `${pct(aboveFloor)} meet your floor` : "Annualized, where listed"} />
      </div>

      <div className="chart-grid">
        <ChartCard
          title="Pipeline"
          subtitle="Jobs in each stage right now"
          table={<DataTable columns={["Stage", "Jobs"]} rows={pipelineRows.map((r) => [r.label, r.count])} />}
        >
          {pipeline.total ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={pipelineRows} layout="vertical" margin={{ top: 4, right: 36, bottom: 4, left: 8 }}>
                <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
                <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" width={92} tick={{ ...AXIS, fill: "var(--text-2)" }} axisLine={{ stroke: "var(--chart-axis)" }} tickLine={false} />
                <Tooltip {...tooltipProps} formatter={(v) => [v, "Jobs"]} />
                <Bar dataKey="count" fill="var(--series-1)" barSize={20} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  <LabelList dataKey="count" position="right" style={{ fill: "var(--text-2)", fontSize: 12 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="muted small chart-empty">
              Nothing tracked yet. Save jobs from a <Link to="/">hunt</Link> to build your pipeline.
            </p>
          )}
          {pipeline.statuses.closed > 0 && (
            <p className="small muted">
              Closed: {Object.entries(pipeline.outcomes)
                .filter(([, n]) => n)
                .map(([k, n]) => `${n} ${k}`)
                .join(" · ")}
            </p>
          )}
        </ChartCard>

        <ChartCard
          title="Activity"
          subtitle="Jobs saved and applications sent per week"
          table={<DataTable columns={["Week of", "Saved", "Applied"]} rows={weeklyRows.map((w) => [w.label, w.saved, w.applied])} />}
        >
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={weeklyRows} margin={{ top: 8, right: 16, bottom: 4, left: -16 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="label" tick={AXIS} axisLine={{ stroke: "var(--chart-axis)" }} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
              <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipProps} cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }} />
              <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: "var(--text-2)" }} />
              <Line type="monotone" dataKey="saved" name="Saved" stroke="var(--series-1)" strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--surface)" }} isAnimationActive={false} />
              <Line type="monotone" dataKey="applied" name="Applied" stroke="var(--series-2)" strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--surface)" }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          className="span-2"
          title="Skills employers ask for"
          subtitle={`Share of postings in your recent searches that mention each skill`}
          table={<DataTable columns={["Skill", "Postings", "Share", "On your profile"]} rows={skills.map((s) => [s.skill, s.count, `${s.share}%`, s.have ? "Yes" : "No"])} />}
        >
          {skills.length ? (
            <>
              <ul className="legend-row" aria-hidden>
                <li>
                  <span className="swatch" style={{ background: "var(--series-1)" }} /> On your profile
                </li>
                <li>
                  <span className="swatch" style={{ background: "var(--series-muted)" }} /> Not on your profile
                </li>
              </ul>
              <ResponsiveContainer width="100%" height={Math.max(180, skills.length * 30)}>
                <BarChart data={skills} layout="vertical" margin={{ top: 0, right: 44, bottom: 0, left: 8 }}>
                  <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={AXIS} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="skill"
                    width={130}
                    axisLine={{ stroke: "var(--chart-axis)" }}
                    tickLine={false}
                    tick={({ x, y, payload }) => {
                      const have = skills.find((s) => s.skill === payload.value)?.have;
                      return (
                        <text x={x - 6} y={y} dy={4} textAnchor="end" fontSize={12} fill="var(--text-2)">
                          {have ? "✓ " : ""}
                          {payload.value}
                        </text>
                      );
                    }}
                  />
                  <Tooltip {...tooltipProps} formatter={(v, _n, p) => [`${v}% of postings (${p.payload.count})`, p.payload.have ? "On your profile" : "Not on your profile"]} />
                  <Bar dataKey="share" barSize={16} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    {skills.map((s) => (
                      <Cell key={s.skill} fill={s.have ? "var(--series-1)" : "var(--series-muted)"} />
                    ))}
                    <LabelList dataKey="share" position="right" formatter={(v) => `${v}%`} style={{ fill: "var(--text-2)", fontSize: 12 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {skills.some((s) => !s.have) && (
                <p className="small muted">
                  <Check size={12} aria-hidden /> marks skills already on your profile. Gaps near the top are the ones most worth learning or adding if you have them.
                </p>
              )}
            </>
          ) : (
            <p className="muted small chart-empty">Run a few hunts to see which skills come up most.</p>
          )}
        </ChartCard>

        <ChartCard
          title="Pay landscape"
          subtitle={`Annualized midpoint of posted pay (${market.currency})${floor ? ", with your floor" : ""}`}
          table={<DataTable columns={["Range", "Postings"]} rows={bins.map((b) => [`${money(b.from, market.currency)}–${money(b.to, market.currency)}`, b.count])} />}
        >
          {bins.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={bins} margin={{ top: 18, right: 12, bottom: 4, left: -16 }} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="mid" type="number" domain={[bins[0].from, bins[bins.length - 1].to]} tickFormatter={(v) => money(v, market.currency)} tick={AXIS} axisLine={{ stroke: "var(--chart-axis)" }} tickLine={false} />
                <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipProps} labelFormatter={(_, p) => (p?.[0] ? `${money(p[0].payload.from, market.currency)}–${money(p[0].payload.to, market.currency)}` : "")} formatter={(v) => [v, "Postings"]} />
                <Bar dataKey="count" fill="var(--series-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                {floor && <ReferenceLine x={floor} stroke="var(--text)" strokeWidth={1.5} label={{ value: `Your floor ${money(floor, market.currency)}`, position: "top", fill: "var(--text-2)", fontSize: 12 }} />}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="muted small chart-empty">No pay data yet. Many postings don't list pay; Glassdoor results usually include estimates.</p>
          )}
        </ChartCard>

        <ChartCard title="Where the jobs are" subtitle="Work style and job board across your recent searches">
          <h4 className="mini-head">Work style (from the X-ray)</h4>
          <SplitBar
            label="Work style"
            total={market.totalJobs}
            parts={["remote", "hybrid", "onsite", "unclear"].map((id) => ({
              id,
              label: id === "unclear" ? "Not stated" : ARRANGEMENTS[id].label,
              value: market.arrangements[id] || 0,
              color: arrangementColors[id],
            }))}
          />
          <h4 className="mini-head">Listed on</h4>
          <ul className="board-bars">
            {Object.entries(SOURCES).map(([id, s]) => {
              const n = market.sources[id] || 0;
              return (
                <li key={id}>
                  <span className="swatch" style={{ background: sourceColors[id] }} aria-hidden />
                  <span>{s.label}</span>
                  <span className="board-bar" aria-hidden>
                    <span style={{ width: `${market.totalJobs ? (n / market.totalJobs) * 100 : 0}%`, background: sourceColors[id] }} />
                  </span>
                  <strong>{n}</strong>
                </li>
              );
            })}
          </ul>
          <p className="small muted">A job posted on several boards counts once for each.</p>
          {seniorityRows.length > 0 && (
            <>
              <h4 className="mini-head">Level</h4>
              <p className="small muted">{seniorityRows.map((r) => `${r.label} ${pct(r.count / market.totalJobs)}`).join(" · ")}</p>
            </>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
