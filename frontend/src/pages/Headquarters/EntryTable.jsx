import { useState, useRef, useEffect } from "react";
import { createEntry, updateEntry, deleteEntry } from "../../api/headquarters";
import s from "./styles";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function typeIcon(type) {
  if (type === "number")  return "#";
  if (type === "text")    return "T";
  if (type === "boolean") return "✓";
  return "";
}

function displayValue(val, type) {
  if (val === null || val === undefined || val === "") {
    return <span style={{ color: "var(--text-muted)" }}>—</span>;
  }
  if (type === "boolean") return val ? "✓" : "—";
  return String(val);
}

function buildEmptyValues(template) {
  return (template.parameters || []).map(p => ({
    parameterId: p.parameterId,
    title:       p.title,
    value:       p.type === "boolean" ? false : "",
  }));
}

const DEBOUNCE_MS = 600;

// externalNewRow: boolean — when true, open new row; onNewRowDone: called when row is closed
// computedColumns: [{ title }] — derived column headers shown after regular params
// computedValues:  { entryId: { title: value } } — pre-computed per-entry values
export default function EntryTable({ template, entries, hqId, externalNewRow, onNewRowDone, onEntryCreated, onEntryUpdated, onEntryDeleted, computedColumns = [], computedValues = {} }) {
  const params = template.parameters || [];

  // New row state
  const [newRow, setNewRow]             = useState(null);
  const [newRowSaving, setNewRowSaving] = useState(false);
  const [newRowError, setNewRowError]   = useState(null);

  // Edit row state
  const [editingId, setEditingId]       = useState(null);
  const [editData, setEditData]         = useState(null);
  const [editSaving, setEditSaving]     = useState(false);
  const [editError, setEditError]       = useState(null);

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Which entry cards are expanded
  const [openEntries, setOpenEntries] = useState({});
  const toggleEntry = id => setOpenEntries(m => ({ ...m, [id]: !m[id] }));

  // Refs to avoid stale closures in debounced saves
  const newRowRef          = useRef(null);
  const newRowSaveTimer    = useRef(null);
  const newRowSavingFlight = useRef(false);
  const newEntryIdRef      = useRef(null);

  const editDataRef        = useRef(null);
  const editingIdRef       = useRef(null);
  const editSaveTimer      = useRef(null);
  const editSavingFlight   = useRef(false);

  useEffect(() => { newRowRef.current    = newRow;     }, [newRow]);
  useEffect(() => { editDataRef.current  = editData;   }, [editData]);
  useEffect(() => { editingIdRef.current = editingId;  }, [editingId]);

  // Open new row when externalNewRow becomes true
  useEffect(() => {
    if (externalNewRow && !newRow) {
      newEntryIdRef.current = null;
      setNewRow({ date: today(), values: buildEmptyValues(template), notes: "" });
      setNewRowError(null);
    }
  }, [externalNewRow]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── New row auto-save ──────────────────────────────────────────────────────

  function scheduleNewRowSave(immediate = false) {
    if (newRowSaveTimer.current) clearTimeout(newRowSaveTimer.current);
    newRowSaveTimer.current = setTimeout(async () => {
      if (newRowSavingFlight.current) return;
      const row = newRowRef.current;
      if (!row) return;
      newRowSavingFlight.current = true;
      setNewRowSaving(true);
      try {
        const payload = {
          templateId: template.templateId,
          hqId,
          date:   row.date,
          values: row.values,
          notes:  row.notes || "",
        };
        if (newEntryIdRef.current) {
          const updated = await updateEntry(newEntryIdRef.current, payload);
          onEntryUpdated(updated);
        } else {
          const created = await createEntry(payload);
          newEntryIdRef.current = created.entryId;
          onEntryCreated(created);
        }
        setNewRowError(null);
      } catch (e) {
        setNewRowError(e?.response?.data?.message || e.message || "Save failed");
      } finally {
        newRowSavingFlight.current = false;
        setNewRowSaving(false);
      }
    }, immediate ? 0 : DEBOUNCE_MS);
  }

  function updateNewRowField(key, val) {
    setNewRow(r => {
      const updated = { ...r, [key]: val };
      newRowRef.current = updated;
      return updated;
    });
    scheduleNewRowSave();
  }

  function updateNewRowValue(parameterId, val) {
    setNewRow(r => {
      const updated = {
        ...r,
        values: r.values.map(v => v.parameterId === parameterId ? { ...v, value: val } : v),
      };
      newRowRef.current = updated;
      return updated;
    });
    scheduleNewRowSave();
  }

  function flushNewRow() {
    scheduleNewRowSave(true);
    setNewRow(null);
    newEntryIdRef.current = null;
    if (onNewRowDone) onNewRowDone();
  }

  function cancelNewRow() {
    if (newRowSaveTimer.current) clearTimeout(newRowSaveTimer.current);
    setNewRow(null);
    newEntryIdRef.current = null;
    if (onNewRowDone) onNewRowDone();
  }

  // ── Edit row auto-save ─────────────────────────────────────────────────────

  function scheduleEditSave(immediate = false) {
    if (editSaveTimer.current) clearTimeout(editSaveTimer.current);
    editSaveTimer.current = setTimeout(async () => {
      if (editSavingFlight.current) return;
      const id   = editingIdRef.current;
      const data = editDataRef.current;
      if (!id || !data) return;
      editSavingFlight.current = true;
      setEditSaving(true);
      try {
        const updated = await updateEntry(id, { date: data.date, values: data.values, notes: data.notes || "" });
        onEntryUpdated(updated);
        setEditError(null);
      } catch (e) {
        setEditError(e?.response?.data?.message || e.message || "Save failed");
      } finally {
        editSavingFlight.current = false;
        setEditSaving(false);
      }
    }, immediate ? 0 : DEBOUNCE_MS);
  }

  function startEdit(entry) {
    setEditingId(entry.entryId);
    setEditData({
      date:   entry.date,
      values: params.map(p => {
        const existing = (entry.values || []).find(v => v.parameterId === p.parameterId);
        return {
          parameterId: p.parameterId,
          title:       p.title,
          value:       existing !== undefined ? existing.value : (p.type === "boolean" ? false : ""),
        };
      }),
      notes: entry.notes || "",
    });
    setEditError(null);
  }

  function updateEditField(key, val) {
    setEditData(d => {
      const updated = { ...d, [key]: val };
      editDataRef.current = updated;
      return updated;
    });
    scheduleEditSave();
  }

  function updateEditValue(parameterId, val) {
    setEditData(d => {
      const updated = {
        ...d,
        values: d.values.map(v => v.parameterId === parameterId ? { ...v, value: val } : v),
      };
      editDataRef.current = updated;
      return updated;
    });
    scheduleEditSave();
  }

  function flushEdit() {
    scheduleEditSave(true);
    setEditingId(null);
    setEditData(null);
  }

  function cancelEdit() {
    if (editSaveTimer.current) clearTimeout(editSaveTimer.current);
    setEditingId(null);
    setEditData(null);
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete(entryId) {
    if (confirmDeleteId !== entryId) {
      setConfirmDeleteId(entryId);
      return;
    }
    setConfirmDeleteId(null);
    try {
      await deleteEntry(entryId);
      onEntryDeleted(entryId);
    } catch (e) {
      alert(e?.response?.data?.message || e.message || "Delete failed");
    }
  }

  // Stacked, labelled inputs — the mobile stand-in for inline <td> editing.
  function EditFields({ data, onField, onValue }) {
    return (
      <div style={s.editFields}>
        <label style={s.fieldLabel}>Date
          <input
            type="date"
            style={s.fieldInput}
            value={data.date}
            onChange={e => onField("date", e.target.value)}
          />
        </label>
        {params.map(p => {
          const v   = data.values.find(x => x.parameterId === p.parameterId);
          const val = v !== undefined ? v.value : (p.type === "boolean" ? false : "");
          if (p.type === "boolean") {
            return (
              <label key={p.parameterId} style={s.fieldCheck}>
                <input
                  type="checkbox"
                  checked={!!val}
                  onChange={e => onValue(p.parameterId, e.target.checked)}
                />
                {p.title}{p.unit ? ` (${p.unit})` : ""}
              </label>
            );
          }
          return (
            <label key={p.parameterId} style={s.fieldLabel}>
              {p.title}{p.unit ? ` (${p.unit})` : ""}
              <input
                type={p.type === "number" ? "number" : "text"}
                inputMode={p.type === "number" ? "decimal" : undefined}
                style={s.fieldInput}
                value={val}
                onChange={e => onValue(p.parameterId, e.target.value)}
              />
            </label>
          );
        })}
        <label style={s.fieldLabel}>Notes
          <input
            type="text"
            style={s.fieldInput}
            value={data.notes}
            placeholder="notes…"
            onChange={e => onField("notes", e.target.value)}
          />
        </label>
      </div>
    );
  }

  return (
    <div style={s.entryList}>
      {/* New entry */}
      {newRow && (
        <div style={{ ...s.entryCard, ...s.entryCardEditing }}>
          <div style={s.entryHead}>
            <span style={s.entryDate}>New entry</span>
            {newRowSaving && <span style={s.savingTag}>saving…</span>}
          </div>
          <div style={s.entryBody}>
            <EditFields data={newRow} onField={updateNewRowField} onValue={updateNewRowValue} />
            {newRowError && <div style={s.rowError}>{newRowError}</div>}
            <div style={s.entryActions}>
              <button style={s.btnGhost} onClick={cancelNewRow}>Cancel</button>
              <button style={s.btnPrimarySm} onClick={flushNewRow} disabled={newRowSaving}>
                {newRowSaving ? "Saving…" : "Done"}
              </button>
            </div>
          </div>
        </div>
      )}

      {entries.length === 0 && !newRow && (
        <div style={s.entryEmpty}>No entries yet.</div>
      )}

      {entries.map(entry => {
        const isEditing = editingId === entry.entryId;
        const open = isEditing || !!openEntries[entry.entryId];

        if (isEditing) {
          return (
            <div key={entry.entryId} style={{ ...s.entryCard, ...s.entryCardEditing }}>
              <div style={s.entryHead}>
                <span style={s.entryDate}>{editData.date}</span>
                {editSaving && <span style={s.savingTag}>saving…</span>}
              </div>
              <div style={s.entryBody}>
                <EditFields data={editData} onField={updateEditField} onValue={updateEditValue} />
                {editError && <div style={s.rowError}>{editError}</div>}
                <div style={s.entryActions}>
                  <button style={s.btnGhost} onClick={cancelEdit}>Cancel</button>
                  <button style={s.btnPrimarySm} onClick={flushEdit} disabled={editSaving}>
                    {editSaving ? "Saving…" : "Done"}
                  </button>
                </div>
              </div>
            </div>
          );
        }

        // Two or three values are enough to tell entries apart in the collapsed head.
        const preview = params.slice(0, 2).map(p => {
          const v = (entry.values || []).find(x => x.parameterId === p.parameterId);
          return v?.value === "" || v?.value == null ? null : `${p.title} ${v.value}`;
        }).filter(Boolean).join(" · ");

        return (
          <div key={entry.entryId} style={s.entryCard}>
            <button style={s.entryHeadBtn} onClick={() => toggleEntry(entry.entryId)}>
              <span style={s.entryHeadMain}>
                <span style={s.entryDate}>{entry.date}</span>
                {preview && <span style={s.entryPreview}>{preview}</span>}
              </span>
              <span style={{ ...s.chevron, transform: open ? "rotate(180deg)" : "none" }}>⌄</span>
            </button>

            {open && (
              <div style={s.entryBody}>
                {params.map(p => {
                  const v = (entry.values || []).find(x => x.parameterId === p.parameterId);
                  return (
                    <div key={p.parameterId} style={s.readRow}>
                      <span style={s.readKey}>
                        <span style={s.typeIcon}>{typeIcon(p.type)}</span>
                        {p.title}{p.unit ? ` (${p.unit})` : ""}
                      </span>
                      <span style={s.readVal}>{displayValue(v?.value, p.type)}</span>
                    </div>
                  );
                })}

                {computedColumns.map(col => {
                  const val = computedValues[entry.entryId]?.[col.title];
                  return (
                    <div key={col.title} style={{ ...s.readRow, ...s.readRowComputed }}>
                      <span style={s.readKey}>{col.title}</span>
                      <span style={s.readVal}>
                        {val == null ? <span style={{ color: "var(--text-muted)" }}>—</span> : val}
                      </span>
                    </div>
                  );
                })}

                <div style={s.readRow}>
                  <span style={s.readKey}>Notes</span>
                  <span style={s.readVal}>
                    {entry.notes || <span style={{ color: "var(--text-muted)" }}>—</span>}
                  </span>
                </div>

                <div style={s.entryActions}>
                  <button style={s.btnGhost} onClick={() => startEdit(entry)}>Edit</button>
                  <button
                    style={{
                      ...s.btnGhost,
                      ...(confirmDeleteId === entry.entryId
                        ? { background: "var(--danger)", borderColor: "var(--danger)", color: "#fff" }
                        : { color: "var(--danger)" }),
                    }}
                    onClick={() => handleDelete(entry.entryId)}
                  >
                    {confirmDeleteId === entry.entryId ? "Tap to confirm" : "Delete"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
