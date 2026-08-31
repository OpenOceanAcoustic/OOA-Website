import { expect, test } from "@playwright/test";

test("Bellhop2D reruns the original field, velocity and ray workflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#simStatus")).toHaveText("SIMULATION COMPLETE", { timeout: 30_000 });

  await page.locator("#sourceDepth").fill("1200");
  await page.locator("#beamType").selectOption("GAUSSIAN_SIMPLE");
  await page.locator("#fieldMode").selectOption("INCOHERENT_TL");
  await page.locator("#runButton").click();

  await expect(page.locator("#simStatus")).toHaveText("SIMULATION COMPLETE", { timeout: 90_000 });
  await expect(page.locator("#horizontalVelocityCanvas")).toBeVisible();
  await expect(page.locator("#verticalVelocityCanvas")).toBeVisible();
});

test("Kraken reruns full and truncated fields and exposes the original inspectors", async ({ page }) => {
  await page.goto("/normal-mode/");
  await expect(page.locator("#solveStatus")).toHaveText("COMPLETE", { timeout: 30_000 });

  await page.locator("#maximumRange").fill("2");
  await page.locator("#modeLimit").fill("5");
  await page.locator("#runNormal").click();

  await expect(page.locator("#solveStatus")).toHaveText("COMPLETE", { timeout: 90_000 });
  await page.locator('[data-field-view="single"]').click();
  await expect(page.locator("#spectrumCanvas")).toBeVisible();
  await expect(page.locator("#fieldCanvas")).toBeVisible();
  await expect(page.locator("#deltaCanvas")).toBeVisible();
});

test("RAM reruns the original nPade sweep and comparison workflow", async ({ page }) => {
  await page.goto("/pe/");
  await expect(page.locator("#solveStatus")).toHaveText("COMPLETE", { timeout: 30_000 });

  await page.locator("#maximumRange").fill("2");
  await page.locator("#rangeStep").fill("100");
  await page.locator("#depthStep").fill("20");
  await page.locator("#nPade").fill("10");
  await page.locator("#runPE").click();

  await expect(page.locator("#solveStatus")).toHaveText("COMPLETE", { timeout: 90_000 });
  await expect(page.locator("#fieldCanvas")).toBeVisible();
  await expect(page.locator("#deltaCanvas")).toBeVisible();
  await expect(page.locator("#convergenceCanvas")).toBeVisible();
});
