"""Eligibility gate and frozen baseline orchestration."""

from __future__ import annotations

import math

from app.contracts import (
    ApplicabilityReason,
    BaselineRequest,
    BaselineResponse,
    FeatureContribution,
    HorizonExplanation,
    HorizonProbability,
    ModelReleaseSummary,
    Notice,
    OutsideApplicabilityResponse,
    ScoredResponse,
)
from app.demo import SyntheticRelease
from app.features import build_model_features
from app.model_release import ModelRelease


class BaselineService:
    def __init__(self, release: ModelRelease | SyntheticRelease) -> None:
        self._release = release

    @property
    def release_id(self) -> str:
        return self._release.release_id

    def assess(self, profile: BaselineRequest) -> BaselineResponse:
        known_fbs = [
            item.fbs for item in profile.annual_history if item.fbs is not None
        ]
        elevated = (
            profile.earlier_fbs_over_100 == "yes"
            or (
                profile.earlier_highest_fbs is not None
                and profile.earlier_highest_fbs > 100
            )
            or any(value > 100 for value in known_fbs)
        )
        if elevated:
            return OutsideApplicabilityResponse(
                reasons=[
                    ApplicabilityReason(
                        code="known_fbs_over_100",
                        message=(
                            "This baseline model applies only before any known fasting "
                            "blood sugar measurement above 100 mg/dL."
                        ),
                    )
                ]
            )
        if not known_fbs:
            return OutsideApplicabilityResponse(
                reasons=[
                    ApplicabilityReason(
                        code="no_known_fbs",
                        message=(
                            "At least one fasting blood sugar measurement is needed "
                            "to assess this profile."
                        ),
                    )
                ]
            )

        notes: list[Notice] = []
        if profile.family_history == "not_sure":
            notes.append(
                Notice(
                    code="family_history_unknown",
                    message=(
                        "Unknown family history uses the frozen model's "
                        "missing-value handling; it is not treated as a No answer."
                    ),
                )
            )
        if profile.earlier_fbs_over_100 == "not_sure":
            notes.append(
                Notice(
                    code="earlier_fbs_unknown",
                    message=(
                        "The estimate uses only the submitted FBS history because "
                        "earlier results are unknown."
                    ),
                )
            )
        features = build_model_features(profile)
        probabilities = self._release.score(features)
        explanations = self._release.explain(features)
        return ScoredResponse(
            baseline=[
                HorizonProbability(horizon_years=horizon, probability=probability)
                for horizon, probability in probabilities
            ],
            explanations=[
                HorizonExplanation(
                    horizon_years=item.horizon_years,
                    reference_probability=(
                        1.0 / (1.0 + math.exp(-item.reference_log_odds))
                    ),
                    contributions=[
                        FeatureContribution(
                            feature_group=contribution.feature_group,
                            label=contribution.label,
                            log_odds_contribution=contribution.log_odds_contribution,
                        )
                        for contribution in item.contributions
                    ],
                )
                for item in explanations
            ],
            model_release=ModelReleaseSummary(
                release_id=self._release.release_id,
                model_family=self._release.model_family,
                history_years=self._release.history_years,
            ),
            data_quality=notes,
        )
