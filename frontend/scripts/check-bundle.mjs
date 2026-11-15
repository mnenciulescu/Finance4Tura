// Bundle budget (proposal §12.6): the JavaScript needed before the first
// screen renders — the entry chunk plus everything it imports statically —
// must stay under BUDGET_KB gzipped. Lazy chunks (other screens, charts, the
// calendar, motion features) are not counted.
//
// One-Page has its own budget for what it adds (ONE_PAGE_BUDGET_KB).
//
//   node scripts/check-bundle.mjs        (after `npm run build`)

import { readFileSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const BUDGET_KB = Number(process.env.BUNDLE_BUDGET_KB ?? 200);
const dist = new URL("../dist/", import.meta.url).pathname;
const html = readFileSync(join(dist, "index.html"), "utf8");
const entry = html.match(/<script type="module" crossorigin src="\/([^"]+)"/)?.[1];
if (!entry) { console.error("No entry script in dist/index.html"); process.exit(1); }

/** A chunk plus everything it imports statically. */
function closure(start) {
  const seen = new Set();
  const queue = [start];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const src = readFileSync(join(dist, file), "utf8");
    // Static imports only: `import ... from "./x.js"` and bare `import "./x.js"`.
    for (const m of src.matchAll(/(?:^|[;}\n])\s*import\s*(?:[^"'()]*?from\s*)?["'](\.{1,2}\/[^"']+\.js)["']/g)) {
      const resolved = join(file, "..", m[1]).replace(/^\/+/, "");
      queue.push(resolved);
    }
  }
  return seen;
}
const seen = closure(entry);

let total = 0;
const rows = [...seen].map(f => {
  const gz = gzipSync(readFileSync(join(dist, f))).length;
  total += gz;
  return [f, gz];
}).sort((a, b) => b[1] - a[1]);

for (const [f, gz] of rows) console.log(`${(gz / 1024).toFixed(1).padStart(7)} KB  ${f}`);
const css = readdirSync(join(dist, "assets")).filter(f => f.startsWith("index-") && f.endsWith(".css"));
const cssGz = css.reduce((s, f) => s + gzipSync(readFileSync(join(dist, "assets", f))).length, 0);
console.log(`${(total / 1024).toFixed(1).padStart(7)} KB  initial JavaScript (gzip), budget ${BUDGET_KB} KB`);
console.log(`${(cssGz / 1024).toFixed(1).padStart(7)} KB  initial CSS (gzip)`);

// One-Page (desktop): what /one-page downloads on top of the entry. Charts
// stay lazy per Statistics tab and are not counted.
const ONE_PAGE_BUDGET_KB = Number(process.env.ONE_PAGE_BUDGET_KB ?? 150);
const onePage = readdirSync(join(dist, "assets")).find(f => /^OnePage-.*\.js$/.test(f));
let onePageKb = 0;
if (onePage) {
  const extra = [...closure(`assets/${onePage}`)].filter(f => !seen.has(f));
  onePageKb = extra.reduce((s, f) => s + gzipSync(readFileSync(join(dist, f))).length, 0) / 1024;
  console.log(`${onePageKb.toFixed(1).padStart(7)} KB  One-Page on top of the entry (gzip), budget ${ONE_PAGE_BUDGET_KB} KB`);
}

if (total / 1024 > BUDGET_KB) {
  console.error(`Bundle budget exceeded by ${(total / 1024 - BUDGET_KB).toFixed(1)} KB`);
  process.exit(1);
}
if (onePageKb > ONE_PAGE_BUDGET_KB) {
  console.error(`One-Page budget exceeded by ${(onePageKb - ONE_PAGE_BUDGET_KB).toFixed(1)} KB`);
  process.exit(1);
}
