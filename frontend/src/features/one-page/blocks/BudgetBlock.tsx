import { useMemo, useState } from "react";
import {
  Button, EmptyState, IconButton, Notice, PrivateValue, PullDownMenu, SegmentedControl, Skeleton,
} from "../../../ui";
import { useExpenses, useIncomes, useToggleExpense } from "../../../data/queries";
import { useYear } from "../../../context/YearContext";
import { usePrivacy } from "../../../context/PrivacyContext";
import { useForms } from "../../money/forms/FormsContext";
import { PeriodHeader } from "../../money/budget/PeriodHeader";
import { BudgetBar } from "../../money/budget/BudgetBar";
import { EditableExpenseRow } from "../../money/budget/EditableExpenseRow";
import { useBudgetDeletes } from "../../money/budget/useBudgetDeletes";
import { byPriorityThenDate, currentIndex, groupByIncome, periodTotals } from "../../money/budget/budgetMath";
import { fmtMoney, fmtShortDate, todayIso } from "../../../utils/format";
import type { Expense } from "../../../types";
import { Block } from "../Block";
import { PERIOD_EVENT, useCommand, useParam } from "../state";
import b from "../../money/budget/Budget.module.css";
import s from "../OnePage.module.css";

type Filter = "all" | "pending" | "done" | "special";
const FILTERS: Record<Filter, (e: Expense) => boolean> = {
  all: () => true,
  pending: e => e.status !== "Completed",
  done: e => e.status === "Completed",
  special: e => !!e.special,
};

/**
 * Budget (One-Page §7.1): one income period with a period picker instead of
 * the swipe pager, the budget bar, filter chips and every expense row of the
 * period. Same rows, menus and deletes as Money → Budget. The block owns the
 * income-amount eye and the New Expense / New Income actions.
 */
