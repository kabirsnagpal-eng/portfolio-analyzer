/**
 * Types mirroring the backend's Pydantic schemas (backend/app/schemas/portfolio.py).
 * All rates, weights and returns are decimal fractions (0.4 = 40%).
 */

export interface HoldingInput {
  ticker: string;
  weight: number;
}

export interface AnalyzeRequest {
  holdings: HoldingInput[];
  start_date: string; // YYYY-MM-DD
  end_date: string;
  benchmark: string;
  initial_investment: number;
  risk_free_rate: number;
}

export interface MetricSet {
  total_return: number;
  cagr: number;
  annualized_volatility: number;
  sharpe_ratio: number | null;
  max_drawdown: number;
  beta: number | null;
}

export interface DrawdownInfo {
  max_drawdown: number;
  peak_date: string | null;
  trough_date: string | null;
  recovery_date: string | null;
  peak_to_trough_days: number | null;
}

export interface SeriesPoint {
  date: string;
  portfolio: number;
  benchmark: number;
  portfolio_value: number;
  portfolio_drawdown: number;
  benchmark_drawdown: number;
}

export interface HoldingResult {
  ticker: string;
  name: string | null;
  weight: number;
  start_price: number;
  end_price: number;
  total_return: number;
  contribution: number;
}

export interface Insight {
  id: string;
  title: string;
  detail: string;
  tone: "positive" | "negative" | "neutral";
}

export interface DataQuality {
  status: "complete" | "adjusted" | "incomplete";
  warnings: string[];
  filled_points: Record<string, number>;
  dropped_rows: number;
}

export interface AnalysisMeta {
  requested_start: string;
  requested_end: string;
  start_date: string;
  end_date: string;
  trading_days: number;
  years: number;
  benchmark: string;
  benchmark_name: string | null;
  initial_investment: number;
  risk_free_rate: number;
  rebalancing: "daily";
  price_basis: "adjusted_close";
}

export interface Summary {
  initial_value: number;
  ending_value: number;
  profit_loss: number;
  total_return: number;
  cagr: number;
  benchmark_ending_value: number;
}

export interface AnalyzeResponse {
  meta: AnalysisMeta;
  summary: Summary;
  portfolio: MetricSet;
  benchmark: MetricSet;
  drawdown: DrawdownInfo;
  series: SeriesPoint[];
  holdings: HoldingResult[];
  insights: Insight[];
  data_quality: DataQuality;
}

export interface Benchmark {
  ticker: string;
  name: string;
  region: string;
}

export interface TickerCheck {
  ticker: string;
  valid: boolean;
  name: string | null;
  last_price: number | null;
  last_date: string | null;
}

export interface ApiErrorBody {
  error: string;
  message: string;
  details?: unknown;
}
