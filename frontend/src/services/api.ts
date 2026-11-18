import type { AnalyzeRequest, AnalyzeResponse, ApiErrorBody, Benchmark, TickerCheck } from "../types/api";

/** Error raised for any non-2xx response, carrying the backend's error code. */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const BASE = import.meta.env.VITE_API_BASE ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(
      "network_error",
      "Can't reach the analysis server. Make sure the backend is running on port 8000.",
      0,
    );
  }
  if (!res.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      /* non-JSON error page (e.g. proxy failure) */
    }
    throw new ApiError(
      body?.error ?? "http_error",
      body?.message ??
        (res.status >= 500
          ? "The analysis server is unavailable. Make sure the backend is running."
          : `Request failed (${res.status}).`),
      res.status,
      body?.details,
    );
  }
  return (await res.json()) as T;
}

export const api = {
  analyze: (payload: AnalyzeRequest, signal?: AbortSignal) =>
    request<AnalyzeResponse>("/api/analyze", { method: "POST", body: JSON.stringify(payload), signal }),
  benchmarks: () => request<Benchmark[]>("/api/benchmarks"),
  validateTicker: (symbol: string, signal?: AbortSignal) =>
    request<TickerCheck>(`/api/tickers/validate?symbol=${encodeURIComponent(symbol)}`, { signal }),
};