export function BudgetBlock() {
  const incomesQ = useIncomes();
  const expensesQ = useExpenses();
  const { selectedYear } = useYear();
  const { incomeVisible, setIncomeVisible } = usePrivacy();
  const { openExpense, openIncome } = useForms();
  const toggle = useToggleExpense();
  const { requestDelete, requestIncomeDelete, dialogs } = useBudgetDeletes();
  const [periodParam, setPeriod] = useParam("period", "");
  const [filter, setFilter] = useState<Filter>("all");
  const today = todayIso();

  const yearIncomes = useMemo(
    () => (incomesQ.data ?? []).filter(i => i.date.startsWith(String(selectedYear))),
    [incomesQ.data, selectedYear],
  );
  const byIncome = useMemo(() => groupByIncome(expensesQ.data ?? []), [expensesQ.data]);
  const currentIdx = currentIndex(yearIncomes, today);
  const homeIdx = currentIdx === -1 ? 0 : currentIdx;
  const found = yearIncomes.findIndex(i => i.incomeId === periodParam);
  const idx = found === -1 ? homeIdx : found;
  const income = yearIncomes[idx];

  const all = useMemo(
    () => (income ? (byIncome[income.incomeId] ?? []).slice().sort(byPriorityThenDate) : []),
    [byIncome, income],
  );
  const list = all.filter(FILTERS[filter]);

  const go = (i: number) => {
    const next = yearIncomes[Math.max(0, Math.min(i, yearIncomes.length - 1))];
    if (next) setPeriod(next === yearIncomes[homeIdx] ? null : next.incomeId);
  };
  // ← / → / T from the page's keyboard shortcuts.
  useCommand<number>(PERIOD_EVENT, d => (d === 0 ? go(homeIdx) : go(idx + d)));

  const loading = incomesQ.isPending || expensesQ.isPending;
  const error = incomesQ.isError || expensesQ.isError;

  return (
    <Block
      id="budget"
      title="Budget"
      actions={
        <>
          <IconButton
            icon={incomeVisible ? "eye" : "eyeSlash"}
            label={incomeVisible ? "Hide income amounts" : "Show income amounts"}
            title="Income amounts (H)"
            onClick={() => setIncomeVisible(!incomeVisible)}
          />
          <Button variant="tinted" size="small" icon="plus" onClick={() => openExpense({ date: income?.date })}>Add Expense</Button>
          <PullDownMenu
            label="Budget actions"
            items={[
              { id: "income", label: "New Income", icon: "arrowDown", onAction: () => openIncome({}) },
              { id: "expense", label: "New Expense", icon: "wallet", onAction: () => openExpense({}) },
            ]}
          />
        </>
      }
    >
      {error && <Notice>Failed to load data. Use Refresh to try again.</Notice>}
      {loading ? (
        <Skeleton height={260} />
      ) : !income ? (
        <EmptyState
          icon="wallet"
          title={`No incomes in ${selectedYear}`}
          message="Add an income to start budgeting this period."
          action={<Button variant="tinted" icon="plus" onClick={() => openIncome({})}>Add Income</Button>}
        />
      ) : (
        <>
          <div className={s.periodBar}>
            <IconButton icon="chevronLeft" label="Previous period" disabled={idx <= 0} onClick={() => go(idx - 1)} />
            <PullDownMenu
              label="Choose period"
              appearance="text"
              placement="bottom start"
              text={<span className={s.periodPick}>{fmtShortDate(income.date)} · {income.summary}</span>}
              items={yearIncomes.map((inc, i) => ({
                id: inc.incomeId,
                label: `${fmtShortDate(inc.date)} · ${inc.summary}${i === currentIdx ? " (current)" : ""}`,
                selected: i === idx,
                onAction: () => go(i),
              }))}
            />
            <IconButton icon="chevronRight" label="Next period" disabled={idx >= yearIncomes.length - 1} onClick={() => go(idx + 1)} />
            <span className={s.flex} />
            <span className={s.periodCount}>{`Period ${idx + 1} of ${yearIncomes.length}`}</span>
            {idx !== homeIdx && <Button variant="tinted" size="small" onClick={() => go(homeIdx)}>Today</Button>}
          </div>

          <article className={[b.periodCard, s.flushCard].join(" ")} data-period={income.incomeId} aria-hidden="false">
            <PeriodHeader
              income={income}
              current={idx === currentIdx}
              amount={
                <span className={b.periodAmount}>
                  <PrivateValue visible={incomeVisible} chars={8}>
                    {fmtMoney(income.amount ?? 0)} {income.currency ?? "RON"}
                  </PrivateValue>
                </span>
              }
              trailing={
                <PullDownMenu
                  label={`Actions for ${income.summary}`}
                  icon="ellipsisCircle"
                  items={[
                    { id: "edit", label: "Edit Income", icon: "pencil", onAction: () => openIncome({ id: income.incomeId }) },
                    { id: "add", label: "Add Expense to This Period", icon: "plus", onAction: () => openExpense({ date: income.date }) },
                    { id: "sep", separator: true },
                    { id: "delete", label: "Delete Income", icon: "trash", destructive: true, onAction: () => requestIncomeDelete(income) },
                  ]}
                />
              }
            />
            <BudgetBar totals={periodTotals(income, all)} />

            <div className={s.filterRow}>
              <SegmentedControl
                label="Show expenses"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: `All ${all.length}` },
                  { value: "pending", label: "Pending" },
                  { value: "done", label: "Done" },
                  { value: "special", label: "★" },
                ]}
              />
            </div>

            <ul className={b.expenseList} aria-label={`Expenses for ${income.summary}`}>
              {list.length === 0 && (
                <li className={b.emptyRow}>{all.length === 0 ? "No expenses mapped" : "No expenses match this filter"}</li>
              )}
              {list.map(exp => (
                <li key={exp.expenseId} className={b.expenseItem}>
                  <EditableExpenseRow
                    exp={exp}
                    onToggle={e => toggle.mutate(e)}
                    onEdit={e => openExpense({ id: e.expenseId })}
                    onDelete={e => requestDelete(e, true)}
                    onRequestDelete={e => requestDelete(e, false)}
                  />
                </li>
              ))}
              <li className={b.expenseItem}>
                <button type="button" className={b.addRow} onClick={() => openExpense({ date: income.date })}>
                  + Add Expense
                </button>
              </li>
            </ul>
          </article>
        </>
      )}
      {dialogs}
    </Block>
  );
}
