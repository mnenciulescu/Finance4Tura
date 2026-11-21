import type { FxMatrix } from "../types";

/**
 * Currencies the stored FX matrix covers (mirrors backend/src/lib/currencies.mjs).
 * Budget, Split and the operations keep their own EUR / RON / USD pickers.
 */
export const SUPPORTED_CURRENCIES = ["EUR", "RON", "USD", "GBP", "CHF"] as const;

/**
 * Converts to EUR with the stored FX matrix: rates[FROM][TO], so
 * rates[currency].EUR is the value of 1 CUR in EUR. Falls back to the legacy
 * flat form (base EUR, rates.USD = 1 EUR in USD).
 */
export function toEUR(amount: number, currency: string | undefined, rates: FxMatrix | null | undefined): number {
  if (!rates || !currency || currency === "EUR") return amount;
  const row = rates[currency];
  if (row && typeof row === "object" && row.EUR != null) return amount * row.EUR;
  if (typeof row === "number") return amount / row;
  return amount;
}
