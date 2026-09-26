import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import IncomeCard from "../components/IncomeCard";
import { listIncomes, deleteIncome } from "../api/incomes";
import { listExpenses, updateExpense, deleteExpense } from "../api/expenses";
import { useAuth } from "../context/AuthContext";
import { useYear } from "../context/YearContext";
import { getPrivacySetting, setPrivacySetting } from "./Settings";

export default function Dashboard() {
  const { loading: authLoading } = useAuth();
  const { selectedYear, setSelectedYear, setAvailableYears } = useYear();
  const [allIncomes, setAllIncomes]   = useState([]);
  const [startIdx, setStartIdx]       = useState(0);
  const [expenses, setExpenses]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [showAmounts, setShowAmounts]     = useState(getPrivacySetting());
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const location = useLocation();
  const pendingRestoreRef = useRef(location.state?.returnStartIdx ?? null);
  const thisYear = new Date().getFullYear();

  // Incomes filtered to the selected year
  const yearIncomes = useMemo(() =>
    allIncomes.filter(i => i.date.startsWith(String(selectedYear))),
    [allIncomes, selectedYear]
  );

  // Index of the "current" column within yearIncomes
  const yearCurrentIdx = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return yearIncomes.reduce((found, _, idx) =>
      yearIncomes[idx].date <= today ? idx : found, -1);
  }, [yearIncomes]);

  const activeStartIdx = yearCurrentIdx === -1 ? 0 : yearCurrentIdx;

  // Reset to first relevant column when logo is clicked
  useEffect(() => {
    if (!location.state?.resetDashboard || yearIncomes.length === 0) return;
    setStartIdx(activeStartIdx);
  }, [location.state?.resetDashboard]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset startIdx whenever the selected year changes. Skip when we're about to
  // restore a saved position (handled by the effect below).
  useEffect(() => {
    if (pendingRestoreRef.current !== null) return;
    setStartIdx(activeStartIdx);
  }, [selectedYear, yearCurrentIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // After data finishes loading, apply a saved column position (from navigating back after add/edit).
  useEffect(() => {
    if (pendingRestoreRef.current === null || loading) return;
    const maxIdx = Math.max(0, yearIncomes.length - 1);
    setStartIdx(Math.min(pendingRestoreRef.current, maxIdx));
    pendingRestoreRef.current = null;
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Wait for AuthContext to finish restoring the session before fetching
    if (authLoading) return;
    Promise.all([listIncomes(), listExpenses()])
      .then(([inc, exp]) => {
        const sorted = [...inc].sort((a, b) => a.date.localeCompare(b.date));
        const years = [...new Set(sorted.map(i => i.date.slice(0, 4)))].map(Number);
        const curYear = new Date().getFullYear();
        if (!years.includes(curYear)) years.push(curYear);
        setAvailableYears(years.sort((a, b) => a - b));
        setAllIncomes(sorted);
        setExpenses(exp);
      })
      .catch(() => setError("Failed to load data. Is the API running?"))
      .finally(() => setLoading(false));
  }, [authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const safeStart  = Math.max(0, Math.min(startIdx, yearIncomes.length - 1));
  const atCurrent  = safeStart === activeStartIdx;
  const incomes    = yearIncomes.slice(safeStart, safeStart + 1);
  const canGoLeft  = safeStart > 0;
  const canGoRight = safeStart + 1 < yearIncomes.length;

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

      {/* Year switching and the privacy toggle used to live in the desktop
          chrome; the page owns them now. The year writes to the same context
          Statistics reads, so the two stay in sync. */}
      <div style={s.header}>
        <div style={s.yearNav}>
          <button style={s.yearBtn} onClick={() => setSelectedYear(y => y - 1)} title="Previous year">‹</button>
          <span style={s.yearValue}>{selectedYear}</span>
          <button
            style={{ ...s.yearBtn, ...(selectedYear >= thisYear ? s.yearBtnOff : {}) }}
            onClick={() => selectedYear < thisYear && setSelectedYear(y => y + 1)}
            disabled={selectedYear >= thisYear}
            title="Next year"
          >›</button>
        </div>

        {/* Stepping between income periods. Swiping the card only works with a
            touch screen, so a mouse had no way to move between them. The middle
            button returns to the current period. */}
        {yearIncomes.length > 1 && (
          <div style={s.incomeNav}>
            <button
              style={{ ...s.incomeBtn, ...(canGoLeft ? {} : s.yearBtnOff) }}
              onClick={() => canGoLeft && setStartIdx(i => i - 1)}
              disabled={!canGoLeft}
              title="Previous income"
              aria-label="Previous income"
            >←</button>
            <button
              style={{ ...s.incomeBtn, ...(atCurrent ? s.yearBtnOff : { color: "var(--accent)" }) }}
              onClick={() => !atCurrent && setStartIdx(activeStartIdx)}
              disabled={atCurrent}
              title="Go to the current income"
              aria-label="Go to the current income"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7">
                <circle cx="8" cy="8" r="6" />
                <circle cx="8" cy="8" r="2" fill="currentColor" stroke="none" />
              </svg>
            </button>
            <button
              style={{ ...s.incomeBtn, ...(canGoRight ? {} : s.yearBtnOff) }}
              onClick={() => canGoRight && setStartIdx(i => i + 1)}
              disabled={!canGoRight}
              title="Next income"
              aria-label="Next income"
            >→</button>
          </div>
        )}

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

      {error && <div style={s.errorBox}>{error}</div>}

      {loading ? (
        <div style={s.center}><p style={s.muted}>Loading…</p></div>
      ) : incomes.length === 0 ? (
        <div style={s.center}>
          <p style={s.muted}>No incomes yet.</p>
          <Link to="/add-income" style={s.btnPrimary}>Add your first income</Link>
        </div>
      ) : (
        <div
          style={s.mobileRoot}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {incomes.map((income, i) => (
            <IncomeCard
              key={income.incomeId}
              income={income}
              expenses={expensesByIncome[income.incomeId] ?? []}
              onToggleStatus={handleToggleStatus}
              onDeleteExpense={handleDeleteExpense}
              onDeleteIncome={handleDeleteIncome}
              showAmount={showAmounts}
              isCurrent={safeStart + i === yearCurrentIdx}
              dashboardStartIdx={safeStart}
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
  header: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    gap:            "12px",
    flexShrink:     0,
    padding:        "10px 12px",
    borderBottom:   "1px solid var(--border)",
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
    color:   "var(--text-muted)",
    opacity: 0.35,
    cursor:  "default",
  },
  incomeNav: {
    display:      "flex",
    alignItems:   "center",
    gap:          "2px",
    flexShrink:   0,
    background:   "var(--surface-2)",
    border:       "1px solid var(--border)",
    borderRadius: "9px",
    padding:      "3px",
  },
  // Wider than the year stepper: these get used far more often, and 46px
  // clears the 44px touch-target guideline.
  incomeBtn: {
    width:          "46px",
    height:         "34px",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    background:     "transparent",
    border:         "none",
    borderRadius:   "7px",
    color:          "var(--text)",
    fontSize:       "16px",
    lineHeight:     1,
    cursor:         "pointer",
  },
  yearValue: {
    minWidth:           "42px",
    textAlign:          "center",
    fontSize:           "13px",
    fontWeight:         700,
    color:              "var(--text)",
    fontVariantNumeric: "tabular-nums",
  },
  visToggle: {
    background:     "var(--surface-2)",
    border:         "1px solid var(--border)",
    borderRadius:   "9px",
    color:          "var(--text-muted)",
    width:          "38px",
    height:         "38px",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    cursor:         "pointer",
    flexShrink:     0,
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
    color:          "var(--on-accent)",
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
