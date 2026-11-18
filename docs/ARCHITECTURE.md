# Architecture

Folio is a two-tier application: a **React single-page app** that owns presentation and interaction,
and a **Python API** that owns data acquisition and every financial calculation. The two communicate
over a small JSON HTTP API.

```text
┌────────────────────────────── Browser ──────────────────────────────┐
│  React + TypeScript (Vite)                                          │
│                                                                     │
│  sections/Configurator ──► lib/portfolio.validateDraft (instant UX) │
│          │ toRequest()                                              │
│          ▼                                                          │
│  hooks/useAnalysis ──► services/api.analyze() ── POST /api/analyze ─┼──┐
│          ▲                                                          │  │
│          │ AnalyzeResponse (typed: types/api.ts)                    │  │
│  sections/dashboard/* + charts/*  (render only — no finance math)   │  │
└─────────────────────────────────────────────────────────────────────┘  │
                                                                         │
┌────────────────────────────── FastAPI ──────────────────────────────┐  │
│  api/routes.py          thin endpoints, dependency-injected provider│◄─┘
│      │                                                              │
│  schemas/portfolio.py   Pydantic validation (weights, dates, tickers)│
│      │                                                              │
│  services/analysis.py   orchestration: fetch → clean → compute      │
│      │            │                     │                           │
│      ▼            ▼                     ▼                           │
│  data/market_data  data/cleaning     finance/{returns,metrics,      │
│  (yfinance+cache)  (align, fill,      attribution,insights}         │
│      │              quality report)   pure functions, unit-tested   │
│      ▼                                                              │
│  Yahoo Finance  ◄── HTTPS                .cache/ (CSV per window)   │
└─────────────────────────────────────────────────────────────────────┘
```

## Responsibilities

| Concern | Lives in | Why there |
|---|---|---|
| Layout, animation, interaction | `frontend/src/sections`, `components`, `charts` | UI technology choice should not affect correctness |
| Instant form feedback | `frontend/src/lib/portfolio.ts` | Users get errors as they type, without a round-trip |
| Authoritative validation | `backend/app/schemas/portfolio.py` + `finance/validation.py` | Never trust the client; one source of truth |
| Price download, retry, cache | `backend/app/data/market_data.py` | Isolates the only network dependency behind a protocol |
| Cleaning and alignment | `backend/app/data/cleaning.py` | Pure function: raw series in, clean table + report out |
| Formulas | `backend/app/finance/*` | Pure, framework-free, individually tested |
| Orchestration | `backend/app/services/analysis.py` | The only module that knows both data and finance layers |
| HTTP concerns, error mapping | `backend/app/api/routes.py`, `main.py` | Kept thin so business logic is testable without HTTP |

**The frontend performs no financial calculations.** It only formats numbers the backend returned.
The single exception is the chart's range selector, which *re-bases* an already-computed series to
100 at the start of the visible window (a display transformation: `value / first × 100`).

## Request lifecycle (`POST /api/analyze`)

1. **Validation** — FastAPI parses the body into `AnalyzeRequest`. Field validators upper-case and
   pattern-check tickers; a model validator rejects duplicates, checks weights sum to 1 (±1e-4),
   that `end_date` is not in the future and the period is ≥ 30 days. Failures become a `422` with a
   human-readable `message` and per-field `details`.
2. **Fetch** — `run_analysis` asks the injected `PriceProvider` for every holding plus the
   benchmark. `YFinanceProvider` serves cached CSVs when fresh, otherwise downloads in parallel
   (thread pool) with retry and back-off. Unknown symbols raise `InvalidTickerError` → `422`;
   network failure / rate limiting raises `MarketDataUnavailableError` → `503`.
3. **Clean** — `align_prices` unions the trading calendars, trims to the common window, forward-fills
   only short gaps (≤ 5 rows), drops rows inside longer gaps, and records every change in a
   `DataQualityReport`.
4. **Compute** — returns → portfolio returns (daily rebalanced) → value paths → metrics, drawdown
   episode, beta, holding returns and contributions, insights.
5. **Assemble** — everything is packed into `AnalyzeResponse` (Pydantic), including the
   data-quality report, so the UI can disclose exactly what happened to the data.

## Frontend structure

