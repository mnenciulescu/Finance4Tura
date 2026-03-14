import { randomUUID } from "crypto";
import { GetCommand, PutCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../lib/dynamo.mjs";

const TABLE = process.env.INV_OPERATIONS_TABLE || "InvestmentOperations";

const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };
const ok  = (body, status = 200) => ({ statusCode: status, headers: CORS, body: JSON.stringify(body) });
const err = (status, message)    => ({ statusCode: status, headers: CORS, body: JSON.stringify({ message }) });

// ─── GET /investments/operations ─────────────────────────────────────────────
async function listOperations(userId, qs = {}) {
  const { Items = [] } = await docClient.send(new ScanCommand({
    TableName: TABLE,
    FilterExpression: "userId = :uid",
    ExpressionAttributeValues: { ":uid": userId },
  }));

  let items = Items;
  if (qs.from)     items = items.filter(i => i.date >= qs.from);
  if (qs.to)       items = items.filter(i => i.date <= qs.to);
  if (qs.platform) items = items.filter(i => i.platform === qs.platform);
  if (qs.type)     items = items.filter(i => i.type === qs.type);

  items.sort((a, b) => b.date.localeCompare(a.date));
  return ok(items);
}

// ─── POST /investments/operations ────────────────────────────────────────────
async function createOperation(body, userId) {
  const { date, type, platform, amount, currency, notes = "" } = body;
  if (!date || !type || !platform || amount == null)
    return err(400, "date, type, platform, and amount are required");

  const operationId = randomUUID();
  const item = { operationId, userId, date, type, platform, amount, currency: currency || "USD", notes };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return ok(item, 201);
}

// ─── PUT /investments/operations/{operationId} ───────────────────────────────
async function updateOperation(operationId, body, userId) {
  const result = await docClient.send(new GetCommand({ TableName: TABLE, Key: { operationId } }));
  if (!result.Item || result.Item.userId !== userId) return err(404, "Not found");

  const updated = { ...result.Item, ...body, operationId, userId };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: updated }));
  return ok(updated);
}

// ─── DELETE /investments/operations/{operationId} ────────────────────────────
async function deleteOperation(operationId, userId) {
  const result = await docClient.send(new GetCommand({ TableName: TABLE, Key: { operationId } }));
  if (!result.Item || result.Item.userId !== userId) return err(404, "Not found");

  await docClient.send(new DeleteCommand({ TableName: TABLE, Key: { operationId } }));
  return ok({ deleted: true });
}

// ─── Router ──────────────────────────────────────────────────────────────────
export async function handler(event) {
  const userId      = event.requestContext?.authorizer?.claims?.sub ?? "local-dev";
  const method      = event.httpMethod;
  const operationId = event.pathParameters?.operationId;
  const qs          = event.queryStringParameters ?? {};

  try {
    if (method === "GET"    && !operationId) return await listOperations(userId, qs);
    if (method === "POST")                   return await createOperation(JSON.parse(event.body || "{}"), userId);
    if (method === "PUT"    &&  operationId) return await updateOperation(operationId, JSON.parse(event.body || "{}"), userId);
    if (method === "DELETE" &&  operationId) return await deleteOperation(operationId, userId);
    return err(404, "Not found");
  } catch (e) {
    console.error(e);
    return err(500, "Internal server error");
  }
}
