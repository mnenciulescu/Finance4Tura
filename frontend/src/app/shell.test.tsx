import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { renderApp } from "../test/utils";
import { AppShell } from "./AppShell";
import { Screen } from "./Screen";
import { AppSettingsProvider } from "../context/AppSettingsContext";

vi.mock("../api/appSettings", async orig => ({ ...(await orig<object>()), getAppSettings: () => Promise.resolve({ backstageEnabled: false }) }));

const Page = ({ title }: { title: string }) => <Screen title={title}>content</Screen>;
const renderShell = (route = "/", username = "nenciulescu") =>
  renderApp(
    <AppSettingsProvider>
      <AppShell><Page title="Today" /></AppShell>
    </AppSettingsProvider>,
    { route, auth: { user: { username, isAdmin: username === "nenciulescu" } } },
  );

describe("tab bar", () => {
  it("has Today · Money · Library · HQ with the current tab marked", () => {
    renderShell("/");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getAllByRole("button").map(b => b.textContent)).toEqual(["Today", "Money", "Library", "HQ"]);
    expect(within(nav).getByRole("button", { name: "Today" })).toHaveAttribute("aria-current", "page");
  });

  it("keeps Money selected on every Money screen", () => {
    renderShell("/money/stats");
    expect(screen.getByRole("button", { name: "Money" })).toHaveAttribute("aria-current", "page");
  });

  it("navigates between tabs and returns to each tab's last screen", () => {
    renderShell("/money/stats");
    fireEvent.click(screen.getByRole("button", { name: "Library" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/library");
    fireEvent.click(screen.getByRole("button", { name: "Money" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/money/stats");
  });

  it("pops to the tab's root when the selected tab is tapped again", () => {
    renderShell("/money/stats");
    fireEvent.click(screen.getByRole("button", { name: "Money" }));
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/money$/);
  });
});

describe("account sheet", () => {
  it("lists Settings and Admin above Sign Out for the admin user (Backstage off)", async () => {
    renderShell("/");
    fireEvent.click(screen.getByRole("button", { name: "Account" }));
    const sheet = await screen.findByRole("dialog", { name: "Account" }, { timeout: 5000 });
    expect(within(sheet).getByText("nenciulescu")).toBeInTheDocument();
    const items = within(sheet).getAllByRole("button").map(b => b.textContent?.trim());
    expect(items).toEqual(["Settings", "Admin", "Sign Out"]);
  });

  it("hides Admin from other users", async () => {
    renderShell("/", "ana");
    fireEvent.click(screen.getByRole("button", { name: "Account" }));
    const sheet = await screen.findByRole("dialog", { name: "Account" }, { timeout: 5000 });
    expect(within(sheet).queryByRole("button", { name: "Admin" })).toBeNull();
  });

  it("opens Settings on the tab it was opened from", async () => {
    renderShell("/money");
    fireEvent.click(screen.getByRole("button", { name: "Account" }));
    fireEvent.click(await screen.findByRole("button", { name: "Settings" }, { timeout: 5000 }));
    expect(screen.getByTestId("location")).toHaveTextContent("/settings");
    expect(screen.getByRole("button", { name: "Money" })).toHaveAttribute("aria-current", "page");
  });
});
