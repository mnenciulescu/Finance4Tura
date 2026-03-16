/**
 * Shared categorical color constants used across multiple components.
 *
 * These represent semantic meanings (priority levels, HTTP methods, etc.)
 * and are intentionally fixed — they are categorical identifiers, not theme
 * colors.  Theme-aware colors (text, background, borders) use CSS variables
 * defined in index.css instead.
 */

/** Expense / income priority levels */
export const PRIORITY_COLORS = {
  High:   "#ef4444",
  Medium: "#f59e0b",
  Low:    "#22c55e",
};

/** HTTP method labels in the Backstage operation log */
export const HTTP_METHOD_COLORS = {
  GET:    "#6c63ff",
  POST:   "#22c55e",
  PUT:    "#f59e0b",
  DELETE: "#ef4444",
};

/** Chart line/series colors (Statistics page, priority charts) */
export const CHART_COLORS = {
  High:   "#ef4444",
  Medium: "#f59e0b",
  Low:    "#22c55e",
  Free:   "#6c63ff",
};

/** Income card bar chart fill colors */
export const BAR_COLORS = {
  total:   "#7c75e0",
  done:    "#bbf7d0",
  pending: "#f59e0b",
  free:    "#22c55e",
  over:    "#ef4444",
};
