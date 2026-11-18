import { useEffect, useMemo, useRef, useState } from "react";
import { InfoTip } from "../components/InfoTip";
import { useReveal } from "../hooks/useReveal";
import { formatCurrency, formatPercent } from "../lib/format";
import {
  MAX_HOLDINGS,
  WEIGHT_TOLERANCE_PCT,
  costWeights,
  defaultDraft,
  equalWeights,
  holdingCost,
  isoDate,
  newId,
  parseNumber,
  switchMode,
  toRequest,
  validateDraft,
  type HoldingDraft,
  type InputMode,
  type PortfolioDraft,
} from "../lib/portfolio";
import { api } from "../services/api";
import type { AnalyzeRequest, Benchmark } from "../types/api";

const FALLBACK_BENCHMARKS: Benchmark[] = [
  { ticker: "^NSEI", name: "Nifty 50", region: "India" },
  { ticker: "^BSESN", name: "S&P BSE Sensex", region: "India" },
  { ticker: "^NSEBANK", name: "Nifty Bank", region: "India" },
  { ticker: "^CNXIT", name: "Nifty IT", region: "India" },
  { ticker: "^GSPC", name: "S&P 500", region: "United States" },
  { ticker: "^NDX", name: "Nasdaq 100", region: "United States" },
];
const PERIODS = [1, 3, 5, 10];
const CUSTOM = "__custom__";
const MODES: { value: InputMode; label: string }[] = [
  { value: "weights", label: "By weight" },
  { value: "shares", label: "By shares" },
];

type TickerStatus = { state: "checking" } | { state: "valid"; name: string | null } | { state: "invalid" } | { state: "unknown" };

interface Props {
  onAnalyze: (req: AnalyzeRequest) => void;
  busy: boolean;
}

