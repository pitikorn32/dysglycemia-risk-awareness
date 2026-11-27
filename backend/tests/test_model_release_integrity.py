from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
import pytest

from app.model_release import ModelRelease, ModelReleaseError
from test_baseline_service import write_constant_release


def _digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_rejects_artifact_with_digest_mismatch(tmp_path: Path) -> None:
    manifest_path = write_constant_release(tmp_path / "release")
    artifact = manifest_path.parent / "horizon_3.npz"
    artifact.write_bytes(artifact.read_bytes() + b"tampered")

    with pytest.raises(ModelReleaseError, match="integrity check failed"):
        ModelRelease.load(manifest_path)


def test_rejects_self_consistent_arrays_that_fail_golden_prediction(
    tmp_path: Path,
) -> None:
    manifest_path = write_constant_release(tmp_path / "release")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    artifact = manifest_path.parent / "horizon_2.npz"
    with np.load(artifact, allow_pickle=False) as arrays:
        values = {name: arrays[name].copy() for name in arrays.files}
    values["coefficients"][0] += 0.25
    np.savez_compressed(artifact, **values)
    manifest["horizons"][1]["artifact_sha256"] = _digest(artifact)
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    with pytest.raises(ModelReleaseError, match="golden prediction failed"):
        ModelRelease.load(manifest_path)


def test_rejects_release_with_wrong_scientific_contract(tmp_path: Path) -> None:
    manifest_path = write_constant_release(tmp_path / "release")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["post_hoc_calibration"] = True
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    with pytest.raises(ModelReleaseError, match="post_hoc_calibration"):
        ModelRelease.load(manifest_path)
