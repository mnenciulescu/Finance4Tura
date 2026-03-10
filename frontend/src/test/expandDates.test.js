/**
 * Tests for expandDates utility.
 * Mirrors backend/src/lib/expandDates.mjs — kept in sync manually.
 */

function expandDates(startDate, endDate, frequency) {
  const dates = [];
  let current = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    if (frequency === "daily") {
      current = new Date(current.getTime() + 86_400_000);
    } else if (frequency === "weekly") {
      current = new Date(current.getTime() + 7 * 86_400_000);
    } else if (frequency === "monthly") {
      const next = new Date(current);
      next.setUTCMonth(next.getUTCMonth() + 1);
      current = next;
    } else {
      break;
    }
  }
  return dates;
}

describe("expandDates", () => {
  describe("daily", () => {
    it("produces 3 consecutive days", () => {
      expect(expandDates("2026-01-01", "2026-01-03", "daily")).toEqual([
        "2026-01-01", "2026-01-02", "2026-01-03",
      ]);
    });

    it("returns single day when start equals end", () => {
      expect(expandDates("2026-06-15", "2026-06-15", "daily")).toEqual(["2026-06-15"]);
    });

    it("returns empty array when end is before start", () => {
      expect(expandDates("2026-03-10", "2026-03-09", "daily")).toEqual([]);
    });
  });

  describe("weekly", () => {
    it("produces 4 weekly intervals", () => {
      expect(expandDates("2026-01-05", "2026-01-26", "weekly")).toEqual([
        "2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26",
      ]);
    });

    it("returns only start when end < 7 days ahead", () => {
      expect(expandDates("2026-03-01", "2026-03-06", "weekly")).toEqual(["2026-03-01"]);
    });
  });

  describe("monthly", () => {
    it("produces 12 months across a full year", () => {
      const result = expandDates("2026-01-01", "2026-12-01", "monthly");
      expect(result).toHaveLength(12);
      expect(result[0]).toBe("2026-01-01");
      expect(result[11]).toBe("2026-12-01");
    });

    it("handles leap year February 29th correctly", () => {
      const result = expandDates("2024-01-29", "2024-03-29", "monthly");
      expect(result[1]).toBe("2024-02-29");
      expect(result[2]).toBe("2024-03-29");
    });
  });

  describe("unknown frequency", () => {
    it("returns only the start date and stops", () => {
      expect(expandDates("2026-01-01", "2026-12-31", "quarterly")).toEqual(["2026-01-01"]);
    });
  });
});
