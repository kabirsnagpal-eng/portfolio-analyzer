import { useRef, useState } from "react";
import { MOTION_OK, ScrollTrigger, gsap, useGSAP } from "../lib/gsap";

const STEPS = [
  {
    title: "Compose",
    lead: "Enter your holdings and target weights.",
    body: "Any NSE stock with a .NS suffix, BSE with .BO, or international symbols like AAPL. Choose a period, a benchmark index and a starting amount.",
  },
  {
    title: "Measure",
    lead: "Real adjusted prices, aligned day by day.",
    body: "Daily split- and dividend-adjusted closes are fetched from Yahoo Finance, aligned across exchanges, and checked for gaps. Short gaps are filled and disclosed; long ones are never papered over.",
  },
  {
    title: "Compare",
    lead: "Your portfolio against the market, rebased to 100.",
    body: "Both are compounded from the same starting value so every point on the chart is a like-for-like comparison of growth.",
  },
  {
    title: "Understand",
    lead: "Return, risk, and where it came from.",
    body: "CAGR, volatility, Sharpe ratio, maximum drawdown and beta, plus a holding-by-holding breakdown and plain-language observations. Descriptive, never predictive.",
  },
];

function StepVisual({ index }: { index: number }) {
  // Abstract, unlabelled illustrations — not data.
  const stroke = "rgba(242,241,236,0.85)";
  return (
    <svg viewBox="0 0 320 160" className="h-auto w-full" aria-hidden="true" fill="none">
      {index === 0 &&
        [0.4, 0.3, 0.3].map((w, i) => (
          <g key={i}>
            <rect x="0" y={20 + i * 44} width="320" height="22" rx="3" fill="rgba(242,241,236,0.06)" />
            <rect x="0" y={20 + i * 44} width={320 * w * 2} height="22" rx="3" fill={i === 0 ? "#3987e5" : "rgba(242,241,236,0.28)"} />
          </g>
        ))}
      {index === 1 && (
        <>
          {Array.from({ length: 24 }, (_, i) => {
            const h = 30 + ((i * 37) % 70);
            return <rect key={i} x={i * 13.3} y={140 - h} width="7" height={h} rx="2" fill={i === 15 ? "#3987e5" : "rgba(242,241,236,0.22)"} />;
          })}
        </>
      )}
      {index === 2 && (
        <>
          <path d="M0 120 C 60 110, 90 70, 140 80 S 220 40, 320 20" stroke="#3987e5" strokeWidth="2" />
          <path d="M0 120 C 70 115, 110 100, 160 95 S 240 80, 320 70" stroke={stroke} strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="4 4" />
          <line x1="0" x2="320" y1="120" y2="120" stroke="rgba(242,241,236,0.15)" />
        </>
      )}
      {index === 3 && (
        <>
          <path d="M0 20 L60 20 L90 26 L130 70 L170 62 L210 40 L260 30 L320 22" stroke={stroke} strokeOpacity="0.5" strokeWidth="1.5" />
          <path d="M0 20 L60 20 L90 26 L130 70 L170 62 L210 40 L260 30 L320 22 L320 20 L0 20Z" fill="rgba(57,135,229,0.25)" />
          {[0, 1, 2].map((i) => (
            <rect key={i} x="0" y={100 + i * 18} width={[300, 240, 180][i]} height="6" rx="3" fill="rgba(242,241,236,0.18)" />
          ))}
        </>
      )}
    </svg>
  );
}

/**
 * Dark, immersive section. On desktop the left column is sticky and its
 * numeral/visual switch as each step's text scrolls past on the right.
 */
export function HowItWorks() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  useGSAP(
    () => {
      const panels = gsap.utils.toArray<HTMLElement>(".hiw-step");
      const triggers = panels.map((panel, i) =>
        ScrollTrigger.create({
          trigger: panel,
          start: "top 55%",
          end: "bottom 55%",
          onToggle: (self) => self.isActive && setActive(i),
        }),
      );
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from(".hiw-head", {
          autoAlpha: 0,
          y: 40,
          duration: 1.1,
          ease: "power3.out",
          scrollTrigger: { trigger: root.current, start: "top 70%", once: true },
        });
        panels.forEach((p) =>
          gsap.fromTo(
            p,
            { opacity: 0.25 },
            { opacity: 1, ease: "none", scrollTrigger: { trigger: p, start: "top 80%", end: "top 50%", scrub: true } },
          ),
        );
      });
      return () => {
        triggers.forEach((t) => t.kill());
        mm.revert();
      };
    },
    { scope: root },
  );

  return (
    <section ref={root} id="how" className="relative bg-night text-night-text">
      <div className="page py-28 sm:py-40">
        <div className="hiw-head mb-20 max-w-3xl sm:mb-28">
          <p className="eyebrow mb-6 !text-night-mute">How it works</p>
          <h2 className="text-headline font-semibold">
            Four steps from holdings to <span className="font-serif font-normal italic">insight.</span>
          </h2>
        </div>

        <div className="grid gap-16 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-24">
          {/* Sticky visual column (desktop) */}
          <div className="hidden md:block">
            <div className="sticky top-[22vh]">
              <div className="relative h-[9rem] overflow-hidden">
                {STEPS.map((s, i) => (
                  <div
                    key={s.title}
                    className="absolute inset-0 flex items-baseline gap-5 transition-all duration-700 ease-out"
                    style={{ transform: `translateY(${(i - active) * 100}%)`, opacity: i === active ? 1 : 0 }}
                    aria-hidden={i !== active}
                  >
                    <span className="font-serif text-[8rem] leading-none text-night-text/90">0{i + 1}</span>
                    <span className="text-2xl font-medium text-night-mute">{s.title}</span>
                  </div>
                ))}
              </div>
              <div className="mt-10 rounded-xl border border-white/10 bg-night-2 p-8">
                <div className="relative aspect-[2/1]">
                  {STEPS.map((s, i) => (
                    <div
                      key={s.title}
                      className="absolute inset-0 transition-all duration-700 ease-out"
                      style={{ opacity: i === active ? 1 : 0, transform: `scale(${i === active ? 1 : 0.97})` }}
                    >
                      <StepVisual index={i} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-6 flex gap-2" aria-hidden="true">
                {STEPS.map((s, i) => (
                  <span key={s.title} className={`h-[2px] flex-1 rounded transition-colors duration-500 ${i <= active ? "bg-night-text" : "bg-white/15"}`} />
                ))}
              </div>
            </div>
          </div>

          {/* Scrolling text column */}
          <ol className="space-y-24 md:space-y-[38vh] md:pb-[20vh] md:pt-[4vh]">
            {STEPS.map((s, i) => (
              <li key={s.title} className="hiw-step">
                <p className="mb-4 font-serif text-2xl italic text-night-mute md:hidden">0{i + 1}</p>
                <h3 className="text-title font-semibold">{s.lead}</h3>
                <p className="mt-5 max-w-lg text-lg leading-relaxed text-night-mute">{s.body}</p>
                <div className="mt-8 rounded-xl border border-white/10 bg-night-2 p-6 md:hidden">
                  <StepVisual index={i} />
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
