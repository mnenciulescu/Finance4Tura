import { ProgressBar } from "../../../ui";
import { BUDGET_COLOR } from "../../../theme/domainColors";
import { fmtInt } from "../../../utils/format";
import type { PeriodTotals } from "./budgetMath";
import s from "./Budget.module.css";

/**
 * One capsule bar — Done / Pending / Free (or Over) — with the four figures
 * in a legend underneath (proposal §8.3). Segments keep a small minimum so a
 * tiny amount is still visible.
 */
export function BudgetBar({ totals }: { totals: PeriodTotals }) {
  if (totals.income <= 0) return null;
  const free = Math.max(0, totals.balance);
  const segments = [
    { value: totals.done, color: BUDGET_COLOR.done, label: "Done" },
    { value: totals.pending, color: BUDGET_COLOR.pending, label: "Pending" },
    ...(totals.over ? [] : [{ value: free, color: BUDGET_COLOR.free, label: "Free" }]),
  ];
  const label = `Spent ${fmtInt(totals.spent)}: done ${fmtInt(totals.done)}, pending ${fmtInt(totals.pending)}, ${
    totals.over ? `over by ${fmtInt(-totals.balance)}` : `free ${fmtInt(free)}`}`;
  return (
    <div className={s.budget}>
      <ProgressBar segments={segments} height={12} minFraction={0.05} label={label} />
      <dl className={s.legend}>
        <div className={s.legendItem}>
          <dt>Spent</dt>
          <dd data-figure="spent">{fmtInt(totals.spent)}</dd>
        </div>
        <div className={s.legendItem}>
          <dt><span className={s.legendDot} style={{ background: BUDGET_COLOR.done }} />Done</dt>
          <dd data-figure="done">{fmtInt(totals.done)}</dd>
        </div>
        <div className={s.legendItem}>
          <dt><span className={s.legendDot} style={{ background: BUDGET_COLOR.pending }} />Pending</dt>
          <dd data-figure="pending">{fmtInt(totals.pending)}</dd>
        </div>
        <div className={s.legendItem}>
          <dt>
            <span className={s.legendDot} style={{ background: totals.over ? BUDGET_COLOR.over : BUDGET_COLOR.free }} />
            {totals.over ? "Over" : "Free"}
          </dt>
          <dd data-figure={totals.over ? "over" : "free"} className={totals.over ? s.overFigure : undefined}>
            {fmtInt(totals.over ? -totals.balance : free)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
