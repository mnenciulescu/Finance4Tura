// Test harness build: the real app with Cognito stubbed (a signed-in session)
// and every API call answered from invented fixtures — nothing reaches AWS.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
const here = p => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  root: here("."),
  base: "/",
  plugins: [react()],
  resolve: {
    alias: {
      "amazon-cognito-identity-js": here("./cognito-stub.js"),
      "virtual:pwa-register/react": here("./pwa-stub.js"),
    },
  },
  define: { global: "globalThis", __APP_VERSION__: JSON.stringify("e2e") },
  build: { outDir: here("../../test-results/harness-dist"), emptyOutDir: true, target: "es2022" },
  publicDir: here("../../public"),
});
