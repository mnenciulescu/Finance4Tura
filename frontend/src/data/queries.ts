import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { listIncomes, getIncome } from "../api/incomes";
import { listExpenses, updateExpense, getExpense, resolveIncome } from "../api/expenses";
import { listSplitPayments, updateSplitPayment } from "../api/splitPayments";
import { listBooks } from "../api/booksAndDev";
import { listOperations, listSnapshots } from "../api/investments";
import { getFxRates } from "../api/fxRates";
import type { Book, Expense, FxRates, Income, Occurrence, Operation, Snapshot, SplitPayment } from "../types";

/* ── Keys ─────────────────────────────────────────────────────────────────── */

export const keys = {
  incomes: ["incomes"] as const,
  incomesYear: (year: number) => ["incomes", { year }] as const,
  income: (id: string) => ["income", id] as const,
  expenses: ["expenses"] as const,
  expensesYear: (year: number) => ["expenses", { year }] as const,
  expense: (id: string) => ["expense", id] as const,
  resolveIncome: (date: string) => ["resolveIncome", date] as const,
  splits: ["splitPayments"] as const,
  books: ["books"] as const,
  operations: ["operations"] as const,
  snapshots: ["snapshots"] as const,
  fx: ["fxRates"] as const,
  hqLocations: ["hq", "locations"] as const,
  hqTemplates: ["hq", "templates"] as const,
  hqEntries: ["hq", "entries"] as const,
};

/** Applies `fn` to every cached list under `key` (e.g. all expense lists). */
export function patchLists<T>(qc: QueryClient, key: readonly unknown[], fn: (list: T[]) => T[]) {
  qc.setQueriesData<T[]>({ queryKey: key }, old => (Array.isArray(old) ? fn(old) : old));
}

/** Snapshot every list under `key` for rollback. */
export function snapshotLists(qc: QueryClient, key: readonly unknown[]) {
  return qc.getQueriesData({ queryKey: key });
}
export function restoreLists(qc: QueryClient, snaps: ReturnType<QueryClient["getQueriesData"]>) {
  for (const [k, v] of snaps) qc.setQueryData(k, v);
}

/* ── Incomes / expenses ───────────────────────────────────────────────────── */

const byDate = <T extends { date: string }>(list: T[]) => [...list].sort((a, b) => a.date.localeCompare(b.date));

export const useIncomes = () =>
  useQuery({ queryKey: keys.incomes, queryFn: async () => byDate((await listIncomes()) as Income[]) });

export const useIncomesForYear = (year: number) =>
  useQuery({
    queryKey: keys.incomesYear(year),
    queryFn: () => listIncomes({ from: `${year}-01-01`, to: `${year}-12-31` }) as Promise<Income[]>,
  });

export const useExpenses = () =>
  useQuery({ queryKey: keys.expenses, queryFn: () => listExpenses() as Promise<Expense[]> });

export const useExpensesForYear = (year: number) =>
  useQuery({
    queryKey: keys.expensesYear(year),
    queryFn: () => listExpenses({ from: `${year}-01-01`, to: `${year}-12-31` }) as Promise<Expense[]>,
  });

export const useIncome = (id: string | undefined) =>
  useQuery({ queryKey: keys.income(id ?? ""), queryFn: () => getIncome(id!) as Promise<Income>, enabled: !!id });

export const useExpense = (id: string | undefined) =>
  useQuery({ queryKey: keys.expense(id ?? ""), queryFn: () => getExpense(id!) as Promise<Expense>, enabled: !!id });

export const useResolveIncome = (date: string) =>
  useQuery({
    queryKey: keys.resolveIncome(date),
    queryFn: async () => ((await resolveIncome(date)) as { income: Income | null }).income ?? null,
    enabled: /^\d{4}-\d{2}-\d{2}$/.test(date),
    staleTime: 10_000,
    meta: { persist: false },
  });

/** Years that have incomes, plus the current year, ascending. */
export function availableYears(incomes: Income[] | undefined): number[] {
  const years = new Set<number>((incomes ?? []).map(i => Number(i.date.slice(0, 4))));
  years.add(new Date().getFullYear());
  return [...years].sort((a, b) => a - b);
}

/** Tick / untick an expense, optimistically, reverting on failure. */
export function useToggleExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (exp: Expense) =>
      updateExpense(exp.expenseId, { ...exp, status: exp.status === "Completed" ? "Pending" : "Completed" }),
    onMutate: async (exp: Expense) => {
      await qc.cancelQueries({ queryKey: keys.expenses });
      const snaps = snapshotLists(qc, keys.expenses);
      const next = exp.status === "Completed" ? "Pending" : "Completed";
      patchLists<Expense>(qc, keys.expenses, list =>
        list.map(e => (e.expenseId === exp.expenseId ? { ...e, status: next } : e)));
      return { snaps };
    },
    onError: (_e, _v, ctx) => { if (ctx) restoreLists(qc, ctx.snaps); },
  });
}

/* ── Split payments ───────────────────────────────────────────────────────── */

export const useSplitPayments = () =>
  useQuery({ queryKey: keys.splits, queryFn: () => listSplitPayments() as Promise<SplitPayment[]> });

/** Local (unsaved) slot edit: shows immediately, saved later by the debouncer. */
export function setSplitOccurrencesLocal(qc: QueryClient, id: string, occurrences: Occurrence[]) {
  qc.setQueryData<SplitPayment[]>(keys.splits, old =>
    old?.map(p => (p.splitPaymentId === id ? { ...p, occurrences } : p)));
}

/** Saves only `{ occurrences }` — never occurrenceCount, so a save cannot resize the series. */
export const saveSplitOccurrences = (id: string, occurrences: Occurrence[]) =>
  updateSplitPayment(id, { occurrences });

/* ── Books ────────────────────────────────────────────────────────────────── */

export const useBooks = () => useQuery({ queryKey: keys.books, queryFn: () => listBooks() as Promise<Book[]> });

/* ── Investments / FX ─────────────────────────────────────────────────────── */

export const useOperations = () =>
  useQuery({ queryKey: keys.operations, queryFn: () => listOperations() as Promise<Operation[]> });
export const useSnapshots = () =>
  useQuery({ queryKey: keys.snapshots, queryFn: () => listSnapshots() as Promise<Snapshot[]> });
export const useFxRates = () =>
  useQuery({ queryKey: keys.fx, queryFn: () => getFxRates() as Promise<FxRates> });
