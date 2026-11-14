import { useEffect, useMemo, useState } from "react";
import {
  FormSheet, List, TextField, Picker, SegmentedControl, Toggle, DateField, ActionSheet, Button, FieldRow,
  ScreenSkeleton, Notice, useToast,
} from "../../../ui";
import { useExpense, useResolveIncome } from "../../../data/queries";
import { useDeleteExpense, useSaveExpense } from "../../../data/mutations";
import { PRIORITY_COLOR } from "../../../theme/domainColors";
import { parseAmount, sanitizeAmountInput } from "../../../utils/parseAmount";
import { fmtDate, fmtNum, todayIso } from "../../../utils/format";
import { useOnline } from "../../../app/useOnline";
import type { Currency, Expense, Frequency, Priority } from "../../../types";
import { validateEntry, yearBounds, type FormErrors } from "./validation";
import type { ExpenseFormTarget } from "./FormsContext";
import { CURRENCY_OPTIONS, FREQUENCY_OPTIONS } from "./options";
import s from "./Forms.module.css";

interface Form {
  summary: string; amount: string; currency: Currency; date: string;
  priority: Priority; status: "Pending" | "Completed"; special: boolean;
  isRepeatable: boolean; repeatFrequency: Frequency; seriesEndDate: string;
}

const EMPTY = (date?: string): Form => ({
  summary: "", amount: "", currency: "RON", date: date || todayIso(),
  priority: "Medium", status: "Pending", special: false,
  isRepeatable: false, repeatFrequency: "monthly", seriesEndDate: "",
});

const fromExpense = (e: Expense): Form => ({
  summary: e.summary ?? "", amount: e.amount != null ? String(e.amount) : "", currency: e.currency ?? "RON",
  date: e.date ?? "", priority: e.priority ?? "Medium", status: e.status ?? "Pending", special: !!e.special,
  isRepeatable: !!e.isRepeatable, repeatFrequency: e.repeatFrequency ?? "monthly", seriesEndDate: e.seriesEndDate ?? "",
});

const PRIORITY_OPTIONS = (["High", "Medium", "Low"] as Priority[]).map(p => ({ value: p, label: p, color: PRIORITY_COLOR[p] }));

/** Debounces a value (the mapped-income preview waits 400 ms, as before). */
function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = window.setTimeout(() => setV(value), ms); return () => window.clearTimeout(t); }, [value, ms]);
  return v;
}

export function ExpenseSheet({ target, onClose }: { target: ExpenseFormTarget | null; onClose: () => void }) {
  const editId = target?.id;
  const existing = useExpense(editId);
  return (
    <ExpenseForm
      key={existing.data?.expenseId ?? "new"}
      isOpen={!!target}
      onClose={onClose}
      expense={editId ? existing.data ?? null : null}
      loading={!!editId && !existing.data && !existing.isError}
      loadError={!!editId && existing.isError}
      prefillDate={target?.date}
    />
  );
}

