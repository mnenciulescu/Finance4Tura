import { useState, useEffect, useMemo } from "react";
import dayjs from "dayjs";
import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  listOperations, createOperation, updateOperation, deleteOperation,
  listSnapshots, createSnapshot, deleteSnapshot,
} from "../api/investments";
import { getFxRates } from "../api/fxRates";

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORMS = ["eToro", "Binance", "Fidelity", "Tradeville", "ING Funds RON", "ING Funds EUR"];

const PLATFORM_CURRENCY = {
  "eToro":         "USD",
  "Binance":       "USD",
  "Fidelity":      "USD",
  "Tradeville":    "USD",
  "ING Funds RON": "RON",
  "ING Funds EUR": "EUR",
};

const PLATFORM_COLOR = {
  "eToro":         "#22c55e",
  "Binance":       "#f59e0b",
  "Fidelity":      "#3b82f6",
  "Tradeville":    "#a855f7",
  "ING Funds RON": "#ef4444",
  "ING Funds EUR": "#f97316",
};

const TOTAL_KEY   = "Total";
const TOTAL_COLOR = "#94a3b8";

function today() { return dayjs().format("YYYY-MM-DD"); }
function fmtNum(n) { return (n ?? 0).toLocaleString("ro-RO", { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }

function defaultOpForm() {
  return { date: today(), type: "Deposit", platform: "eToro", amount: "", currency: "USD", notes: "" };
}
function defaultSnapForm() {
  return { date: today(), platform: "eToro", amount: "", currency: "USD" };
}

// ── Chart helpers ─────────────────────────────────────────────────────────────

function toEUR(amount, currency, rates) {
  if (!rates || currency === "EUR") return amount;
  const row = rates[currency];
  // New matrix form: rates[FROM][TO], so rates[currency].EUR = value of 1 CUR in EUR
  if (row && typeof row === "object" && row.EUR != null) return amount * row.EUR;
  // Legacy flat form (base EUR): rates.USD = 1 EUR in USD
  if (typeof row === "number") return amount / row;
  return amount;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Investments() {
  const [operations, setOperations] = useState([]);
  const [snapshots,  setSnapshots]  = useState([]);
  const [fxRates,    setFxRates]    = useState(null); // rates from EUR base, e.g. { USD: 1.08, RON: 4.97 }
  const [fxUpdatedAt, setFxUpdatedAt] = useState(null); // ISO date the shared rates were last updated by admin
  const [loading,    setLoading]    = useState(true);
  const [hiddenLines, setHiddenLines] = useState(new Set(PLATFORMS)); // evolution chart: platforms hidden; Total visible


  // Operations modal
  const [showOpModal,  setShowOpModal]  = useState(false);
  const [editingOpId,  setEditingOpId]  = useState(null);
  const [opForm,       setOpForm]       = useState(defaultOpForm);
  const [opErrors,     setOpErrors]     = useState({});

  // Snapshot modal
  const [showSnapModal, setShowSnapModal] = useState(false);
  const [editingSnapId, setEditingSnapId] = useState(null);
  const [snapForm,      setSnapForm]      = useState(defaultSnapForm);
  const [snapErrors,    setSnapErrors]    = useState({});

  useEffect(() => {
    Promise.all([listOperations(), listSnapshots()])
      .then(([ops, snaps]) => { setOperations(ops); setSnapshots(snaps); })
      .catch(console.error)
      .finally(() => setLoading(false));

    // Load the shared FX rates stored in the database (updated by admin only)
    getFxRates()
      .then(({ rates, updatedAt }) => {
        if (rates) setFxRates(rates);
        setFxUpdatedAt(updatedAt ?? null);
      })
      .catch(() => {});
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────────

  // Convert all snapshot amounts to EUR using today's rates
  const snapshotsInEUR = useMemo(() =>
    snapshots.map(s => ({ ...s, amount: toEUR(s.amount, s.currency, fxRates), currency: "EUR" })),
    [snapshots, fxRates]
  );

  const latestByPlatform = useMemo(() => {
    const result = {};
    for (const s of snapshotsInEUR) {
      if (!result[s.platform] || s.date > result[s.platform].date) result[s.platform] = s;
    }
    return result;
  }, [snapshotsInEUR]);

  // Raw (unconverted) latest snapshot per platform — used to show original currency/amount
  const rawLatestByPlatform = useMemo(() => {
    const result = {};
    for (const s of snapshots) {
      if (!result[s.platform] || s.date > result[s.platform].date) result[s.platform] = s;
    }
    return result;
  }, [snapshots]);

  // Portfolio evolution chart: actual portfolio total + per-platform values,
  // carried forward month by month across the full snapshot/operation date range.
  const { data: testingChartData, years: testingChartYears, xMax: testingChartXMax } = useMemo(() => {
    // Month range spans every snapshot and operation
    const allMonths = [
      ...snapshotsInEUR.map(s => s.date.slice(0, 7)),
      ...operations.map(op => op.date.slice(0, 7)),
    ];
    if (allMonths.length === 0) return { data: [], years: [] };

    const startMonth = allMonths.reduce((min, m) => m < min ? m : min);
    const endMonth   = allMonths.reduce((max, m) => m > max ? m : max);

    const months = [];
    let cur = dayjs(startMonth + "-01");
    const end = dayjs(endMonth + "-01");
    while (!cur.isAfter(end)) {
      months.push(cur.format("YYYY-MM"));
      cur = cur.add(1, "month");
    }

    const years = [...new Set(months.map(m => m.slice(0, 4)))].sort();
    const baseYear = parseInt(years[0] ?? String(new Date().getFullYear()));

    function dateToX(dateStr) {
      const [y, m, d] = dateStr.split("-").map(Number);
      const t = new Date(y, m - 1, d);
      const yearStart = new Date(y, 0, 1);
      const yearEnd   = new Date(y + 1, 0, 1);
      return (y - baseYear) + (t - yearStart) / (yearEnd - yearStart);
    }

    // Carry-forward snapshots per platform (for the actual portfolio lines)
    const snapshotsByPlatform = {};
    snapshotsInEUR.forEach(s => {
      if (!snapshotsByPlatform[s.platform]) snapshotsByPlatform[s.platform] = [];
      snapshotsByPlatform[s.platform].push(s);
    });
    Object.values(snapshotsByPlatform).forEach(arr => arr.sort((a, b) => a.date.localeCompare(b.date)));
    function platformAt(platform, monthId) {
      const endOfMonth = monthId + "-31";
      const arr = snapshotsByPlatform[platform] ?? [];
      let latest = null;
      for (const s of arr) { if (s.date <= endOfMonth) latest = s; else break; }
      return latest?.amount > 0 ? parseFloat(latest.amount.toFixed(2)) : null;
    }
    function portfolioAt(monthId) {
      const total = PLATFORMS.reduce((sum, p) => sum + (platformAt(p, monthId) ?? 0), 0);
      return total > 0 ? parseFloat(total.toFixed(2)) : null;
    }

    // Net cash flow per month in EUR (deposits positive, withdrawals negative)
    const opCashByMonth = {};
    operations.forEach(op => {
      const month = op.date.slice(0, 7);
      const eur = toEUR(op.amount, op.currency, fxRates);
      opCashByMonth[month] = (opCashByMonth[month] ?? 0) + (op.type === "Withdrawal" ? -eur : eur);
    });
    const opMonths = new Set(operations.map(op => op.date.slice(0, 7)));

    const data = months.map(monthId => {
      const platformValues = Object.fromEntries(PLATFORMS.map(p => [p, platformAt(p, monthId)]));
      return {
        date: monthId,
        x: dateToX(monthId + "-01"),
        portfolio: portfolioAt(monthId),
        ...platformValues,
        cashFlow: opMonths.has(monthId) ? (opCashByMonth[monthId] ?? 0) : null,
        hasOp: opMonths.has(monthId),
        ops: operations.filter(op => op.date.slice(0, 7) === monthId),
      };
    });

    return { data, years, xMax: data.at(-1)?.x ?? years.length };
  }, [operations, snapshotsInEUR, fxRates]);

  const totalPortfolioEUR = useMemo(() =>
    Object.values(latestByPlatform).reduce((sum, s) => sum + (s?.amount ?? 0), 0),
    [latestByPlatform]
  );

  // Platforms that have at least one snapshot with amount > 0 in the last 12 months
  const activePlatforms = useMemo(() => {
    const cutoff = dayjs().subtract(12, "month").format("YYYY-MM-DD");
    return PLATFORMS.filter(p =>
      snapshots.some(s => s.platform === p && s.date >= cutoff && s.amount > 0)
    );
  }, [snapshots]);

  // ── Op form helpers ───────────────────────────────────────────────────────────

  function opField(key) {
    return {
      value: opForm[key],
      onChange: e => {
        const val = e.target.value;
        setOpForm(f => {
          const next = { ...f, [key]: val };
          if (key === "platform") next.currency = PLATFORM_CURRENCY[val] ?? "USD";
          return next;
        });
      },
    };
  }

  function openAddOp() {
    setEditingOpId(null);
    setOpForm(defaultOpForm());
    setOpErrors({});
    setShowOpModal(true);
  }

  function openEditOp(op) {
    setEditingOpId(op.operationId);
    setOpForm({ date: op.date, type: op.type, platform: op.platform, amount: op.amount, currency: op.currency, notes: op.notes || "" });
    setOpErrors({});
    setShowOpModal(true);
  }

  async function handleOpSave() {
    const errs = {};
    if (!opForm.date)                          errs.date     = "Required";
    if (!opForm.amount || +opForm.amount <= 0) errs.amount   = "Must be > 0";
    setOpErrors(errs);
    if (Object.keys(errs).length) return;

    const body = { ...opForm, amount: parseFloat(opForm.amount) };
    try {
      if (editingOpId) {
        const updated = await updateOperation(editingOpId, body);
        setOperations(prev => prev.map(o => o.operationId === editingOpId ? updated : o));
      } else {
        const created = await createOperation(body);
        setOperations(prev => [created, ...prev]);
      }
      setShowOpModal(false);
    } catch (e) { console.error(e); }
  }

  async function handleOpDelete(id) {
    if (!window.confirm("Delete this operation?")) return;
    try {
      await deleteOperation(id);
      setOperations(prev => prev.filter(o => o.operationId !== id));
    } catch (e) { console.error(e); }
  }

  // ── Snap form helpers ─────────────────────────────────────────────────────────

  function snapField(key) {
    return {
      value: snapForm[key],
      onChange: e => {
        const val = e.target.value;
        setSnapForm(f => {
          const next = { ...f, [key]: val };
          if (key === "platform") next.currency = PLATFORM_CURRENCY[val] ?? "USD";
          return next;
        });
      },
    };
  }

  function openAddSnap() {
    setEditingSnapId(null);
    setSnapForm(defaultSnapForm());
    setSnapErrors({});
    setShowSnapModal(true);
  }

  function openEditSnap(snap) {
    setEditingSnapId(snap.snapshotId);
    setSnapForm({ date: snap.date, platform: snap.platform, amount: snap.amount, currency: snap.currency });
    setSnapErrors({});
    setShowSnapModal(true);
  }

  async function handleSnapSave() {
    const errs = {};
    if (!snapForm.date)                                errs.date   = "Required";
    if (snapForm.amount === "" || snapForm.amount < 0) errs.amount = "Must be ≥ 0";
    setSnapErrors(errs);
    if (Object.keys(errs).length) return;

    const body = { ...snapForm, amount: parseFloat(snapForm.amount) };
    try {
      if (editingSnapId) {
        await deleteSnapshot(editingSnapId);
        const created = await createSnapshot(body);
        setSnapshots(prev => prev.map(s => s.snapshotId === editingSnapId ? created : s));
      } else {
        const created = await createSnapshot(body);
        setSnapshots(prev => [created, ...prev]);
      }
      setShowSnapModal(false);
    } catch (e) { console.error(e); }
  }

  async function handleSnapDelete(id) {
    if (!window.confirm("Delete this snapshot?")) return;
    try {
      await deleteSnapshot(id);
      setSnapshots(prev => prev.filter(s => s.snapshotId !== id));
    } catch (e) { console.error(e); }
  }

  function toggleLine(key) {
    setHiddenLines(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) return <div style={s.page}><p style={s.muted}>Loading…</p></div>;

  return (
    <div style={s.page}>

      {/* ── Top row: Current Holdings (30%) + Portfolio evolution (70%) ─────── */}
      <div style={s.topRow}>
        <div style={s.holdingsCol}>
          <Section title="Current Holdings">
            {/* Total */}
            <div style={s.totalCard}>
              <div style={s.totalLabel}>Total Portfolio</div>
              <div style={s.totalAmount}>{fmtNum(totalPortfolioEUR)}</div>
              <div style={s.totalCurrency}>
                EUR
                <span style={s.fxStatus}>
                  {fxUpdatedAt
                    ? ` · FX rates as of ${dayjs(fxUpdatedAt).format("YYYY-MM-DD")}`
                    : " · No FX rates set"}
                </span>
              </div>
            </div>
            {/* Platform table */}
            <table style={s.holdingTable}>
              <thead>
                <tr>
                  <th style={s.holdingTh}>Platform</th>
                  <th style={{ ...s.holdingTh, textAlign: "right" }}>Amount (EUR)</th>
                  <th style={{ ...s.holdingTh, textAlign: "right" }}>Last Update</th>
                </tr>
              </thead>
              <tbody>
                {activePlatforms.map(p => {
                  const snap    = latestByPlatform[p];
                  const rawSnap = rawLatestByPlatform[p];
                  const showOrig = rawSnap && rawSnap.currency !== "EUR";
                  return (
                    <tr key={p} style={s.holdingTr}>
                      <td style={s.holdingTd}>
                        <span style={{ ...s.holdingDot, background: PLATFORM_COLOR[p] }} />
                        <span style={{ fontWeight: 600, color: "var(--text)" }}>{p}</span>
                      </td>
                      <td style={{ ...s.holdingTd, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "var(--text)" }}>
                        {snap ? fmtNum(snap.amount) : "—"}
                        {showOrig && (
                          <div style={{ fontSize: "10px", fontWeight: 400, color: "var(--text-muted)", marginTop: "1px" }}>
                            {fmtNum(rawSnap.amount)} {rawSnap.currency}
                          </div>
                        )}
                      </td>
                      <td style={{ ...s.holdingTd, textAlign: "right", color: "var(--text-muted)", fontSize: "11px" }}>
                        {snap ? snap.date : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Section>
        </div>

        <div style={s.chartCol}>
        <Section title="Portfolio evolution">
        {testingChartData.length < 2 ? (
          <p style={s.muted}>Not enough snapshot data to plot yet.</p>
        ) : (
          <>
          {/* Legend toggles */}
          <div style={s.legendRow}>
            {/* Portfolio total chip */}
            <button
              onClick={() => toggleLine(TOTAL_KEY)}
              style={{
                ...s.legendChip,
                opacity:         hiddenLines.has(TOTAL_KEY) ? 0.35 : 1,
                borderColor:     TOTAL_COLOR,
                color:           hiddenLines.has(TOTAL_KEY) ? "var(--text-muted)" : TOTAL_COLOR,
                backgroundColor: hiddenLines.has(TOTAL_KEY) ? "transparent" : `${TOTAL_COLOR}22`,
              }}
            >
              Portfolio total
            </button>
            {/* Individual platform chips */}
            {activePlatforms.map(p => (
              <button
                key={p}
                onClick={() => toggleLine(p)}
                style={{
                  ...s.legendChip,
                  opacity:         hiddenLines.has(p) ? 0.35 : 1,
                  borderColor:     PLATFORM_COLOR[p],
                  color:           hiddenLines.has(p) ? "var(--text-muted)" : PLATFORM_COLOR[p],
                  backgroundColor: hiddenLines.has(p) ? "transparent" : `${PLATFORM_COLOR[p]}18`,
                }}
              >
                {p}
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={testingChartData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="x"
                type="number"
                domain={[0, testingChartXMax]}
                ticks={testingChartYears.map((_, i) => i)}
                tickFormatter={i => testingChartYears[i] ?? ""}
                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                tickLine={false}
                axisLine={false}
                width={56}
                domain={["auto", "auto"]}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : fmtNum(v)}
              />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const { date, portfolio, cashFlow, ops, hasOp } = payload[0].payload;
                const cfColor = cashFlow == null ? "var(--text-muted)" : cashFlow >= 0 ? "#22c55e" : "#ef4444";
                const divider = <div style={{ borderTop: "1px solid var(--border)", margin: "6px 0" }} />;
                const row = (label, value, color, bold) => (
                  <div style={{ ...st.tooltipRow, color: color ?? "var(--text-muted)", fontWeight: bold ? 700 : 400, marginBottom: "2px" }}>
                    <span>{label}</span>
                    <span style={st.tooltipVal}>{value}</span>
                  </div>
                );
                return (
                  <div style={{ ...st.tooltip, minWidth: "220px" }}>
                    <div style={st.tooltipDate}>{date}</div>

                    {portfolio != null && row("Portfolio (actual)", `${fmtNum(portfolio)} EUR`, TOTAL_COLOR, true)}

                    {hasOp && ops?.length > 0 && (
                      <>
                        {divider}
                        {ops.map((op, i) => (
                          <div key={i} style={{ ...st.tooltipRow, color: op.type === "Deposit" ? "#22c55e" : "#ef4444", marginBottom: "2px" }}>
                            <span>{op.type} · {op.platform}</span>
                            <span style={st.tooltipVal}>
                              {op.type === "Deposit" ? "+" : "−"}{fmtNum(op.amount)} {op.currency}
                            </span>
                          </div>
                        ))}
                        {cashFlow != null && row(
                          "Net cash (EUR)",
                          `${cashFlow >= 0 ? "+" : ""}${fmtNum(cashFlow)} EUR`,
                          cfColor,
                        )}
                      </>
                    )}
                  </div>
                );
              }} />
              {/* Individual platform lines */}
              {activePlatforms.map(p => (
                <Line
                  key={p}
                  type="monotone"
                  dataKey={p}
                  stroke={PLATFORM_COLOR[p]}
                  strokeWidth={1.5}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    if (!payload.hasOp || payload[p] == null) return null;
                    return <circle key={`${p}-dot-${payload.date}`} cx={cx} cy={cy} r={4} fill={PLATFORM_COLOR[p]} stroke="var(--card)" strokeWidth={2} />;
                  }}
                  activeDot={{ r: 3, fill: PLATFORM_COLOR[p] }}
                  hide={hiddenLines.has(p)}
                  connectNulls={true}
                />
              ))}
              {/* Portfolio total line */}
              <Line
                type="monotone"
                dataKey="portfolio"
                name="Portfolio total"
                stroke={TOTAL_COLOR}
                strokeWidth={2.5}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  if (!payload.hasOp || payload.portfolio == null) return null;
                  return <circle key={`pdot-${payload.date}`} cx={cx} cy={cy} r={5} fill={TOTAL_COLOR} stroke="var(--card)" strokeWidth={2} />;
                }}
                activeDot={{ r: 4, fill: TOTAL_COLOR }}
                hide={hiddenLines.has(TOTAL_KEY)}
                connectNulls={true}
              />
            </LineChart>
          </ResponsiveContainer>
          </>
        )}
        <p style={{ ...s.muted, marginTop: "6px", fontSize: "10px" }}>
          <span style={{ color: TOTAL_COLOR, fontWeight: 600 }}>■</span> Actual portfolio (EUR). Dots mark operation months.
        </p>
      </Section>
        </div>
      </div>

      {/* ── Portfolio Snapshots + Operations Log (side by side) ─────────────── */}
      <div style={s.bottomRow}>

        {/* Left: Portfolio Snapshots */}
        <div style={s.bottomColLeft}>
          <Section title="Portfolio Snapshots" action={<button style={s.addBtn} onClick={openAddSnap}>+ Add Snapshot</button>}>
            {snapshots.length === 0 ? (
              <p style={s.muted}>No snapshots yet.</p>
            ) : (() => {
              // Group by date: { [date]: { [platform]: snapshot } }
              const byDate = {};
              snapshots.forEach(s => {
                if (!byDate[s.date]) byDate[s.date] = {};
                byDate[s.date][s.platform] = s;
              });
              const dates = Object.keys(byDate).sort().reverse();

              // Carry-forward total EUR per date (all platforms, not just recorded that day)
              function totalEURAt(date) {
                return PLATFORMS.reduce((sum, p) => {
                  const latest = snapshotsInEUR
                    .filter(s => s.platform === p && s.date <= date)
                    .sort((a, b) => b.date.localeCompare(a.date))[0];
                  return sum + (latest?.amount ?? 0);
                }, 0);
              }

              return (
                <div style={s.tableWrap}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={{ ...s.th, textAlign: "left" }}>Date</th>
                        {PLATFORMS.map(p => (
                          <th key={p} style={{ ...s.th, textAlign: "right", color: PLATFORM_COLOR[p] }}>
                            {p}
                          </th>
                        ))}
                        <th style={{ ...s.th, textAlign: "right" }}>Total (EUR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dates.map(date => {
                        const row = byDate[date];
                        return (
                          <tr key={date} style={s.tr}>
                            <td style={s.td}>{date}</td>
                            {PLATFORMS.map(p => {
                              const snap = row[p];
                              return (
                                <td key={p} style={{ ...s.td, textAlign: "right", fontVariantNumeric: "tabular-nums", color: snap ? "var(--text)" : "var(--text-muted)" }}>
                                  {snap ? (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                      <span>
                                        {fmtNum(snap.amount)}
                                        <span style={{ fontSize: "10px", color: "var(--text-muted)", marginLeft: "3px" }}>{snap.currency}</span>
                                      </span>
                                      <button style={s.editBtn} title="Edit" onClick={() => openEditSnap(snap)}>✎</button>
                                    </span>
                                  ) : "—"}
                                </td>
                              );
                            })}
                            <td style={{ ...s.td, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                              {fmtNum(totalEURAt(date))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </Section>
        </div>

        {/* Right: Operations Log */}
        <div style={s.bottomColRight}>
          <Section title="Operations Log" action={<button style={s.addBtn} onClick={openAddOp}>+ Add Operation</button>}>
            {operations.length === 0 ? (
              <p style={s.muted}>No operations yet.</p>
            ) : (
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {["Date","Platform","Type","Amount","Currency","",""].map((h, i) => (
                        <th key={i} style={{ ...s.th, textAlign: i >= 5 ? "center" : "left" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {operations.map(op => (
                      <tr key={op.operationId} style={s.tr}>
                        <td style={s.td}>{op.date}</td>
                        <td style={{ ...s.td }}>
                          <span style={{ color: PLATFORM_COLOR[op.platform], fontWeight: 600 }}>{op.platform}</span>
                        </td>
                        <td style={s.td}>
                          <span style={{ ...s.typeBadge, ...(op.type === "Deposit" ? s.typeDeposit : s.typeWithdraw) }}>
                            {op.type}
                          </span>
                        </td>
                        <td style={{ ...s.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(op.amount)}</td>
                        <td style={s.td}>{op.currency}</td>
                        <td style={{ ...s.td, textAlign: "center" }}>
                          <button style={s.editBtn} title="Edit" onClick={() => openEditOp(op)}>✎</button>
                        </td>
                        <td style={{ ...s.td, textAlign: "center" }}>
                          <button style={s.deleteBtn} title="Delete" onClick={() => handleOpDelete(op.operationId)}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>

      </div>

      {/* ── Operations Modal ─────────────────────────────────────────────────── */}
      {showOpModal && (
        <Modal title={editingOpId ? "Edit Operation" : "New Operation"} onClose={() => setShowOpModal(false)}>
          <FormField label="Date *" error={opErrors.date}>
            <input style={{ ...s.input, ...(opErrors.date ? s.inputErr : {}) }} type="date" {...opField("date")} />
          </FormField>
          <div style={s.row2}>
            <FormField label="Type">
              <select style={s.input} {...opField("type")}>
                <option>Deposit</option>
                <option>Withdrawal</option>
              </select>
            </FormField>
            <FormField label="Platform">
              <select style={s.input} {...opField("platform")}>
                {PLATFORMS.map(p => <option key={p}>{p}</option>)}
              </select>
            </FormField>
          </div>
          <div style={s.row2}>
            <FormField label="Amount *" error={opErrors.amount}>
              <input style={{ ...s.input, ...(opErrors.amount ? s.inputErr : {}) }} type="number" min="0" step="any" placeholder="0" {...opField("amount")} />
            </FormField>
            <FormField label="Currency">
              <select style={s.input} {...opField("currency")}>
                <option>USD</option>
                <option>EUR</option>
                <option>RON</option>
              </select>
            </FormField>
          </div>
          <FormField label="Notes">
            <input style={s.input} type="text" placeholder="Optional" {...opField("notes")} />
          </FormField>
          <div style={s.modalFooter}>
            <button style={s.cancelBtn} onClick={() => setShowOpModal(false)}>Cancel</button>
            <button style={s.saveBtn} onClick={handleOpSave}>Save</button>
          </div>
        </Modal>
      )}

      {/* ── Snapshot Modal ───────────────────────────────────────────────────── */}
      {showSnapModal && (
        <Modal title={editingSnapId ? "Edit Snapshot" : "New Portfolio Snapshot"} onClose={() => setShowSnapModal(false)}>
          <FormField label="Date *" error={snapErrors.date}>
            <input style={{ ...s.input, ...(snapErrors.date ? s.inputErr : {}) }} type="date" {...snapField("date")} />
          </FormField>
          <FormField label="Platform">
            <select style={s.input} {...snapField("platform")}>
              {PLATFORMS.map(p => <option key={p}>{p}</option>)}
            </select>
          </FormField>
          <div style={s.row2}>
            <FormField label="Amount *" error={snapErrors.amount}>
              <input style={{ ...s.input, ...(snapErrors.amount ? s.inputErr : {}) }} type="number" min="0" step="any" placeholder="0" {...snapField("amount")} />
            </FormField>
            <FormField label="Currency">
              <select style={s.input} {...snapField("currency")}>
                <option>USD</option>
                <option>EUR</option>
                <option>RON</option>
              </select>
            </FormField>
          </div>
          <div style={s.modalFooter}>
            <button style={s.cancelBtn} onClick={() => setShowSnapModal(false)}>Cancel</button>
            <button style={s.saveBtn} onClick={handleSnapSave}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, action, children }) {
  return (
    <div style={s.section}>
      <div style={s.sectionHeader}>
        <h3 style={s.sectionTitle}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>{title}</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={s.modalBody}>{children}</div>
      </div>
    </div>
  );
}

function FormField({ label, error, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <label style={s.label}>{label}</label>
      {children}
      {error && <span style={s.errText}>{error}</span>}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  page: {
    display:       "flex",
    flexDirection: "column",
    flex:          1,
    gap:           "20px",
    overflowY:     "auto",
    padding:       "0 2px 24px",
  },
  pageHeader: {
    flexShrink: 0,
  },
  pageTitle: {
    margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--text)",
  },
  pageSub: {
    margin: "4px 0 0", fontSize: "13px", color: "var(--text-muted)",
  },
  muted: {
    color: "var(--text-muted)", fontSize: "13px", margin: 0,
  },

  // Top row layout
  topRow: {
    display: "flex",
    gap: "20px",
    alignItems: "stretch",
  },
  holdingsCol: {
    flex: "0 0 30%",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },
  chartCol: {
    flex: "0 0 calc(70% - 20px)",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },
  bottomRow: {
    display: "flex",
    gap: "20px",
    alignItems: "flex-start",
  },
  bottomColLeft: {
    flex: "0 0 calc(70% - 10px)",
    minWidth: 0,
  },
  bottomColRight: {
    flex: "0 0 calc(30% - 10px)",
    minWidth: 0,
  },

  // Holdings table
  holdingTable: {
    width: "100%", borderCollapse: "collapse", fontSize: "13px",
  },
  holdingTh: {
    fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
    color: "var(--text-muted)", padding: "6px 8px", borderBottom: "1px solid var(--border)",
    textAlign: "left",
  },
  holdingTr: {
    borderBottom: "1px solid var(--border)",
  },
  holdingTd: {
    padding: "9px 8px", verticalAlign: "middle", fontSize: "13px", color: "var(--text-muted)",
  },
  holdingDot: {
    display: "inline-block", width: "8px", height: "8px",
    borderRadius: "50%", marginRight: "8px", flexShrink: 0,
    verticalAlign: "middle",
  },
  totalCard: {
    marginTop: "4px",
    padding: "14px 16px",
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    textAlign: "center",
  },
  totalLabel: {
    fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.05em", color: "var(--text-muted)",
  },
  totalAmount: {
    fontSize: "28px", fontWeight: 700, color: "var(--badge-text)",
    fontVariantNumeric: "tabular-nums", marginTop: "6px",
  },
  totalCurrency: {
    fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginTop: "2px",
  },
  noRates: {
    fontSize: "10px", color: "var(--text-muted)", opacity: 0.6,
  },
  fxStatus: {
    fontSize: "10px", color: "var(--text-muted)", opacity: 0.7, fontWeight: 400,
  },

  // Chart
  legendRow: {
    display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px",
  },
  legendChip: {
    fontSize: "11px", fontWeight: 600, padding: "3px 10px",
    borderRadius: "20px", border: "1.5px solid", cursor: "pointer",
    background: "transparent", transition: "opacity 0.15s",
  },
  tooltip: {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "8px", padding: "10px 14px", fontSize: "12px",
  },
  tooltipDate: {
    fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 600,
  },
  tooltipRow: {
    display: "flex", justifyContent: "space-between", gap: "16px",
  },
  tooltipVal: {
    fontWeight: 700, fontVariantNumeric: "tabular-nums",
  },

  // Section
  section: {
    display: "flex", flexDirection: "column", gap: "12px", flex: 1,
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "10px", padding: "18px 20px",
  },
  sectionHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
  },
  sectionTitle: {
    margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--text)",
  },
  addBtn: {
    background: "var(--accent)", border: "none", borderRadius: "8px",
    color: "#fff", fontSize: "12px", fontWeight: 600,
    padding: "7px 14px", cursor: "pointer", whiteSpace: "nowrap",
  },

  // Table
  tableWrap: {
    borderRadius: "8px",
    border: "1px solid var(--border)",
    overflowX: "hidden",
  },
  table: {
    width: "100%", borderCollapse: "collapse",
  },
  th: {
    fontSize: "10px", fontWeight: 600, color: "var(--text-muted)",
    textTransform: "uppercase", letterSpacing: "0.05em",
    padding: "8px 12px", borderBottom: "1px solid var(--border)",
    background: "var(--surface)", position: "sticky", top: 0, whiteSpace: "nowrap",
  },
  tr: { borderBottom: "1px solid var(--border)" },
  td: {
    padding: "9px 12px", fontSize: "13px", color: "var(--text)", whiteSpace: "nowrap",
  },
  typeBadge: {
    display: "inline-block", padding: "2px 8px", borderRadius: "10px",
    fontSize: "11px", fontWeight: 600, border: "1px solid",
  },
  typeDeposit: {
    background: "rgba(34,197,94,0.1)", color: "var(--success-text)",
    borderColor: "rgba(34,197,94,0.3)",
  },
  typeWithdraw: {
    background: "rgba(239,68,68,0.1)", color: "#ef4444",
    borderColor: "rgba(239,68,68,0.3)",
  },
  editBtn: {
    background: "transparent", border: "none", color: "var(--text-muted)",
    fontSize: "14px", cursor: "pointer", padding: "2px 6px", borderRadius: "4px",
  },
  deleteBtn: {
    background: "transparent", border: "none", color: "var(--text-muted)",
    fontSize: "12px", cursor: "pointer", padding: "2px 6px", borderRadius: "4px",
  },

  // Modal
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500,
  },
  modal: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px",
    width: "460px", maxWidth: "95vw", display: "flex", flexDirection: "column",
    boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
  },
  modalHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 20px 0",
  },
  modalTitle: { fontSize: "15px", fontWeight: 700, color: "var(--text)" },
  closeBtn: {
    background: "transparent", border: "none", color: "var(--text-muted)",
    fontSize: "14px", cursor: "pointer", padding: "4px 6px", borderRadius: "4px",
  },
  modalBody: {
    display: "flex", flexDirection: "column", gap: "14px", padding: "16px 20px 20px",
  },
  modalFooter: {
    display: "flex", justifyContent: "flex-end", gap: "10px",
    paddingTop: "8px",
  },
  row2: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px",
  },
  label: {
    fontSize: "11px", fontWeight: 600, color: "var(--text-muted)",
    textTransform: "uppercase", letterSpacing: "0.04em",
  },
  input: {
    background: "var(--surface-2, rgba(255,255,255,0.05))", border: "1px solid var(--border)",
    borderRadius: "7px", color: "var(--text)", fontSize: "13px",
    padding: "8px 10px", width: "100%", boxSizing: "border-box", outline: "none",
  },
  inputErr: { borderColor: "var(--danger, #ef4444)" },
  errText: { fontSize: "11px", color: "var(--danger, #ef4444)" },
  cancelBtn: {
    background: "transparent", border: "1px solid var(--border)", borderRadius: "7px",
    color: "var(--text-muted)", fontSize: "13px", padding: "7px 18px", cursor: "pointer",
  },
  saveBtn: {
    background: "var(--accent)", border: "none", borderRadius: "7px",
    color: "#fff", fontSize: "13px", fontWeight: 600, padding: "7px 18px", cursor: "pointer",
  },

  // Chart tooltip
  st: {},
};

const st = s; // alias for tooltip styles reuse
