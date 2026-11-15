import { defineConfig, devices } from "@playwright/test";

/**
 * Cross-platform behaviour tests (proposal §13): the real app, built with a
 * stubbed session and fixture data, on an iPhone (WebKit) and a Pixel
 * (Chrome) profile; One-Page on desktop Chrome and desktop WebKit.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4318",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx vite build --config e2e/harness/vite.config.js && node e2e/harness/serve.mjs 4318",
    url: "http://localhost:4318",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: "iphone", use: { ...devices["iPhone 15"] }, testIgnore: /onepage/ },
    { name: "pixel", use: { ...devices["Pixel 7"], channel: "chrome" }, testIgnore: /onepage/ },
    // One-Page (desktop dashboard)
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1440, height: 900 } }, testMatch: /onepage/ },
    { name: "desktop-webkit", use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 800 } }, testMatch: /onepage/ },
  ],
});
