import { describe, it, expect, vi, afterAll } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { renderApp } from "../../test/utils";
import { computedColumns, computedValues, smsText } from "./hqMath";

vi.setSystemTime(new Date("2026-09-15T10:00:00Z"));
afterAll(() => vi.useRealTimers());

const water = ["Baie - Apa Rece", "Bucatarie - Apa Rece", "Baie - Apa Calda", "Bucatarie - Apa Calda"].map((t, i) => ({ parameterId: `p${i}`, title: t, type: "number", unit: "m³" }));
const LOCS = [{ hqId: "h1", name: "Apartment", order: 0 }, { hqId: "h2", name: "Cabin", order: 1 }];
const TPLS = [{ templateId: "t1", hqId: "h1", name: "Water meters", parameters: water }];
const val = (n: number) => water.map((p, i) => ({ parameterId: p.parameterId, title: p.title, value: n + i }));
const ENTRIES = [
  { entryId: "e1", templateId: "t1", hqId: "h1", date: "2026-07-01", createdAt: "2026-07-01", values: val(100) },
  { entryId: "e2", templateId: "t1", hqId: "h1", date: "2026-07-31", createdAt: "2026-07-31", values: val(103) },
];
vi.mock("../../api/headquarters", async orig => ({
  ...(await orig<object>()),
  listLocations: () => Promise.resolve(LOCS),
  listTemplates: () => Promise.resolve(TPLS),
  listEntries: () => Promise.resolve(ENTRIES),
}));

const { default: HqScreen } = await import("./HqScreen");

describe("water maths (unchanged)", () => {
  it("computes monthly consumption between consecutive readings", () => {
    const cols = computedColumns(TPLS[0] as any);
    expect(cols.map(c => c.title)).toEqual(["Consum Apa Rece", "Consum Apa Calda"]);
    const v = computedValues(ENTRIES as any, cols);
    expect(v.e2["Consum Apa Rece"]).toBe(6); // (3 + 3) over 30 days × 30
  });

  it("builds the meter SMS from the latest reading", () => {
    expect(smsText(TPLS[0] as any, [...ENTRIES].reverse() as any)).toContain("- Baie Rece: 103");
  });
});

describe("HQ screen", () => {
  it("shows an Overview chip and one chip per location", async () => {
    renderApp(<HqScreen />, { route: "/hq", path: "/hq" });
    const tabs = await screen.findByRole("tablist", { name: "HQ views" });
    await within(tabs).findByRole("tab", { name: "Cabin" });
    expect(within(tabs).getAllByRole("tab").map(t => t.textContent)).toEqual(["Overview", "Apartment", "Cabin"]);
    expect(within(tabs).getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
  });

  it("opens a location with its template, entries and computed consumption", async () => {
    renderApp(<HqScreen />, { route: "/hq/h1", path: "/hq/:locationId" });
    expect(await screen.findByText("Water meters")).toBeInTheDocument();
    const card = document.querySelector('[data-entry="e2"]') as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { expanded: false }));
    // Cold and hot both rose by 6 m³ in this fixture.
    expect(within(card).getAllByText("6 m³/mo")).toHaveLength(2);
  });

  it("offers the meter SMS with a Copy action", async () => {
    renderApp(<HqScreen />, { route: "/hq/h1", path: "/hq/:locationId" });
    fireEvent.click(await screen.findByRole("button", { name: "SMS" }));
    const sheet = await screen.findByRole("dialog", { name: "Meter reading SMS" });
    expect(within(sheet).getByText(/Indexi:/)).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("navigates to HQ Settings from the ··· button", async () => {
    renderApp(<HqScreen />, { route: "/hq", path: "/hq" });
    fireEvent.click(await screen.findByRole("button", { name: "HQ Settings" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/hq/settings");
  });
});
