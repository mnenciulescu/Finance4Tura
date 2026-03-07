import { Link } from "react-router-dom";

const PRIORITY_COLOR = { High: "#ef4444", Medium: "#f59e0b", Low: "#22c55e" };
const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };
const fmt = (n) => n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function IncomeCard({ income, expenses, onToggleStatus, onDeleteExpense }) {
  const { totalExpenses, totalPending } = expenses.reduce(
    (acc, e) => {
      acc.totalExpenses += e.amount ?? 0;
      if (e.status === "Pending") acc.totalPending += e.amount ?? 0;
      return acc;
    },
    { totalExpenses: 0, totalPending: 0 }
  );
  const balance = (income.amount ?? 0) - totalExpenses;
  const cur     = income.currency ?? "RON";

  return (
    <div style={s.card}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerTop}>
          <div style={s.headerLeft}>
            <div style={s.summaryRow}>
              <span style={s.summary} title={income.summary}>{income.summary}</span>
              <Link to={`/add-income?id=${income.incomeId}`} style={s.iconLink} title="Edit income">✎</Link>
            </div>
            <span style={s.date}>{income.date}</span>
            <span style={s.incomeAmount}>{cur} {fmt(income.amount ?? 0)}</span>
          </div>
          <Link to={`/add-expense?incomeId=${income.incomeId}&date=${income.date}`} style={s.addIcon} title="Add expense">＋</Link>
        </div>
      </div>

      {/* Expense list */}
      <div style={s.body}>
        {expenses.length === 0 ? (
          <div style={s.empty}>No expenses mapped</div>
        ) : (
          <ul style={s.list}>
            {expenses
              .slice()
              .sort((a, b) =>
                (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)
                || a.date.localeCompare(b.date)
              )
              .map(exp => (
                <li key={exp.expenseId} style={s.expenseRow}>
                  <div style={s.expenseLeft}>
                    <span
                      style={{ ...s.priorityDot, background: PRIORITY_COLOR[exp.priority] ?? "#6b7194" }}
                      title={`Priority: ${exp.priority}`}
                    />
                    <span style={s.expenseSummary} title={exp.summary}>{exp.summary}</span>
                    <span style={s.expenseDate}>{exp.date.slice(5)}</span>
                  </div>
                  <div style={s.expenseRight}>
                    <span style={s.expenseAmount}>{fmt(exp.amount ?? 0)}</span>
                    <span
                      style={{ ...s.statusBadge, ...(exp.status === "Completed" ? s.statusDone : s.statusPending), cursor: "pointer" }}
                      title={exp.status === "Completed" ? "Mark as Pending" : "Mark as Completed"}
                      onClick={() => onToggleStatus?.(exp)}
                    >
                      {exp.status === "Completed" ? "✓" : "○"}
                    </span>
                    <Link to={`/add-expense?id=${exp.expenseId}`} style={s.editLink} title="Edit expense">✎</Link>
                    <button style={s.deleteBtn} title="Delete expense" onClick={() => onDeleteExpense?.(exp)}>🗑</button>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>

      {/* Footer summary */}
      <div style={s.footer}>
        <div style={s.footerRow}>
          <span style={s.footerLabel}>Income</span>
          <span style={s.footerValue}>{cur} {fmt(income.amount ?? 0)}</span>
        </div>
        <div style={s.footerRow}>
          <span style={s.footerLabel}>Expenses</span>
          <span style={{ ...s.footerValue, color: totalExpenses > 0 ? "#fca5a5" : "var(--text)" }}>
            − {cur} {fmt(totalExpenses)}
          </span>
        </div>
        <div style={s.footerRow}>
          <span style={s.footerLabel}>Pending</span>
          <span style={{ ...s.footerValue, color: totalPending > 0 ? "#fcd34d" : "var(--text-muted)" }}>
            {cur} {fmt(totalPending)}
          </span>
        </div>
        <div style={{ ...s.footerRow, ...s.footerBalance }}>
          <span style={s.footerLabel}>Balance</span>
          <span style={{ ...s.footerValue, color: balance >= 0 ? "#86efac" : "#fca5a5" }}>
            {cur} {fmt(balance)}
          </span>
        </div>
      </div>
    </div>
  );
}

const s = {
  card: {
    width:         "var(--card-w)",
    flexShrink:    0,
    background:    "var(--surface)",
    border:        "1px solid var(--border)",
    borderRadius:  "12px",
    display:       "flex",
    flexDirection: "column",
    overflow:      "hidden",
    minHeight:     0,
  },
  header: {
    padding:      "8px 12px",
    borderBottom: "1px solid var(--border)",
  },
  headerTop: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    gap:            "8px",
  },
  headerLeft: {
    display:       "flex",
    flexDirection: "column",
    gap:           "1px",
    overflow:      "hidden",
    flex:          1,
  },
  summaryRow: {
    display:    "flex",
    alignItems: "center",
    gap:        "4px",
  },
  summary: {
    fontWeight:   600,
    fontSize:     "13px",
    color:        "var(--text)",
    overflow:     "hidden",
    textOverflow: "ellipsis",
    whiteSpace:   "nowrap",
  },
  date: {
    fontSize: "11px",
    color:    "var(--text-muted)",
  },
  incomeAmount: {
    fontSize:   "12px",
    color:      "#86efac",
    fontWeight: 600,
  },
  iconLink: {
    color:          "var(--text-muted)",
    fontSize:       "14px",
    textDecoration: "none",
    lineHeight:     1,
  },
  addIcon: {
    color:          "var(--accent)",
    fontSize:       "22px",
    textDecoration: "none",
    lineHeight:     1,
    fontWeight:     300,
  },
  body: {
    flex:      1,
    overflowY: "auto",
    minHeight: 0,
    padding:   "8px 0",
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
    fontSize:     "10px",
    padding:      "1px 5px",
    borderRadius: "10px",
    fontWeight:   600,
  },
  statusDone: {
    background: "#052e16",
    color:      "#86efac",
    border:     "1px solid #22c55e44",
  },
  statusPending: {
    background: "#1c1400",
    color:      "#fcd34d",
    border:     "1px solid #f59e0b44",
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
    padding:       "12px 16px",
    borderTop:     "1px solid var(--border)",
    display:       "flex",
    flexDirection: "column",
    gap:           "5px",
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
};
