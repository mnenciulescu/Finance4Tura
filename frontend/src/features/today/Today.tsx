import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Screen } from "../../app/Screen";
import { Badge, Button, Notice, ProgressRing, RevealScope, ScreenSkeleton, Skeleton, StatTile, Widget } from "../../ui";
import { keys, useBooks, useExpenses, useIncomes, useSplitPayments, useToggleExpense } from "../../data/queries";
import { BUDGET_COLOR } from "../../theme/domainColors";
import { fmtInt, fmtNum, todayIso } from "../../utils/format";
import { byCreatedDesc, splitStats } from "../../utils/split";
import { PeriodHeader } from "../money/budget/PeriodHeader";
import { ExpenseRow } from "../money/budget/ExpenseRow";
import { byPriorityThenDate } from "../money/budget/budgetMath";
import { SettleAlert, SplitSlots } from "../money/split/SplitSlots";
import { useSplitEditor } from "../money/split/useSplitEditor";
import { LibraryWidget } from "./LibraryWidget";
// Only shown while the app is not installed; loads on demand.
const InstallBanner = lazy(() => import("./InstallBanner").then(m => ({ default: m.InstallBanner })));
// Portfolio v2 data and maths load with the widget, outside the first download.
const HoldingsWidget = lazy(() => import("./HoldingsWidget"));
import type { Expense, Income } from "../../types";
import s from "./Today.module.css";
import b from "../money/budget/Budget.module.css";

/**
 * Today (proposal §8.2): the Home Overview as widgets — This Period, Split
 * Payments, Holdings, Library.
 */
export default function Today() {
  const qc = useQueryClient();
  const incomes = useIncomes();
  const expenses = useExpenses();
  const splits = useSplitPayments();
  const books = useBooks();

  // Which expenses were outstanding when the page loaded (or was refreshed).
  // Ticking one updates the cache but not this, so the row stays — struck
  // through — until the next load and a mistap can be undone.
  const [pendingAtLoad, setPendingAtLoad] = useState<Set<string> | null>(null);
  if (pendingAtLoad === null && expenses.data) {
    setPendingAtLoad(new Set(expenses.data.filter(e => e.status !== "Completed").map(e => e.expenseId)));
  }

  const refresh = async () => {
    await Promise.all([
      keys.incomes, keys.expenses, keys.splits, keys.books, ["pv2"],
    ].map(k => qc.invalidateQueries({ queryKey: k })));
    const fresh = qc.getQueryData<Expense[]>(keys.expenses) ?? [];
    setPendingAtLoad(new Set(fresh.filter(e => e.status !== "Completed").map(e => e.expenseId)));
  };

  const loading = incomes.isPending || expenses.isPending || splits.isPending || books.isPending;
  const error = incomes.isError || expenses.isError || splits.isError || books.isError;

  return (
    <Screen title="Today" subtitle={dayjs().format("dddd, D MMMM")} onRefresh={refresh}>
      <Suspense fallback={null}><InstallBanner /></Suspense>
      {error && <Notice>Failed to load data. Pull down to try again.</Notice>}
      {loading && !error ? (
        <ScreenSkeleton blocks={3} />
      ) : (
        <div className={s.widgets}>
          <ThisPeriod incomes={incomes.data ?? []} expenses={expenses.data ?? []} pendingAtLoad={pendingAtLoad ?? new Set()} />
          <SplitWidget />
          <RevealScope>
            <Suspense fallback={<Skeleton height={160} />}><HoldingsWidget /></Suspense>
          </RevealScope>
          <LibraryWidget books={books.data ?? []} />
        </div>
      )}
    </Screen>
  );
}

/* ── This Period ──────────────────────────────────────────────────────────── */

