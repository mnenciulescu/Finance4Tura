import { Checkbox as AriaCheckbox } from "react-aria-components";
import { haptic } from "../app/haptics";
import { Icon } from "./icons/Icon";
import s from "./Controls.module.css";

/* ── Checkbox (circular, Reminders style) ─────────────────────────────────── */

export interface CheckboxProps {
  label: string;
  isSelected: boolean;
  onChange: (v: boolean) => void;
  isDisabled?: boolean;
}

export function Checkbox({ label, isSelected, onChange, isDisabled }: CheckboxProps) {
  return (
    <AriaCheckbox
      aria-label={label}
      isSelected={isSelected}
      onChange={v => { haptic(v ? "success" : "light"); onChange(v); }}
      isDisabled={isDisabled}
      className={s.checkbox}
    >
      {({ isSelected: on }) => (
        <span className={[s.checkCircle, on ? s.checkOn : ""].join(" ")} aria-hidden="true">
          {on && <Icon name="check" size={16} weight="semibold" />}
        </span>
      )}
    </AriaCheckbox>
  );
}
