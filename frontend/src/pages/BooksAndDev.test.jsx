import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterAll } from "vitest";

// "now" is pinned so the rolling 3-month window is deterministic:
// 2026-09, 2026-08, 2026-07 are inside it; 2026-05 and earlier are not.
vi.setSystemTime(new Date("2026-09-15T10:00:00Z"));
afterAll(() => vi.useRealTimers());

const entry = (id, name, dateCompleted, extra = {}) => ({
  bookId: id, name, dateCompleted, title: `${name} ${id}`,
  author: "A", source: "Book", type: "Book", rating: null, comments: "", ...extra,
});

const books = [
  // Mihai — 3 inside the window (one rated 4, one rated 2), 6 older
  entry("m1", "Mihai", "2026-09", { rating: 4, type: "Audiobook" }),
  entry("m2", "Mihai", "2026-08", { rating: 2 }),
  entry("m3", "Mihai", "2026-07", { type: "Training" }),
  ...["2026-05", "2026-04", "2026-03", "2026-02", "2026-01", "2025-12"]
    .map((d, i) => entry(`mo${i}`, "Mihai", d)),
  // Radu — nothing recent
  entry("r1", "Radu", "2025-11"),
  // No person set
  entry("u1", "", "2026-09"),
];

vi.mock("../api/booksAndDev", () => ({
  listBooks:  () => Promise.resolve(books),
  createBook: vi.fn(),
  updateBook: vi.fn(() => Promise.resolve({})),
  deleteBook: vi.fn(() => Promise.resolve({})),
}));

const { default: BooksAndDev } = await import("./BooksAndDev");

const section = (name) => document.querySelector(`[data-person="${name}"]`);
const stat    = (name, which) => section(name).querySelector(`[data-stat="${which}"]`).textContent.trim();

beforeEach(() => vi.setSystemTime(new Date("2026-09-15T10:00:00Z")));

describe("Books & Development — per-person sections", () => {
  it("groups into one section per person, unassigned last", async () => {
    render(<BooksAndDev />);
    await waitFor(() => expect(screen.getByText("Mihai")).toBeTruthy());

    expect(screen.getByText("Radu")).toBeTruthy();
    expect(screen.getByText("Unassigned")).toBeTruthy();

    const order = [...document.querySelectorAll("[data-person]")]
      .map(el => el.getAttribute("data-person"));
    expect(order).toEqual(["Mihai", "Radu", "Unassigned"]);
  });

  it("counts only the last 3 months in the summary", async () => {
    render(<BooksAndDev />);
    await waitFor(() => expect(screen.getByText("Mihai")).toBeTruthy());

    // Mihai has 9 entries but only 3 fall inside 2026-07..2026-09.
    expect(stat("Mihai", "count")).toBe("3");
    // Ratings present in the window are 4 and 2 → 3.0
    expect(stat("Mihai", "avg")).toBe("★ 3.0");
  });

  it("shows a dash for average when nothing in the window is rated", async () => {
    render(<BooksAndDev />);
    await waitFor(() => expect(screen.getByText("Radu")).toBeTruthy());

    expect(stat("Radu", "count")).toBe("0");
    expect(stat("Radu", "avg")).toBe("—");
  });

  it("shows only the latest entry until more are requested", async () => {
    render(<BooksAndDev />);
    await waitFor(() => expect(screen.getByText("Mihai")).toBeTruthy());

    // Newest first: only 2026-09 is visible for Mihai to begin with.
    expect(screen.getByText("Mihai m1")).toBeTruthy();
    expect(screen.queryByText("Mihai m2")).toBeNull();

    fireEvent.click(within(section("Mihai")).getByText(/Show 5 more/));

    // 1 + 5 = 6 of Mihai's 9 entries
    expect(screen.getByText("Mihai m2")).toBeTruthy();
    expect(screen.getByText("Mihai mo2")).toBeTruthy();
    expect(screen.queryByText("Mihai mo5")).toBeNull();
  });

  it("collapses a person's section", async () => {
    render(<BooksAndDev />);
    await waitFor(() => expect(screen.getByText("Mihai")).toBeTruthy());

    expect(screen.getByText("Mihai m1")).toBeTruthy();
    fireEvent.click(screen.getByText("Mihai"));
    expect(screen.queryByText("Mihai m1")).toBeNull();
  });
});
