import { randomUUID } from "crypto";
import { GetCommand, PutCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../lib/dynamo.mjs";

const TABLE = process.env.INV_SNAPSHOTS_TABLE || "PortfolioSnapshots";

const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };
const ok  = (body, status = 200) => ({ statusCode: status, headers: CORS, body: JSON.stringify(body) });
const err = (status, message)    => ({ statusCode: status, headers: CORS, body: JSON.stringify({ message }) });

// ─── GET /investments/snapshots ───────────────────────────────────────────────
async function listSnapshots(userId, qs = {}) {
  const { Items = [] } = await docClient.send(new ScanCommand({
    TableName: TABLE,
    FilterExpression: "userId = :uid",
    ExpressionAttributeValues: { ":uid": userId },
  }));

  let items = Items;
  if (qs.from)     items = items.filter(i => i.date >= qs.from);
  if (qs.to)       items = items.filter(i => i.date <= qs.to);
  if (qs.platform) items = items.filter(i => i.platform === qs.platform);

  items.sort((a, b) => b.date.localeCompare(a.date));
  return ok(items);
}

// ─── GET /investments/snapshots/latest ───────────────────────────────────────
// Returns the most recent snapshot per platform for the user.
async function latestSnapshots(userId) {
  const { Items = [] } = await docClient.send(new ScanCommand({
    TableName: TABLE,
    FilterExpression: "userId = :uid",
    ExpressionAttributeValues: { ":uid": userId },
  }));

  const latestByPlatform = {};
  for (const item of Items) {
    const existing = latestByPlatform[item.platform];
    if (!existing || item.date > existing.date) {
      latestByPlatform[item.platform] = item;
    }
  }

  return ok(Object.values(latestByPlatform));
}

// ─── POST /investments/snapshots ──────────────────────────────────────────────
async function createSnapshot(body, userId) {
  const { date, platform, amount, currency } = body;
  if (!date || !platform || amount == null)
    return err(400, "date, platform, and amount are required");

  const snapshotId = randomUUID();
  const item = { snapshotId, userId, date, platform, amount, currency: currency || "USD" };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return ok(item, 201);
}

// ─── DELETE /investments/snapshots/{snapshotId} ───────────────────────────────
async function deleteSnapshot(snapshotId, userId) {
  const result = await docClient.send(new GetCommand({ TableName: TABLE, Key: { snapshotId } }));
  if (!result.Item || result.Item.userId !== userId) return err(404, "Not found");

  await docClient.send(new DeleteCommand({ TableName: TABLE, Key: { snapshotId } }));
  return ok({ deleted: true });
}

// ─── Router ──────────────────────────────────────────────────────────────────
export async function handler(event) {
  const userId     = event.requestContext?.authorizer?.claims?.sub ?? "local-dev";
  const method     = event.httpMethod;
  const snapshotId = event.pathParameters?.snapshotId;
  const qs         = event.queryStringParameters ?? {};
  const path       = event.path ?? "";

  try {
    if (method === "GET" && path.endsWith("/latest")) return await latestSnapshots(userId);
    if (method === "GET"    && !snapshotId)           return await listSnapshots(userId, qs);
    if (method === "POST")                            return await createSnapshot(JSON.parse(event.body || "{}"), userId);
    if (method === "DELETE" &&  snapshotId)           return await deleteSnapshot(snapshotId, userId);
    return err(404, "Not found");
  } catch (e) {
    console.error(e);
    return err(500, "Internal server error");
  }
}
