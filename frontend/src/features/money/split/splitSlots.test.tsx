/**
 * Split-payment slots, on Today and on Money → Split (proposal §8.2, §8.5).
 *
 * A date slot is a button that opens the app's own calendar — never a live
 * <input type="date">, which on iOS commits today when dismissed. Filling the
 * last empty slot asks before the entry settles. "Today" is pinned, so these
 * no longer depend on the date they run on (the cause of the 9 old failures).
 */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderApp } from "../../../test/utils";

vi.setSystemTime(new Date("2026-09-15T10:00:00Z"));
afterAll(() => vi.useRealTimers());

const DATE_ENTRY = {
  splitPaymentId: "s1", title: "Radu - Engleza", createdDate: "2026-09-01", totalAmount: 1200, currency: "RON",
  occurrenceCount: 2, occurrenceType: "date", occurrences: [{ value: "2026-07-10" }, { value: "" }],
};
const AMOUNT_ENTRY = {
  splitPaymentId: "s2", title: "Anvelope iarna", createdDate: "2026-08-14", totalAmount: 2400, currency: "RON",
  occurrenceCount: 3, occurrenceType: "amount", occurrences: [{ value: "800" }, { value: "" }, { value: "" }],
};

let store: any[] = [];
const updateSplitPayment = vi.fn((id: string, body: any) => Promise.resolve({ splitPaymentId: id, ...body }));

// Partial mocks: the real modules are kept (their client is never called),
// with the reads replaced.
vi.mock("../../../api/incomes", async orig => ({ ...(await orig<object>()), listIncomes: () => Promise.resolve([]) }));
vi.mock("../../../api/expenses", async orig => ({ ...(await orig<object>()), listExpenses: () => Promise.resolve([]), updateExpense: vi.fn() }));
vi.mock("../../../api/splitPayments", async orig => ({
  ...(await orig<object>()),
  listSplitPayments: () => Promise.resolve(store.map(e => ({ ...e, occurrences: e.occurrences.map((o: any) => ({ ...o })) }))),
  updateSplitPayment: (...a: any[]) => (updateSplitPayment as any)(...a),
}));
vi.mock("../../../api/booksAndDev", async orig => ({ ...(await orig<object>()), listBooks: () => Promise.resolve([]) }));
vi.mock("../../../api/fxRates", async orig => ({ ...(await orig<object>()), getFxRates: () => Promise.resolve({ rates: null, updatedAt: null }) }));

const { default: Today } = await import("../../today/Today");
const { default: SplitScreen } = await import("./SplitScreen");

// hidden: true — while an alert or menu is open, React Aria (correctly) hides
// the page behind it from the accessibility tree.
const slot = (title: string, n: number) => screen.getByRole("button", { name: new RegExp(`^${title} — installment ${n}:`), hidden: true });
const amount = (title: string, n: number) => screen.getByRole("textbox", { name: `${title} — installment ${n}`, hidden: true });
const calendar = () => screen.queryByRole("dialog", { name: /pick a date/ });
const pickDay = async (label: RegExp) => fireEvent.click(await screen.findByRole("button", { name: label }));
const wait = (ms: number) => act(async () => { await new Promise(r => setTimeout(r, ms)); });

beforeEach(() => {
  updateSplitPayment.mockClear();
  store = [DATE_ENTRY, AMOUNT_ENTRY].map(e => ({ ...e, occurrences: e.occurrences.map(o => ({ ...o })) }));
});

