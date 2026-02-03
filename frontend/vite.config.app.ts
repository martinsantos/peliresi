import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Vite Config para PWA Mobile (/app)
 *
 * Build separado para la experiencia mobile PWA
 * Sirve en: sitrep.ultimamilla.com.ar/app/
 */

export default defineConfig({
  plugins: [react()],

  base: '/app/',

  root: '.',
  publicDir: 'public',

  build: {
    outDir: 'dist-app',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'app.html'),
      },
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['lucide-react'],
        }
      }
    }
  },

  resolve: {
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
})
