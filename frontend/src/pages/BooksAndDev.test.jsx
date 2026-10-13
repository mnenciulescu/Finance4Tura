import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterAll } from "vitest";

// "now" is pinned so the rolling 12-month window is deterministic:
// 2025-10 .. 2026-09 are inside it; 2025-09 and earlier are not.
vi.setSystemTime(new Date("2026-09-15T10:00:00Z"));
afterAll(() => vi.useRealTimers());

// recharts measures with ResizeObserver, which jsdom does not implement
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

const entry = (id, name, dateCompleted, extra = {}) => ({
  bookId: id, name, dateCompleted, title: `${name} ${id}`,
  author: "A", source: "Book", type: "Book", rating: null, comments: "", ...extra,
});

const books = [
  // Mihai — 10 inside the window, mixed types and sources, two in 2026-09
  entry("m1", "Mihai", "2026-09", { rating: 4, type: "Audiobook", source: "Voxa" }),
  entry("m2", "Mihai", "2026-08", { rating: 2 }),
  entry("m3", "Mihai", "2026-07", { type: "Training", source: "Udemy" }),
  ...["2026-05", "2026-04", "2026-03", "2026-02", "2026-01", "2025-12"]
    .map((d, i) => entry(`mo${i}`, "Mihai", d)),
  entry("m4", "Mihai", "2026-09", { type: "Other", source: "Other" }),
  // Radu — nothing in the window
  entry("r1", "Radu", "2025-09"),
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

  it("charts entries completed per month over the last 12 months, any type or source", async () => {
    render(<BooksAndDev />);
    await waitFor(() => expect(screen.getByText("Mihai")).toBeTruthy());

    // Oldest first: 2025-10 .. 2026-09.
    const counts = section("Mihai").querySelector('[data-chart="monthly"]').getAttribute("data-counts");
    expect(counts).toBe("0,0,1,1,1,1,1,1,0,1,1,2");
    expect(stat("Mihai", "count")).toBe("10");
    expect(within(section("Mihai")).getByText("Last 12 months")).toBeTruthy();
  });

  it("shows a flat zero series when nothing falls in the window", async () => {
    render(<BooksAndDev />);
    await waitFor(() => expect(screen.getByText("Radu")).toBeTruthy());

    const counts = section("Radu").querySelector('[data-chart="monthly"]').getAttribute("data-counts");
    expect(counts).toBe(Array(12).fill(0).join(","));
    expect(stat("Radu", "count")).toBe("0");
  });

  it("shows only the latest entry until more are requested", async () => {
    render(<BooksAndDev />);
    await waitFor(() => expect(screen.getByText("Mihai")).toBeTruthy());

    // Newest first: only 2026-09 is visible for Mihai to begin with.
    expect(screen.getByText("Mihai m1")).toBeTruthy();
    expect(screen.queryByText("Mihai m2")).toBeNull();

    fireEvent.click(within(section("Mihai")).getByText(/Show 5 more/));

    // 1 + 5 = 6 of Mihai's 10 entries: m1, m4, m2, m3, mo0, mo1
    expect(screen.getByText("Mihai m2")).toBeTruthy();
    expect(screen.getByText("Mihai mo1")).toBeTruthy();
    expect(screen.queryByText("Mihai mo2")).toBeNull();
  });

  it("collapses a person's section", async () => {
    render(<BooksAndDev />);
    await waitFor(() => expect(screen.getByText("Mihai")).toBeTruthy());

    expect(screen.getByText("Mihai m1")).toBeTruthy();
    fireEvent.click(screen.getByText("Mihai"));
    expect(screen.queryByText("Mihai m1")).toBeNull();
  });
});
