/** Types mirroring backend/app/schemas/markets.py. Percentages are fractions unless named *_pct. */

export interface Company {
  name: string;
  isin: string;
  nse_symbol: string | null;
  bse_code: string | null;
  bse_symbol: string | null;
  industry: string | null;
  ticker: string; // Yahoo symbol, e.g. RELIANCE.NS or 3BFILMS.BO
  exchanges: ("NSE" | "BSE")[];
}

export interface ListingsMeta {
  generated: string;
  counts: { total: number; nse: number; bse: number; both: number };
  industries: string[];
}

export interface CompanyPage {
  total: number;
  offset: number;
  limit: number;
  items: Company[];
}

export interface Quote {
  ticker: string;
  price: number;
  previous_close: number | null;
  change: number | null;
  change_pct: number | null;
  time: string;
  intraday: boolean;
}

export interface NamedQuote extends Quote {
  name: string;
}

export interface StockStats {
  market_cap: number | null;
  pe_ratio: number | null;
  price_to_book: number | null;
  beta: number | null;
  dividend_yield_pct: number | null;
  week52_high: number | null;
  week52_low: number | null;
  day_high: number | null;
  day_low: number | null;
  volume: number | null;
  avg_volume: number | null;
}

export interface StockDetail {
  ticker: string;
  name: string;
  company: Company | null;
  quote: Quote | null;
  currency: string | null;
  sector: string | null;
  industry: string | null;
  website: string | null;
  description: string | null;
  employees: number | null;
  location: string | null;
  stats: StockStats;
}

export type HistoryRange = "1d" | "5d" | "1m" | "6m" | "1y" | "5y" | "max";

export interface StockHistory {
  ticker: string;
  range: HistoryRange;
  intraday: boolean;
  points: { t: string; p: number }[];
}

export interface MarketOverview {
  as_of: string | null;
  indices: NamedQuote[];
  gainers: NamedQuote[];
  losers: NamedQuote[];
  universe: string;
}
