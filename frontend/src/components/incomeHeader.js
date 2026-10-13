// The income header's layout and type, shared with the Home Overview's
// current-period hero so the two stay identical. Text colour comes from the
// `--on-header` variable set on the surrounding element.
export const incomeHeader = {
  headerRow: {
    display:       "flex",
    flexDirection: "column",
    gap:           "var(--sp-1)",
    padding:       "var(--sp-2) var(--sp-4)",
    overflow:      "hidden",
  },
  headerTop: {
    display:    "flex",
    alignItems: "center",
    gap:        "7px",
  },
  dateBadge: {
    display:    "flex",
    alignItems: "center",
    gap:        "5px",
    flex:       1,
    lineHeight: 1,
  },
  badgeMonth: {
    fontSize:      "17px",
    fontWeight:    800,
    color:         "var(--on-header)",
    letterSpacing: "0.08em",
  },
  badgeDay: {
    fontSize:      "17px",
    fontWeight:    800,
    color:         "var(--on-header)",
    letterSpacing: "0.04em",
  },
  badgeYear: {
    fontSize:      "15px",
    fontWeight:    600,
    color:         "var(--on-header)",
    opacity:       0.75,
    letterSpacing: "0.04em",
  },
  badgeSep: {
    fontSize:   "11px",
    color:      "var(--on-header)",
    opacity:    0.5,
    lineHeight: 1,
  },
  badgeDow: {
    fontSize:      "14px",
    fontWeight:    700,
    color:         "var(--on-header)",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  summary: {
    fontWeight:   700,
    fontSize:     "15px",
    color:        "var(--on-header)",
    overflow:     "hidden",
    textOverflow: "ellipsis",
    whiteSpace:   "nowrap",
  },
};
