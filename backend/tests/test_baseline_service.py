from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
import pytest

from app.baseline import BaselineService
from app.contracts import AnnualMeasurement, BaselineRequest, ScoredResponse
from app.model_release import HorizonModel, ModelRelease


def _digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_constant_release(directory: Path) -> Path:
    directory.mkdir()
    probabilities = (0.1, 0.2, 0.3, 0.4, 0.5)
    horizons = []
    for horizon, probability in enumerate(probabilities, start=1):
        artifact = directory / f"horizon_{horizon}.npz"
        intercept = np.log(probability / (1.0 - probability))
        np.savez_compressed(
            artifact,
            coefficients=np.array([intercept, 0.0]),
            mean=np.array([50.0]),
            scale=np.array([10.0]),
            numeric_imputation=np.array([50.0]),
        )
        horizons.append(
            {
                "horizon_years": horizon,
                "artifact": artifact.name,
                "artifact_sha256": _digest(artifact),
                "feature_columns": ["Age"],
                "numeric_features": ["Age"],
                "categorical_features": [],
                "categorical_imputation": [],
                "categorical_categories": [],
                "transformed_feature_names": ["Age"],
                "golden_prediction": probability,
            }
        )
    manifest = {
        "schema_version": 1,
        "release_id": "synthetic-test-release",
        "outcome": "first transition of the source AtRisk label from 0 to 1",
        "model_family": "raw ridge logistic regression",
        "ridge_alpha": 0.01,
        "sklearn_c": 100.0,
        "history_years": 5,
        "calendar_year_features": False,
        "post_hoc_calibration": False,
        "split": "synthetic test fixture",
        "source": {"git_commit": "synthetic"},
        "runtime_versions": {"numpy": np.__version__},
        "horizons": horizons,
    }
    manifest_path = directory / "manifest.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    return manifest_path


def test_eligible_profile_receives_all_five_fixed_probabilities(tmp_path: Path) -> None:
    release = ModelRelease.load(write_constant_release(tmp_path / "release"))
    service = BaselineService(release)
    request = BaselineRequest(
        age=50,
        earlier_fbs_over_100="no",
        annual_history=[AnnualMeasurement(fbs=95.0) for _ in range(5)],
    )

    result = service.assess(request)

    assert isinstance(result, ScoredResponse)
    assert [item.horizon_years for item in result.baseline] == [1, 2, 3, 4, 5]
    assert [item.probability for item in result.baseline] == pytest.approx(
        [0.1, 0.2, 0.3, 0.4, 0.5], abs=1e-12
    )
    assert [item.horizon_years for item in result.explanations] == [1, 2, 3, 4, 5]
    assert [item.reference_probability for item in result.explanations] == pytest.approx(
        [0.1, 0.2, 0.3, 0.4, 0.5], abs=1e-12
    )
    assert all(
        item.contributions[0].feature_group == "age"
        and item.contributions[0].log_odds_contribution == 0
        for item in result.explanations
    )
    assert result.model_release.release_id == "synthetic-test-release"


def test_local_explanation_reconstructs_log_odds_and_groups_engineered_terms() -> None:
    model = HorizonModel(
        horizon_years=5,
        feature_columns=("Age", "FBS_hist_5y_mean", "FBS_hinge_100", "gender"),
        numeric_features=("Age", "FBS_hist_5y_mean", "FBS_hinge_100"),
        categorical_features=("gender",),
        categorical_imputation=(0,),
        categorical_categories=((0, 1),),
        transformed_feature_names=(
            "Age",
            "FBS_hist_5y_mean",
            "FBS_hinge_100",
            "gender_0",
            "gender_1",
        ),
        coefficients=np.array([-1.0, 0.4, 0.3, 0.2, -0.1, 0.1]),
        mean=np.array([50.0, 90.0, 0.0, 0.5, 0.5]),
        scale=np.array([10.0, 5.0, 2.0, 0.5, 0.5]),
        numeric_imputation=np.array([50.0, 90.0, 0.0]),
    )

    explanation = model.explain(
        {"Age": 60, "FBS_hist_5y_mean": 95.0, "FBS_hinge_100": 2.0, "gender": 1}
    )

    assert explanation.reference_log_odds == pytest.approx(-1.0)
    assert explanation.output_log_odds == pytest.approx(0.1)
    assert sum(item.log_odds_contribution for item in explanation.contributions) == pytest.approx(
        1.1
    )
    assert {
        item.feature_group: item.log_odds_contribution
        for item in explanation.contributions
    } == pytest.approx(
        {
            "age": 0.4,
            "fbs_history": 0.3,
            "fbs_age_terms": 0.2,
            "sex": 0.2,
        }
    )
