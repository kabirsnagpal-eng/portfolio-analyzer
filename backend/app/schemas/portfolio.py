"""Request and response models for the analysis API.

Units: weights, returns, rates and drawdowns are DECIMAL FRACTIONS
(0.4 = 40%, 0.065 = 6.5%). The frontend converts to and from percentages.
"""

from __future__ import annotations

import re
from datetime import date, timedelta
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.finance.validation import AllocationError, validate_weights

TICKER_PATTERN = re.compile(r"^[A-Z0-9^][A-Z0-9.\-=&^]{0,19}$")
MAX_HOLDINGS = 25
MIN_PERIOD_DAYS = 30
EARLIEST_START = date(1990, 1, 1)


def _clean_ticker(value: str) -> str:
    ticker = value.strip().upper()
    if not TICKER_PATTERN.match(ticker):
        raise ValueError(
            f"'{value}' is not a valid ticker symbol. Use symbols like RELIANCE.NS, AAPL or ^NSEI."
        )
    return ticker


class Holding(BaseModel):
    ticker: str = Field(..., examples=["RELIANCE.NS"])
    weight: float = Field(..., gt=0, le=1, description="Target weight as a fraction (0.4 = 40%).")

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, v: str) -> str:
        return _clean_ticker(v)


class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "holdings": [
                    {"ticker": "RELIANCE.NS", "weight": 0.4},
                    {"ticker": "TCS.NS", "weight": 0.3},
                    {"ticker": "INFY.NS", "weight": 0.3},
                ],
                "start_date": "2020-01-01",
                "end_date": "2025-01-01",
                "benchmark": "^NSEI",
                "initial_investment": 100000,
                "risk_free_rate": 0.065,
            }
        }
    )

    holdings: list[Holding] = Field(..., min_length=1, max_length=MAX_HOLDINGS)
    start_date: date
    end_date: date
    benchmark: str = "^NSEI"
    initial_investment: float = Field(100_000, gt=0, le=1e13)
    risk_free_rate: float = Field(0.065, ge=-0.05, le=0.5, description="Annual rate as a fraction.")

    @field_validator("benchmark")
    @classmethod
    def normalize_benchmark(cls, v: str) -> str:
        return _clean_ticker(v)

    @model_validator(mode="after")
    def _check(self) -> "AnalyzeRequest":
        tickers = [h.ticker for h in self.holdings]
        dupes = sorted({t for t in tickers if tickers.count(t) > 1})
        if dupes:
            raise ValueError(f"Each ticker can appear only once. Duplicated: {', '.join(dupes)}.")
        try:
            validate_weights({h.ticker: h.weight for h in self.holdings})
        except AllocationError as exc:
            raise ValueError(str(exc)) from exc
        if self.start_date < EARLIEST_START:
            raise ValueError(f"Start date must be on or after {EARLIEST_START}.")
        if self.end_date > date.today():
            raise ValueError("End date cannot be in the future.")
        if self.end_date - self.start_date < timedelta(days=MIN_PERIOD_DAYS):
            raise ValueError(f"Choose a period of at least {MIN_PERIOD_DAYS} days.")
        return self


# ---------------------------------------------------------------- responses


class MetricSet(BaseModel):
    total_return: float
    cagr: float
    annualized_volatility: float
    sharpe_ratio: float | None = Field(None, description="null when volatility is zero (undefined).")
    max_drawdown: float
    beta: float | None = Field(None, description="Relative to the selected benchmark; 1.0 for the benchmark itself.")


class DrawdownInfo(BaseModel):
    max_drawdown: float
    peak_date: date | None
    trough_date: date | None
    recovery_date: date | None
    peak_to_trough_days: int | None


class SeriesPoint(BaseModel):
    date: date
    portfolio: float = Field(..., description="Portfolio value rebased to 100 at the start.")
    benchmark: float = Field(..., description="Benchmark value rebased to 100 at the start.")
    portfolio_value: float
    portfolio_drawdown: float
    benchmark_drawdown: float


class HoldingResult(BaseModel):
    ticker: str
    name: str | None
    weight: float
    start_price: float
    end_price: float
    total_return: float
    contribution: float = Field(..., description="weight x total_return, as a fraction (0.05 = 5 pp).")


class Insight(BaseModel):
    id: str
    title: str
    detail: str
    tone: Literal["positive", "negative", "neutral"]


class DataQuality(BaseModel):
    status: Literal["complete", "adjusted", "incomplete"]
    warnings: list[str]
    filled_points: dict[str, int]
    dropped_rows: int


class AnalysisMeta(BaseModel):
    requested_start: date
    requested_end: date
    start_date: date
    end_date: date
    trading_days: int
    years: float
    benchmark: str
    benchmark_name: str | None
    initial_investment: float
    risk_free_rate: float
    rebalancing: Literal["daily"] = "daily"
    price_basis: Literal["adjusted_close"] = "adjusted_close"


class Summary(BaseModel):
    initial_value: float
    ending_value: float
    profit_loss: float
    total_return: float
    cagr: float
    benchmark_ending_value: float


class AnalyzeResponse(BaseModel):
    meta: AnalysisMeta
    summary: Summary
    portfolio: MetricSet
    benchmark: MetricSet
    drawdown: DrawdownInfo
    series: list[SeriesPoint]
    holdings: list[HoldingResult]
    insights: list[Insight]
    data_quality: DataQuality


class ErrorResponse(BaseModel):
    error: str
    message: str
    details: dict | list | None = None
