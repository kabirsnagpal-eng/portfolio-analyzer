import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { StockChart } from "../charts/StockChart";
import { Change, ExchangeBadges, Price, StarButton, formatCount, formatIndianLarge } from "../components/market";
import { useQuotes } from "../hooks/useQuotes";
import { formatPrice } from "../lib/format";
import { exchangeDay, exchangeTime } from "../sections/dashboard/LivePanel";
import { ApiError, api } from "../services/api";
import type { HistoryRange, StockDetail, StockHistory } from "../types/markets";

const RANGES: { v: HistoryRange; label: string }[] = [
  { v: "1d", label: "1D" },
  { v: "5d", label: "5D" },
  { v: "1m", label: "1M" },
  { v: "6m", label: "6M" },
  { v: "1y", label: "1Y" },
  { v: "5y", label: "5Y" },
  { v: "max", label: "Max" },
];

export function StockPage() {
  const { ticker = "" } = useParams();
  const t = decodeURIComponent(ticker).toUpperCase();
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [range, setRange] = useState<HistoryRange>("1y");
  const [history, setHistory] = useState<StockHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { quotes } = useQuotes(useMemo(() => [t], [t]));

  useEffect(() => {
    const ctrl = new AbortController();
    setDetail(null);
    setError(null);
    api
      .stock(t, ctrl.signal)
      .then((d) => {
        setDetail(d);
        document.title = `${d.name} — Folio`;
      })
      .catch((e) => e instanceof ApiError && setError(e));
    return () => {
      ctrl.abort();
      document.title = "Folio — Portfolio Analytics";
    };
  }, [t]);

  useEffect(() => {
    const ctrl = new AbortController();
    setHistoryLoading(true);
    const load = () =>
      api
        .history(t, range, ctrl.signal)
        .then(setHistory)
        .catch(() => undefined)
        .finally(() => setHistoryLoading(false));
    load();
    // Intraday charts follow the market: refresh every minute while visible.
    const id = range === "1d" || range === "5d" ? window.setInterval(() => document.visibilityState === "visible" && load(), 60_000) : 0;
    return () => {
      ctrl.abort();
      if (id) window.clearInterval(id);
    };
  }, [t, range]);

  if (error) {
    return (
      <div className="page grid min-h-[70vh] place-items-center pt-14 text-center">
        <div>
          <h1 className="text-title font-semibold">{error.status === 404 ? "We couldn't find that stock." : "Couldn't load this stock."}</h1>
          <p className="mt-3 text-ink-2">{error.message}</p>
          <Link to="/markets" className="btn-primary mt-8">
            Browse all companies
          </Link>
        </div>
      </div>
    );
  }

  const quote = quotes[t] ?? detail?.quote ?? null;
  const sym = !detail?.currency || detail.currency === "INR" ? "₹" : detail.currency === "USD" ? "$" : `${detail.currency} `;
  const s = detail?.stats;
  const company = detail?.company;

  return (
    <div className="page pb-28 pt-24 sm:pt-28">
      <nav className="mb-8 text-[13px] text-ink-3" aria-label="Breadcrumb">
        <Link to="/markets" className="hover:text-ink">
          Markets
        </Link>{" "}
        / <span className="text-ink-2">{detail?.name ?? t}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          {detail ? (
            <h1 className="text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-[1.02] tracking-[-0.03em]">{detail.name}</h1>
          ) : (
            <div className="skeleton h-12 w-80" />
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px] text-ink-3">
            <span className="font-medium text-ink-2">{t}</span>
            {company && <ExchangeBadges exchanges={company.exchanges} />}
            {detail?.sector && <span>{detail.sector}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {detail && <StarButton ticker={t} name={detail.name} />}
          <Link to={`/analyze?add=${encodeURIComponent(t)}`} className="btn-primary px-5 py-2.5 text-[14px]">
            Analyze performance
          </Link>
        </div>
      </div>

      {/* Price */}
      <div className="mt-10">
        {quote ? (
          <>
            <p className="text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-none tracking-[-0.04em]">
              <Price value={quote.price} currency={detail?.currency} />
            </p>
            <p className="mt-3 flex flex-wrap items-center gap-x-3 text-[15px]">
              <Change q={quote} className="font-semibold" />
              <span className="num text-[13px] text-ink-3">
                {quote.intraday ? `today · as of ${exchangeDay(quote.time)}, ${exchangeTime(quote.time)}` : `last close · ${exchangeDay(quote.time)}`}
              </span>
            </p>
          </>
        ) : detail ? (
          <p className="text-ink-3">No recent price available for this listing.</p>
        ) : (
          <div className="skeleton h-16 w-64" />
        )}
      </div>

      {/* Chart */}
      <section className="mt-12" aria-label="Price history">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-full bg-ink/[0.05] p-1" role="group" aria-label="Chart range">
            {RANGES.map((r) => (
              <button
                key={r.v}
                type="button"
                onClick={() => setRange(r.v)}
                aria-pressed={range === r.v}
                className={`rounded-full px-3 py-1 text-[12px] font-medium transition-all ${
                  range === r.v ? "bg-white text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-ink-3 hover:text-ink"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {history && history.points.length > 1 && (
            <RangeChange history={history} previousClose={range === "1d" ? quote?.previous_close ?? null : null} />
          )}
        </div>
        <div className={`transition-opacity ${historyLoading && !history ? "opacity-0" : historyLoading ? "opacity-60" : ""}`}>
          {history ? <StockChart key={`${t}-${range}`} history={history} previousClose={quote?.previous_close} currencySymbol={sym} /> : <div className="skeleton h-[320px] sm:h-[400px]" />}
        </div>
        <p className="mt-2 text-[12px] text-ink-3">Quoted (unadjusted) prices from Yahoo Finance; intraday data may be delayed.</p>
      </section>

      {/* Stats */}
      <section className="mt-16" aria-label="Key statistics">
        <h2 className="mb-6 text-[15px] font-semibold">Key statistics</h2>
        <dl className="grid gap-px border-y border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Market cap" value={s ? formatIndianLarge(s.market_cap, detail?.currency) : null} />
          <Stat label="P/E ratio (trailing)" value={s ? fmt(s.pe_ratio, 2) : null} />
          <Stat label="Price / book" value={s ? fmt(s.price_to_book, 2) : null} />
          <Stat label="Dividend yield" value={s ? (s.dividend_yield_pct === null ? "—" : `${s.dividend_yield_pct.toFixed(2)}%`) : null} />
          <Stat label="Day range" value={s ? range2(s.day_low, s.day_high, sym) : null} />
          <Stat label="52-week range" value={s ? range2(s.week52_low, s.week52_high, sym) : null}>
            {s && quote && s.week52_low !== null && s.week52_high !== null && s.week52_high > s.week52_low && (
              <span className="mt-2 block h-1 rounded-full bg-ink/[0.08]" aria-hidden="true">
                <span
                  className="block h-1 w-1.5 rounded-full bg-ink"
                  style={{ marginLeft: `${Math.min(100, Math.max(0, ((quote.price - s.week52_low) / (s.week52_high - s.week52_low)) * 100))}%` }}
                />
              </span>
            )}
          </Stat>
          <Stat label="Volume" value={s ? formatCount(s.volume) : null} />
          <Stat label="Beta (Yahoo)" value={s ? fmt(s.beta, 2) : null} />
        </dl>
      </section>

      {/* About */}
      {detail && (
        <section className="mt-16 grid gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" aria-label="About the company">
          <div>
            <h2 className="mb-4 text-[15px] font-semibold">About {detail.name}</h2>
            {detail.description ? (
              <>
                <p className={`max-w-3xl text-[15px] leading-relaxed text-ink-2 ${expanded ? "" : "line-clamp-5"}`}>{detail.description}</p>
                {detail.description.length > 400 && (
                  <button type="button" className="link-arrow mt-3 text-[14px]" onClick={() => setExpanded((e) => !e)}>
                    {expanded ? "Show less" : "Read more"}
                  </button>
                )}
              </>
            ) : (
              <p className="text-ink-3">No company description available.</p>
            )}
          </div>
          <dl className="space-y-4 text-[14px]">
            <Info label="Industry" value={detail.industry} />
            <Info label="Headquarters" value={detail.location} />
            <Info label="Employees" value={detail.employees ? detail.employees.toLocaleString("en-IN") : null} />
            {detail.website && (
              <div>
                <dt className="text-[12px] text-ink-3">Website</dt>
                <dd>
                  <a href={detail.website} target="_blank" rel="noreferrer noopener" className="text-accent hover:underline">
                    {detail.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                  </a>
                </dd>
              </div>
            )}
            <Info label="NSE symbol" value={company?.nse_symbol} />
            <Info label="BSE code" value={company?.bse_code} />
            <Info label="ISIN" value={company?.isin} />
          </dl>
        </section>
      )}

      <p className="mt-20 border-t border-line pt-6 text-[12px] leading-relaxed text-ink-3">
        Information only — not a recommendation to buy or sell. Data from Yahoo Finance and the exchanges' public files; it may be
        delayed, incomplete or revised.
      </p>
    </div>
  );
}

const fmt = (v: number | null, dp: number) => (v === null ? "—" : v.toFixed(dp));
const range2 = (lo: number | null, hi: number | null, sym: string) =>
  lo === null || hi === null ? "—" : `${sym}${formatPrice(lo)} – ${sym}${formatPrice(hi)}`;

function Stat({ label, value, children }: { label: string; value: string | null; children?: React.ReactNode }) {
  return (
    <div className="bg-paper px-1 py-6 sm:px-6">
      <dt className="text-[12px] text-ink-3">{label}</dt>
      <dd className="num mt-1.5 text-[17px] font-semibold tracking-tight">{value ?? <span className="skeleton inline-block h-5 w-24" />}</dd>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[12px] text-ink-3">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

function RangeChange({ history, previousClose }: { history: StockHistory; previousClose: number | null }) {
  const pts = history.points;
  const base = previousClose ?? pts[0].p;
  const last = pts[pts.length - 1].p;
  const change = last - base;
  return (
    <span className="text-[13px]">
      <Change q={{ change, change_pct: base ? change / base : null }} className="font-medium" />{" "}
      <span className="text-ink-3">over {RANGES.find((r) => r.v === history.range)?.label}</span>
    </span>
  );
}
