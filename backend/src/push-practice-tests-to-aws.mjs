/**
 * Push Practice Tests data from local DynamoDB → AWS.
 * Only touches: TestTemplates, TestResults, KidConfig.
 * Remaps userId "local-dev" → real Cognito userId.
 *
 * Usage:  node src/push-practice-tests-to-aws.mjs
 * Requires DynamoDB Local running on http://localhost:8000
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const localClient = DynamoDBDocumentClient.from(new DynamoDBClient({ endpoint: "http://localhost:8000", region: "eu-central-1" }));
const awsClient   = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-central-1" }));

const REAL_USER_ID = "e3c47852-9051-7092-9877-6b4e5186bc40"; // nenciulescu Cognito sub

const TABLES = {
  TestTemplates: "templateId",
  TestResults:   "resultId",
  KidConfig:     "userId",
};

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

async function clearAws(tableName, pk) {
  const items = await scanAll(awsClient, tableName);
  for (const item of items) {
    await awsClient.send(new DeleteCommand({ TableName: tableName, Key: { [pk]: item[pk] } }));
  }
  return items.length;
}

async function batchWrite(client, tableName, items) {
  for (let i = 0; i < items.length; i += 25) {
    const batch = items.slice(i, i + 25);
    await client.send(new BatchWriteCommand({
      RequestItems: {
        [tableName]: batch.map(item => ({ PutRequest: { Item: item } })),
      },
    }));
  }
}

async function push() {
  console.log(`Pushing Practice Tests local → AWS (remapping local-dev → ${REAL_USER_ID})\n`);

  for (const [table, pk] of Object.entries(TABLES)) {
    process.stdout.write(`  ${table}…`);

    // 1. Read from local
    let items = await scanAll(localClient, table);
    process.stdout.write(` read ${items.length} from local`);

    // 2. Remap userId
    items = items.map(item =>
      item.userId === "local-dev" ? { ...item, userId: REAL_USER_ID } : item
    );

    // 3. Wipe AWS table
    const cleared = await clearAws(table, pk);
    process.stdout.write(`, cleared ${cleared} from AWS`);

    // 4. Write to AWS
    if (items.length > 0) await batchWrite(awsClient, table, items);
    console.log(`, wrote ${items.length} ✓`);
  }

  console.log("\n✅ Done — Practice Tests data is now live on AWS.");
}

push().catch(e => { console.error("\n❌", e.message); process.exit(1); });
