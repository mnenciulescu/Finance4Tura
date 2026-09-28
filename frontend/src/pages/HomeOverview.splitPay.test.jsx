/**
 * The split-payments block on the Home Overview.
 *
 * Two behaviours were ported here from the Split Pay page: an empty date slot
 * must not be a tappable `<input type="date">` (on iOS, tapping one opens a
 * wheel already showing today and dismissing it commits that value), and
 * filling the final slot must ask before the entry settles and drops off the
 * list.
 */
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// Must exist before the module is imported: the component reads it once, at
// load, to decide whether it can replace the field with a button.
const showPicker = vi.fn();
HTMLInputElement.prototype.showPicker = showPicker;

const DATE_ENTRY = {
  splitPaymentId: "s1", title: "Radu - Engleza", createdDate: "2026-09-01",
  totalAmount: 1200, currency: "RON", occurrenceCount: 2, occurrenceType: "date",
  occurrences: [{ value: "2026-07-10" }, { value: "" }],
};
const AMOUNT_ENTRY = {
  splitPaymentId: "s2", title: "Anvelope iarna", createdDate: "2026-08-14",
  totalAmount: 2400, currency: "RON", occurrenceCount: 2, occurrenceType: "amount",
  occurrences: [{ value: "800" }, { value: "" }],
};

let store = [];
const updateSplitPayment = vi.fn(() => Promise.resolve({}));

vi.mock("../api/incomes",       () => ({ listIncomes: () => Promise.resolve([]) }));
vi.mock("../api/expenses",      () => ({ listExpenses: () => Promise.resolve([]), updateExpense: vi.fn() }));
vi.mock("../api/splitPayments", () => ({
  listSplitPayments: () => Promise.resolve(store.map(e => ({ ...e, occurrences: e.occurrences.map(o => ({ ...o })) }))),
  updateSplitPayment,
}));
vi.mock("../api/booksAndDev",   () => ({ listBooks: () => Promise.resolve([]) }));
vi.mock("../api/investments",   () => ({ listSnapshots: () => Promise.resolve([]) }));
vi.mock("../api/fxRates",       () => ({ getFxRates: () => Promise.resolve({ rates: {}, updatedAt: null }) }));

const { default: HomeOverview } = await import("./HomeOverview");

const renderPage = () => render(<MemoryRouter><HomeOverview /></MemoryRouter>);
const tile = (title) => screen.getByText(title).closest("div[style]").parentElement;

/** The card's own title, as opposed to the copy the dialog repeats. */
const cardTitle = (name) =>
  screen.getAllByText(name).find(el => el.tagName === "SPAN");

/** The hidden field behind a date slot's button. */
const hiddenDateFor = (title, n) =>
  document.querySelectorAll('input[type="date"]')[n];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  updateSplitPayment.mockClear();
  showPicker.mockClear();
  store = [DATE_ENTRY, AMOUNT_ENTRY].map(e => ({ ...e, occurrences: e.occurrences.map(o => ({ ...o })) }));
});
afterEach(() => vi.useRealTimers());

describe("date slots", () => {
  it("renders an empty date slot as a button, never a tappable date field", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Radu - Engleza")).toBeTruthy());

    expect(screen.getByText("Set date").tagName).toBe("BUTTON");
    // The field still exists to drive the picker, but cannot be reached.
    for (const el of document.querySelectorAll('input[type="date"]')) {
      expect(el.style.pointerEvents).toBe("none");
      expect(el.getAttribute("tabindex")).toBe("-1");
    }
  });

  it("opens the picker on tap and writes nothing by itself", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Radu - Engleza")).toBeTruthy());

    fireEvent.click(screen.getByText("Set date"));
    expect(showPicker).toHaveBeenCalledOnce();

    // No value was committed, and nothing was saved.
    expect(screen.getByText("Set date")).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(updateSplitPayment).not.toHaveBeenCalled();
  });

  it("writes the date only once one is actually chosen", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Radu - Engleza")).toBeTruthy());

    // The second date field is the empty slot; choosing a date fires change.
    fireEvent.change(hiddenDateFor("Radu - Engleza", 1), { target: { value: "2026-09-20" } });
    expect(screen.queryByText("Set date")).toBeNull();
    expect(screen.getByText("2026-09-20")).toBeTruthy();
  });

  it("offers a way back out of a slot that was filled by mistake", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Radu - Engleza")).toBeTruthy());

    const clear = screen.getByLabelText(/^Clear Radu - Engleza — installment 1$/);
    fireEvent.click(clear);
    expect(screen.getAllByText("Set date").length).toBe(2);
  });
});

describe("settling the last slot", () => {
  const fillLastDate = () =>
    fireEvent.change(hiddenDateFor("Radu - Engleza", 1), { target: { value: "2026-09-20" } });

  it("asks before the entry settles, and holds the save meanwhile", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Radu - Engleza")).toBeTruthy());

    fillLastDate();
    expect(updateSplitPayment).not.toHaveBeenCalled();

    await act(async () => { vi.advanceTimersByTime(800); });
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Mark as settled?")).toBeTruthy();

    // Still held, even past the save debounce.
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(updateSplitPayment).not.toHaveBeenCalled();
  });

  it("keeps the card listed while the question is open", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Radu - Engleza")).toBeTruthy());

    fillLastDate();
    await act(async () => { vi.advanceTimersByTime(800); });
    // Fully covered, so it would normally have dropped off this list.
    expect(cardTitle("Radu - Engleza")).toBeTruthy();
  });

  it("saves and drops the card once confirmed", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Radu - Engleza")).toBeTruthy());

    fillLastDate();
    await act(async () => { vi.advanceTimersByTime(800); });
    fireEvent.click(screen.getByText("Mark settled"));

    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(updateSplitPayment).toHaveBeenCalledWith("s1", {
      occurrences: [{ value: "2026-07-10" }, { value: "2026-09-20" }],
    });
    expect(screen.queryByText("Radu - Engleza")).toBeNull();
  });

  it("restores the slot and keeps the card on cancel", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Radu - Engleza")).toBeTruthy());

    fillLastDate();
    await act(async () => { vi.advanceTimersByTime(800); });
    fireEvent.click(screen.getByText("Cancel"));

    expect(cardTitle("Radu - Engleza")).toBeTruthy();
    expect(screen.queryByText("2026-09-20")).toBeNull();
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(updateSplitPayment).not.toHaveBeenCalled();
  });

  it("withdraws the question if the slot is cleared again", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Radu - Engleza")).toBeTruthy());

    fillLastDate();
    fireEvent.click(screen.getByLabelText(/^Clear Radu - Engleza — installment 2$/));
    await act(async () => { vi.advanceTimersByTime(2000); });

    expect(screen.queryByRole("dialog")).toBeNull();
    // Clearing is an ordinary edit, so it saves.
    expect(updateSplitPayment).toHaveBeenCalledWith("s1", {
      occurrences: [{ value: "2026-07-10" }, { value: "" }],
    });
  });
});

describe("amount slots", () => {
  it("keeps a typable number field", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Anvelope iarna")).toBeTruthy());

    const field = screen.getByLabelText("Anvelope iarna — installment 2");
    expect(field.tagName).toBe("INPUT");
    expect(field.getAttribute("type")).toBe("number");
  });

  it("asks before the last amount settles the entry", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Anvelope iarna")).toBeTruthy());

    fireEvent.change(screen.getByLabelText("Anvelope iarna — installment 2"), { target: { value: "1600" } });
    await act(async () => { vi.advanceTimersByTime(800); });
    expect(screen.getByText("Mark as settled?")).toBeTruthy();
  });
});
