import { useId, type ReactNode, type KeyboardEvent } from "react";
import { ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { m } from "motion/react";
import { haptic } from "../app/haptics";
import s from "./Controls.module.css";

/* ── SegmentedControl (a form value) ──────────────────────────────────────── */

export interface SegmentOption<T extends string> { value: T; label: ReactNode; }

export interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  options: SegmentOption<T>[];
  onChange: (v: T) => void;
  isDisabled?: boolean;
  className?: string;
}

/** iOS segmented control for a form value (radiogroup semantics). */
export function SegmentedControl<T extends string>({ label, value, options, onChange, isDisabled, className }: SegmentedControlProps<T>) {
  const layoutId = useId();
  return (
    <ToggleButtonGroup
      aria-label={label}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[value]}
      onSelectionChange={keys => {
        const next = [...keys][0] as T | undefined;
        if (next && next !== value) { haptic("light"); onChange(next); }
      }}
      isDisabled={isDisabled}
      className={[s.segmented, className ?? ""].join(" ")}
    >
      {options.map(opt => (
        <ToggleButton key={opt.value} id={opt.value} className={s.segment}>
          {({ isSelected }) => (
            <>
              {isSelected && <m.span layoutId={layoutId} className={s.thumb} transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <span className={s.segmentLabel}>{opt.label}</span>
            </>
          )}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

/* ── SegmentedTabs (switches views / routes) ──────────────────────────────── */

export interface SegmentedTabsProps<T extends string> {
  label: string;
  value: T;
  options: SegmentOption<T>[];
  onChange: (v: T) => void;
  className?: string;
}

/** Same look as SegmentedControl, with tablist semantics for switching views. */
export function SegmentedTabs<T extends string>({ label, value, options, onChange, className }: SegmentedTabsProps<T>) {
  const layoutId = useId();
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = options.findIndex(o => o.value === value);
    if (e.key === "ArrowRight") onChange(options[(idx + 1) % options.length].value);
    if (e.key === "ArrowLeft") onChange(options[(idx - 1 + options.length) % options.length].value);
  };
  return (
    <div role="tablist" aria-label={label} className={[s.segmented, className ?? ""].join(" ")} onKeyDown={onKeyDown}>
      {options.map(opt => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={s.segment}
            data-selected={selected || undefined}
            onClick={() => { if (!selected) { haptic("light"); onChange(opt.value); } }}
          >
            {selected && <m.span layoutId={layoutId} className={s.thumb} transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <span className={s.segmentLabel}>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
