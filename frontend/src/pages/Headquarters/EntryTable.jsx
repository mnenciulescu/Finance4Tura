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

  return (
    <div style={s.tableWrap}>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Date</th>
            {params.map(p => (
              <th key={p.parameterId} style={p.type === "number" ? s.thRight : s.th}>
                <span style={{ fontSize: "9px", color: "var(--accent)", marginRight: "3px" }}>{typeIcon(p.type)}</span>
                {p.title}{p.unit ? ` (${p.unit})` : ""}
              </th>
            ))}
            {computedColumns.map(col => (
              <th key={col.title} style={s.thComputed}>{col.title}</th>
            ))}
            <th style={s.th}>Notes</th>
            <th style={s.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {/* New row */}
          {newRow && (
            <tr style={s.inlineEditRow}>
              <td style={s.td}>
                <input
                  type="date"
                  style={{ ...s.inlineInput, width: "130px" }}
                  value={newRow.date}
                  onChange={e => updateNewRowField("date", e.target.value)}
                />
              </td>
              {params.map(p => {
                const v   = newRow.values.find(x => x.parameterId === p.parameterId);
                const val = v !== undefined ? v.value : (p.type === "boolean" ? false : "");
                return (
                  <td key={p.parameterId} style={p.type === "number" ? s.tdRight : s.td}>
                    {p.type === "boolean" ? (
                      <input
                        type="checkbox"
                        checked={!!val}
                        onChange={e => updateNewRowValue(p.parameterId, e.target.checked)}
                      />
                    ) : (
                      <input
                        type={p.type === "number" ? "number" : "text"}
                        style={{
                          ...s.inlineInput,
                          width:     p.type === "number" ? "90px" : "240px",
                          textAlign: p.type === "number" ? "right" : "left",
                        }}
                        value={val}
                        onChange={e => updateNewRowValue(p.parameterId, e.target.value)}
                      />
                    )}
                  </td>
                );
              })}
              {computedColumns.map(col => (
                <td key={col.title} style={s.tdComputed}>
                  <span style={{ color: "var(--text-muted)" }}>—</span>
                </td>
              ))}
              <td style={s.td}>
                <input
                  type="text"
                  style={{ ...s.inlineInput, width: "140px" }}
                  value={newRow.notes}
                  placeholder="notes…"
                  onChange={e => updateNewRowField("notes", e.target.value)}
                />
              </td>
              <td style={s.td}>
                <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                  <button style={s.btnSm} onClick={flushNewRow} disabled={newRowSaving}>
                    {newRowSaving ? "…" : "Save"}
                  </button>
                  <button style={s.btnIcon} onClick={cancelNewRow}>✕</button>
                  {newRowError && (
                    <span style={{ color: "var(--danger)", fontSize: "11px" }}>{newRowError}</span>
                  )}
                </div>
              </td>
            </tr>
          )}

          {/* Empty state */}
          {entries.length === 0 && !newRow && (
            <tr>
              <td
                colSpan={params.length + 3 + computedColumns.length}
                style={{ ...s.td, color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "16px" }}
              >
                No entries yet.
              </td>
            </tr>
          )}

          {/* Existing entries */}
          {entries.map(entry => {
            const isEditing = editingId === entry.entryId;
            return (
              <tr key={entry.entryId} style={isEditing ? s.inlineEditRow : s.tr}>
                <td style={s.td}>
                  {isEditing ? (
                    <input
                      type="date"
                      style={{ ...s.inlineInput, width: "130px" }}
                      value={editData.date}
                      onChange={e => updateEditField("date", e.target.value)}
                    />
                  ) : entry.date}
                </td>
                {params.map(p => {
                  if (isEditing) {
                    const v   = editData.values.find(x => x.parameterId === p.parameterId);
                    const val = v !== undefined ? v.value : (p.type === "boolean" ? false : "");
                    return (
                      <td key={p.parameterId} style={p.type === "number" ? s.tdRight : s.td}>
                        {p.type === "boolean" ? (
                          <input
                            type="checkbox"
                            checked={!!val}
                            onChange={e => updateEditValue(p.parameterId, e.target.checked)}
                          />
                        ) : (
                          <input
                            type={p.type === "number" ? "number" : "text"}
                            style={{
                              ...s.inlineInput,
                              width:     p.type === "number" ? "90px" : "240px",
                              textAlign: p.type === "number" ? "right" : "left",
                            }}
                            value={val}
                            onChange={e => updateEditValue(p.parameterId, e.target.value)}
                          />
                        )}
                      </td>
                    );
                  }
                  // Read mode
                  const v   = (entry.values || []).find(x => x.parameterId === p.parameterId);
                  const val = v?.value;
                  return (
                    <td key={p.parameterId} style={p.type === "number" ? s.tdRight : s.tdTrunc}>
                      {displayValue(val, p.type)}
                    </td>
                  );
                })}
                {computedColumns.map(col => {
                  const val = computedValues[entry.entryId]?.[col.title];
                  return (
                    <td key={col.title} style={s.tdComputed}>
                      {val == null ? <span style={{ color: "var(--text-muted)" }}>—</span> : val}
                    </td>
                  );
                })}
                <td style={s.tdTrunc}>
                  {isEditing ? (
                    <input
                      type="text"
                      style={{ ...s.inlineInput, width: "140px" }}
                      value={editData.notes}
                      placeholder="notes…"
                      onChange={e => updateEditField("notes", e.target.value)}
                    />
                  ) : (
                    entry.notes
                      ? <span title={entry.notes}>{entry.notes}</span>
                      : <span style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </td>
                <td style={s.td}>
                  {isEditing ? (
                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                      <button style={s.btnSm} onClick={flushEdit} disabled={editSaving}>
                        {editSaving ? "…" : "Save"}
                      </button>
                      <button style={s.btnIcon} onClick={cancelEdit}>✕</button>
                      {editError && (
                        <span style={{ color: "var(--danger)", fontSize: "11px" }}>{editError}</span>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                      <button
                        style={s.btnIcon}
                        title="Edit"
                        onClick={() => startEdit(entry)}
                      >✎</button>
                      <button
                        style={{ ...s.btnIcon, color: confirmDeleteId === entry.entryId ? "var(--danger)" : "var(--text-muted)" }}
                        title={confirmDeleteId === entry.entryId ? "Click again to confirm" : "Delete"}
                        onClick={() => handleDelete(entry.entryId)}
                      >
                        {confirmDeleteId === entry.entryId ? "⚠ Del?" : "🗑"}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
