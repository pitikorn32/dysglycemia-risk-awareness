import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

describe("research-prototype entry", () => {
  afterEach(() => {
    window.history.replaceState({}, "", "/");
    vi.restoreAllMocks();
  });

  it("requires scope acknowledgement before starting an assessment", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(
      screen.getByRole("heading", { name: /understand risk without pretending certainty/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^research prototype$/i)).toBeInTheDocument();
    expect(screen.getByText(/inputs are sent to the baseline server for temporary processing/i)).toBeInTheDocument();
    expect(screen.queryByText(/your information stays in this temporary browser session/i)).not.toBeInTheDocument();
    const start = screen.getByRole("button", { name: /start anonymous assessment/i });
    expect(start).toBeDisabled();

    await user.click(
      screen.getByRole("checkbox", {
        name: /i understand this is not a diagnosis or treatment recommendation/i,
      }),
    );

    expect(start).toBeEnabled();
  });

  it("validates the required age before advancing from About you", async () => {
    window.history.replaceState({}, "", "/assessment");
    const user = userEvent.setup();

    render(<App />);

    expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "About you" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByText("Enter an age from 18 to 100.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Age"), "42");
    await user.selectOptions(screen.getByLabelText("Sex (optional)"), "female");
    await user.click(
      screen.getByLabelText("Yes", { selector: "input[name='family-history']" }),
    );
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(screen.getByText("Step 2 of 5")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Everyday patterns" })).toBeInTheDocument();
    expect(screen.getByLabelText("Physical activity frequency per week (optional)")).toHaveAttribute("max", "14");
    expect(screen.getByText(/this serving proxy is unvalidated/i)).toBeInTheDocument();
    expect(screen.getByText(/original questionnaire unit is unverified/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByDisplayValue("42")).toBeInTheDocument();
    expect(screen.getByLabelText("Sex (optional)")).toHaveValue("female");
  });

  it("validates and retains optional everyday-pattern inputs", async () => {
    window.history.replaceState({}, "", "/assessment");
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Age"), "42");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    const sugary = screen.getByLabelText("Sugar-sweetened drinks per week (optional)");
    await user.type(sugary, "50");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByText("Use a value from 0 to 42, or leave it blank.")).toBeInTheDocument();

    await user.clear(sugary);
    await user.type(sugary, "7");
    await user.type(screen.getByLabelText("Exercise sessions per week (optional)"), "4");
    await user.selectOptions(screen.getByLabelText("Smoking status (optional)"), "never");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(screen.getByText("Step 3 of 5")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByLabelText("Sugar-sweetened drinks per week (optional)")).toHaveValue(7);
    expect(screen.getByLabelText("Smoking status (optional)")).toHaveValue("never");
  });

  it("requires an earlier-FBS answer while allowing uncertainty", async () => {
    window.history.replaceState({}, "", "/assessment");
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Age"), "42");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByText("Choose Yes, No, or Not sure.")).toBeInTheDocument();

    await user.click(
      screen.getByLabelText("Not sure", { selector: "input[name='earlier-fbs']" }),
    );
    await user.type(screen.getByLabelText("Highest earlier FBS in mg/dL (optional)"), "95");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(screen.getByText("Step 4 of 5")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(
      screen.getByLabelText("Not sure", { selector: "input[name='earlier-fbs']" }),
    ).toBeChecked();
    expect(screen.getByLabelText("Highest earlier FBS in mg/dL (optional)")).toHaveValue(95);
  });

  it("validates and retains five relative annual health records", async () => {
    window.history.replaceState({}, "", "/assessment");
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Age"), "42");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByLabelText("No", { selector: "input[name='earlier-fbs']" }));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    const slotLabels = ["Four years ago", "Three years ago", "Two years ago", "One year ago", "Current"];
    expect(screen.getAllByLabelText(/FBS \(mg\/dL\)$/).map((input) => input.id)).toEqual(
      slotLabels.map((label, index) => {
        expect(screen.getByLabelText(`${label} FBS (mg/dL)`)).toBeInTheDocument();
        return `annual-${index}-fbs`;
      }),
    );
    expect(screen.queryByText("Five years ago")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Current FBS (mg/dL)"), "95");
    await user.type(screen.getByLabelText("Current BMI (kg/m²)"), "27.5");
    await user.type(screen.getByLabelText("Current systolic BP (mmHg)"), "70");
    await user.type(screen.getByLabelText("Current diastolic BP (mmHg)"), "80");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(
      screen.getByText("Systolic blood pressure must be greater than diastolic blood pressure."),
    ).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Current systolic BP (mmHg)"));
    await user.type(screen.getByLabelText("Current systolic BP (mmHg)"), "120");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByText("Step 5 of 5")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByLabelText("Current FBS (mg/dL)")).toHaveValue(95);
    expect(screen.getByLabelText("Current BMI (kg/m²)")).toHaveValue(27.5);
  });

  it("reviews and submits the anonymous baseline contract", async () => {
    window.history.replaceState({}, "", "/assessment");
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "scored",
          baseline: [
            { horizon_years: 1, probability: 0.08 },
            { horizon_years: 2, probability: 0.13 },
            { horizon_years: 3, probability: 0.18 },
            { horizon_years: 4, probability: 0.22 },
            { horizon_years: 5, probability: 0.27 },
          ],
          explanations: [1, 2, 3, 4, 5].map((horizon) => ({
            horizon_years: horizon,
            reference_probability: 0.1,
            contributions: [
              {
                feature_group: "fbs_history",
                label: "Fasting blood sugar history",
                log_odds_contribution: 0.2,
              },
            ],
          })),
          data_quality: [],
          model_release: {
            release_id: "bhi-ridge-m5-no-year-v1",
            model_family: "raw ridge logistic regression",
            history_years: 5,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Age"), "42");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.type(screen.getByLabelText("Exercise sessions per week (optional)"), "4");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByLabelText("No", { selector: "input[name='earlier-fbs']" }));
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.type(screen.getByLabelText("Current FBS (mg/dL)"), "95");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(screen.getByRole("heading", { name: "Review" })).toBeInTheDocument();
    expect(screen.getByText("Age 42")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Calculate baseline" }));

    expect(
      await screen.findByRole("heading", { name: "Your baseline trajectory" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/baseline");
    const body = JSON.parse(String(options?.body));
    expect(body).toMatchObject({
      age: 42,
      exercise_days_per_week: 4,
      earlier_fbs_over_100: "no",
    });
    expect(body.annual_history).toHaveLength(5);
    expect(body.annual_history[4].fbs).toBe(95);

    await user.click(screen.getByRole("button", { name: "Edit inputs" }));
    expect(screen.queryByRole("heading", { name: "Your baseline trajectory" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Review" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByLabelText("Current FBS (mg/dL)")).toHaveValue(95);
  });

  it("documents the two-box method, limits, and HealthCom boundary", () => {
    window.history.replaceState({}, "", "/about");
    render(<App />);

    expect(screen.getByRole("heading", { name: "Methods & limits" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Two evidence boxes" })).toBeInTheDocument();
    expect(screen.getByText(/separate work owns model-family benchmarking/i)).toBeInTheDocument();
    expect(screen.getByText(/frozen preprocessing feature-mean reference/i)).toBeInTheDocument();
    expect(screen.getByText(/no prospective clinical or usability validation/i)).toBeInTheDocument();
    expect(screen.getByText(/fruit-only association as a proxy/i)).toBeInTheDocument();
    expect(screen.getByText(/transfer to this cohort's incident dysglycemia is unvalidated/i)).toBeInTheDocument();
    expect(screen.getByText(/additional simulator assumption/i)).toBeInTheDocument();
    expect(screen.getByText(/four-decimal rounded multipliers/i)).toBeInTheDocument();
    expect(screen.getByText(/subgroup calibration.*is uncertain/i)).toBeInTheDocument();
    expect(screen.getByText(/infrastructure may log IP addresses/i)).toBeInTheDocument();
  });
});
