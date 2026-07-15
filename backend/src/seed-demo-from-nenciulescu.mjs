/**
 * Mirrors nenciulescu's data to the Demo user in production AWS DynamoDB.
 *
 * Rules:
 *  - Incomes:              amount → 5000, currency → RON
 *  - Expenses:             amount *= (1 ± random 0–10%)
 *  - InvestmentOperations: amount *= (1 ± random 0–20%)
 *  - PortfolioSnapshots:   amount *= (1 ± random 0–20%)
 *  - SplitPayments:        copied as-is (amounts unchanged)
 *  - TestTemplates:        copied as-is (new templateIds; used to remap TestResults)
 *  - TestResults:          copied as-is (new resultIds; templateId remapped)
 *  - KidConfig:            copied as-is (single item keyed by userId)
 *  - Books_and_Dev:        copied as-is (new bookIds)
 *  - HQ_Locations:         copied as-is (new hqIds)
 *  - HQ_Templates:         copied as-is (new templateIds; hqId remapped)
 *  - HQ_Entries:           copied as-is (new entryIds; hqId + templateId remapped)
 *
 * ⚠️  Writes to PRODUCTION AWS DynamoDB.
 *     nenciulescu's records are NEVER modified or deleted.
 *     Only the demo user's records are cleared and replaced.
 *
 * Usage: node src/seed-demo-from-nenciulescu.mjs
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand, DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-central-1" }));

const NENC_USER_ID = "e3c47852-9051-7092-9877-6b4e5186bc40";
const DEMO_USER_ID = "0304f8e2-b021-70bd-50b8-66cd986eac68";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns 1 ± up to pct% (e.g. pct=10 → [0.90, 1.10]) */
function randomFactor(pct) {
  const sign  = Math.random() < 0.5 ? -1 : 1;
  const delta = Math.random() * (pct / 100);
  return 1 + sign * delta;
}

