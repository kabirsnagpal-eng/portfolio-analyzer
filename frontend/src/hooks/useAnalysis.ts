import { useCallback, useRef, useState } from "react";
import { ApiError, api } from "../services/api";
import type { AnalyzeRequest, AnalyzeResponse } from "../types/api";

export type AnalysisState =
  | { status: "idle" }
  | { status: "loading"; request: AnalyzeRequest }
  | { status: "success"; request: AnalyzeRequest; data: AnalyzeResponse }
  | { status: "error"; request: AnalyzeRequest; error: ApiError };

/** Owns the analyze request lifecycle; cancels an in-flight request when a new one starts. */
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
      if (!ctrl.signal.aborted) setState({ status: "success", request, data });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const error =
        err instanceof ApiError ? err : new ApiError("unknown", "Something unexpected went wrong. Please try again.", 0);
      setState({ status: "error", request, error });
    }
  }, []);

  return { state, run };
}
