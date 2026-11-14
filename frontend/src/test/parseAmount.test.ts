import { describe, it, expect } from "vitest";
import { parseAmount, sanitizeAmountInput } from "../utils/parseAmount";

describe("parseAmount — either decimal separator (Android keyboards)", () => {
  it.each([
    ["12,5", 12.5], ["12.5", 12.5], ["1.234,56", 1234.56], ["1,234.56", 1234.56],
    ["1.234.567", 1234567], ["1,234,567", 1234567], [" 7 ", 7], ["0", 0], ["-3,5", -3.5],
  ])("%s → %s", (input, expected) => {
    expect(parseAmount(input)).toBeCloseTo(expected);
  });

  it.each(["", "abc", "1,2,3.4.5x", "-", "."])("rejects %j", input => {
    expect(Number.isNaN(parseAmount(input))).toBe(true);
  });

  it("passes numbers through", () => expect(parseAmount(42)).toBe(42));

  it("keeps only amount characters while typing", () => {
    expect(sanitizeAmountInput("12a,5€")).toBe("12,5");
  });
});
