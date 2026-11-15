// Portfolio v2 — assets, snapshots, snapshot runs and the AI agent config.
// Runs are started here and priced by PortfolioV2WorkerFunction, one async
// invocation per asset (API Gateway's 29 s limit rules out doing it inline).
import { randomUUID } from "crypto";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { assetMatchKey, latestByAsset, planImport, RUN_STALE_MS, runItems, validateAsset } from "../lib/portfolioV2/model.mjs";
import { publicConfig, readApiKey, readConfig, updateConfig, validateConfigUpdate } from "../lib/portfolioV2/aiConfig.mjs";
import { finalizeRun, readFx } from "../lib/portfolioV2/runner.mjs";
import * as store from "../lib/portfolioV2/store.mjs";

const WORKER = process.env.PV2_WORKER_FUNCTION;
const lambda = new LambdaClient({ region: process.env.AWS_REGION || "eu-central-1" });

const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };
const ok = (body, status = 200) => ({ statusCode: status, headers: CORS, body: JSON.stringify(body) });
const err = (status, message, extra = {}) => ({ statusCode: status, headers: CORS, body: JSON.stringify({ message, ...extra }) });

// Mirrors admin.mjs — no authenticated caller, no admin.
function isCallerAdmin(event) {
  const sub = event.requestContext?.authorizer?.claims?.sub;
  if (!sub) return false;
  const raw = event.requestContext?.authorizer?.claims?.["cognito:groups"];
  if (!raw) return false;
  try {
    const groups = JSON.parse(raw);
    return Array.isArray(groups) ? groups.includes("admin") : groups === "admin";
  } catch {
    return raw === "admin" || raw.split(",").map(s => s.trim()).includes("admin");
  }
}

/* ── Assets ───────────────────────────────────────────────────────────────── */

const firstError = (errors) => Object.values(errors)[0];

async function ensureTotal(userId, platform, assets) {
  if (assets.some(a => a.type === "Total" && a.platform.toLowerCase() === platform.toLowerCase())) return null;
  const { value } = validateAsset({ platform, type: "Total" });
  const now = new Date().toISOString();
  const total = { ...value, assetId: randomUUID(), userId, order: -1, createdAt: now, updatedAt: now };
  await store.putAsset(total);
  return total;
}

async function createAsset(userId, body) {
  const assets = await store.listAssets(userId);
  const { value, errors } = validateAsset(body, { others: assets });
  if (Object.keys(errors).length) return err(400, firstError(errors), { errors });
  if (assets.some(a => assetMatchKey(a) === assetMatchKey(value))) return err(400, "This asset already exists on the platform");
  const now = new Date().toISOString();
  const item = { ...value, assetId: randomUUID(), userId, createdAt: now, updatedAt: now };
  await store.putAsset(item);
  const total = value.type === "Total" ? null : await ensureTotal(userId, value.platform, assets);
  return ok({ asset: item, created: total ? [total] : [] }, 201);
}

async function updateAsset(userId, assetId, body) {
  const current = await store.getAsset(assetId, userId);
  if (!current) return err(404, "Not found");
  const assets = await store.listAssets(userId);
  const others = assets.filter(a => a.assetId !== assetId);
  const input = current.type === "Total" ? { ...body, platform: current.platform } : body;
  const { value, errors } = validateAsset(input, { others, current });
  if (Object.keys(errors).length) return err(400, firstError(errors), { errors });
  if (others.some(a => assetMatchKey(a) === assetMatchKey(value))) return err(400, "Another asset on this platform has the same identifier");
  const item = { ...current, ...value, updatedAt: new Date().toISOString() };
  await store.putAsset(item);
  const total = value.type === "Total" ? null : await ensureTotal(userId, value.platform, others);
  return ok({ asset: item, created: total ? [total] : [] });
}

async function removeAsset(userId, assetId, mode) {
  const current = await store.getAsset(assetId, userId);
  if (!current) return err(404, "Not found");
  if (current.type === "Total") {
    const assets = await store.listAssets(userId);
    if (assets.some(a => a.type !== "Total" && a.platform === current.platform)) {
      return err(400, "A platform's Total can only be deleted after its assets");
    }
  }
  if (mode === "archive" && current.type !== "Total") {
    const item = { ...current, active: false, updatedAt: new Date().toISOString() };
    await store.putAsset(item);
    return ok({ archived: true, asset: item });
  }
  const snaps = (await store.listSnapshots(userId)).filter(s => s.assetId === assetId);
  await store.deleteSnapshots(snaps.map(s => s.snapshotId));
  await store.deleteAsset(assetId);
  return ok({ deleted: true, snapshots: snaps.length });
}

