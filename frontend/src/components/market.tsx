import { formatPercent, formatPrice, toneOf } from "../lib/format";
import { useWatchlist } from "../hooks/useWatchlist";
import type { Quote } from "../types/markets";

const toneClass = { gain: "text-gain", loss: "text-loss", flat: "text-ink-3" } as const;

/** "+22.30 (+1.62%)" with ▲/▼ so the direction never relies on colour alone. */
export function Change({ q, showAbs = true, className = "" }: { q: Pick<Quote, "change" | "change_pct">; showAbs?: boolean; className?: string }) {
  if (q.change_pct === null) return <span className={`text-ink-mute ${className}`}>—</span>;
  const tone = toneOf(q.change_pct);
  return (
    <span className={`num whitespace-nowrap ${toneClass[tone]} ${className}`}>
      <span aria-hidden="true" className="text-[0.75em]">{tone === "gain" ? "▲ " : tone === "loss" ? "▼ " : ""}</span>
      {showAbs && q.change !== null && `${q.change >= 0 ? "+" : "−"}${formatPrice(Math.abs(q.change))} `}
      {showAbs ? `(${formatPercent(q.change_pct, 2, true)})` : formatPercent(q.change_pct, 2, true)}
    </span>
  );
}

export function Price({ value, currency = "INR", className = "" }: { value: number; currency?: string | null; className?: string }) {
  const sym = currency === "INR" || !currency ? "₹" : currency === "USD" ? "$" : `${currency} `;
  return (
    <span className={`num ${className}`}>
      {sym}
      {formatPrice(value)}
    </span>
  );
}

/** Indian-style large numbers: ₹19.1 lakh crore / ₹4,520 crore. */
export function formatIndianLarge(value: number | null, currency: string | null = "INR"): string {
  if (value === null) return "—";
  const sym = currency === "INR" || !currency ? "₹" : `${currency} `;
  const crore = value / 1e7;
  if (crore >= 1e5) return `${sym}${(crore / 1e5).toFixed(2)} lakh crore`;
  if (crore >= 1) return `${sym}${Math.round(crore).toLocaleString("en-IN")} crore`;
  return `${sym}${Math.round(value).toLocaleString("en-IN")}`;
}

export function formatCount(value: number | null): string {
  if (value === null) return "—";
  if (value >= 1e7) return `${(value / 1e7).toFixed(2)} Cr`;
  if (value >= 1e5) return `${(value / 1e5).toFixed(2)} L`;
  return Math.round(value).toLocaleString("en-IN");
}

export function StarButton({ ticker, name, size = "md" }: { ticker: string; name: string; size?: "sm" | "md" }) {
  const { has, toggle } = useWatchlist();
  const on = has(ticker);
  const dim = size === "sm" ? 15 : 18;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(ticker, name);
      }}
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from watchlist` : `Add ${name} to watchlist`}
      title={on ? "In your watchlist" : "Add to watchlist"}
      className={`grid place-items-center rounded-full transition-colors hover:bg-ink/[0.06] ${size === "sm" ? "h-8 w-8" : "h-10 w-10"} ${
        on ? "text-[#eda100]" : "text-ink-mute hover:text-ink"
      }`}
    >
      <svg width={dim} height={dim} viewBox="0 0 20 20" aria-hidden="true">
        <path
          d="M10 2.5l2.3 4.7 5.2.8-3.8 3.7.9 5.2L10 14.4l-4.6 2.5.9-5.2L2.5 8l5.2-.8z"
          fill={on ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export function ExchangeBadges({ exchanges }: { exchanges: string[] }) {
  return (
    <span className="inline-flex gap-1">
      {exchanges.map((x) => (
        <span key={x} className="rounded border border-line px-1.5 py-px text-[10px] font-semibold tracking-wide text-ink-3">
          {x}
        </span>
      ))}
    </span>
  );
}
