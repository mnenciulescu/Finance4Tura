import { useState, useMemo } from "react";
import { GROUP_PALETTE, topicBg } from "./constants";
import s from "./styles";
import TestModal from "./TestModal";

// ── ResultsTab ────────────────────────────────────────────────────────────────
export default function ResultsTab({ templates, results, setResults, kids, setKids }) {
  const [filterTpl, setFilterTpl] = useState(() => templates[0]?.templateId || "");
  const [filterKid, setFilterKid] = useState(() => kids[0]?.name || "");

  // { mode: "new" | "edit", result: null | resultObj }
  const [modalState, setModalState] = useState(null);

  const filterTemplate = useMemo(
    () => templates.find(t => t.templateId === filterTpl) || null,
    [templates, filterTpl],
  );

  const kidNames = useMemo(() => {
    const names = new Set(results.map(r => r.kidName));
    kids.forEach(k => names.add(k.name));
    return [...names].sort();
  }, [results, kids]);

  const filtered = useMemo(() => results
    .filter(r => {
      if (filterTpl && r.templateId !== filterTpl) return false;
      if (filterKid && r.kidName    !== filterKid) return false;
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date)),
  [results, filterTpl, filterKid]);

  const showInline  = !!(filterTpl && filterKid && filterTemplate);
  const topicCols   = filterTemplate?.topics || [];

  // Group visual info — used for topic column headers and cell borders
  const topicGroupInfo = useMemo(() => {
    const uniqueGroups = [];
    topicCols.forEach(t => {
      const g = t.group || "";
      if (!uniqueGroups.includes(g)) uniqueGroups.push(g);
    });
    return topicCols.map((t, i) => {
      const g       = t.group || "";
      const isStart = i === 0 || g !== (topicCols[i - 1].group || "");
      const isEnd   = i === topicCols.length - 1 || g !== (topicCols[i + 1].group || "");
      const palette = g ? GROUP_PALETTE[uniqueGroups.indexOf(g) % GROUP_PALETTE.length] : null;
      return { isStart, isEnd, palette };
    });
  }, [topicCols]);

  const groupSpans = useMemo(() => {
    const spans = [];
    topicCols.forEach((t, i) => {
      const g = t.group || "";
      const { palette } = topicGroupInfo[i] || {};
      if (spans.length === 0 || spans[spans.length - 1].group !== g)
        spans.push({ group: g, count: 1, palette });
      else
        spans[spans.length - 1].count++;
    });
    return spans;
  }, [topicCols, topicGroupInfo]);

  // ── Modal callbacks ────────────────────────────────────────────────────────

  function handleModalSave(saved) {
    setResults(prev => {
      const exists = prev.find(r => r.resultId === saved.resultId);
      return exists
        ? prev.map(r => r.resultId === saved.resultId ? saved : r)
        : [saved, ...prev];
    });
  }

  function handleModalDelete(id) {
    setResults(prev => prev.filter(r => r.resultId !== id));
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={s.tabContent}>

      {/* ── Filter bar + New Test button ── */}
      <div style={{ ...s.filterBar, justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <select
            style={s.filterSel}
            value={filterTpl}
            onChange={e => setFilterTpl(e.target.value)}
          >
            <option value="">All templates</option>
            {templates.map(t => <option key={t.templateId} value={t.templateId}>{t.name}</option>)}
          </select>
          <select
            style={s.filterSel}
            value={filterKid}
            onChange={e => setFilterKid(e.target.value)}
          >
            <option value="">All kids</option>
            {kidNames.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <button
          style={{ ...s.btnPrimary, opacity: showInline ? 1 : 0.45, cursor: showInline ? "pointer" : "default" }}
          onClick={() => { if (showInline) setModalState({ mode: "new", result: null }); }}
          disabled={!showInline}
          title={!showInline ? "Select a template and a kid first" : ""}
        >
          + New Test
        </button>
      </div>

      {/* ── Inline table: template + kid selected ── */}
      {showInline && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              {/* Row 1: group spans */}
              <tr>
                <th rowSpan={2} style={{ ...s.th, textAlign: "center", color: "var(--badge-text)", verticalAlign: "middle" }}>Total</th>
                <th rowSpan={2} style={{ ...s.th, verticalAlign: "middle" }}>Date</th>
                <th rowSpan={2} style={{ ...s.th, verticalAlign: "middle" }}>Source</th>
                {groupSpans.map((gs, idx) =>
                  gs.group ? (
                    <th
                      key={idx}
                      colSpan={gs.count}
                      style={{
                        ...s.th,
                        textAlign: "center",
                        background:  gs.palette.bg,
                        borderLeft:  `2px solid ${gs.palette.border}`,
                        borderRight: `2px solid ${gs.palette.border}`,
                        padding: "4px 4px 2px",
                      }}
                    >
                      <span style={{
                        display: "inline-block", fontSize: "8px", fontWeight: 700,
                        color: "#fff", background: gs.palette.solid,
                        borderRadius: "3px", padding: "1px 6px", letterSpacing: "0.04em",
                      }}>
                        {gs.group}
                      </span>
                    </th>
                  ) : (
                    <th key={idx} colSpan={gs.count} style={s.th} />
                  )
                )}
                {filterTemplate.freePoints > 0 && (
                  <th rowSpan={2} style={{ ...s.th, textAlign: "center", verticalAlign: "middle" }}>Free</th>
                )}
                <th rowSpan={2} style={{ ...s.th, textAlign: "center", verticalAlign: "middle" }}>✓</th>
                <th rowSpan={2} style={s.th} />
              </tr>
              {/* Row 2: individual topic columns */}
              <tr>
                {topicCols.map((t, i) => {
                  const { isStart, isEnd, palette } = topicGroupInfo[i] || {};
                  return (
                    <th
                      key={t.topicId}
                      style={{
                        ...s.th,
                        textAlign: "center",
                        maxWidth: "62px",
                        ...(palette        ? { background:   palette.bg }                     : {}),
                        ...(isStart && palette ? { borderLeft:  `2px solid ${palette.border}` } : {}),
                        ...(isEnd   && palette ? { borderRight: `2px solid ${palette.border}` } : {}),
                      }}
                    >
                      <div
                        style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "58px", margin: "0 auto" }}
                        title={t.title}
                      >
                        {t.title}
                      </div>
                      <div style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 400 }}>{t.defaultPoints}p</div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={2 + topicCols.length + (filterTemplate.freePoints > 0 ? 1 : 0) + 3}
                    style={{ padding: "14px", color: "var(--text-muted)", fontSize: "12px", fontStyle: "italic", textAlign: "center" }}
                  >
                    No past results for this combination.
                  </td>
                </tr>
              ) : filtered.map(r => {
                const topicMap = Object.fromEntries((r.topicScores || []).map(t => [t.topicId, t.points]));
                return (
                  <tr key={r.resultId} style={s.tr}>
                    {/* Total */}
                    <td style={{ ...s.td, textAlign: "center", fontWeight: 700, color: "var(--badge-text)" }}>
                      {(r.totalScore / 10).toFixed(2)}
                    </td>
                    {/* Date */}
                    <td style={s.td}>{r.date}</td>
                    {/* Source */}
                    <td style={{ ...s.td, color: "var(--text-muted)" }}>{r.sourceTitle || "—"}</td>
                    {/* Topic scores — view only with same color coding */}
                    {topicCols.map((t, i) => {
                      const val = topicMap[t.topicId];
                      const { isStart, isEnd, palette } = topicGroupInfo[i] || {};
                      return (
                        <td
                          key={t.topicId}
                          style={{
                            ...s.td,
                            textAlign: "center",
                            padding: "5px 3px",
                            background: topicBg(val ?? 0, t.defaultPoints),
                            ...(isStart && palette ? { borderLeft:  `2px solid ${palette.border}` } : {}),
                            ...(isEnd   && palette ? { borderRight: `2px solid ${palette.border}` } : {}),
                          }}
                        >
                          {val ?? "—"}
                        </td>
                      );
                    })}
                    {/* Free points */}
                    {filterTemplate.freePoints > 0 && (
                      <td style={{ ...s.td, textAlign: "center", padding: "5px 3px" }}>
                        {r.freePoints || 0}
                      </td>
                    )}
                    {/* Verified indicator */}
                    <td style={{ ...s.td, textAlign: "center" }}>
                      {r.verified
                        ? <span style={{ color: "var(--badge-text)", fontWeight: 700, fontSize: "13px" }}>✓</span>
                        : <span style={{ color: "var(--text-muted)", opacity: 0.35, fontSize: "13px" }}>○</span>
                      }
                    </td>
                    {/* Edit button */}
                    <td style={{ ...s.td, whiteSpace: "nowrap" }}>
                      <button
                        style={{ ...s.btnSm, display: "flex", alignItems: "center", gap: "4px" }}
                        onClick={() => setModalState({ mode: "edit", result: r })}
                        title="Edit"
                      >
                        ✎ Edit
                      </button>
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
              {filtered.map(r => (
                <tr key={r.resultId} style={s.tr}>
                  <td style={s.td}>{r.kidName}</td>
                  <td style={s.td}>{r.date}</td>
                  <td style={{ ...s.td, color: "var(--text-muted)" }}>{r.sourceTitle || "—"}</td>
                  <td style={{ ...s.td, color: "var(--text-muted)", fontSize: "11px" }}>{r.templateName || "—"}</td>
                  <td style={{ ...s.td, textAlign: "center", fontWeight: 700, color: "var(--badge-text)" }}>
                    {(r.totalScore / 10).toFixed(2)}
                  </td>
                  <td style={{ ...s.td, textAlign: "center" }}>
                    {r.verified
                      ? <span style={{ color: "var(--badge-text)", fontWeight: 700, fontSize: "13px" }}>✓</span>
                      : <span style={{ color: "var(--text-muted)", opacity: 0.35, fontSize: "13px" }}>○</span>
                    }
                  </td>
                  <td style={{ ...s.td, whiteSpace: "nowrap" }}>
                    <button
                      style={{ ...s.btnSm, display: "flex", alignItems: "center", gap: "4px" }}
                      onClick={() => setModalState({ mode: "edit", result: r })}
                      title="Edit"
                    >
                      ✎ Edit
                    </button>
                  </td>
                </tr>
              ))}
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

      {/* ── Test modal (new / edit / delete) ── */}
      {modalState && (
        <TestModal
          mode={modalState.mode}
          result={modalState.result}
          template={modalState.mode === "new" ? filterTemplate : null}
          filterKid={filterKid}
          filterTpl={filterTpl}
          templates={templates}
          onSave={handleModalSave}
          onDelete={handleModalDelete}
          onClose={() => setModalState(null)}
        />
      )}

    </div>
  );
}
