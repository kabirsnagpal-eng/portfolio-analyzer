import { useCallback, useState } from "react";
import { Nav } from "./components/Nav";
import { useAnalysis } from "./hooks/useAnalysis";
import { useLiveRefresh } from "./hooks/useLiveRefresh";
import { ScrollTrigger, prefersReducedMotion } from "./lib/gsap";
import { Configurator } from "./sections/Configurator";
import { Dashboard } from "./sections/dashboard/Dashboard";
import { Hero } from "./sections/Hero";
import { HowItWorks } from "./sections/HowItWorks";
import { Footer, Methodology } from "./sections/Methodology";
import { Statement } from "./sections/Statement";
import type { AnalyzeRequest } from "./types/api";

export default function App() {
  const { state, run, refresh } = useAnalysis();

  const analyze = useCallback(
    (req: AnalyzeRequest) => {
      run(req).then(() => requestAnimationFrame(() => ScrollTrigger.refresh()));
      // Bring the results area into view while the analysis runs (after React has rendered the loading state).
      window.setTimeout(() => {
        const el = document.getElementById("results");
        if (!el) return;
        const top = el.getBoundingClientRect().top + window.scrollY - 56;
        window.scrollTo({ top, behavior: prefersReducedMotion() ? "auto" : "smooth" });
      }, 60);
    },
    [run],
  );

  const retry = useCallback(() => {
    if (state.status === "error") analyze(state.request);
  }, [state, analyze]);

  // Live mode: re-run the same analysis on a timer so every number tracks the latest price.
  const [liveEnabled, setLiveEnabled] = useState(true);
  const refreshCurrent = useCallback((s: { request: AnalyzeRequest }) => refresh(s.request), [refresh]);
  useLiveRefresh(state, liveEnabled, refreshCurrent);
  const refreshNow = useCallback(() => {
    if (state.status === "success") refresh(state.request);
  }, [state, refresh]);

  return (
    <>
      <a href="#analyze" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded focus:bg-ink focus:px-4 focus:py-2 focus:text-paper">
        Skip to portfolio builder
      </a>
      <Nav hasResults={state.status === "success"} />
      <main>
        <Hero />
        <Statement />
        <HowItWorks />
        <Configurator onAnalyze={analyze} busy={state.status === "loading"} />
        <Dashboard
          state={state}
          onRetry={retry}
          liveEnabled={liveEnabled}
          onToggleLive={() => setLiveEnabled((v) => !v)}
          onRefreshNow={refreshNow}
        />
        <Methodology />
      </main>
      <Footer />
    </>
  );
}
