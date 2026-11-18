import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../lib/gsap";

/**
 * Animate a number from its previous value to `target` once the element is
 * on screen. Returns [ref, displayedValue]. The final frame is always exactly
 * `target`, so formatting never shows a rounded intermediate as the result.
 */
export function useCountUp<T extends HTMLElement>(target: number, duration = 1400) {
  const ref = useRef<T>(null);
  const [value, setValue] = useState(prefersReducedMotion() ? target : 0);
  const fromRef = useRef(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (prefersReducedMotion() || !Number.isFinite(target)) {
      setValue(target);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4); // easeOutQuart
      setValue(t >= 1 ? target : from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, visible, duration]);

  return [ref, value] as const;
}
