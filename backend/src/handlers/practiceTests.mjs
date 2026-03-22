import { randomUUID } from "crypto";
import { GetCommand, PutCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../lib/dynamo.mjs";

const TEMPLATES_TABLE = process.env.TEST_TEMPLATES_TABLE || "TestTemplates";
const RESULTS_TABLE   = process.env.TEST_RESULTS_TABLE   || "TestResults";
const KIDS_TABLE      = process.env.KID_CONFIG_TABLE     || "KidConfig";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

const ok  = (body, statusCode = 200) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });
const err = (statusCode, message)    => ({ statusCode, headers: CORS, body: JSON.stringify({ message }) });

function calcTotalScore(freePoints, topicScores) {
  const sum = (freePoints || 0) + (topicScores || []).reduce((s, t) => s + (t.points || 0), 0);
  return Math.round(sum / 10 * 10) / 10;
}

// ─── Templates ────────────────────────────────────────────────────────────────

async function listTemplates(userId) {
  const result = await docClient.send(new ScanCommand({
    TableName: TEMPLATES_TABLE,
    FilterExpression: "userId = :uid",
    ExpressionAttributeValues: { ":uid": userId },
  }));
  const items = (result.Items ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return ok(items);
}

async function getTemplate(templateId, userId) {
  const result = await docClient.send(new GetCommand({ TableName: TEMPLATES_TABLE, Key: { templateId } }));
  if (!result.Item || result.Item.userId !== userId) return err(404, "Not found");
  return ok(result.Item);
}

async function createTemplate(body, userId) {
  const { name, subject = "", freePoints = 0, topics = [] } = body;
  if (!name?.trim()) return err(400, "name is required");
  if (!Number.isInteger(freePoints) || freePoints < 0) return err(400, "freePoints must be a non-negative integer");
  if (!Array.isArray(topics) || topics.length > 30) return err(400, "topics must be an array of up to 30 items");
  if (topics.length === 0 && freePoints === 0) return err(400, "must have at least one topic or freePoints > 0");
  for (const t of topics) {
    if (!t.title?.trim()) return err(400, "each topic must have a title");
    if (!Number.isInteger(t.defaultPoints) || t.defaultPoints < 0) return err(400, "each topic defaultPoints must be a non-negative integer");
  }
  const now = new Date().toISOString();
  const item = {
    templateId: randomUUID(),
    userId,
    name: name.trim(),
    subject: subject.trim(),
    freePoints,
    topics: topics.map(t => ({ topicId: randomUUID(), title: t.title.trim(), defaultPoints: t.defaultPoints, group: (t.group || "").trim() })),
    createdAt: now,
    updatedAt: now,
  };
  await docClient.send(new PutCommand({ TableName: TEMPLATES_TABLE, Item: item }));
  return ok(item, 201);
}

async function updateTemplate(templateId, body, userId) {
  const existing = await docClient.send(new GetCommand({ TableName: TEMPLATES_TABLE, Key: { templateId } }));
  if (!existing.Item || existing.Item.userId !== userId) return err(404, "Not found");
  const { name, subject = "", freePoints = 0, topics = [] } = body;
  if (!name?.trim()) return err(400, "name is required");
  if (!Number.isInteger(freePoints) || freePoints < 0) return err(400, "freePoints must be a non-negative integer");
  if (!Array.isArray(topics) || topics.length > 30) return err(400, "topics must be an array of up to 30 items");
  if (topics.length === 0 && freePoints === 0) return err(400, "must have at least one topic or freePoints > 0");
  const updated = {
    ...existing.Item,
    name: name.trim(),
    subject: subject.trim(),
    freePoints,
    topics: topics.map(t => ({ topicId: t.topicId || randomUUID(), title: t.title.trim(), defaultPoints: t.defaultPoints, group: (t.group || "").trim() })),
    updatedAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TEMPLATES_TABLE, Item: updated }));
  return ok(updated);
}

async function deleteTemplate(templateId, userId) {
  const result = await docClient.send(new GetCommand({ TableName: TEMPLATES_TABLE, Key: { templateId } }));
  if (!result.Item || result.Item.userId !== userId) return err(404, "Not found");
  await docClient.send(new DeleteCommand({ TableName: TEMPLATES_TABLE, Key: { templateId } }));
  return ok({ deleted: true });
}

// ─── Results ──────────────────────────────────────────────────────────────────

async function listResults(userId, query) {
  const { templateId, kidName, from, to } = query || {};
  let FilterExpression = "userId = :uid";
  const ExpressionAttributeValues = { ":uid": userId };
  const ExpressionAttributeNames = {};

  if (templateId) { FilterExpression += " AND templateId = :tid"; ExpressionAttributeValues[":tid"] = templateId; }
  if (kidName)    { FilterExpression += " AND kidName = :kid";    ExpressionAttributeValues[":kid"] = kidName; }
  if (from || to) { ExpressionAttributeNames["#d"] = "date"; }
  if (from)       { FilterExpression += " AND #d >= :from";        ExpressionAttributeValues[":from"] = from; }
  if (to)         { FilterExpression += " AND #d <= :to";          ExpressionAttributeValues[":to"] = to; }

  const result = await docClient.send(new ScanCommand({
    TableName: RESULTS_TABLE,
    FilterExpression,
    ExpressionAttributeValues,
    ...(Object.keys(ExpressionAttributeNames).length ? { ExpressionAttributeNames } : {}),
  }));
  const items = (result.Items ?? []).sort((a, b) => {
    const d = b.date.localeCompare(a.date);
    return d !== 0 ? d : b.createdAt.localeCompare(a.createdAt);
  });
  return ok(items);
}

