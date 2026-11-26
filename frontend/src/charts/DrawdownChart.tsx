import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipProps } from "recharts";
import { useMemo } from "react";
import { useInView } from "../hooks/useInView";
import { formatDate, formatPercent } from "../lib/format";
import { useEntryAnimation } from "../hooks/useEntryAnimation";
import type { DrawdownInfo, SeriesPoint } from "../types/api";
import { CHART, TICK_STYLE, dateTicks } from "./theme";

interface Props {
  series: SeriesPoint[];
  drawdown: DrawdownInfo;
  benchmarkLabel: string;
}

/**
 * Underwater chart: distance below the running peak at each date. The
 * deepest episode (peak -> recovery, or to the end if not recovered) is
 * shaded and its trough marked.
 */
export function DrawdownChart({ series, drawdown, benchmarkLabel }: Props) {
  const [ref, inView] = useInView<HTMLDivElement>(0.25);
  const animate = useEntryAnimation(inView);
  const xTicks = useMemo(() => dateTicks(series.map((p) => p.date)), [series]);
  const episodeEnd = drawdown.recovery_date ?? series[series.length - 1]?.date;

  return (
    <div ref={ref}>
      <div className="mb-5 flex flex-wrap gap-x-8 gap-y-2 text-[13px] text-ink-2">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-4 rounded-sm" style={{ background: CHART.portfolio, opacity: 0.35 }} aria-hidden="true" />
          Portfolio drawdown
        </span>
        <span className="flex items-center gap-2">
          <svg width="18" height="6" aria-hidden="true">
            <line x1="0" x2="18" y1="3" y2="3" stroke={CHART.benchmark} strokeWidth="1.5" strokeDasharray="4 3" />
          </svg>
          {benchmarkLabel} drawdown
        </span>
        {drawdown.peak_date && (
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-4 rounded-sm border border-ink/10" style={{ background: CHART.episode }} aria-hidden="true" />
            Deepest episode
          </span>
        )}
      </div>
      <div className="h-[260px] sm:h-[320px]" role="img" aria-label="Area chart of portfolio drawdown from its running peak over time.">
        {inView && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="ddFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.portfolio} stopOpacity={0.12} />
                  <stop offset="100%" stopColor={CHART.portfolio} stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={CHART.grid} />
              {drawdown.peak_date && episodeEnd && (
                <ReferenceArea x1={drawdown.peak_date} x2={episodeEnd} fill={CHART.ink} fillOpacity={0.045} ifOverflow="extendDomain" />
              )}
              <XAxis
                dataKey="date"
                tick={TICK_STYLE}
                tickLine={false}
                axisLine={{ stroke: CHART.axis }}
                ticks={xTicks.ticks}
                tickFormatter={xTicks.format}
                interval={0}
                tickMargin={10}
              />
              <YAxis
                tick={TICK_STYLE}
                tickLine={false}
                axisLine={false}
                width={48}
                orientation="right"
                domain={["dataMin", 0]}
                tickFormatter={(v: number) => formatPercent(v, 0)}
              />
              <Tooltip content={<DdTooltip benchmarkLabel={benchmarkLabel} />} cursor={{ stroke: CHART.ink, strokeOpacity: 0.25 }} isAnimationActive={false} />
              <Area
                type="monotone"
                dataKey="portfolio_drawdown"
                stroke={CHART.portfolio}
                strokeWidth={1.5}
                fill="url(#ddFill)"
                baseValue={0}
                isAnimationActive={animate}
                animationDuration={1600}
                activeDot={{ r: 4, fill: CHART.portfolio, stroke: CHART.surface, strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="benchmark_drawdown"
                stroke={CHART.benchmark}
                strokeWidth={1.25}
                strokeDasharray="4 3"
                dot={false}
                isAnimationActive={animate}
                animationDuration={1600}
              />
              {drawdown.trough_date && (
                <ReferenceDot
                  x={drawdown.trough_date}
                  y={drawdown.max_drawdown}
                  r={5}
                  fill={CHART.ink}
                  stroke={CHART.surface}
                  strokeWidth={2}
                  label={{ value: formatPercent(drawdown.max_drawdown, 1), position: "bottom", fill: CHART.ink, fontSize: 12, fontWeight: 600, offset: 10 }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function DdTooltip({ active, payload, benchmarkLabel }: TooltipProps<number, string> & { benchmarkLabel: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as SeriesPoint;
  return (
    <div className="min-w-[210px] rounded-lg border border-line bg-white/95 px-4 py-3 text-[13px] shadow-[0_12px_32px_-12px_rgba(0,0,0,0.25)] backdrop-blur">
      <p className="mb-2 font-medium">{formatDate(p.date)}</p>
      <div className="flex justify-between gap-6 text-ink-2">
        <span>Portfolio below peak</span>
        <span className="num font-medium text-ink">{formatPercent(p.portfolio_drawdown, 2)}</span>
      </div>
      <div className="flex justify-between gap-6 text-ink-2">
        <span>{benchmarkLabel}</span>
        <span className="num font-medium text-ink">{formatPercent(p.benchmark_drawdown, 2)}</span>
      </div>
    </div>
  );
}
