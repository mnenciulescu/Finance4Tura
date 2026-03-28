import { useState } from "react";
import { createLocation, updateLocation } from "../../api/headquarters";
import Modal from "./Modal";
import s from "./styles";

export default function LocationModal({ editing, onClose, onSaved }) {
  const [form, setForm]         = useState(() =>
    editing
      ? { name: editing.name, address: editing.address || "", order: editing.order ?? 0 }
      : { name: "", address: "", order: 0 }
  );
  const [formError, setFormError] = useState(null);
  const [saving, setSaving]       = useState(false);

  async function handleSave() {
    setFormError(null);
    if (!form.name.trim()) { setFormError("Name is required"); return; }
    setSaving(true);
    try {
      let result;
      if (editing) {
        result = await updateLocation(editing.hqId, { name: form.name.trim(), address: form.address.trim(), order: Number(form.order) || 0 });
      } else {
        result = await createLocation({ name: form.name.trim(), address: form.address.trim(), order: Number(form.order) || 0 });
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
    <Modal title={editing ? "Edit Location" : "New Location"} onClose={onClose}>
      {formError && <div style={s.formError}>{formError}</div>}

      <div style={s.fieldGroup}>
        <label style={s.label}>Name *</label>
        <input
          style={s.input}
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Main House"
          autoFocus
        />
      </div>

      <div style={s.fieldGroup}>
        <label style={s.label}>Address</label>
        <input
          style={s.input}
          value={form.address}
          onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
          placeholder="Optional address"
        />
      </div>

      <div style={s.fieldGroup}>
        <label style={s.label}>Display Order</label>
        <input
          style={{ ...s.input, width: "80px" }}
          type="number"
          min="0"
          value={form.order}
          onChange={e => setForm(f => ({ ...f, order: e.target.value }))}
        />
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
