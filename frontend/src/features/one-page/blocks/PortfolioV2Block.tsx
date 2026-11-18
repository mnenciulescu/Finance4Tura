import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ActionSheet, Button, Dot, Notice, PrivateValue, PullDownMenu, RevealButton, SegmentedControl, Skeleton, useRevealed, useToast,
} from "../../../ui";
import { useFxRates, useOperations } from "../../../data/queries";
import { ConfirmOperationDelete, OperationList, useInvestDeletes } from "../../money/invest/InvestPanels";
import { useOnline } from "../../../app/useOnline";
import { fmtDate, fmtNum, todayIso } from "../../../utils/format";
import type { Operation, Pv2Asset } from "../../../types";
import { pv2Keys, usePv2AiConfig, usePv2Assets, usePv2Runs, usePv2Snapshots, useStartPv2Run } from "../../portfolio-v2/data";
import { buildSeries, change, DEFAULT_RANGE, platformColor, platformsOf, RANGE_LABEL, RANGES, summarize } from "../../portfolio-v2/pv2Math";
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
 * (shared with Investments) is on.
 */
export function PortfolioV2Block() {
  const assets = usePv2Assets();
  const snaps = usePv2Snapshots();
  const runs = usePv2Runs();
  const ai = usePv2AiConfig();
  const fx = useFxRates();
  const start = useStartPv2Run();
  const toast = useToast();
  const online = useOnline();
  const revealed = useRevealed("holdings");
  const [range, setRange] = useEnumParam("pv2range", RANGES, DEFAULT_RANGE);
  const [linesParam, setLines] = useParam("pv2lines", "Total");
  const [runId, setRunId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [history, setHistory] = useState(false);
  const [assetTarget, setAssetTarget] = useState<{ asset?: Pv2Asset; platform?: string } | null>(null);

  const today = todayIso();
  const assetList = useMemo(() => assets.data ?? [], [assets.data]);
  const snapList = useMemo(() => snaps.data ?? [], [snaps.data]);
  const summary = useMemo(() => summarize(assetList, snapList, today), [assetList, snapList, today]);
  const series = useMemo(() => buildSeries(assetList, snapList, range, today), [assetList, snapList, range, today]);
  const allPlatforms = useMemo(() => platformsOf(assetList), [assetList]);
  const colors = useMemo(() => Object.fromEntries(allPlatforms.map((p, i) => [p, platformColor(p, i)])), [allPlatforms]);
  const visible = useMemo(() => new Set(linesParam.split(",").filter(Boolean)), [linesParam]);
  const totalChange = change(series.data, "Total");

  const priced = assetList.filter(a => a.type !== "Total" && a.active !== false).length;
  const activeRun = (runs.data ?? []).find(r => r.status === "running");
  const activeDone = activeRun ? activeRun.items.filter(i => i.type !== "Total" && !["queued", "searching", "computing"].includes(i.status)).length : 0;
  const activeTotal = activeRun ? activeRun.items.filter(i => i.type !== "Total").length : 0;
  const aiReady = !!ai.data?.configured && ai.data.enabled;

  // A run that finished in the background: refresh the snapshots.
  const qc = useQueryClient();
  const hadRun = useRef(false);
  useEffect(() => {
    if (activeRun) { hadRun.current = true; return; }
    if (hadRun.current) {
      hadRun.current = false;
      qc.invalidateQueries({ queryKey: pv2Keys.snapshots });
    }
  }, [activeRun, qc]);
  const loading = assets.isPending || snaps.isPending;

  const toggleLine = (k: string) => {
    const next = new Set(visible);
    if (next.has(k)) next.delete(k); else next.add(k);
    setLines([...next].join(",") || "none");
  };

  const generate = (force = false) => {
    setConfirm(false);
    start.mutate({ force }, {
      onSuccess: run => setRunId(run.runId),
      onError: (e: any) => {
        const existing = e?.response?.data?.runId;
        if (existing) { setRunId(existing); return; }
        toast.show({ message: e?.response?.data?.message || "Could not start the snapshot run.", tone: "negative" });
      },
    });
  };

  const disabledWhy = !online ? "Offline" : !aiReady ? "Set the AI key in Admin → App Settings" : priced === 0 ? "Add assets first" : null;

  return (
    <Block
      id="portfolioV2"
      title="Portfolio v2"
      subtitle={loading ? undefined : `${priced} asset${priced === 1 ? "" : "s"} · ${allPlatforms.length} platform${allPlatforms.length === 1 ? "" : "s"}`}
      actions={
        <>
          <RevealButton group="holdings" toggle />
          {activeRun ? (
            <Button variant="tinted" size="small" icon="sparkle" aria-label={`Snapshot running, ${activeDone} of ${activeTotal}`} onClick={() => setRunId(activeRun.runId)}>
              {activeDone}/{activeTotal}
            </Button>
          ) : (
            <Button
              variant="tinted"
              size="small"
              icon="sparkle"
              loading={start.isPending}
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
      {(assets.isError || snaps.isError) && <Notice>Could not load Portfolio v2 data.</Notice>}
      {ai.data && !ai.data.configured && <Notice tone="info">The AI agent has no API key yet. An admin can add it in Admin → App Settings → Portfolio v2 AI.</Notice>}
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
              {fx.data?.updatedAt ? ` · FX ${fmtDate(fx.data.updatedAt.slice(0, 10))}` : ""}
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
        title={`Look up prices for ${priced} asset${priced === 1 ? "" : "s"}?`}
        message="The AI agent searches official sources for each asset; a snapshot is added only where there is new data. Assets that already have the latest possible price, or were checked in the last 6 hours, are skipped. This uses the AI API (paid per use)."
        actions={[
          { label: "Generate Snapshot", onAction: () => generate() },
          { label: "Look Up All Assets", onAction: () => generate(true) },
        ]}
      />
      <RunDialog runId={runId} onClose={() => setRunId(null)} />
      <RunHistory isOpen={history} runs={runs.data ?? []} onOpenRun={id => { setHistory(false); setRunId(id); }} onClose={() => setHistory(false)} />
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
