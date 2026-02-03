import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

/**
 * Vite Config para PWA Mobile (/app)
 *
 * Build separado para la experiencia mobile PWA
 * Sirve en: sitrep.ultimamilla.com.ar/app/
 */

// Plugin para renombrar app.html -> index.html en el output
function renameAppHtml(): Plugin {
  return {
    name: 'rename-app-html',
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist-app')
      const appHtml = path.join(outDir, 'app.html')
      const indexHtml = path.join(outDir, 'index.html')
      if (fs.existsSync(appHtml)) {
        fs.copyFileSync(appHtml, indexHtml)
      }
    }
  }
}

export default defineConfig({
  plugins: [react(), renameAppHtml()],

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
