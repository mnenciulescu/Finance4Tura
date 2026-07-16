import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../lib/dynamo.mjs";

const TABLE  = process.env.FX_RATES_TABLE || "FxRates";
const DB_KEY = "global";

const CORS = {
  "Content-Type":                "application/json",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control":               "no-store",
};

const ok  = (body)            => ({ statusCode: 200, headers: CORS, body: JSON.stringify(body) });
const err = (status, message) => ({ statusCode: status, headers: CORS, body: JSON.stringify({ message }) });

// Mirrors the same check in appSettings.mjs / admin.mjs — local dev always passes.
function isCallerAdmin(event) {
  const sub = event.requestContext?.authorizer?.claims?.sub;
  if (!sub || sub === "local-dev") return true;
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

const round6 = (n) => Math.round(n * 1e6) / 1e6;

// Build the full 3×3 conversion matrix between EUR, USD and RON from the two
// EUR-based rates. rates[FROM][TO] = value of 1 FROM expressed in TO.
function buildMatrix(eurToUsd, eurToRon) {
  const u = eurToUsd; // 1 EUR = u USD
  const r = eurToRon; // 1 EUR = r RON
  return {
    EUR: { EUR: 1,            USD: round6(u),     RON: round6(r)     },
    USD: { EUR: round6(1 / u), USD: 1,            RON: round6(r / u) },
    RON: { EUR: round6(1 / r), USD: round6(u / r), RON: 1            },
  };
}

// POST /fx-rates (admin only) — fetch fresh rates from frankfurter.app and persist
// the full EUR/USD/RON conversion matrix so it is shared across all users.
async function handlePost(event) {
  if (!isCallerAdmin(event)) return err(403, "Admin access required");

  const log = [];
  log.push("Fetching latest EUR→USD,RON rates from frankfurter.app…");

  let data;
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=EUR&to=USD,RON");
    data = await res.json();
  } catch {
    log.push("Error: could not reach frankfurter.app.");
    return err(502, JSON.stringify(log));
  }

  if (!data?.rates || data.rates.USD == null || data.rates.RON == null) {
    log.push("Error: no rates returned.");
    return err(502, JSON.stringify(log));
  }

  const rates = buildMatrix(data.rates.USD, data.rates.RON);
  const updatedAt = new Date().toISOString();
  await docClient.send(new PutCommand({
    TableName: TABLE,
    Item: { rateId: DB_KEY, rates, updatedAt },
  }));

  for (const from of ["EUR", "USD", "RON"]) {
    for (const to of ["EUR", "USD", "RON"]) {
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
