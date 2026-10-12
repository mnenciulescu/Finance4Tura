import { render, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { vi, describe, it, expect } from "vitest";

const auth = { user: { username: "nenciulescu" }, signOut: vi.fn() };
const appSettings = { settings: { backstageEnabled: true } };

vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../context/AppSettingsContext", () => ({ useAppSettings: () => appSettings }));
vi.mock("../api/client", () => ({ getAuthToken: () => null }));

const { default: MobileLayout } = await import("./MobileLayout");
const { DUSK } = await import("../utils/colors");

// Prints the current location so a test can see where a tab went.
function Where() {
  const { pathname, state } = useLocation();
  return <div data-testid="where" data-state={JSON.stringify(state ?? null)}>{pathname}</div>;
}

const renderBar = (path = "/") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <MobileLayout><Where /></MobileLayout>
    </MemoryRouter>
  );

const where = () => document.querySelector('[data-testid="where"]');

const tabLabels = () =>
  [...document.querySelectorAll("nav button")].map(b => b.textContent);

const tab = label => within(document.querySelector("nav")).getByLabelText(label);

describe("MobileLayout tab bar", () => {
  it("mirrors the desktop nav groups", () => {
    renderBar();
    expect(tabLabels()).toEqual(["Home", "Finance", "Books", "HQ"]);
  });

  it("sends Finance straight to the Dashboard, with no sheet", () => {
    renderBar();
    fireEvent.click(tab("Finance"));

    expect(where().textContent).toBe("/finance");
    // Asks the Dashboard to return to the current income column.
    expect(JSON.parse(where().dataset.state)).toHaveProperty("resetDashboard");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("keeps Finance highlighted on every Finance page", () => {
    for (const path of ["/finance", "/add-income", "/add-expense",
                        "/split-payments", "/statistics", "/investments"]) {
      const { unmount } = renderBar(path);
      expect(tab("Finance").getAttribute("aria-current"), path).toBe("page");
      unmount();
    }
  });

  it("draws theme-matched duotone icons: outline in currentColor over a soft Dusk fill", () => {
    renderBar();
    const svgs = [...document.querySelectorAll("nav button svg")];
    expect(svgs).toHaveLength(4);
    for (const svg of svgs) {
      // Outline follows the theme through currentColor…
      expect(svg.getAttribute("stroke")).toBe("currentColor");
      // …over a translucent fill from the app's own palette; no gradients.
      expect(svg.querySelector("linearGradient, radialGradient, filter")).toBeNull();
      const tint = svg.querySelector("[fill-opacity]");
      expect(tint).not.toBeNull();
      expect(Object.values(DUSK)).toContain(tint.getAttribute("fill"));
    }
  });

  it("marks the active tab in the theme accent", () => {
    renderBar("/finance");
    const capsule = tab("Finance").querySelector("svg").parentElement;
    expect(capsule.style.color).toBe("var(--accent)");
    expect(tab("Home").querySelector("svg").parentElement.style.color).toBe("var(--text-muted)");
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
