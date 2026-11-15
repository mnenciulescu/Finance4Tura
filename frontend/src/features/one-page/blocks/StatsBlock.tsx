import { lazy, Suspense, useMemo } from "react";
import {
  Dot, EmptyState, Notice, RevealButton, SegmentedTabs, ShowMore, Skeleton, useRevealed, useShowMore,
} from "../../../ui";
import { useBooks, useExpensesForYear, useFxRates, useIncomesForYear, useOperations, useSnapshots } from "../../../data/queries";
import { useHqEntries, useHqLocations, useHqTemplates } from "../../../data/hq";
import { useYear } from "../../../context/YearContext";
import { usePrivacy } from "../../../context/PrivacyContext";
import { useForms } from "../../money/forms/FormsContext";
import { PRIORITY_COLOR } from "../../../theme/domainColors";
import { fmtInt, MONTH_ABBR } from "../../../utils/format";
import { averages, buildMonthly } from "../../money/stats/statsMath";
import { AverageTiles, FreeMonthPanel, PriorityAverages, SpecialList } from "../../money/stats/StatsPanels";
import { EvolutionPanel } from "../../money/invest/InvestPanels";
import { applyFilters, sectionsOf } from "../../library/libraryMath";
import { isWaterTemplate } from "../../hq/hqMath";
import { Block, ChipTabs, LinkButton } from "../Block";
import { useEnumParam, useOnePage, useParam } from "../state";
import st from "../../money/stats/Stats.module.css";
import s from "../OnePage.module.css";

const PeopleChart = lazy(() => import("../../library/PeopleChart"));
const WaterChart = lazy(() => import("../../hq/WaterChart"));

const TABS = ["budget", "prio", "special", "invest", "library", "hq"] as const;
type Tab = (typeof TABS)[number];

/**
 * Statistics (One-Page §7.4): one tab per topic. Budget, Priorities and
 * Special follow the header's year; the others keep their own ranges.
 */
export function StatsBlock() {
  const [tab, setTab] = useEnumParam<Tab>("stats", TABS, "budget");
  return (
    <Block
      id="stats"
      title="Statistics"
      tabs={
        <SegmentedTabs
          label="Statistics topics"
          value={tab}
          onChange={setTab}
          options={[
            { value: "budget", label: "Budget" },
            { value: "prio", label: "Priorities" },
            { value: "special", label: "★ Special" },
            { value: "invest", label: "Invest" },
            { value: "library", label: "Library" },
            { value: "hq", label: "HQ" },
          ]}
        />
      }
    >
      {tab === "invest" ? <InvestStats /> : tab === "library" ? <LibraryStats /> : tab === "hq" ? <HqStats /> : <BudgetStats tab={tab} />}
    </Block>
  );
}

/* ── Budget · Priorities · Special ────────────────────────────────────────── */

