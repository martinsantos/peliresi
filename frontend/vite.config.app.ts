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

function cleanAppleDoubleFiles(): Plugin {
  return {
    name: 'clean-apple-double',
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist-app')
      if (!fs.existsSync(outDir)) return
      const walk = (directory: string) => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
          const target = path.join(directory, entry.name)
          if (entry.name.startsWith('._')) {
            fs.rmSync(target, { recursive: true, force: true })
          } else if (entry.isDirectory()) {
            walk(target)
          }
        }
      }
      walk(outDir)
    },
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

      // Precache every hashed chunk. The app is used in vehicles with hostile
      // connectivity; QR/GPS pages must be available after a fresh install.
      const precacheUrls: string[] = []

      if (fs.existsSync(assetsDir)) {
        const files = fs.readdirSync(assetsDir)
        for (const file of files) {
          if (!file.startsWith('._') && (file.endsWith('.js') || file.endsWith('.css'))) {
            precacheUrls.push(`/app/assets/${file}`)
          }
        }
      }

      // Keep the institutional artwork available with the installed app.
      for (const icon of ['icon-192.png', 'icon-512.png', 'mendoza-marca-horizontal-transparente.png', 'mendoza-marca-secundaria-transparente.png']) {
        if (fs.existsSync(path.join(outDir, icon))) {
          precacheUrls.push(`/app/${icon}`)
        }
      }

      // OCR is intentionally local and lazy in the UI, but once the user
      // opens the document scanner the PWA must keep the worker, WASM and
      // Spanish language model available during a connectivity outage.
      for (const ocrAsset of [
        'worker.min.js',
        'tesseract-core.wasm.js',
        'tesseract-core.wasm',
        'spa.traineddata',
      ]) {
        if (fs.existsSync(path.join(outDir, 'ocr', ocrAsset))) {
          precacheUrls.push(`/app/ocr/${ocrAsset}`)
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

const manualChunkGroups: Array<[string, string[]]> = [
  ['vendor', ['react', 'react-dom', 'react-router-dom']],
  ['ui', ['lucide-react']],
]

function manualChunks(id: string) {
  if (!id.includes('node_modules')) return undefined

  const normalizedId = id.split('\\').join('/')
  const group = manualChunkGroups.find(([, packages]) =>
    packages.some((pkg) => normalizedId.includes(`/node_modules/${pkg}/`)),
  )

  return group?.[0]
}

export default defineConfig({
  plugins: [react(), renameAppHtml(), pwaPrecachePlugin(), cleanAppleDoubleFiles()],

  define: {
    'import.meta.env.VITE_SITREP_PWA': JSON.stringify('true'),
  },

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
        manualChunks,
      }
    }
  },

  resolve: {
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
})
