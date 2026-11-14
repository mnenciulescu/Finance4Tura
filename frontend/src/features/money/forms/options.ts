import type { Income } from "../../../types";

export const CURRENCY_OPTIONS = [
  { value: "RON" as const, label: "RON" },
  { value: "EUR" as const, label: "EUR" },
  { value: "USD" as const, label: "USD" },
];

export const FREQUENCY_OPTIONS = [
  { value: "daily" as const, label: "Daily" },
  { value: "weekly" as const, label: "Weekly" },
  { value: "monthly" as const, label: "Monthly" },
];

/** True when an income belongs to a repeating series (same test as before). */
export const isIncomeSeriesMember = (i: Income) => !!i.seriesId && i.seriesId !== i.incomeId;
