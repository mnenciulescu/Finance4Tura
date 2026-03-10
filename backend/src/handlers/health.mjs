export const handler = async () => ({
  statusCode: 200,
  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" },
  body: JSON.stringify({ status: "ok" }),
});
