import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// EMERGENCY: PWA disabled - see plugin section
// import { VitePWA } from 'vite-plugin-pwa'

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
      // EMERGENCY: PWA/Service Worker DISABLED due to RESULT_CODE_KILLED_BAD_MESSAGE crash
      // TODO: Re-enable after fixing SW caching issues
      // VitePWA({
      //   strategies: 'injectManifest',
      //   srcDir: 'src',
      //   filename: 'sw-custom.ts',
      //   registerType: 'autoUpdate',
      //   includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      //   devOptions: {
      //     enabled: true,
      //     type: 'module'
      //   },
      //   injectManifest: {
      //     globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      //     maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
      //   },
      //   manifest: {
      //     name: 'SITREP - Trazabilidad Residuos Peligrosos',
      //     short_name: 'SITREP',
      //     description: 'Sistema de Trazabilidad de Residuos Peligrosos - Gobierno de Mendoza',
      //     theme_color: '#0f172a',
      //     background_color: '#0f172a',
      //     display: 'standalone',
      //     orientation: 'portrait',
      //     start_url: '/app',
      //     scope: '/',
      //     icons: [
      //       {
      //         src: 'pwa-192x192.png',
      //         sizes: '192x192',
      //         type: 'image/png'
      //       },
      //       {
      //         src: 'pwa-512x512.png',
      //         sizes: '512x512',
      //         type: 'image/png'
      //       },
      //       {
      //         src: 'pwa-512x512.png',
      //         sizes: '512x512',
      //         type: 'image/png',
      //         purpose: 'any maskable'
      //       }
      //     ]
      //   }
      // })
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
