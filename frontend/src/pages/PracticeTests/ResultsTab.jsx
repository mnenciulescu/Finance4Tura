import { useState, useMemo, useRef, useEffect } from "react";
import {
  createResult, updateResult, deleteResult, putKids,
} from "../../api/practiceTests";
import { calcTotal, today, GROUP_PALETTE, topicBg } from "./constants";
import s from "./styles";

function KidsModal({ kids, onSave, onClose }) {
  const [list, setList]     = useState(kids.map(k => ({ ...k })));
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
    <div style={s.overlay} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>Manage Kids</span>
          <button style={s.modalClose} onClick={onClose}>✕</button>
        </div>
        <div style={s.modalBody}>
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
        </div>
      </div>
    </div>
  );
}

export default function ResultsTab({ templates, results, setResults, kids, setKids }) {
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
    ? (filterTemplate.freePoints || 0) + filterTemplate.topics.reduce((acc, t) => acc + (t.defaultPoints || 0), 0)
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
                      {(r.totalScore / 10).toFixed(2)}
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
                      {(r.totalScore / 10).toFixed(2)}
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
