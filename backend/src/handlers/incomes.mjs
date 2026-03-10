import { randomUUID } from "crypto";
import {
  GetCommand,
  PutCommand,
  DeleteCommand,
  ScanCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient } from "../lib/dynamo.mjs";
import { expandDates } from "../lib/expandDates.mjs";

const TABLE = "Incomes";

const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };

const ok = (body, statusCode = 200) => ({
  statusCode,
  headers: CORS,
  body: JSON.stringify(body),
});

const err = (statusCode, message) => ({
  statusCode,
  headers: CORS,
  body: JSON.stringify({ message }),
});

// ─── POST /incomes ──────────────────────────────────────────────────────────
async function createIncome(body, userId) {
  const { summary, date, amount, currency = "RON", isRepeatable = false, repeatFrequency, seriesEndDate } = body;

  if (!summary || !date || amount == null) {
    return err(400, "summary, date, and amount are required");
  }

  const currentYear = new Date().getFullYear();
  const yearStart = `${currentYear}-01-01`;
  const yearEnd   = `${currentYear}-12-31`;
  if (date < yearStart || date > yearEnd) {
    return err(400, `Date must be within the current year (${currentYear})`);
  }
  if (seriesEndDate && (seriesEndDate < yearStart || seriesEndDate > yearEnd)) {
    return err(400, `Series end date must be within the current year (${currentYear})`);
  }

  if (!isRepeatable) {
    const incomeId = randomUUID();
    const item = { incomeId, seriesId: incomeId, summary, date, amount, currency, isRepeatable: false, userId };
    await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
    return ok({ incomeId, seriesId: incomeId, count: 1 }, 201);
  }

  if (!repeatFrequency || !seriesEndDate) {
    return err(400, "repeatFrequency and seriesEndDate are required for repeatable incomes");
  }

  const dates = expandDates(date, seriesEndDate, repeatFrequency);
  if (dates.length === 0) return err(400, "seriesEndDate must be >= date");

  const seriesId = randomUUID();
  const items = dates.map((d) => ({
    incomeId: randomUUID(),
    seriesId,
    summary,
    date: d,
    amount,
    currency,
    isRepeatable: true,
    repeatFrequency,
    seriesEndDate,
    userId,
  }));

  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25).map((Item) => ({ PutRequest: { Item } }));
    await docClient.send(new BatchWriteCommand({ RequestItems: { [TABLE]: chunk } }));
  }

  return ok({ seriesId, count: items.length }, 201);
}

// ─── GET /incomes ────────────────────────────────────────────────────────────
async function listIncomes(queryParams, userId) {
  const { from, to } = queryParams || {};
  const expressions = ["userId = :uid"];
  const names = {};
  const values = { ":uid": userId };

  if (from || to) {
    names["#date"] = "date";
    if (from) { expressions.push("#date >= :from"); values[":from"] = from; }
    if (to)   { expressions.push("#date <= :to");   values[":to"]   = to;   }
  }

  const params = {
    TableName: TABLE,
    FilterExpression: expressions.join(" AND "),
    ExpressionAttributeValues: values,
    ...(Object.keys(names).length ? { ExpressionAttributeNames: names } : {}),
  };

  const { Items = [] } = await docClient.send(new ScanCommand(params));
  Items.sort((a, b) => a.date.localeCompare(b.date));
  return ok(Items);
}

// ─── GET /incomes/{incomeId} ─────────────────────────────────────────────────
async function getIncome(incomeId, userId) {
  const { Item } = await docClient.send(new GetCommand({ TableName: TABLE, Key: { incomeId } }));
  if (!Item || Item.userId !== userId) return err(404, "Income not found");
  return ok(Item);
}

// ─── PUT /incomes/{incomeId} ─────────────────────────────────────────────────
async function updateIncome(incomeId, body, userId) {
  const { Item: existing } = await docClient.send(new GetCommand({ TableName: TABLE, Key: { incomeId } }));
  if (!existing || existing.userId !== userId) return err(404, "Income not found");

  const isPartOfSeries = existing.seriesId !== existing.incomeId;
  const updated = {
    ...existing,
    ...body,
    incomeId,
    userId,
    ...(isPartOfSeries ? { isException: true } : {}),
  };

  await docClient.send(new PutCommand({ TableName: TABLE, Item: updated }));
  return ok(updated);
}

