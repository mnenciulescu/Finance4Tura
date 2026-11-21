import { useMemo, useState, type ReactNode } from "react";
import { ActionSheet, Badge, Button, Dot, PrivateValue, ShowMore, SwipeActions, useToast } from "../../../ui";
import { useDeleteOperation } from "../../../data/mutations";
import { PLATFORM_COLOR } from "../../../theme/domainColors";
import { fmtDate, fmtNum } from "../../../utils/format";
import type { Operation } from "../../../types";
import { PAGE_STEP } from "./investMath";
import s from "./Invest.module.css";

/*
 * The old Investments module's operations (deposits / withdrawals), listed by
 * Money → Invest and One-Page's Portfolio v2 block. `masked` hides every
 * amount behind the holdings eye.
 */

const Amount = ({ masked, children }: { masked?: boolean; children: ReactNode }) =>
  masked ? <PrivateValue mode="hold" group="holdings" chars={6}>{children}</PrivateValue> : <>{children}</>;

/* ── Operations ───────────────────────────────────────────────────────────── */

export function OperationList({
  operations, onEdit, onDelete, onRequestDelete, initial = PAGE_STEP, step = PAGE_STEP, allowAll, masked,
}: {
  operations: Operation[];
  onEdit: (op: Operation) => void;
  /** Swipe Delete, already confirmed by its two-step. */
  onDelete: (op: Operation) => void;
  /** The Delete button, which still asks. */
  onRequestDelete: (op: Operation) => void;
  initial?: number;
  step?: number;
  allowAll?: boolean;
  masked?: boolean;
}) {
  const [limit, setLimit] = useState(initial);
  const [openOps, setOpenOps] = useState<Record<string, boolean>>({});
  const sorted = useMemo(() => [...operations].sort((a, b) => (b.date || "").localeCompare(a.date || "")), [operations]);

  if (operations.length === 0) return <p className={s.sectionEmpty}>No operations yet.</p>;
  return (
    <div className={s.stack}>
      {sorted.slice(0, limit).map(op => {
        const open = !!openOps[op.operationId];
        const deposit = op.type === "Deposit";
        return (
          <article key={op.operationId} className={s.card} data-operation={op.operationId}>
            <SwipeActions
              actions={[
                { label: "Edit", icon: "pencil", onAction: () => onEdit(op) },
                { label: "Delete", icon: "trash", destructive: true, onAction: () => onDelete(op) },
              ]}
            >
              <button
                type="button"
                className={s.rowHead}
                aria-expanded={open}
                onClick={() => setOpenOps(m => ({ ...m, [op.operationId]: !m[op.operationId] }))}
              >
                <Dot color={PLATFORM_COLOR[op.platform]} />
                <span className={s.opText}>
                  <span className={s.rowTitle}>{op.platform}</span>
                  <span className={s.meta}>{fmtDate(op.date)}</span>
                </span>
                <Badge color={deposit ? "var(--status-positive)" : "var(--status-negative)"}>{op.type}</Badge>
                <span className={[s.rowValue, deposit ? s.positive : s.negative].join(" ")}>
                  {deposit ? "+" : "−"}<Amount masked={masked}>{fmtNum(op.amount)}</Amount> {op.currency}
                </span>
              </button>
            </SwipeActions>
            {open && (
              <div className={s.opBody}>
                {op.notes ? <p className={s.notes}>{op.notes}</p> : <p className={s.meta}>No notes.</p>}
                <div className={s.opActions}>
                  <Button variant="gray" size="small" icon="pencil" onClick={() => onEdit(op)}>Edit</Button>
                  <Button variant="destructiveTinted" size="small" icon="trash" onClick={() => onRequestDelete(op)}>Delete</Button>
                </div>
              </div>
            )}
          </article>
        );
      })}
      <ShowMore shown={limit} total={sorted.length} initial={initial} step={step} onChange={setLimit} allowAll={allowAll} />
    </div>
  );
}

/* ── Deletes ──────────────────────────────────────────────────────────────── */

/** Operation deletes with their toasts (shared with One-Page). */
// eslint-disable-next-line react-refresh/only-export-components
export function useInvestDeletes() {
  const delOp = useDeleteOperation();
  const toast = useToast();
  const deleteOp = (op: Operation) => delOp.mutate(op.operationId, {
    onSuccess: () => toast.show({ message: "Operation deleted", icon: "trash" }),
    onError: () => toast.show({ message: "Could not delete the operation.", tone: "negative" }),
  });
  return { deleteOp };
}

export function ConfirmOperationDelete({ op, onClose, onDelete }: { op: Operation | null; onClose: () => void; onDelete: (op: Operation) => void }) {
  return (
    <ActionSheet
      isOpen={!!op}
      onClose={onClose}
      title={`Delete this ${op?.type.toLowerCase() ?? "operation"}?`}
      message="This cannot be undone."
      actions={[{ label: "Delete Operation", destructive: true, onAction: () => { onClose(); if (op) onDelete(op); } }]}
    />
  );
}
