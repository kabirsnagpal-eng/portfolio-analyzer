import { useRef } from "react";
import { AllocationDonut } from "../../charts/AllocationDonut";
import { DrawdownChart } from "../../charts/DrawdownChart";
import { PerformanceChart } from "../../charts/PerformanceChart";
import type { AnalysisState } from "../../hooks/useAnalysis";
import { useReveal } from "../../hooks/useReveal";
import { formatDate, formatPercent } from "../../lib/format";
import type { AnalyzeResponse } from "../../types/api";
import { DashSection } from "./DashSection";
import { DataQualityNotice } from "./DataQualityNotice";
import { HoldingsTable } from "./HoldingsTable";
import { Insights } from "./Insights";
import { MetricsGrid } from "./MetricsGrid";
import { Overview } from "./Overview";
import { EmptyState, ErrorState, LoadingState } from "./States";

interface Props {
  state: AnalysisState;
  onRetry: () => void;
}

export function Dashboard({ state, onRetry }: Props) {
  return (
    <section id="results" className="scroll-mt-14 border-t border-line bg-paper">
      <div className="page pt-20 sm:pt-28">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-4">Results</p>
            <h2 className="text-headline font-semibold">
              Your portfolio, <span className="font-serif font-normal italic">measured.</span>
            </h2>
          </div>
          {state.status === "success" && <RunSummary data={state.data} />}
        </div>
        {state.status === "idle" && <EmptyState />}
        {state.status === "loading" && <LoadingState />}
        {state.status === "error" && <ErrorState error={state.error} onRetry={onRetry} />}
        {state.status === "success" && <Results key={resultKey(state.data)} data={state.data} />}
      </div>
    </section>
  );
}

const resultKey = (d: AnalyzeResponse) =>
  `${d.meta.start_date}-${d.meta.end_date}-${d.meta.benchmark}-${d.holdings.map((h) => h.ticker + h.weight).join()}-${d.meta.initial_investment}-${d.meta.risk_free_rate}`;

function RunSummary({ data }: { data: AnalyzeResponse }) {
  return (
    <p className="num text-right text-[13px] leading-relaxed text-ink-3">
      {data.holdings.length} holdings · {formatDate(data.meta.start_date)} – {formatDate(data.meta.end_date)}
      <br />
      {data.meta.trading_days.toLocaleString("en-IN")} trading days · rebalanced daily · adjusted closes
    </p>
  );
}

function Results({ data }: { data: AnalyzeResponse }) {
  const root = useRef<HTMLDivElement>(null);
  useReveal(root, [data]);
  const bench = data.meta.benchmark_name ?? data.meta.benchmark;
  const dd = data.drawdown;

  return (
    <div ref={root} className="pt-12">
      <div className="mb-10" data-reveal>
        <DataQualityNotice quality={data.data_quality} />
      </div>

      <Overview data={data} />

      <DashSection
        index="02"
        eyebrow="Performance"
        title={<>Growth of 100, against the {bench}.</>}
        description="Both lines start at 100 and compound daily returns. Hover or tap the chart to inspect any date."
      >
        <PerformanceChart series={data.series} benchmarkLabel={bench} />
      </DashSection>

      <DashSection
        index="03"
        eyebrow="Drawdown"
        title={
          <>
            Deepest fall: <span className="num text-loss">{formatPercent(dd.max_drawdown, 1)}</span>
          </>
        }
        description={
          dd.peak_date && dd.trough_date ? (
            <>
              From a peak on {formatDate(dd.peak_date)} to a low on {formatDate(dd.trough_date)}
              {dd.peak_to_trough_days !== null && <> ({dd.peak_to_trough_days} days)</>}.{" "}
              {dd.recovery_date ? <>Recovered to the prior peak on {formatDate(dd.recovery_date)}.</> : <>Not yet recovered by the end of the period.</>}
            </>
          ) : (
            <>The portfolio never fell below a previous high during this period.</>
          )
        }
      >
        <DrawdownChart series={data.series} drawdown={dd} benchmarkLabel={bench} />
      </DashSection>

      <DashSection
        index="04"
        eyebrow="Risk & return"
        title="Six numbers that summarise the ride."
        description={<>Portfolio figures are large; the {bench} is shown beneath each for comparison. Tap ⓘ for definitions.</>}
      >
        <MetricsGrid data={data} />
      </DashSection>

      <DashSection
        index="05"
        eyebrow="Holdings"
        title="Where the return came from."
        description="Sort any column. Contribution is each holding's initial weight multiplied by its own total return."
      >
        <HoldingsTable holdings={data.holdings} portfolioReturn={data.portfolio.total_return} />
      </DashSection>

      <DashSection index="06" eyebrow="Allocation" title="How the portfolio is divided." description="Target weights, held constant through the period by daily rebalancing.">
        <AllocationDonut holdings={data.holdings} />
      </DashSection>

      <DashSection index="07" eyebrow="Insights" title={<>What the numbers <span className="font-serif font-normal italic">say.</span></>}>
        <Insights insights={data.insights} />
      </DashSection>
    </div>
  );
}
