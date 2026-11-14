import type { ReactNode } from "react";
import { Badge } from "../../../ui";
import { dowOf, monthParts } from "../../../utils/format";
import type { Income } from "../../../types";
import s from "./Budget.module.css";

/**
 * The income-period header, shared by Today's "This Period" widget and the
 * Budget cards so the two stay identical (proposal §12.4).
 */
export function PeriodHeader({
  income, trailing, amount, current,
}: { income: Income; trailing?: ReactNode; amount?: ReactNode; current?: boolean }) {
  const { month, day, year } = monthParts(income.date);
  return (
    <div className={s.periodHeader}>
      <div className={s.periodTop}>
        <span className={s.periodDate}>
          <span className={s.periodDay}>{month} {day}</span>
          <span className={s.periodYear}>{year} · {dowOf(income.date, income.dayOfWeek).toUpperCase()}</span>
        </span>
        {current && <Badge>Current</Badge>}
        <span className={s.flex} />
        {trailing}
      </div>
      <div className={s.periodNameRow}>
        <span className={s.periodName} title={income.summary}>{income.summary}</span>
        {amount}
      </div>
    </div>
  );
}