function roundTwo(n) {
  return Math.round(n * 100) / 100;
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

async function deleteAllForUser(tableName, pk, userId) {
  const items = await scanAllForUser(tableName, userId);
  for (const item of items) {
    await client.send(new DeleteCommand({ TableName: tableName, Key: { [pk]: item[pk] } }));
  }
  return items.length;
}

async function batchWrite(tableName, items) {
  for (let i = 0; i < items.length; i += 25) {
    const batch = items.slice(i, i + 25);
    await client.send(new BatchWriteCommand({
      RequestItems: {
        [tableName]: batch.map(item => ({ PutRequest: { Item: item } })),
      },
    }));
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log("Mirroring nenciulescu → demo in production AWS DynamoDB\n");
  console.log(`  Source userId: ${NENC_USER_ID}`);
  console.log(`  Target userId: ${DEMO_USER_ID}\n`);

  // ── Incomes ────────────────────────────────────────────────────────────────
  // Build old→new incomeId map so expenses can remap their mappedIncomeId.
  const incomeIdMap = new Map(); // oldIncomeId → newIncomeId
  {
    process.stdout.write("  Incomes…");
    const source  = await scanAllForUser("Incomes", NENC_USER_ID);
    const cleared = await deleteAllForUser("Incomes", "incomeId", DEMO_USER_ID);
    const copies  = source.map(r => {
      const newId = randomUUID();
      incomeIdMap.set(r.incomeId, newId);
      return {
        ...r,
        incomeId: newId,
        userId:   DEMO_USER_ID,
        amount:   5000,
        currency: "RON",
      };
    });
    if (copies.length > 0) await batchWrite("Incomes", copies);
    console.log(` cleared ${cleared}, wrote ${copies.length} (all amounts → 5000 RON) ✓`);
  }

  // ── Expenses ───────────────────────────────────────────────────────────────
  {
    process.stdout.write("  Expenses…");
    const source  = await scanAllForUser("Expenses", NENC_USER_ID);
    const cleared = await deleteAllForUser("Expenses", "expenseId", DEMO_USER_ID);
    const copies  = source.map(r => ({
      ...r,
      expenseId:     randomUUID(),
      userId:        DEMO_USER_ID,
      amount:        roundTwo(Number(r.amount) * randomFactor(10)),
      // Remap mappedIncomeId to the new demo income ID; keep the field if no match
      mappedIncomeId: r.mappedIncomeId
        ? (incomeIdMap.get(r.mappedIncomeId) ?? r.mappedIncomeId)
        : r.mappedIncomeId,
    }));
    if (copies.length > 0) await batchWrite("Expenses", copies);
    console.log(` cleared ${cleared}, wrote ${copies.length} (amounts ±10%, mappedIncomeId remapped) ✓`);
  }

  // ── Investment Operations ──────────────────────────────────────────────────
  {
    process.stdout.write("  InvestmentOperations…");
    const source  = await scanAllForUser("InvestmentOperations", NENC_USER_ID);
    const cleared = await deleteAllForUser("InvestmentOperations", "operationId", DEMO_USER_ID);
    const copies  = source.map(r => ({
      ...r,
      operationId: randomUUID(),
      userId:      DEMO_USER_ID,
      amount:      roundTwo(Number(r.amount) * randomFactor(20)),
    }));
    if (copies.length > 0) await batchWrite("InvestmentOperations", copies);
    console.log(` cleared ${cleared}, wrote ${copies.length} (amounts ±20%) ✓`);
  }

  // ── Portfolio Snapshots ────────────────────────────────────────────────────
  {
    process.stdout.write("  PortfolioSnapshots…");
    const source  = await scanAllForUser("PortfolioSnapshots", NENC_USER_ID);
    const cleared = await deleteAllForUser("PortfolioSnapshots", "snapshotId", DEMO_USER_ID);
    const copies  = source.map(r => ({
      ...r,
      snapshotId: randomUUID(),
      userId:     DEMO_USER_ID,
      amount:     roundTwo(Number(r.amount) * randomFactor(20)),
    }));
    if (copies.length > 0) await batchWrite("PortfolioSnapshots", copies);
    console.log(` cleared ${cleared}, wrote ${copies.length} (amounts ±20%) ✓`);
  }

  // ── Split Payments ─────────────────────────────────────────────────────────
  {
    process.stdout.write("  SplitPayments…");
    const source  = await scanAllForUser("SplitPayments", NENC_USER_ID);
    const cleared = await deleteAllForUser("SplitPayments", "splitPaymentId", DEMO_USER_ID);
    const copies  = source.map(r => ({
      ...r,
      splitPaymentId: randomUUID(),
      userId:         DEMO_USER_ID,
    }));
    if (copies.length > 0) await batchWrite("SplitPayments", copies);
    console.log(` cleared ${cleared}, wrote ${copies.length} ✓`);
  }

  // ── Practice Tests: Templates ──────────────────────────────────────────────
  // Build old→new templateId map so TestResults can remap their templateId.
  const templateIdMap = new Map(); // oldTemplateId → newTemplateId
  {
    process.stdout.write("  TestTemplates…");
    const source  = await scanAllForUser("TestTemplates", NENC_USER_ID);
    const cleared = await deleteAllForUser("TestTemplates", "templateId", DEMO_USER_ID);
    const copies  = source.map(r => {
      const newId = randomUUID();
      templateIdMap.set(r.templateId, newId);
      return { ...r, templateId: newId, userId: DEMO_USER_ID };
    });
    if (copies.length > 0) await batchWrite("TestTemplates", copies);
    console.log(` cleared ${cleared}, wrote ${copies.length} ✓`);
  }

  // ── Practice Tests: Results ────────────────────────────────────────────────
  {
    process.stdout.write("  TestResults…");
    const source  = await scanAllForUser("TestResults", NENC_USER_ID);
    const cleared = await deleteAllForUser("TestResults", "resultId", DEMO_USER_ID);
    const copies  = source.map(r => ({
      ...r,
      resultId:   randomUUID(),
      userId:     DEMO_USER_ID,
      templateId: templateIdMap.get(r.templateId) ?? r.templateId,
    }));
    if (copies.length > 0) await batchWrite("TestResults", copies);
    console.log(` cleared ${cleared}, wrote ${copies.length} (templateId remapped) ✓`);
  }

  // ── KidConfig ──────────────────────────────────────────────────────────────
  // Single item keyed by userId — no userId scan needed; just get + put.
  {
    process.stdout.write("  KidConfig…");
    const res = await client.send(new GetCommand({ TableName: "KidConfig", Key: { userId: NENC_USER_ID } }));
    if (res.Item) {
      await client.send(new PutCommand({
        TableName: "KidConfig",
        Item: { ...res.Item, userId: DEMO_USER_ID },
      }));
      console.log(` wrote 1 (${res.Item.kids?.length ?? 0} kids) ✓`);
    } else {
      console.log(" source not found, skipped");
    }
  }

  // ── Books & Development ────────────────────────────────────────────────────
  {
    process.stdout.write("  Books_and_Dev…");
    const source  = await scanAllForUser("Books_and_Dev", NENC_USER_ID);
    const cleared = await deleteAllForUser("Books_and_Dev", "bookId", DEMO_USER_ID);
    const copies  = source.map(r => ({ ...r, bookId: randomUUID(), userId: DEMO_USER_ID }));
    if (copies.length > 0) await batchWrite("Books_and_Dev", copies);
    console.log(` cleared ${cleared}, wrote ${copies.length} ✓`);
  }

  // ── HQ_Locations ───────────────────────────────────────────────────────────
  const hqIdMap = new Map(); // oldHqId → newHqId
  {
    process.stdout.write("  HQ_Locations…");
    const source  = await scanAllForUser("HQ_Locations", NENC_USER_ID);
    const cleared = await deleteAllForUser("HQ_Locations", "hqId", DEMO_USER_ID);
    const copies  = source.map(r => {
      const newId = randomUUID();
      hqIdMap.set(r.hqId, newId);
      return { ...r, hqId: newId, userId: DEMO_USER_ID };
    });
    if (copies.length > 0) await batchWrite("HQ_Locations", copies);
    console.log(` cleared ${cleared}, wrote ${copies.length} ✓`);
  }

  // ── HQ_Templates ───────────────────────────────────────────────────────────
  const hqTemplateIdMap = new Map(); // oldTemplateId → newTemplateId
  {
    process.stdout.write("  HQ_Templates…");
    const source  = await scanAllForUser("HQ_Templates", NENC_USER_ID);
    const cleared = await deleteAllForUser("HQ_Templates", "templateId", DEMO_USER_ID);
    const copies  = source.map(r => {
      const newId = randomUUID();
      hqTemplateIdMap.set(r.templateId, newId);
      return {
        ...r,
        templateId: newId,
        userId:     DEMO_USER_ID,
        hqId:       hqIdMap.get(r.hqId) ?? r.hqId,
      };
    });
    if (copies.length > 0) await batchWrite("HQ_Templates", copies);
    console.log(` cleared ${cleared}, wrote ${copies.length} ✓`);
  }

  // ── HQ_Entries ─────────────────────────────────────────────────────────────
  {
    process.stdout.write("  HQ_Entries…");
    const source  = await scanAllForUser("HQ_Entries", NENC_USER_ID);
    const cleared = await deleteAllForUser("HQ_Entries", "entryId", DEMO_USER_ID);
    const copies  = source.map(r => ({
      ...r,
      entryId:    randomUUID(),
      userId:     DEMO_USER_ID,
      hqId:       hqIdMap.get(r.hqId)                ?? r.hqId,
      templateId: hqTemplateIdMap.get(r.templateId)  ?? r.templateId,
    }));
    if (copies.length > 0) await batchWrite("HQ_Entries", copies);
    console.log(` cleared ${cleared}, wrote ${copies.length} ✓`);
  }

  console.log("\n✅ Done — demo user now has a modified mirror of nenciulescu's data.");
  console.log("   nenciulescu's records were not touched.");
}

run().catch(e => { console.error("\n❌", e.message); process.exit(1); });
