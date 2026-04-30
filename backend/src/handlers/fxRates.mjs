import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../lib/dynamo.mjs";

const TABLE   = process.env.APP_SETTINGS_TABLE || "AppSettings";
const DB_KEY  = "fxRates";
const TTL_MS  = 24 * 60 * 60 * 1000; // refresh from frankfurter.app at most once per 24 h

const CORS = {
  "Content-Type":                "application/json",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control":               "no-store",
};

const ok  = (body)           => ({ statusCode: 200, headers: CORS, body: JSON.stringify(body) });
const err = (status, message) => ({ statusCode: status, headers: CORS, body: JSON.stringify({ message }) });

export async function handler() {
  try {
    const result = await docClient.send(new GetCommand({ TableName: TABLE, Key: { settingKey: DB_KEY } }));
    const cached = result.Item;
    const now    = Date.now();

    // Return cached rates if they are still fresh
    if (cached?.rates && cached.fetchedAt && (now - new Date(cached.fetchedAt).getTime()) < TTL_MS) {
      return ok({ rates: cached.rates, fetchedAt: cached.fetchedAt });
    }

    // Fetch fresh rates from frankfurter.app
    let data;
    try {
      const res = await fetch("https://api.frankfurter.app/latest?from=EUR&to=USD,RON");
      data = await res.json();
    } catch {
      // External fetch failed — return stale cache rather than an error
      if (cached?.rates) return ok({ rates: cached.rates, fetchedAt: cached.fetchedAt });
      return err(502, "FX rates unavailable");
    }

    if (!data?.rates) {
      if (cached?.rates) return ok({ rates: cached.rates, fetchedAt: cached.fetchedAt });
      return err(502, "FX rates unavailable");
    }

    // Persist fresh rates to DynamoDB so all devices benefit
    const fetchedAt = new Date().toISOString();
    await docClient.send(new PutCommand({
      TableName: TABLE,
      Item: { settingKey: DB_KEY, rates: data.rates, fetchedAt },
    }));

    return ok({ rates: data.rates, fetchedAt });
  } catch (e) {
    console.error(e);
    return err(500, "Internal server error");
  }
}
