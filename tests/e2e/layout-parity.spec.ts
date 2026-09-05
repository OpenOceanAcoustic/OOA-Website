import { expect, test, type Locator } from "@playwright/test";

async function expectAbovePlot(toolbar: Locator, plot: Locator) {
  await expect(toolbar).toBeVisible();
  await expect(plot).toBeVisible();
  const [toolbarBox, plotBox] = await Promise.all([toolbar.boundingBox(), plot.boundingBox()]);
  if (toolbarBox === null || plotBox === null) throw new Error("Heatmap toolbar or plot has no layout box");
  expect(toolbarBox.x).toBeGreaterThanOrEqual(plotBox.x - 1);
  expect(toolbarBox.x + toolbarBox.width).toBeLessThanOrEqual(plotBox.x + plotBox.width + 1);
  expect(toolbarBox.y + toolbarBox.height).toBeLessThanOrEqual(plotBox.y + 1);
}

async function expectDesktopResultGrid(
  controls: Locator,
  results: Locator,
  firstResult: Locator,
  secondResult: Locator,
) {
  await Promise.all([
    expect(controls).toBeVisible(),
    expect(results).toBeVisible(),
    expect(firstResult).toBeVisible(),
    expect(secondResult).toBeVisible(),
  ]);
  const [controlsBox, resultsBox, firstBox, secondBox] = await Promise.all([
    controls.boundingBox(),
    results.boundingBox(),
    firstResult.boundingBox(),
    secondResult.boundingBox(),
  ]);
  if (controlsBox === null || resultsBox === null || firstBox === null || secondBox === null) {
    throw new Error("Model result grid has no desktop layout box");
  }
  expect(controlsBox.x + controlsBox.width).toBeLessThanOrEqual(resultsBox.x + 1);
  expect(Math.abs(firstBox.y - secondBox.y)).toBeLessThanOrEqual(1);
  expect(firstBox.x + firstBox.width).toBeLessThanOrEqual(secondBox.x + 1);
}

