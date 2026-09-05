import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const fixture = (name: string) => resolve(import.meta.dirname, "../fixtures", name);

test("Ray Mode imports a Bellhop ENV with SSP and BTY companions", async ({ page }) => {
  const stem = "Pos1_SD200_100.0Hz_0IB";
  await page.goto("/");
  await expect(page.locator("#simStatus")).toHaveText("SIMULATION COMPLETE", { timeout: 30_000 });
  await page.locator("#envFileInput").setInputFiles([
    fixture(`${stem}.env`),
    fixture(`${stem}.ssp`),
    fixture(`${stem}.bty`),
  ]);
  await expect(page.locator("#envImportStatus")).toHaveClass(/success/, { timeout: 15_000 });
  await expect(page.locator("#envImportStatus")).toContainText("已导入");
  await expect(page.locator("#envImportStatus")).toContainText("2D SSP");
  await expect(page.locator("#simStatus")).toHaveText("SIMULATION COMPLETE", { timeout: 30_000 });
});

test("Normal Mode imports a same-stem Kraken ENV and FLP", async ({ page }) => {
  await page.goto("/normal-mode/");
  await expect(page.locator("#solveStatus")).toHaveText("COMPLETE", { timeout: 30_000 });
  await page.locator("#environmentFileInput").setInputFiles([
    fixture("MunkK.env"),
    fixture("MunkK.flp"),
  ]);
  await expect(page.locator("#environmentImportStatus")).toHaveClass(/success/, { timeout: 15_000 });
  await expect(page.locator("#environmentImportStatus")).toContainText("已导入");
  await expect(page.locator("#environmentImportStatus")).toContainText("原生 Kraken 解析");
  await expect(page.locator("#environmentImportStatus")).toContainText("FLP 网格");
  await expect(page.locator("#solveStatus")).toHaveText("COMPLETE", { timeout: 30_000 });
});

test("PE imports a RAM .in file", async ({ page }) => {
  await page.goto("/pe/");
  await expect(page.locator("#solveStatus")).toHaveText("COMPLETE", { timeout: 30_000 });
  await page.locator("#environmentFileInput").setInputFiles(fixture("ram.in"));
  await expect(page.locator("#environmentImportStatus")).toHaveClass(/success/, { timeout: 15_000 });
  await expect(page.locator("#environmentImportStatus")).toContainText("已导入");
  await expect(page.locator("#environmentImportStatus")).toContainText("2 个介质段");
  await expect(page.locator("#solveStatus")).toHaveText("COMPLETE", { timeout: 30_000 });
});

for (const model of [
  { name: "Ray Mode", route: "/", input: "#envFileInput", status: "#envImportStatus", solve: "#simStatus", complete: "SIMULATION COMPLETE" },
  { name: "Normal Mode", route: "/normal-mode/", input: "#environmentFileInput", status: "#environmentImportStatus", solve: "#solveStatus", complete: "COMPLETE" },
  { name: "PE", route: "/pe/", input: "#environmentFileInput", status: "#environmentImportStatus", solve: "#solveStatus", complete: "COMPLETE" },
] as const) {
  test(`${model.name} imports the unified environment JSON without exposing native text to the page`, async ({ page }) => {
    await page.goto(model.route);
    await expect(page.locator(model.solve)).toHaveText(model.complete, { timeout: 30_000 });
    await page.locator(model.input).setInputFiles(fixture("Pekeris.environment.json"));
    await expect(page.locator(model.status)).toHaveClass(/success/, { timeout: 15_000 });
    await expect(page.locator(model.status)).toContainText("已导入");
    await expect(page.locator(model.solve)).toHaveText(model.complete, { timeout: 30_000 });
  });
}

for (const bare of [false, true]) {
  test(`Ray Mode preserves shallow sources with ${bare ? "bare" : "quoted"} ENV options`, async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#simStatus")).toHaveText("SIMULATION COMPLETE", { timeout: 30_000 });
    const option = (value: string) => bare ? value : `'${value}'`;
    const env = [
      "'Shallow source regression'", "100", "1", option("CVWT"),
      "0 0 200", "0 1500 /", "200 1500 /", `${option("A")} 0`,
      "200 1700 0 1.8 0.5 /", "1", "5.5 /", "21", "1 199 /", "21", "0.1 2 /",
      option("IB"), "100", "-20 20 /", "0 201 2",
    ].join("\n");
    await page.locator("#envFileInput").setInputFiles({ name: "shallow.env", mimeType: "text/plain", buffer: Buffer.from(env) });
    await expect(page.locator("#envImportStatus")).toHaveClass(/success/, { timeout: 15_000 });
    await expect(page.locator("#sourceDepth")).toHaveValue("5.5");
    await expect(page.locator("#eigenSourceDepth")).toHaveValue("5.5");
    await expect(page.locator("#simStatus")).toHaveText("SIMULATION COMPLETE", { timeout: 30_000 });
    await page.locator("#sourceDepth").fill("2.5");
    await page.locator("#sourceDepth").press("Tab");
    await expect(page.locator("#eigenSourceDepth")).toHaveValue("2.5");
    await expect(page.locator("#simStatus")).toHaveText("SIMULATION COMPLETE", { timeout: 30_000 });
    await expect(page.locator("#sourceDepth")).toHaveValue("2.5");
  });
}
