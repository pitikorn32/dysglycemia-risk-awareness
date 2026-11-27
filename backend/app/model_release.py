"""Integrity-checked, non-executable model-release adapter."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping

import numpy as np


EXPECTED_HORIZONS = (1, 2, 3, 4, 5)


_GROUP_LABELS = {
    "age": "Age",
    "fbs_history": "Fasting blood sugar history",
    "fbs_age_terms": "FBS nonlinear and age terms",
    "bmi_history": "BMI history",
    "pulse_history": "Pulse history",
    "systolic_bp_history": "Systolic blood pressure history",
    "diastolic_bp_history": "Diastolic blood pressure history",
    "waist_history": "Waist history",
    "record_completeness": "Measurement availability",
    "sugary_drinks": "Sugary drinks",
    "fruit_vegetables": "Fruit and vegetable intake",
    "exercise": "Exercise",
    "physical_activity": "Physical activity",
    "sleep": "Sleep",
    "sex": "Sex",
    "family_history": "Family history",
    "cooking_method": "Cooking method",
    "smoking": "Smoking status",
    "alcohol": "Alcohol status",
    "other_model_terms": "Other model terms",
}


class ModelReleaseError(RuntimeError):
    """Raised when a frozen release cannot be trusted or evaluated."""


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _sigmoid(log_odds: float) -> float:
    if log_odds >= 0:
        return 1.0 / (1.0 + float(np.exp(-log_odds)))
    exp_log_odds = float(np.exp(log_odds))
    return exp_log_odds / (1.0 + exp_log_odds)


def _feature_group(name: str) -> str:
    exact = {
        "Age": "age",
        "total_sugary_week": "sugary_drinks",
        "total_veg_fruit_week": "fruit_vegetables",
        "total_exercise_week": "exercise",
        "total_phy_activity_week": "physical_activity",
        "sleep_hours": "sleep",
        "FBS": "fbs_history",
        "MAX_FBS_up_to_year": "fbs_history",
        "BMI": "bmi_history",
        "Pulse": "pulse_history",
        "BL_pres1": "systolic_bp_history",
        "BL_pres2": "diastolic_bp_history",
        "Waist": "waist_history",
    }
    if name in exact:
        return exact[name]
    prefixes = (
        ("FBS_hist_", "fbs_history"),
        ("BMI_hist_", "bmi_history"),
        ("Pulse_hist_", "pulse_history"),
        ("BL_pres1_hist_", "systolic_bp_history"),
        ("BL_pres2_hist_", "diastolic_bp_history"),
        ("Waist_hist_", "waist_history"),
        ("gender_", "sex"),
        ("dm_first_degree_relative_", "family_history"),
        ("cooking_method_", "cooking_method"),
        ("sleep_quality_", "sleep"),
        ("smoking_status_", "smoking"),
        ("alcohol_status_", "alcohol"),
    )
    for prefix, group in prefixes:
        if name.startswith(prefix):
            return group
    if name.startswith(("FBS_hinge_", "FBS_x_", "MAX_FBS_x_")):
        return "fbs_age_terms"
    if name in {
        "clinical_observed_count",
        "has_fbs_this_year",
        "years_since_last_fbs",
        "is_missing_last_year",
    }:
        return "record_completeness"
    return "other_model_terms"


@dataclass(frozen=True)
class FeatureContribution:
    feature_group: str
    label: str
    log_odds_contribution: float


@dataclass(frozen=True)
class LocalExplanation:
    horizon_years: int
    reference_log_odds: float
    output_log_odds: float
    contributions: tuple[FeatureContribution, ...]


@dataclass(frozen=True)
class HorizonModel:
    horizon_years: int
    feature_columns: tuple[str, ...]
    numeric_features: tuple[str, ...]
    categorical_features: tuple[str, ...]
    categorical_imputation: tuple[Any, ...]
    categorical_categories: tuple[tuple[Any, ...], ...]
    transformed_feature_names: tuple[str, ...]
    coefficients: np.ndarray
    mean: np.ndarray
    scale: np.ndarray
    numeric_imputation: np.ndarray

    def _scaled_features(self, features: Mapping[str, Any]) -> np.ndarray:
        numeric = np.asarray(
            [features.get(name, np.nan) for name in self.numeric_features],
            dtype=float,
        )
        numeric = np.where(np.isnan(numeric), self.numeric_imputation, numeric)
        encoded: list[float] = []
        for name, imputation, categories in zip(
            self.categorical_features,
            self.categorical_imputation,
            self.categorical_categories,
            strict=True,
        ):
            value = features.get(name)
            if value is None:
                value = imputation
            encoded.extend(float(value == category) for category in categories)
        raw = np.concatenate((numeric, np.asarray(encoded, dtype=float)))
        return (raw - self.mean) / self.scale

    def predict(self, features: Mapping[str, Any]) -> float:
        scaled = self._scaled_features(features)
        eta = float(self.coefficients[0] + scaled @ self.coefficients[1:])
        return _sigmoid(eta)

    def explain(self, features: Mapping[str, Any]) -> LocalExplanation:
        """Return an exact additive decomposition relative to scaler means.

        Contributions are on the model's log-odds scale. Grouping only changes
        presentation: summing transformed terms preserves the linear predictor.
        """
        scaled = self._scaled_features(features)
        transformed = scaled * self.coefficients[1:]
        grouped: dict[str, float] = {}
        for name, value in zip(
            self.transformed_feature_names, transformed, strict=True
        ):
            group = _feature_group(name)
            grouped[group] = grouped.get(group, 0.0) + float(value)
        contributions = tuple(
            FeatureContribution(
                feature_group=group,
                label=_GROUP_LABELS[group],
                log_odds_contribution=value,
            )
            for group, value in sorted(
                grouped.items(), key=lambda item: (-abs(item[1]), item[0])
            )
        )
        reference = float(self.coefficients[0])
        output = reference + sum(
            item.log_odds_contribution for item in contributions
        )
        return LocalExplanation(
            horizon_years=self.horizon_years,
            reference_log_odds=reference,
            output_log_odds=output,
            contributions=contributions,
        )


@dataclass(frozen=True)
class ModelRelease:
    release_id: str
    model_family: str
    history_years: int
    models: tuple[HorizonModel, ...]

    @classmethod
    def load(cls, manifest_path: Path) -> "ModelRelease":
        manifest_path = Path(manifest_path)
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            cls._validate_manifest(manifest)
            models = tuple(
                cls._load_horizon(manifest_path.parent, entry)
                for entry in manifest["horizons"]
            )
        except ModelReleaseError:
            raise
        except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
            raise ModelReleaseError(f"Invalid model release: {manifest_path}") from exc
        return cls(
            release_id=manifest["release_id"],
            model_family=manifest["model_family"],
            history_years=manifest["history_years"],
            models=models,
        )

    @staticmethod
    def _validate_manifest(manifest: Mapping[str, Any]) -> None:
        expected = {
            "schema_version": 1,
            "outcome": "first transition of the source AtRisk label from 0 to 1",
            "model_family": "raw ridge logistic regression",
            "ridge_alpha": 0.01,
            "sklearn_c": 100.0,
            "history_years": 5,
            "calendar_year_features": False,
            "post_hoc_calibration": False,
        }
        for key, value in expected.items():
            if manifest.get(key) != value:
                raise ModelReleaseError(f"Unexpected manifest value for {key}")
        if (
            not isinstance(manifest.get("release_id"), str)
            or not manifest["release_id"]
        ):
            raise ModelReleaseError("Release ID is missing")
        horizons = manifest.get("horizons")
        if not isinstance(horizons, list):
            raise ModelReleaseError("Horizon metadata is missing")
        actual = tuple(entry.get("horizon_years") for entry in horizons)
        if actual != EXPECTED_HORIZONS:
            raise ModelReleaseError("Release must contain ordered horizons 1 through 5")

    @staticmethod
    def _load_horizon(directory: Path, entry: Mapping[str, Any]) -> HorizonModel:
        artifact_path = directory / str(entry["artifact"])
        if (
            not artifact_path.is_file()
            or _sha256(artifact_path) != entry["artifact_sha256"]
        ):
            raise ModelReleaseError(
                f"Artifact integrity check failed: {artifact_path.name}"
            )
        with np.load(artifact_path, allow_pickle=False) as arrays:
            coefficients = arrays["coefficients"].astype(float, copy=True)
            mean = arrays["mean"].astype(float, copy=True)
            scale = arrays["scale"].astype(float, copy=True)
            numeric_imputation = arrays["numeric_imputation"].astype(float, copy=True)

        numeric = tuple(entry["numeric_features"])
        categorical = tuple(entry["categorical_features"])
        categories = tuple(tuple(values) for values in entry["categorical_categories"])
        encoded_width = sum(len(values) for values in categories)
        transformed_width = len(numeric) + encoded_width
        if (
            mean.shape != (transformed_width,)
            or scale.shape != (transformed_width,)
            or coefficients.shape != (transformed_width + 1,)
            or numeric_imputation.shape != (len(numeric),)
            or len(categorical) != len(categories)
            or len(entry["categorical_imputation"]) != len(categorical)
            or np.any(scale == 0)
        ):
            raise ModelReleaseError(
                f"Artifact dimensions are inconsistent: {artifact_path.name}"
            )
        transformed_names = tuple(entry["transformed_feature_names"])
        feature_columns = tuple(entry["feature_columns"])
        if (
            len(transformed_names) != transformed_width
            or feature_columns != numeric + categorical
        ):
            raise ModelReleaseError(
                f"Artifact feature metadata is inconsistent: {artifact_path.name}"
            )
        model = HorizonModel(
            horizon_years=entry["horizon_years"],
            feature_columns=feature_columns,
            numeric_features=numeric,
            categorical_features=categorical,
            categorical_imputation=tuple(entry["categorical_imputation"]),
            categorical_categories=categories,
            transformed_feature_names=transformed_names,
            coefficients=coefficients,
            mean=mean,
            scale=scale,
            numeric_imputation=numeric_imputation,
        )
        golden_features = {
            **dict(zip(numeric, numeric_imputation, strict=True)),
            **dict(
                zip(
                    categorical,
                    entry["categorical_imputation"],
                    strict=True,
                )
            ),
        }
        golden_actual = model.predict(golden_features)
        golden_expected = float(entry["golden_prediction"])
        if not np.isclose(golden_actual, golden_expected, rtol=0, atol=1e-12):
            raise ModelReleaseError(
                f"Artifact golden prediction failed: {artifact_path.name}"
            )
        return model

    def score(self, features: Mapping[str, Any]) -> tuple[tuple[int, float], ...]:
        return tuple(
            (model.horizon_years, model.predict(features)) for model in self.models
        )

    def explain(self, features: Mapping[str, Any]) -> tuple[LocalExplanation, ...]:
        return tuple(model.explain(features) for model in self.models)
