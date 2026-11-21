import { lazy, Suspense, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ActionSheet, Button, Dot, ListSection, Notice, PrivateValue, PullDownMenu, RevealButton, RevealScope,
  ScreenSkeleton, SegmentedControl, Skeleton, useRevealed,
} from "../../../ui";
import { MoneyScreen } from "../MoneyScreen";
import { keys, useOperations } from "../../../data/queries";
import { fmtDate, fmtNum } from "../../../utils/format";
import type { Operation, Pv2Asset } from "../../../types";
import { pv2Keys } from "../../portfolio-v2/data";
import { DEFAULT_RANGE, RANGE_LABEL, RANGES, type Range } from "../../portfolio-v2/pv2Math";
import { confirmCopy, usePortfolioV2 } from "../../portfolio-v2/usePortfolioV2";
import { AssetsArea, LatestSnapshot, RunHistory } from "../../portfolio-v2/PortfolioV2Panels";
import { AssetSheet } from "../../portfolio-v2/AssetSheet";
import { RunDialog } from "../../portfolio-v2/RunDialog";
import { OperationSheet } from "./InvestForms";
import { ConfirmOperationDelete, OperationList, useInvestDeletes } from "./InvestPanels";
import s from "./Invest.module.css";

const PortfolioChart = lazy(() => import("../../portfolio-v2/PortfolioChart"));

/**
 * Money → Invest: Portfolio v2 on the phone — the same data, rules and
 * dialogs as One-Page's Portfolio v2 block, laid out as one column: total and
 * Generate, the value chart, the last snapshot per platform, the operations
 * (deposits / withdrawals) and the asset list. Amounts stay masked until the
 * eye in the nav bar is tapped (tap again, or leave the app, to mask).
 */
export default function InvestScreen() {
  return (
    <RevealScope>
      <Invest />
    </RevealScope>
  );
}

