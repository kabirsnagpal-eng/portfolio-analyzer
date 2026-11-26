# Data Pipeline

From a list of ticker symbols to a clean, aligned, gap-checked price table — and a report of
everything that was done to it.

```text
tickers + benchmark
      │
      ▼
YFinanceProvider.get_prices()      backend/app/data/market_data.py
  ├─ disk cache hit? ──► read CSV
  └─ miss ──► yf.Ticker(t).history(auto_adjust=True) × N in a thread pool, 3 attempts with back-off
      │      empty result ──► InvalidTickerError (HTTP 422)
      │      network / rate limit ──► MarketDataUnavailableError (HTTP 503)
      ▼
align_prices()                      backend/app/data/cleaning.py
  1. union calendars       2. trim to common window      3. bounded forward-fill (≤ 5 rows)
  4. drop rows inside long gaps     5. DataQualityReport (status, warnings, counts)
      │
      ▼
daily_returns() → portfolio_daily_returns() → value_series() → metrics
```

## 1. How prices are retrieved

`YFinanceProvider._download_one()` calls:

```python
yf.Ticker(ticker).history(start=start, end=end + 1 day, interval="1d",
                          auto_adjust=True, actions=False, raise_errors=False)
```

- **`end + 1 day`** — yfinance treats `end` as exclusive; adding a day makes the user's end date
  inclusive.
- **Timezones** — Yahoo returns exchange-local timestamps (e.g. `Asia/Kolkata`). The index is made
  timezone-naive and normalised to midnight so dates from different exchanges line up.
- **Parallelism** — holdings and benchmark are downloaded concurrently (up to 6 threads).
- **Retries** — up to 3 attempts with linear back-off (0.75 s steps, or 2 s steps when the error
  looks like rate-limiting: `YFRateLimitError` / "Too Many Requests").
- **Names** — company names come from `Ticker.get_info()` (`shortName`/`longName`), looked up
  in parallel with an 8-second overall budget, cached permanently in `.cache/names.json`, and
  pre-filled for common indices. Names are cosmetic: a slow or failed lookup never blocks analysis.

## 2. Adjusted closing prices

With `auto_adjust=True`, the `Close` column is **adjusted** for:

- **Stock splits and bonus issues** — all earlier prices are divided by the split ratio, so a 1:2
  split does not appear as a −50% "return".
- **Dividends** — earlier prices are scaled down by the dividend's proportion of price, so the
  adjusted series behaves like a total-return series with dividends reinvested on the ex-date.

Folio uses only adjusted closes for every return calculation. The holdings table's "start price"
and "end price" are therefore **adjusted** prices; the start price can be lower than the historical
quoted price because later dividends and splits have been applied backwards.

Caveat: Yahoo restates adjusted history after each new dividend, and its corporate-action data for
Indian stocks is occasionally incomplete. See `LIMITATIONS.md`.

## 3. Data cleaning and date alignment

`align_prices(raw: dict[str, Series])` is a pure function:

1. **Union of dates.** All series are joined on the union of their dates. Different exchanges have
   different holidays (e.g. a US holding and the Nifty 50), so a union exposes the mismatches
   instead of hiding them.
2. **Common window.** The table is trimmed to `[max(first valid date), min(last valid date)]`.
   - If a security's history starts more than 7 calendar days after the earliest one (e.g. a
     recent IPO), the analysis start moves forward and the status becomes **adjusted** with a
     warning naming the security.
   - If a security stops trading more than 7 days before the others (delisting, suspension), the
     analysis end moves back and the status becomes **incomplete**.
3. **Bounded forward-fill.** `bounded_forward_fill(series, max_gap=5)` fills an *interior* run of
   missing values **only if the whole run is ≤ 5 rows**, carrying the last known price forward.
   This differs from `Series.ffill(limit=5)`, which would fill the first 5 rows of a 30-row gap and
   leave the rest — partially papering over a long gap. Leading gaps are never filled (there is no
   earlier price to carry).
   Carrying a price forward on a non-trading day means that security's return is 0% that day, which
   is the correct economic interpretation of a market holiday.
