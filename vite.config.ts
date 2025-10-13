import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      // Using existing manifest file
      manifest: false,
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB limit for large apps
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,gif,webp,woff2,woff,ttf}'],
        runtimeCaching: [
          // Cache Supabase Edge Functions with different strategies based on function type
          {
            // Cache read-only GET requests with StaleWhileRevalidate
            urlPattern: /^https:\/\/[^/]+\.functions\.supabase\.co\/.*(get|list|fetch)/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'supabase-functions-read',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 15 * 60 // 15 minutes for read operations
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              matchOptions: {
                ignoreSearch: true
              }
            }
          },
          // Default cache for other Supabase Edge Functions
          {
            urlPattern: /^https:\/\/[^/]+\.functions\.supabase\.co\//i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-functions',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 1 * 60 // 1 minute for write operations
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Cache static assets
          {
            urlPattern: /^https?:\/\/.*\.(png|jpg|jpeg|svg|gif|webp|woff2|woff|ttf)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
              }
            }
          },
          // Cache API responses with cache-control headers
          {
            urlPattern: /^https?:\/\/.*\.(json|xml)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-responses',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 24 * 60 * 60 // 1 day
              },
              matchOptions: {
                ignoreSearch: true
              }
            }
          }
        ],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true
      },
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
