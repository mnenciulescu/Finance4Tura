import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { EmptyState, ListSection, Notice, ScreenSkeleton } from "../../../ui";
import { MoneyScreen, YearMenu } from "../MoneyScreen";
import { availableYears, useExpensesForYear, useIncomes, useIncomesForYear } from "../../../data/queries";
import { useYear } from "../../../context/YearContext";
import { fmtInt, MONTH_ABBR } from "../../../utils/format";
import { averages, buildMonthly } from "./statsMath";
import { AverageTiles, FreeMonthPanel, PriorityAverages, SpecialList } from "./StatsPanels";
import s from "./Stats.module.css";

/** Money → Stats (proposal §8.6). All calculations unchanged. */
export default function StatsScreen() {
  const qc = useQueryClient();
  const { selectedYear } = useYear();
  const all = useIncomes();
  const incomes = useIncomesForYear(selectedYear);
  const expenses = useExpensesForYear(selectedYear);

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
            <AverageTiles avg={avg} />
          </ListSection>
          <ListSection footer={`Across ${avg.months} month${avg.months === 1 ? "" : "s"} with data.`}>
            <PriorityAverages avg={avg} />
          </ListSection>

          <ListSection header="Free amount per month" bare>
            <div className={s.chartCard}>
              <FreeMonthPanel rows={rows} currentMonth={currentMonth} year={selectedYear} />
            </div>
          </ListSection>

          <ListSection
            header={<>★ Special expenses · {special.length === 0 ? `none in ${selectedYear}` : `${special.length} in ${selectedYear} · ${fmtInt(specialTotal)}`}</>}
            collapsible
            defaultOpen={false}
          >
            <SpecialList special={special} total={specialTotal} year={selectedYear} />
          </ListSection>
        </>
      )}
    </MoneyScreen>
  );
}
