import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, EmptyState, IconButton, Notice, PrivateValue, PullDownMenu, ScreenSkeleton } from "../../../ui";
import { MoneyScreen, YearMenu } from "../MoneyScreen";
import { useForms } from "../forms/FormsContext";
import { availableYears, keys, useExpenses, useIncomes, useToggleExpense } from "../../../data/queries";
import { useYear } from "../../../context/YearContext";
import { usePrivacy } from "../../../context/PrivacyContext";
import { TAB_RESELECT_EVENT } from "../../../app/tabHistory";
import { fmtMoney, todayIso } from "../../../utils/format";
import { PeriodHeader } from "./PeriodHeader";
import { BudgetBar } from "./BudgetBar";
import { EditableExpenseRow } from "./EditableExpenseRow";
import { useBudgetDeletes } from "./useBudgetDeletes";
import { byPriorityThenDate, currentIndex, groupByIncome, periodTotals } from "./budgetMath";
import s from "./Budget.module.css";

/**
 * Money → Budget (proposal §8.3): one income period at a time in a
 * scroll-snap pager, with ‹ › and a Today button that appears when the
 * current period is off-screen.
 */
export default function Budget() {
  const incomesQ = useIncomes();
  const expensesQ = useExpenses();
  const qc = useQueryClient();
  const { selectedYear } = useYear();
  const { incomeVisible, setIncomeVisible } = usePrivacy();
  const { openExpense, openIncome } = useForms();
  const toggle = useToggleExpense();
  const { requestDelete, requestIncomeDelete, dialogs } = useBudgetDeletes();

  const [active, setActive] = useState(0);
  const [heights, setHeights] = useState<Record<number, number>>({});
  const pager = useRef<HTMLDivElement>(null);
  const today = todayIso();

  const years = useMemo(() => availableYears(incomesQ.data), [incomesQ.data]);
  const yearIncomes = useMemo(
    () => (incomesQ.data ?? []).filter(i => i.date.startsWith(String(selectedYear))),
    [incomesQ.data, selectedYear],
  );
  const currentIdx = currentIndex(yearIncomes, today);
  const homeIdx = currentIdx === -1 ? 0 : currentIdx;
  const byIncome = useMemo(() => groupByIncome(expensesQ.data ?? []), [expensesQ.data]);

  const scrollToIndex = useCallback((idx: number, smooth = true) => {
    const el = pager.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(idx, yearIncomes.length - 1));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: smooth ? "smooth" : "auto" });
    setActive(clamped);
  }, [yearIncomes.length]);

  // Land on the current period when the year (or the data) changes.
  useLayoutEffect(() => {
    if (yearIncomes.length === 0) return;
    scrollToIndex(homeIdx, false);
  }, [selectedYear, yearIncomes.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-tapping the Money tab returns to the current period.
  useEffect(() => {
    const onReselect = (e: Event) => { if ((e as CustomEvent).detail === "money") scrollToIndex(homeIdx); };
    window.addEventListener(TAB_RESELECT_EVENT, onReselect);
    return () => window.removeEventListener(TAB_RESELECT_EVENT, onReselect);
  }, [homeIdx, scrollToIndex]);

  const onScroll = () => {
    const el = pager.current;
    if (!el || el.clientWidth === 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== active) setActive(idx);
  };

  // The pager takes the height of the visible card, not the tallest one.
  // One stable ref callback and observer per page index.
  const observers = useRef(new Map<number, ResizeObserver>());
  const refFns = useRef(new Map<number, (node: HTMLDivElement | null) => void>());
  const measure = (idx: number) => {
    let fn = refFns.current.get(idx);
    if (!fn) {
      fn = (node: HTMLDivElement | null) => {
        observers.current.get(idx)?.disconnect();
        observers.current.delete(idx);
        if (!node || typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver(([entry]) => {
          const h = Math.ceil(entry.contentRect.height);
          setHeights(prev => (prev[idx] === h ? prev : { ...prev, [idx]: h }));
        });
        ro.observe(node);
        observers.current.set(idx, ro);
      };
      refFns.current.set(idx, fn);
    }
    return fn;
  };
  useEffect(() => () => observers.current.forEach(ro => ro.disconnect()), []);

  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: keys.incomes }),
    qc.invalidateQueries({ queryKey: keys.expenses }),
  ]);

  const loading = incomesQ.isPending || expensesQ.isPending;
  const error = incomesQ.isError || expensesQ.isError;

  return (
    <MoneyScreen
      segment="budget"
      onRefresh={refresh}
      actions={
        <>
          <YearMenu years={years} />
          <IconButton
            icon={incomeVisible ? "eye" : "eyeSlash"}
            label={incomeVisible ? "Hide income amounts" : "Show income amounts"}
            onClick={() => setIncomeVisible(!incomeVisible)}
          />
          <PullDownMenu
            label="Add"
            icon="plus"
            items={[
              { id: "expense", label: "New Expense", icon: "wallet", onAction: () => openExpense({}) },
              { id: "income", label: "New Income", icon: "arrowDown", onAction: () => openIncome({}) },
            ]}
          />
        </>
      }
    >
      {error && <Notice>Failed to load data. Pull down to try again.</Notice>}

      {loading ? (
        <ScreenSkeleton blocks={2} />
      ) : yearIncomes.length === 0 ? (
        <EmptyState
          icon="wallet"
          title={`No incomes in ${selectedYear}`}
          message="Add an income to start budgeting this period."
          action={<Button variant="tinted" icon="plus" onClick={() => openIncome({})}>Add Income</Button>}
        />
      ) : (
        <>
          <div className={s.pagerBar}>
            <IconButton icon="chevronLeft" label="Previous period" disabled={active <= 0} onClick={() => scrollToIndex(active - 1)} />
            <span className={s.pagerLabel} aria-live="polite">Period {active + 1} of {yearIncomes.length}</span>
            <IconButton icon="chevronRight" label="Next period" disabled={active >= yearIncomes.length - 1} onClick={() => scrollToIndex(active + 1)} />
            <span className={s.flex} />
            {active !== homeIdx && (
              <Button variant="tinted" size="small" onClick={() => scrollToIndex(homeIdx)}>Today</Button>
            )}
          </div>

          <div
            ref={pager}
            className={s.pager}
            onScroll={onScroll}
            style={heights[active] ? { height: heights[active] } : undefined}
            aria-roledescription="carousel"
            aria-label="Income periods"
          >
            {yearIncomes.map((income, idx) => {
              const list = (byIncome[income.incomeId] ?? []).slice().sort(byPriorityThenDate);
              const totals = periodTotals(income, list);
              const near = Math.abs(idx - active) <= 1;
              return (
                <div
                  key={income.incomeId}
                  className={s.page}
                  aria-roledescription="slide"
                  aria-label={`${income.summary}, ${income.date}`}
                  aria-hidden={idx !== active}
                  data-period={income.incomeId}
                  data-current={idx === currentIdx || undefined}
                >
                  <div ref={measure(idx)} className={s.pageInner}>
                    {near ? (
                      <article className={s.periodCard}>
                        <PeriodHeader
                          income={income}
                          current={idx === currentIdx}
                          amount={
                            <span className={s.periodAmount}>
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
                        <BudgetBar totals={totals} />
                        <ul className={s.expenseList} aria-label={`Expenses for ${income.summary}`}>
                          {list.length === 0 && <li className={s.emptyRow}>No expenses mapped</li>}
                          {list.map(exp => (
                            <li key={exp.expenseId} className={s.expenseItem}>
                              <EditableExpenseRow
                                exp={exp}
                                onToggle={e => toggle.mutate(e)}
                                onEdit={e => openExpense({ id: e.expenseId })}
                                onDelete={e => requestDelete(e, true)}
                                onRequestDelete={e => requestDelete(e, false)}
                              />
                            </li>
                          ))}
                          <li className={s.expenseItem}>
                            <button type="button" className={s.addRow} onClick={() => openExpense({ date: income.date })}>
                              + Add Expense
                            </button>
                          </li>
                        </ul>
                      </article>
                    ) : (
                      <div className={s.placeholder} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {dialogs}
    </MoneyScreen>
  );
}
