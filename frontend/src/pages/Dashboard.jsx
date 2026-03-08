import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import IncomeCard from "../components/IncomeCard";
import { listIncomes } from "../api/incomes";
import { listExpenses, updateExpense, deleteExpense } from "../api/expenses";

export default function Dashboard() {
  const [allIncomes, setAllIncomes]   = useState([]);
  const [startIdx, setStartIdx]       = useState(0);
  const [expenses, setExpenses]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null); // expense awaiting confirmation

  useEffect(() => {
    Promise.all([listIncomes(), listExpenses()])
      .then(([inc, exp]) => {
        const today = new Date().toISOString().slice(0, 10);
        const sorted = [...inc].sort((a, b) => a.date.localeCompare(b.date));
        const currentIdx = sorted.reduce((found, _, idx) =>
          sorted[idx].date <= today ? idx : found, -1);
        setAllIncomes(sorted);
        setStartIdx(currentIdx === -1 ? 0 : currentIdx);
        setExpenses(exp);
      })
      .catch(() => setError("Failed to load data. Is the API running?"))
      .finally(() => setLoading(false));
  }, []);

  const incomes = allIncomes.slice(startIdx, startIdx + 4);
  const canGoLeft  = startIdx > 0;
  const canGoRight = startIdx + 4 < allIncomes.length;

  const handleToggleStatus = (exp) => {
    const newStatus = exp.status === "Completed" ? "Pending" : "Completed";
    setExpenses(prev => prev.map(e => e.expenseId === exp.expenseId ? { ...e, status: newStatus } : e));
    updateExpense(exp.expenseId, { ...exp, status: newStatus })
      .catch(() => {
        setExpenses(prev => prev.map(e => e.expenseId === exp.expenseId ? { ...e, status: exp.status } : e));
      });
  };

  const handleDeleteExpense = (exp) => setPendingDelete(exp);

  const confirmDelete = (deleteSeries) => {
    const exp = pendingDelete;
    setPendingDelete(null);
    if (deleteSeries) {
      setExpenses(prev => prev.filter(e => e.seriesId !== exp.seriesId));
      deleteExpense(exp.expenseId, { deleteSeries: "true" })
        .catch(() => setExpenses(prev => [...prev, exp]));
    } else {
      setExpenses(prev => prev.filter(e => e.expenseId !== exp.expenseId));
      deleteExpense(exp.expenseId)
        .catch(() => setExpenses(prev => [...prev, exp]));
    }
  };

  const expensesByIncome = useMemo(() => expenses.reduce((acc, exp) => {
    const key = exp.mappedIncomeId ?? "__unmapped__";
    if (!acc[key]) acc[key] = [];
    acc[key].push(exp);
    return acc;
  }, {}), [expenses]);

  return (
    <div style={s.root}>
      {pendingDelete && (
        <div style={s.overlay}>
          <div style={s.dialog}>
            {pendingDelete.isRepeatable ? (
              <>
                <p style={s.dialogTitle}>Delete recurring expense?</p>
                <p style={s.dialogBody}>
                  <strong style={{ color: "var(--text)" }}>{pendingDelete.summary}</strong> is part of a recurring series. What would you like to delete?
                </p>
                <div style={s.dialogActions}>
                  <button style={s.btnCancel} onClick={() => setPendingDelete(null)}>Cancel</button>
                  <button style={s.btnDeleteSoft} onClick={() => confirmDelete(false)}>This occurrence</button>
                  <button style={s.btnDelete} onClick={() => confirmDelete(true)}>Entire series</button>
                </div>
              </>
            ) : (
              <>
                <p style={s.dialogTitle}>Delete expense?</p>
                <p style={s.dialogBody}>
                  <strong style={{ color: "var(--text)" }}>{pendingDelete.summary}</strong> will be permanently removed. This cannot be undone.
                </p>
                <div style={s.dialogActions}>
                  <button style={s.btnCancel} onClick={() => setPendingDelete(null)}>Cancel</button>
                  <button style={s.btnDelete} onClick={() => confirmDelete(false)}>Delete</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {error && <div style={s.errorBox}>{error}</div>}

      {loading ? (
        <div style={s.center}><p style={s.muted}>Loading…</p></div>
      ) : incomes.length === 0 ? (
        <div style={s.center}>
          <p style={s.muted}>No incomes yet.</p>
          <Link to="/add-income" style={s.btnPrimary}>Add your first income</Link>
        </div>
      ) : (
        <div style={s.navRow}>
          <button
            style={{ ...s.navArrow, opacity: canGoLeft ? 1 : 0.2, cursor: canGoLeft ? "pointer" : "default" }}
            onClick={() => canGoLeft && setStartIdx(i => i - 1)}
            aria-label="Previous month"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="11,4 6,9 11,14"/>
            </svg>
          </button>
          <div style={s.cardRow}>
            {incomes.map(income => (
              <IncomeCard
                key={income.incomeId}
                income={income}
                expenses={expensesByIncome[income.incomeId] ?? []}
                onToggleStatus={handleToggleStatus}
                onDeleteExpense={handleDeleteExpense}
              />
            ))}
          </div>
          <button
            style={{ ...s.navArrow, opacity: canGoRight ? 1 : 0.2, cursor: canGoRight ? "pointer" : "default" }}
            onClick={() => canGoRight && setStartIdx(i => i + 1)}
            aria-label="Next month"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="7,4 12,9 7,14"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

const s = {
  root: {
    display:       "flex",
    flexDirection: "column",
    flex:          1,
    minHeight:     0,
  },
  navRow: {
    display:    "flex",
    alignItems: "stretch",
    flex:       1,
    minHeight:  0,
    gap:        "16px",
  },
  navArrow: {
    background:   "rgba(134,239,172,0.07)",
    border:       "1px solid rgba(134,239,172,0.2)",
    borderRadius: "12px",
    color:        "rgba(134,239,172,0.7)",
    fontSize:     "28px",
    lineHeight:   1,
    width:        "44px",
    flexShrink:   0,
    alignSelf:    "stretch",
    display:      "flex",
    alignItems:   "center",
    justifyContent: "center",
    transition:   "background 0.15s, border-color 0.15s, opacity 0.15s",
    userSelect:   "none",
  },
  cardRow: {
    display:    "flex",
    gap:        "16px",
    alignItems: "stretch",
    flex:       1,
    minHeight:  0,
    minWidth:   0,
  },
  center: {
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    minHeight:      "300px",
    gap:            "12px",
  },
  muted: { color: "var(--text-muted)", fontSize: "14px" },
  btnPrimary: {
    background:     "var(--accent)",
    color:          "#fff",
    border:         "none",
    borderRadius:   "8px",
    padding:        "8px 18px",
    fontWeight:     600,
    fontSize:       "13px",
    textDecoration: "none",
  },
  errorBox: {
    background:   "#3b1212",
    border:       "1px solid var(--danger)",
    borderRadius: "8px",
    color:        "#fca5a5",
    padding:      "12px 16px",
    fontSize:     "13px",
    marginBottom: "20px",
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
