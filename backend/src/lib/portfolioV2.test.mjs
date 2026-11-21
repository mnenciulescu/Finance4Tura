// Portfolio v2 — pure rules and the agent loop (mocked SDK). Invented data only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMatrix, rateToEUR, SUPPORTED_CURRENCIES } from "./currencies.mjs";
import {
  buildAssetSnapshot, checkAgentResult, computePlatformTotal, computeValues, finalStatus, isNewData,
  isValidIsin, latestByAsset, normalizeType, runItems, sameDaySlot, snapshotDay, summarize, validateAsset,
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

/* ── Agent results ────────────────────────────────────────────────────────── */

const good = (over = {}) => ({
  found: true, unitPrice: 12.5, currency: "RON", priceDate: "2026-11-13", priceType: "nav",
  sources: [{ url: "https://example.com/nav", title: "NAV", publisher: "Example AM", quote: "NAV 12.50 RON" }],
  confidence: "official", comments: null, reasonIfNotFound: null, ...over,
});

test("checkAgentResult accepts a confirmed, recent, same-currency price", () => {
  assert.deepEqual(checkAgentResult(good(), fund, NOW), { ok: true, stale: false, ageDays: 2, message: null });
});

test("checkAgentResult: not found, future, currency mismatch, no https source", () => {
  assert.equal(checkAgentResult(good({ found: false, reasonIfNotFound: "No NAV" }), fund, NOW).status, "not_found");
  assert.equal(checkAgentResult(good({ priceDate: "2026-11-16" }), fund, NOW).status, "failed");
  assert.match(checkAgentResult(good({ currency: "EUR" }), fund, NOW).message, /Currency mismatch/);
  assert.equal(checkAgentResult(good({ sources: [{ url: "http://x" }] }), fund, NOW).status, "failed");
  assert.equal(checkAgentResult(good({ unitPrice: 0 }), fund, NOW).status, "failed");
});

test("checkAgentResult: an old confirmed price is accepted and marked stale (crypto after a day)", () => {
  const old = checkAgentResult(good({ priceDate: "2026-10-01" }), fund, NOW);
  assert.equal(old.ok, true);
  assert.equal(old.stale, true);
  assert.equal(old.ageDays, 45);
  assert.match(old.message, /from 2026-10-01 \(45 days old\)/);
  assert.equal(checkAgentResult(good({ priceDate: "2026-11-05" }), fund, NOW).stale, false); // 10 days
  const r = good({ currency: "USD", priceDate: "2026-11-13" });
  assert.equal(checkAgentResult(r, coin, NOW).stale, true);
  assert.equal(checkAgentResult({ ...r, priceDate: "2026-11-15" }, coin, NOW).stale, false);
});

test("isNewData: first, later date, unit change, crypto after an hour", () => {
  const last = { latestPriceDate: "2026-11-13", generatedAt: "2026-11-15T09:30:00Z", asset: { units: 10 } };
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
  const snap = buildAssetSnapshot({ asset: fund, result: good({ unitPrice: 20 }), values, last: { unitPrice: 12.5, latestPriceDate: "2026-11-01" }, runId: "r", snapshotId: "s", userId: "u", now: NOW });
  assert.equal(snap.asset.units, 10);
  assert.equal(snap.valueEUR, 40);
  assert.equal(snap.flagged, true);
  assert.match(snap.comments, /Check price: 60\.0%/);
  assert.equal(snap.sources[0].retrievedAt, NOW.toISOString());
  assert.equal(snap.latestPriceDate, "2026-11-13");
  assert.equal("priceDate" in snap, false); // the search date is generatedAt
  assert.equal(snap.generatedAt, NOW.toISOString());
  assert.equal(snap.stale, false);
  const old = buildAssetSnapshot({ asset: fund, result: good({ priceDate: "2026-10-01" }), values, last: null, runId: "r", snapshotId: "s2", userId: "u", now: NOW });
  assert.equal(old.latestPriceDate, "2026-10-01");
  assert.equal(old.stale, true);
  assert.match(old.comments, /45 days old/);
});

/* ── Totals ───────────────────────────────────────────────────────────────── */

test("snapshotDay follows Romanian time, not UTC", () => {
  assert.equal(snapshotDay("2026-11-15T21:59:00Z"), "2026-11-15");
  assert.equal(snapshotDay("2026-11-15T22:01:00Z"), "2026-11-16"); // 00:01 in Bucharest (UTC+2)
  assert.equal(snapshotDay("2026-07-15T21:30:00Z"), "2026-07-16"); // summer time, UTC+3
});

test("sameDaySlot: a same-day run replaces that day's snapshot and compares with the day before", () => {
  const s = (id, generatedAt, latestPriceDate, unitPrice) => ({ snapshotId: id, assetId: "a1", generatedAt, latestPriceDate, unitPrice });
  const yesterday = s("y", "2026-11-14T09:00:00Z", "2026-11-13", 10);
  const morning = s("m", "2026-11-15T07:00:00Z", "2026-11-14", 11);
  const older = s("o", "2026-11-15T06:00:00Z", "2026-11-14", 11);

  assert.deepEqual(sameDaySlot([], NOW), { replace: null, extra: [], previous: null });
  assert.deepEqual(sameDaySlot([yesterday], NOW), { replace: null, extra: [], previous: yesterday });
  const slot = sameDaySlot([yesterday, older, morning], NOW);
  assert.equal(slot.replace, morning);
  assert.deepEqual(slot.extra, [older]);
  assert.equal(slot.previous, yesterday);

  // The jump check runs against the earlier day, not the snapshot being replaced.
  const snap = buildAssetSnapshot({
    asset: fund, last: slot.previous, runId: "r2", snapshotId: slot.replace.snapshotId, userId: "u", now: NOW,
    result: { unitPrice: 20, priceDate: "2026-11-14", sources: [{ url: "https://example.com" }], confidence: "official" },
    values: { value: 200, fxRate: 0.2, fxDate: "2026-11-14", valueEUR: 40 },
  });
  assert.equal(snap.snapshotId, "m");
  assert.equal(snap.flagged, true);
  assert.match(snap.comments, /vs 2026-11-13/);
});

test("platform Total sums latest snapshots, carries forward, flags missing assets", () => {
  const snaps = [
    { snapshotId: "s1", assetId: "a2", latestPriceDate: "2026-11-01", generatedAt: "x1", valueEUR: 100 },
    { snapshotId: "s2", assetId: "a2", latestPriceDate: "2026-11-14", generatedAt: "x2", valueEUR: 110 },
  ];
  const latest = latestByAsset(snaps);
  const t = computePlatformTotal([etf, coin, total], latest, new Set(["s2"]));
  assert.equal(t.valueEUR, 110);
  assert.equal(t.hasNew, true);
  assert.equal(t.missing, 1);
  assert.equal(t.latestPriceDate, "2026-11-14");
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
const usage = { input_tokens: 100, cache_read_input_tokens: 50, cache_creation_input_tokens: 10, output_tokens: 20, server_tool_use: { web_search_requests: 2, web_fetch_requests: 3 } };

test("lookupPrice returns the report_price input and totals usage, resuming paused turns", async () => {
  const client = mockClient([
    { stop_reason: "pause_turn", content: [{ type: "text", text: "searching" }], usage },
    { stop_reason: "tool_use", content: [{ type: "tool_use", name: "report_price", id: "t", input: good() }], usage },
  ]);
  const out = await lookupPrice({ client, asset: fund, last: null, now: NOW });
  assert.equal(out.result.unitPrice, 12.5);
  assert.deepEqual(out.usage, { inputTokens: 200, cacheReadTokens: 100, cacheWriteTokens: 20, outputTokens: 40, webSearches: 4, webFetches: 6, requests: 2 });
  const req = client.calls[0];
  assert.equal(req.model, "claude-opus-5-5");
  assert.equal(req.fallbacks, "default");
  assert.deepEqual(req.betas, ["server-side-fallback-2026-07-01"]);
  assert.equal(req.tools[0].type, "web_search_20260209");
  assert.ok(req.tools.some(t => t.type === "web_search_20260209"));
  assert.ok(req.tools.some(t => t.name === "report_price" && t.strict));
  assert.match(req.messages[0].content, /ISIN: LU0000000000/);
  assert.equal(client.calls[1].messages.length, 2);
});

test("lookupPrice: default search budget, low effort and page cap; the deeper pass's effort, budget, page cap and hint", async () => {
  const one = () => mockClient([{ stop_reason: "tool_use", content: [{ type: "tool_use", name: "report_price", id: "t", input: good() }], usage }]);
  const first = one();
  await lookupPrice({ client: first, asset: fund, last: null, now: NOW });
  assert.equal(first.calls[0].output_config.effort, "low");
  assert.equal(first.calls[0].tools.find(t => t.name === "web_search").max_uses, 5);
  assert.equal(first.calls[0].tools.find(t => t.name === "web_fetch").max_uses, 10);
  assert.equal(first.calls[0].tools.find(t => t.name === "web_fetch").max_content_tokens, 10000);
  assert.match(first.calls[0].messages[0].content, /Budget: up to 5 web searches and 10 page fetches/);
  assert.doesNotMatch(first.calls[0].messages[0].content, /previous search/);

  const deeper = one();
  await lookupPrice({ client: deeper, asset: fund, last: null, now: NOW, effort: "high", pageTokens: 25000, maxSearches: 30, hint: "it found 9 RON for 2026-10-01, which was rejected: too old." });
  const req = deeper.calls[0];
  assert.equal(req.output_config.effort, "high");
  assert.equal(req.tools.find(t => t.name === "web_search").max_uses, 30);
  assert.equal(req.tools.find(t => t.name === "web_fetch").max_uses, 60);
  assert.equal(req.tools.find(t => t.name === "web_fetch").max_content_tokens, 25000);
  assert.match(req.messages[0].content, /previous search was not good enough: it found 9 RON for 2026-10-01/);

  const again = one();
  const last = { unitPrice: 12, currency: "RON", latestPriceDate: "2026-11-10", sources: [{ url: "https://fund.example/nav" }] };
  await lookupPrice({ client: again, asset: fund, last, now: NOW });
  assert.match(again.calls[0].messages[0].content, /found before \(fetch these first\): https:\/\/fund\.example\/nav/);
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

/* ── Imported history (source "legacy", already in the table) ─────────────── */

test("sameDaySlot never replaces imported history", () => {
  const legacy = { snapshotId: "legacy-1", assetId: "a1", source: "legacy", generatedAt: "2026-11-15T12:00:00.000Z", latestPriceDate: "2026-11-15" };
  assert.equal(sameDaySlot([legacy], NOW).replace, null);
});

test("lookupPrice on Haiku: no fallbacks, earlier web tool versions", async () => {
  const client = mockClient([
    { stop_reason: "tool_use", content: [{ type: "tool_use", name: "report_price", id: "t", input: good() }], usage },
  ]);
  await lookupPrice({ client, asset: fund, last: null, model: "claude-haiku-5-5", now: NOW });
  const req = client.calls[0];
  assert.equal(req.model, "claude-haiku-5-5");
  assert.equal(req.fallbacks, undefined);
  assert.equal(req.betas, undefined);
  assert.deepEqual(req.tools.slice(0, 2).map(t => t.type), ["web_search_20250305", "web_fetch_20250910"]);
});

test("a run starts at most MAX_PARALLEL workers; the rest wait in its queue", async () => {
  const { queueFields, MAX_PARALLEL } = await import("./portfolioV2/dispatch.mjs");
  assert.equal(MAX_PARALLEL, 5);
  assert.deepEqual(queueFields([0, 1, 2, 4, 5, 6, 7]), { queue: [0, 1, 2, 4, 5, 6, 7], queueLength: 7, dispatched: 5 });
  assert.deepEqual(queueFields([3, 8]), { queue: [3, 8], queueLength: 2, dispatched: 2 });
});

/* ── Pre-check (skip lookups that cannot find a newer price) ─────────────── */

test("latestPublishableDate: previous business day; a weekday's own close late in the evening for stocks/ETFs", async () => {
  const { latestPublishableDate } = await import("./portfolioV2/model.mjs");
  // Wed 18 Nov 2026, 14:00 Romania (12:00 UTC)
  const wed = new Date("2026-11-18T12:00:00Z");
  assert.equal(latestPublishableDate("MutualFund", wed), "2026-11-17");
  assert.equal(latestPublishableDate("ETF", wed), "2026-11-17");
  // Wed 23:30 Romania: today's close is out for stocks / ETFs, not for funds.
  const late = new Date("2026-11-18T21:30:00Z");
  assert.equal(latestPublishableDate("Stock", late), "2026-11-18");
  assert.equal(latestPublishableDate("MutualFund", late), "2026-11-17");
  // Monday and Sunday look back to Friday.
  assert.equal(latestPublishableDate("ETF", new Date("2026-11-16T09:00:00Z")), "2026-11-13");
  assert.equal(latestPublishableDate("MutualFund", new Date("2026-11-15T09:00:00Z")), "2026-11-13");
});

test("precheckSkip: skips up-to-date or recently checked assets, never crypto, new assets or changed units", async () => {
  const { precheckSkip, lastCheckedByAsset } = await import("./portfolioV2/model.mjs");
  const now = new Date("2026-11-18T12:00:00Z"); // Wed, latest publishable 2026-11-17
  const asset = { assetId: "a", type: "MutualFund", units: 10 };
  const snap = (latestPriceDate, generatedAt, units = 10) => ({ latestPriceDate, generatedAt, asset: { units } });

  assert.equal(precheckSkip(asset, null, now), null, "no snapshot yet");
  assert.match(precheckSkip(asset, snap("2026-11-17", "2026-11-17T08:00:00Z"), now), /^Up to date · price for 2026-11-17/);
  assert.equal(precheckSkip(asset, snap("2026-11-14", "2026-11-17T08:00:00Z"), now), null, "a newer price can exist");
  assert.match(precheckSkip(asset, snap("2026-11-14", "2026-11-18T09:00:00Z"), now), /^Checked 3 h ago/);
  assert.equal(precheckSkip(asset, snap("2026-11-17", "2026-11-18T09:00:00Z", 12), now), null, "units changed");
  assert.equal(precheckSkip({ ...asset, type: "Crypto" }, snap("2026-11-18", "2026-11-18T11:30:00Z"), now), null);

  // A recent run that found no newer price counts as a check.
  const runs = [{ items: [
    { assetId: "a", type: "MutualFund", status: "no_new_data", finishedAt: "2026-11-18T10:00:00Z" },
    { assetId: "a", type: "MutualFund", status: "failed", finishedAt: "2026-11-18T11:00:00Z" },
    { assetId: "a", type: "MutualFund", status: "no_new_data", precheck: true, finishedAt: "2026-11-18T11:30:00Z" },
  ] }];
  const checked = lastCheckedByAsset(runs);
  assert.equal(checked.a, "2026-11-18T10:00:00Z", "failed and pre-checked items do not count");
  assert.match(precheckSkip(asset, snap("2026-11-14", "2026-11-16T09:00:00Z"), now, checked.a), /^Checked 2 h ago/);
});
