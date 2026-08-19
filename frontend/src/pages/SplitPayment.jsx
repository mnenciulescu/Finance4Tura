import { useState, useEffect, useRef, useMemo } from "react";
import dayjs from "dayjs";
import {
  listSplitPayments,
  createSplitPayment,
  updateSplitPayment,
  deleteSplitPayment,
} from "../api/splitPayments";

// The whole page is a single phone-width column, rendered the same way on
// desktop and on mobile — same widths, paddings and font sizes everywhere.
const COL_WIDTH = "430px";

// ── Helpers ───────────────────────────────────────────────────────────────────

const CURRENCIES = ["RON", "EUR", "USD"];
const MAX_OCC    = 36;

const isFilled   = (o) => o != null && o.value !== "" && o.value != null;
const num        = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const round2     = (n) => Math.round(n * 100) / 100;
const fmt        = (n) => Number(n).toLocaleString("ro-RO", { maximumFractionDigits: 2 });
const todayStr   = () => dayjs().format("YYYY-MM-DD");
const fmtDate    = (d) => (d ? dayjs(d).format("D MMM YYYY") : "—");

/** Always return a dense occurrences array of length occurrenceCount. */
function normOccs(entry) {
  const src   = entry.occurrences ?? [];
  const count = entry.occurrenceCount || src.length || 0;
  return Array.from({ length: count }, (_, i) => ({ index: i, value: src[i]?.value ?? "" }));
}

function stats(entry) {
  const occs    = normOccs(entry);
  const paid    = occs.filter(isFilled).length;
  const covered = entry.occurrenceType === "amount" ? occs.reduce((sum, o) => sum + num(o.value), 0) : 0;
  return {
    occs,
    paid,
    count:     occs.length,
    covered,
    remaining: Math.max(0, round2(Number(entry.totalAmount || 0) - covered)),
    complete:  occs.length > 0 && paid === occs.length,
  };
}

/** Even split of what is still uncovered across the still-empty occurrences. */
function suggestValue(entry) {
  const { occs, covered } = stats(entry);
  const empties = occs.filter(o => !isFilled(o)).length;
  if (empties === 0) return 0;
  return Math.max(0, round2((Number(entry.totalAmount || 0) - covered) / empties));
}

