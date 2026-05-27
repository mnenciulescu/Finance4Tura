import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import {
  LineChart, Line, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { listIncomes } from "../api/incomes";
import { listExpenses, updateExpense } from "../api/expenses";
import { listSplitPayments, updateSplitPayment } from "../api/splitPayments";
import { listBooks } from "../api/booksAndDev";
import { listTemplates, listResults, getKids } from "../api/practiceTests";
import { listSnapshots } from "../api/investments";
import apiClient from "../api/client";
import { PRIORITY_COLORS as PRIORITY_COLOR, BAR_COLORS as BAR_COLOR } from "../utils/colors";

// ── Investment constants (shared with Investments page) ────────────────────────
const PLATFORMS = ["eToro", "Binance", "Fidelity", "Tradeville", "ING Funds RON", "ING Funds EUR"];
const PLATFORM_COLOR = {
  "eToro":         "#22c55e",
  "Binance":       "#f59e0b",
  "Fidelity":      "#3b82f6",
  "Tradeville":    "#a855f7",
  "ING Funds RON": "#ef4444",
  "ING Funds EUR": "#f97316",
};
function toEUR(amount, currency, rates) {
  if (!rates || currency === "EUR") return amount;
  const rate = rates[currency];
  return rate ? amount / rate : amount;
}
const FX_CACHE_KEY = "fxRates_EUR_USD_RON";
const FX_TTL_MS    = 30 * 60 * 1000; // 30 min client-side cache; server caches 24 h in DynamoDB

const TEMPLATE_COLORS = ["#16a34a", "#60a5fa", "#f9a8d4", "#fcd34d", "#a78bfa", "#34d399", "#fb923c"];

const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const monthParts = (dateStr) => {
  const [y, m, d] = dateStr.split("-");
  const month = new Date(+y, +m - 1, 1).toLocaleString("en-US", { month: "short" }).toUpperCase();
  return { month, day: String(+d), year: y };
};
const getDow = (dateStr) =>
  DOW[new Date(Date.UTC(...dateStr.split("-").map((v, i) => i === 1 ? +v - 1 : +v))).getUTCDay()];
const fmtDec = (n) => n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n) => Math.round(n).toLocaleString("ro-RO");

const TYPE_COLORS = {
  Audiobook: { bg: "rgba(168,85,247,0.18)", text: "#a855f7" },
  Training:  { bg: "rgba(20,184,166,0.18)", text: "#0d9488" },
  Book:      { bg: "rgba(120,120,140,0.15)", text: "var(--text-muted)" },
  Other:     { bg: "rgba(120,120,140,0.15)", text: "var(--text-muted)" },
};

// ── Small reusable pieces ──────────────────────────────────────────────────────

function SectionHeader({ children }) {
  return (
    <div style={{
      fontSize: "11px", fontWeight: 700, color: "var(--text-muted)",
      textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px",
    }}>
      {children}
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "12px", padding: "16px 20px", ...style,
    }}>
      {children}
    </div>
  );
}

function EmptyState({ children }) {
  return (
    <div style={{ color: "var(--text-muted)", fontSize: "13px", padding: "12px 0" }}>
      {children}
    </div>
  );
}

function ReadOnlyStars({ value }) {
  return (
    <span style={{ display: "inline-flex", gap: "2px" }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} style={{ fontSize: "13px", color: n <= (value ?? 0) ? "#f59e0b" : "var(--border)", lineHeight: 1 }}>
          ★
        </span>
      ))}
    </span>
  );
}

// ── Section 1: Pending Expenses ────────────────────────────────────────────────

