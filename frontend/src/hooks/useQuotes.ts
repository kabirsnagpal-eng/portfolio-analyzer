import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { Quote } from "../types/markets";

const REFRESH_MS = 60_000;

/**
 * Latest prices for a set of tickers, refreshed every minute while the page is
 * visible. Returns a map keyed by ticker; tickers Yahoo has no data for are
 * simply absent.
 */
export function useQuotes(tickers: string[]) {
  const key = tickers.join(",");
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!key) {
      setQuotes({});
      return;
    }
    let ctrl = new AbortController();
    const list = key.split(",");
    const load = (first: boolean) => {
      if (!first && document.visibilityState !== "visible") return;
      ctrl.abort();
      ctrl = new AbortController();
      if (first) setLoading(true);
      // The API accepts at most 60 tickers per call.
      const chunks: string[][] = [];
      for (let i = 0; i < list.length; i += 60) chunks.push(list.slice(i, i + 60));
      Promise.all(chunks.map((c) => api.quotes(c, ctrl.signal)))
        .then((parts) => {
          const map: Record<string, Quote> = {};
          parts.flat().forEach((q) => (map[q.ticker] = q));
          setQuotes(map);
          setError(null);
        })
        .catch((e) => {
          if ((e as Error).name !== "AbortError") setError((e as Error).message);
        })
        .finally(() => first && setLoading(false));
    };
    load(true);
    const id = window.setInterval(() => load(false), REFRESH_MS);
    return () => {
      ctrl.abort();
      window.clearInterval(id);
    };
  }, [key]);

  return { quotes, loading, error };
}
