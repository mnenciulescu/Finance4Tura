import { lazy, Suspense, useMemo, useState, type ReactNode } from "react";
import {
  ActionSheet, Badge, Button, Dot, Icon, PrivateValue, ProgressBar, SegmentedControl, ShowMore, Skeleton, SwipeActions, useToast,
} from "../../../ui";
import { useDeleteOperation, useDeleteSnapshot } from "../../../data/mutations";
import { PLATFORMS, PLATFORM_COLOR } from "../../../theme/domainColors";
import { activePlatforms, latestByPlatform, toEUR } from "../../../utils/money";
import { fmtDate, fmtNum } from "../../../utils/format";
import type { FxMatrix, FxRates, Operation, Snapshot } from "../../../types";
import { buildChart, groupSnapshots, PAGE_STEP } from "./investMath";
import s from "./Invest.module.css";

/*
 * The Invest screen's content (Money → Invest). `OperationList` is also used
 * by One-Page's Portfolio v2 block, where `masked` hides every amount behind
 * the holdings eye; the phone screen shows them openly.
 */

const Amount = ({ masked, children }: { masked?: boolean; children: ReactNode }) =>
  masked ? <PrivateValue mode="hold" group="holdings" chars={6}>{children}</PrivateValue> : <>{children}</>;

/* ── Total portfolio ──────────────────────────────────────────────────────── */

