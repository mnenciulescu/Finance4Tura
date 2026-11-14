// Renders the PWA icons and iPhone launch screens from SVG (proposal §10.4).
//
//   node scripts/generate-pwa-assets.mjs
//
// Writes public/app-icon*.svg, the PNG icons, public/splash/*.png and the
// <link rel="apple-touch-startup-image"> tags between the SPLASH markers in
// index.html. Uses the installed Chrome through Playwright.

import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

const pub = new URL("../public/", import.meta.url).pathname;

// The glyph: a house with a door, drawn on a 512 grid, centred at (256, 262).
const house = (fill, door) => `
  <path d="M256 128 L118 246 Q108 255 108 268 L108 372 Q108 396 132 396 L380 396 Q404 396 404 372 L404 268 Q404 255 394 246 Z" fill="${fill}"/>
  <rect x="226" y="300" width="60" height="96" rx="14" fill="${door}"/>`;

const tileDefs = `
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#4AA3FF"/>
      <stop offset="100%" stop-color="#0060DF"/>
    </linearGradient>
  </defs>`;

const svg = (body, { rx = 0, scale = 1 } = {}) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="4TURA Home">${tileDefs}
  <rect width="512" height="512" rx="${rx}" fill="url(#tile)"/>
  <g transform="translate(256 262) scale(${scale}) translate(-256 -262)">${body}</g>
</svg>
`;

const icons = {
  // Rounded tile: favicon and in-app use.
  "app-icon.svg": svg(house("#FFFFFF", "#2F8BFF"), { rx: 114 }),
  // Full bleed for launchers and iOS (which apply their own mask); the glyph
  // stays within the 80 % safe zone so a circular crop never clips it.
  "app-icon-square.svg": svg(house("#FFFFFF", "#2F8BFF")),
  "app-icon-maskable.svg": svg(house("#FFFFFF", "#2F8BFF"), { scale: 0.78 }),
  // Android themed icons: a single-colour glyph on transparent.
  "app-icon-monochrome.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <g transform="translate(256 262) scale(0.78) translate(-256 -262)">
    <path d="M256 128 L118 246 Q108 255 108 268 L108 372 Q108 396 132 396 L380 396 Q404 396 404 372 L404 268 Q404 255 394 246 Z M226 396 L226 314 Q226 300 240 300 L272 300 Q286 300 286 314 L286 396 Z" fill="#FFFFFF" fill-rule="evenodd"/>
  </g>
</svg>
`,
};
for (const [name, content] of Object.entries(icons)) writeFileSync(pub + name, content);

const pngs = [
  ["app-icon.svg", "pwa-192.png", 192],
  ["app-icon.svg", "pwa-512.png", 512],
  ["app-icon-maskable.svg", "pwa-maskable-512.png", 512],
  ["app-icon-monochrome.svg", "pwa-monochrome-512.png", 512],
  ["app-icon-square.svg", "apple-touch-icon.png", 180],
];

// iPhone portrait screens: [css width, css height, pixel ratio].
const screens = [
  [430, 932, 3], [393, 852, 3], [402, 874, 3], [440, 956, 3],
  [390, 844, 3], [428, 926, 3], [375, 812, 3], [414, 896, 2], [375, 667, 2], [414, 896, 3],
];
const THEMES = { light: "#F2F2F7", dark: "#000000" };

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();

for (const [src, out, size] of pngs) {
  await page.setViewportSize({ width: size, height: size });
  const body = readFileSync(pub + src, "utf8").replace(/width="512" height="512"/, `width="${size}" height="${size}"`);
  await page.setContent(`<html><body style="margin:0;background:transparent">${body}</body></html>`);
  await page.locator("svg").screenshot({ path: pub + out, omitBackground: true });
}

const links = [];
for (const [w, h, dpr] of screens) {
  for (const [theme, bg] of Object.entries(THEMES)) {
    const file = `splash/launch-${w * dpr}x${h * dpr}-${theme}.png`;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    const p = await ctx.newPage();
    const icon = readFileSync(pub + "app-icon.svg", "utf8").replace(/width="512" height="512"/, 'width="112" height="112"');
    await p.setContent(`<html><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:${bg}">${icon}</body></html>`);
    await p.screenshot({ path: pub + file });
    await ctx.close();
    links.push(`    <link rel="apple-touch-startup-image" href="/${file}" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait) and (prefers-color-scheme: ${theme})" />`);
  }
}
await browser.close();

const indexPath = new URL("../index.html", import.meta.url).pathname;
const html = readFileSync(indexPath, "utf8");
const block = `<!--SPLASH-->\n${links.join("\n")}\n    <!--/SPLASH-->`;
writeFileSync(indexPath, html.replace(/<!--SPLASH-->[\s\S]*?(<!--\/SPLASH-->|(?=\n\s*<\/head>))/, block));
console.log(`icons: ${pngs.length}, launch screens: ${links.length}`);
