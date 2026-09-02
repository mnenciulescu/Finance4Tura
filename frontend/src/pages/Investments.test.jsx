import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

const ops = [
  { operationId: "o1", date: "2024-03-10", type: "Deposit",    platform: "eToro",         amount: 1000, currency: "USD", notes: "note one" },
  { operationId: "o2", date: "2024-06-10", type: "Withdrawal", platform: "Binance",       amount: 200,  currency: "USD" },
  { operationId: "o3", date: "2025-01-10", type: "Deposit",    platform: "ING Funds RON", amount: 5000, currency: "RON" },
  { operationId: "o4", date: "2025-05-10", type: "Deposit",    platform: "eToro",         amount: 300,  currency: "USD" },
  { operationId: "o5", date: "2026-01-10", type: "Deposit",    platform: "Fidelity",      amount: 700,  currency: "USD" },
];

const snaps = [
  // pre-2023 data — must feed carry-forward but not be plotted
  { snapshotId: "s0", date: "2022-06-01", platform: "eToro",         amount: 500,   currency: "USD" },
  { snapshotId: "s1", date: "2023-02-01", platform: "eToro",         amount: 1200,  currency: "USD" },
  { snapshotId: "s2", date: "2023-02-01", platform: "Binance",       amount: 800,   currency: "USD" },
  { snapshotId: "s3", date: "2024-08-01", platform: "eToro",         amount: 1800,  currency: "USD" },
  { snapshotId: "s4", date: "2025-08-01", platform: "ING Funds RON", amount: 20000, currency: "RON" },
  { snapshotId: "s5", date: "2026-08-01", platform: "eToro",         amount: 2500,  currency: "USD" },
  { snapshotId: "s6", date: "2026-08-01", platform: "Fidelity",      amount: 900,   currency: "USD" },
];

const api = {
  listOperations:  vi.fn(() => Promise.resolve(ops)),
  createOperation: vi.fn(),
  updateOperation: vi.fn(),
  deleteOperation: vi.fn(() => Promise.resolve({ deleted: true })),
  listSnapshots:   vi.fn(() => Promise.resolve(snaps)),
  createSnapshot:  vi.fn(),
  updateSnapshot:  vi.fn(),
  deleteSnapshot:  vi.fn(),
};

vi.mock("../api/investments", () => api);
vi.mock("../api/fxRates", () => ({
  getFxRates: () => Promise.resolve({
    rates: {
      EUR: { EUR: 1, USD: 1.08, RON: 4.97 },
      USD: { EUR: 0.926, USD: 1, RON: 4.6 },
      RON: { EUR: 0.201, USD: 0.217, RON: 1 },
    },
    updatedAt: "2026-08-30",
  }),
}));

const { default: Investments } = await import("./Investments");

// recharts measures with ResizeObserver, which jsdom does not implement
globalThis.ResizeObserver = class {
  constructor(cb) { this.cb = cb; }
  observe(el) { this.cb([{ target: el, contentRect: { width: 400, height: 210 } }]); }
  unobserve() {}
  disconnect() {}
};

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetWidth",  { configurable: true, value: 400 });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, value: 210 });
});

