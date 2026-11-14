import { lazy, Suspense, useState } from "react";
import dayjs from "dayjs";
import { Sheet } from "./Sheet";
import { Icon } from "./icons/Icon";
import { haptic } from "../app/haptics";
import s from "./DatePicker.module.css";
import c from "./Controls.module.css";

const formatDate = (iso: string | null | undefined, fmt = "D MMM YYYY") =>
  iso ? dayjs(iso).format(fmt) : "";

/* ── DatePickerSheet ──────────────────────────────────────────────────────── */

const CalendarBody = lazy(() => import("./CalendarBody"));

export interface DatePickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Accessible name of what is being dated (e.g. "Laptop — installment 2"). */
  label: string;
  value: string;
  onPick: (iso: string) => void;
  /** Shows a Clear action when provided (enabled only when there is a value). */
  onClear?: () => void;
  minValue?: string;
  maxValue?: string;
}

/**
 * The app's own calendar in a sheet (proposal §6.4). Monday first, with Clear.
 * Native <input type="date"> stays banned: on iOS it opens on today and commits
 * today when dismissed, so a stray tap records a value. Deliberately offers no
 * "Today" shortcut for the same reason; today is only marked, never selected.
 * The calendar itself loads the first time a picker opens.
 */
export function DatePickerSheet({ isOpen, onClose, label, value, onPick, onClear, minValue, maxValue }: DatePickerSheetProps) {
  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={`${label}: pick a date`} hideTitle>
      <Suspense fallback={<div className={s.calendarLoading} />}>
        {isOpen && <CalendarBody label={label} value={value} onPick={onPick} minValue={minValue} maxValue={maxValue} />}
      </Suspense>
      <div className={s.actions}>
        {onClear && (
          <button type="button" className={[s.action, s.clear].join(" ")} onClick={onClear} disabled={!value}>
            Clear
          </button>
        )}
        <button type="button" className={s.action} onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  );
}

/* ── DateField (form row) ─────────────────────────────────────────────────── */

export interface DateFieldProps {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  error?: string | null;
  minValue?: string;
  maxValue?: string;
  /** Allow clearing (optional dates). */
  clearable?: boolean;
  placeholder?: string;
  row?: boolean;
}

export function DateField({ label, value, onChange, error, minValue, maxValue, clearable, placeholder = "None", row = true }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const button = (
    <button
      type="button"
      className={s.fieldButton}
      onClick={() => setOpen(true)}
      aria-label={`${label}: ${value ? formatDate(value) : "pick a date"}`}
    >
      <span className={value ? s.fieldValue : s.fieldPlaceholder}>{value ? formatDate(value) : placeholder}</span>
    </button>
  );
  return (
    <>
      {row ? (
        <li className={c.fieldRow}>
          <div className={c.fieldLine}>
            <span className={c.fieldLabel}>{label}</span>
            <div className={c.fieldControl}>{button}</div>
          </div>
          {error && <p className={c.fieldError} role="alert">{error}</p>}
        </li>
      ) : button}
      <DatePickerSheet
        isOpen={open}
        onClose={() => setOpen(false)}
        label={label}
        value={value}
        minValue={minValue}
        maxValue={maxValue}
        onPick={iso => { onChange(iso); setOpen(false); }}
        onClear={clearable ? () => { onChange(""); setOpen(false); } : undefined}
      />
    </>
  );
}

/* ── MonthField (YYYY-MM) ─────────────────────────────────────────────────── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function MonthField({ label, value, onChange }: { label: string; value: string; onChange: (ym: string) => void }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number((value || dayjs().format("YYYY-MM")).slice(0, 4)));
  const shown = value ? dayjs(`${value}-01`).format("MMM YYYY") : "None";
  return (
    <>
      <li className={c.fieldRow}>
        <div className={c.fieldLine}>
          <span className={c.fieldLabel}>{label}</span>
          <div className={c.fieldControl}>
            <button
              type="button"
              className={s.fieldButton}
              aria-label={`${label}: ${value ? shown : "pick a month"}`}
              onClick={() => { setYear(Number((value || dayjs().format("YYYY-MM")).slice(0, 4))); setOpen(true); }}
            >
              <span className={value ? s.fieldValue : s.fieldPlaceholder}>{shown}</span>
            </button>
          </div>
        </div>
      </li>
      <Sheet isOpen={open} onClose={() => setOpen(false)} title={`${label}: pick a month`} hideTitle>
        <div className={s.calendar}>
          <header className={s.head}>
            <span className={s.month}>{year}</span>
            <div className={s.steps}>
              <button type="button" className={s.step} aria-label="Previous year" onClick={() => setYear(y => y - 1)}>
                <Icon name="chevronLeft" size={22} weight="semibold" />
              </button>
              <button type="button" className={s.step} aria-label="Next year" onClick={() => setYear(y => y + 1)}>
                <Icon name="chevronRight" size={22} weight="semibold" />
              </button>
            </div>
          </header>
          <div className={s.monthGrid}>
            {MONTHS.map((mLabel, i) => {
              const ym = `${year}-${String(i + 1).padStart(2, "0")}`;
              const selected = ym === value;
              return (
                <button
                  key={ym}
                  type="button"
                  className={[s.monthCell, selected ? s.monthSelected : ""].join(" ")}
                  aria-pressed={selected}
                  aria-label={dayjs(`${ym}-01`).format("MMMM YYYY")}
                  onClick={() => { haptic("light"); onChange(ym); setOpen(false); }}
                >
                  {mLabel}
                </button>
              );
            })}
          </div>
        </div>
        <div className={s.actions}>
          <button type="button" className={[s.action, s.clear].join(" ")} disabled={!value} onClick={() => { onChange(""); setOpen(false); }}>
            Clear
          </button>
          <button type="button" className={s.action} onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </Sheet>
    </>
  );
}
