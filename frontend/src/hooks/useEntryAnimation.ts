import { useEffect, useState } from "react";
import { prefersReducedMotion } from "../lib/gsap";

/**
 * True only for a chart's first appearance. Once `active` (usually "in view")
 * has been true for `windowMs`, it returns false, so later data updates —
 * such as live price refreshes — change the chart in place instead of
 * replaying the draw-in animation every minute.
 */
export function useEntryAnimation(active: boolean, windowMs = 2500): boolean {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!active || done) return;
    const id = window.setTimeout(() => setDone(true), windowMs);
    return () => window.clearTimeout(id);
  }, [active, done, windowMs]);
  return !done && !prefersReducedMotion();
}
