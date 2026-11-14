import { haptic } from "../app/haptics";
import s from "./Controls.module.css";

/* ── Stepper ──────────────────────────────────────────────────────────────── */

export function Stepper({
  label, value, onChange, min = 0, max = Infinity,
}: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  const set = (v: number) => { const c = Math.min(max, Math.max(min, v)); if (c !== value) { haptic("light"); onChange(c); } };
  return (
    <div className={s.stepper} role="group" aria-label={label}>
      <button type="button" className={s.stepBtn} onClick={() => set(value - 1)} disabled={value <= min} aria-label={`Decrease ${label}`}>
        −
      </button>
      <span className={s.stepValue} aria-live="polite">{value}</span>
      <button type="button" className={s.stepBtn} onClick={() => set(value + 1)} disabled={value >= max} aria-label={`Increase ${label}`}>+</button>
    </div>
  );
}
