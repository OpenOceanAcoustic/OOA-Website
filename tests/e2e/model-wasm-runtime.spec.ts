import { expect, test } from "@playwright/test";

for (const model of [
  { name: "Normal Mode", path: "/normal-mode/" },
  { name: "PE", path: "/pe/" },
] as const) {
  test(`${model.name} completes its initial calculation with the local WASM package`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto(model.path);

    await expect(page.locator("#solveStatus")).toHaveText("COMPLETE", { timeout: 30_000 });
    await expect(page.locator("#runtimeBadge")).toHaveText("WASM ACTIVE");
    expect(pageErrors).toEqual([]);
  });
}
