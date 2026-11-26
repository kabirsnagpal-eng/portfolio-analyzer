import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import type { Company } from "../types/markets";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Global stock search (Ctrl/⌘ + K). Searches every NSE and BSE listed company
 * by name, symbol, BSE code or ISIN and opens its stock page.
 */
export function SearchPalette({ open, onClose }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Company[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setQ("");
      setResults([]);
      setActive(0);
      window.setTimeout(() => input.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const id = window.setTimeout(() => {
      api
        .stocks({ q: term, limit: 8 }, ctrl.signal)
        .then((r) => {
          setResults(r.items);
          setActive(0);
        })
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, 120);
    return () => {
      ctrl.abort();
      window.clearTimeout(id);
    };
  }, [q, open]);

  if (!open) return null;

  const go = (c: Company) => {
    onClose();
    navigate(`/stock/${encodeURIComponent(c.ticker)}`);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      go(results[active]);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-ink/30 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search stocks"
        className="w-full max-w-xl overflow-hidden rounded-xl border border-line bg-paper shadow-[0_30px_80px_-20px_rgba(0,0,0,0.45)]"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKey}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="text-ink-3">
            <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search 4,800+ NSE & BSE companies — name, symbol or BSE code"
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-mute"
            aria-controls="search-results"
            aria-activedescendant={results[active] ? `sr-${results[active].ticker}` : undefined}
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[11px] text-ink-3">Esc</kbd>
        </div>
        <ul id="search-results" role="listbox" className="max-h-[50vh] overflow-y-auto py-1">
          {results.map((c, i) => (
            <li
              key={c.isin}
              id={`sr-${c.ticker}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(c)}
              className={`flex cursor-pointer items-center justify-between gap-4 px-4 py-2.5 ${i === active ? "bg-ink/[0.05]" : ""}`}
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium">{c.name}</p>
                <p className="truncate text-[12px] text-ink-3">
                  {[c.nse_symbol && `NSE: ${c.nse_symbol}`, c.bse_code && `BSE: ${c.bse_code}`, c.industry].filter(Boolean).join(" · ")}
                </p>
              </div>
              <span className="text-[12px] text-ink-mute">↵</span>
            </li>
          ))}
          {q.trim() && !loading && results.length === 0 && (
            <li className="px-4 py-6 text-center text-[14px] text-ink-3">No listed company matches “{q.trim()}”.</li>
          )}
          {!q.trim() && (
            <li className="px-4 py-5 text-[13px] text-ink-3">
              Try “Reliance”, “TCS”, “500325” or “HDFC”. Use ↑ ↓ and Enter to open a stock.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
