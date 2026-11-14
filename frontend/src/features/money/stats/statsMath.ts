import type { Expense, Income } from "../../../types";
import { MONTH_ABBR } from "../../../utils/format";

/** Living-cost baseline used by the Survival / month figure (RON). */
export const SURVIVAL_BASELINE = 7000;

export interface MonthRow {
  label: string;
  income: number | null;
  high: number | null;
  medium: number | null;
  low: number | null;
  free: number | null;
  hasData: boolean;
}

/** Month-by-month figures; future months with no data are null so they render blank. */
export function buildMonthly(incomes: Income[], expenses: Expense[], year: number, today = new Date()): MonthRow[] {
  const thisYear = today.getFullYear();
  return MONTH_ABBR.map((label, idx) => {
    const month = `${year}-${String(idx + 1).padStart(2, "0")}`;
    const isFuture = year > thisYear || (year === thisYear && idx > today.getMonth());
    const mInc = incomes.filter(i => i.date.startsWith(month));
    const mExp = expenses.filter(e => e.date.startsWith(month));
    const income = mInc.reduce((s, i) => s + (i.amount ?? 0), 0);
    const sum = (p: string) => mExp.filter(e => e.priority === p).reduce((s, e) => s + (e.amount ?? 0), 0);
    const high = sum("High");
    const medium = sum("Medium");
    const low = sum("Low");
    const hasData = mInc.length > 0 || mExp.length > 0;
    const blank = isFuture && !hasData;
    return {
      label,
      income: blank ? null : income,
      high: blank ? null : high,
      medium: blank ? null : medium,
      low: blank ? null : low,
      free: blank ? null : income - high - medium - low,
      hasData,
    };
  });
}

/** Averages over months with at least one income or expense. */
export function averages(rows: MonthRow[]) {
  const withData = rows.filter(r => r.hasData);
  const n = withData.length || 1;
  const avg = (k: "high" | "medium" | "low" | "free") => withData.reduce((s, r) => s + (r[k] ?? 0), 0) / n;
  const a = { high: avg("high"), medium: avg("medium"), low: avg("low"), free: avg("free") };
  return { ...a, months: withData.length, survival: a.high + a.medium * 0.8 + SURVIVAL_BASELINE };
}
