import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { useInView } from "../hooks/useInView";
import { formatPercent } from "../lib/format";
import { prefersReducedMotion } from "../lib/gsap";
import type { HoldingResult } from "../types/api";
import { CATEGORICAL, CHART, OTHER_COLOR } from "./theme";

interface Slice {
  key: string;
  label: string;
  sub: string | null;
  weight: number;
  color: string;
}

/** Slots are assigned by holding order (as entered); beyond eight, the remainder folds into "Other". */
export function toSlices(holdings: HoldingResult[]): Slice[] {
  const max = CATEGORICAL.length;
  const head = holdings.length > max ? holdings.slice(0, max - 1) : holdings;
  const slices: Slice[] = head.map((h, i) => ({ key: h.ticker, label: h.ticker, sub: h.name, weight: h.weight, color: CATEGORICAL[i] }));
  if (holdings.length > max) {
    const rest = holdings.slice(max - 1);
    slices.push({
      key: "__other",
      label: `Other (${rest.length})`,
      sub: rest.map((h) => h.ticker).join(", "),
      weight: rest.reduce((s, h) => s + h.weight, 0),
      color: OTHER_COLOR,
    });
  }
  return slices;
}

export function AllocationDonut({ holdings }: { holdings: HoldingResult[] }) {
  const slices = useMemo(() => toSlices(holdings), [holdings]);
  const [hover, setHover] = useState<number | null>(null);
  const [ref, inView] = useInView<HTMLDivElement>(0.3);
  const focus = hover !== null ? slices[hover] : null;

  return (
    <div ref={ref} className="grid items-center gap-12 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="relative mx-auto aspect-square w-full max-w-[380px]" role="img" aria-label="Donut chart of portfolio allocation by holding.">
        {inView && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="weight"
                nameKey="label"
                innerRadius="68%"
                outerRadius="96%"
                startAngle={90}
                endAngle={-270}
                stroke={CHART.surface}
                strokeWidth={2}
                isAnimationActive={!prefersReducedMotion()}
                animationDuration={1400}
                onMouseEnter={(_, i) => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                {slices.map((s, i) => (
                  <Cell
                    key={s.key}
                    fill={s.color}
                    opacity={hover === null || hover === i ? 1 : 0.35}
                    style={{ transition: "opacity 250ms ease", cursor: "pointer" }}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div className="max-w-[55%]">
            <p className="num text-4xl font-semibold tracking-tight">{focus ? formatPercent(focus.weight, 1) : holdings.length}</p>
            <p className="mt-1 truncate text-[13px] text-ink-3">{focus ? focus.label : holdings.length === 1 ? "holding" : "holdings"}</p>
          </div>
        </div>
      </div>

      <ul className="divide-y divide-line border-y border-line">
        {slices.map((s, i) => (
          <li
            key={s.key}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className={`flex items-center gap-4 py-3.5 transition-opacity duration-200 ${hover === null || hover === i ? "opacity-100" : "opacity-45"}`}
          >
            <span className="h-3 w-3 flex-none rounded-[3px]" style={{ background: s.color }} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium">{s.label}</p>
              {s.sub && <p className="truncate text-[13px] text-ink-3">{s.sub}</p>}
            </div>
            <div className="hidden w-28 sm:block" aria-hidden="true">
              <div className="h-1 rounded-full bg-ink/[0.06]">
                <div className="h-1 rounded-full" style={{ width: `${s.weight * 100}%`, background: s.color }} />
              </div>
            </div>
            <span className="num w-16 text-right text-[15px] font-medium">{formatPercent(s.weight, 1)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