async function getResult(resultId, userId) {
  const result = await docClient.send(new GetCommand({ TableName: RESULTS_TABLE, Key: { resultId } }));
  if (!result.Item || result.Item.userId !== userId) return err(404, "Not found");
  return ok(result.Item);
}

async function createResult(body, userId) {
  const { templateId, kidName, date, sourceTitle = "", freePoints = 0, topicScores = [], verified = false, totalScore: totalScoreOverride } = body;
  if (!templateId)                              return err(400, "templateId is required");
  if (!kidName?.trim())                         return err(400, "kidName is required");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return err(400, "date must be YYYY-MM-DD");

  const tpl = await docClient.send(new GetCommand({ TableName: TEMPLATES_TABLE, Key: { templateId } }));
  if (!tpl.Item || tpl.Item.userId !== userId)  return err(400, "template not found");
  if (topicScores.length !== tpl.Item.topics.length) return err(400, "topicScores length must match template topics");

  const now = new Date().toISOString();
  const item = {
    resultId: randomUUID(),
    userId,
    templateId,
    templateName: tpl.Item.name,
    kidName: kidName.trim(),
    date,
    sourceTitle: sourceTitle.trim(),
    freePoints,
    topicScores: topicScores.map(t => ({ topicId: t.topicId, title: t.title, points: Number(t.points) || 0 })),
    totalScore: totalScoreOverride !== undefined ? Number(totalScoreOverride) : calcTotalScore(freePoints, topicScores),
    verified: Boolean(verified),
    createdAt: now,
    updatedAt: now,
  };
  await docClient.send(new PutCommand({ TableName: RESULTS_TABLE, Item: item }));
  return ok(item, 201);
}

async function updateResult(resultId, body, userId) {
  const existing = await docClient.send(new GetCommand({ TableName: RESULTS_TABLE, Key: { resultId } }));
  if (!existing.Item || existing.Item.userId !== userId) return err(404, "Not found");
  const updated = { ...existing.Item };
  if (body.kidName    !== undefined) updated.kidName    = body.kidName.trim();
  if (body.date       !== undefined) updated.date       = body.date;
  if (body.sourceTitle!== undefined) updated.sourceTitle= body.sourceTitle.trim();
  if (body.freePoints !== undefined) updated.freePoints = Number(body.freePoints);
  if (body.topicScores!== undefined) updated.topicScores= body.topicScores.map(t => ({ topicId: t.topicId, title: t.title, points: Number(t.points) || 0 }));
  if (body.verified   !== undefined) updated.verified   = Boolean(body.verified);
  updated.totalScore = body.totalScore !== undefined ? Number(body.totalScore) : calcTotalScore(updated.freePoints, updated.topicScores);
  updated.updatedAt  = new Date().toISOString();
  await docClient.send(new PutCommand({ TableName: RESULTS_TABLE, Item: updated }));
  return ok(updated);
}

async function deleteResult(resultId, userId) {
  const result = await docClient.send(new GetCommand({ TableName: RESULTS_TABLE, Key: { resultId } }));
  if (!result.Item || result.Item.userId !== userId) return err(404, "Not found");
  await docClient.send(new DeleteCommand({ TableName: RESULTS_TABLE, Key: { resultId } }));
  return ok({ deleted: true });
}

// ─── Kids ─────────────────────────────────────────────────────────────────────

async function getKids(userId) {
  const result = await docClient.send(new GetCommand({ TableName: KIDS_TABLE, Key: { userId } }));
  return ok({ kids: result.Item?.kids ?? [] });
}

async function putKids(body, userId) {
  const { kids = [] } = body;
  if (!Array.isArray(kids))  return err(400, "kids must be an array");
  if (kids.length > 20)      return err(400, "maximum 20 kids");
  const names = kids.map(k => (k.name ?? "").toLowerCase().trim());
  if (new Set(names).size !== names.length) return err(400, "kid names must be unique");
  const item = {
    userId,
    kids: kids.map((k, i) => ({ kidId: k.kidId || randomUUID(), name: k.name.trim(), order: k.order ?? i })),
  };
  await docClient.send(new PutCommand({ TableName: KIDS_TABLE, Item: item }));
  return ok(item);
}

// ─── Router ──────────────────────────────────────────────────────────────────

export async function handler(event) {
  const userId     = event.requestContext?.authorizer?.claims?.sub ?? "local-dev";
  const method     = event.httpMethod;
  const path       = event.path || "";
  const params     = event.pathParameters || {};
  const query      = event.queryStringParameters || {};

  try {
    if (path.includes("/templates")) {
      const { templateId } = params;
      if (method === "GET"    && !templateId) return await listTemplates(userId);
      if (method === "POST")                  return await createTemplate(JSON.parse(event.body || "{}"), userId);
      if (method === "GET"    && templateId)  return await getTemplate(templateId, userId);
      if (method === "PUT"    && templateId)  return await updateTemplate(templateId, JSON.parse(event.body || "{}"), userId);
      if (method === "DELETE" && templateId)  return await deleteTemplate(templateId, userId);
    }
    if (path.includes("/results")) {
      const { resultId } = params;
      if (method === "GET"    && !resultId) return await listResults(userId, query);
      if (method === "POST")                return await createResult(JSON.parse(event.body || "{}"), userId);
      if (method === "GET"    && resultId)  return await getResult(resultId, userId);
      if (method === "PUT"    && resultId)  return await updateResult(resultId, JSON.parse(event.body || "{}"), userId);
      if (method === "DELETE" && resultId)  return await deleteResult(resultId, userId);
    }
    if (path.includes("/kids")) {
      if (method === "GET") return await getKids(userId);
      if (method === "PUT") return await putKids(JSON.parse(event.body || "{}"), userId);
    }
    return err(404, "Not found");
  } catch (e) {
    console.error(e);
    return err(500, "Internal server error");
  }
}
