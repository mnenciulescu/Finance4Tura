import { describe, it, expect } from "vitest";
import { ACCOUNT_ITEMS, TABS, tabForPath, visibleItems } from "../app/navigation";

describe("navigation config", () => {
  it("has the four tabs in order", () => {
    expect(TABS.map(t => t.label)).toEqual(["Today", "Money", "Library", "HQ"]);
  });

  it("maps every screen to its tab", () => {
    expect(tabForPath("/")).toBe("today");
    for (const p of ["/money", "/money/split", "/money/stats", "/money/invest"]) expect(tabForPath(p)).toBe("money");
    expect(tabForPath("/library")).toBe("library");
    for (const p of ["/hq", "/hq/h1", "/hq/settings"]) expect(tabForPath(p)).toBe("hq");
  });

  it("puts account screens on the tab that opened them", () => {
    expect(tabForPath("/settings", "money")).toBe("money");
    expect(tabForPath("/settings")).toBe("today");
  });

  it("shows Backstage only while enabled and Admin only to the admin user", () => {
    const labels = (o: Parameters<typeof visibleItems>[1]) => visibleItems(ACCOUNT_ITEMS, o).map(i => i.label);
    expect(labels({ backstageEnabled: true, username: "nenciulescu" })).toEqual(["Settings", "Backstage", "Admin"]);
    expect(labels({ backstageEnabled: false, username: "nenciulescu" })).toEqual(["Settings", "Admin"]);
    expect(labels({ backstageEnabled: false, username: "ana" })).toEqual(["Settings"]);
  });
});
