/**
 * Seed production AWS DynamoDB with investment history for user nenciulescu.
 * Data sourced from Documentation/Portfolio.xlsx.
 *
 * Usage: node scripts/seed-investments.mjs
 * Requires: AWS credentials configured (aws configure) with access to eu-central-1 DynamoDB.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "eu-central-1" })
);

const USER_ID    = "e3c47852-9051-7092-9877-6b4e5186bc40"; // nenciulescu
const OPS_TABLE  = "InvestmentOperations";
const SNAP_TABLE = "PortfolioSnapshots";

// ── Historical Operations (from Portfolio.xlsx → Operations tab) ──────────────

const OPERATIONS = [
  { date: "2021-06-10", type: "Deposit", platform: "eToro",         amount: 210,     currency: "USD" },
  { date: "2021-10-07", type: "Deposit", platform: "eToro",         amount: 210,     currency: "USD" },
  { date: "2022-05-25", type: "Deposit", platform: "eToro",         amount: 208.74,  currency: "USD" },
  { date: "2022-06-23", type: "Deposit", platform: "eToro",         amount: 209.99,  currency: "USD" },
  { date: "2022-07-31", type: "Deposit", platform: "eToro",         amount: 201.51,  currency: "USD" },
  { date: "2022-08-25", type: "Deposit", platform: "eToro",         amount: 196.68,  currency: "USD" },
  { date: "2022-09-23", type: "Deposit", platform: "eToro",         amount: 50.94,   currency: "USD" },
  { date: "2022-09-27", type: "Deposit", platform: "eToro",         amount: 200,     currency: "USD" },
  { date: "2022-10-30", type: "Deposit", platform: "eToro",         amount: 200,     currency: "USD" },
  { date: "2022-11-29", type: "Deposit", platform: "Binance",       amount: 137.41,  currency: "USD" },
  { date: "2022-11-25", type: "Deposit", platform: "ING Funds RON", amount: 261.03,  currency: "RON" },
  { date: "2022-12-06", type: "Deposit", platform: "ING Funds RON", amount: 273,     currency: "RON" },
  { date: "2022-12-09", type: "Deposit", platform: "ING Funds RON", amount: 212,     currency: "RON" },
  { date: "2023-01-10", type: "Deposit", platform: "ING Funds RON", amount: 609,     currency: "RON" },
  { date: "2023-02-10", type: "Deposit", platform: "ING Funds RON", amount: 604.20,  currency: "RON" },
  { date: "2023-03-10", type: "Deposit", platform: "eToro",         amount: 600,     currency: "USD" },
  { date: "2023-04-10", type: "Deposit", platform: "ING Funds RON", amount: 530,     currency: "RON" },
  { date: "2023-05-10", type: "Deposit", platform: "ING Funds RON", amount: 530,     currency: "RON" },
  { date: "2023-06-10", type: "Deposit", platform: "eToro",         amount: 636.65,  currency: "USD" },
  { date: "2023-06-27", type: "Deposit", platform: "Tradeville",    amount: 1176,    currency: "RON" },
  { date: "2023-09-11", type: "Deposit", platform: "Tradeville",    amount: 525,     currency: "RON" },
  { date: "2023-10-10", type: "Deposit", platform: "eToro",         amount: 517.25,  currency: "USD" },
  { date: "2023-11-11", type: "Deposit", platform: "eToro",         amount: 522.70,  currency: "USD" },
  { date: "2023-12-08", type: "Deposit", platform: "eToro",         amount: 526.55,  currency: "USD" },
  { date: "2024-01-10", type: "Deposit", platform: "Tradeville",    amount: 525,     currency: "RON" },
  { date: "2024-03-13", type: "Deposit", platform: "Tradeville",    amount: 525,     currency: "RON" },
  { date: "2024-04-13", type: "Deposit", platform: "Tradeville",    amount: 539,     currency: "RON" },
  { date: "2024-05-10", type: "Deposit", platform: "ING Funds RON", amount: 1083,    currency: "RON" },
  { date: "2024-11-11", type: "Deposit", platform: "ING Funds RON", amount: 533,     currency: "RON" },
  { date: "2024-12-10", type: "Deposit", platform: "Tradeville",    amount: 1050,    currency: "RON" },
  { date: "2025-05-27", type: "Deposit", platform: "Fidelity",      amount: 10032,   currency: "USD" },
  { date: "2025-05-25", type: "Deposit", platform: "eToro",         amount: 5676,    currency: "USD" },
];

// ── Historical Snapshots (from Portfolio.xlsx → Portfolio tab) ────────────────
// One record per platform per date (flattened from the wide spreadsheet format).

const SNAPSHOTS = [
  // 2022-12-06
  { date: "2022-12-06", platform: "eToro",         amount: 1323,  currency: "USD" },
  { date: "2022-12-06", platform: "Binance",        amount: 141,   currency: "USD" },
  { date: "2022-12-06", platform: "ING Funds RON",  amount: 2573,  currency: "RON" },
  // 2023-01-10
  { date: "2023-01-10", platform: "eToro",         amount: 1342,  currency: "USD" },
  { date: "2023-01-10", platform: "Binance",        amount: 132,   currency: "USD" },
  { date: "2023-01-10", platform: "ING Funds RON",  amount: 6475,  currency: "RON" },
  // 2023-02-10
  { date: "2023-02-10", platform: "eToro",         amount: 1615,  currency: "USD" },
  { date: "2023-02-10", platform: "Binance",        amount: 164,   currency: "USD" },
  { date: "2023-02-10", platform: "ING Funds RON",  amount: 9400,  currency: "RON" },
  // 2023-03-10
  { date: "2023-03-10", platform: "eToro",         amount: 2087,  currency: "USD" },
  { date: "2023-03-10", platform: "Binance",        amount: 145,   currency: "USD" },
  { date: "2023-03-10", platform: "ING Funds RON",  amount: 9258,  currency: "RON" },
  // 2023-04-10
  { date: "2023-04-10", platform: "eToro",         amount: 2840,  currency: "USD" },
  { date: "2023-04-10", platform: "Binance",        amount: 188,   currency: "USD" },
  { date: "2023-04-10", platform: "ING Funds RON",  amount: 11718, currency: "RON" },
  // 2023-05-10
  { date: "2023-05-10", platform: "eToro",         amount: 2790,  currency: "USD" },
  { date: "2023-05-10", platform: "Binance",        amount: 176,   currency: "USD" },
  { date: "2023-05-10", platform: "ING Funds RON",  amount: 14193, currency: "RON" },
  // 2023-06-10
  { date: "2023-06-10", platform: "eToro",         amount: 3351,  currency: "USD" },
  { date: "2023-06-10", platform: "Binance",        amount: 156,   currency: "USD" },
  { date: "2023-06-10", platform: "ING Funds RON",  amount: 14491, currency: "RON" },
  // 2023-06-27
  { date: "2023-06-27", platform: "Tradeville",     amount: 1176,  currency: "RON" },
  // 2023-10-10
  { date: "2023-10-10", platform: "eToro",         amount: 3941,  currency: "USD" },
  { date: "2023-10-10", platform: "Binance",        amount: 154,   currency: "USD" },
  { date: "2023-10-10", platform: "Tradeville",     amount: 1823,  currency: "RON" },
  { date: "2023-10-10", platform: "ING Funds RON",  amount: 13872, currency: "RON" },
  // 2023-11-11
  { date: "2023-11-11", platform: "eToro",         amount: 5307,  currency: "USD" },
  { date: "2023-11-11", platform: "Binance",        amount: 216,   currency: "USD" },
  { date: "2023-11-11", platform: "Tradeville",     amount: 1858,  currency: "RON" },
  { date: "2023-11-11", platform: "ING Funds RON",  amount: 14045, currency: "RON" },
  // 2024-01-10
  { date: "2024-01-10", platform: "eToro",         amount: 6506,  currency: "USD" },
  { date: "2024-01-10", platform: "Binance",        amount: 0,     currency: "USD" },
  { date: "2024-01-10", platform: "Tradeville",     amount: 2729,  currency: "RON" },
  { date: "2024-01-10", platform: "ING Funds RON",  amount: 15093, currency: "RON" },
  // 2024-03-13
  { date: "2024-03-13", platform: "eToro",         amount: 7584,  currency: "USD" },
  { date: "2024-03-13", platform: "Tradeville",     amount: 3181,  currency: "RON" },
  { date: "2024-03-13", platform: "ING Funds RON",  amount: 16918, currency: "RON" },
  // 2024-04-11
  { date: "2024-04-11", platform: "eToro",         amount: 6100,  currency: "USD" },
  { date: "2024-04-11", platform: "Tradeville",     amount: 5225,  currency: "RON" },
  { date: "2024-04-11", platform: "ING Funds RON",  amount: 14761, currency: "RON" },
  { date: "2024-04-11", platform: "ING Funds EUR",  amount: 1981,  currency: "EUR" },
  // 2024-04-13
  { date: "2024-04-13", platform: "Tradeville",     amount: 3717,  currency: "RON" },
  // 2024-05-10
  { date: "2024-05-10", platform: "eToro",         amount: 6839,  currency: "USD" },
  { date: "2024-05-10", platform: "Tradeville",     amount: 3839,  currency: "RON" },
  { date: "2024-05-10", platform: "ING Funds RON",  amount: 22398, currency: "RON" },
  // 2024-11-11
  { date: "2024-11-11", platform: "eToro",         amount: 7428,  currency: "USD" },
  { date: "2024-11-11", platform: "Tradeville",     amount: 3926,  currency: "RON" },
  { date: "2024-11-11", platform: "ING Funds RON",  amount: 26490, currency: "RON" },
  // 2025-05-25
  { date: "2025-05-25", platform: "eToro",         amount: 13600, currency: "USD" },
  { date: "2025-05-25", platform: "Fidelity",       amount: 10222, currency: "USD" },
  { date: "2025-05-25", platform: "Tradeville",     amount: 5824,  currency: "RON" },
  { date: "2025-05-25", platform: "ING Funds RON",  amount: 16295, currency: "RON" },
  { date: "2025-05-25", platform: "ING Funds EUR",  amount: 2164,  currency: "EUR" },
  // 2025-05-27
  { date: "2025-05-27", platform: "eToro",         amount: 7582,  currency: "USD" },
  { date: "2025-05-27", platform: "Fidelity",       amount: 10032, currency: "USD" },
  { date: "2025-05-27", platform: "Tradeville",     amount: 5316,  currency: "RON" },
  { date: "2025-05-27", platform: "ING Funds RON",  amount: 15648, currency: "RON" },
  { date: "2025-05-27", platform: "ING Funds EUR",  amount: 2173,  currency: "EUR" },
  // 2025-09-15
  { date: "2025-09-15", platform: "eToro",         amount: 14547, currency: "USD" },
  { date: "2025-09-15", platform: "Fidelity",       amount: 9535,  currency: "USD" },
  { date: "2025-09-15", platform: "Tradeville",     amount: 6332,  currency: "RON" },
  { date: "2025-09-15", platform: "ING Funds RON",  amount: 17281, currency: "RON" },
  { date: "2025-09-15", platform: "ING Funds EUR",  amount: 2121,  currency: "EUR" },
  // 2025-12-25
  { date: "2025-12-25", platform: "eToro",         amount: 14516, currency: "USD" },
  { date: "2025-12-25", platform: "Fidelity",       amount: 10222, currency: "USD" },
  { date: "2025-12-25", platform: "Tradeville",     amount: 7047,  currency: "RON" },
  { date: "2025-12-25", platform: "ING Funds RON",  amount: 18997, currency: "RON" },
  { date: "2025-12-25", platform: "ING Funds EUR",  amount: 2103,  currency: "EUR" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function clearTable(table, pkField) {
  const { Items = [] } = await client.send(new ScanCommand({
    TableName: table,
    FilterExpression: "userId = :uid",
    ExpressionAttributeValues: { ":uid": USER_ID },
  }));
  for (const item of Items) {
    await client.send(new DeleteCommand({ TableName: table, Key: { [pkField]: item[pkField] } }));
  }
  console.log(`  Cleared ${Items.length} existing ${table} records`);
}

// ── Seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log(`Seeding investments for userId: ${USER_ID} (nenciulescu)\n`);

  console.log("Clearing existing data…");
  await clearTable(OPS_TABLE,  "operationId");
  await clearTable(SNAP_TABLE, "snapshotId");

  console.log(`\nInserting ${OPERATIONS.length} operations…`);
  for (const op of OPERATIONS) {
    await client.send(new PutCommand({
      TableName: OPS_TABLE,
      Item: { operationId: randomUUID(), userId: USER_ID, notes: "", ...op },
    }));
  }
  console.log(`  ✓ ${OPERATIONS.length} operations inserted`);

  console.log(`\nInserting ${SNAPSHOTS.length} portfolio snapshots…`);
  for (const snap of SNAPSHOTS) {
    await client.send(new PutCommand({
      TableName: SNAP_TABLE,
      Item: { snapshotId: randomUUID(), userId: USER_ID, ...snap },
    }));
  }
  console.log(`  ✓ ${SNAPSHOTS.length} snapshots inserted`);

  console.log("\n✅ Done — investment history seeded successfully.");
}

seed().catch(e => { console.error("❌", e.message); process.exit(1); });
