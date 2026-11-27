import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const scoredResponse = {
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
      {
        feature_group: "exercise",
        label: "Exercise",
        log_odds_contribution: -0.1,
      },
    ],
  })),
  data_quality: [],
  model_release: {
    release_id: "synthetic-browser-release",
    model_family: "raw ridge logistic regression",
    history_years: 5,
  },
};

async function completeEligibleAssessment(page: Page) {
  await page.goto("/assessment");
  await page.getByLabel("Age").fill("42");
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByLabel("Sugar-sweetened drinks per week (optional)").fill("5");
  await page.getByLabel("Fruit or vegetable times per week (optional)").fill("5");
  await page.getByLabel("Exercise sessions per week (optional)").fill("2");
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByLabel("No", { exact: true }).click();
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByLabel("Current FBS (mg/dL)").fill("95");
  await page.getByLabel("Current BMI (kg/m²)").fill("27");
  await page.getByRole("button", { name: /continue/i }).click();
}

async function expectNoWcagViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}

test("entry and incomplete assessment remain accessible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /start anonymous assessment/i })).toBeDisabled();
  await expectNoWcagViolations(page);

  await page.goto("/assessment");
  await page.getByRole("button", { name: /continue/i }).click();
  await expect(page.getByRole("alert")).toHaveText("Enter an age from 18 to 100.");
  await expect(page.getByLabel("Age")).toHaveAttribute("aria-invalid", "true");
  await expectNoWcagViolations(page);
});

test("eligible profile reaches local scenarios and ranked alternatives", async ({ page }) => {
  let baselineRequests = 0;
  await page.route("**/api/v1/baseline", async (route) => {
    baselineRequests += 1;
    const body = route.request().postDataJSON();
    expect(body.annual_history).toHaveLength(5);
    expect(body.annual_history[4]).toMatchObject({ fbs: 95, bmi: 27 });
    await route.fulfill({ json: scoredResponse });
  });
  await completeEligibleAssessment(page);
  await page.getByRole("button", { name: "Calculate baseline" }).click();

  await expect(page.getByRole("heading", { name: "Your baseline trajectory" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What moved this model estimate" })).toBeVisible();
  await page.getByLabel("BMI reduction (kg/m²)").fill("1");
  await expect(page.getByText("1.0 kg/m² lower")).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Ranked exploratory alternatives" }).getByRole("listitem"),
  ).toHaveCount(5);
  await expect(
    page.getByRole("heading", { name: "Evidence sensitivity across 16 assumption sets" }),
  ).toBeVisible();
  await expect(page.getByText(/6 different candidates ranked first/i)).toBeVisible();
  await expect(
    page
      .getByRole("list", { name: "Ranked exploratory alternatives" })
      .getByRole("listitem")
      .first(),
  ).toContainText("First under 4 of 16");
  await page.getByRole("button", { name: "Apply alternative 1" }).click();
  await expect(page.getByLabel("BMI reduction (kg/m²)")).toHaveValue("2");
  await page.getByRole("button", { name: "Reset scenario" }).click();
  await expect(page.getByLabel("BMI reduction (kg/m²)")).toHaveValue("0");
  await expect(page.getByRole("table", { name: "Exact baseline probabilities" })).toContainText("27%");
  expect(baselineRequests).toBe(1);
  await expectNoWcagViolations(page);
});

test("result layout uses wide viewports and stacks below the desktop breakpoint", async ({ page }) => {
  await page.route("**/api/v1/baseline", async (route) => {
    await route.fulfill({ json: scoredResponse });
  });
  await completeEligibleAssessment(page);
  await page.getByRole("button", { name: "Calculate baseline" }).click();
  await expect(page.getByRole("heading", { name: "Your baseline trajectory" })).toBeVisible();

  for (const width of [1366, 1920, 2048]) {
    await page.setViewportSize({ width, height: 1000 });

    const measurements = await page.evaluate(() => {
      const result = document.querySelector<HTMLElement>(".result-page");
      const layout = document.querySelector<HTMLElement>(".scenario-layout");
      const chart = document.querySelector<HTMLElement>(".scenario-chart-column");
      const content = document.querySelector<HTMLElement>(".scenario-content-column");
      if (!result || !layout || !chart || !content) throw new Error("Result layout is missing");
      const resultBox = result.getBoundingClientRect();
      const chartBox = chart.getBoundingClientRect();
      const contentBox = content.getBoundingClientRect();
      return {
        resultWidth: resultBox.width,
        chartShare: chartBox.width / (chartBox.width + contentBox.width),
        chartPosition: getComputedStyle(chart).position,
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });

    const responsiveGutter = Math.max(48, Math.min(width * 0.06, 128));
    const expectedWidth = Math.min(1760, width - responsiveGutter);
    expect(measurements.resultWidth).toBeGreaterThanOrEqual(expectedWidth - 1);
    expect(measurements.resultWidth).toBeLessThanOrEqual(expectedWidth + 1);
    expect(measurements.chartShare).toBeGreaterThan(0.43);
    expect(measurements.chartShare).toBeLessThan(0.47);
    expect(measurements.chartPosition).toBe("sticky");
    expect(measurements.hasHorizontalOverflow).toBe(false);
  }

  await page.setViewportSize({ width: 899, height: 1000 });
  const stacked = await page.evaluate(() => {
    const chart = document.querySelector<HTMLElement>(".scenario-chart-column");
    const content = document.querySelector<HTMLElement>(".scenario-content-column");
    if (!chart || !content) throw new Error("Scenario columns are missing");
    const chartBox = chart.getBoundingClientRect();
    const contentBox = content.getBoundingClientRect();
    return {
      chartPosition: getComputedStyle(chart).position,
      contentStartsAfterChart: contentBox.top >= chartBox.bottom,
      hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
  expect(stacked.chartPosition).toBe("static");
  expect(stacked.contentStartsAfterChart).toBe(true);
  expect(stacked.hasHorizontalOverflow).toBe(false);
});

test("outside-applicability response never renders a probability", async ({ page }) => {
  await page.route("**/api/v1/baseline", async (route) => {
    await route.fulfill({
      json: {
        status: "outside_applicability",
        reasons: [
          {
            code: "known_fbs_over_100",
            message: "This baseline model applies only before any known fasting blood sugar above 100 mg/dL.",
          },
        ],
      },
    });
  });
  await completeEligibleAssessment(page);
  await page.getByRole("button", { name: "Calculate baseline" }).click();

  await expect(page.getByRole("heading", { name: "No baseline probability is shown" })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await expectNoWcagViolations(page);
});

test("live demo completes the five steps and labels baseline and attribution examples", async ({ page }) => {
  let requests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/v1/baseline")) requests += 1;
  });
  await completeEligibleAssessment(page);
  await page.getByRole("button", { name: "Calculate baseline" }).click();
  await expect(page.getByRole("heading", { name: "Example baseline trajectory" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How example contributions add up" })).toBeVisible();
  await page.getByRole("button", { name: "1 year explanation", exact: true }).click();
  await expect(page.getByRole("table", { name: "One-year model contributions" })).toBeVisible();
  await page.getByRole("button", { name: "Apply alternative 1" }).click();
  await expect(page.getByRole("table", { name: "Baseline and scenario estimates" })).toContainText("11.8%");
  await page.getByRole("button", { name: "Reset scenario" }).click();
  await expect(page.getByLabel("BMI reduction (kg/m²)")).toHaveValue("0");
  expect(requests).toBe(1);
  await page.getByRole("button", { name: "Edit inputs" }).click();
  await expect(page.getByRole("heading", { name: "Review" })).toBeVisible();
});
