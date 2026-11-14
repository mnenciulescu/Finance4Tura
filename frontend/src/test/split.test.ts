import { describe, it, expect } from "vitest";
import { coverRest, isFilled, normOccs, splitStats } from "../utils/split";
import type { SplitPayment } from "../types";

const entry = (over: Partial<SplitPayment> = {}): SplitPayment => ({
  splitPaymentId: "s", title: "T", totalAmount: 100, currency: "RON", occurrenceCount: 3,
  occurrenceType: "amount", createdDate: "2026-01-01", occurrences: [], ...over,
});

describe("split slot rules", () => {
  it("always yields exactly occurrenceCount slots", () => {
    expect(normOccs(entry({ occurrences: [{ value: "1" }] }))).toHaveLength(3);
    expect(normOccs(entry({ occurrences: [1, 2, 3, 4, 5].map(v => ({ value: String(v) })) }))).toHaveLength(3);
  });

  it("counts a slot as filled from any value", () => {
    expect(isFilled({ value: "" })).toBe(false);
    expect(isFilled({ value: "0" })).toBe(true);
    expect(isFilled({ value: "2026-01-02" })).toBe(true);
  });

  it("reports coverage and completeness", () => {
    const st = splitStats(entry({ occurrences: [{ value: "40" }, { value: "" }, { value: "30" }] }));
    expect(st).toMatchObject({ paid: 2, count: 3, covered: 70, remaining: 30, complete: false });
  });

  it("covers the rest evenly, the last slot absorbing the rounding remainder", () => {
    const e = entry({ totalAmount: 100, occurrences: [{ value: "" }, { value: "" }, { value: "" }] });
    const next = coverRest(e, normOccs(e));
    expect(next.map(o => o.value)).toEqual(["33.33", "33.33", "33.34"]);
    expect(next.reduce((s, o) => s + Number(o.value), 0)).toBeCloseTo(100);
  });

  it("leaves filled slots alone when covering the rest", () => {
    const e = entry({ occurrences: [{ value: "50" }, { value: "" }, { value: "" }] });
    expect(coverRest(e, normOccs(e)).map(o => o.value)).toEqual(["50", "25", "25"]);
  });
});
