/**
 * Tests for income mapping / resolveIncome logic (client-side mirror used in Dashboard).
 * Mirrors the resolveIncome function in backend/src/handlers/expenses.mjs.
 */

// Client-side implementation of the income mapping logic
function resolveIncomeFromList(incomes, expenseDate) {
  const candidates = incomes.filter(i => i.date <= expenseDate);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.date.localeCompare(a.date));
  return candidates[0];
}

// Client-side delete remapping (mirrors Dashboard.jsx handleDeleteIncome)
function remapAfterDelete(expenses, removedIds, remaining) {
  return expenses.map(e => {
    if (!removedIds.has(e.mappedIncomeId)) return e;
    const inc = remaining
      .filter(i => i.date <= e.date)
      .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
    return {
      ...e,
      mappedIncomeId:      inc?.incomeId  ?? null,
      mappedIncomeSummary: inc?.summary   ?? null,
      mappedIncomeDate:    inc?.date      ?? null,
    };
  });
}

const incomes = [
  { incomeId: "i1", summary: "January salary", date: "2026-01-01", amount: 5000 },
  { incomeId: "i2", summary: "February salary", date: "2026-02-01", amount: 5200 },
  { incomeId: "i3", summary: "March salary",    date: "2026-03-01", amount: 5100 },
];

describe("resolveIncomeFromList", () => {
  it("maps an expense to the most recent preceding income", () => {
    const result = resolveIncomeFromList(incomes, "2026-02-15");
    expect(result.incomeId).toBe("i2");
  });

  it("maps to the income whose date exactly matches", () => {
    const result = resolveIncomeFromList(incomes, "2026-03-01");
    expect(result.incomeId).toBe("i3");
  });

  it("returns null when no income precedes the expense date", () => {
    expect(resolveIncomeFromList(incomes, "2025-12-31")).toBeNull();
  });

  it("maps to the first income when expense is on its exact date", () => {
    const result = resolveIncomeFromList(incomes, "2026-01-01");
    expect(result.incomeId).toBe("i1");
  });

  it("maps to the last income for a late-year expense", () => {
    const result = resolveIncomeFromList(incomes, "2026-12-31");
    expect(result.incomeId).toBe("i3");
  });

  it("returns null for empty income list", () => {
    expect(resolveIncomeFromList([], "2026-06-01")).toBeNull();
  });
});

describe("remapAfterDelete — income deletion remapping", () => {
  const expenses = [
    { expenseId: "e1", date: "2026-01-15", mappedIncomeId: "i1", mappedIncomeSummary: "January salary", mappedIncomeDate: "2026-01-01", amount: 100 },
    { expenseId: "e2", date: "2026-02-10", mappedIncomeId: "i2", mappedIncomeSummary: "February salary", mappedIncomeDate: "2026-02-01", amount: 200 },
    { expenseId: "e3", date: "2026-03-20", mappedIncomeId: "i3", mappedIncomeSummary: "March salary",    mappedIncomeDate: "2026-03-01", amount: 150 },
  ];

  it("unmapped expense keeps its existing mapping when unaffected", () => {
    const result = remapAfterDelete(expenses, new Set(["i2"]), [incomes[0], incomes[2]]);
    expect(result[0].mappedIncomeId).toBe("i1"); // unaffected
    expect(result[2].mappedIncomeId).toBe("i3"); // unaffected
  });

  it("remaps affected expense to next best income", () => {
    const remaining = [incomes[0], incomes[2]]; // i2 deleted
    const result = remapAfterDelete(expenses, new Set(["i2"]), remaining);
    // e2 (date 2026-02-10) should remap to i1 (2026-01-01) since i2 is gone
    expect(result[1].mappedIncomeId).toBe("i1");
    expect(result[1].mappedIncomeSummary).toBe("January salary");
  });

  it("sets mapped fields to null when no income exists before expense date", () => {
    const result = remapAfterDelete(expenses, new Set(["i1"]), [incomes[1], incomes[2]]);
    // e1 (date 2026-01-15) — no remaining income before Jan 15 → null
    expect(result[0].mappedIncomeId).toBeNull();
    expect(result[0].mappedIncomeSummary).toBeNull();
  });
});
