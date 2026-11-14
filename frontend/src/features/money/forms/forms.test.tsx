import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderApp } from "../../../test/utils";
import { useForms } from "./FormsContext";

vi.setSystemTime(new Date("2026-09-15T10:00:00Z"));
afterAll(() => vi.useRealTimers());

const EXPENSE = { expenseId: "e5", seriesId: "rent", summary: "Rent", date: "2026-09-11", amount: 4000, currency: "RON", priority: "High", status: "Pending", isRepeatable: true, mappedIncomeId: "i9", mappedIncomeSummary: "Salary", mappedIncomeDate: "2026-09-10" };
const api = {
  createExpense: vi.fn(() => Promise.resolve({})),
  updateExpense: vi.fn(() => Promise.resolve({})),
  updateExpenseSeries: vi.fn(() => Promise.resolve({})),
  createIncome: vi.fn(() => Promise.resolve({})),
};
vi.mock("../../../api/expenses", async orig => ({
  ...(await orig<object>()),
  getExpense: () => Promise.resolve(EXPENSE),
  listExpenses: () => Promise.resolve([]),
  resolveIncome: () => Promise.resolve({ income: { incomeId: "i9", summary: "Salary", date: "2026-09-10", amount: 10000, currency: "RON" } }),
  createExpense: (...a: any[]) => (api.createExpense as any)(...a),
  updateExpense: (...a: any[]) => (api.updateExpense as any)(...a),
  updateExpenseSeries: (...a: any[]) => (api.updateExpenseSeries as any)(...a),
}));
vi.mock("../../../api/incomes", async orig => ({ ...(await orig<object>()), listIncomes: () => Promise.resolve([]), createIncome: (...a: any[]) => (api.createIncome as any)(...a) }));

function Opener({ kind, id }: { kind: "expense" | "income"; id?: string }) {
  const { openExpense, openIncome } = useForms();
  return <button onClick={() => (kind === "expense" ? openExpense({ id }) : openIncome({ id }))}>open</button>;
}
const open = async (kind: "expense" | "income", id?: string, title = id ? `Edit ${kind === "expense" ? "Expense" : "Income"}` : `New ${kind === "expense" ? "Expense" : "Income"}`) => {
  renderApp(<Opener kind={kind} id={id} />);
  fireEvent.click(screen.getByText("open"));
  // The sheets are lazy-loaded; the first import can be slow under a parallel run.
  return screen.findByRole("dialog", { name: title }, { timeout: 5000 });
};
const type = (dialog: HTMLElement, label: string, value: string) =>
  fireEvent.change(within(dialog).getByRole("textbox", { name: label }), { target: { value } });

beforeEach(() => Object.values(api).forEach(f => f.mockClear()));

describe("Expense sheet", () => {
  it("validates before saving", async () => {
    const d = await open("expense");
    fireEvent.click(within(d).getByRole("button", { name: "Add" }));
    expect(within(d).getByText("Summary is required.")).toBeInTheDocument();
    expect(within(d).getByText("Amount is required.")).toBeInTheDocument();
    type(d, "Amount", "0");
    fireEvent.click(within(d).getByRole("button", { name: "Add" }));
    expect(within(d).getByText("Amount must be greater than 0.")).toBeInTheDocument();
    expect(api.createExpense).not.toHaveBeenCalled();
  });

  it("previews the income the expense maps to", async () => {
    const d = await open("expense");
    expect(await within(d).findByText(/Maps to/, {}, { timeout: 2000 })).toHaveTextContent("Maps to Salary · 10 Sep 2026");
  });

  it("creates with a comma decimal amount", async () => {
    const d = await open("expense");
    type(d, "Summary", "Coffee");
    type(d, "Amount", "12,5");
    fireEvent.click(within(d).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(api.createExpense).toHaveBeenCalledWith(expect.objectContaining({ summary: "Coffee", amount: 12.5, date: "2026-09-15", priority: "Medium", status: "Pending" })));
  });

  it("offers Repeat only when creating, and requires an end date within the year", async () => {
    const d = await open("expense");
    fireEvent.click(within(d).getByRole("switch", { name: "Repeating expense" }));
    expect(within(d).getByRole("button", { name: "Ends: 31 Dec 2026" })).toBeInTheDocument();
  });

  it("asks this occurrence or all future ones when editing a series member", async () => {
    const d = await open("expense", "e5");
    await within(d).findByDisplayValue("Rent");
    expect(within(d).queryByRole("switch", { name: "Repeating expense" })).toBeNull();
    type(d, "Amount", "4100");
    fireEvent.click(within(d).getByRole("button", { name: "Save" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save for All Future Occurrences" }));
    await waitFor(() => expect(api.updateExpenseSeries).toHaveBeenCalledWith("e5", expect.objectContaining({ amount: 4100 })));
    expect(api.updateExpense).not.toHaveBeenCalled();
  });
});

describe("Income sheet", () => {
  it("rejects a date outside the current year", async () => {
    const d = await open("income");
    type(d, "Summary", "Bonus");
    type(d, "Amount", "100");
    // Date pickers are bounded to the year; a stale value is still validated.
    fireEvent.click(within(d).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(api.createIncome).toHaveBeenCalledWith(expect.objectContaining({ summary: "Bonus", amount: 100, currency: "RON" })));
  });
});
