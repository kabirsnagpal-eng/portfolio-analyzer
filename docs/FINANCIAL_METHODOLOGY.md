# Financial Methodology

This document explains every number Folio reports: the formula, what each symbol means, why the
metric matters, a worked example, the assumptions behind it, its limitations, and exactly where and
how the application implements it.

**Units.** Internally and in the API, all returns, weights, rates and drawdowns are **decimal
fractions** (0.065 = 6.5%). The UI converts to percentages for display. "pp" means percentage points.

**Conventions at a glance**

| Convention | Value | Used for |
|---|---|---|
| Trading days per year | 252 | Annualising daily volatility |
| Days per year | 365.25 (calendar) | Number of years in CAGR |
| Standard deviation / covariance | Sample (ddof = 1) | Volatility, beta |
| Price basis | Split- and dividend-adjusted close | All returns |
| Rebalancing | Daily, to target weights | Portfolio returns |
| Annualised return in Sharpe | CAGR | Sharpe ratio |

---

## 1. Simple returns vs compound returns

**Formula — daily simple return**

  rₜ = Pₜ / Pₜ₋₁ − 1

| Symbol | Meaning |
|---|---|
| Pₜ | Adjusted closing price on trading day t |
| Pₜ₋₁ | Adjusted closing price on the previous aligned trading day |
| rₜ | Simple (arithmetic) return for day t |

**Compounding.** Returns over several days are combined by *multiplying growth factors*, not by
adding returns:

  Total return = (1 + r₁)(1 + r₂)…(1 + r_T) − 1

**Why it matters.** Adding returns is a common and costly mistake. Losses hurt more than equal-sized
gains help, because the loss applies to a larger base.

**Worked example** (the case used in the test suite): a stock moves ₹100 → ₹110 → ₹99.

- Day 1: 110 / 100 − 1 = **+10%**
- Day 2: 99 / 110 − 1 = **−10%**
- Sum of returns: 0% ← wrong
- Compound: 1.10 × 0.90 − 1 = **−1%** ← correct (and equals 99 / 100 − 1)

**Assumptions.** Prices are positive and already adjusted for corporate actions. The first day of
the window has no previous price, so it has **no return** (it is dropped, not reported as 0%).

**Limitations.** Simple returns are not additive over time (log returns are, but are less
intuitive and not additive across assets). Folio uses simple returns because they *are* additive
across assets in a portfolio on a given day, which daily weighting requires.

**Implementation.** `backend/app/finance/returns.py` → `daily_returns()` (vectorised
`prices / prices.shift(1) − 1`, first row dropped, non-positive prices rejected) and
`total_return_from_returns()` (`prod(1 + r) − 1`). Tested in `tests/test_returns.py`
(`test_daily_returns_100_110_99`, `test_cumulative_return_is_not_sum_of_returns`).

---

## 2. Portfolio weights and portfolio returns

**Formula**

  R_p,t = Σᵢ wᵢ · rᵢ,t      with Σᵢ wᵢ = 1

| Symbol | Meaning |
|---|---|
| wᵢ | Target weight of holding i (fraction of portfolio value) |
| rᵢ,t | Simple return of holding i on day t |
| R_p,t | Portfolio return on day t |

**Why it matters.** It turns a set of individual return series into the single return stream that
all portfolio metrics are built from.

**Worked example.** Weights 50% / 30% / 20%; day returns +10%, 0%, −4%:
R = 0.5×0.10 + 0.3×0 + 0.2×(−0.04) = **+4.2%**.

**Weight validation.** Each weight must be finite, > 0 and ≤ 100%; weights must total 100% within
±0.01 pp (`WEIGHT_SUM_TOLERANCE = 1e-4`). The tolerance absorbs inputs like 33.33 + 33.33 + 33.34
or binary floating-point residue, without accepting genuinely wrong allocations. After validation,
`normalize_weights()` divides by the sum so the arithmetic uses weights that sum to exactly 1.

