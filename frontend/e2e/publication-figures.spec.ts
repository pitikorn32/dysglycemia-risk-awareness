import { mkdirSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const captureEnabled = process.env.CAPTURE_PUBLICATION_FIGURES === "1";
const outputDirectory = path.resolve(
  process.env.PUBLICATION_FIGURE_DIR ?? "test-results/publication-figures",
);

async function completeSyntheticAssessment(page: Page) {
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
  await page.getByRole("button", { name: "Calculate baseline" }).click();
}

test.skip(!captureEnabled, "Set CAPTURE_PUBLICATION_FIGURES=1 to generate manuscript assets.");
test.use({ deviceScaleFactor: 1, viewport: { width: 1800, height: 720 } });

test("capture synthetic scenario and attribution views", async ({ page }) => {
  mkdirSync(outputDirectory, { recursive: true });
  await completeSyntheticAssessment(page);

  await page.getByRole("button", { name: "Apply alternative 1" }).click();
  const alternativesHeading = page.getByRole("heading", { name: "Ranked exploratory alternatives" });
  const sensitivityHeading = page.getByRole("heading", {
    name: "Evidence sensitivity across 16 assumption sets",
  });
  await alternativesHeading.evaluate((heading) => {
    const top = heading.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo(0, top);
  });
  await expect(sensitivityHeading).toBeVisible();
  await page.screenshot({
    path: path.join(outputDirectory, "platform_scenario_evidence.png"),
  });

  const attributionHeading = page.getByRole("heading", { name: "How example contributions add up" });
  await attributionHeading.scrollIntoViewIfNeeded();
  await expect(attributionHeading).toBeVisible();
  await page.locator(".model-explanation").screenshot({
    path: path.join(outputDirectory, "platform_baseline_attribution.png"),
  });
});
