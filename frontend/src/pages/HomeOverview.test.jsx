import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach, afterAll } from "vitest";

vi.setSystemTime(new Date("2026-09-15T10:00:00Z"));
afterAll(() => vi.useRealTimers());

// 2026-09-01 is the latest income on or before "today", so it is the current period.
const incomes = [
  { incomeId: "n1", date: "2026-08-01", summary: "Salary Aug", amount: 10000, currency: "RON" },
  { incomeId: "n2", date: "2026-09-01", summary: "Salary Sep", amount: 10000, currency: "RON" },
];

/**
 * Three outstanding items whose priority order and date order disagree — by
 * date it is Rent, Netflix, Petrol; by priority it is Rent, Petrol, Netflix —
 * so the ordering assertions cannot pass by accident. Plus one already-completed
 * item, which must never be listed, and one from the previous period.
 */
const SEED = [
  { expenseId: "x1", date: "2026-09-03", summary: "Rent",      amount: 4000, currency: "RON",
    priority: "High",   status: "Pending",   mappedIncomeId: "n2" },
  { expenseId: "x2", date: "2026-09-05", summary: "Netflix",   amount: 60,   currency: "RON",
    priority: "Low",    status: "Pending",   mappedIncomeId: "n2" },
  { expenseId: "x3", date: "2026-09-07", summary: "Petrol",    amount: 300,  currency: "RON",
    priority: "Medium", status: "Pending",   mappedIncomeId: "n2" },
  { expenseId: "x5", date: "2026-09-02", summary: "Insurance", amount: 500,  currency: "RON",
    priority: "High",   status: "Completed", mappedIncomeId: "n2" },
  { expenseId: "x4", date: "2026-08-04", summary: "Old bill",  amount: 99,   currency: "RON",
    priority: "High",   status: "Pending",   mappedIncomeId: "n1" },
];

// A mutable store, so a save is visible to the next load the way the real API
// behaves. Without it there is no way to test what a refresh shows.
let store = [];
const updateExpense = vi.fn((id, body) => {
  store = store.map(e => e.expenseId === id ? { ...e, ...body } : e);
  return Promise.resolve({});
});

vi.mock("../api/incomes",       () => ({ listIncomes: () => Promise.resolve(incomes) }));
vi.mock("../api/expenses",      () => ({
  listExpenses: () => Promise.resolve(store.map(e => ({ ...e }))),
  updateExpense,
}));
vi.mock("../api/splitPayments", () => ({ listSplitPayments: () => Promise.resolve([]), updateSplitPayment: vi.fn() }));
vi.mock("../api/booksAndDev",   () => ({ listBooks: () => Promise.resolve([]) }));
vi.mock("../api/investments",   () => ({ listSnapshots: () => Promise.resolve([]) }));
vi.mock("../api/fxRates",       () => ({ getFxRates: () => Promise.resolve({ rates: {}, updatedAt: null }) }));

const { default: HomeOverview } = await import("./HomeOverview");

const renderPage = () => render(<MemoryRouter><HomeOverview /></MemoryRouter>);

/** Summaries of the expense rows, in render order. */
const order = () => [...document.querySelectorAll("li")]
  .map(li => ["Rent", "Petrol", "Netflix", "Insurance", "Old bill"].find(n => li.textContent.includes(n)))
  .filter(Boolean);

const rowFor = (name) => screen.getByText(name).closest("li");
const tick   = (name) => fireEvent.click(within(rowFor(name)).getByTitle("Mark as Completed"));
const untick = (name) => fireEvent.click(within(rowFor(name)).getByTitle("Mark as Pending"));

beforeEach(() => {
  updateExpense.mockClear();
  store = SEED.map(e => ({ ...e }));
  vi.setSystemTime(new Date("2026-09-15T10:00:00Z"));
});

