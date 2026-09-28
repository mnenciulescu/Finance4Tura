/**
 * The Split Pay page. Its slots mirror the Home Overview block: two per row,
 * an amount is typed, a date opens the app's own calendar, and neither kind
 * has a control beside it — the number of slots belongs to the series and is
 * fixed when it is created.
 */
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

const DATE_ENTRY = {
  splitPaymentId: "s1", title: "Excursie Grecia", createdDate: "2026-09-02",
  totalAmount: 900, currency: "EUR", occurrenceCount: 4, occurrenceType: "date",
  occurrences: [{ value: "2026-07-10" }, { value: "" }, { value: "" }, { value: "" }],
};
const AMOUNT_ENTRY = {
  splitPaymentId: "s2", title: "Anvelope iarna", createdDate: "2026-08-14",
  totalAmount: 2400, currency: "RON", occurrenceCount: 3, occurrenceType: "amount",
  occurrences: [{ value: "800" }, { value: "800" }, { value: "" }],
};

let store = [];
const updateSplitPayment = vi.fn(() => Promise.resolve({}));

vi.mock("../api/splitPayments", () => ({
  listSplitPayments: () => Promise.resolve(store.map(e => ({ ...e, occurrences: e.occurrences.map(o => ({ ...o })) }))),
  createSplitPayment: vi.fn(),
  updateSplitPayment,
  deleteSplitPayment: vi.fn(),
}));

const { default: SplitPayment } = await import("./SplitPayment");

const renderPage = () => render(<SplitPayment />);

