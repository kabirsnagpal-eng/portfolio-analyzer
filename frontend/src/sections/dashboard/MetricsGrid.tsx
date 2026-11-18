import { AnimatedNumber } from "../../components/AnimatedNumber";
import { InfoTip } from "../../components/InfoTip";
import { formatPercent, formatRatio } from "../../lib/format";
import type { AnalyzeResponse, MetricSet } from "../../types/api";

interface MetricDef {
  key: keyof MetricSet;
  label: string;
  format: (v: number) => string;
  explain: (rf: number) => string;
  /** Whether a higher value is "better" — used only for the comparison glyph's wording. */
  higherIsBetter?: boolean;
}

const METRICS: MetricDef[] = [
  {
    key: "cagr",
    label: "CAGR",
    format: (v) => formatPercent(v, 2, true),
    explain: () => "Compound annual growth rate: the constant yearly return that would turn the starting value into the ending value over the same number of years.",
    higherIsBetter: true,
  },
  {
    key: "annualized_volatility",
    label: "Annualised volatility",
    format: (v) => formatPercent(v, 2),
    explain: () => "Standard deviation of daily returns × √252. A measure of how widely returns swung around their average; higher means a bumpier ride.",
  },
  {
    key: "sharpe_ratio",
    label: "Sharpe ratio",
    format: (v) => formatRatio(v),
    explain: (rf) => `(CAGR − risk-free rate) ÷ annualised volatility, using a risk-free rate of ${formatPercent(rf, 2)}. Return earned per unit of volatility above a riskless alternative.`,
    higherIsBetter: true,
  },
  {
    key: "max_drawdown",
    label: "Maximum drawdown",
    format: (v) => formatPercent(v, 2),
    explain: () => "The largest fall from a previous peak to a later low, as a percentage of the peak. Shows the worst loss an investor who bought at the top would have sat through.",
    higherIsBetter: true,
  },
  {
    key: "beta",
    label: "Beta",
    format: (v) => formatRatio(v),
    explain: () => "Covariance of portfolio and benchmark daily returns ÷ variance of benchmark returns. 1.0 moves with the market; above 1 amplifies its moves; below 1 dampens them.",
  },
  {
    key: "total_return",
    label: "Total return",
    format: (v) => formatPercent(v, 2, true),
    explain: () => "Ending value ÷ starting value − 1, over the whole period, with daily rebalancing to target weights.",
    higherIsBetter: true,
  },
];

export function MetricsGrid({ data }: { data: AnalyzeResponse }) {
  const bench = data.meta.benchmark_name ?? data.meta.benchmark;
  return (
    <div>
      {/* gap-px over a hairline-coloured background draws the dividers without per-cell border logic */}
      <div className="grid gap-px border-y border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {METRICS.map((m, i) => {
          const pv = data.portfolio[m.key];
          const bv = data.benchmark[m.key];
          return (
            <div key={m.key} className="relative bg-paper px-1 py-9 transition-colors duration-300 hover:bg-paper-2/60 sm:px-8">
              <div className="mb-5 flex items-center gap-2">
                <h4 className="text-[13px] font-medium text-ink-2">{m.label}</h4>
                <InfoTip label={m.label} align={i % 3 === 2 ? "right" : "left"}>
                  {m.explain(data.meta.risk_free_rate)}
                </InfoTip>
              </div>
              <p className="text-[clamp(2.25rem,4vw,3.25rem)] font-semibold leading-none tracking-[-0.03em]">
                {pv === null ? (
                  <span className="text-2xl text-ink-3">Not defined</span>
                ) : (
                  <AnimatedNumber value={pv} format={m.format} className="num" />
                )}
              </p>
              <p className="mt-4 text-[13px] text-ink-3">
                {bench}: <span className="num font-medium text-ink-2">{bv === null ? "Not defined" : m.format(bv)}</span>
              </p>
              {pv === null && m.key === "sharpe_ratio" && (
                <p className="mt-2 text-[12px] text-ink-3">Volatility is zero, so the ratio is undefined.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
