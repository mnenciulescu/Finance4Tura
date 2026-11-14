import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderApp } from "../../../test/utils";

vi.setSystemTime(new Date("2026-09-15T10:00:00Z"));
afterAll(() => vi.useRealTimers());

const pad = (n: number) => String(n).padStart(2, "0");
const INCOMES = [
  ...Array.from({ length: 12 }, (_, i) => ({ incomeId: `i${i + 1}`, seriesId: "sal", summary: "Salary", date: `2026-${pad(i + 1)}-10`, amount: 10000, currency: "RON", isRepeatable: true })),
  { incomeId: "old", seriesId: "old", summary: "Old salary", date: "2025-12-10", amount: 9000, currency: "RON" },
];
const SEED = [
  { expenseId: "e1", seriesId: "rent", summary: "Rent", date: "2026-09-11", amount: 4000, priority: "High", status: "Completed", isRepeatable: true, mappedIncomeId: "i9" },
  { expenseId: "e2", seriesId: "e2", summary: "Phone", date: "2026-09-12", amount: 100, priority: "Low", status: "Pending", mappedIncomeId: "i9" },
  { expenseId: "e3", seriesId: "e3", summary: "Shoes", date: "2026-09-20", amount: 500, priority: "Medium", status: "Pending", mappedIncomeId: "i9", special: true },
];

let expenses: any[] = [];
const api = {
  updateExpense: vi.fn((id: string, body: any) => Promise.resolve({ ...body, expenseId: id })),
  deleteExpense: vi.fn((id: string) => { expenses = expenses.filter(e => e.expenseId !== id); return Promise.resolve({}); }),
  deleteIncome: vi.fn(() => Promise.resolve({})),
};
vi.mock("../../../api/incomes", async orig => ({ ...(await orig<object>()), listIncomes: () => Promise.resolve(INCOMES), deleteIncome: (...a: any[]) => (api.deleteIncome as any)(...a) }));
vi.mock("../../../api/expenses", async orig => ({
  ...(await orig<object>()),
  listExpenses: () => Promise.resolve(expenses.map(e => ({ ...e }))),
  updateExpense: (...a: any[]) => (api.updateExpense as any)(...a),
  deleteExpense: (...a: any[]) => (api.deleteExpense as any)(...a),
  resolveIncome: () => Promise.resolve({ income: INCOMES[8] }),
}));

const { default: Budget } = await import("./Budget");

const period = () => document.querySelector('[data-period][aria-hidden="false"]') as HTMLElement;
const figure = (k: string) => period().querySelector(`[data-figure="${k}"]`)?.textContent;

beforeEach(() => {
  expenses = SEED.map(e => ({ ...e }));
  Object.values(api).forEach(f => f.mockClear());
});

