/**
 * Headquarters had no render test, which is how a missing import in its
 * `styles.js` reached a build during the Dusk redesign: nothing ever imported
 * the page in the suite, so nothing evaluated the module. These cases keep the
 * whole module graph — index, DashboardTab, LocationTab, EntryTable, styles —
 * loaded and rendered on every run.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

const locations = [
  { hqId: "h1", name: "Apartament", order: 0 },
  { hqId: "h2", name: "Casa",       order: 1 },
];

// The four titles below are what DashboardTab treats as a water template, so
// this fixture exercises the consumption chart rather than the plain card path.
const P = (parameterId, title) => ({ parameterId, title, type: "number" });
const templates = [
  { templateId: "t1", hqId: "h1", name: "Apa", parameters: [
    P("p1", "Baie - Apa Rece"),  P("p2", "Bucatarie - Apa Rece"),
    P("p3", "Baie - Apa Calda"), P("p4", "Bucatarie - Apa Calda"),
  ] },
  { templateId: "t2", hqId: "h2", name: "Curent", parameters: [P("p5", "Index")] },
];

const vals = (a, b, c, d) => [
  { parameterId: "p1", value: a }, { parameterId: "p2", value: b },
  { parameterId: "p3", value: c }, { parameterId: "p4", value: d },
];
const entries = [
  { entryId: "e1", templateId: "t1", hqId: "h1", date: "2026-07-01", values: vals(120, 64, 80, 40) },
  { entryId: "e2", templateId: "t1", hqId: "h1", date: "2026-08-01", values: vals(134, 71, 88, 45) },
  { entryId: "e3", templateId: "t1", hqId: "h1", date: "2026-09-01", values: vals(149, 80, 97, 51) },
  { entryId: "e4", templateId: "t2", hqId: "h2", date: "2026-09-01", values: [{ parameterId: "p5", value: 4210 }] },
];

vi.mock("../../api/headquarters", () => ({
  listLocations: () => Promise.resolve(locations),
  listTemplates: () => Promise.resolve(templates),
  listEntries:   () => Promise.resolve(entries),
  createLocation: vi.fn(), updateLocation: vi.fn(), deleteLocation: vi.fn(),
  createTemplate: vi.fn(), updateTemplate: vi.fn(), deleteTemplate: vi.fn(),
  createEntry:    vi.fn(), updateEntry:    vi.fn(), deleteEntry:    vi.fn(),
}));

const { default: Headquarters } = await import("./index");

beforeEach(() => vi.setSystemTime(new Date("2026-09-15T10:00:00Z")));

describe("Headquarters", () => {
  // A location name appears both as a tab and inside the dashboard column
  // card, so tab lookups are scoped to buttons.
  const tab = (name) =>
    screen.getAllByRole("button").find(b => b.textContent.trim() === name);

  it("renders the whole module graph without throwing", async () => {
    render(<Headquarters />);
    await waitFor(() => expect(screen.getByText("HQ Dashboard")).toBeTruthy());
  });

  it("lists a tab per location alongside Dashboard and Settings", async () => {
    render(<Headquarters />);
    await waitFor(() => expect(screen.getByText("HQ Dashboard")).toBeTruthy());

    expect(tab("Apartament")).toBeTruthy();
    expect(tab("Casa")).toBeTruthy();
    expect(tab("Settings")).toBeTruthy();
  });

  it("opens a location and shows its template section", async () => {
    render(<Headquarters />);
    await waitFor(() => expect(screen.getByText("HQ Dashboard")).toBeTruthy());

    fireEvent.click(tab("Apartament"));
    // The dashboard is gone and the location's own template is on screen.
    await waitFor(() => expect(screen.queryByText("Consum Apa Rece")).toBeNull());
    expect(screen.getAllByText(/Apa/).length).toBeGreaterThan(0);
  });

  it("opens Settings without losing the location tabs", async () => {
    render(<Headquarters />);
    await waitFor(() => expect(screen.getByText("HQ Dashboard")).toBeTruthy());

    fireEvent.click(tab("Settings"));
    expect(tab("Apartament")).toBeTruthy();
    expect(tab("Casa")).toBeTruthy();
  });
});
