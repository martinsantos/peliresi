import { test, expect } from '@playwright/test';

/**
 * TESTS DE ESTRÉS - APP EN BACKGROUND Y BATERÍA BAJA
 *
 * Objetivo: Validar que Service Worker mantiene funcionalidad cuando app está en segundo plano
 * Escenarios:
 * 1. App en background durante viaje (tracking GPS debe continuar)
 * 2. Modo ahorro de batería Android (CPU throttling)
 * 3. Notificaciones push con app cerrada
 */

test.describe('Tests de estrés - App en background y batería baja', () => {

  test('Tracking GPS con app en background', async ({ page, context }) => {
    // 1. Dar permiso de geolocalización
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -32.8895, longitude: -68.8458, accuracy: 10 });

    // 2. Login como transportista
    await page.goto('/login');
    await page.fill('[name="email"]', 'transportista@test.com');
    await page.fill('[name="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('/transportista/manifiestos', { timeout: 5000 });

    // 3. Iniciar viaje
    const firstManifiesto = await page.locator('[data-testid^="manifiesto-"]').first();
    await firstManifiesto.click();
    await page.click('[data-testid="confirmar-retiro"]');
    await page.fill('[name="observaciones"]', 'Background test');
    await page.click('button[type="submit"]');

    // 4. Esperar primer punto GPS
    await page.waitForTimeout(3000);

    // 5. Contar puntos GPS iniciales
    const initialGpsPoints = await page.evaluate(async () => {
      try {
        const dbRequest = indexedDB.open('sitrep-offline', 1);
        return new Promise<number>((resolve) => {
          dbRequest.onsuccess = (event: any) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('gpsPoints')) {
              resolve(0);
              return;
            }
            const tx = db.transaction('gpsPoints', 'readonly');
            const store = tx.objectStore('gpsPoints');
            const countRequest = store.count();
            countRequest.onsuccess = () => resolve(countRequest.result);
            countRequest.onerror = () => resolve(0);
          };
          dbRequest.onerror = () => resolve(0);
        });
      } catch {
        return 0;
      }
    });

    console.log(`[TEST] Puntos GPS iniciales: ${initialGpsPoints}`);

    // 6. Simular que app pasa a background (documento oculto)
    await page.evaluate(() => {
      // Cambiar document.hidden y visibilityState
      Object.defineProperty(document, 'hidden', {
        value: true,
        writable: true,
        configurable: true
      });
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
        configurable: true
      });

      // Disparar evento de cambio de visibilidad
      const event = new Event('visibilitychange');
      document.dispatchEvent(event);

      console.log('[CLIENT] App simulada en background - visibilityState:', document.visibilityState);
    });

    console.log('[TEST] App simulada en background - esperando 2 minutos...');

    // 7. Esperar 2 minutos (4 puntos GPS a 30s cada uno)
    await page.waitForTimeout(120000);

    // 8. Volver a foreground
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', {
        value: false,
        writable: true,
        configurable: true
      });
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
        configurable: true
      });

      const event = new Event('visibilitychange');
      document.dispatchEvent(event);

      console.log('[CLIENT] App de vuelta en foreground - visibilityState:', document.visibilityState);
    });

    console.log('[TEST] App de vuelta en foreground');

    // 9. Esperar que se procesen operaciones pendientes
    await page.waitForTimeout(3000);

    // 10. Contar puntos GPS finales
    const finalGpsPoints = await page.evaluate(async () => {
      try {
        const dbRequest = indexedDB.open('sitrep-offline', 1);
        return new Promise<number>((resolve) => {
          dbRequest.onsuccess = (event: any) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('gpsPoints')) {
              resolve(0);
              return;
            }
            const tx = db.transaction('gpsPoints', 'readonly');
            const store = tx.objectStore('gpsPoints');
            const countRequest = store.count();
            countRequest.onsuccess = () => resolve(countRequest.result);
            countRequest.onerror = () => resolve(0);
          };
          dbRequest.onerror = () => resolve(0);
        });
      } catch {
        return 0;
      }
    });

    console.log(`[TEST] Puntos GPS finales: ${finalGpsPoints}`);
    const pointsAdded = finalGpsPoints - initialGpsPoints;
    console.log(`[TEST] Puntos agregados durante background: ${pointsAdded}`);

    // Esperamos al menos 3-4 puntos (120s / 30s = 4 puntos idealmente)
    // En práctica, puede ser menos si el tracking se pausa en background
    expect(pointsAdded).toBeGreaterThanOrEqual(2);
  });

  test('Modo ahorro de batería - CPU throttling', async ({ page, context }) => {
    // 1. Activar CPU throttling (simulando ahorro de batería Android)
    const client = await context.newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 6 }); // 6x slowdown

    console.log('[TEST] CPU throttling activado (6x slowdown)');

    // 2. Login (debería ser más lento pero funcional)
    const startTime = Date.now();
    await page.goto('/login');
    await page.fill('[name="email"]', 'transportista@test.com');
    await page.fill('[name="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('/transportista/manifiestos', { timeout: 15000 }); // Más timeout por throttling
    const loginTime = Date.now() - startTime;

    console.log(`[TEST] Tiempo de login con CPU throttling: ${loginTime}ms`);

    // Validar que login completa (aunque más lento)
    expect(loginTime).toBeLessThan(15000);

    // 3. Grant geolocation y configurar
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -32.8895, longitude: -68.8458, accuracy: 10 });

    // 4. Iniciar viaje
    const firstManifiesto = await page.locator('[data-testid^="manifiesto-"]').first();
    await firstManifiesto.click();
    await page.click('[data-testid="confirmar-retiro"]');
    await page.fill('[name="observaciones"]', 'CPU throttling test');
    await page.click('button[type="submit"]');

    // 5. Esperar tracking GPS (más tiempo por throttling)
    await page.waitForTimeout(35000); // Esperar al menos 1 punto GPS

    // 6. Validar que tracking funciona (aunque más lento)
    const gpsPointsCount = await page.evaluate(async () => {
      try {
        const dbRequest = indexedDB.open('sitrep-offline', 1);
        return new Promise<number>((resolve) => {
          dbRequest.onsuccess = (event: any) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('gpsPoints')) {
              resolve(0);
              return;
            }
            const tx = db.transaction('gpsPoints', 'readonly');
            const store = tx.objectStore('gpsPoints');
            const countRequest = store.count();
            countRequest.onsuccess = () => resolve(countRequest.result);
            countRequest.onerror = () => resolve(0);
          };
          dbRequest.onerror = () => resolve(0);
        });
      } catch {
        return 0;
      }
    });

    console.log(`[TEST] Puntos GPS con CPU throttling: ${gpsPointsCount}`);
    expect(gpsPointsCount).toBeGreaterThanOrEqual(1);

    // 7. Desactivar throttling
    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    console.log('[TEST] CPU throttling desactivado');
  });

  test('Service Worker activo después de cerrar y reabrir app', async ({ page, context }) => {
    // 1. Login y navegar
    await page.goto('/login');
    await page.fill('[name="email"]', 'transportista@test.com');
    await page.fill('[name="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('/transportista/manifiestos', { timeout: 5000 });

    // 2. Verificar que Service Worker está registrado
    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const registration = await navigator.serviceWorker.getRegistration();
      return registration !== undefined;
    });

    console.log(`[TEST] Service Worker registrado: ${swRegistered}`);
    expect(swRegistered).toBe(true);

    // 3. Guardar operación pendiente offline (simular)
    await page.evaluate(async () => {
      try {
        const dbRequest = indexedDB.open('sitrep-offline', 1);
        return new Promise<void>((resolve) => {
          dbRequest.onsuccess = (event: any) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('operacionesPendientes')) {
              resolve();
              return;
            }
            const tx = db.transaction('operacionesPendientes', 'readwrite');
            const store = tx.objectStore('operacionesPendientes');
            store.add({
              tipo: 'UPDATE',
              endpoint: '/api/test',
              method: 'POST',
              datos: { test: true },
              timestamp: Date.now(),
              retries: 0
            });
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
          };
          dbRequest.onerror = () => resolve();
        });
      } catch {
        console.error('[CLIENT] Error guardando operación pendiente');
      }
    });

    // 4. "Cerrar" la app (navegar away)
    await page.goto('about:blank');
    await page.waitForTimeout(2000);

    // 5. "Reabrir" la app (navegar de vuelta)
    await page.goto('/transportista/manifiestos');
    await page.waitForLoadState('networkidle');

    // 6. Verificar que Service Worker sigue activo
    const swStillActive = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const registration = await navigator.serviceWorker.getRegistration();
      return registration !== undefined && registration.active !== null;
    });

    console.log(`[TEST] Service Worker activo después de reabrir: ${swStillActive}`);
    expect(swStillActive).toBe(true);

    // 7. Verificar que operaciones pendientes siguen en IndexedDB
    const pendingOpsAfterReopen = await page.evaluate(async () => {
      try {
        const dbRequest = indexedDB.open('sitrep-offline', 1);
        return new Promise<number>((resolve) => {
          dbRequest.onsuccess = (event: any) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('operacionesPendientes')) {
              resolve(0);
              return;
            }
            const tx = db.transaction('operacionesPendientes', 'readonly');
            const store = tx.objectStore('operacionesPendientes');
            const countRequest = store.count();
            countRequest.onsuccess = () => resolve(countRequest.result);
            countRequest.onerror = () => resolve(0);
          };
          dbRequest.onerror = () => resolve(0);
        });
      } catch {
        return 0;
      }
    });

    console.log(`[TEST] Operaciones pendientes después de reabrir: ${pendingOpsAfterReopen}`);
    expect(pendingOpsAfterReopen).toBeGreaterThanOrEqual(1);
  });

  test('Background Sync API disponible', async ({ page, context }) => {
    // 1. Navegar a la app
    await page.goto('/login');
    await page.fill('[name="email"]', 'transportista@test.com');
    await page.fill('[name="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('/transportista/manifiestos', { timeout: 5000 });

    // 2. Verificar que Background Sync API está disponible
    const bgSyncAvailable = await page.evaluate(() => {
      return 'sync' in ServiceWorkerRegistration.prototype;
    });

    console.log(`[TEST] Background Sync API disponible: ${bgSyncAvailable}`);

    if (bgSyncAvailable) {
      // 3. Verificar que se puede registrar un sync tag
      const syncRegistered = await page.evaluate(async () => {
        try {
          if (!('serviceWorker' in navigator)) return false;
          const registration = await navigator.serviceWorker.ready;
          if (!registration.sync) return false;

          // Intentar registrar un sync tag de prueba
          await registration.sync.register('test-sync');
          console.log('[CLIENT] Sync tag "test-sync" registrado');
          return true;
        } catch (error) {
          console.error('[CLIENT] Error registrando sync:', error);
          return false;
        }
      });

      console.log(`[TEST] Sync tag registrado: ${syncRegistered}`);
      expect(syncRegistered).toBe(true);

    } else {
      console.log('[WARN] Background Sync no soportado en este navegador');
    }
  });
});
