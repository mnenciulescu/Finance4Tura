import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderApp } from "../../../test/utils";
import type { Pv2Asset, Pv2Run, Pv2Snapshot } from "../../../types";

/* Money → Invest on the phone: Portfolio v2 plus the operations. Invented data only. */

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
const RUN: Pv2Run = {
  runId: "run1", trigger: "manual", status: "completed_with_errors", startedAt: "2026-11-15T09:00:00Z", finishedAt: "2026-11-15T09:02:00Z",
  model: "claude-opus-5-5", usage: { inputTokens: 12000, cacheReadTokens: 30000, cacheWriteTokens: 4000, outputTokens: 800, webSearches: 6, webFetches: 9 },
  summary: { updated: 1, noNewData: 0, notFound: 1, failed: 1, skipped: 0 },
  items: [
    { assetId: "a1", name: "World ETF", platform: "Alpha", type: "ETF", status: "updated", unitPrice: 11, currency: "USD", latestPriceDate: "2026-11-13", valueEUR: 110, sourceUrl: "https://example.com/p",
      usage: { inputTokens: 300, cacheReadTokens: 20000, cacheWriteTokens: 8000, outputTokens: 500, webSearches: 1, webFetches: 2, requests: 1 } },
    { assetId: "a2", name: "Unpriced Co", platform: "Alpha", type: "Stock", status: "failed", message: "AI rate limit reached — retry in a minute" },
    { assetId: "b1", name: "Balanced Fund", platform: "Beta", type: "MutualFund", status: "not_found", message: "No confirmed price found" },
    { assetId: "t1", name: "Alpha total", platform: "Alpha", type: "Total", status: "updated", valueEUR: 110, message: "Sum of 1 asset" },
  ],
};
const ops = [
  { operationId: "o1", date: "2026-08-01", type: "Deposit", platform: "eToro", amount: 100, currency: "USD", notes: "Top-up" },
  { operationId: "o2", date: "2026-05-01", type: "Withdrawal", platform: "eToro", amount: 50, currency: "USD" },
  { operationId: "o3", date: "2026-02-01", type: "Deposit", platform: "eToro", amount: 50, currency: "USD" },
  { operationId: "o4", date: "2025-11-01", type: "Deposit", platform: "eToro", amount: 50, currency: "USD" },
];

const api = vi.hoisted(() => ({ start: vi.fn(), retry: vi.fn(), getRun: vi.fn() }));
vi.mock("../../../api/portfolioV2", async orig => ({
  ...(await orig<object>()),
  listPv2Assets: () => Promise.resolve(ASSETS),
  listPv2Snapshots: () => Promise.resolve(SNAPS),
  listPv2Runs: () => Promise.resolve([]),
  getPv2AiConfig: () => Promise.resolve({ configured: true, keyUpdatedAt: "2026-11-01T00:00:00Z", model: "claude-opus-5-5", maxSearches: 5, enabled: true }),
  startPv2Run: api.start,
  getPv2Run: (...a: unknown[]) => api.getRun(...a),
  retryPv2Run: api.retry,
}));
let opStore: any[] = [];
const createOperation = vi.fn((b: any) => Promise.resolve({ ...b, operationId: "new" }));
const deleteOperation = vi.fn((id: string) => { opStore = opStore.filter(o => o.operationId !== id); return Promise.resolve({}); });
vi.mock("../../../api/investments", async orig => ({
  ...(await orig<object>()),
  listOperations: () => Promise.resolve(opStore.map(o => ({ ...o }))),
  createOperation: (...a: any[]) => (createOperation as any)(...a),
  deleteOperation: (...a: any[]) => (deleteOperation as any)(...a),
}));
vi.mock("../../../api/fxRates", async orig => ({
  ...(await orig<object>()),
  getFxRates: () => Promise.resolve({ rates: { USD: { EUR: 0.9, USD: 1 }, EUR: { EUR: 1 } }, updatedAt: "2026-11-10T00:00:00Z" }),
}));

const { default: InvestScreen } = await import("./InvestScreen");

beforeEach(() => { opStore = ops.map(o => ({ ...o })); createOperation.mockClear(); deleteOperation.mockClear(); });

const ready = () => screen.findByText("3 assets · 2 platforms");

