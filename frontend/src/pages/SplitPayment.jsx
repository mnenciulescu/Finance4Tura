import { useState } from "react";
import dayjs from "dayjs";

const STORAGE_KEY = "split_payments_v1";

function loadData() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? []; }
  catch { return []; }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function defaultForm() {
  return { title: "", amount: "", currency: "RON", occurrenceCount: 2, occurrenceType: "amount" };
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SplitPayment() {
  const [entries, setEntries] = useState(loadData);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(defaultForm);
  const [errors, setErrors]     = useState({});

  const maxOcc = entries.reduce((m, e) => Math.max(m, e.occurrenceCount), 0);

  function field(key) {
    return { value: form[key], onChange: e => setForm(f => ({ ...f, [key]: e.target.value })) };
  }

  function handleSave() {
    const errs = {};
    if (!form.title.trim())          errs.title  = "Required";
    if (!form.amount || +form.amount <= 0) errs.amount = "Must be > 0";
    if (!form.occurrenceCount || +form.occurrenceCount < 1) errs.occurrenceCount = "Min 1";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const count = Math.min(36, parseInt(form.occurrenceCount, 10));
    const entry = {
      id:              genId(),
      createdDate:     dayjs().format("YYYY-MM-DD"),
      title:           form.title.trim(),
      totalAmount:     parseFloat(form.amount),
      currency:        form.currency,
      occurrenceCount: count,
      occurrenceType:  form.occurrenceType,
      occurrences:     Array.from({ length: count }, (_, i) => ({ index: i, value: "" })),
    };
    const updated = [...entries, entry];
    setEntries(updated);
    saveData(updated);
    setShowForm(false);
    setForm(defaultForm());
    setErrors({});
  }

  function updateOcc(entryId, occIdx, value) {
    const updated = entries.map(e => {
      if (e.id !== entryId) return e;
      return {
        ...e,
        occurrences: e.occurrences.map((o, i) => i !== occIdx ? o : { ...o, value }),
      };
    });
    setEntries(updated);
    saveData(updated);
  }

  function deleteEntry(id) {
    const updated = entries.filter(e => e.id !== id);
    setEntries(updated);
    saveData(updated);
  }

  function handleClose() {
    setShowForm(false);
    setForm(defaultForm());
    setErrors({});
  }

  return (
    <div style={s.page}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={s.pageHeader}>
        <div>
          <h2 style={s.title}>Split Payments</h2>
          <p style={s.subtitle}>Track advance payments split across multiple occurrences and monitor full coverage.</p>
        </div>
        <button style={s.addBtn} onClick={() => setShowForm(true)}>+ Add New Split Payment</button>
      </div>

      {/* ── Table / empty state ─────────────────────────────────────────────── */}
      {entries.length === 0 ? (
        <div style={s.emptyState}>No split payments yet. Click <strong>Add New Split Payment</strong> to get started.</div>
      ) : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Date</th>
                <th style={s.th}>Title</th>
                <th style={{ ...s.th, textAlign: "right" }}>Amount</th>
                <th style={s.th}>Currency</th>
                {Array.from({ length: maxOcc }, (_, i) => (
                  <th key={i} style={{ ...s.th, ...s.thOcc }}>#{i + 1}</th>
                ))}
                <th style={s.th}>Coverage</th>
                <th style={s.th} />
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => {
                const isAmount  = entry.occurrenceType === "amount";
                const paidCount = entry.occurrences.filter(o => o.value !== "" && o.value != null).length;
                const isFull    = paidCount === entry.occurrenceCount;

                return (
                  <tr key={entry.id} style={s.tr}>
                    <td style={s.td}>{entry.createdDate}</td>
                    <td style={{ ...s.td, fontWeight: 500 }}>{entry.title}</td>
                    <td style={{ ...s.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {entry.totalAmount.toLocaleString("ro-RO")}
                    </td>
                    <td style={s.td}>{entry.currency}</td>

                    {Array.from({ length: maxOcc }, (_, i) => {
                      const occ = entry.occurrences[i];
                      if (!occ) return <td key={i} style={s.td} />;
                      const hasPaid = occ.value !== "" && occ.value != null;

                      return (
                        <td key={i} style={s.tdOcc}>
                          <input
                            type={isAmount ? "number" : "date"}
                            value={occ.value ?? ""}
                            min={isAmount ? "0" : undefined}
                            step={isAmount ? "any" : undefined}
                            placeholder={isAmount ? "0.00" : undefined}
                            onChange={e => updateOcc(entry.id, i, e.target.value)}
                            style={{ ...s.occInput, ...(isAmount ? {} : s.occInputDate), ...(hasPaid ? s.occInputPaid : {}) }}
                          />
                        </td>
                      );
                    })}

                    <td style={s.td}>
                      <span style={{ ...s.badge, ...(isFull ? s.badgeFull : s.badgePartial) }}>
                        {paidCount}/{entry.occurrenceCount}{isFull ? " ✓" : ""}
                      </span>
                    </td>
                    <td style={{ ...s.td, textAlign: "center" }}>
                      <button style={s.deleteBtn} title="Delete entry" onClick={() => deleteEntry(entry.id)}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal ───────────────────────────────────────────────────────────── */}
      {showForm && (
        <div style={s.overlay} onClick={handleClose}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>New Split Payment</span>
              <button style={s.closeBtn} onClick={handleClose}>✕</button>
            </div>

            <div style={s.modalBody}>
              {/* Date (read-only) */}
              <div style={s.dateRow}>
                <span style={s.dateLabel}>Created on</span>
                <span style={s.dateValue}>{dayjs().format("YYYY-MM-DD")}</span>
              </div>

              {/* Title */}
              <FormField label="Title *" error={errors.title}>
                <input style={{ ...s.input, ...(errors.title ? s.inputErr : {}) }}
                  placeholder="e.g. Car loan, Laptop instalments"
                  {...field("title")}
                />
              </FormField>

              {/* Amount + Currency */}
              <div style={s.row2}>
                <FormField label="Amount *" error={errors.amount}>
                  <input style={{ ...s.input, ...(errors.amount ? s.inputErr : {}) }}
                    type="number" min="0" step="any" placeholder="0"
                    {...field("amount")}
                  />
                </FormField>
                <FormField label="Currency">
                  <select style={s.input} {...field("currency")}>
                    <option>RON</option>
                    <option>EUR</option>
                    <option>USD</option>
                  </select>
                </FormField>
              </div>

              {/* Occurrences + Type */}
              <div style={s.row2}>
                <FormField label="No. of Occurrences *" error={errors.occurrenceCount}>
                  <input style={{ ...s.input, ...(errors.occurrenceCount ? s.inputErr : {}) }}
                    type="number" min="1" max="36"
                    {...field("occurrenceCount")}
                  />
                </FormField>
                <FormField label="Occurrence Type">
                  <select style={s.input} {...field("occurrenceType")}>
                    <option value="amount">Amount (equal installments)</option>
                    <option value="date">Date (payment dates)</option>
                  </select>
                </FormField>
              </div>
            </div>

            <div style={s.modalFooter}>
              <button style={s.cancelBtn} onClick={handleClose}>Cancel</button>
              <button style={s.saveBtn} onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FormField({ label, error, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <label style={sf.label}>{label}</label>
      {children}
      {error && <span style={sf.err}>{error}</span>}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  page: {
    display:       "flex",
    flexDirection: "column",
    flex:          1,
    minHeight:     0,
    gap:           "20px",
  },
  pageHeader: {
    display:        "flex",
    alignItems:     "flex-start",
    justifyContent: "space-between",
    gap:            "16px",
    flexShrink:     0,
  },
  title: {
    margin:     0,
    fontSize:   "20px",
    fontWeight: 700,
    color:      "var(--text)",
  },
  subtitle: {
    margin:    "4px 0 0",
    fontSize:  "13px",
    color:     "var(--text-muted)",
  },
  addBtn: {
    flexShrink:   0,
    background:   "var(--accent)",
    border:       "none",
    borderRadius: "8px",
    color:        "#fff",
    fontSize:     "13px",
    fontWeight:   600,
    padding:      "8px 16px",
    cursor:       "pointer",
    whiteSpace:   "nowrap",
  },
  emptyState: {
    background:   "var(--surface)",
    border:       "1px solid var(--border)",
    borderRadius: "10px",
    padding:      "32px 24px",
    color:        "var(--text-muted)",
    fontSize:     "13px",
    textAlign:    "center",
    flexShrink:   0,
  },
  tableWrap: {
    flex:          1,
    minHeight:     0,
    overflowX:     "auto",
    overflowY:     "auto",
    background:    "var(--surface)",
    border:        "1px solid var(--border)",
    borderRadius:  "10px",
  },
  table: {
    width:           "100%",
    borderCollapse:  "collapse",
    minWidth:        "600px",
  },
  th: {
    textAlign:     "left",
    fontSize:      "11px",
    fontWeight:    600,
    color:         "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    padding:       "10px 12px",
    borderBottom:  "1px solid var(--border)",
    whiteSpace:    "nowrap",
    background:    "var(--surface)",
    position:      "sticky",
    top:           0,
    zIndex:        1,
  },
  thOcc: {
    textAlign: "center",
    minWidth:  "90px",
  },
  tr: {
    borderBottom: "1px solid var(--border)",
  },
  td: {
    padding:   "10px 12px",
    fontSize:  "13px",
    color:     "var(--text)",
    whiteSpace:"nowrap",
  },
  tdOcc: {
    padding:   "6px 6px",
    textAlign: "center",
  },
  occInput: {
    width:        "110px",
    padding:      "5px 7px",
    borderRadius: "6px",
    fontSize:     "12px",
    fontWeight:   500,
    border:       "1px solid var(--border)",
    background:   "rgba(255,255,255,0.04)",
    color:        "var(--text-muted)",
    outline:      "none",
    boxSizing:    "border-box",
    fontVariantNumeric: "tabular-nums",
    transition:   "border-color 0.15s, background 0.15s, color 0.15s",
  },
  occInputDate: {
    width:      "118px",
  },
  occInputPaid: {
    background:  "rgba(34,197,94,0.10)",
    border:      "1px solid rgba(34,197,94,0.35)",
    color:       "var(--success-text)",
  },
  badge: {
    display:      "inline-block",
    padding:      "3px 8px",
    borderRadius: "10px",
    fontSize:     "11px",
    fontWeight:   600,
    whiteSpace:   "nowrap",
  },
  badgeFull: {
    background: "rgba(34,197,94,0.12)",
    color:      "var(--success-text)",
    border:     "1px solid rgba(34,197,94,0.3)",
  },
  badgePartial: {
    background: "rgba(255,255,255,0.05)",
    color:      "var(--text-muted)",
    border:     "1px solid var(--border)",
  },
  deleteBtn: {
    background:   "transparent",
    border:       "none",
    color:        "var(--text-muted)",
    fontSize:     "12px",
    cursor:       "pointer",
    padding:      "2px 6px",
    borderRadius: "4px",
    transition:   "color 0.15s",
  },
  // ── Modal
  overlay: {
    position:        "fixed",
    inset:           0,
    background:      "rgba(0,0,0,0.55)",
    display:         "flex",
    alignItems:      "center",
    justifyContent:  "center",
    zIndex:          500,
  },
  modal: {
    background:   "var(--surface)",
    border:       "1px solid var(--border)",
    borderRadius: "12px",
    width:        "480px",
    maxWidth:     "95vw",
    display:      "flex",
    flexDirection:"column",
    boxShadow:    "0 8px 40px rgba(0,0,0,0.4)",
  },
  modalHeader: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    padding:        "16px 20px 0",
  },
  modalTitle: {
    fontSize:   "15px",
    fontWeight: 700,
    color:      "var(--text)",
  },
  closeBtn: {
    background:   "transparent",
    border:       "none",
    color:        "var(--text-muted)",
    fontSize:     "14px",
    cursor:       "pointer",
    padding:      "4px 6px",
    borderRadius: "4px",
  },
  modalBody: {
    display:       "flex",
    flexDirection: "column",
    gap:           "14px",
    padding:       "16px 20px",
  },
  modalFooter: {
    display:        "flex",
    justifyContent: "flex-end",
    gap:            "10px",
    padding:        "12px 20px 16px",
    borderTop:      "1px solid var(--border)",
  },
  dateRow: {
    display:      "flex",
    alignItems:   "center",
    gap:          "10px",
    background:   "var(--surface-2, rgba(255,255,255,0.04))",
    border:       "1px solid var(--border)",
    borderRadius: "8px",
    padding:      "8px 12px",
  },
  dateLabel: {
    fontSize:  "11px",
    fontWeight: 600,
    color:     "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  dateValue: {
    fontSize:   "13px",
    fontWeight: 500,
    color:      "var(--text)",
    fontVariantNumeric: "tabular-nums",
  },
  row2: {
    display:             "grid",
    gridTemplateColumns: "1fr 1fr",
    gap:                 "12px",
  },
  input: {
    background:   "var(--surface-2, rgba(255,255,255,0.05))",
    border:       "1px solid var(--border)",
    borderRadius: "7px",
    color:        "var(--text)",
    fontSize:     "13px",
    padding:      "8px 10px",
    width:        "100%",
    boxSizing:    "border-box",
    outline:      "none",
  },
  inputErr: {
    borderColor: "var(--danger, #ef4444)",
  },
  cancelBtn: {
    background:   "transparent",
    border:       "1px solid var(--border)",
    borderRadius: "7px",
    color:        "var(--text-muted)",
    fontSize:     "13px",
    padding:      "7px 18px",
    cursor:       "pointer",
  },
  saveBtn: {
    background:   "var(--accent)",
    border:       "none",
    borderRadius: "7px",
    color:        "#fff",
    fontSize:     "13px",
    fontWeight:   600,
    padding:      "7px 18px",
    cursor:       "pointer",
  },
};

const sf = {
  label: {
    fontSize:      "11px",
    fontWeight:    600,
    color:         "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  err: {
    fontSize: "11px",
    color:    "var(--danger, #ef4444)",
  },
};
