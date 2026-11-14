import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Screen } from "../../../app/Screen";
import { useAccountBack } from "../../../app/useAccountBack";
import { Badge, Button, IconButton, ListSection, Notice, ScreenSkeleton, SearchField, SwipeActions, useToast } from "../../../ui";
import { opLog, getLogSeq } from "../../../api/client";
import { deleteIncome } from "../../../api/incomes";
import { deleteExpense } from "../../../api/expenses";
import { deleteOperation, deleteSnapshot } from "../../../api/investments";
import { deleteSplitPayment } from "../../../api/splitPayments";
import { keys, useExpenses, useIncomes, useOperations, useSnapshots, useSplitPayments } from "../../../data/queries";
import { HTTP_METHOD_COLOR } from "../../../theme/domainColors";
import s from "./Backstage.module.css";

const PAGE = 10;

type Row = Record<string, any>;
interface TableDef {
  id: string;
  label: string;
  key: readonly unknown[];
  idOf: (r: Row) => string;
  title: (r: Row) => string;
  amount: (r: Row) => string;
  fields: (r: Row) => [string, unknown][];
  remove: (id: string) => Promise<unknown>;
}

// One code path for five tables: each describes how to identify, label and
// summarise its records.
const TABLES: TableDef[] = [
  {
    id: "incomes", label: "Incomes", key: keys.incomes, idOf: r => r.incomeId, title: r => r.summary,
    amount: r => `${r.amount} ${r.currency ?? ""}`.trim(),
    fields: r => [["Date", r.date], ["Repeatable", r.isRepeatable ? "Yes" : "No"], ["Frequency", r.repeatFrequency], ["Series end", r.seriesEndDate], ["Series ID", r.seriesId], ["ID", r.incomeId]],
    remove: id => deleteIncome(id),
  },
  {
    id: "expenses", label: "Expenses", key: keys.expenses, idOf: r => r.expenseId, title: r => r.summary,
    amount: r => `${r.amount} ${r.currency ?? ""}`.trim(),
    fields: r => [["Date", r.date], ["Priority", r.priority], ["Status", r.status], ["Mapped income", r.mappedIncomeSummary], ["Repeatable", r.isRepeatable ? "Yes" : "No"], ["ID", r.expenseId]],
    remove: id => deleteExpense(id),
  },
  {
    id: "operations", label: "Operations", key: keys.operations, idOf: r => r.operationId, title: r => `${r.type} · ${r.platform}`,
    amount: r => `${r.amount} ${r.currency ?? ""}`.trim(),
    fields: r => [["Date", r.date], ["Type", r.type], ["Platform", r.platform], ["Notes", r.notes], ["ID", r.operationId]],
    remove: id => deleteOperation(id),
  },
  {
    id: "snapshots", label: "Snapshots", key: keys.snapshots, idOf: r => r.snapshotId, title: r => r.platform,
    amount: r => `${r.amount} ${r.currency ?? ""}`.trim(),
    fields: r => [["Date", r.date], ["Platform", r.platform], ["ID", r.snapshotId]],
    remove: id => deleteSnapshot(id),
  },
  {
    id: "splits", label: "Splits", key: keys.splits, idOf: r => r.splitPaymentId, title: r => r.title,
    amount: r => `${r.totalAmount} ${r.currency ?? ""}`.trim(),
    fields: r => [["Date", r.createdDate], ["Track by", r.occurrenceType], ["Occurrences", r.occurrenceCount], ["ID", r.splitPaymentId]],
    remove: id => deleteSplitPayment(id),
  },
];

