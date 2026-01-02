# 🟢 Track B: Frontend & PWA

## Contexto
Sistema de Trazabilidad de Residuos Peligrosos (SITREP) para DGFA Mendoza.
- **Demo actual**: https://www.ultimamilla.com.ar/demoambiente/
- **Proyecto**: `/trazabilidad-rrpp-demo/frontend/`
- **Stack**: React 18 + TypeScript + Vite + TailwindCSS

---

## Tareas a Ejecutar

### B1: Optimizar Build de Producción
Modificar `frontend/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/api\/manifiestos/,
            handler: 'NetworkFirst',
            options: { cacheName: 'manifiestos-cache' }
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          maps: ['leaflet', 'react-leaflet']
        }
      }
    }
  }
});
```

### B2: Service Worker Completo para Offline
Crear `frontend/src/services/offlineStorage.ts`:
```typescript
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface OfflineDB extends DBSchema {
  manifiestos: {
    key: string;
    value: Manifiesto;
    indexes: { byEstado: string };
  };
  operacionesPendientes: {
    key: number;
    value: { tipo: string; datos: any; timestamp: number };
  };
}

export class OfflineStorage {
  private db: IDBPDatabase<OfflineDB> | null = null;
  
  async init() {
    this.db = await openDB<OfflineDB>('sitrep-offline', 1, {
      upgrade(db) {
        db.createObjectStore('manifiestos', { keyPath: 'id' });
        db.createObjectStore('operacionesPendientes', { 
          keyPath: 'id', 
          autoIncrement: true 
        });
      }
    });
  }
  
  async cacheManifiesto(manifiesto: Manifiesto) { /* ... */ }
  async getManifiestosLocales() { /* ... */ }
  async queueOperation(operation: any) { /* ... */ }
  async syncPendingOperations() { /* ... */ }
}
```

Actualizar `frontend/public/sw.js` para interceptar requests de API.

### B3: Configurar para Dominio de Producción
Crear `frontend/.env.production.new`:
```env
VITE_API_URL=https://ambiente.mendoza.gov.ar/api
VITE_APP_NAME=SITREP - Trazabilidad RRPP
VITE_ENABLE_OFFLINE=true
```

Actualizar `frontend/public/manifest.json`:
```json
{
  "name": "SITREP - Sistema de Trazabilidad",
  "short_name": "SITREP",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#10b981",
  "background_color": "#ffffff"
}
```

### B4: Mejorar UX Móvil para Transportistas
- Revisar `frontend/src/pages/DemoApp.tsx`
- Optimizar touch targets (mínimo 44x44px)
- Agregar gestos swipe para cambiar entre tabs
- Mejorar feedback visual en acciones

### B5: Push Notifications Reales
Crear `frontend/src/services/pushNotifications.ts`:
```typescript
export async function subscribeToPush() {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: process.env.VITE_VAPID_PUBLIC_KEY
  });
  
  // Enviar subscription al backend
  await fetch('/api/push/subscribe', {
    method: 'POST',
    body: JSON.stringify(subscription)
  });
}
```

### B6: Testing de Accesibilidad
Instalar y configurar:
```bash
npm install -D @axe-core/playwright
```

Crear tests en `frontend/tests/accessibility/`:
```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('dashboard should be accessible', async ({ page }) => {
  await page.goto('/dashboard');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

---

## Verificación
```bash
# Build de producción
cd frontend && npm run build

# Analizar bundle
npx vite-bundle-visualizer

# Tests
npm run test

# Lighthouse audit
npx lighthouse http://localhost:4173 --view
```

---

## Archivos a Modificar/Crear
- [ ] `frontend/vite.config.ts` (PWA plugin)
- [ ] `frontend/src/services/offlineStorage.ts`
- [ ] `frontend/public/sw.js` (o autogenerado por Vite PWA)
- [ ] `frontend/.env.production.new`
- [ ] `frontend/public/manifest.json`
- [ ] `frontend/src/services/pushNotifications.ts`
- [ ] `frontend/tests/accessibility/*.spec.ts`
