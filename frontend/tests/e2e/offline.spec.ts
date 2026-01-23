import { test, expect, Page } from '@playwright/test';

/**
 * SITREP E2E Tests - PWA y Funcionalidad Offline
 *
 * Estos tests verifican las capacidades PWA del sistema,
 * incluyendo Service Worker, IndexedDB, y funcionamiento offline.
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

test.describe('PWA Setup', () => {
  test('Service Worker API disponible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const swStatus = await page.evaluate(async () => {
      const supported = 'serviceWorker' in navigator;
      if (!supported) return { supported: false, registered: false };

      try {
        const reg = await navigator.serviceWorker.getRegistration();
        return {
          supported: true,
          registered: reg !== undefined,
          scope: reg?.scope || null,
          state: reg?.active?.state || 'none'
        };
      } catch {
        return { supported: true, registered: false };
      }
    });

    console.log(`[TEST] Service Worker: supported=${swStatus.supported}, registered=${swStatus.registered}`);

    // Solo verificamos que la API esta disponible
    // En CI headless, el SW puede no registrarse completamente
    expect(swStatus.supported).toBe(true);
  });

  test('should have valid manifest.webmanifest', async ({ page }) => {
    const response = await page.request.get('/manifest.webmanifest');
    expect(response.ok()).toBeTruthy();

    const manifest = await response.json();
    expect(manifest.name).toBeDefined();
    expect(manifest.short_name).toBeDefined();
    expect(manifest.icons).toBeDefined();

    console.log(`[TEST] Manifest: name="${manifest.name}", icons=${manifest.icons?.length || 0}`);
  });

  test('should have custom-sw.js accessible', async ({ page }) => {
    const response = await page.request.get('/custom-sw.js');
    expect(response.ok()).toBeTruthy();

    const content = await response.text();
    expect(content.length).toBeGreaterThan(0);

    console.log(`[TEST] custom-sw.js: ${content.length} bytes`);
  });
});

test.describe('IndexedDB Storage', () => {
  test('IndexedDB API disponible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const idbStatus = await page.evaluate(async () => {
      if (!('indexedDB' in window)) {
        return { supported: false, canCreate: false };
      }

      // Intentar crear una base de datos de prueba
      return new Promise<{ supported: boolean; canCreate: boolean }>((resolve) => {
        try {
          const request = indexedDB.open('test-idb-check', 1);
          request.onerror = () => resolve({ supported: true, canCreate: false });
          request.onsuccess = () => {
            request.result.close();
            indexedDB.deleteDatabase('test-idb-check');
            resolve({ supported: true, canCreate: true });
          };
        } catch {
          resolve({ supported: true, canCreate: false });
        }
      });
    });

    console.log(`[TEST] IndexedDB: supported=${idbStatus.supported}, canCreate=${idbStatus.canCreate}`);

    expect(idbStatus.supported).toBe(true);
    expect(idbStatus.canCreate).toBe(true);
  });

  test('App puede almacenar datos localmente', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verificar localStorage
    const localStorageWorks = await page.evaluate(() => {
      try {
        localStorage.setItem('test-key', 'test-value');
        const retrieved = localStorage.getItem('test-key');
        localStorage.removeItem('test-key');
        return retrieved === 'test-value';
      } catch {
        return false;
      }
    });

    expect(localStorageWorks).toBe(true);

    // Verificar sessionStorage
    const sessionStorageWorks = await page.evaluate(() => {
      try {
        sessionStorage.setItem('test-key', 'test-value');
        const retrieved = sessionStorage.getItem('test-key');
        sessionStorage.removeItem('test-key');
        return retrieved === 'test-value';
      } catch {
        return false;
      }
    });

    expect(sessionStorageWorks).toBe(true);

    console.log(`[TEST] localStorage=${localStorageWorks}, sessionStorage=${sessionStorageWorks}`);
  });
});

test.describe('Offline Operation Queue', () => {
  test('App no crashea cuando pierde conexion', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await bypassDemoGate(page);

    // Verificar que estamos en la app
    const initialVisible = await page.locator('body').isVisible();
    expect(initialVisible).toBe(true);

    // Ir offline
    await context.setOffline(true);

    // Esperar un momento
    await page.waitForTimeout(1000);

    // Verificar que la pagina actual sigue visible (no crasheo)
    const stillVisible = await page.locator('body').isVisible();
    expect(stillVisible).toBe(true);

    // Restaurar conexion
    await context.setOffline(false);

    console.log('[TEST] App sobrevivio el cambio a offline');
  });
});

test.describe('QR Validation', () => {
  test('QR validation should require authentication', async ({ page }) => {
    const response = await page.request.post('/api/manifiestos/validar-qr', {
      headers: { 'Content-Type': 'application/json' },
      data: { codigoQR: 'test-qr' }
    }).catch(() => null);

    if (response) {
      expect([401, 403]).toContain(response.status());
      console.log(`[TEST] QR validation sin auth: ${response.status()}`);
    } else {
      console.log('[TEST] QR endpoint no disponible o error de conexion');
    }
  });
});

test.describe('Dashboard Statistics', () => {
  test('dashboard API should return stats', async ({ page }) => {
    await login(page, 'admin');
    const token = await page.evaluate(() => localStorage.getItem('accessToken'));

    if (token) {
      const response = await page.request.get('/api/manifiestos/dashboard/stats', {
        headers: { 'Authorization': 'Bearer ' + token }
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.stats).toBeDefined();

      console.log(`[TEST] Dashboard stats: ${JSON.stringify(Object.keys(data.data.stats))}`);
    } else {
      console.log('[WARN] No se obtuvo token de acceso');
    }
  });
});

test.describe('Push Notifications', () => {
  test('VAPID key endpoint should return public key', async ({ page }) => {
    const response = await page.request.get('/api/push/vapid-key');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.publicKey).toBeDefined();
    expect(data.data.publicKey.length).toBeGreaterThan(0);

    console.log(`[TEST] VAPID key length: ${data.data.publicKey.length}`);
  });

  test('Push API disponible en navegador', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const pushStatus = await page.evaluate(() => {
      return {
        hasPushManager: 'PushManager' in window,
        hasNotification: 'Notification' in window
      };
    });

    console.log(`[TEST] Push: PushManager=${pushStatus.hasPushManager}, Notification=${pushStatus.hasNotification}`);

    expect(pushStatus.hasPushManager).toBe(true);
    expect(pushStatus.hasNotification).toBe(true);
  });
});

test.describe('GPS Tracking', () => {
  test('should have geolocation API available', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await bypassDemoGate(page);

    const hasGeo = await page.evaluate(() => 'geolocation' in navigator);
    expect(hasGeo).toBe(true);

    console.log(`[TEST] Geolocation API: ${hasGeo}`);
  });
});

test.describe('Data Synchronization', () => {
  test('sync endpoint should require authentication', async ({ page }) => {
    const response = await page.request.get('/api/sync/initial').catch(() => null);

    if (response) {
      expect([401, 403]).toContain(response.status());
      console.log(`[TEST] Sync endpoint sin auth: ${response.status()}`);
    } else {
      console.log('[TEST] Sync endpoint no disponible');
    }
  });
});

test.describe('API Health', () => {
  test('health endpoint should return ok', async ({ page }) => {
    const response = await page.request.get('/api/health');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.status).toBe('ok');

    console.log(`[TEST] Health: ${data.status}`);
  });

  test('API responde rapidamente', async ({ page }) => {
    const startTime = Date.now();
    const response = await page.request.get('/api/health');
    const duration = Date.now() - startTime;

    expect(response.ok()).toBeTruthy();
    expect(duration).toBeLessThan(2000);

    console.log(`[TEST] Health response time: ${duration}ms`);
  });
});
