import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
  plugins: [react()],
  base: '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
})
