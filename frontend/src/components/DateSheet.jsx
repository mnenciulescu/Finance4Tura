import { useState, useEffect, useMemo } from "react";
import dayjs from "dayjs";
import { T, TYPE } from "./tokens";

/**
 * A calendar in a bottom sheet, used instead of the browser's own date picker.
 *
 * The native picker cannot carry extra actions — nothing in the platform lets a
 * page put a control inside it — so a slot that needs a Clear next to the days
 * has to bring its own calendar. This one also renders in the app's palette on
 * every platform, rather than whatever the OS draws.
 *
 * Deliberately offers no "Today" shortcut: a single tap writing the current
 * date is the thing these slots were losing values to.
 */

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const ISO = "YYYY-MM-DD";

export default function DateSheet({ value, label, onPick, onClear, onClose }) {
  const selected = value ? dayjs(value) : null;
  const [month, setMonth] = useState(() =>
    (selected?.isValid() ? selected : dayjs()).startOf("month"));

  useEffect(() => {
    const onKey = e => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const days = useMemo(() => {
    const first = month.startOf("month");
    // dayjs weeks start on Sunday; these start on Monday.
    const offset = (first.day() + 6) % 7;
    const count  = month.daysInMonth();
    return [
      ...Array.from({ length: offset }, () => null),
      ...Array.from({ length: count }, (_, i) => first.add(i, "day")),
    ];
  }, [month]);

  const todayIso    = dayjs().format(ISO);
  const selectedIso = selected?.isValid() ? selected.format(ISO) : null;

  return (
    <div style={s.overlay} onClick={onClose}>
      <div
        style={s.sheet}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={label ? `${label}: pick a date` : "Pick a date"}
      >
        <div style={s.grabber} />

        <div style={s.head}>
          <button
            style={s.step}
            onClick={() => setMonth(m => m.subtract(1, "month"))}
            aria-label="Previous month"
          >‹</button>
          <span style={s.monthLabel}>{month.format("MMMM YYYY")}</span>
          <button
            style={s.step}
            onClick={() => setMonth(m => m.add(1, "month"))}
            aria-label="Next month"
          >›</button>
        </div>

        <div style={s.weekRow}>
          {WEEKDAYS.map(d => <span key={d} style={s.weekday}>{d}</span>)}
        </div>

        <div style={s.grid}>
          {days.map((d, i) => {
            if (!d) return <span key={`pad-${i}`} />;
            const iso      = d.format(ISO);
            const isPicked = iso === selectedIso;
            const isToday  = iso === todayIso;
            return (
              <button
                key={iso}
                onClick={() => onPick(iso)}
                aria-pressed={isPicked}
                aria-label={d.format("D MMMM YYYY")}
                style={{
                  ...s.day,
                  ...(isToday && !isPicked ? s.dayToday : {}),
                  ...(isPicked ? s.dayPicked : {}),
                }}
              >
                {d.date()}
              </button>
            );
          })}
        </div>

        {/* Clear sits with the actions rather than among the days, so it
            cannot be hit while aiming for a date. */}
        <div style={s.actions}>
          <button
            style={{ ...s.actionBtn, ...s.clear, ...(value ? {} : s.disabled) }}
            onClick={onClear}
            disabled={!value}
          >
            Clear
          </button>
          <button style={{ ...s.actionBtn, ...s.cancel }} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position:       "fixed",
    inset:          0,
    background:     T.backdrop,
    display:        "flex",
    alignItems:     "flex-end",
    justifyContent: "center",
    zIndex:         800,
  },
  sheet: {
    background:    T.surface,
    borderRadius:  `${T.rXl} ${T.rXl} 0 0`,
    boxShadow:     T.shadowSheet,
    width:         "100%",
    maxWidth:      "var(--app-max-w)",
    display:       "flex",
    flexDirection: "column",
    gap:           "var(--sp-3)",
    padding:       "0 var(--sp-4) calc(var(--sp-4) + env(safe-area-inset-bottom))",
  },
  grabber: {
    width:        36,
    height:       4,
    borderRadius: T.rPill,
    background:   T.dim,
    margin:       "var(--sp-2) auto 0",
    flexShrink:   0,
  },
  head: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    gap:            "var(--sp-2)",
  },
  step: {
    width:          44,
    height:         44,
    flexShrink:     0,
    borderRadius:   "50%",
    border:         "none",
    background:     T.raised,
    color:          T.text,
    fontSize:       "20px",
    lineHeight:     1,
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
  },
  monthLabel: {
    ...TYPE.h3,
    color:     T.text,
    textAlign: "center",
    flex:      1,
  },
  weekRow: {
    display:             "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap:                 "2px",
  },
  weekday: {
    ...TYPE.caption,
    fontWeight: 700,
    color:      T.muted,
    textAlign:  "center",
  },
  grid: {
    display:             "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap:                 "2px",
  },
  day: {
    aspectRatio:  "1 / 1",
    minHeight:    "40px",
    border:       "1.5px solid transparent",
    borderRadius: T.rSm,
    background:   "transparent",
    color:        T.text,
    fontSize:     "15px",
    fontWeight:   500,
    fontVariantNumeric: "tabular-nums",
  },
  dayToday: {
    // Marked, but never preselected.
    borderColor: T.accent2,
    color:       T.text,
  },
  dayPicked: {
    background: T.accent,
    color:      T.onAccent,
    fontWeight: 800,
  },
  actions: {
    display: "flex",
    gap:     "var(--sp-3)",
  },
  actionBtn: {
    flex:         1,
    minHeight:    "48px",
    borderRadius: T.rPill,
    border:       "none",
    fontSize:     "var(--fs-h3)",
    fontWeight:   600,
  },
  clear:  { background: T.raised, color: T.overdue },
  cancel: { background: T.raised, color: T.text },
  disabled: { opacity: 0.45 },
};
