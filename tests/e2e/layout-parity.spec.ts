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

const headerRoutes = [
  { path: "/", activeLabel: "Ray Mode" },
  { path: "/normal-mode/", activeLabel: "Normal Mode" },
  { path: "/pe/", activeLabel: "PE" },
] as const;

const headerViewports = [
  { width: 1280, height: 900, compact: false },
  { width: 720, height: 900, compact: true },
] as const;

test("all model routes share the Ray Mode header contract", async ({ page }) => {
  for (const viewport of headerViewports) {
    await page.setViewportSize(viewport);
    let raySignature: unknown;

    for (const route of headerRoutes) {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });

      const header = page.getByRole("banner");
      const brand = header.getByRole("link", { name: "OpenOceanAcousticLab 首页", exact: true });
      const navigation = header.locator('nav[aria-label="主导航"]');
      const links = navigation.locator("a");
      const status = header.locator(".status");

      await expect(header).toHaveClass("topbar");
      await expect(brand.locator("strong")).toHaveText("OpenOceanAcousticLab");
      await expect(brand.locator("small")).toHaveText("ACOUSTIC PROPAGATION LAB");
      await expect(links).toHaveText(["Ray Mode", "Normal Mode", "PE"]);
      await expect(links.nth(0)).toHaveAttribute("href", "/");
      await expect(links.nth(1)).toHaveAttribute("href", "/normal-mode/");
      await expect(links.nth(2)).toHaveAttribute("href", "/pe/");
      await expect(navigation.locator('[aria-current="page"]')).toHaveText(route.activeLabel);
      await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
      await expect(status).toContainText("OOA LAB");
      await expect(status).toContainText("READY");

      if (viewport.compact) {
        await expect(navigation).toBeHidden();
        await expect(status).toBeHidden();
      } else {
        await expect(navigation).toBeVisible();
        await expect(status).toBeVisible();
      }

      const signature = await header.evaluate((element) => {
        const headerRect = element.getBoundingClientRect();
        const round = (value: number) => Math.round(value * 100) / 100;
        const required = (selector: string) => {
          const match = element.querySelector<HTMLElement>(selector);
          if (match === null) throw new Error(`Missing header element: ${selector}`);
          return match;
        };
        const box = (target: HTMLElement) => {
          const rect = target.getBoundingClientRect();
          return {
            x: round(rect.left - headerRect.left),
            y: round(rect.top - headerRect.top),
            width: round(rect.width),
            height: round(rect.height),
          };
        };
        const navigationElement = required(".mode-nav");
        const statusElement = required(".status");
        const brandTitleElement = required(".brand strong");
        const brandTitleStyle = getComputedStyle(brandTitleElement);
        const headerStyle = getComputedStyle(element);
        const navigationStyle = getComputedStyle(navigationElement);
        const statusStyle = getComputedStyle(statusElement);

        return {
          header: {
            width: round(headerRect.width),
            height: round(headerRect.height),
            paddingLeft: headerStyle.paddingLeft,
            paddingRight: headerStyle.paddingRight,
            borderBottomWidth: headerStyle.borderBottomWidth,
            position: headerStyle.position,
          },
          brand: {
            ...box(required(".brand")),
            title: {
              fontFamily: brandTitleStyle.fontFamily,
              fontSize: brandTitleStyle.fontSize,
              fontWeight: brandTitleStyle.fontWeight,
              letterSpacing: brandTitleStyle.letterSpacing,
            },
          },
          navigation: {
            ...box(navigationElement),
            display: navigationStyle.display,
            gap: navigationStyle.gap,
          },
          status: {
            ...box(statusElement),
            display: statusStyle.display,
          },
        };
      });

      if (raySignature === undefined) raySignature = signature;
      else expect(signature).toEqual(raySignature);
    }
  }
});
