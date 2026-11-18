import { useRef } from "react";
import { DESKTOP_MOTION, MOTION_OK, gsap, useGSAP } from "../lib/gsap";

const HEADLINE = ["Understand", "your", "portfolio."];

/**
 * Opening section. Entrance: headline words rise out of a mask, then the
 * supporting copy and CTA. Scroll: the hero gently scales back and fades
 * while the decorative curve drifts at a different speed (parallax).
 *
 * The curve is an abstract illustration, deliberately unlabelled; it is not
 * presented as data.
 */
export function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
        tl.from(".hero-word", { yPercent: 110, duration: 1.3, stagger: 0.09 }, 0.15)
          .from(".hero-sub", { autoAlpha: 0, y: 18, duration: 1.0, stagger: 0.08 }, 0.75)
          .from(".hero-curve path", { strokeDashoffset: 1600, duration: 2.6, ease: "power2.inOut" }, 0.2)
          .from(".hero-curve circle", { scale: 0, transformOrigin: "center", autoAlpha: 0, duration: 0.6 }, 2.4);
      });
      mm.add(DESKTOP_MOTION, () => {
        gsap.to(".hero-inner", {
          scale: 0.94,
          autoAlpha: 0.15,
          y: -60,
          ease: "none",
          scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
        });
        gsap.to(".hero-curve", {
          yPercent: 18,
          ease: "none",
          scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} id="top" className="relative flex min-h-[100svh] items-center overflow-hidden pt-14">
      {/* Ambient background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="hero-glow absolute -right-[20%] -top-[30%] h-[80vh] w-[80vh] rounded-full bg-[radial-gradient(closest-side,rgba(42,120,214,0.13),transparent)]" />
        <div className="hero-glow absolute -bottom-[25%] -left-[15%] h-[70vh] w-[70vh] rounded-full bg-[radial-gradient(closest-side,rgba(15,15,15,0.06),transparent)] [animation-delay:-9s]" />
        <svg
          className="hero-curve absolute inset-x-0 bottom-[6%] h-[46%] w-full"
          viewBox="0 0 1440 400"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d="M0 330 C 120 320, 180 280, 260 290 S 400 330, 470 270 S 600 200, 690 230 S 820 300, 900 220 S 1040 120, 1120 150 S 1260 190, 1330 90 L 1440 60"
            stroke="url(#heroStroke)"
            strokeWidth="1.6"
            strokeDasharray="1600"
            strokeDashoffset="0"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx="1330" cy="90" r="4" fill="#2a78d6" />
          <defs>
            <linearGradient id="heroStroke" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#0f0f0f" stopOpacity="0" />
              <stop offset="0.35" stopColor="#0f0f0f" stopOpacity="0.25" />
              <stop offset="1" stopColor="#2a78d6" stopOpacity="0.9" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="hero-inner page relative">
        <p className="hero-sub eyebrow mb-6">Portfolio analytics · NSE &amp; global equities</p>
        <h1 className="font-serif text-display font-normal">
          {HEADLINE.map((w, i) => (
            <span key={w} className="-mb-[0.2em] inline-block overflow-hidden pb-[0.2em] pr-[0.04em] align-bottom">
              <span className={`hero-word inline-block ${i === 2 ? "italic" : ""}`}>{w}</span>
              {i < HEADLINE.length - 1 && <span>&nbsp;</span>}
            </span>
          ))}
        </h1>
        <div className="mt-10 grid gap-10 md:grid-cols-[1fr_auto] md:items-end">
          <p className="hero-sub max-w-xl text-lg leading-relaxed text-ink-2 sm:text-xl">
            Measure how your holdings have really performed — compounded growth, volatility, drawdowns and
            risk-adjusted return — side by side with the market.
          </p>
          <div className="hero-sub flex flex-wrap items-center gap-4">
            <a href="#analyze" className="btn-primary">
              Analyze your portfolio
              <span aria-hidden="true">→</span>
            </a>
            <a href="#how" className="link-arrow text-[15px]">
              How it works <span aria-hidden="true">›</span>
            </a>
          </div>
        </div>
      </div>

      <a
        href="#statement"
        aria-label="Scroll to continue"
        className="hero-sub absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-ink-3 md:flex"
      >
        Scroll
        <span className="block h-8 w-px overflow-hidden bg-ink/10">
          <span className="block h-1/2 w-full animate-[scrollcue_2s_ease-in-out_infinite] bg-ink/50" />
        </span>
      </a>
      <style>{`@keyframes scrollcue{0%{transform:translateY(-100%)}100%{transform:translateY(200%)}}`}</style>
    </section>
  );
}
