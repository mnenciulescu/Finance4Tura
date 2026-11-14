import { lazy, Suspense, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dot, EmptyState, List, ListRow, ListSection, Notice, ScreenSkeleton, Skeleton, StatTile } from "../../../ui";
import { MoneyScreen, YearMenu } from "../MoneyScreen";
import { availableYears, useExpensesForYear, useIncomes, useIncomesForYear } from "../../../data/queries";
import { useYear } from "../../../context/YearContext";
import { PRIORITY_COLOR, STATS_COLOR } from "../../../theme/domainColors";
import { fmt1, fmtInt, fmtShortDate, MONTH_ABBR } from "../../../utils/format";
import { averages, buildMonthly, type MonthRow } from "./statsMath";
import s from "./Stats.module.css";

const FreeChart = lazy(() => import("./FreeChart"));

/** Money → Stats (proposal §8.6). All calculations unchanged. */
export default function StatsScreen() {
  const qc = useQueryClient();
  const { selectedYear } = useYear();
  const all = useIncomes();
  const incomes = useIncomesForYear(selectedYear);
  const expenses = useExpensesForYear(selectedYear);
  const [selected, setSelected] = useState<number | null>(null);

  const today = new Date();
  const currentMonth = today.getFullYear() === selectedYear ? today.getMonth() : -1;
  const rows = useMemo(
    () => buildMonthly(incomes.data ?? [], expenses.data ?? [], selectedYear),
    [incomes.data, expenses.data, selectedYear],
  );
  const avg = averages(rows);
  const special = useMemo(
    () => (expenses.data ?? []).filter(e => e.special).sort((a, b) => a.date.localeCompare(b.date)),
    [expenses.data],
  );
  const specialTotal = special.reduce((sum, e) => sum + (e.amount ?? 0), 0);
  const sel: MonthRow | null = selected != null ? rows[selected] : null;

  const loading = incomes.isPending || expenses.isPending;
  const error = incomes.isError || expenses.isError;

  return (
    <MoneyScreen
      segment="stats"
      subtitle={loading ? undefined : <>{avg.months} month{avg.months === 1 ? "" : "s"} with data{currentMonth >= 0 && <> · now {MONTH_ABBR[currentMonth]}</>}</>}
      actions={<YearMenu years={availableYears(all.data)} />}
      onRefresh={() => Promise.all([
        qc.invalidateQueries({ queryKey: ["incomes"] }),
        qc.invalidateQueries({ queryKey: ["expenses"] }),
      ])}
    >
      {error ? (
        <Notice>Failed to load data.</Notice>
      ) : loading ? (
        <ScreenSkeleton blocks={3} />
      ) : avg.months === 0 ? (
        <EmptyState icon="chartBar" title={`No data for ${selectedYear}`} message="Incomes and expenses for this year will show here." />
      ) : (
        <>
          <ListSection header="Monthly averages" bare>
            <div className={s.tiles}>
              <StatTile
                value={fmt1(avg.free)}
                caption="Avg free / month"
                tone={avg.free >= 0 ? undefined : "negative"}
                label={`Average free per month: ${fmt1(avg.free)}`}
              />
              <StatTile value={fmt1(avg.survival)} caption="Survival / month" label={`Survival per month: ${fmt1(avg.survival)}`} />
            </div>
          </ListSection>
          <ListSection footer={`Across ${avg.months} month${avg.months === 1 ? "" : "s"} with data.`}>
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
          </ListSection>

          <ListSection header="Free amount per month" bare>
            <div className={s.chartCard}>
              <Suspense fallback={<Skeleton height={220} />}>
                <FreeChart rows={rows} currentMonth={currentMonth} selected={selected} onSelect={setSelected} />
              </Suspense>
              {sel && sel.free != null && (
                <div className={s.breakdown} aria-live="polite" data-testid="month-breakdown">
                  <div className={s.breakdownHead}>{sel.label} {selectedYear}</div>
                  <dl className={s.breakdownGrid}>
                    <dt>Income</dt><dd>{fmtInt(sel.income)}</dd>
                    <dt><Dot color={PRIORITY_COLOR.High} size={8} /> High</dt><dd>{fmtInt(sel.high)}</dd>
                    <dt><Dot color={PRIORITY_COLOR.Medium} size={8} /> Medium</dt><dd>{fmtInt(sel.medium)}</dd>
                    <dt><Dot color={PRIORITY_COLOR.Low} size={8} /> Low</dt><dd>{fmtInt(sel.low)}</dd>
                    <dt className={s.freeLabel}>Free</dt>
                    <dd className={sel.free < 0 ? s.negative : s.positive}>{fmtInt(sel.free)}</dd>
                  </dl>
                </div>
              )}
            </div>
          </ListSection>

          <ListSection
            header={<>★ Special expenses · {special.length === 0 ? `none in ${selectedYear}` : `${special.length} in ${selectedYear} · ${fmtInt(specialTotal)}`}</>}
            collapsible
            defaultOpen={false}
          >
            {special.length === 0 ? (
              <p className={s.none}>No special expenses in {selectedYear}.</p>
            ) : (
              <List aria-label="Special expenses">
                {special.map(e => (
                  <ListRow
                    key={e.expenseId}
                    leading={<span className={s.star} style={{ color: STATS_COLOR.special }}>★</span>}
                    title={e.summary}
                    subtitle={fmtShortDate(e.date)}
                    trailing={<span className={s.figure}>{fmtInt(e.amount)}</span>}
                  />
                ))}
                <ListRow title={<strong>Total</strong>} trailing={<strong className={s.special}>{fmtInt(specialTotal)}</strong>} />
              </List>
            )}
          </ListSection>
        </>
      )}
    </MoneyScreen>
  );
}
