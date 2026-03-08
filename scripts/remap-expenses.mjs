/**
 * remap-expenses.mjs
 * Re-resolves mappedIncomeId / mappedIncomeSummary / mappedIncomeDate
 * for every expense in DynamoDB (cloud), for all users.
 *
 * Usage:
 *   node scripts/remap-expenses.mjs
 */

import { DynamoDBClient, ScanCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const client = new DynamoDBClient({ region: "eu-central-1" });

// ── Fetch all items from a table (handles pagination) ────────────────────────

async function scanAll(TableName, FilterExpression, ExpressionAttributeNames, ExpressionAttributeValues) {
  const items = [];
  let LastEvaluatedKey;
  do {
    const res = await client.send(new ScanCommand({
      TableName,
      FilterExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues: FilterExpression ? marshall(ExpressionAttributeValues) : undefined,
      ExclusiveStartKey: LastEvaluatedKey,
    }));
    items.push(...(res.Items ?? []).map(unmarshall));
    LastEvaluatedKey = res.LastEvaluatedKey;
  } while (LastEvaluatedKey);
  return items;
}

// ── Resolve income for a given expense date + userId ─────────────────────────

function resolveIncome(expDate, userId, incomes) {
  return incomes
    .filter(i => i.userId === userId && i.date <= expDate)
    .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const incomes  = await scanAll("Incomes");
const expenses = await scanAll("Expenses");

console.log(`Loaded ${incomes.length} incomes, ${expenses.length} expenses.`);

let updated = 0;
let unchanged = 0;

for (const exp of expenses) {
  const best = resolveIncome(exp.date, exp.userId, incomes);

  const newId      = best?.incomeId  ?? null;
  const newSummary = best?.summary   ?? null;
  const newDate    = best?.date      ?? null;

  // Skip if nothing changed
  if (
    exp.mappedIncomeId      === newId &&
    exp.mappedIncomeSummary === newSummary &&
    exp.mappedIncomeDate    === newDate
  ) {
    unchanged++;
    continue;
  }

  // Build update expression
  const ExpressionAttributeNames  = { "#mid": "mappedIncomeId", "#ms": "mappedIncomeSummary", "#md": "mappedIncomeDate" };
  const ExpressionAttributeValues = {};
  let UpdateExpression;

  if (newId) {
    UpdateExpression = "SET #mid = :mid, #ms = :ms, #md = :md";
    ExpressionAttributeValues[":mid"] = newId;
    ExpressionAttributeValues[":ms"]  = newSummary;
    ExpressionAttributeValues[":md"]  = newDate;
  } else {
    UpdateExpression = "REMOVE #mid, #ms, #md";
  }

  await client.send(new UpdateItemCommand({
    TableName: "Expenses",
    Key: marshall({ expenseId: exp.expenseId }),
    UpdateExpression,
    ExpressionAttributeNames,
    ...(newId ? { ExpressionAttributeValues: marshall(ExpressionAttributeValues) } : {}),
  }));

  console.log(
    `  UPDATED ${exp.expenseId.slice(0, 8)}… (${exp.date}) ${exp.summary.slice(0, 30)}`
    + `  →  ${newDate ?? "UNMAPPED"} ${newSummary ?? ""}`
  );
  updated++;
}

console.log(`\nDone. ${updated} updated, ${unchanged} unchanged.`);
