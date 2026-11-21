import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { deleteIncome, createIncome, updateIncome, updateIncomeSeries } from "../api/incomes";
import { updateExpense, deleteExpense, createExpense, updateExpenseSeries } from "../api/expenses";
import { createSplitPayment, updateSplitPayment, deleteSplitPayment } from "../api/splitPayments";
import { createBook, updateBook, deleteBook } from "../api/booksAndDev";
import {
  createOperation, updateOperation, deleteOperation,
} from "../api/investments";
import type { Book, Expense, Income, Operation, SplitPayment } from "../types";
import { keys, patchLists, restoreLists, snapshotLists } from "./queries";

// Write-side hooks used only by lazily loaded screens and sheets, kept out of
// the first download (proposal §12.6).

type SaveMode = "create" | "single" | "series";

/** Delete one expense or its whole series, optimistically. */
export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ exp, series }: { exp: Expense; series: boolean }) =>
      deleteExpense(exp.expenseId, series ? { deleteSeries: "true" } : undefined),
    onMutate: async ({ exp, series }) => {
      await qc.cancelQueries({ queryKey: keys.expenses });
      const snaps = snapshotLists(qc, keys.expenses);
      patchLists<Expense>(qc, keys.expenses, list =>
        list.filter(e => (series ? e.seriesId !== exp.seriesId : e.expenseId !== exp.expenseId)));
      return { snaps };
    },
    onError: (_e, _v, ctx) => { if (ctx) restoreLists(qc, ctx.snaps); },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.expenses }),
  });
}


/**
 * Delete an income (or its series) and remap the expenses that pointed at it
 * to the best remaining income (latest date ≤ expense date) — optimistically,
 * reverting both lists on failure. Same logic as the old Dashboard.
 */
interface IncomeDeletePlan {
  income: Income;
  series: boolean;
  removed: Set<string>;
  /** Expenses that pointed at a removed income, already remapped. */
  remapped: Expense[];
}

function planIncomeDelete(qc: QueryClient, income: Income, series: boolean): IncomeDeletePlan {
  const all = qc.getQueryData<Income[]>(keys.incomes) ?? [];
  const expenses = qc.getQueryData<Expense[]>(keys.expenses) ?? [];
  const removed = new Set(
    series ? all.filter(i => i.seriesId === income.seriesId).map(i => i.incomeId) : [income.incomeId],
  );
  const remaining = all.filter(i => !removed.has(i.incomeId));
  const resolve = (d: string) =>
    remaining.filter(i => i.date <= d).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  const remapped = expenses
    .filter(e => e.mappedIncomeId && removed.has(e.mappedIncomeId))
    .map(e => {
      const inc = resolve(e.date);
      return { ...e, mappedIncomeId: inc?.incomeId ?? null, mappedIncomeSummary: inc?.summary ?? null, mappedIncomeDate: inc?.date ?? null };
    });
  return { income, series, removed, remapped };
}

export function useDeleteIncome() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (plan: IncomeDeletePlan) => {
      await deleteIncome(plan.income.incomeId, plan.series ? { deleteSeries: "true" } : undefined);
      await Promise.all(plan.remapped.map(e => updateExpense(e.expenseId, e)));
    },
    onMutate: async (plan: IncomeDeletePlan) => {
      await Promise.all([qc.cancelQueries({ queryKey: keys.incomes }), qc.cancelQueries({ queryKey: keys.expenses })]);
      const incomeSnaps = snapshotLists(qc, keys.incomes);
      const expenseSnaps = snapshotLists(qc, keys.expenses);
      const byId = new Map(plan.remapped.map(e => [e.expenseId, e]));
      patchLists<Income>(qc, keys.incomes, list => list.filter(i => !plan.removed.has(i.incomeId)));
      patchLists<Expense>(qc, keys.expenses, list => list.map(e => byId.get(e.expenseId) ?? e));
      return { incomeSnaps, expenseSnaps };
    },
    onError: (_e, _v, ctx) => {
      if (!ctx) return;
      restoreLists(qc, ctx.incomeSnaps);
      restoreLists(qc, ctx.expenseSnaps);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.incomes });
      qc.invalidateQueries({ queryKey: keys.expenses });
    },
  });
  return {
    ...mutation,
    deleteIncome: (income: Income, series: boolean) => mutation.mutate(planIncomeDelete(qc, income, series)),
  };
}


