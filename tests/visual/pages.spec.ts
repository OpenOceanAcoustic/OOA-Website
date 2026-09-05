import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

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
    test(`${route.name} matches ${viewport.name}`, async ({ page }, testInfo) => {
      await page.clock.install({ time: new Date("2026-08-31T12:00:00Z") });
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(route.path, { waitUntil: "networkidle" });
      await expect(page.locator(route.status)).toHaveText(route.complete, { timeout: 60_000 });
      await page.evaluate(async () => { await document.fonts.ready; });
      await page.clock.runFor(11_000);
      const pauseTime = await page.evaluate(() => Date.now() + 60_000);
      await page.clock.pauseAt(pauseTime);
      await page.addStyleTag({
        content: "*,*::before,*::after{animation-play-state:paused!important;transition:none!important}",
      });
      await page.evaluate((pageName) => {
        const freezeText = (selector: string, value: string) => {
          const element = document.querySelector<HTMLElement>(selector);
          if (element === null) return;
          if (element.id !== "") element.id = `${element.id}-visual-snapshot`;
          element.textContent = value;
        };
        if (pageName === "ray") {
          freezeText("#simTime", "0.0 ms");
          const eigenStatusRoot = document.querySelector<HTMLElement>("#eigenStatus");
          const eigenStatus = eigenStatusRoot?.querySelector<HTMLElement>("span") ?? null;
          if (eigenStatusRoot !== null) eigenStatusRoot.id = "eigenStatus-visual-snapshot";
          if (eigenStatus !== null) eigenStatus.textContent = eigenStatus.textContent?.replace(/\d+(?:\.\d+)? ms$/, "0.0 ms") ?? "";
        } else {
          freezeText("#computeTime", "0.0 ms");
        }
      }, route.name);
      const screenshot = await page.screenshot({
        animations: "disabled",
        fullPage: true,
      });
      const snapshotName = `${route.name}-${viewport.name}.png`;
      const expectedPath = testInfo.snapshotPath(snapshotName);
      const update = testInfo.config.updateSnapshots;
      if (update === "all" || update === "changed" || (update === "missing" && !existsSync(expectedPath))) {
        writeFileSync(expectedPath, screenshot);
        return;
      }
      expect(existsSync(expectedPath), `Missing visual baseline ${expectedPath}; run npm run visual:update explicitly`).toBe(true);
      const expected = readFileSync(expectedPath);
      if (!screenshot.equals(expected)) {
        await testInfo.attach(`${snapshotName}-expected`, { body: expected, contentType: "image/png" });
        await testInfo.attach(`${snapshotName}-actual`, { body: screenshot, contentType: "image/png" });
      }
      const digest = (image: Buffer) => createHash("sha256").update(image).digest("hex");
      expect(digest(screenshot), `${snapshotName} must be byte-for-byte identical to its approved full-page baseline`).toBe(digest(expected));
    });
  }
}
