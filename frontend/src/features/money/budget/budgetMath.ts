import type { Expense, Income } from "../../../types";
import { PRIORITY_ORDER } from "../../../theme/domainColors";

/** Priority then date — the order used everywhere an expense list appears. */
export const byPriorityThenDate = (a: Expense, b: Expense) =>
  (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3) || a.date.localeCompare(b.date);

export interface PeriodTotals {
  income: number;
  done: number;
  pending: number;
  spent: number;
  /** Positive when there is money left, negative when over budget. */
  balance: number;
  over: boolean;
}

export function periodTotals(income: Income, expenses: Expense[]): PeriodTotals {
  let done = 0;
  let pending = 0;
  for (const e of expenses) {
    const amt = Number(e.amount) || 0;
    if (e.status === "Completed") done += amt;
    else pending += amt;
  }
  const spent = done + pending;
  const total = Number(income.amount) || 0;
  return { income: total, done, pending, spent, balance: total - spent, over: spent > total };
}

/** Group expenses by the income they are mapped to. */
export function groupByIncome(expenses: Expense[]): Record<string, Expense[]> {
  const out: Record<string, Expense[]> = {};
  for (const e of expenses) {
    const k = e.mappedIncomeId ?? "__unmapped__";
    (out[k] ??= []).push(e);
  }
  return out;
}

/** Index of the current period: the latest income dated on or before today. */
export function currentIndex(incomes: Income[], today: string): number {
  return incomes.reduce((found, inc, idx) => (inc.date <= today ? idx : found), -1);
}