export function Configurator({ onAnalyze, busy }: Props) {
  const root = useRef<HTMLElement>(null);
  useReveal(root);

  const [draft, setDraft] = useState<PortfolioDraft>(() => defaultDraft());
  const [showErrors, setShowErrors] = useState(false);
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>(FALLBACK_BENCHMARKS);
  const [customBench, setCustomBench] = useState(false);
  const [tickerStatus, setTickerStatus] = useState<Record<string, TickerStatus>>({});
  const validation = useMemo(() => validateDraft(draft), [draft]);

  useEffect(() => {
    api.benchmarks().then(setBenchmarks).catch(() => undefined);
  }, []);

  const update = (patch: Partial<PortfolioDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const updateHolding = (id: string, patch: Partial<Omit<HoldingDraft, "id">>) =>
    setDraft((d) => ({ ...d, holdings: d.holdings.map((h) => (h.id === id ? { ...h, ...patch } : h)) }));
  const sharesMode = draft.mode === "shares";
  const derivedWeights = useMemo(() => costWeights(draft.holdings), [draft.holdings]);

  const addHolding = () =>
    setDraft((d) => {
      if (d.holdings.length >= MAX_HOLDINGS) return d;
      const remaining = Math.max(0, Math.round((100 - validation.totalWeight) * 100) / 100);
      const weight = d.mode === "weights" && remaining > 0 ? String(remaining) : "";
      return { ...d, holdings: [...d.holdings, { id: newId(), ticker: "", weight, shares: "", price: "" }] };
    });
  const removeHolding = (id: string) => setDraft((d) => ({ ...d, holdings: d.holdings.filter((h) => h.id !== id) }));
  const splitEqually = () =>
    setDraft((d) => {
      const ws = equalWeights(d.holdings.length);
      return { ...d, holdings: d.holdings.map((h, i) => ({ ...h, weight: ws[i] })) };
    });
  const loadExample = () => {
    setDraft((d) => {
      const base = { ...defaultDraft(), startDate: d.startDate, endDate: d.endDate, mode: d.mode };
      if (d.mode === "shares") {
        // Example holdings entered as shares bought at an average price.
        const example: [string, string][] = [["30", "1250"], ["10", "3400"], ["20", "1500"]];
        base.holdings = base.holdings.map((h, i) => ({ ...h, shares: example[i][0], price: example[i][1] }));
      }
      return base;
    });
    setShowErrors(false);
  };
  const setPeriod = (years: number) => {
    const end = new Date();
    const start = new Date(Date.UTC(end.getUTCFullYear() - years, end.getUTCMonth(), end.getUTCDate()));
    update({ startDate: isoDate(start), endDate: isoDate(end) });
  };
  const activePeriod = PERIODS.find((y) => {
    const end = new Date();
    const start = new Date(Date.UTC(end.getUTCFullYear() - y, end.getUTCMonth(), end.getUTCDate()));
    return draft.startDate === isoDate(start) && draft.endDate === isoDate(end);
  });

  const checkTicker = async (raw: string) => {
    const t = raw.trim().toUpperCase();
    if (!t || tickerStatus[t]?.state === "valid" || tickerStatus[t]?.state === "invalid") return;
    if (!/^[A-Z0-9^][A-Z0-9.\-=&^]{0,19}$/.test(t)) return;
    setTickerStatus((s) => ({ ...s, [t]: { state: "checking" } }));
    try {
      const res = await api.validateTicker(t);
      setTickerStatus((s) => ({ ...s, [t]: res.valid ? { state: "valid", name: res.name } : { state: "invalid" } }));
    } catch {
      setTickerStatus((s) => ({ ...s, [t]: { state: "unknown" } }));
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    if (!validation.valid) return;
    onAnalyze(toRequest(draft));
  };

  const total = validation.totalWeight;
  const totalOk = Math.abs(total - 100) <= WEIGHT_TOLERANCE_PCT;
  const remaining = Math.round((100 - total) * 100) / 100;
  const err = (msg?: string) => (showErrors ? msg : undefined);

  return (
    <section ref={root} id="analyze" className="scroll-mt-14 border-t border-line py-28 sm:py-36">
      <div className="page">
        <div className="mb-16 grid gap-6 md:grid-cols-2 md:items-end">
          <div data-reveal>
            <p className="eyebrow mb-5">Analyze</p>
            <h2 className="text-headline font-semibold">
              Build your <span className="font-serif font-normal italic">portfolio.</span>
            </h2>
          </div>
          <p data-reveal data-reveal-delay="0.1" className="max-w-md text-lg leading-relaxed text-ink-2 md:justify-self-end">
            Enter target weights, or the shares you hold and what you paid for them. Weights are held constant
            through the period — the portfolio is rebalanced daily.
          </p>
        </div>

        <form onSubmit={submit} noValidate className="grid gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
          {/* Holdings */}
          <div data-reveal>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex rounded-full bg-ink/[0.05] p-1" role="group" aria-label="How to enter holdings">
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setDraft((d) => switchMode(d, m.value))}
                    aria-pressed={draft.mode === m.value}
                    className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-all duration-300 ${
                      draft.mode === m.value ? "bg-white text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-ink-3 hover:text-ink"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {!sharesMode && (
                  <button type="button" className="btn-ghost" onClick={splitEqually} disabled={!draft.holdings.length}>
                    Split equally
                  </button>
                )}
                <button type="button" className="btn-ghost" onClick={loadExample}>
                  Load example
                </button>
              </div>
            </div>

            <div
              className={`hidden gap-3 border-b border-line pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3 sm:grid ${
                sharesMode ? "grid-cols-[2rem_minmax(0,1fr)_6rem_8rem_2.5rem]" : "grid-cols-[2rem_minmax(0,1fr)_7.5rem_2.5rem]"
              }`}
            >
              <span>#</span>
              <span>Ticker</span>
              {sharesMode ? (
                <>
                  <span className="text-right">Shares</span>
                  <span className="text-right">Avg buy price</span>
                </>
              ) : (
                <span className="text-right">Weight</span>
              )}
              <span />
            </div>

            <ul className="divide-y divide-line border-b border-line">
              {draft.holdings.map((h, i) => {
                const he = validation.holdingErrors[h.id] ?? {};
                const status = tickerStatus[h.ticker.trim().toUpperCase()];
                const w = sharesMode ? derivedWeights[i] * 100 : parseNumber(h.weight);
                const cost = holdingCost(h);
                return (
                  <li
                    key={h.id}
                    className={`group grid items-start gap-3 py-3 ${
                      sharesMode
                        ? "grid-cols-[minmax(0,1fr)_4.5rem_6rem_2.25rem] sm:grid-cols-[2rem_minmax(0,1fr)_6rem_8rem_2.5rem]"
                        : "grid-cols-[minmax(0,1fr)_6.5rem_2.25rem] sm:grid-cols-[2rem_minmax(0,1fr)_7.5rem_2.5rem]"
                    }`}
                  >
                    <span className="num hidden pt-3 text-sm text-ink-mute sm:block">{String(i + 1).padStart(2, "0")}</span>
                    <div className="min-w-0">
                      <label className="sr-only" htmlFor={`t-${h.id}`}>Ticker {i + 1}</label>
                      <input
                        id={`t-${h.id}`}
                        className={`field font-medium uppercase tracking-wide ${err(he.ticker) ? "field-invalid" : ""}`}
                        value={h.ticker}
                        placeholder="e.g. HDFCBANK.NS"
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(e) => updateHolding(h.id, { ticker: e.target.value.toUpperCase() })}
                        onBlur={(e) => checkTicker(e.target.value)}
                        aria-invalid={!!err(he.ticker)}
                      />
                      <div className="mt-1.5 flex min-h-[18px] items-center gap-2 text-[12px]">
                        {err(he.ticker) ? (
                          <span className="text-loss">{he.ticker}</span>
                        ) : status?.state === "checking" ? (
                          <span className="text-ink-mute">Checking…</span>
                        ) : status?.state === "valid" ? (
                          <span className="truncate text-ink-3">
                            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-gain align-middle" aria-hidden="true" />
                            {status.name ?? "Found"}
                          </span>
                        ) : status?.state === "invalid" ? (
                          <span className="text-loss">No recent prices found for this symbol</span>
                        ) : null}
                      </div>
                    </div>
                    {sharesMode ? (
                      <>
                        <div>
                          <label className="sr-only" htmlFor={`s-${h.id}`}>Number of shares for holding {i + 1}</label>
                          <input
                            id={`s-${h.id}`}
                            className={`field num px-2.5 text-right ${err(he.shares) ? "field-invalid" : ""}`}
                            value={h.shares}
                            inputMode="decimal"
                            placeholder="0"
                            onChange={(e) => updateHolding(h.id, { shares: e.target.value })}
                            aria-invalid={!!err(he.shares)}
                          />
                          {err(he.shares) && <p className="mt-1 text-right text-[12px] text-loss">{he.shares}</p>}
                        </div>
                        <div>
                          <label className="sr-only" htmlFor={`p-${h.id}`}>Average buy price per share for holding {i + 1}</label>
                          <div className="relative">
                            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-ink-mute">₹</span>
                            <input
                              id={`p-${h.id}`}
                              className={`field num pl-6 pr-2.5 text-right ${err(he.price) ? "field-invalid" : ""}`}
                              value={h.price}
                              inputMode="decimal"
                              placeholder="0.00"
                              onChange={(e) => updateHolding(h.id, { price: e.target.value })}
                              aria-invalid={!!err(he.price)}
                            />
                          </div>
                          {err(he.price) ? (
                            <p className="mt-1 text-right text-[12px] text-loss">{he.price}</p>
                          ) : (
                            <p className="num mt-1.5 text-right text-[12px] text-ink-3">
                              {Number.isFinite(cost) ? `${formatCurrency(cost)} · ${formatPercent(derivedWeights[i], 1)}` : "—"}
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                    <div>
                      <label className="sr-only" htmlFor={`w-${h.id}`}>Weight for holding {i + 1} (percent)</label>
                      <div className="relative">
                        <input
                          id={`w-${h.id}`}
                          className={`field num pr-8 text-right ${err(he.weight) ? "field-invalid" : ""}`}
                          value={h.weight}
                          inputMode="decimal"
                          placeholder="0"
                          onChange={(e) => updateHolding(h.id, { weight: e.target.value })}
                          aria-invalid={!!err(he.weight)}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-mute">%</span>
                      </div>
                      <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-ink/[0.06]" aria-hidden="true">
                        <div
                          className="h-full rounded-full bg-ink/70 transition-[width] duration-500 ease-out"
                          style={{ width: `${Number.isFinite(w) ? Math.min(100, Math.max(0, w)) : 0}%` }}
                        />
                      </div>
                      {err(he.weight) && <p className="mt-1 text-right text-[12px] text-loss">{he.weight}</p>}
                    </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeHolding(h.id)}
                      className="mt-1.5 grid h-9 w-9 place-items-center rounded-full text-ink-mute transition-colors hover:bg-ink/[0.05] hover:text-loss"
                      aria-label={`Remove ${h.ticker || `holding ${i + 1}`}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                        <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  </li>
                );
              })}
              {draft.holdings.length === 0 && (
                <li className="py-10 text-center text-ink-3">No holdings yet. Add one to get started.</li>
              )}
            </ul>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                onClick={addHolding}
                disabled={draft.holdings.length >= MAX_HOLDINGS}
                className="btn-ghost -ml-3 text-accent hover:text-accent disabled:opacity-40"
              >
                <span aria-hidden="true" className="text-lg leading-none">+</span> Add holding
              </button>
              {sharesMode ? (
                <p className="num text-[13px] text-ink-2" aria-live="polite">
                  Total invested <span className="ml-1 text-[15px] font-semibold text-ink">{formatCurrency(validation.totalCost)}</span>
                </p>
              ) : (
              <div className="flex min-w-[220px] flex-1 items-center gap-3 sm:max-w-xs" aria-live="polite">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/[0.07]">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ease-out ${totalOk ? "bg-gain" : total > 100 ? "bg-loss" : "bg-ink/60"}`}
                    style={{ width: `${Math.min(100, total)}%` }}
                  />
                </div>
                <span className={`num whitespace-nowrap text-[13px] font-medium ${totalOk ? "text-gain" : total > 100 ? "text-loss" : "text-ink-2"}`}>
                  {totalOk ? "100% allocated" : total > 100 ? `Over by ${Math.abs(remaining)}%` : `${remaining}% left`}
                </span>
              </div>
              )}
            </div>
            {sharesMode && (
              <p className="mt-3 text-[12px] leading-relaxed text-ink-3">
                Each holding's weight is its cost (shares × buy price) as a share of the total, and the total becomes
                the initial investment. Performance is then measured on market prices from the start date.
              </p>
            )}
          </div>

          {/* Parameters */}
          <div data-reveal data-reveal-delay="0.12" className="space-y-8 lg:border-l lg:border-line lg:pl-12">
            <fieldset>
              <legend className="mb-3 text-[15px] font-semibold">Period</legend>
              <div className="mb-3 flex gap-1.5" role="group" aria-label="Quick period">
                {PERIODS.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setPeriod(y)}
                    aria-pressed={activePeriod === y}
                    className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                      activePeriod === y ? "bg-ink text-paper" : "bg-ink/[0.05] text-ink-2 hover:bg-ink/[0.09]"
                    }`}
                  >
                    {y}Y
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-[12px] text-ink-3">Start</span>
                  <input type="date" className={`field num ${err(validation.fieldErrors.startDate) ? "field-invalid" : ""}`} value={draft.startDate} max={draft.endDate} onChange={(e) => update({ startDate: e.target.value })} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[12px] text-ink-3">End</span>
                  <input type="date" className={`field num ${err(validation.fieldErrors.endDate) ? "field-invalid" : ""}`} value={draft.endDate} max={isoDate(new Date())} onChange={(e) => update({ endDate: e.target.value })} />
                </label>
              </div>
              {(err(validation.fieldErrors.startDate) || err(validation.fieldErrors.endDate)) && (
                <p className="mt-1.5 text-[12px] text-loss">{validation.fieldErrors.startDate ?? validation.fieldErrors.endDate}</p>
              )}
            </fieldset>

            <label className="block">
              <span className="mb-3 block text-[15px] font-semibold">Benchmark</span>
              <select
                className="field cursor-pointer appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22><path d=%22M2 4l4 4 4-4%22 stroke=%22%236b6963%22 fill=%22none%22 stroke-width=%221.5%22/></svg>')] bg-[right_12px_center] bg-no-repeat pr-9"
                value={customBench ? CUSTOM : draft.benchmark}
                onChange={(e) => {
                  if (e.target.value === CUSTOM) {
                    setCustomBench(true);
                    update({ benchmark: "" });
                  } else {
                    setCustomBench(false);
                    update({ benchmark: e.target.value });
                  }
                }}
              >
                {benchmarks.map((b) => (
                  <option key={b.ticker} value={b.ticker}>
                    {b.name} · {b.ticker}
                  </option>
                ))}
                <option value={CUSTOM}>Custom symbol…</option>
              </select>
              {customBench && (
                <input
                  className={`field mt-2 uppercase ${err(validation.fieldErrors.benchmark) ? "field-invalid" : ""}`}
                  placeholder="e.g. ^NSMIDCP or NIFTYBEES.NS"
                  value={draft.benchmark}
                  onChange={(e) => update({ benchmark: e.target.value.toUpperCase() })}
                  autoFocus
                />
              )}
              {err(validation.fieldErrors.benchmark) && <p className="mt-1.5 text-[12px] text-loss">{validation.fieldErrors.benchmark}</p>}
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-3 block text-[15px] font-semibold">Initial amount</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute">₹</span>
                  <input
                    className={`field num pl-7 ${err(validation.fieldErrors.initialInvestment) ? "field-invalid" : ""} ${
                      sharesMode ? "cursor-not-allowed bg-ink/[0.03] text-ink-3 hover:border-line" : ""
                    }`}
                    inputMode="decimal"
                    value={sharesMode ? (validation.totalCost > 0 ? Math.round(validation.totalCost).toLocaleString("en-IN") : "—") : draft.initialInvestment}
                    readOnly={sharesMode}
                    title={sharesMode ? "Calculated from shares × buy price" : undefined}
                    onChange={(e) => update({ initialInvestment: e.target.value })}
                  />
                </div>
                {err(validation.fieldErrors.initialInvestment) && <p className="mt-1.5 text-[12px] text-loss">{validation.fieldErrors.initialInvestment}</p>}
              </label>
              <label className="block">
                <span className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
                  Risk-free rate
                  <InfoTip label="risk-free rate" align="right">
                    Used only in the Sharpe ratio. 6.5% is a default assumption approximating recent Indian government
                    bond yields — it is not a live rate. Change it to match your view.
                  </InfoTip>
                </span>
                <div className="relative">
                  <input
                    className={`field num pr-8 ${err(validation.fieldErrors.riskFreeRate) ? "field-invalid" : ""}`}
                    inputMode="decimal"
                    value={draft.riskFreeRate}
                    onChange={(e) => update({ riskFreeRate: e.target.value })}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-mute">%</span>
                </div>
                {err(validation.fieldErrors.riskFreeRate) && <p className="mt-1.5 text-[12px] text-loss">{validation.fieldErrors.riskFreeRate}</p>}
              </label>
            </div>

            <div className="pt-2">
              {showErrors && validation.formErrors.length > 0 && (
                <div role="alert" className="mb-4 rounded-lg border border-loss/20 bg-loss/[0.04] px-4 py-3 text-[13px] text-loss">
                  {validation.formErrors.map((m) => (
                    <p key={m}>{m}</p>
                  ))}
                </div>
              )}
              <button type="submit" className="btn-primary w-full py-3.5 text-base" disabled={busy}>
                {busy ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-paper/30 border-t-paper" aria-hidden="true" />
                    Analyzing…
                  </>
                ) : (
                  <>Analyze portfolio</>
                )}
              </button>
              <p className="mt-3 text-center text-[12px] leading-relaxed text-ink-3">
                Uses historical adjusted prices from Yahoo Finance. Descriptive analytics only — not investment advice.
              </p>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
