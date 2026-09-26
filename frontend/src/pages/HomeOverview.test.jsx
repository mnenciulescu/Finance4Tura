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

const expenses = [
  { expenseId: "x1", date: "2026-09-03", summary: "Rent",    amount: 4000, currency: "RON",
    priority: "High",   status: "Pending",   mappedIncomeId: "n2" },
  { expenseId: "x2", date: "2026-09-05", summary: "Netflix", amount: 60,   currency: "RON",
    priority: "Low",    status: "Completed", mappedIncomeId: "n2" },
  { expenseId: "x3", date: "2026-09-07", summary: "Petrol",  amount: 300,  currency: "RON",
    priority: "Medium", status: "Completed", mappedIncomeId: "n2" },
  // Belongs to the previous period — must not appear.
  { expenseId: "x4", date: "2026-08-04", summary: "Old bill", amount: 99,  currency: "RON",
    priority: "High",   status: "Pending",   mappedIncomeId: "n1" },
];

const updateExpense = vi.fn(() => Promise.resolve({}));

vi.mock("../api/incomes",       () => ({ listIncomes: () => Promise.resolve(incomes) }));
vi.mock("../api/expenses",      () => ({ listExpenses: () => Promise.resolve(expenses), updateExpense }));
vi.mock("../api/splitPayments", () => ({ listSplitPayments: () => Promise.resolve([]), updateSplitPayment: vi.fn() }));
vi.mock("../api/booksAndDev",   () => ({ listBooks: () => Promise.resolve([]) }));
vi.mock("../api/investments",   () => ({ listSnapshots: () => Promise.resolve([]) }));
vi.mock("../api/fxRates",       () => ({ getFxRates: () => Promise.resolve({ rates: {}, updatedAt: null }) }));

const { default: HomeOverview } = await import("./HomeOverview");

const renderPage = () => render(<MemoryRouter><HomeOverview /></MemoryRouter>);

beforeEach(() => {
  updateExpense.mockClear();
  vi.setSystemTime(new Date("2026-09-15T10:00:00Z"));
});

describe("Home Overview — current period expenses", () => {
  it("lists completed expenses alongside pending ones", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Rent")).toBeTruthy());

    expect(screen.getByText("Netflix")).toBeTruthy();
    expect(screen.getByText("Petrol")).toBeTruthy();
  });

  it("still excludes expenses mapped to another income period", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Rent")).toBeTruthy());
    expect(screen.queryByText("Old bill")).toBeNull();
  });

  it("puts pending first and strikes through the completed ones", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Rent")).toBeTruthy());

    const rows = [...document.querySelectorAll("li")].map(li => li.textContent);
    expect(rows[0]).toContain("Rent");          // pending sorts above completed

    expect(screen.getByText("Netflix").style.textDecoration).toBe("line-through");
    expect(screen.getByText("Rent").style.textDecoration).toBe("none");
  });

  it("totals done and pending separately", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Rent")).toBeTruthy());

    // done = 60 + 300 = 360, pending = 4000
    expect(screen.getByText(/Done/)).toBeTruthy();
    expect(screen.getByText("360")).toBeTruthy();
    expect(screen.getByText("4.000")).toBeTruthy();
  });

  it("flips a completed expense back to pending", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Netflix")).toBeTruthy());

    // Two rows are completed, so scope to the Netflix one.
    const row = screen.getByText("Netflix").closest("li");
    fireEvent.click(within(row).getByTitle("Mark as Pending"));
    expect(updateExpense).toHaveBeenCalledWith("x2", expect.objectContaining({ status: "Pending" }));
  });

  it("marks a pending expense complete", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Rent")).toBeTruthy());

    fireEvent.click(screen.getByTitle("Mark as Completed"));
    expect(updateExpense).toHaveBeenCalledWith("x1", expect.objectContaining({ status: "Completed" }));
  });
});
