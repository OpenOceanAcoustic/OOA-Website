import { expect, test } from "@playwright/test";

const routes = [
  { name: "ray", path: "/", status: "#simStatus", complete: "SIMULATION COMPLETE" },
  { name: "normal-mode", path: "/normal-mode/", status: "#solveStatus", complete: "COMPLETE" },
  { name: "pe", path: "/pe/", status: "#solveStatus", complete: "COMPLETE" },
] as const;

const viewports = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1280x900", width: 1280, height: 900 },
] as const;

test.skip(process.platform !== "linux", "Exact visual snapshots run only on the pinned Linux Chromium environment");

for (const viewport of viewports) {
  for (const route of routes) {
    test(`${route.name} matches ${viewport.name}`, async ({ page }) => {
      await page.clock.install({ time: new Date("2026-08-31T12:00:00Z") });
      await page.setViewportSize(viewport);
      await page.goto(route.path, { waitUntil: "networkidle" });
      await expect(page.locator(route.status)).toHaveText(route.complete, { timeout: 60_000 });
      await page.evaluate(async () => { await document.fonts.ready; });
      await page.clock.runFor(11_000);
      const pauseTime = await page.evaluate(() => Date.now() + 60_000);
      await page.clock.pauseAt(pauseTime);
      await page.addStyleTag({
        content: "*,*::before,*::after{animation-play-state:paused!important;transition:none!important}",
      });
      const pageSize = await page.evaluate(() => ({
        height: Math.ceil(document.documentElement.scrollHeight),
        width: Math.ceil(document.documentElement.scrollWidth),
      }));
      await page.evaluate((pageName) => {
        const setText = (selector: string, value: string) => {
          const element = document.querySelector<HTMLElement>(selector);
          if (element !== null) element.textContent = value;
        };
        if (pageName === "ray") {
          setText("#simTime", "0.0 ms");
          const eigenStatus = document.querySelector<HTMLElement>("#eigenStatus span");
          if (eigenStatus !== null) eigenStatus.textContent = eigenStatus.textContent?.replace(/\d+(?:\.\d+)? ms$/, "0.0 ms") ?? "";
        } else {
          setText("#computeTime", "0.0 ms");
        }
      }, route.name);
      const screenshot = await page.screenshot({
        animations: "disabled",
        clip: { x: 0, y: 0, width: pageSize.width, height: pageSize.height },
      });
      expect(screenshot).toMatchSnapshot(`${route.name}-${viewport.name}.png`, { maxDiffPixels: 0 });
    });
  }
}
