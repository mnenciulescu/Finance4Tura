import { describe, it, expect, vi, afterAll } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderApp } from "../../test/utils";
import { LayoutContext } from "../../ui/layout";
import { RevealScope } from "../../ui";
import type { Pv2Asset, Pv2Run, Pv2Snapshot } from "../../types";
import { buildSeries, change, rangeStart, summarize } from "./pv2Math";
import { inferCurrency, mapRows, readFirstSheet } from "./xlsx";

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
  snapshotId: `${assetId}-${priceDate}`, assetId, runId: "r", generatedAt: `${priceDate}T09:00:00Z`, priceDate,
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

  it("summarises the last snapshot per platform, largest first, with missing prices", () => {
    const s = summarize(ASSETS, SNAPS, "2026-11-15");
    expect(s.totalEUR).toBe(160);
    expect(s.platforms.map(p => [p.platform, p.valueEUR, p.missing, p.incomplete])).toEqual([["Alpha", 110, 1, true], ["Beta", 50, 0, false]]);
    expect(s.platforms[1].stale).toBe(1);
    expect(s.platforms[0].share).toBeCloseTo(68.75);
  });
});

/* ── Excel reader ─────────────────────────────────────────────────────────── */

const enc = new TextEncoder();
async function deflateRaw(data: Uint8Array) {
  const stream = new Response(data as BodyInit).body!.pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
/** A minimal zip: `deflate` entries compressed, others stored. */
async function zip(files: Record<string, string>, deflate: string[] = []) {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = enc.encode(text);
    const method = deflate.includes(name) ? 8 : 0;
    const data = method ? await deflateRaw(raw) : raw;
    const n = enc.encode(name);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(8, method, true);
    local.setUint32(18, data.length, true); local.setUint32(22, raw.length, true); local.setUint16(26, n.length, true);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(10, method, true);
    cen.setUint32(20, data.length, true); cen.setUint32(24, raw.length, true); cen.setUint16(28, n.length, true); cen.setUint32(42, offset, true);
    parts.push(new Uint8Array(local.buffer), n, data);
    central.push(new Uint8Array(cen.buffer), n);
    offset += 30 + n.length + data.length;
  }
  const cenSize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, Object.keys(files).length, true); end.setUint16(10, Object.keys(files).length, true);
  end.setUint32(12, cenSize, true); end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let p = 0;
  for (const a of all) { out.set(a, p); p += a.length; }
  return out.buffer;
}

const strings = ["Platform", "Type", "Symbol", "Name item", "Nr. Units", "Details / ISIN", "Alpha RON", "Total", "Mutual fond", "Sample Fund RON", "Beta Broker", "ETF", "EXW", "Example World"];
const SHARED = `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${strings.map(t => `<si><t>${t}</t></si>`).join("")}</sst>`;
const c = (ref: string, v: string | number, s = true) => (s ? `<c r="${ref}" t="s"><v>${strings.indexOf(String(v))}</v></c>` : `<c r="${ref}"><v>${v}</v></c>`);
const SHEET = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="2">${c("B2", "Platform")}${c("C2", "Type")}${c("D2", "Symbol")}${c("E2", "Name item")}${c("F2", "Nr. Units")}${c("G2", "Details / ISIN")}</row>
<row r="3">${c("B3", "Alpha RON")}${c("C3", "Total")}</row>
<row r="4">${c("B4", "Alpha RON")}${c("C4", "Mutual fond")}${c("E4", "Sample Fund RON")}${c("F4", 2.809, false)}<c r="G4" t="inlineStr"><is><t>US0378331005</t></is></c></row>
<row r="5">${c("B5", "Beta Broker")}${c("C5", "ETF")}${c("D5", "EXW")}${c("E5", "Example World")}${c("F5", 64.846593, false)}</row>
</sheetData></worksheet>`;

describe("Portfolio v2 Excel import", () => {
  it("reads shared strings, inline strings and numbers from a stored or deflated sheet", async () => {
    for (const deflate of [[], ["xl/worksheets/sheet1.xml", "xl/sharedStrings.xml"]]) {
      const buf = await zip({ "xl/sharedStrings.xml": SHARED, "xl/worksheets/sheet1.xml": SHEET }, deflate);
      const grid = await readFirstSheet(buf);
      expect(grid[1].slice(1)).toEqual(["Platform", "Type", "Symbol", "Name item", "Nr. Units", "Details / ISIN"]);
      expect(grid[3][5]).toBe("2.809");
      expect(grid[3][6]).toBe("US0378331005");
    }
  });

  it("maps rows by header, keeps units as stored, and guesses currencies", async () => {
    const grid = await readFirstSheet(await zip({ "xl/sharedStrings.xml": SHARED, "xl/worksheets/sheet1.xml": SHEET }));
    const { rows, error } = mapRows(grid);
    expect(error).toBeUndefined();
    expect(rows).toEqual([
      { platform: "Alpha RON", type: "Total", symbol: "", name: "", units: null, isin: "", currency: "EUR", line: 3 },
      { platform: "Alpha RON", type: "Mutual fond", symbol: "", name: "Sample Fund RON", units: 2.809, isin: "US0378331005", currency: "RON", line: 4 },
      { platform: "Beta Broker", type: "ETF", symbol: "EXW", name: "Example World", units: 64.846593, isin: "", currency: "EUR", line: 5 },
    ]);
    expect(inferCurrency({ platform: "eToro", type: "ETF", name: "Some ETF" })).toBe("USD");
    expect(inferCurrency({ platform: "X", type: "Stock", name: "Thing GBP" })).toBe("GBP");
  });

  it("rejects files that are not spreadsheets or have no header", async () => {
    await expect(readFirstSheet(new TextEncoder().encode("hello").buffer)).rejects.toThrow(/Not an .xlsx/);
    expect(mapRows([["a", "b"]]).error).toMatch(/header row/);
  });
});

/* ── Block ────────────────────────────────────────────────────────────────── */

const RUN: Pv2Run = {
  runId: "run1", trigger: "manual", status: "completed_with_errors", startedAt: "2026-11-15T09:00:00Z", finishedAt: "2026-11-15T09:02:00Z",
  model: "claude-opus-5-5", usage: { inputTokens: 12000, outputTokens: 800, webSearches: 6 },
  summary: { updated: 1, noNewData: 0, notFound: 1, failed: 1, skipped: 0 },
  items: [
    { assetId: "a1", name: "World ETF", platform: "Alpha", type: "ETF", status: "updated", unitPrice: 11, currency: "USD", priceDate: "2026-11-13", valueEUR: 110, sourceUrl: "https://example.com/p" },
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
    api.retry.mockResolvedValue({ ...RUN, status: "running" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Retry 2 Failed" }));
    await waitFor(() => expect(api.retry).toHaveBeenCalledWith("run1", ["a2", "b1"]));
  });
});
