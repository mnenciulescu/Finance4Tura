import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { YearProvider } from "../context/YearContext";

const incomes = [
  { incomeId: "n1", date: "2026-08-01", summary: "Salary Aug", amount: 10000, currency: "RON" },
  { incomeId: "n2", date: "2026-09-01", summary: "Salary Sep", amount: 10000, currency: "RON" },
];
const expenses = [
  { expenseId: "x1", date: "2026-09-03", summary: "Rent", amount: 4000, currency: "RON",
    priority: "High", status: "Pending", mappedIncomeId: "n2" },
];

vi.mock("../api/incomes",  () => ({
  listIncomes:  () => Promise.resolve(incomes),
  deleteIncome: vi.fn(),
}));
vi.mock("../api/expenses", () => ({
  listExpenses:  () => Promise.resolve(expenses),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ loading: false }) }));

let mobile = true;
vi.mock("../hooks/useIsMobile", () => ({ default: () => mobile }));

// Dashboard reads the privacy flag from localStorage on first render
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const { default: Dashboard } = await import("./Dashboard");

const renderPage = () =>
  render(<MemoryRouter><YearProvider><Dashboard /></YearProvider></MemoryRouter>);

beforeEach(() => {
  vi.setSystemTime(new Date("2026-09-04T10:00:00Z"));
  mobile = true;
});

describe("Dashboard — Finance page actions", () => {
  it("offers Add Expense and Add Income inside the page on mobile", async () => {
    renderPage();
    const expense = await screen.findByText("Add Expense");
    const income  = screen.getByText("Add Income");

    expect(expense.closest("a").getAttribute("href")).toBe("/add-expense");
    expect(income.closest("a").getAttribute("href")).toBe("/add-income");
  });

  it("does not add the action row on desktop, which has them in the Sidebar", async () => {
    mobile = false;
    renderPage();
    await waitFor(() => expect(screen.getByText("Salary Sep")).toBeTruthy());
    expect(screen.queryByText("Add Expense")).toBeNull();
    expect(screen.queryByText("Add Income")).toBeNull();
  });
});
