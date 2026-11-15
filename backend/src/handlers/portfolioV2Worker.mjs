// Portfolio v2 — async worker: prices one asset of a snapshot run.
// Invoked with InvocationType "Event" by the API ({ runId, userId, index }).
import Anthropic from "@anthropic-ai/sdk";
import { readApiKey, readConfig } from "../lib/portfolioV2/aiConfig.mjs";
import { processItem, readFx } from "../lib/portfolioV2/runner.mjs";

let client = null;
let clientKey = null;

export async function handler(event) {
  const { runId, userId, index } = event ?? {};
  if (!runId || !userId || !Number.isInteger(index)) {
    console.error("[portfolioV2Worker] bad event", event);
    return;
  }
  const [config, key, fx] = await Promise.all([readConfig(), readApiKey(), readFx()]);
  if (key && key !== clientKey) {
    client = new Anthropic({ apiKey: key, maxRetries: 2, timeout: 180_000 });
    clientKey = key;
  }
  await processItem({
    runId, userId, index,
    deps: { client: key && config.keyUpdatedAt && config.enabled ? client : null, config, fx },
  });
}
