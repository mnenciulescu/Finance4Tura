import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ActionSheet, Button, EmptyState, Icon, IconButton, ListSection, Notice, ProgressRing, PullDownMenu, ScreenSkeleton,
  useToast, type MenuEntry,
} from "../../../ui";
import { MoneyScreen } from "../MoneyScreen";
import { keys, useSplitPayments } from "../../../data/queries";
import { useDeleteSplit } from "../../../data/mutations";
import { byCreatedDesc, round2, splitStats } from "../../../utils/split";
import { fmtDate, fmtNum } from "../../../utils/format";
import type { SplitPayment } from "../../../types";
import { SettleAlert, SplitSlots } from "./SplitSlots";
import { useSplitEditor, type SaveState } from "./useSplitEditor";
import { SplitFormSheet } from "./SplitFormSheet";
import s from "./Split.module.css";

/**
 * Money → Split (proposal §8.5). Open entries start expanded, settled ones
 * collapsed; tapping a head toggles either way.
 */
export default function SplitScreen() {
  const qc = useQueryClient();
  const splits = useSplitPayments();
  const editor = useSplitEditor();
  const del = useDeleteSplit();
  const toast = useToast();
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [showSettled, setShowSettled] = useState(false);
  const [form, setForm] = useState<{ entry?: SplitPayment } | null>(null);
  const [toDelete, setToDelete] = useState<SplitPayment | null>(null);
  const pendingId = useRef<string | null>(null);
  pendingId.current = editor.pendingSettle?.entryId ?? null;

  const { open, done } = useMemo(() => {
    const sorted = [...(splits.data ?? [])].sort(byCreatedDesc);
    // An entry awaiting settle confirmation stays in "In progress".
    const isOpen = (e: SplitPayment) => !splitStats(e).complete || e.splitPaymentId === pendingId.current;
    return { open: sorted.filter(isOpen), done: sorted.filter(e => !isOpen(e)) };
  }, [splits.data, editor.pendingSettle]); // eslint-disable-line react-hooks/exhaustive-deps

  const outstanding = useMemo(() => {
    const acc: Record<string, number> = {};
    open.forEach(e => {
      if (e.occurrenceType !== "amount") return;
      acc[e.currency] = round2((acc[e.currency] ?? 0) + splitStats(e).remaining);
    });
    return Object.entries(acc).filter(([, v]) => v > 0);
  }, [open]);

  const isExpanded = (e: SplitPayment, complete: boolean) => overrides[e.splitPaymentId] ?? !complete;
  const toggle = (e: SplitPayment, complete: boolean) =>
    setOverrides(prev => ({ ...prev, [e.splitPaymentId]: !(prev[e.splitPaymentId] ?? !complete) }));

  const doDelete = (entry: SplitPayment) => {
    setToDelete(null);
    del.mutate(entry.splitPaymentId, {
      onSuccess: () => toast.show({ message: "Split payment deleted", icon: "trash" }),
      onError: () => toast.show({ message: "Could not delete the split payment.", tone: "negative" }),
    });
  };

  // The default comes from the group, not from completeness: an entry whose
  // last slot was just filled stays in progress (and expanded) while the
  // "Mark as settled?" question is open.
  const card = (entry: SplitPayment, settled: boolean) => (
    <EntryCard
      key={entry.splitPaymentId}
      entry={entry}
      expanded={isExpanded(entry, settled)}
      onToggle={() => toggle(entry, settled)}
      onSetOcc={editor.setOcc}
      onFillRest={editor.fillRest}
      onClearAll={editor.clearAll}
      onEdit={() => setForm({ entry })}
      onDelete={() => setToDelete(entry)}
      saveState={editor.saveState[entry.splitPaymentId]}
    />
  );

  return (
    <MoneyScreen
      segment="split"
      onRefresh={() => qc.invalidateQueries({ queryKey: keys.splits })}
      actions={<IconButton icon="plus" label="New split payment" onClick={() => setForm({})} />}
    >
      {splits.isError && <Notice>Could not load split payments.</Notice>}
      {splits.isPending ? (
        <ScreenSkeleton blocks={2} />
      ) : (splits.data ?? []).length === 0 ? (
        <EmptyState
          icon="split"
          title="No split payments yet"
          message="Log a payment split into instalments and tick them off as they're paid."
          action={<Button variant="tinted" icon="plus" onClick={() => setForm({})}>Add Your First One</Button>}
        />
      ) : (
        <>
          <p className={s.summary} data-testid="split-summary">
            <strong>{open.length}</strong> open · <strong>{done.length}</strong> settled
            {outstanding.length > 0 && (
              <> · left to cover {outstanding.map(([cur, v]) => `${fmtNum(v)} ${cur}`).join(" · ")}</>
            )}
          </p>

          {open.length > 0 && (
            <ListSection header={`In progress · ${open.length}`}>
              {open.map(e => card(e, false))}
            </ListSection>
          )}
          {done.length > 0 && (
            <ListSection header={`Settled · ${done.length}`} collapsible open={showSettled} onOpenChange={setShowSettled}>
              {done.map(e => card(e, true))}
            </ListSection>
          )}
        </>
      )}

      <SettleAlert pending={editor.pendingSettle} onConfirm={editor.confirmSettle} onCancel={editor.cancelSettle} />
      <SplitFormSheet target={form} onClose={() => setForm(null)} />
      <ActionSheet
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Delete “${toDelete?.title}”?`}
        message="This cannot be undone."
        actions={[{ label: "Delete Split Payment", destructive: true, onAction: () => toDelete && doDelete(toDelete) }]}
      />
    </MoneyScreen>
  );
}

function EntryCard({
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