```text
src/
├── App.tsx                 Page composition and the analyze → scroll-to-results flow
├── main.tsx                React root
├── index.css               Tailwind layers + component classes (.field, .btn-primary, .eyebrow …)
├── types/api.ts            Mirrors backend schemas (single place to update if the API changes)
├── services/api.ts         fetch wrapper → typed results or ApiError(code, message, status)
├── hooks/
│   ├── useAnalysis.ts      idle | loading | success | error state machine; aborts stale requests
│   ├── useReveal.ts        GSAP ScrollTrigger fade-up for [data-reveal] elements
│   ├── useCountUp.ts       IntersectionObserver + rAF number animation
│   └── useInView.ts        mount-on-visible (charts draw in when reached)
├── lib/
│   ├── portfolio.ts        Form draft model, validation, draft → request conversion
│   ├── format.ts           Currency (Indian grouping), %, pp, dates
│   └── gsap.ts             Plugin registration + media queries for motion
├── components/             Nav, InfoTip (accessible tooltip), AnimatedNumber
├── charts/                 PerformanceChart, DrawdownChart, AllocationDonut, theme (tokens, ticks)
└── sections/
    ├── Hero.tsx, Statement.tsx, HowItWorks.tsx, Configurator.tsx, Methodology.tsx (+ Footer)
    └── dashboard/          Dashboard (state switch), Overview, MetricsGrid, HoldingsTable,
                            Insights, DataQualityNotice, States (empty/loading/error), DashSection
```

State is deliberately simple: the configurator owns its draft in local state; `useAnalysis` owns
the request lifecycle; the dashboard is a pure function of the last `AnalysisState`. No global
store is needed.

## Technology choices

| Choice | Reason |
|---|---|
| **FastAPI + Pydantic** | Declarative validation with precise error messages, automatic OpenAPI docs at `/docs`, sync endpoints run in a worker thread so blocking pandas/yfinance work does not stall the event loop. |
| **pandas / NumPy** | Index-aligned time-series arithmetic is exactly what return series need; vectorised `@` for weighted returns. |
| **yfinance** | Free access to adjusted daily prices for NSE, BSE and global symbols. Wrapped behind a `PriceProvider` protocol so it can be replaced. |
| **Vite** (over Next.js) | The app is a single interactive page with no SEO-critical routes or server rendering needs; Vite gives the fastest dev loop and a static bundle FastAPI can serve. |
| **Tailwind CSS** | Design tokens in one config, consistent spacing/typography, no runtime cost. |
| **GSAP + ScrollTrigger** | Industry standard for scroll-scrubbed and pinned storytelling; `matchMedia` makes reduced-motion and mobile fallbacks first-class. |
| **Recharts** | Declarative React charts with custom tooltips/reference areas; smaller and easier to theme than Plotly for this scope. |
| **Vitest** | Shares Vite's TS pipeline for frontend unit tests. |

## Testing strategy

- **Unit tests** for every finance function using tiny hand-checkable series (e.g. 100 → 110 → 99).
- **Property-style checks**: β of `1.5 × benchmark` is 1.5; single-stock portfolio equals the stock;
  daily rebalancing differs from buy-and-hold in a known way (+12.5% vs 0%).
- **Cleaning tests**: holiday mismatches, long suspensions, late listings, delistings, no overlap.
- **API/integration tests**: a synthetic `PriceProvider` is injected via
  `app.dependency_overrides`, then the whole response is cross-checked against an independent NumPy
  computation. Error paths (invalid ticker, invalid benchmark, weights ≠ 100%, outage → 503,
  zero-volatility Sharpe → `null`) are covered.
- **Frontend**: `tsc --noEmit` (strict mode) and Vitest tests for validation and formatting.

## Deployment shape

- **Development:** Vite on `:5173` proxies `/api` to Uvicorn on `:8000`.
- **Production / demo:** `npm run build` emits `frontend/dist`; `create_app()` detects it and serves
  the SPA and assets from the same Uvicorn process, so one command runs the whole product.
- **Vercel:** `vercel.json` builds `frontend/` into static files and deploys `api/index.py` (which
  imports `backend/app`) as a Python serverless function. `/api/*` is rewritten to that function;
  FastAPI still sees the original path, so routing is identical to local development. The read-only
  code directory means the price cache moves to the function's temp directory (`VERCEL` env var).
- **Shares input mode** is purely a frontend concern: `lib/portfolio.ts` converts shares × buy price
  into cost weights and a total initial investment, so the API contract is the same for both modes.
- No secrets are required. The only external call is to Yahoo Finance.
