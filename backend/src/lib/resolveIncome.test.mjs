/**
 * Tests for the resolveIncome business logic.
 * Mirrors backend/src/handlers/expenses.mjs resolveIncome() and the
 * equivalent client-side function in the Dashboard.
 *
 * This logic is critical: it determines which income period an expense
 * belongs to.  Covers local dev (same logic, userId = "local-dev") and
 * AWS (real Cognito sub) — the function is pure on the candidate list.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

/** Pure mirror of resolveIncome (without DynamoDB) */
function resolveIncome(incomes, expenseDate) {
  const candidates = incomes.filter(i => i.date <= expenseDate);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.date.localeCompare(a.date));
  return candidates[0];
}

const incomes = [
  { incomeId: "i1", date: "2026-01-01", summary: "January salary",  amount: 5000 },
  { incomeId: "i2", date: "2026-02-01", summary: "February salary", amount: 5000 },
  { incomeId: "i3", date: "2026-03-01", summary: "March salary",    amount: 5000 },
];

describe("resolveIncome — basic mapping", () => {
  test("maps to the most recent preceding income", () => {
    assert.equal(resolveIncome(incomes, "2026-02-15")?.incomeId, "i2");
  });

  test("maps to income whose date exactly matches expense date", () => {
    assert.equal(resolveIncome(incomes, "2026-03-01")?.incomeId, "i3");
  });

  test("maps to income on exact date of first income", () => {
    assert.equal(resolveIncome(incomes, "2026-01-01")?.incomeId, "i1");
  });

  test("maps to last income for a late-year expense", () => {
    assert.equal(resolveIncome(incomes, "2026-12-31")?.incomeId, "i3");
  });
});

describe("resolveIncome — null cases", () => {
  test("returns null when no income precedes the expense date", () => {
    assert.equal(resolveIncome(incomes, "2025-12-31"), null);
  });

  test("returns null for empty income list", () => {
    assert.equal(resolveIncome([], "2026-06-01"), null);
  });
});

describe("resolveIncome — ordering", () => {
  test("returns the latest when multiple incomes are eligible", () => {
    const multi = [
      { incomeId: "a", date: "2026-01-01" },
      { incomeId: "b", date: "2026-01-15" },
      { incomeId: "c", date: "2026-01-20" },
    ];
    assert.equal(resolveIncome(multi, "2026-01-25")?.incomeId, "c");
  });

  test("handles incomes given in unsorted order", () => {
    const unsorted = [
      { incomeId: "x", date: "2026-03-01" },
      { incomeId: "y", date: "2026-01-01" },
      { incomeId: "z", date: "2026-02-01" },
    ];
    assert.equal(resolveIncome(unsorted, "2026-02-15")?.incomeId, "z");
  });

  test("expense on the day after an income maps to that income", () => {
    assert.equal(resolveIncome(incomes, "2026-02-02")?.incomeId, "i2");
  });

  test("expense one day before an income maps to the previous income", () => {
    assert.equal(resolveIncome(incomes, "2026-01-31")?.incomeId, "i1");
  });
});

describe("resolveIncome — single income edge cases", () => {
  const single = [{ incomeId: "s1", date: "2026-06-01" }];

  test("maps any expense on or after the single income", () => {
    assert.equal(resolveIncome(single, "2026-06-01")?.incomeId, "s1");
    assert.equal(resolveIncome(single, "2026-12-31")?.incomeId, "s1");
  });

  test("returns null for expense before the only income", () => {
    assert.equal(resolveIncome(single, "2026-05-31"), null);
  });
});
