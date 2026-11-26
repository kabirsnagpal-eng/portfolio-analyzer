"""Live (intraday) prices and splicing them into a daily price history.

Yahoo Finance publishes 1-minute bars during market hours (for NSE these are
typically delayed by a few minutes). The latest bar becomes "today's" price:
it replaces today's provisional daily bar, or is appended if the daily
history does not have one yet. Every downstream number — value path, charts,
metrics, holdings — is then recomputed from that spliced series, so the whole
dashboard reflects the latest price.

Pure functions only; fetching lives in ``market_data.YFinanceProvider``.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone

import pandas as pd

# A quote is treated as coming from an open market if its latest bar is at most
# this old. Yahoo's NSE bars lag by a few minutes, so this is generous.
MARKET_OPEN_MAX_AGE_MIN = 30


@dataclass(frozen=True)
class Quote:
    ticker: str
    price: float
    previous_close: float | None
    time: datetime  # timestamp of the latest bar, timezone-aware (exchange time)
    currency: str | None = None

    @property
    def session_date(self) -> date:
        """Trading date of the bar, in the exchange's own timezone."""
        return self.time.date()

    @property
    def change(self) -> float | None:
        return None if self.previous_close is None else self.price - self.previous_close

    @property
    def change_pct(self) -> float | None:
        if not self.previous_close:
            return None
        return self.price / self.previous_close - 1.0


def is_market_open(quotes: list[Quote], now: datetime | None = None) -> bool:
    """Heuristic: the market is open if any quote's latest bar is recent."""
    if not quotes:
        return False
    now = now or datetime.now(timezone.utc)
    newest = max(q.time.astimezone(timezone.utc) for q in quotes)
    return (now - newest).total_seconds() <= MARKET_OPEN_MAX_AGE_MIN * 60


def splice_live_prices(raw: dict[str, pd.Series], quotes: dict[str, Quote]) -> tuple[dict[str, pd.Series], list[str]]:
    """Use each live quote as that ticker's price for its session date.

    - quote date == last daily date  -> replace the (provisional) last bar
    - quote date  > last daily date  -> append a new bar
    - quote date  < last daily date  -> stale quote, ignored

    Returns the new series and the tickers that were updated. Inputs are not
    modified. Today's adjusted close equals its raw price (adjustments only
    rescale earlier days), so splicing a raw intraday price is consistent with
    the adjusted daily history except on an ex-dividend or split day.
    """
    out: dict[str, pd.Series] = {}
    spliced: list[str] = []
    for ticker, series in raw.items():
        quote = quotes.get(ticker)
        if quote is None or len(series) == 0 or not quote.price > 0:
            out[ticker] = series
            continue
        day = pd.Timestamp(quote.session_date)
        last = series.index[-1]
        if day < last:
            out[ticker] = series
            continue
        updated = series.copy()
        updated.loc[day] = float(quote.price)
        out[ticker] = updated.sort_index()
        spliced.append(ticker)
    return out, spliced
