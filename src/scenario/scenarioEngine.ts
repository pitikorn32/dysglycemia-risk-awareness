import type { HorizonProbability } from "../api/baseline";

export interface ScenarioChanges {
  bmi: number;
  exercise: number;
  fruitVegetable: number;
  sugaryDrinks: number;
}

export interface ScenarioHorizon extends HorizonProbability {
  point: number;
  low: number;
  high: number;
}

export interface ScenarioResult {
  changes: ScenarioChanges;
  multiplier: { point: number; low: number; high: number };
  horizons: ScenarioHorizon[];
}

interface MultiplierRange {
  point: number;
  low: number;
  high: number;
}

export const effectMultipliers: Record<keyof ScenarioChanges, MultiplierRange> = {
  bmi: { point: 1.1146, low: 1.1053, high: 1.126 },
  exercise: { point: 0.9692, low: 0.9615, high: 0.9741 },
  fruitVegetable: { point: 0.9912, low: 0.9835, high: 1 },
  sugaryDrinks: { point: 1.0176, low: 1.0084, high: 1.0276 },
};

const multiplierFloor = 0.3;
const factors = Object.keys(effectMultipliers) as Array<keyof ScenarioChanges>;

function combinedMultiplier(changes: ScenarioChanges, values: Record<keyof ScenarioChanges, number>) {
  const product = factors.reduce((current, factor) => current * values[factor] ** changes[factor], 1);
  return Math.max(multiplierFloor, product);
}

function pointMultiplier(changes: ScenarioChanges) {
  return combinedMultiplier(
    changes,
    Object.fromEntries(factors.map((factor) => [factor, effectMultipliers[factor].point])) as Record<
      keyof ScenarioChanges,
      number
    >,
  );
}

function endpointMultipliers(changes: ScenarioChanges): number[] {
  const multipliers: number[] = [];
  for (let mask = 0; mask < 2 ** factors.length; mask += 1) {
    const values = Object.fromEntries(
      factors.map((factor, index) => [
        factor,
        mask & (1 << index) ? effectMultipliers[factor].high : effectMultipliers[factor].low,
      ]),
    ) as Record<keyof ScenarioChanges, number>;
    multipliers.push(combinedMultiplier(changes, values));
  }
  return multipliers;
}

export function scenarioProbability(baseline: number, multiplier: number): number {
  if (!Number.isFinite(baseline) || baseline < 0 || baseline > 1) {
    throw new RangeError("Baseline probabilities must be finite values from 0 to 1.");
  }
  if (!Number.isFinite(multiplier) || multiplier < multiplierFloor) {
    throw new RangeError("Scenario multiplier must be finite and at least 0.30.");
  }
  if (multiplier === 1 || baseline === 0 || baseline === 1) return baseline;
  return 1 - (1 - baseline) ** multiplier;
}

export function calculateScenario(
  baseline: HorizonProbability[],
  changes: ScenarioChanges,
): ScenarioResult {
  if (factors.some((factor) => !Number.isFinite(changes[factor]))) {
    throw new RangeError("Scenario changes must be finite.");
  }
  const point = pointMultiplier(changes);
  const corners = endpointMultipliers(changes);
  const low = Math.min(...corners);
  const high = Math.max(...corners);
  return {
    changes: { ...changes },
    multiplier: { point, low, high },
    horizons: baseline.map((item) => ({
      ...item,
      point: scenarioProbability(item.probability, point),
      low: scenarioProbability(item.probability, low),
      high: scenarioProbability(item.probability, high),
    })),
  };
}
