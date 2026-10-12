/**
 * Categorical colour constants — series identities rather than theme surfaces.
 *
 * These stay fixed across themes because they encode *which* thing a mark
 * refers to (priority level, platform, HTTP verb), not what the surface under
 * it looks like. Theme-aware colours (text, background, borders) come from the
 * CSS variables in `index.css` instead.
 *
 * Every value is drawn from the Dusk palette: dusty terracotta, tan, sage and
 * blue-grey, with two further desaturated hues where a series needs more than
 * four distinguishable entries. Nothing here is a saturated red, orange or
 * green — those read as alarms against a muted ground and were the loudest
 * remnant of the previous light theme.
 */

/** Dusk palette anchors, so a series colour is never invented ad hoc. */
export const DUSK = {
  tan:        "#bc9876",
  tanSoft:    "#c9a98a",
  sage:       "#8fb39a",
  terracotta: "#ce8b7a",
  slate:      "#8b9a9f",
  navy:       "#434e60",
  lilac:      "#9b93b5",
  teal:       "#7aa6a3",
};

/** Expense / income priority levels. High reads warmest, Low coolest. */
export const PRIORITY_COLORS = {
  High:   DUSK.terracotta,
  Medium: DUSK.tan,
  Low:    DUSK.sage,
};

/** Fallback for a row whose priority is missing or unrecognised. */
export const PRIORITY_FALLBACK = DUSK.slate;

/** HTTP method labels in the Backstage operation log. */
export const HTTP_METHOD_COLORS = {
  GET:    DUSK.slate,
  POST:   DUSK.sage,
  PUT:    DUSK.tan,
  DELETE: DUSK.terracotta,
};

/** Chart line / series colours (Statistics page). */
export const CHART_COLORS = {
  High:   DUSK.terracotta,
  Medium: DUSK.tan,
  Low:    DUSK.sage,
  Free:   DUSK.lilac,
};

/**
 * Income card bar chart fills. Done is sage and pending tan, per the spec.
 * Free is teal rather than sage: it sits directly beside the Done segment in
 * the budget bar, and two adjacent segments meaning different things cannot
 * share a colour.
 */
export const BAR_COLORS = {
  total:   DUSK.slate,
  done:    DUSK.sage,
  pending: DUSK.tan,
  free:    DUSK.teal,
  over:    DUSK.terracotta,
};

/** Investment platforms — six entries, so the palette stretches to lilac/teal. */
export const PLATFORM_COLORS = {
  "eToro":         DUSK.sage,
  "Binance":       DUSK.tan,
  "Fidelity":      DUSK.slate,
  "Tradeville":    DUSK.lilac,
  "ING Funds RON": DUSK.terracotta,
  "ING Funds EUR": DUSK.teal,
};

/**
 * Tint of a palette anchor. Keeps translucent fills derived from the same
 * eight hues rather than hand-written rgba() scattered across pages.
 */
export function alpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Books & Development type badges. */
export const TYPE_COLORS = {
  Audiobook: { bg: alpha(DUSK.lilac, 0.20), text: DUSK.lilac },
  Training:  { bg: alpha(DUSK.teal,  0.20), text: DUSK.teal },
  Book:      { bg: "var(--surface-2)",          text: "var(--text-muted)" },
  Other:     { bg: "var(--surface-2)",          text: "var(--text-muted)" },
};

/**
 * Bottom-bar tab icons — flat, two-tone illustrations. Deliberately brighter
 * than the muted Dusk anchors: the bar is the one place the app uses full
 * colour, one hue per tab. `main` is the body, `deep` the second tone (roof,
 * flap, cap), `ink` the active label — a mid-tone, so it reads on the navy
 * Dusk bar and on the white Light/Amber bars alike. Shared accents sit in
 * `shared`. No gradients: every shape is a single solid fill.
 */
export const TAB_ICON_COLORS = {
  home: {
    main: "#ff7a66", deep: "#e5486b", door: "#7a2950", ink: "#ec5a6f",
  },
  finance: {
    main: "#2fc79a", deep: "#13977d", ink: "#16b08c",
  },
  books: {
    main: "#8b6ff2", deep: "#5c47c9", ink: "#8b6ff2",
    page: "#f3efff", pageShade: "#e1d8ff", line: "#b9a8f7", ribbon: "#f472b6",
  },
  hq: {
    main: "#4f8ff7", deep: "#2756c9", annex: "#9cc8ff", door: "#1d3f99",
    drop: "#22c3e6", ink: "#3d82f0",
  },
  shared: {
    gold:     "#ffcb52",
    goldDeep: "#f0a020",
    window:   "#ffe08a",
  },
};
