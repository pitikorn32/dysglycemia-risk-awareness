from __future__ import annotations

import numpy as np
import pytest

from app.contracts import AnnualMeasurement, BaselineRequest
from app.features import build_model_features


def test_reconstructs_phase_zero_current_and_history_features() -> None:
    request = BaselineRequest(
        age=50,
        sex="male",
        family_history="not_sure",
        cooking_method=3,
        sugary_drinks_per_week=4.5,
        fruit_vegetable_days_per_week=6,
        exercise_days_per_week=3,
        physical_activity_days_per_week=5,
        sleep_hours=6,
        smoking_status="former",
        alcohol_status="current",
        earlier_fbs_over_100="no",
        earlier_highest_fbs=96,
        annual_history=[
            AnnualMeasurement(fbs=90, bmi=24, systolic_bp=120, diastolic_bp=80),
            AnnualMeasurement(fbs=None, bmi=25),
            AnnualMeasurement(fbs=94, bmi=None),
            AnnualMeasurement(fbs=None, bmi=26),
            AnnualMeasurement(fbs=98, bmi=27, pulse=70, waist=88),
        ],
    )

    row = build_model_features(request)

    assert row["Age"] == 50
    assert row["gender"] == 1
    assert row["dm_first_degree_relative"] is None
    assert row["cooking_method"] == 3
    assert row["sleep_quality"] == 1
    assert row["smoking_status"] == 1
    assert row["alcohol_status"] == 2
    assert row["FBS"] == 98
    assert row["BL_pres1"] is None
    assert row["BL_pres2"] is None
    assert row["MAX_FBS_up_to_year"] == 98
    assert row["has_fbs_this_year"] == 1
    assert row["years_since_last_fbs"] == 0
    assert row["is_missing_last_year"] is True
    assert row["clinical_observed_count"] == 4
    assert row["FBS_hinge_100"] == 0
    assert row["FBS_hinge_125"] == 0
    assert row["FBS_x_Age"] == 4900
    assert row["MAX_FBS_x_Age"] == 4900

    prefix = "FBS_hist_5y"
    assert row[f"{prefix}_observed_count"] == 3
    assert row[f"{prefix}_missing_count"] == 2
    assert row[f"{prefix}_latest"] == 98
    assert row[f"{prefix}_mean"] == 94
    assert row[f"{prefix}_min"] == 90
    assert row[f"{prefix}_max"] == 98
    assert row[f"{prefix}_std"] == pytest.approx(np.std([90, 94, 98]))
    assert row[f"{prefix}_range"] == 8
    assert row[f"{prefix}_slope"] == pytest.approx(2)


@pytest.mark.parametrize(
    ("answer", "expected"),
    [("yes", 1), ("no", 0), ("not_sure", None), (None, None)],
)
def test_family_history_preserves_known_answers_and_missingness(
    answer: str | None, expected: int | None
) -> None:
    request = BaselineRequest(
        age=50,
        family_history=answer,
        earlier_fbs_over_100="no",
        annual_history=[AnnualMeasurement(fbs=95)] * 5,
    )

    assert build_model_features(request)["dm_first_degree_relative"] == expected


def test_missing_current_fbs_preserves_history_and_derived_missingness() -> None:
    request = BaselineRequest(
        age=40,
        earlier_fbs_over_100="no",
        annual_history=[
            AnnualMeasurement(fbs=91),
            AnnualMeasurement(),
            AnnualMeasurement(fbs=97),
            AnnualMeasurement(),
            AnnualMeasurement(),
        ],
    )

    row = build_model_features(request)

    assert row["FBS"] is None
    assert row["MAX_FBS_up_to_year"] == 97
    assert row["has_fbs_this_year"] == 0
    assert row["years_since_last_fbs"] == 2
    assert np.isnan(row["FBS_x_Age"])
    assert row["MAX_FBS_x_Age"] == 3880
