/**
 * Single place where GSAP plugins are registered, plus motion helpers.
 * Every scroll animation goes through `gsap.matchMedia()` with MOTION_OK so
 * users who prefer reduced motion get the final state immediately.
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export const MOTION_OK = "(prefers-reduced-motion: no-preference)";
/** Heavier effects (pinning, parallax) only on larger screens. */
export const DESKTOP_MOTION = "(prefers-reduced-motion: no-preference) and (min-width: 900px)";

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export { gsap, ScrollTrigger, useGSAP };