function ThisPeriod({ incomes, expenses, pendingAtLoad }: { incomes: Income[]; expenses: Expense[]; pendingAtLoad: Set<string> }) {
  const navigate = useNavigate();
  const toggle = useToggleExpense();
  const today = todayIso();

  const current = useMemo(() => {
    const past = incomes.filter(i => i.date <= today);
    return past.length ? past.reduce((best, i) => (i.date > best.date ? i : best)) : null;
  }, [incomes, today]);

  const periodExpenses = useMemo(
    () => (current ? expenses.filter(e => e.mappedIncomeId === current.incomeId) : []),
    [expenses, current],
  );

  // Priority then date — the Budget order. Status is deliberately not part of
  // the sort: keying on it made rows jump the moment one was ticked.
  const items = useMemo(
    () => periodExpenses.filter(e => pendingAtLoad.has(e.expenseId)).sort(byPriorityThenDate),
    [periodExpenses, pendingAtLoad],
  );

  const { done, pending } = useMemo(() => {
    let done = 0;
    let pending = 0;
    for (const e of periodExpenses) {
      const amt = Number(e.amount) || 0;
      if (e.status === "Completed") done += amt; else pending += amt;
    }
    return { done, pending };
  }, [periodExpenses]);

  if (!current) {
    return (
      <Widget title="This Period" icon="wallet">
        <p className={s.muted}>No current income period found.</p>
      </Widget>
    );
  }

  return (
    <section className={s.periodWidget} aria-label="This Period">
      <button type="button" className={s.periodHead} onClick={() => navigate("/money")} aria-label={`Open ${current.summary} in Budget`}>
        <PeriodHeader income={current} trailing={<Badge>Expenses</Badge>} />
      </button>
      {items.length === 0 ? (
        <p className={s.emptyLine}>
          {periodExpenses.length === 0 ? "No expenses for this period." : "Nothing left to pay."}
        </p>
      ) : (
        <ul className={b.expenseList} aria-label="Outstanding expenses">
          {items.map(exp => (
            <li key={exp.expenseId} className={b.expenseItem}>
              <ExpenseRow exp={exp} onToggle={e => toggle.mutate(e)} />
            </li>
          ))}
        </ul>
      )}
      {done + pending > 0 && (
        <div className={s.tiles}>
          <StatTile value={fmtInt(done)} caption="Done" dot={BUDGET_COLOR.done} label={`Done: ${fmtInt(done)}`} />
          <StatTile value={fmtInt(pending)} caption="Pending" dot={BUDGET_COLOR.pending} label={`Pending: ${fmtInt(pending)}`} />
        </div>
      )}
    </section>
  );
}

/* ── Split Payments (three newest open) ───────────────────────────────────── */

function SplitWidget() {
  const navigate = useNavigate();
  const splits = useSplitPayments();
  const editor = useSplitEditor();
  const keepId = useRef<string | null>(null);
  keepId.current = editor.pendingSettle?.entryId ?? null;

  const latest3 = useMemo(
    () => [...(splits.data ?? [])]
      // Outstanding only — plus the one being asked about, so the card does
      // not vanish out from under the question.
      .filter(p => !splitStats(p).complete || p.splitPaymentId === keepId.current)
      .sort(byCreatedDesc)
      .slice(0, 3),
    [splits.data, editor.pendingSettle], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <Widget
      title="Split Payments"
      icon="split"
      action={<Button variant="plain" size="small" onClick={() => navigate("/money/split")}>See All</Button>}
    >
      {latest3.length === 0 ? (
        <p className={s.muted}>No pending split payments.</p>
      ) : (
        <div className={s.splitList}>
          {latest3.map(entry => {
            const st = splitStats(entry);
            return (
              <div key={entry.splitPaymentId} className={s.splitTile} data-entry={entry.splitPaymentId}>
                <div className={s.splitHead}>
                  <ProgressRing done={st.paid} total={st.count} complete={st.complete} size={28} />
                  <span className={s.splitTitle}>{entry.title}</span>
                  <span className={s.splitTotal}>{fmtNum(entry.totalAmount)} {entry.currency}</span>
                </div>
                <SplitSlots entry={entry} onSetOcc={editor.setOcc} />
              </div>
            );
          })}
        </div>
      )}
      <SettleAlert pending={editor.pendingSettle} onConfirm={editor.confirmSettle} onCancel={editor.cancelSettle} />
    </Widget>
  );
}

