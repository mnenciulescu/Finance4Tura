import { Checkbox } from "../../../ui/Checkbox";
import { Dot } from "../../../ui/Display";
import { PRIORITY_COLOR, PRIORITY_FALLBACK } from "../../../theme/domainColors";
import { fmtMoney } from "../../../utils/format";
import type { Expense } from "../../../types";
import s from "./Budget.module.css";

export interface ExpenseRowProps {
  exp: Expense;
  onToggle: (exp: Expense) => void;
  /** Budget rows can be edited and deleted; Today rows only tick. */
  onEdit?: (exp: Expense) => void;
}

/**
 * One expense line: circular checkbox, priority dot, ★ when special, summary,
 * MM-DD, amount. Completed rows are struck through and dimmed. Budget wraps it
 * in EditableExpenseRow (swipe actions + context menu); Today shows it as is.
 */
export function ExpenseRow({ exp, onToggle, onEdit }: ExpenseRowProps) {
  const done = exp.status === "Completed";
  const parts = (
    <>
      <Dot color={PRIORITY_COLOR[exp.priority] ?? PRIORITY_FALLBACK} size={9} label={`Priority: ${exp.priority}`} />
      {exp.special && <span className={s.star} title="Special" aria-label="Special">★</span>}
      <span className={s.expenseName} title={exp.summary}>{exp.summary}</span>
      <span className={s.expenseDate}>{exp.date.slice(5)}</span>
      <span className={s.expenseAmount}>{fmtMoney(exp.amount ?? 0)}</span>
    </>
  );
  const content = (
    <div
      className={[s.expenseRow, exp.special ? s.special : "", done ? s.done : ""].join(" ")}
      data-expense={exp.expenseId}
      data-status={exp.status}
    >
      <Checkbox
        label={`${exp.summary}: ${done ? "mark as pending" : "mark as completed"}`}
        isSelected={done}
        onChange={() => onToggle(exp)}
      />
      {onEdit ? (
        <button type="button" className={s.expenseMain} onClick={() => onEdit(exp)} aria-label={`Edit ${exp.summary}`}>
          {parts}
        </button>
      ) : (
        <div className={s.expenseMain}>{parts}</div>
      )}
    </div>
  );

  return content;
}
