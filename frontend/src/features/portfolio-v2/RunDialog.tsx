import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Icon, Notice, PrivateValue, ProgressBar, Sheet, Skeleton, useToast } from "../../ui";
import { fmtDate, fmtNum } from "../../utils/format";
import type { Pv2ItemStatus, Pv2Run, Pv2RunItem } from "../../types";
import { pv2Keys, useCancelPv2Run, usePv2Run, useRetryPv2Run } from "./data";
import s from "./PortfolioV2.module.css";

const STATUS: Record<Pv2ItemStatus, { label: string; tone?: "good" | "warn" | "bad" }> = {
  queued: { label: "Queued" },
  searching: { label: "Searching…" },
  computing: { label: "Computing…" },
  updated: { label: "Updated", tone: "good" },
  no_new_data: { label: "No new data" },
  not_found: { label: "No confirmed price", tone: "warn" },
  failed: { label: "Failed", tone: "bad" },
  skipped: { label: "Skipped" },
};
const BUSY: Pv2ItemStatus[] = ["queued", "searching", "computing"];
const RETRYABLE: Pv2ItemStatus[] = ["failed", "not_found", "skipped"];

const H = ({ children, chars = 6 }: { children: ReactNode; chars?: number }) => (
  <PrivateValue mode="hold" group="holdings" chars={chars}>{children}</PrivateValue>
);

function StatusCell({ item }: { item: Pv2RunItem }) {
  const st = STATUS[item.status] ?? STATUS.queued;
  const tone = st.tone === "good" ? s.goodText : st.tone === "warn" ? s.warnText : st.tone === "bad" ? s.badText : undefined;
  return (
    <span className={[s.status, tone ?? ""].join(" ")}>
      {item.status === "searching" || item.status === "computing" ? <span className={s.spin} aria-hidden="true" />
        : item.status === "queued" ? <span className={s.dotQueued} aria-hidden="true" />
          : item.status === "updated" ? <Icon name="checkCircle" size={14} />
            : item.status === "failed" ? <Icon name="xmarkCircle" size={14} />
              : item.status === "not_found" ? <Icon name="warning" size={14} />
                : <Icon name="clock" size={14} />}
      {st.label}
    </span>
  );
}

function detail(item: Pv2RunItem) {
  if (item.type === "Total") {
    return (
      <>
        {item.valueEUR != null && item.status === "updated" && <><H>{fmtNum(item.valueEUR)}</H> EUR · </>}
        {item.message ?? (item.status === "queued" ? "After the assets" : "")}
      </>
    );
  }
  switch (item.status) {
    case "updated":
      return (
        <>
          <H>{fmtNum(item.unitPrice ?? 0)}</H> {item.currency} · {item.latestPriceDate ? fmtDate(item.latestPriceDate) : ""}
          {item.valueEUR != null && <> · ≈ <H>{fmtNum(item.valueEUR)}</H> EUR</>}
          {item.flagged && item.message && <span className={s.warnText}> · {item.message}</span>}
        </>
      );
    case "no_new_data":
      return <>{item.message ?? "No new data"}</>;
    case "not_found":
    case "failed":
    case "skipped":
      return <>{item.message ?? ""}</>;
    default:
      return null;
  }
}

