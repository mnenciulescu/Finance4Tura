import { useState, useEffect, useMemo } from "react";
import dayjs from "dayjs";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  listOperations, createOperation, updateOperation, deleteOperation,
  listSnapshots, createSnapshot, deleteSnapshot,
} from "../api/investments";

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORMS = ["eToro", "Binance", "Fidelity", "Tradeville", "ING Funds RON", "ING Funds EUR"];

const PLATFORM_CURRENCY = {
  "eToro":         "USD",
  "Binance":       "USD",
  "Fidelity":      "USD",
  "Tradeville":    "RON",
  "ING Funds RON": "RON",
  "ING Funds EUR": "EUR",
};

const PLATFORM_COLOR = {
  "eToro":         "#22c55e",
  "Binance":       "#f59e0b",
  "Fidelity":      "#3b82f6",
  "Tradeville":    "#a855f7",
  "ING Funds RON": "#ef4444",
  "ING Funds EUR": "#f97316",
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function today() { return dayjs().format("YYYY-MM-DD"); }
function fmtNum(n) { return (n ?? 0).toLocaleString("ro-RO", { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
function fmtChartDate(d) {
  const [y, m] = d.split("-");
  return `${MONTHS[parseInt(m) - 1]} '${y.slice(2)}`;
}

function defaultOpForm() {
  return { date: today(), type: "Deposit", platform: "eToro", amount: "", currency: "USD", notes: "" };
}
function defaultSnapForm() {
  return { date: today(), platform: "eToro", amount: "", currency: "USD" };
}

// ── Chart helpers ─────────────────────────────────────────────────────────────

function buildChartData(snapshots) {
  if (!snapshots.length) return [];
  const allDates = [...new Set(snapshots.map(s => s.date))].sort();
  return allDates.map(date => {
    const point = { date };
    for (const p of PLATFORMS) {
      const latest = snapshots
        .filter(s => s.platform === p && s.date <= date)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      if (latest) point[p] = latest.amount;
    }
    return point;
  });
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={st.tooltip}>
      <div style={st.tooltipDate}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ ...st.tooltipRow, color: p.color }}>
          <span>{p.dataKey}</span>
          <span style={st.tooltipVal}>{fmtNum(p.value)} {PLATFORM_CURRENCY[p.dataKey]}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Investments() {
  const [operations, setOperations] = useState([]);
  const [snapshots,  setSnapshots]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [hidden,     setHidden]     = useState(new Set());

  // Operations modal
  const [showOpModal,  setShowOpModal]  = useState(false);
  const [editingOpId,  setEditingOpId]  = useState(null);
  const [opForm,       setOpForm]       = useState(defaultOpForm);
  const [opErrors,     setOpErrors]     = useState({});

  // Snapshot modal
  const [showSnapModal, setShowSnapModal] = useState(false);
  const [snapForm,      setSnapForm]      = useState(defaultSnapForm);
  const [snapErrors,    setSnapErrors]    = useState({});

  useEffect(() => {
    Promise.all([listOperations(), listSnapshots()])
      .then(([ops, snaps]) => { setOperations(ops); setSnapshots(snaps); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────────

  const latestByPlatform = useMemo(() => {
    const result = {};
    for (const s of snapshots) {
      if (!result[s.platform] || s.date > result[s.platform].date) result[s.platform] = s;
    }
    return result;
  }, [snapshots]);

  const chartData = useMemo(() => buildChartData(snapshots), [snapshots]);

  // ── Op form helpers ───────────────────────────────────────────────────────────

  function opField(key) {
    return {
      value: opForm[key],
      onChange: e => {
        const val = e.target.value;
        setOpForm(f => {
          const next = { ...f, [key]: val };
          if (key === "platform") next.currency = PLATFORM_CURRENCY[val] ?? "USD";
          return next;
        });
      },
    };
  }

  function openAddOp() {
    setEditingOpId(null);
    setOpForm(defaultOpForm());
    setOpErrors({});
    setShowOpModal(true);
  }

  function openEditOp(op) {
    setEditingOpId(op.operationId);
    setOpForm({ date: op.date, type: op.type, platform: op.platform, amount: op.amount, currency: op.currency, notes: op.notes || "" });
    setOpErrors({});
    setShowOpModal(true);
  }

  async function handleOpSave() {
    const errs = {};
    if (!opForm.date)                          errs.date     = "Required";
    if (!opForm.amount || +opForm.amount <= 0) errs.amount   = "Must be > 0";
    setOpErrors(errs);
    if (Object.keys(errs).length) return;

    const body = { ...opForm, amount: parseFloat(opForm.amount) };
    try {
      if (editingOpId) {
        const updated = await updateOperation(editingOpId, body);
        setOperations(prev => prev.map(o => o.operationId === editingOpId ? updated : o));
      } else {
        const created = await createOperation(body);
        setOperations(prev => [created, ...prev]);
      }
      setShowOpModal(false);
    } catch (e) { console.error(e); }
  }

  async function handleOpDelete(id) {
    if (!window.confirm("Delete this operation?")) return;
    try {
      await deleteOperation(id);
      setOperations(prev => prev.filter(o => o.operationId !== id));
    } catch (e) { console.error(e); }
  }

  // ── Snap form helpers ─────────────────────────────────────────────────────────

  function snapField(key) {
    return {
      value: snapForm[key],
      onChange: e => {
        const val = e.target.value;
        setSnapForm(f => {
          const next = { ...f, [key]: val };
          if (key === "platform") next.currency = PLATFORM_CURRENCY[val] ?? "USD";
          return next;
        });
      },
    };
  }

  function openAddSnap() {
    setSnapForm(defaultSnapForm());
    setSnapErrors({});
    setShowSnapModal(true);
  }

  async function handleSnapSave() {
    const errs = {};
    if (!snapForm.date)                              errs.date   = "Required";
    if (snapForm.amount === "" || snapForm.amount < 0) errs.amount = "Must be ≥ 0";
    setSnapErrors(errs);
    if (Object.keys(errs).length) return;

    const body = { ...snapForm, amount: parseFloat(snapForm.amount) };
    try {
      const created = await createSnapshot(body);
      setSnapshots(prev => [created, ...prev]);
      setShowSnapModal(false);
    } catch (e) { console.error(e); }
  }

  async function handleSnapDelete(id) {
    if (!window.confirm("Delete this snapshot?")) return;
    try {
      await deleteSnapshot(id);
      setSnapshots(prev => prev.filter(s => s.snapshotId !== id));
    } catch (e) { console.error(e); }
  }

  function togglePlatform(p) {
    setHidden(prev => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) return <div style={s.page}><p style={s.muted}>Loading…</p></div>;

  return (
    <div style={s.page}>

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div style={s.pageHeader}>
        <div>
          <h2 style={s.pageTitle}>Investments</h2>
          <p style={s.pageSub}>Track your portfolio and operations across all platforms.</p>
        </div>
      </div>

      {/* ── Current Holdings ────────────────────────────────────────────────── */}
      <Section title="Current Holdings">
        <div style={s.holdingsGrid}>
          {PLATFORMS.map(p => {
            const snap = latestByPlatform[p];
            return (
              <div key={p} style={{ ...s.holdingCard, borderTopColor: PLATFORM_COLOR[p] }}>
                <div style={{ ...s.holdingPlatform, color: PLATFORM_COLOR[p] }}>{p}</div>
                {snap ? (
                  <>
                    <div style={s.holdingAmount}>{fmtNum(snap.amount)}</div>
                    <div style={s.holdingCurrency}>{snap.currency}</div>
                    <div style={s.holdingDate}>{snap.date}</div>
                  </>
                ) : (
                  <div style={s.holdingNoData}>No data</div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── Portfolio Evolution ──────────────────────────────────────────────── */}
      <Section title="Portfolio Evolution">
        {/* Platform toggles */}
        <div style={s.legendRow}>
          {PLATFORMS.map(p => (
            <button
              key={p}
              onClick={() => togglePlatform(p)}
              style={{
                ...s.legendChip,
                opacity:         hidden.has(p) ? 0.35 : 1,
                borderColor:     PLATFORM_COLOR[p],
                color:           hidden.has(p) ? "var(--text-muted)" : PLATFORM_COLOR[p],
                backgroundColor: hidden.has(p) ? "transparent" : `${PLATFORM_COLOR[p]}18`,
              }}
            >
              {p}
            </button>
          ))}
        </div>
        {chartData.length < 2 ? (
          <p style={s.muted}>Add at least two snapshot readings to see the chart.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tickFormatter={fmtChartDate}
                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                tickLine={false}
                axisLine={false}
                width={60}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
              />
              <Tooltip content={<ChartTooltip />} />
              {PLATFORMS.map(p => (
                <Line
                  key={p}
                  type="monotone"
                  dataKey={p}
                  stroke={PLATFORM_COLOR[p]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  hide={hidden.has(p)}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
        <p style={{ ...s.muted, marginTop: "6px", fontSize: "10px" }}>
          Amounts shown in native currency (USD / RON / EUR) — not converted.
        </p>
      </Section>

      {/* ── Operations Log ───────────────────────────────────────────────────── */}
      <Section title="Operations Log" action={<button style={s.addBtn} onClick={openAddOp}>+ Add Operation</button>}>
        {operations.length === 0 ? (
          <p style={s.muted}>No operations yet.</p>
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  {["Date","Platform","Type","Amount","Currency","Notes","",""].map((h, i) => (
                    <th key={i} style={{ ...s.th, textAlign: i >= 6 ? "center" : "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {operations.map(op => (
                  <tr key={op.operationId} style={s.tr}>
                    <td style={s.td}>{op.date}</td>
                    <td style={{ ...s.td }}>
                      <span style={{ color: PLATFORM_COLOR[op.platform], fontWeight: 600 }}>{op.platform}</span>
                    </td>
                    <td style={s.td}>
                      <span style={{ ...s.typeBadge, ...(op.type === "Deposit" ? s.typeDeposit : s.typeWithdraw) }}>
                        {op.type}
                      </span>
                    </td>
                    <td style={{ ...s.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(op.amount)}</td>
                    <td style={s.td}>{op.currency}</td>
                    <td style={{ ...s.td, color: "var(--text-muted)", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis" }}>{op.notes || "—"}</td>
                    <td style={{ ...s.td, textAlign: "center" }}>
                      <button style={s.editBtn} title="Edit" onClick={() => openEditOp(op)}>✎</button>
                    </td>
                    <td style={{ ...s.td, textAlign: "center" }}>
                      <button style={s.deleteBtn} title="Delete" onClick={() => handleOpDelete(op.operationId)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── Portfolio Snapshots ──────────────────────────────────────────────── */}
      <Section title="Portfolio Snapshots" action={<button style={s.addBtn} onClick={openAddSnap}>+ Add Snapshot</button>}>
        {snapshots.length === 0 ? (
          <p style={s.muted}>No snapshots yet.</p>
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  {["Date","Platform","Amount","Currency",""].map((h, i) => (
                    <th key={i} style={{ ...s.th, textAlign: i === 4 ? "center" : i === 2 ? "right" : "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {snapshots.map(snap => (
                  <tr key={snap.snapshotId} style={s.tr}>
                    <td style={s.td}>{snap.date}</td>
                    <td style={s.td}>
                      <span style={{ color: PLATFORM_COLOR[snap.platform], fontWeight: 600 }}>{snap.platform}</span>
                    </td>
                    <td style={{ ...s.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(snap.amount)}</td>
                    <td style={s.td}>{snap.currency}</td>
                    <td style={{ ...s.td, textAlign: "center" }}>
                      <button style={s.deleteBtn} title="Delete" onClick={() => handleSnapDelete(snap.snapshotId)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── Operations Modal ─────────────────────────────────────────────────── */}
      {showOpModal && (
        <Modal title={editingOpId ? "Edit Operation" : "New Operation"} onClose={() => setShowOpModal(false)}>
          <FormField label="Date *" error={opErrors.date}>
            <input style={{ ...s.input, ...(opErrors.date ? s.inputErr : {}) }} type="date" {...opField("date")} />
          </FormField>
          <div style={s.row2}>
            <FormField label="Type">
              <select style={s.input} {...opField("type")}>
                <option>Deposit</option>
                <option>Withdrawal</option>
              </select>
            </FormField>
            <FormField label="Platform">
              <select style={s.input} {...opField("platform")}>
                {PLATFORMS.map(p => <option key={p}>{p}</option>)}
              </select>
            </FormField>
          </div>
          <div style={s.row2}>
            <FormField label="Amount *" error={opErrors.amount}>
              <input style={{ ...s.input, ...(opErrors.amount ? s.inputErr : {}) }} type="number" min="0" step="any" placeholder="0" {...opField("amount")} />
            </FormField>
            <FormField label="Currency">
              <select style={s.input} {...opField("currency")}>
                <option>USD</option>
                <option>EUR</option>
                <option>RON</option>
              </select>
            </FormField>
          </div>
          <FormField label="Notes">
            <input style={s.input} type="text" placeholder="Optional" {...opField("notes")} />
          </FormField>
          <div style={s.modalFooter}>
            <button style={s.cancelBtn} onClick={() => setShowOpModal(false)}>Cancel</button>
            <button style={s.saveBtn} onClick={handleOpSave}>Save</button>
          </div>
        </Modal>
      )}

      {/* ── Snapshot Modal ───────────────────────────────────────────────────── */}
      {showSnapModal && (
        <Modal title="New Portfolio Snapshot" onClose={() => setShowSnapModal(false)}>
          <FormField label="Date *" error={snapErrors.date}>
            <input style={{ ...s.input, ...(snapErrors.date ? s.inputErr : {}) }} type="date" {...snapField("date")} />
          </FormField>
          <FormField label="Platform">
            <select style={s.input} {...snapField("platform")}>
              {PLATFORMS.map(p => <option key={p}>{p}</option>)}
            </select>
          </FormField>
          <div style={s.row2}>
            <FormField label="Amount *" error={snapErrors.amount}>
              <input style={{ ...s.input, ...(snapErrors.amount ? s.inputErr : {}) }} type="number" min="0" step="any" placeholder="0" {...snapField("amount")} />
            </FormField>
            <FormField label="Currency">
              <select style={s.input} {...snapField("currency")}>
                <option>USD</option>
                <option>EUR</option>
                <option>RON</option>
              </select>
            </FormField>
          </div>
          <div style={s.modalFooter}>
            <button style={s.cancelBtn} onClick={() => setShowSnapModal(false)}>Cancel</button>
            <button style={s.saveBtn} onClick={handleSnapSave}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, action, children }) {
  return (
    <div style={s.section}>
      <div style={s.sectionHeader}>
        <h3 style={s.sectionTitle}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>{title}</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={s.modalBody}>{children}</div>
      </div>
    </div>
  );
}

function FormField({ label, error, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <label style={s.label}>{label}</label>
      {children}
      {error && <span style={s.errText}>{error}</span>}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  page: {
    display:       "flex",
    flexDirection: "column",
    flex:          1,
    gap:           "20px",
    overflowY:     "auto",
    padding:       "0 2px 24px",
  },
  pageHeader: {
    flexShrink: 0,
  },
  pageTitle: {
    margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--text)",
  },
  pageSub: {
    margin: "4px 0 0", fontSize: "13px", color: "var(--text-muted)",
  },
  muted: {
    color: "var(--text-muted)", fontSize: "13px", margin: 0,
  },

  // Holdings
  holdingsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: "12px",
  },
  holdingCard: {
    background:    "var(--surface)",
    border:        "1px solid var(--border)",
    borderTop:     "3px solid",
    borderRadius:  "10px",
    padding:       "14px 14px 12px",
    display:       "flex",
    flexDirection: "column",
    gap:           "4px",
  },
  holdingPlatform: {
    fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
  },
  holdingAmount: {
    fontSize: "20px", fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums",
    marginTop: "6px",
  },
  holdingCurrency: {
    fontSize: "11px", fontWeight: 600, color: "var(--text-muted)",
  },
  holdingDate: {
    fontSize: "10px", color: "var(--text-muted)", marginTop: "4px",
  },
  holdingNoData: {
    fontSize: "12px", color: "var(--text-muted)", marginTop: "6px",
  },

  // Chart
  legendRow: {
    display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px",
  },
  legendChip: {
    fontSize: "11px", fontWeight: 600, padding: "3px 10px",
    borderRadius: "20px", border: "1.5px solid", cursor: "pointer",
    background: "transparent", transition: "opacity 0.15s",
  },
  tooltip: {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "8px", padding: "10px 14px", fontSize: "12px",
  },
  tooltipDate: {
    fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 600,
  },
  tooltipRow: {
    display: "flex", justifyContent: "space-between", gap: "16px",
  },
  tooltipVal: {
    fontWeight: 700, fontVariantNumeric: "tabular-nums",
  },

  // Section
  section: {
    display: "flex", flexDirection: "column", gap: "12px",
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "10px", padding: "18px 20px",
  },
  sectionHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
  },
  sectionTitle: {
    margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--text)",
  },
  addBtn: {
    background: "var(--accent)", border: "none", borderRadius: "8px",
    color: "#fff", fontSize: "12px", fontWeight: 600,
    padding: "7px 14px", cursor: "pointer", whiteSpace: "nowrap",
  },

  // Table
  tableWrap: {
    overflowX: "auto", borderRadius: "8px",
    border: "1px solid var(--border)",
  },
  table: {
    width: "100%", borderCollapse: "collapse", minWidth: "520px",
  },
  th: {
    fontSize: "10px", fontWeight: 600, color: "var(--text-muted)",
    textTransform: "uppercase", letterSpacing: "0.05em",
    padding: "8px 12px", borderBottom: "1px solid var(--border)",
    background: "var(--surface)", position: "sticky", top: 0, whiteSpace: "nowrap",
  },
  tr: { borderBottom: "1px solid var(--border)" },
  td: {
    padding: "9px 12px", fontSize: "13px", color: "var(--text)", whiteSpace: "nowrap",
  },
  typeBadge: {
    display: "inline-block", padding: "2px 8px", borderRadius: "10px",
    fontSize: "11px", fontWeight: 600, border: "1px solid",
  },
  typeDeposit: {
    background: "rgba(34,197,94,0.1)", color: "var(--success-text)",
    borderColor: "rgba(34,197,94,0.3)",
  },
  typeWithdraw: {
    background: "rgba(239,68,68,0.1)", color: "#ef4444",
    borderColor: "rgba(239,68,68,0.3)",
  },
  editBtn: {
    background: "transparent", border: "none", color: "var(--text-muted)",
    fontSize: "14px", cursor: "pointer", padding: "2px 6px", borderRadius: "4px",
  },
  deleteBtn: {
    background: "transparent", border: "none", color: "var(--text-muted)",
    fontSize: "12px", cursor: "pointer", padding: "2px 6px", borderRadius: "4px",
  },

  // Modal
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500,
  },
  modal: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px",
    width: "460px", maxWidth: "95vw", display: "flex", flexDirection: "column",
    boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
  },
  modalHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 20px 0",
  },
  modalTitle: { fontSize: "15px", fontWeight: 700, color: "var(--text)" },
  closeBtn: {
    background: "transparent", border: "none", color: "var(--text-muted)",
    fontSize: "14px", cursor: "pointer", padding: "4px 6px", borderRadius: "4px",
  },
  modalBody: {
    display: "flex", flexDirection: "column", gap: "14px", padding: "16px 20px 20px",
  },
  modalFooter: {
    display: "flex", justifyContent: "flex-end", gap: "10px",
    paddingTop: "8px",
  },
  row2: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px",
  },
  label: {
    fontSize: "11px", fontWeight: 600, color: "var(--text-muted)",
    textTransform: "uppercase", letterSpacing: "0.04em",
  },
  input: {
    background: "var(--surface-2, rgba(255,255,255,0.05))", border: "1px solid var(--border)",
    borderRadius: "7px", color: "var(--text)", fontSize: "13px",
    padding: "8px 10px", width: "100%", boxSizing: "border-box", outline: "none",
  },
  inputErr: { borderColor: "var(--danger, #ef4444)" },
  errText: { fontSize: "11px", color: "var(--danger, #ef4444)" },
  cancelBtn: {
    background: "transparent", border: "1px solid var(--border)", borderRadius: "7px",
    color: "var(--text-muted)", fontSize: "13px", padding: "7px 18px", cursor: "pointer",
  },
  saveBtn: {
    background: "var(--accent)", border: "none", borderRadius: "7px",
    color: "#fff", fontSize: "13px", fontWeight: 600, padding: "7px 18px", cursor: "pointer",
  },

  // Chart tooltip
  st: {},
};

const st = s; // alias for tooltip styles reuse
