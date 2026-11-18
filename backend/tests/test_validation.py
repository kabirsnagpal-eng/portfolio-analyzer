import pytest
from pydantic import ValidationError

from app.finance.validation import AllocationError, validate_weights
from app.schemas.portfolio import AnalyzeRequest


def test_valid_weights_pass():
    validate_weights({"A": 0.4, "B": 0.3, "C": 0.3})
    validate_weights({"A": 0.3333, "B": 0.3333, "C": 0.3334})


def test_floating_point_tolerance():
    validate_weights({"A": 0.1, "B": 0.2, "C": 0.7000000000000001})


@pytest.mark.parametrize(
    "weights, fragment",
    [
        ({"A": 0.5, "B": 0.4}, "total 100%"),
        ({"A": 0.6, "B": 0.6}, "total 100%"),
        ({"A": 1.0, "B": 0.0}, "greater than 0"),
        ({"A": 1.2, "B": -0.2}, "cannot exceed"),
        ({"A": float("nan")}, "finite"),
        ({}, "at least one"),
    ],
)
def test_invalid_weights_rejected(weights, fragment):
    with pytest.raises(AllocationError, match=fragment):
        validate_weights(weights)


def _req(**overrides):
    base = dict(
        holdings=[{"ticker": "reliance.ns", "weight": 0.5}, {"ticker": "TCS.NS", "weight": 0.5}],
        start_date="2021-01-01",
        end_date="2023-01-01",
    )
    base.update(overrides)
    return AnalyzeRequest(**base)


def test_request_normalizes_tickers_and_defaults():
    req = _req()
    assert req.holdings[0].ticker == "RELIANCE.NS"
    assert req.benchmark == "^NSEI"
    assert req.initial_investment == 100_000
    assert req.risk_free_rate == pytest.approx(0.065)


@pytest.mark.parametrize(
    "overrides, fragment",
    [
        ({"holdings": [{"ticker": "A", "weight": 0.5}, {"ticker": "a", "weight": 0.5}]}, "only once"),
        ({"holdings": [{"ticker": "DROP TABLE", "weight": 1}]}, "not a valid ticker"),
        ({"start_date": "2023-01-01", "end_date": "2022-01-01"}, "at least 30 days"),
        ({"end_date": "2999-01-01"}, "future"),
        ({"initial_investment": 0}, "greater than 0"),
        ({"risk_free_rate": 6.5}, "less than or equal"),
    ],
)
def test_request_rejects_bad_input(overrides, fragment):
    with pytest.raises(ValidationError, match=fragment):
        _req(**overrides)
