"""FastAPI application factory, error handling, and optional static hosting."""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError

from app.api.markets import router as markets_router
from app.api.routes import router
from app.data.cleaning import InsufficientDataError
from app.data.market_data import InvalidTickerError, MarketDataUnavailableError

logger = logging.getLogger("portfolio")
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


def _error(status: int, code: str, message: str, details=None) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": code, "message": message, "details": details})


def _friendly_validation(exc: RequestValidationError) -> JSONResponse:
    problems = []
    for err in exc.errors():
        loc = [str(p) for p in err.get("loc", []) if p != "body"]
        msg = str(err.get("msg", "Invalid value")).removeprefix("Value error, ")
        problems.append({"field": ".".join(loc) or None, "message": msg})
    headline = problems[0]["message"] if problems else "The request is invalid."
    return _error(422, "validation_error", headline, problems)


def create_app() -> FastAPI:
    app = FastAPI(
        title="Folio — Portfolio Analytics API",
        version="1.0.0",
        description="Portfolio analytics, live prices and a directory of every NSE and BSE listed company.",
        # Under /api so the docs are reachable through the same public route as the API.
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        return _friendly_validation(exc)

    @app.exception_handler(HTTPException)
    async def _http(_: Request, exc: HTTPException):
        code = {404: "not_found"}.get(exc.status_code, "http_error")
        return _error(exc.status_code, code, str(exc.detail))

    @app.exception_handler(InvalidTickerError)
    async def _invalid_ticker(_: Request, exc: InvalidTickerError):
        return _error(422, "invalid_ticker", str(exc), {"tickers": exc.tickers})

    @app.exception_handler(InsufficientDataError)
    async def _insufficient(_: Request, exc: InsufficientDataError):
        return _error(422, "insufficient_data", str(exc))

    @app.exception_handler(MarketDataUnavailableError)
    async def _unavailable(_: Request, exc: MarketDataUnavailableError):
        return _error(503, "data_unavailable", str(exc))

    @app.exception_handler(ValueError)
    async def _value_error(_: Request, exc: ValueError):
        if isinstance(exc, ValidationError):  # an internal model failed: that's our bug, not bad input
            logger.exception("Response validation failed", exc_info=exc)
            return _error(500, "internal_error", "Something went wrong on the server.")
        return _error(422, "invalid_input", str(exc))

    @app.exception_handler(Exception)
    async def _unexpected(_: Request, exc: Exception):
        logger.exception("Unhandled error", exc_info=exc)
        return _error(500, "internal_error", "Something went wrong on the server.")

    app.include_router(router)
    app.include_router(markets_router)

    # Serve the production frontend build, if present, so one process runs everything.
    if FRONTEND_DIST.is_dir():
        app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

        @app.get("/{path:path}", include_in_schema=False)
        async def spa(path: str):
            candidate = FRONTEND_DIST / path
            if path and candidate.is_file() and FRONTEND_DIST in candidate.resolve().parents:
                return FileResponse(candidate)
            return FileResponse(FRONTEND_DIST / "index.html")

    return app


app = create_app()
