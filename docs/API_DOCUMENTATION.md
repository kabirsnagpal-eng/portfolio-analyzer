# API Documentation

Base URL (development): `http://127.0.0.1:8000`. Interactive OpenAPI docs: `/docs`; schema: `/openapi.json`.

All request and response bodies are JSON. **Weights, returns, rates and drawdowns are decimal
fractions** (0.4 = 40%). Dates are ISO `YYYY-MM-DD`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness check |
| GET | `/api/benchmarks` | Preset benchmark indices |
| GET | `/api/tickers/validate?symbol=…` | Check a symbol has recent prices; return its name |
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

Field notes:
- `series[].portfolio` / `benchmark` are rebased to 100 on the first date.
- `series[].portfolio_drawdown` / `benchmark_drawdown` are ≤ 0.
- `sharpe_ratio` is `null` when volatility is zero; `beta` is `null` when benchmark variance is zero.
- `recovery_date` is `null` if the portfolio had not regained its peak by `end_date`.
- `contribution` = `weight × total_return` (fraction; ×100 for percentage points).
- `insights[].id` ∈ `relative | best | worst | contributor | volatility | drawdown | beta`;
  `tone` ∈ `positive | negative | neutral`.

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