/** Backstage (proposal §8.11): raw tables and the live API log. */
export default function Backstage() {
  const back = useAccountBack();
  const qc = useQueryClient();
  const toast = useToast();
  const queries = {
    incomes: useIncomes(), expenses: useExpenses(), operations: useOperations(), snapshots: useSnapshots(), splits: useSplitPayments(),
  } as Record<string, { data?: Row[]; isPending: boolean; isError: boolean }>;
  const [active, setActive] = useState("incomes");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [log, setLog] = useState(() => [...opLog]);
  const [openLog, setOpenLog] = useState<Record<number, boolean>>({});
  const seq = useRef(getLogSeq());

  // Live API log, polled once a second.
  useEffect(() => {
    const id = window.setInterval(() => {
      const cur = getLogSeq();
      if (cur !== seq.current) { seq.current = cur; setLog([...opLog]); }
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const table = TABLES.find(t => t.id === active)!;
  const q = queries[active];
  const data = q.data;
  const rows = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(r => [table.title(r), table.amount(r), ...table.fields(r).map(([, v]) => v)].join(" ").toLowerCase().includes(needle));
  }, [rows, search, table]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const visible = filtered.slice(page * PAGE, page * PAGE + PAGE);

  const pick = (id: string) => { setActive(id); setSearch(""); setPage(0); setExpanded({}); };

  const remove = async (r: Row) => {
    const id = table.idOf(r);
    qc.setQueriesData<Row[]>({ queryKey: table.key }, old => old?.filter(x => table.idOf(x) !== id));
    try {
      await table.remove(id);
      toast.show({ message: "Row deleted", icon: "trash" });
    } catch {
      toast.show({ message: "Delete failed", tone: "negative" });
      qc.invalidateQueries({ queryKey: table.key });
    }
  };

  return (
    <Screen title="Backstage" large={false} back={back}>
      <div className={s.chips} role="tablist" aria-label="Tables">
        {TABLES.map(t => (
          <button key={t.id} type="button" role="tab" aria-selected={t.id === active}
            className={[s.chip, t.id === active ? s.chipOn : ""].join(" ")} onClick={() => pick(t.id)}>
            {t.label} <span className={s.chipCount}>{queries[t.id].data?.length ?? "…"}</span>
          </button>
        ))}
      </div>
      <div className={s.search}>
        <SearchField label={`Search ${table.label.toLowerCase()}`} placeholder={`Search ${table.label.toLowerCase()}`} value={search} onChange={v => { setSearch(v); setPage(0); }} />
      </div>

      {q.isError && <Notice>Failed to load {table.label.toLowerCase()}.</Notice>}
      {q.isPending ? <ScreenSkeleton blocks={1} /> : (
        <ListSection header={`${filtered.length} row${filtered.length === 1 ? "" : "s"}`} footer={filtered.length === 0 ? "No rows." : undefined}>
          <ul className={s.list}>
            {visible.map(r => {
              const id = table.idOf(r);
              const open = !!expanded[id];
              return (
                <li key={id} className={s.item}>
                  <SwipeActions actions={[{ label: "Delete", icon: "trash", destructive: true, onAction: () => remove(r) }]}>
                    <button type="button" className={s.rowHead} onClick={() => setExpanded(m => ({ ...m, [id]: !m[id] }))} aria-expanded={open}>
                      <span className={s.rowText}>
                        <span className={s.rowTitle}>{table.title(r) || "—"}</span>
                        <span className={s.mono}>{id}</span>
                      </span>
                      <span className={s.amount}>{table.amount(r)}</span>
                    </button>
                  </SwipeActions>
                  {open && (
                    <div className={s.fields}>
                      <dl>
                        {table.fields(r).map(([k, v]) => (
                          <div key={k} className={s.field}><dt>{k}</dt><dd className={s.mono}>{v == null || v === "" ? "—" : String(v)}</dd></div>
                        ))}
                      </dl>
                      <DeleteTwoStep onConfirm={() => remove(r)} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {pages > 1 && (
            <div className={s.pager}>
              <IconButton icon="chevronLeft" label="Previous page" disabled={page === 0} onClick={() => setPage(p => p - 1)} />
              <span className={s.pageLabel}>{page + 1} / {pages}</span>
              <IconButton icon="chevronRight" label="Next page" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)} />
            </div>
          )}
        </ListSection>
      )}

      <ListSection header={`API log · last ${log.length}`}>
        <ul className={s.list}>
          {log.length === 0 && <li className={s.empty}>No calls yet.</li>}
          {log.map(entry => {
            const ok = entry.status >= 200 && entry.status < 300;
            const open = !!openLog[entry.id];
            return (
              <li key={entry.id} className={s.item}>
                <button type="button" className={s.logRow} onClick={() => setOpenLog(m => ({ ...m, [entry.id]: !m[entry.id] }))} aria-expanded={open}>
                  <Badge color={HTTP_METHOD_COLOR[entry.method] ?? "var(--label-secondary)"}>{entry.method}</Badge>
                  <span className={[s.mono, s.url].join(" ")}>{entry.url}</span>
                  <span className={[s.status, ok ? s.ok : entry.status >= 400 || entry.status === 0 ? s.bad : s.warn].join(" ")}>{entry.status || "ERR"}</span>
                  <span className={s.ms}>{entry.ms} ms</span>
                </button>
                {open && (
                  <div className={s.fields}>
                    <dl>
                      <div className={s.field}><dt>Time</dt><dd className={s.mono}>{entry.ts}</dd></div>
                      <div className={s.field}><dt>Params</dt><dd className={s.mono}>{entry.params ? JSON.stringify(entry.params) : "—"}</dd></div>
                    </dl>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </ListSection>
    </Screen>
  );
}

/** Two-step inline delete: Delete → Tap to Confirm, reverting after 4 s. */
function DeleteTwoStep({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <Button
      variant={armed ? "destructive" : "destructiveTinted"}
      size="small"
      icon="trash"
      onClick={() => {
        if (armed) { window.clearTimeout(timer.current); setArmed(false); onConfirm(); return; }
        setArmed(true);
        timer.current = window.setTimeout(() => setArmed(false), 4000);
      }}
    >
      {armed ? "Tap to Confirm" : "Delete"}
    </Button>
  );
}
