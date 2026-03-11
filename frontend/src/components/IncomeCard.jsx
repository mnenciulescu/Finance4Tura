import { useState } from "react";
import { Link } from "react-router-dom";

const PRIORITY_COLOR = { High: "#ef4444", Medium: "#f59e0b", Low: "#22c55e" };
const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };
const BAR_COLOR = { total: "#7c75e0", done: "#bbf7d0", pending: "#f59e0b", free: "#22c55e", over: "#ef4444" };
const fmt    = (n) => n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n) => Math.round(n).toLocaleString("ro-RO");
const monthParts = (dateStr) => {
  const [y, m, d] = dateStr.split("-");
  const month = new Date(+y, +m - 1, 1).toLocaleString("en-US", { month: "short" }).toUpperCase();
  return { month, day: String(+d), year: y };
};

export default function IncomeCard({ income, expenses, onToggleStatus, onDeleteExpense, onDeleteIncome, showAmount = false, isMobile = false, isCurrent = false  }) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const isSeriesMember = income.seriesId && income.seriesId !== income.incomeId;
  const { totalCompleted, totalPending } = expenses.reduce(
    (acc, e) => {
      if (e.status === "Completed") acc.totalCompleted += e.amount ?? 0;
      else                          acc.totalPending   += e.amount ?? 0;
      return acc;
    },
    { totalCompleted: 0, totalPending: 0 }
  );
  const totalExpenses = totalCompleted + totalPending;
  const balance = (income.amount ?? 0) - totalExpenses;
  const cur     = income.currency ?? "RON";

  return (
    <div style={{ ...s.card, ...(isMobile ? { flex: 1, width: "100%" } : {}) }}>
      {/* Header */}
      <div style={{ ...s.header, ...(isCurrent ? s.headerCurrent : {}) }}>
        {/* Top accent strip */}
        <div style={s.accentStrip} />

        <div style={{ ...s.headerRow, padding: isMobile ? "7px 10px 9px" : "10px 12px 12px" }}>
          {/* Row 1: date badge + current pill + add */}
          <div style={s.headerTop}>
            {(() => { const { month, day, year } = monthParts(income.date); return (
              <div style={s.dateBadge}>
                <span style={{ ...s.badgeMonth, fontSize: isMobile ? "17px" : "13px" }}>{month}</span>
                <span style={{ ...s.badgeDay,   fontSize: isMobile ? "17px" : "13px" }}>{day}</span>
                <span style={{ ...s.badgeYear,  fontSize: isMobile ? "15px" : "12px" }}>{year}</span>
              </div>
            ); })()}
            <Link to={`/add-expense?incomeId=${income.incomeId}&date=${income.date}`} style={{ ...s.addBtn, fontSize: isMobile ? "13px" : "11px", padding: isMobile ? "5px 12px" : "3px 8px" }} title="Add expense">
              <svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="7" y1="2" x2="7" y2="12"/>
                <line x1="2" y1="7" x2="12" y2="7"/>
              </svg>
              Add
            </Link>
          </div>

          {/* Row 2: income name + delete + edit + hidden amount */}
          <div style={s.summaryRow}>
            <span style={{ ...s.summary, fontSize: isMobile ? "15px" : "13px" }} title={income.summary}>{income.summary}</span>
            <button style={s.deleteIncomeBtn} title="Delete income" onClick={() => setShowDeleteDialog(true)}>
              <svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1,3 13,3"/>
                <path d="M4,3V2a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1V3"/>
                <rect x="2" y="3" width="10" height="10" rx="1"/>
                <line x1="5.5" y1="6" x2="5.5" y2="10"/>
                <line x1="8.5" y1="6" x2="8.5" y2="10"/>
              </svg>
            </button>
            <Link to={`/add-income?id=${income.incomeId}`} style={s.iconLink} title="Edit income">
              <svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.5 1.5l3 3L4 13H1v-3L9.5 1.5z"/>
              </svg>
            </Link>
            <span style={{ flex: 1 }} />
            <span style={{ ...s.headerAmount, fontSize: isMobile ? "14px" : "11px", color: showAmount ? "var(--header-amount-text)" : "transparent" }}>
              {fmt(income.amount ?? 0)} {cur}
            </span>
          </div>

        </div>
      </div>

      {/* Expense list */}
      <div style={s.body}>
        {expenses.length === 0 ? (
          <div style={{ ...s.empty, fontSize: isMobile ? "14px" : "12px" }}>No expenses mapped</div>
        ) : (
          <ul style={s.list}>
            {expenses
              .slice()
              .sort((a, b) =>
                (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)
                || a.date.localeCompare(b.date)
              )
              .map(exp => (
                <li key={exp.expenseId} style={{ ...s.expenseRow, padding: isMobile ? "11px 16px" : "7px 16px", ...(exp.special ? s.expenseRowSpecial : {}) }}>
                  <div style={s.expenseLeft}>
                    <span
                      style={{ ...s.statusBadge, ...(exp.status === "Completed" ? s.statusDone : s.statusPending), cursor: "pointer", width: isMobile ? "18px" : "14px", height: isMobile ? "18px" : "14px", fontSize: isMobile ? "12px" : "10px" }}
                      title={exp.status === "Completed" ? "Mark as Pending" : "Mark as Completed"}
                      onClick={() => onToggleStatus?.(exp)}
                    >
                      {exp.status === "Completed" ? "✓" : ""}
                    </span>
                    <span
                      style={{ ...s.priorityDot, background: PRIORITY_COLOR[exp.priority] ?? "#6b7194", width: isMobile ? "9px" : "7px", height: isMobile ? "9px" : "7px" }}
                      title={`Priority: ${exp.priority}`}
                    />
                    {exp.special && (
                      <span style={{ ...s.specialStar, fontSize: isMobile ? "12px" : "10px" }} title="Special">★</span>
                    )}
                    <span style={{ ...s.expenseSummary, fontSize: isMobile ? "15px" : "12px" }} title={exp.summary}>{exp.summary}</span>
                    <span style={{ ...s.expenseDate, fontSize: isMobile ? "12px" : "10px" }}>{exp.date.slice(5)}</span>
                  </div>
                  <div style={s.expenseRight}>
                    <span style={{ ...s.expenseAmount, fontSize: isMobile ? "15px" : "12px" }}>{fmt(exp.amount ?? 0)}</span>
                    <Link to={`/add-expense?id=${exp.expenseId}`} style={{ ...s.editLink, fontSize: isMobile ? "16px" : "13px" }} title="Edit expense">✎</Link>
                    <button style={{ ...s.deleteBtn, fontSize: isMobile ? "14px" : "11px" }} title="Delete expense" onClick={() => onDeleteExpense?.(exp)}>🗑</button>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>

      {/* Footer summary */}
      <div style={s.footer}>
        {income.amount > 0 && (() => {
          const total      = income.amount;
          const overBudget = totalExpenses > total;
          const freeColor  = overBudget ? BAR_COLOR.over : BAR_COLOR.free;
          const safeBalance = Math.max(0, balance);

          // Each segment gets at least MIN fraction of its container so labels always fit
          const MIN = 0.14;

          // Outer: spent column vs free column
          let pctSpentN, pctFreeN;
          if (overBudget) {
            pctSpentN = 1; pctFreeN = 0;
          } else {
            const rawS = total > 0 ? totalExpenses / total : 0;
            const rawF = total > 0 ? safeBalance   / total : 1;
            const adjS = Math.max(rawS, MIN);
            const adjF = Math.max(rawF, MIN);
            const sum  = adjS + adjF;
            pctSpentN  = adjS / sum;
            pctFreeN   = adjF / sum;
          }

          // Inner: completed vs pending within spent column
          const rawC = totalExpenses > 0 ? totalCompleted / totalExpenses : 0;
          const rawP = totalExpenses > 0 ? totalPending   / totalExpenses : 0;
          const adjC = Math.max(rawC, MIN);
          const adjP = Math.max(rawP, MIN);
          const innerSum = adjC + adjP;
          const pctCompN = adjC / innerSum;
          const pctPendN = adjP / innerSum;

          const lbl = { ...s.barSegLabel, fontSize: isMobile ? "12px" : "10px" };
          return (
            <div style={s.barWrap}>
              <div style={{ ...s.dualBar, height: isMobile ? "68px" : "58px" }}>
                {/* Left spent column — stacked top/bottom */}
                <div style={{ display: "flex", flexDirection: "column", width: `${pctSpentN * 100}%`, minWidth: "72px", height: "100%" }}>
                  {/* Top row: total expenses */}
                  <div style={s.dualBarTop}>
                    <div style={{ ...s.dualBarTotal, width: "100%" }}>
                      <span style={lbl}>{fmtInt(totalExpenses)}</span>
                    </div>
                  </div>
                  {/* Bottom row: completed + pending */}
                  <div style={s.dualBarBottom}>
                    <div style={{ ...s.dualBarCompleted, width: `${pctCompN * 100}%` }}>
                      <span style={lbl}>{fmtInt(totalCompleted)}</span>
                    </div>
                    <div style={{ ...s.dualBarPending, width: `${pctPendN * 100}%` }}>
                      <span style={{ ...s.barSegLabel, fontSize: isMobile ? "15px" : "13px" }}>{fmtInt(totalPending)}</span>
                    </div>
                  </div>
                </div>
                {/* Right free column — spans full height (merged) */}
                {pctFreeN > 0 && (
                  <div style={{ ...s.dualBarFree, width: `${pctFreeN * 100}%`, background: freeColor }}>
                    <span style={{ ...s.barSegLabel, fontSize: isMobile ? "15px" : "13px" }}>{fmtInt(safeBalance)}</span>
                  </div>
                )}
              </div>
              <div style={s.legend}>
                <span style={{ ...s.legendItem, fontSize: isMobile ? "12px" : "10px" }}><span style={{ ...s.legendDot, background: BAR_COLOR.total   }}/> Total</span>
                <span style={{ ...s.legendItem, fontSize: isMobile ? "12px" : "10px" }}><span style={{ ...s.legendDot, background: BAR_COLOR.done    }}/> Done</span>
                <span style={{ ...s.legendItem, fontSize: isMobile ? "12px" : "10px" }}><span style={{ ...s.legendDot, background: BAR_COLOR.pending }}/> Pending</span>
                <span style={{ ...s.legendItem, fontSize: isMobile ? "12px" : "10px" }}><span style={{ ...s.legendDot, background: freeColor          }}/> {overBudget ? "Over" : "Free"}</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Income delete dialog */}
      {showDeleteDialog && (
        <div style={s.overlay}>
          <div style={s.dialog}>
            {isSeriesMember ? (
              <>
                <p style={s.dialogTitle}>Delete recurring income?</p>
                <p style={s.dialogBody}>
                  <strong style={{ color: "var(--text)" }}>{income.summary}</strong> is part of a recurring series. What would you like to delete?
                </p>
                <div style={s.dialogActions}>
                  <button style={s.btnCancel} onClick={() => setShowDeleteDialog(false)}>Cancel</button>
                  <button style={s.btnDeleteSoft} onClick={() => { setShowDeleteDialog(false); onDeleteIncome?.(income, false); }}>This occurrence</button>
                  <button style={s.btnDelete}     onClick={() => { setShowDeleteDialog(false); onDeleteIncome?.(income, true);  }}>Entire series</button>
                </div>
              </>
            ) : (
              <>
                <p style={s.dialogTitle}>Delete income?</p>
                <p style={s.dialogBody}>
                  <strong style={{ color: "var(--text)" }}>{income.summary}</strong> will be permanently removed. This cannot be undone.
                </p>
                <div style={s.dialogActions}>
                  <button style={s.btnCancel} onClick={() => setShowDeleteDialog(false)}>Cancel</button>
                  <button style={s.btnDelete}  onClick={() => { setShowDeleteDialog(false); onDeleteIncome?.(income, false); }}>Delete</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  card: {
    flex:          "0 0 calc(25% - 12px)",
    minWidth:      0,
    background:    "var(--surface)",
    border:        "1px solid var(--border)",
    borderRadius:  "12px",
    display:       "flex",
    flexDirection: "column",
    overflow:      "hidden",
    minHeight:     0,
  },
  header: {
    borderBottom: "1px solid var(--border)",
    background:   "var(--surface-2)",
    overflow:     "hidden",
  },
  headerCurrent: {
    background:   "var(--header-current-bg)",
    borderBottom: "1px solid var(--header-current-border)",
  },
  accentStrip: {
    height:     "3px",
    background: "linear-gradient(90deg, var(--accent), rgba(134,239,172,0.2))",
  },
  headerRow: {
    display:       "flex",
    flexDirection: "column",
    gap:           "6px",
    padding:       "10px 12px 12px",
    overflow:      "hidden",
  },
  headerTop: {
    display:    "flex",
    alignItems: "center",
    gap:        "7px",
  },
  dateBadge: {
    display:    "flex",
    alignItems: "center",
    gap:        "5px",
    flex:       1,
    lineHeight: 1,
  },
  badgeMonth: {
    fontSize:      "13px",
    fontWeight:    800,
    color:         "var(--badge-text)",
    letterSpacing: "0.08em",
  },
  badgeDay: {
    fontSize:      "13px",
    fontWeight:    800,
    color:         "var(--badge-text)",
    letterSpacing: "0.04em",
  },
  badgeYear: {
    fontSize:      "12px",
    fontWeight:    500,
    color:         "var(--badge-text-muted)",
    letterSpacing: "0.04em",
  },
  summary: {
    fontWeight:   600,
    fontSize:     "13px",
    color:        "var(--text)",
    overflow:     "hidden",
    textOverflow: "ellipsis",
    whiteSpace:   "nowrap",
  },
  iconLink: {
    color:          "var(--text-muted)",
    textDecoration: "none",
    lineHeight:     1,
    flexShrink:     0,
    display:        "flex",
    alignItems:     "center",
    opacity:        0.6,
  },
  summaryRow: {
    display:     "flex",
    alignItems:  "center",
    gap:         "8px",
    overflow:    "hidden",
  },
  headerAmount: {
    fontSize:           "11px",
    fontWeight:         600,
    letterSpacing:      "0.04em",
    textAlign:          "right",
    fontVariantNumeric: "tabular-nums",
    whiteSpace:         "nowrap",
    flexShrink:         0,
    transition:         "color 0.2s",
    userSelect:         "none",
  },
  addBtn: {
    display:        "flex",
    alignItems:     "center",
    gap:            "4px",
    background:     "rgba(134,239,172,0.1)",
    border:         "1px solid rgba(134,239,172,0.25)",
    borderRadius:   "6px",
    color:          "var(--accent)",
    fontSize:       "11px",
    fontWeight:     600,
    padding:        "3px 8px",
    textDecoration: "none",
    flexShrink:     0,
    whiteSpace:     "nowrap",
  },
  body: {
    flex:             1,
    overflowY:        "auto",
    minHeight:        0,
    padding:          "8px 0",
    overscrollBehavior: "contain",
    WebkitOverflowScrolling: "touch",
  },
  empty: {
    color:      "var(--text-muted)",
    fontSize:   "12px",
    fontStyle:  "italic",
    padding:    "24px 16px",
    textAlign:  "center",
  },
  list: {
    listStyle: "none",
    margin:    0,
    padding:   0,
  },
  expenseRow: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    padding:        "7px 16px",
    borderBottom:   "1px solid var(--border)",
    gap:            "8px",
  },
  expenseRowSpecial: {
    background: "rgba(185,28,28,0.12)",
  },
  expenseLeft: {
    display:    "flex",
    alignItems: "center",
    gap:        "7px",
    overflow:   "hidden",
    flex:       1,
  },
  priorityDot: {
    width:        "7px",
    height:       "7px",
    borderRadius: "50%",
    flexShrink:   0,
  },
  expenseSummary: {
    fontSize:     "12px",
    color:        "var(--text)",
    overflow:     "hidden",
    textOverflow: "ellipsis",
    whiteSpace:   "nowrap",
  },
  expenseDate: {
    fontSize:   "10px",
    color:      "var(--text-muted)",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  expenseRight: {
    display:    "flex",
    alignItems: "center",
    gap:        "6px",
    flexShrink: 0,
  },
  expenseAmount: {
    fontSize: "12px",
    color:    "var(--text)",
    fontVariantNumeric: "tabular-nums",
  },
  statusBadge: {
    display:        "inline-flex",
    alignItems:     "center",
    justifyContent: "center",
    width:          "14px",
    height:         "14px",
    borderRadius:   "3px",
    fontWeight:     700,
    fontSize:       "10px",
    flexShrink:     0,
    transition:     "background 0.15s, border-color 0.15s",
  },
  statusDone: {
    background: "var(--accent)",
    color:      "#fff",
    border:     "1px solid var(--accent)",
  },
  statusPending: {
    background: "var(--surface)",
    color:      "transparent",
    border:     "1px solid var(--border)",
  },
  deleteBtn: {
    background: "none",
    border:     "none",
    padding:    0,
    cursor:     "pointer",
    fontSize:   "11px",
    lineHeight: 1,
    opacity:    0.45,
    color:      "var(--danger)",
  },
  footer: {
    padding:   "10px 12px 12px",
    borderTop: "1px solid var(--border)",
  },
  footerRow: {
    display:        "flex",
    justifyContent: "space-between",
    fontSize:       "12px",
  },
  footerBalance: {
    fontWeight: 600,
    paddingTop: "6px",
    borderTop:  "1px solid var(--border)",
    marginTop:  "2px",
    fontSize:   "13px",
  },
  footerLabel: { color: "var(--text-muted)" },
  footerValue: { color: "var(--text)", fontVariantNumeric: "tabular-nums" },
  barWrap: {
    display:       "flex",
    flexDirection: "column",
    gap:           "6px",
  },
  dualBar: {
    display:      "flex",
    height:       "44px",
    borderRadius: "6px",
    overflow:     "hidden",
    background:   "var(--surface-2)",
    gap:          "2px",
  },
  dualBarTop: {
    display:      "flex",
    flex:         1,
    borderBottom: "2px solid var(--surface-2)",
  },
  dualBarBottom: {
    display: "flex",
    flex:    3,
    gap:     "2px",
  },
  dualBarTotal: {
    height:         "100%",
    background:     BAR_COLOR.total,
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    overflow:       "hidden",
  },
  dualBarCompleted: {
    height:         "100%",
    minWidth:       "34px",
    background:     BAR_COLOR.done,
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    overflow:       "hidden",
    transition:     "width 0.5s ease",
  },
  dualBarPending: {
    height:         "100%",
    minWidth:       "34px",
    background:     BAR_COLOR.pending,
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    overflow:       "hidden",
    transition:     "width 0.5s ease",
  },
  dualBarFree: {
    height:         "100%",
    minWidth:       "34px",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    overflow:       "hidden",
    transition:     "width 0.5s ease",
  },
  barSegLabel: {
    fontSize:           "9px",
    fontWeight:         700,
    color:              "var(--bar-label)",
    whiteSpace:         "nowrap",
    padding:            "0 6px",
    fontVariantNumeric: "tabular-nums",
    letterSpacing:      "0.02em",
  },
  legend: {
    display:    "flex",
    gap:        "10px",
    flexWrap:   "wrap",
  },
  legendItem: {
    display:    "flex",
    alignItems: "center",
    gap:        "4px",
    fontSize:   "9px",
    fontWeight: 500,
    color:      "var(--text-muted)",
  },
  legendDot: {
    width:        "8px",
    height:       "8px",
    borderRadius: "2px",
    flexShrink:   0,
  },
  specialStar: {
    color:      "#a855f7",
    lineHeight: 1,
    flexShrink: 0,
  },
  deleteIncomeBtn: {
    background: "none",
    border:     "none",
    padding:    0,
    cursor:     "pointer",
    display:    "flex",
    alignItems: "center",
    color:      "var(--danger)",
    opacity:    0.55,
    flexShrink: 0,
  },
  overlay: {
    position:       "fixed",
    inset:          0,
    background:     "rgba(0,0,0,0.6)",
    backdropFilter: "blur(2px)",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    zIndex:         200,
  },
  dialog: {
    background:   "var(--surface)",
    border:       "1px solid var(--border)",
    borderRadius: "14px",
    padding:      "28px 32px",
    width:        "100%",
    maxWidth:     "380px",
    boxShadow:    "0 8px 40px rgba(0,0,0,0.5)",
  },
  dialogTitle: {
    fontSize:     "16px",
    fontWeight:   700,
    color:        "var(--text)",
    marginBottom: "10px",
  },
  dialogBody: {
    fontSize:     "13px",
    color:        "var(--text-muted)",
    lineHeight:   1.6,
    marginBottom: "24px",
  },
  dialogActions: {
    display:        "flex",
    justifyContent: "flex-end",
    gap:            "10px",
  },
  btnCancel: {
    background:   "transparent",
    color:        "var(--text-muted)",
    border:       "1px solid var(--border)",
    borderRadius: "8px",
    padding:      "8px 20px",
    fontWeight:   500,
    fontSize:     "13px",
    cursor:       "pointer",
  },
  btnDeleteSoft: {
    background:   "transparent",
    color:        "var(--danger)",
    border:       "1px solid var(--danger)",
    borderRadius: "8px",
    padding:      "8px 20px",
    fontWeight:   500,
    fontSize:     "13px",
    cursor:       "pointer",
  },
  btnDelete: {
    background:   "var(--danger)",
    color:        "#fff",
    border:       "none",
    borderRadius: "8px",
    padding:      "8px 20px",
    fontWeight:   600,
    fontSize:     "13px",
    cursor:       "pointer",
  },
};
