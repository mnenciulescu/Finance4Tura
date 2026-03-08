import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import IncomeCard from "../components/IncomeCard";
import { listIncomes, deleteIncome } from "../api/incomes";
import { listExpenses, updateExpense, deleteExpense } from "../api/expenses";
import { useAuth } from "../context/AuthContext";
import { getPrivacySetting, setPrivacySetting } from "./Settings";
import useIsMobile from "../hooks/useIsMobile";

export default function Dashboard() {
  const { loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const [allIncomes, setAllIncomes]   = useState([]);
  const [startIdx, setStartIdx]       = useState(0);
  const [expenses, setExpenses]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [showAmounts, setShowAmounts]     = useState(getPrivacySetting());
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  useEffect(() => {
    // Wait for AuthContext to finish restoring the session before fetching
    if (authLoading) return;
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
  }, [authLoading]);

  const visibleCount = isMobile ? 1 : 4;
  const incomes = allIncomes.slice(startIdx, startIdx + visibleCount);
  const canGoLeft  = startIdx > 0;
  const canGoRight = startIdx + visibleCount < allIncomes.length;

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    // Only swipe when horizontal movement clearly dominates vertical
    if (Math.abs(dx) > 50 && Math.abs(dx) > dy * 1.5) {
      if (dx > 0 && canGoLeft)  setStartIdx(i => i - 1);
      else if (dx < 0 && canGoRight) setStartIdx(i => i + 1);
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const handleToggleStatus = (exp) => {
    const newStatus = exp.status === "Completed" ? "Pending" : "Completed";
    setExpenses(prev => prev.map(e => e.expenseId === exp.expenseId ? { ...e, status: newStatus } : e));
    updateExpense(exp.expenseId, { ...exp, status: newStatus })
      .catch(() => {
        setExpenses(prev => prev.map(e => e.expenseId === exp.expenseId ? { ...e, status: exp.status } : e));
      });
  };

  const handleDeleteExpense = (exp) => setPendingDelete(exp);

  const handleDeleteIncome = async (income, deleteSeries) => {
    // 1. Determine which incomes are being removed
    const removedIds = new Set(
      deleteSeries
        ? allIncomes.filter(i => i.seriesId === income.seriesId).map(i => i.incomeId)
        : [income.incomeId]
    );
    const removedList  = allIncomes.filter(i => removedIds.has(i.incomeId));
    const remaining    = allIncomes.filter(i => !removedIds.has(i.incomeId));

    // 2. For a given expense date, find the best remaining income (latest date ≤ expDate)
    const resolveFromRemaining = (expDate) =>
      remaining
        .filter(i => i.date <= expDate)
        .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;

    // 3. Remap affected expenses optimistically
    const prevExpenses = expenses;
    const remapped = expenses.map(e => {
      if (!removedIds.has(e.mappedIncomeId)) return e;
      const inc = resolveFromRemaining(e.date);
      return {
        ...e,
        mappedIncomeId:      inc?.incomeId  ?? null,
        mappedIncomeSummary: inc?.summary   ?? null,
        mappedIncomeDate:    inc?.date      ?? null,
      };
    });
    setExpenses(remapped);

    // 4. Update income list and startIdx
    const firstRemovedIdx = allIncomes.findIndex(i => removedIds.has(i.incomeId));
    setAllIncomes(remaining);
    setStartIdx(prev => Math.max(0, firstRemovedIdx < prev ? prev - removedIds.size : prev));

    try {
      // 5. Delete income(s) on the backend
      await deleteIncome(income.incomeId, deleteSeries ? { deleteSeries: "true" } : undefined);

      // 6. Persist remapped expenses
      const affected = prevExpenses.filter(e => removedIds.has(e.mappedIncomeId));
      await Promise.all(affected.map(e => {
        const inc = resolveFromRemaining(e.date);
        return updateExpense(e.expenseId, {
          ...e,
          mappedIncomeId:      inc?.incomeId  ?? null,
          mappedIncomeSummary: inc?.summary   ?? null,
          mappedIncomeDate:    inc?.date      ?? null,
        });
      }));
    } catch {
      // Revert both income list and expenses on failure
      setAllIncomes(allIncomes);
      setExpenses(prevExpenses);
    }
  };

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
      ) : isMobile ? (
        <div
          style={s.mobileRoot}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {incomes.map(income => (
            <IncomeCard
              key={income.incomeId}
              income={income}
              expenses={expensesByIncome[income.incomeId] ?? []}
              onToggleStatus={handleToggleStatus}
              onDeleteExpense={handleDeleteExpense}
              onDeleteIncome={handleDeleteIncome}
              showAmount={showAmounts}
              isMobile
            />
          ))}
        </div>
      ) : (
        <div style={s.navRow}>
          <div style={s.leftCol}>
            <button
              style={{ ...s.navArrow, flex: 1, opacity: canGoLeft ? 1 : 0.2, cursor: canGoLeft ? "pointer" : "default" }}
              onClick={() => canGoLeft && setStartIdx(i => i - 1)}
              aria-label="Previous month"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="11,4 6,9 11,14"/>
              </svg>
            </button>
            <button
              style={s.visToggle}
              onClick={() => setShowAmounts(v => { const next = !v; setPrivacySetting(next); return next; })}
              title={showAmounts ? "Hide income amounts" : "Show income amounts"}
            >
              {showAmounts ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/>
                  <circle cx="8" cy="8" r="2"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/>
                  <circle cx="8" cy="8" r="2"/>
                  <line x1="2" y1="2" x2="14" y2="14"/>
                </svg>
              )}
            </button>
          </div>
          <div style={s.cardRow}>
            {incomes.map(income => (
              <IncomeCard
                key={income.incomeId}
                income={income}
                expenses={expensesByIncome[income.incomeId] ?? []}
                onToggleStatus={handleToggleStatus}
                onDeleteExpense={handleDeleteExpense}
                onDeleteIncome={handleDeleteIncome}
                showAmount={showAmounts}
              />
            ))}
          </div>
          <button
            style={{ ...s.navArrow, alignSelf: "stretch", height: "auto", opacity: canGoRight ? 1 : 0.2, cursor: canGoRight ? "pointer" : "default" }}
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
  leftCol: {
    display:       "flex",
    flexDirection: "column",
    gap:           "8px",
    alignItems:    "center",
  },
  visToggle: {
    background:   "var(--surface-2)",
    border:       "1px solid var(--border)",
    borderRadius: "10px",
    color:        "var(--text-muted)",
    width:        "44px",
    height:       "44px",
    display:      "flex",
    alignItems:   "center",
    justifyContent: "center",
    cursor:       "pointer",
    flexShrink:   0,
  },
  navRow: {
    display:    "flex",
    alignItems: "stretch",
    flex:       1,
    minHeight:  0,
    gap:        "16px",
  },
  navArrow: {
    background:   "var(--surface-2)",
    border:       "1px solid var(--border)",
    borderRadius: "12px",
    color:        "var(--accent)",
    fontSize:     "28px",
    lineHeight:   1,
    width:        "44px",
    flexShrink:   0,
    alignSelf:    "center",
    height:       "75vh",
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
  mobileRoot: {
    display:       "flex",
    flexDirection: "column",
    flex:          1,
    minHeight:     0,
    padding:       "12px 12px 0",
  },
  errorBox: {
    background:   "var(--error-bg)",
    border:       "1px solid var(--danger)",
    borderRadius: "8px",
    color:        "var(--error-text)",
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
