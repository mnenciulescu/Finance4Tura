import { useState, useEffect, useRef, useMemo } from "react";
import { opLog, getLogSeq } from "../api/client";
import { listIncomes, deleteIncome } from "../api/incomes";
import { listExpenses, deleteExpense } from "../api/expenses";
import { listOperations, deleteOperation, listSnapshots, deleteSnapshot } from "../api/investments";
import { listSplitPayments, deleteSplitPayment } from "../api/splitPayments";
import { useAuth } from "../context/AuthContext";
import { HTTP_METHOD_COLORS as METHOD_COLOR } from "../utils/colors";

const COL_WIDTH = "var(--app-max-w)";
const PAGE = 10;

const STATUS_COLOR = (s) => {
  if (s >= 200 && s < 300) return "#22c55e";
  if (s >= 400)            return "#ef4444";
  return "#f59e0b";
};

// Each table describes how to identify, label and summarise one of its records.
// The whole page is driven off this, so there is one code path instead of five.
const TABLES = [
  {
    id: "incomes", label: "Incomes",
    idOf:    r => r.incomeId,
    title:   r => r.summary,
    amount:  r => `${r.amount} ${r.currency ?? ""}`.trim(),
    fields:  r => [
      ["Date", r.date],
      ["Repeatable", r.isRepeatable ? "Yes" : "No"],
      ["Frequency", r.repeatFrequency],
      ["Series end", r.seriesEndDate],
      ["Series ID", r.seriesId],
      ["ID", r.incomeId],
    ],
  },
  {
    id: "expenses", label: "Expenses",
    idOf:    r => r.expenseId,
    title:   r => r.summary,
    amount:  r => `${r.amount} ${r.currency ?? ""}`.trim(),
    fields:  r => [
      ["Date", r.date],
      ["Priority", r.priority],
      ["Status", r.status],
      ["Mapped income", r.mappedIncomeSummary],
      ["Repeatable", r.isRepeatable ? "Yes" : "No"],
      ["ID", r.expenseId],
    ],
  },
  {
    id: "operations", label: "Operations",
    idOf:    r => r.operationId,
    title:   r => `${r.type} · ${r.platform}`,
    amount:  r => `${r.amount} ${r.currency ?? ""}`.trim(),
    fields:  r => [
      ["Date", r.date],
      ["Type", r.type],
      ["Platform", r.platform],
      ["Notes", r.notes],
      ["ID", r.operationId],
    ],
  },
  {
    id: "snapshots", label: "Snapshots",
    idOf:    r => r.snapshotId,
    title:   r => r.platform,
    amount:  r => `${r.amount} ${r.currency ?? ""}`.trim(),
    fields:  r => [
      ["Date", r.date],
      ["Platform", r.platform],
      ["ID", r.snapshotId],
    ],
  },
  {
    id: "splits", label: "Splits",
    idOf:    r => r.splitPaymentId,
    title:   r => r.description,
    amount:  r => `${r.totalAmount} ${r.currency ?? ""}`.trim(),
    fields:  r => [
      ["Date", r.date],
      ["Participants", (r.participants ?? []).map(p => p.name).join(", ")],
      ["ID", r.splitPaymentId],
    ],
  },
];

function DeleteButton({ onConfirm }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  function click(e) {
    e.stopPropagation();
    if (armed) {
      clearTimeout(timer.current);
      setArmed(false);
      onConfirm();
      return;
    }
    setArmed(true);
    timer.current = setTimeout(() => setArmed(false), 4000);
  }

  return (
    <button style={{ ...s.btnGhost, ...(armed ? s.btnArmed : { color: "var(--danger)" }) }} onClick={click}>
      {armed ? "Tap to confirm" : "Delete"}
    </button>
  );
}

