import { expect, test, type Page } from "@playwright/test";

/**
 * One-Page, the desktop dashboard (Documentation/OnePage_Desktop_Proposal.md
 * §15.2). Runs on the desktop-chrome (1440 × 900) and desktop-webkit
 * (1280 × 800) projects against the stubbed harness.
 */

const open = async (page: Page, query = "") => {
  await page.goto(`/one-page${query}`);
  await expect(page.getByRole("heading", { name: "Budget", level: 2, exact: true })).toBeVisible();
};
const block = (page: Page, id: string) => page.locator(`[data-block="${id}"]`);

test("four columns at 1920 px in the planned order", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page);
  await expect(page.locator("main[data-cols='4']")).toBeVisible();
  const order = async (n: number) => page.getByRole("region", { name: `Column ${n}` }).locator("[data-block]").evaluateAll(els => els.map(el => el.getAttribute("data-block")));
  expect(await order(1)).toEqual(["budget", "budgetStats"]);
  expect(await order(2)).toEqual(["split", "investStats", "invest"]);
  expect(await order(3)).toEqual(["hqStats", "hq"]);
  expect(await order(4)).toEqual(["libraryStats", "library"]);
});

test("three columns, each scrolling under a fixed header", async ({ page }) => {
  await open(page);
  await expect(page.locator("main[data-cols='3']")).toBeVisible();
  const col2 = page.getByRole("region", { name: "Column 2" });
  await col2.evaluate(el => { el.scrollTop = 400; });
  expect(await col2.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByRole("button", { name: "Refresh" })).toBeInViewport();
});

test("drops to two columns, then one with a note", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await open(page);
  await expect(page.locator("main[data-cols='2']")).toBeVisible();
  await page.setViewportSize({ width: 900, height: 800 });
  await expect(page.locator("main[data-cols='1']")).toBeVisible();
  await expect(page.getByRole("note")).toContainText("made for larger screens");
});

for (const width of [1024, 1280, 1440, 1920]) {
  for (const theme of ["light", "dark"]) {
    test(`no horizontal overflow at ${width}px (${theme})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page, `?theme=${theme}`);
      await page.waitForTimeout(200);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
}

test("browser back closes the dialog first; tab switches add no history", async ({ page }) => {
  await open(page);
  const before = await page.evaluate(() => history.length);
  await block(page, "invest").getByRole("tab", { name: "Snapshots" }).click();
  await expect(page).toHaveURL(/inv=snapshots/);
  expect(await page.evaluate(() => history.length)).toBe(before);

  await block(page, "budget").getByRole("button", { name: "Budget actions" }).click();
  await page.getByRole("menuitem", { name: "New Expense" }).click();
  const dialog = page.getByRole("dialog", { name: "New Expense" });
  await expect(dialog).toBeVisible();
  await page.goBack();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/one-page\?inv=snapshots/);
});

test("a dirty form asks before Escape discards it", async ({ page }) => {
  await open(page);
  await block(page, "budget").getByRole("button", { name: "Add Expense" }).first().click();
  const dialog = page.getByRole("dialog", { name: "New Expense" });
  await dialog.getByRole("textbox", { name: "Summary" }).fill("Coffee");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Discard Changes" })).toBeVisible();
  await page.getByRole("button", { name: "Discard Changes" }).click();
  await expect(dialog).toBeHidden();
});

test("hover reveals row actions; delete takes two clicks", async ({ page }) => {
  await open(page);
  const rows = block(page, "budget").locator("[data-expense]");
  await expect(rows.nth(2)).toBeVisible();
  const row = rows.nth(2);
  const name = await row.getAttribute("data-expense");
  const item = block(page, "budget").locator("li", { has: page.locator(`[data-expense="${name}"]`) });
  await row.hover();
  const del = item.getByRole("button", { name: "Delete", exact: true });
  await expect(del).toBeVisible();
  await expect.poll(() => del.evaluate(el => getComputedStyle(el.parentElement!).opacity)).toBe("1");
  await del.click();
  await item.getByRole("button", { name: "Confirm Delete" }).click();
  // Fixture expenses are series members, so the phone's question follows.
  await page.getByRole("button", { name: "Delete This Occurrence" }).click();
  // The stub never really deletes (a refetch brings the row back), so check the result toast.
  await expect(page.getByText("Expense deleted")).toBeVisible();
});

test("right-click shows the app's own menu", async ({ page }) => {
  await open(page);
  await block(page, "budget").locator("[data-expense]").first().click({ button: "right" });
  await expect(page.getByRole("menu", { name: /^Actions for/ })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /Mark as (Completed|Pending)/ })).toBeVisible();
});

test("holdings stay masked until the eye is held (mouse and Space)", async ({ page }) => {
  await open(page);
  const invest = block(page, "invest");
  const hidden = invest.getByRole("img", { name: "Hidden amount" });
  await expect(hidden.first()).toBeVisible();
  const eye = invest.getByRole("button", { name: "Hold to reveal amounts" });
  await eye.scrollIntoViewIfNeeded();
  const box = (await eye.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(hidden).toHaveCount(0);
  await page.mouse.up();
  await expect(hidden.first()).toBeVisible();

  await eye.focus();
  await page.keyboard.down("Space");
  await expect(hidden).toHaveCount(0);
  await page.keyboard.up("Space");
  await expect(hidden.first()).toBeVisible();
});

test("keyboard: N then E opens New Expense; arrows step the budget period", async ({ page }) => {
  await open(page);
  const subtitle = block(page, "budget").getByText(/^Period \d+ of \d+$/);
  const start = await subtitle.textContent();
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("ArrowLeft");
  await expect(subtitle).not.toHaveText(start!);
  await page.keyboard.press("t");
  await expect(subtitle).toHaveText(start!);
  await page.keyboard.press("n");
  await page.keyboard.press("e");
  await expect(page.getByRole("dialog", { name: "New Expense" })).toBeVisible();
});

test("cross-links bring the matching statistics block into view", async ({ page }) => {
  await open(page);
  await block(page, "invest").getByRole("button", { name: "View evolution →" }).click();
  await expect(block(page, "investStats")).toBeInViewport();
  await block(page, "library").getByRole("button", { name: "Chart →" }).click();
  await expect(block(page, "libraryStats")).toBeInViewport();
});