async function importAssets(userId, body, dryRun) {
  const rows = Array.isArray(body?.rows) ? body.rows.slice(0, 500) : null;
  if (!rows) return err(400, "rows must be an array");
  const existing = await store.listAssets(userId);
  const plan = planImport(rows, existing);
  const summary = { create: plan.create.length, update: plan.update.length, errors: plan.errors };
  if (dryRun || plan.errors.length) return ok({ dryRun: true, ...summary, plan });
  const now = new Date().toISOString();
  for (const value of plan.create) {
    await store.putAsset({ ...value, assetId: randomUUID(), userId, createdAt: now, updatedAt: now });
  }
  for (const u of plan.update) {
    const current = existing.find(a => a.assetId === u.assetId);
    await store.putAsset({ ...current, ...u.value, updatedAt: now });
  }
  return ok({ dryRun: false, ...summary });
}

/* ── Runs ─────────────────────────────────────────────────────────────────── */

const isStale = (run) => run.status === "running" && Date.now() - Date.parse(run.startedAt) > RUN_STALE_MS;

async function invokeWorkers(runId, userId, indexes) {
  if (!WORKER) throw new Error("PV2_WORKER_FUNCTION is not set");
  await Promise.all(indexes.map(index => lambda.send(new InvokeCommand({
    FunctionName: WORKER,
    InvocationType: "Event",
    Payload: Buffer.from(JSON.stringify({ runId, userId, index })),
  }))));
}

async function aiReady() {
  const [config, key] = await Promise.all([readConfig(), readApiKey()]);
  // Only a key saved through Admin counts (an older parameter value is ignored).
  if (!key || !config.keyUpdatedAt) return { error: "Set the AI key in Admin → App Settings first" };
  if (!config.enabled) return { error: "The AI agent is switched off in Admin → App Settings" };
  return { config };
}

async function startRun(userId) {
  const ready = await aiReady();
  if (ready.error) return err(409, ready.error);
  const runs = await store.listRuns(userId);
  const active = runs.find(r => r.status === "running" && !isStale(r));
  if (active) return err(409, "A snapshot run is already in progress", { runId: active.runId });

  const assets = await store.listAssets(userId);
  const items = runItems(assets);
  const priced = items.map((it, i) => (it.type === "Total" ? -1 : i)).filter(i => i >= 0);
  if (priced.length === 0) return err(400, "Add assets before generating a snapshot");

  const now = new Date();
  const run = {
    runId: randomUUID(), userId, trigger: "manual", status: "running", attempt: 1,
    startedAt: now.toISOString(), finishedAt: null, items, remaining: priced.length,
    summary: null, model: ready.config.model,
    usage: { inputTokens: 0, outputTokens: 0, webSearches: 0 },
    expiresAt: Math.floor(now.getTime() / 1000) + 90 * 86400,
  };
  await store.putRun(run);
  try {
    await invokeWorkers(run.runId, userId, priced);
  } catch (e) {
    console.error("[portfolioV2] could not start workers:", e);
    await store.setRunFields(run.runId, { status: "failed", finishedAt: new Date().toISOString(), error: "Could not start the AI workers" });
    return err(500, "Could not start the snapshot run");
  }
  return ok(run, 201);
}

async function readRun(userId, runId) {
  let run = await store.getRun(runId, userId);
  if (!run) return err(404, "Not found");
  if (isStale(run)) {
    await finalizeRun({ runId, userId, attempt: run.attempt ?? 1, fx: await readFx(), timedOut: true });
    run = await store.getRun(runId, userId);
  }
  return ok(run);
}

async function recentRuns(userId, limit) {
  const runs = (await store.listRuns(userId)).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return ok(runs.slice(0, Math.min(Math.max(Number(limit) || 10, 1), 50)));
}

async function cancelRun(userId, runId) {
  const run = await store.getRun(runId, userId);
  if (!run) return err(404, "Not found");
  if (run.status !== "running") return err(409, "The run is not in progress");
  await store.setRunFields(runId, { cancelRequested: true });
  return ok({ cancelRequested: true });
}

