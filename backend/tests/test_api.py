"""API and end-to-end integration tests using the synthetic provider."""

import math

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.api.routes import get_provider
from app.data.market_data import MarketDataUnavailableError
from app.main import app
from tests.conftest import SyntheticProvider


def test_health_and_benchmarks(client):
    assert client.get("/api/health").json() == {"status": "ok"}
    benchmarks = client.get("/api/benchmarks").json()
    assert benchmarks[0]["ticker"] == "^NSEI"


def test_analyze_matches_independent_calculation(client, valid_payload, market):
    res = client.post("/api/analyze", json=valid_payload)
    assert res.status_code == 200, res.text
    body = res.json()

    # Independent re-computation with plain NumPy
    w = np.array([0.4, 0.3, 0.3])
    px = pd.DataFrame({t: market[t] for t in ["AAA.NS", "BBB.NS", "CCC.NS"]})
    r = (px / px.shift(1) - 1).iloc[1:].to_numpy()
    port_r = r @ w
    value = 100_000 * np.prod(1 + port_r)
    bench = market["^NSEI"].to_numpy()
    bench_r = bench[1:] / bench[:-1] - 1
    years = (px.index[-1] - px.index[0]).days / 365.25
    cagr = (value / 100_000) ** (1 / years) - 1
    vol = port_r.std(ddof=1) * math.sqrt(252)
    beta = np.cov(port_r, bench_r, ddof=1)[0, 1] / np.var(bench_r, ddof=1)
    path = 100_000 * np.concatenate([[1], np.cumprod(1 + port_r)])
    mdd = (path / np.maximum.accumulate(path) - 1).min()

    s, p = body["summary"], body["portfolio"]
    assert s["ending_value"] == pytest.approx(value)
    assert s["profit_loss"] == pytest.approx(value - 100_000)
    assert p["total_return"] == pytest.approx(value / 100_000 - 1)
    assert p["cagr"] == pytest.approx(cagr)
    assert p["annualized_volatility"] == pytest.approx(vol)
    assert p["sharpe_ratio"] == pytest.approx((cagr - 0.065) / vol)
    assert p["beta"] == pytest.approx(beta)
    assert p["max_drawdown"] == pytest.approx(mdd)
    assert body["benchmark"]["beta"] == 1.0

    # Chart series rebased to 100 and covering every aligned date
    assert body["series"][0]["portfolio"] == pytest.approx(100)
    assert body["series"][0]["benchmark"] == pytest.approx(100)
    assert len(body["series"]) == len(px)
    assert body["series"][-1]["portfolio"] == pytest.approx(value / 1000, rel=1e-6)

    # Holdings and contribution
    h = {x["ticker"]: x for x in body["holdings"]}
    aaa_ret = market["AAA.NS"].iloc[-1] / market["AAA.NS"].iloc[0] - 1
    assert h["AAA.NS"]["total_return"] == pytest.approx(aaa_ret)
    assert h["AAA.NS"]["contribution"] == pytest.approx(0.4 * aaa_ret)
    assert h["AAA.NS"]["name"] == "Alpha Industries"

    assert body["meta"]["benchmark_name"] == "Nifty 50"
    assert body["data_quality"]["status"] == "complete"
    assert {i["id"] for i in body["insights"]} >= {"relative", "best", "worst", "contributor", "volatility", "beta"}


def test_invalid_ticker_returns_422(client, valid_payload):
    valid_payload["holdings"][0]["ticker"] = "NOPE.NS"
    res = client.post("/api/analyze", json=valid_payload)
    assert res.status_code == 422
    body = res.json()
    assert body["error"] == "invalid_ticker"
    assert body["details"]["tickers"] == ["NOPE.NS"]


def test_invalid_benchmark_returns_422(client, valid_payload):
    valid_payload["benchmark"] = "^NOPE"
    res = client.post("/api/analyze", json=valid_payload)
    assert res.status_code == 422 and res.json()["error"] == "invalid_ticker"


def test_weights_not_100_returns_friendly_422(client, valid_payload):
    valid_payload["holdings"][0]["weight"] = 0.5
    res = client.post("/api/analyze", json=valid_payload)
    assert res.status_code == 422
    body = res.json()
    assert body["error"] == "validation_error"
    assert "110.00%" in body["message"]


def test_zero_volatility_portfolio_has_undefined_sharpe():
    idx = pd.bdate_range("2023-01-02", periods=120)
    flat = pd.Series(100.0, index=idx)
    rng = np.random.default_rng(1)
    bench = pd.Series(1000 * np.cumprod(1 + rng.normal(0, 0.01, 120)), index=idx)
    app.dependency_overrides[get_provider] = lambda: SyntheticProvider({"CASH": flat, "^NSEI": bench})
    try:
        with TestClient(app) as c:
            res = c.post("/api/analyze", json={
                "holdings": [{"ticker": "CASH", "weight": 1}],
                "start_date": "2023-01-01", "end_date": "2023-06-30",
            })
    finally:
        app.dependency_overrides.clear()
    assert res.status_code == 200, res.text
    p = res.json()["portfolio"]
    assert p["annualized_volatility"] == 0.0
    assert p["sharpe_ratio"] is None
    assert p["max_drawdown"] == 0.0
    assert p["total_return"] == 0.0


def test_missing_data_is_reported(market, valid_payload):
    gappy = dict(market)
    s = market["BBB.NS"].copy()
    s.iloc[100:112] = np.nan  # 12-day suspension
    s = s.drop(s.index[200])  # one-day holiday
    gappy["BBB.NS"] = s
    app.dependency_overrides[get_provider] = lambda: SyntheticProvider(gappy)
    try:
        with TestClient(app) as c:
            res = c.post("/api/analyze", json=valid_payload)
    finally:
        app.dependency_overrides.clear()
    assert res.status_code == 200
    q = res.json()["data_quality"]
    assert q["status"] == "incomplete"
    assert q["filled_points"] == {"BBB.NS": 1}
    assert q["dropped_rows"] == 12
    assert any("12 consecutive trading days" in w for w in q["warnings"])


def test_mixed_markets_warning(market, valid_payload):
    prices = dict(market, AAPL=market["AAA.NS"].rename("AAPL"))
    app.dependency_overrides[get_provider] = lambda: SyntheticProvider(prices)
    valid_payload["holdings"][0]["ticker"] = "AAPL"
    try:
        with TestClient(app) as c:
            res = c.post("/api/analyze", json=valid_payload)
    finally:
        app.dependency_overrides.clear()
    assert any("currency" in w for w in res.json()["data_quality"]["warnings"])


def test_data_source_outage_returns_503(valid_payload):
    class Down:
        def get_prices(self, *a):
            raise MarketDataUnavailableError("Could not reach Yahoo Finance.")
        def get_names(self, t):
            return {}
    app.dependency_overrides[get_provider] = lambda: Down()
    try:
        with TestClient(app) as c:
            res = c.post("/api/analyze", json=valid_payload)
    finally:
        app.dependency_overrides.clear()
    assert res.status_code == 503
    assert res.json()["error"] == "data_unavailable"


def test_ticker_validation_endpoint(client):
    # Synthetic data ends in 2023, so "recent prices" are absent -> invalid
    res = client.get("/api/tickers/validate", params={"symbol": "aaa.ns"})
    assert res.status_code == 200
    assert res.json() == {"ticker": "AAA.NS", "valid": False, "name": None, "last_price": None, "last_date": None}
    bad = client.get("/api/tickers/validate", params={"symbol": "bad ticker!"})
    assert bad.status_code == 422
