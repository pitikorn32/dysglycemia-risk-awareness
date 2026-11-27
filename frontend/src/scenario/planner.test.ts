import { describe, expect, it } from "vitest";

import {
  analyzeEvidenceSensitivity,
  enumeratePlannerAlternatives,
  plannerEffort,
  rankExploratoryAlternatives,
} from "./planner";
import plannerGolden from "./planner_golden.json";

const baseline = [0.04, 0.07, 0.1, 0.14, 0.18].map((probability, index) => ({
  horizon_years: index + 1,
  probability,
}));
const profile = { bmi: 27, exercise: 2, fruitVegetable: 5, sugaryDrinks: 5 };

describe("deterministic direct-BMI planner", () => {
  it("computes the paper's effort function in collected units", () => {
    expect(
      plannerEffort(profile, { bmi: 25.5, exercise: 5, fruitVegetable: 12, sugaryDrinks: 2 }),
    ).toBe(5.5);
  });

  it("enumerates the exact bounded grid and filters duplicates", () => {
    const alternatives = enumeratePlannerAlternatives(profile, baseline);

    expect(alternatives).toHaveLength(400);
    expect(alternatives.every((item) => item.candidate.bmi >= 18.5)).toBe(true);
    expect(alternatives.every((item) => item.candidate.exercise <= 14)).toBe(true);
    expect(alternatives.every((item) => item.candidate.fruitVegetable <= 21)).toBe(true);
    expect(alternatives.every((item) => item.candidate.sugaryDrinks >= 0)).toBe(true);
    expect(alternatives.every((item) => item.scenario.horizons.every((h) => h.point <= h.probability))).toBe(true);
  });

  it("returns a stable, score-ordered set of five exploratory alternatives", () => {
    const first = rankExploratoryAlternatives(profile, baseline);
    const second = rankExploratoryAlternatives(profile, baseline);

    expect(first).toHaveLength(5);
    expect(first).toEqual(second);
    expect(first.map((item) => item.score)).toEqual([...first.map((item) => item.score)].sort((a, b) => a - b));
  });

  it("deduplicates candidates clipped by the BMI floor and lifestyle caps", () => {
    const alternatives = enumeratePlannerAlternatives(
      { bmi: 19, exercise: 14, fruitVegetable: 21, sugaryDrinks: 0 },
      baseline,
    );

    expect(alternatives).toHaveLength(2);
    expect(alternatives.map((item) => item.candidate.bmi)).toEqual([18.5, 19]);
  });

  it.each(plannerGolden.cases)("matches the independent Python $name ranking", (golden) => {
    const goldenBaseline = plannerGolden.baseline.map((probability, index) => ({
      horizon_years: index + 1,
      probability,
    }));
    const all = enumeratePlannerAlternatives(golden.profile, goldenBaseline);
    const ranked = rankExploratoryAlternatives(golden.profile, goldenBaseline);

    expect(all).toHaveLength(golden.expected.candidate_count);
    ranked.forEach((item, index) => {
      const expected = golden.expected.top[index];
      expect(item.candidate).toEqual(expected.candidate);
      expect(item.effort).toBeCloseTo(expected.effort, 14);
      expect(item.score).toBeCloseTo(expected.score, 14);
      item.scenario.horizons.forEach((horizon, horizonIndex) => {
        expect(horizon.point).toBeCloseTo(expected.point[horizonIndex], 14);
      });
    });
  });

  it("reports point-ranked alternatives against the 16 independent Python evidence corners", () => {
    const analysis = analyzeEvidenceSensitivity(profile, baseline);

    expect(analysis.cornerCount).toBe(16);
    expect(analysis.distinctWinnerCount).toBe(6);
    expect(analysis.alternatives).toHaveLength(5);
    expect(analysis.alternatives[0]).toMatchObject({
      candidate: { bmi: 25, exercise: 7, fruitVegetable: 5, sugaryDrinks: 0 },
      topRankedCorners: 4,
      topFiveCorners: 7,
      minimumRank: 1,
      maximumRank: 118,
    });
    expect(analysis.alternatives.map((item) => item.topRankedCorners)).toEqual([4, 0, 0, 0, 0]);
    expect(analysis.alternatives.map((item) => item.topFiveCorners)).toEqual([7, 4, 6, 4, 0]);
  });
});
