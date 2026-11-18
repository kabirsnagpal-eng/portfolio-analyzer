import math

import numpy as np
import pandas as pd
import pytest

from app.finance import metrics as m
from app.finance.attribution import contribution, contributions


# ---------------- CAGR ----------------

def test_cagr_doubling_over_two_years():
    # 100 -> 121 over 2 years is 10% a year
    assert m.cagr(100, 121, 2) == pytest.approx(0.10)


def test_cagr_one_year_equals_total_return():
    assert m.cagr(100, 115, 1) == pytest.approx(0.15)


def test_cagr_handles_loss_and_total_loss():
    assert m.cagr(100, 81, 2) == pytest.approx(-0.10)
    assert m.cagr(100, 0, 3) == -1.0


def test_cagr_rejects_invalid_inputs():
    with pytest.raises(ValueError):
        m.cagr(0, 100, 1)
    with pytest.raises(ValueError):
        m.cagr(100, 110, 0)


def test_cagr_from_values_uses_calendar_years():
    idx = pd.to_datetime(["2020-01-01", "2022-01-01"])  # 731 days
    v = pd.Series([100.0, 121.0], index=idx)
    years = 731 / 365.25
    assert m.cagr_from_values(v) == pytest.approx(1.21 ** (1 / years) - 1)


# ---------------- Volatility ----------------

def test_annualized_volatility_formula():
    r = pd.Series([0.01, -0.01, 0.02, -0.02, 0.0])
    expected = np.std(r.to_numpy(), ddof=1) * math.sqrt(252)
    assert m.annualized_volatility(r) == pytest.approx(expected)


def test_annualized_volatility_constant_returns_is_zero():
    assert m.annualized_volatility(pd.Series([0.001] * 10)) == 0.0


def test_annualized_volatility_needs_two_points():
    with pytest.raises(ValueError):
        m.annualized_volatility(pd.Series([0.01]))


# ---------------- Sharpe ----------------

def test_sharpe_ratio_formula():
    assert m.sharpe_ratio(0.15, 0.20, 0.065) == pytest.approx((0.15 - 0.065) / 0.20)


def test_sharpe_negative_excess_return():
    assert m.sharpe_ratio(0.03, 0.10, 0.065) == pytest.approx(-0.35)


def test_sharpe_zero_volatility_is_undefined():
    assert m.sharpe_ratio(0.10, 0.0, 0.065) is None


# ---------------- Drawdown ----------------

def test_max_drawdown_known_path():
    idx = pd.bdate_range("2024-01-01", periods=7)
    v = pd.Series([100, 120, 90, 110, 60, 80, 130], index=idx, dtype=float)
    ep = m.max_drawdown(v)
    assert ep.max_drawdown == pytest.approx(60 / 120 - 1)  # -50%
    assert ep.peak_date == idx[1]
    assert ep.trough_date == idx[4]
    assert ep.recovery_date == idx[6]


def test_drawdown_series_is_zero_at_highs_and_negative_below():
    v = pd.Series([100, 110, 99, 120], dtype=float)
    dd = m.drawdown_series(v)
    assert dd.tolist() == pytest.approx([0, 0, 99 / 110 - 1, 0])


def test_max_drawdown_never_recovered():
    idx = pd.bdate_range("2024-01-01", periods=4)
    ep = m.max_drawdown(pd.Series([100, 90, 80, 85], index=idx, dtype=float))
    assert ep.max_drawdown == pytest.approx(-0.20)
    assert ep.recovery_date is None


def test_max_drawdown_monotonic_rise_is_zero():
    ep = m.max_drawdown(pd.Series([1.0, 2.0, 3.0], index=pd.bdate_range("2024-01-01", periods=3)))
    assert ep.max_drawdown == 0.0 and ep.peak_date is None


# ---------------- Beta ----------------

def test_beta_of_scaled_benchmark():
    rng = np.random.default_rng(0)
    b = pd.Series(rng.normal(0, 0.01, 300))
    assert m.beta(1.5 * b, b) == pytest.approx(1.5)
    assert m.beta(b, b) == pytest.approx(1.0)


def test_beta_matches_cov_over_var():
    p = pd.Series([0.01, 0.02, -0.01, 0.00, 0.03])
    b = pd.Series([0.005, 0.01, -0.02, 0.01, 0.02])
    expected = np.cov(p, b, ddof=1)[0, 1] / np.var(b, ddof=1)
    assert m.beta(p, b) == pytest.approx(expected)


def test_beta_aligns_on_dates():
    idx = pd.bdate_range("2024-01-01", periods=5)
    b = pd.Series([0.01, -0.02, 0.03, 0.0, 0.01], index=idx)
    p = (2 * b).iloc[1:]  # missing first date
    assert m.beta(p, b) == pytest.approx(2.0)


def test_beta_zero_variance_benchmark_is_undefined():
    assert m.beta(pd.Series([0.01, 0.02, 0.03]), pd.Series([0.0, 0.0, 0.0])) is None


# ---------------- Contribution ----------------

def test_contribution():
    assert contribution(0.40, 0.25) == pytest.approx(0.10)
    c = contributions({"A": 0.6, "B": 0.4}, {"A": 0.10, "B": -0.05})
    assert c == pytest.approx({"A": 0.06, "B": -0.02})
    with pytest.raises(KeyError):
        contributions({"A": 1.0}, {})
