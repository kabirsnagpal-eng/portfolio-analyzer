"""Market data access: yfinance download, retry, and on-disk cache.

The rest of the application depends only on the ``PriceProvider`` protocol, so
tests (and any future data vendor) can substitute their own implementation.
"""

from __future__ import annotations

import json
import logging
import os
import re
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor, wait
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Protocol

import pandas as pd

logger = logging.getLogger(__name__)

def _default_cache_dir() -> Path:
    """backend/.cache locally; the writable temp dir on serverless hosts (e.g. Vercel), whose code dir is read-only."""
    if os.environ.get("FOLIO_CACHE_DIR"):
        return Path(os.environ["FOLIO_CACHE_DIR"])
    if os.environ.get("VERCEL"):
        return Path(tempfile.gettempdir()) / "folio-cache"
    return Path(__file__).resolve().parents[2] / ".cache"


CACHE_DIR = _default_cache_dir()
# Recent windows change as new bars arrive (and adjusted history is restated
# after each dividend), so they expire quickly. Fully historical windows are
# kept longer.
RECENT_TTL = timedelta(hours=6)
HISTORICAL_TTL = timedelta(days=7)
MAX_ATTEMPTS = 3
NAME_LOOKUP_TIMEOUT_S = 8.0

KNOWN_NAMES: dict[str, str] = {
    "^NSEI": "Nifty 50",
    "^BSESN": "S&P BSE Sensex",
    "^NSEBANK": "Nifty Bank",
    "^CNXIT": "Nifty IT",
    "^NSMIDCP": "Nifty Next 50",
    "^GSPC": "S&P 500",
    "^NDX": "Nasdaq 100",
    "^DJI": "Dow Jones Industrial Average",
    "^FTSE": "FTSE 100",
}


class MarketDataError(Exception):
    """Base class for data-access failures surfaced to the user."""


class InvalidTickerError(MarketDataError):
    def __init__(self, tickers: list[str]):
        self.tickers = tickers
        super().__init__(
            "No price data found for "
            + ", ".join(tickers)
            + ". Check the symbol (NSE stocks need a .NS suffix, e.g. RELIANCE.NS) "
            "and that it traded during the selected period."
        )


class MarketDataUnavailableError(MarketDataError):
    """The data source failed (network error, rate limit, outage)."""


class PriceProvider(Protocol):
    def get_prices(self, tickers: list[str], start: date, end: date) -> dict[str, pd.Series]:
        """Adjusted daily closes per ticker, indexed by tz-naive date. Inclusive of ``end``."""

    def get_names(self, tickers: list[str]) -> dict[str, str | None]:
        """Human-readable security names (best effort)."""


def _safe_name(text: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]", "_", text)


