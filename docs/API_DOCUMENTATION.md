# API Documentation

Base URL (development): `http://127.0.0.1:8000`. Interactive OpenAPI docs: `/api/docs`; schema: `/api/openapi.json`.

All request and response bodies are JSON. **Weights, returns, rates and drawdowns are decimal
fractions** (0.4 = 40%). Dates are ISO `YYYY-MM-DD`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness check |
| GET | `/api/benchmarks` | Preset benchmark indices |
| GET | `/api/tickers/validate?symbol=…` | Check a symbol has recent prices; return its name |
| GET | `/api/listings` | Directory metadata: counts, industries, snapshot date |
| GET | `/api/stocks` | Search / page through every NSE and BSE listed company |
| GET | `/api/quotes?tickers=…` | Latest price and day change for up to 60 tickers |
| GET | `/api/stock/{ticker}` | Stock page data: profile, key statistics, latest quote |
| GET | `/api/stock/{ticker}/history?range=…` | Price history for charts |
| GET | `/api/market/overview` | Index levels and Nifty 50 top gainers/losers |
| POST | `/api/analyze` | Run a full portfolio analysis |

---

### GET `/api/health`

```json
{ "status": "ok" }
```

### GET `/api/benchmarks`

```json
[
  { "ticker": "^NSEI", "name": "Nifty 50", "region": "India" },
  { "ticker": "^BSESN", "name": "S&P BSE Sensex", "region": "India" },
  { "ticker": "^NSEBANK", "name": "Nifty Bank", "region": "India" },
  { "ticker": "^CNXIT", "name": "Nifty IT", "region": "India" },
  { "ticker": "^GSPC", "name": "S&P 500", "region": "United States" },
  { "ticker": "^NDX", "name": "Nasdaq 100", "region": "United States" }
]
```

Any other Yahoo Finance symbol can also be used as a benchmark in `/api/analyze`.

### GET `/api/tickers/validate`

Query: `symbol` (1–20 chars). The symbol is upper-cased and pattern-checked, then the last 21
days of prices are requested.

```json
{ "ticker": "TCS.NS", "valid": true, "name": "TATA CONSULTANCY SERV LT",
  "last_price": 3125.4, "last_date": "2026-11-17" }
```

Unknown symbol → `200` with `"valid": false` and nulls. Malformed symbol → `422 invalid_input`.
Data source down → `503 data_unavailable`.

---

### POST `/api/analyze`

#### Request

```json
{
  "holdings": [
    { "ticker": "RELIANCE.NS", "weight": 0.4 },
    { "ticker": "TCS.NS", "weight": 0.3 },
    { "ticker": "INFY.NS", "weight": 0.3 }
  ],
  "start_date": "2021-11-18",
  "end_date": "2026-11-18",
  "benchmark": "^NSEI",
  "initial_investment": 100000,
  "risk_free_rate": 0.065
}
```

| Field | Type | Required | Default | Rules |
|---|---|---|---|---|
| `holdings` | array | yes | — | 1–25 items; tickers unique (case-insensitive) |
| `holdings[].ticker` | string | yes | — | Upper-cased; must match `^[A-Z0-9^][A-Z0-9.\-=&^]{0,19}$` |
| `holdings[].weight` | number | yes | — | `0 < w ≤ 1`; all weights sum to 1 ± 0.0001 |
| `start_date` | date | yes | — | ≥ 1990-01-01 |
| `end_date` | date | yes | — | Not in the future; ≥ 30 days after `start_date` |
| `benchmark` | string | no | `^NSEI` | Same pattern as tickers |
| `initial_investment` | number | no | `100000` | `> 0`, ≤ 1e13 |
| `risk_free_rate` | number | no | `0.065` | `−0.05 ≤ r ≤ 0.5` (annual, as a fraction) |
| `live` | boolean | no | `false` | Use the latest intraday price as today's price. Applied only when `end_date` is within the last 5 days |

#### Response `200`

