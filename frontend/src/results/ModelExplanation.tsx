import { useState } from "react";

import type { HorizonExplanation } from "../api/baseline";

const HORIZON_WORDS: Record<number, string> = {
  1: "One",
  2: "Two",
  3: "Three",
  4: "Four",
  5: "Five",
};

function ReferencePercent({ value }: { value: number }) {
  return (
    <>
      {new Intl.NumberFormat("en", {
        style: "percent",
        maximumFractionDigits: 1,
      }).format(value)}
    </>
  );
}

export function ModelExplanation({ explanations, synthetic = false }: { explanations: HorizonExplanation[]; synthetic?: boolean }) {
  const [selectedHorizon, setSelectedHorizon] = useState(5);
  const selected =
    explanations.find((item) => item.horizon_years === selectedHorizon) ?? explanations.at(-1);

  if (!selected) return null;

  const topContributions = selected.contributions.slice(0, 5);
  const maximumMagnitude = Math.max(
    ...topContributions.map((item) => Math.abs(item.log_odds_contribution)),
    1e-12,
  );
  const horizonWord = HORIZON_WORDS[selected.horizon_years] ?? String(selected.horizon_years);

  return (
    <section aria-labelledby="explanation-heading" className="model-explanation">
      <p className="eyebrow">{synthetic ? "Synthetic attribution example" : "Exact local attribution"}</p>
      <h2 id="explanation-heading">{synthetic ? "How example contributions add up" : "What moved this model estimate"}</h2>
      <p className="explanation-lead">
        {synthetic
          ? "These invented contributions illustrate log-odds arithmetic. They are independent of the submitted assessment."
          : "The five largest grouped terms are shown for one horizon at a time. Positive terms raise the model’s log-odds relative to its frozen reference and negative terms lower them."}
      </p>

      <div aria-label="Explanation horizon" className="horizon-picker" role="group">
        {explanations.map((item) => (
          <button
            aria-label={`${item.horizon_years} year explanation`}
            aria-pressed={item.horizon_years === selected.horizon_years}
            key={item.horizon_years}
            onClick={() => setSelectedHorizon(item.horizon_years)}
            type="button"
          >
            {item.horizon_years} year
          </button>
        ))}
      </div>

      <p className="explanation-reference">
        <strong>
          <ReferencePercent value={selected.reference_probability} /> model reference
        </strong>
        <span>
          {synthetic ? "Hand-authored example reference." : "Frozen preprocessing feature means; this reference may not describe a real person."}
        </span>
      </p>

      <div className="table-scroll explanation-table">
        <table aria-label={`${horizonWord}-year model contributions`}>
          <caption>Largest absolute contributions on the log-odds scale</caption>
          <thead>
            <tr>
              <th scope="col">Grouped model term</th>
              <th scope="col">Direction</th>
              <th scope="col">Contribution</th>
            </tr>
          </thead>
          <tbody>
            {topContributions.map((item) => {
              const direction = item.log_odds_contribution >= 0 ? "Higher" : "Lower";
              return (
                <tr key={item.feature_group}>
                  <th scope="row">{item.label}</th>
                  <td>{direction}</td>
                  <td className="contribution-cell">
                    <span
                      aria-hidden="true"
                      className={`contribution-bar ${direction.toLowerCase()}`}
                      style={{ width: `${(Math.abs(item.log_odds_contribution) / maximumMagnitude) * 100}%` }}
                    />
                    <span>{item.log_odds_contribution.toFixed(3)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <aside className="information-note">
        {synthetic ? "This table uses fixed demonstration values." : "This attribution explains the frozen model calculation."} It does not show causes or
        recommended changes. A different reference can change the contributions without changing
        the model estimate.
      </aside>
    </section>
  );
}
