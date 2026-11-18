# Folio — Portfolio Analytics

**Understand your portfolio. Measure your performance. Make better-informed investment decisions.**

Folio is a full-stack portfolio analytics application. You enter a set of stock holdings and target
weights, pick a period and a benchmark index, and Folio downloads real split- and dividend-adjusted
prices, compounds a daily-rebalanced portfolio, and reports how it performed against the market:
growth, CAGR, volatility, Sharpe ratio, maximum drawdown, beta, holding-level contribution and
plain-language observations.

It is built as a premium, scroll-driven web experience (React + GSAP) on top of a tested
quantitative engine (Python + pandas).

> Descriptive analytics of historical data for educational use. **Not investment advice.**

---

## Features

**Portfolio configuration**
- Add, edit and remove up to 25 holdings (NSE `.NS`, BSE `.BO`, US and other Yahoo Finance symbols)
- Two input modes:
  - **By weight** — target weights with a live allocation meter, "split equally" and "load example"
  - **By shares** — number of shares and average buy price per holding; each holding's weight is its
    cost (shares × price) as a share of the total, and the total cost becomes the initial investment
- Quick periods (1Y/3Y/5Y/10Y) or custom start/end dates
- Benchmark presets (Nifty 50, Sensex, Nifty Bank, Nifty IT, S&P 500, Nasdaq 100) or any custom symbol
- Initial investment (default ₹1,00,000) and risk-free rate (default 6.5%)
- Instant client-side validation plus authoritative server-side validation; weights must total 100% (±0.01 pp)
- On-blur ticker lookup that shows the company name or flags unknown symbols

**Analytics** (each metric is a separate, unit-tested function)
- Daily simple returns, daily-rebalanced portfolio returns, compounded value path
- Total return, CAGR, annualised volatility (√252), Sharpe ratio, maximum drawdown with peak/trough/recovery dates, beta
- Holding-level start/end adjusted price, total return and contribution (weight × return)
- Rule-based insights: relative performance, best/worst holding, largest contributor, volatility vs benchmark, deepest drawdown, beta

**Data pipeline**
- yfinance adjusted closes, cached on disk (6 h for recent windows, 7 days for historical)
- Cross-market calendar alignment; bounded forward-fill (≤ 5 trading days) of short gaps only
- Long gaps, late listings and delistings are detected and disclosed, never silently filled
- Graceful handling of invalid tickers (422), outages and rate limits (503, with retry/back-off)

**Experience**
- Editorial hero with masked headline reveal and parallax
- Scroll-scrubbed statement, sticky "How it works" chapter with changing visuals
- Animated counters, charts that draw in when they enter the viewport
- Interactive performance chart (range selector, rich tooltip), drawdown "underwater" chart, allocation donut, sortable holdings table
- Loading, empty, error and data-quality states; reduced-motion support; responsive to phone width

## Screenshots

> Add screenshots here after running the app locally.
>
> `docs/screenshots/hero.png` · `docs/screenshots/configurator.png` · `docs/screenshots/dashboard.png`

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript 5, Vite 6, Tailwind CSS 3 |
| Motion | GSAP 3 + ScrollTrigger (`@gsap/react`) |
| Charts | Recharts 2 |
| Backend | Python 3.11+, FastAPI, Pydantic 2, Uvicorn |
| Quant | pandas, NumPy |
| Data | yfinance (Yahoo Finance) |
| Tests | pytest + FastAPI TestClient (backend), Vitest + `tsc --noEmit` (frontend) |

## Getting started

### Prerequisites
- **Python 3.11+** and **Node.js 20+**
- Internet access (prices are downloaded from Yahoo Finance)

### 1. Backend

Windows (PowerShell):
```bash
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
```

macOS / Linux:
```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/uvicorn app.main:app --port 8000
```

The API is now at http://127.0.0.1:8000 and interactive API docs at http://127.0.0.1:8000/api/docs.

### 2. Frontend (development)

