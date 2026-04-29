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
  const [hiddenTpls, setHiddenTpls] = useState(new Set());
  const [filterKid, setFilterKid] = useState("");
  const [calMonth, setCalMonth] = useState(() => dayjs().startOf("month"));

  // template color map (stable index by templateId)
  const tplColorMap = useMemo(() => {
    const map = {};
    templates.forEach((t, i) => { map[t.templateId] = TEMPLATE_COLORS[i % TEMPLATE_COLORS.length]; });
    return map;
  }, [templates]);

  const kidNames = useMemo(() => [...new Set(results.map(r => r.kidName))].sort(), [results]);

  // All results filtered by kid only — used for summary stats and pass-rate blocks
  const resultsByKid = useMemo(() => {
    if (!filterKid) return results;
    return results.filter(x => x.kidName === filterKid);
  }, [results, filterKid]);

  // Results filtered by kid + hidden templates — used for the chart
  const filtered = useMemo(() => {
    return resultsByKid.filter(r => !hiddenTpls.has(r.templateId));
  }, [resultsByKid, hiddenTpls]);

  // Summary stats — only kid filter, all templates
  const summaryStats = useMemo(() => {
    const all = resultsByKid.filter(r => r.totalScore != null);

    // Per-template average over all tests
    const perTplAll = {};
    for (const r of all) {
      if (!perTplAll[r.templateId]) perTplAll[r.templateId] = { sum: 0, count: 0 };
      perTplAll[r.templateId].sum   += r.totalScore / 10;
      perTplAll[r.templateId].count += 1;
    }

    // Per-template average over last 5 tests per template
    const perTplLast5 = {};
    for (const tpl of templates) {
      const tplResults = all
        .filter(r => r.templateId === tpl.templateId)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5);
      if (tplResults.length > 0) {
        const sum = tplResults.reduce((acc, r) => acc + r.totalScore / 10, 0);
        perTplLast5[tpl.templateId] = +(sum / tplResults.length).toFixed(2);
      }
    }

    // Finalise per-template all-tests map
    const perTplAllAvg = {};
    for (const [id, { sum, count }] of Object.entries(perTplAll)) {
      perTplAllAvg[id] = +(sum / count).toFixed(2);
    }

    // Overall all-tests: average of per-template averages
    const allAvgValues = Object.values(perTplAllAvg);
    const overall = allAvgValues.length > 0
      ? +(allAvgValues.reduce((a, b) => a + b, 0) / allAvgValues.length).toFixed(2)
      : null;

    // Overall last-5: average of per-template last-5 averages
    const last5AvgValues = Object.values(perTplLast5);
    const overallLast5 = last5AvgValues.length > 0
      ? +(last5AvgValues.reduce((a, b) => a + b, 0) / last5AvgValues.length).toFixed(2)
      : null;

    // Per-template average over validated (verified) tests only
    const perTplValidated = {};
    for (const tpl of templates) {
      const validated = all.filter(r => r.templateId === tpl.templateId && r.verified);
      if (validated.length > 0) {
        const sum = validated.reduce((acc, r) => acc + r.totalScore / 10, 0);
        perTplValidated[tpl.templateId] = +(sum / validated.length).toFixed(2);
      }
    }

    // Overall validated: average of per-template validated averages
    const validatedAvgValues = Object.values(perTplValidated);
    const overallValidated = validatedAvgValues.length > 0
      ? +(validatedAvgValues.reduce((a, b) => a + b, 0) / validatedAvgValues.length).toFixed(2)
      : null;

    return { overall, overallLast5, perTplLast5, perTplAllAvg, overallValidated, perTplValidated };
  }, [resultsByKid, templates]);

  // One pass-rate block per visible (non-hidden) template
  const allTemplateStats = useMemo(() => {
    return templates
      .filter(t => !hiddenTpls.has(t.templateId) && (t.topics || []).length > 0)
      .map(tpl => ({
        template: tpl,
        ...computeTopicPassRate(tpl, resultsByKid.filter(r => r.templateId === tpl.templateId)),
      }));
  }, [templates, resultsByKid, hiddenTpls]);

  // Timeline: one point per date, one line per template
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

  // Templates that appear in filtered results
  const timelineTemplates = useMemo(() => {
    const seen = new Set(filtered.map(r => r.templateId));
    return templates.filter(t => seen.has(t.templateId));
  }, [filtered, templates]);

  // Average grade per template for reference lines
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

  // Calendar
  const calYear     = calMonth.year();
  const calMon      = calMonth.month();
  const daysInMonth = calMonth.daysInMonth();
  const firstDow    = (calMonth.day() + 6) % 7;

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

  const calCells = [];
  for (let i = 0; i < firstDow; i++) calCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calCells.push(d);

  function toggleTemplate(tplId) {
    setHiddenTpls(prev => {
      const next = new Set(prev);
      if (next.has(tplId)) next.delete(tplId);
      else next.add(tplId);
      return next;
    });
  }

  return (
    <div style={s.tabContent}>

      {/* Summary block — 3 sections: kid filter | last 5 per template | all tests per template */}
      <div style={{ ...s.statsCard, padding: "0", flexDirection: "row", alignItems: "stretch", gap: "0", flexWrap: "wrap", overflow: "hidden" }}>

        {/* Kid filter */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "4px", padding: "10px 16px", flexShrink: 0 }}>
          <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Kid</span>
          <select style={s.filterSel} value={filterKid} onChange={e => setFilterKid(e.target.value)}>
            <option value="">All</option>
            {kidNames.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        <div style={{ width: "1px", background: "var(--border)", flexShrink: 0, alignSelf: "stretch" }} />

        {/* Section: last 5 */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ padding: "5px 16px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
            Last 5
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", padding: "8px 16px", flex: 1 }}>
            <span style={{ fontSize: "22px", fontWeight: 800, lineHeight: 1, color: summaryStats.overallLast5 != null ? "var(--text)" : "var(--text-muted)" }}>
              {summaryStats.overallLast5 != null ? summaryStats.overallLast5.toFixed(2) : "—"}
            </span>
            <div style={{ width: "1px", height: "28px", background: "var(--border)", flexShrink: 0 }} />
            {templates.map(t => {
              const val = summaryStats.perTplLast5[t.templateId];
              const color = tplColorMap[t.templateId];
              return (
                <div key={t.templateId} style={{ display: "flex", flexDirection: "column", gap: "1px", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, flexShrink: 0, display: "inline-block" }} />
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{t.name}</span>
                  </div>
                  <span style={{ fontSize: "16px", fontWeight: 700, color: val != null ? color : "var(--text-muted)", lineHeight: 1 }}>
                    {val != null ? val.toFixed(2) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ width: "1px", background: "var(--border)", flexShrink: 0, alignSelf: "stretch" }} />

        {/* Section: validated */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ padding: "5px 16px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
            Validated
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", padding: "8px 16px", flex: 1 }}>
            <span style={{ fontSize: "22px", fontWeight: 800, lineHeight: 1, color: summaryStats.overallValidated != null ? "var(--text)" : "var(--text-muted)" }}>
              {summaryStats.overallValidated != null ? summaryStats.overallValidated.toFixed(2) : "—"}
            </span>
            <div style={{ width: "1px", height: "28px", background: "var(--border)", flexShrink: 0 }} />
            {templates.map(t => {
              const val = summaryStats.perTplValidated[t.templateId];
              const color = tplColorMap[t.templateId];
              return (
                <div key={t.templateId} style={{ display: "flex", flexDirection: "column", gap: "1px", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, flexShrink: 0, display: "inline-block" }} />
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{t.name}</span>
                  </div>
                  <span style={{ fontSize: "16px", fontWeight: 700, color: val != null ? color : "var(--text-muted)", lineHeight: 1 }}>
                    {val != null ? val.toFixed(2) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ width: "1px", background: "var(--border)", flexShrink: 0, alignSelf: "stretch" }} />

        {/* Section: all tests */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ padding: "5px 16px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
            All tests
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", padding: "8px 16px", flex: 1 }}>
            <span style={{ fontSize: "22px", fontWeight: 800, lineHeight: 1, color: summaryStats.overall != null ? "var(--text)" : "var(--text-muted)" }}>
              {summaryStats.overall != null ? summaryStats.overall.toFixed(2) : "—"}
            </span>
            <div style={{ width: "1px", height: "28px", background: "var(--border)", flexShrink: 0 }} />
            {templates.map(t => {
              const val = summaryStats.perTplAllAvg[t.templateId];
              const color = tplColorMap[t.templateId];
              return (
                <div key={t.templateId} style={{ display: "flex", flexDirection: "column", gap: "1px", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, flexShrink: 0, display: "inline-block" }} />
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{t.name}</span>
                  </div>
                  <span style={{ fontSize: "16px", fontWeight: 700, color: val != null ? color : "var(--text-muted)", lineHeight: 1 }}>
                    {val != null ? val.toFixed(2) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ width: "1px", background: "var(--border)", flexShrink: 0, alignSelf: "stretch" }} />

      </div>

      {/* Chart + Calendar row */}
      <div style={s.statsRow}>

        {/* Left: grade timeline chart */}
        <div style={s.statsCard}>
          {/* Template toggle buttons replace the title */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap", marginBottom: "8px" }}>
            {templates.map(t => {
              const active = !hiddenTpls.has(t.templateId);
              const color  = tplColorMap[t.templateId];
              return (
                <button
                  key={t.templateId}
                  onClick={() => toggleTemplate(t.templateId)}
                  style={{
                    background:   active ? color + "22" : "var(--surface-2)",
                    border:       `1.5px solid ${active ? color : "var(--border)"}`,
                    borderRadius: "20px",
                    padding:      "2px 8px",
                    fontSize:     "11px",
                    fontWeight:   active ? 600 : 400,
                    color:        active ? color : "var(--text-muted)",
                    cursor:       "pointer",
                    fontFamily:   "inherit",
                    display:      "flex",
                    alignItems:   "center",
                    gap:          "4px",
                    opacity:      active ? 1 : 0.5,
                    transition:   "all 0.15s",
                  }}
                >
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: active ? color : "var(--text-muted)", flexShrink: 0, display: "inline-block" }} />
                  {t.name}
                </button>
              );
            })}
          </div>
          {timelineData.length < 2 ? (
            <div style={{ color: "var(--text-muted)", fontSize: "13px", padding: "20px 0" }}>
              Not enough data points yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={timelineData} margin={{ top: 36, right: 28, left: -20, bottom: 0 }}>
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
                      if (!cx || !cy || isNaN(cx) || isNaN(cy)) return null;
                      const meta    = timelineMeta[payload.date]?.[t.templateId];
                      const verified = meta?.verified;
                      const color   = tplColorMap[t.templateId];
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
                    label={({ x, y, value }) => {
                      if (value == null) return null;
                      return (
                        <g>
                          <rect x={x - 20} y={y - 27} width={40} height={17} rx={3} ry={3} fill="var(--surface)" stroke="var(--border)" strokeWidth={1} />
                          <text x={x} y={y - 14} textAnchor="middle" fill={tplColorMap[t.templateId]} fontSize={13} fontWeight={600}>
                            {Number(value).toFixed(2)}
                          </text>
                        </g>
                      );
                    }}
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

          <div style={s.calGrid}>
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
              <div key={d} style={s.calDow}>{d}</div>
            ))}
            {calCells.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />;
              const entries  = calDayMap[day] || [];
              const isToday  = dayjs().date() === day && dayjs().month() === calMon && dayjs().year() === calYear;
              const firstColor = entries.length > 0 ? tplColorMap[entries[0].templateId] : null;
              const dow      = new Date(calYear, calMon, day).getDay();
              const isWeekend = dow === 0 || dow === 6;
              return (
                <div key={day} style={{
                  ...s.calCell,
                  ...(isWeekend && entries.length === 0 ? { background: "rgba(148,163,184,0.10)" } : {}),
                  ...(isToday ? s.calCellToday : {}),
                  ...(entries.length > 0 ? { background: firstColor + "33", borderColor: firstColor + "99" } : {}),
                }}>
                  <span style={{ fontSize: "12px", fontWeight: isToday ? 700 : 400, color: entries.length > 0 ? firstColor : isWeekend ? "var(--text)" : "var(--text-muted)" }}>
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

          {templates.length > 0 && (
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

      {/* Topic pass-rate blocks — one per visible template */}
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
