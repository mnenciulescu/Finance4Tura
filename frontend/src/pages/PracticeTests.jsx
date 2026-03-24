import { useState, useEffect, useMemo, useRef } from "react";
import dayjs from "dayjs";
import {
  BarChart, Bar, LineChart, Line, ReferenceLine,
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

  // Refs for auto-save (avoids stale closure issues with setTimeout)
  const inlineRowRef          = useRef(null);
  const inlineSaveTimerRef    = useRef(null);
  const inlineSavingInFlight  = useRef(false);
  const editRowDataRef        = useRef(null);
  const editingRowIdRef       = useRef(null);
  const editSaveTimerRef      = useRef(null);
  const editSavingInFlight    = useRef(false);

  useEffect(() => { inlineRowRef.current = inlineRow; },       [inlineRow]);
  useEffect(() => { editRowDataRef.current = editRowData; },   [editRowData]);
  useEffect(() => { editingRowIdRef.current = editingRowId; }, [editingRowId]);

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
    scheduleInlineAutoSave();
  }

  const filtered = useMemo(() => results
    .filter(r => {
      if (filterTpl && r.templateId !== filterTpl) return false;
      if (filterKid && r.kidName    !== filterKid) return false;
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date)),
  [results, filterTpl, filterKid]);

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
    scheduleInlineAutoSave();
  }

  function scheduleInlineAutoSave() {
    clearTimeout(inlineSaveTimerRef.current);
    inlineSaveTimerRef.current = setTimeout(() => executeInlineSave(false), 600);
  }

  async function executeInlineSave(closeAfter) {
    if (inlineSavingInFlight.current) return;
    const row = inlineRowRef.current;
    if (!row) { if (closeAfter) setInlineRow(null); return; }
    if (!row.date) { if (closeAfter) setInlineError("Date is required"); return; }
    if (row.topicScores.some(t => t.points === "")) return;

    inlineSavingInFlight.current = true;
    setInlineSaving(true);
    setInlineError(null);
    try {
      const effectiveTotal = row.totalOverride !== null
        ? Number(row.totalOverride)
        : calcTotal(row.freePoints, row.topicScores);
      const payload = {
        templateId:  filterTpl,
        kidName:     filterKid,
        date:        row.date,
        sourceTitle: (row.sourceTitle || "").trim(),
        freePoints:  Number(row.freePoints) || 0,
        topicScores: row.topicScores.map(t => ({ ...t, points: Number(t.points) || 0 })),
        verified:    row.verified,
        totalScore:  effectiveTotal,
      };
      if (row.resultId) {
        const updated = await updateResult(row.resultId, payload);
        setResults(prev => prev.map(r => r.resultId === row.resultId ? updated : r));
      } else {
        const created = await createResult(payload);
        setResults(prev => [created, ...prev]);
        setInlineRow(r => r ? { ...r, resultId: created.resultId } : r);
      }
      if (closeAfter) setInlineRow(null);
    } catch (e) {
      setInlineError(e?.response?.data?.message || e.message || "Error saving");
    } finally {
      setInlineSaving(false);
      inlineSavingInFlight.current = false;
    }
  }

  async function handleInlineSave() {
    clearTimeout(inlineSaveTimerRef.current);
    await executeInlineSave(true);
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
    scheduleEditRowAutoSave();
  }

  const editRowTotal = editRowData ? calcTotal(editRowData.freePoints, editRowData.topicScores) : 0;

  function scheduleEditRowAutoSave() {
    clearTimeout(editSaveTimerRef.current);
    editSaveTimerRef.current = setTimeout(() => executeEditRowSave(false), 600);
  }

  async function executeEditRowSave(closeAfter) {
    if (editSavingInFlight.current) return;
    const id   = editingRowIdRef.current;
    const data = editRowDataRef.current;
    if (!id || !data) return;
    if (data.topicScores.some(t => t.points === "")) return;

    editSavingInFlight.current = true;
    setEditRowSaving(true);
    setEditRowError(null);
    try {
      const effectiveTotal = data.totalOverride !== null
        ? Number(data.totalOverride)
        : calcTotal(data.freePoints, data.topicScores);
      const payload = {
        date:        data.date,
        sourceTitle: (data.sourceTitle || "").trim(),
        freePoints:  Number(data.freePoints) || 0,
        topicScores: data.topicScores.map(t => ({ ...t, points: Number(t.points) || 0 })),
        verified:    data.verified,
        totalScore:  effectiveTotal,
      };
      const updated = await updateResult(id, payload);
      setResults(prev => prev.map(r => r.resultId === id ? updated : r));
      if (closeAfter) {
        setEditingRowId(null);
        setEditRowData(null);
      }
    } catch (e) {
      setEditRowError(e?.response?.data?.message || e.message || "Error saving");
    } finally {
      setEditRowSaving(false);
      editSavingInFlight.current = false;
    }
  }

  async function handleEditRowSave() {
    clearTimeout(editSaveTimerRef.current);
    await executeEditRowSave(true);
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
                      onChange={e => { setInlineRow(r => ({ ...r, totalOverride: e.target.value === "" ? null : e.target.value })); scheduleInlineAutoSave(); }}
                    />
                  </td>
                  <td style={s.td}>
                    <input
                      style={{ ...s.inlineInput, width: "108px" }}
                      type="date"
                      value={inlineRow.date}
                      onChange={e => { setInlineRow(r => ({ ...r, date: e.target.value })); scheduleInlineAutoSave(); }}
                    />
                  </td>
                  <td style={s.td}>
                    <input
                      style={{ ...s.inlineInput, width: "160px" }}
                      placeholder="source…"
                      value={inlineRow.sourceTitle}
                      onChange={e => { setInlineRow(r => ({ ...r, sourceTitle: e.target.value })); scheduleInlineAutoSave(); }}
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
                        onChange={e => { setInlineRow(r => ({ ...r, freePoints: e.target.value, totalOverride: null })); scheduleInlineAutoSave(); }}
                      />
                    </td>
                  )}
                  <td style={{ ...s.td, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={inlineRow.verified}
                      onChange={e => { setInlineRow(r => ({ ...r, verified: e.target.checked })); scheduleInlineAutoSave(); }}
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
                          onChange={e => { setEditRowData(d => ({ ...d, totalOverride: e.target.value === "" ? null : e.target.value })); scheduleEditRowAutoSave(); }}
                        />
                      </td>
                      <td style={s.td}>
                        <input
                          style={{ ...s.inlineInput, width: "108px" }}
                          type="date"
                          value={editRowData.date}
                          onChange={e => { setEditRowData(d => ({ ...d, date: e.target.value })); scheduleEditRowAutoSave(); }}
                        />
                      </td>
                      <td style={s.td}>
                        <input
                          style={{ ...s.inlineInput, width: "160px" }}
                          placeholder="source…"
                          value={editRowData.sourceTitle}
                          onChange={e => { setEditRowData(d => ({ ...d, sourceTitle: e.target.value })); scheduleEditRowAutoSave(); }}
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
                            onChange={e => { setEditRowData(d => ({ ...d, freePoints: e.target.value, totalOverride: null })); scheduleEditRowAutoSave(); }}
                          />
                        </td>
                      )}
                      <td style={{ ...s.td, textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={editRowData.verified}
                          onChange={e => { setEditRowData(d => ({ ...d, verified: e.target.checked })); scheduleEditRowAutoSave(); }}
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
                          style={{ ...s.inlineInput, width: "160px" }}
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

const TEMPLATE_COLORS = ["#16a34a", "#60a5fa", "#f9a8d4", "#fcd34d", "#a78bfa", "#34d399", "#fb923c"];

function computeTopicPassRate(template, resultsForTemplate) {
  const topics = template.topics || [];
  const uniqueGroups = [];
  topics.forEach(t => {
    const g = t.group || "";
    if (!uniqueGroups.includes(g)) uniqueGroups.push(g);
  });
  const groupInfo = topics.map((t, i) => {
    const g = t.group || "";
    const isStart = i === 0 || g !== (topics[i - 1].group || "");
    const isEnd   = i === topics.length - 1 || g !== (topics[i + 1].group || "");
    const palette = g ? GROUP_PALETTE[uniqueGroups.indexOf(g) % GROUP_PALETTE.length] : null;
    return { isStart, isEnd, palette };
  });
  const groupSpans = [];
  topics.forEach((t, i) => {
    const g = t.group || "";
    const { palette } = groupInfo[i] || {};
    if (groupSpans.length === 0 || groupSpans[groupSpans.length - 1].group !== g) {
      groupSpans.push({ group: g, count: 1, palette });
    } else {
      groupSpans[groupSpans.length - 1].count++;
    }
  });
  const valid = resultsForTemplate.filter(r => {
    if (!r.topicScores || r.topicScores.length === 0) return false;
    const computed = calcTotal(r.freePoints || 0, r.topicScores);
    return Math.abs(computed - (r.totalScore || 0)) < 0.1;
  });
  const byKid = {};
  for (const r of valid) {
    if (!byKid[r.kidName]) byKid[r.kidName] = [];
    byKid[r.kidName].push(r);
  }
  const kidRows = Object.entries(byKid).sort(([a], [b]) => a.localeCompare(b)).map(([kidName, kidResults]) => {
    const percs = topics.map(topic => {
      const scores = kidResults.flatMap(r =>
        (r.topicScores || []).filter(ts => ts.topicId === topic.topicId)
      );
      if (scores.length === 0 || topic.defaultPoints === 0) return null;
      const avg = scores.reduce((s, ts) => s + (ts.points || 0), 0) / scores.length;
      return Math.round((avg / topic.defaultPoints) * 100);
    });
    return { kidName, percs, count: kidResults.length };
  });
  return { topicCols: topics, groupInfo, groupSpans, kidRows };
}

function StatisticsTab({ templates, results, kids }) {
  const [filterTpl, setFilterTpl] = useState("");
  const [filterKid, setFilterKid] = useState("");

  // calendar state: current month view
  const [calMonth, setCalMonth] = useState(() => dayjs().startOf("month"));

  const filtered = useMemo(() => {
    let r = results;
    if (filterTpl) r = r.filter(x => x.templateId === filterTpl);
    if (filterKid) r = r.filter(x => x.kidName    === filterKid);
    return r;
  }, [results, filterTpl, filterKid]);

  const kidNames = useMemo(() => [...new Set(results.map(r => r.kidName))].sort(), [results]);

  // Results filtered only by kid (used for per-template pass-rate blocks)
  const filteredByKid = useMemo(() => {
    if (!filterKid) return results;
    return results.filter(x => x.kidName === filterKid);
  }, [results, filterKid]);

  // One pass-rate block per visible template (respects both filters)
  const allTemplateStats = useMemo(() => {
    const tplsToShow = filterTpl
      ? templates.filter(t => t.templateId === filterTpl)
      : templates;
    return tplsToShow
      .filter(t => (t.topics || []).length > 0)
      .map(tpl => ({
        template: tpl,
        ...computeTopicPassRate(tpl, filteredByKid.filter(r => r.templateId === tpl.templateId)),
      }));
  }, [templates, filteredByKid, filterTpl]);

  // Timeline: one point per date, one line per template, grade = totalScore/10 (1 decimal)
  const timelineData = useMemo(() => {
    const byDate = {};
    for (const r of [...filtered].sort((a, b) => a.date.localeCompare(b.date))) {
      if (!byDate[r.date]) byDate[r.date] = { date: r.date };
      const key   = r.templateId;
      const grade = +(r.totalScore / 10).toFixed(1);
      if (byDate[r.date][key] === undefined) {
        byDate[r.date][key] = grade;
      } else {
        byDate[r.date][key] = +((byDate[r.date][key] + grade) / 2).toFixed(1);
      }
    }
    return Object.values(byDate).slice(-50);
  }, [filtered]);

  // Metadata for tooltip: date → templateId → { sourceTitle, verified }
  const timelineMeta = useMemo(() => {
    const meta = {};
    for (const r of filtered) {
      if (!meta[r.date]) meta[r.date] = {};
      meta[r.date][r.templateId] = { sourceTitle: r.sourceTitle || "", verified: r.verified };
    }
    return meta;
  }, [filtered]);

  // Templates that appear in filtered results, preserving stable order
  const timelineTemplates = useMemo(() => {
    const seen = new Set(filtered.map(r => r.templateId));
    return templates.filter(t => seen.has(t.templateId));
  }, [filtered, templates]);

  // Calendar: map day → list of { templateId, templateName }
  const calYear  = calMonth.year();
  const calMon   = calMonth.month(); // 0-indexed
  const daysInMonth = calMonth.daysInMonth();
  const firstDow    = calMonth.day(); // 0=Sun

  // template color map (stable index by templateId)
  const tplColorMap = useMemo(() => {
    const map = {};
    templates.forEach((t, i) => { map[t.templateId] = TEMPLATE_COLORS[i % TEMPLATE_COLORS.length]; });
    return map;
  }, [templates]);

  // Average grade per template (over all filtered results)
  const tplAverages = useMemo(() => {
    const sums = {}, counts = {};
    for (const r of filtered) {
      if (r.totalScore == null) continue;
      const grade = r.totalScore / 10;
      sums[r.templateId]   = (sums[r.templateId]   || 0) + grade;
      counts[r.templateId] = (counts[r.templateId] || 0) + 1;
    }
    const map = {};
    for (const id of Object.keys(sums)) {
      map[id] = +(sums[id] / counts[id]).toFixed(2);
    }
    return map;
  }, [filtered]);

  const calDayMap = useMemo(() => {
    const map = {};
    for (const r of results) {
      if (!r.date) continue;
      const d = dayjs(r.date);
      if (d.year() !== calYear || d.month() !== calMon) continue;
      const day = d.date();
      if (!map[day]) map[day] = [];
      if (!map[day].find(x => x.templateId === r.templateId)) {
        map[day].push({ templateId: r.templateId, templateName: r.templateName });
      }
    }
    return map;
  }, [results, calYear, calMon]);

  if (results.length === 0) {
    return <div style={{ ...s.tabContent, ...s.empty }}>No results yet. Add some results first.</div>;
  }

  // Build calendar grid cells (nulls for padding + day numbers)
  const calCells = [];
  for (let i = 0; i < firstDow; i++) calCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calCells.push(d);

  return (
    <div style={s.tabContent}>
      {/* Filters */}
      <div style={s.filterBar}>
        <select style={s.filterSel} value={filterTpl} onChange={e => setFilterTpl(e.target.value)}>
          <option value="">All templates</option>
          {templates.map(t => <option key={t.templateId} value={t.templateId}>{t.name}</option>)}
        </select>
        <select style={s.filterSel} value={filterKid} onChange={e => setFilterKid(e.target.value)}>
          <option value="">All kids</option>
          {kidNames.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>

      {/* Two-column layout */}
      <div style={s.statsRow}>

        {/* Left: grade timeline chart */}
        <div style={s.statsCard}>
          <div style={s.statsCardTitle}>Grade Evolution</div>
          {timelineData.length < 2 ? (
            <div style={{ color: "var(--text-muted)", fontSize: "13px", padding: "20px 0" }}>
              Not enough data points yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={timelineData} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} domain={[8, 10]} tickCount={5} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px", padding: "8px 12px", maxWidth: "240px" }}>
                        <div style={{ color: "var(--text-muted)", marginBottom: "6px", fontSize: "11px" }}>{label}</div>
                        {payload.map(p => {
                          const meta = timelineMeta[label]?.[p.dataKey];
                          return (
                            <div key={p.dataKey} style={{ marginBottom: "6px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: p.stroke, flexShrink: 0 }} />
                                <span style={{ color: "var(--text)", fontWeight: 600 }}>{p.name}</span>
                              </div>
                              <div style={{ paddingLeft: "14px", color: "var(--text)" }}>Final grade: <strong>{p.value}</strong></div>
                              {meta?.sourceTitle && (
                                <div style={{ paddingLeft: "14px", color: "var(--text-muted)", marginTop: "2px" }}>{meta.sourceTitle}</div>
                              )}
                              <div style={{ paddingLeft: "14px", marginTop: "2px" }}>
                                {meta?.verified
                                  ? <span style={{ color: "var(--accent)", fontSize: "11px" }}>✓ Verified</span>
                                  : <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>Not verified</span>
                                }
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                {timelineTemplates.map(t => (
                  <Line
                    key={t.templateId}
                    type="linear"
                    dataKey={t.templateId}
                    name={t.name}
                    stroke={tplColorMap[t.templateId]}
                    strokeWidth={2}
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      const meta = timelineMeta[payload.date]?.[t.templateId];
                      const verified = meta?.verified;
                      const color = tplColorMap[t.templateId];
                      if (verified) {
                        return (
                          <g key={`dot-${t.templateId}-${payload.date}`}>
                            <circle cx={cx} cy={cy} r={7} fill="none" stroke="#ef4444" strokeWidth={2} />
                            <circle cx={cx} cy={cy} r={4} fill={color} />
                          </g>
                        );
                      }
                      return <circle key={`dot-${t.templateId}-${payload.date}`} cx={cx} cy={cy} r={3} fill={color} />;
                    }}
                    label={{ position: "top", fontSize: 10, fill: tplColorMap[t.templateId], offset: 8 }}
                    connectNulls
                  />
                ))}
                {timelineTemplates.map(t => {
                  const avg = tplAverages[t.templateId];
                  if (avg == null) return null;
                  const color = tplColorMap[t.templateId];
                  return (
                    <ReferenceLine
                      key={`avg-${t.templateId}`}
                      y={avg}
                      stroke={color}
                      strokeDasharray="5 3"
                      strokeOpacity={0.6}
                      label={{ value: `avg ${avg}`, position: "insideTopRight", fontSize: 9, fill: color, dy: -4 }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Right: monthly calendar */}
        <div style={s.statsCard}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <div style={s.statsCardTitle}>{calMonth.format("MMMM YYYY")}</div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button style={s.calNavBtn} onClick={() => setCalMonth(m => m.subtract(1, "month"))}>‹</button>
              <button style={s.calNavBtn} onClick={() => setCalMonth(m => m.add(1, "month"))}>›</button>
            </div>
          </div>

          {/* Day-of-week headers */}
          <div style={s.calGrid}>
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
              <div key={d} style={s.calDow}>{d}</div>
            ))}
            {calCells.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />;
              const entries = calDayMap[day] || [];
              const isToday = dayjs().date() === day && dayjs().month() === calMon && dayjs().year() === calYear;
              const firstColor = entries.length > 0 ? tplColorMap[entries[0].templateId] : null;
              return (
                <div key={day} style={{
                  ...s.calCell,
                  ...(isToday ? s.calCellToday : {}),
                  ...(entries.length > 0 ? { background: firstColor + "33", borderColor: firstColor + "99" } : {}),
                }}>
                  <span style={{ fontSize: "12px", fontWeight: isToday ? 700 : 400, color: entries.length > 0 ? firstColor : "var(--text-muted)" }}>
                    {day}
                  </span>
                  {entries.length > 1 && (
                    <div style={{ display: "flex", gap: "2px", flexWrap: "wrap", justifyContent: "center", marginTop: "2px" }}>
                      {entries.map(e => (
                        <span key={e.templateId} title={e.templateName} style={{ width: "5px", height: "5px", borderRadius: "50%", background: tplColorMap[e.templateId], display: "inline-block" }} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Template legend */}
          {!filterTpl && templates.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
              {templates.map((t, i) => (
                <div key={t.templateId} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: TEMPLATE_COLORS[i % TEMPLATE_COLORS.length], display: "inline-block", flexShrink: 0 }} />
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{t.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Topic pass-rate blocks — one per template */}
      {allTemplateStats.map(({ template, topicCols, groupInfo, groupSpans, kidRows }) => (
        <div key={template.templateId} style={{ ...s.statsCard, marginTop: "4px" }}>
          <div style={{ ...s.statsCardTitle, display: "flex", alignItems: "center", gap: "8px" }}>
            Topic Pass Rate
            <span style={{ color: tplColorMap[template.templateId], fontWeight: 700 }}>
              — {template.name}
            </span>
          </div>
          {kidRows.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: "13px", padding: "12px 0" }}>
              No results with per-topic scores for this template.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th} />
                    <th style={{ ...s.th, textAlign: "center" }}>#</th>
                    {groupSpans.map((span, i) => (
                      <th key={i} colSpan={span.count} style={{
                        ...s.th,
                        textAlign: "center",
                        ...(span.palette ? {
                          background:  span.palette.bg,
                          borderLeft:  `2px solid ${span.palette.border}`,
                          borderRight: `2px solid ${span.palette.border}`,
                          color:       span.palette.solid,
                        } : {}),
                      }}>
                        {span.group || ""}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th style={{ ...s.th, whiteSpace: "nowrap" }}>Kid</th>
                    <th style={{ ...s.th, textAlign: "center" }} />
                    {topicCols.map((topic, i) => {
                      const { isStart, isEnd, palette } = groupInfo[i] || {};
                      return (
                        <th key={topic.topicId || i} style={{
                          ...s.th,
                          textAlign:  "center",
                          maxWidth:   "80px",
                          whiteSpace: "normal",
                          fontSize:   "10px",
                          ...(palette ? { background: palette.bg } : {}),
                          ...(isStart && palette ? { borderLeft:  `2px solid ${palette.border}` } : {}),
                          ...(isEnd   && palette ? { borderRight: `2px solid ${palette.border}` } : {}),
                        }}>
                          {topic.title}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {kidRows.map(row => (
                    <tr key={row.kidName} style={s.tr}>
                      <td style={{ ...s.td, fontWeight: 600, whiteSpace: "nowrap" }}>{row.kidName}</td>
                      <td style={{ ...s.td, textAlign: "center", color: "var(--text-muted)", fontSize: "11px" }}>{row.count}</td>
                      {row.percs.map((pct, i) => {
                        const { isStart, isEnd, palette } = groupInfo[i] || {};
                        const bg = pct === null ? undefined : topicBg(pct, 100);
                        return (
                          <td key={i} style={{
                            ...s.td,
                            textAlign:  "center",
                            fontWeight: 600,
                            fontSize:   "12px",
                            ...(bg ? { background: bg } : {}),
                            ...(isStart && palette ? { borderLeft:  `2px solid ${palette.border}` } : {}),
                            ...(isEnd   && palette ? { borderRight: `2px solid ${palette.border}` } : {}),
                          }}>
                            {pct === null ? "—" : `${pct}%`}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

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
    padding:        "4px 24px 0",
    background:     "var(--surface)",
    borderBottom:   "1px solid var(--border)",
    flexShrink:     0,
  },
  tabBtn: {
    background:      "transparent",
    border:          "none",
    outline:         "none",
    boxShadow:       "none",
    textDecoration:  "none",
    borderBottom:    "2px solid transparent",
    padding:         "7px 16px",
    fontSize:        "13px",
    fontWeight:      500,
    color:           "var(--text-muted)",
    cursor:          "pointer",
    fontFamily:      "inherit",
    transition:      "color 0.15s",
    marginBottom:    "-1px",
  },
  tabBtnActive: {
    color:        "var(--text)",
    borderBottom: "2px solid var(--badge-text)",
  },
  content: {
    flex:      1,
    minHeight: 0,
    overflowY: "auto",
  },
  tabContent: {
    padding: "14px 24px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
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
  statsRow: {
    display:             "grid",
    gridTemplateColumns: "3fr 1fr",
    gap:                 "16px",
    alignItems:          "stretch",
  },
  statsCard: {
    background:   "var(--surface)",
    border:       "1px solid var(--border)",
    borderRadius: "12px",
    padding:      "14px 16px",
    display:      "flex",
    flexDirection:"column",
  },
  statsCardTitle: {
    fontSize:      "11px",
    fontWeight:    700,
    color:         "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom:  "12px",
  },
  calNavBtn: {
    background:   "var(--surface-2)",
    border:       "1px solid var(--border)",
    borderRadius: "6px",
    color:        "var(--text-muted)",
    fontSize:     "14px",
    width:        "26px",
    height:       "26px",
    cursor:       "pointer",
    display:      "flex",
    alignItems:   "center",
    justifyContent:"center",
    padding:      0,
  },
  calGrid: {
    display:             "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap:                 "3px",
  },
  calDow: {
    fontSize:   "10px",
    fontWeight: 600,
    color:      "var(--text-muted)",
    textAlign:  "center",
    padding:    "2px 0 4px",
  },
  calCell: {
    borderRadius: "6px",
    border:       "1px solid transparent",
    padding:      "4px 2px",
    minHeight:    "34px",
    display:      "flex",
    flexDirection:"column",
    alignItems:   "center",
    justifyContent:"center",
  },
  calCellToday: {
    outline: "2px solid var(--accent)",
    outlineOffset: "-2px",
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