for (const [name, Screen] of [["Today", Today], ["Money → Split", SplitScreen]] as const) {
  describe(`${name}: date slots`, () => {
    it("renders date slots as buttons, with no date field anywhere", async () => {
      renderApp(<Screen />);
      await screen.findAllByText("Radu - Engleza");
      expect(slot("Radu - Engleza", 2)).toHaveTextContent("Set date");
      expect(document.querySelector('input[type="date"]')).toBeNull();
    });

    it("opens the calendar on tap and writes nothing by itself", async () => {
      renderApp(<Screen />);
      await screen.findAllByText("Radu - Engleza");
      fireEvent.click(slot("Radu - Engleza", 2));
      expect(await screen.findByRole("grid")).toBeInTheDocument();
      await wait(700);
      expect(updateSplitPayment).not.toHaveBeenCalled();
    });

    it("opens on the slot's month, marks its day, and never preselects today", async () => {
      renderApp(<Screen />);
      await screen.findAllByText("Radu - Engleza");
      fireEvent.click(slot("Radu - Engleza", 1));
      const grid = await screen.findByRole("grid");
      expect(grid).toHaveAccessibleName(/July 2026/);
      const selected = grid.querySelectorAll('[aria-selected="true"]');
      expect(selected).toHaveLength(1);
      expect(selected[0].textContent).toBe("10");
    });

    it("opens an empty slot on the current month with nothing selected", async () => {
      renderApp(<Screen />);
      await screen.findAllByText("Radu - Engleza");
      fireEvent.click(slot("Radu - Engleza", 2));
      const grid = await screen.findByRole("grid");
      expect(grid).toHaveAccessibleName(/September 2026/);
      expect(grid.querySelectorAll('[aria-selected="true"]')).toHaveLength(0);
    });

    it("starts weeks on Monday", async () => {
      renderApp(<Screen />);
      await screen.findAllByText("Radu - Engleza");
      fireEvent.click(slot("Radu - Engleza", 2));
      const grid = await screen.findByRole("grid");
      expect(grid.querySelector("thead th")?.textContent).toMatch(/^M/);
    });

    it("leaves the slot alone when the calendar is dismissed", async () => {
      renderApp(<Screen />);
      await screen.findAllByText("Radu - Engleza");
      fireEvent.click(slot("Radu - Engleza", 2));
      await screen.findByRole("grid");
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(calendar()).toBeNull());
      await wait(700);
      expect(slot("Radu - Engleza", 2)).toHaveTextContent("Set date");
      expect(updateSplitPayment).not.toHaveBeenCalled();
    });

    it("offers nothing to clear on an empty slot, and clears a filled one (keeping the slot)", async () => {
      renderApp(<Screen />);
      await screen.findAllByText("Radu - Engleza");
      fireEvent.click(slot("Radu - Engleza", 2));
      await screen.findByRole("grid");
      expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(calendar()).toBeNull());

      fireEvent.click(slot("Radu - Engleza", 1));
      await screen.findByRole("grid");
      fireEvent.click(screen.getByRole("button", { name: "Clear" }));
      await waitFor(() => expect(slot("Radu - Engleza", 1)).toHaveTextContent("Set date"));
      await waitFor(() => expect(updateSplitPayment).toHaveBeenCalledWith("s1", { occurrences: [{ index: 0, value: "" }, { index: 1, value: "" }] }), { timeout: 2000 });
    });
  });

  describe(`${name}: settling the last slot`, () => {
    it("asks before the entry settles, holding the save meanwhile; cancel restores", async () => {
      renderApp(<Screen />);
      await screen.findAllByText("Radu - Engleza");
      fireEvent.click(slot("Radu - Engleza", 2));
      await pickDay(/20 September 2026/);
      expect(await screen.findByRole("alertdialog", { name: "Mark as settled?" }, { timeout: 2000 })).toBeInTheDocument();
      expect(updateSplitPayment).not.toHaveBeenCalled();
      // The card stays listed while the question is open.
      expect(slot("Radu - Engleza", 2)).toHaveTextContent("20 Sep 2026");
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(slot("Radu - Engleza", 2)).toHaveTextContent("Set date"));
      await wait(700);
      expect(updateSplitPayment).not.toHaveBeenCalled();
    });

    it("saves the full slot array once confirmed — never occurrenceCount", async () => {
      renderApp(<Screen />);
      await screen.findAllByText("Radu - Engleza");
      fireEvent.click(slot("Radu - Engleza", 2));
      await pickDay(/20 September 2026/);
      fireEvent.click(await screen.findByRole("button", { name: "Mark Settled" }, { timeout: 2000 }));
      await waitFor(() => expect(updateSplitPayment).toHaveBeenCalledTimes(1), { timeout: 2000 });
      expect(updateSplitPayment).toHaveBeenCalledWith("s1", { occurrences: [{ index: 0, value: "2026-07-10" }, { index: 1, value: "2026-09-20" }] });
    });

    it("asks before the last amount settles the entry too", async () => {
      store[1].occurrences = [{ value: "800" }, { value: "800" }, { value: "" }];
      renderApp(<Screen />);
      await screen.findAllByText("Anvelope iarna");
      fireEvent.change(screen.getByRole("textbox", { name: "Anvelope iarna — installment 3" }), { target: { value: "800" } });
      expect(await screen.findByRole("alertdialog", { name: "Mark as settled?" }, { timeout: 2000 })).toBeInTheDocument();
      expect(updateSplitPayment).not.toHaveBeenCalled();
    });
  });

  describe(`${name}: the number of slots`, () => {
    it("renders the full count even when fewer occurrences were stored, and writes it back", async () => {
      store[1].occurrences = [{ value: "800" }];
      renderApp(<Screen />);
      await screen.findAllByText("Anvelope iarna");
      expect(screen.getAllByRole("textbox", { name: /^Anvelope iarna — installment/ })).toHaveLength(3);
      fireEvent.change(screen.getByRole("textbox", { name: "Anvelope iarna — installment 2" }), { target: { value: "100" } });
      await waitFor(() => expect(updateSplitPayment).toHaveBeenCalled(), { timeout: 2000 });
      const body = updateSplitPayment.mock.calls[0][1];
      expect(body.occurrences).toHaveLength(3);
      expect(body).not.toHaveProperty("occurrenceCount");
    });

    it("keeps every slot after an amount is emptied, and carries no per-slot remove control", async () => {
      renderApp(<Screen />);
      await screen.findAllByText("Anvelope iarna");
      const first = screen.getByRole("textbox", { name: "Anvelope iarna — installment 1" });
      fireEvent.change(first, { target: { value: "" } });
      expect(screen.getAllByRole("textbox", { name: /^Anvelope iarna — installment/ })).toHaveLength(3);
      expect(screen.queryByRole("button", { name: /remove/i })).toBeNull();
    });

    it("accepts a comma as the decimal separator", async () => {
      renderApp(<Screen />);
      await screen.findAllByText("Anvelope iarna");
      const input = screen.getByRole("textbox", { name: "Anvelope iarna — installment 2" });
      fireEvent.change(input, { target: { value: "12,5" } });
      expect(input).toHaveValue("12,5");
    });
  });
}

