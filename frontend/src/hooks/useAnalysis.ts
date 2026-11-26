import { useCallback, useRef, useState } from "react";
import { ApiError, api } from "../services/api";
import type { AnalyzeRequest, AnalyzeResponse } from "../types/api";

export type AnalysisState =
  | { status: "idle" }
  | { status: "loading"; request: AnalyzeRequest }
  | {
      status: "success";
      request: AnalyzeRequest;
      data: AnalyzeResponse;
      /** When this data arrived (ms since epoch). */
      receivedAt: number;
      /** A background live refresh is in flight. */
      refreshing: boolean;
      /** Message from the last failed background refresh; the previous data stays on screen. */
      refreshError: string | null;
    }
  | { status: "error"; request: AnalyzeRequest; error: ApiError };

/**
 * Owns the analyze request lifecycle.
 * - run(): full analysis with a loading state; cancels any in-flight request.
 * - refresh(): silent re-run of the current request (live updates). The
 *   dashboard keeps showing the current numbers until new ones arrive.
 */
export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>({ status: "idle" });
  const controller = useRef<AbortController | null>(null);

  const run = useCallback(async (request: AnalyzeRequest) => {
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    setState({ status: "loading", request });
    try {
      const data = await api.analyze(request, ctrl.signal);
      if (!ctrl.signal.aborted) {
        setState({ status: "success", request, data, receivedAt: Date.now(), refreshing: false, refreshError: null });
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const error =
        err instanceof ApiError ? err : new ApiError("unknown", "Something unexpected went wrong. Please try again.", 0);
      setState({ status: "error", request, error });
    }
  }, []);

  const refresh = useCallback(async (request: AnalyzeRequest) => {
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    setState((s) => (s.status === "success" ? { ...s, refreshing: true } : s));
    try {
      const data = await api.analyze(request, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setState((s) =>
        s.status === "success" && s.request === request
          ? { ...s, data, receivedAt: Date.now(), refreshing: false, refreshError: null }
          : s,
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const message = err instanceof ApiError ? err.message : "Live update failed.";
      setState((s) => (s.status === "success" ? { ...s, refreshing: false, refreshError: message } : s));
    }
  }, []);

  return { state, run, refresh };
}
