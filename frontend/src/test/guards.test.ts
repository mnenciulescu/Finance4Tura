/**
 * Build guards (proposal §13): design tokens, 16 px controls, one 430 px column
 * (plus One-Page's desktop widths, confined to One-Page).
 * They scan the source, so a stray literal fails the build.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(__dirname, "..");
const walk = (dir: string): string[] => readdirSync(dir).flatMap(f => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const files = walk(SRC).filter(f => !/\.test\.|\/test\//.test(f));
const rel = (f: string) => relative(SRC, f);
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// The only places allowed to hold raw colours.
const COLOUR_FILES = ["theme/themes.css", "theme/themes.ts"];
const code = files.filter(f => /\.(tsx?|jsx?|css)$/.test(f) && !COLOUR_FILES.includes(rel(f)));
const css = files.filter(f => f.endsWith(".css"));

describe("colour tokens", () => {
  it("has no raw hex colours outside the theme files", () => {
    const hits = code.flatMap(f => (strip(readFileSync(f, "utf8")).match(/#[0-9a-fA-F]{3,8}\b(?![-\w])/g) ?? []).map(h => `${rel(f)}: ${h}`))
      // URL fragments and ids are not colours.
      .filter(h => !/#(?:root|main)\b/.test(h));
    expect(hits).toEqual([]);
  });

  it("has no rgb()/rgba()/hsl() outside the theme files", () => {
    const hits = code.flatMap(f => (strip(readFileSync(f, "utf8")).match(/\b(?:rgba?|hsla?)\(/g) ?? []).map(h => `${rel(f)}: ${h}`));
    expect(hits).toEqual([]);
  });

  it("never references --system-* primitives outside the theme", () => {
    const hits = code.flatMap(f => (readFileSync(f, "utf8").match(/--system-[a-z0-9-]+/g) ?? []).map(h => `${rel(f)}: ${h}`));
    expect(hits).toEqual([]);
  });

  it("defines every theme with the semantic tokens components read", () => {
    const themes = readFileSync(join(SRC, "theme/themes.css"), "utf8");
    const blocks = themes.split(/\[data-theme="(?:light|dark)"\]/).slice(1);
    expect(blocks).toHaveLength(2);
    for (const token of ["--bg-grouped", "--bg-grouped-secondary", "--label", "--label-secondary", "--separator", "--tint", "--status-negative", "--series-8", "--shadow-overlay"]) {
      for (const b of blocks) expect(b).toContain(`${token}:`);
    }
  });

  it("sets a color-scheme per theme", () => {
    const themes = readFileSync(join(SRC, "theme/themes.css"), "utf8");
    expect(themes).toMatch(/color-scheme:\s*light/);
    expect(themes).toMatch(/color-scheme:\s*dark/);
  });
});

describe("shape and type tokens in stylesheets", () => {
  const decls = (prop: string) => css.flatMap(f =>
    [...strip(readFileSync(f, "utf8")).matchAll(new RegExp(`(?<![-\\w])${prop}:\\s*([^;]+);`, "g"))].map(m => [rel(f), m[1].trim()] as const));

  it("uses radius tokens only", () => {
    const bad = decls("border-radius").filter(([f, v]) => f !== "theme/tokens.css" && !/^(var\(--radius-[a-z]+\)|0|50%|inherit|calc\(var\(--radius-[a-z]+\) - \d+px\))( var\(--radius-[a-z]+\) 0 0)?$/.test(v) && !/^var\(--radius-[a-z]+\) var\(--radius-[a-z]+\) 0 0$/.test(v));
    // A few miniature previews and chart blocks use 2–6 px radii by design.
    expect(bad.filter(([, v]) => !/^[2-6]px$/.test(v))).toEqual([]);
  });

  it("uses shadow tokens (or token-built hairlines) only", () => {
    // Either an elevation token, or a hairline/ring whose colour is a token.
    const bad = decls("box-shadow").filter(([, v]) =>
      !/^(none|var\(--shadow-[a-z]+\))$/.test(v) && !/ var\(--(separator|tint|tint-soft)\)$/.test(v));
    expect(bad).toEqual([]);
  });

  it("sets font sizes from the type scale", () => {
    const bad = decls("font-size").filter(([f, v]) => f !== "theme/tokens.css" && f !== "theme/base.css" && !/^var\(--fs-[a-z0-9-]+\)$/.test(v));
    expect(bad).toEqual([]);
  });
});

describe("no zoom-on-focus (iOS)", () => {
  it("never lets a form control drop below 16 px", () => {
    const tokens = readFileSync(join(SRC, "theme/tokens.css"), "utf8");
    expect(tokens).toMatch(/--fs-control:\s*max\(16px,\s*1rem\)/);
    const base = readFileSync(join(SRC, "theme/base.css"), "utf8");
    expect(base).toMatch(/input, select, textarea \{\s*font-size: var\(--fs-control\);/);
  });

  it("styles every input in the app with the control size", () => {
    const inputs = css.flatMap(f => [...readFileSync(f, "utf8").matchAll(/\.(input|searchInput|slotInput|inlineInput)\s*\{([^}]*)\}/g)].map(m => [rel(f), m[1], m[2]] as const));
    expect(inputs.length).toBeGreaterThan(3);
    for (const [, , body] of inputs) expect(body).toContain("font-size: var(--fs-control)");
  });

  it("keeps pinch zoom available", () => {
    const html = readFileSync(join(SRC, "../index.html"), "utf8");
    expect(html).not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?!\d)/);
  });
});

describe("phone-width column", () => {
  it("defines the width once", () => {
    const all = files.map(f => readFileSync(f, "utf8")).join("\n");
    expect(all.match(/--app-max-w:\s*430px/g)).toHaveLength(1);
  });

  it("caps the shell, the sheets and the tab bar with the token", () => {
    expect(readFileSync(join(SRC, "app/AppShell.module.css"), "utf8")).toContain("max-width: var(--app-max-w)");
    expect(readFileSync(join(SRC, "ui/Overlays.module.css"), "utf8")).toContain("max-width: var(--app-max-w)");
    expect(readFileSync(join(SRC, "app/TabBar.module.css"), "utf8")).toContain("max-width: var(--app-max-w)");
  });

  it("keeps One-Page's desktop widths to One-Page and its dialogs", () => {
    const all = files.map(f => readFileSync(f, "utf8")).join("\n");
    expect(all.match(/--desk-max-w:\s*1920px/g)).toHaveLength(1);
    const users = css.filter(f => /var\(--desk-(max-w|dialog-w)/.test(readFileSync(f, "utf8"))).map(rel).sort();
    expect(users).toEqual(["features/one-page/OnePage.module.css", "ui/Desk.module.css"]);
  });

  it("has no screen hard-coding a pixel max-width", () => {
    const bad = css.flatMap(f => [...readFileSync(f, "utf8").matchAll(/max-width:\s*(\d{3,}px)/g)].map(m => `${rel(f)}: ${m[1]}`));
    expect(bad.filter(b => !b.startsWith("features/auth/"))).toEqual([]);
  });
});
