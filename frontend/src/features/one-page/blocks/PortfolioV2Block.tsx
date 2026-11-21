import { lazy, Suspense, useMemo, useState } from "react";
import {
  ActionSheet, Button, Dot, Notice, PrivateValue, PullDownMenu, RevealButton, SegmentedControl, Skeleton, useRevealed,
} from "../../../ui";
import { useOperations } from "../../../data/queries";
import { ConfirmOperationDelete, OperationList, useInvestDeletes } from "../../money/invest/InvestPanels";
import { fmtDate, fmtNum } from "../../../utils/format";
import type { Operation, Pv2Asset } from "../../../types";
import { DEFAULT_RANGE, RANGE_LABEL, RANGES } from "../../portfolio-v2/pv2Math";
import { confirmCopy, usePortfolioV2 } from "../../portfolio-v2/usePortfolioV2";
import { AssetsArea, LatestSnapshot, RunHistory } from "../../portfolio-v2/PortfolioV2Panels";
import { AssetSheet } from "../../portfolio-v2/AssetSheet";
import { RunDialog } from "../../portfolio-v2/RunDialog";
import { Block } from "../Block";
import { useEnumParam, useOnePage, useParam } from "../state";
import s from "../../portfolio-v2/PortfolioV2.module.css";

const PortfolioChart = lazy(() => import("../../portfolio-v2/PortfolioChart"));

/**
 * Portfolio v2 (Documentation/Portfolio_v2_Requirements.md §7): assets priced
 * by the AI agent, the portfolio's value over time, the last snapshot per
 * platform, and the asset list. Values stay masked until the holdings eye
 * (shared with Investments) is on. The phone's Money → Invest shows the same
 * content (`money/invest/InvestScreen.tsx`).
 */
