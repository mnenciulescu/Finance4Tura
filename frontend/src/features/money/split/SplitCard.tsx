import { Icon, ProgressRing, PullDownMenu, type MenuEntry } from "../../../ui";
import { round2, splitStats } from "../../../utils/split";
import { fmtDate, fmtNum } from "../../../utils/format";
import type { SplitPayment } from "../../../types";
import { SplitSlots } from "./SplitSlots";
import type { SaveState } from "./useSplitEditor";
import s from "./Split.module.css";

/**
 * One split payment: coverage ring, title, total, date, paid/count and what is
 * left; expanded it shows the slot grid, coverage and the ··· menu. Shared by
 * Money → Split and One-Page.
 */
export function SplitCard({
  entry, expanded, onToggle, onSetOcc, onFillRest, onClearAll, onEdit, onDelete, saveState,
}: {
  entry: SplitPayment;
  expanded: boolean;
  onToggle: () => void;
  onSetOcc: (e: SplitPayment, idx: number, v: string) => void;
  onFillRest: (e: SplitPayment) => void;
  onClearAll: (e: SplitPayment) => void;
  onEdit: () => void;
  onDelete: () => void;
  saveState?: SaveState;
}) {
  const { paid, count, covered, remaining, complete } = splitStats(entry);
  const isAmount = entry.occurrenceType === "amount";

  const menu: MenuEntry[] = [
    ...(!complete && isAmount
      ? [{ id: "rest", label: `Cover Rest (${fmtNum(remaining)} ${entry.currency})`, icon: "sparkle" as const, onAction: () => onFillRest(entry) }]
      : []),
    ...(paid > 0 ? [{ id: "clear", label: "Clear All", icon: "xmark" as const, onAction: () => onClearAll(entry) }] : []),
    { id: "edit", label: "Edit", icon: "pencil", onAction: onEdit },
    { id: "sep", separator: true },
    { id: "delete", label: "Delete", icon: "trash", destructive: true, onAction: onDelete },
  ];

  return (
    <article className={s.entry} data-entry={entry.splitPaymentId} data-complete={complete || undefined}>
      <button type="button" className={s.entryHead} onClick={onToggle} aria-expanded={expanded}>
        <ProgressRing done={paid} total={count} complete={complete} size={32} />
        <span className={s.entryText}>
          <span className={s.entryTitleRow}>
            <span className={s.entryTitle}>{entry.title}</span>
            <span className={s.entryTotal}>{fmtNum(entry.totalAmount)} {entry.currency}</span>
          </span>
          <span className={s.entryMeta}>
            {fmtDate(entry.createdDate)} · {paid}/{count}
            {isAmount && !complete && <> · <span className={s.left}>{fmtNum(remaining)} left</span></>}
            {complete && " · Settled"}
          </span>
        </span>
        <Icon name="chevronDown" size={18} weight="semibold" className={s.chevron} style={{ transform: expanded ? "rotate(180deg)" : "none" }} />
      </button>
      {expanded && (
        <div className={s.entryBody}>
          <SplitSlots entry={entry} onSetOcc={onSetOcc} />
          <div className={s.footerRow}>
            {isAmount ? (
              <span className={s.coverLine}>
                Covered <strong>{fmtNum(covered)}</strong> of {fmtNum(entry.totalAmount)} {entry.currency}
                {covered > Number(entry.totalAmount || 0) && (
                  <span className={s.over}> · over by {fmtNum(round2(covered - entry.totalAmount))}</span>
                )}
              </span>
            ) : <span />}
            <span className={[s.saveState, saveState === "error" ? s.saveError : ""].join(" ")} aria-live="polite">
              {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Not saved" : ""}
            </span>
            <PullDownMenu label={`Actions for ${entry.title}`} items={menu} />
          </div>
        </div>
      )}
    </article>
  );
}
