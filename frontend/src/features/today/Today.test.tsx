import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderApp } from "../../test/utils";

vi.setSystemTime(new Date("2026-09-15T10:00:00Z"));
afterAll(() => vi.useRealTimers());

// 2026-09-01 is the latest income on or before "today": the current period.
const incomes = [
  { incomeId: "n1", date: "2026-08-01", summary: "Salary Aug", amount: 10000, currency: "RON" },
  { incomeId: "n2", date: "2026-09-01", summary: "Salary Sep", amount: 10000, currency: "RON" },
];

// Priority order and date order disagree (by date: Rent, Netflix, Petrol; by
// priority: Rent, Petrol, Netflix), so ordering cannot pass by accident. Plus a
// completed item (never listed) and one from the previous period.
const SEED = [
  { expenseId: "x1", date: "2026-09-03", summary: "Rent", amount: 4000, priority: "High", status: "Pending", mappedIncomeId: "n2" },
  { expenseId: "x2", date: "2026-09-05", summary: "Netflix", amount: 60, priority: "Low", status: "Pending", mappedIncomeId: "n2" },
  { expenseId: "x3", date: "2026-09-07", summary: "Petrol", amount: 300, priority: "Medium", status: "Pending", mappedIncomeId: "n2" },
  { expenseId: "x5", date: "2026-09-02", summary: "Insurance", amount: 500, priority: "High", status: "Completed", mappedIncomeId: "n2" },
  { expenseId: "x4", date: "2026-08-04", summary: "Old bill", amount: 99, priority: "High", status: "Pending", mappedIncomeId: "n1" },
];

let store: any[] = [];
const updateExpense = vi.fn((id: string, body: any) => {
  store = store.map(e => (e.expenseId === id ? { ...e, ...body } : e));
  return Promise.resolve({});
});
let pv2Assets: any[] = [];
let pv2Snaps: any[] = [];

vi.mock("../../api/incomes", () => ({ listIncomes: () => Promise.resolve(incomes) }));
vi.mock("../../api/expenses", () => ({ listExpenses: () => Promise.resolve(store.map(e => ({ ...e }))), updateExpense: (...a: any[]) => (updateExpense as any)(...a) }));
vi.mock("../../api/splitPayments", () => ({ listSplitPayments: () => Promise.resolve([]), updateSplitPayment: vi.fn() }));
vi.mock("../../api/booksAndDev", () => ({ listBooks: () => Promise.resolve([]) }));
vi.mock("../../api/portfolioV2", () => ({ listPv2Assets: () => Promise.resolve(pv2Assets), listPv2Snapshots: () => Promise.resolve(pv2Snaps) }));
vi.mock("../../api/fxRates", () => ({ getFxRates: () => Promise.resolve({ rates: { USD: { EUR: 0.9 } }, updatedAt: "2026-09-10T00:00:00Z" }) }));

const { default: Today } = await import("./Today");

const renderToday = () => renderApp(<Today />);
const order = () => [...document.querySelectorAll("[data-expense]")].map(el => store.find(e => e.expenseId === el.getAttribute("data-expense"))?.summary);
const row = (name: string) => document.querySelector(`[data-expense="${store.find(e => e.summary === name).expenseId}"]`) as HTMLElement;
const checkbox = (name: string) => within(row(name)).getByRole("checkbox");

beforeEach(() => {
  updateExpense.mockClear();
  store = SEED.map(e => ({ ...e }));
  pv2Assets = [];
  pv2Snaps = [];
  vi.setSystemTime(new Date("2026-09-15T10:00:00Z"));
});

describe("Today — This Period", () => {
  it("lists only what is still to pay in the current period", async () => {
    renderToday();
    await screen.findByText("Rent");
    expect(screen.getByText("Salary Sep")).toBeInTheDocument();
    expect(screen.queryByText("Insurance")).toBeNull();
    expect(screen.queryByText("Old bill")).toBeNull();
  });

  it("orders by priority then date, like Budget", async () => {
    renderToday();
    await screen.findByText("Rent");
    expect(order()).toEqual(["Rent", "Petrol", "Netflix"]);
  });

  it("shows a distinct message once everything is paid", async () => {
    store = store.map(e => (e.mappedIncomeId === "n2" ? { ...e, status: "Completed" } : e));
    renderToday();
    expect(await screen.findByText("Nothing left to pay.")).toBeInTheDocument();
  });

  it("shows the empty message when the period has no expenses", async () => {
    store = store.filter(e => e.mappedIncomeId !== "n2");
    renderToday();
    expect(await screen.findByText("No expenses for this period.")).toBeInTheDocument();
  });
});

