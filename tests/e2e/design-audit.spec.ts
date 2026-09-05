import { expect, test } from "@playwright/test";

for (const route of ["/", "/normal-mode/", "/pe/"]) {
  test(`${route} remains readable without page overflow at audit viewports`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('[data-ooa-page]')).toBeVisible();
    // 640 CSS px also exercises the reflow of a 1280 px display at 200% zoom.
    for (const width of [1280, 1440, 1920, 390, 640]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const label = page.locator('.environment-import-bar p, .env-import small').first();
      expect(await label.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(13);
      const controls = page.locator('.workspace-controls');
      await controls.locator(':scope > summary').click();
      await expect(controls).not.toHaveAttribute('open');
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await controls.locator(':scope > summary').click();
      await expect(controls).toHaveAttribute('open');
    }
    await page.getByRole('link', { name: '进入实验台 ↓' }).click();
    await expect(page.locator('.workspace-controls > summary')).toBeInViewport();
  });
}

test('PE compares TL and delta at one selected range with collapsible parameters', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/pe/');
  await expect(page.locator('#solveStatus')).toHaveText('COMPLETE', { timeout: 30000 });
  await page.locator('.workspace-controls > summary').click();
  const slider = page.locator('#inspectRange');
  await slider.fill('10');
  await expect(page.locator('#profileTitle')).toContainText('10.0 km');
  await page.getByRole('button', { name: '当前 TL', exact: true }).click();
  await expect(page.locator('.pe-field-panel')).toBeVisible();
  await expect(page.locator('.pe-delta-panel')).toBeHidden();
  await page.getByRole('button', { name: '误差 ΔTL', exact: true }).click();
  await expect(page.locator('.pe-field-panel')).toBeHidden();
  await expect(page.locator('.pe-delta-panel')).toBeVisible();
  await expect(page.locator('#inspectRange')).toHaveValue('10');
  await page.getByRole('button', { name: '双图对照', exact: true }).click();
  await expect(page.locator('.pe-field-panel')).toBeVisible();
  await expect(page.locator('.pe-delta-panel')).toBeVisible();
  await expect(page.locator('.field-scale .scale-ticks span')).toHaveCount(10);
});
