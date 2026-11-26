import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAnalysis } from "../hooks/useAnalysis";
import { useLiveRefresh } from "../hooks/useLiveRefresh";
import { ScrollTrigger, prefersReducedMotion } from "../lib/gsap";
import { queryToDraft } from "../lib/share";
import { Configurator } from "../sections/Configurator";
import { Dashboard } from "../sections/dashboard/Dashboard";
import type { AnalyzeRequest } from "../types/api";

/** Portfolio builder + results. Accepts shared links (?h=…&run=1) and ?add=TICKER from stock pages. */
export function AnalyzePage() {
  const { state, run, refresh } = useAnalysis();
  const [params] = useSearchParams();
  // Read the URL once when the page opens; later edits don't rewrite the form.
  const prefill = useMemo(() => queryToDraft(params), []); // eslint-disable-line react-hooks/exhaustive-deps

  const analyze = useCallback(
    (req: AnalyzeRequest) => {
      run(req).then(() => requestAnimationFrame(() => ScrollTrigger.refresh()));
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

  const [liveEnabled, setLiveEnabled] = useState(true);
  const refreshCurrent = useCallback((s: { request: AnalyzeRequest }) => refresh(s.request), [refresh]);
  useLiveRefresh(state, liveEnabled, refreshCurrent);
  const refreshNow = useCallback(() => {
    if (state.status === "success") refresh(state.request);
  }, [state, refresh]);

  return (
    <>
      <div className="pt-14" />
      <Configurator
        onAnalyze={analyze}
        busy={state.status === "loading"}
        initialDraft={prefill?.draft}
        autoRun={prefill?.autoRun}
      />
      <Dashboard
        state={state}
        onRetry={retry}
        liveEnabled={liveEnabled}
        onToggleLive={() => setLiveEnabled((v) => !v)}
        onRefreshNow={refreshNow}
      />
    </>
  );
}
