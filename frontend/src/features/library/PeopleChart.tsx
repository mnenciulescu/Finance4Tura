import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useResolvedColors } from "../../theme/useChartTheme";
import type { MonthCount } from "./libraryMath";
import s from "./Library.module.css";

export interface PersonSeries { person: string; monthly: MonthCount[]; }

/** Series colour for the n-th person (shared with the chart's legend chips). */
// eslint-disable-next-line react-refresh/only-export-components
export const personColor = (i: number) => `--series-${(i % 8) + 1}`;

/**
 * Entries completed per month over the last 12 months, one line per person
 * (One-Page → Statistics → Library). Same counting as the Library's
 * per-person chart.
 */
export default function PeopleChart({ series, height = 240 }: { series: PersonSeries[]; height?: number }) {
  const c = useResolvedColors({
    label: "--label-secondary", grid: "--separator",
    ...Object.fromEntries(series.map((p, i) => [p.person, personColor(i)])),
  });
  const months = series[0]?.monthly ?? [];
  const data = months.map((m, i) => ({
    key: m.key,
    label: m.label,
    ...Object.fromEntries(series.map(p => [p.person, p.monthly[i]?.count ?? 0])),
  }));
  const total = series.reduce((sum, p) => sum + p.monthly.reduce((t, m) => t + m.count, 0), 0);

  return (
    <div role="img" aria-label={`${total} completed in the last 12 months across ${series.length} ${series.length === 1 ? "person" : "people"}`}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: c.label, fontSize: 11 }} tickLine={false} axisLine={false} interval={0} />
          <YAxis allowDecimals={false} tick={{ fill: c.label, fontSize: 11 }} tickLine={false} axisLine={false} width={24} />
          <Tooltip
            cursor={{ stroke: c.grid }}
            content={({ active, payload, label }: any) => (active && payload?.length ? (
              <div className={s.tooltip}>
                <strong>{label} {payload[0].payload.key.slice(0, 4)}</strong>
                {payload.map((p: any) => <div key={p.dataKey}>{p.dataKey}: <strong>{p.value}</strong></div>)}
              </div>
            ) : null)}
          />
          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "6px" }} />
          {series.map(p => (
            <Line
              key={p.person}
              type="monotone"
              dataKey={p.person}
              stroke={c[p.person]}
              strokeWidth={2.25}
              dot={{ r: 2.5, fill: c[p.person], strokeWidth: 0 }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
