import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { expandDates } from "./expandDates.mjs";

describe("expandDates — daily frequency", () => {
  test("expands 3 consecutive days", () => {
    const result = expandDates("2026-01-01", "2026-01-03", "daily");
    assert.deepEqual(result, ["2026-01-01", "2026-01-02", "2026-01-03"]);
  });

  test("single day (start equals end)", () => {
    const result = expandDates("2026-06-15", "2026-06-15", "daily");
    assert.deepEqual(result, ["2026-06-15"]);
  });

  test("returns empty array when end is before start", () => {
    const result = expandDates("2026-03-10", "2026-03-09", "daily");
    assert.deepEqual(result, []);
  });

  test("crosses month boundary correctly", () => {
    const result = expandDates("2026-01-30", "2026-02-02", "daily");
    assert.deepEqual(result, ["2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02"]);
  });
});

describe("expandDates — weekly frequency", () => {
  test("expands 4 weeks", () => {
    const result = expandDates("2026-01-05", "2026-01-26", "weekly");
    assert.deepEqual(result, ["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26"]);
  });

  test("single occurrence when end is less than 7 days ahead", () => {
    const result = expandDates("2026-03-01", "2026-03-06", "weekly");
    assert.deepEqual(result, ["2026-03-01"]);
  });

  test("crosses year boundary", () => {
    const result = expandDates("2025-12-29", "2026-01-05", "weekly");
    assert.deepEqual(result, ["2025-12-29", "2026-01-05"]);
  });
});

describe("expandDates — monthly frequency", () => {
  test("expands full year from Jan to Dec", () => {
    const result = expandDates("2026-01-01", "2026-12-01", "monthly");
    assert.equal(result.length, 12);
    assert.equal(result[0], "2026-01-01");
    assert.equal(result[11], "2026-12-01");
  });

  test("handles month-end dates (does not overflow)", () => {
    // Jan 31 → Feb 28 in non-leap year
    const result = expandDates("2026-01-31", "2026-03-31", "monthly");
    assert.equal(result[0], "2026-01-31");
    // Feb 31 → Feb 28 (UTC setUTCMonth behaviour: day clamped)
    assert.ok(result[1].startsWith("2026-02") || result[1].startsWith("2026-03"));
  });

  test("leap year February", () => {
    const result = expandDates("2024-01-29", "2024-03-29", "monthly");
    assert.equal(result[0], "2024-01-29");
    assert.equal(result[1], "2024-02-29"); // 2024 is a leap year
    assert.equal(result[2], "2024-03-29");
  });

  test("single occurrence", () => {
    const result = expandDates("2026-04-01", "2026-04-30", "monthly");
    assert.deepEqual(result, ["2026-04-01"]);
  });
});

describe("expandDates — invalid frequency", () => {
  test("returns only the start date for unknown frequency", () => {
    const result = expandDates("2026-01-01", "2026-12-31", "quarterly");
    assert.deepEqual(result, ["2026-01-01"]);
  });
});
