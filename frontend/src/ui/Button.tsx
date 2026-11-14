import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Icon, type IconName } from "./icons/Icon";
import s from "./Button.module.css";

export type ButtonVariant = "filled" | "tinted" | "gray" | "plain" | "destructive" | "destructiveTinted";
export type ButtonSize = "large" | "medium" | "small";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  block?: boolean;
  loading?: boolean;
  children?: ReactNode;
}

/** iOS-style button: filled, tinted, gray, plain, destructive. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "filled", size = "medium", icon, block, loading, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={[s.button, s[variant], s[size], block ? s.block : "", className ?? ""].join(" ")}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className={s.spinner} aria-hidden="true" /> : icon && <Icon name={icon} size={size === "small" ? 16 : 20} weight="semibold" />}
      {children != null && <span className={s.label}>{children}</span>}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  /** Accessible name — required, since there is no visible text. */
  label: string;
  tone?: "plain" | "circle" | "tinted";
  size?: number;
  filled?: boolean;
}

/** 44 pt hit area around an icon; optional 30 pt circle behind it. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, tone = "plain", size = 22, filled, className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={[s.iconButton, s[`icon_${tone}`], className ?? ""].join(" ")}
      {...rest}
    >
      <span className={s.iconInner}>
        <Icon name={icon} size={size} weight="semibold" filled={filled} />
      </span>
    </button>
  );
});
