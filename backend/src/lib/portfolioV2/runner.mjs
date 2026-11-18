// Portfolio v2 — snapshot runs. One worker invocation prices one asset; the
// last one to finish computes the platform Totals and closes the run.
import { randomUUID } from "crypto";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../dynamo.mjs";
import {
  buildAssetSnapshot, buildTotalSnapshot, checkAgentResult, computePlatformTotal, computeValues,
  finalStatus, isNewData, latestByAsset, sameDaySlot, summarize,
} from "./model.mjs";
import { describeError, lookupPrice, MAX_SEARCHES_LIMIT, PAGE_TOKENS } from "./agent.mjs";
import * as store from "./store.mjs";

/** The deeper second pass only starts if the first one finished within this. */
const SECOND_PASS_BEFORE_MS = 7 * 60 * 1000;

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

    const t0 = Date.now();
    const addUsage = (u) => { for (const k of Object.keys(u)) usage[k] = (usage[k] ?? 0) + u[k]; };
    const searches = deps.config.maxSearches;
    let found = await lookupPrice({ client: deps.client, asset, last, model: deps.config.model, maxSearches: searches });
    addUsage(found.usage);
    let r = found.result;
    let check = checkAgentResult(r, asset, deps.now?.() ?? new Date());

    // Nothing usable (not found, wrong currency, no source…): one deeper pass
    // with twice the searches, more effort and what went wrong. An old but
    // confirmed price is usable and is kept (marked stale) without a retry.
    if (!check.ok && Date.now() - t0 < SECOND_PASS_BEFORE_MS) {
      await store.updateRunItem(runId, index, { status: "searching", message: `Searching deeper: ${check.message}`.slice(0, 300) });
      const hint = r?.found && r.unitPrice != null
        ? `it found ${r.unitPrice} ${r.currency ?? ""} for ${r.priceDate ?? "an unknown date"}, which was rejected: ${check.message}.`
        : `it found nothing usable: ${check.message}.`;
      found = await lookupPrice({
        client: deps.client, asset, last, model: deps.config.model, effort: "high", pageTokens: PAGE_TOKENS.deep, hint,
        maxSearches: Math.min(MAX_SEARCHES_LIMIT, searches * 2),
      });
      addUsage(found.usage);
      r = found.result;
      check = checkAgentResult(r, asset, deps.now?.() ?? new Date());
    }
    if (!check.ok) {
      await store.updateRunItem(runId, index, {
        status: check.status, message: check.message, finishedAt: new Date().toISOString(),
        unitPrice: r?.unitPrice ?? null, currency: r?.currency ?? null, latestPriceDate: r?.priceDate ?? null,
        sourceUrl: r?.sources?.[0]?.url ?? null,
      });
      return;
    }

    const now = deps.now?.() ?? new Date();
    if (!isNewData(last, asset, r.priceDate, now)) {
      await store.updateRunItem(runId, index, {
        status: "no_new_data", message: `Latest price ${last.latestPriceDate} already recorded`,
        unitPrice: Number(r.unitPrice), currency: asset.currency, latestPriceDate: r.priceDate,
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
    // A second run on the same day overwrites that day's snapshot.
    const slot = sameDaySlot(snapshots, now);
    const snap = buildAssetSnapshot({
      asset, result: r, values, last: slot.previous, runId, userId, now,
      snapshotId: slot.replace?.snapshotId ?? randomUUID(),
    });
    await store.putSnapshot(snap);
    if (slot.extra.length) await store.deleteSnapshots(slot.extra.map(s => s.snapshotId));
    await store.updateRunItem(runId, index, {
      status: "updated", snapshotId: snap.snapshotId, unitPrice: snap.unitPrice, currency: snap.currency,
      value: snap.value, valueEUR: snap.valueEUR, sourceUrl: snap.sources[0]?.url ?? null,
      flagged: snap.flagged, stale: snap.stale, latestPriceDate: snap.latestPriceDate, finishedAt: new Date().toISOString(),
      message: [snap.flagged ? snap.comments : check.message, slot.replace ? "Replaced today's earlier snapshot" : null].filter(Boolean).join(" · ") || null,
    });
  } catch (e) {
    console.error(`[portfolioV2] item ${index} of run ${runId} failed:`, e);
    try {
      await store.updateRunItem(runId, index, { status: "failed", message: describeError(e), finishedAt: new Date().toISOString() });
    } catch (e2) { console.error("[portfolioV2] could not record the failure:", e2); }
  } finally {
    // Per-asset usage, shown on the asset's row in the run dialog.
    if (Object.keys(usage).length) {
      try { await store.updateRunItem(runId, index, { usage }); } catch (e) { console.error("[portfolioV2] could not record usage:", e); }
    }
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
      if (!total.hasNew || total.latestPriceDate == null) {
        items[i] = { ...it, status: "no_new_data", message: total.counted ? `${total.comments}; nothing new` : "No asset prices yet", finishedAt: now.toISOString() };
        continue;
      }
      const slot = sameDaySlot(snapshots.filter(s => s.assetId === totalAsset.assetId), now);
      const snap = buildTotalSnapshot({ totalAsset, total, runId, snapshotId: slot.replace?.snapshotId ?? randomUUID(), userId, now });
      await store.putSnapshot(snap);
      if (slot.extra.length) await store.deleteSnapshots(slot.extra.map(s => s.snapshotId));
      items[i] = {
        ...it, status: "updated", snapshotId: snap.snapshotId, valueEUR: snap.valueEUR, latestPriceDate: snap.latestPriceDate,
        currency: "EUR", message: slot.replace ? `${total.comments} · replaced today's earlier total` : total.comments, flagged: total.missing > 0, finishedAt: now.toISOString(),
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
