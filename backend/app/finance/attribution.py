"""Holding-level contribution analysis."""

from __future__ import annotations

from collections.abc import Mapping


def contribution(initial_weight: float, holding_total_return: float) -> float:
    """Contribution = initial weight x holding total return.

    Example: a 40% position that returned +25% contributes 0.40 * 0.25 = 0.10,
    i.e. +10 percentage points.

    This is a simple attribution under the initial-weight convention. It is
    exact for a buy-and-hold portfolio's total return, but this app's
    portfolio is rebalanced daily, so the contributions will not in general
    sum exactly to the reported portfolio total return (and they are not a
    decomposition of CAGR). The UI and docs say so explicitly.
    """
    return float(initial_weight * holding_total_return)


def contributions(weights: Mapping[str, float], holding_returns: Mapping[str, float]) -> dict[str, float]:
    """Contribution for every holding, keyed by ticker."""
    missing = set(weights) - set(holding_returns)
    if missing:
        raise KeyError(f"No total return for: {', '.join(sorted(missing))}")
    return {t: contribution(w, holding_returns[t]) for t, w in weights.items()}
