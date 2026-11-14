// Bundle budget (proposal §12.6): the JavaScript needed before the first
// screen renders — the entry chunk plus everything it imports statically —
// must stay under BUDGET_KB gzipped. Lazy chunks (other screens, charts, the
// calendar, motion features) are not counted.
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

const seen = new Set();
const queue = [entry];
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

if (total / 1024 > BUDGET_KB) {
  console.error(`Bundle budget exceeded by ${(total / 1024 - BUDGET_KB).toFixed(1)} KB`);
  process.exit(1);
}
