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

const ok = (body, statusCode = 200) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const err = (statusCode, message) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message }),
});

// ─── resolveIncome(date) ─────────────────────────────────────────────────────
// Returns the income with the latest date <= expenseDate, or null.
async function resolveIncome(expenseDate) {
  const { Items = [] } = await docClient.send(new ScanCommand({
    TableName: INCOMES_TABLE,
    FilterExpression: "#date <= :expDate",
    ExpressionAttributeNames: { "#date": "date" },
    ExpressionAttributeValues: { ":expDate": expenseDate },
  }));

  if (Items.length === 0) return null;

  Items.sort((a, b) => b.date.localeCompare(a.date));
  return Items[0];
}

// ─── POST /expenses ──────────────────────────────────────────────────────────
async function createExpense(body) {
  const {
    summary, date, amount, currency = "RON",
    priority = "Medium", status = "Pending",
    isRepeatable = false, repeatFrequency, seriesEndDate,
  } = body;

  if (!summary || !date || amount == null) {
    return err(400, "summary, date, and amount are required");
  }

  if (!isRepeatable) {
    const income = await resolveIncome(date);
    const expenseId = randomUUID();
    const item = {
      expenseId,
      seriesId: expenseId,
      summary, date, amount, currency,
      priority, status,
      isRepeatable: false,
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

  // Resolve income per occurrence
  const items = await Promise.all(dates.map(async (d) => {
    const income = await resolveIncome(d);
    return {
      expenseId: randomUUID(),
      seriesId,
      summary, date: d, amount, currency,
      priority, status,
      isRepeatable: true,
      repeatFrequency,
      seriesEndDate,
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
async function listExpenses(queryParams) {
  const { from, to } = queryParams || {};
  const params = { TableName: EXPENSES_TABLE };

  if (from || to) {
    const expressions = [];
    const names = { "#date": "date" };
    const values = {};

    if (from) { expressions.push("#date >= :from"); values[":from"] = from; }
    if (to)   { expressions.push("#date <= :to");   values[":to"]   = to;   }

    params.FilterExpression = expressions.join(" AND ");
    params.ExpressionAttributeNames = names;
    params.ExpressionAttributeValues = values;
  }

  const { Items = [] } = await docClient.send(new ScanCommand(params));
  Items.sort((a, b) => a.date.localeCompare(b.date));
  return ok(Items);
}

// ─── GET /expenses/{expenseId} ───────────────────────────────────────────────
async function getExpense(expenseId) {
  const { Item } = await docClient.send(new GetCommand({ TableName: EXPENSES_TABLE, Key: { expenseId } }));
  if (!Item) return err(404, "Expense not found");
  return ok(Item);
}

// ─── PUT /expenses/{expenseId} ───────────────────────────────────────────────
async function updateExpense(expenseId, body) {
  const { Item: existing } = await docClient.send(new GetCommand({ TableName: EXPENSES_TABLE, Key: { expenseId } }));
  if (!existing) return err(404, "Expense not found");

  const isPartOfSeries = existing.seriesId !== existing.expenseId;

  // Re-resolve income if the date changed
  const newDate = body.date ?? existing.date;
  const income = await resolveIncome(newDate);

  const updated = {
    ...existing,
    ...body,
    expenseId,
    mappedIncomeId:      income?.incomeId      ?? null,
    mappedIncomeSummary: income?.summary        ?? null,
    mappedIncomeDate:    income?.date           ?? null,
    ...(isPartOfSeries ? { isException: true } : {}),
  };

  await docClient.send(new PutCommand({ TableName: EXPENSES_TABLE, Item: updated }));
  return ok(updated);
}

// ─── PUT /expenses/{expenseId}/series ────────────────────────────────────────
async function updateExpenseSeries(expenseId, body) {
  const { Item: existing } = await docClient.send(new GetCommand({ TableName: EXPENSES_TABLE, Key: { expenseId } }));
  if (!existing) return err(404, "Expense not found");

  const { seriesId, date } = existing;
  const { summary, amount, currency, priority, status } = body;

  const { Items = [] } = await docClient.send(new ScanCommand({
    TableName: EXPENSES_TABLE,
    FilterExpression: "seriesId = :sid AND #date >= :date",
    ExpressionAttributeNames: { "#date": "date" },
    ExpressionAttributeValues: { ":sid": seriesId, ":date": date },
  }));

  // Re-resolve income per occurrence in case amount/summary changed
  const updates = await Promise.all(Items.map(async (item) => {
    const income = await resolveIncome(item.date);
    return {
      ...item,
      ...(summary  !== undefined ? { summary  } : {}),
      ...(amount   !== undefined ? { amount   } : {}),
      ...(currency !== undefined ? { currency } : {}),
      ...(priority !== undefined ? { priority } : {}),
      ...(status   !== undefined ? { status   } : {}),
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
async function deleteExpense(expenseId, queryParams) {
  const deleteSeries = (queryParams?.deleteSeries === "true");

  if (!deleteSeries) {
    await docClient.send(new DeleteCommand({ TableName: EXPENSES_TABLE, Key: { expenseId } }));
    return ok({ deleted: 1 });
  }

  const { Item: existing } = await docClient.send(new GetCommand({ TableName: EXPENSES_TABLE, Key: { expenseId } }));
  if (!existing) return err(404, "Expense not found");

  const { Items = [] } = await docClient.send(new ScanCommand({
    TableName: EXPENSES_TABLE,
    FilterExpression: "seriesId = :sid",
    ExpressionAttributeValues: { ":sid": existing.seriesId },
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
async function resolveIncomePreview(queryParams) {
  const { date } = queryParams || {};
  if (!date) return err(400, "date query param is required");

  const income = await resolveIncome(date);
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
    const body = rawBody ? JSON.parse(rawBody) : {};
    const expenseId = pathParameters?.expenseId;

    if (resource === "/expenses/resolve-income" && httpMethod === "GET") return await resolveIncomePreview(queryStringParameters);
    if (resource === "/expenses"               && httpMethod === "POST") return await createExpense(body);
    if (resource === "/expenses"               && httpMethod === "GET")  return await listExpenses(queryStringParameters);
    if (resource === "/expenses/{expenseId}"   && httpMethod === "GET")    return await getExpense(expenseId);
    if (resource === "/expenses/{expenseId}"   && httpMethod === "PUT")    return await updateExpense(expenseId, body);
    if (resource === "/expenses/{expenseId}"   && httpMethod === "DELETE") return await deleteExpense(expenseId, queryStringParameters);
    if (resource === "/expenses/{expenseId}/series" && httpMethod === "PUT") return await updateExpenseSeries(expenseId, body);

    return err(404, "Route not found");
  } catch (e) {
    console.error(e);
    return err(500, e.message || "Internal server error");
  }
};
