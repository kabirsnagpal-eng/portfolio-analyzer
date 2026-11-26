import { formatPercent, formatPrice, toneOf } from "../../lib/format";
import type { LiveInfo, LiveQuote } from "../../types/api";

interface Props {
  live: LiveInfo;
  enabled: boolean;
  onToggle: () => void;
  onRefreshNow: () => void;
  refreshing: boolean;
  refreshError: string | null;
  receivedAt: number;
  intervalMs: number;
}

const OFFSET_LABEL: Record<string, string> = {
  "+05:30": "IST",
  "-05:00": "ET",
  "-04:00": "ET",
  "+00:00": "GMT",
  "+01:00": "BST",
  Z: "UTC",
};
const CURRENCY: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£", JPY: "¥" };
const toneClass = { gain: "text-gain", loss: "text-loss", flat: "text-ink-2" } as const;

/** "2026-11-26T15:28:00+05:30" -> "15:28 IST" (shown in the exchange's own time). */
export function exchangeTime(iso: string): string {
  const m = iso.match(/T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/);
  if (!m) return iso;
  return `${m[1]}:${m[2]} ${OFFSET_LABEL[m[3]] ?? `UTC${m[3]}`}`;
}

/** "2026-11-26T15:28:00+05:30" -> "26 Nov" */
export function exchangeDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(d);
}

/**
 * Live status strip + latest quotes. Every chart and metric below is already
 * computed with these prices (the API uses them as today's price), so this
 * panel is the "what just moved" summary on top.
 */
export function LivePanel({ live, enabled, onToggle, onRefreshNow, refreshing, refreshError, receivedAt, intervalMs }: Props) {
  const open = live.market_open;
  const updated = new Date(receivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const every = intervalMs >= 60_000 ? `${Math.round(intervalMs / 60_000)} min` : `${Math.round(intervalMs / 1000)} s`;

  return (
    <section aria-label="Live prices" className="mb-14 rounded-xl border border-line bg-white/60">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="flex items-center gap-2 text-[13px] font-semibold">
            <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
              {open && enabled && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gain/60" />}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${open ? "bg-gain" : "bg-ink-mute"}`} />
            </span>
            {open ? "Live · market open" : "Market closed"}
          </span>
          <span className="num text-[13px] text-ink-3">
            Prices as of {exchangeDay(live.as_of)}, {exchangeTime(live.as_of)}
          </span>
          <span className="num text-[13px] text-ink-3" aria-live="polite">
            {refreshing ? "Updating…" : `Updated ${updated}`}
            {enabled && !refreshing && <> · every {every}</>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefreshNow}
            disabled={refreshing}
            className="btn-ghost disabled:opacity-50"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true" className={refreshing ? "animate-spin" : ""}>
              <path d="M13.5 8A5.5 5.5 0 1 1 11.9 4.1M13.5 2.5v3h-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Refresh
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={onToggle}
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:bg-ink/[0.05]"
          >
            <span className={`relative h-5 w-9 rounded-full transition-colors duration-300 ${enabled ? "bg-gain" : "bg-ink/20"}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-300 ${enabled ? "left-[18px]" : "left-0.5"}`} />
            </span>
            Auto-update
          </button>
        </div>
      </div>

      <ul className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
        {live.quotes.map((q) => (
          <QuoteCell key={q.ticker} q={q} />
        ))}
      </ul>

      <p className="border-t border-line px-5 py-3 text-[12px] leading-relaxed text-ink-3">
        {refreshError ? (
          <span className="text-loss">Live update failed: {refreshError} Showing the last successful prices.</span>
        ) : (
          <>
            The latest price is used as today's value in every number and chart below. Yahoo Finance prices can lag the
            exchange by a few minutes{open ? "" : "; outside market hours they show the last traded price"}.
          </>
        )}
      </p>
    </section>
  );
}

function QuoteCell({ q }: { q: LiveQuote }) {
  const tone = q.change_pct === null ? "flat" : toneOf(q.change_pct);
  const sym = q.currency ? (CURRENCY[q.currency] ?? `${q.currency} `) : "";
  return (
    <li className="bg-paper/80 px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="truncate text-[13px] font-semibold">
          {q.ticker}
          {q.is_benchmark && <span className="ml-2 text-[11px] font-normal text-ink-3">Benchmark</span>}
        </p>
        <p className="num text-[11px] text-ink-mute">{exchangeTime(q.time)}</p>
      </div>
      <p className="num mt-1 text-2xl font-semibold tracking-tight">
        {sym}
        {formatPrice(q.price)}
      </p>
      <p className={`num mt-0.5 text-[13px] font-medium ${toneClass[tone]}`}>
        {q.change_pct === null ? (
          <span className="text-ink-3">No previous close</span>
        ) : (
          <>
            <span aria-hidden="true">{tone === "gain" ? "▲ " : tone === "loss" ? "▼ " : ""}</span>
            {q.change !== null && `${q.change >= 0 ? "+" : "−"}${formatPrice(Math.abs(q.change))} `}
            ({formatPercent(q.change_pct, 2, true)}) today
          </>
        )}
      </p>
    </li>
  );
}
