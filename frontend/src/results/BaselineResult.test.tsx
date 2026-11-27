import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BaselineResult } from "./BaselineResult";

const scored = {
  status: "scored" as const,
  baseline: [
    { horizon_years: 1, probability: 0.08 },
    { horizon_years: 2, probability: 0.13 },
    { horizon_years: 3, probability: 0.18 },
    { horizon_years: 4, probability: 0.22 },
    { horizon_years: 5, probability: 0.27 },
  ],
  explanations: [1, 2, 3, 4, 5].map((horizon) => ({
    horizon_years: horizon,
    reference_probability: 0.1 + horizon * 0.01,
    contributions: [
      {
        feature_group: "fbs_history",
        label: "Fasting blood sugar history",
        log_odds_contribution: 0.42 + horizon * 0.01,
      },
      {
        feature_group: "exercise",
        label: "Exercise",
        log_odds_contribution: -0.18,
      },
      {
        feature_group: "age",
        label: "Age",
        log_odds_contribution: 0.08,
      },
    ],
  })),
  data_quality: [],
  model_release: {
    release_id: "bhi-ridge-m5-no-year-v1",
    model_family: "raw ridge logistic regression",
    history_years: 5,
  },
};

describe("baseline result", () => {
  it("presents the fixed trajectory as both a chart and an exact table", async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<BaselineResult onEdit={onEdit} response={scored} />);

    expect(screen.getByRole("img", { name: "Baseline risk trajectory chart" })).toBeInTheDocument();
    const exactTable = screen.getByRole("table", { name: "Exact baseline probabilities" });
    expect(exactTable).toBeInTheDocument();
    expect(within(exactTable).getByRole("cell", { name: "27%" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit inputs" }));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it("shows no probability when the profile is outside applicability", () => {
    render(
      <BaselineResult
        onEdit={() => undefined}
        response={{
          status: "outside_applicability",
          reasons: [
            {
              code: "known_fbs_over_100",
              message: "This baseline model applies only before any known FBS above 100 mg/dL.",
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "No baseline probability is shown" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows a horizon-specific local attribution with its reference and limits", async () => {
    const user = userEvent.setup();
    render(<BaselineResult onEdit={() => undefined} response={scored} />);

    expect(
      screen.getByRole("heading", { name: "What moved this model estimate" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Fasting blood sugar history")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Five-year model contributions" })).toBeInTheDocument();
    expect(screen.getByText("15% model reference")).toBeInTheDocument();
    expect(screen.getByText(/does not show causes or recommended changes/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "1 year explanation" }));
    expect(screen.getByRole("table", { name: "One-year model contributions" })).toBeInTheDocument();
    expect(screen.getByText("11% model reference")).toBeInTheDocument();
  });

  it("explores local scenarios and exposes evidence-sensitive alternative ranks", () => {
    render(
      <BaselineResult
        anchors={{ bmi: 27, exercise: 2, fruitVegetable: 5, sugaryDrinks: 5 }}
        onEdit={() => undefined}
        response={scored}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Scenario estimate under published assumptions" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("BMI reduction (kg/m²)"), { target: { value: "1" } });
    expect(screen.getByText("1.0 kg/m² lower")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Baseline and scenario estimates" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Ranked exploratory alternatives" })).toHaveTextContent(
      "Alternative 5",
    );
    expect(
      screen.getByRole("heading", { name: "Evidence sensitivity across 16 assumption sets" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/6 different candidates ranked first across these assumptions/i),
    ).toBeInTheDocument();
    const firstAlternative = screen
      .getByRole("list", { name: "Ranked exploratory alternatives" })
      .getElementsByTagName("li")[0];
    expect(firstAlternative).toHaveTextContent("First under 4 of 16");
    expect(firstAlternative).toHaveTextContent("Rank range 1–121");

    fireEvent.click(screen.getByRole("button", { name: "Reset scenario" }));
    expect(screen.getByText("No BMI change")).toBeInTheDocument();
  });
});
