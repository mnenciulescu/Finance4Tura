import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useResolvedColors } from "../../theme/useChartTheme";
import { fmtNum } from "../../utils/format";
import type { SeriesPoint } from "./pv2Math";
import s from "./PortfolioV2.module.css";

/** A point where the line has a snapshot of its own on that day (Total: any platform's). */
const snapDot = (key: string, fill: string, stroke: string, r: number) =>
  function SnapDot({ cx, cy, payload }: { cx?: number; cy?: number; payload?: SeriesPoint }) {
    const k = `${key}-${payload?.date}`;
    if (!payload?.snapped || cx == null || cy == null || Number.isNaN(cy) || typeof payload[key] !== "number") return <g key={k} />;
    if (key !== "Total" && !payload.snapped.split(",").includes(key)) return <g key={k} />;
    return <circle key={k} cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={1.5} />;
  };

const fmtDay = (t: number) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
const fmtDayYear = (t: number) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function ChartTooltip({ active, payload, lines, first }: {
  active?: boolean; payload?: { payload: SeriesPoint }[]; lines: string[]; first: SeriesPoint | undefined;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className={s.tooltip}>
      <div className={s.tooltipHead}>{fmtDayYear(p.t)}</div>
      {p.imported && <div className={s.tooltipNote}>Imported history: {p.imported.split(",").join(", ")}</div>}
      {lines.map(k => {
        const v = p[k];
        if (typeof v !== "number") return null;
        const base = first?.[k];
        const diff = typeof base === "number" ? v - base : null;
        return (
          <div key={k} className={s.tooltipRow}>
            <span>{k === "Total" ? "Portfolio" : k}</span>
            <span>
              <strong>{fmtNum(v)} EUR</strong>
              {diff != null && diff !== 0 && (
                <span className={diff > 0 ? s.positive : s.negative}>
                  {" "}{diff > 0 ? "+" : "−"}{fmtNum(Math.abs(diff))}{typeof base === "number" && base !== 0 ? ` (${((diff / base) * 100).toFixed(1)}%)` : ""}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Portfolio v2 value in EUR over time: a curved line per visible platform and
 * the portfolio total, with a point on each snapshot day. Masked: the shape stays, axis values and tooltip go.
 */
export default function PortfolioChart({
  data, platforms, colors, visible, masked, height = 260,
}: {
  data: SeriesPoint[]; platforms: string[]; colors: Record<string, string>; visible: Set<string>; masked?: boolean; height?: number;
}) {
  const c = useResolvedColors({ total: "--label", surface: "--bg-grouped-secondary", label: "--label-secondary", grid: "--separator", ...colors });
  const lines = ["Total", ...platforms].filter(k => visible.has(k));
  const latest = [...data].reverse().find(d => typeof d.Total === "number")?.Total;
  return (
    <div role="img" aria-label={`Portfolio v2 value${latest != null && !masked ? `, latest ${fmtNum(latest as number)} EUR` : ""}`}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={fmtDay}
            tick={{ fontSize: 11, fill: c.label }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: c.label }}
            tickLine={false}
            axisLine={false}
            width={masked ? 8 : 44}
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => (masked ? "" : v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : fmtNum(v))}
          />
          {!masked && <Tooltip content={<ChartTooltip lines={lines} first={data[0]} />} />}
          {platforms.map(p => (
            <Line
              key={p} type="monotone" dataKey={p} stroke={c[p]} strokeWidth={1.5} dot={snapDot(p, c[p], c.surface, 3)} activeDot={{ r: 3.5, fill: c[p] }}
              hide={!visible.has(p)} connectNulls isAnimationActive={false}
            />
          ))}
          <Line
            type="monotone" dataKey="Total" name="Portfolio" stroke={c.total} strokeWidth={2.5} dot={snapDot("Total", c.total, c.surface, 3.5)} activeDot={{ r: 4, fill: c.total }}
            hide={!visible.has("Total")} connectNulls isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
