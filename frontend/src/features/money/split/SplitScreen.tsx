import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ActionSheet, Button, EmptyState, IconButton, ListSection, Notice, ScreenSkeleton, useToast } from "../../../ui";
import { MoneyScreen } from "../MoneyScreen";
import { keys, useSplitPayments } from "../../../data/queries";
import { useDeleteSplit } from "../../../data/mutations";
import { outstandingByCurrency, splitGroups } from "../../../utils/split";
import { fmtNum } from "../../../utils/format";
import type { SplitPayment } from "../../../types";
import { SettleAlert } from "./SplitSlots";
import { useSplitEditor } from "./useSplitEditor";
import { SplitCard } from "./SplitCard";
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

  const { open, done } = useMemo(
    () => splitGroups(splits.data ?? [], pendingId.current),
    [splits.data, editor.pendingSettle], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const outstanding = useMemo(() => outstandingByCurrency(open), [open]);

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
    <SplitCard
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
