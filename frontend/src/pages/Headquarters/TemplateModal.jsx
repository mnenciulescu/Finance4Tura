import { useState } from "react";
import { createTemplate, updateTemplate } from "../../api/headquarters";
import Modal from "./Modal";
import s from "./styles";

function defaultForm(locations) {
  return {
    hqId:       locations[0]?.hqId || "",
    name:       "",
    parameters: [{ title: "", type: "number", unit: "" }],
  };
}

export default function TemplateModal({ editing, locations, onClose, onSaved }) {
  const [form, setForm] = useState(() =>
    editing
      ? {
          hqId:       editing.hqId,
          name:       editing.name,
          parameters: editing.parameters.map(p => ({
            parameterId: p.parameterId,
            title:       p.title,
            type:        p.type,
            unit:        p.unit || "",
            order:       p.order ?? 0,
          })),
        }
      : defaultForm(locations)
  );
  const [formError, setFormError] = useState(null);
  const [saving, setSaving]       = useState(false);

  function addParam() {
    if (form.parameters.length >= 30) return;
    setForm(f => ({ ...f, parameters: [...f.parameters, { title: "", type: "number", unit: "" }] }));
  }

  function removeParam(i) {
    setForm(f => ({ ...f, parameters: f.parameters.filter((_, idx) => idx !== i) }));
  }

  function setParamField(i, key, val) {
    setForm(f => ({
      ...f,
      parameters: f.parameters.map((p, idx) => idx === i ? { ...p, [key]: val } : p),
    }));
  }

  function moveParam(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= form.parameters.length) return;
    setForm(f => {
      const arr = [...f.parameters];
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...f, parameters: arr };
    });
  }

  async function handleSave() {
    setFormError(null);
    if (!form.hqId)        { setFormError("Location is required"); return; }
    if (!form.name.trim()) { setFormError("Name is required"); return; }
    if (form.parameters.length === 0) { setFormError("At least 1 parameter required"); return; }
    for (const p of form.parameters) {
      if (!p.title.trim()) { setFormError("All parameters must have a title"); return; }
    }

    const payload = {
      hqId:       form.hqId,
      name:       form.name.trim(),
      parameters: form.parameters.map((p, i) => ({
        ...(p.parameterId ? { parameterId: p.parameterId } : {}),
        title: p.title.trim(),
        type:  p.type,
        unit:  (p.unit || "").trim(),
        order: i,
      })),
    };

    setSaving(true);
    try {
      let result;
      if (editing) {
        result = await updateTemplate(editing.templateId, payload);
      } else {
        result = await createTemplate(payload);
      }
      onSaved(result, !!editing);
      onClose();
    } catch (e) {
      setFormError(e?.response?.data?.message || e.message || "Error saving");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={editing ? "Edit Template" : "New Tracker Template"} onClose={onClose} wide>
      {formError && <div style={s.formError}>{formError}</div>}

      <div style={s.fieldGroup}>
        <label style={s.label}>Location *</label>
        <select
          style={s.select}
          value={form.hqId}
          onChange={e => setForm(f => ({ ...f, hqId: e.target.value }))}
          disabled={!!editing}
        >
          <option value="">— select location —</option>
          {locations.map(loc => (
            <option key={loc.hqId} value={loc.hqId}>{loc.name}</option>
          ))}
        </select>
      </div>

      <div style={s.fieldGroup}>
        <label style={s.label}>Template Name *</label>
        <input
          style={s.input}
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Water Consumption"
          autoFocus
        />
      </div>

      <div style={s.fieldGroup}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <label style={s.label}>Parameters ({form.parameters.length}/30)</label>
          <button style={s.btnSm} onClick={addParam} disabled={form.parameters.length >= 30}>+ Add Parameter</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {form.parameters.map((p, i) => (
            <div key={i} style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <button style={{ ...s.btnIconSm, fontSize: "10px" }} onClick={() => moveParam(i, -1)} disabled={i === 0}>▲</button>
                <button style={{ ...s.btnIconSm, fontSize: "10px" }} onClick={() => moveParam(i, 1)}  disabled={i === form.parameters.length - 1}>▼</button>
              </div>
              <input
                style={{ ...s.input, flex: 1 }}
                placeholder={`Parameter ${i + 1} title`}
                value={p.title}
                onChange={e => setParamField(i, "title", e.target.value)}
              />
              <select
                style={{ ...s.select, width: "100px", flexShrink: 0 }}
                value={p.type}
                onChange={e => setParamField(i, "type", e.target.value)}
              >
                <option value="number">Number</option>
                <option value="text">Text</option>
                <option value="boolean">Boolean</option>
              </select>
              {p.type === "number" && (
                <input
                  style={{ ...s.input, width: "70px", flexShrink: 0 }}
                  placeholder="unit"
                  value={p.unit}
                  onChange={e => setParamField(i, "unit", e.target.value)}
                />
              )}
              <button
                style={{ ...s.btnIcon, color: "var(--danger)", flexShrink: 0 }}
                onClick={() => removeParam(i)}
              >✕</button>
            </div>
          ))}
          {form.parameters.length === 0 && (
            <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>No parameters yet. Add at least one.</div>
          )}
        </div>
      </div>

      <div style={s.modalFooter}>
        <button style={s.btnSecondary} onClick={onClose} disabled={saving}>Cancel</button>
        <button style={s.btnPrimary}   onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}
