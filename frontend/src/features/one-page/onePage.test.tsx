import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderApp } from "../../test/utils";
import { LayoutContext } from "../../ui/layout";
import { Sheet, SwipeActions } from "../../ui";

vi.setSystemTime(new Date("2026-09-15T10:00:00Z"));
afterAll(() => vi.useRealTimers());

const pad = (n: number) => String(n).padStart(2, "0");
const INCOMES = Array.from({ length: 12 }, (_, i) => ({
  incomeId: `i${i + 1}`, seriesId: "sal", summary: "Salary", date: `2026-${pad(i + 1)}-10`, amount: 10000, currency: "RON",
}));
const EXPENSES = Array.from({ length: 7 }, (_, i) => ({
  expenseId: `e${i + 1}`, seriesId: `e${i + 1}`, summary: `Bill ${i + 1}`, date: `2026-09-${pad(11 + i)}`, amount: 100 * (i + 1),
  priority: "High", status: "Pending", mappedIncomeId: "i9",
}));
const SPLITS = [
  { splitPaymentId: "s1", title: "Laptop", totalAmount: 1200, currency: "RON", occurrenceCount: 4, occurrenceType: "amount", createdDate: "2026-09-01", occurrences: [{ index: 0, value: 300 }, { index: 1, value: "" }, { index: 2, value: "" }, { index: 3, value: "" }] },
];
const SNAPSHOTS = [
  { snapshotId: "p1", date: "2026-08-31", platform: "eToro", amount: 5000, currency: "EUR" },
  { snapshotId: "p2", date: "2026-08-31", platform: "Fidelity", amount: 3000, currency: "EUR" },
];
const BOOKS = Array.from({ length: 5 }, (_, i) => ({
  bookId: `b${i + 1}`, name: i < 3 ? "Ana" : "Radu", title: `Book ${i + 1}`, author: "A", source: "Book", type: "Book", dateCompleted: `2026-0${i + 1}`, rating: 4, comments: "",
}));

vi.mock("../../api/incomes", async orig => ({ ...(await orig<object>()), listIncomes: () => Promise.resolve(INCOMES) }));
vi.mock("../../api/expenses", async orig => ({
  ...(await orig<object>()),
  listExpenses: () => Promise.resolve(EXPENSES.map(e => ({ ...e }))),
  resolveIncome: () => Promise.resolve({ income: INCOMES[8] }),
}));
vi.mock("../../api/splitPayments", async orig => ({ ...(await orig<object>()), listSplitPayments: () => Promise.resolve(SPLITS) }));
vi.mock("../../api/investments", async orig => ({
  ...(await orig<object>()),
  listSnapshots: () => Promise.resolve(SNAPSHOTS),
  listOperations: () => Promise.resolve([]),
}));
vi.mock("../../api/fxRates", async orig => ({ ...(await orig<object>()), getFxRates: () => Promise.resolve({ rates: null, updatedAt: null }) }));
vi.mock("../../api/booksAndDev", async orig => ({ ...(await orig<object>()), listBooks: () => Promise.resolve(BOOKS) }));
vi.mock("../../api/headquarters", async orig => ({
  ...(await orig<object>()),
  listLocations: () => Promise.resolve([{ hqId: "h1", name: "Politehnicii", order: 1 }, { hqId: "h2", name: "Mosoaia", order: 2 }]),
  listTemplates: () => Promise.resolve([]),
  listEntries: () => Promise.resolve([]),
}));

const { default: OnePage } = await import("./OnePage");

const renderPage = (route = "/one-page") => renderApp(
  <LayoutContext.Provider value="desk"><OnePage /></LayoutContext.Provider>,
  { route },
);
const block = (id: string) => document.querySelector(`[data-block="${id}"]`) as HTMLElement;
const location = () => screen.getByTestId("location").textContent ?? "";

beforeEach(() => {
  window.innerWidth = 1440;
});

describe("One-Page — layout", () => {
  it("shows all nine blocks", async () => {
    renderPage();
    for (const name of [
      "Budget", "Budget Statistics", "Split Payments", "Investment Statistics", "Investments",
      "HQ Statistics", "HQ", "Library Statistics", "Library",
    ]) {
      expect(await screen.findByRole("heading", { name, level: 2 })).toBeInTheDocument();
    }
    expect(document.documentElement).toHaveAttribute("data-layout", "desk");
  });
});

describe("One-Page — Budget", () => {
  it("opens on the current period and shows every expense, with no Show More", async () => {
    renderPage();
    await within(block("budget")).findByText("Period 9 of 12");
    await waitFor(() => expect(block("budget").querySelectorAll("[data-expense]")).toHaveLength(7));
    expect(within(block("budget")).queryByRole("button", { name: /Show .*(More|Less)/ })).toBeNull();
  });

  it("steps periods with the arrows and keeps the choice in the URL", async () => {
    renderPage();
    await within(block("budget")).findByText("Period 9 of 12");
    fireEvent.click(within(block("budget")).getByRole("button", { name: "Previous period" }));
    expect(within(block("budget")).getByText("Period 8 of 12")).toBeInTheDocument();
    expect(location()).toContain("period=i8");
    fireEvent.click(within(block("budget")).getByRole("button", { name: "Today" }));
    expect(location()).not.toContain("period=");
  });

  it("follows the income-privacy setting", async () => {
    renderPage();
    await within(block("budget")).findByText("Period 9 of 12");
    const header = block("budget").querySelector("[data-period]") as HTMLElement;
    expect(within(header).getByRole("img", { name: "Hidden amount" })).toBeInTheDocument();
    fireEvent.click(within(block("budget")).getByRole("button", { name: "Show income amounts" }));
    expect(within(header).queryByRole("img", { name: "Hidden amount" })).toBeNull();
    expect(localStorage.getItem("incomePrivacy")).toBe("true");
  });
});

