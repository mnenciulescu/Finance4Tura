import { ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../lib/dynamo.mjs";

const TABLE = process.env.SP500_TABLE || "SP500Monthly";

const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };
const ok  = body => ({ statusCode: 200, headers: CORS, body: JSON.stringify(body) });
const err = (status, message) => ({ statusCode: status, headers: CORS, body: JSON.stringify({ message }) });

function lastCompleteMonthId() {
  const now = new Date();
  const m    = now.getUTCMonth();
  const prevM = m === 0 ? 12 : m;
  const prevY = m === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  return `${prevY}-${String(prevM).padStart(2, "0")}`;
}

function unixToMonthId(ts) {
  const d = new Date(ts * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function handleGet() {
  const { Items = [] } = await docClient.send(new ScanCommand({ TableName: TABLE }));
  const sorted = Items
    .map(i => ({ monthId: i.monthId, close: i.close }))
    .sort((a, b) => a.monthId.localeCompare(b.monthId));
  return ok(sorted);
}

// POST /sp500 with { sync: true }  → fetch missing months from Yahoo Finance and store them
// POST /sp500 with { monthId, close } → upsert a single record
async function handlePost(event) {
  const body = JSON.parse(event.body ?? "{}");

  if (!body.sync) {
    // Single-record write
    const { monthId, close } = body;
    if (!monthId || close == null) return err(400, "monthId and close are required");
    await docClient.send(new PutCommand({
      TableName: TABLE,
      Item: { monthId, close: parseFloat(Number(close).toFixed(2)) },
    }));
    return ok({ monthId, close });
  }

  // Sync mode: fetch missing months from Yahoo Finance
  const log = [];

  const { Items = [] } = await docClient.send(new ScanCommand({ TableName: TABLE }));
  const existingMonths = new Set(Items.map(i => i.monthId));
  const lastMonthId = Items.length ? [...existingMonths].sort().at(-1) : "2020-01";
  const target = lastCompleteMonthId();

  log.push(`Last month in database : ${lastMonthId}`);
  log.push(`Last complete month    : ${target}`);

  if (lastMonthId >= target) {
    log.push("S&P 500 data is already up to date.");
    return ok({ log, newRecords: 0 });
  }

  const fromDate = new Date(`${lastMonthId}-01T00:00:00Z`);
  fromDate.setUTCMonth(fromDate.getUTCMonth() + 1);
  const period1 = Math.floor(fromDate.getTime() / 1000);
  const period2 = Math.floor(Date.now() / 1000);

  log.push(`Fetching data from Yahoo Finance (${unixToMonthId(period1)} → ${target})...`);

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1mo&period1=${period1}&period2=${period2}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Finance4Tura/1.0)", "Accept": "application/json" },
  });

  if (!res.ok) {
    log.push(`Yahoo Finance returned HTTP ${res.status}`);
    return err(502, JSON.stringify(log));
  }

  const json = await res.json();
  const result = json.chart?.result?.[0];
  if (!result) {
    log.push("No data returned from Yahoo Finance.");
    return err(502, JSON.stringify(log));
  }

  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.adjclose?.[0]?.adjclose
    ?? result.indicators?.quote?.[0]?.close
    ?? [];

  let count = 0;
  for (let i = 0; i < timestamps.length; i++) {
    const monthId = unixToMonthId(timestamps[i]);
    const close   = closes[i];
    if (close == null || existingMonths.has(monthId) || monthId > target) continue;

    await docClient.send(new PutCommand({
      TableName: TABLE,
      Item: { monthId, close: parseFloat(close.toFixed(2)) },
    }));
    log.push(`Stored ${monthId}  →  close = ${close.toFixed(2)}`);
    count++;
  }

  log.push(count > 0
    ? `Done — added ${count} new month(s).`
    : "No new complete months found.");

  return ok({ log, newRecords: count });
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
