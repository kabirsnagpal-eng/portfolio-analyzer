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

**Pages**

| Page | URL | What it does |
|---|---|---|
| Home | `/` | Scroll-driven product story and an overview of every feature |
| Markets | `/markets` | Live Nifty 50, Sensex, Nifty Bank and Nifty IT; the day's top gainers and losers among Nifty 50 stocks; a searchable, filterable directory of **every NSE and BSE listed company** (4,800+) with live prices |
| Stock | `/stock/:ticker` | Price chart (1D, 5D, 1M, 6M, 1Y, 5Y, Max), live price, market cap, P/E, P/B, dividend yield, 52-week range, company description and listing details |
| Analyze | `/analyze` | The portfolio builder and dashboard |
| Watchlist | `/watchlist` | Starred stocks with live prices (stored in the browser); analyze the whole list as a portfolio in one click |
| Methodology | `/methodology` | Every formula and assumption |
| About | `/about` | Problem, audience, proposed business model and roadmap |

**Market-wide features**
- Global search (Ctrl/Cmd + K or `/`) across every listed company by name, NSE symbol, BSE code or ISIN
- Company lists built from the exchanges' official files (NSE's equity master list and BSE's daily
  bhavcopy), merged by ISIN, restricted to equity shares, with NSE industry labels for the Nifty 500
- Share an analysis as a link that re-runs it for whoever opens it; export results as CSV

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

**Live prices**
- When the period ends today, the latest Yahoo Finance 1-minute price is used as today's price, so the
  overview, charts, metrics, holdings and insights all reflect it
- A live panel shows each holding's and the benchmark's latest price, today's change and the bar time
  (exchange time), with market open/closed status
- Auto-update re-runs the analysis every minute while the market is open (every 5 minutes when closed),
  in place and without replaying animations; pauses in background tabs; manual Refresh button

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

## Refreshing the company list

The NSE/BSE directory is a committed snapshot. To refresh it (new listings, delistings, index changes):

```bash
cd backend
.\.venv\Scripts\python.exe scripts\update_listings.py
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
│   │   ├── api/routes.py        # Analysis endpoints (thin)
│   │   ├── api/markets.py       # Directory, quotes, stock pages, market overview
│   │   ├── schemas/             # Pydantic models: portfolio.py (analysis), markets.py (market data)
│   │   ├── services/analysis.py # Orchestration: fetch → clean → compute → assemble
│   │   ├── data/
│   │   │   ├── market_data.py   # yfinance provider: prices, quotes, profiles, history, caching
│   │   │   ├── listings.py      # NSE + BSE company directory and search
│   │   │   ├── listings.json    # generated by scripts/update_listings.py
│   │   │   ├── live.py          # live quotes spliced into daily history
│   │   │   └── cleaning.py      # calendar alignment, bounded forward-fill, quality report
│   │   └── finance/             # Pure, framework-free calculations
│   │       ├── returns.py       # daily, portfolio, value path, rebasing, total return
│   │       ├── metrics.py       # CAGR, volatility, Sharpe, drawdown, beta
│   │       ├── attribution.py   # contribution analysis
│   │       ├── validation.py    # weight validation
│   │       └── insights.py      # rule-based descriptive observations
│   ├── scripts/update_listings.py  # refreshes the NSE/BSE company list
│   ├── tests/                   # pytest suite (83 tests)
│   ├── requirements.txt         # runtime deps (requirements-dev.txt adds pytest)
│   └── pytest.ini
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Layout and routes
│   │   ├── pages/               # Home, Markets, Stock, Analyze, Watchlist, About, Methodology, 404
│   │   ├── sections/            # Hero, Statement, HowItWorks, Configurator, Methodology, dashboard/*
│   │   ├── charts/              # Performance, Drawdown, Allocation, Stock price charts + theme
│   │   ├── components/          # Nav, SearchPalette, market widgets, InfoTip, AnimatedNumber
│   │   ├── hooks/               # useAnalysis, useLiveRefresh, useQuotes, useWatchlist, animation hooks
│   │   ├── lib/                 # format, portfolio (form model), share (links + CSV), gsap setup
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
