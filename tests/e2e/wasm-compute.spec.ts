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

test("new model requests replace in-flight browser calculations", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#simStatus")).toHaveText("SIMULATION COMPLETE", { timeout: 30_000 });
  await page.evaluate(() => {
    const fieldMode = document.querySelector<HTMLSelectElement>("#fieldMode");
    const beamType = document.querySelector<HTMLSelectElement>("#beamType");
    if (!fieldMode || !beamType) throw new Error("Ray Mode controls are missing");
    fieldMode.value = "COHERENT_TL";
    fieldMode.dispatchEvent(new Event("change", { bubbles: true }));
    beamType.value = "GAUSSIAN_SIMPLE";
    beamType.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator("#simStatus")).toHaveText("SIMULATION COMPLETE", { timeout: 90_000 });

  await page.goto("/normal-mode/");
  await expect(page.locator("#solveStatus")).toHaveText("COMPLETE", { timeout: 30_000 });
  await page.evaluate(() => {
    const frequency = document.querySelector<HTMLInputElement>("#frequency");
    const range = document.querySelector<HTMLInputElement>("#maximumRange");
    if (!frequency || !range) throw new Error("Normal Mode controls are missing");
    frequency.value = "110";
    frequency.dispatchEvent(new Event("change", { bubbles: true }));
    range.value = "3";
    range.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator("#solveStatus")).toHaveText("COMPLETE", { timeout: 90_000 });
  await expect(page.locator("#runtimeBadge")).toHaveText("WASM ACTIVE");

  await page.goto("/pe/");
  await expect(page.locator("#solveStatus")).toHaveText("COMPLETE", { timeout: 30_000 });
  await page.evaluate(() => {
    const range = document.querySelector<HTMLInputElement>("#maximumRange");
    const step = document.querySelector<HTMLInputElement>("#rangeStep");
    if (!range || !step) throw new Error("PE controls are missing");
    range.value = "3";
    range.dispatchEvent(new Event("change", { bubbles: true }));
    step.value = "100";
    step.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator("#solveStatus")).toHaveText("COMPLETE", { timeout: 90_000 });
  await expect(page.locator("#runtimeBadge")).toHaveText("WASM ACTIVE");
});
