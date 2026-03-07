import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import IncomeCard from "../components/IncomeCard";
import { listIncomes } from "../api/incomes";
import { listExpenses, updateExpense, deleteExpense } from "../api/expenses";

export default function Dashboard() {
  const [incomes, setIncomes]         = useState([]);
  const [expenses, setExpenses]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null); // expense awaiting confirmation

  useEffect(() => {
    Promise.all([listIncomes(), listExpenses()])
      .then(([inc, exp]) => {
        setIncomes([...inc].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4).reverse());
        setExpenses(exp);
      })
      .catch(() => setError("Failed to load data. Is the API running?"))
      .finally(() => setLoading(false));
  }, []);

  const handleToggleStatus = (exp) => {
    const newStatus = exp.status === "Completed" ? "Pending" : "Completed";
    // Optimistic update
    setExpenses(prev => prev.map(e => e.expenseId === exp.expenseId ? { ...e, status: newStatus } : e));
    updateExpense(exp.expenseId, { ...exp, status: newStatus })
      .catch(() => {
        // Revert on failure
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
  cardRow: {
    display:         "flex",
    gap:             "16px",
    overflowX:       "auto",
    alignItems:      "stretch",
    justifyContent:  "center",
    flex:            1,
    minHeight:       0,
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
