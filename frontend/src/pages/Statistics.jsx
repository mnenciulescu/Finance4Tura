import { useState, useEffect, useMemo } from "react";
import useIsMobile from "../hooks/useIsMobile";
import {
  LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
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
  background: "var(--surface-2)", border: "1px solid var(--border)",
  borderRadius: "8px", color: "var(--text)", fontSize: "12px",
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
  const currentMonth = today.getFullYear() === selectedYear ? today.getMonth() : -1;

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

  const monthsWithData = monthlyData.filter(m => m.hasData);
  const n = monthsWithData.length || 1;
  const avg = {
    high:   monthsWithData.reduce((s, m) => s + (m.high   ?? 0), 0) / n,
    medium: monthsWithData.reduce((s, m) => s + (m.medium ?? 0), 0) / n,
    low:    monthsWithData.reduce((s, m) => s + (m.low    ?? 0), 0) / n,
    free:   monthsWithData.reduce((s, m) => s + (m.free   ?? 0), 0) / n,
  };

  const specialExpenses = useMemo(() =>
    expenses.filter(e => e.special).sort((a, b) => a.date.localeCompare(b.date)),
    [expenses]
  );
  const specialTotal = specialExpenses.reduce((s, e) => s + (e.amount ?? 0), 0);
  const isMobile = useIsMobile();

  const currentMonthLabel = currentMonth >= 0 ? MONTH_LABELS[currentMonth] : null;

  const formatDay = (dateStr) => {
    const [, m, d] = dateStr.split("-");
    return `${MONTH_LABELS[parseInt(m, 10) - 1]} ${d}`;
  };

  if (loading) return <div style={s.page}><p style={s.muted}>Loading…</p></div>;
  if (error)   return <div style={s.page}><div style={s.errorBox}>{error}</div></div>;

  return (
    <div style={s.page}>

      {/* ── Top: averages ───────────────────────────────────── */}
      <div style={s.topRow}>

        {/* Combined High / Medium / Low */}
        <div style={s.avgCard}>
          <div style={s.avgCardTitle}>Monthly Averages</div>
          {[
            { label: "High",   color: C.High,   val: avg.high   },
            { label: "Medium", color: C.Medium, val: avg.medium },
            { label: "Low",    color: C.Low,    val: avg.low    },
          ].map(({ label, color, val }) => (
            <div key={label} style={s.avgRow}>
              <span style={{ ...s.avgDot, background: color }} />
              <span style={s.avgRowLabel}>{label}</span>
              <span style={{ ...s.avgRowValue, color }}>RON {fmt1(val)}</span>
            </div>
          ))}
          <div style={s.avgSub}>{monthsWithData.length} month{monthsWithData.length !== 1 ? "s" : ""} with data</div>
        </div>

        {/* Free average */}
        <div style={{ ...s.avgCard, ...s.avgCardFree }}>
          <div style={s.avgCardTitle}>Avg Free / Month</div>
          <div style={{ ...s.avgFreeValue, color: avg.free >= 0 ? C.Free : C.High }}>
            RON {fmt1(avg.free)}
          </div>
          <div style={s.avgSub}>{monthsWithData.length} month{monthsWithData.length !== 1 ? "s" : ""} with data</div>
        </div>

        {/* Survival / Month */}
        <div style={{ ...s.avgCard, ...s.avgCardFree }}>
          <div style={s.avgCardTitle}>Survival / Month</div>
          <div style={{ ...s.avgFreeValue, color: "#a855f7" }}>
            RON {fmt1(avg.high + avg.medium * 0.8 + 7000)}
          </div>
          <div style={s.avgSub}>High + 80% Medium + RON 7,000</div>
        </div>

      </div>

      {/* ── Bottom: chart + special expenses ────────────────── */}
      <div style={s.bottomRow}>

        {/* Charts column */}
        <div style={s.chartsCol}>

          {/* Top: priority lines */}
          <div style={s.chartPanel}>
            <div style={s.chartTitle}>
              {selectedYear} — Expenses by Priority
              {currentMonthLabel && <span style={s.currentBadge}>▶ {currentMonthLabel}</span>}
            </div>
            <div style={s.chartBody}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData} margin={{ top: 12, right: 20, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                  <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickFormatter={v => fmt(v)} width={70} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => v == null ? ["—", name] : [`RON ${fmt(v)}`, name]} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: "8px" }} />
                  {currentMonthLabel && (
                    <ReferenceLine x={currentMonthLabel} stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="4 3"
                      label={{ value: "now", position: "top", fontSize: 10, fill: "var(--accent)" }} />
                  )}
                  <Line type="monotone" dataKey="high"   name="High"   stroke={C.High}   strokeWidth={2.5} dot={{ r: 4, fill: C.High }}   activeDot={{ r: 6 }} connectNulls={false} />
                  <Line type="monotone" dataKey="medium" name="Medium" stroke={C.Medium} strokeWidth={2.5} dot={{ r: 4, fill: C.Medium }} activeDot={{ r: 6 }} connectNulls={false} />
                  <Line type="monotone" dataKey="low"    name="Low"    stroke={C.Low}    strokeWidth={2.5} dot={{ r: 4, fill: C.Low }}    activeDot={{ r: 6 }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom: free amount bars */}
          <div style={s.chartPanel}>
            <div style={s.chartTitle}>
              {selectedYear} — Free Amount per Month
              {currentMonthLabel && <span style={s.currentBadge}>▶ {currentMonthLabel}</span>}
            </div>
            <div style={s.chartBody}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 12, right: 20, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                  <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickFormatter={v => fmt(v)} width={70} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => v == null ? ["—", name] : [`RON ${fmt(v)}`, name]} />
                  {currentMonthLabel && (
                    <ReferenceLine x={currentMonthLabel} stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="4 3"
                      label={{ value: "now", position: "top", fontSize: 10, fill: "var(--accent)" }} />
                  )}
                  <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5} />
                  <Bar dataKey="free" name="Free" radius={[3, 3, 0, 0]}>
                    {monthlyData.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={entry.free == null ? "transparent" : entry.free >= 0 ? C.Free : C.High}
                        fillOpacity={idx === currentMonth ? 1 : 0.7}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* Special expenses — desktop only */}
        {!isMobile && (
          <div style={s.specialPanel}>
            <div style={s.specialTitle}>★ Special Expenses</div>
            {specialExpenses.length === 0 ? (
              <p style={s.muted}>No special expenses this year.</p>
            ) : (
              <>
                <div style={s.specialList}>
                  {specialExpenses.map(e => (
                    <div key={e.expenseId} style={s.specialRow}>
                      <div style={s.specialDate}>{formatDay(e.date)}</div>
                      <div style={s.specialSummary}>{e.summary}</div>
                      <div style={s.specialAmount}>RON {fmt(e.amount)}</div>
                    </div>
                  ))}
                </div>
                <div style={s.specialFooter}>
                  <span style={s.specialTotalLabel}>Total</span>
                  <span style={s.specialTotalValue}>RON {fmt(specialTotal)}</span>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

const s = {
  page: {
    display: "flex", flexDirection: "column", flex: 1,
    minHeight: 0, gap: "12px", overflowY: "auto",
  },
  muted: { color: "var(--text-muted)", fontSize: "13px" },
  errorBox: {
    background: "var(--error-bg)", border: "1px solid var(--danger)",
    borderRadius: "8px", color: "var(--error-text)", padding: "12px 16px", fontSize: "13px",
  },

  /* Top row */
  topRow: { display: "flex", gap: "12px", flexShrink: 0 },
  avgCard: {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "10px", padding: "14px 20px", display: "flex",
    flexDirection: "column", gap: "8px", minWidth: "220px",
  },
  avgCardFree: { minWidth: "210px" },
  avgCardTitle: { fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" },
  avgRow: { display: "flex", alignItems: "center", gap: "8px" },
  avgDot: { width: "10px", height: "10px", borderRadius: "50%", flexShrink: 0 },
  avgRowLabel: { fontSize: "13px", color: "var(--text-muted)", flex: 1 },
  avgRowValue: { fontSize: "14px", fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  avgFreeValue: { fontSize: "22px", fontWeight: 700, fontVariantNumeric: "tabular-nums", marginTop: "4px" },
  avgSub: { fontSize: "10px", color: "var(--text-muted)", opacity: 0.7 },

  /* Bottom row */
  bottomRow: { display: "flex", gap: "12px", flex: 1, minHeight: 0 },
  chartsCol: { display: "flex", flexDirection: "column", flex: 1, gap: "12px", minHeight: 0 },
  chartPanel: {
    display: "flex", flexDirection: "column", flex: 1, minHeight: "200px",
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "10px", padding: "14px 16px",
  },
  chartTitle: {
    fontSize: "11px", fontWeight: 600, color: "var(--text-muted)",
    marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.04em",
    display: "flex", alignItems: "center", gap: "10px", flexShrink: 0,
  },
  currentBadge: {
    fontSize: "11px", fontWeight: 600, color: "var(--accent)",
    background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.3)",
    borderRadius: "6px", padding: "2px 8px", textTransform: "none", letterSpacing: "0",
  },
  chartBody: { flex: 1, minHeight: 0 },

  /* Special expenses */
  specialPanel: {
    width: "240px", flexShrink: 0, background: "var(--surface)",
    border: "1px solid var(--border)", borderRadius: "10px",
    padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px",
    minHeight: 0,
  },
  specialTitle: {
    fontSize: "11px", fontWeight: 600, color: "var(--text-muted)",
    textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0,
  },
  specialList: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" },
  specialRow: {
    display: "flex", flexDirection: "column", gap: "1px",
    paddingBottom: "8px", borderBottom: "1px solid var(--border)",
  },
  specialDate:    { fontSize: "10px", color: "var(--text-muted)", fontWeight: 600 },
  specialSummary: { fontSize: "12px", color: "var(--text)" },
  specialAmount:  { fontSize: "12px", fontWeight: 700, color: "#a855f7", fontVariantNumeric: "tabular-nums" },
  specialFooter: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    paddingTop: "8px", borderTop: "2px solid var(--border)", flexShrink: 0,
  },
  specialTotalLabel: { fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" },
  specialTotalValue: { fontSize: "14px", fontWeight: 700, color: "#a855f7", fontVariantNumeric: "tabular-nums" },
};
