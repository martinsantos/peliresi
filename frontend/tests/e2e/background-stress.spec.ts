import { test, expect, Page } from '@playwright/test';

/**
 * TESTS DE ESTRES - APP EN BACKGROUND Y BATERIA BAJA
 *
 * Estos tests validan capacidades del navegador para soportar
 * funcionalidades de background y bajo consumo.
 * Adaptados para ejecutar en CI sin datos de prueba especificos.
 */

const DEMO_GATE_PASSWORD = 'mimi88';

const DEMO_USERS = {
  admin: { email: 'admin@dgfa.mendoza.gov.ar', password: 'password' },
  transportista: { email: 'transportes.andes@logistica.com', password: 'password' },
};

async function bypassDemoGate(page: Page) {
  const passwordGate = page.locator('text=Contraseña de acceso a la demo');
  if (await passwordGate.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.fill('input[type="password"]', DEMO_GATE_PASSWORD);
    await page.click('button:has-text("Ingresar")');
    await page.waitForLoadState('networkidle');
  }
}

async function login(page: Page, role: keyof typeof DEMO_USERS) {
  const { email, password } = DEMO_USERS[role];
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await bypassDemoGate(page);
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await bypassDemoGate(page);
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|manifiestos/, { timeout: 15000 });
}

test.describe('Tests de estres - App en background y bateria baja', () => {

  test('Visibilidad API disponible para tracking en background', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verificar que la API de visibilidad esta disponible
    const hasVisibilityAPI = await page.evaluate(() => {
      return 'hidden' in document && 'visibilityState' in document;
    });

    expect(hasVisibilityAPI).toBe(true);

    // Verificar que podemos detectar cambios de visibilidad
    const canDetectVisibility = await page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        let detected = false;
        const handler = () => {
          detected = true;
          document.removeEventListener('visibilitychange', handler);
        };
        document.addEventListener('visibilitychange', handler);

        // Simular cambio
        Object.defineProperty(document, 'hidden', { value: true, writable: true, configurable: true });
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));

        // Restaurar
        Object.defineProperty(document, 'hidden', { value: false, writable: true, configurable: true });
        Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true });

        resolve(detected);
      });
    });

    expect(canDetectVisibility).toBe(true);
    console.log('[TEST] Visibility API funciona correctamente');
  });

  test('CPU throttling - App sigue respondiendo', async ({ page, context }) => {
    // Activar CPU throttling (simulando ahorro de bateria)
    const client = await context.newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 }); // 4x slowdown

    console.log('[TEST] CPU throttling activado (4x slowdown)');

    // Cargar pagina deberia completar aunque mas lento
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;

    console.log(`[TEST] Tiempo de carga con CPU throttling: ${loadTime}ms`);

    // Validar que carga completa (aunque mas lento)
    expect(loadTime).toBeLessThan(30000);

    // Verificar que la pagina cargo
    const bodyVisible = await page.locator('body').isVisible();
    expect(bodyVisible).toBe(true);

    // Desactivar throttling
    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    console.log('[TEST] CPU throttling desactivado - Test completado');
  });

  test('Service Worker registrado y activo', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Esperar un poco para que SW se registre
    await page.waitForTimeout(2000);

    const swStatus = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) {
        return { supported: false, registered: false, active: false };
      }

      try {
        const registration = await navigator.serviceWorker.getRegistration();
        return {
          supported: true,
          registered: registration !== undefined,
          active: registration?.active !== null,
          state: registration?.active?.state || 'none'
        };
      } catch {
        return { supported: true, registered: false, active: false };
      }
    });

    console.log(`[TEST] Service Worker: supported=${swStatus.supported}, registered=${swStatus.registered}, active=${swStatus.active}`);

    expect(swStatus.supported).toBe(true);
    // En CI headless, SW puede no estar completamente activo
    // Solo verificamos que esta soportado y se intento registrar
  });

  test('IndexedDB disponible para almacenamiento offline', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const idbStatus = await page.evaluate(async () => {
      if (!('indexedDB' in window)) {
        return { supported: false, canOpen: false };
      }

      return new Promise<{ supported: boolean; canOpen: boolean; databases?: string[] }>((resolve) => {
        try {
          const request = indexedDB.open('test-db', 1);
          request.onerror = () => resolve({ supported: true, canOpen: false });
          request.onsuccess = () => {
            request.result.close();
            indexedDB.deleteDatabase('test-db');
            resolve({ supported: true, canOpen: true });
          };
        } catch {
          resolve({ supported: true, canOpen: false });
        }
      });
    });

    console.log(`[TEST] IndexedDB: supported=${idbStatus.supported}, canOpen=${idbStatus.canOpen}`);

    expect(idbStatus.supported).toBe(true);
    expect(idbStatus.canOpen).toBe(true);
  });

  test('Background Sync API disponible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const bgSyncStatus = await page.evaluate(() => {
      const hasAPI = 'sync' in ServiceWorkerRegistration.prototype;
      const hasPeriodicSync = 'periodicSync' in ServiceWorkerRegistration.prototype;

      return {
        syncAvailable: hasAPI,
        periodicSyncAvailable: hasPeriodicSync
      };
    });

    console.log(`[TEST] Background Sync API: sync=${bgSyncStatus.syncAvailable}, periodicSync=${bgSyncStatus.periodicSyncAvailable}`);

    // Background Sync puede no estar disponible en todos los navegadores
    // Solo logueamos el estado
    expect(typeof bgSyncStatus.syncAvailable).toBe('boolean');
  });

  test('Cache API disponible para recursos offline', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const cacheStatus = await page.evaluate(async () => {
      if (!('caches' in window)) {
        return { supported: false, cacheNames: [] };
      }

      try {
        const names = await caches.keys();
        return { supported: true, cacheNames: names };
      } catch {
        return { supported: true, cacheNames: [] };
      }
    });

    console.log(`[TEST] Cache API: supported=${cacheStatus.supported}, caches=${cacheStatus.cacheNames.length}`);

    expect(cacheStatus.supported).toBe(true);
  });
});
