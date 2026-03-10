/**
 * Tests for year-boundary date validation (mirrors frontend AddIncome / AddExpense logic).
 */

function validateDateInYear(date, year = new Date().getFullYear()) {
  const yearStart = `${year}-01-01`;
  const yearEnd   = `${year}-12-31`;
  if (!date || date < yearStart || date > yearEnd) {
    return { valid: false, error: `Date must be within the current year (${year}).` };
  }
  return { valid: true };
}

function validateSeriesEndDate(endDate, startDate, year = new Date().getFullYear()) {
  const yearEnd = `${year}-12-31`;
  if (!endDate) return { valid: false, error: "Series end date is required." };
  if (endDate > yearEnd) return { valid: false, error: `Series end date must be within the current year (${year}).` };
  if (endDate < startDate) return { valid: false, error: "Series end date cannot be before start date." };
  return { valid: true };
}

const yr = new Date().getFullYear();

describe("validateDateInYear", () => {
  it("accepts a valid mid-year date", () => {
    expect(validateDateInYear(`${yr}-06-01`).valid).toBe(true);
  });

  it("accepts January 1st boundary", () => {
    expect(validateDateInYear(`${yr}-01-01`).valid).toBe(true);
  });

  it("accepts December 31st boundary", () => {
    expect(validateDateInYear(`${yr}-12-31`).valid).toBe(true);
  });

  it("rejects previous year date", () => {
    const result = validateDateInYear(`${yr - 1}-12-31`);
    expect(result.valid).toBe(false);
    expect(result.error).toContain(String(yr));
  });

  it("rejects next year date", () => {
    expect(validateDateInYear(`${yr + 1}-01-01`).valid).toBe(false);
  });

  it("rejects empty date", () => {
    expect(validateDateInYear("").valid).toBe(false);
  });

  it("rejects null date", () => {
    expect(validateDateInYear(null).valid).toBe(false);
  });
});

describe("validateSeriesEndDate", () => {
  it("accepts end date on last day of year", () => {
    expect(validateSeriesEndDate(`${yr}-12-31`, `${yr}-01-01`).valid).toBe(true);
  });

  it("rejects end date in next year", () => {
    const result = validateSeriesEndDate(`${yr + 1}-01-01`, `${yr}-01-01`);
    expect(result.valid).toBe(false);
  });

  it("rejects missing end date", () => {
    expect(validateSeriesEndDate("", `${yr}-01-01`).valid).toBe(false);
  });

  it("rejects end date before start date", () => {
    const result = validateSeriesEndDate(`${yr}-03-01`, `${yr}-06-01`);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("before start date");
  });
});
