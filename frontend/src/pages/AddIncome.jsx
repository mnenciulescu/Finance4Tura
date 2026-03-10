import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getIncome, createIncome, updateIncome, updateIncomeSeries } from "../api/incomes";
import Field from "../components/Field";
import dayjs from "dayjs";

const EMPTY = {
  summary: "",
  amount: "",
  currency: "RON",
  isRepeatable: false,
  repeatFrequency: "monthly",
  seriesEndDate: "",
};

export default function AddIncome() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("id");
  const isEdit = Boolean(editId);

  const [form, setForm]           = useState(() => ({ ...EMPTY, date: dayjs().format("YYYY-MM-DD") }));
  const [isPartOfSeries, setIsPartOfSeries] = useState(false);
  const [seriesMode, setSeriesMode]         = useState("single"); // "single" | "series"
  const [loading, setLoading]     = useState(false);
  const [fetching, setFetching]   = useState(isEdit);
  const [error, setError]         = useState(null);

  // Load existing income when editing
  useEffect(() => {
    if (!editId) return;
    getIncome(editId)
      .then(data => {
        setForm({
          summary:         data.summary         ?? "",
          date:            data.date             ?? "",
          amount:          data.amount           ?? "",
          currency:        data.currency         ?? "RON",
          isRepeatable:    data.isRepeatable     ?? false,
          repeatFrequency: data.repeatFrequency  ?? "monthly",
          seriesEndDate:   data.seriesEndDate    ?? "",
        });
        setIsPartOfSeries(data.seriesId !== data.incomeId);
      })
      .catch(() => setError("Could not load income."))
      .finally(() => setFetching(false));
  }, [editId]);

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const payload = {
      summary:  form.summary.trim(),
      date:     form.date,
      amount:   parseFloat(form.amount),
      currency: form.currency,
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
    const yearStart = dayjs().startOf("year").format("YYYY-MM-DD");
    const yearEnd   = dayjs().endOf("year").format("YYYY-MM-DD");
    if (payload.date < yearStart || payload.date > yearEnd) {
      setError(`Date must be within the current year (${dayjs().year()}).`);
      return;
    }
    if (form.isRepeatable && !form.seriesEndDate) {
      setError("Series end date is required for repeating incomes.");
      return;
    }
    if (form.isRepeatable && form.seriesEndDate > yearEnd) {
      setError(`Series end date must be within the current year (${dayjs().year()}).`);
      return;
    }

    setLoading(true);
    try {
      if (!isEdit) {
        await createIncome(payload);
      } else if (isPartOfSeries && seriesMode === "series") {
        await updateIncomeSeries(editId, payload);
      } else {
        await updateIncome(editId, payload);
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
      <h1 style={s.title}>{isEdit ? "Edit Income" : "Add Income"}</h1>

      {error && <div style={s.errorBox}>{error}</div>}

      <form onSubmit={handleSubmit} style={s.form}>

        {/* Summary */}
        <Field label="Summary *">
          <input
            style={s.input}
            type="text"
            placeholder="e.g. Monthly salary"
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
            min={dayjs().startOf("year").format("YYYY-MM-DD")}
            max={dayjs().endOf("year").format("YYYY-MM-DD")}
            required
          />
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
              Repeating income
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
                max={dayjs().endOf("year").format("YYYY-MM-DD")}
                required={form.isRepeatable}
              />
            </Field>
          </>
        )}

        {/* Series edit mode — only when editing a series member */}
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
            {loading ? "Saving…" : isEdit ? "Save changes" : "Add income"}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}

const s = {
  outer: {
    display:        "flex",
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
  },
  card: {
    width:        "100%",
    maxWidth:     "460px",
    background:   "var(--surface)",
    border:       "1px solid var(--border)",
    borderRadius: "14px",
    padding:      "28px 32px",
    boxShadow:    "0 4px 32px rgba(0,0,0,0.3)",
  },
  title:      { fontSize: "18px", fontWeight: 700, color: "var(--text)", marginBottom: "20px" },
  muted:      { color: "var(--text-muted)" },
  form:       { display: "flex", flexDirection: "column", gap: "14px" },
  input: {
    background:   "var(--surface-2)",
    border:       "1px solid var(--border)",
    borderRadius: "8px",
    color:        "var(--text)",
    padding:      "8px 11px",
    fontSize:     "13px",
    outline:      "none",
    width:        "100%",
  },
  select:     { cursor: "pointer", width: "auto" },
  row:        { display: "flex", gap: "10px" },
  checkLabel: { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" },
  radioGroup: { display: "flex", flexDirection: "column", gap: "8px" },
  radioLabel: { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" },
  actions: {
    display:        "flex",
    justifyContent: "flex-end",
    gap:            "10px",
    paddingTop:     "6px",
    borderTop:      "1px solid var(--border)",
    marginTop:      "4px",
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
