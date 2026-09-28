/**
 * The split-payments block on the Home Overview.
 *
 * A date slot is a button that opens the app's own calendar, never a live
 * `<input type="date">` — on iOS, tapping one of those opens a wheel already
 * showing today and dismissing it commits that value. The calendar carries the
 * Clear action, since the native picker cannot hold one. Filling the final slot
 * asks before the entry settles and drops off the list.
 */
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

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

/** The whole card for an entry, so slot queries do not cross into another. */
const cardTile = (name) => cardTitle(name).closest("div[style]").parentElement;

/** Open the calendar on a slot, by the button's accessible name. */
const openSlot = (label) => fireEvent.click(screen.getByLabelText(new RegExp(`^${label}`)));

/** Choose a day in the open calendar. */
const pickDay = (aria) => fireEvent.click(screen.getByLabelText(aria));

const calendar = () =>
  screen.queryAllByRole("dialog").find(d => /pick a date/i.test(d.getAttribute("aria-label") || ""));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  updateSplitPayment.mockClear();
  store = [DATE_ENTRY, AMOUNT_ENTRY].map(e => ({ ...e, occurrences: e.occurrences.map(o => ({ ...o })) }));
});
afterEach(() => vi.useRealTimers());

describe("date slots", () => {
  it("renders an empty date slot as a button, with no date field anywhere", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Radu - Engleza")).toBeTruthy());

    expect(screen.getByText("Set date").tagName).toBe("BUTTON");
    // Nothing for a stray tap to land on.
    expect(document.querySelectorAll('input[type="date"]')).toHaveLength(0);
  });

  it("opens the calendar on tap and writes nothing by itself", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Radu - Engleza")).toBeTruthy());

    openSlot("Radu - Engleza — installment 2");
    expect(calendar()).toBeTruthy();

    // No value was committed, and nothing was saved.
    expect(screen.getByText("Set date")).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(updateSplitPayment).not.toHaveBeenCalled();
  });

  it("writes the date only once a day is chosen", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Radu - Engleza")).toBeTruthy());

    openSlot("Radu - Engleza — installment 2");
    pickDay("20 September 2026");
    expect(calendar()).toBeUndefined();
    expect(screen.queryByText("Set date")).toBeNull();
    expect(screen.getByText("2026-09-20")).toBeTruthy();
  });

  it("opens the calendar on the month already in the slot", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Radu - Engleza")).toBeTruthy());

    openSlot("Radu - Engleza — installment 1");     // holds 2026-07-10
    expect(within(calendar()).getByText("July 2026")).toBeTruthy();
  });

  it("marks the day the slot holds, and never preselects today", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Radu - Engleza")).toBeTruthy());

    openSlot("Radu - Engleza — installment 1");
    expect(screen.getByLabelText("10 July 2026").getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(within(calendar()).getByText("Cancel"));
    openSlot("Radu - Engleza — installment 2");     // empty
    const pressed = [...calendar().querySelectorAll('[aria-pressed="true"]')];
    expect(pressed).toHaveLength(0);
  });

  it("steps between months without choosing anything", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Radu - Engleza")).toBeTruthy());

    openSlot("Radu - Engleza — installment 1");
    fireEvent.click(screen.getByLabelText("Next month"));
    expect(within(calendar()).getByText("August 2026")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Previous month"));
    fireEvent.click(screen.getByLabelText("Previous month"));
    expect(within(calendar()).getByText("June 2026")).toBeTruthy();

    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(updateSplitPayment).not.toHaveBeenCalled();
  });
});

describe("clearing from inside the calendar", () => {
  it("empties the slot and closes", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Radu - Engleza")).toBeTruthy());

    openSlot("Radu - Engleza — installment 1");
    fireEvent.click(within(calendar()).getByText("Clear"));

    expect(calendar()).toBeUndefined();
    expect(screen.getAllByText("Set date")).toHaveLength(2);
  });

  it("saves the cleared slot", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Radu - Engleza")).toBeTruthy());

    openSlot("Radu - Engleza — installment 1");
    fireEvent.click(within(calendar()).getByText("Clear"));
    await act(async () => { vi.advanceTimersByTime(1000); });

    expect(updateSplitPayment).toHaveBeenCalledWith("s1", {
      occurrences: [{ value: "" }, { value: "" }],
    });
  });

  it("offers nothing to clear on a slot that is already empty", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Radu - Engleza")).toBeTruthy());

    openSlot("Radu - Engleza — installment 2");
    expect(within(calendar()).getByText("Clear").disabled).toBe(true);
  });

  it("leaves the slot alone when the calendar is dismissed", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Radu - Engleza")).toBeTruthy());

    openSlot("Radu - Engleza — installment 1");
    fireEvent.click(within(calendar()).getByText("Cancel"));

    expect(screen.getByText("2026-07-10")).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(updateSplitPayment).not.toHaveBeenCalled();
  });
});

