import { useState } from "react";
import { Button as AriaButton, Label, ListBox, ListBoxItem, Popover, Select, SelectValue } from "react-aria-components";
import { useOverlayHistory } from "../app/overlays";
import { Icon } from "./icons/Icon";
import s from "./Controls.module.css";
import o from "./Overlays.module.css";

/* ── Picker (pull-down list for a value) ──────────────────────────────────── */

export interface PickerOption<T extends string> { value: T; label: string; color?: string; }

export interface PickerProps<T extends string> {
  label: string;
  value: T | "";
  options: PickerOption<T>[];
  onChange: (v: T) => void;
  isDisabled?: boolean;
  placeholder?: string;
  /** Render as a form row (label left). Default true. */
  row?: boolean;
  error?: string | null;
}

export function Picker<T extends string>({
  label, value, options, onChange, isDisabled, placeholder = "Choose", row = true, error,
}: PickerProps<T>) {
  const [open, setOpen] = useState(false);
  useOverlayHistory(open, () => setOpen(false));
  const select = (
    <Select
      aria-label={row ? undefined : label}
      selectedKey={value === "" ? null : value}
      onSelectionChange={k => { if (k != null) onChange(String(k) as T); }}
      isDisabled={isDisabled}
      isOpen={open}
      onOpenChange={setOpen}
      className={s.picker}
      placeholder={placeholder}
    >
      {row && <Label className={s.fieldLabel}>{label}</Label>}
      <AriaButton className={s.pickerButton}>
        <SelectValue className={s.pickerValue}>
          {({ selectedText, isPlaceholder }) => {
            const opt = options.find(o => o.value === value);
            return (
              <>
                {opt?.color && <span className={s.pickerDot} style={{ background: opt.color }} />}
                <span className={isPlaceholder ? s.pickerPlaceholder : undefined}>{isPlaceholder ? placeholder : selectedText}</span>
              </>
            );
          }}
        </SelectValue>
        <Icon name="chevronUpDown" size={16} weight="semibold" className={s.pickerChevron} />
      </AriaButton>
      <Popover className={o.popover} placement="bottom end" offset={4}>
        <ListBox className={o.menu} items={options.map(opt => ({ id: opt.value, ...opt }))}>
          {item => (
            <ListBoxItem id={item.id} textValue={item.label} className={o.menuItem}>
              {({ isSelected }) => (
                <>
                  <span className={o.menuCheck} aria-hidden="true">{isSelected && <Icon name="check" size={16} weight="semibold" />}</span>
                  <span className={o.menuLabel}>{item.label}</span>
                  {item.color && <span className={s.pickerDot} style={{ background: item.color }} />}
                </>
              )}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </Select>
  );
  if (!row) return select;
  return (
    <li className={s.fieldRow}>
      {select}
      {error && <p className={s.fieldError} role="alert">{error}</p>}
    </li>
  );
}
