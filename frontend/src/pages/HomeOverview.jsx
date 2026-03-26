import { useState, useEffect, useMemo } from "react";
import dayjs from "dayjs";
import {
  LineChart, Line, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { listIncomes } from "../api/incomes";
import { listExpenses } from "../api/expenses";
import { listSplitPayments } from "../api/splitPayments";
import { listBooks } from "../api/booksAndDev";
import { listTemplates, listResults, getKids } from "../api/practiceTests";

const TEMPLATE_COLORS = ["#16a34a", "#60a5fa", "#f9a8d4", "#fcd34d", "#a78bfa", "#34d399", "#fb923c"];

const PRIORITY_COLORS = {
  High:   { bg: "#ef4444", text: "#fff" },
  Medium: { bg: "#f59e0b", text: "#fff" },
  Low:    { bg: "#6b7194", text: "#fff" },
};

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

function PendingExpenses({ incomes, expenses }) {
  const today = dayjs().format("YYYY-MM-DD");

  const currentIncome = useMemo(() => {
    const past = incomes.filter(i => i.date <= today);
    if (past.length === 0) return null;
    return past.reduce((best, i) => i.date > best.date ? i : best);
  }, [incomes, today]);

  const pending = useMemo(() => {
    if (!currentIncome) return [];
    return expenses.filter(e =>
      e.status === "Pending" && e.mappedIncomeId === currentIncome.incomeId
    );
  }, [expenses, currentIncome]);

  const total = useMemo(() =>
    pending.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [pending]
  );

  if (!currentIncome) {
    return <EmptyState>No current income period found.</EmptyState>;
  }

  return (
    <div>
      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "10px" }}>
        Period: <strong style={{ color: "var(--text)" }}>{currentIncome.summary || currentIncome.date}</strong>
        <span style={{ marginLeft: "6px", opacity: 0.7 }}>{currentIncome.date}</span>
      </div>

      {pending.length === 0 ? (
        <EmptyState>No pending expenses for this period.</EmptyState>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {pending.map(e => (
              <div key={e.expenseId} style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "7px 10px", borderRadius: "8px",
                background: e.special ? "rgba(239,68,68,0.07)" : "var(--surface-2, rgba(0,0,0,0.04))",
                border: "1px solid var(--border)",
              }}>
                {e.special && <span title="Special" style={{ fontSize: "12px", color: "#ef4444", flexShrink: 0 }}>★</span>}
                <span style={{ flex: 1, fontSize: "13px", color: "var(--text)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {e.summary || e.description || "—"}
                </span>
                <span style={{
                  fontSize: "11px", fontWeight: 600, padding: "2px 7px", borderRadius: "4px",
                  background: PRIORITY_COLORS[e.priority]?.bg || "#6b7194",
                  color: PRIORITY_COLORS[e.priority]?.text || "#fff",
                  flexShrink: 0,
                }}>
                  {e.priority}
                </span>
                <span style={{ fontSize: "13px", fontVariantNumeric: "tabular-nums", color: "var(--text)", fontWeight: 500, flexShrink: 0 }}>
                  {Number(e.amount).toLocaleString("ro-RO")} {e.currency}
                </span>
              </div>
            ))}
          </div>
          <div style={{
            display: "flex", justifyContent: "flex-end", alignItems: "center",
            marginTop: "10px", paddingTop: "10px", borderTop: "1px solid var(--border)",
            gap: "8px",
          }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total pending</span>
            <span style={{ fontSize: "15px", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--text)" }}>
              {total.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {pending[0]?.currency || ""}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ── Section 2: Split Payments ──────────────────────────────────────────────────

function SplitPaymentsSnippet({ payments }) {
  const latest = useMemo(() => {
    if (payments.length === 0) return null;
    return [...payments].sort((a, b) => {
      const da = a.createdDate || "";
      const db = b.createdDate || "";
      return db.localeCompare(da);
    })[0];
  }, [payments]);

  if (!latest) return <EmptyState>No split payments yet.</EmptyState>;

  const paidCount = (latest.occurrences || []).filter(o => o.value !== "" && o.value != null).length;
  const isFull    = paidCount === latest.occurrenceCount;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>{latest.title}</span>
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{latest.createdDate}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
        <span style={{ fontSize: "15px", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--text)" }}>
          {Number(latest.totalAmount).toLocaleString("ro-RO")} {latest.currency}
        </span>
        <span style={{
          fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px",
          background: isFull ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)",
          color: isFull ? "#16a34a" : "#d97706",
        }}>
          {paidCount}/{latest.occurrenceCount}{isFull ? " ✓" : ""}
        </span>
      </div>
      {latest.occurrences && latest.occurrences.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {latest.occurrences.map((occ, i) => {
            const hasPaid = occ.value !== "" && occ.value != null;
            return (
              <div key={i} style={{
                padding: "4px 10px", borderRadius: "6px", fontSize: "12px",
                background: hasPaid ? "rgba(34,197,94,0.13)" : "var(--surface-2, rgba(0,0,0,0.04))",
                border: `1px solid ${hasPaid ? "rgba(34,197,94,0.35)" : "var(--border)"}`,
                color: hasPaid ? "#16a34a" : "var(--text-muted)",
                fontVariantNumeric: "tabular-nums",
              }}>
                #{i + 1}{hasPaid ? `: ${occ.value}` : ""}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Section 3: Practice Tests Chart + Calendar ─────────────────────────────────

function PracticeOverview({ templates, results }) {
  const [calMonth, setCalMonth] = useState(() => dayjs().startOf("month"));

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
      if (byDate[r.date][key] === undefined) {
        byDate[r.date][key] = grade;
      } else {
        byDate[r.date][key] = +((byDate[r.date][key] + grade) / 2).toFixed(2);
      }
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
    for (const id of Object.keys(sums)) {
      map[id] = +(sums[id] / counts[id]).toFixed(2);
    }
    return map;
  }, [results]);

  const calYear  = calMonth.year();
  const calMon   = calMonth.month();
  const daysInMonth = calMonth.daysInMonth();
  const firstDow    = calMonth.day();

  const calDayMap = useMemo(() => {
    const map = {};
    for (const r of results) {
      if (!r.date) continue;
      const d = dayjs(r.date);
      if (d.year() !== calYear || d.month() !== calMon) continue;
      const day = d.date();
      if (!map[day]) map[day] = [];
      if (!map[day].find(x => x.templateId === r.templateId)) {
        map[day].push({ templateId: r.templateId, templateName: r.templateName });
      }
    }
    return map;
  }, [results, calYear, calMon]);

  const calCells = [];
  for (let i = 0; i < firstDow; i++) calCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calCells.push(d);

  if (results.length === 0) {
    return <EmptyState>No test results yet.</EmptyState>;
  }

  return (
    <div style={{ display: "flex", gap: "12px" }}>
      {/* Chart (70%) */}
      <div style={{ flex: "0 0 70%" }}>
        {timelineData.length < 2 ? (
          <EmptyState>Not enough data points for chart.</EmptyState>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={timelineData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
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
                            {": "}
                            <strong>{p.value}</strong>
                            {meta?.verified && <span style={{ color: "var(--accent)", marginLeft: "4px" }}>✓</span>}
                          </div>
                        );
                      })}
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: "10px" }} />
              {timelineTemplates.map(t => (
                <Line
                  key={t.templateId}
                  type="linear"
                  dataKey={t.templateId}
                  name={t.name}
                  stroke={tplColorMap[t.templateId]}
                  strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    const meta = timelineMeta[payload.date]?.[t.templateId];
                    const color = tplColorMap[t.templateId];
                    if (meta?.verified) {
                      return (
                        <g key={`dot-${t.templateId}-${payload.date}`}>
                          <circle cx={cx} cy={cy} r={6} fill="none" stroke="#ef4444" strokeWidth={2} />
                          <circle cx={cx} cy={cy} r={3} fill={color} />
                        </g>
                      );
                    }
                    return <circle key={`dot-${t.templateId}-${payload.date}`} cx={cx} cy={cy} r={3} fill={color} />;
                  }}
                  label={({ x, y, value }) => (
                    <g>
                      <rect x={x - 17} y={y - 24} width={34} height={15} rx={3} ry={3} fill="var(--surface)" stroke="var(--border)" strokeWidth={1} />
                      <text x={x} y={y - 13} textAnchor="middle" fill={tplColorMap[t.templateId]} fontSize={11} fontWeight={600}>
                        {Number(value).toFixed(2)}
                      </text>
                    </g>
                  )}
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
                    y={avg}
                    stroke={color}
                    strokeDasharray="5 3"
                    strokeOpacity={0.6}
                    label={{ value: `avg ${avg}`, position: "insideTopRight", fontSize: 9, fill: color, dy: -4 }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Calendar (30%) */}
      <div style={{ flex: "0 0 30%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)" }}>{calMonth.format("MMM YYYY")}</span>
          <div style={{ display: "flex", gap: "4px" }}>
            <button
              onClick={() => setCalMonth(m => m.subtract(1, "month"))}
              style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: "4px", cursor: "pointer", color: "var(--text-muted)", padding: "1px 6px", fontSize: "13px", lineHeight: 1 }}
            >‹</button>
            <button
              onClick={() => setCalMonth(m => m.add(1, "month"))}
              style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: "4px", cursor: "pointer", color: "var(--text-muted)", padding: "1px 6px", fontSize: "13px", lineHeight: 1 }}
            >›</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
          {["S","M","T","W","T","F","S"].map((d, i) => (
            <div key={i} style={{ fontSize: "9px", textAlign: "center", color: "var(--text-muted)", paddingBottom: "2px" }}>{d}</div>
          ))}
          {calCells.map((day, i) => {
            if (!day) return <div key={`e-${i}`} />;
            const entries  = calDayMap[day] || [];
            const isToday  = dayjs().date() === day && dayjs().month() === calMon && dayjs().year() === calYear;
            const firstColor = entries.length > 0 ? tplColorMap[entries[0].templateId] : null;
            return (
              <div key={day} style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                minHeight: "22px", borderRadius: "4px", border: "1px solid transparent",
                ...(isToday ? { border: "1px solid var(--accent, #86efac)" } : {}),
                ...(entries.length > 0 ? { background: firstColor + "33", borderColor: firstColor + "99" } : {}),
              }}>
                <span style={{ fontSize: "9px", fontWeight: isToday ? 700 : 400, color: entries.length > 0 ? firstColor : "var(--text-muted)" }}>
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
    </div>
  );
}

// ── Section 4: Books & Development ────────────────────────────────────────────

function BooksSnippet({ books }) {
  const byPerson = useMemo(() => {
    const map = {};
    for (const b of books) {
      const name = b.name || "Unknown";
      if (!map[name]) map[name] = [];
      map[name].push(b);
    }
    return map;
  }, [books]);

  const persons = useMemo(() =>
    Object.keys(byPerson).sort(),
    [byPerson]
  );

  if (books.length === 0) {
    return <EmptyState>No books or trainings yet.</EmptyState>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {persons.map(person => {
        const personBooks = byPerson[person];
        const latest = [...personBooks].sort((a, b) => {
          const da = a.dateCompleted || "";
          const db = b.dateCompleted || "";
          return db.localeCompare(da);
        })[0];

        const typeColor = TYPE_COLORS[latest.type] || TYPE_COLORS.Other;

        return (
          <div key={person}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
              {person} <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>({personBooks.length})</span>
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "8px 10px", borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--surface-2, rgba(0,0,0,0.04))",
            }}>
              <span style={{
                fontSize: "10px", fontWeight: 600, padding: "2px 6px", borderRadius: "4px",
                background: typeColor.bg, color: typeColor.text, flexShrink: 0,
              }}>
                {latest.type}
              </span>
              <span style={{ flex: 1, fontSize: "13px", color: "var(--text)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                {latest.title}
              </span>
              <ReadOnlyStars value={latest.rating} />
              {latest.dateCompleted && (
                <span style={{ fontSize: "11px", color: "var(--text-muted)", flexShrink: 0 }}>{latest.dateCompleted}</span>
              )}
            </div>
          </div>
        );
      })}
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
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    Promise.all([
      listIncomes(),
      listExpenses(),
      listSplitPayments(),
      listBooks(),
      listTemplates(),
      listResults(),
      getKids(),
    ])
      .then(([inc, exp, pay, bks, tpls, res]) => {
        setIncomes(inc);
        setExpenses(exp);
        setPayments(pay);
        setBooks(bks);
        setTemplates(tpls);
        setResults(res);
      })
      .catch(e => setError(e?.message || "Failed to load data."))
      .finally(() => setLoading(false));
  }, []);

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
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", padding: "0", overflow: "auto" }}>

      {/* Section 1 — Pending Expenses */}
      <Card>
        <SectionHeader>Pending Expenses</SectionHeader>
        <PendingExpenses incomes={incomes} expenses={expenses} />
      </Card>

      {/* Section 2 — Split Payments */}
      <Card>
        <SectionHeader>Split Payments — Latest</SectionHeader>
        <SplitPaymentsSnippet payments={payments} />
      </Card>

      {/* Section 3 — Practice Tests */}
      <Card>
        <SectionHeader>Practice Tests</SectionHeader>
        <PracticeOverview templates={templates} results={results} />
      </Card>

      {/* Section 4 — Books & Development */}
      <Card>
        <SectionHeader>Books & Development — Latest per Person</SectionHeader>
        <BooksSnippet books={books} />
      </Card>

    </div>
  );
}
