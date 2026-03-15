import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../lib/dynamo.mjs";

const TABLE = process.env.SP500_TABLE || "SP500Monthly";

const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };
const ok  = body => ({ statusCode: 200, headers: CORS, body: JSON.stringify(body) });
const err = (status, message) => ({ statusCode: status, headers: CORS, body: JSON.stringify({ message }) });

export async function handler(event) {
  try {
    const { Items = [] } = await docClient.send(new ScanCommand({ TableName: TABLE }));
    const sorted = Items
      .map(i => ({ monthId: i.monthId, close: i.close }))
      .sort((a, b) => a.monthId.localeCompare(b.monthId));
    return ok(sorted);
  } catch (e) {
    console.error(e);
    return err(500, "Internal server error");
  }
}