In a second terminal:
```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. Vite proxies `/api` to the backend on port 8000.

### Single-process mode (production build)

```bash
cd frontend
npm run build
```

Then start only the backend (step 1). When `frontend/dist` exists, FastAPI serves the built app at
http://127.0.0.1:8000 alongside the API.

### Deploying to Vercel

The repository deploys as one Vercel project with two **services** (`vercel.json`):

| Service | Root | Framework | Public path |
|---|---|---|---|
| `backend` | `backend/` | FastAPI (`app/main.py`), deps from `backend/requirements.txt` | `/api/*` (docs at `/api/docs`) |
| `frontend` | `frontend/` | Vite static build | everything else |

The browser calls the API with same-origin relative URLs (`/api/...`), so the services need no
bindings or hard-coded hostnames. On Vercel the price cache lives in the function's temporary
directory, so it is per-instance and short-lived.

Import the GitHub repository in the Vercel dashboard (no settings to change); every push to `main`
redeploys.

Note: Yahoo Finance sometimes rate-limits requests coming from cloud data centres. If the deployed app
reports that market data is unavailable, wait a minute and retry.

### Windows convenience script

`run.ps1` at the project root starts both servers in separate windows:
```bash
powershell -ExecutionPolicy Bypass -File .\run.ps1
```

## Running the tests

```bash
cd backend
.\.venv\Scripts\python.exe -m pytest        # Windows
.venv/bin/pytest                            # macOS / Linux
```

```bash
cd frontend
npm run typecheck
npm test
```

The backend suite uses synthetic, deterministic price data (no network) and checks every formula
against hand-computed or independently computed values — including the 100 → 110 → 99 example
(+10%, −10%, cumulative −1%).

## Project structure

```text
portfolio-analyzer/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app factory, error handlers, static hosting
│   │   ├── api/routes.py        # HTTP endpoints (thin)
│   │   ├── schemas/portfolio.py # Pydantic request/response models + input validation
│   │   ├── services/analysis.py # Orchestration: fetch → clean → compute → assemble
│   │   ├── data/
│   │   │   ├── market_data.py   # yfinance provider, retry, disk cache, names
│   │   │   └── cleaning.py      # calendar alignment, bounded forward-fill, quality report
│   │   └── finance/             # Pure, framework-free calculations
│   │       ├── returns.py       # daily, portfolio, value path, rebasing, total return
│   │       ├── metrics.py       # CAGR, volatility, Sharpe, drawdown, beta
│   │       ├── attribution.py   # contribution analysis
│   │       ├── validation.py    # weight validation
│   │       └── insights.py      # rule-based descriptive observations
│   ├── tests/                   # pytest suite (67 tests)
│   ├── requirements.txt         # runtime deps (requirements-dev.txt adds pytest)
│   └── pytest.ini
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Page composition
│   │   ├── sections/            # Hero, Statement, HowItWorks, Configurator, Methodology, dashboard/*
│   │   ├── charts/              # PerformanceChart, DrawdownChart, AllocationDonut, chart theme
│   │   ├── components/          # Nav, InfoTip, AnimatedNumber
│   │   ├── hooks/               # useAnalysis, useCountUp, useReveal, useInView
│   │   ├── lib/                 # format, portfolio (form model + validation), gsap setup
│   │   ├── services/api.ts      # Typed API client
│   │   └── types/api.ts         # Types mirroring backend schemas
│   ├── package.json, vite.config.ts, tailwind.config.js, tsconfig.json

├── docs/                        # Architecture, methodology, pipeline, API, design system, limitations

├── vercel.json                  # Vercel services: frontend (static) + backend (FastAPI)
├── run.ps1
└── README.md
```

## Documentation

| Document | What it covers |
|---|---|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Components, data flow, design decisions, file-by-file guide |
| [FINANCIAL_METHODOLOGY.md](docs/FINANCIAL_METHODOLOGY.md) | Every formula with variables, examples, assumptions, limitations, implementation |
| [DATA_PIPELINE.md](docs/DATA_PIPELINE.md) | yfinance, adjusted prices, alignment, gap handling, caching |
| [API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) | Endpoints, payloads, validation rules, error codes |
| [DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Typography, colour, spacing, components, motion, accessibility |
| [LIMITATIONS.md](docs/LIMITATIONS.md) | Biases, assumptions and what the numbers cannot tell you |

## Known limitations

- Prices come from Yahoo Finance through an unofficial library; data can be delayed, revised,
  missing, or rate-limited. The very first request after start-up can take noticeably longer while
  yfinance establishes a session.
- The portfolio is **rebalanced daily** to target weights; no transaction costs, taxes or slippage.
- Returns of securities on different exchanges are each in their own currency — no FX conversion.
- Contribution uses the initial-weight convention and does not sum exactly to the portfolio return.
- The risk-free rate is a user-supplied constant, not a live yield curve.
- Survivorship and selection bias: you choose today's names with hindsight.

See [LIMITATIONS.md](docs/LIMITATIONS.md) for the full discussion.
