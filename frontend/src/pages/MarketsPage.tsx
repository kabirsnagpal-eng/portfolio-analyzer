import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Change, ExchangeBadges, Price, StarButton } from "../components/market";
import { useQuotes } from "../hooks/useQuotes";
import { exchangeDay, exchangeTime } from "../sections/dashboard/LivePanel";
import { api } from "../services/api";
import type { CompanyPage, ListingsMeta, MarketOverview, NamedQuote } from "../types/markets";

const PAGE_SIZE = 25;
const EXCHANGES = [
  { v: "all", label: "All" },
  { v: "nse", label: "NSE" },
  { v: "bse", label: "BSE" },
] as const;

export function MarketsPage() {
  return (
    <div className="pt-14">
      <header className="page pb-12 pt-16 sm:pt-24">
        <p className="eyebrow mb-5">Markets</p>
        <h1 className="text-headline font-semibold">
          Every listed company. <span className="font-serif font-normal italic">Live.</span>
        </h1>
        <ListingsLine />
      </header>
      <Overview />
      <Directory />
    </div>
  );
}

function ListingsLine() {
  const [meta, setMeta] = useState<ListingsMeta | null>(null);
  useEffect(() => {
    api.listings().then(setMeta).catch(() => undefined);
  }, []);
  return (
    <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-2">
      {meta ? (
        <>
          <span className="num font-semibold text-ink">{meta.counts.total.toLocaleString("en-IN")}</span> companies —{" "}
          <span className="num">{meta.counts.nse.toLocaleString("en-IN")}</span> on NSE,{" "}
          <span className="num">{meta.counts.bse.toLocaleString("en-IN")}</span> on BSE,{" "}
          <span className="num">{meta.counts.both.toLocaleString("en-IN")}</span> on both. Lists from the exchanges' official
          files, updated {meta.generated}.
        </>
      ) : (
        <>Every equity listed on NSE and BSE, with live prices from Yahoo Finance.</>
      )}
    </p>
  );
}

function Overview() {
  const [data, setData] = useState<MarketOverview | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const ctrl = new AbortController();
    const load = () =>
      api
        .overview(ctrl.signal)
        .then((d) => {
          setData(d);
          setFailed(false);
        })
        .catch((e) => (e as Error).name !== "AbortError" && setFailed(true));
    load();
    const id = window.setInterval(() => document.visibilityState === "visible" && load(), 60_000);
    return () => {
      ctrl.abort();
      window.clearInterval(id);
    };
  }, []);

  return (
    <section className="page pb-20" aria-label="Market overview">
      <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {(data?.indices ?? Array.from({ length: 4 }, () => null)).map((q, i) =>
          q ? (
            <Link key={q.ticker} to={`/stock/${encodeURIComponent(q.ticker)}`} className="bg-paper px-6 py-6 transition-colors hover:bg-paper-2/70">
              <p className="text-[13px] font-medium text-ink-2">{q.name}</p>
              <p className="num mt-2 text-3xl font-semibold tracking-tight">{q.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p>
              <Change q={q} className="mt-1 block text-[13px] font-medium" />
            </Link>
          ) : (
            <div key={i} className="bg-paper px-6 py-6">
              <div className="skeleton mb-3 h-3 w-20" />
              <div className="skeleton mb-2 h-8 w-32" />
              <div className="skeleton h-3 w-24" />
            </div>
          ),
        )}
      </div>
      {failed && !data && <p className="mt-3 text-[13px] text-loss">Market data is unavailable right now. Retrying every minute.</p>}
      {data?.as_of && (
        <p className="num mt-3 text-[12px] text-ink-3">
          Prices as of {exchangeDay(data.as_of)}, {exchangeTime(data.as_of)} · refreshes every minute · Yahoo Finance, may be delayed
        </p>
      )}

      <div className="mt-14 grid gap-12 md:grid-cols-2">
        <Movers title="Top gainers" subtitle={data?.universe} items={data?.gainers} empty="No Nifty 50 stock is up today." />
        <Movers title="Top losers" subtitle={data?.universe} items={data?.losers} empty="No Nifty 50 stock is down today." />
      </div>
    </section>
  );
}

