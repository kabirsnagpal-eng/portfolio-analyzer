"""HTTP endpoints. Thin: parse input, call a service, return a schema."""

from __future__ import annotations

from datetime import date, timedelta
from functools import lru_cache

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.data.market_data import InvalidTickerError, PriceProvider, YFinanceProvider
from app.schemas.portfolio import AnalyzeRequest, AnalyzeResponse, ErrorResponse, _clean_ticker
from app.services.analysis import run_analysis

router = APIRouter(prefix="/api")


@lru_cache(maxsize=1)
def get_provider() -> PriceProvider:
    """Dependency hook. Tests override this with a synthetic provider."""
    return YFinanceProvider()


class Benchmark(BaseModel):
    ticker: str
    name: str
    region: str


BENCHMARKS = [
    Benchmark(ticker="^NSEI", name="Nifty 50", region="India"),
    Benchmark(ticker="^BSESN", name="S&P BSE Sensex", region="India"),
    Benchmark(ticker="^NSEBANK", name="Nifty Bank", region="India"),
    Benchmark(ticker="^CNXIT", name="Nifty IT", region="India"),
    Benchmark(ticker="^GSPC", name="S&P 500", region="United States"),
    Benchmark(ticker="^NDX", name="Nasdaq 100", region="United States"),
]


class TickerCheck(BaseModel):
    ticker: str
    valid: bool
    name: str | None = None
    last_price: float | None = None
    last_date: date | None = None


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.get("/benchmarks", response_model=list[Benchmark])
def list_benchmarks() -> list[Benchmark]:
    return BENCHMARKS


@router.get(
    "/tickers/validate",
    response_model=TickerCheck,
    responses={422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
)
def validate_ticker(symbol: str = Query(..., min_length=1, max_length=20),
                    provider: PriceProvider = Depends(get_provider)) -> TickerCheck:
    """Check that a symbol has recent prices on Yahoo Finance."""
    ticker = _clean_ticker(symbol)
    end = date.today()
    try:
        prices = provider.get_prices([ticker], end - timedelta(days=21), end)[ticker]
    except InvalidTickerError:
        return TickerCheck(ticker=ticker, valid=False)
    name = provider.get_names([ticker]).get(ticker)
    return TickerCheck(
        ticker=ticker, valid=True, name=name,
        last_price=float(prices.iloc[-1]), last_date=prices.index[-1].date(),
    )


@router.post(
    "/analyze",
    response_model=AnalyzeResponse,
    responses={422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
)
def analyze(req: AnalyzeRequest, provider: PriceProvider = Depends(get_provider)) -> AnalyzeResponse:
    """Run a full portfolio analysis. Declared sync so FastAPI runs it in a worker thread."""
    return run_analysis(req, provider)