**Implementation.** `finance/validation.py` → `validate_weights()`; `finance/returns.py` →
`normalize_weights()`, `portfolio_daily_returns()` (a matrix–vector product
`returns.to_numpy() @ weights`; refuses NaNs so gaps can never be silently treated as 0%).

---

## 3. Daily rebalancing

**What it means.** Applying the *same* target weights every day (Section 2) is mathematically
identical to selling winners and buying losers at every close so the portfolio returns to its
target mix. This is the assumption Folio makes, and it is shown in the UI ("rebalanced daily").

**Why this assumption.** It makes the portfolio a stable, well-defined object (a fixed mix), lets
weights be interpreted directly, and is the standard way index-style "constant-mix" portfolios are
modelled.

**How it differs from buy-and-hold.** A buy-and-hold portfolio buys once and lets weights drift.

Worked example (from the tests): two assets at 50/50. A goes 100 → 200 → 100; B stays at 100.

- Daily-rebalanced: day 1 R = 0.5×(+100%) = +50%; day 2 R = 0.5×(−50%) = −25%;
  total = 1.5 × 0.75 − 1 = **+12.5%**
- Buy-and-hold: both assets end where they started → **0%**

Rebalancing harvested the round trip in A. With trending assets, the opposite can happen:
rebalancing sells the winner too early and underperforms buy-and-hold.

**Limitations.** Real investors cannot rebalance daily for free: brokerage, taxes, bid–ask spread
and market impact would all reduce returns (see `LIMITATIONS.md`).

---

## 4. Portfolio value and total return

**Formulas**

  V₀ = initial investment,  Vₜ = Vₜ₋₁ · (1 + R_p,t)

  Total return = V_T / V₀ − 1

| Symbol | Meaning |
|---|---|
| V₀ | Initial investment (default ₹1,00,000), placed on the first aligned trading day |
| Vₜ | Portfolio value at the close of day t |
| V_T | Ending value on the last aligned trading day |

**Why it matters.** It is the headline answer to "how much did I make or lose?".

**Worked example.** ₹1,00,000 with daily returns +10%, −10% → ₹1,10,000 → ₹99,000.
Total return = 99,000 / 1,00,000 − 1 = **−1%**; profit/loss = **−₹1,000**.

**Rebasing for charts.** The performance chart shows both portfolio and benchmark as
`Vₜ / V₀ × 100` ("growth of 100") so lines that started at different price levels are directly
comparable. When the user picks a shorter range, the UI re-bases to 100 at the start of that range.

**Implementation.** `finance/returns.py` → `value_series()`, `rebase()`, `total_return()`.
The service layer builds the same value path for the benchmark from its own daily returns, so both
are compounded identically.

---

## 5. CAGR — compound annual growth rate

**Formula**

  CAGR = (V_end / V_start)^(1 / years) − 1,  years = (end date − start date in days) / 365.25

| Symbol | Meaning |
|---|---|
| V_start, V_end | Value on the first and last aligned trading days |
| years | Elapsed **calendar** time in years |

**Meaning.** CAGR is the *annualised compounded growth rate*: the single constant yearly return
that would have turned the starting value into the ending value over the same length of time.

**Why it matters.** Total returns over different period lengths are not comparable (30% over two
years is very different from 30% over ten). CAGR puts them on a per-year basis.

**Worked example.** ₹1,00,000 grows to ₹1,61,051 in exactly 5 years:
(1,61,051 / 1,00,000)^(1/5) − 1 = 1.61051^0.2 − 1 = **10.0%** a year.

**Assumptions.** Calendar years (365.25 days) because elapsed time is a calendar quantity. If the
portfolio is wiped out (V_end ≤ 0) CAGR is reported as −100%.

**Limitations.** CAGR hides the path: a smooth 10% and a volatile 10% have the same CAGR. For
periods shorter than a year it *extrapolates* — a 5% gain over three months becomes ~21.6% a year —
so treat short-window CAGRs with care.

