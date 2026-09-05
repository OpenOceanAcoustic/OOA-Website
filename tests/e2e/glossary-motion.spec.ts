import { expect, test, type Locator } from "@playwright/test";

const glossaryScopes = ["ray-geometry", "transmission-loss", "velocity"] as const;

async function expectPlayStates(terms: Locator, pausedIndex = -1) {
  const count = await terms.count();
  await expect.poll(() => terms.evaluateAll((elements) => elements.map((element) => (
    getComputedStyle(element).animationPlayState
  )))).toEqual(Array.from({ length: count }, (_, index) => index === pausedIndex ? "paused" : "running"));
}

async function expectLiveMotion(terms: Locator, pausedIndex = -1) {
  const animations = await terms.evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element);
    return { name: style.animationName, duration: Number.parseFloat(style.animationDuration) };
  }));
  expect(animations.length).toBeGreaterThan(1);
  for (const animation of animations) {
    expect(animation.name).not.toBe("none");
    expect(animation.duration).toBeGreaterThan(0);
    expect(animation.duration).toBeLessThan(8);
  }

  // Sample real elapsed motion: a declared animation can still be imperceptible or paused.
  const distances = await terms.evaluateAll(async (elements) => {
    const positions = () => elements.map((element) => {
      const transform = new DOMMatrixReadOnly(getComputedStyle(element).transform);
      return { x: transform.m41, y: transform.m42 };
    });
    const before = positions();
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    return positions().map((after, index) => Math.hypot(
      after.x - before[index].x,
      after.y - before[index].y,
    ));
  });
  expect(Math.max(...distances.filter((_, index) => index !== pausedIndex))).toBeGreaterThan(1);
  if (pausedIndex >= 0) expect(distances[pausedIndex]).toBeLessThan(0.1);
}

test.use({ reducedMotion: "no-preference", viewport: { width: 1440, height: 900 } });

for (const scope of glossaryScopes) {
  test(`${scope} keeps floating through heading hover and pointer dialog focus restoration`, async ({ page }) => {
    await page.goto("/");
    const glossary = page.getByTestId(`${scope}-glossary`);
    const terms = page.getByTestId(`${scope}-term-stream`).getByRole("button");
    const trigger = terms.first();
    const dialog = page.getByTestId(`${scope}-glossary-dialog`);

    await glossary.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await expectPlayStates(terms);
    await expectLiveMotion(terms);

    await glossary.getByRole("heading").hover();
    await expectPlayStates(terms);

    // Moving buttons cannot satisfy Playwright's usual stable-position hover check.
    await trigger.hover({ force: true });
    await expectPlayStates(terms, 0);
    await expectLiveMotion(terms, 0);
    await page.mouse.move(0, 0);
    await expectPlayStates(terms);

    await trigger.hover({ force: true });
    await trigger.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await page.mouse.move(0, 0);
    await expect(trigger).toBeFocused();
    await expectPlayStates(terms);
    await expectLiveMotion(terms);
  });

  test(`${scope} pauses only the keyboard-focused term before and after its dialog`, async ({ page }) => {
    await page.goto("/");
    const terms = page.getByTestId(`${scope}-term-stream`).getByRole("button");
    const trigger = terms.nth(1);
    const dialog = page.getByTestId(`${scope}-glossary-dialog`);

    await terms.first().focus();
    await page.mouse.move(0, 0);
    await page.keyboard.press("Tab");
    await expect(trigger).toBeFocused();
    await expectPlayStates(terms, 1);
    await expectLiveMotion(terms, 1);

    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expectPlayStates(terms, 1);
    await expectLiveMotion(terms, 1);

    for (const otherScope of glossaryScopes.filter((candidate) => candidate !== scope)) {
      await expectPlayStates(page.getByTestId(`${otherScope}-term-stream`).getByRole("button"));
    }
  });
}

test("mobile glossaries keep visibly floating without horizontal page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto("/");

  for (const scope of glossaryScopes) {
    const stream = page.getByTestId(`${scope}-term-stream`);
    const terms = stream.getByRole("button");
    await stream.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await expectPlayStates(terms);
    await expectLiveMotion(terms);
    const widths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    }));
    expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
  }
});
