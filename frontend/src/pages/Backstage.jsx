import { useState, useEffect, useRef } from "react";
import { opLog, getLogSeq } from "../api/client";
import { listIncomes } from "../api/incomes";
import { listExpenses } from "../api/expenses";

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

export default function Backstage() {
  const [log, setLog]           = useState([...opLog]);
  const [incomes, setIncomes]   = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [dbError, setDbError]   = useState(null);
  const knownSeqRef             = useRef(getLogSeq());

  // Poll log every second — only re-render when new entries have arrived
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

  // Load full DB
  const loadData = () => {
    setDbError(null);
    Promise.all([listIncomes(), listExpenses()])
      .then(([inc, exp]) => { setIncomes(inc); setExpenses(exp); })
      .catch(() => setDbError("Failed to load database."));
  };

  useEffect(loadData, []);

  return (
    <div style={s.root}>

      {/* ── Left: Full Database ─────────────────────────────────────────── */}
      <div style={{ ...s.col, flex: "0 0 65%" }}>
        <div style={s.colHeader}>
          <span style={s.colTitle}>Database</span>
          <button style={s.refreshBtn} onClick={loadData}>Refresh</button>
        </div>
        <div style={s.dbScroll}>
          {dbError && <div style={s.errorBox}>{dbError}</div>}

          {/* Incomes table */}
          <div style={s.section}>
            <div style={s.sectionTitle}>Incomes <span style={s.count}>{incomes.length}</span></div>
            <table style={s.table}>
              <thead>
                <tr>
                  {["ID", "Summary", "Date", "Amount", "Currency", "Repeatable", "Frequency", "Series End", "Series ID"].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {incomes.length === 0 && (
                  <tr><td colSpan={9} style={s.emptyCell}>No records</td></tr>
                )}
                {incomes.map(r => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Expenses table */}
          <div style={s.section}>
            <div style={s.sectionTitle}>Expenses <span style={s.count}>{expenses.length}</span></div>
            <table style={s.table}>
              <thead>
                <tr>
                  {["ID", "Summary", "Date", "Amount", "Currency", "Priority", "Status", "Mapped Income", "Repeatable"].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 && (
                  <tr><td colSpan={9} style={s.emptyCell}>No records</td></tr>
                )}
                {expenses.map(r => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Right: Operation Log ─────────────────────────────────────────── */}
      <div style={{ ...s.col, flex: "0 0 35%", borderRight: "none" }}>
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

const PRIORITY_COLOR = { High: "#ef4444", Medium: "#f59e0b", Low: "#22c55e" };

const s = {
  root: {
    display:   "flex",
    flex:      1,
    minHeight: 0,
    gap:       0,
  },
  col: {
    display:       "flex",
    flexDirection: "column",
    flex:          1,
    minWidth:      0,
    minHeight:     0,
    borderRight:   "1px solid var(--border)",
  },
  colHeader: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    padding:        "10px 16px",
    borderBottom:   "1px solid var(--border)",
    background:     "var(--surface)",
    flexShrink:     0,
  },
  colTitle: {
    fontSize:   "12px",
    fontWeight: 700,
    color:      "var(--text)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  colMeta: {
    fontSize: "11px",
    color:    "var(--text-muted)",
  },
  refreshBtn: {
    background:   "transparent",
    border:       "1px solid var(--border)",
    borderRadius: "6px",
    color:        "var(--text-muted)",
    fontSize:     "11px",
    padding:      "3px 10px",
    cursor:       "pointer",
  },
  logList: {
    flex:      1,
    overflowY: "auto",
    minHeight: 0,
    padding:   "6px 0",
  },
  logRow: {
    padding:      "4px 12px",
    borderBottom: "1px solid var(--border)",
  },
  logTop: {
    display:    "flex",
    alignItems: "center",
    gap:        "6px",
  },
  method: {
    fontSize:   "9px",
    fontWeight: 700,
    width:      "40px",
    flexShrink: 0,
  },
  logUrl: {
    fontSize:     "10px",
    color:        "var(--text)",
    flex:         1,
    overflow:     "hidden",
    textOverflow: "ellipsis",
    whiteSpace:   "nowrap",
    fontFamily:   "monospace",
  },
  statusBadge: {
    fontSize:   "10px",
    fontWeight: 700,
    flexShrink: 0,
  },
  logMs: {
    fontSize:   "9px",
    color:      "var(--text-muted)",
    flexShrink: 0,
    width:      "38px",
    textAlign:  "right",
  },
  logTs: {
    fontSize:    "9px",
    color:       "var(--text-muted)",
    paddingLeft: "46px",
    lineHeight:  1.2,
  },
  dbScroll: {
    flex:      1,
    overflowY: "auto",
    minHeight: 0,
    padding:   "12px 16px",
    display:   "flex",
    flexDirection: "column",
    gap:       "20px",
  },
  section: {
    display:       "flex",
    flexDirection: "column",
    gap:           "8px",
  },
  sectionTitle: {
    fontSize:   "11px",
    fontWeight: 700,
    color:      "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    display:    "flex",
    alignItems: "center",
    gap:        "6px",
  },
  count: {
    background:   "var(--surface-2)",
    border:       "1px solid var(--border)",
    borderRadius: "10px",
    padding:      "0 6px",
    fontSize:     "10px",
    fontWeight:   500,
    color:        "var(--text-muted)",
  },
  table: {
    width:           "100%",
    borderCollapse:  "collapse",
    fontSize:        "11px",
  },
  th: {
    textAlign:    "left",
    padding:      "5px 8px",
    color:        "var(--text-muted)",
    fontWeight:   600,
    borderBottom: "1px solid var(--border)",
    whiteSpace:   "nowrap",
    background:   "var(--surface)",
    position:     "sticky",
    top:          0,
  },
  tr: { borderBottom: "1px solid var(--border)" },
  td: {
    padding: "5px 8px",
    color:   "var(--text)",
    whiteSpace: "nowrap",
  },
  idCell: {
    color:      "var(--text-muted)",
    fontFamily: "monospace",
    fontSize:   "10px",
  },
  emptyCell: {
    padding:   "12px 8px",
    color:     "var(--text-muted)",
    fontStyle: "italic",
    textAlign: "center",
  },
  pill: {
    display:      "inline-block",
    padding:      "1px 6px",
    borderRadius: "10px",
    fontSize:     "10px",
    fontWeight:   600,
    border:       "1px solid transparent",
  },
  pillDone:    { background: "#052e16", color: "#86efac", borderColor: "#22c55e44" },
  pillPending: { background: "#1c1400", color: "#fcd34d", borderColor: "#f59e0b44" },
  empty: {
    padding:   "24px 16px",
    color:     "var(--text-muted)",
    fontSize:  "12px",
    fontStyle: "italic",
    textAlign: "center",
  },
  errorBox: {
    background:   "#3b1212",
    border:       "1px solid var(--danger)",
    borderRadius: "8px",
    color:        "#fca5a5",
    padding:      "10px 14px",
    fontSize:     "12px",
  },
};
