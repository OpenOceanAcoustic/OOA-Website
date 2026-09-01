import { expect, test } from "@playwright/test";

const pages = [
  {
    path: "/",
    title: "OOA-RayMode · 声传播交互实验室",
    headings: ["声线，如何一步步 穿过海洋。", "看见声音，理解海洋。", "传播链路实验台", "精确本征声线"],
    canvasCount: 9,
    controlCount: 99,
    page: "ray",
  },
  {
    path: "/normal-mode/",
    title: "OOA Normal Mode · WebAssembly Lab",
    headings: ["拆解波导中的每一个 传播模态。", "模态分解实验台", "模态谱 · 水平波数", "相对完整模态场的差值"],
    canvasCount: 5,
    controlCount: 29,
    page: "normal",
  },
  {
    path: "/pe/",
    title: "OOA PE Method · WebAssembly Lab",
    headings: ["观察 Padé 阶数如何改变前向声场。", "Padé 阶数影响实验台", "相对 nPade=10 的 ΔTL", "阶数—场差收敛曲线"],
    canvasCount: 5,
    controlCount: 27,
    page: "pe",
  },
] as const;

for (const baseline of pages) {
  test(`${baseline.page} route preserves the original document contract`, async ({ page }) => {
    await page.goto(baseline.path);

    await expect(page).toHaveTitle(baseline.title);
    await expect(page.locator(`[data-ooa-page="${baseline.page}"]`)).toHaveCount(1);
    for (const heading of baseline.headings) {
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }
    await expect(page.locator("canvas")).toHaveCount(baseline.canvasCount);
    await expect(page.locator("button, input, select, textarea")).toHaveCount(baseline.controlCount);
  });
}

test("original model controls keep their browser-facing attributes", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#sourceDepth")).toHaveAttribute("min", "20");
  await expect(page.locator("#sourceDepth")).toHaveAttribute("max", "4800");
  await expect(page.locator("#sourceDepth")).toHaveAttribute("step", "10");
  await expect(page.locator("#beamType option")).toHaveCount(5);
  await expect(page.locator("#fieldMode option")).toHaveCount(2);

  await page.goto("/normal-mode/");
  await expect(page.locator("#modeLimit")).toHaveAttribute("min", "1");
  await expect(page.locator("#modeLimit")).toHaveAttribute("max", "100");
  await expect(page.locator("#selectedMode")).toHaveAttribute("value", "1");

  await page.goto("/pe/");
  await expect(page.locator("#nPade")).toHaveAttribute("min", "1");
  await expect(page.locator("#nPade")).toHaveAttribute("max", "10");
  await expect(page.locator("#nPade")).toHaveAttribute("value", "4");
  await expect(page.locator("#inspectRange")).toHaveAttribute("step", "0.5");
});
