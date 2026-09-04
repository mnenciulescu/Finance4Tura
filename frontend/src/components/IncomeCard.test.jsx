import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import IncomeCard from "./IncomeCard";

const income = {
  incomeId: "n1", date: "2026-09-01", summary: "Salary Sep",
  amount: 10000, currency: "RON",
};
const expenses = [
  { expenseId: "x1", date: "2026-09-03", summary: "Rent", amount: 4000,
    currency: "RON", priority: "High", status: "Pending", mappedIncomeId: "n1" },
];

const renderCard = (props = {}) =>
  render(
    <MemoryRouter>
      <IncomeCard income={income} expenses={expenses} showAmount {...props} />
    </MemoryRouter>
  );

const px = (v) => parseFloat(v);

describe("IncomeCard expense row icons", () => {
  it("gives the edit and delete icons the same box on mobile", () => {
    renderCard({ isMobile: true });
    const edit = screen.getByTitle("Edit expense");
    const del  = screen.getByTitle("Delete expense");

    expect(edit.style.width).toBe(del.style.width);
    expect(edit.style.height).toBe(del.style.height);
    expect(px(edit.style.width)).toBe(26);
  });

  it("sizes the edit glyph up so it reads as large as the delete emoji", () => {
    renderCard({ isMobile: true });
    const edit = screen.getByTitle("Edit expense");
    const del  = screen.getByTitle("Delete expense");

    // ✎ inks ~70% of its em box, 🗑 fills it — so the pencil needs the larger
    // font-size to end up the same visual size.
    expect(px(edit.style.fontSize)).toBeGreaterThan(px(del.style.fontSize));
    expect(px(edit.style.fontSize)).toBe(20);
  });

  it("actually applies the edit-link styling (s.editLink used to be undefined)", () => {
    renderCard({ isMobile: true });
    const edit = screen.getByTitle("Edit expense");
    expect(edit.style.opacity).toBe("0.45");
    expect(edit.style.display).toBe("inline-flex");
  });

  it("keeps the icons smaller on desktop", () => {
    renderCard({ isMobile: false });
    const edit = screen.getByTitle("Edit expense");
    expect(px(edit.style.width)).toBe(18);
    expect(px(edit.style.fontSize)).toBe(15);
  });
});
