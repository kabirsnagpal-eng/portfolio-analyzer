import { useRef } from "react";
import { MOTION_OK, gsap, useGSAP } from "../lib/gsap";

const TEXT =
  "Most investors know what they own. Far fewer know how it has actually performed — against the market, through the drawdowns, after accounting for risk.";
const EMPHASIS = new Set(["performed", "against", "market,", "drawdowns,", "risk."]);

/** Large editorial statement whose words brighten progressively as you scroll through it. */
export function Statement() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.fromTo(
          ".st-word",
          { opacity: 0.14 },
          {
            opacity: 1,
            stagger: 0.08,
            ease: "none",
            scrollTrigger: { trigger: ".st-text", start: "top 80%", end: "bottom 45%", scrub: 0.6 },
          },
        );
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} id="statement" className="py-32 sm:py-44">
      <div className="page">
        <p className="eyebrow mb-8">Why this exists</p>
        <p className="st-text max-w-5xl text-statement font-medium">
          {TEXT.split(" ").map((w, i) => (
            <span key={i} className={`st-word ${EMPHASIS.has(w) ? "font-serif italic font-normal" : ""}`}>
              {w}{" "}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
