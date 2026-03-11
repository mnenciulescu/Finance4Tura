import { useState, useEffect, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { listIncomes } from "../api/incomes";
import { listExpenses } from "../api/expenses";
import { useYear } from "../context/YearContext";

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const C = {
  High:   "#ef4444",
  Medium: "#f59e0b",
  Low:    "#22c55e",
  Free:   "#6c63ff",
};

const fmt  = (n) => (n ?? 0).toLocaleString("ro-RO", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmt1 = (n) => (n ?? 0).toLocaleString("ro-RO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const tooltipStyle = {
  background:   "var(--surface-2)",
  border:       "1px solid var(--border)",
  borderRadius: "8px",
  color:        "var(--text)",
  fontSize:     "12px",
};

export default function Statistics() {
  const { selectedYear } = useYear();
  const [incomes, setIncomes]   = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      listIncomes({ from: `${selectedYear}-01-01`, to: `${selectedYear}-12-31` }),
      listExpenses({ from: `${selectedYear}-01-01`, to: `${selectedYear}-12-31` }),
    ])
      .then(([inc, exp]) => { setIncomes(inc); setExpenses(exp); })
      .catch(() => setError("Failed to load data."))
      .finally(() => setLoading(false));
  }, [selectedYear]);

  const today        = new Date();
  const currentMonth = today.getFullYear() === selectedYear ? today.getMonth() : -1; // 0-indexed

  // Build monthly data points
  const monthlyData = useMemo(() => {
    return MONTH_LABELS.map((label, idx) => {
      const monthStr = `${selectedYear}-${String(idx + 1).padStart(2, "0")}`;
      const isFuture = selectedYear > today.getFullYear() ||
                       (selectedYear === today.getFullYear() && idx > today.getMonth());

      const mInc = incomes.filter(i => i.date.startsWith(monthStr));
      const mExp = expenses.filter(e => e.date.startsWith(monthStr));

      const totalIncome = mInc.reduce((s, i) => s + (i.amount ?? 0), 0);
      const high   = mExp.filter(e => e.priority === "High").reduce((s, e) => s + (e.amount ?? 0), 0);
      const medium = mExp.filter(e => e.priority === "Medium").reduce((s, e) => s + (e.amount ?? 0), 0);
      const low    = mExp.filter(e => e.priority === "Low").reduce((s, e) => s + (e.amount ?? 0), 0);
      const free   = totalIncome - high - medium - low;
      const hasData = mInc.length > 0 || mExp.length > 0;

      return {
        label,
        high:   isFuture && !hasData ? null : high,
        medium: isFuture && !hasData ? null : medium,
        low:    isFuture && !hasData ? null : low,
        free:   isFuture && !hasData ? null : free,
        hasData,
      };
    });
  }, [incomes, expenses, selectedYear]); // eslint-disable-line react-hooks/exhaustive-deps

  // Averages over months that have data
  const monthsWithData = monthlyData.filter(m => m.hasData);
  const n = monthsWithData.length || 1;
  const avg = {
    high:   monthsWithData.reduce((s, m) => s + (m.high   ?? 0), 0) / n,
    medium: monthsWithData.reduce((s, m) => s + (m.medium ?? 0), 0) / n,
    low:    monthsWithData.reduce((s, m) => s + (m.low    ?? 0), 0) / n,
    free:   monthsWithData.reduce((s, m) => s + (m.free   ?? 0), 0) / n,
  };

  const currentMonthLabel = currentMonth >= 0 ? MONTH_LABELS[currentMonth] : null;

  if (loading) return <div style={s.page}><p style={s.muted}>Loading…</p></div>;
  if (error)   return <div style={s.page}><div style={s.errorBox}>{error}</div></div>;

  return (
    <div style={s.page}>

      {/* ── Average cards ───────────────────────────────────── */}
      <div style={s.avgGrid}>
        {[
          { key: "high",   label: "Avg High / month",   color: C.High   },
          { key: "medium", label: "Avg Medium / month", color: C.Medium },
          { key: "low",    label: "Avg Low / month",    color: C.Low    },
          { key: "free",   label: "Avg Free / month",   color: C.Free   },
        ].map(({ key, label, color }) => (
          <div key={key} style={s.avgCard}>
            <div style={{ ...s.avgValue, color }}>RON {fmt1(avg[key])}</div>
            <div style={s.avgLabel}>{label}</div>
            <div style={s.avgSub}>over {monthsWithData.length} month{monthsWithData.length !== 1 ? "s" : ""} with data</div>
          </div>
        ))}
      </div>

      {/* ── Line chart ──────────────────────────────────────── */}
      <div style={s.chartPanel}>
        <div style={s.chartTitle}>
          {selectedYear} — Expenses by Priority &amp; Free Amount
          {currentMonthLabel && (
            <span style={s.currentBadge}>▶ {currentMonthLabel} (current)</span>
          )}
        </div>
        <div style={s.chartBody}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyData} margin={{ top: 12, right: 28, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              />
              <YAxis
                tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                tickFormatter={v => `${fmt(v)}`}
                width={70}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v, name) => v == null ? ["—", name] : [`RON ${fmt(v)}`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: "8px" }} />

              {/* Current month highlight */}
              {currentMonthLabel && (
                <ReferenceLine
                  x={currentMonthLabel}
                  stroke="var(--accent)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  label={{ value: "now", position: "top", fontSize: 10, fill: "var(--accent)" }}
                />
              )}

              <Line type="monotone" dataKey="high"   name="High"   stroke={C.High}   strokeWidth={2.5} dot={{ r: 4, fill: C.High }}   activeDot={{ r: 6 }} connectNulls={false} />
              <Line type="monotone" dataKey="medium" name="Medium" stroke={C.Medium} strokeWidth={2.5} dot={{ r: 4, fill: C.Medium }} activeDot={{ r: 6 }} connectNulls={false} />
              <Line type="monotone" dataKey="low"    name="Low"    stroke={C.Low}    strokeWidth={2.5} dot={{ r: 4, fill: C.Low }}    activeDot={{ r: 6 }} connectNulls={false} />
              <Line type="monotone" dataKey="free"   name="Free"   stroke={C.Free}   strokeWidth={2.5} dot={{ r: 4, fill: C.Free }}   activeDot={{ r: 6 }} connectNulls={false} strokeDasharray="7 3" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}

