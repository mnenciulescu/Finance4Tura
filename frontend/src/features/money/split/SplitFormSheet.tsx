import { useMemo, useState } from "react";
import { DateField, FieldRow, FormSheet, List, Notice, Picker, SegmentedControl, Stepper, TextField, useToast } from "../../../ui";
import { useSaveSplit } from "../../../data/mutations";
import { MAX_OCCURRENCES, normOccs, splitStats } from "../../../utils/split";
import { parseAmount, sanitizeAmountInput } from "../../../utils/parseAmount";
import { todayIso } from "../../../utils/format";
import { useOnline } from "../../../app/useOnline";
import { CURRENCY_OPTIONS } from "../forms/options";
import type { Currency, SplitPayment } from "../../../types";
import f from "../forms/Forms.module.css";

interface Form {
  title: string; date: string; amount: string; currency: Currency;
  occurrenceCount: number; occurrenceType: "amount" | "date";
}

const blank = (): Form => ({ title: "", date: todayIso(), amount: "", currency: "RON", occurrenceCount: 2, occurrenceType: "amount" });
const fromEntry = (e: SplitPayment): Form => ({
  title: e.title ?? "", date: e.createdDate || todayIso(), amount: String(e.totalAmount ?? ""), currency: e.currency || "RON",
  occurrenceCount: e.occurrenceCount || 1, occurrenceType: e.occurrenceType || "amount",
});

export function SplitFormSheet({ target, onClose }: { target: { entry?: SplitPayment } | null; onClose: () => void }) {
  return <SplitForm key={target ? target.entry?.splitPaymentId ?? "new" : "closed"} isOpen={!!target} entry={target?.entry} onClose={onClose} />;
}

function SplitForm({ isOpen, entry, onClose }: { isOpen: boolean; entry?: SplitPayment; onClose: () => void }) {
  const isEdit = !!entry;
  const initial = useMemo(() => (entry ? fromEntry(entry) : blank()), [entry]);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const save = useSaveSplit();
  const toast = useToast();
  const online = useOnline();
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(p => ({ ...p, [k]: v }));
  // Track by is locked once any slot is filled.
  const lockedType = !!entry && splitStats(entry).paid > 0;

  const submit = async () => {
    const errs: Record<string, string> = {};
    const amount = parseAmount(form.amount);
    if (!form.title.trim()) errs.title = "Required";
    if (!form.amount || !(amount > 0)) errs.amount = "Must be greater than 0";
    if (form.occurrenceCount < 1) errs.occurrenceCount = "Min 1";
    if (form.occurrenceCount > MAX_OCCURRENCES) errs.occurrenceCount = `Max ${MAX_OCCURRENCES}`;
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const count = Math.min(MAX_OCCURRENCES, form.occurrenceCount);
    const prev = entry ? normOccs(entry) : [];
    const body = {
      createdDate: form.date || todayIso(),
      title: form.title.trim(),
      totalAmount: amount,
      currency: form.currency,
      occurrenceCount: count,
      occurrenceType: form.occurrenceType,
      // Values that survive a count change are kept by position.
      occurrences: Array.from({ length: count }, (_, i) => ({ index: i, value: prev[i]?.value ?? "" })),
    };
    setSubmitError(null);
    try {
      await save.mutateAsync({ id: entry?.splitPaymentId, body });
      toast.show({ message: isEdit ? "Split payment saved" : "Split payment added", tone: "positive" });
      onClose();
    } catch (e) {
      console.error(e);
      setSubmitError("Could not save the split payment.");
    }
  };

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Split Payment" : "New Split Payment"}
      submitLabel={isEdit ? "Save" : "Create"}
      onSubmit={submit}
      canSubmit={online}
      submitting={save.isPending}
      isDirty={JSON.stringify(form) !== JSON.stringify(initial)}
    >
      <div className={f.groups}>
        {submitError && <Notice>{submitError}</Notice>}
        <List aria-label="Details">
          <TextField label="Title" value={form.title} onChange={v => set("title", v)} placeholder="e.g. Laptop instalments" error={errors.title} autoCapitalize="sentences" />
          <DateField label="Date" value={form.date} onChange={v => set("date", v)} />
          <TextField label="Total" value={form.amount} onChange={v => set("amount", sanitizeAmountInput(v))} placeholder="0" inputMode="decimal" align="end" error={errors.amount} />
          <Picker label="Currency" value={form.currency} options={CURRENCY_OPTIONS} onChange={v => set("currency", v)} />
        </List>
        <List aria-label="Instalments">
          <FieldRow label="Occurrences" error={errors.occurrenceCount}>
            <Stepper label="occurrences" value={form.occurrenceCount} min={1} max={MAX_OCCURRENCES} onChange={v => set("occurrenceCount", v)} />
          </FieldRow>
          <FieldRow label="Track by">
            <SegmentedControl
              label="Track by"
              value={form.occurrenceType}
              isDisabled={lockedType}
              options={[{ value: "amount", label: "Amount" }, { value: "date", label: "Date" }]}
              onChange={v => set("occurrenceType", v)}
              className={f.segment}
            />
          </FieldRow>
        </List>
        {lockedType && (
          <p className={f.mapping} style={{ marginTop: "calc(var(--space-4) * -1)" }}>
            Track by is locked because some instalments are already filled.
          </p>
        )}
      </div>
    </FormSheet>
  );
}