describe("Today — ticking an expense", () => {
  it("keeps the row on screen, struck through, so a mistap can be undone", async () => {
    renderToday();
    await screen.findByText("Rent");
    fireEvent.click(checkbox("Rent"));
    await waitFor(() => expect(row("Rent")).toHaveAttribute("data-status", "Completed"));
    expect(updateExpense).toHaveBeenCalledWith("x1", expect.objectContaining({ status: "Completed" }));
    fireEvent.click(checkbox("Rent"));
    await waitFor(() => expect(updateExpense).toHaveBeenLastCalledWith("x1", expect.objectContaining({ status: "Pending" })));
    expect(row("Rent")).toHaveAttribute("data-status", "Pending");
  });

  it("holds the row's position rather than moving it", async () => {
    renderToday();
    await screen.findByText("Rent");
    const before = order();
    fireEvent.click(checkbox("Rent"));
    expect(order()).toEqual(before);
  });

  it("drops the row only once the screen is loaded again", async () => {
    const first = renderToday();
    await screen.findByText("Rent");
    fireEvent.click(checkbox("Rent"));
    await waitFor(() => expect(updateExpense).toHaveBeenCalled());
    expect(screen.getByText("Rent")).toBeInTheDocument();
    first.unmount();
    renderToday();
    await screen.findByText("Petrol");
    expect(screen.queryByText("Rent")).toBeNull();
    expect(order()).toEqual(["Petrol", "Netflix"]);
  });

  it("moves the amount between Done and Pending, counting unlisted completed items", async () => {
    renderToday();
    await screen.findByText("Rent");
    expect(screen.getByRole("group", { name: /^Done/ })).toHaveTextContent("500");
    expect(screen.getByRole("group", { name: /^Pending/ })).toHaveTextContent("4.360");
    fireEvent.click(checkbox("Rent"));
    await waitFor(() => expect(screen.getByRole("group", { name: /^Done/ })).toHaveTextContent("4.500"));
    expect(screen.getByRole("group", { name: /^Pending/ })).toHaveTextContent("360");
  });

  it("reverts the tick when the save fails", async () => {
    updateExpense.mockImplementationOnce(() => Promise.reject(new Error("offline")));
    renderToday();
    await screen.findByText("Rent");
    fireEvent.click(checkbox("Rent"));
    await waitFor(() => expect(row("Rent")).toHaveAttribute("data-status", "Pending"));
  });
});

describe("Today — Holdings", () => {
  it("shows the Portfolio v2 total and platforms, masked until the eye is held", async () => {
    const total = (assetId: string, platform: string) => ({ assetId, platform, type: "Total", name: `${platform} total`, units: null, currency: "EUR", order: -1, active: true });
    pv2Assets = [total("t1", "eToro"), total("t2", "ING Funds EUR")];
    const snap = (assetId: string, valueEUR: number) => ({ snapshotId: assetId, assetId, generatedAt: "2026-09-01T09:00:00Z", latestPriceDate: "2026-09-01", valueEUR, source: "computed", sources: [] });
    pv2Snaps = [snap("t1", 900), snap("t2", 500)];
    renderToday();
    const widget = await screen.findByRole("region", { name: "Holdings" });
    expect((await within(widget).findAllByRole("img", { name: "Hidden amount" })).length).toBeGreaterThan(2);
    expect(within(widget).queryByText("1.400")).toBeNull();
    expect([...widget.querySelectorAll("[data-platform]")].map(r => r.getAttribute("data-platform"))).toEqual(["eToro", "ING Funds EUR"]);
    const eye = within(widget).getByRole("button", { name: "Hold to reveal amounts" });
    fireEvent.pointerDown(eye);
    expect(within(widget).getByText("1.400")).toBeInTheDocument(); // 900 + 500
    fireEvent.pointerUp(eye);
    expect(within(widget).queryByText("1.400")).toBeNull();
  });
});
