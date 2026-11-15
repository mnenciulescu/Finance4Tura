import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, EmptyState, ListSection, Notice, PullDownMenu, ScreenSkeleton } from "../../../ui";
import { MoneyScreen } from "../MoneyScreen";
import { keys, useFxRates, useOperations, useSnapshots } from "../../../data/queries";
import type { Operation, Snapshot } from "../../../types";
import { groupSnapshots } from "./investMath";
import { OperationSheet, SnapshotSheet } from "./InvestForms";
import { ConfirmOperationDelete, EvolutionPanel, OperationList, PortfolioCard, SnapshotList, useInvestDeletes } from "./InvestPanels";
import s from "./Invest.module.css";

/** Money → Invest (proposal §8.7): total, evolution, snapshots, operations. */
export default function InvestScreen() {
  const qc = useQueryClient();
  const ops = useOperations();
  const snaps = useSnapshots();
  const fx = useFxRates();
  const rates = fx.data?.rates ?? null;
  const { deleteSnap, deleteOp } = useInvestDeletes();

  const [showHoldings, setShowHoldings] = useState(false);
  const [snapForm, setSnapForm] = useState<{ snap?: Snapshot; date?: string } | null>(null);
  const [opForm, setOpForm] = useState<{ op?: Operation } | null>(null);
  const [confirmOp, setConfirmOp] = useState<Operation | null>(null);

  const snapshots = useMemo(() => snaps.data ?? [], [snaps.data]);
  const operations = useMemo(() => ops.data ?? [], [ops.data]);
  const dateCount = useMemo(() => groupSnapshots(snapshots, rates).length, [snapshots, rates]);

  const loading = ops.isPending || snaps.isPending;

  return (
    <MoneyScreen
      segment="invest"
      subtitle={loading ? undefined : `${dateCount} snapshot${dateCount === 1 ? "" : "s"} · ${operations.length} operation${operations.length === 1 ? "" : "s"}`}
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
          <PortfolioCard snapshots={snapshots} fx={fx.data} open={showHoldings} onToggle={() => setShowHoldings(v => !v)} />

          <ListSection header="Portfolio evolution" bare>
            <div className={s.chartCard}>
              <EvolutionPanel snapshots={snapshots} operations={operations} rates={rates} />
            </div>
          </ListSection>

          <ListSection
            header="Snapshots"
            headerAction={<Button variant="plain" size="small" icon="plus" onClick={() => setSnapForm({})}>Add</Button>}
          >
            <SnapshotList
              snapshots={snapshots}
              rates={rates}
              onEdit={snap => setSnapForm({ snap })}
              onDelete={deleteSnap}
              onAddToDate={date => setSnapForm({ date })}
            />
          </ListSection>

          <ListSection
            header="Operations"
            headerAction={<Button variant="plain" size="small" icon="plus" onClick={() => setOpForm({})}>Add</Button>}
          >
            <OperationList operations={operations} onEdit={op => setOpForm({ op })} onDelete={deleteOp} onRequestDelete={setConfirmOp} />
          </ListSection>

          {snapshots.length === 0 && operations.length === 0 && (
            <EmptyState icon="chartLine" title="No investments yet" message="Add a snapshot of each platform's value, and log deposits and withdrawals." />
          )}
        </>
      )}

      <SnapshotSheet target={snapForm} onClose={() => setSnapForm(null)} />
      <OperationSheet target={opForm} onClose={() => setOpForm(null)} />
      <ConfirmOperationDelete op={confirmOp} onClose={() => setConfirmOp(null)} onDelete={deleteOp} />
    </MoneyScreen>
  );
}
