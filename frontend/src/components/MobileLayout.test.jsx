import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect } from "vitest";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { username: "nenciulescu" }, signOut: vi.fn() }),
}));

const { default: MobileLayout } = await import("./MobileLayout");

const renderBar = () =>
  render(<MemoryRouter><MobileLayout><div /></MobileLayout></MemoryRouter>);

describe("MobileLayout tab bar", () => {
  it("has exactly four tabs", () => {
    renderBar();
    const links = [...document.querySelectorAll("nav a")];
    expect(links.map(a => a.textContent)).toEqual([
      "Finance", "Split Pay", "Investments", "Stats",
    ]);
  });

  it("renames Home to Finance and points it at the root", () => {
    renderBar();
    // note: "Home" still appears in the "4TURA Home" brand, so scope to the nav
    const nav = document.querySelector("nav");
    expect(nav.textContent).not.toContain("Home");
    expect(screen.getByText("Finance").closest("a").getAttribute("href")).toBe("/");
  });

  it("no longer exposes Add Expense / Add Income as tabs", () => {
    renderBar();
    expect(screen.queryByText("Add Expense")).toBeNull();
    expect(screen.queryByText("Add Income")).toBeNull();
    const hrefs = [...document.querySelectorAll("nav a")].map(a => a.getAttribute("href"));
    expect(hrefs).not.toContain("/add-expense");
    expect(hrefs).not.toContain("/add-income");
  });
});
