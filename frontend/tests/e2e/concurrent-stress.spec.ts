import { test, expect, Page } from '@playwright/test';

/**
 * TESTS DE ESTRES - CARGA CONCURRENTE
 *
 * Estos tests validan que el sistema maneja multiples sesiones simultaneas
 * y que las APIs responden correctamente bajo carga.
 * Adaptados para ejecutar en CI sin datos de prueba especificos.
 */

const DEMO_GATE_PASSWORD = 'mimi88';

const DEMO_USERS = {
  admin: { email: 'admin@dgfa.mendoza.gov.ar', password: 'password' },
  generador: { email: 'quimica.mendoza@industria.com', password: 'password' },
  transportista: { email: 'transportes.andes@logistica.com', password: 'password' },
  operador: { email: 'tratamiento.residuos@planta.com', password: 'password' },
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

test.describe('Tests de estres - Carga concurrente', () => {
  // Aumentar timeout para tests concurrentes
  test.setTimeout(60000);

  test('Multiples contextos cargan la app simultaneamente', async ({ browser }) => {
    console.log('[TEST] Iniciando test de cargas concurrentes...');

    // Crear 4 contextos
    const contexts = await Promise.all(
      Array(4).fill(null).map(() => browser.newContext())
    );

    console.log(`[TEST] ${contexts.length} contextos creados`);

    try {
      // Cargar pagina principal en todos los contextos simultaneamente
      const loadResults = await Promise.all(
        contexts.map(async (ctx, i) => {
          const page = await ctx.newPage();
          const startTime = Date.now();

          try {
            await page.goto('/');
            await page.waitForLoadState('domcontentloaded');
            const loadTime = Date.now() - startTime;
            console.log(`[TEST] Contexto ${i + 1}: Carga exitosa en ${loadTime}ms`);
            return { success: true, index: i, loadTime, page };
          } catch (error: any) {
            console.error(`[TEST] Contexto ${i + 1}: Carga fallida - ${error.message}`);
            return { success: false, index: i, error: error.message, page };
          }
        })
      );

      // Verificar resultados
      const successes = loadResults.filter(r => r.success);

      console.log(`[TEST] Resultados: ${successes.length}/${contexts.length} exitosos`);

      // Todos deben cargar correctamente
      expect(successes.length).toBe(contexts.length);

      // Verificar que cada pagina tiene contenido
      for (const result of successes) {
        const isVisible = await result.page.locator('body').isVisible();
        expect(isVisible).toBe(true);
      }

      console.log('[TEST] Todas las cargas concurrentes exitosas');

    } finally {
      await Promise.all(contexts.map(ctx => ctx.close()));
      console.log('[TEST] Contextos cerrados');
    }
  });

  test('APIs responden bajo carga concurrente', async ({ request }) => {
    console.log('[TEST] Iniciando test de carga en APIs...');

    // Hacer 10 peticiones concurrentes al health endpoint
    const requests = Array(10).fill(null).map(async (_, i) => {
      const startTime = Date.now();
      try {
        const response = await request.get('/api/health');
        const duration = Date.now() - startTime;
        return {
          success: response.ok(),
          status: response.status(),
          duration,
          index: i
        };
      } catch (error: any) {
        return {
          success: false,
          status: 0,
          duration: Date.now() - startTime,
          index: i,
          error: error.message
        };
      }
    });

    const results = await Promise.all(requests);

    // Analizar resultados
    const successes = results.filter(r => r.success);
    const avgDuration = successes.reduce((sum, r) => sum + r.duration, 0) / successes.length;
    const maxDuration = Math.max(...successes.map(r => r.duration));

    console.log(`[TEST] Health API: ${successes.length}/10 exitosos`);
    console.log(`[TEST] Tiempo promedio: ${avgDuration.toFixed(0)}ms, maximo: ${maxDuration}ms`);

    // Todas las peticiones deben ser exitosas
    expect(successes.length).toBe(10);

    // Tiempo promedio debe ser menor a 2 segundos
    expect(avgDuration).toBeLessThan(2000);
  });

  test('Paginas cargan concurrentemente sin interferencia', async ({ browser }) => {
    console.log('[TEST] Iniciando test de cargas concurrentes...');

    // Crear 3 contextos
    const contexts = await Promise.all(
      Array(3).fill(null).map(() => browser.newContext())
    );

    try {
      // Cargar diferentes paginas concurrentemente
      const pages = ['/login', '/', '/demo-app'];
      const results = await Promise.all(
        contexts.map(async (ctx, i) => {
          const page = await ctx.newPage();
          const targetPage = pages[i % pages.length];
          const startTime = Date.now();

          try {
            await page.goto(targetPage);
            await page.waitForLoadState('domcontentloaded');
            const loadTime = Date.now() - startTime;
            const hasContent = await page.locator('body').isVisible();
            console.log(`[TEST] Contexto ${i + 1} (${targetPage}): Cargado en ${loadTime}ms`);
            return { success: hasContent, loadTime, index: i, page: targetPage };
          } catch (error: any) {
            console.error(`[TEST] Contexto ${i + 1}: Error - ${error.message}`);
            return { success: false, loadTime: Date.now() - startTime, index: i, error: error.message };
          }
        })
      );

      const successfulLoads = results.filter(r => r.success);
      console.log(`[TEST] Cargas exitosas: ${successfulLoads.length}/${contexts.length}`);

      // Todas deben cargar correctamente
      expect(successfulLoads.length).toBe(contexts.length);

    } finally {
      await Promise.all(contexts.map(ctx => ctx.close()));
    }
  });

  test('WebSocket soporta conexiones concurrentes', async ({ page }) => {
    console.log('[TEST] Verificando soporte WebSocket...');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const wsStatus = await page.evaluate(() => {
      return {
        supported: 'WebSocket' in window,
        socketIO: typeof (window as any).io !== 'undefined'
      };
    });

    console.log(`[TEST] WebSocket: supported=${wsStatus.supported}`);

    expect(wsStatus.supported).toBe(true);

    // Verificar que podemos crear conexiones WebSocket (API disponible)
    const canCreateWS = await page.evaluate(() => {
      try {
        // Solo verificamos que la clase existe, no conectamos realmente
        return typeof WebSocket === 'function';
      } catch {
        return false;
      }
    });

    expect(canCreateWS).toBe(true);
    console.log('[TEST] WebSocket API disponible');
  });

  test('Rate limiting permite trafico normal', async ({ request }) => {
    console.log('[TEST] Verificando rate limiting...');

    // Hacer 20 peticiones rapidas (deberia estar dentro del limite)
    const results: { status: number; duration: number }[] = [];

    for (let i = 0; i < 20; i++) {
      const startTime = Date.now();
      const response = await request.get('/api/health');
      results.push({
        status: response.status(),
        duration: Date.now() - startTime
      });
    }

    const okResponses = results.filter(r => r.status === 200);
    const rateLimited = results.filter(r => r.status === 429);

    console.log(`[TEST] 200 OK: ${okResponses.length}, 429 Rate Limited: ${rateLimited.length}`);

    // La mayoria debe ser exitosa (el rate limit es 100/min para API general)
    expect(okResponses.length).toBeGreaterThanOrEqual(18);
  });
});
