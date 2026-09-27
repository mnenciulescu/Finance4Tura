import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import { listIncomes } from "../api/incomes";
import { listExpenses, updateExpense } from "../api/expenses";
import { listSplitPayments, updateSplitPayment } from "../api/splitPayments";
import { listBooks } from "../api/booksAndDev";
import { listSnapshots } from "../api/investments";
import { getFxRates } from "../api/fxRates";
import {
  PRIORITY_COLORS as PRIORITY_COLOR,
  PRIORITY_FALLBACK,
  BAR_COLORS as BAR_COLOR,
  PLATFORM_COLORS as PLATFORM_COLOR,
  TYPE_COLORS,
} from "../utils/colors";
import { T, TYPE } from "../components/tokens";
import {
  Card, SectionHeader, StatTile, Pill, StatusDot, Checkbox, ProgressBar,
} from "../components/ui";

// ── Investment constants (shared with Investments page) ────────────────────────
const PLATFORMS = ["eToro", "Binance", "Fidelity", "Tradeville", "ING Funds RON", "ING Funds EUR"];
function toEUR(amount, currency, rates) {
  if (!rates || currency === "EUR") return amount;
  const row = rates[currency];
  // New matrix form: rates[FROM][TO], so rates[currency].EUR = value of 1 CUR in EUR
  if (row && typeof row === "object" && row.EUR != null) return amount * row.EUR;
  // Legacy flat form (base EUR): rates.USD = 1 EUR in USD
  if (typeof row === "number") return amount / row;
  return amount;
}

const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const monthParts = (dateStr) => {
  const [y, m, d] = dateStr.split("-");
  const month = new Date(+y, +m - 1, 1).toLocaleString("en-US", { month: "short" }).toUpperCase();
  return { month, day: String(+d), year: y };
};
const getDow = (dateStr) =>
  DOW[new Date(Date.UTC(...dateStr.split("-").map((v, i) => i === 1 ? +v - 1 : +v))).getUTCDay()];
const fmtDec = (n) => n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n) => Math.round(n).toLocaleString("ro-RO");

// ── Small reusable pieces ──────────────────────────────────────────────────────

function EmptyState({ children }) {
  return (
    <div style={{ ...TYPE.label, color: T.muted, padding: "var(--sp-3) 0" }}>
      {children}
    </div>
  );
}

// ── Section 1: Pending Expenses ────────────────────────────────────────────────

