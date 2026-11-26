import { useRef } from "react";
import { Link } from "react-router-dom";
import { useReveal } from "../hooks/useReveal";
import { Hero } from "../sections/Hero";
import { HowItWorks } from "../sections/HowItWorks";
import { Statement } from "../sections/Statement";

const FEATURES = [
  {
    to: "/markets",
    title: "Every listed company",
    body: "Browse and search all 4,800+ companies listed on NSE and BSE, with live prices and the day's biggest movers.",
    cta: "Explore markets",
  },
  {
    to: "/analyze",
    title: "Portfolio analytics",
    body: "CAGR, volatility, Sharpe ratio, drawdowns and beta against the index — from weights or the shares you actually own.",
    cta: "Analyze a portfolio",
  },
  {
    to: "/watchlist",
    title: "Your watchlist",
    body: "Star any stock and follow it on one screen. Saved on your device — no account, no sign-up.",
    cta: "Open watchlist",
  },
  {
    to: "/methodology",
    title: "Transparent maths",
    body: "Every formula documented and tested. Every data adjustment disclosed. Nothing is a black box.",
    cta: "Read the methodology",
  },
];

export function HomePage() {
  const root = useRef<HTMLElement>(null);
  useReveal(root);
  return (
    <>
      <Hero />
      <Statement />
      <HowItWorks />
      <section ref={root} className="py-28 sm:py-36">
        <div className="page">
          <div className="mb-14 max-w-3xl" data-reveal>
            <p className="eyebrow mb-5">One platform</p>
            <h2 className="text-headline font-semibold">
              From the whole market to <span className="font-serif font-normal italic">your portfolio.</span>
            </h2>
          </div>
          <div className="grid gap-px border-y border-line bg-line sm:grid-cols-2" data-reveal data-reveal-delay="0.08">
            {FEATURES.map((f, i) => (
              <Link key={f.to} to={f.to} className="group bg-paper px-1 py-10 transition-colors hover:bg-paper-2/60 sm:px-10">
                <p className="num mb-6 text-[12px] text-ink-mute">0{i + 1}</p>
                <h3 className="text-title font-semibold">{f.title}</h3>
                <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-2">{f.body}</p>
                <span className="link-arrow mt-6 text-[15px] group-hover:gap-2">
                  {f.cta} <span aria-hidden="true">›</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
