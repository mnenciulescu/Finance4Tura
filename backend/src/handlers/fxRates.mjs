import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../lib/dynamo.mjs";
import { buildMatrix, SUPPORTED_CURRENCIES } from "../lib/currencies.mjs";

const TABLE  = process.env.FX_RATES_TABLE || "FxRates";
const DB_KEY = "global";

const CORS = {
  "Content-Type":                "application/json",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control":               "no-store",
};

const ok  = (body)            => ({ statusCode: 200, headers: CORS, body: JSON.stringify(body) });
const err = (status, message) => ({ statusCode: status, headers: CORS, body: JSON.stringify({ message }) });

// Mirrors the same check in appSettings.mjs / admin.mjs — no caller, no admin.
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

// GET /fx-rates (public) — return the stored, shared FX rates. No runtime fetch.
async function handleGet() {
  const result = await docClient.send(new GetCommand({ TableName: TABLE, Key: { rateId: DB_KEY } }));
  const item = result.Item;
  return ok({ rates: item?.rates ?? null, updatedAt: item?.updatedAt ?? null });
}

// POST /fx-rates (admin only) — fetch fresh EUR-based rates from frankfurter.app
// and persist the full conversion matrix for every supported currency, so it is
// shared across all users.
async function handlePost(event) {
  if (!isCallerAdmin(event)) return err(403, "Admin access required");

  const others = SUPPORTED_CURRENCIES.filter(c => c !== "EUR");
  const log = [];
  log.push(`Fetching latest EUR→${others.join(",")} rates from frankfurter.app…`);

  let data;
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=EUR&to=${others.join(",")}`);
    data = await res.json();
  } catch {
    log.push("Error: could not reach frankfurter.app.");
    return err(502, JSON.stringify(log));
  }

  const missing = others.filter(c => data?.rates?.[c] == null);
  if (!data?.rates || missing.length) {
    log.push(`Error: no rates returned for ${missing.join(", ") || "any currency"}.`);
    return err(502, JSON.stringify(log));
  }

  const rates = buildMatrix(data.rates);
  const updatedAt = new Date().toISOString();
  await docClient.send(new PutCommand({
    TableName: TABLE,
    Item: { rateId: DB_KEY, rates, updatedAt },
  }));

  for (const from of SUPPORTED_CURRENCIES) {
    for (const to of SUPPORTED_CURRENCIES) {
      if (from !== to) log.push(`1 ${from} = ${rates[from][to]} ${to}`);
    }
  }
  log.push("Done — FX rates updated for all users.");

  return ok({ rates, updatedAt, log });
}

export async function handler(event) {
  try {
    if (event.httpMethod === "GET")  return await handleGet();
    if (event.httpMethod === "POST") return await handlePost(event);
    return err(405, "Method not allowed");
  } catch (e) {
    console.error(e);
    return err(500, e.message ?? "Internal server error");
  }
}
