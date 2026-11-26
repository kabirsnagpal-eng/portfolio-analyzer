"""Live intraday prices: splicing rules and the live analysis path."""

from datetime import date, datetime, timedelta, timezone

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.api.routes import get_provider
from app.data.live import Quote, is_market_open, splice_live_prices
from app.main import app
from tests.conftest import SyntheticProvider

IST = timezone(timedelta(hours=5, minutes=30))


def _quote(ticker, price, day, prev=None, hour=11):
    return Quote(ticker, price, prev, datetime(day.year, day.month, day.day, hour, 0, tzinfo=IST), "INR")


# ---------------- splicing ----------------

def test_splice_replaces_provisional_bar_for_same_day():
    idx = pd.bdate_range("2026-11-23", periods=3)  # Mon..Wed
    s = pd.Series([100.0, 101.0, 102.0], index=idx)
    out, spliced = splice_live_prices({"A": s}, {"A": _quote("A", 105.5, idx[-1].date())})
    assert out["A"].tolist() == [100.0, 101.0, 105.5]
    assert spliced == ["A"]
    assert s.iloc[-1] == 102.0  # input untouched


def test_splice_appends_new_session():
    idx = pd.bdate_range("2026-11-23", periods=3)
    s = pd.Series([100.0, 101.0, 102.0], index=idx)
    nxt = (idx[-1] + pd.offsets.BDay(1)).date()
    out, _ = splice_live_prices({"A": s}, {"A": _quote("A", 99.0, nxt)})
    assert len(out["A"]) == 4
    assert out["A"].index[-1] == pd.Timestamp(nxt)
    assert out["A"].iloc[-1] == 99.0


def test_splice_ignores_stale_missing_and_bad_quotes():
    idx = pd.bdate_range("2026-11-23", periods=3)
    s = pd.Series([100.0, 101.0, 102.0], index=idx)
    stale = _quote("A", 1.0, idx[0].date() - timedelta(days=3))
    bad = _quote("B", 0.0, idx[-1].date())
    out, spliced = splice_live_prices({"A": s, "B": s, "C": s}, {"A": stale, "B": bad})
    assert spliced == []
    for t in "ABC":
        assert out[t].tolist() == [100.0, 101.0, 102.0]


def test_quote_change_and_market_state():
    q = _quote("A", 110.0, date(2026, 11, 27), prev=100.0)
    assert q.change == pytest.approx(10.0)
    assert q.change_pct == pytest.approx(0.10)
    assert _quote("A", 1.0, date(2026, 11, 27)).change_pct is None
    now = q.time.astimezone(timezone.utc)
    assert is_market_open([q], now=now + timedelta(minutes=5))
    assert not is_market_open([q], now=now + timedelta(hours=3))
    assert not is_market_open([])


# ---------------- end-to-end live analysis ----------------

@pytest.fixture
def live_market():
    """Daily history ending on the most recent business day up to today."""
    today = pd.Timestamp(date.today())
    idx = pd.bdate_range(end=today, periods=260)
    rng = np.random.default_rng(7)
    def path(p0):
        return pd.Series(p0 * np.cumprod(1 + rng.normal(0.0003, 0.01, len(idx))), index=idx)
    return {"AAA.NS": path(1000), "BBB.NS": path(500), "^NSEI": path(20000)}


def _run(prices, quotes, live=True):
    app.dependency_overrides[get_provider] = lambda: SyntheticProvider(prices, quotes=quotes)
    try:
        with TestClient(app) as c:
            return c.post("/api/analyze", json={
                "holdings": [{"ticker": "AAA.NS", "weight": 0.5}, {"ticker": "BBB.NS", "weight": 0.5}],
                "start_date": str((date.today() - timedelta(days=400))),
                "end_date": str(date.today()),
                "live": live,
            })
    finally:
        app.dependency_overrides.clear()


def test_live_price_flows_through_every_number(live_market):
    last_day = live_market["AAA.NS"].index[-1].date()
    new_price = float(live_market["AAA.NS"].iloc[-1]) * 1.05  # +5% intraday
    quotes = {
        "AAA.NS": _quote("AAA.NS", new_price, last_day, prev=float(live_market["AAA.NS"].iloc[-2])),
        "^NSEI": _quote("^NSEI", float(live_market["^NSEI"].iloc[-1]), last_day),
    }
    base = _run(live_market, {}, live=False).json()
    res = _run(live_market, quotes)
    assert res.status_code == 200, res.text
    body = res.json()

    h = {x["ticker"]: x for x in body["holdings"]}
    assert h["AAA.NS"]["end_price"] == pytest.approx(new_price)
    # Daily rebalancing: only the last day's return changes, from ½rA + ½rB to ½rA' + ½rB.
    a, b = live_market["AAA.NS"], live_market["BBB.NS"]
    r_a_old, r_b = a.iloc[-1] / a.iloc[-2] - 1, b.iloc[-1] / b.iloc[-2] - 1
    r_a_new = new_price / a.iloc[-2] - 1
    expected = (1 + 0.5 * r_a_new + 0.5 * r_b) / (1 + 0.5 * r_a_old + 0.5 * r_b)
    assert body["series"][-1]["portfolio"] / base["series"][-1]["portfolio"] == pytest.approx(expected, rel=1e-6)
    assert body["summary"]["ending_value"] > base["summary"]["ending_value"]

    live = body["live"]
    assert sorted(live["spliced"]) == ["AAA.NS", "^NSEI"]
    q = {x["ticker"]: x for x in live["quotes"]}
    assert set(q) == {"AAA.NS", "^NSEI"}  # BBB has no quote: omitted, history used as-is
    assert q["^NSEI"]["is_benchmark"] is True
    assert q["AAA.NS"]["price"] == pytest.approx(new_price)
    assert base["live"] is None


def test_live_flag_ignored_for_historical_periods(market, valid_payload):
    app.dependency_overrides[get_provider] = lambda: SyntheticProvider(market, quotes={
        "AAA.NS": _quote("AAA.NS", 1.0, date.today())})
    try:
        with TestClient(app) as c:
            res = c.post("/api/analyze", json={**valid_payload, "live": True})
    finally:
        app.dependency_overrides.clear()
    assert res.status_code == 200
    assert res.json()["live"] is None
