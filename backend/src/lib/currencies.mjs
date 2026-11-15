// Currencies the app can convert between. FxRates stores the full N × N
// matrix for these: rates[FROM][TO] = value of 1 FROM expressed in TO.
// Adding a currency = one entry here and in frontend/src/utils/money.ts;
// it must be one that frankfurter.app publishes.
export const SUPPORTED_CURRENCIES = ["EUR", "RON", "USD", "GBP", "CHF"];

export const isSupportedCurrency = (c) => SUPPORTED_CURRENCIES.includes(c);

const round6 = (n) => Math.round(n * 1e6) / 1e6;

/**
 * Builds the full conversion matrix from EUR-based rates
 * (`eurRates[CUR]` = 1 EUR in CUR, as frankfurter.app returns them).
 * Currencies without a rate are left out of the matrix.
 */
export function buildMatrix(eurRates, currencies = SUPPORTED_CURRENCIES) {
  const per = { EUR: 1 };
  for (const c of currencies) {
    if (c === "EUR") continue;
    const r = Number(eurRates?.[c]);
    if (Number.isFinite(r) && r > 0) per[c] = r;
  }
  const codes = currencies.filter(c => per[c] != null);
  const matrix = {};
  for (const from of codes) {
    matrix[from] = {};
    for (const to of codes) matrix[from][to] = from === to ? 1 : round6(per[to] / per[from]);
  }
  return matrix;
}

/** Value of 1 `currency` in EUR from a stored matrix (null when unknown). */
export function rateToEUR(rates, currency) {
  if (currency === "EUR") return 1;
  const row = rates?.[currency];
  if (row && typeof row === "object" && Number.isFinite(row.EUR) && row.EUR > 0) return row.EUR;
  return null;
}