function PendingExpenses({ incomes, expenses, onToggle }) {
  const today = dayjs().format("YYYY-MM-DD");

  const currentIncome = useMemo(() => {
    const past = incomes.filter(i => i.date <= today);
    if (past.length === 0) return null;
    return past.reduce((best, i) => i.date > best.date ? i : best);
  }, [incomes, today]);

  const pending = useMemo(() => {
    if (!currentIncome) return [];
    return expenses
      .filter(e => e.status === "Pending" && e.mappedIncomeId === currentIncome.incomeId)
      .slice()
      .sort((a, b) =>
        (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)
        || a.date.localeCompare(b.date)
      );
  }, [expenses, currentIncome]);

  const total = useMemo(() =>
    pending.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [pending]
  );

  if (!currentIncome) {
    return (
      <div style={{ border: "1px solid var(--border)", borderRadius: "12px", padding: "16px", color: "var(--text-muted)", fontSize: "13px" }}>
        No current income period found.
      </div>
    );
  }

  const { month, day, year } = monthParts(currentIncome.date);
  const dow = getDow(currentIncome.date);
  const cur = pending[0]?.currency || "";

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden", background: "var(--surface)", display: "flex", flexDirection: "column", flex: 1 }}>

      {/* Header — matches IncomeCard headerCurrent */}
      <div style={{ background: "var(--header-current-bg)", borderBottom: "1px solid var(--header-current-border)", overflow: "hidden" }}>
        <div style={{ height: "3px", background: "linear-gradient(90deg, var(--accent), rgba(134,239,172,0.2))" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "10px 12px 12px" }}>
          {/* Date badge + title */}
          <div style={{ display: "flex", alignItems: "center", gap: "5px", lineHeight: 1 }}>
            <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--badge-text)", letterSpacing: "0.08em" }}>{month}</span>
            <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--badge-text)", letterSpacing: "0.04em" }}>{day}</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--badge-text)", opacity: 0.7 }}>{year}</span>
            <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>·</span>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--badge-text)", opacity: 0.7 }}>{dow}</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--badge-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              Pending Expenses
            </span>
          </div>
          {/* Income summary */}
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {currentIncome.summary}
          </span>
        </div>
      </div>

      {/* Expense list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {pending.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: "12px", padding: "12px 16px" }}>
            No pending expenses for this period.
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {pending.map(exp => (
              <li key={exp.expenseId} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "7px 16px", borderBottom: "1px solid var(--border)",
                ...(exp.special ? { background: "rgba(239,68,68,0.07)" } : {}),
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, minWidth: 0 }}>
                  {/* Pending status badge — click to complete */}
                  <span
                    title="Mark as Completed"
                    onClick={() => onToggle?.(exp)}
                    style={{
                      width: "14px", height: "14px", flexShrink: 0,
                      border: "1.5px dashed var(--text-muted)", borderRadius: "3px",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer",
                    }}
                  />
                  {/* Priority dot */}
                  <span style={{
                    width: "7px", height: "7px", flexShrink: 0, borderRadius: "50%",
                    background: PRIORITY_COLOR[exp.priority] ?? "#6b7194",
                  }} />
                  {exp.special && <span style={{ fontSize: "10px", color: "#ef4444", flexShrink: 0 }}>★</span>}
                  <span style={{ fontSize: "12px", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={exp.summary}>
                    {exp.summary}
                  </span>
                  <span style={{ fontSize: "10px", color: "var(--text-muted)", flexShrink: 0 }}>{exp.date.slice(5)}</span>
                </div>
                <span style={{ fontSize: "12px", fontVariantNumeric: "tabular-nums", color: "var(--text)", fontWeight: 500, flexShrink: 0, marginLeft: "8px" }}>
                  {fmtDec(exp.amount ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer — pending-only bar */}
      {total > 0 && (
        <div style={{ padding: "8px 12px 10px", borderTop: "1px solid var(--border)" }}>
          <div style={{
            height: "34px", borderRadius: "6px", overflow: "hidden",
            background: BAR_COLOR.pending,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
              {fmtInt(total)}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "5px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: BAR_COLOR.pending, display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>Pending</span>
            <span style={{ fontSize: "10px", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
              — {fmtDec(total)} {cur}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section 2: Split Payments ──────────────────────────────────────────────────

function SplitPaymentsTable({ payments, onUpdate }) {
  const debounceTimers = useRef({});

  const latest3 = useMemo(() =>
    [...payments]
      .sort((a, b) => (b.createdDate || "").localeCompare(a.createdDate || ""))
      .slice(0, 3),
    [payments]
  );

  const maxOcc = latest3.reduce((m, e) => Math.max(m, e.occurrenceCount || 0), 0);

  function updateOcc(entry, occIdx, value) {
    const updated = {
      ...entry,
      occurrences: entry.occurrences.map((o, i) => i !== occIdx ? o : { ...o, value }),
    };
    onUpdate(updated);
    const key = `${entry.splitPaymentId}-${occIdx}`;
    clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(() => {
      updateSplitPayment(entry.splitPaymentId, { occurrences: updated.occurrences }).catch(console.error);
    }, 600);
  }

  if (latest3.length === 0) return <EmptyState>No split payments yet.</EmptyState>;

  const th = {
    textAlign: "left", fontSize: "10px", fontWeight: 600, color: "var(--text-muted)",
    textTransform: "uppercase", letterSpacing: "0.04em", padding: "8px 10px",
    borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
    background: "var(--surface)", position: "sticky", top: 0, zIndex: 1,
  };
  const td = {
    padding: "8px 10px", fontSize: "12px", color: "var(--text)",
    whiteSpace: "nowrap", borderBottom: "1px solid var(--border)",
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>Date</th>
            <th style={th}>Title</th>
            <th style={{ ...th, textAlign: "right" }}>Amount</th>
            <th style={th}>Cur.</th>
            {Array.from({ length: maxOcc }, (_, i) => (
              <th key={i} style={{ ...th, textAlign: "center" }}>#{i + 1}</th>
            ))}
            <th style={th}>Coverage</th>
          </tr>
        </thead>
        <tbody>
          {latest3.map(entry => {
            const isAmount  = entry.occurrenceType === "amount";
            const paidCount = (entry.occurrences || []).filter(o => o.value !== "" && o.value != null).length;
            const isFull    = paidCount === entry.occurrenceCount;
            return (
              <tr key={entry.splitPaymentId}>
                <td style={td}>{entry.createdDate}</td>
                <td style={{ ...td, fontWeight: 500 }}>{entry.title}</td>
                <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {Number(entry.totalAmount).toLocaleString("ro-RO")}
                </td>
                <td style={td}>{entry.currency}</td>
                {Array.from({ length: maxOcc }, (_, i) => {
                  const occ = (entry.occurrences || [])[i];
                  if (!occ) return <td key={i} style={td} />;
                  const hasPaid = occ.value !== "" && occ.value != null;
                  return (
                    <td key={i} style={{ ...td, padding: "5px 6px", textAlign: "center" }}>
                      <input
                        type={isAmount ? "number" : "date"}
                        value={occ.value ?? ""}
                        min={isAmount ? "0" : undefined}
                        step={isAmount ? "any" : undefined}
                        placeholder={isAmount ? "0.00" : undefined}
                        onChange={e => updateOcc(entry, i, e.target.value)}
                        style={{
                          width: isAmount ? "76px" : "108px",
                          padding: "3px 5px", borderRadius: "5px", fontSize: "11px",
                          border: `1px solid ${hasPaid ? "rgba(34,197,94,0.35)" : "var(--border)"}`,
                          background: hasPaid ? "rgba(34,197,94,0.10)" : "rgba(255,255,255,0.04)",
                          color: hasPaid ? "#16a34a" : "var(--text)",
                          outline: "none", fontFamily: "inherit",
                          fontVariantNumeric: "tabular-nums", boxSizing: "border-box",
                          transition: "border-color 0.15s, background 0.15s",
                        }}
                      />
                    </td>
                  );
                })}
                <td style={td}>
                  <span style={{
                    display: "inline-block", padding: "2px 7px", borderRadius: "10px",
                    fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap",
                    ...(isFull
                      ? { background: "rgba(34,197,94,0.12)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.3)" }
                      : { background: "rgba(255,255,255,0.05)", color: "var(--text-muted)", border: "1px solid var(--border)" }
                    ),
                  }}>
                    {paidCount}/{entry.occurrenceCount}{isFull ? " ✓" : ""}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Section 3: Practice Tests — Summary Bar ───────────────────────────────────

function PracticeSummaryBar({ templates, results }) {
  const [filterKid, setFilterKid] = useState("");

  const tplColorMap = useMemo(() => {
    const map = {};
    templates.forEach((t, i) => { map[t.templateId] = TEMPLATE_COLORS[i % TEMPLATE_COLORS.length]; });
    return map;
  }, [templates]);

  const kidNames = useMemo(() => [...new Set(results.map(r => r.kidName))].sort(), [results]);

  const stats = useMemo(() => {
    const all = (filterKid ? results.filter(r => r.kidName === filterKid) : results)
      .filter(r => r.totalScore != null);

    const perTplLast5 = {};
    for (const tpl of templates) {
      const sorted = all.filter(r => r.templateId === tpl.templateId)
        .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
      if (sorted.length) perTplLast5[tpl.templateId] = +(sorted.reduce((s, r) => s + r.totalScore / 10, 0) / sorted.length).toFixed(2);
    }

    const perTplValidated = {};
    for (const tpl of templates) {
      const v = all.filter(r => r.templateId === tpl.templateId && r.verified);
      if (v.length) perTplValidated[tpl.templateId] = +(v.reduce((s, r) => s + r.totalScore / 10, 0) / v.length).toFixed(2);
    }

    const perTplAll = {};
    for (const tpl of templates) {
      const t = all.filter(r => r.templateId === tpl.templateId);
      if (t.length) perTplAll[tpl.templateId] = +(t.reduce((s, r) => s + r.totalScore / 10, 0) / t.length).toFixed(2);
    }

    const avg = vals => vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null;
    return {
      overallLast5:     avg(Object.values(perTplLast5)),
      overallValidated: avg(Object.values(perTplValidated)),
      overall:          avg(Object.values(perTplAll)),
      perTplLast5, perTplValidated, perTplAllAvg: perTplAll,
    };
  }, [results, templates, filterKid]);

  if (!results.length) return null;

  const DIV = { width: "1px", background: "var(--border)", flexShrink: 0, alignSelf: "stretch" };
  const HDR = { padding: "5px 16px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" };
  const BOD = { display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", padding: "8px 16px" };

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden", display: "flex", flexDirection: "row", alignItems: "stretch" }}>

      {/* Kid filter */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "4px", padding: "10px 16px", flexShrink: 0 }}>
        <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Kid</span>
        <select style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "7px", color: "var(--text)", fontSize: "12px", padding: "5px 10px", cursor: "pointer", outline: "none" }}
          value={filterKid} onChange={e => setFilterKid(e.target.value)}>
          <option value="">All</option>
          {kidNames.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>

      <div style={DIV} />

      {/* Last 5 */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={HDR}>Last 5</div>
        <div style={BOD}>
          <span style={{ fontSize: "22px", fontWeight: 800, lineHeight: 1, color: stats.overallLast5 != null ? "var(--text)" : "var(--text-muted)" }}>
            {stats.overallLast5 != null ? stats.overallLast5.toFixed(2) : "—"}
          </span>
          <div style={{ width: "1px", height: "28px", background: "var(--border)", flexShrink: 0 }} />
          {templates.map(t => {
            const val = stats.perTplLast5[t.templateId];
            const color = tplColorMap[t.templateId];
            return (
              <div key={t.templateId} style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
                  <span style={{ fontSize: "10px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{t.name}</span>
                </div>
                <span style={{ fontSize: "16px", fontWeight: 700, lineHeight: 1, color: val != null ? color : "var(--text-muted)" }}>
                  {val != null ? val.toFixed(2) : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={DIV} />

      {/* Validated */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={HDR}>Validated</div>
        <div style={BOD}>
          <span style={{ fontSize: "22px", fontWeight: 800, lineHeight: 1, color: stats.overallValidated != null ? "var(--text)" : "var(--text-muted)" }}>
            {stats.overallValidated != null ? stats.overallValidated.toFixed(2) : "—"}
          </span>
          <div style={{ width: "1px", height: "28px", background: "var(--border)", flexShrink: 0 }} />
          {templates.map(t => {
            const val = stats.perTplValidated[t.templateId];
            const color = tplColorMap[t.templateId];
            return (
              <div key={t.templateId} style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
                  <span style={{ fontSize: "10px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{t.name}</span>
                </div>
                <span style={{ fontSize: "16px", fontWeight: 700, lineHeight: 1, color: val != null ? color : "var(--text-muted)" }}>
                  {val != null ? val.toFixed(2) : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={DIV} />

      {/* All tests */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={HDR}>All tests</div>
        <div style={BOD}>
          <span style={{ fontSize: "22px", fontWeight: 800, lineHeight: 1, color: stats.overall != null ? "var(--text)" : "var(--text-muted)" }}>
            {stats.overall != null ? stats.overall.toFixed(2) : "—"}
          </span>
          <div style={{ width: "1px", height: "28px", background: "var(--border)", flexShrink: 0 }} />
          {templates.map(t => {
            const val = stats.perTplAllAvg[t.templateId];
            const color = tplColorMap[t.templateId];
            return (
              <div key={t.templateId} style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
                  <span style={{ fontSize: "10px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{t.name}</span>
                </div>
                <span style={{ fontSize: "16px", fontWeight: 700, lineHeight: 1, color: val != null ? color : "var(--text-muted)" }}>
                  {val != null ? val.toFixed(2) : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={DIV} />
    </div>
  );
}

// ── Section 3a: Practice Tests — Grade Evolution chart ────────────────────────

function PracticeChartWithHeader({ templates, results }) {
  const tplColorMap = useMemo(() => {
    const map = {};
    templates.forEach((t, i) => { map[t.templateId] = TEMPLATE_COLORS[i % TEMPLATE_COLORS.length]; });
    return map;
  }, [templates]);

  const seen = useMemo(() => new Set(results.map(r => r.templateId)), [results]);
  const visibleTemplates = templates.filter(t => seen.has(t.templateId));

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "6px" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>
          Practice Tests — Grade Evolution
        </span>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {visibleTemplates.map(t => (
            <div key={t.templateId} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: tplColorMap[t.templateId], display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontSize: "10px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{t.name}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <PracticeChart templates={templates} results={results} />
      </div>
    </>
  );
}

function PracticeChart({ templates, results }) {
  const tplColorMap = useMemo(() => {
    const map = {};
    templates.forEach((t, i) => { map[t.templateId] = TEMPLATE_COLORS[i % TEMPLATE_COLORS.length]; });
    return map;
  }, [templates]);

  const timelineData = useMemo(() => {
    const byDate = {};
    for (const r of [...results].sort((a, b) => a.date.localeCompare(b.date))) {
      if (!byDate[r.date]) byDate[r.date] = { date: r.date };
      const key   = r.templateId;
      const grade = +(r.totalScore / 10).toFixed(2);
      byDate[r.date][key] = byDate[r.date][key] === undefined
        ? grade
        : +((byDate[r.date][key] + grade) / 2).toFixed(2);
    }
    return Object.values(byDate).slice(-50);
  }, [results]);

  const timelineMeta = useMemo(() => {
    const meta = {};
    for (const r of results) {
      if (!meta[r.date]) meta[r.date] = {};
      meta[r.date][r.templateId] = { sourceTitle: r.sourceTitle || "", verified: r.verified };
    }
    return meta;
  }, [results]);

  const timelineTemplates = useMemo(() => {
    const seen = new Set(results.map(r => r.templateId));
    return templates.filter(t => seen.has(t.templateId));
  }, [results, templates]);

  const tplAverages = useMemo(() => {
    const sums = {}, counts = {};
    for (const r of results) {
      if (r.totalScore == null) continue;
      const grade = r.totalScore / 10;
      sums[r.templateId]   = (sums[r.templateId]   || 0) + grade;
      counts[r.templateId] = (counts[r.templateId] || 0) + 1;
    }
    const map = {};
    for (const id of Object.keys(sums)) map[id] = +(sums[id] / counts[id]).toFixed(2);
    return map;
  }, [results]);

  if (results.length === 0) return <EmptyState>No test results yet.</EmptyState>;
  if (timelineData.length < 2) return <EmptyState>Not enough data points for chart.</EmptyState>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={timelineData} margin={{ top: 30, right: 20, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--text-muted)" }} />
        <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} domain={[8, 10]} tickCount={5} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "11px", padding: "6px 10px", maxWidth: "200px" }}>
                <div style={{ color: "var(--text-muted)", marginBottom: "4px" }}>{label}</div>
                {payload.map(p => {
                  const meta = timelineMeta[label]?.[p.dataKey];
                  return (
                    <div key={p.dataKey} style={{ marginBottom: "4px" }}>
                      <span style={{ color: p.stroke, fontWeight: 600 }}>{p.name}</span>
                      {": "}<strong>{p.value}</strong>
                      {meta?.verified && <span style={{ color: "var(--accent)", marginLeft: "4px" }}>✓</span>}
                    </div>
                  );
                })}
              </div>
            );
          }}
        />
        {timelineTemplates.map(t => (
          <Line
            key={t.templateId}
            type="linear"
            dataKey={t.templateId}
            name={t.name}
            stroke={tplColorMap[t.templateId]}
            strokeWidth={2}
            dot={({ cx, cy, payload, value }) => {
              if (value == null || !cy || isNaN(cy)) return null;
              const meta  = timelineMeta[payload.date]?.[t.templateId];
              const color = tplColorMap[t.templateId];
              if (meta?.verified) return (
                <g key={`dot-${t.templateId}-${payload.date}`}>
                  <circle cx={cx} cy={cy} r={6} fill="none" stroke="#ef4444" strokeWidth={2} />
                  <circle cx={cx} cy={cy} r={3} fill={color} />
                </g>
              );
              return <circle key={`dot-${t.templateId}-${payload.date}`} cx={cx} cy={cy} r={3} fill={color} />;
            }}
            label={({ x, y, value }) => {
              if (value == null || !y || isNaN(y)) return null;
              return (
                <g>
                  <rect x={x - 17} y={y - 24} width={34} height={15} rx={3} ry={3} fill="var(--surface)" stroke="var(--border)" strokeWidth={1} />
                  <text x={x} y={y - 13} textAnchor="middle" fill={tplColorMap[t.templateId]} fontSize={11} fontWeight={600}>
                    {Number(value).toFixed(2)}
                  </text>
                </g>
              );
            }}
            connectNulls
          />
        ))}
        {timelineTemplates.map(t => {
          const avg = tplAverages[t.templateId];
          if (avg == null) return null;
          const color = tplColorMap[t.templateId];
          return (
            <ReferenceLine
              key={`avg-${t.templateId}`}
              y={avg} stroke={color} strokeDasharray="5 3" strokeOpacity={0.6}
              label={{ value: `avg ${avg}`, position: "insideTopRight", fontSize: 9, fill: color, dy: -4 }}
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Section 3b: Practice Tests — Calendar ─────────────────────────────────────

function PracticeCalendar({ templates, results }) {
  const [calMonth, setCalMonth] = useState(() => dayjs().startOf("month"));

  const tplColorMap = useMemo(() => {
    const map = {};
    templates.forEach((t, i) => { map[t.templateId] = TEMPLATE_COLORS[i % TEMPLATE_COLORS.length]; });
    return map;
  }, [templates]);

  const calYear     = calMonth.year();
  const calMon      = calMonth.month();
  const daysInMonth = calMonth.daysInMonth();
  const firstDow    = (calMonth.day() + 6) % 7; // 0=Mon…6=Sun

  const calDayMap = useMemo(() => {
    const map = {};
    for (const r of results) {
      if (!r.date) continue;
      const d = dayjs(r.date);
      if (d.year() !== calYear || d.month() !== calMon) continue;
      const day = d.date();
      if (!map[day]) map[day] = [];
      if (!map[day].find(x => x.templateId === r.templateId))
        map[day].push({ templateId: r.templateId, templateName: r.templateName });
    }
    return map;
  }, [results, calYear, calMon]);

  const calCells = [];
  for (let i = 0; i < firstDow; i++) calCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calCells.push(d);

  if (results.length === 0) return <EmptyState>No test results yet.</EmptyState>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)" }}>{calMonth.format("MMM YYYY")}</span>
        <div style={{ display: "flex", gap: "4px" }}>
          <button onClick={() => setCalMonth(m => m.subtract(1, "month"))}
            style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: "4px", cursor: "pointer", color: "var(--text-muted)", padding: "1px 6px", fontSize: "13px", lineHeight: 1 }}>‹</button>
          <button onClick={() => setCalMonth(m => m.add(1, "month"))}
            style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: "4px", cursor: "pointer", color: "var(--text-muted)", padding: "1px 6px", fontSize: "13px", lineHeight: 1 }}>›</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
        {["M","T","W","T","F","S","S"].map((d, i) => (
          <div key={i} style={{ fontSize: "9px", textAlign: "center", color: "var(--text-muted)", paddingBottom: "2px" }}>{d}</div>
        ))}
        {calCells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />;
          const entries    = calDayMap[day] || [];
          const isToday    = dayjs().date() === day && dayjs().month() === calMon && dayjs().year() === calYear;
          const firstColor = entries.length > 0 ? tplColorMap[entries[0].templateId] : null;
          const dow        = new Date(calYear, calMon, day).getDay();
          const isWeekend  = dow === 0 || dow === 6;
          return (
            <div key={day} style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              minHeight: "22px", borderRadius: "4px", border: "1px solid transparent",
              ...(isWeekend && entries.length === 0 ? { background: "rgba(148,163,184,0.10)" } : {}),
              ...(isToday ? { border: "1px solid var(--accent, #86efac)" } : {}),
              ...(entries.length > 0 ? { background: firstColor + "33", borderColor: firstColor + "99" } : {}),
            }}>
              <span style={{ fontSize: "9px", fontWeight: isToday ? 700 : 400, color: entries.length > 0 ? firstColor : isWeekend ? "var(--text)" : "var(--text-muted)" }}>
                {day}
              </span>
              {entries.length > 1 && (
                <div style={{ display: "flex", gap: "1px", flexWrap: "wrap", justifyContent: "center" }}>
                  {entries.map(e => (
                    <span key={e.templateId} title={e.templateName} style={{ width: "4px", height: "4px", borderRadius: "50%", background: tplColorMap[e.templateId], display: "inline-block" }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {templates.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
          {templates.map((t, i) => (
            <div key={t.templateId} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: TEMPLATE_COLORS[i % TEMPLATE_COLORS.length], display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{t.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Section 3: Current Holdings ───────────────────────────────────────────────

function CurrentHoldings({ snapshots, fxRates, fxStatus }) {
  const [revealed,      setRevealed]      = useState(false);
  const [funFact,       setFunFact]       = useState(null);
  const [funFactLoading, setFunFactLoading] = useState(false);

  const snapshotsInEUR = useMemo(() =>
    snapshots.map(s => ({ ...s, amount: toEUR(s.amount, s.currency, fxRates), currency: "EUR" })),
    [snapshots, fxRates]
  );

  const latestByPlatform = useMemo(() => {
    const result = {};
    for (const s of snapshotsInEUR) {
      if (!result[s.platform] || s.date > result[s.platform].date) result[s.platform] = s;
    }
    return result;
  }, [snapshotsInEUR]);

  const rawLatestByPlatform = useMemo(() => {
    const result = {};
    for (const s of snapshots) {
      if (!result[s.platform] || s.date > result[s.platform].date) result[s.platform] = s;
    }
    return result;
  }, [snapshots]);

  const activePlatforms = useMemo(() => {
    const cutoff = dayjs().subtract(12, "month").format("YYYY-MM-DD");
    return PLATFORMS.filter(p =>
      snapshots.some(s => s.platform === p && s.date >= cutoff && s.amount > 0)
    );
  }, [snapshots]);

  const totalEUR = useMemo(() =>
    Object.values(latestByPlatform).reduce((sum, s) => sum + (s?.amount ?? 0), 0),
    [latestByPlatform]
  );

  useEffect(() => {
    if (!totalEUR || totalEUR <= 0) return;
    const rounded = Math.round(totalEUR / 100) * 100;
    setFunFactLoading(true);
    apiClient.get(`/fun-fact?amount=${rounded}`)
      .then(r => setFunFact(r.data.sentence))
      .catch(() => setFunFact("Your portfolio is impressive — Claude ran out of words."))
      .finally(() => setFunFactLoading(false));
  }, [totalEUR]);

  const fmtAmt = (n) => (n ?? 0).toLocaleString("ro-RO", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const mask = "••••";

  if (snapshots.length === 0) {
    return <EmptyState>No investment snapshots yet.</EmptyState>;
  }

  return (
    <div>
      {/* Total card */}
      <div style={{
        background: "var(--surface-2, rgba(0,0,0,0.04))", border: "1px solid var(--border)",
        borderRadius: "8px", padding: "10px 14px", marginBottom: "10px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>
            Total Portfolio
          </div>
          <div style={{ fontSize: "18px", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "var(--text)", letterSpacing: "-0.01em" }}>
            {revealed ? fmtAmt(totalEUR) : mask}
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "1px" }}>
            EUR
            {fxStatus === "none"     && <span style={{ marginLeft: "4px", opacity: 0.7 }}>· Getting rates…</span>}
            {fxStatus === "buffered" && <span style={{ marginLeft: "4px", opacity: 0.7 }}>· Buffered</span>}
            {fxStatus === "updated"  && <span style={{ marginLeft: "4px", color: "#22c55e" }}>· Live</span>}
          </div>
        </div>
        {/* Reveal button — hold to show */}
        <button
          onMouseDown={() => setRevealed(true)}
          onMouseUp={() => setRevealed(false)}
          onMouseLeave={() => setRevealed(false)}
          onTouchStart={() => setRevealed(true)}
          onTouchEnd={() => setRevealed(false)}
          title="Hold to reveal amounts"
          style={{
            background: revealed ? "rgba(134,239,172,0.15)" : "var(--surface)",
            border: `1px solid ${revealed ? "var(--accent)" : "var(--border)"}`,
            borderRadius: "6px", cursor: "pointer",
            color: revealed ? "var(--accent)" : "var(--text-muted)",
            padding: "6px 8px", display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.1s, border-color 0.1s, color 0.1s",
            userSelect: "none",
          }}
        >
          <svg viewBox="0 0 18 14" width="16" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            {revealed ? (
              <>
                <path d="M1 7 C4 1 14 1 17 7 C14 13 4 13 1 7" />
                <circle cx="9" cy="7" r="2.8" />
              </>
            ) : (
              <>
                <path d="M1 7 C4 1 14 1 17 7 C14 13 4 13 1 7" />
                <circle cx="9" cy="7" r="2.8" />
                <line x1="2" y1="1" x2="16" y2="13" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Fun fact */}
      {(funFact || funFactLoading) && (
        <div style={{
          fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic",
          padding: "7px 10px", marginBottom: "10px",
          background: "rgba(134,239,172,0.06)", border: "1px solid rgba(134,239,172,0.15)",
          borderRadius: "7px", lineHeight: 1.5,
        }}>
          {funFactLoading ? "💭 Thinking of something funny…" : `💡 ${funFact}`}
        </div>
      )}

      {/* Platform table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "4px 6px", color: "var(--text-muted)", fontWeight: 600, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)" }}>Platform</th>
            <th style={{ textAlign: "right", padding: "4px 6px", color: "var(--text-muted)", fontWeight: 600, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)" }}>EUR</th>
            <th style={{ textAlign: "right", padding: "4px 6px", color: "var(--text-muted)", fontWeight: 600, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)" }}>Updated</th>
          </tr>
        </thead>
        <tbody>
          {activePlatforms.map(p => {
            const snap    = latestByPlatform[p];
            const rawSnap = rawLatestByPlatform[p];
            const showOrig = rawSnap && rawSnap.currency !== "EUR";
            return (
              <tr key={p} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "6px 6px", verticalAlign: "middle" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: PLATFORM_COLOR[p], flexShrink: 0, display: "inline-block" }} />
                    <span style={{ fontWeight: 600, color: "var(--text)", fontSize: "12px" }}>{p}</span>
                  </span>
                </td>
                <td style={{ padding: "6px 6px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "var(--text)", verticalAlign: "middle" }}>
                  {snap ? (revealed ? fmtAmt(snap.amount) : mask) : "—"}
                  {showOrig && snap && (
                    <div style={{ fontSize: "10px", fontWeight: 400, color: "var(--text-muted)", marginTop: "1px" }}>
                      {revealed ? `${fmtAmt(rawSnap.amount)} ${rawSnap.currency}` : mask}
                    </div>
                  )}
                </td>
                <td style={{ padding: "6px 6px", textAlign: "right", color: "var(--text-muted)", fontSize: "11px", verticalAlign: "middle" }}>
                  {snap ? snap.date : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Section 4: Books & Development ────────────────────────────────────────────

const BOOK_TYPES = ["Book", "Audiobook", "Training", "Other"];

function BooksSnippet({ books }) {
  // latest entry per (person, type) — keyed as `${person}|${type}`
  const latestByPersonType = useMemo(() => {
    const map = {};
    for (const b of books) {
      const key = `${b.name || "Unknown"}|${b.type || "Other"}`;
      if (!map[key] || (b.dateCompleted || "") > (map[key].dateCompleted || "")) {
        map[key] = b;
      }
    }
    return map;
  }, [books]);

  const persons = useMemo(() =>
    [...new Set(books.map(b => b.name || "Unknown"))].sort(),
    [books]
  );

  // only show types that have at least one entry, sorted by most recent dateCompleted desc
  const activeTypes = useMemo(() => {
    const latestDateByType = {};
    for (const b of books) {
      const t = b.type || "Other";
      if ((b.dateCompleted || "") > (latestDateByType[t] || "")) {
        latestDateByType[t] = b.dateCompleted || "";
      }
    }
    return BOOK_TYPES
      .filter(t => latestDateByType[t] !== undefined)
      .sort((a, b) => (latestDateByType[b] || "").localeCompare(latestDateByType[a] || ""));
  }, [books]);

  if (books.length === 0) {
    return <EmptyState>No books or trainings yet.</EmptyState>;
  }

  const thStyle = {
    padding: "4px 8px", fontSize: "10px", fontWeight: 700,
    color: "var(--text-muted)", textTransform: "uppercase",
    letterSpacing: "0.05em", borderBottom: "1px solid var(--border)",
    textAlign: "center", whiteSpace: "nowrap",
  };
  const tdTypeStyle = {
    padding: "5px 8px", fontSize: "10px", fontWeight: 600,
    borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
    verticalAlign: "middle",
  };
  const tdStyle = {
    padding: "5px 8px", borderBottom: "1px solid var(--border)",
    verticalAlign: "top", minWidth: 0,
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", tableLayout: "fixed" }}>
        <thead>
          <tr>
            {/* Type column header (empty — types are row headers) */}
            <th style={{ ...thStyle, width: "70px", textAlign: "left" }} />
            {persons.map(p => (
              <th key={p} style={thStyle}>{p}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activeTypes.map(type => {
            const typeColor = TYPE_COLORS[type] || TYPE_COLORS.Other;
            return (
              <tr key={type}>
                {/* Row header — type badge */}
                <td style={tdTypeStyle}>
                  <span style={{
                    fontSize: "10px", fontWeight: 600, padding: "2px 6px",
                    borderRadius: "4px", background: typeColor.bg, color: typeColor.text,
                    display: "inline-block",
                  }}>
                    {type}
                  </span>
                </td>
                {persons.map(person => {
                  const entry = latestByPersonType[`${person}|${type}`];
                  return (
                    <td key={person} style={tdStyle}>
                      {entry ? (
                        <div>
                          <div style={{
                            fontSize: "11px", color: "var(--text)", fontWeight: 500,
                            overflow: "hidden", textOverflow: "ellipsis",
                            display: "-webkit-box", WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            lineHeight: "1.35",
                          }} title={entry.title}>
                            {entry.title}
                          </div>
                          {entry.dateCompleted && (
                            <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>
                              {entry.dateCompleted}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function HomeOverview() {
  const [incomes,   setIncomes]   = useState([]);
  const [expenses,  setExpenses]  = useState([]);
  const [payments,  setPayments]  = useState([]);
  const [books,     setBooks]     = useState([]);
  const [templates, setTemplates] = useState([]);
  const [results,   setResults]   = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [fxRates,   setFxRates]   = useState(null);
  const [fxStatus,  setFxStatus]  = useState("none");
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    // Apply client-side cached rates immediately for instant render
    let clientCacheValid = false;
    try {
      const cached = JSON.parse(localStorage.getItem(FX_CACHE_KEY));
      if (cached?.rates && Date.now() - cached.ts < FX_TTL_MS) {
        setFxRates(cached.rates);
        setFxStatus("buffered");
        clientCacheValid = true;
      }
    } catch { /* ignore corrupt cache */ }

    // Always fetch from our backend in the background — it caches rates in DynamoDB
    // so they are shared across all devices and browsers (24 h server-side TTL).
    // Skip the network call only when the client cache is still warm.
    if (!clientCacheValid) {
      apiClient.get("/fx-rates")
        .then(res => {
          const { rates } = res.data;
          if (!rates) return;
          setFxRates(rates);
          setFxStatus("updated");
          try { localStorage.setItem(FX_CACHE_KEY, JSON.stringify({ rates, ts: Date.now() })); } catch { /**/ }
        })
        .catch(() => {
          // Backend call failed — fall back to any stale localStorage entry rather than showing nothing
          try {
            const stale = JSON.parse(localStorage.getItem(FX_CACHE_KEY));
            if (stale?.rates) { setFxRates(stale.rates); setFxStatus("buffered"); }
          } catch { /**/ }
        });
    }

    Promise.all([
      listIncomes(),
      listExpenses(),
      listSplitPayments(),
      listBooks(),
      listTemplates(),
      listResults(),
      getKids(),
      listSnapshots(),
    ])
      .then(([inc, exp, pay, bks, tpls, res, , snaps]) => {
        setIncomes(inc);
        setExpenses(exp);
        setPayments(pay);
        setBooks(bks);
        setTemplates(tpls);
        setResults(res);
        setSnapshots(snaps);
      })
      .catch(e => setError(e?.message || "Failed to load data."))
      .finally(() => setLoading(false));
  }, []);

  async function handleToggleExpense(exp) {
    // Optimistically mark as Completed in local state
    setExpenses(prev => prev.map(e => e.expenseId === exp.expenseId ? { ...e, status: "Completed" } : e));
    try {
      await updateExpense(exp.expenseId, { ...exp, status: "Completed" });
    } catch {
      // Rollback on failure
      setExpenses(prev => prev.map(e => e.expenseId === exp.expenseId ? { ...e, status: "Pending" } : e));
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: "14px" }}>
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#ef4444", fontSize: "14px" }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gridTemplateRows: "420px 260px auto auto", gap: "16px", padding: "16px", flex: 1, minHeight: 0, overflowY: "auto" }}>

      {/* Section 1 — Pending Expenses (span 2) */}
      <div style={{ gridColumn: "span 2", display: "flex", flexDirection: "column", height: "100%" }}>
        <PendingExpenses incomes={incomes} expenses={expenses} onToggle={handleToggleExpense} />
      </div>

      {/* Section 2 — Split Payments (span 4 — wider for full table) */}
      <Card style={{ gridColumn: "span 4", height: "100%", boxSizing: "border-box", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Split Payments — Last 3
          </span>
          <Link to="/split-payments" style={{ fontSize: "11px", color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
            View all →
          </Link>
        </div>
        <SplitPaymentsTable
          payments={payments}
          onUpdate={updated => setPayments(prev => prev.map(p => p.splitPaymentId === updated.splitPaymentId ? updated : p))}
        />
      </Card>

      {/* Section 3 — Current Holdings (span 3) */}
      <Card style={{ gridColumn: "span 3", height: "100%", boxSizing: "border-box", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <SectionHeader>Current Holdings</SectionHeader>
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          <CurrentHoldings snapshots={snapshots} fxRates={fxRates} fxStatus={fxStatus} />
        </div>
      </Card>

      {/* Section 4 — Books & Development (span 3 — same row/height as Holdings) */}
      <Card style={{ gridColumn: "span 3", height: "100%", boxSizing: "border-box", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <SectionHeader>Books & Development — Latest per Person</SectionHeader>
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          <BooksSnippet books={books} />
        </div>
      </Card>

      {/* Practice Tests summary bar (span 6) */}
      <div style={{ gridColumn: "span 6", display: "flex", flexDirection: "column" }}>
        <PracticeSummaryBar templates={templates} results={results} />
      </div>

      {/* Section 4a — Practice Tests: Grade Evolution (span 4) */}
      <Card style={{ gridColumn: "span 4", display: "flex", flexDirection: "column" }}>
        <PracticeChartWithHeader templates={templates} results={results} />
      </Card>

      {/* Section 4b — Practice Tests: Calendar (span 2) */}
      <Card style={{ gridColumn: "span 2" }}>
        <SectionHeader>Practice Tests — Calendar</SectionHeader>
        <PracticeCalendar templates={templates} results={results} />
      </Card>

    </div>
  );
}