```jsonc
{
  "meta": {
    "requested_start": "2021-11-18", "requested_end": "2026-11-18",
    "start_date": "2021-11-18", "end_date": "2026-11-18",   // effective, after alignment
    "trading_days": 1236, "years": 4.999,
    "benchmark": "^NSEI", "benchmark_name": "Nifty 50",
    "initial_investment": 100000, "risk_free_rate": 0.065,
    "rebalancing": "daily", "price_basis": "adjusted_close"
  },
  "summary": {
    "initial_value": 100000, "ending_value": 96977.1, "profit_loss": -3022.9,
    "total_return": -0.0302, "cagr": -0.0061, "benchmark_ending_value": 142000.5
  },
  "portfolio": {
    "total_return": -0.0302, "cagr": -0.0061, "annualized_volatility": 0.184,
    "sharpe_ratio": -0.386, "max_drawdown": -0.375, "beta": 0.98
  },
  "benchmark": { "...": "same shape; beta is 1.0" },
  "drawdown": {
    "max_drawdown": -0.375, "peak_date": "2024-09-02", "trough_date": "2026-09-30",
    "recovery_date": null, "peak_to_trough_days": 758
  },
  "series": [
    { "date": "2021-11-18", "portfolio": 100.0, "benchmark": 100.0,
      "portfolio_value": 100000.0, "portfolio_drawdown": 0.0, "benchmark_drawdown": 0.0 }
    // … one point per aligned trading day
  ],
  "holdings": [
    { "ticker": "RELIANCE.NS", "name": "RELIANCE INDUSTRIES LTD", "weight": 0.4,
      "start_price": 1123.5, "end_price": 1370.2, "total_return": 0.2196, "contribution": 0.0878 }
  ],
  "insights": [
    { "id": "relative", "tone": "negative",
      "title": "Underperformed the Nifty 50 by 45.0 pp",
      "detail": "The portfolio returned -3.0% against +42.0% for the benchmark, …" }
  ],
  "data_quality": {
    "status": "adjusted",
    "warnings": ["Short gaps (at most 5 trading days) were forward-filled: ^NSEI (1). …"],
    "filled_points": { "^NSEI": 1 },
    "dropped_rows": 0
  }
}
```

(Numbers above are illustrative of shape; actual values depend on live data.)

`live` (present only when `live: true` and the period ends today, otherwise `null`):

```json
"live": {
  "as_of": "2026-11-26T15:29:00+05:30",
  "fetched_at": "2026-11-26T20:51:43Z",
  "market_open": false,
  "spliced": ["RELIANCE.NS", "TCS.NS", "INFY.NS", "^NSEI"],
  "quotes": [
    { "ticker": "RELIANCE.NS", "name": "RELIANCE INDUSTRIES LTD", "price": 1396.2,
      "previous_close": 1373.9, "change": 22.3, "change_pct": 0.0162,
      "time": "2026-11-26T15:28:00+05:30", "currency": "INR", "is_benchmark": false }
  ]
}
```

Field notes:
- `series[].portfolio` / `benchmark` are rebased to 100 on the first date.
- `series[].portfolio_drawdown` / `benchmark_drawdown` are ≤ 0.
- `sharpe_ratio` is `null` when volatility is zero; `beta` is `null` when benchmark variance is zero.
- `recovery_date` is `null` if the portfolio had not regained its peak by `end_date`.
- `live.spliced` lists the tickers whose latest price replaced (or was appended as) the last daily
  price; every other field in the response is computed from those spliced prices. Tickers without an
  intraday quote are omitted from `live.quotes` and use their daily history unchanged.
- `live.market_open` is a heuristic: true if any quote's latest bar is under 30 minutes old.
- `contribution` = `weight × total_return` (fraction; ×100 for percentage points).
- `insights[].id` ∈ `relative | best | worst | contributor | volatility | drawdown | beta`;
  `tone` ∈ `positive | negative | neutral`.

## Market data endpoints

### GET `/api/stocks`

