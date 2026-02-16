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

// Plugin para generar precache manifest y versionar el SW
function pwaPrecachePlugin(): Plugin {
  return {
    name: 'pwa-precache',
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist-app')
      const assetsDir = path.join(outDir, 'assets')

      // Build version from timestamp
      const version = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)

      // Collect app shell assets (NOT lazy-loaded page chunks)
      const precacheUrls: string[] = []

      if (fs.existsSync(assetsDir)) {
        const files = fs.readdirSync(assetsDir)
        for (const file of files) {
          // Precache: vendor, main, ui bundles + CSS (the app shell)
          // Skip: page-specific chunks (lazy loaded on demand)
          if (
            file.match(/^(vendor|main|ui)-.*\.(js|css)$/) ||
            file.match(/^index\..*\.css$/)
          ) {
            precacheUrls.push(`/app/assets/${file}`)
          }
        }
      }

      // Add icon files if they exist
      for (const icon of ['icon-192.png', 'icon-512.png']) {
        if (fs.existsSync(path.join(outDir, icon))) {
          precacheUrls.push(`/app/${icon}`)
        }
      }

      // Write precache manifest
      const manifestContent = `// Auto-generated precache manifest — ${version}\nself.__PRECACHE_MANIFEST = ${JSON.stringify(precacheUrls, null, 2)};\n`
      fs.writeFileSync(path.join(outDir, 'sw-precache-manifest.js'), manifestContent)

      // Copy and version sw-app.js into dist-app
      const swSrc = path.join(__dirname, 'public', 'sw-app.js')
      const swDest = path.join(outDir, 'sw-app.js')
      if (fs.existsSync(swSrc)) {
        let swContent = fs.readFileSync(swSrc, 'utf-8')
        swContent = swContent.replace(/__SW_VERSION__/g, version)
        fs.writeFileSync(swDest, swContent)
      }

      console.log(`[PWA] Precache manifest: ${precacheUrls.length} assets, version ${version}`)
    }
  }
}

export default defineConfig({
  plugins: [react(), renameAppHtml(), pwaPrecachePlugin()],

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
