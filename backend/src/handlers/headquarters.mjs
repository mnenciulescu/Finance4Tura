import { randomUUID } from "crypto";
import { GetCommand, PutCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../lib/dynamo.mjs";

const LOCATIONS_TABLE  = process.env.HQ_LOCATIONS_TABLE  || "HQ_Locations";
const TEMPLATES_TABLE  = process.env.HQ_TEMPLATES_TABLE  || "HQ_Templates";
const ENTRIES_TABLE    = process.env.HQ_ENTRIES_TABLE    || "HQ_Entries";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Cache-Control": "no-store",
};

const ok  = (body, statusCode = 200) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });
const err = (statusCode, message)    => ({ statusCode, headers: CORS, body: JSON.stringify({ message }) });

// ─── Locations ────────────────────────────────────────────────────────────────

async function listLocations(userId) {
  const result = await docClient.send(new ScanCommand({
    TableName: LOCATIONS_TABLE,
    FilterExpression: "userId = :uid",
    ExpressionAttributeValues: { ":uid": userId },
  }));
  const items = (result.Items ?? []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return ok(items);
}

async function createLocation(body, userId) {
  const { name, address = "", order = 0 } = body;
  if (!name?.trim()) return err(400, "name is required");
  const now = new Date().toISOString();
  const item = {
    hqId: randomUUID(),
    userId,
    name: name.trim(),
    address: address.trim(),
    order: Number(order) || 0,
    createdAt: now,
  };
  await docClient.send(new PutCommand({ TableName: LOCATIONS_TABLE, Item: item }));
  return ok(item, 201);
}

async function updateLocation(hqId, body, userId) {
  const existing = await docClient.send(new GetCommand({ TableName: LOCATIONS_TABLE, Key: { hqId } }));
  if (!existing.Item || existing.Item.userId !== userId) return err(404, "Not found");
  const updated = {
    ...existing.Item,
    ...(body.name    !== undefined ? { name:    body.name.trim()    } : {}),
    ...(body.address !== undefined ? { address: body.address.trim() } : {}),
    ...(body.order   !== undefined ? { order:   Number(body.order)  } : {}),
  };
  await docClient.send(new PutCommand({ TableName: LOCATIONS_TABLE, Item: updated }));
  return ok(updated);
}

async function deleteLocation(hqId, userId) {
  const existing = await docClient.send(new GetCommand({ TableName: LOCATIONS_TABLE, Key: { hqId } }));
  if (!existing.Item || existing.Item.userId !== userId) return err(404, "Not found");
  // Block delete if templates exist for this location
  const tmpl = await docClient.send(new ScanCommand({
    TableName: TEMPLATES_TABLE,
    FilterExpression: "userId = :uid AND hqId = :hid",
    ExpressionAttributeValues: { ":uid": userId, ":hid": hqId },
  }));
  if ((tmpl.Items ?? []).length > 0) return err(400, "Cannot delete location that has templates. Delete templates first.");
  await docClient.send(new DeleteCommand({ TableName: LOCATIONS_TABLE, Key: { hqId } }));
  return ok({ deleted: true });
}

// ─── Templates ────────────────────────────────────────────────────────────────

async function listHQTemplates(userId, query) {
  const { hqId } = query || {};
  let FilterExpression = "userId = :uid";
  const ExpressionAttributeValues = { ":uid": userId };
  if (hqId) { FilterExpression += " AND hqId = :hid"; ExpressionAttributeValues[":hid"] = hqId; }
  const result = await docClient.send(new ScanCommand({
    TableName: TEMPLATES_TABLE,
    FilterExpression,
    ExpressionAttributeValues,
  }));
  const items = (result.Items ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return ok(items);
}

async function createHQTemplate(body, userId) {
  const { hqId, name, parameters = [] } = body;
  if (!hqId)        return err(400, "hqId is required");
  if (!name?.trim()) return err(400, "name is required");
  if (!Array.isArray(parameters) || parameters.length === 0)  return err(400, "at least 1 parameter required");
  if (parameters.length > 30) return err(400, "maximum 30 parameters allowed");

  // Verify hqId belongs to userId
  const loc = await docClient.send(new GetCommand({ TableName: LOCATIONS_TABLE, Key: { hqId } }));
  if (!loc.Item || loc.Item.userId !== userId) return err(400, "location not found");

  for (const p of parameters) {
    if (!p.title?.trim()) return err(400, "each parameter must have a title");
    if (!["number", "text", "boolean"].includes(p.type)) return err(400, "parameter type must be number, text, or boolean");
  }

  const now = new Date().toISOString();
  const item = {
    templateId: randomUUID(),
    userId,
    hqId,
    name: name.trim(),
    parameters: parameters.map((p, i) => ({
      parameterId: p.parameterId || randomUUID(),
      title: p.title.trim(),
      type: p.type,
      unit: (p.unit || "").trim(),
      order: p.order ?? i,
    })),
    createdAt: now,
    updatedAt: now,
  };
  await docClient.send(new PutCommand({ TableName: TEMPLATES_TABLE, Item: item }));
  return ok(item, 201);
}

async function updateHQTemplate(templateId, body, userId) {
  const existing = await docClient.send(new GetCommand({ TableName: TEMPLATES_TABLE, Key: { templateId } }));
  if (!existing.Item || existing.Item.userId !== userId) return err(404, "Not found");

  const { name, parameters } = body;
  if (name !== undefined && !name?.trim()) return err(400, "name is required");
  if (parameters !== undefined) {
    if (!Array.isArray(parameters) || parameters.length === 0) return err(400, "at least 1 parameter required");
    if (parameters.length > 30) return err(400, "maximum 30 parameters allowed");
    for (const p of parameters) {
      if (!p.title?.trim()) return err(400, "each parameter must have a title");
      if (!["number", "text", "boolean"].includes(p.type)) return err(400, "parameter type must be number, text, or boolean");
    }
  }

  const updated = {
    ...existing.Item,
    ...(name       !== undefined ? { name: name.trim() } : {}),
    ...(parameters !== undefined ? {
      parameters: parameters.map((p, i) => ({
        parameterId: p.parameterId || randomUUID(),
        title: p.title.trim(),
        type: p.type,
        unit: (p.unit || "").trim(),
        order: p.order ?? i,
      }))
    } : {}),
    updatedAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TEMPLATES_TABLE, Item: updated }));
  return ok(updated);
}

