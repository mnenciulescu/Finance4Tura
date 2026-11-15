import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ActionSheet, Button, DateField, FieldRow, Icon, List, ListSection, Notice, Sheet, ShowMore, SwipeActions, TextField, Toggle, useToast,
} from "../../ui";
import { hqEntryApi, removeEntryFromCache, upsertEntryInCache } from "../../data/hq";
import { fmtDate, todayIso } from "../../utils/format";
import type { HqEntry, HqTemplate, HqValue } from "../../types";
import { computedColumns, computedValues, smsText } from "./hqMath";
import s from "./Hq.module.css";

const DEBOUNCE_MS = 600;

const emptyValues = (t: HqTemplate): HqValue[] =>
  (t.parameters || []).map(p => ({ parameterId: p.parameterId!, title: p.title, value: p.type === "boolean" ? false : "" }));

const valuesFor = (t: HqTemplate, entry: HqEntry): HqValue[] =>
  (t.parameters || []).map(p => {
    const existing = (entry.values || []).find(v => v.parameterId === p.parameterId);
    return { parameterId: p.parameterId!, title: p.title, value: existing !== undefined ? existing.value : p.type === "boolean" ? false : "" };
  });

/**
 * One template on a location (proposal §8.9): + New Entry, entry cards newest
 * first, auto-save with a 600 ms debounce, computed water consumption, and
 * the meter-reading SMS for water templates.
 */
