import { useState } from "react";
import { createTemplate, updateTemplate } from "../../api/practiceTests";
import Modal from "./Modal";
import s from "./styles";

function defaultTplForm() {
  return { name: "", subject: "", freePoints: 0, topics: [{ title: "", defaultPoints: 10 }] };
}

export default function TemplateModal({ editing, onClose, onSaved }) {
  const [form, setForm]           = useState(() =>
    editing
      ? {
          name:       editing.name,
          subject:    editing.subject || "",
          freePoints: editing.freePoints || 0,
          topics:     editing.topics.map(t => ({ topicId: t.topicId, title: t.title, defaultPoints: t.defaultPoints, group: t.group || "" })),
        }
      : defaultTplForm()
  );
  const [formError, setFormError] = useState(null);
  const [saving, setSaving]       = useState(false);

  function addTopic() {
    if (form.topics.length >= 30) return;
    setForm(f => ({ ...f, topics: [...f.topics, { title: "", defaultPoints: 10, group: "" }] }));
  }

  function removeTopic(i) {
    setForm(f => ({ ...f, topics: f.topics.filter((_, idx) => idx !== i) }));
  }

  function setTopicField(i, key, val) {
    setForm(f => ({ ...f, topics: f.topics.map((t, idx) => idx === i ? { ...t, [key]: val } : t) }));
  }

  async function handleSave() {
    setFormError(null);
    const payload = {
      name:       form.name.trim(),
      subject:    form.subject.trim(),
      freePoints: parseInt(form.freePoints, 10) || 0,
      topics:     form.topics.map(t => ({
        ...(t.topicId ? { topicId: t.topicId } : {}),
        title:         t.title.trim(),
        defaultPoints: parseInt(t.defaultPoints, 10) || 0,
        group:         (t.group || "").trim(),
      })),
    };
    if (!payload.name) { setFormError("Name is required"); return; }
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
    <Modal title={editing ? "Edit Template" : "New Template"} onClose={onClose}>
      {formError && <div style={s.formError}>{formError}</div>}

      <div style={s.fieldGroup}>
        <label style={s.label}>Name *</label>
        <input
          style={s.input}
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Math Chapter 3"
          autoFocus
        />
      </div>

      <div style={s.fieldGroup}>
        <label style={s.label}>Subject</label>
        <input
          style={s.input}
          value={form.subject}
          onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
          placeholder="e.g. Mathematics"
        />
      </div>

      <div style={s.fieldGroup}>
        <label style={s.label}>Free Points (awarded outside topics)</label>
        <input
          style={{ ...s.input, width: "80px" }}
          type="number" min="0"
          value={form.freePoints}
          onChange={e => setForm(f => ({ ...f, freePoints: e.target.value }))}
        />
      </div>

      <div style={s.fieldGroup}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <label style={s.label}>Topics ({form.topics.length}/30)</label>
          <button style={s.btnSm} onClick={addTopic} disabled={form.topics.length >= 30}>+ Topic</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {form.topics.map((t, i) => (
            <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                style={{ ...s.input, width: "100px", flexShrink: 0 }}
                placeholder="Group"
                value={t.group || ""}
                onChange={e => setTopicField(i, "group", e.target.value)}
              />
              <input
                style={{ ...s.input, flex: 1 }}
                placeholder={`Topic ${i + 1} title`}
                value={t.title}
                onChange={e => setTopicField(i, "title", e.target.value)}
              />
              <input
                style={{ ...s.input, width: "64px" }}
                type="number" min="0"
                placeholder="pts"
                value={t.defaultPoints}
                onChange={e => setTopicField(i, "defaultPoints", e.target.value)}
              />
              <button
                style={{ ...s.btnIcon, color: "var(--danger)" }}
                onClick={() => removeTopic(i)}
              >✕</button>
            </div>
          ))}
        </div>
      </div>

      <div style={s.modalFooter}>
        <button style={s.btnSecondary} onClick={onClose} disabled={saving}>Cancel</button>
        <button style={s.btnPrimary} onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}
