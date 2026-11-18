import { useMemo, useState } from "react";
import { InfoTip } from "../../components/InfoTip";
import { formatPercent, formatPoints, formatPrice, toneOf } from "../../lib/format";
import type { HoldingResult } from "../../types/api";

type SortKey = "ticker" | "weight" | "start_price" | "end_price" | "total_return" | "contribution";

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "ticker", label: "Holding", numeric: false },
  { key: "weight", label: "Allocation", numeric: true },
  { key: "start_price", label: "Start price", numeric: true },
  { key: "end_price", label: "End price", numeric: true },
  { key: "total_return", label: "Return", numeric: true },
  { key: "contribution", label: "Contribution", numeric: true },
];

const toneClass = { gain: "text-gain", loss: "text-loss", flat: "text-ink" } as const;

export function HoldingsTable({ holdings, portfolioReturn }: { holdings: HoldingResult[]; portfolioReturn: number }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "contribution", dir: -1 });

  const rows = useMemo(() => {
    const copy = [...holdings];
    copy.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return cmp * sort.dir;
    });
    return copy;
  }, [holdings, sort]);

  const maxAbsContribution = Math.max(...holdings.map((h) => Math.abs(h.contribution)), 1e-9);
  const sumContribution = holdings.reduce((s, h) => s + h.contribution, 0);

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "ticker" ? 1 : -1 }));

  return (
    <div>
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[720px] border-collapse text-[15px]">
          <thead>
            <tr className="border-b border-ink/80">
              {COLUMNS.map((c) => {
                const active = sort.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
                    className={`pb-3 text-[11px] font-semibold uppercase tracking-[0.14em] ${c.numeric ? "text-right" : "text-left"}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(c.key)}
                      className={`inline-flex items-center gap-1 transition-colors ${active ? "text-ink" : "text-ink-3 hover:text-ink"}`}
                    >
                      {c.label}
                      <span aria-hidden="true" className={`text-[9px] transition-opacity ${active ? "opacity-100" : "opacity-0"}`}>
                        {sort.dir === 1 ? "▲" : "▼"}
                      </span>
                    </button>
                    {c.key === "contribution" && (
                      <span className="ml-1.5 inline-flex align-middle normal-case">
                        <InfoTip label="contribution" align="right">
                          Initial weight × the holding's own total return, in percentage points. A simple attribution under
                          the initial-weight convention: because the portfolio is rebalanced daily, contributions do not sum
                          exactly to the portfolio's return and are not a decomposition of CAGR.
                        </InfoTip>
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => {
              const rt = toneOf(h.total_return);
              const ct = toneOf(h.contribution);
              return (
                <tr key={h.ticker} className="group border-b border-line transition-colors hover:bg-ink/[0.025]">
                  <td className="py-4 pr-4">
                    <p className="font-semibold">{h.ticker}</p>
                    {h.name && <p className="max-w-[260px] truncate text-[13px] text-ink-3">{h.name}</p>}
                  </td>
                  <td className="num py-4 text-right">{formatPercent(h.weight, 1)}</td>
                  <td className="num py-4 text-right text-ink-2">{formatPrice(h.start_price)}</td>
                  <td className="num py-4 text-right text-ink-2">{formatPrice(h.end_price)}</td>
                  <td className={`num py-4 text-right font-medium ${toneClass[rt]}`}>{formatPercent(h.total_return, 2, true)}</td>
                  <td className="py-4 pl-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-ink/[0.06] md:block" aria-hidden="true">
                        <span
                          className={`block h-full rounded-full ${ct === "loss" ? "bg-loss/70" : "bg-gain/70"}`}
                          style={{ width: `${(Math.abs(h.contribution) / maxAbsContribution) * 100}%` }}
                        />
                      </span>
                      <span className={`num w-20 font-medium ${toneClass[ct]}`}>{formatPoints(h.contribution)}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="text-[13px] text-ink-3">
              <td className="pt-4" colSpan={4}>
                Prices are split- and dividend-adjusted closes in each security's trading currency.
              </td>
              <td className="num pt-4 text-right">Portfolio {formatPercent(portfolioReturn, 2, true)}</td>
              <td className="num pt-4 text-right">Σ {formatPoints(sumContribution)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
