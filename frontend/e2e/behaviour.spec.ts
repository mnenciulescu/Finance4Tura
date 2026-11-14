import { expect, test, type Page } from "@playwright/test";

/**
 * Behaviour that depends on the platform (proposal §10, §13). Runs on the
 * iPhone (WebKit) and Pixel (Chrome) projects.
 */

const ready = async (page: Page, path: string) => {
  await page.goto(path);
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
};

/** A one-finger horizontal swipe, dispatched as touch events on window. */
async function swipe(page: Page, fromX: number, toX: number, y = 400) {
  await page.evaluate(({ fromX, toX, y }) => {
    const ev = (type: string, x: number) => {
      const e = new Event(type, { bubbles: true, cancelable: true });
      const t = [{ clientX: x, clientY: y, identifier: 1 }];
      Object.defineProperty(e, "touches", { value: type === "touchend" ? [] : t });
      Object.defineProperty(e, "changedTouches", { value: t });
      window.dispatchEvent(e);
    };
    ev("touchstart", fromX);
    ev("touchend", toX);
  }, { fromX, toX, y });
}

test("system back closes the top sheet, then leaves the tab, back to Today", async ({ page }) => {
  await ready(page, "/");
  await page.getByRole("button", { name: "Money", exact: true }).click();
  await expect(page).toHaveURL(/\/money$/);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("menuitem", { name: "New Expense" }).click();
  await expect(page.getByRole("dialog", { name: "New Expense" })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole("dialog", { name: "New Expense" })).toBeHidden();
  await expect(page).toHaveURL(/\/money$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Today", level: 1 }).first()).toBeVisible();
});

test("back on a form with unsaved changes asks before discarding", async ({ page }) => {
  await ready(page, "/money");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("menuitem", { name: "New Expense" }).click();
  const sheet = page.getByRole("dialog", { name: "New Expense" });
  await sheet.getByRole("textbox", { name: "Summary" }).fill("Coffee");

  await page.goBack();
  await expect(page.getByRole("button", { name: "Discard Changes" })).toBeVisible();
  await expect(sheet).toBeVisible();
  await page.getByRole("button", { name: "Discard Changes" }).click();
  await expect(sheet).toBeHidden();
});

test("tab switches replace history: back from Library returns to Today", async ({ page }) => {
  await ready(page, "/");
  await page.getByRole("button", { name: "Money", exact: true }).click();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(page).toHaveURL(/\/library$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
});

test("edge swipe goes back on iPhone only", async ({ page }, info) => {
  await ready(page, "/");
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.waitForTimeout(300);
  await swipe(page, 6, 220);
  if (info.project.name === "iphone") await expect(page).toHaveURL(/\/$/);
  else await expect(page).toHaveURL(/\/settings$/);
});

test("long-press / right-click shows only the app's own menu", async ({ page }) => {
  await ready(page, "/money");
  const row = page.locator('[data-period][aria-hidden="false"] [data-expense]').first();
  await row.click({ button: "right" });
  await expect(page.getByRole("menu", { name: /^Actions for/ })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /Mark as (Completed|Pending)/ })).toBeVisible();
});

test("holdings are masked until the eye is held", async ({ page }) => {
  await ready(page, "/");
  const holdings = page.getByRole("region", { name: "Holdings" });
  await expect(holdings.getByRole("img", { name: "Hidden amount" }).first()).toBeVisible();
  const eye = holdings.getByRole("button", { name: "Hold to reveal amounts" });
  await eye.scrollIntoViewIfNeeded();
  const box = (await eye.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(holdings.getByRole("img", { name: "Hidden amount" })).toHaveCount(0);
  await page.mouse.up();
  await expect(holdings.getByRole("img", { name: "Hidden amount" }).first()).toBeVisible();
});

test("amount slots accept a comma decimal", async ({ page }) => {
  await ready(page, "/money/split");
  const slot = page.getByRole("textbox", { name: "Laptop instalments — installment 3" });
  await slot.fill("12,5");
  await expect(slot).toHaveValue("12,5");
});

for (const width of [360, 393, 430]) {
  for (const theme of ["light", "dark"]) {
    test(`no horizontal overflow at ${width}px (${theme})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 860 });
      for (const path of ["/", "/money", "/money/split", "/money/stats", "/money/invest", "/library", "/hq", "/hq/h1", "/settings", "/admin"]) {
        await page.goto(`${path}?theme=${theme}`);
        await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
        await page.waitForTimeout(150);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
      }
    });
  }
}
