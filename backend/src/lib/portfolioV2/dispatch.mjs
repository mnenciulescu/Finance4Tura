// Portfolio v2 — starts the price workers of a run, a few at a time.
//
// The AWS account allows 10 concurrent Lambda executions in total. Starting
// one worker per asset at once took all of them, and every other call of the
// app (including the run dialog's polling) was throttled until workers
// finished. So a run starts at most MAX_PARALLEL workers; each worker, when it
// is done, claims the next queued asset and starts a worker for it.
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import * as store from "./store.mjs";

export const MAX_PARALLEL = 5;

const lambda = new LambdaClient({ region: process.env.AWS_REGION || "eu-central-1" });

async function invoke(functionName, payload) {
  await lambda.send(new InvokeCommand({
    FunctionName: functionName,
    InvocationType: "Event",
    Payload: Buffer.from(JSON.stringify(payload)),
  }));
}

/** Run fields for a new queue: the first MAX_PARALLEL are started at once. */
export const queueFields = (indexes) => ({
  queue: indexes,
  queueLength: indexes.length,
  dispatched: Math.min(MAX_PARALLEL, indexes.length),
});

/** Starts the first workers of a queue written with `queueFields` (API side). */
export async function startWorkers({ functionName, runId, userId, attempt, indexes }) {
  if (!functionName) throw new Error("PV2_WORKER_FUNCTION is not set");
  await Promise.all(indexes.slice(0, MAX_PARALLEL).map(index => invoke(functionName, { runId, userId, index, attempt })));
}

/** Called by a worker when it is done: starts the next queued asset, if any. */
export async function dispatchNext({ functionName, runId, userId, attempt }) {
  const index = await store.claimNextQueued(runId, attempt);
  if (index == null) return;
  await invoke(functionName, { runId, userId, index, attempt });
}
