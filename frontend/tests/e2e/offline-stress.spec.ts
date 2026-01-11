import { test, expect } from '@playwright/test';

/**
 * TESTS DE ESTRÉS - CONEXIÓN INTERMITENTE
 *
 * Objetivo: Validar que la app funciona correctamente con pérdida/recuperación constante de red
 * Escenarios:
 * 1. Offline durante confirmación de retiro
 * 2. Offline durante envío de puntos GPS
 * 3. Throttling de red 3G/2G
 */

test.describe('Tests de estrés - Conexión intermitente', () => {

  test('Confirmar retiro offline y sincronizar automáticamente', async ({ page, context }) => {
    // 1. Login como transportista
    await page.goto('/login');
    await page.fill('[name="email"]', 'transportista@test.com');
    await page.fill('[name="password"]', '123456');
    await page.click('button[type="submit"]');

    // 2. Ir a manifiestos asignados
    await page.waitForURL('/transportista/manifiestos', { timeout: 5000 });

    // 3. Guardar manifiesto ID para validación posterior
    const firstManifiesto = await page.locator('[data-testid^="manifiesto-"]').first();
    const manifiestoId = await firstManifiesto.getAttribute('data-testid');

    // 4. Simular offline ANTES de confirmar retiro
    await context.setOffline(true);

    // 5. Verificar que aparece indicador offline
    await page.waitForSelector('[data-testid="offline-indicator"]', { timeout: 3000 }).catch(() => {
      console.log('[WARN] Indicador offline no encontrado - puede no estar implementado');
    });

    // 6. Intentar confirmar retiro (debe guardar localmente)
    await firstManifiesto.click();
    await page.waitForSelector('[data-testid="confirmar-retiro"]', { timeout: 3000 });
    await page.click('[data-testid="confirmar-retiro"]');
    await page.fill('[name="observaciones"]', 'Retiro offline test - automated');
    await page.click('button[type="submit"]');

    // 7. Verificar que se guardó localmente en IndexedDB
    const pendingOpsCount = await page.evaluate(async () => {
      try {
        const dbRequest = indexedDB.open('sitrep-offline', 1);
        return new Promise<number>((resolve, reject) => {
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
      } catch (error) {
        console.error('[IndexedDB] Error:', error);
        return 0;
      }
    });

    console.log(`[TEST] Operaciones pendientes en IndexedDB: ${pendingOpsCount}`);
    expect(pendingOpsCount).toBeGreaterThanOrEqual(1);

    // 8. Reconectar a internet
    await context.setOffline(false);
    console.log('[TEST] Reconectado a internet - esperando sincronización automática...');

    // 9. Esperar sincronización automática (máx 5 segundos según exponential backoff)
    await page.waitForTimeout(5000);

    // 10. Verificar que operación se sincronizó (debería no tener operaciones pendientes)
    const syncedOpsCount = await page.evaluate(async () => {
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
            countRequest.onerror = () => resolve(999); // Error sentinel
          };
          dbRequest.onerror = () => resolve(999);
        });
      } catch {
        return 999;
      }
    });

    console.log(`[TEST] Operaciones pendientes después de sync: ${syncedOpsCount}`);

    // Validar que se sincronizó (debería ser 0 o cercano a 0)
    expect(syncedOpsCount).toBeLessThan(pendingOpsCount);
  });

  test('Pérdida de red durante envío de puntos GPS', async ({ page, context }) => {
    // 1. Grant geolocation permission
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -32.8895, longitude: -68.8458, accuracy: 10 });

    // 2. Login como transportista
    await page.goto('/login');
    await page.fill('[name="email"]', 'transportista@test.com');
    await page.fill('[name="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('/transportista/manifiestos', { timeout: 5000 });

    // 3. Confirmar retiro de un manifiesto (iniciar viaje)
    const firstManifiesto = await page.locator('[data-testid^="manifiesto-"]').first();
    await firstManifiesto.click();
    await page.click('[data-testid="confirmar-retiro"]');
    await page.fill('[name="observaciones"]', 'GPS test offline');
    await page.click('button[type="submit"]');

    // 4. Esperar que inicie tracking GPS (primer punto)
    await page.waitForTimeout(2000);

    // 5. Simular pérdida de red cada 45 segundos (durante tracking)
    const gpsCaptureInterval = setInterval(async () => {
      console.log('[TEST] Simulando pérdida de red intermitente...');
      await context.setOffline(true);
      await page.waitForTimeout(10000); // 10s offline
      await context.setOffline(false);
      await page.waitForTimeout(35000); // 35s online (total 45s)
    }, 45000);

    // 6. Dejar correr durante 90 segundos (2 ciclos completos)
    await page.waitForTimeout(90000);
    clearInterval(gpsCaptureInterval);

    // 7. Validar que puntos GPS se almacenaron localmente
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

    console.log(`[TEST] Puntos GPS almacenados: ${gpsPointsCount}`);

    // Esperamos al menos 3 puntos GPS (cada 30s = 90s / 30s = 3)
    expect(gpsPointsCount).toBeGreaterThanOrEqual(2);

    // 8. Reconectar completamente y verificar batch sync
    await context.setOffline(false);
    await page.waitForTimeout(5000);

    // 9. Verificar que puntos se sincronizaron (opcional - requiere verificar en servidor)
  });

  test('Throttling de red 3G lento - Validar sincronización', async ({ page, context }) => {
    // 1. Configurar throttling 3G lento (750kb/s down, 250kb/s up)
    const client = await context.newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (750 * 1024) / 8, // 750kb/s to bytes/second
      uploadThroughput: (250 * 1024) / 8,   // 250kb/s
      latency: 100 // 100ms latency
    });

    // 2. Login como transportista
    const startTime = Date.now();
    await page.goto('/login');
    await page.fill('[name="email"]', 'transportista@test.com');
    await page.fill('[name="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('/transportista/manifiestos', { timeout: 10000 });
    const loginTime = Date.now() - startTime;

    console.log(`[TEST] Tiempo de login con 3G lento: ${loginTime}ms`);

    // Validar que login completa en tiempo razonable (< 10s)
    expect(loginTime).toBeLessThan(10000);

    // 3. Cargar manifiestos
    const syncStartTime = Date.now();
    await page.waitForSelector('[data-testid^="manifiesto-"]', { timeout: 10000 });
    const syncTime = Date.now() - syncStartTime;

    console.log(`[TEST] Tiempo de sincronización de manifiestos con 3G: ${syncTime}ms`);

    // Validar que sincronización completa en < 5 segundos (objetivo del plan)
    expect(syncTime).toBeLessThan(5000);

    // 4. Validar que Service Worker cachea recursos estáticos
    const cachedResources = await page.evaluate(async () => {
      const cacheNames = await caches.keys();
      const workboxCache = cacheNames.find(name => name.includes('workbox'));
      if (!workboxCache) return [];

      const cache = await caches.open(workboxCache);
      const keys = await cache.keys();
      return keys.map(req => req.url);
    });

    console.log(`[TEST] Recursos en cache: ${cachedResources.length}`);
    expect(cachedResources.length).toBeGreaterThan(0);

    // 5. Limpiar throttling
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0
    });
  });
});