const s = {
  page: {
    display:       "flex",
    flexDirection: "column",
    flex:          1,
    minHeight:     0,
    gap:           "16px",
    overflowY:     "auto",
    padding:       "4px 0",
  },
  muted:    { color: "var(--text-muted)", fontSize: "13px" },
  errorBox: {
    background: "var(--error-bg)", border: "1px solid var(--danger)",
    borderRadius: "8px", color: "var(--error-text)", padding: "12px 16px", fontSize: "13px",
  },
  avgGrid: {
    display:             "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap:                 "12px",
    flexShrink:          0,
  },
  avgCard: {
    background:   "var(--surface)",
    border:       "1px solid var(--border)",
    borderRadius: "10px",
    padding:      "14px 16px",
  },
  avgValue: { fontSize: "20px", fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  avgLabel: { fontSize: "12px", color: "var(--text-muted)", marginTop: "4px", fontWeight: 500 },
  avgSub:   { fontSize: "10px", color: "var(--text-muted)", marginTop: "2px", opacity: 0.7 },
  chartPanel: {
    display:       "flex",
    flexDirection: "column",
    flex:          1,
    minHeight:     "340px",
    background:    "var(--surface)",
    border:        "1px solid var(--border)",
    borderRadius:  "10px",
    padding:       "14px 16px",
  },
  chartTitle: {
    fontSize:     "12px",
    fontWeight:   600,
    color:        "var(--text-muted)",
    marginBottom: "8px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    display:      "flex",
    alignItems:   "center",
    gap:          "10px",
    flexShrink:   0,
  },
  currentBadge: {
    fontSize:     "11px",
    fontWeight:   600,
    color:        "var(--accent)",
    background:   "rgba(22,163,74,0.1)",
    border:       "1px solid rgba(22,163,74,0.3)",
    borderRadius: "6px",
    padding:      "2px 8px",
    textTransform: "none",
    letterSpacing: "0",
  },
  chartBody: {
    flex:      1,
    minHeight: 0,
  },
};
