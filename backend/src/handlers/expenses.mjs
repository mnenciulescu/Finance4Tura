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

const EXPENSES_TABLE = "Expenses";
const INCOMES_TABLE  = "Incomes";

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

// ─── resolveIncome(date, userId) ─────────────────────────────────────────────
// Returns the user's income with the latest date <= expenseDate, or null.
async function resolveIncome(expenseDate, userId) {
  const { Items = [] } = await docClient.send(new ScanCommand({
    TableName: INCOMES_TABLE,
    FilterExpression: "#date <= :expDate AND userId = :uid",
    ExpressionAttributeNames: { "#date": "date" },
    ExpressionAttributeValues: { ":expDate": expenseDate, ":uid": userId },
  }));

  if (Items.length === 0) return null;

  Items.sort((a, b) => b.date.localeCompare(a.date));
  return Items[0];
}

// ─── POST /expenses ──────────────────────────────────────────────────────────
async function createExpense(body, userId) {
  const {
    summary, date, amount, currency = "RON",
    priority = "Medium", status = "Pending",
    special = false,
    isRepeatable = false, repeatFrequency, seriesEndDate,
  } = body;

  if (!summary || !date || amount == null) {
    return err(400, "summary, date, and amount are required");
  }

  if (!isRepeatable) {
    const income = await resolveIncome(date, userId);
    const expenseId = randomUUID();
    const item = {
      expenseId,
      seriesId: expenseId,
      summary, date, amount, currency,
      priority, status, special,
      isRepeatable: false,
      userId,
      mappedIncomeId:      income?.incomeId      ?? null,
      mappedIncomeSummary: income?.summary        ?? null,
      mappedIncomeDate:    income?.date           ?? null,
    };
    await docClient.send(new PutCommand({ TableName: EXPENSES_TABLE, Item: item }));
    return ok({ expenseId, seriesId: expenseId, count: 1 }, 201);
  }

  if (!repeatFrequency || !seriesEndDate) {
    return err(400, "repeatFrequency and seriesEndDate are required for repeatable expenses");
  }

  const dates = expandDates(date, seriesEndDate, repeatFrequency);
  if (dates.length === 0) return err(400, "seriesEndDate must be >= date");

  const seriesId = randomUUID();

  const items = await Promise.all(dates.map(async (d) => {
    const income = await resolveIncome(d, userId);
    return {
      expenseId: randomUUID(),
      seriesId,
      summary, date: d, amount, currency,
      priority, status, special,
      isRepeatable: true,
      repeatFrequency,
      seriesEndDate,
      userId,
      mappedIncomeId:      income?.incomeId      ?? null,
      mappedIncomeSummary: income?.summary        ?? null,
      mappedIncomeDate:    income?.date           ?? null,
    };
  }));

  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25).map((Item) => ({ PutRequest: { Item } }));
    await docClient.send(new BatchWriteCommand({ RequestItems: { [EXPENSES_TABLE]: chunk } }));
  }

  return ok({ seriesId, count: items.length }, 201);
}

// ─── GET /expenses ───────────────────────────────────────────────────────────
async function listExpenses(queryParams, userId) {
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
    TableName: EXPENSES_TABLE,
    FilterExpression: expressions.join(" AND "),
    ExpressionAttributeValues: values,
    ...(Object.keys(names).length ? { ExpressionAttributeNames: names } : {}),
  };

  const { Items = [] } = await docClient.send(new ScanCommand(params));
  Items.sort((a, b) => a.date.localeCompare(b.date));
  return ok(Items);
}

// ─── GET /expenses/{expenseId} ───────────────────────────────────────────────
async function getExpense(expenseId, userId) {
  const { Item } = await docClient.send(new GetCommand({ TableName: EXPENSES_TABLE, Key: { expenseId } }));
  if (!Item || Item.userId !== userId) return err(404, "Expense not found");
  return ok(Item);
}

// ─── PUT /expenses/{expenseId} ───────────────────────────────────────────────
async function updateExpense(expenseId, body, userId) {
  const { Item: existing } = await docClient.send(new GetCommand({ TableName: EXPENSES_TABLE, Key: { expenseId } }));
  if (!existing || existing.userId !== userId) return err(404, "Expense not found");

  const isPartOfSeries = existing.seriesId !== existing.expenseId;
  const newDate = body.date ?? existing.date;
  const income = await resolveIncome(newDate, userId);

  const updated = {
    ...existing,
    ...body,
    expenseId,
    userId,
    mappedIncomeId:      income?.incomeId      ?? null,
    mappedIncomeSummary: income?.summary        ?? null,
    mappedIncomeDate:    income?.date           ?? null,
    ...(isPartOfSeries ? { isException: true } : {}),
  };

  await docClient.send(new PutCommand({ TableName: EXPENSES_TABLE, Item: updated }));
  return ok(updated);
}

