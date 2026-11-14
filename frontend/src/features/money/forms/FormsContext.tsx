import { createContext, lazy, Suspense, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

const ExpenseSheet = lazy(() => import("./ExpenseSheet").then(m => ({ default: m.ExpenseSheet })));
const IncomeSheet = lazy(() => import("./IncomeSheet").then(m => ({ default: m.IncomeSheet })));

export interface ExpenseFormTarget { id?: string; date?: string; }
export interface IncomeFormTarget { id?: string; }

interface FormsContextValue {
  openExpense: (t?: ExpenseFormTarget) => void;
  openIncome: (t?: IncomeFormTarget) => void;
}

const FormsContext = createContext<FormsContextValue>({ openExpense: () => {}, openIncome: () => {} });

/**
 * Expense and income forms are sheets over whatever screen opened them
 * (proposal §8.4), so saving never loses the user's place — no more
 * `from` / `returnStartIdx` bookkeeping.
 */
export function FormsProvider({ children }: { children: ReactNode }) {
  const [expense, setExpense] = useState<ExpenseFormTarget | null>(null);
  const [income, setIncome] = useState<IncomeFormTarget | null>(null);
  const [nonce, setNonce] = useState(0);
  // Mounted from the first open on, so later opens animate normally.
  const [loaded, setLoaded] = useState({ expense: false, income: false });

  const openExpense = useCallback((t: ExpenseFormTarget = {}) => {
    setNonce(n => n + 1); setExpense(t); setLoaded(l => (l.expense ? l : { ...l, expense: true }));
  }, []);
  const openIncome = useCallback((t: IncomeFormTarget = {}) => {
    setNonce(n => n + 1); setIncome(t); setLoaded(l => (l.income ? l : { ...l, income: true }));
  }, []);
  const value = useMemo(() => ({ openExpense, openIncome }), [openExpense, openIncome]);

  return (
    <FormsContext.Provider value={value}>
      {children}
      <Suspense fallback={null}>
        {loaded.expense && <ExpenseSheet key={`e${nonce}-${expense?.id ?? "new"}`} target={expense} onClose={() => setExpense(null)} />}
        {loaded.income && <IncomeSheet key={`i${nonce}-${income?.id ?? "new"}`} target={income} onClose={() => setIncome(null)} />}
      </Suspense>
    </FormsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useForms = () => useContext(FormsContext);
