import type { HorizonProbability } from "../api/baseline";
import {
  calculateScenario,
  effectMultipliers,
  scenarioProbability,
  type ScenarioChanges,
  type ScenarioResult,
} from "./scenarioEngine";

export interface PlannerProfile {
  bmi: number;
  exercise: number;
  fruitVegetable: number;
  sugaryDrinks: number;
}

export interface PlannerAlternative {
  candidate: PlannerProfile;
  changes: ScenarioChanges;
  effort: number;
  score: number;
  scenario: ScenarioResult;
}

export interface EvidenceSensitivityAlternative extends PlannerAlternative {
  maximumRank: number;
  minimumRank: number;
  topFiveCorners: number;
  topRankedCorners: number;
}

export interface EvidenceSensitivityAnalysis {
  alternatives: EvidenceSensitivityAlternative[];
  cornerCount: number;
  distinctWinnerCount: number;
}

export const effortPenalty = 0.03;

const evidenceFactors = Object.keys(effectMultipliers) as Array<keyof ScenarioChanges>;
const evidenceCornerCount = 2 ** evidenceFactors.length;

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values.map((value) => Math.round(value * 100) / 100))].sort((a, b) => a - b);
}

function validateProfile(profile: PlannerProfile) {
  if (Object.values(profile).some((value) => !Number.isFinite(value))) {
    throw new RangeError("Planner anchors must be finite.");
  }
  if (profile.bmi < 18.5) throw new RangeError("The planner requires a current BMI of at least 18.5.");
  if (profile.exercise < 0 || profile.exercise > 14) throw new RangeError("Exercise anchor is outside 0–14.");
  if (profile.fruitVegetable < 0 || profile.fruitVegetable > 21) {
    throw new RangeError("Fruit and vegetable anchor is outside 0–21.");
  }
  if (profile.sugaryDrinks < 0 || profile.sugaryDrinks > 42) {
    throw new RangeError("Sugar-sweetened drink anchor is outside 0–42.");
  }
}

function plannerAxes(profile: PlannerProfile) {
  return {
    bmi: uniqueSorted([0, -0.5, -1, -1.5, -2].map((change) => Math.max(18.5, profile.bmi + change))),
    exercise: uniqueSorted([0, 1, 2, 3, 5].map((change) => Math.min(14, profile.exercise + change))),
    fruitVegetable: uniqueSorted(
      [0, 3, 7, 14].map((change) => Math.min(21, profile.fruitVegetable + change)),
    ),
    sugaryDrinks: uniqueSorted([
      ...[0, 1, 3, 7].map((reduction) => Math.max(0, profile.sugaryDrinks - reduction)),
      0,
    ]),
  };
}

export function plannerEffort(profile: PlannerProfile, candidate: PlannerProfile): number {
  return (
    Math.max(0, profile.bmi - candidate.bmi) +
    Math.max(0, candidate.exercise - profile.exercise) / 2 +
    Math.max(0, candidate.fruitVegetable - profile.fruitVegetable) / 4 +
    Math.max(0, profile.sugaryDrinks - candidate.sugaryDrinks) / 4
  );
}

export function enumeratePlannerAlternatives(
  profile: PlannerProfile,
  baseline: HorizonProbability[],
): PlannerAlternative[] {
  validateProfile(profile);
  if (baseline.length !== 5 || baseline.some((item) => item.probability <= 0 || item.probability > 1)) {
    throw new RangeError("The planner requires five positive baseline probabilities.");
  }
  const axes = plannerAxes(profile);
  const alternatives: PlannerAlternative[] = [];
  axes.bmi.forEach((bmi) => {
    axes.exercise.forEach((exercise) => {
      axes.fruitVegetable.forEach((fruitVegetable) => {
        axes.sugaryDrinks.forEach((sugaryDrinks) => {
          const candidate = { bmi, exercise, fruitVegetable, sugaryDrinks };
          const changes = {
            bmi: bmi - profile.bmi,
            exercise: exercise - profile.exercise,
            fruitVegetable: fruitVegetable - profile.fruitVegetable,
            sugaryDrinks: sugaryDrinks - profile.sugaryDrinks,
          };
          const scenario = calculateScenario(baseline, changes);
          const normalizedScenario =
            scenario.horizons.reduce(
              (total, horizon) => total + horizon.point / horizon.probability,
              0,
            ) / 5;
          const effort = plannerEffort(profile, candidate);
          alternatives.push({
            candidate,
            changes,
            effort,
            score: normalizedScenario + effortPenalty * effort,
            scenario,
          });
        });
      });
    });
  });
  return alternatives;
}

export function rankExploratoryAlternatives(
  profile: PlannerProfile,
  baseline: HorizonProbability[],
  limit = 5,
): PlannerAlternative[] {
  return enumeratePlannerAlternatives(profile, baseline)
    .map((alternative, order) => ({ alternative, order }))
    .sort((left, right) => left.alternative.score - right.alternative.score || left.order - right.order)
    .slice(0, Math.max(0, limit))
    .map(({ alternative }) => alternative);
}

function cornerMultiplier(changes: ScenarioChanges, mask: number): number {
  const multiplier = evidenceFactors.reduce((product, factor, index) => {
    const endpoints = effectMultipliers[factor];
    const endpoint = mask & (1 << index) ? endpoints.high : endpoints.low;
    return product * endpoint ** changes[factor];
  }, 1);
  return Math.max(0.3, multiplier);
}

function scoreAtEvidenceCorner(
  alternative: PlannerAlternative,
  baseline: HorizonProbability[],
  mask: number,
): number {
  const multiplier = cornerMultiplier(alternative.changes, mask);
  const normalizedScenario = baseline.reduce(
    (total, horizon) =>
      total + scenarioProbability(horizon.probability, multiplier) / horizon.probability,
    0,
  ) / baseline.length;
  return normalizedScenario + effortPenalty * alternative.effort;
}

export function analyzeEvidenceSensitivity(
  profile: PlannerProfile,
  baseline: HorizonProbability[],
  limit = 5,
): EvidenceSensitivityAnalysis {
  const alternatives = enumeratePlannerAlternatives(profile, baseline);
  const pointOrder = alternatives
    .map((alternative, index) => ({ alternative, index }))
    .sort(
      (left, right) =>
        left.alternative.score - right.alternative.score || left.index - right.index,
    );
  const cornerRanks = alternatives.map(() => Array<number>(evidenceCornerCount).fill(0));
  const winners = new Set<number>();

  for (let mask = 0; mask < evidenceCornerCount; mask += 1) {
    const order = alternatives
      .map((alternative, index) => ({
        index,
        score: scoreAtEvidenceCorner(alternative, baseline, mask),
      }))
      .sort((left, right) => left.score - right.score || left.index - right.index);
    winners.add(order[0].index);
    order.forEach((item, rankIndex) => {
      cornerRanks[item.index][mask] = rankIndex + 1;
    });
  }

  return {
    alternatives: pointOrder.slice(0, Math.max(0, limit)).map(({ alternative, index }) => {
      const ranks = cornerRanks[index];
      return {
        ...alternative,
        maximumRank: Math.max(...ranks),
        minimumRank: Math.min(...ranks),
        topFiveCorners: ranks.filter((rank) => rank <= 5).length,
        topRankedCorners: ranks.filter((rank) => rank === 1).length,
      };
    }),
    cornerCount: evidenceCornerCount,
    distinctWinnerCount: winners.size,
  };
}
