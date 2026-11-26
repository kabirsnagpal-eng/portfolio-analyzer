"""Directory of every equity listed on NSE and BSE, with search.

Backed by app/data/listings.json, generated from the exchanges' official files
by scripts/update_listings.py and committed to the repo, so search works
instantly and never depends on the exchange websites at request time.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Literal

LISTINGS_PATH = Path(__file__).resolve().parent / "listings.json"
Exchange = Literal["all", "nse", "bse"]


@dataclass(frozen=True)
class Company:
    name: str
    isin: str
    nse_symbol: str | None
    bse_code: str | None
    bse_symbol: str | None
    industry: str | None

    @property
    def ticker(self) -> str:
        """Yahoo Finance symbol: NSE listing preferred (more liquid), else the BSE symbol.

        Yahoo identifies BSE stocks by trading symbol (RELIANCE.BO), not scrip code.
        """
        return f"{self.nse_symbol}.NS" if self.nse_symbol else f"{self.bse_symbol or self.bse_code}.BO"

    @property
    def exchanges(self) -> list[str]:
        return [x for x, present in (("NSE", self.nse_symbol), ("BSE", self.bse_code)) if present]


@dataclass(frozen=True)
class Listings:
    generated: str
    counts: dict[str, int]
    industries: list[str]
    indices: dict[str, list[str]]
    companies: tuple[Company, ...]


@lru_cache(maxsize=1)
def load_listings(path: Path = LISTINGS_PATH) -> Listings:
    raw = json.loads(path.read_text(encoding="utf-8"))
    companies = tuple(
        Company(c["n"], c["i"], c.get("s"), c.get("b"), c.get("bs"), c.get("ind")) for c in raw["companies"]
    )
    return Listings(
        generated=raw["generated"],
        counts=raw["counts"],
        industries=sorted({c.industry for c in companies if c.industry}),
        indices=raw.get("indices", {}),
        companies=companies,
    )


def _rank(c: Company, q: str) -> int | None:
    """Lower is better; None = no match. Symbols beat names, prefixes beat substrings."""
    syms = [s.upper() for s in (c.nse_symbol, c.bse_symbol, c.bse_code) if s]
    name = c.name.upper()
    if q in syms:
        return 0
    if any(s.startswith(q) for s in syms):
        return 1
    if name.startswith(q):
        return 2
    if any(word.startswith(q) for word in name.replace(".", " ").split()):
        return 3
    if q in name:
        return 4
    if any(q in s for s in syms) or q == c.isin:
        return 5
    return None


def search(
    listings: Listings,
    query: str = "",
    exchange: Exchange = "all",
    industry: str | None = None,
    offset: int = 0,
    limit: int = 25,
) -> tuple[int, list[Company]]:
    """Filter and rank companies. Returns (total matches, one page of results)."""
    q = query.strip().upper()
    pool = listings.companies
    if exchange == "nse":
        pool = tuple(c for c in pool if c.nse_symbol)
    elif exchange == "bse":
        pool = tuple(c for c in pool if c.bse_code)
    if industry:
        pool = tuple(c for c in pool if c.industry == industry)
    if q:
        # Ties go to larger, more liquid companies: Nifty 500 members (they carry an
        # industry label), then NSE-listed, then alphabetical.
        ranked = [
            ((r, c.industry is None, c.nse_symbol is None, c.name.lower()), c)
            for c in pool
            if (r := _rank(c, q)) is not None
        ]
        ranked.sort(key=lambda x: x[0])
        matches = [c for _, c in ranked]
    else:
        matches = list(pool)  # already alphabetical
    return len(matches), matches[offset : offset + limit]


def find_by_ticker(listings: Listings, ticker: str) -> Company | None:
    """Resolve a Yahoo ticker (RELIANCE.NS, 500325.BO, RELIANCE.BO) to its listed company."""
    t = ticker.strip().upper()
    base, _, suffix = t.rpartition(".")
    for c in listings.companies:
        if suffix == "NS" and c.nse_symbol == base:
            return c
        if suffix == "BO" and (c.bse_code == base or (c.bse_symbol or "").upper() == base):
            return c
    return None
