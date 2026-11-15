import { useMemo, useState } from "react";
import { Notice, PullDownMenu, RevealButton, SegmentedTabs, Skeleton } from "../../../ui";
import { useFxRates, useOperations, useSnapshots } from "../../../data/queries";
import type { Operation } from "../../../types";
import { groupSnapshots } from "../../money/invest/investMath";
import {
  ConfirmOperationDelete, OperationList, PortfolioCard, SnapshotList, useInvestDeletes,
} from "../../money/invest/InvestPanels";
import { Block, LinkButton } from "../Block";
import { useEnumParam, useOnePage, useParam } from "../state";
import s from "../OnePage.module.css";

const TABS = ["portfolio", "snapshots", "ops"] as const;

/**
 * Investments (One-Page §7.3): Portfolio · Snapshots · Operations. Every
 * amount stays masked until the eye is held (same rule as Today's Holdings).
 * The evolution chart lives in Statistics → Investments.
 */
export function InvestBlock() {
  const ops = useOperations();
  const snaps = useSnapshots();
  const fx = useFxRates();
  const rates = fx.data?.rates ?? null;
  const { openSnapshot, openOperation, focusBlock } = useOnePage();
  const { deleteSnap, deleteOp } = useInvestDeletes();
  const [tab, setTab] = useEnumParam("inv", TABS, "portfolio");
  const [, setStats] = useParam("stats", "budget");
  const [confirmOp, setConfirmOp] = useState<Operation | null>(null);

  const snapshots = useMemo(() => snaps.data ?? [], [snaps.data]);
  const operations = useMemo(() => ops.data ?? [], [ops.data]);
  const dateCount = useMemo(() => groupSnapshots(snapshots, rates).length, [snapshots, rates]);
  const loading = ops.isPending || snaps.isPending;

  return (
    <Block
      id="invest"
      title="Investments"
      subtitle={loading ? undefined : `${dateCount} snapshot${dateCount === 1 ? "" : "s"} · ${operations.length} operation${operations.length === 1 ? "" : "s"}`}
      actions={
        <>
          <RevealButton group="holdings" label="Hold to reveal amounts" />
          <PullDownMenu
            label="Add investment data"
            icon="plus"
            items={[
              { id: "snap", label: "New Snapshot", icon: "chartLine", onAction: () => openSnapshot({}) },
              { id: "op", label: "New Operation", icon: "arrowUpRight", onAction: () => openOperation({}) },
            ]}
          />
        </>
      }
      tabs={
        <SegmentedTabs
          label="Investments"
          value={tab}
          onChange={setTab}
          options={[{ value: "portfolio", label: "Portfolio" }, { value: "snapshots", label: "Snapshots" }, { value: "ops", label: "Operations" }]}
        />
      }
    >
      {(ops.isError || snaps.isError) && <Notice>Could not load investments data.</Notice>}
      {loading ? (
        <Skeleton height={180} />
      ) : tab === "portfolio" ? (
        <>
          <PortfolioCard snapshots={snapshots} fx={fx.data} open masked />
          <div className={s.linkRow}>
            <LinkButton onClick={() => { setStats("invest"); focusBlock("stats"); }}>View evolution →</LinkButton>
          </div>
        </>
      ) : tab === "snapshots" ? (
        <SnapshotList
          snapshots={snapshots}
          rates={rates}
          onEdit={snap => openSnapshot({ snap })}
          onDelete={deleteSnap}
          onAddToDate={date => openSnapshot({ date })}
          initial={3}
          step={5}
          allowAll
          masked
        />
      ) : (
        <OperationList
          operations={operations}
          onEdit={op => openOperation({ op })}
          onDelete={deleteOp}
          onRequestDelete={setConfirmOp}
          initial={3}
          step={5}
          allowAll
          masked
        />
      )}
      <ConfirmOperationDelete op={confirmOp} onClose={() => setConfirmOp(null)} onDelete={deleteOp} />
    </Block>
  );
}
