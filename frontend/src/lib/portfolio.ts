/**
 * Client-side portfolio form model and validation.
 *
 * The backend re-validates everything (it is the source of truth); this layer
 * exists to give instant, field-level feedback while the user types.
 */
import type { AnalyzeRequest } from "../types/api";

/**
 * Two ways to describe a portfolio:
 * - "weights": target allocation percentages plus a separate initial amount.
 * - "shares":  number of shares and the average buy price per share. Each
 *   holding's cost (shares × price) sets its weight, and the total cost
 *   becomes the initial investment.
 */
export type InputMode = "weights" | "shares";

export interface HoldingDraft {
  id: string;
  ticker: string;
  weight: string; // percentage as typed, e.g. "40" (weights mode)
  shares: string; // number of shares (shares mode)
  price: string; // average buy price per share (shares mode)
}

export interface PortfolioDraft {
  mode: InputMode;
  holdings: HoldingDraft[];
  startDate: string;
  endDate: string;
  benchmark: string;
  initialInvestment: string;
  riskFreeRate: string; // percentage, e.g. "6.5"
}

export interface ValidationResult {
  valid: boolean;
  formErrors: string[];
  holdingErrors: Record<string, HoldingErrors>;
  fieldErrors: Partial<Record<"startDate" | "endDate" | "benchmark" | "initialInvestment" | "riskFreeRate", string>>;
  totalWeight: number;
  /** Shares mode: sum of shares × price over valid rows (0 in weights mode). */
  totalCost: number;
}

export interface HoldingErrors {
  ticker?: string;
  weight?: string;
  shares?: string;
  price?: string;
}

/** Same tolerance as the backend: 0.01 percentage points. */
export const WEIGHT_TOLERANCE_PCT = 0.01;
export const MAX_HOLDINGS = 25;
const TICKER_RE = /^[A-Z0-9^][A-Z0-9.\-=&^]{0,19}$/;
const MIN_PERIOD_DAYS = 30;

let counter = 0;
export const newId = () => `h${Date.now().toString(36)}${(counter++).toString(36)}`;

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function defaultDraft(today = new Date()): PortfolioDraft {
  const start = new Date(Date.UTC(today.getUTCFullYear() - 5, today.getUTCMonth(), today.getUTCDate()));
  return {
    mode: "weights",
    holdings: [
      { id: newId(), ticker: "RELIANCE.NS", weight: "40", shares: "", price: "" },
      { id: newId(), ticker: "TCS.NS", weight: "30", shares: "", price: "" },
      { id: newId(), ticker: "INFY.NS", weight: "30", shares: "", price: "" },
    ],
    startDate: isoDate(start),
    endDate: isoDate(today),
    benchmark: "^NSEI",
    initialInvestment: "100000",
    riskFreeRate: "6.5",
  };
}

