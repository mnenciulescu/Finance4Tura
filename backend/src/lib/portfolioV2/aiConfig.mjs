// Portfolio v2 — AI agent configuration. The API key is a SecureString in
// SSM (never in the template, the repo or the frontend); the non-secret
// settings live in the AppSettings table under their own key.
import { DeleteParameterCommand, GetParameterCommand, PutParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../dynamo.mjs";
import { DEFAULT_MAX_SEARCHES, DEFAULT_MODEL, MAX_SEARCHES_LIMIT } from "./agent.mjs";

export const KEY_PARAMETER = process.env.PV2_KEY_PARAMETER || "/finance4tura/anthropic-api-key";
const SETTINGS_TABLE = process.env.APP_SETTINGS_TABLE || "AppSettings";
const SETTINGS_KEY = "portfolioV2Ai";
const ssm = new SSMClient({ region: process.env.AWS_REGION || "eu-central-1" });

export const DEFAULT_CONFIG = { enabled: true, model: DEFAULT_MODEL, maxSearches: DEFAULT_MAX_SEARCHES, keyUpdatedAt: null };

export async function readConfig() {
  const res = await docClient.send(new GetCommand({ TableName: SETTINGS_TABLE, Key: { settingKey: SETTINGS_KEY } }));
  const item = res.Item ?? {};
  return {
    enabled: item.enabled ?? DEFAULT_CONFIG.enabled,
    model: item.model || DEFAULT_CONFIG.model,
    maxSearches: item.maxSearches ?? DEFAULT_CONFIG.maxSearches,
    keyUpdatedAt: item.keyUpdatedAt ?? null,
  };
}

/** The config the frontend sees — never the key itself. */
export async function publicConfig() {
  const c = await readConfig();
  return { ...c, configured: !!c.keyUpdatedAt };
}

let cached = null; // { key, at }
const CACHE_MS = 5 * 60 * 1000;

export async function readApiKey() {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.key;
  try {
    const res = await ssm.send(new GetParameterCommand({ Name: KEY_PARAMETER, WithDecryption: true }));
    cached = { key: res.Parameter?.Value ?? null, at: Date.now() };
  } catch (e) {
    if (e?.name !== "ParameterNotFound") throw e;
    cached = { key: null, at: Date.now() };
  }
  return cached.key;
}

/** Validates an admin update; returns { errors, changes }. */
export function validateConfigUpdate(body = {}) {
  const errors = {};
  const changes = {};
  if (body.apiKey != null && body.apiKey !== "") {
    const k = String(body.apiKey).trim();
    if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(k)) errors.apiKey = "This does not look like an Anthropic API key (sk-ant-…)";
    else changes.apiKey = k;
  }
  if (body.clearKey === true) changes.clearKey = true;
  if (body.model !== undefined) {
    const m = String(body.model).trim();
    if (!/^claude-[a-z0-9.-]{3,60}$/.test(m)) errors.model = "Model must be a Claude model id (claude-…)";
    else changes.model = m;
  }
  if (body.maxSearches !== undefined) {
    const n = Number(body.maxSearches);
    if (!Number.isInteger(n) || n < 1 || n > MAX_SEARCHES_LIMIT) errors.maxSearches = `Between 1 and ${MAX_SEARCHES_LIMIT}`;
    else changes.maxSearches = n;
  }
  if (body.enabled !== undefined) changes.enabled = Boolean(body.enabled);
  return { errors, changes };
}

export async function updateConfig(changes) {
  const current = await readConfig();
  const next = { ...current };
  if (changes.apiKey) {
    await ssm.send(new PutParameterCommand({ Name: KEY_PARAMETER, Value: changes.apiKey, Type: "SecureString", Overwrite: true }));
    next.keyUpdatedAt = new Date().toISOString();
    cached = null;
  } else if (changes.clearKey) {
    try { await ssm.send(new DeleteParameterCommand({ Name: KEY_PARAMETER })); } catch (e) { if (e?.name !== "ParameterNotFound") throw e; }
    next.keyUpdatedAt = null;
    cached = null;
  }
  for (const k of ["model", "maxSearches", "enabled"]) if (changes[k] !== undefined) next[k] = changes[k];
  await docClient.send(new PutCommand({
    TableName: SETTINGS_TABLE,
    Item: { settingKey: SETTINGS_KEY, ...next, updatedAt: new Date().toISOString() },
  }));
  return { ...next, configured: !!next.keyUpdatedAt };
}
