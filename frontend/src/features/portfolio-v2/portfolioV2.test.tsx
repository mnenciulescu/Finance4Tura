import { describe, it, expect, vi, afterAll } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderApp } from "../../test/utils";
import { LayoutContext } from "../../ui/layout";
import { RevealScope } from "../../ui";
import type { Pv2Asset, Pv2Run, Pv2Snapshot } from "../../types";
import { buildSeries, change, rangeStart, summarize } from "./pv2Math";

/* Invented data only. */

vi.setSystemTime(new Date("2026-11-15T10:00:00Z"));
afterAll(() => vi.useRealTimers());

const asset = (over: Partial<Pv2Asset>): Pv2Asset => ({
  assetId: "x", platform: "P", type: "ETF", symbol: null, name: "N", units: 1, isin: null, currency: "EUR",
  preferredSources: [], notes: null, order: 0, active: true, ...over,
});
const ASSETS: Pv2Asset[] = [
  asset({ assetId: "t1", platform: "Alpha", type: "Total", name: "Alpha total", units: null, order: -1 }),
  asset({ assetId: "a1", platform: "Alpha", type: "ETF", name: "World ETF", symbol: "WLD", units: 10, currency: "USD" }),
  asset({ assetId: "a2", platform: "Alpha", type: "Stock", name: "Unpriced Co", symbol: "UNP", units: 3, currency: "USD", order: 1 }),
  asset({ assetId: "t2", platform: "Beta", type: "Total", name: "Beta total", units: null, order: -1 }),
  asset({ assetId: "b1", platform: "Beta", type: "MutualFund", name: "Balanced Fund", units: 2.809, currency: "RON" }),
];
const snap = (assetId: string, priceDate: string, valueEUR: number, over: Partial<Pv2Snapshot> = {}): Pv2Snapshot => ({
  snapshotId: `${assetId}-${priceDate}`, assetId, runId: "r", generatedAt: `${priceDate}T09:00:00Z`, latestPriceDate: priceDate,
  asset: { platform: "", type: "ETF", symbol: null, name: "", units: 10, isin: null, currency: "USD" },
  currency: "USD", unitPrice: 10, value: 100, fxRate: 0.9, fxDate: null, valueEUR, sources: [], confidence: "official",
  comments: null, source: "agent", ...over,
});
const SNAPS: Pv2Snapshot[] = [
  snap("a1", "2026-08-01", 90), snap("t1", "2026-08-01", 90, { unitPrice: null, source: "computed" }),
  snap("b1", "2026-10-01", 50, { currency: "RON" }), snap("t2", "2026-10-01", 50, { unitPrice: null, source: "computed" }),
  snap("a1", "2026-11-13", 110), snap("t1", "2026-11-13", 110, { unitPrice: null, source: "computed", incomplete: true }),
];

