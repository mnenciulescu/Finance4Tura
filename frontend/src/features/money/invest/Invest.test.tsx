import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderApp } from "../../../test/utils";
import { buildChart, groupSnapshots } from "./investMath";

vi.setSystemTime(new Date("2026-09-15T10:00:00Z"));
afterAll(() => vi.useRealTimers());

const fx = { rates: { USD: { EUR: 0.9, USD: 1, RON: 4.6 }, RON: { EUR: 0.2 }, EUR: { EUR: 1 } }, updatedAt: "2026-09-10T00:00:00Z" };
const snaps = [
  { snapshotId: "s1", date: "2026-09-01", platform: "eToro", amount: 1000, currency: "USD" },
  { snapshotId: "s2", date: "2026-09-01", platform: "ING Funds EUR", amount: 600, currency: "EUR" },
  { snapshotId: "s3", date: "2026-06-01", platform: "eToro", amount: 900, currency: "USD" },
  { snapshotId: "s4", date: "2026-03-01", platform: "eToro", amount: 800, currency: "USD" },
  { snapshotId: "s5", date: "2025-12-01", platform: "eToro", amount: 700, currency: "USD" },
  { snapshotId: "s6", date: "2022-06-01", platform: "Binance", amount: 0, currency: "USD" },
];
const ops = [
  { operationId: "o1", date: "2026-08-01", type: "Deposit", platform: "eToro", amount: 100, currency: "USD", notes: "Top-up" },
  { operationId: "o2", date: "2026-05-01", type: "Withdrawal", platform: "eToro", amount: 50, currency: "USD" },
  { operationId: "o3", date: "2026-02-01", type: "Deposit", platform: "eToro", amount: 50, currency: "USD" },
  { operationId: "o4", date: "2025-11-01", type: "Deposit", platform: "eToro", amount: 50, currency: "USD" },
];
let opStore: any[] = [];
const createOperation = vi.fn((b: any) => Promise.resolve({ ...b, operationId: "new" }));
const deleteOperation = vi.fn((id: string) => { opStore = opStore.filter(o => o.operationId !== id); return Promise.resolve({}); });
vi.mock("../../../api/investments", async orig => ({
  ...(await orig<object>()),
  listSnapshots: () => Promise.resolve(snaps),
  listOperations: () => Promise.resolve(opStore.map(o => ({ ...o }))),
  createOperation: (...a: any[]) => (createOperation as any)(...a),
  deleteOperation: (...a: any[]) => (deleteOperation as any)(...a),
}));
vi.mock("../../../api/fxRates", async orig => ({ ...(await orig<object>()), getFxRates: () => Promise.resolve(fx) }));

const { default: InvestScreen } = await import("./InvestScreen");

beforeEach(() => { opStore = ops.map(o => ({ ...o })); createOperation.mockClear(); deleteOperation.mockClear(); });

describe("investment maths (unchanged)", () => {
  it("never plots before 2023-01 but carries earlier snapshots forward", () => {
    const { data } = buildChart(snaps as any, ops as any, fx.rates as any);
    expect(data[0].date >= "2023-01").toBe(true);
    expect(data.at(-1)!.date).toBe("2026-09");
  });

  it("groups snapshots by date with the carry-forward EUR total", () => {
    const groups = groupSnapshots(snaps as any, fx.rates as any);
    expect(groups[0].date).toBe("2026-09-01");
    expect(groups[0].totalEUR).toBeCloseTo(1000 * 0.9 + 600);
  });
});

describe("Invest screen", () => {
  it("shows the header counts and the total, holdings collapsed until tapped", async () => {
    renderApp(<InvestScreen />);
    expect(await screen.findByText("5 snapshots · 4 operations")).toBeInTheDocument();
    const total = screen.getByRole("region", { name: "Total portfolio" });
    expect(within(total).getByText(/1\.500/)).toBeInTheDocument();
    expect(within(total).getByText(/2 platforms · FX 10 Sep 2026/)).toBeInTheDocument();
    expect(within(total).queryByRole("list", { name: "Holdings" })).toBeNull();
    fireEvent.click(within(total).getByRole("button", { expanded: false }));
    const holdings = within(total).getByRole("list", { name: "Holdings" });
    expect(within(holdings).getByText("60.0%")).toBeInTheDocument();
  });

  it("shows three snapshot dates, then three more, then back", async () => {
    renderApp(<InvestScreen />);
    await screen.findByText("5 snapshots · 4 operations");
    expect(document.querySelectorAll("[data-snapshot-date]")).toHaveLength(3);
    fireEvent.click(screen.getAllByRole("button", { name: /Show 2 More/ })[0]);
    expect(document.querySelectorAll("[data-snapshot-date]")).toHaveLength(5);
    fireEvent.click(screen.getAllByRole("button", { name: "Show Less" })[0]);
    expect(document.querySelectorAll("[data-snapshot-date]")).toHaveLength(3);
  });

  it("shows three operations newest first, expands notes, and deletes with a confirmation", async () => {
    renderApp(<InvestScreen />);
    await screen.findByText("5 snapshots · 4 operations");
    const cards = [...document.querySelectorAll("[data-operation]")].map(c => c.getAttribute("data-operation"));
    expect(cards).toEqual(["o1", "o2", "o3"]);
    const first = document.querySelector('[data-operation="o1"]') as HTMLElement;
    fireEvent.click(within(first).getByRole("button", { expanded: false }));
    expect(within(first).getByText("Top-up")).toBeInTheDocument();
    fireEvent.click(within(first).getByRole("button", { name: "Delete" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete Operation" }));
    await waitFor(() => expect(deleteOperation).toHaveBeenCalledWith("o1"));
  });

  it("toggles chart lines from the legend chips", async () => {
    renderApp(<InvestScreen />);
    await screen.findByText("5 snapshots · 4 operations");
    const total = screen.getByRole("button", { name: /Total/, pressed: true });
    fireEvent.click(total);
    expect(total).toHaveAttribute("aria-pressed", "false");
    const etoro = screen.getByRole("button", { name: /eToro/, pressed: false });
    fireEvent.click(etoro);
    expect(etoro).toHaveAttribute("aria-pressed", "true");
  });

  it("saves a new operation through the sheet, pre-filling the platform's currency", async () => {
    renderApp(<InvestScreen />);
    await screen.findByText("5 snapshots · 4 operations");
    // The nav-bar + comes first; the section headers carry their own Add.
    fireEvent.click(screen.getAllByRole("button", { name: "Add" })[0]);
    fireEvent.click(await screen.findByRole("menuitem", { name: "New Operation" }));
    const sheet = await screen.findByRole("dialog", { name: "New Operation" });
    fireEvent.change(within(sheet).getByRole("textbox", { name: "Amount" }), { target: { value: "250" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(createOperation).toHaveBeenCalledWith(expect.objectContaining({ type: "Deposit", platform: "eToro", currency: "USD", amount: 250 })));
  });
});
