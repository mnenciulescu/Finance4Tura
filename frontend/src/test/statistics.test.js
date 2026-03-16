/**
 * Tests for the Statistics page calculation logic.
 * These are pure-function extractions of the useMemo computations so they
 * can be tested without rendering Recharts or hitting the API.
 *
 * Covers: local dev, AWS, both themes (theme doesn't affect calculations),
 * mobile and desktop (layout-only difference, same data logic).
 */

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ── Mirrors Statistics.jsx monthlyData useMemo ────────────────────────────────

function buildMonthlyData(incomes, expenses, selectedYear) {
  const today        = new Date();
  return MONTH_LABELS.map((label, idx) => {
    const monthStr = `${selectedYear}-${String(idx + 1).padStart(2, "0")}`;
    const isFuture = selectedYear > today.getFullYear() ||
                     (selectedYear === today.getFullYear() && idx > today.getMonth());
    const mInc = incomes.filter(i => i.date.startsWith(monthStr));
    const mExp = expenses.filter(e => e.date.startsWith(monthStr));
    const totalIncome = mInc.reduce((s, i) => s + (i.amount ?? 0), 0);
    const high   = mExp.filter(e => e.priority === "High").reduce((s, e) => s + (e.amount ?? 0), 0);
    const medium = mExp.filter(e => e.priority === "Medium").reduce((s, e) => s + (e.amount ?? 0), 0);
    const low    = mExp.filter(e => e.priority === "Low").reduce((s, e) => s + (e.amount ?? 0), 0);
    const free   = totalIncome - high - medium - low;
    const hasData = mInc.length > 0 || mExp.length > 0;
    return {
      label,
      high:   isFuture && !hasData ? null : high,
      medium: isFuture && !hasData ? null : medium,
      low:    isFuture && !hasData ? null : low,
      free:   isFuture && !hasData ? null : free,
      hasData,
    };
  });
}

function buildAverages(monthlyData) {
  const monthsWithData = monthlyData.filter(m => m.hasData);
  const n = monthsWithData.length || 1;
  return {
    high:   monthsWithData.reduce((s, m) => s + (m.high   ?? 0), 0) / n,
    medium: monthsWithData.reduce((s, m) => s + (m.medium ?? 0), 0) / n,
    low:    monthsWithData.reduce((s, m) => s + (m.low    ?? 0), 0) / n,
    free:   monthsWithData.reduce((s, m) => s + (m.free   ?? 0), 0) / n,
  };
}

function survivalPerMonth(avg) {
  return avg.high + avg.medium * 0.8 + 7000;
}

// ── Test data ─────────────────────────────────────────────────────────────────

const YEAR = 2024; // Fixed past year so no months are "future"

const incomes = [
  { incomeId: "i1", date: "2024-01-15", amount: 5000 },
  { incomeId: "i2", date: "2024-02-15", amount: 5000 },
  { incomeId: "i3", date: "2024-03-15", amount: 5000 },
];

