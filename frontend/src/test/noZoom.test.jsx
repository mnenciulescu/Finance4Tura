import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(resolve(here, "..", p), "utf8");

/**
 * iOS Safari zooms the viewport when a focused form control renders below
 * 16px and never zooms back out, which made editing an expense or income
 * leave the app zoomed in.
 */
describe("no zoom-on-focus in the add/edit forms", () => {
  const css = read("index.css");

  it("forces 16px form controls on mobile", () => {
    const block = css.slice(css.indexOf("@media (max-width: 767px)"));
    expect(block).toContain(".zoom-safe-form input");
    expect(block).toContain(".zoom-safe-form select");
    expect(block).toContain(".zoom-safe-form textarea");
    // must be !important — the pages set font-size inline, which otherwise wins
    expect(block).toMatch(/font-size:\s*16px\s*!important/);
  });

  it("marks both forms as zoom-safe", () => {
    for (const page of ["pages/AddExpense.jsx", "pages/AddIncome.jsx"]) {
      expect(read(page)).toContain('className="zoom-safe-form"');
    }
  });

  it("does not disable pinch zoom in the viewport meta", () => {
    // Suppressing zoom entirely would "fix" this at the cost of accessibility
    const html = readFileSync(resolve(here, "..", "..", "index.html"), "utf8");
    const meta = html.match(/<meta name="viewport"[^>]*>/)[0];
    expect(meta).not.toContain("user-scalable=no");
    expect(meta).not.toContain("maximum-scale");
  });
});
