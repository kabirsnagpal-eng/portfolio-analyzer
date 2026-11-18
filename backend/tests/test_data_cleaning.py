import numpy as np
import pandas as pd
import pytest

from app.data.cleaning import InsufficientDataError, align_prices, bounded_forward_fill


def test_bounded_ffill_fills_short_gaps_only():
    s = pd.Series([1.0, np.nan, 3.0, np.nan, np.nan, np.nan, 7.0])
    filled, n, long_runs = bounded_forward_fill(s, max_gap=2)
    assert filled.tolist()[:3] == [1.0, 1.0, 3.0]
    assert np.isnan(filled.iloc[3:6]).all()  # 3-row gap is left entirely unfilled
    assert n == 1
    assert long_runs == [(3, 6)]


def test_bounded_ffill_never_fills_leading_nans():
    filled, n, _ = bounded_forward_fill(pd.Series([np.nan, np.nan, 5.0, 6.0]))
    assert np.isnan(filled.iloc[0]) and n == 0


def test_align_different_holiday_calendars():
    idx = pd.bdate_range("2024-01-01", periods=10)
    a = pd.Series(np.arange(10, 20, dtype=float), index=idx)
    b = pd.Series(np.arange(50, 60, dtype=float), index=idx).drop(idx[4])  # B's market closed one day
    aligned, report = align_prices({"A": a, "B": b})
    assert len(aligned) == 10
    assert aligned.loc[idx[4], "B"] == aligned.loc[idx[3], "B"]  # carried forward
    assert report.filled_points == {"B": 1}
    assert report.status == "adjusted"
    assert any("forward-filled" in w for w in report.warnings)


def test_align_long_gap_is_dropped_and_flagged():
    idx = pd.bdate_range("2024-01-01", periods=30)
    a = pd.Series(100.0, index=idx)
    b = pd.Series(50.0, index=idx)
    b.iloc[10:20] = np.nan  # 10-day suspension
    aligned, report = align_prices({"A": a, "B": b}, max_gap=5)
    assert len(aligned) == 20
    assert report.status == "incomplete"
    assert report.dropped_rows == 10
    assert report.long_gaps[0].rows == 10
    assert not aligned.isna().any().any()


def test_align_trims_to_common_window_and_warns_on_late_start():
    idx = pd.bdate_range("2024-01-01", periods=40)
    a = pd.Series(1.0, index=idx)
    b = pd.Series(2.0, index=idx[15:])  # listed three weeks later
    aligned, report = align_prices({"A": a, "B": b})
    assert aligned.index[0] == idx[15]
    assert report.status == "adjusted"
    assert "begins later" in report.warnings[0]


def test_align_warns_when_a_ticker_stops_trading():
    idx = pd.bdate_range("2024-01-01", periods=40)
    aligned, report = align_prices({"A": pd.Series(1.0, index=idx), "B": pd.Series(2.0, index=idx[:20])})
    assert aligned.index[-1] == idx[19]
    assert report.status == "incomplete"


def test_align_rejects_empty_and_non_overlapping():
    idx = pd.bdate_range("2024-01-01", periods=10)
    with pytest.raises(InsufficientDataError):
        align_prices({"A": pd.Series(1.0, index=idx), "B": pd.Series(dtype=float)})
    with pytest.raises(InsufficientDataError):
        align_prices({"A": pd.Series(1.0, index=idx[:4]), "B": pd.Series(1.0, index=idx[6:])})
    with pytest.raises(InsufficientDataError):
        align_prices({})


def test_align_complete_data_is_untouched():
    idx = pd.bdate_range("2024-01-01", periods=5)
    aligned, report = align_prices({"A": pd.Series([1.0, 2, 3, 4, 5], index=idx)})
    assert report.status == "complete" and report.warnings == []
    assert aligned["A"].tolist() == [1, 2, 3, 4, 5]
