import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { YearProvider } from "../context/YearContext";

// Today is mocked so "current month" behaviour is stable regardless of when
// the suite runs.
const NOW = new Date("2026-09-04T10:00:00Z");

const incomes = [
  { incomeId: "i1", date: "2026-01-10", amount: 10000 },
  { incomeId: "i2", date: "2026-02-10", amount: 10000 },
  { incomeId: "i3", date: "2026-03-10", amount: 8000  },
];

const expenses = [
  { expenseId: "e1", date: "2026-01-12", amount: 4000, priority: "High",   summary: "Rent" },
  { expenseId: "e2", date: "2026-01-15", amount: 1000, priority: "Medium", summary: "Food" },
  { expenseId: "e3", date: "2026-01-20", amount: 500,  priority: "Low",    summary: "Fun"  },
  { expenseId: "e4", date: "2026-02-12", amount: 4000, priority: "High",   summary: "Rent" },
  { expenseId: "e5", date: "2026-02-14", amount: 2000, priority: "Medium", summary: "Car",     special: true },
  { expenseId: "e6", date: "2026-03-12", amount: 9000, priority: "High",   summary: "Holiday", special: true },
];

const api = {
  listIncomes:  vi.fn(() => Promise.resolve(incomes)),
  listExpenses: vi.fn(() => Promise.resolve(expenses)),
};

vi.mock("../api/incomes",  () => ({ listIncomes:  (...a) => api.listIncomes(...a)  }));
vi.mock("../api/expenses", () => ({ listExpenses: (...a) => api.listExpenses(...a) }));

const { default: Statistics } = await import("./Statistics");

// recharts measures with ResizeObserver, which jsdom does not implement
globalThis.ResizeObserver = class {
  constructor(cb) { this.cb = cb; }
  observe(el) { this.cb([{ target: el, contentRect: { width: 400, height: 220 } }]); }
  unobserve() {}
  disconnect() {}
};

const renderPage = () => render(<YearProvider><Statistics /></YearProvider>);

beforeEach(() => {
  vi.setSystemTime(NOW);
  Object.defineProperty(HTMLElement.prototype, "offsetWidth",  { configurable: true, value: 400 });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, value: 220 });
  api.listIncomes.mockClear();
  api.listExpenses.mockClear();
});

describe("Statistics page", () => {
  it("renders the three blocks", async () => {
    renderPage();
    await screen.findByText("Monthly averages");
    expect(screen.getByText("Free amount per month")).toBeTruthy();
    expect(screen.getByText("★ Special expenses")).toBeTruthy();
  });

  it("drops the Expenses by Priority chart entirely", async () => {
    renderPage();
    await screen.findByText("Monthly averages");
    expect(screen.queryByText(/Expenses by Priority/i)).toBeNull();
    // exactly one chart on the page
    await waitFor(() => expect(document.querySelectorAll(".recharts-surface").length).toBe(1));
    expect(document.querySelectorAll(".recharts-bar").length).toBe(1);
    expect(document.querySelectorAll(".recharts-line").length).toBe(0);
  });

  it("computes the monthly averages over months with data", async () => {
    renderPage();
    await screen.findByText("Monthly averages");

    // 3 months with data: High (4000+4000+9000)/3 = 5666,7
    expect(screen.getAllByText(/3 months with data/).length).toBe(2);  // header + block sub
    expect(screen.getByText("RON 5.666,7")).toBeTruthy();   // High
    expect(screen.getByText("RON 1.000,0")).toBeTruthy();   // Medium (1000+2000+0)/3
    expect(screen.getByText("RON 166,7")).toBeTruthy();     // Low (500+0+0)/3

    // Free: Jan 4500, Feb 4000, Mar -1000 → avg 2500,0
    expect(screen.getByText("2.500,0")).toBeTruthy();
    // Survival: 5666,67 + 0,8*1000 + 7000 = 13.466,7
    expect(screen.getByText("13.466,7")).toBeTruthy();
  });

  it("special expenses is collapsed by default and expands", async () => {
    renderPage();
    await screen.findByText("★ Special expenses");

    // Collapsed head still summarises count + total (2000 + 9000)
    expect(screen.getByText(/2 in 2026/)).toBeTruthy();
    expect(screen.getByText("RON 11.000")).toBeTruthy();
    expect(screen.queryByText("Holiday")).toBeNull();

    fireEvent.click(screen.getByText("★ Special expenses"));
    await waitFor(() => expect(screen.getByText("Holiday")).toBeTruthy());
    expect(screen.getByText("Car")).toBeTruthy();
    expect(screen.getByText("Mar 12")).toBeTruthy();
    expect(screen.getByText("Total")).toBeTruthy();

    fireEvent.click(screen.getByText("★ Special expenses"));
    await waitFor(() => expect(screen.queryByText("Holiday")).toBeNull());
  });

  it("steps the year and refetches, capping at the current year", async () => {
    renderPage();
    await screen.findByText("Monthly averages");
    expect(screen.getByText("2026")).toBeTruthy();

    // forward is disabled on the current year
    const next = screen.getByTitle("Next year");
    expect(next.disabled).toBe(true);

    fireEvent.click(screen.getByTitle("Previous year"));
    await waitFor(() => expect(screen.getByText("2025")).toBeTruthy());
    await waitFor(() => expect(api.listIncomes).toHaveBeenCalledWith({ from: "2025-01-01", to: "2025-12-31" }));

    // forward is available again once we are below the current year
    await waitFor(() => expect(screen.getByTitle("Next year").disabled).toBe(false));
  });

  it("shows an empty state for a year with no data", async () => {
    renderPage();
    await screen.findByText("Monthly averages");

    api.listIncomes.mockResolvedValueOnce([]);
    api.listExpenses.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByTitle("Previous year"));

    await waitFor(() => expect(screen.getByText("No data for 2025.")).toBeTruthy());
    expect(screen.getAllByText(/0 months with data/).length).toBe(2);
    expect(screen.getByText(/None in 2025/)).toBeTruthy();
  });

  it("surfaces a load failure", async () => {
    api.listIncomes.mockRejectedValueOnce(new Error("boom"));
    renderPage();
    await waitFor(() => expect(screen.getByText("Failed to load data.")).toBeTruthy());
  });
});