const expenses = [
  { expenseId: "e1", date: "2024-01-20", priority: "High",   amount: 1000 },
  { expenseId: "e2", date: "2024-01-25", priority: "Medium", amount: 500  },
  { expenseId: "e3", date: "2024-01-28", priority: "Low",    amount: 200  },
  { expenseId: "e4", date: "2024-02-10", priority: "High",   amount: 1500 },
  { expenseId: "e5", date: "2024-02-20", priority: "Medium", amount: 800  },
  { expenseId: "e6", date: "2024-03-05", priority: "Low",    amount: 300  },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("buildMonthlyData", () => {
  const data = buildMonthlyData(incomes, expenses, YEAR);

  it("returns 12 months", () => {
    expect(data).toHaveLength(12);
  });

  it("labels months correctly", () => {
    expect(data[0].label).toBe("Jan");
    expect(data[11].label).toBe("Dec");
  });

  it("calculates January totals correctly", () => {
    const jan = data[0];
    expect(jan.high).toBe(1000);
    expect(jan.medium).toBe(500);
    expect(jan.low).toBe(200);
    expect(jan.free).toBe(5000 - 1000 - 500 - 200); // 3300
  });

  it("calculates February totals correctly", () => {
    const feb = data[1];
    expect(feb.high).toBe(1500);
    expect(feb.medium).toBe(800);
    expect(feb.low).toBe(0);
    expect(feb.free).toBe(5000 - 1500 - 800); // 2700
  });

  it("marks months with data correctly", () => {
    expect(data[0].hasData).toBe(true);
    expect(data[3].hasData).toBe(false); // April — no data
  });

  it("returns zero (not null) for expense categories with no transactions in past months", () => {
    const mar = data[2]; // March has income + low expense only
    expect(mar.high).toBe(0);
    expect(mar.medium).toBe(0);
    expect(mar.low).toBe(300);
  });

  it("sets future months with no data to null", () => {
    // Year 9999 is always in the future
    const futureData = buildMonthlyData([], [], 9999);
    expect(futureData.every(m => m.high === null)).toBe(true);
    expect(futureData.every(m => m.hasData)).toBe(false);
  });

  it("handles empty incomes and expenses gracefully", () => {
    const data = buildMonthlyData([], [], YEAR);
    data.forEach(m => {
      expect(m.high).toBe(0);
      expect(m.free).toBe(0);
      expect(m.hasData).toBe(false);
    });
  });
});

describe("buildAverages", () => {
  it("averages only months with data", () => {
    const data = buildMonthlyData(incomes, expenses, YEAR);
    const avg  = buildAverages(data);
    // 3 months with data: Jan high=1000, Feb high=1500, Mar high=0 → avg = 833.33
    expect(avg.high).toBeCloseTo(833.33, 1);
  });

  it("returns 0 averages for empty dataset", () => {
    const data = buildMonthlyData([], [], YEAR);
    const avg  = buildAverages(data);
    expect(avg.high).toBe(0);
    expect(avg.medium).toBe(0);
    expect(avg.low).toBe(0);
    expect(avg.free).toBe(0);
  });

  it("divides by 1 (not 0) when no months have data", () => {
    const data = buildMonthlyData([], [], YEAR);
    const avg  = buildAverages(data);
    expect(isFinite(avg.high)).toBe(true);
  });
});

describe("survivalPerMonth", () => {
  it("adds High + 80% Medium + fixed 7000", () => {
    const avg = { high: 1000, medium: 500, low: 200, free: 3300 };
    expect(survivalPerMonth(avg)).toBe(1000 + 500 * 0.8 + 7000); // 8400
  });

  it("returns 7000 when all averages are zero", () => {
    expect(survivalPerMonth({ high: 0, medium: 0, low: 0, free: 0 })).toBe(7000);
  });

  it("is not affected by low or free amounts", () => {
    const base = survivalPerMonth({ high: 1000, medium: 0, low: 0, free: 0 });
    const withLow  = survivalPerMonth({ high: 1000, medium: 0, low: 9999, free: 0 });
    const withFree = survivalPerMonth({ high: 1000, medium: 0, low: 0,    free: 9999 });
    expect(withLow).toBe(base);
    expect(withFree).toBe(base);
  });
});

describe("special expenses filter", () => {
  it("isolates only special expenses", () => {
    const all = [
      { expenseId: "e1", special: true,  amount: 500 },
      { expenseId: "e2", special: false, amount: 200 },
      { expenseId: "e3", special: true,  amount: 300 },
    ];
    const specials = all.filter(e => e.special);
    expect(specials).toHaveLength(2);
    expect(specials.reduce((s, e) => s + e.amount, 0)).toBe(800);
  });

  it("returns empty array when no special expenses exist", () => {
    expect([].filter(e => e.special)).toHaveLength(0);
  });
});
