/**
 * Tests for shared color constants.
 * Verifies that all expected keys are present and values are valid CSS colors,
 * so components that rely on these for theming never get undefined colors.
 *
 * Applies to both light and dark themes (the constants are categorical/fixed).
 */
import { PRIORITY_COLORS, HTTP_METHOD_COLORS, CHART_COLORS, BAR_COLORS } from "../utils/colors";

const isColor = (v) => typeof v === "string" && v.length > 0;

describe("PRIORITY_COLORS", () => {
  it("defines High, Medium, and Low", () => {
    expect(isColor(PRIORITY_COLORS.High)).toBe(true);
    expect(isColor(PRIORITY_COLORS.Medium)).toBe(true);
    expect(isColor(PRIORITY_COLORS.Low)).toBe(true);
  });

  it("has no extra unexpected keys", () => {
    expect(Object.keys(PRIORITY_COLORS)).toEqual(["High", "Medium", "Low"]);
  });
});

describe("HTTP_METHOD_COLORS", () => {
  const requiredMethods = ["GET", "POST", "PUT", "DELETE"];

  it("defines all HTTP methods used in the Backstage log", () => {
    requiredMethods.forEach(m => {
      expect(isColor(HTTP_METHOD_COLORS[m])).toBe(true);
    });
  });

  it("returns undefined for unrecognised methods (no crash — caller uses ?? fallback)", () => {
    expect(HTTP_METHOD_COLORS["PATCH"]).toBeUndefined();
  });
});

describe("CHART_COLORS", () => {
  it("defines all priority levels plus Free", () => {
    expect(isColor(CHART_COLORS.High)).toBe(true);
    expect(isColor(CHART_COLORS.Medium)).toBe(true);
    expect(isColor(CHART_COLORS.Low)).toBe(true);
    expect(isColor(CHART_COLORS.Free)).toBe(true);
  });

  it("High and Low are visually distinct (not equal)", () => {
    expect(CHART_COLORS.High).not.toBe(CHART_COLORS.Low);
  });
});

describe("BAR_COLORS", () => {
  const requiredKeys = ["total", "done", "pending", "free", "over"];

  it("defines all income card bar states", () => {
    requiredKeys.forEach(k => {
      expect(isColor(BAR_COLORS[k])).toBe(true);
    });
  });
});
