/**
 * Shareable analysis links and CSV export.
 *
 * A link encodes the analysis inputs (never results) in the URL, so whoever
 * opens it re-runs the same analysis on current data:
 *   /analyze?h=RELIANCE.NS:40,TCS.NS:30,INFY.NS:30&start=2021-11-26&end=2026-11-26&b=^NSEI&amt=100000&rf=6.5&run=1
 */
import type { AnalyzeRequest, AnalyzeResponse } from "../types/api";
import { defaultDraft, newId, type PortfolioDraft } from "./portfolio";

const round = (x: number, dp: number) => Math.round(x * 10 ** dp) / 10 ** dp;

export function requestToQuery(req: AnalyzeRequest): string {
  const qs = new URLSearchParams();
  qs.set("h", req.holdings.map((h) => `${h.ticker}:${round(h.weight * 100, 4)}`).join(","));
  qs.set("start", req.start_date);
  qs.set("end", req.end_date);
  qs.set("b", req.benchmark);
  qs.set("amt", String(round(req.initial_investment, 2)));
  qs.set("rf", String(round(req.risk_free_rate * 100, 4)));
  qs.set("run", "1");
  return qs.toString();
}

export interface ParsedLink {
  draft: PortfolioDraft;
  autoRun: boolean;
}

/** Build a form draft from URL params. Unknown or malformed params fall back to defaults. */
export function queryToDraft(params: URLSearchParams, today = new Date()): ParsedLink | null {
  const h = params.get("h");
  const add = params.get("add");
  if (!h && !add) return null;
  const draft = defaultDraft(today);
  if (h) {
    const holdings = h
      .split(",")
      .map((part) => part.split(":"))
      .filter(([t, w]) => t && w && Number.isFinite(Number(w)))
      .slice(0, 25)
      .map(([t, w]) => ({ id: newId(), ticker: t.trim().toUpperCase(), weight: String(Number(w)), shares: "", price: "" }));
    if (holdings.length) draft.holdings = holdings;
  } else if (add) {
    draft.holdings = [{ id: newId(), ticker: add.trim().toUpperCase(), weight: "100", shares: "", price: "" }];
  }
  const date = /^\d{4}-\d{2}-\d{2}$/;
  const start = params.get("start");
  const end = params.get("end");
  if (start && date.test(start)) draft.startDate = start;
  if (end && date.test(end)) draft.endDate = end;
  if (params.get("b")) draft.benchmark = params.get("b")!.toUpperCase();
  if (params.get("amt")) draft.initialInvestment = params.get("amt")!;
  if (params.get("rf")) draft.riskFreeRate = params.get("rf")!;
  return { draft, autoRun: params.get("run") === "1" };
}

const csvCell = (v: string | number | null) => {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Holdings table + daily series as one CSV (two sections), ready for Excel or Google Sheets. */
export function analysisToCsv(data: AnalyzeResponse): string {
  const rows: (string | number | null)[][] = [
    ["Folio analysis", `${data.meta.start_date} to ${data.meta.end_date}`],
    ["Benchmark", data.meta.benchmark_name ?? data.meta.benchmark],
    ["Initial investment", data.summary.initial_value],
    ["Ending value", round(data.summary.ending_value, 2)],
    ["Total return %", round(data.portfolio.total_return * 100, 4)],
    ["CAGR %", round(data.portfolio.cagr * 100, 4)],
    ["Annualised volatility %", round(data.portfolio.annualized_volatility * 100, 4)],
    ["Sharpe ratio", data.portfolio.sharpe_ratio === null ? null : round(data.portfolio.sharpe_ratio, 4)],
    ["Max drawdown %", round(data.portfolio.max_drawdown * 100, 4)],
    ["Beta", data.portfolio.beta === null ? null : round(data.portfolio.beta, 4)],
    [],
    ["Ticker", "Name", "Weight %", "Start price", "End price", "Return %", "Contribution pp"],
    ...data.holdings.map((h) => [
      h.ticker,
      h.name,
      round(h.weight * 100, 4),
      round(h.start_price, 4),
      round(h.end_price, 4),
      round(h.total_return * 100, 4),
      round(h.contribution * 100, 4),
    ]),
    [],
    ["Date", "Portfolio (rebased 100)", "Benchmark (rebased 100)", "Portfolio value", "Portfolio drawdown %"],
    ...data.series.map((p) => [p.date, p.portfolio, p.benchmark, p.portfolio_value, round(p.portfolio_drawdown * 100, 4)]),
  ];
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob(["﻿" + text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
