/**
 * Design tokens, readable from JavaScript.
 *
 * Inline styles cannot use a CSS custom property inside a shorthand the way a
 * stylesheet can, so the tokens components reach for most often are mirrored
 * here as strings. The values themselves still live in `index.css` — these are
 * references to them, not copies.
 *
 * Kept out of `ui.jsx` so that file exports components only.
 */

export const T = {
  bg:          "var(--bg)",
  surface:     "var(--surface)",
  surfaceDeep: "var(--surface-deep)",
  raised:      "var(--surface-2)",
  raisedHi:    "var(--surface-3)",
  pill:        "var(--surface-pill)",

  accent:      "var(--accent)",
  accentSoft:  "var(--accent-hover)",
  accent2:     "var(--accent-2)",
  onAccent:    "var(--on-accent)",

  text:        "var(--text)",
  muted:       "var(--text-muted)",
  dim:         "var(--text-dim)",

  line:        "var(--border)",
  lineStrong:  "var(--border-strong)",

  done:        "var(--success)",
  pending:     "var(--warning)",
  overdue:     "var(--danger)",
  info:        "var(--info)",

  rSm:   "var(--r-sm)",
  rMd:   "var(--r-md)",
  rLg:   "var(--r-lg)",
  rXl:   "var(--r-xl)",
  rPill: "var(--r-pill)",

  shadowCard:   "var(--shadow-card)",
  shadowRaised: "var(--shadow-raised)",
  shadowSheet:  "var(--shadow-sheet)",

  heroGrad: "var(--hero-grad)",
  backdrop: "var(--backdrop)",
};

/** The type scale from the spec, as ready-to-spread style objects. */
export const TYPE = {
  display:  { fontSize: "var(--fs-display)",  lineHeight: "var(--lh-display)",  fontWeight: 800 },
  h1:       { fontSize: "var(--fs-h1)",       lineHeight: "var(--lh-h1)",       fontWeight: 700 },
  h2:       { fontSize: "var(--fs-h2)",       lineHeight: "var(--lh-h2)",       fontWeight: 700 },
  h3:       { fontSize: "var(--fs-h3)",       lineHeight: "var(--lh-h3)",       fontWeight: 600 },
  body:     { fontSize: "var(--fs-body)",     lineHeight: "var(--lh-body)",     fontWeight: 400 },
  bodyNum:  { fontSize: "var(--fs-body)",     lineHeight: "var(--lh-body)",     fontWeight: 600,
              fontVariantNumeric: "tabular-nums" },
  label:    { fontSize: "var(--fs-label)",    lineHeight: "var(--lh-label)",    fontWeight: 500 },
  overline: { fontSize: "var(--fs-overline)", lineHeight: "var(--lh-overline)", fontWeight: 700,
              letterSpacing: "1.2px", textTransform: "uppercase" },
  caption:  { fontSize: "var(--fs-caption)",  lineHeight: "var(--lh-caption)",  fontWeight: 500 },
};
