"""Company directory search and the market data endpoints (synthetic provider, no network)."""

from datetime import datetime, timedelta, timezone

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.api.routes import get_provider
from app.data.listings import Company, Listings, find_by_ticker, load_listings, search
from app.data.live import Quote
from app.main import app
from tests.conftest import SyntheticProvider

IST = timezone(timedelta(hours=5, minutes=30))


def _listings() -> Listings:
    companies = (
        Company("Alpha Industries Limited", "INE000A01011", "ALPHA", "500001", "ALPHA", "Capital Goods"),
        Company("Alphabet Retail Ltd.", "INE000B01012", None, "500002", "ALPHRET", None),
        Company("Beta Software Limited", "INE000C01013", "BETASOFT", None, None, "Information Technology"),
        Company("Gamma Alpha Foods Ltd.", "INE000D01014", "GAMMA", "500004", "GAMMAF", None),
    )
    return Listings("2026-11-27", {"total": 4}, ["Capital Goods", "Information Technology"], {"NIFTY 50": ["ALPHA"]}, companies)


# ---------------- search ----------------

def test_search_ranks_symbol_then_name_prefix_then_word():
    total, items = search(_listings(), "alpha")
    assert total == 3
    # exact symbol ALPHA first; then name-prefix "Alphabet…"; then word match "Gamma Alpha…"
    assert [c.name for c in items] == ["Alpha Industries Limited", "Alphabet Retail Ltd.", "Gamma Alpha Foods Ltd."]


def test_search_filters_and_paginates():
    lst = _listings()
    assert search(lst, "", "nse")[0] == 3
    assert search(lst, "", "bse")[0] == 3
    assert [c.name for c in search(lst, "", industry="Information Technology")[1]] == ["Beta Software Limited"]
    total, page = search(lst, "", offset=1, limit=2)
    assert total == 4 and [c.name for c in page] == ["Alphabet Retail Ltd.", "Beta Software Limited"]


def test_search_by_bse_code_and_isin():
    lst = _listings()
    assert search(lst, "500004")[1][0].name == "Gamma Alpha Foods Ltd."
    assert search(lst, "INE000C01013")[1][0].name == "Beta Software Limited"
    assert search(lst, "zzz") == (0, [])


def test_ticker_mapping_prefers_nse_then_bse_symbol():
    lst = _listings()
    assert lst.companies[0].ticker == "ALPHA.NS"
    assert lst.companies[1].ticker == "ALPHRET.BO"  # Yahoo uses BSE symbols, not scrip codes
    assert lst.companies[0].exchanges == ["NSE", "BSE"]
    assert find_by_ticker(lst, "alpha.ns").name == "Alpha Industries Limited"
    assert find_by_ticker(lst, "500002.BO").name == "Alphabet Retail Ltd."
    assert find_by_ticker(lst, "ALPHRET.BO").name == "Alphabet Retail Ltd."
    assert find_by_ticker(lst, "NOPE.NS") is None


def test_real_listings_file_is_consistent():
    lst = load_listings()
    assert lst.counts["total"] == len(lst.companies) > 4000
    assert all(c.isin.startswith("INE") and c.isin[7:9] == "01" for c in lst.companies)  # equity shares only
    assert len(lst.indices["NIFTY 50"]) == 50
    reliance = find_by_ticker(lst, "RELIANCE.NS")
    assert reliance and reliance.bse_code == "500325"
    assert search(lst, "reliance")[1][0].nse_symbol == "RELIANCE"  # large caps win ties


# ---------------- endpoints ----------------

def _q(t, price, prev, minutes_ago=5):
    now = datetime.now(IST) - timedelta(minutes=minutes_ago)
    return Quote(t, price, prev, now, "INR")


@pytest.fixture
def mclient():
    p = SyntheticProvider({}, quotes={
        "RELIANCE.NS": _q("RELIANCE.NS", 1400.0, 1374.0),
        "TCS.NS": _q("TCS.NS", 2600.0, 2700.0),
        "^NSEI": _q("^NSEI", 26000.0, 25900.0),
    })
    p.profiles = {"RELIANCE.NS": {"longName": "Reliance Industries Limited", "marketCap": 1.9e13,
                                  "trailingPE": 24.5, "sector": "Energy", "city": "Mumbai", "country": "India",
                                  "fullTimeEmployees": 347000, "dividendYield": 0.4}}
    day = pd.DatetimeIndex(["2026-11-24", "2026-11-25"]).tz_localize("Asia/Kolkata")
    p.histories = {("RELIANCE.NS", "1y"): pd.Series([1350.0, 1374.0], index=day)}
    app.dependency_overrides[get_provider] = lambda: p
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_stocks_endpoint(mclient):
    r = mclient.get("/api/stocks", params={"q": "reliance industries", "limit": 3}).json()
    assert r["items"][0]["ticker"] == "RELIANCE.NS"
    assert r["items"][0]["exchanges"] == ["NSE", "BSE"]
    assert mclient.get("/api/stocks", params={"limit": 500}).status_code == 422
    meta = mclient.get("/api/listings").json()
    assert meta["counts"]["total"] > 4000 and "Information Technology" in meta["industries"]


def test_quotes_endpoint(mclient):
    r = mclient.get("/api/quotes", params={"tickers": "reliance.ns, TCS.NS,UNKNOWN.NS"}).json()
    assert [q["ticker"] for q in r] == ["RELIANCE.NS", "TCS.NS"]  # unknown omitted
    assert r[0]["change"] == pytest.approx(26.0)
    assert r[1]["change_pct"] == pytest.approx(-100 / 2700)
    too_many = ",".join(f"T{i}.NS" for i in range(61))
    assert mclient.get("/api/quotes", params={"tickers": too_many}).status_code == 422


def test_stock_detail_and_404(mclient):
    d = mclient.get("/api/stock/RELIANCE.NS").json()
    assert d["name"] == "Reliance Industries Limited"
    assert d["quote"]["price"] == 1400.0
    assert d["stats"]["pe_ratio"] == 24.5 and d["stats"]["dividend_yield_pct"] == 0.4
    assert d["location"] == "Mumbai, India" and d["employees"] == 347000
    assert d["company"]["bse_code"] == "500325"
    nf = mclient.get("/api/stock/NOPE123.NS")
    assert nf.status_code == 404 and nf.json()["error"] == "not_found"


def test_history_is_extended_with_latest_price(mclient):
    h = mclient.get("/api/stock/RELIANCE.NS/history", params={"range": "1y"}).json()
    assert [p["p"] for p in h["points"]] == [1350.0, 1374.0, 1400.0]
    assert h["intraday"] is False
    assert mclient.get("/api/stock/RELIANCE.NS/history", params={"range": "2y"}).status_code == 422


def test_market_overview_movers(mclient):
    o = mclient.get("/api/market/overview").json()
    assert [i["name"] for i in o["indices"]] == ["Nifty 50"]
    assert [g["ticker"] for g in o["gainers"]] == ["RELIANCE.NS"]
    assert [g["ticker"] for g in o["losers"]] == ["TCS.NS"]
    assert o["universe"] == "Nifty 50"
