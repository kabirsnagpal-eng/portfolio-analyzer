import { useRef } from "react";
import { useReveal } from "../hooks/useReveal";

const FORMULAS = [
  { name: "Daily return", formula: "rₜ = Pₜ ÷ Pₜ₋₁ − 1", note: "Simple return on split- and dividend-adjusted closing prices." },
  { name: "Portfolio return", formula: "Rₚ,ₜ = Σ wᵢ · rᵢ,ₜ", note: "Target weights applied every day — equivalent to daily rebalancing." },
  { name: "Total return", formula: "V_end ÷ V_start − 1", note: "Values compound: Vₜ = Vₜ₋₁ · (1 + Rₚ,ₜ)." },
  { name: "CAGR", formula: "(V_end ÷ V_start)^(1/years) − 1", note: "Years measured in calendar days ÷ 365.25." },
  { name: "Volatility", formula: "σ_daily · √252", note: "Sample standard deviation of daily returns, annualised over 252 trading days." },
  { name: "Sharpe ratio", formula: "(CAGR − r_f) ÷ σ_annual", note: "Risk-free rate is your input (default 6.5%). Undefined when σ = 0." },
  { name: "Maximum drawdown", formula: "min( Vₜ ÷ max(V₀…Vₜ) − 1 )", note: "Largest decline from a running peak, reported as a negative percentage." },
  { name: "Beta", formula: "Cov(Rₚ, R_b) ÷ Var(R_b)", note: "On date-aligned daily returns of portfolio and benchmark." },
  { name: "Contribution", formula: "wᵢ · TRᵢ", note: "Initial weight × holding total return, in percentage points. Not an exact decomposition." },
];

const ASSUMPTIONS = [
  ["Daily rebalancing", "Weights are reset to target every day. Real portfolios drift between rebalances and incur costs doing so."],
  ["No costs or taxes", "Brokerage, STT, stamp duty, slippage and capital-gains tax are ignored, so results overstate what an investor would keep."],
  ["Adjusted prices", "Yahoo Finance adjusts history for splits and dividends; dividends are effectively reinvested. Adjustments can be revised."],
  ["Local currency", "Each security's return is in its own trading currency. Mixing exchanges adds no FX conversion."],
  ["Survivorship", "You choose today's names with hindsight; companies that failed or were delisted are naturally absent."],
  ["History is not a forecast", "Every number describes a past window. A different window can tell a very different story."],
];

export function Methodology() {
  const root = useRef<HTMLElement>(null);
  useReveal(root);
  return (
    <section ref={root} id="method" className="scroll-mt-14 border-t border-line bg-paper-2/60 py-28 sm:py-36">
      <div className="page">
        <div className="mb-16 max-w-3xl" data-reveal>
          <p className="eyebrow mb-5">Methodology</p>
          <h2 className="text-headline font-semibold">
            Every number, <span className="font-serif font-normal italic">accounted for.</span>
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-ink-2">
            Calculations run in a tested Python engine, independent of this interface. Each formula below is implemented
            as its own function and verified against hand-computed examples.
          </p>
        </div>

        <dl className="grid gap-px border-y border-line bg-line sm:grid-cols-2 lg:grid-cols-3" data-reveal>
          {FORMULAS.map((f) => (
            <div key={f.name} className="bg-paper-2 px-1 py-8 sm:px-7">
              <dt className="mb-3 text-[13px] font-medium text-ink-3">{f.name}</dt>
              <dd className="font-serif text-[1.65rem] leading-tight">{f.formula}</dd>
              <dd className="mt-3 text-[14px] leading-relaxed text-ink-3">{f.note}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-24 grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div data-reveal>
            <h3 className="text-title font-semibold">Assumptions &amp; limits</h3>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-3">
              Read these before drawing conclusions. They matter more than any single metric.
            </p>
          </div>
          <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2" data-reveal data-reveal-delay="0.1">
            {ASSUMPTIONS.map(([t, d]) => (
              <div key={t} className="border-t border-line pt-5">
                <dt className="font-semibold">{t}</dt>
                <dd className="mt-2 text-[15px] leading-relaxed text-ink-2">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="bg-night py-16 text-night-mute">
      <div className="page grid gap-10 text-[13px] leading-relaxed md:grid-cols-[1fr_2fr]">
        <div>
          <p className="text-[15px] font-semibold text-night-text">Folio</p>
          <p className="mt-2">Portfolio analytics, measured honestly.</p>
        </div>
        <div className="space-y-3">
          <p>
            <span className="font-medium text-night-text">Not investment advice.</span> Folio provides descriptive analysis of
            historical prices for educational purposes. It does not recommend buying or selling any security. Past
            performance does not guarantee future results.
          </p>
          <p>Market data from Yahoo Finance via the open-source yfinance library; it may be delayed, revised or incomplete.</p>
        </div>
      </div>
    </footer>
  );
}