describe("One-Page — navigation state", () => {
  it("restores tabs from the URL and writes tab changes back", async () => {
    renderPage("/one-page?stats=prio");
    expect(await within(block("budgetStats")).findByRole("tab", { name: "Priorities", selected: true })).toBeInTheDocument();
    fireEvent.click(within(block("invest")).getByRole("tab", { name: "Snapshots" }));
    expect(location()).toContain("inv=snapshots");
    expect(location()).toContain("stats=prio");
  });

  it("falls back to defaults for unknown values", async () => {
    renderPage("/one-page?stats=nope&inv=zzz");
    expect(await within(block("budgetStats")).findByRole("tab", { name: "Budget", selected: true })).toBeInTheDocument();
    expect(within(block("invest")).getByRole("tab", { name: "Portfolio", selected: true })).toBeInTheDocument();
  });

  it("opens a form from a deep link and consumes the parameters", async () => {
    renderPage("/one-page?expense=new&date=2026-09-01");
    expect(await screen.findByRole("dialog", { name: "New Expense" }, { timeout: 5000 })).toBeInTheDocument();
    expect(location()).not.toContain("expense=");
  });
});

describe("One-Page — sensitive values", () => {
  it("masks holdings until the eye is held", async () => {
    renderPage();
    const invest = block("invest");
    await within(invest).findByText("eToro");
    const hidden = () => within(invest).queryAllByRole("img", { name: "Hidden amount" }).length;
    expect(hidden()).toBeGreaterThan(0);
    const eye = within(invest).getByRole("button", { name: "Hold to reveal amounts" });
    fireEvent.mouseDown(eye);
    expect(hidden()).toBe(0);
    fireEvent.mouseUp(eye);
    expect(hidden()).toBeGreaterThan(0);
  });
});

describe("One-Page — keyboard", () => {
  it("N then E opens New Expense; arrows change the period", async () => {
    renderPage();
    await within(block("budget")).findByText("Period 9 of 12");
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(within(block("budget")).getByText("Period 8 of 12")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "t" });
    expect(within(block("budget")).getByText("Period 9 of 12")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "n" });
    fireEvent.keyDown(window, { key: "e" });
    expect(await screen.findByRole("dialog", { name: "New Expense" }, { timeout: 5000 })).toBeInTheDocument();
  });

  it("ignores shortcuts while typing", async () => {
    renderPage();
    const search = await within(block("library")).findByRole("searchbox", { name: "Search title or author" });
    fireEvent.keyDown(search, { key: "h" });
    expect(screen.getByRole("button", { name: "Show income amounts" })).toBeInTheDocument();
  });
});

describe("One-Page — HQ", () => {
  it("has a tab per location, no Overview, and opens on Mosoaia", async () => {
    renderPage();
    const hq = block("hq");
    expect(await within(hq).findByRole("tab", { name: "Mosoaia", selected: true })).toBeInTheDocument();
    expect(within(hq).getByRole("tab", { name: "Politehnicii", selected: false })).toBeInTheDocument();
    expect(within(hq).queryByRole("tab", { name: "Overview" })).toBeNull();
    fireEvent.click(within(hq).getByRole("tab", { name: "Politehnicii" }));
    expect(location()).toContain("hq=h1");
    fireEvent.click(within(hq).getByRole("tab", { name: "Mosoaia" }));
    expect(location()).not.toContain("hq=");
  });
});

describe("One-Page — header", () => {
  it("has no + New or income eye; those live in the blocks", async () => {
    renderPage();
    const header = (await screen.findByRole("button", { name: "Refresh" })).closest("header") as HTMLElement;
    expect(within(header).queryByRole("button", { name: "New" })).toBeNull();
    expect(within(header).queryByRole("button", { name: /income amounts/ })).toBeNull();
  });
});

describe("One-Page — columns", () => {
  it("fits four columns from 1520 px, three from 1144 px, two from 1024 px", async () => {
    const { columnsFor } = await import("./state");
    expect([1920, 1520, 1519, 1440, 1144, 1143, 1024, 1023].map(columnsFor)).toEqual([4, 4, 3, 3, 3, 2, 2, 1]);
  });
});

describe("One-Page — theme", () => {
  it("switches Light / Dark and stores the shared setting", async () => {
    renderPage();
    const group = await screen.findByRole("radiogroup", { name: "Appearance" });
    fireEvent.click(within(group).getByRole("radio", { name: "Dark" }));
    expect(localStorage.getItem("uiTheme")).toBe("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });
});

describe("Desktop presentation of shared components", () => {
  it("shows a Sheet as a dialog with a close button and no grabber", async () => {
    const onClose = vi.fn();
    renderApp(
      <LayoutContext.Provider value="desk">
        <Sheet isOpen onClose={onClose} title="Example"><p>Body</p></Sheet>
      </LayoutContext.Provider>,
    );
    const dialog = await screen.findByRole("dialog", { name: "Example" });
    expect(dialog.closest("[data-presentation='dialog']")).not.toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("turns swipe actions into hover buttons with a two-step delete", async () => {
    const onDelete = vi.fn();
    renderApp(
      <LayoutContext.Provider value="desk">
        <SwipeActions actions={[{ label: "Edit", icon: "pencil", onAction: vi.fn() }, { label: "Delete", icon: "trash", destructive: true, onAction: onDelete }]}>
          <div>Row</div>
        </SwipeActions>
      </LayoutContext.Provider>,
    );
    const del = await screen.findByRole("button", { name: "Delete" });
    fireEvent.click(del);
    expect(onDelete).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" })); });
    expect(onDelete).toHaveBeenCalledOnce();
  });
});
