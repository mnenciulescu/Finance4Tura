import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getExpense, createExpense, updateExpense, updateExpenseSeries, resolveIncome } from "../api/expenses";
import Field from "../components/Field";
import dayjs from "dayjs";

const PRIORITY_COLORS = { High: "#ef4444", Medium: "#f59e0b", Low: "#22c55e" };

const EMPTY = {
  summary:         "",
  amount:          "",
  currency:        "RON",
  priority:        "Medium",
  status:          "Pending",
  special:         false,
  isRepeatable:    false,
  repeatFrequency: "monthly",
  seriesEndDate:   "",
};

export default function AddExpense() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId      = searchParams.get("id");
  const isEdit      = Boolean(editId);
  const prefillDate = searchParams.get("date");

  const [form, setForm]                 = useState(() => ({ ...EMPTY, date: prefillDate || dayjs().format("YYYY-MM-DD") }));
  const [isPartOfSeries, setIsPartOfSeries] = useState(false);
  const [seriesMode, setSeriesMode]     = useState("single");
  const [loading, setLoading]           = useState(false);
  const [fetching, setFetching]         = useState(isEdit);
  const [error, setError]               = useState(null);
  const [mappedIncome, setMappedIncome] = useState(null);  // income preview
  const [resolving, setResolving]       = useState(false);
  const debounceRef                     = useRef(null);

  // Load existing expense when editing
  useEffect(() => {
    if (!editId) return;
    getExpense(editId)
      .then(data => {
        setForm({
          summary:         data.summary         ?? "",
          date:            data.date             ?? "",
          amount:          data.amount           ?? "",
          currency:        data.currency         ?? "RON",
          priority:        data.priority         ?? "Medium",
          status:          data.status           ?? "Pending",
          special:         data.special          ?? false,
          isRepeatable:    data.isRepeatable     ?? false,
          repeatFrequency: data.repeatFrequency  ?? "monthly",
          seriesEndDate:   data.seriesEndDate    ?? "",
        });
        setIsPartOfSeries(data.seriesId !== data.expenseId);
        // Prefill mapped income from denormalized fields
        if (data.mappedIncomeId) {
          setMappedIncome({
            incomeId: data.mappedIncomeId,
            summary:  data.mappedIncomeSummary,
            date:     data.mappedIncomeDate,
          });
        }
      })
      .catch(() => setError("Could not load expense."))
      .finally(() => setFetching(false));
  }, [editId]);

  // Real-time income mapping preview — debounced 400ms on date change
  useEffect(() => {
    if (!form.date) { setMappedIncome(null); return; }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setResolving(true);
      resolveIncome(form.date)
        .then(data => setMappedIncome(data.income))
        .catch(() => setMappedIncome(null))
        .finally(() => setResolving(false));
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [form.date]);

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const payload = {
      summary:      form.summary.trim(),
      date:         form.date,
      amount:       parseFloat(form.amount),
      currency:     form.currency,
      priority:     form.priority,
      status:       form.status,
      special:      form.special,
      isRepeatable: form.isRepeatable,
      ...(form.isRepeatable ? {
        repeatFrequency: form.repeatFrequency,
        seriesEndDate:   form.seriesEndDate,
      } : {}),
    };

    if (!payload.summary || !payload.date || isNaN(payload.amount)) {
      setError("Summary, date and amount are required.");
      return;
    }
    const minDate = dayjs().subtract(1, "year").format("YYYY-MM-DD");
    const maxDate = dayjs().add(1, "year").format("YYYY-MM-DD");
    if (payload.date < minDate || payload.date > maxDate) {
      setError("Date must be within 1 year of today.");
      return;
    }
    if (form.isRepeatable && !form.seriesEndDate) {
      setError("Series end date is required for repeating expenses.");
      return;
    }
    if (form.isRepeatable && form.seriesEndDate > dayjs().add(1, "year").format("YYYY-MM-DD")) {
      setError("Series end date cannot be more than 1 year from today.");
      return;
    }

    setLoading(true);
    try {
      if (!isEdit) {
        await createExpense(payload);
      } else if (isPartOfSeries && seriesMode === "series") {
        await updateExpenseSeries(editId, payload);
      } else {
        await updateExpense(editId, payload);
      }
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (fetching) return <div style={s.outer}><div style={s.card}><p style={s.muted}>Loading…</p></div></div>;

  return (
    <div style={s.outer}>
      <div style={s.card}>
      <h1 style={s.title}>{isEdit ? "Edit Expense" : "Add Expense"}</h1>

      {error && <div style={s.errorBox}>{error}</div>}

      <form onSubmit={handleSubmit} style={s.form}>

        {/* Summary */}
        <Field label="Summary *">
          <input
            style={s.input}
            type="text"
            placeholder="e.g. Electricity bill"
            value={form.summary}
            onChange={e => set("summary", e.target.value)}
            required
          />
        </Field>

        {/* Amount + Currency */}
        <Field label="Amount *">
          <div style={s.row}>
            <input
              style={{ ...s.input, flex: 1 }}
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={e => set("amount", e.target.value)}
              required
            />
            <select
              style={{ ...s.input, ...s.select }}
              value={form.currency}
              onChange={e => set("currency", e.target.value)}
            >
              <option value="RON">RON</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </Field>

        {/* Date */}
        <Field label="Date *">
          <input
            style={s.input}
            type="date"
            value={form.date}
            onChange={e => set("date", e.target.value)}
            min={dayjs().subtract(1, "year").format("YYYY-MM-DD")}
            max={dayjs().add(1, "year").format("YYYY-MM-DD")}
            required
          />
        </Field>

        {/* Income mapping preview */}
        <IncomeMappingPreview income={mappedIncome} resolving={resolving} />

        {/* Priority */}
        <Field label="Priority">
          <div style={s.pillGroup}>
            {["High", "Medium", "Low"].map(p => (
              <button
                key={p}
                type="button"
                style={{ ...s.pill, ...(form.priority === p ? s.pillActive(p) : {}) }}
                onClick={() => set("priority", p)}
              >
                {p}
              </button>
            ))}
          </div>
        </Field>

        {/* Status */}
        <Field label="Status">
          <div style={s.pillGroup}>
            {["Pending", "Completed"].map(st => (
              <button
                key={st}
                type="button"
                style={{ ...s.pill, ...(form.status === st ? s.pillStatusActive : {}) }}
                onClick={() => set("status", st)}
              >
                {st}
              </button>
            ))}
          </div>
        </Field>

        {/* Special */}
        <Field label="Special">
          <div style={s.pillGroup}>
            {[false, true].map(val => (
              <button
                key={String(val)}
                type="button"
                style={{ ...s.pill, ...(form.special === val ? s.pillSpecialActive(val) : {}) }}
                onClick={() => set("special", val)}
              >
                {val ? "Yes" : "No"}
              </button>
            ))}
          </div>
        </Field>

        {/* Repeatable toggle — only on create */}
        {!isEdit && (
          <Field label="">
            <label style={s.checkLabel}>
              <input
                type="checkbox"
                checked={form.isRepeatable}
                onChange={e => {
                  const checked = e.target.checked;
                  setForm(prev => ({
                    ...prev,
                    isRepeatable: checked,
                    seriesEndDate: checked && !prev.seriesEndDate
                      ? dayjs().endOf("year").format("YYYY-MM-DD")
                      : prev.seriesEndDate,
                  }));
                }}
              />
              Repeating expense
            </label>
          </Field>
        )}

        {/* Repeat options */}
        {form.isRepeatable && (
          <>
            <Field label="Frequency">
              <select
                style={{ ...s.input, ...s.select }}
                value={form.repeatFrequency}
                onChange={e => set("repeatFrequency", e.target.value)}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </Field>

            <Field label="Series end date *">
              <input
                style={s.input}
                type="date"
                value={form.seriesEndDate}
                onChange={e => set("seriesEndDate", e.target.value)}
                min={form.date}
                max={dayjs().add(1, "year").format("YYYY-MM-DD")}
                required={form.isRepeatable}
              />
            </Field>
          </>
        )}

        {/* Series edit scope — only when editing a series member */}
        {isEdit && isPartOfSeries && (
          <Field label="Edit scope">
            <div style={s.radioGroup}>
              <label style={s.radioLabel}>
                <input
                  type="radio"
                  name="seriesMode"
                  value="single"
                  checked={seriesMode === "single"}
                  onChange={() => setSeriesMode("single")}
                />
                This occurrence only
              </label>
              <label style={s.radioLabel}>
                <input
                  type="radio"
                  name="seriesMode"
                  value="series"
                  checked={seriesMode === "series"}
                  onChange={() => setSeriesMode("series")}
                />
                This and all future occurrences
              </label>
            </div>
          </Field>
        )}

        {/* Actions */}
        <div style={s.actions}>
          <button type="button" style={s.btnSecondary} onClick={() => navigate(-1)} disabled={loading}>
            Cancel
          </button>
          <button type="submit" style={s.btnPrimary} disabled={loading}>
            {loading ? "Saving…" : isEdit ? "Save changes" : "Add expense"}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}

function IncomeMappingPreview({ income, resolving }) {
  if (resolving) {
    return <div style={s.previewBox}><span style={s.muted}>Resolving income…</span></div>;
  } else if (income === null) {
    return (
      <div style={{ ...s.previewBox, ...s.previewNone }}>
        <span style={s.previewIcon}>⚠</span>
        <span>No income found before this date — expense will be unmapped.</span>
      </div>
    );
  } else if (income) {
    return (
      <div style={{ ...s.previewBox, ...s.previewFound }}>
        <span style={s.previewIcon}>↳</span>
        <span>
          Maps to <strong>{income.summary}</strong> ({income.date})
          {income.amount != null && ` · ${income.currency ?? ""} ${income.amount}`}
        </span>
      </div>
    );
  }
  return null;
}

const s = {
  outer: {
    display:        "flex",
    flex:           1,
    alignItems:     "flex-start",
    justifyContent: "center",
    overflowY:      "auto",
    padding:        "20px 0",
  },
  card: {
    width:        "100%",
    maxWidth:     "460px",
    background:   "var(--surface)",
    border:       "1px solid var(--border)",
    borderRadius: "14px",
    padding:      "20px 28px",
    boxShadow:    "0 4px 32px rgba(0,0,0,0.3)",
  },
  title:   { fontSize: "16px", fontWeight: 700, color: "var(--text)", marginBottom: "14px" },
  muted:   { color: "var(--text-muted)", fontSize: "12px" },
  form:    { display: "flex", flexDirection: "column", gap: "10px" },
  input: {
    background:   "var(--surface-2)",
    border:       "1px solid var(--border)",
    borderRadius: "8px",
    color:        "var(--text)",
    padding:      "6px 10px",
    fontSize:     "13px",
    outline:      "none",
    width:        "100%",
  },
  select:    { cursor: "pointer", width: "auto" },
  row:       { display: "flex", gap: "10px" },
  checkLabel: { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" },
  radioGroup: { display: "flex", flexDirection: "column", gap: "8px" },
  radioLabel: { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" },
  pillGroup:  { display: "flex", gap: "8px" },
  pill: {
    padding:      "5px 14px",
    borderRadius: "20px",
    border:       "1px solid var(--border)",
    background:   "transparent",
    color:        "var(--text-muted)",
    fontSize:     "12px",
    fontWeight:   500,
    transition:   "all 0.15s",
  },
  pillActive: (priority) => ({
    background:  PRIORITY_COLORS[priority] + "22",
    borderColor: PRIORITY_COLORS[priority],
    color:       PRIORITY_COLORS[priority],
  }),
  pillStatusActive: {
    background:  "var(--accent)" + "22",
    borderColor: "var(--accent)",
    color:       "var(--accent)",
  },
  pillSpecialActive: (val) => val ? {
    background:  "rgba(168,85,247,0.12)",
    borderColor: "#a855f7",
    color:       "#a855f7",
  } : {
    background:  "rgba(107,114,148,0.12)",
    borderColor: "var(--border)",
    color:       "var(--text-muted)",
  },
  previewBox: {
    display:      "flex",
    alignItems:   "center",
    gap:          "8px",
    padding:      "8px 12px",
    borderRadius: "8px",
    fontSize:     "12px",
    border:       "1px solid var(--border)",
    background:   "var(--surface-2)",
    color:        "var(--text-muted)",
  },
  previewFound: {
    borderColor: "var(--accent)",
    background:  "var(--success-bg)",
    color:       "var(--success-text)",
  },
  previewNone: {
    borderColor: "var(--warning)",
    background:  "var(--warning-bg)",
    color:       "var(--warning-text)",
  },
  previewIcon: { fontSize: "14px" },
  actions: {
    display:        "flex",
    justifyContent: "flex-end",
    gap:            "10px",
    paddingTop:     "4px",
    borderTop:      "1px solid var(--border)",
    marginTop:      "2px",
  },
  btnPrimary: {
    background:   "var(--accent)",
    color:        "#fff",
    border:       "none",
    borderRadius: "8px",
    padding:      "8px 20px",
    fontWeight:   600,
    fontSize:     "13px",
  },
  btnSecondary: {
    background:   "transparent",
    color:        "var(--text-muted)",
    border:       "1px solid var(--border)",
    borderRadius: "8px",
    padding:      "8px 20px",
    fontWeight:   500,
    fontSize:     "13px",
  },
  errorBox: {
    background:   "var(--error-bg)",
    border:       "1px solid var(--danger)",
    borderRadius: "8px",
    color:        "var(--error-text)",
    padding:      "10px 14px",
    fontSize:     "12px",
    marginBottom: "4px",
  },
};
