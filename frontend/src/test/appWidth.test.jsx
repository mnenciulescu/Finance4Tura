import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(resolve(here, "..", p), "utf8");

/**
 * The app is mobile-only, so it renders as one centred phone-width column on
 * every viewport. The Dashboard once shipped without a cap of its own and ran
 * the full width of a desktop browser, so the cap lives on the shell — a page
 * cannot opt out of it, and a new page cannot forget it.
 */
describe("phone-width column", () => {
  const css = read("index.css");

  it("defines the width once, on :root", () => {
    expect(css).toMatch(/--app-max-w:\s*\d+px/);
  });

  it("caps and centres the shell rather than each page", () => {
    const block = css.slice(css.indexOf(".app-shell {"));
    expect(block).toMatch(/max-width:\s*var\(--app-max-w\)/);
    expect(block).toMatch(/margin:\s*0 auto/);
  });

  it("puts the class on the layout shell", () => {
    expect(read("components/MobileLayout.jsx")).toContain('className="app-shell"');
  });

  it("leaves no page hardcoding its own pixel width", () => {
    // Pages and sheets must read --app-max-w. Bottom sheets are position:fixed
    // and escape the shell, so they still carry a cap — it just has to be the
    // same one.
    for (const page of [
      "pages/Dashboard.jsx", "pages/HomeOverview.jsx", "pages/Statistics.jsx",
      "pages/Investments.jsx", "pages/SplitPayment.jsx", "pages/BooksAndDev.jsx",
      "pages/Backstage.jsx", "pages/Admin.jsx", "pages/Settings.jsx",
      "pages/AddExpense.jsx", "pages/AddIncome.jsx",
      "pages/Headquarters/styles.js", "components/NavSheet.jsx",
    ]) {
      expect(read(page), `${page} should not hardcode the column width`).not.toContain("430px");
    }
  });
});
