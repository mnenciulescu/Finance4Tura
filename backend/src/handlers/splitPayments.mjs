import { randomUUID } from "crypto";
import {
  GetCommand,
  PutCommand,
  DeleteCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient } from "../lib/dynamo.mjs";

const TABLE = process.env.SPLIT_PAYMENTS_TABLE || "SplitPayments";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

const ok  = (body, statusCode = 200) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });
const err = (statusCode, message)    => ({ statusCode, headers: CORS, body: JSON.stringify({ message }) });

// ─── GET /split-payments ─────────────────────────────────────────────────────
async function listSplitPayments(userId) {
  const result = await docClient.send(new ScanCommand({
    TableName: TABLE,
    FilterExpression: "userId = :uid",
    ExpressionAttributeValues: { ":uid": userId },
  }));
  const items = (result.Items ?? []).sort((a, b) => b.createdDate.localeCompare(a.createdDate));
  return ok(items);
}

// ─── POST /split-payments ────────────────────────────────────────────────────
async function createSplitPayment(body, userId) {
  const { title, totalAmount, currency = "RON", occurrenceCount, occurrenceType, createdDate, occurrences } = body;

  if (!title || totalAmount == null || !occurrenceCount || !occurrenceType) {
    return err(400, "title, totalAmount, occurrenceCount, and occurrenceType are required");
  }

  const splitPaymentId = randomUUID();
  const item = {
    splitPaymentId,
    userId,
    title,
    totalAmount,
    currency,
    occurrenceCount,
    occurrenceType,
    createdDate: createdDate || new Date().toISOString().slice(0, 10),
    occurrences: occurrences ?? Array.from({ length: occurrenceCount }, (_, i) => ({ index: i, value: "" })),
  };

  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return ok(item, 201);
}

// ─── PUT /split-payments/{splitPaymentId} ────────────────────────────────────
async function updateSplitPayment(splitPaymentId, body, userId) {
  const result = await docClient.send(new GetCommand({ TableName: TABLE, Key: { splitPaymentId } }));
  if (!result.Item || result.Item.userId !== userId) return err(404, "Not found");

  const updated = { ...result.Item, ...body, splitPaymentId, userId };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: updated }));
  return ok(updated);
}

// ─── DELETE /split-payments/{splitPaymentId} ─────────────────────────────────
async function deleteSplitPayment(splitPaymentId, userId) {
  const result = await docClient.send(new GetCommand({ TableName: TABLE, Key: { splitPaymentId } }));
  if (!result.Item || result.Item.userId !== userId) return err(404, "Not found");

  await docClient.send(new DeleteCommand({ TableName: TABLE, Key: { splitPaymentId } }));
  return ok({ deleted: true });
}

// ─── Router ──────────────────────────────────────────────────────────────────
export async function handler(event) {
  const userId         = event.requestContext?.authorizer?.claims?.sub ?? "local-dev";
  const method         = event.httpMethod;
  const splitPaymentId = event.pathParameters?.splitPaymentId;

  try {
    if (method === "GET"    && !splitPaymentId) return await listSplitPayments(userId);
    if (method === "POST")                      return await createSplitPayment(JSON.parse(event.body || "{}"), userId);
    if (method === "PUT"    &&  splitPaymentId) return await updateSplitPayment(splitPaymentId, JSON.parse(event.body || "{}"), userId);
    if (method === "DELETE" &&  splitPaymentId) return await deleteSplitPayment(splitPaymentId, userId);
    return err(404, "Not found");
  } catch (e) {
    console.error(e);
    return err(500, "Internal server error");
  }
}
