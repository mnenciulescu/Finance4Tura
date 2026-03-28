import { LineChart, Line, ReferenceLine, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import s from "./styles";

// ── Water chart helpers ───────────────────────────────────────────────────────

function fmtDate(d) {
  const [y, m] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m, 10) - 1]} '${y.slice(2)}`;
}

function findWaterParamIds(template) {
  const params = template.parameters || [];
  const findId = (...titles) => {
    for (const t of titles) {
      const p = params.find(p => p.title.trim() === t.trim());
      if (p) return p.parameterId;
    }
    return null;
  };
  return {
    baieReceId: findId("Baie - Apa Rece"),
    bucReceId:  findId("Bucatarie - Apa Rece", "Bucatarie  - Apa Rece"),
    baieCalId:  findId("Baie - Apa Calda"),
    bucCalId:   findId("Bucatarie - Apa Calda", "Bucatarie  - Apa Calda"),
  };
}

function isWaterTemplate(template) {
  const { baieReceId, bucReceId, baieCalId, bucCalId } = findWaterParamIds(template);
  return !!(baieReceId && bucReceId && baieCalId && bucCalId);
}

function getVal(entry, id) {
  if (!id) return null;
  const v = (entry.values || []).find(x => x.parameterId === id);
  if (v?.value === null || v?.value === undefined || v?.value === "") return null;
  return Number(v.value);
}

const THREE_YEARS_AGO = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 3);
  return d.toISOString().slice(0, 10);
})();

function buildWaterChartData(template, entries) {
  const { baieReceId, bucReceId, baieCalId, bucCalId } = findWaterParamIds(template);
  const allSorted = entries
    .filter(e => e.templateId === template.templateId)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (allSorted.length < 2) return [];

  const firstInWindowIdx = allSorted.findIndex(e => e.date >= THREE_YEARS_AGO);
  const startIdx = firstInWindowIdx <= 0 ? 1 : firstInWindowIdx;

  const data = [];
  for (let i = startIdx; i < allSorted.length; i++) {
    const curr = allSorted[i];
    const prev = allSorted[i - 1];
    if (curr.date < THREE_YEARS_AGO) continue;
    const days = (new Date(curr.date) - new Date(prev.date)) / 86400000;
    if (days <= 0) continue;

    const currRece = (getVal(curr, baieReceId) ?? 0) + (getVal(curr, bucReceId) ?? 0);
    const prevRece = (getVal(prev, baieReceId) ?? 0) + (getVal(prev, bucReceId) ?? 0);
    const currCal  = (getVal(curr, baieCalId)  ?? 0) + (getVal(curr, bucCalId)  ?? 0);
    const prevCal  = (getVal(prev, baieCalId)  ?? 0) + (getVal(prev, bucCalId)  ?? 0);

    data.push({
      label:    fmtDate(curr.date),
      apaRece:  Math.round((currRece - prevRece) / days * 30 * 100) / 100,
      apaCalda: Math.round((currCal  - prevCal)  / days * 30 * 100) / 100,
    });
  }
  return data;
}

// ── Chart sub-components ──────────────────────────────────────────────────────

function DotLabel({ x, y, value, color }) {
  if (value == null) return null;
  const text = String(value);
  const w = text.length * 6.5 + 10;
  return (
    <g>
      <rect x={x - w / 2} y={y - 24} width={w} height={16} rx={4} ry={4}
        fill="var(--surface)" stroke={color} strokeWidth={1} opacity={0.9} />
      <text x={x} y={y - 16} textAnchor="middle" dominantBaseline="middle"
        fontSize={11} fontWeight={600} fill={color}>{text}</text>
    </g>
  );
}

function WaterTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", color: "var(--text)" }}>
      <div style={{ fontWeight: 700, marginBottom: "4px" }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, display: "flex", gap: "6px" }}>
          <span>{p.name === "apaRece" ? "Consum Apa Rece" : "Consum Apa Calda"}:</span>
          <strong>{p.value} m³/mo</strong>
        </div>
      ))}
    </div>
  );
}