describe("Money → Split only", () => {
  it("summarises open and settled entries and what is left to cover", async () => {
    store.push({ splitPaymentId: "s3", title: "Sofa", createdDate: "2026-02-01", totalAmount: 300, currency: "RON", occurrenceCount: 1, occurrenceType: "amount", occurrences: [{ value: "300" }] });
    renderApp(<SplitScreen />);
    const summary = await screen.findByTestId("split-summary");
    expect(summary).toHaveTextContent("2 open · 1 settled");
    expect(summary).toHaveTextContent("left to cover 1.600 RON");
  });

  it("keeps Cover Rest and Clear All as entry-level actions; Cover Rest asks before settling", async () => {
    renderApp(<SplitScreen />);
    await screen.findByText("Anvelope iarna");
    const card = document.querySelector('[data-entry="s2"]') as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: "Actions for Anvelope iarna" }));
    expect(await screen.findByRole("menuitem", { name: /Clear All/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: /Cover Rest/ }));
    await waitFor(() => expect(amount("Anvelope iarna", 2)).toHaveValue("800"));
    expect(amount("Anvelope iarna", 3)).toHaveValue("800");
    expect(await screen.findByRole("alertdialog", { name: "Mark as settled?" }, { timeout: 2000 })).toBeInTheDocument();
  });

  it("starts open entries expanded and settled ones collapsed behind the Settled section", async () => {
    store.push({ splitPaymentId: "s3", title: "Sofa", createdDate: "2026-02-01", totalAmount: 300, currency: "RON", occurrenceCount: 1, occurrenceType: "amount", occurrences: [{ value: "300" }] });
    renderApp(<SplitScreen />);
    await screen.findByText("Anvelope iarna");
    expect(screen.queryByText("Sofa")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Settled · 1/ }));
    const sofa = await screen.findByText("Sofa");
    const head = sofa.closest("button")!;
    expect(head).toHaveAttribute("aria-expanded", "false");
  });
});
