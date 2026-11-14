import { lazy, Suspense, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ActionSheet, Badge, Button, Dot, EmptyState, Icon, ListSection, Notice, ProgressBar, PullDownMenu, ScreenSkeleton,
  SegmentedControl, Skeleton, SwipeActions, useToast,
} from "../../../ui";
import { MoneyScreen } from "../MoneyScreen";
import { keys, useFxRates, useOperations, useSnapshots } from "../../../data/queries";
import { useDeleteOperation, useDeleteSnapshot } from "../../../data/mutations";
import { PLATFORMS, PLATFORM_COLOR } from "../../../theme/domainColors";
import { activePlatforms, latestByPlatform, toEUR } from "../../../utils/money";
import { fmtDate, fmtNum } from "../../../utils/format";
import type { Operation, Snapshot } from "../../../types";
import { buildChart, groupSnapshots, PAGE_STEP } from "./investMath";
import { OperationSheet, SnapshotSheet } from "./InvestForms";
import s from "./Invest.module.css";

const EvolutionChart = lazy(() => import("./EvolutionChart"));

type Range = "1y" | "3y" | "all";

/** Money → Invest (proposal §8.7): total, evolution, snapshots, operations. */
export default function InvestScreen() {
  const qc = useQueryClient();
  const ops = useOperations();
  const snaps = useSnapshots();
  const fx = useFxRates();
  const rates = fx.data?.rates ?? null;
  const delOp = useDeleteOperation();
  const delSnap = useDeleteSnapshot();
  const toast = useToast();

  const [showHoldings, setShowHoldings] = useState(false);
  const [range, setRange] = useState<Range>("all");
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(PLATFORMS));
  const [snapLimit, setSnapLimit] = useState(PAGE_STEP);
  const [opLimit, setOpLimit] = useState(PAGE_STEP);
  const [openDates, setOpenDates] = useState<Record<string, boolean>>({});
  const [openOps, setOpenOps] = useState<Record<string, boolean>>({});
  const [snapForm, setSnapForm] = useState<{ snap?: Snapshot; date?: string } | null>(null);
  const [opForm, setOpForm] = useState<{ op?: Operation } | null>(null);
  const [confirmOp, setConfirmOp] = useState<Operation | null>(null);

  const snapshots = useMemo(() => snaps.data ?? [], [snaps.data]);
  const operations = useMemo(() => ops.data ?? [], [ops.data]);

  const latest = useMemo(() => latestByPlatform(snapshots), [snapshots]);
  const latestEUR = (p: string) => (latest[p] ? toEUR(latest[p].amount, latest[p].currency, rates) : 0);
  const total = PLATFORMS.reduce((sum, p) => sum + latestEUR(p), 0);
  // Platforms whose latest snapshot is > 0: exactly what makes up the total.
  const held = PLATFORMS.filter(p => latestEUR(p) > 0);
  const active = useMemo(() => activePlatforms(snapshots), [snapshots]);

  const chart = useMemo(() => buildChart(snapshots, operations, rates), [snapshots, operations, rates]);
  const chartData = useMemo(() => {
    if (range === "all") return chart.data;
    const n = range === "1y" ? 12 : 36;
    return chart.data.slice(-n);
  }, [chart.data, range]);

  const dates = useMemo(() => groupSnapshots(snapshots, rates), [snapshots, rates]);
  const sortedOps = useMemo(() => [...operations].sort((a, b) => (b.date || "").localeCompare(a.date || "")), [operations]);

  const toggleLine = (k: string) => setHidden(prev => {
    const next = new Set(prev);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });

  const deleteSnap = (snap: Snapshot) => delSnap.mutate(snap.snapshotId, {
    onSuccess: () => toast.show({ message: "Snapshot deleted", icon: "trash" }),
    onError: () => toast.show({ message: "Could not delete the snapshot.", tone: "negative" }),
  });
  const deleteOp = (op: Operation) => delOp.mutate(op.operationId, {
    onSuccess: () => toast.show({ message: "Operation deleted", icon: "trash" }),
    onError: () => toast.show({ message: "Could not delete the operation.", tone: "negative" }),
  });

  const loading = ops.isPending || snaps.isPending;

  return (
    <MoneyScreen
      segment="invest"
      subtitle={loading ? undefined : `${dates.length} snapshot${dates.length === 1 ? "" : "s"} · ${operations.length} operation${operations.length === 1 ? "" : "s"}`}
      onRefresh={() => Promise.all([keys.operations, keys.snapshots, keys.fx].map(k => qc.invalidateQueries({ queryKey: k })))}
      actions={
        <PullDownMenu
          label="Add"
          icon="plus"
          items={[
            { id: "snap", label: "New Snapshot", icon: "chartLine", onAction: () => setSnapForm({}) },
            { id: "op", label: "New Operation", icon: "arrowUpRight", onAction: () => setOpForm({}) },
          ]}
        />
      }
    >
      {(ops.isError || snaps.isError) && <Notice>Could not load investments data.</Notice>}
      {loading ? (
        <ScreenSkeleton blocks={3} />
      ) : (
        <>
          {/* ── Total portfolio ─────────────────────────────────────────── */}
          <section className={s.card} aria-label="Total portfolio">
            <button type="button" className={s.totalHead} onClick={() => setShowHoldings(v => !v)} aria-expanded={showHoldings}>
              <span className={s.totalText}>
                <span className={s.overline}>Total portfolio</span>
                <span className={s.totalValue}>{fmtNum(total)} <span className={s.unit}>EUR</span></span>
                <span className={s.meta}>
                  {held.length} platform{held.length === 1 ? "" : "s"} · {fx.data?.updatedAt ? `FX ${fmtDate(fx.data.updatedAt.slice(0, 10))}` : "no FX rates set"}
                </span>
              </span>
              <Icon name="chevronDown" size={18} weight="semibold" className={s.chevron} style={{ transform: showHoldings ? "rotate(180deg)" : "none" }} />
            </button>
            {showHoldings && (
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

          {/* ── Evolution ───────────────────────────────────────────────── */}
          <ListSection header="Portfolio evolution" bare>
            <div className={s.chartCard}>
              {chart.data.length < 2 ? (
                <p className={s.emptyLine}>Not enough data to chart yet.</p>
              ) : (
                <>
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
                  <Suspense fallback={<Skeleton height={210} />}>
                    <EvolutionChart data={chartData} platforms={active} hidden={hidden} />
                  </Suspense>
                </>
              )}
            </div>
          </ListSection>

          {/* ── Snapshots ───────────────────────────────────────────────── */}
          <ListSection
            header="Snapshots"
            headerAction={<Button variant="plain" size="small" icon="plus" onClick={() => setSnapForm({})}>Add</Button>}
          >
            {dates.length === 0 ? (
              <p className={s.sectionEmpty}>No snapshots yet.</p>
            ) : (
              <div className={s.stack}>
                {dates.slice(0, snapLimit).map(group => {
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
                                  { label: "Edit", icon: "pencil", onAction: () => setSnapForm({ snap }) },
                                  { label: "Delete", icon: "trash", destructive: true, onAction: () => deleteSnap(snap) },
                                ]}
                              >
                                <div className={s.subRow} data-snapshot={snap.snapshotId}>
                                  <Dot color={PLATFORM_COLOR[snap.platform]} />
                                  <span className={s.subName}>{snap.platform}</span>
                                  <span className={s.subAmounts}>
                                    <span>{fmtNum(snap.amount)} {snap.currency}</span>
                                    {snap.currency !== "EUR" && <span className={s.subEur}>≈ {fmtNum(toEUR(snap.amount, snap.currency, rates))} EUR</span>}
                                  </span>
                                  <button type="button" className={s.inlineEdit} aria-label={`Edit ${snap.platform} snapshot`} onClick={() => setSnapForm({ snap })}>
                                    <Icon name="pencil" size={18} />
                                  </button>
                                </div>
                              </SwipeActions>
                            </li>
                          ))}
                          <li>
                            <button type="button" className={s.addRow} onClick={() => setSnapForm({ date: group.date })}>
                              + Add Platform to This Date
                            </button>
                          </li>
                        </ul>
                      )}
                    </article>
                  );
                })}
                <MoreLess shown={Math.min(snapLimit, dates.length)} total={dates.length} onMore={() => setSnapLimit(n => n + PAGE_STEP)} onLess={() => setSnapLimit(PAGE_STEP)} />
              </div>
            )}
          </ListSection>

          {/* ── Operations ──────────────────────────────────────────────── */}
          <ListSection
            header="Operations"
            headerAction={<Button variant="plain" size="small" icon="plus" onClick={() => setOpForm({})}>Add</Button>}
          >
            {operations.length === 0 ? (
              <p className={s.sectionEmpty}>No operations yet.</p>
            ) : (
              <div className={s.stack}>
                {sortedOps.slice(0, opLimit).map(op => {
                  const open = !!openOps[op.operationId];
                  const deposit = op.type === "Deposit";
                  return (
                    <article key={op.operationId} className={s.card} data-operation={op.operationId}>
                      <SwipeActions
                        actions={[
                          { label: "Edit", icon: "pencil", onAction: () => setOpForm({ op }) },
                          { label: "Delete", icon: "trash", destructive: true, onAction: () => deleteOp(op) },
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
                            {deposit ? "+" : "−"}{fmtNum(op.amount)} {op.currency}
                          </span>
                        </button>
                      </SwipeActions>
                      {open && (
                        <div className={s.opBody}>
                          {op.notes ? <p className={s.notes}>{op.notes}</p> : <p className={s.meta}>No notes.</p>}
                          <div className={s.opActions}>
                            <Button variant="gray" size="small" icon="pencil" onClick={() => setOpForm({ op })}>Edit</Button>
                            <Button variant="destructiveTinted" size="small" icon="trash" onClick={() => setConfirmOp(op)}>Delete</Button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
                <MoreLess shown={Math.min(opLimit, sortedOps.length)} total={sortedOps.length} onMore={() => setOpLimit(n => n + PAGE_STEP)} onLess={() => setOpLimit(PAGE_STEP)} />
              </div>
            )}
          </ListSection>

          {snapshots.length === 0 && operations.length === 0 && (
            <EmptyState icon="chartLine" title="No investments yet" message="Add a snapshot of each platform's value, and log deposits and withdrawals." />
          )}
        </>
      )}

      <SnapshotSheet target={snapForm} onClose={() => setSnapForm(null)} />
      <OperationSheet target={opForm} onClose={() => setOpForm(null)} />
      <ActionSheet
        isOpen={!!confirmOp}
        onClose={() => setConfirmOp(null)}
        title={`Delete this ${confirmOp?.type.toLowerCase() ?? "operation"}?`}
        message="This cannot be undone."
        actions={[{ label: "Delete Operation", destructive: true, onAction: () => { const op = confirmOp; setConfirmOp(null); if (op) deleteOp(op); } }]}
      />
    </MoneyScreen>
  );
}

function MoreLess({ shown, total, onMore, onLess }: { shown: number; total: number; onMore: () => void; onLess: () => void }) {
  if (total <= PAGE_STEP) return null;
  return (
    <div className={s.moreRow}>
      {shown > PAGE_STEP && <Button variant="gray" size="medium" onClick={onLess}>Show Less</Button>}
      {shown < total && (
        <Button variant="gray" size="medium" onClick={onMore}>
          Show {Math.min(PAGE_STEP, total - shown)} More <span className={s.count}>{shown}/{total}</span>
        </Button>
      )}
    </div>
  );
}
