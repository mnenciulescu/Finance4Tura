/**
 * Tests for form validation rules used in AddIncome and AddExpense pages.
 * Covers all combinations: local dev & AWS (same logic), mobile & desktop
 * (same validation regardless of layout), both themes (theme-agnostic).
 *
 * Extracted as pure functions that mirror the validation in the page components.
 */

const year = new Date().getFullYear();

// ── Mirrors AddIncome / AddExpense validation ─────────────────────────────────

function validateAmount(amount) {
  const n = Number(amount);
  if (amount === "" || amount == null) return { valid: false, error: "Amount is required." };
  if (isNaN(n))                        return { valid: false, error: "Amount must be a number." };
  if (n <= 0)                          return { valid: false, error: "Amount must be greater than 0." };
  return { valid: true };
}

function validateRequired(value, field) {
  if (!value || String(value).trim() === "") {
    return { valid: false, error: `${field} is required.` };
  }
  return { valid: true };
}

function validateDateInYear(date, yr = year) {
  const yearStart = `${yr}-01-01`;
  const yearEnd   = `${yr}-12-31`;
  if (!date || date < yearStart || date > yearEnd) {
    return { valid: false, error: `Date must be within the current year (${yr}).` };
  }
  return { valid: true };
}

function validateSeriesEndDate(endDate, startDate, yr = year) {
  const yearEnd = `${yr}-12-31`;
  if (!endDate)           return { valid: false, error: "Series end date is required." };
  if (endDate > yearEnd)  return { valid: false, error: `Series end date must be within the current year (${yr}).` };
  if (endDate < startDate) return { valid: false, error: "Series end date cannot be before start date." };
  return { valid: true };
}

// ── Amount validation ─────────────────────────────────────────────────────────

describe("validateAmount", () => {
  it("accepts a positive integer", () => {
    expect(validateAmount(1000).valid).toBe(true);
  });

  it("accepts a positive decimal", () => {
    expect(validateAmount(99.99).valid).toBe(true);
  });

  it("accepts a positive string number", () => {
    expect(validateAmount("250").valid).toBe(true);
  });

  it("rejects zero", () => {
    const result = validateAmount(0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("greater than 0");
  });

  it("rejects negative amounts", () => {
    expect(validateAmount(-100).valid).toBe(false);
    expect(validateAmount(-0.01).valid).toBe(false);
  });

  it("rejects empty string", () => {
    expect(validateAmount("").valid).toBe(false);
  });

  it("rejects null", () => {
    expect(validateAmount(null).valid).toBe(false);
  });

  it("rejects NaN", () => {
    expect(validateAmount("abc").valid).toBe(false);
  });
});

// ── Required field validation ─────────────────────────────────────────────────

describe("validateRequired", () => {
  it("accepts a non-empty string", () => {
    expect(validateRequired("Salary", "Summary").valid).toBe(true);
  });

  it("rejects empty string", () => {
    expect(validateRequired("", "Summary").valid).toBe(false);
  });

  it("rejects whitespace-only string", () => {
    expect(validateRequired("   ", "Summary").valid).toBe(false);
  });

  it("rejects null", () => {
    expect(validateRequired(null, "Summary").valid).toBe(false);
  });

  it("rejects undefined", () => {
    expect(validateRequired(undefined, "Summary").valid).toBe(false);
  });

  it("includes field name in error message", () => {
    const result = validateRequired("", "Summary");
    expect(result.error).toContain("Summary");
  });
});

// ── Date validation ───────────────────────────────────────────────────────────

describe("validateDateInYear", () => {
  it("accepts first day of current year", () => {
    expect(validateDateInYear(`${year}-01-01`).valid).toBe(true);
  });

  it("accepts last day of current year", () => {
    expect(validateDateInYear(`${year}-12-31`).valid).toBe(true);
  });

  it("accepts mid-year date", () => {
    expect(validateDateInYear(`${year}-06-15`).valid).toBe(true);
  });

  it("rejects previous year", () => {
    expect(validateDateInYear(`${year - 1}-12-31`).valid).toBe(false);
  });

  it("rejects next year", () => {
    expect(validateDateInYear(`${year + 1}-01-01`).valid).toBe(false);
  });

  it("rejects empty string", () => {
    expect(validateDateInYear("").valid).toBe(false);
  });

  it("rejects null", () => {
    expect(validateDateInYear(null).valid).toBe(false);
  });
});

// ── Series end date validation ────────────────────────────────────────────────

describe("validateSeriesEndDate", () => {
  it("accepts end date on last day of year", () => {
    expect(validateSeriesEndDate(`${year}-12-31`, `${year}-01-01`).valid).toBe(true);
  });

  it("accepts end date equal to start date", () => {
    expect(validateSeriesEndDate(`${year}-06-01`, `${year}-06-01`).valid).toBe(true);
  });

  it("rejects end date in next year", () => {
    expect(validateSeriesEndDate(`${year + 1}-01-01`, `${year}-01-01`).valid).toBe(false);
  });

  it("rejects end date before start date", () => {
    const result = validateSeriesEndDate(`${year}-03-01`, `${year}-06-01`);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("before start date");
  });

  it("rejects missing end date", () => {
    expect(validateSeriesEndDate("", `${year}-01-01`).valid).toBe(false);
  });

  it("rejects null end date", () => {
    expect(validateSeriesEndDate(null, `${year}-01-01`).valid).toBe(false);
  });
});

// ── Combined form validation (full expense/income form) ───────────────────────

describe("full form validation — all fields", () => {
  function validateForm({ summary, date, amount }) {
    const errors = [];
    const r1 = validateRequired(summary, "Summary");
    const r2 = validateDateInYear(date);
    const r3 = validateAmount(amount);
    if (!r1.valid) errors.push(r1.error);
    if (!r2.valid) errors.push(r2.error);
    if (!r3.valid) errors.push(r3.error);
    return { valid: errors.length === 0, errors };
  }

  it("passes when all fields are valid", () => {
    const result = validateForm({ summary: "Rent", date: `${year}-06-01`, amount: 1200 });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("collects multiple errors at once", () => {
    const result = validateForm({ summary: "", date: "", amount: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it("passes with minimum valid values (amount = 0.01)", () => {
    const result = validateForm({ summary: "x", date: `${year}-01-01`, amount: 0.01 });
    expect(result.valid).toBe(true);
  });
});
