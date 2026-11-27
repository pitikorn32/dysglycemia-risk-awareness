import { describe, expect, it } from "vitest";

import { calculateScenario } from "./scenarioEngine";
import goldenCases from "./golden_cases.json";

describe("bounded survival-scale scenario engine", () => {
  it("reproduces the paper's BMI worked example", () => {
    const result = calculateScenario(
      [{ horizon_years: 5, probability: 0.198 }],
      { bmi: -2, exercise: 0, fruitVegetable: 0, sugaryDrinks: 0 },
    );

    expect(0.198 - result.horizons[0].point).toBeCloseTo(0.0353, 3);
    expect(result.horizons[0].low).toBeLessThanOrEqual(result.horizons[0].point);
    expect(result.horizons[0].point).toBeLessThanOrEqual(result.horizons[0].high);
  });

  it("leaves the baseline unchanged for a zero-change scenario", () => {
    const result = calculateScenario(
      [
        { horizon_years: 1, probability: 0.04 },
        { horizon_years: 5, probability: 0.2 },
      ],
      { bmi: 0, exercise: 0, fruitVegetable: 0, sugaryDrinks: 0 },
    );

    expect(result.multiplier.point).toBe(1);
    expect(result.horizons.map((item) => item.point)).toEqual([0.04, 0.2]);
  });

  it("applies the multiplier floor and keeps every estimate bounded", () => {
    const result = calculateScenario(
      [{ horizon_years: 5, probability: 0.8 }],
      { bmi: -20, exercise: 30, fruitVegetable: 30, sugaryDrinks: -30 },
    );

    expect(result.multiplier.point).toBe(0.3);
    expect(result.multiplier.low).toBeGreaterThanOrEqual(0.3);
    expect(result.horizons[0].low).toBeGreaterThanOrEqual(0);
    expect(result.horizons[0].high).toBeLessThanOrEqual(1);
    expect(result.horizons[0].high).toBeLessThanOrEqual(0.8);
  });

  it.each(goldenCases)("matches the independent Python $name golden", (golden) => {
    const baseline = golden.baseline.map((probability, index) => ({
      horizon_years: index + 1,
      probability,
    }));
    const result = calculateScenario(baseline, golden.changes);

    expect(result.multiplier.point).toBeCloseTo(golden.expected.multiplier.point, 14);
    expect(result.multiplier.low).toBeCloseTo(golden.expected.multiplier.low, 14);
    expect(result.multiplier.high).toBeCloseTo(golden.expected.multiplier.high, 14);
    result.horizons.forEach((horizon, index) => {
      expect(horizon.point).toBeCloseTo(golden.expected.point[index], 14);
      expect(horizon.low).toBeCloseTo(golden.expected.low[index], 14);
      expect(horizon.high).toBeCloseTo(golden.expected.high[index], 14);
    });
  });
});