describe("Portfolio v2 math", () => {
  it("computes range starts", () => {
    expect(rangeStart("1w", "2026-11-15")).toBe("2026-11-08");
    expect(rangeStart("1m", "2026-11-15")).toBe("2026-10-15");
    expect(rangeStart("3m", "2026-11-15")).toBe("2026-08-15");
    expect(rangeStart("1y", "2026-11-15")).toBe("2025-11-15");
    expect(rangeStart("all", "2026-11-15")).toBeNull();
  });

  it("builds a carried-forward series from platform Totals, starting at the range start", () => {
    const all = buildSeries(ASSETS, SNAPS, "all", "2026-11-15");
    expect(all.platforms).toEqual(["Alpha", "Beta"]);
    expect(all.data.map(d => [d.date, d.Alpha, d.Beta, d.Total])).toEqual([
      ["2026-08-01", 90, null, 90],
      ["2026-10-01", 90, 50, 140],
      ["2026-11-13", 110, 50, 160],
      ["2026-11-15", 110, 50, 160],
    ]);
    const m1 = buildSeries(ASSETS, SNAPS, "1m", "2026-11-15");
    expect(m1.data[0]).toMatchObject({ date: "2026-10-15", Alpha: 90, Beta: 50, Total: 140 });
    expect(change(m1.data, "Total")).toEqual({ abs: 20, pct: (20 / 140) * 100 });
  });

  it("marks the days with a snapshot (chart points), not the range start or today", () => {
    expect(buildSeries(ASSETS, SNAPS, "all", "2026-11-15").data.map(d => [d.date, d.snapped])).toEqual([
      ["2026-08-01", "Alpha"],
      ["2026-10-01", "Beta"],
      ["2026-11-13", "Alpha"],
      ["2026-11-15", ""],
    ]);
    expect(buildSeries(ASSETS, SNAPS, "1m", "2026-11-15").data[0]).toMatchObject({ date: "2026-10-15", snapped: "" });
  });

  it("summarises the last snapshot per platform, largest first, with missing prices", () => {
    const s = summarize(ASSETS, SNAPS, "2026-11-15");
    expect(s.totalEUR).toBe(160);
    expect(s.platforms.map(p => [p.platform, p.valueEUR, p.missing, p.incomplete])).toEqual([["Alpha", 110, 1, true], ["Beta", 50, 0, false]]);
    expect(s.platforms[1].stale).toBe(1);
    expect(s.platforms[0].share).toBeCloseTo(68.75);
  });

  it("imported history: archived platforms end their line and leave the last snapshot", () => {
    const assets = [
      ...ASSETS,
      asset({ assetId: "t3", platform: "Gamma", type: "Total", name: "Gamma total", units: null, order: -1, active: false }),
    ];
    const legacy = { unitPrice: null, source: "legacy" as const };
    const snaps = [
      snap("t1", "2026-06-01", 70, legacy), snap("t3", "2026-06-01", 30, legacy), snap("t3", "2026-09-01", 0, legacy),
      ...SNAPS,
    ];
    const all = buildSeries(assets, snaps, "all", "2026-11-15");
    expect(all.data.map(d => [d.date, d.Alpha, d.Gamma, d.Total, d.imported])).toEqual([
      ["2026-06-01", 70, 30, 100, "Alpha,Gamma"],
      ["2026-08-01", 90, 30, 120, "Gamma"],
      ["2026-09-01", 90, 0, 90, "Gamma"],
      ["2026-10-01", 90, null, 140, ""],
      ["2026-11-13", 110, null, 160, ""],
      ["2026-11-15", 110, null, 160, ""],
    ]);
    const s = summarize(assets, snaps, "2026-11-15");
    expect(s.platforms.map(p => p.platform)).toEqual(["Alpha", "Beta"]);
    expect(s.totalEUR).toBe(160);

    // An active platform whose latest Total is imported (no assets yet).
    const delta = [...ASSETS, asset({ assetId: "t4", platform: "Delta", type: "Total", name: "Delta total", units: null, order: -1 })];
    const d = summarize(delta, [...SNAPS, snap("t4", "2026-10-09", 40, legacy)], "2026-11-15");
    expect(d.platforms.find(p => p.platform === "Delta")).toMatchObject({ valueEUR: 40, imported: true, rows: [] });
    expect(d.totalEUR).toBe(200);
  });
});

/* ── Block ────────────────────────────────────────────────────────────────── */

const RUN: Pv2Run = {
  runId: "run1", trigger: "manual", status: "completed_with_errors", startedAt: "2026-11-15T09:00:00Z", finishedAt: "2026-11-15T09:02:00Z",
  model: "claude-opus-5-5", usage: { inputTokens: 12000, cacheReadTokens: 30000, cacheWriteTokens: 4000, outputTokens: 800, webSearches: 6 },
  summary: { updated: 1, noNewData: 0, notFound: 1, failed: 1, skipped: 0 },
  items: [
    { assetId: "a1", name: "World ETF", platform: "Alpha", type: "ETF", status: "updated", unitPrice: 11, currency: "USD", latestPriceDate: "2026-11-13", valueEUR: 110, sourceUrl: "https://example.com/p" },
    { assetId: "a2", name: "Unpriced Co", platform: "Alpha", type: "Stock", status: "failed", message: "AI rate limit reached — retry in a minute" },
    { assetId: "b1", name: "Balanced Fund", platform: "Beta", type: "MutualFund", status: "not_found", message: "No confirmed price found" },
    { assetId: "t1", name: "Alpha total", platform: "Alpha", type: "Total", status: "updated", valueEUR: 110, message: "Sum of 1 asset" },
  ],
};
const api = vi.hoisted(() => ({ start: vi.fn(), retry: vi.fn() }));
vi.mock("../../api/portfolioV2", async orig => ({
  ...(await orig<object>()),
  listPv2Assets: () => Promise.resolve(ASSETS),
  listPv2Snapshots: () => Promise.resolve(SNAPS),
  listPv2Runs: () => Promise.resolve([]),
  getPv2AiConfig: () => Promise.resolve({ configured: true, keyUpdatedAt: "2026-11-01T00:00:00Z", model: "claude-opus-5-5", maxSearches: 5, enabled: true }),
  startPv2Run: api.start,
  getPv2Run: () => Promise.resolve(RUN),
  retryPv2Run: api.retry,
}));
vi.mock("../../api/fxRates", async orig => ({ ...(await orig<object>()), getFxRates: () => Promise.resolve({ rates: null, updatedAt: null }) }));