describe("Home Overview — the outstanding list", () => {
  it("lists only what is still to pay", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Rent")).toBeTruthy());

    expect(order()).toEqual(["Rent", "Petrol", "Netflix"]);
    expect(screen.queryByText("Insurance")).toBeNull();
  });

  it("still excludes expenses mapped to another income period", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Rent")).toBeTruthy());
    expect(screen.queryByText("Old bill")).toBeNull();
  });

  it("orders by priority then date, matching the Finance Dashboard", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Rent")).toBeTruthy());

    // High -> Medium -> Low. By date this would be Rent, Netflix, Petrol.
    expect(order()).toEqual(["Rent", "Petrol", "Netflix"]);
  });

  it("shows a distinct message once everything is paid", async () => {
    store = store.map(e => ({ ...e, status: "Completed" }));
    renderPage();
    await waitFor(() => expect(screen.getByText("Nothing left to pay.")).toBeTruthy());
  });
});

describe("Home Overview — ticking an expense", () => {
  it("keeps the row on screen so a mistap can be undone", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Rent")).toBeTruthy());

    tick("Rent");
    expect(screen.getByText("Rent")).toBeTruthy();
    expect(updateExpense).toHaveBeenCalledWith("x1", expect.objectContaining({ status: "Completed" }));
  });

  it("holds the row's position rather than moving it", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Rent")).toBeTruthy());
    const before = order();

    tick("Rent");
    expect(order()).toEqual(before);

    untick("Rent");
    expect(order()).toEqual(before);
  });

  it("lets a mistap be reversed", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Rent")).toBeTruthy());

    tick("Rent");
    untick("Rent");
    expect(updateExpense).toHaveBeenLastCalledWith("x1", expect.objectContaining({ status: "Pending" }));
  });

  it("strikes the row through while it waits", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Rent")).toBeTruthy());

    expect(screen.getByText("Rent").style.textDecoration).toBe("none");
    tick("Rent");
    expect(screen.getByText("Rent").style.textDecoration).toBe("line-through");
  });

  it("drops the row only once the page is loaded again", async () => {
    const first = renderPage();
    await waitFor(() => expect(screen.getByText("Rent")).toBeTruthy());

    tick("Rent");
    await waitFor(() => expect(updateExpense).toHaveBeenCalled());
    expect(screen.getByText("Rent")).toBeTruthy();   // still there

    first.unmount();
    renderPage();                                    // a fresh load
    await waitFor(() => expect(screen.getByText("Petrol")).toBeTruthy());
    expect(screen.queryByText("Rent")).toBeNull();
    expect(order()).toEqual(["Petrol", "Netflix"]);
  });

  it("moves the amount between the two figures as it is ticked", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Rent")).toBeTruthy());

    // At load: done = Insurance 500, pending = 4000 + 60 + 300.
    expect(screen.getByLabelText("Done").textContent).toBe("500");
    expect(screen.getByLabelText("Pending").textContent).toBe("4.360");

    tick("Rent");
    expect(screen.getByLabelText("Done").textContent).toBe("4.500");
    expect(screen.getByLabelText("Pending").textContent).toBe("360");
  });

  it("counts completed expenses in the figures even though they are not listed", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Rent")).toBeTruthy());

    // Insurance is absent from the list but its 500 is in the Done figure.
    expect(screen.queryByText("Insurance")).toBeNull();
    expect(screen.getByLabelText("Done").textContent).toBe("500");
  });
});

describe("Home Overview — the footer", () => {
  it("shows neither a progress bar nor a period total under the list", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Rent")).toBeTruthy());

    expect(screen.queryByText(/^Total$/)).toBeNull();
    expect(screen.queryByText(/4\.860/)).toBeNull();   // 500 + 4360
    expect(screen.queryByTitle(/^Done 4/)).toBeNull(); // the bar's segments
    expect(screen.queryByTitle(/^Pending /)).toBeNull();
  });

  it("carries no visible captions, only accessible names", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Rent")).toBeTruthy());

    expect(screen.queryByText("Done")).toBeNull();
    expect(screen.queryByText("Pending")).toBeNull();
    expect(screen.getByLabelText("Done")).toBeTruthy();
    expect(screen.getByLabelText("Pending")).toBeTruthy();
  });
});
