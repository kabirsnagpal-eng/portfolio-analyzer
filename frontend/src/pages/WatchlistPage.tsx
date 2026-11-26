import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Change, Price } from "../components/market";
import { useQuotes } from "../hooks/useQuotes";
import { useWatchlist } from "../hooks/useWatchlist";
import { exchangeDay, exchangeTime } from "../sections/dashboard/LivePanel";

export function WatchlistPage() {
  const { items, remove } = useWatchlist();
  const tickers = useMemo(() => items.map((i) => i.ticker), [items]);
  const { quotes, loading } = useQuotes(tickers);
  const navigate = useNavigate();
  const newest = Object.values(quotes).reduce<string | null>((a, q) => (!a || q.time > a ? q.time : a), null);

  // Equal-weight "Analyze" link for the whole watchlist (up to 25 stocks)
  const analyzeHref = useMemo(() => {
    const list = tickers.slice(0, 25);
    if (!list.length) return "/analyze";
    const w = Math.floor((100 / list.length) * 100) / 100;
    const parts = list.map((t, i) => `${t}:${i === list.length - 1 ? Math.round((100 - w * (list.length - 1)) * 100) / 100 : w}`);
    return `/analyze?h=${encodeURIComponent(parts.join(","))}`;
  }, [tickers]);

  return (
    <div className="page pb-28 pt-24 sm:pt-32">
      <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow mb-5">Watchlist</p>
          <h1 className="text-headline font-semibold">
            Stocks you're <span className="font-serif font-normal italic">following.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-2">
            Saved in this browser — no account needed. Prices refresh every minute while this page is open.
          </p>
        </div>
        {items.length > 0 && (
          <Link to={analyzeHref} className="btn-primary">
            Analyze as a portfolio <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <div className="grid place-items-center border-y border-line py-24 text-center">
          <div className="max-w-md">
            <p className="text-title font-semibold">Your watchlist is empty.</p>
            <p className="mt-3 text-[15px] text-ink-2">Tap the ☆ next to any company in Markets or on a stock page to follow it here.</p>
            <Link to="/markets" className="btn-primary mt-8">
              Browse companies
            </Link>
          </div>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-line border-y border-line">
            {items.map((it) => {
              const q = quotes[it.ticker];
              return (
                <li
                  key={it.ticker}
                  className="group flex cursor-pointer items-center gap-4 py-4 transition-colors hover:bg-ink/[0.025]"
                  onClick={() => navigate(`/stock/${encodeURIComponent(it.ticker)}`)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{it.name}</p>
                    <p className="text-[12px] text-ink-3">
                      {it.ticker} · added {it.added}
                    </p>
                  </div>
                  <div className="text-right">
                    {q ? (
                      <>
                        <Price value={q.price} className="block text-[16px] font-semibold" />
                        <Change q={q} className="text-[13px]" />
                      </>
                    ) : loading ? (
                      <span className="skeleton block h-9 w-24" />
                    ) : (
                      <span className="text-[13px] text-ink-mute">No recent price</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(it.ticker);
                    }}
                    className="grid h-9 w-9 place-items-center rounded-full text-ink-mute transition-colors hover:bg-ink/[0.05] hover:text-loss"
                    aria-label={`Remove ${it.name} from watchlist`}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                      <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
          {newest && (
            <p className="num mt-3 text-[12px] text-ink-3">
              Prices as of {exchangeDay(newest)}, {exchangeTime(newest)} · Yahoo Finance, may be delayed
            </p>
          )}
        </>
      )}
    </div>
  );
}