describe("settling the last slot", () => {
  const fillLastDate = () => {
    openSlot("Radu - Engleza — installment 2");
    pickDay("20 September 2026");
  };

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
    openSlot("Radu - Engleza — installment 2");
    fireEvent.click(within(calendar()).getByText("Clear"));
    await act(async () => { vi.advanceTimersByTime(2000); });

    expect(screen.queryByText("Mark as settled?")).toBeNull();
    // Clearing is an ordinary edit, so it saves.
    expect(updateSplitPayment).toHaveBeenCalledWith("s1", {
      occurrences: [{ value: "2026-07-10" }, { value: "" }],
    });
  });
});

describe("the number of slots", () => {
  const slotCount = (title) =>
    within(cardTile(title)).getAllByLabelText(/— installment \d+$|— installment \d+:/).length;

  it("carries no remove control beside a slot", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Radu - Engleza")).toBeTruthy());

    // A ✕ next to a slot reads as "drop this instalment", which the series
    // must never allow. Clearing happens inside the calendar, or by editing.
    expect(screen.queryByText("✕")).toBeNull();
    expect(screen.queryByLabelText(/^Clear /)).toBeNull();
  });

  it("keeps every slot after one is cleared from the calendar", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Radu - Engleza")).toBeTruthy());
    expect(slotCount("Radu - Engleza")).toBe(2);

    openSlot("Radu - Engleza — installment 1");
    fireEvent.click(within(calendar()).getByText("Clear"));

    expect(slotCount("Radu - Engleza")).toBe(2);
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(updateSplitPayment).toHaveBeenCalledWith("s1", {
      occurrences: [{ value: "" }, { value: "" }],
    });
  });

  it("keeps every slot after an amount is emptied", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Anvelope iarna")).toBeTruthy());

    fireEvent.change(screen.getByLabelText("Anvelope iarna — installment 1"), { target: { value: "" } });
    expect(slotCount("Anvelope iarna")).toBe(2);

    await act(async () => { vi.advanceTimersByTime(1000); });
    // Same length as before — an empty slot, not a removed one.
    expect(updateSplitPayment).toHaveBeenCalledWith("s2", {
      occurrences: [{ value: "" }, { value: "" }],
    });
  });

  it("renders the full count even when fewer occurrences were stored", async () => {
    // A series of four whose stored array only has two entries.
    store = [{ ...DATE_ENTRY, occurrenceCount: 4, occurrences: [{ value: "2026-07-10" }, { value: "" }] }];
    renderPage();
    await waitFor(() => expect(screen.getByText("Radu - Engleza")).toBeTruthy());

    expect(slotCount("Radu - Engleza")).toBe(4);
    expect(screen.getByText("1/4")).toBeTruthy();
  });

  it("writes back the full count, so a short array is repaired rather than kept", async () => {
    store = [{ ...DATE_ENTRY, occurrenceCount: 4, occurrences: [{ value: "2026-07-10" }, { value: "" }] }];
    renderPage();
    await waitFor(() => expect(screen.getByText("Radu - Engleza")).toBeTruthy());

    openSlot("Radu - Engleza — installment 3");
    pickDay("20 September 2026");
    await act(async () => { vi.advanceTimersByTime(1000); });

    expect(updateSplitPayment).toHaveBeenCalledWith("s1", {
      occurrences: [{ value: "2026-07-10" }, { value: "" }, { value: "2026-09-20" }, { value: "" }],
    });
  });

  it("never sends occurrenceCount, so a save cannot resize the series", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Radu - Engleza")).toBeTruthy());

    openSlot("Radu - Engleza — installment 1");
    fireEvent.click(within(calendar()).getByText("Clear"));
    await act(async () => { vi.advanceTimersByTime(1000); });

    const [, body] = updateSplitPayment.mock.calls.at(-1);
    expect(Object.keys(body)).toEqual(["occurrences"]);
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