export default function Backstage() {
  const { loading: authLoading } = useAuth();
  const [log, setLog]           = useState([...opLog]);
  const [dbError, setDbError]   = useState(null);
  const knownSeqRef             = useRef(getLogSeq());

  const [rows, setRows] = useState({ incomes: [], expenses: [], operations: [], snapshots: [], splits: [] });
  const [active, setActive]     = useState("incomes");
  const [search, setSearch]     = useState("");
  const [showAll, setShowAll]   = useState(false);
  const [expanded, setExpanded] = useState({});
  const [logOpen, setLogOpen]   = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      const current = getLogSeq();
      if (current !== knownSeqRef.current) {
        knownSeqRef.current = current;
        setLog([...opLog]);
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const loadData = () => {
    setDbError(null);
    Promise.all([listIncomes(), listExpenses(), listOperations(), listSnapshots(), listSplitPayments()])
      .then(([incomes, expenses, operations, snapshots, splits]) =>
        setRows({ incomes, expenses, operations, snapshots, splits }))
      .catch(() => setDbError("Failed to load database."));
  };
  useEffect(() => { if (!authLoading) loadData(); }, [authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const deleters = {
    incomes:    id => { setRows(r => ({ ...r, incomes:    r.incomes.filter(x => x.incomeId !== id) }));            deleteIncome(id).catch(loadData); },
    expenses:   id => { setRows(r => ({ ...r, expenses:   r.expenses.filter(x => x.expenseId !== id) }));          deleteExpense(id).catch(loadData); },
    operations: id => { setRows(r => ({ ...r, operations: r.operations.filter(x => x.operationId !== id) }));      deleteOperation(id).catch(loadData); },
    snapshots:  id => { setRows(r => ({ ...r, snapshots:  r.snapshots.filter(x => x.snapshotId !== id) }));        deleteSnapshot(id).catch(loadData); },
    splits:     id => { setRows(r => ({ ...r, splits:     r.splits.filter(x => x.splitPaymentId !== id) }));       deleteSplitPayment(id).catch(loadData); },
  };

  const table   = TABLES.find(t => t.id === active);
  const allRows = rows[active] ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter(r => {
      const hay = [table.title(r), table.amount(r), ...table.fields(r).map(([, v]) => v)]
        .join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [allRows, search, table]);

  const visible = showAll ? filtered : filtered.slice(0, PAGE);
  const toggleRow = id => setExpanded(m => ({ ...m, [id]: !m[id] }));

  function pick(id) {
    setActive(id);
    setSearch("");
    setShowAll(false);
    setExpanded({});
  }

  return (
    <div style={s.page}>
      <div style={s.column}>

        <div style={s.header}>
          <div style={{ minWidth: 0 }}>
            <h2 style={s.title}>Backstage</h2>
            <p style={s.subtitle}>{filtered.length} of {allRows.length} record{allRows.length === 1 ? "" : "s"}</p>
          </div>
          <button style={s.btnGhost} onClick={loadData}>Refresh</button>
        </div>

        <div style={s.picker}>
          {TABLES.map(t => (
            <button
              key={t.id}
              style={{ ...s.pickerBtn, ...(t.id === active ? s.pickerBtnOn : {}) }}
              onClick={() => pick(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={s.searchWrap}>
          <input
            style={s.input}
            placeholder={`Search ${table.label.toLowerCase()}…`}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div style={s.scroll}>
          {dbError && <div style={s.errorBox}>{dbError}</div>}

          {visible.length === 0 ? (
            <div style={s.empty}>No records.</div>
          ) : (
            <div style={s.list}>
              {visible.map(r => {
                const id = table.idOf(r);
                const open = !!expanded[id];
                return (
                  <div key={id} style={s.card}>
                    <button style={s.cardHead} onClick={() => toggleRow(id)}>
                      <span style={s.cardTitle}>{table.title(r) || "—"}</span>
                      <span style={s.cardAmount}>{table.amount(r)}</span>
                      <span style={{ ...s.chevron, transform: open ? "rotate(180deg)" : "none" }}>⌄</span>
                    </button>

                    {open && (
                      <div style={s.cardBody}>
                        {table.fields(r).map(([k, v]) => (
                          <div key={k} style={s.detailRow}>
                            <span style={s.detailKey}>{k}</span>
                            <span style={s.detailVal}>{v || "—"}</span>
                          </div>
                        ))}
                        <div style={s.cardActions}>
                          <DeleteButton onConfirm={() => deleters[active](id)} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {filtered.length > PAGE && (
                <button style={s.expandBtn} onClick={() => setShowAll(v => !v)}>
                  {showAll ? "Show less" : `Show ${filtered.length - PAGE} more…`}
                </button>
              )}
            </div>
          )}

          {/* Operation log — already a vertical stack, kept as-is */}
          <div style={s.logCard}>
            <button style={s.logHead} onClick={() => setLogOpen(v => !v)}>
              <span style={s.logTitle}>Operation Log</span>
              <span style={s.colMeta}>{log.length} / 50</span>
              <span style={{ ...s.chevron, transform: logOpen ? "rotate(180deg)" : "none" }}>⌄</span>
            </button>
            {logOpen && (
              <div style={s.logList}>
                {log.length === 0 && <p style={s.empty}>No operations yet this session.</p>}
                {log.map(entry => (
                  <div key={entry.id} style={s.logRow}>
                    <div style={s.logTop}>
                      <span style={{ ...s.method, color: METHOD_COLOR[entry.method] ?? "#6b7194" }}>
                        {entry.method}
                      </span>
                      <span style={{ ...s.statusBadge, color: STATUS_COLOR(entry.status) }}>{entry.status}</span>
                      <span style={s.logMs}>{entry.ms}ms</span>
                    </div>
                    <div style={s.logUrl}>
                      {entry.url}{entry.params ? "?" + new URLSearchParams(entry.params).toString() : ""}
                    </div>
                    <div style={s.logTs}>{entry.ts}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: {
    display:        "flex",
    justifyContent: "center",
    alignItems:     "flex-start",
    flex:           1,
    minHeight:      0,
  },
  column: {
    width:         "100%",
    maxWidth:      COL_WIDTH,
    display:       "flex",
    flexDirection: "column",
    flex:          1,
    minHeight:     0,
  },
  header: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    gap:            "12px",
    flexShrink:     0,
    padding:        "12px 14px",
    borderBottom:   "1px solid var(--border)",
  },
  title:    { margin: 0, fontSize: "17px", fontWeight: 700, color: "var(--text)" },
  subtitle: { margin: "2px 0 0", fontSize: "11px", color: "var(--text-muted)" },

  picker: {
    display:       "flex",
    gap:           "6px",
    padding:       "10px 14px 0",
    overflowX:     "auto",
    flexShrink:    0,
    scrollbarWidth: "none",
  },
  pickerBtn: {
    background:   "var(--surface-2)",
    border:       "1px solid var(--border)",
    borderRadius: "16px",
    color:        "var(--text-muted)",
    fontSize:     "12px",
    fontWeight:   600,
    padding:      "7px 13px",
    cursor:       "pointer",
    whiteSpace:   "nowrap",
    flexShrink:   0,
    fontFamily:   "inherit",
  },
  pickerBtnOn: {
    background:  "var(--accent)",
    borderColor: "var(--accent)",
    color:       "var(--on-accent)",
  },
  searchWrap: { padding: "10px 14px 0", flexShrink: 0 },
  input: {
    background:   "var(--surface-2)",
    border:       "1px solid var(--border)",
    borderRadius: "9px",
    color:        "var(--text)",
    fontSize:     "16px",
    padding:      "9px 11px",
    outline:      "none",
    width:        "100%",
    boxSizing:    "border-box",
    fontFamily:   "inherit",
  },

  scroll: {
    flex:      1,
    minHeight: 0,
    overflowY: "auto",
    padding:   "10px 14px 18px",
  },
  list: { display: "flex", flexDirection: "column", gap: "8px" },
  card: {
    background:   "var(--surface)",
    border:       "1px solid var(--border)",
    borderRadius: "11px",
    overflow:     "hidden",
  },
  cardHead: {
    display:    "flex",
    alignItems: "center",
    gap:        "10px",
    width:      "100%",
    padding:    "10px 12px",
    background: "transparent",
    border:     "none",
    textAlign:  "left",
    cursor:     "pointer",
    fontFamily: "inherit",
  },
  cardTitle: {
    fontSize:     "13px",
    fontWeight:   600,
    color:        "var(--text)",
    flex:         1,
    minWidth:     0,
    overflow:     "hidden",
    textOverflow: "ellipsis",
    whiteSpace:   "nowrap",
  },
  cardAmount: {
    fontSize:           "12px",
    color:              "var(--text-muted)",
    fontVariantNumeric: "tabular-nums",
    flexShrink:         0,
  },
  chevron: {
    color:      "var(--text-muted)",
    fontSize:   "13px",
    lineHeight: 1,
    flexShrink: 0,
    transition: "transform 0.15s",
  },
  cardBody: {
    borderTop:     "1px solid var(--border)",
    padding:       "10px 12px",
    display:       "flex",
    flexDirection: "column",
    gap:           "6px",
  },
  detailRow: {
    display:        "flex",
    justifyContent: "space-between",
    gap:            "12px",
    fontSize:       "11px",
  },
  detailKey: { color: "var(--text-muted)", flexShrink: 0 },
  detailVal: {
    color:      "var(--text)",
    fontWeight: 500,
    wordBreak:  "break-all",
    textAlign:  "right",
  },
  cardActions: {
    display:        "flex",
    justifyContent: "flex-end",
    paddingTop:     "4px",
  },
  expandBtn: {
    background:   "transparent",
    border:       "1px dashed var(--border)",
    borderRadius: "9px",
    color:        "var(--text-muted)",
    fontSize:     "12px",
    padding:      "9px",
    cursor:       "pointer",
    fontFamily:   "inherit",
  },
  btnGhost: {
    background:   "transparent",
    border:       "1px solid var(--border)",
    borderRadius: "8px",
    color:        "var(--text-muted)",
    fontSize:     "12px",
    fontWeight:   600,
    padding:      "7px 13px",
    cursor:       "pointer",
    flexShrink:   0,
    fontFamily:   "inherit",
  },
  btnArmed: {
    background:  "var(--danger)",
    borderColor: "var(--danger)",
    color:       "#fff",
  },
  empty: {
    padding:   "30px 0",
    textAlign: "center",
    color:     "var(--text-muted)",
    fontSize:  "12px",
  },
  errorBox: {
    background:   "var(--error-bg)",
    border:       "1px solid var(--danger)",
    borderRadius: "8px",
    color:        "var(--error-text)",
    padding:      "9px 12px",
    fontSize:     "12px",
    marginBottom: "10px",
  },

  logCard: {
    marginTop:    "14px",
    background:   "var(--surface)",
    border:       "1px solid var(--border)",
    borderRadius: "11px",
    overflow:     "hidden",
  },
  logHead: {
    display:    "flex",
    alignItems: "center",
    gap:        "10px",
    width:      "100%",
    padding:    "11px 12px",
    background: "transparent",
    border:     "none",
    cursor:     "pointer",
    fontFamily: "inherit",
  },
  logTitle: {
    fontSize:      "11px",
    fontWeight:    700,
    color:         "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    flex:          1,
    textAlign:     "left",
  },
  colMeta: { fontSize: "11px", color: "var(--text-muted)" },
  logList: {
    borderTop: "1px solid var(--border)",
    maxHeight: "300px",
    overflowY: "auto",
  },
  logRow: {
    padding:      "8px 12px",
    borderBottom: "1px solid var(--border)",
  },
  logTop: {
    display:    "flex",
    alignItems: "center",
    gap:        "8px",
  },
  method:      { fontSize: "10px", fontWeight: 700, width: "44px", flexShrink: 0 },
  statusBadge: { fontSize: "10px", fontWeight: 700 },
  logMs:       { fontSize: "10px", color: "var(--text-muted)", marginLeft: "auto" },
  logUrl: {
    fontSize:  "11px",
    color:     "var(--text)",
    wordBreak: "break-all",
    marginTop: "2px",
  },
  logTs: { fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" },
};
