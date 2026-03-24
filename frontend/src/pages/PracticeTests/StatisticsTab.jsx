import { useState, useMemo } from "react";
import dayjs from "dayjs";
import {
  LineChart, Line, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { topicBg } from "./constants";
import { computeTopicPassRate } from "./helpers";
import s from "./styles";

const TEMPLATE_COLORS = ["#16a34a", "#60a5fa", "#f9a8d4", "#fcd34d", "#a78bfa", "#34d399", "#fb923c"];

export default function StatisticsTab({ templates, results, kids }) {
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

  // Timeline: one point per date, one line per template, grade = totalScore/10 (2 decimals)
  const timelineData = useMemo(() => {
    const byDate = {};
    for (const r of [...filtered].sort((a, b) => a.date.localeCompare(b.date))) {
      if (!byDate[r.date]) byDate[r.date] = { date: r.date };
      const key   = r.templateId;
      const grade = +(r.totalScore / 10).toFixed(2);
      if (byDate[r.date][key] === undefined) {
        byDate[r.date][key] = grade;
      } else {
        byDate[r.date][key] = +((byDate[r.date][key] + grade) / 2).toFixed(2);
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
                    label={({ x, y, value }) => (
                      <g>
                        <rect x={x - 20} y={y - 27} width={40} height={17} rx={3} ry={3} fill="var(--surface)" stroke="var(--border)" strokeWidth={1} />
                        <text x={x} y={y - 14} textAnchor="middle" fill={tplColorMap[t.templateId]} fontSize={13} fontWeight={600}>
                          {Number(value).toFixed(2)}
                        </text>
                      </g>
                    )}
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
