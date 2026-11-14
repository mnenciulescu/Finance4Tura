import { useMemo, useState } from "react";
import {
  ActionSheet, Button, DateField, FieldRow, FormSheet, List, Notice, Picker, SegmentedControl, TextField, useToast,
} from "../../../ui";
import { useDeleteOperation, useDeleteSnapshot, useSaveOperation, useSaveSnapshot } from "../../../data/mutations";
import { PLATFORMS, PLATFORM_COLOR } from "../../../theme/domainColors";
import { parseAmount, sanitizeAmountInput } from "../../../utils/parseAmount";
import { todayIso } from "../../../utils/format";
import { useOnline } from "../../../app/useOnline";
import type { Currency, Operation, Snapshot } from "../../../types";
import { PLATFORM_CURRENCY } from "./investMath";
import f from "../forms/Forms.module.css";

const PLATFORM_OPTIONS = PLATFORMS.map(p => ({ value: p as string, label: p, color: PLATFORM_COLOR[p] }));
const CURRENCIES = [
  { value: "USD" as Currency, label: "USD" },
  { value: "EUR" as Currency, label: "EUR" },
  { value: "RON" as Currency, label: "RON" },
];

/* ── Snapshot ─────────────────────────────────────────────────────────────── */

interface SnapForm { date: string; platform: string; amount: string; currency: Currency; }

export function SnapshotSheet({ target, onClose }: { target: { snap?: Snapshot; date?: string } | null; onClose: () => void }) {
  return <SnapshotForm key={target ? `${target.snap?.snapshotId ?? "new"}-${target.date ?? ""}` : "closed"} target={target} onClose={onClose} />;
}

