import { expect, test } from "@playwright/test";

test("Ray Mode completes its initial Bellhop2D calculation in the production preview runtime", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");

  await expect(page.locator("#simStatus")).toHaveText("SIMULATION COMPLETE", {
    timeout: 30_000,
  });
  expect(pageErrors).not.toContainEqual(
    expect.stringContaining("FieldRuntime worker count changed during BellhopKernelSession"),
  );
});
