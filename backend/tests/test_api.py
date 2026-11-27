from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import create_app
from test_baseline_service import write_constant_release


def eligible_payload() -> dict[str, object]:
    return {
        "age": 50,
        "earlier_fbs_over_100": "no",
        "annual_history": [{"fbs": 95}] * 5,
    }


def test_baseline_endpoint_returns_versioned_tagged_contract(tmp_path: Path) -> None:
    manifest = write_constant_release(tmp_path / "release")

    with TestClient(create_app(manifest_path=manifest)) as client:
        response = client.post("/api/v1/baseline", json=eligible_payload())

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json() == {
        "status": "scored",
        "baseline": [
            {"horizon_years": 1, "probability": 0.1},
            {"horizon_years": 2, "probability": 0.2},
            {"horizon_years": 3, "probability": 0.3},
            {"horizon_years": 4, "probability": 0.4},
            {"horizon_years": 5, "probability": 0.5},
        ],
        "explanations": [
            {
                "horizon_years": horizon,
                "reference_probability": probability,
                "contributions": [
                    {
                        "feature_group": "age",
                        "label": "Age",
                        "log_odds_contribution": 0.0,
                    }
                ],
            }
            for horizon, probability in enumerate((0.1, 0.2, 0.3, 0.4, 0.5), start=1)
        ],
        "data_quality": [],
        "model_release": {
            "release_id": "synthetic-test-release",
            "model_family": "raw ridge logistic regression",
            "history_years": 5,
        },
    }


def test_validation_failure_uses_problem_contract_without_echoing_values(
    tmp_path: Path,
) -> None:
    manifest = write_constant_release(tmp_path / "release")
    payload = eligible_payload()
    payload["age"] = 17
    payload["secret_extra"] = "must-not-be-echoed"

    with TestClient(create_app(manifest_path=manifest)) as client:
        response = client.post("/api/v1/baseline", json=payload)

    assert response.status_code == 422
    assert response.headers["content-type"].startswith("application/problem+json")
    body = response.json()
    assert body["code"] == "invalid_request"
    assert body["status"] == 422
    assert "must-not-be-echoed" not in response.text
    assert {error["field"] for error in body["errors"]} == {"age", "secret_extra"}


def test_missing_release_fails_closed_with_service_unavailable(tmp_path: Path) -> None:
    with TestClient(create_app(manifest_path=tmp_path / "missing.json")) as client:
        response = client.post("/api/v1/baseline", json=eligible_payload())

    assert response.status_code == 503
    assert response.headers["content-type"].startswith("application/problem+json")
    assert response.json()["code"] == "model_release_unavailable"


def test_docs_are_exposed_at_same_origin_paths(tmp_path: Path) -> None:
    manifest = write_constant_release(tmp_path / "release")

    with TestClient(create_app(manifest_path=manifest)) as client:
        schema = client.get("/api/openapi.json")
        docs = client.get("/api/docs")

    assert schema.status_code == 200
    assert "/api/v1/baseline" in schema.json()["paths"]
    assert docs.status_code == 200


def test_health_reflects_verified_release_state(tmp_path: Path) -> None:
    manifest = write_constant_release(tmp_path / "release")

    with TestClient(create_app(manifest_path=manifest)) as client:
        ready = client.get("/api/v1/health")
    with TestClient(create_app(manifest_path=tmp_path / "missing.json")) as client:
        unavailable = client.get("/api/v1/health")

    assert ready.status_code == 200
    assert ready.json() == {
        "status": "ready",
        "model_release": "synthetic-test-release",
    }
    assert unavailable.status_code == 503
    assert unavailable.json()["code"] == "model_release_unavailable"


def test_openapi_public_contract_matches_snapshot() -> None:
    schema = create_app().openapi()
    public_schemas = {
        name: {
            "properties": sorted(value.get("properties", {})),
            "required": value.get("required", []),
        }
        for name, value in schema["components"]["schemas"].items()
        if name
        in {
            "AnnualMeasurement",
            "BaselineRequest",
            "HorizonProbability",
            "FeatureContribution",
            "HorizonExplanation",
            "ModelReleaseSummary",
            "Notice",
            "ApplicabilityReason",
            "ScoredResponse",
            "OutsideApplicabilityResponse",
        }
    }
    operation = schema["paths"]["/api/v1/baseline"]["post"]
    actual = {
        "api_version": schema["info"]["version"],
        "request": operation["requestBody"]["content"]["application/json"]["schema"],
        "success": operation["responses"]["200"]["content"]["application/json"][
            "schema"
        ]["anyOf"],
        "schemas": public_schemas,
    }
    snapshot = Path(__file__).with_name("openapi_contract_snapshot.json")

    assert actual == json.loads(snapshot.read_text(encoding="utf-8"))


def test_public_demo_returns_identified_fixed_examples_and_enforces_gate(monkeypatch):
    monkeypatch.delenv("MODEL_MANIFEST", raising=False)
    payload = eligible_payload()
    with TestClient(create_app()) as client:
        assert client.get("/api/v1/health").json()["model_release"] == "synthetic-demo-v1"
        first = client.post("/api/v1/baseline", json=payload).json()
        second = client.post("/api/v1/baseline", json={**payload, "age": 70}).json()
        assert first == second
        assert first["model_release"]["model_family"] == "fixed synthetic example"
        assert first["baseline"][-1]["probability"] == 0.18
        assert len(first["explanations"]) == 5
        outside = client.post("/api/v1/baseline", json={**payload, "earlier_fbs_over_100": "yes"})
        assert outside.json()["status"] == "outside_applicability"
        assert "baseline" not in outside.json()