async function previewRange(slider: Locator, value: number) {
  await slider.evaluate((element, nextValue) => {
    const input = element as HTMLInputElement;
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

async function commitRange(slider: Locator) {
  await slider.dispatchEvent("pointerup");
}

const pages = [
  {
    path: "/",
    title: "OOA-RayMode · 声传播交互实验室",
    headings: ["声线，如何一步步 穿过海洋。", "看见声音，理解海洋。", "传播链路实验台", "精确本征声线"],
    canvasCount: 9,
    controlCount: 111,
    page: "ray",
  },
  {
    path: "/normal-mode/",
    title: "OOA Normal Mode · WebAssembly Lab",
    headings: ["拆解波导中的每一个 传播模态。", "模态分解实验台", "模态谱 · 水平波数", "相对完整模态场的差值"],
    canvasCount: 8,
    controlCount: 34,
    page: "normal",
  },
  {
    path: "/pe/",
    title: "OOA PE Method · WebAssembly Lab",
    headings: ["观察 Padé 阶数如何改变前向声场。", "Padé 阶数影响实验台", "相对 nPade=10 的 ΔTL", "阶数—场差收敛曲线"],
    canvasCount: 6,
    controlCount: 29,
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

test("Normal Mode result layout owns mode truncation and commits the final slider input", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/normal-mode/");
  await expect(page.locator("#solveStatus")).toHaveText("COMPLETE", { timeout: 30_000 });

  const grid = page.locator(".normal-grid");
  const controls = grid.locator(":scope > .normal-controls");
  const results = grid.locator(":scope > .normal-results-grid");
  await expect(results.locator(":scope > .panel")).toHaveCount(4);
  await expectDesktopResultGrid(
    controls,
    results,
    results.locator(":scope > .spectrum-panel"),
    results.locator(":scope > .mode-detail-panel"),
  );

  const fieldPanel = results.locator(":scope > .field-panel");
  const modeLimit = fieldPanel.locator(".result-parameter-control #modeLimit");
  await expect(modeLimit).toHaveCount(1);
  await expect(controls.locator("#modeLimit")).toHaveCount(0);
  await expect(modeLimit).toHaveAttribute("aria-describedby", "modeLimitEffect");
  await expect(fieldPanel.locator("#modeLimitEffect")).toContainText("参数影响");
  await expect(modeLimit).toBeEnabled();

  const maximum = Number(await modeLimit.getAttribute("max"));
  expect(maximum).toBeGreaterThanOrEqual(3);
  await previewRange(modeLimit, 1);
  await expect(modeLimit).toHaveValue("1");
  await expect(page.locator("#modeLimitOut")).toHaveText(`1 / ${maximum} modes`);
  await expect(page.locator("#solveStatus")).toHaveText("COMPLETE");
  await expect(modeLimit).toBeEnabled();

  await previewRange(modeLimit, 2);
  await expect(modeLimit).toHaveValue("2");
  await expect(page.locator("#modeLimitOut")).toHaveText(`2 / ${maximum} modes`);
  await expect(page.locator("#solveStatus")).toHaveText("COMPLETE");
  await expect(modeLimit).toBeEnabled();
  await commitRange(modeLimit);
  await expect(page.locator("#activeModes")).toHaveText(`2 / ${maximum}`, { timeout: 90_000 });
  await expect(page.locator("#solveStatus")).toHaveText("COMPLETE");
  await expect(modeLimit).toBeEnabled();
});

test("PE result layout owns Padé selection and commits the final slider input", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/pe/");
  await expect(page.locator("#solveStatus")).toHaveText("COMPLETE", { timeout: 30_000 });

  const grid = page.locator(".pe-grid");
  const controls = grid.locator(":scope > .pe-controls");
  const results = grid.locator(":scope > .pe-results-grid");
  await expect(results.locator(":scope > .panel")).toHaveCount(4);
  await expectDesktopResultGrid(
    controls,
    results,
    results.locator(":scope > .pe-field-panel"),
    results.locator(":scope > .pe-delta-panel"),
  );

  const convergencePanel = results.locator(":scope > .convergence-panel");
  const nPade = convergencePanel.locator(".result-parameter-control #nPade");
  await expect(nPade).toHaveCount(1);
  await expect(controls.locator("#nPade")).toHaveCount(0);
  await expect(nPade).toHaveAttribute("aria-describedby", "nPadeEffect");
  await expect(convergencePanel.locator("#nPadeEffect")).toContainText("参数影响");
  await expect(nPade).toBeEnabled();

  await previewRange(nPade, 6);
  await expect(nPade).toHaveValue("6");
  await expect(page.locator("#nPadeOut")).toHaveText("6 / ref 10 terms");
  await expect(page.locator("#padeMetric")).toHaveText("4 / ref 10");
  await expect(page.locator("#solveStatus")).toHaveText("COMPLETE");
  await expect(nPade).toBeEnabled();

  await previewRange(nPade, 7);
  await expect(nPade).toHaveValue("7");
  await expect(page.locator("#nPadeOut")).toHaveText("7 / ref 10 terms");
  await expect(page.locator("#padeMetric")).toHaveText("4 / ref 10");
  await expect(page.locator("#solveStatus")).toHaveText("COMPLETE");
  await expect(nPade).toBeEnabled();
  await commitRange(nPade);
  await expect(page.locator("#padeMetric")).toHaveText("7 / ref 10", { timeout: 90_000 });
  await expect(page.locator("#solveStatus")).toHaveText("COMPLETE");
  await expect(nPade).toBeEnabled();
});

test("Ray Mode heatmap color scales and labels stay above the plotting surfaces", async ({ page }) => {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 360, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const lossToolbar = page.locator(".loss-panel > .loss-colorbar-toolbar");
    const lossPlot = page.locator(".loss-panel > .loss-wrap");
    await expect(lossToolbar.locator(".colorbar")).toHaveCount(1);
    await expect(lossToolbar.locator(".receiver-readout")).toHaveCount(1);
    await expect(lossPlot.locator(".colorbar, .receiver-readout")).toHaveCount(0);
    await expectAbovePlot(lossToolbar, lossPlot);

    const velocityComponents = page.locator(".velocity-component");
    await expect(velocityComponents).toHaveCount(2);
    for (let index = 0; index < 2; index += 1) {
      const component = velocityComponents.nth(index);
      const toolbar = component.locator(":scope > .velocity-component-head");
      const plot = component.locator(":scope > .velocity-wrap");
      await expect(toolbar.locator(".velocity-component-title")).toHaveCount(1);
      await expect(toolbar.locator(".velocity-colorbar")).toHaveCount(1);
      await expect(toolbar.locator(".velocity-readout")).toHaveCount(1);
      await expect(plot.locator(".velocity-component-title, .velocity-colorbar, .velocity-readout")).toHaveCount(0);
      await expectAbovePlot(toolbar, plot);
    }
  }
});

test("Ray Mode trajectory and loss plots stay side by side with aligned bottoms", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#simStatus")).toHaveText("SIMULATION COMPLETE", { timeout: 30_000 });

  for (const width of [1440, 1280, 1151]) {
    await page.setViewportSize({ width, height: 900 });

    const rayPanel = page.locator(".ray-panel");
    const lossPanel = page.locator(".loss-panel");
    const rayPlot = rayPanel.locator(":scope > .main-canvas-wrap");
    const lossPlot = lossPanel.locator(":scope > .main-canvas-wrap");
    const [rayPanelBox, lossPanelBox, rayPlotBox, lossPlotBox] = await Promise.all([
      rayPanel.boundingBox(),
      lossPanel.boundingBox(),
      rayPlot.boundingBox(),
      lossPlot.boundingBox(),
    ]);
    if (rayPanelBox === null || lossPanelBox === null || rayPlotBox === null || lossPlotBox === null) {
      throw new Error(`Ray Mode comparison plots have no layout box at ${width}px`);
    }

    expect(Math.abs(rayPanelBox.y - lossPanelBox.y)).toBeLessThanOrEqual(1);
    expect(rayPanelBox.x + rayPanelBox.width).toBeLessThanOrEqual(lossPanelBox.x + 1);
    expect(Math.abs(rayPlotBox.y + rayPlotBox.height - (lossPlotBox.y + lossPlotBox.height))).toBeLessThanOrEqual(1);
  }
});

test("Ray Mode field plots share zoom and pan state", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#simStatus")).toHaveText("SIMULATION COMPLETE", { timeout: 30_000 });

  const resetIds = [
    "rayZoomReset",
    "lossZoomReset",
    "horizontalVelocityZoomReset",
    "verticalVelocityZoomReset",
  ] as const;
  const zoomResets = resetIds.map((id) => page.locator(`#${id}`));
  const readViews = async () => Promise.all(zoomResets.map(async (reset) => ({
    zoom: await reset.getAttribute("data-zoom"),
    x: await reset.getAttribute("data-view-x"),
    y: await reset.getAttribute("data-view-y"),
  })));
  const expectSharedView = async () => {
    await expect.poll(async () => {
      const views = await readViews();
      const complete = views.every((view) => view.zoom !== null && view.x !== null && view.y !== null);
      return complete && new Set(views.map((view) => JSON.stringify(view))).size === 1;
    }).toBe(true);
  };
  const expectSharedLabel = async (label: string) => {
    for (const reset of zoomResets) await expect(reset).toHaveText(label);
    await expectSharedView();
  };
  const dragCanvas = async (canvas: Locator, startX: number, startY: number, deltaX: number, deltaY: number) => {
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    if (box === null) throw new Error("Field canvas has no layout box");
    const x = box.x + box.width * startX;
    const y = box.y + box.height * startY;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + deltaX, y + deltaY, { steps: 8 });
    await page.mouse.up();
  };

  const rayZoomIn = page.locator("#rayZoomIn");
  const lossZoomReset = page.locator("#lossZoomReset");
  await expectSharedLabel("100%");

  await rayZoomIn.click();
  await expectSharedLabel("125%");

  await page.locator("#horizontalVelocityZoomIn").click();
  await expectSharedLabel("156%");

  const verticalVelocityCanvas = page.locator("#verticalVelocityCanvas");
  await verticalVelocityCanvas.scrollIntoViewIfNeeded();
  const verticalCanvasBox = await verticalVelocityCanvas.boundingBox();
  if (verticalCanvasBox === null) throw new Error("Vertical velocity canvas has no layout box");
  await page.mouse.move(verticalCanvasBox.x + verticalCanvasBox.width * 0.5, verticalCanvasBox.y + verticalCanvasBox.height * 0.5);
  await page.mouse.wheel(0, -120);
  await expectSharedLabel("195%");

  const lossCanvas = page.locator("#lossCanvas");
  await lossCanvas.scrollIntoViewIfNeeded();
  const canvasBox = await lossCanvas.boundingBox();
  if (canvasBox === null) throw new Error("Propagation loss canvas has no layout box");
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.65, canvasBox.y + canvasBox.height * 0.5);
  await expect.poll(async () => page.locator("#tlReadout").innerText()).toMatch(/^-?\d+(?:\.\d+)? dB$/);
  const lossDb = Number.parseFloat((await page.locator("#tlReadout").innerText()).replace(" dB", ""));
  expect(Number.isFinite(lossDb)).toBe(true);

  const beforeLossPan = (await readViews())[0];
  await dragCanvas(lossCanvas, 0.5, 0.5, 44, 32);
  await expect.poll(async () => {
    const current = (await readViews())[0];
    return current.x !== beforeLossPan.x || current.y !== beforeLossPan.y;
  }).toBe(true);
  await expectSharedView();
  expect((await readViews())[0].zoom).toBe(beforeLossPan.zoom);

  const rayCanvas = page.locator("#rayCanvas");
  await rayCanvas.scrollIntoViewIfNeeded();
  const beforeRayPan = (await readViews())[0];
  const sourceDepthBefore = await page.locator("#sourceDepth").inputValue();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await dragCanvas(rayCanvas, 0.7, 0.58, 36, 28);
  await expect.poll(async () => {
    const current = (await readViews())[0];
    return current.x !== beforeRayPan.x || current.y !== beforeRayPan.y;
  }).toBe(true);
  await expectSharedView();
  expect(await page.locator("#sourceDepth").inputValue()).toBe(sourceDepthBefore);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);

  await lossZoomReset.click();
  await expectSharedLabel("100%");
  const resetView = (await readViews())[0];
  expect(resetView).toEqual({ zoom: "1", x: "0.000000", y: "0.000000" });

  await rayCanvas.scrollIntoViewIfNeeded();
  const sourceCanvasBox = await rayCanvas.boundingBox();
  if (sourceCanvasBox === null) throw new Error("Ray canvas has no layout box for source dragging");
  const sourceInput = page.locator("#sourceDepth");
  const sourceDragDepthBefore = Number(await sourceInput.inputValue());
  const maximumDepthM = Number(await sourceInput.getAttribute("max")) + 20;
  const sourceX = sourceCanvasBox.x + 39;
  const sourceY = sourceCanvasBox.y + 19 + (sourceCanvasBox.height - 19 - 28) * sourceDragDepthBefore / maximumDepthM;
  const viewBeforeSourceDrag = (await readViews())[0];
  await page.mouse.move(sourceX, sourceY);
  await page.mouse.down();
  await page.mouse.move(sourceX, sourceY + 30, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => Number(await sourceInput.inputValue())).not.toBe(sourceDragDepthBefore);
  await expectSharedView();
  expect((await readViews())[0]).toEqual(viewBeforeSourceDrag);
  await expect(page.locator("#simStatus")).toHaveText("SIMULATION COMPLETE", { timeout: 90_000 });
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
      const brandLogo = brand.locator("img.brand-logo");
      await expect(brandLogo).toHaveAttribute("src", /\/assets\/dolphin-front-headphones-[^.]+\.png$/);
      await expect(brandLogo).toHaveAttribute("alt", "");
      await expect.poll(() => brandLogo.evaluate((image: HTMLImageElement) => ({
        complete: image.complete,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      }))).toEqual({ complete: true, naturalWidth: 1254, naturalHeight: 1254 });
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
