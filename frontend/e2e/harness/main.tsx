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
  if (method !== "get") return json(config.data ? JSON.parse(config.data) : {}, config);
  if (url.startsWith("/app-settings")) return json({ backstageEnabled: true, googleLoginEnabled: true, createAccountEnabled: true }, config);
  if (url.startsWith("/incomes")) return json(db.incomes, config);
  if (url.startsWith("/expenses/resolve-income")) return json({ income: db.incomes[9] }, config);
  if (url.startsWith("/expenses/")) return json(db.expenses.find(e => url.endsWith(e.expenseId)), config);
  if (url.startsWith("/expenses")) return json(db.expenses, config);
  if (url.startsWith("/split-payments")) return json(db.splits, config);
  if (url.startsWith("/books-and-dev")) return json(db.books, config);
  if (url.startsWith("/investments/snapshots")) return json(db.snapshots, config);
  if (url.startsWith("/investments/operations")) return json(db.operations, config);
  if (url.startsWith("/fx-rates")) return json(db.fx, config);
  if (url.startsWith("/headquarters/templates")) return json(db.templates, config);
  if (url.startsWith("/headquarters/entries")) return json(db.entries, config);
  if (url.startsWith("/headquarters")) return json(db.locations, config);
  if (url.startsWith("/admin/users")) return json(db.users, config);
  return json({}, config);
}
// Both: appSettings uses plain axios before auth.
client.defaults.adapter = route as any;
axios.defaults.adapter = route as any;

await import("../../src/main");
