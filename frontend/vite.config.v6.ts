import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Vite Config para UI/UX v6 Revolution
 * 
 * Esta configuración corre en paralelo al sistema actual:
 * - Puerto: 5174 (el original usa 5173)
 * - Base path: /v6/ (accesible en http://localhost:5174/v6/)
 * - Proxy API al mismo backend de producción
 */

export default defineConfig({
  plugins: [react()],
  
  // Puerto diferente para correr en paralelo
  server: {
    port: 5174,
    host: true,
    strictPort: true,
    hmr: {
      path: '/__hmr',
    },
    proxy: {
      '/api': {
        target: 'https://sitrep.ultimamilla.com.ar',
        changeOrigin: true,
        secure: true
      }
    }
  },
  
  // Base path para la nueva UI v6
  base: '/v6/',
  
  // Entry point diferente
  root: '.',
  publicDir: 'public',
  
  // Use index-v6.html as entry point
  optimizeDeps: {
    entries: ['src-v6/main.tsx'],
  },
  
  // Build output separado
  build: {
    outDir: 'dist-v6',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['lucide-react'],
        }
      }
    }
  },
  
  // Path aliases para la nueva estructura
  resolve: {
    dedupe: ['react', 'react-dom', 'react-router-dom'],
    alias: {
      '@v6': path.resolve(__dirname, './src-v6'),
      '@design': path.resolve(__dirname, './src-v6/design-system'),
      '@components': path.resolve(__dirname, './src-v6/components'),
      '@pages': path.resolve(__dirname, './src-v6/pages'),
      '@hooks': path.resolve(__dirname, './src-v6/hooks'),
      '@utils': path.resolve(__dirname, './src-v6/utils'),
      '@types': path.resolve(__dirname, './src-v6/types'),
      '@layouts': path.resolve(__dirname, './src-v6/layouts'),
    }
  },
  
  // CSS configuration
  css: {
    devSourcemap: true,
    postcss: './postcss.config.cjs',
  }
})