function BudgetStats({ tab }: { tab: "budget" | "prio" | "special" }) {
  const { selectedYear } = useYear();
  const { incomeVisible } = usePrivacy();
  const { openExpense } = useForms();
  const { focusBlock } = useOnePage();
  const [, setPeriod] = useParam("period", "");
  const incomes = useIncomesForYear(selectedYear);
  const expenses = useExpensesForYear(selectedYear);
  const [limit, setLimit] = useShowMore(3, String(selectedYear));

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

  // "Open in Budget": the month's last income period.
  const periodOf = (monthIdx: number) => {
    const key = `${selectedYear}-${String(monthIdx + 1).padStart(2, "0")}`;
    return (incomes.data ?? []).filter(i => i.date.startsWith(key)).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  };

  if (incomes.isError || expenses.isError) return <Notice>Failed to load data.</Notice>;
  if (incomes.isPending || expenses.isPending) return <Skeleton height={240} />;
  if (avg.months === 0) return <EmptyState icon="chartBar" title={`No data for ${selectedYear}`} message="Incomes and expenses for this year will show here." />;

  const caption = <p className={s.caption}>{avg.months} month{avg.months === 1 ? "" : "s"} with data{currentMonth >= 0 && <> · now {MONTH_ABBR[currentMonth]}</>} · {selectedYear}</p>;

  if (tab === "budget") {
    return (
      <>
        {caption}
        <AverageTiles avg={avg} />
        <h3 className={s.subhead}>Free amount per month</h3>
        <div className={st.chartCard}>
          <FreeMonthPanel
            rows={rows}
            currentMonth={currentMonth}
            year={selectedYear}
            incomeVisible={incomeVisible}
            height={240}
            footer={i => {
              const inc = periodOf(i);
              return inc ? (
                <div className={s.linkRow}>
                  <LinkButton onClick={() => { setPeriod(inc.incomeId); focusBlock("budget"); }}>Open in Budget →</LinkButton>
                </div>
              ) : null;
            }}
          />
        </div>
      </>
    );
  }

  if (tab === "prio") {
    return (
      <>
        {caption}
        <PriorityAverages avg={avg} />
        <h3 className={s.subhead}>Per month</h3>
        <div className={s.tableWrap}>
          <table className={s.table} aria-label="Expenses by priority per month">
            <thead>
              <tr>
                <th scope="col">Month</th>
                {(["High", "Medium", "Low"] as const).map(p => (
                  <th key={p} scope="col"><Dot color={PRIORITY_COLOR[p]} size={8} /> {p}</th>
                ))}
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.filter(r => r.hasData).map(r => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  <td>{fmtInt(r.high)}</td>
                  <td>{fmtInt(r.medium)}</td>
                  <td>{fmtInt(r.low)}</td>
                  <td><strong>{fmtInt((r.high ?? 0) + (r.medium ?? 0) + (r.low ?? 0))}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <>
      <p className={s.caption}>{special.length} special expense{special.length === 1 ? "" : "s"} in {selectedYear} · {fmtInt(specialTotal)}</p>
      <SpecialList special={special} total={specialTotal} year={selectedYear} limit={limit} onOpen={e => openExpense({ id: e.expenseId })} />
      <ShowMore shown={limit} total={special.length} initial={3} step={5} onChange={setLimit} allowAll />
    </>
  );
}

/* ── Investments ──────────────────────────────────────────────────────────── */

function InvestStats() {
  const ops = useOperations();
  const snaps = useSnapshots();
  const fx = useFxRates();
  const revealed = useRevealed("holdings");
  if (ops.isPending || snaps.isPending) return <Skeleton height={240} />;
  if (ops.isError || snaps.isError) return <Notice>Could not load investments data.</Notice>;
  return (
    <>
      <div className={s.captionRow}>
        <p className={s.caption}>Portfolio evolution in EUR{revealed ? "" : " · values hidden, hold the eye to show them"}</p>
        <RevealButton group="holdings" label="Hold to reveal amounts" />
      </div>
      <div className={st.chartCard}>
        <EvolutionPanel snapshots={snaps.data ?? []} operations={ops.data ?? []} rates={fx.data?.rates ?? null} masked={!revealed} height={250} />
      </div>
    </>
  );
}

/* ── Library ──────────────────────────────────────────────────────────────── */

function LibraryStats() {
  const books = useBooks();
  const { filters } = useOnePage();
  const sections = useMemo(() => sectionsOf(applyFilters(books.data ?? [], filters)), [books.data, filters]);
  if (books.isPending) return <Skeleton height={240} />;
  if (books.isError) return <Notice>Could not load the library.</Notice>;
  if (sections.length === 0) return <p className={s.muted}>No entries match the Library filters.</p>;
  const filtered = Object.values(filters).some(Boolean);
  return (
    <>
      <p className={s.caption}>Completed per month, last 12 months{filtered ? " · Library filters applied" : ""}</p>
      <ul className={s.totals}>
        {sections.map(sec => (
          <li key={sec.person}><span>{sec.person}</span><strong>{sec.monthly.reduce((t, m) => t + m.count, 0)}</strong></li>
        ))}
      </ul>
      <div className={st.chartCard}>
        <Suspense fallback={<Skeleton height={240} />}>
          <PeopleChart series={sections.map(sec => ({ person: sec.person, monthly: sec.monthly }))} />
        </Suspense>
      </div>
    </>
  );
}

/* ── HQ ───────────────────────────────────────────────────────────────────── */

function HqStats() {
  const locations = useHqLocations();
  const templates = useHqTemplates();
  const entries = useHqEntries();
  const [loc, setLoc] = useParam("hqchart", "");
  if (locations.isPending || templates.isPending || entries.isPending) return <Skeleton height={240} />;
  if (locations.isError || templates.isError || entries.isError) return <Notice>Could not load HQ data.</Notice>;

  const water = (templates.data ?? []).filter(isWaterTemplate);
  const locs = (locations.data ?? []).filter(l => water.some(t => t.hqId === l.hqId));
  if (locs.length === 0) return <p className={s.muted}>No water meter templates yet.</p>;
  const active = locs.find(l => l.hqId === loc) ?? locs[0];

  return (
    <>
      {locs.length > 1 && (
        <ChipTabs label="Location" value={active.hqId} onChange={setLoc} options={locs.map(l => ({ value: l.hqId, label: l.name }))} />
      )}
      {water.filter(t => t.hqId === active.hqId).map(tpl => (
        <section key={tpl.templateId} className={st.chartCard} aria-label={`${active.name} · ${tpl.name}`}>
          <h3 className={s.subhead}>{active.name} · {tpl.name}</h3>
          <Suspense fallback={<Skeleton height={210} />}>
            <WaterChart template={tpl} entries={entries.data ?? []} />
          </Suspense>
        </section>
      ))}
    </>
  );
}
