"""Orchestrates one portfolio analysis: fetch -> clean -> compute -> assemble.

This is the only module that knows about both the data layer and the finance
layer. It contains no formulas of its own; every number comes from a function
in ``app.finance``.
"""

from __future__ import annotations

import pandas as pd

from app.data.cleaning import InsufficientDataError, align_prices
from app.data.market_data import PriceProvider
from app.finance import metrics as m
from app.finance.attribution import contributions
from app.finance.insights import HoldingStat, SideStats, generate_insights
from app.finance.returns import (
    daily_returns,
    normalize_weights,
    portfolio_daily_returns,
    rebase,
    total_return,
    value_series,
)
from app.schemas.portfolio import (
    AnalysisMeta,
    AnalyzeRequest,
    AnalyzeResponse,
    DataQuality,
    DrawdownInfo,
    HoldingResult,
    Insight,
    MetricSet,
    SeriesPoint,
    Summary,
)


def _market_of(ticker: str) -> str:
    if ticker.startswith("^"):
        return "index"
    return ticker.rsplit(".", 1)[1] if "." in ticker else "US"


def _side_metrics(values: pd.Series, returns: pd.Series, rf: float, beta: float | None) -> MetricSet:
    cagr = m.cagr_from_values(values)
    vol = m.annualized_volatility(returns)
    return MetricSet(
        total_return=total_return(values),
        cagr=cagr,
        annualized_volatility=vol,
        # Sharpe uses CAGR as the annualised return (see FINANCIAL_METHODOLOGY.md).
        sharpe_ratio=m.sharpe_ratio(cagr, vol, rf),
        max_drawdown=m.max_drawdown(values).max_drawdown,
        beta=beta,
    )


def run_analysis(req: AnalyzeRequest, provider: PriceProvider) -> AnalyzeResponse:
    tickers = [h.ticker for h in req.holdings]
    weights = normalize_weights({h.ticker: h.weight for h in req.holdings}).to_dict()
    bench = req.benchmark
    needed = list(dict.fromkeys(tickers + [bench]))  # unique, order preserved

    raw = provider.get_prices(needed, req.start_date, req.end_date)
    aligned, quality = align_prices({t: raw[t] for t in needed})

    prices = aligned[tickers]
    bench_prices = aligned[bench]
    base_date = aligned.index[0]

    asset_rets = daily_returns(prices)
    port_rets = portfolio_daily_returns(asset_rets, weights)
    bench_rets = daily_returns(bench_prices)
    bench_rets.name = "benchmark"
    if len(port_rets) < 2:
        raise InsufficientDataError("Not enough trading days in this period to compute risk metrics.")

    port_values = value_series(port_rets, req.initial_investment, base_date)
    bench_values = value_series(bench_rets, req.initial_investment, base_date)

    port_beta = m.beta(port_rets, bench_rets)
    port_metrics = _side_metrics(port_values, port_rets, req.risk_free_rate, port_beta)
    bench_metrics = _side_metrics(bench_values, bench_rets, req.risk_free_rate, 1.0)
    episode = m.max_drawdown(port_values)

    # Holdings
    holding_returns = {t: float(prices[t].iloc[-1] / prices[t].iloc[0] - 1) for t in tickers}
    contrib = contributions(weights, holding_returns)
    names = provider.get_names(needed)
    holdings = [
        HoldingResult(
            ticker=t,
            name=names.get(t),
            weight=weights[t],
            start_price=float(prices[t].iloc[0]),
            end_price=float(prices[t].iloc[-1]),
            total_return=holding_returns[t],
            contribution=contrib[t],
        )
        for t in tickers
    ]

    # Chart series
    port_rebased = rebase(port_values)
    bench_rebased = rebase(bench_values)
    port_dd = m.drawdown_series(port_values)
    bench_dd = m.drawdown_series(bench_values)
    series = [
        SeriesPoint(
            date=d.date(),
            portfolio=round(float(port_rebased[d]), 6),
            benchmark=round(float(bench_rebased[d]), 6),
            portfolio_value=round(float(port_values[d]), 4),
            portfolio_drawdown=round(float(port_dd[d]), 6),
            benchmark_drawdown=round(float(bench_dd[d]), 6),
        )
        for d in port_values.index
    ]

    # Data-quality notes that are about interpretation rather than cleaning
    markets = {_market_of(t) for t in tickers}
    if len(markets) > 1:
        quality.warnings.append(
            "Holdings trade on different exchanges. Each security's return is measured in its own "
            "trading currency; no currency conversion is applied."
        )

    bench_label = names.get(bench) or bench
    insights = generate_insights(
        holdings=[HoldingStat(h.ticker, h.name, h.total_return, h.contribution) for h in holdings],
        portfolio=SideStats(port_metrics.total_return, port_metrics.cagr, port_metrics.annualized_volatility,
                            port_metrics.sharpe_ratio, port_metrics.max_drawdown),
        benchmark=SideStats(bench_metrics.total_return, bench_metrics.cagr, bench_metrics.annualized_volatility,
                            bench_metrics.sharpe_ratio, bench_metrics.max_drawdown),
        benchmark_label=bench_label,
        beta=port_beta,
        peak_date=episode.peak_date.date() if episode.peak_date is not None else None,
        trough_date=episode.trough_date.date() if episode.trough_date is not None else None,
        recovery_date=episode.recovery_date.date() if episode.recovery_date is not None else None,
    )

    ending = float(port_values.iloc[-1])
    return AnalyzeResponse(
        meta=AnalysisMeta(
            requested_start=req.start_date,
            requested_end=req.end_date,
            start_date=port_values.index[0].date(),
            end_date=port_values.index[-1].date(),
            trading_days=len(port_values),
            years=m.years_between(port_values.index[0], port_values.index[-1]),
            benchmark=bench,
            benchmark_name=names.get(bench),
            initial_investment=req.initial_investment,
            risk_free_rate=req.risk_free_rate,
        ),
        summary=Summary(
            initial_value=req.initial_investment,
            ending_value=ending,
            profit_loss=ending - req.initial_investment,
            total_return=port_metrics.total_return,
            cagr=port_metrics.cagr,
            benchmark_ending_value=float(bench_values.iloc[-1]),
        ),
        portfolio=port_metrics,
        benchmark=bench_metrics,
        drawdown=DrawdownInfo(
            max_drawdown=episode.max_drawdown,
            peak_date=episode.peak_date.date() if episode.peak_date is not None else None,
            trough_date=episode.trough_date.date() if episode.trough_date is not None else None,
            recovery_date=episode.recovery_date.date() if episode.recovery_date is not None else None,
            peak_to_trough_days=episode.peak_to_trough_days,
        ),
        series=series,
        holdings=holdings,
        insights=[Insight(**i) for i in insights],
        data_quality=DataQuality(
            status=quality.status,
            warnings=quality.warnings,
            filled_points=quality.filled_points,
            dropped_rows=quality.dropped_rows,
        ),
    )