/** Progress and result of one snapshot run (§7.2c), live while it runs. */
export function RunDialog({ runId, onClose }: { runId: string | null; onClose: () => void }) {
  const run = usePv2Run(runId);
  const cancel = useCancelPv2Run();
  const retry = useRetryPv2Run();
  const toast = useToast();
  const qc = useQueryClient();
  const data = run.data;
  const running = data?.status === "running";

  // When a run finishes: refresh snapshots and say how it went.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (!data) return;
    if (running) { wasRunning.current = true; return; }
    if (wasRunning.current) {
      wasRunning.current = false;
      qc.invalidateQueries({ queryKey: pv2Keys.snapshots });
      qc.invalidateQueries({ queryKey: pv2Keys.runs });
      const sum = data.summary;
      toast.show({
        message: data.status === "cancelled" ? "Snapshot run cancelled" : `Snapshot done · ${sum?.updated ?? 0} updated`,
        tone: data.status === "completed" ? "positive" : undefined,
      });
    }
  }, [data, running, qc, toast]);

  const groups = useMemo(() => groupItems(data), [data]);
  const priced = data?.items.filter(i => i.type !== "Total") ?? [];
  const done = priced.filter(i => !BUSY.includes(i.status)).length;
  const retryIds = priced.filter(i => RETRYABLE.includes(i.status)).map(i => i.assetId);
  const counts = {
    updated: priced.filter(i => i.status === "updated").length,
    none: priced.filter(i => i.status === "no_new_data").length,
    notFound: priced.filter(i => i.status === "not_found").length,
    failed: priced.filter(i => i.status === "failed").length,
  };

  return (
    <Sheet isOpen={!!runId} onClose={onClose} title={running ? "Generating snapshot" : "Snapshot run"} detent="large">
      <div className={s.runBody}>
        {run.isError && <Notice>Could not load the run.</Notice>}
        {!data ? <Skeleton height={200} /> : (
          <>
            <div aria-live="polite">
              <ProgressBar
                segments={[{ value: done, color: "var(--tint)" }, { value: Math.max(priced.length - done, 0), color: "var(--fill-secondary)" }]}
                height={6}
                label={`${done} of ${priced.length} assets done`}
              />
              <div className={s.runSummary}>
                <span><strong>{done}/{priced.length}</strong> done</span>
                <span><strong>{counts.updated}</strong> updated</span>
                <span><strong>{counts.none}</strong> no new data</span>
                <span className={counts.notFound ? s.warnText : undefined}><strong>{counts.notFound}</strong> not found</span>
                <span className={counts.failed ? s.badText : undefined}><strong>{counts.failed}</strong> failed</span>
                <span>{STATUS_LABEL[data.status]} · started {new Date(data.startedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
              </div>
            </div>
            {data.status === "failed" && <Notice>The run could not start. Try again.</Notice>}
            <table className={s.runTable} aria-label="Assets in this run">
              <thead>
                <tr><th scope="col">Asset</th><th scope="col">Status</th><th scope="col">Result</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr>
              </thead>
              <tbody>
                {groups.map(([platform, items]) => [
                  <tr key={`g-${platform}`} className={s.groupRow}><th colSpan={4} scope="rowgroup">{platform}</th></tr>,
                  ...items.map(({ item }) => (
                    <tr key={item.assetId} className={item.status === "failed" ? s.rowFailed : undefined} data-status={item.status}>
                      <td>
                        <div>{item.type === "Total" ? <strong>Platform total</strong> : item.name}</div>
                        {item.type !== "Total" && <div className={s.meta}>{[item.symbol, item.isin].filter(Boolean).join(" · ")}</div>}
                      </td>
                      <td><StatusCell item={item} /></td>
                      <td>
                        {detail(item)}
                        {item.sourceUrl && item.status !== "failed" && (
                          <div><a className={s.sourceLink} href={item.sourceUrl} target="_blank" rel="noreferrer noopener">{hostOf(item.sourceUrl)}</a></div>
                        )}
                      </td>
                      <td>
                        {!running && item.type !== "Total" && RETRYABLE.includes(item.status) && (
                          <Button variant="gray" size="small" icon="refresh" disabled={retry.isPending} onClick={() => doRetry([item.assetId])}>Retry</Button>
                        )}
                      </td>
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
            <div className={s.footer}>
              <span className={s.meta}>
                {data.model} · {data.usage?.webSearches ?? 0} searches · {Math.round(((data.usage?.inputTokens ?? 0) + (data.usage?.outputTokens ?? 0)) / 1000)}k tokens
              </span>
              {running ? (
                <Button variant="destructiveTinted" size="small" icon="xmark" disabled={!!data.cancelRequested || cancel.isPending} onClick={() => cancel.mutate(data.runId)}>
                  {data.cancelRequested ? "Cancelling…" : "Cancel Run"}
                </Button>
              ) : retryIds.length > 0 && (
                <Button variant="tinted" size="small" icon="refresh" loading={retry.isPending} onClick={() => doRetry(retryIds)}>
                  Retry {retryIds.length} Failed
                </Button>
              )}
              <Button variant="gray" size="small" onClick={onClose}>{running ? "Run in Background" : "Close"}</Button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );

  function doRetry(assetIds: string[]) {
    if (!data) return;
    retry.mutate({ id: data.runId, assetIds }, {
      onError: (e: any) => toast.show({ message: e?.response?.data?.message || "Could not retry.", tone: "negative" }),
    });
  }
}

const STATUS_LABEL: Record<Pv2Run["status"], string> = {
  running: "Running", completed: "Completed", completed_with_errors: "Completed with issues", failed: "Failed", cancelled: "Cancelled",
};

function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

/** Items by platform, the platform Total last. */
function groupItems(run: Pv2Run | undefined): [string, { item: Pv2RunItem }[]][] {
  if (!run) return [];
  const by = new Map<string, { item: Pv2RunItem }[]>();
  run.items.forEach(item => {
    const list = by.get(item.platform) ?? [];
    list.push({ item });
    by.set(item.platform, list);
  });
  for (const list of by.values()) list.sort((a, b) => Number(a.item.type === "Total") - Number(b.item.type === "Total"));
  return [...by.entries()];
}
