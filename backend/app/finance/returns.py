"""Return calculations.

Every function here is pure: it takes pandas/NumPy data and returns new data
without touching the network, the filesystem, or global state. That makes each
one independently testable with small synthetic price series.
"""

from __future__ import annotations

from collections.abc import Mapping

import numpy as np
import pandas as pd


def daily_returns(prices: pd.DataFrame | pd.Series) -> pd.DataFrame | pd.Series:
    """Simple (arithmetic) daily returns.

    r_t = P_t / P_{t-1} - 1

    The first observation has no previous price, so it is dropped rather than
    reported as 0% (a fabricated return). Any remaining NaN is left in place so
    callers can decide how to treat it; the analysis pipeline guarantees that
    prices are gap-free before calling this.
    """
    if len(prices) < 2:
        raise ValueError("At least two prices are required to compute a return.")
    if (prices.dropna() <= 0).to_numpy().any():
        raise ValueError("Prices must be strictly positive to compute returns.")
    returns = prices / prices.shift(1) - 1.0
    return returns.iloc[1:]


def normalize_weights(weights: Mapping[str, float]) -> pd.Series:
    """Return weights as a Series that sums to exactly 1.0.

    Input is expected to already be validated to sum to ~1 (see
    ``validate_weights``); this only removes floating-point residue such as
    0.30000000000000004 so the arithmetic below is exact.
    """
    series = pd.Series(dict(weights), dtype=float)
    total = series.sum()
    if total <= 0:
        raise ValueError("Weights must sum to a positive number.")
    return series / total


def portfolio_daily_returns(
    asset_returns: pd.DataFrame, weights: Mapping[str, float]
) -> pd.Series:
    """Weighted portfolio return under DAILY REBALANCING.

    R_p,t = sum_i( w_i * r_i,t )

    Using the same target weights every day is equivalent to rebalancing back
    to those weights at each close. A buy-and-hold portfolio would instead let
    weights drift with prices; that is a different (and also valid) model, but
    it is not what this function computes. See docs/FINANCIAL_METHODOLOGY.md.
    """
    w = normalize_weights(weights)
    missing = [t for t in w.index if t not in asset_returns.columns]
    if missing:
        raise KeyError(f"No return series for: {', '.join(missing)}")
    aligned = asset_returns[w.index]
    if aligned.isna().to_numpy().any():
        raise ValueError("Asset returns contain gaps; clean and align prices first.")
    return pd.Series(aligned.to_numpy() @ w.to_numpy(), index=aligned.index, name="portfolio")


def value_series(returns: pd.Series, initial_value: float, start_date: pd.Timestamp | None = None) -> pd.Series:
    """Compound a return series into a value path.

    V_0 = initial_value,  V_t = V_{t-1} * (1 + r_t)

    If ``start_date`` is given, V_0 is placed on that date (the base date whose
    price the first return is measured from), so the series covers the full
    analysis window including the starting point.
    """
    if initial_value <= 0:
        raise ValueError("Initial value must be positive.")
    growth = (1.0 + returns).cumprod() * initial_value
    if start_date is not None:
        base = pd.Series([float(initial_value)], index=pd.DatetimeIndex([start_date]))
        growth = pd.concat([base, growth])
    growth.name = returns.name
    return growth


def rebase(values: pd.Series, base: float = 100.0) -> pd.Series:
    """Rescale a series so its first observation equals ``base`` (default 100)."""
    first = values.iloc[0]
    if first == 0 or np.isnan(first):
        raise ValueError("Cannot rebase a series that starts at zero or NaN.")
    return values / first * base


def total_return(values: pd.Series) -> float:
    """Total return = ending value / initial value - 1."""
    if len(values) < 2:
        raise ValueError("At least two values are required for a total return.")
    return float(values.iloc[-1] / values.iloc[0] - 1.0)


def total_return_from_returns(returns: pd.Series) -> float:
    """Total (compound) return from a series of periodic returns.

    Equivalent to ``total_return`` on the value path: prod(1 + r_t) - 1.
    Note this is NOT the sum of the daily returns (see methodology doc).
    """
    return float(np.prod(1.0 + returns.to_numpy()) - 1.0)
