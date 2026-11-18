"""Risk and performance metrics.

Conventions used throughout (documented in docs/FINANCIAL_METHODOLOGY.md):

* TRADING_DAYS_PER_YEAR = 252 is used to annualise DAILY volatility.
* Calendar time (days / 365.25) is used for CAGR, because CAGR answers
  "what constant yearly growth rate turns V0 into VT over this many years?"
  and the elapsed time is a calendar quantity.
* Sample statistics (ddof=1) are used for standard deviation, covariance and
  variance, matching pandas defaults and standard finance texts.

Functions return ``None`` when a metric is mathematically undefined (for
example a Sharpe ratio with zero volatility) instead of returning inf/NaN or a
made-up number. The API surfaces the ``None`` as ``null`` and the UI shows
"Not defined" with an explanation.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

TRADING_DAYS_PER_YEAR = 252
DAYS_PER_YEAR = 365.25
# Below this, a standard deviation is treated as zero (floating-point noise).
_ZERO_TOLERANCE = 1e-12


def years_between(start: pd.Timestamp, end: pd.Timestamp) -> float:
    """Elapsed calendar years between two dates."""
    days = (pd.Timestamp(end) - pd.Timestamp(start)).days
    if days <= 0:
        raise ValueError("End date must be after start date.")
    return days / DAYS_PER_YEAR


def cagr(start_value: float, end_value: float, years: float) -> float:
    """Compound annual growth rate.

    CAGR = (V_end / V_start) ** (1 / years) - 1
    """
    if start_value <= 0:
        raise ValueError("Starting value must be positive.")
    if years <= 0:
        raise ValueError("Number of years must be positive.")
    if end_value <= 0:
        # A total loss compounds to -100% per year.
        return -1.0
    return float((end_value / start_value) ** (1.0 / years) - 1.0)


def cagr_from_values(values: pd.Series) -> float:
    """CAGR of a dated value series, using its first and last dates."""
    years = years_between(values.index[0], values.index[-1])
    return cagr(float(values.iloc[0]), float(values.iloc[-1]), years)


def annualized_volatility(daily_returns: pd.Series, periods_per_year: int = TRADING_DAYS_PER_YEAR) -> float:
    """Annualised volatility = std(daily returns, ddof=1) * sqrt(252).

    The square-root-of-time rule assumes daily returns are independent and
    identically distributed; it is an approximation (see LIMITATIONS.md).
    """
    clean = daily_returns.dropna()
    if len(clean) < 2:
        raise ValueError("At least two returns are required to estimate volatility.")
    std = float(clean.std(ddof=1))
    if std < _ZERO_TOLERANCE:
        return 0.0
    return std * float(np.sqrt(periods_per_year))


def sharpe_ratio(annual_return: float, annual_volatility: float, risk_free_rate: float) -> float | None:
    """Sharpe = (annualised return - risk-free rate) / annualised volatility.

    Returns None when volatility is zero: the ratio is undefined, and
    reporting +/-inf would be misleading.
    """
    if annual_volatility < _ZERO_TOLERANCE:
        return None
    return float((annual_return - risk_free_rate) / annual_volatility)


def drawdown_series(values: pd.Series) -> pd.Series:
    """Percentage below the running peak at each date (0 at a new high, negative otherwise).

    DD_t = V_t / max(V_0..V_t) - 1
    """
    running_peak = values.cummax()
    return values / running_peak - 1.0


@dataclass(frozen=True)
class DrawdownEpisode:
    max_drawdown: float  # negative fraction, e.g. -0.23 for -23%
    peak_date: pd.Timestamp | None
    trough_date: pd.Timestamp | None
    recovery_date: pd.Timestamp | None  # None if not yet recovered by the end of the window

    @property
    def peak_to_trough_days(self) -> int | None:
        if self.peak_date is None or self.trough_date is None:
            return None
        return int((self.trough_date - self.peak_date).days)


def max_drawdown(values: pd.Series) -> DrawdownEpisode:
    """Largest peak-to-trough decline, with the dates that define it.

    The trough is the date of the most negative drawdown. The peak is the last
    running high before that trough. Recovery is the first later date on which
    the value regains the peak level.
    """
    if len(values) < 2:
        raise ValueError("At least two values are required for a drawdown.")
    dd = drawdown_series(values)
    worst = float(dd.min())
    if worst >= 0:
        return DrawdownEpisode(0.0, None, None, None)
    trough_date = dd.idxmin()
    peak_value = values.loc[:trough_date].max()
    peak_date = values.loc[:trough_date].idxmax()
    after = values.loc[trough_date:]
    recovered = after[after >= peak_value]
    recovery_date = recovered.index[0] if len(recovered) else None
    return DrawdownEpisode(worst, peak_date, trough_date, recovery_date)


def beta(asset_returns: pd.Series, benchmark_returns: pd.Series) -> float | None:
    """Beta = Cov(R_p, R_b) / Var(R_b) on date-aligned daily returns.

    Only dates present in both series are used. Returns None when the
    benchmark has zero variance (beta is undefined).
    """
    joined = pd.concat([asset_returns, benchmark_returns], axis=1, join="inner").dropna()
    if len(joined) < 2:
        raise ValueError("At least two overlapping returns are required for beta.")
    p = joined.iloc[:, 0].to_numpy()
    b = joined.iloc[:, 1].to_numpy()
    var_b = float(np.var(b, ddof=1))
    if var_b < _ZERO_TOLERANCE**2:
        return None
    cov = float(np.cov(p, b, ddof=1)[0, 1])
    return cov / var_b
