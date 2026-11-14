// Domain keys → semantic colour tokens. No raw colours: every value is a CSS
// variable from themes.css, so each theme recolours the data automatically.
// Charts that need concrete strings resolve these through useChartTheme().

export const PRIORITY_COLOR: Record<string, string> = {
  High:   "var(--status-negative)",
  Medium: "var(--status-warning)",
  Low:    "var(--series-5)",
};
export const PRIORITY_FALLBACK = "var(--label-tertiary)";
export const PRIORITY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

export const BUDGET_COLOR = {
  done:    "var(--status-positive)",
  pending: "var(--status-warning)",
  free:    "var(--tint)",
  over:    "var(--status-negative)",
};

export const PLATFORMS = ["eToro", "Binance", "Fidelity", "Tradeville", "ING Funds RON", "ING Funds EUR"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_COLOR: Record<string, string> = {
  "eToro":         "var(--series-2)",
  "Binance":       "var(--series-8)",
  "Fidelity":      "var(--series-1)",
  "Tradeville":    "var(--series-7)",
  "ING Funds RON": "var(--series-3)",
  "ING Funds EUR": "var(--series-6)",
};

export const BOOK_TYPE_COLOR: Record<string, string> = {
  Audiobook: "var(--series-4)",
  Training:  "var(--series-5)",
  Book:      "var(--label-secondary)",
  Other:     "var(--series-7)",
};

export const HTTP_METHOD_COLOR: Record<string, string> = {
  GET:    "var(--series-1)",
  POST:   "var(--series-2)",
  PUT:    "var(--series-3)",
  DELETE: "var(--status-negative)",
};

export const STATS_COLOR = {
  freePositive: "var(--tint)",
  freeNegative: "var(--status-negative)",
  special:      "var(--status-special)",
};

/** HQ water chart: cold and hot water lines. */
export const WATER_COLOR = {
  cold: "var(--series-1)",
  hot:  "var(--series-3)",
};

/** Extracts the custom property name from "var(--x)". */
export const tokenName = (v: string) => v.replace(/^var\((--[^)]+)\)$/, "$1");
