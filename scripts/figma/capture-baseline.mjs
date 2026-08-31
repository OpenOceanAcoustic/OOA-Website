import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = process.env.OOA_FIGMA_BASE_URL ?? "http://127.0.0.1:4174";
const outputDirectory = resolve("docs/figma/baseline");
const routes = [
  { name: "ray", path: "/", status: "#simStatus", complete: "SIMULATION COMPLETE" },
  { name: "normal-mode", path: "/normal-mode/", status: "#solveStatus", complete: "COMPLETE" },
  { name: "pe", path: "/pe/", status: "#solveStatus", complete: "COMPLETE" },
];
const viewports = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1280x900", width: 1280, height: 900 },
];

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    for (const route of routes) {
      await page.goto(new URL(route.path, baseUrl).href, { waitUntil: "networkidle" });
      await page.locator(route.status).filter({ hasText: route.complete }).waitFor({ timeout: 60_000 });
      await page.addStyleTag({
        content: "*,*::before,*::after{animation-play-state:paused!important;transition:none!important}",
      });
      await page.waitForTimeout(250);
      await page.screenshot({
        path: resolve(outputDirectory, `${route.name}-${viewport.name}.png`),
        fullPage: true,
        animations: "disabled",
      });
    }
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(`Figma baseline captured in ${outputDirectory}`);
