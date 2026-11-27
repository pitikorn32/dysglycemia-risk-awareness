"""FastAPI entry point for the anonymous BHI baseline service."""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.demo import SyntheticRelease
from app.baseline import BaselineService
from app.contracts import BaselineRequest, BaselineResponse, ScoredResponse
from app.model_release import ModelRelease, ModelReleaseError


def _problem(
    *,
    status: int,
    code: str,
    title: str,
    detail: str,
    errors: list[dict[str, str]] | None = None,
) -> JSONResponse:
    body: dict[str, Any] = {
        "type": f"https://dysglycemia-risk.local/problems/{code}",
        "title": title,
        "status": status,
        "detail": detail,
        "code": code,
    }
    if errors is not None:
        body["errors"] = errors
    return JSONResponse(body, status_code=status, media_type="application/problem+json")


def _validation_errors(exc: RequestValidationError) -> list[dict[str, str]]:
    errors: list[dict[str, str]] = []
    for error in exc.errors():
        location = [str(part) for part in error["loc"] if part != "body"]
        errors.append(
            {
                "field": ".".join(location) or "body",
                "message": error["msg"],
                "code": error["type"],
            }
        )
    return errors


def create_app(*, manifest_path: Path | None = None) -> FastAPI:
    configured_manifest = manifest_path if manifest_path is not None else os.getenv("MODEL_MANIFEST")

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        try:
            application.state.baseline_service = BaselineService(
                ModelRelease.load(Path(configured_manifest))
                if configured_manifest is not None
                else SyntheticRelease()
            )
            application.state.model_release_error = None
        except ModelReleaseError as exc:
            application.state.baseline_service = None
            application.state.model_release_error = exc
        yield

    application = FastAPI(
        title="Dysglycemia Risk Awareness API",
        version="1.0.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
        lifespan=lifespan,
    )

    @application.middleware("http")
    async def privacy_headers(request: Request, call_next: Any) -> Any:
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @application.exception_handler(RequestValidationError)
    async def invalid_request(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        del request
        return _problem(
            status=422,
            code="invalid_request",
            title="Invalid request",
            detail="The submitted profile does not satisfy the API contract.",
            errors=_validation_errors(exc),
        )

    @application.post(
        "/api/v1/baseline",
        response_model=BaselineResponse,
        response_model_exclude_none=True,
        summary="Assess an eligible anonymous baseline profile",
    )
    async def assess_baseline(
        profile: BaselineRequest, request: Request
    ) -> BaselineResponse:
        service: BaselineService | None = request.app.state.baseline_service
        if service is None:
            return _problem(
                status=503,
                code="model_release_unavailable",
                title="Model release unavailable",
                detail="The frozen baseline model could not be loaded safely.",
            )
        result = service.assess(profile)
        if isinstance(result, ScoredResponse):
            result = result.model_copy(
                update={
                    "baseline": [
                        item.model_copy(
                            update={"probability": round(item.probability, 6)}
                        )
                        for item in result.baseline
                    ],
                    "explanations": [
                        item.model_copy(
                            update={
                                "reference_probability": round(
                                    item.reference_probability, 6
                                ),
                                "contributions": [
                                    contribution.model_copy(
                                        update={
                                            "log_odds_contribution": round(
                                                contribution.log_odds_contribution,
                                                8,
                                            )
                                        }
                                    )
                                    for contribution in item.contributions
                                ],
                            }
                        )
                        for item in result.explanations
                    ],
                }
            )
        return result

    @application.get("/api/v1/health", include_in_schema=False)
    async def health(request: Request) -> Any:
        service: BaselineService | None = request.app.state.baseline_service
        if service is None:
            return _problem(
                status=503,
                code="model_release_unavailable",
                title="Model release unavailable",
                detail="The frozen baseline model could not be loaded safely.",
            )
        return {
            "status": "ready",
            "model_release": service.release_id,
        }

    return application


app = create_app()