export function useSaveExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mode, body }: { id?: string; mode: SaveMode; body: Partial<Expense> }) =>
      mode === "create" ? createExpense(body) : mode === "series" ? updateExpenseSeries(id!, body) : updateExpense(id!, body),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: keys.expenses });
      if (id) qc.invalidateQueries({ queryKey: keys.expense(id) });
    },
  });
}

export function useSaveIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mode, body }: { id?: string; mode: SaveMode; body: Partial<Income> }) =>
      mode === "create" ? createIncome(body) : mode === "series" ? updateIncomeSeries(id!, body) : updateIncome(id!, body),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: keys.incomes });
      qc.invalidateQueries({ queryKey: keys.expenses }); // mappings may change
      if (id) qc.invalidateQueries({ queryKey: keys.income(id) });
    },
  });
}


export function useSaveSplit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: Partial<SplitPayment> }) =>
      (id ? updateSplitPayment(id, body) : createSplitPayment(body)) as Promise<SplitPayment>,
    onSuccess: (saved, { id }) => {
      qc.setQueryData<SplitPayment[]>(keys.splits, old => {
        if (!old) return [saved];
        return id ? old.map(p => (p.splitPaymentId === saved.splitPaymentId ? saved : p)) : [saved, ...old];
      });
    },
  });
}

export function useDeleteSplit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSplitPayment(id),
    onSuccess: (_d, id) => patchLists<SplitPayment>(qc, keys.splits, l => l.filter(p => p.splitPaymentId !== id)),
  });
}


export function useSaveBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: Partial<Book> }) =>
      (id ? updateBook(id, body) : createBook(body)) as Promise<Book>,
    onSuccess: (saved, { id }) => {
      qc.setQueryData<Book[]>(keys.books, old => {
        if (!old) return [saved];
        return id ? old.map(b => (b.bookId === id ? saved : b)) : [saved, ...old];
      });
    },
  });
}

export function useRateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ book, rating }: { book: Book; rating: number | null }) =>
      updateBook(book.bookId, { ...book, rating }) as Promise<Book>,
    onMutate: ({ book, rating }) => {
      const prev = qc.getQueryData<Book[]>(keys.books);
      patchLists<Book>(qc, keys.books, l => l.map(b => (b.bookId === book.bookId ? { ...b, rating } : b)));
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(keys.books, ctx.prev); },
    onSuccess: saved => patchLists<Book>(qc, keys.books, l => l.map(b => (b.bookId === saved.bookId ? saved : b))),
  });
}

export function useDeleteBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBook(id),
    onSuccess: (_d, id) => patchLists<Book>(qc, keys.books, l => l.filter(b => b.bookId !== id)),
  });
}


export function crud<T>(key: readonly unknown[], idOf: (t: T) => string, create: (b: unknown) => Promise<unknown>,
  update: (id: string, b: unknown) => Promise<unknown>, remove: (id: string) => Promise<unknown>) {
  return {
    useSave() {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: ({ id, body }: { id?: string; body: unknown }) => (id ? update(id, body) : create(body)) as Promise<T>,
        onSuccess: (saved: T, { id }) => qc.setQueryData<T[]>(key, old => {
          if (!old) return [saved];
          return id ? old.map(x => (idOf(x) === id ? saved : x)) : [saved, ...old];
        }),
      });
    },
    useDelete() {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (id: string) => remove(id),
        onSuccess: (_d: unknown, id: string) => patchLists<T>(qc, key, l => l.filter(x => idOf(x) !== id)),
      });
    },
  };
}

const opCrud = crud<Operation>(keys.operations, o => o.operationId, createOperation, updateOperation, deleteOperation);
export const useSaveOperation = opCrud.useSave;
export const useDeleteOperation = opCrud.useDelete;
