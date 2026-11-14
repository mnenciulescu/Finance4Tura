import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderApp } from "../../test/utils";

vi.setSystemTime(new Date("2026-09-15T10:00:00Z"));
afterAll(() => vi.useRealTimers());

const entry = (id: string, name: string, dateCompleted: string, extra: any = {}) => ({
  bookId: id, name, dateCompleted, title: `${name} ${id}`, author: "A", source: "Book", type: "Book", rating: null, comments: "", ...extra,
});
const BOOKS = [
  entry("m1", "Mihai", "2026-09", { rating: 4, type: "Audiobook", source: "Voxa" }),
  entry("m2", "Mihai", "2026-08", { rating: 2 }),
  entry("m3", "Mihai", "2026-07", { type: "Training", source: "Udemy" }),
  ...["2026-05", "2026-04", "2026-03", "2026-02", "2026-01", "2025-12"].map((d, i) => entry(`mo${i}`, "Mihai", d)),
  entry("m4", "Mihai", "2026-09", { type: "Other", source: "Other" }),
  entry("r1", "Radu", "2025-09"),
  entry("u1", "", "2026-09"),
];
let books: any[] = [];
const updateBook = vi.fn((id: string, body: any) => Promise.resolve({ ...body, bookId: id }));
vi.mock("../../api/booksAndDev", async orig => ({
  ...(await orig<object>()),
  listBooks: () => Promise.resolve(books.map(b => ({ ...b }))),
  updateBook: (...a: any[]) => (updateBook as any)(...a),
}));

const { default: Library } = await import("./Library");
const section = (name: string) => document.querySelector(`[data-person="${name}"]`) as HTMLElement;
const counts = (name: string) => section(name).querySelector('[data-chart="monthly"]')!.getAttribute("data-counts");

beforeEach(() => { books = BOOKS.map(b => ({ ...b })); updateBook.mockClear(); });

describe("Library", () => {
  it("groups one section per person, alphabetical, Unassigned last", async () => {
    renderApp(<Library />);
    await screen.findByText(/3 people · 12 of 12 entries/);
    expect([...document.querySelectorAll("[data-person]")].map(e => e.getAttribute("data-person"))).toEqual(["Mihai", "Radu", "Unassigned"]);
  });

  it("charts completions per month over the last 12 months, any type or source", async () => {
    renderApp(<Library />);
    await screen.findByText(/3 people/);
    expect(counts("Mihai")).toBe("0,0,1,1,1,1,1,1,0,1,1,2");
    expect(counts("Radu")).toBe(Array(12).fill(0).join(","));
  });

  it("reveals 1 → 6 → 10, then steps back exactly", async () => {
    renderApp(<Library />);
    await screen.findByText(/3 people/);
    const mihai = () => within(section("Mihai"));
    expect(mihai().getByText("Mihai m1")).toBeInTheDocument();
    expect(mihai().queryByText("Mihai m2")).toBeNull();
    fireEvent.click(mihai().getByRole("button", { name: /Show 5 More/ }));
    expect(mihai().getByText("Mihai mo1")).toBeInTheDocument();
    fireEvent.click(mihai().getByRole("button", { name: /Show 4 More/ }));
    expect(mihai().getByText("Mihai mo5")).toBeInTheDocument();
    fireEvent.click(mihai().getByRole("button", { name: "Show 4 Less" }));
    expect(mihai().queryByText("Mihai mo2")).toBeNull();
    fireEvent.click(mihai().getByRole("button", { name: "Show 5 Less" }));
    expect(mihai().queryByText("Mihai m2")).toBeNull();
  });

  it("filters by search and clears", async () => {
    renderApp(<Library />);
    await screen.findByText(/12 of 12 entries/);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search title or author" }), { target: { value: "Radu" } });
    expect(await screen.findByText(/1 person · 1 of 12 entries/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(await screen.findByText(/12 of 12 entries/)).toBeInTheDocument();
  });

  it("collapses a person's section", async () => {
    renderApp(<Library />);
    await screen.findByText(/3 people/);
    fireEvent.click(screen.getByRole("button", { name: /^Mihai \(10\)$/ }));
    expect(section("Mihai")).toBeNull();
  });

  it("re-rates inline, optimistically", async () => {
    renderApp(<Library />);
    await screen.findByText(/3 people/);
    const card = document.querySelector('[data-book="m1"]') as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: "5 stars" }));
    await waitFor(() => expect(updateBook).toHaveBeenCalledWith("m1", expect.objectContaining({ rating: 5 })));
  });
});
