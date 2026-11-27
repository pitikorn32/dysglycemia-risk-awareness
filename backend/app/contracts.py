"""Public and domain contracts for baseline risk assessment."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class AnnualMeasurement(StrictModel):
    """One relative annual slot; the list is ordered oldest to current."""

    fbs: float | None = Field(default=None, ge=40, le=600)
    bmi: float | None = Field(default=None, ge=10, le=80)
    pulse: float | None = Field(default=None, ge=30, le=250)
    systolic_bp: float | None = Field(default=None, ge=60, le=300)
    diastolic_bp: float | None = Field(default=None, ge=30, le=200)
    waist: float | None = Field(default=None, ge=30, le=250)

    @model_validator(mode="after")
    def validate_blood_pressure_order(self) -> "AnnualMeasurement":
        if (
            self.systolic_bp is not None
            and self.diastolic_bp is not None
            and self.systolic_bp <= self.diastolic_bp
        ):
            raise ValueError("systolic_bp must be greater than diastolic_bp")
        return self


class BaselineRequest(StrictModel):
    age: int = Field(ge=18, le=100)
    sex: Literal["male", "female"] | None = None
    family_history: Literal["yes", "no", "not_sure"] | None = Field(
        default=None,
        description="Not sure and omitted answers use frozen missing-value handling.",
    )
    cooking_method: int | None = Field(default=None, ge=1, le=6)
    sugary_drinks_per_week: float | None = Field(default=None, ge=0, le=42)
    fruit_vegetable_days_per_week: float | None = Field(
        default=None,
        ge=0,
        le=21,
        description=(
            "Legacy API name for weekly fruit/vegetable occasions, passed unchanged "
            "to the baseline. Scenarios assume one serving per occasion as an "
            "unvalidated proxy."
        ),
    )
    exercise_days_per_week: float | None = Field(default=None, ge=0, le=14)
    physical_activity_days_per_week: float | None = Field(
        default=None,
        ge=0,
        le=14,
        description=(
            "Legacy API name for weekly physical-activity frequency, not distinct "
            "days. The original questionnaire unit is unverified; the numeric "
            "mapping and bounds are retained."
        ),
    )
    sleep_hours: float | None = Field(default=None, ge=0, le=24)
    smoking_status: Literal["never", "former", "current"] | None = None
    alcohol_status: Literal["never", "former", "current"] | None = None
    earlier_fbs_over_100: Literal["yes", "no", "not_sure"]
    earlier_highest_fbs: float | None = Field(default=None, ge=40, le=600)
    annual_history: list[AnnualMeasurement] = Field(min_length=5, max_length=5)


class HorizonProbability(StrictModel):
    horizon_years: int
    probability: float = Field(ge=0, le=1)


class FeatureContribution(StrictModel):
    feature_group: str
    label: str
    log_odds_contribution: float


class HorizonExplanation(StrictModel):
    horizon_years: int
    reference_probability: float = Field(ge=0, le=1)
    contributions: list[FeatureContribution]


class ModelReleaseSummary(StrictModel):
    release_id: str
    model_family: str
    history_years: int


class Notice(StrictModel):
    code: str
    message: str


class ApplicabilityReason(StrictModel):
    code: str
    message: str


class ScoredResponse(StrictModel):
    status: Literal["scored"] = "scored"
    baseline: list[HorizonProbability]
    explanations: list[HorizonExplanation]
    data_quality: list[Notice] = Field(default_factory=list)
    model_release: ModelReleaseSummary


class OutsideApplicabilityResponse(StrictModel):
    status: Literal["outside_applicability"] = "outside_applicability"
    reasons: list[ApplicabilityReason]


BaselineResponse = ScoredResponse | OutsideApplicabilityResponse
