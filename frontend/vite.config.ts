import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

function cleanAppleDoubleFiles(outDirName: string): Plugin {
  return {
    name: `clean-apple-double-${outDirName}`,
    closeBundle() {
      const outDir = path.resolve(__dirname, outDirName)
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

const manualChunkGroups: Array<[string, string[]]> = [
  ['vendor-react', ['react', 'react-dom', 'react-router-dom']],
  ['vendor-query', ['@tanstack/react-query']],
  ['vendor-charts', ['recharts']],
  ['vendor-maps', ['leaflet', 'react-leaflet']],
  ['vendor-pdf', ['jspdf', 'jspdf-autotable']],
  ['vendor-qr', ['jsqr', 'qrcode.react']],
]

function manualChunks(id: string) {
  if (!id.includes('node_modules')) return undefined

  const normalizedId = id.split('\\').join('/')
  const group = manualChunkGroups.find(([, packages]) =>
    packages.some((pkg) => normalizedId.includes(`/node_modules/${pkg}/`)),
  )

  return group?.[0]
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cleanAppleDoubleFiles('dist')],
  base: process.env.VITE_BASE_PATH || '/',
  // Local QA/E2E can keep the browser on one origin while routing API calls
  // to the disposable backend. Production continues to use the relative
  // /api path through Nginx because this target is opt-in.
  server: process.env.VITE_API_PROXY_TARGET
    ? {
        proxy: {
          '/api': {
            target: process.env.VITE_API_PROXY_TARGET,
            changeOrigin: true,
          },
        },
      }
    : undefined,
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
})