export function PortfolioV2Block() {
  const revealed = useRevealed("holdings");
  const [range, setRange] = useEnumParam("pv2range", RANGES, DEFAULT_RANGE);
  const [linesParam, setLines] = useParam("pv2lines", "Total");
  const [confirm, setConfirm] = useState(false);
  const [history, setHistory] = useState(false);
  const [assetTarget, setAssetTarget] = useState<{ asset?: Pv2Asset; platform?: string } | null>(null);
  const pv = usePortfolioV2(range);
  const {
    assets: assetList, snapshots: snapList, summary, series, platforms: allPlatforms, colors, totalChange, priced,
    activeRun, activeDone, activeTotal, loading, disabledWhy, fx,
  } = pv;
  const visible = useMemo(() => new Set(linesParam.split(",").filter(Boolean)), [linesParam]);

  const toggleLine = (k: string) => {
    const next = new Set(visible);
    if (next.has(k)) next.delete(k); else next.add(k);
    setLines([...next].join(",") || "none");
  };

  const generate = (force = false) => { setConfirm(false); pv.generate(force); };

  return (
    <Block
      id="portfolioV2"
      title="Portfolio v2"
      subtitle={loading ? undefined : `${priced} asset${priced === 1 ? "" : "s"} · ${allPlatforms.length} platform${allPlatforms.length === 1 ? "" : "s"}`}
      actions={
        <>
          <RevealButton group="holdings" toggle />
          {activeRun ? (
            <Button variant="tinted" size="small" icon="sparkle" aria-label={`Snapshot running, ${activeDone} of ${activeTotal}`} onClick={() => pv.setRunId(activeRun.runId)}>
              {activeDone}/{activeTotal}
            </Button>
          ) : (
            <Button
              variant="tinted"
              size="small"
              icon="sparkle"
              loading={pv.starting}
              disabled={!!disabledWhy}
              title={disabledWhy ?? "Generate a snapshot: look up the latest prices with the AI agent"}
              aria-label="Generate Snapshot"
              onClick={() => setConfirm(true)}
            >
              Generate
            </Button>
          )}
          <PullDownMenu
            label="Portfolio v2 actions"
            items={[
              { id: "add", label: "Add Asset", icon: "plus", onAction: () => setAssetTarget({}) },
              { id: "runs", label: "Snapshot Runs", icon: "clock", onAction: () => setHistory(true) },
            ]}
          />
        </>
      }
    >
      {pv.isError && <Notice>Could not load Portfolio v2 data.</Notice>}
      {pv.ai && !pv.ai.configured && <Notice tone="info">The AI agent has no API key yet. An admin can add it in Admin → App Settings → Portfolio v2 AI.</Notice>}
      {loading ? <Skeleton height={220} /> : (
        <>
          <div className={s.summary} aria-label="Portfolio v2 total">
            <span className={s.totalValue}>
              <PrivateValue mode="hold" group="holdings" chars={7}>{fmtNum(summary.totalEUR)}</PrivateValue> <span className={s.unit}>EUR</span>
            </span>
            {totalChange && revealed && (
              <span className={totalChange.abs >= 0 ? s.positive : s.negative}>
                {totalChange.abs >= 0 ? "+" : "−"}{fmtNum(Math.abs(totalChange.abs))}{totalChange.pct != null ? ` (${totalChange.pct.toFixed(1)}%)` : ""} · {RANGE_LABEL[range]}
              </span>
            )}
            <span className={s.meta}>
              {summary.lastGeneratedAt ? `Last snapshot ${new Date(summary.lastGeneratedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}` : "No snapshots yet"}
              {fx?.updatedAt ? ` · FX ${fmtDate(fx.updatedAt.slice(0, 10))}` : ""}
            </span>
          </div>

          <div className={s.card}>
            <div className={s.controls}>
              <SegmentedControl
                label="History range"
                value={range}
                options={RANGES.map(r => ({ value: r, label: RANGE_LABEL[r] }))}
                onChange={setRange}
                className={s.range}
              />
              <div className={s.lineChips} role="group" aria-label="Chart lines">
                {["Total", ...series.platforms].map(k => (
                  <button
                    key={k}
                    type="button"
                    className={[s.lineChip, visible.has(k) ? s.lineChipOn : ""].join(" ")}
                    aria-pressed={visible.has(k)}
                    onClick={() => toggleLine(k)}
                  >
                    <Dot color={k === "Total" ? "var(--label)" : colors[k]} size={8} />
                    {k === "Total" ? "Total" : k}
                  </button>
                ))}
              </div>
            </div>
            {series.data.length < 2 ? (
              <p className={s.empty}>{snapList.length === 0 ? "No snapshots yet — generate the first one." : "Not enough history in this range yet."}</p>
            ) : (
              <Suspense fallback={<Skeleton height={260} />}>
                <PortfolioChart data={series.data} platforms={series.platforms} colors={colors} visible={visible} masked={!revealed} />
              </Suspense>
            )}
          </div>

          <div className={s.twoCol}>
            <LatestSnapshot platforms={summary.platforms} colors={colors} />
            <OperationsPanel />
          </div>
          <AssetsArea assets={assetList} onAdd={platform => setAssetTarget({ platform })} onEdit={asset => setAssetTarget({ asset })} />
        </>
      )}

      <ActionSheet
        isOpen={confirm}
        onClose={() => setConfirm(false)}
        {...confirmCopy(priced)}
        actions={[
          { label: "Generate Snapshot", onAction: () => generate() },
          { label: "Look Up All Assets", onAction: () => generate(true) },
        ]}
      />
      <RunDialog runId={pv.runId} onClose={() => pv.setRunId(null)} />
      <RunHistory isOpen={history} runs={pv.runs} onOpenRun={id => { setHistory(false); pv.setRunId(id); }} onClose={() => setHistory(false)} />
      <AssetSheet target={assetTarget} platforms={allPlatforms} onClose={() => setAssetTarget(null)} />
    </Block>
  );
}

/**
 * The old Investments module's operations (deposits / withdrawals), the same
 * list as Investments → Operations, beside the last snapshot. Amounts are
 * masked behind the holdings eye.
 */
function OperationsPanel() {
  const ops = useOperations();
  const { openOperation } = useOnePage();
  const { deleteOp } = useInvestDeletes();
  const [confirmOp, setConfirmOp] = useState<Operation | null>(null);
  return (
    <section aria-label="Operations">
      <div className={s.sectionHead}>
        <span>Operations</span>
        <Button variant="tinted" size="small" icon="plus" onClick={() => openOperation({})}>New</Button>
      </div>
      {ops.isError ? <Notice>Could not load the operations.</Notice> : ops.isPending ? <Skeleton height={120} /> : (
        <OperationList
          operations={ops.data ?? []}
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
    </section>
  );
}
