import { useRef } from "react";
import { Link } from "react-router-dom";
import { useReveal } from "../hooks/useReveal";

const AUDIENCE = [
  ["First-time investors", "Their broker app shows profit and loss — but not whether they beat the index, how risky the ride was, or which stock did the work."],
  ["Students & finance learners", "Real Indian market data with every formula explained and tested. A hands-on way to learn CAGR, Sharpe, drawdown and beta."],
  ["Advisors & small funds", "Clear, shareable performance reports for clients, measured against a benchmark with documented methodology."],
];

const DIFFERENTIATORS = [
  ["India-first", "Every NSE and BSE listed company, rupee formatting, Indian indices as benchmarks."],
  ["Honest by design", "Every data adjustment is disclosed and every formula is documented and tested. No black boxes, no predictions."],
  ["No sign-up wall", "Analyze a portfolio, follow a watchlist and share results without creating an account."],
  ["Live", "Prices refresh every minute during market hours, and every metric recalculates with them."],
];

const MODEL = [
  ["Free", "Portfolio analytics, market directory, live prices, watchlist, shareable reports.", "Grows the user base"],
  ["Pro (subscription)", "Broker and CAS statement import, price and drawdown alerts, unlimited saved portfolios, tax-ready capital-gains reports.", "Main revenue"],
  ["Teams / B2B", "White-labelled client reports for advisors; classroom licences for colleges.", "Higher-value contracts"],
];

const ROADMAP = [
  ["Built", ["Portfolio analytics with tested maths", "Every NSE & BSE company, searchable", "Live prices and auto-updating dashboard", "Stock pages, watchlist, shareable links, CSV export"]],
  ["Next", ["Import holdings from a broker (e.g. Kite Connect) or a CDSL/NSDL CAS statement", "XIRR on actual buy/sell dates", "Price and drawdown alerts", "Accounts with cloud-synced portfolios"]],
  ["Later", ["Mutual funds and ETFs", "Tax P&L (STCG/LTCG) reports", "Mobile app", "Advisor dashboard for multiple clients"]],
] as const;

export function AboutPage() {
  const root = useRef<HTMLDivElement>(null);
  useReveal(root);
  return (
    <div ref={root} className="pb-28 pt-14">
      <header className="page pb-20 pt-16 sm:pt-24" data-reveal>
        <p className="eyebrow mb-5">About Folio</p>
        <h1 className="max-w-5xl text-headline font-semibold">
          Portfolio intelligence for <span className="font-serif font-normal italic">every Indian investor.</span>
        </h1>
        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-2">
          Investing in Indian equities has never been easier to start. Understanding how your investments have actually
          performed is still surprisingly hard. Folio closes that gap.
        </p>
      </header>

      <section className="border-t border-line bg-night py-24 text-night-text sm:py-32">
        <div className="page grid gap-14 md:grid-cols-2">
          <div data-reveal>
            <p className="eyebrow mb-5 !text-night-mute">The problem</p>
            <h2 className="text-title font-semibold">Investors see profit and loss. They don't see performance.</h2>
          </div>
          <div className="space-y-5 text-lg leading-relaxed text-night-mute" data-reveal data-reveal-delay="0.1">
            <p>
              A portfolio that is up 20% sounds good — until you learn the index rose 45% over the same period, with half the
              volatility. Broker apps rarely show that comparison, and spreadsheets require skills most people don't have.
            </p>
            <p>
              Professional tools that do show risk-adjusted performance are built for institutions: expensive, complex, and not
              designed around Indian markets.
            </p>
          </div>
        </div>
      </section>

      <section className="page py-24 sm:py-32">
        <div className="mb-12 max-w-3xl" data-reveal>
          <p className="eyebrow mb-5">The solution</p>
          <h2 className="text-title font-semibold">One place to explore the market and measure your portfolio against it.</h2>
        </div>
        <div className="grid gap-px border-y border-line bg-line sm:grid-cols-2 lg:grid-cols-4" data-reveal>
          {DIFFERENTIATORS.map(([t, d]) => (
            <div key={t} className="bg-paper px-1 py-8 sm:px-7">
              <h3 className="text-[17px] font-semibold">{t}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-paper-2/60 py-24 sm:py-32">
        <div className="page">
          <div className="mb-12 max-w-3xl" data-reveal>
            <p className="eyebrow mb-5">Who it's for</p>
            <h2 className="text-title font-semibold">Three audiences, one engine.</h2>
          </div>
          <div className="grid gap-10 md:grid-cols-3" data-reveal>
            {AUDIENCE.map(([t, d], i) => (
              <div key={t} className="border-t border-ink/80 pt-6">
                <p className="num mb-4 text-[12px] text-ink-mute">0{i + 1}</p>
                <h3 className="text-[19px] font-semibold">{t}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="page py-24 sm:py-32">
        <div className="mb-12 max-w-3xl" data-reveal>
          <p className="eyebrow mb-5">Business model · proposed</p>
          <h2 className="text-title font-semibold">Free to start. Paid for the features that save real time.</h2>
        </div>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" data-reveal>
          <table className="w-full min-w-[640px] border-collapse text-left text-[15px]">
            <thead>
              <tr className="border-b border-ink/80 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                <th className="pb-3 pr-6">Tier</th>
                <th className="pb-3 pr-6">What's included</th>
                <th className="pb-3">Role</th>
              </tr>
            </thead>
            <tbody>
              {MODEL.map(([tier, what, role]) => (
                <tr key={tier} className="border-b border-line align-top">
                  <td className="py-5 pr-6 font-semibold">{tier}</td>
                  <td className="py-5 pr-6 text-ink-2">{what}</td>
                  <td className="py-5 text-ink-3">{role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-t border-line py-24 sm:py-32">
        <div className="page">
          <div className="mb-12 max-w-3xl" data-reveal>
            <p className="eyebrow mb-5">Roadmap</p>
            <h2 className="text-title font-semibold">What exists today, and where it goes next.</h2>
          </div>
          <div className="grid gap-10 md:grid-cols-3" data-reveal>
            {ROADMAP.map(([stage, items]) => (
              <div key={stage}>
                <p className="mb-4 flex items-center gap-2 text-[13px] font-semibold">
                  <span className={`h-2 w-2 rounded-full ${stage === "Built" ? "bg-gain" : stage === "Next" ? "bg-accent" : "bg-ink-mute"}`} aria-hidden="true" />
                  {stage}
                </p>
                <ul className="space-y-3 border-t border-line pt-4 text-[15px] text-ink-2">
                  {items.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="page" data-reveal>
        <div className="rounded-xl bg-ink px-8 py-14 text-paper sm:px-14">
          <h2 className="max-w-2xl text-title font-semibold">See it with your own portfolio.</h2>
          <p className="mt-4 max-w-xl text-night-mute">Takes under a minute. No account, no email.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/analyze" className="inline-flex items-center gap-2 rounded-full bg-paper px-6 py-3 text-[15px] font-medium text-ink transition-colors hover:bg-white">
              Analyze a portfolio <span aria-hidden="true">→</span>
            </Link>
            <Link to="/markets" className="inline-flex items-center rounded-full px-5 py-3 text-[15px] text-paper/80 transition-colors hover:text-paper">
              Explore markets ›
            </Link>
          </div>
        </div>
        <p className="mt-8 text-[12px] leading-relaxed text-ink-3">
          Folio provides descriptive analytics of historical and current market data for information and education. It is not
          registered with SEBI as an investment adviser and does not provide investment advice or recommendations.
        </p>
      </section>
    </div>
  );
}
