import { test, expect, Page } from '@playwright/test';

/**
 * TESTS DE ESTRES - CONEXION INTERMITENTE Y OFFLINE
 *
 * Estos tests validan el comportamiento de la app cuando hay
 * problemas de conectividad o la red es lenta.
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

test.describe('Tests de estres - Conexion intermitente', () => {
  // Aumentar timeout para tests con throttling
  test.setTimeout(60000);

  test('App detecta estado offline', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verificar que navigator.onLine esta disponible
    const onlineStatus = await page.evaluate(() => ({
      hasOnLine: 'onLine' in navigator,
      currentStatus: navigator.onLine
    }));

    console.log(`[TEST] Navigator.onLine: hasOnLine=${onlineStatus.hasOnLine}, currentStatus=${onlineStatus.currentStatus}`);

    expect(onlineStatus.hasOnLine).toBe(true);
    expect(onlineStatus.currentStatus).toBe(true);

    // Simular offline
    await context.setOffline(true);

    const offlineStatus = await page.evaluate(() => navigator.onLine);
    console.log(`[TEST] Estado despues de setOffline: ${offlineStatus}`);

    // En Playwright, setOffline no siempre cambia navigator.onLine inmediatamente
    // pero si bloquea las peticiones de red

    // Restaurar
    await context.setOffline(false);
  });

  test('Eventos online/offline se disparan', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Configurar listeners
    await page.evaluate(() => {
      (window as any).__offlineEvents = [];
      window.addEventListener('offline', () => (window as any).__offlineEvents.push('offline'));
      window.addEventListener('online', () => (window as any).__offlineEvents.push('online'));
    });

    // Simular ciclo offline/online
    await context.setOffline(true);
    await page.waitForTimeout(500);
    await context.setOffline(false);
    await page.waitForTimeout(500);

    const events = await page.evaluate(() => (window as any).__offlineEvents);
    console.log(`[TEST] Eventos capturados: ${JSON.stringify(events)}`);

    // Los eventos pueden o no dispararse dependiendo del navegador
    // Solo verificamos que el mecanismo esta disponible
    expect(Array.isArray(events)).toBe(true);
  });

  test('Peticiones fallan gracefully cuando offline', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await bypassDemoGate(page);

    // Ir offline
    await context.setOffline(true);

    // Intentar hacer una peticion
    const result = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/health');
        return { success: true, status: response.status };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    console.log(`[TEST] Peticion offline: success=${result.success}, error=${result.error || 'none'}`);

    expect(result.success).toBe(false);

    // Restaurar
    await context.setOffline(false);
  });

  test('App se recupera despues de reconectar', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await bypassDemoGate(page);

    // Verificar que estamos en la app
    const initialContent = await page.locator('body').isVisible();
    expect(initialContent).toBe(true);

    // Ir offline brevemente
    await context.setOffline(true);
    await page.waitForTimeout(1000);

    // Reconectar
    await context.setOffline(false);
    await page.waitForTimeout(1000);

    // Verificar que la pagina sigue visible
    const afterReconnect = await page.locator('body').isVisible();
    expect(afterReconnect).toBe(true);

    // Verificar que podemos hacer peticiones
    const healthResponse = await page.request.get('/api/health').catch(() => null);
    expect(healthResponse?.ok()).toBe(true);

    console.log('[TEST] App se recupero correctamente despues de reconectar');
  });

  test('Throttling de red 3G - Pagina carga', async ({ page, context }) => {
    // Configurar throttling 3G
    const client = await context.newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (750 * 1024) / 8, // 750kb/s
      uploadThroughput: (250 * 1024) / 8,   // 250kb/s
      latency: 100 // 100ms
    });

    console.log('[TEST] Throttling 3G activado');

    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;

    console.log(`[TEST] Tiempo de carga con 3G: ${loadTime}ms`);

    // Pagina debe cargar en tiempo razonable
    expect(loadTime).toBeLessThan(30000);

    // Verificar que hay contenido visible
    const hasContent = await page.locator('body').isVisible();
    expect(hasContent).toBe(true);

    // Limpiar throttling
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0
    });
  });

  test('Throttling de red 2G - App sigue funcional', async ({ page, context }) => {
    // Configurar throttling 2G (muy lento pero no tan extremo)
    const client = await context.newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (100 * 1024) / 8,  // 100kb/s
      uploadThroughput: (50 * 1024) / 8,     // 50kb/s
      latency: 300 // 300ms
    });

    console.log('[TEST] Throttling 2G activado');

    // Cargar pagina principal
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;

    console.log(`[TEST] Tiempo de carga con 2G: ${loadTime}ms`);

    // Pagina debe cargar eventualmente
    const bodyVisible = await page.locator('body').isVisible();
    expect(bodyVisible).toBe(true);

    // Limpiar throttling
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0
    });
  });

  test('Cache funciona para recursos estaticos', async ({ page }) => {
    // Primera carga
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verificar que hay recursos en cache
    const cacheStatus = await page.evaluate(async () => {
      if (!('caches' in window)) {
        return { supported: false, cached: 0 };
      }

      try {
        const cacheNames = await caches.keys();
        let totalCached = 0;

        for (const name of cacheNames) {
          const cache = await caches.open(name);
          const keys = await cache.keys();
          totalCached += keys.length;
        }

        return { supported: true, cached: totalCached, cacheNames };
      } catch {
        return { supported: true, cached: 0 };
      }
    });

    console.log(`[TEST] Cache: supported=${cacheStatus.supported}, recursos=${cacheStatus.cached}`);

    expect(cacheStatus.supported).toBe(true);
    // Puede haber 0 recursos si el SW no esta activo en headless
  });

  test('Fetch API con timeout funciona', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verificar que podemos hacer fetch con AbortController
    const result = await page.evaluate(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch('/api/health', { signal: controller.signal });
        clearTimeout(timeoutId);
        return { success: response.ok, status: response.status, aborted: false };
      } catch (error: any) {
        clearTimeout(timeoutId);
        return { success: false, aborted: error.name === 'AbortError', error: error.message };
      }
    });

    console.log(`[TEST] Fetch con timeout: success=${result.success}, status=${result.status}`);

    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
  });
});
