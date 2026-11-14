import type { ReactNode } from "react";
import { Input, Label, TextArea, TextField as AriaTextField } from "react-aria-components";
import s from "./Controls.module.css";

/* ── Form rows ────────────────────────────────────────────────────────────── */

/**
 * One row of an inset-grouped form: label on the left, control on the right,
 * error underneath. Used inside <List>.
 */
export function FieldRow({
  label, children, error, htmlFor, stacked,
}: { label?: ReactNode; children: ReactNode; error?: string | null; htmlFor?: string; stacked?: boolean }) {
  return (
    <li className={[s.fieldRow, stacked ? s.fieldStacked : ""].join(" ")}>
      <div className={s.fieldLine}>
        {label != null && (
          htmlFor ? <label className={s.fieldLabel} htmlFor={htmlFor}>{label}</label> : <span className={s.fieldLabel}>{label}</span>
        )}
        <div className={s.fieldControl}>{children}</div>
      </div>
      {error && <p className={s.fieldError} role="alert">{error}</p>}
    </li>
  );
}

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "password" | "email" | "search";
  inputMode?: "text" | "decimal" | "numeric" | "email" | "search";
  autoComplete?: string;
  autoCapitalize?: string;
  enterKeyHint?: "done" | "go" | "next" | "search" | "send";
  error?: string | null;
  isDisabled?: boolean;
  autoFocus?: boolean;
  /** Trailing unit / suffix inside the row (e.g. "RON", "m³"). */
  suffix?: ReactNode;
  /** Render as a row inside a form List (label left). Default true. */
  row?: boolean;
  align?: "start" | "end";
  name?: string;
  multiline?: boolean;
  "aria-label"?: string;
}

export function TextField({
  label, value, onChange, placeholder, type = "text", inputMode, autoComplete, autoCapitalize, enterKeyHint,
  error, isDisabled, autoFocus, suffix, row = true, align = "start", name, multiline,
}: TextFieldProps) {
  const field = (
    <AriaTextField
      value={value}
      onChange={onChange}
      isDisabled={isDisabled}
      isInvalid={!!error}
      autoFocus={autoFocus}
      name={name}
      type={type}
      className={s.textField}
      aria-label={row ? undefined : label}
    >
      {row && <Label className={s.fieldLabel}>{label}</Label>}
      <div className={s.inputWrap}>
        {multiline ? (
          <TextArea className={[s.input, s.textarea].join(" ")} placeholder={placeholder} rows={3} />
        ) : (
          <Input
            className={[s.input, align === "end" ? s.alignEnd : ""].join(" ")}
            placeholder={placeholder}
            inputMode={inputMode}
            autoComplete={autoComplete}
            autoCapitalize={autoCapitalize}
            enterKeyHint={enterKeyHint}
          />
        )}
        {suffix && <span className={s.suffix}>{suffix}</span>}
      </div>
    </AriaTextField>
  );
  if (!row) return field;
  return (
    <li className={[s.fieldRow, multiline ? s.fieldStacked : ""].join(" ")}>
      {field}
      {error && <p className={s.fieldError} role="alert">{error}</p>}
    </li>
  );
}
