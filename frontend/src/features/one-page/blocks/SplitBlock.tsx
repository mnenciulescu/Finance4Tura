import { useMemo, useState } from "react";
import { ActionSheet, Button, EmptyState, IconButton, Notice, SegmentedTabs, ShowMore, Skeleton, useShowMore, useToast } from "../../../ui";
import { useSplitPayments } from "../../../data/queries";
import { useDeleteSplit } from "../../../data/mutations";
import { outstandingByCurrency, splitGroups } from "../../../utils/split";
import { fmtNum } from "../../../utils/format";
import type { SplitPayment } from "../../../types";
import { SplitCard } from "../../money/split/SplitCard";
import { SettleAlert } from "../../money/split/SplitSlots";
import { useSplitEditor } from "../../money/split/useSplitEditor";
import { Block } from "../Block";
import { useEnumParam, useOnePage } from "../state";
import s from "../OnePage.module.css";

const TABS = ["open", "settled"] as const;

/**
 * Split Payments (One-Page §7.2): In progress / Settled tabs, 3 cards each,
 * the same slot grid, auto-save and "Mark as settled?" as Money → Split.
 */
export function SplitBlock() {
  const splits = useSplitPayments();
  const editor = useSplitEditor();
  const del = useDeleteSplit();
  const toast = useToast();
  const { openSplit } = useOnePage();
  const [tab, setTab] = useEnumParam("split", TABS, "open");
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [toDelete, setToDelete] = useState<SplitPayment | null>(null);

  const pendingId = editor.pendingSettle?.entryId ?? null;
  const { open, done } = useMemo(() => splitGroups(splits.data ?? [], pendingId), [splits.data, pendingId]);
  const outstanding = useMemo(() => outstandingByCurrency(open), [open]);
  const list = tab === "settled" ? done : open;
  const [limit, setLimit] = useShowMore(3, tab);

  const settled = tab === "settled";
  const isExpanded = (e: SplitPayment) => overrides[e.splitPaymentId] ?? !settled;
  const toggle = (e: SplitPayment) => setOverrides(m => ({ ...m, [e.splitPaymentId]: !(m[e.splitPaymentId] ?? !settled) }));

  const doDelete = (entry: SplitPayment) => {
    setToDelete(null);
    del.mutate(entry.splitPaymentId, {
      onSuccess: () => toast.show({ message: "Split payment deleted", icon: "trash" }),
      onError: () => toast.show({ message: "Could not delete the split payment.", tone: "negative" }),
    });
  };

  return (
    <Block
      id="split"
      title="Split Payments"
      subtitle={splits.data && (
        <>
          {open.length} open · {done.length} settled
          {outstanding.length > 0 && <> · left {outstanding.map(([cur, v]) => `${fmtNum(v)} ${cur}`).join(" · ")}</>}
        </>
      )}
      actions={<IconButton icon="plus" label="New split payment" onClick={() => openSplit({})} />}
      tabs={(splits.data ?? []).length > 0 && (
        <SegmentedTabs
          label="Split payments"
          value={tab}
          onChange={setTab}
          options={[{ value: "open", label: `In progress · ${open.length}` }, { value: "settled", label: `Settled · ${done.length}` }]}
        />
      )}
    >
      {splits.isError && <Notice>Could not load split payments.</Notice>}
      {splits.isPending ? (
        <Skeleton height={160} />
      ) : (splits.data ?? []).length === 0 ? (
        <EmptyState
          icon="split"
          title="No split payments yet"
          message="Log a payment split into instalments and tick them off as they're paid."
          action={<Button variant="tinted" icon="plus" onClick={() => openSplit({})}>Add Your First One</Button>}
        />
      ) : list.length === 0 ? (
        <p className={s.muted}>{settled ? "Nothing settled yet." : "Nothing in progress."}</p>
      ) : (
        <>
          {list.slice(0, limit).map(entry => (
            <SplitCard
              key={entry.splitPaymentId}
              entry={entry}
              expanded={isExpanded(entry)}
              onToggle={() => toggle(entry)}
              onSetOcc={editor.setOcc}
              onFillRest={editor.fillRest}
              onClearAll={editor.clearAll}
              onEdit={() => openSplit({ entry })}
              onDelete={() => setToDelete(entry)}
              saveState={editor.saveState[entry.splitPaymentId]}
            />
          ))}
          <ShowMore shown={limit} total={list.length} initial={3} step={5} onChange={setLimit} allowAll />
        </>
      )}

      <SettleAlert pending={editor.pendingSettle} onConfirm={editor.confirmSettle} onCancel={editor.cancelSettle} />
      <ActionSheet
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Delete “${toDelete?.title}”?`}
        message="This cannot be undone."
        actions={[{ label: "Delete Split Payment", destructive: true, onAction: () => toDelete && doDelete(toDelete) }]}
      />
    </Block>
  );
}
