import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipProps } from "recharts";
import { useInView } from "../hooks/useInView";
import { formatCurrency, formatDate, formatPercent } from "../lib/format";
import { prefersReducedMotion } from "../lib/gsap";
import type { SeriesPoint } from "../types/api";
import { CHART, TICK_STYLE, dateTicks } from "./theme";

interface Props {
  series: SeriesPoint[];
  benchmarkLabel: string;
}

type Range = "ALL" | "3Y" | "1Y" | "6M";
const RANGE_DAYS: Record<Exclude<Range, "ALL">, number> = { "3Y": 365 * 3, "1Y": 365, "6M": 183 };

interface Row {
  date: string;
  portfolio: number;
  benchmark: number;
  value: number;
}

/**
 * Growth of 100: portfolio vs benchmark. When a shorter range is selected the
 * visible window is re-based to 100 at its own first day, so every point reads
 * as "change since the start of what you're looking at".
 */
export function PerformanceChart({ series, benchmarkLabel }: Props) {
  const [range, setRange] = useState<Range>("ALL");
  const [ref, inView] = useInView<HTMLDivElement>(0.25);

  const spanDays = useMemo(() => {
    if (series.length < 2) return 0;
    return (Date.parse(series[series.length - 1].date) - Date.parse(series[0].date)) / 86_400_000;
  }, [series]);
  const ranges = (["ALL", "3Y", "1Y", "6M"] as Range[]).filter((r) => r === "ALL" || RANGE_DAYS[r] < spanDays - 20);

  const rows: Row[] = useMemo(() => {
    let window = series;
    if (range !== "ALL") {
      const cutoff = Date.parse(series[series.length - 1].date) - RANGE_DAYS[range] * 86_400_000;
      window = series.filter((p) => Date.parse(p.date) >= cutoff);
    }
    const p0 = window[0]?.portfolio ?? 100;
    const b0 = window[0]?.benchmark ?? 100;
    return window.map((p) => ({
      date: p.date,
      portfolio: (p.portfolio / p0) * 100,
      benchmark: (p.benchmark / b0) * 100,
      value: p.portfolio_value,
    }));
  }, [series, range]);

  const last = rows[rows.length - 1];
  const animate = !prefersReducedMotion();
  const xTicks = useMemo(() => dateTicks(rows.map((r) => r.date)), [rows]);

  return (
    <div ref={ref}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        {/* Legend doubles as the end-value readout (direct labels) */}
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <LegendItem color={CHART.portfolio} label="Your portfolio" value={last ? last.portfolio / 100 - 1 : 0} />
          <LegendItem color={CHART.benchmark} label={benchmarkLabel} value={last ? last.benchmark / 100 - 1 : 0} dashed />
        </div>
        {ranges.length > 1 && (
          <div className="flex gap-1 rounded-full bg-ink/[0.05] p-1" role="group" aria-label="Chart range">
            {ranges.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                aria-pressed={range === r}
                className={`rounded-full px-3 py-1 text-[12px] font-medium transition-all duration-300 ${
                  range === r ? "bg-white text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-ink-3 hover:text-ink"
                }`}
              >
                {r === "ALL" ? "All" : r}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-[340px] sm:h-[460px]" role="img" aria-label={`Line chart of portfolio and ${benchmarkLabel} growth, rebased to 100.`}>
        {inView && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={CHART.grid} strokeWidth={1} />
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
                width={44}
                domain={["auto", "auto"]}
                tickFormatter={(v: number) => v.toFixed(0)}
                orientation="right"
              />
              <ReferenceLine y={100} stroke={CHART.axis} strokeDasharray="2 4" />
              <Tooltip
                content={<PerfTooltip benchmarkLabel={benchmarkLabel} />}
                cursor={{ stroke: CHART.ink, strokeOpacity: 0.25, strokeWidth: 1 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="benchmark"
                stroke={CHART.benchmark}
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
                activeDot={{ r: 4, fill: CHART.benchmark, stroke: CHART.surface, strokeWidth: 2 }}
                isAnimationActive={animate}
                animationDuration={1800}
                animationEasing="ease-out"
              />
              <Line
                type="monotone"
                dataKey="portfolio"
                stroke={CHART.portfolio}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: CHART.portfolio, stroke: CHART.surface, strokeWidth: 2 }}
                isAnimationActive={animate}
                animationDuration={1800}
                animationEasing="ease-out"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="mt-3 text-[12px] text-ink-3">
        Value of 100 invested at the start of the {range === "ALL" ? "period" : "visible range"}. Dashed line marks the
        starting level.
      </p>
    </div>
  );
}

function LegendItem({ color, label, value, dashed }: { color: string; label: string; value: number; dashed?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-[13px] text-ink-2">
        <svg width="18" height="6" aria-hidden="true">
          <line x1="0" x2="18" y1="3" y2="3" stroke={color} strokeWidth="2" strokeDasharray={dashed ? "4 3" : undefined} />
        </svg>
        {label}
      </div>
      <div className="num mt-1 text-2xl font-semibold tracking-tight">{formatPercent(value, 1, true)}</div>
    </div>
  );
}

function PerfTooltip({ active, payload, benchmarkLabel }: TooltipProps<number, string> & { benchmarkLabel: string }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as Row;
  const diff = row.portfolio - row.benchmark;
  return (
    <div className="min-w-[220px] rounded-lg border border-line bg-white/95 px-4 py-3 text-[13px] shadow-[0_12px_32px_-12px_rgba(0,0,0,0.25)] backdrop-blur">
      <p className="mb-2 font-medium text-ink">{formatDate(row.date)}</p>
      <TipRow color={CHART.portfolio} label="Portfolio" value={formatPercent(row.portfolio / 100 - 1, 2, true)} />
      <TipRow color={CHART.benchmark} label={benchmarkLabel} value={formatPercent(row.benchmark / 100 - 1, 2, true)} dashed />
      <div className="mt-2 flex justify-between gap-6 border-t border-line pt-2 text-ink-3">
        <span>Gap vs benchmark</span>
        <span className="num text-ink">{diff >= 0 ? "+" : "−"}{Math.abs(diff).toFixed(1)} pts</span>
      </div>
      <div className="flex justify-between gap-6 text-ink-3">
        <span>Portfolio value</span>
        <span className="num text-ink">{formatCurrency(row.value)}</span>
      </div>
    </div>
  );
}

function TipRow({ color, label, value, dashed }: { color: string; label: string; value: string; dashed?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-6 py-0.5">
      <span className="flex items-center gap-2 text-ink-2">
        <svg width="14" height="6" aria-hidden="true">
          <line x1="0" x2="14" y1="3" y2="3" stroke={color} strokeWidth="2" strokeDasharray={dashed ? "3 2" : undefined} />
        </svg>
        {label}
      </span>
      <span className="num font-medium text-ink">{value}</span>
    </div>
  );
}