export function parseNumber(text: string): number {
  const cleaned = text.replace(/[,\s₹%]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return NaN;
  return Number(cleaned);
}

export function totalWeight(holdings: HoldingDraft[]): number {
  return holdings.reduce((sum, h) => {
    const w = parseNumber(h.weight);
    return sum + (Number.isFinite(w) ? w : 0);
  }, 0);
}

/** Cost of one holding (shares × buy price), or NaN if either input is not a positive number. */
export function holdingCost(h: HoldingDraft): number {
  const s = parseNumber(h.shares);
  const p = parseNumber(h.price);
  return Number.isFinite(s) && Number.isFinite(p) && s > 0 && p > 0 ? s * p : NaN;
}

export function totalCost(holdings: HoldingDraft[]): number {
  return holdings.reduce((sum, h) => {
    const c = holdingCost(h);
    return sum + (Number.isFinite(c) ? c : 0);
  }, 0);
}

/** Shares mode: each holding's share of total cost, as a fraction (0 for invalid rows). */
export function costWeights(holdings: HoldingDraft[]): number[] {
  const total = totalCost(holdings);
  return holdings.map((h) => {
    const c = holdingCost(h);
    return total > 0 && Number.isFinite(c) ? c / total : 0;
  });
}

export function validateDraft(draft: PortfolioDraft, today = new Date()): ValidationResult {
  const sharesMode = draft.mode === "shares";
  const holdingErrors: ValidationResult["holdingErrors"] = {};
  const fieldErrors: ValidationResult["fieldErrors"] = {};
  const formErrors: string[] = [];

  if (draft.holdings.length === 0) formErrors.push("Add at least one holding.");
  if (draft.holdings.length > MAX_HOLDINGS) formErrors.push(`Use at most ${MAX_HOLDINGS} holdings.`);

  const seen = new Map<string, number>();
  for (const h of draft.holdings) {
    const t = h.ticker.trim().toUpperCase();
    seen.set(t, (seen.get(t) ?? 0) + 1);
  }
  for (const h of draft.holdings) {
    const errs: HoldingErrors = {};
    const t = h.ticker.trim().toUpperCase();
    if (!t) errs.ticker = "Enter a ticker";
    else if (!TICKER_RE.test(t)) errs.ticker = "Not a valid symbol";
    else if ((seen.get(t) ?? 0) > 1) errs.ticker = "Duplicate ticker";
    if (sharesMode) {
      const s = parseNumber(h.shares);
      if (!Number.isFinite(s)) errs.shares = "Enter shares";
      else if (s <= 0) errs.shares = "Must be above 0";
      const p = parseNumber(h.price);
      if (!Number.isFinite(p)) errs.price = "Enter a price";
      else if (p <= 0) errs.price = "Must be above 0";
    } else {
      const w = parseNumber(h.weight);
      if (!Number.isFinite(w)) errs.weight = "Enter a weight";
      else if (w <= 0) errs.weight = "Must be above 0";
      else if (w > 100) errs.weight = "Max 100";
    }
    if (Object.keys(errs).length) holdingErrors[h.id] = errs;
  }

  const total = sharesMode ? 100 : totalWeight(draft.holdings);
  const cost = sharesMode ? totalCost(draft.holdings) : 0;
  if (!sharesMode && draft.holdings.length && Math.abs(total - 100) > WEIGHT_TOLERANCE_PCT) {
    formErrors.push(`Weights must total 100%. Currently ${round2(total)}%.`);
  }

  const start = draft.startDate ? new Date(`${draft.startDate}T00:00:00Z`) : null;
  const end = draft.endDate ? new Date(`${draft.endDate}T00:00:00Z`) : null;
  const todayIso = isoDate(today);
  if (!start || isNaN(start.getTime())) fieldErrors.startDate = "Choose a start date";
  else if (draft.startDate < "1990-01-01") fieldErrors.startDate = "On or after 1990";
  if (!end || isNaN(end.getTime())) fieldErrors.endDate = "Choose an end date";
  else if (draft.endDate > todayIso) fieldErrors.endDate = "Can't be in the future";
  if (start && end && !fieldErrors.startDate && !fieldErrors.endDate) {
    const days = (end.getTime() - start.getTime()) / 86_400_000;
    if (days < MIN_PERIOD_DAYS) fieldErrors.endDate = `At least ${MIN_PERIOD_DAYS} days after start`;
  }

  const bench = draft.benchmark.trim().toUpperCase();
  if (!bench || !TICKER_RE.test(bench)) fieldErrors.benchmark = "Choose a benchmark";

  if (!sharesMode) {
    const inv = parseNumber(draft.initialInvestment);
    if (!Number.isFinite(inv) || inv <= 0) fieldErrors.initialInvestment = "Enter an amount above 0";
  }

  const rf = parseNumber(draft.riskFreeRate);
  if (!Number.isFinite(rf)) fieldErrors.riskFreeRate = "Enter a rate";
  else if (rf < -5 || rf > 50) fieldErrors.riskFreeRate = "Between −5% and 50%";

  const valid =
    formErrors.length === 0 && Object.keys(holdingErrors).length === 0 && Object.keys(fieldErrors).length === 0;
  return { valid, formErrors, holdingErrors, fieldErrors, totalWeight: total, totalCost: cost };
}

/**
 * Convert a validated draft (percentages, strings) into the API payload (fractions, numbers).
 * In shares mode, weights are each holding's share of total cost and the
 * initial investment is the total cost, so the API contract is unchanged.
 */
export function toRequest(draft: PortfolioDraft): AnalyzeRequest {
  const tickers = draft.holdings.map((h) => h.ticker.trim().toUpperCase());
  const sharesMode = draft.mode === "shares";
  const weights = sharesMode ? costWeights(draft.holdings) : draft.holdings.map((h) => parseNumber(h.weight) / 100);
  return {
    holdings: tickers.map((ticker, i) => ({ ticker, weight: weights[i] })),
    start_date: draft.startDate,
    end_date: draft.endDate,
    benchmark: draft.benchmark.trim().toUpperCase(),
    initial_investment: sharesMode ? totalCost(draft.holdings) : parseNumber(draft.initialInvestment),
    risk_free_rate: parseNumber(draft.riskFreeRate) / 100,
  };
}

/**
 * Switch input mode, carrying information across where possible: going from
 * shares to weights fills each weight with its cost share and the initial
 * amount with total cost (rounded to 2 dp, residue on the last row).
 */
export function switchMode(draft: PortfolioDraft, mode: InputMode): PortfolioDraft {
  if (mode === draft.mode) return draft;
  if (mode === "weights") {
    const cost = totalCost(draft.holdings);
    if (cost > 0) {
      const pct = costWeights(draft.holdings).map((w) => round2(w * 100));
      const last = pct.length - 1;
      if (last >= 0) pct[last] = round2(100 - pct.slice(0, last).reduce((s, w) => s + w, 0));
      return {
        ...draft,
        mode,
        initialInvestment: String(round2(cost)),
        holdings: draft.holdings.map((h, i) => ({ ...h, weight: String(pct[i]) })),
      };
    }
  }
  return { ...draft, mode };
}

/** Split 100% equally, putting rounding residue on the last holding so it sums exactly. */
export function equalWeights(count: number): string[] {
  if (count <= 0) return [];
  const base = Math.floor((100 / count) * 100) / 100;
  const out = Array.from({ length: count }, () => base);
  out[count - 1] = round2(100 - base * (count - 1));
  return out.map((w) => String(w));
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
