import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const endpoint = process.env.DYNAMODB_ENDPOINT;
const dynamo = new DynamoDBClient(endpoint ? { endpoint, region: "eu-central-1" } : {});
const ssm    = new SSMClient({ region: "eu-central-1" });

const TABLES = [
  "Incomes", "Expenses", "InvestmentOperations", "PortfolioSnapshots",
  "SP500Monthly", "SplitPayments", "TestTemplates", "TestResults",
  "KidConfig", "AppSettings", "FxRates", "Books_and_Dev",
  "HQ_Locations", "HQ_Templates", "HQ_Entries",
];

const FOLDER_ID = process.env.GDRIVE_BACKUP_FOLDER_ID;

// ── Response helpers ──────────────────────────────────────────────────────────

const ok = (body) => ({
  statusCode: 200,
  headers: {
    "Content-Type":  "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  },
  body: JSON.stringify(body),
});

const fail = (code, message) => ({
  statusCode: code,
  headers: {
    "Content-Type":  "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  },
  body: JSON.stringify({ message }),
});

function isCallerAdmin(event) {
  const sub = event.requestContext?.authorizer?.claims?.sub;
  if (!sub) return true; // local dev — no authorizer
  const raw = event.requestContext?.authorizer?.claims?.["cognito:groups"];
  if (!raw) return false;
  try {
    const groups = JSON.parse(raw);
    return Array.isArray(groups) ? groups.includes("admin") : groups === "admin";
  } catch {
    return raw === "admin" || raw.split(",").map(s => s.trim()).includes("admin");
  }
}

// ── DynamoDB ──────────────────────────────────────────────────────────────────

async function countTable(tableName) {
  let count = 0, lastKey;
  do {
    const resp = await dynamo.send(new ScanCommand({
      TableName: tableName,
      Select: "COUNT",
      ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
    }));
    count  += resp.Count || 0;
    lastKey = resp.LastEvaluatedKey;
  } while (lastKey);
  return count;
}

async function scanAll(tableName) {
  const items = [];
  let lastKey;
  do {
    const resp = await dynamo.send(new ScanCommand({
      TableName: tableName,
      ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
    }));
    (resp.Items || []).forEach(item => items.push(unmarshall(item)));
    lastKey = resp.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

// ── CSV ───────────────────────────────────────────────────────────────────────

function toCsv(items) {
  if (items.length === 0) return "";
  const allKeys = new Set();
  for (const item of items) Object.keys(item).forEach(k => allKeys.add(k));
  const cols = [...allKeys].sort();
  const cell = (v) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return (s.includes(",") || s.includes('"') || s.includes("\n"))
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  };
  return [cols.join(","), ...items.map(r => cols.map(c => cell(r[c])).join(","))].join("\n");
}

// ── Google OAuth2 (refresh token) / Drive ────────────────────────────────────

let _oauth2 = null;

async function getOAuth2Creds() {
  if (_oauth2) return _oauth2;
  const resp = await ssm.send(new GetParameterCommand({
    Name: "/finance4tura/gdrive-oauth2",
    WithDecryption: true,
  }));
  _oauth2 = JSON.parse(resp.Parameter.Value);
  return _oauth2;
}

async function getAccessToken(creds) {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    `grant_type=refresh_token&client_id=${encodeURIComponent(creds.client_id)}&client_secret=${encodeURIComponent(creds.client_secret)}&refresh_token=${encodeURIComponent(creds.refresh_token)}`,
  });
  if (!resp.ok) throw new Error(`Token refresh failed: ${await resp.text()}`);
  return (await resp.json()).access_token;
}

async function folderExists(token, name, parentId) {
  const q = encodeURIComponent(
    `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) return false;
  const { files } = await resp.json();
  return files && files.length > 0;
}

async function pickFolderName(token, base, parentId) {
  if (!await folderExists(token, base, parentId)) return base;
  for (let i = 1; i <= 9; i++) {
    const name = `${base}_${i}`;
    if (!await folderExists(token, name, parentId)) return name;
  }
  throw new Error("Cannot find a free folder name (tried _1 … _9)");
}

async function createFolder(token, name, parentId) {
  const resp = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  if (!resp.ok) throw new Error(`Folder creation failed: ${await resp.text()}`);
  return resp.json();
}

async function uploadFile(token, folderId, fileName, csvContent) {
  // Step 1: create file metadata
  const metaResp = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    JSON.stringify({ name: fileName, mimeType: "text/csv", parents: [folderId] }),
  });
  if (!metaResp.ok) {
    const txt = await metaResp.text();
    console.error(`[adminBackup] metadata create failed for ${fileName}:`, txt);
    throw new Error(`Metadata create failed (${metaResp.status}): ${txt}`);
  }
  const { id: fileId } = await metaResp.json();

  // Step 2: upload content as simple media
  const contentResp = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&supportsAllDrives=true`,
    {
      method:  "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "text/csv; charset=utf-8" },
      body:    csvContent,
    }
  );
  if (!contentResp.ok) {
    const txt = await contentResp.text();
    console.error(`[adminBackup] content upload failed for ${fileName}:`, txt);
    throw new Error(`Content upload failed (${contentResp.status}): ${txt}`);
  }
}

// ── Route handlers ────────────────────────────────────────────────────────────

async function preview() {
  const today  = new Date().toISOString().slice(0, 10);
  const tables = await Promise.all(
    TABLES.map(async name => {
      try {
        return { name, count: await countTable(name) };
      } catch (e) {
        return { name, count: -1, error: e.message };
      }
    })
  );
  return ok({ folderName: today, tables });
}

async function prepare() {
  const creds  = await getOAuth2Creds();
  const token  = await getAccessToken(creds);
  const today  = new Date().toISOString().slice(0, 10);
  const folderName = await pickFolderName(token, today, FOLDER_ID);
  const folder = await createFolder(token, folderName, FOLDER_ID);
  return ok({
    folderId:  folder.id,
    folderName,
    folderUrl: `https://drive.google.com/drive/folders/${folder.id}`,
  });
}

async function runTable(body) {
  const { tableName, folderId } = body || {};
  if (!tableName || !folderId) return fail(400, "Missing tableName or folderId");
  const creds = await getOAuth2Creds();
  const token = await getAccessToken(creds);
  let rows = 0;
  try {
    const items = await scanAll(tableName);
    rows = items.length;
    await uploadFile(token, folderId, `${tableName}.csv`, toCsv(items));
    return ok({ table: tableName, rows, ok: true });
  } catch (e) {
    console.error(`[adminBackup] runTable failed for ${tableName}:`, e.message);
    return ok({ table: tableName, rows, ok: false, error: e.message });
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export const handler = async (event) => {
  try {
    if (!isCallerAdmin(event)) return fail(403, "Forbidden");

    const method = event.httpMethod;
    const path   = event.path || "";
    const body   = event.body ? JSON.parse(event.body) : {};

    if (method === "GET"  && path.endsWith("/preview"))   return preview();
    if (method === "POST" && path.endsWith("/prepare"))   return prepare();
    if (method === "POST" && path.endsWith("/run-table")) return runTable(body);
    return fail(404, "Not found");
  } catch (e) {
    console.error("[adminBackup] unhandled error:", e);
    return fail(500, e.message || "Internal server error");
  }
};
