import { render, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect } from "vitest";

const auth = { user: { username: "nenciulescu" }, signOut: vi.fn() };
const appSettings = { settings: { backstageEnabled: true } };

vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../context/AppSettingsContext", () => ({ useAppSettings: () => appSettings }));
vi.mock("../api/client", () => ({ getAuthToken: () => null }));

const { default: MobileLayout } = await import("./MobileLayout");

const renderBar = () =>
  render(<MemoryRouter><MobileLayout><div /></MobileLayout></MemoryRouter>);

const tabLabels = () =>
  [...document.querySelectorAll("nav button")].map(b => b.textContent);

const sheet = () => document.querySelector('[role="dialog"]');

// Scoped to the bar: an open sheet carries the same aria-label as its tab.
const tab = label => within(document.querySelector("nav")).getByLabelText(label);

describe("MobileLayout tab bar", () => {
  it("mirrors the desktop nav groups", () => {
    renderBar();
    expect(tabLabels()).toEqual(["Home", "Finance", "Evolve", "HQ"]);
  });

  it("opens the Finance group as a sheet rather than navigating", () => {
    renderBar();
    expect(sheet()).toBeNull();

    fireEvent.click(tab("Finance"));

    const items = within(sheet()).getAllByRole("button").map(b => b.textContent);
    expect(items).toEqual(expect.arrayContaining([
      "Dashboard", "Add Income", "Add Expense", "Split Pay", "Statistics", "Investments",
    ]));
  });

  it("closes an open sheet when its tab is tapped again", () => {
    renderBar();
    fireEvent.click(tab("Finance"));
    expect(sheet()).not.toBeNull();
    fireEvent.click(tab("Finance"));
    expect(sheet()).toBeNull();
  });

  it("has no System tab", () => {
    renderBar();
    expect(tabLabels()).not.toContain("System");
  });
  it("keeps Add Expense / Add Income out of the bar itself", () => {
    renderBar();
    expect(tabLabels()).not.toContain("Add Expense");
    expect(tabLabels()).not.toContain("Add Income");
  });
});

describe("MobileLayout account menu", () => {
  const menuLabels = () => {
    fireEvent.click(within(document.querySelector("header")).getByLabelText("Account"));
    return within(document.querySelector('[role="menu"]'))
      .getAllByRole("menuitem").map(b => b.textContent);
  };

  it("lists Settings and Admin above Sign out for the admin user", () => {
    appSettings.settings = { backstageEnabled: false };
    try {
      renderBar();
      expect(menuLabels()).toEqual(["Settings", "Admin", "Sign out"]);
    } finally {
      appSettings.settings = { backstageEnabled: true };
    }
  });

  it("adds Backstage only when the app setting is on", () => {
    renderBar();
    expect(menuLabels()).toEqual(["Settings", "Backstage", "Admin", "Sign out"]);
  });

  it("hides Admin from other users", () => {
    auth.user = { username: "someone-else" };
    appSettings.settings = { backstageEnabled: false };
    try {
      renderBar();
      expect(menuLabels()).toEqual(["Settings", "Sign out"]);
    } finally {
      appSettings.settings = { backstageEnabled: true };
      auth.user = { username: "nenciulescu" };
    }
  });
});
