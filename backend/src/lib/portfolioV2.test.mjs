// Portfolio v2 — pure rules and the agent loop (mocked SDK). Invented data only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMatrix, rateToEUR, SUPPORTED_CURRENCIES } from "./currencies.mjs";
import {
  buildAssetSnapshot, checkAgentResult, computePlatformTotal, computeValues, finalStatus, isNewData,
  isValidIsin, latestByAsset, normalizeType, planImport, runItems, summarize, validateAsset,
} from "./portfolioV2/model.mjs";
import { describeError, lookupPrice, REPORT_TOOL } from "./portfolioV2/agent.mjs";

const NOW = new Date("2026-11-15T10:00:00Z");
const fx = { rates: buildMatrix({ USD: 1.1, RON: 5, GBP: 0.85, CHF: 0.95 }), updatedAt: "2026-11-14T08:00:00Z" };
const fund = { assetId: "a1", platform: "Bank Funds", type: "MutualFund", name: "Example Equity Fund", units: 10, isin: "LU0000000000", currency: "RON", active: true };
const etf = { assetId: "a2", platform: "Broker", type: "ETF", name: "Example ETF", symbol: "EXA", units: 4, currency: "USD", active: true };
const coin = { assetId: "a3", platform: "Broker", type: "Crypto", name: "Example Coin", symbol: "EXC", units: 0.5, currency: "USD", active: true };
const total = { assetId: "t1", platform: "Broker", type: "Total", name: "Broker total", currency: "EUR", active: true };

/* ── Currencies ───────────────────────────────────────────────────────────── */

test("FX matrix covers every supported currency, diagonal 1, consistent cross rates", () => {
  const m = fx.rates;
  assert.deepEqual(Object.keys(m), SUPPORTED_CURRENCIES);
  for (const c of SUPPORTED_CURRENCIES) assert.equal(m[c][c], 1);
  assert.equal(m.EUR.GBP, 0.85);
  assert.equal(m.GBP.EUR, Math.round((1 / 0.85) * 1e6) / 1e6);
  assert.equal(m.USD.RON, Math.round((5 / 1.1) * 1e6) / 1e6);
});

test("FX matrix leaves out currencies without a rate", () => {
  const m = buildMatrix({ USD: 1.1 });
  assert.deepEqual(Object.keys(m), ["EUR", "USD"]);
});

test("rateToEUR reads the matrix and returns null when a currency is missing", () => {
  assert.equal(rateToEUR(fx.rates, "EUR"), 1);
  assert.equal(rateToEUR(fx.rates, "RON"), 0.2);
  assert.equal(rateToEUR({ EUR: { EUR: 1 } }, "GBP"), null);
});

/* ── Assets ───────────────────────────────────────────────────────────────── */

test("normalizeType maps spreadsheet spellings", () => {
  assert.equal(normalizeType("Mutual fond"), "MutualFund");
  assert.equal(normalizeType("etf"), "ETF");
  assert.equal(normalizeType("Total"), "Total");
  assert.equal(normalizeType("warrant"), null);
});

test("isValidIsin checks format and check digit", () => {
  assert.equal(isValidIsin("US0378331005"), true);
  assert.equal(isValidIsin("IE00B4L5Y983"), true);
  assert.equal(isValidIsin("US0378331006"), false);
  assert.equal(isValidIsin("US037833100"), false);
});

test("validateAsset: units > 0, supported currency, valid ISIN", () => {
  const { errors } = validateAsset({ platform: "P", type: "ETF", name: "X", units: 0, currency: "JPY", isin: "XX1234567890" });
  assert.ok(errors.units && errors.currency && errors.isin);
  const ok = validateAsset({ platform: " P ", type: "Stock", name: "Y", units: "2,5", currency: "gbp", symbol: "y" });
  assert.deepEqual(ok.errors, {});
  assert.equal(ok.value.units, 2.5);
  assert.equal(ok.value.currency, "GBP");
  assert.equal(ok.value.symbol, "Y");
  assert.equal(ok.value.platform, "P");
});

test("validateAsset keeps decimal units exactly as given", () => {
  const { value } = validateAsset({ platform: "P", type: "MutualFund", name: "F", units: 2.809, currency: "EUR" });
  assert.equal(value.units, 2.809);
});

test("validateAsset: Total has no units and only one per platform", () => {
  const t = validateAsset({ platform: "Broker", type: "Total", units: 5 });
  assert.equal(t.value.units, null);
  assert.equal(t.value.currency, "EUR");
  assert.ok(validateAsset({ platform: "broker", type: "Total" }, { others: [total] }).errors.type);
});

