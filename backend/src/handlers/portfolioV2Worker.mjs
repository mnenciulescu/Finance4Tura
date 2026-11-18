// Portfolio v2 — async worker: prices one asset of a snapshot run.
// Invoked with InvocationType "Event" ({ runId, userId, index, attempt }) by the
// API for the first few assets, then by each finished worker for the next one.
import Anthropic from "@anthropic-ai/sdk";
import { readApiKey, readConfig } from "../lib/portfolioV2/aiConfig.mjs";
import { processItem, readFx } from "../lib/portfolioV2/runner.mjs";
import { dispatchNext } from "../lib/portfolioV2/dispatch.mjs";

let client = null;
let clientKey = null;

export async function handler(event) {
  const { runId, userId, index, attempt } = event ?? {};
  if (!runId || !userId || !Number.isInteger(index)) {
    console.error("[portfolioV2Worker] bad event", event);
    return;
  }
  try {
    const [config, key, fx] = await Promise.all([readConfig(), readApiKey(), readFx()]);
    if (key && key !== clientKey) {
      client = new Anthropic({ apiKey: key, maxRetries: 1, timeout: 240_000 });
      clientKey = key;
    }
    await processItem({
      runId, userId, index,
      deps: { client: key && config.keyUpdatedAt && config.enabled ? client : null, config, fx },
    });
  } finally {
    // Hand the slot to the next queued asset of this run.
    try {
      await dispatchNext({ functionName: process.env.AWS_LAMBDA_FUNCTION_NAME, runId, userId, attempt });
    } catch (e) { console.error("[portfolioV2Worker] could not start the next asset:", e); }
  }
}