// Scoped by the slots' own accessible names rather than by walking the DOM:
// every slot's label starts with its entry's title, so no shape guessing.
const rx = (t) => new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} — installment`);
const slotsIn  = (title) => screen.getAllByLabelText(rx(title));
const openSlot = (label) => fireEvent.click(screen.getByLabelText(new RegExp(`^${label}`)));

/** The nearest ancestor that actually declares the slot grid. */
const gridOf = (el) => {
  let n = el;
  while (n && !n.style?.gridTemplateColumns) n = n.parentElement;
  return n;
};
const calendar = () =>
  screen.queryAllByRole("dialog").find(d => /pick a date/i.test(d.getAttribute("aria-label") || ""));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  updateSplitPayment.mockClear();
  store = [DATE_ENTRY, AMOUNT_ENTRY].map(e => ({ ...e, occurrences: e.occurrences.map(o => ({ ...o })) }));
});
afterEach(() => vi.useRealTimers());

describe("slot layout", () => {
  it("lays every entry out two slots per row, whatever it tracks", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Excursie Grecia")).toBeTruthy());

    for (const title of ["Excursie Grecia", "Anvelope iarna"]) {
      const grid = gridOf(slotsIn(title)[0]);
      expect(grid).toBeTruthy();
      expect(grid.style.gridTemplateColumns).toBe("repeat(2, minmax(0, 1fr))");
    }
  });

  it("shows one slot per occurrence and no more", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Excursie Grecia")).toBeTruthy());

    expect(slotsIn("Excursie Grecia")).toHaveLength(4);
    expect(slotsIn("Anvelope iarna")).toHaveLength(3);
  });

  it("carries no remove or quick-fill control beside a slot", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Excursie Grecia")).toBeTruthy());

    // Scoped to the grids: the page header has its own "+ New".
    for (const title of ["Excursie Grecia", "Anvelope iarna"]) {
      const grid = gridOf(slotsIn(title)[0]);
      expect(within(grid).queryByText("✕")).toBeNull();
      expect(within(grid).queryByText("+")).toBeNull();
      expect(within(grid).queryAllByRole("button")).toHaveLength(
        title === "Excursie Grecia" ? 4 : 0);   // date slots are buttons; amounts are fields
    }
  });
});

describe("date slots", () => {
  it("renders as buttons, with no date field to mis-tap", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Excursie Grecia")).toBeTruthy());

    expect(document.querySelectorAll('input[type="date"]')).toHaveLength(0);
    expect(screen.getAllByText("Set date")).toHaveLength(3);
  });

  it("opens the calendar without writing anything", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Excursie Grecia")).toBeTruthy());

    openSlot("Excursie Grecia — installment 2");
    expect(calendar()).toBeTruthy();

    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(updateSplitPayment).not.toHaveBeenCalled();
  });

  it("fills the slot when a day is chosen", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Excursie Grecia")).toBeTruthy());

    openSlot("Excursie Grecia — installment 2");
    fireEvent.click(screen.getByLabelText("20 September 2026"));
    await act(async () => { vi.advanceTimersByTime(1000); });

    expect(updateSplitPayment).toHaveBeenCalledWith("s1", {
      occurrences: [
        { index: 0, value: "2026-07-10" }, { index: 1, value: "2026-09-20" },
        { index: 2, value: "" },           { index: 3, value: "" },
      ],
    });
  });

  it("empties the slot from the calendar's Clear, keeping the slot", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Excursie Grecia")).toBeTruthy());

    openSlot("Excursie Grecia — installment 1");
    fireEvent.click(within(calendar()).getByText("Clear"));
    await act(async () => { vi.advanceTimersByTime(1000); });

    expect(slotsIn("Excursie Grecia")).toHaveLength(4);
    expect(updateSplitPayment).toHaveBeenCalledWith("s1", {
      occurrences: [
        { index: 0, value: "" }, { index: 1, value: "" },
        { index: 2, value: "" }, { index: 3, value: "" },
      ],
    });
  });

  it("offers nothing to clear on a slot that is already empty", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Excursie Grecia")).toBeTruthy());

    openSlot("Excursie Grecia — installment 2");
    expect(within(calendar()).getByText("Clear").disabled).toBe(true);
  });
});

describe("amount slots", () => {
  it("stay typable", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Anvelope iarna")).toBeTruthy());

    const field = screen.getByLabelText("Anvelope iarna — installment 3");
    expect(field.tagName).toBe("INPUT");
    expect(field.getAttribute("type")).toBe("number");
  });

  it("empty by editing, without losing the slot", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Anvelope iarna")).toBeTruthy());

    fireEvent.change(screen.getByLabelText("Anvelope iarna — installment 1"), { target: { value: "" } });
    expect(slotsIn("Anvelope iarna")).toHaveLength(3);

    await act(async () => { vi.advanceTimersByTime(1000); });
    const [, body] = updateSplitPayment.mock.calls.at(-1);
    expect(body.occurrences).toHaveLength(3);
    expect(Object.keys(body)).toEqual(["occurrences"]);
  });

  it("keeps Cover rest and Clear all as entry-level actions", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Anvelope iarna")).toBeTruthy());

    // Cover rest is amount-only; Clear all is offered on both entries.
    expect(screen.getAllByText(/^Cover rest/)).toHaveLength(1);
    expect(screen.getAllByText("Clear all")).toHaveLength(2);
  });
});

describe("settling the last slot", () => {
  it("asks first, and holds the save", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Anvelope iarna")).toBeTruthy());

    fireEvent.change(screen.getByLabelText("Anvelope iarna — installment 3"), { target: { value: "800" } });
    await act(async () => { vi.advanceTimersByTime(800); });

    expect(screen.getByText("Mark as settled?")).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(updateSplitPayment).not.toHaveBeenCalled();
  });

  it("asks when the last date slot is filled from the calendar too", async () => {
    store = [{ ...DATE_ENTRY, occurrenceCount: 2, occurrences: [{ value: "2026-07-10" }, { value: "" }] }];
    renderPage();
    await waitFor(() => expect(screen.getByText("Excursie Grecia")).toBeTruthy());

    openSlot("Excursie Grecia — installment 2");
    fireEvent.click(screen.getByLabelText("20 September 2026"));
    await act(async () => { vi.advanceTimersByTime(800); });

    expect(screen.getByText("Mark as settled?")).toBeTruthy();
  });
});