test("planImport creates, updates by platform + ISIN/symbol/name, and adds missing Totals", () => {
  const existing = [{ ...etf, units: 3 }];
  const plan = planImport([
    { platform: "Broker", type: "ETF", symbol: "EXA", name: "Example ETF", units: 4, currency: "USD" },
    { platform: "Bank Funds", type: "Mutual fond", name: "Fund A", units: 1.5, isin: "US0378331005", currency: "RON" },
  ], existing);
  assert.equal(plan.errors.length, 0);
  assert.equal(plan.update.length, 1);
  assert.equal(plan.update[0].value.units, 4);
  const totals = plan.create.filter(a => a.type === "Total").map(a => a.platform).sort();
  assert.deepEqual(totals, ["Bank Funds", "Broker"]);
  assert.equal(plan.create.filter(a => a.type === "MutualFund").length, 1);
});

test("planImport reports invalid and duplicate rows", () => {
  const plan = planImport([
    { platform: "P", type: "ETF", name: "A", units: 1, currency: "USD", symbol: "A" },
    { platform: "P", type: "ETF", name: "A", units: 2, currency: "USD", symbol: "A" },
    { platform: "P", type: "ETF", name: "B", units: -1, currency: "USD" },
  ], []);
  assert.equal(plan.errors.length, 2);
});

/* ── Agent results ────────────────────────────────────────────────────────── */

const good = (over = {}) => ({
  found: true, unitPrice: 12.5, currency: "RON", priceDate: "2026-11-13", priceType: "nav",
  sources: [{ url: "https://example.com/nav", title: "NAV", publisher: "Example AM", quote: "NAV 12.50 RON" }],
  confidence: "official", comments: null, reasonIfNotFound: null, ...over,
});

test("checkAgentResult accepts a confirmed, recent, same-currency price", () => {
  assert.deepEqual(checkAgentResult(good(), fund, NOW), { ok: true });
});

test("checkAgentResult: not found, stale, future, currency mismatch, no https source", () => {
  assert.equal(checkAgentResult(good({ found: false, reasonIfNotFound: "No NAV" }), fund, NOW).status, "not_found");
  assert.equal(checkAgentResult(good({ priceDate: "2026-10-01" }), fund, NOW).status, "not_found");
  assert.equal(checkAgentResult(good({ priceDate: "2026-11-16" }), fund, NOW).status, "failed");
  assert.match(checkAgentResult(good({ currency: "EUR" }), fund, NOW).message, /Currency mismatch/);
  assert.equal(checkAgentResult(good({ sources: [{ url: "http://x" }] }), fund, NOW).status, "failed");
  assert.equal(checkAgentResult(good({ unitPrice: 0 }), fund, NOW).status, "failed");
});

test("checkAgentResult: crypto prices must be from the last day", () => {
  const r = good({ currency: "USD", priceDate: "2026-11-13" });
  assert.equal(checkAgentResult(r, coin, NOW).status, "not_found");
  assert.equal(checkAgentResult({ ...r, priceDate: "2026-11-15" }, coin, NOW).ok, true);
});

test("isNewData: first, later date, unit change, crypto after an hour", () => {
  const last = { priceDate: "2026-11-13", generatedAt: "2026-11-15T09:30:00Z", asset: { units: 10 } };
  assert.equal(isNewData(null, fund, "2026-11-13", NOW), true);
  assert.equal(isNewData(last, fund, "2026-11-13", NOW), false);
  assert.equal(isNewData(last, fund, "2026-11-14", NOW), true);
  assert.equal(isNewData(last, { ...fund, units: 11 }, "2026-11-13", NOW), true);
  assert.equal(isNewData({ ...last, asset: { units: 0.5 } }, coin, "2026-11-13", NOW), false);
  assert.equal(isNewData({ ...last, asset: { units: 0.5 }, generatedAt: "2026-11-15T08:59:00Z" }, coin, "2026-11-13", NOW), true);
});

test("computeValues: units × price, then FX to EUR; fails without a rate", () => {
  const v = computeValues(fund, 12.5, fx);
  assert.equal(v.value, 125);
  assert.equal(v.fxRate, 0.2);
  assert.equal(v.valueEUR, 25);
  assert.match(computeValues({ ...etf, currency: "GBP" }, 1, { rates: { EUR: { EUR: 1 } } }).error, /No FX rate for GBP/);
});

test("buildAssetSnapshot copies the asset and flags big price moves", () => {
  const values = computeValues(fund, 20, fx);
  const snap = buildAssetSnapshot({ asset: fund, result: good({ unitPrice: 20 }), values, last: { unitPrice: 12.5, priceDate: "2026-11-01" }, runId: "r", snapshotId: "s", userId: "u", now: NOW });
  assert.equal(snap.asset.units, 10);
  assert.equal(snap.valueEUR, 40);
  assert.equal(snap.flagged, true);
  assert.match(snap.comments, /Check price: 60\.0%/);
  assert.equal(snap.sources[0].retrievedAt, NOW.toISOString());
});