function Movers({ title, subtitle, items, empty }: { title: string; subtitle?: string; items?: NamedQuote[]; empty: string }) {
  return (
    <div>
      <h2 className="mb-1 text-[15px] font-semibold">{title}</h2>
      <p className="mb-4 text-[13px] text-ink-3">{subtitle ? `Among ${subtitle} stocks, today` : "Loading…"}</p>
      <ul className="divide-y divide-line border-y border-line">
        {items === undefined &&
          Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="flex justify-between py-3.5">
              <div className="skeleton h-4 w-40" />
              <div className="skeleton h-4 w-20" />
            </li>
          ))}
        {items?.length === 0 && <li className="py-6 text-[14px] text-ink-3">{empty}</li>}
        {items?.map((q) => (
          <li key={q.ticker}>
            <Link to={`/stock/${encodeURIComponent(q.ticker)}`} className="flex items-center justify-between gap-4 py-3.5 transition-colors hover:bg-ink/[0.025]">
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-medium">{q.name}</span>
                <span className="text-[12px] text-ink-3">{q.ticker.replace(".NS", "")}</span>
              </span>
              <span className="text-right">
                <Price value={q.price} className="block text-[14px]" />
                <Change q={q} showAbs={false} className="text-[13px] font-medium" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Directory() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const exchange = (params.get("ex") as "all" | "nse" | "bse") || "all";
  const industry = params.get("ind") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [input, setInput] = useState(q);
  const [result, setResult] = useState<CompanyPage | null>(null);
  const [industries, setIndustries] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  };

  // Debounce typing into the URL
  useEffect(() => {
    const id = window.setTimeout(() => input !== q && set({ q: input.trim() || null }), 200);
    return () => window.clearTimeout(id);
  }, [input]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.listings().then((m) => setIndustries(m.industries)).catch(() => undefined);
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    api
      .stocks({ q, exchange, industry: industry || undefined, offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE }, ctrl.signal)
      .then(setResult)
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [q, exchange, industry, page]);

  const tickers = useMemo(() => result?.items.map((c) => c.ticker) ?? [], [result]);
  const { quotes, loading: quotesLoading } = useQuotes(tickers);
  const pages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  return (
    <section id="directory" className="scroll-mt-16 border-t border-line py-20 sm:py-24">
      <div className="page">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow mb-4">Directory</p>
            <h2 className="text-title font-semibold">All NSE &amp; BSE listed companies</h2>
          </div>
          <p className="num text-[13px] text-ink-3" aria-live="polite">
            {result ? `${result.total.toLocaleString("en-IN")} ${result.total === 1 ? "company" : "companies"}` : "Loading…"}
          </p>
        </div>

        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search companies</span>
            <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3">
              <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <input
              className="field h-12 pl-10 text-[15px]"
              placeholder="Search by company name, NSE symbol, BSE code or ISIN"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </label>
          <div className="flex rounded-full bg-ink/[0.05] p-1" role="group" aria-label="Exchange">
            {EXCHANGES.map((x) => (
              <button
                key={x.v}
                type="button"
                aria-pressed={exchange === x.v}
                onClick={() => set({ ex: x.v === "all" ? null : x.v })}
                className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-all ${
                  exchange === x.v ? "bg-white text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-ink-3 hover:text-ink"
                }`}
              >
                {x.label}
              </button>
            ))}
          </div>
          <label className="md:w-64">
            <span className="sr-only">Industry</span>
            <select className="field h-12 cursor-pointer" value={industry} onChange={(e) => set({ ind: e.target.value || null })}>
              <option value="">All industries</option>
              {industries.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>
        </div>
        {industry && (
          <p className="-mt-3 mb-5 text-[12px] text-ink-3">Industry labels are NSE's classification and cover Nifty 500 companies.</p>
        )}

        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className={`w-full min-w-[720px] border-collapse text-[14px] transition-opacity ${loading ? "opacity-50" : ""}`}>
            <thead>
              <tr className="border-b border-ink/80 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                <th className="w-10 pb-3" />
                <th className="pb-3">Company</th>
                <th className="pb-3">Listed on</th>
                <th className="pb-3">Industry</th>
                <th className="pb-3 text-right">Price</th>
                <th className="pb-3 text-right">Today</th>
              </tr>
            </thead>
            <tbody>
              {result?.items.map((c) => {
                const quote = quotes[c.ticker];
                return (
                  <tr
                    key={c.isin}
                    className="cursor-pointer border-b border-line transition-colors hover:bg-ink/[0.025]"
                    onClick={() => navigate(`/stock/${encodeURIComponent(c.ticker)}`)}
                  >
                    <td className="py-2">
                      <StarButton ticker={c.ticker} name={c.name} size="sm" />
                    </td>
                    <td className="py-3 pr-4">
                      <Link to={`/stock/${encodeURIComponent(c.ticker)}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                        {c.name}
                      </Link>
                      <p className="text-[12px] text-ink-3">
                        {[c.nse_symbol, c.bse_code && `BSE ${c.bse_code}`].filter(Boolean).join(" · ")}
                      </p>
                    </td>
                    <td className="py-3">
                      <ExchangeBadges exchanges={c.exchanges} />
                    </td>
                    <td className="max-w-[200px] truncate py-3 text-[13px] text-ink-3">{c.industry ?? "—"}</td>
                    <td className="py-3 text-right">
                      {quote ? <Price value={quote.price} /> : quotesLoading ? <span className="skeleton ml-auto block h-4 w-16" /> : <span className="text-ink-mute">—</span>}
                    </td>
                    <td className="py-3 text-right text-[13px]">
                      {quote ? <Change q={quote} showAbs={false} /> : quotesLoading ? <span className="skeleton ml-auto block h-4 w-12" /> : <span className="text-ink-mute">—</span>}
                    </td>
                  </tr>
                );
              })}
              {result && result.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-ink-3">
                    No listed company matches “{q}”. Try a shorter name or the NSE symbol.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-[13px]">
          <p className="text-ink-3">
            “—” means Yahoo Finance has no recent price for that listing (common for thinly traded BSE scrips).
          </p>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-ghost disabled:opacity-40" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })}>
              ‹ Previous
            </button>
            <span className="num text-ink-2">
              Page {page} of {pages.toLocaleString("en-IN")}
            </span>
            <button type="button" className="btn-ghost disabled:opacity-40" disabled={page >= pages} onClick={() => set({ page: String(page + 1) })}>
              Next ›
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
