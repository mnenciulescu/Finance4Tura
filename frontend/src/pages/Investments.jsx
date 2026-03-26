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
  listSP500,
} from "../api/investments";

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
  const rate = rates[currency]; // e.g. rates.USD = 1.08 means 1 EUR = 1.08 USD
  return rate ? amount / rate : amount;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Investments() {
  const [operations, setOperations] = useState([]);
  const [snapshots,  setSnapshots]  = useState([]);
  const [sp500,      setSP500]      = useState([]);
  const [fxRates,    setFxRates]    = useState(null); // rates from EUR base, e.g. { USD: 1.08, RON: 4.97 }
  const [fxStatus,   setFxStatus]   = useState("none"); // "none" | "buffered" | "updated"
  const [loading,    setLoading]    = useState(true);
  const [hidden,     setHidden]     = useState(new Set(PLATFORMS)); // start with platforms hidden; Total visible
  const [hiddenSim,  setHiddenSim]  = useState(new Set(PLATFORMS)); // sim chart: platforms hidden; Total+sim visible


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

    listSP500()
      .then(setSP500)
      .catch(() => {}); // non-critical — chart stays empty if unavailable

    // Apply cached rates immediately so the page renders without waiting for the network
    const FX_CACHE_KEY = "fxRates_EUR_USD_RON";
    const FX_TTL_MS    = 6 * 60 * 60 * 1000; // 6 hours
    try {
      const cached = JSON.parse(localStorage.getItem(FX_CACHE_KEY));
      if (cached?.rates && Date.now() - cached.ts < FX_TTL_MS) {
        setFxRates(cached.rates);
        setFxStatus("buffered");
      }
    } catch { /* ignore corrupt cache */ }

    // Fetch fresh rates in the background; update state + cache if they changed
    fetch("https://api.frankfurter.app/latest?from=EUR&to=USD,RON")
      .then(r => r.json())
      .then(d => {
        if (!d?.rates) return;
        setFxRates(d.rates);
        setFxStatus("updated");
        try {
          localStorage.setItem(FX_CACHE_KEY, JSON.stringify({ rates: d.rates, ts: Date.now() }));
        } catch { /* storage full or unavailable */ }
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

  // Testing chart: cumulative simulation — S&P 500 monthly growth + deposits/withdrawals.
  // First op-month point = startPortfolio. Each subsequent month: grow by S&P %, then
  // at operation months add/subtract cash flows (converted to EUR).
  const { data: testingChartData, years: testingChartYears, xMax: testingChartXMax } = useMemo(() => {
    if (!sp500.length) return { data: [], years: [] };

    const allSorted = [...sp500].sort((a, b) => a.monthId.localeCompare(b.monthId));
    const sp500Visible = allSorted.filter(d => d.monthId.slice(0, 4) >= "2023");

    // Extend chart to the last snapshot or operation date, whichever is later
    const lastSnapMonth  = snapshotsInEUR.length
      ? snapshotsInEUR.reduce((max, s) => s.date.slice(0, 7) > max ? s.date.slice(0, 7) : max, "")
      : "";
    const lastOpMonth = operations.length
      ? operations.reduce((max, op) => op.date.slice(0, 7) > max ? op.date.slice(0, 7) : max, "")
      : "";
    const targetEndMonth = [lastSnapMonth, lastOpMonth, sp500Visible.at(-1)?.monthId ?? ""]
      .filter(Boolean)
      .reduce((max, m) => m > max ? m : max, "");
    const lastSp500Month = sp500Visible.at(-1)?.monthId ?? "";
    const extraMonths = [];
    if (targetEndMonth > lastSp500Month) {
      let cur = dayjs(lastSp500Month + "-01").add(1, "month");
      const end = dayjs(targetEndMonth + "-01");
      while (!cur.isAfter(end)) {
        extraMonths.push({ monthId: cur.format("YYYY-MM"), close: null });
        cur = cur.add(1, "month");
      }
    }
    const visible = [...sp500Visible, ...extraMonths];

    const years = [...new Set(visible.map(d => d.monthId.slice(0, 4)))].sort();
    const baseYear = parseInt(years[0] ?? "2023");

    function dateToX(dateStr) {
      const [y, m, d] = dateStr.split("-").map(Number);
      const t = new Date(y, m - 1, d);
      const yearStart = new Date(y, 0, 1);
      const yearEnd   = new Date(y + 1, 0, 1);
      return (y - baseYear) + (t - yearStart) / (yearEnd - yearStart);
    }

    // Find startPortfolio (closest snapshot total in EUR to chart start)
    const chartStartMonth = visible[0]?.monthId ?? "2023-01";
    const totalByDate = {};
    snapshotsInEUR.forEach(s => {
      totalByDate[s.date] = (totalByDate[s.date] ?? 0) + s.amount;
    });
    const snapshotDates = Object.keys(totalByDate).sort();
    const refTime = new Date(chartStartMonth + "-01").getTime();
    const closestSnapDate = snapshotDates.length
      ? snapshotDates.reduce((best, d) =>
          Math.abs(new Date(d).getTime() - refTime) < Math.abs(new Date(best).getTime() - refTime) ? d : best
        )
      : null;
    const startPortfolio = closestSnapDate ? totalByDate[closestSnapDate] : null;
    if (startPortfolio == null) return { data: [], years };

    // Carry-forward portfolio total in EUR per month (for the actual portfolio line)
    const snapshotsByPlatform = {};
    snapshotsInEUR.forEach(s => {
      if (!snapshotsByPlatform[s.platform]) snapshotsByPlatform[s.platform] = [];
      snapshotsByPlatform[s.platform].push(s);
    });
    Object.values(snapshotsByPlatform).forEach(arr => arr.sort((a, b) => a.date.localeCompare(b.date)));
    function portfolioAt(monthId) {
      const endOfMonth = monthId + "-31";
      const total = PLATFORMS.reduce((sum, p) => {
        const arr = snapshotsByPlatform[p] ?? [];
        let latest = null;
        for (const s of arr) { if (s.date <= endOfMonth) latest = s; else break; }
        return sum + (latest?.amount ?? 0);
      }, 0);
      return total > 0 ? parseFloat(total.toFixed(2)) : null;
    }
    function platformAt(platform, monthId) {
      const endOfMonth = monthId + "-31";
      const arr = snapshotsByPlatform[platform] ?? [];
      let latest = null;
      for (const s of arr) { if (s.date <= endOfMonth) latest = s; else break; }
      return latest?.amount > 0 ? parseFloat(latest.amount.toFixed(2)) : null;
    }

    // Cash flows per month in EUR (deposits positive, withdrawals negative)
    const opCashByMonth = {};
    operations.forEach(op => {
      const month = op.date.slice(0, 7);
      const eur = toEUR(op.amount, op.currency, fxRates);
      opCashByMonth[month] = (opCashByMonth[month] ?? 0) + (op.type === "Withdrawal" ? -eur : eur);
    });
    const opMonths = new Set(operations.map(op => op.date.slice(0, 7)));

    let runningValue = startPortfolio;
    // Track last op-point context for the tooltip breakdown
    let lastOpValue = startPortfolio;   // portfolio value just after the last op point
    let lastOpClose = visible[0]?.close ?? 1; // S&P close at the last op point

    const data = visible.map((d, i) => {
      let spPct = null;
      let spGrowthSinceLastOp = null;
      let valueBeforeCash = null;
      let cashFlow = null;
      let prevOpValue = null;

      if (i > 0) {
        const prevClose = visible[i - 1].close;
        // Only apply S&P growth when both this month and previous have real close data
        if (prevClose > 0 && d.close != null) {
          spPct = parseFloat(((d.close - prevClose) / prevClose * 100).toFixed(2));
          runningValue = runningValue * (d.close / prevClose);
        }

        if (opMonths.has(d.monthId)) {
          // Capture snapshot for tooltip before touching runningValue with cash
          prevOpValue        = lastOpValue;
          spGrowthSinceLastOp = (lastOpClose > 0 && d.close != null)
            ? parseFloat(((d.close - lastOpClose) / lastOpClose * 100).toFixed(2))
            : null;
          valueBeforeCash = parseFloat(runningValue.toFixed(2));

          cashFlow = opCashByMonth[d.monthId] ?? 0;
          runningValue += cashFlow;

          // Advance last-op anchors
          lastOpValue = parseFloat(runningValue.toFixed(2));
          if (d.close != null) lastOpClose = d.close;
        }
      } else {
        // First month is the anchor (no growth applied yet)
        lastOpClose = d.close ?? 1;
      }

      const platformValues = Object.fromEntries(PLATFORMS.map(p => [p, platformAt(p, d.monthId)]));
      return {
        date: d.monthId,
        x: dateToX(d.monthId + "-01"),
        close: d.close,
        adjusted: d.close != null ? parseFloat(runningValue.toFixed(2)) : null,
        portfolio: portfolioAt(d.monthId),
        ...platformValues,
        spPct,
        spGrowthSinceLastOp,
        valueBeforeCash,
        prevOpValue,
        cashFlow,
        hasOp: opMonths.has(d.monthId),
        ops: operations.filter(op => op.date.slice(0, 7) === d.monthId),
      };
    });

    return { data, years, xMax: data.at(-1)?.x ?? years.length };
  }, [sp500, operations, snapshotsInEUR, fxRates]);

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

  function togglePlatform(p) {
    setHidden(prev => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  }

  function toggleSimLine(key) {
    setHiddenSim(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) return <div style={s.page}><p style={s.muted}>Loading…</p></div>;

  return (
    <div style={s.page}>

      {/* ── Top row: Current Holdings (30%) + S&P Simulation (70%) ─────────── */}
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
                  {fxStatus === "none"     && " · Getting rates…"}
                  {fxStatus === "buffered" && " · Buffered"}
                  {fxStatus === "updated"  && " · Updated FX rates."}
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
        {/* ── S&P Simulation ─────────────────────────────────────────────────── */}
        <Section title="Portfolio evolution">
        {testingChartData.length < 2 ? (
          <p style={s.muted}>S&P 500 data unavailable.</p>
        ) : (
          <>
          {/* Legend toggles */}
          <div style={s.legendRow}>
            {/* Portfolio total chip */}
            <button
              onClick={() => toggleSimLine(TOTAL_KEY)}
              style={{
                ...s.legendChip,
                opacity:         hiddenSim.has(TOTAL_KEY) ? 0.35 : 1,
                borderColor:     TOTAL_COLOR,
                color:           hiddenSim.has(TOTAL_KEY) ? "var(--text-muted)" : TOTAL_COLOR,
                backgroundColor: hiddenSim.has(TOTAL_KEY) ? "transparent" : `${TOTAL_COLOR}22`,
              }}
            >
              Portfolio total
            </button>
            {/* Individual platform chips */}
            {activePlatforms.map(p => (
              <button
                key={p}
                onClick={() => toggleSimLine(p)}
                style={{
                  ...s.legendChip,
                  opacity:         hiddenSim.has(p) ? 0.35 : 1,
                  borderColor:     PLATFORM_COLOR[p],
                  color:           hiddenSim.has(p) ? "var(--text-muted)" : PLATFORM_COLOR[p],
                  backgroundColor: hiddenSim.has(p) ? "transparent" : `${PLATFORM_COLOR[p]}18`,
                }}
              >
                {p}
              </button>
            ))}
            {/* S&P simulation chip */}
            <button
              onClick={() => toggleSimLine("adjusted")}
              style={{
                ...s.legendChip,
                opacity:         hiddenSim.has("adjusted") ? 0.35 : 1,
                borderColor:     "#f59e0b",
                color:           hiddenSim.has("adjusted") ? "var(--text-muted)" : "#f59e0b",
                backgroundColor: hiddenSim.has("adjusted") ? "transparent" : "#f59e0b22",
              }}
            >
              S&P simulation
            </button>
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
                const { date, adjusted, portfolio, spPct, spGrowthSinceLastOp, valueBeforeCash, prevOpValue, cashFlow, ops, hasOp } = payload[0].payload;
                const isOpPoint = hasOp && prevOpValue != null;
                const growthColor = v => v == null ? "var(--text-muted)" : v >= 0 ? "#22c55e" : "#ef4444";
                const cfColor = cashFlow == null ? "var(--text-muted)" : cashFlow >= 0 ? "#22c55e" : "#ef4444";
                const divider = <div style={{ borderTop: "1px solid var(--border)", margin: "6px 0" }} />;
                const row = (label, value, color, bold) => (
                  <div style={{ ...st.tooltipRow, color: color ?? "var(--text-muted)", fontWeight: bold ? 700 : 400, marginBottom: "2px" }}>
                    <span>{label}</span>
                    <span style={st.tooltipVal}>{value}</span>
                  </div>
                );
                return (
                  <div style={{ ...st.tooltip, minWidth: "260px" }}>
                    <div style={st.tooltipDate}>{date}</div>

                    {/* Actual portfolio line — always shown when data available */}
                    {portfolio != null && row("Portfolio (actual)", `${fmtNum(portfolio)} EUR`, TOTAL_COLOR, true)}

                    {isOpPoint ? (
                      // ── Operation-point breakdown ──────────────────────────
                      <>
                        {divider}
                        {row("① Value at last op-point", `${fmtNum(prevOpValue)} EUR`)}
                        {row(
                          "② S&P 500 growth since then",
                          `${spGrowthSinceLastOp >= 0 ? "+" : ""}${fmtNum(spGrowthSinceLastOp)}%`,
                          growthColor(spGrowthSinceLastOp),
                        )}
                        {row("③ After S&P growth", `${fmtNum(valueBeforeCash)} EUR`, "var(--text)")}
                        {divider}
                        {ops?.map((op, i) => (
                          <div key={i} style={{ ...st.tooltipRow, color: op.type === "Deposit" ? "#22c55e" : "#ef4444", marginBottom: "2px" }}>
                            <span>④ {op.type} · {op.platform}</span>
                            <span style={st.tooltipVal}>
                              {op.type === "Deposit" ? "+" : "−"}{fmtNum(op.amount)} {op.currency}
                            </span>
                          </div>
                        ))}
                        {row(
                          `${ops?.length > 1 ? "   " : ""}Net cash (EUR)`,
                          `${cashFlow >= 0 ? "+" : ""}${fmtNum(cashFlow)} EUR`,
                          cfColor,
                        )}
                        {divider}
                        {row("= S&P simulation", `${fmtNum(adjusted)} EUR`, "#f59e0b", true)}
                        <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
                          = ③ {cashFlow >= 0 ? "+" : "−"} net cash
                        </div>
                      </>
                    ) : (
                      // ── Non-operation month ────────────────────────────────
                      <>
                        {portfolio != null && divider}
                        {row("S&P simulation", `${fmtNum(adjusted)} EUR`, "#f59e0b", true)}
                        {spPct != null && row(
                          "S&P 500 this month",
                          `${spPct >= 0 ? "+" : ""}${fmtNum(spPct)}%`,
                          growthColor(spPct),
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
                  hide={hiddenSim.has(p)}
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
                hide={hiddenSim.has(TOTAL_KEY)}
                connectNulls={true}
              />
              {/* S&P simulation line */}
              <Line
                type="monotone"
                dataKey="adjusted"
                name="S&P simulation"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  if (!payload.hasOp) return null;
                  return <circle key={`dot-${payload.date}`} cx={cx} cy={cy} r={5} fill="#f59e0b" stroke="var(--card)" strokeWidth={2} />;
                }}
                activeDot={{ r: 5, fill: "#f59e0b" }}
                hide={hiddenSim.has("adjusted")}
              />
            </LineChart>
          </ResponsiveContainer>
          </>
        )}
        <p style={{ ...s.muted, marginTop: "6px", fontSize: "10px" }}>
          <span style={{ color: TOTAL_COLOR, fontWeight: 600 }}>■</span> Actual portfolio (EUR) &nbsp;
          <span style={{ color: "#f59e0b", fontWeight: 600 }}>■</span> S&P 500 simulation — same deposits invested in S&P 500 instead. Dots mark operation months.
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
                  <table style={{ ...s.table, minWidth: "600px" }}>
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
    flex: "0 0 calc(65% - 10px)",
    minWidth: 0,
  },
  bottomColRight: {
    flex: "0 0 calc(35% - 10px)",
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
    overflowX: "auto", borderRadius: "8px",
    border: "1px solid var(--border)",
  },
  table: {
    width: "100%", borderCollapse: "collapse", minWidth: "520px",
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