async function retryRun(userId, runId, body) {
  const ready = await aiReady();
  if (ready.error) return err(409, ready.error);
  const run = await store.getRun(runId, userId);
  if (!run) return err(404, "Not found");
  if (run.status === "running" && !isStale(run)) return err(409, "Wait until the run has finished");
  const wanted = Array.isArray(body?.assetIds) && body.assetIds.length ? new Set(body.assetIds) : null;
  const items = run.items.map(i => ({ ...i }));
  const indexes = [];
  items.forEach((it, i) => {
    if (it.type === "Total") return;
    if (!["failed", "not_found", "skipped"].includes(it.status)) return;
    if (wanted && !wanted.has(it.assetId)) return;
    items[i] = { assetId: it.assetId, name: it.name, platform: it.platform, type: it.type, symbol: it.symbol, isin: it.isin, status: "queued" };
    indexes.push(i);
  });
  if (indexes.length === 0) return err(400, "Nothing to retry");
  const platforms = new Set(indexes.map(i => items[i].platform));
  items.forEach((it, i) => { if (it.type === "Total" && platforms.has(it.platform)) items[i] = { ...it, status: "queued", message: null }; });
  await store.setRunFields(runId, {
    items, status: "running", remaining: indexes.length, attempt: (run.attempt ?? 1) + 1,
    finishedAt: null, model: ready.config.model,
  }, ["cancelRequested", "finalizeToken"]);
  await invokeWorkers(runId, userId, indexes);
  return ok(await store.getRun(runId, userId));
}

/* ── Router ───────────────────────────────────────────────────────────────── */

export async function handler(event) {
  const userId = event.requestContext?.authorizer?.claims?.sub;
  if (!userId) return err(401, "Unauthorized");
  const method = event.httpMethod;
  const resource = event.resource ?? "";
  const p = event.pathParameters ?? {};
  const qs = event.queryStringParameters ?? {};
  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; } catch { return err(400, "Invalid JSON"); }

  try {
    switch (`${method} ${resource}`) {
      case "GET /portfolio-v2/assets": return ok(await store.listAssets(userId));
      case "POST /portfolio-v2/assets": return await createAsset(userId, body);
      case "POST /portfolio-v2/assets/import": return await importAssets(userId, body, qs.dryRun === "true");
      case "PUT /portfolio-v2/assets/{assetId}": return await updateAsset(userId, p.assetId, body);
      case "DELETE /portfolio-v2/assets/{assetId}": return await removeAsset(userId, p.assetId, qs.mode === "delete" ? "delete" : "archive");

      case "GET /portfolio-v2/snapshots": {
        let items = await store.listSnapshots(userId);
        if (qs.assetId) items = items.filter(s => s.assetId === qs.assetId);
        if (qs.from) items = items.filter(s => s.priceDate >= qs.from);
        if (qs.to) items = items.filter(s => s.priceDate <= qs.to);
        items.sort((a, b) => a.priceDate.localeCompare(b.priceDate) || a.generatedAt.localeCompare(b.generatedAt));
        return ok(items);
      }
      case "GET /portfolio-v2/snapshots/latest": return ok(Object.values(latestByAsset(await store.listSnapshots(userId))));

      case "GET /portfolio-v2/runs": return await recentRuns(userId, qs.limit);
      case "POST /portfolio-v2/runs": return await startRun(userId);
      case "GET /portfolio-v2/runs/{runId}": return await readRun(userId, p.runId);
      case "POST /portfolio-v2/runs/{runId}/cancel": return await cancelRun(userId, p.runId);
      case "POST /portfolio-v2/runs/{runId}/retry": return await retryRun(userId, p.runId, body);

      case "GET /portfolio-v2/ai-config": return ok(await publicConfig());
      case "PUT /portfolio-v2/ai-config": {
        if (!isCallerAdmin(event)) return err(403, "Admin access required");
        const { errors, changes } = validateConfigUpdate(body);
        if (Object.keys(errors).length) return err(400, firstError(errors), { errors });
        return ok(await updateConfig(changes));
      }
    }
    return err(404, "Not found");
  } catch (e) {
    console.error("[portfolioV2]", e);
    return err(500, "Internal server error");
  }
}
