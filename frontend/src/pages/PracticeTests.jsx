import { useState, useEffect, useMemo } from "react";
import dayjs from "dayjs";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  listTemplates, createTemplate, updateTemplate, deleteTemplate,
  listResults, createResult, updateResult, deleteResult,
  getKids, putKids,
} from "../api/practiceTests";

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcTotal(freePoints, topicScores) {
  const sum = (Number(freePoints) || 0) +
    (topicScores || []).reduce((s, t) => s + (Number(t.points) || 0), 0);
  return Math.round(sum * 10) / 10;
}

const today = () => dayjs().format("YYYY-MM-DD");

const CHART_COLORS = ["#86efac", "#60a5fa", "#f9a8d4", "#fcd34d", "#a78bfa", "#34d399", "#fb923c"];

const GROUP_PALETTE = [
  { bg: "rgba(134,239,172,0.10)", border: "rgba(134,239,172,0.55)", solid: "#16a34a" },
  { bg: "rgba(96,165,250,0.10)",  border: "rgba(96,165,250,0.55)",  solid: "#2563eb" },
  { bg: "rgba(249,168,212,0.10)", border: "rgba(249,168,212,0.55)", solid: "#db2777" },
  { bg: "rgba(252,211,77,0.10)",  border: "rgba(252,211,77,0.55)",  solid: "#d97706" },
  { bg: "rgba(167,139,250,0.10)", border: "rgba(167,139,250,0.55)", solid: "#7c3aed" },
  { bg: "rgba(52,211,153,0.10)",  border: "rgba(52,211,153,0.55)",  solid: "#059669" },
  { bg: "rgba(251,146,60,0.10)",  border: "rgba(251,146,60,0.55)",  solid: "#ea580c" },
];

function topicBg(val, maxPts) {
  const n = Number(val) || 0;
  if (n === 0)            return "rgba(239,68,68,0.18)";
  if (n < Number(maxPts)) return "rgba(250,204,21,0.35)";
  return undefined;
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide }) {
  return (
    <div style={s.overlay} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...s.modal, ...(wide ? { maxWidth: "680px" } : {}) }}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>{title}</span>
          <button style={s.modalClose} onClick={onClose}>✕</button>
        </div>
        <div style={s.modalBody}>{children}</div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TABS = ["Results", "Statistics", "Templates", "Kids"];

