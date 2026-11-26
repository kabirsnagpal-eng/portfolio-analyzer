"""Shared fixtures: synthetic, fully deterministic price data. No network."""

from __future__ import annotations

from datetime import date

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.api.routes import get_provider
from app.data.market_data import InvalidTickerError
from app.main import app


def business_days(start: str, periods: int) -> pd.DatetimeIndex:
    return pd.bdate_range(start=start, periods=periods)


class SyntheticProvider:
    """A PriceProvider backed by in-memory series. Unknown tickers are 'invalid'."""

    def __init__(self, prices: dict[str, pd.Series], names: dict[str, str] | None = None, quotes=None):
        self.prices = prices
        self.names = names or {}
        self.quotes = quotes or {}
        self.calls: list[list[str]] = []

    def get_quotes(self, tickers):
        return {t: self.quotes[t] for t in tickers if t in self.quotes}

    # Market-data endpoints: snapshots reuse the same quote fixtures
    profiles: dict = {}
    histories: dict = {}

    def get_snapshots(self, tickers):
        return self.get_quotes(tickers)

    def get_profile(self, ticker):
        return self.profiles.get(ticker, {})

    def get_history(self, ticker, range_key):
        return self.histories.get((ticker, range_key), pd.Series(dtype=float))

    def get_prices(self, tickers, start: date, end: date):
        self.calls.append(list(tickers))
        invalid = [t for t in tickers if t not in self.prices]
        if invalid:
            raise InvalidTickerError(invalid)
        out = {}
        for t in tickers:
            s = self.prices[t]
            out[t] = s.loc[pd.Timestamp(start):pd.Timestamp(end)]
        empty = [t for t, s in out.items() if s.dropna().empty]
        if empty:
            raise InvalidTickerError(empty)
        return out

    def get_names(self, tickers):
        return {t: self.names.get(t) for t in tickers}


def _geometric_path(start_price: float, daily_returns: np.ndarray, index: pd.DatetimeIndex, name: str) -> pd.Series:
    values = start_price * np.cumprod(np.concatenate([[1.0], 1 + daily_returns]))
    return pd.Series(values, index=index, name=name)


@pytest.fixture
def market() -> dict[str, pd.Series]:
    """~2 years of deterministic random-walk prices for three stocks and an index."""
    rng = np.random.default_rng(42)
    n = 520
    idx = business_days("2022-01-03", n)
    bench_r = rng.normal(0.0004, 0.010, n - 1)
    def stock(beta, alpha, noise, p0, name):
        r = alpha + beta * bench_r + rng.normal(0, noise, n - 1)
        return _geometric_path(p0, r, idx, name)
    return {
        "^NSEI": _geometric_path(17000, bench_r, idx, "^NSEI"),
        "AAA.NS": stock(1.2, 0.0003, 0.008, 2400, "AAA.NS"),
        "BBB.NS": stock(0.8, 0.0001, 0.009, 3300, "BBB.NS"),
        "CCC.NS": stock(1.0, -0.0002, 0.012, 1500, "CCC.NS"),
    }


@pytest.fixture
def provider(market) -> SyntheticProvider:
    return SyntheticProvider(market, names={"^NSEI": "Nifty 50", "AAA.NS": "Alpha Industries"})


@pytest.fixture
def client(provider):
    app.dependency_overrides[get_provider] = lambda: provider
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def valid_payload() -> dict:
    return {
        "holdings": [
            {"ticker": "AAA.NS", "weight": 0.4},
            {"ticker": "BBB.NS", "weight": 0.3},
            {"ticker": "CCC.NS", "weight": 0.3},
        ],
        "start_date": "2022-01-01",
        "end_date": "2023-12-29",
        "benchmark": "^NSEI",
        "initial_investment": 100000,
        "risk_free_rate": 0.065,
    }
