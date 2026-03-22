import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../lib/dynamo.mjs";

const TABLE = process.env.APP_SETTINGS_TABLE || "AppSettings";
const SETTINGS_KEY = "global";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

const DEFAULTS = {
  backstageEnabled:    true,
  googleLoginEnabled:  true,
  createAccountEnabled: true,
};

const ok  = (body) => ({ statusCode: 200, headers: CORS, body: JSON.stringify(body) });
const err = (status, message) => ({ statusCode: status, headers: CORS, body: JSON.stringify({ message }) });

// Mirrors the same check in admin.mjs — local dev always passes.
function isCallerAdmin(event) {
  const sub = event.requestContext?.authorizer?.claims?.sub;
  if (!sub || sub === "local-dev") return true;
  const raw = event.requestContext?.authorizer?.claims?.["cognito:groups"];
  if (!raw) return false;
  try {
    const groups = JSON.parse(raw);
    return Array.isArray(groups) ? groups.includes("admin") : groups === "admin";
  } catch {
    return raw === "admin" || raw.split(",").map(s => s.trim()).includes("admin");
  }
}

export async function handler(event) {
  const method = event.httpMethod;

  try {
    if (method === "GET") {
      const result = await docClient.send(new GetCommand({ TableName: TABLE, Key: { settingKey: SETTINGS_KEY } }));
      return ok({ ...DEFAULTS, ...(result.Item ?? {}) });
    }

    if (method === "PUT") {
      if (!isCallerAdmin(event)) return err(403, "Admin access required");
      const body = JSON.parse(event.body || "{}");
      const item = {
        settingKey: SETTINGS_KEY,
        backstageEnabled:    body.backstageEnabled    !== undefined ? Boolean(body.backstageEnabled)    : DEFAULTS.backstageEnabled,
        googleLoginEnabled:  body.googleLoginEnabled  !== undefined ? Boolean(body.googleLoginEnabled)  : DEFAULTS.googleLoginEnabled,
        createAccountEnabled: body.createAccountEnabled !== undefined ? Boolean(body.createAccountEnabled) : DEFAULTS.createAccountEnabled,
        updatedAt: new Date().toISOString(),
      };
      await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
      return ok(item);
    }

    return err(404, "Not found");
  } catch (e) {
    console.error(e);
    return err(500, "Internal server error");
  }
}
