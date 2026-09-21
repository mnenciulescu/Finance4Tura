import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
});

describe("Dashboard — Finance page actions", () => {
  // Each IncomeCard carries its own "+ Add" for expenses and the Finance menu
  // has Add Income, so the page-level action row was redundant.
  it("does not repeat Add Expense / Add Income as a page-level row", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Salary Sep")).toBeTruthy());

    expect(screen.queryByText("Add Expense")).toBeNull();
    expect(screen.queryByText("Add Income")).toBeNull();
    expect(screen.getByTitle("Add expense")).toBeTruthy();
  });
});

// These two used to live in the desktop chrome, which no longer exists.
describe("Dashboard — controls rehomed from the desktop bar", () => {
  it("carries its own year stepper and will not step past the current year", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Salary Sep")).toBeTruthy());

    // The card's date badge also renders a year, so read the stepper's own value.
    const shownYear = () => screen.getByTitle("Previous year").nextSibling.textContent;

    expect(shownYear()).toBe("2026");
    expect(screen.getByTitle("Next year").disabled).toBe(true);

    fireEvent.click(screen.getByTitle("Previous year"));
    expect(shownYear()).toBe("2025");
    expect(screen.getByTitle("Next year").disabled).toBe(false);
  });

  it("carries the privacy toggle that hides income amounts", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Salary Sep")).toBeTruthy());

    const toggle = screen.getByTitle(/income amounts$/);
    const before = toggle.title;
    fireEvent.click(toggle);
    expect(screen.getByTitle(/income amounts$/).title).not.toBe(before);
  });
});
