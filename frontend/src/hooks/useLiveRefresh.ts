import { useEffect } from "react";
import type { AnalysisState } from "./useAnalysis";

export const LIVE_INTERVAL_OPEN_MS = 60_000; // market open: every minute
export const LIVE_INTERVAL_CLOSED_MS = 300_000; // market closed: every 5 minutes

/**
 * Re-runs the current analysis on a timer while live mode is on, the result
 * has live data, and the page is visible. Pauses in background tabs and
 * refreshes immediately when the tab becomes visible again if it's overdue.
 */
export function useLiveRefresh(state: AnalysisState, enabled: boolean, refresh: (s: Extract<AnalysisState, { status: "success" }>) => void) {
  const live = state.status === "success" ? state.data.live : null;
  const interval = live?.market_open ? LIVE_INTERVAL_OPEN_MS : LIVE_INTERVAL_CLOSED_MS;
  const receivedAt = state.status === "success" ? state.receivedAt : 0;
  const busy = state.status === "success" && state.refreshing;

  useEffect(() => {
    if (state.status !== "success" || !live || !enabled || busy) return;
    const current = state;
    const due = () => Date.now() - receivedAt >= interval;
    const tick = () => {
      if (document.visibilityState === "visible" && due()) refresh(current);
    };
    const id = window.setTimeout(tick, Math.max(1000, receivedAt + interval - Date.now()));
    const onVisible = () => tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [state, live, enabled, busy, interval, receivedAt, refresh]);
}
