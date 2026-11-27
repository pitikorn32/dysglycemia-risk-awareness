from __future__ import annotations

from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]


def test_compose_exposes_only_gateway_and_needs_no_release() -> None:
    compose = yaml.safe_load((ROOT / "compose.yaml").read_text(encoding="utf-8"))
    services = compose["services"]

    assert services["gateway"]["ports"] == ["${PLATFORM_PORT:-8080}:8080"]
    assert "ports" not in services["api"]
    assert services["api"]["expose"] == ["8000"]
    assert "volumes" not in services["api"]
    assert "environment" not in services["api"]
    assert services["api"]["read_only"] is True
    assert services["gateway"]["read_only"] is True
    assert services["api"]["security_opt"] == ["no-new-privileges:true"]


def test_gateway_bounds_and_proxies_only_versioned_api() -> None:
    nginx = (ROOT / "gateway" / "nginx.conf").read_text(encoding="utf-8")

    assert "client_max_body_size 64k;" in nginx
    assert "rate=30r/m" in nginx
    assert "location = /api/v1/baseline" in nginx
    assert "server api:8000;" in nginx
    assert "proxy_pass http://baseline_api;" in nginx
    assert "proxy_read_timeout 15s;" in nginx


def test_runtime_requirements_exclude_research_stack() -> None:
    requirements = (ROOT / "backend" / "requirements.txt").read_text(encoding="utf-8")

    assert "scikit-learn" not in requirements
    assert "pandas" not in requirements
