"""Print independent Python reference cases for the browser scenario engine."""

from __future__ import annotations

import itertools
import json
import math

MULTIPLIERS = {
    "bmi": (1.1146, 1.1053, 1.1260),
    "exercise": (0.9692, 0.9615, 0.9741),
    "fruitVegetable": (0.9912, 0.9835, 1.0000),
    "sugaryDrinks": (1.0176, 1.0084, 1.0276),
}
BASELINE = [0.039, 0.072, 0.105, 0.138, 0.172]
CHANGES = {
    "zero": {"bmi": 0, "exercise": 0, "fruitVegetable": 0, "sugaryDrinks": 0},
    "bmi_minus_2": {
        "bmi": -2,
        "exercise": 0,
        "fruitVegetable": 0,
        "sugaryDrinks": 0,
    },
    "mixed": {
        "bmi": -1.5,
        "exercise": 3,
        "fruitVegetable": 7,
        "sugaryDrinks": -3,
    },
    "floor": {
        "bmi": -20,
        "exercise": 30,
        "fruitVegetable": 30,
        "sugaryDrinks": -30,
    },
}


def multiplier(changes: dict[str, float], values: dict[str, float]) -> float:
    return max(0.30, math.prod(values[key] ** changes[key] for key in MULTIPLIERS))


def scenario_probability(baseline: float, relative_multiplier: float) -> float:
    if relative_multiplier == 1:
        return baseline
    return 1 - (1 - baseline) ** relative_multiplier


def build_case(name: str, changes: dict[str, float]) -> dict[str, object]:
    point = multiplier(changes, {key: values[0] for key, values in MULTIPLIERS.items()})
    corners = [
        multiplier(
            changes,
            {
                key: MULTIPLIERS[key][endpoint]
                for key, endpoint in zip(MULTIPLIERS, choices, strict=True)
            },
        )
        for choices in itertools.product((1, 2), repeat=4)
    ]
    low, high = min(corners), max(corners)
    return {
        "name": name,
        "baseline": BASELINE,
        "changes": changes,
        "expected": {
            "multiplier": {"point": point, "low": low, "high": high},
            "point": [scenario_probability(value, point) for value in BASELINE],
            "low": [scenario_probability(value, low) for value in BASELINE],
            "high": [scenario_probability(value, high) for value in BASELINE],
        },
    }


print(json.dumps([build_case(name, changes) for name, changes in CHANGES.items()], indent=2))
