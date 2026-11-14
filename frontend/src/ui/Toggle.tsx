import { Switch } from "react-aria-components";
import { haptic } from "../app/haptics";
import s from "./Controls.module.css";

/* ── Toggle (switch) ──────────────────────────────────────────────────────── */

export interface ToggleProps {
  label: string;
  isSelected: boolean;
  onChange: (v: boolean) => void;
  isDisabled?: boolean;
  /** Visually hide the label (it stays the accessible name). */
  hideLabel?: boolean;
}

export function Toggle({ label, isSelected, onChange, isDisabled, hideLabel = true }: ToggleProps) {
  return (
    <Switch
      isSelected={isSelected}
      onChange={v => { haptic("light"); onChange(v); }}
      isDisabled={isDisabled}
      className={s.switch}
      aria-label={hideLabel ? label : undefined}
    >
      {!hideLabel && <span className={s.switchLabel}>{label}</span>}
      <span className={s.track} aria-hidden="true"><span className={s.knob} /></span>
    </Switch>
  );
}
