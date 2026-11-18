"""Portfolio input validation that does not depend on the web layer."""

from __future__ import annotations

from collections.abc import Mapping

# Weights are accepted if they sum to 1 within this tolerance (0.01 percentage
# points). This absorbs floating-point residue like 33.33 + 33.33 + 33.34
# without accepting genuinely wrong allocations.
WEIGHT_SUM_TOLERANCE = 1e-4


class AllocationError(ValueError):
    """Raised when portfolio weights are invalid."""


def validate_weights(weights: Mapping[str, float], tolerance: float = WEIGHT_SUM_TOLERANCE) -> None:
    """Check that weights are positive, finite fractions summing to 1."""
    if not weights:
        raise AllocationError("Add at least one holding.")
    for ticker, w in weights.items():
        if w != w or w in (float("inf"), float("-inf")):  # NaN / inf
            raise AllocationError(f"{ticker}: weight must be a finite number.")
        if w <= 0:
            raise AllocationError(f"{ticker}: weight must be greater than 0%.")
        if w > 1 + tolerance:
            raise AllocationError(f"{ticker}: weight cannot exceed 100%.")
    total = sum(weights.values())
    if abs(total - 1.0) > tolerance:
        raise AllocationError(
            f"Weights must total 100%. Current total is {total * 100:.2f}%."
        )
