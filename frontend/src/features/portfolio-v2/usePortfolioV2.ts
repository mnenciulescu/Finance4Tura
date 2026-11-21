import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../ui";
import { useFxRates } from "../../data/queries";
import { useOnline } from "../../app/useOnline";
import { todayIso } from "../../utils/format";
import { pv2Keys, usePv2AiConfig, usePv2Assets, usePv2Runs, usePv2Snapshots, useStartPv2Run } from "./data";
import { buildSeries, change, platformColor, platformsOf, summarize, type Range } from "./pv2Math";

/**
 * Everything the Portfolio v2 views share — One-Page's block and the phone's
 * Money → Invest: data, the derived summary and series, the running run, and
 * starting a snapshot run. Range and visible lines stay with the caller (URL
 * state on One-Page, screen state on the phone).
 */
export function usePortfolioV2(range: Range) {
  const assets = usePv2Assets();
  const snaps = usePv2Snapshots();
  const runs = usePv2Runs();
  const ai = usePv2AiConfig();
  const fx = useFxRates();
  const start = useStartPv2Run();
  const toast = useToast();
  const online = useOnline();
  const qc = useQueryClient();
  const [runId, setRunId] = useState<string | null>(null);

  const today = todayIso();
  const assetList = useMemo(() => assets.data ?? [], [assets.data]);
  const snapList = useMemo(() => snaps.data ?? [], [snaps.data]);
  const summary = useMemo(() => summarize(assetList, snapList, today), [assetList, snapList, today]);
  const series = useMemo(() => buildSeries(assetList, snapList, range, today), [assetList, snapList, range, today]);
  const platforms = useMemo(() => platformsOf(assetList), [assetList]);
  const colors = useMemo(() => Object.fromEntries(platforms.map((p, i) => [p, platformColor(p, i)])), [platforms]);
  const totalChange = change(series.data, "Total");

  const priced = assetList.filter(a => a.type !== "Total" && a.active !== false).length;
  const runList = runs.data ?? [];
  const activeRun = runList.find(r => r.status === "running");
  const activeDone = activeRun ? activeRun.items.filter(i => i.type !== "Total" && !["queued", "searching", "computing"].includes(i.status)).length : 0;
  const activeTotal = activeRun ? activeRun.items.filter(i => i.type !== "Total").length : 0;
  const aiReady = !!ai.data?.configured && ai.data.enabled;

  // A run that finished in the background: refresh the snapshots.
  const hadRun = useRef(false);
  useEffect(() => {
    if (activeRun) { hadRun.current = true; return; }
    if (hadRun.current) {
      hadRun.current = false;
      qc.invalidateQueries({ queryKey: pv2Keys.snapshots });
    }
  }, [activeRun, qc]);

  const generate = (force = false) => {
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

  return {
    assets: assetList, snapshots: snapList, runs: runList, fx: fx.data, ai: ai.data,
    loading: assets.isPending || snaps.isPending,
    isError: assets.isError || snaps.isError,
    summary, series, platforms, colors, totalChange, priced,
    activeRun, activeDone, activeTotal,
    runId, setRunId, generate, starting: start.isPending, disabledWhy,
  };
}

export const confirmCopy = (priced: number) => ({
  title: `Look up prices for ${priced} asset${priced === 1 ? "" : "s"}?`,
  message: "The AI agent searches official sources for each asset; a snapshot is added only where there is new data. Assets that already have the latest possible price, or were checked in the last 6 hours, are skipped. This uses the AI API (paid per use).",
});
