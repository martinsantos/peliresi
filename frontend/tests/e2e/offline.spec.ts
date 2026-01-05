import { test, expect, Page } from '@playwright/test';

const DEMO_USERS = {
  admin: { email: 'admin@dgfa.mendoza.gov.ar', password: 'password' },
  generador: { email: 'quimica.mendoza@industria.com', password: 'password' },
  transportista: { email: 'transportes.andes@logistica.com', password: 'password' },
  operador: { email: 'tratamiento.residuos@planta.com', password: 'password' },
};

async function login(page: Page, role: keyof typeof DEMO_USERS) {
  const { email, password } = DEMO_USERS[role];
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|manifiestos/, { timeout: 10000 });
}

test.describe('PWA Setup', () => {
  test('should have Service Worker registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const swRegistered = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        return !!reg;
      }
      return false;
    });
    expect(swRegistered).toBe(true);
  });

  test('should have valid manifest.webmanifest', async ({ page }) => {
    const response = await page.request.get('/manifest.webmanifest');
    expect(response.ok()).toBeTruthy();
  });

  test('should have custom-sw.js accessible', async ({ page }) => {
    const response = await page.request.get('/custom-sw.js');
    expect(response.ok()).toBeTruthy();
  });
});

test.describe('IndexedDB Storage', () => {
  test('should initialize IndexedDB on load', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const dbExists = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const request = indexedDB.open('sitrep-db-v2');
        request.onsuccess = () => {
          const db = request.result;
          const stores = Array.from(db.objectStoreNames);
          db.close();
          resolve(stores.includes('manifiestos'));
        };
        request.onerror = () => resolve(false);
      });
    });
    expect(dbExists).toBe(true);
  });
});

test.describe('Offline Operation Queue', () => {
  test('should not crash when going offline', async ({ page, context }) => {
    await login(page, 'admin');
    await context.setOffline(true);
    await page.goto('/manifiestos').catch(() => {});
    const hasContent = await page.locator('body').isVisible();
    expect(hasContent).toBe(true);
    await context.setOffline(false);
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
  });
});

test.describe('GPS Tracking', () => {
  test('should have geolocation API available', async ({ page }) => {
    await page.goto('/');
    const hasGeo = await page.evaluate(() => 'geolocation' in navigator);
    expect(hasGeo).toBe(true);
  });
});

test.describe('Data Synchronization', () => {
  test('sync endpoint should require authentication', async ({ page }) => {
    const response = await page.request.get('/api/sync/initial').catch(() => null);
    if (response) {
      expect([401, 403]).toContain(response.status());
    }
  });
});

test.describe('API Health', () => {
  test('health endpoint should return ok', async ({ page }) => {
    const response = await page.request.get('/api/health');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe('ok');
  });
});
