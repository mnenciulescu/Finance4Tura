import { lazy, Suspense, useState, type ReactNode } from "react";
import { Dot, List, ListRow, PrivateValue, Skeleton, StatTile } from "../../../ui";
import { PRIORITY_COLOR, STATS_COLOR } from "../../../theme/domainColors";
import { fmt1, fmtInt, fmtShortDate } from "../../../utils/format";
import type { Expense } from "../../../types";
import type { averages, MonthRow } from "./statsMath";
import s from "./Stats.module.css";

/* The Stats screen's content, shared by Money → Stats and One-Page. */

const FreeChart = lazy(() => import("./FreeChart"));

type Averages = ReturnType<typeof averages>;

export function AverageTiles({ avg }: { avg: Averages }) {
  return (
    <div className={s.tiles}>
      <StatTile
        value={fmt1(avg.free)}
        caption="Avg free / month"
        tone={avg.free >= 0 ? undefined : "negative"}
        label={`Average free per month: ${fmt1(avg.free)}`}
      />
      <StatTile value={fmt1(avg.survival)} caption="Survival / month" label={`Survival per month: ${fmt1(avg.survival)}`} />
    </div>
  );
}

export function PriorityAverages({ avg }: { avg: Averages }) {
  return (
    <List aria-label="Average by priority">
      {(["High", "Medium", "Low"] as const).map(p => (
        <ListRow
          key={p}
          leading={<Dot color={PRIORITY_COLOR[p]} />}
          title={p}
          trailing={<span className={s.figure} data-avg={p.toLowerCase()}>{fmt1(avg[p.toLowerCase() as "high"])}</span>}
        />
      ))}
    </List>
  );
}

/**
 * Free amount per month; clicking a bar shows that month's breakdown.
 * `incomeVisible: false` hides the month's income behind a redaction capsule.
 */
export function FreeMonthPanel({
  rows, currentMonth, year, incomeVisible = true, height, footer,
}: {
  rows: MonthRow[]; currentMonth: number; year: number; incomeVisible?: boolean; height?: number;
  /** Extra line under the breakdown (One-Page: Open in Budget). */
  footer?: (monthIndex: number) => ReactNode;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const sel: MonthRow | null = selected != null ? rows[selected] : null;
  return (
    <>
      <Suspense fallback={<Skeleton height={height ?? 220} />}>
        <FreeChart rows={rows} currentMonth={currentMonth} selected={selected} onSelect={setSelected} height={height} />
      </Suspense>
      {sel && sel.free != null && selected != null && (
        <div className={s.breakdown} aria-live="polite" data-testid="month-breakdown">
          <div className={s.breakdownHead}>{sel.label} {year}</div>
          <dl className={s.breakdownGrid}>
            <dt>Income</dt><dd><PrivateValue visible={incomeVisible} chars={6}>{fmtInt(sel.income)}</PrivateValue></dd>
            <dt><Dot color={PRIORITY_COLOR.High} size={8} /> High</dt><dd>{fmtInt(sel.high)}</dd>
            <dt><Dot color={PRIORITY_COLOR.Medium} size={8} /> Medium</dt><dd>{fmtInt(sel.medium)}</dd>
            <dt><Dot color={PRIORITY_COLOR.Low} size={8} /> Low</dt><dd>{fmtInt(sel.low)}</dd>
            <dt className={s.freeLabel}>Free</dt>
            <dd className={sel.free < 0 ? s.negative : s.positive}>{fmtInt(sel.free)}</dd>
          </dl>
          {footer?.(selected)}
        </div>
      )}
    </>
  );
}

export function SpecialList({
  special, total, year, limit, onOpen,
}: { special: Expense[]; total: number; year: number; limit?: number; onOpen?: (e: Expense) => void }) {
  if (special.length === 0) return <p className={s.none}>No special expenses in {year}.</p>;
  const shown = limit != null ? special.slice(0, limit) : special;
  return (
    <List aria-label="Special expenses">
      {shown.map(e => (
        <ListRow
          key={e.expenseId}
          leading={<span className={s.star} style={{ color: STATS_COLOR.special }}>★</span>}
          title={e.summary}
          subtitle={fmtShortDate(e.date)}
          trailing={<span className={s.figure}>{fmtInt(e.amount)}</span>}
          onPress={onOpen ? () => onOpen(e) : undefined}
        />
      ))}
      <ListRow title={<strong>Total</strong>} trailing={<strong className={s.special}>{fmtInt(total)}</strong>} />
    </List>
  );
}
