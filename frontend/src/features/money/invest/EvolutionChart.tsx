import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useResolvedColors } from "../../../theme/useChartTheme";
import { PLATFORM_COLOR } from "../../../theme/domainColors";
import { fmtNum, MONTH_ABBR } from "../../../utils/format";
import type { ChartPoint } from "./investMath";
import s from "./Invest.module.css";

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartPoint }[] }) {
  if (!active || !payload?.length) return null;
  const { date, portfolio, cashFlow, ops, hasOp } = payload[0].payload;
  return (
    <div className={s.tooltip}>
      <div className={s.tooltipHead}>{MONTH_ABBR[Number(date.slice(5, 7)) - 1]} {date.slice(0, 4)}</div>
      {portfolio != null && <div className={s.tooltipRow}><span>Portfolio</span><strong>{fmtNum(portfolio)} EUR</strong></div>}
      {hasOp && ops.map((op, i) => (
        <div key={i} className={s.tooltipRow}>
          <span>{op.type} · {op.platform}</span>
          <span className={op.type === "Deposit" ? s.positive : s.negative}>{op.type === "Deposit" ? "+" : "−"}{fmtNum(op.amount)} {op.currency}</span>
        </div>
      ))}
      {cashFlow != null && (
        <div className={s.tooltipRow}><span>Net cash</span><strong className={cashFlow >= 0 ? s.positive : s.negative}>{fmtNum(cashFlow)} EUR</strong></div>
      )}
    </div>
  );
}

/**
 * Portfolio value in EUR, month by month (proposal §8.7): Total plus one line
 * per active platform (hidden by default), all connectNulls. Dots mark months
 * with operations.
 */
export default function EvolutionChart({ data, platforms, hidden }: { data: ChartPoint[]; platforms: string[]; hidden: Set<string> }) {
  const c = useResolvedColors({
    total: "--label", tint: "--tint", label: "--label-secondary", grid: "--separator", surface: "--bg-grouped-secondary",
    ...Object.fromEntries(platforms.map(p => [p, PLATFORM_COLOR[p]])),
  });
  const first = data[0]?.x ?? 0;
  const last = data.at(-1)?.x ?? 1;
  // x is "years since the chart's first year"; recover that year from any point.
  const baseYear = data.length ? Number(data[0].date.slice(0, 4)) - Math.floor(first) : new Date().getFullYear();
  const ticks = [...new Set(data.map(d => Number(d.date.slice(0, 4)) - baseYear))].filter(t => t >= first && t <= last);
  const latest = [...data].reverse().find(d => d.portfolio != null)?.portfolio;

  return (
    <div role="img" aria-label={`Portfolio evolution${latest != null ? `, latest ${fmtNum(latest)} EUR` : ""}`}>
      <ResponsiveContainer width="100%" height={210}>
        <ComposedChart data={data} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.tint} stopOpacity={0.25} />
              <stop offset="100%" stopColor={c.tint} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis
            dataKey="x"
            type="number"
            domain={[first, last]}
            ticks={ticks.length ? ticks : undefined}
            tickFormatter={(i: number) => String(baseYear + Math.round(i))}
            tick={{ fontSize: 11, fill: c.label }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: c.label }}
            tickLine={false}
            axisLine={false}
            width={40}
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : fmtNum(v))}
          />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone" dataKey="portfolio" stroke="none" fill="url(#portfolioFill)" isAnimationActive={false}
            activeDot={false} legendType="none" tooltipType="none" hide={hidden.has("Total")} connectNulls
          />
          {platforms.map(p => (
            <Line
              key={p}
              type="monotone"
              dataKey={p}
              stroke={c[p]}
              strokeWidth={1.5}
              dot={({ cx, cy, payload }: any) => {
                if (!payload.hasOp || payload[p] == null || isNaN(cy)) return <g key={`${p}-${payload.date}`} />;
                return <circle key={`${p}-${payload.date}`} cx={cx} cy={cy} r={3.5} fill={c[p]} stroke={c.surface} strokeWidth={1.5} />;
              }}
              activeDot={{ r: 3, fill: c[p] }}
              hide={hidden.has(p)}
              connectNulls
              isAnimationActive={false}
            />
          ))}
          <Line
            type="monotone"
            dataKey="portfolio"
            name="Portfolio total"
            stroke={c.total}
            strokeWidth={2.5}
            dot={({ cx, cy, payload }: any) => {
              if (!payload.hasOp || payload.portfolio == null || isNaN(cy)) return <g key={`t-${payload.date}`} />;
              return <circle key={`t-${payload.date}`} cx={cx} cy={cy} r={4.5} fill={c.total} stroke={c.surface} strokeWidth={1.5} />;
            }}
            activeDot={{ r: 4, fill: c.total }}
            hide={hidden.has("Total")}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