/* ── Totals ───────────────────────────────────────────────────────────────── */

test("platform Total sums latest snapshots, carries forward, flags missing assets", () => {
  const snaps = [
    { snapshotId: "s1", assetId: "a2", priceDate: "2026-11-01", generatedAt: "x1", valueEUR: 100 },
    { snapshotId: "s2", assetId: "a2", priceDate: "2026-11-14", generatedAt: "x2", valueEUR: 110 },
  ];
  const latest = latestByAsset(snaps);
  const t = computePlatformTotal([etf, coin, total], latest, new Set(["s2"]));
  assert.equal(t.valueEUR, 110);
  assert.equal(t.hasNew, true);
  assert.equal(t.missing, 1);
  assert.equal(t.priceDate, "2026-11-14");
  assert.match(t.comments, /incomplete: 1 asset without a price/);
  const t2 = computePlatformTotal([etf, total], latest, new Set());
  assert.equal(t2.hasNew, false);
  assert.match(t2.comments, /1 carried forward from 2026-11-14/);
});

test("archived assets are left out of Totals and runs", () => {
  const items = runItems([{ ...coin, active: false }, etf, total, fund]);
  assert.deepEqual(items.map(i => i.assetId), ["a1", "a2", "t1"]);
  assert.ok(items.every(i => i.status === "queued"));
});

test("summary and final status", () => {
  const items = [{ type: "ETF", status: "updated" }, { type: "ETF", status: "no_new_data" }, { type: "ETF", status: "not_found" }, { type: "Total", status: "updated" }];
  assert.deepEqual(summarize(items), { updated: 1, noNewData: 1, notFound: 1, failed: 0, skipped: 0 });
  assert.equal(finalStatus(items), "completed_with_errors");
  assert.equal(finalStatus(items.slice(0, 2)), "completed");
  assert.equal(finalStatus(items, true), "cancelled");
});

/* ── Agent loop (mocked SDK) ──────────────────────────────────────────────── */

function mockClient(responses) {
  const calls = [];
  return {
    calls,
    beta: { messages: { create: async (req) => { calls.push(req); const r = responses.shift(); if (r instanceof Error) throw r; return r; } } },
  };
}
const usage = { input_tokens: 100, output_tokens: 20, server_tool_use: { web_search_requests: 2 } };

test("lookupPrice returns the report_price input and totals usage, resuming paused turns", async () => {
  const client = mockClient([
    { stop_reason: "pause_turn", content: [{ type: "text", text: "searching" }], usage },
    { stop_reason: "tool_use", content: [{ type: "tool_use", name: "report_price", id: "t", input: good() }], usage },
  ]);
  const out = await lookupPrice({ client, asset: fund, last: null, now: NOW });
  assert.equal(out.result.unitPrice, 12.5);
  assert.deepEqual(out.usage, { inputTokens: 200, outputTokens: 40, webSearches: 4 });
  const req = client.calls[0];
  assert.equal(req.model, "claude-opus-5-5");
  assert.equal(req.fallbacks, "default");
  assert.deepEqual(req.betas, ["server-side-fallback-2026-07-01"]);
  assert.ok(req.tools.some(t => t.type === "web_search_20260209"));
  assert.ok(req.tools.some(t => t.name === "report_price" && t.strict));
  assert.match(req.messages[0].content, /ISIN: LU0000000000/);
  assert.equal(client.calls[1].messages.length, 2);
});

test("lookupPrice asks again when the model ends without reporting, then gives up", async () => {
  const end = { stop_reason: "end_turn", content: [{ type: "text", text: "done" }], usage };
  const out = await lookupPrice({
    client: mockClient([end, { stop_reason: "tool_use", content: [{ type: "tool_use", name: "report_price", id: "t", input: good({ found: false }) }], usage }]),
    asset: fund, last: null, now: NOW,
  });
  assert.equal(out.result.found, false);
  await assert.rejects(lookupPrice({ client: mockClient(Array(6).fill(end)), asset: fund, last: null, now: NOW }), /did not report/);
});

test("lookupPrice turns refusals into errors; describeError explains API failures", async () => {
  await assert.rejects(
    lookupPrice({ client: mockClient([{ stop_reason: "refusal", stop_details: { category: "cyber" }, content: [], usage }]), asset: fund, last: null, now: NOW }),
    /declined/,
  );
  assert.match(describeError({ status: 401 }), /key was rejected/);
  assert.match(describeError({ status: 429 }), /rate limit/);
});

test("the report tool schema is strict and requires every field", () => {
  assert.equal(REPORT_TOOL.input_schema.additionalProperties, false);
  assert.deepEqual([...REPORT_TOOL.input_schema.required].sort(), Object.keys(REPORT_TOOL.input_schema.properties).sort());
});
