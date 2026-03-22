/**
 * Sync all DynamoDB tables from AWS → local DynamoDB Local.
 * - Reads every item from AWS (handles pagination)
 * - Wipes each local table
 * - Writes all AWS items to local (batch writes of 25)
 *
 * AWS data is NEVER modified. Local data is fully replaced.
 *
 * Usage:  node src/sync-from-aws.mjs
 * Requires DynamoDB Local running on http://localhost:8000
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const awsClient  = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-central-1" }));
const localClient = DynamoDBDocumentClient.from(new DynamoDBClient({ endpoint: "http://localhost:8000", region: "eu-central-1" }));

// Table name → primary key attribute name
const TABLES = {
  Incomes:               "incomeId",
  Expenses:              "expenseId",
  InvestmentOperations:  "operationId",
  PortfolioSnapshots:    "snapshotId",
  SP500Monthly:          "monthId",
  SplitPayments:         "splitPaymentId",
  TestTemplates:         "templateId",
  TestResults:           "resultId",
  KidConfig:             "userId",
  AppSettings:           "settingKey",
};

// ── Scan all items from a table (handles pagination) ──────────────────────────

async function scanAll(client, tableName) {
  const items = [];
  let lastKey;
  do {
    const res = await client.send(new ScanCommand({
      TableName: tableName,
      ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
    }));
    items.push(...(res.Items ?? []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

// ── Delete all items from a local table ───────────────────────────────────────

async function clearLocal(tableName, pk) {
  const items = await scanAll(localClient, tableName);
  for (const item of items) {
    await localClient.send(new DeleteCommand({ TableName: tableName, Key: { [pk]: item[pk] } }));
  }
  return items.length;
}

// ── Batch write items to local (25 per request) ───────────────────────────────

async function batchWrite(tableName, items) {
  for (let i = 0; i < items.length; i += 25) {
    const batch = items.slice(i, i + 25);
    await localClient.send(new BatchWriteCommand({
      RequestItems: {
        [tableName]: batch.map(item => ({ PutRequest: { Item: item } })),
      },
    }));
  }
}

// ── Detect the real userId from AWS records ───────────────────────────────────

async function detectUserId() {
  // Look at the first record with a userId in any user-scoped table
  for (const table of ["InvestmentOperations", "Incomes", "PortfolioSnapshots"]) {
    const res = await awsClient.send(new ScanCommand({ TableName: table, Limit: 1 }));
    const uid = res.Items?.[0]?.userId;
    if (uid) return uid;
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function sync() {
  console.log("Syncing AWS → local DynamoDB\n");

  // Remap the real Cognito userId → "local-dev" so SAM local serves the data
  const realUserId = await detectUserId();
  if (realUserId) {
    console.log(`  Remapping userId: ${realUserId} → local-dev\n`);
  }

  for (const [table, pk] of Object.entries(TABLES)) {
    process.stdout.write(`  ${table}…`);

    // 1. Fetch from AWS
    let awsItems = await scanAll(awsClient, table);
    process.stdout.write(` fetched ${awsItems.length} from AWS`);

    // 2. Remap userId in user-scoped tables (SP500Monthly has no userId)
    if (realUserId) {
      awsItems = awsItems.map(item =>
        item.userId === realUserId ? { ...item, userId: "local-dev" } : item
      );
    }

    // 3. Wipe local
    const cleared = await clearLocal(table, pk);
    process.stdout.write(`, cleared ${cleared} local`);

    // 4. Write to local
    if (awsItems.length > 0) await batchWrite(table, awsItems);
    console.log(`, wrote ${awsItems.length} ✓`);
  }

  console.log("\n✅ Sync complete — local DB now mirrors AWS (userId remapped to local-dev).");
}

sync().catch(e => { console.error("\n❌", e.message); process.exit(1); });