describe("Budget — periods", () => {
  it("opens on the current period", async () => {
    renderApp(<Budget />);
    await screen.findByText("Period 9 of 12");
    expect(period()).toHaveAttribute("data-period", "i9");
    expect(within(period()).getByText("Current")).toBeInTheDocument();
  });

  it("steps between periods, offers Today off the current one, and disables the ends", async () => {
    renderApp(<Budget />);
    await screen.findByText("Period 9 of 12");
    expect(screen.queryByRole("button", { name: "Today" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Previous period" }));
    expect(screen.getByText("Period 8 of 12")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(screen.getByText("Period 9 of 12")).toBeInTheDocument();
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("button", { name: "Next period" }));
    expect(screen.getByRole("button", { name: "Next period" })).toBeDisabled();
  });

  it("lists years with data up to the current one and switches to them", async () => {
    renderApp(<Budget />);
    await screen.findByText("Period 9 of 12");
    fireEvent.click(screen.getByRole("button", { name: "Year: 2026" }));
    expect(screen.getAllByRole("menuitem").map(m => m.textContent)).toEqual(["2026", "2025"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "2025" }));
    expect(await screen.findByText("Period 1 of 1")).toBeInTheDocument();
    expect(screen.getByText("Old salary")).toBeInTheDocument();
  });
});

describe("Budget — the period card", () => {
  it("shows the budget figures: spent, done, pending and free", async () => {
    renderApp(<Budget />);
    await screen.findByText("Period 9 of 12");
    expect(figure("spent")).toBe("4.600");
    expect(figure("done")).toBe("4.000");
    expect(figure("pending")).toBe("600");
    expect(figure("free")).toBe("5.400");
  });

  it("orders rows by priority then date and marks special expenses", async () => {
    renderApp(<Budget />);
    await screen.findByText("Period 9 of 12");
    const ids = [...period().querySelectorAll("[data-expense]")].map(e => e.getAttribute("data-expense"));
    expect(ids).toEqual(["e1", "e3", "e2"]);
    expect(within(period()).getByLabelText("Special")).toBeInTheDocument();
  });

  it("hides the income amount until the eye is toggled, and remembers the choice", async () => {
    renderApp(<Budget />);
    await screen.findByText("Period 9 of 12");
    expect(within(period()).queryByText(/10\.000,00 RON/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show income amounts" }));
    expect(within(period()).getByText(/10\.000,00 RON/)).toBeInTheDocument();
    expect(localStorage.getItem("incomePrivacy")).toBe("true");
  });

  it("toggles an expense's status", async () => {
    renderApp(<Budget />);
    await screen.findByText("Period 9 of 12");
    fireEvent.click(within(period()).getByRole("checkbox", { name: "Phone: mark as completed" }));
    await waitFor(() => expect(api.updateExpense).toHaveBeenCalledWith("e2", expect.objectContaining({ status: "Completed" })));
  });
});

describe("Budget — deleting", () => {
  it("asks this occurrence or the whole series for a repeating expense", async () => {
    renderApp(<Budget />);
    await screen.findByText("Period 9 of 12");
    const row = period().querySelector('[data-expense="e1"]')!.closest("li")!;
    // The swipe Delete, already two-step: tap, then confirm.
    fireEvent.click(within(row).getByRole("button", { name: "Delete", hidden: true }));
    fireEvent.click(within(row).getByRole("button", { name: "Confirm Delete", hidden: true }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete Entire Series" }));
    await waitFor(() => expect(api.deleteExpense).toHaveBeenCalledWith("e1", { deleteSeries: "true" }));
  });

  it("deletes a one-off expense after the swipe two-step, without another question", async () => {
    renderApp(<Budget />);
    await screen.findByText("Period 9 of 12");
    const row = period().querySelector('[data-expense="e2"]')!.closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "Delete", hidden: true }));
    fireEvent.click(within(row).getByRole("button", { name: "Confirm Delete", hidden: true }));
    await waitFor(() => expect(api.deleteExpense).toHaveBeenCalledWith("e2", undefined));
    await waitFor(() => expect(period().querySelector('[data-expense="e2"]')).toBeNull());
  });

  it("deletes an income from the period menu and remaps its expenses", async () => {
    renderApp(<Budget />);
    await screen.findByText("Period 9 of 12");
    fireEvent.click(within(period()).getByRole("button", { name: "Actions for Salary" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete Income" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete This Occurrence" }));
    await waitFor(() => expect(api.deleteIncome).toHaveBeenCalledWith("i9", undefined));
    // Each expense moves to the latest remaining income before its date: Aug 10.
    await waitFor(() => expect(api.updateExpense).toHaveBeenCalledTimes(3));
    expect(api.updateExpense).toHaveBeenCalledWith("e1", expect.objectContaining({ mappedIncomeId: "i8" }));
  });
});

describe("Budget — adding", () => {
  it("opens the New Expense sheet from the + menu", async () => {
    renderApp(<Budget />);
    await screen.findByText("Period 9 of 12");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "New Expense" }));
    expect(await screen.findByRole("dialog", { name: "New Expense" })).toBeInTheDocument();
  });

  it("pre-fills the period's date from + Add Expense", async () => {
    renderApp(<Budget />);
    await screen.findByText("Period 9 of 12");
    fireEvent.click(within(period()).getByRole("button", { name: "+ Add Expense" }));
    const dialog = await screen.findByRole("dialog", { name: "New Expense" });
    expect(within(dialog).getByRole("button", { name: "Date: 10 Sep 2026" })).toBeInTheDocument();
    await act(async () => {});
  });
});
