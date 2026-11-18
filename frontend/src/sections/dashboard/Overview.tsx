import { AnimatedNumber } from "../../components/AnimatedNumber";
import { formatCurrency, formatDate, formatPercent, toneOf } from "../../lib/format";
import type { AnalyzeResponse } from "../../types/api";

const toneClass = { gain: "text-gain", loss: "text-loss", flat: "text-ink" } as const;

export function Overview({ data }: { data: AnalyzeResponse }) {
  const { summary, meta, benchmark } = data;
  const tone = toneOf(summary.profit_loss);
  const relative = summary.total_return - benchmark.total_return;
  const benchLabel = meta.benchmark_name ?? meta.benchmark;

  return (
    <div className="pb-20 pt-6 sm:pb-28">
      <div data-reveal>
        <p className="eyebrow mb-6">
          <span className="num mr-3 text-ink-mute">01</span>Overview
        </p>
        <p className="mb-3 text-[15px] text-ink-3">Ending portfolio value</p>
        <AnimatedNumber
          value={summary.ending_value}
          format={formatCurrency}
          duration={1800}
          className="num block text-[clamp(3rem,10vw,8.5rem)] font-semibold leading-[0.9] tracking-[-0.045em]"
        />
        <p className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xl sm:text-2xl">
          <span className={`num font-semibold ${toneClass[tone]}`}>
            <span aria-hidden="true">{tone === "gain" ? "▲ " : tone === "loss" ? "▼ " : ""}</span>
            {tone === "loss" ? "−" : tone === "gain" ? "+" : ""}
            {formatCurrency(Math.abs(summary.profit_loss))}
          </span>
          <span className="text-ink-3">
            {tone === "loss" ? "loss" : "gain"} on {formatCurrency(summary.initial_value)} invested
          </span>
        </p>
      </div>

      <dl
        data-reveal
        data-reveal-delay="0.1"
        className="mt-16 grid grid-cols-2 gap-x-6 gap-y-10 border-t border-line pt-10 sm:grid-cols-3 lg:grid-cols-6"
      >
        <Stat label="Initial investment" value={formatCurrency(summary.initial_value)} />
        <Stat label="Total return">
          <AnimatedNumber value={summary.total_return} format={(v) => formatPercent(v, 2, true)} className="num" />
        </Stat>
        <Stat label="CAGR">
          <AnimatedNumber value={summary.cagr} format={(v) => formatPercent(v, 2, true)} className="num" />
        </Stat>
        <Stat label={`vs ${benchLabel}`}>
          <span className={`num ${toneClass[toneOf(relative)]}`}>{formatPercent(relative, 1, true).replace("%", " pp")}</span>
        </Stat>
        <Stat label="Benchmark" value={benchLabel} small={meta.benchmark !== benchLabel ? meta.benchmark : undefined} />
        <Stat
          label="Period"
          value={`${meta.years.toFixed(1)} years`}
          small={`${formatDate(meta.start_date)} – ${formatDate(meta.end_date)}`}
        />
      </dl>
    </div>
  );
}

function Stat({ label, value, small, children }: { label: string; value?: string; small?: string; children?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="mb-2 truncate text-[12px] text-ink-3">{label}</dt>
      <dd className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{children ?? value}</dd>
      {small && <dd className="num mt-1 truncate text-[12px] text-ink-3">{small}</dd>}
    </div>
  );
}