describe("Money → Invest (Portfolio v2 on the phone)", () => {
  it("masks the total until the eye is tapped, then masks it again on the next tap", async () => {
    renderApp(<InvestScreen />);
    await ready();
    const total = screen.getByRole("region", { name: "Portfolio v2 total" });
    expect(within(total).getByRole("img", { name: "Hidden amount" })).toBeInTheDocument();
    expect(within(total).getByText(/FX 10 Nov 2026/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show amounts" }));
    expect(within(total).getByText("160")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hide amounts" }));
    expect(within(total).queryByText("160")).toBeNull();
  });

  it("lists the last snapshot per platform by value, badges under the name, and expands a platform", async () => {
    renderApp(<InvestScreen />);
    await ready();
    const last = screen.getByRole("region", { name: "Last snapshot" });
    expect([...last.querySelectorAll("[data-platform]")].map(r => r.getAttribute("data-platform"))).toEqual(["Alpha", "Beta"]);
    const alpha = within(last).getByRole("button", { name: /^Alpha/ });
    // On the phone the badge sits in the name column, not beside the value.
    expect(within(alpha).getByText("1 unpriced").closest("[class*=rowMain]")).not.toBeNull();
    fireEvent.click(alpha);
    const list = screen.getByRole("list", { name: "Alpha assets" });
    expect(within(list).getByText(/WLD · World ETF/)).toBeInTheDocument();
    expect(within(list).getByText("No price yet — generate a snapshot.")).toBeInTheDocument();
  });

  it("toggles chart lines from the chips", async () => {
    renderApp(<InvestScreen />);
    await ready();
    const lines = screen.getByRole("group", { name: "Chart lines" });
    const total = within(lines).getByRole("button", { name: /Total/, pressed: true });
    fireEvent.click(total);
    expect(total).toHaveAttribute("aria-pressed", "false");
    const alpha = within(lines).getByRole("button", { name: /Alpha/, pressed: false });
    fireEvent.click(alpha);
    expect(alpha).toHaveAttribute("aria-pressed", "true");
  });

  it("generates a snapshot and shows the run as a stacked list with per-asset status, cost and Retry", async () => {
    api.start.mockResolvedValue({ ...RUN, status: "running" });
    api.getRun.mockResolvedValue(RUN);
    renderApp(<InvestScreen />);
    await ready();
    const generate = screen.getByRole("button", { name: "Generate Snapshot" });
    await waitFor(() => expect(generate).toBeEnabled());
    fireEvent.click(generate);
    const confirm = await screen.findByRole("dialog", { name: /Look up prices for 3 assets/ });
    fireEvent.click(within(confirm).getByRole("button", { name: "Generate Snapshot" }));
    await waitFor(() => expect(api.start).toHaveBeenCalledWith({}));
    const dialog = await screen.findByRole("dialog", { name: /Snapshot run|Generating snapshot/ });
    const list = await within(dialog).findByRole("list", { name: "Assets in this run" });
    expect(within(dialog).queryByRole("table")).toBeNull();
    expect(list.querySelector('[data-status="failed"]')).toHaveTextContent("AI rate limit reached");
    expect(list.querySelector('[data-status="not_found"]')).toHaveTextContent("No confirmed price found");
    expect(list.querySelector('[data-status="updated"] [data-usage]')).toHaveTextContent("29k tokens · 1 search · 2 fetches · ≈ $0.065");
    expect(within(dialog).getByLabelText("Tokens used")).toHaveTextContent("Tokens: 46,800 · ≈ $0.15");
    api.retry.mockResolvedValue({ ...RUN, status: "running" });
    fireEvent.click(within(list.querySelector('[data-status="failed"]') as HTMLElement).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(api.retry).toHaveBeenCalledWith("run1", ["a2"]));
  });

  it("shows three operations newest first, masked, and deletes one with a confirmation", async () => {
    renderApp(<InvestScreen />);
    await ready();
    await waitFor(() => expect(document.querySelectorAll("[data-operation]")).toHaveLength(3));
    expect([...document.querySelectorAll("[data-operation]")].map(c => c.getAttribute("data-operation"))).toEqual(["o1", "o2", "o3"]);
    const first = document.querySelector('[data-operation="o1"]') as HTMLElement;
    expect(within(first).getByRole("img", { name: "Hidden amount" })).toBeInTheDocument();
    fireEvent.click(within(first).getByRole("button", { expanded: false }));
    expect(within(first).getByText("Top-up")).toBeInTheDocument();
    fireEvent.click(within(first).getByRole("button", { name: "Delete" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete Operation" }));
    await waitFor(() => expect(deleteOperation).toHaveBeenCalledWith("o1"));
  });

  it("adds an operation from the + menu, pre-filling the platform's currency", async () => {
    renderApp(<InvestScreen />);
    await ready();
    fireEvent.click(screen.getAllByRole("button", { name: "Add" })[0]);
    fireEvent.click(await screen.findByRole("menuitem", { name: "New Operation" }));
    const sheet = await screen.findByRole("dialog", { name: "New Operation" });
    fireEvent.change(within(sheet).getByRole("textbox", { name: "Amount" }), { target: { value: "250" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(createOperation).toHaveBeenCalledWith(expect.objectContaining({ type: "Deposit", platform: "eToro", currency: "USD", amount: 250 })));
  });

  it("keeps the asset list collapsed until its section is opened, Total first per platform", async () => {
    renderApp(<InvestScreen />);
    await ready();
    expect(screen.queryByRole("list", { name: "Asset list" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Assets · 3/ }));
    const list = screen.getByRole("list", { name: "Asset list" });
    expect([...list.querySelectorAll("[data-asset-row]")].map(r => r.getAttribute("data-asset-row"))).toEqual(["t1", "a1", "a2", "t2", "b1"]);
    fireEvent.click(screen.getAllByRole("button", { name: "Add" }).at(-1)!);
    expect(await screen.findByRole("dialog", { name: "New Asset" })).toBeInTheDocument();
  });
});