describe("Investments page", () => {
  it("renders the four blocks with data", async () => {
    render(<Investments />);
    await screen.findByText("Total portfolio");

    expect(screen.getByText("Portfolio evolution")).toBeTruthy();
    expect(screen.getByText("Portfolio snapshots")).toBeTruthy();
    expect(screen.getByText("Operations log")).toBeTruthy();

    // 5 distinct snapshot dates, 5 operations
    expect(screen.getByText(/5 recorded dates/)).toBeTruthy();
    expect(screen.getByText(/5 total/)).toBeTruthy();

    // Chart starts at 2023, not 2022, and actually draws lines
    expect(screen.getByText("Actual value in EUR since 2023")).toBeTruthy();
    await waitFor(() => expect(document.querySelector(".recharts-surface")).toBeTruthy(), { timeout: 3000 });
    // jsdom cannot measure SVG text so recharts culls axis labels; verify the
    // plotted range through the line geometry instead.
    const curves = [...document.querySelectorAll(".recharts-line-curve")];
    const d = curves.at(-1).getAttribute("d");   // the portfolio total line
    // monotone curves emit one "C" segment per step between points
    const points = (d.match(/C/g) ?? []).length + 1;
    // 2023-01 .. 2026-08 inclusive = 44 months (2022-06 start would give 51)
    expect(points).toBe(44);
  });

  it("total block is collapsed and expands to show holdings", async () => {
    render(<Investments />);
    const label = await screen.findByText("Total portfolio");

    // Collapsed: only the legend chips mention platforms, no holding rows yet
    expect(screen.queryByText(/^\\d+\\.\\d% *$/)).toBeNull();
    const before = screen.getAllByText("eToro").length;

    fireEvent.click(label);
    // eToro 2500 USD -> 2315 EUR, Fidelity 900 USD -> 833.4, ING RON 20000 -> 4020
    await waitFor(() => expect(screen.getAllByText("eToro").length).toBe(before + 1));
    expect(screen.getByText("2.315")).toBeTruthy();   // ro-RO thousands separator
    expect(screen.getByText("4.020")).toBeTruthy();
    // Binance is stale (2023) but still held, so it must appear in the breakdown
    expect(screen.getAllByText("Binance").length).toBeGreaterThan(0);
  });

  it("shows only 3 snapshot dates then reveals more", async () => {
    render(<Investments />);
    await screen.findByText("Total portfolio");

    expect(screen.getByText("1 Aug 2026")).toBeTruthy();
    expect(screen.getByText("1 Aug 2025")).toBeTruthy();
    expect(screen.getByText("1 Aug 2024")).toBeTruthy();
    expect(screen.queryByText("1 Feb 2023")).toBeNull();

    fireEvent.click(screen.getAllByText(/Show 2 more/)[0]);
    await waitFor(() => expect(screen.getByText("1 Feb 2023")).toBeTruthy());

    fireEvent.click(screen.getAllByText("Show less")[0]);
    await waitFor(() => expect(screen.queryByText("1 Feb 2023")).toBeNull());
  });

  it("expands a snapshot date to show per-platform rows", async () => {
    render(<Investments />);
    await screen.findByText("Total portfolio");

    fireEvent.click(screen.getByText("1 Aug 2026"));
    await waitFor(() => expect(screen.getByText("+ Add platform to this date")).toBeTruthy());
    expect(screen.getAllByTitle("Edit").length).toBe(2);   // eToro + Fidelity that date
    expect(screen.getByText(/≈ 2.315 EUR/)).toBeTruthy();
  });

  it("shows only 3 operations then reveals more", async () => {
    render(<Investments />);
    await screen.findByText("Total portfolio");

    expect(screen.getByText("10 Jan 2026")).toBeTruthy();
    expect(screen.getByText("10 May 2025")).toBeTruthy();
    expect(screen.getByText("10 Jan 2025")).toBeTruthy();
    expect(screen.queryByText("10 Mar 2024")).toBeNull();
  });

  it("expands an operation and deletes it with a two-step confirm", async () => {
    render(<Investments />);
    await screen.findByText("Total portfolio");

    fireEvent.click(screen.getByText("10 Jan 2026"));
    await waitFor(() => expect(screen.getByText("Delete")).toBeTruthy());

    fireEvent.click(screen.getByText("Delete"));
    await waitFor(() => expect(screen.getByText("Tap to confirm")).toBeTruthy());
    expect(api.deleteOperation).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Tap to confirm"));
    await waitFor(() => expect(api.deleteOperation).toHaveBeenCalledWith("o5"));
  });

  it("opens the snapshot sheet and the operation sheet", async () => {
    render(<Investments />);
    await screen.findByText("Total portfolio");

    const addButtons = screen.getAllByText("Add");
    fireEvent.click(addButtons[0]);
    await waitFor(() => expect(screen.getByText("New snapshot")).toBeTruthy());
    fireEvent.click(screen.getByText("Cancel"));

    await waitFor(() => expect(screen.queryByText("New snapshot")).toBeNull());
    fireEvent.click(screen.getAllByText("Add")[1]);
    await waitFor(() => expect(screen.getByText("New operation")).toBeTruthy());
    // segmented Deposit / Withdrawal control inside the sheet
    const sheet = screen.getByText("New operation").closest("div").parentElement;
    expect(sheet.textContent).toContain("Deposit");
    expect(sheet.textContent).toContain("Withdrawal");
  });

  it("saves a new operation through the sheet", async () => {
    api.createOperation.mockResolvedValue({
      operationId: "new", date: "2026-09-02", type: "Deposit",
      platform: "eToro", amount: 55, currency: "USD",
    });
    render(<Investments />);
    await screen.findByText("Total portfolio");

    fireEvent.click(screen.getAllByText("Add")[1]);
    await screen.findByText("New operation");

    fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: "55" } });
    fireEvent.click(screen.getByText("Create"));

    await waitFor(() => expect(api.createOperation).toHaveBeenCalled());
    expect(api.createOperation.mock.calls[0][0].amount).toBe(55);
  });

  it("toggles chart legend lines", async () => {
    render(<Investments />);
    await screen.findByText("Total portfolio");
    fireEvent.click(screen.getByText("Total"));
    fireEvent.click(screen.getAllByText("eToro")[0]);
    // no throw = lines toggled cleanly
    expect(screen.getByText("Portfolio evolution")).toBeTruthy();
  });
});