| Query | Default | Notes |
|---|---|---|
| `q` | `""` | Name, NSE symbol, BSE code/symbol or ISIN (at most 60 chars). Ranked: exact symbol, symbol prefix, name prefix, word prefix, substring; ties favour Nifty 500 members, then NSE listings |
| `exchange` | `all` | `all`, `nse` or `bse` |
| `industry` | none | NSE industry label (Nifty 500 members only) |
| `offset`, `limit` | `0`, `25` | `limit` at most 100 |

```json
{ "total": 3, "offset": 0, "limit": 25, "items": [
  { "name": "HDFC Bank Limited", "isin": "INE040A01034", "nse_symbol": "HDFCBANK", "bse_code": "500180",
    "bse_symbol": "HDFCBANK", "industry": "Financial Services", "ticker": "HDFCBANK.NS", "exchanges": ["NSE", "BSE"] } ] }
```

`ticker` is the Yahoo Finance symbol used for prices: `NSE_SYMBOL.NS`, or `BSE_SYMBOL.BO` for BSE-only companies.

### GET `/api/quotes?tickers=RELIANCE.NS,TCS.NS`

Returns one object per ticker Yahoo has data for (unknown tickers are omitted):
`{ ticker, price, previous_close, change, change_pct, time, intraday }`. `intraday: false` means only a
daily close was available. Cached 60 s per server instance. More than 60 tickers returns `422`.

### GET `/api/stock/{ticker}`

`{ ticker, name, company, quote, currency, sector, industry, website, description, employees, location, stats }`
where `stats` has `market_cap`, `pe_ratio`, `price_to_book`, `beta`, `dividend_yield_pct` (already a
percentage), `week52_high/low`, `day_high/low`, `volume`, `avg_volume`, each `null` when Yahoo has no
value. `company` is the directory entry (or `null` for indices and non-Indian symbols). An unknown
ticker returns `404 not_found`.

### GET `/api/stock/{ticker}/history?range=1y`

`range` is one of `1d` (5-minute bars), `5d` (15-minute), `1m`, `6m`, `1y` (daily), `5y` (weekly), `max`
(monthly). Returns `{ ticker, range, intraday, points: [{ t, p }] }` with **unadjusted** quoted prices.
For daily ranges the latest intraday price is appended when Yahoo's daily bars lag a session.

### GET `/api/market/overview`

`{ as_of, indices: [...], gainers: [...], losers: [...], universe: "Nifty 50" }`; each entry is a quote
with a `name`. Gainers and losers are the top five Nifty 50 members by today's % change (only positive
or negative moves respectively are listed).

## Errors

Every error has the same envelope:

```json
{ "error": "<code>", "message": "<human-readable sentence>", "details": <object | array | null> }
```

| HTTP | `error` | When | `details` |
|---|---|---|---|
| 422 | `validation_error` | Request body fails schema rules (weights ≠ 100%, duplicate ticker, bad dates, out-of-range numbers, malformed symbol) | `[{ "field": "holdings.0.weight", "message": "…" }]` |
| 422 | `invalid_ticker` | A holding or the benchmark has no price data in the window | `{ "tickers": ["FAKE.NS"] }` |
| 422 | `insufficient_data` | No overlapping history, or < 3 aligned trading days | `null` |
| 404 | `not_found` | Unknown stock ticker on `/api/stock/{ticker}` | `null` |
| 422 | `invalid_input` | Other invalid value (e.g. malformed `symbol` on validate) | `null` |
| 503 | `data_unavailable` | Yahoo Finance unreachable or rate-limiting after retries | `null` |
| 500 | `internal_error` | Unexpected server error (logged server-side; no internals leaked) | `null` |

Example:

```json
{
  "error": "validation_error",
  "message": "Weights must total 100%. Current total is 110.00%.",
  "details": [{ "field": null, "message": "Weights must total 100%. Current total is 110.00%." }]
}
```

## CORS

Allowed origins: `http://localhost:5173`, `http://127.0.0.1:5173` (the Vite dev server). In
single-process mode the frontend is same-origin and CORS is not involved.
