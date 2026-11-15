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

/* ── Portfolio v2 ─────────────────────────────────────────────────────────── */

export type Pv2AssetType = "Total" | "MutualFund" | "Stock" | "ETF" | "Crypto" | "Bond" | "Other";

export interface Pv2Asset {
  assetId: string;
  platform: string;
  type: Pv2AssetType;
  symbol: string | null;
  name: string;
  units: number | null;
  isin: string | null;
  /** Original quote currency (ISO 4217, one of SUPPORTED_CURRENCIES). */
  currency: string;
  preferredSources: string[];
  notes: string | null;
  order: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Pv2Source { url: string; title: string | null; publisher: string | null; quote: string | null; retrievedAt?: string; }

export interface Pv2Snapshot {
  snapshotId: string;
  assetId: string;
  runId: string;
  generatedAt: string;
  priceDate: string;
  asset: Pick<Pv2Asset, "platform" | "type" | "symbol" | "name" | "units" | "isin" | "currency">;
  currency: string;
  unitPrice: number | null;
  value: number | null;
  fxRate: number | null;
  fxDate: string | null;
  valueEUR: number;
  sources: Pv2Source[];
  confidence: "official" | "secondary" | null;
  priceType?: string | null;
  flagged?: boolean;
  incomplete?: boolean;
  comments: string | null;
  source: "agent" | "manual" | "computed";
}

export type Pv2ItemStatus = "queued" | "searching" | "computing" | "updated" | "no_new_data" | "not_found" | "failed" | "skipped";

export interface Pv2RunItem {
  assetId: string;
  name: string;
  platform: string;
  type: Pv2AssetType;
  symbol?: string | null;
  isin?: string | null;
  status: Pv2ItemStatus;
  message?: string | null;
  snapshotId?: string | null;
  unitPrice?: number | null;
  currency?: string | null;
  priceDate?: string | null;
  value?: number | null;
  valueEUR?: number | null;
  sourceUrl?: string | null;
  flagged?: boolean;
}

export interface Pv2Run {
  runId: string;
  trigger: "manual" | "scheduled";
  status: "running" | "completed" | "completed_with_errors" | "failed" | "cancelled";
  startedAt: string;
  finishedAt: string | null;
  items: Pv2RunItem[];
  summary: { updated: number; noNewData: number; notFound: number; failed: number; skipped: number } | null;
  model: string;
  usage: { inputTokens: number; outputTokens: number; webSearches: number };
  cancelRequested?: boolean;
}

export interface Pv2AiConfig { configured: boolean; keyUpdatedAt: string | null; model: string; maxSearches: number; enabled: boolean; }
