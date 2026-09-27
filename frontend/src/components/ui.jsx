/**
 * Shared visual primitives for the Dusk theme.
 *
 * Every value here comes from a token in `index.css`. Screens compose these
 * rather than restating what a card, tile, pill or bar looks like, so a shape
 * change lands in one place instead of eleven.
 *
 * These are presentational only — no data fetching, no routing, no state
 * beyond what a control needs to render itself.
 */

import { T, TYPE } from "./tokens";

// ── Surfaces ─────────────────────────────────────────────────────────────────

/** Primary panel: navy surface, large radius, soft shadow, no stroke. */
export function Card({ children, style, hero = false, ...rest }) {
  return (
    <div
      style={{
        background:   T.surface,
        borderRadius: hero ? T.rXl : T.rLg,
        boxShadow:    T.shadowCard,
        padding:      hero ? "var(--sp-5)" : "var(--sp-4)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * The one gradient element per screen. Used as a card header, so the bottom
 * corners stay square and the card below continues the shape.
 */
export function HeroHeader({ children, style, ...rest }) {
  return (
    <div
      style={{
        background:   T.heroGrad,
        color:        "var(--on-hero)",
        padding:      "var(--sp-4) var(--sp-5)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * A key number with a caption under it. `tone="accent"` is the tan tile used
 * for the single most important figure; `"raised"` is the slate sibling.
 */
export function StatTile({ value, label, tone = "raised", dot, style }) {
  const onTan = tone === "accent";
  return (
    <div style={{
      background:    onTan ? T.accent : T.raised,
      borderRadius:  T.rMd,
      padding:       "var(--sp-3)",
      display:       "flex",
      flexDirection: "column",
      gap:           "2px",
      minWidth:      0,
      ...style,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "6px", minWidth: 0,
      }}>
        {dot && (
          <span style={{
            width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0,
          }} />
        )}
        <span style={{
          ...TYPE.h3,
          fontWeight:         800,
          color:              onTan ? T.onAccent : T.text,
          fontVariantNumeric: "tabular-nums",
          overflow:           "hidden",
          textOverflow:       "ellipsis",
          whiteSpace:         "nowrap",
        }}>
          {value}
        </span>
      </div>
      <span style={{
        ...TYPE.caption,
        color:   onTan ? T.onAccent : T.muted,
        opacity: onTan ? 0.7 : 1,
      }}>
        {label}
      </span>
    </div>
  );
}

// ── Text ─────────────────────────────────────────────────────────────────────

/** Uppercase section label, optionally with a trailing action on the right. */
export function SectionHeader({ children, action, tone = "muted", style }) {
  return (
    <div style={{
      display:        "flex",
      alignItems:     "center",
      justifyContent: "space-between",
      gap:            "var(--sp-3)",
      marginBottom:   "var(--sp-3)",
      ...style,
    }}>
      <span style={{ ...TYPE.overline, color: tone === "accent" ? T.accent : T.muted }}>
        {children}
      </span>
      {action}
    </div>
  );
}

// ── Controls ─────────────────────────────────────────────────────────────────

/** Pill-shaped tag. Near-black fill with tan text, per the reference. */
export function Pill({ children, tone = "default", style }) {
  const tones = {
    default: { background: T.pill,   color: T.accent },
    accent:  { background: T.accent, color: T.onAccent },
    raised:  { background: T.raised, color: T.text },
    done:    { background: "var(--success-bg)", color: T.done },
  };
  return (
    <span style={{
      ...TYPE.caption,
      fontWeight:   700,
      padding:      "3px 10px",
      borderRadius: T.rPill,
      whiteSpace:   "nowrap",
      flexShrink:   0,
      ...tones[tone],
      ...style,
    }}>
      {children}
    </span>
  );
}

/** 8px status dot. Colour carries meaning, so callers pair it with a label. */
export function StatusDot({ color, size = 8, style }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: "50%",
      background: color, flexShrink: 0, display: "inline-block", ...style,
    }} />
  );
}

/**
 * 22px rounded-square checkbox. Unchecked is a raised tile with a blue-grey
 * ring; checked is a sage fill with a navy tick. Rendered as a button so it
 * carries a real 44px touch target via padding on the wrapper.
 */
export function Checkbox({ checked, onChange, title, size = 22 }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={checked}
      onClick={onChange}
      style={{
        width: size, height: size, flexShrink: 0,
        // The one documented departure from the radius scale: --r-sm (10px) on
        // a 22px box renders as a circle, which reads as a radio button — pick
        // one of several. These are independent toggles, so the shape has to
        // stay recognisably square.
        borderRadius: "8px",
        border:     checked ? "none" : `1.5px solid ${T.accent2}`,
        background: checked ? T.done : T.raised,
        color:      T.onAccent,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        padding: 0,
        transition: "background 150ms ease-out, border-color 150ms ease-out",
      }}
    >
      {checked && (
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 16 16" fill="none"
             stroke="currentColor" strokeWidth="2.6"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 8.5 L6.5 12 L13 4.5" />
        </svg>
      )}
    </button>
  );
}

/**
 * Two-segment pill bar. Widths animate, so a toggled row shows the bar move
 * rather than jump.
 */
export function ProgressBar({ segments, height = 12, style }) {
  const total = segments.reduce((sum, seg) => sum + Math.max(0, seg.value), 0);
  return (
    <div style={{
      height,
      borderRadius: T.rPill,
      background:   T.raised,
      overflow:     "hidden",
      display:      "flex",
      gap:          "2px",
      ...style,
    }}>
      {total > 0 && segments.filter(seg => seg.value > 0).map(seg => (
        <div
          key={seg.key}
          title={seg.title}
          style={{
            flex:         seg.value,
            background:   seg.color,
            borderRadius: T.rPill,
            minWidth:     0,
            transition:   "flex-grow 300ms ease-in-out",
          }}
        />
      ))}
    </div>
  );
}

/** Primary / secondary / ghost / destructive, all pill-shaped and 48px tall. */
export function Button({ variant = "primary", children, style, ...rest }) {
  const variants = {
    primary:   { background: T.accent, color: T.onAccent,  border: "none" },
    secondary: { background: T.raised, color: T.text,      border: "none" },
    ghost:     { background: "transparent", color: T.accent, border: "none" },
    danger:    { background: T.raised, color: T.overdue,   border: "none" },
  };
  return (
    <button
      style={{
        ...TYPE.h3,
        minHeight:    "48px",
        padding:      "0 var(--sp-5)",
        borderRadius: T.rPill,
        display:      "inline-flex",
        alignItems:   "center",
        justifyContent: "center",
        gap:          "var(--sp-2)",
        ...variants[variant],
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Circular 44px icon button — the minimum comfortable touch target. */
export function IconButton({ children, tone = "raised", size = 44, style, ...rest }) {
  return (
    <button
      style={{
        width: size, height: size,
        borderRadius: "50%",
        border:     "none",
        background: tone === "pill" ? T.pill : T.raised,
        color:      tone === "pill" ? T.accent : T.muted,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        padding: 0,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Labelled field: the label sits above the control, never inside it. */
export function Input({ label, style, wrapStyle, ...rest }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 0, ...wrapStyle }}>
      {label && <span style={{ ...TYPE.label, color: T.muted }}>{label}</span>}
      <input
        style={{
          height:       "48px",
          padding:      "0 var(--sp-3)",
          borderRadius: T.rMd,
          border:       "none",
          background:   T.raised,
          color:        T.text,
          fontSize:     "16px",
          fontFamily:   "inherit",
          width:        "100%",
          minWidth:     0,
          ...style,
        }}
        {...rest}
      />
    </label>
  );
}

// ── Overlays ─────────────────────────────────────────────────────────────────

/** Bottom sheet: column-width, rounded top, grab handle, safe-area padding. */
export function Sheet({ children, onClose, label, style }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: T.backdrop,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        zIndex: 700,
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={label}
        onClick={e => e.stopPropagation()}
        style={{
          background:    T.surface,
          borderRadius:  `${T.rXl} ${T.rXl} 0 0`,
          width:         "100%",
          maxWidth:      "var(--app-max-w)",
          maxHeight:     "92dvh",
          display:       "flex",
          flexDirection: "column",
          overflow:      "hidden",
          boxShadow:     T.shadowSheet,
          ...style,
        }}
      >
        <div style={{
          width: 36, height: 4, borderRadius: T.rPill,
          background: T.dim, margin: "var(--sp-2) auto 0", flexShrink: 0,
        }} />
        {children}
      </div>
    </div>
  );
}

/** Rectangular shimmer placeholder. */
export function Skeleton({ height = 16, width = "100%", style }) {
  return <div className="skeleton" style={{ height, width, ...style }} />;
}
