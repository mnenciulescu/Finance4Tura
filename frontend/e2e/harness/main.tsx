// Harness entry: answers every API call from fixtures, then boots the real app.
import axios from "axios";
import client from "../../src/api/client";
import { db } from "./fixtures.js";

const q = new URLSearchParams(location.search);
if (q.get("theme")) localStorage.setItem("uiTheme", q.get("theme")!);
localStorage.setItem("uiInstallBannerDismissed", q.get("install") ? "false" : "true");
if (q.get("amounts")) localStorage.setItem("incomePrivacy", "true");

const json = (data: unknown, config: any, status = 200) => Promise.resolve({ data, status, statusText: "OK", headers: {}, config });
function route(config: any) {
  const url = (config.url || "").replace(/^https?:\/\/[^/]+(\/Prod)?/, "");
  const method = (config.method || "get").toLowerCase();
  if (url.startsWith("/portfolio-v2")) return portfolioV2(url, method, config);
  if (method !== "get") return json(config.data ? JSON.parse(config.data) : {}, config);
  if (url.startsWith("/app-settings")) return json({ backstageEnabled: true, googleLoginEnabled: true, createAccountEnabled: true }, config);
  if (url.startsWith("/incomes")) return json(db.incomes, config);
  if (url.startsWith("/expenses/resolve-income")) return json({ income: db.incomes[9] }, config);
  if (url.startsWith("/expenses/")) return json(db.expenses.find(e => url.endsWith(e.expenseId)), config);
  if (url.startsWith("/expenses")) return json(db.expenses, config);
  if (url.startsWith("/split-payments")) return json(db.splits, config);
  if (url.startsWith("/books-and-dev")) return json(db.books, config);
  if (url.startsWith("/investments/operations")) return json(db.operations, config);
  if (url.startsWith("/fx-rates")) return json(db.fx, config);
  if (url.startsWith("/headquarters/templates")) return json(db.templates, config);
  if (url.startsWith("/headquarters/entries")) return json(db.entries, config);
  if (url.startsWith("/headquarters")) return json(db.locations, config);
  if (url.startsWith("/admin/users")) return json(db.users, config);
  return json({}, config);
}
// Portfolio v2: a run advances one asset per poll, so the progress dialog moves.
let pv2Run: any = null;
function portfolioV2(url: string, method: string, config: any) {
  if (url.startsWith("/portfolio-v2/assets")) return json(method === "get" ? db.pv2Assets : { asset: JSON.parse(config.data || "{}"), created: [] }, config);
  if (url.startsWith("/portfolio-v2/snapshots")) return json(db.pv2Snapshots, config);
  if (url.startsWith("/portfolio-v2/ai-config")) return json(db.pv2Ai, config);
  if (url === "/portfolio-v2/runs" && method === "post") {
    const item = (a: any) => ({ assetId: a.assetId, name: a.name, platform: a.platform, type: a.type, symbol: a.symbol, isin: a.isin, status: "queued" });
    const items = [...db.pv2Assets.filter(a => a.type !== "Total").map(item), ...db.pv2Assets.filter(a => a.type === "Total").map(item)];
    pv2Run = { runId: "run-e2e", trigger: "manual", status: "running", startedAt: new Date().toISOString(), finishedAt: null, items, summary: null, model: "claude-opus-5-5", usage: { inputTokens: 0, outputTokens: 0, webSearches: 0 } };
    return json(structuredClone(pv2Run), config, 201);
  }
  if (url.startsWith("/portfolio-v2/runs/") && pv2Run) {
    const next = pv2Run.items.findIndex((i: any) => i.type !== "Total" && i.status === "queued");
    if (next >= 0) {
      const outcome = ["updated", "failed", "no_new_data"][next % 3];
      pv2Run.items[next] = { ...pv2Run.items[next], status: outcome, message: outcome === "failed" ? "AI rate limit reached — retry in a minute" : outcome === "no_new_data" ? "Latest price already recorded" : null, unitPrice: 101.5, currency: "USD", latestPriceDate: new Date().toISOString().slice(0, 10), valueEUR: 1175, sourceUrl: "https://example.com/price" };
    } else if (pv2Run.status === "running") {
      pv2Run.items = pv2Run.items.map((i: any) => (i.type === "Total" ? { ...i, status: "updated", valueEUR: 9000, message: "Sum of 2 assets" } : i));
      pv2Run.status = "completed_with_errors";
      pv2Run.finishedAt = new Date().toISOString();
      pv2Run.summary = { updated: 1, noNewData: 1, notFound: 0, failed: 1, skipped: 0 };
    }
    return json(structuredClone(pv2Run), config);
  }
  if (url.startsWith("/portfolio-v2/runs")) return json(pv2Run ? [structuredClone(pv2Run)] : [], config);
  return json({}, config);
}

// Both: appSettings uses plain axios before auth.
client.defaults.adapter = route as any;
axios.defaults.adapter = route as any;

await import("../../src/main");