async function deleteHQTemplate(templateId, userId) {
  const existing = await docClient.send(new GetCommand({ TableName: TEMPLATES_TABLE, Key: { templateId } }));
  if (!existing.Item || existing.Item.userId !== userId) return err(404, "Not found");
  await docClient.send(new DeleteCommand({ TableName: TEMPLATES_TABLE, Key: { templateId } }));
  return ok({ deleted: true });
}

// ─── Entries ──────────────────────────────────────────────────────────────────

async function listEntries(userId, query) {
  const { templateId, hqId, from, to } = query || {};
  let FilterExpression = "userId = :uid";
  const ExpressionAttributeValues = { ":uid": userId };
  const ExpressionAttributeNames = {};

  if (templateId) { FilterExpression += " AND templateId = :tid"; ExpressionAttributeValues[":tid"] = templateId; }
  if (hqId)       { FilterExpression += " AND hqId = :hid";       ExpressionAttributeValues[":hid"] = hqId; }
  if (from || to) { ExpressionAttributeNames["#d"] = "date"; }
  if (from)       { FilterExpression += " AND #d >= :from";        ExpressionAttributeValues[":from"] = from; }
  if (to)         { FilterExpression += " AND #d <= :to";          ExpressionAttributeValues[":to"] = to; }

  const result = await docClient.send(new ScanCommand({
    TableName: ENTRIES_TABLE,
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

async function createEntry(body, userId) {
  const { templateId, hqId, date, values = [], notes = "" } = body;
  if (!templateId)                                  return err(400, "templateId is required");
  if (!hqId)                                        return err(400, "hqId is required");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return err(400, "date must be YYYY-MM-DD");

  // Verify template belongs to userId
  const tpl = await docClient.send(new GetCommand({ TableName: TEMPLATES_TABLE, Key: { templateId } }));
  if (!tpl.Item || tpl.Item.userId !== userId) return err(400, "template not found");

  // Verify hqId belongs to userId
  const loc = await docClient.send(new GetCommand({ TableName: LOCATIONS_TABLE, Key: { hqId } }));
  if (!loc.Item || loc.Item.userId !== userId) return err(400, "location not found");

  const now = new Date().toISOString();
  const item = {
    entryId: randomUUID(),
    userId,
    templateId,
    hqId,
    date,
    values: (values || []).map(v => ({
      parameterId: v.parameterId,
      title: v.title || "",
      value: v.value ?? null,
    })),
    notes: (notes || "").trim(),
    createdAt: now,
    updatedAt: now,
  };
  await docClient.send(new PutCommand({ TableName: ENTRIES_TABLE, Item: item }));
  return ok(item, 201);
}

async function updateEntry(entryId, body, userId) {
  const existing = await docClient.send(new GetCommand({ TableName: ENTRIES_TABLE, Key: { entryId } }));
  if (!existing.Item || existing.Item.userId !== userId) return err(404, "Not found");

  const updated = { ...existing.Item };
  if (body.date   !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return err(400, "date must be YYYY-MM-DD");
    updated.date = body.date;
  }
  if (body.values !== undefined) {
    updated.values = body.values.map(v => ({
      parameterId: v.parameterId,
      title: v.title || "",
      value: v.value ?? null,
    }));
  }
  if (body.notes !== undefined) updated.notes = (body.notes || "").trim();
  updated.updatedAt = new Date().toISOString();

  await docClient.send(new PutCommand({ TableName: ENTRIES_TABLE, Item: updated }));
  return ok(updated);
}

async function deleteEntry(entryId, userId) {
  const existing = await docClient.send(new GetCommand({ TableName: ENTRIES_TABLE, Key: { entryId } }));
  if (!existing.Item || existing.Item.userId !== userId) return err(404, "Not found");
  await docClient.send(new DeleteCommand({ TableName: ENTRIES_TABLE, Key: { entryId } }));
  return ok({ deleted: true });
}

// ─── Router ──────────────────────────────────────────────────────────────────

export async function handler(event) {
  const userId = event.requestContext?.authorizer?.claims?.sub ?? "local-dev";
  const method = event.httpMethod;
  const path   = event.path || "";
  const params = event.pathParameters || {};
  const query  = event.queryStringParameters || {};

  try {
    // /headquarters/templates[/{templateId}]
    if (path.includes("/headquarters/templates")) {
      const { templateId } = params;
      if (method === "GET"    && !templateId) return await listHQTemplates(userId, query);
      if (method === "POST")                  return await createHQTemplate(JSON.parse(event.body || "{}"), userId);
      if (method === "PUT"    && templateId)  return await updateHQTemplate(templateId, JSON.parse(event.body || "{}"), userId);
      if (method === "DELETE" && templateId)  return await deleteHQTemplate(templateId, userId);
    }

    // /headquarters/entries[/{entryId}]
    if (path.includes("/headquarters/entries")) {
      const { entryId } = params;
      if (method === "GET"    && !entryId) return await listEntries(userId, query);
      if (method === "POST")               return await createEntry(JSON.parse(event.body || "{}"), userId);
      if (method === "PUT"    && entryId)  return await updateEntry(entryId, JSON.parse(event.body || "{}"), userId);
      if (method === "DELETE" && entryId)  return await deleteEntry(entryId, userId);
    }

    // /headquarters[/{hqId}]
    if (path.includes("/headquarters")) {
      const { hqId } = params;
      if (method === "GET"    && !hqId) return await listLocations(userId);
      if (method === "POST")            return await createLocation(JSON.parse(event.body || "{}"), userId);
      if (method === "PUT"    && hqId)  return await updateLocation(hqId, JSON.parse(event.body || "{}"), userId);
      if (method === "DELETE" && hqId)  return await deleteLocation(hqId, userId);
    }

    return err(404, "Not found");
  } catch (e) {
    console.error(e);
    return err(500, "Internal server error");
  }
}
