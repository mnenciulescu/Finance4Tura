import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useResolvedColors } from "../../theme/useChartTheme";
import { WATER_COLOR } from "../../theme/domainColors";
import type { HqEntry, HqTemplate } from "../../types";
import { waterChartData } from "./hqMath";
import s from "./Hq.module.css";

const NAMES: Record<string, string> = { apaRece: "Consum Apa Rece", apaCalda: "Consum Apa Calda" };

function WaterTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={s.tooltip}>
      <div className={s.tooltipHead}>{label}</div>
      {payload.map(p => <div key={p.name}>{NAMES[p.name]}: <strong>{p.value} m³/mo</strong></div>)}
    </div>
  );
}

/** Monthly cold / hot water consumption with dashed averages (last 3 years). */
export default function WaterChart({ template, entries }: { template: HqTemplate; entries: HqEntry[] }) {
  const c = useResolvedColors({ cold: WATER_COLOR.cold, hot: WATER_COLOR.hot, label: "--label-secondary", grid: "--separator", surface: "--bg-grouped-secondary" });
  const data = waterChartData(template, entries);
  if (data.length === 0) return <p className={s.muted}>At least two readings are needed for a chart.</p>;
  const avg = (k: "apaRece" | "apaCalda") => Math.round((data.reduce((sum, d) => sum + d[k], 0) / data.length) * 100) / 100;
  const avgCold = avg("apaRece");
  const avgHot = avg("apaCalda");
  return (
    <div role="img" aria-label={`Water consumption: average cold ${avgCold}, hot ${avgHot} cubic metres a month`}>
      <ResponsiveContainer width="100%" height={210}>
        <LineChart data={data} margin={{ top: 16, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: c.label }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: c.label }} axisLine={false} tickLine={false} width={32} />
          <Tooltip content={<WaterTooltip />} />
          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "6px" }} formatter={(v: string) => NAMES[v] ?? v} />
          <Line type="monotone" dataKey="apaRece" name="apaRece" stroke={c.cold} strokeWidth={2} dot={{ r: 3, fill: c.cold, strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false} label={{ position: "top", fontSize: 10, fill: c.cold }} />
          <Line type="monotone" dataKey="apaCalda" name="apaCalda" stroke={c.hot} strokeWidth={2} dot={{ r: 3, fill: c.hot, strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false} label={{ position: "top", fontSize: 10, fill: c.hot }} />
          <ReferenceLine y={avgCold} stroke={c.cold} strokeDasharray="5 4" strokeOpacity={0.6} label={{ value: `avg ${avgCold}`, position: "insideTopRight", fontSize: 11, fill: c.cold }} />
          <ReferenceLine y={avgHot} stroke={c.hot} strokeDasharray="5 4" strokeOpacity={0.6} label={{ value: `avg ${avgHot}`, position: "insideBottomRight", fontSize: 11, fill: c.hot }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
