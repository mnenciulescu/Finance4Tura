import { haptic } from "../app/haptics";
import { Icon } from "./icons/Icon";
import s from "./Controls.module.css";

/* ── Rating ───────────────────────────────────────────────────────────────── */

/** Five stars; tap to set, tap the current value to clear (null). */
export function Rating({
  value, onChange, size = 22, label = "Rating", readOnly,
}: { value: number | null; onChange?: (v: number | null) => void; size?: number; label?: string; readOnly?: boolean }) {
  if (readOnly || !onChange) {
    return (
      <span className={s.rating} role="img" aria-label={value ? `${value} out of 5 stars` : "Not rated"}>
        {[1, 2, 3, 4, 5].map(n => (
          <Icon key={n} name={value != null && n <= value ? "starFill" : "star"} size={size} className={value != null && n <= value ? s.starOn : s.starOff} />
        ))}
      </span>
    );
  }
  return (
    <span className={s.rating} role="group" aria-label={label}>
      {[1, 2, 3, 4, 5].map(n => {
        const on = value != null && n <= value;
        return (
          <button
            key={n}
            type="button"
            className={s.starButton}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            aria-pressed={value === n}
            onClick={e => { e.stopPropagation(); haptic("light"); onChange(n === value ? null : n); }}
          >
            <Icon name={on ? "starFill" : "star"} size={size} className={on ? s.starOn : s.starOff} />
          </button>
        );
      })}
    </span>
  );
}