function ExpenseForm({
  isOpen, onClose, expense, loading, loadError, prefillDate,
}: { isOpen: boolean; onClose: () => void; expense: Expense | null; loading: boolean; loadError: boolean; prefillDate?: string }) {
  const isEdit = !!expense;
  const initial = useMemo(() => (expense ? fromExpense(expense) : EMPTY(prefillDate)), [expense, prefillDate]);
  const [form, setForm] = useState<Form>(initial);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [askScope, setAskScope] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const save = useSaveExpense();
  const del = useDeleteExpense();
  const online = useOnline();
  const toast = useToast();
  const { start, end } = yearBounds();

  const isPartOfSeries = !!expense && !!expense.seriesId && expense.seriesId !== expense.expenseId;
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));

  const debouncedDate = useDebounced(form.date, 400);
  const mapping = useResolveIncome(isOpen && !loading ? debouncedDate : "");
  const resolving = mapping.isFetching || debouncedDate !== form.date;

  const payload = () => ({
    summary: form.summary.trim(),
    date: form.date,
    amount: parseAmount(form.amount),
    currency: form.currency,
    priority: form.priority,
    status: form.status,
    special: form.special,
    isRepeatable: form.isRepeatable,
    ...(form.isRepeatable ? { repeatFrequency: form.repeatFrequency, seriesEndDate: form.seriesEndDate } : {}),
  });

  const submit = async (mode: "create" | "single" | "series") => {
    setSubmitError(null);
    try {
      await save.mutateAsync({ id: expense?.expenseId, mode, body: payload() });
      toast.show({ message: isEdit ? "Expense saved" : "Expense added", tone: "positive" });
      onClose();
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message || "Something went wrong.");
    }
  };

  const onSubmit = () => {
    const errs = validateEntry(form, "expense", isEdit);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (!isEdit) submit("create");
    else if (isPartOfSeries) setAskScope(true);
    else submit("single");
  };

  const doDelete = (series: boolean) => {
    if (!expense) return;
    setAskDelete(false);
    del.mutate({ exp: expense, series }, {
      onError: () => toast.show({ message: "Could not delete the expense.", tone: "negative" }),
    });
    toast.show({ message: series ? "Series deleted" : "Expense deleted", icon: "trash" });
    onClose();
  };

  return (
    <>
      <FormSheet
        isOpen={isOpen}
        onClose={onClose}
        title={isEdit ? "Edit Expense" : "New Expense"}
        submitLabel={isEdit ? "Save" : "Add"}
        onSubmit={onSubmit}
        canSubmit={!loading && online}
        submitting={save.isPending}
        isDirty={dirty}
      >
        {loading ? (
          <ScreenSkeleton blocks={2} />
        ) : loadError ? (
          <Notice>Could not load expense.</Notice>
        ) : (
          <div className={s.groups}>
            {submitError && <Notice>{submitError}</Notice>}
            {!online && <Notice tone="info">You're offline. Changes can be saved once you're back online.</Notice>}

            <List aria-label="Details">
              <TextField label="Summary" value={form.summary} onChange={v => set("summary", v)} placeholder="e.g. Electricity bill" error={errors.summary} autoCapitalize="sentences" enterKeyHint="next" />
              <TextField
                label="Amount" value={form.amount} onChange={v => set("amount", sanitizeAmountInput(v))}
                placeholder="0,00" inputMode="decimal" error={errors.amount} align="end" enterKeyHint="next"
              />
              <Picker label="Currency" value={form.currency} options={CURRENCY_OPTIONS} onChange={v => set("currency", v)} />
              <DateField label="Date" value={form.date} onChange={v => set("date", v)} minValue={start} maxValue={end} error={errors.date} />
            </List>

            <p className={s.mapping} aria-live="polite">
              {!form.date ? null : resolving ? "Resolving income…" : mapping.data ? (
                <>↳ Maps to <strong>{mapping.data.summary}</strong> · {fmtDate(mapping.data.date)}
                  {mapping.data.amount != null && <> · {fmtNum(mapping.data.amount)} {mapping.data.currency ?? ""}</>}</>
              ) : mapping.isSuccess ? (
                <span className={s.warn}>No income found before this date — the expense will be unmapped.</span>
              ) : null}
            </p>

            <List aria-label="Classification">
              <Picker label="Priority" value={form.priority} options={PRIORITY_OPTIONS} onChange={v => set("priority", v)} />
              <FieldRow label="Status">
                <SegmentedControl
                  label="Status" value={form.status}
                  options={[{ value: "Pending", label: "Pending" }, { value: "Completed", label: "Completed" }]}
                  onChange={v => set("status", v)} className={s.segment}
                />
              </FieldRow>
              <FieldRow label={<>Special <span aria-hidden="true">★</span></>}>
                <Toggle label="Special" isSelected={form.special} onChange={v => set("special", v)} />
              </FieldRow>
            </List>

            {!isEdit && (
              <List aria-label="Repeat">
                <FieldRow label="Repeat">
                  <Toggle
                    label="Repeating expense"
                    isSelected={form.isRepeatable}
                    onChange={on => setForm(f => ({ ...f, isRepeatable: on, seriesEndDate: on && !f.seriesEndDate ? end : f.seriesEndDate }))}
                  />
                </FieldRow>
                {form.isRepeatable && (
                  <>
                    <Picker label="Frequency" value={form.repeatFrequency} options={FREQUENCY_OPTIONS} onChange={v => set("repeatFrequency", v)} />
                    <DateField label="Ends" value={form.seriesEndDate} onChange={v => set("seriesEndDate", v)} minValue={form.date || start} maxValue={end} error={errors.seriesEndDate} />
                  </>
                )}
              </List>
            )}

            {isEdit && (
              <div className={s.deleteWrap}>
                <Button variant="destructiveTinted" size="large" block onClick={() => setAskDelete(true)} icon="trash">
                  Delete Expense
                </Button>
              </div>
            )}
          </div>
        )}
      </FormSheet>

      <ActionSheet
        isOpen={askScope}
        onClose={() => setAskScope(false)}
        title="This expense is part of a series"
        actions={[
          { label: "Save for This Occurrence Only", onAction: () => { setAskScope(false); submit("single"); } },
          { label: "Save for All Future Occurrences", onAction: () => { setAskScope(false); submit("series"); } },
        ]}
      />
      <ActionSheet
        isOpen={askDelete}
        onClose={() => setAskDelete(false)}
        title={expense?.isRepeatable ? `“${expense?.summary}” is part of a recurring series` : `Delete “${expense?.summary}”?`}
        message={expense?.isRepeatable ? undefined : "This cannot be undone."}
        actions={expense?.isRepeatable
          ? [
              { label: "Delete This Occurrence", destructive: true, onAction: () => doDelete(false) },
              { label: "Delete Entire Series", destructive: true, onAction: () => doDelete(true) },
            ]
          : [{ label: "Delete Expense", destructive: true, onAction: () => doDelete(false) }]}
      />
    </>
  );
}
