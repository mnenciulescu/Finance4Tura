import { useState, useEffect, useMemo, useRef } from "react";
import dayjs from "dayjs";
import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  listOperations, createOperation, updateOperation, deleteOperation,
  listSnapshots, createSnapshot, updateSnapshot, deleteSnapshot,
} from "../api/investments";
import { getFxRates } from "../api/fxRates";

// The whole page is a single phone-width column, rendered the same way on
// desktop and on mobile — same widths, paddings and font sizes everywhere.
const COL_WIDTH = "430px";

// Portfolio evolution chart never plots anything before this month.
const CHART_START = "2023-01";

// Snapshots / operations lists reveal this many entries at a time.
const PAGE_STEP = 3;

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

const CURRENCIES = ["USD", "EUR", "RON"];

const TOTAL_KEY   = "Total";
const TOTAL_COLOR = "#94a3b8";

// ── Helpers ───────────────────────────────────────────────────────────────────

const todayStr = () => dayjs().format("YYYY-MM-DD");
const fmtNum   = (n) => (n ?? 0).toLocaleString("ro-RO", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtDate  = (d) => (d ? dayjs(d).format("D MMM YYYY") : "—");

function toEUR(amount, currency, rates) {
  if (!rates || currency === "EUR") return amount;
  const row = rates[currency];
  // New matrix form: rates[FROM][TO], so rates[currency].EUR = value of 1 CUR in EUR
  if (row && typeof row === "object" && row.EUR != null) return amount * row.EUR;
  // Legacy flat form (base EUR): rates.USD = 1 EUR in USD
  if (typeof row === "number") return amount / row;
  return amount;
}

function defaultOpForm() {
  return { date: todayStr(), type: "Deposit", platform: "eToro", amount: "", currency: "USD", notes: "" };
}
function defaultSnapForm() {
  return { date: todayStr(), platform: "eToro", amount: "", currency: "USD" };
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Investments() {
  const [operations, setOperations] = useState([]);
  const [snapshots,  setSnapshots]  = useState([]);
  const [fxRates,     setFxRates]     = useState(null);
  const [fxUpdatedAt, setFxUpdatedAt] = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");

  // Block 1 — holdings breakdown is collapsed until tapped
  const [showHoldings, setShowHoldings] = useState(false);

  // Block 2 — evolution chart: platforms hidden, portfolio total visible
  const [hiddenLines, setHiddenLines] = useState(new Set(PLATFORMS));

  // Blocks 3 & 4 — how many entries are revealed, and which are expanded
  const [snapLimit, setSnapLimit] = useState(PAGE_STEP);
  const [opLimit,   setOpLimit]   = useState(PAGE_STEP);
  const [openSnapDates, setOpenSnapDates] = useState({});
  const [openOps,       setOpenOps]       = useState({});

  // Bottom sheets
  const [opSheet,   setOpSheet]   = useState(null); // { mode, id }
  const [opForm,    setOpForm]    = useState(defaultOpForm);
  const [opErrors,  setOpErrors]  = useState({});
  const [snapSheet, setSnapSheet] = useState(null); // { mode, id }
  const [snapForm,  setSnapForm]  = useState(defaultSnapForm);
  const [snapErrors, setSnapErrors] = useState({});
  const [saving,    setSaving]    = useState(false);

  // Two-step inline delete confirmation
  const [confirmId, setConfirmId] = useState(null);
  const confirmTimer = useRef(null);

  useEffect(() => {
    Promise.all([listOperations(), listSnapshots()])
      .then(([ops, snaps]) => { setOperations(ops); setSnapshots(snaps); })
      .catch(e => { console.error(e); setError("Could not load investments data."); })
      .finally(() => setLoading(false));

    // Shared FX rates stored in the database (refreshed by admin only)
    getFxRates()
      .then(({ rates, updatedAt }) => {
        if (rates) setFxRates(rates);
        setFxUpdatedAt(updatedAt ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => () => clearTimeout(confirmTimer.current), []);

  // ── Derived data ────────────────────────────────────────────────────────────

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

  // Raw (unconverted) latest snapshot per platform — used to show the original currency
  const rawLatestByPlatform = useMemo(() => {
    const result = {};
    for (const s of snapshots) {
      if (!result[s.platform] || s.date > result[s.platform].date) result[s.platform] = s;
    }
    return result;
  }, [snapshots]);

  const totalPortfolioEUR = useMemo(() =>
    Object.values(latestByPlatform).reduce((sum, s) => sum + (s?.amount ?? 0), 0),
    [latestByPlatform]
  );

  // Platforms that still hold money — these make up the total, so the holdings
  // breakdown lists exactly these and their shares add up to 100 %.
  const heldPlatforms = useMemo(
    () => PLATFORMS.filter(p => (latestByPlatform[p]?.amount ?? 0) > 0),
    [latestByPlatform]
  );

  // Platforms with at least one snapshot > 0 in the last 12 months — used to
  // keep the chart legend free of platforms that have gone quiet.
  const activePlatforms = useMemo(() => {
    const cutoff = dayjs().subtract(12, "month").format("YYYY-MM-DD");
    return PLATFORMS.filter(p =>
      snapshots.some(s => s.platform === p && s.date >= cutoff && s.amount > 0)
    );
  }, [snapshots]);

  // Portfolio evolution: actual portfolio total + per-platform values, carried
  // forward month by month. Snapshots before CHART_START still feed the
  // carry-forward, but the plotted range starts at CHART_START.
  const { data: chartData, years: chartYears, xMax: chartXMax } = useMemo(() => {
    const allMonths = [
      ...snapshotsInEUR.map(s => s.date.slice(0, 7)),
      ...operations.map(op => op.date.slice(0, 7)),
    ];
    if (allMonths.length === 0) return { data: [], years: [], xMax: 0 };

    const earliest   = allMonths.reduce((min, m) => (m < min ? m : min));
    const startMonth = earliest < CHART_START ? CHART_START : earliest;
    const endMonth   = allMonths.reduce((max, m) => (m > max ? m : max));
    if (endMonth < startMonth) return { data: [], years: [], xMax: 0 };

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

    const data = months.map(monthId => ({
      date:      monthId,
      x:         dateToX(monthId + "-01"),
      portfolio: portfolioAt(monthId),
      ...Object.fromEntries(PLATFORMS.map(p => [p, platformAt(p, monthId)])),
      cashFlow:  opMonths.has(monthId) ? (opCashByMonth[monthId] ?? 0) : null,
      hasOp:     opMonths.has(monthId),
      ops:       operations.filter(op => op.date.slice(0, 7) === monthId),
    }));

    return { data, years, xMax: data.at(-1)?.x ?? years.length };
  }, [operations, snapshotsInEUR, fxRates]);

  // Snapshots grouped by date, newest first
  const snapDates = useMemo(() => {
    const byDate = {};
    snapshots.forEach(s => {
      if (!byDate[s.date]) byDate[s.date] = [];
      byDate[s.date].push(s);
    });
    Object.values(byDate).forEach(arr =>
      arr.sort((a, b) => PLATFORMS.indexOf(a.platform) - PLATFORMS.indexOf(b.platform))
    );

    // Carry-forward total in EUR across every platform as of that date
    const totalEURAt = (date) => PLATFORMS.reduce((sum, p) => {
      const latest = snapshotsInEUR
        .filter(s => s.platform === p && s.date <= date)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      return sum + (latest?.amount ?? 0);
    }, 0);

    return Object.keys(byDate)
      .sort()
      .reverse()
      .map(date => ({ date, rows: byDate[date], totalEUR: totalEURAt(date) }));
  }, [snapshots, snapshotsInEUR]);

  const sortedOps = useMemo(
    () => [...operations].sort((a, b) => (b.date || "").localeCompare(a.date || "")),
    [operations]
  );

  // ── Delete confirmation ─────────────────────────────────────────────────────

  function askDelete(id) {
    clearTimeout(confirmTimer.current);
    setConfirmId(id);
    confirmTimer.current = setTimeout(() => setConfirmId(null), 4000);
  }

  // ── Operations CRUD ─────────────────────────────────────────────────────────

  function openAddOp() {
    setOpForm(defaultOpForm());
    setOpErrors({});
    setOpSheet({ mode: "create" });
  }

  function openEditOp(op) {
    setOpForm({
      date:     op.date,
      type:     op.type,
      platform: op.platform,
      amount:   String(op.amount ?? ""),
      currency: op.currency,
      notes:    op.notes || "",
    });
    setOpErrors({});
    setOpSheet({ mode: "edit", id: op.operationId });
  }

  async function handleOpSave() {
    const errs = {};
    if (!opForm.date)                          errs.date   = "Required";
    if (!opForm.amount || +opForm.amount <= 0) errs.amount = "Must be greater than 0";
    setOpErrors(errs);
    if (Object.keys(errs).length) return;

    const body = { ...opForm, amount: parseFloat(opForm.amount) };
    setSaving(true);
    setError("");
    try {
      if (opSheet.mode === "edit") {
        const updated = await updateOperation(opSheet.id, body);
        setOperations(prev => prev.map(o => (o.operationId === opSheet.id ? updated : o)));
      } else {
        const created = await createOperation(body);
        setOperations(prev => [created, ...prev]);
      }
      setOpSheet(null);
    } catch (e) {
      console.error(e);
      setError("Could not save the operation.");
    } finally {
      setSaving(false);
    }
  }

  async function handleOpDelete(id) {
    clearTimeout(confirmTimer.current);
    setConfirmId(null);
    try {
      await deleteOperation(id);
      setOperations(prev => prev.filter(o => o.operationId !== id));
    } catch (e) {
      console.error(e);
      setError("Could not delete the operation.");
    }
  }

  // ── Snapshots CRUD ──────────────────────────────────────────────────────────

  function openAddSnap(date) {
    setSnapForm({ ...defaultSnapForm(), ...(date ? { date } : {}) });
    setSnapErrors({});
    setSnapSheet({ mode: "create" });
  }

  function openEditSnap(snap) {
    setSnapForm({
      date:     snap.date,
      platform: snap.platform,
      amount:   String(snap.amount ?? ""),
      currency: snap.currency,
    });
    setSnapErrors({});
    setSnapSheet({ mode: "edit", id: snap.snapshotId });
  }

  async function handleSnapSave() {
    const errs = {};
    if (!snapForm.date)                                   errs.date   = "Required";
    if (snapForm.amount === "" || +snapForm.amount < 0)   errs.amount = "Must be 0 or more";
    setSnapErrors(errs);
    if (Object.keys(errs).length) return;

    const body = { ...snapForm, amount: parseFloat(snapForm.amount) };
    setSaving(true);
    setError("");
    try {
      if (snapSheet.mode === "edit") {
        const updated = await updateSnapshot(snapSheet.id, body);
        setSnapshots(prev => prev.map(s => (s.snapshotId === snapSheet.id ? updated : s)));
      } else {
        const created = await createSnapshot(body);
        setSnapshots(prev => [created, ...prev]);
      }
      setSnapSheet(null);
    } catch (e) {
      console.error(e);
      setError("Could not save the snapshot.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSnapDelete(id) {
    clearTimeout(confirmTimer.current);
    setConfirmId(null);
    try {
      await deleteSnapshot(id);
      setSnapshots(prev => prev.filter(s => s.snapshotId !== id));
    } catch (e) {
      console.error(e);
      setError("Could not delete the snapshot.");
    }
  }

  // ── Chart legend ────────────────────────────────────────────────────────────

  function toggleLine(key) {
    setHiddenLines(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const visibleSnapDates = snapDates.slice(0, snapLimit);
  const visibleOps       = sortedOps.slice(0, opLimit);

  return (
    <div style={s.page}>
      <div style={s.column}>

        <div style={s.header}>
          <div style={{ minWidth: 0 }}>
            <h2 style={s.title}>Investments</h2>
            <p style={s.subtitle}>
              {snapDates.length} snapshot{snapDates.length === 1 ? "" : "s"} · {operations.length} operation{operations.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {error && (
          <div style={s.errorBox} onClick={() => setError("")}>
            {error} <span style={{ opacity: 0.6 }}>(tap to dismiss)</span>
          </div>
        )}

        <div style={s.scroll}>
          {loading ? (
            <div style={s.empty}>Loading…</div>
          ) : (
            <>
              {/* ── Block 1 · Total portfolio ─────────────────────────────── */}
              <section style={s.block}>
                <div
                  style={s.totalHead}
                  onClick={() => setShowHoldings(v => !v)}
                  role="button"
                  tabIndex={0}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.totalLabel}>Total portfolio</div>
                    <div style={s.totalRow}>
                      <span style={s.totalAmount}>{fmtNum(totalPortfolioEUR)}</span>
                      <span style={s.totalCur}>EUR</span>
                    </div>
                    <div style={s.totalMeta}>
                      {heldPlatforms.length} platform{heldPlatforms.length === 1 ? "" : "s"}
                      <span style={s.dot}>·</span>
                      {fxUpdatedAt ? `FX ${fmtDate(fxUpdatedAt)}` : "no FX rates set"}
                    </div>
                  </div>
                  <Chevron open={showHoldings} />
                </div>

                {showHoldings && (
                  <div style={s.blockBody}>
                    {heldPlatforms.length === 0 ? (
                      <div style={s.emptyLine}>No platform holdings yet.</div>
                    ) : heldPlatforms.map(p => {
                      const snap    = latestByPlatform[p];
                      const raw     = rawLatestByPlatform[p];
                      const eur     = snap?.amount ?? 0;
                      const share   = totalPortfolioEUR > 0 ? (eur / totalPortfolioEUR) * 100 : 0;
                      const showRaw = raw && raw.currency !== "EUR";
                      return (
                        <div key={p} style={s.holding}>
                          <div style={s.holdingTop}>
                            <span style={{ ...s.holdingDot, background: PLATFORM_COLOR[p] }} />
                            <span style={s.holdingName}>{p}</span>
                            <span style={s.holdingAmount}>{fmtNum(eur)}</span>
                          </div>
                          <div style={s.holdingTrack}>
                            <div style={{ ...s.holdingFill, width: `${share}%`, background: PLATFORM_COLOR[p] }} />
                          </div>
                          <div style={s.holdingMeta}>
                            <span>{share.toFixed(1)}%</span>
                            {showRaw && (
                              <>
                                <span style={s.dot}>·</span>
                                <span>{fmtNum(raw.amount)} {raw.currency}</span>
                              </>
                            )}
                            <span style={{ flex: 1 }} />
                            <span>{snap ? fmtDate(snap.date) : "—"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* ── Block 2 · Portfolio evolution ─────────────────────────── */}
              <section style={s.block}>
                <div style={s.blockHead}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.blockTitle}>Portfolio evolution</div>
                    <div style={s.blockSub}>Actual value in EUR since {CHART_START.slice(0, 4)}</div>
                  </div>
                </div>

                <div style={s.blockBody}>
                  {chartData.length < 2 ? (
                    <div style={s.emptyLine}>Not enough snapshot data to plot yet.</div>
                  ) : (
                    <>
                      <div style={s.legendRow}>
                        <button
                          onClick={() => toggleLine(TOTAL_KEY)}
                          style={s.legendChip(TOTAL_COLOR, hiddenLines.has(TOTAL_KEY))}
                        >
                          Total
                        </button>
                        {activePlatforms.map(p => (
                          <button
                            key={p}
                            onClick={() => toggleLine(p)}
                            style={s.legendChip(PLATFORM_COLOR[p], hiddenLines.has(p))}
                          >
                            {p}
                          </button>
                        ))}
                      </div>

                      <ResponsiveContainer width="100%" height={210}>
                        <LineChart data={chartData} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis
                            dataKey="x"
                            type="number"
                            domain={[0, chartXMax]}
                            ticks={chartYears.map((_, i) => i)}
                            tickFormatter={i => chartYears[i] ?? ""}
                            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                            tickLine={false}
                            axisLine={{ stroke: "var(--border)" }}
                          />
                          <YAxis
                            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                            tickLine={false}
                            axisLine={false}
                            width={40}
                            domain={["auto", "auto"]}
                            tickFormatter={v => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : fmtNum(v))}
                          />
                          <Tooltip content={<ChartTooltip />} />
                          {activePlatforms.map(p => (
                            <Line
                              key={p}
                              type="monotone"
                              dataKey={p}
                              stroke={PLATFORM_COLOR[p]}
                              strokeWidth={1.5}
                              dot={({ cx, cy, payload }) => {
                                if (!payload.hasOp || payload[p] == null || isNaN(cy)) return null;
                                return <circle key={`${p}-${payload.date}`} cx={cx} cy={cy} r={3.5} fill={PLATFORM_COLOR[p]} stroke="var(--surface)" strokeWidth={1.5} />;
                              }}
                              activeDot={{ r: 3, fill: PLATFORM_COLOR[p] }}
                              hide={hiddenLines.has(p)}
                              connectNulls
                            />
                          ))}
                          <Line
                            type="monotone"
                            dataKey="portfolio"
                            name="Portfolio total"
                            stroke={TOTAL_COLOR}
                            strokeWidth={2.5}
                            dot={({ cx, cy, payload }) => {
                              if (!payload.hasOp || payload.portfolio == null || isNaN(cy)) return null;
                              return <circle key={`total-${payload.date}`} cx={cx} cy={cy} r={4.5} fill={TOTAL_COLOR} stroke="var(--surface)" strokeWidth={1.5} />;
                            }}
                            activeDot={{ r: 4, fill: TOTAL_COLOR }}
                            hide={hiddenLines.has(TOTAL_KEY)}
                            connectNulls
                          />
                        </LineChart>
                      </ResponsiveContainer>

                      <div style={s.chartNote}>Dots mark months with operations. Tap a point for details.</div>
                    </>
                  )}
                </div>
              </section>

              {/* ── Block 3 · Portfolio snapshots ─────────────────────────── */}
              <section style={s.block}>
                <div style={s.blockHead}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.blockTitle}>Portfolio snapshots</div>
                    <div style={s.blockSub}>{snapDates.length} recorded date{snapDates.length === 1 ? "" : "s"}</div>
                  </div>
                  <button style={s.addBtn} onClick={() => openAddSnap()}>
                    <span style={s.plus}>+</span>Add
                  </button>
                </div>

                <div style={s.blockBody}>
                  {snapDates.length === 0 ? (
                    <div style={s.emptyLine}>No snapshots yet.</div>
                  ) : (
                    <>
                      {visibleSnapDates.map(group => {
                        const open = !!openSnapDates[group.date];
                        return (
                          <div key={group.date} style={s.entry}>
                            <div
                              style={s.entryHead}
                              onClick={() => setOpenSnapDates(prev => ({ ...prev, [group.date]: !prev[group.date] }))}
                              role="button"
                              tabIndex={0}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={s.entryTitleRow}>
                                  <span style={s.entryTitle}>{fmtDate(group.date)}</span>
                                  <span style={s.countBadge}>{group.rows.length}</span>
                                </div>
                                <div style={s.entryMeta}>
                                  {group.rows.map(r => (
                                    <span key={r.snapshotId} style={{ ...s.pfDot, background: PLATFORM_COLOR[r.platform] }} />
                                  ))}
                                  <span style={s.dot}>·</span>
                                  <span style={s.entryStrong}>{fmtNum(group.totalEUR)} EUR</span>
                                </div>
                              </div>
                              <Chevron open={open} />
                            </div>

                            {open && (
                              <div style={s.entryBody}>
                                {group.rows.map(snap => {
                                  const confirming = confirmId === snap.snapshotId;
                                  const eur = toEUR(snap.amount, snap.currency, fxRates);
                                  return (
                                    <div key={snap.snapshotId} style={s.subRow}>
                                      <span style={{ ...s.pfDot, background: PLATFORM_COLOR[snap.platform] }} />
                                      <span style={s.subName}>{snap.platform}</span>
                                      <span style={s.subValue}>
                                        {fmtNum(snap.amount)} <span style={s.subCur}>{snap.currency}</span>
                                        {snap.currency !== "EUR" && (
                                          <span style={s.subEur}>≈ {fmtNum(eur)} EUR</span>
                                        )}
                                      </span>
                                      <button style={s.iconBtn} title="Edit" onClick={() => openEditSnap(snap)}>✎</button>
                                      <button
                                        style={confirming ? s.iconBtnDanger : s.iconBtn}
                                        title="Delete"
                                        onClick={() => (confirming ? handleSnapDelete(snap.snapshotId) : askDelete(snap.snapshotId))}
                                      >
                                        {confirming ? "!" : "✕"}
                                      </button>
                                    </div>
                                  );
                                })}
                                <button style={s.ghostBtn} onClick={() => openAddSnap(group.date)}>
                                  + Add platform to this date
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <MoreLess
                        shown={visibleSnapDates.length}
                        total={snapDates.length}
                        onMore={() => setSnapLimit(n => n + PAGE_STEP)}
                        onLess={() => setSnapLimit(PAGE_STEP)}
                      />
                    </>
                  )}
                </div>
              </section>

              {/* ── Block 4 · Operations log ──────────────────────────────── */}
              <section style={s.block}>
                <div style={s.blockHead}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.blockTitle}>Operations log</div>
                    <div style={s.blockSub}>Deposits &amp; withdrawals · {operations.length} total</div>
                  </div>
                  <button style={s.addBtn} onClick={openAddOp}>
                    <span style={s.plus}>+</span>Add
                  </button>
                </div>

                <div style={s.blockBody}>
                  {operations.length === 0 ? (
                    <div style={s.emptyLine}>No operations yet.</div>
                  ) : (
                    <>
                      {visibleOps.map(op => {
                        const open       = !!openOps[op.operationId];
                        const confirming = confirmId === op.operationId;
                        const deposit    = op.type === "Deposit";
                        return (
                          <div key={op.operationId} style={s.entry}>
                            <div
                              style={s.entryHead}
                              onClick={() => setOpenOps(prev => ({ ...prev, [op.operationId]: !prev[op.operationId] }))}
                              role="button"
                              tabIndex={0}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={s.entryTitleRow}>
                                  <span style={{ ...s.pfDot, background: PLATFORM_COLOR[op.platform] }} />
                                  <span style={s.entryTitle}>{op.platform}</span>
                                  <span style={s.typeBadge(deposit)}>{op.type}</span>
                                </div>
                                <div style={s.entryMeta}>
                                  <span>{fmtDate(op.date)}</span>
                                  <span style={s.dot}>·</span>
                                  <span style={{ ...s.entryStrong, color: deposit ? "var(--success-text)" : "#ef4444" }}>
                                    {deposit ? "+" : "−"}{fmtNum(op.amount)} {op.currency}
                                  </span>
                                </div>
                              </div>
                              <Chevron open={open} />
                            </div>

                            {open && (
                              <div style={s.entryBody}>
                                {op.notes && <div style={s.notes}>{op.notes}</div>}
                                <div style={s.actions}>
                                  <button style={s.action} onClick={() => openEditOp(op)}>Edit</button>
                                  <span style={{ flex: 1 }} />
                                  <button
                                    style={confirming ? s.actionDangerActive : s.action}
                                    onClick={() => (confirming ? handleOpDelete(op.operationId) : askDelete(op.operationId))}
                                  >
                                    {confirming ? "Tap to confirm" : "Delete"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <MoreLess
                        shown={visibleOps.length}
                        total={sortedOps.length}
                        onMore={() => setOpLimit(n => n + PAGE_STEP)}
                        onLess={() => setOpLimit(PAGE_STEP)}
                      />
                    </>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {/* ── Snapshot sheet ───────────────────────────────────────────────── */}
      {snapSheet && (
        <Sheet
          title={snapSheet.mode === "edit" ? "Edit snapshot" : "New snapshot"}
          saving={saving}
          submitLabel={snapSheet.mode === "edit" ? "Save" : "Create"}
          onClose={() => setSnapSheet(null)}
          onSubmit={handleSnapSave}
        >
          <Field label="Date" error={snapErrors.date}>
            <input
              style={s.input(snapErrors.date)}
              type="date"
              value={snapForm.date}
              onChange={e => setSnapForm(f => ({ ...f, date: e.target.value }))}
            />
          </Field>
          <Field label="Platform">
            <select
              style={s.input()}
              value={snapForm.platform}
              onChange={e => setSnapForm(f => ({ ...f, platform: e.target.value, currency: PLATFORM_CURRENCY[e.target.value] ?? "USD" }))}
            >
              {PLATFORMS.map(p => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <div style={s.row2}>
            <Field label="Amount" error={snapErrors.amount}>
              <input
                style={s.input(snapErrors.amount)}
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                placeholder="0"
                value={snapForm.amount}
                onChange={e => setSnapForm(f => ({ ...f, amount: e.target.value }))}
              />
            </Field>
            <Field label="Currency">
              <select
                style={s.input()}
                value={snapForm.currency}
                onChange={e => setSnapForm(f => ({ ...f, currency: e.target.value }))}
              >
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>
        </Sheet>
      )}

      {/* ── Operation sheet ──────────────────────────────────────────────── */}
      {opSheet && (
        <Sheet
          title={opSheet.mode === "edit" ? "Edit operation" : "New operation"}
          saving={saving}
          submitLabel={opSheet.mode === "edit" ? "Save" : "Create"}
          onClose={() => setOpSheet(null)}
          onSubmit={handleOpSave}
        >
          <Field label="Date" error={opErrors.date}>
            <input
              style={s.input(opErrors.date)}
              type="date"
              value={opForm.date}
              onChange={e => setOpForm(f => ({ ...f, date: e.target.value }))}
            />
          </Field>
          <Field label="Type">
            <div style={s.segment}>
              {["Deposit", "Withdrawal"].map(t => (
                <button
                  key={t}
                  style={s.segmentBtn(opForm.type === t, t === "Deposit")}
                  onClick={() => setOpForm(f => ({ ...f, type: t }))}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Platform">
            <select
              style={s.input()}
              value={opForm.platform}
              onChange={e => setOpForm(f => ({ ...f, platform: e.target.value, currency: PLATFORM_CURRENCY[e.target.value] ?? "USD" }))}
            >
              {PLATFORMS.map(p => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <div style={s.row2}>
            <Field label="Amount" error={opErrors.amount}>
              <input
                style={s.input(opErrors.amount)}
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                placeholder="0"
                value={opForm.amount}
                onChange={e => setOpForm(f => ({ ...f, amount: e.target.value }))}
              />
            </Field>
            <Field label="Currency">
              <select
                style={s.input()}
                value={opForm.currency}
                onChange={e => setOpForm(f => ({ ...f, currency: e.target.value }))}
              >
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Notes">
            <input
              style={s.input()}
              type="text"
              placeholder="Optional"
              value={opForm.notes}
              onChange={e => setOpForm(f => ({ ...f, notes: e.target.value }))}
            />
          </Field>
        </Sheet>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { date, portfolio, cashFlow, ops, hasOp } = payload[0].payload;
  const cfColor = cashFlow == null ? "var(--text-muted)" : cashFlow >= 0 ? "#22c55e" : "#ef4444";
  return (
    <div style={s.tooltip}>
      <div style={s.tooltipDate}>{date}</div>
      {portfolio != null && (
        <div style={{ ...s.tooltipRow, color: TOTAL_COLOR, fontWeight: 700 }}>
          <span>Portfolio</span>
          <span style={s.tooltipVal}>{fmtNum(portfolio)} EUR</span>
        </div>
      )}
      {hasOp && ops?.length > 0 && (
        <>
          <div style={s.tooltipDivider} />
          {ops.map((op, i) => (
            <div key={i} style={{ ...s.tooltipRow, color: op.type === "Deposit" ? "#22c55e" : "#ef4444" }}>
              <span>{op.type} · {op.platform}</span>
              <span style={s.tooltipVal}>
                {op.type === "Deposit" ? "+" : "−"}{fmtNum(op.amount)} {op.currency}
              </span>
            </div>
          ))}
          {cashFlow != null && (
            <div style={{ ...s.tooltipRow, color: cfColor }}>
              <span>Net cash</span>
              <span style={s.tooltipVal}>{cashFlow >= 0 ? "+" : ""}{fmtNum(cashFlow)} EUR</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MoreLess({ shown, total, onMore, onLess }) {
  if (total <= PAGE_STEP) return null;
  return (
    <div style={s.moreRow}>
      {shown < total && (
        <button style={s.moreBtn} onClick={onMore}>
          Show {Math.min(PAGE_STEP, total - shown)} more
          <span style={s.moreCount}>{shown}/{total}</span>
        </button>
      )}
      {shown > PAGE_STEP && (
        <button style={s.moreBtn} onClick={onLess}>Show less</button>
      )}
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

function Sheet({ title, saving, submitLabel, onClose, onSubmit, children }) {
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.sheet} onClick={e => e.stopPropagation()}>
        <div style={s.grabber} />
        <div style={s.sheetHead}>
          <span style={s.sheetTitle}>{title}</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={s.sheetBody}>{children}</div>
        <div style={s.sheetFoot}>
          <button style={s.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={s.saveBtn} onClick={onSubmit} disabled={saving}>
            {saving ? "Saving…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px", minWidth: 0 }}>
      <label style={s.label}>{label}</label>
      {children}
      {error && <span style={s.fieldErr}>{error}</span>}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const GREEN_BG     = "rgba(34,197,94,0.10)";
const GREEN_BORDER = "rgba(34,197,94,0.35)";
const RED_BG       = "rgba(239,68,68,0.10)";
const RED_BORDER   = "rgba(239,68,68,0.35)";

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

  errorBox: {
    flexShrink:   0,
    margin:       "10px 12px 0",
    background:   "var(--error-bg)",
    color:        "var(--error-text)",
    border:       "1px solid var(--danger)",
    borderRadius: "8px",
    padding:      "9px 12px",
    fontSize:     "12px",
    cursor:       "pointer",
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
    color:     "var(--text-muted)",
    fontSize:  "13px",
    padding:   "6px 2px",
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
  addBtn: {
    display:      "inline-flex",
    alignItems:   "center",
    gap:          "5px",
    flexShrink:   0,
    background:   "var(--accent)",
    border:       "none",
    borderRadius: "9px",
    color:        "#fff",
    fontSize:     "13px",
    fontWeight:   600,
    padding:      "9px 14px",
    minHeight:    "38px",
    cursor:       "pointer",
    whiteSpace:   "nowrap",
  },
  plus: { fontSize: "16px", lineHeight: 1 },
  dot:  { opacity: 0.5, margin: "0 4px" },

  // ── Block 1 · total
  totalHead: {
    display:    "flex",
    alignItems: "center",
    gap:        "10px",
    padding:    "16px 14px",
    cursor:     "pointer",
    userSelect: "none",
  },
  totalLabel: {
    fontSize:      "11px",
    fontWeight:    700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color:         "var(--text-muted)",
  },
  totalRow: {
    display:    "flex",
    alignItems: "baseline",
    gap:        "7px",
    marginTop:  "5px",
  },
  totalAmount: {
    fontSize:   "30px",
    fontWeight: 700,
    color:      "var(--badge-text)",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.1,
  },
  totalCur: {
    fontSize:   "13px",
    fontWeight: 700,
    color:      "var(--text-muted)",
  },
  totalMeta: {
    display:    "flex",
    alignItems: "center",
    flexWrap:   "wrap",
    marginTop:  "6px",
    fontSize:   "12px",
    color:      "var(--text-muted)",
  },

  holding: {
    display:       "flex",
    flexDirection: "column",
    gap:           "6px",
    background:    "var(--surface-2)",
    border:        "1px solid var(--border)",
    borderRadius:  "10px",
    padding:       "10px 11px",
  },
  holdingTop: {
    display:    "flex",
    alignItems: "center",
    gap:        "8px",
  },
  holdingDot: {
    width:        "9px",
    height:       "9px",
    borderRadius: "50%",
    flexShrink:   0,
  },
  holdingName: {
    flex:         1,
    minWidth:     0,
    fontSize:     "13px",
    fontWeight:   600,
    color:        "var(--text)",
    overflow:     "hidden",
    textOverflow: "ellipsis",
    whiteSpace:   "nowrap",
  },
  holdingAmount: {
    flexShrink: 0,
    fontSize:   "14px",
    fontWeight: 700,
    color:      "var(--text)",
    fontVariantNumeric: "tabular-nums",
  },
  holdingTrack: {
    height:       "3px",
    borderRadius: "2px",
    background:   "var(--border)",
    overflow:     "hidden",
  },
  holdingFill: {
    height:       "100%",
    borderRadius: "2px",
    transition:   "width 0.25s",
  },
  holdingMeta: {
    display:    "flex",
    alignItems: "center",
    gap:        "2px",
    fontSize:   "11px",
    color:      "var(--text-muted)",
    fontVariantNumeric: "tabular-nums",
  },

  // ── Block 2 · chart
  legendRow: {
    display:  "flex",
    flexWrap: "wrap",
    gap:      "6px",
  },
  legendChip: (color, hidden) => ({
    fontSize:        "11px",
    fontWeight:      600,
    padding:         "5px 10px",
    borderRadius:    "20px",
    border:          `1.5px solid ${hidden ? "var(--border)" : color}`,
    cursor:          "pointer",
    color:           hidden ? "var(--text-muted)" : color,
    backgroundColor: hidden ? "transparent" : `${color}22`,
    opacity:         hidden ? 0.55 : 1,
    transition:      "opacity 0.15s",
  }),
  chartNote: {
    fontSize: "11px",
    color:    "var(--text-muted)",
  },
  tooltip: {
    background:   "var(--surface)",
    border:       "1px solid var(--border)",
    borderRadius: "9px",
    padding:      "9px 12px",
    fontSize:     "12px",
    minWidth:     "190px",
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

  // ── Blocks 3 & 4 · entries
  entry: {
    background:   "var(--surface-2)",
    border:       "1px solid var(--border)",
    borderRadius: "11px",
    overflow:     "hidden",
  },
  entryHead: {
    display:    "flex",
    alignItems: "center",
    gap:        "10px",
    padding:    "11px 12px",
    cursor:     "pointer",
    userSelect: "none",
  },
  entryTitleRow: {
    display:    "flex",
    alignItems: "center",
    gap:        "7px",
    minWidth:   0,
  },
  entryTitle: {
    fontSize:     "13px",
    fontWeight:   600,
    color:        "var(--text)",
    overflow:     "hidden",
    textOverflow: "ellipsis",
    whiteSpace:   "nowrap",
    minWidth:     0,
  },
  entryMeta: {
    display:    "flex",
    alignItems: "center",
    flexWrap:   "wrap",
    gap:        "3px",
    marginTop:  "4px",
    fontSize:   "12px",
    color:      "var(--text-muted)",
  },
  entryStrong: {
    fontWeight: 700,
    color:      "var(--text)",
    fontVariantNumeric: "tabular-nums",
  },
  entryBody: {
    display:       "flex",
    flexDirection: "column",
    gap:           "7px",
    padding:       "10px 12px 11px",
    borderTop:     "1px solid var(--border)",
  },
  countBadge: {
    flexShrink:   0,
    padding:      "1px 7px",
    borderRadius: "9px",
    fontSize:     "11px",
    fontWeight:   700,
    background:   "var(--surface)",
    color:        "var(--text-muted)",
    border:       "1px solid var(--border)",
  },
  pfDot: {
    width:        "7px",
    height:       "7px",
    borderRadius: "50%",
    flexShrink:   0,
    display:      "inline-block",
  },
  typeBadge: (deposit) => ({
    flexShrink:   0,
    padding:      "1px 8px",
    borderRadius: "9px",
    fontSize:     "10px",
    fontWeight:   700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background:   deposit ? GREEN_BG : RED_BG,
    color:        deposit ? "var(--success-text)" : "#ef4444",
    border:       `1px solid ${deposit ? GREEN_BORDER : RED_BORDER}`,
  }),

  subRow: {
    display:    "flex",
    alignItems: "center",
    gap:        "8px",
  },
  subName: {
    flex:         1,
    minWidth:     0,
    fontSize:     "12px",
    fontWeight:   600,
    color:        "var(--text)",
    overflow:     "hidden",
    textOverflow: "ellipsis",
    whiteSpace:   "nowrap",
  },
  subValue: {
    flexShrink: 0,
    fontSize:   "13px",
    fontWeight: 700,
    color:      "var(--text)",
    fontVariantNumeric: "tabular-nums",
    textAlign:  "right",
  },
  subCur: {
    fontSize:   "10px",
    fontWeight: 600,
    color:      "var(--text-muted)",
  },
  subEur: {
    display:    "block",
    fontSize:   "10px",
    fontWeight: 500,
    color:      "var(--text-muted)",
  },
  iconBtn: {
    flexShrink:     0,
    width:          "30px",
    height:         "30px",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    background:     "transparent",
    border:         "1px solid var(--border)",
    borderRadius:   "8px",
    color:          "var(--text-muted)",
    fontSize:       "12px",
    lineHeight:     1,
    cursor:         "pointer",
  },
  iconBtnDanger: {
    flexShrink:     0,
    width:          "30px",
    height:         "30px",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    background:     "var(--error-bg)",
    border:         "1px solid var(--danger)",
    borderRadius:   "8px",
    color:          "var(--error-text)",
    fontSize:       "13px",
    fontWeight:     700,
    lineHeight:     1,
    cursor:         "pointer",
  },
  ghostBtn: {
    marginTop:    "2px",
    background:   "transparent",
    border:       "1px dashed var(--border)",
    borderRadius: "8px",
    color:        "var(--text-muted)",
    fontSize:     "12px",
    fontWeight:   600,
    padding:      "9px 12px",
    cursor:       "pointer",
  },
  notes: {
    fontSize:   "12px",
    color:      "var(--text-muted)",
    lineHeight: 1.5,
  },
  actions: {
    display:    "flex",
    alignItems: "center",
    gap:        "8px",
  },
  action: {
    background:   "transparent",
    border:       "1px solid var(--border)",
    borderRadius: "8px",
    color:        "var(--text-muted)",
    fontSize:     "12px",
    fontWeight:   600,
    padding:      "8px 12px",
    cursor:       "pointer",
  },
  actionDangerActive: {
    background:   "var(--error-bg)",
    border:       "1px solid var(--danger)",
    borderRadius: "8px",
    color:        "var(--error-text)",
    fontSize:     "12px",
    fontWeight:   700,
    padding:      "8px 12px",
    cursor:       "pointer",
  },

  moreRow: {
    display: "flex",
    gap:     "8px",
    marginTop: "2px",
  },
  moreBtn: {
    flex:         1,
    display:      "inline-flex",
    alignItems:   "center",
    justifyContent: "center",
    gap:          "7px",
    background:   "transparent",
    border:       "1px solid var(--border)",
    borderRadius: "9px",
    color:        "var(--text-muted)",
    fontSize:     "12px",
    fontWeight:   600,
    padding:      "10px 12px",
    cursor:       "pointer",
  },
  moreCount: {
    fontSize:   "11px",
    opacity:    0.7,
    fontVariantNumeric: "tabular-nums",
  },

  // ── Bottom sheet
  overlay: {
    position:       "fixed",
    inset:          0,
    background:     "rgba(0,0,0,0.55)",
    display:        "flex",
    alignItems:     "flex-end",
    justifyContent: "center",
    zIndex:         500,
  },
  sheet: {
    background:    "var(--surface)",
    border:        "1px solid var(--border)",
    borderRadius:  "16px 16px 0 0",
    width:         "100%",
    maxWidth:      COL_WIDTH,
    maxHeight:     "92dvh",
    display:       "flex",
    flexDirection: "column",
    overflow:      "hidden",
    boxShadow:     "0 -6px 40px rgba(0,0,0,0.45)",
  },
  grabber: {
    width:        "38px",
    height:       "4px",
    borderRadius: "2px",
    background:   "var(--border)",
    margin:       "8px auto 0",
    flexShrink:   0,
  },
  sheetHead: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    padding:        "14px 18px 0",
    flexShrink:     0,
  },
  sheetTitle: {
    fontSize:   "15px",
    fontWeight: 700,
    color:      "var(--text)",
  },
  closeBtn: {
    background: "transparent",
    border:     "none",
    color:      "var(--text-muted)",
    fontSize:   "15px",
    cursor:     "pointer",
    padding:    "6px 8px",
  },
  sheetBody: {
    display:       "flex",
    flexDirection: "column",
    gap:           "13px",
    padding:       "14px 18px 18px",
    overflowY:     "auto",
    minHeight:     0,
  },
  sheetFoot: {
    display:             "grid",
    gridTemplateColumns: "1fr 1fr",
    gap:                 "10px",
    padding:             "12px 18px calc(16px + env(safe-area-inset-bottom))",
    borderTop:           "1px solid var(--border)",
    flexShrink:          0,
  },
  row2: {
    display:             "grid",
    gridTemplateColumns: "1fr 1fr",
    gap:                 "12px",
  },
  label: {
    fontSize:      "11px",
    fontWeight:    600,
    color:         "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  input: (err) => ({
    background:   "var(--surface-2)",
    border:       `1px solid ${err ? "var(--danger)" : "var(--border)"}`,
    borderRadius: "9px",
    color:        "var(--text)",
    fontSize:     "16px",   // 16px keeps iOS from zooming on focus
    padding:      "11px 12px",
    width:        "100%",
    boxSizing:    "border-box",
    outline:      "none",
  }),
  fieldErr: {
    fontSize: "11px",
    color:    "var(--danger)",
  },
  segment: {
    display:             "grid",
    gridTemplateColumns: "1fr 1fr",
    gap:                 "8px",
  },
  segmentBtn: (active, deposit) => ({
    borderRadius: "9px",
    fontSize:     "13px",
    fontWeight:   700,
    padding:      "11px 12px",
    cursor:       "pointer",
    background:   active ? (deposit ? GREEN_BG : RED_BG) : "var(--surface-2)",
    border:       `1px solid ${active ? (deposit ? GREEN_BORDER : RED_BORDER) : "var(--border)"}`,
    color:        active ? (deposit ? "var(--success-text)" : "#ef4444") : "var(--text-muted)",
  }),
  cancelBtn: {
    background:   "transparent",
    border:       "1px solid var(--border)",
    borderRadius: "9px",
    color:        "var(--text-muted)",
    fontSize:     "13px",
    fontWeight:   600,
    padding:      "12px 16px",
    cursor:       "pointer",
  },
  saveBtn: {
    background:   "var(--accent)",
    border:       "none",
    borderRadius: "9px",
    color:        "#fff",
    fontSize:     "13px",
    fontWeight:   700,
    padding:      "12px 16px",
    cursor:       "pointer",
  },
};
