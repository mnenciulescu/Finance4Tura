import { randomUUID } from "crypto";
import { GetCommand, PutCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../lib/dynamo.mjs";

const TABLE = process.env.BOOKS_TABLE || "Books_and_Dev";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

const ok  = (body, statusCode = 200) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });
const err = (statusCode, message)    => ({ statusCode, headers: CORS, body: JSON.stringify({ message }) });

function userId(event) {
  return event.requestContext?.authorizer?.claims?.sub ?? "local-dev";
}

async function listBooks(uid) {
  const result = await docClient.send(new ScanCommand({
    TableName: TABLE,
    FilterExpression: "userId = :uid",
    ExpressionAttributeValues: { ":uid": uid },
  }));
  const items = (result.Items ?? []).sort((a, b) => {
    const da = a.dateCompleted || "";
    const db = b.dateCompleted || "";
    if (da !== db) return db.localeCompare(da);
    return (a.title || "").localeCompare(b.title || "");
  });
  return ok(items);
}

async function createBook(body, uid) {
  const { name, source, type, author, title, dateCompleted, rating, comments } = body;
  if (!title?.trim()) return err(400, "title is required");
  const now = new Date().toISOString();
  const item = {
    bookId:        randomUUID(),
    userId:        uid,
    name:          (name || "").trim(),
    source:        (source || "").trim(),
    type:          (type || "").trim(),
    author:        (author || "").trim(),
    title:         title.trim(),
    dateCompleted: (dateCompleted || "").trim(),
    rating:        rating ? Number(rating) : null,
    comments:      (comments || "").trim(),
    createdAt:     now,
    updatedAt:     now,
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return ok(item, 201);
}

async function updateBook(bookId, body, uid) {
  const existing = await docClient.send(new GetCommand({ TableName: TABLE, Key: { bookId } }));
  if (!existing.Item || existing.Item.userId !== uid) return err(404, "Not found");
  const { name, source, type, author, title, dateCompleted, rating, comments } = body;
  if (!title?.trim()) return err(400, "title is required");
  const item = {
    ...existing.Item,
    name:          (name || "").trim(),
    source:        (source || "").trim(),
    type:          (type || "").trim(),
    author:        (author || "").trim(),
    title:         title.trim(),
    dateCompleted: (dateCompleted || "").trim(),
    rating:        rating ? Number(rating) : null,
    comments:      (comments || "").trim(),
    updatedAt:     new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return ok(item);
}

async function deleteBook(bookId, uid) {
  const existing = await docClient.send(new GetCommand({ TableName: TABLE, Key: { bookId } }));
  if (!existing.Item || existing.Item.userId !== uid) return err(404, "Not found");
  await docClient.send(new DeleteCommand({ TableName: TABLE, Key: { bookId } }));
  return ok({ deleted: true });
}

export async function handler(event) {
  try {
    const uid    = userId(event);
    const method = event.httpMethod;
    const bookId = event.pathParameters?.bookId;

    if (method === "GET"    && !bookId) return await listBooks(uid);
    if (method === "POST"   && !bookId) return await createBook(JSON.parse(event.body || "{}"), uid);
    if (method === "PUT"    &&  bookId) return await updateBook(bookId, JSON.parse(event.body || "{}"), uid);
    if (method === "DELETE" &&  bookId) return await deleteBook(bookId, uid);

    return err(404, "Not found");
  } catch (e) {
    console.error(e);
    return err(500, e.message);
  }
}
