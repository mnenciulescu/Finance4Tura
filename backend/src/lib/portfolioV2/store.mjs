// Portfolio v2 — DynamoDB access. Every table has a `userId-index` GSI.
import { BatchWriteCommand, DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../dynamo.mjs";

export const TABLES = {
  assets: process.env.PV2_ASSETS_TABLE || "PortfolioV2_Assets",
  snapshots: process.env.PV2_SNAPSHOTS_TABLE || "PortfolioV2_Snapshots",
  runs: process.env.PV2_RUNS_TABLE || "PortfolioV2_Runs",
};
const KEY = { assets: "assetId", snapshots: "snapshotId", runs: "runId" };

async function queryByUser(table, userId) {
  const out = [];
  let ExclusiveStartKey;
  do {
    const res = await docClient.send(new QueryCommand({
      TableName: TABLES[table],
      IndexName: "userId-index",
      KeyConditionExpression: "userId = :u",
      ExpressionAttributeValues: { ":u": userId },
      ExclusiveStartKey,
    }));
    out.push(...(res.Items ?? []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return out;
}

async function getOwned(table, id, userId) {
  const res = await docClient.send(new GetCommand({ TableName: TABLES[table], Key: { [KEY[table]]: id }, ConsistentRead: true }));
  return res.Item && res.Item.userId === userId ? res.Item : null;
}

const put = (table, item) => docClient.send(new PutCommand({ TableName: TABLES[table], Item: item }));

async function deleteMany(table, ids) {
  for (let i = 0; i < ids.length; i += 25) {
    const chunk = ids.slice(i, i + 25).map(id => ({ DeleteRequest: { Key: { [KEY[table]]: id } } }));
    let req = { [TABLES[table]]: chunk };
    for (let attempt = 0; attempt < 5 && req && Object.keys(req).length; attempt++) {
      const res = await docClient.send(new BatchWriteCommand({ RequestItems: req }));
      req = res.UnprocessedItems;
    }
  }
}

export const listAssets = (userId) => queryByUser("assets", userId);
export const getAsset = (id, userId) => getOwned("assets", id, userId);
export const putAsset = (item) => put("assets", item);
export const deleteAsset = (id) => docClient.send(new DeleteCommand({ TableName: TABLES.assets, Key: { assetId: id } }));

export const listSnapshots = (userId) => queryByUser("snapshots", userId);
export const putSnapshot = (item) => put("snapshots", item);
export const deleteSnapshots = (ids) => deleteMany("snapshots", ids);

export const listRuns = (userId) => queryByUser("runs", userId);
export const getRun = (id, userId) => getOwned("runs", id, userId);
export const putRun = (item) => put("runs", item);

/** Deletes every Portfolio v2 record of a user (Admin → Delete user). */
export async function deleteUserData(userId) {
  const [assets, snapshots, runs] = await Promise.all([listAssets(userId), listSnapshots(userId), listRuns(userId)]);
  await deleteMany("assets", assets.map(a => a.assetId));
  await deleteMany("snapshots", snapshots.map(s => s.snapshotId));
  await deleteMany("runs", runs.map(r => r.runId));
  return { assets: assets.length, snapshots: snapshots.length, runs: runs.length };
}

/** Sets fields on one run item (by list index) without touching the others. */
export async function updateRunItem(runId, index, fields) {
  const names = { "#items": "items" };
  const values = {};
  const sets = [];
  Object.entries(fields).forEach(([k, v], i) => {
    names[`#f${i}`] = k;
    values[`:v${i}`] = v ?? null;
    sets.push(`#items[${index}].#f${i} = :v${i}`);
  });
  await docClient.send(new UpdateCommand({
    TableName: TABLES.runs,
    Key: { runId },
    UpdateExpression: `SET ${sets.join(", ")}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
}

/** Adds token / search usage and counts one asset as done; returns what is left. */
export async function completeRunItem(runId, usage = {}) {
  const res = await docClient.send(new UpdateCommand({
    TableName: TABLES.runs,
    Key: { runId },
    UpdateExpression: "ADD remaining :minus, #u.inputTokens :i, #u.cacheReadTokens :cr, #u.cacheWriteTokens :cw, #u.outputTokens :o, #u.webSearches :w",
    ExpressionAttributeNames: { "#u": "usage" },
    ExpressionAttributeValues: {
      ":minus": -1,
      ":i": usage.inputTokens ?? 0,
      ":cr": usage.cacheReadTokens ?? 0,
      ":cw": usage.cacheWriteTokens ?? 0,
      ":o": usage.outputTokens ?? 0,
      ":w": usage.webSearches ?? 0,
    },
    ReturnValues: "UPDATED_NEW",
  }));
  return res.Attributes?.remaining ?? 0;
}

/** Marks the run as finalising once; false when another worker already did. */
export async function claimFinalize(runId, token) {
  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLES.runs,
      Key: { runId },
      UpdateExpression: "SET finalizeToken = :t",
      ConditionExpression: "attribute_not_exists(finalizeToken) OR finalizeToken <> :t",
      ExpressionAttributeValues: { ":t": token },
    }));
    return true;
  } catch (e) {
    if (e?.name === "ConditionalCheckFailedException") return false;
    throw e;
  }
}

export async function setRunFields(runId, fields, remove = []) {
  const names = {};
  const values = {};
  const sets = Object.entries(fields).map(([k, v], i) => {
    names[`#s${i}`] = k;
    values[`:s${i}`] = v ?? null;
    return `#s${i} = :s${i}`;
  });
  const removes = remove.map((k, i) => { names[`#r${i}`] = k; return `#r${i}`; });
  const expr = [sets.length ? `SET ${sets.join(", ")}` : "", removes.length ? `REMOVE ${removes.join(", ")}` : ""].filter(Boolean).join(" ");
  await docClient.send(new UpdateCommand({
    TableName: TABLES.runs,
    Key: { runId },
    UpdateExpression: expr,
    ExpressionAttributeNames: names,
    ...(Object.keys(values).length ? { ExpressionAttributeValues: values } : {}),
  }));
}
