import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipProps } from "recharts";
import { useEntryAnimation } from "../hooks/useEntryAnimation";
import { useInView } from "../hooks/useInView";
import { formatPrice } from "../lib/format";
import { exchangeTime } from "../sections/dashboard/LivePanel";
import type { StockHistory } from "../types/markets";
import { CHART, TICK_STYLE, dateTicks } from "./theme";

interface Props {
  history: StockHistory;
  previousClose?: number | null;
  currencySymbol: string;
}

interface Row {
  t: string; // ISO with exchange offset
  day: string; // YYYY-MM-DD in exchange time
  p: number;
}

const longDay = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso.slice(0, 10)}T00:00:00Z`),
  );

/** Price chart for a single stock. Intraday ranges label times; longer ranges label dates. */
export function StockChart({ history, previousClose, currencySymbol }: Props) {
  const [ref, inView] = useInView<HTMLDivElement>(0.2);
  const animate = useEntryAnimation(inView);
  const rows: Row[] = useMemo(() => history.points.map((x) => ({ t: x.t, day: x.t.slice(0, 10), p: x.p })), [history]);
  const intraday = history.intraday;
  const xTicks = useMemo(() => {
    if (!intraday) return dateTicks(rows.map((r) => r.t.slice(0, 10)));
    // intraday: one tick per hour (1D) or per day (5D)
    const multiDay = new Set(rows.map((r) => r.day)).size > 1;
    const seen = new Set<string>();
    const ticks = rows
      .filter((r) => {
        const key = multiDay ? r.day : r.t.slice(11, 13);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((r) => r.t);
    return {
      ticks,
      format: (t: string) =>
        multiDay
          ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${t.slice(0, 10)}T00:00:00Z`))
          : t.slice(11, 16),
    };
  }, [rows, intraday]);

  if (!rows.length) {
    return <div className="grid h-[320px] place-items-center text-[14px] text-ink-3">No price history available for this range.</div>;
  }
  const first = rows[0].p;
  const last = rows[rows.length - 1].p;
  const base = history.range === "1d" && previousClose ? previousClose : first;
  const up = last >= base;
  const color = up ? "#0b6e3a" : "#b63a2b";

  return (
    <div ref={ref} className="h-[320px] sm:h-[400px]" role="img" aria-label={`Price chart, ${history.range} range.`}>
      {inView && (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="stockFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis
              dataKey="t"
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
              width={60}
              orientation="right"
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => formatPrice(v).replace(/\.00$/, "")}
            />
            {history.range === "1d" && previousClose && (
              <ReferenceLine y={previousClose} stroke={CHART.axis} strokeDasharray="3 4" label={{ value: "Prev close", position: "insideTopLeft", fill: CHART.tick, fontSize: 11 }} />
            )}
            <Tooltip
              content={<StockTooltip intraday={intraday} sym={currencySymbol} base={base} />}
              cursor={{ stroke: CHART.ink, strokeOpacity: 0.25 }}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="p"
              stroke={color}
              strokeWidth={2}
              fill="url(#stockFill)"
              dot={false}
              activeDot={{ r: 4, fill: color, stroke: CHART.surface, strokeWidth: 2 }}
              isAnimationActive={animate}
              animationDuration={1200}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function StockTooltip({ active, payload, intraday, sym, base }: TooltipProps<number, string> & { intraday: boolean; sym: string; base: number }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as Row;
  const pct = base ? row.p / base - 1 : 0;
  return (
    <div className="rounded-lg border border-line bg-white/95 px-3.5 py-2.5 text-[13px] shadow-[0_12px_32px_-12px_rgba(0,0,0,0.25)]">
      <p className="text-ink-3">{intraday ? `${longDay(row.t)}, ${exchangeTime(row.t)}` : longDay(row.t)}</p>
      <p className="num mt-0.5 text-[15px] font-semibold">
        {sym}
        {formatPrice(row.p)}
      </p>
      <p className={`num text-[12px] ${pct >= 0 ? "text-gain" : "text-loss"}`}>
        {pct >= 0 ? "+" : "−"}
        {Math.abs(pct * 100).toFixed(2)}% vs start of range
      </p>
    </div>
  );
}
