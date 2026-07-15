/**
 * Copies HQ data from nenciulescu → Demo user in production AWS DynamoDB.
 *
 * Tables:
 *  - HQ_Locations:  new hqId per location
 *  - HQ_Templates:  new templateId, hqId remapped
 *  - HQ_Entries:    new entryId, hqId + templateId remapped
 *
 * nenciulescu's records are NEVER modified or deleted.
 *
 * Usage: node src/mirror-hq-to-demo.mjs
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-central-1" }));

const NENC_USER_ID = "e3c47852-9051-7092-9877-6b4e5186bc40";
const DEMO_USER_ID = "0304f8e2-b021-70bd-50b8-66cd986eac68";

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

async function run() {
  console.log("Mirroring HQ data: nenciulescu → demo in production AWS DynamoDB\n");

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
  const templateIdMap = new Map(); // oldTemplateId → newTemplateId
  {
    process.stdout.write("  HQ_Templates…");
    const source  = await scanAllForUser("HQ_Templates", NENC_USER_ID);
    const cleared = await deleteAllForUser("HQ_Templates", "templateId", DEMO_USER_ID);
    const copies  = source.map(r => {
      const newId = randomUUID();
      templateIdMap.set(r.templateId, newId);
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
      hqId:       hqIdMap.get(r.hqId)         ?? r.hqId,
      templateId: templateIdMap.get(r.templateId) ?? r.templateId,
    }));
    if (copies.length > 0) await batchWrite("HQ_Entries", copies);
    console.log(` cleared ${cleared}, wrote ${copies.length} ✓`);
  }

  console.log("\n✅ Done — HQ data mirrored to demo user.");
  console.log("   nenciulescu's records were not touched.");
}

run().catch(e => { console.error("\n❌", e.message); process.exit(1); });
