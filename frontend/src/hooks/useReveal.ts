import type { RefObject } from "react";
import { MOTION_OK, ScrollTrigger, gsap, useGSAP } from "../lib/gsap";

/**
 * Fade-and-rise every `[data-reveal]` element inside `scope` as it scrolls into view.
 * Optional `data-reveal-delay="0.1"` staggers siblings. With reduced motion,
 * nothing is hidden in the first place.
 */
export function useReveal(scope: RefObject<HTMLElement>, deps: unknown[] = []) {
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const items = gsap.utils.toArray<HTMLElement>("[data-reveal]", scope.current);
        items.forEach((el) => {
          gsap.fromTo(
            el,
            { autoAlpha: 0, y: 28 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 1.0,
              ease: "power3.out",
              delay: Number(el.dataset.revealDelay ?? 0),
              scrollTrigger: { trigger: el, start: "top 88%", once: true },
            },
          );
        });
        ScrollTrigger.refresh();
      });
      return () => mm.revert();
    },
    { scope, dependencies: deps, revertOnUpdate: true },
  );
}
