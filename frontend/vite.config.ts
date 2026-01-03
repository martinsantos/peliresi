import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Cargar variables de entorno si se necesitan en proces.env (opcional)
  // loadEnv(mode, process.cwd(), '')
  
  // Base URL: usar '/' para producción sitrep, '/demoambiente/' para demo legacy
  // Si existe VITE_BASE_URL, tiene prioridad
  const baseUrl = process.env.VITE_BASE_URL || (mode === 'production' ? '/' : '/demoambiente/')

  return {
    base: baseUrl,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
        devOptions: {
          enabled: true
        },
        manifest: {
          name: 'SITREP - Trazabilidad Residuos Peligrosos',
          short_name: 'SITREP',
          description: 'Sistema de Trazabilidad de Residuos Peligrosos - Gobierno de Mendoza',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/app',
          scope: '/',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            // Cache para API (NetworkFirst para datos frescos, fallback a cache)
            {
              urlPattern: /^https:\/\/sitrep\.ultimamilla\.com\.ar\/api\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 24 * 60 * 60 // 24 horas
                },
                networkTimeoutSeconds: 10
              }
            },
            // Cache para mapas (OpenStreetMap)
            {
              urlPattern: /^https:\/\/.*\.tile\.openstreetmap\.org\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'osm-tiles',
                expiration: {
                  maxEntries: 500,
                  maxAgeSeconds: 30 * 24 * 60 * 60 // 30 días
                }
              }
            }
          ]
        }
      })
    ],
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom', 'axios'],
            ui: ['lucide-react', 'recharts'],
            map: ['leaflet', 'react-leaflet']
          }
        }
      },
      chunkSizeWarningLimit: 1000
    },
    server: {
      host: true,
      port: 5173
    }
  }
})
