import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('paper, figures and citation work under a Pages project path', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Bounded What-If Simulation');
  await page.getByRole('link', { name: 'Explore the findings' }).click();
  await expect(page).toHaveURL(/#results$/);
  for (const button of await page.locator('[data-panel]').all()) {
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    const image = page.locator('#figure');
    await image.evaluate(el => el.decode());
    expect(await image.evaluate(el => el.currentSrc)).toBe(await page.locator('#full').evaluate(el => el.href));
  }
  const bib = await page.request.get('./assets/bhi.bib');
  expect(bib.ok()).toBeTruthy();
  expect(await bib.text()).toContain('Bhumpat');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  const result = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(result.violations).toEqual([]);
});
