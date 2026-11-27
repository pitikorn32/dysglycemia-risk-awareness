import { useEffect, useMemo, useState } from "react";

import type { HorizonProbability } from "../api/baseline";
import { TrajectoryChart } from "../results/TrajectoryChart";
import {
  analyzeEvidenceSensitivity,
  type EvidenceSensitivityAlternative,
  type PlannerProfile,
} from "./planner";
import { calculateScenario, type ScenarioChanges } from "./scenarioEngine";

interface Reductions {
  bmi: number;
  exercise: number;
  fruitVegetable: number;
  sugaryDrinks: number;
}

const emptyReductions: Reductions = { bmi: 0, exercise: 0, fruitVegetable: 0, sugaryDrinks: 0 };

function percentage(value: number) {
  return new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

function isComplete(anchors: Partial<PlannerProfile>): anchors is PlannerProfile {
  return (
    typeof anchors.bmi === "number" &&
    typeof anchors.exercise === "number" &&
    typeof anchors.fruitVegetable === "number" &&
    typeof anchors.sugaryDrinks === "number"
  );
}

function FactorControl({
  disabled,
  id,
  label,
  max,
  onChange,
  output,
  step,
  value,
}: {
  disabled: boolean;
  id: string;
  label: string;
  max: number;
  onChange: (value: number) => void;
  output: string;
  step: number;
  value: number;
}) {
  return (
    <div className="scenario-control">
      <div>
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{output}</output>
      </div>
      <input
        disabled={disabled}
        id={id}
        max={max}
        min="0"
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
      {disabled && <small>Not available because this anchor was not provided.</small>}
    </div>
  );
}

function AlternativeCard({
  alternative,
  index,
  onApply,
}: {
  alternative: EvidenceSensitivityAlternative;
  index: number;
  onApply: () => void;
}) {
  const fiveYear = alternative.scenario.horizons.at(-1);
  const difference = fiveYear ? (fiveYear.probability - fiveYear.point) * 100 : 0;
  return (
    <li className="alternative-card">
      <div className="alternative-summary">
        <span>Alternative {index + 1}</span>
        <strong>{difference.toFixed(1)} pp lower at 5 years</strong>
      </div>
      <div className="alternative-sensitivity">
        <span>Evidence-corner ranks</span>
        <strong>First under {alternative.topRankedCorners} of 16</strong>
        <small>
          Top five under {alternative.topFiveCorners} of 16 · Rank range {alternative.minimumRank}–{alternative.maximumRank}
        </small>
      </div>
      <dl>
        <div><dt>BMI</dt><dd>{alternative.candidate.bmi}</dd></div>
        <div><dt>Exercise</dt><dd>{alternative.candidate.exercise}/wk</dd></div>
        <div><dt>Fruit/veg</dt><dd>{alternative.candidate.fruitVegetable}/wk</dd></div>
        <div><dt>SSB</dt><dd>{alternative.candidate.sugaryDrinks}/wk</dd></div>
      </dl>
      <button className="secondary-action" onClick={onApply} type="button">
        Apply alternative {index + 1}
      </button>
    </li>
  );
}

export function ScenarioExplorer({
  anchors,
  baseline,
}: {
  anchors: Partial<PlannerProfile>;
  baseline: HorizonProbability[];
}) {
  const [reductions, setReductions] = useState(emptyReductions);
  const [selectedHorizon, setSelectedHorizon] = useState(baseline.at(-1)?.horizon_years ?? 1);
  const limits = {
    bmi: typeof anchors.bmi === "number" ? Math.max(0, Math.min(2, anchors.bmi - 18.5)) : 0,
    exercise:
      typeof anchors.exercise === "number" ? Math.max(0, Math.min(5, 14 - anchors.exercise)) : 0,
    fruitVegetable:
      typeof anchors.fruitVegetable === "number"
        ? Math.max(0, Math.min(14, 21 - anchors.fruitVegetable))
        : 0,
    sugaryDrinks: typeof anchors.sugaryDrinks === "number" ? Math.max(0, anchors.sugaryDrinks) : 0,
  };
  const changes: ScenarioChanges = {
    bmi: -reductions.bmi,
    exercise: reductions.exercise,
    fruitVegetable: reductions.fruitVegetable,
    sugaryDrinks: -reductions.sugaryDrinks,
  };
  const scenario = calculateScenario(baseline, changes);
  useEffect(() => {
    if (!baseline.some((item) => item.horizon_years === selectedHorizon)) {
      setSelectedHorizon(baseline.at(-1)?.horizon_years ?? 1);
    }
  }, [baseline, selectedHorizon]);
  const sensitivity = useMemo(
    () => (isComplete(anchors) && anchors.bmi >= 18.5 ? analyzeEvidenceSensitivity(anchors, baseline) : null),
    [anchors, baseline],
  );
  const alternatives = sensitivity?.alternatives ?? [];
  const missing = [
    typeof anchors.bmi !== "number" && "current BMI",
    typeof anchors.exercise !== "number" && "exercise",
    typeof anchors.fruitVegetable !== "number" && "fruit/vegetable intake",
    typeof anchors.sugaryDrinks !== "number" && "sugar-sweetened drinks",
  ].filter(Boolean);

  const set = (factor: keyof Reductions, value: number) => {
    setReductions((current) => ({ ...current, [factor]: value }));
  };
  const apply = (alternative: EvidenceSensitivityAlternative) => {
    setReductions({
      bmi: -alternative.changes.bmi,
      exercise: alternative.changes.exercise,
      fruitVegetable: alternative.changes.fruitVegetable,
      sugaryDrinks: -alternative.changes.sugaryDrinks,
    });
  };

  return (
    <section className="scenario-explorer" aria-labelledby="scenario-heading">
      <div className="scenario-layout">
        <div className="scenario-chart-column">
          <TrajectoryChart
            baseline={baseline}
            onSelectHorizon={setSelectedHorizon}
            scenario={scenario}
            selectedHorizon={selectedHorizon}
          />
        </div>
        <div className="scenario-content-column">
          <div className="scenario-heading-row">
            <div>
              <p className="eyebrow">Non-causal exploration</p>
              <h2 id="scenario-heading">Scenario estimate under published assumptions</h2>
            </div>
            <button className="secondary-action" onClick={() => setReductions(emptyReductions)} type="button">
              Reset scenario
            </button>
          </div>
          <p className="scenario-warning">
            These population-association assumptions do not estimate your personal causal benefit.
            The range varies cited multiplier endpoints only; it is not a confidence or treatment interval.
          </p>

          <div className="scenario-controls">
            <FactorControl
              disabled={limits.bmi === 0}
              id="bmi-reduction"
              label="BMI reduction (kg/m²)"
              max={limits.bmi}
              onChange={(value) => set("bmi", value)}
              output={reductions.bmi === 0 ? "No BMI change" : `${reductions.bmi.toFixed(1)} kg/m² lower`}
              step={0.1}
              value={reductions.bmi}
            />
            <FactorControl
              disabled={limits.exercise === 0}
              id="exercise-increase"
              label="Additional exercise sessions per week"
              max={limits.exercise}
              onChange={(value) => set("exercise", value)}
              output={reductions.exercise === 0 ? "No exercise change" : `+${reductions.exercise}/week`}
              step={1}
              value={reductions.exercise}
            />
            <FactorControl
              disabled={limits.fruitVegetable === 0}
              id="fruit-increase"
              label="Additional fruit or vegetable servings per week"
              max={limits.fruitVegetable}
              onChange={(value) => set("fruitVegetable", value)}
              output={reductions.fruitVegetable === 0 ? "No fruit/veg change" : `+${reductions.fruitVegetable}/week`}
              step={1}
              value={reductions.fruitVegetable}
            />
            <FactorControl
              disabled={limits.sugaryDrinks === 0}
              id="ssb-reduction"
              label="Fewer sugar-sweetened drinks per week"
              max={limits.sugaryDrinks}
              onChange={(value) => set("sugaryDrinks", value)}
              output={reductions.sugaryDrinks === 0 ? "No SSB change" : `−${reductions.sugaryDrinks}/week`}
              step={1}
              value={reductions.sugaryDrinks}
            />
          </div>

          <div className="table-scroll scenario-table">
            <table aria-label="Baseline and scenario estimates">
              <caption>Baseline compared with the current scenario</caption>
              <thead><tr><th scope="col">Horizon</th><th scope="col">Fixed baseline</th><th scope="col">Scenario point</th><th scope="col">Assumption range</th></tr></thead>
              <tbody>
                {scenario.horizons.map((item) => (
                  <tr key={item.horizon_years}>
                    <th scope="row">{item.horizon_years} year</th>
                    <td>{percentage(item.probability)}</td>
                    <td>{percentage(item.point)}</td>
                    <td>{percentage(item.low)}–{percentage(item.high)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section className="alternatives-section" aria-labelledby="alternatives-heading">
            <p className="eyebrow">Deterministic grid · effort penalty 0.03</p>
            <h3 id="alternatives-heading">Ranked exploratory alternatives</h3>
            <p>
              Multiple alternatives are shown because ordering changes with evidence assumptions.
              Their rank is reproducible for fixed inputs, not a personal recommendation.
            </p>
            {sensitivity && (
              <aside className="evidence-sensitivity" aria-labelledby="evidence-sensitivity-heading">
                <p className="eyebrow">No universal best plan</p>
                <h4 id="evidence-sensitivity-heading">
                  Evidence sensitivity across {sensitivity.cornerCount} assumption sets
                </h4>
                <p>
                  {sensitivity.distinctWinnerCount} different candidates ranked first across these assumptions.
                  Counts below describe literature-endpoint sensitivity, not the probability that a plan will work.
                </p>
              </aside>
            )}
            {alternatives.length > 0 ? (
              <ol aria-label="Ranked exploratory alternatives" className="alternative-list">
                {alternatives.map((alternative, index) => (
                  <AlternativeCard
                    alternative={alternative}
                    index={index}
                    key={`${alternative.candidate.bmi}-${alternative.candidate.exercise}-${alternative.candidate.fruitVegetable}-${alternative.candidate.sugaryDrinks}`}
                    onApply={() => apply(alternative)}
                  />
                ))}
              </ol>
            ) : (
              <aside className="information-note">
                Ranked alternatives need all four anchors. Missing: {missing.join(", ") || "a BMI of at least 18.5"}.
              </aside>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
