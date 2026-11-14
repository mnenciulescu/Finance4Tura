import { defineConfig, devices } from "@playwright/test";

/**
 * Cross-platform behaviour tests (proposal §13): the real app, built with a
 * stubbed session and fixture data, on an iPhone (WebKit) and a Pixel
 * (Chrome) profile.
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
    { name: "iphone", use: { ...devices["iPhone 15"] } },
    { name: "pixel", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
});
