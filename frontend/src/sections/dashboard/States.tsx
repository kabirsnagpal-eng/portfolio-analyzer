import { useEffect, useState } from "react";
import type { ApiError } from "../../services/api";

export function EmptyState() {
  return (
    <div className="grid min-h-[50vh] place-items-center py-24 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-8 flex h-16 items-end justify-center gap-1.5" aria-hidden="true">
          {[28, 44, 34, 58, 48, 64].map((h, i) => (
            <span key={i} className="w-2.5 rounded-sm bg-ink/[0.08]" style={{ height: h }} />
          ))}
        </div>
        <h3 className="text-title font-semibold">Your analysis will appear here.</h3>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-3">
          Configure your holdings above and press <span className="font-medium text-ink">Analyze portfolio</span>. Results
          are calculated from real historical prices — nothing is shown until real data has been retrieved.
        </p>
        <a href="#analyze" className="link-arrow mt-6 text-[15px]">
          Build a portfolio <span aria-hidden="true">›</span>
        </a>
      </div>
    </div>
  );
}

const STAGES = ["Fetching adjusted prices", "Aligning trading calendars", "Compounding returns", "Measuring risk"];

export function LoadingState() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 1600);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="py-16" aria-busy="true" aria-live="polite">
      <div className="mb-14 flex items-center gap-3 text-[15px] text-ink-2">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/15 border-t-ink" aria-hidden="true" />
        <span key={stage} className="animate-[fadein_400ms_ease-out]">{STAGES[stage]}…</span>
      </div>
      <div className="skeleton mb-4 h-4 w-40" />
      <div className="skeleton mb-6 h-24 w-[min(640px,90%)]" />
      <div className="skeleton mb-16 h-6 w-72" />
      <div className="grid grid-cols-2 gap-6 border-t border-line pt-10 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i}>
            <div className="skeleton mb-3 h-3 w-20" />
            <div className="skeleton h-7 w-28" />
          </div>
        ))}
      </div>
      <div className="skeleton mt-16 h-[320px] w-full" />
      <style>{`@keyframes fadein{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

const ERROR_TITLES: Record<string, string> = {
  invalid_ticker: "We couldn't find one of those symbols.",
  validation_error: "Some inputs need attention.",
  insufficient_data: "Not enough price history for this period.",
  data_unavailable: "Market data is temporarily unavailable.",
  network_error: "Can't reach the analysis server.",
};

export function ErrorState({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  const title = ERROR_TITLES[error.code] ?? "The analysis couldn't be completed.";
  const retryable = ["data_unavailable", "network_error", "internal_error", "http_error", "unknown"].includes(error.code);
  return (
    <div className="grid min-h-[44vh] place-items-center py-20" role="alert">
      <div className="max-w-lg text-center">
        <p className="mx-auto mb-6 grid h-12 w-12 place-items-center rounded-full border border-loss/30 font-serif text-2xl italic text-loss" aria-hidden="true">
          !
        </p>
        <h3 className="text-title font-semibold">{title}</h3>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-2">{error.message}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {retryable && (
            <button type="button" onClick={onRetry} className="btn-primary">
              Try again
            </button>
          )}
          <a href="#analyze" className={retryable ? "btn-ghost px-5 py-3" : "btn-primary"}>
            Edit portfolio
          </a>
        </div>
      </div>
    </div>
  );
}
