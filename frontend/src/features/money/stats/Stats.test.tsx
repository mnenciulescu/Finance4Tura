import { describe, it, expect, vi, afterAll } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { renderApp } from "../../../test/utils";
import { averages, buildMonthly, SURVIVAL_BASELINE } from "./statsMath";

vi.setSystemTime(new Date("2026-04-15T10:00:00Z"));
afterAll(() => vi.useRealTimers());

const incomes = [
  { incomeId: "a", date: "2026-01-10", summary: "S", amount: 10000 },
  { incomeId: "b", date: "2026-02-10", summary: "S", amount: 10000 },
  { incomeId: "c", date: "2025-05-10", summary: "S", amount: 8000 },
];
const expenses = [
  { expenseId: "1", date: "2026-01-12", summary: "Rent", amount: 4000, priority: "High", status: "Pending" },
  { expenseId: "2", date: "2026-01-20", summary: "Food", amount: 1000, priority: "Medium", status: "Pending" },
  { expenseId: "3", date: "2026-02-12", summary: "Rent", amount: 4000, priority: "High", status: "Pending" },
  { expenseId: "4", date: "2026-02-14", summary: "Holiday", amount: 3000, priority: "Low", status: "Pending", special: true },
];
const forYear = (list: any[], params?: { from?: string }) => list.filter(x => !params?.from || x.date.startsWith(params.from.slice(0, 4)));
vi.mock("../../../api/incomes", async orig => ({ ...(await orig<object>()), listIncomes: (p?: any) => Promise.resolve(forYear(incomes, p)) }));
vi.mock("../../../api/expenses", async orig => ({ ...(await orig<object>()), listExpenses: (p?: any) => Promise.resolve(forYear(expenses, p)) }));

const { default: StatsScreen } = await import("./StatsScreen");

describe("statistics maths (unchanged)", () => {
  it("averages over months with data only and adds the survival baseline", () => {
    const rows = buildMonthly(incomes as any, expenses as any, 2026);
    const a = averages(rows);
    expect(a.months).toBe(2);
    expect(a.high).toBe(4000);
    expect(a.medium).toBe(500);
    expect(a.free).toBe((5000 + 3000) / 2);
    expect(a.survival).toBe(4000 + 500 * 0.8 + SURVIVAL_BASELINE);
  });

  it("leaves future months without data blank rather than zero", () => {
    const rows = buildMonthly(incomes as any, expenses as any, 2026);
    expect(rows[3].free).toBe(0);      // April (current month) has no data → 0
    expect(rows[4].free).toBeNull();   // May is in the future → blank
  });
});

describe("Stats screen", () => {
  it("shows the averages and the month count", async () => {
    renderApp(<StatsScreen />);
    expect(await screen.findByText(/2 months with data · now Apr/)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Average free per month: 4\.000,0/ })).toBeInTheDocument();
    expect(document.querySelector('[data-avg="high"]')).toHaveTextContent("4.000,0");
  });

  it("keeps special expenses collapsed until opened", async () => {
    renderApp(<StatsScreen />);
    const toggle = await screen.findByRole("button", { name: /Special expenses · 1 in 2026/ });
    expect(screen.queryByText("Holiday")).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByText("Holiday")).toBeInTheDocument();
  });

  it("switches year from the shared year menu and caps it at the current year", async () => {
    renderApp(<StatsScreen />);
    await screen.findByText(/2 months with data · now/);
    fireEvent.click(screen.getByRole("button", { name: "Year: 2026" }));
    expect(screen.getAllByRole("menuitem").map(m => m.textContent)).toEqual(["2026", "2025"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "2025" }));
    expect(await screen.findByText(/^1 month with data$/)).toBeInTheDocument();
  });

  it("shows an empty state for a year with no data", async () => {
    incomes.length = 0; expenses.length = 0;
    renderApp(<StatsScreen />);
    const empty = await screen.findByText("No data for 2026");
    expect(within(empty.parentElement!).getByText(/will show here/)).toBeInTheDocument();
  });
});
