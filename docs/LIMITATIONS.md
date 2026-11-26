# Limitations

Folio reports historical, descriptive statistics. Every number is correct *for the model it
computes*, but that model simplifies reality. Understanding the gaps matters more than any single
metric.

## Survivorship bias
You choose the holdings today, with hindsight. Companies that went bankrupt, were delisted or
shrank out of relevance are rarely the ones people type in — so back-tested portfolios of
"familiar names" systematically look better than what an investor could have picked at the start.
Yahoo Finance may also lack price history for delisted securities, which removes them from analysis
entirely.

## Look-ahead bias
Using information that was not available at the time. Folio's calculations themselves do not peek
ahead (each day's return uses only that day's and the previous day's prices), but two subtler forms
remain:
- **Selection with hindsight** (above).
- **Adjusted prices are revised later.** Dividend adjustment rescales *past* prices using
  dividends paid *afterwards*. Returns are still correct, but the "start price" shown is not the
  price an investor actually saw on that day.

## Live prices are near-real-time, not tick-by-tick
"Live" means the latest 1-minute bar Yahoo Finance publishes. It can lag the exchange by a few minutes,
the dashboard refreshes at most once a minute, and Yahoo may rate-limit frequent requests from cloud
servers. On an ex-dividend or split day, splicing today's raw price onto adjusted history can distort
that day's return until Yahoo restates the history. Exchange-grade real-time data requires a paid feed.

## Historical data limitations
- Yahoo Finance via yfinance is unofficial and has no service guarantee; data can be missing,
  delayed, duplicated or wrong, particularly for small caps and older Indian data.
- Gaps of ≤ 5 trading days are forward-filled (0% return on those days); longer gaps are excluded
  and disclosed. Either way, the result differs slightly from a perfectly complete series.
- Different exchanges close at different times; daily returns of an Indian stock and a US index
  for the "same date" are not simultaneous, which understates correlation and beta.

## Dividend adjustments
Returns use dividend-adjusted closes, i.e. they assume dividends were reinvested in the same stock
on the ex-date, with no dividend tax. Benchmarks such as `^NSEI` are **price** indices that exclude
dividends, so the comparison slightly favours the portfolio (by roughly the index's dividend
yield, ~1–1.5% a year for the Nifty 50). A total-return index would be the fairer benchmark.

## Daily rebalancing assumption
The portfolio returns to its target weights every day. Real portfolios rebalance occasionally (or
never) and their weights drift. Daily rebalancing helps in mean-reverting, choppy markets and hurts
in strongly trending ones relative to buy-and-hold. It is also why holding contributions do not sum
exactly to the portfolio return.

## Trading costs and taxes
Ignored entirely: brokerage, securities transaction tax (STT), stamp duty, exchange and SEBI fees,
GST on brokerage, depository charges, and short/long-term capital-gains tax. Daily rebalancing would
in practice generate substantial turnover and therefore substantial costs, so real-world returns
would be lower than shown.

## Slippage
All trades are assumed to execute exactly at the closing price, in any size, with no bid–ask spread
or market impact. Illiquid stocks in particular could not be traded this way.

## Benchmark selection
A benchmark only makes sense if it reflects the same opportunity set. Comparing a portfolio of three
IT stocks with the Nifty 50 measures sector choice as much as stock choice; comparing Indian stocks
with the S&P 500 mixes currencies. Choose the benchmark that matches the question you are asking.

## Currency
Each security's return is measured in its own trading currency; there is no FX conversion. A
portfolio mixing INR and USD securities is therefore not the return any single investor would have
experienced. The initial-investment currency (₹) is a label for scaling, not a conversion.

## Limitations of volatility and the Sharpe ratio
- Volatility treats upside and downside surprises the same way.
- Annualising with √252 assumes independent, identically distributed returns; real returns show
  volatility clustering and fat tails, so extreme losses are more likely than a normal model implies.
- The Sharpe ratio inherits these issues, depends heavily on the risk-free rate assumed (default
  6.5%, user-adjustable — not a live yield), and uses CAGR as the annual return (see methodology).
- All of these statistics are sensitive to the start and end dates chosen.
- Short windows (well under a year) produce unstable, extrapolated annualised figures.

## Past performance does not guarantee future results
Every metric describes one historical path. Markets, businesses, valuations and interest rates
change. A high historical CAGR or Sharpe ratio is not evidence that the same will happen again, and
Folio deliberately makes no forecasts or recommendations.