function defaultForm() {
  return {
    date:            todayStr(),
    title:           "",
    amount:          "",
    currency:        "RON",
    occurrenceCount: 2,
    occurrenceType:  "amount",
  };
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SplitPayment() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  // Explicit expand/collapse overrides — default is "open expanded, done collapsed"
  const [overrides, setOverrides] = useState({});
  const [showDone, setShowDone]   = useState(false);

  // Modal: { mode: "create" | "edit", entry }
  const [modal, setModal]   = useState(null);
  const [form, setForm]     = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [confirmId, setConfirmId] = useState(null);
  const confirmTimer = useRef(null);
  const saveTimers   = useRef({});

  useEffect(() => {
    listSplitPayments()
      .then(setEntries)
      .catch(e => { console.error(e); setError("Could not load split payments."); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => () => {
    clearTimeout(confirmTimer.current);
    Object.values(saveTimers.current).forEach(clearTimeout);
  }, []);

  const { open, done } = useMemo(() => {
    const sorted = [...entries].sort((a, b) => (b.createdDate || "").localeCompare(a.createdDate || ""));
    return {
      open: sorted.filter(e => !stats(e).complete),
      done: sorted.filter(e =>  stats(e).complete),
    };
  }, [entries]);

  const outstanding = useMemo(() => {
    const acc = {};
    open.forEach(e => {
      if (e.occurrenceType !== "amount") return;
      acc[e.currency] = round2((acc[e.currency] ?? 0) + stats(e).remaining);
    });
    return Object.entries(acc).filter(([, v]) => v > 0);
  }, [open]);

  // ── Coverage editing ────────────────────────────────────────────────────────

  function persist(entryId, occurrences) {
    clearTimeout(saveTimers.current[entryId]);
    saveTimers.current[entryId] = setTimeout(() => {
      updateSplitPayment(entryId, { occurrences })
        .catch(e => { console.error(e); setError("Could not save the change."); });
    }, 600);
  }

  function applyOccs(entryId, mapper) {
    const updated = entries.map(e =>
      e.splitPaymentId !== entryId ? e : { ...e, occurrences: mapper(normOccs(e), e) }
    );
    setEntries(updated);
    const entry = updated.find(e => e.splitPaymentId === entryId);
    if (entry) persist(entryId, entry.occurrences);
  }

  const setOcc = (entryId, idx, value) =>
    applyOccs(entryId, occs => occs.map((o, i) => (i === idx ? { ...o, value } : o)));

  function quickFill(entry, idx) {
    const value = entry.occurrenceType === "amount" ? String(suggestValue(entry)) : todayStr();
    setOcc(entry.splitPaymentId, idx, value);
  }

  /** Fill every still-empty occurrence; for amounts the last one absorbs the rounding rest. */
  function fillRemaining(entry) {
    applyOccs(entry.splitPaymentId, (occs, e) => {
      if (e.occurrenceType !== "amount") {
        return occs.map(o => (isFilled(o) ? o : { ...o, value: todayStr() }));
      }
      const covered  = occs.reduce((sum, o) => sum + num(o.value), 0);
      const emptyIdx = occs.map((o, i) => (isFilled(o) ? -1 : i)).filter(i => i >= 0);
      if (emptyIdx.length === 0) return occs;
      const each = Math.max(0, round2((Number(e.totalAmount || 0) - covered) / emptyIdx.length));
      const next = [...occs];
      let   used = 0;
      emptyIdx.forEach((i, k) => {
        const last  = k === emptyIdx.length - 1;
        const value = last
          ? Math.max(0, round2(Number(e.totalAmount || 0) - covered - used))
          : each;
        used += value;
        next[i] = { ...next[i], value: String(value) };
      });
      return next;
    });
  }

  const clearAll = (entry) =>
    applyOccs(entry.splitPaymentId, occs => occs.map(o => ({ ...o, value: "" })));

  // ── Entry CRUD ──────────────────────────────────────────────────────────────

  function openCreate() {
    setForm(defaultForm());
    setErrors({});
    setModal({ mode: "create" });
  }

  function openEdit(entry) {
    setForm({
      date:            entry.createdDate || todayStr(),
      title:           entry.title ?? "",
      amount:          String(entry.totalAmount ?? ""),
      currency:        entry.currency || "RON",
      occurrenceCount: entry.occurrenceCount || 1,
      occurrenceType:  entry.occurrenceType || "amount",
    });
    setErrors({});
    setModal({ mode: "edit", entry });
  }

  function closeModal() {
    setModal(null);
    setForm(defaultForm());
    setErrors({});
  }

  async function handleSubmit() {
    const errs = {};
    if (!form.title.trim())                                 errs.title           = "Required";
    if (!form.amount || +form.amount <= 0)                  errs.amount          = "Must be greater than 0";
    if (!form.occurrenceCount || +form.occurrenceCount < 1)  errs.occurrenceCount = "Min 1";
    if (+form.occurrenceCount > MAX_OCC)                    errs.occurrenceCount = `Max ${MAX_OCC}`;
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const count = Math.min(MAX_OCC, parseInt(form.occurrenceCount, 10));
    const base  = {
      createdDate:     form.date || todayStr(),
      title:           form.title.trim(),
      totalAmount:     parseFloat(form.amount),
      currency:        form.currency,
      occurrenceCount: count,
      occurrenceType:  form.occurrenceType,
    };

    setSaving(true);
    setError("");
    try {
      if (modal.mode === "create") {
        const entry = await createSplitPayment({
          ...base,
          occurrences: Array.from({ length: count }, (_, i) => ({ index: i, value: "" })),
        });
        setEntries(prev => [entry, ...prev]);
      } else {
        const prevOccs = normOccs(modal.entry);
        const saved    = await updateSplitPayment(modal.entry.splitPaymentId, {
          ...base,
          // keep values that survive a count change
          occurrences: Array.from({ length: count }, (_, i) => ({ index: i, value: prevOccs[i]?.value ?? "" })),
        });
        setEntries(prev => prev.map(e => (e.splitPaymentId === saved.splitPaymentId ? saved : e)));
      }
      closeModal();
    } catch (e) {
      console.error(e);
      setError("Could not save the split payment.");
    } finally {
      setSaving(false);
    }
  }

  function askDelete(id) {
    clearTimeout(confirmTimer.current);
    setConfirmId(id);
    confirmTimer.current = setTimeout(() => setConfirmId(null), 4000);
  }

  async function handleDelete(id) {
    clearTimeout(confirmTimer.current);
    setConfirmId(null);
    try {
      await deleteSplitPayment(id);
      setEntries(prev => prev.filter(e => e.splitPaymentId !== id));
    } catch (e) {
      console.error(e);
      setError("Could not delete the split payment.");
    }
  }

  const isExpanded = (entry, complete) => overrides[entry.splitPaymentId] ?? !complete;
  const toggle = (entry, complete) =>
    setOverrides(prev => ({ ...prev, [entry.splitPaymentId]: !(prev[entry.splitPaymentId] ?? !complete) }));

  // ── Render ──────────────────────────────────────────────────────────────────

  const cardProps = {
    onToggle:    toggle,
    onSetOcc:    setOcc,
    onQuickFill: quickFill,
    onFillRest:  fillRemaining,
    onClearAll:  clearAll,
    onEdit:      openEdit,
    onAskDelete: askDelete,
    onDelete:    handleDelete,
    confirmId,
  };

  return (
    <div style={s.page}>
      <div style={s.column}>

        <div style={s.header}>
          <div style={{ minWidth: 0 }}>
            <h2 style={s.title}>Split Pay</h2>
            <p style={s.subtitle}>
              {open.length} open · {done.length} settled
              {outstanding.length > 0 && (
                <> · left to cover {outstanding.map(([cur, v]) => `${fmt(v)} ${cur}`).join(" · ")}</>
              )}
            </p>
          </div>
          <button style={s.addBtn} onClick={openCreate}>
            <span style={{ fontSize: "17px", lineHeight: 1 }}>+</span>
            New
          </button>
        </div>

        {error && (
          <div style={s.errorBox} onClick={() => setError("")}>
            {error} <span style={{ opacity: 0.6 }}>(tap to dismiss)</span>
          </div>
        )}

        <div style={s.scroll}>
          {loading ? (
            <div style={s.empty}>Loading…</div>
          ) : entries.length === 0 ? (
            <div style={s.empty}>
              No split payments yet.<br />
              <button style={{ ...s.addBtn, marginTop: "14px" }} onClick={openCreate}>+ Add your first one</button>
            </div>
          ) : (
            <>
              {open.length > 0 && (
                <>
                  <div style={s.sectionLabel}>In progress · {open.length}</div>
                  {open.map(entry => (
                    <EntryCard key={entry.splitPaymentId} entry={entry} expanded={isExpanded(entry, false)} {...cardProps} />
                  ))}
                </>
              )}

              {done.length > 0 && (
                <>
                  <button style={s.sectionToggle} onClick={() => setShowDone(v => !v)}>
                    <span>Settled · {done.length}</span>
                    <Chevron open={showDone} />
                  </button>
                  {showDone && done.map(entry => (
                    <EntryCard key={entry.splitPaymentId} entry={entry} expanded={isExpanded(entry, true)} {...cardProps} />
                  ))}
                </>
              )}
            </>
          )}
        </div>

      </div>

      {modal && (
        <EntryModal
          mode={modal.mode}
          entry={modal.entry}
          form={form}
          setForm={setForm}
          errors={errors}
          saving={saving}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

// ── Entry card ────────────────────────────────────────────────────────────────

function EntryCard({
  entry, expanded, confirmId,
  onToggle, onSetOcc, onQuickFill, onFillRest, onClearAll, onEdit, onAskDelete, onDelete,
}) {
  const { occs, paid, count, covered, remaining, complete } = stats(entry);
  const isAmount   = entry.occurrenceType === "amount";
  const pct        = count ? Math.round((paid / count) * 100) : 0;
  const id         = entry.splitPaymentId;
  const confirming = confirmId === id;

  return (
    <div style={s.card(complete)}>
      {/* Head — tap anywhere to expand / collapse */}
      <div style={s.cardHead} onClick={() => onToggle(entry, complete)} role="button" tabIndex={0}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.cardTitleRow}>
            <span style={s.cardTitle}>{entry.title}</span>
            <span style={s.badge(complete)}>{paid}/{count}{complete ? " ✓" : ""}</span>
          </div>
          <div style={s.cardMeta}>
            <span>{fmtDate(entry.createdDate)}</span>
            <span style={s.dot}>·</span>
            <span style={s.metaAmount}>{fmt(entry.totalAmount)} {entry.currency}</span>
            {isAmount && !complete && (
              <>
                <span style={s.dot}>·</span>
                <span style={s.metaLeft}>{fmt(remaining)} left</span>
              </>
            )}
          </div>
        </div>
        <Chevron open={expanded} />
      </div>

      <div style={s.track}>
        <div style={s.trackFill(pct, complete)} />
      </div>

      {expanded && (
        <div style={s.cardBody}>
          <div style={s.grid(isAmount)}>
            {occs.map((occ, i) => {
              const filled = isFilled(occ);
              return (
                <div key={i} style={s.occ(filled)}>
                  <span style={s.occIdx(filled)}>{i + 1}</span>
                  <input
                    type={isAmount ? "number" : "date"}
                    inputMode={isAmount ? "decimal" : undefined}
                    value={occ.value ?? ""}
                    min={isAmount ? "0" : undefined}
                    step={isAmount ? "any" : undefined}
                    placeholder={isAmount ? "0.00" : undefined}
                    onChange={e => onSetOcc(id, i, e.target.value)}
                    style={s.occInput(filled)}
                  />
                  <button
                    style={s.occAction(filled)}
                    title={filled ? "Clear" : (isAmount ? "Fill suggested amount" : "Set today")}
                    onClick={() => (filled ? onSetOcc(id, i, "") : onQuickFill(entry, i))}
                  >
                    {filled ? "✕" : "+"}
                  </button>
                </div>
              );
            })}
          </div>

          <div style={s.actions}>
            {!complete && (
              <button style={s.actionPrimary} onClick={() => onFillRest(entry)}>
                {isAmount ? `Cover rest (${fmt(remaining)} ${entry.currency})` : "Set remaining to today"}
              </button>
            )}
            {paid > 0 && <button style={s.action} onClick={() => onClearAll(entry)}>Clear all</button>}
            <button style={s.action} onClick={() => onEdit(entry)}>Edit</button>
            <span style={{ flex: 1 }} />
            <button
              style={confirming ? s.actionDangerActive : s.actionDanger}
              onClick={() => (confirming ? onDelete(id) : onAskDelete(id))}
            >
              {confirming ? "Tap to confirm" : "Delete"}
            </button>
          </div>

          {isAmount && (
            <div style={s.coverLine}>
              Covered <strong style={{ color: "var(--text)" }}>{fmt(covered)}</strong> of {fmt(entry.totalAmount)} {entry.currency}
              {covered > Number(entry.totalAmount || 0) && (
                <span style={s.over}> · over by {fmt(round2(covered - entry.totalAmount))}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Chevron({ open }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
         style={{ color: "var(--text-muted)", flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.18s" }}>
      <polyline points="4,6 8,10 12,6" />
    </svg>
  );
}

// ── Add / edit sheet ──────────────────────────────────────────────────────────

function EntryModal({ mode, entry, form, setForm, errors, saving, onClose, onSubmit }) {
  const field = (key) => ({
    value:    form[key],
    onChange: e => setForm(f => ({ ...f, [key]: e.target.value })),
  });
  const lockedType = mode === "edit" && entry && stats(entry).paid > 0;

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.sheet} onClick={e => e.stopPropagation()}>
        <div style={s.grabber} />

        <div style={s.sheetHead}>
          <span style={s.sheetTitle}>{mode === "create" ? "New Split Payment" : "Edit Split Payment"}</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={s.sheetBody}>
          <Field label="Title" error={errors.title}>
            <input style={s.input(errors.title)} placeholder="e.g. Car loan, Laptop instalments" {...field("title")} />
          </Field>

          <Field label="Date">
            <input style={s.input()} type="date" {...field("date")} />
          </Field>

          <div style={s.row2}>
            <Field label="Total amount" error={errors.amount}>
              <input style={s.input(errors.amount)} type="number" inputMode="decimal" min="0" step="any" placeholder="0" {...field("amount")} />
            </Field>
            <Field label="Currency">
              <select style={s.input()} {...field("currency")}>
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>

          <div style={s.row2}>
            <Field label="Occurrences" error={errors.occurrenceCount}>
              <input style={s.input(errors.occurrenceCount)} type="number" inputMode="numeric" min="1" max={MAX_OCC} {...field("occurrenceCount")} />
            </Field>
            <Field label="Track by" error={lockedType ? "Locked — entries exist" : undefined}>
              <select style={s.input()} disabled={lockedType} {...field("occurrenceType")}>
                <option value="amount">Amount paid</option>
                <option value="date">Payment date</option>
              </select>
            </Field>
          </div>
        </div>

        <div style={s.sheetFoot}>
          <button style={s.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={s.saveBtn} onClick={onSubmit} disabled={saving}>
            {saving ? "Saving…" : mode === "create" ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px", minWidth: 0 }}>
      <label style={s.label}>{label}</label>
      {children}
      {error && <span style={s.fieldErr}>{error}</span>}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const GREEN_BG     = "rgba(34,197,94,0.10)";
const GREEN_BORDER = "rgba(34,197,94,0.35)";

const s = {
  // Centered phone-width column — identical on desktop and mobile
  page: {
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    flex:           1,
    minHeight:      0,
  },
  column: {
    display:       "flex",
    flexDirection: "column",
    width:         "100%",
    maxWidth:      COL_WIDTH,
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
  title: {
    margin:     0,
    fontSize:   "17px",
    fontWeight: 700,
    color:      "var(--text)",
  },
  subtitle: {
    margin:   "3px 0 0",
    fontSize: "12px",
    color:    "var(--text-muted)",
  },
  addBtn: {
    display:      "inline-flex",
    alignItems:   "center",
    gap:          "6px",
    flexShrink:   0,
    background:   "var(--accent)",
    border:       "none",
    borderRadius: "9px",
    color:        "#fff",
    fontSize:     "13px",
    fontWeight:   600,
    padding:      "10px 14px",
    minHeight:    "42px",
    cursor:       "pointer",
    whiteSpace:   "nowrap",
  },

  errorBox: {
    flexShrink:   0,
    margin:       "10px 12px 0",
    background:   "var(--error-bg)",
    color:        "var(--error-text)",
    border:       "1px solid var(--danger)",
    borderRadius: "8px",
    padding:      "9px 12px",
    fontSize:     "12px",
    cursor:       "pointer",
  },

  scroll: {
    flex:          1,
    minHeight:     0,
    overflowY:     "auto",
    WebkitOverflowScrolling: "touch",
    display:       "flex",
    flexDirection: "column",
    gap:           "10px",
    padding:       "12px 12px 24px",
  },

  empty: {
    background:   "var(--surface)",
    border:       "1px solid var(--border)",
    borderRadius: "12px",
    padding:      "34px 20px",
    color:        "var(--text-muted)",
    fontSize:     "13px",
    textAlign:    "center",
    lineHeight:   1.7,
  },

  sectionLabel: {
    fontSize:      "11px",
    fontWeight:    700,
    color:         "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    padding:       "2px 2px 0",
  },
  sectionToggle: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    width:          "100%",
    background:     "transparent",
    border:         "none",
    borderTop:      "1px solid var(--border)",
    color:          "var(--text-muted)",
    fontSize:       "11px",
    fontWeight:     700,
    textTransform:  "uppercase",
    letterSpacing:  "0.06em",
    padding:        "14px 2px 4px",
    marginTop:      "6px",
    cursor:         "pointer",
  },

  // ── Card
  card: (done) => ({
    background:   "var(--surface)",
    border:       `1px solid ${done ? GREEN_BORDER : "var(--border)"}`,
    borderRadius: "12px",
    overflow:     "hidden",
    flexShrink:   0,
  }),
  cardHead: {
    display:    "flex",
    alignItems: "center",
    gap:        "10px",
    padding:    "12px 13px",
    cursor:     "pointer",
    userSelect: "none",
  },
  cardTitleRow: {
    display:    "flex",
    alignItems: "center",
    gap:        "8px",
    minWidth:   0,
  },
  cardTitle: {
    fontSize:     "14px",
    fontWeight:   600,
    color:        "var(--text)",
    overflow:     "hidden",
    textOverflow: "ellipsis",
    whiteSpace:   "nowrap",
    minWidth:     0,
  },
  cardMeta: {
    display:    "flex",
    alignItems: "center",
    flexWrap:   "wrap",
    gap:        "5px",
    marginTop:  "4px",
    fontSize:   "12px",
    color:      "var(--text-muted)",
  },
  dot:        { opacity: 0.5 },
  metaAmount: { fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "var(--text)" },
  metaLeft:   { fontVariantNumeric: "tabular-nums", color: "var(--warning-text)" },

  badge: (done) => ({
    flexShrink:   0,
    padding:      "2px 8px",
    borderRadius: "10px",
    fontSize:     "11px",
    fontWeight:   700,
    whiteSpace:   "nowrap",
    fontVariantNumeric: "tabular-nums",
    ...(done
      ? { background: GREEN_BG, color: "var(--success-text)", border: `1px solid ${GREEN_BORDER}` }
      : { background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }),
  }),

  track: {
    height:     "3px",
    background: "var(--surface-2)",
  },
  trackFill: (pct, done) => ({
    height:     "100%",
    width:      `${pct}%`,
    background: done ? "var(--success)" : "var(--accent)",
    transition: "width 0.25s",
  }),

  cardBody: {
    display:       "flex",
    flexDirection: "column",
    gap:           "10px",
    padding:       "12px 13px 13px",
    borderTop:     "1px solid var(--border)",
  },

  // Fixed column counts so the grid never reflows between desktop and phone
  grid: (isAmount) => ({
    display:             "grid",
    gridTemplateColumns: isAmount ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)",
    gap:                 "8px",
  }),
  occ: (filled) => ({
    display:      "flex",
    alignItems:   "center",
    gap:          "6px",
    background:   filled ? GREEN_BG : "var(--surface-2)",
    border:       `1px solid ${filled ? GREEN_BORDER : "var(--border)"}`,
    borderRadius: "9px",
    padding:      "4px 5px 4px 7px",
  }),
  occIdx: (filled) => ({
    flexShrink: 0,
    fontSize:   "10px",
    fontWeight: 700,
    minWidth:   "16px",
    textAlign:  "center",
    color:      filled ? "var(--success-text)" : "var(--text-muted)",
  }),
  occInput: (filled) => ({
    flex:       1,
    minWidth:   0,
    width:      "100%",
    background: "transparent",
    border:     "none",
    outline:    "none",
    color:      filled ? "var(--text)" : "var(--text-muted)",
    fontSize:   "16px",   // 16px keeps iOS from zooming on focus
    fontWeight: 600,
    padding:    "7px 0",
    fontVariantNumeric: "tabular-nums",
  }),
  occAction: (filled) => ({
    flexShrink:     0,
    width:          "28px",
    height:         "28px",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    background:     "transparent",
    border:         "none",
    borderRadius:   "7px",
    color:          filled ? "var(--text-muted)" : "var(--accent)",
    fontSize:       filled ? "12px" : "17px",
    lineHeight:     1,
    cursor:         "pointer",
  }),

  actions: {
    display:    "flex",
    alignItems: "center",
    flexWrap:   "wrap",
    gap:        "8px",
  },
  action: {
    background:   "transparent",
    border:       "1px solid var(--border)",
    borderRadius: "8px",
    color:        "var(--text-muted)",
    fontSize:     "12px",
    fontWeight:   600,
    padding:      "8px 12px",
    cursor:       "pointer",
  },
  actionPrimary: {
    background:   "var(--accent-tint-bg)",
    border:       "1px solid var(--accent-tint-border)",
    borderRadius: "8px",
    color:        "var(--badge-text)",
    fontSize:     "12px",
    fontWeight:   700,
    padding:      "8px 12px",
    cursor:       "pointer",
  },
  actionDanger: {
    background:   "transparent",
    border:       "1px solid var(--border)",
    borderRadius: "8px",
    color:        "var(--text-muted)",
    fontSize:     "12px",
    fontWeight:   600,
    padding:      "8px 12px",
    cursor:       "pointer",
  },
  actionDangerActive: {
    background:   "var(--error-bg)",
    border:       "1px solid var(--danger)",
    borderRadius: "8px",
    color:        "var(--error-text)",
    fontSize:     "12px",
    fontWeight:   700,
    padding:      "8px 12px",
    cursor:       "pointer",
  },

  coverLine: {
    fontSize: "12px",
    color:    "var(--text-muted)",
    fontVariantNumeric: "tabular-nums",
  },
  over: { color: "var(--warning-text)" },

  // ── Sheet / modal — bottom sheet at phone width, on desktop too
  overlay: {
    position:       "fixed",
    inset:          0,
    background:     "rgba(0,0,0,0.55)",
    display:        "flex",
    alignItems:     "flex-end",
    justifyContent: "center",
    zIndex:         500,
  },
  sheet: {
    background:    "var(--surface)",
    border:        "1px solid var(--border)",
    borderRadius:  "16px 16px 0 0",
    width:         "100%",
    maxWidth:      COL_WIDTH,
    maxHeight:     "92dvh",
    display:       "flex",
    flexDirection: "column",
    overflow:      "hidden",
    boxShadow:     "0 -6px 40px rgba(0,0,0,0.45)",
  },
  grabber: {
    width:        "38px",
    height:       "4px",
    borderRadius: "2px",
    background:   "var(--border)",
    margin:       "8px auto 0",
    flexShrink:   0,
  },
  sheetHead: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    padding:        "14px 18px 0",
    flexShrink:     0,
  },
  sheetTitle: {
    fontSize:   "15px",
    fontWeight: 700,
    color:      "var(--text)",
  },
  closeBtn: {
    background: "transparent",
    border:     "none",
    color:      "var(--text-muted)",
    fontSize:   "15px",
    cursor:     "pointer",
    padding:    "6px 8px",
  },
  sheetBody: {
    display:       "flex",
    flexDirection: "column",
    gap:           "13px",
    padding:       "14px 18px 18px",
    overflowY:     "auto",
    minHeight:     0,
  },
  sheetFoot: {
    display:             "grid",
    gridTemplateColumns: "1fr 1fr",
    gap:                 "10px",
    padding:             "12px 18px calc(16px + env(safe-area-inset-bottom))",
    borderTop:           "1px solid var(--border)",
    flexShrink:          0,
  },
  row2: {
    display:             "grid",
    gridTemplateColumns: "1fr 1fr",
    gap:                 "12px",
  },
  label: {
    fontSize:      "11px",
    fontWeight:    600,
    color:         "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  input: (err) => ({
    background:   "var(--surface-2)",
    border:       `1px solid ${err ? "var(--danger)" : "var(--border)"}`,
    borderRadius: "9px",
    color:        "var(--text)",
    fontSize:     "16px",
    padding:      "11px 12px",
    width:        "100%",
    boxSizing:    "border-box",
    outline:      "none",
  }),
  fieldErr: {
    fontSize: "11px",
    color:    "var(--danger)",
  },
  cancelBtn: {
    background:   "transparent",
    border:       "1px solid var(--border)",
    borderRadius: "9px",
    color:        "var(--text-muted)",
    fontSize:     "13px",
    fontWeight:   600,
    padding:      "12px 16px",
    cursor:       "pointer",
  },
  saveBtn: {
    background:   "var(--accent)",
    border:       "none",
    borderRadius: "9px",
    color:        "#fff",
    fontSize:     "13px",
    fontWeight:   700,
    padding:      "12px 16px",
    cursor:       "pointer",
  },
};
