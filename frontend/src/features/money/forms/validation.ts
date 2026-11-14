import { parseAmount } from "../../../utils/parseAmount";

// Form rules carried over from AddExpense / AddIncome unchanged.

export const yearBounds = (year = new Date().getFullYear()) => ({
  start: `${year}-01-01`,
  end: `${year}-12-31`,
  year,
});

export interface EntryForm {
  summary: string;
  amount: string;
  date: string;
  isRepeatable: boolean;
  seriesEndDate: string;
}

export type FormErrors = Partial<Record<"summary" | "amount" | "date" | "seriesEndDate", string>>;

/**
 * Repeat settings are only editable when creating; on edit they come from the
 * stored record and are not re-validated (the fields are not shown, so an
 * error there could never be seen or fixed).
 */
export function validateEntry(form: EntryForm, kind: "expense" | "income", isEdit = false): FormErrors {
  const errs: FormErrors = {};
  const { start, end, year } = yearBounds();
  if (!form.summary.trim()) errs.summary = "Summary is required.";
  const amount = parseAmount(form.amount);
  if (form.amount.trim() === "" || Number.isNaN(amount)) errs.amount = "Amount is required.";
  else if (amount <= 0) errs.amount = "Amount must be greater than 0.";
  if (!form.date) errs.date = "Date is required.";
  else if (form.date < start || form.date > end) errs.date = `Date must be within the current year (${year}).`;
  if (form.isRepeatable && !isEdit) {
    if (!form.seriesEndDate) errs.seriesEndDate = `Series end date is required for repeating ${kind}s.`;
    else if (form.seriesEndDate > end) errs.seriesEndDate = `Series end date must be within the current year (${year}).`;
    else if (form.date && form.seriesEndDate < form.date) errs.seriesEndDate = "Series end date must be on or after the date.";
  }
  return errs;
}
