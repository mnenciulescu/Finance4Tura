import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useResolvedColors } from "../../../theme/useChartTheme";
import { fmtAxis, fmtInt } from "../../../utils/format";
import type { MonthRow } from "./statsMath";
import s from "./Stats.module.css";

function MonthTooltip({ active, payload }: { active?: boolean; payload?: { payload: MonthRow }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  if (r.free == null) return null;
  return (
    <div className={s.tooltip}>
      <div className={s.tooltipHead}>{r.label}</div>
      <div>Income {fmtInt(r.income)}</div>
      <div>High {fmtInt(r.high)} · Medium {fmtInt(r.medium)} · Low {fmtInt(r.low)}</div>
      <div className={r.free < 0 ? s.negative : s.positive}>Free {fmtInt(r.free)}</div>
    </div>
  );
}

/**
 * Free amount per month. Rounded bar tops, current month at full opacity and
 * the rest at 50 %, a dashed "now" marker and a zero line. Tapping a bar
 * selects its month (the breakdown shows under the chart).
 */
export default function FreeChart({
  rows, currentMonth, selected, onSelect,
}: { rows: MonthRow[]; currentMonth: number; selected: number | null; onSelect: (i: number | null) => void }) {
  const c = useResolvedColors({
    positive: "--tint", negative: "--status-negative", label: "--label-secondary", grid: "--separator",
    now: "--label-tertiary", fill: "--fill-secondary",
  });
  const best = rows.reduce((b, r, i) => ((r.free ?? -Infinity) > (rows[b]?.free ?? -Infinity) ? i : b), 0);
  const summary = `Free amount per month; highest ${rows[best]?.label} ${fmtInt(rows[best]?.free)}`;

  return (
    <div role="img" aria-label={summary} className={s.chart}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={rows}
          margin={{ top: 14, right: 4, left: 0, bottom: 0 }}
          onClick={(state: any) => {
            const idx = state?.activeTooltipIndex;
            if (typeof idx === "number" || typeof idx === "string") onSelect(Number(idx) === selected ? null : Number(idx));
          }}
        >
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: c.label, fontSize: 11 }} tickLine={false} axisLine={false} interval={0} tickFormatter={(l: string) => l.slice(0, 1)} />
          <YAxis tick={{ fill: c.label, fontSize: 11 }} tickFormatter={fmtAxis} tickLine={false} axisLine={false} width={40} />
          <Tooltip cursor={{ fill: c.fill }} content={<MonthTooltip />} />
          {currentMonth >= 0 && (
            <ReferenceLine
              x={rows[currentMonth]?.label}
              stroke={c.now}
              strokeDasharray="4 3"
              label={{ value: "now", position: "top", fontSize: 10, fill: c.label }}
            />
          )}
          <ReferenceLine y={0} stroke={c.now} />
          <Bar dataKey="free" name="Free" radius={[6, 6, 0, 0]} isAnimationActive={false}>
            {rows.map((r, i) => (
              <Cell
                key={i}
                fill={r.free == null ? "transparent" : r.free >= 0 ? c.positive : c.negative}
                fillOpacity={selected === i || (selected == null && i === currentMonth) ? 1 : 0.5}
                cursor="pointer"
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
