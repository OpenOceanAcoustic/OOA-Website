import { expect, test } from "@playwright/test";

test("demonstration results require the explicit demo query", async ({ page }) => {
  const workers: string[] = [];
  page.on("request", (request) => {
    if (/\.(?:worker-.*\.js|wasm)(?:\?|$)/.test(request.url())) workers.push(request.url());
  });

  await page.goto("/?demo");
  await expect(page.locator("#simStatus")).toHaveText("SIMULATION COMPLETE", { timeout: 30_000 });

  await page.goto("/normal-mode/?demo");
  await expect(page.locator("#solveStatus")).toHaveText("COMPLETE", { timeout: 30_000 });
  await expect(page.locator("#resultSource")).toHaveText("DEMO");

  await page.goto("/pe/?demo");
  await expect(page.locator("#solveStatus")).toHaveText("COMPLETE", { timeout: 30_000 });
  await expect(page.locator("#resultSource")).toHaveText("DEMO");

  expect(workers).toEqual([]);
});