function Invest() {
  const qc = useQueryClient();
  const revealed = useRevealed("holdings");
  const [range, setRange] = useState<Range>(DEFAULT_RANGE);
  const [visible, setVisible] = useState<Set<string>>(() => new Set(["Total"]));
  const [confirm, setConfirm] = useState(false);
  const [history, setHistory] = useState(false);
  const [assetTarget, setAssetTarget] = useState<{ asset?: Pv2Asset; platform?: string } | null>(null);
  const [opForm, setOpForm] = useState<{ op?: Operation } | null>(null);
  const [confirmOp, setConfirmOp] = useState<Operation | null>(null);
  const ops = useOperations();
  const { deleteOp } = useInvestDeletes();
  const p = usePortfolioV2(range);
  const { summary, series, colors, totalChange, priced, activeRun } = p;

  const toggleLine = (k: string) => setVisible(prev => {
    const next = new Set(prev);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });
  const generate = (force = false) => { setConfirm(false); p.generate(force); };

  return (
    <MoneyScreen
      segment="invest"
      subtitle={p.loading ? undefined : `${priced} asset${priced === 1 ? "" : "s"} · ${p.platforms.length} platform${p.platforms.length === 1 ? "" : "s"}`}
      onRefresh={() => Promise.all([pv2Keys.all, keys.operations, keys.fx].map(k => qc.invalidateQueries({ queryKey: k })))}
      actions={
        <>
          <RevealButton group="holdings" toggle />
          <PullDownMenu
            label="Add"
            icon="plus"
            items={[
              { id: "asset", label: "New Asset", icon: "plus", onAction: () => setAssetTarget({}) },
              { id: "op", label: "New Operation", icon: "arrowUpRight", onAction: () => setOpForm({}) },
              { id: "runs", label: "Snapshot Runs", icon: "clock", onAction: () => setHistory(true) },
            ]}
          />
        </>
      }
    >
      {p.isError && <Notice>Could not load Portfolio v2 data.</Notice>}
      {p.ai && !p.ai.configured && <Notice tone="info">The AI agent has no API key yet. An admin can add it in Admin → App Settings → Portfolio v2 AI.</Notice>}
      {p.loading ? <ScreenSkeleton blocks={3} /> : (
        <>
          <section className={[s.card, s.hero].join(" ")} aria-label="Portfolio v2 total">
            <span className={s.overline}>Total portfolio</span>
            <span className={s.totalValue}>
              <PrivateValue mode="hold" group="holdings" chars={7}>{fmtNum(summary.totalEUR)}</PrivateValue> <span className={s.unit}>EUR</span>
            </span>
            {totalChange && revealed && (
              <span className={[s.meta, totalChange.abs >= 0 ? s.positive : s.negative].join(" ")}>
                {totalChange.abs >= 0 ? "+" : "−"}{fmtNum(Math.abs(totalChange.abs))}{totalChange.pct != null ? ` (${totalChange.pct.toFixed(1)}%)` : ""} · {RANGE_LABEL[range]}
              </span>
            )}
            <span className={s.meta}>
              {summary.lastGeneratedAt ? `Last snapshot ${new Date(summary.lastGeneratedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}` : "No snapshots yet"}
              {p.fx?.updatedAt ? ` · FX ${fmtDate(p.fx.updatedAt.slice(0, 10))}` : ""}
            </span>
            <div className={s.heroActions}>
              {activeRun ? (
                <Button variant="tinted" icon="sparkle" block onClick={() => p.setRunId(activeRun.runId)}>
                  Snapshot Running · {p.activeDone}/{p.activeTotal}
                </Button>
              ) : (
                <Button variant="filled" icon="sparkle" block loading={p.starting} disabled={!!p.disabledWhy} onClick={() => setConfirm(true)}>
                  Generate Snapshot
                </Button>
              )}
            </div>
            {!activeRun && p.disabledWhy && <span className={s.meta}>{p.disabledWhy}</span>}
          </section>

          <ListSection header="Evolution" bare>
            <div className={s.chartCard}>
              <SegmentedControl
                label="History range"
                value={range}
                options={RANGES.map(r => ({ value: r, label: RANGE_LABEL[r] }))}
                onChange={setRange}
              />
              <div className={s.chips} role="group" aria-label="Chart lines">
                {["Total", ...series.platforms].map(k => (
                  <button
                    key={k}
                    type="button"
                    className={[s.chip, visible.has(k) ? s.chipOn : ""].join(" ")}
                    aria-pressed={visible.has(k)}
                    onClick={() => toggleLine(k)}
                  >
                    <Dot color={k === "Total" ? "var(--label)" : colors[k]} size={8} />
                    {k}
                  </button>
                ))}
              </div>
              {series.data.length < 2 ? (
                <p className={s.emptyLine}>{p.snapshots.length === 0 ? "No snapshots yet — generate the first one." : "Not enough history in this range yet."}</p>
              ) : (
                <Suspense fallback={<Skeleton height={220} />}>
                  <PortfolioChart data={series.data} platforms={series.platforms} colors={colors} visible={visible} masked={!revealed} height={220} />
                </Suspense>
              )}
            </div>
          </ListSection>

          {summary.platforms.length > 0 && (
            <ListSection header="Last snapshot" bare>
              <LatestSnapshot platforms={summary.platforms} colors={colors} heading={false} />
            </ListSection>
          )}

          <ListSection
            header="Operations"
            headerAction={<Button variant="plain" size="small" icon="plus" onClick={() => setOpForm({})}>Add</Button>}
          >
            {ops.isError ? <Notice>Could not load the operations.</Notice> : ops.isPending ? <Skeleton height={120} /> : (
              <OperationList
                operations={ops.data ?? []}
                onEdit={op => setOpForm({ op })}
                onDelete={deleteOp}
                onRequestDelete={setConfirmOp}
                masked
              />
            )}
          </ListSection>

          <ListSection
            header={`Assets · ${priced}`}
            headerAction={<Button variant="plain" size="small" icon="plus" onClick={() => setAssetTarget({})}>Add</Button>}
            collapsible
            defaultOpen={false}
            bare
          >
            <AssetsArea assets={p.assets} onAdd={platform => setAssetTarget({ platform })} onEdit={asset => setAssetTarget({ asset })} embedded />
          </ListSection>
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
      <RunDialog runId={p.runId} onClose={() => p.setRunId(null)} />
      <RunHistory isOpen={history} runs={p.runs} onOpenRun={id => { setHistory(false); p.setRunId(id); }} onClose={() => setHistory(false)} />
      <AssetSheet target={assetTarget} platforms={p.platforms} onClose={() => setAssetTarget(null)} />
      <OperationSheet target={opForm} onClose={() => setOpForm(null)} />
      <ConfirmOperationDelete op={confirmOp} onClose={() => setConfirmOp(null)} onDelete={deleteOp} />
    </MoneyScreen>
  );
}