export function TemplateSection({
  template, hqId, entries, limit,
}: {
  template: HqTemplate; hqId: string; entries: HqEntry[];
  /** Show only the newest `limit` entries, then Show More (One-Page). */
  limit?: number;
}) {
  const [creating, setCreating] = useState(false);
  const [shown, setShown] = useState(limit ?? 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [sms, setSms] = useState(false);
  const [toDelete, setToDelete] = useState<HqEntry | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const cols = computedColumns(template);
  const computed = computedValues(entries, cols);
  const text = smsText(template, entries);
  const params = template.parameters || [];

  const doDelete = async (entry: HqEntry) => {
    setToDelete(null);
    try {
      await hqEntryApi.deleteEntry(entry.entryId);
      removeEntryFromCache(qc, entry.entryId);
      toast.show({ message: "Entry deleted", icon: "trash" });
    } catch (e: any) {
      toast.show({ message: e?.response?.data?.message || "Delete failed", tone: "negative" });
    }
  };

  return (
    <ListSection
      header={template.name}
      headerAction={
        <>
          {text && <Button variant="plain" size="small" icon="message" onClick={() => setSms(true)}>SMS</Button>}
          <Button variant="plain" size="small" icon="plus" onClick={() => setCreating(true)} disabled={creating}>New Entry</Button>
        </>
      }
    >
      <div className={s.stack}>
        {creating && (
          <EntryEditor
            template={template}
            hqId={hqId}
            onDone={() => setCreating(false)}
          />
        )}
        {entries.length === 0 && !creating && <p className={s.muted}>No entries yet.</p>}
        {(limit != null ? entries.slice(0, shown) : entries).map(entry => {
          if (editingId === entry.entryId) {
            return <EntryEditor key={entry.entryId} template={template} hqId={hqId} entry={entry} onDone={() => setEditingId(null)} />;
          }
          const open = !!openIds[entry.entryId];
          const preview = params.slice(0, 2).map(p => {
            const v = (entry.values || []).find(x => x.parameterId === p.parameterId)?.value;
            return v === "" || v == null ? null : `${p.title} ${v}`;
          }).filter(Boolean).join(" · ");
          return (
            <article key={entry.entryId} className={s.card} data-entry={entry.entryId}>
              <SwipeActions
                actions={[
                  { label: "Edit", icon: "pencil", onAction: () => setEditingId(entry.entryId) },
                  { label: "Delete", icon: "trash", destructive: true, onAction: () => doDelete(entry) },
                ]}
              >
                <button
                  type="button"
                  className={s.entryHead}
                  aria-expanded={open}
                  onClick={() => setOpenIds(m => ({ ...m, [entry.entryId]: !m[entry.entryId] }))}
                >
                  <span className={s.entryText}>
                    <span className={s.entryDate}>{fmtDate(entry.date)}</span>
                    {preview && <span className={s.entryPreview}>{preview}</span>}
                  </span>
                  <Icon name="chevronDown" size={16} weight="semibold" className={s.chevron} style={{ transform: open ? "rotate(180deg)" : "none" }} />
                </button>
              </SwipeActions>
              {open && (
                <div className={s.entryBody}>
                  <dl className={s.values}>
                    {params.map(p => {
                      const v = (entry.values || []).find(x => x.parameterId === p.parameterId)?.value;
                      const shown = v === null || v === undefined || v === "" ? "—" : p.type === "boolean" ? (v ? "✓" : "—") : String(v);
                      return (
                        <div key={p.parameterId ?? p.title} className={s.valueRow}>
                          <dt>{p.title}{p.unit ? ` (${p.unit})` : ""}</dt>
                          <dd>{shown}</dd>
                        </div>
                      );
                    })}
                    {cols.map(col => {
                      const v = computed[entry.entryId]?.[col.title];
                      return (
                        <div key={col.title} className={[s.valueRow, s.computed].join(" ")}>
                          <dt>{col.title}</dt>
                          <dd>{v == null ? "—" : `${v} m³/mo`}</dd>
                        </div>
                      );
                    })}
                    {entry.notes && (
                      <div className={s.valueRow}><dt>Notes</dt><dd>{entry.notes}</dd></div>
                    )}
                  </dl>
                  <div className={s.entryActions}>
                    <Button variant="gray" size="small" icon="pencil" onClick={() => setEditingId(entry.entryId)}>Edit</Button>
                    <Button variant="destructiveTinted" size="small" icon="trash" onClick={() => setToDelete(entry)}>Delete</Button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
        {limit != null && <ShowMore shown={shown} total={entries.length} initial={limit} step={5} onChange={setShown} allowAll />}
      </div>

      <Sheet isOpen={sms} onClose={() => setSms(false)} title="Meter reading SMS">
        <SmsBody text={text ?? ""} onClose={() => setSms(false)} />
      </Sheet>
      <ActionSheet
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Delete the entry from ${toDelete ? fmtDate(toDelete.date) : ""}?`}
        message="This cannot be undone."
        actions={[{ label: "Delete Entry", destructive: true, onAction: () => toDelete && doDelete(toDelete) }]}
      />
    </ListSection>
  );
}

function SmsBody({ text, onClose }: { text: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={s.smsBody}>
      <pre className={s.sms}>{text}</pre>
      <div className={s.smsActions}>
        <Button variant="gray" size="large" block onClick={onClose}>Close</Button>
        <Button
          variant={copied ? "tinted" : "filled"}
          size="large"
          block
          icon={copied ? "check" : "copy"}
          onClick={() => navigator.clipboard?.writeText(text).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2000); })}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

/* ── Auto-saving entry editor ─────────────────────────────────────────────── */

interface Draft { date: string; values: HqValue[]; notes: string; }

/**
 * Stacked, labelled fields; every change saves after 600 ms. A new entry is
 * created on its first save and updated afterwards. "Done" flushes any
 * pending save.
 */
function EntryEditor({ template, hqId, entry, onDone }: { template: HqTemplate; hqId: string; entry?: HqEntry; onDone: () => void }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => entry
    ? { date: entry.date, values: valuesFor(template, entry), notes: entry.notes || "" }
    : { date: todayIso(), values: emptyValues(template), notes: "" });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const draftRef = useRef(draft);
  const idRef = useRef<string | null>(entry?.entryId ?? null);
  const timer = useRef<number | undefined>(undefined);
  const inFlight = useRef(false);
  const params = template.parameters || [];

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const save = async () => {
    timer.current = undefined;
    if (inFlight.current) { schedule(); return; }
    inFlight.current = true;
    setStatus("saving");
    const d = draftRef.current;
    try {
      const body = { templateId: template.templateId, hqId, date: d.date, values: d.values, notes: d.notes || "" };
      const saved: HqEntry = idRef.current
        ? await hqEntryApi.updateEntry(idRef.current, { date: d.date, values: d.values, notes: d.notes || "" })
        : await hqEntryApi.createEntry(body);
      idRef.current = saved.entryId;
      upsertEntryInCache(qc, saved);
      setStatus("saved");
      setError(null);
    } catch (e: any) {
      setStatus("error");
      setError(e?.response?.data?.message || e?.message || "Save failed");
    } finally {
      inFlight.current = false;
    }
  };

  const schedule = (immediate = false) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(save, immediate ? 0 : DEBOUNCE_MS);
  };

  const update = (next: Draft) => {
    draftRef.current = next;
    setDraft(next);
    schedule();
  };
  const setValue = (parameterId: string, value: HqValue["value"]) =>
    update({ ...draftRef.current, values: draftRef.current.values.map(v => (v.parameterId === parameterId ? { ...v, value } : v)) });

  // Flush a pending save before closing; it completes even after unmount.
  const done = () => {
    const pending = timer.current !== undefined;
    window.clearTimeout(timer.current);
    timer.current = undefined;
    if (pending) save();
    onDone();
  };

  return (
    <article className={[s.card, s.editing].join(" ")} aria-label={entry ? "Edit entry" : "New entry"}>
      {error && <Notice>{error}</Notice>}
      <List variant="plain" aria-label="Entry fields">
        <DateField label="Date" value={draft.date} onChange={v => update({ ...draftRef.current, date: v })} />
        {params.map(p => {
          const v = draft.values.find(x => x.parameterId === p.parameterId)?.value ?? (p.type === "boolean" ? false : "");
          const label = `${p.title}${p.unit ? ` (${p.unit})` : ""}`;
          if (p.type === "boolean") {
            return (
              <FieldRow key={p.parameterId} label={label}>
                <Toggle label={label} isSelected={!!v} onChange={on => setValue(p.parameterId!, on)} />
              </FieldRow>
            );
          }
          return (
            <TextField
              key={p.parameterId}
              label={p.title}
              value={String(v ?? "")}
              onChange={val => setValue(p.parameterId!, val)}
              inputMode={p.type === "number" ? "decimal" : undefined}
              align={p.type === "number" ? "end" : "start"}
              suffix={p.unit || undefined}
            />
          );
        })}
        <TextField label="Notes" value={draft.notes} onChange={v => update({ ...draftRef.current, notes: v })} placeholder="notes…" />
      </List>
      <div className={s.editorFoot}>
        <span className={[s.saveState, status === "error" ? s.saveError : ""].join(" ")} aria-live="polite">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Not saved" : entry ? "" : "Saves as you type"}
        </span>
        <Button variant="filled" size="small" onClick={done}>Done</Button>
      </div>
    </article>
  );
}
