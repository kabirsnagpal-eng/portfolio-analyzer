"""Market data endpoints: company directory, quotes, stock pages and market overview."""

from __future__ import annotations

from typing import Literal

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.routes import get_provider
from app.data.listings import Company, find_by_ticker, load_listings, search
from app.data.live import Quote
from app.data.market_data import HISTORY_RANGES, PriceProvider
from app.schemas.markets import (
    CompanyOut,
    CompanyPage,
    HistoryPoint,
    ListingsMeta,
    MarketOverview,
    NamedQuote,
    QuoteOut,
    StockDetail,
    StockHistory,
    StockStats,
)
from app.schemas.portfolio import ErrorResponse, _clean_ticker

router = APIRouter(prefix="/api")

MAX_QUOTES = 60
INDICES = [("^NSEI", "Nifty 50"), ("^BSESN", "Sensex"), ("^NSEBANK", "Nifty Bank"), ("^CNXIT", "Nifty IT")]
MOVERS = 5


def company_out(c: Company) -> CompanyOut:
    return CompanyOut(name=c.name, isin=c.isin, nse_symbol=c.nse_symbol, bse_code=c.bse_code,
                      bse_symbol=c.bse_symbol, industry=c.industry, ticker=c.ticker, exchanges=c.exchanges)


def quote_out(q: Quote) -> QuoteOut:
    return QuoteOut(ticker=q.ticker, price=q.price, previous_close=q.previous_close, change=q.change,
                    change_pct=q.change_pct, time=q.time, intraday=q.intraday)


@router.get("/listings", response_model=ListingsMeta)
def listings_meta() -> ListingsMeta:
    lst = load_listings()
    return ListingsMeta(generated=lst.generated, counts=lst.counts, industries=lst.industries)


@router.get("/stocks", response_model=CompanyPage)
def list_stocks(
    q: str = Query("", max_length=60, description="Name, symbol, BSE code or ISIN."),
    exchange: Literal["all", "nse", "bse"] = "all",
    industry: str | None = Query(None, max_length=80),
    offset: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
) -> CompanyPage:
    total, items = search(load_listings(), q, exchange, industry, offset, limit)
    return CompanyPage(total=total, offset=offset, limit=limit, items=[company_out(c) for c in items])


@router.get("/quotes", response_model=list[QuoteOut], responses={503: {"model": ErrorResponse}})
def quotes(
    tickers: str = Query(..., description=f"Comma-separated Yahoo symbols, at most {MAX_QUOTES}."),
    provider: PriceProvider = Depends(get_provider),
) -> list[QuoteOut]:
    symbols = list(dict.fromkeys(_clean_ticker(t) for t in tickers.split(",") if t.strip()))
    if not symbols or len(symbols) > MAX_QUOTES:
        raise ValueError(f"Provide between 1 and {MAX_QUOTES} tickers.")
    snaps = provider.get_snapshots(symbols)
    return [quote_out(snaps[t]) for t in symbols if t in snaps]


def _num(info: dict, key: str) -> float | None:
    v = info.get(key)
    return float(v) if isinstance(v, (int, float)) and v == v else None


@router.get("/stock/{ticker}", response_model=StockDetail, responses={404: {"model": ErrorResponse}})
def stock_detail(ticker: str, provider: PriceProvider = Depends(get_provider)) -> StockDetail:
    t = _clean_ticker(ticker)
    company = find_by_ticker(load_listings(), t)
    quote = provider.get_snapshots([t]).get(t)
    info = provider.get_profile(t)
    name = info.get("longName") or info.get("shortName") or (company.name if company else None)
    if quote is None and not info.get("regularMarketPrice") and company is None:
        raise HTTPException(status_code=404, detail=f"No market data found for {t}.")
    location = ", ".join(x for x in (info.get("city"), info.get("country")) if x) or None
    return StockDetail(
        ticker=t,
        name=name or t,
        company=company_out(company) if company else None,
        quote=quote_out(quote) if quote else None,
        currency=info.get("currency"),
        sector=info.get("sector"),
        industry=info.get("industry") or (company.industry if company else None),
        website=info.get("website"),
        description=info.get("longBusinessSummary"),
        employees=int(info["fullTimeEmployees"]) if isinstance(info.get("fullTimeEmployees"), int) else None,
        location=location,
        stats=StockStats(
            market_cap=_num(info, "marketCap"),
            pe_ratio=_num(info, "trailingPE"),
            price_to_book=_num(info, "priceToBook"),
            beta=_num(info, "beta"),
            dividend_yield_pct=_num(info, "dividendYield"),
            week52_high=_num(info, "fiftyTwoWeekHigh"),
            week52_low=_num(info, "fiftyTwoWeekLow"),
            day_high=_num(info, "dayHigh"),
            day_low=_num(info, "dayLow"),
            volume=_num(info, "volume"),
            avg_volume=_num(info, "averageVolume"),
        ),
    )


@router.get("/stock/{ticker}/history", response_model=StockHistory)
def stock_history(
    ticker: str,
    range: Literal["1d", "5d", "1m", "6m", "1y", "5y", "max"] = "1y",
    provider: PriceProvider = Depends(get_provider),
) -> StockHistory:
    t = _clean_ticker(ticker)
    series = provider.get_history(t, range)
    intraday = HISTORY_RANGES[range][1].endswith("m")
    if not intraday and len(series):
        # Daily bars can lag the latest session; extend the chart with the latest price.
        q = provider.get_snapshots([t]).get(t)
        if q is not None:
            idx = pd.DatetimeIndex(series.index)
            last_day = (idx.tz_localize(None) if idx.tz is not None else idx).normalize()[-1]
            if pd.Timestamp(q.time.date()) > last_day:
                stamp = pd.Timestamp(q.time)
                stamp = stamp.tz_convert(idx.tz) if idx.tz is not None else stamp.tz_localize(None)
                series = pd.concat([series, pd.Series([q.price], index=pd.DatetimeIndex([stamp]))])
    points = [HistoryPoint(t=pd.Timestamp(ts).to_pydatetime(), p=round(float(v), 4)) for ts, v in series.items()]
    return StockHistory(ticker=t, range=range, intraday=intraday, points=points)


@router.get("/market/overview", response_model=MarketOverview)
def market_overview(provider: PriceProvider = Depends(get_provider)) -> MarketOverview:
    lst = load_listings()
    by_symbol = {c.nse_symbol: c for c in lst.companies if c.nse_symbol}
    members = [s for s in lst.indices.get("NIFTY 50", []) if s in by_symbol]
    tickers = [i for i, _ in INDICES] + [f"{s}.NS" for s in members]
    snaps = provider.get_snapshots(tickers)

    def named(q: Quote, name: str) -> NamedQuote:
        return NamedQuote(**quote_out(q).model_dump(), name=name)

    indices = [named(snaps[t], n) for t, n in INDICES if t in snaps]
    stocks = [named(snaps[f"{s}.NS"], by_symbol[s].name) for s in members
              if f"{s}.NS" in snaps and snaps[f"{s}.NS"].change_pct is not None]
    stocks.sort(key=lambda q: q.change_pct, reverse=True)
    as_of = max((q.time for q in snaps.values()), default=None)
    return MarketOverview(
        as_of=as_of,
        indices=indices,
        gainers=[q for q in stocks[:MOVERS] if q.change_pct > 0],
        losers=[q for q in reversed(stocks[-MOVERS:]) if q.change_pct < 0],
        universe="Nifty 50",
    )
