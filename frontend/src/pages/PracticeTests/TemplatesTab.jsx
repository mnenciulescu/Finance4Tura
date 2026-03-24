import { useState } from "react";
import { deleteTemplate } from "../../api/practiceTests";
import TemplateModal from "./TemplateModal";
import s from "./styles";

export default function TemplatesTab({ templates, setTemplates }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(tpl) {
    setEditing(tpl);
    setModalOpen(true);
  }

  function handleSaved(result, wasEditing) {
    if (wasEditing) {
      setTemplates(prev => prev.map(t => t.templateId === result.templateId ? result : t));
    } else {
      setTemplates(prev => [result, ...prev]);
    }
  }

  async function handleDelete(tpl) {
    if (!window.confirm(`Delete template "${tpl.name}"?`)) return;
    try {
      await deleteTemplate(tpl.templateId);
      setTemplates(prev => prev.filter(t => t.templateId !== tpl.templateId));
    } catch (e) {
      window.alert("Failed to delete: " + (e?.response?.data?.message || e.message));
    }
  }

  const totalDefault = (tpl) =>
    (tpl.freePoints || 0) + (tpl.topics || []).reduce((acc, t) => acc + (t.defaultPoints || 0), 0);

  return (
    <div style={s.tabContent}>
      <div style={s.toolbar}>
        <button style={s.btnPrimary} onClick={openAdd}>+ New Template</button>
      </div>

      {templates.length === 0 && (
        <div style={s.empty}>No templates yet. Create one to get started.</div>
      )}

      <div style={s.cardGrid}>
        {templates.map(tpl => (
          <div key={tpl.templateId} style={s.card}>
            <div style={s.cardTop}>
              <div>
                <div style={s.cardName}>{tpl.name}</div>
                {tpl.subject && <div style={s.cardSubject}>{tpl.subject}</div>}
              </div>
              <div style={s.cardActions}>
                <button style={s.btnIcon} onClick={() => openEdit(tpl)} title="Edit">✎</button>
                <button style={{ ...s.btnIcon, color: "var(--danger)" }} onClick={() => handleDelete(tpl)} title="Delete">✕</button>
              </div>
            </div>
            <div style={s.metaRow}>
              <span style={s.metaBadge}>{(tpl.topics || []).length} topics</span>
              <span style={s.metaBadge}>{totalDefault(tpl)} pts total</span>
              {tpl.freePoints > 0 && <span style={s.metaBadge}>{tpl.freePoints} free pts</span>}
            </div>
            <div style={s.topicList}>
              {(tpl.topics || []).map((t, i) => (
                <div key={t.topicId || i} style={s.topicRow}>
                  {t.group && <span style={s.topicGroup}>{t.group}</span>}
                  <span style={s.topicTitle}>{t.title}</span>
                  <span style={s.topicPts}>{t.defaultPoints} pts</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <TemplateModal
          editing={editing}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
