"""Fixed, hand-authored API example. No fitted parameters or profile-based scoring."""

import math
from typing import Any, Mapping

from app.model_release import FeatureContribution, LocalExplanation


class SyntheticRelease:
    release_id = "synthetic-demo-v1"
    model_family = "fixed synthetic example"
    history_years = 5
    probabilities = (0.04, 0.07, 0.10, 0.14, 0.18)

    def score(self, features: Mapping[str, Any]) -> tuple[tuple[int, float], ...]:
        return tuple(enumerate(self.probabilities, start=1))

    def explain(self, features: Mapping[str, Any]) -> tuple[LocalExplanation, ...]:
        examples = []
        for horizon, probability in self.score(features):
            output = math.log(probability / (1 - probability))
            # Invented terms of opposite sign illustrate the additive display.
            terms = (
                FeatureContribution("fbs_history", "Fasting blood sugar history", 0.15),
                FeatureContribution("exercise", "Exercise", -0.05),
            )
            reference = output - sum(term.log_odds_contribution for term in terms)
            examples.append(LocalExplanation(horizon, reference, output, terms))
        return tuple(examples)
