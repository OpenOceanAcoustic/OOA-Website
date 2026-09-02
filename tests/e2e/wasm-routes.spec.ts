import { expect, test } from "@playwright/test";

const routes = [
  { path: "/", page: "ray", heading: "声线，如何一步步 穿过海洋。", status: "#simStatus", complete: "SIMULATION COMPLETE" },
  { path: "/normal-mode/", page: "normal", heading: "拆解波导中的每一个 传播模态。", status: "#solveStatus", complete: "COMPLETE" },
  { path: "/pe/", page: "pe", heading: "观察 Padé 阶数如何改变前向声场。", status: "#solveStatus", complete: "COMPLETE" },
] as const;

for (const route of routes) {
  test(`${route.page} route loads its real WebAssembly worker`, async ({ page }) => {
    const browserErrors: string[] = [];
    const externalRequests: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("request", (request) => {
      const url = new URL(request.url());
      if ((url.protocol === "http:" || url.protocol === "https:") && url.origin !== "http://127.0.0.1:4174") {
        externalRequests.push(request.url());
      }
    });

    await page.goto(route.path);
    await expect(page.getByRole("heading", { name: route.heading, exact: true })).toBeVisible();
    await expect(page.locator(route.status)).toHaveText(route.complete, { timeout: 45_000 });
    await expect(page.locator(`[data-ooa-page="${route.page}"]`)).toHaveCount(1);
    expect(browserErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
}

test("original navigation selects exactly one model document at a time", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#simStatus")).toHaveText("SIMULATION COMPLETE", { timeout: 45_000 });

  await page.getByRole("link", { name: "Normal Mode", exact: true }).click();
  await expect(page.locator('[data-ooa-page="normal"]')).toHaveCount(1);
  await expect(page.locator("#solveStatus")).toHaveText("COMPLETE", { timeout: 45_000 });

  await page.getByRole("link", { name: "PE", exact: true }).click();
  await expect(page.locator('[data-ooa-page="pe"]')).toHaveCount(1);
  await expect(page.locator("#solveStatus")).toHaveText("COMPLETE", { timeout: 45_000 });
  await expect(page.locator('[data-ooa-page="ray"], [data-ooa-page="normal"]')).toHaveCount(0);
});
