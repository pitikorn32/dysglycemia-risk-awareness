"""Reconstruct the frozen Phase 0 M=5 model row from public inputs."""

from __future__ import annotations

from typing import Any

import numpy as np

from app.contracts import AnnualMeasurement, BaselineRequest


HISTORY_YEARS = 5
CLINICAL_FIELDS = {
    "FBS": "fbs",
    "BMI": "bmi",
    "Pulse": "pulse",
    "BL_pres1": "systolic_bp",
    "BL_pres2": "diastolic_bp",
    "Waist": "waist",
}
STATUS_CODES = {"never": 0, "former": 1, "current": 2}


def _sleep_quality(hours: float | None) -> int | None:
    if hours is None:
        return None
    if 1 <= hours <= 4.5:
        return 0
    if 5 <= hours <= 6.5:
        return 1
    if 7 <= hours <= 11:
        return 2
    return None


def _history_features(
    measurements: list[AnnualMeasurement],
) -> dict[str, float | int]:
    result: dict[str, float | int] = {}
    for model_name, public_name in CLINICAL_FIELDS.items():
        values = np.asarray(
            [
                np.nan
                if getattr(item, public_name) is None
                else getattr(item, public_name)
                for item in measurements
            ],
            dtype=float,
        )
        observed_positions = np.flatnonzero(~np.isnan(values))
        observed = values[observed_positions]
        prefix = f"{model_name}_hist_{HISTORY_YEARS}y"
        result[f"{prefix}_observed_count"] = int(observed.size)
        result[f"{prefix}_missing_count"] = int(np.isnan(values).sum())
        if observed.size == 0:
            for suffix in ("latest", "mean", "min", "max", "std", "range", "slope"):
                result[f"{prefix}_{suffix}"] = np.nan
            continue
        result[f"{prefix}_latest"] = float(observed[-1])
        result[f"{prefix}_mean"] = float(observed.mean())
        result[f"{prefix}_min"] = float(observed.min())
        result[f"{prefix}_max"] = float(observed.max())
        result[f"{prefix}_std"] = float(observed.std(ddof=0))
        result[f"{prefix}_range"] = float(observed.max() - observed.min())
        result[f"{prefix}_slope"] = (
            float(
                np.polyfit(
                    observed_positions.astype(float) - observed_positions.min(),
                    observed,
                    deg=1,
                )[0]
            )
            if observed.size >= 2
            else np.nan
        )
    return result


def build_model_features(profile: BaselineRequest) -> dict[str, Any]:
    """Build one no-calendar-year model row using Phase 0 semantics."""

    current = profile.annual_history[-1]
    known_fbs = [item.fbs for item in profile.annual_history if item.fbs is not None]
    if profile.earlier_highest_fbs is not None:
        known_fbs.append(profile.earlier_highest_fbs)
    max_fbs = max(known_fbs) if known_fbs else np.nan

    if current.fbs is not None:
        years_since_fbs = 0.0
    else:
        gap = next(
            (
                offset
                for offset, item in enumerate(
                    reversed(profile.annual_history[:-1]), start=1
                )
                if item.fbs is not None
            ),
            None,
        )
        years_since_fbs = float(gap) if gap is not None else np.nan

    row: dict[str, Any] = {
        "Age": profile.age,
        "gender": None if profile.sex is None else int(profile.sex == "male"),
        "dm_first_degree_relative": (
            None
            if profile.family_history in (None, "not_sure")
            else int(profile.family_history == "yes")
        ),
        "cooking_method": profile.cooking_method,
        "total_sugary_week": profile.sugary_drinks_per_week,
        "total_veg_fruit_week": profile.fruit_vegetable_days_per_week,
        "total_exercise_week": profile.exercise_days_per_week,
        "total_phy_activity_week": profile.physical_activity_days_per_week,
        "sleep_hours": profile.sleep_hours,
        "sleep_quality": _sleep_quality(profile.sleep_hours),
        "smoking_status": (
            None
            if profile.smoking_status is None
            else STATUS_CODES[profile.smoking_status]
        ),
        "alcohol_status": (
            None
            if profile.alcohol_status is None
            else STATUS_CODES[profile.alcohol_status]
        ),
        "FBS": current.fbs,
        "BMI": current.bmi,
        "Pulse": current.pulse,
        "BL_pres1": current.systolic_bp,
        "BL_pres2": current.diastolic_bp,
        "Waist": current.waist,
        "MAX_FBS_up_to_year": float(max_fbs),
        "has_fbs_this_year": int(current.fbs is not None),
        "years_since_last_fbs": years_since_fbs,
        "is_missing_last_year": profile.annual_history[-2].fbs is None,
        "clinical_observed_count": sum(
            getattr(current, public_name) is not None
            for public_name in CLINICAL_FIELDS.values()
        ),
    }
    row.update(_history_features(profile.annual_history))

    current_fbs = np.nan if current.fbs is None else current.fbs
    row["FBS_hinge_100"] = (
        max(current_fbs - 100, 0) if not np.isnan(current_fbs) else np.nan
    )
    row["FBS_hinge_125"] = (
        max(current_fbs - 125, 0) if not np.isnan(current_fbs) else np.nan
    )
    row["FBS_x_Age"] = current_fbs * profile.age
    row["MAX_FBS_x_Age"] = max_fbs * profile.age
    return row