export default function PracticeTests() {
  const [tab, setTab]           = useState("Results");
  const [templates, setTemplates] = useState([]);
  const [results, setResults]   = useState([]);
  const [kids, setKids]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([listTemplates(), listResults(), getKids()])
      .then(([tpls, res, kd]) => {
        setTemplates(tpls);
        setResults(res);
        setKids(kd.kids || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={s.center}>Loading…</div>;
  if (error)   return <div style={{ ...s.center, color: "var(--danger)" }}>{error}</div>;

  return (
    <div style={s.root}>
      <div style={s.tabBar}>
        {TABS.map(t => (
          <button
            key={t}
            style={{ ...s.tabBtn, ...(tab === t ? s.tabBtnActive : {}) }}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={s.content}>
        {tab === "Templates"  && (
          <TemplatesTab templates={templates} setTemplates={setTemplates} />
        )}
        {tab === "Results"    && (
          <ResultsTab
            templates={templates}
            results={results} setResults={setResults}
            kids={kids} setKids={setKids}
          />
        )}
        {tab === "Statistics" && (
          <StatisticsTab templates={templates} results={results} kids={kids} />
        )}
        {tab === "Kids" && (
          <KidsTab kids={kids} setKids={setKids} />
        )}
      </div>
    </div>
  );
}

// ── Templates Tab ─────────────────────────────────────────────────────────────

function defaultTplForm() {
  return { name: "", subject: "", freePoints: 0, topics: [{ title: "", defaultPoints: 10 }] };
}

function TemplatesTab({ templates, setTemplates }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(defaultTplForm);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving]       = useState(false);

  function openAdd() {
    setEditing(null);
    setForm(defaultTplForm());
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(tpl) {
    setEditing(tpl);
    setForm({
      name:       tpl.name,
      subject:    tpl.subject || "",
      freePoints: tpl.freePoints || 0,
      topics:     tpl.topics.map(t => ({ topicId: t.topicId, title: t.title, defaultPoints: t.defaultPoints, group: t.group || "" })),
    });
    setFormError(null);
    setModalOpen(true);
  }

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
      if (editing) {
        const updated = await updateTemplate(editing.templateId, payload);
        setTemplates(prev => prev.map(t => t.templateId === editing.templateId ? updated : t));
      } else {
        const created = await createTemplate(payload);
        setTemplates(prev => [created, ...prev]);
      }
      setModalOpen(false);
    } catch (e) {
      setFormError(e?.response?.data?.message || e.message || "Error saving");
    } finally {
      setSaving(false);
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
    (tpl.freePoints || 0) + (tpl.topics || []).reduce((s, t) => s + (t.defaultPoints || 0), 0);

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
        <Modal title={editing ? "Edit Template" : "New Template"} onClose={() => setModalOpen(false)}>
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
            <button style={s.btnSecondary} onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
            <button style={s.btnPrimary} onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Results Tab ───────────────────────────────────────────────────────────────

function KidsModal({ kids, onSave, onClose }) {
  const [list, setList]   = useState(kids.map(k => ({ ...k })));
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  function addKid()         { if (list.length < 20) setList(l => [...l, { kidId: "", name: "", order: l.length }]); }
  function removeKid(i)     { setList(l => l.filter((_, idx) => idx !== i)); }
  function setName(i, val)  { setList(l => l.map((k, idx) => idx === i ? { ...k, name: val } : k)); }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await putKids({ kids: list.map((k, i) => ({ ...k, order: i })) });
      onSave(res.kids || []);
      onClose();
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Manage Kids" onClose={onClose}>
      {error && <div style={s.formError}>{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
        {list.map((k, i) => (
          <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              style={{ ...s.input, flex: 1 }}
              value={k.name}
              onChange={e => setName(i, e.target.value)}
              placeholder={`Kid ${i + 1}`}
            />
            <button style={{ ...s.btnIcon, color: "var(--danger)" }} onClick={() => removeKid(i)}>✕</button>
          </div>
        ))}
        {list.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>No kids yet.</div>}
      </div>
      <button style={s.btnSm} onClick={addKid} disabled={list.length >= 20}>+ Add Kid</button>
      <div style={s.modalFooter}>
        <button style={s.btnSecondary} onClick={onClose} disabled={saving}>Cancel</button>
        <button style={s.btnPrimary} onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </Modal>
  );
}

function ResultsTab({ templates, results, setResults, kids, setKids }) {
  const [filterTpl, setFilterTpl] = useState(() => templates[0]?.templateId || "");
  const [filterKid, setFilterKid] = useState(() => kids[0]?.name || "");

  // Inline editable row (shown when both template + kid selected)
  const [inlineRow, setInlineRow]         = useState(null);
  const [inlineSaving, setInlineSaving]   = useState(false);
  const [inlineError, setInlineError]     = useState(null);

  // Inline edit for past results
  const [editingRowId, setEditingRowId]   = useState(null);
  const [editRowData, setEditRowData]     = useState(null);
  const [editRowSaving, setEditRowSaving] = useState(false);
  const [editRowError, setEditRowError]   = useState(null);

  const filterTemplate = useMemo(
    () => templates.find(t => t.templateId === filterTpl) || null,
    [templates, filterTpl]
  );

  const kidNames = useMemo(() => {
    const names = new Set(results.map(r => r.kidName));
    kids.forEach(k => names.add(k.name));
    return [...names].sort();
  }, [results, kids]);

  function openNewTest() {
    const tpl = filterTemplate;
    if (!tpl || !filterKid) return;
    setInlineRow({
      resultId:      null,
      date:          today(),
      sourceTitle:   "",
      freePoints:    tpl.freePoints || 0,
      topicScores:   tpl.topics.map(t => ({ topicId: t.topicId, title: t.title, points: t.defaultPoints })),
      verified:      false,
      totalOverride: null,
    });
    setInlineError(null);
  }

  const filtered = useMemo(() => results.filter(r => {
    if (filterTpl && r.templateId !== filterTpl) return false;
    if (filterKid && r.kidName    !== filterKid) return false;
    return true;
  }), [results, filterTpl, filterKid]);

  const pastResults = useMemo(() => {
    if (!inlineRow?.resultId) return filtered;
    return filtered.filter(r => r.resultId !== inlineRow.resultId);
  }, [filtered, inlineRow]);

  const showInline = !!(filterTpl && filterKid && filterTemplate);
  const topicCols  = filterTemplate?.topics || [];
  const inlineTotal = inlineRow ? calcTotal(inlineRow.freePoints, inlineRow.topicScores) : 0;

  // Group visual info: per topic index, is it a group boundary + which palette entry
  const topicGroupInfo = useMemo(() => {
    const uniqueGroups = [];
    topicCols.forEach(t => {
      const g = t.group || "";
      if (!uniqueGroups.includes(g)) uniqueGroups.push(g);
    });
    return topicCols.map((t, i) => {
      const g = t.group || "";
      const isStart = i === 0 || g !== (topicCols[i - 1].group || "");
      const isEnd = i === topicCols.length - 1 || g !== (topicCols[i + 1].group || "");
      const palette = g ? GROUP_PALETTE[uniqueGroups.indexOf(g) % GROUP_PALETTE.length] : null;
      return { isStart, isEnd, palette };
    });
  }, [topicCols]);

  // Consecutive group spans for the top header row
  const groupSpans = useMemo(() => {
    const spans = [];
    topicCols.forEach((t, i) => {
      const g = t.group || "";
      const { palette } = topicGroupInfo[i] || {};
      if (spans.length === 0 || spans[spans.length - 1].group !== g) {
        spans.push({ group: g, count: 1, palette });
      } else {
        spans[spans.length - 1].count++;
      }
    });
    return spans;
  }, [topicCols, topicGroupInfo]);
  const maxTotal    = filterTemplate
    ? (filterTemplate.freePoints || 0) + filterTemplate.topics.reduce((s, t) => s + (t.defaultPoints || 0), 0)
    : null;

  // ── Inline row handlers ──────────────────────────────────────────────────────

  function setInlineTopic(i, val) {
    setInlineRow(r => ({
      ...r,
      totalOverride: null,
      topicScores: r.topicScores.map((t, idx) => idx === i ? { ...t, points: val } : t),
    }));
  }

  async function handleInlineSave() {
    if (!inlineRow) return;
    setInlineError(null);
    if (!inlineRow.date) { setInlineError("Date is required"); return; }
    setInlineSaving(true);
    try {
      const effectiveTotal = inlineRow.totalOverride !== null
        ? Number(inlineRow.totalOverride)
        : inlineTotal;
      const payload = {
        templateId:  filterTpl,
        kidName:     filterKid,
        date:        inlineRow.date,
        sourceTitle: (inlineRow.sourceTitle || "").trim(),
        freePoints:  Number(inlineRow.freePoints) || 0,
        topicScores: inlineRow.topicScores.map(t => ({ ...t, points: Number(t.points) || 0 })),
        verified:    inlineRow.verified,
        totalScore:  effectiveTotal,
      };
      if (inlineRow.resultId) {
        const updated = await updateResult(inlineRow.resultId, payload);
        setResults(prev => prev.map(r => r.resultId === inlineRow.resultId ? updated : r));
        setInlineRow(r => ({ ...r })); // keep row open
      } else {
        const created = await createResult(payload);
        setResults(prev => [created, ...prev]);
        setInlineRow(r => ({ ...r, resultId: created.resultId }));
      }
    } catch (e) {
      setInlineError(e?.response?.data?.message || e.message || "Error saving");
    } finally {
      setInlineSaving(false);
    }
  }

  // ── Inline edit handlers (past results) ─────────────────────────────────────

  function startEditRow(r) {
    setEditingRowId(r.resultId);
    const computed = calcTotal(r.freePoints || 0, r.topicScores || []);
    setEditRowData({
      date:          r.date,
      sourceTitle:   r.sourceTitle || "",
      freePoints:    r.freePoints || 0,
      topicScores:   (r.topicScores || []).map(t => ({ ...t })),
      verified:      r.verified || false,
      totalOverride: r.totalScore !== computed ? r.totalScore : null,
    });
    setEditRowError(null);
  }

  function setEditRowTopic(i, val) {
    setEditRowData(d => ({
      ...d,
      totalOverride: null,
      topicScores: d.topicScores.map((t, idx) => idx === i ? { ...t, points: val } : t),
    }));
  }

  const editRowTotal = editRowData ? calcTotal(editRowData.freePoints, editRowData.topicScores) : 0;

  async function handleEditRowSave() {
    if (!editingRowId || !editRowData) return;
    setEditRowError(null);
    setEditRowSaving(true);
    try {
      const editEffectiveTotal = editRowData.totalOverride !== null
        ? Number(editRowData.totalOverride)
        : editRowTotal;
      const payload = {
        date:        editRowData.date,
        sourceTitle: (editRowData.sourceTitle || "").trim(),
        freePoints:  Number(editRowData.freePoints) || 0,
        topicScores: editRowData.topicScores.map(t => ({ ...t, points: Number(t.points) || 0 })),
        verified:    editRowData.verified,
        totalScore:  editEffectiveTotal,
      };
      const updated = await updateResult(editingRowId, payload);
      setResults(prev => prev.map(r => r.resultId === editingRowId ? updated : r));
      setEditingRowId(null);
      setEditRowData(null);
    } catch (e) {
      setEditRowError(e?.response?.data?.message || e.message || "Error saving");
    } finally {
      setEditRowSaving(false);
    }
  }

  function cancelEditRow() {
    setEditingRowId(null);
    setEditRowData(null);
    setEditRowError(null);
  }

  async function handleDelete(r) {
    if (!window.confirm(`Delete result for ${r.kidName} on ${r.date}?`)) return;
    try {
      await deleteResult(r.resultId);
      setResults(prev => prev.filter(x => x.resultId !== r.resultId));
    } catch { window.alert("Delete failed"); }
  }

  async function toggleVerified(r) {
    try {
      const updated = await updateResult(r.resultId, { verified: !r.verified });
      setResults(prev => prev.map(x => x.resultId === r.resultId ? updated : x));
    } catch (e) { console.error(e); }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={s.tabContent}>
      {/* Filters + New Test */}
      <div style={{ ...s.filterBar, justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <select style={s.filterSel} value={filterTpl} onChange={e => { setFilterTpl(e.target.value); setInlineRow(null); }}>
            <option value="">All templates</option>
            {templates.map(t => <option key={t.templateId} value={t.templateId}>{t.name}</option>)}
          </select>
          <select style={s.filterSel} value={filterKid} onChange={e => { setFilterKid(e.target.value); setInlineRow(null); }}>
            <option value="">All kids</option>
            {kidNames.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <button
          style={{ ...s.btnPrimary, opacity: showInline ? 1 : 0.45, cursor: showInline ? "pointer" : "default" }}
          onClick={openNewTest}
          disabled={!showInline}
          title={!showInline ? "Select a template and a kid first" : ""}
        >
          + New Test
        </button>
      </div>

      {/* ── Inline table: template + kid selected ── */}
      {showInline && (
        <div style={s.tableWrap}>
          {inlineError && (
            <div style={{ ...s.formError, margin: "8px 12px 4px" }}>{inlineError}</div>
          )}
          {editRowError && (
            <div style={{ ...s.formError, margin: "8px 12px 4px" }}>{editRowError}</div>
          )}
          <table style={s.table}>
            <thead>
              {/* Row 1: group spans */}
              <tr>
                <th rowSpan={2} style={{ ...s.th, textAlign: "center", color: "var(--badge-text)", verticalAlign: "middle" }}>Total</th>
                <th rowSpan={2} style={{ ...s.th, verticalAlign: "middle" }}>Date</th>
                <th rowSpan={2} style={{ ...s.th, verticalAlign: "middle" }}>Source</th>
                {groupSpans.map((gs, idx) =>
                  gs.group ? (
                    <th key={idx} colSpan={gs.count} style={{ ...s.th, textAlign: "center", background: gs.palette.bg, borderLeft: `2px solid ${gs.palette.border}`, borderRight: `2px solid ${gs.palette.border}`, padding: "4px 4px 2px" }}>
                      <span style={{ display: "inline-block", fontSize: "8px", fontWeight: 700, color: "#fff", background: gs.palette.solid, borderRadius: "3px", padding: "1px 6px", letterSpacing: "0.04em" }}>{gs.group}</span>
                    </th>
                  ) : (
                    <th key={idx} colSpan={gs.count} style={s.th} />
                  )
                )}
                {filterTemplate.freePoints > 0 && <th rowSpan={2} style={{ ...s.th, textAlign: "center", verticalAlign: "middle" }}>Free</th>}
                <th rowSpan={2} style={{ ...s.th, textAlign: "center", verticalAlign: "middle" }}>✓</th>
                <th rowSpan={2} style={s.th} />
              </tr>
              {/* Row 2: individual topic columns */}
              <tr>
                {topicCols.map((t, i) => {
                  const { isStart, isEnd, palette } = topicGroupInfo[i] || {};
                  return (
                    <th key={t.topicId} style={{
                      ...s.th, textAlign: "center", maxWidth: "62px",
                      ...(palette ? { background: palette.bg } : {}),
                      ...(isStart && palette ? { borderLeft: `2px solid ${palette.border}` } : {}),
                      ...(isEnd && palette ? { borderRight: `2px solid ${palette.border}` } : {}),
                    }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "58px", margin: "0 auto" }} title={t.title}>{t.title}</div>
                      <div style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 400 }}>{t.defaultPoints}p</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {/* Today's editable row */}
              {inlineRow && (
                <tr style={s.inlineEditRow}>
                  <td style={{ ...s.td, textAlign: "center", padding: "5px 3px" }}>
                    <input
                      style={{ ...s.inlineInput, width: "50px", textAlign: "center", fontWeight: 700, color: "var(--badge-text)" }}
                      type="number" min="0"
                      value={inlineRow.totalOverride !== null ? inlineRow.totalOverride : inlineTotal}
                      onChange={e => setInlineRow(r => ({ ...r, totalOverride: e.target.value === "" ? null : e.target.value }))}
                    />
                  </td>
                  <td style={s.td}>
                    <input
                      style={{ ...s.inlineInput, width: "108px" }}
                      type="date"
                      value={inlineRow.date}
                      onChange={e => setInlineRow(r => ({ ...r, date: e.target.value }))}
                    />
                  </td>
                  <td style={s.td}>
                    <input
                      style={{ ...s.inlineInput, width: "76px" }}
                      placeholder="source…"
                      value={inlineRow.sourceTitle}
                      onChange={e => setInlineRow(r => ({ ...r, sourceTitle: e.target.value }))}
                    />
                  </td>
                  {inlineRow.topicScores.map((t, i) => {
                    const maxPts = topicCols[i]?.defaultPoints ?? Infinity;
                    const { isStart, isEnd, palette } = topicGroupInfo[i] || {};
                    return (
                      <td key={t.topicId} style={{ ...s.td, textAlign: "center", padding: "5px 3px", background: topicBg(t.points, maxPts), ...(isStart && palette ? { borderLeft: `2px solid ${palette.border}` } : {}), ...(isEnd && palette ? { borderRight: `2px solid ${palette.border}` } : {}) }}>
                        <input
                          style={{ ...s.inlineInput, width: "42px", textAlign: "center", background: "transparent" }}
                          type="number" min="0" max={maxPts}
                          value={t.points}
                          onChange={e => {
                            const raw = e.target.value;
                            if (raw === "") { setInlineTopic(i, ""); return; }
                            const clamped = Math.min(Number(raw), maxPts);
                            setInlineTopic(i, isNaN(clamped) ? 0 : clamped);
                          }}
                        />
                      </td>
                    );
                  })}
                  {filterTemplate.freePoints > 0 && (
                    <td style={{ ...s.td, textAlign: "center", padding: "5px 3px" }}>
                      <input
                        style={{ ...s.inlineInput, width: "42px", textAlign: "center" }}
                        type="number" min="0"
                        value={inlineRow.freePoints}
                        onChange={e => setInlineRow(r => ({ ...r, freePoints: e.target.value, totalOverride: null }))}
                      />
                    </td>
                  )}
                  <td style={{ ...s.td, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={inlineRow.verified}
                      onChange={e => setInlineRow(r => ({ ...r, verified: e.target.checked }))}
                      style={{ cursor: "pointer" }}
                    />
                  </td>
                  <td style={{ ...s.td, whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button
                        style={{ ...s.btnPrimary, padding: "4px 10px", fontSize: "11px" }}
                        onClick={handleInlineSave}
                        disabled={inlineSaving}
                      >
                        {inlineSaving ? "…" : "Save"}
                      </button>
                      <button
                        style={{ ...s.btnIconSm, fontSize: "13px" }}
                        onClick={() => setInlineRow(null)}
                        title="Cancel"
                      >✕</button>
                    </div>
                  </td>
                </tr>
              )}

              {/* Past results */}
              {pastResults.length === 0 ? (
                <tr>
                  <td
                    colSpan={2 + topicCols.length + (filterTemplate.freePoints > 0 ? 1 : 0) + 3}
                    style={{ padding: "14px", color: "var(--text-muted)", fontSize: "12px", fontStyle: "italic", textAlign: "center" }}
                  >
                    No past results for this combination.
                  </td>
                </tr>
              ) : pastResults.map(r => {
                const isEditing = r.resultId === editingRowId;
                const topicMap  = Object.fromEntries((r.topicScores || []).map(t => [t.topicId, t.points]));
                if (isEditing && editRowData) {
                  return (
                    <tr key={r.resultId} style={s.inlineEditRow}>
                      <td style={{ ...s.td, textAlign: "center", padding: "5px 3px" }}>
                        <input
                          style={{ ...s.inlineInput, width: "50px", textAlign: "center", fontWeight: 700, color: "var(--badge-text)" }}
                          type="number" min="0"
                          value={editRowData.totalOverride !== null ? editRowData.totalOverride : editRowTotal}
                          onChange={e => setEditRowData(d => ({ ...d, totalOverride: e.target.value === "" ? null : e.target.value }))}
                        />
                      </td>
                      <td style={s.td}>
                        <input
                          style={{ ...s.inlineInput, width: "108px" }}
                          type="date"
                          value={editRowData.date}
                          onChange={e => setEditRowData(d => ({ ...d, date: e.target.value }))}
                        />
                      </td>
                      <td style={s.td}>
                        <input
                          style={{ ...s.inlineInput, width: "76px" }}
                          placeholder="source…"
                          value={editRowData.sourceTitle}
                          onChange={e => setEditRowData(d => ({ ...d, sourceTitle: e.target.value }))}
                        />
                      </td>
                      {editRowData.topicScores.map((t, i) => {
                        const maxPts = topicCols[i]?.defaultPoints ?? Infinity;
                        const { isStart, isEnd, palette } = topicGroupInfo[i] || {};
                        return (
                          <td key={t.topicId} style={{ ...s.td, textAlign: "center", padding: "5px 3px", background: topicBg(t.points, maxPts), ...(isStart && palette ? { borderLeft: `2px solid ${palette.border}` } : {}), ...(isEnd && palette ? { borderRight: `2px solid ${palette.border}` } : {}) }}>
                            <input
                              style={{ ...s.inlineInput, width: "42px", textAlign: "center", background: "transparent" }}
                              type="number" min="0" max={maxPts}
                              value={t.points}
                              onChange={e => {
                                const raw = e.target.value;
                                if (raw === "") { setEditRowTopic(i, ""); return; }
                                const clamped = Math.min(Number(raw), maxPts);
                                setEditRowTopic(i, isNaN(clamped) ? 0 : clamped);
                              }}
                            />
                          </td>
                        );
                      })}
                      {filterTemplate.freePoints > 0 && (
                        <td style={{ ...s.td, textAlign: "center", padding: "5px 3px" }}>
                          <input
                            style={{ ...s.inlineInput, width: "42px", textAlign: "center" }}
                            type="number" min="0"
                            value={editRowData.freePoints}
                            onChange={e => setEditRowData(d => ({ ...d, freePoints: e.target.value, totalOverride: null }))}
                          />
                        </td>
                      )}
                      <td style={{ ...s.td, textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={editRowData.verified}
                          onChange={e => setEditRowData(d => ({ ...d, verified: e.target.checked }))}
                          style={{ cursor: "pointer" }}
                        />
                      </td>
                      <td style={{ ...s.td, whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: "4px" }}>
                          <button
                            style={{ ...s.btnPrimary, padding: "4px 10px", fontSize: "11px" }}
                            onClick={handleEditRowSave}
                            disabled={editRowSaving}
                          >
                            {editRowSaving ? "…" : "Save"}
                          </button>
                          <button style={{ ...s.btnIconSm, fontSize: "13px" }} onClick={cancelEditRow} title="Cancel">✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={r.resultId} style={s.tr}>
                    <td style={{ ...s.td, textAlign: "center", fontWeight: 700, color: "var(--badge-text)" }}>
                      {(r.totalScore / 10).toFixed(1)}
                    </td>
                    <td style={s.td}>{r.date}</td>
                    <td style={{ ...s.td, color: "var(--text-muted)" }}>{r.sourceTitle || "—"}</td>
                    {topicCols.map((t, i) => {
                      const val = topicMap[t.topicId];
                      const { isStart, isEnd, palette } = topicGroupInfo[i] || {};
                      return (
                        <td key={t.topicId} style={{ ...s.td, textAlign: "center", padding: "5px 3px", background: topicBg(val ?? 0, t.defaultPoints), ...(isStart && palette ? { borderLeft: `2px solid ${palette.border}` } : {}), ...(isEnd && palette ? { borderRight: `2px solid ${palette.border}` } : {}) }}>
                          {val ?? "—"}
                        </td>
                      );
                    })}
                    {filterTemplate.freePoints > 0 && (
                      <td style={{ ...s.td, textAlign: "center", padding: "5px 3px" }}>{r.freePoints || 0}</td>
                    )}
                    <td style={{ ...s.td, textAlign: "center" }}>
                      <button
                        style={{ ...s.verifiedBtn, ...(r.verified ? s.verifiedOn : {}) }}
                        onClick={() => toggleVerified(r)}
                      >
                        {r.verified ? "✓" : "○"}
                      </button>
                    </td>
                    <td style={{ ...s.td, whiteSpace: "nowrap" }}>
                      <button style={s.btnIconSm} onClick={() => startEditRow(r)} title="Edit">✎</button>
                      <button style={{ ...s.btnIconSm, color: "var(--danger)" }} onClick={() => handleDelete(r)} title="Delete">✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Generic table: no template+kid selected ── */}
      {!showInline && filtered.length > 0 && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Kid</th>
                <th style={s.th}>Date</th>
                <th style={s.th}>Source</th>
                <th style={s.th}>Template</th>
                <th style={{ ...s.th, textAlign: "center", color: "var(--badge-text)" }}>Total</th>
                <th style={{ ...s.th, textAlign: "center" }}>✓</th>
                <th style={s.th} />
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const isEditing = r.resultId === editingRowId;
                if (isEditing && editRowData) {
                  return (
                    <tr key={r.resultId} style={s.inlineEditRow}>
                      <td style={s.td}>{r.kidName}</td>
                      <td style={s.td}>
                        <input
                          style={{ ...s.inlineInput, width: "108px" }}
                          type="date"
                          value={editRowData.date}
                          onChange={e => setEditRowData(d => ({ ...d, date: e.target.value }))}
                        />
                      </td>
                      <td style={s.td}>
                        <input
                          style={{ ...s.inlineInput, width: "76px" }}
                          placeholder="source…"
                          value={editRowData.sourceTitle}
                          onChange={e => setEditRowData(d => ({ ...d, sourceTitle: e.target.value }))}
                        />
                      </td>
                      <td style={{ ...s.td, color: "var(--text-muted)", fontSize: "11px" }}>{r.templateName || "—"}</td>
                      <td style={{ ...s.td, textAlign: "center", padding: "5px 3px" }}>
                        <input
                          style={{ ...s.inlineInput, width: "50px", textAlign: "center", fontWeight: 700, color: "var(--badge-text)" }}
                          type="number" min="0"
                          value={editRowData.totalOverride !== null ? editRowData.totalOverride : editRowTotal}
                          onChange={e => setEditRowData(d => ({ ...d, totalOverride: e.target.value === "" ? null : e.target.value }))}
                        />
                      </td>
                      <td style={{ ...s.td, textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={editRowData.verified}
                          onChange={e => setEditRowData(d => ({ ...d, verified: e.target.checked }))}
                          style={{ cursor: "pointer" }}
                        />
                      </td>
                      <td style={{ ...s.td, whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: "4px" }}>
                          <button
                            style={{ ...s.btnPrimary, padding: "4px 10px", fontSize: "11px" }}
                            onClick={handleEditRowSave}
                            disabled={editRowSaving}
                          >
                            {editRowSaving ? "…" : "Save"}
                          </button>
                          <button style={{ ...s.btnIconSm, fontSize: "13px" }} onClick={cancelEditRow} title="Cancel">✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={r.resultId} style={s.tr}>
                    <td style={s.td}>{r.kidName}</td>
                    <td style={s.td}>{r.date}</td>
                    <td style={{ ...s.td, color: "var(--text-muted)" }}>{r.sourceTitle || "—"}</td>
                    <td style={{ ...s.td, color: "var(--text-muted)", fontSize: "11px" }}>{r.templateName || "—"}</td>
                    <td style={{ ...s.td, textAlign: "center", fontWeight: 700, color: "var(--badge-text)" }}>
                      {(r.totalScore / 10).toFixed(1)}
                    </td>
                    <td style={{ ...s.td, textAlign: "center" }}>
                      <button
                        style={{ ...s.verifiedBtn, ...(r.verified ? s.verifiedOn : {}) }}
                        onClick={() => toggleVerified(r)}
                      >
                        {r.verified ? "✓" : "○"}
                      </button>
                    </td>
                    <td style={{ ...s.td, whiteSpace: "nowrap" }}>
                      <button style={s.btnIconSm} onClick={() => startEditRow(r)} title="Edit">✎</button>
                      <button style={{ ...s.btnIconSm, color: "var(--danger)" }} onClick={() => handleDelete(r)} title="Delete">✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!showInline && filtered.length === 0 && (
        <div style={s.empty}>
          {templates.length === 0
            ? "Create a template first, then add results."
            : "Select a template and a kid above to enter today's result, or filter to view existing ones."}
        </div>
      )}

    </div>
  );
}

// ── Kids Tab ──────────────────────────────────────────────────────────────────

function KidsTab({ kids, setKids }) {
  const [list, setList]     = useState(kids.map(k => ({ ...k })));
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const [saved, setSaved]   = useState(false);

  function addKid()        { if (list.length < 20) setList(l => [...l, { kidId: "", name: "", order: l.length }]); }
  function removeKid(i)    { setList(l => l.filter((_, idx) => idx !== i)); }
  function setName(i, val) { setList(l => l.map((k, idx) => idx === i ? { ...k, name: val } : k)); setSaved(false); }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await putKids({ kids: list.map((k, i) => ({ ...k, order: i })) });
      setKids(res.kids || []);
      setList(res.kids || []);
      setSaved(true);
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={s.tabContent}>
      <div style={s.toolbar}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {saved && <span style={{ fontSize: "12px", color: "var(--badge-text)" }}>Saved ✓</span>}
          <button style={s.btnSm} onClick={addKid} disabled={list.length >= 20}>+ Add Kid</button>
          <button style={s.btnPrimary} onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {error && <div style={s.formError}>{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxWidth: "400px" }}>
        {list.length === 0 && (
          <div style={s.empty}>No kids yet. Add one to get started.</div>
        )}
        {list.map((k, i) => (
          <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", width: "20px", textAlign: "right", flexShrink: 0 }}>{i + 1}.</span>
            <input
              style={{ ...s.input, flex: 1 }}
              value={k.name}
              onChange={e => setName(i, e.target.value)}
              placeholder={`Kid ${i + 1} name`}
            />
            <button style={{ ...s.btnIcon, color: "var(--danger)" }} onClick={() => { if (window.confirm(`Remove "${k.name || `Kid ${i + 1}`}"?`)) { removeKid(i); setSaved(false); } }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Statistics Tab ────────────────────────────────────────────────────────────

function StatisticsTab({ templates, results, kids }) {
  const [filterTpl, setFilterTpl] = useState("");

  const filtered = useMemo(() =>
    filterTpl ? results.filter(r => r.templateId === filterTpl) : results,
    [results, filterTpl]
  );

  // Per-kid summary
  const kidStats = useMemo(() => {
    const map = {};
    for (const r of filtered) {
      if (!map[r.kidName]) map[r.kidName] = { kidName: r.kidName, scores: [], count: 0 };
      map[r.kidName].scores.push(r.totalScore);
      map[r.kidName].count++;
    }
    return Object.values(map).map(k => ({
      kidName: k.kidName,
      count:   k.count,
      avg:     +(k.scores.reduce((a, b) => a + b, 0) / k.scores.length).toFixed(1),
      max:     Math.max(...k.scores),
      min:     Math.min(...k.scores),
    })).sort((a, b) => b.avg - a.avg);
  }, [filtered]);

  // Score distribution buckets (0–9, 10–19, … or adaptive)
  const scoreDistribution = useMemo(() => {
    if (filtered.length === 0) return [];
    const scores = filtered.map(r => r.totalScore);
    const maxScore = Math.max(...scores);
    // Use 10 bins across the range
    const binCount = 10;
    const binSize  = Math.max(1, Math.ceil(maxScore / binCount));
    const bins = {};
    for (const s of scores) {
      const label = `${Math.floor(s / binSize) * binSize}–${Math.floor(s / binSize) * binSize + binSize - 1}`;
      bins[label] = (bins[label] || 0) + 1;
    }
    return Object.entries(bins).map(([range, count]) => ({ range, count }));
  }, [filtered]);

  // Progress over time per kid (last 30 results per kid)
  const progressData = useMemo(() => {
    const byDate = {};
    for (const r of [...filtered].sort((a, b) => a.date.localeCompare(b.date))) {
      if (!byDate[r.date]) byDate[r.date] = { date: r.date };
      // Average if multiple results same date+kid
      if (byDate[r.date][r.kidName] === undefined) {
        byDate[r.date][r.kidName] = r.totalScore;
      } else {
        byDate[r.date][r.kidName] = +((byDate[r.date][r.kidName] + r.totalScore) / 2).toFixed(1);
      }
    }
    return Object.values(byDate).slice(-30);
  }, [filtered]);

  const kidList = useMemo(() => [...new Set(filtered.map(r => r.kidName))].sort(), [filtered]);

  // Topic weakness: avg points per topic per kid
  const topicWeakness = useMemo(() => {
    const topicTotals = {};
    for (const r of filtered) {
      for (const t of (r.topicScores || [])) {
        if (!topicTotals[t.title]) topicTotals[t.title] = { title: t.title, sum: 0, count: 0 };
        topicTotals[t.title].sum   += t.points;
        topicTotals[t.title].count += 1;
      }
    }
    return Object.values(topicTotals)
      .map(t => ({ title: t.title, avg: +(t.sum / t.count).toFixed(1) }))
      .sort((a, b) => a.avg - b.avg);
  }, [filtered]);

  if (results.length === 0) {
    return <div style={{ ...s.tabContent, ...s.empty }}>No results yet. Add some results first.</div>;
  }

  return (
    <div style={s.tabContent}>
      <div style={s.toolbar}>
        <select style={s.filterSel} value={filterTpl} onChange={e => setFilterTpl(e.target.value)}>
          <option value="">All templates</option>
          {templates.map(t => <option key={t.templateId} value={t.templateId}>{t.name}</option>)}
        </select>
      </div>

      <div style={s.statsGrid}>

        {/* Per-kid summary table */}
        <div style={s.statsCard}>
          <div style={s.statsCardTitle}>Per-Kid Summary</div>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Kid</th>
                <th style={{ ...s.th, textAlign: "center" }}>Tests</th>
                <th style={{ ...s.th, textAlign: "center" }}>Avg</th>
                <th style={{ ...s.th, textAlign: "center" }}>Max</th>
                <th style={{ ...s.th, textAlign: "center" }}>Min</th>
              </tr>
            </thead>
            <tbody>
              {kidStats.map(k => (
                <tr key={k.kidName} style={s.tr}>
                  <td style={s.td}>{k.kidName}</td>
                  <td style={{ ...s.td, textAlign: "center" }}>{k.count}</td>
                  <td style={{ ...s.td, textAlign: "center", fontWeight: 700, color: "var(--badge-text)" }}>{k.avg}</td>
                  <td style={{ ...s.td, textAlign: "center" }}>{k.max}</td>
                  <td style={{ ...s.td, textAlign: "center", color: "var(--text-muted)" }}>{k.min}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Score distribution */}
        {scoreDistribution.length > 0 && (
          <div style={s.statsCard}>
            <div style={s.statsCardTitle}>Score Distribution</div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={scoreDistribution} margin={{ top: 4, right: 8, left: -30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="range" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }}
                  labelStyle={{ color: "var(--text)" }}
                />
                <Bar dataKey="count" name="Results" fill="#86efac" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Progress over time */}
        {progressData.length > 1 && kidList.length > 0 && (
          <div style={{ ...s.statsCard, gridColumn: "1 / -1" }}>
            <div style={s.statsCardTitle}>Progress Over Time</div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={progressData} margin={{ top: 4, right: 8, left: -30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }}
                  labelStyle={{ color: "var(--text)" }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                {kidList.map((kid, i) => (
                  <Line
                    key={kid}
                    type="monotone"
                    dataKey={kid}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Topic weakness */}
        {topicWeakness.length > 0 && (
          <div style={s.statsCard}>
            <div style={s.statsCardTitle}>Topic Averages (lowest first)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {topicWeakness.map((t, i) => {
                const maxAvg = topicWeakness[topicWeakness.length - 1]?.avg || 1;
                const pct = maxAvg > 0 ? (t.avg / maxAvg) * 100 : 0;
                return (
                  <div key={t.title}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                      <span style={{ fontSize: "12px", color: "var(--text)" }}>{t.title}</span>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: i < 3 ? "#f87171" : "var(--badge-text)" }}>
                        {t.avg}
                      </span>
                    </div>
                    <div style={{ height: "4px", background: "var(--surface-2)", borderRadius: "2px" }}>
                      <div style={{ height: "100%", width: `${pct}%`, borderRadius: "2px", background: i < 3 ? "#f87171" : "#86efac", transition: "width 0.3s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  root: {
    display:       "flex",
    flexDirection: "column",
    flex:          1,
    minHeight:     0,
    overflow:      "hidden",
  },
  center: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    flex:           1,
    color:          "var(--text-muted)",
    fontSize:       "14px",
  },
  tabBar: {
    display:        "flex",
    gap:            "2px",
    padding:        "10px 30px 0",
    background:     "var(--surface)",
    borderBottom:   "1px solid var(--border)",
    flexShrink:     0,
  },
  tabBtn: {
    background:     "transparent",
    border:         "none",
    borderBottom:   "2px solid var(--border)",
    padding:        "7px 16px",
    fontSize:       "13px",
    fontWeight:     500,
    color:          "var(--text-muted)",
    cursor:         "pointer",
    fontFamily:     "inherit",
    transition:     "color 0.15s",
    marginBottom:   "-1px",
  },
  tabBtnActive: {
    color:          "var(--text)",
    borderBottomColor: "var(--badge-text)",
  },
  content: {
    flex:      1,
    minHeight: 0,
    overflowY: "auto",
  },
  tabContent: {
    padding: "30px 24px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  toolbar: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    flexWrap:       "wrap",
    gap:            "8px",
  },
  toolbarTitle: {
    fontSize:   "15px",
    fontWeight: 700,
    color:      "var(--text)",
    display:    "flex",
    alignItems: "center",
    gap:        "6px",
  },
  count: {
    background:   "var(--surface-2)",
    border:       "1px solid var(--border)",
    borderRadius: "10px",
    padding:      "1px 7px",
    fontSize:     "11px",
    fontWeight:   500,
    color:        "var(--text-muted)",
  },
  filterBar: {
    display:    "flex",
    alignItems: "center",
    gap:        "8px",
    flexWrap:   "wrap",
  },
  filterSel: {
    background:   "var(--surface-2)",
    border:       "1px solid var(--border)",
    borderRadius: "7px",
    color:        "var(--text)",
    fontSize:     "12px",
    padding:      "5px 10px",
    cursor:       "pointer",
    outline:      "none",
  },
  filterInput: {
    background:   "var(--surface-2)",
    border:       "1px solid var(--border)",
    borderRadius: "7px",
    color:        "var(--text)",
    fontSize:     "12px",
    padding:      "5px 10px",
    outline:      "none",
  },
  empty: {
    color:      "var(--text-muted)",
    fontSize:   "13px",
    fontStyle:  "italic",
    padding:    "24px 0",
    textAlign:  "center",
  },

  // Cards grid (templates)
  cardGrid: {
    display:             "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap:                 "14px",
  },
  card: {
    background:   "var(--surface)",
    border:       "1px solid var(--border)",
    borderRadius: "12px",
    padding:      "14px 16px",
    display:      "flex",
    flexDirection:"column",
    gap:          "10px",
  },
  cardTop: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "flex-start",
    gap:            "8px",
  },
  cardName: {
    fontSize:   "14px",
    fontWeight: 700,
    color:      "var(--text)",
  },
  cardSubject: {
    fontSize:   "11px",
    color:      "var(--text-muted)",
    marginTop:  "2px",
  },
  cardActions: {
    display:    "flex",
    gap:        "4px",
    flexShrink: 0,
  },
  metaRow: {
    display:  "flex",
    gap:      "6px",
    flexWrap: "wrap",
  },
  metaBadge: {
    background:   "var(--surface-2)",
    border:       "1px solid var(--border)",
    borderRadius: "8px",
    padding:      "2px 8px",
    fontSize:     "11px",
    color:        "var(--text-muted)",
  },
  topicList: {
    display:       "flex",
    flexDirection: "column",
    gap:           "3px",
  },
  topicRow: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    padding:        "3px 8px",
    background:     "var(--surface-2)",
    borderRadius:   "5px",
  },
  topicGroup: {
    fontSize:     "10px",
    color:        "var(--text-muted)",
    background:   "var(--surface-3, rgba(255,255,255,0.07))",
    borderRadius: "3px",
    padding:      "1px 5px",
    marginRight:  "4px",
    flexShrink:   0,
  },
  topicTitle: {
    fontSize: "12px",
    color:    "var(--text)",
    flex:     1,
  },
  topicPts: {
    fontSize: "11px",
    color:    "var(--text-muted)",
  },

  // Table
  tableWrap: {
    overflowX: "auto",
    borderRadius: "10px",
    border:       "1px solid var(--border)",
  },
  table: {
    width:           "100%",
    borderCollapse:  "collapse",
    fontSize:        "12px",
  },
  th: {
    padding:       "5px 7px",
    textAlign:     "left",
    fontWeight:    600,
    color:         "var(--text-muted)",
    background:    "var(--surface)",
    borderBottom:  "1px solid var(--border)",
    whiteSpace:    "nowrap",
    fontSize:      "11px",
  },
  tr: {
    borderBottom: "1px solid var(--border)",
  },
  td: {
    padding:   "5px 7px",
    color:     "var(--text)",
    whiteSpace:"nowrap",
  },
  inlineEditRow: {
    background:     "rgba(134,239,172,0.06)",
    borderBottom:   "1px solid var(--border)",
    borderLeft:     "3px solid var(--badge-text)",
  },
  inlineInput: {
    background:   "var(--surface)",
    border:       "1px solid var(--border)",
    borderRadius: "5px",
    color:        "var(--text)",
    fontSize:     "12px",
    padding:      "4px 6px",
    outline:      "none",
    fontFamily:   "inherit",
    boxSizing:    "border-box",
    transition:   "border-color 0.15s",
  },
  verifiedBtn: {
    background:   "transparent",
    border:       "1px solid var(--border)",
    borderRadius: "50%",
    width:        "22px",
    height:       "22px",
    display:      "flex",
    alignItems:   "center",
    justifyContent: "center",
    cursor:       "pointer",
    fontSize:     "11px",
    color:        "var(--text-muted)",
    padding:      0,
    transition:   "background 0.15s, border-color 0.15s",
  },
  verifiedOn: {
    background:  "var(--success-bg)",
    borderColor: "var(--accent)",
    color:       "var(--badge-text)",
  },

  // Statistics
  statsGrid: {
    display:             "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
    gap:                 "16px",
  },
  statsCard: {
    background:   "var(--surface)",
    border:       "1px solid var(--border)",
    borderRadius: "12px",
    padding:      "14px 16px",
    display:      "flex",
    flexDirection:"column",
    gap:          "12px",
  },
  statsCardTitle: {
    fontSize:   "11px",
    fontWeight: 700,
    color:      "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  // Modal
  overlay: {
    position:       "fixed",
    inset:          0,
    background:     "rgba(0,0,0,0.55)",
    zIndex:         500,
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    padding:        "16px",
  },
  modal: {
    background:   "var(--surface)",
    border:       "1px solid var(--border)",
    borderRadius: "14px",
    width:        "100%",
    maxWidth:     "480px",
    maxHeight:    "90vh",
    display:      "flex",
    flexDirection:"column",
    boxShadow:    "0 30px 60px rgba(0,0,0,0.4)",
  },
  modalHeader: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    padding:        "14px 18px",
    borderBottom:   "1px solid var(--border)",
    flexShrink:     0,
  },
  modalTitle: {
    fontSize:   "14px",
    fontWeight: 700,
    color:      "var(--text)",
  },
  modalClose: {
    background:   "transparent",
    border:       "none",
    color:        "var(--text-muted)",
    fontSize:     "16px",
    cursor:       "pointer",
    lineHeight:   1,
    padding:      "2px 4px",
  },
  modalBody: {
    padding:   "18px",
    overflowY: "auto",
    flex:      1,
    display:   "flex",
    flexDirection: "column",
    gap:       "12px",
  },
  modalFooter: {
    display:        "flex",
    justifyContent: "flex-end",
    gap:            "8px",
    paddingTop:     "8px",
    marginTop:      "4px",
    borderTop:      "1px solid var(--border)",
  },
  formError: {
    background:   "var(--error-bg, rgba(239,68,68,0.1))",
    border:       "1px solid var(--danger)",
    borderRadius: "7px",
    color:        "var(--danger)",
    fontSize:     "12px",
    padding:      "7px 12px",
  },
  fieldGroup: {
    display:       "flex",
    flexDirection: "column",
    gap:           "5px",
  },
  label: {
    fontSize:   "11px",
    fontWeight: 600,
    color:      "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  input: {
    background:   "var(--surface-2)",
    border:       "1px solid var(--border)",
    borderRadius: "7px",
    color:        "var(--text)",
    fontSize:     "13px",
    padding:      "7px 10px",
    outline:      "none",
    width:        "100%",
    boxSizing:    "border-box",
    fontFamily:   "inherit",
    transition:   "border-color 0.15s",
  },
  totalPreview: {
    background:   "var(--surface-2)",
    border:       "1px solid var(--border)",
    borderRadius: "8px",
    padding:      "10px 14px",
    fontSize:     "13px",
    color:        "var(--text)",
    textAlign:    "center",
  },

  // Buttons
  btnPrimary: {
    background:   "var(--accent)",
    color:        "#000",
    border:       "none",
    borderRadius: "8px",
    padding:      "7px 16px",
    fontSize:     "13px",
    fontWeight:   600,
    cursor:       "pointer",
    fontFamily:   "inherit",
    transition:   "opacity 0.15s",
  },
  btnSecondary: {
    background:   "transparent",
    border:       "1px solid var(--border)",
    borderRadius: "8px",
    color:        "var(--text-muted)",
    padding:      "7px 16px",
    fontSize:     "13px",
    fontWeight:   500,
    cursor:       "pointer",
    fontFamily:   "inherit",
  },
  btnSm: {
    background:   "transparent",
    border:       "1px solid var(--border)",
    borderRadius: "6px",
    color:        "var(--text-muted)",
    padding:      "4px 10px",
    fontSize:     "11px",
    cursor:       "pointer",
    fontFamily:   "inherit",
    flexShrink:   0,
  },
  btnIcon: {
    background:   "transparent",
    border:       "none",
    color:        "var(--text-muted)",
    fontSize:     "14px",
    cursor:       "pointer",
    padding:      "3px 5px",
    borderRadius: "5px",
    lineHeight:   1,
    transition:   "color 0.15s",
  },
  btnIconSm: {
    background:   "transparent",
    border:       "none",
    color:        "var(--text-muted)",
    fontSize:     "12px",
    cursor:       "pointer",
    padding:      "2px 4px",
    borderRadius: "4px",
    lineHeight:   1,
  },
};
