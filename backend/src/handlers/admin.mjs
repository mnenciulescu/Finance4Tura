import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  ListUsersInGroupCommand,
  AdminGetUserCommand,
  AdminDeleteUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { ScanCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../lib/dynamo.mjs";

const cognito        = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || "eu-central-1" });
const USER_POOL_ID   = process.env.USER_POOL_ID || "eu-central-1_CD7AdBFwQ";
const INCOMES_TABLE  = "Incomes";
const EXPENSES_TABLE = "Expenses";
const BATCH_SIZE     = 25;

const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };
const ok   = (body, statusCode = 200) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });
const err  = (statusCode, message)    => ({ statusCode, headers: CORS, body: JSON.stringify({ message }) });

// Parse cognito:groups claim from API Gateway authorizer context
function isCallerAdmin(event) {
  const raw = event.requestContext?.authorizer?.claims?.["cognito:groups"];
  if (!raw) return false;
  try {
    const groups = JSON.parse(raw);
    return Array.isArray(groups) ? groups.includes("admin") : groups === "admin";
  } catch {
    return raw === "admin" || raw.split(",").map(s => s.trim()).includes("admin");
  }
}

// ─── GET /admin/users ─────────────────────────────────────────────────────────
async function listUsers() {
  // 1. All Cognito users
  const { Users = [] } = await cognito.send(new ListUsersCommand({ UserPoolId: USER_POOL_ID }));

  // 2. Admin group members → Set for O(1) lookup
  const { Users: adminUsers = [] } = await cognito.send(
    new ListUsersInGroupCommand({ UserPoolId: USER_POOL_ID, GroupName: "admin" })
  );
  const adminSet = new Set(adminUsers.map(u => u.Username));

  // 3. Count DynamoDB entries per userId (project only userId to minimise read cost)
  const [{ Items: incItems = [] }, { Items: expItems = [] }] = await Promise.all([
    docClient.send(new ScanCommand({ TableName: INCOMES_TABLE,  ProjectionExpression: "userId" })),
    docClient.send(new ScanCommand({ TableName: EXPENSES_TABLE, ProjectionExpression: "userId" })),
  ]);
  const incomeCounts  = {};
  const expenseCounts = {};
  incItems.forEach(i => { incomeCounts[i.userId]  = (incomeCounts[i.userId]  ?? 0) + 1; });
  expItems.forEach(e => { expenseCounts[e.userId] = (expenseCounts[e.userId] ?? 0) + 1; });

  const users = Users.map(u => {
    const sub = u.Attributes?.find(a => a.Name === "sub")?.Value ?? null;
    return {
      username: u.Username,
      status:   u.UserStatus,
      enabled:  u.Enabled,
      created:  u.UserCreateDate,
      role:     adminSet.has(u.Username) ? "admin" : "normal",
      sub,
      incomes:  incomeCounts[sub]  ?? 0,
      expenses: expenseCounts[sub] ?? 0,
    };
  });

  return ok(users);
}

// ─── PUT /admin/users/{username}/role ─────────────────────────────────────────
async function updateRole(username, body) {
  const { role } = body;
  if (role !== "admin" && role !== "normal") return err(400, "role must be 'admin' or 'normal'");

  if (role === "admin") {
    await cognito.send(new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID, Username: username, GroupName: "admin",
    }));
  } else {
    await cognito.send(new AdminRemoveUserFromGroupCommand({
      UserPoolId: USER_POOL_ID, Username: username, GroupName: "admin",
    }));
  }
  return ok({ username, role });
}

// ─── DELETE /admin/users/{username} ───────────────────────────────────────────
async function deleteUser(username, callerSub) {
  // Resolve the target user's Cognito sub (= DynamoDB userId)
  const { UserAttributes = [] } = await cognito.send(
    new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: username })
  );
  const sub = UserAttributes.find(a => a.Name === "sub")?.Value ?? null;

  // Prevent admin self-deletion
  if (sub && sub === callerSub) return err(400, "You cannot delete your own account");

  if (sub) {
    // Scan both tables for this user's records
    const [{ Items: incItems = [] }, { Items: expItems = [] }] = await Promise.all([
      docClient.send(new ScanCommand({
        TableName: INCOMES_TABLE,
        FilterExpression: "userId = :uid",
        ExpressionAttributeValues: { ":uid": sub },
      })),
      docClient.send(new ScanCommand({
        TableName: EXPENSES_TABLE,
        FilterExpression: "userId = :uid",
        ExpressionAttributeValues: { ":uid": sub },
      })),
    ]);

    // Batch-delete incomes
    for (let i = 0; i < incItems.length; i += BATCH_SIZE) {
      const chunk = incItems.slice(i, i + BATCH_SIZE).map(({ incomeId }) => ({
        DeleteRequest: { Key: { incomeId } },
      }));
      await docClient.send(new BatchWriteCommand({ RequestItems: { [INCOMES_TABLE]: chunk } }));
    }

    // Batch-delete expenses
    for (let i = 0; i < expItems.length; i += BATCH_SIZE) {
      const chunk = expItems.slice(i, i + BATCH_SIZE).map(({ expenseId }) => ({
        DeleteRequest: { Key: { expenseId } },
      }));
      await docClient.send(new BatchWriteCommand({ RequestItems: { [EXPENSES_TABLE]: chunk } }));
    }
  }

  // Delete from Cognito
  await cognito.send(new AdminDeleteUserCommand({ UserPoolId: USER_POOL_ID, Username: username }));

  return ok({ deleted: username, incomes: 0, expenses: 0 });
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const handler = async (event) => {
  try {
    if (!isCallerAdmin(event)) return err(403, "Admin access required");

    const { resource, httpMethod, pathParameters, body: rawBody } = event;
    const body      = rawBody ? JSON.parse(rawBody) : {};
    const username  = pathParameters?.username;
    const callerSub = event.requestContext?.authorizer?.claims?.sub;

    if (resource === "/admin/users"                    && httpMethod === "GET")    return await listUsers();
    if (resource === "/admin/users/{username}/role"    && httpMethod === "PUT")    return await updateRole(username, body);
    if (resource === "/admin/users/{username}"         && httpMethod === "DELETE") return await deleteUser(username, callerSub);

    return err(404, "Route not found");
  } catch (e) {
    console.error("Admin handler error:", e);
    return err(500, e.message || "Internal server error");
  }
};
