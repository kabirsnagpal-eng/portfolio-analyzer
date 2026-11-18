"""Vercel serverless entry point.

Vercel's Python runtime serves the ASGI ``app`` exported here. All /api/*
requests are rewritten to this function (see vercel.json); FastAPI still
receives the original path, so the routes in backend/app/api/routes.py apply
unchanged. The frontend is served separately as static files from frontend/dist.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.main import app  # noqa: E402

__all__ = ["app"]