// ─── PUT /incomes/{incomeId}/series ──────────────────────────────────────────
async function updateIncomeSeries(incomeId, body, userId) {
  const { Item: existing } = await docClient.send(new GetCommand({ TableName: TABLE, Key: { incomeId } }));
  if (!existing || existing.userId !== userId) return err(404, "Income not found");

  const { seriesId, date } = existing;
  const { summary, amount, currency } = body;

  const { Items = [] } = await docClient.send(new ScanCommand({
    TableName: TABLE,
    FilterExpression: "seriesId = :sid AND #date >= :date AND userId = :uid",
    ExpressionAttributeNames: { "#date": "date" },
    ExpressionAttributeValues: { ":sid": seriesId, ":date": date, ":uid": userId },
  }));

  const updates = Items.map((item) => ({
    ...item,
    ...(summary !== undefined ? { summary } : {}),
    ...(amount  !== undefined ? { amount  } : {}),
    ...(currency !== undefined ? { currency } : {}),
  }));

  for (let i = 0; i < updates.length; i += 25) {
    const chunk = updates.slice(i, i + 25).map((Item) => ({ PutRequest: { Item } }));
    await docClient.send(new BatchWriteCommand({ RequestItems: { [TABLE]: chunk } }));
  }

  return ok({ updated: updates.length });
}

// ─── DELETE /incomes/{incomeId} ───────────────────────────────────────────────
async function deleteIncome(incomeId, queryParams, userId) {
  const deleteSeries = (queryParams?.deleteSeries === "true");

  if (!deleteSeries) {
    const { Item: existing } = await docClient.send(new GetCommand({ TableName: TABLE, Key: { incomeId } }));
    if (!existing || existing.userId !== userId) return err(404, "Income not found");
    await docClient.send(new DeleteCommand({ TableName: TABLE, Key: { incomeId } }));
    return ok({ deleted: 1 });
  }

  const { Item: existing } = await docClient.send(new GetCommand({ TableName: TABLE, Key: { incomeId } }));
  if (!existing || existing.userId !== userId) return err(404, "Income not found");

  const { Items = [] } = await docClient.send(new ScanCommand({
    TableName: TABLE,
    FilterExpression: "seriesId = :sid AND userId = :uid",
    ExpressionAttributeValues: { ":sid": existing.seriesId, ":uid": userId },
  }));

  for (let i = 0; i < Items.length; i += 25) {
    const chunk = Items.slice(i, i + 25).map(({ incomeId: id }) => ({
      DeleteRequest: { Key: { incomeId: id } },
    }));
    await docClient.send(new BatchWriteCommand({ RequestItems: { [TABLE]: chunk } }));
  }

  return ok({ deleted: Items.length });
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const handler = async (event) => {
  try {
    const { resource, httpMethod, pathParameters, queryStringParameters, body: rawBody } = event;
    const body     = rawBody ? JSON.parse(rawBody) : {};
    const incomeId = pathParameters?.incomeId;
    const userId   = event.requestContext?.authorizer?.claims?.sub ?? "local-dev";

    if (resource === "/incomes" && httpMethod === "POST") return await createIncome(body, userId);
    if (resource === "/incomes" && httpMethod === "GET")  return await listIncomes(queryStringParameters, userId);
    if (resource === "/incomes/{incomeId}" && httpMethod === "GET")    return await getIncome(incomeId, userId);
    if (resource === "/incomes/{incomeId}" && httpMethod === "PUT")    return await updateIncome(incomeId, body, userId);
    if (resource === "/incomes/{incomeId}" && httpMethod === "DELETE") return await deleteIncome(incomeId, queryStringParameters, userId);
    if (resource === "/incomes/{incomeId}/series" && httpMethod === "PUT") return await updateIncomeSeries(incomeId, body, userId);

    return err(404, "Route not found");
  } catch (e) {
    console.error(e);
    return err(500, e.message || "Internal server error");
  }
};
