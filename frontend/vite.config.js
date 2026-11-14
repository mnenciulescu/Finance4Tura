import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

// Shown in Settings → About and used as the persisted-cache buster.
const appVersion = (() => {
  try { return execSync('git rev-parse --short HEAD').toString().trim() } catch { return 'dev' }
})()

// Theme meta colours (also in src/theme/themes.ts). The manifest holds one
// colour, so the Android splash is light even in Dark mode — accepted.
const LIGHT_BG = '#F2F2F7'

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["node_modules", "dist", "e2e/**"],
    css: { modules: { classNameStrategy: "non-scoped" } },
  },
  plugins: [
    react(),
    VitePWA({
      // "prompt": a new service worker waits until the user taps Reload in
      // the "New version available" toast (src/app/UpdatePrompt.tsx).
      registerType: 'prompt',
      includeAssets: ['apple-touch-icon.png', 'app-icon.svg', 'splash/*.png'],
      manifest: {
        id: '/',
        name: '4TURA Home',
        short_name: '4TURA Home',
        description: 'Personal dashboard: budget, split payments, investments, books and home utilities',
        theme_color: LIGHT_BG,
        background_color: LIGHT_BG,
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png',            sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png',            sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512.png',   sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'pwa-monochrome-512.png', sizes: '512x512', type: 'image/png', purpose: 'monochrome' },
        ],
      },
      workbox: {
        // woff2 included so the bundled Inter works offline on non-Apple devices.
        globPatterns: ['**/*.{js,css,html,svg,woff2,png}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Admin endpoints — never cache.
            urlPattern: /^https:\/\/2t55twyqmh\.execute-api\.eu-central-1\.amazonaws\.com\/Prod\/admin\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/2t55twyqmh\.execute-api\.eu-central-1\.amazonaws\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  define: {
    global: 'globalThis',
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  build: {
    rollupOptions: {
      output: {
        // Only the always-needed core is pinned. React Aria and Recharts are
        // left to Rollup: pinning them pulls packages they share with the
        // entry (clsx, use-sync-external-store…) into their chunk, which then
        // becomes part of the first download.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query', '@tanstack/react-query-persist-client', '@tanstack/query-async-storage-persister', 'idb-keyval'],
        },
      },
    },
  },
})