function SnapshotForm({ target, onClose }: { target: { snap?: Snapshot; date?: string } | null; onClose: () => void }) {
  const snap = target?.snap;
  const initial = useMemo<SnapForm>(() => snap
    ? { date: snap.date, platform: snap.platform, amount: String(snap.amount ?? ""), currency: snap.currency }
    : { date: target?.date || todayIso(), platform: "eToro", amount: "", currency: "USD" }, [snap, target?.date]);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = useSaveSnapshot();
  const del = useDeleteSnapshot();
  const toast = useToast();
  const online = useOnline();

  const submit = async () => {
    const errs: Record<string, string> = {};
    const amount = parseAmount(form.amount);
    if (!form.date) errs.date = "Required";
    if (form.amount === "" || Number.isNaN(amount) || amount < 0) errs.amount = "Must be 0 or more";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setError(null);
    try {
      // Edits keep the record's id (PUT /investments/snapshots/{id}).
      await save.mutateAsync({ id: snap?.snapshotId, body: { ...form, amount } });
      toast.show({ message: snap ? "Snapshot saved" : "Snapshot added", tone: "positive" });
      onClose();
    } catch (e) {
      console.error(e);
      setError("Could not save the snapshot.");
    }
  };

  return (
    <>
      <FormSheet
        isOpen={!!target}
        onClose={onClose}
        title={snap ? "Edit Snapshot" : "New Snapshot"}
        submitLabel={snap ? "Save" : "Add"}
        onSubmit={submit}
        canSubmit={online}
        submitting={save.isPending}
        isDirty={JSON.stringify(form) !== JSON.stringify(initial)}
      >
        <div className={f.groups}>
          {error && <Notice>{error}</Notice>}
          <List aria-label="Snapshot">
            <DateField label="Date" value={form.date} onChange={v => setForm(p => ({ ...p, date: v }))} error={errors.date} />
            <Picker
              label="Platform"
              value={form.platform}
              options={PLATFORM_OPTIONS}
              onChange={v => setForm(p => ({ ...p, platform: v, currency: PLATFORM_CURRENCY[v] ?? p.currency }))}
            />
            <TextField label="Amount" value={form.amount} onChange={v => setForm(p => ({ ...p, amount: sanitizeAmountInput(v) }))} inputMode="decimal" align="end" placeholder="0" error={errors.amount} />
            <Picker label="Currency" value={form.currency} options={CURRENCIES} onChange={v => setForm(p => ({ ...p, currency: v }))} />
          </List>
          {snap && (
            <div className={f.deleteWrap}>
              <Button variant="destructiveTinted" size="large" block icon="trash" onClick={() => setConfirmDelete(true)}>Delete Snapshot</Button>
            </div>
          )}
        </div>
      </FormSheet>
      <ActionSheet
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete the ${snap?.platform} snapshot?`}
        actions={[{
          label: "Delete Snapshot", destructive: true, onAction: () => {
            setConfirmDelete(false);
            if (snap) del.mutate(snap.snapshotId, { onError: () => toast.show({ message: "Could not delete the snapshot.", tone: "negative" }) });
            onClose();
          },
        }]}
      />
    </>
  );
}

/* ── Operation ────────────────────────────────────────────────────────────── */

interface OpForm { date: string; type: "Deposit" | "Withdrawal"; platform: string; amount: string; currency: Currency; notes: string; }

export function OperationSheet({ target, onClose }: { target: { op?: Operation } | null; onClose: () => void }) {
  return <OperationForm key={target ? target.op?.operationId ?? "new" : "closed"} target={target} onClose={onClose} />;
}

function OperationForm({ target, onClose }: { target: { op?: Operation } | null; onClose: () => void }) {
  const op = target?.op;
  const initial = useMemo<OpForm>(() => op
    ? { date: op.date, type: op.type, platform: op.platform, amount: String(op.amount ?? ""), currency: op.currency, notes: op.notes || "" }
    : { date: todayIso(), type: "Deposit", platform: "eToro", amount: "", currency: "USD", notes: "" }, [op]);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = useSaveOperation();
  const del = useDeleteOperation();
  const toast = useToast();
  const online = useOnline();

  const submit = async () => {
    const errs: Record<string, string> = {};
    const amount = parseAmount(form.amount);
    if (!form.date) errs.date = "Required";
    if (!form.amount || !(amount > 0)) errs.amount = "Must be greater than 0";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setError(null);
    try {
      await save.mutateAsync({ id: op?.operationId, body: { ...form, amount } });
      toast.show({ message: op ? "Operation saved" : "Operation added", tone: "positive" });
      onClose();
    } catch (e) {
      console.error(e);
      setError("Could not save the operation.");
    }
  };

  return (
    <>
      <FormSheet
        isOpen={!!target}
        onClose={onClose}
        title={op ? "Edit Operation" : "New Operation"}
        submitLabel={op ? "Save" : "Add"}
        onSubmit={submit}
        canSubmit={online}
        submitting={save.isPending}
        isDirty={JSON.stringify(form) !== JSON.stringify(initial)}
      >
        <div className={f.groups}>
          {error && <Notice>{error}</Notice>}
          <List aria-label="Operation">
            <FieldRow label="Type">
              <SegmentedControl
                label="Operation type"
                value={form.type}
                options={[{ value: "Deposit", label: "Deposit" }, { value: "Withdrawal", label: "Withdrawal" }]}
                onChange={v => setForm(p => ({ ...p, type: v }))}
                className={f.segment}
              />
            </FieldRow>
            <DateField label="Date" value={form.date} onChange={v => setForm(p => ({ ...p, date: v }))} error={errors.date} />
            <Picker
              label="Platform"
              value={form.platform}
              options={PLATFORM_OPTIONS}
              onChange={v => setForm(p => ({ ...p, platform: v, currency: PLATFORM_CURRENCY[v] ?? p.currency }))}
            />
            <TextField label="Amount" value={form.amount} onChange={v => setForm(p => ({ ...p, amount: sanitizeAmountInput(v) }))} inputMode="decimal" align="end" placeholder="0" error={errors.amount} />
            <Picker label="Currency" value={form.currency} options={CURRENCIES} onChange={v => setForm(p => ({ ...p, currency: v }))} />
          </List>
          <List aria-label="Notes">
            <TextField label="Notes" value={form.notes} onChange={v => setForm(p => ({ ...p, notes: v }))} placeholder="Optional" multiline />
          </List>
          {op && (
            <div className={f.deleteWrap}>
              <Button variant="destructiveTinted" size="large" block icon="trash" onClick={() => setConfirmDelete(true)}>Delete Operation</Button>
            </div>
          )}
        </div>
      </FormSheet>
      <ActionSheet
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this operation?"
        actions={[{
          label: "Delete Operation", destructive: true, onAction: () => {
            setConfirmDelete(false);
            if (op) del.mutate(op.operationId, { onError: () => toast.show({ message: "Could not delete the operation.", tone: "negative" }) });
            onClose();
          },
        }]}
      />
    </>
  );
}
