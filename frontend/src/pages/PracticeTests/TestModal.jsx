import { useState, useMemo } from "react";
import { createResult, updateResult, deleteResult } from "../../api/practiceTests";
import { calcTotal, today, GROUP_PALETTE, topicBg } from "./constants";
import s from "./styles";

/**
 * TestModal — add / edit / delete a single test result.
 *
 * Props:
 *   mode        "new" | "edit"
 *   result      existing result object (edit) or null (new)
 *   template    resolved template object when both template+kid are pre-selected (new mode)
 *   filterKid   kid name used for new-mode creates
 *   filterTpl   templateId used for new-mode creates
 *   templates   full template list (used to resolve template when editing from generic table)
 *   onSave      (savedResult) => void  — called after a successful save
 *   onDelete    (resultId)    => void  — called after a successful delete
 *   onClose     ()            => void
 */
export default function TestModal({
  mode,
  result,
  template,
  filterKid,
  filterTpl,
  templates,
  onSave,
  onDelete,
  onClose,
}) {
  // ── Resolve active template (once on mount) ────────────────────────────────
  const activeTemplate = useMemo(
    () => template || templates?.find(t => t.templateId === (result?.templateId || filterTpl)) || null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const topicCols     = activeTemplate?.topics || [];
  const hasFreePoints = (activeTemplate?.freePoints || 0) > 0;

  // ── Form state ─────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState(() => {
    if (mode === "edit" && result) {
      return {
        resultId:    result.resultId,
        date:        result.date,
        sourceTitle: result.sourceTitle || "",
        freePoints:  result.freePoints || 0,
        topicScores: (result.topicScores || []).map(t => ({ ...t })),
        verified:    result.verified || false,
      };
    }
    // new mode — start with template defaults
    return {
      resultId:    null,
      date:        today(),
      sourceTitle: "",
      freePoints:  activeTemplate?.freePoints || 0,
      topicScores: topicCols.map(t => ({ topicId: t.topicId, title: t.title, points: t.defaultPoints })),
      verified:    false,
    };
  });

  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ── Derived values ─────────────────────────────────────────────────────────
  const computedTotal = calcTotal(formData.freePoints, formData.topicScores);

  // groupSpans: [{group, count, palette}] — drives the vertical grouped topic list
  const groupSpans = useMemo(() => {
    const uniqueGroups = [];
    topicCols.forEach(t => {
      const g = t.group || "";
      if (!uniqueGroups.includes(g)) uniqueGroups.push(g);
    });
    const spans = [];
    topicCols.forEach(t => {
      const g       = t.group || "";
      const palette = g ? GROUP_PALETTE[uniqueGroups.indexOf(g) % GROUP_PALETTE.length] : null;
      if (spans.length === 0 || spans[spans.length - 1].group !== g)
        spans.push({ group: g, count: 1, palette });
      else
        spans[spans.length - 1].count++;
    });
    return spans;
  }, [topicCols]);

  // ── Save / Delete ──────────────────────────────────────────────────────────
  async function handleSave() {
    if (!formData.date) { setError("Date is required"); return; }

    setSaving(true);
    setError(null);
    try {
      const total = calcTotal(formData.freePoints, formData.topicScores);

      let saved;
      if (formData.resultId) {
        saved = await updateResult(formData.resultId, {
          date:        formData.date,
          sourceTitle: (formData.sourceTitle || "").trim(),
          freePoints:  Number(formData.freePoints) || 0,
          topicScores: formData.topicScores.map(t => ({ ...t, points: Number(t.points) || 0 })),
          verified:    formData.verified,
          totalScore:  total,
        });
      } else {
        saved = await createResult({
          templateId:  filterTpl,
          kidName:     filterKid,
          date:        formData.date,
          sourceTitle: (formData.sourceTitle || "").trim(),
          freePoints:  Number(formData.freePoints) || 0,
          topicScores: formData.topicScores.map(t => ({ ...t, points: Number(t.points) || 0 })),
          verified:    formData.verified,
          totalScore:  total,
        });
      }
      onSave(saved);
      onClose();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Error saving");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const id = formData.resultId || result?.resultId;
    if (!id) { onClose(); return; }
    if (!window.confirm("Delete this test result?")) return;
    setDeleting(true);
    try {
      await deleteResult(id);
      onDelete(id);
      onClose();
    } catch {
      setError("Delete failed");
      setDeleting(false);
    }
  }

  function setTopic(i, val) {
    setFormData(d => ({
      ...d,
      topicScores: d.topicScores.map((t, idx) => idx === i ? { ...t, points: val } : t),
    }));
  }

  // ── Derived for grade card ────────────────────────────────────────────────
  const maxTotal = (activeTemplate?.freePoints || 0) +
    topicCols.reduce((sum, t) => sum + (t.defaultPoints || 0), 0);

  // ── Render ─────────────────────────────────────────────────────────────────
  const kidLabel   = filterKid || result?.kidName || "";
  const modalTitle = mode === "new"
    ? `New Test${kidLabel ? ` — ${kidLabel}` : ""}`
    : `Edit Test — ${result?.date || ""}${kidLabel ? ` · ${kidLabel}` : ""}`;

  // Topic list renderer — vertical grouped sections in the right column
  function TopicList() {
    let startIdx = 0;
    return groupSpans.map((gs, gIdx) => {
      const { palette } = gs;
      const groupTopics = topicCols.slice(startIdx, startIdx + gs.count);
      const offset      = startIdx;
      startIdx         += gs.count;

      return (
        <div
          key={gIdx}
          style={{
            borderRadius: "8px",
            border:       palette ? `1px solid ${palette.border}` : "1px solid var(--border)",
            overflow:     "hidden",
          }}
        >
          {/* Group header — only for named groups */}
          {gs.group && (
            <div style={{
              background:   palette.bg,
              borderBottom: `1px solid ${palette.border}`,
              padding:      "5px 12px",
              display:      "flex",
              alignItems:   "center",
            }}>
              <span style={{
                fontSize:      "9px",
                fontWeight:    700,
                color:         "#fff",
                background:    palette.solid,
                borderRadius:  "3px",
                padding:       "2px 8px",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}>
                {gs.group}
              </span>
            </div>
          )}

          {/* One row per topic */}
          {groupTopics.map((t, i) => {
            const globalIdx = offset + i;
            const score     = formData.topicScores[globalIdx];
            const maxPts    = t.defaultPoints ?? Infinity;
            const rowBg     = topicBg(score?.points, maxPts);

            return (
              <div
                key={t.topicId}
                style={{
                  display:      "flex",
                  alignItems:   "center",
                  gap:          "10px",
                  padding:      "7px 12px",
                  background:   rowBg || "transparent",
                  borderBottom: i < groupTopics.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <span style={{ flex: 1, fontSize: "12px", color: "var(--text)" }}>{t.title}</span>
                <input
                  style={{ ...s.inlineInput, width: "58px", textAlign: "center", background: "transparent", flexShrink: 0 }}
                  type="number" min="0" max={maxPts}
                  value={score?.points ?? 0}
                  onChange={e => {
                    const raw = e.target.value;
                    if (raw === "") { setTopic(globalIdx, ""); return; }
                    const clamped = Math.min(Number(raw), maxPts);
                    setTopic(globalIdx, isNaN(clamped) ? 0 : clamped);
                  }}
                />
                <span style={{ fontSize: "10px", color: "var(--text-muted)", minWidth: "30px", textAlign: "right", flexShrink: 0 }}>
                  /{maxPts}p
                </span>
              </div>
            );
          })}
        </div>
      );
    });
  }

  return (
    <div
      style={s.overlay}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        ...s.modal,
        maxWidth:      "min(96vw, 760px)",
        width:         "100%",
        height:        "88vh",
        overflow:      "hidden",
        display:       "flex",
        flexDirection: "column",
      }}>
        {/* ── Header ── */}
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>{modalTitle}</span>
          <button style={s.modalClose} onClick={onClose}>✕</button>
        </div>

        {/* ── Error banner (outside columns so it spans full width) ── */}
        {error && (
          <div style={{ ...s.formError, margin: "10px 18px 0", flexShrink: 0 }}>{error}</div>
        )}

        {/* ── Two-column body
              The wrapper takes flex:1 height from the modal column layout.
              Both columns are absolutely positioned inside it so their heights
              are always exactly equal to the wrapper — overflowY:auto then
              works reliably in every browser without flex scroll quirks.
        ── */}
        <div style={{ position: "relative", flex: 1, minHeight: 0 }}>

          {/* ── LEFT: scroll viewport ── */}
          <div style={{
            position:    "absolute",
            top:         0, left: 0, bottom: 0,
            width:       "230px",
            overflowY:   "auto",
            borderRight: "1px solid var(--border)",
            boxSizing:   "border-box",
          }}>
            {/* Inner flex container — grows freely, can overflow the scroll viewport */}
            <div style={{
              display:       "flex",
              flexDirection: "column",
              gap:           "14px",
              padding:       "18px",
              minHeight:     "100%",
              boxSizing:     "border-box",
            }}>

              <div style={s.fieldGroup}>
                <label style={s.label}>Date</label>
                <input
                  style={{ ...s.input, width: "100%" }}
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData(d => ({ ...d, date: e.target.value }))}
                />
              </div>

              <div style={s.fieldGroup}>
                <label style={s.label}>Source</label>
                <input
                  style={s.input}
                  placeholder="source…"
                  value={formData.sourceTitle}
                  onChange={e => setFormData(d => ({ ...d, sourceTitle: e.target.value }))}
                />
              </div>

              {hasFreePoints && (
                <div style={s.fieldGroup}>
                  <label style={s.label}>Free pts</label>
                  <input
                    style={{ ...s.input, width: "90px" }}
                    type="number" min="0"
                    value={formData.freePoints}
                    onChange={e => setFormData(d => ({ ...d, freePoints: e.target.value }))}
                  />
                </div>
              )}

              <div style={s.fieldGroup}>
                <label style={s.label}>Verified</label>
                <div style={{ display: "flex", alignItems: "center", height: "37px" }}>
                  <input
                    type="checkbox"
                    checked={formData.verified}
                    onChange={e => setFormData(d => ({ ...d, verified: e.target.checked }))}
                    style={{ cursor: "pointer", width: "16px", height: "16px" }}
                  />
                </div>
              </div>

              {/* ── Grade card — fills remaining space ── */}
              <div style={{
                flex:           1,
                minHeight:      "120px",
                display:        "flex",
                flexDirection:  "column",
                alignItems:     "center",
                justifyContent: "center",
                gap:            "6px",
                borderRadius:   "12px",
                background:     "var(--success-bg, rgba(134,239,172,0.10))",
                border:         "1px solid var(--accent, rgba(134,239,172,0.45))",
                padding:        "20px 12px",
              }}>
                <span style={{
                  fontSize:      "10px",
                  fontWeight:    700,
                  color:         "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                }}>
                  Grade
                </span>
                <span style={{
                  fontSize:      "62px",
                  fontWeight:    800,
                  color:         "var(--badge-text)",
                  lineHeight:    1,
                  letterSpacing: "-0.02em",
                }}>
                  {(computedTotal / 10).toFixed(2)}
                </span>
                {maxTotal > 0 && (
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                    {computedTotal} / {maxTotal} pts
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT: scroll viewport ── */}
          <div style={{
            position:  "absolute",
            top:       0, left: "230px", right: 0, bottom: 0,
            overflowY: "auto",
            boxSizing: "border-box",
          }}>
            {/* Inner flex container — grows freely, can overflow the scroll viewport */}
            <div style={{
              display:       "flex",
              flexDirection: "column",
              gap:           "8px",
              padding:       "18px",
            }}>
              {topicCols.length > 0
                ? TopicList()
                : (
                  <div style={{ color: "var(--text-muted)", fontSize: "12px", fontStyle: "italic", textAlign: "center", paddingTop: "24px" }}>
                    No topics in this template.
                  </div>
                )
              }
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          display:        "flex",
          justifyContent: "space-between",
          alignItems:     "center",
          padding:        "12px 18px",
          borderTop:      "1px solid var(--border)",
          flexShrink:     0,
        }}>
          <div>
            {mode === "edit" && (
              <button
                style={{ ...s.btnSecondary, color: "var(--danger)", borderColor: "var(--danger)" }}
                onClick={handleDelete}
                disabled={deleting || saving}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button style={s.btnSecondary} onClick={onClose} disabled={saving || deleting}>
              Cancel
            </button>
            <button style={s.btnPrimary} onClick={handleSave} disabled={saving || deleting}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
