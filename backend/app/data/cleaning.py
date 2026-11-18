"""Price cleaning and date alignment.

Pure functions: given raw per-ticker price series, produce one gap-free,
date-aligned price table plus a report of everything that was changed. The
report is passed through to the API response so nothing is filled or dropped
silently.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

# A gap of up to this many consecutive missing trading rows is forward-filled
# (e.g. a one-day exchange holiday in one market but not another, or a single
# missing print). Longer gaps are NOT filled.
MAX_FILL_GAP = 5
# If one ticker's history starts this many calendar days after the earliest
# available date, the analysis window is shortened and the user is warned.
LATE_START_WARNING_DAYS = 7
MIN_ALIGNED_ROWS = 3


class InsufficientDataError(ValueError):
    """Raised when there is not enough overlapping data to analyse."""


@dataclass
class GapRecord:
    ticker: str
    start: pd.Timestamp
    end: pd.Timestamp
    rows: int


@dataclass
class DataQualityReport:
    status: str = "complete"  # complete | adjusted | incomplete
    warnings: list[str] = field(default_factory=list)
    filled_points: dict[str, int] = field(default_factory=dict)
    long_gaps: list[GapRecord] = field(default_factory=list)
    dropped_rows: int = 0

    def escalate(self, status: str) -> None:
        order = {"complete": 0, "adjusted": 1, "incomplete": 2}
        if order[status] > order[self.status]:
            self.status = status


def _nan_runs(mask: np.ndarray) -> list[tuple[int, int]]:
    """(start, end_exclusive) index pairs for each run of True values."""
    runs: list[tuple[int, int]] = []
    start = None
    for i, missing in enumerate(mask):
        if missing and start is None:
            start = i
        elif not missing and start is not None:
            runs.append((start, i))
            start = None
    if start is not None:
        runs.append((start, len(mask)))
    return runs


def bounded_forward_fill(series: pd.Series, max_gap: int = MAX_FILL_GAP) -> tuple[pd.Series, int, list[tuple[int, int]]]:
    """Forward-fill only interior gaps of at most ``max_gap`` consecutive rows.

    Unlike ``Series.ffill(limit=n)``, which would fill the first n rows of a
    long gap and leave the rest, this leaves a long gap completely untouched
    so it can be reported. Leading NaNs are never filled (there is no prior
    price to carry forward).

    Returns (filled_series, number_of_points_filled, long_gap_runs).
    """
    values = series.to_numpy(dtype=float, copy=True)
    filled = 0
    long_runs: list[tuple[int, int]] = []
    for start, end in _nan_runs(np.isnan(values)):
        if start == 0:
            continue  # leading gap: nothing to carry forward
        length = end - start
        if length <= max_gap:
            values[start:end] = values[start - 1]
            filled += length
        else:
            long_runs.append((start, end))
    return pd.Series(values, index=series.index, name=series.name), filled, long_runs


def align_prices(
    raw: dict[str, pd.Series], max_gap: int = MAX_FILL_GAP
) -> tuple[pd.DataFrame, DataQualityReport]:
    """Align several price series onto one trading calendar.

    1. Union all dates (markets have different holidays).
    2. Trim to the window where every series has started and not yet ended.
    3. Forward-fill short gaps only (bounded, see ``bounded_forward_fill``).
    4. Drop any remaining dates with a missing price, and report them.
    """
    report = DataQualityReport()
    if not raw:
        raise InsufficientDataError("No price data supplied.")

    frame = pd.concat({t: s for t, s in raw.items()}, axis=1).sort_index()
    frame = frame[~frame.index.duplicated(keep="last")]

    first_valid = {t: frame[t].first_valid_index() for t in frame.columns}
    last_valid = {t: frame[t].last_valid_index() for t in frame.columns}
    empty = [t for t, d in first_valid.items() if d is None]
    if empty:
        raise InsufficientDataError(f"No price data for: {', '.join(empty)}")

    earliest = min(first_valid.values())
    common_start = max(first_valid.values())
    common_end = min(last_valid.values())
    if common_start >= common_end:
        raise InsufficientDataError(
            "The selected securities do not have overlapping price history in this period."
        )

    late = [t for t, d in first_valid.items() if (d - earliest).days > LATE_START_WARNING_DAYS]
    if late:
        report.escalate("adjusted")
        report.warnings.append(
            f"Analysis starts on {common_start.date()} because price history for "
            f"{', '.join(late)} begins later than the requested start date."
        )
    latest_end = max(last_valid.values())
    early = [t for t, d in last_valid.items() if (latest_end - d).days > LATE_START_WARNING_DAYS]
    if early:
        report.escalate("incomplete")
        report.warnings.append(
            f"Analysis ends on {common_end.date()} because {', '.join(early)} has no prices after "
            "that date (possibly delisted or suspended)."
        )

    frame = frame.loc[common_start:common_end]

    cleaned = {}
    for ticker in frame.columns:
        series, n_filled, long_runs = bounded_forward_fill(frame[ticker], max_gap)
        cleaned[ticker] = series
        if n_filled:
            report.filled_points[ticker] = n_filled
        for start, end in long_runs:
            report.long_gaps.append(
                GapRecord(ticker, frame.index[start], frame.index[end - 1], end - start)
            )
    aligned = pd.DataFrame(cleaned, index=frame.index)

    if report.filled_points:
        report.escalate("adjusted")
        detail = ", ".join(f"{t} ({n})" for t, n in sorted(report.filled_points.items()))
        report.warnings.append(
            f"Short gaps (at most {max_gap} trading days) were forward-filled: {detail}. "
            "This usually reflects exchange holidays that differ between markets."
        )

    missing_rows = aligned.isna().any(axis=1)
    report.dropped_rows = int(missing_rows.sum())
    if report.long_gaps:
        report.escalate("incomplete")
        for gap in report.long_gaps:
            report.warnings.append(
                f"{gap.ticker} has no prices for {gap.rows} consecutive trading days "
                f"({gap.start.date()} to {gap.end.date()}). These dates were excluded rather than "
                "filled; returns across the gap are measured from the last available price."
            )
    aligned = aligned.loc[~missing_rows]

    if len(aligned) < MIN_ALIGNED_ROWS:
        raise InsufficientDataError(
            "Not enough overlapping trading days to analyse. Choose a longer period."
        )
    return aligned, report
