import { useId, useState, type ReactNode, type MouseEventHandler } from "react";
import { Icon, type IconName } from "./icons/Icon";
import s from "./List.module.css";

/* ── List ─────────────────────────────────────────────────────────────────── */

export interface ListProps {
  variant?: "insetGrouped" | "plain";
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}

/** Inset grouped (16 pt margin, rounded) or plain (edge to edge) list. */
export function List({ variant = "insetGrouped", children, className, ...rest }: ListProps) {
  return (
    <ul className={[s.list, s[variant], className ?? ""].join(" ")} role="list" {...rest}>
      {children}
    </ul>
  );
}

/* ── ListSection ──────────────────────────────────────────────────────────── */

export interface ListSectionProps {
  header?: ReactNode;
  /** Trailing control in the header row (e.g. "See All", "+ New Entry"). */
  headerAction?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  /** Renders the header as a disclosure that shows and hides the content. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  /** Plain sections hold free-form content rather than a list. */
  bare?: boolean;
  id?: string;
}

/** A titled group: footnote-size uppercase header, content, optional footer. */
export function ListSection({
  header, headerAction, footer, children, collapsible, defaultOpen = true,
  open: openProp, onOpenChange, className, bare, id,
}: ListSectionProps) {
  const [openState, setOpenState] = useState(defaultOpen);
  const open = openProp ?? openState;
  const setOpen = (v: boolean) => {
    if (openProp === undefined) setOpenState(v);
    onOpenChange?.(v);
  };
  const contentId = useId();

  return (
    <section className={[s.section, className ?? ""].join(" ")} id={id}>
      {(header || headerAction) && (
        <div className={s.sectionHeader}>
          {collapsible ? (
            <button
              type="button"
              className={s.sectionToggle}
              aria-expanded={open}
              aria-controls={contentId}
              onClick={() => setOpen(!open)}
            >
              <span className={s.sectionTitle}>{header}</span>
              <Icon
                name="chevronDown"
                size={16}
                weight="semibold"
                className={s.chevron}
                style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
              />
            </button>
          ) : (
            <h2 className={s.sectionTitle}>{header}</h2>
          )}
          {headerAction && <div className={s.sectionAction}>{headerAction}</div>}
        </div>
      )}
      {(!collapsible || open) && (
        <div id={contentId} className={bare ? s.bare : undefined}>
          {children}
        </div>
      )}
      {footer && (!collapsible || open) && <p className={s.sectionFooter}>{footer}</p>}
    </section>
  );
}

/* ── ListRow ──────────────────────────────────────────────────────────────── */

export interface ListRowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Shows a disclosure chevron and makes the row a button. */
  onPress?: MouseEventHandler<HTMLElement>;
  chevron?: boolean;
  destructive?: boolean;
  /** Tinted row background (e.g. special expenses). */
  tone?: "special" | "negative";
  dimmed?: boolean;
  className?: string;
  /** Extra attributes for the row element (tests, data hooks). */
  rowProps?: Record<string, unknown>;
  children?: ReactNode;
  "aria-label"?: string;
}

export function ListRow({
  title, subtitle, leading, trailing, onPress, chevron, destructive, tone, dimmed, className, rowProps, children,
  "aria-label": ariaLabel,
}: ListRowProps) {
  const body = (
    <>
      {leading && <span className={s.leading}>{leading}</span>}
      <span className={s.main}>
        <span className={[s.title, destructive ? s.destructive : ""].join(" ")}>{title}</span>
        {subtitle && <span className={s.subtitle}>{subtitle}</span>}
        {children}
      </span>
      {trailing != null && <span className={s.trailing}>{trailing}</span>}
      {(chevron ?? (!!onPress && !destructive)) && (
        <Icon name="chevronRight" size={16} weight="semibold" className={s.chevronRight} />
      )}
    </>
  );
  const cls = [s.row, tone ? s[`tone_${tone}`] : "", dimmed ? s.dimmed : "", className ?? ""].join(" ");
  return (
    <li className={s.item} {...rowProps}>
      {onPress ? (
        <button type="button" className={[cls, s.pressable].join(" ")} onClick={onPress} aria-label={ariaLabel}>
          {body}
        </button>
      ) : (
        <div className={cls} aria-label={ariaLabel}>{body}</div>
      )}
    </li>
  );
}

/** A full-width action row (e.g. "Sign Out", "+ Add Expense"). */
export function ListButtonRow({
  children, onPress, destructive, icon, disabled,
}: { children: ReactNode; onPress: () => void; destructive?: boolean; icon?: IconName; disabled?: boolean }) {
  return (
    <li className={s.item}>
      <button
        type="button"
        className={[s.row, s.pressable, s.buttonRow, destructive ? s.destructive : ""].join(" ")}
        onClick={onPress}
        disabled={disabled}
      >
        {icon && <Icon name={icon} size={20} weight="semibold" />}
        <span>{children}</span>
      </button>
    </li>
  );
}

/** Leading icon tile, iOS Settings style. */
export function IconTile({ icon, color = "var(--tint)" }: { icon: IconName; color?: string }) {
  return (
    <span className={s.iconTile} style={{ background: color }} aria-hidden="true">
      <Icon name={icon} size={18} weight="semibold" />
    </span>
  );
}

/** A bare list item (keeps the separator) for custom rows such as swipeable ones. */
export function ListItem({ children, className, ...rest }: { children: ReactNode; className?: string } & Record<string, unknown>) {
  return <li className={[s.item, className ?? ""].join(" ")} {...rest}>{children}</li>;
}
