"""Print independent Python reference rankings for the direct-BMI planner."""

from __future__ import annotations

import itertools
import json
import math

BASELINE = [0.04, 0.07, 0.10, 0.14, 0.18]
POINT_MULTIPLIERS = {
    "bmi": 1.1146,
    "exercise": 0.9692,
    "fruitVegetable": 0.9912,
    "sugaryDrinks": 1.0176,
}
PROFILES = {
    "standard": {"bmi": 27, "exercise": 2, "fruitVegetable": 5, "sugaryDrinks": 5},
    "clipped": {"bmi": 19, "exercise": 14, "fruitVegetable": 21, "sugaryDrinks": 0},
}


def unique(values: list[float]) -> list[float]:
    return sorted({round(value, 2) for value in values})


def axes(profile: dict[str, float]) -> list[list[float]]:
    return [
        unique([max(18.5, profile["bmi"] + delta) for delta in (0, -0.5, -1, -1.5, -2)]),
        unique([min(14, profile["exercise"] + delta) for delta in (0, 1, 2, 3, 5)]),
        unique([min(21, profile["fruitVegetable"] + delta) for delta in (0, 3, 7, 14)]),
        unique(
            [max(0, profile["sugaryDrinks"] - delta) for delta in (0, 1, 3, 7)] + [0]
        ),
    ]


def evaluate(profile: dict[str, float]) -> dict[str, object]:
    rows = []
    for order, values in enumerate(itertools.product(*axes(profile))):
        candidate = dict(zip(profile, values, strict=True))
        changes = {key: candidate[key] - profile[key] for key in profile}
        multiplier = max(
            0.30,
            math.prod(POINT_MULTIPLIERS[key] ** changes[key] for key in profile),
        )
        scenario = (
            BASELINE
            if multiplier == 1
            else [1 - (1 - probability) ** multiplier for probability in BASELINE]
        )
        effort = (
            max(0, profile["bmi"] - candidate["bmi"])
            + max(0, candidate["exercise"] - profile["exercise"]) / 2
            + max(0, candidate["fruitVegetable"] - profile["fruitVegetable"]) / 4
            + max(0, profile["sugaryDrinks"] - candidate["sugaryDrinks"]) / 4
        )
        score = sum(value / base for value, base in zip(scenario, BASELINE, strict=True)) / 5
        score += 0.03 * effort
        rows.append((score, order, candidate, effort, scenario))
    rows.sort(key=lambda row: (row[0], row[1]))
    return {
        "candidate_count": len(rows),
        "top": [
            {
                "candidate": row[2],
                "effort": row[3],
                "score": row[0],
                "point": row[4],
            }
            for row in rows[:5]
        ],
    }


print(
    json.dumps(
        {
            "baseline": BASELINE,
            "cases": [
                {"name": name, "profile": profile, "expected": evaluate(profile)}
                for name, profile in PROFILES.items()
            ],
        },
        indent=2,
    )
)
