import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderApp } from "../../test/utils";

const deleteUser = vi.fn(() => Promise.resolve({}));
vi.mock("../../api/admin", () => ({
  listUsers: () => Promise.resolve([
    { username: "nenciulescu", email: "a@x", enabled: true, role: "admin", incomes: 3, expenses: 9 },
    { username: "ana", email: "ana@x", enabled: false, role: "normal", incomes: 1, expenses: 2 },
  ]),
  updateUserRole: vi.fn(() => Promise.resolve({})),
  deleteUser: (...a: any[]) => (deleteUser as any)(...a),
}));
vi.mock("../../api/fxRates", async orig => ({ ...(await orig<object>()), getFxRates: () => Promise.resolve({ rates: { EUR: { EUR: 1, USD: 1.08, RON: 4.97 }, USD: { EUR: 0.93, USD: 1, RON: 4.6 }, RON: { EUR: 0.2, USD: 0.22, RON: 1 } }, updatedAt: "2026-09-10T00:00:00Z" }) }));
const updateAi = vi.fn((body: object) => Promise.resolve({ configured: true, keyUpdatedAt: "2026-11-16T15:07:18Z", model: "claude-opus-5-5", maxSearches: 15, enabled: true, ...body }));
vi.mock("../../api/portfolioV2", async orig => ({
  ...(await orig<object>()),
  getPv2AiConfig: () => Promise.resolve({ configured: true, keyUpdatedAt: "2026-11-16T15:07:18Z", model: "claude-opus-5-5", maxSearches: 15, enabled: true }),
  updatePv2AiConfig: (body: object) => updateAi(body),
}));
vi.mock("../../api/appSettings", async orig => ({ ...(await orig<object>()), getAppSettings: () => Promise.resolve({ googleLoginEnabled: false, createAccountEnabled: true }) }));

const { default: Settings } = await import("./settings/Settings");
const { default: Admin } = await import("./admin/Admin");
const { default: Login } = await import("../auth/Login");
const { AppSettingsProvider } = await import("../../context/AppSettingsContext");

describe("Settings", () => {
  it("switches theme immediately and remembers it", () => {
    renderApp(<Settings />, { route: "/settings" });
    fireEvent.click(screen.getByRole("radio", { name: /Dark/ }));
    expect(localStorage.getItem("uiTheme")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("radio", { name: /Dark/ })).toHaveAttribute("aria-checked", "true");
  });

  it("sets the default income-amount visibility under the existing key", () => {
    renderApp(<Settings />, { route: "/settings" });
    fireEvent.click(screen.getByRole("switch", { name: "Show income amounts by default" }));
    expect(localStorage.getItem("incomePrivacy")).toBe("true");
  });
});

describe("Admin", () => {
  it("shows the FX matrix and the users with role and enabled state", async () => {
    renderApp(<Admin />, { route: "/admin" });
    const fx = await screen.findByRole("table", { name: "FX rate matrix" });
    expect(within(fx).getByText("4.97")).toBeInTheDocument();
    expect(await screen.findByText("ana")).toBeInTheDocument();
    expect(screen.getByText("Disabled")).toBeInTheDocument();
  });

  it("deletes a user only after the admin re-enters their password", async () => {
    const verifyPassword = vi.fn(async (p: string) => { if (p !== "right") throw new Error("bad"); return true; });
    renderApp(<Admin />, { route: "/admin", auth: { verifyPassword } });
    fireEvent.click(await screen.findByRole("button", { name: /ana@x/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete User and All Data" }));
    const alert = await screen.findByRole("alertdialog", { name: "Delete ana?" });
    fireEvent.click(within(alert).getByRole("button", { name: "Delete" }));
    expect(await within(alert).findByText("Please enter your password.")).toBeInTheDocument();
    fireEvent.change(within(alert).getByLabelText("Your password"), { target: { value: "wrong" } });
    fireEvent.click(within(alert).getByRole("button", { name: "Delete" }));
    expect(await within(alert).findByText("Wrong password. Please try again.")).toBeInTheDocument();
    expect(deleteUser).not.toHaveBeenCalled();
    fireEvent.change(within(alert).getByLabelText("Your password"), { target: { value: "right" } });
    fireEvent.click(within(alert).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(deleteUser).toHaveBeenCalledWith("ana"));
  });

  it("saves the Portfolio v2 AI model as soon as it is picked", async () => {
    renderApp(<Admin />, { route: "/admin" });
    const picker = await screen.findByRole("radiogroup", { name: "Model" });
    await waitFor(() => expect(within(picker).getByRole("radio", { name: "Opus 5.5" })).toHaveAttribute("aria-checked", "true"));
    fireEvent.click(within(picker).getByRole("radio", { name: "Haiku 5.5" }));
    await waitFor(() => expect(updateAi).toHaveBeenCalledWith({ model: "claude-haiku-5-5" }));
    await waitFor(() => expect(within(picker).getByRole("radio", { name: "Haiku 5.5" })).toHaveAttribute("aria-checked", "true"));
  });

  it("does not let the admin change their own role", async () => {
    renderApp(<Admin />, { route: "/admin" });
    fireEvent.click(await screen.findByRole("button", { name: /a@x · 3 incomes/ }));
    expect(await screen.findByRole("switch", { name: "Admin role" })).toBeDisabled();
  });
});

describe("Login", () => {
  it("hides Google sign-in when switched off and checks the password confirmation on sign-up", async () => {
    const signUp = vi.fn(async () => ({}));
    renderApp(<AppSettingsProvider><Login /></AppSettingsProvider>, { auth: { user: null, signUp } });
    await waitFor(() => expect(screen.queryByText("or")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Create one" }));
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "new" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "a" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "b" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));
    expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("shows and hides the password", () => {
    renderApp(<AppSettingsProvider><Login /></AppSettingsProvider>, { auth: { user: null } });
    const field = screen.getByLabelText("Password");
    expect(field).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(field).toHaveAttribute("type", "text");
  });
});