function WaterChart({ template, entries }) {
  const data = buildWaterChartData(template, entries);
  if (!data.length) return <div style={{ color: "var(--text-muted)", fontSize: "12px", fontStyle: "italic" }}>Not enough data.</div>;

  const avg = key => {
    const vals = data.map(d => d[key]).filter(v => v != null);
    if (!vals.length) return null;
    return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length * 100) / 100;
  };
  const avgRece  = avg("apaRece");
  const avgCalda = avg("apaCalda");

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 32, right: 48, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} width={36} />
        <Tooltip content={<WaterTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
          formatter={v => v === "apaRece" ? "Consum Apa Rece" : "Consum Apa Calda"}
        />
        <Line type="linear" dataKey="apaRece" name="apaRece" stroke="#60a5fa" strokeWidth={2}
          dot={{ r: 3, fill: "#60a5fa", strokeWidth: 0 }} activeDot={{ r: 5 }} label={<DotLabel color="#60a5fa" />} />
        <Line type="linear" dataKey="apaCalda" name="apaCalda" stroke="#f97316" strokeWidth={2}
          dot={{ r: 3, fill: "#f97316", strokeWidth: 0 }} activeDot={{ r: 5 }} label={<DotLabel color="#f97316" />} />
        {avgRece != null && (
          <ReferenceLine y={avgRece} stroke="#60a5fa" strokeDasharray="5 4" strokeWidth={1.5} opacity={0.6}
            label={{ value: `avg ${avgRece}`, position: "insideTopRight", fontSize: 11, fill: "#60a5fa", fontWeight: 600 }} />
        )}
        {avgCalda != null && (
          <ReferenceLine y={avgCalda} stroke="#f97316" strokeDasharray="5 4" strokeWidth={1.5} opacity={0.6}
            label={{ value: `avg ${avgCalda}`, position: "insideBottomRight", fontSize: 11, fill: "#f97316", fontWeight: 600 }} />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Generic entry table (read-only) ───────────────────────────────────────────

function EntryReadTable({ template, entries }) {
  const params = template.parameters || [];
  const sorted = [...entries]
    .filter(e => e.templateId === template.templateId)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (!sorted.length) return <div style={{ color: "var(--text-muted)", fontSize: "12px", fontStyle: "italic" }}>No entries yet.</div>;

  return (
    <div style={s.tableWrap}>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Date</th>
            {params.map(p => <th key={p.parameterId} style={s.th}>{p.title}{p.unit ? ` (${p.unit})` : ""}</th>)}
            <th style={s.th}>Notes</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(entry => (
            <tr key={entry.entryId} style={s.tr}>
              <td style={{ ...s.td, whiteSpace: "nowrap" }}>{entry.date}</td>
              {params.map(p => {
                const v   = (entry.values || []).find(x => x.parameterId === p.parameterId);
                const val = v?.value;
                return (
                  <td key={p.parameterId} style={{ ...s.td, whiteSpace: "normal", wordBreak: "break-word" }}>
                    {val === null || val === undefined || val === ""
                      ? <span style={{ color: "var(--text-muted)" }}>—</span>
                      : String(val)}
                  </td>
                );
              })}
              <td style={{ ...s.td, whiteSpace: "normal", wordBreak: "break-word", color: entry.notes ? "var(--text)" : "var(--text-muted)" }}>
                {entry.notes || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Column card ───────────────────────────────────────────────────────────────

function ColumnCard({ location, templates, entries }) {
  const locTemplates = templates.filter(t => t.hqId === location.hqId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)", paddingBottom: "8px", borderBottom: "1px solid var(--border)" }}>
        {location.name}
        {location.address && <div style={{ fontSize: "11px", fontWeight: 400, color: "var(--text-muted)", marginTop: "2px" }}>{location.address}</div>}
      </div>

      {locTemplates.length === 0 && (
        <div style={{ color: "var(--text-muted)", fontSize: "12px", fontStyle: "italic" }}>No templates configured.</div>
      )}

      {locTemplates.map(tpl => (
        <div key={tpl.templateId} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {tpl.name}
          </div>
          {isWaterTemplate(tpl)
            ? <WaterChart template={tpl} entries={entries} />
            : <EntryReadTable template={tpl} entries={entries} />
          }
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DashboardTab({ locations, templates, entries }) {
  if (locations.length === 0) {
    return (
      <div style={s.tabContent}>
        <div style={s.empty}>No locations configured yet. Go to Settings to add your first location.</div>
      </div>
    );
  }

  return (
    <div style={s.tabContent}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
        {locations.map(loc => (
          <ColumnCard key={loc.hqId} location={loc} templates={templates} entries={entries} />
        ))}
      </div>
    </div>
  );
}