const { PortfolioV2Block } = await import("../one-page/blocks/PortfolioV2Block");
const renderBlock = () => renderApp(
  <LayoutContext.Provider value="desk"><RevealScope><PortfolioV2Block /></RevealScope></LayoutContext.Provider>,
  { route: "/one-page" },
);

describe("Portfolio v2 block", () => {
  it("masks the total until the holdings eye is on and lists platforms by value", async () => {
    renderBlock();
    const total = await screen.findByLabelText("Portfolio v2 total");
    expect(within(total).getByRole("img", { name: "Hidden amount" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show amounts" }));
    expect(within(total).getByText("160")).toBeInTheDocument();
    const rows = screen.getByRole("region", { name: "Last snapshot" }).querySelectorAll("[data-platform]");
    expect([...rows].map(r => r.getAttribute("data-platform"))).toEqual(["Alpha", "Beta"]);
    expect(screen.getByText("1 unpriced")).toBeInTheDocument();
  });

  it("expands a platform to each asset's computed value and source", async () => {
    renderBlock();
    fireEvent.click(await screen.findByRole("button", { name: "Show amounts" }));
    fireEvent.click(within(screen.getByRole("region", { name: "Last snapshot" })).getByRole("button", { name: /^Alpha/ }));
    const list = screen.getByRole("list", { name: "Alpha assets" });
    expect(within(list).getByText(/WLD · World ETF/)).toBeInTheDocument();
    expect(within(list).getByText("No price yet — generate a snapshot.")).toBeInTheDocument();
  });

  it("generates a snapshot after confirming and shows each asset's status, failures highlighted", async () => {
    api.start.mockResolvedValue({ ...RUN, status: "running" });
    renderBlock();
    const generate = await screen.findByRole("button", { name: "Generate Snapshot" });
    await waitFor(() => expect(generate).toBeEnabled());
    fireEvent.click(generate);
    // The confirmation's own "Generate Snapshot" choice.
    const confirm = await screen.findByRole("alertdialog", { name: /Look up prices for 3 assets/ });
    fireEvent.click(within(confirm).getByRole("button", { name: "Generate Snapshot" }));
    await waitFor(() => expect(api.start).toHaveBeenCalled());
    const dialog = await screen.findByRole("dialog", { name: /Snapshot run|Generating snapshot/ });
    await waitFor(() => expect(within(dialog).getAllByRole("row").length).toBeGreaterThan(4));
    const failed = dialog.querySelector('[data-status="failed"]')!;
    expect(failed).toHaveTextContent("AI rate limit reached");
    expect(dialog.querySelector('[data-status="not_found"]')).toHaveTextContent("No confirmed price found");
    expect(within(dialog).getByRole("button", { name: "Retry 2 Failed" })).toBeInTheDocument();
    const used = within(dialog).getByLabelText("Tokens used");
    expect(used).toHaveTextContent("Tokens: 46,800");
    expect(used).toHaveTextContent("16,000 input · 30,000 cached · 800 output");
    expect(used).toHaveTextContent("6 web searches · claude-opus-5-5");
    api.retry.mockResolvedValue({ ...RUN, status: "running" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Retry 2 Failed" }));
    await waitFor(() => expect(api.retry).toHaveBeenCalledWith("run1", ["a2", "b1"]));
  });
});
