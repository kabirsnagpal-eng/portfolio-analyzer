"""Response models for the market data endpoints (directory, quotes, stock pages, overview)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class CompanyOut(BaseModel):
    name: str
    isin: str
    nse_symbol: str | None
    bse_code: str | None
    bse_symbol: str | None
    industry: str | None = Field(None, description="NSE industry classification (Nifty 500 members only).")
    ticker: str = Field(..., description="Yahoo Finance symbol used for prices (NSE preferred).")
    exchanges: list[Literal["NSE", "BSE"]]


class ListingsMeta(BaseModel):
    generated: str = Field(..., description="Date the exchange lists were downloaded.")
    counts: dict[str, int]
    industries: list[str]


class CompanyPage(BaseModel):
    total: int
    offset: int
    limit: int
    items: list[CompanyOut]


class QuoteOut(BaseModel):
    ticker: str
    price: float
    previous_close: float | None
    change: float | None
    change_pct: float | None = Field(None, description="Fraction, e.g. 0.012 = +1.2%.")
    time: datetime
    intraday: bool = Field(..., description="False when only a daily close was available.")


class NamedQuote(QuoteOut):
    name: str


class StockStats(BaseModel):
    market_cap: float | None = None
    pe_ratio: float | None = None
    price_to_book: float | None = None
    beta: float | None = None
    dividend_yield_pct: float | None = Field(None, description="Already a percentage (1.9 = 1.9%).")
    week52_high: float | None = None
    week52_low: float | None = None
    day_high: float | None = None
    day_low: float | None = None
    volume: float | None = None
    avg_volume: float | None = None


class StockDetail(BaseModel):
    ticker: str
    name: str
    company: CompanyOut | None = Field(None, description="Exchange listing details, if in the NSE/BSE directory.")
    quote: QuoteOut | None
    currency: str | None
    sector: str | None
    industry: str | None
    website: str | None
    description: str | None
    employees: int | None
    location: str | None
    stats: StockStats


class HistoryPoint(BaseModel):
    t: datetime
    p: float


class StockHistory(BaseModel):
    ticker: str
    range: str
    intraday: bool
    points: list[HistoryPoint]


class MarketOverview(BaseModel):
    as_of: datetime | None
    indices: list[NamedQuote]
    gainers: list[NamedQuote]
    losers: list[NamedQuote]
    universe: str = Field(..., description="Which stocks the movers are drawn from.")
