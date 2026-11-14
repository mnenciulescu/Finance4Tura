import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useResolvedColors } from "../../theme/useChartTheme";
import type { MonthCount } from "./libraryMath";
import s from "./Library.module.css";

function MonthTooltip({ active, payload }: { active?: boolean; payload?: { payload: MonthCount }[] }) {
  if (!active || !payload?.length) return null;
  const { key, label, count } = payload[0].payload;
  return <div className={s.tooltip}>{label} {key.slice(0, 4)} · <strong>{count}</strong> completed</div>;
}

/** Entries completed per month over the last 12 months, oldest to newest. */
export default function MonthlyChart({ data, person }: { data: MonthCount[]; person: string }) {
  const c = useResolvedColors({ tint: "--tint", label: "--label-secondary", grid: "--separator" });
  const total = data.reduce((sum, m) => sum + m.count, 0);
  return (
    <div role="img" aria-label={`${person}: ${total} completed in the last 12 months`}>
      <ResponsiveContainer width="100%" height={110}>
        <LineChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: c.label, fontSize: 10 }} tickLine={false} axisLine={false} interval={0} tickFormatter={(l: string) => l.slice(0, 1)} />
          <YAxis allowDecimals={false} tick={{ fill: c.label, fontSize: 10 }} tickLine={false} axisLine={false} width={22} />
          <Tooltip cursor={{ stroke: c.grid }} content={<MonthTooltip />} />
          <Line
            type="monotone"
            dataKey="count"
            stroke={c.tint}
            strokeWidth={2.25}
            dot={{ r: 2.5, fill: c.tint, strokeWidth: 0 }}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