export function PortfolioCard({
  snapshots, fx, open, onToggle,
}: {
  snapshots: Snapshot[];
  fx: FxRates | null | undefined;
  /** Holdings shown. */
  open: boolean;
  onToggle: () => void;
}) {
  const rates = fx?.rates ?? null;
  const latest = useMemo(() => latestByPlatform(snapshots), [snapshots]);
  const latestEUR = (p: string) => (latest[p] ? toEUR(latest[p].amount, latest[p].currency, rates) : 0);
  const total = PLATFORMS.reduce((sum, p) => sum + latestEUR(p), 0);
  // Platforms whose latest snapshot is > 0: exactly what makes up the total.
  const held = PLATFORMS.filter(p => latestEUR(p) > 0);

  const text = (
    <span className={s.totalText}>
      <span className={s.overline}>Total portfolio</span>
      <span className={s.totalValue}>{fmtNum(total)} <span className={s.unit}>EUR</span></span>
      <span className={s.meta}>
        {held.length} platform{held.length === 1 ? "" : "s"} · {fx?.updatedAt ? `FX ${fmtDate(fx.updatedAt.slice(0, 10))}` : "no FX rates set"}
      </span>
    </span>
  );

  return (
    <section className={s.card} aria-label="Total portfolio">
      <button type="button" className={s.totalHead} onClick={onToggle} aria-expanded={open}>
        {text}
        <Icon name="chevronDown" size={18} weight="semibold" className={s.chevron} style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && (
        <ul className={s.holdings} aria-label="Holdings">
          {held.length === 0 ? <li className={s.emptyLine}>No holdings.</li> : held.map(p => {
            const eur = latestEUR(p);
            const share = total > 0 ? (eur / total) * 100 : 0;
            const raw = latest[p];
            return (
              <li key={p} className={s.holding} data-holding={p}>
                <div className={s.holdingTop}>
                  <Dot color={PLATFORM_COLOR[p]} />
                  <span className={s.holdingName}>{p}</span>
                  <span className={s.holdingAmount}>{fmtNum(eur)}</span>
                </div>
                <ProgressBar segments={[{ value: share, color: PLATFORM_COLOR[p] }, { value: 100 - share, color: "transparent" }]} height={4} />
                <div className={s.holdingMeta}>
                  <span>{share.toFixed(1)}%</span>
                  {raw && raw.currency !== "EUR" && <span>{fmtNum(raw.amount)} {raw.currency}</span>}
                  <span>{raw ? fmtDate(raw.date) : "—"}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ── Snapshots ────────────────────────────────────────────────────────────── */

export function SnapshotList({
  snapshots, rates, onEdit, onDelete, onAddToDate,
}: {
  snapshots: Snapshot[];
  rates: FxMatrix | null;
  onEdit: (snap: Snapshot) => void;
  onDelete: (snap: Snapshot) => void;
  onAddToDate: (date: string) => void;
}) {
  const [limit, setLimit] = useState(PAGE_STEP);
  const [openDates, setOpenDates] = useState<Record<string, boolean>>({});
  const dates = useMemo(() => groupSnapshots(snapshots, rates), [snapshots, rates]);

  if (dates.length === 0) return <p className={s.sectionEmpty}>No snapshots yet.</p>;
  return (
    <div className={s.stack}>
      {dates.slice(0, limit).map(group => {
        const open = !!openDates[group.date];
        return (
          <article key={group.date} className={s.card} data-snapshot-date={group.date}>
            <button
              type="button"
              className={s.rowHead}
              aria-expanded={open}
              onClick={() => setOpenDates(m => ({ ...m, [group.date]: !m[group.date] }))}
            >
              <span className={s.rowTitle}>{fmtDate(group.date)}</span>
              <Badge color="var(--label-secondary)">{group.rows.length}</Badge>
              <span className={s.dots}>{group.rows.map(r => <Dot key={r.snapshotId} color={PLATFORM_COLOR[r.platform]} size={8} />)}</span>
              <span className={s.rowValue}>{fmtNum(group.totalEUR)} EUR</span>
              <Icon name="chevronDown" size={16} weight="semibold" className={s.chevron} style={{ transform: open ? "rotate(180deg)" : "none" }} />
            </button>
            {open && (
              <ul className={s.subList}>
                {group.rows.map(snap => (
                  <li key={snap.snapshotId}>
                    <SwipeActions
                      actions={[
                        { label: "Edit", icon: "pencil", onAction: () => onEdit(snap) },
                        { label: "Delete", icon: "trash", destructive: true, onAction: () => onDelete(snap) },
                      ]}
                    >
                      <div className={s.subRow} data-snapshot={snap.snapshotId}>
                        <Dot color={PLATFORM_COLOR[snap.platform]} />
                        <span className={s.subName}>{snap.platform}</span>
                        <span className={s.subAmounts}>
                          <span>{fmtNum(snap.amount)} {snap.currency}</span>
                          {snap.currency !== "EUR" && (
                            <span className={s.subEur}>≈ {fmtNum(toEUR(snap.amount, snap.currency, rates))} EUR</span>
                          )}
                        </span>
                        <button type="button" className={s.inlineEdit} aria-label={`Edit ${snap.platform} snapshot`} onClick={() => onEdit(snap)}>
                          <Icon name="pencil" size={18} />
                        </button>
                      </div>
                    </SwipeActions>
                  </li>
                ))}
                <li>
                  <button type="button" className={s.addRow} onClick={() => onAddToDate(group.date)}>
                    + Add Platform to This Date
                  </button>
                </li>
              </ul>
            )}
          </article>
        );
      })}
      <ShowMore shown={limit} total={dates.length} initial={PAGE_STEP} step={PAGE_STEP} onChange={setLimit} />
    </div>
  );
}

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

/* ── Evolution ────────────────────────────────────────────────────────────── */

type Range = "1y" | "3y" | "all";
const EvolutionChart = lazy(() => import("./EvolutionChart"));

/** Range control, line chips and the evolution chart (Total on, platforms off). */
export function EvolutionPanel({
  snapshots, operations, rates,
}: {
  snapshots: Snapshot[]; operations: Operation[]; rates: FxMatrix | null;
}) {
  const [range, setRange] = useState<Range>("all");
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(PLATFORMS));
  const active = useMemo(() => activePlatforms(snapshots), [snapshots]);
  const chart = useMemo(() => buildChart(snapshots, operations, rates), [snapshots, operations, rates]);
  const data = useMemo(() => (range === "all" ? chart.data : chart.data.slice(range === "1y" ? -12 : -36)), [chart.data, range]);

  const toggleLine = (k: string) => setHidden(prev => {
    const next = new Set(prev);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });

  if (chart.data.length < 2) return <p className={s.emptyLine}>Not enough data to chart yet.</p>;
  return (
    <>
      <div className={s.controls}>
        <SegmentedControl
          label="Chart range"
          value={range}
          options={[{ value: "1y", label: "1Y" }, { value: "3y", label: "3Y" }, { value: "all", label: "All" }]}
          onChange={setRange}
          className={s.range}
        />
        <div className={s.chips} role="group" aria-label="Chart lines">
          {["Total", ...active].map(k => (
            <button
              key={k}
              type="button"
              className={[s.chip, !hidden.has(k) ? s.chipOn : ""].join(" ")}
              aria-pressed={!hidden.has(k)}
              onClick={() => toggleLine(k)}
            >
              <Dot color={k === "Total" ? "var(--label)" : PLATFORM_COLOR[k]} size={8} />
              {k}
            </button>
          ))}
        </div>
      </div>
      <Suspense fallback={<Skeleton height={210} />}>
        <EvolutionChart data={data} platforms={active} hidden={hidden} />
      </Suspense>
    </>
  );
}

/* ── Deletes ──────────────────────────────────────────────────────────────── */

/** Snapshot and operation deletes with their toasts (operations: shared with One-Page). */
// eslint-disable-next-line react-refresh/only-export-components
export function useInvestDeletes() {
  const delOp = useDeleteOperation();
  const delSnap = useDeleteSnapshot();
  const toast = useToast();
  const deleteSnap = (snap: Snapshot) => delSnap.mutate(snap.snapshotId, {
    onSuccess: () => toast.show({ message: "Snapshot deleted", icon: "trash" }),
    onError: () => toast.show({ message: "Could not delete the snapshot.", tone: "negative" }),
  });
  const deleteOp = (op: Operation) => delOp.mutate(op.operationId, {
    onSuccess: () => toast.show({ message: "Operation deleted", icon: "trash" }),
    onError: () => toast.show({ message: "Could not delete the operation.", tone: "negative" }),
  });
  return { deleteSnap, deleteOp };
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