**Implementation.** `finance/metrics.py` → `years_between()`, `cagr()`, `cagr_from_values()`.
Tested in `tests/test_metrics.py` (doubling, one-year identity, losses, calendar-year use).

---

## 6. Annualised volatility

**Formula**

  σ_annual = σ_daily × √252,  σ_daily = sample standard deviation of daily returns (ddof = 1)

| Symbol | Meaning |
|---|---|
| σ_daily | How widely daily returns scatter around their mean |
| 252 | Approximate number of trading days in a year |

**Why it matters.** Volatility is the most common measure of risk as "uncertainty of returns":
higher volatility means a bumpier ride and a wider range of plausible outcomes.

**Worked example.** σ_daily = 1.2% → 0.012 × √252 = 0.012 × 15.87 = **19.05%** a year.

**Assumptions.** The square-root-of-time rule assumes daily returns are independent and identically
distributed. Sample (n − 1) standard deviation. A series of identical returns has volatility
exactly 0 (values below 1e-12 are treated as zero floating-point noise).

**Limitations.** Treats upside and downside moves the same; underestimates tail risk when returns
have fat tails or are autocorrelated; depends on the period chosen. NSE has roughly 245–250
sessions a year, so 252 is a convention rather than an exact count.

**Implementation.** `finance/metrics.py` → `annualized_volatility()`. Computed for both the
portfolio and the benchmark from their aligned daily returns.

---

## 7. Sharpe ratio

**Formula**

  Sharpe = (R_annual − r_f) / σ_annual

| Symbol | Meaning |
|---|---|
| R_annual | Annualised portfolio return — **Folio uses CAGR** |
| r_f | Annual risk-free rate (user input, default 6.5%) |
| σ_annual | Annualised volatility (Section 6) |

**Why it matters.** It measures return *per unit of risk* above what a riskless asset would have
paid, making portfolios with different risk levels comparable.

**Worked example.** CAGR 14%, r_f 6.5%, σ 18% → (0.14 − 0.065) / 0.18 = **0.42**.
A negative Sharpe means the portfolio earned less than the risk-free rate.

**Assumptions.**
- **Risk-free rate is an assumption.** 6.5% approximates recent Indian government bond yields; it
  is *not* a live or permanently fixed rate. The user can change it in the configurator.
- **CAGR as the annualised return.** The textbook form often uses the arithmetic mean daily return
  × 252. Folio uses CAGR so the Sharpe ratio is consistent with the return figure shown elsewhere
  on the page. The arithmetic version is typically higher by roughly σ²/2; the choice is documented
  here and in the UI tooltip.
- **Zero volatility.** If σ = 0 the ratio is undefined. Folio returns `null` and the UI shows
  "Not defined" rather than ±∞ or an invented number.

**Limitations.** Penalises upside volatility as much as downside; assumes returns are roughly
normal; sensitive to the period and to the r_f assumption; not meaningful for very short windows.

**Implementation.** `finance/metrics.py` → `sharpe_ratio()`; applied in
`services/analysis.py::_side_metrics()` to both portfolio and benchmark with the same r_f.

---

## 8. Maximum drawdown

**Formula**

  DDₜ = Vₜ / max(V₀ … Vₜ) − 1,   Maximum drawdown = minₜ DDₜ

| Symbol | Meaning |
|---|---|
| max(V₀…Vₜ) | Running peak: the highest value reached so far |
| DDₜ | How far below that peak the portfolio is on day t (0 at a new high, negative otherwise) |

**Why it matters.** It answers "what is the worst loss I would have sat through if I had invested
at the worst moment?". It captures the path-dependence that CAGR and volatility miss.

**Worked example** (from the tests). Values 100, 120, 90, 110, 60, 80, 130.
Peak before the low = 120; low = 60 → 60 / 120 − 1 = **−50%**. Recovery happens when the value
first gets back to ≥ 120 (here at 130, the last day).

