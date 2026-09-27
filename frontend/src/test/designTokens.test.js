/**
 * Design-token contract.
 *
 * The Dusk redesign moved every colour, radius and shadow into `index.css`
 * (CSS variables) or `utils/colors.js` (categorical series colours). These
 * tests fail if a raw value creeps back into a page, which is how the previous
 * theme ended up with nineteen shades of orange and seventeen radii.
 *
 * `utils/colors.js` is the one file allowed to hold hex literals: it is the
 * palette. `pages/Settings.jsx` is allowed too, because the theme picker
 * paints a preview of a theme that is *not* the one currently applied, so it
 * cannot read that theme's variables.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Vitest runs from the frontend package root.
const SRC = join(process.cwd(), "src");

/** Files that legitimately hold raw colour values. */
const PALETTE_FILES = ["utils/colors.js", "pages/Settings.jsx"];

function sourceFiles() {
  const out = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (!/\.jsx?$/.test(name)) continue;
      const rel = relative(SRC, full);
      if (rel.startsWith("test/") || rel.includes(".test.")) continue;
      out.push({ rel, text: readFileSync(full, "utf8") });
    }
  })(SRC);
  return out;
}

const files = sourceFiles();
const themed = files.filter(f => !PALETTE_FILES.includes(f.rel));

/** `file:line  offending text` for every match, so a failure names the site. */
function offenders(list, re) {
  const hits = [];
  for (const { rel, text } of list) {
    text.split("\n").forEach((line, i) => {
      for (const m of line.matchAll(re)) hits.push(`${rel}:${i + 1}  ${m[0]}`);
    });
  }
  return hits;
}

describe("colour tokens", () => {
  it("has no raw hex outside the palette module", () => {
    expect(offenders(themed, /#[0-9a-fA-F]{3,8}\b/g)).toEqual([]);
  });

  it("has no raw rgba() outside the palette module", () => {
    // Tints derive from a palette anchor through alpha(), so a literal rgba()
    // is a colour that no longer tracks the theme.
    expect(offenders(themed, /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+/g)).toEqual([]);
  });

  it("never draws pure white or pure black", () => {
    const all = files.map(f => f.text).join("\n");
    expect(all).not.toMatch(/["'`]#fff(f{3})?["'`]/i);
    expect(all).not.toMatch(/["'`]#000(0{3})?["'`]/i);
  });
});

describe("shape tokens", () => {
  it("uses only the five radius tokens, 50% circles, or the documented 8px checkbox", () => {
    const bad = [];
    for (const { rel, text } of files) {
      text.split("\n").forEach((line, i) => {
        for (const m of line.matchAll(/borderRadius:\s*["'`]([^"'`]+)["'`]/g)) {
          const v = m[1];
          if (v === "50%") continue;
          // ui.jsx's Checkbox: --r-sm on a 22px box renders as a circle, which
          // would read as a radio button. Documented in place.
          if (v === "8px" && rel === "components/ui.jsx") continue;
          // Either a var(--r-*) or the same token read through ui.jsx's T map,
          // e.g. `${T.rXl} ${T.rXl} 0 0` for a sheet's top corners.
          const ok = part => part === "0" || /^var\(--r-/.test(part) || /^\$\{T\.r\w+\}$/.test(part);
          if (v.split(/\s+/).every(ok)) continue;
          bad.push(`${rel}:${i + 1}  ${v}`);
        }
      });
    }
    expect(bad).toEqual([]);
  });

  it("uses only the three elevation tokens", () => {
    const bad = [];
    for (const { rel, text } of files) {
      text.split("\n").forEach((line, i) => {
        for (const m of line.matchAll(/boxShadow:\s*["'`]([^"'`]+)["'`]/g)) {
          if (m[1] === "none" || /^var\(--shadow-/.test(m[1])) continue;
          bad.push(`${rel}:${i + 1}  ${m[1]}`);
        }
      });
    }
    expect(bad).toEqual([]);
  });
});

describe("index.css", () => {
  const css = readFileSync(join(SRC, "index.css"), "utf8");

  it("defines Dusk on :root, so it is the default with no data-theme set", () => {
    const root = css.slice(css.indexOf(":root {"), css.indexOf('[data-theme="light"]'));
    expect(root).toContain("--bg:            #4a4e57");
    expect(root).toContain("--surface:       #2d3343");
    expect(root).toContain("--accent:        #bc9876");
  });

  it("gives every theme the tokens the shared primitives read", () => {
    const blocks = [":root {", '[data-theme="light"] {', '[data-theme="amber"] {'];
    const required = [
      "--bg", "--surface", "--surface-deep", "--surface-2", "--surface-3",
      "--surface-pill", "--accent", "--on-accent", "--on-hero", "--text",
      "--text-muted", "--text-dim", "--border", "--success", "--warning",
      "--danger", "--hero-grad", "--backdrop",
    ];
    for (const [i, start] of blocks.entries()) {
      const from = css.indexOf(start);
      const to = i + 1 < blocks.length ? css.indexOf(blocks[i + 1]) : css.length;
      const body = css.slice(from, to);
      const missing = required.filter(t => !body.includes(`${t}:`));
      expect({ theme: start, missing }).toEqual({ theme: start, missing: [] });
    }
  });

  it("carries a color-scheme per theme so native controls match the surface", () => {
    expect(css).toMatch(/:root \{[\s\S]*?color-scheme: dark;/);
    expect(css).toMatch(/\[data-theme="light"\] \{\s*color-scheme: light;/);
    expect(css).toMatch(/\[data-theme="amber"\] \{\s*color-scheme: light;/);
  });

  it("honours prefers-reduced-motion", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
