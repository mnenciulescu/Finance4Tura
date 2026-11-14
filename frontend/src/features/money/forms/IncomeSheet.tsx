import { useMemo, useState } from "react";
import {
  FormSheet, List, TextField, Picker, Toggle, DateField, ActionSheet, Button, FieldRow, ScreenSkeleton, Notice, useToast,
} from "../../../ui";
import { useIncome } from "../../../data/queries";
import { useDeleteIncome, useSaveIncome } from "../../../data/mutations";
import { parseAmount, sanitizeAmountInput } from "../../../utils/parseAmount";
import { todayIso } from "../../../utils/format";
import { useOnline } from "../../../app/useOnline";
import type { Currency, Frequency, Income } from "../../../types";
import { validateEntry, yearBounds, type FormErrors } from "./validation";
import { CURRENCY_OPTIONS, FREQUENCY_OPTIONS, isIncomeSeriesMember } from "./options";
import type { IncomeFormTarget } from "./FormsContext";
import s from "./Forms.module.css";

interface Form {
  summary: string; amount: string; currency: Currency; date: string;
  isRepeatable: boolean; repeatFrequency: Frequency; seriesEndDate: string;
}

const EMPTY = (): Form => ({
  summary: "", amount: "", currency: "RON", date: todayIso(),
  isRepeatable: false, repeatFrequency: "monthly", seriesEndDate: "",
});

const fromIncome = (i: Income): Form => ({
  summary: i.summary ?? "", amount: i.amount != null ? String(i.amount) : "", currency: i.currency ?? "RON",
  date: i.date ?? "", isRepeatable: !!i.isRepeatable, repeatFrequency: i.repeatFrequency ?? "monthly",
  seriesEndDate: i.seriesEndDate ?? "",
});

export function IncomeSheet({ target, onClose }: { target: IncomeFormTarget | null; onClose: () => void }) {
  const editId = target?.id;
  const existing = useIncome(editId);
  return (
    <IncomeForm
      key={existing.data?.incomeId ?? "new"}
      isOpen={!!target}
      onClose={onClose}
      income={editId ? existing.data ?? null : null}
      loading={!!editId && !existing.data && !existing.isError}
      loadError={!!editId && existing.isError}
    />
  );
}

function IncomeForm({
  isOpen, onClose, income, loading, loadError,
}: { isOpen: boolean; onClose: () => void; income: Income | null; loading: boolean; loadError: boolean }) {
  const isEdit = !!income;
  const initial = useMemo(() => (income ? fromIncome(income) : EMPTY()), [income]);
  const [form, setForm] = useState<Form>(initial);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [askScope, setAskScope] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const save = useSaveIncome();
  const del = useDeleteIncome();
  const online = useOnline();
  const toast = useToast();
  const { start, end } = yearBounds();

  const isPartOfSeries = !!income && isIncomeSeriesMember(income);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (mode: "create" | "single" | "series") => {
    setSubmitError(null);
    try {
      await save.mutateAsync({
        id: income?.incomeId,
        mode,
        body: {
          summary: form.summary.trim(),
          date: form.date,
          amount: parseAmount(form.amount),
          currency: form.currency,
          isRepeatable: form.isRepeatable,
          ...(form.isRepeatable ? { repeatFrequency: form.repeatFrequency, seriesEndDate: form.seriesEndDate } : {}),
        },
      });
      toast.show({ message: isEdit ? "Income saved" : "Income added", tone: "positive" });
      onClose();
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message || "Something went wrong.");
    }
  };

  const onSubmit = () => {
    const errs = validateEntry(form, "income", isEdit);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (!isEdit) submit("create");
    else if (isPartOfSeries) setAskScope(true);
    else submit("single");
  };

  const doDelete = (series: boolean) => {
    if (!income) return;
    setAskDelete(false);
    del.deleteIncome(income, series);
    toast.show({ message: series ? "Income series deleted" : "Income deleted", icon: "trash" });
    onClose();
  };

  return (
    <>
      <FormSheet
        isOpen={isOpen}
        onClose={onClose}
        title={isEdit ? "Edit Income" : "New Income"}
        submitLabel={isEdit ? "Save" : "Add"}
        onSubmit={onSubmit}
        canSubmit={!loading && online}
        submitting={save.isPending}
        isDirty={dirty}
      >
        {loading ? (
          <ScreenSkeleton blocks={2} />
        ) : loadError ? (
          <Notice>Could not load income.</Notice>
        ) : (
          <div className={s.groups}>
            {submitError && <Notice>{submitError}</Notice>}
            {!online && <Notice tone="info">You're offline. Changes can be saved once you're back online.</Notice>}
            <List aria-label="Details">
              <TextField label="Summary" value={form.summary} onChange={v => set("summary", v)} placeholder="e.g. Monthly salary" error={errors.summary} autoCapitalize="sentences" />
              <TextField label="Amount" value={form.amount} onChange={v => set("amount", sanitizeAmountInput(v))} placeholder="0,00" inputMode="decimal" error={errors.amount} align="end" />
              <Picker label="Currency" value={form.currency} options={CURRENCY_OPTIONS} onChange={v => set("currency", v)} />
              <DateField label="Date" value={form.date} onChange={v => set("date", v)} minValue={start} maxValue={end} error={errors.date} />
            </List>

            {!isEdit && (
              <List aria-label="Repeat">
                <FieldRow label="Repeat">
                  <Toggle
                    label="Repeating income"
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
                  Delete Income
                </Button>
              </div>
            )}
          </div>
        )}
      </FormSheet>

      <ActionSheet
        isOpen={askScope}
        onClose={() => setAskScope(false)}
        title="This income is part of a series"
        actions={[
          { label: "Save for This Occurrence Only", onAction: () => { setAskScope(false); submit("single"); } },
          { label: "Save for All Future Occurrences", onAction: () => { setAskScope(false); submit("series"); } },
        ]}
      />
      <IncomeDeleteSheet income={askDelete ? income : null} onClose={() => setAskDelete(false)} onDelete={doDelete} />
    </>
  );
}

/** Delete confirmation for an income, with the series choice when it repeats. */
export function IncomeDeleteSheet({
  income, onClose, onDelete,
}: { income: Income | null; onClose: () => void; onDelete: (series: boolean) => void }) {
  const series = !!income && isIncomeSeriesMember(income);
  return (
    <ActionSheet
      isOpen={!!income}
      onClose={onClose}
      title={series ? `“${income?.summary}” is part of a recurring series` : `Delete “${income?.summary}”?`}
      message={series ? "Its expenses move to the best remaining income." : "This cannot be undone. Its expenses move to the best remaining income."}
      actions={series
        ? [
            { label: "Delete This Occurrence", destructive: true, onAction: () => onDelete(false) },
            { label: "Delete Entire Series", destructive: true, onAction: () => onDelete(true) },
          ]
        : [{ label: "Delete Income", destructive: true, onAction: () => onDelete(false) }]}
    />
  );
}
