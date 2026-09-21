import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
    exclude: ["node_modules", "dist"],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'app-icon.svg'],
      manifest: {
        name: '4TURA Home',
        short_name: '4TURA Home',
        description: 'Personal budgeting app',
        theme_color: '#00e07a',
        background_color: '#06080f',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        // Rendered from public/app-icon.svg. Maskable carries extra padding so
        // a circular crop never clips the house.
        icons: [
          { src: 'pwa-192.png',          sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png',          sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg}'],
        runtimeCaching: [
          {
            // Admin endpoints — never cache, bypass SW caching entirely
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
  define: { global: 'globalThis' },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react:    ['react', 'react-dom', 'react-router-dom'],
          recharts: ['recharts'],
        },
      },
    },
  },
})
