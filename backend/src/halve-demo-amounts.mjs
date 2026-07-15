/**
 * Halves all financial amounts for the Demo user in production AWS DynamoDB.
 *
 * Tables affected (Demo user only):
 *  - Incomes:              amount / 2
 *  - Expenses:             amount / 2
 *  - InvestmentOperations: amount / 2
 *  - PortfolioSnapshots:   amount / 2
 *  - SplitPayments:        totalAmount / 2, each participant share / 2
 *
 * Tables NOT touched: TestTemplates, TestResults, KidConfig, Books_and_Dev
 * User NOT touched:   nenciulescu
 *
 * Usage: node src/halve-demo-amounts.mjs
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-central-1" }));

const DEMO_USER_ID = "0304f8e2-b021-70bd-50b8-66cd986eac68";

function half(n) {
  return Math.round(Number(n) * 50) / 100;
}

async function scanAllForUser(tableName, userId) {
  const items = [];
  let lastKey;
  do {
    const res = await client.send(new ScanCommand({
      TableName: tableName,
      FilterExpression: "userId = :uid",
      ExpressionAttributeValues: { ":uid": userId },
      ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
    }));
    items.push(...(res.Items ?? []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

async function updateAmount(tableName, pk, pkValue, newAmount) {
  await client.send(new UpdateCommand({
    TableName: tableName,
    Key: { [pk]: pkValue },
    UpdateExpression: "SET amount = :a",
    ExpressionAttributeValues: { ":a": newAmount },
  }));
}

async function run() {
  console.log("Halving financial amounts for Demo user in production AWS DynamoDB\n");
  console.log(`  Target userId: ${DEMO_USER_ID}\n`);

  // ── Incomes ────────────────────────────────────────────────────────────────
  {
    process.stdout.write("  Incomes…");
    const items = await scanAllForUser("Incomes", DEMO_USER_ID);
    for (const item of items) {
      await updateAmount("Incomes", "incomeId", item.incomeId, half(item.amount));
    }
    console.log(` updated ${items.length} ✓`);
  }

  // ── Expenses ───────────────────────────────────────────────────────────────
  {
    process.stdout.write("  Expenses…");
    const items = await scanAllForUser("Expenses", DEMO_USER_ID);
    for (const item of items) {
      await updateAmount("Expenses", "expenseId", item.expenseId, half(item.amount));
    }
    console.log(` updated ${items.length} ✓`);
  }

  // ── Investment Operations ──────────────────────────────────────────────────
  {
    process.stdout.write("  InvestmentOperations…");
    const items = await scanAllForUser("InvestmentOperations", DEMO_USER_ID);
    for (const item of items) {
      await updateAmount("InvestmentOperations", "operationId", item.operationId, half(item.amount));
    }
    console.log(` updated ${items.length} ✓`);
  }

  // ── Portfolio Snapshots ────────────────────────────────────────────────────
  {
    process.stdout.write("  PortfolioSnapshots…");
    const items = await scanAllForUser("PortfolioSnapshots", DEMO_USER_ID);
    for (const item of items) {
      await updateAmount("PortfolioSnapshots", "snapshotId", item.snapshotId, half(item.amount));
    }
    console.log(` updated ${items.length} ✓`);
  }

  // ── Split Payments ─────────────────────────────────────────────────────────
  // totalAmount + each participant's share
  {
    process.stdout.write("  SplitPayments…");
    const items = await scanAllForUser("SplitPayments", DEMO_USER_ID);
    for (const item of items) {
      const halvedParticipants = (item.participants ?? []).map(p => ({
        ...p,
        share: half(p.share),
      }));
      await client.send(new UpdateCommand({
        TableName: "SplitPayments",
        Key: { splitPaymentId: item.splitPaymentId },
        UpdateExpression: "SET totalAmount = :ta, participants = :p",
        ExpressionAttributeValues: {
          ":ta": half(item.totalAmount),
          ":p":  halvedParticipants,
        },
      }));
    }
    console.log(` updated ${items.length} ✓`);
  }

  console.log("\n✅ Done — all Demo financial amounts halved.");
  console.log("   nenciulescu's records were not touched.");
}

run().catch(e => { console.error("\n❌", e.message); process.exit(1); });