**Episode dates.** Folio also reports:
- *Trough date* — the day of the most negative drawdown;
- *Peak date* — the last running high before the trough;
- *Recovery date* — the first later day the value regains the peak, or `null` if it never does
  within the window;
- *Peak-to-trough days* — calendar days between peak and trough.

**Assumptions.** Measured on the daily-close value path (intraday lows are not seen). Displayed as
a negative percentage. A series that only rises has drawdown 0 and no episode dates.

**Limitations.** One number describes one episode; it says nothing about how frequent drawdowns
are. It is also window-dependent — the worst drawdown may have happened just outside your dates.

**Implementation.** `finance/metrics.py` → `drawdown_series()` (`values / values.cummax() − 1`)
and `max_drawdown()` returning a `DrawdownEpisode`. The full drawdown series for portfolio and
benchmark is sent to the UI for the underwater chart, and the episode is shaded there.

---

## 9. Beta

**Formula**

  β = Cov(R_p, R_b) / Var(R_b)

| Symbol | Meaning |
|---|---|
| R_p | Portfolio daily returns |
| R_b | Benchmark daily returns on the **same dates** |
| Cov, Var | Sample covariance and variance (ddof = 1) |

**Why it matters.** Beta measures sensitivity to the market: β = 1 moves one-for-one with the
benchmark on average; β = 1.2 tends to amplify market moves by 20%; β = 0.8 dampens them.

**Worked example.** Cov = 0.00012 and Var(R_b) = 0.00010 → β = **1.2**. In the tests, a portfolio
whose returns are exactly 1.5 × the benchmark's has β = 1.5.

**Assumptions.** Returns are aligned by date (inner join); the relationship is linear and stable
over the window. If the benchmark has zero variance, β is undefined and returned as `null`. The
benchmark's own beta is 1 by definition.

**Limitations.** Historical and backward-looking; can change materially across periods; low
correlation makes beta a poor summary (a stock can have β ≈ 0 and still be very risky); daily
returns across markets with different closing times understate co-movement.

**Implementation.** `finance/metrics.py` → `beta()`, using `np.cov` and `np.var` with `ddof=1`
after `pd.concat(..., join="inner").dropna()`.

---

## 10. Contribution analysis

**Formula**

  Contributionᵢ = wᵢ × TRᵢ,  TRᵢ = P_i,end / P_i,start − 1

| Symbol | Meaning |
|---|---|
| wᵢ | Initial (target) weight of holding i |
| TRᵢ | Holding i's own total return over the window (adjusted prices) |

**Why it matters.** It shows which holdings drove the result and which held it back.

**Worked example.** A 40% position that returned +25% contributes 0.40 × 0.25 = **+10 pp**.

**Important caveat (shown in the UI).** This is a *simple holding-level attribution under the
initial-weight convention*. It would sum exactly to the portfolio's return for a buy-and-hold
portfolio, but Folio's portfolio is rebalanced daily, so **the contributions do not in general sum
to the reported portfolio total return**, and they are **not a decomposition of CAGR**. The
holdings table shows both the sum of contributions and the actual portfolio return so the gap is
visible.

**Implementation.** `finance/attribution.py` → `contribution()`, `contributions()`; holding
returns computed from the first and last aligned adjusted prices in `services/analysis.py`.

---

## 11. Insights

Insights are deterministic sentences produced by `finance/insights.py::generate_insights()` from
numbers already computed above:

| Insight | Rule |
|---|---|
| Relative performance | Portfolio vs benchmark total return (pp) and CAGR difference |
| Best / weakest performer | Max / min holding total return |
| Largest contributor | Max contribution |
| Volatility | Ratio of portfolio to benchmark volatility (within ±5% → "in line") |
| Deepest decline | Max drawdown with peak, trough and recovery status |
| Beta | Historical sensitivity, explicitly labelled "not a forecast" |

There are no forecasts, scores or recommendations; a test asserts the text never contains words
such as "buy", "sell", "should" or "recommend".