// ─── PUT /expenses/{expenseId}/series ────────────────────────────────────────
async function updateExpenseSeries(expenseId, body, userId) {
  const { Item: existing } = await docClient.send(new GetCommand({ TableName: EXPENSES_TABLE, Key: { expenseId } }));
  if (!existing || existing.userId !== userId) return err(404, "Expense not found");

  const { seriesId, date } = existing;
  const { summary, amount, currency, priority, status, special } = body;

  const { Items = [] } = await docClient.send(new ScanCommand({
    TableName: EXPENSES_TABLE,
    FilterExpression: "seriesId = :sid AND #date >= :date AND userId = :uid",
    ExpressionAttributeNames: { "#date": "date" },
    ExpressionAttributeValues: { ":sid": seriesId, ":date": date, ":uid": userId },
  }));

  const updates = await Promise.all(Items.map(async (item) => {
    const income = await resolveIncome(item.date, userId);
    return {
      ...item,
      ...(summary  !== undefined ? { summary  } : {}),
      ...(amount   !== undefined ? { amount   } : {}),
      ...(currency !== undefined ? { currency } : {}),
      ...(priority !== undefined ? { priority } : {}),
      ...(status   !== undefined ? { status   } : {}),
      ...(special  !== undefined ? { special  } : {}),
      mappedIncomeId:      income?.incomeId      ?? null,
      mappedIncomeSummary: income?.summary        ?? null,
      mappedIncomeDate:    income?.date           ?? null,
    };
  }));

  for (let i = 0; i < updates.length; i += 25) {
    const chunk = updates.slice(i, i + 25).map((Item) => ({ PutRequest: { Item } }));
    await docClient.send(new BatchWriteCommand({ RequestItems: { [EXPENSES_TABLE]: chunk } }));
  }

  return ok({ updated: updates.length });
}

// ─── DELETE /expenses/{expenseId} ────────────────────────────────────────────
async function deleteExpense(expenseId, queryParams, userId) {
  const deleteSeries = (queryParams?.deleteSeries === "true");

  if (!deleteSeries) {
    const { Item: existing } = await docClient.send(new GetCommand({ TableName: EXPENSES_TABLE, Key: { expenseId } }));
    if (!existing || existing.userId !== userId) return err(404, "Expense not found");
    await docClient.send(new DeleteCommand({ TableName: EXPENSES_TABLE, Key: { expenseId } }));
    return ok({ deleted: 1 });
  }

  const { Item: existing } = await docClient.send(new GetCommand({ TableName: EXPENSES_TABLE, Key: { expenseId } }));
  if (!existing || existing.userId !== userId) return err(404, "Expense not found");

  const { Items = [] } = await docClient.send(new ScanCommand({
    TableName: EXPENSES_TABLE,
    FilterExpression: "seriesId = :sid AND userId = :uid",
    ExpressionAttributeValues: { ":sid": existing.seriesId, ":uid": userId },
  }));

  for (let i = 0; i < Items.length; i += 25) {
    const chunk = Items.slice(i, i + 25).map(({ expenseId: id }) => ({
      DeleteRequest: { Key: { expenseId: id } },
    }));
    await docClient.send(new BatchWriteCommand({ RequestItems: { [EXPENSES_TABLE]: chunk } }));
  }

  return ok({ deleted: Items.length });
}

// ─── GET /expenses/resolve-income?date= ──────────────────────────────────────
async function resolveIncomePreview(queryParams, userId) {
  const { date } = queryParams || {};
  if (!date) return err(400, "date query param is required");

  const income = await resolveIncome(date, userId);
  if (!income) return ok({ income: null });
  return ok({
    income: {
      incomeId: income.incomeId,
      summary:  income.summary,
      date:     income.date,
      amount:   income.amount,
      currency: income.currency,
    },
  });
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const handler = async (event) => {
  try {
    const { resource, httpMethod, pathParameters, queryStringParameters, body: rawBody } = event;
    const body      = rawBody ? JSON.parse(rawBody) : {};
    const expenseId = pathParameters?.expenseId;
    const userId    = event.requestContext?.authorizer?.claims?.sub ?? "local-dev";

    if (resource === "/expenses/resolve-income" && httpMethod === "GET") return await resolveIncomePreview(queryStringParameters, userId);
    if (resource === "/expenses"               && httpMethod === "POST") return await createExpense(body, userId);
    if (resource === "/expenses"               && httpMethod === "GET")  return await listExpenses(queryStringParameters, userId);
    if (resource === "/expenses/{expenseId}"   && httpMethod === "GET")    return await getExpense(expenseId, userId);
    if (resource === "/expenses/{expenseId}"   && httpMethod === "PUT")    return await updateExpense(expenseId, body, userId);
    if (resource === "/expenses/{expenseId}"   && httpMethod === "DELETE") return await deleteExpense(expenseId, queryStringParameters, userId);
    if (resource === "/expenses/{expenseId}/series" && httpMethod === "PUT") return await updateExpenseSeries(expenseId, body, userId);

    return err(404, "Route not found");
  } catch (e) {
    console.error(e);
    return err(500, e.message || "Internal server error");
  }
};
