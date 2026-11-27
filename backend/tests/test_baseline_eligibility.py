from __future__ import annotations

from pathlib import Path

import pytest

from app.baseline import BaselineService
from app.contracts import (
    AnnualMeasurement,
    BaselineRequest,
    OutsideApplicabilityResponse,
)
from app.model_release import ModelRelease
from test_baseline_service import write_constant_release


@pytest.fixture
def service(tmp_path: Path) -> BaselineService:
    release = ModelRelease.load(write_constant_release(tmp_path / "release"))
    return BaselineService(release)


@pytest.mark.parametrize(
    ("profile", "reason_code"),
    [
        (
            BaselineRequest(
                age=50,
                earlier_fbs_over_100="yes",
                annual_history=[AnnualMeasurement(fbs=95)] * 5,
            ),
            "known_fbs_over_100",
        ),
        (
            BaselineRequest(
                age=50,
                earlier_fbs_over_100="no",
                annual_history=[AnnualMeasurement(fbs=95)] * 4
                + [AnnualMeasurement(fbs=101)],
            ),
            "known_fbs_over_100",
        ),
        (
            BaselineRequest(
                age=50,
                earlier_fbs_over_100="not_sure",
                annual_history=[AnnualMeasurement()] * 5,
            ),
            "no_known_fbs",
        ),
    ],
)
def test_ineligible_profile_gets_no_probabilities(
    service: BaselineService,
    profile: BaselineRequest,
    reason_code: str,
) -> None:
    result = service.assess(profile)

    assert isinstance(result, OutsideApplicabilityResponse)
    assert result.status == "outside_applicability"
    assert result.reasons[0].code == reason_code
    assert not hasattr(result, "baseline")


def test_unknown_earlier_history_is_scored_with_factual_note(
    service: BaselineService,
) -> None:
    request = BaselineRequest(
        age=50,
        earlier_fbs_over_100="not_sure",
        annual_history=[AnnualMeasurement(fbs=95)] * 5,
    )

    result = service.assess(request)

    assert result.status == "scored"
    assert [note.code for note in result.data_quality] == ["earlier_fbs_unknown"]


def test_unknown_family_history_matches_omission_and_is_disclosed(
    service: BaselineService,
) -> None:
    request = BaselineRequest(
        age=50,
        family_history="not_sure",
        earlier_fbs_over_100="no",
        annual_history=[AnnualMeasurement(fbs=95)] * 5,
    )

    result = service.assess(request)
    omitted = service.assess(request.model_copy(update={"family_history": None}))

    assert result.status == omitted.status == "scored"
    assert result.baseline == omitted.baseline
    assert result.explanations == omitted.explanations
    assert [note.code for note in result.data_quality] == ["family_history_unknown"]
    assert "not treated as a No answer" in result.data_quality[0].message