class YFinanceProvider:
    """Downloads adjusted closes from Yahoo Finance via yfinance, with caching."""

    def __init__(self, cache_dir: Path = CACHE_DIR):
        self.cache_dir = cache_dir
        (cache_dir / "prices").mkdir(parents=True, exist_ok=True)
        if os.environ.get("VERCEL"):
            # yfinance keeps its own timezone cache in the home directory, which is
            # read-only on serverless hosts; point it at the writable cache dir.
            import yfinance as yf

            (cache_dir / "yfinance").mkdir(parents=True, exist_ok=True)
            yf.set_tz_cache_location(str(cache_dir / "yfinance"))
        self._names_path = cache_dir / "names.json"
        self._lock = threading.Lock()

    # ---------- prices ----------

    def _cache_path(self, ticker: str, start: date, end: date) -> Path:
        return self.cache_dir / "prices" / f"{_safe_name(ticker)}_{start}_{end}.csv"

    def _read_cache(self, ticker: str, start: date, end: date) -> pd.Series | None:
        path = self._cache_path(ticker, start, end)
        if not path.exists():
            return None
        age = datetime.now() - datetime.fromtimestamp(path.stat().st_mtime)
        ttl = RECENT_TTL if (date.today() - end).days < 5 else HISTORICAL_TTL
        if age > ttl:
            return None
        try:
            frame = pd.read_csv(path, index_col=0, parse_dates=True)
            series = frame.iloc[:, 0].astype(float)
            series.name = ticker
            return series if len(series) else None
        except Exception:  # corrupt cache file: refetch
            logger.warning("Ignoring unreadable cache file %s", path)
            return None

    def _write_cache(self, ticker: str, start: date, end: date, series: pd.Series) -> None:
        try:
            series.to_frame("adj_close").to_csv(self._cache_path(ticker, start, end))
        except OSError:
            logger.warning("Could not write price cache for %s", ticker)

    @staticmethod
    def _download_one(ticker: str, start: date, end: date) -> pd.Series:
        import yfinance as yf  # imported lazily so tests never need the network

        last_error: Exception | None = None
        for attempt in range(MAX_ATTEMPTS):
            try:
                # auto_adjust=True => "Close" is split- and dividend-adjusted.
                # yfinance's `end` is exclusive, so add a day to include it.
                hist = yf.Ticker(ticker).history(
                    start=start.isoformat(),
                    end=(end + timedelta(days=1)).isoformat(),
                    interval="1d",
                    auto_adjust=True,
                    actions=False,
                    raise_errors=False,
                )
                if hist is None or hist.empty or "Close" not in hist:
                    return pd.Series(dtype=float, name=ticker)
                close = hist["Close"].astype(float)
                idx = pd.DatetimeIndex(close.index)
                if idx.tz is not None:
                    idx = idx.tz_localize(None)
                close.index = idx.normalize()
                close = close[~close.index.duplicated(keep="last")].dropna()
                close = close[close > 0]
                close.name = ticker
                return close
            except Exception as exc:  # network errors, rate limits, JSON decode errors...
                last_error = exc
                is_rate_limit = "RateLimit" in type(exc).__name__ or "Too Many Requests" in str(exc)
                logger.warning("yfinance attempt %d for %s failed: %s", attempt + 1, ticker, exc)
                time.sleep((2.0 if is_rate_limit else 0.75) * (attempt + 1))
        if last_error is not None and ("RateLimit" in type(last_error).__name__ or "Too Many Requests" in str(last_error)):
            raise MarketDataUnavailableError(
                "Yahoo Finance is rate-limiting requests right now. Wait a minute and try again."
            )
        raise MarketDataUnavailableError(
            "Could not reach Yahoo Finance to download prices. Check your internet connection and try again."
        )

    def get_prices(self, tickers: list[str], start: date, end: date) -> dict[str, pd.Series]:
        result: dict[str, pd.Series] = {}
        to_fetch: list[str] = []
        for t in tickers:
            cached = self._read_cache(t, start, end)
            if cached is not None:
                result[t] = cached
            else:
                to_fetch.append(t)

        if to_fetch:
            with ThreadPoolExecutor(max_workers=min(6, len(to_fetch))) as pool:
                downloaded = dict(zip(to_fetch, pool.map(lambda t: self._download_one(t, start, end), to_fetch)))
            for t, series in downloaded.items():
                if len(series):
                    self._write_cache(t, start, end, series)
                result[t] = series

        invalid = [t for t in tickers if len(result.get(t, [])) == 0]
        if invalid:
            raise InvalidTickerError(invalid)
        return result

    # ---------- names ----------

    def _load_names(self) -> dict[str, str]:
        try:
            return json.loads(self._names_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}

    @staticmethod
    def _lookup_name(ticker: str) -> str | None:
        try:
            import yfinance as yf

            info = yf.Ticker(ticker).get_info()
            return info.get("shortName") or info.get("longName")
        except Exception:
            return None

    def get_names(self, tickers: list[str]) -> dict[str, str | None]:
        with self._lock:
            cache = self._load_names()
        names: dict[str, str | None] = {}
        missing = []
        for t in tickers:
            if t in KNOWN_NAMES:
                names[t] = KNOWN_NAMES[t]
            elif t in cache:
                names[t] = cache[t]
            else:
                missing.append(t)
        if missing:
            # Names are cosmetic, so never let a slow metadata endpoint hold up
            # the analysis: whatever has not arrived within the timeout is None.
            pool = ThreadPoolExecutor(max_workers=min(6, len(missing)))
            futures = {t: pool.submit(self._lookup_name, t) for t in missing}
            wait(futures.values(), timeout=NAME_LOOKUP_TIMEOUT_S)
            pool.shutdown(wait=False, cancel_futures=True)
            found = {t: (f.result() if f.done() else None) for t, f in futures.items()}
            names.update(found)
            new_entries = {t: n for t, n in found.items() if n}
            if new_entries:
                with self._lock:
                    cache = self._load_names()
                    cache.update(new_entries)
                    try:
                        self._names_path.write_text(json.dumps(cache, indent=2), encoding="utf-8")
                    except OSError:
                        pass
        return names
