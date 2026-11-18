"""Descriptive, rule-based observations about a completed analysis.

Every sentence is derived directly from numbers already computed elsewhere.
There are no forecasts, scores, or recommendations: the wording deliberately
describes what HAPPENED over the selected window, never what will happen.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class HoldingStat:
    ticker: str
    name: str | None
    total_return: float
    contribution: float


@dataclass(frozen=True)
class SideStats:
    total_return: float
    cagr: float
    volatility: float
    sharpe: float | None
    max_drawdown: float


def _pct(x: float, digits: int = 1, signed: bool = True) -> str:
    sign = "+" if signed and x > 0 else ""
    return f"{sign}{x * 100:.{digits}f}%"


def _pp(x: float) -> str:
    sign = "+" if x > 0 else ""
    return f"{sign}{x * 100:.1f} pp"


def _label(h: HoldingStat) -> str:
    return f"{h.name} ({h.ticker})" if h.name else h.ticker


def generate_insights(
    holdings: list[HoldingStat],
    portfolio: SideStats,
    benchmark: SideStats,
    benchmark_label: str,
    beta: float | None,
    peak_date: date | None,
    trough_date: date | None,
    recovery_date: date | None,
) -> list[dict]:
    insights: list[dict] = []

    # 1. Relative performance
    diff = portfolio.total_return - benchmark.total_return
    cagr_diff = portfolio.cagr - benchmark.cagr
    if abs(diff) < 1e-9:
        insights.append(dict(id="relative", tone="neutral", title=f"Matched the {benchmark_label}",
                             detail=f"Both returned {_pct(portfolio.total_return)} over the period."))
    else:
        verb = "outperformed" if diff > 0 else "underperformed"
        insights.append(dict(
            id="relative", tone="positive" if diff > 0 else "negative",
            title=f"{verb.capitalize()} the {benchmark_label} by {_pp(abs(diff)).lstrip('+')}",
            detail=(f"The portfolio returned {_pct(portfolio.total_return)} against "
                    f"{_pct(benchmark.total_return)} for the benchmark, a CAGR difference of "
                    f"{_pp(cagr_diff)} per year."),
        ))

    # 2-4. Holding-level
    if holdings:
        best = max(holdings, key=lambda h: h.total_return)
        insights.append(dict(id="best", tone="positive" if best.total_return >= 0 else "neutral",
                             title=f"Best performer: {best.ticker}",
                             detail=f"{_label(best)} returned {_pct(best.total_return)} over the period."))
        if len(holdings) > 1:
            worst = min(holdings, key=lambda h: h.total_return)
            insights.append(dict(id="worst", tone="negative" if worst.total_return < 0 else "neutral",
                                 title=f"Weakest performer: {worst.ticker}",
                                 detail=f"{_label(worst)} returned {_pct(worst.total_return)} over the period."))
            top = max(holdings, key=lambda h: h.contribution)
            insights.append(dict(
                id="contributor", tone="positive" if top.contribution > 0 else "neutral",
                title=f"Largest contributor: {top.ticker}",
                detail=(f"At its initial weight, {top.ticker} accounts for {_pp(top.contribution)} "
                        "of return (weight x holding return)."),
            ))

    # 5. Volatility vs benchmark
    if benchmark.volatility > 0:
        ratio = portfolio.volatility / benchmark.volatility
        if abs(ratio - 1) < 0.05:
            vol_title = "Volatility in line with the benchmark"
        elif ratio > 1:
            vol_title = f"{(ratio - 1) * 100:.0f}% more volatile than the benchmark"
        else:
            vol_title = f"{(1 - ratio) * 100:.0f}% less volatile than the benchmark"
        insights.append(dict(
            id="volatility", tone="neutral", title=vol_title,
            detail=(f"Annualised volatility was {_pct(portfolio.volatility, signed=False)} versus "
                    f"{_pct(benchmark.volatility, signed=False)} for the {benchmark_label}."),
        ))

    # 6. Drawdown
    if portfolio.max_drawdown < 0 and peak_date and trough_date:
        recovery = (f"It regained its previous peak on {recovery_date:%d %b %Y}."
                    if recovery_date else "It had not regained that peak by the end of the period.")
        insights.append(dict(
            id="drawdown", tone="negative",
            title=f"Deepest decline: {_pct(portfolio.max_drawdown)}",
            detail=(f"From its peak on {peak_date:%d %b %Y} the portfolio fell to a low on "
                    f"{trough_date:%d %b %Y}. {recovery} The benchmark's maximum drawdown was "
                    f"{_pct(benchmark.max_drawdown)}."),
        ))

    # 7. Beta (descriptive sensitivity)
    if beta is not None:
        insights.append(dict(
            id="beta", tone="neutral", title=f"Beta of {beta:.2f}",
            detail=(f"On average, the portfolio moved about {beta:.2f}% for each 1% daily move in the "
                    f"{benchmark_label} during this period. This is a historical sensitivity, not a forecast."),
        ))

    return insights
