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
  const ids = (scope: ReturnType<Page["locator"]>) => scope.locator("[data-block]").evaluateAll(els => els.map(el => el.getAttribute("data-block")));
  const wide = page.getByRole("region", { name: "Columns 2–3" });
  expect(await ids(page.getByRole("region", { name: "Column 1" }))).toEqual(["budget", "budgetStats"]);
  expect(await ids(wide)).toEqual(["portfolioV2", "hqStats", "hq"]);
  expect(await ids(wide.locator("[data-subcol='1']"))).toEqual(["hqStats"]);
  expect(await ids(wide.locator("[data-subcol='2']"))).toEqual(["hq"]);
  await expect(page.locator("[data-block='invest'], [data-block='investStats']")).toHaveCount(0);
  expect(await ids(page.getByRole("region", { name: "Column 4" }))).toEqual(["split", "libraryStats", "library"]);
  // Portfolio v2 is about twice as wide as a single column.
  const pv2 = await block(page, "portfolioV2").boundingBox();
  const budget = await block(page, "budget").boundingBox();
  expect(pv2!.width).toBeGreaterThan(budget!.width * 1.6);
});

test("four columns at 1440 px, each scrolling under a fixed header", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await expect(page.locator("main[data-cols='4']")).toBeVisible();
  const col2 = page.getByRole("region", { name: "Columns 2–3" });
  await col2.evaluate(el => { el.scrollTop = 400; });
  expect(await col2.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByRole("button", { name: "Refresh" })).toBeInViewport();
});

test("drops to three columns, then one with a note", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await open(page);
  await expect(page.locator("main[data-cols='3']")).toBeVisible();
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
  await block(page, "split").getByRole("tab", { name: /^Settled/ }).click();
  await expect(page).toHaveURL(/split=settled/);
  expect(await page.evaluate(() => history.length)).toBe(before);

  await block(page, "budget").getByRole("button", { name: "Budget actions" }).click();
  await page.getByRole("menuitem", { name: "New Expense" }).click();
  const dialog = page.getByRole("dialog", { name: "New Expense" });
  await expect(dialog).toBeVisible();
  await page.goBack();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/one-page\?split=settled/);
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

test("the holdings eye is a flag: click shows, click again hides (mouse and Space)", async ({ page }) => {
  await open(page);
  const invest = block(page, "portfolioV2");
  const hidden = invest.getByRole("img", { name: "Hidden amount" });
  await expect(hidden.first()).toBeVisible();
  await invest.getByRole("button", { name: "Show amounts" }).click();
  await expect(hidden).toHaveCount(0);
  await page.mouse.move(5, 5);
  await expect(hidden).toHaveCount(0);
  await invest.getByRole("button", { name: "Hide amounts" }).click();
  await expect(hidden.first()).toBeVisible();

  await invest.getByRole("button", { name: "Show amounts" }).focus();
  await page.keyboard.press("Space");
  await expect(hidden).toHaveCount(0);
  await page.keyboard.press("Space");
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
  await block(page, "library").getByRole("button", { name: "Chart →" }).click();
  await expect(block(page, "libraryStats")).toBeInViewport();
});

test("Portfolio v2: masked values, range switch, platform expand", async ({ page }) => {
  await open(page);
  const pv2 = block(page, "portfolioV2");
  await pv2.scrollIntoViewIfNeeded();
  await expect(pv2.getByLabel("Portfolio v2 total").getByRole("img", { name: "Hidden amount" })).toBeVisible();
  await pv2.getByRole("button", { name: "Show amounts" }).click();
  await expect(pv2.getByLabel("Portfolio v2 total").getByRole("img", { name: "Hidden amount" })).toHaveCount(0);
  await pv2.getByRole("radio", { name: "1Y" }).click();
  await expect(page).toHaveURL(/pv2range=1y/);
  await pv2.getByRole("group", { name: "Chart lines" }).getByRole("button", { name: "Alpha Broker" }).click();
  await expect(page).toHaveURL(/pv2lines=Total%2CAlpha(\+|%20)Broker/);
  await pv2.getByRole("region", { name: "Last snapshot" }).getByRole("button", { name: /^Alpha Broker/ }).click();
  await expect(pv2.getByRole("list", { name: "Alpha Broker assets" })).toContainText("Example World ETF");
  // Operations sit beside the last snapshot, on the same row.
  const last = await pv2.getByRole("region", { name: "Last snapshot" }).boundingBox();
  const ops = pv2.getByRole("region", { name: "Operations" });
  await expect(ops.locator("[data-operation]").first()).toBeVisible();
  const opsBox = await ops.boundingBox();
  expect(opsBox!.x).toBeGreaterThan(last!.x + last!.width - 1);
  expect(Math.abs(opsBox!.y - last!.y)).toBeLessThan(4);
});

test("Portfolio v2: generate a snapshot and follow each asset's status", async ({ page }) => {
  await open(page);
  const pv2 = block(page, "portfolioV2");
  await pv2.scrollIntoViewIfNeeded();
  await pv2.getByRole("button", { name: "Generate Snapshot" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Generate Snapshot" }).click();
  const dialog = page.getByRole("dialog", { name: /Generating snapshot|Snapshot run/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-status="failed"]')).toContainText("AI rate limit reached", { timeout: 15000 });
  await expect(dialog.locator('[data-status="updated"]').first()).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Retry 1 Failed/ })).toBeVisible({ timeout: 15000 });
});

test("account menu items open their screens (the menu's history entry does not undo them)", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(/\/settings$/);

  await open(page);
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitem", { name: "Open Mobile Layout" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("main[data-cols]")).toHaveCount(0);
});