4. **Long gaps.** Runs longer than 5 rows are left missing; those dates are then **dropped for all
   securities** and each gap is reported (ticker, first/last date, length). Because returns are
   computed after dropping, the next return spans the gap (it is measured from the last available
   price) rather than being invented day by day. Status becomes **incomplete**.
5. **Minimum data.** Fewer than 3 aligned rows → `InsufficientDataError` (HTTP 422).

### Data-quality status

| Status | Meaning | UI |
|---|---|---|
| `complete` | Every security priced on every aligned day; nothing changed | Green dot, one line |
| `adjusted` | Short gaps forward-filled and/or start moved for a late listing | Collapsible notice |
| `incomplete` | Long gaps dropped, or a security stopped trading early | Notice open by default, flagged |

Every warning string is returned in `data_quality.warnings` and displayed above the results.

## 4. Return calculations and benchmark alignment

The benchmark is treated exactly like another column during alignment, so portfolio and
benchmark returns are computed on **identical dates**. Then:

- `daily_returns(prices)` → per-holding returns (first row dropped);
- `portfolio_daily_returns(returns, weights)` → daily-rebalanced portfolio returns (raises if any
  NaN slipped through, so a gap can never become an implicit 0%);
- `value_series()` → portfolio and benchmark value paths starting at the initial investment on the
  first aligned date.

Beta uses an additional inner join on dates as a safeguard.

## 5. Validation

| Layer | Checks |
|---|---|
| Frontend (`lib/portfolio.ts`) | ticker pattern, duplicates, weights > 0 and ≤ 100, total = 100 ± 0.01, date order, ≥ 30 days, not in future, amount > 0, −5% ≤ r_f ≤ 50% |
| Backend schema (`schemas/portfolio.py`) | the same rules, authoritatively; tickers normalised to upper case; ≤ 25 holdings; start ≥ 1990-01-01 |
| Data layer | empty download ⇒ invalid ticker; non-positive prices removed; overlap and minimum length enforced |

## 6. Caching

- Location: `backend/.cache/prices/{TICKER}_{start}_{end}.csv` and `backend/.cache/names.json`
  (git-ignored).
- Freshness: windows ending within the last 5 days expire after **6 hours** (new bars arrive and
  adjusted history can be restated); older windows after **7 days**.
- Unreadable cache files are ignored and re-fetched.
- Only successful, non-empty downloads are cached.

## 7. Live intraday prices

When a request has `live: true` and its `end_date` is within the last 5 days
(`app/data/live.py`, `YFinanceProvider.get_quotes`):

1. For every holding and the benchmark, fetch the latest **1-minute bar** with
   `Ticker.history(period="1d", interval="1m")` (falling back to `period="5d"` when today has no bars
   yet) and the previous close from `Ticker.fast_info`. Quotes are cached in memory for 30 seconds per
   server instance.
2. `splice_live_prices()` uses each quote as that ticker's price for its **session date** (the date in
   the exchange's own timezone): it replaces today's provisional daily bar, appends a new bar if the
   daily history doesn't have today yet, and ignores stale quotes. Quotes dated after `end_date` are
   never spliced.
3. The spliced series then go through exactly the same alignment, returns and metrics as historical
   data, so the value path, charts, drawdown, metrics, holdings and insights all include the latest
   price.

The frontend re-runs the same request every 60 s while `market_open` is true and every 5 minutes
otherwise, only while the tab is visible. Refreshes update the dashboard in place.

Intraday bars are unadjusted, while the daily history is split- and dividend-adjusted. Today's adjusted
close equals its raw price (adjustments only rescale earlier days), so the splice is consistent, except
on an ex-dividend or split day, when today's return can be distorted until the daily history is
restated.

## 8. API limitations

- yfinance is an unofficial client for Yahoo Finance's public endpoints. It has no SLA, can break
  when Yahoo changes its site, and is subject to rate limiting.
- The first request after the server starts can be slow while yfinance obtains a session
  cookie/crumb; subsequent requests are faster and cached ones return in well under a second.
- Index symbols (e.g. `^NSEI`) are price indices, not total-return indices: they exclude dividends,
  while stock prices are dividend-adjusted. This slightly favours the portfolio in comparisons.
- Data for very old periods, small caps and recently-listed names can be sparse.