function PendingExpenses({ incomes, expenses, onToggle }) {
  const today = dayjs().format("YYYY-MM-DD");

  const currentIncome = useMemo(() => {
    const past = incomes.filter(i => i.date <= today);
    if (past.length === 0) return null;
    return past.reduce((best, i) => i.date > best.date ? i : best);
  }, [incomes, today]);

  // Every expense mapped to this income, not just the outstanding ones.
  // Priority then date — the same order IncomeCard uses on the Finance
  // Dashboard. Status is deliberately not part of the sort: keying on it made
  // rows jump position the moment one was ticked.
  const items = useMemo(() => {
    if (!currentIncome) return [];
    return expenses
      .filter(e => e.mappedIncomeId === currentIncome.incomeId)
      .slice()
      .sort((a, b) =>
        (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)
        || a.date.localeCompare(b.date)
      );
  }, [expenses, currentIncome]);

  const { doneTotal, pendingTotal } = useMemo(() => {
    let doneTotal = 0, pendingTotal = 0;
    for (const e of items) {
      const amt = Number(e.amount) || 0;
      if (e.status === "Completed") doneTotal += amt;
      else                          pendingTotal += amt;
    }
    return { doneTotal, pendingTotal };
  }, [items]);
  const total = doneTotal + pendingTotal;

  if (!currentIncome) {
    return (
      <Card>
        <span style={{ ...TYPE.label, color: T.muted }}>No current income period found.</span>
      </Card>
    );
  }

  const { month, day, year } = monthParts(currentIncome.date);
  const dow = getDow(currentIncome.date);
  const cur = items[0]?.currency || "";

  return (
    <Card style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", flex: 1 }}>

      {/* Hero header — the one gradient element on the screen. No stripe and no
          divider rule: the gradient itself separates it from the list. */}
      <div style={st.hero}>
        <div style={st.heroTop}>
          <span style={st.heroDate}>{month} {day} {year} · {dow}</span>
          <Pill>Expenses</Pill>
        </div>
        <span style={st.heroTitle}>{currentIncome.summary}</span>
      </div>

      {/* Expense list */}
      <div style={{ flex: 1, padding: "var(--sp-2) var(--sp-2)" }}>
        {items.length === 0 ? (
          <div style={{ ...TYPE.label, color: T.muted, padding: "var(--sp-3) var(--sp-2)" }}>
            No expenses for this period.
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--sp-1)" }}>
            {items.map(exp => {
              const isDone = exp.status === "Completed";
              return (
                <li key={exp.expenseId} style={{
                  ...st.row,
                  // A special expense keeps its own tint, now a dusty terracotta
                  // wash rather than the previous alarm red.
                  ...(exp.special && !isDone ? { background: "var(--error-bg)" } : {}),
                  ...(isDone ? { opacity: 0.6 } : {}),
                }}>
                  <Checkbox
                    checked={isDone}
                    onChange={() => onToggle?.(exp)}
                    title={isDone ? "Mark as Pending" : "Mark as Completed"}
                  />
                  <div style={st.rowMain}>
                    <div style={st.rowTop}>
                      <StatusDot color={PRIORITY_COLOR[exp.priority] ?? PRIORITY_FALLBACK} />
                      {exp.special && <span style={st.star}>★</span>}
                      <span
                        title={exp.summary}
                        style={{
                          ...st.name,
                          ...(isDone
                            ? { color: T.dim, textDecoration: "line-through", textDecorationColor: T.dim }
                            : { textDecoration: "none" }),
                        }}
                      >
                        {exp.summary}
                      </span>
                    </div>
                    <span style={st.rowDate}>{exp.date.slice(5)}</span>
                  </div>
                  <span style={{
                    ...st.amount,
                    ...(isDone
                      ? { color: T.dim, textDecoration: "line-through", textDecorationColor: T.dim }
                      : { textDecoration: "none" }),
                  }}>
                    {fmtDec(exp.amount ?? 0)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer — the bar carries proportion only; the figures sit in tiles
          below it, where they are legible regardless of segment width. */}
      {total > 0 && (
        <div style={st.footer}>
          <ProgressBar
            height={12}
            segments={[
              { key: "done",    value: doneTotal,    color: BAR_COLOR.done,    title: `Done ${fmtDec(doneTotal)}` },
              { key: "pending", value: pendingTotal, color: BAR_COLOR.pending, title: `Pending ${fmtDec(pendingTotal)}` },
            ]}
          />
          <div style={st.tiles}>
            <StatTile
              value={fmtInt(doneTotal)}
              label="Done"
              tone="raised"
              dot={BAR_COLOR.done}
              style={{ flex: 1 }}
            />
            <StatTile
              value={fmtInt(pendingTotal)}
              label="Pending"
              tone="accent"
              style={{ flex: 1 }}
            />
          </div>
          <div style={st.totalRow}>
            <span style={{ ...TYPE.caption, color: T.muted }}>Total</span>
            <span style={st.totalValue}>{fmtDec(total)} {cur}</span>
          </div>
        </div>
      )}
    </Card>
  );
}

const st = {
  hero: {
    background: T.heroGrad,
    padding:    "var(--sp-4) var(--sp-4) var(--sp-5)",
    display:        "flex",
    flexDirection:  "column",
    gap:            "var(--sp-2)",
  },
  heroTop: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    gap:            "var(--sp-2)",
  },
  heroDate: {
    ...TYPE.overline,
    color: "var(--on-hero)",
  },
  heroTitle: {
    ...TYPE.h2,
    color:        "var(--on-hero)",
    overflow:     "hidden",
    textOverflow: "ellipsis",
    whiteSpace:   "nowrap",
  },
  row: {
    display:      "flex",
    alignItems:   "center",
    gap:          "var(--sp-3)",
    minHeight:    "52px",
    padding:      "var(--sp-2) var(--sp-3)",
    borderRadius: "var(--r-md)",
  },
  rowMain: {
    display:       "flex",
    flexDirection: "column",
    gap:           "1px",
    flex:          1,
    minWidth:      0,
  },
  rowTop: {
    display:    "flex",
    alignItems: "center",
    gap:        "var(--sp-2)",
    minWidth:   0,
  },
  name: {
    ...TYPE.body,
    fontWeight:   500,
    color:        T.text,
    overflow:     "hidden",
    textOverflow: "ellipsis",
    whiteSpace:   "nowrap",
  },
  rowDate: {
    ...TYPE.caption,
    color: T.muted,
  },
  star: {
    fontSize:   "11px",
    color:      T.overdue,
    flexShrink: 0,
    lineHeight: 1,
  },
  amount: {
    ...TYPE.bodyNum,
    color:      T.text,
    flexShrink: 0,
    marginLeft: "var(--sp-2)",
  },
  footer: {
    display:       "flex",
    flexDirection: "column",
    gap:           "var(--sp-3)",
    padding:       "var(--sp-3) var(--sp-4) var(--sp-4)",
  },
  tiles: {
    display: "flex",
    gap:     "var(--sp-3)",
  },
  totalRow: {
    display:        "flex",
    alignItems:     "baseline",
    justifyContent: "space-between",
  },
  totalValue: {
    ...TYPE.h3,
    color:              T.text,
    fontVariantNumeric: "tabular-nums",
  },
};

// ── Section 2: Split Payments ──────────────────────────────────────────────────

function SplitPaymentsTable({ payments, onUpdate }) {
  const debounceTimers = useRef({});

  const latest3 = useMemo(() =>
    [...payments]
      // Only payments that are not fully paid (incomplete occurrences)
      .filter(p => {
        const occs = p.occurrences || [];
        const paidCount = occs.filter(o => o.value !== "" && o.value != null).length;
        return paidCount < p.occurrenceCount;
      })
      .sort((a, b) => (b.createdDate || "").localeCompare(a.createdDate || ""))
      .slice(0, 3),
    [payments]
  );

  function updateOcc(entry, occIdx, value) {
    const updated = {
      ...entry,
      occurrences: entry.occurrences.map((o, i) => i !== occIdx ? o : { ...o, value }),
    };
    onUpdate(updated);
    const key = `${entry.splitPaymentId}-${occIdx}`;
    clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(() => {
      updateSplitPayment(entry.splitPaymentId, { occurrences: updated.occurrences }).catch(console.error);
    }, 600);
  }

  if (latest3.length === 0) return <EmptyState>No pending split payments.</EmptyState>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
      {latest3.map(entry => {
        const isAmount  = entry.occurrenceType === "amount";
        const occs      = entry.occurrences || [];
        const paidCount = occs.filter(o => o.value !== "" && o.value != null).length;
        const isFull    = paidCount === entry.occurrenceCount;
        return (
          // A nested tile on the card, carrying no stroke of its own.
          <div key={entry.splitPaymentId} style={sp.tile}>
            <div style={sp.head}>
              <span style={sp.title}>{entry.title}</span>
              <Pill tone={isFull ? "done" : "default"}>
                {paidCount}/{entry.occurrenceCount}{isFull ? " ✓" : ""}
              </Pill>
            </div>
            <div style={sp.meta}>
              <span style={{ ...TYPE.label, color: T.muted }}>{entry.createdDate}</span>
              <span style={sp.amount}>
                {Number(entry.totalAmount).toLocaleString("ro-RO")} {entry.currency}
              </span>
            </div>

            {/* Installment slots */}
            <div style={sp.slots}>
              {Array.from({ length: entry.occurrenceCount || occs.length }, (_, i) => {
                const occ = occs[i];
                if (!occ) return null;
                const hasPaid = occ.value !== "" && occ.value != null;
                return (
                  <div key={i} style={sp.slot}>
                    <span style={sp.slotIdx}>#{i + 1}</span>
                    <input
                      type={isAmount ? "number" : "date"}
                      value={occ.value ?? ""}
                      min={isAmount ? "0" : undefined}
                      step={isAmount ? "any" : undefined}
                      placeholder={isAmount ? "0.00" : undefined}
                      aria-label={`${entry.title} — installment ${i + 1}`}
                      onChange={e => updateOcc(entry, i, e.target.value)}
                      style={{
                        ...sp.slotInput,
                        width:      isAmount ? "78px" : "132px",
                        background: hasPaid ? T.accent : T.raisedHi,
                        color:      hasPaid ? T.onAccent : T.text,
                        fontWeight: hasPaid ? 700 : 500,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const sp = {
  tile: {
    background:    T.raised,
    borderRadius:  T.rMd,
    padding:       "var(--sp-3)",
    display:       "flex",
    flexDirection: "column",
    gap:           "var(--sp-2)",
  },
  head: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    gap:            "var(--sp-2)",
  },
  title: {
    ...TYPE.h3,
    color:        T.text,
    overflow:     "hidden",
    textOverflow: "ellipsis",
    whiteSpace:   "nowrap",
    minWidth:     0,
  },
  meta: {
    display:        "flex",
    alignItems:     "baseline",
    justifyContent: "space-between",
    gap:            "var(--sp-2)",
  },
  amount: {
    ...TYPE.label,
    fontWeight:         700,
    color:              T.accent,
    fontVariantNumeric: "tabular-nums",
  },
  slots: {
    display:  "flex",
    flexWrap: "wrap",
    gap:      "var(--sp-2)",
  },
  slot: {
    display:    "flex",
    alignItems: "center",
    gap:        "var(--sp-1)",
  },
  slotIdx: {
    ...TYPE.caption,
    fontWeight: 700,
    color:      T.muted,
    flexShrink: 0,
  },
  slotInput: {
    height:             "36px",
    padding:            "0 var(--sp-2)",
    borderRadius:       T.rSm,
    border:             "none",
    fontSize:           "13px",
    fontFamily:         "inherit",
    fontVariantNumeric: "tabular-nums",
    boxSizing:          "border-box",
    transition:         "background 150ms ease-out, color 150ms ease-out",
  },
};

// ── Section 3: Current Holdings ───────────────────────────────────────────────

function CurrentHoldings({ snapshots, fxRates, fxUpdatedAt }) {
  const [revealed, setRevealed] = useState(false);

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

  const rawLatestByPlatform = useMemo(() => {
    const result = {};
    for (const s of snapshots) {
      if (!result[s.platform] || s.date > result[s.platform].date) result[s.platform] = s;
    }
    return result;
  }, [snapshots]);

  const activePlatforms = useMemo(() => {
    const cutoff = dayjs().subtract(12, "month").format("YYYY-MM-DD");
    return PLATFORMS.filter(p =>
      snapshots.some(s => s.platform === p && s.date >= cutoff && s.amount > 0)
    );
  }, [snapshots]);

  const totalEUR = useMemo(() =>
    Object.values(latestByPlatform).reduce((sum, s) => sum + (s?.amount ?? 0), 0),
    [latestByPlatform]
  );

  const fmtAmt = (n) => (n ?? 0).toLocaleString("ro-RO", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const mask = "••••";

  if (snapshots.length === 0) {
    return <EmptyState>No investment snapshots yet.</EmptyState>;
  }

  return (
    <div>
      {/* Total card */}
      <div style={{
        background: T.raised, borderRadius: T.rMd,
        padding: "var(--sp-3) var(--sp-4)", marginBottom: "var(--sp-3)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sp-3)",
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...TYPE.caption, color: T.muted, textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: "2px" }}>
            Total Portfolio
          </div>
          <div style={{ ...TYPE.h2, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: T.text }}>
            {revealed ? fmtAmt(totalEUR) : mask}
          </div>
          <div style={{ ...TYPE.caption, color: T.muted, marginTop: "1px" }}>
            EUR
            {fxUpdatedAt
              ? <span style={{ marginLeft: "4px", opacity: 0.7 }}>· FX {dayjs(fxUpdatedAt).format("YYYY-MM-DD")}</span>
              : <span style={{ marginLeft: "4px", opacity: 0.7 }}>· No FX rates</span>}
          </div>
        </div>
        {/* Reveal button — hold to show */}
        <button
          onMouseDown={() => setRevealed(true)}
          onMouseUp={() => setRevealed(false)}
          onMouseLeave={() => setRevealed(false)}
          onTouchStart={() => setRevealed(true)}
          onTouchEnd={() => setRevealed(false)}
          title="Hold to reveal amounts"
          style={{
            width: "44px", height: "44px", flexShrink: 0,
            background: revealed ? T.accent : T.surface,
            border: "none", borderRadius: "50%",
            color: revealed ? T.onAccent : T.muted,
            display: "flex", alignItems: "center", justifyContent: "center",
            userSelect: "none",
          }}
        >
          <svg viewBox="0 0 18 14" width="16" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            {revealed ? (
              <>
                <path d="M1 7 C4 1 14 1 17 7 C14 13 4 13 1 7" />
                <circle cx="9" cy="7" r="2.8" />
              </>
            ) : (
              <>
                <path d="M1 7 C4 1 14 1 17 7 C14 13 4 13 1 7" />
                <circle cx="9" cy="7" r="2.8" />
                <line x1="2" y1="1" x2="16" y2="13" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Platform table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
        <thead>
          <tr>
            <th style={{ ...TYPE.caption, textAlign: "left", padding: "var(--sp-1) var(--sp-2)", color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.2px", borderBottom: `1px solid ${T.line}` }}>Platform</th>
            <th style={{ ...TYPE.caption, textAlign: "right", padding: "var(--sp-1) var(--sp-2)", color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.2px", borderBottom: `1px solid ${T.line}` }}>EUR</th>
            <th style={{ ...TYPE.caption, textAlign: "right", padding: "var(--sp-1) var(--sp-2)", color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.2px", borderBottom: `1px solid ${T.line}` }}>Updated</th>
          </tr>
        </thead>
        <tbody>
          {activePlatforms.map(p => {
            const snap    = latestByPlatform[p];
            const rawSnap = rawLatestByPlatform[p];
            const showOrig = rawSnap && rawSnap.currency !== "EUR";
            return (
              <tr key={p} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "6px 6px", verticalAlign: "middle" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: PLATFORM_COLOR[p], flexShrink: 0, display: "inline-block" }} />
                    <span style={{ fontWeight: 600, color: "var(--text)", fontSize: "12px" }}>{p}</span>
                  </span>
                </td>
                <td style={{ padding: "6px 6px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "var(--text)", verticalAlign: "middle" }}>
                  {snap ? (revealed ? fmtAmt(snap.amount) : mask) : "—"}
                  {showOrig && snap && (
                    <div style={{ fontSize: "10px", fontWeight: 400, color: "var(--text-muted)", marginTop: "1px" }}>
                      {revealed ? `${fmtAmt(rawSnap.amount)} ${rawSnap.currency}` : mask}
                    </div>
                  )}
                </td>
                <td style={{ padding: "6px 6px", textAlign: "right", color: "var(--text-muted)", fontSize: "11px", verticalAlign: "middle" }}>
                  {snap ? snap.date : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Section 4: Books & Development ────────────────────────────────────────────

const BOOK_TYPES = ["Book", "Audiobook", "Training", "Other"];

function BooksSnippet({ books }) {
  // latest entry per (person, type) — keyed as `${person}|${type}`
  const latestByPersonType = useMemo(() => {
    const map = {};
    for (const b of books) {
      const key = `${b.name || "Unknown"}|${b.type || "Other"}`;
      if (!map[key] || (b.dateCompleted || "") > (map[key].dateCompleted || "")) {
        map[key] = b;
      }
    }
    return map;
  }, [books]);

  const persons = useMemo(() =>
    [...new Set(books.map(b => b.name || "Unknown"))].sort(),
    [books]
  );

  // only show types that have at least one entry, sorted by most recent dateCompleted desc
  const activeTypes = useMemo(() => {
    const latestDateByType = {};
    for (const b of books) {
      const t = b.type || "Other";
      if ((b.dateCompleted || "") > (latestDateByType[t] || "")) {
        latestDateByType[t] = b.dateCompleted || "";
      }
    }
    return BOOK_TYPES
      .filter(t => latestDateByType[t] !== undefined)
      .sort((a, b) => (latestDateByType[b] || "").localeCompare(latestDateByType[a] || ""));
  }, [books]);

  if (books.length === 0) {
    return <EmptyState>No books or trainings yet.</EmptyState>;
  }

  const thStyle = {
    ...TYPE.caption, padding: "var(--sp-1) var(--sp-2)", fontWeight: 700,
    color: T.muted, textTransform: "uppercase",
    letterSpacing: "1.2px", borderBottom: `1px solid ${T.line}`,
    textAlign: "center", whiteSpace: "nowrap",
  };
  const tdTypeStyle = {
    padding: "5px 8px", fontSize: "10px", fontWeight: 600,
    borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
    verticalAlign: "middle",
  };
  const tdStyle = {
    padding: "5px 8px", borderBottom: "1px solid var(--border)",
    verticalAlign: "top", minWidth: 0,
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", tableLayout: "fixed" }}>
        <thead>
          <tr>
            {/* Type column header (empty — types are row headers) */}
            <th style={{ ...thStyle, width: "70px", textAlign: "left" }} />
            {persons.map(p => (
              <th key={p} style={thStyle}>{p}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activeTypes.map(type => {
            const typeColor = TYPE_COLORS[type] || TYPE_COLORS.Other;
            return (
              <tr key={type}>
                {/* Row header — type badge */}
                <td style={tdTypeStyle}>
                  <span style={{
                    ...TYPE.caption, fontWeight: 700, padding: "3px 9px",
                    borderRadius: T.rPill, background: typeColor.bg, color: typeColor.text,
                    display: "inline-block",
                  }}>
                    {type}
                  </span>
                </td>
                {persons.map(person => {
                  const entry = latestByPersonType[`${person}|${type}`];
                  return (
                    <td key={person} style={tdStyle}>
                      {entry ? (
                        <div>
                          <div style={{
                            fontSize: "11px", color: "var(--text)", fontWeight: 500,
                            overflow: "hidden", textOverflow: "ellipsis",
                            display: "-webkit-box", WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            lineHeight: "1.35",
                          }} title={entry.title}>
                            {entry.title}
                          </div>
                          {entry.dateCompleted && (
                            <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>
                              {entry.dateCompleted}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function HomeOverview() {
  const [incomes,   setIncomes]   = useState([]);
  const [expenses,  setExpenses]  = useState([]);
  const [payments,  setPayments]  = useState([]);
  const [books,     setBooks]     = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [fxRates,   setFxRates]   = useState(null);
  const [fxUpdatedAt, setFxUpdatedAt] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    // Load the shared FX rates stored in the database (updated by admin only)
    getFxRates()
      .then(({ rates, updatedAt }) => {
        if (rates) setFxRates(rates);
        setFxUpdatedAt(updatedAt ?? null);
      })
      .catch(() => {});

    Promise.all([
      listIncomes(),
      listExpenses(),
      listSplitPayments(),
      listBooks(),
      listSnapshots(),
    ])
      .then(([inc, exp, pay, bks, snaps]) => {
        setIncomes(inc);
        setExpenses(exp);
        setPayments(pay);
        setBooks(bks);
        setSnapshots(snaps);
      })
      .catch(e => setError(e?.message || "Failed to load data."))
      .finally(() => setLoading(false));
  }, []);

  async function handleToggleExpense(exp) {
    // Completed rows are listed now, so this flips both ways.
    const next = exp.status === "Completed" ? "Pending" : "Completed";
    setExpenses(prev => prev.map(e => e.expenseId === exp.expenseId ? { ...e, status: next } : e));
    try {
      await updateExpense(exp.expenseId, { ...exp, status: next });
    } catch {
      setExpenses(prev => prev.map(e => e.expenseId === exp.expenseId ? { ...e, status: exp.status } : e));
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: T.muted, ...TYPE.body }}>
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: T.overdue, ...TYPE.body }}>
        {error}
      </div>
    );
  }

  return (
    // Mobile-width single-column layout, rendered even on desktop. Blocks stack
    // one after another in a centered, phone-width column at their natural
    // content height; the surrounding page (main) scrolls to reveal them.
    <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "var(--sp-4)" }}>
      <div style={{ width: "100%", maxWidth: "var(--app-max-w)", display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>

        {/* Section 1 — Pending Expenses */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <PendingExpenses incomes={incomes} expenses={expenses} onToggle={handleToggleExpense} />
        </div>

        {/* Section 2 — Split Payments */}
        <Card style={{ boxSizing: "border-box", overflow: "hidden" }}>
          <SectionHeader
            action={
              <Link to="/split-payments" style={{ ...TYPE.label, color: T.accent, fontWeight: 700, whiteSpace: "nowrap" }}>
                View all →
              </Link>
            }
          >
            Split Payments — Last 3
          </SectionHeader>
          <SplitPaymentsTable
            payments={payments}
            onUpdate={updated => setPayments(prev => prev.map(p => p.splitPaymentId === updated.splitPaymentId ? updated : p))}
          />
        </Card>

        {/* Section 3 — Current Holdings */}
        <Card style={{ boxSizing: "border-box", overflow: "hidden" }}>
          <SectionHeader>Current Holdings</SectionHeader>
          <CurrentHoldings snapshots={snapshots} fxRates={fxRates} fxUpdatedAt={fxUpdatedAt} />
        </Card>

        {/* Section 4 — Books & Development */}
        <Card style={{ boxSizing: "border-box", overflow: "hidden" }}>
          <SectionHeader>Books & Development — Latest per Person</SectionHeader>
          <BooksSnippet books={books} />
        </Card>

      </div>
    </div>
  );
}
