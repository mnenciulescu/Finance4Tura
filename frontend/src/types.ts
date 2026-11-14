// Domain records as the API returns them (see CLAUDE.md → Database Schema).

export type Currency = "RON" | "EUR" | "USD";
export type Frequency = "daily" | "weekly" | "monthly";
export type Priority = "High" | "Medium" | "Low";
export type ExpenseStatus = "Pending" | "Completed";

export interface Income {
  incomeId: string;
  userId?: string;
  seriesId?: string;
  summary: string;
  date: string;
  amount: number;
  currency?: Currency;
  isRepeatable?: boolean;
  repeatFrequency?: Frequency;
  seriesEndDate?: string;
  isException?: boolean;
  dayOfWeek?: string;
}

export interface Expense {
  expenseId: string;
  userId?: string;
  seriesId?: string;
  summary: string;
  date: string;
  amount: number;
  currency?: Currency;
  priority: Priority;
  status: ExpenseStatus;
  special?: boolean;
  isRepeatable?: boolean;
  repeatFrequency?: Frequency;
  seriesEndDate?: string;
  isException?: boolean;
  mappedIncomeId?: string | null;
  mappedIncomeSummary?: string | null;
  mappedIncomeDate?: string | null;
}

export interface Occurrence { index?: number; value: string | number | ""; }

export interface SplitPayment {
  splitPaymentId: string;
  title: string;
  totalAmount: number;
  currency: Currency;
  occurrenceCount: number;
  occurrenceType: "amount" | "date";
  createdDate: string;
  occurrences: Occurrence[];
}

export interface Operation {
  operationId: string;
  date: string;
  type: "Deposit" | "Withdrawal";
  platform: string;
  amount: number;
  currency: Currency;
  notes?: string;
}

export interface Snapshot {
  snapshotId: string;
  date: string;
  platform: string;
  amount: number;
  currency: Currency;
}

export type FxMatrix = Record<string, Record<string, number> | number>;
export interface FxRates { rates: FxMatrix | null; updatedAt: string | null; }

export interface Book {
  bookId: string;
  name: string;
  source: string;
  type: string;
  author: string;
  title: string;
  dateCompleted: string;
  rating: number | null;
  comments: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface HqLocation { hqId: string; name: string; address?: string; order?: number; createdAt?: string; }

export interface HqParameter {
  parameterId?: string;
  title: string;
  type: "number" | "text" | "boolean";
  unit?: string;
  order?: number;
}

export interface HqTemplate {
  templateId: string;
  hqId: string;
  name: string;
  parameters: HqParameter[];
  createdAt?: string;
  updatedAt?: string;
}

export interface HqValue { parameterId: string; title: string; value: string | number | boolean | null; }

export interface HqEntry {
  entryId: string;
  templateId: string;
  hqId: string;
  date: string;
  values: HqValue[];
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AdminUser {
  username: string;
  email?: string;
  enabled: boolean;
  role: "admin" | "normal";
  incomes: number;
  expenses: number;
}
