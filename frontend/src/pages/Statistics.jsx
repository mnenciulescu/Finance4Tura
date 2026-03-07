import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { listIncomes } from "../api/incomes";
import { listExpenses } from "../api/expenses";

const COLORS = {
  income:    "#6c63ff",
  expenses:  "#ef4444",
  balance:   "#22c55e",
  High:      "#ef4444",
  Medium:    "#f59e0b",
  Low:       "#22c55e",
  Pending:   "#f59e0b",
  Completed: "#22c55e",
};

const tooltipStyle = {
  background:   "var(--surface-2)",
  border:       "1px solid var(--border)",
  borderRadius: "8px",
  color:        "var(--text)",
  fontSize:     "12px",
};

export default function Statistics() {
  const [incomes, setIncomes]   = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    Promise.all([listIncomes(), listExpenses()])
      .then(([inc, exp]) => {
        const sorted = [...inc].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).reverse();
        setIncomes(sorted);
        setExpenses(exp);
      })
      .catch(() => setError("Failed to load data."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={s.page}><p style={s.muted}>Loading…</p></div>;
  if (error)   return <div style={s.page}><div style={s.errorBox}>{error}</div></div>;

  // ── Derived data ─────────────────────────────────────────────────────────

  const expByIncome = expenses.reduce((acc, e) => {
    const key = e.mappedIncomeId ?? "__unmapped__";
    acc[key] = acc[key] ?? [];
    acc[key].push(e);
    return acc;
  }, {});

  const periodData = incomes.map(inc => {
    const exps     = expByIncome[inc.incomeId] ?? [];
    const totalExp = exps.reduce((s, e) => s + (e.amount ?? 0), 0);
    return { label: inc.date.slice(0, 7), income: inc.amount ?? 0, expenses: totalExp, balance: (inc.amount ?? 0) - totalExp };
  });

  const totalIncome   = incomes.reduce((s, i) => s + (i.amount ?? 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount ?? 0), 0);
  const netBalance    = totalIncome - totalExpenses;
  const savingsRate   = totalIncome > 0 ? ((netBalance / totalIncome) * 100).toFixed(1) : "—";

  const priorityData = Object.entries(
    expenses.reduce((acc, e) => { const p = e.priority ?? "Unknown"; acc[p] = (acc[p] ?? 0) + (e.amount ?? 0); return acc; }, {})
  ).map(([name, value]) => ({ name, value }));

  const statusData = Object.entries(
    expenses.reduce((acc, e) => { const st = e.status ?? "Unknown"; acc[st] = (acc[st] ?? 0) + (e.amount ?? 0); return acc; }, {})
  ).map(([name, value]) => ({ name, value }));

  const fmt  = (n) => n.toLocaleString("ro-RO", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const top5 = [...expenses].sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0)).slice(0, 5);

  return (
    <div style={s.page}>

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div style={s.statGrid}>
        <StatCard label="Total Income"   value={`RON ${fmt(totalIncome)}`}   color={COLORS.income} />
        <StatCard label="Total Expenses" value={`RON ${fmt(totalExpenses)}`} color={COLORS.expenses} />
        <StatCard label="Net Balance"    value={`RON ${fmt(netBalance)}`}    color={netBalance >= 0 ? COLORS.balance : COLORS.expenses} />
        <StatCard label="Savings Rate"   value={savingsRate === "—" ? "—" : `${savingsRate}%`} color={COLORS.balance} />
      </div>

      {/* ── Main grid ───────────────────────────────────────────────────────── */}
      <div style={s.mainGrid}>

        {/* Left column — bar + line */}
        <div style={s.col}>
          <Panel title="Income vs Expenses">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={periodData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => `RON ${fmt(v)}`} />
                <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-muted)" }} />
                <Bar dataKey="income"   name="Income"   fill={COLORS.income}   radius={[3,3,0,0]} />
                <Bar dataKey="expenses" name="Expenses" fill={COLORS.expenses} radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Balance Trend">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={periodData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => `RON ${fmt(v)}`} />
                <Line type="monotone" dataKey="balance" name="Balance"
                  stroke={COLORS.balance} strokeWidth={2}
                  dot={{ r: 3, fill: COLORS.balance }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>
        </div>

        {/* Right column — pies + table */}
        <div style={s.col}>
          <div style={s.pieRow}>
            <Panel title="By Priority">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={priorityData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    outerRadius="55%" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                    labelLine={{ stroke: "var(--text-muted)" }}>
                    {priorityData.map(e => <Cell key={e.name} fill={COLORS[e.name] ?? "#6b7194"} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => `RON ${fmt(v)}`} />
                </PieChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="By Status">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    outerRadius="55%" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                    labelLine={{ stroke: "var(--text-muted)" }}>
                    {statusData.map(e => <Cell key={e.name} fill={COLORS[e.name] ?? "#6b7194"} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => `RON ${fmt(v)}`} />
                </PieChart>
              </ResponsiveContainer>
            </Panel>
          </div>

          <Panel title="Top 5 Expenses">
            <table style={s.table}>
              <thead>
                <tr>{["Summary","Date","Amount","Priority","Status"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {top5.map(e => (
                  <tr key={e.expenseId} style={s.tr}>
                    <td style={s.td}>{e.summary}</td>
                    <td style={s.td}>{e.date}</td>
                    <td style={{ ...s.td, fontVariantNumeric: "tabular-nums" }}>RON {fmt(e.amount ?? 0)}</td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, background: COLORS[e.priority] + "22", color: COLORS[e.priority], border: `1px solid ${COLORS[e.priority]}44` }}>
                        {e.priority}
                      </span>
                    </td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, ...(e.status === "Completed" ? s.badgeDone : s.badgePending) }}>
                        {e.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={s.statCard}>
      <div style={{ ...s.statValue, color }}>{value}</div>
      <div style={s.statLabel}>{label}</div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div style={s.panel}>
      <div style={s.panelTitle}>{title}</div>
      <div style={s.panelBody}>{children}</div>
    </div>
  );
}

const s = {
  page: {
    display:       "flex",
    flexDirection: "column",
    flex:          1,
    minHeight:     0,
    gap:           "12px",
  },
  statGrid: {
    display:             "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap:                 "12px",
    flexShrink:          0,
  },
  statCard: {
    background:   "var(--surface)",
    border:       "1px solid var(--border)",
    borderRadius: "10px",
    padding:      "12px 16px",
  },
  statValue: { fontSize: "18px", fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  statLabel: { fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" },
  mainGrid: {
    display:   "flex",
    gap:       "12px",
    flex:      1,
    minHeight: 0,
  },
  col: {
    display:       "flex",
    flexDirection: "column",
    flex:          1,
    gap:           "12px",
    minWidth:      0,
    minHeight:     0,
  },
  pieRow: {
    display:   "flex",
    gap:       "12px",
    flex:      1,
    minHeight: 0,
  },
  panel: {
    display:       "flex",
    flexDirection: "column",
    flex:          1,
    minHeight:     0,
    background:    "var(--surface)",
    border:        "1px solid var(--border)",
    borderRadius:  "10px",
    padding:       "12px 16px",
    overflow:      "hidden",
  },
  panelTitle: {
    fontSize:     "12px",
    fontWeight:   600,
    color:        "var(--text-muted)",
    marginBottom: "8px",
    flexShrink:   0,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  panelBody: {
    flex:      1,
    minHeight: 0,
    display:   "flex",
    flexDirection: "column",
  },
  muted:    { color: "var(--text-muted)", fontSize: "13px" },
  errorBox: {
    background: "#3b1212", border: "1px solid var(--danger)",
    borderRadius: "8px", color: "#fca5a5", padding: "12px 16px", fontSize: "13px",
  },
  table:       { width: "100%", borderCollapse: "collapse" },
  th:          { textAlign: "left", fontSize: "11px", color: "var(--text-muted)", padding: "4px 8px", borderBottom: "1px solid var(--border)", fontWeight: 500 },
  tr:          { borderBottom: "1px solid var(--border)" },
  td:          { padding: "7px 8px", fontSize: "12px", color: "var(--text)" },
  badge:       { padding: "2px 6px", borderRadius: "10px", fontSize: "10px", fontWeight: 600 },
  badgeDone:   { background: "#052e16", color: "#86efac", border: "1px solid #22c55e44" },
  badgePending:{ background: "#1c1400", color: "#fcd34d", border: "1px solid #f59e0b44" },
};
