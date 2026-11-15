// Portfolio v2 — snapshot runs. One worker invocation prices one asset; the
// last one to finish computes the platform Totals and closes the run.
import { randomUUID } from "crypto";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../dynamo.mjs";
import {
  buildAssetSnapshot, buildTotalSnapshot, checkAgentResult, computePlatformTotal, computeValues,
  finalStatus, isNewData, latestByAsset, summarize,
} from "./model.mjs";
import { describeError, lookupPrice } from "./agent.mjs";
import * as store from "./store.mjs";

const FX_TABLE = process.env.FX_RATES_TABLE || "FxRates";

export async function readFx() {
  const res = await docClient.send(new GetCommand({ TableName: FX_TABLE, Key: { rateId: "global" } }));
  return { rates: res.Item?.rates ?? null, updatedAt: res.Item?.updatedAt ?? null };
}

/**
 * Prices the run item at `index`. Never throws for per-asset problems: they
 * become the item's status. `deps` = { client, config, now } (client = Anthropic SDK).
 */
export async function processItem({ runId, userId, index, deps }) {
  const run = await store.getRun(runId, userId);
  if (!run) return;
  const item = run.items?.[index];
  if (!item || item.type === "Total" || item.status !== "queued") return;
  const attempt = run.attempt ?? 1;
  const startedAt = new Date().toISOString();
  let usage = {};

  try {
    if (run.cancelRequested) {
      await store.updateRunItem(runId, index, { status: "skipped", message: "Run cancelled", finishedAt: startedAt });
      return;
    }
    await store.updateRunItem(runId, index, { status: "searching", startedAt, message: null });

    const asset = await store.getAsset(item.assetId, userId);
    if (!asset || asset.active === false) {
      await store.updateRunItem(runId, index, { status: "skipped", message: "Asset removed or archived", finishedAt: new Date().toISOString() });
      return;
    }
    if (!deps.client) {
      await store.updateRunItem(runId, index, { status: "failed", message: "No AI key is set — add it in Admin → App Settings", finishedAt: new Date().toISOString() });
      return;
    }

    const snapshots = (await store.listSnapshots(userId)).filter(s => s.assetId === asset.assetId);
    const last = latestByAsset(snapshots)[asset.assetId] ?? null;

    const found = await lookupPrice({ client: deps.client, asset, last, model: deps.config.model, maxSearches: deps.config.maxSearches });
    usage = found.usage;
    const r = found.result;
    const check = checkAgentResult(r, asset, deps.now?.() ?? new Date());
    if (!check.ok) {
      await store.updateRunItem(runId, index, {
        status: check.status, message: check.message, finishedAt: new Date().toISOString(),
        unitPrice: r?.unitPrice ?? null, currency: r?.currency ?? null, priceDate: r?.priceDate ?? null,
        sourceUrl: r?.sources?.[0]?.url ?? null,
      });
      return;
    }

    const now = deps.now?.() ?? new Date();
    if (!isNewData(last, asset, r.priceDate, now)) {
      await store.updateRunItem(runId, index, {
        status: "no_new_data", message: `Latest price ${last.priceDate} already recorded`,
        unitPrice: Number(r.unitPrice), currency: asset.currency, priceDate: r.priceDate,
        sourceUrl: r.sources?.[0]?.url ?? null, finishedAt: new Date().toISOString(),
      });
      return;
    }

    await store.updateRunItem(runId, index, { status: "computing" });
    const values = computeValues(asset, r.unitPrice, deps.fx);
    if (values.error) {
      await store.updateRunItem(runId, index, { status: "failed", message: values.error, finishedAt: new Date().toISOString() });
      return;
    }
    const snap = buildAssetSnapshot({ asset, result: r, values, last, runId, snapshotId: randomUUID(), userId, now });
    await store.putSnapshot(snap);
    await store.updateRunItem(runId, index, {
      status: "updated", snapshotId: snap.snapshotId, unitPrice: snap.unitPrice, currency: snap.currency,
      priceDate: snap.priceDate, value: snap.value, valueEUR: snap.valueEUR, sourceUrl: snap.sources[0]?.url ?? null,
      flagged: snap.flagged, message: snap.flagged ? snap.comments : null, finishedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error(`[portfolioV2] item ${index} of run ${runId} failed:`, e);
    try {
      await store.updateRunItem(runId, index, { status: "failed", message: describeError(e), finishedAt: new Date().toISOString() });
    } catch (e2) { console.error("[portfolioV2] could not record the failure:", e2); }
  } finally {
    const remaining = await store.completeRunItem(runId, usage);
    if (remaining <= 0) await finalizeRun({ runId, userId, attempt, fx: deps.fx });
  }
}

/** Computes every platform Total and closes the run (runs once per attempt). */
export async function finalizeRun({ runId, userId, attempt, fx, timedOut = false }) {
  if (!(await store.claimFinalize(runId, `a${attempt}`))) return;
  const run = await store.getRun(runId, userId);
  if (!run) return;
  const items = run.items.map(i => ({ ...i }));
  const now = new Date();

  if (timedOut) {
    items.forEach((it, i) => {
      if (it.type !== "Total" && ["queued", "searching", "computing"].includes(it.status)) {
        items[i] = { ...it, status: "failed", message: "Timed out", finishedAt: now.toISOString() };
      }
    });
  }

  const [assets, snapshots] = await Promise.all([store.listAssets(userId), store.listSnapshots(userId)]);
  const latest = latestByAsset(snapshots);
  const newIds = new Set(snapshots.filter(s => s.runId === runId).map(s => s.snapshotId));

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.type !== "Total") continue;
    try {
      const totalAsset = assets.find(a => a.assetId === it.assetId);
      if (!totalAsset) { items[i] = { ...it, status: "skipped", message: "Total removed" }; continue; }
      const total = computePlatformTotal(assets.filter(a => a.platform === totalAsset.platform), latest, newIds);
      if (!total.hasNew || total.priceDate == null) {
        items[i] = { ...it, status: "no_new_data", message: total.counted ? `${total.comments}; nothing new` : "No asset prices yet", finishedAt: now.toISOString() };
        continue;
      }
      const snap = buildTotalSnapshot({ totalAsset, total, runId, snapshotId: randomUUID(), userId, now });
      await store.putSnapshot(snap);
      items[i] = {
        ...it, status: "updated", snapshotId: snap.snapshotId, valueEUR: snap.valueEUR, priceDate: snap.priceDate,
        currency: "EUR", message: total.comments, flagged: total.missing > 0, finishedAt: now.toISOString(),
      };
    } catch (e) {
      console.error("[portfolioV2] total failed:", e);
      items[i] = { ...it, status: "failed", message: `Could not compute the total: ${String(e?.message ?? e).slice(0, 160)}` };
    }
  }

  await store.setRunFields(runId, {
    items,
    status: finalStatus(items, !!run.cancelRequested),
    summary: summarize(items),
    finishedAt: now.toISOString(),
    fxDate: fx?.updatedAt ?? null,
  });
}
