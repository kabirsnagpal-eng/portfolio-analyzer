from datetime import date

from app.finance.insights import HoldingStat, SideStats, generate_insights


def _run(**kw):
    defaults = dict(
        holdings=[
            HoldingStat("A.NS", "Alpha", 0.50, 0.20),
            HoldingStat("B.NS", None, -0.10, -0.03),
            HoldingStat("C.NS", "Gamma", 0.20, 0.06),
        ],
        portfolio=SideStats(0.25, 0.12, 0.22, 0.25, -0.18),
        benchmark=SideStats(0.15, 0.07, 0.18, 0.03, -0.12),
        benchmark_label="Nifty 50",
        beta=1.1,
        peak_date=date(2022, 1, 3),
        trough_date=date(2022, 6, 17),
        recovery_date=None,
    )
    defaults.update(kw)
    return {i["id"]: i for i in generate_insights(**defaults)}


def test_insights_identify_best_worst_and_contributor():
    out = _run()
    assert "A.NS" in out["best"]["title"]
    assert "B.NS" in out["worst"]["title"] and out["worst"]["tone"] == "negative"
    assert "A.NS" in out["contributor"]["title"]


def test_relative_performance_and_volatility():
    out = _run()
    assert out["relative"]["title"].startswith("Outperformed the Nifty 50 by 10.0 pp")
    assert out["volatility"]["title"] == "22% more volatile than the benchmark"
    under = _run(portfolio=SideStats(0.05, 0.02, 0.10, -0.4, -0.05))
    assert under["relative"]["tone"] == "negative"
    assert "less volatile" in under["volatility"]["title"]


def test_drawdown_insight_mentions_non_recovery():
    out = _run()
    assert "-18.0%" in out["drawdown"]["title"]
    assert "had not regained" in out["drawdown"]["detail"]


def test_no_advice_language():
    text = " ".join(i["title"] + i["detail"] for i in _run().values()).lower()
    for word in ("buy", "sell", "should", "will rise", "recommend"):
        assert word not in text
