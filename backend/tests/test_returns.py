import numpy as np
import pandas as pd
import pytest

from app.finance.returns import (
    daily_returns,
    normalize_weights,
    portfolio_daily_returns,
    rebase,
    total_return,
    total_return_from_returns,
    value_series,
)


def test_daily_returns_100_110_99():
    """The worked example from the spec: 100 -> 110 -> 99."""
    prices = pd.Series([100.0, 110.0, 99.0], index=pd.bdate_range("2024-01-01", periods=3))
    r = daily_returns(prices)
    assert len(r) == 2  # the first day has no return; it is dropped, not reported as 0
    assert r.iloc[0] == pytest.approx(0.10)
    assert r.iloc[1] == pytest.approx(-0.10)
    assert total_return_from_returns(r) == pytest.approx(-0.01)
    assert total_return(prices) == pytest.approx(-0.01)


def test_cumulative_return_is_not_sum_of_returns():
    r = pd.Series([0.10, -0.10])
    assert r.sum() == pytest.approx(0.0)
    assert total_return_from_returns(r) == pytest.approx(-0.01)


def test_daily_returns_dataframe():
    idx = pd.bdate_range("2024-01-01", periods=3)
    prices = pd.DataFrame({"A": [100, 110, 121], "B": [50, 50, 25]}, index=idx, dtype=float)
    r = daily_returns(prices)
    assert r["A"].tolist() == pytest.approx([0.10, 0.10])
    assert r["B"].tolist() == pytest.approx([0.0, -0.5])


def test_daily_returns_rejects_short_or_nonpositive():
    with pytest.raises(ValueError):
        daily_returns(pd.Series([100.0]))
    with pytest.raises(ValueError):
        daily_returns(pd.Series([100.0, 0.0, 5.0]))


def test_portfolio_returns_weighted_sum():
    idx = pd.bdate_range("2024-01-01", periods=2)
    rets = pd.DataFrame({"A": [0.10, -0.05], "B": [0.00, 0.02], "C": [-0.04, 0.01]}, index=idx)
    port = portfolio_daily_returns(rets, {"A": 0.5, "B": 0.3, "C": 0.2})
    # 0.5*0.10 + 0.3*0 + 0.2*-0.04 = 0.042 ; 0.5*-0.05 + 0.3*0.02 + 0.2*0.01 = -0.017
    assert port.tolist() == pytest.approx([0.042, -0.017])


def test_portfolio_daily_rebalancing_differs_from_buy_and_hold():
    """Two assets, 50/50. A doubles then halves; B is flat.

    Daily-rebalanced: (1 + 0.5) * (1 - 0.25) - 1 = +12.5%
    Buy-and-hold:     A ends where it started, B flat -> 0%
    """
    idx = pd.bdate_range("2024-01-01", periods=3)
    prices = pd.DataFrame({"A": [100.0, 200.0, 100.0], "B": [100.0, 100.0, 100.0]}, index=idx)
    port = portfolio_daily_returns(daily_returns(prices), {"A": 0.5, "B": 0.5})
    assert total_return_from_returns(port) == pytest.approx(0.125)


def test_single_stock_portfolio_equals_stock():
    idx = pd.bdate_range("2024-01-01", periods=4)
    prices = pd.DataFrame({"A": [10.0, 11.0, 10.5, 12.0]}, index=idx)
    r = daily_returns(prices)
    pd.testing.assert_series_equal(portfolio_daily_returns(r, {"A": 1.0}), r["A"], check_names=False)


def test_portfolio_returns_rejects_gaps_and_missing_tickers():
    idx = pd.bdate_range("2024-01-01", periods=2)
    rets = pd.DataFrame({"A": [0.1, np.nan]}, index=idx)
    with pytest.raises(ValueError):
        portfolio_daily_returns(rets, {"A": 1.0})
    with pytest.raises(KeyError):
        portfolio_daily_returns(rets.fillna(0), {"Z": 1.0})


def test_normalize_weights_removes_float_residue():
    w = normalize_weights({"A": 0.1, "B": 0.2, "C": 0.7000000001})
    assert w.sum() == pytest.approx(1.0, abs=1e-15)


def test_value_series_and_rebase():
    idx = pd.bdate_range("2024-01-02", periods=2)
    r = pd.Series([0.10, -0.10], index=idx, name="p")
    v = value_series(r, 100_000, pd.Timestamp("2024-01-01"))
    assert v.tolist() == pytest.approx([100_000, 110_000, 99_000])
    assert v.index[0] == pd.Timestamp("2024-01-01")
    assert rebase(v).tolist() == pytest.approx([100, 110, 99])
    with pytest.raises(ValueError):
        value_series(r, 0)
