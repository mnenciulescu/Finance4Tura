/**
 * Tests for the year-range validation logic used in createIncome / createExpense.
 * This extracts the validation rule into a pure function so it can be tested
 * independently of DynamoDB and Lambda infrastructure.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

// Extracted pure validation — mirrors the logic in incomes.mjs and expenses.mjs
function validateYear(date, seriesEndDate = null) {
  const currentYear = new Date().getFullYear();
  const yearStart = `${currentYear}-01-01`;
  const yearEnd   = `${currentYear}-12-31`;

  if (date < yearStart || date > yearEnd) {
    return { ok: false, message: `Date must be within the current year (${currentYear})` };
  }
  if (seriesEndDate && (seriesEndDate < yearStart || seriesEndDate > yearEnd)) {
    return { ok: false, message: `Series end date must be within the current year (${currentYear})` };
  }
  return { ok: true };
}

const year = new Date().getFullYear();

describe("validateYear — date field", () => {
  test("accepts a date in the current year", () => {
    const result = validateYear(`${year}-06-15`);
    assert.equal(result.ok, true);
  });

  test("accepts January 1st of current year", () => {
    assert.equal(validateYear(`${year}-01-01`).ok, true);
  });

  test("accepts December 31st of current year", () => {
    assert.equal(validateYear(`${year}-12-31`).ok, true);
  });

  test("rejects a date in a previous year", () => {
    const result = validateYear(`${year - 1}-12-31`);
    assert.equal(result.ok, false);
    assert.ok(result.message.includes(String(year)));
  });

  test("rejects a date in a future year", () => {
    const result = validateYear(`${year + 1}-01-01`);
    assert.equal(result.ok, false);
  });
});

describe("validateYear — seriesEndDate field", () => {
  test("accepts valid start and end within current year", () => {
    assert.equal(validateYear(`${year}-01-01`, `${year}-12-31`).ok, true);
  });

  test("rejects seriesEndDate in next year", () => {
    const result = validateYear(`${year}-06-01`, `${year + 1}-01-01`);
    assert.equal(result.ok, false);
    assert.ok(result.message.toLowerCase().includes("series end date"));
  });

  test("ignores null seriesEndDate", () => {
    assert.equal(validateYear(`${year}-06-01`, null).ok, true);
  });

  test("ignores undefined seriesEndDate", () => {
    assert.equal(validateYear(`${year}-06-01`).ok, true);
  });
});

describe("validateYear — required fields check", () => {
  test("rejects when date is missing", () => {
    assert.equal(validateYear("").ok, false);
  });
});
