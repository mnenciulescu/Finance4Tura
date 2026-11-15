import { useState, type ReactNode } from "react";
import { ErrorBoundary } from "../../app/ErrorBoundary";
import { Icon } from "../../ui";
import { readCollapsed, writeCollapsed, type BlockId } from "./state";
import s from "./OnePage.module.css";

/**
 * A One-Page block: title (collapses the block), subtitle, trailing actions,
 * an optional tab row, and its own error boundary so one failing query never
 * blanks the page.
 */
export function Block({
  id, title, subtitle, actions, tabs, toolbar, children,
}: {
  id: BlockId;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
  /** A row between the head and the tabs (e.g. Library search). */
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(() => !!readCollapsed()[id]);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    writeCollapsed({ ...readCollapsed(), [id]: next });
  };
  return (
    <section id={`block-${id}`} className={s.block} data-block={id} aria-labelledby={`block-${id}-title`}>
      <header className={s.blockHead}>
        <button type="button" className={s.blockTitleBtn} onClick={toggle} aria-expanded={!collapsed}>
          <h2 id={`block-${id}-title`} className={s.blockTitle}>{title}</h2>
          <Icon name="chevronDown" size={14} weight="semibold" className={s.blockChevron} style={{ transform: collapsed ? "rotate(-90deg)" : "none" }} />
        </button>
        {subtitle && <span className={s.blockSubtitle}>{subtitle}</span>}
        <span className={s.flex} />
        {!collapsed && actions && <div className={s.blockActions}>{actions}</div>}
      </header>
      {!collapsed && (
        <ErrorBoundary resetKey={id}>
          {toolbar && <div className={s.blockToolbar}>{toolbar}</div>}
          {tabs && <div className={s.blockTabs}>{tabs}</div>}
          <div className={s.blockBody}>{children}</div>
        </ErrorBoundary>
      )}
    </section>
  );
}

/** Scrollable chip tabs for lists of unknown length (people, locations). */
export function ChipTabs<T extends string>({
  label, value, options, onChange,
}: { label: string; value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className={s.chips} role="tablist" aria-label={label}>
      {options.map(o => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={selected}
            className={[s.chip, selected ? s.chipOn : ""].join(" ")}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A small inline link-style button ("View chart →"). */
export function LinkButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" className={s.link} onClick={onClick}>{children}</button>;
}
