import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { listIncomes } from "../api/incomes";
import { listExpenses } from "../api/expenses";
import { useYear } from "../context/YearContext";
import { CHART_COLORS as C } from "../utils/colors";

// The whole page is a single phone-width column, rendered the same way on
// desktop and on mobile — same widths, paddings and font sizes everywhere.
const COL_WIDTH = "430px";

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const SPECIAL_COLOR = "#a855f7";

// Living-cost baseline used by the Survival / Month figure
const SURVIVAL_BASELINE = 7000;

const fmt  = (n) => (n ?? 0).toLocaleString("ro-RO", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmt1 = (n) => (n ?? 0).toLocaleString("ro-RO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Compact axis labels: 12.500 → "12,5k" */
const fmtAxis = (v) => {
  if (v === 0) return "0";
  const abs = Math.abs(v);
  if (abs >= 1000) return `${(v / 1000).toLocaleString("ro-RO", { maximumFractionDigits: 1 })}k`;
  return fmt(v);
};

export default function Statistics() {
  const { selectedYear, setSelectedYear } = useYear();
  const [incomes, setIncomes]   = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  // Special Expenses is a collapsed-by-default expandable block
  const [showSpecial, setShowSpecial] = useState(false);

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
  const thisYear     = today.getFullYear();
  const currentMonth = thisYear === selectedYear ? today.getMonth() : -1;

  const monthlyData = useMemo(() => {
    return MONTH_LABELS.map((label, idx) => {
      const monthStr = `${selectedYear}-${String(idx + 1).padStart(2, "0")}`;
      const isFuture = selectedYear > thisYear ||
                       (selectedYear === thisYear && idx > today.getMonth());
      const mInc = incomes.filter(i => i.date.startsWith(monthStr));
      const mExp = expenses.filter(e => e.date.startsWith(monthStr));
      const totalIncome = mInc.reduce((s, i) => s + (i.amount ?? 0), 0);
      const high   = mExp.filter(e => e.priority === "High").reduce((s, e) => s + (e.amount ?? 0), 0);
      const medium = mExp.filter(e => e.priority === "Medium").reduce((s, e) => s + (e.amount ?? 0), 0);
      const low    = mExp.filter(e => e.priority === "Low").reduce((s, e) => s + (e.amount ?? 0), 0);
      const free   = totalIncome - high - medium - low;
      const hasData = mInc.length > 0 || mExp.length > 0;
      const blank = isFuture && !hasData;
      return {
        label,
        income: blank ? null : totalIncome,
        high:   blank ? null : high,
        medium: blank ? null : medium,
        low:    blank ? null : low,
        free:   blank ? null : free,
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
  const survival = avg.high + avg.medium * 0.8 + SURVIVAL_BASELINE;

  const specialExpenses = useMemo(() =>
    expenses.filter(e => e.special).sort((a, b) => a.date.localeCompare(b.date)),
    [expenses]
  );
  const specialTotal = specialExpenses.reduce((s, e) => s + (e.amount ?? 0), 0);

  const currentMonthLabel = currentMonth >= 0 ? MONTH_LABELS[currentMonth] : null;

  const formatDay = (dateStr) => {
    const [, m, d] = dateStr.split("-");
    return `${MONTH_LABELS[parseInt(m, 10) - 1]} ${d}`;
  };

  const stepYear = (delta) => setSelectedYear(y => y + delta);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>
      <div style={s.column}>

        <div style={s.header}>
          <div style={{ minWidth: 0 }}>
            <h2 style={s.title}>Statistics</h2>
            <p style={s.subtitle}>
              {monthsWithData.length} month{monthsWithData.length === 1 ? "" : "s"} with data
              {currentMonthLabel && <> · now {currentMonthLabel}</>}
            </p>
          </div>
          {/* Mobile has no global year picker, so the page carries its own.
              It writes to the same context the desktop Sidebar selector uses. */}
          <div style={s.yearNav}>
            <button style={s.yearBtn} onClick={() => stepYear(-1)} title="Previous year">‹</button>
            <span style={s.yearValue}>{selectedYear}</span>
            <button
              style={{ ...s.yearBtn, ...(selectedYear >= thisYear ? s.yearBtnOff : {}) }}
              onClick={() => selectedYear < thisYear && stepYear(1)}
              disabled={selectedYear >= thisYear}
              title="Next year"
            >›</button>
          </div>
        </div>

        <div style={s.scroll}>
          {loading ? (
            <div style={s.empty}>Loading…</div>
          ) : error ? (
            <div style={s.errorBox}>{error}</div>
          ) : (
            <>
              {/* ── Block 1 · Monthly averages ────────────────────────────── */}
              <section style={s.block}>
                <div style={s.blockHead}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.blockTitle}>Monthly averages</div>
                    <div style={s.blockSub}>
                      Across {monthsWithData.length} month{monthsWithData.length === 1 ? "" : "s"} with data
                    </div>
                  </div>
                </div>

                <div style={s.blockBody}>
                  <div style={s.statRow}>
                    <div style={s.stat}>
                      <div style={s.statLabel}>Avg free / month</div>
                      <div style={{ ...s.statValue, color: avg.free >= 0 ? C.Free : C.High }}>
                        {fmt1(avg.free)}
                      </div>
                      <div style={s.statUnit}>RON</div>
                    </div>
                    <div style={s.stat}>
                      <div style={s.statLabel}>Survival / month</div>
                      <div style={{ ...s.statValue, color: SPECIAL_COLOR }}>
                        {fmt1(survival)}
                      </div>
                      <div style={s.statUnit}>High + 80% Medium + {fmt(SURVIVAL_BASELINE)}</div>
                    </div>
                  </div>

                  <div style={s.divider} />

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
                </div>
              </section>

              {/* ── Block 2 · Free amount per month ───────────────────────── */}
              <section style={s.block}>
                <div style={s.blockHead}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.blockTitle}>Free amount per month</div>
                    <div style={s.blockSub}>{selectedYear} · tap a bar for the full breakdown</div>
                  </div>
                </div>

                <div style={s.blockBody}>
                  {monthsWithData.length === 0 ? (
                    <div style={s.emptyLine}>No data for {selectedYear}.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={monthlyData} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                          tickLine={false}
                          interval={0}
                        />
                        <YAxis
                          tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                          tickFormatter={fmtAxis}
                          tickLine={false}
                          axisLine={false}
                          width={44}
                        />
                        <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<MonthTooltip />} />
                        {currentMonthLabel && (
                          <ReferenceLine
                            x={currentMonthLabel}
                            stroke="var(--accent)"
                            strokeWidth={1.5}
                            strokeDasharray="4 3"
                            label={{ value: "now", position: "top", fontSize: 9, fill: "var(--accent)" }}
                          />
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
                  )}
                </div>
              </section>

              {/* ── Block 3 · Special expenses (expandable) ───────────────── */}
              <section style={s.block}>
                <div
                  style={s.specialHead}
                  onClick={() => setShowSpecial(v => !v)}
                  role="button"
                  tabIndex={0}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.blockTitle}>★ Special expenses</div>
                    <div style={s.blockSub}>
                      {specialExpenses.length === 0
                        ? `None in ${selectedYear}`
                        : <>
                            {specialExpenses.length} in {selectedYear}
                            <span style={s.dot}>·</span>
                            <span style={s.specialTotalInline}>RON {fmt(specialTotal)}</span>
                          </>}
                    </div>
                  </div>
                  <Chevron open={showSpecial} />
                </div>

                {showSpecial && (
                  <div style={s.blockBody}>
                    {specialExpenses.length === 0 ? (
                      <div style={s.emptyLine}>No special expenses this year.</div>
                    ) : (
                      <>
                        {specialExpenses.map(e => (
                          <div key={e.expenseId} style={s.specialRow}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={s.specialSummary}>{e.summary}</div>
                              <div style={s.specialDate}>{formatDay(e.date)}</div>
                            </div>
                            <div style={s.specialAmount}>RON {fmt(e.amount)}</div>
                          </div>
                        ))}
                        <div style={s.specialFooter}>
                          <span style={s.specialTotalLabel}>Total</span>
                          <span style={s.specialTotalValue}>RON {fmt(specialTotal)}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

/**
 * Full month breakdown on tap. This is where the priority split lives now that
 * the separate "Expenses by Priority" chart is gone.
 */
function MonthTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { label, income, high, medium, low, free } = payload[0].payload;
  if (free == null) return null;

  const row = (name, value, color, bold) => (
    <div style={{ ...s.tooltipRow, color: color ?? "var(--text-muted)", fontWeight: bold ? 700 : 400 }}>
      <span>{name}</span>
      <span style={s.tooltipVal}>RON {fmt(value)}</span>
    </div>
  );

  return (
    <div style={s.tooltip}>
      <div style={s.tooltipDate}>{label}</div>
      {row("Income", income, "var(--text)", true)}
      <div style={s.tooltipDivider} />
      {row("High", high, C.High)}
      {row("Medium", medium, C.Medium)}
      {row("Low", low, C.Low)}
      <div style={s.tooltipDivider} />
      {row("Free", free, free >= 0 ? C.Free : C.High, true)}
    </div>
  );
}

function Chevron({ open }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
         style={{ color: "var(--text-muted)", flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.18s" }}>
      <polyline points="4,6 8,10 12,6" />
    </svg>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  // Centered phone-width column — identical on desktop and mobile
  page: {
    display:       "flex",
    flexDirection: "column",
    alignItems:    "center",
    flex:          1,
    minHeight:     0,
  },
  column: {
    display:       "flex",
    flexDirection: "column",
    width:         "100%",
    maxWidth:      COL_WIDTH,
    flex:          1,
    minHeight:     0,
  },

  header: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    gap:            "12px",
    flexShrink:     0,
    padding:        "12px 14px",
    borderBottom:   "1px solid var(--border)",
  },
  title: {
    margin:     0,
    fontSize:   "17px",
    fontWeight: 700,
    color:      "var(--text)",
  },
  subtitle: {
    margin:   "3px 0 0",
    fontSize: "12px",
    color:    "var(--text-muted)",
  },

  yearNav: {
    display:      "flex",
    alignItems:   "center",
    gap:          "2px",
    flexShrink:   0,
    background:   "var(--surface-2)",
    border:       "1px solid var(--border)",
    borderRadius: "9px",
    padding:      "3px",
  },
  yearBtn: {
    width:          "30px",
    height:         "30px",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    background:     "transparent",
    border:         "none",
    borderRadius:   "7px",
    color:          "var(--text)",
    fontSize:       "17px",
    lineHeight:     1,
    cursor:         "pointer",
  },
  yearBtnOff: {
    color:  "var(--text-muted)",
    opacity: 0.35,
    cursor: "default",
  },
  yearValue: {
    minWidth:   "42px",
    textAlign:  "center",
    fontSize:   "13px",
    fontWeight: 700,
    color:      "var(--text)",
    fontVariantNumeric: "tabular-nums",
  },

  scroll: {
    flex:          1,
    minHeight:     0,
    overflowY:     "auto",
    WebkitOverflowScrolling: "touch",
    display:       "flex",
    flexDirection: "column",
    gap:           "12px",
    padding:       "12px 12px 24px",
  },

  empty: {
    background:   "var(--surface)",
    border:       "1px solid var(--border)",
    borderRadius: "12px",
    padding:      "34px 20px",
    color:        "var(--text-muted)",
    fontSize:     "13px",
    textAlign:    "center",
  },
  emptyLine: {
    color:    "var(--text-muted)",
    fontSize: "13px",
    padding:  "6px 2px",
  },
  errorBox: {
    background:   "var(--error-bg)",
    border:       "1px solid var(--danger)",
    borderRadius: "10px",
    color:        "var(--error-text)",
    padding:      "12px 16px",
    fontSize:     "13px",
  },

  // ── Block shell
  block: {
    background:   "var(--surface)",
    border:       "1px solid var(--border)",
    borderRadius: "14px",
    overflow:     "hidden",
    flexShrink:   0,
  },
  blockHead: {
    display:    "flex",
    alignItems: "center",
    gap:        "10px",
    padding:    "13px 14px",
  },
  specialHead: {
    display:    "flex",
    alignItems: "center",
    gap:        "10px",
    padding:    "13px 14px",
    cursor:     "pointer",
    userSelect: "none",
  },
  blockTitle: {
    fontSize:   "14px",
    fontWeight: 700,
    color:      "var(--text)",
  },
  blockSub: {
    marginTop: "3px",
    fontSize:  "12px",
    color:     "var(--text-muted)",
  },
  blockBody: {
    display:       "flex",
    flexDirection: "column",
    gap:           "9px",
    padding:       "12px 12px 13px",
    borderTop:     "1px solid var(--border)",
  },
  dot: { opacity: 0.5, margin: "0 4px" },

  // ── Block 1 · averages
  statRow: {
    display:             "grid",
    gridTemplateColumns: "1fr 1fr",
    gap:                 "9px",
  },
  stat: {
    display:       "flex",
    flexDirection: "column",
    gap:           "3px",
    background:    "var(--surface-2)",
    border:        "1px solid var(--border)",
    borderRadius:  "10px",
    padding:       "10px 11px",
    minWidth:      0,
  },
  statLabel: {
    fontSize:      "10px",
    fontWeight:    700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color:         "var(--text-muted)",
  },
  statValue: {
    fontSize:   "20px",
    fontWeight: 700,
    lineHeight: 1.15,
    fontVariantNumeric: "tabular-nums",
  },
  statUnit: {
    fontSize: "10px",
    color:    "var(--text-muted)",
    opacity:  0.8,
  },
  divider: {
    borderTop: "1px solid var(--border)",
    margin:    "1px 0",
  },
  avgRow: {
    display:    "flex",
    alignItems: "center",
    gap:        "8px",
  },
  avgDot: {
    width:        "9px",
    height:       "9px",
    borderRadius: "50%",
    flexShrink:   0,
  },
  avgRowLabel: {
    flex:     1,
    minWidth: 0,
    fontSize: "13px",
    color:    "var(--text-muted)",
  },
  avgRowValue: {
    fontSize:   "14px",
    fontWeight: 700,
    flexShrink: 0,
    fontVariantNumeric: "tabular-nums",
  },

  // ── Block 2 · chart tooltip
  tooltip: {
    background:   "var(--surface)",
    border:       "1px solid var(--border)",
    borderRadius: "9px",
    padding:      "9px 12px",
    fontSize:     "12px",
    minWidth:     "175px",
    boxShadow:    "0 4px 18px rgba(0,0,0,0.28)",
  },
  tooltipDate: {
    fontSize:     "11px",
    color:        "var(--text-muted)",
    marginBottom: "5px",
    fontWeight:   600,
  },
  tooltipRow: {
    display:        "flex",
    justifyContent: "space-between",
    gap:            "14px",
    marginBottom:   "2px",
  },
  tooltipVal: {
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
  },
  tooltipDivider: {
    borderTop: "1px solid var(--border)",
    margin:    "6px 0",
  },

  // ── Block 3 · special expenses
  specialTotalInline: {
    fontWeight: 700,
    color:      SPECIAL_COLOR,
    fontVariantNumeric: "tabular-nums",
  },
  specialRow: {
    display:    "flex",
    alignItems: "center",
    gap:        "10px",
    background:   "var(--surface-2)",
    border:       "1px solid var(--border)",
    borderRadius: "10px",
    padding:      "9px 11px",
  },
  specialSummary: {
    fontSize:     "13px",
    fontWeight:   600,
    color:        "var(--text)",
    overflow:     "hidden",
    textOverflow: "ellipsis",
    whiteSpace:   "nowrap",
  },
  specialDate: {
    marginTop: "2px",
    fontSize:  "11px",
    color:     "var(--text-muted)",
  },
  specialAmount: {
    flexShrink: 0,
    fontSize:   "13px",
    fontWeight: 700,
    color:      SPECIAL_COLOR,
    fontVariantNumeric: "tabular-nums",
  },
  specialFooter: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    paddingTop:     "9px",
    marginTop:      "2px",
    borderTop:      "1px solid var(--border)",
  },
  specialTotalLabel: {
    fontSize:      "11px",
    fontWeight:    700,
    color:         "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  specialTotalValue: {
    fontSize:   "15px",
    fontWeight: 700,
    color:      SPECIAL_COLOR,
    fontVariantNumeric: "tabular-nums",
  },
};
