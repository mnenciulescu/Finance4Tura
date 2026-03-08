import { useState, useEffect, useRef, useMemo } from "react";
import { opLog, getLogSeq } from "../api/client";
import { listIncomes, deleteIncome } from "../api/incomes";
import { listExpenses, deleteExpense } from "../api/expenses";

const METHOD_COLOR = {
  GET:    "#6c63ff",
  POST:   "#22c55e",
  PUT:    "#f59e0b",
  DELETE: "#ef4444",
};
const STATUS_COLOR = (s) => {
  if (s >= 200 && s < 300) return "#22c55e";
  if (s >= 400)            return "#ef4444";
  return "#f59e0b";
};
const PRIORITY_COLOR = { High: "#ef4444", Medium: "#f59e0b", Low: "#22c55e" };

// ── Generic filter-input component ───────────────────────────────────────────

function FilterInput({ value, onChange }) {
  return (
    <input
      style={s.filterInput}
      type="text"
      placeholder="filter…"
      value={value}
      onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
    />
  );
}

// ── Trash button with inline confirm ─────────────────────────────────────────

function DeleteCell({ onDelete }) {
  const [confirm, setConfirm] = useState(false);
  if (confirm) {
    return (
      <td style={{ ...s.td, whiteSpace: "nowrap" }}>
        <button style={s.btnConfirm} onClick={() => { setConfirm(false); onDelete(); }}>Yes</button>
        <button style={s.btnCancelSm} onClick={() => setConfirm(false)}>No</button>
      </td>
    );
  }
  return (
    <td style={s.td}>
      <button style={s.deleteBtn} title="Delete" onClick={() => setConfirm(true)}>
        <svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1,3 13,3"/>
          <path d="M4,3V2a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1V3"/>
          <rect x="2" y="3" width="10" height="10" rx="1"/>
          <line x1="5.5" y1="6" x2="5.5" y2="10"/>
          <line x1="8.5" y1="6" x2="8.5" y2="10"/>
        </svg>
      </button>
    </td>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const INC_COLS = ["ID", "Summary", "Date", "Amount", "Currency", "Repeatable", "Frequency", "Series End", "Series ID"];
const EXP_COLS = ["ID", "Summary", "Date", "Amount", "Currency", "Priority", "Status", "Mapped Income", "Repeatable"];

const emptyFilters = (cols) => Object.fromEntries(cols.map(c => [c, ""]));

function matches(value, filter) {
  return String(value ?? "").toLowerCase().includes(filter.toLowerCase());
}

export default function Backstage() {
  const [log, setLog]           = useState([...opLog]);
  const [incomes, setIncomes]   = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [dbError, setDbError]   = useState(null);
  const knownSeqRef             = useRef(getLogSeq());

  const [incFilters, setIncFilters] = useState(emptyFilters(INC_COLS));
  const [expFilters, setExpFilters] = useState(emptyFilters(EXP_COLS));

  // Poll log
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
    Promise.all([listIncomes(), listExpenses()])
      .then(([inc, exp]) => { setIncomes(inc); setExpenses(exp); })
      .catch(() => setDbError("Failed to load database."));
  };
  useEffect(loadData, []);

  // ── Filtered rows ──────────────────────────────────────────────────────────

  const filteredIncomes = useMemo(() => incomes.filter(r => (
    matches(r.incomeId,        incFilters["ID"])          &&
    matches(r.summary,         incFilters["Summary"])     &&
    matches(r.date,            incFilters["Date"])        &&
    matches(r.amount,          incFilters["Amount"])      &&
    matches(r.currency,        incFilters["Currency"])    &&
    matches(r.isRepeatable ? "Yes" : "No", incFilters["Repeatable"]) &&
    matches(r.repeatFrequency, incFilters["Frequency"])   &&
    matches(r.seriesEndDate,   incFilters["Series End"])  &&
    matches(r.seriesId,        incFilters["Series ID"])
  )), [incomes, incFilters]);

  const filteredExpenses = useMemo(() => expenses.filter(r => (
    matches(r.expenseId,           expFilters["ID"])             &&
    matches(r.summary,             expFilters["Summary"])        &&
    matches(r.date,                expFilters["Date"])           &&
    matches(r.amount,              expFilters["Amount"])         &&
    matches(r.currency,            expFilters["Currency"])       &&
    matches(r.priority,            expFilters["Priority"])       &&
    matches(r.status,              expFilters["Status"])         &&
    matches(r.mappedIncomeSummary, expFilters["Mapped Income"])  &&
    matches(r.isRepeatable ? "Yes" : "No", expFilters["Repeatable"])
  )), [expenses, expFilters]);

  // ── Delete handlers ────────────────────────────────────────────────────────

  const handleDeleteIncome = (id) => {
    setIncomes(prev => prev.filter(r => r.incomeId !== id));
    deleteIncome(id).catch(() => loadData());
  };

  const handleDeleteExpense = (id) => {
    setExpenses(prev => prev.filter(r => r.expenseId !== id));
    deleteExpense(id).catch(() => loadData());
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const setIncFilter = (col, val) => setIncFilters(prev => ({ ...prev, [col]: val }));
  const setExpFilter = (col, val) => setExpFilters(prev => ({ ...prev, [col]: val }));

  return (
    <div style={s.root}>

      {/* ── Left: Full Database ─────────────────────────────────────────── */}
      <div style={{ ...s.col, flex: "0 0 75%" }}>
        <div style={s.colHeader}>
          <span style={s.colTitle}>Database</span>
          <button style={s.refreshBtn} onClick={loadData}>Refresh</button>
        </div>
        <div style={s.dbScroll}>
          {dbError && <div style={s.errorBox}>{dbError}</div>}

          {/* Incomes table */}
          <div style={s.section}>
            <div style={s.sectionTitle}>
              Incomes <span style={s.count}>{filteredIncomes.length} / {incomes.length}</span>
            </div>
            <table style={s.table}>
              <thead>
                <tr>
                  {INC_COLS.map(h => (
                    <th key={h} style={s.th}>
                      <div style={s.thLabel}>{h}</div>
                      <FilterInput value={incFilters[h]} onChange={v => setIncFilter(h, v)} />
                    </th>
                  ))}
                  <th style={s.th} />
                </tr>
              </thead>
              <tbody>
                {filteredIncomes.length === 0 && (
                  <tr><td colSpan={INC_COLS.length + 1} style={s.emptyCell}>No records</td></tr>
                )}
                {filteredIncomes.map(r => (
                  <tr key={r.incomeId} style={s.tr}>
                    <td style={{ ...s.td, ...s.idCell }}>{r.incomeId.slice(0, 8)}…</td>
                    <td style={s.td}>{r.summary}</td>
                    <td style={s.td}>{r.date}</td>
                    <td style={{ ...s.td, fontVariantNumeric: "tabular-nums" }}>{r.amount}</td>
                    <td style={s.td}>{r.currency}</td>
                    <td style={s.td}>{r.isRepeatable ? "Yes" : "No"}</td>
                    <td style={s.td}>{r.repeatFrequency ?? "—"}</td>
                    <td style={s.td}>{r.seriesEndDate ?? "—"}</td>
                    <td style={{ ...s.td, ...s.idCell }}>{r.seriesId ? r.seriesId.slice(0, 8) + "…" : "—"}</td>
                    <DeleteCell onDelete={() => handleDeleteIncome(r.incomeId)} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Expenses table */}
          <div style={s.section}>
            <div style={s.sectionTitle}>
              Expenses <span style={s.count}>{filteredExpenses.length} / {expenses.length}</span>
            </div>
            <table style={s.table}>
              <thead>
                <tr>
                  {EXP_COLS.map(h => (
                    <th key={h} style={s.th}>
                      <div style={s.thLabel}>{h}</div>
                      <FilterInput value={expFilters[h]} onChange={v => setExpFilter(h, v)} />
                    </th>
                  ))}
                  <th style={s.th} />
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.length === 0 && (
                  <tr><td colSpan={EXP_COLS.length + 1} style={s.emptyCell}>No records</td></tr>
                )}
                {filteredExpenses.map(r => (
                  <tr key={r.expenseId} style={s.tr}>
                    <td style={{ ...s.td, ...s.idCell }}>{r.expenseId.slice(0, 8)}…</td>
                    <td style={s.td}>{r.summary}</td>
                    <td style={s.td}>{r.date}</td>
                    <td style={{ ...s.td, fontVariantNumeric: "tabular-nums" }}>{r.amount}</td>
                    <td style={s.td}>{r.currency}</td>
                    <td style={s.td}>
                      <span style={{ ...s.pill, color: PRIORITY_COLOR[r.priority] ?? "var(--text-muted)", borderColor: (PRIORITY_COLOR[r.priority] ?? "#6b7194") + "44" }}>
                        {r.priority}
                      </span>
                    </td>
                    <td style={s.td}>
                      <span style={{ ...s.pill, ...(r.status === "Completed" ? s.pillDone : s.pillPending) }}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ ...s.td, ...s.idCell }}>{r.mappedIncomeSummary ?? "—"}</td>
                    <td style={s.td}>{r.isRepeatable ? "Yes" : "No"}</td>
                    <DeleteCell onDelete={() => handleDeleteExpense(r.expenseId)} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Right: Operation Log ─────────────────────────────────────────── */}
      <div style={{ ...s.col, flex: "0 0 25%", borderRight: "none" }}>
        <div style={s.colHeader}>
          <span style={s.colTitle}>Operation Log</span>
          <span style={s.colMeta}>{log.length} / 50 entries</span>
        </div>
        <div style={s.logList}>
          {log.length === 0 && <p style={s.empty}>No operations yet this session.</p>}
          {log.map(entry => (
            <div key={entry.id} style={s.logRow}>
              <div style={s.logTop}>
                <span style={{ ...s.method, color: METHOD_COLOR[entry.method] ?? "#6b7194" }}>
                  {entry.method}
                </span>
                <span style={s.logUrl}>{entry.url}{entry.params ? "?" + new URLSearchParams(entry.params).toString() : ""}</span>
                <span style={{ ...s.statusBadge, color: STATUS_COLOR(entry.status) }}>
                  {entry.status}
                </span>
                <span style={s.logMs}>{entry.ms}ms</span>
              </div>
              <div style={s.logTs}>{entry.ts}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

const s = {
  root: { display: "flex", flex: 1, minHeight: 0 },
  col: {
    display: "flex", flexDirection: "column", flex: 1,
    minWidth: 0, minHeight: 0, borderRight: "1px solid var(--border)",
  },
  colHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 16px", borderBottom: "1px solid var(--border)",
    background: "var(--surface)", flexShrink: 0,
  },
  colTitle: {
    fontSize: "12px", fontWeight: 700, color: "var(--text)",
    textTransform: "uppercase", letterSpacing: "0.06em",
  },
  colMeta:    { fontSize: "11px", color: "var(--text-muted)" },
  refreshBtn: {
    background: "transparent", border: "1px solid var(--border)",
    borderRadius: "6px", color: "var(--text-muted)", fontSize: "11px",
    padding: "3px 10px", cursor: "pointer",
  },
  dbScroll: {
    flex: 1, overflowY: "auto", minHeight: 0,
    padding: "12px 16px", display: "flex", flexDirection: "column", gap: "20px",
  },
  section:      { display: "flex", flexDirection: "column", gap: "8px" },
  sectionTitle: {
    fontSize: "11px", fontWeight: 700, color: "var(--text-muted)",
    textTransform: "uppercase", letterSpacing: "0.06em",
    display: "flex", alignItems: "center", gap: "6px",
  },
  count: {
    background: "var(--surface-2)", border: "1px solid var(--border)",
    borderRadius: "10px", padding: "0 6px", fontSize: "10px",
    fontWeight: 500, color: "var(--text-muted)",
  },
  table:        { width: "100%", borderCollapse: "collapse", fontSize: "11px" },
  th: {
    textAlign: "left", padding: "4px 8px 3px",
    color: "var(--text-muted)", fontWeight: 600,
    borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
    background: "var(--surface)", position: "sticky", top: 0,
    verticalAlign: "top",
  },
  thLabel:      { marginBottom: "4px", whiteSpace: "nowrap" },
  filterInput: {
    width: "100%", background: "var(--surface-2)",
    border: "none", borderBottom: "1px solid var(--border)",
    color: "var(--text)", fontSize: "10px", padding: "2px 4px",
    outline: "none", borderRadius: "3px",
    minWidth: 0,
  },
  tr:           { borderBottom: "1px solid var(--border)" },
  td:           { padding: "5px 8px", color: "var(--text)", whiteSpace: "nowrap" },
  idCell:       { color: "var(--text-muted)", fontFamily: "monospace", fontSize: "10px" },
  emptyCell:    { padding: "12px 8px", color: "var(--text-muted)", fontStyle: "italic", textAlign: "center" },
  deleteBtn: {
    background: "none", border: "none", padding: "2px 4px",
    cursor: "pointer", display: "flex", alignItems: "center",
    color: "var(--danger)", opacity: 0.5,
  },
  btnConfirm: {
    background: "var(--danger)", color: "#fff", border: "none",
    borderRadius: "4px", fontSize: "10px", padding: "2px 7px",
    cursor: "pointer", fontWeight: 600, marginRight: "4px",
  },
  btnCancelSm: {
    background: "transparent", color: "var(--text-muted)",
    border: "1px solid var(--border)", borderRadius: "4px",
    fontSize: "10px", padding: "2px 6px", cursor: "pointer",
  },
  pill: {
    display: "inline-block", padding: "1px 6px", borderRadius: "10px",
    fontSize: "10px", fontWeight: 600, border: "1px solid transparent",
  },
  pillDone:    { background: "#052e16", color: "#86efac", borderColor: "#22c55e44" },
  pillPending: { background: "#1c1400", color: "#fcd34d", borderColor: "#f59e0b44" },
  logList:     { flex: 1, overflowY: "auto", minHeight: 0, padding: "6px 0" },
  logRow:      { padding: "4px 12px", borderBottom: "1px solid var(--border)" },
  logTop:      { display: "flex", alignItems: "center", gap: "6px" },
  method:      { fontSize: "9px", fontWeight: 700, width: "40px", flexShrink: 0 },
  logUrl: {
    fontSize: "10px", color: "var(--text)", flex: 1,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace",
  },
  statusBadge: { fontSize: "10px", fontWeight: 700, flexShrink: 0 },
  logMs:       { fontSize: "9px", color: "var(--text-muted)", flexShrink: 0, width: "38px", textAlign: "right" },
  logTs:       { fontSize: "9px", color: "var(--text-muted)", paddingLeft: "46px", lineHeight: 1.2 },
  empty: {
    padding: "24px 16px", color: "var(--text-muted)", fontSize: "12px",
    fontStyle: "italic", textAlign: "center",
  },
  errorBox: {
    background: "#3b1212", border: "1px solid var(--danger)",
    borderRadius: "8px", color: "#fca5a5", padding: "10px 14px", fontSize: "12px",
  },
};
