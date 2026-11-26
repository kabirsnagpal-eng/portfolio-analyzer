"""Build backend/app/data/listings.json: every equity listed on NSE and BSE.

Sources (official exchange files, no API key):
- NSE: EQUITY_L.csv — the master list of equities listed on NSE.
- BSE: the daily equity "bhavcopy" (UDiFF format) for the last few trading
  days — every BSE equity scrip that traded, with ISIN, scrip code and symbol.
  (BSE's own scrip-master API blocks automated requests.)

Companies listed on both exchanges are merged by ISIN, so each company
appears once with both its NSE symbol and BSE scrip code.

Run from backend/:  .venv/Scripts/python.exe scripts/update_listings.py
The output is committed to the repo so the app never depends on the exchange
websites at runtime (they block most cloud servers).
"""

from __future__ import annotations

import csv
import io
import json
import sys
import urllib.request
from datetime import date, timedelta
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "app" / "data" / "listings.json"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
NSE_URL = "https://archives.nseindia.com/content/equities/EQUITY_L.csv"
BSE_URL = "https://www.bseindia.com/download/BhavCopy/Equity/BhavCopy_BSE_CM_0_0_0_{d}_F_0000.CSV"
INDEX_URL = "https://archives.nseindia.com/content/indices/ind_{name}list.csv"
BSE_DAYS = 5  # union of the last N trading days' files, so thinly traded scrips are included


def is_equity_share(isin: str) -> bool:
    """Indian ISINs: INE = company, characters 8-9 = security type ("01" = equity shares).

    This excludes government securities (IN0…), mutual funds/ETFs (INF…) and
    company debt such as NCDs and bonds (security types 07/08/…).
    """
    return len(isin) == 12 and isin.startswith("INE") and isin[7:9] == "01"


def fetch(url: str, referer: str) -> str | None:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": referer})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read().decode("utf-8", errors="replace")
    except Exception as exc:  # missing file (holiday) or blocked
        print(f"  skip {url}: {exc}", file=sys.stderr)
        return None


def nse_rows() -> list[dict]:
    text = fetch(NSE_URL, "https://www.nseindia.com/")
    if not text:
        raise SystemExit("Could not download the NSE equity list.")
    rows = []
    for r in csv.DictReader(io.StringIO(text)):
        r = {k.strip(): (v or "").strip() for k, v in r.items()}
        if not is_equity_share(r["ISIN NUMBER"]):
            continue
        rows.append({"symbol": r["SYMBOL"], "name": r["NAME OF COMPANY"], "isin": r["ISIN NUMBER"],
                     "series": r["SERIES"], "listed": r["DATE OF LISTING"]})
    return rows


def bse_rows() -> tuple[list[dict], str | None]:
    seen: dict[str, dict] = {}
    latest = None
    d, found = date.today(), 0
    for _ in range(14):  # walk back over weekends/holidays
        if found >= BSE_DAYS:
            break
        if d.weekday() < 5:
            text = fetch(BSE_URL.format(d=d.strftime("%Y%m%d")), "https://www.bseindia.com/")
            if text and text.startswith("TradDt"):
                found += 1
                latest = latest or d.isoformat()
                for r in csv.DictReader(io.StringIO(text)):
                    if r.get("FinInstrmTp") != "STK" or not is_equity_share(r.get("ISIN", "").strip()):
                        continue
                    code = r["FinInstrmId"].strip()
                    seen.setdefault(code, {"code": code, "symbol": r["TckrSymb"].strip(),
                                           "name": r["FinInstrmNm"].strip(), "isin": r["ISIN"].strip(),
                                           "group": r["SctySrs"].strip()})
        d -= timedelta(days=1)
    return list(seen.values()), latest


def index_members(name: str) -> list[dict]:
    """NSE index constituents (symbol, ISIN, industry) from NSE's official index files."""
    text = fetch(INDEX_URL.format(name=name), "https://www.nseindia.com/")
    if not text:
        return []
    return [{"symbol": r["Symbol"].strip(), "isin": r["ISIN Code"].strip(), "industry": r["Industry"].strip()}
            for r in csv.DictReader(io.StringIO(text))]


def main() -> None:
    print("Downloading NSE list…")
    nse = nse_rows()
    print(f"  {len(nse)} NSE equities")
    print("Downloading BSE bhavcopies…")
    bse, bse_date = bse_rows()
    print(f"  {len(bse)} BSE equities (latest file {bse_date})")

    by_isin: dict[str, dict] = {}
    for r in nse:
        by_isin[r["isin"]] = {"n": r["name"], "i": r["isin"], "s": r["symbol"], "b": None, "bs": None}
    for r in bse:
        entry = by_isin.get(r["isin"])
        if entry:
            entry["b"], entry["bs"] = r["code"], r["symbol"]
        else:
            by_isin[r["isin"]] = {"n": r["name"].title(), "i": r["isin"], "s": None, "b": r["code"], "bs": r["symbol"]}

    # Industry labels (NSE's own classification) for the Nifty 500, and the Nifty 50 members
    print("Downloading index constituents…")
    nifty500 = index_members("nifty500")
    nifty50 = index_members("nifty50")
    for m in nifty500 + nifty50:
        if m["isin"] in by_isin and m["industry"]:
            by_isin[m["isin"]]["ind"] = m["industry"]
    print(f"  Nifty 500: {len(nifty500)}, Nifty 50: {len(nifty50)}")

    companies = sorted(by_isin.values(), key=lambda c: c["n"].lower())
    payload = {
        "generated": date.today().isoformat(),
        "sources": {"nse": NSE_URL, "bse": "BSE equity bhavcopy, " + (bse_date or "n/a")},
        "counts": {
            "total": len(companies),
            "nse": sum(1 for c in companies if c["s"]),
            "bse": sum(1 for c in companies if c["b"]),
            "both": sum(1 for c in companies if c["s"] and c["b"]),
        },
        "indices": {"NIFTY 50": [m["symbol"] for m in nifty50], "NIFTY 500": [m["symbol"] for m in nifty500]},
        "companies": companies,
    }
    OUT.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {OUT} — {payload['counts']}")


if __name__ == "__main__":
    main()
